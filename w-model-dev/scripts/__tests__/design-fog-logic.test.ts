import { describe, expect, it } from 'vitest';
import { checkDesignFog } from '../logic/design-fog-logic';

const TABLE = (
  rows: string[],
) => `| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似归属（SD 候选） | 毕业方向（设计项 / 非目标 / 需求级回退） | 毕业处置结果 |
|---|---|---|---|---|---|
${rows.join('\n')}`;

const SECTION = (rows: string[], marker = false) => `# 系统设计文档

## 10. 设计边界与非目标

- 非目标 1

### 迷雾登记册

> 登记设计期未决项。

${[marker ? '本阶段无未终结迷雾项' : '', rows.length > 0 ? TABLE(rows) : ''].filter(Boolean).join('\n\n')}
`;

const ROW = (id: string, result: string, owner = 'SD-001', direction = '设计项') =>
  `| ${id} | 描述 | 依赖未定 | ${owner} | ${direction} | ${result} |`;

describe('checkDesignFog（批次2 设计期迷雾登记册）', () => {
  it('全终结表 + 通过态与 fogStats', () => {
    const md = SECTION([ROW('FOG-P2-01', '已毕业→SD-001'), ROW('FOG-P2-02', '判入非目标→§10', 'SD-002', '非目标')]);
    const r = checkDesignFog({ markdown: md, phase: 2 });
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.fogStats).toEqual({ total: 2, terminal: 2, unresolved: 0 });
  });
  it('R1：缺节 fail-closed', () => {
    const r = checkDesignFog({ markdown: '# 文档\n\n无迷雾内容\n', phase: 2 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R1'))).toBe(true);
  });
  it('R2：节内无表且无标记 → 违规', () => {
    const md = '# 文档\n\n## 迷雾登记册\n\n（空空如也）\n';
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R2'))).toBe(true);
  });
  it('合法无雾标记路径通过', () => {
    const r = checkDesignFog({ markdown: SECTION([], true), phase: 2 });
    expect(r.passed).toBe(true);
    expect(r.fogStats).toEqual({ total: 0, terminal: 0, unresolved: 0 });
  });
  it('R3：fogId 阶段前缀不匹配 → 违规', () => {
    const md = SECTION([ROW('FOG-P3-01', '已毕业→SD-001')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R3'))).toBe(true);
  });
  it('R3：fogId 位数不足 → 违规', () => {
    const md = SECTION([ROW('FOG-P2-1', '已毕业→SD-001')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R3'))).toBe(true);
  });
  it('R4：处置结果空 / 含待定 → 违规且计入 unresolved', () => {
    const md = SECTION([ROW('FOG-P2-01', ''), ROW('FOG-P2-02', '待定')]);
    const r = checkDesignFog({ markdown: md, phase: 2 });
    expect(r.violations.filter((v) => v.startsWith('R4')).length).toBe(2);
    expect(r.fogStats).toEqual({ total: 2, terminal: 0, unresolved: 2 });
  });
  it('R5：标记与数据行互斥（两侧各一违规态）', () => {
    const both = checkDesignFog({ markdown: SECTION([ROW('FOG-P2-01', '已毕业→SD-001')], true), phase: 2 });
    expect(both.violations.some((v) => v.startsWith('R5'))).toBe(true);
  });
  it('R6：毕业方向=设计项 但疑似归属空 → 违规', () => {
    const md = SECTION([ROW('FOG-P2-01', '已毕业', '', '设计项')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R6'))).toBe(true);
  });
  it('阶段 3/4 前缀正常判定', () => {
    expect(checkDesignFog({ markdown: SECTION([ROW('FOG-P4-01', '已毕业→DD-001')]), phase: 4 }).passed).toBe(true);
    expect(
      checkDesignFog({ markdown: SECTION([ROW('FOG-P2-01', '已毕业')]), phase: 3 }).violations.some((v) =>
        v.startsWith('R3'),
      ),
    ).toBe(true);
  });
});
