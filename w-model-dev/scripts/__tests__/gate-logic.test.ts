import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import {
  checkArtifactGate,
  checkRtmCoverageStatusConsistency,
  evaluateTlaBddWaiver,
  type RTMMatrixShape,
} from '../logic/gate-logic.js';
import { computeSigHash, verifyMaturityApproval, type SignatureChainEntry } from '../logic/signature-chain-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samples = (f: string) => path.resolve(__dirname, '../samples/gate', f);
const load = async (f: string) => JSON.parse(await fs.readFile(samples(f), 'utf-8')) as never;

/** A4 豁免分支用例的最小合法 RTM（形状照抄 samples/gate/valid-phase1.json，phase=1 全绿基线；schema 层要求 schemaVersion/projectId 等元字段） */
function makeGateInput(): RTMMatrixShape {
  const raw = {
    schemaVersion: '1.0',
    projectId: 'test-project',
    currentPhase: 1,
    lastUpdated: '2026-07-29T00:00:00.000Z',
    rows: [
      {
        requirementId: 'REQ-001',
        description: '用户注册功能',
        designDoc: 'docs/requirement-spec.md#REQ-001',
        codeModule: '',
        unitTest: '',
        integrationTest: '',
        systemTest: '',
        acceptanceTest: 'docs/acceptance-test-cases.md#UAT-001',
        coverageStatus: '100%',
      },
      {
        requirementId: 'NFR-001',
        description: '响应时间 P95 ≤ 200ms',
        designDoc: 'SD-001,SD-004',
        codeModule: '',
        unitTest: '',
        integrationTest: '',
        systemTest: '',
        acceptanceTest: '',
        coverageStatus: '100%',
        targetValue: 'P95 ≤ 200ms（生产环境）',
        testThreshold: 'P95 ≤ 250ms（测试环境基线）',
      },
    ],
    executionSummary: {
      unitTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      integrationTest: {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        coverage: 0,
      },
      systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      acceptanceTest: {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        coverage: 0,
      },
    },
  };
  return raw as RTMMatrixShape;
}

/** A4 human 审批条目构造器（v3 sigHash 真实重算；tamper=true 时模拟篡改） */
function humanMaturityApprovalEntry(over?: {
  role?: SignatureChainEntry['role'];
  signedAt?: string;
  tamperSigHash?: boolean;
  artifacts?: string[];
}): SignatureChainEntry {
  const role = over?.role ?? 'human';
  const base: Omit<SignatureChainEntry, 'sigHash'> = {
    sigId: 'wm1-r001-human',
    phase: 1,
    role,
    action: 'approve',
    targetKind: 'maturity',
    runId: 'wm1-r001',
    artifacts: over?.artifacts ?? ['.w-model/maturity.json'],
    prevSigId: 'genesis',
    prevSigHash: '0',
    signedAt: over?.signedAt ?? '2026-08-01T12:00:00.000Z',
    signer: 'user-wangh',
    inputProvenance: {
      sourceSigIds: [],
      sourceArtifacts: [],
      transformDescription: '用户确认 L0→L1 成熟度升级（human 审批链）',
    },
    sigHashAlgo: 'v3',
  };
  const sigHash = computeSigHash(base);
  return {
    ...base,
    sigHash: over?.tamperSigHash ? 'sha256:' + '0'.repeat(64) : sigHash,
  };
}

describe('gate-logic 核心路径单测（审计修复 P16：1400+ 行核心逻辑此前无专属单测）', () => {
  it('valid-rtm.json 通过终检（phase=8）', async () => {
    const out = checkArtifactGate(await load('valid-rtm.json'), {
      phaseOption: 8,
    });
    expect(out.passed).toBe(true);
    expect(out.reasons).toEqual([]);
  });

  it('bad fixtures 负例（3 夹具逐具名：bad-coverage / bad-nfr-missing-dual-fields / bad-phase5-missing-codemodule）', async () => {
    const rows = [
      {
        fixture: 'bad-coverage.json',
        phaseOption: 8,
        marker: /覆盖率未达 100%/,
      },
      {
        fixture: 'bad-nfr-missing-dual-fields.json',
        phaseOption: 8,
        marker: /NFR 行 NFR-001 缺 targetValue 与 testThreshold/,
      },
      {
        fixture: 'bad-phase5-missing-codemodule.json',
        phaseOption: 5,
        marker: /REQ-001.*codeModule/,
      },
    ] as const;
    for (const row of rows) {
      const out = checkArtifactGate(await load(row.fixture), {
        phaseOption: row.phaseOption,
      });
      expect(out.passed, `${row.fixture} 应不通过`).toBe(false);
      expect(out.reasons.join('\n'), `${row.fixture} 应报具名违规`).toMatch(row.marker);
    }
  });

  it('阶段级 --phase=5：valid-phase6.json 后续测试层（systemTest）不否决（反模式 #21）', async () => {
    const out = checkArtifactGate(await load('valid-phase6.json'), {
      phaseOption: 5,
    });
    expect(out.passed).toBe(true);
    expect(out.reasons.filter((v: string) => v.includes('systemTest')).length).toBe(0);
  });
});

// ==================== A4 maturity 钥匙收紧（豁免分支） ====================

describe('A4 maturity 豁免收紧：verifyMaturityApproval（signature-chain-logic）', () => {
  const maturity = {
    level: 'L1',
    history: [{ to: 'L1', at: '2026-08-01T00:00:00.000Z' }],
  };

  it('空链 → ok:false（缺 role=human / targetKind=maturity 审批条目）', () => {
    const v = verifyMaturityApproval([], maturity);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('缺少 role=human');
  });

  it('human 条目 sigHash 篡改 → ok:false（v3 重算不符）', () => {
    const v = verifyMaturityApproval([humanMaturityApprovalEntry({ tamperSigHash: true })], maturity);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('缺少 role=human');
  });

  it('role=S 的 maturity 条目（缺 human role）→ ok:false', () => {
    const v = verifyMaturityApproval([humanMaturityApprovalEntry({ role: 'S' })], maturity);
    expect(v.ok).toBe(false);
  });

  it('审批条目未绑定 maturity.json → ok:false', () => {
    const v = verifyMaturityApproval([humanMaturityApprovalEntry({ artifacts: ['.w-model/other.json'] })], maturity);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('未绑定 maturity.json');
  });

  it('审批早于最近一次 level 变更 → ok:false', () => {
    const v = verifyMaturityApproval([humanMaturityApprovalEntry({ signedAt: '2026-07-01T00:00:00.000Z' })], maturity);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('早于最近一次 level 变更');
  });

  it('合法 human 审批条目 → ok:true', () => {
    expect(verifyMaturityApproval([humanMaturityApprovalEntry()], maturity)).toEqual({ ok: true });
  });

  it('混合时区格式同时刻（审批 …T12:00:00.000Z vs 变更 …T20:00:00+08:00，同一时刻）→ ok:true（修复轮 1：Date 解析比较，字符串比较会误判）', () => {
    const m = { level: 'L1', history: [{ to: 'L1', at: '2026-08-01T20:00:00+08:00' }] };
    expect(verifyMaturityApproval([humanMaturityApprovalEntry()], m)).toEqual({ ok: true });
  });

  it('混合时区格式：审批早于变更 1 小时（…T11:00:00.000Z vs …T20:00:00+08:00）→ ok:false', () => {
    const m = { level: 'L1', history: [{ to: 'L1', at: '2026-08-01T20:00:00+08:00' }] };
    const v = verifyMaturityApproval([humanMaturityApprovalEntry({ signedAt: '2026-08-01T11:00:00.000Z' })], m);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('早于最近一次 level 变更');
  });
});

describe('A4 maturity 豁免收紧：checkArtifactGate 豁免分支（fail-closed）', () => {
  it('L1 无 human 审批链 → 豁免被拒绝（reasons 具名）且 tlaBddWaived=false', () => {
    const report = checkArtifactGate(makeGateInput(), {
      phaseOption: 1,
      maturity: { level: 'L1', history: [] },
      signatureChain: [],
    });
    expect(report.reasons.some((v) => v.includes('maturity 豁免被拒绝'))).toBe(true);
    expect(report.tlaBddWaived).toBe(false);
  });

  it('带合法 human 审批条目 → 豁免生效且 tlaBddWaived=true（GATE_JSON 可见）', () => {
    const report = checkArtifactGate(makeGateInput(), {
      phaseOption: 1,
      maturity: {
        level: 'L1',
        history: [{ to: 'L1', at: '2026-08-01T00:00:00.000Z' }],
      },
      signatureChain: [humanMaturityApprovalEntry()],
    });
    expect(report.passed).toBe(true);
    expect(report.tlaBddWaived).toBe(true);
  });

  it('缺链文件形态（signatureChain 缺省）→ 同样不豁免（fail-closed 三形态之二）', () => {
    const report = checkArtifactGate(makeGateInput(), {
      phaseOption: 1,
      maturity: { level: 'L0', history: [] },
    });
    expect(report.tlaBddWaived).toBe(false);
    expect(report.reasons.some((v) => v.includes('maturity 豁免被拒绝'))).toBe(true);
  });

  it('既有调用方零影响：未传 maturity → 无豁免判定、无新增 reason、tlaBddWaived=false', () => {
    const report = checkArtifactGate(makeGateInput(), { phaseOption: 1 });
    expect(report.passed).toBe(true);
    expect(report.tlaBddWaived).toBe(false);
    expect(report.reasons).toEqual([]);
  });

  it('L2 不请求豁免；phase 5-8 不适用豁免（Cucumber 证据域）', () => {
    const l2 = checkArtifactGate(makeGateInput(), {
      phaseOption: 1,
      maturity: { level: 'L2', history: [] },
      signatureChain: [],
    });
    expect(l2.reasons.some((v) => v.includes('maturity 豁免被拒绝'))).toBe(false);
    const p5 = checkArtifactGate(makeGateInput(), {
      phaseOption: 5,
      maturity: { level: 'L1', history: [] },
      signatureChain: [],
    });
    expect(p5.reasons.some((v) => v.includes('maturity 豁免被拒绝'))).toBe(false);
  });

  it('evaluateTlaBddWaiver：拒绝 reason 单点（CLI 早判定与纯函数同源）', () => {
    const v = evaluateTlaBddWaiver({ level: 'L1', history: [] }, 1, []);
    expect(v.waived).toBe(false);
    expect(v.reasons[0]).toContain('maturity 豁免被拒绝');
    expect(evaluateTlaBddWaiver(undefined, 1, []).waived).toBe(false);
  });
});

// ==================== A13：rtm coverageStatus 收严（43.1.0 breaking） ====================
describe('A13：rtm coverageStatus 收严（enum 三值 + rows 必填 + P0 循环不再 continue）', () => {
  it('A13a：rtm 行缺 coverageStatus → P0 违规（不再 continue 跳过）', () => {
    // 纵深防御层：直接调 P0 行级一致性校验，缺 coverageStatus 的行必须产出违规（此前 continue 跳过）
    const base = makeGateInput();
    const stripped = base.rows.map((r, i) => {
      const clone = { ...r };
      if (i === 0) delete clone.coverageStatus;
      return clone;
    });
    const violations = checkRtmCoverageStatusConsistency(stripped, []);
    expect(
      violations.some((v) => v.includes('REQ-001') && v.includes('coverageStatus')),
      '缺 coverageStatus 行须被点名（REQ-001）',
    ).toBe(true);

    // 端到端：schema rows.items.required 前置拦截，门禁不再静默放行
    const result = checkArtifactGate({ ...base, rows: stripped }, { phaseOption: 1 });
    expect(result.passed, '缺 coverageStatus 的 RTM 不得通过阶段门').toBe(false);
    expect(result.reasons.some((r) => r.includes('coverageStatus'))).toBe(true);
  });

  it('A13b：coverageStatus 非三值 → schema 拒绝', () => {
    const base = makeGateInput();
    for (const bad of ['完整', 'done', '100']) {
      const rows = base.rows.map((r) => ({ ...r, coverageStatus: bad }));
      const schemaResult = validateBySchema('rtm', { ...base, rows });
      expect(schemaResult.valid, `coverageStatus="${bad}" 须被 schema enum 拒绝`).toBe(false);
      expect(
        schemaResult.errorMessages?.some((m) => m.includes('coverageStatus')),
        `coverageStatus="${bad}" 的 schema 错误须点名 coverageStatus`,
      ).toBe(true);
    }
    // 合法三值不拒绝
    for (const ok of ['100%', '部分', '待覆盖']) {
      const rows = base.rows.map((r) => ({ ...r, coverageStatus: ok }));
      expect(validateBySchema('rtm', { ...base, rows }).valid, `coverageStatus="${ok}" 为合法枚举`).toBe(true);
    }
  });
});
