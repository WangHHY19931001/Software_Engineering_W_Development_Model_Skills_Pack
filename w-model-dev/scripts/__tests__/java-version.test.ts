/**
 * lib/java-version.ts 单元测试（审计修复 P15：Java 版本解析单一事实源）
 */
import { describe, expect, it } from 'vitest';
import { parseJavaMajor } from '../lib/java-version.js';

describe('parseJavaMajor（lib/java-version.ts 单一事实源）', () => {
  it('解析 Java 8 旧式版本号', () => {
    expect(parseJavaMajor('openjdk version "1.8.0_392"')).toBe(8);
  });
  it('解析 Java 11+ 新式版本号', () => {
    expect(parseJavaMajor('openjdk version "11.0.21" 2023-10-17')).toBe(11);
    expect(parseJavaMajor('openjdk version "17.0.9"')).toBe(17);
    expect(parseJavaMajor('openjdk version "21" 2023-09-19')).toBe(21);
  });
  it('无法解析时返回 null', () => {
    expect(parseJavaMajor('')).toBeNull();
    expect(parseJavaMajor('java version "abc"')).toBeNull();
  });
});
