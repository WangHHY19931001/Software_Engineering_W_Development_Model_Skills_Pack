# D8 Run-log Identity 3 S-fix 报告

- 目标 worktree：`D:\w_skill_opt\wmodel-audit-remediation`
- 基线 HEAD：`be91446b31ddd6bd315357d5aa9d05b010e8fbb0`
- 设计规格 commit：`e5329f9` (`docs: specify run-log identity 3 s-fix`)
- 本次范围：最终身份审查 C1/C2/I1/I2/I3/I4
- 提交边界：仅 tracked code/tests/schema/docs 与本报告；不提交既有 `.w-model/`、plans/specs/reviews 审计材料

## 实现摘要

1. **strict/legacy segment 隔离**
   - 移除 phase/round bucket 级 strict widening 与 phase-wide legacy skip。
   - strict lifecycle 按完整 `phase + round + reportId + targetKind + basedOnReport + implementationTarget` 关联。
   - 缺身份历史行只产生 `LEGACY_UNSCOPED`/deferred diagnostic，不进入 legacy R3/V/R8 credit。

2. **exact relation 与 outcome credit**
   - fix/emergency-fix 的成功 credit 仅接受 `role=S`、`outcome=success`、`target===implementationTarget`，且 artifacts 包含 exact target。
   - implementation V/G/R3/R7/R8 使用同身份、exact target relation；failed/blocked/cancelled fix 不产生 credit。
   - 保留 duplicate、provenance、gate-log、sanitizer 行为。

3. **RUN_LOG_JSON/status**
   - 默认 `RUN_LOG_JSON` 与 `--json` 共用同一 summary。
   - 合并 reducer diagnostics 与 JSONL parse diagnostics。
   - exit 0 仍可输出 `lifecycleStatus=NOT_CLOSED_NOT_PROVEN`，不将 blocking-free 误报为 lifecycle closed。

4. **fixture 与 schema**
   - raw immutable regression 改用 tracked fixture `w-model-dev/scripts/__tests__/fixtures/run-log-identity2-raw.jsonl`，不读取未提交 `.w-model/run-log.jsonl`。
   - schema 增加 fix/emergency-fix action-specific required 与 `artifacts.minItems=1`；phase 8 implementation evidence 约束 identity 字段。
   - 文档、SSoT、schema、CLI 与类型中的生命周期状态统一为 `CLOSED_UNDER_CURRENT_RULES | NOT_CLOSED_NOT_PROVEN`。

## TDD 证据

- RED：新增测试初次运行时捕获 strict + unrelated legacy phase-wide skip、legacy fix credit、exact target/artifacts、parse/status parity 与 schema required 缺口。
- GREEN：focused suite 最终通过：
  - `run-log-logic.test.ts`：71/71
  - `schema-validation.test.ts`：19/19
  - `gate-report.test.ts`：20/20
  - `docs-consistency-logic.test.ts`：157/157
  - 合计：267/267

## 最终验证（真实 exit code）

| 命令/检查 | exit |
|---|---:|
| `npm test`（55 files / 993 tests） | 0 |
| `npm run self-test`（260 samples） | 0 |
| `npm run typecheck` | 0 |
| `npm run lint:security`（不重生成 baseline，新增风险 0） | 0 |
| `npm run check:docs-consistency -- --json`（受控 Vitest JSON/provenance） | 0 |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts --json` | 0 |
| `npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts <worktree> --phase 8 --json` | 0 |
| `npx prettier --config config/prettier.config.cjs --check ...` | 0 |
| `git diff --check` | 0 |
| `npx tsx w-model-dev/scripts/cli/check-run-log.ts .w-model/run-log.jsonl --json` | 0 |

说明：曾先直接运行 docs-consistency（未提供受控 Vitest JSON artifact）得到 exit 1；随后按仓库合同生成受控 Vitest JSON/provenance 后重新运行，exit 0。曾先用错误的 CodeGraph CLI 参数形式得到 exit 2，改用 `<project-root> --phase 8 --json` 后 exit 0。上述均未修改 raw 或提交边界。

## Raw 与 fixture 不变性

- `.w-model/run-log.jsonl`：18 行，14107 bytes
- SHA-256：`22c9081a86f0a195fdcc331a2ec11bd3afcad34a9c47959e27878d01fac5f3a1`
- tracked fixture：18 行，14107 bytes
- tracked fixture SHA-256：`22c9081a86f0a195fdcc331a2ec11bd3afcad34a9c47959e27878d01fac5f3a1`
- `cmp`：exit 0
- raw 未执行 reset、restore、clean、checkout、追加、删除、重排或写入。

## Raw check-run-log lifecycle 结论

真实 raw checker 输出：

- process/JSON `exitCode=0`
- `passed=true`
- `violations=[]`
- `lifecycleStatus=NOT_CLOSED_NOT_PROVEN`
- `diagnostics` 共 6 条：
  1. `LEGACY_UNSCOPED: fix RC-phase8-10-01-sfix-20260822033128000 identity missing targetKind, implementationTarget; deferred`
  2. `pending-pre-approval: RC-phase8-2-02 同身份 V/G 未全部通过，缺 exact fix 暂不分类为 open-approved-lifecycle`
  3. `pending-pre-approval: RC-phase8-10-01 同身份 V/G 未全部通过，缺 exact fix 暂不分类为 open-approved-lifecycle`
  4. `LEGACY_UNSCOPED: fix RC-phase8-10-01-sfix-20260822033128000 R3/implementation credit deferred`
  5. `pending-pre-approval: rootcause RC-phase8-2-02 同身份缺 review(targetKind=rootcause)，不判定为 exact-fix omission`
  6. `pending-pre-approval: rootcause RC-phase8-10-01 同身份缺 review(targetKind=rootcause)，不判定为 exact-fix omission`

该结果明确表示当前 blocking violations 为空，但生命周期仍 **NOT CLOSED / NOT PROVEN**；没有伪造闭环、阶段放行、R3/R8 完整 credit 或 checkpoint 证明。

## CodeGraph 证据

- 查询文件：`.w-model/codegraph-queries/phase8-run-log-identity3-sfix.json`
- 查询已在新代码/测试 Edit 前完成并落盘。
- phase 8 CodeGraph gate：exit 0。
- 查询文件不纳入提交。

## 提交统计

- 允许提交文件：16 个（15 个 tracked code/tests/schema/docs + 本报告）
- 最终提交信息：`fix(run-log): enforce identity-scoped lifecycle credit`
- 最终提交统计：16 files changed, 521 insertions, 127 deletions
- 最终 commit SHA：以本文件提交后的 `git rev-parse HEAD` 为准（避免报告自引用 SHA 在 amend 时漂移）
- 既有未跟踪审计材料保持未暂存、未修改、未清理。

提交后 raw hash 与状态边界复核保持一致；生命周期仍为 `NOT_CLOSED_NOT_PROVEN`，不宣称超出证据范围的闭环状态。
