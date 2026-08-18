import { describe, expect, it } from 'vitest';

import {
  runDocConsistencyChecks,
  extractMarkdownRelLinks,
  type DocConsistencyInput,
} from '../logic/docs-consistency-logic.js';

/** run-log.schema.json action.enum 27 值（与 schema 逐值一致、同序；审计修复 P2 同步源） */
const ACTION_ENUM_27 = [
  'chunk',
  'cross',
  'evolve',
  'produce',
  'review',
  'gate',
  'tla-gate',
  'graph-gate',
  'test',
  'checkpoint',
  'rework',
  'rollback',
  'rootcause',
  'fix',
  'emergency-fix',
  'escalate',
  'r3-completeness',
  'r3-reliability',
  'r3-security',
  'codegraph_query',
  'opsx_explore',
  'opsx_propose',
  'opsx_apply',
  'opsx_archive',
  'ensure_deps',
  'iceberg-sweep',
  'iceberg-review',
];

/** data-models.md RunLogEntry.action 联合类型（27 值，与 ACTION_ENUM_27 一致） */
const ACTION_UNION_27 =
  "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'emergency-fix' | 'escalate' | 'r3-completeness' | 'r3-reliability' | 'r3-security' | 'codegraph_query' | 'opsx_explore' | 'opsx_propose' | 'opsx_apply' | 'opsx_archive' | 'ensure_deps' | 'iceberg-sweep' | 'iceberg-review';";

/** scripts/cli 当前 31 个脚本名（fixture 自洽：与 cliScriptFiles / dispatchMatrix / SKILL「N 个 .ts」一致） */
const CLI_SCRIPT_NAMES = [
  'check-archive-integrity',
  'check-artifact-gate',
  'check-bdd-model',
  'check-budget',
  'check-checkpoint',
  'check-code-tla-consistency',
  'check-codegraph-queries',
  'check-design-contract-consistency',
  'check-docs-consistency',
  'check-exemption',
  'check-iceberg-sweep',
  'check-maturity',
  'check-openspec-archive',
  'check-opsx-artifacts',
  'check-preventive-review',
  'check-requirement-coverage',
  'check-requirement-graph',
  'check-role-dispatch',
  'check-rootcause-report',
  'check-run-log',
  'check-samples-coverage',
  'check-signature-chain',
  'check-state-machine-consistency',
  'check-tla-bdd-sync',
  'check-tla-model',
  'check-verifier-output',
  'ensure-codegraph-opsx',
  'metrics-report',
  'security-scan',
  'self-test',
  'wm-status',
];

function baseInput(overrides: Partial<DocConsistencyInput> = {}): DocConsistencyInput {
  return {
    schemaFiles: ['verifier-output.schema.json', 'run-log.schema.json', 'iceberg-sweep.schema.json'],
    personaCount: 28,
    exit2ScriptCount: 31,
    referencesCount: 53,
    dataModels: [
      '### Schema 清单（20 份）',
      '| `verifier-output` | `verifier-output.schema.json` | ... |',
      '| `run-log` | `run-log.schema.json` | ... | action enum（27 类） |',
      '| `iceberg-sweep` | `iceberg-sweep.schema.json` | ... |',
      '## RunLogEntry',
      ACTION_UNION_27,
    ].join('\n'),
    verifierSpec: 'targetKind 枚举：requirement / design / code / test / rootcause。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme:
      '**当前版本**：`41.11.0`\n8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n28 个人格文件\n40 files / 530 tests',
    antiPatterns:
      '反模式清单（#1~#48；\n## 反模式清单\n| # | 反模式（不要做） | 危害 | 正确做法 |\n| 1 | 跳过阶段门评审 | 缺陷后移 | 走完评审 |\n| 48 | 大规模重构式改动 | 变更量子无穷大 | 小步重构 |',
    glossary: '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 27 值）：`review` / `gate` / ...',
    runLogSchema: JSON.stringify({
      properties: { action: { enum: ACTION_ENUM_27 } },
    }),
    skill:
      '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n见 [references/operation-behaviors.md](references/operation-behaviors.md)。\n## 不可违反的约束\n见 [references/hard-constraints.md](references/hard-constraints.md)。\n| `references/`（53 个 .md） | 按需加载 |\n| `scripts/cli/`（31 个 .ts） | 仅 G 子代理执行 |',
    operationBehaviors: '## 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    hardConstraints: Array.from({ length: 14 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    agents: '31 个脚本\n40 个 .test.ts / 530 条',
    pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.11.0' }),
    metaJson: JSON.stringify({ name: 'w-model-dev', version: '41.11.0' }),
    installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.11.0\n```',
    ssot: [
      '### 4A.1 八条核心操作行为',
      '8 条核心操作行为',
      '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      '| **签名链完整性** | ... |',
    ].join('\n'),
    changelog: '# Changelog\n\n## [41.11.0] - 2026-08-14\n\n- 示例条目\n',
    dispatchMatrix: ['# 分派矩阵', '## 6. 门禁脚本清单', ...CLI_SCRIPT_NAMES.map((n) => `- ${n}`)].join('\n'),
    cliScriptFiles: CLI_SCRIPT_NAMES.map((n) => `${n}.ts`),
    designDocs: [],
    testFileCount: 40,
    vitestTestCount: 530,
    prePush: '# 16. prettier-check\n# 与原 CI 一致：16 项检查\n# vitest 全量（530 tests）',
    scriptsChanged: false,
    securityBaselineEntryCount: -1,
    ...overrides,
  };
}

describe('runDocConsistencyChecks', () => {
  it('全部一致时零违规', () => {
    expect(runDocConsistencyChecks(baseInput())).toEqual([]);
  });

  it('schema 清单缺行 → 违规', () => {
    const input = baseInput({
      dataModels: '### Schema 清单（20 份）\n| `verifier-output` | ... |',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'schema-list' && x.message.includes('iceberg-sweep.schema.json'))).toBe(true);
  });

  it('schema 清单标题份数不符 → 违规', () => {
    const input = baseInput({
      dataModels:
        '### Schema 清单（19 份）\n| `verifier-output` | ... |\n| `run-log` | ... |\n| `iceberg-sweep` | ... |',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('20 份'))).toBe(
      true,
    );
  });

  it('run-log action 枚举长度非 27 → 违规', () => {
    const input = baseInput({
      runLogSchema: JSON.stringify({
        properties: { action: { enum: ['a', 'b'] } },
      }),
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27'))).toBe(
      true,
    );
  });

  it('data-models run-log 行非 27 类 → 违规', () => {
    const input = baseInput({
      dataModels: '### Schema 清单（20 份）\n| `run-log` | ... | action enum（15 类） |',
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27 类')),
    ).toBe(true);
  });

  it('targetKind 废弃标记残留 → 违规', () => {
    const input = baseInput({
      commandReference: 'targetKind=file 路由 code-reviewer',
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'targetkind' && x.message.includes('targetKind=file')),
    ).toBe(true);
  });

  it('README 残留 5 维度 DoD → 违规', () => {
    const input = baseInput({
      readme: '5 维度（功能 / 质量 / 测试 / 文档 / 部署）',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('5 维度'))).toBe(true);
  });

  it('definition-of-done 缺七维度标题 → 违规', () => {
    const input = baseInput({ definitionOfDone: '## 五维度标准' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('七维度标准'))).toBe(
      true,
    );
  });

  it('README 缺 8 条操作行为 → 违规', () => {
    const input = baseInput({ readme: '6 条核心操作行为' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors')).toBe(true);
  });

  it('SKILL.md 操作行为表缺第 8 行内容 → 违规', () => {
    const input = baseInput({ operationBehaviors: '## 八条操作行为' });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'operating-behaviors' && x.message.includes('Structure Over Persuasion'),
      ),
    ).toBe(true);
  });

  it('SKILL.md 内联八条操作行为完整表 → 违规（已移入 references）', () => {
    const input = baseInput({
      skill:
        '---\nname: w-model-dev\nversion: 41.11.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors' && x.message.includes('不应再内联')),
    ).toBe(true);
  });

  it('SKILL.md 缺操作行为指针 → 违规', () => {
    const input = baseInput({
      skill: '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n（无指针）',
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'operating-behaviors' && x.message.includes('operation-behaviors.md'),
      ),
    ).toBe(true);
  });

  it('硬约束编号缺失 → 违规', () => {
    const input = baseInput({
      hardConstraints: Array.from({ length: 13 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'hard-constraints' && x.message.includes('## #14'))).toBe(true);
  });

  it('硬约束编号超出 → 违规', () => {
    const input = baseInput({
      hardConstraints: Array.from({ length: 15 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'hard-constraints' && x.message.includes('#15'))).toBe(true);
  });

  it('SKILL.md 缺硬约束指针 → 违规', () => {
    const input = baseInput({
      skill: '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 不可违反的约束\n（无指针）',
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'hard-constraints' && x.message.includes('hard-constraints.md'),
      ),
    ).toBe(true);
  });

  it('SSoT §4A.1 缺权威标题 → 违规', () => {
    const input = baseInput({
      ssot: [
        '8 条核心操作行为',
        '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
        '| **签名链完整性** | ... |',
      ].join('\n'),
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors' && x.message.includes('权威标题')),
    ).toBe(true);
  });

  it('SSoT §4A.1 标题仍为七条 → 违规（过时守卫）', () => {
    const input = baseInput({ ssot: '### 4A.1 七条核心操作行为' });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'operating-behaviors' && x.message.includes('七条核心操作行为'),
      ),
    ).toBe(true);
  });

  it('反模式最大编号非 46 / 旧区间残留 → 违规', () => {
    const input = baseInput({
      antiPatterns: '反模式清单（#1~#29；\n| 43 | ... |',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('48'))).toBe(true);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('| 48 | 被错放主清单表外（检测信号表）→ 违规（归属盲区修复）', () => {
    const input = baseInput({
      antiPatterns:
        '反模式清单（#1~#48；\n## 反模式清单\n| # | 反模式（不要做） | 危害 | 正确做法 |\n| 47 | 大规模重构式改动 | ... |\n### 命中高发阶段\n| 阶段 | 高发反模式编号 |\n### 检测信号与回退命令\n| # | 检测信号 | 命中后回退命令 |\n| 48 | 子代理越界实施 | 回退当前阶段起点 |',
    });
    const v = runDocConsistencyChecks(input);
    expect(
      v.some((x) => x.check === 'anti-patterns' && x.message.includes('48') && x.message.includes('主清单表区间之外')),
    ).toBe(true);
  });

  it('| 48 | 缺主清单表头（仅在其他表出现）→ 违规', () => {
    const input = baseInput({
      antiPatterns:
        '反模式清单（#1~#48；\n### 检测信号与回退命令\n| # | 检测信号 | 命中后回退命令 |\n| 48 | 子代理越界实施 | 回退当前阶段起点 |',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('主清单表最大编号应为 48'))).toBe(true);
  });

  it('exit-2 脚本数声明 31 实测 29 → 违规；AGENTS 残留 29 → 过时违规', () => {
    const input = baseInput({ exit2ScriptCount: 29, agents: '31 个脚本' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('31') && x.message.includes('29'))).toBe(
      true,
    );
    const vStale = runDocConsistencyChecks(baseInput({ agents: '29 个脚本' }));
    expect(vStale.some((x) => x.check === 'exit2-scripts' && x.message.includes('仍含过时「29 个脚本」'))).toBe(true);
  });

  it('pre-push 编号最大值非 16 → 违规', () => {
    const input = baseInput({
      prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('16'))).toBe(true);
  });

  it('glossary action 含 verify → 违规', () => {
    const input = baseInput({
      glossary: '### action（RunLogEntry）\n`verify` / `gate`',
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'glossary-action' && x.message.includes('verify')),
    ).toBe(true);
  });

  it('资产计数不符 → 违规', () => {
    const input = baseInput({ personaCount: 27 });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('28'))).toBe(true);
    // references 计数漂移 → 违规
    const vRef = runDocConsistencyChecks(baseInput({ referencesCount: 56 }));
    expect(vRef.some((x) => x.check === 'references-count' && x.message.includes('53'))).toBe(true);
    const vSkill = runDocConsistencyChecks(
      baseInput({
        skill: '---\nversion: 41.11.0\n---\n无 references 计数表述',
      }),
    );
    expect(vSkill.some((x) => x.check === 'references-count' && x.message.includes('53 个 .md'))).toBe(true);
  });

  it('SKILL.md 声明 references 计数高于实测 → 违规（文档方向）', () => {
    const input = baseInput({
      skill: baseInput().skill.replace('（53 个 .md）', '（60 个 .md）'),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'references-count' && x.message.includes('60') && x.message.includes('53'))).toBe(
      true,
    );
  });

  it('README 声明 persona 计数与实测不符 → 违规（文档方向）', () => {
    const input = baseInput({
      readme: baseInput().readme.replace('28 个人格文件', '27 个人格文件'),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('27') && x.message.includes('28'))).toBe(
      true,
    );
  });

  it('README 声明 files 计数与实测不符 → 违规（文档方向）', () => {
    const input = baseInput({
      readme: baseInput().readme.replace('40 files', '50 files'),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'vitest-files' && x.message.includes('50'))).toBe(true);
  });

  it('AGENTS 声明 .test.ts 计数与实测不符 → 违规（文档方向）', () => {
    const input = baseInput({ agents: '31 个脚本\n50 个 .test.ts / 530 条' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'vitest-files' && x.message.includes('50'))).toBe(true);
  });

  it('targetkind 违规消息含来源文档名', () => {
    const input = baseInput({ verifierSpec: 'targetKind=file 路由' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'targetkind' && x.message.includes('verifier-spec'))).toBe(true);
  });

  it('run-log schema 解析失败仅报一条违规', () => {
    const input = baseInput({ runLogSchema: 'not-json{' });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'run-log-action');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('解析失败');
  });

  it('data-models 缺 Schema 清单标题 → 违规', () => {
    const input = baseInput({ dataModels: '| `verifier-output` | ... |' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('20 份'))).toBe(
      true,
    );
  });

  it('design-docs 含废弃 targetKind → 违规', () => {
    const input = baseInput({
      designDocs: [
        {
          name: 'llm-verifier',
          content: '`targetKind`（`requirement` / `design` / `testcase` / `file`）targetKind=file 路由',
        },
      ],
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('llm-verifier')),
    ).toBe(true);
  });

  it('design-docs 含五维度 → 违规', () => {
    const input = baseInput({
      designDocs: [{ name: 'loop-engineering', content: '五维度标准' }],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('五维度'))).toBe(
      true,
    );
  });

  it('design-docs 含旧反模式区间 → 违规', () => {
    const input = baseInput({
      designDocs: [{ name: 'legacy-doc', content: '反模式 #1~#29' }],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('#1~#29'))).toBe(
      true,
    );
  });

  it('design-docs 干净时零违规', () => {
    const input = baseInput({
      designDocs: [
        {
          name: 'x',
          content: 'requirement / design / code / test\n五维度扩展为七维度，新增「理解证据」',
        },
      ],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs')).toBe(false);
  });

  it('vitest 文件数非 40 → 违规', () => {
    const input = baseInput({ testFileCount: 41 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-files' && x.message.includes('40'))).toBe(
      true,
    );
  });

  it('README/AGENTS 缺 vitest 文件数表述 → 违规', () => {
    const input = baseInput({
      readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      agents: '31 个脚本',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-files');
    expect(v.length).toBeGreaterThan(0);
  });

  it('vitest 实测用例总数缺失于 README → 违规', () => {
    const input = baseInput({
      readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n40 files',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('README.md') && x.message.includes('530'))).toBe(true);
  });

  it('vitest 实测用例总数缺失于 AGENTS → 违规', () => {
    const input = baseInput({ agents: '31 个脚本\n40 个 .test.ts' });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('AGENTS.md') && x.message.includes('530'))).toBe(true);
  });

  it('vitest 实测用例总数缺失于 pre-push → 违规', () => {
    const input = baseInput({
      prePush: '# 15. samples-coverage\n# 与原 CI 一致：15 项检查',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('.githooks/pre-push') && x.message.includes('530'))).toBe(true);
  });

  it('vitest 用例总数无法采集（-1）→ 不产生 vitest-tests 违规', () => {
    const input = baseInput({ vitestTestCount: -1 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('vitest 用例总数三处文档均同步 → 零 vitest-tests 违规', () => {
    const input = baseInput();
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('scripts 有变更且 baseline 缺失 → baseline-sync 违规', () => {
    const input = baseInput({
      scriptsChanged: true,
      securityBaselineEntryCount: -1,
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'baseline-sync');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('.eslintsecurity-baseline.json');
  });

  it('scripts 有变更且 baseline 空 → baseline-sync 违规', () => {
    const input = baseInput({
      scriptsChanged: true,
      securityBaselineEntryCount: 0,
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'baseline-sync');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('指纹条目为空');
  });

  it('scripts 无变更即使 baseline 缺失 → 无 baseline-sync 违规', () => {
    const input = baseInput({
      scriptsChanged: false,
      securityBaselineEntryCount: -1,
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'baseline-sync')).toBe(false);
  });

  it('scripts 有变更且 baseline 非空 → 无 baseline-sync 违规', () => {
    const input = baseInput({
      scriptsChanged: true,
      securityBaselineEntryCount: 42,
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'baseline-sync')).toBe(false);
  });

  it('版本六处一致 → 零 version-consistency 违规', () => {
    expect(runDocConsistencyChecks(baseInput()).some((x) => x.check === 'version-consistency')).toBe(false);
  });

  it('README 版本漂移 → 违规', () => {
    const input = baseInput({
      readme: '**当前版本**：`41.2.0`\n8 条核心操作行为',
    });
    const v = runDocConsistencyChecks(input);
    expect(
      v.some((x) => x.check === 'version-consistency' && x.message.includes('README') && x.message.includes('41.2.0')),
    ).toBe(true);
  });

  it('package.json 为唯一源：其版本漂移导致其余四处报违规（自身不再直接报）', () => {
    const input = baseInput({
      pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.2.0' }),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'version-consistency');
    expect(v.some((x) => x.message.includes('skill-metadata.json'))).toBe(true);
    expect(v.some((x) => x.message.includes('SKILL.md frontmatter'))).toBe(true);
    expect(v.some((x) => x.message.includes('README'))).toBe(true);
    expect(v.some((x) => x.message.includes('INSTALL.md'))).toBe(true);
    expect(v.some((x) => x.message.includes('package.json'))).toBe(false);
  });

  it('skill-metadata.json 版本漂移 → 违规', () => {
    const input = baseInput({
      metaJson: JSON.stringify({ name: 'w-model-dev', version: '42.0.0' }),
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('skill-metadata.json'),
      ),
    ).toBe(true);
  });

  it('SKILL.md frontmatter 版本漂移 → 违规', () => {
    const input = baseInput({
      skill:
        '---\nname: w-model-dev\nversion: 41.0.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('SKILL.md frontmatter'),
      ),
    ).toBe(true);
  });

  it('INSTALL.md 激活示例版本漂移 → 违规', () => {
    const input = baseInput({
      installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.0.0\n```',
    });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'version-consistency' && x.message.includes('INSTALL.md')),
    ).toBe(true);
  });

  it('package.json 不可解析 → 违规（fail loud）', () => {
    const input = baseInput({ pkgJson: 'not-json{' });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'version-consistency' && x.message.includes('无法解析')),
    ).toBe(true);
  });

  it('CHANGELOG.md 缺版本节头 → version-consistency 违规', () => {
    const input = baseInput({ changelog: '# Changelog\n\n- 无版本节头\n' });
    const v = runDocConsistencyChecks(input);
    expect(
      v.some(
        (x) => x.check === 'version-consistency' && x.message.includes('CHANGELOG') && x.message.includes('41.11.0'),
      ),
    ).toBe(true);
  });

  it('CHANGELOG.md 版本节头漂移 → version-consistency 违规', () => {
    const input = baseInput({
      changelog: '# Changelog\n\n## [41.10.0] - 2026-08-13\n\n- 旧条目\n',
    });
    const v = runDocConsistencyChecks(input);
    expect(
      v.some(
        (x) => x.check === 'version-consistency' && x.message.includes('CHANGELOG') && x.message.includes('41.10.0'),
      ),
    ).toBe(true);
  });

  it('CHANGELOG.md 版本节头一致 → 零 version-consistency 违规', () => {
    const input = baseInput();
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'version-consistency')).toBe(false);
  });

  it('SSoT 顶层章节号连续（含字母后缀章 4A/10C/11A）→ 零 ssot-headings 违规', () => {
    const lines: string[] = [];
    for (let n = 1; n <= 11; n++) lines.push(`## ${n}. 标题${n}`);
    // 字母后缀章归并到基础号，不新增基础号：4A / 10A / 10C / 11A
    lines.push('## 4A. 标题4', '## 10A. 标题10', '## 10C. 标题10', '## 11A. 标题11');
    const input = baseInput({ ssot: lines.join('\n') });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'ssot-headings')).toBe(false);
  });

  it('SSoT 顶层章节号缺号 → ssot-headings 违规', () => {
    const input = baseInput({
      ssot: ['## 1. 项目概述', '## 2. 理论基础', '## 4. 工作流'].join('\n'),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'ssot-headings');
    expect(v.some((x) => x.message.includes('缺 3'))).toBe(true);
  });

  it('SSoT 未决占位标题（3.3.x）→ ssot-headings 违规', () => {
    const input = baseInput({
      ssot: '## 3. 技能架构设计\n\n### 3.3.x 外部工具集成\n\n## 4. 技能工作流程',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'ssot-headings');
    expect(v.some((x) => x.message.includes('3.3.x'))).toBe(true);
  });

  it('SSoT 无编号顶层章 → ssot-headings 守卫跳过（零违规）', () => {
    const input = baseInput({
      ssot: '### 4A.1 八条核心操作行为\n纯文本无章节号',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'ssot-headings')).toBe(false);
  });

  it('全部脚本已登记 + SKILL 计数一致 → 零 script-registry 违规', () => {
    expect(runDocConsistencyChecks(baseInput()).some((x) => x.check === 'script-registry')).toBe(false);
  });

  it('dispatch-matrix 漏登记某脚本 → script-registry 违规', () => {
    const input = baseInput({
      dispatchMatrix: [
        '# 分派矩阵',
        ...CLI_SCRIPT_NAMES.filter((n) => n !== 'check-tla-model').map((n) => `- ${n}`),
      ].join('\n'),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'script-registry');
    expect(v.some((x) => x.message.includes('check-tla-model') && x.message.includes('未登记'))).toBe(true);
  });

  it('SKILL.md 声明 .ts 计数与实测不符 → script-registry 违规', () => {
    const input = baseInput({
      skill: baseInput().skill.replace('（31 个 .ts）', '（30 个 .ts）'),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'script-registry');
    expect(v.some((x) => x.message.includes('30') && x.message.includes('31'))).toBe(true);
  });

  it('cliScriptFiles 为空 → script-registry 守卫跳过（零违规）', () => {
    const input = baseInput({ cliScriptFiles: [] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'script-registry')).toBe(false);
  });
});

describe('run-log action 枚举语义同步（data-models.md interface vs schema enum）', () => {
  it('interface 联合类型缺值时应报 run-log-action 漂移 violation', () => {
    // dataModels 含「action enum（27 类）」文本但 interface 只有 15 值（复刻当前漂移）
    const drifted = [
      '### Schema 清单（20 份）',
      '| `run-log` | ... | action enum（27 类） |',
      '## RunLogEntry',
      "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'escalate';",
    ].join('\n');
    const input = baseInput({ dataModels: drifted });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'run-log-action');
    expect(v.some((x) => x.message.includes('漂移'))).toBe(true);
  });

  it('interface 与 enum 完全一致时无漂移 violation', () => {
    const synced = [
      '### Schema 清单（20 份）',
      '| `run-log` | ... | action enum（27 类） |',
      '## RunLogEntry',
      ACTION_UNION_27,
    ].join('\n');
    const input = baseInput({ dataModels: synced });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'run-log-action');
    expect(v.some((x) => x.message.includes('漂移'))).toBe(false);
  });

  it('interface 含 enum 之外的额外值时应报带「多」的 run-log-action 漂移 violation', () => {
    // 在 27 值基础上追加 enum 之外的多余值
    const drifted = [
      '### Schema 清单（20 份）',
      '| `run-log` | ... | action enum（27 类） |',
      '## RunLogEntry',
      ACTION_UNION_27.replace("'iceberg-review';", "'iceberg-review' | 'bogus-action';"),
    ].join('\n');
    const input = baseInput({ dataModels: drifted });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'run-log-action');
    expect(v.some((x) => x.message.includes('漂移') && x.message.includes('多 bogus-action'))).toBe(true);
  });
});

describe('内链存在性检查（internal-links，C3）', () => {
  it('extractMarkdownRelLinks：提取相对链接 + 剥锚点/query + 跳过外部 URL/纯锚点/代码块', () => {
    const content = [
      '详见 [词汇表](./glossary.md) 与 [SSoT](../docs/ssot.md#top)。', // 相对链接 + 锚点剥离
      '图片 ![架构](./assets/arch.png?raw=true) 也提取（query 剥离）。', // 图片内层 + query 剥离
      '[外部](https://example.com/x.md) 与 [邮箱](mailto:a@b.c) 跳过。',
      '[纯锚点](#section) 跳过。',
      '```ts',
      'const bad = "[示例](./not-a-link.md)"; // 围栏内不提取',
      '```',
      '行内 `[cmd](./inline.md)` code span 不提取。',
      '[带标题](./tla-guide.md "可选 title") title 形式可提取。',
    ].join('\n');
    expect(extractMarkdownRelLinks(content)).toEqual([
      './glossary.md',
      '../docs/ssot.md',
      './assets/arch.png',
      './tla-guide.md',
    ]);
  });

  it('linkDocs/linkExists 缺省 → 守卫跳过（零 internal-links 违规，fixture 兼容）', () => {
    expect(runDocConsistencyChecks(baseInput()).some((x) => x.check === 'internal-links')).toBe(false);
  });

  it('内链全部存在 → 零违规', () => {
    const input = baseInput({
      linkDocs: [
        {
          name: 'SKILL.md',
          content: '见 [操作行为](./references/operation-behaviors.md) 与 [约束](references/hard-constraints.md)。',
          baseDir: 'w-model-dev',
        },
        {
          name: 'README.md',
          content: '见 [SKILL](./w-model-dev/SKILL.md)。',
          baseDir: '.',
        },
      ],
      linkExists: (p) =>
        [
          'w-model-dev/references/operation-behaviors.md',
          'w-model-dev/references/hard-constraints.md',
          'w-model-dev/SKILL.md',
        ].includes(p),
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'internal-links')).toBe(false);
  });

  it('断链 → violation 含文档名 + 归一化路径', () => {
    const input = baseInput({
      linkDocs: [
        {
          name: 'glossary.md',
          content: '见 [旧名](./renamed-guide.md)。',
          baseDir: 'w-model-dev/references',
        },
      ],
      linkExists: () => false,
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'internal-links');
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain('glossary.md 内链断链：./renamed-guide.md');
    expect(v[0]!.message).toContain('w-model-dev/references/renamed-guide.md');
  });

  it('../ 上溯目录 → POSIX 归一化路径正确（references → w-model-dev/SKILL.md）', () => {
    const seen: string[] = [];
    const input = baseInput({
      linkDocs: [
        {
          name: 'glossary.md',
          content: '见 [SKILL](../SKILL.md)。',
          baseDir: 'w-model-dev/references',
        },
      ],
      linkExists: (p) => {
        seen.push(p);
        return true;
      },
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'internal-links')).toBe(false);
    expect(seen).toEqual(['w-model-dev/SKILL.md']);
  });

  it('根目录 baseDir="." → 归一化去除 ./ 前缀（README 链接形态）', () => {
    const seen: string[] = [];
    const input = baseInput({
      linkDocs: [
        {
          name: 'README.md',
          content: '见 [CHANGELOG](./CHANGELOG.md)。',
          baseDir: '.',
        },
      ],
      linkExists: (p) => {
        seen.push(p);
        return true;
      },
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'internal-links')).toBe(false);
    expect(seen).toEqual(['CHANGELOG.md']);
  });
});
