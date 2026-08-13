# 行为规格模型（Behavior Spec，L3）

> 对应 DESIGN.md §7 行为规格模型。**本文件仅定义引用关系，不内联 feature 块、不定义文档级头规范**——
> `.feature` 文件由 `references/bdd-guide.md` §2 头规范管（@req/@design/@designIds/@system/@tla-spec/@state-machine 等 10 字段），
> `bdd-manifest.json` 登记 feature 资产。**阶段边界**：本文件只定义 L3（模块接口级）行为规格引用，L4 由阶段 4 承接。
> 模板版本：v1.0。主文档引用块：`> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)`。

## 1. L3 行为规格角色

- L3 行为规格在概要设计阶段的角色：以可执行场景（Given/When/Then）验证模块接口行为可被验收
- 行为规格与接口契约互补：行为规格验证"接口行为如何被接受"，接口契约定义"接口如何组织"
- 行为规格不替代接口契约，也不替代 TLA+ 行为正确性基准（.tla 文件）

## 2. 与 .feature 文件的引用关系

| INTF / 模块对 | 对应 .feature 文件 | 关键场景（Scenario 名） | bdd-manifest 登记 |
|---|---|---|---|
| INTF-{{xx}} | `features/L3/{{system}}_{{subsystem}}_{{atom}}-{{num}}.feature` | {{Scenario 名}} | {{是/否}} |

> 强制：每个 L3 行为规格条目列出对应 .feature 文件路径；`.feature` 文件存在性由 `check-bdd-model.ts` D1-D7 校验。

## 3. 与接口设计文档的关系

- 行为规格条目须能回溯到主文档 §2 接口定义 / phase2 系统设计（无孤儿行为规格）
- 行为规格新增/变更须同步主文档 §5 追踪矩阵 + RTM 登记，禁止只改 .feature 不回填
