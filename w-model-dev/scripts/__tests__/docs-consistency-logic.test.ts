import { describe, expect, it } from 'vitest';
import { runDocConsistencyChecks, type DocConsistencyInput } from '../logic/docs-consistency-logic.js';

function baseInput(overrides: Partial<DocConsistencyInput> = {}): DocConsistencyInput {
  return {
    schemaFiles: ['verifier-output.schema.json', 'run-log.schema.json', 'iceberg-sweep.schema.json'],
    personaCount: 28,
    cursorSkillCount: 23,
    exit2ScriptCount: 30,
    dataModels: [
      '### Schema 清单（20 份）',
      '| `verifier-output` | `verifier-output.schema.json` | ... |',
      '| `run-log` | `run-log.schema.json` | ... | action enum（27 类） |',
      '| `iceberg-sweep` | `iceberg-sweep.schema.json` | ... |',
    ].join('\n'),
    verifierSpec: '第 9 轮标准化：`meta.targetKind` 必须取自以下 4 值枚举。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n35 files / 530 tests',
    antiPatterns: '反模式清单（#1~#47；\n| 47 | 大规模重构... |',
    glossary: '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 27 值）：`review` / `gate` / ...',
    runLogSchema: JSON.stringify({ properties: { action: { enum: new Array(27).fill('x') } } }),
    skill: '### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    agents: '30 个脚本\n35 个 .test.ts / 530 条',
    ssot: [
      '### 4A.1 八条核心操作行为',
      '8 条核心操作行为',
      '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      '| **签名链完整性** | ... |',
    ].join('\n'),
    designDocs: [],
    testFileCount: 35,
    prePush: '# 14. docs-consistency\n# 与原 CI 一致：14 项检查',
    ...overrides,
  };
}

describe('runDocConsistencyChecks', () => {
  it('全部一致时零违规', () => {
    expect(runDocConsistencyChecks(baseInput())).toEqual([]);
  });

  it('schema 清单缺行 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `verifier-output` | ... |' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'schema-list' && x.message.includes('iceberg-sweep.schema.json'))).toBe(true);
  });

  it('schema 清单标题份数不符 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（19 份）\n| `verifier-output` | ... |\n| `run-log` | ... |\n| `iceberg-sweep` | ... |' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('20 份'))).toBe(true);
  });

  it('run-log action 枚举长度非 27 → 违规', () => {
    const input = baseInput({ runLogSchema: JSON.stringify({ properties: { action: { enum: ['a', 'b'] } } }) });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27'))).toBe(true);
  });

  it('data-models run-log 行非 27 类 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `run-log` | ... | action enum（15 类） |' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27 类'))).toBe(true);
  });

  it('targetKind 废弃标记残留 → 违规', () => {
    const input = baseInput({ commandReference: 'targetKind=file 路由 code-reviewer' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'targetkind' && x.message.includes('targetKind=file'))).toBe(true);
  });

  it('README 残留 5 维度 DoD → 违规', () => {
    const input = baseInput({ readme: '5 维度（功能 / 质量 / 测试 / 文档 / 部署）' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('5 维度'))).toBe(true);
  });

  it('definition-of-done 缺七维度标题 → 违规', () => {
    const input = baseInput({ definitionOfDone: '## 五维度标准' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('七维度标准'))).toBe(true);
  });

  it('README 缺 8 条操作行为 → 违规', () => {
    const input = baseInput({ readme: '6 条核心操作行为' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors')).toBe(true);
  });

  it('SKILL.md 操作行为表缺第 8 行内容 → 违规', () => {
    const input = baseInput({ skill: '### 八条操作行为' });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'operating-behaviors' && x.message.includes('Structure Over Persuasion'),
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
    const input = baseInput({ antiPatterns: '反模式清单（#1~#29；\n| 43 | ... |' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('47'))).toBe(true);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('exit-2 脚本数非 30 / AGENTS 残留 29 → 违规', () => {
    const input = baseInput({ exit2ScriptCount: 29, agents: '29 个脚本' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('30'))).toBe(true);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('29 个脚本'))).toBe(true);
  });

  it('pre-push 编号最大值非 14 → 违规', () => {
    const input = baseInput({ prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('14'))).toBe(true);
  });

  it('glossary action 含 verify → 违规', () => {
    const input = baseInput({ glossary: '### action（RunLogEntry）\n`verify` / `gate`' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'glossary-action' && x.message.includes('verify'))).toBe(true);
  });

  it('资产计数不符 → 违规', () => {
    const input = baseInput({ personaCount: 27, cursorSkillCount: 22 });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('28'))).toBe(true);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('23'))).toBe(true);
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
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('20 份'))).toBe(true);
  });

  it('design-docs 含废弃 targetKind → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'llm-verifier', content: '`targetKind`（`requirement` / `design` / `testcase` / `file`）targetKind=file 路由' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('llm-verifier'))).toBe(true);
  });

  it('design-docs 含五维度 → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'loop-engineering', content: '五维度标准' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('五维度'))).toBe(true);
  });

  it('design-docs 含旧反模式区间 → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'round9', content: '反模式 #1~#29' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('design-docs 干净时零违规', () => {
    const input = baseInput({ designDocs: [{ name: 'x', content: 'requirement / design / code / test\n五维度扩展为七维度，新增「理解证据」' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs')).toBe(false);
  });

  it('vitest 文件数非 35 → 违规', () => {
    const input = baseInput({ testFileCount: 36 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-files' && x.message.includes('35'))).toBe(true);
  });

  it('README/AGENTS 缺 vitest 文件数表述 → 违规', () => {
    const input = baseInput({ readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）', agents: '30 个脚本' });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-files');
    expect(v.length).toBeGreaterThan(0);
  });
});
