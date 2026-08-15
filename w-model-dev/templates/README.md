# 模板布局说明（README）

本目录存放 W 开发模型各阶段的文档模板。布局与 `scripts/logic/gate-logic.ts` 中的 `PHASE_SPEC_LAYOUT` 常量保持一致：每个阶段由 **1 个主模板** + **6 个独立子模板** 组成，跨阶段共 **10 种** 独立子模板。

## 阶段 × 主模板 × 子模板 映射表

| 阶段 | 主模板 | 子模板（6 个/阶段） |
| --- | --- | --- |
| 阶段 1（需求规格） | `requirement-spec.md` | `requirement-spec/system-context.md`、`requirement-spec/glossary.md`、`requirement-spec/traceability-matrix.md`、`requirement-spec/behavior-spec.md`、`requirement-spec/discipline-dod.md`、`requirement-spec/uml-modeling.md` |
| 阶段 2（系统设计） | `system-design.md`（产出 `{module}-system-design.md`） | `system-design/system-architecture.md`、`system-design/glossary.md`、`system-design/traceability-matrix.md`、`system-design/behavior-spec.md`、`system-design/discipline-dod.md`、`system-design/uml-modeling.md` |
| 阶段 3（接口设计） | `interface-design.md`（产出 `{module}-interface-design.md`） | `interface-design/interface-contract.md`、`interface-design/glossary.md`、`interface-design/traceability-matrix.md`、`interface-design/behavior-spec.md`、`interface-design/discipline-dod.md`、`interface-design/uml-modeling.md` |
| 阶段 4（详细设计） | `detailed-design.md`（产出 `{module}-detailed-design.md`） | `detailed-design/class-design.md`、`detailed-design/data-model.md`、`detailed-design/glossary.md`、`detailed-design/traceability-matrix.md`、`detailed-design/behavior-spec.md`、`detailed-design/discipline-dod.md` |

> 说明：阶段 1 主文档为固定文件名 `requirement-spec.md`；阶段 2/3/4 主文档按 `*{mainSuffix}` 匹配（带 `{module}-` 前缀），子模板文件在阶段 ≥2 时同样带 `{module}-` 前缀。

## 主模板用途

| 模板 | 用途 |
| --- | --- |
| `requirement-spec.md` | 阶段 1 需求规格主文档，定义系统需求、范围与验收依据 |
| `system-design.md` | 阶段 2 系统设计主文档，描述系统整体架构与模块划分 |
| `interface-design.md` | 阶段 3 接口设计主文档，定义模块间接口契约与交互 |
| `detailed-design.md` | 阶段 4 详细设计主文档，细化类设计与数据模型 |

## 子模板用途（跨阶段共 10 种）

| 子模板 | 用途 |
| --- | --- |
| `system-context.md` | 系统上下文，界定系统边界与外部交互（阶段 1） |
| `system-architecture.md` | 系统架构视图，描述架构风格与组件关系（阶段 2） |
| `interface-contract.md` | 接口契约，定义接口签名、参数与约束（阶段 3） |
| `class-design.md` | 类设计，描述类结构、职责与关系（阶段 4） |
| `data-model.md` | 数据模型，定义数据结构与持久化设计（阶段 4） |
| `glossary.md` | 术语表，统一领域术语定义（阶段 1/2/3/4） |
| `traceability-matrix.md` | 追踪矩阵，维护需求/设计/测试的追溯关系（阶段 1/2/3/4） |
| `behavior-spec.md` | 行为规格，描述系统/模块行为与状态（阶段 1/2/3/4） |
| `discipline-dod.md` | 纪律 DoD 清单，阶段完成定义（须 ≥ 8 项，阶段 1/2/3/4） |
| `uml-modeling.md` | UML 建模，绘制用例/时序/类图等（阶段 1/2/3） |

## 其他模板

| 模板 | 用途 |
| --- | --- |
| `acceptance-test.md` | 验收测试用例模板 |
| `integration-test.md` | 集成测试用例模板 |
| `system-test.md` | 系统测试用例模板 |
| `test-case.md` | 通用测试用例模板 |
| `test-report.md` | 测试报告模板 |
| `coding.md` | 编码规范/编码任务模板 |
| `review-report.md` | 评审报告模板 |
| `rtm.md` | 需求追踪矩阵模板 |
| `tla-spec-template.md` | TLA+ 规格模板 |
| `bdd-manifest.template.json` | BDD 清单模板（JSON） |
| `budget.template.json` | 预算模板（JSON） |
| `run-log.template.jsonl` | 运行日志模板（JSONL） |
| `feature.template` | 特性模板 |
