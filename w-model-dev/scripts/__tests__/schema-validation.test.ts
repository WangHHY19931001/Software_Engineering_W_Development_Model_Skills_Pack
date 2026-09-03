/**
 * schema-validation.test.ts —— JSON Schema 前置校验单元测试
 *
 * 借鉴 drawio-skill/styles/schema.json 设计实践：
 *   - additionalProperties:false 防字段漂移
 *   - required 防字段缺失
 *   - type 防类型错误
 *   - format:date-time 防时间格式错误
 *
 * 覆盖：
 *   1. validateBySchema 直接调用：合法数据通过 / 非法数据拒绝
 *   2. checkVerifierOutput 集成：schema 前置校验在业务逻辑之前拦截结构错误
 *   3. 3 个 schema 拒绝样本（additionalProperties / required / type）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import { checkVerifierOutput } from '../logic/verifier-logic.js';
import { readSchemasDir } from '../infrastructure/schema-fs.js';
import { resolveStateSchema } from '../lib/state-schema-registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const samplesDir = path.join(here, '..', 'samples');
const schemaSamplesDir = path.join(samplesDir, 'schema');
const verifierSamplesDir = path.join(samplesDir, 'verifier');

async function loadJson(dir: string, file: string): Promise<unknown> {
  const raw = await fs.readFile(path.join(dir, file), 'utf-8');
  return JSON.parse(raw);
}

describe('schema-loader TypeDoc public API', () => {
  it('includes infrastructure as a TypeDoc entry path and exposes validateBySchema with SchemaValidationResult', () => {
    const packageJson = nodeRequire('../../../package.json') as { scripts: { 'docs:build': string } };
    expect(packageJson.scripts['docs:build']).toContain('w-model-dev/scripts/infrastructure');
  });
});

describe('JSON Schema 前置校验（validateBySchema）', () => {
  it('合法 VerifierOutput 通过 schema 校验', async () => {
    const data = await loadJson(verifierSamplesDir, 'valid.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
    expect(result.errorMessages).toEqual([]);
  });

  it('additionalProperties:false 拒绝未知字段', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-additional-props.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some((m) => /additionalProperties/.test(m))).toBe(true);
  });

  it('required 拒绝缺失必填字段', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-missing-required.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some((m) => /required/.test(m))).toBe(true);
  });

  it('type 拒绝错误数据类型', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-wrong-type.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some((m) => /type/.test(m))).toBe(true);
  });

  it('fix 和 emergency-fix 缺少 basedOnReport 或空 artifacts 时被 action-specific schema 拒绝', () => {
    const base = {
      runId: 'fix-schema',
      timestamp: '2026-08-24T00:00:00.000Z',
      phase: 8,
      phaseName: '验收测试',
      role: 'S',
      duration_s: 1,
      tokens: 1,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
    };
    for (const action of ['fix', 'emergency-fix']) {
      expect(validateBySchema('run-log', { ...base, action, artifacts: ['src/app.ts'] }).valid).toBe(false);
      expect(validateBySchema('run-log', { ...base, action, basedOnReport: 'RC-1', artifacts: [] }).valid).toBe(false);
    }
  });

  it('phase-8 implementation review/gate/R3 缺 identity required 字段时被拒绝', () => {
    const base = {
      runId: 'implementation-schema',
      timestamp: '2026-08-24T00:00:00.000Z',
      phase: 8,
      phaseName: '验收测试',
      duration_s: 1,
      tokens: 1,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      reportId: 'RC-1',
      round: 1,
      targetKind: 'code',
      basedOnReport: 'RC-1',
      target: 'src/app.ts',
      implementationTarget: 'src/app.ts',
      artifacts: ['src/app.ts'],
    };
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'review',
        role: 'V',
        passed: true,
        qualityLevel: 'A',
        reworkHints: [],
      }).valid,
    ).toBe(true);
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'review',
        role: 'V',
        passed: true,
        qualityLevel: 'A',
        reworkHints: [],
        implementationTarget: undefined,
        reportId: undefined,
        basedOnReport: undefined,
      }).valid,
    ).toBe(false);
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'gate',
        role: 'G',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }).valid,
    ).toBe(true);
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'gate',
        role: 'G',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
        target: undefined,
      }).valid,
    ).toBe(false);
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'r3-completeness',
        role: 'R',
      }).valid,
    ).toBe(true);
    expect(
      validateBySchema('run-log', {
        ...base,
        action: 'r3-completeness',
        role: 'R',
        artifacts: undefined,
      }).valid,
    ).toBe(false);
  });

  it('phase-8 targetKind=other is rejected and canonical implementation identity is action-complete', () => {
    const base = {
      runId: 'phase8-contract',
      timestamp: '2026-08-24T00:00:00.000Z',
      phase: 8,
      phaseName: '验收测试',
      duration_s: 1,
      tokens: 1,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      round: 1,
      reportId: 'RC-1',
      targetKind: 'code',
      basedOnReport: 'RC-1',
      implementationTarget: 'src/app.ts',
      target: 'src/app.ts',
      artifacts: ['src/app.ts'],
    };
    expect(validateBySchema('run-log', { ...base, action: 'review', role: 'V', targetKind: 'other' }).valid).toBe(
      false,
    );
    for (const action of [
      'review',
      'gate',
      'r3-completeness',
      'r3-reliability',
      'r3-security',
      'fix',
      'emergency-fix',
    ]) {
      const candidate = {
        ...base,
        action,
        role: action === 'gate' ? 'G' : action.startsWith('r3-') ? 'R' : action === 'review' ? 'V' : 'S',
      };
      expect(validateBySchema('run-log', { ...candidate, implementationTarget: undefined }).valid).toBe(false);
      expect(validateBySchema('run-log', { ...candidate, target: undefined }).valid).toBe(false);
      expect(validateBySchema('run-log', { ...candidate, artifacts: undefined }).valid).toBe(false);
    }
  });

  it('rootcause action requires its complete action-specific fields', () => {
    const rootcause = {
      runId: 'rootcause-contract',
      timestamp: '2026-08-24T00:00:00.000Z',
      phase: 5,
      phaseName: '编码',
      action: 'rootcause',
      role: 'R',
      duration_s: 1,
      tokens: 1,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      reportId: 'RC-1',
      rootCauseCategory: 'coding-error',
      upstreamDefect: false,
      rollbackRecommended: false,
    };
    expect(validateBySchema('run-log', rootcause).valid).toBe(true);
    for (const field of ['reportId', 'rootCauseCategory', 'upstreamDefect', 'rollbackRecommended']) {
      expect(validateBySchema('run-log', { ...rootcause, [field]: undefined }).valid).toBe(false);
    }
  });

  it('未注册的 schema 返回明确错误，gate-log 使用独立 schema 拒绝无效结构', () => {
    const result = validateBySchema('nonexistent-schema', {});
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some((m) => /schema 未注册/.test(m))).toBe(true);

    const validGateLog = {
      script: 'check-bdd-model.ts',
      exitCode: 0,
      passed: true,
      reasons: [],
      reportSummary: {
        phase: 1,
        checkedAt: '2026-08-19T00:00:00.000Z',
        summary: 'BDD model check passed (phase 1)',
        violationsCount: 0,
        exitCode: 0,
        passed: true,
      },
      stdoutSummary: { exitCode: 0, passed: true },
    };
    expect(validateBySchema('gate-log', validGateLog).valid).toBe(true);
    expect(validateBySchema('gate-log', { ...validGateLog, script: '' }).valid).toBe(false);
    expect(validateBySchema('gate-log', { ...validGateLog, exitCode: 3 }).valid).toBe(false);
    expect(validateBySchema('gate-log', { ...validGateLog, extra: true }).valid).toBe(false);
    expect(
      validateBySchema('gate-log', {
        ...validGateLog,
        reportSummary: {
          reportId: 'IS-phase3-1-01',
          triggerType: 'ICEBERG-A',
          icebergRound: 1,
          newFindingsCount: 0,
          passed: true,
        },
      }).valid,
    ).toBe(false);
    expect(validateBySchema('gate-log', { ...validGateLog, script: 'test-gate-log-writer' }).valid).toBe(false);
  });
});

describe('state schema registry fixture-only schemas', () => {
  it('does not expose fixture-only checkpoint, event-ingress, or hill-climbing schemas as runtime write targets', () => {
    const projectRoot = path.resolve('C:', 'workspace', 'example-project');
    for (const name of ['checkpoint-log', 'event-ingress', 'hill-climbing-report']) {
      expect(resolveStateSchema(path.join(projectRoot, '.w-model', `${name}.json`), projectRoot, 'win32')).toBeNull();
    }
  });
});

describe('checkVerifierOutput 集成：schema 前置校验', () => {
  it('additionalProperties 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-additional-props.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /additionalProperties/.test(r))).toBe(true);
  });

  it('required 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-missing-required.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /required/.test(r))).toBe(true);
  });

  it('type 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-wrong-type.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /type/.test(r))).toBe(true);
  });

  it('schema 校验通过后业务逻辑仍能捕获数值错误', async () => {
    // bad-composite-score.json: schema 通过（结构合法），但 compositeScore 与 Σ 不一致
    const data = await loadJson(verifierSamplesDir, 'bad-composite-score.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    // 不应有 [schema] 前缀（说明 schema 通过，业务逻辑拦截）
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(false);
    // 应有业务逻辑的 compositeScore 不一致错误
    expect(result.reasons.some((r) => /compositeScore.*Σ\(score\*weight\)/.test(r))).toBe(true);
  });
});

describe('tla-manifest sdCoverage (phase>=2)', () => {
  it('phase>=2 时 sdCoverage 缺失应校验失败', () => {
    const manifest = {
      version: 1,
      project: 'test',
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['REQ-001'],
          designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 100,
          decompositionDecision: 'kept-below-threshold',
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/sdCoverage/);
  });

  it('phase>=2 时 sdCoverage.uncoveredSdNodes 非空应通过 schema（由业务层 checkTlaModel 校验）', () => {
    const manifest = {
      version: 1,
      project: 'test',
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [
        {
          id: 'L1_Test',
          level: 'L1',
          phase: 1,
          system: 'test',
          requirementIds: ['REQ-001'],
          designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
          tlaPath: 'L1_Test.tla',
          cfgPath: 'L1_Test.cfg',
          parent: null,
          siblings: [],
          children: [],
          variableCombination: 100,
          decompositionDecision: 'kept-below-threshold',
          syntaxChecked: true,
          tlcChecked: true,
          deadlockFree: true,
          invariantsHold: true,
          stateExplosion: false,
        },
      ],
      sdCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: ['SD-003'],
        coverageRate: 0.667,
      },
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(true);
  });
});

describe('bdd-manifest designCoverage (phase>=2)', () => {
  it('phase>=2 时 designCoverage 缺失应校验失败', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 2,
      features: [
        {
          id: 'L1_test-001',
          level: 1,
          filePath: 'L1/L1_test-001.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1_test',
          reqIds: ['REQ-001'],
          designIds: ['SD-001'],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['S1', 'S2'],
          initialState: 'S1',
          terminalStates: [],
          acceptingStates: ['S2'],
          rejectingStates: [],
          transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
          invariants: ['S2 => true'],
        },
      ],
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/designCoverage/);
  });

  it('phase>=2 时 designCoverage.uncoveredSdNodes 非空应通过 schema（非空由业务层 D8 校验）', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 2,
      features: [
        {
          id: 'L1_test-001',
          level: 1,
          filePath: 'L1/L1_test-001.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1_test',
          reqIds: ['REQ-001'],
          designIds: ['SD-001'],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['S1', 'S2'],
          initialState: 'S1',
          terminalStates: [],
          acceptingStates: ['S2'],
          rejectingStates: [],
          transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
          invariants: ['S2 => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(true);
  });
});

describe('P5 schema-loader 分层修复（去 IO / 去 exit）', () => {
  it('schema-loader 不再直接依赖 node:fs / process.exit（审计修复 P5）', async () => {
    const src = await fs.readFile(path.resolve(here, '../infrastructure/schema-loader.ts'), 'utf-8');
    expect(src).not.toMatch(/from 'node:fs'/);
    expect(src).not.toMatch(/process\.exit/);
    expect(src).not.toMatch(/ERROR_JSON/); // 手拼 ERROR_JSON 绕过 cli-error 的行为已移除
  });

  it('infrastructure/schema-fs.ts 能读取 schemas 目录并返回 basename→schema 映射', async () => {
    const dir = path.resolve(here, '../../schemas');
    const map = await readSchemasDir(dir);
    // 25 = 23 原清单 + change-scope + codegraph-query（2026-09-04 audit-gate-closure task 1）
    expect(Object.keys(map).length).toBe(25);
    expect(map['rtm.schema.json']).toBeDefined();
    expect(map['change-scope.schema.json']).toBeDefined();
    expect(map['codegraph-query.schema.json']).toBeDefined();
  });
});

/**
 * 审计修复（audit-gate-closure task 3）：run-log fix variant/blocker conditional
 * + preventive-review passed=false 时 findings 须 ≥1。
 */
describe('run-log schema fix/emergency-fix variant conditional', () => {
  const fixBase = {
    runId: 'variant-contract',
    timestamp: '2026-09-03T00:00:00.000Z',
    phase: 5,
    phaseName: '编码',
    role: 'S',
    duration_s: 1,
    tokens: 1,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    basedOnReport: 'RC-1',
    artifacts: ['src/app.ts'],
  };

  it('action=fix 无 variant → valid（向后兼容旧样本）', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'fix' }).valid).toBe(true);
  });

  it('action=fix + variant=fix → valid', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'fix', variant: 'fix' }).valid).toBe(true);
  });

  it('action=fix + variant=emergency-fix → invalid（variant 与 action 不符）', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'fix', variant: 'emergency-fix' }).valid).toBe(false);
  });

  it('action=emergency-fix 无 variant → invalid（schema 强制 variant+blocker）', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'emergency-fix' }).valid).toBe(false);
  });

  it('action=emergency-fix + variant=emergency-fix + blocker → valid', () => {
    expect(
      validateBySchema('run-log', {
        ...fixBase,
        action: 'emergency-fix',
        variant: 'emergency-fix',
        blocker: '构建失败阻塞推进',
        fixedLocation: 'w-model-dev/scripts/cli/check-run-log.ts',
        fixBasedOn: 'S-self-assessment',
      }).valid,
    ).toBe(true);
  });

  it('action=emergency-fix + variant=emergency-fix 但缺 blocker → invalid', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'emergency-fix', variant: 'emergency-fix' }).valid).toBe(
      false,
    );
  });

  it('action=emergency-fix + variant=fix → invalid（const 不符）', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'emergency-fix', variant: 'fix' }).valid).toBe(false);
  });

  it('variant 非法枚举值 → invalid', () => {
    expect(validateBySchema('run-log', { ...fixBase, action: 'fix', variant: 'hotfix' }).valid).toBe(false);
  });
});

describe('preventive-review schema passed=false 与 findings 约束', () => {
  const reviewBase = {
    reviewedAt: '2026-09-03T00:00:00.000Z',
    reviewer: 'R3-completeness-bot',
    phase: 5,
    dimension: 'completeness',
  };

  it('passed=false + findings=[] → invalid', () => {
    expect(validateBySchema('preventive-review', { ...reviewBase, passed: false, findings: [] }).valid).toBe(false);
  });

  it('passed=true + findings=[] → valid（无问题可空发现通过）', () => {
    expect(validateBySchema('preventive-review', { ...reviewBase, passed: true, findings: [] }).valid).toBe(true);
  });

  it('passed=false + findings 含一条有效发现 → valid', () => {
    expect(
      validateBySchema('preventive-review', {
        ...reviewBase,
        passed: false,
        findings: [
          {
            severity: 'Required',
            description: '缺字段',
            evidence: 'requirement-spec.md §3',
          },
        ],
      }).valid,
    ).toBe(true);
  });
});
