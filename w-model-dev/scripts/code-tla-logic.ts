/**
 * 代码-TLA+ 一致性校验纯逻辑（Code-TLA Logic）—— 让 TLA+ 资产贯穿编码阶段
 *
 * 对应 docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md §3.4。
 * 校验四维度：
 *   1. SD→codeModule 映射完整性（graph SD 节点 ←→ rtm.codeModule 字段）
 *   2. 代码状态转移抽取（TypeScript AST 抽取赋值/条件分支）
 *   3. Next 分支对应（TLA+ Next == \/ Act1 \/ Act2 ←→ 代码函数名）
 *   4. 断言覆盖不变式（TLA+ BusinessInvariant 子不变式 ←→ 代码 assert/invariant/require）
 *
 * 设计原则（与 tla-logic.ts / gate-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状 + typescript 包
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「代码-TLA+ 一致性」判定均委托至此
 *
 * 调用方：
 *   - CLI 脚本 check-code-tla-consistency.ts（阶段5 编码后由 G 子代理执行）
 *   - gate-logic.ts 终检（仅复用维度1逻辑，校验 SD→codeModule 映射）
 */

import * as ts from 'typescript';

// ==================== 自包含类型形状 ====================

export interface TlaManifest {
  specs: TlaSpec[];
  [k: string]: unknown;
}

export interface TlaSpec {
  id: string;
  level: string;
  phase: number;
  system: string;
  requirementIds: string[];
  tlaPath: string;
  cfgPath: string;
  parent: string | null;
  children: string[];
  /** .tla 文件文本内容（CLI 读取后注入，供维度3/4 校验使用） */
  tlaContent?: string;
  [k: string]: unknown;
}

export interface GraphNode {
  id: string;
  type: string;
  [k: string]: unknown;
}

export interface Graph {
  nodes: GraphNode[];
  edges: unknown[];
  [k: string]: unknown;
}

export interface RtmRow {
  requirementId: string;
  codeModule?: string;
  [k: string]: unknown;
}

export interface Rtm {
  rows: RtmRow[];
  [k: string]: unknown;
}

export interface CodeFile {
  path: string;
  ast: ts.SourceFile;
  assignments: Assignment[];
  conditionals: Conditional[];
  assertions: Assertion[];
}

export interface Assignment {
  line: number;
  text: string;
}

export interface Conditional {
  line: number;
  text: string;
}

export interface Assertion {
  line: number;
  text: string;
}

export interface DimensionResult {
  passed: boolean;
  checked: number;
  violations: string[];
}

export interface Violation {
  dimension: string;
  message: string;
}

export interface ConsistencyResult {
  passed: boolean;
  dimensions: {
    sdToCodeModule: DimensionResult;
    codeStateTransfer: DimensionResult;
    nextBranchCoverage: DimensionResult;
    invariantCoverage: DimensionResult;
  };
  violations: Violation[];
}

export interface CodeTlaConsistencyInput {
  manifest: TlaManifest;
  graph: Graph;
  rtm: Rtm;
  codeFiles: CodeFile[];
}

// ==================== 维度1：SD→codeModule 映射完整性 ====================

/**
 * 维度1：SD→codeModule 映射完整性校验（spec §3.4.2 维度1）
 *
 * 校验逻辑：
 *   - 读 graph.json 提取所有 type=SD 的节点
 *   - 读 rtm.json 每行的 codeModule 字段
 *   - 校验：每个 SD 节点须有至少一个 codeModule 映射
 *   - 映射判定：SD id 去 "SD-" 前缀转小写 → 检查 codeModule 路径是否包含该 key
 *
 * @param graph 图谱（含 SD 节点）
 * @param rtm   RTM 矩阵（含 codeModule 字段）
 * @returns DimensionResult
 */
export function checkSdToCodeModule(graph: Graph, rtm: Rtm): DimensionResult {
  const violations: string[] = [];
  if (!graph || !Array.isArray(graph.nodes)) {
    return { passed: false, checked: 0, violations: ['graph.nodes 必须为数组'] };
  }
  if (!rtm || !Array.isArray(rtm.rows)) {
    return { passed: false, checked: 0, violations: ['rtm.rows 必须为数组'] };
  }

  const sdNodes = graph.nodes.filter(n => n && n.type === 'SD');
  const codeModules: string[] = [];
  for (const row of rtm.rows) {
    if (row && typeof row.codeModule === 'string' && row.codeModule.trim() !== '') {
      codeModules.push(row.codeModule);
    }
  }

  let checked = 0;
  for (const sd of sdNodes) {
    checked++;
    const id = String(sd.id ?? '');
    // SD id 去 "SD-" 前缀，转小写，按 -/_/. 拆分成多段（取主关键词，避免多单词组合无法匹配）
    // 任一段（长度 >= 2）在 codeModule 路径中出现即视为映射
    const raw = id.replace(/^SD-/i, '');
    const segments = raw
      .split(/[-_.]+/)
      .map(s => s.toLowerCase())
      .filter(s => s.length >= 2);
    if (segments.length === 0) {
      violations.push(`SD 节点 id 为空或无可识别段，无法映射 codeModule: ${id}`);
      continue;
    }
    const matched = codeModules.some(cm => {
      const cmLower = cm.toLowerCase();
      return segments.some(seg => cmLower.includes(seg));
    });
    if (!matched) {
      violations.push(
        `SD 节点 ${id} 无对应 codeModule（期望 codeModule 路径包含以下任一段: ${segments.join(', ')}）`,
      );
    }
  }

  return {
    passed: violations.length === 0,
    checked,
    violations,
  };
}

// ==================== 维度2：代码状态转移抽取 ====================

/**
 * 维度2：用 TypeScript Compiler API 抽取代码状态转移节点（spec §3.4.2 维度2）
 *
 * 抽取三类节点：
 *   - 赋值语句（BinaryExpression 且 operatorToken = EqualsToken）→ assignments
 *   - 条件分支（IfStatement / SwitchStatement）→ conditionals
 *   - 断言调用（含 assert/invariant/require 的 ExpressionStatement）→ assertions
 *
 * @param ast      TypeScript SourceFile（由 ts.createSourceFile 生成）
 * @param filePath 文件路径（用于错误消息）
 * @returns CodeFile（含 assignments/conditionals/assertions）
 */
export function extractCodeStateTransfers(
  ast: ts.SourceFile,
  filePath: string,
): CodeFile {
  const assignments: Assignment[] = [];
  const conditionals: Conditional[] = [];
  const assertions: Assertion[] = [];

  function getLine(node: ts.Node): number {
    const fullText = ast.getFullText();
    const pos = node.getStart(ast, false);
    if (pos < 0) return 0;
    let line = 1;
    for (let i = 0; i < pos && i < fullText.length; i++) {
      if (fullText.charCodeAt(i) === 10 /* \n */) line++;
    }
    return line;
  }

  function getText(node: ts.Node): string {
    return node.getText(ast).replace(/\s+/g, ' ').trim();
  }

  function visit(node: ts.Node): void {
    // 赋值语句：BinaryExpression 且 operator = =
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const line = getLine(node);
      const text = getText(node);
      assignments.push({ line, text });
    }

    // 条件分支：IfStatement / SwitchStatement
    if (ts.isIfStatement(node) || ts.isSwitchStatement(node)) {
      const line = getLine(node);
      const text = getText(node);
      conditionals.push({ line, text });
    }

    // 断言调用：ExpressionStatement 且含 assert/invariant/require 标识符
    if (ts.isExpressionStatement(node)) {
      const text = getText(node);
      if (/\b(assert|invariant|require)\b/i.test(text)) {
        const line = getLine(node);
        assertions.push({ line, text });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);

  return {
    path: filePath,
    ast,
    assignments,
    conditionals,
    assertions,
  };
}

/**
 * 维度2 校验：代码状态转移抽取结果检查（spec §3.4.2 维度2）
 *
 * 校验：抽取到的赋值语句数 > 0（无赋值则代码无状态转移，与 TLA+ Next 不对应）
 *
 * @param files 已抽取的 CodeFile 数组
 * @returns DimensionResult
 */
export function checkCodeStateTransfer(files: CodeFile[]): DimensionResult {
  const violations: string[] = [];
  if (!Array.isArray(files) || files.length === 0) {
    return { passed: false, checked: 0, violations: ['codeFiles 为空，无代码状态转移可校验'] };
  }

  let totalAssignments = 0;
  for (const f of files) {
    totalAssignments += f.assignments.length;
  }

  if (totalAssignments === 0) {
    violations.push('代码中未抽取到任何赋值语句（BinaryExpression + =），无法与 TLA+ Next 状态转移对应');
  }

  return {
    passed: violations.length === 0,
    checked: totalAssignments,
    violations,
  };
}

// ==================== 维度3：Next 分支对应 ====================

/**
 * 辅助函数：将 TLA+ 标识符转为驼峰形式（首字母小写，去除下划线/连字符分隔）。
 * 用于 TLA+ 动作名（如 Register / LoginAction / Reset_Cycle）与代码函数名（register / loginAction / resetCycle）匹配。
 *
 * @param name TLA+ 标识符
 * @returns 驼峰形式（首字母小写）
 */
export function toCamelCase(name: string): string {
  if (typeof name !== 'string' || name.length === 0) return '';
  // 按下划线/连字符分割，拼接为驼峰
  const parts = name.split(/[_-]+/).filter(p => p.length > 0);
  if (parts.length === 0) return '';
  // 第一段首字母小写，后续段首字母大写
  const first = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
  const rest = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1));
  return first + rest.join('');
}

/**
 * 从 TLA+ 文本中抽取 Next == 定义后的所有动作名（\/ 分隔）。
 *
 * 形如：
 *   Next ==
 *       \/ Register
 *       \/ Login
 *       \/ Logout
 *
 * @param tlaContent .tla 文件文本内容
 * @returns 动作名数组（如 ['Register', 'Login', 'Logout']）
 */
export function extractNextActions(tlaContent: string): string[] {
  if (typeof tlaContent !== 'string' || tlaContent.length === 0) return [];
  // 匹配 `Next ==` 后到下一个顶层定义（行首大写标识符 + `==`）或文件末尾
  const nextMatch = tlaContent.match(/Next\s*==\s*([\s\S]*?)(?=\n\s*[A-Z][A-Za-z0-9_]*\s*==|\n\s*====|$)/);
  if (!nextMatch) return [];
  const body = nextMatch[1];
  // 抽取 \/ 后的动作名（可能带括号，如 \/ (A \/ B)，这里只取顶层 \/ 分隔的标识符）
  // 正则中用字符类 [\\][/] 匹配字面量 "\/"（反斜杠+斜杠），避免 \/ 被解析为 Unicode 转义
  const actions: string[] = [];
  const re = new RegExp('[\\\\][/]\\s*([A-Za-z_][A-Za-z0-9_]*)', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    actions.push(m[1]);
  }
  return actions;
}

/**
 * 从代码文件中抽取所有函数/方法名（FunctionDeclaration / MethodDeclaration / ArrowFunction 命名变量）。
 *
 * @param files CodeFile 数组
 * @returns 函数名数组（小写形式，便于匹配）
 */
export function extractCodeFunctionNames(files: CodeFile[]): string[] {
  const names: string[] = [];
  for (const f of files) {
    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) && node.name) {
        names.push(node.name.text);
      } else if (ts.isMethodDeclaration(node) && node.name) {
        names.push(node.name.getText(f.ast));
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (d.name && ts.isIdentifier(d.name) && d.initializer) {
            // 箭头函数 / 函数表达式赋值给变量：const register = () => {}
            if (
              ts.isArrowFunction(d.initializer) ||
              ts.isFunctionExpression(d.initializer)
            ) {
              names.push(d.name.text);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(f.ast);
  }
  return names;
}

/**
 * 维度3：Next 分支对应校验（spec §3.4.2 维度3）
 *
 * 校验逻辑：
 *   - 正则抽取 `Next ==` 后的 `\/` 分隔动作名
 *   - 抽取代码中 FunctionDeclaration/MethodDeclaration 的 name
 *   - 驼峰匹配 + 名称相似度匹配（包含匹配，不要求精确 1:1）
 *   - 无对应则失败
 *
 * @param tlaContent .tla 文件文本内容
 * @param files      CodeFile 数组
 * @returns DimensionResult
 */
export function checkNextBranchCoverage(
  tlaContent: string,
  files: CodeFile[],
): DimensionResult {
  const violations: string[] = [];
  const actions = extractNextActions(tlaContent);
  if (actions.length === 0) {
    // 无 Next 定义时跳过（无可校验项）
    return { passed: true, checked: 0, violations: [] };
  }

  const codeFunctionNames = extractCodeFunctionNames(files);
  // 同时准备驼峰形式和小写形式，做包含匹配
  const codeNamesLower = codeFunctionNames.map(n => n.toLowerCase());

  let covered = 0;
  for (const action of actions) {
    const camel = toCamelCase(action);
    const lower = action.toLowerCase();
    // 匹配策略（任一即视为对应）：
    //   1. 代码函数名（小写）包含动作名（小写），或反之
    //   2. 代码函数名（小写）包含驼峰动作名（小写），或反之
    const matched = codeNamesLower.some(
      cn =>
        cn.includes(lower) ||
        lower.includes(cn) ||
        cn.includes(camel.toLowerCase()) ||
        camel.toLowerCase().includes(cn),
    );
    if (matched) {
      covered++;
    } else {
      violations.push(
        `TLA+ Next 分支 "${action}" 在代码中无对应函数/方法实现（驼峰名 "${camel}"）`,
      );
    }
  }

  return {
    passed: violations.length === 0,
    checked: actions.length,
    violations,
  };
}

// ==================== 维度4：断言覆盖不变式 ====================

/**
 * 从 TLA+ 文本中抽取 BusinessInvariant == 定义后的所有子不变式名（/\ 分隔）。
 *
 * 形如：
 *   BusinessInvariant ==
 *       /\ TypeInvariant
 *       /\ TokenIssuedRequiresAuthenticated
 *       /\ LoggedOutImpliesNoToken
 *
 * @param tlaContent .tla 文件文本内容
 * @returns 子不变式名数组
 */
export function extractBusinessInvariants(tlaContent: string): string[] {
  if (typeof tlaContent !== 'string' || tlaContent.length === 0) return [];
  const invMatch = tlaContent.match(
    /BusinessInvariant\s*==\s*([\s\S]*?)(?=\n\s*[A-Z][A-Za-z0-9_]*\s*==|\n\s*====|$)/,
  );
  if (!invMatch) return [];
  const body = invMatch[1];
  const invariants: string[] = [];
  // 正则中用字符类 [/][\\] 匹配字面量 "/\"（斜杠+反斜杠，TLA+ 合取符号）
  const re = new RegExp('[/][\\\\]\\s*([A-Za-z_][A-Za-z0-9_]*)', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    invariants.push(m[1]);
  }
  return invariants;
}

/**
 * 维度4：断言覆盖不变式校验（spec §3.4.2 维度4）
 *
 * 校验逻辑：
 *   - 正则抽取 `BusinessInvariant ==` 后的 `/\` 分隔子不变式名
 *   - 抽取代码中含 assert/invariant/require 的 ExpressionStatement
 *   - 宽松策略：有断言即认为覆盖（不要求 1:1 对应）
 *   - 无覆盖则失败
 *
 * @param tlaContent .tla 文件文本内容
 * @param files      CodeFile 数组
 * @returns DimensionResult
 */
export function checkInvariantCoverage(
  tlaContent: string,
  files: CodeFile[],
): DimensionResult {
  const invariants = extractBusinessInvariants(tlaContent);
  if (invariants.length === 0) {
    // 无 BusinessInvariant 定义时跳过
    return { passed: true, checked: 0, violations: [] };
  }

  // 统计代码中的断言数
  // 如果 CodeFile.assertions 已抽取（CLI 注入），直接用；否则自动抽取（保持纯函数自洽）
  let totalAssertions = 0;
  for (const f of files) {
    const assertions = Array.isArray(f.assertions) ? f.assertions : extractCodeStateTransfers(f.ast, f.path).assertions;
    totalAssertions += assertions.length;
  }

  const violations: string[] = [];
  if (totalAssertions === 0) {
    violations.push(
      `代码中未抽取到任何断言（assert/invariant/require），无法覆盖 TLA+ BusinessInvariant 的 ${invariants.length} 个子不变式`,
    );
  }

  return {
    passed: violations.length === 0,
    checked: invariants.length,
    violations,
  };
}

// ==================== 主入口 ====================

/**
 * 代码-TLA+ 一致性校验主入口（纯逻辑，单点事实源）。
 *
 * 聚合四维度校验：
 *   1. checkSdToCodeModule（维度1：SD→codeModule 映射）
 *   2. checkCodeStateTransfer（维度2：代码状态转移抽取）
 *   3. checkNextBranchCoverage（维度3：Next 分支对应）
 *   4. checkInvariantCoverage（维度4：断言覆盖不变式）
 *
 * 维度3/4 需要从 manifest.specs[].tlaContent 读取 .tla 文件内容（CLI 注入）。
 * 多个 spec 的 tlaContent 会合并校验：任一 spec 的 Next 分支无对应 → 失败。
 *
 * @param input CodeTlaConsistencyInput（manifest + graph + rtm + codeFiles）
 * @returns ConsistencyResult
 */
export function checkCodeTlaConsistency(
  input: CodeTlaConsistencyInput,
): ConsistencyResult {
  const violations: Violation[] = [];

  if (!input || typeof input !== 'object') {
    return {
      passed: false,
      dimensions: {
        sdToCodeModule: { passed: false, checked: 0, violations: ['input 必须为对象'] },
        codeStateTransfer: { passed: false, checked: 0, violations: [] },
        nextBranchCoverage: { passed: false, checked: 0, violations: [] },
        invariantCoverage: { passed: false, checked: 0, violations: [] },
      },
      violations: [{ dimension: 'input', message: 'input 必须为对象' }],
    };
  }

  // 维度1：SD→codeModule 映射
  const sdToCodeModule = checkSdToCodeModule(input.graph, input.rtm);
  for (const v of sdToCodeModule.violations) {
    violations.push({ dimension: 'sdToCodeModule', message: v });
  }

  // 维度2：代码状态转移抽取
  // 如果 codeFiles 已含 assignments/conditionals/assertions（CLI 注入），直接用；
  // 否则按需重新抽取（保持纯函数自洽）。
  const codeFilesWithExtract: CodeFile[] = (input.codeFiles ?? []).map(f => {
    if (f.assignments.length > 0 || f.conditionals.length > 0 || f.assertions.length > 0) {
      return f;
    }
    return extractCodeStateTransfers(f.ast, f.path);
  });
  const codeStateTransfer = checkCodeStateTransfer(codeFilesWithExtract);
  for (const v of codeStateTransfer.violations) {
    violations.push({ dimension: 'codeStateTransfer', message: v });
  }

  // 维度3/4：从 manifest.specs[].tlaContent 读取 .tla 文件内容
  // 多个 spec 的 tlaContent 拼接校验：任一 spec 的 Next 分支无对应 → 失败
  const specs = Array.isArray(input.manifest?.specs) ? input.manifest.specs : [];
  // 仅校验 L2/L3 spec（Next 分支通常在 L2/L3）
  const tlaSpecs = specs.filter(
    s => s && (s.level === 'L2' || s.level === 'L3') && typeof s.tlaContent === 'string',
  );

  // 维度3：Next 分支对应
  let nextPassed = true;
  const nextViolations: string[] = [];
  let nextChecked = 0;
  if (tlaSpecs.length === 0) {
    // 无 L2/L3 spec 的 tlaContent → 跳过（视为通过）
  } else {
    for (const spec of tlaSpecs) {
      const r = checkNextBranchCoverage(spec.tlaContent ?? '', codeFilesWithExtract);
      nextChecked += r.checked;
      if (!r.passed) {
        nextPassed = false;
        for (const v of r.violations) {
          nextViolations.push(`规格 ${spec.id}: ${v}`);
        }
      }
    }
  }
  const nextBranchCoverage: DimensionResult = {
    passed: nextPassed,
    checked: nextChecked,
    violations: nextViolations,
  };
  for (const v of nextViolations) {
    violations.push({ dimension: 'nextBranchCoverage', message: v });
  }

  // 维度4：断言覆盖不变式
  let invPassed = true;
  const invViolations: string[] = [];
  let invChecked = 0;
  if (tlaSpecs.length === 0) {
    // 无 L2/L3 spec 的 tlaContent → 跳过
  } else {
    for (const spec of tlaSpecs) {
      const r = checkInvariantCoverage(spec.tlaContent ?? '', codeFilesWithExtract);
      invChecked += r.checked;
      if (!r.passed) {
        invPassed = false;
        for (const v of r.violations) {
          invViolations.push(`规格 ${spec.id}: ${v}`);
        }
      }
    }
  }
  const invariantCoverage: DimensionResult = {
    passed: invPassed,
    checked: invChecked,
    violations: invViolations,
  };
  for (const v of invViolations) {
    violations.push({ dimension: 'invariantCoverage', message: v });
  }

  const passed =
    sdToCodeModule.passed &&
    codeStateTransfer.passed &&
    nextBranchCoverage.passed &&
    invariantCoverage.passed;

  return {
    passed,
    dimensions: {
      sdToCodeModule,
      codeStateTransfer,
      nextBranchCoverage,
      invariantCoverage,
    },
    violations,
  };
}
