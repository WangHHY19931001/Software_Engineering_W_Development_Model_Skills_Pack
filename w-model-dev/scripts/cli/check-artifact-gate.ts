#!/usr/bin/env tsx
/**
 * 工件质量门校验脚本（Artifact Gate Checker，SSoT §10.5）
 *
 * 供 G 子代理在阶段 1-8 收敛循环中调用，校验各阶段工件（需求 / 设计 / UAT 映射等）
 * 的齐全性与质量门槛；（资产读取已拆分至 application/artifact-gate-assets.ts / application/uat-path-mapping.ts），
 * 本文件仅保留编排。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] [--phase=N] [--cucumber-report=<path>] [--tickets=<path>] [--scope=<change-scope.json>] [--json]
 *   npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts --validate-templates [--json]
 *
 * 参数：
 *   project-dir   项目根目录（默认：当前工作目录）
 *   --phase=N     校验阶段 1-8（默认终检 phase=8，向后兼容；兼容历史短参数 -p）
 *   --tickets=<path>  S18 票据内容校验（`tickets.md`）：六条黑名单 + Buildability 判据（一律符号级，
 *                 不要求文件路径或内联代码块），违反并入 reasons / exit 1，计数进
 *                 `GATE_JSON.tickets:{checked,criticalMissing,buildabilityMissing}`。
 *                 **缺省不触发**（既有调用方零影响）；仅适用 `--phase=5..8`
 *                 （`--phase<5` 给定 → exit 2 ARG_INVALID，不静默忽略）；文件不存在 → exit 2
 *                 FILE_NOT_FOUND；只接受等号形态，路径相对 project-dir 解析
 *   --scope=FILE  阶段 5-8 变更上下文 manifest（schemas/change-scope.schema.json；与
 *                 --change/--base/--head 互斥）：聚合 codegraph/opsx strict 校验，
 *                 violations 并入 reasons/exitCode（不被 RTM 通过掩盖）；
 *                 缺失 → fail-closed（exit 1）；文件/JSON/schema 非法 → exit 2。
 *                 archive（check-openspec-archive.ts）是 phase 8 opsx:archive 后置门，
 *                 不在本 pre-archive gate 内强制
 *   --json        机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *   --validate-templates  模板漂移校验（C9）：按 PHASE_SPEC_LAYOUT 校验技能包 templates/ 资产
 *                         含必需结构标记（引用块 / §0 SSOT 头 / DoD 清单 ≥8 项）。
 *                         校验对象是技能包自身资产（相对脚本定位 ../../templates），与 project-dir 无关；
 *                         与常规门禁互斥，命中即走独立分支，不读 RTM。
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（reasons 列出具体原因）
 *   2  输入错误（参数非法 / 文件不存在 / JSON 解析失败，stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 GATE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase=N（1-8，默认 8）
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTlaBddSyncPairs,
  discoverGraphAsset,
  readBddManifest,
  readCucumberReport,
  readTlaManifest,
  runModelChecks,
  isProjectCucumberEvidencePhase,
  isProjectTlaBddEvidencePhase,
  isTlaBddSyncContractPhase,
  type TlaBddSyncPair,
} from '../application/artifact-gate-assets.js';
import { checkUatPathMappingContent, collectUatMappingViolations } from '../application/uat-path-mapping.js';
import {
  checkArtifactGate,
  checkTemplatesStructure,
  type PhaseOption,
  type RTMMatrixShape,
} from '../logic/gate-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { ARTIFACT_PATHS } from '../lib/constants.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg as parsePhaseArgLib } from '../lib/parse-phase.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { readJsonClassified } from '../lib/read-json-or-exit.js';
import { SafeProjectPathError, resolveProjectRelativeRegularFile } from '../lib/safe-project-path.js';
import { type ChangeScope } from '../lib/change-scope.js';
import { loadCliScope } from '../lib/load-cli-scope.js';

import { checkCodegraphQueriesStrict } from './check-codegraph-queries.js';
import { checkOpsxArtifactsStrict } from './check-opsx-artifacts.js';
export { checkUatPathMappingContent }; // self-test 兼容：UAT 映射内容校验保持从本入口导出

// ==================== --phase 参数解析（P1.1） ====================
/**
 * 解析 --phase=N 或 --phase N 参数（lib/parse-phase.ts 统一校验，范围 1-8），
 * 兼容历史短参数 -p。
 * 返回 undefined 表示未传（默认终检 phase=8，向后兼容）。
 * 非法值（非 1-8）退出码 2（保留原 ARG_INVALID 消息）。
 */
function parsePhaseArg(argv: string[]): PhaseOption | undefined {
  // 严格整数校验——字符串全数字 + Number.isInteger，
  // 拒绝 "5abc" / "3.7" 这类 parseInt 会部分解析的非法输入
  const strictPhase = (s: string): PhaseOption | undefined => {
    if (!/^\d+$/.test(s)) return undefined;
    const val = Number(s);
    if (!Number.isInteger(val) || val < 1 || val > 8) return undefined;
    return val as PhaseOption;
  };
  // lib 统一解析（--phase=N / --phase N）
  const res = parsePhaseArgLib(argv, { min: 1, max: 8 });
  if (res !== undefined) return res.phase as PhaseOption;
  // 兼容历史短参数 -p（lib 不识别；值合法即采用，非法报错）
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-p') {
      const next = argv[i + 1] ?? '';
      const val = strictPhase(next);
      if (val === undefined) {
        exitWithError({
          category: 'ARG_INVALID',
          rule: 'P0-1',
          message: `参数非法 --phase=${next}`,
          detail: '须为 1-8 的整数',
          exitCode: 2,
        });
      }
      return val;
    }
  }
  // 显式传了 --phase 但非法（lib 返回 undefined）→ 保留原 ARG_INVALID 报错。
  // --phase=<value> 值提取用 parseFlagValue；--phase <value> 空格式用 includes 检测
  const eqPhase = parseFlagValue(argv, 'phase');
  const spaceIdx = argv.indexOf('--phase');
  if ((eqPhase !== undefined && eqPhase !== '') || spaceIdx !== -1) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `参数非法 --phase=${eqPhase ?? argv[spaceIdx + 1] ?? ''}`,
      detail: '须为 1-8 的整数',
      exitCode: 2,
    });
    return undefined;
  }
  return undefined;
}

/**
 * 解析位置参数：第一个不以 -- 开头的参数为 project-dir。
 * 兼容 --phase=N 出现在任意位置的场景。
 */
function parseProjectDir(argv: string[]): string {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith('--')) {
      // 跳过 --phase N 形式的值
      if ((arg === '--phase' || arg === '-p') && i + 1 < argv.length) {
        i++;
      }
      continue;
    }
    return arg;
  }
  return process.cwd();
}

// ==================== 外部校验聚合（Slice B：codegraph/opsx violations 并入 artifact gate） ====================

/** GATE_JSON external summary 的单个 checker 计数（含相对路径计数；字段稳定，始终输出） */
export interface ExternalCheckerSummary {
  passed: boolean;
  /** violations 计数 */
  violationCount: number;
  /** scope 是否已提供（false = 未提供 scope，fail-closed 且计数归零；true 含提供后被 Git 绑定拒绝） */
  provided: boolean;
  /** scope.changeId；未提供 scope 时为 null；scopeProvidedButFailed 时为尝试绑定的 change（不用空串占位，便于机器判定） */
  changeId: string | null;
}

export interface ExternalCodegraphSummary extends ExternalCheckerSummary {
  /** scope 变更中须覆盖的 code/test 文件数（相对路径计数） */
  requiredFileCount: number;
  /** 已被查询覆盖的 code/test 文件数 */
  coveredFileCount: number;
}

export interface ExternalSummary {
  codegraph: ExternalCodegraphSummary;
  opsx: ExternalCheckerSummary & { changesNames: string[] };
}

export interface ExternalChecksAggregate {
  passed: boolean;
  reasons: string[];
  summary: ExternalSummary;
}

/**
 * 聚合 codegraph + opsx strict 校验（阶段 5-8 artifact gate 用）：
 *   - scope 为 null（CLI 未提供）→ 两 checker 各自 fail-closed（须提供变更上下文）；
 *     若 scopeProvidedButFailed=true（scope 已提供但 Git 绑定失败），则不输出
 *     "未提供 --scope" 误导文案（真实原因在 scopeViolations，纠正动作是更新过期 scope）
 *   - scopeViolations（ChangeScope Git 绑定失败等）并入 reasons
 *   - 两 checker violations 并入 reasons（codegraph/opsx 失败不得被 RTM 通过掩盖）
 * openspecArchived 不作为本 gate 输入：archive 是 phase 8 opsx:archive 后置门，
 * 单独跑 check-openspec-archive.ts。
 */
export function aggregateExternalChecks(
  projectRoot: string,
  phase: number,
  ctx: {
    scope: ChangeScope | null;
    scopeViolations: string[];
    scopeProvidedButFailed?: boolean;
    /** 尝试绑定的 changeId（scopeProvidedButFailed 时由调用方传入；未提供 scope 场景不用） */
    attemptedChangeId?: string | null;
  },
): ExternalChecksAggregate {
  const reasons: string[] = [...ctx.scopeViolations.map((v) => `[scope] ${v}`)];

  if (ctx.scope === null) {
    const boundProvided = ctx.scopeProvidedButFailed === true;
    const summary: ExternalSummary = {
      codegraph: {
        passed: false,
        violationCount: 0,
        provided: boundProvided,
        changeId: boundProvided ? (ctx.attemptedChangeId ?? null) : null,
        requiredFileCount: 0,
        coveredFileCount: 0,
      },
      opsx: {
        passed: false,
        violationCount: 0,
        provided: boundProvided,
        changeId: boundProvided ? (ctx.attemptedChangeId ?? null) : null,
        changesNames: [],
      },
    };
    if (ctx.scopeProvidedButFailed !== true) {
      reasons.push(
        `[codegraph] 阶段 ${phase}：未提供 --scope=<change-scope.json> 或 --change/--base/--head 变更上下文` +
          `（codegraph 覆盖绑定 fail-closed，反模式 #38）`,
      );
      reasons.push(
        `[opsx] 阶段 ${phase}：未提供 --scope=<change-scope.json> 或 --change/--base/--head 变更上下文` +
          `（opsx 制品校验须绑定变更目录，反模式 #39/#40）`,
      );
    }
    return { passed: false, reasons, summary };
  }

  const codegraph = checkCodegraphQueriesStrict(projectRoot, ctx.scope);
  const opsx = checkOpsxArtifactsStrict(projectRoot, ctx.scope.phase, ctx.scope.changeId);
  for (const v of codegraph.violations) reasons.push(`[codegraph] ${v}`);
  for (const v of opsx.violations) reasons.push(`[opsx] ${v}`);
  return {
    passed: reasons.length === 0,
    reasons,
    summary: {
      codegraph: {
        passed: codegraph.passed,
        violationCount: codegraph.violations.length,
        provided: true,
        changeId: ctx.scope.changeId,
        requiredFileCount: codegraph.requiredFileCount,
        coveredFileCount: codegraph.coveredFileCount,
      },
      opsx: {
        passed: opsx.passed,
        violationCount: opsx.violations.length,
        provided: true,
        changeId: ctx.scope.changeId,
        changesNames: opsx.changesNames,
      },
    },
  };
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();

  // ==================== --validate-templates 模式（C9 模板漂移校验） ====================
  // 校验对象是技能包自身 templates/ 资产（相对脚本定位 ../../templates），与 project-dir 无关；
  // 独立分支：不读 RTM、不受 --phase 影响，violations 非空 → exit 1。
  if (hasFlag(process.argv.slice(2), 'validate-templates')) {
    const templatesDir = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'templates');
    const violations = checkTemplatesStructure(templatesDir, {
      existsSync: (p) => nodeFs.existsSync(p),
      readFileSync: (p) => nodeFs.readFileSync(p, 'utf-8'),
    });
    const tplPassed = violations.length === 0;
    const tplExit = tplPassed ? 0 : 1;
    if (jsonMode) {
      printJsonReport(
        {
          type: 'templates',
          passed: tplPassed,
          reasons: violations,
          violations: buildViolationDistribution(violations.length),
          durationMs: Date.now() - startTime,
        },
        tplExit,
      );
      process.exitCode = tplExit;
      return;
    }
    console.log('═'.repeat(60));
    console.log('模板漂移校验（Templates Structure Gate，C9）');
    console.log('═'.repeat(60));
    console.log(`templates 目录: ${templatesDir}`);
    console.log(`校验结果      : ${tplPassed ? '✓ 通过' : '✗ 未通过'}`);
    console.log('─'.repeat(60));
    if (!tplPassed) {
      console.log('未通过原因：');
      for (const v of violations) console.log(`  - ${v}`);
    }
    printGateReport('GATE', { type: 'templates', passed: tplPassed, reasons: violations }, tplExit);
    process.exitCode = tplExit;
    return;
  }

  const phaseOption = parsePhaseArg(process.argv);
  if (process.exitCode !== undefined) return; // --phase 非法已由 exitWithError 报告（ARG_INVALID），终止主流程
  // --spec-dir=<dir>（phase=1 需求规格独立产物目录，含 requirement-spec.md + 6 独立文件）
  // 全量 argv 扫描（与 parsePhaseArg 一致），避免 --spec-dir 出现在任意位置被静默忽略（false-pass 方向）
  const specDir = parseFlagValue(process.argv, 'spec-dir');

  // ==================== --tickets=<path> 参数契约（S18，计划 §0.1.4） ====================
  // 1) 缺省不触发（既有调用方零影响）；2) 空格形态 / 空值非静默忽略而是 ARG_INVALID
  //    （本 CLI 的值 flag 一律等号形态，与 --scope 同口径）；3) --phase<5 给定 → ARG_INVALID，
  //    不在低阶段静默跳过参数。
  const ticketsArg = parseFlagValue(process.argv, 'tickets');
  if (hasFlag(process.argv, 'tickets') || ticketsArg === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'S18',
      message: '参数非法 --tickets',
      detail: '仅接受等号形态且值非空：--tickets=<path>（空格形态不解析，避免被静默忽略）',
      exitCode: 2,
    });
    return;
  }
  if (ticketsArg !== undefined && (phaseOption ?? 8) < 5) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'S18',
      message: '参数非法 --tickets',
      detail: `票据内容校验仅适用于阶段 5-8（收到 --phase=${phaseOption ?? 8}）；低阶段票据尚未进入阶段 5 编码，不得静默忽略`,
      exitCode: 2,
    });
    return;
  }

  const projectDir = parseProjectDir(process.argv);
  const cucumberReportArg = parseFlagValue(process.argv, 'cucumber-report');
  const cucumberReportFile = path.resolve(
    projectDir,
    cucumberReportArg ?? path.join('.w-model', 'bdd', 'reports', 'report.json'),
  );
  const rtmFile = path.resolve(projectDir, ARTIFACT_PATHS.rtm);

  // S18 票据文本读取（--tickets 缺省时 ticketsFile/ticketsText 均为 undefined → 不触发校验）。
  // 文件不存在 → exit 2 FILE_NOT_FOUND；其它读取失败（目录 / 权限等）→ exit 2 FILE_READ。
  let ticketsFile: string | undefined;
  let ticketsText: string | undefined;
  if (ticketsArg !== undefined) {
    try {
      ticketsFile = resolveProjectRelativeRegularFile(projectDir, ticketsArg);
    } catch (error) {
      const detail = error instanceof SafeProjectPathError ? error.reason : '路径不可解析';
      exitWithError({
        category: detail === 'missing' ? 'FILE_NOT_FOUND' : 'ARG_INVALID',
        rule: 'S18',
        message: detail === 'missing' ? '票据文件不可读（--tickets）' : '参数非法 --tickets',
        detail: detail === 'missing' ? 'ENOENT' : `仅接受项目内普通文件路径（${detail}）`,
        exitCode: 2,
      });
      return;
    }
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- ticketsFile 由安全项目相对路径 helper 验证为普通文件后得到，仅只读
      ticketsText = nodeFs.readFileSync(ticketsFile, 'utf-8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      exitWithError({
        category: code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
        rule: 'S18',
        message: '票据文件不可读（--tickets）',
        file: ticketsFile,
        detail: code ?? (err as Error).message,
        exitCode: 2,
      });
      return;
    }
  }

  // RTM 读取（FILE_NOT_FOUND / FILE_READ / FILE_PARSE 统一走 readJsonClassified，哨兵由 runMain 兜底）
  // ENOENT 预探测：readJsonClassified 对缺失文件只报通用「文件不存在」，此处补回原「请先执行 /wm」引导语（非 ENOENT 交回统一分类）
  try {
    nodeFs.accessSync(rtmFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在（请先执行 /wm 走完 W 模型阶段再校验）',
        exitCode: 2,
        file: rtmFile,
      });
      return;
    }
  }
  const matrix = await readJsonClassified<RTMMatrixShape>(rtmFile);

  // ==================== TLA+ 资产读取（spec §3.4.4） ====================
  // P2.6 graph 资产自动发现：按优先级查找 .w-model/ingestion/ 下的 graph 资产
  const ingestionDir = path.resolve(projectDir, '.w-model', 'ingestion');
  const { graph, graphSource } = await discoverGraphAsset(ingestionDir);

  // 2. 检查 tla-manifest.json 存在性 + specs 非空
  const manifestFile = path.resolve(projectDir, ARTIFACT_PATHS.tlaManifest);
  const tlaAsset = await readTlaManifest(manifestFile);
  const manifestExists = tlaAsset.exists;

  // ==================== BDD 资产读取（spec §13.2 #18） ====================
  // 项目阶段 1-8 均要求 manifest；fixture 回归不经过本入口，因此仍不启用 required flags。
  const bddManifestFile = path.resolve(projectDir, ARTIFACT_PATHS.bddManifest);
  const effectivePhase: PhaseOption = phaseOption ?? 8;
  const { bddViolations, bddManifestExists, bddManifestSchemaValid, bddManifestValid, bddManifest } =
    await readBddManifest(bddManifestFile, projectDir, effectivePhase);
  const cucumberAsset = isProjectCucumberEvidencePhase(effectivePhase)
    ? await readCucumberReport(cucumberReportFile, true)
    : { cucumberViolations: [] as string[] };

  const syncPairs: TlaBddSyncPair[] = [];
  const syncPairViolations: string[] = [];
  let syncPairCoverageValid = false;
  // SSoT §10.5.1: phases 1-4 always require D4 through check-bdd-model;
  // independent file sync is enabled only after both manifests pass their own
  // schema/asset gates and their pair set has complete bidirectional coverage.
  const independentSyncContractPhase = isTlaBddSyncContractPhase(effectivePhase);
  const syncRequired = independentSyncContractPhase;
  if (syncRequired && tlaAsset.valid && bddManifestValid) {
    const pairResult = buildTlaBddSyncPairs({
      tlaManifest: tlaAsset.manifest as { basePath?: string; specs?: Array<{ id?: string; tlaPath?: string }> },
      bddManifest: bddManifest as {
        basePath?: string;
        features?: Array<{ id?: string; tlaSpecId?: string; filePath?: string }>;
      },
      manifestFile,
      projectDir,
    });
    syncPairs.push(...pairResult.syncPairs);
    syncPairViolations.push(...pairResult.syncPairViolations);
    syncPairCoverageValid = pairResult.pairCoverageValid;
  }

  // 调用纯逻辑校验（传入 graph + manifestExists + phaseOption + specDir + projectRoot，
  // 启用 TLA+ 资产校验与阶段分层；projectRoot 供 M07 E2 解析 evidence.rawOutputPath）
  const result = checkArtifactGate(matrix, {
    graph,
    // TLA+ is a required project asset only for phases 1-4; phase 5-8 uses Cucumber evidence.
    manifestExists: isProjectTlaBddEvidencePhase(effectivePhase) ? tlaAsset.valid : undefined,
    phaseOption,
    specDir,
    projectRoot: projectDir,
    // S18：--tickets 缺省时为 undefined → 纯函数不触发票据校验（既有调用方零影响）
    ticketsText,
  });

  // ==================== 终检调用 TLA+/BDD model 校验（设计文档 §3.3.8） ====================
  // phase 1 不依赖 graph；phase 2-4 在已有 graph 时叠加 graph 参数；phase 5-8 强制 Cucumber 证据。
  const graphPath = graphSource ? path.join(ingestionDir, graphSource) : '';
  const modelCheckViolations = runModelChecks({
    manifestExists,
    manifestValid: tlaAsset.valid,
    effectivePhase,
    graphPath,
    manifestFile,
    bddManifestExists,
    bddManifestSchemaValid,
    bddManifestValid,
    bddManifestFile,
    cucumberReportFile,
    syncRequired,
    syncPairCoverageValid,
    syncPairs,
    syncPairViolations,
  });
  // Phase 5-8 uses required Cucumber execution evidence; TLA manifest is not a phase-gate input there.
  const tlaAssetViolations = isProjectTlaBddEvidencePhase(effectivePhase) ? tlaAsset.violations : [];

  // uat-path-mapping 校验违反（计入终检结果；解析严格化 + 阶段 5/终检均校验）
  const uatMappingViolations = await collectUatMappingViolations(projectDir, phaseOption);

  // ==================== 外部校验聚合（Slice B：codegraph/opsx strict，阶段 5-8） ====================
  // scope 解析统一走 loadCliScope（与三 checker 同一装载路径）：--scope=<file> 或
  // --change/--base/--head 薄封装；缺失 → aggregate 内 fail-closed violations；
  // scope 文件/JSON/schema 非法 → exit 2（输入错误，helper 内部处理）；Git 绑定失败 →
  // violations（与两 checker violations 一并并入 reasons，不被 RTM 通过掩盖）。
  // openspecArchived 不作为本 gate 输入（archive 是 phase 8 opsx:archive 后置门，单独跑
  // check-openspec-archive.ts）。
  // 阶段 5-8 外部校验聚合（Slice B）：复用前面已定的 effectivePhase（phaseOption ?? 8）
  const externalPhase: number = phaseOption ?? 8;
  let externalAggregate: ExternalChecksAggregate | undefined;
  if (externalPhase >= 5) {
    const loaded = loadCliScope(process.argv, projectDir, externalPhase);
    if (loaded.kind === 'missing') {
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, { scope: null, scopeViolations: [] });
    } else if (loaded.kind === 'violations') {
      // scope 已提供但绑定失败：不输出"未提供 --scope"误导文案，真实原因以 [scope] 前缀进 reasons；
      // summary 标注 provided=true + 尝试绑定的 changeId（D1：区分「未提供」与「已提供但被拒」）
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, {
        scope: null,
        scopeViolations: loaded.violations,
        scopeProvidedButFailed: true,
        attemptedChangeId: loaded.attemptedChangeId,
      });
    } else {
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, {
        scope: loaded.scope,
        scopeViolations: [],
      });
    }
  }

  // 合并 TLA/BDD 资产、UAT 映射与 model/sync 校验违反；畸形输入不得退化为“缺失快照”。
  const externalReasons = externalAggregate?.reasons ?? [];
  const allReasons = [
    ...result.reasons,
    ...tlaAssetViolations,
    ...uatMappingViolations,
    ...bddViolations,
    ...cucumberAsset.cucumberViolations,
    ...modelCheckViolations,
    ...externalReasons,
  ];
  const overallPassed =
    result.passed &&
    tlaAssetViolations.length === 0 &&
    uatMappingViolations.length === 0 &&
    bddViolations.length === 0 &&
    cucumberAsset.cucumberViolations.length === 0 &&
    modelCheckViolations.length === 0 &&
    (externalAggregate?.passed ?? true);
  const exitCode = overallPassed ? 0 : 1;
  // M07 测试证据：legacy 为非阻断诊断（不进 reasons/overallPassed）；testEvidence 为 e-rule 计数
  const legacyDiagnostics = result.legacy ?? [];
  const testEvidenceSummary = result.testEvidence ?? null;
  // S18 票据内容计数：--tickets 缺省时为 null（键恒存在，便于编排消费）
  const ticketsSummary = result.tickets ?? null;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'artifact',
        passed: overallPassed,
        reasons: allReasons,
        violations: buildViolationDistribution(allReasons.length),
        // S46（O1 增强）：--json 与 GATE_JSON 同构，补 external summary；
        // 非 5-8 阶段（无外部校验）时为 null，键恒存在便于编排消费
        external: externalAggregate?.summary ?? null,
        // M07：legacy 非阻断诊断 + 测试证据 e-rule 计数（键恒存在，便于编排消费）
        ...(legacyDiagnostics.length > 0 ? { legacy: legacyDiagnostics } : {}),
        testEvidence: testEvidenceSummary,
        // S18：票据内容校验计数（缺省不触发时为 null）
        tickets: ticketsSummary,
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('工件质量门校验（Artifact Gate）');
  console.log('═'.repeat(60));
  console.log(`项目目录      : ${projectDir}`);
  console.log(`RTM 文件      : ${rtmFile}`);
  console.log(`校验阶段      : phase=${phaseOption ?? 8}${phaseOption ? '（阶段级）' : '（终检，默认）'}`);
  console.log(`RTM 覆盖率    : ${result.coveragePercent}%`);
  console.log(`单元覆盖率    : ${result.unitCoveragePercent}%`);
  console.log(
    `TLA+ 资产     : ${tlaAsset.valid ? '✓ manifest schema 通过且 specs 非空' : '✗ manifest 缺失、非法或 specs 为空'}`,
  );
  console.log(
    `BDD 资产      : ${bddManifestValid ? '✓ bdd-manifest.json 存在且 schema 通过' : '✗ bdd-manifest.json 缺失、非法或 schema 失败'}`,
  );
  console.log(
    `Model 校验    : ${modelCheckViolations.length === 0 ? '✓ TLA+/BDD model 校验通过' : `✗ ${modelCheckViolations.length} 条违反`}`,
  );
  console.log(
    `graph 资产    : ${graph ? `✓ ${graphSource}（${graph.nodes.length} 节点）` : '⚠ 未发现任何 graph 资产'}`,
  );
  // S18：仅在给定 --tickets 时输出票据内容校验行（缺省不改变既有输出）
  if (ticketsSummary !== null) {
    console.log(
      `票据内容      : ${ticketsSummary.checked} 张票据，黑名单违规 ${ticketsSummary.criticalMissing} 条，Buildability 违规 ${ticketsSummary.buildabilityMissing} 条（${ticketsFile ?? '（--tickets）'}）`,
    );
  }
  if (externalAggregate !== undefined) {
    const ext = externalAggregate.summary;
    console.log(
      `codegraph 外部 : ${ext.codegraph.passed ? '✓' : '✗'} 覆盖 ${ext.codegraph.coveredFileCount}/${ext.codegraph.requiredFileCount} 须覆盖文件（${ext.codegraph.violationCount} 条违规）`,
    );
    console.log(
      `opsx 外部     : ${ext.opsx.passed ? '✓' : '✗'} 制品目录 ${ext.opsx.changesNames.join(', ') || '（无）'}（${ext.opsx.violationCount} 条违规）`,
    );
  }
  console.log(`校验结果      : ${overallPassed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (overallPassed) {
    console.log('所有放行条件均满足：RTM 需求覆盖率 100% 且四级测试全部通过（含 BDD 资产校验）。');
  } else {
    console.log('未通过原因：');
    for (const r of allReasons) {
      console.log(`  - ${r}`);
    }
  }
  // M07：cutoff 前旧 RTM 的测试证据缺失按非阻断 legacy 诊断呈现（不改变 exitCode）
  if (legacyDiagnostics.length > 0) {
    console.log('测试证据 legacy 诊断（非阻断）：');
    for (const d of legacyDiagnostics) console.log(`  - ${d}`);
  }

  // 末尾 JSON 摘要（供 Agent 程序解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  printGateReport(
    'GATE',
    {
      type: 'artifact',
      passed: overallPassed,
      coveragePercent: result.coveragePercent,
      unitCoveragePercent: result.unitCoveragePercent,
      missingItems: result.missingItems,
      reasons: allReasons,
      bddManifestExists,
      // 阶段 5-8 外部校验 summary（两个 checker 的 passed/violations 计数与相对路径计数）
      external: externalAggregate?.summary,
      // M07：非阻断 legacy 诊断（仅在非空时出现）+ 测试证据 e-rule 计数（键恒存在）
      ...(legacyDiagnostics.length > 0 ? { legacy: legacyDiagnostics } : {}),
      testEvidence: testEvidenceSummary,
      // S18：票据内容校验计数（键恒存在；缺省不触发时为 null）
      tickets: ticketsSummary,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// isMain 守卫：仅直接执行时运行 main，被 self-test 等 import 时不触发
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
