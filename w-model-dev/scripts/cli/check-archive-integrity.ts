#!/usr/bin/env tsx
/**
 * 归档完整性校验脚本（Archive Integrity Checker）
 *
 * 对应 SSoT §10B.2.1 归档完整性清单。
 * 供阶段 8 归档时调用，校验归档目录是否包含各阶段强制快照文件。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts <archive-dir>
 *
 * 参数：
 *   archive-dir   归档目录路径
 *
 * 退出码：
 *   0  校验通过
 *   1  完整性缺失（missingFiles 列出缺失文件）
 *   2  输入错误（目录不存在）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs, type Dirent } from 'node:fs';
import * as path from 'node:path';
import { checkArchiveIntegrity } from '../logic/archive-integrity-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

// ==================== 目录遍历 ====================

async function walkDir(dirAbs: string, baseDir: string): Promise<Set<string>> {
  const result = new Set<string>();
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirAbs, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      result.add(relPath + '/');
      const subResults = await walkDir(fullPath, baseDir);
      for (const sub of subResults) {
        result.add(sub);
      }
    } else {
      result.add(relPath);
    }
  }
  return result;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const archiveDir = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!archiveDir) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <archive-dir>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts <archive-dir>',
      exitCode: 2,
    });
    return;
  }

  const archiveAbs = path.resolve(archiveDir);
  try {
    await fs.access(archiveAbs);
  } catch {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '目录不存在',
      file: archiveAbs,
      exitCode: 2,
    });
    return;
  }

  const contents = await walkDir(archiveAbs, archiveAbs);
  const result = checkArchiveIntegrity(contents);
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport({
      type: 'archive-integrity',
      passed: result.passed,
      reasons: result.missingFiles,
      violations: buildViolationDistribution(result.missingFiles.length),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('归档完整性校验（Archive Integrity Checker）');
  console.log('═'.repeat(60));
  console.log(`归档目录          : ${archiveAbs}`);
  console.log(`文件数            : ${contents.size}`);
  console.log(`校验阶段          : ${result.checkedPhases.join(', ')}`);
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('归档完整性清单全部通过。');
  } else {
    console.log('缺失文件：');
    for (const missing of result.missingFiles) {
      console.log(`  - ${missing}`);
    }
    console.log('');
    console.log('O 子代理须按上述清单补齐缺失文件后重跑，详见：');
    console.log('  w-model-dev/references/anti-patterns.md #31');
  }

  printGateReport('ARCHIVE_INTEGRITY', {
    type: 'archive-integrity',
    passed: result.passed,
    missingFiles: result.missingFiles,
    checkedPhases: result.checkedPhases,
  }, exitCode);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
