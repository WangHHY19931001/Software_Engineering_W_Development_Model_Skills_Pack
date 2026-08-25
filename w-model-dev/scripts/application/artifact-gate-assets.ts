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
  const specs =
    typeof manifestParsed === 'object' && manifestParsed !== null && !Array.isArray(manifestParsed)
      ? (manifestParsed as { specs?: unknown }).specs
      : undefined;
  const schemaViolations = schemaResult.errorMessages.map((m) => `[artifact:tla] manifest schema failed: ${m}`);
  const specsViolations = !Array.isArray(specs)
    ? ['[artifact:tla] manifest specs must be a non-empty array']
    : specs.length === 0
      ? ['[artifact:tla] manifest specs must not be empty']
      : [];
  const violations = [...schemaViolations, ...specsViolations];
  return {
    exists: true,
    valid: schemaResult.valid && Array.isArray(specs) && specs.length > 0,
    manifest:
      typeof manifestParsed === 'object' && manifestParsed !== null && !Array.isArray(manifestParsed)
        ? (manifestParsed as Record<string, unknown>)
        : undefined,
    violations,
  };
}

export interface BddAssetResult {
  bddViolations: string[];
  /** 文件存在但内容畸形时仍为 true；使用 bddManifestValid 决定是否调用模型门禁。 */
  bddManifestExists: boolean;
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
 * 项目阶段 1-4 的 D4 契约要求 TLA↔BDD 等价性证据；独立 sync CLI 只在两类
 * manifest 均已通过资产校验后执行，避免把非法输入降级为“无配对”。
 */
export const TLA_BDD_SYNC_REQUIRED_PHASES: readonly PhaseOption[] = [1, 2, 3, 4];

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

  return { syncPairs, syncPairViolations };
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
  let bddManifestValid = false;
  let bddManifest: Record<string, unknown> | undefined;
  try {
    const bddRaw = await fs.readFile(bddManifestFile, 'utf-8');
    bddManifestExists = true;
    let bddManifestParsed: unknown;
    try {
      bddManifestParsed = parseJsonSafe(bddRaw);
    } catch (err) {
      bddViolations.push(`[artifact:bdd] manifest JSON parse failed: ${(err as Error).message}`);
      return { bddViolations, bddManifestExists, bddManifestValid, bddManifest };
    }
    const bddSchemaResult = validateBySchema('bdd-manifest', bddManifestParsed);
    if (!bddSchemaResult.valid) {
      bddViolations.push(`[artifact:bdd] manifest schema failed: ${bddSchemaResult.errorMessages.join('; ')}`);
    } else {
      bddManifestValid = true;
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
  return { bddViolations, bddManifestExists, bddManifestValid, bddManifest };
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
  bddManifestValid?: boolean;
  bddManifestFile: string;
  cucumberReportFile?: string;
  /** Project contract enables TLA↔BDD synchronization for phases 1-4. */
  syncRequired?: boolean;
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
    bddManifestFile,
    cucumberReportFile,
    syncRequired = false,
    syncPairs = [],
    syncPairViolations = [],
  } = opts;
  const canRunTla =
    manifestExists && manifestValid && effectivePhase <= 4 && (effectivePhase === 1 || Boolean(graphPath));
  const canRunBdd = bddManifestExists && bddManifestValid;
  if (effectivePhase >= 2 && effectivePhase <= 4 && manifestValid && !graphPath) {
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
    if (effectivePhase >= 2 && graphPath) tlaArgs.push(`--graph=${graphPath}`);
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
    if (effectivePhase <= 4) {
      bddArgs.push('--require-tla-equivalence', `--tla-manifest=${manifestFile}`);
    } else {
      bddArgs.push('--require-cucumber-report', `--cucumber-report=${cucumberReportFile ?? ''}`);
    }
    if (effectivePhase >= 2 && graphPath) bddArgs.push(`--graph=${graphPath}`);
    appendProcessViolation(
      modelCheckViolations,
      'bdd-model',
      'check-bdd-model',
      runSync(process.execPath, bddArgs, { stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  }

  if (effectivePhase <= 4 && syncRequired) {
    modelCheckViolations.push(...syncPairViolations);
    if (!manifestValid || !bddManifestValid) {
      modelCheckViolations.push('[artifact:tla-bdd-sync] required TLA+/BDD sync assets are invalid');
    } else if (syncPairs.length === 0) {
      modelCheckViolations.push('[artifact:tla-bdd-sync] no TLA+/BDD sync pair was found');
    }
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
  return modelCheckViolations;
}
