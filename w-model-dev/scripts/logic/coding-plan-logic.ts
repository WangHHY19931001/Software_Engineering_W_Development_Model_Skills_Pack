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
 *       （phase 归属一致性，先于存在性检查，与 check-opsx-artifacts 同序）。
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
 *       dim ∈ {completeness, reliability, security}（文件命名规则与 check-opsx-artifacts 的
 *       validateStageReviews 相同，仅 stage 词表换新；旧词表不充数）。
 *   R6  归档态回退（D-7 平移）：活动位 plan 缺失时回退归档位
 *       `docs/changes/archive/<changeId>/` 或 `docs/changes/archive/<日期>-<changeId>/`
 *       （**恰一匹配**才可用，多匹配 fail-closed）；归档态按同契约校验归档目录内的
 *       plan 快照（`<changeId>.plan.md`）与账本快照（`progress.md`）+ 三件套，
 *       快照缺失即 fail-closed；活动位存在时优先活动位（归档残缺不改判定）。
 *
 * 退出语义由 CLI 层裁：passed=false → exit 1；输入错误 → exit 2。
 *
 * @module
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

/** R3×9 三维度（与 check-opsx-artifacts 同表） */
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

/** 变更目录解析结果（D-7 四态，与 check-opsx-artifacts.resolveChangeDirName 同构） */
type PlanResolution =
  | { kind: 'active' }
  | { kind: 'archive'; dirName: string }
  | { kind: 'ambiguous'; matches: string[] }
  | { kind: 'none'; candidates: string[] };

/** 归档位候选目录名：匹配 `<changeId>` 或 `<日期>-<changeId>`（`<changeId>-extra` 等相似名不匹配） */
function archivePlanDirs(archiveRoot: string, changeId: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archiveRoot 由受控 projectRoot（docs/changes/archive）拼接
  if (!existsSync(archiveRoot)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- archive 目录来自项目受控 docs/changes/archive/ 枚举
  return readdirSync(archiveRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (e.name === changeId || e.name.endsWith(`-${changeId}`)))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** 活动位归档态四态解析：活动位 plan 存在即 active；否则回退归档位（恰一匹配） */
function resolvePlanLocation(projectRoot: string, changeId: string): PlanResolution {
  const plansDir = path.join(projectRoot, 'docs', 'plans');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- plansDir 由受控 projectRoot 拼接
  if (existsSync(path.join(plansDir, `${changeId}.plan.md`))) return { kind: 'active' };
  const archiveRoot = path.join(projectRoot, 'docs', 'changes', 'archive');
  const matches = archivePlanDirs(archiveRoot, changeId);
  if (matches.length === 1) return { kind: 'archive', dirName: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  return { kind: 'none', candidates: [] };
}

/** 统一为 POSIX 分隔的 projectRoot 相对路径（violations / 返回结构展示用） */
function toRel(...segments: string[]): string {
  return segments.join('/');
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

/** 提取账本内 distinct `Task N: complete` 任务号集合（R3） */
function extractCompletedTaskNumbers(ledgerContent: string): Set<number> {
  const completed = new Set<number>();
  for (const line of ledgerContent.split('\n')) {
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
  const ledgerContent = readFileSync(ledgerPath, 'utf-8');
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

  // R1 前缀一致性（先于存在性检查，便于定位归属错误——check-opsx-artifacts 同序）
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
  if (resolution.kind === 'none') {
    violations.push(
      `${activePlanRel} 缺失（R1：阶段 ${phase} 须有编码计划；活动位缺失且归档位无 <changeId>/<日期>-<changeId> 匹配）`,
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
  const planContent = readFileSync(planAbs, 'utf-8');

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
