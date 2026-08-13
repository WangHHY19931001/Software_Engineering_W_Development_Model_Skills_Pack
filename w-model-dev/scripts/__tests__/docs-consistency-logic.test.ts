import { describe, expect, it } from 'vitest';

import { runDocConsistencyChecks, type DocConsistencyInput } from '../logic/docs-consistency-logic.js';

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
    ].join('\n'),
    verifierSpec: 'targetKind 枚举：requirement / design / code / test / rootcause。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme:
      '**当前版本**：`41.9.0`\n8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n35 files / 530 tests',
    antiPatterns: '反模式清单（#1~#47；\n| 47 | 大规模重构... |',
    glossary: '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 27 值）：`review` / `gate` / ...',
    runLogSchema: JSON.stringify({ properties: { action: { enum: new Array(27).fill('x') } } }),
    skill:
      '---\nname: w-model-dev\nversion: 41.9.0\n---\n## 核心操作行为\n见 [references/operation-behaviors.md](references/operation-behaviors.md)。\n## 不可违反的约束\n见 [references/hard-constraints.md](references/hard-constraints.md)。\n| `references/`（53 个 .md） | 按需加载 |',
    operationBehaviors: '## 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    hardConstraints: Array.from({ length: 14 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    agents: '31 个脚本\n35 个 .test.ts / 530 条',
    pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.9.0' }),
    metaJson: JSON.stringify({ name: 'w-model-dev', version: '41.9.0' }),
    installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.9.0\n```',
    ssot: [
      '### 4A.1 八条核心操作行为',
      '8 条核心操作行为',
      '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      '| **签名链完整性** | ... |',
    ].join('\n'),
    designDocs: [],
    testFileCount: 35,
    vitestTestCount: 530,
    prePush: '# 15. samples-coverage\n# 与原 CI 一致：15 项检查\n# vitest 全量（530 tests）',
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
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `verifier-output` | ... |' });
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
    const input = baseInput({ runLogSchema: JSON.stringify({ properties: { action: { enum: ['a', 'b'] } } }) });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27'))).toBe(
      true,
    );
  });

  it('data-models run-log 行非 27 类 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `run-log` | ... | action enum（15 类） |' });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27 类')),
    ).toBe(true);
  });

  it('targetKind 废弃标记残留 → 违规', () => {
    const input = baseInput({ commandReference: 'targetKind=file 路由 code-reviewer' });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'targetkind' && x.message.includes('targetKind=file')),
    ).toBe(true);
  });

  it('README 残留 5 维度 DoD → 违规', () => {
    const input = baseInput({ readme: '5 维度（功能 / 质量 / 测试 / 文档 / 部署）' });
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
    const input = baseInput({ skill: '---\nname: w-model-dev\nversion: 41.9.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...' });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors' && x.message.includes('不应再内联')),
    ).toBe(true);
  });

  it('SKILL.md 缺操作行为指针 → 违规', () => {
    const input = baseInput({ skill: '---\nname: w-model-dev\nversion: 41.9.0\n---\n## 核心操作行为\n（无指针）' });
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
    const input = baseInput({ skill: '---\nname: w-model-dev\nversion: 41.9.0\n---\n## 不可违反的约束\n（无指针）' });
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
    const input = baseInput({ antiPatterns: '反模式清单（#1~#29；\n| 43 | ... |' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('47'))).toBe(true);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('exit-2 脚本数非 31 / AGENTS 残留 29 → 违规', () => {
    const input = baseInput({ exit2ScriptCount: 29, agents: '29 个脚本' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('31'))).toBe(true);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('29 个脚本'))).toBe(true);
  });

  it('pre-push 编号最大值非 15 → 违规', () => {
    const input = baseInput({ prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('15'))).toBe(true);
  });

  it('glossary action 含 verify → 违规', () => {
    const input = baseInput({ glossary: '### action（RunLogEntry）\n`verify` / `gate`' });
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
      baseInput({ skill: '---\nversion: 41.9.0\n---\n无 references 计数表述' }),
    );
    expect(vSkill.some((x) => x.check === 'references-count' && x.message.includes('53 个 .md'))).toBe(true);
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
    const input = baseInput({ designDocs: [{ name: 'loop-engineering', content: '五维度标准' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('五维度'))).toBe(
      true,
    );
  });

  it('design-docs 含旧反模式区间 → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'legacy-doc', content: '反模式 #1~#29' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('#1~#29'))).toBe(
      true,
    );
  });

  it('design-docs 干净时零违规', () => {
    const input = baseInput({
      designDocs: [{ name: 'x', content: 'requirement / design / code / test\n五维度扩展为七维度，新增「理解证据」' }],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs')).toBe(false);
  });

  it('vitest 文件数非 35 → 违规', () => {
    const input = baseInput({ testFileCount: 36 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-files' && x.message.includes('35'))).toBe(
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
      readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n35 files',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('README.md') && x.message.includes('530'))).toBe(true);
  });

  it('vitest 实测用例总数缺失于 AGENTS → 违规', () => {
    const input = baseInput({ agents: '31 个脚本\n35 个 .test.ts' });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('AGENTS.md') && x.message.includes('530'))).toBe(true);
  });

  it('vitest 实测用例总数缺失于 pre-push → 违规', () => {
    const input = baseInput({ prePush: '# 15. samples-coverage\n# 与原 CI 一致：15 项检查' });
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
    const input = baseInput({ scriptsChanged: true, securityBaselineEntryCount: -1 });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'baseline-sync');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('.eslintsecurity-baseline.json');
  });

  it('scripts 有变更且 baseline 空 → baseline-sync 违规', () => {
    const input = baseInput({ scriptsChanged: true, securityBaselineEntryCount: 0 });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'baseline-sync');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('指纹条目为空');
  });

  it('scripts 无变更即使 baseline 缺失 → 无 baseline-sync 违规', () => {
    const input = baseInput({ scriptsChanged: false, securityBaselineEntryCount: -1 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'baseline-sync')).toBe(false);
  });

  it('scripts 有变更且 baseline 非空 → 无 baseline-sync 违规', () => {
    const input = baseInput({ scriptsChanged: true, securityBaselineEntryCount: 42 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'baseline-sync')).toBe(false);
  });

  it('五处版本一致 → 零 version-consistency 违规', () => {
    expect(runDocConsistencyChecks(baseInput()).some((x) => x.check === 'version-consistency')).toBe(false);
  });

  it('README 版本漂移 → 违规', () => {
    const input = baseInput({ readme: '**当前版本**：`41.2.0`\n8 条核心操作行为' });
    const v = runDocConsistencyChecks(input);
    expect(
      v.some((x) => x.check === 'version-consistency' && x.message.includes('README') && x.message.includes('41.2.0')),
    ).toBe(true);
  });

  it('package.json 版本漂移 → 违规', () => {
    const input = baseInput({ pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.2.0' }) });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('package.json'),
      ),
    ).toBe(true);
  });

  it('skill-metadata.json 版本漂移 → 违规', () => {
    const input = baseInput({ metaJson: JSON.stringify({ name: 'w-model-dev', version: '42.0.0' }) });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('skill-metadata.json'),
      ),
    ).toBe(true);
  });

  it('SKILL.md frontmatter 版本漂移 → 违规', () => {
    const input = baseInput({
      skill: '---\nname: w-model-dev\nversion: 41.0.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('SKILL.md frontmatter'),
      ),
    ).toBe(true);
  });

  it('INSTALL.md 激活示例版本漂移 → 违规', () => {
    const input = baseInput({ installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.0.0\n```' });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('INSTALL.md'),
      ),
    ).toBe(true);
  });

  it('package.json 不可解析 → 违规（fail loud）', () => {
    const input = baseInput({ pkgJson: 'not-json{' });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'version-consistency' && x.message.includes('无法解析'),
      ),
    ).toBe(true);
  });
});
