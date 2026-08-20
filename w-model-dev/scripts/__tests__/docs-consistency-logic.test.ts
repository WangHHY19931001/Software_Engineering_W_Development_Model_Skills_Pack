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

/** scripts/cli 当前 35 个脚本名（fixture 自洽：与 cliScriptFiles / dispatchMatrix / SKILL「N 个 .ts」一致） */
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
  'security-scan',
  'self-test',
  'wm-export-evidence',
  'wm-status',
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
    exit2ScriptCount: 31,
    referencesCount: 53,
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
      '---\nname: w-model-dev\nversion: 41.11.0\n---\n## 核心操作行为\n见 [references/operation-behaviors.md](references/operation-behaviors.md)。\n## 不可违反的约束\n见 [references/hard-constraints.md](references/hard-constraints.md)。\n| `references/`（53 个 .md） | 按需加载 |\n| `scripts/cli/`（35 个 .ts） | 仅 G 子代理执行 |',
    operationBehaviors: '## 八条操作行为\n| 8 | **Structure Over Persuasion** | ...',
    hardConstraints: Array.from({ length: 14 }, (_, i) => `## #${i + 1} 约束${i + 1}标题`).join('\n'),
    agents:
      '31 个脚本\n40 个 .test.ts / 530 条\ncoverage/、.zcode/、.w-model/ 是 Git 忽略的本地生成物，不随 Git 交付；需要审计证据时运行 npm run wm:export-evidence -- <project-dir> <output-dir>。',
    pkgJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.11.0' }),
    metaJson: JSON.stringify({ name: 'w-model-dev', version: '41.11.0' }),
    installDoc: '## 5. 激活机制\n```yaml\nname: w-model-dev\nversion: 41.11.0\n```',
    lockJson: JSON.stringify({ name: 'w-model-dev-skill', version: '41.11.0' }),
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
    prePush: '# 17. typecheck\n# 与原 CI 一致：17 项检查\n# vitest 全量（530 tests）',
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

    expect(oldSemantics.some((x) => x.check === 'a4-state-lock' && x.message.includes('dispatch-matrix.md'))).toBe(
      true,
    );
    expect(oldSemantics.some((x) => x.check === 'a4-platform-repair' && x.message.includes('troubleshooting.md'))).toBe(
      true,
    );
    expect(oldSemantics.some((x) => x.check === 'vitest-tests' && x.message.includes('47 个 test 文件 / 725 条'))).toBe(
      true,
    );
    expect(
      oldSemantics.some((x) => x.check === 'vitest-tests' && x.message.includes('vitest 725 条（47 test files）')),
    ).toBe(true);
    expect(oldSemantics.some((x) => x.check === 'vitest-tests' && x.message.includes('49 个 test 文件 / 766 条'))).toBe(
      true,
    );
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
        { name: 'anti-patterns.md #28', content: 'schema 清单 20 份' },
        { name: 'anti-patterns.md #28 检测信号', content: 'schema 清单（20 份）' },
        { name: 'docs/user-guide.md', content: 'schema（20 份清单）' },
      ],
    } as DocConsistencyInput;

    const violations = runDocConsistencyChecks(input);
    for (const name of [
      'SSoT',
      'SKILL.md',
      'anti-patterns.md #28',
      'anti-patterns.md #28 检测信号',
      'docs/user-guide.md',
    ]) {
      expect(
        violations.some((x) => x.check === 'schema-list' && x.message.includes(name) && x.message.includes('21 份')),
      ).toBe(true);
    }
  });

  it('真实 JSON 计数与旧活体声明不一致 → vitest-files / vitest-tests 违规', () => {
    const input = baseInput({
      testFileCount: 50,
      vitestTestCount: 803,
    });
    const violations = runDocConsistencyChecks(input);
    expect(violations.some((x) => x.check === 'vitest-files')).toBe(true);
    expect(violations.some((x) => x.check === 'vitest-tests')).toBe(true);
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
      'anti-patterns.md #28',
      'anti-patterns.md #28 检测信号',
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

  it('coverage JSON 的 54/895 元数据与活体文档同步 → CLI 消费 JSON 注入计数', async () => {
    const input = baseInput();
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      const coverage = await writeVitestCount(fixtureRoot, 895);
      expect([(coverage.testResults as unknown[]).length, coverage.numTotalTests]).toEqual([54, 895]);
      const docsWithLiveCount = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/INSTALL.md', '.githooks/pre-push'];
      for (const doc of docsWithLiveCount) {
        const docPath = path.join(fixtureRoot, doc);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
        const docContent = await fs.readFile(docPath, 'utf-8');
        expect(docContent).toContain('895');
      }
      const passing = runDocsConsistencyCli(fixtureRoot);
      expect(passing.code, `${passing.stdout}\n${passing.stderr}`).toBe(0);
      expect(passing.stdout).toContain('vitest 用例  : 895');
      expect(passing.stdout).toContain('静态违规      : 0');
      expect(passing.stdout).toContain('动态违规      : 0');
      expect(passing.stdout).not.toContain('[vitest-tests]');

      const readme = path.join(fixtureRoot, 'README.md');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      const content = await fs.readFile(readme, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled fixture path
      await fs.writeFile(readme, content.replace('54 files / 895 tests', '54 files / 894 tests'), 'utf-8');
      const stale = runDocsConsistencyCli(fixtureRoot);
      expect(stale.code).toBe(1);
      expect(stale.stdout).toContain('vitest 用例  : 895');
      expect(stale.stdout).toContain('[vitest-tests]');
      expect(stale.stdout).toContain('README.md');
      expect(stale.stdout).toContain('54 files / 894 tests');
    });
  });

  it('真实 CLI --json 输出 dynamicMeasurements 的完整五字段并保留兼容 violations', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      const coverage = await writeVitestCount(fixtureRoot, 895);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        violations: unknown[];
        dynamicMeasurements: {
          testFileCount: number;
          vitestTestCount: number;
          numPassedTests: number;
          numFailedTests: number;
          success: boolean;
          vitestArtifactId: string;
          vitestRunId: string;
          vitestArtifactSha256: string;
          vitestCommitSha: string;
          exit2ProbeResults: Array<{
            script: string;
            status: number;
            errorExitCode: number | null;
            outputExistsAfter?: boolean;
            emittedEvidenceExport?: boolean;
          }>;
        };
      };
      expect(report.violations).toEqual([]);
      expect(report.dynamicMeasurements).toMatchObject({
        schemaCount: 22,
        cliScriptCount: 35,
        exit2ScriptCount: 34,
        testFileCount: (coverage.testResults as unknown[]).length,
        vitestTestCount: 895,
        numPassedTests: 895,
        numFailedTests: 0,
        success: true,
        testDirectoryInventoryCount: 54,
      });
      expect(report.dynamicMeasurements.vitestArtifactId).toBe('vitest/results.json');
      expect(report.dynamicMeasurements.vitestRunId).toMatch(/^[0-9a-f]{16}$/);
      expect(report.dynamicMeasurements.vitestArtifactSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(report.dynamicMeasurements.vitestCommitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(36);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.every((probe) => probe.status === 2 && probe.errorExitCode === 2),
      ).toBe(true);
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
        vitestPassedCount: 895,
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
      await writeVitestCount(fixtureRoot, 895);
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
  });

  it('外部 artifact 缺 provenance、绑定错误 commit 或 hash 时 fail-closed', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 895);
      const provenance = path.join(fixtureRoot, 'vitest-results.provenance.json');
      await fs.rm(provenance);
      const missing = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(missing.code).toBe(1);
      expect(missing.stdout).toContain('vitest-results');

      await writeVitestCount(fixtureRoot, 895);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      const content = JSON.parse(await fs.readFile(provenance, 'utf8')) as Record<string, unknown>;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      await fs.writeFile(provenance, JSON.stringify({ ...content, commitSha: '0'.repeat(40) }), 'utf8');
      const stale = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(stale.code).toBe(1);
      expect(stale.stdout).toContain('vitest-results');

      const coveragePath = path.join(fixtureRoot, 'vitest-results.json');
      await writeVitestCount(fixtureRoot, 895);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path is inside the mkdtemp-owned test root
      await fs.appendFile(coveragePath, 'tampered', 'utf8');
      const mismatchedHash = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(mismatchedHash.code).toBe(1);
      expect(mismatchedHash.stdout).toContain('vitest-results');

      const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-vitest-outside-'));
      try {
        const raw = JSON.stringify(await writeVitestCount(fixtureRoot, 895));
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
  });

  it('CLI --json 对不可信 coverage 仍 exit1 并输出完整失败测量字段', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 895, { numPassedTests: 881, numFailedTests: 1, success: false });
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stdout) as {
        dynamicMeasurements: Record<string, unknown>;
        violations: unknown[];
      };
      expect(report.dynamicMeasurements).toMatchObject({
        testFileCount: 54,
        vitestTestCount: 895,
        numPassedTests: 881,
        numFailedTests: 1,
        success: false,
      });
      expect(report.violations.some((entry) => (entry as { rule?: string }).rule === 'vitest-results')).toBe(true);
    });
  });

  it('CLI 注入 testResults=[] 的 coverage JSON 时以 JSON 文件数为准，不能由目录枚举掩盖', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 895, { testResults: [] });
      const result = runDocsConsistencyCli(fixtureRoot);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('test 文件    : 0');
      expect(result.stdout).toContain('[vitest-files]');
    });
  });

  it('CLI 拒绝 failed 或 success=false 的 coverage JSON，而不是只提取总用例数', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 895, { numPassedTests: 874, numFailedTests: 1, success: false });
      const result = runDocsConsistencyCli(fixtureRoot);
      expect(result.code).toBe(1);
      expect(result.stdout).toMatch(/\[vitest-(tests|results)\]/);
      expect(result.stdout).toMatch(/失败|不可采信|success/);
    });
  });

  it('真实 docs-consistency 探针报告候选 status/ERROR_JSON 证据及 export 三场景隔离', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      await writeVitestCount(fixtureRoot, 895);
      const result = runDocsConsistencyCli(fixtureRoot, {}, ['--json']);
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout) as {
        dynamicMeasurements: {
          exit2ScriptCount: number;
          exit2ProbeResults?: Array<{
            script: string;
            status: number;
            errorExitCode: number;
            outputExistsAfter?: boolean;
            emittedEvidenceExport?: boolean;
          }>;
        };
      };
      expect(report.dynamicMeasurements.exit2ScriptCount).toBe(34);
      expect(report.dynamicMeasurements.exit2ProbeResults).toHaveLength(36);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.every((probe) => probe.status === 2 && probe.errorExitCode === 2),
      ).toBe(true);
      expect(
        report.dynamicMeasurements.exit2ProbeResults?.filter((probe) =>
          probe.script.startsWith('wm-export-evidence.ts#'),
        ),
      ).toHaveLength(3);
      expect(
        report.dynamicMeasurements.exit2ProbeResults
          ?.filter((probe) => probe.script.startsWith('wm-export-evidence.ts#'))
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
    });
  });

  it('CLI 无 JSON 且 Vitest 不可用（显式清除外部 JSON 环境变量）→ vitest-tests 违规并 exit 1', async () => {
    await withDocsConsistencyFixture(async (fixtureRoot) => {
      const result = runDocsConsistencyCli(fixtureRoot, {
        ...process.env,
        WM_VITEST_COUNT_FILE: '',
        PATH: '',
        Path: '',
      });
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('vitest 用例  : 无法采集（不一致）');
      expect(result.stdout).toContain('[vitest-tests]');
    });
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

  it('README 含过期 vitest 计数（正确总数与旧数字并存）→ vitest-tests 违规', () => {
    const input = baseInput({
      readme: '**当前版本**：`41.11.0`\n40 files / 530 tests\n42 files / 663 tests',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('过期 vitest 计数');
    expect(v[0]!.message).toContain('42 files / 663 tests');
  });

  it('AGENTS 含过期 .test.ts 计数（文件数不符）→ vitest-tests 违规', () => {
    const input = baseInput({
      agents: '31 个脚本\n41 个 .test.ts / 530 条',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('41 个 .test.ts / 530 条'))).toBe(true);
  });

  it('CONTRIBUTING 含过期 vitest 计数（40 files / 623 tests）→ vitest-tests 违规', () => {
    const input = baseInput({
      vitestExtraDocs: [
        {
          name: 'CONTRIBUTING.md',
          content: '| 12 | vitest 全量（40 files / 623 tests） | 0 |',
        },
      ],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('CONTRIBUTING.md') && x.message.includes('40 files / 623 tests'))).toBe(
      true,
    );
  });

  it('CONTRIBUTING 计数与实测一致 → 零 vitest-tests 违规', () => {
    const input = baseInput({
      vitestExtraDocs: [
        {
          name: 'CONTRIBUTING.md',
          content: '单元测试全量（40 files / 530 tests）。\n（40 个 .test.ts / 530 条）',
        },
      ],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('INSTALL 含过期 vitest 计数（40 个 .test.ts / 623 条）→ vitest-tests 违规（P1-1 复核补充）', () => {
    const input = baseInput({
      vitestExtraDocs: [
        {
          name: 'docs/INSTALL.md',
          content: '# vitest 单元测试（40 个 .test.ts / 623 条）',
        },
      ],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(v.some((x) => x.message.includes('docs/INSTALL.md') && x.message.includes('40 个 .test.ts / 623 条'))).toBe(
      true,
    );
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
        content: '见 [SKILL.md](../SKILL.md) 与 [反模式](anti-patterns.md)；外部 [spec](https://example.com/x.md)。',
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
      skill: baseInput().skill.replace('（35 个 .ts）', '（34 个 .ts）'),
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'script-registry');
    expect(v.some((x) => x.message.includes('34') && x.message.includes('35'))).toBe(true);
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

async function withDocsConsistencyFixture(assertResult: (fixtureRoot: string) => Promise<void>): Promise<void> {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-docs-consistency-cli-'));
  try {
    cpSync(REPO_ROOT, fixtureRoot, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(REPO_ROOT, source);
        return !['node_modules', '.git', '.w-model', '.codegraph'].some(
          (excluded) => relative === excluded || relative.startsWith(`${excluded}${path.sep}`),
        );
      },
    });
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture dependency junction has a repository-controlled source and mkdtemp-owned destination
    await fs.symlink(path.join(REPO_ROOT, 'node_modules'), path.join(fixtureRoot, 'node_modules'), 'junction');
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
): { code: number | null; stdout: string; stderr: string } {
  const countFile = path.join(fixtureRoot, 'vitest-results.json');
  const provenanceFile = path.join(fixtureRoot, 'vitest-results.provenance.json');
  // Keep this real CLI probe aligned with the centralized synchronous-process audit.
  // The helper intentionally exercises the repository CLI in a child process.
  // Its timeout follow-up remains tracked by the existing exception manifest.
  // Do not replace this with a mocked call: the fixture test covers the CLI boundary.
  const result = spawnSync(process.execPath, [tsxCli, DOCS_CONSISTENCY_CLI, fixtureRoot, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 90_000,
    env: {
      ...process.env,
      WM_VITEST_COUNT_FILE: countFile,
      WM_VITEST_PROVENANCE_FILE: provenanceFile,
      WM_VITEST_PROVENANCE_ROOT: fixtureRoot,
      ...envOverrides,
    },
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
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
    testResults: Array.from({ length: 54 }) as unknown[],
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
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test tool is created inside the mkdtemp-owned tool root
    await fs.writeFile(
      path.join(toolRoot, 'npm'),
      `#!/usr/bin/env bash
case "$*" in
  *"check:docs-consistency"*)
    test -f "$WM_VITEST_COUNT_FILE" && test -f "$WM_VITEST_PROVENANCE_FILE"
    printf '%s|%s|%s\\n' "$WM_VITEST_COUNT_FILE" "$WM_VITEST_PROVENANCE_FILE" "$WM_VITEST_PROVENANCE_ROOT" > "$WM_PREPUSH_CAPTURE"
    ;;
  *"bad-ranking-k.json"*) exit 1 ;;
  *"check:verifier"*) [[ "$*" == *"valid.json"* ]] || exit 2 ;;
  *"check:gate"*) exit 2 ;;
esac
exit 0
`,
      { encoding: 'utf8', mode: 0o755 },
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test tool is created inside the mkdtemp-owned tool root
    await fs.writeFile(
      path.join(toolRoot, 'npx'),
      `#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in --outputFile=*) output="\${arg#--outputFile=}" ;; esac
done
if [[ "$*" == *"bad-schema.manifest.json"* ]]; then exit 2; fi
if [ -n "\${output:-}" ]; then
  mkdir -p "$(dirname "$output")"
  printf '%s' '{"testResults":[],"numTotalTests":0,"numPassedTests":0,"numFailedTests":0,"success":true}' > "$output"
fi
exit 0
`,
      { encoding: 'utf8', mode: 0o755 },
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test tool is created inside the mkdtemp-owned tool root
    await fs.writeFile(
      path.join(toolRoot, 'mktemp'),
      `#!/usr/bin/env bash
if [ "\${1:-}" = "-d" ]; then
  mkdir -p "$WM_PREPUSH_ARTIFACT_DIR"
  printf '%s\\n' "$WM_PREPUSH_ARTIFACT_DIR"
else
  /usr/bin/mktemp "$@"
fi
`,
      { encoding: 'utf8', mode: 0o755 },
    );

    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile(
        'bash',
        ['.githooks/pre-push', '--force'],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            PATH: `${toolRoot}${path.delimiter}${process.env.PATH ?? ''}`,
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
    expect(report.dynamicViolations.some((x) => x.check === 'vitest-files')).toBe(true);
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
});

async function assertSsotExternalBoundaryFile(): Promise<void> {
  const ssotPath = path.join(REPO_ROOT, 'docs', 'skill-design-document_SSoT.md');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled SSoT path
  const content = await fs.readFile(ssotPath, 'utf-8');
  expect(content).not.toContain('subgraph AI引擎层');
  expect(content).not.toContain('核心AI引擎');
  expect(content).toContain('宿主 Agent / 外部 LLM');
  expect(content).toContain('W-Model Skill 技能包');
  expect(content).toContain('可选外部工具');
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
