#!/usr/bin/env tsx
/**
 * codegraph 查询落盘校验脚本（Codegraph Queries Checker）
 *
 * 对应约束 #14 + 反模式 #38：阶段 5-8 任何代码/测试文件修改前，
 * S-coding 须先调用 codegraph_explore 查询并落盘到
 * `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`。
 *
 * strict 绑定（2026-09-04 audit-gate-closure，Slice A）：阶段 5-8 CLI 必须提供
 * `--scope=<change-scope.json>`（或薄封装 `--change=<id> --base=<ref> --head=<ref>`），
 * 把查询与实际变更绑定——scope.changedFiles 与实际 Git 变更集合精确一致
 * （headRef 须等于当前 HEAD），每个查询的 changeId 精确等于 scope.changeId、
 * targetFiles 全属于 scope.changedFiles，且全部须覆盖的 code/test 变更文件
 * 至少被一个查询覆盖。无 scope → exit 1（不是 0）。原两参
 * `checkCodegraphQueries(projectRoot, phase)` 保留为 legacy 兼容层（self-test 用）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts <project-root> --phase <5|6|7|8> \
 *       --scope=<change-scope.json> [--json]
 *
 * 参数：
 *   project-root   项目根目录
 *   --phase        校验阶段 5|6|7|8（支持 --phase N 与 --phase=N）
 *   --scope=FILE   变更上下文 manifest（schemas/change-scope.schema.json）；与
 *                  --change/--base/--head 互斥；阶段 5-8 必选（缺失 → exit 1）
 *   --change/--base/--head  薄封装：以实际 Git 变更集合生成等价 scope（免维护 manifest）
 *   --json         机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  所有修改都有对应 codegraph 查询落盘（strict 覆盖绑定通过）
 *   1  存在未查询/未绑定变更（反模式 #38）或无 scope（变更上下文缺失）
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 CODEGRAPH_QUERIES_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag } from '../lib/parse-args.js';
import { loadCliScope } from '../lib/load-cli-scope.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import {
  changedFilePathViolation,
  isCodeOrTestFile,
  isIsoDateTimeString,
  type ChangeScope,
} from '../lib/change-scope.js';

/** legacy 兼容层查询形状（strict 模式在其上叠加 changeId/targetFiles） */
interface CodegraphQuery {
  querySymbol: string;
  callers?: unknown[];
  callees?: unknown[];
  blastRadius?: unknown;
  queryTimestamp: string;
}

interface CheckResult {
  passed: boolean;
  violations: string[];
  queryCount: number;
}

/** strict 覆盖校验结果（在原结构上加覆盖计数，供报告与聚合消费） */
export interface CodegraphStrictResult {
  passed: boolean;
  violations: string[];
  queryCount: number;
  /** scope 变更中须覆盖的 code/test 文件数（相对路径计数） */
  requiredFileCount: number;
  /** 已被至少一个查询 targetFiles 覆盖的 code/test 文件数 */
  coveredFileCount: number;
  /** docs-only 解阻断注记（F-G6-01）：scope 无 code/test 变更时 codegraph 不适用 */
  note?: string;
}

/** 查询目录名：phase<N>-*.json（strict 只认 scope.phase 对应文件，异 phase 同 changeId 属违规） */
function phaseQueryFiles(queriesDir: string, phase: number): { own: string[]; foreign: string[] } {
  const own: string[] = [];
  const foreign: string[] = [];
  // 文件名 phase 前缀须为精确单数字（phase5-*）：phase05-/phase55- 等形近名不归属本阶段
  // （\d+ 只做形状识别，归属判定用 phase<phase>- 精确前缀）
  const shapeRe = /^phase\d+-.*\.json$/;
  const ownPrefix = `phase${phase}-`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 查询文件来自项目受控 .w-model/codegraph-queries/ 目录枚举
  for (const f of readdirSync(queriesDir)) {
    if (!shapeRe.test(f)) continue;
    if (f.startsWith(ownPrefix)) own.push(f);
    else foreign.push(f);
  }
  return { own, foreign };
}

/** schema 失败时优先给出精确路径/时间违规消息（值级定位），否则退回通用结构消息 */
function schemaFailViolation(fileName: string, schemaMessages: string[], q: unknown): string {
  const query = q as { targetFiles?: unknown; queryTimestamp?: unknown };
  if (Array.isArray(query.targetFiles)) {
    for (const tf of query.targetFiles) {
      const reason = changedFilePathViolation(tf);
      if (reason !== null) return `${fileName}：targetFiles 目标 ${String(tf)} 非法：${reason}`;
    }
  }
  if (query.queryTimestamp !== undefined && !isIsoDateTimeString(query.queryTimestamp)) {
    return `${fileName}：queryTimestamp 非合法 ISO date-time（${String(query.queryTimestamp)}）`;
  }
  return `${fileName}：结构校验失败：${schemaMessages.slice(0, 3).join('；')}`;
}

/**
 * 校验 codegraph 查询落盘纯逻辑（legacy 兼容层，可被 self-test import）。
 * 仅校验目录存在 + phase 文件字段完整性，不绑定实际变更——strict 绑定请用
 * checkCodegraphQueriesStrict（CLI 阶段 5-8 一律 strict）。
 * @param projectRoot 项目根目录
 * @param phase 阶段号 5-8
 */
export function checkCodegraphQueries(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const queriesDir = path.join(projectRoot, '.w-model', 'codegraph-queries');

  // 查询目录存在性
  if (!existsSync(queriesDir)) {
    violations.push(
      `阶段 ${phase}：.w-model/codegraph-queries/ 目录不存在（约束 #14：阶段 5-8 代码修改须先落盘 codegraph 查询）`,
    );
    return { passed: false, violations, queryCount: 0 };
  }

  // 收集该阶段的查询文件
  const prefix = `phase${phase}-`;
  const files = readdirSync(queriesDir).filter((f) => f.startsWith(prefix) && f.endsWith('.json'));

  if (files.length === 0) {
    violations.push(`阶段 ${phase}：.w-model/codegraph-queries/ 下无 phase${phase}-*.json 查询文件（约束 #14）`);
    return { passed: false, violations, queryCount: 0 };
  }

  // 校验每个查询文件的字段完整性
  let validCount = 0;
  for (const f of files) {
    const fp = path.join(queriesDir, f);
    let raw: string;
    try {
      raw = readFileSync(fp, 'utf-8');
    } catch {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    if (!raw) {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    try {
      const q = parseJsonSafe(raw) as CodegraphQuery;
      if (!q.querySymbol || typeof q.querySymbol !== 'string') {
        violations.push(`${f}：缺 querySymbol 字段`);
        continue;
      }
      if (!q.queryTimestamp || typeof q.queryTimestamp !== 'string') {
        violations.push(`${f}：缺 queryTimestamp 字段`);
        continue;
      }
      if (!Array.isArray(q.callers)) {
        violations.push(`${f}：缺 callers[] 字段`);
        continue;
      }
      if (!Array.isArray(q.callees)) {
        violations.push(`${f}：缺 callees[] 字段`);
        continue;
      }
      if (q.blastRadius === undefined || q.blastRadius === null || typeof q.blastRadius !== 'number') {
        violations.push(`${f}：缺 blastRadius 字段（查询结果影响半径，须为 number）`);
        continue;
      }
      validCount++;
    } catch {
      violations.push(`${f}：非合法 JSON`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    queryCount: validCount,
  };
}

/**
 * strict 覆盖绑定校验（阶段 5-8 + ChangeScope）：
 *   - 查询文件 phase 前缀 = scope.phase（同 changeId 但异 phase 前缀 → 违规）
 *   - 每个 phase 查询文件先过 codegraph-query.schema（结构校验保留）
 *   - changeId 精确等于 scope.changeId（无关查询不得放行）
 *   - targetFiles 为规范化相对路径且全部属于 scope.changedFiles（越界/绝对/`..`/反斜杠 → 违规）
 *   - queryTimestamp 合法 ISO date-time 且不晚于 scopeCreatedAt
 *   - scope 中每个须覆盖的 code/test 变更文件至少被一个查询的 targetFiles 覆盖
 * 缺 changeId/targetFiles 的既有查询：strict 下逐文件 violation（不允许 silent skip）。
 * @param projectRoot 项目根目录
 * @param scope 已通过 Git 绑定校验的 ChangeScope（changeId/phase/changedFiles/scopeCreatedAt）
 */
export function checkCodegraphQueriesStrict(projectRoot: string, scope: ChangeScope): CodegraphStrictResult {
  const violations: string[] = [];
  // 覆盖判定基准前置（F-G6-01）：strict 入口先按 scope 计算须覆盖 code/test 文件数。
  // docs-only 变更（required==0）时 codegraph 不适用——直接放行并附注记，跳过目录存在性/
  // 查询文件数检查；不再逼 S 为 docs 文件伪造查询落盘（与 hard-constraints.md 约束 #14
  // 「校验实际覆盖而非目录存在」一致）。存在性检查仅在 required>0 时执行。
  const required = scope.changedFiles.filter((f) => isCodeOrTestFile(f));
  if (required.length === 0) {
    return {
      passed: true,
      violations: [],
      queryCount: 0,
      requiredFileCount: 0,
      coveredFileCount: 0,
      note: 'scope 无 code/test 变更，codegraph 不适用（docs-only 变更不强制查询落盘）',
    };
  }
  const queriesDir = path.join(projectRoot, '.w-model', 'codegraph-queries');

  if (!existsSync(queriesDir)) {
    violations.push(
      `阶段 ${scope.phase}（changeId=${scope.changeId}）：.w-model/codegraph-queries/ 目录不存在` +
        `（约束 #14：阶段 5-8 代码修改须先落盘 codegraph 查询）`,
    );
    return { passed: false, violations, queryCount: 0, requiredFileCount: 0, coveredFileCount: 0 };
  }

  const { own: files, foreign } = phaseQueryFiles(queriesDir, scope.phase);
  // 同 changeId 但文件前缀为其它 phase：属 scope 查询，但 phase 前缀不匹配 → 违规
  for (const f of foreign) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 查询文件来自项目受控 .w-model/codegraph-queries/ 目录枚举
      const q = parseJsonSafe(readFileSync(path.join(queriesDir, f), 'utf-8')) as { changeId?: unknown };
      if (q.changeId === scope.changeId) {
        violations.push(
          `${f}：查询文件 phase 前缀与 scope.phase=${scope.phase} 不匹配（同 changeId=${scope.changeId}）`,
        );
      }
    } catch {
      // 异 phase 且不可解析的文件不属于本 scope，忽略（不阻断）
    }
  }

  if (files.length === 0) {
    violations.push(
      `阶段 ${scope.phase}（changeId=${scope.changeId}）：.w-model/codegraph-queries/ 下无 phase${scope.phase}-*.json 查询文件`,
    );
    return { passed: false, violations, queryCount: 0, requiredFileCount: 0, coveredFileCount: 0 };
  }

  let validCount = 0;
  let fileValid: boolean;
  const covered = new Set<string>();
  for (const f of files) {
    const fp = path.join(queriesDir, f);
    let raw: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 查询文件来自项目受控 .w-model/codegraph-queries/ 目录枚举
      raw = readFileSync(fp, 'utf-8');
    } catch {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    if (!raw) {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    fileValid = true;
    let q: unknown;
    try {
      q = parseJsonSafe(raw);
    } catch {
      violations.push(`${f}：非合法 JSON`);
      continue;
    }
    // 结构完整性校验保留：codegraph-query.schema（querySymbol/callers/callees/blastRadius/queryTimestamp 必填 + 类型）
    const schemaResult = validateBySchema('codegraph-query', q);
    if (!schemaResult.valid) {
      // schema 命中路径/时间格式时给出精确到值的 violation（否则只报结构失败，Agent 难定位）
      violations.push(schemaFailViolation(f, schemaResult.errorMessages, q));
      continue;
    }
    const query = q as { changeId?: unknown; targetFiles?: unknown; queryTimestamp?: unknown };
    if (query.changeId === undefined || query.changeId === null || typeof query.changeId !== 'string') {
      violations.push(
        `${f}：缺 changeId 字段（strict 模式必填，须等于 scope.changeId=${scope.changeId}；不允许 silent skip）`,
      );
      fileValid = false;
    } else if (query.changeId !== scope.changeId) {
      violations.push(
        `${f}：changeId=${query.changeId} 与 scope.changeId=${scope.changeId} 不一致（无关查询不得放行）`,
      );
      fileValid = false;
    }
    if (!Array.isArray(query.targetFiles) || query.targetFiles.length === 0) {
      if (!Array.isArray(query.targetFiles)) {
        violations.push(
          `${f}：缺 targetFiles[] 字段（strict 模式必填；目标文件须全属于 scope.changedFiles；不允许 silent skip）`,
        );
      } else {
        violations.push(`${f}：targetFiles[] 为空（每个查询须声明至少一个目标变更文件）`);
      }
      fileValid = false;
    } else {
      for (const tf of query.targetFiles) {
        const reason = changedFilePathViolation(tf);
        if (reason !== null) {
          violations.push(`${f}：targetFiles 目标 ${String(tf)} 非法：${reason}`);
          fileValid = false;
          continue;
        }
        if (!scope.changedFiles.includes(tf as string)) {
          violations.push(`${f}：targetFiles 目标 ${String(tf)} 不在 scope.changedFiles 声明内`);
          fileValid = false;
        }
      }
    }
    if (query.queryTimestamp === undefined || !isIsoDateTimeString(query.queryTimestamp)) {
      violations.push(`${f}：queryTimestamp 非合法 ISO date-time（${String(query.queryTimestamp)}）`);
      fileValid = false;
    } else if (Date.parse(query.queryTimestamp) > Date.parse(scope.scopeCreatedAt)) {
      violations.push(
        `${f}：queryTimestamp=${query.queryTimestamp} 晚于 scopeCreatedAt=${scope.scopeCreatedAt}` +
          `（查询须不晚于 scope 创建时刻）`,
      );
      fileValid = false;
    }
    if (fileValid) {
      validCount++;
      for (const tf of (query.targetFiles as string[]) ?? []) covered.add(tf);
    }
  }

  // 覆盖判定：scope 中每个须覆盖的 code/test 变更文件至少被一个合法查询覆盖
  // （required 已在函数入口前置计算；此处 required>0）
  let coveredCount = 0;
  for (const f of required) {
    if (covered.has(f)) coveredCount++;
    else {
      violations.push(`${f}：变更代码/测试文件未被任何查询的 targetFiles 覆盖（查询须与实际变更绑定）`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    queryCount: validCount,
    requiredFileCount: required.length,
    coveredFileCount: coveredCount,
  };
}

/** 报告阶段（缺 scope 或 scope 无效时仍输出变更上下文缺失行） */
function resultWithScopeReasons(reasons: string[]): CodegraphStrictResult {
  return { passed: false, violations: reasons, queryCount: 0, requiredFileCount: 0, coveredFileCount: 0 };
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  // 统一 --phase 校验（lib/parse-phase.ts，5-8；支持 --phase N 与 --phase=N）
  const hasPhaseFlag = process.argv.includes('--phase') || process.argv.some((a) => a.startsWith('--phase='));
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });

  if (!file || !hasPhaseFlag) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-codegraph-queries.ts <project-root> --phase <5|6|7|8> [--scope=<change-scope.json>]',
      exitCode: 2,
    });
    return;
  }
  if (!existsSync(file) || !statSync(file).isDirectory()) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '项目根路径不存在或不是目录',
      file: path.resolve(file),
      exitCode: 2,
    });
    return;
  }
  if (phaseParsed === undefined) {
    // 复刻原分支语义：空格形态数字越界 → '参数非法 --phase=N'；非数字 / 缺值 / 等号形态 → '参数缺失'
    const phaseIdx = args.indexOf('--phase');
    const phaseRaw = phaseIdx >= 0 ? args[phaseIdx + 1] : undefined;
    if (phaseRaw !== undefined && /^\d+$/.test(phaseRaw)) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --phase=${phaseRaw}`,
        detail: '须为 5-8 的整数',
        exitCode: 2,
      });
      return;
    }
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-codegraph-queries.ts <project-root> --phase <5|6|7|8> [--scope=<change-scope.json>]',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);

  // ==================== ChangeScope 装载（strict 绑定；阶段 5-8 必选） ====================
  const loaded = loadCliScope(process.argv, abs, phase);
  let result: CodegraphStrictResult;
  let scopeLabel = '（未提供）';
  if (loaded.kind === 'missing') {
    result = resultWithScopeReasons(loaded.reasons);
  } else if (loaded.kind === 'violations') {
    result = resultWithScopeReasons(loaded.violations);
  } else {
    scopeLabel = loaded.scopeLabel;
    result = checkCodegraphQueriesStrict(abs, loaded.scope);
  }
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'codegraph-queries',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('codegraph 查询落盘校验（Codegraph Queries Checker，strict 绑定）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更上下文    : ${scopeLabel}`);
  if (result.note) {
    console.log(`注记          : ${result.note}`);
  }
  console.log(`有效查询数    : ${result.queryCount}`);
  console.log(`须覆盖文件数  : ${result.requiredFileCount}`);
  console.log(`已覆盖文件数  : ${result.coveredFileCount}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因（反模式 #38）：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport(
    'CODEGRAPH_QUERIES',
    {
      type: 'codegraph-queries',
      passed: result.passed,
      phase,
      changeId: loaded.kind === 'ok' ? loaded.scope.changeId : undefined,
      queryCount: result.queryCount,
      requiredFileCount: result.requiredFileCount,
      coveredFileCount: result.coveredFileCount,
      violations: result.violations,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
