#!/usr/bin/env tsx
/**
 * 预算校验脚本（Budget Checker）
 *
 * 对应 w-model-dev/references/data-models.md BudgetConfig schema
 * 与 w-model-dev/references/operational-recovery.md §成本预算与运行日志。
 * 供 O 子代理在阶段推进前调用，校验预算配置时效性、schema 完整性、
 * onExceed/killSwitch 合法性与触发状态。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl> --phase=<N>]（阶段门调用必带：R6/R5-b/R7 用量校验的接线判据）
 *
 * 参数：
 *   budget.json           budget.json 文件路径
 *   --project=<path>      project.json 路径（可选，用于读取 projectUpdatedAt 做 R1 时效性校验；读取侧经 project.schema.json 校验，缺失/非法/不符 schema → exit 2）
 *   --run-log=<path>      run-log.jsonl 路径（可选，用于统计返工次数做 R5 触发检测 + 累计 tokens 做 R6 用量实效校验
 *                         + 按阶段聚合 subagentSpawns 做 R7 子代理分派数实效校验）；
 *                         阶段门调用必带 --run-log 与 --phase=N（R6/R5-b/R7 用量校验的接线判据）
 *                         返工口径（D-4a）见同文件 countReworks；用量口径（D-4b：Σtokens 累计、
 *                         未接线可见化诊断、上界口径、疑似重复归账分组键与键守卫、parentDispatchId
 *                         归账精确化）见同文件 sumTokens / countSuspectedDuplicateGroups 与
 *                         w-model-dev/references/data-models.md「用量实效校验」段（R6）——对外口径以该段为准；
 *                         分派数口径（决策 5：ΣsubagentSpawns 按阶段、estimated=true 记录不计入、
 *                         未配置字段/未提供 --phase 的跳过可见化）见同文件 sumSubagentSpawns 与
 *                         w-model-dev/references/data-models.md「子代理分派数实效校验（R7）」段
 *   --phase=N             当前阶段 1-8（可选，用于过滤 run-log 中本阶段的返工/用量记录；支持 --phase=N 与 --phase N 两形态，重复传参即错）
 *   --json                机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse，含 warnings 非阻断警告字段）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 校验规则（详见 w-model-dev/references/data-models.md §成本预算模型）：
 *   R1 时效性 · R3 onExceed 合法 · R4-A 多角度 R token 预算 · R5 killSwitch 触发检测（返工/TLA+）
 *   · R5-b 用量 burnRate 告警（D-4b）· R6 用量实效（D-4b）· R7 子代理分派数实效（决策 5，43.2.0）
 *   （R5-b / R6 / R7 的判据细节、上界与聚合口径的权威指针见上方 --run-log 参数说明，此处不重复）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / schema 不符 / 参数非法；含 --project 读取侧 schema 校验失败）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 BUDGET_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *   非阻断诊断（D-5②/N-6：未接线可见化 + 上界口径）走两条通道——人类可读路径的
 *   「非阻断诊断：」段（stdout，通过与否都打印）与 `--json` / `BUDGET_JSON` 的 `diagnostics` 键
 *   （**仅在非空时出现**，同 check-maturity / check-checkpoint 口径）；不影响退出码
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--project=、--run-log=、--phase=N
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { checkBudget, type BudgetConfig, type SpawnUsage, type TokenUsage } from '../logic/budget-logic.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { readJsonOrExit, readJsonlOptional } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { loadAndValidate, LOAD_AND_VALIDATE_SENTINEL_PREFIX } from '../lib/load-and-validate.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { phaseFlagPresent } from '../lib/parse-phase.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  budgetFile: string | undefined;
  projectFile: string | undefined;
  runLogFile: string | undefined;
  phase: number | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const budgetFile = args.find((a) => !a.startsWith('--'));
  const projectFile = parseFlagValue(args, 'project');
  const runLogFile = parseFlagValue(args, 'run-log');
  // 统一 --phase 解析（lib/parse-phase.ts，1-8）：空格/等号两形态生效，重复 → DuplicateFlagError
  // （runMain 统一转 ARG_INVALID / exit 2）；显式传了但非法由 main 的 phaseFlagPresent 门统一 ARG_INVALID
  const phase = phaseFlagPresent(args) ? parsePhaseArg(argv, { min: 1, max: 8 })?.phase : undefined;

  return { budgetFile, projectFile, runLogFile, phase };
}

// ==================== run-log 返工统计 ====================

interface ReworkStats {
  reworkCount: number;
  tlaReworkCount: number;
}

/**
 * 统计 run-log.jsonl 中的返工记录数（D-4a：口径对齐真实事件）。
 *
 * 判据（命中任一即计入返工，同一记录只计一次）：
 *   - action ∈ {'fix'}（返工事件载体；批次 6 A15 词表收敛：'rework'/'emergency-fix' 死词已删除）
 *   - outcome ∈ {'fail', 'rework'}
 * 对齐事实：真实 8 阶段调测的 run-log 中 action='rework' 一条都没有，返工以
 * fix 与 outcome='fail'/'rework' 落盘；旧口径使 reworkCount 恒为 0，
 * R5 连续返工护栏（killSwitch）失灵。
 *
 * - reworkCount     = 命中上述判据且（若提供 phase）phase === N 的记录数
 * - tlaReworkCount  = 计入 reworkCount 的记录中，note 或 target 含 'TLA/tla' 的记录数
 *                     （未扩大 tla 判据：非返工记录即使提及 TLA 也不计入）
 *
 * 容错：文件读取与逐行解析由 readJsonlOrExit 负责（坏行 warn+skip），此处仅统计。
 *
 * 口径说明（D-4a 复审记录）：命中判据是「返工事件 ∪ 未过门事件」，故 reworkCount 是**累计**条数
 * 而非「连续 N 轮返工」的滑动窗口——killSwitch.consecutiveReworks 实际约束的是本阶段返工/未过门
 * 事件累计阈值（字段名沿用 schema，语义以本口径为准）。
 */
export function countReworks(entries: unknown[], phase: number | undefined): ReworkStats {
  let reworkCount = 0;
  let tlaReworkCount = 0;
  for (const entry of entries) {
    const e = entry as {
      action?: string;
      phase?: number;
      note?: string;
      target?: string;
      outcome?: string;
    };
    if (phase !== undefined && e.phase !== phase) continue;
    const isRework =
      e.action === 'fix' || // 批次 6 A15：原 'rework' 兼容项与 'emergency-fix' 死分支随词表收敛删除
      e.outcome === 'fail' ||
      e.outcome === 'rework';
    if (!isRework) continue;
    reworkCount++;
    if (
      (typeof e.note === 'string' && /TLA/i.test(e.note)) ||
      (typeof e.target === 'string' && /TLA/i.test(e.target))
    ) {
      tlaReworkCount++;
    }
  }
  return { reworkCount, tlaReworkCount };
}

// ==================== run-log token 累计 ====================

/**
 * 累计 run-log.jsonl 的 tokens 用量（D-4b：R6 用量实效校验的输入）。
 *
 * 计入判据：`typeof tokens === 'number' && Number.isFinite(tokens) && tokens >= 0`。
 * 坏值（NaN / Infinity / 负数 / 字符串 / 缺字段）一律剔除——否则 Σ 变 NaN，
 * 而 `NaN > maxTokens` 恒为 false，R6 会静默永不触发（与 D-4a「护栏失灵」同型）。
 *
 * - phase   = 若提供 phase，则为 `phase === N` 的记录之和；未提供时与 total 相等
 * - total   = 全部记录的 tokens 之和（**不受 phase 过滤**，对应 project.maxTokensTotal）
 *
 * 跳过的可见性由调用方保证：读到内容但 Σ=0 时 CLI 追加「R6 未生效」警告（跳过不等于通过）。
 *
 * 容错：文件读取与逐行解析由 readJsonlOrExit 负责（坏行 warn+skip），此处仅累计。
 */
export function sumTokens(entries: unknown[], phase: number | undefined): TokenUsage {
  let phaseTokens = 0;
  let totalTokens = 0;
  for (const entry of entries) {
    const e = entry as { phase?: number; tokens?: unknown };
    if (typeof e.tokens !== 'number' || !Number.isFinite(e.tokens) || e.tokens < 0) continue;
    totalTokens += e.tokens;
    if (phase !== undefined && e.phase !== phase) continue;
    phaseTokens += e.tokens;
  }
  return { phase: phaseTokens, total: totalTokens };
}

// ==================== run-log 子代理分派数聚合（R7，决策 5） ====================

/**
 * 聚合 run-log.jsonl 的子代理分派数（R7 的输入，决策 5，43.2.0）。
 *
 * 计入判据：`typeof subagentSpawns === 'number' && Number.isFinite(subagentSpawns) && subagentSpawns >= 0`
 * （与 sumTokens 同款坏值剔除：坏值若不剔除会让 Σ 变 NaN，而 `NaN > max` 恒为 false
 * ⇒ R7 静默永不触发，与 D-4a「护栏失灵」同型）。
 *
 * **`estimated === true` 的记录不计入**（决策 5 口径）：该形态已被 `check-run-log.ts` R2
 * 判 blocking（43.0.0 A5 违规化），估算值不得占用分派额度；`estimated` 缺省（legacy）或
 * `false` 的记录照常计入。口径成文见 data-models.md「子代理分派数实效校验（R7）」段。
 *
 * phase 为**必传**（R7 是「按阶段」口径，schema 只有 perPhase.maxSubagentSpawns，无全量对照），
 * 只累计 `phase === N` 的记录——不存在 sumTokens 那种「未提供 phase 视同全量」的退路，
 * 未提供 `--phase` 由调用方跳过 R7 并出非阻断诊断（按阶段聚合口径无定义）。
 *
 * 容错：文件读取与逐行解析由 readJsonlOrExit / readJsonlOptional 负责（坏行 warn+skip），此处仅累计。
 */
export function sumSubagentSpawns(entries: unknown[], phase: number): SpawnUsage {
  let phaseSpawns = 0;
  for (const entry of entries) {
    const e = entry as { phase?: number; subagentSpawns?: unknown; estimated?: unknown };
    if (typeof e.subagentSpawns !== 'number' || !Number.isFinite(e.subagentSpawns) || e.subagentSpawns < 0) continue;
    if (e.estimated === true) continue;
    if (e.phase !== phase) continue;
    phaseSpawns += e.subagentSpawns;
  }
  return { phase: phaseSpawns };
}

// ==================== 疑似重复归账统计（N-6 上界口径诊断） ====================

/**
 * 统计 run-log 中「同 `(parentDispatchId, timestamp, tokens, duration_s)` 出现 >1 次」的**组数**（N-6）。
 *
 * 用途：Σtokens 是**上界**口径（同一分派动作的多条归账会被重复累计），本函数只**统计并可见化**
 * 该现象、**不做去重**——预算判定继续按上界执行，去重键在 legacy 记录上不可靠；完整口径（含
 * R3 三条目归账约定与键句）成文见 data-models.md「用量实效校验」段（R6）。
 *
 * 计入判据（实现）：`typeof timestamp === 'string' && timestamp !== ''`（run-log schema 必填字段；
 * 缺时间戳的记录不参与分组，避免把手工 fixture 误判为重复）且 tokens 为**有限正数**、
 * `duration_s` 为 number（键守卫，G3-7：tokens=0 的无用量记录与缺时长的手工 fixture 只会
 * 产生噪声键，一律不入组——与 sumTokens 的「有限非负」口径在此**故意不同**，后者为求和、
 * 前者为分组）。分组键另含可选 `parentDispatchId` 原值（G3-15 归账精确化：在场且非空时入键；
 * legacy 缺字段 = 空前缀，判定与字段引入前逐字相同）。
 *
 * @returns 出现次数 >1 的键数（组数），无重复返回 0
 */
export function countSuspectedDuplicateGroups(entries: unknown[]): number {
  const groups = new Map<string, number>();
  for (const entry of entries) {
    const e = entry as {
      timestamp?: unknown;
      tokens?: unknown;
      duration_s?: unknown;
      parentDispatchId?: unknown;
    };
    if (typeof e.timestamp !== 'string' || e.timestamp === '') continue;
    // 键守卫（G3-7）：tokens 须为有限正数（0/负数/NaN/Infinity/非 number 一律不建键）
    if (typeof e.tokens !== 'number' || !Number.isFinite(e.tokens) || e.tokens <= 0) continue;
    // 键守卫（G3-7）：duration_s 缺字段或非 number 一律不建键（避免 String(undefined)='undefined' 并组）
    if (typeof e.duration_s !== 'number') continue;
    // 归账精确化（G3-15）：parentDispatchId 在场且非空才作为键前缀；legacy 缺字段 = 空前缀（判定不变）
    const parent = typeof e.parentDispatchId === 'string' && e.parentDispatchId !== '' ? e.parentDispatchId : '';
    const key = `${parent}|${e.timestamp}|${e.tokens}|${e.duration_s}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let duplicateGroupCount = 0;
  for (const count of groups.values()) {
    if (count > 1) duplicateGroupCount++;
  }
  return duplicateGroupCount;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const { budgetFile, projectFile, runLogFile, phase } = parseArgs(process.argv);

  // --phase 合法性校验（D3/I-4：形态无关）：显式传了 --phase（空格或等号形态）但非法
  // （非数字 / 非整数 / 越界）→ exit(2)，避免 countReworks 中 `NaN !== NaN` 恒为 true
  // 导致所有 run-log 记录被过滤、reworkCount 静默归零
  if (phaseFlagPresent(process.argv) && phase === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--phase 参数非法',
      detail: '须为 1-8 的整数（支持 --phase=N 与 --phase N 两形态，重复传参即错）',
      exitCode: 2,
    });
    return;
  }

  if (!budgetFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <budget.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl> --phase=<N>]（阶段门调用必带：R6/R5-b/R7 用量校验的接线判据）',
      exitCode: 2,
    });
    return;
  }

  const budgetAbs = path.resolve(budgetFile);

  // 读 budget.json（ENOENT / 非法 JSON → exit(2)）
  const parsed = await readJsonOrExit(budgetAbs);
  const budget = parsed as Partial<BudgetConfig>;

  // 可选输入：--project（F-G4-14：读取侧经 project.schema.json 校验，fail-closed）——
  // 文件缺失/非法 JSON/schema 不符（含缺 updatedAt 等必填字段）→ STRUCTURE_INVALID exit 2，
  // 不再 warn-and-skip（「合法 project 缺 updatedAt」场景已被 schema required 前置排除）
  let projectUpdatedAt: string | undefined;
  if (projectFile) {
    const projectAbs = path.resolve(projectFile);
    try {
      const project = await loadAndValidate<{ updatedAt: string }>(projectAbs, 'project');
      projectUpdatedAt = project.updatedAt;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(LOAD_AND_VALIDATE_SENTINEL_PREFIX)) return;
      throw err;
    }
  }

  // 可选输入：--run-log（读失败只警告不 exit；ENOENT→[] 降级复用 readJsonlOptional）
  let reworkCount: number | undefined;
  let tlaReworkCount: number | undefined;
  let tokensUsed: TokenUsage | undefined;
  // R7（决策 5）：ΣsubagentSpawns 按阶段聚合；--phase 缺席时保持 undefined（按阶段口径无定义，
  // 见下方可见化警告），不冒充全量。
  let spawnsUsed: SpawnUsage | undefined;
  // 只有文件确实存在（fs.access 成功即置位，空文件同样算存在）才把「Σtokens=0」解释为「无用量字段」；读取失败时
  // 已由下方 warning 说明跳过原因，不再追加 R6 未生效警告（避免把「没读到」说成「没用量」）
  let runLogReadable = false;
  // run-log 逐行解析成功（与上面「文件存在」区分）：R7 的跳过归因必须落在「未提供 --phase」上而非读取失败，
  // 否则会把「没读到」说成「没给 --phase」（与 R6 的措辞纪律同款）
  let runLogParsed = false;
  // 疑似重复归账组数（N-6）：只在 run-log 确实读到内容时统计；未提供/读取失败时保持 0
  let duplicateGroupCount = 0;
  if (runLogFile) {
    const runLogAbs = path.resolve(runLogFile);
    try {
      // ENOENT 预探测：readJsonlOptional 对缺失文件静默返回 []，此处补回原「文件读取失败」warning（降级语义不变）
      try {
        await fs.access(runLogAbs);
        runLogReadable = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        console.error(`⚠ --run-log 文件读取失败，跳过 R5/R6/R5-b/R7 触发检测: ${runLogAbs}（ENOENT）`);
      }
      const entries = await readJsonlOptional(runLogAbs, 'run-log');
      runLogParsed = true;
      const stats = countReworks(entries, phase);
      reworkCount = stats.reworkCount;
      tlaReworkCount = stats.tlaReworkCount;
      tokensUsed = sumTokens(entries, phase);
      // R7：按 --phase 聚合（estimated=true 记录不计入）；未提供 --phase 时不聚合（见下方警告）
      if (phase !== undefined) spawnsUsed = sumSubagentSpawns(entries, phase);
      duplicateGroupCount = countSuspectedDuplicateGroups(entries);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --run-log 文件读取失败，跳过 R5/R6/R5-b/R7 触发检测: ${runLogAbs}（${e.code ?? e.message}）`);
    }
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkBudget(parsed, {
    projectUpdatedAt,
    budgetCreatedAt: budget.createdAt,
    reworkCount,
    tlaReworkCount,
    tokensUsed,
    spawnsUsed,
  });

  // R6 可见性（D-4b，与 R1/R4-A 的「跳过不等于通过」同口径）：--run-log 文件存在但 Σtokens=0
  // （无 tokens 字段或全为 0）时，R6 无实际约束力——显式警告而非静默通过。
  // 未提供 --run-log 时不追加（该路径整体不校验 R5/R6，行为与新增前一致）；
  // --run-log 读取失败时也不追加（上一条 warning 已说明跳过原因，避免把「没读到」说成「没用量」）。
  if (runLogReadable && tokensUsed && tokensUsed.total === 0) {
    result.warnings.push('R6 未生效：--run-log 无有效 tokens 用量（Σtokens=0），用量实效校验无实际约束力');
  }

  // R7 可见性（决策 5，与 R6 同口径）：--run-log 已解析成功但未提供 --phase → 「按阶段」聚合口径无定义，
  // R7 整体跳过——显式警告而非静默（跳过不等于通过）。读取失败分支不追加（runLogParsed=false：
  // 上一条 warning 已说明跳过原因，避免把「没读到」说成「没给 --phase」）。
  if (runLogParsed && spawnsUsed === undefined) {
    result.warnings.push('R7 未校验：未提供 --phase（子代理分派数按阶段聚合无法进行，跳过不等于通过）');
  }

  // 非阻断诊断（D-5② 未接线可见化 + N-6 上界口径）：不影响 exit code，但须可见。
  // ① 未提供 --run-log：R6/R5-b 整体跳过（判据与退出码语义一字不变），省略该参数不再等于静默跳过；
  // ② 提供了且存在同 (parentDispatchId, timestamp, tokens, duration_s) 多行：提示 Σtokens 的**上界**口径
  //    （只诊断不去重，计数精度由键守卫 G3-7 与 parentDispatchId 归账精确化 G3-15 保证；
  //    完整口径见 data-models.md「用量实效校验」段（R6））。
  // 读取失败分支不追加诊断：上一条 warning 已说明跳过原因（避免把「没读到」说成「没接线」）。
  const diagnostics: string[] = [];
  if (!runLogFile) {
    diagnostics.push(
      'R6/R5-b 未生效（未提供 run-log）：用量实效（Σtokens vs 上限）与 burnRate 告警整体跳过，跳过不等于通过',
    );
    // R7 独立一条（不改上一条既有文案：其字符串被测试与文档引用）：子代理分派数校验同样跳过
    diagnostics.push(
      'R7 未生效（未提供 run-log）：子代理分派数实效（ΣsubagentSpawns vs perPhase.maxSubagentSpawns）整体跳过，跳过不等于通过',
    );
  }
  if (duplicateGroupCount > 0) {
    diagnostics.push(
      `Σtokens 为上界口径；疑似重复归账 ${duplicateGroupCount} 组（同 parentDispatchId/timestamp/tokens/duration_s 键）——同一分派的多条归账会重复累计，预算判定按上界执行（不去重，口径见 data-models.md「用量实效校验（R6）」）`,
    );
  }

  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置；warnings 透传（F-G2-04 可见性）
  if (jsonMode) {
    printJsonReport(
      {
        type: 'budget',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        warnings: result.warnings,
        // diagnostics 仅在非空时出现（同 check-maturity / check-checkpoint 口径；D-5② 契约变化已登记）
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('预算校验（Budget Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${budgetAbs}`);
  console.log(`projectId     : ${budget.projectId ?? '未设置'}`);
  console.log(`schemaVersion : ${budget.schemaVersion ?? '未设置'}`);
  console.log(`onExceed      : ${budget.onExceed ?? '未设置'}`);
  console.log(`--project     : ${projectFile ? (projectUpdatedAt ?? '已读取但无 updatedAt') : '未提供'}`);
  console.log(
    `--run-log     : ${runLogFile ? `${runLogFile}（rework=${reworkCount ?? 'N/A'}, tla-rework=${tlaReworkCount ?? 'N/A'}, tokens=阶段/全量 ${tokensUsed ? `${tokensUsed.phase}/${tokensUsed.total}` : 'N/A'}, spawns=阶段 ${spawnsUsed ? spawnsUsed.phase : 'N/A'}）` : '未提供'}`,
  );
  console.log(`--phase       : ${phase ?? '未提供'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('预算配置符合 data-models.md BudgetConfig schema：时效 + 完整 + onExceed 合法 + killSwitch 未触发。');
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log(
      'O 子代理须按上述原因处置（刷新 budget.updatedAt / 补全 schema / 修正 onExceed / 响应 killSwitch），详见：',
    );
    console.log('  w-model-dev/references/operational-recovery.md §成本预算与运行日志');
  }

  // 非阻断诊断（D-5② 未接线可见化 / N-6 上界口径）：不影响 exit code，但须可见
  // （通过与否都打印——exit 0 时正是「为何未触发 R6/R5-b」需要被解释的场景）
  if (diagnostics.length > 0) {
    console.log('非阻断诊断：');
    for (const d of diagnostics) {
      console.log(`  - ${d}`);
    }
  }

  // 非阻断警告（如 R1 未校验：未提供 --project）：不影响 exit code，但须可见
  for (const w of result.warnings) {
    console.error(`⚠ ${w}`);
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  // diagnostics 仅在非空时出现（同 check-maturity / check-checkpoint 口径）
  printGateReport(
    'BUDGET',
    {
      type: 'budget',
      passed: result.passed,
      violations: result.violations,
      warnings: result.warnings,
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main，被 __tests__ 等 import 时不触发
// （countReworks 是本模块的导出统计函数，测试导入它不应产生 CLI 副作用）
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
