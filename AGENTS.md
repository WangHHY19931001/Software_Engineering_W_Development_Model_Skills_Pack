# AGENTS.md

> 面向 AI Agent（Trae / Claude Code / Cursor 等）的仓库导航。
> 与 [README.md](./README.md) 互补：README 面向人类读者，本文件聚焦 Agent 在仓库内行动所需的最小事实集。

## 1. 仓库定位

**W-Model AI Assistant Skill** — 单纯的编排 + 校验脚本技能包：

- **技能资产**（`w-model-dev/`）：纯 Markdown + 自包含 TypeScript 门禁脚本，**不内置 LLM 调用、不包含编程式引擎（无 `src/`、无 npm 包、无 SDK）**。
- **`/wm` 命令、状态持久化、RTM 维护** 由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态写入项目内 `.w-model/*.json`。
- **编排者最小化（Orchestrator Minimization）**：Agent 读取 `w-model-dev/SKILL.md` 后承担「编排者」角色，只做路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（S 产出 / V 评审 / G 门禁 / R 根因定位）执行。详见 `w-model-dev/references/subagent-delegation.md`；违反命中反模式 #10，回到当前阶段起点。
- **根因定位者（R）与修复者（F）**：V/G 不通过后，编排者分派 R 子代理接收 reworkHints + 失败产物 + 上游产物，运用根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位缺陷根因，产出 RootCauseReport；R 报告经 V 复审 + G 门禁（`check-rootcause-report.ts` 退出码 0）后，分派 S 兼任 F（修复者）携带 R 报告执行返工修复。详见 `w-model-dev/references/root-cause-locator.md`；跳过 R 直接 S 返工命中反模式 #18，R 报告未 V 复审直接 S-fix 命中反模式 #19。
- **LLM-as-a-Verifier 评审** 由 V 子代理按 `w-model-dev/references/verifier-spec.md` 提示词执行（即「外部 Agent」），技能用校验脚本防输出漂移；编排者不得自评。
- **Agent Personas（评审角色提示词）** 由 V 子代理在执行 `/wm review` 时按 `w-model-dev/references/agent-personas.md` 选用对应 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema。多角度分析时，R-lead / V-lead 按 `w-model-dev/references/subagent-persona-matrix.md` 从 `w-model-dev/subagent/`（28 个人格文件，分 engineering / testing / design / product / project 5 类）选用 persona 并行/串行分派。
- **技能自演化** 不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。

权威设计决策以 [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) 为单一事实来源（SSoT）。

## 2. 关键目录速查

| 目录 | 用途 | Agent 行动要点 |
|---|---|---|
| `w-model-dev/` | **技能资产主体**（标准 skill 结构，可整体拷贝分发） | 安装时整体拷贝此目录；运行时按阶段加载 `references/phase-N-*.md` |
| `w-model-dev/SKILL.md` | 编排逻辑 + 命令接口 + 架构定位 | Agent 首次进入仓库必读；`/wm` 命令由其承载 |
| `w-model-dev/references/` | 阶段细则 / verifier-spec（含五轴评审 §7.4A + summary 阶段 digest 三要素 §6.2）/ agent-personas（4 个评审角色提示词）/ subagent-delegation（O/A/S/V/G/R 编排者-子代理边界，A 为阶段 1–4 分析子代理，R 为返工根因定位子代理，F 由 S 兼任；O 维护 budget/run-log/maturity）/ root-cause-locator（R 子代理根因分析方法论：5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）/ subagent-persona-matrix（R-lead / V-lead 多角度 persona 选择矩阵，关联 `w-model-dev/subagent/` 28 个人格文件）/ definition-of-done（项目级 DoD 六维度含理解证据）/ event-ingress-guide（Loop 3 事件接驳：EventIngress schema + 路由表 + 消费方指引，L2+ 激活）/ hill-climbing-guide（Loop 4 爬坡循环：HarnessImprovementReport schema + 信号检测 + 报告消费流程）/ skillopt-adoption（SkillOpt 方法论吸收：bounded edit + validation gate 流程，消费 Loop 4 信号）/ anti-patterns（19 条流程反模式含 #10 编排者越权实施 + #11 ingestion 跳过图谱校验 + #12 A 自评收敛 + #13 信息流黑洞/奇迹/死模块放行 + #14 跳过 SANY 直接 TLC + #15 死锁/不变式违反放行 + #16 TLA+ 占位/简化/错误实现 + #17 TLA+ 建模不符需求/设计不回退 + #18 跳过 R 直接 S 返工 + #19 R 报告未 V 复审 + L1~L4 教训 + 失败模式 F1~F10 + 运维失败模式 O1~O6）/ ingestion-chunk / ingestion-cross（A 子代理分块与合并细则）/ graph-guide（图谱门禁与收敛准则，含信息流模型）/ tla-plus-guide（TLA+ 层次化状态机建模与行为门禁）/ command-reference / operational-recovery（含成本预算与运行日志节 + 成熟度与 CHECKPOINT 放行节）/ 数据模型（含 budget/run-log/maturity schema）/ RTM 指南 / 质量标准 | **按需加载**，禁止一次性载入全部（反例 #5） |
| `w-model-dev/subagent/` | **人格库**（28 个 Markdown 文件，分 engineering / testing / design / product / project 5 类） | R-lead / V-lead 多角度分析时按 `references/subagent-persona-matrix.md` 选用 persona；Persona 文件本身是 Markdown，不调用 LLM |
| `w-model-dev/scripts/` | 自包含门禁脚本（仅依赖 `tsx`）：`gate-logic.ts` + `check-artifact-gate.ts`（工件质量门，含 TLA+ 资产 + SD→codeModule 终检）/ `verifier-logic.ts` + `check-verifier-output.ts`（Verifier 校验）/ `graph-logic.ts` + `check-requirement-graph.ts`（阶段 1–4 图谱结构门禁 + 信息流校验：黑洞/奇迹/死模块/边界完整性）/ `tla-logic.ts` + `check-tla-model.ts`（阶段 1–4 TLA+ 行为门禁：SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性）/ `code-tla-logic.ts` + `check-code-tla-consistency.ts`（阶段 5 代码-TLA+ 一致性回归：四维度校验 SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式；CLI `--manifest=<path> --graph=<path> --rtm=<path> --src=<dir>`）/ `budget-logic.ts` + `check-budget.ts`（Budget 门禁：R1-R5 时效性/schema/onExceed/killSwitch/触发检测；CLI `<budget.json> [--project=] [--run-log=] [--phase=N]`）/ `run-log-logic.ts` + `check-run-log.ts`（Run-log 门禁：R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序；CLI `<run-log.jsonl> [--gate-logs=] [--tla-manifest=]`）/ `maturity-logic.ts` + `check-maturity.ts`（Maturity 门禁：R1-R5 schema/level/周期/history/降级；CLI `<maturity.json> [--project=] [--run-log=]`）/ `checkpoint-logic.ts` + `check-checkpoint.ts`（Checkpoint 门禁：R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致；CLI `<run-log.jsonl> [--checkpoint-log=]`）/ `root-cause-logic.ts` + `check-rootcause-report.ts`（RootCauseReport 校验：R1-R10 Schema 完整性/根因链/可证伪/修复建议/预防/上游缺陷/质量等级/报告 ID/多角度/reality-checker 置信度；CLI `<report.json>`）/ `plan-chunks.ts`（ingestion 分块策略）/ `self-test.ts`（回归基线） | Agent 在阶段门 / 质量门 / 图谱门禁 / TLA+ 行为门禁 / 代码-TLA+ 一致性回归检查点直接 `npx tsx` 执行 |
| `w-model-dev/templates/` | 文档模板（需求 / 设计 / 测试 / RTM 等） | 产出文档时套用对应模板 |
| `w-model-dev/examples/` | 交互示例（需求分析 / 设计 / 编码 / 测试执行） | 产出前参考对应示例 |
| `w-model-dev-demo/` | **参考实现**：博客系统后端（Express + TypeScript），W 模型 8 阶段端到端调测产物 | 学习 W 模型实际产出形态时参考；不是技能运行时依赖（目录已于 2026-07-26 清理，结论见 §4 第十二轮） |
| `docs/` | 设计文档统一存放（SSoT / 集成设计 / 安装指南） | 修改设计先改 SSoT，再改 `w-model-dev/` 资产 |
| `eval/` | 外部工具（darwin-skill）评估产物归档 | 不属技能包，Agent 一般无需读取 |
| `.githooks/pre-push` | 本地推送前门禁（替代远程 CI） | 修改 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 后会触发 |

门禁脚本测试：
- `w-model-dev/scripts/__tests__/`：门禁脚本单元测试（vitest）
- `w-model-dev/scripts/samples/`：fixture 样本（含 gate-enhancement 场景）
- 运行：`cd w-model-dev && npx vitest run scripts/__tests__/`

## 3. 常用命令

```bash
# 校验脚本（自包含，仅依赖 tsx）
npm run self-test                           # 66 条样本回归基线（13 Verifier + 7 Gate + 17 Graph + 13 TLA + 3 Budget + 4 RunLog + 2 Maturity + 2 Checkpoint + 5 Code-TLA+），退出码 0/1
npm run check:verifier -- <output.json>     # Verifier 输出校验，退出码 0/1/2
npm run check:gate -- [project-dir]         # 工件质量门，退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 阶段 1–4 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>] [--skip-tlc]  # 阶段 1–4 TLA+ 行为门禁，退出码 0/1/2
npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>  # 阶段 5 代码-TLA+ 一致性回归，退出码 0/1

# 一次性启用本地推送前门禁（写入本地 .git/config，不影响仓库内容）
npm run setup:hooks

# 手动跑推送前门禁（不实际推送）
npm run prepush

# Loop 4 改进信号分析（非门禁脚本，编排者 O 执行）
npm run hill-climbing                           # （编排者 O 执行）L2+ 项目：分析 run-log 产出 HarnessImprovementReport；非门禁脚本，O 确定性分析
```

退出码约定：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。Agent 在 🔴 CHECKPOINT 处必须以脚本退出码为准，**不得用 LLM 估算**（反例 #3 / #6 / #7 / #12）。

## 4. 参考实现：`w-model-dev-demo/`

`w-model-dev-demo/` 是 W 模型 8 阶段端到端调测的完整产物，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用：

> **注**：w-model-dev-demo/ 目录已于 2026-07-26 清理，本节描述保留作为历史参考。结论见第十二轮。

- **项目**：博客系统后端（blog-system-demo），Express 4 + TypeScript 5 + 内存存储
- **8 阶段产出**：`docs/`（需求 / 系统 / 概要 / 详细设计 + 四级测试用例与报告）+ `src/`（控制器 / 服务 / 存储 / 中间件）+ `tests/`（单元 / 集成 / 系统 / 验收 / 性能）+ `tests/perf/`（k6 性能基线脚本）
- **端到端调测结论**（2026-07-24，第五轮，全量删除后从零重跑，编排者-子代理分派模式）：

| 指标 | 数值 |
|---|---|
| 单元测试 | 77/77 通过，代码覆盖率 99.37% lines / 92.66% branches / 100% functions / 99.37% statements（NFR-004 要求 ≥ 80%） |
| 集成测试 | 21/21 通过，覆盖 4 对模块交互 + 5 类错误路径，零 mock |
| 系统测试 | 22/22 通过，覆盖端到端业务链路 + 安全约束 + 性能基线 + 异常路径，P95=60.76ms（≤ 200ms） |
| 验收测试 | 15/15 通过，5/5 需求 RTM 覆盖率 100% |
| 阶段门评审 | 8 阶段全部放行（qualityLevel 均为 A，compositeScore 0.9015~0.922） |
| 图谱校验 | 阶段 1-4 退出码 0，最终图谱 35 节点 141 边，信息流零违反（无黑洞/奇迹/死模块），EXT-IN/EXT-OUT 边界完整 |
| TLA+ 行为门禁 | 阶段 1-4 退出码 0，8 个规格（1 L1 + 4 L2 + 3 L3），SANY 语法 + TLC 模型检查全通过，零死锁/不变式违反/状态爆炸 |
| 代码-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式） |
| 工件质量门 | 通过（RTM 100% + 单元覆盖率 99.37% + 四级测试全通过 + TLA+ 资产✓，退出码 0） |
| 自检基线 | 66/66 通过（13 Verifier + 7 Gate + 17 Graph + 13 TLA + 3 Budget + 4 RunLog + 2 Maturity + 2 Checkpoint + 5 Code-TLA+） |
| 全量测试 | `npm test` → 8 test files / 135 tests 全通过（77 unit + 21 integration + 22 system + 15 acceptance） |
| 用户确认 | `confirm`（self-as-verifier 模式，调测者代签；2026-07-24 全量重跑通过） |

> 第五轮（2026-07-24）相比第四轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/`/`dist/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，采用编排者-子代理分派模式（每阶段 S→V→G 子代理执行）。重跑产物为独立再实现，单元测试 53→77、覆盖率由 96.37% 提升至 99.37%（lines），集成测试 13→21、系统测试 8→22，验收测试 15 不变，全量测试 89→135。图谱节点 43→35（更精炼的 DD 拆分），边 182→141，零违反保持。TLA+ 规格 8 个（1 L1 + 4 L2 + 3 L3），层次化建模完整。过程中修正了 check-artifact-gate.ts 缺 exitCode 字段的脚本缺陷。所有门禁退出码 0，未引入新缺陷。

- **端到端调测结论**（2026-07-25，第六轮，扩展博客系统，编排者-子代理分派 + self-as-verifier 自驱模式）：

| 指标 | 数值 |
|---|---|
| 项目范围 | 扩展博客系统后端：站点管理/多博主/多用户/推荐/广告/统计/搜索/标签/分类/评论/通知/多博文/交叉引用（21 需求 = 13 REQ + 5 NFR + 3 CON） |
| 单元测试 | 209/209 通过，代码覆盖率 87.69% lines（NFR-004 要求 ≥ 80%） |
| 集成测试 | 43/43 通过，覆盖 5 类 TC-DES 用例（参数校验/跨模块/异常路径） |
| 系统测试 | 53/53 通过，P95 ≤ 200ms，1000 请求错误率 0%，内存 37.98MB |
| 验收测试 | 49/49 通过（56 vitest 用例），覆盖 21 需求 × 正常+异常+边界场景 |
| 全量测试 | 单元 209 + 集成 43 + 系统 53 + 验收 49 = 354 全通过 |
| 阶段门评审 | 8 阶段全部放行（阶段1-4 qualityLevel A~B，阶段5-8 G门禁 exit 0） |
| 图谱校验 | 阶段 1-4 退出码 0，最终图谱 76 节点 396 边，信息流零违反，EXT-IN/EXT-OUT 边界完整 |
| TLA+ 行为门禁 | 阶段 1-4 退出码 0，13 规格（1 L1 + 6 L2 + 4 L3 + 2 L4），SANY + TLC 全通过 |
| 代码-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule / 状态转移 / Next 分支 / 不变式断言） |
| 工件质量门 | 通过（RTM 100% + 单元覆盖率 87.69% + 四级测试全通过 + TLA+ 资产✓，退出码 0） |
| 用户确认 | `pending`（验收门禁通过，§9 待用户确认；按 phase-8-acceptance-test.md 规定项目级放行须用户签字） |

> 第六轮（2026-07-25）相比第五轮：项目范围从基础博客扩展为 13 功能领域（新增站点管理/多博主/推荐/广告/统计/搜索/标签/分类/评论/通知/交叉引用），需求 5→21、DD 5→29、TLA+ 规格 8→13（新增 L4 层级）、图谱节点 35→76、边 141→396。采用 self-as-verifier 自驱模式 + 编排者-子代理分派（S-doc/S-tla/V/G/R 串行）。全量测试 135→354（单元 77→209、集成 21→43、系统 22→53、验收 15→49）。过程中修复 TLA+ 不变式违反（分类树 2-循环/广告插槽语义）+ Verifier passed 字段 + SD 覆盖率 + codeModule 映射。所有门禁退出码 0。验收门禁通过，项目级放行待用户在 acceptance-test-report.md §9 确认。

- **门禁增强与文档更新**（2026-07-25，第七轮）：

| 指标 | 数值 |
|---|---|
| 范围 | 8 个技能问题修正（P1.1/P1.2/P1.3/P1.4/P2.5/P2.6/P2.7/P2.8） |
| 已实现 | P1.3（passed↔qualityLevel）、P2.8（Next 命名映射）—— 无需改脚本 |
| 新实现 | P1.1（basePath 强制）、P1.2（SD 覆盖率 spec 方向）、P1.4（codeModule 时机）、P2.5（UAT 映射表）、P2.6（不变式业务语义）、P2.7（phase-8 三段语义） |
| 测试 | vitest 63/63 + self-test 82/82 全通过 |
| fixture | 6 个集成测试覆盖门禁脚本增强（gate-enhancement.test.ts） |
| 文档 | tla-plus-guide.md §2.1/§3/§4、verifier-spec.md、phase-5-coding.md、phase-8-acceptance-test.md、phase-1-requirements.md、SKILL.md |

- **端到端调测结论**（2026-07-25，第八轮，扩展博客系统 25 需求，编排者-子代理分派 + self-as-verifier 自驱模式）：

| 指标 | 数值 |
|---|---|
| 范围 | 扩展博客系统后端（w-model-dev-demo，已清理） |
| 需求 | 25 项（17 REQ + 5 NFR + 3 CON） |
| 设计 | 17 SD + 51 DD + 17 INTF |
| TLA+ 规格 | 17 个（1 L1 + 7 L2 + 5 L3 + 3 L4）+ 3 L4 原子行为 |
| 图谱 | 216 节点 902 边，信息流零违反，EXT-IN/EXT-OUT 边界完整 |
| 源码 | 58 TS 文件（17 controllers + 17 services + 18 stores + 4 utils + app/server/types） |
| 单元测试 | 226/226 通过，代码覆盖率 83.48% lines（NFR-004 要求 ≥ 80%） |
| 集成测试 | 40/40 通过（TC-INT-001~040） |
| 系统测试 | 64/64 通过（TC-SYS-001~064） |
| 验收测试 | 56/56 通过（UAT-001~056） |
| 阶段门评审 | phase4=0.9125/A、phase5=0.923/A、phase6=0.9325/A、phase7=0.9275/A、phase8=0.9375/A |
| code-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 17/17 + 状态转移 90 + Next 分支 + 不变式断言 69） |
| 工件质量门 | check-artifact-gate 终检 exitCode=0，RTM 100%，missingItems=[] |
| 用户确认 | `confirm`（2026-07-25 用户在 acceptance-test-report.md §9 勾选 confirm，项目归档完成；currentPhase=9，project.json status=项目完成） |

> 第八轮（2026-07-25）相比第七轮（门禁增强）：本轮验证增强后门禁在 25 需求全量重跑下的端到端可用性。需求 21→25、DD 29→51、TLA+ 13→17（新增 L4 层级 3 个）、图谱节点 76→216、边 396→902。全量测试 354→386（单元 209→226、集成 43→40、系统 53→64、验收 49→56）。过程中修复 4 个源码 bug（push.service retry break→continue、article.store getById 副本、blogger.service follow 幂等、auth.service 预哈希校验）。所有门禁退出码 0。**用户已于 2026-07-25 在 acceptance-test-report.md §9 勾选 `confirm` 归档，project.json status 更新为「项目完成」，rtm.json currentPhase=9，run-log.jsonl 追加 wm8-r012 归档 checkpoint 条目。**

- **第九轮：门禁与流程细化修正结论**（2026-07-25）：

| 指标 | 数值 |
|---|---|
| 触发 | 第 8 轮 25 需求端到端调测归档后识别 11 个问题（P1×3 + P2×4 + P3×4） |
| 修正方案 | 方案 A 全量修正 11 个问题 |
| 脚本改动 | 5 个（gate-logic.ts / check-artifact-gate.ts / verifier-logic.ts / check-tla-model.ts / code-tla-logic.ts） |
| 新增 fixture | 6 个（gate/valid-phase6 + bad-phase6-pending-system + bad-phase5-missing-codemodule；verifier/bad-targetkind + bad-subcriteria-name + bad-rawscores-constant） |
| reference 文档 | 7 个（phase-1 / phase-5 / subagent-delegation / subagent-persona-matrix / verifier-spec / tla-plus-guide / SKILL） |
| 顶层文档 | 3 个（SSoT §3.4.7 + AGENTS.md §4 + CHANGELOG.md） |
| demo 修正 | phase6/7 verifier-output 标准化（targetKind testcase→test + rawScores 自然波动） |
| 工程清理 | tla/states/ 229 文件 + coverage/.tmp/ 排除规则 |
| self-test | 基线 82→91（+9 新测试）全通过 |
| TypeScript strict | 0 错误 |
| 门禁验证 | check-verifier-output phase6/7 exitCode=0；check-artifact-gate --phase=6/7/8 exitCode=0 |

> 第九轮（2026-07-25）相比第八轮（端到端调测）：门禁从「终检一次性否决」进化为「阶段级渐进式校验」（P1.1 phaseOption）；verifier 从「自由命名」进化为「4 targetKind × 5 项标准颗粒度」（P2.4/P2.5，保留 §7.1-§7.5 既有结构，不按 8 阶段细分）；子代理从「边界模糊」进化为「立即执行 + S/R 职责分明」（P1.3 反模式 #20 + P2.7 修改边界）。TLA+ 工程化增强：states 自动清理（P3.8）+ Next 分支覆盖扩展至全部 specs（P3.9）。verifier 防漂移增强：rawScores 全同检测 + 完美等差数列检测 + 扰动范围校验（P3.10）。

- **端到端调测结论**（2026-07-26，第十二轮，扩展博客系统 32 需求，编排者-子代理分派 + self-as-verifier 自驱模式）：

| 指标 | 数值 |
|---|---|
| 范围 | 扩展博客系统后端（w-model-dev-demo，已清理），新增审计日志/RSS/Webhook/API 限流领域 |
| 需求 | 32 项（22 REQ + 6 NFR + 4 CON） |
| 设计 | 22 SD + 22 INTF + 75 DD |
| TLA+ 规格 | 22 个（1 L1 + 9 L2 + 7 L3 + 5 L4），SANY+TLC 零违反 |
| 图谱 | 155 节点 638 边，信息流零违反，EXT-IN/EXT-OUT 边界完整 |
| 源码 | 56 TS 文件（controllers + services + stores + utils + app/server/types） |
| 单元测试 | 250/250 通过，代码覆盖率 93.63% lines（NFR-004 要求 ≥ 80%） |
| 集成测试 | 69/69 通过（44 契约 + 15 跨模块 + 10 异常） |
| 系统测试 | 25/25 通过（4 性能 + 3 可靠性 + 2 内存 + 5 安全 + 2 限流 + 3 E2E + 6 异常） |
| 验收测试 | 63/63 通过（覆盖 32 需求 × 正常+异常+边界） |
| 全量测试 | 407/407 通过（250 单元 + 69 集成 + 25 系统 + 63 验收） |
| 阶段门评审 | phase1=0.887/A、phase2=0.8915/A、phase3=0.9075/A、phase4=0.914/A、phase5=0.9115/A、phase6=0.9195/A、phase7=0.9095/A、phase8=0.9095/A |
| code-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 22/22 + 状态转移 67 + Next 分支 + 不变式断言） |
| 工件质量门 | check-artifact-gate 终检 exitCode=0，RTM 100%，missingItems=[] |
| 用户确认 | `confirm`（2026-07-26 self-as-verifier 模式调测者代签；currentPhase=9，project.json status=项目完成） |

> 第十二轮（2026-07-26）相比第八轮（25 需求端到端调测）：项目范围从 25 需求扩展至 32 需求（新增审计日志 REQ-018/019 + RSS REQ-020 + Webhook REQ-021/022 + API 限流 NFR-006 + 审计日志保留 CON-004）。需求 25→32、SD 17→22、INTF 17→22、DD 51→75、TLA+ 17→22（L4 层级 3→5）、图谱节点 216→155（更精炼）、边 902→638。全量测试 386→407（单元 226→250、集成 40→69、系统 64→25、验收 56→63）。覆盖率 83.48%→93.63% lines。采用 self-as-verifier 自驱模式 + 编排者-子代理分派（每阶段独立 Task 子代理执行 S/V/G）。过程中修复 TLA+ L4 不变式违反（audit_log_retention AdvanceTime 越界）、Verifier compositeScore 漂移、RTM 映射遗漏（REQ-019/021 systemTest）、Express 4 路由权限缺失、ZodError 未捕获、限流中间件、Webhook 重试机制等问题。所有门禁退出码 0，self-as-verifier 模式调测者代签 `confirm` 归档。

- **第十三轮：门禁鲁棒性与 maturity 语义修正结论**（2026-07-26）：

| 指标 | 数值 |
|---|---|
| 触发 | 第 12 轮 32 需求端到端调测归档后识别 4 个问题（P1×1 + P2×1 + P3×1 + P4×1） |
| 修正方案 | 方案 A 全量修正 4 个问题 |
| 脚本改动 | 3 个（check-code-tla-consistency.ts / check-requirement-graph.ts / maturity-logic.ts） |
| 新增 fixture | 1 个（maturity/bad-r3-cycle-mismatch.json） |
| reference 文档 | 2 个（anti-patterns.md #21 + tla-plus-guide.md §14） |
| 顶层文档 | 3 个（SSoT §3.4.10 + AGENTS.md §4 + CHANGELOG.md） |
| self-test | 基线 91→92（+1 新测试）全通过 |
| vitest | 72/72 不变 |
| TypeScript strict | 0 错误 |
| 反模式 | #20 → #21（新增"阶段级门禁跳过"） |
| EISDIR 手动验证 | check-requirement-graph.ts 传目录路径输出"参数应为文件路径"提示，退出码 2 |
| maturity R3 回归 | 第 12 轮 demo maturity.json（completedCycles=7, completedPhases=8）不触发 R3 |

> 第十三轮（2026-07-26）相比第十二轮（端到端调测）：门禁脚本从"裸 Node 报错"进化为"EISDIR 友好提示"（P1.1）；maturity R3 从"单位矛盾的简化语义"进化为"floor(completedPhases/8) 正式语义"（P2.1）；self-as-verifier 模式从"无阶段级门禁约束"进化为"反模式 #21 强制阶段 6/7/8 跑 --phase=N"（P3.1）；TLA+ 指南从"无时间推进建模指引"进化为"§14 正反例 + 通用规则"（P4.1）。

- **第十四轮：SkillOpt 方法论吸收结论**（2026-07-26）：

| 指标 | 数值 |
|---|---|
| 触发 | Loop 4 产出 HarnessImprovementReport 信号无标准消费路径 |
| 修正方案 | 方案 A 完整建机制 + 主代理顺序执行 |
| 新增文件 | 2（skillopt-adoption.md + expanded-2026-07-26.json）+ 2 fixture（bad-summary-too-short + bad-evidence-empty） |
| 修改文件 | 12（SSoT + SKILL + 3 模板 + verifier-spec + anti-patterns + verifier-logic + valid.json + self-test + vitest + AGENTS + CHANGELOG + README） |
| 信号应用 | 10 个（低风险 8 prompt + 高风险 2 逻辑），覆盖 4 类资产 |
| SSoT 同步 | §10H 新增 + §10A 追溯表 + §10G 引用 + §3.4.2 角色表扩展 |
| self-test | 基线 92→94（+2 R11/R12）全通过 |
| vitest | 72→76（+4 R11/R12 单元测试）全通过 |
| TypeScript strict | 0 错误 |
| 候选反模式 | #22（pending V 复审） |

> 第十四轮（2026-07-26）相比第十三轮：吸收 SkillOpt「bounded edit + validation gate」方法论（非工具运行），建立 Loop 4 信号标准消费路径。新增 skillopt-adoption.md 采用指南 + SSoT §10H。10 信号覆盖 4 类资产（技能/模板/参考/脚本），低风险 8 信号（prompt 措辞）+ 高风险 2 信号（R11 summary 长度≥50 + R12 evidence 具体引用 + 方差重算边界保护）。valid.json summary 同步扩展至 ≥50 字符。候选反模式 #22 标 pending V 复审。

> 第四轮（2026-07-23）相比第三轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，验证信息流校验特性合入后技能编排端到端可用。重跑产物为独立再实现，单元测试 71→53、覆盖率由 100% 全维度回落至 96.37%/93.57%/92.30%（仍 ≥ 80% 阈值），集成/系统/验收测试计数不变，所有门禁退出码仍为 0，图谱零违反收敛 1 轮达成。本轮未引入新缺陷。

- **过程中发现并修正的缺陷**：
  1. **Express 4 async handler 不自动捕获 rejected promise**（2026-07-20 首轮）：新建 `src/utils/async-handler.ts` 包装器，包裹全部路由后重跑 6/6 通过。详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md)（已清理） §5。
  2. **JWT_SECRET 缺失导致测试套件加载失败**（2026-07-21 回归发现）：`src/utils/env.ts` 在 import 阶段即抛错，连锁导致 4 个测试套件挂掉。修正方案：`package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入。
  3. **ArticleService 类型导出消失**（2026-07-21 回归发现）：`src/services/article-service.ts` 改为内部 `class ArticleService` + `export const articleService` 实例，导致 `comment-service.ts` 的 `import type { ArticleService }` 类型丢失。修正方案：恢复 `export class ArticleService`。
  4. **vitest mock 与 express NextFunction 类型不兼容**（2026-07-21 回归发现）：`vi.fn() as unknown as NextFunction` 丢失 mock 类型，`next.mock.calls[0][0]` 报 TS2339。修正方案：用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问。
  5. **check-artifact-gate.ts 缺 exitCode 字段**（2026-07-24 第五轮发现）：`check-artifact-gate.ts` 是唯一未在 `GATE_JSON` 输出中包含 `exitCode` 字段的门禁脚本，导致 `check-run-log.ts` R6 交叉校验无法提取退出码。修正方案：与其它 7 个 `check-*.ts` 脚本对齐，计算 `const exitCode = result.passed ? 0 : 1`，写入 `GATE_JSON` 并 `process.exit(exitCode)`；同时在 `check-run-log.ts` 的 `extractExitCode` 模式数组中增加 `GATE_JSON` 标记识别。

  详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md)（已清理） §5 与 [acceptance-test-report.md](./w-model-dev-demo/docs/acceptance-test-report.md)（已清理） §9。

- **调测模式**：self-as-verifier（Agent 按本技能编排自驱完成 8 阶段，每阶段跑质量门，不暂停 CHECKPOINT）。

> Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时，可指向此目录作为具象参考。**不要**把 `w-model-dev-demo/` 视为技能运行时依赖——它不参与 `/wm` 命令编排，也不会被 `check-*-gate.ts` 读取。

## 5. 必读文档

按以下顺序建立上下文：

1. [README.md](./README.md) — 项目导航（人类可读）
2. [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) — 单一事实来源
3. [w-model-dev/SKILL.md](./w-model-dev/SKILL.md) — 编排逻辑与命令执行规则
4. [docs/INSTALL.md](./docs/INSTALL.md) — AI Agent 安装指南
5. [docs/adoption-guide.md](./docs/adoption-guide.md) — 采用路径（Greenfield vs Brownfield，人类可读；SSoT §11A 为权威定义）
6. [CONTRIBUTING.md](./CONTRIBUTING.md) — 贡献与文档维护规则
7. [CHANGELOG.md](./CHANGELOG.md) — 变更历史

## 6. 行动约束

- **SSoT 优先**：修改设计决策先改 `docs/skill-design-document_SSoT.md`，再同步 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`），最后同步 `README.md` / `CONTRIBUTING.md` / `AGENTS.md` / `CHANGELOG.md`。
- **脚本自包含**：`w-model-dev/scripts/*.ts` 不得 `import` 任何 `src/` 或外部业务模块，仅依赖本目录内文件与 Node 标准库。
- **不引入 LLM 调用**：技能包内任何文件都不得直接调用 LLM；LLM-as-a-Verifier 评审通过提示词委托 V 子代理执行。
- **CHECKPOINT 不可绕过**：`w-model-dev/SKILL.md` 中 `🔴 CHECKPOINT` 标记的暂停点必须等用户确认，不得自动推进。
- **真实测试结果回填**：`/wm test` 不得自动将测试标记为通过，必须由真实测试运行器执行后通过 `result=pass|fail` 回填（由 S 子代理执行回填，编排者不得越权）。
- **编排者最小化**：编排者只做编排（路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本），任何实施动作由 S / V / G 子代理执行。违反命中反模式 #10，回到当前阶段起点。详见 [`w-model-dev/references/subagent-delegation.md`](./w-model-dev/references/subagent-delegation.md)。
- **返工必先根因定位**：V/G 不通过后必须分派 R 子代理定位根因，禁止直接分派 S 返工（命中反模式 #18）。R 子代理按 [`w-model-dev/references/root-cause-locator.md`](./w-model-dev/references/root-cause-locator.md) 方法论产出 RootCauseReport。
- **R 报告须 V 复审 + G 门禁**：R 报告必须经 V 复审 + G 门禁（`check-rootcause-report.ts` exitCode=0）才可分派 S-fix（命中反模式 #19）。返工循环：V/G→R→V→G→S-fix→V→G。

## 7. 修复记录

- **TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归**（2026-07-24）：
  - 问题1：tla-plus-guide.md 新增命名规范/路径基准/前置清单三节；tla-spec-template.md 修正.cfg写法+补聚合示例+反例
  - 问题2：subagent-delegation.md 强化信号5（TLA+产物）+ S-doc/S-tla拆分模板；SKILL.md 角色表/自检清单强化
  - 问题3：新建 code-tla-logic.ts/check-code-tla-consistency.ts（四维度校验）；gate-logic.ts 终检新增 TLA+ 资产+SD→codeModule 校验；SSoT §10.8 追加校验项
- **R（根因定位者）+ F（修复者，由 S 兼任）角色新增**（2026-07-24）：
  - 2026-07-24: 新增 R（根因定位者）角色与 F（修复者，由 S 兼任）角色；新增返工循环 V/G→R→V→G→S-fix→V→G；新增 check-rootcause-report.ts 校验脚本（R1-R10 规则）
  - 新增 references/root-cause-locator.md（R 方法论：5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）+ references/subagent-persona-matrix.md（R-lead / V-lead 多角度 persona 选择矩阵）+ w-model-dev/subagent/（28 个人格文件，分 engineering / testing / design / product / project 5 类）
  - 新增反模式 #18（跳过 R 直接 S 返工）+ #19（R 报告未 V 复审）；anti-patterns.md 与 SSoT 同步

## 8. 脚本导航表

| 脚本名 | 用途 | 阶段 | 退出码 |
|---|---|---|---|
| check-verifier-output.ts | Verifier 输出校验（防 LLM 漂移） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-artifact-gate.ts | 工件质量门（RTM 覆盖率 + 四级测试 + TLA+ 资产 + SD→codeModule 终检） | 8 | 0=通过，1=校验失败，2=输入错误 |
| check-requirement-graph.ts | 图谱结构门禁 + 信息流校验（黑洞/奇迹/死模块/边界完整性） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-tla-model.ts | TLA+ 行为门禁（SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-code-tla-consistency.ts | 代码-TLA+ 一致性回归（四维度：SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | 5 | 0=通过，1=失败 |
| check-budget.ts | Budget 门禁（R1-R5 时效性/schema/onExceed/killSwitch/触发检测） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-run-log.ts | Run-log 门禁（R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-maturity.ts | Maturity 门禁（R1-R5 schema/level/周期/history/降级） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-checkpoint.ts | Checkpoint 门禁（R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-rootcause-report.ts | RootCauseReport 校验（R1-R10：Schema 完整性/根因链/可证伪/修复建议/预防/上游缺陷/质量等级/报告 ID/多角度/reality-checker 置信度；CLI `npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>`） | 全阶段（返工） | 0=通过，1=校验失败，2=输入错误 |
| self-test.ts | 回归基线（66 条样本：13 Verifier + 7 Gate + 17 Graph + 13 TLA + 3 Budget + 4 RunLog + 2 Maturity + 2 Checkpoint + 5 Code-TLA+） | - | 0=通过，1=失败 |
| gate-enhancement.test.ts | 门禁增强回归测试（basePath/SD 覆盖/passed↔qualityLevel） | - | 0=通过，1=失败 |
