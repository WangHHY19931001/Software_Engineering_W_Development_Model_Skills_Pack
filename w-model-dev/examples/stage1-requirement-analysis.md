# 阶段编排示例：阶段 1 需求分析

> 对应 W 模型阶段 1（左 V 首阶段，同步右 V 验收测试设计）。命令入口：`/wm analyze <需求描述>`。
> 本示例聚焦编排流程中的 check 脚本调用、命令行与预期输出；交互对话示例见 [requirement-analysis.md](requirement-analysis.md)。
> 示例输出为示意，实际字段以脚本输出为准。

## 阶段目标

- 将自然语言需求转化为结构化《需求规格说明书》（主模板 + 6 子模板）。
- 同步设计验收测试用例（W 模型并行原则，阶段 8 执行）。
- 产出需求图谱 REQ 节点（`.w-model/ingestion/graph.json`）、TLA+ L1 规格、BDD L1 features。
- 在 RTM 登记需求列与验收测试列；运行需求覆盖分析。

## 输入工件清单

| 工件 | 路径（示例） | 说明 |
|---|---|---|
| 需求描述 | 用户输入 | 自然语言需求 + 业务背景（可选） |
| 需求规格说明书 | `docs/phase1-requirements/requirement-spec.md` | 主规格，引用 6 个子模板 |
| 子模板产物 | `docs/phase1-requirements/{system-context,glossary,traceability-matrix,behavior-spec,discipline-dod,uml-modeling}.md` | 6 份独立产物 |
| 验收测试用例设计 | `docs/test-cases/acceptance/*.md` | 阶段 1 同步设计，阶段 8 执行 |
| 需求图谱 | `.w-model/ingestion/graph.json` | A→G 收敛后的 REQ 节点（连通 + 单根） |
| TLA+ L1 规格 | `.w-model/tla-manifest.json` | 指向 `specs/` 下 `.tla` + `.cfg` |
| BDD L1 features | `.w-model/bdd-manifest.json` | 指向 `features/` 下 `.feature` |
| 需求覆盖分析 | `.w-model/coverage.json` | C1~C9 覆盖规则分析输入 |
| RTM | `.w-model/rtm.json` | 登记需求列 + 验收测试列（覆盖状态：部分） |

## 门禁脚本与命令行

阶段 1 完成时，G 子代理依次运行（均为 `npx tsx w-model-dev/scripts/cli/` 下脚本）：

```bash
# 1) 需求图谱门禁：连通性 + 单根 + 父唯一 + 阶段追溯（A→G 收敛后必跑）
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts .w-model/ingestion/graph.json --phase=1

# 2) 需求覆盖分析门禁：C1~C9 覆盖规则（--graph 可选，用于 C7 cross-cuts 一致性）
npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts .w-model/coverage.json --graph=.w-model/ingestion/graph.json

# 3) TLA+ L1 行为门禁：SANY 语法 + TLC 模型检查（阶段 1 无需 --graph）
npx tsx w-model-dev/scripts/cli/check-tla-model.ts .w-model/tla-manifest.json --phase=1

# 4) BDD L1 行为门禁：D1~D4 语义等价性 + D8 覆盖（阶段 1 无需 --graph）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=1
```

> 附加：阶段门放行前 G 还须跑 5 项闭环脚本（`check-budget` / `check-run-log` / `check-maturity` / `check-checkpoint` / `check-preventive-review`）+ `check-role-dispatch` + `check-signature-chain`；评审证据回填经 `check-verifier-output.ts`。完整分派见 [dispatch-matrix.md](../references/dispatch-matrix.md)。

## 预期输出（示例输出）

### 退出码 0（全部通过）

```
GRAPH_JSON {"type":"requirement-graph","phase":1,"passed":true,"nodes":87,"edges":115,"connectedComponents":1,"singleRoot":"REQ-ROOT","reasons":[]}

COVERAGE_JSON {"type":"coverage","passed":true,"coveredReqs":87,"totalReqs":87,"coveragePercent":100,"violations":[]}

TLA_JSON {"type":"tla-model","phase":1,"passed":true,"specs":1,"sanyOk":true,"tlcOk":true,"violations":[]}

BDD_JSON {"type":"bdd-model","phase":1,"passed":true,"features":5,"scenarios":12,"violations":[]}
```

→ 四脚本全部退出码 0，`passed=true` → 🔴 CHECKPOINT · 阶段门放行，进入阶段 2 系统设计。

### 退出码 1（校验失败示例）

```
✗ [C2] 孤立节点 REQ-041 缺少父/子关系（reworkHints: chunk-007 补 REQ-041 关系）
GRAPH_JSON {"type":"requirement-graph","phase":1,"passed":false,"nodes":87,"edges":102,"connectedComponents":2,"singleRoot":"REQ-ROOT","reasons":["C2 孤立节点:REQ-041"]}
```

→ 退出码 1：G 将 `reworkHints` 回填 run-log，O 分派 A/S 返工补漏后重跑收敛循环（MAX_ROUNDS=5）。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数缺失 <coverage.json>","exitCode":2}
```

→ 退出码 2：文件缺失 / 非法 JSON / 参数非法，修正命令行后重跑。

## 编排说明

- 阶段 1 进入时先走 ingestion 子流程（`plan-chunks` → A-chunk → A-cross → G 图谱校验 → 收敛循环），图谱收敛（连通 + 单根）后才放行 S 产出需求规格。
- 四脚本全部退出码 0 且 V 评审通过，才可放行进入阶段 2。
- RTM 本阶段仅登记需求列与验收测试列，其余列留待后续阶段逐列补登。

## 要点

- 阶段 1 是唯一覆盖 `check-requirement-coverage` 的阶段，需求覆盖不足（coveragePercent < 100%）不得放行。
- `--phase` 必须显式传 `1`（反模式 #21：阶段级门禁不得跳过或混用）。
- 验收测试用例本阶段**设计**（UAT-001~050），阶段 8 才**执行**。
