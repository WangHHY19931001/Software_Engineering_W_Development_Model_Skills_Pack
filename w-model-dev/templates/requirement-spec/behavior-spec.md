# 行为规格模型（Behavior Spec）

> 对应 DESIGN.md §7 行为规格模型。**本文件仅定义引用关系，不内联 feature 块、不定义文档级头规范**——
> `.feature` 文件由 `references/bdd-guide.md` §2 头规范管（@req/@design/@designIds/@system/@tla-spec/@state-machine 等 10 字段），
> `bdd-manifest.json` 登记 feature 资产。模板版本：v1.0。主规格引用块：`> 行为规格模型详见 [behavior-spec.md](./behavior-spec.md)`。

## 1. 行为规格角色

- L1 行为规格在需求阶段的角色：以可执行场景（Given/When/Then）验证需求陈述可被理解与验收
- 行为规格与需求陈述互补：行为规格验证"行为如何被接受"，需求陈述定义"系统须提供什么"
- 行为规格不替代需求陈述，也不替代 TLA+ 行为正确性基准（.tla 文件）

## 2. 与 .feature 文件的引用关系

| 需求/用例 | 对应 .feature 文件 | 关键场景（Scenario 名） | bdd-manifest 登记 |
|---|---|---|---|
| REQ-{{xxx}} | `features/L1_{{system}}-001.feature` | {{Scenario 名}} | {{是/否}} |

> 强制：每个 L1 行为规格条目列出对应 .feature 文件路径；`.feature` 文件存在性由 `check-bdd-model.ts` D1-D7 校验。

## 3. 与需求规格的关系

- 行为规格条目须能回溯到主规格 §3 User Stories / §7 覆盖分析（无孤儿行为规格）
- 行为规格新增/变更须同步主规格 §12 RTM 登记，禁止只改 .feature 不回填（对齐约束 #3 RTM 回填精神）
