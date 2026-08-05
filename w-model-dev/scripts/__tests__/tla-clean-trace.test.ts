/**
 * check-tla-model.ts cleanTraceFiles / isTlcStatesDir 单元测试
 *
 * 覆盖（批次 1 安全加固 §3.2）：
 *  - 守卫 1：目录无 .tla 文件 → 不删除任何内容
 *  - 守卫 2：states/ 含 TLC 时间戳子目录 → 递归删除
 *  - 守卫 2：states/ 含 .st/.fp 指纹文件 → 递归删除
 *  - 守卫 2：states/ 无 TLC 特征（空或无关文件）→ 跳过不删
 *  - *.dump / *.out 文件仅在有 .tla 的目录删除
 */

import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cleanTraceFiles, isTlcStatesDir } from '../check-tla-model.js';

const tmpRoots: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-clean-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map(d => fs.rm(d, { recursive: true, force: true })));
});

describe('isTlcStatesDir', () => {
  it('含 TLC 时间戳子目录 → true', async () => {
    const dir = await makeTmpDir();
    await fs.mkdir(path.join(dir, '2026-08-05-10-30-00'));
    expect(await isTlcStatesDir(dir)).toBe(true);
  });

  it('含 .st 指纹文件 → true', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.st'), 'x');
    expect(await isTlcStatesDir(dir)).toBe(true);
  });

  it('空目录 → false', async () => {
    const dir = await makeTmpDir();
    expect(await isTlcStatesDir(dir)).toBe(false);
  });

  it('含无关文件（非 TLC 产物）→ false', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'README.md'), 'not tlc');
    expect(await isTlcStatesDir(dir)).toBe(false);
  });

  it('目录不存在 → false', async () => {
    expect(await isTlcStatesDir(path.join(os.tmpdir(), 'no-such-tlc-dir-xyz'))).toBe(false);
  });
});

describe('cleanTraceFiles', () => {
  it('目录无 .tla 文件 → 不删除任何内容（守卫 1）', async () => {
    const dir = await makeTmpDir();
    await fs.mkdir(path.join(dir, 'states'));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'keep');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted).toEqual([]);
    expect((await fs.readdir(dir)).sort()).toEqual(['notes.txt', 'states']);
  });

  it('含 .tla + states/ 为 TLC 时间戳产物 → 删除 states 与 *.dump/*.out', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
    await fs.mkdir(path.join(dir, 'states', '2026-08-05-10-30-00'), { recursive: true });
    await fs.writeFile(path.join(dir, 'states', '2026-08-05-10-30-00', 'L2-AuthService.st'), 'x');
    await fs.writeFile(path.join(dir, 'trace.dump'), 'x');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted.sort()).toEqual([
      path.join(dir, 'states'),
      path.join(dir, 'trace.dump'),
    ].sort());
    expect(await fs.readdir(dir)).toEqual(['L2-AuthService.tla']);
  });

  it('含 .tla + states/ 无 TLC 特征 → 跳过 states 不删，仅删 *.out（守卫 2）', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
    await fs.mkdir(path.join(dir, 'states'));
    await fs.writeFile(path.join(dir, 'states', 'business-data.txt'), 'keep');
    await fs.writeFile(path.join(dir, 'trace.out'), 'x');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted).toEqual([path.join(dir, 'trace.out')]);
    expect(await fs.readdir(path.join(dir, 'states'))).toEqual(['business-data.txt']);
  });
});
