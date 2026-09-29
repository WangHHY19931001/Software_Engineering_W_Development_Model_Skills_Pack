/**
 * lib/java-version.ts 单元测试（审计修复 P15：Java 版本解析单一事实源）
 */
import { describe, expect, it } from 'vitest';
import { parseJavaMajor } from '../lib/java-version.js';

describe('parseJavaMajor（lib/java-version.ts 单一事实源）', () => {
  it('版本解析（3 态：旧式 1.x / 新式 x.y·x / 无法解析 null）', () => {
    const rows = [
      { name: '旧式 1.8 → 8', input: 'openjdk version "1.8.0_392"', expected: 8 },
      { name: '新式 11.0.21 → 11', input: 'openjdk version "11.0.21" 2023-10-17', expected: 11 },
      { name: '新式 17.0.9 → 17', input: 'openjdk version "17.0.9"', expected: 17 },
      { name: '新式 21 → 21', input: 'openjdk version "21" 2023-09-19', expected: 21 },
      { name: '空串 → null', input: '', expected: null },
      { name: '非数值版本 → null', input: 'java version "abc"', expected: null },
    ];
    for (const row of rows) {
      expect(parseJavaMajor(row.input), `${row.name}（样本 "${row.input}"）`).toBe(row.expected);
    }
  });
});
