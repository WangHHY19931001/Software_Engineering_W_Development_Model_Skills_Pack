/**
 * invariant（断言锚点工具）：业务不变式运行时防护。
 * 对应 TLA+ BusinessInvariant（spec §3.4.2 维度4）：代码以 invariant() 断言抽取
 * （ExpressionStatement 含 assert/invariant/require 关键字），使 code-tla-logic 维度 4 可覆盖。
 * 条件不满足时抛 BizError（默认 50001 内部一致性破坏；调用方可传业务错误码保持语义，如 60001 状态机非法流转）。
 */
import { BizError } from './errors';

export function invariant(cond: unknown, msg: string, code: number = 50001): asserts cond {
  if (!cond) {
    throw new BizError(code, msg);
  }
}
