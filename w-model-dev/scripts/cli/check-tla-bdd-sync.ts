#!/usr/bin/env node
/**
 * TLA+/BDD 同步校验脚本（TLA-BDD Sync Checker）
 *
 * 对应 P3-10：TLA+ 规格与 BDD features 的转移/状态/不变式自动化同步校验。
 * 供 G/R 子代理在阶段 1-4 收敛循环中调用，检测 .tla 与 .feature 之间的漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-tla-bdd-sync.ts <tla-file> <feature-file>
 *
 * 参数：
 *   tla-file       .tla 文件路径
 *   feature-file   .feature 文件路径
 *   --json         机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  校验通过（TLA+ 转移/状态/不变式 与 BDD When/Given/Then 一一对应）
 *   1  校验失败（violations 列出具体漂移项）
 *   2  输入错误（文件不存在 / 参数缺失）
 *
 * 输出：
 *   stdout 打印结构化 JSON 报告（便于 Agent 解析）；人类可读模式收尾打印 TLA_BDD_SYNC_JSON 摘要
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、<tla-file> <feature-file>
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import * as fs from 'node:fs/promises';

import { checkTlaBddSync } from '../logic/tla-bdd-sync-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

const SYNC_JSON = {
  script: 'check-tla-bdd-sync.ts',
  exitCode: 0,
  passed: false,
  violations: [] as unknown[],
};

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读 JSON 摘要）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  // 位置参数过滤 -- 前缀，兼容 `--json <tla> <feature>` 的参数顺序
  const positional = args.filter((a) => !a.startsWith('--'));
  if (positional.length < 2) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <tla-file> <feature-file>',
      detail: '用法: check-tla-bdd-sync.ts <tla-file> <feature-file>',
      exitCode: 2,
    });
    return;
  }

  const [tlaFile, featureFile] = positional;
  // noUncheckedIndexedAccess: 解构后为 string | undefined，须显式守卫
  if (!tlaFile || !featureFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
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

    // A2b 双轨过渡：violations 字段直接透传 structuredViolations 对象数组（含 rule/field/message），
    // 无结构化字段时降级为原对象数组（元素含 dimension/tlaName/bddName/description）。
    // 与 check-code-tla-consistency.ts 的增强展示（[rule field] message）对称，不再拍平为字符串数组。
    const outReasons = result.structuredViolations ?? result.violations;

    const output = {
      ...SYNC_JSON,
      exitCode: result.passed ? 0 : 1,
      passed: result.passed,
      violations: outReasons,
      summary: {
        tlaTransitions: result.tlaTransitions,
        bddTransitions: result.bddTransitions,
        tlaStates: result.tlaStates,
        bddStates: result.bddStates,
        tlaInvariants: result.tlaInvariants,
        bddInvariants: result.bddInvariants,
      },
    };

    // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
    if (jsonMode) {
      // A2b 双轨过渡：reasons 优先结构化 violations 的 message；violations 分布按 rule 聚合
      printJsonReport(
        {
          type: 'tla-bdd-sync',
          passed: output.passed,
          reasons: result.structuredViolations?.length
            ? result.structuredViolations.map((v) => v.message)
            : result.violations.map((v) => `[${v.dimension}] ${v.description}`),
          violations: buildViolationDistribution(outReasons.length, result.structuredViolations),
          durationMs: Date.now() - startTime,
        },
        output.exitCode,
      );
      process.exitCode = output.exitCode;
      return;
    }

    console.log(
      'TLA_BDD_SYNC_JSON ' +
        JSON.stringify({
          type: 'tla-bdd-sync',
          passed: output.passed,
          exitCode: output.exitCode,
          violations: output.violations,
        }),
    );
    process.exit(output.exitCode);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const failedFile = e.path ?? tlaFile;
    if (err instanceof SyntaxError) {
      exitWithError({
        category: 'FILE_PARSE',
        message: '文件解析失败（非合法 JSON）',
        file: failedFile,
        exitCode: 2,
      });
    } else if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在',
        file: failedFile,
        exitCode: 2,
      });
    } else {
      exitWithError({
        category: 'FILE_READ',
        message: '文件读取失败',
        file: failedFile,
        detail: e.code ?? '未知错误',
        exitCode: 2,
      });
    }
    return;
  }
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
