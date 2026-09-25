/**
 * coding-plan-logic.test.ts —— 编码计划制品门纯逻辑单元测试（check-coding-plan.ts 的 logic 层）
 *
 * 覆盖（superpowers 替换 opsx 批次 1 任务 1；WS-A fs 注入改造后全量 stub 化）：
 *   R1  plan 存在 + changeId 须含 phase<phase>- 前缀
 *   R2  计划含目标节 + ≥1 任务节；每个任务节含 ≥1 条验证命令行
 *       （行首「验证：」/「Verify:」；命令体禁 ; & | ——与 RTM evidence command 同规）
 *   R3  账本存在 + 首行身份（# SDD ledger — plan: <计划文件路径>）+ Task N: complete 覆盖
 *   R4  已完成任务三件套（task-N-brief / task-N-report 非空）+ ≥1 个 review-*.diff
 *   R5  R3×9 + V×3 审查产物（stage ∈ plan/execute/finalize）
 *   R6  归档态回退（D-7）：活动位缺失 → docs/changes/archive/<日期>-<changeId>/ 快照
 *       （plan 快照 + 账本快照 + 三件套），恰一匹配；多匹配 fail-closed；零匹配保持缺失文案
 *   注入契约（WS-A 新增）：空 stub fail-closed（缺 plan → R1）、缺 ledger → R3；
 *   真适配器集成：`nodeCodingPlanFs` 直打 samples/coding-plan 三 fixture（只读）。
 *
 * IO 语义（WS-A）：logic 层零 `node:fs`，`checkCodingPlan` 第 4 参必选注入 `CodingPlanFs`——
 * 本文件用内存 stub（mkFs 工厂）驱动全部判定；CRLF 归一化保留在 logic 层内容边界
 * （stub 内容直接含 `\r\n` 验证）；适配器行为一致性由真适配器集成例钉死。
 */

import { basename, dirname, join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { nodeCodingPlanFs } from '../lib/coding-plan-fs.js';
import {
  checkCodingPlan,
  collectMissingAnchorReviews,
  extractCompletedTaskNumbers,
  preflightCodingPlan,
  type CodingPlanFs,
} from '../logic/coding-plan-logic.js';

const CHANGE_ID = 'phase5-demo';

/** 内存根（logic 层零 IO 后 projectRoot 只是 stub 的键前缀，无需真实 mkdtemp 临时目录） */
const ROOT = join('stub-projects', 'coding-plan');

/**
 * 内存 fs stub 工厂（仿 gate-enhancement.test.ts 风格）：
 * - `files`：path.join 键 → 文件内容（CRLF 用例直接写含 `\r\n` 的内容——归一化在 logic 层内容边界）；
 * - `dirs`：显式空目录（如「空归档目录」用例）；文件键的父目录自动登记。
 * stat 语义由内容派生：文件 size = UTF-8 字节数（R4 非空判据的 stub 语义）、目录 isFile=false；
 * 未登记路径 existsSync=false，readFileSync/statSync/readdirSync 抛错（同真实 fs fail-fast，
 * 若 logic 层未先 existsSync 即裸调会在测试中显形）。
 */
function mkFs({ files = {}, dirs = [] }: { files?: Record<string, string>; dirs?: string[] } = {}): CodingPlanFs {
  const fileMap = new Map<string, string>(Object.entries(files));
  const dirSet = new Set<string>();
  const registerDir = (dir: string): void => {
    if (dir === ROOT || dirSet.has(dir) || fileMap.has(dir) || !dir.startsWith(ROOT)) return;
    dirSet.add(dir);
    registerDir(dirname(dir));
  };
  for (const key of fileMap.keys()) registerDir(dirname(key));
  for (const dir of dirs) registerDir(dir);
  return {
    existsSync(p) {
      return fileMap.has(p) || dirSet.has(p);
    },
    readFileSync(p) {
      const content = fileMap.get(p);
      if (content === undefined) throw new Error(`stub: readFileSync 未登记路径 ${p}`);
      return content;
    },
    statSync(p) {
      const content = fileMap.get(p);
      if (content !== undefined)
        return {
          isFile: () => true,
          size: Buffer.byteLength(content, 'utf-8'),
        };
      if (dirSet.has(p)) return { isFile: () => false, size: 0 };
      throw new Error(`stub: statSync 未登记路径 ${p}`);
    },
    readdirSync(p) {
      if (!dirSet.has(p)) throw new Error(`stub: readdirSync 未登记目录 ${p}`);
      const entries: Array<{ name: string; isDirectory(): boolean }> = [];
      for (const dir of dirSet) {
        if (dirname(dir) === p) entries.push({ name: basename(dir), isDirectory: () => true });
      }
      for (const file of fileMap.keys()) {
        if (dirname(file) === p) entries.push({ name: basename(file), isDirectory: () => false });
      }
      return entries;
    },
  };
}

/** 覆盖/新增单个文件键（stub 版 writeFileSync） */
function withFile(files: Record<string, string>, key: string, content: string): Record<string, string> {
  return { ...files, [key]: content };
}

/** 浅拷贝并删除精确键或前缀子树（stub 版 rmSync 单文件 / 递归目录） */
function withoutKeys(files: Record<string, string>, ...dropped: string[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    if (dropped.some((d) => k === d || k.startsWith(d + sep))) continue;
    // eslint-disable-next-line security/detect-object-injection -- k 来自本文件自构造 Record 的 Object.entries（非外部输入）
    next[k] = v;
  }
  return next;
}

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

const PLAN_KEY = join(ROOT, 'docs', 'plans', `${CHANGE_ID}.plan.md`);
const LEDGER_KEY = join(ROOT, '.superpowers', 'sdd', `${CHANGE_ID}.plan`, 'progress.md');
const LEDGER_DIR = join(ROOT, '.superpowers', 'sdd', `${CHANGE_ID}.plan`);

/**
 * 铺一个完整合法的编码计划制品树（活动位 + R3×9 + V×3）的内存模型（path.join 键 → 内容）。
 * 行为与改造前的 writeValidTree（真实 mkdtemp + writeFileSync）逐键等价。
 */
function validTreeFiles(root = ROOT, phase = 5, changeId = CHANGE_ID): Record<string, string> {
  const planDir = join(root, 'docs', 'plans');
  const ledgerDir = join(root, '.superpowers', 'sdd', `${changeId}.plan`);
  const files: Record<string, string> = {
    [join(planDir, `${changeId}.plan.md`)]: validPlanText(),
    [join(ledgerDir, 'progress.md')]: ledgerText(changeId),
    [join(ledgerDir, 'task-1-brief.md')]: '# task 1 brief\n',
    [join(ledgerDir, 'task-1-report.md')]: '# task 1 report\n',
    [join(ledgerDir, 'task-2-brief.md')]: '# task 2 brief\n',
    [join(ledgerDir, 'task-2-report.md')]: '# task 2 report\n',
    [join(ledgerDir, 'review-abc1234.diff')]: 'diff --git a/x b/x\n',
  };
  for (const stage of ['plan', 'execute', 'finalize']) {
    for (const dim of ['completeness', 'reliability', 'security']) {
      // 非空（R5 阻断下限）+ 行级证据锚（R5 非阻断诊断的「无缺口」正例形态）
      files[join(root, '.w-model', 'r3-reviews', `phase${phase}-${stage}-${dim}.md`)] =
        `# phase${phase}-${stage}-${dim}\n\nsrc/phase${phase}-${stage}.ts:L1=…\n`;
    }
    files[join(root, '.w-model', 'v-reviews', `phase${phase}-${stage}.md`)] =
      `# phase${phase}-${stage}\n\nsrc/phase${phase}-${stage}.ts:L1=…\n`;
  }
  return files;
}

describe('checkCodingPlan（活动位正例）', () => {
  it('R1-R5 全齐 → passed，计数与产物清单正确', () => {
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files: validTreeFiles() }));
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
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-demo.plan.md') && v.includes('缺失'))).toBe(true);
    expect(r.planPath).toBeNull();
  });

  it('R1: changeId 不含 phase<phase>- 前缀 → violation（先于存在性检查）', () => {
    const r = checkCodingPlan(ROOT, 5, 'demo-nophase', mkFs());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('不含阶段前缀 phase5-'))).toBe(true);
  });
});

describe('checkCodingPlan（R2 任务节与验证命令行）', () => {
  it('R2: 任务节缺验证命令行 → violation（含任务节标题）', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, validPlanText().replace('验证：npm test\n', ''));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('Task 1') && v.includes('验证命令行'))).toBe(true);
  });

  it('R2: 验证命令体含禁用字符（; & |）→ violation（RTM evidence command 同规）', () => {
    const files = withFile(
      validTreeFiles(),
      PLAN_KEY,
      validPlanText().replace('验证：npm test', '验证：npm test && npm run lint'),
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('命令体'))).toBe(true);
  });

  it('R2: 全角冒号「Verify：」前缀的验证行被识别（VERIFY_PREFIXES 全角形态，2026-09-22 打磨）', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, validPlanText().replace('验证：npm test', 'Verify：npm test'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('R2: 缺目标节 → violation', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, validPlanText().replace('## 目标', '## 背景说明'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('目标节'))).toBe(true);
  });

  it('R2: 仅有「非目标」节不充数目标节 → 仍报缺目标节（判据排除非目标/不是目标，2026-09-22 打磨）', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, validPlanText().replace('## 目标', '## 非目标'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('缺目标节'))).toBe(true);
  });

  it('R2: 零任务节 → violation', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, '# phase5-demo 编码计划\n\n## 目标\n\n只有目标。\n');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('任务节'))).toBe(true);
    expect(r.tasksTotal).toBe(0);
  });
});

/**
 * CRLF 行尾归一化（autocrlf 工作树假红修复；WS-A 后保持内容级）：
 * 归一化集中在 logic 层读入边界——`checkCodingPlan` 的 plan / ledger 两处 `fs.readFileSync`
 * 之后与共享纯函数 `extractCompletedTaskNumbers` 入口。stub 直接注入含 `\r\n` 的内容，
 * 钉死：CRLF 内容判绿能力不丢、判红判别力也不丢、归一化不随 fs 适配器迁走。
 */
describe('checkCodingPlan（CRLF 行尾归一化，内容级保持）', () => {
  const toCrLf = (text: string): string => text.replace(/\n/g, '\r\n');

  it('CRLF plan → R2 全绿（目标节/任务节/验证命令全识别）', () => {
    const files = withFile(validTreeFiles(), PLAN_KEY, toCrLf(validPlanText()));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.tasksTotal).toBe(2);
  });

  it('CRLF ledger → R3/R4 全绿（首行身份 + Task N: complete 覆盖识别）', () => {
    const files = withFile(validTreeFiles(), LEDGER_KEY, toCrLf(ledgerText(CHANGE_ID)));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.tasksCompleted).toBe(2);
    expect(r.violations.some((v) => v.includes('首行'))).toBe(false);
  });

  it('CRLF plan 的 Task 2 缺验证行 → 仍报缺验证（判别力不因归一化丢失）', () => {
    const crlfPlan = toCrLf(
      validPlanText().replace(
        'Verify: npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts\n',
        '',
      ),
    );
    const files = withFile(validTreeFiles(), PLAN_KEY, crlfPlan);
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('缺目标节'))).toBe(false);
    expect(r.violations.some((v) => v.includes('缺任务节'))).toBe(false);
    expect(r.violations.some((v) => v.includes('Task 2') && v.includes('缺验证命令行'))).toBe(true);
    expect(r.tasksTotal).toBe(2);
  });

  it('extractCompletedTaskNumbers 对 CRLF 账本内容同样识别 complete 行（共享纯函数入口归一化）', () => {
    expect(extractCompletedTaskNumbers('Task 1: complete\r\nTask 2: complete\r\nTask 3: in progress\r\n')).toEqual(
      new Set([1, 2]),
    );
    // 混合行尾（CRLF 与 LF 共存）同样归一
    expect(extractCompletedTaskNumbers('Task 1: complete\r\nTask 4: complete\n')).toEqual(new Set([1, 4]));
  });
});

describe('checkCodingPlan（R3 账本）', () => {
  it('R3: 账本缺失 → violation（bad-missing-ledger 形态）', () => {
    const files = withoutKeys(validTreeFiles(), LEDGER_DIR);
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('progress.md') && v.includes('缺失'))).toBe(true);
  });

  it('R3: 账本首行身份不符 → violation', () => {
    const files = withFile(
      validTreeFiles(),
      LEDGER_KEY,
      `${VALID_LEDGER_LINES.join('\n')}\n`.replace('# SDD ledger — plan: ', '# 随手记: '),
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('首行'))).toBe(true);
  });

  it('R3: 首行为空行（身份行退居第二行）→ 仍报首行身份不符（严格取文件第一行，不回退首个非空行，2026-09-22 打磨）', () => {
    const files = withFile(validTreeFiles(), LEDGER_KEY, `\n${VALID_LEDGER_LINES.join('\n')}\n`);
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('首行身份不符'))).toBe(true);
  });

  it('R3: 账本缺某任务 complete 行 → violation 具名到任务号', () => {
    const files = withFile(
      validTreeFiles(),
      LEDGER_KEY,
      `${VALID_LEDGER_LINES.join('\n')}\n`.replace(
        'Task 2: complete (commits b..c, review clean)',
        'Task 2: in progress',
      ),
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.tasksCompleted).toBe(1);
    expect(r.violations.some((v) => v.includes('Task 2') && v.includes('complete'))).toBe(true);
  });

  it('R3: 首行身份指向别的 plan → violation（基名绑定）', () => {
    const files = withFile(
      validTreeFiles(),
      LEDGER_KEY,
      `${VALID_LEDGER_LINES.join('\n')}\n`.replace('docs/plans/phase5-demo.plan.md', 'docs/plans/phase5-other.plan.md'),
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('首行'))).toBe(true);
  });
});

describe('checkCodingPlan（R4 任务三件套）', () => {
  it('R4: 已完成任务的 report 缺失 → violation', () => {
    const files = withoutKeys(validTreeFiles(), join(LEDGER_DIR, 'task-2-report.md'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('task-2-report.md'))).toBe(true);
  });

  it('R4: 已完成任务的 brief 为 0 字节 → violation（非空判据；stub statSync.size 按内容字节派生）', () => {
    const files = withFile(validTreeFiles(), join(LEDGER_DIR, 'task-1-brief.md'), '');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('task-1-brief.md'))).toBe(true);
  });

  it('R4: 无 review-*.diff → violation', () => {
    const files = withoutKeys(validTreeFiles(), join(LEDGER_DIR, 'review-abc1234.diff'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('review-') && v.includes('.diff'))).toBe(true);
  });

  it('R4: 账本 complete 超出 plan 任务节（Task 5）而三件套缺 → 并集语义仍须查（修复轮 1 负例）', () => {
    const files = withFile(
      validTreeFiles(),
      LEDGER_KEY,
      `${ledgerText(CHANGE_ID)}Task 5: complete (commits d..e, review clean)\n`,
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.tasksCompleted).toBe(3);
    // plan 无 Task 5 节（R3 不报），但 R4 以「plan 序号 ∪ complete 号」并集查三件套
    expect(r.violations.some((v) => v.includes('task-5-brief.md'))).toBe(true);
    expect(r.violations.some((v) => v.includes('task-5-report.md'))).toBe(true);
    expect(r.violations.some((v) => v.includes('Task 5') && v.includes('complete 行'))).toBe(false);
  });

  it('R4（伴例）: 账本 complete 超出 plan 任务节但 task-5 三件套齐备 → 不假阳性', () => {
    let files = withFile(
      validTreeFiles(),
      LEDGER_KEY,
      `${ledgerText(CHANGE_ID)}Task 5: complete (commits d..e, review clean)\n`,
    );
    files = withFile(files, join(LEDGER_DIR, 'task-5-brief.md'), '# task 5 brief\n');
    files = withFile(files, join(LEDGER_DIR, 'task-5-report.md'), '# task 5 report\n');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
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
    const files = withoutKeys(validTreeFiles(), join(ROOT, '.w-model', 'r3-reviews', 'phase5-execute-security.md'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-execute-security.md'))).toBe(true);
    expect(r.reviewsFound).toHaveLength(11);
  });

  it('R5: 缺一份 V 评审 → violation 具名文件', () => {
    const files = withoutKeys(validTreeFiles(), join(ROOT, '.w-model', 'v-reviews', 'phase5-finalize.md'));
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-finalize.md'))).toBe(true);
  });

  it('R5: 旧 stage 词表（explore）不充数——R3×9 须为 plan/execute/finalize', () => {
    let files = withoutKeys(validTreeFiles(), join(ROOT, '.w-model', 'r3-reviews', 'phase5-plan-reliability.md'));
    files = withFile(files, join(ROOT, '.w-model', 'r3-reviews', 'phase5-explore-reliability.md'), '# 旧词表\n');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-plan-reliability.md'))).toBe(true);
  });
});

/**
 * R5 内容下限与非阻断诊断（2026-09-25 任务 2，D-2 + N-2）：
 * 阻断判据 = 12 份 stage 审查产物**非空**（`statSync(file).size > 0`）；
 * 「含行级证据锚」只是 CLI 侧非阻断诊断（不进 `checkCodingPlan` 返回结构、不改退出码），
 * 理由见 `coding-plan-logic.ts` R5 节与控制者裁定（实测历史 review 产物锚命中为 0）。
 */
describe('checkCodingPlan（R5 内容下限，2026-09-25 任务 2）', () => {
  const R3_DIR = join(ROOT, '.w-model', 'r3-reviews');
  const V_DIR = join(ROOT, '.w-model', 'v-reviews');

  it('R5: R3 审查文件为 0 字节 → violation（内容下限阻断，具名文件）', () => {
    const files = withFile(validTreeFiles(), join(R3_DIR, 'phase5-plan-completeness.md'), '');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-plan-completeness.md') && v.includes('空'))).toBe(true);
    expect(r.reviewsFound).toHaveLength(11); // 0 字节文件不算有效审查产物
  });

  it('R5: V 评审为 0 字节 → violation（V×3 同受非空下限约束）', () => {
    const files = withFile(validTreeFiles(), join(V_DIR, 'phase5-finalize.md'), '');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('phase5-finalize.md') && v.includes('空'))).toBe(true);
  });

  it('R5: 非空但无行级证据锚 → 不违规（锚是非阻断诊断，不构成判据；回归锁定）', () => {
    const files = withFile(
      validTreeFiles(),
      join(R3_DIR, 'phase5-plan-security.md'),
      '# 无锚审查记录\n\n本文件非空但无行级锚。\n',
    );
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.reviewsFound).toHaveLength(12);
  });

  it('R5 诊断收集器：列出「非空但无锚」产物；缺失与 0 字节不进诊断（已由阻断判据报出）', () => {
    let files = withFile(validTreeFiles(), join(R3_DIR, 'phase5-plan-security.md'), '# 无锚\n');
    files = withFile(files, join(V_DIR, 'phase5-execute.md'), '# 无锚\n');
    files = withoutKeys(files, join(R3_DIR, 'phase5-finalize-security.md'));
    files = withFile(files, join(R3_DIR, 'phase5-execute-reliability.md'), '');
    expect(collectMissingAnchorReviews(ROOT, 5, mkFs({ files }))).toEqual([
      '.w-model/r3-reviews/phase5-plan-security.md',
      '.w-model/v-reviews/phase5-execute.md',
    ]);
  });

  it('R5 诊断收集器：默认合法树（每份带锚）→ 空列表（零诊断）', () => {
    expect(collectMissingAnchorReviews(ROOT, 5, mkFs({ files: validTreeFiles() }))).toEqual([]);
  });

  it('R5 锚判据：接受 Lnn= / Lnn-mm= / §sec= 三形态（含 CRLF 行尾）；裸行号（无 L 前缀）不充数', () => {
    let files = withFile(
      validTreeFiles(),
      join(R3_DIR, 'phase5-plan-completeness.md'),
      '# r3\r\n\r\nsrc/a.ts:L12=偏差\r\n',
    );
    files = withFile(files, join(R3_DIR, 'phase5-plan-reliability.md'), '# r3\n\ndocs/b.md:L12-18=区间锚\n');
    files = withFile(files, join(R3_DIR, 'phase5-plan-security.md'), '# r3\n\ndocs/c.md:§goal=节锚\n');
    files = withFile(files, join(R3_DIR, 'phase5-execute-completeness.md'), '# r3\n\nsrc/a.ts:12=裸行号\n');
    expect(collectMissingAnchorReviews(ROOT, 5, mkFs({ files }))).toEqual([
      '.w-model/r3-reviews/phase5-execute-completeness.md',
    ]);
  });
});

/**
 * 修复轮 1 / 发现 1：R5 非阻断诊断的**异常不变量**——`collectMissingAnchorReviews` 是诊断，
 * 任何读盘异常都不得冒泡（冒泡会经 runMain 升级为 UNEXPECTED / exit 2，把裁定 A 的
 * 「诊断不改退出码」打成假象）；`validateStageReviews` 的判据须与 preflight 同口径先判 isFile。
 * 用例一律用注入 stub 制造确定性失败（不依赖 win32/Linux 的目录 size 差异）。
 */
describe('checkCodingPlan（R5 诊断异常不变量与 isFile 守卫，修复轮 1 / 发现 1）', () => {
  const R3_DIR = join(ROOT, '.w-model', 'r3-reviews');

  it('诊断收集器：单份产物读盘抛错（EACCES/EISDIR 形态）→ 不冒泡、按「无锚」计入列表', () => {
    const base = mkFs({ files: validTreeFiles() });
    const target = join(R3_DIR, 'phase5-plan-security.md');
    const throwingFs: CodingPlanFs = {
      ...base,
      readFileSync: (p: string) => {
        if (p === target) throw new Error('EACCES: permission denied, open 审查产物');
        return base.readFileSync(p);
      },
    };
    // checkCodingPlan 只 stat 审查产物、不读其内容 → 注入的抛错夹具不影响既有判定
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, throwingFs);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.reviewsFound).toHaveLength(12);
    expect(() => collectMissingAnchorReviews(ROOT, 5, throwingFs)).not.toThrow();
    expect(collectMissingAnchorReviews(ROOT, 5, throwingFs)).toEqual(['.w-model/r3-reviews/phase5-plan-security.md']);
  });

  it('诊断收集器：statSync 抛错（竞态删除形态）→ 同样不冒泡、按「无锚」计入列表', () => {
    const base = mkFs({ files: validTreeFiles() });
    const target = join(R3_DIR, 'phase5-execute-reliability.md');
    const throwingFs: CodingPlanFs = {
      ...base,
      statSync: (p: string) => {
        if (p === target) throw new Error('ENOENT: no such file or directory (竞态删除)');
        return base.statSync(p);
      },
    };
    expect(() => collectMissingAnchorReviews(ROOT, 5, throwingFs)).not.toThrow();
    expect(collectMissingAnchorReviews(ROOT, 5, throwingFs)).toEqual([
      '.w-model/r3-reviews/phase5-execute-reliability.md',
    ]);
  });

  it('R5 判据：审查产物路径上是目录（非普通文件）→ violation（先判 isFile，不进读盘分支）', () => {
    const dirPath = join(R3_DIR, 'phase5-finalize-security.md');
    // stub 语义：同键的文件优先于目录，故须先摘掉该路径的文件键再登记目录（模拟「同名目录占位」）
    const files = withoutKeys(validTreeFiles(), dirPath);
    const fs = mkFs({ files, dirs: [dirPath] });
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, fs);
    expect(r.passed).toBe(false);
    expect(r.violations).toEqual([
      '.w-model/r3-reviews/phase5-finalize-security.md 非普通文件（R5：stage 审查产物须为文件）',
    ]);
    expect(r.reviewsFound).toHaveLength(11); // 非普通文件不计入有效审查产物
    // 诊断侧：非普通文件按「无锚」计入，且不尝试读盘（不依赖平台目录 size）
    expect(collectMissingAnchorReviews(ROOT, 5, fs)).toEqual(['.w-model/r3-reviews/phase5-finalize-security.md']);
  });

  it('回归：0 字节产物仍走「为空文件」文案（发现 1 的 isFile 前插不得改写既有判据）', () => {
    const files = withFile(validTreeFiles(), join(R3_DIR, 'phase5-plan-completeness.md'), '');
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.violations).toEqual([
      '.w-model/r3-reviews/phase5-plan-completeness.md 为空文件（R5：stage 审查产物须含实质内容）',
    ]);
    expect(r.reviewsFound).toHaveLength(11);
  });
});

/**
 * 电池前清单自检（N-2）：`required` 恒 14 项（9 R3 + 3 V + plan + 账本）为**固定项**；
 * 任务三件套 / `review-*.diff` 为**变长项**，单列 `artifacts` 只列出、不计数、不参与退出判定。
 */
describe('preflightCodingPlan（电池前清单自检，2026-09-25 任务 2）', () => {
  const LEDGER_REL = '.superpowers/sdd/phase5-demo.plan';

  it('列出固定 14 项必需产物 + 具名缺失项；三件套为变长 artifacts（不计数）', () => {
    const files = withoutKeys(validTreeFiles(), join(ROOT, '.w-model', 'r3-reviews', 'phase5-finalize-reliability.md'));
    const r = preflightCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.required).toHaveLength(14);
    expect(r.required).toEqual(
      expect.arrayContaining([
        'docs/plans/phase5-demo.plan.md',
        '.superpowers/sdd/phase5-demo.plan/progress.md',
        '.w-model/r3-reviews/phase5-finalize-reliability.md',
        '.w-model/v-reviews/phase5-finalize.md',
      ]),
    );
    expect(r.missing).toEqual(['.w-model/r3-reviews/phase5-finalize-reliability.md']);
    expect(r.invalid).toEqual([]);
    expect(r.artifacts).toEqual([
      `${LEDGER_REL}/review-abc1234.diff`,
      `${LEDGER_REL}/task-1-brief.md`,
      `${LEDGER_REL}/task-1-report.md`,
      `${LEDGER_REL}/task-2-brief.md`,
      `${LEDGER_REL}/task-2-report.md`,
    ]);
    // 变长项不参与计数：required 恒 14，三件套不出现在 required
    expect(r.required.some((p) => p.includes('task-1-brief.md'))).toBe(false);
  });

  it('必需产物在盘但 0 字节 → 记入 invalid（与 missing 分列；两者都使 preflight 非 0 退出）', () => {
    const files = withFile(validTreeFiles(), join(ROOT, '.w-model', 'v-reviews', 'phase5-plan.md'), '');
    const r = preflightCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files }));
    expect(r.required).toHaveLength(14);
    expect(r.missing).toEqual([]);
    expect(r.invalid).toEqual(['.w-model/v-reviews/phase5-plan.md']);
  });

  it('空树（零产物）→ 14 项全 missing、artifacts 空列表（清单口径与产物状态无关）', () => {
    const r = preflightCodingPlan(ROOT, 5, CHANGE_ID, mkFs());
    expect(r.required).toHaveLength(14);
    expect(r.missing).toHaveLength(14);
    expect(r.invalid).toEqual([]);
    expect(r.artifacts).toEqual([]);
  });
});

describe('checkCodingPlan（fs 注入契约，WS-A 新增）', () => {
  it('注入负例①: 空 stub（缺 plan）→ R1，注入的空文件系统不得假绿（fail-closed）', () => {
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs());
    expect(r.passed).toBe(false);
    expect(r.planPath).toBeNull();
    expect(r.ledgerPath).toBeNull();
    expect(r.violations.some((v) => v.includes('phase5-demo.plan.md') && v.includes('缺失'))).toBe(true);
  });

  it('注入负例②: stub 有 plan 无 ledger → R3（文件键缺失精确传导到账本判定）', () => {
    const r = checkCodingPlan(ROOT, 5, CHANGE_ID, mkFs({ files: { [PLAN_KEY]: validPlanText() } }));
    expect(r.passed).toBe(false);
    expect(r.planPath).toBe('docs/plans/phase5-demo.plan.md');
    expect(r.violations.some((v) => v.includes('progress.md') && v.includes('缺失'))).toBe(true);
  });
});

describe('checkCodingPlan（真适配器 nodeCodingPlanFs 集成，直打 samples/coding-plan 三 fixture，只读）', () => {
  const SAMPLES_CODING_PLAN = join(__dirname, '..', 'samples', 'coding-plan');

  it('valid-phase5 fixture + nodeCodingPlanFs → 通过（适配器行为与 stub 语义一致）', () => {
    const r = checkCodingPlan(join(SAMPLES_CODING_PLAN, 'valid-phase5'), 5, 'phase5-demo', nodeCodingPlanFs);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.planPath).toBe('docs/plans/phase5-demo.plan.md');
    expect(r.ledgerPath).toBe('.superpowers/sdd/phase5-demo.plan/progress.md');
    expect(r.tasksTotal).toBe(2);
    expect(r.tasksCompleted).toBe(2);
    expect(r.reviewsFound).toHaveLength(12);
  });

  it('bad-missing-ledger fixture + nodeCodingPlanFs → R3 progress.md 缺失（负例按预期失败）', () => {
    const r = checkCodingPlan(join(SAMPLES_CODING_PLAN, 'bad-missing-ledger'), 5, 'phase5-demo', nodeCodingPlanFs);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('progress.md') && v.includes('缺失'))).toBe(true);
  });

  it('bad-task-missing-verify fixture + nodeCodingPlanFs → R2 缺验证命令行（负例按预期失败）', () => {
    const r = checkCodingPlan(join(SAMPLES_CODING_PLAN, 'bad-task-missing-verify'), 5, 'phase5-demo', nodeCodingPlanFs);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('缺验证命令行'))).toBe(true);
  });
});

describe('checkCodingPlan（R6 归档态回退，D-7）', () => {
  const PHASE = 7;
  const CHANGE7 = 'phase7-x';
  const ARCHIVED = '2026-01-01-phase7-x';

  /**
   * 铺「活动位缺失 + 归档位快照齐」的内存树；dirName 为归档目录名。
   * 与改造前的 archiveOnlyTree（writeValidTree → 复制 → rmSync）逐键等价：
   * 活动位 plan 删除、账本目录整体迁入归档位、R3×9/V×3 保留在 projectRoot。
   */
  function archiveOnlyFiles(dirName: string): Record<string, string> {
    const active = validTreeFiles(ROOT, PHASE, CHANGE7);
    const archiveDir = join(ROOT, 'docs', 'changes', 'archive', dirName);
    const activeLedgerDir = join(ROOT, '.superpowers', 'sdd', `${CHANGE7}.plan`);
    const moved: Record<string, string> = {};
    for (const [k, v] of Object.entries(active)) {
      if (k === join(activeLedgerDir, 'progress.md')) {
        moved[join(archiveDir, 'progress.md')] = v;
      } else if (k.startsWith(activeLedgerDir + sep)) {
        // eslint-disable-next-line security/detect-object-injection -- k 来自本文件自构造 Record 的 Object.entries（非外部输入）
        moved[join(archiveDir, basename(k))] = v;
      } else if (k !== join(ROOT, 'docs', 'plans', `${CHANGE7}.plan.md`)) {
        // eslint-disable-next-line security/detect-object-injection -- k 来自本文件自构造 Record 的 Object.entries（非外部输入）
        moved[k] = v;
      }
    }
    moved[join(archiveDir, `${CHANGE7}.plan.md`)] = validPlanText();
    return moved;
  }

  it('R6: 活动位缺失 + 归档快照齐（plan 快照 + 账本快照 + 三件套）→ 按归档位同契约通过', () => {
    const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles(ARCHIVED) }));
    expect(r.passed).toBe(true);
    expect(r.planPath).toBe(`docs/changes/archive/${ARCHIVED}/${CHANGE7}.plan.md`);
    expect(r.ledgerPath).toBe(`docs/changes/archive/${ARCHIVED}/progress.md`);
  });

  it('R6: 归档目录缺 plan 快照 → fail-closed violation', () => {
    const files = {
      [join(ROOT, 'docs', 'changes', 'archive', ARCHIVED, 'progress.md')]: '# SDD ledger — plan: x\n',
    };
    const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
  });

  it('R6: 归档目录缺账本快照 progress.md → fail-closed violation', () => {
    const files = {
      [join(ROOT, 'docs', 'changes', 'archive', ARCHIVED, `${CHANGE7}.plan.md`)]: validPlanText(),
    };
    const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files }));
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('progress.md'))).toBe(true);
  });

  it('R6: 归档位多匹配 → fail-closed 且具名列出全部匹配目录', () => {
    const files: Record<string, string> = {};
    for (const dir of ['2026-01-01-phase7-x', '2026-01-02-phase7-x']) {
      const archiveDir = join(ROOT, 'docs', 'changes', 'archive', dir);
      files[join(archiveDir, `${CHANGE7}.plan.md`)] = validPlanText();
      files[join(archiveDir, 'progress.md')] = '# SDD ledger — plan: x\n';
    }
    const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files }));
    expect(r.passed).toBe(false);
    const multi = r.violations.find((v) => v.includes('多匹配'));
    expect(multi).toBeDefined();
    expect(multi).toContain('2026-01-01-phase7-x');
    expect(multi).toContain('2026-01-02-phase7-x');
  });

  it('R6: 活动位缺失且归档零匹配 → 保持缺失文案（不新增含糊文案）', () => {
    const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs());
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
    expect(r.violations.some((v) => v.includes('多匹配'))).toBe(false);
  });

  it('R6: 活动位存在时优先活动位（归档残缺不改判定；显式空目录 stub）', () => {
    const r = checkCodingPlan(
      ROOT,
      PHASE,
      CHANGE7,
      mkFs({
        files: validTreeFiles(ROOT, PHASE, CHANGE7),
        dirs: [join(ROOT, 'docs', 'changes', 'archive', ARCHIVED)], // 空归档目录：若误走归档位则快照缺失
      }),
    );
    expect(r).toMatchObject({ passed: true, violations: [] });
    expect(r.planPath).toBe(`docs/plans/${CHANGE7}.plan.md`);
  });

  describe('R6 归档位锚定化 + 日历校验，2026-09-21 最终评审 I-2', () => {
    it('锚定三态 0：直名 `<changeId>` 归档 → 通过（旧实现能过，新实现不得回归）', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles(CHANGE7) }));
      expect(r).toMatchObject({ passed: true, violations: [] });
      expect(r.planPath).toBe(`docs/changes/archive/${CHANGE7}/${CHANGE7}.plan.md`);
    });

    it('锚定三态 0：`<YYYY-MM-DD>-<changeId>` 归档 → 通过', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('2026-01-01-phase7-x') }));
      expect(r).toMatchObject({ passed: true, violations: [] });
    });

    it('锚定三态 1（多匹配）：直名 + 日期名同时存在 → fail-closed 具名列出两者', () => {
      const files = archiveOnlyFiles(CHANGE7);
      files[join(ROOT, 'docs', 'changes', 'archive', '2026-01-01-phase7-x', `${CHANGE7}.plan.md`)] = validPlanText();
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files }));
      expect(r.passed).toBe(false);
      const multi = r.violations.find((v) => v.includes('多匹配'));
      expect(multi).toContain(CHANGE7);
      expect(multi).toContain('2026-01-01-phase7-x');
    });

    it('锚定：未锚定后缀名不匹配（`<changeId>-extra` 不得被当作归档位）', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('phase7-x-extra') }));
      expect(r.passed).toBe(false);
      // 不得命中归档位：错配目录名只作为「近失」诊断出现，仍报 plan 缺失
      expect(r.violations.some((v) => v.includes('近失'))).toBe(true);
      expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
      // 命中归档位会走 R6 快照文案——这里必须没有
      expect(r.violations.some((v) => v.includes('R6：归档目录须含 plan 快照'))).toBe(false);
    });

    it('锚定：非日期前缀名不匹配（`foo-bar-<changeId>` 不得被当作归档位）', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('foo-bar-phase7-x') }));
      expect(r.passed).toBe(false);
      expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
      // 命中归档位会报「plan 快照缺失」以外的路径——这里必须仍是 R1 缺失文案
      expect(r.violations.some((v) => v.includes('R6：归档目录须含 plan 快照'))).toBe(false);
    });

    it('锚定：多个 changeId 通配/前缀不得互相误配（同阶段兄弟 change 的归档不冒充本 change）', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('2026-01-01-phase7-x-two') }));
      expect(r.passed).toBe(false);
      expect(r.violations.some((v) => v.includes(`${CHANGE7}.plan.md`) && v.includes('缺失'))).toBe(true);
    });

    it('日历校验：`2026-13-45-<changeId>`（形状合法但非真实日历日）→ 独立 fail-closed 文案', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('2026-13-45-phase7-x') }));
      expect(r.passed).toBe(false);
      const violation = r.violations.find((v) => v.includes('非真实日历日'));
      expect(violation).toBeDefined();
      expect(violation).toContain('2026-13-45-phase7-x');
    });

    it('日历校验：`2026-02-30-<changeId>`（当月无该日）同样被拒', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('2026-02-30-phase7-x') }));
      expect(r.passed).toBe(false);
      expect(r.violations.some((v) => v.includes('非真实日历日'))).toBe(true);
    });

    it('日历校验：闰年真实日 `2024-02-29-<changeId>` → 通过（不得过度拒绝）', () => {
      const r = checkCodingPlan(ROOT, PHASE, CHANGE7, mkFs({ files: archiveOnlyFiles('2024-02-29-phase7-x') }));
      expect(r).toMatchObject({ passed: true, violations: [] });
    });

    it('日历校验：非法日期名与合法直名并存 → 合法匹配优先（直名恰一匹配即用；非法目录为显式空目录）', () => {
      const r = checkCodingPlan(
        ROOT,
        PHASE,
        CHANGE7,
        mkFs({
          files: archiveOnlyFiles(CHANGE7),
          dirs: [join(ROOT, 'docs', 'changes', 'archive', '2026-13-45-phase7-x')],
        }),
      );
      expect(r).toMatchObject({ passed: true, violations: [] });
      expect(r.planPath).toBe(`docs/changes/archive/${CHANGE7}/${CHANGE7}.plan.md`);
    });
  });
});
