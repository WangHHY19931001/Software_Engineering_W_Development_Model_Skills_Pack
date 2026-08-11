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

import { createRequire } from 'node:module';
import type * as TsType from 'typescript';
import { validateBySchema } from './schema-loader.js';
import type { StructuredViolation } from '../lib/types.js';

const ts = createRequire(import.meta.url)('typescript') as typeof TsType;

// ==================== 自包含类型形状 ====================

/**
 * A2b 双轨过渡：代码-TLA+ 一致性结构化违规规则 ID。
 * 命名：CODE_TLA_<类别>，对应四维度判定规则；INPUT/SCHEMA 对应输入形状与 schema 前置校验。
 *
 * 规则 ID → 设计依据映射（设计依据 SSoT §10.8.1 四维度算法）：
 *   - D1：维度1 SD→codeModule 映射完整性（SSoT §10.8.1 算法 1；阶段约束 P1.4：阶段5编码完成后
 *        必须回填 RTM.codeModule 列，格式 `SD-xxx:src/path/to/file.ts`，缺失即维度1 违规）
 *   - D2：维度2 代码状态转移抽取（SSoT §10.8.1 算法 2：AST 抽取赋值/条件分支，无赋值即违规）
 *   - D3：维度3 Next 分支对应（SSoT §10.8.1 算法 3 + SSoT §3.4.6 P2.8 PascalCase→camelCase 自动映射 +
 *        P3.9 遍历 manifest 全部 specs 的 Next actions，不再仅限 L4）
 *   - D4：维度4 断言覆盖不变式（SSoT §10.8.1 算法 4：assert/invariant/require 宽松覆盖）
 *   - INPUT / SCHEMA：A2b 新增的前置校验（输入形状合法性 + code-tla-manifest schema 结构性约束），
 *        通过后才进入上方四维度业务规则校验
 */
const CODE_TLA_RULES = {
  D1: 'CODE_TLA_D1',
  D2: 'CODE_TLA_D2',
  D3: 'CODE_TLA_D3',
  D4: 'CODE_TLA_D4',
  INPUT: 'CODE_TLA_INPUT',
  SCHEMA: 'CODE_TLA_SCHEMA',
} as const;

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
  ast: TsType.SourceFile;
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
  /** A2b 双轨过渡：结构化违规（rule/field/message），可选字段向后兼容 */
  structuredViolations?: StructuredViolation[];
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
  /** A2b 双轨过渡：结构化违规（rule/field/message），可选字段向后兼容 */
  structuredViolations?: StructuredViolation[];
}

export interface CodeTlaConsistencyInput {
  manifest: TlaManifest;
  graph: Graph;
  rtm: Rtm;
  codeFiles: CodeFile[];
}

// ==================== 维度1：SD→codeModule 映射完整性 ====================

/**
 * 维度1：SD→codeModule 映射完整性校验（spec §3.4.2 维度1；SSoT §10.8.1 算法 1）
 *
 * 设计依据：
 *   - SSoT §10.8.1「代码-TLA+ 一致性回归」维度1：读取 graph.json 中所有 type=SD 节点，
 *     核验 rtm.json 中每个 SD 节点均有对应 codeModule 映射（多段匹配：SD id 分段后
 *     任一段长度≥2 出现在 codeModule 路径中），违反 → sdToCodeModule 维度失败。
 *   - SSoT §3.4.6 P1.4「RTM codeModule 回填时机」：阶段5编码完成后、code-TLA 一致性检查前
 *     必须回填 RTM.codeModule 列（格式 `SD-xxx:src/path/to/file.ts`，多个模块用逗号分隔），
 *     缺失 → 本维度退出码 1。
 *   - SSoT §3.4.18 第22轮「codeModule 格式规范」：REQ 行匹配 `^SD-[\d.]+:src/.+\.(ts|js|py|java)$`。
 *   - verifier-spec.md §2.2：阶段 5 源代码评审用 targetKind=`code`，与 code-tla-consistency
 *     维度命名对齐。
 *
 * 校验逻辑：
 *   - 读 graph.json 提取所有 type=SD 的节点
 *   - 读 rtm.json 每行的 codeModule 字段
 *   - 校验：每个 SD 节点须有至少一个 codeModule 映射
 *   - 映射判定：SD id 去 "SD-" 前缀转小写 → 检查 codeModule 路径是否包含该 key
 *
 * 边界处理：
 *   - rtm 缺失 codeModule 行（codeModules 为空数组）时，所有 SD 节点均无法匹配 →
 *     视为违规逐条上报，而非跳过（「无 codeModule 时视为违规而非跳过」，与 P1.4
 *     阶段5必须回填的硬约束一致）
 *   - SD id 为空或无可识别段（去前缀拆段后无长度≥2 的段）→ 直接视为违规并提示回填格式
 *
 * @param graph 图谱（含 SD 节点）
 * @param rtm   RTM 矩阵（含 codeModule 字段）
 * @returns DimensionResult
 */
export function checkSdToCodeModule(graph: Graph, rtm: Rtm): DimensionResult {
  const violations: string[] = [];
  const structuredViolations: StructuredViolation[] = [];
  if (!graph || !Array.isArray(graph.nodes)) {
    return {
      passed: false,
      checked: 0,
      violations: ['graph.nodes 必须为数组'],
      structuredViolations: [{ rule: CODE_TLA_RULES.D1, field: 'graph.nodes', message: 'graph.nodes 必须为数组' }],
    };
  }
  if (!rtm || !Array.isArray(rtm.rows)) {
    return {
      passed: false,
      checked: 0,
      violations: ['rtm.rows 必须为数组'],
      structuredViolations: [{ rule: CODE_TLA_RULES.D1, field: 'rtm.rows', message: 'rtm.rows 必须为数组' }],
    };
  }

  // 仅取 type=SD 节点（SSoT §10.8.1 算法 1：graph.json 中所有 type=SD 节点）
  const sdNodes = graph.nodes.filter((n) => n && n.type === 'SD');
  const codeModules: string[] = [];
  for (const row of rtm.rows) {
    if (row && typeof row.codeModule === 'string' && row.codeModule.trim() !== '') {
      codeModules.push(row.codeModule);
    }
  }

  let checked = 0;
  for (const [idx, sd] of sdNodes.entries()) {
    checked++;
    const id = String(sd.id ?? '');

    // 主匹配：SD ID 前缀精确匹配（codeModule 格式 SD-xxx:src/path per phase-5-coding.md）
    // 处理数字 ID（如 SD-5.2.1）和命名 ID（如 SD-AUTH），最可靠的反向追溯方式
    const prefixMatch = codeModules.some((cm) => cm.includes(`${id}:`));
    if (prefixMatch) continue;

    // 回退匹配：SD id 去 "SD-" 前缀，转小写，按 -/_/. 拆分成多段
    // 任一段（长度 >= 2）在 codeModule 路径中出现即视为映射（适用于命名 SD ID 如 SD-AUTH）
    // 长度 >= 2 为 SSoT §10.8.1 算法 1 规定的分段阈值：过滤单字符噪声段（如 a/i/o 等）
    const raw = id.replace(/^SD-/i, '');
    const segments = raw
      .split(/[-_.]+/)
      .map((s) => s.toLowerCase())
      .filter((s) => s.length >= 2);
    if (segments.length === 0) {
      const msg = `SD 节点 id 为空或无可识别段，无法映射 codeModule: ${id}（阶段5编码后必须回填 RTM.codeModule，格式：SD-xxx:src/path/to/file.ts）`;
      violations.push(msg);
      structuredViolations.push({ rule: CODE_TLA_RULES.D1, field: `graph.nodes[${idx}].id`, message: msg });
      continue;
    }
    const matched = codeModules.some((cm) => {
      const cmLower = cm.toLowerCase();
      return segments.some((seg) => cmLower.includes(seg));
    });
    if (!matched) {
      // P1.4：错误信息须明确指出回填时机（阶段5编码后必须回填 RTM.codeModule）与格式
      const msg = `SD 节点 ${id} 无对应 codeModule（阶段5编码后必须回填 RTM.codeModule，格式：SD-xxx:src/path/to/file.ts；期望路径包含以下任一段: ${segments.join(', ')}）`;
      violations.push(msg);
      structuredViolations.push({ rule: CODE_TLA_RULES.D1, field: `graph.nodes[${idx}].id`, message: msg });
    }
  }

  return {
    passed: violations.length === 0,
    checked,
    violations,
    structuredViolations,
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
export function extractCodeStateTransfers(ast: TsType.SourceFile, filePath: string): CodeFile {
  const assignments: Assignment[] = [];
  const conditionals: Conditional[] = [];
  const assertions: Assertion[] = [];

  function getLine(node: TsType.Node): number {
    // ts.getLineAndCharacterOfPosition 的 .line 为 0-based，+1 后与逐字符计 \n 语义一致
    return ts.getLineAndCharacterOfPosition(ast, node.getStart(ast, false)).line + 1;
  }

  function getText(node: TsType.Node): string {
    return node.getText(ast).replace(/\s+/g, ' ').trim();
  }

  function visit(node: TsType.Node): void {
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
    // 三类断言调用与 SSoT §10.8.1 算法 4 一致：维度4 用 assert/invariant/require
    // 的宽松覆盖策略匹配 TLA+ BusinessInvariant 子不变式
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
 * 维度2 校验：代码状态转移抽取结果检查（spec §3.4.2 维度2；SSoT §10.8.1 算法 2）
 *
 * 设计依据：SSoT §10.8.1 维度2——用 ts.createSourceFile 解析 src/ 下所有 .ts 文件 AST，
 * 抽取 BinaryExpression(=) 赋值语句与 IfStatement / SwitchStatement 条件分支；
 * 无赋值则维度失败（代码无状态转移，与 TLA+ Next 不对应）。
 *
 * 校验：抽取到的赋值语句数 > 0（无赋值则代码无状态转移，与 TLA+ Next 不对应）
 *
 * 边界处理：
 *   - codeFiles 为空数组 → 视为违规（passed=false），而非跳过
 *     （与维度1「无 codeModule 时视为违规而非跳过」的边界策略一致）
 *   - 存在文件但总赋值数为 0 → 视为违规（代码无状态转移）
 *
 * @param files 已抽取的 CodeFile 数组
 * @returns DimensionResult
 */
export function checkCodeStateTransfer(files: CodeFile[]): DimensionResult {
  const violations: string[] = [];
  const structuredViolations: StructuredViolation[] = [];
  if (!Array.isArray(files) || files.length === 0) {
    return {
      passed: false,
      checked: 0,
      violations: ['codeFiles 为空，无代码状态转移可校验'],
      structuredViolations: [
        { rule: CODE_TLA_RULES.D2, field: 'codeFiles', message: 'codeFiles 为空，无代码状态转移可校验' },
      ],
    };
  }

  let totalAssignments = 0;
  for (const f of files) {
    totalAssignments += f.assignments.length;
  }

  if (totalAssignments === 0) {
    const msg = '代码中未抽取到任何赋值语句（BinaryExpression + =），无法与 TLA+ Next 状态转移对应';
    violations.push(msg);
    structuredViolations.push({ rule: CODE_TLA_RULES.D2, field: 'codeFiles[*].assignments', message: msg });
  }

  return {
    passed: violations.length === 0,
    checked: totalAssignments,
    violations,
    structuredViolations,
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
  const parts = name.split(/[_-]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  // 第一段首字母小写，后续段首字母大写
  const firstPart = parts[0];
  if (firstPart === undefined) return '';
  const first = firstPart.charAt(0).toLowerCase() + firstPart.slice(1);
  const rest = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
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
  if (!nextMatch || nextMatch[1] === undefined) return [];
  const body = nextMatch[1];
  // 抽取 \/ 后的动作名（可能带括号，如 \/ (A \/ B)，这里只取顶层 \/ 分隔的标识符）
  // 正则中用字符类 [\\][/] 匹配字面量 "\/"（反斜杠+斜杠），避免 \/ 被解析为 Unicode 转义
  const actions: string[] = [];
  const re = new RegExp('[\\\\][/]\\s*([A-Za-z_][A-Za-z0-9_]*)', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const actionName = m[1];
    if (actionName !== undefined) actions.push(actionName);
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
    function visit(node: TsType.Node): void {
      if (ts.isFunctionDeclaration(node) && node.name) {
        names.push(node.name.text);
      } else if (ts.isMethodDeclaration(node) && node.name) {
        names.push(node.name.getText(f.ast));
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (d.name && ts.isIdentifier(d.name) && d.initializer) {
            // 箭头函数 / 函数表达式赋值给变量：const register = () => {}
            if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) {
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
 * 维度3：Next 分支对应校验（spec §3.4.2 维度3；SSoT §10.8.1 算法 3）
 *
 * 设计依据：
 *   - SSoT §10.8.1 维度3：正则抽取 TLA+ `Next` 分支动作名，驼峰匹配代码方法名
 *     （如 Logout → logout，StartNewArticle → startNewArticle）；每个 Next 分支须有对应代码方法。
 *   - SSoT §3.4.6 P2.8「TLA+ Next 分支命名约定」：TLA+ Action 名 PascalCase，代码方法名
 *     camelCase，本维度支持 PascalCase→camelCase 自动映射。
 *   - SSoT §3.4.7 P3.9「Next 分支覆盖扩展」：遍历 tla-manifest.json 全部 specs 的 Next actions
 *     （旧实现仅遍历 L4 specs；新实现覆盖 L1/L2/L3/L4 全部 specs）。
 *
 * 校验逻辑：
 *   - 正则抽取 `Next ==` 后的 `\/` 分隔动作名
 *   - 抽取代码中 FunctionDeclaration/MethodDeclaration 的 name
 *   - 驼峰匹配 + 名称相似度匹配（包含匹配，不要求精确 1:1）
 *   - 无对应则失败
 *
 * 边界处理：
 *   - .tla 文本无 `Next ==` 定义（actions 为空）→ 无可校验项，跳过并视为通过
 *     （与维度4 无 BusinessInvariant 定义即跳过的策略一致；维度3/4 均为「有定义才强校验」）
 *
 * @param tlaContent .tla 文件文本内容
 * @param files      CodeFile 数组
 * @returns DimensionResult
 */
export function checkNextBranchCoverage(tlaContent: string, files: CodeFile[]): DimensionResult {
  const violations: string[] = [];
  const structuredViolations: StructuredViolation[] = [];
  const actions = extractNextActions(tlaContent);
  if (actions.length === 0) {
    // 无 Next 定义时跳过（无可校验项，视为通过）
    return { passed: true, checked: 0, violations: [], structuredViolations };
  }

  const codeFunctionNames = extractCodeFunctionNames(files);
  // 同时准备驼峰形式和小写形式，做包含匹配
  const codeNamesLower = codeFunctionNames.map((n) => n.toLowerCase());

  let covered = 0;
  for (const action of actions) {
    const camel = toCamelCase(action);
    const lower = action.toLowerCase();
    // 匹配策略（任一即视为对应；依据 P2.8：TLA+ Action PascalCase → 代码方法 camelCase）：
    //   1. 代码函数名（小写）包含动作名（小写），或反之
    //   2. 代码函数名（小写）包含驼峰动作名（小写），或反之
    const matched = codeNamesLower.some(
      (cn) =>
        cn.includes(lower) ||
        lower.includes(cn) ||
        cn.includes(camel.toLowerCase()) ||
        camel.toLowerCase().includes(cn),
    );
    if (matched) {
      covered++;
    } else {
      const msg = `TLA+ Next 分支 "${action}" 在代码中无对应函数/方法实现（驼峰名 "${camel}"）`;
      violations.push(msg);
      structuredViolations.push({ rule: CODE_TLA_RULES.D3, field: 'tlaContent', message: msg });
    }
  }

  return {
    passed: violations.length === 0,
    checked: actions.length,
    violations,
    structuredViolations,
  };
}

// ==================== 维度4：断言覆盖不变式 ====================

/**
 * 从 TLA+ 文本中抽取 BusinessInvariant/Invariants == 定义后的所有子不变式名（/\ 分隔）。
 *
 * 形如：
 *   BusinessInvariant ==
 *       /\ TypeInvariant
 *       /\ TokenIssuedRequiresAuthenticated
 *       /\ LoggedOutImpliesNoToken
 *
 *   Invariants ==
 *       /\ TypeOK
 *       /\ InitInvariant
 *
 * @param tlaContent .tla 文件文本内容
 * @returns 子不变式名数组
 */
export function extractBusinessInvariants(tlaContent: string): string[] {
  if (typeof tlaContent !== 'string' || tlaContent.length === 0) return [];
  // 匹配 BusinessInvariant 或 Invariants 两种命名（SSoT 第28轮 D 组修正：
  // code-tla-logic 不变式正则兼容 `Invariants ==` 两种命名），直到下一个顶层定义或文件末尾
  const invMatch = tlaContent.match(
    /(?:BusinessInvariant|Invariants)\s*==\s*([\s\S]*?)(?=\n\s*[A-Z][A-Za-z0-9_]*\s*==|\n\s*====|$)/,
  );
  if (!invMatch || invMatch[1] === undefined) return [];
  const body = invMatch[1];
  const invariants: string[] = [];
  // 正则中用字符类 [/][\\] 匹配字面量 "/\"（斜杠+反斜杠，TLA+ 合取符号）
  const re = new RegExp('[/][\\\\]\\s*([A-Za-z_][A-Za-z0-9_]*)', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const invName = m[1];
    if (invName !== undefined) invariants.push(invName);
  }
  return invariants;
}

/**
 * 维度4：断言覆盖不变式校验（spec §3.4.2 维度4；SSoT §10.8.1 算法 4）
 *
 * 设计依据：SSoT §10.8.1 维度4——抽取 .tla 文件 `BusinessInvariant` 子不变式名，
 * 匹配代码中 `assert` / `invariant` / `require` 调用；宽松策略（有断言即认为覆盖），
 * 违反 → invariantCoverage 维度失败。
 *
 * 校验逻辑：
 *   - 正则抽取 `BusinessInvariant/Invariants ==` 后的 `/\` 分隔子不变式名
 *   - 抽取代码中含 assert/invariant/require 的 ExpressionStatement
 *   - 宽松策略：有断言即认为覆盖（不要求 1:1 对应）
 *   - 无覆盖则失败
 *
 * 边界处理：
 *   - .tla 文本无 `BusinessInvariant/Invariants ==` 定义（invariants 为空）→
 *     无可校验项，跳过并视为通过（有定义才强校验）
 *
 * @param tlaContent .tla 文件文本内容
 * @param files      CodeFile 数组
 * @returns DimensionResult
 */
export function checkInvariantCoverage(tlaContent: string, files: CodeFile[]): DimensionResult {
  const invariants = extractBusinessInvariants(tlaContent);
  if (invariants.length === 0) {
    // 无 BusinessInvariant/Invariants 定义时跳过
    return { passed: true, checked: 0, violations: [], structuredViolations: [] };
  }

  // 统计代码中的断言数
  // 如果 CodeFile.assertions 已抽取（CLI 注入），直接用；否则自动抽取（保持纯函数自洽）
  let totalAssertions = 0;
  for (const f of files) {
    const assertions = Array.isArray(f.assertions) ? f.assertions : extractCodeStateTransfers(f.ast, f.path).assertions;
    totalAssertions += assertions.length;
  }

  const violations: string[] = [];
  const structuredViolations: StructuredViolation[] = [];
  if (totalAssertions === 0) {
    const msg = `代码中未抽取到任何断言（assert/invariant/require），无法覆盖 TLA+ BusinessInvariant 的 ${invariants.length} 个子不变式`;
    violations.push(msg);
    structuredViolations.push({ rule: CODE_TLA_RULES.D4, field: 'codeFiles[*].assertions', message: msg });
  }

  return {
    passed: violations.length === 0,
    checked: invariants.length,
    violations,
    structuredViolations,
  };
}

// ==================== 主入口 ====================

/**
 * 代码-TLA+ 一致性校验主入口（纯逻辑，单点事实源）。
 *
 * 设计依据：SSoT §10.8.1「代码-TLA+ 一致性回归（check-code-tla-consistency.ts）」——
 * 阶段 5（编码）的代码与 TLA+ 规格一致性回归门禁，将 TLA+ 资产作为状态机验证器回归编码产物；
 * 触发方：G 子代理在 S 产出代码后跑（编排者不跑，反模式 #10）。
 *
 * 聚合四维度校验（SSoT §10.8.1 算法 1-5，汇总 passed = 维度1 ∧ 维度2 ∧ 维度3 ∧ 维度4）：
 *   1. checkSdToCodeModule（维度1：SD→codeModule 映射）
 *   2. checkCodeStateTransfer（维度2：代码状态转移抽取）
 *   3. checkNextBranchCoverage（维度3：Next 分支对应）
 *   4. checkInvariantCoverage（维度4：断言覆盖不变式）
 *
 * 维度3/4 需要从 manifest.specs[].tlaContent 读取 .tla 文件内容（CLI 注入）。
 * 多个 spec 的 tlaContent 会合并校验：任一 spec 的 Next 分支无对应 → 失败。
 *
 * 边界处理：
 *   - input 非对象 / schema 前置校验失败 → 直接返回失败，不进入四维度业务校验
 *     （INPUT/SCHEMA 规则，A2b 双轨过渡新增）
 *   - manifest 无任何 spec 含 tlaContent → 维度3/4 跳过（视为通过）；维度1/2 仍照常强校验
 *
 * @param input CodeTlaConsistencyInput（manifest + graph + rtm + codeFiles）
 * @returns ConsistencyResult
 */
export function checkCodeTlaConsistency(input: CodeTlaConsistencyInput): ConsistencyResult {
  const violations: Violation[] = [];
  const structuredViolations: StructuredViolation[] = [];

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
      structuredViolations: [{ rule: CODE_TLA_RULES.INPUT, field: 'input', message: 'input 必须为对象' }],
    };
  }

  // === Schema 前置校验（借鉴点 2 — 借鉴 drawio-skill/styles/schema.json） ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方四维度业务规则校验（SD→codeModule / 状态转移 / Next 分支 / 不变式覆盖）。
  // 注意：schema 兼容两种形态 —— codeSources（CLI/test）与 codeFiles（运行时含 AST）；
  // 校验对象为 manifest + graph + rtm 的结构形状，不要求 codeSources 字段。
  // codeFiles 含 TypeScript AST（不可 JSON 序列化），从 schema 校验中剔除。
  const schemaInput = {
    manifest: input.manifest,
    graph: input.graph,
    rtm: input.rtm,
  };
  const schemaResult = validateBySchema('code-tla-manifest', schemaInput);
  if (!schemaResult.valid) {
    const schemaViolations: Violation[] = schemaResult.errorMessages.map((m) => ({
      dimension: 'schema',
      message: `[schema] ${m}`,
    }));
    return {
      passed: false,
      dimensions: {
        sdToCodeModule: { passed: false, checked: 0, violations: [] },
        codeStateTransfer: { passed: false, checked: 0, violations: [] },
        nextBranchCoverage: { passed: false, checked: 0, violations: [] },
        invariantCoverage: { passed: false, checked: 0, violations: [] },
      },
      violations: schemaViolations,
      structuredViolations: schemaViolations.map((v) => ({
        rule: CODE_TLA_RULES.SCHEMA,
        field: 'manifest/graph/rtm',
        message: v.message,
      })),
    };
  }

  // 维度1：SD→codeModule 映射
  const sdToCodeModule = checkSdToCodeModule(input.graph, input.rtm);
  for (const v of sdToCodeModule.violations) {
    violations.push({ dimension: 'sdToCodeModule', message: v });
  }
  // A2b：直接透传子维度结构化违规（保留 graph.nodes[3].id 等细粒度 field），不再字符串重新派生粗粒度 field
  if (sdToCodeModule.structuredViolations && sdToCodeModule.structuredViolations.length > 0) {
    structuredViolations.push(...sdToCodeModule.structuredViolations);
  }

  // 维度2：代码状态转移抽取
  // 如果 codeFiles 已含 assignments/conditionals/assertions（CLI 注入），直接用；
  // 否则按需重新抽取（保持纯函数自洽）。
  const codeFilesWithExtract: CodeFile[] = (input.codeFiles ?? []).map((f) => {
    if (f.assignments.length > 0 || f.conditionals.length > 0 || f.assertions.length > 0) {
      return f;
    }
    return extractCodeStateTransfers(f.ast, f.path);
  });
  const codeStateTransfer = checkCodeStateTransfer(codeFilesWithExtract);
  for (const v of codeStateTransfer.violations) {
    violations.push({ dimension: 'codeStateTransfer', message: v });
  }
  // A2b：直接透传子维度结构化违规（保留 codeFiles[*].assignments 等细粒度 field）
  if (codeStateTransfer.structuredViolations && codeStateTransfer.structuredViolations.length > 0) {
    structuredViolations.push(...codeStateTransfer.structuredViolations);
  }

  // 维度3/4：从 manifest.specs[].tlaContent 读取 .tla 文件内容
  // 多个 spec 的 tlaContent 拼接校验：任一 spec 的 Next 分支无对应 → 失败
  const specs = Array.isArray(input.manifest?.specs) ? input.manifest.specs : [];
  // P3.9（第 9 轮）扩展：遍历全部 specs（L1/L2/L3/L4）的 tlaContent，
  // 不再仅限 L2/L3。Next 分支与 BusinessInvariant 可定义于任意层级。
  const tlaSpecs = specs.filter((s) => s && typeof s.tlaContent === 'string');

  // 维度3：Next 分支对应
  let nextPassed = true;
  const nextViolations: string[] = [];
  const nextStructuredViolations: StructuredViolation[] = [];
  let nextChecked = 0;
  if (tlaSpecs.length === 0) {
    // 无 spec 的 tlaContent → 跳过（视为通过）
  } else {
    for (const spec of tlaSpecs) {
      const r = checkNextBranchCoverage(spec.tlaContent ?? '', codeFilesWithExtract);
      nextChecked += r.checked;
      if (!r.passed) {
        nextPassed = false;
        for (const v of r.violations) {
          nextViolations.push(`规格 ${spec.id}: ${v}`);
        }
        // A2b：透传子维度结构化违规，message 保留「规格 ${spec.id}:」前缀（与 violations 文本一致），field 保持细粒度
        for (const sv of r.structuredViolations ?? []) {
          const prefixed = { ...sv, message: `规格 ${spec.id}: ${sv.message}` };
          nextStructuredViolations.push(prefixed);
          structuredViolations.push(prefixed);
        }
      }
    }
  }
  const nextBranchCoverage: DimensionResult = {
    passed: nextPassed,
    checked: nextChecked,
    violations: nextViolations,
    structuredViolations: nextStructuredViolations,
  };
  for (const v of nextViolations) {
    violations.push({ dimension: 'nextBranchCoverage', message: v });
  }

  // 维度4：断言覆盖不变式
  let invPassed = true;
  const invViolations: string[] = [];
  const invStructuredViolations: StructuredViolation[] = [];
  let invChecked = 0;
  if (tlaSpecs.length === 0) {
    // 无 spec 的 tlaContent → 跳过
  } else {
    for (const spec of tlaSpecs) {
      const r = checkInvariantCoverage(spec.tlaContent ?? '', codeFilesWithExtract);
      invChecked += r.checked;
      if (!r.passed) {
        invPassed = false;
        for (const v of r.violations) {
          invViolations.push(`规格 ${spec.id}: ${v}`);
        }
        // A2b：透传子维度结构化违规，message 保留「规格 ${spec.id}:」前缀，field 保持细粒度
        for (const sv of r.structuredViolations ?? []) {
          const prefixed = { ...sv, message: `规格 ${spec.id}: ${sv.message}` };
          invStructuredViolations.push(prefixed);
          structuredViolations.push(prefixed);
        }
      }
    }
  }
  const invariantCoverage: DimensionResult = {
    passed: invPassed,
    checked: invChecked,
    violations: invViolations,
    structuredViolations: invStructuredViolations,
  };
  for (const v of invViolations) {
    violations.push({ dimension: 'invariantCoverage', message: v });
  }

  const passed =
    sdToCodeModule.passed && codeStateTransfer.passed && nextBranchCoverage.passed && invariantCoverage.passed;

  return {
    passed,
    dimensions: {
      sdToCodeModule,
      codeStateTransfer,
      nextBranchCoverage,
      invariantCoverage,
    },
    violations,
    structuredViolations,
  };
}
