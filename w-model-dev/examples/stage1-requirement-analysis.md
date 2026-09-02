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
| 需求覆盖分析 | `.w-model/coverage.json` | C1~C10 覆盖规则分析输入 |
| RTM | `.w-model/rtm.json` | 登记需求列 + 验收测试列（覆盖状态：部分） |

## 门禁脚本与命令行

G 先在 A-ingestion 专用收敛中运行图谱门禁；exit 0 后由 O 在 🔴 CHECKPOINT 等待用户确认收敛，再分派 S 产出正式工件。S 产出后依次经过 R3×3、G 的预防审查门禁、V 评审和 G 的阶段常规门禁（均为 `npx tsx w-model-dev/scripts/cli/` 下脚本）：

```bash
# 1) 需求图谱门禁：连通性 + 单根 + 父唯一 + 阶段追溯（A→G 收敛后必跑）
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts .w-model/ingestion/graph.json --phase=1

# 2) 需求覆盖分析门禁：C1~C10 覆盖规则（--graph 可选，用于 C7 cross-cuts 一致性）
npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts .w-model/coverage.json --graph=.w-model/ingestion/graph.json

# 3) TLA+ L1 行为门禁：SANY 语法 + TLC 模型检查（阶段 1 无需 --graph）
npx tsx w-model-dev/scripts/cli/check-tla-model.ts .w-model/tla-manifest.json --phase=1

# 4) BDD L1 项目门：D4 强制真实 TLA+ 等价性证据（阶段 1 无需 --graph）
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json \
  --phase=1 --require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json
```

> 附加：S 产出后，R 先生成 R3×3，G 运行 `check-preventive-review.ts` 且 exit 0 后才分派 V；V 产出评审后，G 运行 `check-verifier-output.ts` 与阶段常规门禁。阶段门放行前 G 还须完成 `check-budget` / `check-run-log` / `check-maturity` / `check-checkpoint` / `check-role-dispatch` / `check-signature-chain`；完整分派见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）。

## 预期输出（示例输出）

### 退出码 0（图谱收敛示例）

以下 `GRAPH_JSON` 字段来自当前 valid fixture 的真实契约；数值仅对应该 fixture：

```
GRAPH_JSON {"type":"requirement-graph","passed":true,"phase":1,"totalNodes":5,"totalEdges":4,"connectedComponents":1,"isolatedNodes":[],"roots":["REQ-001"],"orphans":[],"multiParent":[],"violations":[],"warnings":["边数下限警告：当前边数 4 < 节点数 × 3 = 15（可能存在孤立节点或边缺失）","语义来源占比警告：语义来源边占比 0.0% < 80%（可能存在过多人工补丁边）"],"converged":true,"exitCode":0}
```

→ 图谱门禁 exit 0 且 `converged=true` 后，O 在 🔴 CHECKPOINT 等待用户确认 ingestion 收敛；用户确认后才分派 S。随后覆盖/TLA+/BDD、R3 预防审查门禁、V 评审和 G 常规门禁全部通过，O 展示真实证据并在第二个 🔴 CHECKPOINT 等待阶段门放行；用户放行后才进入阶段 2。

### 退出码 1（图谱未收敛示例）

以下字段来自当前 bad-orphan fixture 的真实契约，命令 exit 1：

```
GRAPH_JSON {"type":"requirement-graph","passed":false,"phase":1,"totalNodes":5,"totalEdges":4,"connectedComponents":1,"isolatedNodes":[],"roots":["REQ-001"],"orphans":["SD-002"],"multiParent":[],"violations":["单根校验失败：根候选含非 REQ 节点: SD-002（根必须是系统 REQ 节点）","orphan 校验失败：以下节点无法从根 REQ-001 经 parent 边追溯: SD-002","R1-R4 层级校验失败：REQ 节点缺 level 字段（强制必填，无降级）：REQ-001"],"converged":false,"exitCode":1}
```

→ 图谱门禁 exit 1：`GRAPH_JSON.violations[]` 是 G 的确定性失败证据；阶段 1 的 `reworkHints[]` 由 A-cross 写入 `consolidated.json` 与 `cross-analysis-report.md`，不属于 `GRAPH_JSON`。O 按提示重新分派 A-chunk/A-cross，G 重跑图谱门禁，最多 `MAX_ROUNDS=5`；不得分派 S 修改正式产物，也不得把普通 V/G 失败的 R 链套到 ingestion 专用收敛。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数缺失 <coverage.json>","exitCode":2}
```

→ 退出码 2：文件缺失 / 非法 JSON / 参数非法，修正命令行后重跑。

## 编排说明

- 阶段 1 进入时先走 ingestion 子流程（`plan-chunks` → A-chunk → A-cross → G 图谱校验 → 收敛循环）；图谱收敛（连通 + 单根）并经用户在 🔴 CHECKPOINT 确认后，才分派 S 产出需求规格。
- S 产出后完整顺序为 `R3×3 → G(check-preventive-review, exit 0) → V → G(阶段常规门禁) → O 展示证据 → 🔴 CHECKPOINT`；只有用户放行才进入阶段 2。
- 普通 V/G 失败（非 ingestion 图谱失败）必须走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，与 ingestion 的 A→G 收敛分开处理；不得直接分派 S-fix 或回需求阶段。
- RTM 本阶段仅登记需求列与验收测试列，其余列留待后续阶段逐列补登。

## 要点

- 阶段 1 是唯一覆盖 `check-requirement-coverage` 的阶段，需求覆盖不足（coveragePercent < 100%）不得放行。
- `--phase` 必须显式传 `1`（反模式 #21：阶段级门禁不得跳过或混用）。
- 验收测试用例本阶段**设计**（UAT-001~050），阶段 8 才**执行**。
