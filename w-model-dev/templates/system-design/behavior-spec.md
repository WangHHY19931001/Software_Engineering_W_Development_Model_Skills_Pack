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
