import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('eval runner 引擎自检', () => {
  it('--self-check 退出码 0 且报告 selfCheck=true', () => {
    const stdout = execSync(`npx tsx "${join(repoRoot, 'eval', 'runner.ts')}" --self-check`, {
      encoding: 'utf-8',
      cwd: repoRoot,
      timeout: 15000,
    });
    expect(stdout).toContain('"selfCheck":true');
  });

  it('--self-check 输出为合法 JSON（可被脚本消费）', () => {
    const stdout = execSync(`npx tsx "${join(repoRoot, 'eval', 'runner.ts')}" --self-check`, {
      encoding: 'utf-8',
      cwd: repoRoot,
      timeout: 15000,
    });
    expect(() => JSON.parse(stdout.trim().split('\n').pop()!)).not.toThrow();
  });
});
