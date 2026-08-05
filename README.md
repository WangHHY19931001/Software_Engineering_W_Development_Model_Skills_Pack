# W-Model AI Assistant Skill

[![JSON Schema](https://img.shields.io/badge/JSON%20Schema-draft--07-blue)](w-model-dev/schemas/)
[![Security Scan](https://img.shields.io/badge/Security-eslint--plugin--security-green)](.eslintrc.cjs)

> 基于 AI 辅助编码与 LLM-as-a-Verifier 的 W 开发模型闭环工作技能。
>
> 将软件工程 W 模型（需求 → 设计 → 编码 → 测试）的 8 个阶段编排为可执行的 `/wm` 命令，
> 自动维护需求跟踪矩阵（RTM）、在验收阶段触发工件质量门检查。
>
> **架构定位**：技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> LLM-as-a-Verifier 评审由外部 Agent 按提示词执行；技能自演化由外部工具（SkillOpt / darwin-skill）完成。

## 核心能力

- **W 模型 8 阶段编排**：需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码 → 集成测试 → 系统测试 → 验收测试
- **编排者最小化（Orchestrator Minimization）**：编排者（O）只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本）；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（S 产出 / V 评审 / G 门禁 / R 根因定位）执行。违反命中反模式 #10，回到当前阶段起点。详见 [subagent-delegation.md](./w-model-dev/references/subagent-delegation.md)
- **LLM-as-a-Verifier（V 子代理执行）**：基于 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 的连续评分 [0,1]（4 位小数）+ 三维度验证（粒度 / 重复 / 分解）+ PPT 排序；技能提供提示词与输出 Schema，V 子代理执行 LLM 调用（即「外部 Agent」），技能用校验脚本防漂移；编排者不得自评
- **Agent Personas（评审角色提示词，V 子代理执行）**：4 个 W 模型适配 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），由 V 子代理在执行 `/wm review` 时按 `targetKind` 路由选用；Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema
- **五轴评审 + Severity 标签**：Correctness / Readability / Architecture / Security / Performance 五轴评审 + Severity 标签（Critical / Required / Optional / Nit / FYI），作为 `reworkHints` 字符串前缀；吸收自 addyosmani/agent-skills `code-review-and-quality`
- **核心操作行为 + 失败模式清单**：6 条核心操作行为（Surface Assumptions / Manage Confusion Actively / Push Back When Warranted / 等）+ 10 条失败模式 F1~F10（行为退化，命中不回退但登记）；与 43 条流程反模式（流程破坏，命中即回退，含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复 / #20 只规划不执行（见 [subagent-delegation.md](./w-model-dev/references/subagent-delegation.md)）/ #21 阶段级门禁跳过 / #22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON 文件 PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用 / #27 调测者简化行为 / #28 schema 前置校验缺失 / #29 BDD 建模与需求/设计/TLA+ 不符未回退 / #30 豁免审批跳步 / #31 归档完整性缺失 / #32 签名链断裂 / #33 跳过 R3 预防性审查 / #34 编排者漏派角色 / #35 self-as-verifier 模式下 V/G/R 产物混合 / #36 路由顺序错误 / #37 产物膨胀但核心决策稀疏） / #38 修改前未查询 codegraph / #39 跳过 opsx 产物审查 / #40 opsx/S-tickets 职责混淆 / #41 加权平均掩盖单轴失败 / #42 S-fix / emergency-fix 后跳过 R3+V / #43 敏感信息写入状态文件/日志；F# 重复命中 ≥2 次升级为 L# 教训
- **项目级 Definition of Done**：5 维度（功能 / 质量 / 测试 / 文档 / 部署）的每次变更日常标准，与阶段门质量门互补
- **RTM 自动维护**：从项目状态自动重建需求跟踪矩阵，双向追溯需求 ↔ 设计 ↔ 代码 ↔ 四级测试
- **状态持久化**：JSON 文件存储，跨多轮交互保持上下文
- **工件质量门**：RTM 需求覆盖率 100% + 四级测试全部通过才允许交付（技能验证门已移除，演化评估移交外部工具；单元测试代码覆盖率阈值 ≥ 80% 属于质量标准，与 RTM 覆盖率是两个独立指标）
- **返工循环：R 根因定位者 + S 兼 F 修复者**：V/G 不通过后，必先分派 R（根因定位者，第 6 角色）接收 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位缺陷根因，产出 `RootCauseReport`（含根因链 / 上游缺陷标记 / 修复建议 / 防御措施）；经 V 复审（`targetKind=rootcause`）+ G 门禁（`check-rootcause-report.ts`）通过后，S 兼 F 携 R 报告执行修复（按 `fixRecommendation`）；新增反模式 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审直接 S 修复）；正常路径 `S → V → G → 下一阶段`，返工路径 `V/G 不通过 → R 定位 → V 复审 → G 门禁 → S-fix 修复 → V → G → 下一阶段`；详见 [root-cause-locator.md](./w-model-dev/references/root-cause-locator.md)
- **TLA+ 层次化状态机建模 + 代码-TLA+ 一致性回归**：阶段 1-4 用 TLA+ 建模系统/子系统/原子行为（L1-L3+ 层次化），G 子代理跑 `check-tla-model.ts` 校验 SANY 语法 + TLC 模型检查；阶段 5 G 子代理跑 `check-code-tla-consistency.ts` 四维度校验（SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式），将 TLA+ 资产作为状态机验证器回归编码产物
- **BDD 行为建模与验收夹具**：阶段 1-4 用 Cucumber.js + Gherkin 产出 L1-L4 分层 features（与 TLA+ 层次对齐），Background 节声明状态机七要素；G 子代理跑 `check-bdd-model.ts` 7 维度校验（D1 头标注 / D3 状态机 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射）；阶段 5 以 L4 features 作为 TDD 夹具，阶段 6/7/8 执行 L3/L2/L1 cucumber scenarios。反模式 #29 守护 BDD↔TLA+ 不符未回退
- **PPT 排序算法**：O(N×k) 复杂度的概率枢轴锦标赛，用于测试用例优先级排序
- **采用路径（Greenfield vs Brownfield）**：新项目 Day 0 跑全流程 vs 存量项目增量验证优先，见 [采用路径指南](./docs/adoption-guide.md)；吸收自 addyosmani/agent-skills `docs/adoption-guide.md` 并适配 W 模型 8 阶段
- **Loop 3 事件驱动循环**（L2+ 激活）：棕地维护场景的事件接驳——消费方自行实现 webhook/cron 触发器写入 `event-ingress.jsonl`，编排者 O 按事件类型路由到单阶段（bug 修复/需求变更/验收重跑/回归测试/安全事件）。不内置调度基础设施。详见 [event-ingress-guide.md](w-model-dev/references/event-ingress-guide.md)。
- **Loop 4 爬坡循环**：分析 run-log 产出 HarnessImprovementReport 改进信号（prompt/工具/验证规则/反模式/成熟度/预算 6 类），人审后手动应用。保持"技能自演化不在本仓库"原则——外部 SkillOpt/darwin-skill 消费信号做演化。详见 [hill-climbing-guide.md](w-model-dev/references/hill-climbing-guide.md)。
- **SkillOpt 方法论吸收**：吸收 [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt)「bounded edit + validation gate」方法论，消费 Loop 4 产出的 HarnessImprovementReport 信号，对技能/模板/参考/脚本 4 类资产做离线进化。不引入 Python 依赖、不调用 LLM（方法论吸收非工具运行，与 §11 协调）。详见 [skillopt-adoption.md](w-model-dev/references/skillopt-adoption.md)。
- **codegraph 修改前影响分析**（阶段 5-8，第 25 轮新增）：S-coding 子代理在 Edit/Write 任何代码/测试文件前，须先调用 codegraph_explore MCP 工具查询目标符号的 callers/callees/blast radius，结果落盘 `.w-model/codegraph-queries/`。与 code-TLA+ 一致性校验（修改后回归）互补：前者预防、后者回归。详见 [phase-5-coding.md](./w-model-dev/references/phase-5-coding.md)「codegraph 修改前影响分析」节
- **OpenSpec opsx 三段式 S 分派**（阶段 5-8，第 25 轮新增）：引入 opsx:explore/propose/apply/archive 规格驱动变更工作流，S-explore（思路探索+codegraph 影响初判）→ S-propose（规格级变更规划+S-tickets 拆解）→ S-coding（按 tickets frontier 逐片编码）。每段产物跑 R3×3（completeness/reliability/security）+ V 评审，不合格打回重做。详见 [phase-5-coding.md](./w-model-dev/references/phase-5-coding.md)「OpenSpec opsx 三段式 S 分派」节
- **单轴下限 R13**（第 26 轮新增）：Verifier 评审 passed 判据收紧为 `qualityLevel∈{A,B} && 所有 subCriterion.score ≥ 0.70`（0.70 = B 级分界），杜绝「加权平均掩盖单轴失败」（反模式 #41）——completeness=0.65 但其余 0.95 加权后达 A 级的历史放行路径被拦截。外部原则「评审各轴独立成环，永不合并计分」为设计依据。详见 [verifier-spec.md](./w-model-dev/references/verifier-spec.md) §3.3 / §6.3
- **Fowler 12 坏味道基线 + 票据 durability + 术语治理**（第 26 轮新增）：`engineering-code-reviewer.md` 固定 12 条坏味道基线（重复代码 / 过长方法 / 过大类 / 特征依恋 / 数据泥团 / Switch 语句 / 临时字段 / 消息链等，评审命中须引用条目名）；`phase-5-coding.md` 票据主体 = 符号级契约（接口/类型/状态转移），位置信息交给 codegraph，杜绝 fragile reference；新建 [glossary.md](./w-model-dev/references/glossary.md) 术语权威表（15+ 术语 + `_Avoid_` 别名治理）
- **阶段 1 迷雾登记册（Fog of War）**（第 27 轮新增）：需求分析引入「REQ 入学锐利性测试」（吸收 wayfinder「Fog or ticket?」判据——能否精确陈述，不是能否回答）+ 迷雾登记册文本节（Not yet specified，不建图节点）+ 毕业机制（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空）。为「in-scope 尚无法精确陈述」的需求提供落脚点，杜绝 A 子代理捏造浅层 REQ 或静默丢弃。治理走 FM-3D-07 + 禁止行为 #12（不新增反模式）。详见 [phase-1-requirements.md](./w-model-dev/references/phase-1-requirements.md)「迷雾登记册（Fog of War）」节
- **第 28 轮 need_fix.md + 全量脚本 code-review 修正**：`need_fix.md` 两处 bug（estimateTokens CJK 低估 / splitMarkdownByHeaders 分段逻辑）修复 + 全量脚本 code-review 发现 ~66 项缺陷修正（SD→codeModule 对齐 / security-scan 指纹跨机器归一化 / --rtm R6 纳入 passed / 豁免多 group / 签名链跨阶段连续链 / run-log R1 按阶段分档 / uat-path-mapping 严格解析 + phase 8 终检 / graph.schema.json sourceArtifact 复活 / tla-rework 改为 action=rework 统计）。self-test 基线 192→213 / vitest 205→269 / 21 test files。新增 plan-chunks.test.ts + design-contract-logic.ts + 对应单测。版本号 26.0.0 → 27.0.0
- **错误结构全量归一化 + R6 契约迁移**（第 32 轮新增）：统一全仓 29 个脚本 exit 2 错误输出为结构化格式——人类消息 `✗ [CATEGORY] ...` 走 stderr、`ERROR_JSON {...}` 摘要走 stdout（§10E E.1 exitCode 强一致，`process.exitCode` 自然退出防 stdout 截断）；`extractExitCode`/`buildGateLogKeys` 迁入 `run-log-logic.ts` 纯逻辑层（GATE_JSON_PATTERNS 26 个标记含 ERROR_JSON，exit 2 存档可被 R6 交叉校验）。详见 [command-reference.md](./w-model-dev/references/command-reference.md)「错误码与 ERROR_JSON 约定」节与 [SSoT §3.4.30](./docs/skill-design-document_SSoT.md)

## 架构原则与外部工具边界

本技能遵循「技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM」的架构原则。

| 能力 | 归属 | 实现位置 |
|---|---|---|
| W 模型阶段编排、RTM 维护、状态管理 | 技能内 | `w-model-dev/SKILL.md`（编排逻辑，Agent 执行）+ `w-model-dev/references/*`（阶段细则） |
| 工件质量门 | 技能内（脚本只做门禁） | `w-model-dev/scripts/gate-logic.ts` + `check-artifact-gate.ts` |
| LLM-as-a-Verifier 评审（三维度 / 连续评分 / PPT / 子标准） | 技能内提供提示词与 Schema，外部 Agent 执行 | `w-model-dev/references/verifier-spec.md` + `scripts/check-verifier-output.ts` |
| LLM 推理本身 | 外部 | 由外部 Agent（Trae / Claude / Cursor 等）自行调用其 LLM |
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估） | 外部（工具运行）+ 技能内（方法论吸收） | 工具运行：[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)；方法论吸收：[skillopt-adoption.md](w-model-dev/references/skillopt-adoption.md)（§10H） |
| codegraph（符号级影响分析）| 外部（MCP 工具）| 宿主 Agent MCP 工具 `codegraph_explore`，阶段 5-8 修改前预防查询 |
| OpenSpec opsx（规格驱动变更管理）| 外部（CLI 工具）| 宿主 Agent CLI `/opsx:explore` `/opsx:propose` `/opsx:apply` `/opsx:archive`，阶段 5-8 规划层 |

详见 SSoT [§3.3 技能架构原则与外部工具边界](./docs/skill-design-document_SSoT.md)。

## 快速上手

### AI Agent 安装

将 [`w-model-dev/`](./w-model-dev) 目录拷贝到你的 AI Agent（Trae / Claude Code 等）的 skills 目录即可。**Skill 资产零依赖**：`SKILL.md` 定义触发条件与编排，`references/` / `templates/` / `examples/` / `subagent/` / `schemas/` 按需加载，纯 Markdown 无需 Node.js 或 npm。

```bash
# 拷贝 skill 目录到 agent 的 skills 位置（路径以你的 agent 为准）
cp -r w-model-dev /path/to/agent/skills/w-model-dev
```

安装后，agent 在用户提及 W 模型或 `/wm` 命令时自动激活本技能。详细步骤与验证方法见 [docs/INSTALL.md](./docs/INSTALL.md)。

### 运行门禁校验脚本

技能包内的校验脚本（`w-model-dev/scripts/*.ts`）是自包含的 TypeScript，由外部 Agent 在阶段门评审时直接执行。脚本依赖 [tsx](https://tsx.is/) + 少量 devDependencies（在仓库根目录 `npm install` 一次）：

- **runtime devDep**：`ajv` + `ajv-formats` — JSON Schema (draft-07) 强约束，由 `schema-loader.ts` 在 10 个 `*-logic.ts` 顶部自动 import
- **devDep（仅安全扫描用）**：`eslint-plugin-security` + `@typescript-eslint/*` — 由 `security-scan.ts` 调用
- **runtime**：`tsx`（运行 ESM TypeScript）

```bash
# 首次：在仓库根目录安装 devDependencies（ajv / eslint-plugin-security / tsx 等）
npm install

# 用 npm run 快捷脚本：
npm run check:verifier -- <output.json>     # 退出码 0/1/2
npm run check:gate -- [project-dir]         # 退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>]  # TLA+ 行为门禁，退出码 0/1/2
npm run check:coverage -- <coverage.json> [--graph=] [--out-of-scope=] [--exemptions=]  # 阶段 1 需求覆盖分析门禁，退出码 0/1/2
npm run check:exemption -- <exemption.json>  # 豁免审批门禁（S→R→V→人类四阶段），退出码 0/1/2
npm run self-test                           # 退出码 0/1（213 条样本回归基线）
npm run lint:security                       # 安全扫描 + baseline 比对，退出码 0/1

# 或用 npx tsx 直接调用：
npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4]
npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>  # 代码-TLA+ 一致性回归，退出码 0/1
npx tsx w-model-dev/scripts/self-test.ts
```

> 脚本不调用任何 LLM，仅做结构化门禁判定。
> `self-test.ts` 是校验逻辑的回归基线：每次修改 `*-logic.ts` 后必须跑通，新增校验项需同步增加样本（详见 [`scripts/__tests__/README.md`](./w-model-dev/scripts/__tests__/README.md) coverage 矩阵）。
> 「I have X, I want Y → use Z」工具路由见 [`references/toolbox.md`](./w-model-dev/references/toolbox.md)。

### 门禁脚本增强（v2，2026-07-25）

| 校验项 | 脚本 | 说明 |
|---|---|---|
| basePath 强制 | check-tla-model.ts | manifest.basePath 必填，缺失 → exit 1 |
| SD 覆盖率全规格 | check-tla-model.ts | 所有 spec 须含 SD-xxx，无例外 |
| passed↔qualityLevel | check-verifier-output.ts | 严格一致，无例外 |
| codeModule 时机 | check-code-tla-consistency.ts | 阶段5编码后强制回填 |
| Next 命名映射 | check-code-tla-consistency.ts | PascalCase↔camelCase 自动映射 |

**Fixture 化回归测试**：
```bash
cd w-model-dev && npx vitest run scripts/__tests__/gate-enhancement.test.ts
```
覆盖 basePath/SD 覆盖/passed↔qualityLevel 三个维度的正常+失败路径。

### 门禁脚本增强（v3，2026-07-25 第 9 轮）

| 校验项 | 脚本 | 说明 |
|---|---|---|
| 阶段级渐进式校验 | check-artifact-gate.ts | 新增 `--phase=N`，N<8 时只校验该阶段及之前字段；N=8/缺省为终检 |
| targetKind 标准化 | verifier-logic.ts | 4 枚举值 `requirement/design/code/test`，`testcase` 弃用 |
| NFR/CON 字段注册 | check-artifact-gate.ts | 阶段 1 强制 NFR/CON 字段在 RTM 注册 |
| codeModule 阶段 5 回填 | check-artifact-gate.ts | 阶段 5 强制 codeModule 列非空 |
| rawScores 防漂移 | verifier-logic.ts | 全同检测 + 完美等差数列检测 + 扰动范围校验 |
| TLA+ states 自动清理 | check-tla-model.ts | 默认清理 `states/`，`--keep-states` 调试保留 |
| Next 分支覆盖扩展 | check-code-tla-consistency.ts | 全部 specs 覆盖，不再仅 L2+ |
| 反模式 #20 | subagent-delegation.md | 只规划不执行 → 编排者重派并强调「立即执行」 |

### 门禁脚本增强（v4，2026-07-26 第 13 轮）

| 校验项 | 脚本 | 说明 |
|---|---|---|
| EISDIR 友好提示 | check-code-tla-consistency.ts / check-requirement-graph.ts | 传目录路径输出「参数应为文件路径，实际为目录」，退出码 2 |
| Maturity R3 单位对齐 | maturity-logic.ts | `completedCycles < Math.floor(completedPhases / 8)`，与"完整 8 阶段周期"语义对齐 |
| 反模式 #21 | anti-patterns.md | self-as-verifier 模式下不得跳过阶段 6/7 直接跑 `--phase=8` 终检 |
| TLA+ §14 时间推进建模 | tla-plus-guide.md | L4 时间推进/保留期建模模式（反例 + 正例 + 通用规则） |

### 门禁脚本增强（v5，2026-07-30 第 26 轮）

| 校验项 | 脚本 | 说明 |
|---|---|---|
| R13 单轴下限 | verifier-logic.ts / check-verifier-output.ts | `passed = (A\|\|B) && 所有 subCriterion.score ≥ 0.70`；违规格式「子标准 <name> 得分 <score> < 0.7（单轴下限，反模式 #41）」 |
| 反模式 #41 | anti-patterns.md | 加权平均掩盖单轴失败 → V 标记 violation + passed=false + reworkHints 交 S 返工（R→V→G 循环） |
| Fowler 12 基线 | engineering-code-reviewer.md | 12 条坏味道固定基线，评审命中须引用条目名（如「命中 F-01 重复代码」） |
| 票据 durability | phase-5-coding.md | 票据主体 = 符号级契约（接口/类型/状态转移），禁止文件路径+行号作为票据主体（位置交 codegraph 约束 #20） |
| glossary 术语表 | references/glossary.md | 15+ 术语权威入口（字段名 / 枚举 / `_Avoid_` 别名治理），新增字段前先查本表 |

### 只读报告脚本（第 31 轮，2026-08-05）

| 脚本 | 说明 |
|---|---|
| wm-status.ts | 状态快照（当前阶段/进度/RTM 覆盖/四级测试/最近动作/下一步建议）；只读，退出码 0/2 |
| metrics-report.ts | 流程度量报告（动作/角色/结果分布、返工、预算 burn rate、killSwitch 预警）；只读，退出码 0/2 |

## 命令一览

| 命令 | 说明 |
|---|---|
| `/wm analyze <需求描述>` | 需求分析，同步产出验收测试设计 |
| `/wm design type=<架构\|概要\|详细>` | 设计阶段，同步产出对应测试设计 |
| `/wm code <功能描述>` | 编码实现，同步产出单元测试用例（不自动标记通过） |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 回填指定类型测试真实执行结果 |
| `/wm review <目标ID或文件路径>` | 返回结构化评审指引（指向 `verifier-spec.md` + `check-verifier-output.ts`，不内置 LLM） |
| `/wm status` | 查看当前阶段、进度、RTM 覆盖率（脚本化，由 wm-status.ts 输出） |
| `/wm metrics` | 流程度量报告（动作/角色/结果分布、返工、预算 burn rate、killSwitch 预警） |
| `/wm help` | 显示帮助 |
| `/wm reset` | 重置项目（保留元信息，清空实体） |
| `/wm export [输出目录]` | 导出项目 JSON + RTM Markdown |
| `/wm import <文件路径>` | 从 JSON 导入项目 |

## 参考实现（已归档）

历史端到端调测归档（按时间倒序）：

- [`docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`](./docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/) — 第十九轮 W 模型 8 阶段端到端调测归档（7 文件），32 需求 / 231 测试全通过 / 1 完整 W 模型周期闭环 / 发现 check-bdd-model.ts D7 RTM schema bug
- [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/) — 第十五轮端到端调测归档（9 文件），32 需求 / 889 测试全通过 / 32 个流程问题修复

原 `w-model-dev-demo/` 目录已于第 17 轮 P6 删除，第十九轮调测重建后再次清理，归档已迁移至上述目录。

**端到端调测结论**（2026-07-24，全量删除后从零重跑第五轮，编排者-子代理分派模式，含代码-TLA+ 一致性回归）：

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
| 全量测试 | `npm test` → 8 test files / 135 tests 全通过（77 unit + 21 integration + 22 system + 15 acceptance） |
| 自检基线 | `npm run self-test` → 111/111 通过（18 Verifier + 13 Gate + 17 Graph + 14 TLA + 5 Budget + 7 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 11 RootCause + 15 Schema + 1 Metadata） |
| 用户确认 | `confirm`（self-as-verifier 模式，调测者代签；2026-07-24 全量重跑通过） |

> 第五轮（2026-07-24）相比第四轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/`/`dist/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，采用编排者-子代理分派模式（每阶段 S→V→G 子代理执行）。重跑产物为独立再实现，单元测试 53→77、覆盖率由 96.37% 提升至 99.37%（lines），集成测试 13→21、系统测试 8→22，验收测试 15 不变，全量测试 89→135。图谱节点 43→35（更精炼的 DD 拆分），边 182→141，零违反保持。TLA+ 规格 8 个（1 L1 + 4 L2 + 3 L3），层次化建模完整。阶段 5 新增代码-TLA+ 一致性回归门禁（`check-code-tla-consistency.ts` 四维度校验）。过程中修正了 check-artifact-gate.ts 缺 exitCode 字段的脚本缺陷。所有门禁退出码 0，未引入新缺陷。

**端到端调测结论**（2026-07-25，第八轮，扩展博客系统 25 需求，编排者-子代理分派 + self-as-verifier 自驱模式，**用户 confirm 归档**）：

| 指标 | 数值 |
|---|---|
| 范围 | 扩展博客系统后端（25 需求：17 REQ + 5 NFR + 3 CON） |
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

> 第八轮（2026-07-25）相比第五轮（已归档基线）：项目范围从基础博客扩展为 25 需求（新增站点管理/多博主/推荐/广告/统计/搜索/标签/分类/评论/通知/交叉引用/订阅/备份恢复 + 5 NFR + 3 CON），需求 5→25、DD 5→51、TLA+ 规格 8→17（新增 L4 层级 3 个）、图谱节点 35→216、边 141→902。全量测试 135→386（单元 77→226、集成 21→40、系统 22→64、验收 15→56）。采用 self-as-verifier 自驱模式 + 编排者-子代理分派。过程中修复 4 个源码 bug（push.service retry、article.store 副本、blogger.service 幂等、auth.service 预哈希）。所有门禁退出码 0。**用户已于 2026-07-25 在 acceptance-test-report.md §9 勾选 `confirm` 归档，project.json status=「项目完成」，rtm.json currentPhase=9，run-log.jsonl 追加 wm8-r012 归档 checkpoint 条目。**

**端到端调测结论**（2026-07-26，第十二轮，扩展博客系统 32 需求，编排者-子代理分派 + self-as-verifier 自驱模式，**调测者代签 confirm 归档**）：

| 指标 | 数值 |
|---|---|
| 范围 | 扩展博客系统后端，新增审计日志/RSS/Webhook/API 限流领域（32 需求 = 22 REQ + 6 NFR + 4 CON） |
| 设计 | 22 SD + 22 INTF + 75 DD |
| TLA+ 规格 | 22 个（1 L1 + 9 L2 + 7 L3 + 5 L4），SANY + TLC 零违反 |
| 图谱 | 155 节点 638 边，信息流零违反，EXT-IN/EXT-OUT 边界完整 |
| 源码 | 56 TS 文件（9 controllers + 15 services + 14 stores + 14 utils + app/server/types） |
| 单元测试 | 250/250 通过，代码覆盖率 93.63% lines（NFR-004 要求 ≥ 80%） |
| 集成测试 | 69/69 通过（44 契约 + 15 跨模块 + 10 异常） |
| 系统测试 | 25/25 通过（4 性能 + 3 可靠性 + 2 内存 + 5 安全 + 2 限流 + 3 E2E + 6 异常） |
| 验收测试 | 63/63 通过（覆盖 32 需求 × 正常+异常+边界） |
| 全量测试 | 407/407 通过（250 单元 + 69 集成 + 25 系统 + 63 验收） |
| 阶段门评审 | phase1=0.887/A、phase2=0.8915/A、phase3=0.9075/A、phase4=0.914/A、phase5=0.9115/A、phase6=0.9195/A、phase7=0.9095/A、phase8=0.9095/A |
| code-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 22/22 + 状态转移 67 + Next 分支 + 不变式断言） |
| 工件质量门 | check-artifact-gate 终检 exitCode=0，RTM 100%，missingItems=[] |
| 用户确认 | `confirm`（2026-07-26 self-as-verifier 模式调测者代签；currentPhase=9，project.json status=项目完成） |

> 第十二轮（2026-07-26）相比第八轮（25 需求）：项目范围从 25 需求扩展至 32 需求（新增审计日志 REQ-018/019 + RSS REQ-020 + Webhook REQ-021/022 + API 限流 NFR-006 + 审计日志保留 CON-004）。需求 25→32、SD 17→22、INTF 17→22、DD 51→75、TLA+ 17→22（L4 层级 3→5）、图谱节点 216→155（更精炼）、边 902→638。全量测试 386→407（单元 226→250、集成 40→69、系统 64→25、验收 56→63）。覆盖率 83.48%→93.63% lines。采用 self-as-verifier 自驱模式 + 编排者-子代理分派（每阶段独立 Task 子代理执行 S/V/G）。过程中修复 TLA+ L4 不变式违反（audit_log_retention AdvanceTime 越界）+ Verifier compositeScore 漂移（phase6 0.921→0.9195）+ RTM 映射遗漏（REQ-019/021 systemTest 缺失）+ Maturity R3 违反（completedCycles 6→7）。所有门禁退出码 0，调测者代签 confirm 归档，currentPhase=9，project.json status=项目完成。

过程中发现并修正的缺陷（累计 5 项）：

1. **Express 4 async handler 不自动捕获 rejected promise**（2026-07-20 首轮）：引入 `src/utils/async-handler.ts` 包装器。详见归档 [`test-report-snapshot.json`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/test-report-snapshot.json)。
2. **JWT_SECRET 缺失导致测试套件加载失败**（2026-07-21 回归发现）：`src/utils/env.ts` 在 import 阶段抛错连锁挂掉 4 个测试套件。修正方案：`package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入。
3. **ArticleService 类型导出消失**（2026-07-21 回归发现）：`comment-service.ts` 的 `import type { ArticleService }` 类型丢失。修正方案：恢复 `export class ArticleService`。
4. **vitest mock 与 express NextFunction 类型不兼容**（2026-07-21 回归发现）：`next.mock.calls[0][0]` 报 TS2339。修正方案：用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问。
5. **check-artifact-gate.ts 缺 exitCode 字段**（2026-07-24 第五轮发现）：唯一未在 `GATE_JSON` 输出中包含 `exitCode` 的门禁脚本，导致 `check-run-log.ts` R6 交叉校验无法提取退出码。修正方案：与其它 7 个 `check-*.ts` 脚本对齐，计算并输出 `exitCode`。

> 归档目录是参考实现，**不参与 `/wm` 命令编排**，也不会被 `check-*-gate.ts` 读取。Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时可指向 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./docs/changes/archive/2026-07-26-round15-end-to-end-test/)。

### 新门禁满足情况（2026-07-26 第十二轮）

第 12 轮 32 需求 demo 产物已通过 v2+v3+v4 全部门禁校验：
- `tla-manifest.json` 含 `basePath` 字段（v2）
- 所有 spec `requirementIds` 含 SD-xxx 标识（v2）
- Verifier 输出 passed↔qualityLevel 一致（v2）+ rawScores 自然波动（v3 防漂移）
- RTM.codeModule 列已回填（v2）+ 阶段 5 强制回填（v3）
- code-TLA 一致性四维度全通过（v2）+ Next 分支覆盖全部 specs（v3）
- 阶段 1 NFR/CON 字段在 RTM 注册（v3）
- check-artifact-gate 阶段级 `--phase=N` 全 8 阶段退出码 0（v3）
- TLA+ states 目录自动清理，无残留（v3）
- Maturity R3 单位对齐：completedCycles=7 ≥ floor(8/8)=1，不触发违反（v4）
- EISDIR 友好提示：参数错误时输出明确文案（v4）

## 项目结构

```
.
├── w-model-dev/                  # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
│   ├── SKILL.md                  # Skill 定义（YAML frontmatter + 编排 + 架构定位 + 核心操作行为）
│   ├── references/               # 阶段细则与规范（按需加载）
│   │   ├── phase-1-requirements.md … phase-8-acceptance-test.md
│   │   ├── anti-patterns.md      #   反例与黑名单（43 条流程反模式含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复 / #21 阶段级门禁跳过 / #22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON 文件 PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用 / #27 调测者简化行为 / #28 schema 前置校验缺失 / #29 BDD 建模与需求/设计/TLA+ 不符未回退 / #30 豁免审批跳步 / #31 归档完整性缺失 / #32 签名链断裂 / #33 跳过 R3 预防性审查 / #34 编排者漏派角色 / #35 self-as-verifier 产物混合 / #36 路由顺序错误 / #37 产物膨胀核心决策稀疏 / #38 修改前未查询 codegraph / #39 跳过 opsx 产物审查 / #40 opsx/S-tickets 职责混淆 / #41 加权平均掩盖单轴失败 / #42 S-fix / emergency-fix 后跳过 R3+V / #43 敏感信息写入状态文件/日志；#20 见 subagent-delegation.md + 实现层经验教训 L1~L4 + 失败模式清单 F1~F10）
│   │   ├── workflow.md           #   完整工作流程（流程图 + 阶段并行表 + 阶段门评审）
│   │   ├── verifier-spec.md      #   LLM-as-a-Verifier 评审规范（提示词 + Schema + 子标准 + 五轴评审 §7.4A）
│   │   ├── agent-personas.md     #   Agent Personas（4 个评审角色提示词：code-reviewer / test-engineer / security-auditor / performance-auditor）
│   │   ├── subagent-delegation.md#   编排者-子代理边界（O/A/S/V/G/R 六角色 + 分派模板 + 回填契约 + 反模式 #10/#11/#12/#13/#14/#15/#16/#17/#18/#19）
│   │   ├── root-cause-locator.md  #   R 根因定位者方法论（4 种方法 + 质量标准 + 多人格多角度分析）
│   │   ├── ingestion-chunk.md    #   A 子代理分块分析细则（阶段 1–4）
│   │   ├── ingestion-cross.md    #   A 子代理交叉合并与图谱演进细则（阶段 1–4）
│   │   ├── graph-guide.md        #   图谱门禁与收敛准则（check-requirement-graph.ts）
│   │   ├── tla-plus-guide.md     #   TLA+ 层次化状态机建模与行为门禁（check-tla-model.ts）
│   │   ├── definition-of-done.md #   项目级 Definition of Done（每次变更的日常标准，5 维度）
│   │   ├── data-models.md        #   项目 / 需求 / 设计 / 测试用例数据模型 + JSON Schema 强约束（19 份 draft-07）+ RunLogEntry vs EventIngress 边界对照表
│   │   ├── rtm-guide.md          #   RTM 维护规则
│   │   ├── operational-recovery.md  # 运维失败模式 O1~O6 + 调测者简化行为预防（反模式 #27 关联）+ JSON 文件写入工具选择（反模式 #25 关联）
│   │   ├── event-ingress-guide.md  # Loop 3 事件接驳（EventIngress schema + 路由表，L2+ 激活）
│   │   ├── hill-climbing-guide.md  # Loop 4 爬坡循环（HarnessImprovementReport schema + 信号检测）
│   │   ├── skillopt-adoption.md  #   SkillOpt 方法论吸收（bounded edit + validation gate）
│   │   ├── subagent-persona-matrix.md  # R-lead / V-lead 多角度 persona 选择矩阵（关联 subagent/ 28 个人格文件）
│   │   ├── command-reference.md  #   /wm 命令参考
│   │   ├── toolbox.md            #   工具箱决策表（I have X → use Z）
│   │   └── quality-standards.md #   质量标准
│   ├── subagent/                 # 28 个评审 persona Markdown 文件（engineering / testing / design / product / project 5 类，按需读取，不调用 LLM）
│   ├── schemas/                  # 19 份 JSON Schema (draft-07) 文件（verifier-output / rtm / project / budget / run-log / maturity / checkpoint-log / tla-manifest / graph / rootcause-report / hill-climbing-report / event-ingress / code-tla-manifest / bdd-manifest / coverage / exemption / signature-chain / preventive-review / design-contract）
│   ├── scripts/                  # 只做门禁 / 校验，不调用 LLM（自包含，依赖 tsx + devDeps：ajv / eslint-plugin-security 等）
│   │   ├── gate-logic.ts         #   工件质量门纯逻辑（单点事实源，含 TLA+ 资产 + SD→codeModule 终检 + 阶段级 `--phase=N`）
│   │   ├── check-artifact-gate.ts#   工件质量门 CLI（读 .w-model/rtm.json + graph.json + tla-manifest.json，支持 `--phase=N`）
│   │   ├── verifier-logic.ts     #   Verifier 输出校验纯逻辑（单点事实源，4 targetKind × 5 子标准 + rawScores 防漂移）
│   │   ├── check-verifier-output.ts  # Verifier 输出校验 CLI（防 Agent 输出漂移）
│   │   ├── graph-logic.ts        #   图谱结构门禁纯逻辑（单点事实源，阶段 1–4，含信息流校验：黑洞/奇迹/死模块/边界完整性）
│   │   ├── check-requirement-graph.ts  # 图谱结构门禁 CLI（连通/单根/父唯一/阶段追溯 + 信息流校验 + EISDIR 友好提示，退出码 0/1/2）
│   │   ├── tla-logic.ts          #   TLA+ 行为门禁纯逻辑（单点事实源，阶段 1–4，文件头/层次/拆解一致性校验 + states 自动清理）
│   │   ├── check-tla-model.ts    #   TLA+ 行为门禁 CLI（SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性 + `--keep-states`，退出码 0/1/2）
│   │   ├── code-tla-logic.ts     #   代码-TLA+ 一致性校验纯逻辑（单点事实源，阶段 5，四维度：SD→codeModule/状态转移/Next分支/不变式覆盖 + EISDIR 友好提示）
│   │   ├── check-code-tla-consistency.ts  # 代码-TLA+ 一致性回归 CLI（TypeScript Compiler API 解析 AST，退出码 0/1）
│   │   ├── budget-logic.ts       #   Budget 门禁纯逻辑（R1-R5 时效性/schema/onExceed/killSwitch/触发检测）
│   │   ├── check-budget.ts       #   Budget 门禁 CLI（`<budget.json> [--project=] [--run-log=] [--phase=N]`，退出码 0/1/2）
│   │   ├── run-log-logic.ts      #   Run-log 门禁纯逻辑（R1-R7 动作完整性/tokens/返工/决策/O越权/exitCode/时序）
│   │   ├── check-run-log.ts      #   Run-log 门禁 CLI（`<run-log.jsonl> [--gate-logs=] [--tla-manifest=]`，退出码 0/1/2）
│   │   ├── maturity-logic.ts     #   Maturity 门禁纯逻辑（R1-R5 schema/level/周期/history/降级；R3 单位对齐 `floor(completedPhases/8)`）
│   │   ├── check-maturity.ts     #   Maturity 门禁 CLI（`<maturity.json> [--project=] [--run-log=]`，退出码 0/1/2）
│   │   ├── checkpoint-logic.ts   #   Checkpoint 门禁纯逻辑（R1-R5 决策非空/内容具体/用户确认/阶段匹配/跨阶段一致）
│   │   ├── check-checkpoint.ts   #   Checkpoint 门禁 CLI（`<run-log.jsonl> [--checkpoint-log=]`，退出码 0/1/2）
│   │   ├── root-cause-logic.ts   #   RootCauseReport 校验纯逻辑（R1-R10 Schema 完整性/根因链/可证伪/修复建议/预防/上游缺陷/质量等级/报告 ID/多角度/reality-checker 置信度）
│   │   ├── check-rootcause-report.ts  # RootCauseReport 校验 CLI（`<report.json>`，退出码 0/1/2）
│   │   ├── schema-loader.ts      #   ajv 单例 + schemas/*.schema.json 自动加载 + validateBySchema 工具（被 10 个 *-logic.ts 顶部自动 import）
│   │   ├── security-scan.ts      #   eslint-plugin-security 扫描 + baseline v2 内容敏感指纹豁免（--regenerate 重生成）
│   │   ├── plan-chunks.ts        #   ingestion 分块策略（混合：文件/目录+超限拆分）
│   │   ├── wm-status.ts        #   状态快照 CLI（当前阶段/进度/RTM 覆盖/四级测试/最近动作/下一步建议，只读，退出码 0/2）
│   │   ├── wm-status-logic.ts  #   状态快照纯逻辑（buildStatusReport / STATUS_TO_PHASE）
│   │   ├── metrics-report.ts   #   流程度量报告 CLI（动作/角色/结果分布、返工、预算 burn rate、killSwitch 预警，只读，退出码 0/2）
│   │   ├── metrics-report-logic.ts  # 流程度量纯逻辑（computeMetrics）
│   │   ├── self-test.ts          #   校验逻辑自检（samples/ 驱动，回归基线 213 条）
│   │   ├── lib/cli-error.ts      #   exit 2 错误结构统一（6 类错误码 + CliError + exitWithError；人类消息 stderr + ERROR_JSON stdout）
│   │   ├── __tests__/            #   vitest 单元测试（28 个 .test.ts / 363 条 + README.md coverage 矩阵）
│   │   └── samples/              #   端到端样本（verifier/ + gate/ + graph/ + coverage/ + exemption/ + tla/ + tla-e2e/ + code-tla/ + budget/ + run-log/ + maturity/ + checkpoint/ + rootcause/ + bdd/）
│   ├── skill-metadata.json       # 版本号镜像（与 SKILL.md frontmatter `version` 双写，__tests__/skill-metadata.test.ts 回归校验）
│   ├── templates/                # 文档模板（需求 / 设计 / 测试 / RTM 等）
│   └── examples/                 # 交互示例（需求分析 / 系统设计 / 编码 / 测试执行）
├── docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/  # 第 19.0.1 轮 8 阶段调测归档（7 文件）
├── docs/changes/archive/2026-07-26-round15-end-to-end-test/  # 第 15 轮端到端调测归档摘要（9 文件）
├── docs/                         # 设计文档（统一存放）
│   ├── skill-design-document_SSoT.md           # 设计文档（单一事实来源）
│   ├── skill-design-document.md                # 设计文档指针（已废弃独立维护）
│   ├── llm-verifier-integration-design.md      # LLM Verifier 集成设计（指针文档）
│   └── INSTALL.md                              # AI Agent 安装指南
├── eval/                         # 外部工具（darwin-skill）评估产物归档，不属技能包
│   ├── w-model-dev-test-prompts.json           #   评估测试场景（3 个典型 / 歧义场景）
│   └── w-model-dev-results.tsv                 #   评估历史记录（得分轨迹）
├── .githooks/pre-push            # 本地推送前门禁（替代远程 CI，仅触及脚本 / package.json 时触发）
├── AGENTS.md                     # AI Agent 仓库导航（与 README 互补，聚焦 Agent 行动事实集）
├── package.json                  # 声明 tsx + devDeps（ajv / eslint-plugin-security 等）+ npm run 快捷脚本（private，不发布）
├── CHANGELOG.md                  # 变更日志
├── CONTRIBUTING.md               # 贡献指南
└── README.md                     # 项目导航
```

> 编排逻辑由 `w-model-dev/SKILL.md` 承载，Agent 读取后用自身工具执行；不内置任何
> TypeScript 引擎、npm 包或编程式 SDK。`/wm` 命令、状态持久化、RTM 维护均由 Agent
> 按 `SKILL.md` 与 `references/` 在项目内（`.w-model/*.json`）完成。
> 历史参考实现（`w-model-dev-demo/`）已于第 17 轮删除，归档摘要见 `docs/changes/archive/2026-07-26-round15-end-to-end-test/`，不参与 `/wm` 命令编排。

## 相关文档

- [设计文档（SSoT）](./docs/skill-design-document_SSoT.md) - 单一事实来源
- [Skill 定义](./w-model-dev/SKILL.md) - AI 助理触发命令与阶段流
- [LLM-as-a-Verifier 评审规范](./w-model-dev/references/verifier-spec.md) - 提示词 + Schema + 子标准 + 五轴评审 §7.4A
- [Agent Personas](./w-model-dev/references/agent-personas.md) - 4 个评审角色提示词（code-reviewer / test-engineer / security-auditor / performance-auditor）
- [反例与失败模式](./w-model-dev/references/anti-patterns.md) - 43 条流程反模式（含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复 / #21 阶段级门禁跳过 / #22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON 文件 PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用 / #27 调测者简化行为 / #28 schema 前置校验缺失 / #29 BDD 建模与需求/设计/TLA+ 不符未回退 / #30 豁免审批跳步 / #31 归档完整性缺失 / #32 签名链断裂 / #33 跳过 R3 预防性审查 / #34 编排者漏派角色 / #35 self-as-verifier 产物混合 / #36 路由顺序错误 / #37 产物膨胀核心决策稀疏 / #38 修改前未查询 codegraph / #39 跳过 opsx 产物审查 / #40 opsx/S-tickets 职责混淆 / #41 加权平均掩盖单轴失败 / #42 S-fix / emergency-fix 后跳过 R3+V / #43 敏感信息写入状态文件/日志；#20 见 [subagent-delegation.md](./w-model-dev/references/subagent-delegation.md)）+ L1~L4 实现层教训 + F1~F10 失败模式
- [编排者-子代理边界](./w-model-dev/references/subagent-delegation.md) - O/A/S/V/G/R 六角色 + 分派模板 + 回填契约 + 反模式 #10/#11/#12/#13/#14/#15/#16/#17/#18/#19
- [根因定位者方法论](./w-model-dev/references/root-cause-locator.md) - R 角色 4 种根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）+ 质量标准 + 多人格多角度分析
- [ingestion 子流程：分块分析](./w-model-dev/references/ingestion-chunk.md) - A 子代理分块分析细则（阶段 1–4）
- [ingestion 子流程：交叉合并与图谱演进](./w-model-dev/references/ingestion-cross.md) - A 子代理合并建图 + 收敛循环（阶段 1–4）
- [图谱门禁与收敛准则](./w-model-dev/references/graph-guide.md) - check-requirement-graph.ts 用法 + 收敛判定
- [TLA+ 层次化状态机建模](./w-model-dev/references/tla-plus-guide.md) - check-tla-model.ts 用法 + 层级模型 + 文件头规范 + SANY/TLC 门禁 + 命名规范 + 路径基准 + 前置清单
- [项目级 DoD](./w-model-dev/references/definition-of-done.md) - 每次变更的日常标准（5 维度）
- [采用路径指南](./docs/adoption-guide.md) - Greenfield vs Brownfield（SSoT §11A 为权威定义）
- [ingestion 与图谱收敛设计](./docs/ingestion-graph-convergence-design.md) - A 角色 / graph.json / check-requirement-graph.ts 权威设计文档
- [信息流校验设计](./docs/information-flow-validation-design.md) - 黑洞/奇迹/死模块门禁 + EXT-IN/EXT-OUT 边界节点 + 正交叠加设计
- [TLA+ 层次化建模设计](./docs/tla-plus-modeling-design.md) - L1–L6 层级模型 + 文件头规范 + SANY/TLC 门禁 + 拆解阈值权威设计文档
- [LLM Verifier 集成设计](./docs/llm-verifier-integration-design.md) - 指针文档
- [AI Agent 安装指南](./docs/INSTALL.md)
- [Agent 仓库导航](./AGENTS.md) - 面向 AI Agent 的最小事实集
- [参考实现归档（第 19.0.1 轮）](./docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/) - W 模型 8 阶段端到端调测归档（7 文件，32 需求 / 231 测试 / 1 完整周期）
- [参考实现归档（第 15 轮）](./docs/changes/archive/2026-07-26-round15-end-to-end-test/) - W 模型 8 阶段端到端调测归档摘要（9 文件）
- [变更日志](./CHANGELOG.md)
- [贡献指南](./CONTRIBUTING.md)

## License

MIT
