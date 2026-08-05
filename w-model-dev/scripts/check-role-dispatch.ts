#!/usr/bin/env tsx
/**
 * 角色分派完整性校验脚本（Role Dispatch Checker）
 *
 * 对应约束 #19 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 预防性审查无条件须分派 R 角色 ≥3 次（第29轮升级：移除 --r3-enabled flag 语义）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]
 *
 * 参数：
 *   run-log.jsonl  run-log 文件路径（每行一条 JSON 对象）
 *   --r3-enabled   （第29轮起为 no-op，向后兼容保留；R≥3 现已无条件强制）
 *
 * 退出码：
 *   0  所有阶段角色分派完整
 *   1  缺失角色（violations 列出具体阶段与缺失角色）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRoleDispatch, type RoleDispatchEntry } from './role-dispatch-logic.js';
import { exitWithError } from './lib/cli-error.js';
import { parseJsonSafe } from './lib/safe-json.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  // 第29轮：--r3-enabled 保留解析以兼容旧调用，但语义为 no-op（R≥3 无条件强制）
  const r3EnabledFlagPassed = args.includes('--r3-enabled');

  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <run-log.jsonl>',
      detail: '用法: npx tsx w-model-dev/scripts/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]',
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
      // 第 29 轮决策：坏行 exit 2 行为保留（不等价 readJsonlOrExit 的 warn+skip），仅消息加类别
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

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('角色分派完整性校验（Role Dispatch Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`R3 强制       : 是（无条件，第29轮）${r3EnabledFlagPassed ? ' [--r3-enabled flag 已视为 no-op]' : ''}`);
  console.log(`阶段数        : ${result.phaseSummary.length}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  for (const p of result.phaseSummary) {
    const roleStr = Object.entries(p.roles).map(([r, c]) => `${r}=${c}`).join(', ');
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
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('ROLE_DISPATCH_JSON ' + JSON.stringify({
    type: 'role-dispatch',
    passed: result.passed,
    exitCode,
    r3Enabled: true,
    phaseCount: result.phaseSummary.length,
    violations: result.violations,
  }));

  process.exit(exitCode);
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
