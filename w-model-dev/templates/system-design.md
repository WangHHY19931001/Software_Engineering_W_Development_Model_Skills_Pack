# 系统设计文档

> 阶段 2（系统设计）产出。套用时替换 `{{}}` 占位符。
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

> **文档版本**：{{v1.0}}（{{YYYY-MM-DD}} 首版）
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
| 前端 | {{React + TypeScript}} | {{版本号}} | {{适用性/成熟度/可维护性/引入成本/风险敞口评分}} |
| 后端 | {{Node.js + Express}} | {{版本号}} | {{选型理由}} |
| 数据库 | {{MongoDB + Redis}} | {{版本号}} | {{选型理由}} |
| 其他 | {{技术栈}} | {{版本号}} | {{选型理由}} |

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
