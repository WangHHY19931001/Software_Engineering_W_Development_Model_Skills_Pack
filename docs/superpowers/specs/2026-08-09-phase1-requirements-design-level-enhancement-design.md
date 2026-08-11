# Phase 1 需求分析产出达到设计文档级别 — 设计 spec

> **创建日期**：2026-08-09
> **状态**：待用户复审
> **范围**：W 模型技能包阶段 1（需求分析）产出结构增强
> **方案**：方案 A（全要素对齐，模板+参考+门禁三层联动）
> **不向后兼容声明**：`requirement-spec.md` 模板重构，老模板产出须重新生成（对齐约束 #15「不向后兼容老图谱」处理风格）

---

## 1. 背景与目标

### 1.1 背景

参照对象 `DESIGN.md`（Shell Agent 设计文档，v1.15.0，717KB）具备以下结构严谨性机制：

- 文档定位与 SSOT 头（版本/修订机制/自身校验/不依赖外部审查声明）
- 需求条目化追踪矩阵（REQ/NFR 8 字段表 + 需求×测试层级承接矩阵）
- 核心概念与术语表
- 系统上下文图与边界原则
- 行为规格模型（feature 头元信息规范 + 内联 feature 集，由 bdd 承接）
- 工程纪律与 DoD 可勾选清单
- UML 2.0 系统建模图表集附录
- 内联 BDD feature 集附录（带文档级元信息头）——本增强**移除此项**，由 bdd `.feature` 文件 + `bdd-manifest.json` 承接

当前 Phase 1 资产（`requirement-spec.md` 模板 12 节 + `phase-1-requirements.md` 参考 6 步算法 + FM-3D/4D/EXEMPT + 12 条禁止行为）已具备四维识别、迷雾登记册、豁免审批等机制，但相对 DESIGN.md 缺少：SSOT 头/版本/自身校验、系统上下文、术语表、REQ 追踪矩阵（8 字段+测试层级矩阵）、行为规格模型定义、工程纪律/DoD、UML 附录、内联 feature 集。

### 1.2 目标

把 Phase 1 需求规格产出提升到 DESIGN.md 级别的结构严谨性，严守需求域边界（不侵入 Phase 2 系统设计），通过模板+参考+门禁三层联动实现可机械核验。

### 1.3 非目标

- 不合并 Phase 1+2（不产架构/运行时/子系统内部设计）
- 不引入新机制（复用现有 mermaid/BDD/TLA+/RTM/图谱基础设施）
- 不重写完整工程宪法（与 SKILL.md 重复，仅收 DoD 可勾选清单+需求阶段纪律）
- 不替代 bdd-guide.md 的 .feature 文件头规范（互补不重复）
- 不纳入 UML 序列图/状态机图（已由 TLA+/BDD 覆盖）

---

## 2. 现状对照

| DESIGN.md 机制 | 当前 Phase 1 状态 | 增强动作 |
|---|---|---|
| 文档头 SSOT 声明 + 版本 + 自身校验 | 无 | 主模板新增 §0 |
| 系统上下文（外部实体 + 边界原则） | 仅 §1.3 范围文字 | 独立文件 `<module>-system-context.md`（主模板 §3 引用块） |
| 核心概念与术语表 | 无（散落 glossary.md） | 独立文件 `<module>-glossary.md`（主模板 §4 引用块，需求域术语子集） |
| 需求追踪矩阵（8 字段 + 测试层级矩阵） | 仅 §12 RTM 登记表 | 独立文件 `<module>-traceability-matrix.md`（主模板 §10 引用块） |
| 行为规格模型定义 | 散落 bdd-guide.md | 独立文件 `<module>-behavior-spec.md`（主模板 §12 引用块，仅定义引用 .feature 关系） |
| 工程纪律与 DoD 可勾选清单 | 散落 SKILL.md/DoD | 独立文件 `<module>-discipline-dod.md`（主模板 §16 引用块，Phase 1 收敛子集） |
| UML 附录 | 无 | 独立文件 `<module>-uml-modeling.md`（主模板附录 A 引用块，用例图+领域类图+活动图） |
| 内联 feature 集附录 | 无 | **移除**（bdd 已有 .feature 文件 + bdd-manifest.json 承接，不重复内联） |

---

## 3. 方案 A 详细设计

### 3.1 模板层：主模板 + 6 独立子模板（引用块串联）

> **结构原则**：6 项增强内容（系统上下文/术语表/追踪矩阵/行为规格模型/工程纪律 DoD/UML 建模）拆为**独立产出模板 + 独立产物文件**，主模板 `requirement-spec.md` 保留骨架并用引用块串联（对齐 SKILL.md 引用 references/phase-N-*.md 的既有模式）。
> **移除**：附录 B 内联 feature 集——bdd 已有 `.feature` 文件 + `bdd-manifest.json` 承接，不在需求规格内重复内联。
> 模板顶部新增「第 37 轮设计级别增强」标注，与既有「第 20 轮四维识别」「第 27 轮迷雾登记册」标注风格一致。

#### 3.1.1 文件结构

```
w-model-dev/templates/
├── requirement-spec.md                      # 主模板（骨架 + 引用块）
└── requirement-spec/                        # 独立子模板目录
    ├── system-context.md                    # §3 系统上下文模板
    ├── glossary.md                          # §4 术语表模板
    ├── traceability-matrix.md               # §10 需求追踪矩阵模板
    ├── behavior-spec.md                     # §12 行为规格模型模板
    ├── discipline-dod.md                    # §16 工程纪律与 DoD 模板
    └── uml-modeling.md                      # 附录 A UML 需求建模模板
```

产出物（按模块命名，与主规格同目录）：

```
docs/<module>/
├── <module>-requirement-spec.md             # 主规格（骨架 + 引用块）
├── <module>-system-context.md               # 系统上下文产物
├── <module>-glossary.md                     # 术语表产物
├── <module>-traceability-matrix.md          # 追踪矩阵产物
├── <module>-behavior-spec.md                # 行为规格模型产物
├── <module>-discipline-dod.md               # 工程纪律与 DoD 产物
└── <module>-uml-modeling.md                 # UML 建模产物
```

#### 3.1.2 主模板节结构与引用块

| 主模板节 | 来源 | 内容/引用 | 对应 DESIGN.md 机制 |
|---|---|---|---|
| §0 | 新增 | 文档定位与 SSOT 头（版本/修订机制/自身校验声明/禁止占位词/与设计文档关系） | §1 + 文档头 |
| §1 | 保留 | 文档信息（项目名称/版本/日期/编制者） | — |
| §2 | 保留（原 §1） | 问题陈述与背景（§2.1 背景/§2.2 目标/§2.3 范围） | — |
| §3 | 新增（引用块） | `> 系统上下文详见 [<module>-system-context.md](./<module>-system-context.md)` | §4 |
| §4 | 新增（引用块） | `> 术语表详见 [<module>-glossary.md](./<module>-glossary.md)` | §3 |
| §5 | 保留（原 §3） | User Stories（覆盖正常/异常/边界/NFR/CON 全场景） | — |
| §6 | 保留（原 §4） | 需求层级树【维度1】（level/priority/reqGroup/parent 强制） | — |
| §7 | 保留（原 §5） | 候选子系统划分（REQ-group）【维度2】 | — |
| §8 | 保留（原 §6） | 需求交叉逻辑矩阵【维度3】 | — |
| §9 | 保留（原 §7） | 需求覆盖分析【维度4】 | — |
| §10 | 新增（引用块） | `> 需求追踪矩阵详见 [<module>-traceability-matrix.md](./<module>-traceability-matrix.md)` | §2.1.1 |
| §11 | 保留（原 §8） | Out of Scope | — |
| §11.5 | 保留（原 §8.5） | Not yet specified（迷雾登记册） | — |
| §12 | 新增（引用块） | `> 行为规格模型详见 [<module>-behavior-spec.md](./<module>-behavior-spec.md)` | §7 |
| §13 | 保留（原 §9） | Implementation Decisions | — |
| §14 | 保留（原 §10） | Testing Decisions | — |
| §15 | 保留（原 §11） | 风险与缓解 | — |
| §16 | 新增（引用块） | `> Phase 1 工程纪律与 DoD 详见 [<module>-discipline-dod.md](./<module>-discipline-dod.md)` | §2.4.6 |
| §17 | 保留（原 §12） | RTM 登记（含 NFR/CON 横切治理字段 + NFR 性能基线双字段） | — |
| 附录 A | 新增（引用块） | `> UML 需求建模详见 [<module>-uml-modeling.md](./<module>-uml-modeling.md)` | 附录 A |

> 注：附录 B 内联 feature 集**移除**——bdd 已有 `.feature` 文件（由 bdd-guide.md §2 头规范管）+ `bdd-manifest.json` 承接，不在需求规格内重复内联。

#### 3.1.3 §0 文档定位与 SSOT 头（主模板内容草案）

```markdown
> **文档版本**：v{{1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本需求规格说明书为阶段 1（需求分析）的唯一需求事实来源。需求变更须经 §11.5 迷雾毕业/§11 Out of Scope/豁免审批流程，不得无痕修改。
> **自身校验**：本规格以结构完整性为准——§3/§4/§10/§12/§16/附录 A 引用块指向的独立文件存在、§6 层级树 level 单调、§10 追踪矩阵字段一致、附录 A mermaid 块配平。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在 §11 Out of Scope 的显式标注中。
> **与设计文档关系**：本规格不描述系统设计（架构/运行时/子系统内部），设计事实由阶段 2-4 产出的设计文档承载。
> **行为规格承接**：行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），本规格 §12 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。
```

#### 3.1.4 独立子模板内容规范

**system-context.md**（对应 DESIGN.md §4）
- §1 外部实体清单（用户/外部系统/外部存储等，含角色与交互方向）
- §2 上下文边界原则（仅外部实体+边界，不画内部架构）
- 强制：外部实体须与 §5 stakeholder 对应

**glossary.md**（对应 DESIGN.md §3）
- 需求域术语子集（domain/REQ-group/NFR/CON/迷雾/UAT 等）
- 引用 `references/glossary.md` 权威表，不重复定义全量术语
- 强制：每条术语有定义+来源引用

**traceability-matrix.md**（对应 DESIGN.md §2.1.1）
- §1 REQ/NFR 8 字段表（编号/优先级/owner/陈述/候选子系统/候选落点§/验收关联/逐条验收判据；Phase 1 适配：涉及子系统→候选子系统，设计落点→候选落点§）
- §2 需求×测试层级承接矩阵（仅验收列填实，其余 pending）
- 强制：字段与主规格 §6/§7/§9/§17 一致

**behavior-spec.md**（对应 DESIGN.md §7）
- §1 行为规格角色（L1 行为规格在需求阶段的角色定位）
- §2 与 bdd-guide.md .feature 文件的引用关系（需求规格如何引用 .feature 文件，不内联）
- §3 与需求规格的关系（行为规格不替代需求陈述，互补验证）
- **不含**文档级元信息头规范（内联 feature 集已移除，头规范无载体；.feature 文件头由 bdd-guide.md §2 管）
- 强制：列出本模块对应的 .feature 文件清单

**discipline-dod.md**（对应 DESIGN.md §2.4.6）
- §1 需求阶段纪律（最小子集，不重复 SKILL.md 完整宪法）
- §2 DoD 可勾选清单（8-10 项，对应 DESIGN.md §2.4.6 九项收敛）
- 强制：DoD 清单 `- [ ]` 项 ≥ 8 条

**uml-modeling.md**（对应 DESIGN.md 附录 A）
- A.1 用例图（参与者/用例/关系，需求级）
- A.2 领域类图（需求级领域实体/关系/属性，无方法签名）
- A.3 活动图（业务流程/用户旅程，用 `stateDiagram-v2` 表达控制流）
- 强制：三图均用 mermaid，块首尾定界行配平；与主规格 §5/§6 对应

#### 3.1.5 discipline-dod.md DoD 清单草案（对应 DESIGN.md §2.4.6 收敛）

- [ ] 功能与语义：需求陈述与 User Stories 一致，无语义悖反
- [ ] 结构性校验：§3/§4/§10/§12/§16/附录 A 引用块指向文件存在、§6 层级树 level 单调单根父唯一、§10 追踪矩阵字段一致、附录 A mermaid 块配平
- [ ] 证据充分：验收判据可量化（无"快速"/"友好"主观词）、四维覆盖矩阵 100%（含豁免处置）
- [ ] 迷雾清空：§11.5 每项迷雾有毕业处置结果
- [ ] RTM 同步：§17 RTM 登记与 §10 追踪矩阵一致、NFR/CON 横切字段已登记
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=1` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=1` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕

---

### 3.2 参考层：`phase-1-requirements.md` 扩展

#### 3.2.1 需求解析算法新增步骤

当前算法 6 步（意图识别→层级树→冲突缺失→验收标准→REQ-group→覆盖分析），新增 3 步：

**步骤 7：系统上下文与术语建模**
- 识别外部实体（用户/外部系统/外部存储等），产出 `<module>-system-context.md`（§1 外部实体清单 + §2 上下文边界原则）
- 提取需求域术语，对照 references/glossary.md 权威表，产出 `<module>-glossary.md`（需求域术语子集）
- 主规格 §3/§4 引用块指向上述独立文件
- 失败：外部实体边界模糊 → 标注待澄清，向用户确认
- 成功：system-context.md + glossary.md 产出，主规格引用块成立

**步骤 8：UML 需求建模**
- 基于步骤 2 层级树 + 步骤 5 REQ-group，产出 `<module>-uml-modeling.md` A.1 用例图（参与者=stakeholder，用例=level=2/3 REQ）
- 基于步骤 2 层级树，产出 A.2 领域类图（领域实体=level=1/2 REQ 的名词性概念）
- 基于 User Stories（§5），产出 A.3 活动图（业务流程=正常场景 user story 序列）
- 主规格附录 A 引用块指向 uml-modeling.md
- 失败：用例/领域实体/活动节点无法对应 REQ → 标注待澄清
- 成功：uml-modeling.md 三图产出，mermaid 块配平，主规格引用块成立

**步骤 9：需求追踪矩阵与独立文件产出**
- 基于 §6 层级树 + §7 REQ-group + §9 覆盖矩阵，产出 `<module>-traceability-matrix.md`（§1 REQ/NFR 8 字段表 + §2 需求×测试层级承接矩阵，仅验收列填实）
- 产出 `<module>-behavior-spec.md`（列出本模块对应的 .feature 文件清单 + 引用关系，不内联 feature 块）
- 主规格 §10/§12 引用块指向上述独立文件
- 失败：追踪矩阵字段与 §6/§7/§9 不一致 → 回步骤 9 对齐
- 成功：traceability-matrix.md + behavior-spec.md 产出，主规格引用块成立

#### 3.2.2 执行方法论表新增产出物

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 系统上下文 | 套用 `templates/requirement-spec/system-context.md` | `<module>-system-context.md` |
| 术语表 | 套用 `templates/requirement-spec/glossary.md` | `<module>-glossary.md` |
| UML 需求建模 | 套用 `templates/requirement-spec/uml-modeling.md`，mermaid 三图 | `<module>-uml-modeling.md` |
| 需求追踪矩阵 | 套用 `templates/requirement-spec/traceability-matrix.md` | `<module>-traceability-matrix.md` |
| 行为规格模型 | 套用 `templates/requirement-spec/behavior-spec.md`（引用 .feature 文件，不内联） | `<module>-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/requirement-spec/discipline-dod.md` | `<module>-discipline-dod.md` |
| 主规格 | 套用 `templates/requirement-spec.md`（骨架 + 引用块指向上述 6 文件） | `<module>-requirement-spec.md` |

#### 3.2.3 新增失败模式

**FM-3D-08 追踪矩阵字段不一致**
- 检测信号：§10.1 REQ/NFR 表的「候选落点§」与 §6 层级树节点 § 不一致；「验收关联」与 §9 覆盖矩阵不一致；§10.2 矩阵验收列与 §17 RTM 不一致
- 处置：回步骤 9 对齐追踪矩阵字段

**FM-3D-09 UML 建模与层级树脱节**
- 检测信号：`<module>-uml-modeling.md` A.1 用例图参与者/用例与 §5 stakeholder/§6 REQ 不对应；A.2 领域类图实体与 §6 REQ 名词性概念不对应；A.3 活动图与 §5 User Stories 正常场景不对应
- 处置：回步骤 8 对齐 UML 建模

#### 3.2.4 新增禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 13 | 追踪矩阵字段与 §6/§7/§9/§17 不一致 | 步骤 9 须对齐追踪矩阵与层级树/REQ-group/覆盖矩阵/RTM |
| 14 | UML 图表与层级树/User Stories 脱节 | `<module>-uml-modeling.md` 三图须对应 §6 REQ/§5 stakeholder/§5 正常场景 |

#### 3.2.5 返工路径补充

- 追踪矩阵不一致（FM-3D-08）→ 回步骤 9 对齐
- UML 脱节（FM-3D-09）→ 回步骤 8 对齐

#### 3.2.6 验收标准补充

原 6 条验收标准新增 4 条：

- [ ] `<module>-system-context.md` + `<module>-glossary.md` 已产出，主规格 §3/§4 引用块成立
- [ ] `<module>-traceability-matrix.md`（8 字段表 + 测试层级矩阵）与 §6/§7/§9/§17 一致，主规格 §10 引用块成立
- [ ] `<module>-uml-modeling.md` 三图与 §5/§6 对应、mermaid 块配平，主规格附录 A 引用块成立
- [ ] `<module>-behavior-spec.md` + `<module>-discipline-dod.md` 已产出，主规格 §12/§16 引用块成立

---

### 3.3 门禁层：脚本扩展

#### 3.3.1 `check-requirement-graph.ts` 扩展

新增校验项（与现有 R1-R6 并列，编号 R7-R8）：

- **R7 追踪矩阵一致性**：读 `<module>-traceability-matrix.md` §1 表，校验每个 REQ/NFR 的「候选落点§」在主规格 §6 层级树节点 § 中存在；「验收关联」在 §9 覆盖矩阵或 §17 RTM 中存在
- **R8 UML mermaid 块配平**：读 `<module>-uml-modeling.md`，校验 mermaid 块首尾定界行（` ```mermaid ` / ` ``` `）一一配对

> 实现方式：复用 `graph-logic.ts` 纯逻辑层模式，新增 `requirementSpecParse()` 工具解析 markdown 表格/代码块 + 引用块指向文件存在性；samples 新增 R7/R8 各 1 valid + 1 bad（4 条）。

#### 3.3.2 `check-artifact-gate.ts --phase=1` 扩展

新增校验项（与现有 phase=1 NFR/CON designDoc 校验并列）：

- **引用块完整性校验**：主规格 `<module>-requirement-spec.md` §3/§4/§10/§12/§16/附录 A 引用块指向的 6 个独立文件（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）均存在
- **§0 SSOT 头校验**：主规格须含「文档版本」「SSOT 声明」「自身校验」「禁止占位词」四项声明
- **DoD 清单校验**：`<module>-discipline-dod.md` 须含可勾选清单（`- [ ]` 项 ≥ 8 条）

> 实现方式：在 `gate-logic.ts` 新增 `checkRequirementSpecStructure()` 函数（解析引用块 + 校验指向文件存在 + SSOT 头 + DoD 清单），phase=1 时调用；samples 新增 valid + bad-missing-refs + bad-missing-ssot-header + bad-dod-incomplete。

#### 3.3.3 self-test 基线扩展

新增样本：R7/R8 各 1 valid + 1 bad（4 条）+ 引用块/SSOT/DoD 校验 1 valid + 3 bad（4 条）= 8 条。基线 217→225。

#### 3.3.4 vitest 单测扩展

`graph-logic.test.ts` 新增 R7/R8 测试；`gate-enhancement.test.ts` 新增引用块完整性 + SSOT 头 + DoD 清单测试。

---

## 4. 与现有约束/资产的关系

| 现有约束/资产 | 关系 | 说明 |
|---|---|---|
| 约束 #9 TLA+ 行为门禁 | 不冲突 | 本增强不改 TLA+ 本身，TLA+ 规格仍由 .tla 文件承载 |
| 约束 #14 BDD 行为门禁 | 不冲突 | 行为规格由 .feature 文件承载（bdd-guide.md §2 头规范管），`<module>-behavior-spec.md` 仅定义引用关系，不内联 feature 块、不定义文档级头规范 |
| 约束 #11 层级树+图谱 | 不冲突 | §10 追踪矩阵与图谱互补，追踪仍以 RTM 为事实源（SKILL.md 约束 #3） |
| 约束 #15 REQ level | 保留 | §6 层级树保留 level 强制 |
| 约束 #18 RTM 回填 | 不冲突 | §10 追踪矩阵与 §17 RTM 互补，§10 是需求级追踪，RTM 是跨阶段事实源 |
| bdd-guide.md | 引用 | `<module>-behavior-spec.md` 引用 bdd-guide.md，列出 .feature 文件清单，不重复定义 .feature 头 |
| glossary.md（references） | 引用 | `<module>-glossary.md` 引用 references/glossary.md 权威表，不重复定义全量术语 |
| verifier-spec.md | 需同步 | V 评审新增项（6 独立文件完整性 + 引用块成立 + SSOT 头 + DoD 清单）纳入 completeness 维度 |
| SKILL.md | 需同步 | 阶段路由表 Phase 1 必读参考行/快速自检清单补条目 |
| definition-of-done.md | 引用 | `<module>-discipline-dod.md` 引用项目级 DoD，不重复定义全量 |

---

## 5. 一致性影响清单

须同步修改的文件（按串行子代理顺序）：

1. `w-model-dev/templates/requirement-spec.md` — 主模板重构（骨架 + §0 SSOT 头 + §3/§4/§10/§12/§16/附录 A 引用块）
2. `w-model-dev/templates/requirement-spec/system-context.md` — 新增（§3 系统上下文模板）
3. `w-model-dev/templates/requirement-spec/glossary.md` — 新增（§4 术语表模板）
4. `w-model-dev/templates/requirement-spec/traceability-matrix.md` — 新增（§10 追踪矩阵模板）
5. `w-model-dev/templates/requirement-spec/behavior-spec.md` — 新增（§12 行为规格模型模板，引用 .feature 文件，不内联）
6. `w-model-dev/templates/requirement-spec/discipline-dod.md` — 新增（§16 工程纪律与 DoD 模板）
7. `w-model-dev/templates/requirement-spec/uml-modeling.md` — 新增（附录 A UML 建模模板）
8. `w-model-dev/references/phase-1-requirements.md` — 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 13/14 + 返工路径 + 验收标准
9. `w-model-dev/scripts/graph-logic.ts` + `check-requirement-graph.ts` — 新增 R7/R8
10. `w-model-dev/scripts/gate-logic.ts` + `check-artifact-gate.ts` — phase=1 新增引用块完整性 + SSOT 头 + DoD 清单校验
11. `w-model-dev/scripts/__tests__/graph-logic.test.ts` — R7/R8 单测
12. `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` — 引用块/SSOT/DoD 单测
13. `w-model-dev/scripts/samples/` — 新增 valid + bad 样本（8 条）
14. `w-model-dev/scripts/self-test.ts` — 基线 217→225
15. `w-model-dev/references/verifier-spec.md` — V 评审新增项
16. `w-model-dev/SKILL.md` — 阶段路由表 Phase 1 行 + 快速自检清单 + 版本号 36.0.0→37.0.0
17. `w-model-dev/skill-metadata.json` — 版本号镜像
18. `package.json` — 版本号 36.0.0→37.0.0
19. `docs/skill-design-document_SSoT.md` — §3.4.xx 新增本轮条目 + §10A 追溯表
20. `AGENTS.md` — §4 新增第 37 轮条目（不新增反模式，反模式总数 44 不变；禁止行为 13/14 + FM-3D-08/09 在 phase-1-requirements.md 内）
21. `CHANGELOG.md` — [37.0.0] 条目
22. `README.md` — 能力 bullet（如有）

---

## 6. 验收标准

- [ ] 主模板 `requirement-spec.md` + 6 独立子模板（system-context/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling）重构完成
- [ ] `phase-1-requirements.md` 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 13/14
- [ ] `check-requirement-graph.ts` 新增 R7/R8，退出码 0/1/2 强一致
- [ ] `check-artifact-gate.ts --phase=1` 新增引用块完整性/SSOT/DoD 校验
- [ ] self-test 基线 217→225 全通过
- [ ] vitest 全通过（含 R7/R8 + 引用块/SSOT/DoD 单测）
- [ ] TypeScript strict 0 错误
- [ ] pre-push 门禁全通过
- [ ] 与 bdd-guide.md / glossary.md / verifier-spec.md / SKILL.md 一致性核验通过
- [ ] 版本号三处一致（package.json + SKILL.md frontmatter + skill-metadata.json）37.0.0

---

## 7. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| 改动面大（22 文件，含 6 新增子模板） | 中 | 串行子代理分批，每批父代理回归通过后再改下一批（用户偏好：禁止并行修改） |
| 老 demo 不兼容新模板 | 低 | 不向后兼容声明，重新生成（对齐约束 #15 风格） |
| 引用块断裂（独立文件缺失/路径错） | 中 | `check-artifact-gate.ts --phase=1` 引用块完整性校验强制 6 文件存在；samples 覆盖缺失场景 |
| UML mermaid 块配平校验误报 | 低 | R8 校验代码块定界行严格匹配，samples 覆盖正常+嵌套+未配平场景 |
| 追踪矩阵与 RTM 双重维护负担 | 低 | traceability-matrix.md 是需求级追踪（阶段 1 冻结），RTM 是跨阶段事实源（每阶段回填）；矩阵 pending 列由后续阶段回填 RTM 时同步 |

---

## 8. 实施顺序（串行子代理）

按用户偏好（串行子代理、禁止并行修改文档），分 4 批：

1. **批 1（模板层）**：重构主模板 `requirement-spec.md` + 新增 6 独立子模板 → 父代理回归（套用主模板自检 §0 + 引用块成立 + 6 子模板内容规范齐全）
2. **批 2（参考层）**：扩展 `phase-1-requirements.md` → 父代理回归（算法步骤 7/8/9 产出独立文件/FM-3D-08/09/禁止行为 13/14/返工路径/验收标准一致性）
3. **批 3（门禁层）**：`graph-logic.ts`/`check-requirement-graph.ts` R7/R8 + `gate-logic.ts`/`check-artifact-gate.ts` phase=1 引用块/SSOT/DoD + samples + self-test + vitest → 父代理回归（self-test 225 全通过 + vitest 全通过）
4. **批 4（同步层）**：`verifier-spec.md`/`SKILL.md`/`skill-metadata.json`/`package.json`/SSoT/AGENTS.md/CHANGELOG.md/README.md → 父代理回归（版本号三处一致 + 引用可达 + 术语一致）

每批完成后父代理跑结构一致性核对（grep 配平/引用可达/术语一致），通过后进入下一批。

---

## 9. 与 DESIGN.md 的对应关系总表

| DESIGN.md 机制 | Phase 1 增强落点 | 阶段边界处理 |
|---|---|---|
| §1 文档定位 + 文档头 SSOT | 主模板 §0 | 直接平移（需求域 SSOT） |
| §2.1.1 需求追踪矩阵（8 字段 + 测试层级矩阵） | 独立文件 `<module>-traceability-matrix.md` | 涉及子系统→候选子系统，设计落点→候选落点§，测试矩阵仅验收列填实 |
| §2.4.6 DoD 可勾选清单 | 独立文件 `<module>-discipline-dod.md` | 收敛为 Phase 1 子集（9 项），不重复 SKILL.md 完整宪法 |
| §3 核心概念与术语 | 独立文件 `<module>-glossary.md` | 需求域术语子集，引用 glossary.md 权威表 |
| §4 系统上下文 | 独立文件 `<module>-system-context.md` | 仅外部实体+边界原则，不画内部架构 |
| §7 行为规格模型 | 独立文件 `<module>-behavior-spec.md` | 仅定义引用 .feature 文件关系，不内联 feature 块、不定义文档级头规范（bdd-guide.md §2 管 .feature 头） |
| §2.4 工程纪律 | 独立文件 `<module>-discipline-dod.md` §1 | 收敛为需求阶段纪律最小子集 |
| 附录 A UML 2.0 | 独立文件 `<module>-uml-modeling.md` | 仅用例图+领域类图+活动图（序列图/状态机图由 TLA+/BDD 覆盖，不重复） |
| A.12 内联 feature 集 | **移除** | bdd 已有 .feature 文件 + bdd-manifest.json 承接，不在需求规格内重复内联 |

---

## 10. 决策记录

- **方案选择**：方案 A（全要素对齐）优于方案 B（核心严谨性轻量子集）——用户要求"至少达到如此级别"，B 砍掉的行为规格模型+DoD 恰是 DESIGN.md 严谨性骨架
- **独立文件拆分**：6 项增强内容拆为独立产出模板 + 独立产物文件，主模板用引用块串联（对齐 SKILL.md 引用 references/ 模式），避免主规格膨胀、便于独立维护与门禁
- **内联 feature 集移除**：bdd 已有 .feature 文件（bdd-guide.md §2 头规范管）+ bdd-manifest.json 承接，需求规格不重复内联；`<module>-behavior-spec.md` 仅定义引用关系
- **UML 范围**：用例图+领域类图+活动图（状态机由 TLA+/BDD 覆盖，序列图/通信图偏设计级有跨阶段风险）
- **不向后兼容**：老模板产出重新生成（对齐约束 #15 风格，避免维护兼容层）
- **门禁落点**：R7/R8 进 `check-requirement-graph.ts`（追踪矩阵一致性 + UML mermaid 配平，与图谱校验同域），引用块完整性/SSOT/DoD 进 `check-artifact-gate.ts --phase=1`（与工件质量门同域）
