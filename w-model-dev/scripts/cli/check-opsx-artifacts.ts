#!/usr/bin/env tsx
/**
 * OpenSpec opsx 制品与审查产物校验脚本（Opsx Artifacts Checker）
 *
 * 对应反模式 #39（跳过 opsx 产物审查）+ #40（opsx/S-tickets 职责混淆）。
 * 校验每阶段 opsx 变更目录制品齐全（proposal/specs/design/tasks + tickets）
 * + R3×3 + V 审查产物齐全。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-opsx-artifacts.ts <project-root> --phase <5|6|7|8> \
 *       --scope=<change-scope.json> [--json]
 *
 * 参数：
 *   project-root   项目根目录
 *   --phase        校验阶段 5|6|7|8（支持 --phase N 与 --phase=N）
 *   --scope=FILE   变更上下文 manifest（schemas/change-scope.schema.json）；与
 *                  --change/--base/--head 互斥；阶段 5-8 必选（缺失 → exit 1）。
 *                  strict 模式只校验 scope.changeId 对应的一个变更目录——活动位
 *                  openspec/changes/<changeId>/ 优先，活动位缺失时回退归档位
 *                  openspec/changes/archive/<目录名>/（恰一匹配才继续；多匹配 fail-closed），
 *                  不再全扫描 phaseN-* 无 change 选择
 *   --change/--base/--head  薄封装：以实际 Git 变更集合生成等价 scope（免维护 manifest）
 *   --json         机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  制品与审查产物齐全
 *   1  缺失制品或审查（命中 #39/#40）
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 OPSX_ARTIFACTS_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
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
import { hasFlag } from '../lib/parse-args.js';
import { loadCliScope } from '../lib/load-cli-scope.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

interface CheckResult {
  passed: boolean;
  violations: string[];
  changesNames: string[];
  artifactsFound: string[];
  reviewsFound: string[];
}

const REQUIRED_OPSX_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'tickets.md'] as const;
const REQUIRED_R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;
const REQUIRED_STAGES = ['explore', 'propose', 'coding'] as const;

/** active 阶段变更目录候选（phase<N>-*，排除 archive） */
function activeChangeDirs(changesDir: string, phase: number): string[] {
  const prefixRegex = new RegExp(`^phase${phase}-`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- active 变更目录来自项目受控 openspec/changes/ 目录枚举
  return readdirSync(changesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && prefixRegex.test(e.name) && e.name !== 'archive')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 归档位候选目录名（D-7）：活动位缺失时的回退候选，匹配 `<changeId>` 或 `<日期>-<changeId>`
 * （`<changeId>-extra` 等相似名不匹配）。只枚举候选，恰一匹配 / 多匹配 / 零匹配由调用方裁。
 */
function archiveChangeDirs(changesDir: string, changeId: string): string[] {
  const archiveDir = path.join(changesDir, 'archive');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archiveDir 由受控 changesDir（projectRoot/openspec/changes）拼接
  if (!existsSync(archiveDir)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archive 目录来自项目受控 openspec/changes/archive/ 枚举
  return readdirSync(archiveDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (e.name === changeId || e.name.endsWith(`-${changeId}`)))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** 变更目录解析结果（D-7 两态）：活动位 / 归档位回退 / 归档位多匹配 / 均不匹配 */
type ChangeDirResolution =
  | { kind: 'active' }
  | { kind: 'archive'; dirName: string }
  | { kind: 'ambiguous'; matches: string[] }
  | { kind: 'none'; candidates: string[] };

/**
 * 解析 scope.changeId 对应的变更目录位置（D-7）：**活动位优先**——active 候选含 changeId 即用活动位；
 * 活动位缺失时才回退归档位，且**恰一匹配**才可用（多匹配 → 'ambiguous' 由调用方 fail-closed；
 * 零匹配 → 'none' 由调用方保持原早退文案）。
 */
function resolveChangeDirName(changesDir: string, phase: number, changeId: string): ChangeDirResolution {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- changesDir 由受控 projectRoot（openspec/changes）拼接
  if (!existsSync(changesDir)) return { kind: 'none', candidates: [] };
  const candidates = activeChangeDirs(changesDir, phase);
  if (candidates.includes(changeId)) return { kind: 'active' };
  const matches = archiveChangeDirs(changesDir, changeId);
  if (matches.length === 1) return { kind: 'archive', dirName: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  return { kind: 'none', candidates };
}

/** 校验单个变更目录制品齐全（proposal/design/tasks/tickets + specs/，反模式 #40） */
function validateChangeDirArtifacts(
  changesDir: string,
  changeName: string,
  violations: string[],
  artifactsFound: string[],
): void {
  const changeDir = path.join(changesDir, changeName);
  for (const art of REQUIRED_OPSX_ARTIFACTS) {
    const artPath = path.join(changeDir, art);
    if (existsSync(artPath)) {
      artifactsFound.push(`${changeName}/${art}`);
    } else {
      violations.push(`${changeName}/${art} 缺失（反模式 #40：opsx/S-tickets 职责混淆）`);
    }
  }
  const specsDir = path.join(changeDir, 'specs');
  if (!existsSync(specsDir)) {
    violations.push(`${changeName}/specs/ 目录缺失`);
  } else {
    artifactsFound.push(`${changeName}/specs/`);
  }
}

/** 校验 R3×9 + V×3（项目级 stage 审查，反模式 #39） */
function validateStageReviews(projectRoot: string, phase: number, violations: string[], reviewsFound: string[]): void {
  const r3Dir = path.join(projectRoot, '.w-model', 'r3-reviews');
  const vDir = path.join(projectRoot, '.w-model', 'v-reviews');
  for (const stage of REQUIRED_STAGES) {
    for (const dim of REQUIRED_R3_DIMENSIONS) {
      const r3File = path.join(r3Dir, `phase${phase}-${stage}-${dim}.md`);
      if (existsSync(r3File)) {
        reviewsFound.push(`${stage}-${dim}`);
      } else {
        violations.push(`.w-model/r3-reviews/phase${phase}-${stage}-${dim}.md 缺失（反模式 #39：跳过 opsx 产物审查）`);
      }
    }
    const vFile = path.join(vDir, `phase${phase}-${stage}.md`);
    if (existsSync(vFile)) {
      reviewsFound.push(`${stage}-V`);
    } else {
      violations.push(`.w-model/v-reviews/phase${phase}-${stage}.md 缺失（反模式 #39）`);
    }
  }
}

/**
 * 校验 opsx 制品与审查产物纯逻辑（legacy 兼容层，全扫描所有 active 变更目录，
 * 可被 self-test import）。CLI 阶段 5-8 一律走 checkOpsxArtifactsStrict。
 */
export function checkOpsxArtifacts(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];
  const reviewsFound: string[] = [];

  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!existsSync(changesDir)) {
    violations.push(`openspec/changes/ 目录不存在（阶段 ${phase} 须有 opsx 变更）`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }

  // 找该阶段所有变更目录 phase<N>-*（精确前缀匹配，排除 archive）
  const sorted = activeChangeDirs(changesDir, phase);

  if (sorted.length === 0) {
    violations.push(`阶段 ${phase}：openspec/changes/ 下无 phase${phase}-* 变更目录`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }

  const changesNames = sorted;

  for (const entryName of sorted) {
    validateChangeDirArtifacts(changesDir, entryName, violations, artifactsFound);
  }

  // 校验 R3×3 + V 审查产物（反模式 #39）—— 项目级 stage 审查
  validateStageReviews(projectRoot, phase, violations, reviewsFound);

  return {
    passed: violations.length === 0,
    violations,
    changesNames,
    artifactsFound,
    reviewsFound,
  };
}

/**
 * strict 模式（2026-09-04 audit-gate-closure，Slice A）：给定 changeId 时只校验
 * scope.changeId 对应的这一个变更目录（不再全扫描 phaseN-* 无 change 选择）；
 * 活动位优先，活动位缺失时回退归档位（D-7：`openspec/changes/archive/<目录名>/`，
 * 恰一匹配才继续、多匹配 fail-closed），使本 pre-archive 聚合门与 archive 后置门
 * （`check-openspec-archive.ts`）在归档态可同时通过；
 * 活动位与归档位皆无匹配（单候选或多候选）→ violations 失败而非任意取一/跳换；
 * changeId 须含阶段前缀 phase<phase>-（phase 归属一致性）。制品/R3×9/V×3 校验逻辑保留。
 */
export function checkOpsxArtifactsStrict(projectRoot: string, phase: number, changeId: string): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];
  const reviewsFound: string[] = [];

  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!existsSync(changesDir)) {
    violations.push(`openspec/changes/ 目录不存在（阶段 ${phase} 须有 opsx 变更）`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }

  // phase 归属一致性：changeId 须含 phase<phase>- 前缀（先于候选存在性检查，便于定位归属错误）
  if (!changeId.startsWith(`phase${phase}-`)) {
    violations.push(`${changeId} 不含阶段前缀 phase${phase}-（scope.changeId 与当前阶段不符）`);
  }

  const resolution = resolveChangeDirName(changesDir, phase, changeId);
  // 传给 validateChangeDirArtifacts 的「相对 changesDir 的名字」：活动位为 changeId，归档位为 archive/<目录名>
  let changeName = changeId;
  if (resolution.kind === 'none') {
    // 原两条早退文案保持（归档位零匹配不新增含糊文案）：空候选 / 不在 active 候选内
    violations.push(
      resolution.candidates.length === 0
        ? `阶段 ${phase}：openspec/changes/ 下无 phase${phase}-* 变更目录`
        : `${changeId} 不在阶段 ${phase} active 变更目录中（候选：${resolution.candidates.join(', ')}；` +
            `scope.changeId 须与 opsx 变更目录名精确一致，不允许任取其一或跳换）`,
    );
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }
  if (resolution.kind === 'ambiguous') {
    violations.push(
      `${changeId} 归档位多匹配（${resolution.matches.length}）：${resolution.matches.join(', ')} —— fail-closed`,
    );
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }
  if (resolution.kind === 'archive') {
    changeName = path.join('archive', resolution.dirName);
  }

  // changesNames 语义不变：恒为 scope.changeId（归档位不泄漏进返回结构，check-artifact-gate.ts 消费该字段）
  const changesNames = [changeId];
  // 只校验 scope 对应这一个变更目录（已归档态下按归档位同契约校验，不放宽任何校验项）
  validateChangeDirArtifacts(changesDir, changeName, violations, artifactsFound);
  validateStageReviews(projectRoot, phase, violations, reviewsFound);

  return {
    passed: violations.length === 0,
    violations,
    changesNames,
    artifactsFound,
    reviewsFound,
  };
}

/**
 * 归档回退生效时的可读位置标签（D-7）：活动位缺失且归档位恰一匹配 → `archive/<目录名>`，
 * 否则 undefined。仅供 CLI 人类可读 stdout 提示（返回结构字段语义不变）。
 */
function archivedFallbackLabel(projectRoot: string, phase: number, changeId: string): string | undefined {
  const resolution = resolveChangeDirName(path.join(projectRoot, 'openspec', 'changes'), phase, changeId);
  return resolution.kind === 'archive' ? `archive/${resolution.dirName}` : undefined;
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
      detail: '用法: npx tsx check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>',
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
      detail: '用法: npx tsx check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);

  // ==================== ChangeScope 装载（strict changeId 绑定；阶段 5-8 必选） ====================
  const loaded = loadCliScope(process.argv, abs, phase);
  let result: CheckResult;
  let scopeLabel = '（未提供）';
  if (loaded.kind === 'missing') {
    result = { passed: false, violations: loaded.reasons, changesNames: [], artifactsFound: [], reviewsFound: [] };
  } else if (loaded.kind === 'violations') {
    result = { passed: false, violations: loaded.violations, changesNames: [], artifactsFound: [], reviewsFound: [] };
  } else {
    scopeLabel = loaded.scopeLabel;
    result = checkOpsxArtifactsStrict(abs, phase, loaded.scope.changeId);
  }
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'opsx-artifacts',
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

  // 归档位回退提示（D-7）：人类可读段标出本次校验的是归档位（--json 单行契约不受影响）
  const archivedFallback = loaded.kind === 'ok' ? archivedFallbackLabel(abs, phase, loaded.scope.changeId) : undefined;

  console.log('═'.repeat(60));
  console.log('opsx 制品与审查产物校验（Opsx Artifacts Checker，strict changeId 绑定）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更上下文    : ${scopeLabel}`);
  console.log(`变更目录      : ${result.changesNames.join(', ') || '（未找到）'}`);
  if (archivedFallback !== undefined) {
    console.log(`变更目录位置  : ${archivedFallback}（活动位缺失，按归档位同契约校验）`);
  }
  console.log(`制品          : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`审查产物      : ${result.reviewsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport(
    'OPSX_ARTIFACTS',
    {
      type: 'opsx-artifacts',
      passed: result.passed,
      phase,
      changeId: loaded.kind === 'ok' ? loaded.scope.changeId : undefined,
      changesNames: result.changesNames,
      artifactsFound: result.artifactsFound,
      reviewsFound: result.reviewsFound,
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
