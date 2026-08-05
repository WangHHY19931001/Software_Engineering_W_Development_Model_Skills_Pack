/**
 * 状态机一致性校验纯逻辑层（State Machine Consistency Logic）
 *
 * 校验「设计文档 ↔ 代码」状态机一致性（双向比对转移与状态集合），
 * 供 check-state-machine-consistency.ts（CLI）调用。
 *
 * 纯函数层约束：不 import Node 内置 IO 模块（fs / child_process / path），
 * 不触碰 process 的退出 / 参数 / 环境 / 标准流（见 __tests__/README.md「pure/IO 函数边界」）。
 */

export interface Transition {
  from: string;
  to: string;
  event?: string;
}

export interface StateMachineConsistencyInput {
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

export function transitionKey(t: Transition): string {
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
