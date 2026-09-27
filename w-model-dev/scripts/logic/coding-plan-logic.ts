/**
 * 编码计划制品校验纯逻辑层（Coding Plan Logic）
 *
 * 校验 superpowers 编码链（writing-plans → SDD → TDD → code-review）的「编码计划制品契约」
 * （superpowers 替换 opsx 批次 1，docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md §4.2）。
 * 供 `cli/check-coding-plan.ts`（CLI 壳）与 `cli/self-test.ts`（CODING_PLAN_CASES）调用；
 * 本层零 IO——文件访问全部经注入的结构化端口 `CodingPlanFs`（`checkCodingPlan` 第 4 必选参；
 * Node 适配器外置 `lib/coding-plan-fs.ts`；`l0-link-audit-logic` 为 logic 层直连形态先例），
 * 不直连 Node fs 模块、不 import CLI 层、不调用 LLM。
 *
 * 制品契约与校验规则（R1-R6）：
 *   R1  编码计划存在：`docs/plans/<changeId>.plan.md`；changeId 须含 `phase<phase>-` 前缀
 *       （phase 归属一致性，先于存在性检查；顺序与已退役的 check-opsx-artifacts 一致）。
 *   R2  计划结构：含**目标节**（标题文本含「目标」的 Markdown 标题行）+ **≥1 个任务节**
 *       （标题匹配 `Task N` / `任务 N` 的标题行，节 = 该标题行到下一个标题行）；
 *       每个任务节含 ≥1 条**验证命令行**——行首（允许前置空白）为「验证：」/「Verify:」
 *       （全半角冒号均接受），命令体非空且禁 `;` / `&` / `|`（与 RTM evidence command 同规；
 *       换行按行解析天然排除）。
 *   R3  执行账本：`.superpowers/sdd/<plan-基名>/progress.md`（plan-基名 = plan 文件名去
 *       扩展名，如 `<changeId>.plan`）存在；首行身份 `# SDD ledger — plan: <计划文件路径>`
 *       （严格取文件第一行，前导空行不回退；路径须以 plan 文件名结尾）；`Task N: complete`
 *       行对 plan 每个任务节具名覆盖（覆盖数 < 任务节数即违规，具名到任务号）。
 *   R4  任务三件套：每个已完成任务 N 的 `task-<N>-brief.md` 与 `task-<N>-report.md` 存在且
 *       非空（>0 字节）；账本目录内须存在至少一个 `review-*.diff`（任务评审包 diff 证据）。
 *   R5  审查产物：`.w-model/r3-reviews/phase<phase>-<stage>-<dim>.md` ×9 +
 *       `.w-model/v-reviews/phase<phase>-<stage>.md` ×3，stage ∈ {plan, execute, finalize}、
 *       dim ∈ {completeness, reliability, security}（文件命名规则沿袭已退役的 check-opsx-artifacts
 *       的 validateStageReviews，仅 stage 词表换新；旧词表不充数）。
 *       阻断下限 = 文件**存在、为普通文件且非空**（`isFile() && size > 0`，2026-09-25 任务 2 / D-2）；
 *       「含行级证据锚」（`path:Lnn=` / `path:§sec=`）只是**非阻断诊断**——由 `collectMissingAnchorReviews`
 *       单独收集、经 CLI stderr 一行提示，不进本模块返回结构、不改退出码、不进 GATE_JSON 聚合
 *       （控制者裁定：实测历史 review 产物锚命中为 0，阻断化会打红全部既有项目与证据）；
 *       该诊断函数**读盘异常一律不外抛**（按「无锚」计），保证「诊断不改退出码」不是假象。
 *   前置自检（N-2）：`preflightCodingPlan` 只读列出本阶段固定 14 项必需产物（9 R3 + 3 V + plan + 账本）
 *       与 missing/invalid，变长任务三件套单列 `artifacts` 不计数——供 O 在电池前一次性对齐。
 *   R6  归档态回退（D-7 平移）：活动位 plan 缺失时回退归档位
 *       `docs/changes/archive/<changeId>/` 或 `docs/changes/archive/<YYYY-MM-DD>-<changeId>/`
 *       （**锚定匹配**：目录名恰为 `<changeId>`，或 `<YYYY-MM-DD>-` 定长前缀 + 恰为 `<changeId>`
 *       且日期前缀通过日历回读校验；`<changeId>-extra` / `foo-<changeId>` 等相似名不匹配，
 *       非法日历日如 `2026-13-45-<changeId>` 独立成态 fail-closed。**恰一匹配**才可用，多匹配 fail-closed）；
 *       归档态按同契约校验归档目录内的
 *       plan 快照（`<changeId>.plan.md`）与账本快照（`progress.md`）+ 三件套，
 *       快照缺失即 fail-closed；活动位存在时优先活动位（归档残缺不改判定）。
 *
 * 退出语义由 CLI 层裁：passed=false → exit 1；输入错误 → exit 2。
 *
 * @module
 */

import * as path from 'node:path';

/**
 * 结构化文件系统端口（logic 层零 fs 直连；注入必选参 + 适配器外置 `lib/coding-plan-fs.ts` 形态，
 * `l0-link-audit-logic` 为直连形态先例）。
 *
 * 只声明本模块实际消费的四个只读方法（结构化类型，不引 Node 类型）：
 * - `existsSync` / `statSync`：存在性与类型/大小判定（plan / 账本 / 三件套非空；
 *   `isDirectory` 供 preflight 枚举前守卫，G3-5）；
 * - `readFileSync`：文本读入（UTF-8 解码由适配器固定；CRLF → LF 归一化仍在本层内容边界做）；
 * - `readdirSync({ withFileTypes: true })`：目录枚举（归档位锚定匹配 + review-*.diff 探测）。
 *
 * 生产注入 `lib/coding-plan-fs.ts` 的 `nodeCodingPlanFs`；测试注入内存 stub。
 */
export interface CodingPlanFs {
  existsSync(p: string): boolean;
  readFileSync(p: string): string;
  statSync(p: string): { isFile(): boolean; isDirectory(): boolean; size: number };
  readdirSync(p: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
}

/** R3×9 三维度（词表沿袭已退役的 check-opsx-artifacts） */
const REQUIRED_R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/** 编码链 stage 词表（旧 explore/propose/coding 语义平移；旧词表不充数） */
export const CODING_PLAN_STAGES = ['plan', 'execute', 'finalize'] as const;

/** 校验结果（CLI 收尾 CODING_PLAN_JSON 与 --json 单行报告共用的字段源） */
export interface CodingPlanCheckResult {
  passed: boolean;
  violations: string[];
  /** 已校验 plan 的 projectRoot 相对路径（POSIX 分隔）；活动位缺失且归档零匹配时为 null */
  planPath: string | null;
  /** 已校验账本的 projectRoot 相对路径（POSIX 分隔）；plan 未定位时为 null */
  ledgerPath: string | null;
  /** plan 内解析出的任务节数（R2） */
  tasksTotal: number;
  /** 账本内 distinct `Task N: complete` 任务号数（R3） */
  tasksCompleted: number;
  /** 三件套与 review diff 中实际在盘的条目（projectRoot 相对 POSIX 路径） */
  artifactsFound: string[];
  /** R5 实际在盘的审查产物短名（如 `plan-completeness` / `execute-V`） */
  reviewsFound: string[];
}

/**
 * 变更目录解析结果（D-7 五态，与已退役 check-opsx-artifacts 的 resolveChangeDirName 同构 + 日历校验态）
 *
 * - `active`：活动位 `docs/plans/<changeId>.plan.md` 存在（永远优先）；
 * - `archive`：归档位恰一锚定匹配；
 * - `ambiguous`：锚定匹配 >1（fail-closed，不任取其一）；
 * - `invalid-date`：名字按 `<YYYY-MM-DD>-<changeId>` 锚定命中但日期前缀非真实日历日（fail-closed）；
 * - `none`：零匹配（`nearMisses` 列出含 changeId 子串但未锚定命中的目录名，仅作诊断）。
 */
type PlanResolution =
  | { kind: 'active' }
  | { kind: 'archive'; dirName: string }
  | { kind: 'ambiguous'; matches: string[] }
  | { kind: 'invalid-date'; dirNames: string[] }
  | { kind: 'none'; nearMisses: string[] };

/** 归档日期前缀：`<YYYY-MM-DD>-`（定长 11 字符） */
const ARCHIVE_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}-/;
const ARCHIVE_DATE_PREFIX_LENGTH = 11;

/**
 * 日期前缀段日历校验：解析 YYYY-MM-DD 并用 Date.UTC 回读核对
 * （拒绝 `2026-13-45` / `2026-02-30` 等形状合法但非真实日历日的前缀）。
 * 年份下限 100：`Date.UTC` 对 0-99 年按 1900+ 处理，回读校验使 0-99 实际判非法（`0000` 同样被拒）。
 */
function isValidArchiveDatePrefix(datePrefix: string): boolean {
  const year = Number(datePrefix.slice(0, 4));
  const month = Number(datePrefix.slice(5, 7));
  const day = Number(datePrefix.slice(8, 10));
  if (!Number.isInteger(year) || year < 100 || year > 9999) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/**
 * 归档位目录名锚定判据（**单实现**，供 archivePlanDirs 与日历校验态共用）：
 * 恰为 `<changeId>`，或 `<YYYY-MM-DD>-<changeId>` **且**日期前缀通过日历回读校验。
 * 未锚定后缀（`<changeId>-extra` / `<changeId>-2`）与任意非日期前缀名（`foo-bar-<changeId>`）一律不匹配。
 */
function matchesArchiveDirName(name: string, changeId: string): boolean {
  if (name === changeId) return true;
  if (name.length <= ARCHIVE_DATE_PREFIX_LENGTH) return false;
  const datePrefix = name.slice(0, ARCHIVE_DATE_PREFIX_LENGTH);
  if (!ARCHIVE_DATE_PREFIX_RE.test(datePrefix)) return false;
  if (name.slice(ARCHIVE_DATE_PREFIX_LENGTH) !== changeId) return false;
  return isValidArchiveDatePrefix(datePrefix);
}

/** 归档位锚定候选目录名（仅匹配项；localeCompare 排序保证违规条目顺序稳定） */
function archivePlanDirs(archiveRoot: string, changeId: string, fs: CodingPlanFs): string[] {
  if (!fs.existsSync(archiveRoot)) return [];
  return fs
    .readdirSync(archiveRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && matchesArchiveDirName(e.name, changeId))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 活动位 / 归档位解析：活动位 plan 存在即 active；否则回退归档位。
 * 归档位的三个判定面（锚定命中 / 日期非法 / 近失名）各自成态，任何一态都不静默放过。
 */
function resolvePlanLocation(projectRoot: string, changeId: string, fs: CodingPlanFs): PlanResolution {
  const plansDir = path.join(projectRoot, 'docs', 'plans');
  if (fs.existsSync(path.join(plansDir, `${changeId}.plan.md`))) return { kind: 'active' };
  const archiveRoot = path.join(projectRoot, 'docs', 'changes', 'archive');
  const matches = archivePlanDirs(archiveRoot, changeId, fs);
  if (matches.length === 1) return { kind: 'archive', dirName: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  const archived = listArchiveDirNames(archiveRoot, fs);
  // 形状锚定命中但日期前缀非法：独立成态 fail-closed（不得退化成「未归档」）
  const invalidDates = archived.filter((name) => {
    if (name.length <= ARCHIVE_DATE_PREFIX_LENGTH) return false;
    const datePrefix = name.slice(0, ARCHIVE_DATE_PREFIX_LENGTH);
    if (!ARCHIVE_DATE_PREFIX_RE.test(datePrefix)) return false;
    return name.slice(ARCHIVE_DATE_PREFIX_LENGTH) === changeId && !isValidArchiveDatePrefix(datePrefix);
  });
  if (invalidDates.length > 0) return { kind: 'invalid-date', dirNames: invalidDates };
  return { kind: 'none', nearMisses: archived.filter((name) => name.includes(changeId)) };
}

/** 归档根下的目录名（仅诊断用；排序稳定） */
function listArchiveDirNames(archiveRoot: string, fs: CodingPlanFs): string[] {
  if (!fs.existsSync(archiveRoot)) return [];
  return fs
    .readdirSync(archiveRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** 统一为 POSIX 分隔的 projectRoot 相对路径（violations / 返回结构展示用） */
function toRel(...segments: string[]): string {
  return segments.join('/');
}

/** 执行账本文件名（单源）：活动位与归档位快照同名 `progress.md` */
const LEDGER_FILE_NAME = 'progress.md';

/** 执行账本目录（单源，projectRoot 相对 POSIX）：`.superpowers/sdd/<planId>`；planId = `<changeId>.plan` */
function sddLedgerDirRel(planId: string): string {
  return toRel('.superpowers', 'sdd', planId);
}

/**
 * 执行账本文件（单源，projectRoot 相对 POSIX）：`.superpowers/sdd/<planId>/progress.md`。
 *
 * 活动位账本路径的唯一事实源：preflight 的必需项、`checkCodingPlan` 的账本定位与返回的 `ledgerPath`
 * 全部经它派生（绝对路径 = `path.join(projectRoot, PROGRESS_REL(planId))`，`path.join` 归一化 `/`，
 * 跨平台与 `path.join` 分段拼接同值）；归档位账本在归档目录内，按同名的 `LEDGER_FILE_NAME` 拼装。
 */
export const PROGRESS_REL = (planId: string): string => toRel(sddLedgerDirRel(planId), LEDGER_FILE_NAME);

/**
 * CRLF → LF 行尾归一化（内容解析边界单点）。
 *
 * 背景（autocrlf 工作树假红修复）：仓库 blob 为 LF，但 `core.autocrlf=true` 检出使工作树
 * 文本文件行尾为 CRLF；本模块的内容解析按 `split('\n')` + 行尾敏感正则（如 `headingTitle`
 * 的 `(.+)$` 无 m 标志）工作，未归一化的行尾 `\r` 会使所有标题行判空、`Task N: complete`
 * 失配、首行身份失配 → R2「缺目标节+缺任务节」等全量假红（合成 vitest 夹具用 LF 故从未暴露，
 * 由 prepush 验收环境的 autocrlf 工作树暴露）。归一化集中在**读入边界**——本模块两处
 * `readFileSync` 之后与共享纯函数 `extractCompletedTaskNumbers` 入口（其内容来源不可控，
 * `archive-integrity-logic` 复用）——不散在逐处正则。
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/** plan 文本的一行是否为 Markdown 标题（1-6 级），返回标题文本；非标题返回 null */
function headingTitle(line: string): string | null {
  const m = line.match(/^#{1,6}\s+(.*)$/);
  return m === null ? null : (m[1]?.trim() ?? '');
}

interface PlanSection {
  /** 任务节标题（含 Task N / 任务 N 原文）；目标节无编号语义时为 null */
  title: string;
  /** 任务号（Task 3 → 3）；非任务节为 null */
  taskNumber: number | null;
  /** 节内文本行（标题行之后到下一个标题行之前） */
  bodyLines: string[];
}

/** 验证命令行前缀（行首；全半角冒号均接受——Verify 的全角冒号形态曾误写成 ASCII 重复项） */
const VERIFY_PREFIXES = ['验证：', '验证:', 'Verify:', 'Verify：'] as const;

/** 提取一行内的验证命令体；非验证命令行返回 null；命令体含禁用字符返回 { command, forbidden } */
function extractVerifyCommand(line: string): { command: string; forbidden: string[] | null } | null {
  const trimmed = line.trimStart();
  for (const prefix of VERIFY_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      const command = trimmed.slice(prefix.length).trim();
      if (command === '') return { command: '', forbidden: null };
      const forbidden = [';', '&', '|'].filter((ch) => command.includes(ch));
      return { command, forbidden: forbidden.length > 0 ? forbidden : null };
    }
  }
  return null;
}

/**
 * 解析 plan 文本结构（R2）：目标节有无 + 任务节列表（含逐任务验证命令行判定）。
 * 判定结果不直接成 violation——由调用方按任务节具名聚合，保持 violations 可定位。
 */
function parsePlanStructure(planContent: string): {
  hasGoalSection: boolean;
  sections: PlanSection[];
  tasksWithoutVerify: string[];
  forbiddenCommandLines: string[];
} {
  const lines = planContent.split('\n');
  let hasGoalSection = false;
  const sections: PlanSection[] = [];
  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i 为 for 循环受控下标（0..lines.length-1），读取本函数 split 出的行
    const line = lines[i]!;
    const title = headingTitle(line);
    if (title === null) continue;
    // 目标节判据：标题含「目标」且不为「非目标/不是目标」（「非目标」节只是子串命中，不充数目标节）
    if (title.includes('目标') && !/非目标|不是目标/.test(title)) hasGoalSection = true;
    const taskMatch = title.match(/^(?:task|任务)\s*(\d+)/i);
    if (taskMatch === null) continue;
    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      // eslint-disable-next-line security/detect-object-injection -- j 为内层受控下标，同上
      const bodyLine = lines[j]!;
      if (headingTitle(bodyLine) !== null) break;
      bodyLines.push(bodyLine);
    }
    sections.push({ title, taskNumber: Number(taskMatch[1]), bodyLines });
  }
  const tasksWithoutVerify: string[] = [];
  const forbiddenCommandLines: string[] = [];
  for (const section of sections) {
    let hasVerify = false;
    for (const bodyLine of section.bodyLines) {
      const verify = extractVerifyCommand(bodyLine);
      if (verify === null) continue;
      if (verify.command === '') continue; // 空命令体视同缺验证行
      hasVerify = true;
      if (verify.forbidden !== null) {
        forbiddenCommandLines.push(
          `${section.title}：命令体含禁用字符 ${verify.forbidden.join(' ')}（${verify.command}）`,
        );
      }
    }
    if (!hasVerify) tasksWithoutVerify.push(section.title);
  }
  return { hasGoalSection, sections, tasksWithoutVerify, forbiddenCommandLines };
}

/**
 * 提取账本内 distinct `Task N: complete` 任务号集合（R3）。
 *
 * 共享纯函数：`logic/archive-integrity-logic.ts` 的 `codingPlanSnapshot` 清单项（并入自
 * check-openspec-archive 退役）import 同一实现，保证「Task N: complete」判定口径全仓单点。
 */
export function extractCompletedTaskNumbers(ledgerContent: string): Set<number> {
  const completed = new Set<number>();
  for (const line of normalizeLineEndings(ledgerContent).split('\n')) {
    const m = line.match(/^Task\s+(\d+):\s*complete\b/);
    if (m !== null) completed.add(Number(m[1]));
  }
  return completed;
}

/** R3×9 + V×3 清单项（stage × dim 展开的**唯一命名源**；校验、诊断、preflight 三处共用） */
interface StageReviewEntry {
  /** projectRoot 相对 POSIX 路径（violations / preflight 展示用） */
  rel: string;
  /** 绝对路径（fs 端口键） */
  abs: string;
  /** 短名（`reviewsFound` 用：R3 为 `<stage>-<dim>`，V 为 `<stage>-V`） */
  label: string;
  /** R3 / V（preflight 的 required 分组顺序 + 缺失文案分支） */
  kind: 'r3' | 'v';
  /** 缺失文案后半句（R3 与 V 的既有文案逐字保留） */
  missingNote: string;
}

/**
 * 展开 R3×9 + V×3 审查产物清单（**零 IO**，只拼路径）。
 * 顺序 = stage 主序（plan → execute → finalize），每 stage 内 3 个 dim 再 V，
 * 与既有 `reviewsFound` 顺序逐项一致（C3 等既有断言不因重构漂移）。
 */
function stageReviewEntries(projectRoot: string, phase: number): StageReviewEntry[] {
  const entries: StageReviewEntry[] = [];
  for (const stage of CODING_PLAN_STAGES) {
    for (const dim of REQUIRED_R3_DIMENSIONS) {
      const fileName = `phase${phase}-${stage}-${dim}.md`;
      entries.push({
        rel: toRel('.w-model', 'r3-reviews', fileName),
        abs: path.join(projectRoot, '.w-model', 'r3-reviews', fileName),
        label: `${stage}-${dim}`,
        kind: 'r3',
        missingNote: '编码链 stage 审查产物须齐备',
      });
    }
    const vFileName = `phase${phase}-${stage}.md`;
    entries.push({
      rel: toRel('.w-model', 'v-reviews', vFileName),
      abs: path.join(projectRoot, '.w-model', 'v-reviews', vFileName),
      label: `${stage}-V`,
      kind: 'v',
      missingNote: '编码链 V 评审须齐备',
    });
  }
  return entries;
}

/**
 * R5 行级证据锚判据（**非阻断诊断**用）：行首（允许前置空白）为 `path:Lnn=` / `path:Lnn-mm=` /
 * `path:§sec=` 形态。控制者裁定 O-4 逐字给定该形态（下文正则的**接受语言**与其逐字等价），
 * 不阻断、不进聚合。
 *
 * 正则写法：原 `L\d+(?:-\d+)?` 是「含量词组再被量化」形态（star height 2），虽为线性回溯，
 * 仍会被 `security/detect-unsafe-regex` 判为不安全（同仓先例：verifier-logic.ts R12 判据、
 * pollution-logic.ts 残留名判据）。故平铺为 `L(?:\d+-\d+|\d+)`——两分支共享 `L` 字面锚、
 * 均为顺序量词（star height 1），`Lnn` / `Lnn-mm` 两个形态与原文法逐字等价。
 */
const REVIEW_ANCHOR_RE = /(?:^|\n)\s*[\w/.-]+:(?:§[\w.-]+|L(?:\d+-\d+|\d+))=/;

/**
 * 校验 R3×9 + V×3 审查产物（project 级）；阻断下限 = 存在 + **普通文件** + 非空
 * （`!isFile() || size === 0` 判违规——与同文件 `preflightCodingPlan` 及 R3 账本/plan 的 isFile 守卫同口径；
 * 非普通文件（目录等）不再进入读盘分支，跨平台行为一致：Linux 目录 size=4096 不得因此被判「通过」）。
 */
function validateStageReviews(
  projectRoot: string,
  phase: number,
  fs: CodingPlanFs,
  violations: string[],
  reviewsFound: string[],
): void {
  for (const entry of stageReviewEntries(projectRoot, phase)) {
    if (!fs.existsSync(entry.abs)) {
      violations.push(`${entry.rel} 缺失（R5：${entry.missingNote}）`);
      continue;
    }
    // 先判 isFile（再判 size）：非普通文件在 win32 上 size 可能为 0、在 Linux 上为 4096，
    // 单一 size 判据会跨平台不一致；非普通文件也不得进入后续任何读盘
    const stat = fs.statSync(entry.abs);
    if (!stat.isFile()) {
      violations.push(`${entry.rel} 非普通文件（R5：stage 审查产物须为文件）`);
      continue;
    }
    if (stat.size === 0) {
      violations.push(`${entry.rel} 为空文件（R5：stage 审查产物须含实质内容）`);
      continue;
    }
    reviewsFound.push(entry.label);
  }
}

/**
 * R5 非阻断诊断收集器：列出「在盘且可读、但未含行级证据锚」的审查产物（projectRoot 相对 POSIX 路径，
 * 呈 `stageReviewEntries` 顺序）。缺失 / 0 字节文件不进本列表——它们已由阻断判据具名报出，
 * 重复诊断只会稀释信号。调用方（`cli/check-coding-plan.ts`）据此向 stderr 打一行提示；
 * **不参与** `checkCodingPlan` 返回结构、退出码、GATE_JSON 聚合（控制者裁定 A）。
 *
 * **异常不变量（修复轮 1 / 发现 1）**：本函数是**非阻断诊断**，其任何读盘异常都不得冒泡——
 * `readFileSync` 对「目录 / 权限不足 / 竞态删除」会抛 `EISDIR` / `EACCES` / `ENOENT`，冒泡即经
 * CLI → `runMain` 升级为 `UNEXPECTED` / exit 2，会把裁定 A 的「诊断不改退出码」打成假象
 * （Linux 下目录 size=4096 更能穿透 R5 判据直抵读盘）。故逐条 `try/catch`：读失败 / 非普通文件
 * 一律按「无锚」计入诊断列表并继续，函数**任何输入下都只返回 `string[]`**。
 */
export function collectMissingAnchorReviews(projectRoot: string, phase: number, fs: CodingPlanFs): string[] {
  const gaps: string[] = [];
  for (const entry of stageReviewEntries(projectRoot, phase)) {
    if (!fs.existsSync(entry.abs)) continue;
    try {
      const stat = fs.statSync(entry.abs);
      if (!stat.isFile()) {
        // 非普通文件：无有效锚可言（且不读盘，跨平台行为一致）
        gaps.push(entry.rel);
        continue;
      }
      if (stat.size === 0) continue; // 0 字节：已由 R5 阻断判据具名报出，不重复诊断
      if (!REVIEW_ANCHOR_RE.test(fs.readFileSync(entry.abs))) gaps.push(entry.rel);
    } catch {
      // 读盘失败（EISDIR / EACCES / 竞态等）：按「无锚」计，绝不冒泡（裁定 A）
      gaps.push(entry.rel);
    }
  }
  return gaps;
}

/**
 * 电池前自检结果（`cli/check-coding-plan.ts --preflight` 的单行 JSON 载荷）。
 *
 * - `required`：**固定 14 项**（9 份 `r3-reviews` + 3 份 `v-reviews` + plan + 账本；活动位路径）；
 * - `missing` / `invalid`：在 `required` 上单遍分类（不存在 = missing；在盘但非普通文件或 0 字节 = invalid），
 *   两者都使 preflight 退出码非 0（`missing.length + invalid.length === 0 ? 0 : 1`）；
 * - `artifacts`：**变长项**（账本目录内实际在盘的 `task-<N>-{brief,report}.md` 与 `review-*.diff`）
 *   只列出、不计数、不参与退出判定（三件套号数随任务推进而变，塞进「固定必需项」语义不成立）。
 */
export interface PreflightResult {
  /** 固定 14 项必需产物（projectRoot 相对 POSIX 路径） */
  required: string[];
  /** 必需产物中不在盘的（保持 required 相对顺序） */
  missing: string[];
  /** 必需产物中在盘但非普通文件或 0 字节的（保持 required 相对顺序） */
  invalid: string[];
  /** 变长项：账本目录内在盘的三件套与评审包 diff（仅列出） */
  artifacts: string[];
}

/** R4 口径的任务三件套文件名（单源）：`task-<N>-<kind>.md`（R4 存在性探测构造名，与下方判据同规） */
export const taskArtifactName = (taskNumber: number, kind: 'brief' | 'report'): string =>
  `task-${taskNumber}-${kind}.md`;
/** R4 口径的任务三件套名判据（单源；preflight 枚举用，接受语言 = `taskArtifactName` 的输出集） */
export const TASK_ARTIFACT_RE = /^task-\d+-(?:brief|report)\.md$/;
/** R4 口径的评审包 diff 名判据（单源；preflight 枚举与 R4 存在性探测共用，不再各处内联） */
export const REVIEW_DIFF_RE = /^review-.+\.diff$/;

/**
 * 电池前清单自检（只读）：列出本阶段**固定 14 项**必需产物与 missing/invalid，单列变长 `artifacts`。
 *
 * 语义边界（与 `checkCodingPlan` 的关系）：
 * - 只看**活动位** `docs/plans/<changeId>.plan.md` + `.superpowers/sdd/<changeId>.plan/progress.md`——
 *   归档态回退（R6）是门禁内的收口语义，不是「电池前对齐」的场景；
 * - 只判「在盘与否 / 是否 0 字节」，不判 plan 结构、账本身份、任务覆盖等内容判据（那是门的职责，
 *   本函数不改任何门的判据与退出码语义）——所以它能在 S 产出**之前**给出对齐清单。
 */
export function preflightCodingPlan(
  projectRoot: string,
  phase: number,
  changeId: string,
  fs: CodingPlanFs,
): PreflightResult {
  const entries = stageReviewEntries(projectRoot, phase);
  const planId = `${changeId}.plan`;
  const ledgerRelDir = sddLedgerDirRel(planId);
  const ledgerDir = path.join(projectRoot, ledgerRelDir);
  const requiredEntries = [
    // 9 份 R3 + 3 份 V（分组顺序与契约表述一致：R3×9 在前、V×3 在后）
    ...entries.filter((e) => e.kind === 'r3'),
    ...entries.filter((e) => e.kind === 'v'),
    {
      rel: toRel('docs', 'plans', `${changeId}.plan.md`),
      abs: path.join(projectRoot, 'docs', 'plans', `${changeId}.plan.md`),
    },
    { rel: PROGRESS_REL(planId), abs: path.join(projectRoot, PROGRESS_REL(planId)) },
  ];
  const required = requiredEntries.map((e) => e.rel);

  const missing: string[] = [];
  const invalid: string[] = [];
  for (const entry of requiredEntries) {
    if (!fs.existsSync(entry.abs)) {
      missing.push(entry.rel);
      continue;
    }
    const stat = fs.statSync(entry.abs);
    if (!stat.isFile() || stat.size === 0) invalid.push(entry.rel);
  }

  let artifacts: string[] = [];
  // G3-5：枚举前先判 isDirectory——账本路径是普通文件（或其它非目录形态）时 readdirSync 会裸抛
  // ENOTDIR（旧行为：经 runMain 升级为 UNEXPECTED / exit 2 + 原始栈）；非目录按「无可枚举项」处理
  // （artifacts 空列表，缺失仍由 required 的 progress.md 具名报出）。真正的探测竞态
  // （existsSync 与 statSync 之间条目被删）由 CLI 侧 try/catch 折算为结构化 FILE_NOT_FOUND。
  if (fs.existsSync(ledgerDir) && fs.statSync(ledgerDir).isDirectory()) {
    artifacts = fs
      .readdirSync(ledgerDir, { withFileTypes: true })
      .map((e) => e.name)
      .filter((name) => TASK_ARTIFACT_RE.test(name) || REVIEW_DIFF_RE.test(name))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => toRel(ledgerRelDir, name));
  }

  return { required, missing, invalid, artifacts };
}

/** 校验账本（R3）+ 三件套（R4）；plan 上下文用于首行身份绑定 */
function validateLedgerAndArtifacts(
  ledgerDir: string,
  ledgerRelDir: string,
  planFileName: string,
  taskNumbers: number[],
  fs: CodingPlanFs,
  violations: string[],
  artifactsFound: string[],
): number {
  const ledgerPath = path.join(ledgerDir, LEDGER_FILE_NAME);
  const ledgerRel = toRel(ledgerRelDir, LEDGER_FILE_NAME);
  if (!fs.existsSync(ledgerPath) || !fs.statSync(ledgerPath).isFile()) {
    violations.push(`${ledgerRel} 缺失（R3：执行账本须随编码计划落盘）`);
    return 0;
  }
  const ledgerContent = normalizeLineEndings(fs.readFileSync(ledgerPath));
  // 首行身份严格取文件第一行（前导空行不回退到首个非空行——身份行退居第二行即判不符）
  const firstLine = ledgerContent.split('\n')[0] ?? '';
  const LEDGER_IDENTITY_PREFIX = '# SDD ledger — plan: ';
  if (!firstLine.startsWith(LEDGER_IDENTITY_PREFIX)) {
    violations.push(`${ledgerRel} 首行身份不符（R3：首行须为「${LEDGER_IDENTITY_PREFIX}<计划文件路径>」）`);
  } else if (!firstLine.slice(LEDGER_IDENTITY_PREFIX.length).trim().endsWith(planFileName)) {
    violations.push(
      `${ledgerRel} 首行身份指向别的计划（R3：首行路径须以 ${planFileName} 结尾，实际「${firstLine.slice(LEDGER_IDENTITY_PREFIX.length).trim()}」）`,
    );
  }
  const completed = extractCompletedTaskNumbers(ledgerContent);
  for (const n of taskNumbers) {
    if (!completed.has(n)) {
      violations.push(`${ledgerRel} 缺 Task ${n}: complete 行（R3：complete 覆盖须 ≥ plan 任务节数，缺任务 ${n}）`);
    }
  }
  // R4 三件套：N 取「plan 任务节序号 ∪ 账本 complete 任务号」**并集**（契约逐字：「N = 账本 complete
  // 的任务号」；R3 只保证 plan ⊆ completed，堵不住反方向——账本声明 complete 超出 plan 任务节时
  // （如 Task 5: complete 而 plan 无 Task 5 节），task-5 三件套若不查即成证据链缺口，fail-open）。
  const checkedTaskNumbers = new Set<number>([...taskNumbers, ...completed]);
  for (const n of checkedTaskNumbers) {
    for (const kind of ['brief', 'report'] as const) {
      const artifactRel = toRel(ledgerRelDir, taskArtifactName(n, kind));
      const artifactPath = path.join(ledgerDir, taskArtifactName(n, kind));
      if (!fs.existsSync(artifactPath) || fs.statSync(artifactPath).size === 0) {
        violations.push(`${artifactRel} 缺失或为空（R4：已完成任务三件套须齐备非空）`);
      } else {
        artifactsFound.push(artifactRel);
      }
    }
  }
  // R4：至少一个 review-*.diff（任务评审包证据）
  let reviewDiffs: string[] = [];
  if (fs.existsSync(ledgerDir)) {
    // withFileTypes 枚举后取条目名（与无参 readdirSync 的纯名字列表同集：文件 + 目录）
    reviewDiffs = fs
      .readdirSync(ledgerDir, { withFileTypes: true })
      .map((e) => e.name)
      .filter((f) => REVIEW_DIFF_RE.test(f))
      .sort((a, b) => a.localeCompare(b));
  }
  if (reviewDiffs.length === 0) {
    violations.push(`${toRel(ledgerRelDir, 'review-*.diff')} 缺失（R4：须存在至少一个任务评审包 diff 证据）`);
  } else {
    for (const diff of reviewDiffs) artifactsFound.push(toRel(ledgerRelDir, diff));
  }
  return completed.size;
}

/**
 * 校验编码计划制品契约（strict：changeId 精确绑定，R1-R6）。
 *
 * @param projectRoot 项目根目录（绝对路径）
 * @param phase       校验阶段（CLI 侧限定 5-8）
 * @param changeId    变更标识（须含 `phase<phase>-` 前缀）
 * @param fs          文件系统端口（必选；生产传 `lib/coding-plan-fs.ts` 的 `nodeCodingPlanFs`，
 *                    测试传内存 stub——本层零 fs 直连，未注入无法编译）
 */
export function checkCodingPlan(
  projectRoot: string,
  phase: number,
  changeId: string,
  fs: CodingPlanFs,
): CodingPlanCheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];
  const reviewsFound: string[] = [];

  // R1 前缀一致性（先于存在性检查，便于定位归属错误——顺序沿用已退役的 check-opsx-artifacts）
  if (!changeId.startsWith(`phase${phase}-`)) {
    violations.push(`${changeId} 不含阶段前缀 phase${phase}-（R1：scope.changeId 与当前阶段不符）`);
  }

  const planFileName = `${changeId}.plan.md`;
  const activePlanRel = toRel('docs', 'plans', planFileName);
  const ledgerBaseName = `${changeId}.plan`;
  const resolution = resolvePlanLocation(projectRoot, changeId, fs);
  if (resolution.kind === 'ambiguous') {
    violations.push(
      `${changeId} 归档位多匹配（${resolution.matches.length}）：${resolution.matches.join(', ')} —— fail-closed（R6）`,
    );
    return {
      passed: false,
      violations,
      planPath: null,
      ledgerPath: null,
      tasksTotal: 0,
      tasksCompleted: 0,
      artifactsFound,
      reviewsFound,
    };
  }
  if (resolution.kind === 'invalid-date') {
    violations.push(
      `${resolution.dirNames.join('、')} 的归档日期前缀非真实日历日（R6：归档位目录名须为 <changeId> 或 <YYYY-MM-DD>-<changeId>，日期前缀须通过日历回读校验，` +
        `拒绝 2026-13-45 / 2026-02-30 等形状合法但非真实日历日的前缀）—— fail-closed`,
    );
    return {
      passed: false,
      violations,
      planPath: null,
      ledgerPath: null,
      tasksTotal: 0,
      tasksCompleted: 0,
      artifactsFound,
      reviewsFound,
    };
  }
  if (resolution.kind === 'none') {
    const nearMissHint =
      resolution.nearMisses.length > 0
        ? `；归档位近失目录（含 changeId 子串但未锚定命中，不采信）：${resolution.nearMisses.join(', ')}`
        : '';
    violations.push(
      `${activePlanRel} 缺失（R1：阶段 ${phase} 须有编码计划；活动位缺失且归档位无 <changeId>/<YYYY-MM-DD>-<changeId> 锚定匹配）${nearMissHint}`,
    );
    return {
      passed: false,
      violations,
      planPath: null,
      ledgerPath: null,
      tasksTotal: 0,
      tasksCompleted: 0,
      artifactsFound,
      reviewsFound,
    };
  }

  // 定位 plan / 账本目录（活动位 vs 归档快照位——R6 归档态按同契约校验，不放宽任何校验项）
  let planAbs: string;
  let planRel: string;
  let ledgerDir: string;
  let ledgerRelDir: string;
  if (resolution.kind === 'active') {
    planAbs = path.join(projectRoot, 'docs', 'plans', planFileName);
    planRel = activePlanRel;
    ledgerRelDir = sddLedgerDirRel(ledgerBaseName);
    ledgerDir = path.join(projectRoot, ledgerRelDir);
  } else {
    planAbs = path.join(projectRoot, 'docs', 'changes', 'archive', resolution.dirName, planFileName);
    planRel = toRel('docs', 'changes', 'archive', resolution.dirName, planFileName);
    ledgerDir = path.join(projectRoot, 'docs', 'changes', 'archive', resolution.dirName);
    ledgerRelDir = toRel('docs', 'changes', 'archive', resolution.dirName);
  }

  // R1 plan 存在性（归档态：plan 快照缺失即 fail-closed）
  if (!fs.existsSync(planAbs) || !fs.statSync(planAbs).isFile()) {
    // 走到这里必然是归档态（活动位存在性已在 resolvePlanLocation 判过）
    violations.push(`${planRel} 缺失（R6：归档目录须含 plan 快照 ${planFileName}）`);
    return {
      passed: false,
      violations,
      planPath: null,
      ledgerPath: null,
      tasksTotal: 0,
      tasksCompleted: 0,
      artifactsFound,
      reviewsFound,
    };
  }
  const planContent = normalizeLineEndings(fs.readFileSync(planAbs));

  // R2 计划结构
  const structure = parsePlanStructure(planContent);
  if (!structure.hasGoalSection) {
    violations.push(`${planRel} 缺目标节（R2：计划须含标题文本含「目标」的标题节）`);
  }
  if (structure.sections.length === 0) {
    violations.push(`${planRel} 缺任务节（R2：计划须含 ≥1 个「Task N」/「任务 N」标题节）`);
  }
  for (const title of structure.tasksWithoutVerify) {
    violations.push(
      `${planRel} 任务节「${title}」缺验证命令行（R2：任务节须含 ≥1 条行首「验证：」/「Verify:」的验证命令）`,
    );
  }
  for (const bad of structure.forbiddenCommandLines) {
    violations.push(`${planRel} ${bad}（R2：验证命令体禁 ; & | ——与 RTM evidence command 同规）`);
  }
  const tasksTotal = structure.sections.length;
  const taskNumbers = structure.sections.map((s) => s.taskNumber).filter((n): n is number => n !== null);

  // R3 + R4 账本与三件套
  const tasksCompleted = validateLedgerAndArtifacts(
    ledgerDir,
    ledgerRelDir,
    planFileName,
    taskNumbers,
    fs,
    violations,
    artifactsFound,
  );

  // R5 审查产物（project 级，活动位/归档态同查）
  validateStageReviews(projectRoot, phase, fs, violations, reviewsFound);

  return {
    passed: violations.length === 0,
    violations,
    planPath: planRel,
    ledgerPath: toRel(ledgerRelDir, LEDGER_FILE_NAME),
    tasksTotal,
    tasksCompleted,
    artifactsFound,
    reviewsFound,
  };
}
