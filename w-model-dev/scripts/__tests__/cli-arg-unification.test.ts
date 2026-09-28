/* eslint-disable security/detect-non-literal-fs-filename -- fixtures are created beneath test-owned temporary directories */
/**
 * cli-arg-unification.test.ts —— D3 CLI 参数统一端到端契约（2026-09-06 audit-fixes）
 *
 * 覆盖（F-G3-01/02/03/04 的 CLI 面）：
 *   - I-4 静默组：check-budget `--phase 99`（空格形态非法值）→ exit 2 ARG_INVALID（原静默 exit 0）
 *   - I-3 重复值 flag：check-budget / plan-chunks / ensure-codegraph / check-code-tla-consistency /
 *     check-artifact-gate 重复值 flag（任意形态）→ exit 2 ARG_INVALID「重复」（原 first/last-wins 放行；
 *     check-artifact-gate 条为 Task 9 修复轮 1 守护：进程内化 wrapper 曾把 DuplicateFlagError
 *     归入 UNEXPECTED，该条锁定 category 不退化）
 *   - I-5 结构门：check-state-machine-consistency 顶层非对象（数组/标量）→ exit 2 STRUCTURE_INVALID
 *     （原「全空合法图」exit 0 放行）；合法对象 → exit 0 不变
 *   - F-G3-04 分类对齐：check-tla-model 顶层非对象 → STRUCTURE_INVALID（原 ARG_INVALID「无法确定 phase」）
 *   - F-G3-02 拒绝组提示：check-preventive-review 裸 `--phase` → ARG_INVALID「仅支持等号形态」
 *
 * 全部经 runSync 包装（lib/run-sync.ts），不直接触碰 child_process。
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(TEST_DIR, '../cli');
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const VALID_BUDGET = path.resolve(REPO_ROOT, 'w-model-dev/scripts/samples/budget/valid.json');
const VALID_STATE_MACHINE = path.resolve(REPO_ROOT, 'w-model-dev/scripts/samples/state-machine/valid-consistent.json');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-cli-arg-d3-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function runCli(script: string, args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = runSync(process.execPath, [tsxCli, path.join(CLI_DIR, script), ...args], {
    timeout: 30_000,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function errorCategory(stdout: string): string | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  try {
    const parsed = JSON.parse(line.slice('ERROR_JSON '.length)) as { category?: string };
    return parsed.category ?? null;
  } catch {
    return null;
  }
}

describe('check-budget --phase 形态统一（D3/I-4）', () => {
  it('--phase 99（空格形态非法值）→ exit 2 且 stderr 含 --phase（原静默 exit 0）', () => {
    const r = runCli('check-budget.ts', [VALID_BUDGET, '--phase', '99']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('--phase');
  });

  it('--phase 3（空格形态合法值）→ exit 0（与等号形态等价）', () => {
    const r = runCli('check-budget.ts', [VALID_BUDGET, '--phase', '3']);
    expect(r.code).toBe(0);
  });

  it('--phase=1 --phase 2 重复（混合形态）→ exit 2 ARG_INVALID「重复」', () => {
    const r = runCli('check-budget.ts', [VALID_BUDGET, '--phase=1', '--phase', '2']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('重复');
  });
});

describe('check-state-machine-consistency 结构门（D3/I-5）', () => {
  it('顶层数组输入 → exit 2 STRUCTURE_INVALID（原「全空合法图」exit 0）', async () => {
    const f = path.join(tmpDir, 'array.json');
    await fs.writeFile(f, '[{"designStates":["a"]}]', 'utf-8');
    const r = runCli('check-state-machine-consistency.ts', [f]);
    expect(r.code).toBe(2);
    expect(errorCategory(r.stdout)).toBe('STRUCTURE_INVALID');
  });

  it('顶层标量输入 → exit 2 STRUCTURE_INVALID', async () => {
    const f = path.join(tmpDir, 'scalar.json');
    await fs.writeFile(f, '"just-a-string"', 'utf-8');
    const r = runCli('check-state-machine-consistency.ts', [f]);
    expect(r.code).toBe(2);
    expect(errorCategory(r.stdout)).toBe('STRUCTURE_INVALID');
  });

  it('顶层对象缺四数组字段 → exit 2 STRUCTURE_INVALID（字段形状门）', async () => {
    const f = path.join(tmpDir, 'wrong-fields.json');
    await fs.writeFile(f, '{"designStates":"not-an-array"}', 'utf-8');
    const r = runCli('check-state-machine-consistency.ts', [f]);
    expect(r.code).toBe(2);
    expect(errorCategory(r.stdout)).toBe('STRUCTURE_INVALID');
  });

  it('合法对象输入 → exit 0（行为不变）', () => {
    const r = runCli('check-state-machine-consistency.ts', [VALID_STATE_MACHINE]);
    expect(r.code).toBe(0);
  });
});

describe('check-tla-model 顶层分类对齐（F-G3-04）', () => {
  it('顶层非对象 manifest（未传 --phase）→ exit 2 STRUCTURE_INVALID（原 ARG_INVALID「无法确定 phase」）', async () => {
    const f = path.join(tmpDir, 'array-manifest.json');
    await fs.writeFile(f, '[{"specs":[]}]', 'utf-8');
    const r = runCli('check-tla-model.ts', [f]);
    expect(r.code).toBe(2);
    expect(errorCategory(r.stdout)).toBe('STRUCTURE_INVALID');
  });
});

describe('check-preventive-review 裸 --phase 提示（D3/I-4）', () => {
  it('裸 --phase → exit 2 且提示「--phase 仅支持等号形态 --phase=N」', () => {
    const r = runCli('check-preventive-review.ts', [tmpDir, '--phase']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('--phase 仅支持等号形态 --phase=N');
  });
});

describe('plan-chunks 重复 --phase（D3/I-3 + 报错值与生效值一致）', () => {
  it('--phase=1 --phase 9 重复 → exit 2「重复」（原 first-wins 放行）', async () => {
    const f = path.join(tmpDir, 'input.md');
    await fs.writeFile(f, '# A\\nbody', 'utf-8');
    const r = runCli('plan-chunks.ts', [f, '--phase=1', '--phase', '9', '--node-type=REQ']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('重复');
  });

  it('--phase=1 --phase=9 重复（同形态）→ exit 2「重复」', async () => {
    const f = path.join(tmpDir, 'input.md');
    await fs.writeFile(f, '# A\\nbody', 'utf-8');
    const r = runCli('plan-chunks.ts', [f, '--node-type=REQ', '--phase=1', '--phase=9']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('重复');
  });
});

describe('ensure-codegraph 重复 --phase（D3/I-3）', () => {
  it('--phase 5 --phase=6 重复 → exit 2「重复」（原等号 last-wins）', () => {
    const r = runCli('ensure-codegraph.ts', ['--phase', '5', '--phase=6', '--project-root', tmpDir, '--mode', 'light']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('重复');
  });

  it('重复 --mode → exit 2「重复」（原 last-wins）', () => {
    const r = runCli('ensure-codegraph.ts', [
      '--phase=5',
      '--project-root',
      tmpDir,
      '--mode',
      'light',
      '--mode',
      'quick',
    ]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('重复');
  });
});

describe('check-code-tla-consistency 重复值 flag（D3/I-3）', () => {
  it('重复 --manifest → exit 2 ARG_INVALID「重复」（原 first-wins 后续 FILE_NOT_FOUND）', () => {
    const r = runCli('check-code-tla-consistency.ts', [
      '--manifest=a.json',
      '--manifest=b.json',
      '--graph=g.json',
      '--rtm=r.json',
      '--src=.',
    ]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('重复');
  });
});

describe('check-artifact-gate 重复值 flag（D3/I-3，Task 9 修复轮 1 守护）', () => {
  // 守护进程内化 wrapper 的 DuplicateFlagError 分支：parseTicketsArg 的 parseFlagValue
  // 对重复 --tickets= 直抛（check-artifact-gate.ts 4 处直抛点之一）。修复前该异常被
  // main wrapper 归入 UNEXPECTED「脚本异常」（category 退化，违反 D3/I-3 契约）；
  // 修复后与 runMain.catch 一致转 ARG_INVALID。真实子进程形态同样经 wrapper（runMain
  // 调 main），本探针同时守护两形态的 ERROR_JSON.category。
  it('重复 --tickets → exit 2 且 ERROR_JSON.category=ARG_INVALID「重复」（非 UNEXPECTED）', () => {
    const r = runCli('check-artifact-gate.ts', ['--tickets=a.md', '--tickets=b.md']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('ARG_INVALID');
    expect(r.stderr).toContain('重复');
    expect(errorCategory(r.stdout)).toBe('ARG_INVALID');
  });
});
