/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树与真实 Git 仓库（join(root, ...) 路径由测试自生成） */
/**
 * check-openspec-archive.test.ts —— opsx:archive 归档 strict 模式单元测试
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A）：
 *   A1  strict：精确 `<changeId>` 归档目录 + 制品齐全 → passed
 *   A2  strict：`<date>-<changeId>` 日期前缀归档同样匹配 → passed
 *   A3  锚定匹配：`<changeId>-extra` 等相似名不匹配（不再用未锚定正则）
 *   A4  多匹配（两个日期归档同 changeId）→ violation（不允许任取其一/entries[0]）
 *   A5  无匹配 → violation（opsx:archive 未执行）
 *   A6  phase 归属一致性（changeId 前缀 phaseN 与 scope phase 一致）
 *   A7  legacy 函数行为不变（self-test 兼容层）
 *   A8  CLI：无 --scope → exit 1；合法 scope → exit 0；归档缺失 → exit 1
 *   A9  日期前缀须为真实日历日（2026-13-45-<changeId> → violation；2026-09-03- 与无日期前缀通过）
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkOpenspecArchive, checkOpenspecArchiveStrict } from '../cli/check-openspec-archive.js';
import { runSync } from '../lib/run-sync.js';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CLI = join(__dirname, '..', 'cli', 'check-openspec-archive.ts');
const CHANGE_ID = 'phase5-demo';

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-arc-'): string {
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

function writeArchiveDir(archiveRoot: string, dirName: string): void {
  mkdirSync(join(archiveRoot, dirName), { recursive: true });
  for (const art of ['proposal.md', 'design.md', 'tasks.md', 'tickets.md']) {
    writeFileSync(join(archiveRoot, dirName, art), `# ${art}\n`);
  }
  mkdirSync(join(archiveRoot, dirName, 'specs'), { recursive: true });
  writeFileSync(join(archiveRoot, dirName, 'specs', 'x.md'), '# x\n');
}

describe('checkOpenspecArchiveStrict', () => {
  it('A1: 精确 <changeId> 归档目录 + 制品齐全 → passed', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), CHANGE_ID);
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.archivedChange).toBe(CHANGE_ID);
    expect(r.artifactsFound.length).toBe(5);
  });

  it('A2: <date>-<changeId> 归档目录匹配 → passed', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), `2026-09-03-${CHANGE_ID}`);
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.archivedChange).toBe(`2026-09-03-${CHANGE_ID}`);
  });

  it('A3: 未锚定相似名（如 <changeId>-extra / 前缀残缺）不匹配 → violation', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), `${CHANGE_ID}-extra`);
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes(CHANGE_ID))).toBe(true);
    expect(r.violations.some((v) => v.includes('extra'))).toBe(true); // 列出现有目录供修正
  });

  it('A4: 两个日期归档同 changeId 多匹配 → violation（不允许 entries[0] 任取其一）', () => {
    const root = makeTmpDir();
    const base = join(root, 'openspec', 'changes', 'archive');
    writeArchiveDir(base, `2026-09-02-${CHANGE_ID}`);
    writeArchiveDir(base, `2026-09-03-${CHANGE_ID}`);
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /多个.*匹配|多匹配/.test(v))).toBe(true);
  });

  it('A9: 日期前缀非真实日历日（2026-13-45-）→ violation（日期段须为有效 YYYY-MM-DD）', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), `2026-13-45-${CHANGE_ID}`);
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /2026-13-45|日期/.test(v))).toBe(true);
    // 对照组：真实日期前缀（2026-09-03，A2 已覆盖）与无日期前缀（A1 已覆盖）均匹配通过
  });

  it('A5: archive 无匹配 / archive 目录缺失 → violation', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), 'phase6-other-change');
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    const root2 = makeTmpDir();
    const r2 = checkOpenspecArchiveStrict(root2, 5, CHANGE_ID);
    expect(r2.passed).toBe(false);
    expect(r2.violations[0]).toMatch(/archive/);
  });

  it('A6: changeId 阶段前缀与 phase 不符 → violation', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), 'phase4-old');
    const r = checkOpenspecArchiveStrict(root, 5, 'phase4-old');
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /phase 前缀|phase4/.test(v))).toBe(true);
  });

  it('A6b: 归档制品缺 tickets.md / specs → violation', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), CHANGE_ID);
    const rm = join(root, 'openspec', 'changes', 'archive', CHANGE_ID, 'tickets.md');
    rmSync(rm, { force: true });
    const r = checkOpenspecArchiveStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('tickets.md 缺失'))).toBe(true);
  });

  it('A7: legacy 函数行为不变（未锚定取 entries[0]，样本语义保持）', () => {
    const root = makeTmpDir();
    writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), `2026-09-03-${CHANGE_ID}`);
    const r = checkOpenspecArchive(root, 5);
    expect(r.passed).toBe(true);
    expect(r.archivedChange).toBe(`2026-09-03-${CHANGE_ID}`);
  });
});

describe('check-openspec-archive.ts CLI', () => {
  function makeArchiveRepo(prepare: (root: string) => void): { root: string; head: string } {
    const root = makeTmpDir('wmodel-arc-cli-');
    const git = (args: string[]): string => {
      const r = runSync('git', args, { cwd: root, timeout: 30_000 });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
      return String(r.stdout ?? '').trim();
    };
    git(['init', '-q']);
    git(['config', 'user.name', 'ARC CLI']);
    git(['config', 'user.email', 'arc@test.local']);
    git(['config', 'commit.gpgSign', 'false']);
    writeFileSync(join(root, '.gitignore'), '.w-model/\n');
    prepare(root);
    git(['add', '-A']);
    git(['commit', '-qm', 'base']);
    const head = git(['rev-parse', 'HEAD']);
    return { root, head };
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
      const e = err as { status?: number; stdout?: string };
      return { status: e.status ?? 1, stdout: String(e.stdout ?? '') };
    }
  }

  function writeScope(root: string, head: string, changeId: string): void {
    mkdirSync(join(root, '.w-model'), { recursive: true });
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId,
        phase: 5,
        baseRef: head,
        headRef: head,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: [],
      }),
    );
  }

  it('A8a: 无 --scope → exit 1（消息附等号形态提示，F-G3-05）', () => {
    const { root } = makeArchiveRepo(() => undefined);
    const r = runCli([`"${root}"`, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/--scope/);
    expect(r.stdout).toContain('仅支持等号形态 --scope=<file>');
  });

  it('A8b: 合法 scope + 已归档完整制品 → exit 0', () => {
    const { root, head } = makeArchiveRepo((root) =>
      writeArchiveDir(join(root, 'openspec', 'changes', 'archive'), CHANGE_ID),
    );
    writeScope(root, head, CHANGE_ID);
    const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
  });

  it('A8c: scope 对应归档缺失 → exit 1', () => {
    const { root, head } = makeArchiveRepo(() => undefined);
    writeScope(root, head, CHANGE_ID);
    const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/phase5-demo/);
  });
});
