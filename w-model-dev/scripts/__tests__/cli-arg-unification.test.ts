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
  it('顶层非对象输入 → exit 2 STRUCTURE_INVALID（4 态：数组 / 标量 / 缺字段对象 / check-tla-model 非对象）', async () => {
    for (const [形状名, script, fileName, content] of [
      [
        '顶层数组输入（原「全空合法图」exit 0）',
        'check-state-machine-consistency.ts',
        'array.json',
        '[{"designStates":["a"]}]',
      ],
      ['顶层标量输入', 'check-state-machine-consistency.ts', 'scalar.json', '"just-a-string"'],
      [
        '顶层对象缺四数组字段（字段形状门）',
        'check-state-machine-consistency.ts',
        'wrong-fields.json',
        '{"designStates":"not-an-array"}',
      ],
      [
        'check-tla-model 顶层非对象 manifest（未传 --phase，原 ARG_INVALID「无法确定 phase」）',
        'check-tla-model.ts',
        'array-manifest.json',
        '[{"specs":[]}]',
      ],
    ] as const) {
      const f = path.join(tmpDir, fileName);
      await fs.writeFile(f, content, 'utf-8');
      const r = runCli(script, [f]);
      expect(r.code, `${形状名}: 应 exit 2`).toBe(2);
      expect(errorCategory(r.stdout), `${形状名}: ERROR_JSON.category 应为 STRUCTURE_INVALID`).toBe(
        'STRUCTURE_INVALID',
      );
    }
  }, 150_000);

  it('合法对象输入 → exit 0（行为不变）', () => {
    const r = runCli('check-state-machine-consistency.ts', [VALID_STATE_MACHINE]);
    expect(r.code).toBe(0);
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

describe('重复值 flag 统一（D3/I-3：六形态跨 CLI，报错值与生效值一致；Task 9 修复轮 1 守护）', () => {
  // 守护进程内化 wrapper 的 DuplicateFlagError 分支：check-artifact-gate 行锁定 category
  // 不退化（修复前 parseTicketsArg 的 DuplicateFlagError 被 main wrapper 归入 UNEXPECTED
  // 「脚本异常」，违反 D3/I-3 契约；修复后与 runMain.catch 一致转 ARG_INVALID。真实子进程
  // 形态同样经 wrapper（runMain 调 main），该行同时守护两形态的 ERROR_JSON.category。
  it('重复值 flag（6 态跨 5 CLI）→ exit 2 ARG_INVALID「重复」', async () => {
    for (const { 形态名, script, makeArgs, assertCategory } of [
      {
        形态名: 'plan-chunks --phase=1 --phase 9（混合形态，原 first-wins 放行）',
        script: 'plan-chunks.ts',
        makeArgs: async () => {
          const f = path.join(tmpDir, 'input.md');
          await fs.writeFile(f, '# A\\nbody', 'utf-8');
          return [f, '--phase=1', '--phase', '9', '--node-type=REQ'];
        },
        assertCategory: false,
      },
      {
        形态名: 'plan-chunks --phase=1 --phase=9（同形态）',
        script: 'plan-chunks.ts',
        makeArgs: async () => {
          const f = path.join(tmpDir, 'input-equal.md');
          await fs.writeFile(f, '# A\\nbody', 'utf-8');
          return [f, '--node-type=REQ', '--phase=1', '--phase=9'];
        },
        assertCategory: false,
      },
      {
        形态名: 'ensure-codegraph --phase 5 --phase=6（原等号 last-wins）',
        script: 'ensure-codegraph.ts',
        makeArgs: async () => ['--phase', '5', '--phase=6', '--project-root', tmpDir, '--mode', 'light'],
        assertCategory: false,
      },
      {
        形态名: 'ensure-codegraph 重复 --mode（原 last-wins）',
        script: 'ensure-codegraph.ts',
        makeArgs: async () => ['--phase=5', '--project-root', tmpDir, '--mode', 'light', '--mode', 'quick'],
        assertCategory: false,
      },
      {
        形态名: 'check-code-tla-consistency 重复 --manifest（原 first-wins 后续 FILE_NOT_FOUND）',
        script: 'check-code-tla-consistency.ts',
        makeArgs: async () => ['--manifest=a.json', '--manifest=b.json', '--graph=g.json', '--rtm=r.json', '--src=.'],
        assertCategory: false,
      },
      {
        形态名: 'check-artifact-gate 重复 --tickets（Task 9 守护：非 UNEXPECTED）',
        script: 'check-artifact-gate.ts',
        makeArgs: async () => ['--tickets=a.md', '--tickets=b.md'],
        assertCategory: true,
      },
    ] as const) {
      const args = await makeArgs();
      const r = runCli(script, args);
      expect(r.code, `${形态名}: 应 exit 2`).toBe(2);
      expect(r.stderr, `${形态名}: stderr 应含 ARG_INVALID`).toContain('ARG_INVALID');
      expect(r.stderr, `${形态名}: stderr 应含「重复」`).toContain('重复');
      if (assertCategory) {
        expect(errorCategory(r.stdout), `${形态名}: ERROR_JSON.category 应为 ARG_INVALID（非 UNEXPECTED）`).toBe(
          'ARG_INVALID',
        );
      }
    }
  }, 180_000);
});
