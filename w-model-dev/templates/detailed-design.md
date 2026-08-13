# 详细设计文档

> **模板版本**：v2.0
> 套用本模板时，引用块指向同目录独立文件，独立文件套用
> `templates/detailed-design/` 下对应子模板。产出物见
> `references/phase-4-detailed-design.md` §执行方法论。

## 文档信息

- 项目名称：{{项目名称}}
- 文档版本：{{v1.0}}
- 编制日期：{{YYYY-MM-DD}}
- 关联接口设计文档：{{interface-design 路径}}

## 0. 文档定位与 SSOT 头

> **文档版本**：{{v1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本详细设计文档为阶段 4（详细设计）的唯一设计事实来源。设计变更须经
>   阶段门评审 / 上游概要设计变更回流，不得无痕修改。
> **自身校验**：本文档以结构完整性为准——引用块指向的独立文件存在、
>   {{module}}-class-design.md 类图与 {{module}}-data-model.md ER 图 mermaid 块配平、
>   {{module}}-traceability-matrix.md 字段与主文档 §1/§2 一致。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在 §8 非目标显式标注中。
> **与概要设计关系**：本文档承接阶段 3《接口设计文档》（模块接口契约），类/方法级设计由本文档承载；
>   不回溯重定义接口契约（跨阶段变更须回阶段 3 返工）。
> **行为规格承接**：L4 行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），
>   本文档 §6 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

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
