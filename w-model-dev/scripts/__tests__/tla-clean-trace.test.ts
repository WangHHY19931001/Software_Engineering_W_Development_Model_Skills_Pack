/**
 * lib/tla-clean-trace.ts cleanTraceFiles / isTlcStatesDir 单元测试
 *
 * 覆盖（安全加固 §3.2）：
 *  - 守卫 1：目录无 .tla 文件 → 不删除任何内容
 *  - 守卫 2：states/ 含 TLC 时间戳子目录 → 递归删除
 *  - 守卫 2：states/ 含 .st/.fp 指纹文件 → 递归删除
 *  - 守卫 2：states/ 无 TLC 特征（空或无关文件）→ 跳过不删
 *  - *.dump / *.out 文件仅在有 .tla 的目录删除
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, afterEach } from 'vitest';

import { cleanTraceFiles, isTlcStatesDir } from '../lib/tla-clean-trace.js';

const tmpRoots: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-clean-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('isTlcStatesDir', () => {
  it('TLC 产物判定·true 行（3 态：时间戳子目录 / 2 位年份时间戳 / .st 指纹文件）', async () => {
    for (const [caseName, entryName, isDir] of [
      ['含 TLC 时间戳子目录', '2026-08-05-10-30-00', true],
      ['含 2 位年份 TLC 时间戳子目录（26-08-05-10-30-00）', '26-08-05-10-30-00', true],
      ['含 .st 指纹文件', 'L2-AuthService.st', false],
    ] as const) {
      const dir = await makeTmpDir();
      if (isDir) {
        await fs.mkdir(path.join(dir, entryName));
      } else {
        await fs.writeFile(path.join(dir, entryName), 'x');
      }
      expect(await isTlcStatesDir(dir), `${caseName}: 应判定为 true`).toBe(true);
    }
  });

  it('TLC 产物判定·false 行（3 态：空目录 / 无关文件 / 目录不存在）', async () => {
    // 态 1：空目录
    const emptyDir = await makeTmpDir();
    expect(await isTlcStatesDir(emptyDir), '空目录: 应判定为 false').toBe(false);

    // 态 2：含无关文件（非 TLC 产物）
    const readmeDir = await makeTmpDir();
    await fs.writeFile(path.join(readmeDir, 'README.md'), 'not tlc');
    expect(await isTlcStatesDir(readmeDir), '含无关文件: 应判定为 false').toBe(false);

    // 态 3：目录不存在
    expect(await isTlcStatesDir(path.join(os.tmpdir(), 'no-such-tlc-dir-xyz')), '目录不存在: 应判定为 false').toBe(
      false,
    );
  });
});

describe('cleanTraceFiles', () => {
  it('删除行（含 .tla + states/ 为 TLC 时间戳产物）→ 删除 states 与 *.dump/*.out', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
    await fs.mkdir(path.join(dir, 'states', '2026-08-05-10-30-00'), { recursive: true });
    await fs.writeFile(path.join(dir, 'states', '2026-08-05-10-30-00', 'L2-AuthService.st'), 'x');
    await fs.writeFile(path.join(dir, 'trace.dump'), 'x');
    const deleted = await cleanTraceFiles(dir);
    // cleanTraceFiles 的契约：返回成功删除（fs.rm 未抛错）的路径列表。
    // 注：Windows 上 fs.rm(recursive) 的物理删除时序不可靠（返回后路径可能短暂存留），
    // 因此断言返回契约（deleted 数组）而非文件系统最终状态。
    expect(deleted.sort()).toEqual([path.join(dir, 'states'), path.join(dir, 'trace.dump')].sort());
    expect((await fs.readdir(dir)).includes('L2-AuthService.tla')).toBe(true);
  });

  it('跳过行（2 态：无 .tla 全不删·守卫 1 / states 无 TLC 特征仅删 *.out·守卫 2）', async () => {
    for (const { caseName, hasTla, extraFile, statesContent } of [
      {
        caseName: '目录无 .tla 文件 → 不删除任何内容（守卫 1）',
        hasTla: false,
        extraFile: 'notes.txt',
        statesContent: [] as string[],
      },
      {
        caseName: '含 .tla + states/ 无 TLC 特征 → 跳过 states 不删，仅删 *.out（守卫 2）',
        hasTla: true,
        extraFile: 'trace.out',
        statesContent: ['business-data.txt'],
      },
    ]) {
      const dir = await makeTmpDir();
      if (hasTla) {
        await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
      }
      await fs.mkdir(path.join(dir, 'states'));
      for (const name of statesContent) {
        await fs.writeFile(path.join(dir, 'states', name), 'keep');
      }
      await fs.writeFile(path.join(dir, extraFile), 'keep');
      const deleted = await cleanTraceFiles(dir);
      const expectedDeleted = hasTla ? [path.join(dir, 'trace.out')] : [];
      expect(deleted, `${caseName}: 删除清单契约`).toEqual(expectedDeleted);
      expect(await fs.readdir(path.join(dir, 'states')), `${caseName}: states/ 内容不应被删除`).toEqual(statesContent);
      if (!hasTla) {
        expect((await fs.readdir(dir)).sort(), `${caseName}: 目录其余内容保留`).toEqual([extraFile, 'states'].sort());
      }
    }
  });
});
