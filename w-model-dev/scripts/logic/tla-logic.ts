/**
 * TLA+ 模型校验纯逻辑（TLA Logic）—— 防止层次化状态机建模漂移
 *
 * 对应 docs/tla-plus-modeling-design.md TLA+ 层次化建模与门禁设计。
 * 校验：manifest 结构 + 规格字段 + 文件头字段一致性 + 层次一致性
 *   （parent/child/sibling 双向 + 单 L1 根 + 层级单调）+ 拆解决策
 *   （变量组合数阈值）+ 声明的 SANY/TLC 结果标志。
 *
 * 设计原则（与 graph-logic.ts / verifier-logic.ts / gate-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *      （schema-loader.ts 为同目录内部工具，不计为外部依赖）
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「TLA+ 规格是否符合规范」的判定均委托至此
 *
 * 调用方：
 *   - CLI 脚本 check-tla-model.ts（供 G 子代理执行：读文件、跑 SANY/TLC、调本逻辑校验）
 *
 * 注意：本文件只校验 manifest 声明的结构与字段，不执行 SANY/TLC（那是 CLI 的 I/O 职责）。
 *   文件头解析（parseTlaHeader）与字段比对（validateHeader）为纯函数，供 CLI 调用后
 *   将违反合并入最终结果。headerViolations / environmentOk / environmentErrors 字段
 *   在纯逻辑中分别留空 / 置真 / 置空，由 CLI 在执行 I/O 后回填并重算 passed。
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';

// ==================== 自包含类型形状 ====================

export type SpecLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export type DecompositionDecision = 'must-split' | 'consider-split' | 'kept-below-threshold' | 'split-done';

export interface TlaSpec {
  id: string;
  level: SpecLevel;
  phase: number;
  system: string;
  requirementIds: string[];
  designRef: string;
  tlaPath: string;
  cfgPath: string;
  parent: string | null;
  siblings: string[];
  children: string[];
  variableCombination: number;
  decompositionDecision: DecompositionDecision;
  /**
   * B9（批次 7）：variableCombination 的推导注记（可选）。
   * variableCombination > CONSIDER_SPLIT_THRESHOLD(1000) 且保留未拆（kept-below-threshold）时必填：
   * Πvariables[].cardinality 必须等于声明的 variableCombination 字段值
   * （缺注记或乘积不符 → checkDecomposition violation；≤1000 不要求）。
   */
  variableCombinationBasis?: { variables: Array<{ name: string; cardinality: number }> };
  syntaxChecked: boolean;
  tlcChecked: boolean;
  deadlockFree: boolean;
  invariantsHold: boolean;
  stateExplosion: boolean;
  lastCheckTimestamp?: string;
  /** .tla 文件文本内容（可选；CLI 读取后注入，供 cfg-tla 一致性等纯逻辑校验使用） */
  tlaContent?: string;
  /** .cfg 文件文本内容（可选；CLI 读取后注入，供 cfg 结构/一致性纯逻辑校验使用） */
  cfgContent?: string;
}

export interface TlaManifest {
  version: number;
  project?: string;
  /**
   * 强制必填字段（P1.1）：jarPath/tlaPath/cfgPath 路径解析的统一基准。
   * 值为相对 manifest 文件所在目录的路径（如 "." 或 ".."）。
   * CLI（check-tla-model.ts）按 `path.resolve(manifestDir, basePath)` 解析为绝对基准目录，
   * 再据此解析 jarPath/tlaPath/cfgPath，避免按 cwd 解析导致跨项目试错。
   */
  basePath: string;
  currentPhase: number;
  tools: { jarPath: string; javaMinVersion: number };
  specs: TlaSpec[];
  /**
   * graph.json 中所有 type=SD 节点的 ID 列表（可选；CLI 通过 --graph 提取后注入，
   * 供 SD 覆盖率纯逻辑校验使用）。未提供时跳过覆盖率校验。
   */
  graphSdNodes?: string[];
  /**
   * SD 覆盖率数据（phase>=2 强制必填，由 S-ingest-tla 从 .tla @designIds + graph.json 比对后回填）。
   * checkTlaModel 校验 uncoveredSdNodes 须为空。
   */
  sdCoverage?: {
    totalSdNodes: number;
    coveredSdNodes: string[];
    uncoveredSdNodes: string[];
    coverageRate: number;
  };
  checkRounds?: Array<{
    phase: number;
    round: number;
    timestamp?: string;
    specId: string;
    syntaxCheck: string;
    tlcCheck: string;
    violations: string[];
    converged: boolean;
  }>;
}

export interface HeaderField {
  name: string;
  value: string | null;
}

/**
 * per-spec TLC 执行状态（A7，2026-10-06）：报告「TLC 到底跑没跑、跑赢没跑」的单一事实。
 *   - notRun：TLC 未执行（SANY 语法检查失败 ⇒ 反模式 #14 顺序硬约束；或 tlcChecked=false），
 *     reasons 只陈述这一事实 + 首因，**不复述** manifest 预置的死锁/不变式/状态爆炸布尔。
 *   - failed：TLC 已执行且存在违反（死锁 / 不变式违反 / 状态爆炸）。
 *   - passed：TLC 已执行且零违反。
 */
export type TlcRunStatus = 'passed' | 'failed' | 'notRun';

export interface TlaSpecRunStatus {
  specId: string;
  tlaPath: string;
  tlcStatus: TlcRunStatus;
  reasons: string[];
}

export interface TlaCheckResult {
  passed: boolean;
  phase: number;
  totalSpecs: number;
  checkedSpecs: number;
  /** per-spec TLC 执行状态（A7 单一事实报告，见 TlaSpecRunStatus） */
  specs: TlaSpecRunStatus[];
  headerViolations: string[];
  hierarchyViolations: string[];
  decompositionViolations: string[];
  syntaxErrors: string[];
  deadlockViolations: string[];
  invariantViolations: string[];
  stateExplosionSpecs: string[];
  /** SD 覆盖率违反（graphSdNodes 中未被任何 spec 覆盖的 SD 列表，见 §10） */
  coverageViolations: string[];
  /** .cfg 与 .tla BusinessInvariant 不变式集合不一致违反（见 §11） */
  cfgConsistencyViolations: string[];
  /** .cfg 结构违反（如混入 MODULE 声明、INVARIANT 行格式错误，见 §12） */
  cfgStructureViolations: string[];
  /** checkRounds schema 违反（如元素缺字段、字段类型错、含 phase 级摘要字段，见 §checkRounds 字段语义，R13） */
  checkRoundsViolations: string[];
  environmentOk: boolean;
  environmentErrors: string[];
  violations: string[];
}

// ==================== 模块级常量 ====================

/** 变量组合数 > 此阈值必须拆解（must-split），见设计文档 §1.1 */
export const MUST_SPLIT_THRESHOLD = 10000;
/** 变量组合数 > 此阈值考虑拆解（consider-split），保留须声明理由，见设计文档 §1.1 */
export const CONSIDER_SPLIT_THRESHOLD = 1000;

/** TLA+ 文件头必须包含的字段（见设计文档 §1.2） */
const REQUIRED_HEADER_FIELDS = [
  'system',
  'requirement',
  'design',
  'parent',
  'sibling',
  'child',
  'level',
  'phase',
] as const;

const VALID_LEVELS: SpecLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const VALID_DECISIONS: DecompositionDecision[] = ['must-split', 'consider-split', 'kept-below-threshold', 'split-done'];

// ==================== 内部工具函数 ====================

/** 判断两个字符串数组是否为同集合（顺序无关）。 */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

/** 由层级字符串（如 "L3"）解析出层级数字；非法返回 -1。 */
function levelNum(level: string): number {
  const m = /^L(\d+)$/.exec(level);
  if (!m || !m[1]) return -1;
  return Number.parseInt(m[1], 10);
}

/**
 * 剥离 TLA+/cfg 注释（§11 要求容忍注释与空白差异）：
 *   - 块注释 `(* ... *)`（可跨行，非贪婪）
 *   - 行注释 `\* ...`（至行尾）
 * 注释内容替换为单个空格，避免注释剥离后相邻 token 粘连。
 */
function stripComments(s: string): string {
  if (typeof s !== 'string' || s.length === 0) return '';
  return s.replace(/\(\*[\s\S]*?\*\)/g, ' ').replace(/\\\*[^\n]*/g, ' ');
}

/**
 * cfg 段落关键字全集（INVARIANTS 列表块的合法终止符，A6 修复 2026-10-06）。
 *
 * 名单来源（两处对照后取并集）：
 *   1. 本仓 tla2tools.jar（w-model-dev/tools/tla2tools.jar，
 *      tlc2/tool/impl/ModelConfig.class 字符串常量，2024-08-08 构建）：
 *      SPECIFICATION / INIT / NEXT / CONSTANT(S) / INVARIANT(S) / PROPERTY(IES) /
 *      CONSTRAINT(S) / ACTION_CONSTRAINT(S) / TYPE_CONSTRAINT / SYMMETRY / VIEW / CHECK_DEADLOCK
 *   2. TLC 官方文档「The Config File」（docs.tlapl.us using:tlc:config_file）及更新版 TLC：
 *      另有 CHECK_FINAL / POSTCONDITION / ALIAS（本仓 jar 未含，保留以兼容新版 TLC 输出的 cfg）。
 * 说明：INVARIANT(S) 另由上方「形式1/形式2」分支优先消费，列入本表为兜底——
 *   裸 `INVARIANT` 行出现在列表块内时正确终止列表，防止关键字被误当不变式名。
 * 段名与后续内容间以词边界分隔（`\\b`），不变式名含同名前缀（如 `Initializer`）不受影响。
 */
const CFG_SECTION_KEYWORDS = [
  'SPECIFICATION',
  'INIT',
  'NEXT',
  'CONSTANT',
  'CONSTANTS',
  'INVARIANT',
  'INVARIANTS',
  'PROPERTY',
  'PROPERTIES',
  'CONSTRAINT',
  'CONSTRAINTS',
  'ACTION_CONSTRAINT',
  'ACTION_CONSTRAINTS',
  'TYPE_CONSTRAINT',
  'SYMMETRY',
  'VIEW',
  'POSTCONDITION',
  'CHECK_DEADLOCK',
  'CHECK_FINAL',
  'ALIAS',
] as const;

/** cfg 段落关键字终止符（大小写不敏感，词边界锚定行首）。 */
const CFG_SECTION_TERMINATOR_RE = new RegExp(`^(${CFG_SECTION_KEYWORDS.join('|')})\\b`, 'i');

/**
 * 解析 .cfg 中的不变式名集合（§11 两种合法形式）：
 *   - 形式1：`INVARIANTS` 关键字后跟列表（同行或后续缩进行）
 *   - 形式2：逐行 `INVARIANT <Name>`（单行单不变式）
 * 列表块在遇到已知 cfg 段落关键字（见 CFG_SECTION_KEYWORDS）或空行时结束。
 *
 * A6（2026-10-06）：终止关键字表原先缺 `PROPERTIES` 等段名，官方 cfg 写法
 * （INVARIANTS 列表后紧跟 PROPERTIES 时序属性段）会把 `PROPERTIES` 与属性名
 * 误当不变式名 → 假 cfgTlaMismatch。已对照完整段名全集一次补齐。
 */
export function parseCfgInvariantNames(cfgContent: string): string[] {
  const names: string[] = [];
  const lines = (cfgContent ?? '').split('\n');
  let inList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      inList = false;
      continue;
    }
    // 形式2：逐行 INVARIANT <Name>（排除 INVARIANTS 关键字行）
    const single = line.match(/^INVARIANT\s+(\S+)/i);
    if (single && single[1] && !/^INVARIANTS\b/i.test(line)) {
      inList = false;
      names.push(single[1]);
      continue;
    }
    // 形式1：INVARIANTS 关键字（同行带名 或 后续行带名）
    const listHead = line.match(/^INVARIANTS\s*(.*)$/i);
    if (listHead) {
      inList = true;
      const rest = listHead[1] ?? '';
      if (rest.trim() !== '') {
        for (const n of rest.split(/[\s,]+/).filter((s) => s.trim() !== '')) {
          names.push(n.trim());
        }
      }
      continue;
    }
    // 列表块内的后续行：已知 cfg 关键字结束列表，否则视为不变式名
    if (inList) {
      if (CFG_SECTION_TERMINATOR_RE.test(line)) {
        inList = false;
        continue;
      }
      for (const n of line.split(/[\s,]+/).filter((s) => s.trim() !== '')) {
        names.push(n.trim());
      }
    }
  }
  return names;
}

// ==================== 文件头解析与校验 ====================

/**
 * 解析 TLA+ 文件头部的结构化注释字段。
 *
 * 文件头形如（docs/tla-plus-modeling-design.md §1.2）：
 *   (*
 *     @system        blog-system
 *     @requirement   REQ-001, REQ-003
 *     @design        docs/requirement-spec.md#§3
 *     @parent        null
 *     @sibling       null
 *     @child         tla/L2-auth.tla, tla/L2-article.tla
 *     @level         L1
 *     @phase         1
 *   *)
 *
 * 规则：
 *   - 扫描内容中所有形如 `@<field> <value>` 的行（块注释 (* ... *) 内或行内均可）
 *   - value 去除首尾空白；值为 "null"（不区分大小写）或空串时记为 null
 *   - 同名字段后出现者覆盖前者（容错）
 *   - 字段名统一转小写
 *
 * @param content .tla 文件文本内容
 * @returns 字段名（不含 @）到值的映射；未出现的字段不在结果中
 */
export function parseTlaHeader(content: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  if (typeof content !== 'string' || content.length === 0) return result;
  const lines = content.split(/\r?\n/);
  const re = /^\s*@([A-Za-z][A-Za-z0-9_-]*)\s+(.*?)\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const name = (m[1] ?? '').toLowerCase();
    const raw = (m[2] ?? '').trim();
    if (raw === '' || raw.toLowerCase() === 'null') {
      result[name] = null;
    } else {
      result[name] = raw;
    }
  }
  return result;
}

/**
 * 校验解析后的文件头字段与 manifest 中 spec 声明是否一致。
 *
 * 校验项：
 *   1. 八个必填字段齐全（system/requirement/design/parent/sibling/child/level/phase）
 *   2. @system 与 spec.system 一致
 *   3. @requirement 逗号分隔列表与 spec.requirementIds 集合一致
 *   4. @design 与 spec.designRef 一致
 *   5. @parent null/非空 与 spec.parent 一致
 *   6. @sibling null/逗号列表 与 spec.siblings 一致
 *   7. @child null/逗号列表 与 spec.children 一致
 *   8. @level 与 spec.level 一致
 *   9. @phase 解析为整数后与 spec.phase 一致
 *
 * @param header parseTlaHeader 的返回值
 * @param spec   manifest 中对应的规格声明
 * @returns 违反消息数组（空数组表示一致）
 */
export function validateHeader(header: Record<string, string | null>, spec: TlaSpec): string[] {
  const violations: string[] = [];
  const id = spec.id ?? '<unknown>';

  // 1. 必填字段齐全
  for (const field of REQUIRED_HEADER_FIELDS) {
    if (!(field in header)) {
      violations.push(`规格 ${id} 文件头缺失字段 @${field}`);
    }
  }

  // 2. @system
  if (header.system != null && header.system !== spec.system) {
    violations.push(`规格 ${id} 文件头 @system="${header.system}" ≠ manifest.system="${spec.system}"`);
  }

  // 3. @requirement（逗号分隔列表，集合须一致）
  if (header.requirement != null) {
    const headerReqs = header.requirement
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const expectedReqs = (spec.requirementIds ?? []).slice();
    if (!sameSet(headerReqs, expectedReqs)) {
      violations.push(
        `规格 ${id} 文件头 @requirement=[${headerReqs.join(',')}] ≠ manifest.requirementIds=[${expectedReqs.join(',')}]`,
      );
    }
  }

  // 4. @design
  if (header.design != null && header.design !== spec.designRef) {
    violations.push(`规格 ${id} 文件头 @design="${header.design}" ≠ manifest.designRef="${spec.designRef}"`);
  }

  // 5. @parent（null ↔ null；非空字符串须相等）
  const expectedParent = spec.parent;
  if (header.parent == null && expectedParent != null) {
    violations.push(`规格 ${id} 文件头 @parent=null 但 manifest.parent="${expectedParent}"`);
  } else if (header.parent != null && expectedParent == null) {
    violations.push(`规格 ${id} 文件头 @parent="${header.parent}" 但 manifest.parent=null`);
  } else if (header.parent != null && expectedParent != null && header.parent !== expectedParent) {
    violations.push(`规格 ${id} 文件头 @parent="${header.parent}" ≠ manifest.parent="${expectedParent}"`);
  }

  // 6. @sibling（null ↔ 空数组；逗号列表集合须一致）
  const expectedSiblings = (spec.siblings ?? []).slice();
  if (header.sibling == null) {
    if (expectedSiblings.length > 0) {
      violations.push(`规格 ${id} 文件头 @sibling=null 但 manifest.siblings 非空 [${expectedSiblings.join(',')}]`);
    }
  } else {
    const headerSibs = header.sibling
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!sameSet(headerSibs, expectedSiblings)) {
      violations.push(
        `规格 ${id} 文件头 @sibling=[${headerSibs.join(',')}] ≠ manifest.siblings=[${expectedSiblings.join(',')}]`,
      );
    }
  }

  // 7. @child（null ↔ 空数组；逗号列表集合须一致）
  const expectedChildren = (spec.children ?? []).slice();
  if (header.child == null) {
    if (expectedChildren.length > 0) {
      violations.push(`规格 ${id} 文件头 @child=null 但 manifest.children 非空 [${expectedChildren.join(',')}]`);
    }
  } else {
    const headerChildren = header.child
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!sameSet(headerChildren, expectedChildren)) {
      violations.push(
        `规格 ${id} 文件头 @child=[${headerChildren.join(',')}] ≠ manifest.children=[${expectedChildren.join(',')}]`,
      );
    }
  }

  // 8. @level
  if (header.level != null && header.level !== spec.level) {
    violations.push(`规格 ${id} 文件头 @level="${header.level}" ≠ manifest.level="${spec.level}"`);
  }

  // 9. @phase（使用 Number+Number.isInteger 拒绝 4x/3.9 等非整数）
  if (header.phase != null) {
    const phaseNum = Number(header.phase);
    if (!Number.isFinite(phaseNum) || !Number.isInteger(phaseNum) || phaseNum !== spec.phase) {
      violations.push(`规格 ${id} 文件头 @phase="${header.phase}" ≠ manifest.phase=${spec.phase}`);
    }
  }

  return violations;
}

// ==================== 层次一致性校验 ====================

/**
 * checkHierarchy 的可选入参：描述「存在于 manifest 但被本次 `--phase` 过滤掉」的路径。
 * 仅影响**措辞**（把「校验范围收窄」与「manifest 未登记」区分开），不改变判定结果——
 * 命中 `filteredOutPaths` 的引用仍计入 violations（仍拦截）。
 */
export interface HierarchyOptions {
  /** 存在于 manifest 但被当前 phase 过滤掉的 tlaPath 集合（由调用方用「全量 ∖ 已校验」构造） */
  filteredOutPaths?: ReadonlySet<string>;
  /** 被过滤路径 → 其 manifest 声明 phase，用于措辞（查不到时只报「属后续阶段」） */
  fullPhaseByPath?: ReadonlyMap<string, number>;
  /** 本次校验的 phase，用于措辞 */
  phase?: number;
}

/**
 * 校验层次一致性（设计文档 §3.1 步骤 3）：
 *   - parent/child 双向：A.parent=B ⇒ B.children 含 A；A.children 含 C ⇒ C.parent=A
 *   - sibling 双向：A.siblings 含 B ⇒ B.siblings 含 A
 *   - 有且仅有一个 L1 根规格（parent=null 且 level=L1）
 *   - 层级单调：子规格 level = 父规格 level + 1
 *
 * 措辞约定（SSoT §10.8 步骤 5 / tla-plus.md「校验步骤」3）：引用路径命中
 * `options.filteredOutPaths` 时（该路径在 manifest 中登记、只是 `spec.phase > 本次 phase`
 * 被过滤掉），报「属后续阶段（phase=N；当前校验 phase=M 不包含它），不算 manifest 缺失」；
 * 未命中（真正未登记）保持原文案「不在 manifest 中（…）」。缺省 `options` 时行为与文案不变。
 *
 * @param specs 待校验的规格数组（通常为 phase 过滤后的子集）
 * @param options 可选的过滤上下文（`filteredOutPaths` / `fullPhaseByPath` / `phase`），仅用于措辞
 * @returns 违反消息数组（空数组表示一致）
 */
export function checkHierarchy(specs: TlaSpec[], options: HierarchyOptions = {}): string[] {
  const violations: string[] = [];
  if (!Array.isArray(specs)) {
    violations.push('checkHierarchy: specs 必须为数组');
    return violations;
  }
  const filteredOut = options.filteredOutPaths ?? new Set<string>();
  const phaseByPath = options.fullPhaseByPath ?? new Map<string, number>();
  const currentPhase = options.phase;
  /** 被 phase 过滤掉的引用路径的措辞：能查到声明 phase 时报具体值，否则退化为「后续阶段」。 */
  const laterPhaseHint = (path: string): string => {
    const declared = phaseByPath.get(path);
    const currentText = currentPhase === undefined ? '当前校验 phase' : `当前校验 phase=${currentPhase}`;
    const inner = declared === undefined ? `${currentText} 不包含它` : `phase=${declared}；${currentText} 不包含它`;
    return `属后续阶段（${inner}）`;
  };
  // 按 tlaPath 索引：manifest 的 parent/children/siblings 字段值均为 tlaPath（非 spec.id）
  const byPath = new Map<string, TlaSpec>();
  for (const s of specs) byPath.set(s.tlaPath, s);

  // 单 L1 根：parent=null 且 level=L1
  const roots = specs.filter((s) => s.parent === null && s.level === 'L1');
  if (roots.length === 0) {
    violations.push(
      '层次校验失败：不存在 L1 根规格（parent=null 且 level=L1；应恰有 1 个根规格作为层次起点，示例：{ id: "L1-system", tlaPath: "tla/L1-system.tla", level: "L1", parent: null }）',
    );
  } else if (roots.length > 1) {
    violations.push(
      `层次校验失败：存在 ${roots.length} 个 L1 根规格（应为 1）：${roots.map((r) => r.id).join(', ')}（修法：保留单一系统根，其余规格改挂到 L1 根之下或合并）`,
    );
  }

  for (const s of specs) {
    // parent → child 双向 + 层级单调
    if (s.parent != null) {
      const parent = byPath.get(s.parent);
      if (!parent) {
        if (filteredOut.has(s.parent)) {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 parent="${s.parent}" ${laterPhaseHint(s.parent)}，不算 manifest 缺失`,
          );
        } else {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 parent="${s.parent}" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，示例：parent: "tla/L1-system.tla"）`,
          );
        }
      } else if (!(parent.children ?? []).includes(s.tlaPath)) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 parent="${s.parent}"，但 parent.children 未包含 ${s.tlaPath}（应在 parent 规格的 children 数组中补登 "${s.tlaPath}"，保持双向一致）`,
        );
      } else {
        const parentLevelNum = levelNum(parent.level);
        const childLevelNum = levelNum(s.level);
        if (parentLevelNum > 0 && childLevelNum > 0 && childLevelNum !== parentLevelNum + 1) {
          violations.push(
            `层次校验失败：规格 ${s.id} level=${s.level} ≠ parent(${parent.id}) level ${parent.level} + 1（应为相邻层级，示例：parent 为 L1 时子规格 level 填 "L2"）`,
          );
        }
      }
    }

    // child → parent 双向
    for (const childPath of s.children ?? []) {
      const child = byPath.get(childPath);
      if (!child) {
        if (filteredOut.has(childPath)) {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 child="${childPath}" ${laterPhaseHint(childPath)}，不算 manifest 缺失`,
          );
        } else {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 child="${childPath}" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，或删除该失效 child 引用）`,
          );
        }
      } else if (child.parent !== s.tlaPath) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 child="${childPath}"，但 ${childPath}.parent="${child.parent}" ≠ "${s.tlaPath}"（应将 ${childPath} 的 parent 修正为 "${s.tlaPath}"，保持双向一致）`,
        );
      }
    }

    // sibling 双向
    for (const sibPath of s.siblings ?? []) {
      const sib = byPath.get(sibPath);
      if (!sib) {
        if (filteredOut.has(sibPath)) {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 sibling="${sibPath}" ${laterPhaseHint(sibPath)}，不算 manifest 缺失`,
          );
        } else {
          violations.push(
            `层次校验失败：规格 ${s.id} 的 sibling="${sibPath}" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，或删除该失效 sibling 引用）`,
          );
        }
      } else if (!(sib.siblings ?? []).includes(s.tlaPath)) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 sibling="${sibPath}"，但 ${sibPath}.siblings 未包含 ${s.tlaPath}（应在 ${sibPath} 的 siblings 数组中补登 "${s.tlaPath}"，保持双向一致）`,
        );
      }
    }
  }
  return violations;
}

// ==================== 拆解决策校验 ====================

/**
 * 校验拆解决策（设计文档 §3.1 步骤 4 / §1.1）：
 *   - variableCombination > MUST_SPLIT_THRESHOLD(10000) 必须 decompositionDecision='split-done'，
 *     否则为违反（导致失败）
 *   - variableCombination > CONSIDER_SPLIT_THRESHOLD(1000) 且 decompositionDecision='kept-below-threshold'
 *     为警告（不导致失败，仅提示补充理由或拆解）
 *   - B9（批次 7）：variableCombination > CONSIDER_SPLIT_THRESHOLD(1000) 且保留未拆（kept-below-threshold）
 *     时必须附推导注记 variableCombinationBasis（各变量 {name, cardinality}），且
 *     Πcardinality === 声明的 variableCombination 字段值；缺注记 / 基数非法 / 乘积不符均为 violation。
 *     ≤1000 不要求。
 *
 * @param specs 待校验的规格数组
 * @returns { violations, warnings }
 */
export function checkDecomposition(specs: TlaSpec[]): { violations: string[]; warnings: string[] } {
  const violations: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(specs)) {
    violations.push('checkDecomposition: specs 必须为数组');
    return { violations, warnings };
  }
  for (const s of specs) {
    const combo = typeof s.variableCombination === 'number' ? s.variableCombination : 0;
    if (combo > MUST_SPLIT_THRESHOLD && s.decompositionDecision !== 'split-done') {
      violations.push(
        `拆解校验失败：规格 ${s.id} variableCombination=${combo} > ${MUST_SPLIT_THRESHOLD}，须 decompositionDecision='split-done'，实际为 '${s.decompositionDecision}'`,
      );
    }
    if (combo > CONSIDER_SPLIT_THRESHOLD && s.decompositionDecision === 'kept-below-threshold') {
      warnings.push(
        `拆解警告：规格 ${s.id} variableCombination=${combo} > ${CONSIDER_SPLIT_THRESHOLD} 且保留未拆（kept-below-threshold），建议补充理由或拆解`,
      );
      // B9：>1000 kept 须附推导注记，且 Πcardinality === 声明 variableCombination（乘积可复核）
      const basis = s.variableCombinationBasis;
      const variables = basis?.variables;
      if (!basis || !Array.isArray(variables) || variables.length === 0) {
        violations.push(
          `拆解校验失败：规格 ${s.id} variableCombination=${combo} > ${CONSIDER_SPLIT_THRESHOLD} 且保留未拆（kept-below-threshold），缺少推导注记 variableCombinationBasis（须声明各变量 {name, cardinality}，且 Πcardinality === 声明值 ${combo}）`,
        );
      } else {
        const invalid = variables.filter(
          (v) => typeof v?.cardinality !== 'number' || !Number.isFinite(v.cardinality) || v.cardinality < 1,
        );
        if (invalid.length > 0) {
          violations.push(
            `拆解校验失败：规格 ${s.id} variableCombinationBasis.variables 含非法 cardinality（须为 ≥1 的有限数，实际 ${invalid
              .map((v) => JSON.stringify(v?.cardinality))
              .join(', ')}）`,
          );
        } else {
          const product = variables.reduce((acc, v) => acc * v.cardinality, 1);
          if (product !== combo) {
            violations.push(
              `拆解校验失败：规格 ${s.id} variableCombinationBasis 推导不符：Πcardinality=${product} ≠ 声明 variableCombination=${combo}（>1000 保留未拆须附推导注记且乘积与声明值一致）`,
            );
          }
        }
      }
    }
  }
  return { violations, warnings };
}

// ==================== SD 覆盖率 / cfg 一致性 / cfg 结构校验 ====================

/**
 * SD 覆盖率校验（tla-plus.md §3 / §10）：
 *   - P1.2 spec 方向校验（全规格强制，无例外）：每个 spec 须满足
 *       1. requirementIds 非空数组
 *       2. requirementIds 含至少一个 SD-xxx 标识（正则 `/^SD-/`）
 *     违反 → violation，明确指出问题 spec
 *   - SD 被覆盖方向校验（§10）：每个 SD 节点须被至少一个 TLA+ spec 覆盖；未覆盖 → violation
 *   - 覆盖判定（满足任一）：
 *       1. spec.requirementIds 含该 SD 关联的 REQ ID（操作化口径：rid 与 sd 互为子串）
 *       2. spec.designRef 引用该 SD 对应设计文档（designRef 字符串含 sd）
 *
 * 边界：graphSdNodes 为空数组或 undefined 时由调用方跳过（不进入本函数）。
 *
 * @param specs        待校验的规格数组（通常为 phase 过滤后的子集）
 * @param graphSdNodes graph.json 中所有 type=SD 节点的 ID 列表
 * @returns { passed, violations }
 */
export function checkCoverage(specs: TlaSpec[], graphSdNodes: string[]): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  if (!Array.isArray(specs) || !Array.isArray(graphSdNodes)) {
    violations.push('checkCoverage: specs 与 graphSdNodes 必须为数组');
    return { passed: false, violations };
  }

  // P1.2 新增：spec 方向校验（每个 spec 须含 SD 标识，全规格无例外）
  for (const spec of specs) {
    if (!Array.isArray(spec.requirementIds) || spec.requirementIds.length === 0) {
      violations.push(`规格 ${spec.id} 缺 requirementIds（SD 覆盖强制，全规格无例外）`);
      continue;
    }
    const hasSdId = spec.requirementIds.some((rid) => /^SD-/.test(rid));
    if (!hasSdId) {
      violations.push(`规格 ${spec.id} requirementIds 无 SD 标识（须含至少一个 SD-xxx，全规格无例外）`);
    }
  }

  // 保留：SD 被覆盖方向校验（现有逻辑不动）
  const coveredSds = new Set<string>();
  for (const spec of specs) {
    for (const sd of graphSdNodes) {
      if (
        (spec.requirementIds ?? []).some((rid) => sd.includes(rid) || rid.includes(sd)) ||
        (typeof spec.designRef === 'string' && spec.designRef.includes(sd))
      ) {
        coveredSds.add(sd);
      }
    }
  }
  const uncovered = graphSdNodes.filter((sd) => !coveredSds.has(sd));
  if (uncovered.length > 0) {
    violations.push(`以下 SD 节点未被任何 TLA+ spec 覆盖: ${uncovered.join(', ')}`);
  }
  return { passed: violations.length === 0, violations };
}

/**
 * cfg-tla 不变式一致性校验（tla-plus.md §11）：
 *   - .cfg 的 INVARIANTS 列表须与 .tla 中 BusinessInvariant 展开的子不变式集合**完全相等**
 *   - .tla 中 `BusinessInvariant == /\ Inv1 /\ Inv2` → 展开集合 {Inv1, Inv2}
 *   - 解析前剥离 `\*` 行注释与 `(* *)` 块注释及多余空白，再做集合比较
 *   - .cfg 缺失或多余不变式 → violation
 *
 * @param tlaContent .tla 文件文本内容
 * @param cfgContent .cfg 文件文本内容
 * @returns { passed, violations }
 */
export function checkCfgInvariantsConsistency(
  tlaContent: string,
  cfgContent: string,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const tla = stripComments(tlaContent ?? '');
  const cfg = stripComments(cfgContent ?? '');

  // 1. 展开 .tla 中 BusinessInvariant/Invariants 的子不变式集合
  const tlaInvariants = new Set<string>();
  const bizMatch = tla.match(/(?:BusinessInvariant|Invariants)\s*==\s*([\s\S]*?)(?=\n\s*====|\n\s*[A-Z][\w]*\s*==|$)/);
  if (bizMatch && bizMatch[1]) {
    const invRegex = /\/\\\s*([A-Za-z_]\w*)/g;
    let m: RegExpExecArray | null;
    const bizContent = bizMatch[1];
    while ((m = invRegex.exec(bizContent)) !== null) {
      if (m[1]) tlaInvariants.add(m[1]);
    }
  }

  // 2. 解析 .cfg 的不变式集合（支持 INVARIANTS 关键字后跟列表 与 逐行 INVARIANT <Name> 两种形式）
  const cfgInvariants = new Set<string>();
  for (const n of parseCfgInvariantNames(cfg)) cfgInvariants.add(n);

  // 3. 集合比较（双向差集）
  const missing = [...tlaInvariants].filter((i) => !cfgInvariants.has(i));
  const extra = [...cfgInvariants].filter((i) => !tlaInvariants.has(i));
  if (missing.length > 0) violations.push(`.cfg 缺失不变式: ${missing.join(', ')}`);
  if (extra.length > 0) violations.push(`.cfg 多余不变式: ${extra.join(', ')}`);
  return { passed: violations.length === 0, violations };
}

/**
 * cfg 结构校验（tla-plus.md §12）：
 *   - .cfg 禁止含 `---- MODULE <Name> ----`（.tla 头部语法，混入 .cfg 触发 TLC 解析错误）
 *   - INVARIANT 行格式：`INVARIANT <Name>`（单行单不变式）或 `INVARIANTS` 关键字后跟列表
 *   - 返回不变式数量计数供跨产物交叉校验
 *
 * @param cfgContent .cfg 文件文本内容
 * @returns { passed, violations, invariantCount }
 */
export function checkCfgStructure(cfgContent: string): {
  passed: boolean;
  violations: string[];
  invariantCount: number;
} {
  const violations: string[] = [];
  const content = typeof cfgContent === 'string' ? cfgContent : '';

  // 1. 禁止 MODULE 声明
  if (/----\s*MODULE\s/m.test(content)) {
    violations.push('.cfg 含 MODULE 声明（这是 .tla 语法，.cfg 不应包含）');
  }

  // 2. INVARIANT 行格式校验（单行 INVARIANT 无不变式名 → 缺少不变式名）
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (/^INVARIANT\s*$/i.test(line)) {
      violations.push(`.cfg 第 ${i + 1} 行 INVARIANT 缺少不变式名: "${line}"`);
    }
  }

  // 3. 不变式数量计数（供跨产物交叉校验，§12）
  const invariantCount = parseCfgInvariantNames(content).length;

  return { passed: violations.length === 0, violations, invariantCount };
}

// ==================== B1 恒真/空洞不变式防御 + B10c CONSTRAINT 禁用（批次 7 任务 3） ====================

/** 定义体归一化（trim + 折叠空白），用于 B1b/B1c 的语法等价比对。 */
function normalizeDefBody(body: string): string {
  return body.trim().replace(/\s+/g, ' ');
}

/**
 * 从 .tla 文本提取顶层定义 `Name ==` 的定义体（到下一顶层定义 / 模块终止符 ==== / EOF）。
 * 提取前剥离 `(* *)` 块注释与 `\*` 行注释；找不到该定义返回 null
 * （cfg 声明了 .tla 不存在的名字时由 §11 cfg-tla 集合一致性另行拦截，此处静默跳过）。
 */
export function extractTlaDefBody(tlaContent: string, name: string): string | null {
  if (typeof tlaContent !== 'string' || tlaContent === '' || name === '') return null;
  const tla = stripComments(tlaContent);
  const lines = tla.split('\n');
  // 静态模式 + 前缀字面量比对，取代「按名字转义后 new RegExp」：名字取自 cfg 解析（已 trim 的非空白
  // token），「剥行首空白 → 字面量前缀相等 → 余部匹配 `\s*==(.*)`」与转义名正则逐字节等价
  //（差分验证 0 分歧），且名字中的正则元字符不再参与正则解释。
  const defBodyRe = /^\s*==(.*)$/;
  const nextDefRe = /^[ \t]*[A-Za-z][A-Za-z0-9_]*\s*==/;
  // 迭代一律不得复现 checkCfgStructure「cfg 结构：裸 INVARIANT」块的 i 循环头文本：该文本被
  // tla-logic-rule-loadbearing.test.ts 用作剥离锚点并要求源码内唯一，本函数任何行（含注释）都不得
  // 复现它。entries()/slice() 既满足该约束，也消除动态下标取值（object-injection 面）。
  for (const [defIdx, rawLine] of lines.entries()) {
    const head = rawLine.replace(/^[ \t]*/, '');
    if (!head.startsWith(name)) continue;
    const m = head.slice(name.length).match(defBodyRe);
    if (!m) continue;
    const bodyLines: string[] = [m[1] ?? ''];
    for (const line of lines.slice(defIdx + 1)) {
      if (/^[ \t]*====/.test(line)) break; // 模块终止符 ====
      if (nextDefRe.test(line)) break; // 下一顶层定义
      bodyLines.push(line);
    }
    return bodyLines.join('\n');
  }
  return null;
}

/**
 * B1 恒真/空洞不变式防御 + B10c CONSTRAINT 禁用（批次 7 任务 3，cfg 一致性检查区）。
 *
 * B1：恒真/空洞不变式防御。业务不变式 = cfg INVARIANTS 中名字不以 'Type' 开头者。
 * ①须 ≥1 条；②定义体归一化后（trim + 折叠空白）不得为 'TRUE'，
 * ③不得与任一 Type 类不变式定义体相同（同规格内比对）。
 * B10c：cfg 出现 CONSTRAINT/CONSTRAINTS 段名 → 违规（状态空间砍削掩盖死锁/爆炸，
 * 正道是规格拆解——反模式 #16 家族）。
 *
 * 判定细节：
 *   - B1a 仅在 cfg 声明了不变式（INVARIANTS/INVARIANT 解析非空）时评估——cfg 未声明任何
 *     不变式（如纯死锁冒烟规格）不属「全 Type 类」空洞形态，不在此拦截。
 *   - B1b/B1c 的定义体经 extractTlaDefBody 从 .tla 提取后归一化比较；提取不到定义体的
 *     名字跳过（§11 集合一致性已另行拦截「.tla 缺失/多余」）。
 *   - B10c 词边界锚定行首（`^(CONSTRAINT|CONSTRAINTS)\b`，大小写不敏感），
 *     ACTION_CONSTRAINT / TYPE_CONSTRAINT 等其余段名不命中。
 *
 * @param tlaContent .tla 文件文本内容（定义体提取来源）
 * @param cfgContent .cfg 文件文本内容（INVARIANTS 名单与 CONSTRAINT 段检测来源）
 * @returns { passed, violations }
 */
export function checkBusinessInvariants(
  tlaContent: string,
  cfgContent: string,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const tla = typeof tlaContent === 'string' ? tlaContent : '';
  const cfg = stripComments(cfgContent ?? '');

  // B10c：cfg 出现 CONSTRAINT/CONSTRAINTS 段名 → 违规
  const cfgLines = cfg.split('\n');
  for (const [lineIdx, rawLine] of cfgLines.entries()) {
    const line = rawLine.trim();
    const m = line.match(/^(CONSTRAINT|CONSTRAINTS)\b/i);
    if (m && m[1]) {
      violations.push(
        `.cfg 第 ${lineIdx + 1} 行含 ${m[1].toUpperCase()} 段（CONSTRAINT/CONSTRAINTS 禁用）：不得用约束砍状态空间掩盖死锁/爆炸，正道是规格拆解（反模式 #16 家族）`,
      );
    }
  }

  // B1：业务不变式 = cfg INVARIANTS 中名字不以 'Type' 开头者
  const names = [...new Set(parseCfgInvariantNames(cfg))];
  if (names.length === 0) {
    // cfg 未声明任何不变式：B1a 针对的是「声明了不变式但全部为 Type 类」的空洞形态
    return { passed: violations.length === 0, violations };
  }
  const business = names.filter((n) => !n.startsWith('Type'));
  const typeInvariants = names.filter((n) => n.startsWith('Type'));

  // ①须 ≥1 条业务不变式
  if (business.length === 0) {
    violations.push(
      `缺非 Type 业务不变式：cfg INVARIANTS 全为 Type 类不变式（${names.join(', ')}），至少须 1 条名字不以 Type 开头的业务不变式`,
    );
    return { passed: false, violations };
  }

  // ②③定义体归一化比对（同规格内）
  const normalizedBodies = new Map<string, string>();
  for (const n of names) {
    const body = extractTlaDefBody(tla, n);
    if (body != null) normalizedBodies.set(n, normalizeDefBody(body));
  }
  for (const n of business) {
    const body = normalizedBodies.get(n);
    if (body === undefined) continue; // 定义体提取不到 → 由 §11 集合一致性拦截
    // ②不得为恒真
    if (body === 'TRUE') {
      violations.push(`业务不变式 ${n} 定义体恒真（归一化后为 TRUE）：恒真不变式不构成验证`);
    }
    // ③不得与任一 Type 类不变式定义体相同
    for (const t of typeInvariants) {
      const tBody = normalizedBodies.get(t);
      if (tBody !== undefined && tBody === body) {
        violations.push(
          `业务不变式 ${n} 定义体与 Type 类不变式 ${t} 定义体相同（同规格内比对）：Type 类校验不能替代业务不变式`,
        );
      }
    }
  }
  return { passed: violations.length === 0, violations };
}

// ==================== B10 空转 Next 检测（批次 7 任务 7） ====================

/**
 * 解析 .cfg 中 NEXT 段声明的 Next 操作符名（INIT/NEXT 形式，段名大小写不敏感）。
 * 解析前先剥离 `(* *)` 块注释与 `\*` 行注释——注释中的 NEXT 字样不产生幻影名
 * （函数自含剥注释，调用方无需预处理；stripComments 幂等，重复剥离无害）。
 * SPECIFICATION Spec 形式无 NEXT 段 → 返回 []（Next 由 Spec 间接引用，空转检测不适用）。
 * 每个NEXT 行取段名后首个 token 为操作符名；裸 NEXT 行（无名字）跳过（由 SANY / TLC 报 cfg 错误）。
 */
export function parseCfgNextNames(cfgContent: string): string[] {
  const names: string[] = [];
  for (const rawLine of stripComments(cfgContent ?? '').split('\n')) {
    const m = rawLine.trim().match(/^NEXT\s+(\S+)/i);
    if (m && m[1]) names.push(m[1]);
  }
  return names;
}

/**
 * B10 空转 Next 检测（批次 7 任务 7；修复轮 1 收敛为跨定义体合取聚合 + 多 NEXT 聚合判定）。
 *
 * 退化解形态：`Next == x' = x`（全恒等自赋值）或 `Next == TRUE / UNCHANGED x`
 * （无任何状态赋值）——状态永不变化，TLC 永不死锁、不变式恒成立，
 * 「验证通过」不构成任何行为保证（反模式 #16：TLA+ 占位/简化实现）。
 *
 * 逐名判定（Next 定义体归一化后，含传递引用闭包；跨定义体按合取聚合——子定义体
 * 以 `/\` 并入闭包文本，分解式 `Next == A /\ B`（A、B 均恒等）与一级/多级间接
 * 引用 `Next == A`（A == x' = x）与单体直写形态判定一致）：
 *   - 闭包无任何 `var' =` 状态赋值 → 该名空转候选；
 *   - 闭包内全部状态赋值均为恒等自赋值（逐顶层合取/析取子句整句匹配 var' = var）
 *     → 该名空转候选；
 *   - 存在任一非恒等赋值 → 该名推进。
 *
 * 多 NEXT 聚合（TLC 对 cfg 多 NEXT 行取合取）：全部可判定名均为空转候选才 violation
 * 「空转规格」；任一名推进 → 合取整体推进，不违规（保守方向，防误报优先）。
 *
 * 判定细节：
 *   - 状态赋值形态计 `var' =`（确定性）与 `var' \in`（非确定性）两种——`Next == x' \in 0..10`
 *     是真实推进，不属空转。
 *   - 引用闭包：Next 定义体内引用的标识符若为 .tla 顶层定义（`Name ==`），其定义体递归并入
 *     （防 `Next == A \/ B` 子动作形态误报）；提取不到定义体的标识符（变量 / 常量 / 内置算子）
 *     跳过。visited 集防循环引用。
 *   - cfg 无 NEXT 段（SPECIFICATION Spec 形式）→ 本检测不适用，跳过。
 *   - cfg 声明的 Next 名在 .tla 无定义 / 闭包为空 → 该名不可判定（§11 集合一致性 / SANY
 *     另行拦截），聚合时按不违规处理。
 *   - 子句切分按归一化文本的字面 `/\`（合取）与 `\/`（析取）；括号包裹的复合子句不匹配
 *     恒等式 → 计为非恒等，同样走保守不误报方向。
 *
 * @param tlaContent .tla 文件文本内容（定义体提取来源）
 * @param cfgContent .cfg 文件文本内容（NEXT 段解析来源）
 * @returns { passed, violations }
 */
export function checkIdleNext(tlaContent: string, cfgContent: string): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const tla = typeof tlaContent === 'string' ? tlaContent : '';
  const cfg = stripComments(cfgContent ?? '');

  // 多 NEXT 聚合判定（TLC 对 cfg 多 NEXT 行取合取）：逐名收集空转候选，任一名推进即整体推进
  const idleCandidates: string[] = [];
  let anyProgressing = false;
  let anyUndecidable = false;
  for (const nextName of parseCfgNextNames(cfg)) {
    // 传递引用闭包（visited 防循环）
    const visited = new Set<string>([nextName]);
    const bodies: string[] = [];
    const queue: string[] = [nextName];
    while (queue.length > 0) {
      const name = queue.shift();
      if (name === undefined) break;
      const body = extractTlaDefBody(tla, name);
      if (body == null) continue; // 定义缺失：由 §11 集合一致性 / SANY 拦截，此处跳过
      bodies.push(normalizeDefBody(body));
      for (const ident of body.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        if (!visited.has(ident)) {
          visited.add(ident);
          queue.push(ident);
        }
      }
    }
    // 跨定义体按合取聚合：子定义体以 `/\` 并入闭包文本，与「多 NEXT 行取合取」同向保守
    // （空格拼接无法恢复子句边界，分解式 `Next == A /\ B` 会整块失配恒等式 → 漏报）
    const closure = normalizeDefBody(bodies.join(' /\\ '));
    if (closure === '') {
      // Next 定义体为空 / 提取不到：该名不可判定，聚合时按不违规处理（SANY / §11 另行拦截）
      anyUndecidable = true;
      continue;
    }

    // 顶层合取/析取子句切分（归一化文本；`/\` 合取与 `\/` 析取字面）
    const conjuncts = closure
      .split(/\/\\|\\\//g)
      .map((s) => s.trim())
      .filter((s) => s !== '');

    let assignmentCount = 0;
    let allIdentity = true;
    for (const c of conjuncts) {
      // 非赋值子句（UNCHANGED / 纯谓词）不提供推进信息；var' \in 计赋值（非确定性推进）
      if (!/[A-Za-z_][A-Za-z0-9_]*'\s*(?:=|\\in)/.test(c)) continue;
      assignmentCount += 1;
      const m = c.match(/^([A-Za-z_][A-Za-z0-9_]*)'\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!(m && m[1] === m[2])) allIdentity = false;
    }
    if (assignmentCount === 0) {
      idleCandidates.push(
        `空转规格：NEXT ${nextName} 定义体（含引用闭包）归一化后无任何 var' = 状态赋值（如 Next == TRUE / UNCHANGED x）：状态永不变化，验证不构成行为（反模式 #16）`,
      );
    } else if (allIdentity) {
      idleCandidates.push(
        `空转规格：NEXT ${nextName} 的全部状态赋值均为恒等自赋值 var' = var（如 Next == x' = x）：状态永不变化，验证不构成行为（反模式 #16）`,
      );
    } else {
      anyProgressing = true;
    }
  }
  // 聚合出口：全部可判定名均空转候选才违规；任一名推进 / 存在不可判定名 → 不违规（防误报优先）
  if (!anyProgressing && !anyUndecidable) violations.push(...idleCandidates);
  return { passed: violations.length === 0, violations };
}

// ==================== 规格字段结构校验 ====================

/** 校验单个 spec 的字段类型与取值合法性，返回违反消息数组。 */
function validateSpec(raw: unknown, index: number): string[] {
  const v: string[] = [];
  if (!raw || typeof raw !== 'object') {
    v.push(`manifest.specs[${index}] 必须为对象`);
    return v;
  }
  const s = raw as Record<string, unknown>;
  const id = typeof s.id === 'string' ? s.id : `<specs[${index}]>`;

  if (typeof s.id !== 'string' || s.id.trim() === '') {
    v.push(`manifest.specs[${index}].id 必须为非空字符串`);
  }
  if (!VALID_LEVELS.includes(s.level as SpecLevel)) {
    v.push(`规格 ${id} level 必须为 ${VALID_LEVELS.join('/')}，实际为 ${JSON.stringify(s.level)}`);
  }
  if (typeof s.phase !== 'number' || !Number.isInteger(s.phase)) {
    v.push(`规格 ${id} phase 必须为整数，实际为 ${JSON.stringify(s.phase)}`);
  }
  if (typeof s.system !== 'string' || s.system.trim() === '') {
    v.push(`规格 ${id} system 必须为非空字符串`);
  }
  if (!Array.isArray(s.requirementIds)) {
    v.push(`规格 ${id} requirementIds 必须为数组`);
  }
  if (typeof s.designRef !== 'string') {
    v.push(`规格 ${id} designRef 必须为字符串`);
  }
  if (typeof s.tlaPath !== 'string' || s.tlaPath.trim() === '') {
    v.push(`规格 ${id} tlaPath 必须为非空字符串`);
  }
  if (typeof s.cfgPath !== 'string' || s.cfgPath.trim() === '') {
    v.push(`规格 ${id} cfgPath 必须为非空字符串`);
  }
  if (s.parent !== null && typeof s.parent !== 'string') {
    v.push(`规格 ${id} parent 必须为 string 或 null，实际为 ${JSON.stringify(s.parent)}`);
  }
  if (!Array.isArray(s.siblings)) {
    v.push(`规格 ${id} siblings 必须为数组`);
  }
  if (!Array.isArray(s.children)) {
    v.push(`规格 ${id} children 必须为数组`);
  }
  if (
    typeof s.variableCombination !== 'number' ||
    !Number.isFinite(s.variableCombination) ||
    s.variableCombination < 0
  ) {
    v.push(`规格 ${id} variableCombination 必须为非负有限数`);
  }
  if (!VALID_DECISIONS.includes(s.decompositionDecision as DecompositionDecision)) {
    v.push(
      `规格 ${id} decompositionDecision 必须为 ${VALID_DECISIONS.join('/')}，实际为 ${JSON.stringify(s.decompositionDecision)}`,
    );
  }
  if (typeof s.syntaxChecked !== 'boolean') {
    v.push(`规格 ${id} syntaxChecked 必须为布尔值`);
  }
  if (typeof s.tlcChecked !== 'boolean') {
    v.push(`规格 ${id} tlcChecked 必须为布尔值`);
  }
  if (typeof s.deadlockFree !== 'boolean') {
    v.push(`规格 ${id} deadlockFree 必须为布尔值`);
  }
  if (typeof s.invariantsHold !== 'boolean') {
    v.push(`规格 ${id} invariantsHold 必须为布尔值`);
  }
  if (typeof s.stateExplosion !== 'boolean') {
    v.push(`规格 ${id} stateExplosion 必须为布尔值`);
  }
  return v;
}

// ==================== 主校验入口 ====================

/**
 * TLA+ 模型校验主入口（纯逻辑，单点事实源）。
 *
 * 校验 manifest 结构 + 规格字段 + 层次一致性 + 拆解决策 + 声明的 SANY/TLC 结果标志
 *   + SD 覆盖率 + cfg-tla 一致性 + cfg 结构。
 * 不执行 I/O（读文件、跑 SANY/TLC 由 CLI 完成）。
 *
 * 校验项：
 *   1. manifest 顶层结构：version/currentPhase/tools(specs 前置)/specs 数组
 *   2. 每个 spec（phase ≤ 入参 phase）的字段类型与取值合法性
 *   3. 声明的结果标志：
 *      - syntaxChecked=false ⇒ syntaxErrors（SANY 必须通过）
 *      - tlcChecked=false ⇒ 违反；deadlockFree=false ⇒ deadlockViolations；
 *        invariantsHold=false ⇒ invariantViolations；stateExplosion=true ⇒ stateExplosionSpecs
 *   4. 层次一致性（checkHierarchy）
 *   5. 拆解决策（checkDecomposition，警告不导致失败）
 *   6. SD 覆盖率（checkCoverage，§10）：manifest.graphSdNodes 非空时执行，未覆盖 SD → coverageViolations
 *   7. cfg-tla 一致性 + cfg 结构（§11/§12）：spec 含 tlaContent/cfgContent 时执行，
 *      不变式集合不一致 → cfgConsistencyViolations；MODULE 声明/格式错误 → cfgStructureViolations
 *   8. per-spec TLC 执行状态（result.specs，A7）：tlcStatus ∈ passed/failed/notRun，
 *      SANY 失败 ⇒ notRun 且 reasons 只含「TLC 未执行（SANY 语法检查失败）：<首因>」，
 *      不复述 manifest 预置的死锁/不变式/状态爆炸布尔（TLC 未跑时它们不构成事实）
 *
 * 注意：headerViolations / environmentOk / environmentErrors 在纯逻辑中分别留空 / 置真 / 置空，
 *   由 CLI 在执行文件头解析与环境检查后回填，并重算 passed。
 *
 * @param manifest tla-manifest.json 解析后的对象（可选内嵌 graphSdNodes / spec.tlaContent / spec.cfgContent）
 * @param phase    校验阶段，仅校验 spec.phase ≤ phase 的规格
 * @returns TlaCheckResult
 */

/**
 * R13 checkRounds schema 校验。
 *
 * 语义权威定义见 tla-plus.md §checkRounds 字段语义：
 * checkRounds 数组记录每次 TLA+ 校验轮次的结果（spec 级返工记录），
 * 用于追踪返工收敛趋势。每条元素对应一次 spec 的 TLA+ 校验轮次（specId 标识），
 * 不是 phase 级摘要（phase 级摘要应写在 run-log.jsonl 的 note 字段）。
 *
 * 校验规则：
 *   - checkRounds 可选，缺省视为 []（合法）
 *   - 必须是数组（非数组 → R13 违反）
 *   - 每个元素须含全部必填字段：phase / round / specId / syntaxCheck / tlcCheck / violations / converged
 *     （timestamp 可选）
 *   - 字段类型校验：
 *     - phase: number ∈ [1, 8]
 *     - round: number ≥ 1
 *     - specId: 非空字符串
 *     - syntaxCheck / tlcCheck / converged: boolean
 *     - violations: string[]（与 tla-logic.ts TlaManifest.checkRounds 类型定义一致）
 *   - 禁止字段：元素不得含 phaseSummary / summary / phaseDecisions / phaseLevelSummary 等
 *     phase 级摘要字段（命中 → R13 违反）
 *
 * 关联：
 *   - tla-plus.md §checkRounds（语义权威）
 *   - data-models.md tla-manifest.json 节字段表（指向 tla-plus.md）
 */
export function checkRoundsSchema(manifest: Partial<TlaManifest>): string[] {
  const violations: string[] = [];
  const cr = manifest.checkRounds;
  if (cr === undefined) return violations; // 可选缺省合法
  if (!Array.isArray(cr)) {
    violations.push(`R13: checkRounds 必须是数组，实际为 ${typeof cr}`);
    return violations;
  }
  const REQUIRED_FIELDS = ['phase', 'round', 'specId', 'syntaxCheck', 'tlcCheck', 'violations', 'converged'] as const;
  const FORBIDDEN_FIELDS = ['phaseSummary', 'summary', 'phaseDecisions', 'phaseLevelSummary'] as const;
  cr.forEach((entry: unknown, i: number) => {
    if (typeof entry !== 'object' || entry === null) {
      violations.push(`R13: checkRounds[${i}] 必须是对象，实际为 ${typeof entry}`);
      return;
    }
    const e = entry as Record<string, unknown>;
    // 必填字段检查
    for (const f of REQUIRED_FIELDS) {
      if (!(f in e)) {
        violations.push(`R13: checkRounds[${i}] 缺必填字段 ${f}`);
      }
    }
    // 字段类型检查
    if (typeof e.phase !== 'number' || e.phase < 1 || e.phase > 8) {
      violations.push(`R13: checkRounds[${i}].phase 须为 number ∈ [1,8]，实际为 ${JSON.stringify(e.phase)}`);
    }
    if (typeof e.round !== 'number' || e.round < 1) {
      violations.push(`R13: checkRounds[${i}].round 须为 number ≥ 1，实际为 ${JSON.stringify(e.round)}`);
    }
    if (typeof e.specId !== 'string' || e.specId.trim() === '') {
      violations.push(`R13: checkRounds[${i}].specId 须为非空字符串，实际为 ${JSON.stringify(e.specId)}`);
    }
    if (typeof e.syntaxCheck !== 'boolean') {
      violations.push(`R13: checkRounds[${i}].syntaxCheck 须为 boolean，实际为 ${typeof e.syntaxCheck}`);
    }
    if (typeof e.tlcCheck !== 'boolean') {
      violations.push(`R13: checkRounds[${i}].tlcCheck 须为 boolean，实际为 ${typeof e.tlcCheck}`);
    }
    if (typeof e.converged !== 'boolean') {
      violations.push(`R13: checkRounds[${i}].converged 须为 boolean，实际为 ${typeof e.converged}`);
    }
    if (!Array.isArray(e.violations) || e.violations.some((v: unknown) => typeof v !== 'string')) {
      violations.push(
        `R13: checkRounds[${i}].violations 须为 string[]，实际为 ${Array.isArray(e.violations) ? '含非字符串元素' : typeof e.violations}`,
      );
    }
    // 禁止字段检查（phase 级摘要字段）
    for (const f of FORBIDDEN_FIELDS) {
      if (f in e) {
        violations.push(`R13: checkRounds[${i}] 含禁止字段 ${f}（phase 级摘要字段，checkRounds 为 spec 级返工记录）`);
      }
    }
  });
  return violations;
}

export function checkTlaModel(manifest: unknown, phase: number): TlaCheckResult {
  const result: TlaCheckResult = {
    passed: false,
    phase,
    totalSpecs: 0,
    checkedSpecs: 0,
    specs: [],
    headerViolations: [],
    hierarchyViolations: [],
    decompositionViolations: [],
    syntaxErrors: [],
    deadlockViolations: [],
    invariantViolations: [],
    stateExplosionSpecs: [],
    coverageViolations: [],
    cfgConsistencyViolations: [],
    cfgStructureViolations: [],
    checkRoundsViolations: [],
    environmentOk: true,
    environmentErrors: [],
    violations: [],
  };

  // 1. 输入与顶层结构校验
  if (!manifest || typeof manifest !== 'object') {
    result.violations.push('manifest 必须为对象');
    return result;
  }

  // === Schema 前置校验 ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方业务规则校验（层次 / 拆解 / 声明标志 / cfg 一致性等）。
  const schemaResult = validateBySchema('tla-manifest', manifest);
  if (!schemaResult.valid) {
    for (const m of schemaResult.errorMessages) {
      result.violations.push(`[schema] ${m}`);
    }
    return result;
  }

  const m = manifest as Partial<TlaManifest>;

  if (typeof m.version !== 'number') {
    result.violations.push('manifest.version 必须为数字');
    return result;
  }
  if (typeof m.currentPhase !== 'number') {
    result.violations.push('manifest.currentPhase 必须为数字');
    return result;
  }
  if (
    !m.tools ||
    typeof m.tools !== 'object' ||
    typeof m.tools.jarPath !== 'string' ||
    typeof m.tools.javaMinVersion !== 'number'
  ) {
    result.violations.push('manifest.tools 必须含 jarPath(string) 与 javaMinVersion(number)');
    return result;
  }
  if (!Array.isArray(m.specs)) {
    result.violations.push('manifest.specs 必须为数组');
    return result;
  }

  // basePath 强制字段校验（P1.1）：缺失 / 非字符串 / 空字符串均判失败。
  // 不 return 早退 —— 仅记录违反，其余结构校验继续执行，保持向后兼容（脚本不崩溃）。
  if (typeof m.basePath !== 'string' || m.basePath === '') {
    result.violations.push('manifest.basePath 缺失（强制字段，相对 manifest 文件所在目录）');
  }

  result.totalSpecs = m.specs.length;

  // 2. 规格字段校验 + phase 过滤
  const checkedSpecs: TlaSpec[] = [];
  for (let i = 0; i < m.specs.length; i++) {
    const fieldViolations = validateSpec(m.specs[i], i);
    if (fieldViolations.length > 0) {
      result.violations.push(...fieldViolations);
      continue;
    }
    const spec = m.specs[i] as TlaSpec;
    if (spec.phase <= phase) {
      checkedSpecs.push(spec);
    }
  }
  result.checkedSpecs = checkedSpecs.length;

  // 3. 声明的 SANY/TLC 结果标志 + per-spec TLC 执行状态（A7）
  for (const s of checkedSpecs) {
    if (!s.syntaxChecked) {
      // A7（2026-10-06）：SANY 语法检查失败 ⇒ TLC 必然未执行（反模式 #14 顺序硬约束：先 SANY 后 TLC）。
      // 单一事实：只报 SANY 未通过，**不读取/不复述** manifest 预置的 TLC 结果布尔
      //（tlcChecked/deadlockFree/invariantsHold/stateExplosion——TLC 没跑，它们不构成事实）。
      // notRun 一律不放行：syntaxErrors 非空已使 passed=false（见步骤 9）。
      const sanyDetail = `规格 ${s.id} syntaxChecked=false（SANY 语法检查未通过或未执行）`;
      const notRunReason = `TLC 未执行（SANY 语法检查失败）：${sanyDetail}`;
      result.syntaxErrors.push(sanyDetail);
      result.violations.push(notRunReason);
      result.specs.push({ specId: s.id, tlaPath: s.tlaPath, tlcStatus: 'notRun', reasons: [notRunReason] });
      continue;
    }
    const flagReasons: string[] = [];
    if (!s.tlcChecked) {
      const msg = `规格 ${s.id} tlcChecked=false（TLC 模型检查未完成）`;
      result.violations.push(msg);
      flagReasons.push(msg);
    }
    if (!s.deadlockFree) {
      const msg = `规格 ${s.id} 存在死锁（deadlockFree=false）`;
      result.deadlockViolations.push(msg);
      flagReasons.push(msg);
    }
    if (!s.invariantsHold) {
      const msg = `规格 ${s.id} 不变式违反（invariantsHold=false）`;
      result.invariantViolations.push(msg);
      flagReasons.push(msg);
    }
    if (s.stateExplosion) {
      result.stateExplosionSpecs.push(s.id);
      flagReasons.push(`规格 ${s.id} 状态爆炸（stateExplosion=true）`);
    }
    // SANY 已过：tlcChecked=false 仍属「TLC 未执行」；已执行且有违反 → failed；否则 passed。
    const tlcStatus: TlcRunStatus = !s.tlcChecked ? 'notRun' : flagReasons.length > 0 ? 'failed' : 'passed';
    const reasons = !s.tlcChecked ? [`TLC 未执行（tlcChecked=false）：TLC 模型检查未完成`] : flagReasons;
    result.specs.push({ specId: s.id, tlaPath: s.tlaPath, tlcStatus, reasons });
  }

  // 4. 层次一致性
  // 传入「全量 specs 的 tlaPath ∖ 已通过 phase 过滤的 specs 的 tlaPath」：被 --phase 过滤掉的
  // 引用路径改报「属后续阶段」，避免把「校验范围收窄」误报成「manifest 未登记」（判定结果不变）。
  const checkedPaths = new Set(checkedSpecs.map((s) => s.tlaPath));
  const filteredOutPaths = new Set(
    m.specs.map((s) => (s as TlaSpec).tlaPath).filter((p) => typeof p === 'string' && !checkedPaths.has(p)),
  );
  const fullPhaseByPath = new Map(
    m.specs
      .filter((s) => typeof (s as TlaSpec).tlaPath === 'string' && filteredOutPaths.has((s as TlaSpec).tlaPath))
      .map((s) => [(s as TlaSpec).tlaPath, (s as TlaSpec).phase] as const),
  );
  result.hierarchyViolations = checkHierarchy(checkedSpecs, { filteredOutPaths, fullPhaseByPath, phase });

  // 5. 拆解决策（警告不导致失败，仅取 violations）
  const decomp = checkDecomposition(checkedSpecs);
  result.decompositionViolations = decomp.violations;

  // 6. SD 覆盖率校验（§10）：phase>=2 时强制执行
  if (phase >= 2) {
    if (!m.sdCoverage) {
      result.coverageViolations.push(
        'sdCoverage 字段缺失（phase>=2 强制必填，须由 S-ingest-tla 从 .tla @designIds + graph.json 比对后回填）',
      );
    } else {
      // 校验 sdCoverage 字段结构
      const cov = m.sdCoverage;
      if (typeof cov.totalSdNodes !== 'number' || typeof cov.coverageRate !== 'number') {
        result.coverageViolations.push('sdCoverage.totalSdNodes / coverageRate 须为数字');
      } else if (!Array.isArray(cov.coveredSdNodes) || !Array.isArray(cov.uncoveredSdNodes)) {
        result.coverageViolations.push('sdCoverage.coveredSdNodes / uncoveredSdNodes 须为数组');
      } else if (cov.uncoveredSdNodes.length > 0) {
        result.coverageViolations.push(`以下 SD 节点未被任何 TLA+ spec 覆盖: ${cov.uncoveredSdNodes.join(', ')}`);
      }
      // 交叉校验：sdCoverage.coveredSdNodes 与 graphSdNodes 比对一致
      if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
        const expectedUncovered = m.graphSdNodes.filter((sd) => !cov.coveredSdNodes?.includes(sd));
        if (expectedUncovered.length !== cov.uncoveredSdNodes.length) {
          result.coverageViolations.push('sdCoverage 与 graphSdNodes 比对不一致（covered/uncovered 集合不匹配）');
        }
      }
    }
    // 保留原有 graphSdNodes 覆盖率校验（作为交叉验证）
    if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
      const coverage = checkCoverage(checkedSpecs, m.graphSdNodes);
      result.coverageViolations.push(...coverage.violations);
    }
  } else {
    // phase < 2 时保留原有可选行为
    if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
      const coverage = checkCoverage(checkedSpecs, m.graphSdNodes);
      result.coverageViolations.push(...coverage.violations);
    }
  }

  // 7. cfg-tla 一致性 + cfg 结构校验（§11/§12）：每个含 tlaContent/cfgContent 的 spec 单独校验
  for (const s of checkedSpecs) {
    if (typeof s.tlaContent === 'string' && typeof s.cfgContent === 'string') {
      const cons = checkCfgInvariantsConsistency(s.tlaContent, s.cfgContent);
      for (const v of cons.violations) {
        result.cfgConsistencyViolations.push(`规格 ${s.id}: ${v}`);
      }
      // B1 恒真/空洞不变式防御 + B10c CONSTRAINT 禁用（批次 7 任务 3）：违规并入 cfg 一致性桶
      const biz = checkBusinessInvariants(s.tlaContent, s.cfgContent);
      for (const v of biz.violations) {
        result.cfgConsistencyViolations.push(`规格 ${s.id}: ${v}`);
      }
      // B10 空转 Next 检测（批次 7 任务 7）：违规并入 cfg 一致性桶
      const idle = checkIdleNext(s.tlaContent, s.cfgContent);
      for (const v of idle.violations) {
        result.cfgConsistencyViolations.push(`规格 ${s.id}: ${v}`);
      }
      const struct = checkCfgStructure(s.cfgContent);
      for (const v of struct.violations) {
        result.cfgStructureViolations.push(`规格 ${s.id}: ${v}`);
      }
    }
  }

  // 8. 汇总 violations（headerViolations 与环境错误由 CLI 回填后追加）
  result.violations.push(...result.hierarchyViolations);
  result.violations.push(...result.decompositionViolations);
  result.violations.push(...result.syntaxErrors);
  result.violations.push(...result.deadlockViolations);
  result.violations.push(...result.invariantViolations);
  for (const id of result.stateExplosionSpecs) {
    result.violations.push(`规格 ${id} 状态爆炸（stateExplosion=true），须拆解后重跑`);
  }
  result.violations.push(...result.coverageViolations);
  result.violations.push(...result.cfgConsistencyViolations);
  result.violations.push(...result.cfgStructureViolations);

  // 8.1 R13 checkRounds schema 校验
  result.checkRoundsViolations.push(...checkRoundsSchema(m));
  result.violations.push(...result.checkRoundsViolations);

  // 9. passed 判定（headerViolations 此时为空，environmentOk 为真；CLI 回填后须重算）
  result.passed =
    result.environmentOk &&
    result.headerViolations.length === 0 &&
    result.hierarchyViolations.length === 0 &&
    result.decompositionViolations.length === 0 &&
    result.syntaxErrors.length === 0 &&
    result.deadlockViolations.length === 0 &&
    result.invariantViolations.length === 0 &&
    result.stateExplosionSpecs.length === 0 &&
    result.coverageViolations.length === 0 &&
    result.cfgConsistencyViolations.length === 0 &&
    result.cfgStructureViolations.length === 0 &&
    result.checkRoundsViolations.length === 0 &&
    result.violations.length === 0;

  return result;
}
