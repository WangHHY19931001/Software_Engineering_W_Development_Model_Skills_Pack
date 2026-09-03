#!/usr/bin/env tsx
/**
 * OpenSpec 归档完整性校验脚本（Openspec Archive Checker）
 *
 * 对应 SKILL.md「codegraph + OpenSpec 集成」机制：阶段门 V/G 全通过后须执行 opsx:archive 归档变更。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts <project-root> --phase <5|6|7|8> \
 *       --scope=<change-scope.json> [--json]
 *
 * 参数：
 *   project-root   项目根目录
 *   --phase        校验阶段 5|6|7|8（支持 --phase N 与 --phase=N）；archive 为
 *                  opsx:archive 后置门（阶段 8 归档后单独跑，不在 pre-archive artifact gate 内强制）
 *   --scope=FILE   变更上下文 manifest（schemas/change-scope.schema.json）；与
 *                  --change/--base/--head 互斥；阶段 5-8 必选（缺失 → exit 1）。
 *                  strict 模式锚定匹配 archive/ 下 <changeId> 或 <日期>-<changeId> 目录
 *                  （多匹配失败，不再 entries[0] 任取其一）
 *   --change/--base/--head  薄封装：以实际 Git 变更集合生成等价 scope（免维护 manifest）
 *   --json         机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  归档完整
 *   1  未归档或归档不完整
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 OPENSPEC_ARCHIVE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase 5|6|7|8
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { gitRunnerFor, resolveCliScope } from '../lib/change-scope.js';

interface CheckResult {
  passed: boolean;
  violations: string[];
  archivedChange: string | null;
  artifactsFound: string[];
}

const REQUIRED_ARCHIVED_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'tickets.md'] as const;

/** 归档日期前缀：<YYYY-MM-DD>- */
const ARCHIVE_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}-/;

/** 校验归档目录制品齐全（proposal/design/tasks/tickets + specs/） */
function validateArchivedArtifacts(
  archiveDir: string,
  dirName: string,
  violations: string[],
  artifactsFound: string[],
): void {
  const archivedDir = path.join(archiveDir, dirName);
  for (const art of REQUIRED_ARCHIVED_ARTIFACTS) {
    const artPath = path.join(archivedDir, art);
    if (existsSync(artPath)) {
      artifactsFound.push(art);
    } else {
      violations.push(`${dirName}/${art} 缺失（归档不完整）`);
    }
  }
  const specsDir = path.join(archivedDir, 'specs');
  if (existsSync(specsDir)) {
    artifactsFound.push('specs/');
  } else {
    violations.push(`${dirName}/specs/ 目录缺失`);
  }
}

/**
 * 校验 opsx 归档完整性纯逻辑（legacy 兼容层：按 phase<N>- 未锚定前缀取 entries[0]，
 * 可被 self-test import）。CLI 阶段 5-8 一律走 checkOpenspecArchiveStrict。
 */
export function checkOpenspecArchive(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];

  const archiveDir = path.join(projectRoot, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) {
    violations.push(`openspec/changes/archive/ 目录不存在（阶段 ${phase} 须归档 opsx 变更）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  // 找该阶段的归档目录（名称精确前缀匹配 phase<N>-）
  const prefixRegex = new RegExp(`phase${phase}-`);
  const entries = readdirSync(archiveDir, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && prefixRegex.test(e.name),
  );

  if (entries.length === 0) {
    violations.push(`阶段 ${phase}：archive/ 下无含 phase${phase}- 前缀的归档目录（opsx:archive 未执行）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  const archivedChange = entries[0]!.name;
  validateArchivedArtifacts(archiveDir, archivedChange, violations, artifactsFound);

  return {
    passed: violations.length === 0,
    violations,
    archivedChange,
    artifactsFound,
  };
}

/**
 * strict 模式（2026-09-04 audit-gate-closure，Slice A）：锚定匹配 scope.changeId——
 * archive/ 下精确匹配 `<changeId>` 或 `<date>-<changeId>`（date 前缀为锚定 <YYYY-MM-DD>-，
 * 不再用未锚定正则，`<changeId>-extra` 等相似名不匹配）；多匹配 → violations 失败
 * （不允许 entries[0] 任取其一）；changeId 须含阶段前缀 phase<phase>-（phase 归属一致性）。
 * 制品齐全校验逻辑保留。archive 为 opsx:archive 后置门（阶段 8 末），不在
 * pre-archive artifact gate 内强制（见 check-artifact-gate.ts）。
 */
export function checkOpenspecArchiveStrict(projectRoot: string, phase: number, changeId: string): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];

  const archiveDir = path.join(projectRoot, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) {
    violations.push(`openspec/changes/archive/ 目录不存在（阶段 ${phase} 须归档 opsx 变更；changeId=${changeId}）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  // phase 归属一致性：changeId 须含 phase<phase>- 前缀（先于存在性检查，便于定位归属错误）
  if (!changeId.startsWith(`phase${phase}-`)) {
    violations.push(`${changeId} 不含阶段前缀 phase${phase}-，无法确认 phase 归属（scope.changeId 与当前阶段不符）`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 归档目录来自项目受控 openspec/changes/archive/ 目录枚举
  const entries = readdirSync(archiveDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  // 锚定匹配：恰为 <changeId> 或 <date>-<changeId>
  const matches = entries.filter(
    (name) =>
      name === changeId ||
      (name.length > 11 && ARCHIVE_DATE_PREFIX_RE.test(name.slice(0, 11)) && name.slice(11) === changeId),
  );

  if (matches.length === 0) {
    const listing = entries.slice(0, 5).join(', ');
    violations.push(
      `${changeId} 无匹配归档目录（期望 openspec/changes/archive/ 下恰一个 ${changeId} 或 <日期>-${changeId}；` +
        `现有：${listing || '（空）'}；opsx:archive 未执行或 changeId 与归档不符）`,
    );
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }
  if (matches.length > 1) {
    violations.push(
      `${matches.join('、')} 等多个目录匹配 changeId=${changeId}（多匹配失败：archive 下同一 change 只允许一个归档，不允许任取其一）`,
    );
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  const archivedChange = matches[0]!;
  validateArchivedArtifacts(archiveDir, archivedChange, violations, artifactsFound);

  return {
    passed: violations.length === 0,
    violations,
    archivedChange,
    artifactsFound,
  };
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
      detail: '用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>',
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
      detail: '用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);

  // ==================== ChangeScope 装载（strict 锚定归档绑定；阶段 5-8 必选） ====================
  const resolved = resolveCliScope({
    projectRoot: abs,
    phase,
    scopePath: parseFlagValue(process.argv, 'scope'),
    changeArg: parseFlagValue(process.argv, 'change'),
    baseArg: parseFlagValue(process.argv, 'base'),
    headArg: parseFlagValue(process.argv, 'head'),
    git: gitRunnerFor(abs),
  });
  if (resolved.kind === 'invalid') {
    exitWithError({
      category: resolved.category,
      rule: 'P0-1',
      message: resolved.message,
      detail: resolved.detail,
      file: resolved.file,
      exitCode: 2,
    });
    return;
  }
  let result: CheckResult;
  let scopeLabel = '（未提供）';
  if (resolved.kind === 'missing') {
    result = { passed: false, violations: resolved.reasons, archivedChange: null, artifactsFound: [] };
  } else if (resolved.kind === 'violations') {
    result = { passed: false, violations: resolved.violations, archivedChange: null, artifactsFound: [] };
  } else {
    scopeLabel = `${resolved.scope.changeId}（base=${resolved.scope.baseRef}..head=${resolved.scope.headRef}，声明 ${resolved.scope.changedFiles.length} 个变更文件）`;
    result = checkOpenspecArchiveStrict(abs, phase, resolved.scope.changeId);
  }
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'openspec-archive',
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
  console.log('opsx 归档完整性校验（Openspec Archive Checker，strict 锚定绑定）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更上下文    : ${scopeLabel}`);
  console.log(`归档目录      : ${result.archivedChange ?? '（未找到）'}`);
  console.log(`归档制品      : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport(
    'OPENSPEC_ARCHIVE',
    {
      type: 'openspec-archive',
      passed: result.passed,
      phase,
      changeId: resolved.kind === 'ok' ? resolved.scope.changeId : undefined,
      archivedChange: result.archivedChange,
      artifactsFound: result.artifactsFound,
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
