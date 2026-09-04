import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS,
  A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS,
  checkRootCauseR10Contract,
  canonicalizeExit2ProbeIdentity,
  countValidExit2Scripts,
  runDocConsistencyChecks,
  buildDocConsistencyReport,
  extractMarkdownRelLinks,
  checkSkillOutboundLinks,
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

const R10_CONTRACT_FIXTURE = [
  '<r10-contract id="canonical-name" relation=\'{"canonicalPersona":"testing-reality-checker"}\'>canonical persona is testing-reality-checker</r10-contract>',
  '<r10-contract id="threshold" relation=\'{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}\'>testing-reality-checker confidence >= 0.5</r10-contract>',
  '<r10-contract id="legacy-fallback" relation=\'{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}\'>legacy reality-checker is fallback only when canonical is absent</r10-contract>',
  '<r10-contract id="same-artifact-dedupe" relation=\'{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}\'>same artifact canonical-first and not counted twice</r10-contract>',
  '<r10-contract id="cross-artifact-conflict" relation=\'{"artifactRelation":"different","conflict":"fail-closed"}\'>different artifact conflict is fail-closed</r10-contract>',
  '<r10-contract id="canonical-duplicate" relation=\'{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}\'>canonical > 1 duplicate is fail-closed</r10-contract>',
  '<r10-contract id="legacy-duplicate" relation=\'{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}\'>legacy > 1 duplicate is fail-closed</r10-contract>',
].join('\n');

/** scripts/cli 当前 37 个脚本名（fixture 自洽：与 cliScriptFiles / dispatchMatrix / SKILL「N 个 .ts」一致） */
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
  'doctor',
  'ensure-codegraph-opsx',
  'metrics-report',
  'plan-chunks',
  'platform-deps-install',
  'security-scan',
  'self-test',
  'wm-export-evidence',
  'wm-status',
  'wm-verify-evidence-source',
  'wm-write',
];

function baseInput(overrides: Partial<DocConsistencyInput> = {}): DocConsistencyInput {
  return {
    schemaFiles: [
      'verifier-output.schema.json',
      'run-log.schema.json',
      'gate-log.schema.json',
      'iceberg-sweep.schema.json',
      'evidence-manifest.schema.json',
    ],
    personaCount: 28,
    exit2ScriptCount: 36,
    referencesCount: 53,
    rootCauseAuthoritySpec: R10_CONTRACT_FIXTURE,
    rootCauseSchema: R10_CONTRACT_FIXTURE,
    rootCauseCheckerSource: R10_CONTRACT_FIXTURE,
    rootCauseSsot: R10_CONTRACT_FIXTURE,
    rootCauseLocator: R10_CONTRACT_FIXTURE,
    rootCauseVerifierSpec: R10_CONTRACT_FIXTURE,
    rootCauseCommandReference: R10_CONTRACT_FIXTURE,
    dataModels: [
      '### Schema 清单（5 份）',
      '| `verifier-output` | `verifier-output.schema.json` | ... |',
      '| `run-log` | `run-log.schema.json` | ... | action enum（27 类） |',
      '| `gate-log` | `gate-log.schema.json` | ... | append-only gate-logs 审计记录 |',
      '| `iceberg-sweep` | `iceberg-sweep.schema.json` | ... |',
      '| `evidence-manifest` | `evidence-manifest.schema.json` | ... |',
      '## RunLogEntry',
      ACTION_UNION_27,
    ].join('\n'),
    verifierSpec: 'targetKind 枚举：requirement / design / code / test / rootcause。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme:
      '**当前版本**：`41.11.0`\n8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n28 个人格文件\n40 files / 530 tests\ncoverage/、.zcode/、.w-model/ 为 Git 忽略的本地生成物；使用 npm run wm:export-evidence -- <project-dir> <output-dir> 导出脱敏 SHA-256 manifest 证据包。docs/changes/archive/ 是受控归档。',
    antiPatterns:
      '反模式清单（#1~#48；\n## 反模式清单\n| # | 反模式（不要做） | 危害 | 正确做法 |\n| 1 | 跳过阶段门评审 | 缺陷后移 | 走完评审 |\n| 48 | 大规模重构式改动 | 变更量子无穷大 | 小步重构 |',
    glossary: '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 27 值）：`review` / `gate` / ...',
    runLogSchema: JSON.stringify({
      properties: { action: { enum: ACTION_ENUM_27 } },
    }),
    skill:
      '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n见 [references/operation-behaviors.md](references/operation-behaviors.md)。\n## 不可违反的约束\n见 [references/hard-constraints.md](references/hard-constraints.md)。\n| `references/`（53 个 .md） | 按需加载 |\n| `scripts/cli/`（37 个 .ts） | 仅 G 子代理执行 |',
    operationBehaviors: '## 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    hardConstraints: Array.from({ length: 14 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    agents:
      '36 个脚本\n40 个 .test.ts / 530 条\ncoverage/、.zcode/、.w-model/ 是 Git 忽略的本地生成物，不随 Git 交付；需要审计证据时运行 npm run wm:export-evidence -- <project-dir> <output-dir>。',
    pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.11.0' }),
    metaJson: JSON.stringify({ name: 'w-model-dev', version: '41.11.0' }),
    installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.11.0\n```',
    lockJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.11.0' }),
    ssot: [
      '### 3.1 整体架构',
      'graph LR',
      'subgraph SkillPackage[W-Model Skill 技能包]',
      'subgraph Host[宿主 Agent / 外部 LLM]',
      'subgraph Tools[可选外部工具]',
      'Host -. 使用技能包规则并执行 .-> SkillPackage',
      'Host -. 可选调用 .-> Tools',
      '图中的边界是交付契约：技能包只交付 Markdown 资产、Schema 与确定性 gate scripts；宿主 Agent / 外部 LLM 负责推理；TLA+ TLC、CodeGraph、OpenSpec 由宿主 Agent 按需接入；它们不属于技能包交付物。',
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
    vitestMeasurementsValid: true,
    vitestPassedCount: 530,
    vitestFailedCount: 0,
    vitestSuccess: true,
    vitestRunId: 'a'.repeat(16),
    vitestArtifactId: 'vitest/results.json',
    vitestArtifactSha256: 'b'.repeat(64),
    vitestCommitSha: 'c'.repeat(40),
    prePush: '# 17. typecheck\n# 与原 CI 一致：17 项检查\n# vitest 全量结果以当前命令输出为准',
    scriptsChanged: false,
    securityBaselineEntryCount: -1,
    a4Docs: {
      ssot: '状态锁使用 <target>.lock 和 owner；--lock-timeout 与 --recover-stale-lock。平台修复显式，不自动 npm install。',
      skill:
        '状态锁使用 <target>.lock 和 owner；--lock-timeout 与 --recover-stale-lock。平台修复显式，不自动 npm install。',
      dispatchMatrix: 'wm-write 使用 <target>.lock 与 owner，支持 --lock-timeout 和 --recover-stale-lock。',
      operationalRecovery:
        '状态写使用 <target>.lock 与 owner，不是仅 mtime 乐观锁。--lock-timeout 与 --recover-stale-lock 适用于陈旧锁。',
      dataModels:
        '状态写使用 <target>.lock 与 owner；锁内校验 mtime。--lock-timeout 与 --recover-stale-lock 适用于陈旧锁。',
      commandReference:
        '所有状态写通过 <target>.lock 与 owner；锁内校验 mtime。--lock-timeout 与 --recover-stale-lock 为 CLI 参数。',
      readme: 'pre-push 不自动 npm install；platform-deps:check 和 platform-deps:install 为显式入口。',
      install: 'pre-push 不自动 npm install；platform-deps:check 和 platform-deps:install 为显式入口。',
      agents: 'pre-push 不自动 npm install；platform-deps:check 和 platform-deps:install 为显式入口。',
      contributing: 'pre-push 不自动 npm install；platform-deps:check 和 platform-deps:install 为显式入口。',
      troubleshooting:
        'pre-push 不自动 npm install；不自动补装；platform-deps:check 和 platform-deps:install 为显式入口。',
      changelog: '状态写并发协议；显式平台修复；Vitest 用例采集 fail-closed 缺口尚未完成。',
    },
    ...overrides,
  };
}

describe('R10 七来源 source×clause 维护契约', () => {
  const sourceNames = [
    'authoritySpec',
    'schema',
    'checkerSource',
    'ssot',
    'locator',
    'verifierSpec',
    'commandReference',
  ] as const;
  const sourceLabels: Array<[(typeof sourceNames)[number], string]> = [
    ['authoritySpec', 'authority-spec'],
    ['schema', 'rootcause-schema'],
    ['checkerSource', 'rootcause-checker'],
    ['ssot', 'SSoT'],
    ['locator', 'root-cause-locator'],
    ['verifierSpec', 'verifier-spec'],
    ['commandReference', 'command-reference'],
  ];
  const sourceLabel = (sourceName: (typeof sourceNames)[number]): string =>
    sourceLabels.find(([name]) => name === sourceName)?.[1] ?? sourceName;
  const replaceSource = (
    sources: Record<(typeof sourceNames)[number], string>,
    sourceName: (typeof sourceNames)[number],
    value: string,
  ): Record<(typeof sourceNames)[number], string> => {
    switch (sourceName) {
      case 'authoritySpec':
        return { ...sources, authoritySpec: value };
      case 'schema':
        return { ...sources, schema: value };
      case 'checkerSource':
        return { ...sources, checkerSource: value };
      case 'ssot':
        return { ...sources, ssot: value };
      case 'locator':
        return { ...sources, locator: value };
      case 'verifierSpec':
        return { ...sources, verifierSpec: value };
      case 'commandReference':
        return { ...sources, commandReference: value };
    }
  };
  it('完整七来源七条 clause 通过，缺失任一 source fail-closed', () => {
    const sources = Object.fromEntries(sourceNames.map((name) => [name, R10_CONTRACT_FIXTURE])) as Record<
      (typeof sourceNames)[number],
      string
    >;
    expect(checkRootCauseR10Contract(sources)).toEqual([]);
    for (const sourceName of sourceNames) {
      const missing = replaceSource(sources, sourceName, '');
      const violations = checkRootCauseR10Contract(missing);
      expect(
        violations.some((violation) => violation.message.includes(`${sourceLabel(sourceName)} 未被独立读取`)),
      ).toBe(true);
    }
  });

  it.each(sourceNames)('%s 的每条 R10 clause mutation 均产生明确 violation', (sourceName) => {
    const clauseMutations: Array<[string, RegExp]> = [
      ['canonical-name', /^<r10-contract id="canonical-name"[^\n]*\n?/m],
      ['threshold', /^<r10-contract id="threshold"[^\n]*\n?/m],
      ['legacy-fallback', /^<r10-contract id="legacy-fallback"[^\n]*\n?/m],
      ['same-artifact-dedupe', /^<r10-contract id="same-artifact-dedupe"[^\n]*\n?/m],
      ['cross-artifact-conflict', /^<r10-contract id="cross-artifact-conflict"[^\n]*\n?/m],
      ['canonical-duplicate', /^<r10-contract id="canonical-duplicate"[^\n]*\n?/m],
      ['legacy-duplicate', /^<r10-contract id="legacy-duplicate"[^\n]*\n?/m],
    ];
    for (const [clauseName, mutation] of clauseMutations) {
      const mutated = R10_CONTRACT_FIXTURE.replace(mutation, '');
      const sources = Object.fromEntries(sourceNames.map((name) => [name, R10_CONTRACT_FIXTURE])) as Record<
        (typeof sourceNames)[number],
        string
      >;
      const mutatedSources = replaceSource(sources, sourceName, mutated);
      const violations = checkRootCauseR10Contract(mutatedSources);
      expect(
        violations.some(
          (violation) =>
            violation.check === 'rootcause-r10-contract' &&
            violation.message.includes(sourceLabel(sourceName)) &&
            violation.message.includes(clauseName),
        ),
        `${sourceName} / ${clauseName} must fail closed`,
      ).toBe(true);
    }
  });

  it.each([
    ['canonical-name', 'canonical is not testing-reality-checker'],
    ['threshold', 'testing-reality-checker confidence is not required to be >= 0.5'],
    ['legacy-fallback', 'legacy reality-checker is fallback, but canonical is not absent'],
    ['same-artifact-dedupe', 'same artifact legacy-first and counted twice'],
    ['cross-artifact-conflict', 'different artifact conflict is allowed'],
    ['canonical-duplicate', 'canonical > 1 duplicate is allowed'],
    ['legacy-duplicate', 'legacy > 1 duplicate is allowed'],
  ])('%s 的反向/否定语义 fail-closed', (clauseName, mutation) => {
    const sources = Object.fromEntries(sourceNames.map((name) => [name, R10_CONTRACT_FIXTURE])) as Record<
      (typeof sourceNames)[number],
      string
    >;
    const mutatedFixture = R10_CONTRACT_FIXTURE.split('\n')
      .map((line) =>
        line.includes(`<r10-contract id="${clauseName}"`)
          ? line.slice(0, line.indexOf('>') + 1) + mutation + '</r10-contract>'
          : line,
      )
      .join('\n');
    const mutatedSources = replaceSource(sources, 'authoritySpec', mutatedFixture);
    const violations = checkRootCauseR10Contract(mutatedSources);
    expect(
      violations.some(
        (violation) => violation.message.includes('authority-spec') && violation.message.includes(clauseName),
      ),
    ).toBe(true);
  });

  it('结构化宿主之外的 quoted/comment/fenced/example/context bypass 一律 fail-closed', () => {
    const valid = R10_CONTRACT_FIXTURE;
    const firstNode = valid.split('\n')[1];
    const prefix = '### R10 结构化契约节点\n| id | relation | prose |\n| --- | --- | --- |\n';
    const bypasses = [
      prefix + '> ' + firstNode,
      prefix + '```markdown\n' + valid + '\n```',
      prefix + '<!-- ' + firstNode + ' -->',
      prefix + '// ' + firstNode,
      '示例（非规范契约节点）：' + valid,
      JSON.stringify(valid.replace(/\n/g, ' ')),
    ];
    for (const content of bypasses) {
      const violations = checkRootCauseR10Contract({
        authoritySpec: content,
        schema: valid,
        checkerSource: valid,
        ssot: valid,
        locator: valid,
        verifierSpec: valid,
        commandReference: valid,
      });
      expect(violations.filter((violation) => violation.message.startsWith('authority-spec'))).toHaveLength(7);
    }
  });

  it('marker/relation/prose 必须位于同一结构化契约节点，拆分节点 fail-closed', () => {
    const rows = R10_CONTRACT_FIXTURE.split('\n');
    const splitNode =
      '<r10-contract id="canonical-name" relation=\'{"canonicalPersona":"testing-reality-checker"}\'></r10-contract>\n' +
      'canonical persona is testing-reality-checker\n' +
      rows.slice(1).join('\n');
    const violations = checkRootCauseR10Contract({
      authoritySpec: splitNode,
      schema: R10_CONTRACT_FIXTURE,
      checkerSource: R10_CONTRACT_FIXTURE,
      ssot: R10_CONTRACT_FIXTURE,
      locator: R10_CONTRACT_FIXTURE,
      verifierSpec: R10_CONTRACT_FIXTURE,
      commandReference: R10_CONTRACT_FIXTURE,
    });
    expect(
      violations.some(
        (violation) => violation.message.includes('authority-spec') && violation.message.includes('canonical-name'),
      ),
    ).toBe(true);
  });

  it('原始 ERROR_JSON 缺失、null 或逐字段 drift 不计入 exit2ScriptCount', () => {
    const valid = {
      probeId: 'check-budget.ts#invalid-argument',
      script: 'check-budget.ts',
      args: ['--d4-invalid-argument'],
      cwd: '<repoRoot>',
      status: 2,
      errorExitCode: 2,
      category: 'ARG_INVALID',
      rule: 'P0-1',
      rawErrorJson: { exitCode: 2, category: 'ARG_INVALID', rule: 'P0-1' },
    };
    for (const mutation of [
      { ...valid, rawErrorJson: undefined },
      { ...valid, rawErrorJson: null },
      { ...valid, rawErrorJson: { exitCode: 1, category: 'ARG_INVALID', rule: 'P0-1' } },
      { ...valid, rawErrorJson: { exitCode: 2, category: 'FILE_READ', rule: 'P0-1' } },
      { ...valid, rawErrorJson: { exitCode: 2, category: 'ARG_INVALID', rule: 'P0-99' } },
      { ...valid, rawErrorJson: { exitCode: 2, category: 'UNKNOWN', rule: 'P0-1' } },
    ]) {
      const report = buildDocConsistencyReport(baseInput({ exit2ProbeResults: [mutation as never] }));
      expect(report.dynamicViolations.some((violation) => violation.check === 'exit2-probe')).toBe(true);
      expect(countValidExit2Scripts([mutation])).toBe(0);
    }
  });

  it('七个真实 source 各自否定一条 R10 clause 时定位对应 source×clause violation', async () => {
    const sourceKeys = [
      'authoritySpec',
      'schema',
      'checkerSource',
      'ssot',
      'locator',
      'verifierSpec',
      'commandReference',
    ] as const;
    const readRealSource = async (sourceKey: (typeof sourceKeys)[number]): Promise<string> => {
      switch (sourceKey) {
        case 'authoritySpec':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/references/agent-personas.md'), 'utf8');
        case 'schema':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/schemas/rootcause-report.schema.json'), 'utf8');
        case 'checkerSource':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/scripts/logic/root-cause-logic.ts'), 'utf8');
        case 'ssot':
          return fs.readFile(path.join(REPO_ROOT, 'docs/skill-design-document_SSoT.md'), 'utf8');
        case 'locator':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/references/root-cause-locator.md'), 'utf8');
        case 'verifierSpec':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/references/verifier-spec.md'), 'utf8');
        case 'commandReference':
          return fs.readFile(path.join(REPO_ROOT, 'w-model-dev/references/command-reference.md'), 'utf8');
      }
    };
    const sourceLabel = (sourceKey: (typeof sourceKeys)[number]): string => {
      switch (sourceKey) {
        case 'authoritySpec':
          return 'authority-spec';
        case 'schema':
          return 'rootcause-schema';
        case 'checkerSource':
          return 'rootcause-checker';
        case 'ssot':
          return 'SSoT';
        case 'locator':
          return 'root-cause-locator';
        case 'verifierSpec':
          return 'verifier-spec';
        case 'commandReference':
          return 'command-reference';
      }
    };
    const sources = {
      authoritySpec: await readRealSource('authoritySpec'),
      schema: await readRealSource('schema'),
      checkerSource: await readRealSource('checkerSource'),
      ssot: await readRealSource('ssot'),
      locator: await readRealSource('locator'),
      verifierSpec: await readRealSource('verifierSpec'),
      commandReference: await readRealSource('commandReference'),
    };
    const clauseMutations: Array<[string, string, string]> = [
      [
        'canonical-name',
        'canonical persona is not testing-reality-checker',
        'testing-reality-checker is not the canonical persona',
      ],
      [
        'threshold',
        'testing-reality-checker confidence is not required to be >= 0.5',
        'confidence >= 0.5 is not required for testing-reality-checker',
      ],
      [
        'legacy-fallback',
        'legacy reality-checker is not fallback when canonical is absent',
        'canonical is absent only when legacy reality-checker is fallback',
      ],
      [
        'same-artifact-dedupe',
        'same artifact legacy-first and counted twice',
        'counted twice only when same artifact is legacy-first',
      ],
      [
        'cross-artifact-conflict',
        'different artifact conflict is not fail-closed',
        'fail-closed is not required for different artifact conflict',
      ],
      [
        'canonical-duplicate',
        'canonical > 1 duplicate is not fail-closed',
        'fail-closed is not required for canonical > 1 duplicate',
      ],
      [
        'legacy-duplicate',
        'legacy > 1 duplicate is not fail-closed',
        'fail-closed is not required for legacy > 1 duplicate',
      ],
    ];
    const clauseIds = [
      'canonical-name',
      'threshold',
      'legacy-fallback',
      'same-artifact-dedupe',
      'cross-artifact-conflict',
      'canonical-duplicate',
      'legacy-duplicate',
    ];
    const mutateRealSource = (
      sourceKey: (typeof sourceKeys)[number],
      source: string,
      clauseNumber: number,
      replacement?: string,
      relationMutation = false,
    ): string => {
      const id = clauseIds[clauseNumber - 1]!;
      if (sourceKey === 'schema') {
        const parsed = JSON.parse(source) as { $comment?: string };
        const comment = parsed.$comment ?? '';
        const start = comment.indexOf('{');
        expect(start).toBeGreaterThanOrEqual(0);
        const annotation = JSON.parse(comment.slice(start)) as {
          ['r10-contract']?: Array<{ id: string; relation: Record<string, unknown>; prose: string }>;
        };
        const nodes = annotation['r10-contract'] ?? [];
        if (replacement === undefined) nodes.splice(clauseNumber - 1, 1);
        else if (relationMutation) nodes[clauseNumber - 1]!.relation = {};
        else nodes[clauseNumber - 1]!.prose = replacement;
        parsed.$comment = 'r10-contract nodes: ' + JSON.stringify(annotation);
        return JSON.stringify(parsed);
      }
      if (sourceKey === 'checkerSource') {
        const lines = source.split(/\r?\n/);
        const index = lines.findIndex((line) => line.includes(`id: '${id}',`));
        expect(index, `real source must contain node ${id}`).toBeGreaterThanOrEqual(0);
        if (index < 0) return source;
        if (replacement === undefined) lines.splice(index, 1);
        else {
          const relationIndex = lines.findIndex((line, lineIndex) => lineIndex > index && line.includes('relation:'));
          const proseIndex = lines.findIndex((line, lineIndex) => lineIndex > index && line.includes('prose:'));
          if (relationMutation && relationIndex >= 0) {
            let relationLine: string | undefined;
            lines.forEach((line, lineIndex) => {
              if (lineIndex === relationIndex) relationLine = line;
            });
            lines.splice(relationIndex, 1, relationLine!.replace(/relation: \{[^}]*\}/, 'relation: {}'));
          } else if (!relationMutation && proseIndex >= 0) {
            let proseLine: string | undefined;
            lines.forEach((line, lineIndex) => {
              if (lineIndex === proseIndex) proseLine = line;
            });
            lines.splice(proseIndex, 1, proseLine!.replace(/prose: '.*'/, `prose: '${replacement}'`));
          }
        }
        return lines.join('\n');
      }
      const lines = source.split(/\r?\n/);
      const index = lines.findIndex((line) => line.includes(`<r10-contract id="${id}"`));
      expect(index, `real source must contain node ${id}`).toBeGreaterThanOrEqual(0);
      if (index < 0) return source;
      let currentLine: string | undefined;
      lines.forEach((line, lineIndex) => {
        if (lineIndex === index) currentLine = line;
      });
      if (replacement === undefined) lines.splice(index, 1);
      else if (relationMutation) lines.splice(index, 1, currentLine!.replace(/relation='\{.*\}'/, "relation='{}'"));
      else lines.splice(index, 1, currentLine!.replace(/>([^<]*)</, `>${replacement}<`));
      return lines.join('\n');
    };

    for (const sourceKey of sourceKeys) {
      const sourceContent = await readRealSource(sourceKey);
      expect(sourceContent).toMatch(
        sourceKey === 'schema'
          ? /r10-contract/
          : sourceKey === 'checkerSource'
            ? /R10_CONTRACT_NODES/
            : /<r10-contract id="canonical-name"/,
      );
      for (let clauseNumber = 1; clauseNumber <= clauseMutations.length; clauseNumber++) {
        const clauseName = clauseMutations[clauseNumber - 1]![0];
        const deleted = mutateRealSource(sourceKey, sourceContent, clauseNumber);
        const deletedViolations = checkRootCauseR10Contract(replaceSource(sources, sourceKey, deleted));
        expect(
          deletedViolations.some(
            (violation) => violation.message.includes(sourceLabel(sourceKey)) && violation.message.includes(clauseName),
          ),
          `${sourceKey} ${clauseName} node deletion must fail closed`,
        ).toBe(true);

        for (const replacement of clauseMutations[clauseNumber - 1]!.slice(1)) {
          const mutated = mutateRealSource(sourceKey, sourceContent, clauseNumber, replacement);
          const violations = checkRootCauseR10Contract(replaceSource(sources, sourceKey, mutated));
          expect(
            violations.some(
              (violation) =>
                violation.message.includes(sourceLabel(sourceKey)) && violation.message.includes(clauseName),
            ),
            `${sourceKey} ${clauseName} negation/reversal must fail closed`,
          ).toBe(true);
        }
        const relationMutated = mutateRealSource(sourceKey, sourceContent, clauseNumber, 'ignored', true);
        const relationViolations = checkRootCauseR10Contract(replaceSource(sources, sourceKey, relationMutated));
        expect(
          relationViolations.some(
            (violation) => violation.message.includes(sourceLabel(sourceKey)) && violation.message.includes(clauseName),
          ),
          `${sourceKey} ${clauseName} relation reversal must fail closed`,
        ).toBe(true);
      }
    }
  }, 90_000); // real-execution probe: ~15-19s alone, >30s under full-suite+coverage load (batch 3 wave merged larger real sources); per-test budget instead of raising global testTimeout
});

describe('A4 状态锁、平台修复与 batch B 边界契约', () => {
  it('逐文档拒绝旧语义、确认新增文档职责，并防止正确文本与旧文本共存绕过', () => {
    const oldSemantics = runDocConsistencyChecks(
      baseInput({
        a4Docs: {
          ...baseInput().a4Docs!,
          dispatchMatrix: 'wm-write 使用 .bak 备份 + mtime 乐观锁 + 原子替换 + 回读校验。',
          troubleshooting: 'pre-push 自动执行 npm install --no-audit --no-fund；WSL 自动补装平台依赖。',
          changelog: '状态写并发协议；显式平台修复；Vitest test-count fail-closed 已完成。',
        },
        vitestTestCount: 785,
        testFileCount: 49,
        vitestExtraDocs: [
          {
            name: 'docs/INSTALL.md',
            content: '47 个 test 文件 / 725 条\n49 个 test 文件 / 766 条',
          },
        ],
        agents: 'vitest 725 条（47 test files）\nvitest 766 条（49 test files）',
      }),
    );
    const missingDataModels = runDocConsistencyChecks(
      baseInput({
        a4Docs: { ...baseInput().a4Docs!, dataModels: '只说明 mtime。' },
      }),
    );
    const missingCommandReference = runDocConsistencyChecks(
      baseInput({
        a4Docs: { ...baseInput().a4Docs!, commandReference: '只说明 CLI。' },
      }),
    );
    const conflictingSemantics = runDocConsistencyChecks(
      baseInput({
        a4Docs: {
          ...baseInput().a4Docs!,
          operationalRecovery:
            '状态写使用 <target>.lock 与 owner；mtime 乐观锁足以保证并发写入安全。--lock-timeout 与 --recover-stale-lock。',
          dataModels:
            '状态写使用 <target>.lock 与 owner；mtime 乐观锁足以处理竞争写。--lock-timeout 与 --recover-stale-lock。',
          commandReference:
            '所有状态写通过 <target>.lock 与 owner；mtime 乐观锁足以保证并发处理。--lock-timeout 与 --recover-stale-lock。',
          troubleshooting:
            'pre-push 不自动 npm install；开发者手动 npm install；但 pre-push 自动 npm install，且会自动补装平台依赖；platform-deps:check 和 platform-deps:install 为显式入口。',
        },
      }),
    );

    expect(oldSemantics.some((x) => x.check === 'a4-state-lock' && x.message.includes('subagent-delegation.md'))).toBe(
      true,
    );
    expect(oldSemantics.some((x) => x.check === 'a4-platform-repair' && x.message.includes('troubleshooting.md'))).toBe(
      true,
    );
    expect(oldSemantics.some((x) => x.check === 'vitest-tests')).toBe(false);
    expect(missingDataModels.some((x) => x.check === 'a4-state-lock' && x.message.includes('data-models.md'))).toBe(
      true,
    );
    expect(
      missingCommandReference.some((x) => x.check === 'a4-state-lock' && x.message.includes('command-reference.md')),
    ).toBe(true);
    expect(
      conflictingSemantics.some((x) => x.check === 'a4-state-lock' && x.message.includes('operational-recovery.md')),
    ).toBe(true);
    expect(conflictingSemantics.some((x) => x.check === 'a4-state-lock' && x.message.includes('data-models.md'))).toBe(
      true,
    );
    expect(
      conflictingSemantics.some((x) => x.check === 'a4-state-lock' && x.message.includes('command-reference.md')),
    ).toBe(true);
    expect(
      conflictingSemantics.some((x) => x.check === 'a4-platform-repair' && x.message.includes('troubleshooting.md')),
    ).toBe(true);
  });

  // 明确句式契约：每项仅注入一个错误断言；不试图理解清单外的自然语言语义。
  // 保持与逻辑中的具名清单一一对应，防止新增禁止句式时遗漏隔离回归测试。
  it.each(A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS)(
    '拒绝隔离的自动安装禁止句式：$description',
    ({ description: forbiddenStatement }) => {
      const violations = runDocConsistencyChecks(
        baseInput({
          a4Docs: {
            ...baseInput().a4Docs!,
            troubleshooting: [
              'pre-push 不自动 npm install；开发者手动 npm install。',
              'platform-deps:check 和 platform-deps:install 为显式入口。',
              forbiddenStatement,
            ].join('\n'),
          },
        }),
      );

      expect(violations.some((x) => x.check === 'a4-platform-repair' && x.message.includes('troubleshooting.md'))).toBe(
        true,
      );
    },
  );

  it.each(A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS)(
    '拒绝隔离的 mtime 错误安全主张：$description',
    ({ description: forbiddenStatement }) => {
      const violations = runDocConsistencyChecks(
        baseInput({
          a4Docs: {
            ...baseInput().a4Docs!,
            commandReference: [
              '所有状态写通过 <target>.lock 与 owner；mtime 仅锁内版本检测，不能单独提供并发安全。',
              '--lock-timeout 与 --recover-stale-lock 为 CLI 参数。',
              forbiddenStatement,
            ].join('\n'),
          },
        }),
      );

      expect(violations.some((x) => x.check === 'a4-state-lock' && x.message.includes('command-reference.md'))).toBe(
        true,
      );
    },
  );

  it('允许人工 npm install 与 mtime 锁内版本检测的正确契约', () => {
    const violations = runDocConsistencyChecks(
      baseInput({
        a4Docs: {
          ...baseInput().a4Docs!,
          commandReference: [
            '所有状态写通过 <target>.lock 与 owner；mtime 仅锁内版本检测，不能单独提供并发安全。',
            '--lock-timeout 与 --recover-stale-lock 为 CLI 参数。',
          ].join('\n'),
          troubleshooting: [
            'pre-push 不自动 npm install；开发者手动 npm install。',
            'platform-deps:check 和 platform-deps:install 为显式入口。',
          ].join('\n'),
        },
      }),
    );

    expect(violations.some((x) => x.check === 'a4-state-lock' || x.check === 'a4-platform-repair')).toBe(false);
  });
});

describe('runDocConsistencyChecks', () => {
  it('SSoT 三边界架构契约缺失 → 违规', () => {
    const input = baseInput({
      ssot: baseInput().ssot.replace('subgraph Tools[可选外部工具]\n', ''),
    });
    const violations = runDocConsistencyChecks(input);
    expect(violations.some((x) => x.check === 'architecture-boundaries' && x.message.includes('三边界'))).toBe(true);
  });

  it('schema 清单缺行 → 违规', () => {
    const input = baseInput({
      dataModels: '### Schema 清单（21 份）\n| `verifier-output` | ... |',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'schema-list' && x.message.includes('iceberg-sweep.schema.json'))).toBe(true);
  });

  it('schema 清单标题份数不符 → 违规', () => {
    const input = baseInput({
      dataModels:
        '### Schema 清单（19 份）\n| `verifier-output` | ... |\n| `run-log` | ... |\n| `iceberg-sweep` | ... |',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('5 份'))).toBe(
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
      dataModels: '### Schema 清单（21 份）\n| `run-log` | ... | action enum（15 类） |',
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

  it('quick-self-check 缺七维度标题 → 违规', () => {
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

  it('pre-push 编号最大值非 17 → 违规', () => {
    const input = baseInput({
      prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('17'))).toBe(true);
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

  it('README/AGENTS 动态 Vitest 数字变化不再产生文档计数违规', () => {
    const input = baseInput({
      readme: baseInput().readme.replace('40 files', '50 files'),
      agents: '31 个脚本\n50 个 .test.ts / 530 条',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'vitest-tests')).toBe(false);
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
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('5 份'))).toBe(
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

  it('Vitest 文件数变化不再要求 README/AGENTS 同步', () => {
    const input = baseInput({
      testFileCount: 41,
      readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      agents: '31 个脚本',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v).toEqual([]);
  });

  it('Vitest 用例数变化不再要求 README/AGENTS/pre-push 同步', () => {
    const input = baseInput({
      vitestTestCount: 803,
      readme: '8 条核心操作行为\n新增 803 个测试用例',
      agents: '31 个脚本\n由受控 facts 提供 Vitest 测量',
      prePush: '# 15. samples-coverage\n# 测试结果以当前命令输出为准',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v).toEqual([]);
  });

  it('vitest 用例总数无法采集（-1）→ vitest-tests 违规（fail-closed）', () => {
    const input = baseInput({ vitestTestCount: -1 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(true);
  });

  it('gate-log Schema 未登记到清单 → schema-list 违规', () => {
    const input = baseInput({
      dataModels: baseInput().dataModels.replace(
        '| `gate-log` | `gate-log.schema.json` | ... | append-only gate-logs 审计记录 |\n',
        '',
      ),
    });
    expect(
      runDocConsistencyChecks(input).some(
        (x) => x.check === 'schema-list' && x.message.includes('gate-log.schema.json'),
      ),
    ).toBe(true);
  });

  it('实际 Schema 数与 SSoT/SKILL/anti-patterns/user-guide 权威声明漂移 → schema-list 违规', () => {
    const input = {
      ...baseInput({
        schemaFiles: Array.from({ length: 21 }, (_, i) => `schema-${i + 1}.schema.json`),
        dataModels: '### Schema 清单（21 份）',
      }),
      schemaInventoryDocs: [
        { name: 'SSoT', content: 'Schema 清单（20 份）' },
        { name: 'SKILL.md', content: 'schemas/（20 份 JSON Schema draft-07）' },
        { name: 'hard-constraints.md（反模式节）#28', content: 'schema 清单 20 份' },
        { name: 'hard-constraints.md（反模式节）#28 检测信号', content: 'schema 清单（20 份）' },
        { name: 'docs/user-guide.md', content: 'schema（20 份清单）' },
      ],
    } as DocConsistencyInput;

    const violations = runDocConsistencyChecks(input);
    for (const name of [
      'SSoT',
      'SKILL.md',
      'hard-constraints.md（反模式节）#28',
      'hard-constraints.md（反模式节）#28 检测信号',
      'docs/user-guide.md',
    ]) {
      expect(
        violations.some((x) => x.check === 'schema-list' && x.message.includes(name) && x.message.includes('21 份')),
      ).toBe(true);
    }
  });

  it('真实 JSON 计数变化与旧活体声明不一致时不产生动态文档计数违规', () => {
    const input = baseInput({
      testFileCount: 50,
      vitestTestCount: 803,
    });
    const violations = runDocConsistencyChecks(input);
    expect(violations.some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('所有 D4 Schema 声明文档各自 22→21 时均报 schema-list', () => {
    const schemaFiles = Array.from({ length: 22 }, (_, index) => `schema-${index + 1}.schema.json`);
    const inventoryDocs = [
      'README.md',
      'AGENTS.md',
      'CONTRIBUTING.md',
      'docs/INSTALL.md',
      'SSoT',
      'docs/user-guide.md',
      'SKILL.md',
      'hard-constraints.md（反模式节）#28',
      'hard-constraints.md（反模式节）#28 检测信号',
    ];
    for (const staleName of inventoryDocs) {
      const report = buildDocConsistencyReport(
        baseInput({
          schemaFiles,
          dataModels: '### Schema 清单（22 份）',
          schemaInventoryDocs: inventoryDocs.map((name) => ({
            name,
            content: name === staleName ? 'JSON Schema 清单（21 份）' : 'JSON Schema 清单（22 份）',
          })),
        }),
      );
      expect(
        report.violations.some(
          (violation) => violation.check === 'schema-list' && violation.message.includes(staleName),
        ),
        `${staleName} 的旧 Schema 数必须被拒绝`,
      ).toBe(true);
    }
  });

  it('活体文档动态计数改为稳定描述后不再要求多份文档同步', async () => {
    const input = baseInput({
      readme: '**当前版本**：`41.11.0`\n以当前命令输出为准；本次新增 123 个测试用例。',
      agents: '31 个脚本\nVitest 测试由受控运行事实包提供。',
      prePush: '# 17. typecheck\n# Vitest 全量运行结果以当前命令输出为准。',
      vitestExtraDocs: [
        { name: 'CONTRIBUTING.md', content: '运行 Vitest 并以当前命令输出为准；新增 456 个测试。' },
        { name: 'docs/INSTALL.md', content: 'Vitest 测试结果以当前命令输出为准；覆盖率阈值保持不变。' },
      ],
      vitestTestCount: 1002,
      testFileCount: 55,
      vitestMeasurementsValid: true,
      vitestPassedCount: 1002,
      vitestFailedCount: 0,
      vitestSuccess: true,
      vitestRunId: 'a'.repeat(16),
      vitestArtifactId: 'vitest/results.json',
      vitestArtifactSha256: 'b'.repeat(64),
      vitestCommitSha: 'c'.repeat(40),
    });
    const report = buildDocConsistencyReport(input);
    expect(report.violations.filter((x) => x.check === 'vitest-tests')).toEqual([]);
    expect(report.dynamicMeasurements).toMatchObject({
      testFileCount: 55,
      vitestTestCount: 1002,
      numPassedTests: 1002,
      numFailedTests: 0,
      success: true,
      vitestRunId: 'a'.repeat(16),
      vitestArtifactId: 'vitest/results.json',
      vitestArtifactSha256: 'b'.repeat(64),
      vitestCommitSha: 'c'.repeat(40),
    });
  });

  it('D4 修复轮1：活体文档无动态计数复制，新增数字仍不触发动态 facts 违规', async () => {
    const liveDocs = [
      'README.md',
      'AGENTS.md',
      'CONTRIBUTING.md',
      'docs/INSTALL.md',
      'w-model-dev/SKILL.md',
      'w-model-dev/references/command-reference.md',
    ];
    const forbiddenCopies = [
      /\b55\s+files?\s*\/\s*1002\s+tests?\b/i,
      /55\s*个\s*\.test\.ts\s*\/\s*1002\s*(?:条|tests?\b)/i,
      /55\s*个\s*test\s*文件\s*\/\s*1002\s*(?:条|tests?\b)/i,
    ];
    for (const relativePath of liveDocs) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- relativePath is selected from the fixed repository documentation list above
      const content = await fs.readFile(path.join(REPO_ROOT, relativePath), 'utf8');
      for (const pattern of forbiddenCopies) expect(content, relativePath).not.toMatch(pattern);
    }

    const input = baseInput();
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      const coverage = await writeVitestCount(fixtureRoot, 1002);
      expect([(coverage.testResults as unknown[]).length, coverage.numTotalTests]).toEqual([55, 1002]);
      const docsWithLiveCount = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/INSTALL.md'];
      for (const doc of docsWithLiveCount) {
        const docPath = path.join(fixtureRoot, doc);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
        const docContent = await fs.readFile(docPath, 'utf-8');
        expect(docContent).not.toContain('55 files / 1002 tests');
        expect(docContent).not.toContain('55 个 .test.ts / 1002 条');
      }
      const loaderDocs = ['w-model-dev/references/data-models.md', 'docs/INSTALL.md', 'docs/user-guide.md'];
      const oldLoaderPath = ['scripts', 'logic', 'schema-loader.ts'].join('/');
      for (const doc of loaderDocs) {
        const docPath = path.join(fixtureRoot, doc);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
        const docContent = await fs.readFile(docPath, 'utf-8');
        expect(docContent).not.toContain(oldLoaderPath);
        expect(docContent).toContain(['scripts', 'infrastructure', 'schema-loader.ts'].join('/'));
      }
      const passing = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      const passingReport = JSON.parse(passing.stdout) as {
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: Record<string, unknown>;
      };
      expect(passingReport.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
      expect(passingReport.dynamicMeasurements).toMatchObject({ vitestTestCount: 1002, testFileCount: 55 });

      const readme = path.join(fixtureRoot, 'README.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      const content = await fs.readFile(readme, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      await fs.writeFile(readme, `${content}\n新增 928 个测试用例，无需复制动态计数。`, 'utf-8');
      const changedDocs = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      const changedReport = JSON.parse(changedDocs.stdout) as { dynamicViolations: Array<{ check: string }> };
      expect(changedReport.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
    });
  }, 90_000); // real-execution probe: ~18s alone, ~30s+ under full-suite load (Task 2.3); per-test budget instead of raising global testTimeout

  it('Exit2ProbeResult 通用字段缺失、null、空值和错误 rule 均 fail-closed', () => {
    const validProbe = {
      probeId: 'check-budget.ts#invalid-argument',
      script: 'check-budget.ts',
      args: ['--d4-invalid-argument'],
      cwd: '<repoRoot>',
      status: 2,
      errorExitCode: 2,
      category: 'ARG_INVALID',
      rule: 'P0-1',
      rawErrorJson: { exitCode: 2, category: 'ARG_INVALID', rule: 'P0-1' },
    };
    for (const mutation of [
      { ...validProbe, probeId: undefined },
      { ...validProbe, script: undefined },
      { ...validProbe, args: undefined },
      { ...validProbe, cwd: undefined },
      { ...validProbe, status: undefined },
      { ...validProbe, errorExitCode: undefined },
      { ...validProbe, category: undefined },
      { ...validProbe, category: null },
      { ...validProbe, category: '' },
      { ...validProbe, rule: undefined },
      { ...validProbe, rule: null },
      { ...validProbe, rule: '' },
      { ...validProbe, rule: 'not-a-rule' },
    ]) {
      const violations = runDocConsistencyChecks(baseInput({ exit2ProbeResults: [mutation as never] }));
      expect(violations.some((violation) => violation.check === 'exit2-probe')).toBe(true);
    }
  });

  it('缺失或错误 rule 的 exit2 probe 不计入 exit2ScriptCount', () => {
    const valid = {
      probeId: 'check-budget.ts#invalid-argument',
      script: 'check-budget.ts',
      args: ['--d4-invalid-argument'],
      cwd: '<repoRoot>',
      status: 2,
      errorExitCode: 2,
      category: 'ARG_INVALID',
      rule: 'P0-1',
      rawErrorJson: { exitCode: 2, category: 'ARG_INVALID', rule: 'P0-1' },
    };
    expect(
      countValidExit2Scripts([
        valid,
        { ...valid, probeId: 'plan-chunks.ts#invalid-argument', script: 'plan-chunks.ts', rule: null },
        { ...valid, probeId: 'security-scan.ts#missing-path', script: 'security-scan.ts', rule: 'bad-rule' },
      ]),
    ).toBe(1);
  });

  it('Windows drive/sep/dot/trailing separator 规范化后同义 identity 相等，参数或 cwd 异义不相等', () => {
    expect(
      canonicalizeExit2ProbeIdentity({
        args: ['D:/probe/./project/', '--phase=0', '--json'],
        cwd: 'D:/probe/.',
      }),
    ).toEqual(
      canonicalizeExit2ProbeIdentity({
        args: ['d:\\probe\\project', '--phase=0', '--json'],
        cwd: 'd:\\probe\\',
      }),
    );
    expect(canonicalizeExit2ProbeIdentity({ args: ['D:/probe/project-other'], cwd: 'D:/probe' })).not.toEqual(
      canonicalizeExit2ProbeIdentity({ args: ['D:/probe/project'], cwd: 'D:/probe' }),
    );
    expect(canonicalizeExit2ProbeIdentity({ args: ['D:/probe/project'], cwd: 'D:/probe-other' })).not.toEqual(
      canonicalizeExit2ProbeIdentity({ args: ['D:/probe/project'], cwd: 'D:/probe' }),
    );
  });

  it('UNC 与 POSIX 同值路径保留 path-kind 区分，同义 spelling 仍相等', () => {
    const uncA = canonicalizeExit2ProbeIdentity({ args: ['\\\\server\\share\\project'], cwd: '\\\\server\\share' });
    const uncB = canonicalizeExit2ProbeIdentity({ args: ['//server/share/project'], cwd: '//server/share/' });
    const posix = canonicalizeExit2ProbeIdentity({ args: ['/server/share/project'], cwd: '/server/share' });
    expect(uncA).toEqual(uncB);
    expect(uncA).not.toEqual(posix);
    expect(uncA.argsPathKinds).toEqual(['unc']);
    expect(uncA.cwdPathKind).toBe('unc');
    expect(posix.argsPathKinds).toEqual(['posix']);
    expect(posix.cwdPathKind).toBe('posix');
  });

  it('双环境 stable probe map 对单字段 args drift 与 cwd drift 分别失败', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const first = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      const second = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(first.code).toBe(0);
      expect(second.code).toBe(0);
      const firstReport = JSON.parse(first.stdout) as {
        dynamicMeasurements: { exit2ProbeResults: Array<Record<string, unknown>> };
      };
      const secondReport = JSON.parse(second.stdout) as {
        dynamicMeasurements: { exit2ProbeResults: Array<Record<string, unknown>> };
      };
      const stable = (report: typeof firstReport) =>
        report.dynamicMeasurements.exit2ProbeResults.map((probe) => ({
          probeId: probe.probeId,
          script: probe.script,
          args: Array.isArray(probe.args)
            ? canonicalizeExit2ProbeIdentity({ args: probe.args as string[], cwd: String(probe.cwd) }).args
            : [],
          cwd: canonicalizeExit2ProbeIdentity({ args: [], cwd: String(probe.cwd) }).cwd,
          status: probe.status,
          errorExitCode: probe.errorExitCode,
          category: probe.category,
          rule: probe.rule,
        }));
      const baseline = stable(firstReport);
      const argsDrift = structuredClone(secondReport) as typeof secondReport;
      const argsTarget = argsDrift.dynamicMeasurements.exit2ProbeResults.find(
        (probe) => probe.probeId === 'metrics-report.ts#invalid-phase',
      );
      expect(argsTarget).toBeDefined();
      if (argsTarget === undefined) return;
      argsTarget.args = ['<probeRoot>/different-project', '--phase=0', '--json'];
      expect(stable(argsDrift)).not.toEqual(baseline);
      const cwdDrift = structuredClone(secondReport) as typeof secondReport;
      const cwdTarget = cwdDrift.dynamicMeasurements.exit2ProbeResults.find(
        (probe) => probe.probeId === 'metrics-report.ts#invalid-phase',
      );
      expect(cwdTarget).toBeDefined();
      if (cwdTarget === undefined) return;
      cwdTarget.cwd = '<differentRoot>';
      expect(stable(cwdDrift)).not.toEqual(baseline);
    });
  }, 120_000);

  it('metrics invalid-phase probe 保留规范化 args/cwd 的完整 identity', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: { exit2ProbeResults: Array<{ probeId: string; args: string[]; cwd: string }> };
      };
      expect(report.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
      const metricsProbe = report.dynamicMeasurements.exit2ProbeResults.find(
        (probe) => probe.probeId === 'metrics-report.ts#invalid-phase',
      );
      expect(metricsProbe).toEqual({
        probeId: 'metrics-report.ts#invalid-phase',
        script: 'metrics-report.ts',
        args: ['<probeRoot>/probe-project', '--phase=0', '--json'],
        cwd: '<probeRoot>',
        status: 2,
        errorExitCode: 2,
        category: 'ARG_INVALID',
        rule: 'P0-1',
        rawErrorJson: { category: 'ARG_INVALID', message: '--phase 参数非法', exitCode: 2, rule: 'P0-1' },
      });
    });
  });

  it('真实 CLI --json 输出 dynamicMeasurements 的完整五字段并保留兼容 violations', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      const coverage = await writeVitestCount(fixtureRoot, 1002);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        violations: unknown[];
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: {
          testFileCount: number;
          vitestTestCount: number;
          testDirectoryInventoryCount: number;
          numPassedTests: number;
          numFailedTests: number;
          success: boolean;
          vitestArtifactId: string;
          vitestRunId: string;
          vitestArtifactSha256: string;
          vitestCommitSha: string;
          exit2ProbeResults: Array<{
            probeId: string;
            script: string;
            args: string[];
            cwd: string;
            status: number;
            errorExitCode: number | null;
            category: string | null;
            rule: string | null;
            outputExistsAfter?: boolean;
            emittedEvidenceExport?: boolean;
          }>;
        };
      };
      expect(report.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
      expect(report.dynamicMeasurements).toMatchObject({
        // 25 = 23 原清单 + change-scope + codegraph-query（2026-09-04 audit-gate-closure task 1）
        schemaCount: 25,
        cliScriptCount: 37,
        exit2ScriptCount: 36,
        testFileCount: (coverage.testResults as unknown[]).length,
        vitestTestCount: 1002,
        numPassedTests: 1002,
        numFailedTests: 0,
        success: true,
        testDirectoryInventoryCount: expect.any(Number),
      });
      expect(report.dynamicMeasurements.testDirectoryInventoryCount).toBeGreaterThanOrEqual(
        report.dynamicMeasurements.testFileCount,
      );
      expect(report.dynamicMeasurements.vitestArtifactId).toBe('vitest/results.json');
      expect(report.dynamicMeasurements.vitestRunId).toMatch(/^[0-9a-f]{16}$/);
      expect(report.dynamicMeasurements.vitestArtifactSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(report.dynamicMeasurements.vitestCommitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(38);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.every(
          (probe) =>
            typeof probe.probeId === 'string' &&
            Array.isArray(probe.args) &&
            typeof probe.cwd === 'string' &&
            probe.status === 2 &&
            probe.errorExitCode === 2 &&
            typeof probe.category === 'string',
        ),
      ).toBe(true);
      const metricsProbe = report.dynamicMeasurements.exit2ProbeResults?.find(
        (probe) => probe.probeId === 'metrics-report.ts#invalid-phase',
      );
      expect(metricsProbe).toMatchObject({
        args: [expect.stringContaining('probe-project'), '--phase=0', '--json'],
        status: 2,
        errorExitCode: 2,
        category: 'ARG_INVALID',
        rule: 'P0-1',
      });
    });
  });

  it('同一 checkout 的无状态与最小合法 run-log 状态使用完全相同的 exit2 probe map，且计数为 36', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const withoutState = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(withoutState.code).toBe(0);
      const withoutStateReport = JSON.parse(withoutState.stdout) as {
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: { exit2ScriptCount: number; exit2ProbeResults: Array<Record<string, unknown>> };
      };
      expect(withoutStateReport.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(
        false,
      );

      const wmodelDir = path.join(fixtureRoot, '.w-model');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is an mkdtemp-owned test root
      await fs.mkdir(wmodelDir, { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is an mkdtemp-owned test root
      await fs.writeFile(
        path.join(wmodelDir, 'run-log.jsonl'),
        JSON.stringify({
          runId: 'fixture-run',
          timestamp: '2026-08-22T00:00:00.000Z',
          phase: 8,
          phaseName: '验收测试',
          action: 'fix',
          role: 'S',
          duration_s: 0,
          tokens: 0,
          estimated: false,
          subagentSpawns: 0,
          gateExitCode: null,
          outcome: 'success',
          basedOnReport: 'RC-fixture',
          artifacts: ['fixture-artifact'],
        }) + '\n',
        'utf8',
      );
      const withState = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(withState.code).toBe(0);
      const withStateReport = JSON.parse(withState.stdout) as {
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: { exit2ScriptCount: number; exit2ProbeResults: Array<Record<string, unknown>> };
      };
      expect(withStateReport.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
      const stable = (report: typeof withoutStateReport) =>
        report.dynamicMeasurements.exit2ProbeResults.map((probe) => {
          const identity = canonicalizeExit2ProbeIdentity({
            args: Array.isArray(probe.args) ? (probe.args as string[]) : [],
            cwd: typeof probe.cwd === 'string' ? probe.cwd : '',
          });
          return {
            probeId: probe.probeId,
            script: probe.script,
            args: identity.args,
            cwd: identity.cwd,
            status: probe.status,
            errorExitCode: probe.errorExitCode,
            category: probe.category,
            rule: probe.rule,
          };
        });
      expect(stable(withStateReport)).toEqual(stable(withoutStateReport));
      expect(withoutStateReport.dynamicMeasurements.exit2ScriptCount).toBe(36);
      expect(withStateReport.dynamicMeasurements.exit2ScriptCount).toBe(36);
    });
  }, 120_000);

  it('AGENTS=34 与 INSTALL=25+9 的旧资产声明在同一真实 fixture 中失败', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const agentsPath = path.join(fixtureRoot, 'AGENTS.md');
      const installPath = path.join(fixtureRoot, 'docs', 'INSTALL.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      const agents = await fs.readFile(agentsPath, 'utf8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      const install = await fs.readFile(installPath, 'utf8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      await fs.writeFile(agentsPath, agents.replace('全仓 36 个脚本 exit 2', '全仓 34 个脚本 exit 2'), 'utf8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      await fs.writeFile(
        installPath,
        install
          .replace('26 个 check-*.ts', '25 个 check-*.ts')
          .replace('26 个 check + 9 个工具', '25 个 check + 9 个工具'),
        'utf8',
      );
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('exit2-scripts');
    });
  });

  it.each([
    ['missing run identity', { vitestRunId: '' }],
    ['invalid run identity', { vitestRunId: 'run identity with spaces' }],
    ['absolute artifact identity', { vitestArtifactId: 'D:/temp/results.json' }],
    ['traversing artifact identity', { vitestArtifactId: 'vitest/../results.json' }],
    ['invalid commit SHA', { vitestCommitSha: 'a'.repeat(39) }],
    ['invalid content hash', { vitestArtifactSha256: 'b'.repeat(63) }],
  ])('成功测量的 %s 必须 fail-closed', (_caseName, invalidField) => {
    const report = buildDocConsistencyReport(
      baseInput({
        vitestMeasurementsValid: true,
        vitestMeasurementsReason: undefined,
        vitestPassedCount: 915,
        vitestFailedCount: 0,
        vitestSuccess: true,
        vitestRunId: 'a'.repeat(16),
        vitestArtifactId: 'vitest/results.json',
        vitestArtifactSha256: 'b'.repeat(64),
        vitestCommitSha: 'c'.repeat(40),
        ...invalidField,
      }),
    );
    expect(report.violations.some((violation) => violation.check === 'vitest-results')).toBe(true);
  });

  it('成功 JSON 报告绑定同一相对 artifact identity/hash，且不暴露本机路径', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const first = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      const second = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(first.code).toBe(0);
      expect(second.code).toBe(0);
      const firstReport = JSON.parse(first.stdout) as { dynamicMeasurements: Record<string, unknown> };
      const secondReport = JSON.parse(second.stdout) as { dynamicMeasurements: Record<string, unknown> };
      expect(firstReport.dynamicMeasurements.vitestArtifactId).toMatch(/^vitest\/.+\.json$/);
      expect(firstReport.dynamicMeasurements.vitestArtifactId).toBe(secondReport.dynamicMeasurements.vitestArtifactId);
      expect(firstReport.dynamicMeasurements.vitestRunId).toBe(secondReport.dynamicMeasurements.vitestRunId);
      expect(firstReport.dynamicMeasurements.vitestArtifactSha256).toBe(
        secondReport.dynamicMeasurements.vitestArtifactSha256,
      );
      expect(JSON.stringify(firstReport)).not.toMatch(/[A-Z]:\\|\\Users\\|\/home\//i);
    });
  }, 120_000);

  it('外部 artifact 缺 provenance、绑定错误 commit 或 hash 时 fail-closed', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 916);
      const provenance = path.join(fixtureRoot, 'vitest-results.provenance.json');
      await fs.rm(provenance);
      const missing = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(missing.code).toBe(1);
      expect(missing.stdout).toContain('vitest-results');

      await writeVitestCount(fixtureRoot, 916);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      const content = JSON.parse(await fs.readFile(provenance, 'utf8')) as Record<string, unknown>;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      await fs.writeFile(provenance, JSON.stringify({ ...content, commitSha: '0'.repeat(40) }), 'utf8');
      const stale = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(stale.code).toBe(1);
      expect(stale.stdout).toContain('vitest-results');

      const coveragePath = path.join(fixtureRoot, 'vitest-results.json');
      await writeVitestCount(fixtureRoot, 916);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      await fs.appendFile(coveragePath, 'tampered', 'utf8');
      const mismatchedHash = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(mismatchedHash.code).toBe(1);
      expect(mismatchedHash.stdout).toContain('vitest-results');

      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-vitest-outside-'));
      try {
        const raw = JSON.stringify(await writeVitestCount(fixtureRoot, 916));
        const outsideArtifact = path.join(outside, 'results.json');
        const outsideProvenance = path.join(outside, 'provenance.json');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- negative-case paths are inside a dedicated mkdtemp fixture
        await fs.writeFile(outsideArtifact, raw, 'utf8');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- negative-case paths are inside a dedicated mkdtemp fixture
        await fs.writeFile(
          outsideProvenance,
          JSON.stringify({
            format: 'w-model-vitest-provenance',
            version: 1,
            commitSha: fixtureCommitSha(fixtureRoot),
            runId: createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16),
            artifactRelativePath: 'results.json',
            artifactSha256: createHash('sha256').update(raw, 'utf8').digest('hex'),
            measurements: JSON.parse(raw),
          }),
          'utf8',
        );
        const outsideResult = runDocsConsistencyCli(
          fixtureRoot,
          { WM_VITEST_COUNT_FILE: outsideArtifact, WM_VITEST_PROVENANCE_FILE: outsideProvenance },
          ['--json'],
        );
        expect(outsideResult.code).toBe(1);
        expect(outsideResult.stdout).toContain('vitest-results');
      } finally {
        await fs.rm(outside, { recursive: true, force: true });
      }
    });
  }, 120_000);

  it('CLI --json 对不可信 coverage 仍 exit1 并输出完整失败测量字段', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 916, { numPassedTests: 881, numFailedTests: 1, success: false });
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stdout) as {
        dynamicMeasurements: Record<string, unknown>;
        violations: unknown[];
      };
      expect(report.dynamicMeasurements).toMatchObject({
        testFileCount: 55,
        vitestTestCount: 916,
        numPassedTests: 881,
        numFailedTests: 1,
        success: false,
      });
      expect(report.violations.some((entry) => (entry as { rule?: string }).rule === 'vitest-results')).toBe(true);
    });
  });

  it('CLI 注入 testResults=[] 的 coverage JSON 时以 JSON 文件数为准，不能由目录枚举掩盖', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 916, { testResults: [] });
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        dynamicMeasurements: { testFileCount: number };
        dynamicViolations: Array<{ check: string }>;
      };
      expect(report.dynamicMeasurements.testFileCount).toBe(0);
      expect(report.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
    });
  });

  it('CLI 拒绝 failed 或 success=false 的 coverage JSON，而不是只提取总用例数', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 916, { numPassedTests: 874, numFailedTests: 1, success: false });
      const result = runDocsConsistencyCli(fixtureRoot);
      expect(result.code).toBe(1);
      expect(result.stdout).toMatch(/\[vitest-(tests|results)\]/);
      expect(result.stdout).toMatch(/失败|不可采信|success/);
    });
  });

  it('真实 docs-consistency 探针报告候选 status/ERROR_JSON 证据及 export 三场景隔离', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        dynamicViolations: Array<{ check: string }>;
        dynamicMeasurements: {
          exit2ScriptCount: number;
          exit2ProbeResults?: Array<{
            probeId: string;
            script: string;
            args: string[];
            cwd: string;
            status: number;
            errorExitCode: number;
            category: string | null;
            rule: string | null;
            outputExistsAfter?: boolean;
            emittedEvidenceExport?: boolean;
          }>;
        };
      };
      expect(report.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
      expect(report.dynamicMeasurements.exit2ScriptCount).toBe(36);
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(38);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.every((probe) => probe.status === 2 && probe.errorExitCode === 2),
      ).toBe(true);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.filter((probe) =>
          probe.probeId.startsWith('wm-export-evidence.ts#'),
        ),
      ).toHaveLength(3);
      expect(
        report.dynamicMeasurements.exit2ProbeResults
          ?.filter((probe) => probe.probeId.startsWith('wm-export-evidence.ts#'))
          .every(
            (probe) =>
              probe.status === 2 &&
              probe.errorExitCode === 2 &&
              probe.outputExistsAfter === false &&
              probe.emittedEvidenceExport === false,
          ),
      ).toBe(true);
      expect(result.stdout).not.toContain('EVIDENCE_EXPORT_JSON');
      await assertPrePushArtifactCleanup();

      const probeResults = report.dynamicMeasurements.exit2ProbeResults ?? [];
      for (const field of ['status', 'errorExitCode', 'outputExistsAfter', 'emittedEvidenceExport'] as const) {
        const invalidProbe = probeResults.map((probe) => ({ ...probe }));
        const target = invalidProbe.find((probe) => probe.probeId === 'wm-export-evidence.ts#no-args');
        expect(target).toBeDefined();
        if (target === undefined) continue;
        if (field === 'status') target.status = 1;
        if (field === 'errorExitCode') target.errorExitCode = 1;
        if (field === 'outputExistsAfter') target.outputExistsAfter = true;
        if (field === 'emittedEvidenceExport') target.emittedEvidenceExport = true;
        const invalidReport = buildDocConsistencyReport(baseInput({ exit2ProbeResults: invalidProbe }));
        expect(invalidReport.dynamicViolations.some((violation) => violation.check === 'exit2-probe')).toBe(true);
        expect(invalidReport.violations).toEqual([
          ...invalidReport.staticViolations,
          ...invalidReport.dynamicViolations,
        ]);
      }

      for (const name of ['SKILL.md', 'references/data-models.md', 'references/command-reference.md']) {
        const invalidReport = buildDocConsistencyReport(
          baseInput({
            skillPkgDocs: [
              {
                name: `w-model-dev/${name}`,
                baseDir: name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '.',
                content: 'scripts/logic/schema-loader.ts',
              },
            ],
          }),
        );
        expect(
          invalidReport.violations.some(
            (violation) =>
              violation.check === 'schema-loader-path' && violation.message.includes(`w-model-dev/${name}`),
          ),
        ).toBe(true);
      }
    });
  });

  it('CLI 无 JSON 且 Vitest 不可用（显式清除外部 JSON 环境变量）→ vitest-tests 违规并 exit 1', async () => {
    await withDocsConsistencyFixture(
      async (fixtureRoot) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is a mkdtemp-owned isolated repository copy
        expect(existsSync(path.join(fixtureRoot, 'node_modules', 'vitest'))).toBe(false);
        const result = runDocsConsistencyCli(
          fixtureRoot,
          {
            WM_VITEST_COUNT_FILE: '',
            WM_VITEST_PROVENANCE_FILE: '',
            WM_VITEST_PROVENANCE_ROOT: '',
            PATH: '',
            Path: '',
          },
          [],
          { timeoutMs: 30_000 },
        );
        expect(result.code, JSON.stringify(result)).toBe(1);
        expect(result.stdout).toContain('vitest 用例  : 无法采集（不一致）');
        expect(result.stdout).toContain('[vitest-tests]');
      },
      { availablePackages: ['tsx', 'typescript', 'esbuild'] },
    );
  }, 120_000);

  it('CLI 注入 SSoT 断链 → internal-links 违规并 exit 1', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 787);
      const ssot = path.join(fixtureRoot, 'docs', 'skill-design-document_SSoT.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      const content = await fs.readFile(ssot, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      await fs.writeFile(ssot, `${content}\n[broken](./does-not-exist.md)\n`, 'utf-8');
      const result = runDocsConsistencyCli(fixtureRoot);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('[internal-links]');
      expect(result.stdout).toContain('docs/skill-design-document_SSoT.md');
    });
    await assertSsotExternalBoundaryFile();
  });

  it('活体文档并存旧 Vitest 数字时不产生动态文档违规', () => {
    const input = baseInput({
      readme: '**当前版本**：`41.11.0`\n40 files / 530 tests\n42 files / 663 tests',
      agents: '31 个脚本\n41 个 .test.ts / 530 条',
      vitestExtraDocs: [
        { name: 'CONTRIBUTING.md', content: '| 12 | vitest 全量（40 files / 623 tests） | 0 |' },
        { name: 'docs/INSTALL.md', content: '# vitest 单元测试（40 个 .test.ts / 623 条）' },
      ],
    });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests')).toEqual([]);
  });

  it('PR 模板含过期门禁项数（14 项）→ pre-push 违规', () => {
    const input = baseInput({
      prTemplate: '- [ ] `npm run prepush` 14 项通过',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'pre-push');
    expect(v.some((x) => x.message.includes('PULL_REQUEST_TEMPLATE') && x.message.includes('14 项'))).toBe(true);
  });

  it('PR 模板项数与 EXPECTED 一致 → 零 pre-push 违规', () => {
    const input = baseInput({
      prTemplate: '- [ ] `npm run prepush` 17 项通过',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'pre-push')).toBe(false);
  });

  it('vitestExtraDocs / prTemplate 缺省注入 → 跳过检查不产生违规', () => {
    expect(
      runDocConsistencyChecks(baseInput()).some(
        (x) => x.message.includes('CONTRIBUTING.md') || x.message.includes('PULL_REQUEST_TEMPLATE'),
      ),
    ).toBe(false);
  });

  it('技能包文档含逃逸链接 → skill-outbound-links 违规', () => {
    const docs = [
      {
        name: 'w-model-dev/references/verifier-spec.md',
        content: '见 [SKILL.md](../SKILL.md) 与 [SSoT](../../docs/skill-design-document_SSoT.md)。',
        baseDir: 'references',
      },
      {
        name: 'w-model-dev/SKILL.md',
        content: '安装路径见 [INSTALL](../docs/INSTALL.md)。',
        baseDir: '.',
      },
    ];
    const v = checkSkillOutboundLinks(docs);
    expect(v.length).toBe(2);
    expect(v.every((x) => x.check === 'skill-outbound-links')).toBe(true);
    expect(v[0]!.message).toContain('../../docs/skill-design-document_SSoT.md');
    expect(v[1]!.message).toContain('../docs/INSTALL.md');
  });

  it('技能包文档仅包内链接 / 外部 URL → 零 skill-outbound-links 违规', () => {
    const docs = [
      {
        name: 'w-model-dev/references/verifier-spec.md',
        content: '见 [SKILL.md](../SKILL.md) 与 [反模式](hard-constraints.md)；外部 [spec](https://example.com/x.md)。',
        baseDir: 'references',
      },
      {
        name: 'w-model-dev/scripts/samples/tla-e2e/README.md',
        content: '运行 [check-tla-model.ts](../../cli/check-tla-model.ts)。',
        baseDir: 'scripts/samples/tla-e2e',
      },
    ];
    expect(checkSkillOutboundLinks(docs)).toEqual([]);
  });

  it('skillPkgDocs 注入时经 runDocConsistencyChecks 触发出站链接违规；缺省时跳过', () => {
    const bad = [
      {
        name: 'w-model-dev/references/a.md',
        content: '[x](../../docs/b.md)',
        baseDir: 'references',
      },
    ];
    expect(
      runDocConsistencyChecks(baseInput({ skillPkgDocs: bad })).some((x) => x.check === 'skill-outbound-links'),
    ).toBe(true);
    expect(runDocConsistencyChecks(baseInput()).some((x) => x.check === 'skill-outbound-links')).toBe(false);
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

  it('版本七处一致 → 零 version-consistency 违规', () => {
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

  it('package-lock 根 version 漂移 → version-consistency 违规', () => {
    const input = baseInput({
      lockJson: JSON.stringify({ name: 'x', version: '41.10.0' }),
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'version-consistency' && x.message.includes('package-lock.json'))).toBe(true);
  });

  it('lockJson 缺省注入 → 不产生 package-lock version 违规', () => {
    const input = baseInput({ lockJson: undefined });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'version-consistency' && x.message.includes('package-lock.json'))).toBe(false);
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
      skill: baseInput().skill.replace('（37 个 .ts）', '（36 个 .ts）'),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'script-registry');
    expect(v.some((x) => x.message.includes('36') && x.message.includes('37'))).toBe(true);
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
      '### Schema 清单（4 份）',
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
      '### Schema 清单（4 份）',
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
      '### Schema 清单（4 份）',
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

  it('SSoT 内错误相对链接 → internal-links 违规', () => {
    const input = baseInput({
      linkDocs: [
        {
          name: 'docs/skill-design-document_SSoT.md',
          content: '见 [CHANGELOG](../../CHANGELOG.md)。',
          baseDir: 'docs',
        },
      ],
      linkExists: () => false,
    });
    const violations = runDocConsistencyChecks(input).filter((x) => x.check === 'internal-links');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain('docs/skill-design-document_SSoT.md');
    expect(violations[0]!.message).toContain('../../CHANGELOG.md');
  });
});
const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const DOCS_CONSISTENCY_CLI = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-docs-consistency.ts',
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function withDocsConsistencyFixture(
  assertResult: (fixtureRoot: string) => Promise<void>,
  options: { availablePackages?: string[] } = {},
): Promise<void> {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-docs-consistency-cli-'));
  try {
    cpSync(REPO_ROOT, fixtureRoot, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(REPO_ROOT, source);
        return !['node_modules', '.git', '.w-model', '.codegraph', '.worktrees'].some(
          (excluded) => relative === excluded || relative.startsWith(`${excluded}${path.sep}`),
        );
      },
    });
    // 复制的活体文档保持原样；各测试通过受控 facts/provenance 注入动态测量。
    const gitInit = spawnSync('git', ['init'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });
    expect(gitInit.status, gitInit.stderr).toBe(0);
    expect(
      spawnSync('git', ['config', '--local', 'user.email', 'fixture@example.invalid'], {
        cwd: fixtureRoot,
        timeout: 15_000,
      }).status,
    ).toBe(0);
    expect(
      spawnSync('git', ['config', '--local', 'user.name', 'fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status,
    ).toBe(0);
    expect(
      spawnSync('git', ['config', '--local', 'commit.gpgSign', 'false'], { cwd: fixtureRoot, timeout: 15_000 }).status,
    ).toBe(0);
    const fixtureHooksPath = path.join(fixtureRoot, '.fixture-hooks');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture hook path is inside the mkdtemp-owned test root
    await fs.mkdir(fixtureHooksPath, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture marker is inside the mkdtemp-owned test root
    await fs.writeFile(path.join(fixtureRoot, '.provenance-fixture'), 'fixture\n', 'utf8');
    expect(spawnSync('git', ['add', '.provenance-fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status).toBe(0);
    const commit = spawnSync(
      'git',
      [
        '-c',
        `core.hooksPath=${fixtureHooksPath}`,
        '-c',
        'commit.gpgSign=false',
        'commit',
        '--no-gpg-sign',
        '--no-verify',
        '--no-edit',
        '-m',
        'fixture',
      ],
      {
        cwd: fixtureRoot,
        encoding: 'utf-8',
        timeout: 30_000,
        env: {
          ...process.env,
          GIT_EDITOR: 'true',
          GIT_SEQUENCE_EDITOR: 'true',
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    );
    expect(commit.status, `git commit failed: stdout=${commit.stdout ?? ''} stderr=${commit.stderr ?? ''}`).toBe(0);
    const fixtureNodeModules = path.join(fixtureRoot, 'node_modules');
    if (options.availablePackages === undefined) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture dependency junction has a repository-controlled source and mkdtemp-owned destination
      await fs.symlink(path.join(REPO_ROOT, 'node_modules'), fixtureNodeModules, 'junction');
    } else {
      // Keep the fixture's dependency boundary explicit: tests that simulate a missing package
      // must not discover the parent checkout's node_modules through a junction.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureNodeModules is beneath the mkdtemp-owned isolated repository copy
      await fs.mkdir(fixtureNodeModules);
      for (const packageName of options.availablePackages) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- package source is repository-controlled and destination is mkdtemp-owned
        await fs.symlink(
          path.join(REPO_ROOT, 'node_modules', packageName),
          path.join(fixtureNodeModules, packageName),
          'junction',
        );
      }
    }
    await assertResult(fixtureRoot);
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }
}

function fixtureCommitSha(fixtureRoot: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });
  expect(result.status, result.stderr).toBe(0);
  return String(result.stdout).trim();
}

function runDocsConsistencyCli(
  fixtureRoot: string,
  envOverrides: NodeJS.ProcessEnv = {},
  args: string[] = [],
  options: { timeoutMs?: number } = {},
): {
  code: number | null;
  stdout: string;
  stderr: string;
  error?: { code?: number | string; message: string };
  signal: NodeJS.Signals | null;
} {
  const countFile = path.join(fixtureRoot, 'vitest-results.json');
  const provenanceFile = path.join(fixtureRoot, 'vitest-results.provenance.json');
  // Keep this real CLI probe aligned with the centralized synchronous-process audit.
  // The helper intentionally exercises the repository CLI in a child process.
  // Its timeout follow-up remains tracked by the existing exception manifest.
  // Do not replace this with a mocked call: the fixture test covers the CLI boundary.
  const result = spawnSync(process.execPath, [tsxCli, DOCS_CONSISTENCY_CLI, fixtureRoot, ...args], {
    cwd: fixtureRoot,
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? 90_000,
    env: {
      ...process.env,
      WM_VITEST_COUNT_FILE: countFile,
      WM_VITEST_PROVENANCE_FILE: provenanceFile,
      WM_VITEST_PROVENANCE_ROOT: fixtureRoot,
      ...envOverrides,
    },
  });
  const spawnError = result.error as (NodeJS.ErrnoException & { message: string }) | undefined;
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(spawnError === undefined ? {} : { error: { code: spawnError.code, message: spawnError.message } }),
    signal: result.signal,
  };
}

async function writeVitestCount(
  fixtureRoot: string,
  count: number,
  overrides: Partial<{
    testResults: unknown;
    numPassedTests: unknown;
    numFailedTests: unknown;
    success: unknown;
  }> = {},
) {
  const coverage = {
    testResults: Array.from({ length: 55 }) as unknown[],
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    success: true,
    ...overrides,
  };
  const artifactPath = path.join(fixtureRoot, 'vitest-results.json');
  const provenancePath = path.join(fixtureRoot, 'vitest-results.provenance.json');
  const raw = JSON.stringify(coverage);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
  await fs.writeFile(artifactPath, raw, 'utf-8');
  const commitSha = fixtureCommitSha(fixtureRoot);
  const artifactSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- provenance path is inside the mkdtemp-owned fixture root
  await fs.writeFile(
    provenancePath,
    JSON.stringify(
      {
        format: 'w-model-vitest-provenance',
        version: 1,
        commitSha,
        runId: artifactSha256.slice(0, 16),
        artifactRelativePath: 'vitest-results.json',
        artifactSha256,
        measurements: coverage,
      },
      null,
      2,
    ),
    'utf-8',
  );
  return coverage;
}

async function assertPrePushArtifactCleanup(): Promise<void> {
  const toolRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-prepush-tools-'));
  const capturedEnv = path.join(toolRoot, 'docs-consistency-env.txt');
  const artifactDir = path.join(toolRoot, 'vitest-artifact');
  const bashEnv = path.join(toolRoot, 'bash-env.sh');
  try {
    // 劫持机制：BASH_ENV 函数导出（参照 platform-deps-hook.test.ts run() 先例），bash 函数
    // 优先于 PATH 查找——PATH 前置假可执行文件会被 Git Bash/MSYS 启动时自动前置的
    // /usr/bin 压制（type -a mktemp 实测假件排第 3），函数导出不受影响。
    // 假 mktemp 语义不变：-d 输出受控 $WM_PREPUSH_ARTIFACT_DIR，其余转发真 /usr/bin/mktemp；
    // 独立脚本版 exit N 对应函数版 return N（exit 会终止被测 pre-push shell）。
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- bash-env script is inside the mkdtemp-owned tool root
    await fs.writeFile(
      bashEnv,
      `npm() {
  case "$*" in
    *"check:docs-consistency"*)
      test -f "$WM_VITEST_COUNT_FILE" && test -f "$WM_VITEST_PROVENANCE_FILE"
      printf '%s|%s|%s\\n' "$WM_VITEST_COUNT_FILE" "$WM_VITEST_PROVENANCE_FILE" "$WM_VITEST_PROVENANCE_ROOT" > "$WM_PREPUSH_CAPTURE"
      ;;
    *"bad-ranking-k.json"*) return 1 ;;
    *"check:verifier"*) [[ "$*" == *"valid.json"* ]] || return 2 ;;
    *"check:gate"*) return 2 ;;
  esac
  return 0
}
npx() {
  local output arg
  for arg in "$@"; do
    case "$arg" in --outputFile=*) output="\${arg#--outputFile=}" ;; esac
  done
  if [[ "$*" == *"bad-schema.manifest.json"* ]]; then return 2; fi
  if [ -n "\${output:-}" ]; then
    mkdir -p "$(dirname "$output")"
    printf '%s' '{"testResults":[],"numTotalTests":0,"numPassedTests":0,"numFailedTests":0,"success":true}' > "$output"
  fi
  return 0
}
mktemp() {
  if [ "\${1:-}" = "-d" ]; then
    mkdir -p "$WM_PREPUSH_ARTIFACT_DIR"
    printf '%s\\n' "$WM_PREPUSH_ARTIFACT_DIR"
  else
    /usr/bin/mktemp "$@"
  fi
}
`,
      'utf8',
    );

    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile(
        'bash',
        [
          '-c',
          'source "$BASH_ENV"; export -f npm npx mktemp 2>/dev/null || true; script="$1"; shift; bash "$script" "$@"',
          '--',
          '.githooks/pre-push',
          '--force',
        ],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            BASH_ENV: bashEnv,
            WM_PREPUSH_CAPTURE: capturedEnv,
            WM_PREPUSH_ARTIFACT_DIR: artifactDir,
          },
        },
        (error, stdout, stderr) =>
          resolve({
            code: error === null ? 0 : typeof error.code === 'number' ? error.code : -1,
            stdout: String(stdout),
            stderr: String(stderr),
          }),
      );
    });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- captured path is inside the mkdtemp-owned tool root
    const [artifact, provenance, controlledRoot] = (await fs.readFile(capturedEnv, 'utf8')).trim().split('|');
    expect([path.basename(artifact!), path.basename(provenance!), controlledRoot]).toEqual([
      'results.json',
      'provenance.json',
      artifactDir,
    ]);
    expect(path.dirname(artifact!)).toBe(artifactDir);
    expect(path.dirname(provenance!)).toBe(artifactDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- artifact directory is a mkdtemp-owned test path
    expect(existsSync(artifactDir)).toBe(false);
  } finally {
    await fs.rm(toolRoot, { recursive: true, force: true });
  }
}

describe('D4 动态元数据和本地证据文档治理', () => {
  it('evidence-manifest / wm-export-evidence 缺登记与本地证据文档缺失均为 static violation', () => {
    const input = baseInput({
      dataModels: baseInput().dataModels.replace(
        '| `evidence-manifest` | `evidence-manifest.schema.json` | ... |\n',
        '',
      ),
      dispatchMatrix: baseInput().dispatchMatrix.replace('wm-export-evidence', ''),
      localEvidenceDocs: [
        {
          name: 'README.md',
          content: '仅说明安装。',
        },
      ],
    } as DocConsistencyInput);

    const report = buildDocConsistencyReport(input);
    expect(report.staticViolations.some((x) => x.check === 'schema-list')).toBe(true);
    expect(report.staticViolations.some((x) => x.check === 'script-registry')).toBe(true);
    expect(report.staticViolations.some((x) => x.check === 'local-evidence-artifacts')).toBe(true);
  });

  it('dynamic measurements 保留顶层兼容 violations 字段并分组 dynamic drift', () => {
    const input = baseInput({ testFileCount: 41, vitestTestCount: 531, exit2ScriptCount: 34 });
    const report = buildDocConsistencyReport(input);

    expect([...report.staticViolations, ...report.dynamicViolations]).toEqual(report.violations);
    expect(report.dynamicMeasurements).toMatchObject({
      schemaCount: 5,
      cliScriptCount: CLI_SCRIPT_NAMES.length,
      exit2ScriptCount: 34,
      testFileCount: 41,
      vitestTestCount: 531,
    });
    expect(report.dynamicViolations.some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('每份本地证据文档分别缺安全审阅、自动发布边界或 archive 边界时均为 static violation', () => {
    const fullContract =
      'coverage/ .zcode/ .w-model/ Git 忽略 默认不随 Git 交付 npm run wm:export-evidence -- <project-dir> <output-dir> 脱敏 SHA-256 安全策略审阅 不会自动提交或发布 docs/changes/archive/ 与 .w-model/ 边界';
    const docs = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/INSTALL.md', 'SKILL.md', 'command-reference.md'];

    for (const [token, label] of [
      ['安全策略审阅', '安全审阅'],
      ['不会自动提交或发布', '自动发布边界'],
      ['docs/changes/archive/', 'archive 边界'],
    ] as const) {
      for (const name of docs) {
        const report = buildDocConsistencyReport(
          baseInput({
            localEvidenceDocs: docs.map((docName) => ({
              name: docName,
              content: docName === name ? fullContract.replace(token, '') : fullContract,
            })),
          }),
        );
        expect(
          report.staticViolations.some(
            (violation) => violation.check === 'local-evidence-artifacts' && violation.message.includes(name),
          ),
          `${name} 缺${label}必须被拒绝`,
        ).toBe(true);
      }
    }
  });

  it('D7C 每份活体文档都声明 source-bound/package-only provenance 边界，删任一声明即失败', async () => {
    const docs = [
      'README.md',
      'AGENTS.md',
      'CONTRIBUTING.md',
      'docs/INSTALL.md',
      'w-model-dev/SKILL.md',
      'w-model-dev/references/command-reference.md',
    ];
    const contracts = [
      ['Schema 登记', 'evidence-provenance.schema.json'],
      ['producer+verify CLI 登记', 'wm-verify-evidence-source'],
      ['source-bound 级别', 'source-bound'],
      ['package-only 级别', 'package-only'],
      ['source project 边界', '--source-project'],
      ['受控本机流程完整性边界', '受控本机 provenance'],
      ['非密码学签名边界', '不是密码学签名'],
      ['非第三方不可抵赖边界', '第三方不可抵赖证明'],
    ] as const;

    for (const relativePath of docs) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- each path is a fixed repository documentation contract
      const content = await fs.readFile(path.join(REPO_ROOT, relativePath), 'utf8');
      const assertContract = (candidate: string): void => {
        for (const [label, token] of contracts) {
          expect(candidate, `${relativePath} 缺 ${label}`).toContain(token);
        }
      };
      assertContract(content);
      for (const [label, token] of contracts) {
        expect(
          () => assertContract(content.replaceAll(token, '')),
          `${relativePath} 删除 ${label} 后必须触发文档契约`,
        ).toThrow();
      }
    }
  });
});

async function assertSsotExternalBoundaryFile(): Promise<void> {
  const ssotPath = path.join(REPO_ROOT, 'docs', 'skill-design-document_SSoT.md');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled SSoT path
  const content = await fs.readFile(ssotPath, 'utf-8');
  expect(content).not.toContain('subgraph AI引擎层');
  expect(content).not.toContain('核心AI引擎');
  const start = content.indexOf('### 3.1 整体架构');
  const end = content.indexOf('\n### 3.2 ', start);
  const architecture = content.slice(start, end);
  expect(architecture).toContain('宿主 Agent / 外部 LLM');
  expect(architecture).toContain('W-Model Skill 技能包');
  expect(architecture).toContain('可选外部工具');
  expect(architecture).toContain('Host -. 使用技能包规则并执行 .-> SkillPackage');
  expect(architecture).toContain('Host -. 可选调用 .-> Tools');
  expect(architecture).toContain('图中的边界是交付契约');
  expect(architecture).toContain('不属于技能包交付物');
  expect(content).toContain('TLA+/TLC 是外部工具能力');
  expect(content).toContain('Java ≥ 11 是宿主环境依赖');
  expect(content).toContain('w-model-dev/tools/tla2tools.jar` 是 L1 交付层随技能包携带的运行时资产');
  expect(content).toContain('L1 随技能包交付的 `w-model-dev/tools/tla2tools.jar`');
}

type C3DocumentSet = { readme: string; install: string; contributing: string };

function c3DocumentContractViolations(docs: C3DocumentSet): string[] {
  const violations: string[] = [];
  const validationHeading = '## 验证仓库';
  const installHeading = '## 安装 Skill';
  const readmeTldr = docs.readme.slice(0, docs.readme.indexOf(validationHeading));
  const mixedTldrPattern = /开始：.*(?:拷贝|复制).*?(?:→|->).*?(?:npm install|self-test)/s;

  for (const [name, content] of [
    ['README.md', docs.readme],
    ['docs/INSTALL.md', docs.install],
  ] as const) {
    const validationIndex = content.indexOf(validationHeading);
    const installIndex = content.indexOf(installHeading);
    if (validationIndex < 0 || installIndex <= validationIndex) violations.push(`${name}:入口标题顺序`);
  }
  if (!readmeTldr.includes('[验证仓库](#验证仓库)') || !readmeTldr.includes('[安装 Skill](#安装-skill)')) {
    violations.push('README.md:TL;DR独立锚点');
  }
  if (mixedTldrPattern.test(readmeTldr)) violations.push('README.md:TL;DR混合流程');

  for (const [name, content] of [
    ['README.md', docs.readme],
    ['docs/INSTALL.md', docs.install],
    ['CONTRIBUTING.md', docs.contributing],
  ] as const) {
    const hasBashSave = /(?:^|> )git config --local --get core\.hooksPath\s+>\s+\.git[\\/]hooksPath\.previous/m.test(
      content,
    );
    const hasBashStatus = /(?:^|> )status=\$\?\s*[\r\n]+(?:> )?if \[ "\$status" -eq 1 \]/m.test(content);
    const hasBashRestore = /git config --local core\.hooksPath "\$\(cat \.git[\\/]hooksPath\.previous\)"/.test(content);
    const hasPowerShellSave =
      /(?:^|> )git config --local --get core\.hooksPath\s*>\s*\.git[\\/]hooksPath\.previous/m.test(content);
    const hasPowerShellStatus = /\$readStatus\s*=\s*\$LASTEXITCODE[\s\S]*?\$readStatus\s*-eq\s*1/.test(content);
    const hasPowerShellRestore =
      /Get-Content -Raw \.git[\\/]hooksPath\.previous[\s\S]*git config --local core\.hooksPath \$previousHooksPath/.test(
        content,
      );
    if (!hasBashSave || !hasBashStatus || !hasBashRestore) violations.push(`${name}:Bash hooksPath流程`);
    if (!hasPowerShellSave || !hasPowerShellStatus || !hasPowerShellRestore) {
      violations.push(`${name}:PowerShell hooksPath流程`);
    }
    if (!content.includes('git config --local --unset core.hooksPath')) violations.push(`${name}:hooksPath撤销`);
    if (!/备份文件只保存在本地.*\.git.*不得提交/s.test(content)) violations.push(`${name}:备份文件边界`);
    if (/<旧值>|<previous>/.test(content)) violations.push(`${name}:未替换回写占位符`);
  }

  const uninstallStart = docs.install.indexOf('## 6. 卸载');
  const uninstallEnd = docs.install.indexOf('## 7. 目录速查');
  const uninstall = docs.install.slice(uninstallStart, uninstallEnd);
  if (uninstall.includes('.agent')) violations.push('docs/INSTALL.md:卸载使用通用.agent');
  if (!uninstall.includes('<agent-specific-skills>')) violations.push('docs/INSTALL.md:卸载缺Agent-specific');
  if (!/安装时.*目标|替换.*目标|按安装时/.test(uninstall)) violations.push('docs/INSTALL.md:卸载缺确认提示');

  const platformStart = docs.install.indexOf('### 3.1 本地 pre-push 与平台依赖');
  const platformEnd = docs.install.indexOf('## 4. 验证安装');
  const platformSection = docs.install.slice(platformStart, platformEnd);
  if (!/平台检查.*(?:必须在|需要).*Bash/s.test(platformSection)) violations.push('docs/INSTALL.md:Bash边界');
  if (!platformSection.includes('self-test') || !platformSection.includes('doctor'))
    violations.push('docs/INSTALL.md:PowerShell边界');

  const installSection = docs.install.slice(
    docs.install.indexOf('## 安装 Skill'),
    docs.install.indexOf('---', docs.install.indexOf('## 安装 Skill')),
  );
  if (!installSection.includes('Agent-specific') || !installSection.includes('<agent-specific-skills>')) {
    violations.push('docs/INSTALL.md:安装路径');
  }
  return violations;
}

describe('C3 文档入口契约', () => {
  it('当前 SSoT 三边界架构图与边界说明保持在同一 3.1 契约区段', async () => {
    await assertSsotExternalBoundaryFile();
  });

  it('统一契约接受当前文档，并拒绝真实旧文档局部 fixture', async () => {
    const readDoc = async (relativePath: string): Promise<string> => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled documentation paths
      return fs.readFile(path.join(REPO_ROOT, relativePath), 'utf-8');
    };
    const current: C3DocumentSet = {
      readme: await readDoc('README.md'),
      install: await readDoc('docs/INSTALL.md'),
      contributing: await readDoc('CONTRIBUTING.md'),
    };
    expect(c3DocumentContractViolations(current)).toEqual([]);

    const oldTldr = {
      ...current,
      readme: current.readme.replace(
        /> 两个独立入口：[\s\S]*?两者不是同一条命令链。/,
        '> 开始：拷贝 `w-model-dev/` 到 Agent skills 目录 → 仓库根 `npm install` → `npm run self-test`。',
      ),
    };
    expect(c3DocumentContractViolations(oldTldr)).toContain('README.md:TL;DR独立锚点');
    expect(c3DocumentContractViolations(oldTldr)).toContain('README.md:TL;DR混合流程');

    const oldUninstall = {
      ...current,
      install: current.install.replace(
        'rm -rf "/path/to/<agent-specific-skills>/w-model-dev"',
        'rm -rf "$env:USERPROFILE/.agent/skills/w-model-dev"',
      ),
    };
    expect(c3DocumentContractViolations(oldUninstall)).toContain('docs/INSTALL.md:卸载使用通用.agent');

    const missingBashBoundary = {
      ...current,
      install: current.install
        .replace('平台检查与显式修复入口都必须在 Bash（Git Bash / WSL / POSIX shell）中运行：', '平台检查入口：')
        .replace('pre-push 与上述平台依赖命令需要 Bash', 'pre-push 与上述平台依赖命令可运行'),
    };
    expect(c3DocumentContractViolations(missingBashBoundary)).toContain('docs/INSTALL.md:Bash边界');

    const missingHookWorkflow = {
      ...current,
      contributing: current.contributing
        .replace(
          /git config --local --get core\.hooksPath[\s\S]*?hooksPath\.previous/g,
          'git config core.hooksPath .githooks',
        )
        .replace(
          /git config --local core\.hooksPath "\$\(cat \.git\/hooksPath\.previous\)"/g,
          'git config core.hooksPath .githooks',
        )
        .replace(/\$readStatus\s*-eq\s*1/g, '$readStatus -eq 0'),
    };
    expect(c3DocumentContractViolations(missingHookWorkflow)).toContain('CONTRIBUTING.md:Bash hooksPath流程');
    expect(c3DocumentContractViolations(missingHookWorkflow)).toContain('CONTRIBUTING.md:PowerShell hooksPath流程');
  });
});

describe('pre-push hook 源契约（stdin ref 解析与 fail-closed 范围）', () => {
  // 直接读取 .githooks/pre-push 源文本断言契约（hook 是 bash，不由 docs-consistency
  // logic 校验；此处守住与 17 项门禁并列的触发语义防线，防回归旧「全局 diff 短路 /
  // -n 20 截断 / 空 changed_files 放行」实现）。
  const prePushSource = () => fs.readFile(path.join(REPO_ROOT, '.githooks', 'pre-push'), 'utf8');

  it('先读 stdin 四字段解析，fallback（HEAD@{push}/origin/HEAD）只作空 stdin 回退', async () => {
    const source = await prePushSource();
    // 四字段解析（含多余字段捕获变量）
    expect(source).toContain('read -r local_ref local_sha remote_ref remote_sha extra');
    // 40 位十六进制 sha 校验（含全零）
    expect(source).toContain('=~ ^[0-9a-fA-F]{40}$');
    // stdin 解析出现在 fallback diff 之前（顺序 = 语义：有 stdin 行时以 stdin 为准）
    const stdinParse = source.indexOf('local_ref local_sha remote_ref remote_sha extra');
    const fallbackDiff = source.indexOf('git diff --name-only HEAD@{push} HEAD');
    expect(stdinParse).toBeGreaterThanOrEqual(0);
    expect(fallbackDiff).toBeGreaterThan(stdinParse);
    // fallback 结构仍在（手动/非 push 场景）
    expect(source).toContain('origin/HEAD HEAD');
    // stdin 读取位于 --force 门内（force 分支不读 stdin、不触碰 ref 语义）
    const forceGuard = source.indexOf('PREPUSH_FORCE:-0');
    const stdinRead = source.indexOf('[ ! -t 0 ]');
    expect(forceGuard).toBeGreaterThanOrEqual(0);
    expect(stdinRead).toBeGreaterThan(forceGuard);
  });

  it('全零 sha 双分支：删除（local 全零跳过收集）与新分支（remote 全零走 merge-base），无 -n 20 截断', async () => {
    const source = await prePushSource();
    expect(source).toContain('ZERO_SHA=');
    // 删除 ref：本地 sha 全零 → 无本地内容可检
    expect(source).toContain('[ "$local_sha" = "$ZERO_SHA" ]');
    // 新分支：remote sha 全零 → merge-base/fork-point 建立可证明基线
    expect(source).toContain('[ "$remote_sha" = "$ZERO_SHA" ]');
    expect(source).toContain('git merge-base --fork-point');
    expect(source).toContain('git merge-base "$remote_ref" "$local_sha"');
    // merge-base 退化为推送尖本身（同名本地 ref）不构成可证明基线 → 降级 remote-tracking 排除集
    expect(source).toContain('[ "$base" = "$local_sha" ]');
    // 绝无截断式扫描：>20 commits 的新分支不得漏检（-n 截断形态禁止）
    expect(source).not.toContain('-n 20');
    expect(source).not.toMatch(/git log -n [0-9]/);
    // merge-base 不可证明时的可证明降级：remote-tracking 排除集枚举（--not --remotes=<remote>，
    // 无 -n 截断；remote 经白名单 + git remote get-url 核验，无 tracking refs / 失败仍 fail-closed）
    expect(source).toContain('git log --name-only --pretty=format:');
    expect(source).toContain('--not "--remotes=$remote_name"');
    expect(source).toContain('remote_enum_new_branch_files');
  });

  it('diff 调用把 -- 置于两 sha 之后（-- 前移会把 sha 当 pathspec 致空输出），并带 fail-closed 标记', async () => {
    const source = await prePushSource();
    expect(source).toContain('git diff --name-only "$remote_sha" "$local_sha" --');
    expect(source).toContain('git diff --name-only "$base" "$local_sha" --');
    expect(source).not.toContain('diff --name-only -- "$');
    expect(source).toContain('fail-closed');
  });
});
