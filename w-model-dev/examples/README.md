# W 模型 8 阶段编排流程示例总览

> 本目录收录 W 模型 8 阶段完整编排流程的示例：左侧 4 份为历史交互示例，右侧 6 份（含本 README）为 8 阶段串联导览与逐阶段 check 脚本调用示例。
> 全部门禁脚本位于 `w-model-dev/scripts/cli/`，退出码语义统一为 **0 = 通过 / 1 = 校验失败 / 2 = 输入错误（ERROR_JSON）**。
> **真实命令输出实录见 [real-run-evidence.md](real-run-evidence.md)**（唯一真实证据示例）；对话类示例均为「伪示例」，仅供 LLM 行为对齐，字段不代表真实输出。

## 文件清单

| 文件 | 覆盖阶段 | 内容 |
|---|---|---|
| [real-run-evidence.md](real-run-evidence.md) | 全阶段 | **真实证据**：门禁脚本实际执行输出实录（exit 0/1/2 + JSON 摘要） |
| [requirement-analysis.md](requirement-analysis.md) | 1 需求分析 | 伪示例：交互对话（含 ingestion 子流程） |
| [system-design.md](system-design.md) | 2/3/4 系统/概要/详细设计 | 伪示例：交互对话（同步测试设计） |
| [coding.md](coding.md) | 5 编码实现 | 伪示例：交互对话（含环境变量注入） |
| [test-execution.md](test-execution.md) | 6/7/8 测试执行 | 伪示例：交互对话（集成/系统/验收 + 质量门） |
| [stage1-requirement-analysis.md](stage1-requirement-analysis.md) | 1 需求分析 | 编排示例：目标 / 输入工件 / check 命令 / 预期输出 |
| [stage5-coding.md](stage5-coding.md) | 5 编码实现 | 编排示例：同上（含单元测试执行） |
| [stage6-integration-test.md](stage6-integration-test.md) | 6 集成测试 | 编排示例：同上 |
| [stage7-system-test.md](stage7-system-test.md) | 7 系统测试 | 编排示例：同上（含质量门中间检查） |
| [stage8-acceptance-test.md](stage8-acceptance-test.md) | 8 验收测试 | 编排示例：同上（终检 + 归档） |

## 8 阶段编排导览

W 模型 8 阶段**串行**推进。每阶段先经 🔴 CHECKPOINT 进入确认，再由 S 产出、R 完成 R3×3、G 运行 `check-preventive-review.ts`（exit 0）、V 评审、G 执行常规门禁；全部通过后由 O 展示证据并在 🔴 CHECKPOINT 等待用户放行。G 的退出码 0 是必要条件，不是单独的跨阶段授权；输入错误（exit 2）修正后重跑。

| 阶段 | 关键产物 | 门禁脚本（`w-model-dev/scripts/cli/`） | 示例文件 |
|---|---|---|---|
| 1 需求分析 | 需求规格（主模板 + 6 子模板）、验收测试设计、RTM、图谱 REQ、TLA+ L1、BDD L1 | `check-requirement-graph.ts --phase=1`、`check-requirement-coverage.ts`、`check-tla-model.ts --phase=1`、`check-bdd-model.ts --phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json` | [stage1-requirement-analysis.md](stage1-requirement-analysis.md) |
| 2 系统设计 | 系统设计文档、系统测试设计、RTM、图谱 SD、TLA+ L2、BDD L2 | `check-requirement-graph.ts --phase=2`、`check-tla-model.ts --phase=2 --graph=.w-model/ingestion/graph.json`、`check-bdd-model.ts --phase=2 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json` | [system-design.md](system-design.md) |
| 3 概要设计 | 接口设计文档、集成测试设计、RTM、图谱 INTF、TLA+ L3、BDD L3 | `check-requirement-graph.ts --phase=3`、`check-tla-model.ts --phase=3 --graph=.w-model/ingestion/graph.json`、`check-bdd-model.ts --phase=3 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json` | [system-design.md](system-design.md) |
| 4 详细设计 | 详细设计文档、单元测试设计、RTM、图谱 DD、TLA+ L3/L4、BDD L4 | `check-requirement-graph.ts --phase=4`（零违反硬约束）、`check-tla-model.ts --phase=4 --graph=.w-model/ingestion/graph.json`、`check-bdd-model.ts --phase=4 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json`、`check-artifact-gate.ts --phase=4 --spec-dir=<path>` | [system-design.md](system-design.md) |
| 5 编码实现 | 实现代码、单元测试执行结果、RTM codeModule、codegraph 落盘、opsx 制品 | `check-code-tla-consistency.ts`、`check-design-contract-consistency.ts`、`check-bdd-model.ts --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json`、`check-artifact-gate.ts --phase=5 --scope=.w-model/change-scope.json` | [stage5-coding.md](stage5-coding.md) |
| 6 集成测试 | 集成测试执行结果、测试报告、RTM integrationTest | `check-artifact-gate.ts --phase=6 --scope=.w-model/change-scope.json`、`check-bdd-model.ts --phase=6 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/integration.json` | [stage6-integration-test.md](stage6-integration-test.md) |
| 7 系统测试 | 系统测试执行结果、性能/安全报告、RTM systemTest | `check-artifact-gate.ts --phase=7 --scope=.w-model/change-scope.json`、`check-bdd-model.ts --phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/system.json` | [stage7-system-test.md](stage7-system-test.md) |
| 8 验收测试 | 验收测试执行结果、归档产物、RTM acceptanceTest | `check-artifact-gate.ts`（终检，默认 `--phase=8`，须 `--scope=.w-model/change-scope.json`）、`check-archive-integrity.ts`、`check-bdd-model.ts --phase=8 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/acceptance.json`、`check-design-contract-consistency.ts`、`check-openspec-archive.ts --phase=8 --scope=.w-model/change-scope.json`（归档后置门） | [stage8-acceptance-test.md](stage8-acceptance-test.md) |

> 每阶段门放行前，G 还须跑 5 项闭环脚本（`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`）+ `check-role-dispatch.ts` + `check-signature-chain.ts`；阶段 5-8 附加 `check-codegraph-queries.ts` / `check-opsx-artifacts.ts`（与 artifact gate 一样以 `--scope` 绑定变更上下文；`check-openspec-archive.ts` 为 opsx:archive 后置门，归档后单独跑）。完整分派矩阵见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）。

## 串联执行顺序

```
阶段 1 ──▶ 阶段 2 ──▶ 阶段 3 ──▶ 阶段 4 ──▶ 阶段 5 ──▶ 阶段 6 ──▶ 阶段 7 ──▶ 阶段 8
  │门禁①      │门禁②      │门禁③      │门禁④      │门禁⑤      │门禁⑥      │门禁⑦      │终检+归档
```

1. **阶段 1 → 2**：ingestion A→G 专用收敛完成后，经收敛 CHECKPOINT 进入 S；需求图谱、覆盖、TLA+ L1 / BDD L1 通过，R3/V/G 闭环完成，再经阶段门 CHECKPOINT 才放行系统设计。
2. **阶段 2 → 3 → 4**：设计阶段逐级演进图谱（SD → INTF → DD），TLA+/BDD 逐级细化（L2 → L3 → L4）；每阶段都完整执行 R3×3→G(`check-preventive-review`)→V→G 和阶段门 CHECKPOINT。
3. **阶段 4 → 5**：详细设计经用户放行后进入编码；阶段 5 还须完成 codegraph 影响分析、OpenSpec 三段式、真实单元测试和 codeModule 回填。
4. **阶段 5 → 6 → 7**：三级测试逐层执行并按真实运行器结果回填 RTM；每层 `--phase=N` 门禁通过、V 通过且用户在阶段门 CHECKPOINT 放行后才推进。
5. **阶段 7 → 8**：系统测试真实结果回填、阶段 7 R3/V/G 闭环通过后，用户在 CHECKPOINT 确认进入验收测试。
6. **阶段 8 交付**：终检（RTM 100% + 四级测试真实结果全通过）+ 归档完整性 + V/G 通过 + 用户在发布 CHECKPOINT 确认，项目才完成。

普通 V/G 失败路径：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；O 展示最新证据并等待用户决定。不得直接按 `reworkHints` 跳过 R/V/G 分派。阶段 1 ingestion 图谱失败是 A→G 专用收敛，按 A-cross 重跑，最多 `MAX_ROUNDS=5`；exit 2 只修正命令行/输入后重跑。

## 典型总调用序列（一次完整项目）

```bash
# 阶段 1（需求分析）
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts .w-model/ingestion/graph.json --phase=1
npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts .w-model/coverage.json --graph=.w-model/ingestion/graph.json
npx tsx w-model-dev/scripts/cli/check-tla-model.ts .w-model/tla-manifest.json --phase=1
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json

# 阶段 2（系统设计）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=2 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json

# 阶段 3（概要设计）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=3 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json

# 阶段 4（详细设计）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=4 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json

# 阶段 5（编码实现）
npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src/
npx tsx w-model-dev/scripts/cli/check-design-contract-consistency.ts .
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=5 --scope=.w-model/change-scope.json

# 阶段 6（集成测试）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=6 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/integration.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=6 --scope=.w-model/change-scope.json

# 阶段 7（系统测试）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/system.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=7 --scope=.w-model/change-scope.json

# 阶段 8（验收测试 + 终检 + 归档）
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --scope=.w-model/change-scope.json
npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts docs/archive
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=8 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/acceptance.json
npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts . --phase=8 --scope=.w-model/change-scope.json
```

> 各命令的预期输出（退出码 0/1/2 示例）见对应阶段示例文件；阶段 2/3/4 门禁命令详见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）与 `README.md`（仓库根）「W 模型 8 阶段 × 门禁对应」。
