/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树读写文件（join(tmpdir/root, ...) 路径由测试自生成，非用户输入） */
/**
 * change-scope.test.ts —— ChangeScope 解析/校验/分类/与实际 Git 变更集合比对单元测试
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A）：
 *   S1  字段级校验（phase 1-8 整数 / scopeCreatedAt ISO / changedFiles 路径规则）
 *   S2  文件分类纯函数 isCodeOrTestFile（正反例）
 *   S3  changedFilePathViolation（绝对路径 / `..` / 反斜杠 / 空段 / 非字符串）
 *   S4  verifyScopeGitBinding 与实际变更集合精确比对（真实临时 Git 仓库）
 *        - 声明 = 实际 → 通过
 *        - 声明缺实际文件 / 声明多余文件 → fail-closed
 *        - headRef ≠ 当前 HEAD → fail-closed（过期 scope）
 *        - baseRef/headRef 非 Git 对象 → fail-closed
 *        - 非 Git 仓库 / git 命令失败 → fail-closed（不是警告跳过）
 *   S5  isIsoDateTimeString 正反例
 *   S6  resolveCliScope（--scope 文件 / 薄封装 --change/--base/--head / 缺失 / 非法）
 *
 * Git 调用全部经注入 runner（真实 runner 用 lib/run-sync.ts 的 runSync，不经
 * logic 层直连 child_process；测试内直连 spawnSync 属 __tests__ 既有模式）。
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changedFilePathViolation,
  computeGitChangedFiles,
  currentHeadSha,
  gitObjectExists,
  isCodeOrTestFile,
  isIsoDateTimeString,
  resolveCliScope,
  validateChangeScope,
  verifyScopeGitBinding,
  type ChangeScope,
  type GitOutcome,
} from '../lib/change-scope.js';
import { runSync } from '../lib/run-sync.js';

/** 绑定 cwd 的单参 Git 命令函数（readonly 参数与 GitRunner 兼容） */
type GitFn = (args: readonly string[]) => GitOutcome;

const HERE = join(__dirname, '..', '..', '..'); // 仓库根（vitest cwd 即仓库根）

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-change-scope-'): string {
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

/** 真实 Git runner（与 CLI 默认一致：经 lib/run-sync.ts 的 runSync 包装；绑定 cwd 的单参形态） */
function realGit(cwd: string): GitFn {
  return (args) => {
    const r = runSync('git', [...args], { cwd, timeout: 30_000 });
    if (r.status === null) {
      return { ok: false, stdout: '', stderr: r.error?.message ?? 'git 执行失败' };
    }
    return { ok: r.status === 0, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
  };
}

interface GitRepo {
  root: string;
  baseSha: string;
  headSha: string;
  git: GitFn;
}

/**
 * 构造迷你 Git 仓库（参考 docs-consistency D5 模式，隔离身份、禁用签名）：
 * - base 提交：a.txt + .gitignore(.w-model/)
 * - head 提交：修改 a.txt、新增 b.txt
 * - 提交后工作树保持干净
 * - f2.txt 表示“提交后新文件”（未跟踪与否由用例自建）
 */
function makeGitProject(): GitRepo {
  const root = makeTmpDir('wmodel-cs-git-');
  const git = realGit(root);
  const run = (args: string[], ok = true): string => {
    const r = git(args);
    expect({ args, ok: r.ok, stderr: r.stderr }).toMatchObject({ ok });
    return r.stdout.trim();
  };
  run(['init', '-q']);
  run(['config', 'user.name', 'ChangeScope Test']);
  run(['config', 'user.email', 'change-scope@test.local']);
  run(['config', 'commit.gpgSign', 'false']);
  writeFileSync(join(root, '.gitignore'), '.w-model/\n');
  writeFileSync(join(root, 'a.txt'), 'a1\n');
  run(['add', '.gitignore', 'a.txt']);
  run(['commit', '-qm', 'base']);
  const baseSha = run(['rev-parse', 'HEAD']);
  writeFileSync(join(root, 'a.txt'), 'a2\n');
  writeFileSync(join(root, 'b.txt'), 'b1\n');
  run(['add', 'a.txt', 'b.txt']);
  run(['commit', '-qm', 'head']);
  const headSha = run(['rev-parse', 'HEAD']);
  return { root, baseSha, headSha, git };
}

function makeScope(overrides: Partial<ChangeScope> = {}): ChangeScope {
  return {
    changeId: 'phase5-demo',
    phase: 5,
    baseRef: 'base-sha',
    headRef: 'head-sha',
    scopeCreatedAt: '2026-09-04T00:00:00Z',
    changedFiles: [],
    ...overrides,
  };
}

const VALID_SCOPE_JSON = (extra?: Record<string, unknown>): string =>
  JSON.stringify({
    changeId: 'phase5-demo',
    phase: 5,
    baseRef: 'replace-me',
    headRef: 'replace-me',
    scopeCreatedAt: '2026-09-04T00:00:00Z',
    changedFiles: [],
    ...extra,
  });

describe('change-scope 字段级校验（validateChangeScope / schema）', () => {
  it('合法 scope 通过 schema 且无字段违规', () => {
    const violations = validateChangeScope(makeScope());
    expect(violations).toEqual([]);
  });

  it('phase 非 1-8 整数被拒（0 / 9 / 小数 / 字符串）', () => {
    for (const bad of [0, 9, 3.5, '5', -1]) {
      const violations = validateChangeScope(makeScope({ phase: bad as number }));
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  it('changeId / baseRef / headRef 空串被拒', () => {
    expect(validateChangeScope(makeScope({ changeId: '' })).length).toBeGreaterThan(0);
    expect(validateChangeScope(makeScope({ baseRef: '' })).length).toBeGreaterThan(0);
    expect(validateChangeScope(makeScope({ headRef: '  ' })).length).toBeGreaterThan(0);
  });

  it('scopeCreatedAt 非法 ISO date-time 被拒（日期缺时间 / 乱串）', () => {
    expect(validateChangeScope(makeScope({ scopeCreatedAt: '2026-09-04' })).length).toBeGreaterThan(0);
    expect(validateChangeScope(makeScope({ scopeCreatedAt: 'not-a-date' })).length).toBeGreaterThan(0);
  });

  it('未知保留字段被 schema（additionalProperties:false）拒绝', () => {
    const scope = { ...makeScope(), retained: 'extra' };
    expect(validateChangeScope(scope).length).toBeGreaterThan(0);
  });

  it('changeId 须含 scope.phase 对应的 phase<N>- 前缀（跨字段一致性）', () => {
    // 缺前缀 / 异阶段前缀 → violation，消息给出期望前缀
    const missing = validateChangeScope(makeScope({ changeId: 'reviewfix' }));
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.join('；')).toMatch(/phase5-/);
    const foreign = validateChangeScope(makeScope({ changeId: 'phase6-reviewfix' }));
    expect(foreign.length).toBeGreaterThan(0);
    expect(foreign.join('；')).toMatch(/phase5-/);
    // 前缀与 phase 一致 → 通过
    expect(validateChangeScope(makeScope({ changeId: 'phase5-reviewfix' }))).toEqual([]);
  });

  it('changedFiles 项含非法路径被拒', () => {
    const badPaths = ['a/../b.txt', '/abs/x.ts', 'C:/win/x.ts', 'a\\b.ts', 'a//b.ts', 'a/', '', '..', './x.ts', '.'];
    for (const p of badPaths) {
      const scope = makeScope({ changedFiles: [p] });
      const violations = validateChangeScope(scope);
      expect(violations.length).toBeGreaterThan(0);
    }
    // 合法相对路径（正斜杠、可含点段，但按规约只列出正例集）
    const ok = makeScope({ changedFiles: ['src/a.ts', 'w-model-dev/scripts/x.ts', 'docs/a.md', 'a.b/c.d.ts'] });
    expect(validateChangeScope(ok)).toEqual([]);
  });
});

describe('changedFilePathViolation（单路径规则）', () => {
  it('合法相对路径返回 null', () => {
    for (const p of ['src/a.ts', 'docs/a.md', 'w-model-dev/scripts/cli/x.ts', 'a/b/c.txt']) {
      expect(changedFilePathViolation(p)).toBeNull();
    }
  });

  it('非字符串返回违规', () => {
    for (const p of [undefined, null, 42, ['x'], { p: 'x' }]) {
      expect(changedFilePathViolation(p)).toContain('字符串');
    }
  });

  it('绝对路径（/、\\、盘符）返回违规', () => {
    for (const p of ['/etc/x', '\\windows\\x', 'C:/x.ts', 'c:\\x.ts']) {
      const v = changedFilePathViolation(p);
      expect(v).not.toBeNull();
      expect(v).toMatch(/绝对路径/);
    }
  });

  it('反斜杠 / `..` 段 / 空段 / 空串返回违规', () => {
    for (const p of ['a\\b.ts', 'a/../b', 'a//b', 'a/', '', '../x']) {
      expect(changedFilePathViolation(p)).not.toBeNull();
    }
  });

  it('`.` 段（./x.ts / . / a/./b）返回违规（路径未规范化）', () => {
    for (const p of ['./x.ts', '.', 'a/./b.ts']) {
      const v = changedFilePathViolation(p);
      expect(v, p).not.toBeNull();
      expect(v as string).toMatch(/`\.`|未规范化/);
    }
    // 正常相对路径（含 dotfile 形态段名）不受影响
    expect(changedFilePathViolation('src/.eslintrc.cjs')).toBeNull();
  });
});

describe('isCodeOrTestFile（文件分类纯函数）', () => {
  it('工程源码/测试扩展名判为 code/test', () => {
    for (const p of [
      'src/main.ts',
      'src/main.tsx',
      'api/app.py',
      'src/Main.java',
      'tests/test_flow.py',
      'w-model-dev/scripts/cli/check-x.ts',
      'w-model-dev/scripts/__tests__/x.test.ts',
      'src/a.js',
      'cmd/app.go',
      'src/lib.rs',
    ]) {
      expect(isCodeOrTestFile(p), p).toBe(true);
    }
  });

  it('docs/schemas/.w-model/openspec/config/eval 等非强制目录判为非 code/test', () => {
    for (const p of [
      'docs/guide.md',
      'docs/api/x.ts',
      'schemas/rtm.schema.json',
      '.w-model/x.json',
      '.w-model/codegraph-queries/phase5-a.json',
      'openspec/changes/phase5-x/proposal.md',
      'config/vitest.config.ts',
      'config/tsconfig.json',
      'eval/runner.ts',
      'coverage/lcov.info',
      'node_modules/foo/index.js',
    ]) {
      expect(isCodeOrTestFile(p), p).toBe(false);
    }
  });

  it('*.md / *.markdown / dotfile / 配置扩展名判为非 code/test', () => {
    for (const p of [
      'README.md',
      'src/notes.md',
      '.eslintrc.cjs',
      '.gitignore',
      'package.json',
      'tsconfig.json',
      'w-model-dev/SKILL.md',
      'src/data.json',
    ]) {
      expect(isCodeOrTestFile(p), p).toBe(false);
    }
  });
  it('shell/PowerShell/批处理扩展名判为 code/test（白名单扩集）', () => {
    for (const p of ['hooks/pre-push.sh', 'scripts/x.ps1', 'a.bat', 'a.cmd', 'tools/setup.sh']) {
      expect(isCodeOrTestFile(p), p).toBe(true);
    }
    // .sql/.tla/.feature 不强制：分别由 BDD/TLA+/数据迁移门禁兜底（理由见 lib/change-scope.ts 注释）；.md 文档不强制
    for (const p of ['a.tla', 'a.feature', 'a.sql', 'a.md']) {
      expect(isCodeOrTestFile(p), p).toBe(false);
    }
  });
});

describe('isIsoDateTimeString', () => {
  it('UTC / 偏移 / 小数秒形式通过', () => {
    for (const s of ['2026-07-30T10:00:00Z', '2026-07-30T10:00:00+08:00', '2026-09-04T00:00:00.123Z']) {
      expect(isIsoDateTimeString(s), s).toBe(true);
    }
  });
  it('缺时间 / 非日期 / 非法月份拒绝', () => {
    for (const s of ['2026-09-04', 'not-a-date', '2026-13-04T10:00:00Z', '2026-09-04T25:00:00Z', 42]) {
      expect(isIsoDateTimeString(s), String(s)).toBe(false);
    }
  });
});

describe('verifyScopeGitBinding（真实 Git 精确比对）', () => {
  it('声明 = 实际变更集合且 headRef = 当前 HEAD → 通过', () => {
    const repo = makeGitProject();
    const scope = makeScope({
      baseRef: repo.baseSha,
      headRef: repo.headSha,
      changedFiles: ['a.txt', 'b.txt'],
    });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.actualChangedFiles).toEqual(['a.txt', 'b.txt']);
  });

  it('worktree staged/unstaged/untracked 文件计入实际集合', () => {
    const repo = makeGitProject();
    // staged 新增：c.txt；unstaged 修改：a.txt(a3)；untracked：d.txt、e.txt
    writeFileSync(join(repo.root, 'c.txt'), 'c\n');
    repo.git(['add', 'c.txt']);
    writeFileSync(join(repo.root, 'a.txt'), 'a3\n');
    writeFileSync(join(repo.root, 'd.txt'), 'd\n');
    writeFileSync(join(repo.root, 'e.txt'), 'e\n');
    const scope = makeScope({
      baseRef: repo.baseSha,
      headRef: repo.headSha,
      changedFiles: ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt'],
    });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r.passed).toBe(true);
    expect(r.actualChangedFiles).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']);
  });

  it('声明缺实际文件 → fail-closed 且逐文件列出', () => {
    const repo = makeGitProject();
    const scope = makeScope({ baseRef: repo.baseSha, headRef: repo.headSha, changedFiles: ['a.txt'] });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('b.txt'))).toBe(true);
  });

  it('声明多余（非实际变更）文件 → fail-closed', () => {
    const repo = makeGitProject();
    const scope = makeScope({
      baseRef: repo.baseSha,
      headRef: repo.headSha,
      changedFiles: ['a.txt', 'b.txt', 'zzz-not-real.txt'],
    });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('zzz-not-real.txt'))).toBe(true);
  });

  it('headRef ≠ 当前 HEAD（过期 scope）→ fail-closed', () => {
    const repo = makeGitProject();
    // base 作为 headRef：可解析但非当前 HEAD
    const scope = makeScope({ baseRef: repo.baseSha, headRef: repo.baseSha, changedFiles: [] });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /不等于当前 HEAD/.test(v))).toBe(true);
  });

  it('baseRef/headRef 非 Git 对象 → fail-closed', () => {
    const repo = makeGitProject();
    const scope = makeScope({
      baseRef: 'no-such-ref-xyz',
      headRef: repo.headSha,
      changedFiles: ['a.txt', 'b.txt'],
    });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('no-such-ref-xyz'))).toBe(true);
    const scope2 = makeScope({ baseRef: repo.baseSha, headRef: 'no-such-ref-xyz', changedFiles: [] });
    expect(verifyScopeGitBinding(scope2, repo.git, repo.root).passed).toBe(false);
  });

  it('非 Git 仓库（git 命令失败）→ fail-closed 而非警告跳过', () => {
    const root = makeTmpDir('wmodel-cs-nongit-');
    const git = realGit(root);
    const r = verifyScopeGitBinding(makeScope(), git, root);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /HEAD|git/i.test(v))).toBe(true);
    expect(r.actualChangedFiles).toBeNull();
  });

  it('gitObjectExists / currentHeadSha 基础行为', () => {
    const repo = makeGitProject();
    expect(gitObjectExists(repo.git, repo.root, repo.baseSha)).toBe(true);
    expect(gitObjectExists(repo.git, repo.root, 'no-such-ref-xyz')).toBe(false);
    expect(currentHeadSha(repo.git, repo.root)).toBe(repo.headSha);
    const root = makeTmpDir('wmodel-cs-nongit2-');
    expect(currentHeadSha(realGit(root), root)).toBeNull();
  });

  it('computeGitChangedFiles 命令失败 → { ok:false }（fail-closed 载体）', () => {
    const root = makeTmpDir('wmodel-cs-nogit-');
    const fake: GitFn = () => ({ ok: false, stdout: '', stderr: 'fatal: not a git repository' });
    const r = computeGitChangedFiles(fake, root, 'a', 'b');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('fatal');
  });

  it('quotePath：非 ASCII 文件名按字面 UTF-8 收集，exact-set 绑定通过（I-1，strict 绑定路径）', () => {
    const repo = makeGitProject();
    // untracked 非 ASCII 文件：git 默认 core.quotePath=true 会输出 "docs/\350..." 八进制转义
    mkdirSync(join(repo.root, 'docs'), { recursive: true });
    writeFileSync(join(repo.root, 'docs', '设计文档.md'), '# 设计文档\n');
    const scope = makeScope({
      baseRef: repo.baseSha,
      headRef: repo.headSha,
      changedFiles: ['a.txt', 'b.txt', 'docs/设计文档.md'],
    });
    const r = verifyScopeGitBinding(scope, repo.git, repo.root);
    // 修复前：收集名与声明名不一致 → 双违规（实际未声明 + 声明非实际）
    expect(r.violations, r.violations.join('；')).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.actualChangedFiles).toContain('docs/设计文档.md');
    expect(r.actualChangedFiles?.join('\n')).not.toMatch(/\\\d{3}/); // 不含八进制转义
  });
});

describe('resolveCliScope（CLI 参数解析 + scope 装载）', () => {
  const baseArgs = { phase: 5 };

  it('无 --scope 且无薄封装参数 → missing（violations 语义，非 exit 0）', () => {
    const root = makeTmpDir('wmodel-cs-cli-');
    const r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root) });
    expect(r.kind).toBe('missing');
    if (r.kind === 'missing') expect(r.reasons[0]).toMatch(/--scope/);
  });

  it('--scope 文件不存在 → invalid(FILE_NOT_FOUND)', () => {
    const root = makeTmpDir('wmodel-cs-cli2-');
    const r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root), scopePath: 'nope.json' });
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') expect(r.category).toBe('FILE_NOT_FOUND');
  });

  it('--scope 文件非合法 JSON → invalid(FILE_PARSE)', () => {
    const root = makeTmpDir('wmodel-cs-cli3-');
    writeFileSync(join(root, 'scope.json'), '{ not json');
    const r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root), scopePath: 'scope.json' });
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') expect(r.category).toBe('FILE_PARSE');
  });

  it('--scope 违反 schema（缺字段 / 未知字段 / phase 越界）→ invalid(STRUCTURE_INVALID)', () => {
    const root = makeTmpDir('wmodel-cs-cli4-');
    writeFileSync(join(root, 'scope.json'), JSON.stringify({ phase: 5 }));
    let r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root), scopePath: 'scope.json' });
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') expect(r.category).toBe('STRUCTURE_INVALID');
    writeFileSync(join(root, 'scope2.json'), VALID_SCOPE_JSON({ retained: 1 }));
    r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root), scopePath: 'scope2.json' });
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') expect(r.category).toBe('STRUCTURE_INVALID');
    writeFileSync(join(root, 'scope3.json'), JSON.stringify({ ...JSON.parse(VALID_SCOPE_JSON()), phase: 9 }));
    r = resolveCliScope({ projectRoot: root, ...baseArgs, git: realGit(root), scopePath: 'scope3.json' });
    expect(r.kind).toBe('invalid');
  });

  it('合法 --scope（真实 Git 一致）→ ok', () => {
    const repo = makeGitProject();
    mkdirSync(join(repo.root, '.w-model'));
    // 占位 ref 的 scope：可解析为 scope 但 Git 绑定失败 → violations（fail-closed）
    writeFileSync(join(repo.root, '.w-model', 'scope.json'), VALID_SCOPE_JSON());
    const r = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      scopePath: '.w-model/scope.json',
    });
    expect(r.kind).toBe('violations');
    writeFileSync(
      join(repo.root, '.w-model', 'scope2.json'),
      JSON.stringify({
        changeId: 'phase5-demo',
        phase: 5,
        baseRef: repo.baseSha,
        headRef: repo.headSha,
        scopeCreatedAt: '2026-09-04T00:00:00Z',
        changedFiles: ['a.txt', 'b.txt'],
      }),
    );
    const r2 = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      scopePath: '.w-model/scope2.json',
    });
    expect(r2.kind).toBe('ok');
    if (r2.kind === 'ok') expect(r2.scope.changedFiles).toEqual(['a.txt', 'b.txt']);
  });

  it('scope.phase 与 CLI phase 不一致 → violations', () => {
    const repo = makeGitProject();
    mkdirSync(join(repo.root, '.w-model'));
    // fixture 内部一致（changeId 前缀跟随 scope.phase=6，schema 跨字段校验强制）：
    // 不一致点只在 scope.phase vs CLI --phase → violations（exit 1）
    writeFileSync(
      join(repo.root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: 'phase6-demo',
        phase: 6,
        baseRef: repo.baseSha,
        headRef: repo.headSha,
        scopeCreatedAt: '2026-09-04T00:00:00Z',
        changedFiles: ['a.txt', 'b.txt'],
      }),
    );
    const r = resolveCliScope({ projectRoot: repo.root, phase: 5, git: repo.git, scopePath: '.w-model/scope.json' });
    expect(r.kind).toBe('violations');
    if (r.kind === 'violations') expect(r.violations[0]).toMatch(/phase|阶段/);
  });

  it('薄封装 --change/--base/--head：changedFiles 取实际 Git 变更集合', () => {
    const repo = makeGitProject();
    const r = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      changeArg: 'phase5-demo',
      baseArg: repo.baseSha,
      headArg: repo.headSha,
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.scope.changeId).toBe('phase5-demo');
      expect(r.scope.changedFiles).toEqual(['a.txt', 'b.txt']);
      expect(isIsoDateTimeString(r.scope.scopeCreatedAt)).toBe(true);
    }
  });

  it('薄封装路径同样按字面 UTF-8 收集非 ASCII 文件名（quotePath，I-1）', () => {
    const repo = makeGitProject();
    mkdirSync(join(repo.root, 'docs'), { recursive: true });
    writeFileSync(join(repo.root, 'docs', '设计文档.md'), '# 设计文档\n');
    const r = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      changeArg: 'phase5-reviewfix',
      baseArg: repo.baseSha,
      headArg: repo.headSha,
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.scope.changedFiles).toEqual(['a.txt', 'b.txt', 'docs/设计文档.md']);
    }
  });

  it('薄封装 changeId 缺 phase<N>- 前缀 → invalid(ARG_INVALID)（exit 2 语义，A2）', () => {
    const repo = makeGitProject();
    for (const badChange of ['reviewfix', 'phase6-reviewfix']) {
      const r = resolveCliScope({
        projectRoot: repo.root,
        phase: 5,
        git: repo.git,
        changeArg: badChange,
        baseArg: repo.baseSha,
        headArg: repo.headSha,
      });
      expect(r.kind, `changeId=${badChange}`).toBe('invalid');
      if (r.kind === 'invalid') {
        expect(r.category).toBe('ARG_INVALID');
        expect(r.message).toMatch(/phase5-/); // 消息给出期望前缀
      }
    }
  });

  it('薄封装 violations 透传 attemptedChangeId（--change 值原样带出；必填字段断言锁）', () => {
    const repo = makeGitProject();
    // changeId 须含 phase5- 前缀方可进入薄封装 violations 路径（缺前缀属 invalid(ARG_INVALID)，见上例）；
    // baseRef 不可解析 → violations（fail-closed），断言锁住 resolveCliScope 层 attemptedChangeId 透传
    const r = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      changeArg: 'phase5-reviewfix',
      baseArg: 'no-such-ref',
      headArg: repo.headSha,
    });
    expect(r.kind).toBe('violations');
    if (r.kind === 'violations') {
      expect(r.attemptedChangeId).toBe('phase5-reviewfix');
      expect(r.violations[0]).toMatch(/baseRef/);
    }
  });

  it('--scope 与薄封装参数同时给出 → invalid(ARG_INVALID)（不许静默取一）', () => {
    const repo = makeGitProject();
    const r = resolveCliScope({
      projectRoot: repo.root,
      ...baseArgs,
      git: repo.git,
      scopePath: 'scope.json',
      changeArg: 'phase5-demo',
      baseArg: repo.baseSha,
      headArg: repo.headSha,
    });
    expect(r.kind).toBe('invalid');
  });

  it('薄封装 changeId 为空串 / 全空白 → invalid(ARG_INVALID)（exit 2 语义，不在下游兜底）', () => {
    const repo = makeGitProject();
    for (const badChange of ['', '   ', '\t']) {
      const r = resolveCliScope({
        projectRoot: repo.root,
        ...baseArgs,
        git: repo.git,
        changeArg: badChange,
        baseArg: repo.baseSha,
        headArg: repo.headSha,
      });
      expect(r.kind, `changeId=${JSON.stringify(badChange)}`).toBe('invalid');
      if (r.kind === 'invalid') {
        expect(r.category).toBe('ARG_INVALID');
        expect(r.message).toMatch(/changeId/);
      }
    }
  });

  it('CLI 运行环境自检（非端到端）：验证 execSync 能跑 git', async () => {
    const repo = makeGitProject();
    writeFileSync(join(repo.root, 'scope.json'), VALID_SCOPE_JSON());
    // 直接跑 resolveCliScope 已被上面用例覆盖；本用例仅做 CLI 运行环境自检，
    // 验证 execSync 能启动 git 子进程，不端到端校验 scope（非端到端）。
    const out = execSync('git --version', { encoding: 'utf-8', timeout: 15_000 });
    expect(out).toMatch(/git version/i);
    expect(HERE).toBeTruthy();
  });
});
