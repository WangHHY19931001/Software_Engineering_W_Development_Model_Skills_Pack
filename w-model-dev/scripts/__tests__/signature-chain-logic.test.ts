import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

import { checkSignatureChain, computeSigHash, type SignatureChainEntry } from '../logic/signature-chain-logic.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples', 'signature-chain');

function loadJsonl(filename: string): SignatureChainEntry[] {
  const content = readFileSync(path.join(SAMPLES_DIR, filename), 'utf-8');
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

describe('signature-chain-logic R1-R11', () => {
  it('R1 valid-all-roles 通过', () => {
    const entries = loadJsonl('valid-all-roles.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R1');
  });

  it('R1-R11 负例 fixtures（10 个 bad-*.jsonl 逐 fixture 具名，R8 附 existingPaths 选项）', () => {
    const rows: Array<[fixture: string, 期望规则: string, options?: { existingPaths?: Set<string> }]> = [
      ['bad-missing-V.jsonl', 'R1'],
      ['bad-broken-chain.jsonl', 'R2'],
      ['bad-backdated.jsonl', 'R3'],
      ['bad-O-self-sign.jsonl', 'R5'],
      ['bad-tampered-hash.jsonl', 'R6'],
      ['bad-dangling-source.jsonl', 'R7'],
      ['bad-missing-artifact.jsonl', 'R8', { existingPaths: new Set<string>() }],
      ['bad-S-consumes-G.jsonl', 'R9'],
      ['bad-R-consumes-S.jsonl', 'R9'],
      ['bad-O-bypass-G.jsonl', 'R10'],
    ];
    for (const [fixture, 期望规则, options] of rows) {
      const entries = loadJsonl(fixture);
      // R8 needs existingPaths — pass an empty set so the missing artifact is detected
      const result = checkSignatureChain(entries, { phase: 1, ...options });
      expect(result.rulesFailed, `${fixture}: 应报 ${期望规则}`).toContain(期望规则);
    }
  });

  it('bad-O-produce（非法角色 X）被 schema role enum 前置拦截', () => {
    const entries = loadJsonl('bad-O-produce.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R1');
    expect(result.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('computeSigHash 一致性', () => {
    const entries = loadJsonl('valid-all-roles.jsonl');
    const entry = entries[0]!;
    const recomputed = computeSigHash(entry);
    expect(recomputed).toBe(entry.sigHash);
  });

  // E1: 跨阶段连续链（archive 模式）
  it('E1 连续链 archive pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { stage: 'archive' });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R2');
  });

  // E1: 跨阶段连续链（--phase=2 模式）
  it('E1 连续链 --phase=2 pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R2');
  });

  // E1: 跨阶段断链（prevSigId 不存在）
  it('E1 跨阶段断链 --phase=2 fail', () => {
    const entries = loadJsonl('bad-broken-cross-phase.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.rulesFailed).toContain('R2');
  });

  // E2: 跨阶段来源并集（--phase=2 模式允许引用 phase 1 sigIds）
  it('E2 跨阶段来源并集 --phase=2 pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R7');
  });

  // E3: 全违规聚合 — 验证多个违规能被收集
  it('E3 全违规聚合 multiple violations collected', () => {
    const entries = loadJsonl('bad-broken-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R2');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });
});

// ==================== D-1 返工来源例外（role×action×targetKind 三元判定） ====================

/**
 * 构造带正确 sigHash 的单环条目（D-1/A1 测试助手）。
 * genesis 起点单条目：R1/R2 等链级规则必然失败，但 D-1 用例只聚焦 R9 断言（过滤 R9 前缀），
 * 因此单环足够；sourceSigIds 指向 genesis 以免引入 R7 悬空来源噪声。
 * v3（43.0.0）：sigHashAlgo 必填 'v3'；gateExitCode/gateLogPath 入哈希（A1）。
 */
function entry(over: {
  sigId?: string;
  role?: SignatureChainEntry['role'];
  action?: string;
  targetKind?: SignatureChainEntry['targetKind'];
  gateExitCode?: number;
  gateLogPath?: string;
  sourceRoles?: readonly SignatureChainEntry['inputProvenance']['sourceArtifacts'][number]['sourceRole'][];
}): SignatureChainEntry {
  const role = over.role ?? 'S';
  const sourceRoles = over.sourceRoles ?? [];
  const base: Omit<SignatureChainEntry, 'sigHash'> = {
    sigId: over.sigId ?? `wm1-r001-${role}1`,
    phase: 1,
    role,
    action: over.action ?? 'produce',
    runId: 'wm1-r001',
    artifacts: ['.w-model/artifact.md'],
    prevSigId: 'genesis',
    prevSigHash: '0',
    signedAt: '2026-09-21T10:00:00.000Z',
    signer: `${role.toLowerCase()}-agent-1`,
    ...(over.gateExitCode !== undefined ? { gateExitCode: over.gateExitCode } : {}),
    ...(over.gateLogPath !== undefined ? { gateLogPath: over.gateLogPath } : {}),
    inputProvenance: {
      sourceSigIds: sourceRoles.length > 0 ? ['genesis'] : [],
      sourceArtifacts: sourceRoles.map((srcRole) => ({
        path: `.w-model/upstream-${srcRole}.md`,
        sourceSigId: 'genesis',
        sourceRole: srcRole,
        sha256: 'a'.repeat(64), // R11（v3 全量适用）：来源 sha256 必填
      })),
      transformDescription: 'D-1 测试构造的单环',
    },
    ...(over.targetKind !== undefined ? { targetKind: over.targetKind } : {}),
    sigHashAlgo: 'v3',
  };
  return { ...base, sigHash: computeSigHash(base) };
}

describe('signature-chain-logic D-1 返工来源例外', () => {
  it('D-1 放行行（3 态：S@fix 消费 R / V@rootcause 消费 R / R@preventive 消费 S）', () => {
    for (const [场景, over, schemaClean] of [
      [
        'S + fix + 消费 R → 放行（D-1 例外，反模式 #18 守护的正面路径）',
        { role: 'S', action: 'fix', sourceRoles: ['R'] },
        false,
      ],
      [
        'V + review + targetKind=rootcause + 消费 R → 放行（V 复审 RootCauseReport）',
        {
          role: 'V',
          action: 'review',
          sourceRoles: ['R'],
          targetKind: 'rootcause',
        },
        true,
      ],
      [
        'R + locate + targetKind=preventive + 消费 S → 放行（R3 预防性审查）',
        {
          role: 'R',
          action: 'locate',
          sourceRoles: ['S'],
          targetKind: 'preventive',
        },
        true,
      ],
    ] as const) {
      const r = checkSignatureChain([entry(over)]);
      if (schemaClean) {
        expect(
          r.violations.filter((v) => v.startsWith('[schema]')),
          `${场景}: targetKind 须通过 schema`,
        ).toEqual([]);
      }
      expect(
        r.violations.filter((v) => v.startsWith('R9')),
        `${场景}: 应无 R9 violation`,
      ).toEqual([]);
      expect(r.rulesFailed, `${场景}: R9 不应失败`).not.toContain('R9');
    }
  });

  it('D-1 拒绝行（3 态：S@produce 消费 R / V@standard 消费 R / R@rootcause 消费 S）', () => {
    for (const [场景, over, 期望片段] of [
      [
        'S + produce + 消费 R → 仍拒（#18 守护：例外仅限 fix/emergency-fix）',
        { role: 'S', action: 'produce', sourceRoles: ['R'] },
        '角色 S 不得消费 R',
      ],
      [
        'V + review + targetKind=standard + 消费 R → 仍拒',
        {
          role: 'V',
          action: 'review',
          sourceRoles: ['R'],
          targetKind: 'standard',
        },
        '角色 V 不得消费 R',
      ],
      [
        'R + locate + targetKind=rootcause + 消费 S → 仍拒',
        {
          role: 'R',
          action: 'locate',
          sourceRoles: ['S'],
          targetKind: 'rootcause',
        },
        '角色 R 不得消费 S',
      ],
    ] as const) {
      const r = checkSignatureChain([entry(over)]);
      expect(r.violations, `${场景}: 应报 R9 并含「${期望片段}」`).toEqual(
        // eslint-disable-next-line security/detect-non-literal-regexp -- 期望片段 为用例内字面量行表条目，聚合用例常量表驱动 RegExp，模式非用户输入
        expect.arrayContaining([expect.stringMatching(new RegExp(`R9: .*${期望片段}`))]),
      );
      expect(r.rulesFailed, `${场景}: R9 应失败`).toContain('R9');
    }
  });

  // 43.0.0 A1（推翻「targetKind 不入哈希」旧裁定）：targetKind 入 sigHash——
  // 红队实验 2 证实旧形态下无痕改 targetKind 即可洗白 R9 越权消费为 D-1 合法例外
  it('D-1: targetKind 入 sigHash（v3；无痕改 targetKind → R6 抓获）', () => {
    const withoutTk = entry({
      role: 'V',
      action: 'review',
      sourceRoles: ['R'],
    });
    const withTk = entry({
      role: 'V',
      action: 'review',
      sourceRoles: ['R'],
      targetKind: 'rootcause',
    });
    // 除 targetKind 外字段全同（同一 helper），v3 公式下两环 sigHash 必不同 → targetKind 参与哈希输入
    expect(withTk.sigHash).not.toBe(withoutTk.sigHash);
    expect(computeSigHash(withTk)).toBe(withTk.sigHash);
    // 无痕改写：保留原 sigHash、只改 targetKind → R6 重算不一致（旧公式下此改动不可检测）
    const tampered: SignatureChainEntry = {
      ...withoutTk,
      targetKind: 'rootcause',
    };
    const r = checkSignatureChain([tampered]);
    expect(r.violations.filter((v) => v.startsWith('[schema]'))).toEqual([]); // schema 接受 targetKind
    expect(r.rulesFailed).toContain('R6'); // R6 重算不一致
  });
});

// ==================== 43.0.0 sigHash v3 单公式（A1：14 字段全量入哈希，删 v1/v2 分流） ====================

describe('43.0.0 sigHash v3 单公式', () => {
  const base = {
    sigId: 'wm5-r001-G1',
    phase: 5,
    role: 'G' as const,
    action: 'gate',
    runId: 'r1',
    artifacts: ['out/gate.json'],
    prevSigId: 'genesis',
    prevSigHash: '0',
    signedAt: '2026-10-01T00:00:00.000Z',
    signer: 'G',
    gateExitCode: 0,
    gateLogPath: 'docs/changes/archive/gate.json',
    inputProvenance: {
      sourceSigIds: [],
      sourceArtifacts: [
        {
          path: 'out/gate.json',
          sourceSigId: 'genesis',
          sourceRole: 'G' as const,
          sha256: 'a'.repeat(64),
        },
      ],
      transformDescription: 't',
    },
    sigHashAlgo: 'v3' as const,
  };

  it('v3 公式逐字段手工拼串独立重算一致（14 字段全量入哈希，含 sourceArtifacts 槽位）', () => {
    // 独立实现 v3 公式（与 logic 层同构）：按 SIG_HASH_FIELDS_V3 顺序逐字段 dot 取值
    // （JSON_FIELDS 三字段 JSON.stringify ?? null，其余 String ?? ''），防实现漂移；
    // 显式 dot 访问无动态键，object-injection 安全。
    const canonical = [
      String(base.sigId ?? ''),
      String(base.phase ?? ''),
      String(base.role ?? ''),
      String(base.action ?? ''),
      String(base.runId ?? ''),
      JSON.stringify(base.artifacts ?? null),
      // 'sourceArtifacts' 槽位恒为 'null'：运行时 SignatureChainEntry 无顶层该属性
      // （真实来源经 inputProvenance 槽位入哈希），与 logic 层原 cast 读取（undefined）行为一致
      JSON.stringify(null),
      String(base.prevSigHash ?? ''),
      String(base.signedAt ?? ''),
      String(base.signer ?? ''),
      JSON.stringify(base.inputProvenance ?? null),
      // base 未设可选字段 targetKind → 该槽位恒为 ''
      String(''),
      String(base.gateExitCode ?? ''),
      String(base.gateLogPath ?? ''),
    ].join('|');
    const expected = 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex');
    expect(computeSigHash(base)).toBe(expected);
  });

  it('v3：targetKind/gateExitCode/gateLogPath 任一改动 → 重算哈希改变（红队实验 2 销毁面）', () => {
    expect(computeSigHash(base)).not.toBe(computeSigHash({ ...base, targetKind: 'preventive' }));
    expect(computeSigHash(base)).not.toBe(computeSigHash({ ...base, gateExitCode: 1 }));
    expect(computeSigHash(base)).not.toBe(computeSigHash({ ...base, gateLogPath: 'forged.json' }));
    // 篡改来源 sha256 同样改变重算（sourceArtifacts 经 inputProvenance 槽位入哈希）
    const tamperedSha = {
      ...base,
      inputProvenance: {
        ...base.inputProvenance,
        sourceArtifacts: [
          {
            ...base.inputProvenance.sourceArtifacts[0]!,
            sha256: 'b'.repeat(64),
          },
        ],
      },
    };
    expect(computeSigHash(tamperedSha)).not.toBe(computeSigHash(base));
  });

  it('旧算法条目 fail-closed：sigHashAlgo 非 v3/缺失 → schema 前置拒绝（R6 兜底分支不迁移旧数据）', () => {
    const legacyV2 = {
      ...base,
      sigHash: computeSigHash(base),
      sigHashAlgo: 'v2',
    };
    const rV2 = checkSignatureChain([legacyV2 as unknown as SignatureChainEntry]);
    expect(rV2.passed).toBe(false);
    expect(rV2.violations.some((v: string) => v.startsWith('[schema]'))).toBe(true);
    const legacyMissing = { ...base, sigHash: computeSigHash(base) } as Record<string, unknown>;
    delete legacyMissing.sigHashAlgo;
    const rMissing = checkSignatureChain([legacyMissing as unknown as SignatureChainEntry]);
    expect(rMissing.passed).toBe(false);
    expect(rMissing.violations.some((v: string) => v.includes('sigHashAlgo'))).toBe(true);
  });

  it('R11：v3 全量适用——sha256 缺失/非 64-hex → 违规（不再按 sigHashAlgo 分流）', () => {
    const missing = {
      ...base,
      inputProvenance: {
        ...base.inputProvenance,
        sourceArtifacts: [{ path: 'x', sourceSigId: 'genesis', sourceRole: 'G' as const }],
      },
    };
    const signedMissing = { ...missing, sigHash: computeSigHash(missing) };
    const r = checkSignatureChain([signedMissing]);
    expect(r.violations.some((v: string) => v.startsWith('R11'))).toBe(true);
    expect(r.rulesFailed).toContain('R11');
    // 非 64-hex：schema 层前置拦截（sha256 pattern 不通过 → [schema] 违规提前返回），
    // R11 的格式校验为纵深防御；公开路径断言整体被拒且违规指向 sha256
    const badFormat = {
      ...signedMissing,
      inputProvenance: {
        ...missing.inputProvenance,
        sourceArtifacts: [
          {
            path: 'x',
            sourceSigId: 'genesis',
            sourceRole: 'G' as const,
            sha256: 'not-hex',
          },
        ],
      },
    };
    const badFormatResult = checkSignatureChain([badFormat]);
    expect(badFormatResult.passed).toBe(false);
    expect(badFormatResult.violations.some((v: string) => v.includes('sha256'))).toBe(true);
  });
});

// ==================== A1 签名链 v3 单公式（43.0.0 breaking，红队实验 2 回归） ====================

describe('A1 v3 单公式：targetKind/gateExitCode/gateLogPath 入哈希', () => {
  /** role=V 的合法条目（复用 D-1 helper；v3 公式重算 sigHash） */
  const makeValidEntry = () => entry({ role: 'V', action: 'review' });
  /** role=G、带 gateExitCode/gateLogPath 的门禁条目（A1：门禁字段入哈希） */
  const makeValidGateEntry = () =>
    entry({
      role: 'G',
      action: 'gate',
      gateExitCode: 0,
      gateLogPath: '.w-model/gate-logs/gate.json',
    });

  it('R6：已签条目无痕改 targetKind 必须失败（红队实验 2 回归）', () => {
    const e = makeValidEntry();
    // v3 公式判定力：targetKind 参与哈希——同环换 targetKind 重算哈希必不同
    expect(computeSigHash(e)).not.toBe(computeSigHash({ ...e, targetKind: 'preventive' }));

    const signed = { ...e, sigHash: computeSigHash(e) };
    expect(checkSignatureChain([signed]).rulesFailed).not.toContain('R6');

    const tampered = { ...signed, targetKind: 'preventive' as const };
    const report = checkSignatureChain([tampered]);
    expect(report.rulesFailed).toContain('R6');
    expect(report.violations.some((v) => v.startsWith('R6'))).toBe(true);
  });

  it('v3：gateExitCode/gateLogPath 改动同样破坏签名', () => {
    const e = makeValidGateEntry();
    // v3 公式判定力：门禁字段参与哈希
    expect(computeSigHash(e)).not.toBe(computeSigHash({ ...e, gateExitCode: 3 }));
    expect(computeSigHash(e)).not.toBe(computeSigHash({ ...e, gateLogPath: '.w-model/gate-logs/other.json' }));

    const signed = { ...e, sigHash: computeSigHash(e) };
    expect(checkSignatureChain([signed]).rulesFailed).not.toContain('R6');

    expect(checkSignatureChain([{ ...signed, gateExitCode: 3 }]).rulesFailed).toContain('R6');
    expect(checkSignatureChain([{ ...signed, gateLogPath: '.w-model/gate-logs/forged.json' }]).rulesFailed).toContain(
      'R6',
    );
  });
});

describe('sigHash v3 fixtures（samples/signature-chain；43.0.0 codemod 后 valid-v2/bad-v2-* 已为 v3 原生数据）', () => {
  it('valid-v2 全链 v3 单公式 + sha256 齐全 → 通过（R11 入 rulesPassed）', () => {
    const entries = loadJsonl('valid-v2.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).toEqual([]);
    expect(result.rulesPassed).toContain('R11');
  });

  it('bad-v2-missing-sha256 → R11（v3 全量适用，违规不再按条目分流）', () => {
    const entries = loadJsonl('bad-v2-missing-sha256.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R11');
    expect(result.violations.some((v) => v === 'R11: wm1-r001-S 来源 sha256 缺失或非法')).toBe(true);
  });

  it('bad-v2-tampered-sha256 → R6（v3 公式含 sha256，篡改不重算必检出不一致）', () => {
    const entries = loadJsonl('bad-v2-tampered-sha256.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R6');
    expect(result.rulesFailed).not.toContain('R11'); // 篡改后仍为合法 64-hex，R11 不误报
  });
});

// ==================== A4 human 审批条目（maturity 豁免链，批次 6 任务 8） ====================

describe('A4 human 审批条目（task 3 预置枚举的逻辑收尾）', () => {
  /** role=human / targetKind=maturity 的审批条目（v3 sigHash 真实重算） */
  const humanApprovalEntry = (): SignatureChainEntry => {
    const base: Omit<SignatureChainEntry, 'sigHash'> = {
      sigId: 'wm1-r001-human',
      phase: 1,
      role: 'human',
      action: 'approve',
      targetKind: 'maturity',
      runId: 'wm1-r001',
      artifacts: ['.w-model/maturity.json'],
      prevSigId: 'genesis',
      prevSigHash: '0',
      signedAt: '2026-08-01T12:00:00.000Z',
      signer: 'user-wangh',
      inputProvenance: {
        sourceSigIds: [],
        sourceArtifacts: [],
        transformDescription: '用户确认 L0→L1 成熟度升级（human 审批链）',
      },
      sigHashAlgo: 'v3',
    };
    return { ...base, sigHash: computeSigHash(base) };
  };

  it('sigId human 后缀形态通过 schema（pattern 扩展；role enum 含 human）', () => {
    const schemaResult = validateBySchema('signature-chain', humanApprovalEntry());
    expect(schemaResult.errorMessages).toEqual([]);
    expect(schemaResult.valid).toBe(true);
  });

  it('R4 侧不参与阶段角色链：human 条目不触发「不允许角色」（schema description 承诺收尾）', () => {
    const result = checkSignatureChain([humanApprovalEntry()], { phase: 1 });
    // 单条 human 链缺整环角色 → R1 失败属预期；但 R4 不得因 human 角色本身违规
    expect(result.rulesFailed).toContain('R1');
    expect(result.rulesFailed).not.toContain('R4');
    expect(result.violations.some((v) => v.startsWith('R4:'))).toBe(false);
  });
});
