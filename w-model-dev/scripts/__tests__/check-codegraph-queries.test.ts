/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树与真实 Git 仓库（join(root, ...) 路径由测试自生成） */
/**
 * check-codegraph-queries.test.ts —— codegraph 查询落盘 strict 覆盖校验单元测试
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A）：
 *   C1  strict 通过：查询 phase 前缀 = scope.phase、changeId 精确匹配、
 *       targetFiles ⊆ scope.changedFiles、全部须覆盖 code/test 文件被覆盖
 *   C2  changeId 不匹配 → violation（无关查询不放行）
 *   C3  targetFiles 含 scope 外文件 / 非法路径（绝对、`..`、反斜杠）→ violation
 *   C4  scope 中须覆盖文件未被任何查询覆盖（缺失列表逐文件进 violations）
 *   C5  既有查询 JSON 缺 changeId/targetFiles → strict 下 violation（不允许 silent skip）
 *   C6  queryTimestamp 非法 / 晚于 scopeCreatedAt → violation
 *   C7  同 changeId 但文件名 phase 前缀与 scope.phase 不符 → violation；
 *       异 changeId 的历史查询不参与 scope 判定
 *   C8  结构完整性校验保留（schema 校验失败 → violation）
 *   C9  原两参 legacy 纯函数行为不变（self-test 兼容层）
 *   C10 CLI：阶段 5-8 无 --scope → exit 1（不是 0）；有合法 scope → exit 0；
 *       覆盖缺失 → exit 1
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkCodegraphQueries,
  checkCodegraphQueriesStrict,
  type CodegraphStrictResult,
} from '../cli/check-codegraph-queries.js';
import type { ChangeScope } from '../lib/change-scope.js';
import { runSync } from '../lib/run-sync.js';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CLI = join(__dirname, '..', 'cli', 'check-codegraph-queries.ts');

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-cgq-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响断言
    }
  }
});

function makeScope(overrides: Partial<ChangeScope> = {}): ChangeScope {
  return {
    changeId: 'phase5-demo',
    phase: 5,
    baseRef: 'base',
    headRef: 'head',
    scopeCreatedAt: '2026-09-04T00:00:00Z',
    changedFiles: ['src/main.ts', 'src/util.ts', 'docs/note.md'],
    ...overrides,
  };
}

/** 完整合法查询（覆盖 main.ts 或 util.ts） */
function queryFile(changeId: string, targetFiles: string[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    querySymbol: 'TargetSymbol',
    callers: ['CallerA'],
    callees: ['CalleeB'],
    blastRadius: 3,
    queryTimestamp: '2026-09-03T00:00:00Z',
    changeId,
    targetFiles,
    ...extra,
  });
}

function writeProject(files: Record<string, string>): string {
  const root = makeTmpDir();
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

function readResult(root: string, scope: ChangeScope): CodegraphStrictResult {
  return checkCodegraphQueriesStrict(root, scope);
}

describe('checkCodegraphQueriesStrict（覆盖绑定校验）', () => {
  it('C1: 合法 scope + 全量覆盖查询 → passed', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts']),
      '.w-model/codegraph-queries/phase5-b.json': queryFile('phase5-demo', ['src/util.ts']),
    });
    const r = readResult(root, makeScope());
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.queryCount).toBe(2);
    expect(r.requiredFileCount).toBe(2);
    expect(r.coveredFileCount).toBe(2);
  });

  it('C2: changeId 与 scope.changeId 不一致 → violation（无关查询不放行）', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-other-ticket', ['src/main.ts']),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('changeId'))).toBe(true);
  });

  it('C3: targetFiles 含 scope.changedFiles 之外文件 → violation', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts', 'src/outside.ts']),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('src/outside.ts'))).toBe(true);
  });

  it('C3b: targetFiles 含绝对路径 / `..` / 反斜杠 → violation（路径越界失败）', () => {
    for (const bad of ['/abs/x.ts', '../outside.ts', 'src\\win.ts']) {
      const root = writeProject({
        '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts', bad]),
      });
      const r = readResult(root, makeScope());
      expect(r.passed, bad).toBe(false);
      expect(
        r.violations.some((v) => v.includes(bad)),
        bad,
      ).toBe(true);
    }
  });

  it('C4: scope 中须覆盖 code/test 文件未被覆盖 → violations 逐文件列出', () => {
    const scope = makeScope({ changedFiles: ['src/main.ts', 'src/forgotten.ts', 'docs/note.md'] });
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts']),
    });
    const r = readResult(root, scope);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('src/forgotten.ts'))).toBe(true);
    expect(r.violations.some((v) => v.includes('src/main.ts'))).toBe(false); // 已覆盖不报
    expect(r.violations.some((v) => v.includes('docs/note.md'))).toBe(false); // 非 code/test 不强制
  });

  it('C4b: 无任何查询文件 / 查询目录缺失 → fail-closed', () => {
    const root = writeProject({});
    const r1 = readResult(root, makeScope());
    expect(r1.passed).toBe(false);
    expect(r1.violations[0]).toMatch(/codegraph-queries/);
    const root2 = writeProject({ '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', []) });
    const r2 = readResult(root2, makeScope());
    expect(r2.passed).toBe(false);
  });

  it('C5: 既有查询 JSON 缺 changeId/targetFiles → strict violation（不允许 silent skip）', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': JSON.stringify({
        querySymbol: 'X',
        callers: ['A'],
        callees: ['B'],
        blastRadius: 2,
        queryTimestamp: '2026-09-03T00:00:00Z',
      }),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /changeId/.test(v))).toBe(true);
    expect(r.violations.some((v) => /targetFiles/.test(v))).toBe(true);
  });

  it('C6: queryTimestamp 非法或晚于 scopeCreatedAt → violation', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts'], {
        queryTimestamp: '2026-09-04T12:00:00Z',
      }),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /晚于|scopeCreatedAt/.test(v))).toBe(true);
    const root2 = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts'], {
        queryTimestamp: 'yesterday',
      }),
    });
    const r2 = readResult(root2, makeScope());
    expect(r2.passed).toBe(false);
    expect(r2.violations.some((v) => /ISO/.test(v))).toBe(true);
  });

  it('C7: 同 changeId 但文件名 phase 前缀 ≠ scope.phase → violation；同 phase 异 changeId → 违规；异 phase 异 changeId 历史文件不参与', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase4-same-change.json': queryFile('phase5-demo', ['src/main.ts']),
      '.w-model/codegraph-queries/phase4-old-other.json': queryFile('phase5-old-ticket', ['src/other.ts']),
      '.w-model/codegraph-queries/phase5-old-change.json': queryFile('phase5-old-ticket', ['src/other.ts']),
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts', 'src/util.ts']),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    // 同 changeId 异 phase 前缀：phase 归属违规
    expect(r.violations.some((v) => /phase4-same-change\.json/.test(v) && /phase 前缀/.test(v))).toBe(true);
    // 同 phase 前缀异 changeId：changeId 精确匹配违规（spec：changeId 必须精确等于 scope.changeId）
    expect(r.violations.some((v) => /phase5-old-change\.json/.test(v) && /不一致/.test(v))).toBe(true);
    // 异 phase 且异 changeId 的历史文件不属于本 scope：忽略
    expect(r.violations.some((v) => v.includes('phase4-old-other.json'))).toBe(false);
  });

  it('C8: 查询记录违反 codegraph-query schema（缺 blastRadius 等）→ violation', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': JSON.stringify({
        querySymbol: 'X',
        callers: ['A'],
        callees: ['B'],
        queryTimestamp: '2026-09-03T00:00:00Z',
        changeId: 'phase5-demo',
        targetFiles: ['src/main.ts'],
      }),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /结构|schema|blastRadius/.test(v))).toBe(true);
  });

  it('C8b: blastRadius 负数 → violation（须为有限非负数）', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': queryFile('phase5-demo', ['src/main.ts'], { blastRadius: -1 }),
    });
    const r = readResult(root, makeScope());
    expect(r.passed).toBe(false);
  });
});

describe('checkCodegraphQueries（legacy 两参兼容层）', () => {
  it('C9: legacy 无 scope 时仍按原语义校验字段完整性', () => {
    const root = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': JSON.stringify({
        querySymbol: 'X',
        callers: ['A'],
        callees: ['B'],
        blastRadius: 2,
        queryTimestamp: '2026-09-03T00:00:00Z',
      }),
    });
    const r = checkCodegraphQueries(root, 5);
    expect(r.passed).toBe(true); // 无 changeId/targetFiles 不阻断 legacy（strict 才阻断）
    const root2 = writeProject({
      '.w-model/codegraph-queries/phase5-a.json': JSON.stringify({ querySymbol: 'X' }),
    });
    expect(checkCodegraphQueries(root2, 5).passed).toBe(false);
  });
});

describe('check-codegraph-queries.ts CLI（--scope fail-closed）', () => {
  /** 构造带真实 HEAD 的迷你仓库 + scope + 查询落盘 */
  function makeScopedProject(files: Record<string, string>): { root: string; baseSha: string; headSha: string } {
    const root = makeTmpDir('wmodel-cgq-cli-');
    const git = (args: string[]): string => {
      const r = runSync('git', args, { cwd: root, timeout: 30_000 });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
      return String(r.stdout ?? '').trim();
    };
    git(['init', '-q']);
    git(['config', 'user.name', 'CGQ CLI']);
    git(['config', 'user.email', 'cgq@test.local']);
    git(['config', 'commit.gpgSign', 'false']);
    for (const [rel, content] of Object.entries({ '.gitignore': '.w-model/\n', ...files })) {
      const abs = join(root, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
    }
    git(['add', '-A']);
    git(['commit', '-qm', 'base']);
    const baseSha = git(['rev-parse', 'HEAD']);
    // head 提交：src/main.ts 修改 + src/forgotten.ts 新增
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'main.ts'), 'export const x = 2;\n');
    writeFileSync(join(root, 'src', 'forgotten.ts'), 'export const y = 1;\n');
    git(['add', '-A']);
    git(['commit', '-qm', 'head']);
    const headSha = git(['rev-parse', 'HEAD']);
    return { root, baseSha, headSha };
  }

  function runCli(args: string[]): { status: number; stdout: string } {
    try {
      const stdout = execSync(`npx tsx "${CLI}" ${args.join(' ')}`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 90_000,
        windowsHide: true,
      });
      return { status: 0, stdout };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; message: string };
      return { status: e.status ?? 1, stdout: String(e.stdout ?? '') };
    }
  }

  it('C10a: 阶段 5-8 无 --scope → exit 1（不是 0），violations 说明须提供变更上下文', () => {
    const { root } = makeScopedProject({});
    const r = runCli([`"${root}"`, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/--scope/);
    expect(r.stdout).toMatch(/变更上下文|ChangeScope/);
  });

  it('C10b: 合法 scope + 全覆盖查询 → exit 0', () => {
    const { root, baseSha, headSha } = makeScopedProject({});
    mkdirSync(join(root, '.w-model', 'codegraph-queries'), { recursive: true });
    writeFileSync(
      join(root, '.w-model', 'codegraph-queries', 'phase5-audit-cgq-a.json'),
      JSON.stringify({
        querySymbol: 'main.ts symbol',
        callers: ['x'],
        callees: ['y'],
        blastRadius: 2,
        queryTimestamp: new Date().toISOString(),
        changeId: 'phase5-cgq-cli',
        targetFiles: ['src/main.ts', 'src/forgotten.ts'],
      }),
    );
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: 'phase5-cgq-cli',
        phase: 5,
        baseRef: baseSha,
        headRef: headSha,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: ['src/main.ts', 'src/forgotten.ts'],
      }),
    );
    const r = runCli([`"${root}"`, '--phase', '5', `--scope=.w-model/scope.json`]);
    expect(r.status).toBe(0);
  });

  it('C10c: scope 合法但覆盖缺失（forgotten.ts 未查）→ exit 1', () => {
    const { root, baseSha, headSha } = makeScopedProject({});
    mkdirSync(join(root, '.w-model', 'codegraph-queries'), { recursive: true });
    writeFileSync(
      join(root, '.w-model', 'codegraph-queries', 'phase5-audit-cgq-a.json'),
      JSON.stringify({
        querySymbol: 'main.ts symbol',
        callers: ['x'],
        callees: ['y'],
        blastRadius: 2,
        queryTimestamp: new Date().toISOString(),
        changeId: 'phase5-cgq-cli',
        targetFiles: ['src/main.ts'],
      }),
    );
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: 'phase5-cgq-cli',
        phase: 5,
        baseRef: baseSha,
        headRef: headSha,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: ['src/main.ts', 'src/forgotten.ts'],
      }),
    );
    const r = runCli([`"${root}"`, '--phase', '5', `--scope=.w-model/scope.json`]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/src\/forgotten\.ts/);
  });

  it('C10d: 薄封装 --change 为空串 → exit 2 + ERROR_JSON(ARG_INVALID)（显式拒绝，非下游 fail-closed 兜底）', () => {
    const { root, baseSha, headSha } = makeScopedProject({});
    const r = runCli([`"${root}"`, '--phase', '5', `--change=`, `--base=${baseSha}`, `--head=${headSha}`]);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{/);
    const parsed = JSON.parse(r.stdout.replace(/^ERROR_JSON /, '')) as { category: string; exitCode: number };
    expect(parsed.category).toBe('ARG_INVALID');
    expect(parsed.exitCode).toBe(2);
  });
});
