# 阶段编排示例：阶段 7 系统测试（执行 + 质量门）

> 对应 W 模型阶段 7（右 V 测试执行）。命令入口：`/wm test type=系统 result=<pass|fail>`。
> 本示例聚焦编排流程中的 check 脚本调用、命令行与预期输出；交互对话示例见 [test-execution.md](test-execution.md)。

## 阶段目标

- 执行阶段 2 设计的系统测试用例（ST-001~005），在模拟真实环境验证系统整体功能、性能与安全。
- 由真实测试运行器（k6 / OWASP ZAP / BrowserStack）执行，**禁止 LLM 估算**结果。
- 回填 RTM `systemTest` 列与 `executionSummary.systemTest`。

## 输入工件清单

| 工件 | 路径（示例） | 说明 |
|---|---|---|
| 系统测试设计文档 | `docs/phase2-system-design/*.md` | 含性能/安全/兼容性基线（阶段 2 产出） |
| 完整系统代码 | `src/**` + `tests/system/**` | 集成测试通过前置 |
| 性能 / 安全报告 | `reports/performance/`、`reports/security/` | 负载、压力、OWASP 扫描结果 |
| BDD 系统层 features | `.w-model/bdd-manifest.json` | L2 features（parent→L1），D5 step 绑定校验 |
| cucumber 报告 | `reports/cucumber/system.json` | 真实测试运行器输出 |
| RTM | `.w-model/rtm.json` | `systemTest` 列待回填 |

产出：系统测试报告（套用 `templates/test-report.md`）、性能测试结果、安全测试结果、RTM systemTest 回填。

## 门禁脚本与命令行

阶段 7 完成时，G 子代理依次运行：

```bash
# 1) BDD 系统测试层校验：D5 step 绑定（cucumber 报告驱动）+ D1~D4 语义等价性
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/system.json

# 2) 阶段 7 工件质量门：systemTest 回填 + 单元/集成/系统三级测试通过
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=7
```

> 阶段 7 附加门禁：`check-codegraph-queries.ts` / `check-opsx-artifacts.ts`；评审证据经 `check-verifier-output.ts` 回填。

## 预期输出（示例输出）

### 退出码 0（全部通过）

```
BDD_JSON {"type":"bdd","passed":true,"exitCode":0,"summary":"BDD 模型校验通过"}

GATE_JSON {"type":"artifact","phase":7,"passed":true,"coveragePercent":100,"reasons":[]}
```

→ G 的 exit 0 是阶段 7 中间检查的必要证据，不单独授权推进。O 展示真实系统测试 `result`、R3/V/G 结论、三级 RTM 状态与 reworkHints 后进入 🔴 CHECKPOINT · 阶段门放行；只有用户确认，才进入阶段 8 验收测试。

### 退出码 1（校验失败示例）

```
✗ 系统测试回填缺失：executionSummary.systemTest 不存在（ST-001~005 未回填 RTM）
GATE_JSON {"type":"artifact","phase":7,"passed":false,"coveragePercent":100,"reasons":["systemTest 未回填"]}
```

→ 退出码 1：普通 V/G 失败必须走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`。若真实 ST 用例失败，S 先按运行器输出回填 `/wm test type=系统 result=fail`；R 报告经 V/G 通过后才由 S-fix 修改。回填缺失也由 S 基于真实运行结果修正。O 展示最新证据后等待用户在 🔴 CHECKPOINT 决定是否跨阶段。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数缺失 --graph=<graph.json>（phase>=2 强制）","exitCode":2}
```

→ 退出码 2：本示例中的 `--phase=7` 合法；实际输入错误是缺少 phase>=2 强制的 `--graph`，或 manifest / project-dir 不存在、JSON 非法。修正真实参数或输入后重跑。

## 编排说明

- 系统测试通过后触发工件质量门（本阶段为三级测试中间检查）；严格意义的完整放行在阶段 8 验收通过后。
- 阶段 7 质量门通过 + 用户确认后才进入阶段 8；阶段 8 真实运行器完成后，按输出实际回填 `/wm test type=验收 result=pass` 或 `/wm test type=验收 result=fail`。
- 性能（P95 基线）、安全（无高危漏洞）、兼容性（多浏览器）任一不达标均视为系统测试失败；失败只作为 R 定位线索，必须完成完整普通失败链后才可处理编码或上游阶段。

## 要点

- `check-artifact-gate --phase=7` 只校验到系统测试层，验收列仍为待执行——这是设计行为，不是缺陷。
- BDD D5 校验失败（未绑定 step）与系统测试执行失败同样导致退出码 1；`reworkHints` 仅是 R 的定位线索，必须走完整普通失败链：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`。
