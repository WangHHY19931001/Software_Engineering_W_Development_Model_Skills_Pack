# Phase 4 详细设计产出达到设计文档级别 — 实施计划（小轮 C / 38.2.0）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 W 模型技能包 Phase 4（详细设计）产出提升到 DESIGN.md 级别的结构严谨性：6 项增强内容拆为独立产物文件（主模板引用块串联），通过门禁脚本可机械核验，严守阶段边界（不回溯接口/不重定义模块）。

**Architecture:** 三层联动——模板层（主模板 detailed-design.md 重构 + 6 独立子模板）、参考层（phase-4-detailed-design.md 算法扩步 + FM-DD-01~05 + 禁止行为 #7/#8/#9）、门禁层（check-requirement-graph.ts 新增 R13/R14 + check-artifact-gate.ts --phase=4 结构校验）。严守详细设计域边界，不侵入 Phase 5 编码。

**Tech Stack:** Markdown 模板/参考、TypeScript（tsx runtime + ajv）、vitest、self-test.ts 回归基线、mermaid（UML 建模）。

**Spec:** [2026-08-09-design-phases-level-enhancement-design.md](../specs/2026-08-09-design-phases-level-enhancement-design.md) §3.3

**命名约定**：Phase 4 产物带 `{module}-` 前缀（遵循 [directory-conventions.md](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/references/directory-conventions.md) §1），位于 `docs/phase4-detailed/`；独立产物命名为 `{module}-class-design.md` / `{module}-data-model.md` / `{module}-glossary.md` / `{module}-traceability-matrix.md` / `{module}-behavior-spec.md` / `{module}-discipline-dod.md`，主文档 `{module}-detailed-design.md` 引用块指向同目录。子模板放 `templates/detailed-design/` 目录（与主模板 `templates/detailed-design.md` 同名目录）。

**Phase 4 差异点（相对小轮 A/B）**：无独立 `uml-modeling.md`——类图（classDiagram）内嵌于 `class-design.md`、ER 图（erDiagram）内嵌于 `data-model.md`；R14 配平校验对这两个源文件（合并内容）校验 mermaid 块配对。

**批次与约束**：4 批串行（模板→参考→门禁→同步），每批完成后父代理回归。**禁止并行修改**。所有脚本改动须 `npm run self-test` + `npx vitest run` 全通过 + TypeScript strict 0 错误。版本号三处一致 38.2.0。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `w-model-dev/templates/detailed-design.md` | 重构 | 主模板：§0 SSOT 头 + 保留 §1-§3 + 新增引用块节 |
| `w-model-dev/templates/detailed-design/class-design.md` | 新增 | 类设计子模板（类图 + 类定义 + 方法级 + 类状态机） |
| `w-model-dev/templates/detailed-design/data-model.md` | 新增 | 数据模型子模板（ER 图 + 表结构 + 索引 + store 归属） |
| `w-model-dev/templates/detailed-design/glossary.md` | 新增 | 术语表子模板 |
| `w-model-dev/templates/detailed-design/traceability-matrix.md` | 新增 | 追踪矩阵子模板 |
| `w-model-dev/templates/detailed-design/behavior-spec.md` | 新增 | 行为规格模型（L4 引用）子模板 |
| `w-model-dev/templates/detailed-design/discipline-dod.md` | 新增 | 工程纪律与 DoD 子模板 |
| `w-model-dev/references/phase-4-detailed-design.md` | 修改 | 算法增步骤 + FM-DD-01~05 + 禁止行为 #7/#8/#9 + 返工路径 + 验收标准 + 执行方法论表 + 输出节 |
| `w-model-dev/scripts/logic/graph-logic.ts` | 修改 | 新增 R13/R14 校验函数 |
| `w-model-dev/scripts/cli/check-requirement-graph.ts` | 修改 | CLI `--spec-dir` phase=4 分支 |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改 | PHASE_SPEC_LAYOUT 加 phase=4 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | 修改 | phase=4 调用结构校验（确认参数传递） |
| `w-model-dev/scripts/samples/graph/` | 新增 | R13/R14 各 1 valid + 1 bad + 1 补充（5 条） |
| `w-model-dev/scripts/samples/gate/` | 新增 | phase=4 结构校验 1 valid + 3 bad（4 条） |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | 基线 241→249 |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 修改 | R13/R14 单测 |
| `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` | 修改 | phase=4 结构校验单测 |
| `w-model-dev/references/verifier-spec.md` | 修改 | V 评审新增项 |
| `w-model-dev/SKILL.md` | 修改 | 阶段路由表 Phase 4 行 + 快速自检清单 + 版本号 |
| `w-model-dev/skill-metadata.json` | 修改 | 版本号镜像 |
| `package.json` | 修改 | 版本号 |
| `docs/skill-design-document_SSoT.md` | 修改 | §3.4.xx 条目 + §10A 追溯表 |
| `AGENTS.md` | 修改 | §1 第 38 轮小轮 C 条目 |
| `CHANGELOG.md` | 修改 | [38.2.0] 条目 |
| `README.md` | 修改 | 能力 bullet（如有） |

---

## 批 1：模板层（主模板 + 6 独立子模板）

### Task 1: 主模板 detailed-design.md 重构（§0 SSOT 头 + 引用块）

**Files:**
- Modify: `w-model-dev/templates/detailed-design.md`（全部重写）

- [ ] **Step 1: 阅读现有主模板全文**

Run: `Read w-model-dev/templates/detailed-design.md`
Expected: 确认现有节（文档信息 / 1 类设计 / 2 数据库设计 / 3 单元测试用例索引）

> **节号保留约束**：`tla-spec-template.md:164` 引用 `docs/phase4-detailed/{module}-detailed-design.md:§4.1.2` 为模板示例（现有模板无 §4，属前瞻性引用）。为安全保留 §1-§3 编号，新增引用块节追加为 §4+。门禁按引用块文件名校验，不依赖节号。

- [ ] **Step 2: 重写主模板文件**

```markdown
# 详细设计文档

> **模板版本**：v2.0（第 38 轮设计级别增强：§0 SSOT 头 + 6 独立产物文件引用块）
> 套用本模板时，引用块指向同目录独立文件，独立文件套用
> `templates/detailed-design/` 下对应子模板。产出物见
> `references/phase-4-detailed-design.md` §执行方法论。

## 文档信息

- 项目名称：{{项目名称}}
- 文档版本：{{v1.0}}
- 编制日期：{{YYYY-MM-DD}}
- 关联接口设计文档：{{interface-design 路径}}

## 0. 文档定位与 SSOT 头

> **文档版本**：v{{1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本详细设计文档为阶段 4（详细设计）的唯一设计事实来源。设计变更须经
>   阶段门评审 / 上游概要设计变更回流，不得无痕修改。
> **自身校验**：本文档以结构完整性为准——引用块指向的独立文件存在、
>   {{module}}-class-design.md 类图与 {{module}}-data-model.md ER 图 mermaid 块配平、
>   {{module}}-traceability-matrix.md 字段与主文档 §1/§2 一致。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在非目标显式标注中。
> **与概要设计关系**：本文档承接阶段 3《接口设计文档》（模块接口契约），类/方法级设计由本文档承载；
>   不回溯重定义接口契约（跨阶段变更须回阶段 3 返工）。
> **行为规格承接**：L4 行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），
>   本文档引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

## 1. 类设计

### 1.1 类图
```mermaid
classDiagram
    {{类与关系}}
```

### 1.2 类定义

#### {{ClassName}}
- 职责：{{职责描述}}
- 属性：

| 属性 | 类型 | 说明 |
|---|---|---|
| {{id}} | {{string}} | {{主键}} |

- 方法：

| 方法 | 签名 | 职责 | 前置条件 | 后置条件 |
|---|---|---|---|---|
| {{create}} | {{(input): Result}} | {{创建}} | {{}} | {{}} |

> 类图 / 类定义 / 方法级定义 / 类状态机细节详见
> [{{module}}-class-design.md](./{{module}}-class-design.md)。

## 2. 数据库设计

### 2.1 ER 图
```mermaid
erDiagram
    {{实体与关系}}
```

### 2.2 表结构

#### {{table_name}}

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| {{id}} | {{BIGINT}} | PK | {{主键}} |

### 2.3 索引设计

| 索引名 | 字段 | 类型 | 用途 |
|---|---|---|---|
| {{idx_xxx}} | {{field}} | 唯一/普通 | {{}} |

> ER 图 / 表结构 / 索引 / store 归属细节详见
> [{{module}}-data-model.md](./{{module}}-data-model.md)。

## 3. 单元测试用例索引

> 详细用例见对应测试用例文档。

| 用例 ID | 关联类/方法 | 场景 | 优先级 |
|---|---|---|---|
| UT-001 | {{ClassName.method}} | {{场景}} | 高 |

## 4. 核心概念与术语

> 术语表详见 [{{module}}-glossary.md](./{{module}}-glossary.md)
> （详细设计域术语子集，引用 references/glossary.md 权威表）。

## 5. 详细设计追踪矩阵

> 追踪矩阵详见 [{{module}}-traceability-matrix.md](./{{module}}-traceability-matrix.md)
> （DD×INTF 8 字段表 + 测试层级承接矩阵，仅单元/验收列填实）。

## 6. 行为规格模型（L4）

> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)
> （引用 L4 .feature 文件关系，不内联 feature 块）。

## 7. Phase 4 工程纪律与 DoD

> Phase 4 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)
> （§1 阶段纪律 + §2 DoD 可勾选清单）。

## 8. 设计边界与非目标

- {{非目标 1}}（例：本设计不覆盖编码实现细节，编码由阶段 5 承载）
- {{非目标 2}}
- …
```

> **注意**：主模板节号保持既有 §1-§3 编号体系不变。6 个引用块节追加为 **§4 核心概念与术语 / §5 详细设计追踪矩阵 / §6 行为规格模型（L4）/ §7 Phase 4 工程纪律与 DoD / §8 设计边界与非目标**（class-design 经 §1 引用块、data-model 经 §2 引用块，共 6 个独立文件引用）。Phase 4 无独立 UML 附录——类图/ER 图内嵌于 class-design/data-model 文件。

- [ ] **Step 3: 自检模板结构**

Run: `Grep '^## ' w-model-dev/templates/detailed-design.md`
Expected: 含 `0. 文档定位与 SSOT 头`、`4. 核心概念与术语`、`5. 详细设计追踪矩阵`、`6. 行为规格模型（L4）`、`7. Phase 4 工程纪律与 DoD`、`8. 设计边界与非目标` 引用块节；`1. 类设计` / `2. 数据库设计` / `3. 单元测试用例索引` 保留；§1/§2 含指向 class-design.md / data-model.md 的引用块

Run: `Grep '### 1.1 类图\|### 2.1 ER 图' w-model-dev/templates/detailed-design.md`
Expected: §1/§2 保留图形骨架

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/templates/detailed-design.md
git commit -m "feat(templates): detailed-design 主模板重构（§0 SSOT 头 + 6 独立文件引用块，保留 §1-§3 节号）"
```

---

### Task 2: 类设计子模板 class-design.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/class-design.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 类设计（Class Design）

> 对应 DESIGN.md §9.2 运行时核心对象 + 附录 A.4 类图 + A.10 状态机（类级）。类/方法级设计：
> 类图 / 类定义 / 方法级定义 / 类状态机。
> **阶段边界**：本文件只产类/方法级设计，不回溯重定义接口契约（阶段 3），越界即返工（FM-DD-06）。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 类图 / 类定义 / 方法级定义 / 类状态机细节详见 [{{module}}-class-design.md](./{{module}}-class-design.md)`。

## 1. 类图

```mermaid
classDiagram
  class {{ClassName}} {
    +{{属性1}}: {{类型}}
    +{{方法1}}({{参数}}): {{返回}}
  }
  {{ClassA}} "1" --> "*" {{ClassB}} : {{关系}}
```

> 类图须体现继承/关联/依赖关系（UML 规范）；类 = 主文档 §2 接口定义对应的实现类（FM-DD-04 检测信号）。

## 2. 类定义

| 类名 | 职责 | 依赖 | 数据源（store） |
|---|---|---|---|
| {{ClassName}} | {{职责}} | {{依赖类}} | {{store 名}} |

> 强制：跨模块调用的数据源选择与 phase3 接口设计一致（不得在详细设计阶段变更 store，违反回阶段 3 返工）。

## 3. 方法级定义

| 方法 | 签名 | 职责 | 前置条件 | 后置条件 | 异常 |
|---|---|---|---|---|---|
| {{create}} | {{(input): Result}} | {{创建}} | {{}} | {{}} | {{}} |

> 强制：每个方法须定义前置条件 + 后置条件 + 异常（缺则 FM-DD-02）。

## 4. 类状态机

```mermaid
stateDiagram-v2
  [*] --> {{状态1}}
  {{状态1}} --> {{状态2}} : {{事件}}
```

> 类级状态机与 TLA+ L4 规格状态集一致（tla-bdd-sync 校验）；状态机细节由 .tla 文件承载，此处为设计视图。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/detailed-design/class-design.md`
Expected: 含「类图」「类定义」「方法级定义」「类状态机」+ 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/class-design.md
git commit -m "feat(templates): 新增类设计子模板 class-design.md"
```

---

### Task 3: 数据模型子模板 data-model.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/data-model.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 数据模型（Data Model）

> 对应 DESIGN.md 附录 A.5 ER 图 + §21.5 store 物理层。数据级设计：
> ER 图 / 表结构 / 索引 / store 归属。
> **阶段边界**：本文件只产数据模型级设计，不定义接口契约（阶段 3），越界即返工（FM-DD-06）。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> ER 图 / 表结构 / 索引 / store 归属细节详见 [{{module}}-data-model.md](./{{module}}-data-model.md)`。

## 1. ER 图

```mermaid
erDiagram
  {{ENTITY1}} ||--o{ {{ENTITY2}} : {{关系}}
  {{ENTITY1}} {
    {{type}} {{field}} PK
  }
```

> ER 图须含主键/外键 + 索引标注（UML 规范）；实体 = 主文档 §2 接口定义对应的数据实体（FM-DD-04 检测信号）。

## 2. 表结构

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| {{table_name}} | {{id}} | {{BIGINT}} | PK | {{主键}} |

## 3. 索引设计

| 索引名 | 字段 | 类型 | 用途 |
|---|---|---|---|
| {{idx_xxx}} | {{field}} | 唯一/普通 | {{}} |

> 强制：表结构必须含字段 + 索引 + 关系（缺则 FM-DD-03）。

## 4. Store 归属

| 表名 | 所属 store | 数据源选择说明 |
|---|---|---|
| {{table_name}} | {{store 名}} | {{与 phase3 接口设计一致}} |

> 强制：store 归属与 phase3 接口设计一致（不得在详细设计阶段变更，违反回阶段 3 返工，反模式 #23）。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/detailed-design/data-model.md`
Expected: 含「ER 图」「表结构」「索引设计」「Store 归属」+ 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/data-model.md
git commit -m "feat(templates): 新增数据模型子模板 data-model.md"
```

---

### Task 4: 术语表子模板 glossary.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/glossary.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 术语表（Glossary）

> 对应 DESIGN.md §3 核心概念与术语。详细设计域术语子集；全量术语权威表见 `references/glossary.md`，
> 本文件仅收录本项目详细设计域新引入/易混淆术语，引用权威表编号。
> **阶段边界**：只收详细设计域术语（类/方法/表/索引/store 等），接口域术语由阶段 3 术语表承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 术语表详见 [{{module}}-glossary.md](./{{module}}-glossary.md)`。

## 术语表

| 术语 | 定义 | 来源引用（references/glossary.md 或设计原文） |
|---|---|---|
| {{术语}} | {{定义}} | {{来源}} |

> 强制：每条术语有定义 + 来源引用；与 `references/glossary.md` 权威表冲突时以权威表为准并在此标注差异。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/detailed-design/glossary.md`
Expected: 含术语表 + 来源引用列 + 权威表优先级声明 + 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/glossary.md
git commit -m "feat(templates): 新增术语表子模板 glossary.md"
```

---

### Task 5: 追踪矩阵子模板 traceability-matrix.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/traceability-matrix.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 详细设计追踪矩阵（Traceability Matrix）

> 对应 DESIGN.md §2.1.1 需求条目化追踪矩阵。Phase 4 适配：DD 编号 → 主文档 §1/§2 类与数据设计。
> **阶段边界**：本文件是详细设计级追踪（DD×INTF），编码级映射（DD→codeModule）由阶段 5 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 追踪矩阵详见 [{{module}}-traceability-matrix.md](./{{module}}-traceability-matrix.md)`。

## 1. DD×INTF 8 字段表

| DD 编号 | 对应 INTF 编号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |
|---|---|---|---|---|---|---|---|
| DD-{{xx}} | INTF-{{xx}} | P0 | {{主文档 §1 类 / §2 表}} | S-{{xx}} | {{设计完成/待编码}} | {{UT-NNN / UAT-NNN}} | {{可判定表达式}} |

> 强制：`设计落点§` 指向主文档 §1 类设计或 §2 数据库设计；`对应 INTF 编号` 与 phase3 追踪矩阵一致（R13 门禁校验）。

## 2. 需求×测试层级承接矩阵

| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |
|---|---|---|---|---|
| REQ-{{xxx}} | ● UT-{{NNN}} | ● IT-{{NNN}} | ● ST-{{NNN}} | ● UAT-{{NNN}} + 判据 |
| NFR-{{xxx}} | ● UT-{{NNN}} | ● IT-{{NNN}} | ● ST-{{NNN}} | ● UAT-{{NNN}} + 双字段判据 |

> 矩阵每格 ●/― 为设计事实的测试层级承接归属；Phase 4 单元/验收列填实，
> 集成/系统列沿用 phase2/3 回填值（主文档 §3 单元测试用例索引 + RTM 登记）。
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/detailed-design/traceability-matrix.md`
Expected: 含 §1 字段表（8 列）+ §2 测试层级承接矩阵（5 列）+ 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/traceability-matrix.md
git commit -m "feat(templates): 新增追踪矩阵子模板 traceability-matrix.md"
```

---

### Task 6: 行为规格模型子模板 behavior-spec.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/behavior-spec.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# 行为规格模型（Behavior Spec，L4）

> 对应 DESIGN.md §7 行为规格模型。**本文件仅定义引用关系，不内联 feature 块、不定义文档级头规范**——
> `.feature` 文件由 `references/bdd-guide.md` §2 头规范管（@req/@design/@designIds/@system/@tla-spec/@state-machine 等 10 字段），
> `bdd-manifest.json` 登记 feature 资产。**阶段边界**：本文件只定义 L4（类/方法级）行为规格引用。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)`。

## 1. L4 行为规格角色

- L4 行为规格在详细设计阶段的角色：以可执行场景（Given/When/Then）验证类/方法行为可被验收
- 行为规格与类定义互补：行为规格验证"方法行为如何被接受"，类定义定义"类如何组织"
- 行为规格不替代类定义，也不替代 TLA+ 行为正确性基准（.tla 文件）

## 2. 与 .feature 文件的引用关系

| DD / 类 | 对应 .feature 文件 | 关键场景（Scenario 名） | bdd-manifest 登记 |
|---|---|---|---|
| DD-{{xx}} | `features/L4/{{system}}_{{subsystem}}_{{atom}}_{{method}}-{{num}}.feature` | {{Scenario 名}} | {{是/否}} |

> 强制：每个 L4 行为规格条目列出对应 .feature 文件路径；`.feature` 文件存在性由 `check-bdd-model.ts` D1-D7 校验。

## 3. 与详细设计文档的关系

- 行为规格条目须能回溯到主文档 §1 类设计 / phase3 接口设计（无孤儿行为规格）
- 行为规格新增/变更须同步主文档 §5 追踪矩阵 + RTM 登记，禁止只改 .feature 不回填
```

- [ ] **Step 2: 自检**

Run: `Read w-model-dev/templates/detailed-design/behavior-spec.md`
Expected: 含「不内联 feature 块」声明 + 引用关系表 + 强制回溯声明 + 阶段边界声明

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/behavior-spec.md
git commit -m "feat(templates): 新增行为规格模型子模板 behavior-spec.md"
```

---

### Task 7: 工程纪律与 DoD 子模板 discipline-dod.md

**Files:**
- Create: `w-model-dev/templates/detailed-design/discipline-dod.md`

- [ ] **Step 1: 创建子模板文件**

```markdown
# Phase 4 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 4 收敛子集；完整工程宪法见 `SKILL.md`，
> 项目级 DoD 见 `references/definition-of-done.md`。
> **阶段边界**：本文件只约束详细设计阶段纪律。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> Phase 4 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)`。

## 1. 详细设计阶段纪律

- 设计事实以本模块主文档为 SSOT，变更须经阶段门评审 / 上游概要设计变更回流（见主文档 §0）
- 禁止生成无断言占位用例（每个用例须 `expect()` 或等价断言，FM-DD-01）
- 禁止只覆盖 happy path（须覆盖边界条件必覆盖清单，FM-DD-02）
- 禁止跨模块 store 误用（store 归属与 phase3 一致，FM-DD-03）
- 禁止占位词进入正式交付（见主文档 §0）

## 2. DoD 可勾选清单

- [ ] 功能与语义：类/方法设计满足接口契约，无语义悖反
- [ ] 结构性校验：§1/§2/§4/§5/§6/§7 引用块指向文件存在、类图/ER 图 mermaid 块配平、追踪矩阵字段一致
- [ ] 证据充分：方法定义含前置/后置/异常、表结构含字段/索引/关系、验收判据可量化
- [ ] 无越界：不回溯重定义接口契约（FM-DD-06 闭合）
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=4` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=4` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
```

> **DoD 门禁**：`check-artifact-gate.ts --phase=4` 校验本文件 `- [ ]` 项 ≥ 8 条（Task 13 Step 3 实现）。

- [ ] **Step 2: 自检**

Run: `Grep -- '- \[ \]' w-model-dev/templates/detailed-design/discipline-dod.md | Measure-Object -Line`
Expected: 8（DoD 清单 8 项）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/templates/detailed-design/discipline-dod.md
git commit -m "feat(templates): 新增工程纪律与 DoD 子模板 discipline-dod.md"
```

---

### Task 8: 批 1 父代理回归

- [ ] **Step 1: 验证 6 子模板齐全 + 主模板引用块完整**

Run: `Glob 'w-model-dev/templates/detailed-design/*.md'`
Expected: 6 个文件（class-design/data-model/glossary/traceability-matrix/behavior-spec/discipline-dod）

Run: `Grep '详见 \[.*\.md\]\|细节详见 \[.*\.md\]' w-model-dev/templates/detailed-design.md`
Expected: 6 处引用块，分别指向 6 个子模板对应产物文件名（class-design.md/data-model.md/glossary.md/traceability-matrix.md/behavior-spec.md/discipline-dod.md）

Run: `Grep '^## ' w-model-dev/templates/detailed-design.md`
Expected: §1-§3 既有节号保留 + §4-§8 新增引用块节

- [ ] **Step 2: 提交批 1 汇总（如还有未提交改动）**

```bash
git add w-model-dev/templates/
git commit -m "feat(templates): 批1完成——主模板重构 + 6 独立子模板"
```

---

## 批 2：参考层（phase-4-detailed-design.md 扩展）

### Task 9: phase-4-detailed-design.md 算法扩步 + 失败模式 + 禁止行为 + 验收标准

**Files:**
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: 阅读现有文件结构**

Run: `Read w-model-dev/references/phase-4-detailed-design.md`
Expected: 确认现有节（功能描述/输入/输出/AI 能力/执行方法论/测试用例设计/seam/并行任务/设计项装配点一致性/字段命名对齐/测试用例生成算法/RTM/跨模块数据源/ingestion/验收标准/阶段门/禁止行为 #1-6/返工路径/退出状态）

- [ ] **Step 2: 输出节补充独立产物说明**

在 §输出 的「- 单元测试用例设计文档」行之后追加：

```markdown
- 独立产物文件（第 38 轮新增，主文档引用块指向，均位于 `docs/phase4-detailed/`，带 `{module}-` 前缀）：
  - `{module}-class-design.md`：类设计（类图 + 类定义 + 方法级定义 + 类状态机）
  - `{module}-data-model.md`：数据模型（ER 图 + 表结构 + 索引 + store 归属）
  - `{module}-glossary.md`：术语表（详细设计域子集）
  - `{module}-traceability-matrix.md`：详细设计追踪矩阵（DD×INTF 8 字段 + 测试层级矩阵）
  - `{module}-behavior-spec.md`：行为规格模型（L4 .feature 引用关系）
  - `{module}-discipline-dod.md`：工程纪律与 DoD 可勾选清单
```

- [ ] **Step 3: 新增「详细设计算法」节（在功能描述之后插入）**

```text
## 详细设计算法

  1. 类设计
     ├─ 基于概要设计接口契约，产出 docs/phase4-detailed/{module}-class-design.md（类图 + 类定义 + 方法级定义 + 类状态机）
     ├─ 主文档 §1 引用块指向 class-design.md
     ├─ 失败: 方法定义缺前置/后置/异常 → 回步骤 1（FM-DD-02）
     └─ 成功: 类设计完整，主文档 §1 类定义与之对应
  2. 数据模型设计
     ├─ 产出 docs/phase4-detailed/{module}-data-model.md（ER 图 + 表结构 + 索引 + store 归属）
     ├─ 主文档 §2 引用块指向 data-model.md
     ├─ 失败: 表结构缺索引/关系 / store 归属与 phase3 不一致 → 回步骤 2（FM-DD-03）
     └─ 成功: 数据模型完整，store 归属与 phase3 一致
  3. 装配点与测试 seam 声明
     ├─ 每个设计项声明装配点（中间件链位置等）与测试 seam（HTTP 层/独立实例/白盒）
     ├─ 失败: 装配点空但 seam 为 HTTP 层 → 回步骤 3（FM-DD-05）
     └─ 成功: 装配点与 seam 一致性成立
  4. 术语建模（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-glossary.md（详细设计域术语子集）
     ├─ 主模板 §4 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. 追踪矩阵与行为规格引用（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-traceability-matrix.md（DD×INTF 8 字段 + 测试层级矩阵）
     ├─ 产出 docs/phase4-detailed/{module}-behavior-spec.md（L4 .feature 引用关系）
     ├─ 主模板 §5/§6 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/2 不一致 → 回步骤 5 对齐（FM-DD-04）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  6. Phase 4 工程纪律与 DoD（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §7 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立
```

- [ ] **Step 4: 执行方法论表新增产出物行**

在 §执行方法论 的产出物处追加：

```markdown
| 类设计 | 套用 `templates/detailed-design/class-design.md` | `docs/phase4-detailed/{module}-class-design.md` |
| 数据模型 | 套用 `templates/detailed-design/data-model.md` | `docs/phase4-detailed/{module}-data-model.md` |
| 术语表 | 套用 `templates/detailed-design/glossary.md` | `docs/phase4-detailed/{module}-glossary.md` |
| 详细设计追踪矩阵 | 套用 `templates/detailed-design/traceability-matrix.md` | `docs/phase4-detailed/{module}-traceability-matrix.md` |
| 行为规格模型（L4） | 套用 `templates/detailed-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase4-detailed/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/detailed-design/discipline-dod.md` | `docs/phase4-detailed/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/detailed-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase4-detailed/{module}-detailed-design.md` |
```

- [ ] **Step 5: 新增失败模式矩阵（FM-DD-01~05）**

在 §测试用例生成算法 之后追加：

```markdown
## 失败模式矩阵（第 38 轮新增）

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-DD-01 | 无断言占位用例 | 单元测试用例无 `expect()` 或等价断言 | 回测试用例生成，补全断言（禁止 // TODO: assert） |
| FM-DD-02 | 方法定义缺前置/后置/异常 | 类方法定义缺前置条件/后置条件/异常任一 | 回步骤 1 补全方法契约 |
| FM-DD-03 | 表结构缺索引/关系 / store 误用 | 表结构缺索引或关系；store 归属与 phase3 不一致 | 回步骤 2 补全表结构或回 phase3 返工 |
| FM-DD-04 | 追踪矩阵字段不一致 | traceability-matrix.md 与主文档 §1/§2/phase3 追踪矩阵不一致 | 回步骤 5 对齐追踪矩阵字段 |
| FM-DD-05 | 装配点与测试 seam 不一致 | 设计项装配点为空但测试 seam 为 HTTP 层 | 回步骤 3 补全装配点或调整 seam |
```

> 注：FM-DD-06（越过阶段边界回溯重定义接口契约/落编码实现）为越界检测信号，见禁止行为 #9 与返工路径，不单列于上表。

- [ ] **Step 6: 新增禁止行为 #7/#8/#9**

在禁止行为表（#6 行之后）追加：

```markdown
| 7 | 追踪矩阵字段与主文档 §1/§2 / phase3 追踪矩阵不一致 | 步骤 5 须对齐 traceability-matrix.md（FM-DD-04） |
| 8 | 表结构缺索引/关系 / store 归属与 phase3 不一致 | 步骤 2 须补全表结构与 store 归属（FM-DD-03） |
| 9 | 越过阶段边界回溯重定义接口契约/落编码实现 | 接口契约属阶段 3、编码属阶段 5，本阶段只产类/数据级（FM-DD-06 禁止越界） |
```

- [ ] **Step 7: 返工路径补充**

在 §返工路径 追加：

```markdown
- 无断言占位（FM-DD-01）→ 回测试用例生成补全断言
- 方法契约缺失（FM-DD-02）→ 回步骤 1 补全前置/后置/异常
- 表结构/store 问题（FM-DD-03）→ 回步骤 2 补全或回 phase3 返工
- 追踪矩阵不一致（FM-DD-04）→ 回步骤 5 对齐
- 装配点不一致（FM-DD-05）→ 回步骤 3 补全装配点
- 越界回溯接口/落编码（FM-DD-06）→ 移除越界内容，接口契约移交阶段 3、编码移交阶段 5
```

- [ ] **Step 8: 验收标准补充**

在 §验收标准 追加 4 条：

```markdown
- [ ] {module}-class-design.md + {module}-data-model.md 已产出，主文档 §1/§2 引用块成立
- [ ] {module}-traceability-matrix.md（DD×INTF + 测试层级矩阵）与主文档 §1/§2/phase3 矩阵一致，主文档 §5 引用块成立
- [ ] {module}-glossary.md + {module}-behavior-spec.md 已产出，主文档 §4/§6 引用块成立
- [ ] {module}-discipline-dod.md 已产出（DoD ≥ 8 项），主文档 §7 引用块成立
```

- [ ] **Step 9: 提交**

```bash
git add w-model-dev/references/phase-4-detailed-design.md
git commit -m "docs(references): phase-4 算法扩步 + FM-DD-01~05 + 禁止行为 #7/#8/#9"
```

---

### Task 10: 批 2 父代理回归

- [ ] **Step 1: 一致性核对**

Run: `Grep 'FM-DD-0[1-6]\|禁止行为 #[789]\|步骤 [1-6]' w-model-dev/references/phase-4-detailed-design.md`
Expected: 各出现且编号连续（FM-DD-01~06、禁止行为 #7/#8/#9、步骤 1-6）

Run: `Grep 'class-design.md\|data-model.md\|glossary.md\|traceability-matrix.md\|behavior-spec.md\|discipline-dod.md' w-model-dev/references/phase-4-detailed-design.md`
Expected: 6 个产物名在算法/执行方法论/输出节/验收标准中一致出现

- [ ] **Step 2: 提交批 2 汇总（如还有未提交改动）**

```bash
git add w-model-dev/references/
git commit -m "docs(references): 批2完成——phase-4 参考层扩展"
```

---

## 批 3：门禁层（脚本扩展）

### Task 11: graph-logic.ts 新增 R13/R14 校验

**Files:**
- Modify: `w-model-dev/scripts/logic/graph-logic.ts`

- [ ] **Step 1: 阅读现有 R11/R12 区**

Run: `Grep 'checkOutlineSpecEnhance' w-model-dev/scripts/logic/graph-logic.ts`
Expected: 定位小轮 B 的 checkOutlineSpecEnhance（R11/R12）函数末尾

- [ ] **Step 2: 新增 checkDetailedSpecEnhance 函数（R13/R14，第 38 轮小轮 C）**

在文件末尾追加：

```typescript

export interface DetailedSpecEnhanceViolations {
  r13: string[];
  r14: string[];
}

/** R13 详细设计追踪矩阵一致性 + R14 UML mermaid 配平（第 38 轮小轮 C）
 *  @param traceMatrixContent  {module}-traceability-matrix.md 内容
 *  @param designDocContent    主文档 {module}-detailed-design.md 内容（用于 §1/§2 校验）
 *  @param umlContent          {module}-class-design.md + {module}-data-model.md 合并内容（R14 双源）
 *  @param intfTraceIds        phase3 追踪矩阵 INTF 编号集合（可选，为空则跳过 phase3 侧校验）
 */
export function checkDetailedSpecEnhance(
  traceMatrixContent: string,
  designDocContent: string,
  umlContent: string,
  intfTraceIds?: Set<string>,
): DetailedSpecEnhanceViolations {
  const v: DetailedSpecEnhanceViolations = { r13: [], r14: [] };
  // R14: mermaid 块配平（先于 R13，轻量；class-design + data-model 合并内容）
  const mb = countMermaidBlocks(umlContent);
  if (!mb.balanced) {
    v.r14.push(`R14 UML mermaid 块配平失败：pairs=${mb.pairs} 但定界未配对`);
  }
  if (mb.pairs === 0) {
    v.r14.push('R14 UML mermaid 块缺失：class-design.md/data-model.md 无 ```mermaid 代码块');
  }
  // R13: 追踪矩阵一致性
  const hasSection1 = /^##\s+1[.\s]/m.test(designDocContent);
  if (!hasSection1) v.r13.push('R13 追踪矩阵一致性失败：主文档缺 §1 类设计节');
  const rows = parseMarkdownTable(traceMatrixContent);
  if (rows.length === 0) {
    v.r13.push('R13 追踪矩阵为空：traceability-matrix.md 无数据行');
    return v;
  }
  for (const row of rows) {
    const dd = row['DD 编号'] ?? '';
    const intf = row['对应 INTF 编号'] ?? '';
    const loc = row['设计落点§'] ?? '';
    if (dd && !/^DD-/.test(dd)) v.r13.push(`R13 DD 编号格式失败：${dd}`);
    if (intf && !/^INTF-/.test(intf)) v.r13.push(`R13 对应 INTF 编号格式失败：${intf}`);
    if (loc && !/^§?\s*[12]/.test(loc)) v.r13.push(`R13 设计落点§ 引用失败：${dd} → ${loc}（须指向主文档 §1 类或 §2 数据）`);
    if (intfTraceIds && intf && !intfTraceIds.has(intf)) v.r13.push(`R13 phase3 追踪矩阵 INTF 缺失：${intf}`);
  }
  return v;
}
```

- [ ] **Step 3: TypeScript 编译检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 错误

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/scripts/logic/graph-logic.ts
git commit -m "feat(scripts): graph-logic 新增 R13/R14 校验（Phase 4 详细设计）"
```

---

### Task 12: check-requirement-graph.ts CLI phase=4 分支

**Files:**
- Modify: `w-model-dev/scripts/cli/check-requirement-graph.ts`

- [ ] **Step 1: 阅读现有 phase=2/3 分支**

Run: `Grep 'phase === 2 \|\| phase === 3' w-model-dev/scripts/cli/check-requirement-graph.ts`
Expected: 定位小轮 B 的 phase=2/3 分发块

- [ ] **Step 2: 扩展 --spec-dir 解析为 phase=2/3/4 分发**

将 `if (phase === 2 || phase === 3) {` 改为 `if (phase === 2 || phase === 3 || phase === 4) {`，并按 phase 适配：

```typescript
      if (phase === 2 || phase === 3 || phase === 4) {
        // 第 38 轮：Phase 2/3/4 module 前缀 glob 匹配（每类恰 1 个文件）
        const mainSuffix = phase === 2 ? '-system-design.md' : phase === 3 ? '-interface-design.md' : '-detailed-design.md';
        const mainFile = readdirSync(specDir).find(f => f.endsWith(mainSuffix));
        const traceFile = readdirSync(specDir).find(f => f.endsWith('-traceability-matrix.md'));
        const umlFile = readdirSync(specDir).find(f => f.endsWith('-uml-modeling.md'));
        // Phase 4 无独立 uml-modeling.md：R14 源 = class-design.md + data-model.md 合并
        const classFile = readdirSync(specDir).find(f => f.endsWith('-class-design.md'));
        const dataModelFile = readdirSync(specDir).find(f => f.endsWith('-data-model.md'));
        const umlContent = phase === 4
          ? `${classFile ? readOrEmpty(path.join(specDir, classFile)) : ''}\n${dataModelFile ? readOrEmpty(path.join(specDir, dataModelFile)) : ''}`
          : (umlFile ? readOrEmpty(path.join(specDir, umlFile)) : '');
        const traceContent = traceFile ? readOrEmpty(path.join(specDir, traceFile)) : '';
        if (phase === 2) {
          designEnhanceViolations = checkDesignSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            rtmRows ? new Set(rtmRows.map(r => r.requirementId)) : undefined,
          );
        } else if (phase === 3) {
          const sdIds = Array.isArray((parsed as GraphShape)?.nodes)
            ? new Set((parsed as GraphShape).nodes.filter(n => n.type === 'SD').map(n => n.id))
            : undefined;
          outlineEnhanceViolations = checkOutlineSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            sdIds,
          );
        } else {
          // phase=4：INTF 集合从 graph.json INTF 节点提取
          const intfIds = Array.isArray((parsed as GraphShape)?.nodes)
            ? new Set((parsed as GraphShape).nodes.filter(n => n.type === 'INTF').map(n => n.id))
            : undefined;
          detailedEnhanceViolations = checkDetailedSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            intfIds,
          );
        }
        // 引用块完整性：主文档引用块指向的 6 文件须存在（以主文档 module 前缀核对）
        const pushRefError = (rule: 'r9' | 'r11' | 'r13', msg: string): void => {
          if (phase === 2) designEnhanceViolations?.r9.push(msg);
          else if (phase === 3) outlineEnhanceViolations?.r11.push(msg);
          else detailedEnhanceViolations?.r13.push(msg);
        };
        if (mainFile) {
          const module = mainFile.slice(0, -mainSuffix.length);
          const subRefs = phase === 2
            ? ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling']
            : phase === 3
              ? ['interface-contract', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling']
              : ['class-design', 'data-model', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod'];
          for (const sub of subRefs) {
            if (!fs.existsSync(path.join(specDir, `${module}-${sub}.md`))) {
              pushRefError(phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13', `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} 引用块断裂：主文档引用 ${module}-${sub}.md 但文件不存在`);
            }
          }
          if (readdirSync(specDir).filter(f => f.endsWith(mainSuffix)).length !== 1) {
            pushRefError(phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13', `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} module 前缀匹配失败：主文档须恰 1 个 *${mainSuffix}`);
          }
        } else {
          pushRefError(phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13', `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} module 前缀匹配失败：未找到 *${mainSuffix} 主文档`);
        }
      }
```

> **注意**：声明区追加 `let detailedEnhanceViolations: DetailedSpecEnhanceViolations | undefined;`；import 追加 `checkDetailedSpecEnhance` + `type DetailedSpecEnhanceViolations`。

- [ ] **Step 3: 结果合并区追加**

在 `if (outlineEnhanceViolations)` 块之后追加：

```typescript
  if (detailedEnhanceViolations) {
    for (const msg of detailedEnhanceViolations.r13) result.violations.push(msg);
    for (const msg of detailedEnhanceViolations.r14) result.violations.push(msg);
    recalculatePassed(result, false);
  }
```

- [ ] **Step 4: 用法注释更新**

```text
 * 用法（第 38 轮小轮 C 新增 R13/R14）：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> --phase=4 --spec-dir=docs/phase4-detailed
 *     --spec-dir  Phase 4 时按 *-detailed-design.md / *-traceability-matrix.md / *-class-design.md / *-data-model.md 匹配
```

- [ ] **Step 5: 编译 + 回归验证**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 错误
Run: `npm run self-test` → 退出码 0（既有样本无回归）

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/cli/check-requirement-graph.ts
git commit -m "feat(scripts): check-requirement-graph --spec-dir 支持 Phase 4 module 前缀 glob + R13/R14"
```

---

### Task 13: gate-logic.ts PHASE_SPEC_LAYOUT 加 phase=4 + check-artifact-gate 确认

**Files:**
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`
- Modify: `w-model-dev/scripts/cli/check-artifact-gate.ts`（确认）

- [ ] **Step 1: 阅读现有 PHASE_SPEC_LAYOUT**

Run: `Read w-model-dev/scripts/logic/gate-logic.ts`（300-330 行）
Expected: 确认 layout 结构（phase 1/2/3）

- [ ] **Step 2: PHASE_SPEC_LAYOUT 追加 phase=4**

```typescript
const PHASE_SPEC_LAYOUT: Record<number, { mainSuffix: string; refs: string[] }> = {
  1: {
    mainSuffix: 'requirement-spec.md',
    refs: ['system-context.md', 'glossary.md', 'traceability-matrix.md', 'behavior-spec.md', 'discipline-dod.md', 'uml-modeling.md'],
  },
  2: {
    mainSuffix: '-system-design.md',
    refs: ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  3: {
    mainSuffix: '-interface-design.md',
    refs: ['interface-contract', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  4: {
    mainSuffix: '-detailed-design.md',
    refs: ['class-design', 'data-model', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod'],
  },
};
```

- [ ] **Step 3: checkArtifactGate 调用条件补 phase=4**

将 `if ((phase === 1 || phase === 2 || phase === 3) && options?.specDir) {` 改为：

```typescript
  if ((phase === 1 || phase === 2 || phase === 3 || phase === 4) && options?.specDir) {
```

（同步更新上方注释「phase=1/2/3」→「phase=1/2/3/4」）

- [ ] **Step 4: 注释更新**

`@param phase  1/2/3（4 由后续小轮扩展）` 改为 `@param phase  1/2/3/4`；`不支持的 phase=${phase}（当前支持 1/2/3）` 改为 `（当前支持 1/2/3/4）`。

- [ ] **Step 5: check-artifact-gate.ts 确认**

Run: `Grep 'checkArtifactGate(matrix' w-model-dev/scripts/cli/check-artifact-gate.ts`
Expected: phaseOption + specDir 已传入，无需改动

- [ ] **Step 6: 编译 + 回归**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 错误
Run: `npm run self-test` → 退出码 0（Phase 1/2/3 结构校验行为不变）

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts
git commit -m "feat(scripts): gate PHASE_SPEC_LAYOUT 加 phase=4 + checkArtifactGate 调用条件补 phase=4"
```

---

### Task 14: samples + self-test 基线 + vitest 单测

**Files:**
- Create: `w-model-dev/scripts/samples/graph/valid-detailed-enhance.json`、`bad-detailed-r13.json`、`bad-detailed-r14.json`、`bad-detailed-missing-section1.json`
- Create: `w-model-dev/scripts/samples/gate/valid-phase4-spec-structure.json`、`bad-phase4-refs-missing.json`、`bad-phase4-ssot-header.json`、`bad-phase4-dod-incomplete.json`
- Modify: `w-model-dev/scripts/cli/self-test.ts`
- Modify: `w-model-dev/scripts/__tests__/graph-logic.test.ts`
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **Step 1: 创建 graph samples（R13/R14）**

`w-model-dev/scripts/samples/graph/valid-detailed-enhance.json`：

```json
{
  "sampleType": "graph-detailed-enhance",
  "description": "R13/R14 通过样本：traceability-matrix.md 字段合法 + class/data mermaid 块配平",
  "expectedPassed": true,
  "traceabilityMatrix": "| DD 编号 | 对应 INTF 编号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| DD-001 | INTF-001 | P0 | §1 | S-01 | 设计完成 | UT-001 | 响应 < 2s |\n| DD-002 | INTF-002 | P0 | §2 | S-02 | 设计完成 | UT-002 | 可用性 >= 99% |\n\n## 2. 需求×测试层级承接矩阵\n\n| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |\n|---|---|---|---|---|\n| REQ-001 | ● UT-001 | ● IT-001 | ● ST-001 | ● UAT-001 |\n",
  "umlModeling": "```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n```mermaid\nerDiagram\n  ENT1 ||--o{ ENT2 : rel\n```\n",
  "designDocContent": "## 1. 类设计\n\n## 2. 数据库设计\n"
}
```

`w-model-dev/scripts/samples/graph/bad-detailed-r13.json`：

```json
{
  "sampleType": "graph-detailed-enhance",
  "description": "R13 失败样本：DD 编号非法 + 设计落点§ 非法",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R13 DD 编号格式失败", "R13 设计落点§ 引用失败"],
  "traceabilityMatrix": "| DD 编号 | 对应 INTF 编号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| SD-001 | INTF-001 | P0 | xxx | S-01 | 设计完成 | UT-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n",
  "designDocContent": "## 1. 类设计\n"
}
```

`w-model-dev/scripts/samples/graph/bad-detailed-r14.json`：

```json
{
  "sampleType": "graph-detailed-enhance",
  "description": "R14 失败样本：mermaid 块未配平",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R14 UML mermaid 块配平失败"],
  "traceabilityMatrix": "| DD 编号 | 对应 INTF 编号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| DD-001 | INTF-001 | P0 | §1 | S-01 | 设计完成 | UT-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n```mermaid\nerDiagram\n  ENT1 ||--o{ ENT2 : rel\n",
  "designDocContent": "## 1. 类设计\n"
}
```

`w-model-dev/scripts/samples/graph/bad-detailed-missing-section1.json`（覆盖 R13 的 hasSection1 分支）：

```json
{
  "sampleType": "graph-detailed-enhance",
  "description": "R13 失败样本：主文档缺 §1 类设计节",
  "expectedPassed": false,
  "expectedReasonPatterns": ["R13 追踪矩阵一致性失败：主文档缺 §1 类设计节"],
  "traceabilityMatrix": "| DD 编号 | 对应 INTF 编号 | 优先级 | 设计落点§ | 涉及子系统 | 实现状态 | 验收关联 | 逐条验收判据 |\n|---|---|---|---|---|---|---|---|\n| DD-001 | INTF-001 | P0 | §1 | S-01 | 设计完成 | UT-001 | 响应 < 2s |\n",
  "umlModeling": "```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n",
  "designDocContent": "## 2. 数据库设计\n"
}
```

- [ ] **Step 2: 创建 gate samples（phase=4 结构校验）**

`valid-phase4-spec-structure.json`（mainDoc: `blog-system-detailed-design.md`，refFiles 6 个 `blog-system-{class-design,data-model,glossary,traceability-matrix,behavior-spec,discipline-dod}.md`，specContent 含 §0 四项 + 6 引用块 `./blog-system-xxx.md`，dodContent 8 项）。

`bad-phase4-refs-missing.json`：refFiles 缺 `blog-system-discipline-dod.md` + specContent 缺对应引用块行。
`bad-phase4-ssot-header.json`：specContent 缺「自身校验」。
`bad-phase4-dod-incomplete.json`：dodContent 仅 5 项。

> bad 变体沿用 valid 字段结构（mainDoc/specContent/refFiles/dodContent），仅按上述差异修改。

- [ ] **Step 3: self-test.ts 基线 241→249 注册**

新增两个样本集合并追加到入口（参照小轮 B 的 OUTLINE_ENHANCE_CASES / PHASE3_SPEC_STRUCTURE_CASES 模式）：

```typescript
// ==================== Phase 4 详细设计增强（第 38 轮小轮 C） ====================

interface DetailedEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const DETAILED_ENHANCE_CASES: DetailedEnhanceCase[] = [
  { file: 'valid-detailed-enhance.json', expectedPassed: true, description: 'R13/R14 通过：DD 字段合法 + class/data mermaid 配平' },
  { file: 'bad-detailed-r13.json', expectedPassed: false, expectedReasonPatterns: [/R13 DD 编号格式失败/, /R13 设计落点§ 引用失败/], description: 'R13 失败：DD 编号非法 + 落点§ 非法' },
  { file: 'bad-detailed-r14.json', expectedPassed: false, expectedReasonPatterns: [/R14 UML mermaid 块配平失败/], description: 'R14 失败：mermaid 块未配平' },
  { file: 'bad-detailed-missing-section1.json', expectedPassed: false, expectedReasonPatterns: [/R13 追踪矩阵一致性失败：主文档缺 §1 类设计节/], description: 'R13 失败：主文档缺 §1 类设计节' },
];

interface Phase4SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const PHASE4_SPEC_STRUCTURE_CASES: Phase4SpecStructureCase[] = [
  { file: 'valid-phase4-spec-structure.json', expectedPassed: true, description: 'Phase 4 结构校验通过：6 引用块 + SSOT 头 + DoD 8 项' },
  { file: 'bad-phase4-refs-missing.json', expectedPassed: false, expectedReasonPatterns: [/引用文件不存在 blog-system-discipline-dod.md/], description: 'Phase 4 结构校验失败：引用文件缺失' },
  { file: 'bad-phase4-ssot-header.json', expectedPassed: false, expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/], description: 'Phase 4 结构校验失败：SSOT 头缺声明' },
  { file: 'bad-phase4-dod-incomplete.json', expectedPassed: false, expectedReasonPatterns: [/DoD 清单仅 5 项/], description: 'Phase 4 结构校验失败：DoD 清单 < 8' },
];
```

新增 runner（参照 runOutlineEnhanceCases / runPhase3SpecStructureCases，喂给 `checkDetailedSpecEnhance(parsed.traceabilityMatrix, parsed.designDocContent, parsed.umlModeling)` 与 `checkPhaseSpecStructure(4, dir, fsStub)`，dir 用 `path.join('docs', 'phase4-detailed')`）。

在 `main()` 的 Promise.all + all 数组 + 控制台计数追加 `runDetailedEnhanceCases` / `runPhase4SpecStructureCases`；import 追加 `checkDetailedSpecEnhance`（graph-logic）。

> **注意**：基线以 `npm run self-test` 实际输出为准——当前 241，本轮新增 8 条样本（4 graph：valid/bad-r13/bad-r14/bad-missing-section1 + 4 gate），最终 **249**（241+8，对齐前两轮经验）。若实际输出非 249，以实际为准记录。

- [ ] **Step 4: vitest 单测**

`__tests__/graph-logic.test.ts` 追加（import 合并到既有）：

```typescript
describe('R13 详细设计追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n',
      '## 1. 类设计\n',
      '```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n',
    );
    expect(v.r13).toEqual([]);
  });
  it('DD 编号非法报 R13', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| SD-001 | INTF-001 | §1 |\n',
      '## 1. 类设计\n',
      '',
    );
    expect(v.r13.some(m => m.includes('DD 编号格式'))).toBe(true);
  });
  it('主文档缺 §1 类设计节报 R13', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n',
      '## 2. 数据库设计\n',
      '',
    );
    expect(v.r13.some(m => m.includes('主文档缺 §1 类设计节'))).toBe(true);
  });
});

describe('R14 UML mermaid 块配平', () => {
  it('未配平报 R14', () => {
    const v = checkDetailedSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r14.some(m => m.includes('配平'))).toBe(true);
  });
});
```

`__tests__/gate-enhancement.test.ts` 追加（复用 mkFs）：

```typescript
describe('Phase 4 详细设计结构校验', () => {
  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const files: Record<string, string> = {};
    const refs = ['blog-system-class-design.md', 'blog-system-data-model.md', 'blog-system-glossary.md', 'blog-system-traceability-matrix.md', 'blog-system-behavior-spec.md', 'blog-system-discipline-dod.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    for (const r of refs) files[`docs/phase4-detailed/${r}`] = '';
    files['docs/phase4-detailed/blog-system-detailed-design.md'] = spec;
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase4-detailed/blog-system-detailed-design.md'] = '> 详见 [x](./blog-system-discipline-dod.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('主文档 glob 零个报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });
});
```

- [ ] **Step 5: 全量回归**

Run: `cd w-model-dev && npm run self-test` → 退出码 0，基线 249 全通过（若实际数字不同以实际为准）
Run: `npx vitest run scripts/__tests__/` → 全部通过
Run: `npx tsc --noEmit -p tsconfig.json` → 0 错误

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/samples/ w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/__tests__/
git commit -m "test(scripts): R13/R14 + phase=4 结构校验 samples/self-test/vitest（基线 241→249）"
```

---

### Task 15: 批 3 父代理回归

- [ ] **Step 1: 全量门禁验证**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 全部通过，0 错误

Run: 手工构造临时 Phase 4 产物目录（含 `{module}-detailed-design.md` + 6 独立文件）跑 R13/R14 + gate 结构校验
Expected: 退出码 0

- [ ] **Step 2: 提交批 3 汇总（如还有未提交改动）**

```bash
git add w-model-dev/scripts/
git commit -m "feat(scripts): 批3完成——R13/R14 + phase=4 结构校验 + 回归基线 249"
```

---

## 批 4：同步层（verifier-spec / SKILL / SSoT / 版本号 / 顶层文档）

### Task 16: verifier-spec.md 评审新增项

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 定位 completeness 维度阶段 4 处**

Run: `Grep '阶段 3 概要设计结构完整性' w-model-dev/references/verifier-spec.md`
Expected: 定位小轮 B 加的 Phase 3 评审项

- [ ] **Step 2: 追加 Phase 4 评审项**

```markdown
- 阶段 4 详细设计结构完整性（第 38 轮小轮 C）：
  - 主文档 §1/§2/§4/§5/§6/§7 引用块指向的 6 个独立文件（class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）均存在且内容非空
  - traceability-matrix.md 字段与主文档 §1/§2 / phase3 追踪矩阵一致（对应 R13 门禁）
  - class-design.md + data-model.md mermaid 块配平且与主文档 §1/§2 对应（对应 R14 门禁）
  - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
  - 未越过阶段边界回溯重定义接口契约/落编码实现（FM-DD-06 检测）
```

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(references): verifier-spec completeness 维度新增 Phase 4 结构评审项"
```

---

### Task 17: SKILL.md + skill-metadata.json + package.json 版本号 38.2.0

**Files:**
- Modify: `w-model-dev/SKILL.md`
- Modify: `w-model-dev/skill-metadata.json`
- Modify: `package.json`

- [ ] **Step 1: SKILL.md 三处更新**

frontmatter：`version: 38.2.0`

阶段路由表 Phase 4 行下方追加（参照小轮 B 风格）：

```markdown
- **第 38 轮小轮 C 设计级别增强**：阶段 4（详细设计）：套用 templates/detailed-design.md 主模板 + 6 独立子模板（templates/detailed-design/），产出 docs/phase4-detailed/ 下 {module}-detailed-design.md + {module}-class-design.md + {module}-data-model.md + {module}-glossary.md + {module}-traceability-matrix.md + {module}-behavior-spec.md + {module}-discipline-dod.md；G 门禁 check-requirement-graph.ts --phase=4 --spec-dir=docs/phase4-detailed（R13/R14）+ check-artifact-gate.ts --phase=4 --spec-dir=docs/phase4-detailed（结构校验）
```

快速自检清单追加：

```markdown
- [ ] **Phase 4 详细设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
```

- [ ] **Step 2: skill-metadata.json + package.json 版本号**

均改为 `38.2.0`。

- [ ] **Step 3: 版本号一致性核验**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 三处均为 38.2.0

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json package.json
git commit -m "chore: 版本号三处一致 38.2.0（第 38 轮小轮 C Phase 4 设计级增强）"
```

---

### Task 18: SSoT + AGENTS.md + CHANGELOG.md + README.md

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: SSoT 新增 §3.4.38 条目**

在 §3.4.37（小轮 B）之后追加：

```markdown
#### 第 38 轮·小轮 C（2026-08-09）：Phase 4 详细设计设计级增强（SSoT §3.4.38）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求系统设计/概要设计/详细设计产出达到 DESIGN.md 级别结构严谨性（分三小轮，本轮为小轮 C：Phase 4，三小轮收官） |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守详细设计域边界（不回溯接口/不落编码） |
| 新增模板 | 6 独立子模板（templates/detailed-design/：class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）+ 主模板 detailed-design.md 重构（§0 SSOT 头 + 引用块，保留 §1-§3 节号）；Phase 4 无独立 UML 附录（类图/ER 图内嵌于 class-design/data-model） |
| 参考扩展 | phase-4-detailed-design.md 算法增步骤 1-6 + FM-DD-01~05 + 禁止行为 #7/#8/#9 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R13（DD 追踪矩阵一致性）/R14（UML mermaid 配平，class-design + data-model 双源）+ --spec-dir 支持 phase=4 glob；check-artifact-gate.ts phase=4 新增结构校验（PHASE_SPEC_LAYOUT 加 phase=4 + checkArtifactGate 调用条件补 phase=4） |
| 阶段边界 | Phase 4 只产类/数据级（类图/ER 图/方法级/表结构），FM-DD-06 拦截越界回溯接口/落编码 |
| self-test | 基线 241→249 |
| 版本号 | 38.2.0（三处一致） |
```

§10A 追溯表追加一行：`| §3.4.38 | 第 38 轮 Phase 4 设计级增强（小轮 C） |`

- [ ] **Step 2: AGENTS.md §1 新增小轮 C 条目**

```markdown
- **第 38 轮 Phase 4 设计级增强（小轮 C，三小轮收官）**：阶段 4 详细设计产出升级——主模板 + 6 独立子模板（class-design/data-model/glossary/traceability-matrix/behavior-spec/discipline-dod），主文档引用块串联，保留既有 §1-§3 节号；`check-requirement-graph.ts` 新增 R13/R14（--spec-dir 支持 phase=4 glob，R14 对 class-design + data-model 双源配平），`check-artifact-gate.ts --phase=4` 新增引用块/SSOT/DoD 校验。反模式总数 44 不变（仅 phase-4-detailed-design.md 内 FM-DD-01~05 + 禁止行为 #7/#8/#9）。详见 SSoT §3.4.38。
```

- [ ] **Step 3: CHANGELOG.md [38.2.0] 条目**

```markdown
## [38.2.0] - 2026-08-09

### Added
- Phase 4 详细设计 6 独立子模板（class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）
- check-requirement-graph.ts R13（DD 追踪矩阵一致性）/ R14（UML mermaid 块配平，class-design + data-model 双源）+ --spec-dir 支持 phase=4 glob
- check-artifact-gate.ts --phase=4 引用块完整性 / §0 SSOT 头 / DoD 清单校验

### Changed
- detailed-design.md 主模板重构（§0 SSOT 头 + 引用块串联，保留 §1-§3 既有节号）
- phase-4-detailed-design.md 算法增步骤 1-6 + FM-DD-01~05 + 禁止行为 #7/#8/#9
- verifier-spec.md completeness 维度新增 Phase 4 结构评审项
- self-test 基线 241→249；版本号 38.1.0 → 38.2.0
```

- [ ] **Step 4: README.md 能力 bullet（如有）**

Run: `Grep 'Phase 3|阶段 3|详细设计' README.md`，在 Phase 3 bullet 后追加「Phase 4 详细设计设计文档级结构：6 独立产物 + 引用块 + 门禁核验（R13/R14 + 结构校验）」。若 README 无阶段能力清单结构，跳过并在汇报说明。

- [ ] **Step 5: 全量回归**

Run: `cd w-model-dev && npm run self-test && npx vitest run` → 全通过

- [ ] **Step 6: 提交**

```bash
git add docs/skill-design-document_SSoT.md AGENTS.md CHANGELOG.md README.md
git commit -m "docs: SSoT/AGENTS/CHANGELOG/README 第 38 轮小轮 C 同步（38.2.0）"
```

---

### Task 19: 批 4 父代理回归 + 计划验收

- [ ] **Step 1: 版本号三处一致 + 引用可达**

Run: `Grep '"version"' package.json w-model-dev/skill-metadata.json; Grep '^version:' w-model-dev/SKILL.md`
Expected: 38.2.0 × 3

Run: `Grep 'templates/detailed-design/' w-model-dev/SKILL.md w-model-dev/references/phase-4-detailed-design.md w-model-dev/references/verifier-spec.md`
Expected: 引用一致

- [ ] **Step 2: 全量门禁终检**

Run: `cd w-model-dev && npm run self-test && npx vitest run && npx tsc --noEmit`
Expected: 退出码 0，0 错误，基线 249

Run: `npx tsx w-model-dev/scripts/cli/security-scan.ts`（若 baseline 需重生成则执行 `--regenerate` 后提交）
Expected: 0 新增

- [ ] **Step 3: 完成声明**

向用户汇报：批 1-4 全部完成，self-test 249 / vitest / tsc strict 全通过，版本号 38.2.0 三处一致，Phase 4 详细设计设计级增强交付。第 38 轮三小轮（Phase 2/3/4）全部完成。

---

## Self-Review 对照表

| Spec 章节要求 | 对应 Task | 覆盖 |
|---|---|---|
| 主模板重构（§0 SSOT 头 + 引用块 + 保留 §1-§3） | Task 1 | ✅ |
| 6 独立子模板（class-design/data-model/glossary/traceability-matrix/behavior-spec/discipline-dod） | Task 2-7 | ✅ |
| phase-4 算法增步骤 1-6 + 执行方法论表 | Task 9 Step 2/3/4 | ✅ |
| FM-DD-01~05 + 禁止行为 #7/#8/#9 + 返工路径 | Task 9 Step 5/6/7 | ✅ |
| 验收标准补充 4 条 | Task 9 Step 8 | ✅ |
| check-requirement-graph R13/R14 + --spec-dir phase=4 glob | Task 11/12 | ✅ |
| gate phase=4 结构校验（PHASE_SPEC_LAYOUT + 调用条件） | Task 13 | ✅ |
| samples 8 条 + self-test 241→249 + vitest | Task 14 | ✅ |
| verifier-spec 评审新增项 | Task 16 | ✅ |
| SKILL/skill-metadata/package 版本号 38.2.0 | Task 17 | ✅ |
| SSoT/AGENTS/CHANGELOG/README | Task 18 | ✅ |
| 批间父代理回归 + 全量门禁 | Task 8/10/15/19 | ✅ |
| 阶段边界红线（不回溯接口/不落编码，FM-DD-06） | Task 2-7 子模板边界标注 + Task 9 禁止行为 #9 + Task 16 V 评审 | ✅ |
| 主模板节号保留（§1-§3） | Task 1 节号保留 + Task 19 引用核验 | ✅ |
| R14 双源配平（无独立 uml-modeling） | Task 11 实现 + Task 12 CLI 合并 + Task 14 samples | ✅ |
| 命名遵循 directory-conventions §1（{module}- 前缀） | 计划头声明 + Task 9/12/13 使用 {module}- 前缀 | ✅ |
