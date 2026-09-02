# 阶段编排示例：阶段 6 集成测试（执行）

> 对应 W 模型阶段 6（右 V 测试执行）。命令入口：`/wm test type=集成 result=<pass|fail>`。
> 本示例聚焦编排流程中的 check 脚本调用、命令行与预期输出；交互对话示例见 [test-execution.md](test-execution.md)。
> 示例输出为示意，实际字段以脚本输出为准。

## 阶段目标

- 执行阶段 3 设计的集成测试用例（IT-001~005），验证模块间接口契约、参数校验、跨模块数据传递。
- 由真实测试运行器（Jest / Pytest / curl + jq）执行，**禁止 LLM 估算**结果。
- 回填 RTM `integrationTest` 列与 `executionSummary.integrationTest`。

## 输入工件清单

| 工件 | 路径（示例） | 说明 |
|---|---|---|
| 集成测试设计文档 | `docs/phase3-outline/interface-design.md` | 接口契约 / 参数 / 错误码（阶段 3 产出） |
| 模块代码 | `src/**` | 阶段 5 编码产出，集成测试通过前置 |
| 集成测试代码 | `tests/integration/*.test.ts` | 按设计用例实现的可执行测试 |
| BDD 集成层 features | `.w-model/bdd-manifest.json` | L3 features（parent→L2），D5 step 绑定校验 |
| cucumber 报告 | `reports/cucumber/integration.json` | 真实测试运行器输出（阶段 5-8 用于 D5） |
| RTM | `.w-model/rtm.json` | `integrationTest` 列待回填 |

产出：集成测试报告（套用 `templates/test-report.md`）、接口兼容性报告、RTM integrationTest 回填。

## 门禁脚本与命令行

阶段 6 完成时，G 子代理依次运行：

```bash
# 1) BDD 集成测试层校验：D5 step 绑定（cucumber 报告驱动）+ D1~D4 语义等价性
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=6 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/integration.json

# 2) 阶段 6 工件质量门：integrationTest 回填 + 已通过测试层级无回归
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=6
```

> 阶段 6 附加门禁：`check-codegraph-queries.ts` / `check-opsx-artifacts.ts`（测试代码同受约束 #14（代码改动前后门禁）约束）；评审证据经 `check-verifier-output.ts` 回填。

## 预期输出（示例输出）

### 退出码 0（全部通过）

```
BDD_JSON {"type":"bdd","passed":true,"exitCode":0,"summary":"BDD 模型校验通过"}

GATE_JSON {"type":"artifact","phase":6,"passed":true,"coveragePercent":100,"reasons":[]}
```

→ G 的 exit 0 是必要证据，不单独授权推进。O 展示真实集成测试 `result`、R3/V/G 结论、RTM 与 reworkHints 后进入 🔴 CHECKPOINT · 阶段门放行；只有用户确认，才进入阶段 7 系统测试。

### 退出码 1（校验失败示例）

```
✗ [D5] 2 个 step 未绑定实现（IT-002 非法参数校验场景：features/integration/checkout.feature:14 "提交缺失 email 的订单"）
BDD_JSON {"type":"bdd","passed":false,"exitCode":1,"summary":"D5 step 绑定校验失败"}
```

→ 退出码 1：普通 V/G 失败必须走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`。若真实 IT 用例失败，S 先按运行器输出回填 `/wm test type=集成 result=fail`；R 报告经 V/G 通过后才由 S-fix 修改测试或编码。O 展示最新证据后等待用户在 🔴 CHECKPOINT 决定是否跨阶段。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数缺失 --graph=<graph.json>（phase>=2 强制）","exitCode":2}
```

→ 退出码 2：本示例中的 `--phase=6` 合法；实际输入错误是缺少 phase>=2 强制的 `--graph`，或 manifest 缺失 / JSON 非法。修正真实参数或输入后重跑。

## 编排说明

- 阶段 6 必须由真实测试运行器执行后，实际使用 `result=pass` 或 `result=fail` 回填；`result=fail` 时仅形成 R 定位线索，必须按完整普通失败链完成根因复审、S-fix、R3×3、V/G 和用户 CHECKPOINT 后，才可按 R 结论处理阶段 5。
- 阶段 6/7/8 完成时必须跑对应 `--phase=N` 质量门，不得跳过直接跑 `--phase=8` 终检（反模式 #21）。
- 集成测试通过后，RTM 四级测试列已有 单元 + 集成 两列通过。

## 要点

- BDD D5 校验在阶段 5-8 均启用，`--cucumber-report` 必须是真实运行器输出，未绑定 step 视为失败。
- `check-artifact-gate --phase=6` 校验 integrationTest 回填完整（total/passed/failed/pending）且不得低于通过基线。
