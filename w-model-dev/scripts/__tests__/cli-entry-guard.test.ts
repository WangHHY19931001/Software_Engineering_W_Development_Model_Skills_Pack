import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPTS = join(__dirname, '..');

describe('CLI 入口守卫（C1/C7）', () => {
  it('lib 层全目录禁止 process.env.VITEST 判断（防环境旁路）', () => {
    // 全目录口径：不只 run-main.ts——lib/ 下任何 .ts 文件出现 VITEST 环境判断
    // （如新增的辅助模块）都构成同一类环境旁路，逐一断言拦截。
    const libDir = join(SCRIPTS, 'lib');
    for (const f of readdirSync(libDir)) {
      if (!f.endsWith('.ts')) continue;
      const src = readFileSync(join(libDir, f), 'utf-8');
      expect(src, `${f} 不得出现 process.env.VITEST`).not.toContain('process.env.VITEST');
    }
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
