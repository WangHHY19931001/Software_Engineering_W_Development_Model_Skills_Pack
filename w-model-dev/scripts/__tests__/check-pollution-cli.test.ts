/* eslint-disable security/detect-non-literal-fs-filename -- fixture 项目目录均位于本测试拥有的 os.tmpdir() 临时目录 */
/**
 * check-pollution CLI 契约测试（S24 污染源二分定位，按需工具）。
 *
 * 覆盖（P5 计划 §0.1.1/§0.1.2 行为契约，逐条强制）：
 *   - 干净目录 → exit 0 + stdout 单行 `POLLUTION_JSON` 摘要（passed=true，findings 空）；
 *   - 四类污染形态（`.w-model/*.lock` 陈旧锁目录、`*.lock` 锁文件、`coverage/` 残留
 *     （含 `coverage/.tmp`）、vitest 语义 `--outputFile` JSON 残留）各自 → exit 1 且逐项列出；
 *     混合形态 → 全部逐项列出（逐文件「吞掉测试失败只看产物」痕迹清单）；
 *   - 未知 flag（`--d4-invalid-argument`）→ exit 2 + stdout ERROR_JSON + 零副作用
 *     （项目目录快照逐字节不变，且无 POLLUTION_JSON 输出）；
 *   - 重复 / 裸（空格形态）/ 空值 `--project`、不存在目录、多余位置参数 → exit 2；
 *   - `--project` 缺省 → 取 cwd（临时干净目录内运行 exit 0）。
 *
 * 判据纯函数直接对 logic/pollution-logic.ts 断言（不 spawn CLI）。
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。**不 spawn 全量 vitest**（P5 计划 §0.1.2：只测判据
 * 逻辑与临时目录污染形态；vitest 行为本身由仓库自身测试套覆盖）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';
import {
  PRUNED_DIR_NAMES,
  classifyRelativeEntry,
  isVitestOutputResidueName,
  shouldPruneDir,
  type PollutionFinding,
} from '../logic/pollution-logic.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'w-model-dev', 'scripts', 'cli', 'check-pollution.ts');

let tmpDir: string;
let projectDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'check-pollution-cli-'));
  projectDir = path.join(tmpDir, 'project');
  await fs.mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/**
 * 真实 tsx 子进程运行被测 CLI。60s 超时理由同 review-package-cli.test.ts：
 * 全量并行时 tsx 冷启动可超 runSync 缺省 15s（spawnSync 报 status:null）。
 */
function runCheckPollution(
  args: string[],
  cwd: string = REPO_ROOT,
): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], { cwd, timeout: 60_000 });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function errorJson(stdout: string): Record<string, unknown> | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  return JSON.parse(line.slice('ERROR_JSON '.length)) as Record<string, unknown>;
}

function pollutionJson(stdout: string): Record<string, unknown> | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('POLLUTION_JSON '));
  if (line === undefined) return null;
  return JSON.parse(line.slice('POLLUTION_JSON '.length)) as Record<string, unknown>;
}

/** 递归快照目录（相对 POSIX 路径 → `dir` / `file:<内容>`），用于 exit-2 零副作用断言 */
async function snapshotTree(root: string): Promise<Record<string, string>> {
  const entries = new Map<string, string>();
  async function walk(rel: string): Promise<void> {
    const abs = path.join(root, rel);
    for (const dirent of await fs.readdir(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? dirent.name : `${rel}/${dirent.name}`;
      if (dirent.isDirectory()) {
        entries.set(childRel, 'dir');
        await walk(childRel);
      } else {
        entries.set(childRel, `file:${await fs.readFile(path.join(root, childRel), 'utf8')}`);
      }
    }
  }
  await walk('');
  return Object.fromEntries(entries);
}

/** 在临时项目里造一个文件（含父目录） */
async function putFile(relPath: string, content: string): Promise<void> {
  const abs = path.join(projectDir, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

describe('check-pollution CLI（S24 污染源定位，按需工具）', () => {
  it('干净目录 → exit 0 + 单行 POLLUTION_JSON（passed=true，findings 空）', async () => {
    await putFile('src/index.ts', 'export {};\n');
    await fs.mkdir(path.join(projectDir, '.w-model'), { recursive: true });
    await putFile('.w-model/project.json', '{}\n'); // .w-model 本身存在不是污染，仅 *.lock 残留是

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code, `stderr=${run.stderr}`).toBe(0);
    const outLines = run.stdout.trim().split(/\r?\n/);
    expect(outLines).toHaveLength(1);
    expect(outLines[0]).toContain('POLLUTION_JSON ');
    const payload = JSON.parse(outLines[0]!.replace('POLLUTION_JSON ', '')) as Record<string, unknown>;
    expect(payload).toMatchObject({ type: 'pollution', passed: true, findingCount: 0, exitCode: 0 });
    expect(payload.project).toBe(projectDir);
    expect(payload.findings).toEqual([]);
  });

  it('--project 缺省 → 取 cwd（干净临时目录内运行 exit 0）', async () => {
    const run = runCheckPollution([], projectDir);
    expect(run.code, `stderr=${run.stderr}`).toBe(0);
    const payload = pollutionJson(run.stdout) as Record<string, unknown>;
    expect(payload).toMatchObject({ passed: true, exitCode: 0 });
    expect(payload.project).toBe(projectDir);
  });

  it('.w-model/*.lock 陈旧锁目录残留 → exit 1 且列出 kind=stale-lock-dir', async () => {
    await fs.mkdir(path.join(projectDir, '.w-model', 'project.json.lock'), { recursive: true });
    await putFile('.w-model/project.json.lock/owner.json', '{}\n'); // 锁目录内可有 owner 对象文件，本体目录已列

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code).toBe(1);
    const payload = pollutionJson(run.stdout) as { passed: boolean; findings: PollutionFinding[]; exitCode: number };
    expect(payload.exitCode).toBe(1);
    expect(payload.passed).toBe(false);
    const stale = payload.findings.filter((f) => f.kind === 'stale-lock-dir');
    expect(stale.length).toBeGreaterThanOrEqual(1);
    expect(stale.some((f) => f.path === '.w-model/project.json.lock')).toBe(true);
  });

  it('*.lock 锁文件残留（含深层）→ exit 1 且列出 kind=lock-file', async () => {
    await putFile('stray.lock', 'owner\n');
    await putFile('sub/dir/inner.lock', 'x\n');

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code).toBe(1);
    const payload = pollutionJson(run.stdout) as { findings: PollutionFinding[] };
    const locks = payload.findings.filter((f) => f.kind === 'lock-file');
    expect(locks.map((f) => f.path).sort()).toEqual(['stray.lock', 'sub/dir/inner.lock']);
  });

  it('coverage/ 残留（含 coverage/.tmp）→ exit 1 且列出 kind=coverage-residue', async () => {
    await fs.mkdir(path.join(projectDir, 'coverage', '.tmp'), { recursive: true });
    await putFile('coverage/lcov.info', 'TN:\n');

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code).toBe(1);
    const payload = pollutionJson(run.stdout) as { findings: PollutionFinding[] };
    const cov = payload.findings.filter((f) => f.kind === 'coverage-residue');
    expect(cov).toHaveLength(1);
    expect(cov[0]!.path).toBe('coverage/');
    // 语义：含 .tmp 子目录在内的全部 coverage 内容按一条残留列出（理由行提及 .tmp）
    expect(cov[0]!.reason).toContain('.tmp');
  });

  it('vitest 语义 --outputFile JSON 残留 → exit 1 且列出 kind=vitest-output-residue', async () => {
    await putFile('vitest-results.json', '{"success":false}\n');
    await putFile('test-results.json', '{"success":true}\n');

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code).toBe(1);
    const payload = pollutionJson(run.stdout) as { findings: PollutionFinding[] };
    const residues = payload.findings.filter((f) => f.kind === 'vitest-output-residue');
    expect(residues.map((f) => f.path).sort()).toEqual(['test-results.json', 'vitest-results.json']);
  });

  it('混合污染 → exit 1 且四类逐项全部列出（findingCount 计数正确）', async () => {
    await fs.mkdir(path.join(projectDir, '.w-model', 'rtm.json.lock'), { recursive: true });
    await putFile('budget.lock', 'owner\n');
    await fs.mkdir(path.join(projectDir, 'coverage'), { recursive: true });
    await putFile('vitest-results.json', '{}\n');

    const run = runCheckPollution([`--project=${projectDir}`]);

    expect(run.code).toBe(1);
    const payload = pollutionJson(run.stdout) as { findings: PollutionFinding[]; findingCount: number };
    const kinds = new Set(payload.findings.map((f) => f.kind));
    expect(kinds).toEqual(new Set(['stale-lock-dir', 'lock-file', 'coverage-residue', 'vitest-output-residue']));
    expect(payload.findings).toHaveLength(4);
    expect(payload.findingCount).toBe(4);
    // 逐项列出：每个 finding 单独一行人类可读输出（✗ 前缀）
    const plainLines = run.stdout.split(/\r?\n/).filter((l) => l.startsWith('✗ '));
    expect(plainLines).toHaveLength(4);
  });

  it('未知 flag（--d4-invalid-argument）→ exit 2 + ERROR_JSON 且项目目录零副作用、无 POLLUTION_JSON 输出', async () => {
    await fs.mkdir(path.join(projectDir, '.w-model', 'project.json.lock'), { recursive: true });
    const before = await snapshotTree(projectDir);

    const run = runCheckPollution([`--project=${projectDir}`, '--d4-invalid-argument']);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('✗ [ARG_INVALID]');
    expect(errorJson(run.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
    expect(run.stdout).not.toContain('POLLUTION_JSON');
    expect(await snapshotTree(projectDir)).toEqual(before); // 非法输入在任何扫描/写盘之前拒绝（本工具本身只读）
  });

  it('重复 flag（--project 两次）→ exit 2 ARG_INVALID「重复」', async () => {
    const run = runCheckPollution([`--project=${projectDir}`, `--project=${tmpDir}`]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('ARG_INVALID');
    expect(errorJson(run.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
  });

  it('--project 不存在 / 空值 / 裸 --project（空格形态）→ exit 2', async () => {
    const missing = runCheckPollution([`--project=${path.join(tmpDir, 'no-such-project')}`]);
    expect(missing.code).toBe(2);
    expect(errorJson(missing.stdout)).toMatchObject({ exitCode: 2 });

    const empty = runCheckPollution(['--project=']);
    expect(empty.code).toBe(2);
    expect(errorJson(empty.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });

    const bare = runCheckPollution(['--project', projectDir]);
    expect(bare.code).toBe(2);
    expect(bare.stderr).toContain('ARG_INVALID');
  });

  it('多余位置参数 → exit 2 ARG_INVALID（本 CLI 只接受 flag 形态）', async () => {
    const run = runCheckPollution([projectDir]);
    expect(run.code).toBe(2);
    expect(errorJson(run.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
  });
});

describe('pollution-logic 判据纯函数', () => {
  it('classifyRelativeEntry 四类判定与放行', () => {
    // .w-model/ 子树内 *.lock → 陈旧锁残留（目录/文件同判）
    expect(classifyRelativeEntry('.w-model/project.json.lock')?.kind).toBe('stale-lock-dir');
    expect(classifyRelativeEntry('.w-model/nested/deep.lock')?.kind).toBe('stale-lock-dir');
    // .w-model 正常状态文件不是污染
    expect(classifyRelativeEntry('.w-model/project.json')).toBeNull();
    expect(classifyRelativeEntry('.w-model/run-log.jsonl')).toBeNull();
    // 其余 *.lock → 锁文件残留
    expect(classifyRelativeEntry('stray.lock')?.kind).toBe('lock-file');
    expect(classifyRelativeEntry('sub/dir/inner.lock')?.kind).toBe('lock-file');
    // package-lock.json / *.json 不匹配 *.lock
    expect(classifyRelativeEntry('package-lock.json')).toBeNull();
    // coverage/ 目录残留
    expect(classifyRelativeEntry('coverage')?.kind).toBe('coverage-residue');
    expect(classifyRelativeEntry('coverage/.tmp')?.kind).toBe('coverage-residue');
    // 项目嵌套的 coverage 目录不在判据内（仅项目根 depth-1）
    expect(classifyRelativeEntry('src/coverage')).toBeNull();
    // vitest 语义输出残留（仅 depth-1；判据按文件名白名单）
    expect(classifyRelativeEntry('vitest-results.json')?.kind).toBe('vitest-output-residue');
    expect(classifyRelativeEntry('vitest.report.json')?.kind).toBe('vitest-output-residue');
    expect(classifyRelativeEntry('test-results.json')?.kind).toBe('vitest-output-residue');
    expect(classifyRelativeEntry('test-results-2026-09-16.json')?.kind).toBe('vitest-output-residue');
    expect(classifyRelativeEntry('nested/vitest-results.json')).toBeNull(); // 非 depth-1 不判
    expect(classifyRelativeEntry('tsconfig.json')).toBeNull();
    expect(classifyRelativeEntry('src/index.ts')).toBeNull();
  });

  it('isVitestOutputResidueName 名称白名单边界', () => {
    expect(isVitestOutputResidueName('vitest-results.json')).toBe(true);
    expect(isVitestOutputResidueName('vitest.json')).toBe(true);
    expect(isVitestOutputResidueName('vitest-report.json')).toBe(true);
    expect(isVitestOutputResidueName('test-results.json')).toBe(true);
    expect(isVitestOutputResidueName('test-result.json')).toBe(true);
    expect(isVitestOutputResidueName('test-results-unit.json')).toBe(true);
    expect(isVitestOutputResidueName('vitest-results.txt')).toBe(false);
    expect(isVitestOutputResidueName('my-vitest-results.json')).toBe(false);
    expect(isVitestOutputResidueName('package.json')).toBe(false);
    expect(isVitestOutputResidueName('coverage.json')).toBe(false);
  });

  it('shouldPruneDir 剪除 node_modules 与 .git（目录名精确匹配）', () => {
    expect(PRUNED_DIR_NAMES).toEqual(['.git', 'node_modules']);
    expect(shouldPruneDir('node_modules')).toBe(true);
    expect(shouldPruneDir('.git')).toBe(true);
    expect(shouldPruneDir('.github')).toBe(false);
    expect(shouldPruneDir('src')).toBe(false);
    expect(shouldPruneDir('my-node_modules')).toBe(false);
  });
});
