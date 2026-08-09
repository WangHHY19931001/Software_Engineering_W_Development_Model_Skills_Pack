# Phase 3 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 3 收敛子集；完整工程宪法见 `SKILL.md`，
> 项目级 DoD 见 `references/definition-of-done.md`。
> **阶段边界**：本文件只约束概要设计阶段纪律，类级纪律由阶段 4 的 discipline-dod.md 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> Phase 3 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)`。

## 1. 概要设计阶段纪律

- 设计事实以本模块主文档为 SSOT，变更须经阶段门评审 / 上游系统设计变更回流（见主文档 §0）
- 禁止深入类/方法内部实现（FM-OD-06），类/方法级设计属阶段 4
- 接口契约须按 Schema 10 字段填写完整，缺一项即返工（FM-OD-01）
- 错误码须覆盖 4xx/5xx/业务三段位且每码含 code+message+httpStatus+retryable 四元组（FM-OD-02）
- 禁止占位词进入正式交付（见主文档 §0）

## 2. DoD 可勾选清单

- [ ] 功能与语义：接口契约满足系统设计模块划分，无语义悖反
- [ ] 结构性校验：§1/§4/§5/§6/§7/附录 A 引用块指向文件存在、接口与主文档 §2 对应、追踪矩阵字段一致、mermaid 块配平
- [ ] 证据充分：接口契约 Schema 10 字段齐全、错误码三段位 + 四元组、验收判据可量化
- [ ] 无循环依赖：调用关系 DFS 三色染色无环（FM-OD-03 闭合）
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=3` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=3` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
