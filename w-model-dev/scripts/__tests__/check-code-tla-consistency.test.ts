/* eslint-disable security/detect-non-literal-fs-filename -- 夹具路径全部由 mkdtemp 自生成的临时目录派生（测试输入，非用户输入） */
/**
 * check-code-tla-consistency.test.ts —— D-3 装载基准对齐（2026-09-20 gate-contract-fixes，修复轮 1）
 *
 * 背景：`check-tla-model.ts` 按 `basePath`（自身相对 manifest 文件所在目录）解析 `tlaPath`，
 * 而 `check-code-tla-consistency.ts` 原先只按 manifest 文件所在目录解析——同一份 manifest
 * 两门结论不一致，真实 8 阶段调测只能用 `<project>/.w-model/tla` 目录联结（junction）绕过。
 *
 * 覆盖（三条，锁的是「装载基准」与「装载失败时的 fail-closed 契约」两件事）：
 *   1. 解析基准：`resolve(manifestDir, basePath, tlaPath)`，与 check-tla-model 同口径。
 *   2. 纯函数层失败载荷：抛 `TlaSpecUnreadableError`，其 `cliError` 四字段（category/rule/exitCode/file）
 *      齐备且 `file` 为**按 basePath 解析后**的绝对路径——CLI 层输出与退出码全部由该载荷决定。
 *   3. CLI 层真实子进程：`--manifest` 指向 basePath 形态 manifest + 缺失 `.tla` → **exit 2**，
 *      stdout `ERROR_JSON.file` 为解析后路径。**这条是 `main()` 里 `exitWithError + return` 的守卫**：
 *      只 catch 不 return（如 `.catch(exitWithError)` 形态）时纯函数用例仍全绿，而 CLI 会继续算出
 *      passed 并把退出码覆盖回 0/1——即本任务要消灭的失效模式。故必须真实跑 CLI，不用 mock、
 *      不直接调用 main。
 *
 * 本文件含真实子进程（经 lib/run-sync.ts 的 runSync（见用例 3）），故已登记进
 * `config/vitest.config.ts` 的 SUBPROCESS_TEST_FILES（cli-serial 项目串行执行）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadTlaContents, TlaSpecUnreadableError } from '../cli/check-code-tla-consistency.js';
import { runSync } from '../lib/run-sync.js';
import type { TlaManifest } from '../logic/code-tla-logic.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TEST_DIR, '../cli/check-code-tla-consistency.ts');

/** stdout 末尾的机器可读错误摘要（`ERROR_JSON {...}` 单行）→ 解析后的对象；缺失/坏 JSON 返回 null。 */
function parseErrorJson(stdout: string): {
  category?: string;
  rule?: string;
  exitCode?: number;
  file?: string;
} | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  try {
    return JSON.parse(line.slice('ERROR_JSON '.length)) as { category?: string; rule?: string };
  } catch {
    return null;
  }
}

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

  it('文件缺失仍 fail-closed：抛 TlaSpecUnreadableError，cliError 四字段齐备且 file 为 basePath 解析后路径', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
    await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
    const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
    const manifest = {
      basePath: '..',
      specs: [{ id: 'L2_missing', level: 'L2', tlaPath: 'tla/none.tla' }],
    } as unknown as TlaManifest;

    const caught = await loadTlaContents(manifest, manifestPath).then(
      () => null,
      (e: unknown) => e,
    );

    expect(caught).toBeInstanceOf(TlaSpecUnreadableError);
    const cliError = (caught as TlaSpecUnreadableError).cliError;
    expect(cliError.category).toBe('FILE_NOT_FOUND');
    expect(cliError.rule).toBe('D3/D4');
    expect(cliError.exitCode).toBe(2);
    // file = manifestDir + basePath + tlaPath（即 <root>/tla/none.tla），不是 <root>/.w-model/tla/none.tla
    expect(cliError.file).toBe(path.resolve(root, 'tla', 'none.tla'));
    expect(cliError.message).toContain('不可读');
  });

  it('CLI 真实子进程：规格文件缺失 → exit 2，ERROR_JSON.file 为 basePath 解析后路径（守卫 main 的 exitWithError + return）', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-cli-'));
    const manifestDir = path.join(root, '.w-model');
    await fs.mkdir(manifestDir, { recursive: true });
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    const manifestPath = path.join(manifestDir, 'tla-manifest.json');
    const graphPath = path.join(root, 'graph.json');
    const rtmPath = path.join(root, 'rtm.json');
    // basePath 形态 manifest（`..` 指向项目根，tlaPath 相对 basePath）；`tla/missing.tla` 故意不创建
    await fs.writeFile(
      manifestPath,
      JSON.stringify({ basePath: '..', specs: [{ id: 'L2_missing', level: 'L2', tlaPath: 'tla/missing.tla' }] }),
    );
    await fs.writeFile(graphPath, JSON.stringify({ nodes: [], edges: [] }));
    await fs.writeFile(rtmPath, JSON.stringify({ rows: [] }));

    const r = runSync(
      process.execPath,
      [
        tsxCli,
        CLI_PATH,
        `--manifest=${manifestPath}`,
        `--graph=${graphPath}`,
        `--rtm=${rtmPath}`,
        `--src=${path.join(root, 'src')}`,
      ],
      { timeout: 30_000 },
    );

    // 退出码不许回落 0/1：只有 exit 2 才证明 main() 走了 exitWithError 而非继续算 passed
    expect(r.status).toBe(2);
    const errorJson = parseErrorJson(r.stdout ?? '');
    expect(errorJson).not.toBeNull();
    expect(errorJson?.category).toBe('FILE_NOT_FOUND');
    expect(errorJson?.rule).toBe('D3/D4');
    expect(errorJson?.exitCode).toBe(2);
    expect(errorJson?.file).toBe(path.resolve(root, 'tla', 'missing.tla'));
    expect(String(r.stderr)).toContain('不可读');
  });
});
