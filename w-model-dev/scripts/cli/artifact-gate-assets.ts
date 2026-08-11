/**
 * 工件质量门资产读取/校验层（Artifact Gate Assets）
 *
 * 自 check-artifact-gate.ts 拆分的资产侧逻辑（Task A1）：
 * - graph 资产自动发现（P2.6：.w-model/ingestion/ 下的 graph.json / consolidated-phaseN.json）
 * - tla-manifest.json 存在性 + specs 非空检查（spec §3.4.4）
 * - bdd-manifest.json 存在性 + schema + features 文件存在性 + stateMachines 七要素非空（spec §13.2 #18）
 * - TLA+/BDD model 校验（设计文档 §3.3.8：终检时经子进程调用 check-tla-model.ts / check-bdd-model.ts）
 */

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type GateGraph, type PhaseOption } from '../logic/gate-logic.js';
import { validateBySchema } from '../logic/schema-loader.js';
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

/** TLA+ 资产检查（spec §3.4.4）：tla-manifest.json 存在性 + specs 非空 */
export async function readTlaManifest(manifestFile: string): Promise<boolean> {
  let manifestExists = false;
  try {
    const manifestRaw = await fs.readFile(manifestFile, 'utf-8');
    const manifestParsed = parseJsonSafe(manifestRaw) as { specs?: unknown[] };
    if (manifestParsed && Array.isArray(manifestParsed.specs) && manifestParsed.specs.length > 0) {
      manifestExists = true;
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.error(`⚠ tla-manifest.json 读取失败（忽略，按不存在处理）: ${e.message}`);
    }
    // ENOENT 或解析失败 → manifestExists 保持 false
  }
  return manifestExists;
}

export interface BddAssetResult {
  bddViolations: string[];
  bddManifestExists: boolean;
}

/**
 * BDD 资产读取（spec §13.2 #18）：bdd-manifest.json 存在性 + schema + features 文件存在性
 * + stateMachines 七要素非空（states/acceptingStates/transitions/invariants）。
 * 阶段 4 后才要求 bdd-manifest.json 存在（阶段 1-3 可能还未创建）。
 */
export async function readBddManifest(
  bddManifestFile: string,
  projectDir: string,
  effectivePhase: PhaseOption,
): Promise<BddAssetResult> {
  const bddViolations: string[] = [];
  let bddManifestExists = false;
  try {
    const bddRaw = await fs.readFile(bddManifestFile, 'utf-8');
    const bddManifestParsed = parseJsonSafe(bddRaw) as unknown;
    bddManifestExists = true;
    const bddSchemaResult = validateBySchema('bdd-manifest', bddManifestParsed);
    if (!bddSchemaResult.valid) {
      bddViolations.push(`[artifact:bdd] manifest schema failed: ${bddSchemaResult.errorMessages.join('; ')}`);
    } else {
      const bddManifest = bddManifestParsed as {
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
      // 检查 features 文件存在
      const bddBasePath = path.resolve(projectDir, bddManifest.basePath);
      for (const f of bddManifest.features ?? []) {
        const fp = path.resolve(bddBasePath, f.filePath);
        try {
          await fs.access(fp);
        } catch {
          bddViolations.push(`[artifact:bdd] feature file missing: ${f.filePath}`);
        }
      }
      // 检查 stateMachines 七要素非空
      for (const sm of bddManifest.stateMachines ?? []) {
        if (!sm.states?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no states`);
        if (!sm.acceptingStates?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no accepting states`);
        if (!sm.transitions?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no transitions`);
        if (!sm.invariants?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no invariants`);
      }
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.error(`⚠ bdd-manifest.json 读取失败（忽略，按不存在处理）: ${e.message}`);
    }
    // ENOENT 或解析失败 → bddManifestExists 保持 false
  }
  if (!bddManifestExists && effectivePhase >= 4) {
    // 阶段 4 后必须有 BDD manifest
    bddViolations.push('[artifact:bdd] .w-model/bdd-manifest.json missing (required after phase 4)');
  }
  return { bddViolations, bddManifestExists };
}

export interface ModelCheckOptions {
  manifestExists: boolean;
  effectivePhase: PhaseOption;
  /** graph 资产绝对路径（graph.json / consolidated-phaseN.json），无则空串 */
  graphPath: string;
  manifestFile: string;
  bddManifestExists: boolean;
  bddManifestFile: string;
}

/**
 * 终检调用 TLA+/BDD model 校验（设计文档 §3.3.8）：
 * phase>=2 且 graph 存在时，经子进程调用 check-tla-model.ts + check-bdd-model.ts
 * （传递 --graph + --phase），任一非 0 退出码即记一条违反（含 stdout 末尾 5 行摘要）。
 */
export function runModelChecks(opts: ModelCheckOptions): string[] {
  const modelCheckViolations: string[] = [];
  const { manifestExists, effectivePhase, graphPath, manifestFile, bddManifestExists, bddManifestFile } = opts;

  if (manifestExists && effectivePhase >= 2 && graphPath) {
    // 调用 check-tla-model.ts
    const tlaModelResult = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        path.resolve(__dirname, 'check-tla-model.ts'),
        manifestFile,
        `--phase=${effectivePhase}`,
        `--graph=${graphPath}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    if (tlaModelResult.status !== 0) {
      modelCheckViolations.push(
        `[artifact:tla-model] check-tla-model 退出码 ${tlaModelResult.status}：${(tlaModelResult.stdout ?? '').split('\n').slice(-5).join(' | ')}`,
      );
    }

    // 调用 check-bdd-model.ts
    if (bddManifestExists) {
      const bddModelResult = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          path.resolve(__dirname, 'check-bdd-model.ts'),
          bddManifestFile,
          `--phase=${effectivePhase}`,
          `--graph=${graphPath}`,
        ],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      if (bddModelResult.status !== 0) {
        modelCheckViolations.push(
          `[artifact:bdd-model] check-bdd-model 退出码 ${bddModelResult.status}：${(bddModelResult.stdout ?? '').split('\n').slice(-5).join(' | ')}`,
        );
      }
    }
  }
  return modelCheckViolations;
}
