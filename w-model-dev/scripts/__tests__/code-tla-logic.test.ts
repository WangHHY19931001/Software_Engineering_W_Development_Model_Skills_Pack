/**
 * code-tla-logic.ts 单元测试 —— 代码-TLA+ 一致性四维度校验
 *
 * 覆盖：
 *   - 维度1 checkSdToCodeModule：SD→codeModule 映射完整性
 *   - 维度2 extractCodeStateTransfers / checkCodeStateTransfer：代码状态转移抽取
 *   - 维度3 checkNextBranchCoverage：Next 分支对应
 *   - 维度4 checkInvariantCoverage：断言覆盖不变式
 *   - 主入口 checkCodeTlaConsistency：四维度聚合
 */

import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import {
  checkSdToCodeModule,
  extractCodeStateTransfers,
  checkCodeStateTransfer,
  checkNextBranchCoverage,
  checkInvariantCoverage,
  checkCodeTlaConsistency,
  toCamelCase,
  type CodeTlaConsistencyInput,
  type CodeFile,
  type Graph,
  type Rtm,
  type TlaManifest,
} from '../code-tla-logic.js';

// ==================== 辅助构造函数 ====================

function makeGraph(sds: string[]): Graph {
  return {
    nodes: sds.map(id => ({ id, type: 'SD' })),
    edges: [],
  };
}

function makeRtm(mappings: Array<{ requirementId: string; codeModule?: string }>): Rtm {
  return { rows: mappings };
}

function makeManifest(specs: Array<Partial<{ id: string; level: string; tlaPath: string }>> = []): TlaManifest {
  return {
    specs: specs.map((s, i) => ({
      id: s.id ?? `spec-${i}`,
      level: s.level ?? 'L2',
      phase: 2,
      system: 'demo',
      requirementIds: [],
      tlaPath: s.tlaPath ?? `tla/L2_${i}.tla`,
      cfgPath: `tla/L2_${i}.cfg`,
      parent: null,
      children: [],
    })),
  };
}

function makeCodeFile(source: string, filePath = 'src/sample.ts'): CodeFile {
  const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true);
  // 调用 extractCodeStateTransfers 填充 assignments/conditionals/assertions
  return extractCodeStateTransfers(ast, filePath);
}

// ==================== 维度1：SD→codeModule 映射 ====================

describe('维度1 checkSdToCodeModule', () => {
  it('SD 有对应 codeModule 时通过', () => {
    // SD-AUTH → "auth" 子串匹配 codeModule "src/services/auth.service.ts"
    const graph = makeGraph(['SD-AUTH']);
    const rtm = makeRtm([
      { requirementId: 'REQ-001', codeModule: 'src/services/auth.service.ts' },
    ]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(true);
    expect(result.checked).toBe(1);
    expect(result.violations).toHaveLength(0);
  });

  it('SD 缺少 codeModule 映射时失败', () => {
    const graph = makeGraph(['SD-AUTH', 'SD-REVIEW']);
    const rtm = makeRtm([
      { requirementId: 'REQ-001', codeModule: 'src/services/auth.service.ts' },
      // SD-REVIEW 无对应 codeModule
    ]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(false);
    expect(result.checked).toBe(2);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some(v => v.includes('SD-REVIEW'))).toBe(true);
  });

  it('SD id 去 "SD-" 前缀转小写后做包含匹配', () => {
    // SD-Article-Service → "articleservice" 应匹配 "src/controllers/article.controller.ts"
    const graph = makeGraph(['SD-Article-Service']);
    const rtm = makeRtm([
      { requirementId: 'REQ-002', codeModule: 'src/controllers/article.controller.ts' },
    ]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(true);
  });

  it('graph 无 SD 节点时通过（无可校验项）', () => {
    const graph: Graph = { nodes: [{ id: 'REQ-001', type: 'REQ' }], edges: [] };
    const rtm = makeRtm([{ requirementId: 'REQ-001', codeModule: 'src/x.ts' }]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(true);
    expect(result.checked).toBe(0);
  });

  it('rtm rows 为空时失败（若有 SD）', () => {
    const graph = makeGraph(['SD-AUTH']);
    const rtm = makeRtm([]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(false);
  });
});

// ==================== 维度2：代码状态转移抽取 ====================

describe('维度2 extractCodeStateTransfers / checkCodeStateTransfer', () => {
  it('抽取赋值语句（BinaryExpression + EqualsToken）', () => {
    const source = `
      let x = 1;
      x = 2;
      y += 3;
    `;
    const file = makeCodeFile(source);
    const extracted = extractCodeStateTransfers(file.ast, file.path);
    expect(extracted.assignments.length).toBeGreaterThanOrEqual(1);
    // 至少含 x = 2 这条
    expect(extracted.assignments.some(a => a.text.includes('x = 2'))).toBe(true);
  });

  it('抽取条件分支（IfStatement / SwitchStatement）', () => {
    const source = `
      if (x > 0) { y = 1; }
      switch (z) { case 1: break; }
    `;
    const file = makeCodeFile(source);
    const extracted = extractCodeStateTransfers(file.ast, file.path);
    expect(extracted.conditionals.length).toBeGreaterThanOrEqual(2);
  });

  it('checkCodeStateTransfer 有赋值时通过', () => {
    const source = `let x = 1; x = 2;`;
    const file = makeCodeFile(source);
    const extracted = extractCodeStateTransfers(file.ast, file.path);
    const result = checkCodeStateTransfer([extracted]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBeGreaterThanOrEqual(1);
  });

  it('checkCodeStateTransfer 无赋值时失败', () => {
    const source = `const y = 1; function foo() { return y; }`;
    const file = makeCodeFile(source);
    const extracted = extractCodeStateTransfers(file.ast, file.path);
    const result = checkCodeStateTransfer([extracted]);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('checkCodeStateTransfer 空文件列表时失败', () => {
    const result = checkCodeStateTransfer([]);
    expect(result.passed).toBe(false);
  });
});

// ==================== 维度3：Next 分支对应 ====================

describe('维度3 checkNextBranchCoverage', () => {
  const tlaWithNext = `
Next ==
    \\/ Register
    \\/ Login
    \\/ Logout
`;

  it('Next 分支在代码中有对应函数时通过', () => {
    const source = `
      function register(user) { return user; }
      function login(u, p) { return true; }
      function logout(token) { return; }
    `;
    const file = makeCodeFile(source);
    const result = checkNextBranchCoverage(tlaWithNext, [file]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBe(3);
  });

  it('Next 分支无对应代码时失败', () => {
    const source = `function doSomething() {}`;
    const file = makeCodeFile(source);
    const result = checkNextBranchCoverage(tlaWithNext, [file]);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => /Register/i.test(v))).toBe(true);
  });

  it('驼峰匹配：Register → register', () => {
    const tla = `Next == \\/ Register`;
    const source = `function register() {}`;
    const file = makeCodeFile(source);
    const result = checkNextBranchCoverage(tla, [file]);
    expect(result.passed).toBe(true);
  });

  it('包含匹配：LoginAction → login', () => {
    const tla = `Next == \\/ LoginAction`;
    const source = `function login() {}`;
    const file = makeCodeFile(source);
    const result = checkNextBranchCoverage(tla, [file]);
    expect(result.passed).toBe(true);
  });

  it('无 Next 定义时通过（无可校验项）', () => {
    const tla = `NoNextHere == 1`;
    const file = makeCodeFile(`function foo() {}`);
    const result = checkNextBranchCoverage(tla, [file]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBe(0);
  });
});

// ==================== 维度4：断言覆盖不变式 ====================

describe('维度4 checkInvariantCoverage', () => {
  const tlaWithInvariant = `
BusinessInvariant ==
    /\\ TypeInvariant
    /\\ TokenIssuedRequiresAuthenticated
    /\\ LoggedOutImpliesNoToken
`;

  it('代码含 assert 调用时通过', () => {
    const source = `
      function check() {
        assert(tokenIssued === 1, 'token must be issued');
      }
    `;
    const file = makeCodeFile(source);
    const result = checkInvariantCoverage(tlaWithInvariant, [file]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBeGreaterThanOrEqual(1);
  });

  it('代码含 invariant 调用时通过', () => {
    const source = `
      function verify() {
        invariant(state === 'ok');
      }
    `;
    const file = makeCodeFile(source);
    const result = checkInvariantCoverage(tlaWithInvariant, [file]);
    expect(result.passed).toBe(true);
  });

  it('代码含 require 调用时通过', () => {
    const source = `
      function load(x) {
        require(x > 0, 'x must be positive');
      }
    `;
    const file = makeCodeFile(source);
    const result = checkInvariantCoverage(tlaWithInvariant, [file]);
    expect(result.passed).toBe(true);
  });

  it('代码无任何断言时失败', () => {
    const source = `function foo() { return 1; }`;
    const file = makeCodeFile(source);
    const result = checkInvariantCoverage(tlaWithInvariant, [file]);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('无 BusinessInvariant 定义时通过（无可校验项）', () => {
    const tla = `NoInvariantHere == 1`;
    const file = makeCodeFile(`function foo() {}`);
    const result = checkInvariantCoverage(tla, [file]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBe(0);
  });
});

// ==================== 主入口 checkCodeTlaConsistency ====================

describe('主入口 checkCodeTlaConsistency', () => {
  it('全维度通过时返回 passed=true', () => {
    const tlaContent = `
Next ==
    \\/ Register
    \\/ Login

BusinessInvariant ==
    /\\ TypeInvariant
`;
    const source = `
      let state = 'init';
      function register() { state = 'registered'; assert(state !== undefined); }
      function login() { state = 'authenticated'; }
    `;
    const file = makeCodeFile(source, 'src/auth.ts');
    const input: CodeTlaConsistencyInput = {
      manifest: makeManifest([{ level: 'L2' }]),
      graph: makeGraph(['SD-AUTH']),
      rtm: makeRtm([{ requirementId: 'REQ-001', codeModule: 'src/auth.ts' }]),
      codeFiles: [file],
    };
    // 注入 tlaContent（CLI 读取后注入）
    input.manifest.specs[0].tlaContent = tlaContent;
    const result = checkCodeTlaConsistency(input);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.dimensions.sdToCodeModule.passed).toBe(true);
    expect(result.dimensions.codeStateTransfer.passed).toBe(true);
    expect(result.dimensions.nextBranchCoverage.passed).toBe(true);
    expect(result.dimensions.invariantCoverage.passed).toBe(true);
  });

  it('维度1 失败时返回 passed=false 并带 violation', () => {
    const input: CodeTlaConsistencyInput = {
      manifest: makeManifest(),
      graph: makeGraph(['SD-MISSING']),
      rtm: makeRtm([{ requirementId: 'REQ-001', codeModule: 'src/x.ts' }]),
      codeFiles: [],
    };
    const result = checkCodeTlaConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.dimensions.sdToCodeModule.passed).toBe(false);
    expect(result.violations.some(v => v.dimension === 'sdToCodeModule')).toBe(true);
  });
});

// ==================== 辅助函数 toCamelCase ====================

describe('toCamelCase 辅助函数', () => {
  it('Register → register（首字母小写）', () => {
    expect(toCamelCase('Register')).toBe('register');
  });

  it('LoginAction → loginAction（保持驼峰）', () => {
    expect(toCamelCase('LoginAction')).toBe('loginAction');
  });

  it('Reset_Cycle → resetCycle（去下划线 + 后续单词首字母大写）', () => {
    expect(toCamelCase('Reset_Cycle')).toBe('resetCycle');
  });

  it('空字符串返回空', () => {
    expect(toCamelCase('')).toBe('');
  });
});
