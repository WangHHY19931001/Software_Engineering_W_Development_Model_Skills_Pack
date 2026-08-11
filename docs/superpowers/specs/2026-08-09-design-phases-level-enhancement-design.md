# Phase 2/3/4 设计阶段产出达到设计文档级别 — 设计 spec

> **创建日期**：2026-08-09
> **状态**：待用户复审
> **范围**：W 模型技能包阶段 2（系统设计）/ 阶段 3（概要设计）/ 阶段 4（详细设计）产出结构增强
> **方案**：方案 A（全要素对齐，模板+参考+门禁三层联动，对齐第 37 轮 Phase 1 增强模式）
> **交付节奏**：分三小轮（用户确认）——小轮 A：Phase 2 → 38.0.0；小轮 B：Phase 3 → 38.1.0；小轮 C：Phase 4 → 38.2.0
> **不向后兼容声明**：`system-design.md` / `interface-design.md` / `detailed-design.md` 模板重构，老模板产出须重新生成（对齐约束 #15 与第 37 轮风格）

---

## 1. 背景与目标

### 1.1 背景

参照对象 `DESIGN.md`（Shell Agent 设计文档，v1.15.0，717KB）具备以下结构严谨性机制：

- 文档定位与 SSOT 头（版本/修订机制/自身校验/不依赖外部审查声明）
- 需求条目化追踪矩阵（REQ/NFR 8 字段表 + 需求×测试层级承接矩阵）
- 核心概念与术语表
- 系统上下文图与边界原则
- 顶层架构（组件图/子系统清单/系统树/架构原则/ADR）
- 接口契约（§13.5/§13.7 方法签名 + 错误码 + 服务需求锚）
- 类图 / ER 图 / 状态机图 / 序列图（附录 A UML 2.0 图表集）
- 安全边界 / 操作性约束 / 测试验收策略
- 工程纪律与 DoD 可勾选清单
- 内联 feature 集（由 bdd 承接，不重复内联）

第 37 轮（2026-08-09）已完成 Phase 1 需求分析的设计级增强：主模板 `requirement-spec.md` 重构（§0 SSOT 头 + 引用块）+ 6 独立子模板（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）+ 参考层算法扩步（步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14）+ 门禁层（check-requirement-graph R7/R8 + check-artifact-gate --phase=1 结构校验）。

本轮将同一模式扩展至 Phase 2/3/4（系统设计/概要设计/详细设计），使用户要求的设计阶段产出达到 DESIGN.md 级别结构严谨性。

### 1.2 目标

把 Phase 2/3/4 设计产出提升到 DESIGN.md 级别的结构严谨性，严守阶段边界（每阶段只吸收本阶段对应章节，不越过阶段边界吸收），通过模板+参考+门禁三层联动实现可机械核验。

### 1.3 非目标

- 不合并阶段 2/3/4（阶段 2 只产系统级，不落接口/类级；阶段 3 只产接口级；阶段 4 只产类/数据级）
- 不引入新机制（复用现有 mermaid/BDD/TLA+/RTM/图谱基础设施）
- 不重写完整工程宪法（与 SKILL.md 重复，仅收各阶段 DoD 可勾选清单 + 阶段纪律）
- 不替代 bdd-guide.md 的 .feature 文件头规范（互补不重复）
- 不纳入 DESIGN.md 全部 25 章（按阶段边界吸收子集，见 §9 对应关系总表）

---

## 2. 现状对照

| DESIGN.md 机制 | Phase 2 现状 | Phase 3 现状 | Phase 4 现状 | 增强动作 |
|---|---|---|---|---|
| 文档头 SSOT 声明 + 版本 + 自身校验 | 无（仅文档信息表） | 无 | 无 | 各主模板新增 §0 |
| §5 顶层架构（组件图/子系统清单/系统树/ADR） | 仅架构图 + 风格说明 | — | — | 独立文件 `<module>-system-architecture.md` |
| §3 核心概念与术语 | 无 | 无 | 无 | 各阶段独立 `<module>-glossary.md` |
| §2.1.1 追踪矩阵 | 无（仅 RTM 登记） | 无 | 无 | 各阶段独立 `<module>-traceability-matrix.md`（SD×需求 / INTF×SD / DD×INTF） |
| §7 行为规格模型 | 无（L2 features 散落 bdd-guide） | 无（L3） | 无（L4） | 各阶段独立 `<module>-behavior-spec.md`（仅引用 .feature 关系） |
| §2.4.6 DoD | 无 | 无 | 无 | 各阶段独立 `<module>-discipline-dod.md` |
| 附录 A UML 图集 | 内嵌架构图 | 内嵌调用关系图 | 内嵌类图/ER 图 | 各阶段独立 `<module>-uml-modeling.md`（按阶段吸收对应图种） |
| 内联 feature 集附录 | 无 | 无 | 无 | 不新增（bdd 承接，与第 37 轮一致） |

---

## 3. 方案 A 详细设计

### 3.0 总架构与交付节奏

沿用第 37 轮三层联动模式（模板层 / 参考层 / 门禁层）+ 同步层，为三个阶段各部署一套。每小轮独立可验证（self-test/vitest/tsc/版本号三处一致），全部完成后统一 SSoT 记录。

| 小轮 | 阶段 | 版本号 | 主模板 | 6 独立子模板目录 |
|---|---|---|---|---|
| A | Phase 2 系统设计 | 38.0.0 | `templates/system-design.md` | `templates/system-design/` |
| B | Phase 3 概要设计 | 38.1.0 | `templates/interface-design.md` | `templates/interface-design/` |
| C | Phase 4 详细设计 | 38.2.0 | `templates/detailed-design.md` | `templates/detailed-design/` |

**阶段边界红线**（用户强调的核心）：
- Phase 2 只产系统级（架构/子系统/部署/行为总览/运行时架构），不落接口契约/类定义
- Phase 3 只产接口级（模块接口契约/调用关系/错误码），不落类/方法
- Phase 4 只产类/数据级（类/方法/表结构/索引），不回溯重定义接口
- 依赖方向单向：Phase 3 引用 Phase 2 产物、Phase 4 引用 Phase 3 产物；跨阶段变更须回上游返工（沿用 phase-4「不得在详细设计阶段变更 store 选择」既有约束）

---

### 3.1 小轮 A：Phase 2 系统设计（38.0.0）

#### 3.1.1 模板层：主模板 system-design.md 重构

**节号保留约束**：`tla-spec-template.md` 以 `docs/phase2-design/{module}-system-design.md:§3.2` 为 @design 示例，`tla-plus-guide.md` 引用 `§3.3`。**主模板既有节号必须保留**（§1 系统架构 / §2 技术选型 / §3 模块划分 / §4 部署架构 / §5 系统测试用例索引），新增引用块节追加为 §6+ 与附录 A，门禁按引用块文件名校验（`[name](./xxx.md)`），不依赖节号。

重构后结构：

```markdown
# 系统设计文档

> **模板版本**：v2.0（第 38 轮设计级别增强：§0 SSOT 头 + 6 独立产物文件引用块）
> 套用本模板时，引用块指向同目录独立文件，独立文件套用
> `templates/system-design/` 下对应子模板。产出物见
> `references/phase-2-system-design.md` §执行方法论。

## 文档信息
> 项目名称 / 版本 / 日期 / 编制者 / 关联需求文档（保留原有字段）

## 0. 文档定位与 SSOT 头
> **文档版本**：v{{1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本系统设计文档为阶段 2（系统设计）的唯一设计事实来源。设计变更须经
>   阶段门评审 / 上游需求变更回流，不得无痕修改。
> **自身校验**：本文档以结构完整性为准——引用块指向的独立文件存在、
>   `<module>-system-architecture.md` 子系统清单与主模板 §3 模块划分一一对应、
>   `<module>-traceability-matrix.md` 字段与主模板 §3 模块划分一致、
>   `<module>-uml-modeling.md` mermaid 块配平。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在非目标显式标注中。
> **与需求规格关系**：本文档承接阶段 1《需求规格说明书》（外部实体/边界见
>   phase1-requirements 的 system-context.md），系统内部架构由本文档承载；
>   接口/类级设计事实由阶段 3/4 产出的设计文档承载，不在本文档描述。
> **行为规格承接**：L2 行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），
>   本文档 §8 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

## 1. 系统架构
> 系统架构详见 [{{module}}-system-architecture.md](./{{module}}-system-architecture.md)
> （组件图 / 子系统清单 / 系统树 / 架构原则 / ADR / 系统行为总览 / 运行时架构）。
> 本节约保留架构风格说明与架构图骨架（mermaid），详述见独立文件。

## 2. 技术选型
> （保留原 §2 内容：技术选型决策矩阵 5 维度评分 + 选型理由，禁止无依据选型）

## 3. 模块划分
> （保留原 §3 内容：模块 ID / 模块名 / 职责 / 关联需求；模块 ID 编号与
>   system-architecture.md 子系统清单一致）

## 4. 部署架构
> （保留原 §4 内容：部署图 / 环境说明）

## 5. 系统测试用例索引
> （保留原 §5 内容：ST-NNN 索引，详细用例见系统测试用例文档）

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
> （新增：系统级非目标 / 不保证项 / 明确不覆盖范围，对应 DESIGN.md §2.2/§24；
>   与需求规格 §8 Out of Scope 区分：此处为设计实现层非目标）

## 附录 A. UML 系统级建模
> UML 系统级建模详见 [{{module}}-uml-modeling.md](./{{module}}-uml-modeling.md)
> （部署图 / 顶层组件图 / 包图 / 用例图，mermaid）。
```

#### 3.1.2 6 独立子模板内容规范

**system-architecture.md**（对应 DESIGN.md §5/§8/§9；产物 `<module>-system-architecture.md`）
- §1 顶层组件图（mermaid，体现分层 + 组件间依赖 + 数据流）
- §2 规范性子系统清单（子系统 ID / 名称 / 职责 / 涉及模块 ID，与主模板 §3 模块划分对应）
- §3 系统树（子系统层级）
- §4 架构原则（对应 DESIGN.md §5.4）
- §5 架构决策记录 ADR（对应 DESIGN.md §5.5：决策 + 上下文 + 后果）
- §6 系统行为总览（对应 DESIGN.md §8：对外/对内行为 + 关键分叉）
- §7 运行时架构（对应 DESIGN.md §9：运行时组件 + 核心对象概念级）
- 强制：子系统清单 ID 与主模板 §3 模块划分一致（R9 门禁校验；不对应 → FM-SD-05 追踪矩阵不一致链，回步骤 3）

**glossary.md**（对应 DESIGN.md §3；产物 `<module>-glossary.md`）
- 系统设计域术语子集（架构/子系统/部署/ADT 等）
- 引用 `references/glossary.md` 权威表，不重复定义全量术语
- 强制：每条术语有定义 + 来源引用

**traceability-matrix.md**（对应 DESIGN.md §2.1.1；产物 `<module>-traceability-matrix.md`）
- §1 SD×需求 8 字段表（SD 编号/对应需求号/优先级/设计落点§/涉及子系统/实现状态/验收关联/逐条验收判据；Phase 2 适配：设计落点§ 指向主模板 §3 模块划分模块 ID）
- §2 需求×测试层级承接矩阵（单元/集成列 pending 由阶段 3/4 回填，系统/验收列填实）
- 强制：字段与主模板 §3 模块划分 / phase1 追踪矩阵一致（R9 门禁校验）

**behavior-spec.md**（对应 DESIGN.md §7；产物 `<module>-behavior-spec.md`）
- §1 L2 行为规格角色（系统级行为可被 Given/When/Then 验收）
- §2 与 .feature 文件的引用关系（SD → L2 feature 文件清单 + bdd-manifest 登记）
- §3 与系统设计文档的关系（行为规格不替代架构描述）
- **不含**文档级元信息头规范（.feature 头由 bdd-guide.md §2 管）
- 强制：列出本模块对应 L2 .feature 文件清单

**discipline-dod.md**（对应 DESIGN.md §2.4.6；产物 `<module>-discipline-dod.md`）
- §1 Phase 2 阶段纪律（最小子集：设计事实 SSOT / 架构图非纯文字 / 选型 5 维度评分 / 不越界落接口类级）
- §2 DoD 可勾选清单（≥8 项，对应 DESIGN.md §2.4.6 九项收敛）
- 强制：DoD 清单 `- [ ]` 项 ≥ 8 条

**uml-modeling.md**（对应 DESIGN.md 附录 A 系统级子集；产物 `<module>-uml-modeling.md`）
- A.1 部署图（节点 + 进程 + 数据流，mermaid）
- A.2 顶层组件图（分层 + 组件依赖 + 数据流）
- A.3 包图（模块/包依赖）
- A.4 系统级用例图（参与者 = 需求规格 stakeholder，用例 = level≥2 REQ）
- 强制：四图均用 mermaid，块首尾定界行配平；与主模板 §1/§3 对应（R10 门禁校验）

#### 3.1.3 参考层：phase-2-system-design.md 扩展

**算法新增编号步骤**（当前无步骤结构，新增「系统设计算法」节）：

```text
  1. 系统架构建模
     ├─ 基于需求规格，产出 <module>-system-architecture.md（顶层组件图 + 子系统清单 + 系统树）
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
     ├─ 承接 phase1 system-context.md 外部边界，产出 <module>-glossary.md（系统设计域术语子集）
     ├─ 主模板 §6 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. UML 系统级建模（第 38 轮新增）
     ├─ 产出 <module>-uml-modeling.md（部署图/顶层组件图/包图/用例图）
     ├─ 主模板附录 A 引用块指向 uml-modeling.md
     ├─ 失败: 图与主模板 §1/§3 不对应 → 回步骤 5 对齐（FM-SD-04）
     └─ 成功: 四图产出，mermaid 块配平
  6. 追踪矩阵与行为规格引用（第 38 轮新增）
     ├─ 产出 <module>-traceability-matrix.md（SD×需求 8 字段 + 测试层级矩阵）
     ├─ 产出 <module>-behavior-spec.md（L2 .feature 引用关系）
     ├─ 主模板 §7/§8 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/3 不一致 → 回步骤 6 对齐（FM-SD-05）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  7. Phase 2 工程纪律与 DoD（第 38 轮新增）
     ├─ 产出 <module>-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §9 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立
```

**执行方法论表新增产出物**：

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 系统架构 | 套用 `templates/system-design/system-architecture.md` | `docs/phase2-design/{module}-system-architecture.md` |
| 术语表 | 套用 `templates/system-design/glossary.md` | `docs/phase2-design/{module}-glossary.md` |
| UML 系统级建模 | 套用 `templates/system-design/uml-modeling.md`，mermaid 四图 | `docs/phase2-design/{module}-uml-modeling.md` |
| 系统设计追踪矩阵 | 套用 `templates/system-design/traceability-matrix.md` | `docs/phase2-design/{module}-traceability-matrix.md` |
| 行为规格模型（L2） | 套用 `templates/system-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase2-design/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/system-design/discipline-dod.md` | `docs/phase2-design/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/system-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase2-design/{module}-system-design.md` |

**新增失败模式**（FM-SD 编号体系，机制专属前缀对齐 FM-3D/FM-EXEMPT 风格）：

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-SD-01 | 架构图缺数据流标注 | system-architecture.md 组件图无 `-.->`/`>>` 数据流箭头 | 回步骤 1 补全数据流向 |
| FM-SD-02 | 选型无评分依据 / ADR 缺上下文后果 | 技术选型表无 5 维度评分；ADR 缺 context/consequences | 回步骤 2 补全评分与 ADR 结构 |
| FM-SD-03 | 模块循环依赖 | 模块划分 DFS 三色染色检测到环 | 回步骤 3 重新划分边界 |
| FM-SD-04 | UML 建模与架构/模块划分脱节 | uml-modeling.md 图与主模板 §1/§3 不对应 | 回步骤 5 对齐 UML 建模 |
| FM-SD-05 | 追踪矩阵字段不一致 | traceability-matrix.md 与主模板 §3/phase1 追踪矩阵不一致 | 回步骤 6 对齐追踪矩阵字段 |

**新增禁止行为**（Phase 2 现有 #1-5，追加 #6/#7/#8）：

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 6 | 追踪矩阵字段与主模板 §3 模块划分 / phase1 追踪矩阵不一致 | 步骤 6 须对齐 traceability-matrix.md（FM-SD-05） |
| 7 | UML 图表与架构/模块划分脱节 | uml-modeling.md 四图须对应主模板 §1/§3（FM-SD-04） |
| 8 | 越过阶段边界落接口契约/类定义 | 接口/类级设计属阶段 3/4，本阶段只产系统级（FM-SD-06 禁止越界） |

> 注：FM-SD-06 为越界检测信号（见返工路径），不单列为失败模式行。

**返工路径补充**：
- 架构图缺数据流（FM-SD-01）→ 回步骤 1 补全
- 选型无依据（FM-SD-02）→ 回步骤 2 补全评分/ADR
- 循环依赖（FM-SD-03）→ 回步骤 3 重新划分
- UML 脱节（FM-SD-04）→ 回步骤 5 对齐
- 追踪矩阵不一致（FM-SD-05）→ 回步骤 6 对齐
- 越界落接口/类级（FM-SD-06）→ 移除越界内容，移交阶段 3/4

**验收标准补充** 4 条：
- [ ] `{module}-system-architecture.md` + `{module}-glossary.md` 已产出，主模板 §1/§6 引用块成立
- [ ] `{module}-traceability-matrix.md`（SD×需求 + 测试层级矩阵）与主模板 §3/phase1 矩阵一致，主模板 §7 引用块成立
- [ ] `{module}-uml-modeling.md` 四图与主模板 §1/§3 对应、mermaid 块配平，主模板附录 A 引用块成立
- [ ] `{module}-behavior-spec.md` + `{module}-discipline-dod.md` 已产出，主模板 §8/§9 引用块成立

#### 3.1.4 门禁层：脚本扩展

**check-requirement-graph.ts 扩展**（延续 R7/R8 模式，规则编号连续）：

- **R9 Phase 2 系统设计追踪矩阵一致性**：读 `<module>-traceability-matrix.md` §1 表，校验 SD 编号与主模板 §3 模块划分对应、测试层级矩阵系统/验收列填实
- **R10 Phase 2 UML mermaid 块配平**：读 `<module>-uml-modeling.md`，校验 mermaid 块首尾定界行一一配对

> 实现方式：复用 `graph-logic.ts` 纯逻辑层模式（parseMarkdownTable / countMermaidBlocks / extractRefTargets 已具备），新增 `checkDesignSpecEnhance(phase, ...)`；CLI 以 `--spec-dir=<docs/phase2-design>` 传入目录。
>
> **module 前缀匹配**（与 Phase 1 无前缀命名差异点）：Phase 2 产物带 `{module}-` 前缀（directory-conventions §1），CLI 在 spec-dir 内以 glob `*-system-design.md`（主文档）/ `*-traceability-matrix.md` / `*-uml-modeling.md` 匹配——每类恰 1 个文件，多/零个均报错（exit 2）；主文档文件名取 `{module}` 前缀用于引用块存在性校验（主文档 §1/§6/§7/§8/§9/附录 A 引用块指向的 6 文件 = `{module}-{sub}.md` 与目录内实际文件比对）；samples 新增 R9/R10 各 1 valid + 1 bad（4 条）。

**check-artifact-gate.ts --phase=2 扩展**：
- **引用块完整性校验**：主文档 `<module>-system-design.md` §1/§6/§7/§8/§9/附录 A 引用块指向的 6 个独立文件均存在
- **§0 SSOT 头校验**：主文档须含「文档版本」「SSOT 声明」「自身校验」「禁止占位词」四项声明
- **DoD 清单校验**：`<module>-discipline-dod.md` 须含 `- [ ]` 项 ≥ 8 条

> 实现方式：`gate-logic.ts` 第 37 轮 `checkRequirementSpecStructure()` 泛化为 `checkPhaseSpecStructure(phase, specDir, fs)`（phase 决定 6 文件清单与主文档文件名），phase=2 时调用；samples 新增 valid + bad-refs-missing + bad-ssot-header + bad-dod-incomplete。

**self-test 基线**：225 → 233（+3 graph R9/R10 样本 + 4 gate 结构校验样本 + 1 计数）。

**vitest 单测**：`graph-logic.test.ts` 新增 R9/R10 测试；`gate-enhancement.test.ts` 新增 phase=2 结构校验测试。

---

### 3.2 小轮 B：Phase 3 概要设计（38.1.0）设计要点

> 本小轮在 A 完成后按同一模式执行，此处给出设计要点，执行前细化。

**主模板 `templates/interface-design.md` 重构**：§0 SSOT 头 + 保留接口契约/错误码分层/调用关系图/路由注册顺序约束/集成测试索引（既有节号保留）+ 引用块指向 6 独立文件。

**6 独立子模板**（`templates/interface-design/` 目录）：

| 子模板 | 产物文件 | 对应 DESIGN.md | 阶段边界 |
|---|---|---|---|
| `interface-contract.md` | `{module}-interface-contract.md` | §13.5/§13.7 接口契约 + 错误码分层 + 调用关系 | 模块接口级，不落类/方法 |
| `glossary.md` | `{module}-glossary.md` | §3 术语 | 接口域术语子集 |
| `traceability-matrix.md` | `{module}-traceability-matrix.md` | §2.1.1 | INTF×SD 8 字段 + 测试层级矩阵（集成/验收列填实） |
| `behavior-spec.md` | `{module}-behavior-spec.md` | §7 | 仅 L3 .feature 引用关系 |
| `discipline-dod.md` | `{module}-discipline-dod.md` | §2.4.6 | 阶段 3 收敛子集 |
| `uml-modeling.md` | `{module}-uml-modeling.md` | 附录 A 模块级 | 包图/序列图/通信图 |

**门禁**：check-requirement-graph 新增 R11（INTF 追踪矩阵一致性）/ R12（UML 配平）；check-artifact-gate --phase=3 结构校验；self-test 233→241。

---

### 3.3 小轮 C：Phase 4 详细设计（38.2.0）设计要点

**主模板 `templates/detailed-design.md` 重构**：§0 SSOT 头 + 保留类设计/数据库设计/单元测试索引（既有节号保留）+ 引用块指向 6 独立文件。

**6 独立子模板**（`templates/detailed-design/` 目录）：

| 子模板 | 产物文件 | 对应 DESIGN.md | 阶段边界 |
|---|---|---|---|
| `class-design.md` | `{module}-class-design.md` | §9.2 运行时核心对象 + A.4 类图 + A.10 状态机（类级） | 类/方法级，不回溯接口定义 |
| `data-model.md` | `{module}-data-model.md` | A.5 ER 图 + §21.5 store 物理层 | 表结构/字段/索引/关系 |
| `glossary.md` | `{module}-glossary.md` | §3 术语 | 详细设计域术语子集 |
| `traceability-matrix.md` | `{module}-traceability-matrix.md` | §2.1.1 | DD×INTF 8 字段 + 测试层级矩阵（单元/验收列填实） |
| `behavior-spec.md` | `{module}-behavior-spec.md` | §7 | 仅 L4 .feature 引用关系 |
| `discipline-dod.md` | `{module}-discipline-dod.md` | §2.4.6 | 阶段 4 收敛子集 |

**门禁**：check-requirement-graph 新增 R13（DD 追踪矩阵一致性）/ R14（UML 配平）；check-artifact-gate --phase=4 结构校验；self-test 241→249。

---

### 3.4 同步层（每小轮各自执行）

- `references/verifier-spec.md`：completeness 维度各阶段新增结构评审项（6 独立文件完整性 + 引用块成立 + SSOT 头 + DoD 清单 + 追踪矩阵一致性）
- `w-model-dev/SKILL.md`：阶段路由表对应行 + 快速自检清单 + 版本号
- `w-model-dev/skill-metadata.json` + `package.json`：版本号镜像
- `docs/skill-design-document_SSoT.md`：§3.4.xx 新增条目 + §10A 追溯表
- `AGENTS.md` §1：新增轮次条目
- `CHANGELOG.md`：[38.0.0]/[38.1.0]/[38.2.0] 条目
- `README.md`：能力 bullet（如有）

---

## 4. 与现有约束/资产的关系

| 现有约束/资产 | 关系 | 说明 |
|---|---|---|
| 约束 #9 TLA+ 行为门禁 | 不冲突 | 本增强不改 TLA+ 本身，L2/L3/L4 .tla 文件仍独立承载 |
| 约束 #14 BDD 行为门禁 | 不冲突 | 行为规格由 .feature 文件承载，`<module>-behavior-spec.md` 仅定义引用关系 |
| 约束 #11 层级树+图谱 | 不冲突 | 各阶段追踪矩阵与图谱互补，RTM 仍为跨阶段事实源 |
| 约束 #15 REQ level / 不向后兼容 | 保留 | 设计模板重构不向后兼容，老产物重新生成 |
| 约束 #18 RTM 回填 | 不冲突 | 各阶段追踪矩阵是设计级追踪，RTM 是跨阶段事实源 |
| 约束 #19 角色分派 | 不冲突 | S/V/G 角色与产物关系不变 |
| directory-conventions.md §1 | 遵循 | Phase 2/3/4 产物带 `{module}-` 前缀，位于 `docs/phase2-design/` 等阶段子目录 |
| tla-spec-template.md / tla-plus-guide.md | 兼容 | 主模板既有节号保留（§3 模块划分等），跨引用不破坏 |
| bdd-guide.md | 引用 | `<module>-behavior-spec.md` 引用 bdd-guide.md §2 头规范 |
| glossary.md（references） | 引用 | `<module>-glossary.md` 引用权威表 |
| definition-of-done.md | 引用 | `<module>-discipline-dod.md` 引用项目级 DoD |

---

## 5. 一致性影响清单（小轮 A：Phase 2）

须同步修改的文件（按串行子代理顺序）：

1. `w-model-dev/templates/system-design.md` — 主模板重构（§0 SSOT 头 + 引用块）
2. `w-model-dev/templates/system-design/system-architecture.md` — 新增
3. `w-model-dev/templates/system-design/glossary.md` — 新增
4. `w-model-dev/templates/system-design/traceability-matrix.md` — 新增
5. `w-model-dev/templates/system-design/behavior-spec.md` — 新增
6. `w-model-dev/templates/system-design/discipline-dod.md` — 新增
7. `w-model-dev/templates/system-design/uml-modeling.md` — 新增
8. `w-model-dev/references/phase-2-system-design.md` — 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 + 验收标准 + 执行方法论表
9. `w-model-dev/scripts/logic/graph-logic.ts` + `check-requirement-graph.ts` — 新增 R9/R10
10. `w-model-dev/scripts/logic/gate-logic.ts` + `check-artifact-gate.ts` — phase=2 结构校验
11. `w-model-dev/scripts/__tests__/graph-logic.test.ts` — R9/R10 单测
12. `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` — phase=2 结构校验单测
13. `w-model-dev/scripts/samples/` — 新增样本（8 条）
14. `w-model-dev/scripts/cli/self-test.ts` — 基线 225→233
15. `w-model-dev/references/verifier-spec.md` — V 评审新增项
16. `w-model-dev/SKILL.md` — 阶段路由表 Phase 2 行 + 快速自检清单 + 版本号 37.0.0→38.0.0
17. `w-model-dev/skill-metadata.json` — 版本号镜像
18. `package.json` — 版本号 37.0.0→38.0.0
19. `docs/skill-design-document_SSoT.md` — §3.4.xx 条目 + §10A 追溯表
20. `AGENTS.md` — §1 第 38 轮条目
21. `CHANGELOG.md` — [38.0.0] 条目
22. `README.md` — 能力 bullet（如有）

---

## 6. 验收标准（小轮 A：Phase 2）

- [ ] 主模板 `system-design.md` + 6 独立子模板（system-architecture/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）重构完成
- [ ] `phase-2-system-design.md` 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8
- [ ] `check-requirement-graph.ts` 新增 R9/R10，退出码 0/1/2 强一致
- [ ] `check-artifact-gate.ts --phase=2` 新增引用块完整性/SSOT/DoD 校验
- [ ] self-test 基线 225→233 全通过
- [ ] vitest 全通过（含 R9/R10 + phase=2 结构校验单测）
- [ ] TypeScript strict 0 错误
- [ ] pre-push 门禁全通过
- [ ] 与 bdd-guide.md / glossary.md / verifier-spec.md / SKILL.md / directory-conventions.md 一致性核验通过
- [ ] 版本号三处一致 38.0.0
- [ ] 主模板既有节号保留（§1-§5），tla-spec-template.md 跨引用不破坏

---

## 7. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| 改动面大（22 文件/小轮） | 中 | 串行子代理分批，每批父代理回归通过后再改下一批（用户偏好：禁止并行修改） |
| 主模板节号被跨引用（tla-spec-template.md:§3.2） | 中 | 既有节号保留，新增引用块追加为 §6+，门禁按文件名校验不依赖节号 |
| 老 demo 不兼容新模板 | 低 | 不向后兼容声明，重新生成（对齐约束 #15 风格） |
| 引用块断裂（独立文件缺失/路径错） | 中 | check-artifact-gate --phase=2 引用块完整性校验强制 6 文件存在 |
| UML mermaid 块配平校验误报 | 低 | R10 校验代码块定界行严格匹配，samples 覆盖正常+嵌套+未配平场景 |
| 阶段越界吸收（Phase 2 落接口/类级） | 中 | 禁止行为 #8 + FM-SD-06 + 各子模板头部阶段边界标注；V 评审 completeness 校验 |
| 追踪矩阵与 RTM 双重维护负担 | 低 | 各阶段追踪矩阵是设计级追踪（阶段内冻结），RTM 是跨阶段事实源；矩阵 pending 列由后续阶段回填 RTM 时同步 |

---

## 8. 实施顺序（串行子代理，小轮 A 先行）

按用户偏好（串行子代理、禁止并行修改文档），小轮 A（Phase 2）分 4 批：

1. **批 1（模板层）**：重构主模板 `system-design.md` + 新增 6 独立子模板 → 父代理回归（§0 四项声明齐全 + 6 引用块成立 + 6 子模板内容规范齐全 + 既有节号保留）
2. **批 2（参考层）**：扩展 `phase-2-system-design.md` → 父代理回归（算法步骤 1-7 / FM-SD-01~05 / 禁止行为 #6/#7/#8 / 返工路径 / 验收标准一致性）
3. **批 3（门禁层）**：`graph-logic.ts`/`check-requirement-graph.ts` R9/R10 + `gate-logic.ts`/`check-artifact-gate.ts` phase=2 结构校验 + samples + self-test + vitest → 父代理回归（self-test 233 全通过 + vitest 全通过）
4. **批 4（同步层）**：`verifier-spec.md`/`SKILL.md`/`skill-metadata.json`/`package.json`/SSoT/AGENTS.md/CHANGELOG.md/README.md → 父代理回归（版本号三处一致 + 引用可达 + 术语一致）

每批完成后父代理跑结构一致性核对（grep 配平/引用可达/术语一致），通过后进入下一批。小轮 B/C 在 A 完成后依次执行。

---

## 9. 与 DESIGN.md 的对应关系总表

| DESIGN.md 机制 | Phase 2 增强落点 | Phase 3 增强落点 | Phase 4 增强落点 | 阶段边界处理 |
|---|---|---|---|---|
| §1 文档定位 + 文档头 SSOT | 主模板 §0 | 主模板 §0 | 主模板 §0 | 各阶段域 SSOT |
| §5 顶层架构 | 独立 `<module>-system-architecture.md` | — | — | 仅系统级 |
| §13.5/§13.7 接口契约 | — | 独立 `<module>-interface-contract.md` | — | 仅模块接口级 |
| §9.2 运行时核心对象 + A.4 类图 | — | — | 独立 `<module>-class-design.md` | 仅类/方法级 |
| A.5 ER 图 + §21.5 store | — | — | 独立 `<module>-data-model.md` | 仅数据模型级 |
| §2.1.1 追踪矩阵 | 独立 `<module>-traceability-matrix.md`（SD×需求） | 独立（INTF×SD） | 独立（DD×INTF） | 各阶段只填本阶段测试列 |
| §2.4.6 DoD | 独立 `<module>-discipline-dod.md` | 独立 | 独立 | 各阶段收敛子集（≥8 项） |
| §3 核心概念与术语 | 独立 `<module>-glossary.md` | 独立 | 独立 | 各阶段术语子集 |
| §7 行为规格模型 | 独立 `<module>-behavior-spec.md`（L2 引用） | 独立（L3 引用） | 独立（L4 引用） | 仅定义引用关系，不内联 |
| 附录 A UML 图集 | 部署图/组件图/包图/用例图 | 包图/序列图/通信图 | 类图/ER/状态机/序列图（经 class/data 文件内嵌） | 按阶段吸收对应图种 |
| A.12 内联 feature 集 | 不新增 | 不新增 | 不新增 | bdd 承接（与第 37 轮一致） |

---

## 10. 决策记录

- **方案选择**：方案 A（全要素对齐）——用户要求"至少达到如此级别"，且第 37 轮已验证三层联动模式可行
- **交付节奏**：分三小轮（38.0.0/38.1.0/38.2.0），每小轮独立可验证（用户确认）
- **独立文件拆分**：每阶段 6 项增强内容拆为独立产出模板 + 独立产物文件，主模板引用块串联（对齐第 37 轮）
- **门禁落点**：R9/R10（Phase 2）进 `check-requirement-graph.ts`，结构校验进 `check-artifact-gate.ts --phase=2`（与第 37 轮 R7/R8 对称，规则编号连续）
- **FM 编号体系**：Phase 2 用 FM-SD-01~05（机制专属前缀，对齐 FM-3D/FM-EXEMPT 风格），Phase 3/4 执行时各自建立
- **主模板节号保留**：既有 §1-§5 不动（tla-spec-template.md/tla-plus-guide.md 跨引用），新增引用块追加为 §6+ 与附录 A
- **越界治理**：禁止行为 #8 + FM-SD-06 显式拦截阶段越界吸收，各子模板头部标注阶段边界
- **不向后兼容**：老模板产出重新生成（对齐约束 #15 风格）
