#!/usr/bin/env tsx
/**
 * 流程度量报告脚本（metrics-report.ts）
 *
 * 从 run-log.jsonl（必读）+ budget.json（可选）生成流程度量报告，供编排者预算检查 /
 * CHECKPOINT 决策 / 阶段回顾使用。纯报告，无门禁语义（预警不改退出码）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/metrics-report.ts [project-dir] [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]
 *
 * 参数：
 *   project-dir  项目目录（默认当前工作目录），从 <dir>/.w-model/ 读取
 *   --from=ISO   timestamp 起始过滤（含边界）
 *   --to=ISO     timestamp 截止过滤（含边界）
 *   --phase=N    按阶段过滤（1-8）
 *   --json       输出完整 MetricsReport JSON 到 stdout
 *   --out=<path> 写入完整 MetricsReport JSON 到文件（与 --json 可组合；指定后不再打印人类可读节）
 *
 * 退出码：
 *   0  报告生成成功（含预警）
 *   2  输入错误（run-log.jsonl 缺失 / --phase 非法 / 非法 JSON）
 *
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.2
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  computeMetrics,
  type BudgetLike,
  type MetricsReport,
  type OrchestrationInputs,
  type RunLogEntryLike,
} from '../logic/metrics-report-logic.js';
import { readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

interface ParsedArgs {
  projectDir: string;
  from?: string;
  to?: string;
  phaseStr?: string;
  json: boolean;
  out?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const from = args.find((a) => a.startsWith('--from='))?.split('=')[1];
  const to = args.find((a) => a.startsWith('--to='))?.split('=')[1];
  const phaseStr = args.find((a) => a.startsWith('--phase='))?.split('=')[1];
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1];
  return {
    projectDir: positional[0] ?? process.cwd(),
    from,
    to,
    phaseStr,
    json,
    out,
  };
}

function fmtRecord(rec: Record<string, number>): string {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  return entries.length === 0 ? '无' : entries.map(([k, v]) => `${k}=${v}`).join(', ');
}

/**
 * 采集编排质量指标数据源（存在才统计，缺目录 → 空数组 → logic 层对应子区为 null）：
 *   - `.w-model/preventive-reviews/*.json`（R3 三维度报告；路径约定 SKILL.md §6.5）
 *   - `.w-model/iceberg/*.json`（冰山扫掠报告；路径约定 iceberg-sweep-guide.md §产出）
 * 坏文件（非法 JSON / 非对象）console.warn 跳过，不阻断报告生成（纯只读统计，无门禁语义）。
 */
async function collectOrchestrationInputs(wmodelDir: string): Promise<OrchestrationInputs> {
  const readJsonDir = async (dir: string): Promise<Record<string, unknown>[]> => {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return []; // 目录不存在 → 不统计
    }
    const out: Record<string, unknown>[] = [];
    for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
      try {
        const parsed = parseJsonSafe(await fs.readFile(path.join(dir, name), 'utf-8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          out.push(parsed as Record<string, unknown>);
        } else {
          console.warn(`⚠ 编排指标：${name} 非对象 JSON，已跳过`);
        }
      } catch {
        console.warn(`⚠ 编排指标：${name} 非合法 JSON，已跳过`);
      }
    }
    return out;
  };

  return {
    r3Reports: await readJsonDir(path.join(wmodelDir, 'preventive-reviews')),
    icebergReports: await readJsonDir(path.join(wmodelDir, 'iceberg')),
  };
}

function printHuman(r: MetricsReport, runLogFile: string): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  console.log('═'.repeat(60));
  console.log('流程度量报告（metrics-report）');
  console.log('═'.repeat(60));
  console.log(`数据源        : ${runLogFile}`);
  console.log(`记录数        : ${r.meta.recordCount}`);
  console.log(`时间窗口      : ${r.meta.window.from ?? '最早'} → ${r.meta.window.to ?? '最新'}`);
  console.log('─'.repeat(60));
  console.log(
    `总体          : tokens=${r.overall.totalTokens} · 耗时=${r.overall.totalDurationS}s · 分派=${r.overall.totalSubagentSpawns} · 返工=${r.overall.reworkRecords}（${pct(r.overall.reworkRate)}）`,
  );
  console.log('阶段汇总      :');
  for (const p of r.byPhase) {
    console.log(
      `  阶段 ${p.phase}${p.phaseName ? ` ${p.phaseName}` : ''}: ${p.records} 条 · 动作 ${p.actions} · tokens ${p.tokens} · ${p.durationS}s · 返工 ${p.rework}`,
    );
  }
  console.log(`动作分布      : ${fmtRecord(r.byAction)}`);
  console.log(`角色分布      : ${fmtRecord(r.byRole)}`);
  console.log(`结果分布      : ${fmtRecord(r.byOutcome)}`);
  console.log(`门禁通过率    : ${r.gate.passed}/${r.gate.total}（${pct(r.gate.passRate)}）`);
  console.log(
    `返工连续段    : 最长 ${r.rework.maxConsecutiveRuns} 次${r.rework.exceedsKillSwitch ? '（⚠ 触发 killSwitch）' : ''}`,
  );
  if (r.budget) {
    console.log('预算          :');
    console.log(`  总消耗 ${r.budget.totalTokens} / 上限 ${r.budget.maxTokensTotal}（${pct(r.budget.totalBurnRate)}）`);
    for (const b of r.budget.byPhase) {
      console.log(
        `  阶段 ${b.phase}: ${b.tokens} / ${b.maxTokens}（${pct(b.burnRate)}）${b.exceeded ? ' ⚠ 超限' : ''}`,
      );
    }
    console.log(`  onExceed=${r.budget.onExceed}${r.budget.killSwitchTriggered ? ' · ⚠ killSwitch 触发' : ''}`);
  } else {
    console.log('预算          : 未提供（.w-model/budget.json 缺失）');
  }
  console.log('编排质量      :');
  if (r.orchestration.r3) {
    const r3 = r.orchestration.r3;
    console.log(
      `  R3 审查     : ${r3.totalReports} 份（${fmtRecord(r3.byDimension)}）· findings ${r3.totalFindings}（均 ${r3.avgFindingsPerReport.toFixed(1)}/份）· ${fmtRecord(r3.findingsBySeverity)}`,
    );
  } else {
    console.log('  R3 审查     : 未统计（.w-model/preventive-reviews/ 缺失或为空）');
  }
  if (r.orchestration.iceberg) {
    const ic = r.orchestration.iceberg;
    console.log(
      `  冰山扫掠    : ${ic.totalSweeps} 次（round 分布 ${fmtRecord(ic.roundsDistribution)}）· 新发现 ${ic.totalNewFindings}（最高 round ${ic.maxRound}）· ${fmtRecord(ic.findingsBySeverity)}`,
    );
  } else {
    console.log('  冰山扫掠    : 未统计（.w-model/iceberg/ 缺失或为空）');
  }
  {
    const rh = r.orchestration.reworkHints;
    console.log(
      `  返工提示    : ${rh.entriesWithHints} 条记录携带 · 共 ${rh.totalHints} 条提示（均 ${rh.avgHintsPerEntry.toFixed(1)}/条）`,
    );
  }
  if (r.warnings.length > 0) {
    console.log('预警          :');
    for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  }
  console.log('─'.repeat(60));
  console.log('METRICS_JSON ' + JSON.stringify(r));
}

async function main(): Promise<void> {
  const { projectDir, from, to, phaseStr, json, out } = parseArgs(process.argv);

  // --phase 校验（统一 lib/parse-phase.ts：非数字 / 非整数 / 越界均 exit 2）
  const phaseParsed = phaseStr !== undefined ? parsePhaseArg(process.argv, { min: 1, max: 8 }) : undefined;
  if (phaseStr !== undefined && phaseParsed === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--phase 参数非法',
      detail: `收到 ${phaseStr}（须为 1-8 整数）`,
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed?.phase;

  const wmodelDir = path.join(projectDir, '.w-model');
  const runLogFile = path.join(wmodelDir, 'run-log.jsonl');
  const budgetFile = path.join(wmodelDir, 'budget.json');

  // run-log 必读（缺失 → readJsonlOrExit exit 2；坏行 warn 跳过）
  const entries = (await readJsonlOrExit(runLogFile, 'run-log')) as RunLogEntryLike[];

  // budget 可选（缺失 → null；损坏 → exit 2 输入错误）
  let budget: BudgetLike | null = null;
  try {
    await fs.access(budgetFile);
    const raw = await fs.readFile(budgetFile, 'utf-8');
    budget = parseJsonSafe(raw) as BudgetLike;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      exitWithError({
        category: err instanceof SyntaxError ? 'FILE_PARSE' : 'FILE_READ',
        message: err instanceof SyntaxError ? '文件解析失败（非合法 JSON）' : '文件读取失败',
        file: budgetFile,
        detail: err instanceof SyntaxError ? undefined : (e.code ?? '未知错误'),
        exitCode: 2,
      });
      return;
    }
  }

  // 编排质量指标数据源（存在才统计；缺目录 → 对应子区为 null）
  const orch = await collectOrchestrationInputs(wmodelDir);

  const report = computeMetrics(entries, budget, { from, to, phase }, orch);

  if (out) {
    await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf-8');
    console.error(`✓ 度量报告已写入: ${path.resolve(out)}`);
  }
  if (json) {
    console.log(JSON.stringify(report));
  }
  if (!json && !out) {
    printHuman(report, runLogFile);
  }
  process.exit(0);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
