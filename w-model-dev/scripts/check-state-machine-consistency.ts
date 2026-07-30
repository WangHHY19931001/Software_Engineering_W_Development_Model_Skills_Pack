#!/usr/bin/env tsx
/**
 * 状态机一致性校验脚本（State Machine Consistency Checker）
 *
 * 对应 Round 24 P1 问题 6：设计文档 ↔ 代码状态机一致性无自动校验。
 * 现有脚本校验"代码↔TLA+"，本脚本补"设计文档↔代码"维度。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-state-machine-consistency.ts <input.json>
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

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

interface Transition {
  from: string;
  to: string;
  event?: string;
}

interface StateMachineConsistencyInput {
  designTransitions?: Transition[];
  codeTransitions?: Transition[];
  designStates?: string[];
  codeStates?: string[];
}

export interface StateMachineConsistencyResult {
  passed: boolean;
  reasons: string[];
  designStates: string[];
  codeStates: string[];
  designTransitions: Transition[];
  codeTransitions: Transition[];
  missingInCode: Transition[];
  extraInCode: Transition[];
  missingStatesInCode: string[];
  extraStatesInCode: string[];
}

function transitionKey(t: Transition): string {
  return `${t.from}→${t.to}${t.event ? ` [${t.event}]` : ''}`;
}

export function checkStateMachineConsistency(
  input: StateMachineConsistencyInput,
): StateMachineConsistencyResult {
  const reasons: string[] = [];
  const designTransitions = Array.isArray(input.designTransitions) ? input.designTransitions : [];
  const codeTransitions = Array.isArray(input.codeTransitions) ? input.codeTransitions : [];
  const designStates = Array.isArray(input.designStates) ? input.designStates : [];
  const codeStates = Array.isArray(input.codeStates) ? input.codeStates : [];

  const designStateSet = new Set(designStates);
  const codeStateSet = new Set(codeStates);

  const missingStatesInCode = designStates.filter(s => !codeStateSet.has(s));
  const extraStatesInCode = codeStates.filter(s => !designStateSet.has(s));

  if (missingStatesInCode.length > 0) {
    reasons.push(`代码状态机缺状态（设计文档有但代码缺）：${missingStatesInCode.join(', ')}`);
  }
  if (extraStatesInCode.length > 0) {
    reasons.push(`代码状态机多状态（代码有但设计文档缺）：${extraStatesInCode.join(', ')}`);
  }

  const designTransitionKeys = new Set(designTransitions.map(transitionKey));
  const codeTransitionKeys = new Set(codeTransitions.map(transitionKey));

  const missingInCode = designTransitions.filter(t => !codeTransitionKeys.has(transitionKey(t)));
  const extraInCode = codeTransitions.filter(t => !designTransitionKeys.has(transitionKey(t)));

  if (missingInCode.length > 0) {
    reasons.push(`代码状态机缺转移（设计文档有但代码缺）：${missingInCode.map(transitionKey).join(', ')}`);
  }
  if (extraInCode.length > 0) {
    reasons.push(`代码状态机多转移（代码有但设计文档缺）：${extraInCode.map(transitionKey).join(', ')}`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
    designStates,
    codeStates,
    designTransitions,
    codeTransitions,
    missingInCode,
    extraInCode,
    missingStatesInCode,
    extraStatesInCode,
  };
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-state-machine-consistency.ts <input.json>');
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

  let parsed: StateMachineConsistencyInput;
  try {
    parsed = JSON.parse(raw) as StateMachineConsistencyInput;
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

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

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('STATE_MACHINE_JSON ' + JSON.stringify({
    type: 'state-machine-consistency',
    passed: result.passed,
    exitCode,
    designStateCount: result.designStates.length,
    codeStateCount: result.codeStates.length,
    designTransitionCount: result.designTransitions.length,
    codeTransitionCount: result.codeTransitions.length,
    missingInCode: result.missingInCode.map(transitionKey),
    extraInCode: result.extraInCode.map(transitionKey),
    reasons: result.reasons,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('State Machine Consistency 校验脚本异常:', err);
  process.exit(2);
});
