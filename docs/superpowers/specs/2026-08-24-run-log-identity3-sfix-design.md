# Run-log Identity 3 S-fix 设计规格

## 目标

修复阶段 8 run-log 最终身份审查中的 C1/C2/I1/I2/I3/I4 缺陷，同时保持既有 raw `.w-model/run-log.jsonl` 不变。实现必须区分完整生命周期身份、旧格式诊断、credit 关系、机器摘要和 action-specific schema。

## 设计

### 1. 生命周期身份与隔离

implementation segment 使用 `phase + round + reportId + targetKind + basedOnReport + implementationTarget` 的完整身份；rootcause segment 使用其对应的 rootcause 投影。缺少身份字段的记录输出 `LEGACY_UNSCOPED` diagnostic，但不能作为 legacy R3、V、R8 credit，也不能被完整 strict segment 的存在全局豁免。strict/legacy 过滤必须在完整 identity/phase/round/segment 范围内进行。

### 2. Credit 关系

成功修复只认 `role=S`、`action=fix|emergency-fix`、`outcome=success`，且 `target === implementationTarget`、`artifacts` 包含 exact implementation target。相关 V/G/R3 必须匹配相同 implementation target、report identity 与 segment；`fail`、`blocked`、`cancelled` 不贡献 credit。保留现有 I3 duplicate、provenance、gate-log 和 sanitizer 规则。

### 3. CLI/status 摘要

`check-run-log` 的默认机器输出 `RUN_LOG_JSON` 必须包含合并后的 JSONL parse diagnostics 与 lifecycle status。解析错误进入摘要而非静默丢弃；生命周期 `NOT_CLOSED_NOT_PROVEN` 可在 exit code 0 时作为非阻断状态，不能被表述为闭环已证明。状态逻辑沿用同一诊断语义。

### 4. Schema 与测试

run-log schema 的 action union 与当前 27 个 action 对齐，并为 fix/emergency-fix、implementation V/G 及其必要字段设置 action-specific required 约束。测试使用已提交的 raw fixture；真实 raw 日志仅做行数和 hash 不变回归。新增测试先验证失败（红），再实现至通过（绿），覆盖无关 legacy 坏 segment、legacy fix 无 credit、target/artifacts 错误、失败 fix、JSON parse error、clean fixture。

### 5. 验证与提交边界

修改前完成 CodeGraph 影响分析并落盘 `.w-model/codegraph-queries/phase8-run-log-identity3-sfix.json`。按用户指定顺序运行 focused/full npm test、self-test、typecheck、security（不重生成 baseline）、docs-consistency、samples、phase8 CodeGraph、Prettier、diff-check 和 check-run-log。只提交明确的 code/tests/schema/docs 与本任务报告；不提交 `.w-model` 运行状态、plans、specs、reviews 或既有未跟踪审计材料。
