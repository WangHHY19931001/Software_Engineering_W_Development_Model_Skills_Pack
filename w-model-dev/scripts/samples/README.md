# samples/ 覆盖矩阵

> 本目录为 `self-test.ts`（256 条回归基线）与各 `check-*.ts` 门禁脚本的 fixture 样本集。
> **每个 fixture 必须被 `w-model-dev/scripts/cli/self-test.ts` 用例数组引用**（`file` / `sampleDir` 字段），
> 未登记的 fixture 不参与任何检查——由 `check-samples-coverage.ts` 门禁自动核对（新增样本后运行
> `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` 确认全绿）。

## 覆盖矩阵

| 子目录 | 对应 check 脚本 | self-test 用例数组（条数） | 用途 | 嵌套结构 |
|---|---|---|---|---|
| `verifier` | check-verifier-output | VERIFIER_CASES（21） | Verifier 输出校验（R13 单轴下限 / self-as-verifier / targetKind=rootcause §7.5） | 平铺 JSON |
| `gate` | check-artifact-gate | GATE_CASES（20）+ SPEC_STRUCTURE×4（16） | RTM 矩阵 / DoD / 阶段 1-6 门禁 + spec-structure 校验 | 平铺 JSON |
| `graph` | check-requirement-graph | GRAPH_CASES（28）+ ENHANCE×4（16） | 图谱 R1-R14 + 规格/大纲/详细设计增强 | 平铺 JSON |
| `tla` | check-tla-model | TLA_CASES（15） | TLA+ manifest 纯逻辑校验（self-test 驱动，不跑 SANY/TLC） | 平铺 JSON |
| `tla-e2e` | check-tla-model（SANY/TLC 全链路） | —（豁免，手动 / CI 执行） | 端到端 fixture（Counter / DeadlockDemo / InvViolation / SyntaxError） | `.tla` + `.cfg` + manifest + states/（TLC 残留，勿提交） |
| `tla-bdd-sync` | check-tla-bdd-sync | TLA_BDD_SYNC_CASES（2） | TLA+↔BDD 转移集 / 状态集 / 不变式等价 | 平铺 JSON |
| `bdd` | check-bdd-model | BDD_CASES（11） | BDD manifest + .feature 解析 / 状态机七要素 / RTM 映射 | 平铺 JSON + .feature |
| `budget` | check-budget | BUDGET_CASES（5） | BudgetConfig R1-R5（时效性 / onExceed / killSwitch） | 平铺 JSON |
| `run-log` | check-run-log + check-role-dispatch | RUN_LOG_CASES（14）+ ROLE_DISPATCH_CASES（3，复用本目录） | RunLog R1-R8（含 R8-4 轨迹顺序链）+ 角色分派完整性 | 平铺 JSONL |
| `maturity` | check-maturity | MATURITY_CASES（3） | 成熟度 R1-R5 | 平铺 JSON |
| `checkpoint` | check-checkpoint | CHECKPOINT_CASES（2） | Checkpoint R1-R5（决策非空 / 拒绝代签） | 平铺 JSONL |
| `code-tla` | check-code-tla-consistency | CODE_TLA_CASES（5） | 代码-TLA+ 四维度一致性（SD→codeModule / Next / 不变式） | 平铺 JSON |
| `state-machine` | check-state-machine-consistency | STATE_MACHINE_CASES（3） | 设计文档↔代码状态机一致性 | 平铺 JSON |
| `design-contract` | check-design-contract-consistency | DESIGN_CONTRACT_CASES（5） | 设计契约 D1-D4（路径 / 参数 / 状态码 / 响应字段） | 平铺 JSON |
| `rootcause` | check-rootcause-report | ROOTCAUSE_CASES（12） | RootCauseReport R1-R10 | 平铺 JSON |
| `preventive-review` | check-preventive-review | PREVENTIVE_REVIEW_CASES（2） | R3 预防性审查三报告完整性（--variant=standard|fix|emergency|ingest；ingest 变体路径前缀由 CLI 层构造，纯逻辑校验对所有变体一致） | 平铺 JSON |
| `iceberg` | check-iceberg-sweep | ICEBERG_CASES（4） | IcebergSweepReport R1-R5 | 平铺 JSON |
| `coverage` | check-requirement-coverage | COVERAGE_CASES（10） | 需求覆盖 C1-C10（4 矩阵 + cross-cuts） | 平铺 JSON |
| `exemption` | check-exemption | EXEMPTION_CASES（7） | 豁免审批 E1-E9（S→R→V→人类四阶段） | 平铺 JSON |
| `signature-chain` | check-signature-chain | SIGNATURE_CHAIN_CASES（15） | 签名链 R1-R10（防篡改 / 跨阶段） | 平铺 JSONL |
| `archive-integrity` | check-archive-integrity | ARCHIVE_INTEGRITY_CASES（4） | 归档完整性（清单 + 文件存在性） | 平铺 JSON |
| `schema` | 各 check 共享的 schema 校验 | SCHEMA_CASES（16） | JSON Schema 反例（required / type / additionalProperties） | 平铺 JSON |
| `codegraph-queries` | check-codegraph-queries | CODEGRAPH_QUERY_CASES（4，sampleDir 形态） | codegraph 查询落盘校验（反模式 #38） | 嵌套 `.w-model/codegraph-queries/` |
| `opsx-artifacts` | check-opsx-artifacts | OPSX_ARTIFACT_CASES（3，sampleDir 形态） | opsx 制品 + R3×3 + V 审查齐全性（反模式 #39/#40） | 嵌套 `openspec/` + `.w-model/r3-reviews/` + `.w-model/v-reviews/` |
| `openspec-archive` | check-openspec-archive | OPENSPEC_ARCHIVE_CASES（3，sampleDir 形态） | opsx:archive 归档完整性 | 嵌套 `openspec/changes/archive/` |
| `uat-path-mapping` | check-artifact-gate（B4/B5） | UAT_PATH_MAPPING_CASES（5，sampleDir 形态） | uat-path-mapping.md 解析与回填校验 | 嵌套 `docs/uat-path-mapping.md` |

合计 255 条用例 + 1 条 metadata 用例 = **256 条**（`self-test.ts` 基线）。用例数与「对应 check 脚本」列的数组条数不一致时以 self-test.ts 为准（数组条目数 = 实际执行数）。

## 排除项

- `samples/.w-model/gate-logs/`：门禁脚本运行时产物（check-bdd-model 等写入），已被 `.gitignore` 排除，非 fixture。
- `tla-e2e/states/`：TLC 运行残留（时间戳子目录），非 fixture。
- `README.md` / `.gitkeep` / 隐藏文件：非 fixture。

## 新增 fixture 流程

1. 在 `samples/<area>/` 放置文件（或嵌套 fixture 目录，参照既有结构）。
2. 在 `self-test.ts` 对应用例数组（`<AREA>_CASES`）登记一条 `{ file / sampleDir, expectedPassed, expectedReasonPatterns, description }`——**必须登记**，否则 `check-samples-coverage.ts` 报「fixture 未被引用」。
3. 若涉及 logic 层，同步 `__tests__/*-logic.test.ts` 与 `__tests__/README.md` 矩阵行。
4. 运行 `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` 与 `npm run self-test` 确认全绿。
5. 新增子目录时：先在本矩阵追加一行，再建目录。

## 维护约定

- 门禁：`check-samples-coverage.ts`（pre-push 第 15 项）核对「每个 fixture 被引用」+「每个子目录在本矩阵声明」；`self-test.ts` 头部注释声明新增约定。
- 本矩阵与 `self-test.ts` 用例数组、pre-push spot-check 路径三者必须一致——改动任一须同步另外两处。
