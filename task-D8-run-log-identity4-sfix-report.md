# D8 Run-Log Identity 4 S-Fix 收尾报告

- 审计日期：2026-08-24 UTC
- worktree：`D:\w_skill_opt\wmodel-audit-remediation`
- 分支：`fix/audit-remediation`
- 收尾前 HEAD：`3ff03a6d4d19ba38a494c4e2e0f75db254b206e9`
- 范围：收尾 inherited run-log identity 修复、真实回归、文档计数同步、门禁验证与精确提交。
- 未纳入提交：`.w-model/`、`.codegraph/`、`docs/superpowers/plans/`、`docs/superpowers/specs/`、审计 review/diagnostics/task 产物（除本报告外）。

## 1. Inherited 修复

本 worktree 起始时的 4 个 inherited tracked 修改保持并完成收尾：

- `w-model-dev/schemas/run-log.schema.json`
  - 增加 `rootcause` action 的 action-specific 必需字段约束。
  - 收紧 phase 8 lifecycle identity 与 implementation action 的字段类型/必需字段。
  - phase 8 `targetKind` 仅接受 canonical `rootcause|requirement|design|code|test`。
- `w-model-dev/scripts/logic/run-log-logic.ts`
  - 增加 canonical/legacy target-kind 形状。
  - legacy 兼容限定为 phase `<8`；phase 8 incomplete identity 只产生诊断，不进入 legacy credit aggregate。
  - successful fix、same-identity lifecycle window、failed review 后同身份 rootcause 路径与 legacy/strict segment 隔离规则收紧。
  - 保留 lifecycle summary 的 `NOT_CLOSED_NOT_PROVEN` 语义。
- `w-model-dev/scripts/__tests__/run-log-logic.test.ts`
  - 增加 failed phase-5 fix、phase-8 legacy segment、strict fix window、failed review 同身份 rootcause、identity-incomplete legacy 保护等回归覆盖。
  - `makeEntry` 与新 schema 合同同步。
- `w-model-dev/scripts/__tests__/schema-validation.test.ts`
  - 增加 phase-8 canonical identity、`targetKind=other` 拒绝、rootcause action 字段完整性测试。

## 2. 本次收尾同步

受控 Vitest JSON artifact 初次未带 provenance，docs consistency 按 fail-closed 规则拒绝；按 pre-push 同一 provenance 契约重建后，实测计数为 `55 files / 1000 tests`。因此同步了所有活体文档与 docs-consistency 测试 fixture 中的旧 `993` 计数：

- `README.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/INSTALL.md`
- `.githooks/pre-push`
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

Prettier 首次检查发现 3 个 inherited TypeScript 文件需格式化；已按项目配置格式化，随后重新执行全量测试和 docs consistency。

## 3. 真实验证

最终格式化后的受控运行：

- Vitest JSON artifact：`.w-model/diagnostics/vitest-full-2026-08-24-postformat.json`（本地 ignored，不提交）
- Vitest provenance：`.w-model/diagnostics/vitest-full-2026-08-24-postformat.provenance.json`（本地 ignored，不提交）
- `55` test files，`1000` total，`1000` passed，`0` failed
- runId：`ea7ba6c4fbd557e5`
- artifact SHA-256：`879511d3ebdc390c277c870984fddbb9bf46f0a350e0173e96c9345c83b60484`
- artifact 绑定 HEAD：`3ff03a6d4d19ba38a494c4e2e0f75db254b206e9`
- `npm run check:docs-consistency -- --json`：`exit 0`，`passed=true`，无 violations，实测 `55/1000`

指定门禁退出码：

| 命令 | exit |
|---|---:|
| `npm run self-test` | 0（260/260） |
| `npm test -- --reporter=json --outputFile=.w-model/diagnostics/vitest-full-2026-08-24-postformat.json` | 0 |
| `npm run check:docs-consistency -- --json`（同次受控 artifact/provenance） | 0 |
| `npm run typecheck` | 0 |
| `npm run lint:security`（未重生成 baseline） | 0 |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | 0 |
| `npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts . --phase=8 --json` | 0 |
| `npx prettier --config config/prettier.config.cjs --check ...` | 0 |
| `git diff --check` | 0 |
| `npx tsx w-model-dev/scripts/cli/check-run-log.ts .w-model/run-log.jsonl --json` | 0 |

Samples 输出：`fixtureCount=280`、`referencedFiles=242`、`referencedDirs=15`、`unregistered=0`、`undeclaredDirs=0`。
Security 输出：baseline `405`、豁免发现 `406`、新增发现 `0`。

## 4. RootCause JSON 门禁

以下 11 个 canonical RootCause JSON 均逐个运行 `check-rootcause-report.ts <file> --json`，每个均为 `exit 0`、`passed=true`、`reasons=[]`、`violations=[]`：

1. `.superpowers/sdd/2026-08-19-remediation-batch-d-architecture-and-maintenance/task-D8-r10-persona-review-rootcause-report.json`
2. `.superpowers/sdd/2026-08-19-remediation-batch-d-architecture-and-maintenance/task-D8-rootcause-report.json`
3. `.superpowers/sdd/2026-08-19-remediation-batch-d-architecture-and-maintenance/task-D8-round2-i1-rootcause-report.json`
4. `.superpowers/sdd/2026-08-19-remediation-batch-d-architecture-and-maintenance/task-D8-round2-rootcause-report.json`
5. `.superpowers/sdd/2026-08-22-r10-sfix-rootcause-report.json`
6. `.superpowers/sdd/2026-08-22-r10-sfix2-review-rootcause-report.json`
7. `.superpowers/sdd/2026-08-22-run-log-identity-rootcause-report.json`
8. `.superpowers/sdd/2026-08-22-run-log-identity2-rootcause-report.json`
9. `.superpowers/sdd/2026-08-22-run-log-identity3-rootcause-report.json`
10. `.superpowers/sdd/2026-08-22-run-log-identity4-rootcause-report.json`
11. `.superpowers/sdd/2026-08-22-run-log-lifecycle-rootcause-report.json`

## 5. Raw run-log 与生命周期边界

`.w-model/run-log.jsonl` 保持 immutable：

- `18` lines
- `14107` bytes
- SHA-256：`22c9081a86f0a195fdcc331a2ec11bd3afcad34a9c47959e27878d01fac5f3a1`
- 本次未追加、删除、重排、规范化或通过 `wm-write` 写入。

真实 lifecycle checker 结果：

- `passed=true`
- `reasons=[]`
- `violations=[]`
- process exit `0`
- `lifecycleStatus=NOT_CLOSED_NOT_PROVEN`
- diagnostics `6` 条，全部为非阻断 deferred/pending：
  - `LEGACY_UNSCOPED`: `RC-phase8-10-01-sfix-20260822033128000` 缺 `targetKind, implementationTarget`，deferred。
  - `pending-pre-approval`: `RC-phase8-2-02` 同身份 V/G 未全部通过，缺 exact fix，暂不分类为 open-approved-lifecycle。
  - `pending-pre-approval`: `RC-phase8-10-01` 同身份 V/G 未全部通过，缺 exact fix，暂不分类为 open-approved-lifecycle。
  - `LEGACY_UNSCOPED`: `RC-phase8-10-01-sfix-20260822033128000` R3/implementation credit deferred。
  - `pending-pre-approval`: `RC-phase8-2-02` 同身份缺 `review(targetKind=rootcause)`，不判定 exact-fix omission。
  - `pending-pre-approval`: `RC-phase8-10-01` 同身份缺 `review(targetKind=rootcause)`，不判定 exact-fix omission。

因此本次不将 checker `exit 0` 改写为 lifecycle closed，不宣称 implementation 完成、R3/R8 credit 完整、checkpoint 用户确认或阶段 8 放行。
