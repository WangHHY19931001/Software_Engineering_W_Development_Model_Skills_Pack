# 项目级 Definition of Done（每次变更的日常标准）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `references/definition-of-done.md`。
> SSoT [§10.6](../../docs/skill-design-document_SSoT.md) 为权威定义，本文件为可执行细则。
>
> **与工件质量门的关系**：[§10.5 工件质量门](../../docs/skill-design-document_SSoT.md) / [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts) 是「验收阶段的硬门禁」（退出码 0 才放行）；DoD 是「每次变更的日常标准」（每个 `/wm code` / `/wm test` 后自检）。二者不互替。

## 适用范围

DoD 是项目级跨阶段标准，不替代各阶段产物的验收标准（见各 [`phase-N-*.md`](./)）。Agent 在以下场景必须自检 DoD：

- 每次 `/wm code` 完成代码生成后
- 每次 `/wm test result=pass|fail` 回填后
- 每次阶段门评审通过前
- 每次发布检查点（🔴 CHECKPOINT · 发布放行）前

## 六维度标准

| 维度 | 标准 | 验证方式 | 不通过 → 动作 |
|---|---|---|---|
| 测试 | 全部测试通过，无回归 | 测试运行器退出码 0；新增/修改代码须配套测试 | 当场补测试或修复回归，禁止「先放行后补」 |
| 行为 | 运行时验证行为符合规格 | 手动或自动化验证关键路径，不得仅凭单测通过 | 补运行时验证（curl / Postman / 浏览器 / k6），禁止「单测过即视为行为正确」 |
| 文档 | 涉及 API / 接口 / 数据模型的变更须同步更新文档 | `git diff` 包含相关 `docs/` 与 `templates/` 更新；RTM 字段同步 | 补文档更新，禁止「以代码为准」忽略文档 |
| RTM | 需求 / 设计 / 代码 / 测试映射同步 | `.w-model/rtm.json` 字段无空缺；覆盖率不下降 | 补登记 RTM 字段，禁止「验收时再补」 |
| 状态 | `Project.status` / `Requirement.status` 如实反映 | 字段值与磁盘产物一致；未完成不得标完成 | 修正 `status` 字段，禁止「乐观标记」 |
| **理解证据** | 阶段门放行须有用户理解证据 | run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"） | 拒绝放行；要求用户填入理解证据（O4 命中） |

> 第六维度「理解证据」吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/concepts.md` 的 Comprehension Debt 概念，对抗用户对阶段产物 rubber-stamp。放行 ≠ 理解；`acknowledgedDecisions` 非空才算放行。SSoT [§10.6](../../docs/skill-design-document_SSoT.md) 为权威定义。

## 自检清单

每次 `/wm code` 或 `/wm test` 后，Agent 须确认：

- [ ] 测试套件全过（退出码 0），新增/修改代码有配套测试
- [ ] 关键路径已运行时验证（不仅单测）
- [ ] 涉及 API / 接口 / 数据模型的变更已同步 `docs/` 与 `templates/`
- [ ] `.w-model/rtm.json` 字段无空缺，覆盖率未下降
- [ ] `Project.status` / `Requirement.status` 与磁盘产物一致
- [ ] 阶段门 CHECKPOINT 放行时，run-log `acknowledgedDecisions` 已填入 ≥1 关键决策摘要（非"确认"/"同意"）
- [ ] 无未提交的产物文件（`git status` 工作树干净，或显式说明未提交原因）
- [ ] 未命中 [anti-patterns.md](anti-patterns.md) 17 条流程反模式、F1~F10 失败模式与 O1~O6 运维失败模式

## 与阶段验收标准的关系

| 层级 | 触发时机 | 标准 | 强制性 |
|---|---|---|---|
| DoD（本文件） | 每次变更后 | 五维度自检 | 软性（违反不回退但降低质量） |
| 阶段验收标准 | 阶段门评审时 | 各 `phase-N-*.md` 定义的验收清单 | 硬性（不通过则回退，由 `check-verifier-output.ts` 校验） |
| 工件质量门 | 阶段 8 验收时 | RTM 100% + 四级测试全通过 | 硬性（退出码非 0 不放行，由 `check-artifact-gate.ts` 校验） |

## 反例

| # | 反例 | 正确做法 |
|---|---|---|
| 1 | 「单测过了就行，运行时验证不必做」 | 必须运行时验证关键路径；单测覆盖单元，不覆盖集成行为 |
| 2 | 「文档稍后补」 | 当次变更须同步文档；「稍后补」通常等于「永不补」 |
| 3 | 「RTM 字段空着，验收时一起填」 | RTM 字段在产物生成时即填；空字段等于追溯链断裂 |
| 4 | 「状态先标完成，后面再修」 | 状态如实反映；乐观标记触发 anti-patterns #9（谎报状态） |
| 5 | 「DoD 通过 = 工件质量门通过」 | 二者不互替；DoD 是日常标准，工件质量门是验收门禁 |

## 与 addyosmani/agent-skills 的差异

- addyosmani 的 DoD 是「每次变更」的项目级标准，无阶段概念。
- 本技能的 DoD 适配 W 模型 8 阶段：在每次变更自检基础上，叠加阶段验收标准与工件质量门两层硬门禁。
- 五维度（测试 / 行为 / 文档 / RTM / 状态）中，RTM 与状态是 W 模型特有的；测试 / 行为 / 文档与 addyosmani 一致。
