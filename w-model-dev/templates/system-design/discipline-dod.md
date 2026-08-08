# Phase 2 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 2 收敛子集；完整工程宪法见 `SKILL.md`，
> 项目级 DoD 见 `references/definition-of-done.md`。
> **阶段边界**：本文件只约束系统设计阶段纪律，接口/类级纪律由阶段 3/4 的 discipline-dod.md 承接。
> 模板版本：v1.0（第 38 轮）。主文档引用块：`> Phase 2 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)`。

## 1. 系统设计阶段纪律

- 设计事实以本模块主文档为 SSOT，变更须经阶段门评审 / 上游需求变更回流（见主文档 §0）
- 禁止以纯文字描述替代架构图（FM-SD-01 架构图缺数据流标注 → 返工）
- 技术选型须按 5 维度决策矩阵评分，禁止无依据选型（FM-SD-02）
- 禁止越过阶段边界落接口契约/类定义（FM-SD-06），接口/类级设计属阶段 3/4
- 禁止占位词进入正式交付（见主文档 §0）

## 2. DoD 可勾选清单

- [ ] 功能与语义：系统设计满足需求规格，无语义悖反
- [ ] 结构性校验：§1/§6/§7/§8/§9/附录 A 引用块指向文件存在、子系统清单与 §3 模块划分一致、追踪矩阵字段一致、mermaid 块配平
- [ ] 证据充分：技术选型 5 维度评分齐全、ADR 有上下文与后果、验收判据可量化
- [ ] 架构图完整：含数据流标注、非纯文字（FM-SD-01 闭合）
- [ ] 无循环依赖：模块划分 DFS 三色染色无环（FM-SD-03 闭合）
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=2` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=2` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕

> DoD 门禁：`check-artifact-gate.ts --phase=2` 校验本文件 `- [ ]` 项 ≥ 8 条（批 3 实现）。
