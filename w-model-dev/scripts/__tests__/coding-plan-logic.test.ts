/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(root, ...) 路径由测试自生成） */
/**
 * coding-plan-logic.test.ts —— 编码计划制品门纯逻辑单元测试（check-coding-plan.ts 的 logic 层）
 *
 * 覆盖（superpowers 替换 opsx 批次 1 任务 1）：
 *   R1  plan 存在 + changeId 须含 phase<phase>- 前缀
 *   R2  计划含目标节 + ≥1 任务节；每个任务节含 ≥1 条验证命令行
 *       （行首「验证：」/「Verify:」；命令体禁 ; & | ——与 RTM evidence command 同规）
 *   R3  账本存在 + 首行身份（# SDD ledger — plan: <计划文件路径>）+ Task N: complete 覆盖
 *   R4  已完成任务三件套（task-N-brief / task-N-report 非空）+ ≥1 个 review-*.diff
 *   R5  R3×9 + V×3 审查产物（stage ∈ plan/execute/finalize）
 *   R6  归档态回退（D-7）：活动位缺失 → docs/changes/archive/<日期>-<changeId>/ 快照
 *       （plan 快照 + 账本快照 + 三件套），恰一匹配；多匹配 fail-closed；零匹配保持缺失文案
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkCodingPlan } from '../logic/coding-plan-logic.js';

const CHANGE_ID = 'phase5-demo';

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-coding-plan-'): string {
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

/** 合法 plan 文本（目标节 + 2 个任务节，各含一条验证命令行） */
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
    '- 文件：`w-model-dev/scripts/logic/coding-plan-logic.ts`',
    '',
    '验证：npm test',
    '',
    '## Task 2: 接线 CLI',
    '',
    '- 文件：`w-model-dev/scripts/cli/check-coding-plan.ts`',
    '',
    'Verify: npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts',
    '',
  ].join('\n');
}

const VALID_LEDGER_LINES = [
  '# SDD ledger — plan: docs/plans/phase5-demo.plan.md',
  '',
  '**分支：** `feat/demo`',
  '',
  '## 进度',
  '',
  'Task 1: complete (commits a..b, review clean)',
  'Task 2: complete (commits b..c, review clean)',
];

/** 账本文本（首行身份按 changeId 绑定 plan 基名） */
function ledgerText(changeId: string): string {
  return `${VALID_LEDGER_LINES.join('\n')}\n`.replace(
    'docs/plans/phase5-demo.plan.md',
    `docs/plans/${changeId}.plan.md`,
  );
}

/** 铺一个完整合法的编码计划制品树（活动位 + R3×9 + V×3），返回项目根 */
function writeValidTree(root: string, phase = 5, changeId = CHANGE_ID): string {
  const planDir = join(root, 'docs', 'plans');
  const ledgerDir = join(root, '.superpowers', 'sdd', `${changeId}.plan`);
  mkdirSync(planDir, { recursive: true });
  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(join(planDir, `${changeId}.plan.md`), validPlanText());
  writeFileSync(join(ledgerDir, 'progress.md'), ledgerText(changeId));
  for (const n of [1, 2]) {
    writeFileSync(join(ledgerDir, `task-${n}-brief.md`), `# task ${n} brief\n`);
    writeFileSync(join(ledgerDir, `task-${n}-report.md`), `# task ${n} report\n`);
  }
  writeFileSync(join(ledgerDir, 'review-abc1234.diff'), 'diff --git a/x b/x\n');
  mkdirSync(join(root, '.w-model', 'r3-reviews'), { recursive: true });
  mkdirSync(join(root, '.w-model', 'v-reviews'), { recursive: true });
  for (const stage of ['plan', 'execute', 'finalize']) {
    for (const dim of ['completeness', 'reliability', 'security']) {
      writeFileSync(
        join(root, '.w-model', 'r3-reviews', `phase${phase}-${stage}-${dim}.md`),
        `# phase${phase}-${stage}-${dim}\n`,
      );
    }
    writeFileSync(join(root, '.w-model', 'v-reviews', `phase${phase}-${stage}.md`), `# phase${phase}-${stage}\n`);
  }
  return root;
}

describe('checkCodingPlan（活动位正例）', () => {
  it('R1-R5 全齐 → passed，计数与产物清单正确', () => {
    const root = writeValidTree(makeTmpDir());
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.planPath).toBe('docs/plans/phase5-demo.plan.md');
    expect(r.ledgerPath).toBe('.superpowers/sdd/phase5-demo.plan/progress.md');
    expect(r.tasksTotal).toBe(2);
    expect(r.tasksCompleted).toBe(2);
    expect(r.artifactsFound).toEqual(
      expect.arrayContaining([
        '.superpowers/sdd/phase5-demo.plan/task-1-brief.md',
        '.superpowers/sdd/phase5-demo.plan/task-1-report.md',
        '.superpowers/sdd/phase5-demo.plan/task-2-brief.md',
        '.superpowers/sdd/phase5-demo.plan/task-2-report.md',
        '.superpowers/sdd/phase5-demo.plan/review-abc1234.diff',
      ]),
    );
    expect(r.reviewsFound).toHaveLength(12);
  });
});

describe('checkCodingPlan（R1 plan 存在 + 前缀）', () => {
  it('R1: 活动位 plan 缺失 → violation（计划缺失）', () => {
    const root = makeTmpDir();
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-demo.plan.md') && v.includes('缺失'))).toBe(true);
    expect(r.planPath).toBeNull();
  });

  it('R1: changeId 不含 phase<phase>- 前缀 → violation（先于存在性检查）', () => {
    const root = makeTmpDir();
    const r = checkCodingPlan(root, 5, 'demo-nophase');
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('不含阶段前缀 phase5-'))).toBe(true);
  });
});

describe('checkCodingPlan（R2 任务节与验证命令行）', () => {
  it('R2: 任务节缺验证命令行 → violation（含任务节标题）', () => {
    const root = writeValidTree(makeTmpDir());
    const planFile = join(root, 'docs', 'plans', `${CHANGE_ID}.plan.md`);
    writeFileSync(planFile, validPlanText().replace('验证：npm test\n', ''));
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('Task 1') && v.includes('验证命令行'))).toBe(true);
  });

  it('R2: 验证命令体含禁用字符（; & |）→ violation（RTM evidence command 同规）', () => {
    const root = writeValidTree(makeTmpDir());
    const planFile = join(root, 'docs', 'plans', `${CHANGE_ID}.plan.md`);
    writeFileSync(planFile, validPlanText().replace('验证：npm test', '验证：npm test && npm run lint'));
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('命令体'))).toBe(true);
  });

  it('R2: 缺目标节 → violation', () => {
    const root = writeValidTree(makeTmpDir());
    const planFile = join(root, 'docs', 'plans', `${CHANGE_ID}.plan.md`);
    writeFileSync(planFile, validPlanText().replace('## 目标', '## 背景说明'));
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('目标节'))).toBe(true);
  });

  it('R2: 零任务节 → violation', () => {
    const root = writeValidTree(makeTmpDir());
    const planFile = join(root, 'docs', 'plans', `${CHANGE_ID}.plan.md`);
    writeFileSync(planFile, '# phase5-demo 编码计划\n\n## 目标\n\n只有目标。\n');
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('任务节'))).toBe(true);
    expect(r.tasksTotal).toBe(0);
  });
});

describe('checkCodingPlan（R3 账本）', () => {
  it('R3: 账本缺失 → violation（bad-missing-ledger 形态）', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`), { recursive: true, force: true });
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('progress.md') && v.includes('缺失'))).toBe(true);
  });

  it('R3: 账本首行身份不符 → violation', () => {
    const root = writeValidTree(makeTmpDir());
    const ledger = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'progress.md');
    writeFileSync(ledger, `${VALID_LEDGER_LINES.join('\n')}\n`.replace('# SDD ledger — plan: ', '# 随手记: '));
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('首行'))).toBe(true);
  });

  it('R3: 账本缺某任务 complete 行 → violation 具名到任务号', () => {
    const root = writeValidTree(makeTmpDir());
    const ledger = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'progress.md');
    writeFileSync(
      ledger,
      `${VALID_LEDGER_LINES.join('\n')}\n`.replace(
        'Task 2: complete (commits b..c, review clean)',
        'Task 2: in progress',
      ),
    );
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.tasksCompleted).toBe(1);
    expect(r.violations.some((v) => v.includes('Task 2') && v.includes('complete'))).toBe(true);
  });

  it('R3: 首行身份指向别的 plan → violation（基名绑定）', () => {
    const root = writeValidTree(makeTmpDir());
    const ledger = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'progress.md');
    writeFileSync(
      ledger,
      `${VALID_LEDGER_LINES.join('\n')}\n`.replace('docs/plans/phase5-demo.plan.md', 'docs/plans/phase5-other.plan.md'),
    );
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('首行'))).toBe(true);
  });
});

describe('checkCodingPlan（R4 任务三件套）', () => {
  it('R4: 已完成任务的 report 缺失 → violation', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'task-2-report.md'), { force: true });
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('task-2-report.md'))).toBe(true);
  });

  it('R4: 已完成任务的 brief 为 0 字节 → violation（非空判据）', () => {
    const root = writeValidTree(makeTmpDir());
    writeFileSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'task-1-brief.md'), '');
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('task-1-brief.md'))).toBe(true);
  });

  it('R4: 无 review-*.diff → violation', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'review-abc1234.diff'), { force: true });
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('review-') && v.includes('.diff'))).toBe(true);
  });

  it('R4: 账本 complete 超出 plan 任务节（Task 5）而三件套缺 → 并集语义仍须查（修复轮 1 负例）', () => {
    const root = writeValidTree(makeTmpDir());
    const ledgerDir = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`);
    writeFileSync(
      join(ledgerDir, 'progress.md'),
      `${ledgerText(CHANGE_ID)}Task 5: complete (commits d..e, review clean)\n`,
    );
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.tasksCompleted).toBe(3);
    // plan 无 Task 5 节（R3 不报），但 R4 以「plan 序号 ∪ complete 号」并集查三件套
    expect(r.violations.some((v) => v.includes('task-5-brief.md'))).toBe(true);
    expect(r.violations.some((v) => v.includes('task-5-report.md'))).toBe(true);
    expect(r.violations.some((v) => v.includes('Task 5') && v.includes('complete 行'))).toBe(false);
  });

  it('R4（伴例）: 账本 complete 超出 plan 任务节但 task-5 三件套齐备 → 不假阳性', () => {
    const root = writeValidTree(makeTmpDir());
    const ledgerDir = join(root, '.superpowers', 'sdd', `${CHANGE_ID}.plan`);
    writeFileSync(
      join(ledgerDir, 'progress.md'),
      `${ledgerText(CHANGE_ID)}Task 5: complete (commits d..e, review clean)\n`,
    );
    writeFileSync(join(ledgerDir, 'task-5-brief.md'), '# task 5 brief\n');
    writeFileSync(join(ledgerDir, 'task-5-report.md'), '# task 5 report\n');
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.tasksCompleted).toBe(3);
    expect(r.artifactsFound).toEqual(
      expect.arrayContaining([
        '.superpowers/sdd/phase5-demo.plan/task-5-brief.md',
        '.superpowers/sdd/phase5-demo.plan/task-5-report.md',
      ]),
    );
  });
});

describe('checkCodingPlan（R5 审查产物，stage 词表 plan/execute/finalize）', () => {
  it('R5: 缺一份 R3 报告 → violation 具名文件', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.w-model', 'r3-reviews', 'phase5-execute-security.md'), { force: true });
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-execute-security.md'))).toBe(true);
    expect(r.reviewsFound).toHaveLength(11);
  });

  it('R5: 缺一份 V 评审 → violation 具名文件', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.w-model', 'v-reviews', 'phase5-finalize.md'), { force: true });
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-finalize.md'))).toBe(true);
  });

  it('R5: 旧 stage 词表（explore）不充数——R3×9 须为 plan/execute/finalize', () => {
    const root = writeValidTree(makeTmpDir());
    rmSync(join(root, '.w-model', 'r3-reviews', 'phase5-plan-reliability.md'), { force: true });
    writeFileSync(join(root, '.w-model', 'r3-reviews', 'phase5-explore-reliability.md'), '# 旧词表\n');
    const r = checkCodingPlan(root, 5, CHANGE_ID);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-plan-reliability.md'))).toBe(true);
  });
});

describe('checkCodingPlan（R6 归档态回退，D-7）', () => {
  const PHASE = 7;
  const CHANGE7 = 'phase7-x';
  const ARCHIVED = '2026-01-01-phase7-x';

  it('R6: 活动位缺失 + 归档快照齐（plan 快照 + 账本快照 + 三件套）→ 按归档位同契约通过', () => {
    const root = makeTmpDir();
    writeValidTree(root, PHASE, CHANGE7);
    // 迁移为归档态：活动位删除，快照复制进 docs/changes/archive/<日期>-<changeId>/
    const archiveDir = join(root, 'docs', 'changes', 'archive', ARCHIVED);
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, `${CHANGE7}.plan.md`),
      readFileSync(join(root, 'docs', 'plans', `${CHANGE7}.plan.md`)),
    );
    writeFileSync(join(archiveDir, 'progress.md'), ledgerText(CHANGE7));
    for (const f of [
      'task-1-brief.md',
      'task-1-report.md',
      'task-2-brief.md',
      'task-2-report.md',
      'review-abc1234.diff',
    ]) {
      writeFileSync(join(archiveDir, f), readFileSync(join(root, '.superpowers', 'sdd', `${CHANGE7}.plan`, f)));
    }
    // 删除活动位
    rmSync(join(root, 'docs', 'plans', `${CHANGE7}.plan.md`), { force: true });
    rmSync(join(root, '.superpowers', 'sdd', `${CHANGE7}.plan`), { recursive: true, force: true });
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r.passed).toBe(true);
    expect(r.planPath).toBe(`docs/changes/archive/${ARCHIVED}/${CHANGE7}.plan.md`);
    expect(r.ledgerPath).toBe(`docs/changes/archive/${ARCHIVED}/progress.md`);
  });

  it('R6: 归档目录缺 plan 快照 → fail-closed violation', () => {
    const root = makeTmpDir();
    const archiveDir = join(root, 'docs', 'changes', 'archive', ARCHIVED);
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(join(archiveDir, 'progress.md'), '# SDD ledger — plan: x\n');
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
  });

  it('R6: 归档目录缺账本快照 progress.md → fail-closed violation', () => {
    const root = makeTmpDir();
    const archiveDir = join(root, 'docs', 'changes', 'archive', ARCHIVED);
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(join(archiveDir, `${CHANGE7}.plan.md`), validPlanText());
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('progress.md'))).toBe(true);
  });

  it('R6: 归档位多匹配 → fail-closed 且具名列出全部匹配目录', () => {
    const root = makeTmpDir();
    for (const dir of ['2026-01-01-phase7-x', '2026-01-02-phase7-x']) {
      const archiveDir = join(root, 'docs', 'changes', 'archive', dir);
      mkdirSync(archiveDir, { recursive: true });
      writeFileSync(join(archiveDir, `${CHANGE7}.plan.md`), validPlanText());
      writeFileSync(join(archiveDir, 'progress.md'), '# SDD ledger — plan: x\n');
    }
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r.passed).toBe(false);
    const multi = r.violations.find((v) => v.includes('多匹配'));
    expect(multi).toBeDefined();
    expect(multi).toContain('2026-01-01-phase7-x');
    expect(multi).toContain('2026-01-02-phase7-x');
  });

  it('R6: 活动位缺失且归档零匹配 → 保持缺失文案（不新增含糊文案）', () => {
    const root = makeTmpDir();
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
    expect(r.violations.some((v) => v.includes('多匹配'))).toBe(false);
  });

  it('R6: 活动位存在时优先活动位（归档残缺不改判定）', () => {
    const root = writeValidTree(makeTmpDir(), PHASE, CHANGE7);
    const archiveDir = join(root, 'docs', 'changes', 'archive', ARCHIVED);
    mkdirSync(archiveDir, { recursive: true }); // 空归档目录：若误走归档位则快照缺失
    const r = checkCodingPlan(root, PHASE, CHANGE7);
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.planPath).toBe(`docs/plans/${CHANGE7}.plan.md`);
  });
});
