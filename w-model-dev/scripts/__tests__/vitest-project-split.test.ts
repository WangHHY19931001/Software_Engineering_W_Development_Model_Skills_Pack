/**
 * vitest 双 project 拆分守护（config/vitest.config.ts 的 SUBPROCESS_TEST_FILES 约定）。
 *
 * 背景：仓库 30 个测试文件会真实启动 CLI 子进程，子进程类文件**彼此并行**会互抢资源
 * 产生偶发失败（docs/changes/vitest-parallel-flakiness-finding.md）。因此配置把测试拆为
 * unit-parallel（纯逻辑，并行）与 cli-serial（子进程类，fileParallelism:false）两个 project，
 * 成员名单来自配置里的 SUBPROCESS_TEST_FILES 常量。
 *
 * 本测试双向守护该清单，防止两类静默漂移：
 *   1. 新写了会 spawn 子进程的测试文件却没登记 → 它会落进 unit-parallel 并行跑，
 *      重新引入偶发失败（历史上约 1/3 的全量运行会红）。
 *   2. 文件不再 spawn 子进程却仍留在清单 → 它被无谓串行，拖慢全量。
 *
 * 判定口径与拆分时的人工核实一致：
 *   spawn 证据 = 真实 import node:child_process（含经 lib/run-sync 间接调用）
 *             或调用 runSync/execSync/spawnSync/execFile（名称后紧跟左括号的真实调用）；
 *             且未被 vi.mock 替换。三个已知陷阱都曾真实发生，故口径收紧：
 *             注释里的词（doctor-logic 的"无真实 execFile 调用"）、正则的 .exec(
 *             （examples-contract）、以及 vi.mock 整体替换 child_process
 *             （artifact-gate-assets、run-sync）都不是真实 spawn。
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
  const called = /\b(?:runSync|execSync|spawnSync|execFile)\(/.test(source);
  return (realImport || called) && !mocked;
}

function listTests(): string[] {
  return readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts') && statSync(join(TEST_DIR, f)).isFile());
}

describe('vitest project 拆分：SUBPROCESS_TEST_FILES 双向守护', () => {
  it('两个 project 存在且口径正确（cli-serial include 恰为清单且串行；unit-parallel 恰排除清单且并行）', async () => {
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
    expect(projects).toHaveLength(2);

    const unit = projects.find((p) => p.test.name === 'unit-parallel');
    const cli = projects.find((p) => p.test.name === 'cli-serial');
    expect(unit, 'unit-parallel project 缺失').toBeDefined();
    expect(cli, 'cli-serial project 缺失').toBeDefined();

    const expectGlobs = SUBPROCESS_TEST_FILES.map((f) => `w-model-dev/scripts/__tests__/${f}`);
    expect(cli!.test.include).toEqual(expectGlobs);
    expect(cli!.test.fileParallelism, 'cli-serial 必须 fileParallelism:false——子进程类互不重叠是本拆分的全部意义').toBe(
      false,
    );
    expect(unit!.test.fileParallelism ?? true, 'unit-parallel 应保持并行').toBe(true);
    for (const g of expectGlobs) {
      expect(unit!.test.exclude, `unit-parallel 排除清单缺 ${g}`).toContain(g);
    }
    expect(unit!.test.exclude).toHaveLength(SUBPROCESS_TEST_FILES.length + 1); // + node_modules/**
  });

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

  it('配置文件源码确实从 SUBPROCESS_TEST_FILES 派生两个 project（防绕过常量手写 glob）', () => {
    const source = readFileSync(CONFIG_PATH, 'utf-8');
    expect(source).toContain('SUBPROCESS_TEST_FILES');
    expect(source).toMatch(/subprocessGlobs\s*=\s*SUBPROCESS_TEST_FILES\.map/);
    expect(source).toMatch(/fileParallelism:\s*false/);
    expect(source).not.toMatch(/^\s*fileParallelism:\s*true/m);
  });
});
