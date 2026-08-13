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

W 模型 8 阶段**串行**推进，每阶段由确定性门禁脚本守住边界：**门禁通过（退出码 0）才放行进入下一阶段**，任一阶段门禁失败（退出码 1）回到对应阶段返工，输入错误（退出码 2）修正后重跑。

| 阶段 | 关键产物 | 门禁脚本（`w-model-dev/scripts/cli/`） | 示例文件 |
|---|---|---|---|
| 1 需求分析 | 需求规格（主模板 + 6 子模板）、验收测试设计、RTM、图谱 REQ、TLA+ L1、BDD L1 | `check-requirement-graph.ts --phase=1`、`check-requirement-coverage.ts`、`check-tla-model.ts --phase=1`、`check-bdd-model.ts --phase=1` | [stage1-requirement-analysis.md](stage1-requirement-analysis.md) |
| 2 系统设计 | 系统设计文档、系统测试设计、RTM、图谱 SD、TLA+ L2、BDD L2 | `check-requirement-graph.ts --phase=2`、`check-tla-model.ts --phase=2 --graph=`、`check-bdd-model.ts --phase=2 --graph=` | [system-design.md](system-design.md) |
| 3 概要设计 | 接口设计文档、集成测试设计、RTM、图谱 INTF、TLA+ L3、BDD L3 | `check-requirement-graph.ts --phase=3`、`check-tla-model.ts --phase=3 --graph=`、`check-bdd-model.ts --phase=3 --graph=` | [system-design.md](system-design.md) |
| 4 详细设计 | 详细设计文档、单元测试设计、RTM、图谱 DD、TLA+ L3/L4、BDD L4 | `check-requirement-graph.ts --phase=4`（零违反硬约束）、`check-tla-model.ts --phase=4 --graph=`、`check-bdd-model.ts --phase=4 --graph=`、`check-artifact-gate.ts --phase=4 --spec-dir=` | [system-design.md](system-design.md) |
| 5 编码实现 | 实现代码、单元测试执行结果、RTM codeModule、codegraph 落盘、opsx 制品 | `check-code-tla-consistency.ts`、`check-design-contract-consistency.ts`、`check-artifact-gate.ts --phase=5` | [stage5-coding.md](stage5-coding.md) |
| 6 集成测试 | 集成测试执行结果、测试报告、RTM integrationTest | `check-artifact-gate.ts --phase=6`、`check-bdd-model.ts --phase=6` | [stage6-integration-test.md](stage6-integration-test.md) |
| 7 系统测试 | 系统测试执行结果、性能/安全报告、RTM systemTest | `check-artifact-gate.ts --phase=7`、`check-bdd-model.ts --phase=7` | [stage7-system-test.md](stage7-system-test.md) |
| 8 验收测试 | 验收测试执行结果、归档产物、RTM acceptanceTest | `check-artifact-gate.ts`（终检，默认 `--phase=8`）、`check-archive-integrity.ts`、`check-bdd-model.ts --phase=8`、`check-design-contract-consistency.ts`、`check-openspec-archive.ts` | [stage8-acceptance-test.md](stage8-acceptance-test.md) |

> 每阶段门放行前，G 还须跑 5 项闭环脚本（`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`）+ `check-role-dispatch.ts` + `check-signature-chain.ts`；阶段 5-8 附加 `check-codegraph-queries.ts` / `check-opsx-artifacts.ts`。完整分派矩阵见 [dispatch-matrix.md](../references/dispatch-matrix.md)。

## 串联执行顺序

```
阶段 1 ──▶ 阶段 2 ──▶ 阶段 3 ──▶ 阶段 4 ──▶ 阶段 5 ──▶ 阶段 6 ──▶ 阶段 7 ──▶ 阶段 8
  │门禁①      │门禁②      │门禁③      │门禁④      │门禁⑤      │门禁⑥      │门禁⑦      │终检+归档
```

1. **阶段 1 → 2**：需求图谱连通 + 单根、覆盖 100%、TLA+ L1 / BDD L1 通过，才放行系统设计。
2. **阶段 2 → 3 → 4**：设计阶段逐级演进图谱（SD → INTF → DD），TLA+/BDD 逐级细化（L2 → L3 → L4），阶段 4 零违反硬约束。
3. **阶段 4 → 5**：详细设计放行后编码，单元测试覆盖率 ≥ 80%，codeModule 回填。
4. **阶段 5 → 6 → 7**：三级测试逐层执行回填 RTM，每层质量门 `--phase=N` 通过才放行。
5. **阶段 7 → 8**：系统测试通过（中间检查）后，用户确认进入验收测试。
6. **阶段 8 交付**：终检（RTM 100% + 四级测试全通过）+ 归档完整性 + 用户确认 → 项目完成。

失败回退路径：任一阶段门禁退出码 1 → 按 `reworkHints` 回到对应产出阶段返工（如阶段 6 集成测试失败回阶段 5 编码）；退出码 2 → 修正命令行/输入后重跑。

## 典型总调用序列（一次完整项目）

```bash
# 阶段 1（需求分析）
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts .w-model/ingestion/graph.json --phase=1
npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts .w-model/coverage.json --graph=.w-model/ingestion/graph.json
npx tsx w-model-dev/scripts/cli/check-tla-model.ts .w-model/tla-manifest.json --phase=1
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=1

# 阶段 5（编码实现）
npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src/
npx tsx w-model-dev/scripts/cli/check-design-contract-consistency.ts .
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=5

# 阶段 6（集成测试）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=6 --cucumber-report=reports/cucumber/integration.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=6

# 阶段 7（系统测试）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=7 --cucumber-report=reports/cucumber/system.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=7

# 阶段 8（验收测试 + 终检 + 归档）
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts .
npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts docs/archive
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=8 --cucumber-report=reports/cucumber/acceptance.json
npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts . --phase 8
```

> 各命令的预期输出（退出码 0/1/2 示例）见对应阶段示例文件；阶段 2/3/4 门禁命令详见 [dispatch-matrix.md](../references/dispatch-matrix.md) 与 [README.md](../../README.md)「W 模型 8 阶段 × 门禁对应」。
