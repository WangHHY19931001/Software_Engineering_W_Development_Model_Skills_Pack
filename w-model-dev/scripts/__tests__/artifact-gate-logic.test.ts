/* eslint-disable security/detect-non-literal-fs-filename -- 读取本仓 samples 夹具与构造注入 fs 桩，非用户输入 */
/* eslint-disable security/detect-object-injection -- 注入 fs 桩按测试受控路径键访问内存 map（contents[filePath]），非外部输入 */
/**
 * artifact-gate-logic.test.ts —— D6（43.3.0）gate-log 读取下沉 logic 单测
 *
 * 覆盖 `logic/artifact-gate-logic.ts` 的两个纯函数（注入 fs 适配器形态）：
 *   - readMaturityFile：合法 level+history 归一化 / level 非法 → undefined /
 *     history 坏条目过滤 / 文件缺失与读取失败（ENOENT）→ undefined / JSON 解析失败 → undefined；
 *   - loadSignatureChainFile：合法 JSONL 装载 / 文件不存在 → [] / 坏行与非对象行跳过 /
 *     CRLF 兼容 / 整文件读取失败 → []。
 *
 * 等价保持凭据（E）：
 *   - E1 注入桩语义等价——失败态函数级逐态断言（undefined / []），与 check-artifact-gate.ts
 *     历史实现（readMaturity / loadSignatureChainIfExists）判据逐字一致；
 *   - E2 真实适配器接线——用 `node:fs/promises.readFile(p, 'utf-8')`（CLI gateLogReadFs 同款）
 *     直接读 samples/gate 真实夹具，验证下沉后读路径端到端语义未变。
 */
import { promises as nodeFsPromises } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadSignatureChainFile, readMaturityFile, type ArtifactGateReadFs } from '../logic/artifact-gate-logic.js';
import type { MaturityApprovalInput, SignatureChainEntry } from '../logic/signature-chain-logic.js';

const samplesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'samples', 'gate');

/** 读取失败桩（模拟 ENOENT / 权限错误等——真实适配器下 readFile reject）。 */
const failingFs: ArtifactGateReadFs = {
  readFile: async () => {
    throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
  },
};

/** 单值桩（按传入路径返回对应内容；未登记路径 → reject）。 */
function stubFs(contents: Record<string, string>): ArtifactGateReadFs {
  return {
    readFile: async (filePath: string) => {
      // `in` 检查保证命中（noUncheckedIndexedAccess 下索引仍为联合，此处断言转窄）
      if (filePath in contents) return contents[filePath] as string;
      throw Object.assign(new Error(`ENOENT: ${filePath}`), { code: 'ENOENT' });
    },
  };
}

/** CLI 真实适配器同款（check-artifact-gate.ts 的 gateLogReadFs）。 */
const realFs: ArtifactGateReadFs = {
  readFile: (p: string) => nodeFsPromises.readFile(p, 'utf-8'),
};

describe('readMaturityFile（D6 gate-log 读取下沉 logic）', () => {
  it('合法 level + history → 归一化 {level, history}（to/at 非字符串条目规范化）', async () => {
    const content = JSON.stringify({
      level: 'L1',
      history: [
        {
          at: '2026-08-01T11:00:00.000Z',
          from: 'L0',
          to: 'L1',
          reason: '升级',
        },
        { at: 123, to: null, from: 'L1', reason: '坏条目' }, // to 非字符串 → ''；at 非字符串 → undefined
      ],
    });
    const result = await readMaturityFile(stubFs({ '/maturity.json': content }), '/maturity.json');
    expect(result).toEqual({
      level: 'L1',
      history: [
        { to: 'L1', at: '2026-08-01T11:00:00.000Z' },
        { to: '', at: undefined },
      ],
    });
  });

  it('history 缺失 → {level, history: []}；history 中非对象条目（null/标量）过滤', async () => {
    const content = JSON.stringify({
      level: 'L2',
      history: [null, 'L0', { to: 'L2' }, 42],
    });
    const result = await readMaturityFile(stubFs({ '/m.json': content }), '/m.json');
    expect(result).toEqual({
      level: 'L2',
      history: [{ to: 'L2', at: undefined }],
    });
  });

  it('level 非字符串 / 缺失 → undefined（不豁免，保持严格）', async () => {
    await expect(readMaturityFile(stubFs({ '/m.json': '{"level": 42}' }), '/m.json')).resolves.toBeUndefined();
    await expect(readMaturityFile(stubFs({ '/m.json': '{"history": []}' }), '/m.json')).resolves.toBeUndefined();
    await expect(readMaturityFile(stubFs({ '/m.json': '{}' }), '/m.json')).resolves.toBeUndefined();
  });

  it('文件缺失（ENOENT）与 JSON 解析失败 → undefined（与历史 readMaturity 同判据）', async () => {
    await expect(readMaturityFile(failingFs, '/no-such/maturity.json')).resolves.toBeUndefined();
    await expect(readMaturityFile(stubFs({ '/m.json': '{broken json' }), '/m.json')).resolves.toBeUndefined();
  });

  it('E2 真实适配器读 samples/gate/valid-maturity-waiver-with-approval/maturity.json 端到端一致', async () => {
    const file = path.join(samplesRoot, 'valid-maturity-waiver-with-approval', 'maturity.json');
    const result = await readMaturityFile(realFs, file);
    expect(result).toEqual({
      level: 'L1',
      history: [{ to: 'L1', at: '2026-08-01T11:00:00.000Z' }],
    } satisfies MaturityApprovalInput);
  });
});

describe('loadSignatureChainFile（D6 gate-log 读取下沉 logic）', () => {
  const validLine = {
    phase: 1,
    phaseName: '需求分析',
    runId: 'wm1-r001',
    sigHashAlgo: 'v3',
    sigId: 'wm1-r001-O1',
    role: 'O',
    action: 'chunk',
    signedAt: '2026-08-01T10:00:00.000Z',
    signer: 'orchestrator-1',
    artifacts: ['.w-model/project.json'],
    inputProvenance: {
      sourceSigIds: [],
      sourceArtifacts: [],
      transformDescription: 'phase start',
    },
    prevSigId: 'genesis',
    prevSigHash: '0',
    sigHash: 'sha256:c22c74e6b72cf39a3ffe1ccc03cd6cd0393a65c1d880d049f1ba2fa1b7da6e43',
  } satisfies SignatureChainEntry;

  it('合法 JSONL 装载（LF 与 CRLF 均兼容；空行跳过）', async () => {
    const content = [JSON.stringify(validLine), '', JSON.stringify({ ...validLine, sigId: 'wm1-r001-O2' })].join(
      '\r\n',
    );
    const result = await loadSignatureChainFile(stubFs({ '/chain.jsonl': content }), '/chain.jsonl');
    expect(result).toHaveLength(2);
    expect(result[0]?.sigId).toBe('wm1-r001-O1');
    expect(result[1]?.sigId).toBe('wm1-r001-O2');
  });

  it('坏行（JSON 解析失败）与非对象行（null/数组/标量）跳过——fail-closed 不构成审批', async () => {
    const content = [
      JSON.stringify(validLine),
      '{broken json',
      'null',
      '[]',
      '"scalar"',
      JSON.stringify({ ...validLine, sigId: 'wm1-r001-O3' }),
    ].join('\n');
    const result = await loadSignatureChainFile(stubFs({ '/chain.jsonl': content }), '/chain.jsonl');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.sigId)).toEqual(['wm1-r001-O1', 'wm1-r001-O3']);
  });

  it('文件不存在（ENOENT）与整文件读取失败 → []（与历史 loadSignatureChainIfExists 同判据）', async () => {
    await expect(loadSignatureChainFile(failingFs, '/no-such/signature-chain.jsonl')).resolves.toEqual([]);
  });

  it('E2 真实适配器读 samples/gate 两夹具（有效链 / 坏链）端到端一致', async () => {
    const valid = await loadSignatureChainFile(
      realFs,
      path.join(samplesRoot, 'valid-maturity-waiver-with-approval', 'signature-chain.jsonl'),
    );
    // 有效夹具：O + human 两条；含 targetKind: maturity 的 human 审批
    expect(valid).toHaveLength(2);
    expect(valid.some((e) => e.role === 'human' && e.targetKind === 'maturity')).toBe(true);

    const bad = await loadSignatureChainFile(
      realFs,
      path.join(samplesRoot, 'bad-maturity-waiver-missing-approval', 'signature-chain.jsonl'),
    );
    // 坏链夹具：O + S 两条，无 role=human 审批——装载层原样保留（无链判定由 verifyMaturityApproval 承担）
    expect(bad).toHaveLength(2);
    expect(bad.some((e) => e.role === 'human')).toBe(false);
    expect(bad.map((e) => e.sigId)).toEqual(['wm1-r001-O1', 'wm1-r001-S1']);

    // 缺文件 → []（真实适配器 ENOENT → reject → catch）
    await expect(
      loadSignatureChainFile(realFs, path.join(samplesRoot, 'valid-maturity-waiver-with-approval', 'missing.jsonl')),
    ).resolves.toEqual([]);
  });
});
