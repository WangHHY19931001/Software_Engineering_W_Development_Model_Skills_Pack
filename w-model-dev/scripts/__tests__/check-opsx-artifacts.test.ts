/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树与真实 Git 仓库（join(root, ...) 路径由测试自生成） */
/**
 * check-opsx-artifacts.test.ts —— opsx 制品 strict changeId 模式单元测试
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A）：
 *   O1  strict：changeId 精确对应 active 目录且制品齐全 → passed
 *   O2  缺 tickets/proposal/design/tasks/specs → violation（反模式 #40 校验保留）
 *   O3  R3×3 + V 审查产物校验保留（反模式 #39）
 *   O4  changeId 不在 active 候选内 → violation（多候选/单候选均不允许取一或跳换）
 *   O5  changeId 阶段前缀与 phase 不符 → violation（phase 归属一致性）
 *   O6  原全扫描 legacy 纯函数行为不变（self-test 兼容层）
 *   O7  CLI：阶段 5-8 无 --scope → exit 1；合法 scope → exit 0；缺 tickets → exit 1
 *   O8-O11 归档位回退（D-7）：已归档态（活动位缺失 + archive 恰一匹配）按归档位同契约校验，
 *          制品缺失仍 fail-closed；archive 多匹配 → fail-closed 且具名列出匹配目录；
 *          活动位存在时优先活动位（回归）；archive 零匹配保持原早退文案
 *   O7d CLI：已归档态 + 合法 scope → exit 0（D-7：归档前聚合门与归档后置门可同时绿）
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkOpsxArtifacts, checkOpsxArtifactsStrict } from '../cli/check-opsx-artifacts.js';
import { runSync } from '../lib/run-sync.js';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CLI = join(__dirname, '..', 'cli', 'check-opsx-artifacts.ts');
const CHANGE_ID = 'phase5-demo';

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-opsx-'): string {
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

/** 铺一个完整 opsx 制品树到 openspec/changes/<...dirSegs>/（制品 + R3×9 + V×3），返回该制品目录 */
function writeOpsxTreeAt(root: string, dirSegs: string[], phase: number): string {
  const dir = join(root, 'openspec', 'changes', ...dirSegs);
  mkdirSync(dir, { recursive: true });
  for (const art of ['proposal.md', 'design.md', 'tasks.md', 'tickets.md']) {
    writeFileSync(join(dir, art), `# ${art}\n`);
  }
  mkdirSync(join(dir, 'specs'), { recursive: true });
  writeFileSync(join(dir, 'specs', 'x.md'), '# x\n');
  mkdirSync(join(root, '.w-model', 'r3-reviews'), { recursive: true });
  mkdirSync(join(root, '.w-model', 'v-reviews'), { recursive: true });
  for (const stage of ['explore', 'propose', 'coding']) {
    for (const dim of ['completeness', 'reliability', 'security']) {
      writeFileSync(
        join(root, '.w-model', 'r3-reviews', `phase${phase}-${stage}-${dim}.md`),
        `# phase${phase}-${stage}-${dim}\n`,
      );
    }
    writeFileSync(join(root, '.w-model', 'v-reviews', `phase${phase}-${stage}.md`), `# phase${phase}-${stage}\n`);
  }
  return dir;
}

/** 铺一个完整 opsx 制品树（活动位 openspec/changes/<changeName>/ + R3×9 + V×3） */
function writeOpsxTree(root: string, changeName: string, phase = 5): void {
  writeOpsxTreeAt(root, [changeName], phase);
}

/** 铺一个完整 opsx 制品树到归档位 openspec/changes/archive/<dirName>/（dirName 形如 <日期>-<changeName>） */
function writeArchivedOpsxTree(root: string, dirName: string, phase: number): string {
  return writeOpsxTreeAt(root, ['archive', dirName], phase);
}

describe('checkOpsxArtifactsStrict（changeId 精确模式）', () => {
  it('O1: changeId 对应 active 目录 + 制品 + R3/V 齐全 → passed', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, CHANGE_ID);
    const r = checkOpsxArtifactsStrict(root, 5, CHANGE_ID);
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.changesNames).toEqual([CHANGE_ID]);
    expect(r.artifactsFound.length).toBe(5);
    expect(r.reviewsFound.length).toBe(12);
  });

  it('O2: 缺 tickets.md → violation（只校验 changeId 目录）', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, CHANGE_ID);
    // 额外同阶段目录不应拖累 scope 内校验（只校验 changeId 对应目录）
    writeOpsxTree(root, 'phase5-extra');
    const rm = join(root, 'openspec', 'changes', CHANGE_ID, 'tickets.md');
    rmSync(rm, { force: true });
    const r = checkOpsxArtifactsStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('tickets.md 缺失'))).toBe(true);
    expect(r.violations.some((v) => v.includes('phase5-extra'))).toBe(false);
  });

  it('O4: changeId 不在 active 候选内（多候选 / 单候选）→ violation，不允许任取其一', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, 'phase5-real');
    writeOpsxTree(root, 'phase5-second');
    const r = checkOpsxArtifactsStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /不在.*候选/.test(v) && v.includes('phase5-real'))).toBe(true);
    const root2 = makeTmpDir();
    writeOpsxTree(root2, 'phase5-real');
    const r2 = checkOpsxArtifactsStrict(root2, 5, CHANGE_ID);
    expect(r2.passed).toBe(false);
    expect(r2.violations.some((v) => v.includes('phase5-real'))).toBe(true);
  });

  it('O5: changeId 阶段前缀与 scope phase 不符 → violation（phase 归属一致性）', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, 'phase4-old');
    const r = checkOpsxArtifactsStrict(root, 5, 'phase4-old');
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /phase 前缀|phase4/.test(v))).toBe(true);
  });

  it('O5b: openspec/changes/ 目录缺失 → violation', () => {
    const root = makeTmpDir();
    const r = checkOpsxArtifactsStrict(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toMatch(/openspec\/changes/);
  });

  it('O6: legacy 全扫描函数行为不变', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, CHANGE_ID);
    expect(checkOpsxArtifacts(root, 5).passed).toBe(true);
    const root2 = makeTmpDir();
    writeOpsxTree(root2, CHANGE_ID);
    rmSync(join(root2, 'openspec', 'changes', CHANGE_ID, 'specs'), { recursive: true, force: true });
    const r2 = checkOpsxArtifacts(root2, 5);
    expect(r2.passed).toBe(false);
    expect(r2.violations.some((v) => /specs\/ 目录缺失/.test(v))).toBe(true);
  });
});

describe('checkOpsxArtifactsStrict（归档位回退，D-7）', () => {
  const PHASE = 7;
  const ARCHIVED_DIR = '2026-01-01-phase7-x';

  it('O8: 已归档态——活动位缺失、archive 恰一匹配 → 按归档位同契约校验且通过', () => {
    const root = makeTmpDir();
    writeArchivedOpsxTree(root, ARCHIVED_DIR, PHASE);
    const r = checkOpsxArtifactsStrict(root, PHASE, 'phase7-x');
    expect(r).toMatchObject({ passed: true, violations: [] });
    // changesNames 语义不变（仍为 scope.changeId），归档位不泄漏进返回结构（check-artifact-gate 消费依赖）
    expect(r.changesNames).toEqual(['phase7-x']);
    expect(r.artifactsFound.length).toBe(5);
    expect(r.reviewsFound.length).toBe(12);
  });

  it('O8b: 已归档态下制品缺失仍 fail-closed（同契约，不移除任何校验）', () => {
    const root = makeTmpDir();
    const archived = writeArchivedOpsxTree(root, ARCHIVED_DIR, PHASE);
    rmSync(join(archived, 'tickets.md'), { force: true });
    const r = checkOpsxArtifactsStrict(root, PHASE, 'phase7-x');
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('tickets.md 缺失'))).toBe(true);
  });

  it('O9: archive 多匹配 → fail-closed，且违规具名列出全部匹配目录', () => {
    const root = makeTmpDir();
    writeArchivedOpsxTree(root, '2026-01-01-phase7-x', PHASE);
    writeArchivedOpsxTree(root, '2026-01-02-phase7-x', PHASE);
    const r = checkOpsxArtifactsStrict(root, PHASE, 'phase7-x');
    expect(r.passed).toBe(false);
    const multi = r.violations.find((v) => v.includes('多匹配'));
    expect(multi).toBeDefined();
    expect(multi).toContain('2026-01-01-phase7-x');
    expect(multi).toContain('2026-01-02-phase7-x');
    expect(r.changesNames).toEqual([]);
  });

  it('O10: 活动位存在时优先活动位（归档位残缺也不改判定）', () => {
    const root = makeTmpDir();
    writeOpsxTree(root, 'phase7-x', PHASE);
    const archived = writeArchivedOpsxTree(root, ARCHIVED_DIR, PHASE);
    rmSync(join(archived, 'tickets.md'), { force: true }); // 归档位残缺：若误走归档位则 tickets 缺失
    const r = checkOpsxArtifactsStrict(root, PHASE, 'phase7-x');
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.changesNames).toEqual(['phase7-x']);
  });

  it('O11: 活动位缺失且 archive 零匹配 → 保持原早退文案（不新增含糊文案）', () => {
    // 有同阶段其它活动目录：走「不在 active 候选」原文案
    const root = makeTmpDir();
    writeOpsxTree(root, 'phase7-other', PHASE);
    writeArchivedOpsxTree(root, '2026-01-01-phase7-y', PHASE);
    const r = checkOpsxArtifactsStrict(root, PHASE, 'phase7-x');
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /不在.*候选/.test(v) && v.includes('phase7-other'))).toBe(true);
    expect(r.violations.some((v) => v.includes('无 phase7-* 变更目录'))).toBe(false);

    // 无任何活动目录（仅归档位且不匹配）：走「无 phase7-* 变更目录」原文案
    const root2 = makeTmpDir();
    writeArchivedOpsxTree(root2, '2026-01-01-phase7-y', PHASE);
    const r2 = checkOpsxArtifactsStrict(root2, PHASE, 'phase7-x');
    expect(r2.passed).toBe(false);
    expect(r2.violations.some((v) => v.includes('无 phase7-* 变更目录'))).toBe(true);
    expect(r2.violations.some((v) => v.includes('多匹配'))).toBe(false);
  });
});

describe('check-opsx-artifacts.ts CLI', () => {
  /** prepare(root) 铺文件后统一提交为 base（保证工作树干净，scope changedFiles=[] 才一致） */
  function makeOpsxRepo(prepare: (root: string) => void): { root: string; head: string } {
    const root = makeTmpDir('wmodel-opsx-cli-');
    const git = (args: string[]): string => {
      const r = runSync('git', args, { cwd: root, timeout: 30_000 });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
      return String(r.stdout ?? '').trim();
    };
    git(['init', '-q']);
    git(['config', 'user.name', 'OPSX CLI']);
    git(['config', 'user.email', 'opsx@test.local']);
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

  it('O7a: 无 --scope → exit 1（消息附等号形态提示，F-G3-05）', () => {
    const { root } = makeOpsxRepo(() => undefined);
    const r = runCli([`"${root}"`, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/--scope/);
    expect(r.stdout).toContain('仅支持等号形态 --scope=<file>');
  });

  it('O7b: 合法 scope + 完整制品 → exit 0', () => {
    const { root, head } = makeOpsxRepo((root) => writeOpsxTree(root, CHANGE_ID));
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: CHANGE_ID,
        phase: 5,
        baseRef: head,
        headRef: head,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: [],
      }),
    );
    const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
  });

  it('O7d: scope 合法 + 变更已归档（活动位缺失）→ exit 0（D-7 两门可同时绿）', () => {
    const { root, head } = makeOpsxRepo((root) => writeArchivedOpsxTree(root, '2026-01-01-phase5-demo', 5));
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: CHANGE_ID,
        phase: 5,
        baseRef: head,
        headRef: head,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: [],
      }),
    );
    const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
    // 归档位回退在人类可读 stdout 显式可见（返回结构字段语义不变）
    expect(r.stdout).toContain('archive/2026-01-01-phase5-demo');
  });

  it('O7c: scope 合法但 scope.changeId 无对应 active 目录 → exit 1', () => {
    const { root, head } = makeOpsxRepo((root) => writeOpsxTree(root, 'phase5-real'));
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId: 'phase5-nosuch',
        phase: 5,
        baseRef: head,
        headRef: head,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: [],
      }),
    );
    const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/phase5-nosuch/);
  });
});
