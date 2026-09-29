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

  it('bad fixtures 负例（3 夹具逐具名：bad-coverage / bad-nfr-missing-dual-fields / bad-phase5-missing-codemodule）', async () => {
    const rows = [
      { fixture: 'bad-coverage.json', phaseOption: 8, marker: /覆盖率未达 100%/ },
      {
        fixture: 'bad-nfr-missing-dual-fields.json',
        phaseOption: 8,
        marker: /NFR 行 NFR-001 缺 targetValue 与 testThreshold/,
      },
      { fixture: 'bad-phase5-missing-codemodule.json', phaseOption: 5, marker: /REQ-001.*codeModule/ },
    ] as const;
    for (const row of rows) {
      const out = checkArtifactGate(await load(row.fixture), { phaseOption: row.phaseOption });
      expect(out.passed, `${row.fixture} 应不通过`).toBe(false);
      expect(out.reasons.join('\n'), `${row.fixture} 应报具名违规`).toMatch(row.marker);
    }
  });

  it('阶段级 --phase=5：valid-phase6.json 后续测试层（systemTest）不否决（反模式 #21）', async () => {
    const out = checkArtifactGate(await load('valid-phase6.json'), { phaseOption: 5 });
    expect(out.passed).toBe(true);
    expect(out.reasons.filter((v: string) => v.includes('systemTest')).length).toBe(0);
  });
});
