/* eslint-disable security/detect-non-literal-fs-filename -- These paths are caller-selected project artifacts checked by the gate. */

/**
 * 工件质量门资产读取/校验层（Artifact Gate Assets）
 *
 * 资产侧逻辑：
 * - graph 资产自动发现（P2.6：.w-model/ingestion/ 下的 graph.json / consolidated-phaseN.json）
 * - tla-manifest.json 存在性 + specs 非空检查（spec §3.4.4）
 * - bdd-manifest.json 存在性 + schema + features 文件存在性 + stateMachines 七要素非空（spec §13.2 #18）
 * - TLA+/BDD model 校验（设计文档 §3.3.8：终检时经子进程调用 check-tla-model.ts / check-bdd-model.ts）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import { type GateGraph, type PhaseOption } from '../logic/gate-logic.js';
import { runSync } from '../lib/run-sync.js';
import { parseJsonSafe } from '../lib/safe-json.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GraphAssetResult {
  graph: GateGraph | undefined;
  /** 命中的 graph 文件名（basename），如 'graph.json'；未发现时为 '' */
  graphSource: string;
}

/**
 * P2.6 graph 资产自动发现：按优先级查找 .w-model/ingestion/ 下的 graph 资产
 * （graph.json / consolidated-phase4.json / consolidated-phase3.json /
 *   consolidated-phase2.json / consolidated-phase1.json）。
 * 首个解析成功且含 nodes 数组者胜出；读取失败（ENOENT 除外）仅告警并继续。
 */
export async function discoverGraphAsset(ingestionDir: string): Promise<GraphAssetResult> {
  const graphCandidates = [
    path.join(ingestionDir, 'graph.json'),
    path.join(ingestionDir, 'consolidated-phase4.json'),
    path.join(ingestionDir, 'consolidated-phase3.json'),
    path.join(ingestionDir, 'consolidated-phase2.json'),
    path.join(ingestionDir, 'consolidated-phase1.json'),
  ];
  let graph: GateGraph | undefined;
  let graphSource = '';
  for (const candidate of graphCandidates) {
    try {
      const graphRaw = await fs.readFile(candidate, 'utf-8');
      const graphParsed = parseJsonSafe(graphRaw) as GateGraph;
      if (graphParsed && Array.isArray(graphParsed.nodes)) {
        graph = graphParsed;
        graphSource = path.basename(candidate);
        break;
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        console.error(`⚠ ${path.basename(candidate)} 读取失败（忽略）: ${e.message}`);
      }
    }
  }
  return { graph, graphSource };
}

/** TLA+ 资产检查结果：区分缺失、解析失败、schema 失败和空 specs，避免 fail-open。 */
export interface TlaManifestAssetResult {
  exists: boolean;
  valid: boolean;
  manifest: Record<string, unknown> | undefined;
  violations: string[];
}

/** TLA+ 资产检查（spec §3.4.4）：真实 tla-manifest schema + specs 非空检查。 */
export async function readTlaManifest(manifestFile: string): Promise<TlaManifestAssetResult> {
  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      return {
        exists: false,
        valid: false,
        manifest: undefined,
        violations: ['[artifact:tla] tla-manifest.json missing'],
      };
    }
    return {
      exists: true,
      valid: false,
      manifest: undefined,
      violations: [`[artifact:tla] tla-manifest.json read failed: ${e.message}`],
    };
  }

  let manifestParsed: unknown;
  try {
    manifestParsed = parseJsonSafe(manifestRaw);
  } catch (err) {
    return {
      exists: true,
      valid: false,
      manifest: undefined,
      violations: [`[artifact:tla] tla-manifest.json JSON parse failed: ${(err as Error).message}`],
    };
  }

  const schemaResult = validateBySchema('tla-manifest', manifestParsed);
  const manifestObject =
    typeof manifestParsed === 'object' && manifestParsed !== null && !Array.isArray(manifestParsed)
      ? (manifestParsed as Record<string, unknown>)
      : undefined;
  const specs = manifestObject?.specs;
  const schemaViolations = schemaResult.errorMessages.map((m) => `[artifact:tla] manifest schema failed: ${m}`);
  const specsViolations = !Array.isArray(specs)
    ? ['[artifact:tla] manifest specs must be a non-empty array']
    : specs.length === 0
      ? ['[artifact:tla] manifest specs must not be empty']
      : [];
  const assetViolations: string[] = [];
  if (typeof manifestObject?.basePath !== 'string' || manifestObject.basePath.length === 0) {
    assetViolations.push('[artifact:tla] manifest basePath is required for asset resolution');
  }
  if (Array.isArray(specs) && typeof manifestObject?.basePath === 'string') {
    const tlaBase = path.resolve(path.dirname(manifestFile), manifestObject.basePath);
    for (const spec of specs as Array<{ id?: unknown; tlaPath?: unknown; cfgPath?: unknown }>) {
      const id = typeof spec.id === 'string' ? spec.id : 'unknown';
      for (const [kind, relativePath] of [
        ['tla', spec.tlaPath],
        ['cfg', spec.cfgPath],
      ] as const) {
        if (typeof relativePath !== 'string' || relativePath.length === 0) continue;
        try {
          await fs.access(path.resolve(tlaBase, relativePath));
        } catch {
          assetViolations.push(`[artifact:tla] ${kind} asset missing for spec "${id}": ${relativePath}`);
        }
      }
    }
  }
  const violations = [...schemaViolations, ...specsViolations, ...assetViolations];
  return {
    exists: true,
    valid: schemaResult.valid && Array.isArray(specs) && specs.length > 0 && violations.length === 0,
    manifest: manifestObject,
    violations,
  };
}

export interface BddAssetResult {
  bddViolations: string[];
  bddManifestExists: boolean;
  /** 文件存在且通过 schema 解析；资产内容仍可能不完整并由 bddManifestValid fail-closed。 */
  bddManifestSchemaValid: boolean;
  /** schema、关联文件和状态机资产均有效时才允许 pair sync。 */
  bddManifestValid: boolean;
  bddManifest: Record<string, unknown> | undefined;
}

export interface CucumberReportResult {
  cucumberViolations: string[];
  cucumberReportExists: boolean;
  cucumberReportValid: boolean;
}

export interface TlaBddSyncPair {
  tlaFile: string;
  featureFile: string;
}

/**
 * SSoT §10.5.1：项目 Artifact Gate 的 TLA+/BDD 行为证据阶段。
 * 这些阶段同时是独立 TLA↔BDD 文件同步契约的适用阶段。
 */
export const PROJECT_TLA_BDD_EVIDENCE_PHASES: readonly PhaseOption[] = [1, 2, 3, 4];

/** SSoT §10.5.1：项目 Artifact Gate 的 required Cucumber 证据阶段。 */
export const PROJECT_CUCUMBER_EVIDENCE_PHASES: readonly PhaseOption[] = [5, 6, 7, 8];

/** SSoT §10.5.1：phase 2-4 在 TLA+ 证据上叠加 graph 资产要求。 */
export const PROJECT_TLA_GRAPH_EVIDENCE_PHASES: readonly PhaseOption[] = [2, 3, 4];

/** BDD CLI 的 D8 数据源契约：phase 2-8 均须传递 graph。 */
export const PROJECT_BDD_GRAPH_EVIDENCE_PHASES: readonly PhaseOption[] = [2, 3, 4, 5, 6, 7, 8];

/** SSoT §10.5.1：独立 TLA↔BDD 文件同步契约只适用于 phase 1-4。 */
export const TLA_BDD_SYNC_CONTRACT_PHASES = PROJECT_TLA_BDD_EVIDENCE_PHASES;

/** 判断当前阶段是否使用项目 required TLA+/BDD 行为证据。 */
export function isProjectTlaBddEvidencePhase(phase: PhaseOption): boolean {
  return PROJECT_TLA_BDD_EVIDENCE_PHASES.includes(phase);
}

/** 判断当前阶段是否使用项目 required Cucumber 执行证据。 */
export function isProjectCucumberEvidencePhase(phase: PhaseOption): boolean {
  return PROJECT_CUCUMBER_EVIDENCE_PHASES.includes(phase);
}

/** 判断当前阶段是否需要 TLA+ model 的项目 graph 证据。 */
export function requiresProjectTlaGraphEvidence(phase: PhaseOption): boolean {
  return PROJECT_TLA_GRAPH_EVIDENCE_PHASES.includes(phase);
}

/** 判断当前阶段是否需要 BDD model 的项目 graph 证据。 */
export function requiresProjectBddGraphEvidence(phase: PhaseOption): boolean {
  return PROJECT_BDD_GRAPH_EVIDENCE_PHASES.includes(phase);
}

/** 判断当前阶段是否进入独立 TLA↔BDD 文件同步契约。 */
export function isTlaBddSyncContractPhase(phase: PhaseOption): boolean {
  return TLA_BDD_SYNC_CONTRACT_PHASES.includes(phase);
}

export interface TlaBddSyncManifestInput {
  tlaManifest: {
    basePath?: string;
    specs?: Array<{ id?: string; tlaPath?: string }>;
  };
  bddManifest: {
    basePath?: string;
    features?: Array<{ id?: string; tlaSpecId?: string; filePath?: string }>;
  };
  manifestFile: string;
  projectDir: string;
}

export interface TlaBddSyncPairResult {
  syncPairs: TlaBddSyncPair[];
  syncPairViolations: string[];
  /** 双向覆盖成立时才允许调用独立 sync CLI。 */
  pairCoverageValid: boolean;
}

/** 构造 TLA↔BDD 双向配对，并阻断 BDD/TLA 任一侧的孤儿资产。 */
export function buildTlaBddSyncPairs(opts: TlaBddSyncManifestInput): TlaBddSyncPairResult {
  const syncPairs: TlaBddSyncPair[] = [];
  const syncPairViolations: string[] = [];
  const tlaSpecs = opts.tlaManifest.specs ?? [];
  const bddFeatures = opts.bddManifest.features ?? [];
  const tlaBase = path.resolve(path.dirname(opts.manifestFile), opts.tlaManifest.basePath ?? '.');
  const bddBase = path.resolve(opts.projectDir, opts.bddManifest.basePath ?? '.');
  const pairedTlaSpecIds = new Set<string>();

  for (const feature of bddFeatures) {
    const spec = tlaSpecs.find((candidate) => candidate.id === feature.tlaSpecId);
    if (!spec) {
      syncPairViolations.push(
        `[artifact:tla-bdd-sync] BDD feature "${feature.id ?? feature.filePath ?? 'unknown'}" has no matching TLA+ spec`,
      );
      continue;
    }
    if (spec.id) pairedTlaSpecIds.add(spec.id);
    if (!spec.tlaPath || !feature.filePath) {
      syncPairViolations.push(
        `[artifact:tla-bdd-sync] BDD feature "${feature.id ?? feature.filePath ?? 'unknown'}" has incomplete TLA+/feature path mapping`,
      );
      continue;
    }
    syncPairs.push({
      tlaFile: path.resolve(tlaBase, spec.tlaPath),
      featureFile: path.resolve(bddBase, feature.filePath),
    });
  }

  for (const spec of tlaSpecs) {
    if (spec.id && !pairedTlaSpecIds.has(spec.id)) {
      syncPairViolations.push(`[artifact:tla-bdd-sync] TLA+ spec "${spec.id}" has no matching BDD feature`);
    }
  }

  return {
    syncPairs,
    syncPairViolations,
    pairCoverageValid: syncPairs.length > 0 && syncPairViolations.length === 0,
  };
}

/**
 * BDD 资产读取（spec §13.2 #18）：bdd-manifest.json 存在性 + schema + features 文件存在性
 * + stateMachines 七要素非空（states/acceptingStates/transitions/invariants）。
 * 项目阶段 1-8 均要求 bdd-manifest.json 存在；pre-push fixture 不经过此项目资产读取层。
 */
export async function readBddManifest(
  bddManifestFile: string,
  projectDir: string,
  effectivePhase: PhaseOption,
): Promise<BddAssetResult> {
  const bddViolations: string[] = [];
  let bddManifestExists = false;
  let bddManifestSchemaValid = false;
  const bddManifestValid = false;
  let bddManifest: Record<string, unknown> | undefined;
  try {
    const bddRaw = await fs.readFile(bddManifestFile, 'utf-8');
    bddManifestExists = true;
    let bddManifestParsed: unknown;
    try {
      bddManifestParsed = parseJsonSafe(bddRaw);
    } catch (err) {
      bddViolations.push(`[artifact:bdd] manifest JSON parse failed: ${(err as Error).message}`);
      return { bddViolations, bddManifestExists, bddManifestSchemaValid, bddManifestValid, bddManifest };
    }
    const bddSchemaResult = validateBySchema('bdd-manifest', bddManifestParsed);
    if (!bddSchemaResult.valid) {
      bddViolations.push(`[artifact:bdd] manifest schema failed: ${bddSchemaResult.errorMessages.join('; ')}`);
    } else {
      bddManifestSchemaValid = true;
      bddManifest = bddManifestParsed as Record<string, unknown>;
      const typedManifest = bddManifestParsed as {
        basePath: string;
        features: Array<{ filePath: string }>;
        stateMachines: Array<{
          id: string;
          states: string[];
          acceptingStates: string[];
          transitions: unknown[];
          invariants: string[];
        }>;
      };
      if (!typedManifest.features?.length) {
        bddViolations.push('[artifact:bdd] manifest features must not be empty');
      }
      if (!typedManifest.stateMachines?.length) {
        bddViolations.push('[artifact:bdd] manifest stateMachines must not be empty');
      }
      const bddBasePath = path.resolve(projectDir, typedManifest.basePath);
      for (const f of typedManifest.features ?? []) {
        const fp = path.resolve(bddBasePath, f.filePath);
        try {
          await fs.access(fp);
        } catch {
          bddViolations.push(`[artifact:bdd] feature file missing: ${f.filePath}`);
        }
      }
      for (const sm of typedManifest.stateMachines ?? []) {
        if (!sm.states?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no states`);
        if (!sm.acceptingStates?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no accepting states`);
        if (!sm.transitions?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no transitions`);
        if (!sm.invariants?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no invariants`);
      }
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      bddViolations.push('[artifact:bdd] .w-model/bdd-manifest.json missing');
    } else {
      bddViolations.push(`[artifact:bdd] manifest read failed: ${e.message}`);
    }
  }
  if (!bddManifestExists && effectivePhase >= 1) {
    bddViolations.push('[artifact:bdd] bdd-manifest.json is required for project phases 1-8');
  }
  return {
    bddViolations,
    bddManifestExists,
    bddManifestSchemaValid,
    bddManifestValid: bddManifestSchemaValid && bddViolations.length === 0,
    bddManifest,
  };
}

/**
 * Cucumber 报告读取/证据校验。required 项目门对所有畸形、非 passed 状态和零执行报告 fail-closed；
 * fixture 调用方不使用此函数，因此不改变 pre-push 的轻量回归边界。
 */
export async function readCucumberReport(reportFile: string, required: boolean): Promise<CucumberReportResult> {
  const cucumberViolations: string[] = [];
  let cucumberReportExists = false;
  let cucumberReportValid = false;
  let raw: string;
  try {
    raw = await fs.readFile(reportFile, 'utf-8');
    cucumberReportExists = true;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (required) {
      cucumberViolations.push(
        e.code === 'ENOENT'
          ? '[artifact:cucumber] report missing'
          : `[artifact:cucumber] report read failed: ${e.message}`,
      );
    }
    return { cucumberViolations, cucumberReportExists, cucumberReportValid };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonSafe(raw);
  } catch (err) {
    cucumberViolations.push(`[artifact:cucumber] report JSON parse failed: ${(err as Error).message}`);
    return { cucumberViolations, cucumberReportExists, cucumberReportValid };
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Array.isArray((parsed as { elements?: unknown }).elements)
  ) {
    cucumberViolations.push('[artifact:cucumber] report must be an object with an elements array');
    return { cucumberViolations, cucumberReportExists, cucumberReportValid };
  }

  const elements = (parsed as { elements: unknown[] }).elements;
  let executedScenarioCount = 0;
  let executedStepCount = 0;
  const allowedStatuses = new Set(['passed', 'failed', 'skipped', 'pending', 'undefined', 'ambiguous']);
  for (const [elementIndex, element] of elements.entries()) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) {
      cucumberViolations.push(`[artifact:cucumber] elements[${elementIndex}] must be an object`);
      continue;
    }
    const scenario = element as { name?: unknown; steps?: unknown };
    const named = typeof scenario.name === 'string' && scenario.name.trim().length > 0;
    if (!named || !Array.isArray(scenario.steps)) {
      cucumberViolations.push(
        `[artifact:cucumber] elements[${elementIndex}] must have a non-empty name and steps array`,
      );
      continue;
    }
    let passedStep = false;
    for (const [stepIndex, step] of scenario.steps.entries()) {
      if (typeof step !== 'object' || step === null || Array.isArray(step)) {
        cucumberViolations.push(`[artifact:cucumber] elements[${elementIndex}].steps[${stepIndex}] must be an object`);
        continue;
      }
      const result = (step as { result?: unknown }).result;
      if (
        typeof result !== 'object' ||
        result === null ||
        Array.isArray(result) ||
        typeof (result as { status?: unknown }).status !== 'string'
      ) {
        cucumberViolations.push(
          `[artifact:cucumber] elements[${elementIndex}].steps[${stepIndex}] result.status is required`,
        );
        continue;
      }
      const status = (result as { status: string }).status;
      if (!allowedStatuses.has(status)) {
        cucumberViolations.push(`[artifact:cucumber] unknown step status "${status}"`);
      } else if (status !== 'passed') {
        cucumberViolations.push(`[artifact:cucumber] step status "${status}" is not passed`);
      } else {
        passedStep = true;
        executedStepCount++;
      }
    }
    if (passedStep) executedScenarioCount++;
  }
  if (executedScenarioCount === 0 || executedStepCount === 0) {
    cucumberViolations.push('[artifact:cucumber] report has no executed scenarios or steps');
  }
  cucumberReportValid = cucumberViolations.length === 0;
  return { cucumberViolations, cucumberReportExists, cucumberReportValid };
}

export interface ModelCheckOptions {
  manifestExists: boolean;
  manifestValid?: boolean;
  effectivePhase: PhaseOption;
  /** graph 资产绝对路径（graph.json / consolidated-phaseN.json），无则空串 */
  graphPath: string;
  manifestFile: string;
  bddManifestExists: boolean;
  /** Schema-valid manifests still run BDD model checks for diagnostics. */
  bddManifestSchemaValid?: boolean;
  /** Complete asset validity gates independent TLA↔BDD pair sync. */
  bddManifestValid?: boolean;
  bddManifestFile: string;
  cucumberReportFile?: string;
  /** Project contract enables independent TLA↔BDD file synchronization. */
  syncRequired?: boolean;
  /** True only when every TLA spec and BDD feature has a valid reciprocal pair. */
  syncPairCoverageValid?: boolean;
  syncPairs?: TlaBddSyncPair[];
  syncPairViolations?: string[];
}

function appendProcessViolation(
  violations: string[],
  label: string,
  script: string,
  result: { status: number | null; stdout?: string | null; stderr?: string | null } | undefined,
): void {
  if (!result || result.status !== 0) {
    const summary = result
      ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-5).join(' | ')
      : '未返回进程结果';
    violations.push(`[artifact:${label}] ${script} 退出码 ${result?.status ?? 'unknown'}：${summary}`);
  }
}

/**
 * 终检调用 TLA+/BDD model 校验和项目 TLA↔BDD 同步校验。
 * phase 1 不需要 graph；phase 2-8 仅在已有 graph 时传递 graph，所有子进程均经 runSync 安全边界。
 */
export function runModelChecks(opts: ModelCheckOptions): string[] {
  const modelCheckViolations: string[] = [];
  const {
    manifestExists,
    manifestValid = manifestExists,
    effectivePhase,
    graphPath,
    manifestFile,
    bddManifestExists,
    bddManifestValid = bddManifestExists,
    bddManifestSchemaValid = bddManifestValid,
    bddManifestFile,
    cucumberReportFile,
    syncRequired = false,
    syncPairCoverageValid = false,
    syncPairs = [],
    syncPairViolations = [],
  } = opts;
  const usesProjectTlaBddEvidence = isProjectTlaBddEvidencePhase(effectivePhase);
  const canRunTla =
    manifestExists &&
    manifestValid &&
    usesProjectTlaBddEvidence &&
    (!requiresProjectTlaGraphEvidence(effectivePhase) || Boolean(graphPath));
  const canRunBdd = bddManifestExists && bddManifestSchemaValid;
  if (requiresProjectTlaGraphEvidence(effectivePhase) && manifestValid && !graphPath) {
    modelCheckViolations.push('[artifact:graph] graph asset is required for project phase 2-4');
  }

  if (canRunTla) {
    const tlaArgs = [
      '--import',
      'tsx',
      path.resolve(__dirname, '..', 'cli', 'check-tla-model.ts'),
      manifestFile,
      `--phase=${effectivePhase}`,
    ];
    if (requiresProjectTlaGraphEvidence(effectivePhase) && graphPath) tlaArgs.push(`--graph=${graphPath}`);
    appendProcessViolation(
      modelCheckViolations,
      'tla-model',
      'check-tla-model',
      runSync(process.execPath, tlaArgs, { stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  }

  if (canRunBdd) {
    const bddArgs = [
      '--import',
      'tsx',
      path.resolve(__dirname, '..', 'cli', 'check-bdd-model.ts'),
      bddManifestFile,
      `--phase=${effectivePhase}`,
    ];
    if (usesProjectTlaBddEvidence) {
      bddArgs.push('--require-tla-equivalence', `--tla-manifest=${manifestFile}`);
    } else if (isProjectCucumberEvidencePhase(effectivePhase)) {
      bddArgs.push('--require-cucumber-report', `--cucumber-report=${cucumberReportFile ?? ''}`);
    }
    if (requiresProjectBddGraphEvidence(effectivePhase) && graphPath) bddArgs.push(`--graph=${graphPath}`);
    appendProcessViolation(
      modelCheckViolations,
      'bdd-model',
      'check-bdd-model',
      runSync(process.execPath, bddArgs, { stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  }

  const independentSyncEnabled = syncRequired && isTlaBddSyncContractPhase(effectivePhase);
  if (independentSyncEnabled) {
    modelCheckViolations.push(...syncPairViolations);
    if (!manifestValid || !bddManifestValid) {
      modelCheckViolations.push('[artifact:tla-bdd-sync] required TLA+/BDD sync assets are invalid');
    } else if (!syncPairCoverageValid || syncPairs.length === 0) {
      modelCheckViolations.push('[artifact:tla-bdd-sync] bidirectional TLA+/BDD pair coverage is incomplete');
    } else {
      for (const pair of syncPairs) {
        const syncResult = runSync(
          process.execPath,
          [
            '--import',
            'tsx',
            path.resolve(__dirname, '..', 'cli', 'check-tla-bdd-sync.ts'),
            pair.tlaFile,
            pair.featureFile,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        appendProcessViolation(modelCheckViolations, 'tla-bdd-sync', 'check-tla-bdd-sync', syncResult);
      }
    }
  }
  return modelCheckViolations;
}
