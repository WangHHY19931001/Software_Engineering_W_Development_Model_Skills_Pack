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
- **codegraph + OpenSpec 集成**（阶段 5-8）：codegraph 提供修改前符号级影响分析（callers/callees/blast radius），OpenSpec opsx 提供规格驱动变更工作流（explore/propose/apply/archive）。技能包通过 `ensure-codegraph-opsx.ts` 自动检测安装，通过 3 个 check 脚本做门禁校验。详见 SSoT §3.4.21。
- **阶段 1 迷雾登记册（Fog of War）**：REQ 入学锐利性测试（`references/ingestion-chunk.md`，判据 = 能否精确陈述需求的问题，非能否回答）/ A-cross 报告 §7 迷雾汇总（`references/ingestion-cross.md`）/ 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空，`references/phase-1-requirements.md`「迷雾登记册（Fog of War）」节）。迷雾册为文本节不建图节点。详见 SSoT §3.4.23。
- **阶段设计级产物**（第 37-38 轮）：阶段 1-4 产出升级为主模板 + 6 独立子模板（system-context / system-architecture / interface-contract / class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling，按阶段裁剪），主文档引用块串联；`check-requirement-graph.ts` 新增 R7-R14 结构校验 + `check-artifact-gate.ts --phase=N` 引用块/SSOT/DoD 校验。详见 SSoT §3.4.35-38。
- **冰山扫掠深度分析机制**（R-iceberg）：S-fix 后（ICEBERG-A）与阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索主动深挖隐藏问题，直到 `newFindings=[]` 或达 maxIcebergRounds=5。反模式 #44。详见 SSoT §3.4.34 与 `references/iceberg-sweep-guide.md`。
- **错误结构全量归一化**：全仓 30 个脚本 exit 2 统一输出结构化错误——人类消息 `✗ [CATEGORY] ...` 走 stderr、`ERROR_JSON {...}` 摘要走 stdout（`lib/cli-error.ts`，6 类错误码）。详见 SSoT §3.4.30。

权威设计决策以 [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) 为单一事实来源（SSoT）。

## 2. 关键目录速查

| 目录 | 用途 | Agent 行动要点 |
|---|---|---|
| `w-model-dev/` | **技能资产主体**（标准 skill 结构，可整体拷贝分发） | 安装时整体拷贝此目录；运行时按阶段加载 `references/phase-N-*.md` |
| `w-model-dev/SKILL.md` | 编排逻辑 + 命令接口 + 架构定位 | Agent 首次进入仓库必读；`/wm` 命令由其承载 |
| `w-model-dev/references/` | 阶段细则（阶段 1 含迷雾登记册 Fog of War）/ verifier-spec（含五轴评审 §7.4A + self-as-verifier 模式节）/ agent-personas（4 个评审角色提示词）/ subagent-delegation（O/A/S/V/G/R 编排者-子代理边界；含角色分派完整性校验节 + S 子代理 RTM 回填强制职责）/ root-cause-locator（R 子代理根因分析方法论）/ subagent-persona-matrix（R-lead / V-lead 多角度 persona 选择矩阵）/ definition-of-done（项目级 DoD 七维度）/ signature-chain-guide（角色链式签名 + 产出来源正确性）/ event-ingress-guide（Loop 3 事件接驳）/ hill-climbing-guide（Loop 4 爬坡循环）/ skillopt-adoption（SkillOpt 方法论吸收）/ anti-patterns（46 条流程反模式 #1-#46 + L1~L4 教训 + F1~F10 失败模式 + O1~O6 运维失败模式；#20 见 subagent-delegation.md）/ ingestion-chunk / ingestion-cross（A 子代理分块与合并细则）/ graph-guide（图谱门禁与收敛准则）/ tla-plus-guide（TLA+ 层次化状态机建模与行为门禁）/ bdd-guide（BDD 建模 + TLA+/BDD 自动化同步校验节）/ command-reference / operational-recovery / dispatch-matrix（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本总览矩阵，编排者分派前必读）/ 数据模型（含 budget/run-log/maturity schema）/ rtm-guide / quality-standards / iceberg-sweep-guide / glossary / toolbox / bdd-review-checklist / bdd-syntax-reference / bdd-patterns-examples / tla-plus-syntax-reference / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-tlc-configuration / directory-conventions / format-conventions / estimation-guide / context-management-guide / mythical-man-month-absorption / external-skills-absorption | **按需加载**，禁止一次性载入全部（反例 #5） |
| `w-model-dev/subagent/` | **人格库**（28 个 Markdown 人格文件，分 engineering / testing / design / product / project 5 类） | R-lead / V-lead 多角度分析时按 `references/subagent-persona-matrix.md` 选用 persona；Persona 文件本身是 Markdown，不调用 LLM |
| `w-model-dev/scripts/` | 自包含门禁脚本（依赖 `tsx` runtime + devDeps：ajv / eslint-plugin-security，需 `npm install` 一次）：`gate-logic.ts` + `check-artifact-gate.ts`（工件质量门，含 TLA+ 资产 + SD→codeModule 终检 + RTM coverageStatus 一致性 + NFR 双字段校验 + 阶段级 `--phase=N`）/ `verifier-logic.ts` + `check-verifier-output.ts`（Verifier 校验，R13 单轴下限，支持 `--self-as-verifier --s-output=<path>`）/ `graph-logic.ts` + `check-requirement-graph.ts`（阶段 1–4 图谱结构门禁 + 信息流校验 + 边数下限 + 语义来源占比 + 阶段设计级 R7-R14）/ `tla-logic.ts` + `check-tla-model.ts`（阶段 1–4 TLA+ 行为门禁：SANY 语法 + TLC 模型检查，**已移除 `--skip-tlc`**）/ `code-tla-logic.ts` + `check-code-tla-consistency.ts`（阶段 5 代码-TLA+ 一致性回归：四维度）/ `budget-logic.ts` + `check-budget.ts`（Budget 门禁 R1-R5）/ `run-log-logic.ts` + `check-run-log.ts`（Run-log 门禁 R1-R7 + R3 预防性审查记录校验）/ `maturity-logic.ts` + `check-maturity.ts`（Maturity 门禁 R1-R5）/ `checkpoint-logic.ts` + `check-checkpoint.ts`（Checkpoint 门禁 R1-R5 + 拒绝代签）/ `root-cause-logic.ts` + `check-rootcause-report.ts`（RootCauseReport 校验 R1-R10）/ `signature-chain-logic.ts` + `check-signature-chain.ts`（签名链门禁 R1-R10 + 跨阶段消费者校验）/ `archive-integrity-logic.ts` + `check-archive-integrity.ts`（归档完整性校验）/ `preventive-review-logic.ts` + `check-preventive-review.ts`（R3 预防性审查三份报告校验）/ `iceberg-sweep-logic.ts` + `check-iceberg-sweep.ts`（IcebergSweepReport 校验 R1-R8）/ `tla-bdd-sync-logic.ts` + `check-tla-bdd-sync.ts`（TLA+/BDD 自动化同步校验）/ `role-dispatch-logic.ts` + `check-role-dispatch.ts`（角色分派完整性校验）/ `check-state-machine-consistency.ts`（设计文档↔代码状态机一致性）/ `design-contract-logic.ts` + `check-design-contract-consistency.ts`（设计契约一致性 D1-D4）/ `coverage-logic.ts` + `check-requirement-coverage.ts`（需求覆盖分析 C1-C10）/ `exemption-logic.ts` + `check-exemption.ts`（豁免审批 E1-E8）/ `ensure-codegraph-opsx.ts`（codegraph + OpenSpec 依赖三层检测+自动安装）/ `check-codegraph-queries.ts`（反模式 #38）/ `check-opsx-artifacts.ts`（反模式 #39/#40）/ `check-openspec-archive.ts`（opsx:archive 归档完整性）/ `schema-loader.ts`（ajv 单例 + schemas/ 自动加载）/ `security-scan.ts`（eslint-plugin-security 扫描 + baseline v2 内容敏感指纹豁免）/ `plan-chunks.ts`（ingestion 分块策略）/ `wm-status-logic.ts` + `wm-status.ts`（状态快照，只读）/ `metrics-report-logic.ts` + `metrics-report.ts`（流程度量，只读）/ `self-test.ts`（回归基线，249 条样本）/ `lib/read-json-or-exit.ts`（CLI 层 JSON/JSONL 读取工具）/ `lib/cli-error.ts`（exit 2 错误结构统一：6 类错误码）/ `lib/safe-json.ts`（JSON 原型污染防御）/ `__tests__/`（vitest 单元测试，35 个 .test.ts / 524 条 + README.md coverage 矩阵） | Agent 在阶段门 / 质量门 / 图谱门禁 / TLA+ 行为门禁 / 代码-TLA+ 一致性回归 / 签名链 / 归档完整性 / R3 预防性审查 / TLA+/BDD 同步 / 角色分派 / 状态机一致性 / 冰山扫掠检查点直接 `npx tsx` 执行 |
| `w-model-dev/templates/` | 文档模板（需求 / 设计 / 测试 / RTM 等，阶段 1-4 含主模板 + 6 独立子模板） | 产出文档时套用对应模板 |
| `w-model-dev/examples/` | 交互示例（需求分析 / 设计 / 编码 / 测试执行） | 产出前参考对应示例 |
| `w-model-dev/schemas/` | JSON Schema (draft-07) 文件（20 份，全字段 description 自描述） | logic 层 schema 校验时自动加载；新增 .w-model/*.json 字段必先改 schema |
| `docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/` | 第 23 轮 8 阶段调测归档（7 文件，最新一轮：32 需求 / 630 测试全通过） | 查阅最新调测结论时 |
| `docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/` | 第 20 轮 8 阶段调测归档（7 文件） | 查阅历史调测结论时 |
| `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/` | 第 19.0.1 轮 8 阶段调测归档（7 文件，含 D7 bug 修复记录） | 查阅历史调测结论时 |
| `docs/changes/archive/2026-07-26-round15-end-to-end-test/` | 第 15 轮端到端调测归档摘要（9 文件） | 查阅历史调测结论时 |
| `docs/` | 设计文档统一存放（SSoT / 集成设计 / 安装指南） | 修改设计先改 SSoT，再改 `w-model-dev/` 资产 |
| `.cursor/skills/` | Cursor 技能包（23 个中文适配技能；含 security-review 源码级安全扫描、codegraph-exploration 约束 #20 修改前影响分析、performance-review 性能评审） | 安全/性能评审、阶段 5-8 修改前 codegraph 影响分析场景按技能触发语义选用 |
| `eval/` | 外部工具（darwin-skill）评估产物归档 | 不属技能包，Agent 一般无需读取 |
| `.githooks/pre-push` | **本地 CI**：`git push` 时自动跑 14 项门禁（self-test + 门禁脚本退出码 + vitest 全量 + security-scan + npm audit warn-only），任一不符即中止推送；替代远程 CI（仓库无 `.github/workflows/`，历史原因见 CHANGELOG）；平台补装见 `.githooks/ensure-platform-deps.sh` | 修改 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` / `.githooks/ensure-platform-deps.sh` 后会触发；Git Bash 与 WSL 下均正常执行门禁，仅纯 cmd/PowerShell 放行 |

门禁脚本测试：
- `w-model-dev/scripts/__tests__/`：门禁脚本单元测试（vitest，35 个 .test.ts / 524 条）
- `w-model-dev/scripts/samples/`：fixture 样本（含 gate-enhancement 场景）
- 运行：`cd w-model-dev && npx vitest run scripts/__tests__/`

## 3. 常用命令

```bash
# 首次：在仓库根目录安装 devDependencies（ajv / ajv-formats / eslint-plugin-security / tsx / typescript / vitest 等，约 30MB）
npm install

# 校验脚本（依赖 tsx runtime + ajv devDep，schema 校验由 logic 层自动调用）
npm run self-test                           # 249 条样本回归基线，退出码 0/1
npm run check:verifier -- <output.json>     # Verifier 输出校验，退出码 0/1/2
npm run check:gate -- [project-dir]         # 工件质量门，退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 阶段 1–4 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>]  # 阶段 1–4 TLA+ 行为门禁，退出码 0/1/2
npm run wm:status -- <dir>                  # 状态快照（只读），退出码 0/2
npm run wm:metrics -- <dir>                 # 流程度量报告（只读），退出码 0/2
npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>  # 阶段 5 代码-TLA+ 一致性回归，退出码 0/1/2

# 一次性启用本地推送前门禁（写入本地 .git/config，不影响仓库内容）
npm run setup:hooks

# 手动跑推送前门禁（不实际推送，14 项门禁检查；Windows 请用 Git Bash，WSL 可直接跑）
npm run prepush

npm run lint:security              # 跑 eslint-plugin-security + baseline 比对，退出码 0/1；npx tsx w-model-dev/scripts/security-scan.ts --regenerate 可重生成 baseline
# schema 校验由 logic 层自动调用，无需独立命令（devDep：ajv + ajv-formats）
```

退出码约定：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。Agent 在 🔴 CHECKPOINT 处必须以脚本退出码为准，**不得用 LLM 估算**（反例 #3 / #6 / #7 / #12）。

## 4. 参考实现（已归档）

W 模型 8 阶段端到端调测的完整产物，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用。源码不随仓库保留，仅归档摘要（按时间倒序）：

- [`docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/`](./docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/) — 第二十三轮（最新）：32 需求 / 630 测试全通过 / 覆盖率 94.99% lines / 282 节点 1343 边
- [`docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/`](./docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/) — 第二十轮：7 文件
- [`docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`](./docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/) — 第十九轮：32 需求 / 231 测试全通过 / 1 完整周期闭环 / 发现 check-bdd-model.ts D7 RTM schema bug
- [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/) — 第十五轮：32 需求 / 889 测试全通过 / 32 个流程问题修复

**最新一轮调测结论**（第二十三轮，2026-07-30，扩展博客系统 32 需求，编排者-子代理分派 + self-as-verifier 自驱模式）：

| 指标 | 数值 |
|---|---|
| 需求 / 设计 | 32（22 REQ + 6 NFR + 4 CON）/ 22 SD + 22 INTF + 75 DD |
| TLA+ / BDD | 4 规格（L1-L4）/ 4 features（32 scenarios） |
| 源码 | 52 TS 文件 |
| 图谱 | 282 节点 / 1343 边（无违反） |
| 测试用例 | 630（390 UT + 130 IT + 38 ST + 72 UAT）全通过 |
| 覆盖率 | 94.99% lines / 84.91% branches / 95.69% functions |
| 门禁 | `tsc --noEmit` 0 错误；`npm test` 38 test files / 630 tests / 退出码 0 |
| 关键修复 | R23-001~005：性能阈值 headroom / 状态机转移修正（archived→draft）/ 路由顺序冲突（`/api/articles/popular` vs `/:id`） |

> 完整调测细节与各轮对比见归档目录与 [CHANGELOG.md](./CHANGELOG.md)。归档**不参与 `/wm` 命令编排**，也不会被 `check-*-gate.ts` 读取。Agent 向用户解释 W 模型产出形态、阶段产物颗粒度时可指向归档。

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
- **回归测试强制钩子**（约束 #21）：任何 agent 改动代码后必须跑回归测试（第 39 轮 P1 批新增）；详见 [w-model-dev/references/phase-5-coding.md](./w-model-dev/references/phase-5-coding.md)「增量集成纪律」节。

## 7. 修复记录

- **TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归**（2026-07-24）：tla-plus-guide.md 新增命名规范/路径基准/前置清单三节；subagent-delegation.md 强化信号 5 + S-doc/S-tla 拆分模板；新建 code-tla-logic.ts/check-code-tla-consistency.ts（四维度校验）；gate-logic.ts 终检新增 TLA+ 资产 + SD→codeModule 校验。
- **R（根因定位者）+ F（修复者，由 S 兼任）角色新增**（2026-07-24）：新增返工循环 V/G→R→V→G→S-fix→V→G；新增 check-rootcause-report.ts（R1-R10）；新增 references/root-cause-locator.md + subagent-persona-matrix.md + subagent/（28 个人格文件）；新增反模式 #18/#19。

## 8. 脚本导航表

| 脚本名 | 用途 | 阶段 | 退出码 |
|---|---|---|---|
| check-verifier-output.ts | Verifier 输出校验（防 LLM 漂移；R13 单轴下限：passed 收紧为 `(A\|\|B) && 所有 subCriterion.score ≥ 0.70`，反模式 #41；支持 `--self-as-verifier --s-output=<path>`，反模式 #35） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-artifact-gate.ts | 工件质量门（RTM 覆盖率 + 四级测试 + TLA+ 资产 + SD→codeModule 终检 + RTM coverageStatus 一致性 + NFR 双字段校验 + 阶段级 `--phase=N`） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-requirement-graph.ts | 图谱结构门禁 + 信息流校验（黑洞/奇迹/死模块/边界完整性）+ 边数下限 + 语义来源占比 + 阶段设计级 R7-R14（`--spec-dir`） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-tla-model.ts | TLA+ 行为门禁（SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性；**已移除 `--skip-tlc`**） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-bdd-model.ts | BDD 模型门禁（D1 头标注+D2 Gherkin 语法+D3 状态机七要素+D4 TLA+ 等价+D5 step 绑定+D6 scenario 路径+D7 RTM 映射） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-code-tla-consistency.ts | 代码-TLA+ 一致性回归（四维度：SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | 5 | 0=通过，1=校验失败，2=输入错误 |
| check-budget.ts | Budget 门禁（R1-R5 时效性/schema/onExceed/killSwitch/触发检测） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-run-log.ts | Run-log 门禁（R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序 + R3 预防性审查记录校验） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-maturity.ts | Maturity 门禁（R1-R5 schema/level/周期/history/降级） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-checkpoint.ts | Checkpoint 门禁（R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致 + 拒绝代签） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-rootcause-report.ts | RootCauseReport 校验（R1-R10：Schema 完整性/根因链/可证伪/修复建议/预防/上游缺陷/质量等级/报告 ID/多角度/reality-checker 置信度） | 全阶段（返工） | 0=通过，1=校验失败，2=输入错误 |
| check-requirement-coverage.ts | 需求覆盖分析门禁（C1-C10：4 张矩阵完整性 + 100% 覆盖率 + cross-cuts 与图谱一致 + metrics 重算） | 1 | 0=通过，1=校验失败，2=输入错误 |
| check-exemption.ts | 豁免审批门禁（E1-E8：强制 S→R→V→人类四阶段） | 1（豁免审批） | 0=通过，1=校验失败，2=输入错误 |
| check-signature-chain.ts | 角色链式签名门禁（R1-R10 + 跨阶段消费者校验；R8 仅真实项目根启用） | 全阶段 | 0=通过，1=校验失败，2=输入错误 |
| check-archive-integrity.ts | 归档完整性校验（归档清单 + 文件存在性 + schema 一致性） | 8（归档） | 0=通过，1=校验失败，2=输入错误 |
| check-preventive-review.ts | R3 预防性审查三份报告完整性校验（completeness/reliability/security；支持 `--auto-trigger --run-log=<path>`） | 1-8（R3） | 0=通过，1=校验失败，2=输入错误 |
| check-iceberg-sweep.ts | IcebergSweepReport 校验（R1-R8，反模式 #44；支持 `--auto-trigger --run-log=<path>`） | 1-8（S-fix 后 / 阶段门前） | 0=通过，1=校验失败，2=输入错误 |
| check-tla-bdd-sync.ts | TLA+/BDD 自动化同步校验（转移集 + 状态集 + 不变式等价） | 1-4 | 0=通过，1=校验失败，2=输入错误 |
| check-role-dispatch.ts | 角色分派完整性校验（每阶段 S/V/G 各 ≥1 条；`--r3-enabled` 时 R ≥3 条；约束 #19） | 1-8 | 0=通过，1=校验失败，2=输入错误 |
| check-state-machine-consistency.ts | 设计文档↔代码状态机一致性校验（状态集 + 转移集一致） | 5 | 0=通过，1=校验失败，2=输入错误 |
| check-design-contract-consistency.ts | 设计契约一致性校验（D1 路径 / D2 参数 / D3 状态码 / D4 响应字段） | 5、8 | 0=通过，1=校验失败，2=输入错误 |
| check-codegraph-queries.ts | codegraph 查询落盘完整性校验（反模式 #38） | 5-8 | 0=通过，1=校验失败，2=输入错误 |
| check-opsx-artifacts.ts | opsx 制品 + R3×3 + V 审查产物齐全性校验（反模式 #39/#40） | 5-8 | 0=通过，1=校验失败，2=输入错误 |
| check-openspec-archive.ts | opsx:archive 归档完整性校验 | 8（归档） | 0=通过，1=校验失败，2=输入错误 |
| ensure-codegraph-opsx.ts | codegraph + OpenSpec 依赖三层检测（L1 CLI / L2 MCP / L3 项目目录）+ 自动安装，full/quick/light 三模式 | 5（初始化），6-8（复检） | 0=ready/installed，1=有 CHECKPOINT 项，2=输入错误 |
| self-test.ts | 回归基线（249 条样本）；vitest 524 条（35 test files） | - | 0=通过，1=失败 |
| gate-enhancement.test.ts | 门禁增强回归测试（basePath/SD 覆盖/passed↔qualityLevel + codeModule 格式 + uat-path-mapping） | - | 0=通过，1=失败 |
| check-docs-consistency.ts | 活体文档一致性门禁（schema 清单 / run-log action 枚举 / targetKind / DoD 维度 / 操作行为 / 反模式 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数 / design-docs / vitest-files） | - | 0=通过，1=不一致，2=输入错误 |
