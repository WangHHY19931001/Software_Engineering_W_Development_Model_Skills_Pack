/**
 * vitest 三 project 拆分守护（config/vitest.config.ts 的 SUBPROCESS_TEST_FILES 约定）。
 *
 * 背景：仓库里会真实启动 CLI 子进程的测试文件（成员名单 = 配置里的 SUBPROCESS_TEST_FILES
 * 常量；2026-09-18 收口实测 40 个，拆分当时为 30 个）**彼此并行**会互抢资源
 * 产生偶发失败（docs/changes/vitest-parallel-flakiness-finding.md）。因此配置把测试拆为
 * unit-parallel（纯逻辑，并行）与 cli-serial-a / cli-serial-b（子进程类，fileParallelism:false
 * 组内串行；两组分属不同 project 组间并行，2026-09-29 Wave 2.3）三个 project，
 * 成员名单来自配置里的 SUBPROCESS_TEST_FILES 常量（按索引奇偶派生进 a/b 两组）。
 *
 * 本测试双向守护该清单，防止两类静默漂移：
 *   1. 新写了会 spawn 子进程的测试文件却没登记 → 它会落进 unit-parallel 并行跑，
 *      重新引入偶发失败（历史上约 1/3 的全量运行会红）。
 *   2. 文件不再 spawn 子进程却仍留在清单 → 它被无谓串行，拖慢全量。
 *
 * 判定口径与拆分时的人工核实一致：
 *   spawn 证据 = 真实 import node:child_process（含经 lib/run-sync 间接调用）
 *             或调用 runSync/execSync/spawnSync/execFile（名称后紧跟左括号的真实调用）；
 *             且未被 vi.mock 替换（经 vi.doUnmock 还原的除外，2026-09-28 T5：顶部
 *             mock 后逐用例 doUnmock 回真实模块，仍是真实 spawn，登记口径优先）。
 *             已知陷阱（口径收紧的由来）：
 *             正则的 .exec(（examples-contract）、仅在字符串常量里出现的模块名
 *             （dependency-boundaries）、以及 vi.mock 整体替换 child_process
 *             （artifact-gate-assets）都不是真实 spawn，不登记。
 *             已清（2026-09-28 Wave 2/T5）：run-sync.test.ts 顶部 vi.mock 使文件级判定
 *             为非 spawn，但其「terminates a real slow child」用例经 vi.doUnmock 真实
 *             spawn——已如实登记进 SUBPROCESS_TEST_FILES，判定口径补 doUnmock 例外后
 *             双向校验对它恢复双向生效（宁串行勿漏判）。
 *             注：doctor-logic 自 2026-09-18 起含真实 CLI 子进程用例（D1 回归），
 *             已登记，不再属「注释里的词」陷阱。
 * 本测试自身不真实启动任何子进程（纯 fs 读取），因此属于 unit-parallel 项目。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUBPROCESS_TEST_FILES } from '../../../config/vitest.config.js';

// 本文件位于 __tests__/ 下，dirname 即测试目录（与 run-sync.test.ts 同一 fileURLToPath 模式）
const TEST_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = resolve(TEST_DIR, '..', '..', '..');
const CONFIG_PATH = join(REPO_ROOT, 'config', 'vitest.config.ts');

/** 与配置文件头注释同一口径的 spawn 证据 */
function spawnEvidence(source: string): boolean {
  const realImport =
    /\bimport\b[^;'"]*from\s+['"]node:child_process['"]/.test(source) ||
    /require\(\s*['"]node:child_process['"]\s*\)/.test(source);
  const mocked = /vi\.mock\(\s*['"]node:child_process['"]/.test(source);
  // T5（2026-09-28）：vi.mock 后经 vi.doUnmock 还原的文件仍会真实 spawn（run-sync.test.ts
  // 的「terminates a real slow child」用例）——mocked 判定对 doUnmock 文件让位（宁串行勿漏判）。
  const doUnmocked = /vi\.doUnmock\(\s*['"]node:child_process['"]/.test(source);
  const called = /\b(?:runSync|execSync|spawnSync|execFile)\(/.test(source);
  return (realImport || called) && (!mocked || doUnmocked);
}

function listTests(): string[] {
  return readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts') && statSync(join(TEST_DIR, f)).isFile());
}

describe('vitest project 拆分：SUBPROCESS_TEST_FILES 双向守护', () => {
  it(
    '三个 project 存在且口径正确（cli-serial-a/b include 并集恰为清单且组内串行；' + 'unit-parallel 恰排除清单且并行）',
    async () => {
      const mod = (await import('../../../config/vitest.config.js')) as {
        default: {
          test: {
            projects: Array<{
              test: {
                name?: string;
                include?: string[];
                exclude?: string[];
                fileParallelism?: boolean;
              };
            }>;
          };
        };
      };
      const projects = mod.default.test.projects;
      expect(projects).toHaveLength(3);

      const unit = projects.find((p) => p.test.name === 'unit-parallel');
      const cliA = projects.find((p) => p.test.name === 'cli-serial-a');
      const cliB = projects.find((p) => p.test.name === 'cli-serial-b');
      expect(unit, 'unit-parallel project 缺失').toBeDefined();
      expect(cliA, 'cli-serial-a project 缺失').toBeDefined();
      expect(cliB, 'cli-serial-b project 缺失').toBeDefined();

      const expectGlobs = SUBPROCESS_TEST_FILES.map((f) => `w-model-dev/scripts/__tests__/${f}`);

      // a/b 的 include 并集 == 清单全集且互不重叠（配置按索引奇偶派生保证）。
      const allIncludes = [...cliA!.test.include!, ...cliB!.test.include!];
      expect(new Set(allIncludes).size, 'cli-serial-a/b include 不得重叠（并集大小必须等于两组合计条数）').toBe(
        allIncludes.length,
      );
      expect([...allIncludes].sort(), 'cli-serial-a/b include 并集必须恰为 SUBPROCESS_TEST_FILES 全集').toEqual(
        [...expectGlobs].sort(),
      );

      // 组内串行保留：两组均 fileParallelism:false（组间并行来自分属不同 project，不靠 workers）。
      for (const cli of [cliA, cliB]) {
        expect(
          cli!.test.fileParallelism,
          `${cli!.test.name} 必须 fileParallelism:false——组内串行互不重叠是本拆分的全部意义`,
        ).toBe(false);
      }

      // 显式断言「未被设为 false」：缺省即 true；写成 `?? true).toBe(true)` 会恒真（2026-09-17 审查修复）。
      expect(unit!.test.fileParallelism, 'unit-parallel 不得显式 fileParallelism:false').not.toBe(false);
      for (const g of expectGlobs) {
        expect(unit!.test.exclude, `unit-parallel 排除清单缺 ${g}`).toContain(g);
      }
      expect(unit!.test.exclude).toHaveLength(SUBPROCESS_TEST_FILES.length + 1); // + node_modules/**
    },
  );

  it('清单里的每个文件真实存在且确有 spawn 证据（无证据即应移除，避免无谓串行）', () => {
    const all = new Set(listTests());
    for (const f of SUBPROCESS_TEST_FILES) {
      expect(all.has(f), `${f} 不存在于 __tests__/（已改名或删除？请同步清单）`).toBe(true);
      const source = readFileSync(join(TEST_DIR, f), 'utf-8');
      expect(spawnEvidence(source), `${f} 在清单中但源码无 spawn 证据——应从清单移除`).toBe(true);
    }
  });

  it('双向校验：有 spawn 证据的测试文件都已登记；登记集合与证据集合精确相等', () => {
    const all = listTests();
    expect(all.length).toBeGreaterThan(50);

    const listed = new Set(SUBPROCESS_TEST_FILES);
    const missing: string[] = [];
    const stale: string[] = [];
    for (const f of all) {
      const spawns = spawnEvidence(readFileSync(join(TEST_DIR, f), 'utf-8'));
      if (spawns && !listed.has(f)) missing.push(f);
      if (!spawns && listed.has(f)) stale.push(f);
    }
    expect(
      missing,
      `以下文件会启动子进程但未登记 SUBPROCESS_TEST_FILES（将落进 unit-parallel 并行跑，重新引入偶发失败）：${missing.join(', ')}`,
    ).toEqual([]);
    expect(stale, `以下文件已无 spawn 证据却仍在清单（被无谓串行拖慢全量）：${stale.join(', ')}`).toEqual([]);
  });

  it('配置文件源码确实从 SUBPROCESS_TEST_FILES 派生三个 project（防绕过常量手写 glob）', () => {
    const source = readFileSync(CONFIG_PATH, 'utf-8');
    expect(source).toContain('SUBPROCESS_TEST_FILES');
    // 奇偶派生：a/b 两组均直接 filter 自常量（单一事实源不裂变），见 config 文件头 Wave 2.3 登记。
    expect(source).toMatch(
      /subprocessGlobsA\s*=\s*SUBPROCESS_TEST_FILES\.filter\(\s*\(\s*_\s*,\s*i\s*\)\s*=>\s*i\s*%\s*2\s*===\s*0/,
    );
    expect(source).toMatch(
      /subprocessGlobsB\s*=\s*SUBPROCESS_TEST_FILES\.filter\(\s*\(\s*_\s*,\s*i\s*\)\s*=>\s*i\s*%\s*2\s*===\s*1/,
    );
    expect(source).toMatch(/fileParallelism:\s*false/);
    expect(source).not.toMatch(/^\s*fileParallelism:\s*true/m);
  });
});
