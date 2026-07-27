# Toolbox 决策表（借鉴 drawio-skill/references/toolbox.md）

> 「I have X, I want Y → use Z」决策表，覆盖 w-model-dev/scripts/ 与 subagent/ 的路由。
> 与 SKILL.md「阶段路由」互补：阶段路由按开发阶段组织，本表按用户意图组织。

## scripts 决策表

| I have | I want | Use |
|---|---|---|
| V 子代理产出 VerifierOutput JSON | 校验防漂移 | `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>` |
| RTM + project.json | 阶段 8 终检工件门 | `npx tsx w-model-dev/scripts/check-artifact-gate.ts <project-dir>` |
| RTM | 阶段 5/6/7 阶段级校验 | `check-artifact-gate.ts --phase=5\|6\|7 <project-dir>` |
| graph.json（阶段 1–4 ingestion） | 图谱结构 + 信息流门禁 | `npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=N]` |
| tla-manifest.json | TLA+ 行为门禁（SANY + TLC） | `npx tsx w-model-dev/scripts/check-tla-model.ts <manifest.json> [--phase=N]` |
| bdd-manifest.json | BDD 模型门禁（D1-D7 七维度：头标注/状态机/TLA+ 等价/step 绑定/scenario 路径/RTM 映射） | `npx tsx w-model-dev/scripts/check-bdd-model.ts <bdd-manifest.json> [--phase=N]` |
| tla-manifest + graph + rtm + src/ | 阶段 5 代码-TLA+ 一致性回归 | `npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=... --graph=... --rtm=... --src=...` |
| budget.json | 预算超限检查 | `npx tsx w-model-dev/scripts/check-budget.ts <budget.json> [--project=] [--run-log=] [--phase=N]` |
| run-log.jsonl | 运行日志完整性检查 | `npx tsx w-model-dev/scripts/check-run-log.ts <run-log.jsonl> [--gate-logs=] [--tla-manifest=]` |
| maturity.json | 成熟度等级检查 | `npx tsx w-model-dev/scripts/check-maturity.ts <maturity.json> [--project=] [--run-log=]` |
| run-log.jsonl（含 CHECKPOINT） | 决策内容具体性检查 | `npx tsx w-model-dev/scripts/check-checkpoint.ts <run-log.jsonl> [--checkpoint-log=]` |
| RootCauseReport.json | 根因报告 schema 校验 | `npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>` |
| 任意 .w-model/*.json | schema 强约束校验（被 logic 层自动调用，无需手动） | `schema-loader.ts` 内置 |
| scripts 改动 | 推送前安全扫描 | `npm run lint:security` 或 `npx tsx w-model-dev/scripts/security-scan.ts` |
| scripts 改动 | 回归基线 | `npm run self-test` |
| ingestion 阶段 | 分块计划 | `npx tsx w-model-dev/scripts/plan-chunks.ts`（O 只读 stdout） |

## subagent 决策表

完整 persona 矩阵见 [subagent-persona-matrix.md](subagent-persona-matrix.md)，下表为常用入口：

| I have | I want | Use persona |
|---|---|---|
| 阶段 5 代码评审 | code 视角多角度 | engineering-code-reviewer + engineering-backend-architect |
| 阶段 2 系统设计评审 | 架构视角 | engineering-software-architect + engineering-backend-architect |
| 阶段 6/7 测试评审 | 测试视角 | testing-api-tester + testing-test-results-analyzer |
| 性能验证 | 性能视角 | testing-performance-benchmarker |
| 安全验证 | 安全视角 | engineering-threat-detection-engineer |
| V/G 不通过 | 根因定位 | R-lead 按 subagent-persona-matrix 选用 |
| 评审结果需要质疑 | reality check | testing-reality-checker |
| 工具选型评估 | 工具视角 | testing-tool-evaluator |

## 命令速查（与 SKILL.md 互补）

详见 [command-reference.md](command-reference.md)。
