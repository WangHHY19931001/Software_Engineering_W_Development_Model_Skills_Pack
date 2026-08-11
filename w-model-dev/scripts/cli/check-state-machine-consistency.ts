#!/usr/bin/env tsx
/**
 * 状态机一致性校验脚本（State Machine Consistency Checker）
 *
 * 对应 Round 24 P1 问题 6：设计文档 ↔ 代码状态机一致性无自动校验。
 * 现有脚本校验"代码↔TLA+"，本脚本补"设计文档↔代码"维度。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>
 *
 * input.json 格式：
 *   {
 *     "designTransitions": [{ "from": "draft", "to": "published", "event": "publish" }],
 *     "codeTransitions": [{ "from": "draft", "to": "published", "event": "publish" }],
 *     "designStates": ["draft", "published", "archived"],
 *     "codeStates": ["draft", "published", "archived"]
 *   }
 *
 * 退出码：0=一致 1=不一致 2=输入错误
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport } from '../lib/gate-report.js';
import {
  checkStateMachineConsistency,
  transitionKey,
  type StateMachineConsistencyInput,
} from '../logic/state-machine-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <input.json>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>',
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(file);
  const parsed = await readJsonOrExit<StateMachineConsistencyInput>(file);

  const result = checkStateMachineConsistency(parsed);

  console.log('═'.repeat(60));
  console.log('状态机一致性校验（State Machine Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件          : ${abs}`);
  console.log(`设计文档状态数    : ${result.designStates.length}`);
  console.log(`代码状态数        : ${result.codeStates.length}`);
  console.log(`设计文档转移数    : ${result.designTransitions.length}`);
  console.log(`代码转移数        : ${result.codeTransitions.length}`);
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const r of result.reasons) {
      console.log(`  - ${r}`);
    }
  }

  printGateReport('STATE_MACHINE', {
    type: 'state-machine-consistency',
    passed: result.passed,
    designStateCount: result.designStates.length,
    codeStateCount: result.codeStates.length,
    designTransitionCount: result.designTransitions.length,
    codeTransitionCount: result.codeTransitions.length,
    missingInCode: result.missingInCode.map(transitionKey),
    extraInCode: result.extraInCode.map(transitionKey),
    reasons: result.reasons,
  }, result.passed ? 0 : 1);
}

// isMain 守卫：仅在直接执行时运行 main，被 import 时不触发
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

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
