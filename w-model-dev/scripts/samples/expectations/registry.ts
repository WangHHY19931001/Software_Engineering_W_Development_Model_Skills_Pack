/**
 * registry 期望数据登记（D3-I，43.5.0）
 *
 * `samples/registry/` 下 M2 规则登记册 fixture 的登记（file / description / expectedDrift）。
 * 单一事实来源声明：本表 `file:` 字面量同时是 `check-samples-coverage.ts` 的引用登记面
 * （期望数据模块内 `file:` 字面量自动入引用集合，防 fixture 未被引用红灯），
 * vitest 侧（docs-consistency-logic.test.ts 的 checkRuleRegistry describe）直接读盘消费同一份
 * fixture（不二次声明内容形状）——消除双声明漂移（D3 减轨 I 同式）。
 *
 * 脚本自包含约束：本模块只承装**纯数据**，不 import 任何业务逻辑，不承载 parsed JSON
 * （解析由消费方完成）。
 */

export interface RegistryExpectation {
  /** 样本文件名（相对 samples/registry/） */
  file: string;
  /**
   * 期望是否「与 EXPECTED / 文档漂移」（bad-registry-drift 语义）：
   * false = 合法登记册（active ap 49 / active hc 14，validate + crossCheck + 漂移哨兵全通过）；
   * true = active 计数与 EXPECTED 不符（active ap 47，validate R2 + 漂移哨兵命中）。
   */
  expectedDrift: boolean;
  /** 用例说明 */
  description: string;
}

/**
 * samples/registry/ 全部 fixture 的登记（`file` 域即主键，防重名漂移）。
 */
export const REGISTRY_EXPECTATIONS: readonly RegistryExpectation[] = [
  {
    file: 'valid-registry.json',
    expectedDrift: false,
    description:
      '合法登记册（全量镜像 w-model-dev/rule-registry.json：active ap 49 / active hc 14），checkRuleRegistry passed',
  },
  {
    file: 'bad-registry-drift.json',
    expectedDrift: true,
    description: 'active 计数与 EXPECTED 漂移（active ap 47）：validateRuleRegistry + 漂移哨兵双 blocking',
  },
];
