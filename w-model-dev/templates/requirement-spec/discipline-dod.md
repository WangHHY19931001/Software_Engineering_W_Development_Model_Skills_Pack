# Phase 1 工程纪律与 Definition of Done（DoD）

> 对应 DESIGN.md §2.4 工程纪律 + §2.4.6 DoD 可勾选清单。Phase 1 收敛子集；完整工程宪法见 `SKILL.md`，项目级 DoD 见 `references/definition-of-done.md`。
> 模板版本：v1.0。主规格引用块：`> Phase 1 工程纪律与 DoD 详见 [discipline-dod.md](./discipline-dod.md)`。

## 1. 需求阶段纪律

- 需求事实以本模块主规格为 SSOT，变更须经迷雾毕业/Out of Scope/豁免审批（见主规格 §0）
- 禁止 LLM 自行裁定 REQ-group 归属（禁止行为 #8），边界模糊向用户确认（FM-3D-04）
- 禁止占位词进入正式交付（见主规格 §0）
- 行为规格由 .feature 文件承载，禁止在需求规格内联 feature 块

## 2. DoD 可勾选清单

- [ ] 功能与语义：需求陈述与 User Stories 一致，无语义悖反
- [ ] 结构性校验：§13/§14/§15/§16/§17/附录 A 引用块指向文件存在、§4 层级树 level 单调单根父唯一、§15 追踪矩阵字段一致、附录 A mermaid 块配平
- [ ] 证据充分：验收判据可量化（无"快速"/"友好"主观词）、四维覆盖矩阵 100%（含豁免处置）
- [ ] 迷雾清空：§8.5 每项迷雾有毕业处置结果
- [ ] RTM 同步：主规格 §12 RTM 登记与 §15 追踪矩阵一致、NFR/CON 横切字段已登记
- [ ] 无占位词：TBD/TODO/undefined/待补建/待定 不在正式交付中
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=1` 退出码 0
- [ ] BDD/TLA+ 门禁通过：`check-bdd-model.ts --phase=1` + `check-tla-model.ts` 退出码 0
- [ ] 记录与审计：变更在文末变更记录留痕
