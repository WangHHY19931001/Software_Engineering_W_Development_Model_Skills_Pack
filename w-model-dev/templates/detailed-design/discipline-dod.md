# Phase 4 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 4 收敛子集；完整工程宪法见 `SKILL.md`，
> 项目级 DoD 见 `references/definition-of-done.md`。
> **阶段边界**：本文件只约束详细设计阶段纪律。
> 模板版本：v1.0。主文档引用块：`> Phase 4 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)`。

## 1. 详细设计阶段纪律

- 设计事实以本模块主文档为 SSOT，变更须经阶段门评审 / 上游概要设计变更回流（见主文档 §0）
- 禁止生成无断言占位用例（每个用例须 `expect()` 或等价断言，FM-DD-01）
- 禁止只覆盖 happy path（须覆盖边界条件必覆盖清单，FM-DD-02）
- 禁止跨模块 store 误用（store 归属与 phase3 一致，FM-DD-03）
- 禁止占位词进入正式交付（见主文档 §0）

## 2. DoD 可勾选清单

- [ ] 功能与语义：类/方法设计满足接口契约，无语义悖反
- [ ] 结构性校验：§1/§2/§4/§5/§6/§7 引用块指向文件存在、类图/ER 图 mermaid 块配平、追踪矩阵字段一致
- [ ] 证据充分：方法定义含前置/后置/异常、表结构含字段/索引/关系、验收判据可量化
- [ ] 无越界：不回溯重定义接口契约（FM-DD-06 闭合）
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=4` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=4` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
