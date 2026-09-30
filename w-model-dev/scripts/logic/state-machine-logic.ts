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
  /** 批次1 A2：分类差异清单（本比对器全部差异为 topology；供 R/reworkHints 统一消费） */
  differences?: Array<{
    kind: 'state' | 'transition';
    direction: 'missing-in-code' | 'extra-in-code';
    subject: string;
    classification: 'topology';
  }>;
}

export function transitionKey(t: Transition): string {
  return `${t.from}→${t.to}${t.event ? ` [${t.event}]` : ''}`;
}

export function checkStateMachineConsistency(input: StateMachineConsistencyInput): StateMachineConsistencyResult {
  const reasons: string[] = [];
  const designTransitions = Array.isArray(input.designTransitions) ? input.designTransitions : [];
  const codeTransitions = Array.isArray(input.codeTransitions) ? input.codeTransitions : [];
  const designStates = Array.isArray(input.designStates) ? input.designStates : [];
  const codeStates = Array.isArray(input.codeStates) ? input.codeStates : [];

  // 零证据守卫：四数组全空时不得判通过——抽取失败会表现为「两侧都空」而不是差异。
  if (designTransitions.length + codeTransitions.length + designStates.length + codeStates.length === 0) {
    reasons.push('输入为空：设计侧与代码侧均无状态/转移（无法证明一致性；零证据不等于合规）');
  }

  const designStateSet = new Set(designStates);
  const codeStateSet = new Set(codeStates);

  const missingStatesInCode = designStates.filter((s) => !codeStateSet.has(s));
  const extraStatesInCode = codeStates.filter((s) => !designStateSet.has(s));

  if (missingStatesInCode.length > 0) {
    reasons.push(`代码状态机缺状态（设计文档有但代码缺）：${missingStatesInCode.join(', ')}`);
  }
  if (extraStatesInCode.length > 0) {
    reasons.push(`代码状态机多状态（代码有但设计文档缺）：${extraStatesInCode.join(', ')}`);
  }

  const designTransitionKeys = new Set(designTransitions.map(transitionKey));
  const codeTransitionKeys = new Set(codeTransitions.map(transitionKey));

  // 零交集守卫（批次1 A2）：两侧均有证据但状态/转移均无交集时，无法证明是同一状态机——
  // 不得按「全量缺失的差异报告」语义放行比对器，fail-closed（与 task 6 code-tla 同款语义）。
  const designNonEmpty = designStates.length + designTransitions.length > 0;
  const codeNonEmpty = codeStates.length + codeTransitions.length > 0;
  const sharedState = designStates.some((s) => codeStateSet.has(s));
  const sharedTransition = designTransitions.some((t) => codeTransitionKeys.has(transitionKey(t)));
  if (designNonEmpty && codeNonEmpty && !sharedState && !sharedTransition) {
    reasons.push('无共享状态与转移（cannot prove same system），不判一致');
  }

  const missingInCode = designTransitions.filter((t) => !codeTransitionKeys.has(transitionKey(t)));
  const extraInCode = codeTransitions.filter((t) => !designTransitionKeys.has(transitionKey(t)));

  if (missingInCode.length > 0) {
    reasons.push(`代码状态机缺转移（设计文档有但代码缺）：${missingInCode.map(transitionKey).join(', ')}`);
  }
  if (extraInCode.length > 0) {
    reasons.push(`代码状态机多转移（代码有但设计文档缺）：${extraInCode.map(transitionKey).join(', ')}`);
  }

  // 分类差异清单（批次1 A2）：从既有 missing/extra 四数组构建（missing→missing-in-code、extra→extra-in-code；
  // state 的 subject=状态名、transition 的 subject=transitionKey(t)；本比对器全部差异 classification=topology）。
  const differences: StateMachineConsistencyResult['differences'] = [
    ...missingStatesInCode.map((s) => ({
      kind: 'state' as const,
      direction: 'missing-in-code' as const,
      subject: s,
      classification: 'topology' as const,
    })),
    ...extraStatesInCode.map((s) => ({
      kind: 'state' as const,
      direction: 'extra-in-code' as const,
      subject: s,
      classification: 'topology' as const,
    })),
    ...missingInCode.map((t) => ({
      kind: 'transition' as const,
      direction: 'missing-in-code' as const,
      subject: transitionKey(t),
      classification: 'topology' as const,
    })),
    ...extraInCode.map((t) => ({
      kind: 'transition' as const,
      direction: 'extra-in-code' as const,
      subject: transitionKey(t),
      classification: 'topology' as const,
    })),
  ];

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
    differences,
  };
}
