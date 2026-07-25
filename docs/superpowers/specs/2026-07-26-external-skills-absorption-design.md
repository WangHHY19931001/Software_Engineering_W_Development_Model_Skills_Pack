# 外部技能吸收设计：to-tickets / to-spec / OpenSpec

> **设计日期**：2026-07-26
> **吸收源**：
> - [mattpocock/skills · to-tickets](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md)
> - [mattpocock/skills · to-spec](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)
> - [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
> **吸收策略**：阶段内强化（纯文档）
> **权威定义**：本文件为吸收设计 spec；落地后以 `docs/skill-design-document_SSoT.md` §3.4.8 / §4A / §11A + 各 `phase-N-*.md` 新增节为权威定义。

---

## 1. 背景与目标

### 1.1 背景

w-model-dev 现有 8 阶段主流程 + ingestion 子流程 + TLA+ 行为门禁 + RTM 追溯已稳定（第 9 轮门禁与流程细化已完成，self-test 91 条通过）。但与社区成熟的 spec-driven 工程技能对比，仍有可强化的方法论缺口：

- **to-tickets**：tracer-bullet 垂直切片（贯穿全层可独立 demo）、blocking edges 依赖图、wide refactor expand-contract 模式、避免具体文件路径
- **to-spec**：seam-first testing（用最高 seam、理想一个）、User Stories 长列表、Out of Scope 显式声明、Implementation/Testing Decisions 分离
- **OpenSpec**：四产物结构（proposal + specs + design + tasks）、brownfield 优先、fluid not rigid、archive 机制、context hygiene

### 1.2 目标

把三源精华融入 w-model-dev 现有 8 阶段流程，**不新增子流程、不新增脚本、不新增并行轨**。方法论由 S 子代理按文档执行，编排者与 G 子代理不变。

### 1.3 非目标

- 不替换 W 模型 8 阶段主流程
- 不新增 check-tickets.ts 等门禁脚本
- 不改 self-test 基线（91 条不变）
- 不改 verifier-spec.md（5 轴 + 5 targetKind 不变）
- 不改 subagent-delegation.md（O-S-V-G-R 边界不变）
- 不改 anti-patterns.md（19 条反模式不变）
- 不改 demo（w-model-dev-demo/ 已归档，不补建新节产物）

---

## 2. 吸收决策

### 2.1 落地策略：阶段内强化

| 选项 | 选定 | 理由 |
|---|---|---|
| 阶段内强化 | ✅ | 与"编排者最小化"约束最契合，不新增子流程脚本，方法论由 S 子代理按文档执行 |
| 新增子流程 | ✗ | 新增 references/tickets-decomposition.md + check-tickets.ts，改动范围大 |
| 双轨制 | ✗ | 保留 8 阶段 + 新增 OpenSpec 轻量轨，复杂度高 |
| 全量融合 | ✗ | 改动范围最大，与最小化原则冲突 |

### 2.2 吸收深度：纯文档

| 选项 | 选定 | 理由 |
|---|---|---|
| 纯文档 | ✅ | 不破坏现有 self-test 基线（91 条），不新增脚本，G 子代理既有职责不变 |
| 文档 + 可选脚本 | ✗ | 新增 check-tickets.ts 不进 self-test，但仍需维护脚本 |
| 强门禁 | ✗ | 改 check-artifact-gate.ts 加票据维度，破坏 self-test 基线 |

### 2.3 Brownfield 适配：补充 adoption-guide

| 选项 | 选定 | 理由 |
|---|---|---|
| 补充 adoption-guide | ✅ | 不改阶段主流程，brownfield 路径作为 SSoT §11A 子节，与 greenfield 并列 |
| 阶段 1 加分支 | ✗ | 改 phase-1-requirements.md 主流程，greenfield/brownfield 分支增加复杂度 |
| 本轮不做 | ✗ | OpenSpec brownfield 理念是核心吸收点之一，不做留下轮增加范围不确定性 |

---

## 3. 总体架构与改动清单

### 3.1 改动文件清单（10 个）

| # | 文件 | 改动类型 | 改动内容摘要 |
|---|---|---|---|
| 1 | `docs/skill-design-document_SSoT.md` | 修订 | §3.4 编排者-子代理边界补「S-doc 内含票据拆解」；§4A 操作行为表第 7 行补「seam-first 决策」；§11A adoption-guide 补 brownfield 子节；新增 §3.4.8「外部技能吸收」小节 |
| 2 | `w-model-dev/SKILL.md` | 修订 | 阶段路由表补「User Stories / seam / 票据 / archive」标记；阶段统一产出契约补「Out of Scope + User Stories + archive」三要素；快速自检补「上下文窗口已清理」条目 |
| 3 | `w-model-dev/references/phase-1-requirements.md` | 修订 | 新增「User Stories 长列表」「Out of Scope 显式声明」「Implementation/Testing Decisions 分离」三节 |
| 4 | `w-model-dev/references/phase-2-system-design.md` | 修订 | 新增「测试 seam 决策」节 |
| 5 | `w-model-dev/references/phase-3-outline-design.md` | 修订 | 新增「测试 seam 决策」节 |
| 6 | `w-model-dev/references/phase-4-detailed-design.md` | 修订 | 新增「测试 seam 决策」节 |
| 7 | `w-model-dev/references/phase-5-coding.md` | 修订 | 新增「Tracer-bullet 票据拆解」节 |
| 8 | `w-model-dev/references/phase-8-acceptance-test.md` | 修订 | 新增「archive 机制」节 |
| 9 | `w-model-dev/references/external-skills-absorption.md` | 新增 | 三源吸收映射 + 决策记录 + 与约束/反模式关系 |
| 10 | `docs/adoption-guide.md` | 修订 | 新增「Brownfield 适配」节（人类可读版本） |

### 3.2 不改动的文件（明确边界）

| 类别 | 文件 | 不改动理由 |
|---|---|---|
| 脚本 | `scripts/check-*.ts`（11 个） | 纯文档吸收，不新增校验维度 |
| 脚本测试 | `scripts/__tests__/*.test.ts` | 不新增脚本，不新增测试 |
| 脚本 fixture | `scripts/samples/**` | 不新增脚本，不新增 fixture |
| 模板 | `templates/*.md` | 新增节由 S 子代理在现有模板内填充，不改模板结构 |
| 示例 | `examples/*.md` | 现有示例不变，下一轮调测再补新示例 |
| 子代理人格 | `subagent/*.md` | S-tickets 由 S 兼任，不新增 persona |
| Verifier 规范 | `references/verifier-spec.md` | V 子代理引用方式不变 |
| 子代理分派 | `references/subagent-delegation.md` | S-tickets 是 S 内部拆分，不改角色边界 |
| 数据模型 | `references/data-models.md` | archivePath 为可选字段，不强改 schema |
| 反模式 | `references/anti-patterns.md` | 不新增反模式（保持 19 条） |
| TLA+ 指南 | `references/tla-plus-guide.md` | seam 决策与 TLA+ 正交 |
| Demo | `w-model-dev-demo/**` | demo 已归档，不补建新节产物 |
| 顶层 | `README.md` / `CONTRIBUTING.md` | 不变；AGENTS.md §2 可选补一行 |

### 3.3 OpenSpec 四产物 → W 模型阶段映射

| OpenSpec 产物 | W 模型阶段 | W 模型对应产物 | 备注 |
|---|---|---|---|
| proposal.md | 阶段 1 | requirement-spec.md 的「问题陈述+解决方案+User Stories+Out of Scope」节 | 第 4 节强化 |
| specs/ | 阶段 1 | RTM 需求行 + acceptance-test-cases.md | 不变 |
| design.md | 阶段 2-4 | system-design.md + outline-design.md + detailed-design.md | 不变 |
| tasks.md | 阶段 5 | tickets.md（新增） | 第 6 节强化 |
| archive/ | 阶段 8 | changes/archive/YYYY-MM-DD-<feature>/（新增） | 第 7 节强化 |

### 3.4 OpenSpec 哲学映射

| OpenSpec 哲学 | W 模型对应 | 状态 |
|---|---|---|
| fluid not rigid | W 模型阶段门不强制顺序跳阶 | 已有（约束 1 测试设计前置是硬红线） |
| iterative not waterfall | W 模型返工循环 V/G→R→V→G→S-fix | 已有 |
| easy not complex | 票据拆解放宽例外（单一 bug 不强制票据化） | 第 6.5 节新增 |
| brownfield not just greenfield | adoption-guide brownfield 路径 | 第 8 节新增 |
| scalable | W 模型成熟度 L1-L4 | 已有 |

---

## 4. 阶段 1 强化细节

### 4.1 目标

吸收 to-spec 的 PRD 结构 + OpenSpec 的 proposal 风格，强化需求分析产物的完整性。

### 4.2 phase-1-requirements.md 新增三节

#### 4.2.1 User Stories 长列表节

S-doc 产出阶段 1 需求规格时，在「需求清单」前新增「User Stories」节：

```markdown
## User Stories

1. As a <actor>, I want <feature>, so that <benefit>
2. As a <actor>, I want <feature>, so that <benefit>
...
```

**规则**：
- 每条 user story 对应 ≥1 个 REQ 行（RTM `requirementId` 可追溯）
- 列表「extensive」——覆盖正常/异常/边界/NFR/CON 全场景
- 与现有「需求清单」互补：user stories 是用户视角，需求清单是系统视角
- A 子代理 ingestion 时把 user stories 作为 chunk 之一（不破坏现有分块策略）

#### 4.2.2 Out of Scope 显式声明节

S-doc 在「需求清单」后新增「Out of Scope」节：

```markdown
## Out of Scope

- <明确排除的功能/场景>
- <原因：依赖未就绪/范围过大/下轮迭代>
```

**规则**：
- 至少 1 条（即使是「无」也要显式声明）
- 与 NFR/CON 横切治理互补：NFR/CON 是「要做什么」，Out of Scope 是「不做什么」
- V 子代理评审时检查「Out of Scope 是否覆盖了用户提到的边界场景」

#### 4.2.3 Implementation/Testing Decisions 分离节

S-doc 在「风险与缓解」前新增「Implementation Decisions」+「Testing Decisions」两节：

```markdown
## Implementation Decisions
- <架构/模块/接口/Schema/API 契约决策>
- <避免具体文件路径与代码片段（除非 prototype 产出的决策密集片段）>

## Testing Decisions
- <测试 seam 选择及理由>
- <哪些模块测试、参考哪些既有测试>
```

**规则**：
- Implementation Decisions 与现有「设计假设」互补：假设是「未确认的前提」，决策是「已选定的方向」
- Testing Decisions 与阶段 1 同步验收测试设计互补：本节是「为什么这样测」，验收测试设计是「测什么」
- 禁止具体文件路径（OpenSpec 与 to-spec 共识：路径易过期）

### 4.3 与现有产物的关系

- 不替换任何现有节，只新增
- 「问题陈述」「解决方案」节保留现有模板结构
- RTM 需求行不与 user stories 1:1 强绑定（一个 user story 可拆多个 REQ，一个 REQ 可服务多个 user story）

### 4.4 Verifier 评审影响

- verifier-spec.md §7.1-§7.5 既有 5 轴评审不变
- 新增三节作为「完整性」子标准的额外检查项（不需改 verifier-spec.md）
- V 子代理在 summary digest 时引用 phase-1-requirements.md 新增节

---

## 5. 阶段 2-4 seam-first 测试 seam 决策

### 5.1 目标

吸收 to-spec 的 seam-first testing 方法论，前置测试 seam 选择决策，与现有四级测试设计互补（不替换）。

### 5.2 核心概念

seam = 测试可以"钩住"代码的点（模块边界、API 边界、CLI 边界、HTTP 边界）。to-spec 主张"用最高 seam、理想一个、新 seam 在最高可能点提出"。在 W 模型中，seam 决策横跨阶段 2-4 三层设计。

### 5.3 阶段 2：系统级 seam 决策（system-design）

**phase-2-system-design.md 新增「测试 seam 决策」节**：

```markdown
## 测试 seam 决策

### 候选 seam 列表
- <seam-1>: <描述> — <钩住点（HTTP / CLI / 模块导出 / 进程边界）>
- <seam-2>: ...

### 选定 seam
- 系统测试主 seam: <seam-id>（最高 seam，理由：<覆盖最广/最稳定/最少新 seam>）
- 系统测试辅 seam: <seam-id 或 无>（仅当主 seam 无法覆盖某场景）

### 理由
- 为什么主 seam 是最高 seam
- 为什么现有 seam 优于新建 seam
- 新建 seam 的代价与收益（如有新建）
```

**规则**：
- 阶段 2 seam 决策服务于阶段 7 系统测试设计（已存在的同步产物）
- "最高 seam"在系统层 = HTTP API / CLI / 进程边界（外部可观测点）
- 与现有「系统测试设计」节互补：seam 决策是「在哪测」，系统测试设计是「测什么」
- 禁止为了"覆盖率"在系统层引入新 seam（违反 to-spec 原则）

### 5.4 阶段 3：模块交互级 seam 决策（outline-design）

**phase-3-outline-design.md 新增「测试 seam 决策」节**：

```markdown
## 测试 seam 决策

### 模块交互 seam
- <模块对 1>: seam = <模块导出 / 内部接口>
- <模块对 2>: ...

### 选定 seam
- 集成测试主 seam: <seam-id>
- 复用阶段 2 seam 的部分: <列表或无>

### 理由
- 为什么在模块边界而非系统边界测
- 为什么现有模块接口优于新建测试专用接口
```

**规则**：
- 阶段 3 seam 决策服务于阶段 6 集成测试设计
- "最高 seam"在模块层 = 模块公共导出（不深入私有方法）
- 必须显式声明「复用阶段 2 seam 的部分」（避免重复引入 seam）

### 5.5 阶段 4：原子单元级 seam 决策（detailed-design）

**phase-4-detailed-design.md 新增「测试 seam 决策」节**：

```markdown
## 测试 seam 决策

### 单元测试 seam
- <DD-1>: seam = <函数签名 / 类公共方法>
- <DD-2>: ...

### 选定 seam
- 单元测试主 seam: <seam-id>（绝大多数情况下复用代码公共 API）
- 不复用阶段 2/3 seam 的部分: <列表或 无>

### 理由
- 为什么单元测试不引入新 seam（理想：代码公共 API 即 seam）
- 例外情况（如需测试内部状态机的私有转移）：如何最小化 seam 引入
```

**规则**：
- 阶段 4 seam 决策服务于阶段 5 单元测试设计（同步产物）
- "最高 seam"在单元层 = 函数/类的公共 API（to-spec 原则：理想零新 seam）
- 私有状态机/内部转移的测试通过 TLA+ 不变式断言覆盖（与约束 9 TLA+ 行为门禁协同），不在代码层引入测试 seam

### 5.6 三层 seam 一致性约束

**跨阶段一致性**（V 子代理评审检查）：
- 阶段 3 必须显式引用阶段 2 选定 seam（"复用阶段 2 seam 的部分"非空，或显式声明"无复用，理由"）
- 阶段 4 必须显式引用阶段 3 选定 seam
- 阶段 2/3 不允许"为覆盖率新建 seam"（违反 to-spec「fewer seams better」原则）

### 5.7 与 TLA+ 行为门禁的关系

- 阶段 4 私有状态机的转移由 TLA+ 不变式断言覆盖（已存在），不在代码层引入测试 seam
- TLA+ L3/L4 规格作为"行为 seam"，与代码层"接口 seam"正交，互不替代

### 5.8 与现有「测试设计前置」约束的关系

- 不替换约束 1（测试设计前置）
- seam 决策是测试设计的前置输入：先定 seam，再写测试用例
- S-doc 在阶段 2-4 产出顺序：设计文档 → seam 决策 → 同步测试设计 → RTM 更新

---

## 6. 阶段 5 tracer-bullet 票据拆解

### 6.1 目标

吸收 to-tickets 的 tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract 方法论，在阶段 5 编码前完成票据化任务拆解，作为 S-coding 子代理的执行单元。

### 6.2 核心概念

tracer-bullet = 贯穿全层（schema/service/store/test）的窄而完整切片，每片可独立 demo/验证。与 W 模型阶段 4 已有的 DD 拆解互补——DD 是"按子系统设计"，票据是"按垂直切片执行"。

### 6.3 票据拆解时序

阶段 5 进入时，编排者分派 S 子代理执行顺序调整：

```
原时序: O 路由 → CHECKPOINT → S-coding（直接编码）→ V → G
新时序: O 路由 → CHECKPOINT → S-tickets（票据拆解）→ S-coding（按票据执行）→ V → G
```

**S-tickets 拆分规则**（与 S-doc/S-tla 拆分机制并列）：
- S-tickets 由 S 子代理兼任（不新增角色）
- S-tickets 产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- S-tickets 必须在 S-coding 前完成，V/G 不单独评审 tickets.md（合并到阶段 5 V/G 评审）

### 6.4 票据拆解规则（吸收 to-tickets vertical-slice-rules）

**phase-5-coding.md 新增「Tracer-bullet 票据拆解」节**：

```markdown
## Tracer-bullet 票据拆解

### 票据清单
| # | 标题 | Blocked by | What it delivers | Status |
|---|---|---|---|---|
| 01 | <标题> | None | <端到端行为，用户视角> | ready-for-agent |
| 02 | <标题> | 01 | <端到端行为> | blocked |
| ... | | | | |

### Wide refactor（如有）
- <refactor-1>: <机械改动描述> — blast radius <范围>
  - Expand: <ticket-id>（添加新形式，旧形式不破坏）
  - Migrate batch 1: <ticket-id>（blocked by Expand）
  - Migrate batch 2: <ticket-id>（blocked by batch 1）
  - Contract: <ticket-id>（删除旧形式，blocked by 所有 batch）
```

**vertical-slice 规则**（吸收 to-tickets）：
- 每片贯穿全层（schema + service + store + 单元测试），不是单层切片
- 每片可独立 demo 或验证（独立跑测试通过）
- 每片大小适配单个新鲜上下文窗口（与"子代理任务 ≤1000 词"约束协同）
- 优先 prefactor：先做让实现更容易的预备改动（to-tickets 原则）

**Wide refactor 例外**（吸收 to-tickets）：
- 单一机械改动（重命名/重类型）blast radius 跨全代码库时，不强制 tracer-bullet
- 用 expand-contract 序列：expand（新旧并存）→ migrate batches（每批 CI 绿）→ contract（删旧）
- 每批大小按 blast radius（按目录/按包）

### 6.5 票据内容契约

**每张票据包含**（吸收 to-tickets local-ticket-template）：

```markdown
# <NN> — <标题>

**What to build:** 端到端行为，用户视角（非层-by-layer 实现列表）
**Blocked by:** <票据号/标题列表，或 "None — can start immediately">
**Status:** ready-for-agent | blocked | in-progress | done

- [ ] 验收标准 1
- [ ] 验收标准 2
```

**规则**：
- 禁止具体文件路径与代码片段（to-tickets 与 to-spec 共识：路径易过期）
- 例外：prototype 产出的决策密集片段（状态机/reducer/schema/type shape）可内联，标注来源
- 验收标准与 RTM `unitTest` 字段对应（每张票据 ≥1 单元测试）

### 6.6 Blocking edges 依赖图

**依赖图规则**：
- blocking edges 形成有向无环图（DAG）
- frontier = blockers 全完成的票据（可立即开始）
- 纯线性链：top to bottom
- 编排者按 frontier 一次性分派全部可启动票据（串行执行时按票据号顺序处理，与"主机不支持并行则串行"约束协同）

**与 RTM 的关系**：
- 每张票据对应 RTM `codeModule` 字段的 ≥1 条目（SD-xxx:src/path 格式不变）
- 票据 ID（NN）不写入 RTM（RTM 保持现有 schema，不污染数据模型）
- 票据完成 → S-coding 回填 RTM `codeModule` → V/G 评审（与现有流程一致）

**与 code-TLA+ 一致性回归的关系**：
- 票据的 Next 分支实现必须与 TLA+ Action 名对应（与约束"TLA+ Next 分支 PascalCase ↔ code camelCase"协同）
- 不引入新校验维度（保持四维度，由 G 子代理在阶段 5 评审时引用 tickets.md 检查一致性）

### 6.7 Out of 票据化的例外

**不强制票据化的场景**：
- 单一 bug 修复（直接走 R→S-fix 返工循环）
- 单一 TLA+ 不变式违反修复（同上）
- 阶段 5 仅 1 个 SD 子系统且改动 ≤1 文件时（直接编码，不拆票据）

**规则**：
- S-tickets 子代理在拆解前判断「是否需要票据化」
- 不需要时产出 `tickets.md` 仅含一行声明「本阶段改动范围小，不票据化，直接编码」
- V 子代理评审时检查该声明是否合理（避免漏拆）

### 6.8 Verifier 评审影响

- verifier-spec.md §7.5（code 评审）既有标准不变
- V 子代理在 summary digest 时检查「票据是否真垂直切片」「blocking edges 是否正确」「wide refactor 是否用 expand-contract」
- 不需改 verifier-spec.md，由 V 子代理引用 phase-5-coding.md 新增节

**与"编排者最小化"约束的关系**：
- 编排者只分派 S-tickets → S-coding，不参与票据拆解决策
- 编排者按 frontier 分派 S-coding 子代理（路由职责，非实施）
- 票据内容产出由 S 子代理执行（命中反模式 #10 处置不变）

---

## 7. 阶段 8 archive 机制

### 7.1 目标

吸收 OpenSpec 的 archive 机制，补全 W 模型项目归档后的产物沉淀路径。

### 7.2 phase-8-acceptance-test.md 新增「archive 机制」节

```markdown
## Archive 机制

### 触发时机
项目级放行（acceptance-test-report.md §9 用户勾选 confirm）后，S 子代理执行 archive。

### Archive 路径
changes/archive/<YYYY-MM-DD>-<feature-slug>/

### Archive 产物清单
- proposal.md      ← 阶段 1 需求规格的「问题陈述 + 解决方案 + User Stories + Out of Scope」节抽取
- specs.md         ← RTM 需求行 + 验收测试用例（UAT-xxx）合并
- design.md        ← 阶段 2-4 设计产物的技术决策摘要（不含具体文件路径）
- tasks.md         ← 阶段 5 tickets.md 的票据清单 + 完成状态
- tla-summary.md   ← TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表）
- rtm-snapshot.json ← RTM 最终快照（requirementId → {designDoc, codeModule, tests}）
- verifier-summary.md ← 8 阶段 V 评审 qualityLevel + compositeScore 摘要

### Archive 规则
- 由 S 子代理执行（编排者不越权，反模式 #10 不变）
- archive 后 .w-model/ 原始产物保留（不删除，作为可追溯证据）
- archive 产物只读，后续项目引用时只读取不修改
- archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）
- **tickets.md 源路径无关性**：阶段 5 票据产出位置（`.w-model/tickets.md` 或 `docs/tickets.md`）不影响 archive——archive 时 S 子代理从源路径读取内容，写入 archive 的 `tasks.md`，源文件保留不动
```

### 7.3 与现有 acceptance-test-report.md §9 的关系

- §9 用户勾选 confirm 后，编排者分派 S 子代理执行 archive
- archive 完成后 S 子代理回填 `project.json.status = "项目完成 + 已归档"`
- archive 路径写入 `project.json.archivePath` 字段（数据模型扩展，需同步 data-models.md 描述，但不强改 schema）

### 7.4 与 data-models.md 的关系

- `project.json` 新增可选字段 `archivePath: string`（默认空字符串）
- 不破坏现有 schema（向后兼容）
- check-artifact-gate.ts 不校验 archivePath（保持纯文档吸收，不新增脚本校验）

---

## 8. adoption-guide brownfield 路径

### 8.1 目标

吸收 OpenSpec brownfield 优先理念，新增 brownfield 适配入口。

### 8.2 SSoT §11A 补充 brownfield 子节

```markdown
### Brownfield 适配路径

#### 适用场景
- 已有代码库引入 W 模型管理后续迭代
- 历史代码无 RTM/无 TLA+ 规格，需要补建追溯
- OpenSpec 风格的 brownfield 项目迁移到 W 模型

#### 阶段 1 Brownfield 入口
S-doc 子代理在阶段 1 产出需求规格前，先执行 codebase survey：

1. **现状调查**：扫描 src/ 产出模块清单（controller/service/store/utils）
2. **逆向 RTM**：从代码反推需求清单（每个公共 API → 候选 REQ 行）
3. **缺口分析**：标注哪些需求有测试覆盖、哪些无覆盖
4. **User Stories 回填**：从代码行为反推 user stories（与第 4.2.1 节互补）
5. **Out of Scope 声明**：明确本轮 brownfield 迭代不动哪些历史模块

#### 阶段 2-4 Brownfield 适配
- 阶段 2 系统设计：优先复用现有架构，seam 决策优先选现有模块边界（第 5.3 节）
- 阶段 3 概要设计：模块交互 seam 优先选现有公共导出（第 5.4 节）
- 阶段 4 详细设计：新增 DD 仅针对本轮改动模块，历史模块不补 DD（避免范围蔓延）
- TLA+ 规格：仅对本轮改动的 SD 子系统建模（历史模块不补 TLA+）

#### 阶段 5 Brownfield 编码
- 票据拆解时优先 prefactor（to-tickets 原则）：让本轮改动更容易
- Wide refactor 场景（重命名共享符号/重类型）必走 expand-contract（第 6.4 节）
- 历史代码清理不在本轮范围（Out of Scope 声明）

#### Brownfield 不做的事
- 不全量补建历史 RTM（除非用户明确要求，作为独立项目）
- 不全量补建历史 TLA+ 规格（同上）
- 不重构无关历史代码（与约束 5「Maintain Scope Discipline」协同）
```

### 8.3 与 adoption-guide.md（人类可读）的关系

- SSoT §11A 为权威定义
- adoption-guide.md 同步补充「Brownfield 适配」节（人类可读版本，无技术细节）
- 两者不冲突：SSoT 是 Agent 行动权威，adoption-guide 是人类导航

---

## 9. external-skills-absorption.md 总文档结构

### 9.1 文档结构

```markdown
# External Skills Absorption

> 三源（to-tickets / to-spec / OpenSpec）吸收决策记录。
> 权威定义以 SSoT §3.4/§4A/§11A + 各 phase-N-*.md 新增节为准；本文件为吸收映射与决策回溯。

## 1. 吸收源清单
（三源 URL + 吸收日期 + 吸收范围）

## 2. 吸收决策记录
### 2.1 落地策略：阶段内强化
### 2.2 吸收深度：纯文档
### 2.3 Brownfield 适配：补充 adoption-guide

## 3. 三源 → W 模型阶段映射表
（同第 3.3 节映射表）

## 4. 三源精华 → 阶段产物分布
### 4.1 阶段 1（User Stories + Out of Scope + Implementation/Testing Decisions）
### 4.2 阶段 2-4（测试 seam 决策）
### 4.3 阶段 5（Tracer-bullet 票据拆解）
### 4.4 阶段 8（archive 机制）
### 4.5 adoption-guide（Brownfield 适配）

## 5. 与现有约束/反模式的关系
### 5.1 强化现有约束
### 5.2 不引入新约束
### 5.3 不弱化现有反模式

## 6. Verifier 评审影响
### 6.1 不改 verifier-spec.md
### 6.2 V 子代理引用方式

## 7. 不做的事

## 8. 未来扩展（非本轮）
```

### 9.2 文档定位

**与 SSoT 的关系**：
- SSoT §3.4/§4A/§11A 为权威定义（吸收后的硬性条文）
- external-skills-absorption.md 为吸收映射与决策回溯（为什么吸收、吸收了什么、映射到哪）
- 两者不冲突：SSoT 是"是什么"，absorption.md 是"为什么和怎么来的"

**与 phase-N-*.md 的关系**：
- phase-N-*.md 新增节是"操作细则"（S 子代理怎么执行）
- absorption.md 是"操作细则的来源索引"（S 子代理想了解背景时查）
- 两者不重复：absorption.md 只列映射，不复制阶段细则内容

**与 anti-patterns.md 的关系**：
- 不新增反模式（保持 19 条不变）
- absorption.md §5.2 显式声明"不引入新约束"

### 9.3 引用关系图

```
SSoT §3.4/§4A/§11A（权威定义）
    ↓ 引用
phase-1/2/3/4/5/8-*.md 新增节（操作细则）
    ↓ 索引
external-skills-absorption.md（吸收映射 + 决策回溯）
    ↓ 引用
SKILL.md「快速自检」补 context hygiene 条目（提示性）
```

### 9.4 Agent 加载顺序（按需加载，约束 6）

- 阶段 1：S-doc 加载 phase-1-requirements.md 新增节
- 阶段 2-4：S-doc 加载对应 phase-N-*.md「测试 seam 决策」节
- 阶段 5：S-tickets 加载 phase-5-coding.md「Tracer-bullet 票据拆解」节
- 阶段 8：S-doc 加载 phase-8-acceptance-test.md「archive 机制」节
- 想了解背景：加载 external-skills-absorption.md（非必读）

---

## 10. SSoT 同步顺序与 CHANGELOG

### 10.1 SSoT 同步顺序（硬约束）

按 AGENTS.md §6「SSoT 优先」原则，改动顺序：

```
1. docs/skill-design-document_SSoT.md（权威定义）
   ↓
2. w-model-dev/references/external-skills-absorption.md（吸收映射）
   ↓
3. w-model-dev/references/phase-{1,2,3,4,5,8}-*.md（操作细则）
   ↓
4. w-model-dev/SKILL.md（编排逻辑同步）
   ↓
5. docs/adoption-guide.md（人类可读同步）
   ↓
6. CHANGELOG.md（变更记录）
```

**禁止顺序违规**：
- 必须先改 SSoT 再改 phase-N-*.md（SSoT 是权威）
- 必须先改 phase-N-*.md 再改 SKILL.md（SKILL.md 引用 phase-N-*.md）
- adoption-guide.md 必须在 SSoT §11A 改完后同步

### 10.2 CHANGELOG 条目

**CHANGELOG.md 新增 [10.0.0] 版本**：

```markdown
## [10.0.0] - 2026-07-26

### Added
- 三源（to-tickets / to-spec / OpenSpec）吸收：阶段内强化模式
- 阶段 1 新增 User Stories 长列表 + Out of Scope + Implementation/Testing Decisions 分离节
- 阶段 2-4 新增「测试 seam 决策」节（seam-first testing，三层一致性约束）
- 阶段 5 新增「Tracer-bullet 票据拆解」节（垂直切片 + blocking edges + wide refactor expand-contract）
- 阶段 8 新增「archive 机制」节（changes/archive/YYYY-MM-DD-<feature>/）
- adoption-guide 新增 Brownfield 适配路径
- 新增 references/external-skills-absorption.md（吸收映射 + 决策回溯）
- SSoT §3.4.8「外部技能吸收」小节
- project.json 新增可选字段 archivePath

### Changed
- SKILL.md 阶段路由表补「User Stories / seam / 票据 / archive」标记
- SKILL.md 阶段统一产出契约补「Out of Scope + User Stories + archive」三要素
- SKILL.md 快速自检补「上下文窗口已清理」条目
- SSoT §4A 操作行为表第 7 行补「seam-first 决策」
- SSoT §11A adoption-guide 补 brownfield 子节

### Not Changed（明确边界）
- 11 个 check-*.ts 脚本不变（纯文档吸收）
- self-test 基线 91 条不变
- verifier-spec.md 5 轴 + 5 targetKind 不变
- subagent-delegation.md O-S-V-G-R 边界不变
- anti-patterns.md 19 条反模式不变
- data-models.md 强制字段不变（archivePath 可选）
- w-model-dev-demo/ 不补建新节产物
```

---

## 11. 与现有约束/反模式的关系

### 11.1 强化现有约束

| 约束 | 强化点 | 来源 |
|---|---|---|
| 约束 1（测试设计前置） | seam 决策是测试设计的前置输入 | to-spec |
| 约束 5（Maintain Scope Discipline） | Out of Scope 显式声明 + brownfield 不重构无关历史代码 | to-spec + OpenSpec |
| 约束 6（按需加载） | context hygiene 提示性补强（阶段切换新会话） | OpenSpec |
| 约束 8（编排者最小化） | S-tickets 由 S 兼任，编排者只按 frontier 路由 | to-tickets |
| 约束 9（TLA+ 行为门禁） | TLA+ 不变式断言覆盖私有状态机，不在代码层引入测试 seam | to-spec |

### 11.2 不引入新约束

- 三源吸收不新增硬红线（保持 19 条约束 + 19 条反模式 + 10 条失败模式不变）
- 新增节是"操作行为"层面（违反不回退，降低质量），不是"硬约束"层面（违反回退）

### 11.3 不弱化现有反模式

- 反模式 #10（编排者越权）：S-tickets 拆解由 S 执行，编排者不越权
- 反模式 #18（跳过 R 直接 S 返工）：票据化不绕过返工循环
- 反模式 #16（TLA+ 占位）：seam 决策不替代 TLA+ 行为门禁

---

## 12. 验证策略

### 12.1 本轮验证（不跑 demo）

1. **TypeScript strict 编译**：`npm run build` 退出码 0（脚本未改，应保持 0 错误）
2. **self-test 基线**：`npm run self-test` 退出码 0（91 条不变）
3. **vitest 测试**：`cd w-model-dev && npx vitest run scripts/__tests__/` 退出码 0（脚本未改，应保持全通过）
4. **文档一致性人工检查**：
   - SSoT §3.4.8 与 external-skills-absorption.md §1 引用一致
   - phase-N-*.md 新增节标题与 SKILL.md 阶段路由表标记一致
   - adoption-guide.md Brownfield 节与 SSoT §11A brownfield 子节内容一致
   - CHANGELOG [10.0.0] 与实际改动文件清单一致

### 12.2 下一轮验证（端到端调测，非本轮）

- 第十轮端到端调测时按新文档执行，验证：
  - 阶段 1 产出包含 User Stories + Out of Scope + Implementation/Testing Decisions
  - 阶段 2-4 产出包含「测试 seam 决策」节，三层一致
  - 阶段 5 产出 tickets.md，按 frontier 分派 S-coding
  - 阶段 8 产出 archive 目录
- 本轮不跑第十轮调测（留下轮）

---

## 13. 风险与缓解

| 风险 | 缓解 |
|---|---|
| S 子代理漏填新增节 | V 子代理在 summary digest 时引用 phase-N-*.md 新增节检查；漏填进入 reworkHints |
| 票据拆解过细导致 S-coding 子代理过多 | 第 6.7 节「Out of 票据化例外」放宽容许；S-tickets 判断是否需要票据化 |
| seam 决策与 TLA+ 行为门禁混淆 | external-skills-absorption.md §5.1 显式声明正交关系；phase-4-detailed-design.md 第 5.5 节明确"私有状态机由 TLA+ 不变式覆盖" |
| archive 产物路径与现有 .w-model/ 冲突 | archive 路径在 `changes/archive/` 下（独立于 `.w-model/`），不冲突 |
| brownfield 范围蔓延（顺手重构历史代码） | 第 8.2 节「Brownfield 不做的事」显式声明 + Out of Scope 强制声明 |
| AGENTS.md §2 目录速查未同步 | 可选补一行 external-skills-absorption.md（在 references 行内补，不改表结构） |

---

## 14. 未来扩展（非本轮）

- 若票据拆解需强门禁：可后续新增 check-tickets.ts（校验 DAG 无环 + frontier + 垂直切片）
- 若 archive 需校验：可后续扩展 check-artifact-gate.ts 校验 archivePath
- 若 brownfield 需独立流程：可后续新增 references/brownfield-guide.md
