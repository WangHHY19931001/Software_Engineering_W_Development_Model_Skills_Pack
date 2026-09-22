/**
 * lib/is-main.ts 入口守卫单元测试（WS-E 仓库级加固）。
 *
 * 覆盖简报三例：直跑相等 → true / 入口路径不存在 → false / temp 目录真实文件对 → true。
 * 测试文件允许直连 node:fs（dependency-boundaries 只约束 logic/ 层裸 import 与 lib→logic 边界，
 * __tests__/ 不在生产依赖扫描范围内）。
 */

import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { isDirectInvocation } from '../lib/is-main.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 目录由本测试 mkdtempSync 自建，非用户输入
    rmSync(directory, { recursive: true, force: true });
  }
});

/** 受控替换 process.argv[1]（vitest 下该槽位是 vitest worker 路径），用后恢复。 */
function withEntryArg(entryArg: string | undefined, run: () => void): void {
  const previous = process.argv[1];
  process.argv[1] = entryArg as unknown as string;
  try {
    run();
  } finally {
    process.argv[1] = previous as string;
  }
}

describe('isDirectInvocation', () => {
  it('直跑相等：模块 URL 与 argv[1] 指向同一真实文件 → true', () => {
    const selfPath = fileURLToPath(import.meta.url);
    withEntryArg(selfPath, () => {
      expect(isDirectInvocation(import.meta.url)).toBe(true);
    });
  });

  it('不存在路径：argv[1] 缺失或指向不存在的文件 → false 保守', () => {
    withEntryArg(undefined, () => {
      expect(isDirectInvocation(import.meta.url)).toBe(false);
    });
    const missing = path.join(os.tmpdir(), `wm-is-main-missing-${process.pid}.ts`);
    withEntryArg(missing, () => {
      expect(isDirectInvocation(import.meta.url)).toBe(false);
    });
  });

  it('temp 目录真实文件对：非规范入口路径经 path.resolve + realpathSync 归一化后相等 → true', () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- os.tmpdir() 下受控前缀 mkdtemp
    const directory = mkdtempSync(path.join(os.tmpdir(), 'wm-is-main-'));
    temporaryDirectories.push(directory);
    const entry = path.join(directory, 'entry.ts');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- entry 位于本测试自建的 mkdtemp 目录内
    writeFileSync(entry, 'export {};\n', 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realpath 取刚写入的自建 fixture 真实路径
    const moduleUrl = pathToFileURL(realpathSync(entry)).href;
    // 以非规范形态（显式 `.` 段）传入入口参数，归一化后与模块侧同为真实文件
    withEntryArg(`${directory}${path.sep}.${path.sep}entry.ts`, () => {
      expect(isDirectInvocation(moduleUrl)).toBe(true);
    });
  });
});
