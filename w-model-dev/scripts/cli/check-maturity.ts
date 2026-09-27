#!/usr/bin/env tsx
/**
 * 成熟度校验脚本（Maturity Checker）
 *
 * 对应 w-model-dev/references/data-models.md MaturityConfig schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.3。
 * 供 O 子代理在阶段推进前调用，校验成熟度模型 schema 完整性、level 合法性、
 * 成功阶段更新一致性、history 时序、降级触发状态。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-maturity.ts <maturity.json> [--project=<project.json>] [--run-log=<run-log.jsonl>]
 *
 * 参数：
 *   maturity.json        maturity.json 文件路径
 *   --project=<path>     project.json 路径（可选，R3/R4 交叉校验；读取侧经 project.schema.json 校验，缺失/非法/不符 schema → exit 2）
 *   --run-log=<path>     run-log.jsonl 路径（可选，R5 真值通道：只统计每条记录的 operationalFailureModes 字段；
 *                        读取路径过滤非 O1~O6 取值（计数为 0 并出非阻断诊断——schema 应拒绝，此处为读取路径防御）；
 *                        note 中的 O1..O6 字样视为引用，仅作非阻断诊断。未提供时输出「R5 未生效」非阻断诊断）
 *   --json               机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse，含 warnings 非阻断警告字段与 diagnostics 非阻断诊断字段）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过（含仅有非阻断 warning / 非阻断 diagnostic 的情形）
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / schema 不符 / 参数非法；含 --project 读取侧 schema 校验失败）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 非阻断诊断 + 收尾 MATURITY_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--project=、--run-log=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { checkMaturity, type MaturityConfig } from '../logic/maturity-logic.js';
import { readJsonOrExit, readJsonlOptional } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { loadAndValidate, LOAD_AND_VALIDATE_SENTINEL_PREFIX } from '../lib/load-and-validate.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  maturityFile: string | undefined;
  projectFile: string | undefined;
  runLogFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const maturityFile = args.find((a) => !a.startsWith('--'));
  const projectFile = parseFlagValue(args, 'project');
  const runLogFile = parseFlagValue(args, 'run-log');
  return { maturityFile, projectFile, runLogFile };
}

// ==================== project.status → completedPhases 映射 ====================

// status 枚举对应「已推进到的阶段序号」；项目完成视作 8 阶段全部完成
const STATUS_TO_PHASES: Record<string, number> = {
  需求分析: 1,
  系统设计: 2,
  概要设计: 3,
  详细设计: 4,
  编码: 5,
  集成测试: 6,
  系统测试: 7,
  验收测试: 8,
  项目完成: 8,
};

// ==================== run-log O 系列失败模式统计（R5，D-7） ====================

// 词法命中的降级诊断正则（\b 词边界防 O100 误命中）。**不参与 R5 判定**：
// O1~O6 同时是评审规则编号（如 O3 = Verifier Theater 也是 V 门禁 evidence 扣分规则名），
// 扫 note 会把引用误计为运维失败（实测 demo run-log 17 处全为引用）。
const O_PATTERN = /\bO[1-6]\b/g;

/** 词法命中记录缺 runId 时的占位符（保留「命中位置」语义，不丢事实） */
const MISSING_RUN_ID = '<无 runId>';

/**
 * O 系列失败模式的合法取值（O1~O6，与 run-log.schema.json 的 operationalFailureModes.items.enum 同源）。
 *
 * 读取路径守卫（G3-18）：schema 只管**写入侧**，读取侧（本 CLI 直读 run-log.jsonl，无 schema 前置校验）
 * 遇到越界取值（`'O9'`、拼写错误、非字符串）时若照单累加，会把不存在于 SSoT §4A.2a 的编号计入 R5 判定。
 * 注意语义边界：**uniqueItems 与「存在即累加数组长度」口径不变**（不去重计数，`['O3','O3']` 仍计 2），
 * 本守卫只过滤非 O1~O6 取值并出非阻断诊断。
 */
const OPERATIONAL_FAILURE_VALUES = new Set(['O1', 'O2', 'O3', 'O4', 'O5', 'O6']);

/** operationalFailureModes 读取路径统计（G3-18）：合法取值计数 + 被过滤的非枚举值计数 */
export interface OperationalFailureSummary {
  /** 合法 O1~O6 取值数（R5 判定的输入；同 sumTokens 的「越界值剔除」思路，不让噪声进判定） */
  count: number;
  /** 非 O1~O6 / 非字符串取值数（>0 时经诊断通道可见化；schema 本应拒绝，此处为读取路径防御） */
  ignoredCount: number;
}

/**
 * R5 真值通道（D-7）：统计 run-log 中 `operationalFailureModes` 字段的标注条目数。
 *
 * 口径：只读该字段，存在即累加数组长度（枚举合法性由 run-log.schema.json 强制；非数组形态按未标注处理，
 * 不按字符数误计）。note 中的 O1..O6 字样一律不计入。G3-18：读取路径再过滤一次非 O1~O6 取值
 * （越界取值不计入 count，改记入 ignoredCount，由调用方转成非阻断诊断）。
 */
export function summarizeOperationalFailures(entries: unknown[]): OperationalFailureSummary {
  let count = 0;
  let ignoredCount = 0;
  for (const entry of entries) {
    const e = entry as { operationalFailureModes?: unknown };
    if (!Array.isArray(e.operationalFailureModes)) continue;
    for (const value of e.operationalFailureModes) {
      if (typeof value === 'string' && OPERATIONAL_FAILURE_VALUES.has(value)) count++;
      else ignoredCount++;
    }
  }
  return { count, ignoredCount };
}

/**
 * R5 真值通道计数（既有导出签名，向后兼容）：= `summarizeOperationalFailures(...).count`
 * （合法 O1~O6 取值数；越界取值由 `summarizeOperationalFailures` 另行计为 ignoredCount）。
 */
export function countOperationalFailures(entries: unknown[]): number {
  return summarizeOperationalFailures(entries).count;
}

/**
 * 词法降级（D-7）：按命中次数收集 note 中 O1~O6 字样的所在 runId（可重复；缺 runId 记占位符）。
 *
 * 只服务非阻断诊断「疑似引用 N 处」（N = 返回数组长度，去重后的 runId 列表进文案），
 * **不参与 R5 判定**——收紧词表会让 R5 形同虚设，故保留扫描并把结论降级为可见诊断。
 */
export function collectLexicalMentions(entries: unknown[]): string[] {
  const mentions: string[] = [];
  for (const entry of entries) {
    const e = entry as { note?: unknown; runId?: unknown };
    if (typeof e.note !== 'string') continue;
    const matches = e.note.match(O_PATTERN);
    if (matches === null) continue;
    const runId = typeof e.runId === 'string' && e.runId !== '' ? e.runId : MISSING_RUN_ID;
    mentions.push(...new Array<string>(matches.length).fill(runId));
  }
  return mentions;
}

/**
 * 组装 R5 非阻断诊断（CLI 与 self-test 共用，避免文案双写）：
 *   1. 未提供 --run-log → 「R5 未生效：未提供 --run-log（O 系列失败模式未校验）」——堵隐性规避通道
 *      （省略 --run-log 不再等于静默跳过），退出码语义不变（仍 exit 0）。
 *   2. 词法命中非空 → 「疑似引用 N 处（含规则编号引用，非运维失败）…」——指引确为运维失败时改用
 *      `operationalFailureModes` 机器可读标注。
 *   3. 读取路径过滤命中（G3-18，第三参缺省 0 = 零行为变化）→ 「N 项非 O1~O6 取值已忽略（schema 应拒绝；
 *      读取路径防御）」——越界取值既不进 R5 计数也不静默消失。
 */
export function buildR5Diagnostics(
  runLogProvided: boolean,
  lexicalMentionRunIds: readonly string[],
  ignoredOperationalModeCount = 0,
): string[] {
  const diagnostics: string[] = [];
  if (!runLogProvided) {
    diagnostics.push('R5 未生效：未提供 --run-log（O 系列失败模式未校验）');
  }
  if (lexicalMentionRunIds.length > 0) {
    const runIds = [...new Set(lexicalMentionRunIds)].join(', ');
    diagnostics.push(
      `疑似引用 ${lexicalMentionRunIds.length} 处（含规则编号引用，非运维失败）；若确为运维失败请在记录中以 operationalFailureModes 标注：${runIds}`,
    );
  }
  if (ignoredOperationalModeCount > 0) {
    diagnostics.push(`${ignoredOperationalModeCount} 项非 O1~O6 取值已忽略（schema 应拒绝；读取路径防御）`);
  }
  return diagnostics;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const { maturityFile, projectFile, runLogFile } = parseArgs(process.argv);

  if (!maturityFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <maturity.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-maturity.ts <maturity.json> [--project=<project.json>] [--run-log=<run-log.jsonl>]',
      exitCode: 2,
    });
    return;
  }

  const maturityAbs = path.resolve(maturityFile);

  // 读 maturity.json（ENOENT / 非法 JSON → exit(2)）
  const parsed = await readJsonOrExit(maturityFile);

  const maturity = parsed as Partial<MaturityConfig>;

  // 可选输入：--project（F-G4-14：读取侧经 project.schema.json 校验，fail-closed）——
  // 文件缺失/非法 JSON/schema 不符（含缺 status/createdAt 等必填字段）→ STRUCTURE_INVALID exit 2，
  // 不再 warn-and-skip；schema 校验后 status 必为 9 态枚举（均在 STATUS_TO_PHASES 内）、createdAt 必为
  // date-time 字符串，「status 非法/缺失」与「未含 createdAt」warn 分支不可达
  let completedPhases: number | undefined;
  let projectCreatedAt: string | undefined;
  if (projectFile) {
    const projectAbs = path.resolve(projectFile);
    try {
      const project = await loadAndValidate<{ status: string; createdAt: string }>(projectAbs, 'project');
      completedPhases = STATUS_TO_PHASES[project.status];
      projectCreatedAt = project.createdAt;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(LOAD_AND_VALIDATE_SENTINEL_PREFIX)) return;
      throw err;
    }
  }

  // 可选输入：--run-log（读失败只警告不 exit；ENOENT→[] 降级复用 readJsonlOptional）
  let operationalFailureCount: number | undefined;
  const r5Diagnostics: string[] = [];
  if (runLogFile) {
    const runLogAbs = path.resolve(runLogFile);
    try {
      // ENOENT 预探测：readJsonlOptional 对缺失文件静默返回 []，此处补回原「文件读取失败」warning（降级语义不变）
      try {
        await fs.access(runLogAbs);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        console.error(`⚠ --run-log 文件读取失败，跳过 R5 降级触发检测: ${runLogAbs}（ENOENT）`);
      }
      const entries = await readJsonlOptional(runLogAbs, 'run-log');
      // R5 真值通道（D-7）：只统计 operationalFailureModes 字段；note 词法命中降级为诊断；
      // 读取路径再过滤非 O1~O6 取值（G3-18）并经诊断通道可见化（非阻断）
      const failureSummary = summarizeOperationalFailures(entries);
      operationalFailureCount = failureSummary.count;
      r5Diagnostics.push(...buildR5Diagnostics(true, collectLexicalMentions(entries), failureSummary.ignoredCount));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --run-log 文件读取失败，跳过 R5 降级触发检测: ${runLogAbs}（${e.code ?? e.message}）`);
    }
  } else {
    // 未接线可见化（D-7）：省略 --run-log 不再静默跳过 R5，以非阻断诊断显式登记（exit 0 语义不变）
    r5Diagnostics.push(...buildR5Diagnostics(false, []));
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkMaturity(parsed, {
    completedPhases,
    projectCreatedAt,
    operationalFailureCount,
    diagnostics: r5Diagnostics,
  });
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置；warnings 透传（F-G2-04 可见性）
  // diagnostics 仅在非空时出现（与 check-checkpoint.ts 同族口径；D-7 契约变化已登记）
  if (jsonMode) {
    printJsonReport(
      {
        type: 'maturity',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        warnings: result.warnings,
        ...(result.diagnostics.length > 0 ? { diagnostics: result.diagnostics } : {}),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('成熟度校验（Maturity Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${maturityAbs}`);
  console.log(`projectId     : ${maturity.projectId ?? '未设置'}`);
  console.log(`schemaVersion : ${maturity.schemaVersion ?? '未设置'}`);
  console.log(`level         : ${maturity.level ?? '未设置'}`);
  console.log(
    `--project     : ${projectFile ? (completedPhases !== undefined ? `已读取（status→completedPhases=${completedPhases}, createdAt=${projectCreatedAt ?? 'N/A'}）` : '已读取（status 无对应阶段映射）') : '未提供'}`,
  );
  console.log(
    `--run-log     : ${runLogFile ? `${runLogFile}（O 系列标注=${operationalFailureCount ?? 'N/A'}）` : '未提供'}`,
  );
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log(
      '成熟度模型符合 data-models.md MaturityConfig schema：完整 + level 合法 + 阶段更新一致 + history 时序 + 降级未触发。',
    );
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log(
      'O 子代理须按上述原因处置（补全 schema / 修正 level / 更新 completedCycles / 修正 history 时序 / 响应降级触发），详见：',
    );
    console.log('  w-model-dev/references/data-models.md §自主成熟度模型');
  }

  // 非阻断诊断（D-7：R5 未接线 / note 词法疑似引用）：不影响 exit code，但须可见
  // （通过与否都打印——exit 0 时正是「为何未触发 R5」需要被解释的场景）
  if (result.diagnostics.length > 0) {
    console.log('非阻断诊断：');
    for (const d of result.diagnostics) {
      console.log(`  - ${d}`);
    }
  }

  // 非阻断警告（如 R3 未校验：未提供 --project）：不影响 exit code，但须可见
  for (const w of result.warnings) {
    console.error(`⚠ ${w}`);
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  // diagnostics 仅在非空时出现（与 check-checkpoint.ts 同族口径）
  printGateReport(
    'MATURITY',
    {
      type: 'maturity',
      passed: result.passed,
      violations: result.violations,
      warnings: result.warnings,
      ...(result.diagnostics.length > 0 ? { diagnostics: result.diagnostics } : {}),
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// 入口守卫（lib/is-main.ts）：仅直接执行时运行 main，被 __tests__ / self-test 等 import 时不触发
// （countOperationalFailures / summarizeOperationalFailures / collectLexicalMentions / buildR5Diagnostics 是本模块的导出函数）
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
