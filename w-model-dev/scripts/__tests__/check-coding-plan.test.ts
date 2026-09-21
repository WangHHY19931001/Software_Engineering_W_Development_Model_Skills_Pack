/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树与真实 Git 仓库（join(root, ...) 路径由测试自生成） */
/**
 * check-coding-plan.test.ts —— 编码计划制品门 CLI 集成测试（真实子进程）
 *
 * 覆盖（superpowers 替换 opsx 批次 1 任务 1）：
 *   C1  exit-2 探针兼容：未知 flag / 缺参数 → exit 2 + ERROR_JSON（与 lib/exit2-probe-registry 基础探针对齐）
 *   C2  阶段 5-8 无 --scope → exit 1（missing reasons 透传）
 *   C3  合法 scope + 完整制品树 → exit 0，CODING_PLAN_JSON 摘要字段正确
 *   C4  合法 scope + 账本缺失（R3）→ exit 1，violations 具名
 *   C5  --json 模式：stdout 单行纯 JSON 可整体 parse
 *   C6  归档态回退（R6/D-7）：活动位缺失 + 归档快照齐 → exit 0 且人类可读段标出归档快照位置
 *   C7  scope.changeId 前缀与 phase 不符 → exit 2（scope 装载即拒；gate R1 前缀校验为纵深防御）
 *   C8  --phase=99 非法值 → exit 2（ARG_INVALID）；重复值 flag --scope → exit 2（ARG_INVALID）
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CLI = join(__dirname, '..', 'cli', 'check-coding-plan.ts');
const CHANGE_ID = 'phase5-demo';

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-coding-plan-cli-'): string {
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

function validPlanText(): string {
  return [
    '# phase5-demo 编码计划',
    '',
    '## 目标',
    '',
    '交付编码计划制品门。',
    '',
    '## Task 1: 实现门禁逻辑',
    '',
    '验证：npm test',
    '',
    '## Task 2: 接线 CLI',
    '',
    'Verify: npm run typecheck',
    '',
  ].join('\n');
}

/** 铺完整合法制品树（活动位 plan + 账本 + 三件套 + review diff + R3×9 + V×3） */
function writeValidTree(root: string, phase = 5, changeId = CHANGE_ID): void {
  const planDir = join(root, 'docs', 'plans');
  const ledgerDir = join(root, '.superpowers', 'sdd', `${changeId}.plan`);
  mkdirSync(planDir, { recursive: true });
  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(join(planDir, `${changeId}.plan.md`), validPlanText());
  writeFileSync(
    join(ledgerDir, 'progress.md'),
    `# SDD ledger — plan: docs/plans/${changeId}.plan.md\n\nTask 1: complete (commits a..b)\nTask 2: complete (commits b..c)\n`,
  );
  for (const n of [1, 2]) {
    writeFileSync(join(ledgerDir, `task-${n}-brief.md`), `# task ${n} brief\n`);
    writeFileSync(join(ledgerDir, `task-${n}-report.md`), `# task ${n} report\n`);
  }
  writeFileSync(join(ledgerDir, 'review-abc1234.diff'), 'diff --git a/x b/x\n');
  mkdirSync(join(root, '.w-model', 'r3-reviews'), { recursive: true });
  mkdirSync(join(root, '.w-model', 'v-reviews'), { recursive: true });
  for (const stage of ['plan', 'execute', 'finalize']) {
    for (const dim of ['completeness', 'reliability', 'security']) {
      writeFileSync(join(root, '.w-model', 'r3-reviews', `phase${phase}-${stage}-${dim}.md`), `# r3\n`);
    }
    writeFileSync(join(root, '.w-model', 'v-reviews', `phase${phase}-${stage}.md`), `# v\n`);
  }
}

/** 把制品树迁移为归档态：活动位删除，plan/账本/三件套快照复制进 docs/changes/archive/<日期>-<changeId>/ */
function archiveTree(root: string, changeId: string): string {
  const archiveDir = join(root, 'docs', 'changes', 'archive', `2026-01-01-${changeId}`);
  mkdirSync(archiveDir, { recursive: true });
  const ledgerDir = join(root, '.superpowers', 'sdd', `${changeId}.plan`);
  copyFileSync(join(root, 'docs', 'plans', `${changeId}.plan.md`), join(archiveDir, `${changeId}.plan.md`));
  copyFileSync(join(ledgerDir, 'progress.md'), join(archiveDir, 'progress.md'));
  for (const f of [
    'task-1-brief.md',
    'task-1-report.md',
    'task-2-brief.md',
    'task-2-report.md',
    'review-abc1234.diff',
  ]) {
    copyFileSync(join(ledgerDir, f), join(archiveDir, f));
  }
  rmSync(join(root, 'docs', 'plans', `${changeId}.plan.md`), { force: true });
  rmSync(ledgerDir, { recursive: true, force: true });
  return archiveDir;
}

describe('check-coding-plan.ts CLI', () => {
  /** prepare(root) 铺文件后统一提交为 base（保证工作树干净，scope changedFiles=[] 才一致） */
  function makeCodingPlanRepo(prepare: (root: string) => void): { root: string; head: string } {
    const root = makeTmpDir();
    const git = (cmdArgs: string[]): string => {
      const r = runSync('git', cmdArgs, { cwd: root, timeout: 30_000 });
      if (r.status !== 0) throw new Error(`git ${cmdArgs.join(' ')}: ${r.stderr}`);
      return String(r.stdout ?? '').trim();
    };
    git(['init', '-q']);
    git(['config', 'user.name', 'CodingPlan CLI']);
    git(['config', 'user.email', 'coding-plan@test.local']);
    git(['config', 'commit.gpgSign', 'false']);
    writeFileSync(join(root, '.gitignore'), '.w-model/\n.superpowers/\n');
    prepare(root);
    git(['add', '-A']);
    git(['commit', '-qm', 'base']);
    const head = git(['rev-parse', 'HEAD']);
    return { root, head };
  }

  function writeScope(root: string, head: string, phase = 5, changeId = CHANGE_ID): void {
    writeFileSync(
      join(root, '.w-model', 'scope.json'),
      JSON.stringify({
        changeId,
        phase,
        baseRef: head,
        headRef: head,
        scopeCreatedAt: new Date().toISOString(),
        changedFiles: [],
      }),
    );
  }

  function runCli(cmdArgs: string[]): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execSync(`npx tsx "${CLI}" ${cmdArgs.join(' ')}`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 90_000,
        windowsHide: true,
      });
      return { status: 0, stdout, stderr: '' };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
    }
  }

  it('C1: 未知 flag（exit-2 基础探针同参）→ exit 2 + stdout ERROR_JSON + stderr 人类错误行', () => {
    const { root } = makeCodingPlanRepo(() => undefined);
    const r = runCli([`"${root}"`, '--d4-invalid-argument']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{.*"exitCode":2/);
    expect(r.stderr).toContain('✗ [ARG_INVALID]');
  });

  it('C1b: 无任何参数 → exit 2（缺 <project-root> / --phase）', () => {
    const r = runCli([]);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });

  it('C8: --phase 99 非法值（空格形态越界）→ exit 2 ARG_INVALID', () => {
    const { root } = makeCodingPlanRepo(() => undefined);
    const r = runCli([`"${root}"`, '--phase', '99']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--phase=99');
  });

  it('C8b: 重复值 flag（--scope= 两次）→ exit 2 ARG_INVALID', () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r));
    const r = runCli([`"${root}"`, '--phase=5', '--scope=a.json', '--scope=b.json']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/ERROR_JSON \{.*ARG_INVALID/);
  });

  it('C2: 阶段 5-8 无 --scope → exit 1（附等号形态提示）', () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r));
    const r = runCli([`"${root}"`, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/--scope/);
    expect(r.stdout).toContain('仅支持等号形态 --scope=<file>');
  });

  it('C3: 合法 scope + 完整制品 → exit 0，CODING_PLAN_JSON 字段正确', () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    writeScope(root, head);
    const r = runCli([`"${root}"`, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
    const jsonLine = r.stdout.split(/\r?\n/).find((l) => l.startsWith('CODING_PLAN_JSON '));
    expect(jsonLine).toBeDefined();
    const summary = JSON.parse((jsonLine ?? '').slice('CODING_PLAN_JSON '.length)) as Record<string, unknown>;
    expect(summary.type).toBe('coding-plan');
    expect(summary.passed).toBe(true);
    expect(summary.phase).toBe(5);
    expect(summary.changeId).toBe(CHANGE_ID);
    expect(summary.planPath).toBe('docs/plans/phase5-demo.plan.md');
    expect(summary.ledgerPath).toBe('.superpowers/sdd/phase5-demo.plan/progress.md');
    expect(summary.tasksTotal).toBe(2);
    expect(summary.tasksCompleted).toBe(2);
    expect(summary.reviewsFound).toHaveLength(12);
    expect(summary.exitCode).toBe(0);
  });

  it('C4: 合法 scope + 账本缺失（R3）→ exit 1 且 violations 具名', () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`), { recursive: true, force: true });
    writeScope(root, head);
    const r = runCli([`"${root}"`, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('progress.md 缺失');
    const jsonLine = r.stdout.split(/\r?\n/).find((l) => l.startsWith('CODING_PLAN_JSON '));
    const summary = JSON.parse((jsonLine ?? '').slice('CODING_PLAN_JSON '.length)) as Record<string, unknown>;
    expect(summary.passed).toBe(false);
    expect(summary.tasksCompleted).toBe(0);
  });

  it('C5: --json 模式 → stdout 单行纯 JSON 可整体 parse', () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    writeScope(root, head);
    const r = runCli([`"${root}"`, '--phase=5', '--scope=.w-model/scope.json', '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout.trim()) as { type: string; passed: boolean; exitCode: number };
    expect(parsed.type).toBe('coding-plan');
    expect(parsed.passed).toBe(true);
    expect(parsed.exitCode).toBe(0);
  });

  it('C6: 归档态回退（R6/D-7）→ exit 0 且人类可读段标出归档快照位置', () => {
    const { root, head } = makeCodingPlanRepo((r) => {
      writeValidTree(r);
      archiveTree(r, CHANGE_ID);
    });
    writeScope(root, head);
    const r = runCli([`"${root}"`, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('docs/changes/archive/2026-01-01-phase5-demo/phase5-demo.plan.md');
  });

  it('C7: scope.changeId 前缀与 phase 不符 → scope 装载即拒（exit 2；gate R1 前缀校验为纵深防御，逻辑层单测覆盖）', () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r)); // 树按 phase5-demo 铺
    writeScope(root, head, 6, CHANGE_ID); // scope.phase=6 与 changeId 的 phase5- 前缀不符
    const r = runCli([`"${root}"`, '--phase=6', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/STRUCTURE_INVALID/);
    expect(r.stdout).toContain('phase6-');
  });
});
