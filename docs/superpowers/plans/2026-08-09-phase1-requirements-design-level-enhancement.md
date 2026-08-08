# Phase 1 需求分析产出达到设计文档级别 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 W 模型技能包 Phase 1（需求分析）产出提升到 DESIGN.md 级别的结构严谨性：6 项增强内容拆为独立产物文件（主规格引用块串联），移除内联 feature 集（bdd 承接），并通过门禁脚本可机械核验。

**Architecture:** 三层联动——模板层（主模板 + 6 独立子模板）、参考层（phase-1-requirements.md 算法扩步 + 失败模式 + 禁止行为）、门禁层（check-requirement-graph.ts 新增 R7/R8 + check-artifact-gate.ts --phase=1 新增引用块/SSOT/DoD 校验）。严守需求域边界，不侵入 Phase 2。

**Tech Stack:** Markdown 模板/参考、TypeScript（tsx runtime + ajv）、vitest、self-test.ts 回归基线、mermaid（UML 建模）。

**Spec:** [2026-08-09-phase1-requirements-design-level-enhancement-design.md](../specs/2026-08-09-phase1-requirements-design-level-enhancement-design.md)

**命名修正（相对 spec）**：spec 草案用 `<module>-` 前缀命名独立产物；本计划遵循 [directory-conventions.md](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/references/directory-conventions.md) §1 仓库约定（Phase 1 产物无 module 前缀，位于 `docs/phase1-requirements/`），独立产物命名为 `system-context.md` / `glossary.md` / `traceability-matrix.md` / `behavior-spec.md` / `discipline-dod.md` / `uml-modeling.md`，主规格 `requirement-spec.md` 引用块指向同目录。子模板放 `templates/requirement-spec/` 目录（与主模板 `templates/requirement-spec.md` 同名目录，对齐 templates/ 已有目录结构惯例）。

**批次与约束**：4 批串行（模板→参考→门禁→同步），每批完成后父代理回归。**禁止并行修改**（用户偏好：文档修改必须准确无冲突）。所有脚本改动须 `npm run self-test` + `npx vitest run` 全通过 + TypeScript strict 0 错误。版本号三处一致 37.0.0。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `w-model-dev/templates/requirement-spec.md` | 重构 | 主模板：§0 SSOT 头 + 骨架 + §3/§4/§10/§12/§16/附录 A 引用块 |
| `w-model-dev/templates/requirement-spec/system-context.md` | 新增 | 系统上下文子模板 |
| `w-model-dev/templates/requirement-spec/glossary.md` | 新增 | 术语表子模板 |
| `w-model-dev/templates/requirement-spec/traceability-matrix.md` | 新增 | 需求追踪矩阵子模板 |
| `w-model-dev/templates/requirement-spec/behavior-spec.md` | 新增 | 行为规格模型子模板 |
| `w-model-dev/templates/requirement-spec/discipline-dod.md` | 新增 | 工程纪律与 DoD 子模板 |
| `w-model-dev/templates/requirement-spec/uml-modeling.md` | 新增 | UML 需求建模子模板 |
| `w-model-dev/references/phase-1-requirements.md` | 修改 | 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14 + 返工路径 + 验收标准 + 执行方法论表 + 输出节 |
| `w-model-dev/scripts/graph-logic.ts` | 修改 | 新增 R7 追踪矩阵一致性 + R8 UML mermaid 块配平 |
| `w-model-dev/scripts/check-requirement-graph.ts` | 修改 | CLI 新增 `--spec-dir=<dir>` 参数 |
| `w-model-dev/scripts/gate-logic.ts` | 修改 | 新增 `checkRequirementSpecStructure()` |
| `w-model-dev/scripts/check-artifact-gate.ts` | 修改 | phase=1 调用结构校验 |
| `w-model-dev/scripts/samples/graph/` | 新增 | R7/R8 各 1 valid + 1 bad（4 条） |
| `w-model-dev/scripts/samples/gate/` | 新增 | 结构校验 1 valid + 3 bad（4 条） |
| `w-model-dev/scripts/self-test.ts` | 修改 | 基线 217→225 |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 修改 | R7/R8 单测 |
| `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` | 修改 | 结构校验单测 |
| `w-model-dev/references/verifier-spec.md` | 修改 | V 评审新增项 |
| `w-model-dev/SKILL.md` | 修改 | 阶段路由表 Phase 1 行 + 快速自检清单 + 版本号 |
| `w-model-dev/skill-metadata.json` | 修改 | 版本号镜像 |
| `package.json` | 修改 | 版本号 |
| `docs/skill-design-document_SSoT.md` | 修改 | §3.4.xx 条目 + §10A 追溯表 |
| `AGENTS.md` | 修改 | §4 第 37 轮条目 |
| `CHANGELOG.md` | 修改 | [37.0.0] 条目 |
| `README.md` | 修改 | 能力 bullet（如有） |

---

## 批 1：模板层（主模板 + 6 独立子模板）

### Task 1: 主模板 requirement-spec.md 重构（§0 SSOT 头 + 引用块）

**Files:**
- Modify: `w-model-dev/templates/requirement-spec.md`（全部重写）

- [ ] **Step 1: 阅读现有主模板全文**

Run: `Read w-model-dev/templates/requirement-spec.md`（约 280 行，12 节 + 8.5）
Expected: 确认现有节（文档信息/1 问题陈述/2 解决方案概述/3 User Stories/4 层级树/5 REQ-group/6 交叉逻辑/7 覆盖分析/8 Out of Scope/8.5 迷雾/9 Implementation/10 Testing/11 风险/12 RTM 登记）

- [ ] **Step 2: 重写主模板文件**

将 `requirement-spec.md` 重写为如下结构（保留原有节内容体，仅调整节号与插入引用块）：

```markdown
# 需求规格说明书

> **模板版本**：v2.0（第 37 轮设计级别增强：§0 SSOT 头 + 6 独立产物文件引用块）
> 套用本模板时，§3/§4/§10/§12/§16/附录 A 的引用块指向同目录独立文件，独立文件套用
> `templates/requirement-spec/` 下对应子模板。产出物见
> `references/phase-1-requirements.md` §执行方法论。

## 文档信息
> 项目名称 / 版本 / 日期 / 编制者（保留原有字段）

## 0. 文档定位与 SSOT 头
> **文档版本**：v{{1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本需求规格说明书为阶段 1（需求分析）的唯一需求事实来源。需求变更须经 §11.5 迷雾毕业/§11 Out of Scope/豁免审批流程，不得无痕修改。
> **自身校验**：本规格以结构完整性为准——§3/§4/§10/§12/§16/附录 A 引用块指向的独立文件存在、§6 层级树 level 单调、§10 追踪矩阵字段一致、附录 A mermaid 块配平。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在 §11 Out of Scope 的显式标注中。
> **与设计文档关系**：本规格不描述系统设计（架构/运行时/子系统内部），设计事实由阶段 2-4 产出的设计文档承载。
> **行为规格承接**：行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），本规格 §12 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

## 1. 问题陈述与背景
> （保留原 §1 内容：§1.1 背景 / §1.2 目标 / §1.3 范围）

## 2. 解决方案概述
> （保留原 §2 内容）

## 3. User Stories
> （保留原 §3 内容）

## 4. 需求层级树【维度1】
> （保留原 §4 内容：level/priority/reqGroup/parent 强制）

## 5. 候选子系统划分（REQ-group）【维度2】
> （保留原 §5 内容）

## 6. 需求交叉逻辑矩阵【维度3】
> （保留原 §6 内容：四类边强制）

## 7. 需求覆盖分析【维度4】
> （保留原 §7 内容：四张矩阵 + 100% 覆盖率）

## 8. Out of Scope
> （保留原 §8 内容：至少 1 条显式声明）

## 8.5 Not yet specified（迷雾登记册）
> （保留原 §8.5 内容：毕业处置结果强制）

## 9. Implementation Decisions
> （保留原 §9 内容：架构/模块/接口决策，禁止具体文件路径）

## 10. Testing Decisions
> （保留原 §10 内容）

## 11. 风险与缓解
> （保留原 §11 内容：完整性检查 + 风险评估）

## 12. RTM 登记
> （保留原 §12 内容：含 NFR/CON 横切治理字段 + NFR 性能基线双字段）
```

引用块插入位置（**关键新增**）：

```markdown
## 3. 系统上下文

> 系统上下文详见 [system-context.md](./system-context.md)（外部实体清单 + 上下文边界原则，仅外部实体，不画内部架构）。

## 4. 核心概念与术语

> 术语表详见 [glossary.md](./glossary.md)（需求域术语子集，引用 references/glossary.md 权威表）。

## 10. 需求追踪矩阵

> 需求追踪矩阵详见 [traceability-matrix.md](./traceability-matrix.md)（§1 REQ/NFR 8 字段表 + §2 需求×测试层级承接矩阵，仅验收列填实）。

## 12. 行为规格模型

> 行为规格模型详见 [behavior-spec.md](./behavior-spec.md)（引用 .feature 文件关系，不内联 feature 块）。

## 16. Phase 1 工程纪律与 DoD

> Phase 1 工程纪律与 DoD 详见 [discipline-dod.md](./discipline-dod.md)（§1 需求阶段纪律 + §2 DoD 可勾选清单）。

## 附录 A. UML 需求建模

> UML 需求建模详见 [uml-modeling.md](./uml-modeling.md)（A.1 用例图 / A.2 领域类图 / A.3 活动图，mermaid）。
```

> **注意**：主模板节号按现有模板 1-12 编号体系排列（§0 为 SSOT 头，引用块作为独立节插入）；节号以最终模板实际编号为准，保持与 spec §3.1.2 对应（spec 的 17 节编号为参考，主模板实际编号按仓库既有 1-12 体系演进，避免破坏下游对 §12 RTM 登记等引用）。

- [ ] **Step 3: 自检模板结构**

Run: `Grep '^## ' w-model-dev/templates/requirement-spec.md`
Expected: 含 `0. 文档定位与 SSOT 头`、`3. 系统上下文`、`4. 核心概念与术语`、`10. 需求追踪矩阵`、`12. 行为规格模型`、`16. Phase 1 工程纪律与 DoD`、`附录 A. UML 需求建模` 引用块节；`12. RTM 登记` 保留

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/templates/requirement-spec.md
git commit -m "feat(templates): requirement-spec 主模板重构（§0 SSOT 头 + 6 独立文件引用块）"
```

---

### Task 2: 系统上下文子模板 system-context.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/system-context.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 系统上下文（System Context）

> 对应 DESIGN.md §4 系统上下文图与边界原则。需求级：仅外部实体 + 边界，不画内部架构（内部架构属阶段 2-4 设计文档）。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> 系统上下文详见 [system-context.md](./system-context.md)`。

## 1. 外部实体清单

| 外部实体 | 类型（用户/外部系统/外部存储） | 角色 | 交互方向（In/Out/双向） | 交互内容 |
|---|---|---|---|---|
| {{实体名}} | {{类型}} | {{角色}} | {{方向}} | {{交互内容}} |

> 强制：每个外部实体须与主规格 §3 User Stories 的 stakeholder 对应（FM-3D-09 检测信号）。

## 2. 上下文边界原则

- {{边界原则 1}}（例：系统不直接访问外部存储，一律经接口）
- {{边界原则 2}}
- …

> 原则仅声明"系统外部"边界；"系统内部"如何组织属阶段 2 系统设计，不在本文件描述。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/requirement-spec/system-context.md`
Expected: 含「外部实体清单」表头 + 「上下文边界原则」+ 边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/system-context.md
git commit -m "feat(templates): 新增系统上下文子模板 system-context.md"
```

---

### Task 3: 术语表子模板 glossary.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/glossary.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 术语表（Glossary）

> 对应 DESIGN.md §3 核心概念与术语。需求域术语子集；全量术语权威表见 `references/glossary.md`，本文件仅收录本项目需求域新引入/易混淆术语，引用权威表编号。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> 术语表详见 [glossary.md](./glossary.md)`。

## 术语表

| 术语 | 定义 | 来源引用（references/glossary.md 或需求原文） |
|---|---|---|
| {{术语}} | {{定义}} | {{来源}} |

> 强制：每条术语有定义 + 来源引用；与 `references/glossary.md` 权威表冲突时以权威表为准并在此标注差异。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/requirement-spec/glossary.md`
Expected: 含术语表 + 来源引用列 + 权威表优先级声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/glossary.md
git commit -m "feat(templates): 新增术语表子模板 glossary.md"
```

---

### Task 4: 需求追踪矩阵子模板 traceability-matrix.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/traceability-matrix.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 需求追踪矩阵（Traceability Matrix）

> 对应 DESIGN.md §2.1.1 需求条目化追踪矩阵。Phase 1 适配：涉及子系统→候选子系统，设计落点→候选落点§。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> 需求追踪矩阵详见 [traceability-matrix.md](./traceability-matrix.md)`。

## 1. REQ/NFR 字段表

| 需求号 | 优先级 | owner | 需求陈述 | 候选子系统 | 候选落点§ | 验收关联 | 逐条验收判据 |
|---|---|---|---|---|---|---|---|
| REQ-001 | P0 | {{owner}} | {{陈述}} | {{GROUP-xxx}} | {{主规格 §4.x}} | {{UAT-xxx / 主规格 §7.x}} | {{可判定表达式}} |
| NFR-001 | P0 | {{owner}} | {{陈述}} | {{横切 GROUP}} | {{主规格 §4.x}} | {{UAT-xxx}} | {{可判定表达式}} |

> 强制：`候选落点§` 指向主规格 §4 层级树节点 §；`验收关联` 指向 UAT 用例编号或主规格 §7 覆盖矩阵（R7 门禁校验）。

## 2. 需求×测试层级承接矩阵

| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |
|---|---|---|---|---|
| REQ-001 | ―（pending 阶段 5） | ―（pending 阶段 6） | ―（pending 阶段 7） | ● UAT-xxx + §7.x 判据 |
| NFR-001 | ― | ― | ― | ● UAT-xxx + 双字段判据 |

> 矩阵每格 ●/― 为设计事实的测试层级承接归属；Phase 1 仅验收列填实，其余 pending 由后续阶段回填 RTM 时同步（主规格 §12 RTM 登记）。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/requirement-spec/traceability-matrix.md`
Expected: 含 §1 字段表（8 列）+ §2 测试层级承接矩阵（5 列）+ pending 语义声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/traceability-matrix.md
git commit -m "feat(templates): 新增需求追踪矩阵子模板 traceability-matrix.md"
```

---

### Task 5: 行为规格模型子模板 behavior-spec.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/behavior-spec.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 行为规格模型（Behavior Spec）

> 对应 DESIGN.md §7 行为规格模型。**本文件仅定义引用关系，不内联 feature 块、不定义文档级头规范**——
> `.feature` 文件由 `references/bdd-guide.md` §2 头规范管（@req/@design/@designIds/@system/@tla-spec/@state-machine 等 10 字段），
> `bdd-manifest.json` 登记 feature 资产。模板版本：v1.0（第 37 轮）。主规格引用块：`> 行为规格模型详见 [behavior-spec.md](./behavior-spec.md)`。

## 1. 行为规格角色

- L1 行为规格在需求阶段的角色：以可执行场景（Given/When/Then）验证需求陈述可被理解与验收
- 行为规格与需求陈述互补：行为规格验证"行为如何被接受"，需求陈述定义"系统须提供什么"
- 行为规格不替代需求陈述，也不替代 TLA+ 行为正确性基准（.tla 文件）

## 2. 与 .feature 文件的引用关系

| 需求/用例 | 对应 .feature 文件 | 关键场景（Scenario 名） | bdd-manifest 登记 |
|---|---|---|---|
| REQ-{{xxx}} | `features/L1_{{system}}-001.feature` | {{Scenario 名}} | {{是/否}} |

> 强制：每个 L1 行为规格条目列出对应 .feature 文件路径；`.feature` 文件存在性由 `check-bdd-model.ts` D1-D7 校验。

## 3. 与需求规格的关系

- 行为规格条目须能回溯到主规格 §3 User Stories / §7 覆盖分析（无孤儿行为规格）
- 行为规格新增/变更须同步主规格 §12 RTM 登记，禁止只改 .feature 不回填（对齐约束 #18 RTM 回填精神）
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/requirement-spec/behavior-spec.md`
Expected: 含「不内联 feature 块」声明 + 引用关系表 + 强制回溯声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/behavior-spec.md
git commit -m "feat(templates): 新增行为规格模型子模板 behavior-spec.md"
```

---

### Task 6: 工程纪律与 DoD 子模板 discipline-dod.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/discipline-dod.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# Phase 1 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 1 收敛子集；完整工程宪法见 `SKILL.md`，项目级 DoD 见 `references/definition-of-done.md`。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> Phase 1 工程纪律与 DoD 详见 [discipline-dod.md](./discipline-dod.md)`。

## 1. 需求阶段纪律

- 需求事实以本模块主规格为 SSOT，变更须经迷雾毕业/Out of Scope/豁免审批（见主规格 §0）
- 禁止 LLM 自行裁定 REQ-group 归属（禁止行为 #8），边界模糊向用户确认（FM-3D-04）
- 禁止占位词进入正式交付（见主规格 §0）
- 行为规格由 .feature 文件承载，禁止在需求规格内联 feature 块

## 2. DoD 可勾选清单

- [ ] 功能与语义：需求陈述与 User Stories 一致，无语义悖反
- [ ] 结构性校验：§3/§4/§10/§12/§16/附录 A 引用块指向文件存在、§4 层级树 level 单调单根父唯一、§10 追踪矩阵字段一致、附录 A mermaid 块配平
- [ ] 证据充分：验收判据可量化（无"快速"/"友好"主观词）、四维覆盖矩阵 100%（含豁免处置）
- [ ] 迷雾清空：§8.5 每项迷雾有毕业处置结果
- [ ] RTM 同步：主规格 §12 RTM 登记与 §10 追踪矩阵一致、NFR/CON 横切字段已登记
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=1` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=1` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
```

> **DoD 门禁**：`check-artifact-gate.ts --phase=1` 校验本文件 `- [ ]` 项 ≥ 8 条（Task 13 Step 3 实现）。

- [ ] **Step 2: 自检**

Run: `Grep -- '- \[ \]' w-model-dev/templates/requirement-spec/discipline-dod.md | Measure-Object -Line`
Expected: 9（DoD 清单 9 项）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/discipline-dod.md
git commit -m "feat(templates): 新增工程纪律与 DoD 子模板 discipline-dod.md"
```

---

### Task 7: UML 需求建模子模板 uml-modeling.md

**Files:**
- Create: `w-model-dev/templates/requirement-spec/uml-modeling.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# UML 需求建模（UML Requirement Modeling）

> 对应 DESIGN.md 附录 A UML 2.0 系统建模图表集。需求级建模，仅用例图 + 领域类图 + 活动图；
> 序列图/状态机图由 TLA+/BDD 覆盖（.feature 文件 + .tla 文件承载），不在此重复。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> UML 需求建模详见 [uml-modeling.md](./uml-modeling.md)`。

## A.1 用例图

> 参与者 / 用例 / 关系（include/extend/泛化）。需求级，不涉及设计级组件。
> 参与者 = 主规格 §3 User Stories 的 stakeholder；用例 = 主规格 §4 层级树 level=2/3 REQ（FM-3D-09 检测信号）。

```mermaid
graph TB
  Actor1(({{参与者}})) --> UC1({{用例1}})
  UC1 -.->|include| UC2({{用例2}})
```

## A.2 领域类图

> 需求级领域实体 / 关系（关联/聚合/组合/泛化）/ 属性。无方法签名（设计级才补）。
> 领域实体 = 主规格 §4 层级树 level=1/2 REQ 的名词性概念（FM-3D-09 检测信号）。

```mermaid
classDiagram
  class {{DomainEntity1}} {
    +{{属性1}}
  }
  {{DomainEntity1}} "1" --> "*" {{DomainEntity2}} : {{关系}}
```

## A.3 活动图

> 业务流程 / 用户旅程。需求级，不涉及设计级控制流。
> 活动节点 = 主规格 §3 User Stories 正常场景序列（FM-3D-09 检测信号）。
> 注：mermaid 无独立活动图语法，用 `stateDiagram-v2` 表达活动节点流转。

```mermaid
stateDiagram-v2
  [*] --> {{状态1}}
  {{状态1}} --> {{状态2}} : {{事件}}
```

> 门禁：`check-requirement-graph.ts` R8 校验本文件 mermaid 块首尾定界行一一配对（Task 10 Step 2 实现）。
```

> **注意**：模板内嵌代码块示例时，外层需转义（模板文件中用 `\`\`\`mermaid` 转义示例块，避免模板渲染冲突）；实际产物文件中为正常 mermaid 块。

- [ ] **Step 2: 自检**

Run: `Grep -- '```mermaid' w-model-dev/templates/requirement-spec/uml-modeling.md | Measure-Object -Line`
Expected: 3（A.1/A.2/A.3 三图）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/requirement-spec/uml-modeling.md
git commit -m "feat(templates): 新增 UML 需求建模子模板 uml-modeling.md"
```

---

### Task 8: 批 1 父代理回归

- [ ] **Step 1: 验证 6 子模板齐全 + 主模板引用块完整**

Run: `Glob 'w-model-dev/templates/requirement-spec/*.md'`
Expected: 6 个文件（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）

Run: `Grep '详见 \[.*\.md\]' w-model-dev/templates/requirement-spec.md`
Expected: 6 处引用块，分别指向 6 个子模板对应产物文件名（system-context.md/glossary.md/traceability-matrix.md/behavior-spec.md/discipline-dod.md/uml-modeling.md）

- [ ] **Step 2: 提交批 1 汇总（如还有未提交改动）**

```bash
git add w-model-dev/templates/
git commit -m "feat(templates): 批1完成——主模板重构 + 6 独立子模板"
```

---

## 批 2：参考层（phase-1-requirements.md 扩展）

### Task 9: phase-1-requirements.md 算法扩步 + 失败模式 + 禁止行为 + 验收标准

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 1: 阅读现有算法与失败模式区**

Run: `Read w-model-dev/references/phase-1-requirements.md`（重点 §需求解析算法 35-80 行、§失败模式矩阵 279-300 行、§禁止行为 355-370 行、§返工路径 372-385 行、§验收标准 263-273 行）
Expected: 确认现有 6 步算法、FM-3D-01~07、禁止行为 #1-12、返工路径、验收标准

- [ ] **Step 2: 算法区新增步骤 7/8/9（在步骤 6 之后插入）**

在 `├─ 失败: 覆盖率不达标且未走豁免审批 → 回步骤 6，补覆盖或申请豁免` 之后追加：

```text
  7. 系统上下文与术语建模（第 37 轮新增）
     ├─ 识别外部实体（用户/外部系统/外部存储），产出 docs/phase1-requirements/system-context.md（外部实体清单 + 上下文边界原则）
     ├─ 提取需求域术语，对照 references/glossary.md 权威表，产出 docs/phase1-requirements/glossary.md（需求域术语子集）
     ├─ 主规格 §3/§4 引用块指向上述独立文件
     ├─ 失败: 外部实体边界模糊 → 标注待澄清，向用户确认
     └─ 成功: system-context.md + glossary.md 产出，主规格引用块成立
  8. UML 需求建模（第 37 轮新增）
     ├─ 基于步骤 2 层级树 + 步骤 5 REQ-group，产出 docs/phase1-requirements/uml-modeling.md A.1 用例图（参与者=stakeholder，用例=level≥2 REQ）
     ├─ 基于步骤 2 层级树，产出 A.2 领域类图（领域实体=level=1/2 REQ 名词性概念）
     ├─ 基于步骤 3 User Stories，产出 A.3 活动图（业务流程=正常场景 user story 序列）
     ├─ 主规格附录 A 引用块指向 uml-modeling.md
     ├─ 失败: 用例/领域实体/活动节点无法对应 REQ → 标注待澄清（FM-3D-09）
     └─ 成功: uml-modeling.md 三图产出，mermaid 块配平，主规格引用块成立
  9. 需求追踪矩阵与行为规格引用（第 37 轮新增）
     ├─ 基于步骤 2 层级树 + 步骤 5 REQ-group + 步骤 4 覆盖矩阵，产出 docs/phase1-requirements/traceability-matrix.md（§1 REQ/NFR 8 字段表 + §2 测试层级承接矩阵，仅验收列填实）
     ├─ 产出 docs/phase1-requirements/behavior-spec.md（列出本模块对应 .feature 文件清单 + 引用关系，不内联 feature 块）
     ├─ 主规格 §10/§12 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 2/5/4 不一致 → 回步骤 9 对齐（FM-3D-08）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，主规格引用块成立
```

- [ ] **Step 3: 执行方法论表新增产出物行**

在 §执行方法论（166-177 行）的产出物处追加：

```markdown
| 系统上下文 | 套用 `templates/requirement-spec/system-context.md` | `docs/phase1-requirements/system-context.md` |
| 术语表 | 套用 `templates/requirement-spec/glossary.md` | `docs/phase1-requirements/glossary.md` |
| UML 需求建模 | 套用 `templates/requirement-spec/uml-modeling.md`，mermaid 三图 | `docs/phase1-requirements/uml-modeling.md` |
| 需求追踪矩阵 | 套用 `templates/requirement-spec/traceability-matrix.md` | `docs/phase1-requirements/traceability-matrix.md` |
| 行为规格模型 | 套用 `templates/requirement-spec/behavior-spec.md`（引用 .feature 文件，不内联） | `docs/phase1-requirements/behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/requirement-spec/discipline-dod.md` | `docs/phase1-requirements/discipline-dod.md` |
| 主规格 | 套用 `templates/requirement-spec.md`（骨架 + §0 SSOT 头 + 引用块指向上述 6 文件） | `docs/phase1-requirements/requirement-spec.md` |
```

- [ ] **Step 4: 输出节补充独立产物说明**

在 §输出（15-20 行）追加：

```markdown
- 独立产物文件（第 37 轮新增，主规格引用块指向，均位于 `docs/phase1-requirements/`）：
  - `system-context.md`：系统上下文（外部实体清单 + 边界原则）
  - `glossary.md`：术语表（需求域子集）
  - `traceability-matrix.md`：需求追踪矩阵（8 字段表 + 测试层级承接矩阵）
  - `behavior-spec.md`：行为规格模型（引用 .feature 文件关系）
  - `discipline-dod.md`：工程纪律与 DoD 可勾选清单
  - `uml-modeling.md`：UML 需求建模（用例图 + 领域类图 + 活动图）
```

- [ ] **Step 5: 失败模式矩阵新增 FM-3D-08/09**

在 FM 矩阵表（FM-3D-07 行之后）追加：

```markdown
| FM-3D-08 | 追踪矩阵字段不一致 | traceability-matrix.md §1 的「候选落点§」与主规格 §4 层级树节点 § 不一致；「验收关联」与主规格 §7 覆盖矩阵不一致；§2 矩阵验收列与主规格 §12 RTM 不一致 | 回步骤 9 对齐追踪矩阵字段 |
| FM-3D-09 | UML 建模与层级树脱节 | uml-modeling.md A.1 用例图参与者/用例与主规格 §3 stakeholder/§4 REQ 不对应；A.2 领域类图实体与 §4 REQ 名词性概念不对应；A.3 活动图与 §3 User Stories 正常场景不对应 | 回步骤 8 对齐 UML 建模 |
```

- [ ] **Step 6: 禁止行为新增 #13/#14**

在禁止行为表（#12 行之后）追加：

```markdown
| 13 | 追踪矩阵字段与主规格 §4/§7/§12 不一致 | 步骤 9 须对齐 traceability-matrix.md 与主规格层级树/覆盖矩阵/RTM 登记（FM-3D-08） |
| 14 | UML 图表与层级树/User Stories 脱节 | uml-modeling.md 三图须对应主规格 §4 REQ/§3 stakeholder/§3 正常场景（FM-3D-09） |
```

- [ ] **Step 7: 返工路径补充**

在返工路径区（FM-3D-07 行之后）追加：

```markdown
- 追踪矩阵不一致（FM-3D-08）→ 回步骤 9，对齐 traceability-matrix.md 字段
- UML 脱节（FM-3D-09）→ 回步骤 8，对齐 uml-modeling.md 三图
```

- [ ] **Step 8: 验收标准补充**

在 §验收标准（263-273 行）追加 4 条：

```markdown
- [ ] system-context.md + glossary.md 已产出，主规格 §3/§4 引用块成立
- [ ] traceability-matrix.md（8 字段表 + 测试层级矩阵）与主规格 §4/§7/§12 一致，主规格 §10 引用块成立
- [ ] uml-modeling.md 三图与主规格 §3/§4 对应、mermaid 块配平，主规格附录 A 引用块成立
- [ ] behavior-spec.md + discipline-dod.md 已产出，主规格 §12/§16 引用块成立
```

- [ ] **Step 9: 提交**

```bash
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(references): phase-1 算法扩步 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14"
```

---

### Task 10: 批 2 父代理回归

- [ ] **Step 1: 一致性核对**

Run: `Grep 'FM-3D-0[89]\|禁止行为 #1[34]\|步骤 [789]' w-model-dev/references/phase-1-requirements.md`
Expected: 各出现且编号连续（FM-3D-08/09、禁止行为 #13/#14、步骤 7/8/9）

Run: `Grep 'system-context.md\|glossary.md\|traceability-matrix.md\|behavior-spec.md\|discipline-dod.md\|uml-modeling.md' w-model-dev/references/phase-1-requirements.md`
Expected: 6 个产物名在算法/执行方法论/输出节/验收标准中一致出现

- [ ] **Step 2: 提交批 2 汇总（如还有未提交改动）**

```bash
git add w-model-dev/references/
git commit -m "docs(references): 批2完成——phase-1 参考层扩展"
```

---

## 批 3：门禁层（脚本扩展）

### Task 11: graph-logic.ts 新增 R7/R8 + requirementSpecParse 工具

**Files:**
- Modify: `w-model-dev/scripts/graph-logic.ts`

- [ ] **Step 1: 阅读现有 GraphCheckResult 结构与 violations 模式**

Run: `Read w-model-dev/scripts/graph-logic.ts`（重点 118-140 行 GraphCheckResult、215-240 行 checkRequirementGraph 签名）
Expected: 确认 violations: string[] 字段、checkRequirementGraph(graph, options) 签名

- [ ] **Step 2: 新增 requirementSpecParse 纯函数（解析 markdown 表格 + 代码块 + 引用块）**

在 `checkRequirementGraph` 之前新增（纯函数，不碰 IO，供 CLI 层喂内容）：

```typescript
/** 解析 markdown 表格首行头 + 数据行（用于 traceability-matrix.md 解析） */
export function parseMarkdownTable(md: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());
    if (cells.length === 0) continue;
    // 表头分隔行（|---|）跳过
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
    if (rows.length === 0) {
      rows.push({ __header: cells.join('\u0001') } as unknown as Record<string, string>);
      continue;
    }
    const header = rows[0].__header.split('\u0001');
    const rec: Record<string, string> = {};
    cells.forEach((c, i) => {
      if (header[i]) rec[header[i]] = c;
    });
    rows.push(rec);
  }
  return rows.slice(1);
}

/** 统计 mermaid 代码块：校验 ```mermaid 与 ``` 定界行一一配对 */
export function countMermaidBlocks(md: string): { pairs: number; balanced: boolean } {
  const lines = md.split(/\r?\n/);
  let inMermaid = false;
  let opens = 0;
  let pairs = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t === '```mermaid') {
      if (inMermaid) { opens++; continue; } // 未配对 open → 计为不平衡
      inMermaid = true;
      opens++;
      continue;
    }
    if (inMermaid && t === '```') {
      inMermaid = false;
      pairs++;
    }
  }
  return { pairs, balanced: !inMermaid && opens === pairs };
}

/** 从 markdown 引用块提取指向同目录独立文件的文件名：> 详见 [xxx.md](./xxx.md) */
export function extractRefTargets(md: string): string[] {
  const targets: string[] = [];
  const re = /\[([\w.-]+\.md)\]\(\.\/([\w.-]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    targets.push(m[2]);
  }
  return targets;
}
```

> **注意**：三个纯函数签名须在 Task 14 vitest 单测中逐一覆盖；后续 Task 12 CLI 传 `--spec-dir` 时由 CLI 层读文件内容传入。

- [ ] **Step 3: 新增 R7/R8 校验函数（挂在 checkRequirementGraph 之后或独立导出）**

```typescript
export interface RequirementSpecEnhanceViolations {
  r7: string[];
  r8: string[];
}

/** R7 追踪矩阵一致性 + R8 UML mermaid 块配平（第 37 轮）
 *  @param traceMatrixContent  traceability-matrix.md 内容
 *  @param specContent         主规格 requirement-spec.md 内容（用于 §4 层级树 § 引用校验）
 *  @param umlContent          uml-modeling.md 内容
 *  @param rtmRequirementIds   RTM 登记的需求号集合（可选，为空则跳过 RTM 侧校验）
 */
export function checkRequirementSpecEnhance(
  traceMatrixContent: string,
  specContent: string,
  umlContent: string,
  rtmRequirementIds?: Set<string>,
): RequirementSpecEnhanceViolations {
  const v: RequirementSpecEnhanceViolations = { r7: [], r8: [] };
  // R8: mermaid 块配平（先于 R7，轻量）
  const mb = countMermaidBlocks(umlContent);
  if (!mb.balanced) {
    v.r8.push(`R8 UML mermaid 块配平失败：expect open==close pairs, got pairs=${mb.pairs} unbalanced`);
  }
  if (mb.pairs === 0) {
    v.r8.push('R8 UML mermaid 块缺失：uml-modeling.md 无 ```mermaid 代码块');
  }
  // R7: 追踪矩阵一致性
  const rows = parseMarkdownTable(traceMatrixContent);
  const specHasSection4 = /^##\s+4[\.\s]/.test(specContent);
  if (!specHasSection4) {
    v.r7.push('R7 追踪矩阵一致性失败：主规格缺 §4 层级树节（无法校验候选落点§）');
  }
  for (const row of rows) {
    const reqId = row['需求号'] ?? '';
    const loc = row['候选落点§'] ?? '';
    const acpt = row['验收关联'] ?? '';
    if (reqId && !/^(REQ|NFR)-/.test(reqId)) {
      v.r7.push(`R7 需求号格式失败：${reqId}（须 REQ-/NFR- 前缀）`);
    }
    if (loc && !/^§?\s*\d/.test(loc) && loc !== 'N/A') {
      v.r7.push(`R7 候选落点§ 引用失败：${reqId} 的候选落点§=${loc}（须指向主规格 §4 节点）`);
    }
    if (acpt && !/UAT-|§/.test(acpt)) {
      v.r7.push(`R7 验收关联失败：${reqId} 的验收关联=${acpt}（须含 UAT- 编号或主规格 §7 引用）`);
    }
    if (rtmRequirementIds && reqId && !rtmRequirementIds.has(reqId)) {
      v.r7.push(`R7 RTM 登记缺失：${reqId} 未在主规格 §12 RTM 登记`);
    }
  }
  if (rows.length === 0) {
    v.r7.push('R7 追踪矩阵为空：traceability-matrix.md 无数据行');
  }
  return v;
}
```

- [ ] **Step 4: TypeScript 编译检查**

Run: `npx tsc --noEmit -p w-model-dev/scripts/tsconfig.json`（若脚本目录有 tsconfig；否则 `npx tsc --noEmit --strict w-model-dev/scripts/graph-logic.ts`）
Expected: 0 错误

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat(scripts): graph-logic 新增 requirementSpecParse + R7/R8 校验"
```

---

### Task 12: check-requirement-graph.ts CLI 新增 --spec-dir

**Files:**
- Modify: `w-model-dev/scripts/check-requirement-graph.ts`

- [ ] **Step 1: 阅读 CLI 现有 --rtm 解析模式**

Run: `Read w-model-dev/scripts/check-requirement-graph.ts`（重点 66-110 行）
Expected: 确认 `--rtm=` 解析模式可仿照

- [ ] **Step 2: 新增 --spec-dir 参数解析 + R7/R8 接入**

在 `--exemptions` 解析之后追加：

```typescript
  // 解析 --spec-dir（第 37 轮：R7/R8 需求规格独立产物目录；含 requirement-spec.md / traceability-matrix.md / uml-modeling.md）
  const specDirArg = process.argv.slice(3).find(a => a.startsWith('--spec-dir='));
  let specEnhanceViolations: RequirementSpecEnhanceViolations | undefined;
  if (specDirArg) {
    const specDir = specDirArg.split('=')[1];
    if (specDir) {
      const fs = await import('node:fs');
      const specPath = path.join(specDir, 'requirement-spec.md');
      const tracePath = path.join(specDir, 'traceability-matrix.md');
      const umlPath = path.join(specDir, 'uml-modeling.md');
      const readOrEmpty = (p: string): string => {
        try {
          return fs.readFileSync(p, 'utf-8');
        } catch {
          return '';
        }
      };
      const specContent = readOrEmpty(specPath);
      const traceContent = readOrEmpty(tracePath);
      const umlContent = readOrEmpty(umlPath);
      const rtmIds = rtmRows ? new Set(rtmRows.map(r => r.requirementId)) : undefined;
      specEnhanceViolations = checkRequirementSpecEnhance(traceContent, specContent, umlContent, rtmIds);
      // 引用块完整性：主规格引用块指向的 6 文件须存在
      const refTargets = extractRefTargets(specContent);
      for (const t of refTargets) {
        if (!fs.existsSync(path.join(specDir, t))) {
          specEnhanceViolations.r7.push(`R7 引用块断裂：主规格引用 ${t} 但文件不存在`);
        }
      }
    }
  }
```

并在 import 处追加（现有 `import { checkRequirementGraph, recalculatePassed, type GraphShape } from './graph-logic.js';` 之后）：

```typescript
import {
  checkRequirementGraph,
  checkRequirementSpecEnhance,
  extractRefTargets,
  recalculatePassed,
  type GraphShape,
  type RequirementSpecEnhanceViolations,
} from './graph-logic.js';
```

在最终校验结果汇总处（`result.violations` 组装后、打印前）追加：

```typescript
  if (specEnhanceViolations) {
    for (const msg of specEnhanceViolations.r7) result.violations.push(msg);
    for (const msg of specEnhanceViolations.r8) result.violations.push(msg);
  }
```

> **注意**：`node:fs` 用顶层 import 即可（脚本已用 node:path），不必 `await import`；若 `node:fs` 未在文件顶部导入，加到顶部 import 区。

- [ ] **Step 3: 用法注释更新**

文件头部注释用法追加：

```text
 * 用法（第 37 轮新增 R7/R8）：
 *   npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> --phase=1 --spec-dir=docs/phase1-requirements [--rtm=<rtm.json>]
 *     --spec-dir  需求规格独立产物目录（含 requirement-spec.md / traceability-matrix.md / uml-modeling.md）
```

- [ ] **Step 4: 运行回归验证（复用既有样本，确认无破坏）**

Run: `cd w-model-dev && npx tsx scripts/check-requirement-graph.ts scripts/samples/graph/valid-*.json --phase=1`
Expected: 退出码 0（未传 --spec-dir 时 R7/R8 不激活，不改变既有行为）

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/check-requirement-graph.ts
git commit -m "feat(scripts): check-requirement-graph 新增 --spec-dir 接入 R7/R8"
```

---

### Task 13: gate-logic.ts + check-artifact-gate.ts 结构校验

**Files:**
- Modify: `w-model-dev/scripts/gate-logic.ts`
- Modify: `w-model-dev/scripts/check-artifact-gate.ts`

- [ ] **Step 1: 阅读 gate-logic.ts phaseOption 使用点**

Run: `Grep 'phaseOption' w-model-dev/scripts/gate-logic.ts`
Expected: 确认 phase 分支结构（line 265 `const phase = options?.phaseOption ?? 8`）

- [ ] **Step 2: 新增 checkRequirementSpecStructure 函数**

在 `gate-logic.ts` 新增（校验引用块指向文件存在 + §0 SSOT 头 + DoD 清单）：

```typescript
export interface RequirementSpecStructureViolations {
  refs: string[];
  ssot: string[];
  dod: string[];
}

/** Phase 1 需求规格结构校验（第 37 轮）：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param specDir   docs/phase1-requirements/ 目录（含 requirement-spec.md + 6 独立产物）
 */
export function checkRequirementSpecStructure(specDir: string, fs: { readFileSync(p: string): string; existsSync(p: string): boolean }): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const specPath = require('node:path').join(specDir, 'requirement-spec.md');
  if (!fs.existsSync(specPath)) {
    v.refs.push('structure: requirement-spec.md 不存在');
    return v;
  }
  const spec = fs.readFileSync(specPath);
  // 引用块完整性：6 个独立文件
  const requiredRefs = [
    'system-context.md',
    'glossary.md',
    'traceability-matrix.md',
    'behavior-spec.md',
    'discipline-dod.md',
    'uml-modeling.md',
  ];
  for (const ref of requiredRefs) {
    if (!/\[[\w.-]+\.md\]\(\.\/([\w.-]+\.md)\)/.test(spec)) {
      // 精确：引用块含 ref 文件名
      if (!spec.includes(`](./${ref})`)) {
        v.refs.push(`structure: 主规格缺引用块 → ${ref}`);
      }
    }
    if (!fs.existsSync(require('node:path').join(specDir, ref))) {
      v.refs.push(`structure: 引用文件不存在 ${ref}`);
    }
  }
  // §0 SSOT 头四项声明
  const ssotKeys = ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词'];
  for (const k of ssotKeys) {
    if (!spec.includes(k)) v.ssot.push(`structure: §0 SSOT 头缺「${k}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodPath = require('node:path').join(specDir, 'discipline-dod.md');
  if (fs.existsSync(dodPath)) {
    const dod = fs.readFileSync(dodPath);
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: discipline-dod.md DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  } else {
    v.dod.push('structure: discipline-dod.md 不存在（DoD 清单无法校验）');
  }
  return v;
}
```

> **注意**：TS 脚本不能用 `require`（ESM）。改为顶部 `import * as path from 'node:path'`（gate-logic.ts 可能已导入），用 `path.join`。fs 以参数注入保持纯逻辑可测（或直接用 node:fs 顶层导入）。

- [ ] **Step 3: gate-logic 校验结果接入 + check-artifact-gate CLI 传参**

在 `gate-logic.ts` 的 `runArtifactGate`（phase=1 分支）处，若 `options.specDir` 提供则调用：

```typescript
  // 第 37 轮：phase=1 且提供 specDir 时做需求规格结构校验
  let specStructure: RequirementSpecStructureViolations | undefined;
  if (phase === 1 && options.specDir) {
    specStructure = checkRequirementSpecStructure(options.specDir, fsModule);
    for (const m of [...specStructure.refs, ...specStructure.ssot, ...specStructure.dod]) {
      result.reasons.push(m);
    }
  }
```

在 `check-artifact-gate.ts` 解析 `--spec-dir` 参数并传入 `runArtifactGate`（`--phase=1 --spec-dir=docs/phase1-requirements`）：

```typescript
  const specDirArg = process.argv.slice(3).find(a => a.startsWith('--spec-dir='));
  const specDir = specDirArg?.split('=')[1] ?? undefined;
```

- [ ] **Step 4: 运行既有样本回归**

Run: `cd w-model-dev && npx tsx scripts/check-artifact-gate.ts scripts/samples/gate/valid-phase6.json`
Expected: 退出码 0（未传 --phase=1 --spec-dir 时不激活结构校验，不改变既有行为）

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/gate-logic.ts w-model-dev/scripts/check-artifact-gate.ts
git commit -m "feat(scripts): gate phase=1 新增引用块/SSOT/DoD 结构校验"
```

---

### Task 14: samples + self-test 基线 + vitest 单测

**Files:**
- Create: `w-model-dev/scripts/samples/graph/valid-spec-enhance.json`、`bad-spec-r7.json`、`bad-spec-r8.json`（R7/R8 各 1 bad + 1 共享 valid）
- Create: `w-model-dev/scripts/samples/gate/valid-requirement-spec-structure.json`、`bad-refs-missing.json`、`bad-ssot-header.json`、`bad-dod-incomplete.json`
- Modify: `w-model-dev/scripts/self-test.ts`
- Modify: `w-model-dev/scripts/__tests__/graph-logic.test.ts`
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **Step 1: 创建 graph samples（R7/R8）**

`w-model-dev/scripts/samples/graph/valid-spec-enhance.json`：

```json
{
  "sampleType": "graph-spec-enhance",
  "description": "R7/R8 通过样本：traceability-matrix.md 字段合法 + uml-modeling.md mermaid 块配平",
  "expectedPassed": true,
  "specDir": "docs/phase1-requirements",
  "traceabilityMatrix": "| 需求号 | 优先级 | owner | 需求陈述 | 候选子系统 | 候选落点§ | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| REQ-001 | P0 | owner | 陈述 | GROUP-A | §4.1 | UAT-001 | 响应 < 2s |\n| NFR-001 | P0 | owner | 陈述 | 横切 | §4.1 | UAT-002 | 可用性 ≥ 99% |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n```mermaid\nstateDiagram-v2\n  [*] --> S1\n```\n",
  "specContent": "## 4. 需求层级树\n"
}
```

`w-model-dev/scripts/samples/graph/bad-spec-r7.json`：

```json
{
  "sampleType": "graph-spec-enhance",
  "description": "R7 失败样本：候选落点§ 非法 + 验收关联缺 UAT/§",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R7 候选落点§", "R7 验收关联"],
  "specDir": "docs/phase1-requirements",
  "traceabilityMatrix": "| 需求号 | 优先级 | owner | 需求陈述 | 候选子系统 | 候选落点§ | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| REQ-001 | P0 | owner | 陈述 | GROUP-A | xxx | 无 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n",
  "specContent": "## 4. 需求层级树\n"
}
```

`w-model-dev/scripts/samples/graph/bad-spec-r8.json`：

```json
{
  "sampleType": "graph-spec-enhance",
  "description": "R8 失败样本：mermaid 块未配平",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R8 UML mermaid 块配平"],
  "specDir": "docs/phase1-requirements",
  "traceabilityMatrix": "| 需求号 | 优先级 | owner | 需求陈述 | 候选子系统 | 候选落点§ | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| REQ-001 | P0 | owner | 陈述 | GROUP-A | §4.1 | UAT-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n```mermaid\nclassDiagram\n  class E1 { +attr }\n",
  "specContent": "## 4. 需求层级树\n"
}
```

> **注意**：self-test 框架需在 Task 14 Step 4 中扩展以支持新样本类型（从 JSON 的 specDir/traceabilityMatrix/umlModeling/specContent 字段构造 `checkRequirementSpecEnhance` 输入）。若 self-test.ts 现有样本驱动模式不匹配，则改为 vitest 覆盖 + self-test 注册 3 条 graph 样本计数。

- [ ] **Step 2: 创建 gate samples（结构校验）**

`w-model-dev/scripts/samples/gate/valid-requirement-spec-structure.json`、`bad-refs-missing.json`、`bad-ssot-header.json`、`bad-dod-incomplete.json` 四个样本，字段结构：

```json
{
  "sampleType": "gate-requirement-spec-structure",
  "description": "…",
  "expectedPassed": true,
  "specDir": "docs/phase1-requirements",
  "specContent": "> **文档版本**…\n> **SSOT 声明**…\n> **自身校验**…\n> **禁止占位词**…\n> 系统上下文详见 [system-context.md](./system-context.md)\n> 术语表详见 [glossary.md](./glossary.md)\n> 需求追踪矩阵详见 [traceability-matrix.md](./traceability-matrix.md)\n> 行为规格模型详见 [behavior-spec.md](./behavior-spec.md)\n> Phase 1 工程纪律与 DoD 详见 [discipline-dod.md](./discipline-dod.md)\n> UML 需求建模详见 [uml-modeling.md](./uml-modeling.md)\n",
  "dodContent": "- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] f\n- [ ] g\n- [ ] h\n- [ ] i\n",
  "refFiles": ["system-context.md", "glossary.md", "traceability-matrix.md", "behavior-spec.md", "discipline-dod.md", "uml-modeling.md"]
}
```

> bad 变体：`bad-refs-missing.json`（refFiles 缺 1 个 + 引用块缺对应行）、`bad-ssot-header.json`（specContent 缺「自身校验」）、`bad-dod-incomplete.json`（dodContent 仅 5 项）。self-test/gate 逻辑用内存 fs stub 模拟文件存在性（不落真实 docs/ 目录）。

- [ ] **Step 3: self-test.ts 基线 217→225 注册**

在 `self-test.ts` 的 SAMPLES 数组末尾追加 8 条（3 graph-spec-enhance + 4 gate-requirement-spec-structure + 1 计数占位），并把基线常量 217 改为 225：

```typescript
// 第 37 轮：R7/R8 graph 样本 3 条 + gate 结构校验样本 4 条 + 1 计数
```

> **注意**：以 `npm run self-test` 实际输出为准——若当前基线非 217（历史上 192→213→217 波动），按"当前基线 + 8"更新并记录实际值；运行 `npm run self-test` 确认全通过。

- [ ] **Step 4: vitest 单测**

`__tests__/graph-logic.test.ts` 追加：

```typescript
import { checkRequirementSpecEnhance, countMermaidBlocks, parseMarkdownTable } from '../graph-logic.js';

describe('R7 追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '```mermaid\ngraph TB\n  A --> B\n```\n',
    );
    expect(v.r7).toEqual([]);
  });
  it('候选落点§ 非法报 R7', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | xxx | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '',
    );
    expect(v.r7.some(m => m.includes('候选落点§'))).toBe(true);
  });
});

describe('R8 UML mermaid 块配平', () => {
  it('配平通过', () => {
    const { balanced, pairs } = countMermaidBlocks('```mermaid\na\n```\n```mermaid\nb\n```\n');
    expect(balanced).toBe(true);
    expect(pairs).toBe(2);
  });
  it('未配平报 R8', () => {
    const v = checkRequirementSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r8.some(m => m.includes('配平'))).toBe(true);
  });
});
```

`__tests__/gate-enhancement.test.ts` 追加：

```typescript
import { checkRequirementSpecStructure } from '../gate-logic.js';

describe('Phase 1 需求规格结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      if (!(p in files)) throw new Error(`missing ${p}`);
      return files[p];
    },
    existsSync(p: string): boolean {
      return p in files;
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const files: Record<string, string> = {};
    const refs = ['system-context.md', 'glossary.md', 'traceability-matrix.md', 'behavior-spec.md', 'discipline-dod.md', 'uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    for (const r of refs) files[`docs/phase1-requirements/${r}`] = '';
    files['docs/phase1-requirements/requirement-spec.md'] = spec;
    files['docs/phase1-requirements/discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkRequirementSpecStructure('docs/phase1-requirements', mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase1-requirements/requirement-spec.md'] = '> 详见 [x](./system-context.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase1-requirements/discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkRequirementSpecStructure('docs/phase1-requirements', mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: 全量回归**

Run: `cd w-model-dev && npm run self-test`
Expected: 退出码 0，基线 225 全通过

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 全部通过（含新增 R7/R8 + 结构校验单测）

Run: `npx tsc --noEmit -p w-model-dev/tsconfig.json`（或脚本对应 tsconfig）
Expected: TypeScript strict 0 错误

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/samples/ w-model-dev/scripts/self-test.ts w-model-dev/scripts/__tests__/
git commit -m "test(scripts): R7/R8 + 结构校验 samples/self-test/vitest（基线 217→225）"
```

---

### Task 15: 批 3 父代理回归

- [ ] **Step 1: 全量门禁验证**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 全部通过，0 错误

Run: `npx tsx scripts/check-requirement-graph.ts scripts/samples/graph/valid-spec-enhance.json --phase=1 --spec-dir=<temp-dir>`（temp-dir 放置 valid 三文件）
Expected: 退出码 0

- [ ] **Step 2: 提交批 3 汇总（如还有未提交改动）**

```bash
git add w-model-dev/scripts/
git commit -m "feat(scripts): 批3完成——R7/R8 + 结构校验 + 回归基线 225"
```

---

## 批 4：同步层（verifier-spec / SKILL / SSoT / 版本号 / 顶层文档）

### Task 16: verifier-spec.md 评审新增项

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 阅读 completeness 维度现有条款**

Run: `Grep 'completeness' w-model-dev/references/verifier-spec.md`
Expected: 定位 completeness 维度评审项

- [ ] **Step 2: completeness 维度追加 Phase 1 结构评审项**

在 completeness 维度阶段 1 相关处追加：

```markdown
- 阶段 1 需求规格结构完整性（第 37 轮）：
  - 主规格 §3/§4/§10/§12/§16/附录 A 引用块指向的 6 个独立文件（system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）均存在且内容非空
  - traceability-matrix.md 字段与主规格 §4 层级树 / §7 覆盖矩阵 / §12 RTM 一致（对应 R7 门禁）
  - uml-modeling.md mermaid 三图配平且与主规格 §3/§4 对应（对应 R8 门禁）
  - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
```

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(references): verifier-spec completeness 维度新增 Phase 1 结构评审项"
```

---

### Task 17: SKILL.md + skill-metadata.json + package.json 版本号 37.0.0

**Files:**
- Modify: `w-model-dev/SKILL.md`
- Modify: `w-model-dev/skill-metadata.json`
- Modify: `package.json`

- [ ] **Step 1: 阅读 SKILL.md 版本号与阶段路由表**

Run: `Grep 'version\|36.0.0\|phase-1-requirements\|check-requirement-graph' w-model-dev/SKILL.md | Select-Object -First 20`
Expected: 定位 frontmatter version、阶段路由表 Phase 1 行、门禁脚本清单

- [ ] **Step 2: SKILL.md 三处更新**

frontmatter：

```yaml
version: 37.0.0
```

阶段路由表 Phase 1 行追加必读/产出说明（保持原行结构，追加第 37 轮标注）：

```markdown
阶段 1（需求分析）：套用 templates/requirement-spec.md 主模板 + 6 独立子模板（templates/requirement-spec/），产出 docs/phase1-requirements/ 下 requirement-spec.md + system-context.md + glossary.md + traceability-matrix.md + behavior-spec.md + discipline-dod.md + uml-modeling.md；G 门禁 check-requirement-graph.ts --phase=1 --spec-dir=docs/phase1-requirements（R7/R8）+ check-artifact-gate.ts --phase=1 --spec-dir=docs/phase1-requirements（结构校验）
```

快速自检清单（如有 Phase 1 项）追加：

```markdown
- [ ] Phase 1 需求规格：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
```

- [ ] **Step 3: skill-metadata.json 版本号**

```json
{ "version": "37.0.0" }
```

- [ ] **Step 4: package.json 版本号**

```json
{ "version": "37.0.0" }
```

- [ ] **Step 5: 版本号一致性核验**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 三处均为 37.0.0

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json package.json
git commit -m "chore: 版本号三处一致 37.0.0（第 37 轮 Phase 1 设计级别增强）"
```

---

### Task 18: SSoT + AGENTS.md + CHANGELOG.md + README.md

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: 阅读 SSoT §3.4 最近条目与 §10A 追溯表格式**

Run: `Grep '3.4.3[0-9]\|第 3[0-9] 轮\|第 3[0-9]\.[0-9] 轮' docs/skill-design-document_SSoT.md | Select-Object -First 10`
Expected: 定位最新轮次条目编号（预计 3.4.34 或更高），确定新增条目号

- [ ] **Step 2: SSoT 新增 §3.4.xx 条目**

在最新轮次条目之后追加（内容对齐 spec §9 对应关系总表 + §10 决策记录要点）：

```markdown
#### 第 37 轮（2026-08-09）：Phase 1 需求分析设计级别增强（SSoT §3.4.xx）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求 Phase 1 需求分析产出达到 DESIGN.md 级别结构严谨性 |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守需求域边界 |
| 新增模板 | 6 独立子模板（templates/requirement-spec/：system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）+ 主模板 requirement-spec.md 重构（§0 SSOT 头 + 引用块） |
| 参考扩展 | phase-1-requirements.md 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R7（追踪矩阵一致性）/R8（UML mermaid 配平）+ --spec-dir；check-artifact-gate.ts phase=1 新增引用块完整性/SSOT 头/DoD 清单校验 |
| 移除 | 附录 B 内联 feature 集（bdd .feature 文件 + bdd-manifest.json 承接） |
| 决策 | 6 项拆独立产物文件（主规格引用块串联，对齐 SKILL.md 引用 references/ 模式）；UML 仅用例图+领域类图+活动图（状态机由 TLA+/BDD 覆盖）；不向后兼容 |
| self-test | 基线 217→225 |
| 版本号 | 37.0.0（三处一致） |
```

§10A 追溯表追加一行（格式对齐既有行）：`| §3.4.xx | 第 37 轮 Phase 1 设计级别增强 |`

- [ ] **Step 3: AGENTS.md §4 新增第 37 轮条目**

在 AGENTS.md §1 列表末尾追加：

```markdown
- **第 37 轮 Phase 1 设计级别增强**：阶段 1 需求规格产出升级——主模板 + 6 独立子模板（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling），主规格引用块串联，移除内联 feature 集（bdd 承接）；`check-requirement-graph.ts` 新增 R7/R8（--spec-dir），`check-artifact-gate.ts --phase=1` 新增引用块/SSOT/DoD 校验。反模式总数 44 不变（仅 phase-1-requirements.md 内 FM-3D-08/09 + 禁止行为 #13/#14）。详见 SSoT §3.4.xx。
```

- [ ] **Step 4: CHANGELOG.md [37.0.0] 条目**

```markdown
## [37.0.0] - 2026-08-09

### Added
- Phase 1 需求规格 6 独立子模板（system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）
- check-requirement-graph.ts R7（追踪矩阵一致性）/ R8（UML mermaid 块配平）+ --spec-dir 参数
- check-artifact-gate.ts --phase=1 引用块完整性 / §0 SSOT 头 / DoD 清单校验

### Changed
- requirement-spec.md 主模板重构（§0 SSOT 头 + 引用块串联）
- phase-1-requirements.md 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14
- verifier-spec.md completeness 维度新增 Phase 1 结构评审项
- self-test 基线 217→225；版本号 36.0.0 → 37.0.0

### Removed
- 需求规格内联 BDD feature 集（由 bdd .feature 文件 + bdd-manifest.json 承接）
```

- [ ] **Step 5: README.md 能力 bullet（如有 Phase 1 能力清单）**

Run: `Grep '需求分析\|Phase 1\|阶段 1' README.md`
Expected: 定位能力描述区；如有阶段 1 能力 bullet，追加「设计文档级结构：6 独立产物 + 引用块 + 门禁核验」

- [ ] **Step 6: 全量回归**

Run: `cd w-model-dev && npm run self-test && npx vitest run`
Expected: 退出码 0 全通过

Run: `npm run prepush`（若 hooks 已启用）或手动 6 项门禁
Expected: 全通过

- [ ] **Step 7: 提交**

```bash
git add docs/skill-design-document_SSoT.md AGENTS.md CHANGELOG.md README.md
git commit -m "docs: SSoT/AGENTS/CHANGELOG/README 第 37 轮同步（37.0.0）"
```

---

### Task 19: 批 4 父代理回归 + 计划验收

- [ ] **Step 1: 版本号三处一致 + 引用可达**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 37.0.0 × 3

Run: `Grep 'templates/requirement-spec/' w-model-dev/SKILL.md w-model-dev/references/phase-1-requirements.md w-model-dev/references/verifier-spec.md`
Expected: 引用一致

- [ ] **Step 2: 全量门禁终检**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 退出码 0，0 错误，基线 225

- [ ] **Step 3: 完成声明**

向用户汇报：批 1-4 全部完成，self-test 225 / vitest / tsc strict 全通过，版本号 37.0.0 三处一致。

---

## Self-Review 对照表

| Spec 章节要求 | 对应 Task | 覆盖 |
|---|---|---|
| 主模板重构（§0 SSOT 头 + 引用块） | Task 1 | ✅ |
| 6 独立子模板（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling） | Task 2-7 | ✅ |
| phase-1 算法增步骤 7/8/9 + 执行方法论表 | Task 9 Step 2/3 | ✅ |
| FM-3D-08/09 + 禁止行为 #13/#14 + 返工路径 | Task 9 Step 5/6/7 | ✅ |
| 验收标准补充 4 条 | Task 9 Step 8 | ✅ |
| check-requirement-graph R7/R8 + --spec-dir | Task 11/12 | ✅ |
| gate phase=1 引用块/SSOT/DoD | Task 13 | ✅ |
| samples 8 条 + self-test 217→225 + vitest | Task 14 | ✅ |
| verifier-spec 评审新增项 | Task 16 | ✅ |
| SKILL/skill-metadata/package 版本号 37.0.0 | Task 17 | ✅ |
| SSoT/AGENTS/CHANGELOG/README | Task 18 | ✅ |
| 批间父代理回归 + 全量门禁 | Task 8/10/15/19 | ✅ |
| 内联 feature 集移除（无附录 B） | 主模板 Task 1 不含附录 B + behavior-spec 仅引用 | ✅ |
| 命名修正（无 module 前缀，遵循 directory-conventions §1） | 计划头声明 + Task 9/12/13 使用无前缀命名 | ✅ |
