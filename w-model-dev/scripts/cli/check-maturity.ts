#!/usr/bin/env tsx
/**
 * 成熟度校验脚本（Maturity Checker）
 *
 * 对应 w-model-dev/references/data-models.md MaturityConfig schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.3。
 * 供 O 子代理在阶段推进前调用，校验成熟度模型 schema 完整性、level 合法性、
 * 成功阶段更新一致性、history 时序、降级触发状态。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-maturity.ts <maturity.json> [--project=<project.json>] [--run-log=<run-log.jsonl>]
 *
 * 参数：
 *   maturity.json        maturity.json 文件路径
 *   --project=<path>     project.json 路径（可选，R3/R4 交叉校验）
 *   --run-log=<path>     run-log.jsonl 路径（可选，R5 O 失败模式统计）
 *   --json               机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 MATURITY_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--project=、--run-log=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { checkMaturity, type MaturityConfig } from '../logic/maturity-logic.js';
import { readJsonOrExit, readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  maturityFile: string | undefined;
  projectFile: string | undefined;
  runLogFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const maturityFile = args.find((a) => !a.startsWith('--'));
  const projectArg = args.find((a) => a.startsWith('--project='));
  const runLogArg = args.find((a) => a.startsWith('--run-log='));
  const projectFile = projectArg ? projectArg.split('=')[1] : undefined;
  const runLogFile = runLogArg ? runLogArg.split('=')[1] : undefined;
  return { maturityFile, projectFile, runLogFile };
}

// ==================== project.status → completedPhases 映射 ====================

// status 枚举对应「已推进到的阶段序号」；项目完成视作 8 阶段全部完成
const STATUS_TO_PHASES: Record<string, number> = {
  需求分析: 1,
  系统设计: 2,
  概要设计: 3,
  详细设计: 4,
  编码: 5,
  集成测试: 6,
  系统测试: 7,
  验收测试: 8,
  项目完成: 8,
};

// ==================== run-log O 系列失败模式统计 ====================

// 匹配 note 字段中的 O1~O6 失败模式标注（如 "O1 Token Burn"、"O3 Verifier Theater"），词边界防止 O100 误命中
const O_PATTERN = /\bO[1-6]\b/g;

/**
 * 统计 run-log.jsonl 中 O 系列失败模式命中次数。
 * 扫描每条记录的 note 字段，匹配 /O[1-6]/ 即记一次。
 *
 * 容错：文件读取与逐行解析由 readJsonlOrExit 负责（坏行 warn+skip），此处仅统计。
 */
function countOperationalFailures(entries: unknown[]): number {
  let count = 0;
  for (const entry of entries) {
    const e = entry as { note?: string };
    if (typeof e.note === 'string') {
      const matches = e.note.match(O_PATTERN);
      if (matches) count += matches.length;
    }
  }
  return count;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const { maturityFile, projectFile, runLogFile } = parseArgs(process.argv);

  if (!maturityFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <maturity.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-maturity.ts <maturity.json> [--project=<project.json>] [--run-log=<run-log.jsonl>]',
      exitCode: 2,
    });
    return;
  }

  const maturityAbs = path.resolve(maturityFile);

  // 读 maturity.json（ENOENT / 非法 JSON → exit(2)）
  const parsed = await readJsonOrExit(maturityFile);

  const maturity = parsed as Partial<MaturityConfig>;

  // 可选输入：--project（读失败只警告不 exit）
  let completedPhases: number | undefined;
  let projectCreatedAt: string | undefined;
  if (projectFile) {
    const projectAbs = path.resolve(projectFile);
    try {
      const projectRaw = await fs.readFile(projectAbs, 'utf-8');
      const projectParsed = parseJsonSafe(projectRaw) as { status?: string; createdAt?: string };
      if (typeof projectParsed.status === 'string' && projectParsed.status in STATUS_TO_PHASES) {
        completedPhases = STATUS_TO_PHASES[projectParsed.status];
      } else {
        console.error(
          `⚠ --project 文件 status 字段非法或缺失，跳过 R3 校验: ${projectAbs}（status=${projectParsed.status ?? '未设置'}）`,
        );
      }
      if (typeof projectParsed.createdAt === 'string') {
        projectCreatedAt = projectParsed.createdAt;
      } else {
        console.error(`⚠ --project 文件未含 createdAt 字段，跳过 R4 时序校验: ${projectAbs}`);
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --project 文件读取失败，跳过 R3/R4 交叉校验: ${projectAbs}（${e.code ?? e.message}）`);
    }
  }

  // 可选输入：--run-log（读失败只警告不 exit；jsonl 容错）
  // 先 access 探测：readJsonlOrExit 对 ENOENT 会 exit(2)，此处须降级为警告（wm-status 同型模式）
  let operationalFailureCount: number | undefined;
  if (runLogFile) {
    const runLogAbs = path.resolve(runLogFile);
    try {
      await fs.access(runLogAbs);
      const entries = await readJsonlOrExit(runLogAbs, 'run-log');
      operationalFailureCount = countOperationalFailures(entries);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ --run-log 文件读取失败，跳过 R5 降级触发检测: ${runLogAbs}（${e.code ?? e.message}）`);
    }
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkMaturity(parsed, {
    completedPhases,
    projectCreatedAt,
    operationalFailureCount,
  });
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'maturity',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('成熟度校验（Maturity Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${maturityAbs}`);
  console.log(`projectId     : ${maturity.projectId ?? '未设置'}`);
  console.log(`schemaVersion : ${maturity.schemaVersion ?? '未设置'}`);
  console.log(`level         : ${maturity.level ?? '未设置'}`);
  console.log(
    `--project     : ${projectFile ? (completedPhases !== undefined ? `已读取（status→completedPhases=${completedPhases}, createdAt=${projectCreatedAt ?? 'N/A'}）` : '已读取但无有效 status') : '未提供'}`,
  );
  console.log(
    `--run-log     : ${runLogFile ? `${runLogFile}（O 系列命中=${operationalFailureCount ?? 'N/A'}）` : '未提供'}`,
  );
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log(
      '成熟度模型符合 data-models.md MaturityConfig schema：完整 + level 合法 + 阶段更新一致 + history 时序 + 降级未触发。',
    );
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log(
      'O 子代理须按上述原因处置（补全 schema / 修正 level / 更新 completedCycles / 修正 history 时序 / 响应降级触发），详见：',
    );
    console.log('  w-model-dev/references/data-models.md §自主成熟度模型');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  printGateReport(
    'MATURITY',
    {
      type: 'maturity',
      passed: result.passed,
      violations: result.violations,
    },
    exitCode,
  );
}

runMain(main);
