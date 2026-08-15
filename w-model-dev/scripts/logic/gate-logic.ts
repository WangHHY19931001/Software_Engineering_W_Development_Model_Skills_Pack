import * as nodeFs from 'node:fs';
import * as path from 'node:path';

import { RTM_FIELDS } from '../lib/constants.js';

import { validateBySchema } from './schema-loader.js';

export interface RTMRowShape {
  requirementId: string;
  description: string;
  designDoc: string;
  codeModule: string;
  unitTest: string;
  integrationTest: string;
  systemTest: string;
  acceptanceTest: string;
  coverageStatus?: '100%' | '部分' | '待覆盖';
  targetValue?: string;
  testThreshold?: string;
}

export interface RTMMatrixShape {
  rows: RTMRowShape[];
  executionSummary: {
    unitTest: TestSummaryShape;
    integrationTest: TestSummaryShape;
    systemTest: TestSummaryShape;
    acceptanceTest: TestSummaryShape;
  };
}

export interface TestSummaryShape {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  coverage: number;
}

export interface ArtifactGateResult {
  passed: boolean;
  reasons: string[];
  coveragePercent: number;
  missingItems: Array<{ requirementId: string; fields: string[] }>;
  unitCoveragePercent: number;
  codegraphQueriesValid?: boolean; // check-codegraph-queries.ts exitCode=0（phase 5-8）
  opsxArtifactsValid?: boolean; // check-opsx-artifacts.ts exitCode=0（phase 5-8）
  openspecArchived?: boolean; // check-openspec-archive.ts exitCode=0（phase 5-8 门通过后）
}

// RTM 追溯字段单点事实源：lib/constants.ts（RTM_FIELDS），此处仅保持名称与类型不变
const REQUIRED_TRACE_FIELDS: Array<keyof RTMRowShape> = [...RTM_FIELDS];

// ==================== 阶段级校验（P1.1） ====================
/**
 * 阶段级校验选项。
 * - phase 1-4：跳过测试汇总校验（设计阶段，pending 合理）
 * - phase 5：校验 unitTest；跳过 integration/system/acceptance
 * - phase 6：phase 5 + integrationTest
 * - phase 7：phase 6 + systemTest
 * - phase 8：全部 + acceptanceTest（默认，向后兼容）
 */
export type PhaseOption = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 各阶段须校验的测试汇总层（未到的层跳过 pending/failed 校验）。 */
const PHASE_TEST_LAYERS: Record<number, readonly string[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: ['unitTest'],
  6: ['unitTest', 'integrationTest'],
  7: ['unitTest', 'integrationTest', 'systemTest'],
  8: ['unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};

/**
 * 各阶段须校验的 RTM 追溯字段（含 description，保持与终检一致）。
 * phase=8 与 REQUIRED_TRACE_FIELDS 完全一致（向后兼容）。
 */
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc', 'acceptanceTest'],
  2: ['description', 'designDoc', 'acceptanceTest'],
  3: ['description', 'designDoc', 'acceptanceTest'],
  4: ['description', 'designDoc', 'acceptanceTest'],
  5: ['description', 'designDoc', 'codeModule', 'unitTest', 'acceptanceTest'],
  6: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'acceptanceTest'],
  7: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
  8: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};

/**
 * 终检强化（spec §3.4.4）可选入参类型。
 */
export interface GateGraphNode {
  id: string;
  type: string;
}

export interface GateGraph {
  nodes: GateGraphNode[];
}

export interface CheckArtifactGateOptions {
  graph?: GateGraph;
  manifestExists?: boolean;
  /** 阶段级校验选项（P1.1）：1-8，默认 8（终检，向后兼容）。 */
  phaseOption?: PhaseOption;
  /** 阶段 5-8 外部校验脚本结果（G 子代理先跑 check 脚本获取 exitCode，再传入保持纯逻辑可测试性）。 */
  externalChecks?: {
    codegraphQueriesValid?: boolean;
    opsxArtifactsValid?: boolean;
    openspecArchived?: boolean;
  };
  /** phase=1 需求规格独立产物目录（docs/phase1-requirements/），提供时做结构校验。 */
  specDir?: string;
}

/**
 * SD→codeModule 映射校验（spec §3.4.4 第2项，逻辑同 code-tla-logic.ts 维度1）。
 *
 * 校验：每个 SD 节点须有至少一个 codeModule 映射。
 * 映射判定：SD id 去 "SD-" 前缀，按 -/_/. 拆段（长度 >= 2），任一段在 codeModule 路径中出现。
 */
function checkSdToCodeModuleMapping(graph: GateGraph, rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  if (!graph || !Array.isArray(graph.nodes)) return violations;
  const sdNodes = graph.nodes.filter((n) => n && n.type === 'SD');
  if (sdNodes.length === 0) return violations;

  const codeModules: string[] = [];
  for (const row of rows) {
    if (row && typeof row.codeModule === 'string' && row.codeModule.trim() !== '') {
      codeModules.push(row.codeModule);
    }
  }

  for (const sd of sdNodes) {
    const id = String(sd.id ?? '');
    const stripped = id.replace(/^SD-/, '');
    const segments = stripped
      .split(/[-_.]+/)
      .map((s) => s.toLowerCase())
      .filter((s) => s.length >= 2);
    if (id !== '' && segments.length === 0 && codeModules.some((m: string) => m.includes(`${id}:`))) {
      continue; // 数字层级 id（如 SD-5.2.1）命中 codeModule 前缀映射
    }
    if (segments.length === 0) {
      violations.push(`TLA+ 资产校验失败：SD 节点 id 为空或无可识别段，无法映射 codeModule: ${id}`);
      continue;
    }
    const matched = codeModules.some((cm) => {
      const cmLower = cm.toLowerCase();
      return segments.some((seg) => cmLower.includes(seg));
    });
    if (!matched) {
      violations.push(
        `TLA+ 资产校验失败：SD 节点 ${id} 无对应 codeModule（期望 codeModule 路径包含以下任一段: ${segments.join(', ')}）`,
      );
    }
  }
  return violations;
}

// ==================== codeModule 格式校验（P0-2） ====================
/**
 * codeModule 格式校验（按行类型分支）。
 * - REQ 行：^SD-[\d.]+:src/.+
 * - NFR/CON 行：^src/.+ 或 === "横切"
 */
export function checkCodeModuleFormat(rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  const reqPattern = /^SD-[\d.]+:src\/.+/;
  const nfrPattern = /^src\/.+/;

  for (const row of rows) {
    if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;

    const id = row.requirementId;
    const cm = row.codeModule.trim();

    if (id.startsWith('REQ-')) {
      if (!reqPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：REQ 行 ${id} 的 codeModule "${cm}" 须匹配 ^SD-[\\d.]+:src/.+（示例：SD-5.2.1:src/auth/login.ts）`,
        );
      }
    } else if (id.startsWith('NFR-') || id.startsWith('CON-')) {
      if (cm !== '横切' && !nfrPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：${id.startsWith('NFR-') ? 'NFR' : 'CON'} 行 ${id} 的 codeModule "${cm}" 须匹配 ^src/.+ 或 === "横切"`,
        );
      }
    }
  }
  return violations;
}

// ==================== uat-path-mapping 回填校验（P0-1） ====================
export interface UatPathMappingRow {
  uatId: string;
  actualPath: string;
  mappingType: string;
}

/**
 * uat-path-mapping 回填校验。
 * - 每条 UAT-NNN 的 actualPath 非 "_待阶段5回填_"
 * - mappingType ∈ ["直接", "等价", "替代"]
 */
export function checkUatPathMappingBackfill(mappings: UatPathMappingRow[]): string[] {
  const violations: string[] = [];
  const validMappingTypes = ['直接', '等价', '替代'];

  for (const m of mappings) {
    if (!m || typeof m.uatId !== 'string') continue;
    if (typeof m.actualPath !== 'string' || typeof m.mappingType !== 'string') {
      violations.push(`uat-path-mapping 字段类型非法：${m.uatId} 的 actualPath/mappingType 必须为字符串`);
      continue;
    }
    if (m.actualPath.includes('_待阶段5回填_') || m.actualPath.trim() === '') {
      violations.push(`uat-path-mapping 未回填：${m.uatId} 的实际路径仍为 "_待阶段5回填_" 或为空`);
    }
    if (!validMappingTypes.includes(m.mappingType)) {
      violations.push(
        `uat-path-mapping mappingType 非法：${m.uatId} 的 mappingType "${m.mappingType}" 须 ∈ ["直接", "等价", "替代"]`,
      );
    }
  }
  return violations;
}

// ==================== Phase 1 需求规格结构校验 ====================
export interface RequirementSpecStructureViolations {
  refs: string[];
  ssot: string[];
  dod: string[];
}

/** 真实 node:fs 适配（readFileSync 显式 utf-8 以满足 string 返回类型）。 */
const nodeFsAdapter: {
  readFileSync(p: string): string;
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
} = {
  readFileSync: (p: string) => nodeFs.readFileSync(p, 'utf-8'),
  existsSync: (p: string) => nodeFs.existsSync(p),
  readdirSync: (p: string) => nodeFs.readdirSync(p),
};

/** Phase 1 需求规格结构校验：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param specDir  docs/phase1-requirements/ 目录（含 requirement-spec.md + 6 独立产物）
 *  @param fs       文件系统注入 { readFileSync(p): string; existsSync(p): boolean }，便于单测 mock
 */
export function checkRequirementSpecStructure(
  specDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean },
): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const specPath = path.join(specDir, 'requirement-spec.md');
  if (!fs.existsSync(specPath)) {
    v.refs.push('structure: requirement-spec.md 不存在');
    return v;
  }
  // 引用块完整性：6 个独立文件（主规格引用块 `> xxx详见 [name](./name.md)`）
  // String() 兼容注入 fs 返回 Buffer 的场景（真实 node:fs 无编码 readFileSync 返回 Buffer）
  const spec = String(fs.readFileSync(specPath));
  const requiredRefs = [
    'system-context.md',
    'glossary.md',
    'traceability-matrix.md',
    'behavior-spec.md',
    'discipline-dod.md',
    'uml-modeling.md',
  ];
  for (const ref of requiredRefs) {
    if (!spec.includes(`](./${ref})`)) v.refs.push(`structure: 主规格缺引用块 → ${ref}`);
    if (!fs.existsSync(path.join(specDir, ref))) v.refs.push(`structure: 引用文件不存在 ${ref}`);
  }
  // §0 SSOT 头四项声明
  for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
    if (!spec.includes(key)) v.ssot.push(`structure: §0 SSOT 头缺「${key}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodPath = path.join(specDir, 'discipline-dod.md');
  if (!fs.existsSync(dodPath)) {
    v.dod.push('structure: discipline-dod.md 不存在');
  } else {
    const dod = String(fs.readFileSync(dodPath));
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: discipline-dod.md DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  }
  return v;
}

/** 各阶段独立产物布局（主文档后缀 + 6 独立文件）
 *  phase=1: requirement-spec.md 主文档 + 6 子文件（无前缀）
 *  phase=2: {module}-system-design.md 主文档 + 6 子文件（带 {module}- 前缀）
 */
const PHASE_SPEC_LAYOUT: Record<number, { mainSuffix: string; refs: string[] }> = {
  1: {
    mainSuffix: 'requirement-spec.md',
    refs: [
      'system-context.md',
      'glossary.md',
      'traceability-matrix.md',
      'behavior-spec.md',
      'discipline-dod.md',
      'uml-modeling.md',
    ],
  },
  2: {
    mainSuffix: '-system-design.md',
    refs: ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  3: {
    mainSuffix: '-interface-design.md',
    refs: ['interface-contract', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  4: {
    mainSuffix: '-detailed-design.md',
    refs: ['class-design', 'data-model', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod'],
  },
};

/** Phase N 设计/规格结构校验：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param phase  1/2/3/4
 *  @param specDir  docs/phase{N}-{name}/ 目录
 *  @param fs       文件系统注入 { readFileSync; existsSync; readdirSync }，便于单测 mock
 */
export function checkPhaseSpecStructure(
  phase: number,
  specDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean; readdirSync(p: string): string[] },
): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const layout = PHASE_SPEC_LAYOUT[phase];
  if (!layout) {
    v.refs.push(`structure: 不支持的 phase=${phase}（当前支持 1/2/3/4）`);
    return v;
  }
  // 主文档定位：phase=1 固定文件名；phase≥2 按 *{mainSuffix} glob
  let mainPath: string | undefined;
  if (phase === 1) {
    mainPath = path.join(specDir, layout.mainSuffix);
  } else {
    const mains = fs.readdirSync(specDir).filter((f) => f.endsWith(layout.mainSuffix));
    if (mains.length !== 1) {
      v.refs.push(`structure: 主文档 glob *${layout.mainSuffix} 匹配 ${mains.length} 个（须恰 1 个）`);
      return v;
    }
    mainPath = path.join(specDir, mains[0]!);
  }
  if (!fs.existsSync(mainPath)) {
    v.refs.push(`structure: 主文档 ${layout.mainSuffix} 不存在`);
    return v;
  }
  const spec = String(fs.readFileSync(mainPath));
  // module 前缀提取（phase≥2 时用于引用文件名校对，通用去掉主文档后缀）
  const modulePrefix = phase === 1 ? '' : path.basename(mainPath).slice(0, -layout.mainSuffix.length);
  for (const ref of layout.refs) {
    const refName = phase === 1 ? ref : `${modulePrefix}-${ref}.md`;
    if (!spec.includes(`](./${refName})`)) v.refs.push(`structure: 主文档缺引用块 → ${refName}`);
    if (!fs.existsSync(path.join(specDir, refName))) v.refs.push(`structure: 引用文件不存在 ${refName}`);
  }
  // §0 SSOT 头四项声明
  for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
    if (!spec.includes(key)) v.ssot.push(`structure: §0 SSOT 头缺「${key}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodName = phase === 1 ? 'discipline-dod.md' : `${modulePrefix}-discipline-dod.md`;
  const dodPath = path.join(specDir, dodName);
  if (!fs.existsSync(dodPath)) {
    v.dod.push(`structure: ${dodName} 不存在`);
  } else {
    const dod = String(fs.readFileSync(dodPath));
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: ${dodName} DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  }
  return v;
}

/** 技能包 templates/ 各阶段目录映射（主模板文件名 + 子模板目录名） */
const TEMPLATES_PHASE_DIR: Record<number, { main: string; dir: string }> = {
  1: { main: 'requirement-spec.md', dir: 'requirement-spec' },
  2: { main: 'system-design.md', dir: 'system-design' },
  3: { main: 'interface-design.md', dir: 'interface-design' },
  4: { main: 'detailed-design.md', dir: 'detailed-design' },
};

/**
 * 模板漂移校验（--validate-templates 模式，C9）：按 PHASE_SPEC_LAYOUT 校验技能包
 * templates/ 资产含必需结构标记（引用块 / §0 SSOT 头 / DoD 清单），模板漂移可检出。
 *
 * 与 checkPhaseSpecStructure 的差异（模板 vs 项目产物）：
 *   - 主模板固定文件名（phase≥2 无 {module} 前缀，引用块用 {{module}} 占位符）
 *   - 子模板位于同名子目录（templates/requirement-spec/system-context.md 等，无前缀）
 *
 * @param templatesDir  技能包 templates/ 目录
 * @param fs            文件系统注入（同 checkPhaseSpecStructure，便于单测 mock）
 * @returns violations 列表（空数组 = 全部通过）
 */
export function checkTemplatesStructure(
  templatesDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean },
): string[] {
  const violations: string[] = [];
  for (const phase of [1, 2, 3, 4] as const) {
    const layout = PHASE_SPEC_LAYOUT[phase]!;
    const tdir = TEMPLATES_PHASE_DIR[phase]!;
    const prefix = 'templates:';

    // 1. 主模板存在
    const mainPath = path.join(templatesDir, tdir.main);
    if (!fs.existsSync(mainPath)) {
      violations.push(`${prefix} 阶段 ${phase} 主模板缺失 ${tdir.main}`);
      continue;
    }
    const main = String(fs.readFileSync(mainPath));

    for (const ref of layout.refs) {
      const refFile = ref.endsWith('.md') ? ref : `${ref}.md`;
      // 2. 引用块存在（phase=1 直接文件名；phase≥2 {{module}} 占位符形式）
      const refLink = phase === 1 ? `](./${refFile})` : `](./{{module}}-${refFile})`;
      if (!main.includes(refLink)) {
        violations.push(`${prefix} 阶段 ${phase} 主模板 ${tdir.main} 缺引用块 → ${refLink}`);
      }
      // 3. 子模板存在（子目录内，无前缀）
      if (!fs.existsSync(path.join(templatesDir, tdir.dir, refFile))) {
        violations.push(`${prefix} 阶段 ${phase} 子模板缺失 ${tdir.dir}/${refFile}`);
      }
    }

    // 4. §0 SSOT 头四项声明
    for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
      if (!main.includes(key)) violations.push(`${prefix} 阶段 ${phase} 主模板 §0 SSOT 头缺「${key}」`);
    }

    // 5. DoD 清单：discipline-dod 子模板 - [ ] 项 ≥ 8
    const dodPath = path.join(templatesDir, tdir.dir, 'discipline-dod.md');
    if (!fs.existsSync(dodPath)) {
      violations.push(`${prefix} 阶段 ${phase} DoD 子模板缺失 ${tdir.dir}/discipline-dod.md`);
    } else {
      const dod = String(fs.readFileSync(dodPath));
      const checks = (dod.match(/- \[ \]/g) ?? []).length;
      if (checks < 8) violations.push(`${prefix} 阶段 ${phase} DoD 清单仅 ${checks} 项（须 ≥ 8）`);
    }
  }
  return violations;
}

function failureResult(reasons: string[], coveragePercent = 0): ArtifactGateResult {
  return { passed: false, reasons, coveragePercent, missingItems: [], unitCoveragePercent: 0 };
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

export function checkArtifactGate(
  matrix: RTMMatrixShape | null | undefined,
  options?: CheckArtifactGateOptions,
): ArtifactGateResult {
  if (!matrix) return failureResult(['RTM 未初始化']);

  // === Schema 前置校验 ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方业务规则校验（覆盖率 / 阶段级字段 / TLA+ 资产等）。
  const schemaResult = validateBySchema('rtm', matrix);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      coveragePercent: 0,
      missingItems: [],
      unitCoveragePercent: 0,
    };
  }

  // P1.1 阶段级校验：默认 phase=8（终检，向后兼容）
  const phase: PhaseOption = options?.phaseOption ?? 8;
  const phaseFields = PHASE_TRACE_FIELDS[phase] ?? REQUIRED_TRACE_FIELDS;
  const phaseLayers = PHASE_TEST_LAYERS[phase] ?? [];

  const reasons: string[] = [];

  if (!Array.isArray(matrix.rows)) reasons.push('RTM 结构错误：rows 字段缺失或非数组');
  if (!matrix.executionSummary || typeof matrix.executionSummary !== 'object') {
    reasons.push('RTM 结构错误：executionSummary 字段缺失或非对象');
  }
  if (reasons.length > 0) return failureResult(reasons);

  // phase=1/2/3/4 且提供 specDir 时做规格/设计结构校验
  // （置于 RTM 早退检查后：RTM 结构损坏时直接失败，不叠加 spec 校验；spec 违反仅进 reasons，不影响覆盖率计算）
  let specStructureViolations: RequirementSpecStructureViolations | undefined;
  if ((phase === 1 || phase === 2 || phase === 3 || phase === 4) && options?.specDir) {
    specStructureViolations = checkPhaseSpecStructure(phase, options.specDir, nodeFsAdapter);
    for (const m of [
      ...specStructureViolations.refs,
      ...specStructureViolations.ssot,
      ...specStructureViolations.dod,
    ]) {
      reasons.push(m);
    }
  }

  const requiredTestTypes: Array<{ key: keyof RTMMatrixShape['executionSummary']; name: string; layer: string }> = [
    { key: 'unitTest', name: '单元测试', layer: 'unitTest' },
    { key: 'integrationTest', name: '集成测试', layer: 'integrationTest' },
    { key: 'systemTest', name: '系统测试', layer: 'systemTest' },
    { key: 'acceptanceTest', name: '验收测试', layer: 'acceptanceTest' },
  ];
  const summaries: Array<{ name: string; layer: string; summary: TestSummaryShape | undefined }> = [];

  for (const { key, name, layer } of requiredTestTypes) {
    const summary = matrix.executionSummary[key];
    if (!summary || typeof summary !== 'object') {
      // 仅当该层属于当前阶段校验范围时才报结构错误（未到的层允许缺失）
      if (phaseLayers.includes(layer)) {
        reasons.push(`RTM 结构错误：executionSummary.${key}（${name}汇总）缺失或非对象`);
      }
    }
    summaries.push({ name, layer, summary });
  }

  const missingItems: Array<{ requirementId: string; fields: string[] }> = [];
  const ids = new Set<string>();
  for (let index = 0; index < matrix.rows.length; index++) {
    const row = matrix.rows[index];
    if (!row || typeof row !== 'object') {
      reasons.push(`RTM 结构错误：rows[${index}] 非对象`);
      continue;
    }
    if (typeof row.requirementId !== 'string' || row.requirementId.trim() === '') {
      reasons.push(`RTM 结构错误：rows[${index}].requirementId 必须为非空字符串`);
      continue;
    }
    if (ids.has(row.requirementId)) {
      reasons.push(`RTM 结构错误：需求 ID 重复（${row.requirementId}）`);
    }
    ids.add(row.requirementId);
    // P1.2 横切治理：NFR/CON 行只校验 designDoc（phase<5）或 designDoc+codeModule（phase>=5），
    // 不强制要求 test 字段（横切测试通过 REQ 行的测试用例覆盖）
    const isCrossCutting = row.requirementId.startsWith('NFR') || row.requirementId.startsWith('CON');
    const fieldsToCheck = isCrossCutting
      ? phase >= 5
        ? (['description', 'designDoc', 'codeModule'] as const)
        : (['description', 'designDoc'] as const)
      : phaseFields;
    const missing = fieldsToCheck.filter(
      (field) => typeof row[field] !== 'string' || (row[field] as string).trim() === '',
    );
    if (missing.length > 0) missingItems.push({ requirementId: row.requirementId, fields: missing });
  }

  for (const item of missingItems) {
    reasons.push(`RTM 追溯不完整：${item.requirementId} 缺少 ${item.fields.join('、')}`);
  }

  const totalRows = matrix.rows.length;
  const coveredRows = totalRows - missingItems.length;
  let coveragePercent = totalRows > 0 ? Math.round((coveredRows / totalRows) * 100) : 0;
  // coveragePercent 与 missingItems 联动（约束 #3）：存在追溯缺失项时覆盖率强制 < 100，
  // 防止 (total-1)/total 舍入边界（如 199/200=99.5→100）掩盖缺失
  if (missingItems.length > 0 && coveragePercent >= 100) coveragePercent = 99;
  if (coveragePercent < 100) reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  if (totalRows === 0) reasons.push('RTM 无需求行');

  // ==================== coverageStatus 字段一致性校验（P0，行级） ====================
  // 约束 #3：coverageStatus 须与该行自身完整性一致，不再与矩阵全局 coveragePercent 比较
  //   "100%" → 该行所需 RTM 字段齐全；"部分" → 该行存在追溯缺失；"待覆盖" → 违反
  //   （"完整" 等历史兼容值与非标准值不参与一致性判定，由 missingItems 覆盖检查兜底）
  const missingReqIds = new Set(missingItems.map((item) => item.requirementId));
  const missingFieldsByReqId = new Map<string, string[]>(missingItems.map((item) => [item.requirementId, item.fields]));
  for (const row of matrix.rows) {
    if (!row || typeof row.coverageStatus !== 'string') continue;
    const status = row.coverageStatus.trim();
    if (status === '待覆盖') {
      reasons.push(`RTM coverageStatus="待覆盖" 不允许（须回退重做，约束 #3）`);
      continue;
    }
    const rowComplete = !missingReqIds.has(row.requirementId);
    if (status === '100%' && !rowComplete) {
      const fields = missingFieldsByReqId.get(row.requirementId) ?? [];
      reasons.push(
        `RTM coverageStatus="100%" 但该行追溯不完整（缺少 ${fields.join('、')}），coverageStatus 与行级完整性不一致`,
      );
    } else if (status === '部分' && rowComplete) {
      reasons.push(`RTM coverageStatus="部分" 但该行追溯完整，coverageStatus 与行级完整性不一致`);
    }
  }

  // ==================== NFR 双值字段校验（P2） ====================
  // 问题 4：性能基线须区分生产目标值与测试环境基线
  // 仅对 NFR 类型行校验（requirementId 以 NFR 开头）；非 NFR 行跳过
  // 双字段都缺失才 fail，单字段缺失不 fail
  for (const row of matrix.rows) {
    if (!row || typeof row.requirementId !== 'string') continue;
    if (!row.requirementId.startsWith('NFR')) continue;
    const hasTarget = 'targetValue' in row && typeof row.targetValue === 'string' && row.targetValue.trim() !== '';
    const hasThreshold =
      'testThreshold' in row && typeof row.testThreshold === 'string' && row.testThreshold.trim() !== '';
    if (!hasTarget && !hasThreshold) {
      reasons.push(
        `NFR 行 ${row.requirementId} 缺 targetValue 与 testThreshold 双字段（性能基线须区分生产目标值与测试环境基线）`,
      );
    }
  }

  let unitCoveragePercent = 0;
  for (const { name, layer, summary } of summaries) {
    // P1.1 阶段分层：未到的测试层跳过 pending/failed 校验（pending 合理）
    if (!phaseLayers.includes(layer)) continue;
    if (!summary || typeof summary !== 'object') continue;
    const values = [summary.total, summary.passed, summary.failed, summary.pending];
    if (!values.every(isFiniteNonNegativeInteger)) {
      reasons.push(`${name}: total/passed/failed/pending 必须为非负整数`);
      continue;
    }
    if (summary.passed + summary.failed + summary.pending !== summary.total) {
      reasons.push(`${name}: passed + failed + pending 必须等于 total`);
    }
    if (summary.total === 0) reasons.push(`${name}: 无用例`);
    if (summary.failed > 0) reasons.push(`${name}: ${summary.failed} 个失败`);
    if (summary.pending > 0) reasons.push(`${name}: ${summary.pending} 个待执行`);
    if (
      typeof summary.coverage !== 'number' ||
      !Number.isFinite(summary.coverage) ||
      summary.coverage < 0 ||
      summary.coverage > 100
    ) {
      reasons.push(`${name}: coverage 必须为 [0,100] 范围内的有限数字`);
    }
    if (name === '单元测试' && typeof summary.coverage === 'number' && Number.isFinite(summary.coverage)) {
      unitCoveragePercent = summary.coverage;
      if (summary.coverage < 80) reasons.push(`单元测试代码覆盖率未达 80%（当前 ${summary.coverage}%）`);
    }
  }

  // ==================== TLA+ 资产校验（spec §3.4.4，追加项） ====================
  // 1. TLA+ 资产存在性：manifestExists 显式为 false 时追加违反（未传时跳过，保持向后兼容）
  if (options && options.manifestExists === false) {
    reasons.push('TLA+ 资产校验失败：tla-manifest.json 不存在或 specs 为空');
  }
  // 2. SD→codeModule 映射：graph 提供时执行（仅 phase >= 5 时校验，因为 codeModule 在 phase 5 才进入 RTM 追溯字段）
  if (options && options.graph && phase >= 5) {
    const sdViolations = checkSdToCodeModuleMapping(options.graph, matrix.rows);
    for (const v of sdViolations) reasons.push(v);
  }

  // ==================== codeModule 格式校验（P0-2，仅 phase >= 5） ====================
  if (phase >= 5) {
    const formatViolations = checkCodeModuleFormat(matrix.rows);
    for (const v of formatViolations) reasons.push(v);
  }

  return {
    passed: reasons.length === 0,
    reasons,
    coveragePercent,
    missingItems,
    unitCoveragePercent,
    codegraphQueriesValid: phase >= 5 ? options?.externalChecks?.codegraphQueriesValid : undefined,
    opsxArtifactsValid: phase >= 5 ? options?.externalChecks?.opsxArtifactsValid : undefined,
    openspecArchived: phase >= 5 ? options?.externalChecks?.openspecArchived : undefined,
  };
}
