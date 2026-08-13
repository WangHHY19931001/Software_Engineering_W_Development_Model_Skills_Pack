#!/usr/bin/env tsx
/**
 * 角色分派完整性校验脚本（Role Dispatch Checker）
 *
 * 对应约束 #8 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 预防性审查无条件须分派 R 角色 ≥3 次。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]
 *
 * 参数：
 *   run-log.jsonl  run-log 文件路径（每行一条 JSON 对象）
 *   --r3-enabled   （no-op，向后兼容保留；R≥3 无条件强制）
 *   --json         机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  所有阶段角色分派完整
 *   1  缺失角色（violations 列出具体阶段与缺失角色）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 ROLE_DISPATCH_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--r3-enabled（no-op）
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRoleDispatch, type RoleDispatchEntry } from '../logic/role-dispatch-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  // --r3-enabled 保留解析以兼容旧调用，但语义为 no-op（R≥3 无条件强制）
  const r3EnabledFlagPassed = args.includes('--r3-enabled');

  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <run-log.jsonl>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]',
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在',
        file: abs,
        exitCode: 2,
      });
      return;
    }
    throw err;
  }

  const entries: RoleDispatchEntry[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      entries.push(parseJsonSafe(line) as RoleDispatchEntry);
    } catch {
      // 坏行 exit 2（不复用 readJsonlOrExit 的 warn+skip，行为不等价）
      exitWithError({
        category: 'FILE_PARSE',
        message: `第 ${i + 1} 行非合法 JSON`,
        detail: line.slice(0, 80),
        exitCode: 2,
      });
      return;
    }
  }

  const result = checkRoleDispatch(entries);
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'role-dispatch',
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

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('角色分派完整性校验（Role Dispatch Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`R3 强制       : 是（无条件）${r3EnabledFlagPassed ? ' [--r3-enabled flag 已视为 no-op]' : ''}`);
  console.log(`阶段数        : ${result.phaseSummary.length}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  for (const p of result.phaseSummary) {
    const roleStr = Object.entries(p.roles)
      .map(([r, c]) => `${r}=${c}`)
      .join(', ');
    const missingStr = p.missing.length > 0 ? ` [缺失: ${p.missing.join('/')}]` : '';
    console.log(`  阶段 ${p.phase}: ${roleStr}${missingStr}`);
  }

  if (!result.passed) {
    console.log('─'.repeat(60));
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  // 末尾 JSON 摘要（r3Enabled 恒为 true，向后兼容历史消费者）
  printGateReport(
    'ROLE_DISPATCH',
    {
      type: 'role-dispatch',
      passed: result.passed,
      r3Enabled: true,
      phaseCount: result.phaseSummary.length,
      violations: result.violations,
    },
    exitCode,
  );
}

// Windows 兼容的 main 模块判断：
//   - import.meta.url 是 file:///D:/... URL 格式
//   - process.argv[1] 是 Windows 路径 D:\... 或 POSIX 路径
//   用 fileURLToPath + path.resolve 归一化两端再比较，避免斜杠方向 / 盘符大小写差异。
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
