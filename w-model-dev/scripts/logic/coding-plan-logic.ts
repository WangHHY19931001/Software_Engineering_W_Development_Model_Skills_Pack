/**
 * 编码计划制品校验纯逻辑层（Coding Plan Logic）
 *
 * 校验 superpowers 编码链（writing-plans → SDD → TDD → code-review）的「编码计划制品契约」
 * （superpowers 替换 opsx 批次 1，SSoT §10M / docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md §4.2）。
 * 供 `cli/check-coding-plan.ts`（CLI 壳）与 `cli/self-test.ts`（CODING_PLAN_CASES）调用；
 * 本层直接读取 projectRoot 下的制品文件（gate-logic.ts 同型先例），不 import CLI 层、不调用 LLM。
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
 *       （路径须以 plan 文件名结尾）；`Task N: complete` 行对 plan 每个任务节具名覆盖
 *       （覆盖数 < 任务节数即违规，具名到任务号）。
 *   R4  任务三件套：每个已完成任务 N 的 `task-<N>-brief.md` 与 `task-<N>-report.md` 存在且
 *       非空（>0 字节）；账本目录内须存在至少一个 `review-*.diff`（任务评审包 diff 证据）。
 *   R5  审查产物：`.w-model/r3-reviews/phase<phase>-<stage>-<dim>.md` ×9 +
 *       `.w-model/v-reviews/phase<phase>-<stage>.md` ×3，stage ∈ {plan, execute, finalize}、
 *       dim ∈ {completeness, reliability, security}（文件命名规则沿袭已退役的 check-opsx-artifacts
 *       的 validateStageReviews，仅 stage 词表换新；旧词表不充数）。
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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

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
function archivePlanDirs(archiveRoot: string, changeId: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archiveRoot 由受控 projectRoot（docs/changes/archive）拼接
  if (!existsSync(archiveRoot)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archive 目录来自项目受控 docs/changes/archive/ 枚举
  return readdirSync(archiveRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && matchesArchiveDirName(e.name, changeId))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 活动位 / 归档位解析：活动位 plan 存在即 active；否则回退归档位。
 * 归档位的三个判定面（锚定命中 / 日期非法 / 近失名）各自成态，任何一态都不静默放过。
 */
function resolvePlanLocation(projectRoot: string, changeId: string): PlanResolution {
  const plansDir = path.join(projectRoot, 'docs', 'plans');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- plansDir 由受控 projectRoot 拼接
  if (existsSync(path.join(plansDir, `${changeId}.plan.md`))) return { kind: 'active' };
  const archiveRoot = path.join(projectRoot, 'docs', 'changes', 'archive');
  const matches = archivePlanDirs(archiveRoot, changeId);
  if (matches.length === 1) return { kind: 'archive', dirName: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  const archived = listArchiveDirNames(archiveRoot);
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
function listArchiveDirNames(archiveRoot: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archiveRoot 由受控 projectRoot（docs/changes/archive）拼接
  if (!existsSync(archiveRoot)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，仅列目录条目名、不做任何写入
  return readdirSync(archiveRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** 统一为 POSIX 分隔的 projectRoot 相对路径（violations / 返回结构展示用） */
function toRel(...segments: string[]): string {
  return segments.join('/');
}

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

/** 验证命令行前缀（行首；全半角冒号均接受） */
const VERIFY_PREFIXES = ['验证：', '验证:', 'Verify:', 'Verify:'] as const;

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
    if (title.includes('目标')) hasGoalSection = true;
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

/** 校验 R3×9 + V×3 审查产物（project 级；文件命名与 validateStageReviews 相同，stage 词表换新） */
function validateStageReviews(projectRoot: string, phase: number, violations: string[], reviewsFound: string[]): void {
  const r3Dir = path.join(projectRoot, '.w-model', 'r3-reviews');
  const vDir = path.join(projectRoot, '.w-model', 'v-reviews');
  for (const stage of CODING_PLAN_STAGES) {
    for (const dim of REQUIRED_R3_DIMENSIONS) {
      const r3File = path.join(r3Dir, `phase${phase}-${stage}-${dim}.md`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- r3File 由受控 projectRoot/.w-model 拼接
      if (existsSync(r3File)) {
        reviewsFound.push(`${stage}-${dim}`);
      } else {
        violations.push(
          `${toRel('.w-model', 'r3-reviews', `phase${phase}-${stage}-${dim}.md`)} 缺失（R5：编码链 stage 审查产物须齐备）`,
        );
      }
    }
    const vFile = path.join(vDir, `phase${phase}-${stage}.md`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- vFile 由受控 projectRoot/.w-model 拼接
    if (existsSync(vFile)) {
      reviewsFound.push(`${stage}-V`);
    } else {
      violations.push(`${toRel('.w-model', 'v-reviews', `phase${phase}-${stage}.md`)} 缺失（R5：编码链 V 评审须齐备）`);
    }
  }
}

/** 校验账本（R3）+ 三件套（R4）；plan 上下文用于首行身份绑定 */
function validateLedgerAndArtifacts(
  ledgerDir: string,
  ledgerRelDir: string,
  planFileName: string,
  taskNumbers: number[],
  violations: string[],
  artifactsFound: string[],
): number {
  const ledgerPath = path.join(ledgerDir, 'progress.md');
  const ledgerRel = toRel(ledgerRelDir, 'progress.md');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- ledgerPath 由受控 projectRoot 子路径拼接
  if (!existsSync(ledgerPath) || !statSync(ledgerPath).isFile()) {
    violations.push(`${ledgerRel} 缺失（R3：执行账本须随编码计划落盘）`);
    return 0;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读
  const ledgerContent = normalizeLineEndings(readFileSync(ledgerPath, 'utf-8'));
  const firstLine = ledgerContent.split('\n').find((l) => l.trim() !== '') ?? '';
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
      const artifactRel = toRel(ledgerRelDir, `task-${n}-${kind}.md`);
      const artifactPath = path.join(ledgerDir, `task-${n}-${kind}.md`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- artifactPath 由受控账本目录拼接
      if (!existsSync(artifactPath) || statSync(artifactPath).size === 0) {
        violations.push(`${artifactRel} 缺失或为空（R4：已完成任务三件套须齐备非空）`);
      } else {
        artifactsFound.push(artifactRel);
      }
    }
  }
  // R4：至少一个 review-*.diff（任务评审包证据）
  let reviewDiffs: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 账本目录来自受控解析路径（projectRoot/.superpowers/sdd 或受控归档目录），仅作存在性探测
  if (existsSync(ledgerDir)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，仅列目录条目名、不做任何写入
    reviewDiffs = readdirSync(ledgerDir)
      .filter((f) => /^review-.+\.diff$/.test(f))
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
 */
export function checkCodingPlan(projectRoot: string, phase: number, changeId: string): CodingPlanCheckResult {
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
  const resolution = resolvePlanLocation(projectRoot, changeId);
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
    ledgerDir = path.join(projectRoot, '.superpowers', 'sdd', ledgerBaseName);
    ledgerRelDir = toRel('.superpowers', 'sdd', ledgerBaseName);
  } else {
    planAbs = path.join(projectRoot, 'docs', 'changes', 'archive', resolution.dirName, planFileName);
    planRel = toRel('docs', 'changes', 'archive', resolution.dirName, planFileName);
    ledgerDir = path.join(projectRoot, 'docs', 'changes', 'archive', resolution.dirName);
    ledgerRelDir = toRel('docs', 'changes', 'archive', resolution.dirName);
  }

  // R1 plan 存在性（归档态：plan 快照缺失即 fail-closed）
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- planAbs 由受控 projectRoot 子路径拼接
  if (!existsSync(planAbs) || !statSync(planAbs).isFile()) {
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
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读
  const planContent = normalizeLineEndings(readFileSync(planAbs, 'utf-8'));

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
    violations,
    artifactsFound,
  );

  // R5 审查产物（project 级，活动位/归档态同查）
  validateStageReviews(projectRoot, phase, violations, reviewsFound);

  return {
    passed: violations.length === 0,
    violations,
    planPath: planRel,
    ledgerPath: toRel(ledgerRelDir, 'progress.md'),
    tasksTotal,
    tasksCompleted,
    artifactsFound,
    reviewsFound,
  };
}
