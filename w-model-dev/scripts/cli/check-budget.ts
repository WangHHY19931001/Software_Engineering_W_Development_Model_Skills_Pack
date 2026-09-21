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
 *   npx tsx w-model-dev/scripts/cli/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl>] [--phase=N]
 *
 * 参数：
 *   budget.json           budget.json 文件路径
 *   --project=<path>      project.json 路径（可选，用于读取 projectUpdatedAt 做 R1 时效性校验；读取侧经 project.schema.json 校验，缺失/非法/不符 schema → exit 2）
 *   --run-log=<path>      run-log.jsonl 路径（可选，用于统计返工次数做 R5 触发检测 + 累计 tokens 做 R6 用量实效校验）
 *                         返工口径（D-4a）：action ∈ {rework, fix, emergency-fix} 或 outcome ∈ {fail, rework}
 *                         的条数；tlaReworkCount 再从中筛 note/target 含 TLA 的条数（详见 countReworks）
 *                         用量口径（D-4b）：Σtokens 只累计有限非负数的 tokens 字段（详见 sumTokens）；
 *                         未提供 --run-log 时 R5/R6 一并跳过；提供了但 Σtokens=0 时输出「R6 未生效」警告
 *                         （跳过不等于通过）
 *   --phase=N             当前阶段 1-8（可选，用于过滤 run-log 中本阶段的返工/用量记录；支持 --phase=N 与 --phase N 两形态，重复传参即错）
 *   --json                机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse，含 warnings 非阻断警告字段）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 校验规则（详见 w-model-dev/references/data-models.md §成本预算模型）：
 *   R1 时效性 · R3 onExceed 合法 · R4-A 多角度 R token 预算 · R5 killSwitch 触发检测（返工/TLA+）
 *   · R5-b 用量 burnRate 告警（D-4b：Σtokens(阶段) ≥ budgetBurnRate × perPhase.maxTokens，文案以 `R5-b：` 开头）
 *   · R6 用量实效（D-4b：Σtokens(阶段) > perPhase.maxTokens 或 Σtokens(总) > project.maxTokensTotal → exit 1）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / schema 不符 / 参数非法；含 --project 读取侧 schema 校验失败）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 BUDGET_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
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
import { fileURLToPath } from 'node:url';

import { checkBudget, type BudgetConfig, type TokenUsage } from '../logic/budget-logic.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { readJsonOrExit, readJsonlOptional } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
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
 *   - action ∈ {'rework', 'fix', 'emergency-fix'}（'rework' 为旧记录兼容项，非新增语义）
 *   - outcome ∈ {'fail', 'rework'}
 * 对齐事实：真实 8 阶段调测的 run-log 中 action='rework' 一条都没有，返工以
 * fix/emergency-fix 与 outcome='fail'/'rework' 落盘；旧口径使 reworkCount 恒为 0，
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
      e.action === 'rework' || // 兼容旧记录（保留原口径，非新增语义）
      e.action === 'fix' ||
      e.action === 'emergency-fix' ||
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
        '用法: npx tsx w-model-dev/scripts/cli/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl>] [--phase=N]',
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
  // 只有文件确实存在（读到内容）才把「Σtokens=0」解释为「无用量字段」；读取失败时
  // 已由下方 warning 说明跳过原因，不再追加 R6 未生效警告（避免把「没读到」说成「没用量」）
  let runLogReadable = false;
  if (runLogFile) {
    const runLogAbs = path.resolve(runLogFile);
    try {
      // ENOENT 预探测：readJsonlOptional 对缺失文件静默返回 []，此处补回原「文件读取失败」warning（降级语义不变）
      try {
        await fs.access(runLogAbs);
        runLogReadable = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        console.error(`⚠ --run-log 文件读取失败，跳过 R5/R6/R5-b 触发检测: ${runLogAbs}（ENOENT）`);
      }
      const entries = await readJsonlOptional(runLogAbs, 'run-log');
      const stats = countReworks(entries, phase);
      reworkCount = stats.reworkCount;
      tlaReworkCount = stats.tlaReworkCount;
      tokensUsed = sumTokens(entries, phase);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --run-log 文件读取失败，跳过 R5/R6/R5-b 触发检测: ${runLogAbs}（${e.code ?? e.message}）`);
    }
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkBudget(parsed, {
    projectUpdatedAt,
    budgetCreatedAt: budget.createdAt,
    reworkCount,
    tlaReworkCount,
    tokensUsed,
  });

  // R6 可见性（D-4b，与 R1/R4-A 的「跳过不等于通过」同口径）：--run-log 读到了内容但 Σtokens=0
  // （无 tokens 字段或全为 0）时，R6 无实际约束力——显式警告而非静默通过。
  // 未提供 --run-log 时不追加（该路径整体不校验 R5/R6，行为与新增前一致）；
  // --run-log 读取失败时也不追加（上一条 warning 已说明跳过原因，避免把「没读到」说成「没用量」）。
  if (runLogReadable && tokensUsed && tokensUsed.total === 0) {
    result.warnings.push('R6 未生效：--run-log 无有效 tokens 用量（Σtokens=0），用量实效校验无实际约束力');
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
    `--run-log     : ${runLogFile ? `${runLogFile}（rework=${reworkCount ?? 'N/A'}, tla-rework=${tlaReworkCount ?? 'N/A'}, tokens=阶段/全量 ${tokensUsed ? `${tokensUsed.phase}/${tokensUsed.total}` : 'N/A'}）` : '未提供'}`,
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

  // 非阻断警告（如 R1 未校验：未提供 --project）：不影响 exit code，但须可见
  for (const w of result.warnings) {
    console.error(`⚠ ${w}`);
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  printGateReport(
    'BUDGET',
    {
      type: 'budget',
      passed: result.passed,
      violations: result.violations,
      warnings: result.warnings,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// isMain 守卫：仅直接执行时运行 main，被 __tests__ 等 import 时不触发
// （countReworks 是本模块的导出统计函数，测试导入它不应产生 CLI 副作用）
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);

if (isMain) {
  runMain(main);
}
