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
