import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkArtifactGate } from '../logic/gate-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samples = (f: string) => path.resolve(__dirname, '../samples/gate', f);
const load = async (f: string) => JSON.parse(await fs.readFile(samples(f), 'utf-8')) as never;

describe('gate-logic 核心路径单测（审计修复 P16：1400+ 行核心逻辑此前无专属单测）', () => {
  it('valid-rtm.json 通过终检（phase=8）', async () => {
    const out = checkArtifactGate(await load('valid-rtm.json'), { phaseOption: 8 });
    expect(out.passed).toBe(true);
    expect(out.reasons).toEqual([]);
  });

  it('bad-coverage.json 报覆盖率违反', async () => {
    const out = checkArtifactGate(await load('bad-coverage.json'), { phaseOption: 8 });
    expect(out.passed).toBe(false);
    expect(out.reasons.join('\n')).toMatch(/覆盖率未达 100%/);
  });

  it('bad-nfr-missing-dual-fields.json 报 NFR 双字段违反', async () => {
    const out = checkArtifactGate(await load('bad-nfr-missing-dual-fields.json'), { phaseOption: 8 });
    expect(out.passed).toBe(false);
    expect(out.reasons.join('\n')).toMatch(/NFR 行 NFR-001 缺 targetValue 与 testThreshold/);
  });

  it('阶段级 --phase=5：bad-phase5-missing-codemodule.json 报 codeModule 缺失', async () => {
    const out = checkArtifactGate(await load('bad-phase5-missing-codemodule.json'), { phaseOption: 5 });
    expect(out.passed).toBe(false);
    expect(out.reasons.join('\n')).toMatch(/REQ-001.*codeModule/);
  });

  it('阶段级 --phase=5：valid-phase6.json 后续测试层（systemTest）不否决（反模式 #21）', async () => {
    const out = checkArtifactGate(await load('valid-phase6.json'), { phaseOption: 5 });
    expect(out.passed).toBe(true);
    expect(out.reasons.filter((v: string) => v.includes('systemTest')).length).toBe(0);
  });
});