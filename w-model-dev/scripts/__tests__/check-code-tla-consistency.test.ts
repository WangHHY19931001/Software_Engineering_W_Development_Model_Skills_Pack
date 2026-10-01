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
 * `config/vitest.config.ts` 的 SUBPROCESS_TEST_FILES（cli-serial-a / cli-serial-b
 * 组内串行、组间并行，2026-09-29 Wave 2.3 拆两组）。
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
  /**
   * 纯函数层双态（同流程：临时目录 fixture → loadTlaContents → 断言结论；仅数据/期望不同）：
   *   - 成功态：basePath 存在时按 manifestDir + basePath + tlaPath 解析，tlaContent 装载；
   *   - fail-closed 态：文件缺失抛 TlaSpecUnreadableError，cliError 四字段齐备且 file
   *     为按 basePath 解析后的绝对路径。CLI 层退出码契约由下方真实子进程用例单独钉住。
   */
  it('basePath 解析成功态 / 文件缺失 fail-closed 态（2 态，每迭代自备临时目录 fixture）', async () => {
    const rows: Array<{
      name: string;
      setup: (root: string) => Promise<TlaManifest>;
      check: (outcome: { thrown: unknown; loaded: TlaManifest | null; root: string }) => void;
    }> = [
      {
        name: 'basePath 存在时按 manifestDir + basePath + tlaPath 解析',
        setup: async (root) => {
          await fs.mkdir(path.join(root, 'tla'), { recursive: true });
          await fs.writeFile(path.join(root, 'tla', 'L2_x.tla'), '---- MODULE L2_x ----\n====\n');
          return {
            basePath: '..',
            specs: [{ id: 'L2_x', level: 'L2', tlaPath: 'tla/L2_x.tla' }],
          } as unknown as TlaManifest;
        },
        check: ({ loaded }) => {
          expect(loaded?.specs[0]?.tlaContent, '成功态：tlaContent 装载且含 MODULE L2_x').toContain('MODULE L2_x');
        },
      },
      {
        name: '文件缺失仍 fail-closed：抛 TlaSpecUnreadableError，cliError 四字段齐备且 file 为 basePath 解析后路径',
        setup: async () =>
          ({
            basePath: '..',
            specs: [{ id: 'L2_missing', level: 'L2', tlaPath: 'tla/none.tla' }],
          }) as unknown as TlaManifest,
        check: ({ thrown, root }) => {
          expect(thrown, 'fail-closed 态：应抛 TlaSpecUnreadableError').toBeInstanceOf(TlaSpecUnreadableError);
          const cliError = (thrown as TlaSpecUnreadableError).cliError;
          expect(cliError.category, 'cliError.category').toBe('FILE_NOT_FOUND');
          expect(cliError.rule, 'cliError.rule').toBe('D3/D4');
          expect(cliError.exitCode, 'cliError.exitCode').toBe(2);
          // file = manifestDir + basePath + tlaPath（即 <root>/tla/none.tla），不是 <root>/.w-model/tla/none.tla
          expect(cliError.file, 'cliError.file 为 basePath 解析后路径').toBe(path.resolve(root, 'tla', 'none.tla'));
          expect(cliError.message, 'cliError.message 含「不可读」').toContain('不可读');
        },
      },
    ];
    for (const row of rows) {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
      await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
      const manifest = await row.setup(root);
      const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
      let thrown: unknown = null;
      let loaded: TlaManifest | null = null;
      try {
        await loadTlaContents(manifest, manifestPath);
        loaded = manifest;
      } catch (e) {
        thrown = e;
      }
      row.check({ thrown, loaded, root });
      await fs.rm(root, { recursive: true, force: true });
    }
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

  it('批次3 verifiedArtifacts：三输入 JSON + .tla 登记（--json 单行报告键恒存在，path/sha256/bytes）', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-va-'));
    try {
      const manifestDir = path.join(root, '.w-model');
      const tlaDir = path.join(root, 'tla');
      const srcDir = path.join(root, 'src');
      await fs.mkdir(manifestDir, { recursive: true });
      await fs.mkdir(tlaDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });
      const manifestPath = path.join(manifestDir, 'tla-manifest.json');
      const graphPath = path.join(root, 'graph.json');
      const rtmPath = path.join(root, 'rtm.json');
      const tlaPath = path.join(tlaDir, 'L2_auth.tla');
      // 四维度全通过的 fixture：D1 前缀精确映射 + D2 赋值 + D3 register↔Register + D4 assert 覆盖
      const manifest = {
        // basePath 相对 manifestDir（.w-model）解析：'..' 指向项目根，tlaPath=tla/L2_auth.tla 落在 <root>/tla/
        basePath: '..',
        specs: [
          {
            id: 'L2_auth',
            level: 'L2',
            phase: 2,
            system: 'demo',
            requirementIds: ['REQ-001'],
            tlaPath: 'tla/L2_auth.tla',
            cfgPath: 'tla/L2_auth.cfg',
            parent: null,
            children: [],
          },
        ],
      };
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
      await fs.writeFile(graphPath, JSON.stringify({ nodes: [{ id: 'SD-AUTH', type: 'SD' }], edges: [] }));
      await fs.writeFile(
        rtmPath,
        JSON.stringify({ rows: [{ requirementId: 'REQ-001', codeModule: 'SD-AUTH:src/auth.ts:L1-2' }] }),
      );
      await fs.writeFile(
        tlaPath,
        [
          '---- MODULE L2_auth ----',
          'Next ==',
          '    \\/ Register',
          '',
          'BusinessInvariant ==',
          '    /\\ TypeInvariant',
          '====',
          '',
        ].join('\n'),
      );
      await fs.writeFile(
        path.join(srcDir, 'auth.ts'),
        [
          "let state = 'init';",
          'export function register(): void { state = "registered"; assert(state !== undefined); }',
          '',
        ].join('\n'),
      );

      const r = runSync(
        process.execPath,
        [
          tsxCli,
          CLI_PATH,
          `--manifest=${manifestPath}`,
          `--graph=${graphPath}`,
          `--rtm=${rtmPath}`,
          `--src=${srcDir}`,
          '--json',
        ],
        { timeout: 30_000 },
      );

      expect(r.status, `应全通过 exit 0（stdout=${String(r.stdout)}）`).toBe(0);
      const report = JSON.parse(String(r.stdout)) as {
        verifiedArtifacts?: Array<{ path: string; sha256: string; bytes: number }>;
      };
      // 键恒存在：三输入 JSON + loadTlaContents 成功读取的 .tla 文件均登记
      expect(Array.isArray(report.verifiedArtifacts)).toBe(true);
      const toRel = (abs: string): string => path.relative(process.cwd(), abs).replace(/\\/g, '/');
      const paths = (report.verifiedArtifacts ?? []).map((a) => a.path);
      expect(paths, 'manifest/graph/rtm 三输入 JSON 登记').toEqual(
        expect.arrayContaining([toRel(manifestPath), toRel(graphPath), toRel(rtmPath)]),
      );
      expect(paths, 'loadTlaContents 成功读取的 .tla 文件登记').toContain(toRel(tlaPath));
      expect(paths, 'cfg 文件未被读取、不入表').not.toContain(toRel(path.join(tlaDir, 'L2_auth.cfg')));
      for (const a of report.verifiedArtifacts ?? []) {
        expect(a.sha256, 'sha256 为 64 位十六进制字节摘要').toMatch(/^[0-9a-f]{64}$/);
        expect(typeof a.bytes).toBe('number');
        expect(a.bytes).toBeGreaterThan(0);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
