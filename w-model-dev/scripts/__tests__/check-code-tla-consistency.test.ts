/* eslint-disable security/detect-non-literal-fs-filename -- 夹具路径全部由 mkdtemp 自生成的临时目录派生（测试输入，非用户输入） */
/**
 * check-code-tla-consistency.test.ts —— D-3 装载基准对齐（2026-09-20 gate-contract-fixes）
 *
 * 背景：`check-tla-model.ts` 按 `basePath`（自身相对 manifest 文件所在目录）解析 `tlaPath`，
 * 而 `check-code-tla-consistency.ts` 原先只按 manifest 文件所在目录解析——同一份 manifest
 * 两门结论不一致，真实 8 阶段调测只能用 `<project>/.w-model/tla` 目录联结（junction）绕过。
 * 本测试锁定对齐后的口径，并锁定「规格文件不可读仍 fail-closed」不被回归掉。
 *
 * 纯函数测试：直接 import CLI 模块（模块尾部 isMain 守卫保证不触发 main），不启动子进程。
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadTlaContents } from '../cli/check-code-tla-consistency.js';
import type { TlaManifest } from '../logic/code-tla-logic.js';

describe('loadTlaContents 解析基准（D-3）', () => {
  it('basePath 存在时按 manifestDir + basePath + tlaPath 解析', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
    await fs.mkdir(path.join(root, 'tla'), { recursive: true });
    await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
    await fs.writeFile(path.join(root, 'tla', 'L2_x.tla'), '---- MODULE L2_x ----\n====\n');
    const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
    const manifest = {
      basePath: '..',
      specs: [{ id: 'L2_x', level: 'L2', tlaPath: 'tla/L2_x.tla' }],
    } as unknown as TlaManifest;
    await loadTlaContents(manifest, manifestPath);
    expect(manifest.specs[0]?.tlaContent).toContain('MODULE L2_x');
  });

  it('文件缺失仍 fail-closed（process.exit(2) 由 CLI 层承担，纯函数抛错）', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
    await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
    const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
    const manifest = {
      basePath: '..',
      specs: [{ id: 'L2_missing', level: 'L2', tlaPath: 'tla/none.tla' }],
    } as unknown as TlaManifest;
    await expect(loadTlaContents(manifest, manifestPath)).rejects.toThrow(/ENOENT|不可读/);
  });
});
