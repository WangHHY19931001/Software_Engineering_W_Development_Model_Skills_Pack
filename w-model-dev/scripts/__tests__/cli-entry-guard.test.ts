import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPTS = join(__dirname, '..');

describe('CLI 入口守卫（C1/C7）', () => {
  it('lib 层禁止 process.env.VITEST 判断（防环境旁路）', () => {
    const runMain = readFileSync(join(SCRIPTS, 'lib/run-main.ts'), 'utf-8');
    expect(runMain).not.toContain('process.env.VITEST');
  });

  it('每个调用 runMain( 的 cli 文件（任意实参形态，含内联形）必须带 isDirectInvocation 守卫', () => {
    const cliDir = join(SCRIPTS, 'cli');
    // /\brunMain\s*\(/ 匹配任意实参形态（runMain(main) / runMain(async () => {...}) 等），
    // 不匹配 import 行（`runMain } from`，无紧跟左括号）——未来新增裸调用形态一律拦截
    const runMainCall = /\brunMain\s*\(/;
    const offenders: string[] = [];
    for (const f of readdirSync(cliDir)) {
      if (!f.endsWith('.ts')) continue;
      const src = readFileSync(join(cliDir, f), 'utf-8');
      if (runMainCall.test(src) && !src.includes('isDirectInvocation')) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
