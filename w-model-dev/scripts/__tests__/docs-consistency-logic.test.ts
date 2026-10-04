import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  EXPECTED,
  A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS,
  A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS,
  checkRootCauseR10Contract,
  checkRootCausePersonaMatrix,
  checkPersonaCapabilityDeclarations,
  canonicalizeExit2ProbeIdentity,
  countValidExit2Scripts,
  runDocConsistencyChecks,
  buildDocConsistencyReport,
  extractMarkdownRelLinks,
  checkSkillOutboundLinks,
  checkOrphanReferences,
  checkAgentsNavCoverage,
  checkTestsMatrixCoverage,
  ORPHAN_REFERENCE_EXEMPTIONS,
  checkSchemaFieldDescriptions,
  type DocConsistencyInput,
} from '../logic/docs-consistency-logic.js';
import { childProcessEnv } from '../lib/run-sync.js';

/** run-log.schema.json action.enum 32 值（与 schema 逐值一致、同序；审计修复 P2 同步源；task 3 增 perspective/consensus，30→32） */
const ACTION_ENUM_32 = [
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
  'plan_propose',
  'plan_task',
  'plan_review',
  'perspective',
  'consensus',
];

/** data-models.md RunLogEntry.action 联合类型（32 值，与 ACTION_ENUM_32 一致） */
const ACTION_UNION_32 =
  "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'emergency-fix' | 'escalate' | 'r3-completeness' | 'r3-reliability' | 'r3-security' | 'codegraph_query' | 'opsx_explore' | 'opsx_propose' | 'opsx_apply' | 'opsx_archive' | 'ensure_deps' | 'iceberg-sweep' | 'iceberg-review' | 'plan_propose' | 'plan_task' | 'plan_review' | 'perspective' | 'consensus';";

/** 合法 pre-push 文本（连续 #1..#N 检查块 + 「N 项检查」声明，F-G7-08 强校验基线；N 派生自 EXPECTED.prePushCount） */
const VALID_PRE_PUSH = [
  ...Array.from({ length: EXPECTED.prePushCount }, (_, i) => `# ${i + 1}. 第 ${i + 1} 项门禁检查`),
  `# 全部门禁共 ${EXPECTED.prePushCount} 项检查`,
].join('\n');

/** 合法 conventions.md 术语表 fixture（action 32 值逐值列表 + exit-2 计数句，F-G7-04/05 基线） */
const CONVENTIONS_GLOSSARY = [
  '### action（RunLogEntry）',
  `- **规范定义**：run-log 动作类型枚举（共 32 值，以 \`run-log.schema.json\` 为准）：${ACTION_ENUM_32.map((v) => `\`${v}\``).join(' / ')}。`,
  '- **_Avoid_**：operation/op/行为/事件。',
  '### exit-2 脚本口径',
  '- **规范定义**：scripts/cli/ 下除 self-test 外均为 exit 2 脚本：= 45（27 个 check-* + 18 个工具 CLI，不含 self-test）；计数由探针得出。',
].join('\n');

const R10_CONTRACT_FIXTURE = [
  '<r10-contract id="canonical-name" relation=\'{"canonicalPersona":"testing-reality-checker"}\'>canonical persona is testing-reality-checker</r10-contract>',
  '<r10-contract id="threshold" relation=\'{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}\'>testing-reality-checker confidence >= 0.5</r10-contract>',
  '<r10-contract id="legacy-fallback" relation=\'{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}\'>legacy reality-checker is fallback only when canonical is absent</r10-contract>',
  '<r10-contract id="same-artifact-dedupe" relation=\'{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}\'>same artifact canonical-first and not counted twice</r10-contract>',
  '<r10-contract id="cross-artifact-conflict" relation=\'{"artifactRelation":"different","conflict":"fail-closed"}\'>different artifact conflict is fail-closed</r10-contract>',
  '<r10-contract id="canonical-duplicate" relation=\'{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}\'>canonical > 1 duplicate is fail-closed</r10-contract>',
  '<r10-contract id="legacy-duplicate" relation=\'{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}\'>legacy > 1 duplicate is fail-closed</r10-contract>',
].join('\n');

/**
 * fixture 用的 cli 脚本名集合（= 当前 `w-model-dev/scripts/cli/` 目录的 46 个 `.ts` 基名镜像；
 * 自洽约束：与 cliScriptFiles / dispatchMatrix / SKILL「N 个 .ts」一致，随脚本退役/新增同步。
 * 2026-09-21 最终评审 C-1：随 `check-opsx-artifacts` 退役去掉该项；补登此前漏登的
 * check-coding-plan / check-coverage-scope / check-pollution / review-package，使镜像与真实目录一致。
 */
const CLI_SCRIPT_NAMES = [
  'check-archive-integrity',
  'check-artifact-gate',
  'check-bdd-model',
  'check-budget',
  'check-checkpoint',
  'check-code-tla-consistency',
  'check-codegraph-queries',
  'check-coding-plan',
  'check-coverage-scope',
  'check-design-contract-consistency',
  'check-docs-consistency',
  'check-exemption',
  'check-iceberg-sweep',
  'check-maturity',
  'check-pollution',
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
  'code-health-apply',
  'code-health-archive',
  'code-health-duplicates',
  'code-health-gap',
  'code-health-ledger',
  'code-health-phase1',
  'code-health-tests',
  'doctor',
  'ensure-codegraph',
  'metrics-report',
  'plan-chunks',
  'platform-deps-install',
  'review-package',
  'security-scan',
  'self-test',
  'wm-append-runlog',
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
    exit2ScriptCount: 45,
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
      '| `run-log` | `run-log.schema.json` | ... | action enum（32 类） |',
      '| `gate-log` | `gate-log.schema.json` | ... | append-only gate-logs 审计记录 |',
      '| `iceberg-sweep` | `iceberg-sweep.schema.json` | ... |',
      '| `evidence-manifest` | `evidence-manifest.schema.json` | ... |',
      '## RunLogEntry',
      ACTION_UNION_32,
    ].join('\n'),
    verifierSpec: 'targetKind 枚举：requirement / design / code / test / rootcause。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme:
      '**当前版本**：`41.11.0`\n8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n28 个人格文件\n40 files / 530 tests\ncoverage/、.zcode/、.w-model/ 为 Git 忽略的本地生成物；使用 npm run wm:export-evidence -- <project-dir> <output-dir> 导出脱敏 SHA-256 manifest 证据包。docs/changes/archive/ 是受控归档。',
    antiPatterns:
      '反模式清单（#1~#48；\n## 反模式清单\n| # | 反模式（不要做） | 危害 | 正确做法 |\n| 1 | 跳过阶段门评审 | 缺陷后移 | 走完评审 |\n| 48 | 大规模重构式改动 | 变更量子无穷大 | 小步重构 |',
    glossary: CONVENTIONS_GLOSSARY,
    runLogSchema: JSON.stringify({
      properties: { action: { enum: ACTION_ENUM_32 } },
    }),
    skill:
      '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n见 [references/operation-behaviors.md](references/operation-behaviors.md)。\n## 不可违反的约束\n见 [references/hard-constraints.md](references/hard-constraints.md)。\n| `references/`（53 个 .md） | 按需加载 |\n| `scripts/cli/`（47 个 .ts） | 仅 G 子代理执行 |',
    operationBehaviors: '## 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    hardConstraints: Array.from({ length: 14 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    agents:
      '45 个脚本\n40 个 .test.ts / 530 条\ncoverage/、.zcode/、.w-model/ 是 Git 忽略的本地生成物，不随 Git 交付；需要审计证据时运行 npm run wm:export-evidence -- <project-dir> <output-dir>。',
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
    prePush: VALID_PRE_PUSH,
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

  it('每条 R10 clause mutation 均产生明确 violation（7 source 全源变异）', () => {
    const clauseMutations: Array<[string, RegExp]> = [
      ['canonical-name', /^<r10-contract id="canonical-name"[^\n]*\n?/m],
      ['threshold', /^<r10-contract id="threshold"[^\n]*\n?/m],
      ['legacy-fallback', /^<r10-contract id="legacy-fallback"[^\n]*\n?/m],
      ['same-artifact-dedupe', /^<r10-contract id="same-artifact-dedupe"[^\n]*\n?/m],
      ['cross-artifact-conflict', /^<r10-contract id="cross-artifact-conflict"[^\n]*\n?/m],
      ['canonical-duplicate', /^<r10-contract id="canonical-duplicate"[^\n]*\n?/m],
      ['legacy-duplicate', /^<r10-contract id="legacy-duplicate"[^\n]*\n?/m],
    ];
    for (const sourceName of sourceNames) {
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
    }
  });

  it('R10 clause 反向/否定语义 fail-closed（7 clause）', () => {
    const cases = [
      ['canonical-name', 'canonical is not testing-reality-checker'],
      ['threshold', 'testing-reality-checker confidence is not required to be >= 0.5'],
      ['legacy-fallback', 'legacy reality-checker is fallback, but canonical is not absent'],
      ['same-artifact-dedupe', 'same artifact legacy-first and counted twice'],
      ['cross-artifact-conflict', 'different artifact conflict is allowed'],
      ['canonical-duplicate', 'canonical > 1 duplicate is allowed'],
      ['legacy-duplicate', 'legacy > 1 duplicate is allowed'],
    ] as const;
    for (const [clauseName, mutation] of cases) {
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
        `${clauseName} 反向语义应 fail-closed`,
      ).toBe(true);
    }
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
  it('拒绝隔离的自动安装禁止句式（具名清单全量，a4-platform-repair）', () => {
    for (const { description: forbiddenStatement } of A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS) {
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

      expect(
        violations.some((x) => x.check === 'a4-platform-repair' && x.message.includes('troubleshooting.md')),
        `${forbiddenStatement} 应报 a4-platform-repair`,
      ).toBe(true);
    }
  });

  it('拒绝隔离的 mtime 错误安全主张（具名清单全量，a4-state-lock）', () => {
    for (const { description: forbiddenStatement } of A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS) {
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

      expect(
        violations.some((x) => x.check === 'a4-state-lock' && x.message.includes('command-reference.md')),
        `${forbiddenStatement} 应报 a4-state-lock`,
      ).toBe(true);
    }
  });

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
  it('文档漂移检测矩阵·单断言族（21 态：变异一份文档 → 具名 check 命中）', () => {
    const cases: { label: string; overrides: Partial<DocConsistencyInput>; check: string; markers: string[] }[] = [
      {
        label: 'SSoT 三边界架构契约缺失',
        overrides: { ssot: baseInput().ssot.replace('subgraph Tools[可选外部工具]\n', '') },
        check: 'architecture-boundaries',
        markers: ['三边界'],
      },
      {
        label: 'schema 清单缺行',
        overrides: { dataModels: '### Schema 清单（21 份）\n| `verifier-output` | ... |' },
        check: 'schema-list',
        markers: ['iceberg-sweep.schema.json'],
      },
      {
        label: 'schema 清单标题份数不符',
        overrides: {
          dataModels:
            '### Schema 清单（19 份）\n| `verifier-output` | ... |\n| `run-log` | ... |\n| `iceberg-sweep` | ... |',
        },
        check: 'schema-list',
        markers: ['5 份'],
      },
      {
        label: 'run-log action 枚举长度非 32',
        overrides: { runLogSchema: JSON.stringify({ properties: { action: { enum: ['a', 'b'] } } }) },
        check: 'run-log-action',
        markers: ['32'],
      },
      {
        label: 'data-models run-log 行非 32 类',
        overrides: { dataModels: '### Schema 清单（21 份）\n| `run-log` | ... | action enum（15 类） |' },
        check: 'run-log-action',
        markers: ['32 类'],
      },
      {
        label: 'targetKind 废弃标记残留',
        overrides: { commandReference: 'targetKind=file 路由 code-reviewer' },
        check: 'targetkind',
        markers: ['targetKind=file'],
      },
      {
        label: 'README 残留 5 维度 DoD',
        overrides: { readme: '5 维度（功能 / 质量 / 测试 / 文档 / 部署）' },
        check: 'dod',
        markers: ['5 维度'],
      },
      {
        label: 'quick-self-check 缺七维度标题',
        overrides: { definitionOfDone: '## 五维度标准' },
        check: 'dod',
        markers: ['七维度标准'],
      },
      {
        label: 'README 缺 8 条操作行为',
        overrides: { readme: '6 条核心操作行为' },
        check: 'operating-behaviors',
        markers: [],
      },
      {
        label: 'SKILL.md 操作行为表缺第 8 行内容',
        overrides: { operationBehaviors: '## 八条操作行为' },
        check: 'operating-behaviors',
        markers: ['Structure Over Persuasion'],
      },
      {
        label: 'SKILL.md 内联八条操作行为完整表（已移入 references）',
        overrides: {
          skill:
            '---\nname: w-model-dev\nversion: 41.11.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
        },
        check: 'operating-behaviors',
        markers: ['不应再内联'],
      },
      {
        label: 'SKILL.md 缺操作行为指针',
        overrides: { skill: '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n（无指针）' },
        check: 'operating-behaviors',
        markers: ['operation-behaviors.md'],
      },
      {
        label: '硬约束编号缺失',
        overrides: {
          hardConstraints: Array.from({ length: 13 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
        },
        check: 'hard-constraints',
        markers: ['## #14'],
      },
      {
        label: '硬约束编号超出',
        overrides: {
          hardConstraints: Array.from({ length: 15 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
        },
        check: 'hard-constraints',
        markers: ['#15'],
      },
      {
        label: 'SKILL.md 缺硬约束指针',
        overrides: { skill: '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 不可违反的约束\n（无指针）' },
        check: 'hard-constraints',
        markers: ['hard-constraints.md'],
      },
      {
        label: 'SSoT §4A.1 缺权威标题',
        overrides: {
          ssot: [
            '8 条核心操作行为',
            '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
            '| **签名链完整性** | ... |',
          ].join('\n'),
        },
        check: 'operating-behaviors',
        markers: ['权威标题'],
      },
      {
        label: 'SSoT §4A.1 标题仍为七条（过时守卫）',
        overrides: { ssot: '### 4A.1 七条核心操作行为' },
        check: 'operating-behaviors',
        markers: ['七条核心操作行为'],
      },
      {
        label: '| 48 | 被错放主清单表外（检测信号表，归属盲区修复）',
        overrides: {
          antiPatterns:
            '反模式清单（#1~#48；\n## 反模式清单\n| # | 反模式（不要做） | 危害 | 正确做法 |\n| 47 | 大规模重构式改动 | ... |\n### 命中高发阶段\n| 阶段 | 高发反模式编号 |\n### 检测信号与回退命令\n| # | 检测信号 | 命中后回退命令 |\n| 48 | 子代理越界实施 | 回退当前阶段起点 |',
        },
        check: 'anti-patterns',
        markers: ['48', '主清单表区间之外'],
      },
      {
        label: '| 48 | 缺主清单表头（仅在其他表出现）',
        overrides: {
          antiPatterns:
            '反模式清单（#1~#48；\n### 检测信号与回退命令\n| # | 检测信号 | 命中后回退命令 |\n| 48 | 子代理越界实施 | 回退当前阶段起点 |',
        },
        check: 'anti-patterns',
        markers: ['主清单表最大编号应为 48'],
      },
      {
        label: 'pre-push 编号最大值非 19',
        overrides: { prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查' },
        check: 'pre-push',
        markers: ['19'],
      },
      {
        label: 'glossary 缺逐值列表行（F-G7-05）',
        overrides: {
          glossary:
            '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 32 值，以 `run-log.schema.json` 为准）\n其余文本',
        },
        check: 'glossary-action',
        markers: ['逐值列表行'],
      },
    ];
    for (const c of cases) {
      const violations = runDocConsistencyChecks(baseInput(c.overrides));
      expect(
        violations.some((x) => x.check === c.check && c.markers.every((m) => x.message.includes(m))),
        `${c.label} 应报 ${c.check}${c.markers.length > 0 ? `（含 ${c.markers.join(' + ')}）` : ''}`,
      ).toBe(true);
    }
  });

  it('文档漂移检测矩阵·多断言族（3 态：反模式区间 / pre-push 伪造连续块 / pre-push 编号断档）', () => {
    const cases: {
      label: string;
      overrides: Partial<DocConsistencyInput>;
      verify: (v: ReturnType<typeof runDocConsistencyChecks>) => void;
    }[] = [
      {
        label: '反模式最大编号非 46 / 旧区间残留',
        overrides: { antiPatterns: '反模式清单（#1~#29；\n| 43 | ... |' },
        verify: (v) => {
          expect(
            v.some((x) => x.check === 'anti-patterns' && x.message.includes('48')),
            '反模式最大编号应报 48',
          ).toBe(true);
          expect(
            v.some((x) => x.check === 'anti-patterns' && x.message.includes('#1~#29')),
            '旧区间残留应报 #1~#29',
          ).toBe(true);
        },
      },
      {
        label: 'pre-push 伪造 3 块检查（F-G7-08：连续块断言，非仅最大编号）',
        overrides: {
          prePush: ['# 1. self-test', '# 2. check:verifier', '# 19. typecheck', '# 全部门禁共 19 项检查'].join('\n'),
        },
        verify: (v) => {
          const hit = v.filter((x) => x.check === 'pre-push');
          expect(hit.length, 'pre-push 伪造应命中').toBeGreaterThan(0);
          expect(
            hit.some((x) => x.message.includes('连续 #1..#19') && x.message.includes('实测 3 块')),
            '伪造连续块应报「连续 #1..#19 + 实测 3 块」',
          ).toBe(true);
        },
      },
      {
        label: 'pre-push 中间删除一块（编号断档）',
        overrides: {
          prePush: [
            ...Array.from({ length: EXPECTED.prePushCount }, (_, i) => i + 1)
              .filter((n) => n !== 9)
              .map((n) => `# ${n}. 第 ${n} 项`),
            `# 全部门禁共 ${EXPECTED.prePushCount} 项检查`,
          ].join('\n'),
        },
        verify: (v) => {
          expect(
            v.some((x) => x.check === 'pre-push' && x.message.includes(`实测 ${EXPECTED.prePushCount - 1} 块`)),
            '编号断档应报实测块数不足',
          ).toBe(true);
        },
      },
    ];
    for (const c of cases) {
      c.verify(runDocConsistencyChecks(baseInput(c.overrides)));
    }
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

  it('glossary action 列表与 schema enum 漂移（缺值/多值）→ 违规（F-G7-05 逐值断言）', () => {
    const drift = CONVENTIONS_GLOSSARY.replace('`gate` / `tla-gate`', '`gate`').replace(
      '`consensus`。',
      '`consensus` / `ghost-action`。',
    );
    const v = runDocConsistencyChecks(baseInput({ glossary: drift }));
    const hit = v.find((x) => x.check === 'glossary-action' && x.message.includes('漂移'));
    expect(hit).toBeDefined();
    expect(hit?.message).toContain('tla-gate');
    expect(hit?.message).toContain('ghost-action');
  });

  it('conventions exit-2 计数句：算术不符 / 与实测不符 / 缺计数句 → 违规（F-G7-04）', () => {
    // 算术不符：27 + 17 ≠ 45
    const badArithmetic = CONVENTIONS_GLOSSARY.replace(
      '= 45（27 个 check-* + 18 个工具 CLI',
      '= 45（27 个 check-* + 17 个工具 CLI',
    );
    let v = runDocConsistencyChecks(baseInput({ glossary: badArithmetic }));
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('算术不符'))).toBe(true);

    // 声明总数与实测不符（baseInput 实测 45，声明 43）
    const stale = CONVENTIONS_GLOSSARY.replace(
      '= 45（27 个 check-* + 18 个工具 CLI',
      '= 43（27 个 check-* + 16 个工具 CLI',
    );
    v = runDocConsistencyChecks(baseInput({ glossary: stale }));
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('实际 45 个'))).toBe(true);

    // 缺计数句
    v = runDocConsistencyChecks(baseInput({ glossary: '### action（RunLogEntry）\n- **规范定义**：枚举列表省略。' }));
    expect(
      v.some((x) => x.check === 'exit2-scripts' && x.message.includes('缺「= N（N 个 check-* + N 个工具 CLI')),
    ).toBe(true);
  });

  it('checkSchemaFieldDescriptions：带 properties 节点缺 description → 违规；补全后零违规（F-G4-08）', () => {
    const schema = {
      type: 'object',
      description: '根 schema（带 properties 的根节点须有 description）',
      properties: {
        a: { description: '字段 a', type: 'string' },
        b: {
          description: '嵌套对象 b（带 properties 的嵌套节点也须有 description）',
          type: 'object',
          properties: { c: { description: '字段 c', type: 'number' } },
        },
        arr: {
          description: '数组 arr',
          type: 'array',
          items: {
            description: '数组元素对象（items 节点带 properties 须有 description）',
            type: 'object',
            properties: { d: { description: '字段 d', type: 'string' } },
          },
        },
      },
      definitions: {
        def1: {
          description: '定义 def1',
          type: 'object',
          properties: { e: { description: '字段 e', type: 'string' } },
        },
      },
    };
    expect(checkSchemaFieldDescriptions({ 'x.schema.json': schema })).toEqual([]);

    // 篡改：删除 b 的 description → 违规指向 #/properties/b；删除 items 的 description → 指向 items 路径
    const tampered = JSON.parse(JSON.stringify(schema)) as typeof schema;
    delete (tampered.properties.b as { description?: string }).description;
    delete ((tampered.properties.arr as { items: { description?: string } }).items as { description?: string })
      .description;
    const v = checkSchemaFieldDescriptions({ 'x.schema.json': tampered });
    expect(v.some((x) => x.message.includes('x.schema.json: #/properties/b 缺 description'))).toBe(true);
    expect(v.some((x) => x.message.includes('#/properties/arr/items 缺 description'))).toBe(true);
    // $defs 兼容（draft-2019-09 关键字混入也能遍历到）
    const withDefs = {
      type: 'object',
      properties: { f: { type: 'string' } },
      $defs: { g: { type: 'object', properties: { h: { type: 'string' } } } },
    };
    const vDefs = checkSchemaFieldDescriptions({ 'y.schema.json': withDefs });
    expect(vDefs.some((x) => x.message.includes('#/definitions/g 缺 description'))).toBe(true);
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
      prePush: '# 18. typecheck\n# Vitest 全量运行结果以当前命令输出为准。',
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

  it('真实 CLI 隔离 fixture：过期门禁项数 exit 1 且不污染真实 checkout', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const troubleshootingPath = path.join(fixtureRoot, 'docs', 'troubleshooting.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled repository fixture path
      const content = await fs.readFile(troubleshootingPath, 'utf8');
      const current = '本次推送未执行 19 项门禁';
      const stale = '本次推送未执行 17 项门禁';
      expect(content).toContain(current);
      const mutated = content.replace(current, stale);
      expect(mutated).not.toBe(content);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled repository fixture path
      await fs.writeFile(troubleshootingPath, mutated, 'utf8');

      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stdout) as { reasons: string[] };
      expect(
        report.reasons.some(
          (reason) =>
            reason.includes('[gate-count-docs]') &&
            reason.includes('docs/troubleshooting.md:13') &&
            reason.includes('17 项'),
        ),
      ).toBe(true);
    });
  }, 90_000); // real CLI spawn: ~12s alone, can exceed the 30s default under full-suite load

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
        // F-G6-02：printErrorJson 有值即输出 detail（可选字段），探测归一化保留该键
        rawErrorJson: {
          category: 'ARG_INVALID',
          message: '--phase 参数非法',
          exitCode: 2,
          rule: 'P0-1',
          detail: '须为 1-8 整数（支持 --phase=N 与 --phase N 两形态，重复传参即错）',
        },
      });
    });
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

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
        // 34 = 25 existing schemas + 9 code-health campaign schemas
        schemaCount: 34,
        cliScriptCount: 48,
        exit2ScriptCount: 47,
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
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(49);
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
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

  it('同一 checkout 的无状态与最小合法 run-log 状态使用完全相同的 exit2 probe map，且计数为 47', async () => {
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
      expect(withoutStateReport.dynamicMeasurements.exit2ScriptCount).toBe(47);
      expect(withStateReport.dynamicMeasurements.exit2ScriptCount).toBe(47);
    });
  }, 120_000);

  it('AGENTS=34 的旧资产声明在同一真实 fixture 中失败', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const agentsPath = path.join(fixtureRoot, 'AGENTS.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      const agents = await fs.readFile(agentsPath, 'utf8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths are inside an mkdtemp-owned fixture
      await fs.writeFile(agentsPath, agents.replace('全仓 47 个脚本 exit 2', '全仓 34 个脚本 exit 2'), 'utf8');
      // INSTALL 侧的同类半段（原 `install.replace('27 个 check-*.ts', …)`）已随 2026-09-27 门禁瘦身
      // T5 去数字退休：该字面量不再存在，变异恒为 no-op，且无门禁消费该位置声明。
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('exit2-scripts');
    });
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

  it('code-health 门禁脚本未登记 dispatch-matrix（文档事实漂移）→ docs-consistency exit 1 且 reason 含 code-health', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const dispatchPath = path.join(fixtureRoot, 'w-model-dev', 'references', 'subagent-delegation.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is inside the mkdtemp-owned fixture
      const dispatch = await fs.readFile(dispatchPath, 'utf8');
      expect(dispatch).toContain('code-health-phase1');
      // Remove the exact registered token (a suffix such as `code-health-phase1-x` would still
      // satisfy the substring-based script-registry check, so the whole token must disappear).
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is inside the mkdtemp-owned fixture
      await fs.writeFile(dispatchPath, dispatch.replaceAll('code-health-phase1', 'code-health-phaseX'), 'utf8');
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      expect(result.stdout).toMatch(/code-health|SSoT|exit/);
      expect(result.stdout).toContain('script-registry');
    });
  }, 120_000);

  it('成功测量的非法形态必须 fail-closed（6 态：run identity/artifact identity/commit SHA/content hash）', () => {
    const cases = [
      ['missing run identity', { vitestRunId: '' }],
      ['invalid run identity', { vitestRunId: 'run identity with spaces' }],
      ['absolute artifact identity', { vitestArtifactId: 'D:/temp/results.json' }],
      ['traversing artifact identity', { vitestArtifactId: 'vitest/../results.json' }],
      ['invalid commit SHA', { vitestCommitSha: 'a'.repeat(39) }],
      ['invalid content hash', { vitestArtifactSha256: 'b'.repeat(63) }],
    ] as const;
    for (const [caseName, invalidField] of cases) {
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
      expect(
        report.violations.some((violation) => violation.check === 'vitest-results'),
        `${caseName} 测量非法应 fail-closed（vitest-results）`,
      ).toBe(true);
    }
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
  }, 600_000); // 本用例连跑 5 次 fixture CLI（每次内部含 48 条 exit-2 探针的串行 spawn）；本机实测单次 CLI
  // ~40.4s，负载下更慢 → 原 120s 预算结构性不足（2026-09-26 全量套件实测超时，与用例逻辑无关）。
  // 600s 按实测口径给 5 次 spawn 的墙钟预算（单次 ~40.4s；单次 spawn 上限默认 240s 只是负载余量上限，外层 600s 才是总预算；曾误写 90s 旧值）；断言、探针数与判据语义一律不变。

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
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

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
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

  it('CLI 拒绝 failed 或 success=false 的 coverage JSON，而不是只提取总用例数', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 916, { numPassedTests: 874, numFailedTests: 1, success: false });
      const result = runDocsConsistencyCli(fixtureRoot);
      expect(result.code).toBe(1);
      expect(result.stdout).toMatch(/\[vitest-(tests|results)\]/);
      expect(result.stdout).toMatch(/失败|不可采信|success/);
    });
  }, 90_000); // real CLI spawn: can exceed the 30s default under full-suite load

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
      expect(report.dynamicMeasurements.exit2ScriptCount).toBe(47);
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(49);
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
  }, 120_000); // real CLI spawns (export three-scenario isolation): can exceed the 30s default under full-suite load

  // T3 三态（门禁瘦身）：无受控工件 + 无 --spawn-vitest → 动态 facts 跳过（诊断 + dynamicMeasurements=null + exit 0，
  // 不 spawn）；--spawn-vitest → 走自采集（本用例内 vitest 缺失，仍 fail-closed，证明未被静默跳过）。
  const NO_VITEST_ENV: NodeJS.ProcessEnv = {
    WM_VITEST_COUNT_FILE: '',
    WM_VITEST_PROVENANCE_FILE: '',
    WM_VITEST_PROVENANCE_ROOT: '',
    PATH: '',
    Path: '',
  };
  const SKIPPED_DIAGNOSTIC =
    '○ 动态 facts 未校验：未提供受控 vitest 工件（WM_VITEST_COUNT_FILE / WM_VITEST_PROVENANCE_FILE）；终局验收经 npm run prepush 覆盖（fail-closed）。如需自采集请显式加 --spawn-vitest（约 30 分钟）。';

  it('CLI 无受控 vitest 工件且未传 --spawn-vitest → 跳过动态 facts 诊断可见并 exit 0（不 spawn）', async () => {
    await withDocsConsistencyFixture(
      async (fixtureRoot) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is a mkdtemp-owned isolated repository copy
        expect(existsSync(path.join(fixtureRoot, 'node_modules', 'vitest'))).toBe(false);
        // 无 vitest 可执行且 PATH 清空：若仍 spawn（回退到 npx）必然采集失败 → exit 1；
        // 故 exit 0 本身即「未 spawn」的判据（同原用例的 vitest 不可用前提，反向断言）。
        const json = runDocsConsistencyCli(fixtureRoot, NO_VITEST_ENV, ['--json'], { timeoutMs: 30_000 });
        expect(json.code, JSON.stringify(json)).toBe(0);
        const report = JSON.parse(json.stdout) as {
          passed: boolean;
          dynamicViolations: Array<{ check: string }>;
          dynamicMeasurements: unknown;
          diagnostics: string[];
        };
        expect(report.passed).toBe(true);
        // 缺省态 dynamicMeasurements 置 null（JSON 键保持在场、形状稳定），诊断逐字可见
        expect(report.dynamicMeasurements).toBeNull();
        expect(report.diagnostics).toEqual([SKIPPED_DIAGNOSTIC]);
        expect(report.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);

        // 人类可读通道同样显式声明「跳过」而不是「无法采集（不一致）」
        const human = runDocsConsistencyCli(fixtureRoot, NO_VITEST_ENV, [], { timeoutMs: 30_000 });
        expect(human.code, JSON.stringify(human)).toBe(0);
        expect(human.stdout).toContain('vitest 用例  : 跳过（未提供受控 vitest 工件）');
        expect(human.stdout).toContain(SKIPPED_DIAGNOSTIC);
        expect(human.stdout).not.toContain('[vitest-tests]');
      },
      { availablePackages: ['tsx', 'typescript', 'esbuild'] },
    );
  }, 120_000);

  it('CLI 显式 --spawn-vitest（无工件）→ 仍走自采集 fail-closed，不静默跳过动态 facts', async () => {
    await withDocsConsistencyFixture(
      async (fixtureRoot) => {
        const result = runDocsConsistencyCli(fixtureRoot, NO_VITEST_ENV, ['--json', '--spawn-vitest'], {
          timeoutMs: 60_000,
        });
        // 逃生口语义：显式要求自采集即恢复 fail-closed（vitest 不可用 → 采集失败 → vitest-* 违规 exit 1），
        // 不得退化成「跳过 + exit 0」。本用例断言路由（spawn 被真实发起）；成功路径见下一条 stub vitest 用例。
        expect(result.code, JSON.stringify(result)).toBe(1);
        const report = JSON.parse(result.stdout) as {
          reasons: string[];
          dynamicMeasurements: { vitestTestCount: number } | null;
        };
        expect(report.reasons.some((reason) => reason.includes('[vitest-'))).toBe(true);
        expect(report.dynamicMeasurements).not.toBeNull();

        // 人类可读通道（L9，2026-09-28 遗留收口）：态 2（自采集失败，-1 哨兵）的统计行须如实为
        // 「无法采集（不一致）」（cli/check-docs-consistency.ts 的 vitestTestLabel 分支），不得与态 3 的
        // 「跳过（未提供受控 vitest 工件）」混淆，也不得把 -1 哨兵原样打印。
        const human = runDocsConsistencyCli(fixtureRoot, NO_VITEST_ENV, ['--spawn-vitest'], {
          timeoutMs: 60_000,
        });
        expect(human.code, JSON.stringify(human)).toBe(1);
        expect(human.stdout).toContain('vitest 用例  : 无法采集（不一致）');
        expect(human.stdout).not.toContain('跳过（未提供受控 vitest 工件）');
      },
      { availablePackages: ['tsx', 'typescript', 'esbuild'] },
    );
  }, 180_000); // L9 复审（2026-09-28）：本用例含两次真实 CLI spawn（各 timeoutMs 60s）——最坏 2×60s 会顶到原 120s 外层上限，放宽留 fixture 准备与负载余量（实测 ~28s）

  it('CLI --spawn-vitest 自采集成功路径：自生成同目录 provenance 后严格校验通过（stub vitest）', async () => {
    await withDocsConsistencyFixture(
      async (fixtureRoot) => {
        // 口径说明：真实 `--spawn-vitest` 会跑约 30 分钟全量套件（且中途终止有孤儿进程风险），
        // 本用例用**受控 stub vitest** 走到「JSON 工件生成成功」为止——spawn 形态（process.execPath +
        // node_modules/vitest 入口 + --outputFile）与生产路径一致，只把「跑测试」替换为「写 JSON」。
        const vitestDir = path.join(fixtureRoot, 'node_modules', 'vitest');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
        await fs.mkdir(vitestDir, { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
        await fs.writeFile(
          path.join(vitestDir, 'package.json'),
          JSON.stringify({ name: 'vitest', version: '0.0.0', bin: { vitest: 'stub-cli.mjs' } }),
          'utf-8',
        );
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
        await fs.writeFile(
          path.join(vitestDir, 'stub-cli.mjs'),
          [
            "import { writeFileSync } from 'node:fs';",
            "const out = process.argv.find((arg) => arg.startsWith('--outputFile='));",
            'if (out) {',
            "  writeFileSync(out.slice('--outputFile='.length), JSON.stringify({ testResults: [{}, {}], numTotalTests: 7, numPassedTests: 7, numFailedTests: 0, success: true }));",
            '}',
            'process.exit(0);',
          ].join('\n'),
          'utf-8',
        );
        const result = runDocsConsistencyCli(
          fixtureRoot,
          // 只清 WM_VITEST_* 工件变量（保留 PATH：自采集 provenance 的 commitSha 经 git 读取，
          // 清 PATH 会让该路径退化到「provenance 不可信」，掩盖本用例要验证的成功语义）
          { WM_VITEST_COUNT_FILE: '', WM_VITEST_PROVENANCE_FILE: '', WM_VITEST_PROVENANCE_ROOT: '' },
          ['--json', '--spawn-vitest'],
          { timeoutMs: 60_000 },
        );
        expect(result.code, JSON.stringify(result)).toBe(0);
        const report = JSON.parse(result.stdout) as {
          dynamicMeasurements: {
            testFileCount: number;
            vitestTestCount: number;
            vitestArtifactId: string;
            vitestRunId: string;
            success: boolean;
          } | null;
          diagnostics?: string[];
        };
        expect(report.dynamicMeasurements).toMatchObject({
          testFileCount: 2,
          vitestTestCount: 7,
          success: true,
          vitestArtifactId: 'vitest/generated-results.json',
        });
        expect(report.dynamicMeasurements?.vitestRunId).toMatch(/^[0-9a-f]{16}$/);
        // 逃生口下不产生「动态 facts 未校验」诊断（该诊断只属态 3）
        expect(report.diagnostics ?? []).toEqual([]);
      },
      { availablePackages: ['tsx', 'typescript', 'esbuild'] },
    );
  }, 120_000);

  it('CLI --spawn-vitest 与受控工件共存时快路径优先（prepush 语义一字不变）', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json', '--spawn-vitest']);
      expect(result.code, JSON.stringify(result)).toBe(0);
      const report = JSON.parse(result.stdout) as {
        diagnostics?: string[];
        dynamicMeasurements: { vitestArtifactId: string; vitestTestCount: number };
      };
      expect(report.dynamicMeasurements.vitestArtifactId).toBe('vitest/results.json');
      expect(report.dynamicMeasurements.vitestTestCount).toBe(1002);
      // 受控工件路径不产生跳过诊断
      expect(report.diagnostics ?? []).toEqual([]);
    });
  }, 120_000);

  it('logic 层 vitestFactsSkipped=true 时跳过 vitest 动态校验（prepush 缺省保持 fail-closed）', () => {
    const skipped = buildDocConsistencyReport(
      baseInput({ testFileCount: -1, vitestTestCount: -1, vitestFactsSkipped: true }),
    );
    expect(skipped.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(false);
    const failClosed = buildDocConsistencyReport(baseInput({ testFileCount: -1, vitestTestCount: -1 }));
    expect(failClosed.dynamicViolations.some((violation) => violation.check.startsWith('vitest-'))).toBe(true);
  });

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
  }, 90_000); // real CLI spawns: can exceed the 30s default under full-suite load

  it('活体文档并存旧 Vitest 数字时不产生动态文档违规', () => {
    const input = baseInput({
      readme: '**当前版本**：`41.11.0`\n40 files / 530 tests\n42 files / 663 tests',
      agents: '31 个脚本\n41 个 .test.ts / 530 条',
      vitestExtraDocs: [
        {
          name: 'CONTRIBUTING.md',
          content: '| 12 | vitest 全量（40 files / 623 tests） | 0 |',
        },
        {
          name: 'docs/INSTALL.md',
          content: '# vitest 单元测试（40 个 .test.ts / 623 条）',
        },
      ],
    });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests')).toEqual([]);
  });

  it('PR 模板门禁项数（2 态：过期 14 项 / 与 EXPECTED 一致）', () => {
    const cases = [
      {
        label: 'PR 模板含过期门禁项数（14 项）',
        prTemplate: '- [ ] `npm run prepush` 14 项通过',
        kind: 'hit' as const,
        markers: ['PULL_REQUEST_TEMPLATE', '14 项'],
      },
      {
        label: 'PR 模板项数与 EXPECTED 一致',
        prTemplate: `- [ ] \`npm run prepush\` ${EXPECTED.prePushCount} 项通过`,
        kind: 'clean' as const,
        markers: [],
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput({ prTemplate: c.prTemplate })).filter((x) => x.check === 'pre-push');
      if (c.kind === 'hit') {
        expect(
          v.some((x) => c.markers.every((m) => x.message.includes(m))),
          `${c.label} 应报 pre-push 违规（含 ${c.markers.join(' + ')}）`,
        ).toBe(true);
      } else {
        expect(v, `${c.label} 应零 pre-push 违规`).toEqual([]);
      }
    }
  });

  it('vitestExtraDocs / prTemplate 缺省注入 → 跳过检查不产生违规', () => {
    expect(
      runDocConsistencyChecks(baseInput()).some(
        (x) => x.message.includes('CONTRIBUTING.md') || x.message.includes('PULL_REQUEST_TEMPLATE'),
      ),
    ).toBe(false);
  });

  it('skill-outbound-links（2 态对照：逃逸链接违规 / 仅包内链接与外部 URL 零违规）', () => {
    type PkgDoc = { name: string; content: string; baseDir: string };
    const cases: { label: string; docs: PkgDoc[]; verify: (v: ReturnType<typeof checkSkillOutboundLinks>) => void }[] =
      [
        {
          label: '技能包文档含逃逸链接',
          docs: [
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
          ],
          verify: (v) => {
            expect(v, '两个逃逸链接各报 1 条').toHaveLength(2);
            expect(
              v.every((x) => x.check === 'skill-outbound-links'),
              '全部为 skill-outbound-links',
            ).toBe(true);
            expect(v[0]!.message, '第 1 条应指名 SSoT 逃逸路径').toContain('../../docs/skill-design-document_SSoT.md');
            expect(v[1]!.message, '第 2 条应指名 INSTALL 逃逸路径').toContain('../docs/INSTALL.md');
          },
        },
        {
          label: '技能包文档仅包内链接 / 外部 URL',
          docs: [
            {
              name: 'w-model-dev/references/verifier-spec.md',
              content:
                '见 [SKILL.md](../SKILL.md) 与 [反模式](hard-constraints.md)；外部 [spec](https://example.com/x.md)。',
              baseDir: 'references',
            },
            {
              name: 'w-model-dev/scripts/samples/tla-e2e/README.md',
              content: '运行 [check-tla-model.ts](../../cli/check-tla-model.ts)。',
              baseDir: 'scripts/samples/tla-e2e',
            },
          ],
          verify: (v) => {
            expect(v, '包内链接与外部 URL 不应违规').toEqual([]);
          },
        },
      ];
    for (const c of cases) {
      c.verify(checkSkillOutboundLinks(c.docs));
    }
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

  it('baseline-sync 矩阵（4 态：缺失违规 / 空违规 / 无变更放行 / 非空放行）', () => {
    const cases: {
      label: string;
      scriptsChanged: boolean;
      entryCount: number;
      kind: 'hit' | 'clean';
      marker?: string;
    }[] = [
      {
        label: 'scripts 有变更且 baseline 缺失',
        scriptsChanged: true,
        entryCount: -1,
        kind: 'hit',
        marker: '.eslintsecurity-baseline.json',
      },
      {
        label: 'scripts 有变更且 baseline 空',
        scriptsChanged: true,
        entryCount: 0,
        kind: 'hit',
        marker: '指纹条目为空',
      },
      { label: 'scripts 无变更即使 baseline 缺失', scriptsChanged: false, entryCount: -1, kind: 'clean' },
      { label: 'scripts 有变更且 baseline 非空', scriptsChanged: true, entryCount: 42, kind: 'clean' },
    ];
    for (const c of cases) {
      const input = baseInput({ scriptsChanged: c.scriptsChanged, securityBaselineEntryCount: c.entryCount });
      const v = runDocConsistencyChecks(input).filter((x) => x.check === 'baseline-sync');
      if (c.kind === 'hit') {
        expect(v, `${c.label} 应恰 1 条违规`).toHaveLength(1);
        expect(v[0]!.message, `${c.label} 应指名 ${c.marker}`).toContain(c.marker);
      } else {
        expect(v, `${c.label} 应零违规`).toEqual([]);
      }
    }
  });

  it('version-consistency 一致对照（2 态：七处一致 / CHANGELOG 版本节头一致）', () => {
    const cases = [
      { label: '版本七处一致', overrides: {} },
      { label: 'CHANGELOG.md 版本节头一致', overrides: {} },
    ] as const;
    for (const c of cases) {
      expect(
        runDocConsistencyChecks(baseInput(c.overrides)).some((x) => x.check === 'version-consistency'),
        `${c.label} 应零 version-consistency 违规`,
      ).toBe(false);
    }
  });

  it('version-consistency 漂移族（8 态：README/package-lock/lockJson 缺省/skill-metadata/SKILL frontmatter/INSTALL/CHANGELOG 缺头/CHANGELOG 漂移）', () => {
    const cases: {
      label: string;
      overrides: Partial<DocConsistencyInput>;
      kind: 'hit' | 'clean';
      markers: string[];
    }[] = [
      {
        label: 'README 版本漂移',
        overrides: { readme: '**当前版本**：`41.2.0`\n8 条核心操作行为' },
        kind: 'hit',
        markers: ['README', '41.2.0'],
      },
      {
        label: 'package-lock 根 version 漂移',
        overrides: { lockJson: JSON.stringify({ name: 'x', version: '41.10.0' }) },
        kind: 'hit',
        markers: ['package-lock.json'],
      },
      {
        label: 'lockJson 缺省注入（不产生 package-lock version 违规）',
        overrides: { lockJson: undefined },
        kind: 'clean',
        markers: ['package-lock.json'],
      },
      {
        label: 'skill-metadata.json 版本漂移',
        overrides: { metaJson: JSON.stringify({ name: 'w-model-dev', version: '42.0.0' }) },
        kind: 'hit',
        markers: ['skill-metadata.json'],
      },
      {
        label: 'SKILL.md frontmatter 版本漂移',
        overrides: {
          skill:
            '---\nname: w-model-dev\nversion: 41.0.0\n---\n### 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
        },
        kind: 'hit',
        markers: ['SKILL.md frontmatter'],
      },
      {
        label: 'INSTALL.md 激活示例版本漂移',
        overrides: { installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.0.0\n```' },
        kind: 'hit',
        markers: ['INSTALL.md'],
      },
      {
        label: 'CHANGELOG.md 缺版本节头',
        overrides: { changelog: '# Changelog\n\n- 无版本节头\n' },
        kind: 'hit',
        markers: ['CHANGELOG', '41.11.0'],
      },
      {
        label: 'CHANGELOG.md 版本节头漂移',
        overrides: { changelog: '# Changelog\n\n## [41.10.0] - 2026-08-13\n\n- 旧条目\n' },
        kind: 'hit',
        markers: ['CHANGELOG', '41.10.0'],
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput(c.overrides));
      const hit = v.some((x) => x.check === 'version-consistency' && c.markers.every((m) => x.message.includes(m)));
      if (c.kind === 'hit') {
        expect(hit, `${c.label} 应报 version-consistency（含 ${c.markers.join(' + ')}）`).toBe(true);
      } else {
        // 缺省注入的负向断言：不应出现对应文档的 version-consistency 违规
        expect(
          v.some((x) => x.check === 'version-consistency' && c.markers.some((m) => x.message.includes(m))),
          `${c.label} 不应报（含 ${c.markers.join(' + ')}）`,
        ).toBe(false);
      }
    }
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

  it('package.json 不可解析 → 违规（fail loud）', () => {
    const input = baseInput({ pkgJson: 'not-json{' });
    expect(
      runDocConsistencyChecks(input).some((x) => x.check === 'version-consistency' && x.message.includes('无法解析')),
    ).toBe(true);
  });

  it('ssot-headings 违规行（2 态：章节号缺号 / 未决占位标题 3.3.x）', () => {
    const cases: { label: string; ssot: string; marker: string }[] = [
      {
        label: 'SSoT 顶层章节号缺号',
        ssot: ['## 1. 项目概述', '## 2. 理论基础', '## 4. 工作流'].join('\n'),
        marker: '缺 3',
      },
      {
        label: 'SSoT 未决占位标题（3.3.x）',
        ssot: '## 3. 技能架构设计\n\n### 3.3.x 外部工具集成\n\n## 4. 技能工作流程',
        marker: '3.3.x',
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput({ ssot: c.ssot })).filter((x) => x.check === 'ssot-headings');
      expect(
        v.some((x) => x.message.includes(c.marker)),
        `${c.label} 应报 ssot-headings（含 ${c.marker}）`,
      ).toBe(true);
    }
  });

  it('ssot-headings 通过行（2 态：章节号连续含字母后缀章 / 无编号顶层章守卫跳过）', () => {
    const cases: { label: string; ssot: string }[] = [
      {
        label: 'SSoT 顶层章节号连续（含字母后缀章 4A/10A/10C/11A）',
        ssot: [
          ...Array.from({ length: 11 }, (_, i) => `## ${i + 1}. 标题${i + 1}`),
          '## 4A. 标题4',
          '## 10A. 标题10',
          '## 10C. 标题10',
          '## 11A. 标题11',
        ].join('\n'),
      },
      { label: 'SSoT 无编号顶层章（守卫跳过）', ssot: '### 4A.1 八条核心操作行为\n纯文本无章节号' },
    ];
    for (const c of cases) {
      expect(
        runDocConsistencyChecks(baseInput({ ssot: c.ssot })).some((x) => x.check === 'ssot-headings'),
        `${c.label} 应零 ssot-headings 违规`,
      ).toBe(false);
    }
  });

  it('script-registry 违规行（2 态：dispatch-matrix 漏登记 / SKILL 声明计数不符）', () => {
    const cases: { label: string; overrides: Partial<DocConsistencyInput>; markers: string[] }[] = [
      {
        label: 'dispatch-matrix 漏登记 check-tla-model',
        overrides: {
          dispatchMatrix: [
            '# 分派矩阵',
            ...CLI_SCRIPT_NAMES.filter((n) => n !== 'check-tla-model').map((n) => `- ${n}`),
          ].join('\n'),
        },
        markers: ['check-tla-model', '未登记'],
      },
      {
        label: 'SKILL.md 声明 .ts 计数与实测不符（43 vs 47）',
        overrides: { skill: baseInput().skill.replace('（47 个 .ts）', '（43 个 .ts）') },
        markers: ['43', '47'],
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput(c.overrides)).filter((x) => x.check === 'script-registry');
      expect(
        v.some((x) => c.markers.every((m) => x.message.includes(m))),
        `${c.label} 应报 script-registry（含 ${c.markers.join(' + ')}）`,
      ).toBe(true);
    }
  });

  it('script-registry 通过行（2 态：全登记 + 计数一致 / cliScriptFiles 为空守卫跳过）', () => {
    const cases: { label: string; overrides: Partial<DocConsistencyInput> }[] = [
      { label: '全部脚本已登记 + SKILL 计数一致', overrides: {} },
      { label: 'cliScriptFiles 为空（守卫跳过）', overrides: { cliScriptFiles: [] } },
    ];
    for (const c of cases) {
      expect(
        runDocConsistencyChecks(baseInput(c.overrides)).some((x) => x.check === 'script-registry'),
        `${c.label} 应零 script-registry 违规`,
      ).toBe(false);
    }
  });
});

describe('run-log action 枚举语义同步（data-models.md interface vs schema enum）', () => {
  it('run-log-action 漂移三态（缺值报漂移 / 完全一致无漂移 / 多值报带「多」漂移）', () => {
    const header = ['### Schema 清单（4 份）', '| `run-log` | ... | action enum（32 类） |', '## RunLogEntry'];
    const cases: { label: string; dataModels: string; kind: 'hit' | 'clean'; marker?: string }[] = [
      {
        label: 'interface 联合类型缺值（复刻 15 值漂移）',
        dataModels: [
          ...header,
          "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'escalate';",
        ].join('\n'),
        kind: 'hit',
        marker: '漂移',
      },
      {
        label: 'interface 与 enum 完全一致',
        dataModels: [...header, ACTION_UNION_32].join('\n'),
        kind: 'clean',
      },
      {
        label: 'interface 含 enum 之外的额外值（多 bogus-action）',
        dataModels: [...header, ACTION_UNION_32.replace("'consensus';", "'consensus' | 'bogus-action';")].join('\n'),
        kind: 'hit',
        marker: '多 bogus-action',
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput({ dataModels: c.dataModels })).filter(
        (x) => x.check === 'run-log-action',
      );
      if (c.kind === 'hit') {
        expect(
          v.some((x) => x.message.includes('漂移') && (c.marker === undefined || x.message.includes(c.marker))),
          `${c.label} 应报漂移违规（${c.marker ?? '少值方向'}）`,
        ).toBe(true);
      } else {
        expect(
          v.some((x) => x.message.includes('漂移')),
          `${c.label} 不应报漂移违规`,
        ).toBe(false);
      }
    }
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

  it('internal-links 通过/跳过族（2 态：内链全部存在 / linkDocs+linkExists 缺省守卫跳过）', () => {
    const cases: { label: string; overrides: Partial<DocConsistencyInput> }[] = [
      {
        label: '内链全部存在',
        overrides: {
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
        },
      },
      { label: 'linkDocs/linkExists 缺省（守卫跳过，fixture 兼容）', overrides: {} },
    ];
    for (const c of cases) {
      expect(
        runDocConsistencyChecks(baseInput(c.overrides)).some((x) => x.check === 'internal-links'),
        `${c.label} 应零 internal-links 违规`,
      ).toBe(false);
    }
  });

  it('internal-links 违规/归一化族（4 态：断链 / ../ 上溯 / ./ 前缀 / SSoT 错链，消息含文档名 + 归一化路径）', () => {
    type LinkDoc = { name: string; content: string; baseDir: string };
    const cases: {
      label: string;
      docs: LinkDoc[];
      exists: (p: string, seen: string[]) => boolean;
      verify: (v: ReturnType<typeof runDocConsistencyChecks>, seen: string[]) => void;
    }[] = [
      {
        label: '断链（glossary.md → renamed-guide.md）',
        docs: [{ name: 'glossary.md', content: '见 [旧名](./renamed-guide.md)。', baseDir: 'w-model-dev/references' }],
        exists: () => false,
        verify: (v) => {
          expect(v, '断链应恰 1 条').toHaveLength(1);
          expect(v[0]!.message, '应指名文档名 + 链接原文').toContain('glossary.md 内链断链：./renamed-guide.md');
          expect(v[0]!.message, '应含归一化绝对路径').toContain('w-model-dev/references/renamed-guide.md');
        },
      },
      {
        label: '../ 上溯目录（references → w-model-dev/SKILL.md）',
        docs: [{ name: 'glossary.md', content: '见 [SKILL](../SKILL.md)。', baseDir: 'w-model-dev/references' }],
        exists: (p, seen) => {
          seen.push(p);
          return true;
        },
        verify: (v, seen) => {
          expect(
            v.some((x) => x.check === 'internal-links'),
            '上溯归一化后应存在 → 零违规',
          ).toBe(false);
          expect(seen, 'linkExists 应收到 POSIX 归一化路径').toEqual(['w-model-dev/SKILL.md']);
        },
      },
      {
        label: '根目录 baseDir="."（去除 ./ 前缀，README 链接形态）',
        docs: [{ name: 'README.md', content: '见 [CHANGELOG](./CHANGELOG.md)。', baseDir: '.' }],
        exists: (p, seen) => {
          seen.push(p);
          return true;
        },
        verify: (v, seen) => {
          expect(
            v.some((x) => x.check === 'internal-links'),
            './ 前缀归一化后应零违规',
          ).toBe(false);
          expect(seen, 'linkExists 应收到去除 ./ 前缀的路径').toEqual(['CHANGELOG.md']);
        },
      },
      {
        label: 'SSoT 内错误相对链接（../../CHANGELOG.md）',
        docs: [
          {
            name: 'docs/skill-design-document_SSoT.md',
            content: '见 [CHANGELOG](../../CHANGELOG.md)。',
            baseDir: 'docs',
          },
        ],
        exists: () => false,
        verify: (v) => {
          expect(v, 'SSoT 错链应恰 1 条').toHaveLength(1);
          expect(v[0]!.message, '应指名文档名').toContain('docs/skill-design-document_SSoT.md');
          expect(v[0]!.message, '应指名链接原文').toContain('../../CHANGELOG.md');
        },
      },
    ];
    for (const c of cases) {
      const seen: string[] = [];
      const v = runDocConsistencyChecks(baseInput({ linkDocs: c.docs, linkExists: (p) => c.exists(p, seen) }));
      c.verify(v, seen);
    }
  });
});

describe('S31 完整性审计双维度（orphan-reference / agents-nav-missing）', () => {
  /** S31 orphan-reference fixture 类型（name=相对技能包根 POSIX 路径；baseDir=所在目录） */
  type OrphanDoc = { name: string; content: string; baseDir: string };

  it('orphan-reference 违规族（4 态：零入链孤儿 / 自链接 / 代码块内链不算入链 / 缺 SKILL 条目 fail-closed）', () => {
    type OrphanDoc = { name: string; content: string; baseDir: string };
    const cases: { label: string; docs: OrphanDoc[]; marker: string }[] = [
      {
        label: 'references 孤儿文件（零入链）',
        docs: [
          { name: 'SKILL.md', content: '见 [图谱](references/graph-guide.md)。', baseDir: '.' },
          { name: 'references/graph-guide.md', content: '见 [词汇表](glossary.md)。', baseDir: 'references' },
          { name: 'references/orphan-draft.md', content: '# 草稿\n没有任何链接。', baseDir: 'references' },
        ],
        marker: 'references/orphan-draft.md',
      },
      {
        label: '自链接不计入入链（「其它 references」语义，仍判孤儿）',
        docs: [
          { name: 'SKILL.md', content: '', baseDir: '.' },
          { name: 'references/self-link.md', content: '[自己](self-link.md)', baseDir: 'references' },
        ],
        marker: 'references/self-link.md',
      },
      {
        label: '围栏代码块与行内 code span 内的链接不作为入链（剥离后无链 → 孤儿）',
        docs: [
          {
            name: 'SKILL.md',
            content: '```md\n[fake](references/a.md)\n```\n行内 `[fake2](references/a.md)` 不算。',
            baseDir: '.',
          },
          { name: 'references/a.md', content: '无链接正文。', baseDir: 'references' },
        ],
        marker: 'references/a.md',
      },
      {
        label: 'orphanAuditDocs 缺 SKILL.md 条目（入链来源不完整不静默放行）',
        docs: [{ name: 'references/a.md', content: '', baseDir: 'references' }],
        marker: 'SKILL.md',
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput({ orphanAuditDocs: c.docs })).filter(
        (x) => x.check === 'orphan-reference',
      );
      expect(v, `${c.label} 应恰 1 条违规`).toHaveLength(1);
      expect(v[0]!.message, `${c.label} 应指名 ${c.marker}`).toContain(c.marker);
    }
  });

  it('SKILL.md 与 references 互链覆盖全部文件（./ 前缀 + 锚点剥离）→ 零违规', () => {
    const docs: OrphanDoc[] = [
      { name: 'SKILL.md', content: '见 [a](./references/a.md)。', baseDir: '.' },
      { name: 'references/a.md', content: '见 [b](./b.md#sec)。', baseDir: 'references' },
      { name: 'references/b.md', content: '无链接正文。', baseDir: 'references' },
    ];
    expect(
      runDocConsistencyChecks(baseInput({ orphanAuditDocs: docs })).some((x) => x.check === 'orphan-reference'),
    ).toBe(false);
  });

  it('指向包根/包外的链接（../SKILL.md）不影响 references 目标判定', () => {
    const docs: OrphanDoc[] = [
      { name: 'SKILL.md', content: '[a](references/a.md)', baseDir: '.' },
      { name: 'references/a.md', content: '[SKILL](../SKILL.md) 与 [SSoT](../../docs/ssot.md)', baseDir: 'references' },
    ];
    expect(
      runDocConsistencyChecks(baseInput({ orphanAuditDocs: docs })).some((x) => x.check === 'orphan-reference'),
    ).toBe(false);
  });

  it('豁免清单生效：豁免文件零违规，非豁免文件仍报（checkOrphanReferences 第二参注入）', () => {
    const docs: OrphanDoc[] = [
      { name: 'SKILL.md', content: '', baseDir: '.' },
      { name: 'references/exempt-draft.md', content: '无链接。', baseDir: 'references' },
      { name: 'references/plain.md', content: '无链接。', baseDir: 'references' },
    ];
    const v = checkOrphanReferences(docs, ['exempt-draft.md']);
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain('references/plain.md');
    expect(v[0]!.message).not.toContain('exempt-draft');
  });

  it('ORPHAN_REFERENCE_EXEMPTIONS 生产常量当前为空数组（真实包零豁免；未来合法孤儿才登记）', () => {
    expect(ORPHAN_REFERENCE_EXEMPTIONS).toEqual([]);
  });

  it('orphan-reference 跳过族（2 态：orphanAuditDocs 缺省注入 / checkOrphanReferences undefined 注入）', () => {
    const cases = [
      {
        label: 'orphanAuditDocs 缺省注入（跳过检查，fixture 兼容）',
        run: () => runDocConsistencyChecks(baseInput()).filter((x) => x.check === 'orphan-reference'),
      },
      { label: 'checkOrphanReferences undefined 注入（跳过）', run: () => checkOrphanReferences(undefined) },
    ] as const;
    for (const c of cases) {
      expect(c.run(), `${c.label} 应零违规`).toEqual([]);
    }
  });

  it('agents-nav-missing 违规族（4 态：缺基名 / §8 表外正文提及 / 相似前缀 / 表外代码块）', () => {
    const cases: { label: string; agents: string; cliScriptFiles: string[]; marker?: string }[] = [
      {
        label: 'AGENTS.md 缺某 cli 基名',
        agents: '# AGENTS\n## 8. 脚本导航表\n| wm-write.ts | 状态写 |',
        cliScriptFiles: ['wm-write.ts', 'check-tla-model.ts'],
        marker: 'check-tla-model',
      },
      {
        label: '§8 表外正文提及基名（表格行被删，子串不再算登记）',
        agents: [
          '# AGENTS',
          '正文顺带提到 check-tla-model 这个名字，但 §8 表里没有它的行。',
          '## 8. 脚本导航表',
          '| wm-write.ts | 状态写 |',
        ].join('\n'),
        cliScriptFiles: ['wm-write.ts', 'check-tla-model.ts'],
        marker: 'check-tla-model',
      },
      {
        label: '相似前缀行（check-foo-bar.ts）不能让 check-foo.ts 通过（精确名匹配）',
        agents: '## 8. 脚本导航表\n| check-foo-bar.ts | 别的门禁 |',
        cliScriptFiles: ['check-foo.ts'],
        marker: 'check-foo.ts',
      },
      {
        label: '§8 表外的同章节代码块不算登记（只认表格行首单元格）',
        agents: '## 8. 脚本导航表\n\n```text\ncheck-tla-model.ts\n```\n',
        cliScriptFiles: ['check-tla-model.ts'],
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(
        baseInput({ agentsNav: { agents: c.agents, cliScriptFiles: c.cliScriptFiles } }),
      ).filter((x) => x.check === 'agents-nav-missing');
      expect(v, `${c.label} 应恰 1 条违规`).toHaveLength(1);
      if (c.marker !== undefined) {
        expect(v[0]!.message, `${c.label} 应指名 ${c.marker}`).toContain(c.marker);
      }
    }
  });

  it('agents-nav 通过/跳过族（3 态：§8 表 .ts 形态全覆盖 / agentsNav 缺省 / checkAgentsNavCoverage undefined）', () => {
    const cases = [
      {
        label: '全部 cli 基名以 §8 表行形态出现（.ts 后缀）',
        run: () =>
          runDocConsistencyChecks(
            baseInput({
              agentsNav: {
                agents: '## 8. 脚本导航表\n| check-tla-model.ts | TLA+ 门禁 |\n| wm-write.ts | 状态写 |',
                cliScriptFiles: ['check-tla-model.ts', 'wm-write.ts'],
              },
            }),
          ).filter((x) => x.check === 'agents-nav-missing'),
      },
      {
        label: 'agentsNav 缺省注入（跳过检查，fixture 兼容）',
        run: () => runDocConsistencyChecks(baseInput()).filter((x) => x.check === 'agents-nav-missing'),
      },
      { label: 'checkAgentsNavCoverage undefined 注入（跳过）', run: () => checkAgentsNavCoverage(undefined) },
    ] as const;
    for (const c of cases) {
      expect(c.run(), `${c.label} 应零违规`).toEqual([]);
    }
  });

  // ---- tests-matrix：__tests__/README.md 覆盖矩阵 ↔ 在盘 *.test.ts 集合双向相等（任务 7）----

  it('checkTestsMatrixCoverage undefined 注入 → 跳过（零违规，fixture 兼容）', () => {
    expect(checkTestsMatrixCoverage(undefined)).toEqual([]);
  });

  it('tests-matrix 违规族（3 态：矩阵缺失 / 未登记+孤儿 / 多行登记，违规码具名）', () => {
    const tableHeader = ['| File | Area | What |', '| --- | --- | --- |'];
    const cases: {
      label: string;
      input: { readme: string | null; testFiles: string[] };
      verify: (v: ReturnType<typeof checkTestsMatrixCoverage>) => void;
    }[] = [
      {
        label: '覆盖矩阵 README 缺失（null，不静默放行）',
        input: { readme: null, testFiles: ['a.test.ts'] },
        verify: (v) => {
          expect(v, 'README 缺失应恰 1 条').toHaveLength(1);
          expect(v[0]!.check, '违规码应为 tests-matrix-missing').toBe('tests-matrix-missing');
          expect(v[0]!.message, '应指名 README.md').toContain('README.md');
        },
      },
      {
        label: '在盘未登记 + 表格行指向不存在文件',
        input: {
          readme: [...tableHeader, '| a.test.ts | A | x |', '| ghost.test.ts | G | y |'].join('\n'),
          testFiles: ['a.test.ts', 'b.test.ts'],
        },
        verify: (v) => {
          expect(v.map((x) => x.check).sort(), '应同时报 missing 与 orphan').toEqual([
            'tests-matrix-missing',
            'tests-matrix-orphan',
          ]);
          const joined = v.map((x) => x.message).join('\n');
          expect(joined, '应点名未登记的 b.test.ts').toContain('b.test.ts');
          expect(joined, '应点名孤儿的 ghost.test.ts').toContain('ghost.test.ts');
        },
      },
      {
        label: '同一测试文件登记多行',
        input: {
          readme: [...tableHeader, '| a.test.ts | A | x |', '| a.test.ts | A2 | y |'].join('\n'),
          testFiles: ['a.test.ts'],
        },
        verify: (v) => {
          expect(v, '多行登记应恰 1 条').toHaveLength(1);
          expect(v[0]!.check, '违规码应为 tests-matrix-duplicate').toBe('tests-matrix-duplicate');
        },
      },
    ];
    for (const c of cases) {
      c.verify(checkTestsMatrixCoverage(c.input));
    }
  });

  it('矩阵与在盘集合双向相等 → 零违规', () => {
    const readme = [
      '| File | Area | What |',
      '| --- | --- | --- |',
      '| a.test.ts | A | x |',
      '| b.test.ts | B | y |',
    ].join('\n');
    expect(checkTestsMatrixCoverage({ readme, testFiles: ['a.test.ts', 'b.test.ts'] })).toEqual([]);
  });

  it('真实 CLI fixture：新增未登记 cli 脚本 + 孤儿 references → exit 1 且 reasons 含两违规码', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 1002);
      // 未登记进 AGENTS.md §8 表的新 cli 脚本（基名 zz-fake-tool 不在 AGENTS.md）
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      await fs.writeFile(
        path.join(fixtureRoot, 'w-model-dev', 'scripts', 'cli', 'zz-fake-tool.ts'),
        'console.log(1);\n',
        'utf8',
      );
      // 无任何入链的孤儿 references 文件
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      await fs.writeFile(
        path.join(fixtureRoot, 'w-model-dev', 'references', 'zz-orphan-note.md'),
        '# 孤儿备注\n\n无入链正文。\n',
        'utf8',
      );
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stdout) as { reasons: string[] };
      expect(report.reasons.some((r) => r.startsWith('[orphan-reference]'))).toBe(true);
      expect(report.reasons.some((r) => r.startsWith('[agents-nav-missing]'))).toBe(true);
    });
  }, 120_000);
});

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const DOCS_CONSISTENCY_CLI = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-docs-consistency.ts',
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function toBashPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (process.platform !== 'win32' || !/^([A-Za-z]):\//.test(normalized)) return normalized;
  const result = spawnSync(
    'bash',
    [
      '-c',
      `if command -v wslpath >/dev/null 2>&1; then wslpath -a -u ${shellQuote(normalized)}; elif command -v cygpath >/dev/null 2>&1; then cygpath -a -u ${shellQuote(normalized)}; else printf '%s\\n' ${shellQuote(normalized)}; fi`,
    ],
    { encoding: 'utf8', input: '', timeout: 15_000 },
  );
  const converted = String(result.stdout ?? '').trim();
  return result.status === 0 && converted !== '' ? converted : normalized;
}

async function removeWithRetry(target: string, options: { recursive?: boolean; force?: boolean } = {}): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rm(target, { ...options, force: options.force ?? true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code ?? '') || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

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
        /* prettier-ignore */ return !isD2Transient(source) && !['node_modules', '.git', '.w-model', '.codegraph', '.worktrees'].some(
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
    await removeWithRetry(fixtureRoot, { recursive: true });
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
    // 单次 fixture CLI 预算：内部含 48 条 exit-2 探针的串行 spawn，本机实测 ~40.4s（负载下更慢）→
    // 原 90s 上限在负载下会先杀掉子进程（status=null → 断言读到假失败）。240s 给足负载余量；
    // 外层每个用例自身的 testTimeout 仍是总预算上限（只放宽墙钟，判据/断言/探针数不变）。
    timeout: options.timeoutMs ?? 240_000,
    env: childProcessEnv({
      ...process.env,
      WM_VITEST_COUNT_FILE: countFile,
      WM_VITEST_PROVENANCE_FILE: provenanceFile,
      WM_VITEST_PROVENANCE_ROOT: fixtureRoot,
      ...envOverrides,
    }),
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
      const bashEnvPath = toBashPath(bashEnv);
      const prePushPath = toBashPath(path.join(REPO_ROOT, '.githooks', 'pre-push'));
      const command = [
        `cd ${shellQuote(toBashPath(REPO_ROOT))}`,
        `source ${shellQuote(bashEnvPath)}`,
        'export -f npm npx mktemp 2>/dev/null || true',
        `bash ${shellQuote(prePushPath)} --force`,
      ].join('; ');
      const child = execFile(
        'bash',
        ['-c', command],
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
      // execFile 的 stdin 是管道；pre-push 无 ref 输入时必须显式 EOF，避免 Windows/WSL 挂起。
      child.stdin?.end();
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
    await removeWithRetry(toolRoot, { recursive: true });
  }
}

describe('D4 动态元数据和本地证据文档治理', () => {
  it('本地证据文档边界违规（形态 1：缺登记与文档缺失 → 三 check；形态 2：每份文档分别缺任一声明种类）', () => {
    // 形态 1：schema/分派矩阵缺登记 + 本地证据文档缺全部声明
    const missingRegistry = buildDocConsistencyReport(
      baseInput({
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
      } as DocConsistencyInput),
    );
    expect(
      missingRegistry.staticViolations.some((x) => x.check === 'schema-list'),
      '缺 evidence-manifest 登记应报 schema-list',
    ).toBe(true);
    expect(
      missingRegistry.staticViolations.some((x) => x.check === 'script-registry'),
      '缺 wm-export-evidence 登记应报 script-registry',
    ).toBe(true);
    expect(
      missingRegistry.staticViolations.some((x) => x.check === 'local-evidence-artifacts'),
      '本地证据文档缺声明应报 local-evidence-artifacts',
    ).toBe(true);

    // 形态 2：每份文档 × 每种声明缺失（消息含文档名 + 缺失声明种类）
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
  // 定位说明：pre-push 行为级覆盖位于 platform-deps-hook.test.ts（stdin 多 ref / 基线 /
  // fail-closed 真实断言）；本组是对 hook 源码的文本级补充防线——变量重命名即红属预期，
  // 用于防语义漂移的第二道闸，不承担行为验证职责。
  // 直接读取 .githooks/pre-push 源文本断言契约（hook 是 bash，不由 docs-consistency
  // logic 校验；此处守住与 19 项门禁并列的触发语义防线，防回归旧「全局 diff 短路 /
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
    const fallbackDiff = source.indexOf('git -c core.quotePath=false diff --name-only HEAD@{push} HEAD');
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
    expect(source).toContain('git -c core.quotePath=false log -m --name-only --pretty=format:');
    expect(source).toContain('--not "--remotes=$remote_name"');
    expect(source).toContain('remote_enum_new_branch_files');
  });

  it('diff 调用把 -- 置于两 sha 之后（-- 前移会把 sha 当 pathspec 致空输出），并带 fail-closed 标记', async () => {
    const source = await prePushSource();
    expect(source).toContain('git -c core.quotePath=false diff --name-only "$remote_sha" "$local_sha" --');
    expect(source).toContain('git -c core.quotePath=false diff --name-only "$base" "$local_sha" --');
    expect(source).not.toContain('diff --name-only -- "$');
    // H1（review2-fixes）：全部 5 个 git log/diff 调用点（排除集枚举 log + 4 个 diff，
    // fallback 行 || 两侧各一）统一前插 -c core.quotePath=false——非 ASCII 文件名必须按
    // 字面（非转义八进制）进入触发面判定，否则带中文/Unicode 文件名的推送会逃过路径过滤。
    const nonCommentSource = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    // 匹配限定真实调用形态（log -m / diff --name-only），排除 parse_reason 提示串中的「git diff 失败」字样
    const gitLogDiffCalls =
      nonCommentSource.match(/git (?:-c core\.quotePath=false )?(?:log -m|diff --name-only) /g) ?? [];
    expect(gitLogDiffCalls).toHaveLength(5);
    expect(gitLogDiffCalls.every((call) => call.startsWith('git -c core.quotePath=false '))).toBe(true);
    expect(source).toContain('fail-closed');
  });
});

describe('gate-count-docs（活体文档门禁项数引用扫描，F1 反哺）', () => {
  it('stale clean/stale 对照（2 态：四份白名单文档全 19 项零违规 / 任一文档「17 项门禁」具名违规）', () => {
    const n = EXPECTED.prePushCount;
    const cases: {
      label: string;
      docs: { name: string; content: string }[];
      verify: (v: ReturnType<typeof runDocConsistencyChecks>) => void;
    }[] = [
      {
        label: `clean：四份白名单文档全 ${n} 项`,
        docs: [
          { name: 'README.md', content: `本地 CI：${n} 项门禁（含 eval 语料断言）` },
          { name: 'AGENTS.md', content: `手动跑推送前门禁（不实际推送，${n} 项门禁检查；` },
          { name: 'CONTRIBUTING.md', content: `在 \`git push\` 时自动跑 ${n} 项检查；` },
          { name: 'docs/troubleshooting.md', content: `未执行 ${n} 项门禁（exit 0 放行）` },
        ],
        verify: (v) => {
          expect(
            v.filter((x) => x.check === 'gate-count-docs'),
            'clean 形态应零违规',
          ).toEqual([]);
        },
      },
      {
        label: 'stale：任一文档「17 项门禁」（消息含文件名与行号）',
        docs: [{ name: 'docs/troubleshooting.md', content: '未执行 17 项门禁（exit 0 放行）' }],
        verify: (v) => {
          const hits = v.filter((x) => x.check === 'gate-count-docs');
          expect(hits, 'stale 应恰 1 条违规').toHaveLength(1);
          expect(hits[0]!.message, '应含文件名与行号').toContain('docs/troubleshooting.md:1');
          expect(hits[0]!.message, '应含过期计数').toContain('17 项');
        },
      },
    ];
    for (const c of cases) {
      c.verify(runDocConsistencyChecks(baseInput({ gateCountDocs: c.docs })));
    }
  });

  it('stale 计数误报防护（6 态：下标引用/无空格下标/项目后缀/混合行/无标记行/裸形态）', () => {
    const cases: {
      label: string;
      doc: { name: string; content: string };
      kind: 'clean' | 'hit';
      marker?: string;
    }[] = [
      {
        label: 'index-exclusion：行含门禁标记的「第 14 项」下标引用',
        doc: { name: 'CONTRIBUTING.md', content: 'pre-push 第 14 项 npm audit warn 并跳过（门禁不阻断）' },
        kind: 'clean',
      },
      {
        label: 'index-exclusion：无空格「第14项」',
        doc: { name: 'CONTRIBUTING.md', content: 'pre-push 第14项 npm audit（门禁不阻断）' },
        kind: 'clean',
      },
      {
        label: 'project-suffix：含门禁标记的「3 项目」不作为计数',
        doc: { name: 'AGENTS.md', content: '门禁说明：3 项目目录不计数' },
        kind: 'clean',
      },
      {
        label: 'mixed-line：同一行跳过序数但捕获过期计数',
        doc: { name: 'README.md', content: '第 14 项 npm audit（门禁稳定）且 17 项门禁未同步' },
        kind: 'hit',
        marker: '17 项',
      },
      {
        label: 'marker-gate：无「门禁/检查」标记的行（5 项闭环脚本）',
        doc: {
          name: 'README.md',
          content: 'G 还须跑 5 项闭环脚本（check-budget.ts / check-run-log.ts / check-maturity.ts）',
        },
        kind: 'clean',
      },
      {
        label: 'bare-form：行内含 `门禁` 标记的裸「N 项」（README:31 形态）',
        doc: { name: 'README.md', content: '| 推送前门禁（本地 CI，17 项） |' },
        kind: 'hit',
        marker: '17 项',
      },
    ];
    for (const c of cases) {
      const v = runDocConsistencyChecks(baseInput({ gateCountDocs: [c.doc] })).filter(
        (x) => x.check === 'gate-count-docs',
      );
      if (c.kind === 'clean') {
        expect(v, `${c.label} 不应误报`).toEqual([]);
      } else {
        expect(v, `${c.label} 应具名捕获`).toHaveLength(1);
        expect(v[0]!.message, `${c.label} 应含过期计数 ${c.marker}`).toContain(c.marker);
      }
    }
  });

  it('非白名单/undefined 注入（2 态：CHANGELOG.md 不扫描 / gateCountDocs undefined 跳过）', () => {
    const cases: { label: string; overrides: Partial<DocConsistencyInput> }[] = [
      {
        label: '非白名单文档名（CHANGELOG.md，白名单函数内过滤）',
        overrides: {
          gateCountDocs: [{ name: 'CHANGELOG.md', content: '本次推送未执行 17 项门禁（历史记录，不可改）' }],
        },
      },
      { label: 'undefined 注入（fixture 兼容）', overrides: { gateCountDocs: undefined } },
    ];
    for (const c of cases) {
      expect(
        runDocConsistencyChecks(baseInput(c.overrides)).filter((x) => x.check === 'gate-count-docs'),
        `${c.label} 应零违规`,
      ).toEqual([]);
    }
  });

  it('多文档多违规聚合', () => {
    const input = baseInput({
      gateCountDocs: [
        { name: 'AGENTS.md', content: '自动跑 17 项门禁' },
        { name: 'CONTRIBUTING.md', content: '自动跑 16 项检查' },
      ],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs');
    expect(v).toHaveLength(2);
  });
});

it('docs-consistency fixture copy excludes transient .d2-* files', async () => {
  const transientRelativePath = path.join(
    'w-model-dev',
    'scripts',
    'logic',
    `.d2-docs-consistency-fixture-${process.pid}.ts`,
  );
  const transientSourcePath = path.join(REPO_ROOT, transientRelativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled transient fixture path
  await fs.writeFile(transientSourcePath, 'transient fixture\n', 'utf8');
  try {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled repository fixture path
      expect(existsSync(path.join(fixtureRoot, transientRelativePath))).toBe(false);
    });
  } finally {
    await fs.rm(transientSourcePath, { force: true });
  }
});

function isD2Transient(source: string): boolean {
  return path.basename(source).startsWith('.d2-');
}

describe('R-persona 矩阵一致性与 persona 能力声明（R11 判据源）', () => {
  const capabilities = 'capabilities: 擅长：x；不擅长：y\ninputs: z\noutputs: w\nboundaries: 适用：a；换人：b';
  const personaFile = (name: string, extra = ''): { name: string; content: string } => ({
    name: `${name}.md`,
    content: `---\nname: ${name}\ndescription: d\n${capabilities}\n${extra}---\n\n# ${name}\n`,
  });

  const syntheticChecker = [
    'export const R_PERSONA_MATRIX = {',
    "  'coding-error': ['engineering-code-reviewer', 'testing-reality-checker'],",
    '};',
    'export const R_PERSONA_SIGNAL_MATRIX = [',
    "  { signal: '安全相关 Critical', personas: ['engineering-threat-detection-engineer'] },",
    '];',
  ].join('\n');

  const syntheticDoc = [
    '### 2. R-persona 选择矩阵（第一键 rootCause.category + 第二键 风险域信号）',
    '',
    '| rootCause.category 候选 | 阶段 | 加载的 R-persona |',
    '|---|---|---|',
    '| `coding-error` | 5 | engineering-code-reviewer + testing-reality-checker |',
    '',
    '**第二键：风险域信号**',
    '',
    '| 信号 | 阶段 | 叠加 persona |',
    '|---|---|---|',
    '| 安全相关 Critical | 5-7 | engineering-threat-detection-engineer |',
    '',
    '---',
    '',
  ].join('\n');

  const syntheticPersonas = [
    personaFile('engineering-code-reviewer'),
    personaFile('testing-reality-checker'),
    personaFile('engineering-threat-detection-engineer'),
  ];

  it('真实仓库：矩阵三方对账零违规（代码常量 ↔ agent-personas.md §2 ↔ subagent/ 文件）', async () => {
    const personaFiles = (await fs.readdir(path.join(REPO_ROOT, 'w-model-dev/subagent')))
      .filter((f) => f.endsWith('.md'))
      .sort();
    const violations = checkRootCausePersonaMatrix({
      checkerSource: await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/scripts/logic/root-cause-logic.ts'), 'utf8'),
      authoritySpec: await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/references/agent-personas.md'), 'utf8'),
      personaFiles: await Promise.all(
        personaFiles.map(async (f) => ({
          name: f,
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- subagent/ 为仓库受控目录，f 来自 readdir 且经 .md 过滤
          content: await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/subagent', f), 'utf8'),
        })),
      ),
    });
    expect(violations).toEqual([]);
  });

  it('真实仓库：全部人格文件能力声明四字段零违规', async () => {
    // 人格文件数量与 README 声明的一致性由 checkAssetCounts（persona-count）单独强制，
    // 本用例只负责「四字段全覆盖」这一维度，故按在盘清单动态取，不复制计数常量。
    const names = (await fs.readdir(path.join(REPO_ROOT, 'w-model-dev/subagent'))).filter((f) => f.endsWith('.md'));
    const violations = checkPersonaCapabilityDeclarations(
      await Promise.all(
        names.map(async (f) => ({
          name: f,
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- subagent/ 为仓库受控目录，f 来自 readdir 且经 .md 过滤
          content: await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/subagent', f), 'utf8'),
        })),
      ),
    );
    expect(violations).toEqual([]);
  });

  it('合成：代码与文档一致时零违规', () => {
    const violations = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker,
      authoritySpec: syntheticDoc,
      personaFiles: syntheticPersonas,
    });
    expect(violations).toEqual([]);
  });

  it('合成：文档行少一个 persona 时报告候选集不一致', () => {
    const violations = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker,
      authoritySpec: syntheticDoc.replace(
        'engineering-code-reviewer + testing-reality-checker',
        'engineering-code-reviewer',
      ),
      personaFiles: syntheticPersonas,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toMatch(/coding-error 行候选集不一致/);
  });

  it('合成：矩阵引用 subagent/ 中不存在的 persona 时报告（category 行与信号行都覆盖）', () => {
    const categoryRow = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker.replace("'testing-reality-checker'", "'testing-nonexistent-person'"),
      authoritySpec: syntheticDoc.replace('testing-reality-checker', 'testing-nonexistent-person'),
      personaFiles: syntheticPersonas,
    });
    expect(categoryRow.some((v) => /引用了不存在的 persona「testing-nonexistent-person」/.test(v.message))).toBe(true);

    const signalRow = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker.replace(
        "'engineering-threat-detection-engineer'",
        "'engineering-nonexistent-signal'",
      ),
      authoritySpec: syntheticDoc.replace('engineering-threat-detection-engineer', 'engineering-nonexistent-signal'),
      personaFiles: syntheticPersonas,
    });
    expect(signalRow.some((v) => /引用了不存在的 persona「engineering-nonexistent-signal」/.test(v.message))).toBe(
      true,
    );
  });

  it('合成：文档多出代码矩阵没有的 category 行时报告', () => {
    const violations = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker,
      authoritySpec: syntheticDoc.replace(
        '| `coding-error` | 5 |',
        '| `rogue-gap` | 5 | engineering-code-reviewer |\n| `coding-error` | 5 |',
      ),
      personaFiles: syntheticPersonas,
    });
    expect(violations.map((v) => v.message).join('\n')).toMatch(/§2 多出 rootCause\.category=rogue-gap 行/);
  });

  it('合成：矩阵常量缺失或文档无 §2 表格时 fail-closed', () => {
    const noConst = checkRootCausePersonaMatrix({
      checkerSource: 'export const X = 1;',
      authoritySpec: syntheticDoc,
      personaFiles: syntheticPersonas,
    });
    expect(noConst).toHaveLength(1);
    expect(noConst[0]!.message).toMatch(/未能独立解析出 R_PERSONA_MATRIX/);

    const noTable = checkRootCausePersonaMatrix({
      checkerSource: syntheticChecker,
      authoritySpec: '# 无矩阵的文档\n',
      personaFiles: syntheticPersonas,
    });
    expect(noTable).toHaveLength(1);
    expect(noTable[0]!.message).toMatch(/表格未能解析（fail-closed）/);
  });

  it('合成：人格缺任一能力声明字段即报告，清单为空 fail-closed', () => {
    const missing = checkPersonaCapabilityDeclarations([
      { name: 'a.md', content: '---\nname: a\ncapabilities: x\ninputs: y\noutputs: z\n---\n' },
    ]);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.message).toMatch(/a\.md frontmatter 缺非空「boundaries」字段/);

    const noFrontmatter = checkPersonaCapabilityDeclarations([{ name: 'b.md', content: '# b\n' }]);
    expect(noFrontmatter).toHaveLength(1);
    expect(noFrontmatter[0]!.message).toMatch(/b\.md 缺 YAML frontmatter/);

    const empty = checkPersonaCapabilityDeclarations([]);
    expect(empty).toHaveLength(1);
    expect(empty[0]!.message).toMatch(/人格文件清单为空/);
  });
});
