# 第 13 轮：门禁鲁棒性与 maturity 语义修正设计 spec

> 2026-07-26 第 12 轮 W 模型 32 需求端到端调测归档后识别的 4 个问题修正设计。
> 采用方案 A 全量修正（P1×1 + P2×1 + P3×1 + P4×1）。
> 关联调测：[w-model-dev-demo 第 12 轮归档](../../w-model-dev-demo/.w-model/project.json) status=项目完成，currentPhase=9。
> 关联上一轮设计：[2026-07-26-tla-plus-plugin-absorption-design.md](./2026-07-26-tla-plus-plugin-absorption-design.md)（第 11 轮外部技能吸收）。

## 1. 问题清单与优先级

### P1 脚本鲁棒性问题（1 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P1.1 | check-code-tla-consistency.ts / check-requirement-graph.ts 缺少 EISDIR 友好处理 | 第 12 轮阶段 5 调用 `--graph=.w-model/ingestion`（目录路径）报 `EISDIR: illegal operation on a directory, read`，错误信息是裸 Node 报错，未提示"参数应为文件路径"；对比 check-artifact-gate.ts 已有 P2.6 graph 自动发现机制 | 编排者误传目录路径时无法快速定位问题，浪费 token 与轮次；与 check-artifact-gate.ts 行为不一致 |

### P2 严重语义问题（1 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P2.1 | maturity R3 单位不匹配 | [maturity-logic.ts:99-109](../../w-model-dev/scripts/logic/maturity-logic.ts) 注释自承"简化语义——completedCycles < completedPhases 即报违规"；但 schema 定义 `completedCycles` 为"完整 8 阶段周期数"（[data-models.md:440-441](../../w-model-dev/references/data-models.md)），1 周期 = 8 阶段，单位不匹配；第 12 轮调测时 completedCycles=6 触发 R3 违反，被迫人工改为 7，但语义上 7 阶段只对应 0 个完整周期 | R3 校验逻辑与 schema 语义矛盾，编排者每推进 1 阶段都要被迫 +1 completedCycles 才能不违反 R3，违背 completedCycles 的设计本意（衡量完整周期数） |

### P3 流程反模式问题（1 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P3.1 | self-as-verifier 模式下阶段级门禁跳过 | 第 12 轮阶段 7 编排者跳过 `check-artifact-gate --phase=7` 直接跑 `--phase=8` 终检，导致 REQ-019/021 的 `systemTest` 字段缺失到终检才发现（AGENTS.md §4 第十二轮"修复"节记录）；SKILL.md 已指引阶段 7 跑 `--phase=7`（line 262-269），gate-logic.ts PHASE_TRACE_FIELDS phase=7 已含 systemTest（line 83）——脚本与文档均无缺陷，纯执行遗漏 | 违反"早发现早修复"原则，阶段级门禁形同虚设；self-as-verifier 模式缺少强制约束 |

### P4 文档增强问题（1 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P4.1 | tla-plus-guide.md 缺少"时间推进/保留期"建模模式指引 | grep "时间推进\|保留期\|过期清理\|AdvanceTime\|retention\|expir" 零匹配；第 12 轮 `L4_audit_log_retention` 的 `AdvanceTime` 越界（`oldestAge` 推至 `RETENTION_DAYS+1`）触发 Retention90Days 不变式违反，靠 TLC 拦截后人工修复 | S-tla 子代理对"时间推进动作的前置条件 + 触发阈值"这类模式缺乏指引，每次涉及时间/保留期的建模都要靠 TLC 试错 |

---

## 2. 修正设计

### P1.1 脚本 EISDIR 友好处理

**当前状态**：
- check-code-tla-consistency.ts:73-92 的 `readJson` 仅处理 ENOENT，EISDIR 抛到 main.catch 退出码 2 但信息为 `Error: EISDIR: illegal operation on a directory, read`
- check-requirement-graph.ts:53-62 的 `readFile` 同样仅处理 ENOENT
- 对比 check-artifact-gate.ts 已有 P2.6 graph 自动发现（`.w-model/ingestion/` 下优先级查找）

**修正方案**：
1. 在两个脚本的 `readJson`/`readFile` 错误处理中增加 EISDIR 分支：
   - `e.code === 'EISDIR'` 时输出明确提示：`✗ ${label} 参数应为文件路径，实际为目录: ${abs}`
   - 退出码仍为 2（输入错误）
2. 不引入 `.w-model/` 自动发现（保持脚本职责单一，自动发现是 check-artifact-gate 的特化能力；这两个脚本参数语义明确为"文件路径"）

**测试**：
- 现有 self-test 不变（样本都是合法文件路径）
- 不新增 fixture（EISDIR 是参数错误，非业务场景）

**涉及文件**：
- `w-model-dev/scripts/cli/check-code-tla-consistency.ts`：readJson 函数增加 EISDIR 分支
- `w-model-dev/scripts/cli/check-requirement-graph.ts`：readFile 错误处理增加 EISDIR 分支

### P2.1 maturity R3 单位修正

**当前状态**：
- [maturity-logic.ts:99-109](../../w-model-dev/scripts/logic/maturity-logic.ts) R3 逻辑：`completedCycles < completedPhases` 即报违规
- 注释自承"简化语义"，并预留"后续可改为 floor(completedPhases/8)"
- schema 注释：`completedCycles` = "完整 8 阶段周期数（L0→L1 需要 ≥1）"
- 语义矛盾：1 周期 = 8 阶段，但 R3 要求 completedCycles ≥ completedPhases（即每阶段 +1）

**修正方案**：
1. R3 逻辑改为：`completedCycles < Math.floor(completedPhases / 8)` 即报违规
   - 0-7 阶段完成 → completedCycles 应 ≥ 0
   - 8 阶段完成（1 完整周期）→ completedCycles 应 ≥ 1
   - 16 阶段完成（2 完整周期）→ completedCycles 应 ≥ 2
2. 违规信息更新：`R3: project 已完成 ${completedPhases} 阶段（${floor(completedPhases/8)} 完整周期），但 unlockConditions.completedCycles=${uc.completedCycles} 未更新`
3. 删除"简化语义"注释，改为正式语义说明
4. self-test 样本 maturity/valid.json 的 completedCycles=3 保持有效（completedPhases 未传，不触发 R3）
5. self-test 样本 maturity/bad-stale.json 的 completedCycles=0 保持有效（completedPhases 未传，不触发 R3）
6. 新增 fixture：maturity/bad-r3-cycle-mismatch.json（completedPhases=8, completedCycles=0 应触发 R3）

**边界处理**：
- `options?.completedPhases === undefined` 时跳过 R3（保持现有行为，向后兼容）
- `completedPhases < 8` 时 `floor(completedPhases/8)=0`，completedCycles=0 也不报违规（合理：未完成 1 个完整周期）

**涉及文件**：
- `w-model-dev/scripts/logic/maturity-logic.ts`：R3 逻辑修正 + 注释更新
- `w-model-dev/scripts/cli/check-maturity.ts`：违规信息文案对齐（如有必要）
- `w-model-dev/scripts/cli/self-test.ts`：新增 1 条 R3 单位不匹配样本
- `w-model-dev/scripts/samples/maturity/bad-r3-cycle-mismatch.json`：新 fixture

### P3.1 反模式 #21 新增

**当前状态**：
- anti-patterns.md 已有 19 条反模式（#1-#19），第 9 轮新增 #20
- self-as-verifier 模式缺少"阶段级门禁不得跳过"约束
- SKILL.md 阶段路由表已指引 `--phase=N` 用法，但无强制约束

**修正方案**：
1. anti-patterns.md 新增反模式 #21：
   - **名称**：阶段级门禁跳过（self-as-verifier 模式下跳过中间阶段门禁直接跑终检）
   - **检测信号**：run-log.jsonl 中阶段 N 的 gate 动作类型为 `check-artifact-gate` 但参数为 `--phase=8`（或无 `--phase` 参数，默认终检），且 N < 8
   - **违反后果**：回到阶段 N 起点，强制跑 `--phase=N`
   - **例外**：阶段 1-4 不强制跑 `check-artifact-gate`（设计阶段，无测试汇总校验）；阶段 5 以 `check-code-tla-consistency` 为主，`--phase=5` 为辅
2. SKILL.md 阶段路由表强化约束：阶段 6/7/8 完成时必须跑对应 `--phase=6`/`--phase=7`/`--phase=8`，不得跳过
3. 不新增脚本校验（反模式靠编排者自检 + run-log R5 O 越权检测覆盖）

**涉及文件**：
- `w-model-dev/references/anti-patterns.md`：新增 #21
- `w-model-dev/SKILL.md`：阶段路由表阶段 6/7/8 行强化约束

### P4.1 tla-plus-guide.md 新增 §14 时间推进建模模式

**当前状态**：
- tla-plus-guide.md 无"时间推进/保留期/过期清理"相关内容
- 现有章节：§1-§13（§13 为第 11 轮外部技能吸收的参考资料索引）
- 第 12 轮 `L4_audit_log_retention` 靠 TLC 拦截才发现 AdvanceTime 越界

**修正方案**：
1. tla-plus-guide.md 新增 §14「L4 时间推进/保留期建模模式」：
   - §14.1 模式概述：时间推进动作（AdvanceTime/Tick）+ 保留期不变式（Retention/N/Expiry）
   - §14.2 反例（来自第 12 轮 L4_audit_log_retention）：
     - 错误实现：`AdvanceTime` 无前置条件，`oldestAge` 可推至 `RETENTION_DAYS+1`，违反 `Retention90Days` 不变式
     - TLC 报错：Invariant Retention90Days is violated
   - §14.3 正例：
     - 前置条件：`logCount > 0`（无日志时不推进）
     - 触发阈值：`oldestAge >= RETENTION_DAYS` 时触发 `PurgeExpiredLogs`
     - 上限约束：`oldestAge < RETENTION_DAYS`（AdvanceTime 守卫）
   - §14.4 通用规则：
     - 时间推进动作必须有前置条件（非空集合 / 上限约束）
     - 保留期不变式必须与清理动作的触发阈值一致（`>=` 触发清理，`<` 不变式守卫）
     - 清理动作与时间推进动作分离（不要在 AdvanceTime 中同时清理）
2. 不新增脚本校验（指引增强，靠 S-tla 子代理遵循 + V-tla 评审 + TLC 拦截）

**涉及文件**：
- `w-model-dev/references/tla-plus-guide.md`：新增 §14

---

## 3. 不涉及范围（明确边界）

- 11 个 check-*.ts 脚本中仅 3 个需改（check-code-tla-consistency.ts / check-requirement-graph.ts / check-maturity.ts）
- 不修改 check-artifact-gate.ts（P1.1 仅对齐 EISDIR 处理，不引入自动发现）
- 不修改 verifier-spec.md（P3 反模式靠流程约束，不新增 targetKind）
- 不修改 data-models.md schema 定义（P2 仅修正 R3 逻辑，保留 completedCycles 语义）
- 不修改 w-model-dev-demo/（第 12 轮已归档，不补建产物）
- 不修改 SSoT §3.4 已有小节（仅新增 §3.4.10 第 13 轮约束小节）

---

## 4. 验证策略

1. **TypeScript strict**：0 错误（修改后 `npx tsc --noEmit`）
2. **self-test**：基线 91 → 92（新增 1 条 R3 单位不匹配样本）
3. **vitest**：72/72 不变（不修改 vitest 测试套件）
4. **maturity R3 回归**：第 12 轮 w-model-dev-demo 的 maturity.json（completedCycles=7, completedPhases 未传）应不触发 R3
5. **EISDIR 友好提示**：手动调用 `check-requirement-graph.ts .w-model/ingestion` 应输出"参数应为文件路径"提示
6. **文档一致性**：anti-patterns.md #21 / SKILL.md 阶段路由表 / tla-plus-guide.md §14 / SSoT §3.4.10 / CHANGELOG [13.0.0] 互引一致

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| P2.1 R3 逻辑修正后，历史 demo 的 maturity.json 触发新违规 | 低 | 中 | 第 12 轮 demo completedCycles=7，completedPhases 未传（R3 跳过）；第 8 轮及之前 demo 同理 |
| P3.1 反模式 #21 过度约束 | 低 | 低 | 阶段 1-4 不强制；阶段 5 以 code-tla 为主；仅阶段 6/7/8 强制 |
| P4.1 §14 指引与现有 §4 不变式业务语义对齐节重复 | 低 | 低 | §4 是"不变式业务语义校验"（V-tla 评审项），§14 是"建模模式指引"（S-tla 产出参考），职责不同 |

---

## 6. 实施顺序

1. P1.1 脚本 EISDIR 处理（独立，无依赖）
2. P2.1 maturity R3 逻辑修正 + fixture + self-test（独立，无依赖）
3. P3.1 反模式 #21 新增 + SKILL.md 约束（依赖 P2.1 完成，避免文档与脚本不同步）
4. P4.1 tla-plus-guide.md §14 新增（独立，无依赖）
5. 顶层文档同步：SSoT §3.4.10 + AGENTS.md §4 + CHANGELOG [13.0.0]
6. 验证：self-test + vitest + TypeScript strict + EISDIR 手动验证

P1.1 / P2.1 / P4.1 可并行实施；P3.1 在 P2.1 完成后实施。
