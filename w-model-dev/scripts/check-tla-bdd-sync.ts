#!/usr/bin/env node
/**
 * TLA+/BDD 同步校验脚本（TLA-BDD Sync Checker）
 *
 * 对应 P3-10：TLA+ 规格与 BDD features 的转移/状态/不变式自动化同步校验。
 * 供 G/R 子代理在阶段 1-4 收敛循环中调用，检测 .tla 与 .feature 之间的漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-tla-bdd-sync.ts <tla-file> <feature-file>
 *
 * 参数：
 *   tla-file       .tla 文件路径
 *   feature-file   .feature 文件路径
 *
 * 退出码：
 *   0  校验通过（TLA+ 转移/状态/不变式 与 BDD When/Given/Then 一一对应）
 *   1  校验失败（violations 列出具体漂移项）
 *   2  输入错误（文件不存在 / 参数缺失）
 *
 * 输出：
 *   stdout 打印结构化 JSON 报告（便于 Agent 解析）
 */

import * as fs from 'node:fs/promises';
import { checkTlaBddSync } from './tla-bdd-sync-logic.js';
import { exitWithError } from './lib/cli-error.js';

const SYNC_JSON = {
  script: 'check-tla-bdd-sync.ts',
  exitCode: 0,
  passed: false,
  violations: [] as unknown[],
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <tla-file> <feature-file>',
      detail: '用法: check-tla-bdd-sync.ts <tla-file> <feature-file>',
      exitCode: 2,
    });
    return;
  }

  const [tlaFile, featureFile] = args;
  // noUncheckedIndexedAccess: 解构后为 string | undefined，须显式守卫
  if (!tlaFile || !featureFile) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <tla-file> <feature-file>',
      detail: '用法: check-tla-bdd-sync.ts <tla-file> <feature-file>',
      exitCode: 2,
    });
    return;
  }

  try {
    const tlaContent = await fs.readFile(tlaFile, 'utf-8');
    const featureContent = await fs.readFile(featureFile, 'utf-8');
    const result = checkTlaBddSync(tlaContent, featureContent);

    const output = {
      ...SYNC_JSON,
      exitCode: result.passed ? 0 : 1,
      passed: result.passed,
      violations: result.violations,
      summary: {
        tlaTransitions: result.tlaTransitions,
        bddTransitions: result.bddTransitions,
        tlaStates: result.tlaStates,
        bddStates: result.bddStates,
        tlaInvariants: result.tlaInvariants,
        bddInvariants: result.bddInvariants,
      },
    };

    console.log('TLA_BDD_SYNC_JSON ' + JSON.stringify({ type: 'tla-bdd-sync', passed: output.passed, exitCode: output.exitCode, violations: output.violations }));
    process.exit(output.exitCode);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
      message: e.code === 'ENOENT' ? '文件不存在' : '文件读取失败',
      detail: e.message || String(err),
      exitCode: 2,
    });
    return;
  }
}

main().catch(err => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
