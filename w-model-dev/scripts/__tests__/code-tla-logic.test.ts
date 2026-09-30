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
  extractBusinessInvariants,
  checkCodeTlaConsistency,
  toCamelCase,
  type CodeTlaConsistencyInput,
  type CodeFile,
  type Graph,
  type Rtm,
  type TlaManifest,
} from '../logic/code-tla-logic.js';

// ==================== 辅助构造函数 ====================

function makeGraph(sds: string[]): Graph {
  return {
    nodes: sds.map((id) => ({ id, type: 'SD' })),
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
  it('SD 映射对（2 态：前缀条目通过 / 缺映射 SDMAP-1 失败点名并提示回填时机）', () => {
    for (const [场景, sds, mappings, 期望] of [
      [
        'SD 有对应 codeModule（前缀精确条目）',
        ['SD-AUTH'],
        [
          {
            requirementId: 'REQ-001',
            codeModule: 'SD-AUTH:src/services/auth.service.ts:L1-9',
          },
        ],
        {
          passed: true,
          checked: 1,
          contains: [] as string[],
          minViolations: 0,
        },
      ],
      [
        'SD 缺少 codeModule 映射（SD-REVIEW 无对应）',
        ['SD-AUTH', 'SD-REVIEW'],
        [
          {
            requirementId: 'REQ-001',
            codeModule: 'SD-AUTH:src/services/auth.service.ts:L1-9',
          },
        ],
        {
          passed: false,
          checked: 2,
          contains: ['SD-REVIEW 无对应 codeModule', 'SDMAP-1', '阶段5编码后必须回填'],
          minViolations: 1,
        },
      ],
    ] as const) {
      const graph = makeGraph([...sds]);
      const rtm = makeRtm(mappings.map((m) => ({ ...m })));
      const result = checkSdToCodeModule(graph, rtm);
      expect(result.passed, `${场景}: passed 应为 ${期望.passed}`).toBe(期望.passed);
      expect(result.checked, `${场景}: checked 应为 ${期望.checked}`).toBe(期望.checked);
      expect(result.violations.length, `${场景}: violations 数量下限`).toBeGreaterThanOrEqual(期望.minViolations);
      for (const marker of 期望.contains) {
        expect(
          result.violations.some((v) => v.includes(marker)),
          `${场景}: 应含「${marker}」`,
        ).toBe(true);
      }
      if (期望.minViolations === 0) {
        expect(result.violations, `${场景}: 应零违规`).toHaveLength(0);
      }
    }
  });

  it('批次1 前缀精确后子串包含不再通过（SD-Article-Service → article.controller.ts 为 SDMAP-1 失败）', () => {
    // 旧语义：SD-Article-Service 拆段 "articleservice" 包含匹配路径即通过（已废除）
    const graph = makeGraph(['SD-Article-Service']);
    const rtm = makeRtm([
      {
        requirementId: 'REQ-002',
        codeModule: 'src/controllers/article.controller.ts',
      },
    ]);
    const result = checkSdToCodeModule(graph, rtm);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('SDMAP-1'))).toBe(true);
  });

  it('前缀形态正例：SD-Article-Service:src/controllers/article.controller.ts:L1-9 通过', () => {
    const graph = makeGraph(['SD-Article-Service']);
    const rtm = makeRtm([
      {
        requirementId: 'REQ-002',
        codeModule: 'SD-Article-Service:src/controllers/article.controller.ts:L1-9',
      },
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
    // P1.4：violation 须明确指出回填时机
    expect(result.violations.some((v) => v.includes('阶段5编码后必须回填'))).toBe(true);
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
    expect(extracted.assignments.some((a) => a.text.includes('x = 2'))).toBe(true);
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

  it('checkCodeStateTransfer 通过行（1 态：有赋值）', () => {
    const source = `let x = 1; x = 2;`;
    const file = makeCodeFile(source);
    const extracted = extractCodeStateTransfers(file.ast, file.path);
    const result = checkCodeStateTransfer([extracted]);
    expect(result.passed).toBe(true);
    expect(result.checked).toBeGreaterThanOrEqual(1);
  });

  it('checkCodeStateTransfer 失败行（2 态：无赋值 / 空文件列表）', () => {
    for (const [场景, source] of [
      ['无赋值', `const y = 1; function foo() { return y; }`],
      ['空文件列表', null],
    ] as const) {
      let result: ReturnType<typeof checkCodeStateTransfer>;
      if (source === null) {
        result = checkCodeStateTransfer([]);
      } else {
        const file = makeCodeFile(source);
        const extracted = extractCodeStateTransfers(file.ast, file.path);
        result = checkCodeStateTransfer([extracted]);
      }
      expect(result.passed, `${场景}: 应 fail`).toBe(false);
      if (场景 === '无赋值') {
        expect(result.violations.length, `${场景}: 应有违规`).toBeGreaterThanOrEqual(1);
      }
    }
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

  it('Next 分支对（2 态：有对应函数通过 checked=3 / 无对应失败点名 Register）', () => {
    for (const [场景, source, 期望Passed, marker] of [
      [
        'Next 分支在代码中有对应函数',
        `
      function register(user) { return user; }
      function login(u, p) { return true; }
      function logout(token) { return; }
    `,
        true,
        null,
      ],
      ['Next 分支无对应代码', `function doSomething() {}`, false, /Register/i],
    ] as const) {
      const file = makeCodeFile(source);
      const result = checkNextBranchCoverage(tlaWithNext, [file]);
      expect(result.passed, `${场景}: passed 应为 ${String(期望Passed)}`).toBe(期望Passed);
      if (marker) {
        expect(
          result.violations.some((v) => marker.test(v)),
          `${场景}: 应点名 ${marker}`,
        ).toBe(true);
      } else {
        expect(result.checked, `${场景}: checked 应为 3`).toBe(3);
      }
    }
  });

  it('Next 驼峰/包含匹配对（2 态：Register → register / LoginAction → login）', () => {
    for (const [场景, tla, source] of [
      ['驼峰匹配：Register → register', `Next == \\/ Register`, `function register() {}`],
      ['包含匹配：LoginAction → login', `Next == \\/ LoginAction`, `function login() {}`],
    ] as const) {
      const file = makeCodeFile(source);
      const result = checkNextBranchCoverage(tla, [file]);
      expect(result.passed, `${场景}: 应通过`).toBe(true);
    }
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

  it('断言调用族（3 态：assert / invariant / require 调用均通过）', () => {
    for (const [形式, source, assertChecked] of [
      [
        'assert 调用',
        `
      function check() {
        assert(tokenIssued === 1, 'token must be issued');
      }
    `,
        true,
      ],
      [
        'invariant 调用',
        `
      function verify() {
        invariant(state === 'ok');
      }
    `,
        false,
      ],
      [
        'require 调用',
        `
      function load(x) {
        require(x > 0, 'x must be positive');
      }
    `,
        false,
      ],
    ] as const) {
      const file = makeCodeFile(source);
      const result = checkInvariantCoverage(tlaWithInvariant, [file]);
      expect(result.passed, `代码含 ${形式} 时应通过`).toBe(true);
      if (assertChecked) {
        expect(result.checked, `代码含 ${形式} 时 checked 应 ≥1`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('无断言对照（2 态：无任何断言失败 / 无 BusinessInvariant 定义通过 checked=0）', () => {
    for (const [场景, tla, source, 期望Passed, assertCheckedZero] of [
      ['代码无任何断言', tlaWithInvariant, `function foo() { return 1; }`, false, false],
      ['无 BusinessInvariant 定义', `NoInvariantHere == 1`, `function foo() {}`, true, true],
    ] as const) {
      const file = makeCodeFile(source);
      const result = checkInvariantCoverage(tla, [file]);
      expect(result.passed, `${场景}: passed 应为 ${String(期望Passed)}`).toBe(期望Passed);
      if (!期望Passed) {
        expect(result.violations.length, `${场景}: 应有违规`).toBeGreaterThanOrEqual(1);
      }
      if (assertCheckedZero) {
        expect(result.checked, `${场景}: checked 应为 0`).toBe(0);
      }
    }
  });

  it('G-D D1: Invariants == 命名提取子不变式', () => {
    const tla = `
Invariants ==
    /\\ TypeOK
    /\\ AuthInvariant
`;
    const invariants = extractBusinessInvariants(tla);
    expect(invariants).toContain('TypeOK');
    expect(invariants).toContain('AuthInvariant');
    expect(invariants.length).toBe(2);
  });

  it('G-D D1: Invariants == 下 checkInvariantCoverage 正确检测断言', () => {
    const tla = `
Invariants ==
    /\\ TypeOK
`;
    const source = `function foo() { invariant(x > 0); }`;
    const file = makeCodeFile(source);
    const result = checkInvariantCoverage(tla, [file]);
    expect(result.passed).toBe(true);
  });
});

// ==================== 批次1：D1 前缀精确 + classification + 零交集守卫 ====================

describe('批次1 D1 前缀精确 + 分类 + 零交集', () => {
  function sdGraph(ids: string[]): Graph {
    return { nodes: ids.map((id) => ({ id, type: 'SD' })), edges: [] };
  }
  function rtmWith(codeModule: string): Rtm {
    return { rows: [{ requirementId: 'REQ-001', codeModule }] };
  }
  function makeInput(overrides: Partial<CodeTlaConsistencyInput> = {}): CodeTlaConsistencyInput {
    return {
      manifest: makeManifest(),
      graph: sdGraph([]),
      rtm: rtmWith('src/x.ts:L1-9'),
      codeFiles: [],
      ...overrides,
    };
  }

  it('D1 前缀精确：SD-AUTH 条目须为 SD-AUTH:src/…（无前缀 src/auth.ts 不再通过）', () => {
    const r = checkCodeTlaConsistency(
      makeInput({
        graph: sdGraph(['SD-AUTH']),
        rtm: rtmWith('src/auth.ts:L1-9'),
      }),
    );
    expect(r.dimensions.sdToCodeModule.passed).toBe(false);
    expect(r.dimensions.sdToCodeModule.structuredViolations?.some((v) => v.rule === 'SDMAP-1')).toBe(true);
  });

  it('D1 语义违规 classification=semantic', () => {
    const r = checkCodeTlaConsistency(
      makeInput({
        graph: sdGraph(['SD-AUTH']),
        rtm: rtmWith('SD-BILLING:src/b.ts:L1'),
      }),
    );
    expect(r.dimensions.sdToCodeModule.structuredViolations?.find((v) => v.rule === 'SDMAP-1')?.classification).toBe(
      'semantic',
    );
  });

  it('零交集守卫：图 SD 集与 REQ 条目 SD 集均非空且无交集 → cannot prove same system', () => {
    const r = checkCodeTlaConsistency(makeInput({ graph: sdGraph(['SD-A']), rtm: rtmWith('SD-B:src/b.ts:L1') }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.message.includes('cannot prove same system'))).toBe(true);
    expect(r.structuredViolations?.some((v) => v.rule === 'INPUT-NO-SHARED-SD')).toBe(true);
    expect(r.structuredViolations?.find((v) => v.rule === 'INPUT-NO-SHARED-SD')?.classification).toBe('topology');
  });

  it('部分交集不触发守卫：SD-REVIEW 缺映射仍由 SDMAP-1 正常差异上报（无 INPUT-NO-SHARED-SD）', () => {
    const graph = sdGraph(['SD-AUTH', 'SD-REVIEW']);
    const rtm: Rtm = {
      rows: [{ requirementId: 'REQ-001', codeModule: 'SD-AUTH:src/auth.ts:L1-9' }],
    };
    const r = checkCodeTlaConsistency(makeInput({ graph, rtm }));
    expect(r.passed).toBe(false);
    expect(r.structuredViolations?.some((v) => v.rule === 'INPUT-NO-SHARED-SD')).toBe(false);
    // 「无对应 codeModule」子串为 self-test CODE_TLA_CASES 正则（/SD-REVIEW 无对应 codeModule/）依赖
    expect(r.dimensions.sdToCodeModule.violations.some((v) => v.includes('SD-REVIEW 无对应 codeModule'))).toBe(true);
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
      rtm: makeRtm([{ requirementId: 'REQ-001', codeModule: 'SD-AUTH:src/auth.ts:L1-9' }]),
      codeFiles: [file],
    };
    // 注入 tlaContent（CLI 读取后注入）
    input.manifest.specs[0]!.tlaContent = tlaContent;
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
    expect(result.violations.some((v) => v.dimension === 'sdToCodeModule')).toBe(true);
  });
});

// ==================== 辅助函数 toCamelCase ====================

describe('toCamelCase 辅助函数', () => {
  it('命名矩阵（4 态：首字母小写 / 保持驼峰 / 去下划线 / 空串）', () => {
    for (const [input, expected] of [
      ['Register', 'register'],
      ['LoginAction', 'loginAction'],
      ['Reset_Cycle', 'resetCycle'],
      ['', ''],
    ] as const) {
      expect(toCamelCase(input), `toCamelCase(${JSON.stringify(input)})`).toBe(expected);
    }
  });
});
