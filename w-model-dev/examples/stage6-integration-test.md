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
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json \
  --phase=6 --cucumber-report=reports/cucumber/integration.json

# 2) 阶段 6 工件质量门：integrationTest 回填 + 已通过测试层级无回归
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=6
```

> 阶段 6 附加门禁：`check-codegraph-queries.ts` / `check-opsx-artifacts.ts`（测试代码同受约束 #20/#24 约束）；评审证据经 `check-verifier-output.ts` 回填。

## 预期输出（示例输出）

### 退出码 0（全部通过）

```
BDD_JSON {"type":"bdd-model","phase":6,"passed":true,"features":4,"scenarios":6,"stepBindings":18,"undefinedSteps":0,"violations":[]}

GATE_JSON {"type":"artifact","phase":6,"passed":true,"coveragePercent":100,"reasons":[]}
```

→ 退出码 0 → 🔴 CHECKPOINT · 阶段门放行，进入阶段 7 系统测试。

### 退出码 1（校验失败示例）

```
✗ [D5] 2 个 step 未绑定实现（IT-002 非法参数校验场景：features/integration/checkout.feature:14 "提交缺失 email 的订单"）
BDD_JSON {"type":"bdd-model","phase":6,"passed":false,"features":4,"scenarios":6,"stepBindings":16,"undefinedSteps":2,"violations":[{"rule":"D5","feature":"features/integration/checkout.feature"}]}
```

→ 退出码 1：G 回填 run-log，O 分派 S 补写 step 实现后重跑；若为测试执行失败（IT 用例 ❌），按 `/wm test type=集成 result=fail` 回到阶段 5 编码返工。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数非法 --phase=6","exitCode":2}
```

→ 退出码 2：manifest 缺失 / 非法 JSON / `--phase` 越界，修正后重跑。

## 编排说明

- 阶段 6 必须由真实测试运行器执行后回填 `result=pass|fail`；`result=fail` 时给出根因、关联模块、修复建议并回到阶段 5 返工。
- 阶段 6/7/8 完成时必须跑对应 `--phase=N` 质量门，不得跳过直接跑 `--phase=8` 终检（反模式 #21）。
- 集成测试通过后，RTM 四级测试列已有 单元 + 集成 两列通过。

## 要点

- BDD D5 校验在阶段 5-8 均启用，`--cucumber-report` 必须是真实运行器输出，未绑定 step 视为失败。
- `check-artifact-gate --phase=6` 校验 integrationTest 回填完整（total/passed/failed/pending）且不得低于通过基线。
