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
 *   C9  --preflight 只读电池前自检（N-2）：required 恒 14 + missing/invalid 退出语义 + artifacts 单列；
 *       无 --scope → exit 2；C10 非 preflight 路径的 R5 无锚诊断走 stderr 且不改退出码/stdout 判据
 *   C12 变长 artifacts 双口径（G2-4）：门禁路径 R4 计数（删 task-2-report.md → exit 1 且 violation 具名）；
 *       --preflight 路径只列不计数（同一删除 → exit 0，artifacts 列表项消失）
 *   C13/C14 守卫（G3-4/G3-5）：锚诊断挂 scope 解析成功之后（无 --scope → 不打印 `○ R5 诊断`）；
 *       --preflight 账本路径为同名普通文件 → 结构化为固定项缺失（exit 1 + PREFLIGHT_JSON），
 *       而非 readdirSync 裸抛 ENOTDIR 经 runMain 升级为 UNEXPECTED / exit 2
 */

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';
import { invokeCli } from './helpers/cli-invoker.js';

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

  /** 进程内调用被测 CLI（root 以位置参数显式传入，CLI 无 cwd 依赖；模块路径相对 helpers/ 是两个 ../）。
   *  git spawn 全部来自 fixture 建仓（runSync('git')），保留真实子进程——本文件仍登记 SUBPROCESS_TEST_FILES。 */
  async function runCli(cmdArgs: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
    const r = await invokeCli('../../cli/check-coding-plan.js', cmdArgs);
    return { status: r.exitCode ?? 1, stdout: r.stdout, stderr: r.stderr };
  }

  it('C1: 未知 flag（exit-2 基础探针同参）→ exit 2 + stdout ERROR_JSON + stderr 人类错误行', async () => {
    const { root } = makeCodingPlanRepo(() => undefined);
    const r = await runCli([root, '--d4-invalid-argument']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{.*"exitCode":2/);
    expect(r.stderr).toContain('✗ [ARG_INVALID]');
  });

  it('C1b: 无任何参数 → exit 2（缺 <project-root> / --phase）', async () => {
    const r = await runCli([]);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });

  it('C8: --phase 99 非法值（空格形态越界）→ exit 2 ARG_INVALID', async () => {
    const { root } = makeCodingPlanRepo(() => undefined);
    const r = await runCli([root, '--phase', '99']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--phase=99');
  });

  it('C8b: 重复值 flag（--scope= 两次）→ exit 2 ARG_INVALID', async () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r));
    const r = await runCli([root, '--phase=5', '--scope=a.json', '--scope=b.json']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/ERROR_JSON \{.*ARG_INVALID/);
  });

  it('C2: 阶段 5-8 无 --scope → exit 1（附等号形态提示）', async () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r));
    const r = await runCli([root, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/--scope/);
    expect(r.stdout).toContain('仅支持等号形态 --scope=<file>');
  });

  it('C3: 合法 scope + 完整制品 → exit 0，CODING_PLAN_JSON 字段正确', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
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

  it('C4: 合法 scope + 账本缺失（R3）→ exit 1 且 violations 具名', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`), { recursive: true, force: true });
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('progress.md 缺失');
    const jsonLine = r.stdout.split(/\r?\n/).find((l) => l.startsWith('CODING_PLAN_JSON '));
    const summary = JSON.parse((jsonLine ?? '').slice('CODING_PLAN_JSON '.length)) as Record<string, unknown>;
    expect(summary.passed).toBe(false);
    expect(summary.tasksCompleted).toBe(0);
  });

  it('C5: --json 模式 → stdout 单行纯 JSON 可整体 parse', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json', '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout.trim()) as { type: string; passed: boolean; exitCode: number };
    expect(parsed.type).toBe('coding-plan');
    expect(parsed.passed).toBe(true);
    expect(parsed.exitCode).toBe(0);
  });

  it('C6: 归档态回退（R6/D-7）→ exit 0 且人类可读段标出归档快照位置', async () => {
    const { root, head } = makeCodingPlanRepo((r) => {
      writeValidTree(r);
      archiveTree(r, CHANGE_ID);
    });
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('docs/changes/archive/2026-01-01-phase5-demo/phase5-demo.plan.md');
  });

  it('C7: scope.changeId 前缀与 phase 不符 → scope 装载即拒（exit 2；gate R1 前缀校验为纵深防御，逻辑层单测覆盖）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r)); // 树按 phase5-demo 铺
    writeScope(root, head, 6, CHANGE_ID); // scope.phase=6 与 changeId 的 phase5- 前缀不符
    const r = await runCli([root, '--phase=6', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/STRUCTURE_INVALID/);
    expect(r.stdout).toContain('phase6-');
  });

  it('C11: 审查产物路径上是目录（非普通文件）→ exit 1（R5 违规 + 诊断），不得冒泡为 exit 2 脚本异常', async () => {
    // 修复轮 1 / 发现 1 的端到端回归：诊断读盘异常若冒泡会经 runMain 变 UNEXPECTED / exit 2。
    // 用「同名目录」制造确定性触发（Windows/Linux 判据一致，不依赖目录 size 的平台差异）。
    const { root, head } = makeCodingPlanRepo((r) => {
      writeValidTree(r);
      rmSync(join(r, '.w-model', 'r3-reviews', 'phase5-plan-security.md'), { force: true });
      mkdirSync(join(r, '.w-model', 'r3-reviews', 'phase5-plan-security.md'), { recursive: true });
    });
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1); // 不是 2：诊断与 R5 判据都不得抛
    expect(r.stdout).toContain('非普通文件（R5：stage 审查产物须为文件）');
    expect(r.stdout).toMatch(/CODING_PLAN_JSON /);
    expect(r.stderr).toContain('○ R5 诊断');
    expect(r.stderr).toContain('.w-model/r3-reviews/phase5-plan-security.md');
  });

  /**
   * C12 组（G2-4）：变长 `artifacts` 项（任务三件套 / review diff）的两条 CLI 级断言——
   *   1. 非 preflight 路径：R4 **计数**变长项（`logic/coding-plan-logic.ts:540-551` 的
   *      `checkedTaskNumbers` = plan 任务号 ∪ 账本 complete 号，逐项判存在且非空）→ 删
   *      `task-2-report.md` 必须 exit 1 且 violation 具名；
   *   2. `--preflight` 路径：`artifacts` 是**变长只列不计数**项（`:491-499` 单列；CLI `:156`
   *      退出码只看 required 的 missing + invalid）→ 同一删除后退出码仍 0、列表项消失。
   * 两条合并锁定「门禁内计数 / 预检只列」的双口径，防「删了三件套仍 exit 0」这类证据链缺口。
   */
  it('C12: 合规树删除 task-2-report.md → exit 1 且 R4 具名报缺（变长项被门禁计数）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'task-2-report.md'), { force: true });
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(
      `.superpowers/sdd/${CHANGE_ID}.plan/task-2-report.md 缺失或为空（R4：已完成任务三件套须齐备非空）`,
    );
    const jsonLine = r.stdout.split(/\r?\n/).find((l) => l.startsWith('CODING_PLAN_JSON '));
    const summary = JSON.parse((jsonLine ?? '').slice('CODING_PLAN_JSON '.length)) as Record<string, unknown>;
    expect(summary.passed).toBe(false);
    const artifactsFound = summary.artifactsFound as string[];
    expect(artifactsFound).not.toContain(`.superpowers/sdd/${CHANGE_ID}.plan/task-2-report.md`);
    expect(artifactsFound).toContain(`.superpowers/sdd/${CHANGE_ID}.plan/task-2-brief.md`);
  });

  it('C12b: --preflight 的 artifacts 只列不计数——同一删除后 exit 0 且列表项消失（对照 C12）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'task-2-report.md'), { force: true });
    writeScope(root, head);
    const r = await runPreflight([root, '--phase=5', '--scope=.w-model/scope.json', '--preflight']);
    expect(r.status).toBe(0); // required 固定 14 项未受影响 → 变长项缺失不改预检退出码
    expect(r.payload.missing).toEqual([]);
    expect(r.payload.artifacts).toEqual([
      `.superpowers/sdd/${CHANGE_ID}.plan/review-abc1234.diff`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-1-brief.md`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-1-report.md`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-2-brief.md`,
    ]);
  });

  /**
   * C13/C14 组（G3-4/G3-5）：
   *   C13 锚诊断时点：scope 缺失（exit 1 输入原因）→ 不再附 `○ R5 诊断`（诊断挂 scope 解析成功之后，
   *       避免在输入错误路径上产生审计噪音）；正向对照见 C10（scope ok + 无锚产物 → 诊断在 stderr）。
   *   C14 preflight 守卫：账本路径被替换为同名**普通文件** → 不再裸崩（修复前 readdirSync 抛 ENOTDIR，
   *       经 runMain 升级为 UNEXPECTED / exit 2 + 原始栈），按固定项缺失分类（exit 1 + PREFLIGHT_JSON 正常）。
   */
  it('C13: 无 --scope（exit 1 输入原因）→ 不再附 R5 锚诊断（G3-4 时点）', async () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r)); // 12 份无锚产物在盘（有诊断可打）
    const r = await runCli([root, '--phase', '5']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('仅支持等号形态 --scope=<file>');
    expect(r.stderr).not.toContain('○ R5 诊断');
  });

  it('C14: --preflight 账本路径为同名普通文件 → exit 1（非 UNEXPECTED/exit 2），artifacts 空且 progress.md 记 missing（G3-5）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    const ledgerDir = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`);
    rmSync(ledgerDir, { recursive: true, force: true });
    writeFileSync(ledgerDir, 'not a directory\n');
    writeScope(root, head);
    const r = await runPreflight([root, '--phase=5', '--scope=.w-model/scope.json', '--preflight']);
    expect(r.status).toBe(1);
    expect(r.stderr).not.toContain('UNEXPECTED');
    expect(r.payload.artifacts).toEqual([]);
    expect(r.payload.missing).toEqual([`.superpowers/sdd/${CHANGE_ID}.plan/progress.md`]);
    expect(r.payload.invalid).toEqual([]);
  });

  /**
   * C9 组：`--preflight` 只读电池前自检（N-2，2026-09-25 任务 2）——
   * required 恒为固定 14 项（9 R3 + 3 V + plan + 账本），三件套/review diff 为变长 `artifacts` 只列出；
   * 退出码 = `missing.length + invalid.length === 0 ? 0 : 1`；该分支不执行 R1-R6。
   */
  async function runPreflight(cmdArgs: string[]): Promise<{
    status: number;
    stdout: string;
    stderr: string;
    payload: { required: string[]; missing: string[]; invalid: string[]; artifacts: string[] };
  }> {
    const r = await runCli(cmdArgs);
    const line = r.stdout.split(/\r?\n/).find((l) => l.startsWith('CODING_PLAN_PREFLIGHT_JSON '));
    expect(line).toBeDefined();
    const payload = JSON.parse((line ?? '').slice('CODING_PLAN_PREFLIGHT_JSON '.length)) as {
      required: string[];
      missing: string[];
      invalid: string[];
      artifacts: string[];
    };
    return { ...r, payload };
  }

  it('C9: --preflight 全齐 → exit 0，required 恒 14，artifacts 单列三件套 + review diff', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    writeScope(root, head);
    const r = await runPreflight([root, '--phase=5', '--scope=.w-model/scope.json', '--preflight']);
    expect(r.status).toBe(0);
    expect(r.payload.required).toHaveLength(14);
    expect(r.payload.missing).toEqual([]);
    expect(r.payload.invalid).toEqual([]);
    expect(r.payload.artifacts).toEqual([
      `.superpowers/sdd/${CHANGE_ID}.plan/review-abc1234.diff`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-1-brief.md`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-1-report.md`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-2-brief.md`,
      `.superpowers/sdd/${CHANGE_ID}.plan/task-2-report.md`,
    ]);
    // 只打印 preflight 载荷：不得同时输出常规 CODING_PLAN_JSON 报告
    expect(r.stdout).not.toContain('CODING_PLAN_JSON ');
  });

  it('C9b: --preflight 缺一份 R3 审查 → exit 1 且 missing 具名（固定项不因变长项漂移）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    rmSync(join(root, '.w-model', 'r3-reviews', 'phase5-finalize-reliability.md'), { force: true });
    writeScope(root, head);
    const r = await runPreflight([root, '--phase=5', '--scope=.w-model/scope.json', '--preflight']);
    expect(r.status).toBe(1);
    expect(r.payload.required).toHaveLength(14);
    expect(r.payload.missing).toEqual(['.w-model/r3-reviews/phase5-finalize-reliability.md']);
    expect(r.payload.invalid).toEqual([]);
  });

  it('C9c: --preflight 产物在盘但 0 字节 → exit 1 且记入 invalid（与 missing 分列）', async () => {
    const { root, head } = makeCodingPlanRepo((r) => {
      writeValidTree(r);
      writeFileSync(join(r, '.w-model', 'v-reviews', 'phase5-plan.md'), '');
    });
    writeScope(root, head);
    const r = await runPreflight([root, '--phase=5', '--scope=.w-model/scope.json', '--preflight']);
    expect(r.status).toBe(1);
    expect(r.payload.missing).toEqual([]);
    expect(r.payload.invalid).toEqual(['.w-model/v-reviews/phase5-plan.md']);
  });

  it('C9d: --preflight 无 --scope/--change → exit 2 ARG_INVALID（清单无法确定 changeId）', async () => {
    const { root } = makeCodingPlanRepo((r) => writeValidTree(r));
    const r = await runCli([root, '--phase=5', '--preflight']);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/ERROR_JSON \{.*ARG_INVALID/);
    expect(r.stderr).toContain('--preflight');
  });

  it('C10: 非 preflight 路径的 R5 诊断走 stderr（无锚非空产物具名列出）且不改退出码/stdout 判据', async () => {
    // writeValidTree 的 12 份审查产物为 `# r3\n`（非空、无行级证据锚）→ 诊断应列出全部 12 份
    const { root, head } = makeCodingPlanRepo((r) => writeValidTree(r));
    // 另造 exit 1（账本缺失）以便捕获 stderr：execSync 成功分支不返回 stderr
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`), { recursive: true, force: true });
    writeScope(root, head);
    const r = await runCli([root, '--phase=5', '--scope=.w-model/scope.json']);
    expect(r.status).toBe(1); // 诊断不阻断、不改退出码（此例的 exit 1 来自 R3 账本缺失）
    expect(r.stderr).toContain('○ R5 诊断：12 份审查产物未含行级证据锚');
    expect(r.stderr).toContain('.w-model/r3-reviews/phase5-plan-completeness.md');
    expect(r.stdout).toContain('CODING_PLAN_JSON '); // 常规报告与判据不受诊断影响
  });
});
