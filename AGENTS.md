# AGENTS.md

> 面向 AI Agent（Trae / Claude Code / Cursor 等）的仓库导航。
> 与 [README.md](./README.md) 互补：README 面向人类读者，本文件聚焦 Agent 在仓库内行动所需的最小事实集。

## 1. 仓库定位

**W-Model AI Assistant Skill** — 单纯的编排 + 校验脚本技能包：

- **技能资产**（`w-model-dev/`）：纯 Markdown + 自包含 TypeScript 门禁脚本，**不内置 LLM 调用、不包含编程式引擎（无 `src/`、无 SDK）**。门禁脚本依赖 `tsx` runtime + 少量 devDeps（ajv / eslint-plugin-security，详见 §2 / §3）。
- **`/wm` 命令、状态持久化、RTM 维护** 由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态写入项目内 `.w-model/*.json`。
- **编排者最小化（Orchestrator Minimization）**：Agent 读取 `w-model-dev/SKILL.md` 后承担「编排者」角色，只做路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（A 分析 / S 产出 / V 评审 / G 门禁 / R 根因定位）执行。详见 `w-model-dev/references/subagent-delegation.md`；违反命中反模式 #10，回到当前阶段起点。
- **根因定位者（R）与修复者（F）**：V/G 不通过后，编排者分派 R 子代理接收 reworkHints + 失败产物 + 上游产物，运用根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位缺陷根因，产出 RootCauseReport；R 报告经 V 复审 + G 门禁（`check-rootcause-report.ts` 退出码 0）后，分派 S 兼任 F（修复者）携带 R 报告执行返工修复。详见 `w-model-dev/references/root-cause-locator.md`；跳过 R 直接 S 返工命中反模式 #18，R 报告未 V 复审直接 S-fix 命中反模式 #19。
- **LLM-as-a-Verifier 评审** 由 V 子代理按 `w-model-dev/references/verifier-spec.md` 提示词执行（即「外部 Agent」），技能用校验脚本防输出漂移；编排者不得自评。
- **Agent Personas（评审角色提示词）** 由 V 子代理在执行 `/wm review` 时按 `w-model-dev/references/agent-personas.md` 选用对应 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema。多角度分析时，R-lead / V-lead 按 `w-model-dev/references/subagent-persona-matrix.md` 从 `w-model-dev/subagent/`（28 个人格文件，分 engineering / testing / design / product / project 5 类）选用 persona 并行/串行分派。
- **技能自演化** 不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。
- **codegraph + OpenSpec 集成**（阶段 5-8，第 25 轮）：codegraph 提供修改前符号级影响分析（callers/callees/blast radius），OpenSpec opsx 提供规格驱动变更工作流（explore/propose/apply/archive）。技能包通过 `ensure-codegraph-opsx.ts` 自动检测安装，通过 3 个 check 脚本做门禁校验。详见 SSoT §3.4.21。
- **第 26 轮深度对比吸收**（外部仓库逐文件对比产物）：单轴下限 R13（`check-verifier-output.ts` passed 收紧为 `(A||B) && 所有 subCriterion.score ≥ 0.70`，反模式 #41「加权平均掩盖单轴失败」）/ Fowler 12 坏味道基线（`subagent/engineering-code-reviewer.md`）/ 票据 durability（`phase-5-coding.md` 票据主体 = 符号级契约，位置交 codegraph）/ 术语治理（`references/glossary.md` 权威表 + `_Avoid_`）。详见 SSoT §3.4.22。
- **第 27 轮 Wayfinder「Fog of War」吸收**：阶段 1 需求分析引入迷雾登记册——REQ 入学锐利性测试（`references/ingestion-chunk.md`，判据 = 能否精确陈述需求的问题，非能否回答）/ A-cross 报告 §7 迷雾汇总（`references/ingestion-cross.md`，不代 S 决定毕业）/ 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空，`references/phase-1-requirements.md`「迷雾登记册（Fog of War）」节）/ 规格书 §8.5 Not yet specified（`templates/requirement-spec.md`）。迷雾册为文本节不建图节点、无脚本/schema 变更，治理走 FM-3D-07 + 禁止行为 #12（不新增反模式）。详见 SSoT §3.4.23。
- **第 28 轮 need_fix.md + 全量脚本 code-review 修正**：`need_fix.md` 两处 bug（estimateTokens CJK 低估 / splitMarkdownByHeaders 分段逻辑）+ 全量 ~66 项缺陷修正（分 6 组域内回归，P1×15 / P2×25 / P3×26）。关键：SD→codeModule 对齐 / security-scan 指纹跨机器归一化 / --rtm R6 纳入 passed / 豁免多 group / 签名链跨阶段连续链 / run-log R1 按阶段分档 / uat-path-mapping 严格解析 + phase 8 终检 / graph.schema.json sourceArtifact 复活 / tla-rework 改为 action=rework 统计。新增 plan-chunks.test.ts + design-contract-logic.ts + 对应单测。self-test 192→213 / vitest 205→269 / 21 test files。删除 need_fix.md。版本号 26.0.0 → 27.0.0。详见 SSoT §3.4.24。

权威设计决策以 [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) 为单一事实来源（SSoT）。

## 2. 关键目录速查

| 目录 | 用途 | Agent 行动要点 |
|---|---|---|
| `w-model-dev/` | **技能资产主体**（标准 skill 结构，可整体拷贝分发） | 安装时整体拷贝此目录；运行时按阶段加载 `references/phase-N-*.md` |
| `w-model-dev/SKILL.md` | 编排逻辑 + 命令接口 + 架构定位 | Agent 首次进入仓库必读；`/wm` 命令由其承载 |
| `w-model-dev/references/` | 阶段细则（阶段 1 含迷雾登记册 Fog of War：REQ 入学锐利性测试 + 毕业机制三选一，见 phase-1-requirements.md「迷雾登记册（Fog of War）」节）/ verifier-spec（含五轴评审 §7.4A + summary 阶段 digest 三要素 §6.2 + self-as-verifier 模式节）/ agent-personas（4 个评审角色提示词 + self-as-verifier 兼任规则节）/ subagent-delegation（O/A/S/V/G/R 编排者-子代理边界，A 为阶段 1–4 分析子代理，R 为返工根因定位子代理，F 由 S 兼任；O 维护 budget/run-log/maturity；含角色分派完整性校验节 + S 子代理 RTM 回填强制职责）/ root-cause-locator（R 子代理根因分析方法论：5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）/ subagent-persona-matrix（R-lead / V-lead 多角度 persona 选择矩阵，关联 `w-model-dev/subagent/` 28 个人格文件）/ definition-of-done（项目级 DoD 七维度含理解证据 + 信息密度度量）/ signature-chain-guide（角色链式签名 + 产出来源正确性）/ event-ingress-guide（Loop 3 事件接驳：EventIngress schema + 路由表 + 消费方指引，L2+ 激活）/ hill-climbing-guide（Loop 4 爬坡循环：HarnessImprovementReport schema + 信号检测 + 报告消费流程）/ skillopt-adoption（SkillOpt 方法论吸收：bounded edit + validation gate 流程，消费 Loop 4 信号）/ anti-patterns（41 条流程反模式 #1-#19 + #20 + #21-#41；#20 见 subagent-delegation.md，含 #10 编排者越权实施 + #11 ingestion 跳过图谱校验 + #12 A 自评收敛 + #13 信息流黑洞/奇迹/死模块放行 + #14 跳过 SANY 直接 TLC + #15 死锁/不变式违反放行 + #16 TLA+ 占位/简化/错误实现 + #17 TLA+ 建模不符需求/设计不回退 + #18 跳过 R 直接 S 返工 + #19 R 报告未 V 复审 + #21 阶段级门禁跳过 + #22 角色越权 + #23 跨模块 store 误用 + #24 副作用时序不一致 + #25 JSON 文件 PowerShell 写入 + #26 RunLogEntry 与 EventIngress 字段混用 + #27 调测者简化行为 + #28 schema 前置校验缺失 + #29 BDD 建模与需求/设计/TLA+ 不符未回退 + #30 豁免审批跳步 + #31 归档完整性缺失 + #32 签名链断裂 + #33 跳过 R3 预防性审查 + #34 编排者漏派角色 + #35 self-as-verifier 产物混合 + #36 路由顺序错误 + #37 产物膨胀核心决策稀疏 + #38 修改前未查询 codegraph + #39 跳过 opsx 产物审查 + #40 opsx/S-tickets 职责混淆 + #41 加权平均掩盖单轴失败 + L1~L4 教训 + 失败模式 F1~F10 + 运维失败模式 O1~O6）/ ingestion-chunk / ingestion-cross（A 子代理分块与合并细则）/ graph-guide（图谱门禁与收敛准则，含信息流模型 + 边数下限与语义来源占比节）/ tla-plus-guide（TLA+ 层次化状态机建模与行为门禁 + 设计文档↔代码状态机一致性节）/ bdd-guide（BDD 建模 + TLA+/BDD 自动化同步校验节）/ command-reference / operational-recovery（含成本预算与运行日志节 + 成熟度与 CHECKPOINT 放行节）/ dispatch-matrix（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本总览矩阵，编排者分派前必读）/ 数据模型（含 budget/run-log/maturity schema）/ RTM 指南 / 质量标准（含信息密度指标 + 生产目标值 vs 测试环境基线节） | **按需加载**，禁止一次性载入全部（反例 #5） |
| `w-model-dev/subagent/` | **人格库**（28 个 Markdown 人格文件，分 engineering / testing / design / product / project 5 类） | R-lead / V-lead 多角度分析时按 `references/subagent-persona-matrix.md` 选用 persona；Persona 文件本身是 Markdown，不调用 LLM。注意目录内含一个 macOS 重复下载残留 `engineering-technical-writer (1).md`（与正式版重复），分派时勿误用 |
| `w-model-dev/scripts/` | 自包含门禁脚本（依赖 `tsx` runtime + devDeps：ajv / eslint-plugin-security，需 `npm install` 一次）：`gate-logic.ts` + `check-artifact-gate.ts`（工件质量门，含 TLA+ 资产 + SD→codeModule 终检 + RTM coverageStatus 一致性 + NFR 双字段校验）/ `verifier-logic.ts` + `check-verifier-output.ts`（Verifier 校验，支持 `--self-as-verifier --s-output=<path>` 校验 V 产物与 S 产物路径不同）/ `graph-logic.ts` + `check-requirement-graph.ts`（阶段 1–4 图谱结构门禁 + 信息流校验：黑洞/奇迹/死模块/边界完整性 + 边数下限 + 语义来源占比）/ `tla-logic.ts` + `check-tla-model.ts`（阶段 1–4 TLA+ 行为门禁：SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性，**已移除 `--skip-tlc`**）/ `code-tla-logic.ts` + `check-code-tla-consistency.ts`（阶段 5 代码-TLA+ 一致性回归：四维度校验 SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式；CLI `--manifest=<path> --graph=<path> --rtm=<path> --src=<dir>`）/ `budget-logic.ts` + `check-budget.ts`（Budget 门禁：R1-R5 时效性/schema/onExceed/killSwitch/触发检测；CLI `<budget.json> [--project=] [--run-log=] [--phase=N]`）/ `run-log-logic.ts` + `check-run-log.ts`（Run-log 门禁：R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序 + R3 预防性审查记录校验；CLI `<run-log.jsonl> [--gate-logs=] [--tla-manifest=]`）/ `maturity-logic.ts` + `check-maturity.ts`（Maturity 门禁：R1-R5 schema/level/周期/history/降级；CLI `<maturity.json> [--project=] [--run-log=]`）/ `checkpoint-logic.ts` + `check-checkpoint.ts`（Checkpoint 门禁：R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致 + 拒绝代签；CLI `<run-log.jsonl> [--checkpoint-log=]`）/ `root-cause-logic.ts` + `check-rootcause-report.ts`（RootCauseReport 校验：R1-R10；CLI `<report.json>`）/ `signature-chain-logic.ts` + `check-signature-chain.ts`（角色链式签名门禁：R1-R10 + 跨阶段消费者校验；CLI `<signature-chain.jsonl>`）/ `archive-integrity-logic.ts` + `check-archive-integrity.ts`（归档完整性校验）/ `preventive-review-logic.ts` + `check-preventive-review.ts`（R3 预防性审查三份报告完整性校验；CLI `<project-dir> --phase=<1-8>`，支持 `--auto-trigger --run-log=<path>`）/ `tla-bdd-sync-logic.ts` + `check-tla-bdd-sync.ts`（TLA+/BDD 自动化同步校验：转移集 + 状态集 + 不变式等价）/ `role-dispatch-logic.ts` + `check-role-dispatch.ts`（角色分派完整性校验：每阶段 S/V/G 各 ≥1 条，`--r3-enabled` 时 R ≥3 条）/ `state-machine-logic.ts` + `check-state-machine-consistency.ts`（设计文档↔代码状态机一致性校验：状态集 + 转移集一致）/ `ensure-codegraph-opsx.ts`（codegraph + OpenSpec 依赖三层检测+自动安装，full/quick/light 三模式）/ `check-codegraph-queries.ts`（反模式 #38 校验：codegraph 查询落盘完整性）/ `check-opsx-artifacts.ts`（反模式 #39/#40 校验：opsx 制品 + R3×3 + V 审查产物齐全）/ `check-openspec-archive.ts`（opsx:archive 归档完整性校验）/ `schema-loader.ts`（ajv 单例 + schemas/ 自动加载 + validateBySchema 工具，被 `*-logic.ts` 顶部自动 import）/ `security-scan.ts`（eslint-plugin-security 扫描 + baseline 指纹豁免）/ `plan-chunks.ts`（ingestion 分块策略）/ `self-test.ts`（回归基线，213 条样本）/ `lib/read-json-or-exit.ts`（CLI 层 JSON/JSONL 读取工具，消除 check-*.ts 样板）/ `__tests__/`（vitest 单元测试 + README.md coverage 矩阵） | Agent 在阶段门 / 质量门 / 图谱门禁 / TLA+ 行为门禁 / 代码-TLA+ 一致性回归 / 签名链 / 归档完整性 / R3 预防性审查 / TLA+/BDD 同步 / 角色分派 / 状态机一致性检查点直接 `npx tsx` 执行 |
| `w-model-dev/templates/` | 文档模板（需求 / 设计 / 测试 / RTM 等） | 产出文档时套用对应模板 |
| `w-model-dev/examples/` | 交互示例（需求分析 / 设计 / 编码 / 测试执行） | 产出前参考对应示例 |
| `w-model-dev/schemas/` | JSON Schema (draft-07) 文件（19 份） | logic 层 schema 校验时自动加载；新增 .w-model/*.json 字段必先改 schema |
| `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/` | 第 19.0.1 轮 8 阶段调测归档（7 文件，含 D7 bug 修复记录） | 查阅最新调测结论时 |
| `docs/changes/archive/2026-07-26-round15-end-to-end-test/` | 第 15 轮端到端调测归档摘要（9 文件） | 查阅历史调测结论时 |
| `docs/` | 设计文档统一存放（SSoT / 集成设计 / 安装指南） | 修改设计先改 SSoT，再改 `w-model-dev/` 资产 |
| `w-model-dev-demo/` | 第 23 轮端到端调测 demo（blog-system-demo，Express 4 + TS + vitest），2026-07-30 随仓库提交，含 build-*.cjs 生成脚本 + docs/src/tests/tla/features 阶段产物 | 只读测试夹具；不参与 `/wm` 编排；有独立 package.json 依赖（cross-env 等），勿与根 devDeps 混用 |
| `eval/` | 外部工具（darwin-skill）评估产物归档 | 不属技能包，Agent 一般无需读取 |
| `.githooks/pre-push` | 本地推送前门禁（替代远程 CI） | 修改 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 后会触发 |

门禁脚本测试：
- `w-model-dev/scripts/__tests__/`：门禁脚本单元测试（vitest）
- `w-model-dev/scripts/samples/`：fixture 样本（含 gate-enhancement 场景）
- 运行：`cd w-model-dev && npx vitest run scripts/__tests__/`

## 3. 常用命令

```bash
# 首次：在仓库根目录安装 devDependencies（ajv / ajv-formats / eslint-plugin-security / tsx / typescript / vitest 等，约 30MB）
npm install

# 校验脚本（依赖 tsx runtime + ajv devDep，schema 校验由 logic 层自动调用）
npm run self-test                           # 213 条样本回归基线（19 Verifier + 19 Gate + 28 Graph + 10 Coverage + 7 Exemption + 14 TLA + 5 Budget + 13 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 12 RootCause + 16 Schema + 1 Metadata + 12 BDD + 15 SignatureChain + 4 ArchiveIntegrity + 2 PreventiveReview + 2 TlaBddSync + 3 RoleDispatch + 3 StateMachine + 4 CodegraphQuery + 3 OpsxArtifact + 3 OpenspecArchive + 5 UAT_PATH_MAPPING + 5 DESIGN_CONTRACT），退出码 0/1
npm run check:verifier -- <output.json>     # Verifier 输出校验，退出码 0/1/2
npm run check:gate -- [project-dir]         # 工件质量门，退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 阶段 1–4 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>]  # 阶段 1–4 TLA+ 行为门禁，退出码 0/1/2
npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>  # 阶段 5 代码-TLA+ 一致性回归，退出码 0/1

# 一次性启用本地推送前门禁（写入本地 .git/config，不影响仓库内容）
npm run setup:hooks

# 手动跑推送前门禁（不实际推送，11 项门禁检查）
npm run prepush

npm run lint:security              # 跑 eslint-plugin-security + baseline 比对，退出码 0/1（devDep：eslint + @typescript-eslint/* + eslint-plugin-security）
# schema 校验由 logic 层自动调用，无需独立命令（devDep：ajv + ajv-formats）
```

退出码约定：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。Agent 在 🔴 CHECKPOINT 处必须以脚本退出码为准，**不得用 LLM 估算**（反例 #3 / #6 / #7 / #12）。

## 4. 参考实现（已归档）

W 模型 8 阶段端到端调测的完整产物，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用。第十五轮调测源码原位于 `w-model-dev-demo/`，第 17 轮 P6 已删除，归档摘要位于 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/)（9 文件）。下文数字为历史记录，第十五轮源码已不可访问；如需可运行产物可参考当前仓库内重建的 `w-model-dev-demo/`（第 23 轮端到端调测 demo）。

> **最终调测数字**（第十五轮，详见归档 [`README.md`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/README.md)）：32 需求 / 22 TLA+ / 708 UT / 74 IT / 35 ST / 72 UAT / 889 测试用例全通过。

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
| 自检基线 | 111/111 通过（18 Verifier + 13 Gate + 17 Graph + 14 TLA + 5 Budget + 7 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 11 RootCause + 15 Schema + 1 Metadata） |
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

- **端到端调测结论**（2026-07-26，第十五轮，扩展博客系统 32 需求，self-as-verifier 自驱模式）：

| 指标 | 数值 |
|---|---|
| 触发 | 用户要求「移除 w-model-dev-demo 所有产物，进行完整 8 阶段调测」，按正常流程不遗漏地跑全部流程，发现其中问题 |
| 范围 | 扩展博客系统后端（w-model-dev-demo，临时重建，本轮调测后归档不入库） |
| 需求 | 32 项（22 REQ + 6 NFR + 4 CON） |
| 设计 | 22 SD + 22 INTF + 75 DD |
| TLA+ 规格 | 22 个（1 L1 + 9 L2 + 7 L3 + 5 L4），SANY+TLC 零违反 |
| 图谱 | 156 节点 576 边，信息流零违反，EXT-IN/EXT-OUT 边界完整 |
| 源码 | 60 TS 文件（13 controllers + 19 services + 12 stores + 4 middlewares + 7 utils + 5 根模块） |
| 单元测试 | 708/708 通过，代码覆盖率 98.66% lines（NFR-004 要求 ≥ 80%） |
| 集成测试 | 74/74 通过（含 4 横切：IT-perf/IT-sec/IT-rate/IT-audit） |
| 系统测试 | 35/35 通过（含 P95≤200ms / 内存≤100MB / 1000 请求错误率 0% / 限流 100req/min） |
| 验收测试 | 72/72 通过（覆盖 32 需求 × 正常+异常+边界） |
| 全量测试 | 889/889 通过（708 单元 + 74 集成 + 35 系统 + 72 验收） |
| 阶段门评审 | phase1=0.878/A、phase2=0.881/A、phase3=0.890/A、phase4=0.900/A、phase5=0.922/A、phase6=0.89/A、phase7=0.902/A、phase8=0.91/A |
| code-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 22/22 + 状态转移 142 项 + Next 分支 + 不变式断言） |
| 工件质量门 | check-artifact-gate 终检 exitCode=0，RTM 100%，missingItems=[] |
| 用户确认 | `confirm`（2026-07-26 self-as-verifier 模式调测者代签；currentPhase=9，project.json status=项目完成） |

> 第十五轮（2026-07-26）相比第十二轮（32 需求端到端调测）：按用户「按正常流程不遗漏地跑全部流程，发现其中问题」的指令重新跑端到端调测。规模对齐第十二轮（32 需求/22 SD/22 INTF/75 DD/22 TLA+）。全量测试 407→889（单元 250→708、集成 69→74、系统 25→35、验收 63→72），覆盖率 93.63%→98.66% lines。本轮调测共发现 **32 个流程问题**（31 个已修复 + 1 个遗留：阶段 3 `tla-manifest.json checkRounds 语义不一致`，影响小非阻塞），其中跨阶段共性问题 7 类：
> 1. **PowerShell ConvertTo-Json 不稳定**：BOM 编码 + 深度问题导致 graph.json 损坏，统一改用 Node.js `fs.writeFileSync` 写 JSON
> 2. **RunLogEntry 与 EventIngress schema 混淆**：阶段 1 初始化误用 `eventId`/`eventType` 字段，应为 `runId`/`action`/`role`/`outcome` 等字段
> 3. **acknowledgedDecisions 需含 ID 模式或 TECH_KEYWORDS**：check-checkpoint R2 强制要求「REQ-NNN / INTF-NNN / 接口 / 状态机 / 不变式」等关键词，"同意"/"确认" 视为空
> 4. **tla-manifest.json checkRounds schema 混淆**：阶段 3 子代理误把 phase 级摘要写入 checkRounds，应为 spec 级返工记录或空数组
> 5. **TLA+ 头注解 @child/@sibling 与 manifest 双向同步缺失**：阶段 2/3/4 多次因头注解为 null 但 manifest 非空触发 headerViolations
> 6. **budget.updatedAt 不能等于 createdAt**：隐含约束，更新时须同步推进 updatedAt
> 7. **check-run-log.ts / check-checkpoint.ts cwd 敏感性**：R6 gateLogPath 索引相对路径，须在 `w-model-dev-demo/` 目录下运行

> 第十五轮发现的设计层缺口（非阻塞，遗留待后续迭代修复，源自 stage 7 system test）：
> - **P7-001** reader 可发博文（authRequired 未校验角色）—— `tests/system/st-007-009-user.test.ts`
> - **P7-002** BloggerService.follow 校验 follower 在 blogger store（设计标注为 user+）—— `tests/system/st-026-e2e.test.ts`
> - **P7-003** CommentService.create 仅校验 user store（blogger token sub 是 bloggerId）—— `tests/system/st-027-030-memory-exception.test.ts`
> - **P7-004** PostController.get 响应体返回 recordView 自增前旧 viewCount —— `tests/system/st-026-e2e.test.ts`
>
> 这些是参考实现 demo 层的设计缺口，非技能包脚本缺陷。它们揭示了 self-as-verifier 模式下"调测者代签"无独立 V 校验设计一致性的局限——建议后续在反模式 #22（V 评审 summary 模板化）解决时一并处理。

- **第十六轮：遗留问题与设计层缺口闭环**（2026-07-26）：

| 指标 | 数值 |
|---|---|
| 触发 | 第 15 轮端到端调测归档后识别 9 项问题（1 遗留 #14 + 4 demo 层设计缺口 P7-001~P7-004 + 4 技能包侧设计缺口） |
| 修正方案 | 方案 A 全量修正：技能包侧预防 demo 缺陷（不重建 demo）+ 脚本文档双改闭环 #14 + 反模式补强 |
| 脚本改动 | 3 个（`tla-logic.ts` 新增 R13 checkRounds schema 校验 + `check-tla-model.ts` JSON 摘要新增 checkRoundsViolations + `checkpoint-logic.ts` ID_PATTERNS/TECH_KEYWORDS 注释补充） |
| 新增 fixture | 1 个（`samples/tla/bad-checkrounds-phase-summary.json`，R13 触发） |
| reference 文档 | 8 个（tla-plus-guide / data-models / phase-3-outline-design / phase-4-detailed-design / phase-5-coding / phase-7-system-test / phase-8-acceptance-test / operational-recovery） |
| 反模式新增 | 5 条（#22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用） |
| 顶层文档 | 3 个（SSoT §3.4.11 + AGENTS.md §4 + CHANGELOG.md [16.0.0]） |
| self-test | 基线 94→95（+1 R13 样本）全通过 |
| vitest | 76/76 或 77+/77+ 全通过 |
| TypeScript strict | 0 错误 |

> 第十六轮（2026-07-26）相比第十五轮（端到端调测）：从「demo 层调测发现 32 问题」进化为「技能包侧预防条款补强」，不重建 demo 仅在 reference 补强约束。`tla-logic.ts` 从「类型定义不校验」进化为「R13 schema 校验强制拦截 phase 级摘要」。`data-models.md` 从「RunLogEntry/EventIngress 分散定义」进化为「显式 Schema 边界对照表禁止混用」。`anti-patterns.md` 从「21 条」扩展为「26 条」，覆盖角色越权 / 跨模块 store 误用 / 副作用时序 / PowerShell 写入 / 字段混用 5 类高发陷阱。第 15 轮遗留 #14（checkRounds 语义不一致）+ 共性问题 A（PowerShell 写入）/ B（字段混用）/ C（acknowledgedDecisions 关键词）/ D（checkRounds phase 级摘要）全部闭环。

- **第十七轮：D5 文档不一致修正与简化行为预防**（2026-07-27）：

| 指标 | 数值 |
|---|---|
| 触发 | 第 16 轮 D5 文档一致性检查发现 4 项互引不一致 + 1 项简化行为预防缺失 + 2 项状态问题（demo 未清理 + 第 16 轮变更未提交） |
| 修正方案 | Part A 修 4 项 D5 不一致 / Part B 新增反模式 #27 + 简化预防节 / Part C 清理 w-model-dev-demo + 提交 16+17 轮 / Part D 全量回归验证 |
| reference 文档 | 3 个（data-models.md violations 类型 / anti-patterns.md #25 工具补全 + #26 字段名修正 + #27 新增 / operational-recovery.md 简化预防节） |
| SKILL.md | 2 处（acknowledgedDecisions 标注修正 + 简化行为自检条） |
| 反模式新增 | 1 条（#27 调测者简化行为，含 3 类倾向 S1/S2/S3 + 5 项自检清单） |
| 顶层文档 | 4 个（SSoT §3.4.12 + AGENTS.md §4 + CHANGELOG.md [17.0.0] + README.md 反模式总数 26→27） |
| 删除产物 | w-model-dev-demo/（归档已迁移至 docs/changes/archive/2026-07-26-round15-end-to-end-test/） |
| git commit | acc80ce（第 16+17 轮合并提交，因变更文件级交错无法拆分） |
| self-test | 95/95 全通过（无变化） |
| vitest | 76/76 全通过（无变化） |
| TypeScript strict | 0 错误 |
| D5 文档一致性复检 | 6 项互引全一致 |

> 第十七轮（2026-07-27）相比第十六轮：从「设计层缺口闭环」进化为「D5 文档互引一致性闭环 + 简化行为预防」。`data-models.md` violations 类型从 `number` 修正为 `string[]` 与 `tla-plus-guide.md` + `tla-logic.ts` 三处一致。`anti-patterns.md` #25 工具清单补全 4 种 PowerShell 工具 + #26 字段名修正 `decisions` → `acknowledgedDecisions`。`anti-patterns.md` 从「26 条」扩展为「27 条」，新增 #27 调测者简化行为反模式（self-as-verifier 模式下无外部评审拦截简化行为，须靠自检条款预防）。`operational-recovery.md` 新增「调测者简化行为预防」节（3 类简化倾向 + 5 项自检清单）。第 15 轮调测产物 `w-model-dev-demo/` 清理（归档已迁移至仓库级 `docs/changes/archive/`）。第 16 轮 D5 互引不一致（violations 类型 / #25 工具 / #26 字段名 / acknowledgedDecisions 标注）+ 简化行为预防缺失（#27）+ 状态问题（demo 清理 / 变更提交）全部闭环。

- **第十八轮：drawio-skill 设计吸收**（2026-07-27）：

| 指标 | 数值 |
|---|---|
| 触发 | 用户要求分析 `drawio-skill` 仓库并吸收 7 项设计实践 |
| 修正方案 | 纯文档同步，不涉及 .ts 代码变更（schema 校验由 logic 层自动调用、security-scan 由 pre-push 承载） |
| 新增 | Bundled Resources 触发条件总表（SKILL.md）+ JSON Schema 强约束（13 份 draft-07 schemas + schema-loader.ts）+ 安全扫描基线（eslint-plugin-security + .eslintsecurity-baseline.json sha256 指纹豁免）+ 版本号双写（SKILL.md frontmatter `version` + skill-metadata.json 镜像 + __tests__/skill-metadata.test.ts 回归）+ pure/IO 函数分离审计 + 测试 coverage 矩阵（__tests__/README.md）+ toolbox 决策表（references/toolbox.md「I have X → use Z」） |
| 反模式新增 | 1 条（#28 schema 前置校验缺失：`*-logic.ts` 校验函数未先调用 `validateBySchema`） |
| reference 文档 | 1 个新增（toolbox.md）+ 1 个新增（__tests__/README.md coverage 矩阵） |
| 顶层文档 | 4 个（SSoT §3.4.13 + §10A 追溯表补行 + AGENTS.md §4 + CHANGELOG.md [18.0.0] + README.md 反模式总数 27→28） |
| package.json | version `17.0.0` → `18.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 95→111（+16 新测试：15 Schema + 1 Metadata）全通过 |
| vitest | 76→90（+3 文件：schema-validation / security-scan / skill-metadata；+14 tests）全通过 |
| TypeScript strict | 0 错误 |
| pre-push | 6 项门禁（self-test + check:verifier 边界 4 项：无参数 exit 2 / 不存在目录 exit 2 / 有效样本 exit 0 / 无效样本 exit 1 + security-scan exit 0；详见 [`.githooks/pre-push`](./.githooks/pre-push)） |

> 第十八轮（2026-07-27）相比第十七轮：从「D5 文档互引一致性闭环」进化为「外部技能设计实践吸收」。吸收 drawio-skill (https://github.com/Agents365-ai/drawio-skill) 7 项设计实践，强化 JSON Schema 强约束 + 安全扫描基线 + 版本号双写 + pure/IO 分离 + 测试 coverage 矩阵 + toolbox 决策表 + Bundled Resources 触发条件总表。`anti-patterns.md` 从「27 条」扩展为「28 条」（合计 28 条，#20 在 subagent-delegation.md），新增 #28 schema 前置校验缺失。`SKILL.md` frontmatter 新增 `version: 18.0.0` 字段 + 新增「Bundled Resources」章节明示按需加载契约。引入 ajv (draft-07) + 13 份 schemas/*.schema.json 在 logic 层前置校验，eslint-plugin-security + .eslintsecurity-baseline.json sha256 指纹豁免。版本号三处一致（package.json + SKILL.md frontmatter + skill-metadata.json）。详见 SSoT §3.4.13 与 §10A 追溯表新增 §3.4.13 行。

#### 第十九轮（2026-07-27）：BDD 建模与验收夹具（SSoT §3.4.14）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求增强设计：加入 BDD 建模和基于 BDD 的测试、验收夹具 |
| 修正方案 | 引入 Cucumber.js v11 + @cucumber/messages，与既有 TLA+ 行为规格正交协作 |
| 新增 | BDD 建模与验收夹具（L1/L2/L3/L4 features + 状态机七要素）+ `check-bdd-model.ts` 7 维度校验（D1 头标注 / D2 Gherkin 语法 / D3 状态机 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射）+ `bdd-manifest.schema.json` + `bdd-logic.ts` + 10 个 BDD samples + 4 份 BDD reference（bdd-guide.md / bdd-review-checklist.md / bdd-syntax-reference.md / bdd-patterns-examples.md）+ 2 个模板（feature.template + bdd-manifest.template.json） |
| 反模式新增 | 1 条（#29 BDD 建模与需求/设计/TLA+ 不符未回退） |
| reference 文档 | 4 个新增（bdd-guide.md / bdd-review-checklist.md / bdd-syntax-reference.md / bdd-patterns-examples.md） |
| 顶层文档 | 4 个（SSoT §3.4.14 + AGENTS.md §4 + CHANGELOG.md [19.0.0] + README.md 反模式总数 28→29） |
| package.json | version `18.0.0` → `19.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 111→121（+10 BDD）全通过 |
| vitest | 90→100+（+1 文件：bdd-logic.test.ts）全通过 |
| TypeScript strict | 0 错误 |
| pre-push | 7 项门禁（新增 check-bdd-model.ts） |

> 第十九轮（2026-07-27）相比第十八轮：从「外部技能设计实践吸收」进化为「BDD 行为建模与验收夹具」。引入 Cucumber.js + Gherkin BDD 建模，与既有 TLA+ 行为规格正交协作，覆盖 W 模型 8 阶段的测试设计/执行/TDD 夹具需求。BDD features 作为可执行规格，TLA+ 作为行为正确性基准，二者通过等价性校验互锁（状态集等价 + 初始状态一致 + 转移集等价 + 不变式归一化匹配）。`anti-patterns.md` 从「28 条」扩展为「29 条」（合计 29 条，#20 在 subagent-delegation.md），新增 #29 BDD 建模与需求/设计/TLA+ 不符未回退。`SKILL.md` frontmatter `version: 18.0.0` → `19.0.0` + 新增约束 #14（BDD 行为门禁）+ S 拆分机制补 S-bdd 子代理变体（与 S-tla 对称）。新增 `check-bdd-model.ts` 7 维度独立门禁脚本 + `bdd-logic.ts` 纯逻辑 + `bdd-manifest.schema.json` 强约束 + 10 个 BDD samples（5 valid + 5 bad）。版本号三处一致（package.json + SKILL.md frontmatter + skill-metadata.json）。详见 SSoT §3.4.14 与 §10A 追溯表新增 §3.4.14 行。

#### 第 19.0.1 轮（2026-07-27）：W 模型 8 阶段端到端调测验证与归档（SSoT §3.4.15）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求移除 w-model-dev-demo 所有产物，进行完整 8 阶段调测 |
| 范围 | 博客系统后端 demo（32 需求 = 22 REQ + 6 NFR + 4 CON），调测后归档不入库 |
| 真实 bug | `check-bdd-model.ts` D7 RTM 映射校验误用 `rtm.requirements`（不存在字段），修正为 `rtm.rows` + `requirementId`（与 `gate-logic.ts` `RTMMatrixShape` 对齐）—— 单元测试无法发现，仅端到端调测暴露 |
| 调测过程修正 | 4 项：checkpoint 决策缺技术名词 / maturity R3 误报 completedCycles=0 / verifier compositeScore 0.9235 漂移 / run-log action="execute" 枚举违反 |
| 归档 | 7 文件迁移至 `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/` |
| 产物清理 | `w-model-dev-demo/` + `update-rtm.cjs` + `执行情况/` 删除；`package.json` demo 专用依赖还原 |
| 测试补强 | `bdd-logic.test.ts` 新增 3 个 D7 RTM schema 测试（正确 schema 通过 + feature id 未登记失败 + reqId 不存在失败），防止 schema 回退 |
| 版本号 | 三处同步为 `19.0.1`（package.json + skill-metadata.json + SKILL.md frontmatter） |
| self-test | 基线 121 不变（BDD 用例 10 不变）全通过 |
| vitest | 105→108（bdd-logic.test.ts +3 D7 测试）全通过 |
| TypeScript strict | 0 错误 |
| 调测统计 | UT 150/150 + IT 24/24 + ST 32/32 + UAT 25/25 = 231 全通过；V 评审 7A+1B；TLA+ L4 TLC 零违反；BDD 4 features 34 scenarios；code-TLA+ 4 维度 78 项；check-artifact-gate exitCode=0；maturity.completedCycles=1 |

> 第 19.0.1 轮（2026-07-27）相比第十九轮（BDD 建模）：从「BDD 建模引入」进化为「BDD 建模端到端验证 + 真实 bug 发现」。本次调测的核心价值在于 `check-bdd-model.ts` D7 bug 的暴露——这个 bug 在单元测试中无法发现（sample 数据结构恰好与错误字段名匹配），只有在真实 8 阶段端到端调测中用真实 RTM（`rtm.rows` + `requirementId`）喂给脚本时才会暴露。这印证了 W 模型 8 阶段端到端调测对技能包本身的验证价值。归档产物迁移至 `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`（7 文件），demo 产物清理。版本号三处同步 19.0.1。详见 SSoT §3.4.15 与 §10A 追溯表新增 §3.4.15 行。

#### 第二十轮（2026-07-28）：阶段 1 需求提取四维识别与豁免审批（SSoT §3.4.16）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求增强阶段 1 需求分析：四维识别模型 + 豁免审批治理 |
| 修正方案 | 阶段 1 需求分析从「扁平 REQ 列表 + 简单层次」升级为「四维识别模型 + 豁免审批治理」 |
| 新增 | 四维识别模型（层级关系 level/priority/reqGroup + R1-R4 / 子系统划分 REQ-group / 交叉逻辑 precedes+conflicts-with+cross-cuts + R5/R6 / 覆盖分析 4 张矩阵 + 100% 覆盖率 + C1-C10）+ 豁免审批治理（S→R→V→人类四阶段 + `check-exemption.ts` E1-E8）+ `coverage.schema.json` / `exemption.schema.json` + `coverage-logic.ts` / `check-requirement-coverage.ts` + `exemption-logic.ts` / `check-exemption.ts` + 13 graph + 10 coverage + 7 exemption samples + `graph-logic.test.ts`（R1-R6）+ `coverage-logic.test.ts`（C1-C10）+ `exemption-logic.test.ts`（E1-E8）|
| 反模式新增 | 1 条（#30 豁免审批跳步：任何豁免未按 S→R→V→人类四阶段流程执行） |
| 禁止行为新增 | 5 条（#7 REQ 不标注 level / #8 LLM 自行决定 REQ-group / #9 省略 §4-§7 / #10 覆盖缺失隐式遗漏 / #11 跳过豁免审批流程） |
| reference 文档 | `phase-1-requirements.md`（算法步骤增强）+ `ingestion-chunk.md`（节点/边提取增强）+ `ingestion-cross.md`（合并算法新增步骤 6-8）+ `verifier-spec.md`（completeness 增强）+ `anti-patterns.md`（#30）+ `subagent-delegation.md`（S/R/V 豁免审批职责） |
| 顶层文档 | 6 个（SSoT §3.4.16 + §10A 追溯表 + AGENTS.md §4 + CHANGELOG.md [20.0.0] + README.md 反模式总数 29→30 + CONTRIBUTING.md self-test 基线 121→152 + INSTALL.md self-test 基线 121→152） |
| package.json | version `19.0.1` → `20.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 121→152（+13 Graph + 10 Coverage + 7 Exemption + 1 Schema）全通过 |
| vitest | 108→~165（+graph-logic R1-R6 + coverage-logic C1-C10 + exemption-logic E1-E8 + gate-enhancement 集成）全通过 |
| pre-push | 8→10 项门禁（新增 check:coverage + check:exemption） |
| 图谱 schema | 不向后兼容老图谱（历史抛弃，重新生成）；节点新增 level/priority/reqGroup；边新增 precedes/conflicts-with/cross-cuts |

> 第二十轮（2026-07-28）相比第 19.0.1 轮：从「BDD 端到端调测验证」进化为「阶段 1 需求提取四维识别 + 豁免审批治理」。阶段 1 需求分析从「扁平 REQ 列表」升级为「四维识别模型」：层级关系（level 1-4 + R1-R4 层级单根/父唯一/level 单调/REQ-group 非空）+ 子系统划分（level=1 REQ 即 REQ-group 候选）+ 交叉逻辑（precedes/conflicts-with/cross-cuts + R5 依赖时序无环 + R6 交叉边对称性与源类型）+ 覆盖分析（stakeholder/scenario/requirementType/crossCuts 4 张矩阵 + 100% 覆盖率 + C1-C10）。豁免审批强制 S→R→V→人类四阶段流程（check-exemption.ts E1-E8），禁止跳步（反模式 #30）。图谱 schema 不向后兼容（历史抛弃，重新生成），REQ 节点须标注 level（1-4）强制必填。规格书模板 5 节→13 节（§4-§7 四维识别）。`anti-patterns.md` 从「29 条」扩展为「30 条」，新增 #30 豁免审批跳步。新增禁止行为 #7-#11。版本号三处一致（package.json + SKILL.md frontmatter + skill-metadata.json）20.0.0。详见 SSoT §3.4.16 与 §10A 追溯表新增 §3.4.16 行。

#### 第二十一轮（2026-07-29）：流程完整性硬化（链式签名 + 产出来源正确性 + 归档完整性）（SSoT §3.4.17，[21.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 第 20 轮调测发现的 5 类流程完整性违规（C1 代签 / C2 skip-tlc / I1 level=4 强制 / I2 归档缺失 / I3 evidence 空泛） |
| 修正方案 | 引入角色链式签名 + 产出来源正确性 + 消费者校验机制，从结构上根治跳环问题 |
| 新增 | 角色链式签名机制（`signature-chain.jsonl` + SignatureChainEntry schema 含 inputProvenance 来源证明）+ 签名链门禁脚本 `check-signature-chain.ts`（R1-R10 校验 + 跨阶段消费者校验）+ 归档完整性校验脚本 `check-archive-integrity.ts` + `archive-integrity-logic.ts` + 参考指南 `signature-chain-guide.md` + schema `signature-chain.schema.json` |
| 反模式新增 | 2 条（#31 归档完整性缺失 / #32 签名链断裂） |
| DoD 扩展 | 新增第七维度（签名链完整性） |
| SSoT 同步 | §3.4.1（产出来源正确性）/ §7.9（SignatureChainEntry schema）/ §10.11（签名链门禁）/ §10B.2.1（归档完整性清单） |
| 顶层文档 | 3 个（SSoT + AGENTS.md §4 + CHANGELOG.md [21.0.0]） |
| 样本 | 12 签名链 + 4 归档完整性 |
| 单测 | signature-chain-logic.test.ts（R1-R10）+ archive-integrity-logic.test.ts |
| schema 改动 | §7.7 graph.json schema：REQ level 从"4 层强制"改为自适应层级深度（minimum=1，无上限）；§7.6 V 评审规范：evidence 字段强制引用具体产物字段；`graph.schema.json`：level 字段移除 `maximum: 4` |
| Removed | `check-tla-model.ts` 的 `--skip-tlc` 参数（硬约束：所有 specs 强制 TLC）+ `tla-logic.ts` 的 `skipTlc` 选项 + `tla-plus-guide.md` 的 skip-tlc 相关条款 |
| package.json | version `20.0.0` → `21.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 152→168（+12 SignatureChain + 4 ArchiveIntegrity）全通过 |
| vitest | +signature-chain-logic + archive-integrity-logic 测试 18 项全通过 |
| TypeScript strict | 0 错误 |

> 第二十一轮（2026-07-29）相比第二十轮：从「阶段 1 需求提取四维识别」进化为「流程完整性硬化」。引入角色链式签名机制（SignatureChainEntry + inputProvenance 来源证明）+ 归档完整性校验，从结构上根治代签（C1）/ skip-tlc（C2）/ level=4 强制（I1）/ 归档缺失（I2）/ evidence 空泛（I3）5 类跳环问题。全面禁止代签（含 dogfooding，历史轮次标注 'known violation'）。`check-tla-model.ts` 移除 `--skip-tlc` 参数（所有 specs 强制 TLC）。`anti-patterns.md` 从「30 条」扩展为「32 条」，新增 #31 归档完整性缺失 + #32 签名链断裂。DoD 从 6 维度扩展为 7 维度（+签名链完整性）。REQ level 从"4 层强制"改为自适应层级深度。版本号三处一致 21.0.0。详见 SSoT §3.4.17 与 §10A 追溯表新增 §3.4.17 行。

#### 第二十二轮（2026-07-29）：P0-P3 技能包修正（R3 强制 + TLA+/BDD 同步 + 设计契约 + uat-path-mapping + codeModule 格式）（SSoT §3.4.19，[22.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 第 21 轮调测发现的 35 项技能包问题（SSoT 14 任务 + schemas 1 任务 + scripts 7 任务 + samples 8 任务 + testing 4 任务） |
| 修正方案 | 29 次提交，分 SSoT / schemas / scripts / samples / testing 5 层执行 |
| 新增约束 | #17（R3 预防性审查强制）：所有阶段 S 产出后须触发三阶段 R 预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 三份报告 |
| 反模式新增 | 1 条（#33 跳过 R3 预防性审查） |
| 新增 schema | `preventive-review.schema.json`（R3 预防性审查报告 schema） |
| 新增脚本 | `check-preventive-review.ts`（校验 R3 三份报告完整性，`<project-dir> --phase=<1-8>`，退出码 0/1/2）+ `check-tla-bdd-sync.ts`（TLA+/BDD 自动化同步校验，校验转移集 + 状态集 + 不变式等价） |
| 新增样本 | 8 项 P0-P3 修正样本（preventive-review + tla-bdd-sync + codeModule 格式 + uat-path-mapping 等） |
| 新增单测 | preventive-review-logic.test.ts + tla-bdd-sync-logic.test.ts + gate-enhancement codeModule 格式覆盖 |
| run-log-logic.ts | 新增 R3 预防性审查记录校验 |
| gate-logic.ts | 新增 codeModule 格式校验（`SD-xxx:src/path.ts` 格式）+ uat-path-mapping 回填校验 |
| check-artifact-gate.ts | 新增 phase=1/5 uat-path-mapping 校验 |
| check-bdd-model.ts | 多路径查找支持根目录/子目录回退 |
| self-test | 基线 168→175（+preventive-review + tla-bdd-sync + codeModule 格式 + uat-path-mapping 样本）全通过 |
| vitest | 基线 ~165→~201（+preventive-review-logic + tla-bdd-sync-logic + gate-enhancement 扩展）全通过 |
| package.json | version `21.0.0` → `22.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| TypeScript strict | 0 错误 |

> 第二十二轮（2026-07-29）相比第二十一轮：从「流程完整性硬化」进化为「R3 预防性审查强制 + TLA+/BDD 同步」。修复第 21 轮调测发现的 35 项技能包问题，新增约束 #17（R3 预防性审查强制）+ 反模式 #33（跳过 R3 预防性审查）+ 2 个新校验脚本（check-preventive-review.ts / check-tla-bdd-sync.ts）+ preventive-review.schema.json。`anti-patterns.md` 从「32 条」扩展为「33 条」。版本号三处一致 22.0.0。详见 SSoT §3.4.19 与 §10A 追溯表新增 §3.4.19 行。

#### 第二十四轮（2026-07-30）：P0-P3 技能包十项修正（RTM 回填 + 角色分派 + R3 实执行 + 状态机一致性 + self-as-verifier + NFR 双字段 + 路由顺序 + 图谱边数 + 门禁 stdout + 信息密度）（SSoT §3.4.20，[23.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 第 23 轮 8 阶段端到端调测发现的 10 项技能包问题（P0×2 + P1×3 + P2×3 + P3×2） |
| 修正方案 | 按 P0→P1→P2→P3 分 4 批 19 个任务执行（Subagent-Driven Development 模式） |
| 新增约束 | #18（RTM 实体每阶段必须回填）：S 子代理产出后须更新 `.w-model/rtm.json`；coverageStatus 字段与 coveragePercent 须一致 / #19（编排者角色分派完整性）：每阶段须至少分派 S/V/G 三角色各 1 次；R3 启用时须分派 R 角色 ≥3 次；self-as-verifier 模式下兼任时须产出各角色独立产物文件 |
| 反模式新增 | 4 条（#34 编排者漏派角色 / #35 self-as-verifier 模式下 V/G/R 产物混合 / #36 路由顺序错误 / #37 产物膨胀但核心决策稀疏） |
| 新增脚本 | `check-role-dispatch.ts`（角色分派完整性校验，校验 run-log 每阶段含 S/V/G 各 ≥1 条；`--r3-enabled` 时 R ≥3 条）+ `check-state-machine-consistency.ts`（设计文档↔代码状态机一致性校验，校验状态集 + 转移集一致） |
| 新增 schema 字段 | `rtm.schema.json` NFR 行增加 `targetValue` + `testThreshold` 双字段；`run-log.schema.json` role 字段增加 description（约束 #19 说明） |
| 新增样本 | gate/bad-rtm-coverage-below-100.json + bad-rtm-status-mismatch.json + run-log/bad-missing-V-role.jsonl + bad-missing-G-role.jsonl + bad-missing-R-role.jsonl + state-machine/bad-missing-transition.json + bad-extra-transition.json + valid-consistent.json |
| SKILL.md 约束扩展 | #10（门禁 stdout 末尾 5 行贴出）+ #12（4 脚本→5 脚本，增加 check-preventive-review.ts） |
| check-preventive-review.ts | 新增 `--auto-trigger --run-log=<path>` 模式，从 run-log 读取当前阶段自动校验 |
| check-verifier-output.ts | 新增 `--self-as-verifier --s-output=<path>` 参数，校验 VerifierOutput JSON 路径与 S 产出路径不同（反模式 #35） |
| gate-logic.ts | 新增 RTM coverageStatus 字段一致性硬校验 + NFR 双字段缺失校验（双字段都缺失才 fail） |
| graph-logic.ts | 新增边数下限校验（边 < 节点×3 → 警告）+ 语义来源占比校验（< 80% → 警告），保留 small-project exemption |
| anti-patterns.md | 反模式 #27 S2 扩展：新增「门禁脚本未实跑」作为独立可命中信号 |
| 新增参考指南节 | SKILL.md「self-as-verifier 模式」节；verifier-spec.md / agent-personas.md / tla-plus-guide.md / graph-guide.md / quality-standards.md / definition-of-done.md / phase-8-acceptance-test.md / templates/interface-design.md / phase-3-outline-design.md / templates/requirement-spec.md / templates/system-test.md 多处新增节 |
| 新增模板节 | subagent-delegation.md「角色分派完整性校验」节 + S 子代理 RTM 回填强制职责 |
| self-test | 基线 175→184（+2 GATE coverageStatus + 3 RoleDispatch + 3 StateMachine + 1 既有调整）全通过 |
| package.json | version `22.0.0` → `23.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| TypeScript strict | 0 错误 |
| 约束编号 | #18/#19 + 反模式 #34-#37 编号连续无冲突 |

> 第二十四轮（2026-07-30）相比第二十二轮：从「R3 强制 + TLA+/BDD 同步」进化为「RTM 回填 + 角色分派 + R3 实执行 + 状态机一致性 + self-as-verifier + NFR 双字段 + 路由顺序 + 图谱边数 + 门禁 stdout + 信息密度」十项修正。修复第 23 轮 8 阶段端到端调测发现的 10 项技能包问题（P0×2 + P1×3 + P2×3 + P3×2），按 P0→P1→P2→P3 分 4 批 19 个任务执行，采用 Subagent-Driven Development 模式（2 个 implementation 子代理 + orchestrator spec compliance review）。新增约束 #18（RTM 回填）+ #19（角色分派完整性）+ 反模式 #34-#37 + 2 个新校验脚本（check-role-dispatch.ts / check-state-machine-consistency.ts）。`anti-patterns.md` 从「33 条」扩展为「37 条」。首次正式定义 self-as-verifier 模式（单 Agent 兼任 S/V/G/R 多角色的执行模式，仅限 demo/非生产/教学场景，须产出各角色独立产物文件）。版本号三处一致 23.0.0。详见 SSoT §3.4.20 与 §10A 追溯表新增 §3.4.20 行。

#### 第二十五轮（2026-07-30）：codegraph + OpenSpec 集成（修改前影响分析 + 规格驱动变更管理）（SSoT §3.4.21，[24.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求阶段 5 起引入 codegraph（修改前符号级影响分析）与 OpenSpec opsx（规格驱动变更工作流） |
| 外部工具边界 | SSoT §3.3 登记 codegraph（宿主 Agent MCP 工具 `codegraph_explore`，修改前预防）+ OpenSpec（宿主 Agent CLI `/opsx:*`，规格级规划层）；技能包**不内置调用**，通过 CHECKPOINT/子代理指令触发 |
| 新增约束 | #20（codegraph 修改前强制查询）：阶段 5-8 任何代码/测试文件 `Edit`/`Write` 前，S-coding 须先 `codegraph_explore` 查询目标符号影响半径（callers/callees/blast radius），结果落盘 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json` |
| 反模式新增 | 3 条（#38 修改前未查询 codegraph / #39 跳过 opsx 产物审查 / #40 opsx/S-tickets 职责混淆） |
| S 分派变体 | 阶段 5-8 三段式 S 分派：S-explore（opsx:explore + codegraph 影响初判）→ S-propose（opsx:propose + S-tickets 拆解）→ S-coding（按 tickets frontier 逐片编码，每片 codegraph_explore）；每段产物 R3×3 + V 评审 |
| 新增脚本 | `ensure-codegraph-opsx.ts`（三层依赖检测 L1 CLI / L2 MCP 注册 / L3 项目目录 + 自动安装，full/quick/light 三模式）+ `check-codegraph-queries.ts`（#38 校验）+ `check-opsx-artifacts.ts`（#39/#40 校验）+ `check-openspec-archive.ts`（opsx:archive 归档完整性校验） |
| 门禁扩展 | `gate-logic.ts` ArtifactGateResult +3 可选布尔字段（codegraphQueriesValid / opsxArtifactsValid / openspecArchived）+ externalChecks 参数（phase ≥ 5）；`run-log.schema.json` action 枚举 +6 值（codegraph_query / opsx_explore / opsx_propose / opsx_apply / opsx_archive / ensure_deps） |
| 顶层文档 | 5 个（SSoT §3.4.21 + §3.3 + README.md 反模式 37→40 + AGENTS.md + CHANGELOG.md [24.0.0] + INSTALL.md） |
| self-test | 基线 184→191（+3 CodegraphQuery + 2 OpsxArtifact + 2 OpenspecArchive）全通过 |
| vitest | 201/201 全通过 |
| package.json | version `23.0.0` → `24.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| TypeScript strict | 0 错误 |

> 第二十五轮（2026-07-30）相比第二十四轮：从「流程校验增强」进化为「外部工具集成」。codegraph 提供修改前符号级影响分析（与 code-TLA+ 修改后回归互补：前者预防、后者回归），OpenSpec opsx 提供规格驱动变更工作流（explore/propose/apply/archive）。skill 通过 `ensure-codegraph-opsx.ts` 自动检测安装（仅自动失败时 CHECKPOINT），通过 3 个 check 脚本 + gate-logic 三布尔做门禁校验。版本号三处一致 24.0.0。详见 SSoT §3.4.21 与 §10A 追溯表新增 §3.4.21 行。

#### 第二十七轮（2026-07-30）：Wayfinder「Fog of War」吸收（阶段 1 迷雾登记册）（SSoT §3.4.23，[26.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求分析外部仓库 wayfinder 技能（Matt Pocock "Skills For Real Engineers"，`skills/skills/engineering/wayfinder/`）「Fog of war」理念，评估其对阶段 1（需求分析）的可借鉴性 |
| 修正方案 | 纯文档吸收，无脚本/schema 变更（迷雾册为文本节不建图节点；毕业核验由既有 R/V 承载；不新增 check 脚本） |
| 新增 | REQ 入学锐利性测试（`references/ingestion-chunk.md`，判据 = 能否精确陈述需求的问题，非能否回答）/ A-cross 报告 §7 迷雾汇总 + 算法步骤 9（`references/ingestion-cross.md`，不代 S 决定毕业）/ 迷雾登记册治理节（`references/phase-1-requirements.md`「迷雾登记册（Fog of War）」节：定义与 §8 Out of Scope 区分 + 毕业机制三选一 + CHECKPOINT 前强制清空 + 覆盖矩阵语义，迷雾项不计入分母）/ 规格书 §8.5 Not yet specified（`templates/requirement-spec.md` 登记表 + 毕业处置结果列） |
| 治理 | FM-3D-07 迷雾滥用（借雾逃避覆盖 / CHECKPOINT 前未终结）+ 禁止行为 #12 迷雾项静默遗留 + 返工路径补充 |
| 反模式决策 | **不新增反模式**（anti-patterns.md 保持 41 条；迷雾滥用是阶段内局部违规，走 FM + 禁止行为，与跨阶段流程性反模式分层一致） |
| 顶层文档 | SSoT §3.4.23 + §10A 追溯表 + CHANGELOG [26.0.0] + AGENTS.md §1 bullet + README.md 能力 bullet |
| package.json | version `25.0.0` → `26.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 192/192 不变（纯文档，无样本变化）全通过 |
| vitest | 205/205 不变全通过 |
| TypeScript strict | 0 错误 |

> 第二十七轮（2026-07-30）相比第二十五轮：从「外部工具集成」进化为「外部技能理念吸收」。解决强制 100% 覆盖（C1-C10）下「in-scope 尚无法精确陈述」需求无落脚点的问题——A 子代理或捏造浅层 REQ（违背禁止行为 #2）或静默丢弃（违反禁止行为 #10）。吸收 wayfinder「Fog or ticket?」锐利性测试 + Not-yet-specified + 毕业机制，为「能进范围但说不清」的需求提供显式治理路径。迷雾册为文本节不建图节点、无脚本/schema 变更、不新增反模式。版本号三处一致 26.0.0。详见 SSoT §3.4.23 与 §10A 追溯表新增 §3.4.23 行。

> 第四轮（2026-07-23）相比第三轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，验证信息流校验特性合入后技能编排端到端可用。重跑产物为独立再实现，单元测试 71→53、覆盖率由 100% 全维度回落至 96.37%/93.57%/92.30%（仍 ≥ 80% 阈值），集成/系统/验收测试计数不变，所有门禁退出码仍为 0，图谱零违反收敛 1 轮达成。本轮未引入新缺陷。

- **过程中发现并修正的缺陷**：
  1. **Express 4 async handler 不自动捕获 rejected promise**（2026-07-20 首轮）：新建 `src/utils/async-handler.ts` 包装器，包裹全部路由后重跑 6/6 通过。详见归档 [`test-report-snapshot.json`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/test-report-snapshot.json)。
  2. **JWT_SECRET 缺失导致测试套件加载失败**（2026-07-21 回归发现）：`src/utils/env.ts` 在 import 阶段即抛错，连锁导致 4 个测试套件挂掉。修正方案：`package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入。
  3. **ArticleService 类型导出消失**（2026-07-21 回归发现）：`src/services/article-service.ts` 改为内部 `class ArticleService` + `export const articleService` 实例，导致 `comment-service.ts` 的 `import type { ArticleService }` 类型丢失。修正方案：恢复 `export class ArticleService`。
  4. **vitest mock 与 express NextFunction 类型不兼容**（2026-07-21 回归发现）：`vi.fn() as unknown as NextFunction` 丢失 mock 类型，`next.mock.calls[0][0]` 报 TS2339。修正方案：用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问。
  5. **check-artifact-gate.ts 缺 exitCode 字段**（2026-07-24 第五轮发现）：`check-artifact-gate.ts` 是唯一未在 `GATE_JSON` 输出中包含 `exitCode` 字段的门禁脚本，导致 `check-run-log.ts` R6 交叉校验无法提取退出码。修正方案：与其它 7 个 `check-*.ts` 脚本对齐，计算 `const exitCode = result.passed ? 0 : 1`，写入 `GATE_JSON` 并 `process.exit(exitCode)`；同时在 `check-run-log.ts` 的 `extractExitCode` 模式数组中增加 `GATE_JSON` 标记识别。

  详见归档 [`test-report-snapshot.json`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/test-report-snapshot.json) 与 [`verifier-summary.md`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/verifier-summary.md)。

- **调测模式**：self-as-verifier（Agent 按本技能编排自驱完成 8 阶段，每阶段跑质量门，不暂停 CHECKPOINT）。

> Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时，可指向归档目录 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/) 作为具象参考（第 15 轮源码已清理，归档不可执行）。如需可运行产物，可参考当前仓库内 `w-model-dev-demo/`（第 23 轮端到端调测 demo，随仓库提交）。归档不参与 `/wm` 命令编排，也不会被 `check-*-gate.ts` 读取。

## 5. 必读文档

按以下顺序建立上下文：

1. [README.md](./README.md) — 项目导航（人类可读）
2. [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) — 单一事实来源
3. [w-model-dev/SKILL.md](./w-model-dev/SKILL.md) — 编排逻辑与命令执行规则
4. [docs/INSTALL.md](./docs/INSTALL.md) — AI Agent 安装指南
5. [docs/adoption-guide.md](./docs/adoption-guide.md) — 采用路径（Greenfield vs Brownfield，人类可读；SSoT §11A 为权威定义）
6. [CONTRIBUTING.md](./CONTRIBUTING.md) — 贡献与文档维护规则
7. [CHANGELOG.md](./CHANGELOG.md) — 变更历史
8. [`w-model-dev/references/bdd-guide.md`](./w-model-dev/references/bdd-guide.md) — BDD 建模指南（L1-L4 分层 features + 状态机七要素 + BDD↔TLA+ 协作）

## 6. 行动约束

- **SSoT 优先**：修改设计决策先改 `docs/skill-design-document_SSoT.md`，再同步 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`），最后同步 `README.md` / `CONTRIBUTING.md` / `AGENTS.md` / `CHANGELOG.md`。
- **脚本自包含**：`w-model-dev/scripts/*.ts` 不得 `import` 任何 `src/` 或外部业务模块，仅依赖本目录内文件 + Node 标准库 + 已声明 devDeps（`ajv` / `ajv-formats` 由 schema-loader.ts runtime import；`eslint-plugin-security` 等仅 security-scan.ts 调用）。devDep 增减必须在 `package.json` + INSTALL.md §2 同步。
- **不引入 LLM 调用**：技能包内任何文件都不得直接调用 LLM；LLM-as-a-Verifier 评审通过提示词委托 V 子代理执行。
- **CHECKPOINT 不可绕过**：`w-model-dev/SKILL.md` 中 `🔴 CHECKPOINT` 标记的暂停点必须等用户确认，不得自动推进。
- **真实测试结果回填**：`/wm test` 不得自动将测试标记为通过，必须由真实测试运行器执行后通过 `result=pass|fail` 回填（由 S 子代理执行回填，编排者不得越权）。
- **编排者最小化**：编排者只做编排（路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本），任何实施动作由 A / S / V / G / R 子代理执行。违反命中反模式 #10，回到当前阶段起点。详见 [`w-model-dev/references/subagent-delegation.md`](./w-model-dev/references/subagent-delegation.md)。
- **返工必先根因定位**：V/G 不通过后必须分派 R 子代理定位根因，禁止直接分派 S 返工（命中反模式 #18）。R 子代理按 [`w-model-dev/references/root-cause-locator.md`](./w-model-dev/references/root-cause-locator.md) 方法论产出 RootCauseReport。
- **R 报告须 V 复审 + G 门禁**：R 报告必须经 V 复审 + G 门禁（`check-rootcause-report.ts` exitCode=0）才可分派 S-fix（命中反模式 #19）。返工循环：V/G→R→V→G→S-fix→V→G。
- **修改前 codegraph 查询**（约束 #20）：阶段 5-8 任何代码/测试文件 `Edit`/`Write` 前，S-coding 须先调用 `codegraph_explore` 查询目标符号影响半径（callers/callees/blast radius）并落盘 `.w-model/codegraph-queries/`；未查询直接修改命中反模式 #38，回到当前阶段起点。OpenSpec opsx 用于规格驱动变更（explore/propose/apply/archive），S-tickets 只做任务拆解（反模式 #40）。

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
| check-verifier-output.ts | Verifier 输出校验（防 LLM 漂移；R13 单轴下限：passed 收紧为 `(A\|\|B) && 所有 subCriterion.score ≥ 0.70`，反模式 #41；支持 `--self-as-verifier --s-output=<path>` 校验 V 产物与 S 产物路径不同，反模式 #35） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-artifact-gate.ts | 工件质量门（RTM 覆盖率 + 四级测试 + TLA+ 资产 + SD→codeModule 终检 + RTM coverageStatus 一致性 + NFR 双字段校验） | 8 | 0=通过，1=校验失败，2=输入错误 |
| check-requirement-graph.ts | 图谱结构门禁 + 信息流校验（黑洞/奇迹/死模块/边界完整性）+ 边数下限校验 + 语义来源占比校验 | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-tla-model.ts | TLA+ 行为门禁（SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性；**已移除 `--skip-tlc`**，所有 specs 强制 TLC） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-bdd-model.ts | BDD 模型门禁（D1 头标注+D2 Gherkin 语法+D3 状态机七要素+D4 TLA+ 等价+D5 step 绑定+D6 scenario 路径+D7 RTM 映射） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-code-tla-consistency.ts | 代码-TLA+ 一致性回归（四维度：SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | 5 | 0=通过，1=失败 |
| check-budget.ts | Budget 门禁（R1-R5 时效性/schema/onExceed/killSwitch/触发检测） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-run-log.ts | Run-log 门禁（R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序 + R3 预防性审查记录校验） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-maturity.ts | Maturity 门禁（R1-R5 schema/level/周期/history/降级） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-checkpoint.ts | Checkpoint 门禁（R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致 + 拒绝代签） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-rootcause-report.ts | RootCauseReport 校验（R1-R10：Schema 完整性/根因链/可证伪/修复建议/预防/上游缺陷/质量等级/报告 ID/多角度/reality-checker 置信度；CLI `npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>`） | 全阶段（返工） | 0=通过，1=校验失败，2=输入错误 |
| check-requirement-coverage.ts | 需求覆盖分析门禁（C1-C10：stakeholder/scenario/requirementType/crossCuts 4 张矩阵完整性 + 100% 覆盖率 + cross-cuts 与图谱一致 + metrics 重算；CLI `<coverage.json> --graph= --out-of-scope= --exemptions=`） | 1 | 0=通过，1=校验失败，2=输入错误 |
| check-exemption.ts | 豁免审批门禁（E1-E8：schema 完整性 + justification + evidence + review 阶段 + reviewDecision=approve + rootCauseAnalysis + verification.verified + humanDecision=approve；强制 S→R→V→人类四阶段；CLI `<exemption.json>`） | 1（豁免审批） | 0=通过，1=校验失败，2=输入错误 |
| check-signature-chain.ts | 角色链式签名门禁（R1-R10：Schema 完整性/签名者角色/时序/输入来源证明/跨阶段消费者校验；CLI `<signature-chain.jsonl>`） | 全阶段 | 0=通过，1=校验失败，2=输入错误 |
| check-archive-integrity.ts | 归档完整性校验（归档清单 + 文件存在性 + schema 一致性） | 8（归档） | 0=通过，1=校验失败，2=输入错误 |
| check-preventive-review.ts | R3 预防性审查三份报告完整性校验（completeness/reliability/security；CLI `<project-dir> --phase=<1-8>`，支持 `--auto-trigger --run-log=<path>`） | 1-8（R3） | 0=通过，1=校验失败，2=输入错误 |
| check-tla-bdd-sync.ts | TLA+/BDD 自动化同步校验（转移集 + 状态集 + 不变式等价） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-role-dispatch.ts | 角色分派完整性校验（每阶段 S/V/G 各 ≥1 条；`--r3-enabled` 时 R ≥3 条；约束 #19） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-state-machine-consistency.ts | 设计文档↔代码状态机一致性校验（状态集 + 转移集一致） | 5 | 0=通过，1=校验失败，2=输入错误 |
| check-design-contract-consistency.ts | 设计契约一致性校验（SSoT §10I：D1 路径 / D2 参数 / D3 状态码 / D4 响应字段，读 docs/uat-path-mapping.md + src/routes + 验收测试断言；CLI `<project-dir>`） | 5、8 | 0=通过，1=校验失败，2=输入错误 |
| check-codegraph-queries.ts | codegraph 查询落盘完整性校验（反模式 #38；CLI `<project-root> --phase <5\|6\|7\|8>`） | 5-8 | 0=通过，1=校验失败，2=输入错误 |
| check-opsx-artifacts.ts | opsx 制品 + R3×3 + V 审查产物齐全性校验（反模式 #39/#40；CLI `<project-root> --phase <5\|6\|7\|8>`） | 5-8 | 0=通过，1=校验失败，2=输入错误 |
| check-openspec-archive.ts | opsx:archive 归档完整性校验（CLI `<project-root> --phase <5\|6\|7\|8>`） | 8（归档） | 0=通过，1=校验失败，2=输入错误 |
| ensure-codegraph-opsx.ts | codegraph + OpenSpec 依赖三层检测（L1 CLI / L2 MCP / L3 项目目录）+ 自动安装，full/quick/light 三模式；CLI `--phase <5-8> --project-root <path> --mode <full\|quick\|light>` | 5（初始化），6-8（复检） | 0=ready/installed，1=有 CHECKPOINT 项，2=输入错误 |
| self-test.ts | 回归基线（213 条样本：19 Verifier + 19 Gate + 28 Graph + 10 Coverage + 7 Exemption + 14 TLA + 5 Budget + 13 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 12 RootCause + 16 Schema + 1 Metadata + 12 BDD + 15 SignatureChain + 4 ArchiveIntegrity + 2 PreventiveReview + 2 TlaBddSync + 3 RoleDispatch + 3 StateMachine + 4 CodegraphQuery + 3 OpsxArtifact + 3 OpenspecArchive + 5 UAT_PATH_MAPPING + 5 DESIGN_CONTRACT）；vitest 269 条（含 graph-logic R1-R6 + coverage-logic C1-C10 + exemption-logic E1-E8 + signature-chain R1-R10 + archive-integrity + preventive-review + tla-bdd-sync + plan-chunks + design-contract-logic，21 test files） | - | 0=通过，1=失败 |
| gate-enhancement.test.ts | 门禁增强回归测试（basePath/SD 覆盖/passed↔qualityLevel + codeModule 格式 + uat-path-mapping） | - | 0=通过，1=失败 |
