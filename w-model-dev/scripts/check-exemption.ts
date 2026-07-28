#!/usr/bin/env tsx
/**
 * 豁免审批校验脚本（Exemption Checker）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-exemption.ts <exemption.json>
 *
 * 参数：
 *   exemption.json   exemption.json 文件路径
 *
 * 退出码：
 *   0  校验通过（S→R→V→人类四阶段完整）
 *   1  校验失败（阶段缺失或校验未通过）
 *   2  输入错误
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkExemption } from './exemption-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-exemption.ts <exemption.json>');
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkExemption(parsed);

  console.log('═'.repeat(60));
  console.log('豁免审批校验报告');
  console.log('═'.repeat(60));
  console.log(`结果: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(`当前阶段: ${result.stage}`);
  if (result.violations.length > 0) {
    console.log('─'.repeat(60));
    console.log('违规项:');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('EXEMPTION_JSON ' + JSON.stringify({
    type: 'exemption',
    passed: result.passed,
    exitCode,
    stage: result.stage,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('豁免审批校验脚本异常:', err);
  process.exit(2);
});
