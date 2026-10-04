# 阶段多角色讨论分析机制 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 兑现规格——阶段 1-4 产出前的多角色讨论分析机制（阶段角色集矩阵 + A-lead 并行多轮交叉协议 + 机器门禁三维度 + 研制要求子模板 + 3 新 persona），以 42.11.0 收口。

**架构：** 文档机制（矩阵/协议/细则/模板）+ 门禁代码（run-log schema 先行 → role-dispatch 三新维度 → PHASE_SPEC_LAYOUT 同步与 fixtures 硬切）。讨论=分析动作（A-lead/persona），落笔=S 唯一，评审=V+覆盖核验参考项，判定=G 既有调用点。

**技术栈：** Markdown + TS 门禁脚本（vitest 单测；无新依赖）。

**规格（唯一权威）：** [docs/superpowers/specs/2026-10-03-phase-multi-role-analysis-design.md](../specs/2026-10-03-phase-multi-role-analysis-design.md)（9f44d04e + D9 修订 f63f8b5c，D1-D9 已裁定、用户已批准）。冲突时以规格为准。

**分支：** `feature/phase-multi-role-analysis` 自 main 开启（任务 0）。

---

## 事实核查（实施者必读的锚点与约束）

| # | 事实 | 锚点 |
|---|---|---|
| F1 | run-log `action` 枚举共 30 值（`run-log.schema.json:191` 起），A 类已有 `chunk`/`cross`/`evolve`；本批新增 `perspective`（A 子代理按 persona 视角分析，须含 `persona` 字段）与 `consensus`（A-lead 汇总/交叉轮/纪要，多轮逐轮记录）两值，description 逐动作罗列句追加；role 配对 `perspective`/`consensus`→A 加入 `run-log-logic.ts` 配对**强制**子集（与 r3-*/produce/review/gate 同族） | schema :186-200 与 :91 description |
| F2 | `role-dispatch-logic.ts` 结构：`checkRoleDispatch(entries)` 主函数 + `r3Missing` 明细 + `dimensionOf()`；**无 R 编号体系**；新增维度挂同函数，结果类型新增字段 `phaseRoleCoverage: Array<{ phase: number; missingPersonas: string[]; timingViolations: number; duplicatePersonas: string[] }>`，CLI JSON 同键透出；空/全无效 fail-closed 与 `--r3-enabled` no-op 既有语义零改动 | `role-dispatch-logic.ts:38-152` |
| F3 | `RoleDispatchEntry` 字段集（是否已含 timestamp/phase/outcome）**实现者实查**；时序判据用记录时间戳字段（`check-run-log.ts` R11 已用「严格早于」时序，时间戳可得） | 实查后对齐命名 |
| F4 | 阶段角色集并集 = 8 persona：阶段 1 六（requirements-analyst/product-manager/test-manager/software-architect/ux-architect/algorithm-expert）+ 阶段 2-4 七（+software-engineer=senior-developer、+database-optimizer，−requirements-analyst）；新 persona 3 份，既有复用 5 份 | 规格 §2 |
| F5 | 「10 种」活体计数面（42.11.0 后改 11 种）：`templates/README.md:3/:25`、`quality-standards.md:46/:249/:310`、`AGENTS.md` §1「阶段设计级产物」句与 §2 templates 行；SSoT 若有「10 种」grep 补齐；`docs/api/media/**` 为 gitignored 生成物**不管** | grep 实查清单 |
| F6 | 「33」persona 计数面（改 36，分类计数 engineering 16→17 / testing 8→9 / design 3 / product 4→5 / project 2）：`agent-personas.md:519/:581/:606/:614`、`AGENTS.md` §2 subagent 行 | 同上 |
| F7 | eval mappings 最大 id=64，新语料 id 65；L2 条目无 category/route；evidence 用 `{"type":"assertion"}` | `eval/mappings.json` 尾部 |
| F8 | **fixtures 硬切面**：phase-1 spec 布局消费点 = `grep -rln "system-context" w-model-dev/scripts/samples/` + `self-test.ts` 中 phase-1 布局/文档完整性断言 + `PHASE_SPEC_LAYOUT` 全部消费点（`grep -n "PHASE_SPEC_LAYOUT\|\.refs" w-model-dev/scripts/logic/gate-logic.ts` 及 import 方）；任务 4 首步实查并登记完整清单 | 实查指令 |
| F9 | 术语口径：约束口径（既有约束 #4/#9）vs 反模式口径（反模式 #10 编排者越权）；「知情声明」= 纯文档机制话术 | `hard-constraints.md` |
| F10 | **prettier 边界**：.md 不在 prettier 面，**禁止** `prettier --write` 任何 .md；.ts/.cjs/.json 改动受 prettier+tsc 门禁 | `.githooks/*` |
| F11 | 简报纪律：每份任务简报须携带本表相关行原文 + 显式收窄声明 | 批次 4 教训 |
| F12 | SSoT §10P 插入点 = §10O 节末 `---` 之后、`## 10.10` 之前（语义锚，行号实查）；§10A 表 §10O 行后 | SSoT |
| F13 | 版本七处现值 42.10.1（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / package-lock ×2）→ 42.11.0；`checkVersionConsistency` 强制 | 批次 4/5 先例 |
| F14 | dispatch-matrix 登记表现有行数**实现者实查**（规格称 22 模板基数，grep「22」未命中计数句）；新模板行追加后总数以实查为准 | `subagent-delegation.md` §6 |
| F15 | `check-role-dispatch` 调用点 = 阶段门放行三步之一（`SKILL.md` 阶段时序句 :88 邻域）——新维度自动承载，**不改调用点** | SKILL.md |

## 文件结构

| 文件 | 动作 | 职责 | 任务 |
|---|---|---|---|
| `w-model-dev/subagent/product-requirements-analyst.md` / `testing-test-manager.md` / `engineering-algorithm-expert.md` | 创建 | 3 新 persona（四字段契约） | 1 |
| `w-model-dev/references/agent-personas.md` | 修改 | 阶段角色集矩阵节 + 计数 33→36 | 1 |
| `AGENTS.md` | 修改 | §2 persona 计数 33→36 + §1 索引句 + §8 表行描述 | 1、6 |
| `w-model-dev/references/subagent-delegation.md` | 修改 | A-lead 定义 + 2 分派模板 + dispatch-matrix 行 | 2 |
| `w-model-dev/schemas/run-log.schema.json` | 修改 | persona 字段 + perspective/consensus 枚举（schema 先行） | 3 |
| `w-model-dev/scripts/logic/run-log-logic.ts` | 修改 | 配对强制子集 +2 | 3 |
| `w-model-dev/scripts/logic/role-dispatch-logic.ts` + `cli/check-role-dispatch.ts` | 修改 | 三新维度 + JSON 透出 | 3 |
| `w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts` + `self-test.ts` + `samples/run-log/*.jsonl` + `NEGATIVE-COVERAGE.md` | 修改/创建 | 单测 + CASES + fixtures + 登记 | 3 |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改 | PHASE_SPEC_LAYOUT phase1 refs +1 | 4 |
| `w-model-dev/templates/requirement-spec/development-requirements.md` + `templates/README.md` | 创建/修改 | 研制要求子模板 + 布局表 | 4 |
| `w-model-dev/scripts/samples/**`（phase-1 布局 fixtures） | 修改 | 硬切补齐 | 4 |
| `w-model-dev/references/phase-1-requirements.md` / `phase-2-system-design.md` / `phase-3-outline-design.md` / `phase-4-detailed-design.md` | 修改 | 「多角色讨论分析」节 + CHECKPOINT 行 | 5 |
| `w-model-dev/references/verifier-spec.md` / `command-reference.md` / `quality-standards.md` / `conventions.md` | 修改 | V 参考项 / CLI 条目 / 计数 11 种 / 术语 | 5 |
| `w-model-dev/SKILL.md` | 修改 | 阶段时序句 + 资源计数 | 6 |
| `docs/skill-design-document_SSoT.md` | 修改 | §10P + §10A 行 | 6 |
| `eval/mappings.json` + `eval/w-model-dev-test-prompts.json` | 修改 | id 65 | 6 |
| `CHANGELOG.md` + 版本七处 | 修改 | 42.11.0 | 7 |
| 本计划 | 修改 | 收尾记录 | 8 |

---

### 任务 0：开启实现分支

- [ ] `git checkout -b feature/phase-multi-role-analysis`（自 main，工作树干净）。

### 任务 1：3 新 persona + agent-personas 矩阵节 + persona 计数面

**文件：** 创建 3 persona；修改 `agent-personas.md`、`AGENTS.md`（§2）。

- [ ] **步骤 1：创建 3 persona（frontmatter 逐字 + 正文按给定要素撰写，每份 40-60 行，形态照 `engineering-security-engineer.md` 先例：角色定位段 / 核心职责 / 视角关注面 / 产出格式 / 边界声明）**

`product-requirements-analyst.md` frontmatter：
```yaml
---
name: 需求分析师（产品侧）
description: 专注需求分解、追溯与边界澄清的需求分析师，服务于软件研制项目的需求工程阶段，把模糊诉求改造为条目化、可验证、全链路可追溯的需求集合。
capabilities: 擅长：需求分解与层级化、需求条目化与可验证性改造（形容词→量化判据）、stakeholder 诉求冲突识别、需求追溯设计、In/Out of Scope 边界显式化；不擅长：算法选型与实现、UI 视觉稿、测试用例详细设计
inputs: 用户原始诉求、业务与合同约束、既有系统文档、前序阶段产物
outputs: 视角分析报告（发现/风险/约束建议/分歧点候选）、需求分解结构建议、追溯缺口清单
boundaries: 适用：阶段 1 多角色讨论分析与需求分解审视；换人：范围与优先级裁决换 product-manager，可测试性判据深化换 testing-test-manager，架构约束换 engineering-software-architect
---
```
正文必含四要素：① 角色定位（把「不可验证的形容词」当首要敌人；叶子条目须可独立验证）；② 核心职责（分解到底/可验证性改造/冲突显式化/追溯闭环）；③ **视角关注面节（多角色讨论）**——「需求分解与追溯完整性」，报告时逐答：分解是否到底？追溯是否闭环？边界是否显式？隐含需求（合规/安全/性能）是否遗漏？；④ 产出格式（视角分析报告四节：发现/风险/约束建议/分歧点候选——分歧点候选供 A-lead 交叉质询调度）。

`testing-test-manager.md` frontmatter：
```yaml
---
name: 测试经理（测试负责人）
description: 测试左移导向的测试经理，在需求与设计阶段即介入，定义可测试性约束与验收判据，规划分级测试策略与风险预案。
capabilities: 擅长：可测试性需求审查、验收判据定义（可量化/可复现）、测试分层策略（单元/集成/系统/验收）、测试风险与资源规划、回归面评估；不擅长：生产代码实现、数据库物理设计、算法调优
inputs: 需求条目/设计产物、历史缺陷数据、平台与环境约束、验收标准草案
outputs: 视角分析报告、可测试性约束清单、验收判据建议、测试风险登记建议
boundaries: 适用：阶段 1-4 多角色讨论分析（测试左移视角）；换人：测试用例执行细节换 testing-api-tester，性能基线换 testing-performance-benchmarker，无障碍换 testing-accessibility-auditor
---
```
正文四要素同构；视角关注面 =「可测试性与验收判据」（逐答：每条需求/设计是否可测？验收判据是否量化可复现？测试分层与回归面是否可行？风险项是否有预案？）。与 W 模型测试左移同源（阶段 1 产验收测试设计）须在角色定位段点明。

`engineering-algorithm-expert.md` frontmatter：
```yaml
---
name: 算法专家（算法工程）
description: 专注算法选型、复杂度与精度-性能权衡的算法专家，在需求与设计阶段评估算法可行性、数据需求与评测基准。
capabilities: 擅长：算法选型与备选对比、时空复杂度与精度-性能-成本权衡、训练/推理数据需求定义、评测基准与指标设计、算法风险（数据偏差/过拟合/边界退化）识别；不擅长：前端交互实现、基础设施运维、测试管理
inputs: 需求条目（功能/性能/精度）、数据资产盘点、算力与延迟约束、既有模型/文献基线
outputs: 视角分析报告、算法选型与权衡建议（含 ≥2 备选）、数据需求清单、评测指标建议
boundaries: 适用：阶段 1-4 多角色讨论分析（算法视角）与算法类设计评审参考；换人：AI 工程化落地换 engineering-ai-engineer，数据管道换 engineering-data-engineer，性能压测换 testing-performance-benchmarker
---
```
正文四要素同构；视角关注面 =「模型选型/复杂度/精度约束」（逐答：算法路径是否可行且有 ≥2 备选？复杂度/延迟/算力是否满足量化指标？数据需求是否明确可获得？评测基准是否可复现？）。

- [ ] **步骤 2：`agent-personas.md` 追加「阶段角色集矩阵（A-lead 多视角分析）」节**（插在 V-lead 多角度矩阵节之后；全文照写规格 §2 两张表 + 以下三段）：

```markdown
> **与 R/V 矩阵划界**：R-persona 两键矩阵服务根因定位（`rootCause.category` + 风险域），V-lead 多角度矩阵服务评审，本矩阵**只服务 A-lead 阶段产出前分析**——三者互不替代、互不复用选择判据。
> **协议摘要**：O 派单 A-lead → 并行分派 N persona 视角分析（`action=perspective`、`persona` 字段留痕）→ 汇总分歧 → 并行多轮交叉直到收敛（单轮零新增分歧 ∧ 全部分歧已决或登记迷雾册；5 轮安全阀升级 🔴 CHECKPOINT）→ 共识纪要（含实际轮次）→ S 依纪要产出。分派契约与纪要形态见 [subagent-delegation.md](subagent-delegation.md)「A-lead 多视角分析」节。
> **lite 降级**：L0/L1 成熟度或用户显式 `--lite` 时允许单视角（需求阶段=需求分析师；设计阶段=系统架构师），纪要注明降级；门禁按实际 N 校验（`check-role-dispatch` phaseRoleCoverage 维度），不冒充全矩阵。
```

- [ ] **步骤 3：计数面 33→36**（F6 四处逐处改 + 分类计数 16→17/8→9/4→5；`:606` 历史句追加「2026-10-03 多角色机制扩充 3 份：需求分析师/测试经理/算法专家」）；`AGENTS.md` §2 subagent 行 33→36。

- [ ] **步骤 4：验证**——`npm run check:docs-consistency` exit 0（persona-capability-declarations 覆盖 3 新文件）；`ls w-model-dev/subagent/*.md | wc -l` = 36。

- [ ] **步骤 5：Commit** `git add w-model-dev/subagent/ w-model-dev/references/agent-personas.md AGENTS.md && git commit -m "feat(multi-role): 3 新 persona（需求分析师/测试经理/算法专家）+ agent-personas 阶段角色集矩阵节 + 计数 33→36"`

### 任务 2：subagent-delegation 接线（A-lead + 2 分派模板 + dispatch-matrix）

**文件：** 修改 `w-model-dev/references/subagent-delegation.md`。

- [ ] **步骤 1：A-lead 定义**——角色边界表 A 行后追加 A-lead 小节（全文照写）：

```markdown
### A-lead（多视角分析协调者，A 类 lead 变体）

- **定位**：阶段 1-4 产出前的多角色讨论协调者——按 [agent-personas.md](agent-personas.md)「阶段角色集矩阵」分派 N 个 persona 视角分析、汇总分歧、调度并行多轮交叉质询、产出共识纪要。**属 A 类分析动作**：A-lead 与 persona 子代理均不产出阶段交付物、不改迷雾册（未决分歧的登记义务在 S 产出侧）、不跑门禁。
- **派单契约（O → A-lead，两段）**：前置条件 = 阶段角色集矩阵节与 N 份 persona 文件实存 + 前阶段产物就绪 + `phase-analyses/phase-<N>/` 目录可写；可验证终态 = `.w-model/phase-analyses/phase-<N>/consensus-minutes.md` 落盘（含每分歧决议/迷雾去向与实际交叉轮次）+ run-log 含 N 条 `action=perspective`（persona 非空互异）与 ≥1 条 `action=consensus`，第三方可复核。
- **升级路径**：交叉 5 轮未收敛 → A-lead 停止并上报 O → 🔴 CHECKPOINT（加轮 / 未决项全登记迷雾册收口 / 终止阶段）——升级单调性同分层反馈回路。
```

- [ ] **步骤 2：视角分析分派模板（A-lead → A persona）**——插在既有分派模板区（dispatch-matrix 邻近），按既有模板形态（上下文/输入/产出契约/两段契约），含：输入=前阶段产物路径+视角关注面（矩阵行逐字）+ 共识纪要当前版（交叉轮时）；产出=`.w-model/phase-analyses/phase-<N>/<persona>.md` 四节报告；前置条件=persona 文件实存+输入路径实存；可验证终态=报告四节齐备落盘+run-log `action=perspective, persona=<id>` 记录。

- [ ] **步骤 3：dispatch-matrix 登记行**（F14 实查基数后）追加两行：A-lead（阶段 1-4，动作 perspective/consensus 调度）、A persona 视角分析（阶段 1-4，动作 perspective）。

- [ ] **步骤 4：验证**——`npm run check:docs-consistency` exit 0；grep 矩阵节/两模板/登记行齐备。

- [ ] **步骤 5：Commit** `git commit -m "feat(multi-role): subagent-delegation——A-lead 定义与派单契约 + 视角分析分派模板 + dispatch-matrix 登记"`

### 任务 3：schema 先行 + 门禁三维度 + 测试与样本（代码任务）

**文件：** schema / run-log-logic / role-dispatch-logic / check-role-dispatch CLI / 单测 / self-test / samples / NEGATIVE-COVERAGE。

- [ ] **步骤 1：schema（先改 schema 再动 logic，F1）**——`run-log.schema.json`：① 根 properties 增 `"persona": { "type": "string", "description": "多视角分析的 persona 标识（action=perspective/consensus 时须非空；取值=agent-personas 阶段角色集矩阵 persona id）；其他 action 不得出现（role-dispatch logic 校验）" }`；② action 枚举追加 `"perspective"`, `"consensus"` 两值 + description 句尾追加「perspective=A 子代理按阶段角色集矩阵 persona 视角分析（须含 persona 字段，阶段1-4 多角色机制）；consensus=A-lead 汇总分歧/交叉轮调度/共识纪要（多轮逐轮记录，须含 persona=A-lead 形态的 persona 字段或空——以 role=A 判定）」（description 措辞实现者按枚举 description 行文风格微调，语义不变）。

- [ ] **步骤 2：`run-log-logic.ts` 配对强制子集**——perspective/consensus→A 加入既有配对强制族（与 r3-*/produce/review/gate 同形态，一处数组/映射追加）。

- [ ] **步骤 3：`role-dispatch-logic.ts` 三新维度**（F2/F3）——`checkRoleDispatch` 内对 phase 1-4：① **覆盖**：`action=perspective` 且 persona 非空记录的 persona 集合 ⊇ 该阶段矩阵 persona 集（矩阵常量表硬编码于 logic 层并注明权威=agent-personas 矩阵节；lite 形态=阶段存在 `action=consensus` 记录含 `lite` 标记（纪要路径或 note 含 `phase-role-lite`）时按实际 N 通过）；缺 → `missingPersonas`；② **时序**：本阶段 `action=produce` 记录时间戳须严格晚于全部 perspective 记录（同秒不算晚）；违 → `timingViolations` 计数；③ **互异**：同阶段 persona 重复 → `duplicatePersonas`。无 phase 1-4 produce 记录的阶段不触发（历史 run 零回归，规格风险 4 判据）。结果字段 `phaseRoleCoverage`（F2 形态），CLI stdout JSON 同键透出。

- [ ] **步骤 4：单测（表驱动）**——用例至少：valid 全矩阵 / 缺 persona / 时序倒置 / persona 重复 / lite 降级 / 阶段 5-8 run 不触发（零回归）/ 空输入 fail-closed 既有行为 / schema bad-additional-props 不回归。**先写失败测试再实现（TDD）**。

- [ ] **步骤 5：self-test CASES（+≥3）+ samples 3 fixtures（`samples/run-log/valid-phase-role.jsonl` / `bad-phase-role-missing-persona.jsonl` / `bad-phase-role-timing.jsonl`——字段形态照既有 run-log samples）+ `NEGATIVE-COVERAGE.md` 登记行 + `samples/README.md` 矩阵行（如有 run-log 分节）**。

- [ ] **步骤 6：验证**——`npx vitest run --config config/vitest.config.ts role-dispatch run-log`（相关文件全绿）；`npm run check:docs-consistency` exit 0。

- [ ] **步骤 7：Commit** `git commit -m "feat(multi-role): run-log schema persona+perspective/consensus 先行，check-role-dispatch 三新维度（覆盖/时序/互异）+ 单测/CASES/fixtures/NEGATIVE-COVERAGE 全套登记"`

### 任务 4：研制要求子模板 + PHASE_SPEC_LAYOUT + fixtures 硬切（最大回归面）

**文件：** gate-logic.ts / 新模板 / templates/README / samples 硬切 / 计数面（F5）。

- [ ] **步骤 1：实查消费点清单（F8）并登记**——`grep -n "PHASE_SPEC_LAYOUT" w-model-dev/scripts/logic/gate-logic.ts`（定义+消费）、`grep -rln "system-context" w-model-dev/scripts/samples/ w-model-dev/scripts/__tests__/ w-model-dev/scripts/self-test.ts`（phase-1 布局 fixture 面）、check-requirement-graph `--spec-dir` 校验的样本面。

- [ ] **步骤 2：创建 `templates/requirement-spec/development-requirements.md`**（研制要求子模板，全文结构）：

```markdown
# 研制要求（Development Requirements）

> 本文档登记项目顶层技术要求（GJB 语境研制要求条目化），由阶段 1 多角色讨论共识纪要承载产出；逐条须追溯 ≥1 REQ，经 V 评审核验追溯实指。
> 填写规则：① 条目 ID `DEVREQ-<NNN>` 全文唯一；② 类别六类枚举（功能/性能/接口/环境/安全性/约束）；③ 量化指标须可验证（禁止不可测形容词）；④ 验证方法须指明验证层级（单元/集成/系统/验收）与判据；⑤ 追溯 REQ id 须存在于需求规格书（V 抽查实指）。

## 1. 研制要求条目表

| 要求 ID | 类别 | 要求描述 | 量化指标 | 验证方法 | 追溯 REQ |
|---|---|---|---|---|---|
| DEVREQ-001 |  |  |  |  |  |

## 2. 本阶段无研制要求项标记

（阶段无条目时保留本标记行并删除条目表数据行；二者互斥）
```

- [ ] **步骤 3：`gate-logic.ts` PHASE_SPEC_LAYOUT phase 1 `refs` 追加 `'development-requirements.md'`**（数组尾）；`templates/README.md` 布局表阶段 1 子模板列 +2 处「10 种→11 种」+ 子模板用途表追加行（研制要求——顶层技术要求条目化，逐条追溯 REQ）。

- [ ] **步骤 4：存量硬切（F8 清单逐项）**——全部 phase-1 spec 布局相关 valid fixtures 补研制要求引用块与文件（沿用模板条目表形态，≥1 条目或「无研制要求项」标记）；bad fixtures 若因缺新子模板而意外转红须同步修；`quality-standards.md` :46/:249/:310 与 `AGENTS.md` 两处「10 种」→「11 种」。

- [ ] **步骤 5：验证**——`npx tsx w-model-dev/scripts/self-test.ts` 全绿；`npx vitest run --config config/vitest.config.ts`（全量——布局常量波及面大，本任务必须全量）；`npm run check:docs-consistency` exit 0。

- [ ] **步骤 6：Commit** `git commit -m "feat(multi-role): 研制要求子模板（DEVREQ 条目化，追溯 REQ）+ PHASE_SPEC_LAYOUT phase1 refs 同步 + 存量 fixtures 硬切 + 10 种→11 种计数面"`

### 任务 5：四阶段细则接线 + V 参考项 + command-reference/conventions

**文件：** phase-1/2/3/4 细则、verifier-spec、command-reference、conventions、quality-standards（如任务 4 未覆盖处）。

- [ ] **步骤 1：四阶段细则各加「多角色讨论分析（阶段角色集矩阵）」节**（插在 O 路由节后、S 产出节前）。phase-1 节全文（阶段 1 形态）：

```markdown
### 多角色讨论分析（阶段角色集矩阵，批次 multi-role）

- **时序**：O 路由确认后、S 产出派单前——O 派单 A-lead（[subagent-delegation.md](subagent-delegation.md)「A-lead」节契约两段）→ 并行分派 6 persona 视角分析（矩阵行：需求分析师/产品经理/测试经理/系统架构师/UX 专家/算法专家）→ 汇总分歧 → 并行多轮交叉直到收敛（单轮零新增分歧 ∧ 全部分歧已决或登记迷雾册；5 轮安全阀 → 🔴 CHECKPOINT）→ 共识纪要 → S 依纪要产出（派单前置条件=纪要实存且 N 视角齐备）。
- **分歧出口**：未决分歧由 S 产出时登记入本阶段迷雾登记册（[phase-1-requirements.md](phase-1-requirements.md)「迷雾登记册」节）；A-lead 与 persona 不改迷雾册。
- **门禁**：阶段门 `check-role-dispatch` 含 `phaseRoleCoverage` 维度（覆盖/时序/互异，exit 1 阻断放行）；run-log 须有 `perspective`×N + `consensus`≥1 + `produce` 晚于全部 perspective。
- **lite**：L0/L1 或用户显式 `--lite` → 单视角（需求分析师）+ 纪要注明降级；门禁按实际 N。
```

phase-2/3/4 节与上同构，差异逐字替换：阶段角色集行（阶段 2/3：测试经理/系统架构师/软件工程师/产品经理/数据库专家/UX 专家/算法专家；阶段 4 顺序 UX 在数据库专家前——矩阵行以 agent-personas 矩阵节为准逐字抄）+ 引用细则文件自引用名 + 迷雾册引用改「本阶段设计期迷雾登记册」。**四节中矩阵 persona 顺序不得手写自由发挥，一律注明「以 agent-personas.md 矩阵节为准」。**

- [ ] **步骤 2：CHECKPOINT 验收清单行**——四阶段阶段门 CHECKPOINT 验收清单各追加「`check-role-dispatch` exit 0（含 `phaseRoleCoverage` 维度）」。

- [ ] **步骤 3：verifier-spec 参考项**——需求评审节与设计评审节各追加一句（仿 TLA+ 清单句式）：「阶段 1-4 评审额外参考 [agent-personas.md](agent-personas.md)『阶段角色集矩阵』——核验共识纪要 N 视角关注面在产出中的承接（缺任一关注面承接 → 对应子标准降分依据；非独立门禁，不新增子标准名与权重）」。

- [ ] **步骤 4：command-reference**——`check-role-dispatch.ts` 条目更新（新维度三行语义 + `phaseRoleCoverage` JSON 键）；`conventions.md` 术语表追加条目：阶段角色集矩阵 / A-lead / perspective / consensus / 共识纪要（单行形态照既有条目）。

- [ ] **步骤 5：验证 + Commit**——`npm run check:docs-consistency` exit 0；`git commit -m "feat(multi-role): 四阶段细则多角色讨论分析节 + CHECKPOINT 门禁行 + verifier-spec 覆盖核验参考项 + command-reference/conventions 登记"`

### 任务 6：SKILL.md + SSoT §10P + eval id 65

**文件：** SKILL.md / SSoT / eval 两文件 / AGENTS.md §1。

- [ ] **步骤 1：SKILL.md**——阶段时序句（:88 邻域「每阶段时序」）在「O 路由 → 🔴 CHECKPOINT 进入确认 →」之后插入「多角色讨论分析（阶段 1-4，A-lead 并行多轮交叉，见 references/agent-personas.md 阶段角色集矩阵）→」；按需加载行（:138 邻域）追加「多角色讨论 → agent-personas.md 阶段角色集矩阵节」。
- [ ] **步骤 2：SSoT**——§10P 新节（F12 插入点，四件套形态：目标段 + 落点表〔矩阵/persona×3/协议/门禁三维度/研制要求/V 参考项 6 行〕+ 能力分工不夸大〔讨论=分析动作、S 唯一落笔、收敛判据为主 5 轮为安全阀、lite 不冒充全矩阵〕+ 判据披露〔D1-D9 摘要 + 用户角色集逐字来源声明〕）+ §10A 表 §10O 行后加 §10P 行。
- [ ] **步骤 3：eval id 65**——mappings 追加 L2 条目（prompt=「阶段产出直接派单 S 没有多角色讨论分析」→ contains agent-personas.md「阶段角色集矩阵」；description 同步计数 64→65）+ prompts 文件同步；`npm run eval` 全绿。
- [ ] **步骤 4：AGENTS.md §1**——机制索引追加一句（阶段 1-4 多角色讨论分析：矩阵+协议+门禁三维度，见 agent-personas/subagent-delegation/SSoT §10P）；§8 表 check-role-dispatch 行描述补「含 phaseRoleCoverage 维度」。
- [ ] **步骤 5：验证 + Commit**——`npm run check:docs-consistency` + `npm run eval` exit 0；`git commit -m "feat(multi-role): SKILL 时序句 + SSoT §10P 权威节 + eval id 65 + AGENTS 索引"`

### 任务 7：CHANGELOG 42.11.0 + 版本七处

- [ ] **步骤 1：CHANGELOG 头部插入条目**（全文）：

```markdown
## [42.11.0] - 2026-10-03

### 阶段多角色讨论分析机制（用户规范模型吸收；独立立项，规格 D1-D9）

- **阶段角色集矩阵（agent-personas 新节）**：阶段 1 六角色 / 阶段 2+3 与 4 七角色（用户角色集逐字），映射 5 既有 persona + 3 新增（`product-requirements-analyst` / `testing-test-manager` / `engineering-algorithm-expert`）；与 R/V 矩阵三分划界。persona 库 33→36。
- **A-lead 并行多轮交叉协议**：O 派单 → 并行 N persona 视角分析 → 汇总分歧 → 并行多轮交叉直到收敛（单轮零新增分歧 ∧ 全部分歧已决/入迷雾册；5 轮安全阀升级 🔴 CHECKPOINT）→ 共识纪要 → S 依纪要产出（落笔唯一性不变）；未决分歧登记既有迷雾登记册（零新通道）；lite 降级形态。
- **机器门禁**：run-log schema 先行（`persona` 字段 + `perspective`/`consensus` 动作）；`check-role-dispatch` 三新维度（覆盖/时序/互异，`phaseRoleCoverage` 键，fail-closed）；脚本数 48 不变。
- **研制要求子模板**：阶段 1 第 7 个子模板（DEVREQ 条目化，六类枚举，逐条追溯 REQ）；`PHASE_SPEC_LAYOUT` 同步 + 存量 fixtures 硬切；子模板 10 种→11 种。
- **登记面**：四阶段细则节 + CHECKPOINT 行 + verifier-spec 参考项 + SSoT §10P/§10A + eval id 65 + 全部计数面。
- prepush 19 项全绿（终值由收口任务回填）。
```

- [ ] **步骤 2：版本七处 42.10.1→42.11.0**（F13；先 grep 实查逐处，手工同步，不靠 npm install 改 version）→ `npm run check:docs-consistency` exit 0。
- [ ] **步骤 3：Commit** `git commit -m "chore(release): 42.11.0——多角色机制收口版本同步"`

### 任务 8：prepush 收口 + DoD + 收尾记录

- [ ] **步骤 1：全量 prepush**（后台 + 240s 轮询防超时：log/exit/时间戳文件落 `.superpowers/sdd/.../`）。预期 19/19；失败先修再重跑。
- [ ] **步骤 2：DoD grep**（规格 §8）：矩阵节/persona 36/三维度单测与 self-test 实证/研制要求模板+PHASE_SPEC_LAYOUT+硬切零红/四细则节/verifier 参考项/SSoT §10P/计数面全同步/eval id 65——逐条留证据。
- [ ] **步骤 3：终值回填**——本计划收尾记录（提交清单/prepush 终值/DoD 结果）+ CHANGELOG「终值由收口任务回填」替换实测 + 提交。
- [ ] **步骤 4：汇报待合并指示。**

---

## 收尾记录（任务 8 回填）

- **prepush 终值（钩子自报口径）**：19/19 全绿，exit 0，总耗时 **2655s**（2026-10-04 03:23:13 → 04:07:30 +0800，对 9555b9be 实测；wall-clock 文件差 2657s）。全三轮记录：
  - 首轮（对 c66e8e26）：18/19，exit 1，1999s——唯一失败 security-scan（`role-dispatch-logic.ts:295` 新增 `detect-object-injection` 风险）→ 任务 3 实现者以 9555b9be 定点豁免修复（复审 ADDRESSED）。
  - 二轮（对 9555b9be）：17/19，exit 1，2976s——vitest + prettier 双失败，经单跑定性为**环境性**（两树仅差 1 行注释：prettier 单跑 exit 0；全量 vitest 单跑至 480+ 用例全绿零失败后终止释放机器）。
  - 三轮（对 9555b9be）：**19/19 全绿，2655s（终值）**——含 security-scan ✓ 44s / vitest 全量+coverage ✓ 2626s / prettier ✓ 46s / docs-consistency ✓ / 覆盖口径 ✓。
- **分支提交清单**（`git log --oneline main..HEAD`，13 提交 9f44d04e..9555b9be：规格 2 + 计划 1 + vendor 源料 1 + 实现 8 + 修复 1；另有本收口回填 docs-only 提交不入列）：
  - 9555b9be fix(multi-role): task3-fix——role-dispatch 矩阵查表定点 security 豁免（detect-object-injection 误报，phase 经 schema 整数校验）
  - c66e8e26 chore(release): 42.11.0——多角色机制收口版本同步
  - 5831fb01 feat(multi-role): SKILL 时序句 + SSoT §10P 权威节 + eval id 65 + AGENTS 索引 + 计数面全同步（hard-constraints 32 值等）
  - 5a2578e5 feat(multi-role): 四阶段细则多角色讨论分析节 + CHECKPOINT 门禁行 + verifier-spec 覆盖核验参考项 + command-reference/conventions 登记
  - 67376c43 feat(multi-role): 研制要求子模板（DEVREQ 条目化，追溯 REQ）+ PHASE_SPEC_LAYOUT phase1 refs 同步 + 存量 fixtures 硬切 + 10 种→11 种计数面
  - 5bfeecfc feat(multi-role): run-log schema persona+perspective/consensus 先行，check-role-dispatch 三新维度（覆盖/时序/互异）+ 单测/CASES/fixtures/NEGATIVE-COVERAGE 全套登记
  - af732c68 feat(multi-role): subagent-delegation——A-lead 定义与派单契约 + 视角分析分派模板 + dispatch-matrix 登记
  - 2ec37b8a docs(multi-role): task1-fix——agent-personas 速查表 33→36 补齐（审查 Important）
  - c33802dc feat(multi-role): 3 新 persona（需求分析师/测试经理/算法专家）+ agent-personas 阶段角色集矩阵节 + 计数 33→36
  - dc8c7da2 docs(sources): vendor agency-agents-zh 8 份角色源料（MIT，commit 811e51c3）——多角色机制 3 persona 改编源，含提取映射与改编义务 README
  - 25e4c19d docs(plan): 多角色机制实现计划——8 任务，F1-F15 事实核查表
  - f63f8b5c docs(spec): D9 追加裁定——交叉质询改并行多轮交叉直到收敛，5 轮安全阀升级 CHECKPOINT
  - 9f44d04e docs(spec): 阶段多角色讨论分析机制设计规格——D1-D8 已裁定，独立立项待审查
- **DoD 逐条结果**（规格 §8，grep 留证，全部通过）：
  - ① 矩阵节 + 36 persona：`agent-personas.md`「### 3A. 阶段角色集矩阵（A-lead 多视角分析）」；`w-model-dev/subagent/*.md` 计数 = 36。
  - ② 三维度实证：任务 3 报告数据（15 新增用例 / `ROLE_DISPATCH_CASES` 3→6 / 3 fixtures + NEGATIVE-COVERAGE 登记 / 393 fixtures 闭环 / CLI 同键透出 `phaseRoleCoverage`）；收口另跑 `role-dispatch-logic.test.ts` 20/20 passed；全量 vitest ✓。
  - ③ 研制要求模板 + PHASE_SPEC_LAYOUT + 硬切零红：`development-requirements.md` DEVREQ 头注（多角色共识纪要承载）；`gate-logic.ts` `PHASE_SPEC_LAYOUT[1].refs` 含 `development-requirements.md`；self-test / 全量 vitest / samples 覆盖矩阵全绿（prepush 三轮覆盖）。
  - ④ 四细则节 + CHECKPOINT 行：phase-1:42 / phase-2:10 / phase-3:10 / phase-4:10 各有「## 多角色讨论分析（阶段角色集矩阵，批次 multi-role）」节，节内各含「5 轮安全阀 → 🔴 CHECKPOINT」。
  - ⑤ verifier 参考项 + SSoT：`verifier-spec.md:571`/`:615` 两处『阶段角色集矩阵』核验参考；SSoT §10P 节 + §10A 追溯表 §10P 行。
  - ⑥ 计数面残留：`33 个/33 人格/33 份/30 值` 零残留；「10 种」3 处均为合法口径（`subagent-delegation.md:41` S 变体；SSoT 迁移表述「10 种→11 种」两处）。
  - ⑦ 版本七处 42.11.0：package.json / CHANGELOG / docs/INSTALL.md / README.md / skill-metadata.json / SKILL.md / SSoT D8 判据披露，docs-consistency 全绿。
- **SSoT §10P 版本行核对**：收口期间版本号未改号，§10P D8「独立立项（版本 42.11.0）」与实况一致 → 零改动。
- **总纲核验**：总纲（absorption-batches-master-outline）§5 为五批次专属登记表，无独立机制登记位；§4.4「五批次吸收计划全部收官」与本机制无关且仍准确 → 不改总纲。
