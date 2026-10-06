/**
 * verifier-logic.test.ts —— evidence 格式校验 + R13 单轴下限单元测试
 *
 * 覆盖 verifier-logic.ts 中 validateEvidenceFormat 函数：
 *   - 合法 evidence（冒号格式）通过
 *   - 不合规 evidence 判 valid=false，且 vagueItems 记录全部不合规条目（历史语义）
 *   - 失败分两路可归因（D-10①）：EVIDENCE_PATTERN 不匹配 → 格式不符（formatMismatchItems）；
 *     匹配后命中 VAGUE_EVIDENCE_PATTERNS → 空泛声明（O3）
 *
 * 覆盖 checkR13SingleAxisFloor 函数（单轴下限，反模式 #41）：
 *   - 全部子标准 ≥ 0.70 → 无违规
 *   - 任一子标准 < 0.70 → 违规列表含该子标准名
 *
 * CLI 层用例（Persona Verifier CLI regressions / V 负样本）为进程内模式：
 * 经 helpers/cli-invoker.ts 调用导出的 main(argv)（runMain 的 VITEST 守卫阻止 import 自执行）；
 * 真实子进程保真由 cli-subprocess-smoke.test.ts 承载。
 *
 * 批次3 任务8：structuredViolations 双轨（rule/subject/fixHints，与 reasons 同源 1:1）+
 * CLI --json verifiedArtifacts（被验 JSON 文件字节清单，键恒在场）。
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  validateEvidenceFormat,
  checkR12EvidenceSpecificity,
  checkR13SingleAxisFloor,
  checkR18ResolutionFloor,
  checkVerifierOutput,
  ajvErrorSubject,
  parseEvidencePath,
  validateReviewedArtifacts,
  RESOLUTION_FLOOR,
} from '../logic/verifier-logic.js';

import { invokeCli } from './helpers/cli-invoker.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TEST_DIR, '../../..');
const PERSONA_FIXTURES = [
  'persona-code-reviewer.json',
  'persona-test-engineer.json',
  'persona-security-auditor.json',
  'persona-performance-auditor.json',
] as const;

/**
 * R19（A2，批次 6 任务 4）测试共用登记项：满足 schema 与 logic 形态的 reviewedArtifacts 条目。
 * 仅喂 logic 纯函数（不触盘），故 path 无须真实存在；行号越界 / 哈希复核由 CLI 层
 * （lib/reviewed-artifacts.ts 读盘后经 VerifierDeps 注入）另行覆盖。
 */
const R19_REVIEWED = [{ path: 'requirements.md', sha256: 'a'.repeat(64) }];

/** 进程内调用 check-verifier-output CLI（模块路径相对 helpers/cli-invoker.ts 解析） */
async function runVerifierCli(
  fixturePath: string,
  options: { json?: boolean } = { json: true },
): Promise<{ code: number | undefined; stdout: string; stderr: string }> {
  const argv: string[] = [];
  if (options.json) argv.push('--json');
  argv.push(fixturePath);
  const r = await invokeCli('../../cli/check-verifier-output.js', argv);
  return { code: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

/** 跑 samples/verifier 下样本的 CLI（人类可读模式，reasons 打在 stdout） */
async function runVerifier(
  sampleRelPath: string,
): Promise<{ exitCode: number | undefined; stdout: string; stderr: string }> {
  const result = await runVerifierCli(resolve(ROOT, sampleRelPath), {
    json: false,
  });
  return {
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('Persona Verifier fixtures', () => {
  it.each(PERSONA_FIXTURES)('%s 应满足当前 Schema 与 verifier logic', async (file) => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier', file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed PERSONA_FIXTURES allowlist
    const fixture = JSON.parse(await readFile(fixturePath, 'utf-8')) as unknown;

    const result = checkVerifierOutput(fixture);

    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

describe('Persona Verifier CLI regressions', () => {
  it.each(PERSONA_FIXTURES)('%s 应通过 --json CLI 协议', async (file) => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier', file);
    const result = await runVerifierCli(fixturePath);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: 'verifier-output',
      passed: true,
      qualityLevel: 'A',
      reasons: [],
      exitCode: 0,
    });
  });

  it('显式阻断性 reworkHint 必须拒绝放行但保留分数映射等级（4 形态，每迭代自备 fixture）', async () => {
    for (const hint of [
      '[Critical] 演示阻断性安全缺陷',
      'Critical: 演示阻断性安全缺陷',
      '[Required] 演示必修缺陷',
      'Required: 演示必修缺陷',
    ]) {
      const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/persona-code-reviewer.json');
      const fixture = JSON.parse(await readFile(fixturePath, 'utf-8')) as Record<string, unknown>;
      fixture.reworkHints = [hint];
      fixture.passed = true;

      const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-cli-'));
      const negativeFixturePath = resolve(tempDir, 'persona-code-reviewer-blocking.json');
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
        await writeFile(negativeFixturePath, JSON.stringify(fixture), 'utf-8');
        const result = await runVerifierCli(negativeFixturePath);
        const report = JSON.parse(result.stdout) as Record<string, unknown>;

        expect(result.code, `hint=${hint}: 应退出 1`).toBe(1);
        expect(report, `hint=${hint}: 应拒但保留 qualityLevel A`).toMatchObject({
          type: 'verifier-output',
          passed: false,
          qualityLevel: 'A',
          exitCode: 1,
        });
        expect(report.reasons, `hint=${hint}: 应点名 reworkHints[1]`).toEqual(
          expect.arrayContaining([expect.stringContaining('reworkHints[1]')]),
        );
      } finally {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('Persona-specific Medium hint remains non-blocking for an otherwise passing A-level output', async () => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/persona-code-reviewer.json');
    const fixture = JSON.parse(await readFile(fixturePath, 'utf-8')) as Record<string, unknown>;
    fixture.reworkHints = ['[Medium] 仅供该 Persona 排期的改进建议'];
    fixture.passed = true;

    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-cli-'));
    const positiveFixturePath = resolve(tempDir, 'persona-code-reviewer-medium.json');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(positiveFixturePath, JSON.stringify(fixture), 'utf-8');
      const result = await runVerifierCli(positiveFixturePath);
      const report = JSON.parse(result.stdout) as Record<string, unknown>;

      expect(result.code).toBe(0);
      expect(report).toMatchObject({
        type: 'verifier-output',
        passed: true,
        qualityLevel: 'A',
        reasons: [],
        exitCode: 0,
      });
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('合法 A 分、无阻断 hint 的原始 passed=false 仍返回 exit 1', async () => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/persona-code-reviewer.json');
    const fixture = JSON.parse(await readFile(fixturePath, 'utf-8')) as Record<string, unknown>;
    delete fixture.reworkHints;
    fixture.passed = false;

    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-cli-'));
    const negativeFixturePath = resolve(tempDir, 'persona-code-reviewer-already-failed.json');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(negativeFixturePath, JSON.stringify(fixture), 'utf-8');
      const result = await runVerifierCli(negativeFixturePath);
      const report = JSON.parse(result.stdout) as Record<string, unknown>;

      expect(result.code).toBe(1);
      expect(report).toMatchObject({
        type: 'verifier-output',
        passed: false,
        qualityLevel: 'A',
        exitCode: 1,
      });
      expect(report.reasons).toEqual([expect.stringContaining('passed false 与 qualityLevel A 不一致')]);
      expect(report.reasons).not.toEqual(expect.arrayContaining([expect.stringContaining('reworkHints')]));
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('默认模式保持人类可读报告与 VERIFIER_JSON 摘要协议', async () => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/persona-code-reviewer.json');
    const result = await runVerifierCli(fixturePath, { json: false });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Verifier 输出校验');
    expect(result.stdout).toContain('VERIFIER_JSON ');
    expect(result.stdout).toContain('"qualityLevel":"A"');
  });

  it('--json 报告恒带 verifiedArtifacts（被验 JSON 文件字节清单，sha256/bytes 可复验）', async () => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/persona-code-reviewer.json');
    const result = await runVerifierCli(fixturePath);
    const report = JSON.parse(result.stdout) as {
      verifiedArtifacts?: Array<{
        path: string;
        sha256: string;
        bytes: number;
      }>;
    };

    expect(result.code).toBe(0);
    expect(Array.isArray(report.verifiedArtifacts), 'verifiedArtifacts 键恒在场').toBe(true);
    expect(report.verifiedArtifacts).toHaveLength(1);
    const artifact = report.verifiedArtifacts![0]!;
    expect(artifact.path).toContain('persona-code-reviewer.json');
    expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.bytes).toBeGreaterThan(0);
  });

  it('--json 校验失败报告同样恒带 verifiedArtifacts（读不到不入表，读得到必登记）', async () => {
    const fixturePath = resolve(ROOT, 'w-model-dev/scripts/samples/verifier/bad-variance-drift.json');
    const result = await runVerifierCli(fixturePath);
    const report = JSON.parse(result.stdout) as {
      verifiedArtifacts?: unknown[];
      passed?: boolean;
    };

    expect(result.code).toBe(1);
    expect(report.passed).toBe(false);
    expect(Array.isArray(report.verifiedArtifacts)).toBe(true);
    expect(report.verifiedArtifacts).toHaveLength(1);
  });

  it('缺失输入文件通过 --json 输出 ERROR_JSON 并退出 2', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-cli-'));
    const missingFixturePath = resolve(tempDir, 'missing.json');
    try {
      const result = await runVerifierCli(missingFixturePath);

      expect(result.code).toBe(2);
      expect(result.stdout).toMatch(/^ERROR_JSON /);
      expect(JSON.parse(result.stdout.replace(/^ERROR_JSON /, ''))).toMatchObject({
        category: 'FILE_NOT_FOUND',
        exitCode: 2,
      });
      expect(result.stderr).toContain('[FILE_NOT_FOUND]');
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('malformed 输入文件通过 --json 输出 ERROR_JSON 并退出 2', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-cli-'));
    const malformedFixturePath = resolve(tempDir, 'malformed.json');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(malformedFixturePath, '{malformed', 'utf-8');
      const result = await runVerifierCli(malformedFixturePath);

      expect(result.code).toBe(2);
      expect(result.stdout).toMatch(/^ERROR_JSON /);
      expect(JSON.parse(result.stdout.replace(/^ERROR_JSON /, ''))).toMatchObject({
        category: 'FILE_PARSE',
        exitCode: 2,
      });
      expect(result.stderr).toContain('[FILE_PARSE]');
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  // 试点期的保真对照用例已删除：对照职责由 cli-subprocess-smoke.test.ts 的
  // 「check-verifier-output 真实子进程冒烟」条目承载（Wave 2 推广，Task 9）。
});

describe('evidence 格式校验', () => {
  it('合法 evidence（冒号格式）应通过', () => {
    const evidence = [
      'docs/phase1-requirements/requirement-spec.md:§1.1=需求完整覆盖用户故事',
      'src/article.service.ts:L42=认证模块 JWT 校验逻辑',
    ];
    const result = validateEvidenceFormat(evidence);
    expect(result.valid).toBe(true);
    expect(result.vagueItems).toEqual([]);
  });

  it('空泛声明应判定 invalid 并记入 vagueItems（3 态）', () => {
    for (const declaration of ['C1-C10 全通过', '质量良好', '评审通过']) {
      const result = validateEvidenceFormat([declaration]);
      expect(result.valid, `声明「${declaration}」: 应判 invalid`).toBe(false);
      expect(result.vagueItems, `声明「${declaration}」: 应记入 vagueItems`).toContain(declaration);
    }
  });
});

describe('V 产物形态负样本（D-10：等差改进指引 / 双 L 文案区分 / 分辨力下限）', () => {
  it('正则不匹配（含双 L 区间）→ 全部记入 formatMismatchItems（格式不符路）', () => {
    const evidence = ['质量良好', 'docs/x.md:L51-L53=双 L 区间'];
    const result = validateEvidenceFormat(evidence);
    expect(result.valid).toBe(false);
    expect(result.formatMismatchItems).toEqual(evidence);
    // 向后兼容：vagueItems 仍是「全部不合规条目」的并集
    expect(result.vagueItems).toEqual(evidence);
  });

  it('完美等差数列 rawScores → 失败且文案含改进指引', async () => {
    const r = await runVerifier('w-model-dev/scripts/samples/verifier/bad-arithmetic-sequence.json');
    expect(r.exitCode).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/真实离散/);
  });

  it('双 L evidence 形态 → 文案点明格式不符（非空泛声明）', async () => {
    const r = await runVerifier('w-model-dev/scripts/samples/verifier/bad-evidence-double-l.json');
    expect(r.exitCode).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/格式不符|须 path:Lnn=stmt/);
    expect(r.stdout + r.stderr).not.toMatch(/空泛声明/);
  });

  it('非全等但分布坍缩 → 失败且文案点明分辨力下限', async () => {
    const r = await runVerifier('w-model-dev/scripts/samples/verifier/bad-resolution-floor.json');
    expect(r.exitCode).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/分布坍缩/);
  });
});

describe('R13 单轴下限（反模式 #41）', () => {
  it('R13 阈值矩阵（3 态：全过 / 命中含子标准名 / 边界 0.70 含等号不命中）', () => {
    const passing = [
      { name: 'completeness', score: 0.9 },
      { name: 'clarity', score: 0.85 },
      { name: 'consistency', score: 0.7 },
      { name: 'testability', score: 0.8 },
      { name: 'traceability', score: 0.95 },
    ];
    const hit = [
      { name: 'completeness', score: 0.65 },
      { name: 'clarity', score: 0.95 },
      { name: 'consistency', score: 0.95 },
      { name: 'testability', score: 0.95 },
      { name: 'traceability', score: 0.95 },
    ];
    const boundary = [
      { name: 'completeness', score: 0.7 },
      { name: 'clarity', score: 0.7 },
      { name: 'consistency', score: 0.7 },
      { name: 'testability', score: 0.7 },
      { name: 'traceability', score: 0.7 },
    ];
    for (const [场景, subCriteria] of [
      ['全部子标准 ≥ 0.70', passing],
      ['边界值 0.70 本身（B 级分界含等号）', boundary],
    ] as const) {
      expect(checkR13SingleAxisFloor(subCriteria), `${场景}: 应无违规`).toEqual([]);
    }
    const violations = checkR13SingleAxisFloor(hit);
    expect(violations, '任一子标准 < 0.70: 应命中 1 条违规').toHaveLength(1);
    expect(violations[0], '任一子标准 < 0.70: 违规应含子标准名').toContain('completeness');
    expect(violations[0], '任一子标准 < 0.70: 违规应含实际分').toContain('0.65');
    expect(violations[0], '任一子标准 < 0.70: 违规应含下限').toContain('0.7');
  });

  it('非数组输入应返回空违规列表', () => {
    expect(checkR13SingleAxisFloor(undefined as unknown as unknown[])).toEqual([]);
    expect(checkR13SingleAxisFloor('not-array' as unknown as unknown[])).toEqual([]);
  });
});

describe('evidence 扣分后 passed 重算', () => {
  it('evidence 空泛导致 compositeScore 降级、qualityLevel 重新判定、passed 自洽', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
      subCriteria: [
        {
          name: 'completeness',
          weight: 0.3,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: '质量良好',
        },
        {
          name: 'clarity',
          weight: 0.25,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: '评审通过',
        },
        {
          name: 'consistency',
          weight: 0.2,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'testability',
          weight: 0.15,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.4=REQ-001 需求覆盖',
        },
        {
          name: 'traceability',
          weight: 0.1,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'rtm.json:§REQ-001=coverage full',
        },
      ],
      compositeScore: 0.72,
      qualityLevel: 'B',
      reviewedArtifacts: R19_REVIEWED,
      summary: 'REQ-001 需求覆盖基本完整，采用 RBAC 权限模型，可测试，遗留风险：无，待运行时验证确认。',
      passed: true,
    };
    const result = checkVerifierOutput(output);
    // evidence 扣分: 0.72 - 0.1 = 0.62 → qualityLevel 'C' → passed=false
    expect(result.compositeScore).toBeLessThan(0.72);
    expect(result.qualityLevel).toBe('C');
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('evidence 格式不符'))).toBe(true);
  });

  it('evidence 合法时不扣分，passed 基于原始 compositeScore 判定', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
      subCriteria: [
        {
          name: 'completeness',
          weight: 0.3,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'clarity',
          weight: 0.25,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'consistency',
          weight: 0.2,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
        },
        {
          name: 'testability',
          weight: 0.15,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'requirements.md:§3.4=REQ-001 需求覆盖',
        },
        {
          name: 'traceability',
          weight: 0.1,
          score: 0.72,
          rawScores: [0.71, 0.72, 0.73],
          variance: 0.0000667,
          evidence: 'rtm.json:§REQ-001=coverage full',
        },
      ],
      compositeScore: 0.72,
      qualityLevel: 'B',
      reviewedArtifacts: R19_REVIEWED,
      summary: 'REQ-001 需求覆盖基本完整，采用 RBAC 权限模型，可测试，遗留风险：无，待运行时验证确认。',
      passed: true,
    };
    const result = checkVerifierOutput(output);
    // 无 evidence 扣分，passed 保持 true（B 级 + 全部 ≥ 0.70）
    expect(result.passed).toBe(true);
    expect(result.qualityLevel).toBe('B');
    expect(result.compositeScore).toBe(0.72);
  });
});

describe('EVIDENCE_PATTERN 冒号格式', () => {
  it('应接受冒号格式（2 态：path:§section / path:L42-58）', () => {
    for (const evidence of [
      'docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全',
      'src/auth.ts:L42-58=JWT 签发逻辑',
    ]) {
      expect(validateEvidenceFormat([evidence]).valid, `${evidence}: 应接受`).toBe(true);
    }
  });

  it('应拒绝点号格式（1 态：path.field=value）', () => {
    const result = validateEvidenceFormat(['coverage.json.matrices.stakeholder.coverage=100%']);
    expect(result.valid).toBe(false);
  });
});

describe('targetKind=rootcause（§7.5 V 复审根因报告）', () => {
  const baseRootcause = {
    schemaVersion: '1.0',
    meta: {
      targetKind: 'rootcause' as const,
      target: 'RC-phase5-1-01',
      reviewedAt: '2026-08-12T00:00:00Z',
      agent: 'test-agent',
      scoringMethod: 'logits' as const,
      repeatTimes: 3,
      varianceThreshold: 0.1,
    },
    subCriteria: [
      {
        name: 'correctness',
        weight: 0.25,
        score: 0.9,
        rawScores: [0.89, 0.9, 0.91],
        variance: 0.0000667,
        evidence: 'rootcause.json:§4.2=rootCauseChain[0].evidence 支持该步 answer',
      },
      {
        name: 'completeness',
        weight: 0.25,
        score: 0.85,
        rawScores: [0.84, 0.85, 0.86],
        variance: 0.0000667,
        evidence: 'rootcause.json:§4.3=rootCauseChain 共 3 步触及根本原因',
      },
      {
        name: 'falsifiability',
        weight: 0.2,
        score: 0.88,
        rawScores: [0.87, 0.88, 0.89],
        variance: 0.0000667,
        evidence: 'rootcause.json:§4.4=falsifiabilityCheck 含可验证假设',
      },
      {
        name: 'actionability',
        weight: 0.15,
        score: 0.8,
        rawScores: [0.79, 0.8, 0.81],
        variance: 0.0000667,
        evidence: 'rootcause.json:§5.1=fixRecommendation[0] 四字段',
      },
      {
        name: 'prevention',
        weight: 0.15,
        score: 0.95,
        rawScores: [0.94, 0.95, 0.96],
        variance: 0.0000667,
        evidence: 'rootcause.json:§5.2=prevention[0] 三字段',
      },
    ],
    compositeScore: 0.876,
    qualityLevel: 'A' as const,
    reviewedArtifacts: R19_REVIEWED,
    summary: 'RC-phase5-1-01 根因链逻辑自洽，可证伪假设成立，修复建议与预防措施可执行，V 复审结论：通过。',
    passed: true,
  };

  it('合法 rootcause VerifierOutput（§7.5 子标准 + 权重）应通过', () => {
    const result = checkVerifierOutput(baseRootcause);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rootcause 负例（2 态：误用 test 集合子标准名 / 权重被改动）', () => {
    for (const [场景, build, 期望正则] of [
      [
        '误用 test 集合子标准名称',
        () => ({
          ...baseRootcause,
          subCriteria: baseRootcause.subCriteria.map((sc) => ({
            ...sc,
            name: sc.name === 'correctness' ? 'coverage' : sc.name,
          })),
        }),
        /subCriteria.*name 应为/,
      ],
      [
        '子标准权重被改动',
        () => ({
          ...baseRootcause,
          subCriteria: baseRootcause.subCriteria.map((sc, i) => (i === 0 ? { ...sc, weight: 0.3 } : sc)),
          compositeScore: 0.901,
        }),
        /weight 应为/,
      ],
    ] as const) {
      const result = checkVerifierOutput(build());
      expect(result.passed, `${场景}: 应拒绝`).toBe(false);
      expect(
        result.reasons.some((m: string) => 期望正则.test(m)),
        `${场景}: reasons 应含 ${期望正则}`,
      ).toBe(true);
    }
  });

  it('非法 targetKind 仍被枚举拦截（rootcause 之外的任意值）', () => {
    const bad = {
      ...baseRootcause,
      meta: { ...baseRootcause.meta, targetKind: 'report' },
    };
    const result = checkVerifierOutput(bad);
    expect(result.passed).toBe(false);
    // schema enum 前置拦截（[schema] 前缀）或逻辑层枚举校验均视为拦截成功
    expect(result.reasons.some((m: string) => /targetKind/.test(m))).toBe(true);
  });
});

describe('R18 分辨力下限（A-3d 校准偏移，D19）', () => {
  it('rawScores 非全等但方差坍缩（极近值）→ 命中，含子标准名与方差（1 态）', () => {
    const violations = checkR18ResolutionFloor([
      { name: 'completeness', rawScores: [0.9001, 0.9002, 0.9] },
      { name: 'clarity', rawScores: [0.2, 0.9, 0.5] },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('R18');
    expect(violations[0]).toContain('completeness');
    expect(violations[0]).toContain('分辨力');
  });

  it('R18 跳过行（5 态：全等不重复报 / 正常离散 / 样本不足 / 缺 rawScores / 非数组输入）', () => {
    for (const [场景, input] of [
      ['rawScores 完全相等（既有全等检测已覆盖，避免重复报）', [{ name: 'completeness', rawScores: [0.9, 0.9, 0.9] }]],
      [
        'rawScores 正常离散',
        [
          { name: 'completeness', rawScores: [0.1, 0.5, 0.9] },
          { name: 'clarity', rawScores: [0.2, 0.95, 0.4] },
        ],
      ],
      ['rawScores 少于 3 个数据点（样本不足）', [{ name: 'completeness', rawScores: [0.9001, 0.9002] }]],
      ['子标准缺 rawScores', [{ name: 'x' }, { name: 'y', rawScores: 'nope' }]],
    ] as const) {
      expect(checkR18ResolutionFloor([...input]), `${场景}: 应跳过`).toEqual([]);
    }
    expect(checkR18ResolutionFloor(undefined as unknown as unknown[]), '非数组输入: 应跳过而非抛错').toEqual([]);
  });

  it('RESOLUTION_FLOOR 为导出的可校准常量（端到端调测后可调整）', () => {
    expect(RESOLUTION_FLOOR).toBeGreaterThan(0);
  });
});

describe('R18 端到端接线（checkVerifierOutput.reasons 消费，非仅 helper）', () => {
  const varianceOf = (n: number[]): number => {
    const m = n.reduce((a, b) => a + b, 0) / n.length;
    return n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length;
  };
  // 坍缩维度：三次数值几乎相同（非全等）
  const collapsed = [0.9, 0.9001, 0.9002];
  // 其余维度：正常离散（方差低于 0.1 阈值，避免命中既有阈值规则）
  const spread = [0.88, 0.9, 0.92];
  const sub = (name: string, weight: number, raw: number[]) => ({
    name,
    weight,
    score: 0.9,
    rawScores: raw,
    variance: varianceOf(raw),
    evidence: `requirements.md:§3.2=REQ-001 ${name} 具体引用`,
  });

  it('合法 VerifierOutput 但某一子标准 rawScores 分布坍缩 → reasons 含 R18（证明接线生效）', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
      subCriteria: [
        sub('completeness', 0.3, collapsed),
        sub('clarity', 0.25, spread),
        sub('consistency', 0.2, spread),
        sub('testability', 0.15, spread),
        sub('traceability', 0.1, spread),
      ],
      compositeScore: 0.9,
      qualityLevel: 'A',
      passed: true,
      reviewedArtifacts: R19_REVIEWED,
      summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
      reworkHints: [],
    };
    const result = checkVerifierOutput(output);
    expect(result.reasons.some((r) => r.includes('R18'))).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('全部子标准正常离散 → reasons 不含 R18（假阳性防护）', () => {
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
      subCriteria: [
        sub('completeness', 0.3, spread),
        sub('clarity', 0.25, spread),
        sub('consistency', 0.2, spread),
        sub('testability', 0.15, spread),
        sub('traceability', 0.1, spread),
      ],
      compositeScore: 0.9,
      qualityLevel: 'A',
      passed: true,
      reviewedArtifacts: R19_REVIEWED,
      summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
      reworkHints: [],
    };
    const result = checkVerifierOutput(output);
    expect(result.reasons.some((r) => r.includes('R18'))).toBe(false);
    expect(result.passed).toBe(true);
  });
});

describe('批次3 双轨：structuredViolations（rule/subject/fixHints）', () => {
  // 照「R18 端到端接线」用例构造形态（varianceOf + 逐维度子标准）：completeness 的 rawScores
  // 分布可注入——正常离散（SPREAD）为零违规合法产物；超阈值分布恰命中单条 VERIFIER-VARIANCE。
  const varianceOf = (n: number[]): number => {
    const m = n.reduce((a, b) => a + b, 0) / n.length;
    return n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length;
  };
  const SPREAD = [0.88, 0.9, 0.92];
  const evidenceOf = (name: string): string => `requirements.md:§3.2=REQ-001 ${name} 具体引用`;
  const makeOutput = (completenessRaw: number[]) => ({
    schemaVersion: '1.0',
    meta: {
      targetKind: 'requirement',
      target: 'REQ-001',
      reviewedAt: '2026-07-31T00:00:00Z',
      agent: 'test-agent',
      scoringMethod: 'logits',
      repeatTimes: 3,
      varianceThreshold: 0.1,
    },
    subCriteria: (
      [
        ['completeness', 0.3, completenessRaw],
        ['clarity', 0.25, SPREAD],
        ['consistency', 0.2, SPREAD],
        ['testability', 0.15, SPREAD],
        ['traceability', 0.1, SPREAD],
      ] as const
    ).map(([name, weight, raw]) => ({
      name,
      weight,
      score: 0.9,
      rawScores: [...raw],
      // variance 字段与重算方差一致：隔离「超阈值」单因子，不触发谎报方差（防漂移规则 5）
      variance: varianceOf([...raw]),
      evidence: evidenceOf(name),
    })),
    compositeScore: 0.9,
    qualityLevel: 'A',
    passed: true,
    reviewedArtifacts: R19_REVIEWED,
    summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
    reworkHints: [],
  });
  // 负样本：completeness 重算方差 0.1473… > 阈值 0.1 → 恰命中「variance 超阈值」单条 VERIFIER-VARIANCE
  const makeBadVarianceOutput = () => makeOutput([0.03, 0.5, 0.97]);

  it('批次3 双轨：verifier 违规带 rule/subject/fixHints', () => {
    const r = checkVerifierOutput(makeBadVarianceOutput());
    const v = r.structuredViolations?.find((s) => s.rule === 'VERIFIER-VARIANCE');
    expect(v?.subject).toContain('subCriteria');
    // 简报原式 `v?.fixHints!.length` 与仓内 lint（no-non-null-asserted-optional-chain）冲突，
    // 断言语义等价改写：v 缺失或 fixHints 空均失败
    expect(v?.fixHints?.length ?? 0).toBeGreaterThan(0);
  });

  it('双轨同源：structuredViolations 与 reasons 一一对应，message=reasons 原文逐字保留（既有消费者兼容）', () => {
    const r = checkVerifierOutput(makeBadVarianceOutput());
    expect(r.passed).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.structuredViolations, '每条 reason 恰派生一条结构化违规（恒成对）').toHaveLength(r.reasons.length);
    for (const s of r.structuredViolations ?? []) {
      expect(r.reasons, `message 须为 reasons 原文：${s.message}`).toContain(s.message);
      expect(s.classification, '分类恒 semantic').toBe('semantic');
    }
  });

  it('VERIFIER-VARIANCE：subject=字段路径 subCriteria[N].variance、fixHints=常量表原文', () => {
    const r = checkVerifierOutput(makeBadVarianceOutput());
    const v = (r.structuredViolations ?? []).find((s) => s.rule === 'VERIFIER-VARIANCE');
    expect(v, 'VERIFIER-VARIANCE 结构化违规应在场').toBeDefined();
    expect(v?.subject).toBe('subCriteria[1].variance');
    expect(v?.fixHints).toEqual(['方差超阈值属不可重复评审：换 Persona/新上下文重评']);
  });

  it('schema 前置拦截路径：全部 rule=VERIFIER-SCHEMA，subject 提取字段路径（根级 → schema）', () => {
    const r = checkVerifierOutput({
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: 'not-a-date',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.structuredViolations, 'schema 路径双轨同源（1:1）').toHaveLength(r.reasons.length);
    for (const s of r.structuredViolations ?? []) {
      expect(s.rule).toBe('VERIFIER-SCHEMA');
    }
    const subjects = (r.structuredViolations ?? []).map((s) => s.subject);
    expect(subjects, '根级 required（缺 subCriteria 等）→ schema').toContain('schema');
    expect(subjects, '嵌套路径 format:date-time → 点号字段路径').toContain('meta.reviewedAt');
  });

  it('R12 缺具体引用 → rule=VERIFIER-EVIDENCE、subject=subCriteria[N].evidence、fixHints=常量表原文', () => {
    const output = makeOutput(SPREAD) as Record<string, unknown>;
    const subCriteria = output.subCriteria as Array<Record<string, unknown>>;
    subCriteria[4]!['evidence'] = '整体结论良好且风险可控'; // 无文件路径/行号/章节/ID → R12 命中
    const r = checkVerifierOutput(output);
    const ev = r.structuredViolations?.find((s) => s.rule === 'VERIFIER-EVIDENCE');
    expect(ev?.subject).toBe('subCriteria[5].evidence');
    expect(ev?.classification).toBe('semantic');
    expect(ev?.fixHints).toEqual(['evidence 补 <路径>:<定位>=<值> 形态；禁裸声明']);
    expect(r.reasons).toContain(ev?.message);
  });

  it('合规 VerifierOutput：structuredViolations 恒在场且为空数组（与 reasons 同源零违规）', () => {
    const r = checkVerifierOutput(makeOutput(SPREAD));
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(Array.isArray(r.structuredViolations)).toBe(true);
    expect(r.structuredViolations).toEqual([]);
  });
});

// ==================== C11/C16/C17（任务 4：verifier 域三项修复） ====================

describe('C11 Windows 路径 evidence', () => {
  /** 构造含目标 evidence 的 VerifierOutput（除 subCriteria[1] 外全部合规），端到端走 R12/evidence 格式判据 */
  const makeOutputWithEvidence = (ev: string) => ({
    schemaVersion: '1.0',
    meta: {
      targetKind: 'requirement',
      target: 'REQ-001',
      reviewedAt: '2026-07-31T00:00:00Z',
      agent: 'test-agent',
      scoringMethod: 'logits',
      repeatTimes: 3,
      varianceThreshold: 0.1,
    },
    subCriteria: (
      [
        ['completeness', 0.3],
        ['clarity', 0.25],
        ['consistency', 0.2],
        ['testability', 0.15],
        ['traceability', 0.1],
      ] as const
    ).map(([name, weight], i) => ({
      name,
      weight,
      score: 0.9,
      rawScores: [0.89, 0.9, 0.91],
      variance: 0.0000667,
      evidence: i === 0 ? ev : 'requirements.md:§3.2=REQ-001 需求覆盖',
    })),
    compositeScore: 0.9,
    qualityLevel: 'A',
    reviewedArtifacts: R19_REVIEWED,
    summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
    passed: true,
  });

  // 注：简报样例 `D:\proj\x.ts:L1-L5=…` 的双 L 区间是 D-10① 钉死的非法形态（行号区间须写
  // 单 L `:L1-5`，见 bad-evidence-double-l.json / 既有「双 L 文案区分」用例），C11 的实质是
  // 盘符前缀 + 反斜杠，与区间语法正交——正例取合法单 L 区间 `L1-5`，双 L 拒绝语义不变。
  it.each(['src\\utils\\a.ts:L12=认证模块边界清晰', 'D:\\proj\\x.ts:L1-5=盘符前缀路径行号区间引用'])(
    '%s 应通过 evidence 格式校验',
    (ev) => {
      // R12 单判据：Windows 路径须被识别为具体引用
      expect(checkR12EvidenceSpecificity(ev, 1), `${ev}: R12 应不命中`).toBeNull();
      // evidence 格式单判据：反斜杠/盘符前缀路径 + :Lnn= 定位合法
      const fmt = validateEvidenceFormat([ev]);
      expect(fmt.valid, `${ev}: 格式校验应通过`).toBe(true);
      expect(fmt.formatMismatchItems, `${ev}: 不应记入格式不符`).toEqual([]);
      // 端到端：无 evidence 格式/R12 violation
      const r = checkVerifierOutput(makeOutputWithEvidence(ev));
      expect(
        r.reasons.some((m) => /evidence 格式不符|缺具体引用/.test(m)),
        `${ev}: 端到端应无格式 violation`,
      ).toBe(false);
      expect(r.passed, `${ev}: 端到端应通过`).toBe(true);
    },
  );
});

describe('C16 Ajv 结构化字段优先', () => {
  it('instancePath/params.missingProperty 可用时不再依赖文案正则', () => {
    // 合成 ajv 错误对象驱动：required 错误的字段名在 params.missingProperty、父路径在 instancePath，
    // 结构化提取 = 父路径 + 缺失字段（旧文案正则只能取到 '/meta:' 前的父路径）
    expect(
      ajvErrorSubject({
        instancePath: '/gateExitCode',
        params: { missingProperty: 'runId' },
      }),
    ).toBe('gateExitCode.runId');
    // 非 required 错误：instancePath 即完整字段路径（JSON pointer → 点号形态）
    expect(ajvErrorSubject({ instancePath: '/meta/reviewedAt' })).toBe('meta.reviewedAt');
    // 根级（instancePath 空/根）无字段路径 → undefined（由调用方回退文案正则 → 'schema'，既有钉死语义不变）
    expect(
      ajvErrorSubject({
        instancePath: '',
        params: { missingProperty: 'subCriteria' },
      }),
    ).toBeUndefined();
    expect(ajvErrorSubject({ instancePath: '/' })).toBeUndefined();
    expect(ajvErrorSubject(undefined)).toBeUndefined();
  });

  it('无结构化字段时回退旧正则：根级 required 仍报 subject=schema', () => {
    const r = checkVerifierOutput({ schemaVersion: '1.0' });
    expect(r.passed).toBe(false);
    const subjects = (r.structuredViolations ?? []).map((s) => s.subject);
    expect(subjects.length).toBeGreaterThan(0);
    expect(subjects).toContain('schema');
  });

  it('端到端：嵌套 required 的 subject 取 instancePath+missingProperty（旧文案正则只能取到父路径）', () => {
    const r = checkVerifierOutput({
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        // 缺 repeatTimes / varianceThreshold（嵌套 required）
      },
      subCriteria: [],
      compositeScore: 0.9,
      qualityLevel: 'A',
      summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
      passed: true,
    });
    expect(r.passed).toBe(false);
    const subjects = (r.structuredViolations ?? []).map((s) => s.subject);
    expect(subjects).toContain('meta.repeatTimes');
    expect(subjects).toContain('meta.varianceThreshold');
    expect(subjects).not.toContain('meta');
  });
});

describe('C17 长度不符降噪', () => {
  it('subCriteria 长度不符时只报一条长度 violation，不叠加错位比对', () => {
    // SUB_CRITERIA 五类 targetKind 均恰 5 项（无「expected 3」形态可构造），取 expected 5 / got 4：
    // 缺首项 completeness → 共享下标 0-3 全部错位，旧实现 = 1 条长度 + 4 条「name 应为」叠加误报
    const output = {
      schemaVersion: '1.0',
      meta: {
        targetKind: 'requirement',
        target: 'REQ-001',
        reviewedAt: '2026-07-31T00:00:00Z',
        agent: 'test-agent',
        scoringMethod: 'logits',
        repeatTimes: 3,
        varianceThreshold: 0.1,
      },
      subCriteria: (
        [
          ['clarity', 0.25],
          ['consistency', 0.2],
          ['testability', 0.15],
          ['traceability', 0.1],
        ] as const
      ).map(([name, weight]) => ({
        name,
        weight,
        score: 0.9,
        rawScores: [0.89, 0.9, 0.91],
        variance: 0.0000667,
        evidence: 'requirements.md:§3.2=REQ-001 需求覆盖',
      })),
      // 其余字段全部自洽（Σ = 0.9 × 0.7 = 0.63 → C 级 → expectedPassed=false），隔离长度单因子
      compositeScore: 0.63,
      qualityLevel: 'C',
      reviewedArtifacts: R19_REVIEWED,
      summary: '子标准数量不足的 VerifierOutput，应只报一条数量不符 violation，不叠加按下标错位比对误报。',
      passed: false,
      reworkHints: ['补齐缺失的 completeness 子标准后重新提交'],
    };
    const r = checkVerifierOutput(output);
    expect(r.passed).toBe(false);
    // 恰 1 条长度不符项
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatch(/数量不符（expected 5, got 4）/);
    // 无逐项错位项（「name 应为」类按下标比对）
    expect(r.reasons.some((m) => /name 应为/.test(m))).toBe(false);
    // 双轨同源：structuredViolations 恰 1 条
    expect(r.structuredViolations).toHaveLength(1);
    expect(r.structuredViolations?.[0]?.subject).toBe('subCriteria');
  });
});

// ==================== A2 R19：reviewedArtifacts 评审对象绑定（批次 6 任务 4） ====================
//
// 红队实测穿透面：手写分数自洽（过 R18/R13）、evidence 格式合法（过 R12）的 VerifierOutput
// 可一次通过 check-verifier-output——evidence 是纯字符串，与被评审的 S 产物零绑定。
// R19 强制 VerifierOutput 必填 reviewedArtifacts: [{path, sha256}]，CLI 读盘复核存在性 + 哈希 +
// 行数（deps 注入），logic 校验 evidence 归属与行号越界。
//
// 简报示意 helper（makeValidOutput / withReviewed）按本文件既有构造方式落地：
// makeValidOutput = 除 reviewedArtifacts 外全部合规的最小合法形态（照「R18 端到端接线」构造），
// withReviewed = 浅拷贝注入 reviewedArtifacts。断言语义与简报一致（R19 违规在场 + 消息含关键标识）。

describe('A2 R19：reviewedArtifacts 归属校验', () => {
  const makeValidOutput = () => ({
    schemaVersion: '1.0',
    meta: {
      targetKind: 'requirement',
      target: 'REQ-001',
      reviewedAt: '2026-07-31T00:00:00Z',
      agent: 'test-agent',
      scoringMethod: 'logits',
      repeatTimes: 3,
      varianceThreshold: 0.1,
    },
    subCriteria: (
      [
        ['completeness', 0.3],
        ['clarity', 0.25],
        ['consistency', 0.2],
        ['testability', 0.15],
        ['traceability', 0.1],
      ] as const
    ).map(([name, weight]) => ({
      name,
      weight,
      score: 0.9,
      rawScores: [0.89, 0.9, 0.91],
      variance: 0.0000667,
      evidence: 'src/a.ts:L1-2=合规行号区间引用',
    })),
    compositeScore: 0.9,
    qualityLevel: 'A',
    passed: true,
    summary: '本次评审覆盖五个子标准，全部达标，结论为 A 级可放行，无阻断性返工提示，评审方法为 logits 连续评分。',
    reworkHints: [],
  });
  const withReviewed = (
    out: ReturnType<typeof makeValidOutput>,
    reviewed: Array<{ path: string; sha256: string }>,
  ) => ({ ...out, reviewedArtifacts: reviewed });

  it('无 reviewedArtifacts → 拒绝（schema required 前置拦截 + logic 双拦）', () => {
    // schema 侧：checkVerifierOutput 前置校验（[schema] 前缀、点名 reviewedArtifacts）
    const base = makeValidOutput();
    const viaGate = checkVerifierOutput(base);
    expect(viaGate.passed).toBe(false);
    expect(viaGate.reasons.some((m) => m.includes('reviewedArtifacts'))).toBe(true);
    // logic 侧（防仅靠 schema 单拦的直连调用方）：validateReviewedArtifacts 对空/缺登记独立报 R19
    for (const reviewed of [undefined, []]) {
      const out = withReviewed(base, reviewed ?? []);
      const r19 = validateReviewedArtifacts(out as Record<string, unknown>);
      expect(
        r19.reasons.some((m) => m.includes('R19') && m.includes('reviewedArtifacts')),
        `reviewedArtifacts=${JSON.stringify(reviewed)}: logic 层应独立报 R19`,
      ).toBe(true);
    }
  });

  it('evidence 引用未登记的路径 → R19', () => {
    const out = withReviewed(makeValidOutput(), [{ path: 'src/a.ts', sha256: 'a'.repeat(64) }]);
    const subCriteria = out.subCriteria as Array<{ evidence: string }>;
    subCriteria[0]!.evidence = 'src/b.ts:L1-2=引用了未登记产物';
    const report = checkVerifierOutput(out);
    expect(report.passed).toBe(false);
    expect(
      report.reasons.some(
        (m) => m.includes('R19') && m.includes('src/b.ts') && m.includes('未在 reviewedArtifacts 登记'),
      ),
    ).toBe(true);
  });

  it('evidence 行号越界（deps 注入行数表）→ R19', () => {
    const out = withReviewed(makeValidOutput(), [{ path: 'src/a.ts', sha256: 'a'.repeat(64) }]);
    const subCriteria = out.subCriteria as Array<{ evidence: string }>;
    subCriteria[0]!.evidence = 'src/a.ts:L999=越界行号引用';
    const report = checkVerifierOutput(out, {
      lineCountsByPath: new Map([['src/a.ts', 40]]),
    });
    expect(report.passed).toBe(false);
    expect(report.reasons.some((m) => m.includes('R19') && m.includes('越界'))).toBe(true);
  });

  it('行数表未注入时跳过越界检查（CLI 直连 logic 的降级语义，不误报）', () => {
    const out = withReviewed(makeValidOutput(), [{ path: 'src/a.ts', sha256: 'a'.repeat(64) }]);
    const report = checkVerifierOutput(out);
    expect(report.reasons.some((m) => m.includes('越界'))).toBe(false);
    expect(report.passed).toBe(true);
  });

  it('sha256 非 64 位十六进制 → R19（schema pattern 前置 + logic 双拦）', () => {
    const out = withReviewed(makeValidOutput(), [{ path: 'src/a.ts', sha256: 'zz' }]);
    // schema 侧：pattern 前置拦截，点名 sha256
    const viaGate = checkVerifierOutput(out);
    expect(viaGate.passed).toBe(false);
    expect(viaGate.reasons.some((m) => m.includes('sha256'))).toBe(true);
    // logic 侧（直连调用双拦）：validateReviewedArtifacts 独立报 R19 64 位十六进制
    const r19 = validateReviewedArtifacts(out as Record<string, unknown>);
    expect(r19.reasons.some((m) => m.includes('R19') && m.includes('64 位十六进制'))).toBe(true);
  });

  it('R19 其余形态（3 态：path 含 ..、path 含反斜杠、登记齐全但 evidence 双份路径其一未登记）', () => {
    // path 含 ..（目录穿越形态）
    const traversal = withReviewed(makeValidOutput(), [{ path: '../secrets/a.ts', sha256: 'a'.repeat(64) }]);
    expect(
      validateReviewedArtifacts(traversal as Record<string, unknown>).reasons.some(
        (m) => m.includes('R19') && m.includes('POSIX'),
      ),
    ).toBe(true);
    // path 含反斜杠（Windows 形态不得登记——与 valid-windows-evidence.json 的 C11 正例语义互斥）
    const backslash = withReviewed(makeValidOutput(), [{ path: 'src\\a.ts', sha256: 'a'.repeat(64) }]);
    expect(validateReviewedArtifacts(backslash as Record<string, unknown>).reasons.some((m) => m.includes('R19'))).toBe(
      true,
    );
    // 同一输出内 §-形态 evidence 不参与绑定（跳过），登记齐全 → 零 R19
    const sectionForm = withReviewed(makeValidOutput(), R19_REVIEWED);
    (sectionForm.subCriteria as Array<{ evidence: string }>).forEach((sc) => {
      sc.evidence = 'requirements.md:§3.2=章节引用不参与绑定';
    });
    expect(validateReviewedArtifacts(sectionForm as Record<string, unknown>).reasons).toEqual([]);
  });
});

describe('parseEvidencePath（R19 与 evidence 归属共用提取器；R12 判定零变化）', () => {
  it('POSIX path:Lnn / path:Lnn-nn 提取（2 态）', () => {
    expect(parseEvidencePath('src/a.ts:L42=陈述')).toEqual({
      path: 'src/a.ts',
      startLine: 42,
      endLine: 42,
    });
    expect(parseEvidencePath('src/a.ts:L42-58=陈述')).toEqual({
      path: 'src/a.ts',
      startLine: 42,
      endLine: 58,
    });
  });

  it('非绑定形态返回 null（5 态：§章节 / 双 L 区间 / Windows 反斜杠 / 盘符前缀 / 裸行号）', () => {
    for (const ev of [
      'docs/x.md:§1.1=章节引用',
      'docs/x.md:L51-L53=双 L 区间',
      'src\\mod\\a.ts:L3=反斜杠路径',
      'D:\\proj\\x.ts:L1-5=盘符前缀',
      'L5',
      'REQ-001 §3.2',
      undefined,
    ]) {
      expect(parseEvidencePath(ev), `${String(ev)}: 应返回 null`).toBeNull();
    }
  });
});

describe('A2 R19 CLI 负样本（samples/verifier/bad-r19-*.json，读盘三重复核）', () => {
  it.each([
    ['bad-r19-evidence-not-registered.json', /R19 evidence 引用未在 reviewedArtifacts 登记/],
    ['bad-r19-artifact-hash-mismatch.json', /R19 评审对象哈希不符/],
    ['bad-r19-line-out-of-range.json', /R19 evidence 行号越界/],
  ] as const)('%s 经 CLI 应 exit 1 且唯一违规为 R19', async (file, pattern) => {
    const result = await runVerifierCli(resolve(ROOT, 'w-model-dev/scripts/samples/verifier', file));
    expect(result.code).toBe(1);
    const report = JSON.parse(result.stdout) as { reasons: string[] };
    expect(
      report.reasons.some((r) => pattern.test(r)),
      `reasons 应含 ${pattern}`,
    ).toBe(true);
    expect(report.reasons, '唯一违规：不得叠加其他规则违规').toHaveLength(1);
  });

  it('lib/reviewed-artifacts：登记文件不存在 → R19 文件不存在（not-exists 分支，隔离根）', async () => {
    const { verifyReviewedArtifacts } = await import('../lib/reviewed-artifacts.js');
    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-r19-'));
    try {
      const check = verifyReviewedArtifacts([{ path: 'phantom.ts', sha256: 'a'.repeat(64) }], tempDir);
      expect(check.reasons).toEqual([expect.stringContaining('R19 评审对象文件不存在：phantom.ts')]);
      expect(check.lineCountsByPath.has('phantom.ts')).toBe(false);
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
