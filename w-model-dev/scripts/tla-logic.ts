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

// ==================== 自包含类型形状 ====================

export type SpecLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export type DecompositionDecision =
  | 'must-split'
  | 'consider-split'
  | 'kept-below-threshold'
  | 'split-done';

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
  syntaxChecked: boolean;
  tlcChecked: boolean;
  deadlockFree: boolean;
  invariantsHold: boolean;
  stateExplosion: boolean;
  lastCheckTimestamp?: string;
}

export interface TlaManifest {
  version: number;
  project?: string;
  currentPhase: number;
  tools: { jarPath: string; javaMinVersion: number };
  specs: TlaSpec[];
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

export interface TlaCheckResult {
  passed: boolean;
  phase: number;
  totalSpecs: number;
  checkedSpecs: number;
  headerViolations: string[];
  hierarchyViolations: string[];
  decompositionViolations: string[];
  syntaxErrors: string[];
  deadlockViolations: string[];
  invariantViolations: string[];
  stateExplosionSpecs: string[];
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
const VALID_DECISIONS: DecompositionDecision[] = [
  'must-split',
  'consider-split',
  'kept-below-threshold',
  'split-done',
];

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
  if (!m) return -1;
  return Number.parseInt(m[1], 10);
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
    const name = m[1].toLowerCase();
    const raw = m[2].trim();
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
export function validateHeader(
  header: Record<string, string | null>,
  spec: TlaSpec,
): string[] {
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
    violations.push(
      `规格 ${id} 文件头 @system="${header.system}" ≠ manifest.system="${spec.system}"`,
    );
  }

  // 3. @requirement（逗号分隔列表，集合须一致）
  if (header.requirement != null) {
    const headerReqs = header.requirement
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');
    const expectedReqs = (spec.requirementIds ?? []).slice();
    if (!sameSet(headerReqs, expectedReqs)) {
      violations.push(
        `规格 ${id} 文件头 @requirement=[${headerReqs.join(',')}] ≠ manifest.requirementIds=[${expectedReqs.join(',')}]`,
      );
    }
  }

  // 4. @design
  if (header.design != null && header.design !== spec.designRef) {
    violations.push(
      `规格 ${id} 文件头 @design="${header.design}" ≠ manifest.designRef="${spec.designRef}"`,
    );
  }

  // 5. @parent（null ↔ null；非空字符串须相等）
  const expectedParent = spec.parent;
  if (header.parent == null && expectedParent != null) {
    violations.push(`规格 ${id} 文件头 @parent=null 但 manifest.parent="${expectedParent}"`);
  } else if (header.parent != null && expectedParent == null) {
    violations.push(`规格 ${id} 文件头 @parent="${header.parent}" 但 manifest.parent=null`);
  } else if (header.parent != null && expectedParent != null && header.parent !== expectedParent) {
    violations.push(
      `规格 ${id} 文件头 @parent="${header.parent}" ≠ manifest.parent="${expectedParent}"`,
    );
  }

  // 6. @sibling（null ↔ 空数组；逗号列表集合须一致）
  const expectedSiblings = (spec.siblings ?? []).slice();
  if (header.sibling == null) {
    if (expectedSiblings.length > 0) {
      violations.push(
        `规格 ${id} 文件头 @sibling=null 但 manifest.siblings 非空 [${expectedSiblings.join(',')}]`,
      );
    }
  } else {
    const headerSibs = header.sibling
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');
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
      violations.push(
        `规格 ${id} 文件头 @child=null 但 manifest.children 非空 [${expectedChildren.join(',')}]`,
      );
    }
  } else {
    const headerChildren = header.child
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');
    if (!sameSet(headerChildren, expectedChildren)) {
      violations.push(
        `规格 ${id} 文件头 @child=[${headerChildren.join(',')}] ≠ manifest.children=[${expectedChildren.join(',')}]`,
      );
    }
  }

  // 8. @level
  if (header.level != null && header.level !== spec.level) {
    violations.push(
      `规格 ${id} 文件头 @level="${header.level}" ≠ manifest.level="${spec.level}"`,
    );
  }

  // 9. @phase
  if (header.phase != null) {
    const phaseNum = Number.parseInt(header.phase, 10);
    if (!Number.isFinite(phaseNum) || phaseNum !== spec.phase) {
      violations.push(
        `规格 ${id} 文件头 @phase="${header.phase}" ≠ manifest.phase=${spec.phase}`,
      );
    }
  }

  return violations;
}

// ==================== 层次一致性校验 ====================

/**
 * 校验层次一致性（设计文档 §3.1 步骤 3）：
 *   - parent/child 双向：A.parent=B ⇒ B.children 含 A；A.children 含 C ⇒ C.parent=A
 *   - sibling 双向：A.siblings 含 B ⇒ B.siblings 含 A
 *   - 有且仅有一个 L1 根规格（parent=null 且 level=L1）
 *   - 层级单调：子规格 level = 父规格 level + 1
 *
 * @param specs 待校验的规格数组（通常为 phase 过滤后的子集）
 * @returns 违反消息数组（空数组表示一致）
 */
export function checkHierarchy(specs: TlaSpec[]): string[] {
  const violations: string[] = [];
  if (!Array.isArray(specs)) {
    violations.push('checkHierarchy: specs 必须为数组');
    return violations;
  }
  // 按 tlaPath 索引：manifest 的 parent/children/siblings 字段值均为 tlaPath（非 spec.id）
  const byPath = new Map<string, TlaSpec>();
  for (const s of specs) byPath.set(s.tlaPath, s);

  // 单 L1 根：parent=null 且 level=L1
  const roots = specs.filter(s => s.parent === null && s.level === 'L1');
  if (roots.length === 0) {
    violations.push('层次校验失败：不存在 L1 根规格（parent=null 且 level=L1）');
  } else if (roots.length > 1) {
    violations.push(
      `层次校验失败：存在 ${roots.length} 个 L1 根规格（应为 1）：${roots.map(r => r.id).join(', ')}`,
    );
  }

  for (const s of specs) {
    // parent → child 双向 + 层级单调
    if (s.parent != null) {
      const parent = byPath.get(s.parent);
      if (!parent) {
        violations.push(
          `层次校验失败：规格 ${s.id} 的 parent="${s.parent}" 不在 manifest 中`,
        );
      } else if (!(parent.children ?? []).includes(s.tlaPath)) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 parent="${s.parent}"，但 parent.children 未包含 ${s.tlaPath}`,
        );
      } else {
        const parentLevelNum = levelNum(parent.level);
        const childLevelNum = levelNum(s.level);
        if (parentLevelNum > 0 && childLevelNum > 0 && childLevelNum !== parentLevelNum + 1) {
          violations.push(
            `层次校验失败：规格 ${s.id} level=${s.level} ≠ parent(${parent.id}) level ${parent.level} + 1`,
          );
        }
      }
    }

    // child → parent 双向
    for (const childPath of s.children ?? []) {
      const child = byPath.get(childPath);
      if (!child) {
        violations.push(
          `层次校验失败：规格 ${s.id} 的 child="${childPath}" 不在 manifest 中`,
        );
      } else if (child.parent !== s.tlaPath) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 child="${childPath}"，但 ${childPath}.parent="${child.parent}" ≠ "${s.tlaPath}"`,
        );
      }
    }

    // sibling 双向
    for (const sibPath of s.siblings ?? []) {
      const sib = byPath.get(sibPath);
      if (!sib) {
        violations.push(
          `层次校验失败：规格 ${s.id} 的 sibling="${sibPath}" 不在 manifest 中`,
        );
      } else if (!(sib.siblings ?? []).includes(s.tlaPath)) {
        violations.push(
          `层次校验失败：规格 ${s.id} 声明 sibling="${sibPath}"，但 ${sibPath}.siblings 未包含 ${s.tlaPath}`,
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
 *
 * @param specs 待校验的规格数组
 * @returns { violations, warnings }
 */
export function checkDecomposition(
  specs: TlaSpec[],
): { violations: string[]; warnings: string[] } {
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
    }
  }
  return { violations, warnings };
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
 * 校验 manifest 结构 + 规格字段 + 层次一致性 + 拆解决策 + 声明的 SANY/TLC 结果标志。
 * 不执行 I/O（读文件、跑 SANY/TLC 由 CLI 完成）。
 *
 * 校验项：
 *   1. manifest 顶层结构：version/currentPhase/tools(specs 前置)/specs 数组
 *   2. 每个 spec（phase ≤ 入参 phase）的字段类型与取值合法性
 *   3. 声明的结果标志：
 *      - syntaxChecked=false ⇒ syntaxErrors（SANY 必须通过）
 *      - 非 --skip-tlc 时：tlcChecked=false ⇒ 违反；deadlockFree=false ⇒ deadlockViolations；
 *        invariantsHold=false ⇒ invariantViolations；stateExplosion=true ⇒ stateExplosionSpecs
 *   4. 层次一致性（checkHierarchy）
 *   5. 拆解决策（checkDecomposition，警告不导致失败）
 *
 * 注意：headerViolations / environmentOk / environmentErrors 在纯逻辑中分别留空 / 置真 / 置空，
 *   由 CLI 在执行文件头解析与环境检查后回填，并重算 passed。
 *
 * @param manifest tla-manifest.json 解析后的对象
 * @param phase    校验阶段，仅校验 spec.phase ≤ phase 的规格
 * @param options  { skipTlc?: boolean } —— 跳过 TLC 相关标志校验（快速反馈用）
 * @returns TlaCheckResult
 */
export function checkTlaModel(
  manifest: unknown,
  phase: number,
  options?: { skipTlc?: boolean },
): TlaCheckResult {
  const skipTlc = options?.skipTlc === true;
  const result: TlaCheckResult = {
    passed: false,
    phase,
    totalSpecs: 0,
    checkedSpecs: 0,
    headerViolations: [],
    hierarchyViolations: [],
    decompositionViolations: [],
    syntaxErrors: [],
    deadlockViolations: [],
    invariantViolations: [],
    stateExplosionSpecs: [],
    environmentOk: true,
    environmentErrors: [],
    violations: [],
  };

  // 1. 输入与顶层结构校验
  if (!manifest || typeof manifest !== 'object') {
    result.violations.push('manifest 必须为对象');
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

  // 3. 声明的 SANY/TLC 结果标志
  for (const s of checkedSpecs) {
    if (!s.syntaxChecked) {
      result.syntaxErrors.push(
        `规格 ${s.id} syntaxChecked=false（SANY 语法检查未通过或未执行）`,
      );
    }
    if (!skipTlc) {
      if (!s.tlcChecked) {
        result.violations.push(`规格 ${s.id} tlcChecked=false（TLC 模型检查未完成）`);
      }
      if (!s.deadlockFree) {
        result.deadlockViolations.push(`规格 ${s.id} 存在死锁（deadlockFree=false）`);
      }
      if (!s.invariantsHold) {
        result.invariantViolations.push(`规格 ${s.id} 不变式违反（invariantsHold=false）`);
      }
      if (s.stateExplosion) {
        result.stateExplosionSpecs.push(s.id);
      }
    }
  }

  // 4. 层次一致性
  result.hierarchyViolations = checkHierarchy(checkedSpecs);

  // 5. 拆解决策（警告不导致失败，仅取 violations）
  const decomp = checkDecomposition(checkedSpecs);
  result.decompositionViolations = decomp.violations;

  // 6. 汇总 violations（headerViolations 与环境错误由 CLI 回填后追加）
  result.violations.push(...result.hierarchyViolations);
  result.violations.push(...result.decompositionViolations);
  result.violations.push(...result.syntaxErrors);
  result.violations.push(...result.deadlockViolations);
  result.violations.push(...result.invariantViolations);
  for (const id of result.stateExplosionSpecs) {
    result.violations.push(`规格 ${id} 状态爆炸（stateExplosion=true），须拆解后重跑`);
  }

  // 7. passed 判定（headerViolations 此时为空，environmentOk 为真；CLI 回填后须重算）
  result.passed =
    result.environmentOk &&
    result.headerViolations.length === 0 &&
    result.hierarchyViolations.length === 0 &&
    result.decompositionViolations.length === 0 &&
    result.syntaxErrors.length === 0 &&
    result.deadlockViolations.length === 0 &&
    result.invariantViolations.length === 0 &&
    result.stateExplosionSpecs.length === 0 &&
    result.violations.length === 0;

  return result;
}
