#!/usr/bin/env tsx
/**
 * 角色分派完整性校验脚本（Role Dispatch Checker）
 *
 * 对应约束 #19 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 启用时须分派 R 角色（completeness/reliability/security 三阶段各 1 次）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]
 *
 * 参数：
 *   run-log.jsonl  run-log 文件路径（每行一条 JSON 对象）
 *   --r3-enabled   启用 R3 预防性审查时须分派 R 角色 ≥3 次
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

interface RunLogEntry {
  runId?: string;
  phase?: number;
  phaseName?: string;
  action?: string;
  role?: string;
  outcome?: string;
}

interface RoleDispatchResult {
  passed: boolean;
  violations: string[];
  phaseSummary: Array<{
    phase: number;
    roles: Record<string, number>;
    missing: string[];
  }>;
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;

/**
 * 角色分派完整性校验纯逻辑
 * @param entries run-log 解析后的条目数组
 * @param r3Enabled 是否启用 R3 预防性审查
 */
export function checkRoleDispatch(
  entries: RunLogEntry[],
  r3Enabled: boolean,
): RoleDispatchResult {
  const violations: string[] = [];
  const phaseMap = new Map<number, Map<string, number>>();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number' || typeof entry.role !== 'string') continue;
    if (!phaseMap.has(entry.phase)) phaseMap.set(entry.phase, new Map());
    const roles = phaseMap.get(entry.phase)!;
    roles.set(entry.role, (roles.get(entry.role) ?? 0) + 1);
  }

  const phaseSummary: RoleDispatchResult['phaseSummary'] = [];

  for (const [phase, roles] of phaseMap) {
    const missing: string[] = [];
    for (const required of REQUIRED_ROLES) {
      if ((roles.get(required) ?? 0) < 1) {
        missing.push(required);
        violations.push(
          `阶段 ${phase} 缺失 role=${required} 记录（约束 #19：每阶段须至少分派 S/V/G 各 1 次）`,
        );
      }
    }

    if (r3Enabled) {
      const rCount = roles.get('R') ?? 0;
      if (rCount < 3) {
        missing.push('R');
        violations.push(
          `阶段 ${phase} 缺失 role=R 记录（R3 启用：须有 3 条 R3 记录 completeness/reliability/security，当前 ${rCount} 条）`,
        );
      }
    }

    phaseSummary.push({
      phase,
      roles: Object.fromEntries(roles),
      missing,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    phaseSummary,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const r3Enabled = args.includes('--r3-enabled');

  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  const entries: RunLogEntry[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      entries.push(JSON.parse(line) as RunLogEntry);
    } catch {
      console.error(`✗ 第 ${i + 1} 行非合法 JSON: ${line.slice(0, 80)}`);
      process.exit(2);
    }
  }

  const result = checkRoleDispatch(entries, r3Enabled);

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('角色分派完整性校验（Role Dispatch Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`R3 启用       : ${r3Enabled ? '是' : '否'}`);
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

  // 末尾 JSON 摘要
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('ROLE_DISPATCH_JSON ' + JSON.stringify({
    type: 'role-dispatch',
    passed: result.passed,
    exitCode,
    r3Enabled,
    phaseCount: result.phaseSummary.length,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Role Dispatch 校验脚本异常:', err);
  process.exit(2);
});
