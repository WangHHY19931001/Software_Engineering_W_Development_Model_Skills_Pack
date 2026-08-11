# Phase 2 系统设计产出达到设计文档级别 — 实施计划（小轮 A / 38.0.0）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 W 模型技能包 Phase 2（系统设计）产出提升到 DESIGN.md 级别的结构严谨性：6 项增强内容拆为独立产物文件（主模板引用块串联），通过门禁脚本可机械核验，严守阶段边界（不落接口/类级）。

**Architecture:** 三层联动——模板层（主模板 system-design.md 重构 + 6 独立子模板）、参考层（phase-2-system-design.md 算法扩步 + FM-SD-01~05 + 禁止行为 #6/#7/#8）、门禁层（check-requirement-graph.ts 新增 R9/R10 + check-artifact-gate.ts --phase=2 新增引用块/SSOT/DoD 校验）。严守系统设计域边界，不侵入 Phase 3/4。

**Tech Stack:** Markdown 模板/参考、TypeScript（tsx runtime + ajv）、vitest、self-test.ts 回归基线、mermaid（UML 建模）。

**Spec:** [2026-08-09-design-phases-level-enhancement-design.md](../specs/2026-08-09-design-phases-level-enhancement-design.md)

**命名约定（相对 spec 澄清）**：Phase 2 产物带 `{module}-` 前缀（遵循 [directory-conventions.md](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/references/directory-conventions.md) §1），位于 `docs/phase2-design/`；独立产物命名为 `{module}-system-architecture.md` / `{module}-glossary.md` / `{module}-traceability-matrix.md` / `{module}-behavior-spec.md` / `{module}-discipline-dod.md` / `{module}-uml-modeling.md`，主文档 `{module}-system-design.md` 引用块指向同目录。子模板放 `templates/system-design/` 目录（与主模板 `templates/system-design.md` 同名目录，对齐 templates/ 已有目录结构惯例）。

**批次与约束**：4 批串行（模板→参考→门禁→同步），每批完成后父代理回归。**禁止并行修改**（用户偏好：文档修改必须准确无冲突）。所有脚本改动须 `npm run self-test` + `npx vitest run` 全通过 + TypeScript strict 0 错误。版本号三处一致 38.0.0。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `w-model-dev/templates/system-design.md` | 重构 | 主模板：§0 SSOT 头 + 保留 §1-§5 + 新增 §6-§10/附录 A 引用块 |
| `w-model-dev/templates/system-design/system-architecture.md` | 新增 | 系统架构子模板 |
| `w-model-dev/templates/system-design/glossary.md` | 新增 | 术语表子模板 |
| `w-model-dev/templates/system-design/traceability-matrix.md` | 新增 | 追踪矩阵子模板 |
| `w-model-dev/templates/system-design/behavior-spec.md` | 新增 | 行为规格模型（L2 引用）子模板 |
| `w-model-dev/templates/system-design/discipline-dod.md` | 新增 | 工程纪律与 DoD 子模板 |
| `w-model-dev/templates/system-design/uml-modeling.md` | 新增 | UML 系统级建模子模板 |
| `w-model-dev/references/phase-2-system-design.md` | 修改 | 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 + 验收标准 + 执行方法论表 + 输出节 |
| `w-model-dev/scripts/logic/graph-logic.ts` | 修改 | 新增 R9/R10 校验函数 |
| `w-model-dev/scripts/cli/check-requirement-graph.ts` | 修改 | CLI 新增 `--spec-dir` 按 module 前缀 glob 匹配 |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改 | 新增 `checkPhaseSpecStructure()` 泛化 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | 修改 | phase=2 调用结构校验 |
| `w-model-dev/scripts/samples/graph/` | 新增 | R9/R10 各 1 valid + 1 bad（4 条） |
| `w-model-dev/scripts/samples/gate/` | 新增 | phase=2 结构校验 1 valid + 3 bad（4 条） |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | 基线 225→233 |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 修改 | R9/R10 单测 |
| `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` | 修改 | phase=2 结构校验单测 |
| `w-model-dev/references/verifier-spec.md` | 修改 | V 评审新增项 |
| `w-model-dev/SKILL.md` | 修改 | 阶段路由表 Phase 2 行 + 快速自检清单 + 版本号 |
| `w-model-dev/skill-metadata.json` | 修改 | 版本号镜像 |
| `package.json` | 修改 | 版本号 |
| `docs/skill-design-document_SSoT.md` | 修改 | §3.4.xx 条目 + §10A 追溯表 |
| `AGENTS.md` | 修改 | §1 第 38 轮条目 |
| `CHANGELOG.md` | 修改 | [38.0.0] 条目 |
| `README.md` | 修改 | 能力 bullet（如有） |

---

## 批 1：模板层（主模板 + 6 独立子模板）

### Task 1: 主模板 system-design.md 重构（§0 SSOT 头 + 引用块，保留既有节号）

**Files:**
- Modify: `w-model-dev/templates/system-design.md`（全部重写）

- [ ] **Step 1: 阅读现有主模板全文**

Run: `Read w-model-dev/templates/system-design.md`
Expected: 确认现有节（文档信息 / 1 系统架构 / 2 技术选型 / 3 模块划分 / 4 部署架构 / 5 系统测试用例索引）

- [ ] **Step 2: 重写主模板文件**

将 `system-design.md` 重写为如下结构（保留原有节内容体，仅插入引用块并追加新节）：

```markdown
# 系统设计文档

> **模板版本**：v2.0（第 38 轮设计级别增强：§0 SSOT 头 + 6 独立产物文件引用块）
> 套用本模板时，引用块指向同目录独立文件，独立文件套用
> `templates/system-design/` 下对应子模板。产出物见
> `references/phase-2-system-design.md` §执行方法论。

## 文档信息

- 项目名称：{{项目名称}}
- 文档版本：{{v1.0}}
- 编制日期：{{YYYY-MM-DD}}
- 关联需求文档：{{需求规格说明书路径}}

## 0. 文档定位与 SSOT 头

> **文档版本**：v{{1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本系统设计文档为阶段 2（系统设计）的唯一设计事实来源。设计变更须经
>   阶段门评审 / 上游需求变更回流，不得无痕修改。
> **自身校验**：本文档以结构完整性为准——引用块指向的独立文件存在、
>   {{module}}-system-architecture.md 子系统清单与 §3 模块划分一一对应、
>   {{module}}-traceability-matrix.md 字段与 §3 模块划分一致、
>   {{module}}-uml-modeling.md mermaid 块配平。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在 §10 非目标显式标注中。
> **与需求规格关系**：本文档承接阶段 1《需求规格说明书》（外部实体/边界见
>   phase1-requirements 的 system-context.md），系统内部架构由本文档承载；
>   接口/类级设计事实由阶段 3/4 产出的设计文档承载，不在本文档描述。
> **行为规格承接**：L2 行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），
>   本文档 §8 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

## 1. 系统架构

> 系统架构详见 [{{module}}-system-architecture.md](./{{module}}-system-architecture.md)
> （组件图 / 子系统清单 / 系统树 / 架构原则 / ADR / 系统行为总览 / 运行时架构）。
> 本节约保留架构风格说明与架构图骨架（mermaid），详述见独立文件。

### 1.1 架构图

```mermaid
graph TD
    {{架构节点与连线}}
```

### 1.2 架构风格说明

{{分层 / 微服务 / 等及理由}}

## 2. 技术选型

| 层次 | 技术 | 版本 | 选型理由（5 维度评分依据） |
|---|---|---|---|
| 前端 | {{React + TypeScript}} | {{}} | {{适用性/成熟度/可维护性/引入成本/风险敞口评分}} |
| 后端 | {{Node.js + Express}} | {{}} | {{}} |
| 数据库 | {{MongoDB + Redis}} | {{}} | {{}} |
| 其他 | {{}} | {{}} | {{}} |

## 3. 模块划分

| 模块 ID | 模块名 | 职责 | 关联需求 |
|---|---|---|---|
| M-001 | {{用户管理}} | {{职责}} | REQ-001 |

> 模块 ID 编号须与 {{module}}-system-architecture.md §2 子系统清单一致（R9 门禁校验）。

## 4. 部署架构

{{部署图、环境说明}}

## 5. 系统测试用例索引

> 详细用例见对应测试用例文档。

| 用例 ID | 关联模块 | 场景 | 优先级 |
|---|---|---|---|
| ST-001 | M-001 | {{系统级场景}} | 高 |

## 6. 核心概念与术语

> 术语表详见 [{{module}}-glossary.md](./{{module}}-glossary.md)
> （系统设计域术语子集，引用 references/glossary.md 权威表）。

## 7. 系统设计追踪矩阵

> 追踪矩阵详见 [{{module}}-traceability-matrix.md](./{{module}}-traceability-matrix.md)
> （SD×需求 8 字段表 + 测试层级承接矩阵，仅系统/验收列填实）。

## 8. 行为规格模型（L2）

> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)
> （引用 L2 .feature 文件关系，不内联 feature 块）。

## 9. Phase 2 工程纪律与 DoD

> Phase 2 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)
> （§1 阶段纪律 + §2 DoD 可勾选清单）。

## 10. 设计边界与非目标

- {{非目标 1}}（例：本设计不覆盖接口契约细节，接口设计由阶段 3 承载）
- {{非目标 2}}
- …

## 附录 A. UML 系统级建模

> UML 系统级建模详见 [{{module}}-uml-modeling.md](./{{module}}-uml-modeling.md)
> （部署图 / 顶层组件图 / 包图 / 用例图，mermaid）。
```

> **注意**：主模板节号保持既有 §1-§5 编号体系不变（`tla-spec-template.md` 以 `:§3.2` 跨引用，不可移动）。6 个引用块节追加为 **§6 术语 / §7 追踪矩阵 / §8 行为规格 / §9 DoD / §10 设计边界与非目标 / 附录 A. UML 系统级建模**。门禁按引用块文件名校验（`[name](./xxx.md)`），不依赖节号。

- [ ] **Step 3: 自检模板结构**

Run: `Grep '^## ' w-model-dev/templates/system-design.md`
Expected: 含 `0. 文档定位与 SSOT 头`、`6. 核心概念与术语`、`7. 系统设计追踪矩阵`、`8. 行为规格模型（L2）`、`9. Phase 2 工程纪律与 DoD`、`10. 设计边界与非目标`、`附录 A. UML 系统级建模` 引用块节；`1. 系统架构` / `2. 技术选型` / `3. 模块划分` / `4. 部署架构` / `5. 系统测试用例索引` 保留

Run: `Grep '### 1.1 架构图' w-model-dev/templates/system-design.md`
Expected: §1 保留架构图骨架

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/templates/system-design.md
git commit -m "feat(templates): system-design 主模板重构（§0 SSOT 头 + 6 独立文件引用块，保留 §1-§5 节号）"
```

---

### Task 2: 系统架构子模板 system-architecture.md

**Files:**
- Create: `w-model-dev/templates/system-design/system-architecture.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 系统架构（System Architecture）

> 对应 DESIGN.md §5 顶层架构 + §8 系统行为总览 + §9 运行时架构。系统级设计：
> 组件图 / 子系统清单 / 系统树 / 架构原则 / ADR / 行为总览 / 运行时架构。
> **阶段边界**：本文件只产系统级设计，不落接口契约（阶段 3）与类/方法定义（阶段 4），越界即返工（FM-SD-06）。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 系统架构详见 [{{module}}-system-architecture.md](./{{module}}-system-architecture.md)`。

## 1. 顶层组件图

> 体现分层 + 组件间依赖 + 数据流（须含 `-.->` 或 `>>` 数据流箭头，缺则 FM-SD-01）。

```mermaid
graph TB
  {{组件1}} -->|依赖| {{组件2}}
  {{组件2}} -.->|数据流| {{组件3}}
```

## 2. 规范性子系统清单

| 子系统 ID | 名称 | 职责 | 涉及模块 ID |
|---|---|---|---|
| S-{{xx}} | {{名称}} | {{职责}} | M-{{xx}} |

> 强制：子系统 ID 与主模板 §3 模块划分一一对应（R9 门禁校验；不对应 → 回步骤 3）。

## 3. 系统树

```mermaid
graph TD
  {{系统}} --> {{子系统1}}
  {{系统}} --> {{子系统2}}
```

## 4. 架构原则

- {{原则 1}}（例：分层单向依赖，禁止反向依赖）
- {{原则 2}}

## 5. 架构决策记录（ADR）

| ADR 编号 | 决策 | 上下文 | 后果 |
|---|---|---|---|
| ADR-{{xx}} | {{决策}} | {{上下文}} | {{后果（含代价/收益）}} |

> 强制：每条 ADR 有决策 + 上下文 + 后果（缺则 FM-SD-02）。

## 6. 系统行为总览

- 对外行为：{{系统向外部提供的可观察行为}}
- 对内行为：{{子系统间内部协作行为}}
- 关键分叉行为：{{需要人参与/升级/终止的关键分叉}}

## 7. 运行时架构

- 运行时组件：{{运行时主要组件清单}}
- 核心对象（概念级）：{{运行时核心对象，仅概念级描述}}
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/system-design/system-architecture.md`
Expected: 含「顶层组件图」「规范性子系统清单」「系统树」「架构原则」「ADR」「系统行为总览」「运行时架构」+ 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/system-architecture.md
git commit -m "feat(templates): 新增系统架构子模板 system-architecture.md"
```

---

### Task 3: 术语表子模板 glossary.md

**Files:**
- Create: `w-model-dev/templates/system-design/glossary.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 术语表（Glossary）

> 对应 DESIGN.md §3 核心概念与术语。系统设计域术语子集；全量术语权威表见 `references/glossary.md`，
> 本文件仅收录本项目系统设计域新引入/易混淆术语，引用权威表编号。
> **阶段边界**：只收系统设计域术语（架构/子系统/部署/ADT 等），接口/类级术语由阶段 3/4 术语表承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 术语表详见 [{{module}}-glossary.md](./{{module}}-glossary.md)`。

## 术语表

| 术语 | 定义 | 来源引用（references/glossary.md 或设计原文） |
|---|---|---|
| {{术语}} | {{定义}} | {{来源}} |

> 强制：每条术语有定义 + 来源引用；与 `references/glossary.md` 权威表冲突时以权威表为准并在此标注差异。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/system-design/glossary.md`
Expected: 含术语表 + 来源引用列 + 权威表优先级声明 + 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/glossary.md
git commit -m "feat(templates): 新增术语表子模板 glossary.md"
```

---

### Task 4: 追踪矩阵子模板 traceability-matrix.md

**Files:**
- Create: `w-model-dev/templates/system-design/traceability-matrix.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 系统设计追踪矩阵（Traceability Matrix）

> 对应 DESIGN.md §2.1.1 需求条目化追踪矩阵。Phase 2 适配：SD 编号 → 主模板 §3 模块划分模块 ID。
> **阶段边界**：本文件是系统设计级追踪（SD×需求），接口级（INTF×SD）与类级（DD×INTF）追踪由阶段 3/4 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 追踪矩阵详见 [{{module}}-traceability-matrix.md](./{{module}}-traceability-matrix.md)`。

## 1. SD×需求 8 字段表

| SD 编号 | 对应需求号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |
|---|---|---|---|---|---|---|---|
| SD-{{xx}} | REQ-{{xxx}} | P0 | {{主模板 §3 模块 ID}} | S-{{xx}} | {{设计完成/待编码}} | {{ST-NNN / UAT-NNN}} | {{可判定表达式}} |

> 强制：`设计落点§` 指向主模板 §3 模块 ID；`对应需求号` 与 phase1 追踪矩阵一致（R9 门禁校验）。

## 2. 需求×测试层级承接矩阵

| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |
|---|---|---|---|---|
| REQ-{{xxx}} | ―（pending 阶段 5） | ―（pending 阶段 6） | ● ST-{{NNN}} | ● UAT-{{NNN}} + 判据 |
| NFR-{{xxx}} | ― | ― | ● ST-{{NNN}} | ● UAT-{{NNN}} + 双字段判据 |

> 矩阵每格 ●/― 为设计事实的测试层级承接归属；Phase 2 仅系统/验收列填实，
> 单元/集成列 pending 由阶段 3/4 回填 RTM 时同步（主模板 §5 系统测试用例索引 + RTM 登记）。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/system-design/traceability-matrix.md`
Expected: 含 §1 字段表（8 列）+ §2 测试层级承接矩阵（5 列）+ pending 语义声明 + 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/traceability-matrix.md
git commit -m "feat(templates): 新增追踪矩阵子模板 traceability-matrix.md"
```

---

### Task 5: 行为规格模型子模板 behavior-spec.md

**Files:**
- Create: `w-model-dev/templates/system-design/behavior-spec.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 行为规格模型（Behavior Spec，L2）

> 对应 DESIGN.md §7 行为规格模型。**本文件仅定义引用关系，不内联 feature 块、不定义文档级头规范**——
> `.feature` 文件由 `references/bdd-guide.md` §2 头规范管（@req/@design/@designIds/@system/@tla-spec/@state-machine 等 10 字段），
> `bdd-manifest.json` 登记 feature 资产。**阶段边界**：本文件只定义 L2（系统级）行为规格引用，L3/L4 由阶段 3/4 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)`。

## 1. L2 行为规格角色

- L2 行为规格在系统设计阶段的角色：以可执行场景（Given/When/Then）验证系统级行为可被验收
- 行为规格与架构描述互补：行为规格验证"系统行为如何被接受"，架构描述定义"系统如何组织"
- 行为规格不替代架构描述，也不替代 TLA+ 行为正确性基准（.tla 文件）

## 2. 与 .feature 文件的引用关系

| SD / 子系统 | 对应 .feature 文件 | 关键场景（Scenario 名） | bdd-manifest 登记 |
|---|---|---|---|
| SD-{{xx}} | `features/L2/{{system}}_{{subsystem}}-{{num}}.feature` | {{Scenario 名}} | {{是/否}} |

> 强制：每个 L2 行为规格条目列出对应 .feature 文件路径；`.feature` 文件存在性由 `check-bdd-model.ts` D1-D7 校验。

## 3. 与系统设计文档的关系

- 行为规格条目须能回溯到主文档 §3 模块划分 / phase1 需求规格（无孤儿行为规格）
- 行为规格新增/变更须同步主文档 §7 追踪矩阵 + RTM 登记，禁止只改 .feature 不回填
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/system-design/behavior-spec.md`
Expected: 含「不内联 feature 块」声明 + 引用关系表 + 强制回溯声明 + 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/behavior-spec.md
git commit -m "feat(templates): 新增行为规格模型子模板 behavior-spec.md"
```

---

### Task 6: 工程纪律与 DoD 子模板 discipline-dod.md

**Files:**
- Create: `w-model-dev/templates/system-design/discipline-dod.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# Phase 2 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 2 收敛子集；完整工程宪法见 `SKILL.md`，
> 项目级 DoD 见 `references/definition-of-done.md`。
> **阶段边界**：本文件只约束系统设计阶段纪律，接口/类级纪律由阶段 3/4 的 discipline-dod.md 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> Phase 2 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)`。

## 1. 系统设计阶段纪律

- 设计事实以本模块主文档为 SSOT，变更须经阶段门评审 / 上游需求变更回流（见主文档 §0）
- 禁止以纯文字描述替代架构图（FM-SD-01 架构图缺数据流标注 → 返工）
- 技术选型须按 5 维度决策矩阵评分，禁止无依据选型（FM-SD-02）
- 禁止越过阶段边界落接口契约/类定义（FM-SD-06），接口/类级设计属阶段 3/4
- 禁止占位词进入正式交付（见主文档 §0）

## 2. DoD 可勾选清单

- [ ] 功能与语义：系统设计满足需求规格，无语义悖反
- [ ] 结构性校验：§1/§6/§7/§8/§9/附录 A 引用块指向文件存在、子系统清单与 §3 模块划分一致、追踪矩阵字段一致、mermaid 块配平
- [ ] 证据充分：技术选型 5 维度评分齐全、ADR 有上下文与后果、验收判据可量化
- [ ] 架构图完整：含数据流标注、非纯文字（FM-SD-01 闭合）
- [ ] 无循环依赖：模块划分 DFS 三色染色无环（FM-SD-03 闭合）
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=2` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=2` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
```

> **DoD 门禁**：`check-artifact-gate.ts --phase=2` 校验本文件 `- [ ]` 项 ≥ 8 条（Task 13 Step 3 实现）。

- [ ] **Step 2: 自检**

Run: `Grep -- '- \[ \]' w-model-dev/templates/system-design/discipline-dod.md | Measure-Object -Line`
Expected: 9（DoD 清单 9 项）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/discipline-dod.md
git commit -m "feat(templates): 新增工程纪律与 DoD 子模板 discipline-dod.md"
```

---

### Task 7: UML 系统级建模子模板 uml-modeling.md

**Files:**
- Create: `w-model-dev/templates/system-design/uml-modeling.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# UML 系统级建模（UML System-Level Modeling）

> 对应 DESIGN.md 附录 A UML 2.0 系统建模图表集（系统级子集）。系统级建模仅部署图 + 顶层组件图 + 包图 + 用例图；
> 接口级图表（序列图/通信图）由阶段 3 承接，类级图表（类图/ER 图/状态机图）由阶段 4 承接，不在此重复。
> **阶段边界**：本文件只产系统级 UML，越界即返工（FM-SD-06）。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> UML 系统级建模详见 [{{module}}-uml-modeling.md](./{{module}}-uml-modeling.md)`。

## A.1 部署图

> 节点 + 进程 + 数据流。系统级，不含模块内部组件。

```mermaid
graph TB
  subgraph {{节点1}}
    {{进程1}}
  end
  subgraph {{节点2}}
    {{进程2}}
  end
  {{进程1}} -.->|数据流| {{进程2}}
```

## A.2 顶层组件图

> 分层 + 组件依赖 + 数据流。组件 = 主模板 §3 模块划分的模块（FM-SD-04 检测信号）。

```mermaid
graph TB
  {{组件1}} -->|依赖| {{组件2}}
  {{组件2}} -.->|数据流| {{组件3}}
```

## A.3 包图

> 模块/包依赖。包 = 主模板 §3 模块划分的分组。

```mermaid
graph TB
  {{包1}} --> {{包2}}
```

## A.4 系统级用例图

> 参与者 = 需求规格 §5 stakeholder；用例 = 需求规格 §6 层级树 level≥2 REQ（FM-SD-04 检测信号）。

```mermaid
graph TB
  Actor1(({{参与者}})) --> UC1({{用例1}})
  UC1 -.->|include| UC2({{用例2}})
```

> 门禁：`check-requirement-graph.ts` R10 校验本文件 mermaid 块首尾定界行一一配对（Task 11 Step 3 实现）。
```

> **注意**：模板内嵌代码块示例时，外层需转义（模板文件中用 `\`\`\`mermaid` 转义示例块，避免模板渲染冲突）；实际产物文件中为正常 mermaid 块。

- [ ] **Step 2: 自检**

Run: `Grep -- '```mermaid' w-model-dev/templates/system-design/uml-modeling.md | Measure-Object -Line`
Expected: 4（A.1/A.2/A.3/A.4 四图）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/system-design/uml-modeling.md
git commit -m "feat(templates): 新增 UML 系统级建模子模板 uml-modeling.md"
```

---

### Task 8: 批 1 父代理回归

- [ ] **Step 1: 验证 6 子模板齐全 + 主模板引用块完整**

Run: `Glob 'w-model-dev/templates/system-design/*.md'`
Expected: 6 个文件（system-architecture/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）

Run: `Grep '详见 \[.*\.md\]' w-model-dev/templates/system-design.md`
Expected: 6 处引用块，分别指向 6 个子模板对应产物文件名（system-architecture.md/glossary.md/traceability-matrix.md/behavior-spec.md/discipline-dod.md/uml-modeling.md）

Run: `Grep '^## ' w-model-dev/templates/system-design.md`
Expected: §1-§5 既有节号保留 + §6-§10/附录 A 新增引用块节

- [ ] **Step 2: 提交批 1 汇总（如还有未提交改动）**

```bash
git add w-model-dev/templates/
git commit -m "feat(templates): 批1完成——主模板重构 + 6 独立子模板"
```

---

## 批 2：参考层（phase-2-system-design.md 扩展）

### Task 9: phase-2-system-design.md 算法扩步 + 失败模式 + 禁止行为 + 验收标准

**Files:**
- Modify: `w-model-dev/references/phase-2-system-design.md`

- [ ] **Step 1: 阅读现有文件结构**

Run: `Read w-model-dev/references/phase-2-system-design.md`
Expected: 确认现有节（功能描述/输入/输出/AI 能力/执行方法论/技术选型决策矩阵/边界条件/测试用例设计/seam/并行任务/RTM/ingestion/验收标准/阶段门/禁止行为 #1-5/返工路径/退出状态）

- [ ] **Step 2: 输出节补充独立产物说明**

在 §输出（15-20 行）追加：

```markdown
- 独立产物文件（第 38 轮新增，主文档引用块指向，均位于 `docs/phase2-design/`，带 `{module}-` 前缀）：
  - `{module}-system-architecture.md`：系统架构（组件图/子系统清单/系统树/架构原则/ADR/行为总览/运行时架构）
  - `{module}-glossary.md`：术语表（系统设计域子集）
  - `{module}-traceability-matrix.md`：系统设计追踪矩阵（SD×需求 8 字段 + 测试层级矩阵）
  - `{module}-behavior-spec.md`：行为规格模型（L2 .feature 引用关系）
  - `{module}-discipline-dod.md`：工程纪律与 DoD 可勾选清单
  - `{module}-uml-modeling.md`：UML 系统级建模（部署图/组件图/包图/用例图）
```

- [ ] **Step 3: 新增「系统设计算法」节（在功能描述之后插入）**

在 §功能描述之后、§输入之前插入编号算法（对齐 phase-1 算法风格）：

```text
## 系统设计算法

  1. 系统架构建模
     ├─ 基于需求规格，产出 docs/phase2-design/{module}-system-architecture.md（顶层组件图 + 子系统清单 + 系统树）
     ├─ 主模板 §1 引用块指向 system-architecture.md
     ├─ 失败: 架构图无数据流标注 → 补全组件间数据流向（FM-SD-01）
     └─ 成功: 子系统清单与模块划分候选对应
  2. 技术选型与 ADR
     ├─ 按技术选型决策矩阵 5 维度评分（适用性/成熟度/可维护性/引入成本/风险敞口）
     ├─ 架构决策记录 ADR 写入 system-architecture.md §5
     ├─ 失败: 选型无评分依据 / ADR 无上下文-后果 → 回步骤 2（FM-SD-02）
     └─ 成功: 选型理由成立，主模板 §2 技术选型表填实
  3. 模块划分与部署架构
     ├─ 基于子系统清单，产出主模板 §3 模块划分表（模块 ID 与子系统清单对应）
     ├─ 产出主模板 §4 部署架构
     ├─ 失败: 模块循环依赖 → 列出环路径重新划分（FM-SD-03）；子系统清单与模块划分不对应 → 回步骤 1
     └─ 成功: 模块划分无环且与子系统清单一致
  4. 系统上下文与术语建模（第 38 轮新增）
     ├─ 承接 phase1 system-context.md 外部边界，产出 docs/phase2-design/{module}-glossary.md（系统设计域术语子集）
     ├─ 主模板 §6 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. UML 系统级建模（第 38 轮新增）
     ├─ 产出 docs/phase2-design/{module}-uml-modeling.md（部署图/顶层组件图/包图/用例图）
     ├─ 主模板附录 A 引用块指向 uml-modeling.md
     ├─ 失败: 图与主模板 §1/§3 不对应 → 回步骤 5 对齐（FM-SD-04）
     └─ 成功: 四图产出，mermaid 块配平
  6. 追踪矩阵与行为规格引用（第 38 轮新增）
     ├─ 产出 docs/phase2-design/{module}-traceability-matrix.md（SD×需求 8 字段 + 测试层级矩阵）
     ├─ 产出 docs/phase2-design/{module}-behavior-spec.md（L2 .feature 引用关系）
     ├─ 主模板 §7/§8 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/3 不一致 → 回步骤 6 对齐（FM-SD-05）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  7. Phase 2 工程纪律与 DoD（第 38 轮新增）
     ├─ 产出 docs/phase2-design/{module}-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §9 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立
```

- [ ] **Step 4: 执行方法论表新增产出物行**

在 §执行方法论（31-42 行）的产出物处追加：

```markdown
| 系统架构 | 套用 `templates/system-design/system-architecture.md` | `docs/phase2-design/{module}-system-architecture.md` |
| 术语表 | 套用 `templates/system-design/glossary.md` | `docs/phase2-design/{module}-glossary.md` |
| UML 系统级建模 | 套用 `templates/system-design/uml-modeling.md`，mermaid 四图 | `docs/phase2-design/{module}-uml-modeling.md` |
| 系统设计追踪矩阵 | 套用 `templates/system-design/traceability-matrix.md` | `docs/phase2-design/{module}-traceability-matrix.md` |
| 行为规格模型（L2） | 套用 `templates/system-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase2-design/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/system-design/discipline-dod.md` | `docs/phase2-design/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/system-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase2-design/{module}-system-design.md` |
```

- [ ] **Step 5: 新增失败模式矩阵（FM-SD-01~05）**

在 §边界条件与异常处理 之后追加：

```markdown
## 失败模式矩阵（第 38 轮新增）

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-SD-01 | 架构图缺数据流标注 | system-architecture.md 组件图无 `-.->`/`>>` 数据流箭头 | 回步骤 1 补全数据流向 |
| FM-SD-02 | 选型无评分依据 / ADR 缺上下文后果 | 技术选型表无 5 维度评分；ADR 缺 context/consequences | 回步骤 2 补全评分与 ADR 结构 |
| FM-SD-03 | 模块循环依赖 | 模块划分 DFS 三色染色检测到环 | 回步骤 3 重新划分边界 |
| FM-SD-04 | UML 建模与架构/模块划分脱节 | uml-modeling.md 图与主模板 §1/§3 不对应 | 回步骤 5 对齐 UML 建模 |
| FM-SD-05 | 追踪矩阵字段不一致 | traceability-matrix.md 与主模板 §3/phase1 追踪矩阵不一致 | 回步骤 6 对齐追踪矩阵字段 |
```

> 注：FM-SD-06（越过阶段边界落接口/类级）为越界检测信号，见禁止行为 #8 与返工路径，不单列于上表。

- [ ] **Step 6: 新增禁止行为 #6/#7/#8**

在禁止行为表（#5 行之后）追加：

```markdown
| 6 | 追踪矩阵字段与主模板 §3 模块划分 / phase1 追踪矩阵不一致 | 步骤 6 须对齐 traceability-matrix.md（FM-SD-05） |
| 7 | UML 图表与架构/模块划分脱节 | uml-modeling.md 四图须对应主模板 §1/§3（FM-SD-04） |
| 8 | 越过阶段边界落接口契约/类定义 | 接口/类级设计属阶段 3/4，本阶段只产系统级（FM-SD-06 禁止越界） |
```

- [ ] **Step 7: 返工路径补充**

在 §返工路径 追加：

```markdown
- 架构图缺数据流（FM-SD-01）→ 回步骤 1 补全
- 选型无依据（FM-SD-02）→ 回步骤 2 补全评分/ADR
- 循环依赖（FM-SD-03）→ 回步骤 3 重新划分
- UML 脱节（FM-SD-04）→ 回步骤 5 对齐
- 追踪矩阵不一致（FM-SD-05）→ 回步骤 6 对齐
- 越界落接口/类级（FM-SD-06）→ 移除越界内容，移交阶段 3/4
```

- [ ] **Step 8: 验收标准补充**

在 §验收标准 追加 4 条：

```markdown
- [ ] {module}-system-architecture.md + {module}-glossary.md 已产出，主模板 §1/§6 引用块成立
- [ ] {module}-traceability-matrix.md（SD×需求 + 测试层级矩阵）与主模板 §3/phase1 矩阵一致，主模板 §7 引用块成立
- [ ] {module}-uml-modeling.md 四图与主模板 §1/§3 对应、mermaid 块配平，主模板附录 A 引用块成立
- [ ] {module}-behavior-spec.md + {module}-discipline-dod.md 已产出，主模板 §8/§9 引用块成立
```

- [ ] **Step 9: 提交**

```bash
git add w-model-dev/references/phase-2-system-design.md
git commit -m "docs(references): phase-2 算法扩步 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8"
```

---

### Task 10: 批 2 父代理回归

- [ ] **Step 1: 一致性核对**

Run: `Grep 'FM-SD-0[1-6]\|禁止行为 #[678]\|步骤 [1-7]' w-model-dev/references/phase-2-system-design.md`
Expected: 各出现且编号连续（FM-SD-01~06、禁止行为 #6/#7/#8、步骤 1-7）

Run: `Grep 'system-architecture.md\|glossary.md\|traceability-matrix.md\|behavior-spec.md\|discipline-dod.md\|uml-modeling.md' w-model-dev/references/phase-2-system-design.md`
Expected: 6 个产物名在算法/执行方法论/输出节/验收标准中一致出现

- [ ] **Step 2: 提交批 2 汇总（如还有未提交改动）**

```bash
git add w-model-dev/references/
git commit -m "docs(references): 批2完成——phase-2 参考层扩展"
```

---

## 批 3：门禁层（脚本扩展）

### Task 11: graph-logic.ts 新增 R9/R10 校验

**Files:**
- Modify: `w-model-dev/scripts/logic/graph-logic.ts`

- [ ] **Step 1: 阅读现有 R7/R8 区**

Run: `Read w-model-dev/scripts/logic/graph-logic.ts`（820-914 行 R7/R8 区）
Expected: 确认 parseMarkdownTable / countMermaidBlocks / extractRefTargets 已有、checkRequirementSpecEnhance 签名

- [ ] **Step 2: 新增 checkDesignSpecEnhance 函数（R9/R10，第 38 轮）**

在文件末尾（checkRequirementSpecEnhance 之后）追加：

```typescript
export interface DesignSpecEnhanceViolations {
  r9: string[];
  r10: string[];
}

/** R9 系统设计追踪矩阵一致性 + R10 UML mermaid 配平（第 38 轮）
 *  @param traceMatrixContent  {module}-traceability-matrix.md 内容
 *  @param designDocContent    主文档 {module}-system-design.md 内容（用于 §3 模块划分校验）
 *  @param umlContent          {module}-uml-modeling.md 内容
 *  @param reqTraceIds         phase1 追踪矩阵需求号集合（可选，为空则跳过 phase1 侧校验）
 */
export function checkDesignSpecEnhance(
  traceMatrixContent: string,
  designDocContent: string,
  umlContent: string,
  reqTraceIds?: Set<string>,
): DesignSpecEnhanceViolations {
  const v: DesignSpecEnhanceViolations = { r9: [], r10: [] };
  // R10: mermaid 块配平（先于 R9，轻量）
  const mb = countMermaidBlocks(umlContent);
  if (!mb.balanced) {
    v.r10.push(`R10 UML mermaid 块配平失败：pairs=${mb.pairs} 但定界未配对`);
  }
  if (mb.pairs === 0) {
    v.r10.push('R10 UML mermaid 块缺失：uml-modeling.md 无 ```mermaid 代码块');
  }
  // R9: 追踪矩阵一致性
  const hasSection3 = /^##\s+3[.\s]/m.test(designDocContent);
  if (!hasSection3) v.r9.push('R9 追踪矩阵一致性失败：主文档缺 §3 模块划分节');
  const rows = parseMarkdownTable(traceMatrixContent);
  if (rows.length === 0) {
    v.r9.push('R9 追踪矩阵为空：traceability-matrix.md 无数据行');
    return v;
  }
  for (const row of rows) {
    const sd = row['SD 编号'] ?? '';
    const req = row['对应需求号'] ?? '';
    const loc = row['设计落点§'] ?? '';
    if (sd && !/^SD-/.test(sd)) v.r9.push(`R9 SD 编号格式失败：${sd}`);
    if (req && !/^(REQ|NFR)-/.test(req)) v.r9.push(`R9 需求号格式失败：${req}`);
    if (loc && !/^M-\d/.test(loc)) v.r9.push(`R9 设计落点§ 引用失败：${sd} → ${loc}（须指向主模板 §3 模块 ID M-xxx）`);
    if (reqTraceIds && req && !reqTraceIds.has(req)) v.r9.push(`R9 phase1 追踪矩阵需求缺失：${req}`);
  }
  return v;
}
```

- [ ] **Step 3: TypeScript 编译检查**

Run: `npx tsc --noEmit -p w-model-dev/tsconfig.json`
Expected: 0 错误

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/scripts/logic/graph-logic.ts
git commit -m "feat(scripts): graph-logic 新增 R9/R10 校验（Phase 2 系统设计）"
```

---

### Task 12: check-requirement-graph.ts CLI 新增 module 前缀 glob 匹配

**Files:**
- Modify: `w-model-dev/scripts/cli/check-requirement-graph.ts`

- [ ] **Step 1: 阅读现有 --spec-dir 解析区**

Run: `Read w-model-dev/scripts/cli/check-requirement-graph.ts`（93-114 行）
Expected: 确认 R7/R8 的 --spec-dir 解析模式（固定文件名 requirement-spec.md）

- [ ] **Step 2: 扩展 --spec-dir 解析以支持 module 前缀 glob（phase=2 时）**

将现有 `if (specDirArg)` 块重构为按 phase 分发（保留 R7/R8 既有行为不变）：

```typescript
  // 解析 --spec-dir（第 37 轮 R7/R8 + 第 38 轮 R9/R10）
  const specDirArg = process.argv.slice(3).find(a => a.startsWith('--spec-dir='));
  let specEnhanceViolations: RequirementSpecEnhanceViolations | undefined;
  let designEnhanceViolations: DesignSpecEnhanceViolations | undefined;
  if (specDirArg) {
    const specDir = specDirArg.split('=')[1];
    if (specDir) {
      const fs = await import('node:fs');
      const readdirSync = (d: string): string[] => {
        try { return fs.readdirSync(d); } catch { return []; }
      };
      const readOrEmpty = (p: string): string => {
        try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
      };
      if (phase === 2) {
        // 第 38 轮：Phase 2 module 前缀 glob 匹配（每类恰 1 个文件）
        const mainFile = readdirSync(specDir).find(f => f.endsWith('-system-design.md'));
        const traceFile = readdirSync(specDir).find(f => f.endsWith('-traceability-matrix.md'));
        const umlFile = readdirSync(specDir).find(f => f.endsWith('-uml-modeling.md'));
        const traceContent = traceFile ? readOrEmpty(path.join(specDir, traceFile)) : '';
        const umlContent = umlFile ? readOrEmpty(path.join(specDir, umlFile)) : '';
        designEnhanceViolations = checkDesignSpecEnhance(
          traceContent,
          mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
          umlContent,
          rtmRows ? new Set(rtmRows.map(r => r.requirementId)) : undefined,
        );
        // 引用块完整性：主文档引用块指向的 6 文件须存在（以主文档 module 前缀核对）
        if (mainFile) {
          const mainContent = readOrEmpty(path.join(specDir, mainFile));
          const module = mainFile.replace(/-system-design\.md$/, '');
          const subRefs = ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'];
          for (const sub of subRefs) {
            if (!fs.existsSync(path.join(specDir, `${module}-${sub}.md`))) {
              designEnhanceViolations.r9.push(`R9 引用块断裂：主文档引用 ${module}-${sub}.md 但文件不存在`);
            }
          }
          if (readdirSync(specDir).filter(f => f.endsWith('-system-design.md')).length !== 1) {
            designEnhanceViolations.r9.push(`R9 module 前缀匹配失败：主文档须恰 1 个 *-system-design.md`);
          }
        } else {
          designEnhanceViolations.r9.push('R9 module 前缀匹配失败：未找到 *-system-design.md 主文档');
        }
      } else {
        // 第 37 轮：Phase 1 固定文件名（保留既有行为）
        const specContent = readOrEmpty(path.join(specDir, 'requirement-spec.md'));
        const traceContent = readOrEmpty(path.join(specDir, 'traceability-matrix.md'));
        const umlContent = readOrEmpty(path.join(specDir, 'uml-modeling.md'));
        const rtmIds = rtmRows ? new Set(rtmRows.map(r => r.requirementId)) : undefined;
        specEnhanceViolations = checkRequirementSpecEnhance(traceContent, specContent, umlContent, rtmIds);
        for (const ref of extractRefTargets(specContent)) {
          if (!fs.existsSync(path.join(specDir, ref))) {
            specEnhanceViolations.r7.push(`R7 引用块断裂：主规格引用 ${ref} 但文件不存在`);
          }
        }
      }
    }
  }
```

并在 import 处追加（现有 `checkRequirementSpecEnhance` 之后）：

```typescript
import {
  checkDesignSpecEnhance,
  checkRequirementGraph,
  checkRequirementSpecEnhance,
  extractRefTargets,
  recalculatePassed,
  type DesignSpecEnhanceViolations,
  type GraphShape,
  type RequirementSpecEnhanceViolations,
} from './graph-logic.js';
```

在最终校验结果汇总处（`if (specEnhanceViolations)` 块之后）追加：

```typescript
  if (designEnhanceViolations) {
    for (const msg of designEnhanceViolations.r9) result.violations.push(msg);
    for (const msg of designEnhanceViolations.r10) result.violations.push(msg);
    const isPureReqGraph = (parsed as GraphShape).nodes.length > 0 && (parsed as GraphShape).nodes.every(n => n.type === 'REQ');
    recalculatePassed(result, effectivePhase === 2 ? false : (effectivePhase === 1 && isPureReqGraph));
  }
```

- [ ] **Step 3: 用法注释更新**

文件头部注释用法追加：

```text
 * 用法（第 38 轮新增 R9/R10）：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> --phase=2 --spec-dir=docs/phase2-design
 *     --spec-dir  Phase 2 时按 *-system-design.md / *-traceability-matrix.md / *-uml-modeling.md 匹配
```

- [ ] **Step 4: 运行回归验证（复用既有样本，确认 R7/R8 无破坏）**

Run: `cd w-model-dev && npx tsx scripts/check-requirement-graph.ts scripts/samples/graph/valid-spec-enhance.json --phase=1 --spec-dir=scripts/samples/graph`
Expected: 退出码 0（R7/R8 既有行为不变）

Run: `cd w-model-dev && npx tsx scripts/check-requirement-graph.ts scripts/samples/graph/valid-graph.json --phase=2`
Expected: 退出码 0（未传 --spec-dir 时 R9/R10 不激活）

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/cli/check-requirement-graph.ts
git commit -m "feat(scripts): check-requirement-graph --spec-dir 支持 Phase 2 module 前缀 glob + R9/R10"
```

---

### Task 13: gate-logic.ts + check-artifact-gate.ts phase=2 结构校验

**Files:**
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`
- Modify: `w-model-dev/scripts/cli/check-artifact-gate.ts`

- [ ] **Step 1: 阅读现有 checkRequirementSpecStructure**

Run: `Read w-model-dev/scripts/logic/gate-logic.ts`（240-296 行）
Expected: 确认 Phase 1 结构校验函数与 nodeFsAdapter

- [ ] **Step 2: 新增 checkPhaseSpecStructure 泛化函数**

将 `checkRequirementSpecStructure` 泛化为按 phase 分发（保留原函数签名不变供 Phase 1 使用，新增泛化版）：

```typescript
/** 各阶段独立产物清单（主文档 + 6 独立文件）——第 38 轮泛化
 *  phase=1: requirement-spec.md 主文档 + 6 子文件（无前缀）
 *  phase=2: {module}-system-design.md 主文档 + 6 子文件（带 {module}- 前缀）
 */
const PHASE_SPEC_LAYOUT: Record<number, { mainSuffix: string; refs: string[] }> = {
  1: {
    mainSuffix: 'requirement-spec.md',
    refs: ['system-context.md', 'glossary.md', 'traceability-matrix.md', 'behavior-spec.md', 'discipline-dod.md', 'uml-modeling.md'],
  },
  2: {
    mainSuffix: '-system-design.md',
    refs: ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
};

/** Phase N 设计/规格结构校验（第 38 轮泛化）：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param phase  1 或 2（3/4 由后续小轮扩展）
 *  @param specDir  docs/phase{N}-{name}/ 目录
 *  @param fs       文件系统注入 { readFileSync; existsSync; readdirSync }，便于单测 mock
 */
export function checkPhaseSpecStructure(
  phase: number,
  specDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean; readdirSync(p: string): string[] },
): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const layout = PHASE_SPEC_LAYOUT[phase];
  if (!layout) {
    v.refs.push(`structure: 不支持的 phase=${phase}（当前支持 1/2）`);
    return v;
  }
  // 主文档定位：phase=1 固定文件名；phase=2 按 *-system-design.md glob
  let mainPath: string | undefined;
  if (phase === 1) {
    mainPath = path.join(specDir, layout.mainSuffix);
  } else {
    const mains = fs.readdirSync(specDir).filter(f => f.endsWith(layout.mainSuffix));
    if (mains.length !== 1) {
      v.refs.push(`structure: 主文档 glob *${layout.mainSuffix} 匹配 ${mains.length} 个（须恰 1 个）`);
      return v;
    }
    mainPath = path.join(specDir, mains[0]!);
  }
  if (!fs.existsSync(mainPath)) {
    v.refs.push(`structure: 主文档 ${layout.mainSuffix} 不存在`);
    return v;
  }
  const spec = String(fs.readFileSync(mainPath));
  // module 前缀提取（phase=2 时用于引用文件名校对）
  const modulePrefix = phase === 2 ? path.basename(mainPath).replace(/-system-design\.md$/, '') : '';
  for (const ref of layout.refs) {
    const refName = phase === 1 ? ref : `${modulePrefix}-${ref}.md`;
    if (!spec.includes(`](./${refName})`)) v.refs.push(`structure: 主文档缺引用块 → ${refName}`);
    if (!fs.existsSync(path.join(specDir, refName))) v.refs.push(`structure: 引用文件不存在 ${refName}`);
  }
  // §0 SSOT 头四项声明
  for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
    if (!spec.includes(key)) v.ssot.push(`structure: §0 SSOT 头缺「${key}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodName = phase === 1 ? 'discipline-dod.md' : `${modulePrefix}-discipline-dod.md`;
  const dodPath = path.join(specDir, dodName);
  if (!fs.existsSync(dodPath)) {
    v.dod.push(`structure: ${dodName} 不存在`);
  } else {
    const dod = String(fs.readFileSync(dodPath));
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: ${dodName} DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  }
  return v;
}
```

> **注意**：`checkRequirementSpecStructure`（Phase 1 专用）保留不动；`runArtifactGate` 中 phase=1 分支改调泛化版（行为等价），phase=2 分支新增调用。
> **nodeFsAdapter 扩展**：既有 `nodeFsAdapter` 仅含 `{ readFileSync; existsSync }`，须补 `readdirSync: (p: string) => nodeFs.readdirSync(p)` 以匹配新签名（phase=1 调用不受影响）。

- [ ] **Step 3: gate-logic 校验结果接入**

在 `checkArtifactGate` 的 `phase === 1 && options?.specDir` 块处重构为 phase 1/2 分发：

```typescript
  // 第 37/38 轮：phase=1/2 且提供 specDir 时做规格/设计结构校验
  let specStructureViolations: RequirementSpecStructureViolations | undefined;
  if ((phase === 1 || phase === 2) && options?.specDir) {
    specStructureViolations = checkPhaseSpecStructure(phase, options.specDir, nodeFsAdapter);
    for (const m of [...specStructureViolations.refs, ...specStructureViolations.ssot, ...specStructureViolations.dod]) {
      reasons.push(m);
    }
  }
```

- [ ] **Step 4: check-artifact-gate.ts 解析 --spec-dir 并传 phase**

在 `check-artifact-gate.ts` 中确认 `--phase` 与 `--spec-dir` 参数均已解析并传入 `checkArtifactGate`（`--phase=2 --spec-dir=docs/phase2-design`）。若 `--spec-dir` 未解析，追加：

```typescript
  const specDirArg = process.argv.slice(3).find(a => a.startsWith('--spec-dir='));
  const specDir = specDirArg?.split('=')[1] ?? undefined;
```

- [ ] **Step 5: 运行既有样本回归**

Run: `cd w-model-dev && npx tsx scripts/check-artifact-gate.ts scripts/samples/gate/valid-phase6.json`
Expected: 退出码 0（未传 --phase=1/2 --spec-dir 时不激活结构校验，不改变既有行为）

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/cli/check-artifact-gate.ts
git commit -m "feat(scripts): gate phase=2 新增引用块/SSOT/DoD 结构校验（checkPhaseSpecStructure 泛化）"
```

---

### Task 14: samples + self-test 基线 + vitest 单测

**Files:**
- Create: `w-model-dev/scripts/samples/graph/valid-design-enhance.json`、`bad-design-r9.json`、`bad-design-r10.json`
- Create: `w-model-dev/scripts/samples/gate/valid-phase2-spec-structure.json`、`bad-phase2-refs-missing.json`、`bad-phase2-ssot-header.json`、`bad-phase2-dod-incomplete.json`
- Modify: `w-model-dev/scripts/cli/self-test.ts`
- Modify: `w-model-dev/scripts/__tests__/graph-logic.test.ts`
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **Step 1: 创建 graph samples（R9/R10）**

`w-model-dev/scripts/samples/graph/valid-design-enhance.json`：

```json
{
  "sampleType": "graph-design-enhance",
  "description": "R9/R10 通过样本：traceability-matrix.md 字段合法 + uml-modeling.md mermaid 块配平",
  "expectedPassed": true,
  "traceabilityMatrix": "| SD 编号 | 对应需求号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| SD-001 | REQ-001 | P0 | M-001 | S-01 | 设计完成 | ST-001 | 响应 < 2s |\n| SD-002 | NFR-001 | P0 | M-002 | S-02 | 设计完成 | ST-002 | 可用性 >= 99% |\n\n## 2. 需求×测试层级承接矩阵\n\n| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |\n|---|---|---|---|---|\n| REQ-001 | ―（pending 阶段 5） | ―（pending 阶段 6） | ● ST-001 | ● UAT-001 |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n",
  "designDocContent": "## 3. 模块划分\n\n| 模块 ID | 模块名 | 职责 | 关联需求 |\n|---|---|---|---|\n| M-001 | 用户管理 | 职责 | REQ-001 |\n"
}
```

`w-model-dev/scripts/samples/graph/bad-design-r9.json`：

```json
{
  "sampleType": "graph-design-enhance",
  "description": "R9 失败样本：SD 编号非法 + 设计落点§ 非模块 ID",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R9 SD 编号格式失败", "R9 设计落点§ 引用失败"],
  "traceabilityMatrix": "| SD 编号 | 对应需求号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| DD-001 | REQ-001 | P0 | xxx | S-01 | 设计完成 | ST-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n",
  "designDocContent": "## 3. 模块划分\n"
}
```

`w-model-dev/scripts/samples/graph/bad-design-r10.json`：

```json
{
  "sampleType": "graph-design-enhance",
  "description": "R10 失败样本：mermaid 块未配平",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R10 UML mermaid 块配平失败"],
  "traceabilityMatrix": "| SD 编号 | 对应需求号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| SD-001 | REQ-001 | P0 | M-001 | S-01 | 设计完成 | ST-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\ngraph TB\n  A((actor)) --> UC1(uc)\n```\n```mermaid\nclassDiagram\n  class E1 { +attr }\n",
  "designDocContent": "## 3. 模块划分\n"
}
```

- [ ] **Step 2: 创建 gate samples（phase=2 结构校验）**

`w-model-dev/scripts/samples/gate/valid-phase2-spec-structure.json`：

```json
{
  "sampleType": "gate-phase2-spec-structure",
  "description": "Phase 2 结构校验通过：6 引用块 + SSOT 头 + DoD 9 项",
  "expectedPassed": true,
  "specDir": "docs/phase2-design",
  "mainDoc": "blog-system-system-design.md",
  "specContent": "> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n> 系统架构详见 [blog-system-system-architecture.md](./blog-system-system-architecture.md)\n> 术语表详见 [blog-system-glossary.md](./blog-system-glossary.md)\n> 追踪矩阵详见 [blog-system-traceability-matrix.md](./blog-system-traceability-matrix.md)\n> 行为规格模型详见 [blog-system-behavior-spec.md](./blog-system-behavior-spec.md)\n> Phase 2 工程纪律与 DoD 详见 [blog-system-discipline-dod.md](./blog-system-discipline-dod.md)\n> UML 系统级建模详见 [blog-system-uml-modeling.md](./blog-system-uml-modeling.md)\n",
  "refFiles": ["blog-system-system-architecture.md", "blog-system-glossary.md", "blog-system-traceability-matrix.md", "blog-system-behavior-spec.md", "blog-system-discipline-dod.md", "blog-system-uml-modeling.md"],
  "dodContent": "- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n- [ ] e\n- [ ] f\n- [ ] g\n- [ ] h\n- [ ] i\n"
}
```

`bad-phase2-refs-missing.json`：`refFiles` 缺 `blog-system-uml-modeling.md` + specContent 缺对应引用块行。
`bad-phase2-ssot-header.json`：specContent 缺「自身校验」。
`bad-phase2-dod-incomplete.json`：dodContent 仅 5 项。

> bad 变体沿用 valid 的字段结构，仅按上述差异修改。self-test/gate 逻辑用内存 fs stub 模拟文件存在性（键用 `docs/phase2-design/{name}` 构造）。

- [ ] **Step 3: self-test.ts 基线 225→233 注册**

新增两个样本集合并追加到入口：

```typescript
// ==================== Phase 2 系统设计增强（第 38 轮） ====================

interface DesignEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const DESIGN_ENHANCE_CASES: DesignEnhanceCase[] = [
  { file: 'valid-design-enhance.json', expectedPassed: true, description: 'R9/R10 通过：SD 字段合法 + mermaid 配平' },
  { file: 'bad-design-r9.json', expectedPassed: false, expectedReasonPatterns: [/R9 SD 编号格式失败/, /R9 设计落点§ 引用失败/], description: 'R9 失败：SD 编号非法 + 落点§ 非模块 ID' },
  { file: 'bad-design-r10.json', expectedPassed: false, expectedReasonPatterns: [/R10 UML mermaid 块配平失败/], description: 'R10 失败：mermaid 块未配平' },
];

interface Phase2SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const PHASE2_SPEC_STRUCTURE_CASES: Phase2SpecStructureCase[] = [
  { file: 'valid-phase2-spec-structure.json', expectedPassed: true, description: 'Phase 2 结构校验通过：6 引用块 + SSOT 头 + DoD 9 项' },
  { file: 'bad-phase2-refs-missing.json', expectedPassed: false, expectedReasonPatterns: [/引用文件不存在 blog-system-uml-modeling.md/], description: 'Phase 2 结构校验失败：引用文件缺失' },
  { file: 'bad-phase2-ssot-header.json', expectedPassed: false, expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/], description: 'Phase 2 结构校验失败：SSOT 头缺声明' },
  { file: 'bad-phase2-dod-incomplete.json', expectedPassed: false, expectedReasonPatterns: [/DoD 清单仅 5 项/], description: 'Phase 2 结构校验失败：DoD 清单 < 8' },
];
```

`runDesignEnhanceCases(samplesDir)` 读取样本喂给 `checkDesignSpecEnhance(parsed.traceabilityMatrix, parsed.designDocContent, parsed.umlModeling)`；
`runPhase2SpecStructureCases(samplesDir)` 用内存 fs stub 喂给 `checkPhaseSpecStructure(2, dir, fsStub)`（键 = `docs/phase2-design/{mainDoc}/{refFiles}`）。

在 `main()` 的 Promise.all 数组追加 `runDesignEnhanceCases(samplesDir)` 与 `runPhase2SpecStructureCases(samplesDir)`，`all` 数组同步展开，控制台计数行同步追加。

> **注意**：以 `npm run self-test` 实际输出为准——若当前基线非 225，按"当前基线 + 8"更新并记录实际值；运行确认全通过。

- [ ] **Step 4: vitest 单测**

`__tests__/graph-logic.test.ts` 追加：

```typescript
import { checkDesignSpecEnhance, countMermaidBlocks } from '../graph-logic.js';

describe('R9 系统设计追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkDesignSpecEnhance(
      '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| SD-001 | REQ-001 | M-001 |\n',
      '## 3. 模块划分\n',
      '```mermaid\ngraph TB\n  A --> B\n```\n',
    );
    expect(v.r9).toEqual([]);
  });
  it('SD 编号非法报 R9', () => {
    const v = checkDesignSpecEnhance(
      '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| DD-001 | REQ-001 | M-001 |\n',
      '## 3. 模块划分\n',
      '',
    );
    expect(v.r9.some(m => m.includes('SD 编号格式'))).toBe(true);
  });
});

describe('R10 UML mermaid 块配平', () => {
  it('未配平报 R10', () => {
    const v = checkDesignSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r10.some(m => m.includes('配平'))).toBe(true);
  });
});
```

`__tests__/gate-enhancement.test.ts` 追加：

```typescript
import { checkPhaseSpecStructure } from '../gate-logic.js';

describe('Phase 2 系统设计结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      if (!(p in files)) throw new Error(`missing ${p}`);
      return files[p];
    },
    existsSync(p: string): boolean {
      return p in files;
    },
    readdirSync(p: string): string[] {
      const prefix = p.endsWith('/') ? p : `${p}/`;
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const files: Record<string, string> = {};
    const refs = ['blog-system-system-architecture.md', 'blog-system-glossary.md', 'blog-system-traceability-matrix.md', 'blog-system-behavior-spec.md', 'blog-system-discipline-dod.md', 'blog-system-uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    for (const r of refs) files[`docs/phase2-design/${r}`] = '';
    files['docs/phase2-design/blog-system-system-design.md'] = spec;
    files['docs/phase2-design/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, 'docs/phase2-design', mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase2-design/blog-system-system-design.md'] = '> 详见 [x](./blog-system-uml-modeling.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase2-design/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, 'docs/phase2-design', mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('主文档 glob 多/零个报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase2-design/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, 'docs/phase2-design', mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });

  it('主文档 glob 多个报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase2-design/a-system-design.md'] = '> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase2-design/b-system-design.md'] = '> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase2-design/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, 'docs/phase2-design', mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });
});
```

> **注意**：`checkPhaseSpecStructure(2, ...)` 用注入式 `fs.readdirSync` 做 glob——单测 mkFs 已补 readdirSync（返回 files 键中 basename 与 specDir 匹配者），使「主文档 glob 多/零个」场景可控（缺主文档 → 报「主文档 glob 匹配 0 个」；mock 两个主文档 → 报「匹配 2 个」）。nodeFsAdapter 同步补 readdirSync。若实现与上述有偏差，以实际编译/测试为准修正。

- [ ] **Step 5: 全量回归**

Run: `cd w-model-dev && npm run self-test`
Expected: 退出码 0，基线 233 全通过

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 全部通过（含新增 R9/R10 + phase=2 结构校验单测）

Run: `npx tsc --noEmit -p w-model-dev/tsconfig.json`
Expected: TypeScript strict 0 错误

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/samples/ w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/__tests__/
git commit -m "test(scripts): R9/R10 + phase=2 结构校验 samples/self-test/vitest（基线 225→233）"
```

---

### Task 15: 批 3 父代理回归

- [ ] **Step 1: 全量门禁验证**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 全部通过，0 错误

Run: 手工构造临时 Phase 2 产物目录（含 `{module}-system-design.md` + 6 独立文件）跑 R9/R10 + gate 结构校验
Expected: 退出码 0

- [ ] **Step 2: 提交批 3 汇总（如还有未提交改动）**

```bash
git add w-model-dev/scripts/
git commit -m "feat(scripts): 批3完成——R9/R10 + phase=2 结构校验 + 回归基线 233"
```

---

## 批 4：同步层（verifier-spec / SKILL / SSoT / 版本号 / 顶层文档）

### Task 16: verifier-spec.md 评审新增项

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 阅读 completeness 维度现有条款**

Run: `Grep 'completeness' w-model-dev/references/verifier-spec.md`
Expected: 定位 completeness 维度评审项

- [ ] **Step 2: completeness 维度追加 Phase 2 结构评审项**

在 completeness 维度阶段 2 相关处追加：

```markdown
- 阶段 2 系统设计结构完整性（第 38 轮）：
  - 主文档 §1/§6/§7/§8/§9/附录 A 引用块指向的 6 个独立文件（system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）均存在且内容非空
  - traceability-matrix.md 字段与主文档 §3 模块划分 / phase1 追踪矩阵一致（对应 R9 门禁）
  - uml-modeling.md mermaid 四图配平且与主文档 §1/§3 对应（对应 R10 门禁）
  - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
  - 未越过阶段边界落接口契约/类定义（FM-SD-06 检测）
```

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(references): verifier-spec completeness 维度新增 Phase 2 结构评审项"
```

---

### Task 17: SKILL.md + skill-metadata.json + package.json 版本号 38.0.0

**Files:**
- Modify: `w-model-dev/SKILL.md`
- Modify: `w-model-dev/skill-metadata.json`
- Modify: `package.json`

- [ ] **Step 1: 阅读 SKILL.md 版本号与阶段路由表**

Run: `Grep 'version\|37\.0\.0\|phase-2-system-design\|check-requirement-graph' w-model-dev/SKILL.md | Select-Object -First 20`
Expected: 定位 frontmatter version、阶段路由表 Phase 2 行、门禁脚本清单

- [ ] **Step 2: SKILL.md 三处更新**

frontmatter：

```yaml
version: 38.0.0
```

阶段路由表 Phase 2 行追加必读/产出说明（保持原行结构，追加第 38 轮标注）：

```markdown
阶段 2（系统设计）：套用 templates/system-design.md 主模板 + 6 独立子模板（templates/system-design/），产出 docs/phase2-design/ 下 {module}-system-design.md + {module}-system-architecture.md + {module}-glossary.md + {module}-traceability-matrix.md + {module}-behavior-spec.md + {module}-discipline-dod.md + {module}-uml-modeling.md；G 门禁 check-requirement-graph.ts --phase=2 --spec-dir=docs/phase2-design（R9/R10）+ check-artifact-gate.ts --phase=2 --spec-dir=docs/phase2-design（结构校验）
```

快速自检清单（如有 Phase 2 项）追加：

```markdown
- [ ] Phase 2 系统设计：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
```

- [ ] **Step 3: skill-metadata.json 版本号**

```json
{ "version": "38.0.0" }
```

- [ ] **Step 4: package.json 版本号**

```json
{ "version": "38.0.0" }
```

- [ ] **Step 5: 版本号一致性核验**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 三处均为 38.0.0

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json package.json
git commit -m "chore: 版本号三处一致 38.0.0（第 38 轮 Phase 2 设计级增强）"
```

---

### Task 18: SSoT + AGENTS.md + CHANGELOG.md + README.md

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: 阅读 SSoT §3.4 最近条目与 §10A 追溯表格式**

Run: `Grep '3\.4\.3[0-9]\|第 3[0-9] 轮\|第 37 轮' docs/skill-design-document_SSoT.md | Select-Object -First 10`
Expected: 定位最新轮次条目编号（第 37 轮 = §3.4.35），确定新增条目号（§3.4.36）

- [ ] **Step 2: SSoT 新增 §3.4.36 条目**

在最新轮次条目之后追加：

```markdown
#### 第 38 轮·小轮 A（2026-08-09）：Phase 2 系统设计设计级增强（SSoT §3.4.36）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求系统设计/概要设计/详细设计产出达到 DESIGN.md 级别结构严谨性（分三小轮，本轮为小轮 A：Phase 2） |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守系统设计域边界（不落接口/类级） |
| 新增模板 | 6 独立子模板（templates/system-design/：system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）+ 主模板 system-design.md 重构（§0 SSOT 头 + 引用块，保留 §1-§5 节号防 tla-spec-template 跨引用破坏） |
| 参考扩展 | phase-2-system-design.md 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R9（SD 追踪矩阵一致性）/R10（UML mermaid 配平）+ --spec-dir 支持 module 前缀 glob；check-artifact-gate.ts phase=2 新增引用块完整性/SSOT 头/DoD 清单校验（checkPhaseSpecStructure 泛化） |
| 阶段边界 | Phase 2 只产系统级（架构/子系统/部署/行为总览/运行时架构），FM-SD-06 拦截越界落接口/类级 |
| self-test | 基线 225→233 |
| 版本号 | 38.0.0（三处一致） |
```

§10A 追溯表追加一行（格式对齐既有行）：`| §3.4.36 | 第 38 轮 Phase 2 设计级增强（小轮 A） |`

- [ ] **Step 3: AGENTS.md §1 新增第 38 轮条目**

在 AGENTS.md §1 列表末尾追加：

```markdown
- **第 38 轮 Phase 2 设计级增强（小轮 A）**：阶段 2 系统设计产出升级——主模板 + 6 独立子模板（system-architecture/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling），主文档引用块串联，保留既有 §1-§5 节号（防 tla-spec-template 跨引用破坏）；`check-requirement-graph.ts` 新增 R9/R10（--spec-dir 支持 module 前缀 glob），`check-artifact-gate.ts --phase=2` 新增引用块/SSOT/DoD 校验。反模式总数 44 不变（仅 phase-2-system-design.md 内 FM-SD-01~05 + 禁止行为 #6/#7/#8）。详见 SSoT §3.4.36。
```

- [ ] **Step 4: CHANGELOG.md [38.0.0] 条目**

```markdown
## [38.0.0] - 2026-08-09

### Added
- Phase 2 系统设计 6 独立子模板（system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）
- check-requirement-graph.ts R9（SD 追踪矩阵一致性）/ R10（UML mermaid 块配平）+ --spec-dir 支持 module 前缀 glob
- check-artifact-gate.ts --phase=2 引用块完整性 / §0 SSOT 头 / DoD 清单校验（checkPhaseSpecStructure 泛化）

### Changed
- system-design.md 主模板重构（§0 SSOT 头 + 引用块串联，保留 §1-§5 既有节号）
- phase-2-system-design.md 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8
- verifier-spec.md completeness 维度新增 Phase 2 结构评审项
- self-test 基线 225→233；版本号 37.0.0 → 38.0.0
```

- [ ] **Step 5: README.md 能力 bullet（如有 Phase 2 能力清单）**

Run: `Grep '系统设计\|Phase 2\|阶段 2' README.md`
Expected: 定位能力描述区；如有阶段 2 能力 bullet，追加「设计文档级结构：6 独立产物 + 引用块 + 门禁核验」

- [ ] **Step 6: 全量回归**

Run: `cd w-model-dev && npm run self-test && npx vitest run`
Expected: 退出码 0 全通过

Run: `npm run prepush`（若 hooks 已启用）或手动门禁
Expected: 全通过

- [ ] **Step 7: 提交**

```bash
git add docs/skill-design-document_SSoT.md AGENTS.md CHANGELOG.md README.md
git commit -m "docs: SSoT/AGENTS/CHANGELOG/README 第 38 轮同步（38.0.0）"
```

---

### Task 19: 批 4 父代理回归 + 计划验收

- [ ] **Step 1: 版本号三处一致 + 引用可达**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 38.0.0 × 3

Run: `Grep 'templates/system-design/' w-model-dev/SKILL.md w-model-dev/references/phase-2-system-design.md w-model-dev/references/verifier-spec.md`
Expected: 引用一致

- [ ] **Step 2: 全量门禁终检**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 退出码 0，0 错误，基线 233

- [ ] **Step 3: 完成声明**

向用户汇报：批 1-4 全部完成，self-test 233 / vitest / tsc strict 全通过，版本号 38.0.0 三处一致，Phase 2 设计级增强交付。小轮 B（Phase 3 概要设计，38.1.0）待用户确认后启动。

---

## Self-Review 对照表

| Spec 章节要求 | 对应 Task | 覆盖 |
|---|---|---|
| 主模板重构（§0 SSOT 头 + 引用块 + 保留 §1-§5） | Task 1 | ✅ |
| 6 独立子模板（system-architecture/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling） | Task 2-7 | ✅ |
| phase-2 算法增步骤 1-7 + 执行方法论表 | Task 9 Step 2/3/4 | ✅ |
| FM-SD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 | Task 9 Step 5/6/7 | ✅ |
| 验收标准补充 4 条 | Task 9 Step 8 | ✅ |
| check-requirement-graph R9/R10 + --spec-dir module glob | Task 11/12 | ✅ |
| gate phase=2 引用块/SSOT/DoD（checkPhaseSpecStructure 泛化） | Task 13 | ✅ |
| samples 8 条 + self-test 225→233 + vitest | Task 14 | ✅ |
| verifier-spec 评审新增项 | Task 16 | ✅ |
| SKILL/skill-metadata/package 版本号 38.0.0 | Task 17 | ✅ |
| SSoT/AGENTS/CHANGELOG/README | Task 18 | ✅ |
| 批间父代理回归 + 全量门禁 | Task 8/10/15/19 | ✅ |
| 阶段边界红线（不落接口/类级，FM-SD-06） | Task 2-7 子模板边界标注 + Task 9 禁止行为 #8 + Task 16 V 评审 | ✅ |
| 主模板节号保留（§1-§5，tla-spec-template 跨引用） | Task 1 节号保留 + Task 19 引用核验 | ✅ |
| 命名遵循 directory-conventions §1（{module}- 前缀） | 计划头声明 + Task 9/12/13 使用 {module}- 前缀 | ✅ |
