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
 *   npx tsx w-model-dev/scripts/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl>] [--phase=N]
 *
 * 参数：
 *   budget.json           budget.json 文件路径
 *   --project=<path>      project.json 路径（可选，用于读取 projectUpdatedAt 做 R1 时效性校验）
 *   --run-log=<path>      run-log.jsonl 路径（可选，用于统计返工次数做 R5 触发检测）
 *   --phase=N             当前阶段 1-8（可选，用于过滤 run-log 中本阶段的返工记录）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkBudget, type BudgetConfig } from './budget-logic.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  budgetFile: string | undefined;
  projectFile: string | undefined;
  runLogFile: string | undefined;
  phase: number | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const budgetFile = args.find(a => !a.startsWith('--'));
  const projectArg = args.find(a => a.startsWith('--project='));
  const runLogArg = args.find(a => a.startsWith('--run-log='));
  const phaseArg = args.find(a => a.startsWith('--phase='));

  const projectFile = projectArg ? projectArg.split('=')[1] : undefined;
  const runLogFile = runLogArg ? runLogArg.split('=')[1] : undefined;
  let phase: number | undefined;
  if (phaseArg) {
    phase = Number.parseInt(phaseArg.split('=')[1], 10);
  }

  return { budgetFile, projectFile, runLogFile, phase };
}

// ==================== run-log 返工统计 ====================

interface ReworkStats {
  reworkCount: number;
  tlaReworkCount: number;
}

/**
 * 统计 run-log.jsonl 中的返工记录数。
 * - reworkCount     = action === 'rework' 且（若提供 phase）phase === N 的记录数
 * - tlaReworkCount  = action === 'tla-rework' 且（若提供 phase）phase === N 的记录数
 *
 * 容错：空行跳过，单行解析失败跳过该行并 console.error 警告。
 */
function countReworks(
  lines: string[],
  phase: number | undefined,
  runLogAbs: string,
): ReworkStats {
  let reworkCount = 0;
  let tlaReworkCount = 0;
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      console.error(`⚠ run-log 第 ${i + 1} 行非合法 JSON，已跳过: ${runLogAbs}`);
      continue;
    }
    const e = entry as { action?: string; phase?: number };
    if (phase !== undefined && e.phase !== phase) continue;
    if (e.action === 'rework') reworkCount++;
    else if (e.action === 'tla-rework') tlaReworkCount++;
  }
  return { reworkCount, tlaReworkCount };
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  const { budgetFile, projectFile, runLogFile, phase } = parseArgs(process.argv);

  if (!budgetFile) {
    console.error(
      '用法: npx tsx w-model-dev/scripts/check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl>] [--phase=N]',
    );
    process.exit(2);
  }

  const budgetAbs = path.resolve(budgetFile);

  // 读 budget.json（ENOENT / 非法 JSON → exit(2)）
  let budgetRaw: string;
  try {
    budgetRaw = await fs.readFile(budgetAbs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${budgetAbs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(budgetRaw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${budgetAbs}`);
    process.exit(2);
  }

  const budget = parsed as Partial<BudgetConfig>;

  // 可选输入：--project（读失败只警告不 exit）
  let projectUpdatedAt: string | undefined;
  if (projectFile) {
    const projectAbs = path.resolve(projectFile);
    try {
      const projectRaw = await fs.readFile(projectAbs, 'utf-8');
      const projectParsed = JSON.parse(projectRaw) as { updatedAt?: string };
      projectUpdatedAt = projectParsed.updatedAt;
      if (typeof projectUpdatedAt !== 'string') {
        console.error(`⚠ --project 文件未含 updatedAt 字段，跳过 R1 时效性校验: ${projectAbs}`);
        projectUpdatedAt = undefined;
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --project 文件读取失败，跳过 R1 时效性校验: ${projectAbs}（${e.code ?? e.message}）`);
    }
  }

  // 可选输入：--run-log（读失败只警告不 exit；jsonl 容错）
  let reworkCount: number | undefined;
  let tlaReworkCount: number | undefined;
  if (runLogFile) {
    const runLogAbs = path.resolve(runLogFile);
    try {
      const runLogRaw = await fs.readFile(runLogAbs, 'utf-8');
      const lines = runLogRaw.split(/\r?\n/);
      const stats = countReworks(lines, phase, runLogAbs);
      reworkCount = stats.reworkCount;
      tlaReworkCount = stats.tlaReworkCount;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --run-log 文件读取失败，跳过 R5 触发检测: ${runLogAbs}（${e.code ?? e.message}）`);
    }
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkBudget(parsed, {
    projectUpdatedAt,
    budgetCreatedAt: budget.createdAt,
    reworkCount,
    tlaReworkCount,
  });

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('预算校验（Budget Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${budgetAbs}`);
  console.log(`projectId     : ${budget.projectId ?? '未设置'}`);
  console.log(`schemaVersion : ${budget.schemaVersion ?? '未设置'}`);
  console.log(`onExceed      : ${budget.onExceed ?? '未设置'}`);
  console.log(`--project     : ${projectFile ? (projectUpdatedAt ?? '已读取但无 updatedAt') : '未提供'}`);
  console.log(`--run-log     : ${runLogFile ? `${runLogFile}（rework=${reworkCount ?? 'N/A'}, tla-rework=${tlaReworkCount ?? 'N/A'}）` : '未提供'}`);
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
    console.log('O 子代理须按上述原因处置（刷新 budget.updatedAt / 补全 schema / 修正 onExceed / 响应 killSwitch），详见：');
    console.log('  w-model-dev/references/operational-recovery.md §成本预算与运行日志');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('BUDGET_JSON ' + JSON.stringify({
    type: 'budget',
    passed: result.passed,
    exitCode,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('预算校验脚本异常:', err);
  process.exit(2);
});
