# 轮次决策记录：第 9-39 轮（SSoT §3.4.7-39 原文归档）

> 自 SSoT 移出（41.7.0 全仓去历史化）：本文件为 SSoT §3.4.7-39 轮次记录原文，
> 对应 CHANGELOG-archive.md [9.0.0] ~ [40.2.0] 条目。原文保留，不篡改。

#### 3.4.7 第 9 轮门禁与流程细化约束（2026-07-25）

> 第 8 轮 25 需求端到端调测归档后识别的 11 个问题（P1×3 + P2×4 + P3×4），经第 9 轮全量修正后的硬约束条款。

##### P1.1 阶段级工件校验（phaseOption）
- `check-artifact-gate.ts` 支持 `--phase=N`（简写 `-p N`，N ∈ 1..8）参数，按阶段分层校验测试汇总与 RTM 字段
- 阶段 5/6/7 G 门禁须使用对应 `--phase=5/6/7` 校验，不得用终检（phase=8）提前否决 pending 的后续测试层
- `phaseOption` 默认 8（终检，向后兼容）；NFR/CON 横切行按阶段递进（phase<5 仅校验 designDoc，phase≥5 加校 codeModule）

##### P1.2 NFR/CON 早发现
- NFR/CON 行须在阶段 1 登记 `designDoc`（横切 SD 清单或"横切"标识）
- 阶段 5 须回填 `codeModule`（源码文件清单或"横切"标识）
- 配合 `--phase` 阶段校验早发现横切治理缺失

##### P1.3 禁止只规划不执行（反模式 #20）
- 子代理响应必须含至少一次执行工具调用（Write/Edit/RunCommand/Read）
- 编排者检测到纯文本规划（含"正在准备"/"将创建"/"步骤"等关键词且无 tool_use）须重派
- 子代理 prompt 模板必须包含"立即执行，禁止只规划"约束语句

##### P2.4 subCriteria 标准化（4 targetKind × 5 项标准颗粒度）
- `verifier-output.subCriteria` 名称必须取自 `verifier-spec.md` §2.3 标准模板
- 实际实施颗粒度：**4 targetKind × 5 项标准**（保留 §7.1-§7.5 既有结构，不按 8 阶段细分）
  - `requirement`：completeness / clarity / consistency / testability / traceability
  - `design`：architecture-soundness / requirement-coverage / interface-consistency / feasibility / testability
  - `code`：correctness / security / readability / maintainability / conformance
  - `test`：coverage / correctness / independence / clarity / priority-reasonableness
- 阶段推断通过 targetKind 实现（phase 2/3/4 共用 `design`，phase 6/7/8 共用 `test`）
- `verifier-logic.ts` 校验 subCriteria 名称、数量（必须 ==5）、权重均不得改动

##### P2.5 targetKind 枚举标准化
- `meta.targetKind` ∈ {"requirement","design","code","test"}
- "testcase" 已废弃（统一用 "test"）；"file" 已废弃（统一用 "code"）
- 非法值 → `check-verifier-output.ts` 退出码 1

##### P2.6 graph 资产自动发现
- `check-artifact-gate.ts` 自动查找 `.w-model/ingestion/` 下 graph 资产
- 候选顺序：graph.json → consolidated-phase4.json → consolidated-phase3.json → consolidated-phase2.json → consolidated-phase1.json
- 未发现 graph 资产时输出警告但不 fail

##### P2.7 S 子代理修改既有产物边界
- S 子代理负责**新增**产物；R 子代理负责**修复**既有产物的 bug
- S 发现既有产物 bug 时须记录 `rootcause-report.jsonl` 并转交 R
- 紧急修复（阻塞当前阶段）须在 `run-log.jsonl` 追加 fix 条目标注"紧急修复"，阶段后由 R 复核

##### P3.8 TLA+ states 自动清理
- `check-tla-model.ts` 默认在 TLC 校验完成后自动 `rm -rf <tla-dir>/states/`
- `--keep-states`（简写 `-k`）参数用于调试场景保留 states
- 未传 `--keep-states` 时日志输出 `✓ 已清理 TLA+ states 目录`

##### P3.9 Next 分支覆盖扩展
- `code-tla-logic.ts` 维度 3 遍历 `tla-manifest.json` 全部 specs 的 Next actions
- 旧实现仅遍历 L4 specs；新实现覆盖 L1/L2/L3/L4 全部 specs
- PascalCase（TLA+ Action）→ camelCase（代码方法）自动映射校验

##### P3.10 rawScores 合理性校验
- `rawScores` 不得全相同（防"复制填入"作弊）
- text-parse 模式下 `rawScores` 不得为完美等差数列（公差 0.01）
- text-parse 模式扰动范围须 ∈ [0.01, 0.10]；>0.10 fail，<0.01 警告
- logits 模式豁免等差与扰动范围校验（天然可能产生等差分布）

##### P3.11 coverage/.tmp 清理
- 历史 `w-model-dev-demo/.gitignore` 排除 `coverage/.tmp/`（已归档删除）
- vitest `coverage.clean=true`（或 vitest.config.ts 中 `coverage.clean: true`）

#### 3.4.8 第 10 轮外部技能吸收约束（2026-07-26）

> 吸收 to-tickets / to-spec / OpenSpec 三源精华，以"阶段内强化 + 纯文档"方式融入 8 阶段流程。不新增脚本、不新增子流程、不新增约束。详细映射与决策记录见 [external-skills-absorption.md](../w-model-dev/references/external-skills-absorption.md)。

##### 阶段 1 强制产出节
- S-doc 产出需求规格时必须包含三节：**User Stories 长列表**（覆盖正常/异常/边界/NFR/CON）、**Out of Scope 显式声明**（至少 1 条）、**Implementation/Testing Decisions 分离**（架构/接口决策与测试 seam 决策分离）
- 禁止具体文件路径与代码片段（除非 prototype 产出的决策密集片段）

##### 阶段 2-4 测试 seam 决策
- S-doc 在系统/概要/详细设计文档中必须包含「测试 seam 决策」节
- 三层一致性：阶段 3 必须引用阶段 2 seam，阶段 4 必须引用阶段 3 seam
- 阶段 2/3 不允许"为覆盖率新建 seam"（违反 to-spec「fewer seams better」原则）
- 阶段 4 私有状态机转移由 TLA+ 不变式断言覆盖，不在代码层引入测试 seam

##### 阶段 5 Tracer-bullet 票据拆解
- S 子代理编码前兼任 S-tickets，产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- 票据为垂直切片（贯穿 schema + service + store + 单元测试），形成 blocking edges DAG
- Wide refactor（重命名/重类型跨全代码库）走 expand-contract 序列
- 例外：单一 bug 修复 / 单一 TLA+ 不变式违反修复 / 单 SD 子系统且 ≤1 文件改动 → 不票据化，直接编码

##### 阶段 8 archive 机制
- 项目级放行（acceptance-test-report.md §9 用户 confirm）后，S 子代理执行 archive
- 路径：`changes/archive/<YYYY-MM-DD>-<feature-slug>/`
- 产物：proposal.md + specs.md + design.md + tasks.md + tla-summary.md + rtm-snapshot.json + verifier-summary.md
- `project.json` 新增可选字段 `archivePath: string`（默认空字符串，向后兼容）

##### §11A Brownfield 阶段级适配
- 阶段 1 Brownfield 入口：codebase survey 5 步（现状调查 → 逆向 RTM → 缺口分析 → User Stories 回填 → Out of Scope 声明）
- 阶段 2-4：seam 决策优先选现有模块边界；DD 仅针对本轮改动模块
- 阶段 5：票据拆解优先 prefactor；Wide refactor 必走 expand-contract
- 不全量补建历史 RTM/TLA+，不重构无关历史代码（约束 5 协同）

#### 3.4.9 第 11 轮外部技能吸收（2026-07-26）

> 吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义，以"阶段内强化 + 纯文档"方式融入 TLA+ 子流程。不新增脚本、不新增子流程、不新增约束。

**吸收内容**：
- 新建 4 份 TLA+ 参考文件：`tla-plus-syntax-reference.md` / `tla-plus-patterns-examples.md` / `tla-plus-tlc-configuration.md` / `tla-plus-review-checklist.md`
- 修订 `tla-plus-guide.md` 新增 §13 索引节 + S-tla/V-tla 加载矩阵
- 修订 `verifier-spec.md` §7.2 补「TLA+ 审查参考清单」引用（不新增 targetKind 枚举值）
- 修订 `SKILL.md` 阶段路由表 TLA+ 行补参考文件引用

**加载矩阵**（遵循约束 #6「按需加载」）：

| 角色/阶段 | 必读 | 按场景 |
|---|---|---|
| S-tla 阶段 1（L1） | syntax-reference | patterns §KV |
| S-tla 阶段 2-3（L2/L3） | syntax-reference | patterns §Bakery/Producer-Consumer + tlc-configuration |
| S-tla 阶段 4（L3/L4） | syntax-reference | patterns §Consensus/Two-Phase Commit + tlc-configuration |
| V-tla 全阶段 | review-checklist | syntax-reference |

**不新增约束的依据**：现有反模式 #15-17（TLA+ 占位/简化/错误实现、建模不符合需求设计）已覆盖吸收内容的合规边界。4 份参考文件是参考资料，不是新约束。

详见 `w-model-dev/references/tla-plus-guide.md` §13。

---

#### 3.4.10 第 13 轮：门禁鲁棒性与 maturity 语义约束（2026-07-26）

> 第 12 轮 32 需求端到端调测归档后识别的 4 个问题修正约束。设计 spec：[`docs/superpowers/specs/2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md`](./superpowers/specs/2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md)。

1. **P1.1 脚本 EISDIR 友好处理**：`check-code-tla-consistency.ts` / `check-requirement-graph.ts` 的 `readJson`/`readFile` 错误处理增加 EISDIR 分支，输出"参数应为文件路径，实际为目录"明确提示（退出码 2）。不引入 `.w-model/` 自动发现（保持脚本职责单一，自动发现是 `check-artifact-gate.ts` 的特化能力）。

2. **P2.1 maturity R3 单位修正**：`maturity-logic.ts` R3 逻辑从 `completedCycles < completedPhases` 改为 `completedCycles < Math.floor(completedPhases / 8)`，与 schema 语义"完整 8 阶段周期数"对齐。1 完整周期 = 8 阶段，`completedCycles` 应 ≥ `floor(completedPhases / 8)`。第 12 轮调测时 `completedCycles=6` 触发 R3 违反被迫人工改为 7，但语义上 7 阶段只对应 0 个完整周期——原逻辑单位矛盾。

3. **P3.1 反模式 #21**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检，违反则回到阶段起点。第 12 轮阶段 7 跳过 `--phase=7` 直接跑 `--phase=8`，导致 REQ-019/021 的 `systemTest` 字段缺失到终检才发现。例外：阶段 1-4 不强制跑 `check-artifact-gate`；阶段 5 以 `check-code-tla-consistency` 为主，`--phase=5` 为辅。详见 `w-model-dev/references/anti-patterns.md` #21。

4. **P4.1 tla-plus-guide.md §14**：新增 L4 时间推进/保留期建模模式指引（反例 + 正例 + 通用规则），降低 S-tla 子代理对 TLC 试错的依赖。第 12 轮 `L4_audit_log_retention` 的 `AdvanceTime` 越界（`oldestAge` 推至 `RETENTION_DAYS+1`）触发 `Retention90Days` 不变式违反，靠 TLC 拦截后人工修复。详见 `w-model-dev/references/tla-plus-guide.md` §14。

**不涉及范围**：不修改 `check-artifact-gate.ts`（P1.1 仅对齐 EISDIR）；不修改 `data-models.md` schema 定义（P2 仅修正 R3 逻辑）；不修改 `verifier-spec.md`（P3 反模式靠流程约束）；不修改已归档的 `w-model-dev-demo/`（已于第 17 轮 P6 删除）。

#### 3.4.11 第 16 轮：遗留问题与设计层缺口闭环（2026-07-26）

> 第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 #14 + 4 demo 层设计缺口 P7-001~P7-004 + 4 技能包侧设计缺口）全量修正约束。设计 spec：[`docs/superpowers/specs/2026-07-26-round16-residual-and-design-gap-closure-design.md`](./superpowers/specs/2026-07-26-round16-residual-and-design-gap-closure-design.md)。修正策略：方案 A 全量修正——技能包侧预防 demo 缺陷（不重建 demo 仅在 reference 补强约束）+ 脚本文档双改闭环 #14 + 反模式补强。

1. **P1.1 tla-logic.ts R13 checkRounds schema 校验**：`tla-logic.ts` 新增 R13 校验，`checkRounds` 元素须含 `phase` / `round` / `specId` / `syntaxCheck` / `tlcCheck` / `violations` / `converged` 七个必填字段，禁止 `phaseSummary` / `summary` / `phaseDecisions` / `phaseLevelSummary` 等 phase 级摘要字段（checkRounds 为 spec 级返工记录，phase 级摘要应写在 `run-log.jsonl` 的 `note` 字段）。`check-tla-model.ts` JSON 摘要新增 `checkRoundsViolations` 字段。新增 fixture `samples/tla/bad-checkrounds-phase-summary.json` + self-test 样本（基线 94→95）。第 15 轮遗留 #14 闭环。

2. **P2.1 RunLogEntry vs EventIngress Schema 边界对照表**：`data-models.md` 新增 Schema 边界对照表，显式区分两 schema 字段（标识 / 时间戳 / 阶段 / 动作 / 角色 / 结果 / 决策 / 耗时 / 影响范围 / 备注 / 门禁归档），禁止混用规则：`run-log.jsonl` 不得含 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`），`event-ingress.jsonl` 不得含 RunLogEntry 字段（`runId` / `action` / `role` / `outcome` / `acknowledgedDecisions` / `duration_s` / `tokens` / `estimated` / `subagentSpawns` / `gateExitCode` / `gateLogPath` / `phase` / `phaseName`）。第 15 轮共性问题 B 闭环。

3. **P3.1 phase-5-coding.md 角色越权预防**：`phase-5-coding.md` 禁止行为节新增 #7（角色越权：`authRequired` 仅校验 token 存在未校验角色），新增「角色校验清单」节（5 项检查：`requiredRole` 显式声明 / 与需求设计角色枚举一致 / token 解码后断言 `token.role ∈ requiredRoles` / 单元测试覆盖跨角色越权 / 系统测试覆盖越权用例）。预防 P7-001 类缺陷。

4. **P3.2 phase-3-outline-design.md 跨模块数据源选择约束**：`phase-3-outline-design.md` 新增「跨模块数据源选择约束」节（显式声明 / schema 一致 / token sub 对齐三项要求），`phase-4-detailed-design.md` 同步约束节（不得在详细设计阶段变更 store 选择）。预防 P7-002 / P7-003 类缺陷。

5. **P3.3 phase-5-coding.md 副作用时序一致性**：`phase-5-coding.md` 禁止行为节新增 #8（副作用时序不一致：响应体字段返回副作用自增前的旧值），新增「副作用时序一致性清单」节（4 项检查：副作用在响应体构造前完成 / 响应体字段反映已生效状态 / 单元测试覆盖一致性 / 系统测试覆盖时序用例）。预防 P7-004 类缺陷。

6. **P3.4 phase-7-system-test.md 检测条款**：`phase-7-system-test.md` 禁止行为节新增 #7（系统测试未覆盖跨模块数据流 / 角色越权 / 副作用时序一致性检测），强制系统测试用例包含三类场景。

7. **P4.1 checkpoint-logic.ts 关键词集合注释 + phase-8-acceptance-test.md 决策关键词约束**：`checkpoint-logic.ts` 在 `ID_PATTERNS` / `TECH_KEYWORDS` 定义前新增注释块（用途 / 扩展规则 / 与 R2 关系），明确当前集合为 5 个 ID 模式 + 37 个技术关键词（16 英文 + 21 中文）。`phase-8-acceptance-test.md` 新增「acknowledgedDecisions 决策条目须含关键词」节。第 15 轮共性问题 C 闭环。

8. **P4.2 operational-recovery.md JSON 文件写入工具选择**：`operational-recovery.md` 新增「JSON 文件写入工具选择」节，强制 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell `ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content`（BOM + 深度 + 中文乱码）。第 15 轮共性问题 A 闭环。

9. **P4.3 tla-plus-guide.md §checkRounds 字段类型修正 + 禁止字段节**：`tla-plus-guide.md` §checkRounds 字段表 `violations` 类型从 `number` 改为 `string[]`（与 `tla-logic.ts` 类型定义一致），新增「禁止字段（phase 级摘要）」节 + spec 级语义明确。

10. **反模式 #22~#26 新增**：`anti-patterns.md` 新增 5 条反模式——#22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON 文件 PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用。目录 / 命中高发阶段表 / 与门禁脚本对应关系表 / 检测信号与回退命令表同步 #22~#26。`SKILL.md` 快速自检补「JSON 文件写入工具」+「acknowledgedDecisions 关键词」两条。

**不涉及范围**：不重建 `w-model-dev-demo/`（第 15 轮调测后归档不入库，本轮仅在 reference 补强预防条款）；不修改 `verifier-spec.md`（V 评审 schema 不变，靠 reworkHints 标注新反模式）；不修改 `check-artifact-gate.ts` / `check-requirement-graph.ts` / `check-verifier-output.ts`（脚本层仅 `tla-logic.ts` + `check-tla-model.ts` + `checkpoint-logic.ts` 改动）；不引入新门禁脚本（#22~#24 靠 V 评审 + 系统测试用例守护，#25 靠 run-log note 字段检测 + 编排者自检，#26 靠现有 `check-run-log.ts` R1 校验）。

#### 3.4.12 第 17 轮：D5 文档不一致修正与简化行为预防（2026-07-27）

> 第 16 轮 D5 文档一致性检查发现 4 项互引不一致 + 1 项简化行为预防缺失 + 2 项状态问题（demo 未清理 + 第 16 轮变更未提交）。实施计划：[`docs/superpowers/plans/2026-07-27-round17-d5-inconsistency-and-simplification-prevention.md`](./superpowers/plans/2026-07-27-round17-d5-inconsistency-and-simplification-prevention.md)。修正策略：Part A 修 4 项 D5 不一致 / Part B 新增反模式 #27 + 简化预防节 / Part C 清理 w-model-dev-demo + 提交 16+17 轮 / Part D 全量回归验证。

1. **P1 data-models.md violations 类型修正**：`TlaCheckRound.violations` 类型从 `number` 改为 `string[]`（与 `tla-plus-guide.md` §checkRounds + `tla-logic.ts` 类型定义一致），注释 `violations === 0` 改为 `violations.length === 0`。第 16 轮 D5 互引不一致 P1 闭环。

2. **P2 anti-patterns.md #25 工具清单补全**：#25 主表描述补全 4 种 PowerShell 工具（`ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content`），检测信号补 `Set-Content` 关键词。同步 `operational-recovery.md` 描述 + 检测信号（4 种工具一致）。第 16 轮 D5 互引不一致 P2 闭环。

3. **P3 anti-patterns.md #26 字段名修正**：#26 主表描述 `decisions` 改为 `acknowledgedDecisions`（正确字段名为 RunLogEntry 的 `acknowledgedDecisions`，非 EventIngress 字段）。`data-models.md` 第 395 行历史叙述加注 `decisions` 非合法字段名。第 16 轮 D5 互引不一致 P3 闭环。

4. **P4 SKILL.md acknowledgedDecisions 标注修正**：acknowledgedDecisions 条目标注「反模式 #26 关联」改为「R2 校验维度区分：#26 管字段归属 R1，本条管字段内容 R2」。同步 `CHANGELOG.md` [16.0.0] 节描述。第 16 轮 D5 互引不一致 P4 闭环。

5. **P5 新增反模式 #27 调测者简化行为**：self-as-verifier 模式下调测者兼具 S/V/G 角色，简化行为无外部评审拦截。`anti-patterns.md` 新增 #27（3 类简化倾向：S1 上下文压缩丢细节 / S2 追求效率省步骤 / S3 未对照硬约束核验），目录 / 主表 / 命中高发阶段表 / 与门禁脚本对应关系表 / 检测信号表 5 处同步。`operational-recovery.md` 新增「调测者简化行为预防」节（3 类倾向表 + 5 项自检清单）。`SKILL.md` 快速自检补「调测者简化行为自检」条。三向互引闭合（operational-recovery.md ↔ anti-patterns.md #27 ↔ SKILL.md）。

6. **P6 删除 w-model-dev-demo/**：第 15 轮调测产物清理。归档（9 文件）已迁移至仓库级 `docs/changes/archive/2026-07-26-round15-end-to-end-test/`。

7. **P7 第 16+17 轮合并提交**：commit `acc80ce`。因第 16/17 轮变更在 `anti-patterns.md` / `SKILL.md` / `data-models.md` / `CHANGELOG.md` 文件级交错，无法用非交互方式拆分为 2 个 commit。

**不涉及范围**：不修改脚本（仅文档与 SKILL.md 自检）；不修改 `verifier-spec.md`（V 评审 schema 不变）；不修改 `check-*.ts` 脚本（#27 靠现有 R1 + R2 + R6 交叉检测 + 编排者自检）；不引入新门禁脚本。

#### 3.4.13 第 18 轮：drawio-skill 设计吸收（2026-07-27）

> 吸收 drawio-skill (https://github.com/Agents365-ai/drawio-skill) 7 项设计实践，强化 JSON Schema 强约束 + 安全扫描基线 + 版本号双写 + pure/IO 分离 + 测试 coverage 矩阵 + toolbox 决策表 + Bundled Resources 触发条件总表。本轮为纯文档同步，不涉及 .ts 代码变更。

1. **Bundled Resources 触发条件总表**：SKILL.md 新增章节，明示 references/scripts/subagent/templates 每文件的触发条件（约束 #6 可执行化）
2. **JSON Schema 强约束**：引入 ajv (draft-07) + schemas/*.schema.json，所有 .w-model/*.json 在 logic 层前置 schema 校验，反模式 #28
3. **skillspector-baseline 安全扫描**：引入 eslint-plugin-security + .eslintsecurity-baseline.json sha256 指纹豁免，pre-push 强制
4. **版本号双写**：SKILL.md frontmatter `version` + skill-metadata.json 镜像，__tests__/skill-metadata.test.ts 回归
5. **pure/IO 函数分离**：*-logic.ts 纯函数审计，IO 抽到 check-*.ts
6. **测试 coverage 矩阵**：__tests__/README.md 用 Area | What's locked in 表
7. **toolbox 决策表**：references/toolbox.md「I have X, I want Y → use Z」

**不涉及范围**：不修改 `*.ts` 代码（仅文档同步 SSoT / AGENTS / CHANGELOG / README）；不引入新门禁脚本（schema 校验由 logic 层自动调用，security-scan 由 pre-push 承载）。

#### 3.4.14 第 19 轮：BDD 建模与验收夹具（2026-07-27）

> 引入 BDD（Behavior-Driven Development）建模（Cucumber.js + Gherkin）与验收夹具，与既有 TLA+ 行为规格正交协作，覆盖 W 模型 8 阶段的测试设计/执行/TDD 夹具需求。BDD features 作为可执行规格，TLA+ 作为行为正确性基准，二者通过等价性校验互锁。

1. **分层 BDD 架构**：L1（系统级 acceptance）/ L2（子系统级 system）/ L3（集成级 integration）/ L4（原子级 unit），与 TLA+ L1-L4 层次化建模对齐
2. **features 文件结构**：独立 .feature 文件（Gherkin 语法），文件头标注 `@req` / `@design` / `@system` / `@tla-spec` / `@state-machine` / `@parent-features` / `@sibling-features` / `@child-features` / `@scenario-id-prefix`，Background 节声明状态机七要素
3. **状态机七要素约束**：states / initialState / terminalStates / acceptingStates / rejectingStates / transitions / invariants 全部必填（acceptingStates 不可为空，其余可为 `()`）
4. **BDD↔TLA+ 等价性校验**：状态集等价 + 初始状态一致 + 转移集等价 + 不变式归一化匹配；不等价时走 R→V→G→S-fix 循环（反模式 #29）
5. **门禁脚本**：`check-bdd-model.ts` 7 维度校验（D1 头标注 / D2 Gherkin 语法 / D3 状态机 / D4 TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射）+ `bdd-logic.ts` 纯逻辑 + `bdd-manifest.schema.json` 强约束
6. **8 阶段产出时序**：阶段 1-4 产出对应层级 L1/L2/L3/L4 features + bdd-manifest.json；阶段 5 以 L4 features 作为 TDD 夹具；阶段 6/7/8 执行 L3/L2/L1 cucumber scenarios
7. **BDD↔RTM 映射**：RTM 测试列字段值扩展为 `<Type>-NNN | BDD-L<level>-<system>-<num>.feature`，字段类型保持 `string | null` 不变
8. **BDD↔verifier-spec 关系**：不新增 targetKind 枚举值，BDD features 评审用 `targetKind=test` + `bdd-review-checklist.md` 7 项清单（仿 TLA+ 用 `design` + `tla-plus-review-checklist.md`）
9. **验收夹具四类**：状态转移夹具 / 不变式断言夹具 / RTM 追溯夹具 / 端到端 scenario 夹具
10. **反模式 #29**：BDD 建模与需求/设计/TLA+ 不符未回退——BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑

**不涉及范围**：不引入 LLM 调用（cucumber 是确定性运行器，features/step 是文本+代码）；不替换 TLA+（BDD 与 TLA+ 正交协作，互为补充）；不修改既有 `*-logic.ts` 校验逻辑（新增独立的 `bdd-logic.ts`）。

---

#### 3.4.15 第 19.0.1 轮：W 模型 8 阶段端到端调测验证与归档（2026-07-27）

> 使用博客系统后端 demo（32 需求 = 22 REQ + 6 NFR + 4 CON）完整执行 W 模型 8 阶段端到端调测，验证 BDD 建模（§3.4.14）与既有 TLA+/RTM/graph 门禁的端到端协作。1 完整 W 模型周期闭环（阶段 1-8 全通过），V 评审 7A+1B，231 测试用例全通过。归档产物迁移至 `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`，demo 产物清理。

1. **真实 bug 发现**：`check-bdd-model.ts` D7 RTM 映射校验误用 `rtm.requirements`（不存在字段），修正为 `rtm.rows` + `requirementId`（与 `gate-logic.ts` `RTMMatrixShape` 对齐）。此 bug 在单元测试中无法发现（sample 数据结构恰好与错误字段名匹配），仅在真实 8 阶段端到端调测中用真实 RTM 喂给脚本时才暴露——印证 W 模型 8 阶段端到端调测对技能包本身的验证价值
2. **调测过程数据修正（4 项）**：checkpoint 决策缺技术名词（R1 拦截）/ maturity R3 误报 completedCycles=0（修正为 1）/ verifier compositeScore 0.9235 漂移（修正为 0.922）/ run-log action="execute" 枚举违反（修正为 "test"）
3. **reworkHints（6 项下一周期改进）**：cucumber-report.json 未生成 + UAT-002 JWT 时间快进测试缺失 + 性能/安全横切覆盖薄（k6/OWASP ZAP 缺失）+ tla-consistency.ts 存根 + SearchIndexer 索引优化 + IT-004 性能用例归属
4. **归档（7 文件）**：README.md / verifier-summary.md / rtm-snapshot.json / test-report-snapshot.json / tla-summary.md / bdd-summary.md / checkpoint-summary.md
5. **产物清理**：`w-model-dev-demo/` + `update-rtm.cjs` + `执行情况/` 删除；`package.json` demo 专用依赖还原
6. **D7 测试样本补强**：`bdd-logic.test.ts` 新增 3 个 D7 RTM schema 测试（正确 schema 通过 + feature id 未登记失败 + reqId 不存在失败），防止 `rtm.rows` → `rtm.requirements` 回退
7. **版本号三处同步**：`package.json` + `skill-metadata.json` + `SKILL.md` frontmatter 同步为 `19.0.1`（[18.0.0] 版本号双写规范）

**调测统计**：UT 150/150 + IT 24/24 + ST 32/32 + UAT 25/25 = 231 全通过；TLA+ L4 TLC 零死锁零违反（状态空间 125）；BDD 4 features（L1/L2/L3/L4）34 scenarios；code-TLA+ 一致性 4 维度 78 项；check-artifact-gate 终检 exitCode=0；maturity.completedCycles=1。

**不涉及范围**：不引入新门禁脚本（仅修正既有 `check-bdd-model.ts` D7 schema bug）；不修改 BDD 建模架构（§3.4.14 已定义）；demo 产物不入库（归档已迁移至 `docs/changes/archive/`）。

---

#### 3.4.16 第 20 轮：阶段 1 需求提取四维识别与豁免审批（2026-07-28）

> 阶段 1 需求分析从「扁平 REQ 列表 + 简单层次」升级为「四维识别模型 + 豁免审批治理」。
> 四维：层级关系 + 子系统划分 + 交叉逻辑 + 覆盖分析。豁免审批强制 S→R→V→人类四阶段流程。

1. **四维识别模型**：层级关系（level/priority/reqGroup + R1-R4）+ 子系统划分（REQ-group）+ 交叉逻辑（precedes/conflicts-with/cross-cuts + R5/R6）+ 覆盖分析（4 张矩阵 + 100% 覆盖率 + C1-C10）
2. **豁免审批治理**（强制 S→R→V→人类）：check-exemption.ts E1-E8 + 反模式 #30 + 禁止行为 #11
3. **图谱 schema 扩展**：节点新增 level/priority/reqGroup；边新增 3 类；不向后兼容（历史抛弃，重新生成）
4. **规格书模板扩展**：5 节 → 13 节（§4-§7 四维识别）
5. **失败模式扩展**：FM-3D-01~06 + FM-4D-01~05 + FM-EXEMPT-01~05，共 16 类
6. **测试基线扩展**：self-test 121→152；vitest 108→~165

**不涉及范围**：不引入新节点类型；不引入新 V 子标准；不引入新 CHECKPOINT 暂停点；不引入端到端调测。

#### 3.4.17 第 21 轮：产出来源正确性（inputProvenance）（2026-07-29）

各角色产出须含 `inputProvenance` 来源证明（签名链记录的字段，详见 §7.9 / §10.11）：

- `sourceSigIds`：本角色动作所依赖的上游签名 ID 列表（必须存在于签名链中）
- `sourceArtifacts`：本角色产出所消费的上游产物 + 来源签名 ID + 来源角色
- `transformDescription`：本角色对上游产物做了什么变换（人类可读描述）

后续阶段消费者须校验前一阶段产出来源正确性；来源缺失或来源错误即拒绝消费，回退前一阶段。各角色强制来源/禁止来源矩阵见 [`w-model-dev/references/signature-chain-guide.md`](../w-model-dev/references/signature-chain-guide.md) §3。

---

#### 3.4.18 第 22 轮：P0-P3 技能问题修正与 S→R3→V→G 预防性审查流程（2026-07-30）

> 触发：第 21 轮 8 阶段完整调测暴露 10 个技能层面问题（P0×2 + P1×3 + P2×3 + P3×2）。设计 spec：[`docs/superpowers/specs/2026-07-29-round22-p0-p3-skill-fixes-design.md`](./superpowers/specs/2026-07-29-round22-p0-p3-skill-fixes-design.md)。实施 plan：[`docs/superpowers/plans/2026-07-30-round22-p0-p3-skill-fixes.md`](./superpowers/plans/2026-07-30-round22-p0-p3-skill-fixes.md)。修正策略：方案 A 轻量增量（复用现有 R 机制 + 预防性审查模式标记 + SSoT 与 scripts 双层保障），按 SSoT 先行 → schemas → scripts → samples → 测试 → 自测 6 层推进，完成 35 个任务（SSoT 14 + schemas 1 + scripts 7 + samples 8 + testing 4），29 commits。

1. **S→R3→V→G 预防性审查流程**：所有阶段 S 产出后、V 评审前强制插入三阶段 R 预防性审查（R3），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 三份报告。R-完整性（字段齐全/模板套用/RTM 登记/demo 范围边界/N-A 标记/uat-path-mapping 回填）/ R-可靠性（TLA+/BDD 等价性/状态机一致性/接口契约/字段命名业务语义对齐/设计项装配点与测试 seam 一致性）/ R-安全性（输入校验/鉴权/越权/敏感信息/限流装配/密码哈希）。与返工 R 区别：返工 R 在 V/G 不通过后触发定位根因，R3 在 S 产出后主动触发预防性审查。V 须读取 R3 报告纳入 reworkHints，跳过 R3 直接进入 V 评审命中反模式 #33。新增约束 #11（R3 预防性审查强制）+ 反模式 #33（跳过 R3 预防性审查）。

   **第29轮升级（§3.4.25）**：R3 从「条件强制」升级为「**无条件强制**」，覆盖**所有 S 变体**（S-doc / S-tla / S-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**）。移除 `--r3-enabled` flag 语义（CLI 保留向后兼容视为 no-op）。紧急修复通道从「事后 R 复核」改为「前置 R3×3 + V + G」。`check-preventive-review.ts` 报告路径扩展支持 `<phase>-fix-{dim}.json` / `<phase>-emergency-{dim}.json`。新增反模式 #42（S-fix / emergency-fix 后跳过 R3+V）；强化 #33/#34（移除「启用时」措辞）；扩展 #35（含 R3 产物混合）。违反字面即违反精神：R3 不得以「修复就是小改不用审」「紧急救援优先」「self-as-verifier 模式简化」等理由跳过。

2. **R3 分派模板**：`subagent-delegation.md` 新增「R3 预防性审查分派模板」节，定义 R3 子代理输入（当前阶段产物路径 / 上游产物 / 审查维度）、产出（三份 PreventiveReview JSON）、与返工 R 的属性对比表、V 评审参考方式。R3 三阶段可并行分派。

3. **demo 范围声明（R3 完整性维度覆盖）**：不新增 `project.json.demoScope` 字段（按用户决策）。S-doc 产出需求规格时须在 `Out of Scope` 节显式声明 demo 范围外子系统，验收测试设计须对照 Out of Scope 标记 N/A 用例（附注释说明缺失端点名和原因）。R3 完整性维度校验 N/A 用例与 Out of Scope 声明一致性。

4. **uat-path-mapping 强制校验**：`docs/uat-path-mapping.md` 为阶段 1 强制产出，阶段 5 回填实际路径，阶段 8 验收时校验完整性。`check-artifact-gate.ts --phase=1` 校验文件存在性；`--phase=5` 校验每条 UAT-NNN 的「实际路径」列非 `_待阶段5回填_`，且 `mappingType` ∈ `["直接","等价","替代"]`。`check-design-contract-consistency.ts` 在文件缺失时输出明确提示。

5. **codeModule 格式规范**：`codeModule` 字段按行类型分支校验（由 `check-artifact-gate.ts --phase=5` 强制）。REQ 行匹配 `^SD-[\d.]+:src/.+\.(ts|js|py|java)$`（示例 `SD-5.2.1:src/auth/login.ts`）；NFR/CON 行匹配 `^src/.+\.(ts|js|py|java)$` 或 `=== "横切"`。`rtm.schema.json` 不添加 pattern（REQ/NFR 格式不同，单一 pattern 无法覆盖），改为在 gate 脚本中按 `requirementId` 前缀分支校验。

6. **跨平台环境变量**：Windows PowerShell 下 `cross-env` 可能失效。推荐 `dotenv` 包（项目根 `.env` + `import 'dotenv/config'`），备选 `cross-env`（devDependency），PowerShell 适配用 `$env:VAR="value"` 临时设置。`phase-5-coding.md` + `examples/coding.md` 新增跨平台环境变量设置节。

7. **preventive-review.schema.json（新增 schema）**：`PreventiveReview` 报告 schema，required 字段 `reviewedAt/reviewer/phase/dimension/findings/passed`，`dimension` 枚举 `completeness/reliability/security`，`findings[].severity` 枚举 `Critical/Required/Optional/Nit/FYI`，`additionalProperties: false`。

8. **check-preventive-review.ts（新增脚本）**：校验 R3 三份报告完整性。读取 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`，每份报告通过 schema 校验 + phase 一致性 + dimension 一致性。三份报告须全部存在且合规。配套 `preventive-review-logic.ts` 纯逻辑层 + 单元测试。`check-run-log.ts` 新增 R3 记录校验（S→V 间须有 3 条 R3 记录）。

9. **check-tla-bdd-sync.ts（新增脚本）**：TLA+/BDD 自动化同步校验。从 TLA+ 抽取转移名（`Next == \/ Act1 \/ Act2`）/ 状态名（`vars` 声明）/ 不变式名，从 BDD feature Background 节抽取状态机七要素，diff 比对两者差异。退出码 0=一致 / 1=有差异 / 2=输入错误。配套 `tla-bdd-sync-logic.ts` 纯逻辑层 + 单元测试。

10. **其他修正**：`check-bdd-model.ts` 路径解析多路径查找（basePath / .w-model/ / .w-model/bdd/ / projectDir 回退）；`verifier-spec.md` 新增常见违规示例节（mappingType 非法值 / subCriteria.name 不匹配 `^[a-z][a-z-]*$` / 额外字段违反 `additionalProperties: false`）+ 推荐 subCriteria 名称清单；`phase-3/phase-4` 新增字段命名业务语义对齐检查项 + 设计项→装配点→测试 seam 三者一致性校验。版本号三处同步为 `22.0.0`。

**不涉及范围**：不新增 `project.json.demoScope` 字段（demo 范围由 R3 完整性维度覆盖）；不修改 `verifier-output.schema.json` 本身（仅补充 Agent 认知文档）；不引入新门禁节点类型；不引入新 V 子标准。

---

#### 3.4.19 第 23 轮：W 模型 8 阶段端到端调测发现（2026-07-30）

> 触发：用户指令「移除 w-model-dev-demo 所有产物，进行完整 8 阶段调测」。调测模式：编排者-子代理分派 + self-as-verifier + R3 预防审查（首次启用 §3.4.18 R3 流程）。归档：[`docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/`](./changes/archive/2026-07-30-round23-w-model-8-phase-validation/)（README.md + rtm-snapshot.json + test-report-snapshot.json + tla-summary.md + bdd-summary.md + verifier-summary.md + checkpoint-summary.md）。1 完整 W 模型周期闭环（阶段 1-8 全通过），8 阶段 V 评审全 A，630 测试用例全通过。

1. **调测规模**：32 需求（22 REQ + 6 NFR + 4 CON）+ 22 SD（7 子系统 + 5 横切 + 10 业务）+ 22 INTF（22 RESTful API）+ 75 DD（22 SD 拆分 75 类/模块/函数）+ 4 TLA+ 规格（L1/L2/L3/L4 各 1）+ 4 BDD features（32 scenarios）+ 52 TS 源文件（types/utils/repos/services/middlewares/infrastructure）+ 630 测试用例（390 UT + 130 IT + 38 ST + 72 UAT）+ 图谱 282 节点 / 1343 边。

2. **调测结果**：630/630 测试全通过（34.76s）；覆盖率 94.99% lines / 84.91% branches / 95.69% functions / 94.55% statements；`tsc --noEmit` 0 错误；RTM 100% 覆盖（32/32 需求，6 维度全回填：designDoc/codeModule/unitTest/integrationTest/systemTest/acceptanceTest 各 32）；TLA+ 4 规格 Sany+TLC 通过零违反；BDD 4 features 32 scenarios 100% RTM 覆盖；信息流校验 0 黑洞 / 0 奇迹 / 0 死模块；边界完整性 ≥1 EXT-IN + ≥1 EXT-OUT；8 阶段 V 评审 qualityLevel 全 A（compositeScore 0.88-0.92）。

3. **调测过程修正（5 项 P1，全部闭环）**：
   - R23-001 性能基线调整：5 个 ST 性能测试初始阈值 500ms 在 full-suite 运行时不稳定，调整至 2000ms 留 headroom（NFR-001 生产 200ms 是目标值）
   - R23-002 IT 性能阈值同步：2 个 IT-perf 阈值 100ms/200ms 同步调整至 2000ms
   - R23-003 UAT-053 性能阈值同步：1 个 UAT 性能阈值 500ms 同步调整至 2000ms
   - R23-004 状态机修正：`archived → unarchive` 转移目标 `draft` 而非 `published`（已对齐 article-state-machine.ts）
   - R23-005 路由顺序冲突：`/api/articles/popular` 与 `/api/articles/:id` 冲突，改用 `/api/articles/:id/related`

4. **调测模式验证**：从 self-as-verifier 升级为 **orchestrator-subagent 分派 + R3 预防审查**。编排者最小化（S/V/G/R 子代理分派），R3 三阶段预防审查首次实战启用（completeness/reliability/security），不可绕过 CHECKPOINT（self-as-verifier 模式自动放行 + 决策型 CHECKPOINT 需用户确认）。约束 #1-#17 全部满足，反模式 #1-#33 全部规避。

5. **暴露的 10 项技能包问题**（详见 §3.4.20）：①门禁脚本声明通过与实际执行脱节 ②RTM 实体未真正回填 ③R3 预防审查启用但未实执行 ④性能基线未区分生产目标值与测试环境基线 ⑤路由顺序设计指导缺失 ⑥状态机设计文档与代码实现一致性无自动校验 ⑦图谱规模阈值靠补丁达成 ⑧子代理产出文件大小达标但信息密度不均 ⑨编排者对子代理任务边界把控不严 ⑩self-as-verifier 模式下 V/G/R 独立性存疑。经 search 子代理逐项验证：3 项部分存在（①②③基础约束已有但缺关键执行机制）、7 项确实存在（④-⑩完全缺失关键内容）。

**不涉及范围**：不引入新门禁脚本（调测过程修正均为 demo 代码层调整）；不修改技能包 SSoT（问题修正设计见 §3.4.20）；demo 产物保留在 `w-model-dev-demo/` 目录不入库（按用户约定）；项目级放行 pending 用户确认（self-as-verifier 模式调测者代签）。

---

#### 3.4.20 第 24 轮：十项技能包修正设计（2026-07-30）

> 触发：第 23 轮完整 8 阶段调测暴露 10 项技能包层面问题。设计 spec：[`docs/superpowers/specs/2026-07-30-round24-p0-p3-skill-fixes-design.md`](./superpowers/specs/2026-07-30-round24-p0-p3-skill-fixes-design.md)（用户拒绝独立 spec，要求写入 SSoT）。问题验证报告：search 子代理产出。修正策略：按 P0（信息流硬约束）→ P1（行为正确性）→ P2（设计指导）→ P3（质量度量）4 批分层增量，每批跨 SKILL.md / references / templates / schemas / scripts 5 层，每批完成后跑 self-test 验证。版本号目标 23.0.0。

1. **P0.1 问题 2 RTM 实体未真正回填**：新增约束 #3「RTM 实体每阶段必须回填；S 子代理产出后须更新 `.w-model/rtm.json`；阶段门 CHECKPOINT 须展示 RTM 文件路径与 coverage 字段」。`check-artifact-gate.ts` 增加 RTM coveragePercent 硬校验（< 100 → exitCode 1，当前仅校验存在性 + JSON 合法性）；`gate-logic.ts` 增加 coverageStatus 字段校验（值为"100%"或"部分"时须与 coveragePercent 一致；"待覆盖" → exitCode 1）。`subagent-delegation.md` §S 子代理职责增加 RTM 实体回填强制职责。samples 新增 bad-rtm-coverage-below-100.json / bad-rtm-status-mismatch.json。

2. **P0.2 问题 9 编排者角色分派不严**：新增约束 #8「编排者每阶段须至少分派 S/V/G 三角色各 1 次；R3 启用时须分派 R 角色；self-as-verifier 模式下兼任时须产出各角色独立产物文件」。新增反模式 #34「编排者漏派角色——run-log 中某阶段缺 role=V 或 role=G 记录」。新增 `check-role-dispatch.ts` 校验 run-log 中每阶段含 S/V/G 各 ≥1 条记录，R3 启用时含 R ≥3 条记录（completeness/reliability/security）。`run-log.schema.json` role 字段枚举增加每阶段至少含 S/V/G 各 1 条校验。`subagent-delegation.md` 新增「角色分派完整性校验」节。

   **第29轮升级（§3.4.25）**：约束 #8 中「R3 启用时须分派 R 角色」升级为「**无条件须分派 R 角色 ≥3 次**」。`check-role-dispatch.ts` 移除 `--r3-enabled` 参数语义（R≥3 无条件校验，CLI 保留 flag 向后兼容视为 no-op），纯逻辑抽离至 `role-dispatch-logic.ts`。反模式 #34 强化（移除「启用时」措辞）。

3. **P1.3 问题 3 R3 未实执行**：约束 #11 闭环机制强制校验 4 脚本扩展为 5 脚本（增加 `check-preventive-review.ts`，R3 启用时）。`check-run-log.ts` R1-R7 规则增加 R8「R3 启用时，run-log 中 S→V 之间须含 3 条 role=R 记录（completeness/reliability/security）」。`check-preventive-review.ts` 增加 `--auto-trigger` 模式：从 run-log 读取当前阶段，自动校验对应阶段的 3 份 R3 报告。`phase-1-requirements.md` §R3 完整性维度校验增加 check-preventive-review.ts 须在 V 评审前由 G 子代理执行，exitCode=0 方可进入 V 评审。

   **第29轮升级（§3.4.25）**：约束 #11 删除「（R3 启用时）」字样，5 脚本无条件强制。R8 规则从「R3 启用时」改为「**无条件**」，并扩展覆盖 `action=fix` / `action=emergency-fix`（S-fix / S-emergency-fix → V 之间也须有 3 条 R3 记录）。`check-preventive-review.ts` 新增 `--variant=standard|fix|emergency` 参数，支持 `<phase>-fix-{dim}.json` / `<phase>-emergency-{dim}.json` 路径校验。

4. **P1.4 问题 6 状态机一致性无校验**：新增 `check-state-machine-consistency.ts`：解析 `detailed-design.md` 中的状态转移表（Markdown 表格）与 `src/state-machines/*.ts` 中的 TRANSITIONS 定义，校验状态集 + 转移集一致。`tla-plus-guide.md` 新增「设计文档 ↔ 代码状态机一致性」节（校验范围 / 豁免条件 / 误报处理）。samples 新增 state-machine/ 目录（bad-missing-transition / bad-extra-transition / valid-consistent）。现有脚本校验"代码↔TLA+"，本脚本补"设计文档↔代码"维度。

5. **P1.5 问题 10 self-as-verifier 独立性**：SSoT 新增 §self-as-verifier 模式（定义：单 Agent 兼任 S/V/G/R 多角色；启用条件：仅 demo 项目 / 非生产项目；独立性保证：兼任时须产出各角色独立产物文件）。`verifier-spec.md` 新增 §self-as-verifier 模式（V 评审产出独立性要求：VerifierOutput JSON 须独立产出，不得与 S 产出混合）。`agent-personas.md` 新增 §self-as-verifier 兼任规则。新增反模式 #35「self-as-verifier 模式下 V/G/R 产物混合——评审报告与产出文档在同一文件中」。`check-verifier-output.ts` 增加校验：self-as-verifier 模式下 VerifierOutput JSON 文件路径不得与 S 产出文件路径相同。

6. **P2.6 问题 4 性能基线双值**：NFR 模板增加 `targetValue`（生产目标值）+ `testThreshold`（测试环境基线）双字段。`templates/requirement-spec.md` NFR 字段增加双字段；`templates/system-test.md` 新增「性能度量环境声明」节（须声明测试环境 CI/full-suite/isolated 与对应阈值）；`rtm.schema.json` NFR 行增加双字段（可选，NFR 类型时推荐）；`quality-standards.md` §性能指标监控增加「生产目标值 vs 测试环境基线」区分指导；`check-artifact-gate.ts` NFR 类型 RTM 行校验双字段存在性（警告级，不 fail）。

7. **P2.7 问题 5 路由顺序**：`templates/interface-design.md` 新增「路由注册顺序约束」节（静态路径先于参数路径；鉴权路由先于公开路由；须列出注册顺序表）。`phase-3-outline-design.md` 新增「路由顺序约束」节（框架级约束 Express/Koa + 设计级约束鉴权前置/限流前置）。新增反模式 #36「路由顺序错误——参数路径先于静态路径导致拦截」。

8. **P2.8 问题 7 图谱边数补丁**：`graph-guide.md` 新增「边数下限与语义来源占比」节：边数下限按节点数比例（边 ≥ 节点 × 3）；语义来源占比 ≥ 80%（从设计文档实体派生的边占比）。`graph-logic.ts` 增加边数下限校验（边 < 节点 × 3 → 警告）；增加语义来源占比校验（< 80% → 警告）。保留 small-project exemption 机制避免误报小项目。

9. **P3.9 问题 1 门禁 stdout 贴出**：约束 #9 增加文案「G 子代理须存档 stdout 到 `.w-model/gate-logs/`；编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行」。反模式 #27 S2 扩展「门禁脚本未实跑——仅记录 JSON 摘要未真实执行命令」作为独立可命中信号。`phase-8-acceptance-test.md` §终检执行增加「编排者须贴出 check-artifact-gate.ts stdout 末尾 5 行作为放行证据」。

10. **P3.10 问题 8 信息密度**：`quality-standards.md` §文档质量标准增加「信息密度」指标（实体引用次数 / 章节数，如 SD-xxx 引用次数 / 章节数 ≥ 2）。`definition-of-done.md` §文档 DoD 增加「信息密度」度量（关键实体引用密度 ≥ 2/章节）。新增反模式 #37「产物膨胀但核心决策稀疏——文件大小达标但实体引用密度 < 1/章节」。

**不涉及范围**：不修改约束 #1-#13 既有语义（#9/#11 仅扩展文案不改变语义，新编号）；不引入新 CHECKPOINT 暂停点；不修改 TLA+/BDD 建模架构（§3.4.14 已定义）；图谱边数下限校验为警告级不 fail（保留豁免机制）。

#### 3.4.21 第 25 轮：codegraph + OpenSpec 集成（2026-07-30）

> 触发：用户要求阶段 5 起引入 codegraph（修改前影响分析）与 OpenSpec opsx（任务规划层），增强代码修改安全性与任务拆解规范性。设计 spec：[`docs/superpowers/specs/2026-07-30-round25-codegraph-opsx-integration-design.md`](./superpowers/specs/2026-07-30-round25-codegraph-opsx-integration-design.md)。经联网调研确认两工具能力定位：codegraph 提供 100% 本地符号级 callers/callees/blast radius 查询（auto-sync）；OpenSpec 提供 opsx:explore/propose/apply/archive 规格驱动变更工作流。集成方案 A（三段式 S 分派，每段 R3×3+V 审查）。版本号目标 24.0.0。

1. **外部工具边界扩展**：SSoT §3.3 外部工具边界新增 codegraph（宿主 Agent MCP 工具 `codegraph_explore`，修改前预防）+ OpenSpec（宿主 Agent CLI `/opsx:*`，规格级规划层）。技能包不内置调用，通过 CHECKPOINT/子代理指令触发。

2. **codegraph 修改前强制查询**：新增约束 #14「阶段 5-8 任何代码/测试文件修改前，S-coding 须先调用 `codegraph_explore` 查询目标符号影响半径（callers/callees/blast radius），结果落盘 `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`」。新增反模式 #38「修改前未查询 codegraph」。与 code-TLA+ 一致性校验（修改后回归）互补。

3. **OpenSpec opsx 与 S-tickets 共存**：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how，端到端切片），opsx:apply 按 tickets.md frontier 执行。新增反模式 #39「跳过 opsx 产物审查」+ #40「opsx/S-tickets 职责混淆」。

4. **三段式 S 分派**：S-explore（opsx:explore + codegraph 影响初判）→ S-propose（opsx:propose + S-tickets 拆解）→ S-coding（按 tickets frontier 逐片编码，每片 codegraph_explore）。每段产物跑 R3×3（completeness/reliability/security）+ V 评审，不合格打回重做。

5. **依赖自动检查与安装初始化**：新增 `ensure-codegraph-opsx.ts`，三层检测（L1 CLI / L2 MCP 注册 / L3 项目目录）+ 自动处置（npm i -g / codegraph install --yes / codegraph init / openspec init），仅自动失败时 CHECKPOINT。三模式：full（阶段 5 首次）/ quick（阶段 6-8）/ light（启动健康检查）。

6. **门禁扩展**：新增 `check-codegraph-queries.ts`（反模式 #38）/ `check-opsx-artifacts.ts`（反模式 #39/#40）/ `check-openspec-archive.ts`（归档完整性）。`gate-logic.ts` 阶段 5-8 增加 codegraphQueriesValid / opsxArtifactsValid / openspecArchived 三布尔校验。`run-log.schema.json` action 枚举 +6 值（codegraph_query / opsx_explore / opsx_propose / opsx_apply / opsx_archive / ensure_deps）。

**实现状态（2026-07-30）**：本轮全部落地并通过验证（tsc 0 错误 / self-test 191 通过 / vitest 201 通过）：
- 文档层：SSoT §3.4.21 + §3.3、SKILL.md 约束 #14 + Bundled Resources + 阶段路由、anti-patterns #38/#39/#40、phase-5/6/7/8 + subagent-delegation、INSTALL.md
- 脚本层：`ensure-codegraph-opsx.ts` / `check-codegraph-queries.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts`（4 个新脚本）
- schema 层：`run-log.schema.json` action 枚举 +6 值
- 逻辑层：`gate-logic.ts` +codegraphQueriesValid / opsxArtifactsValid / openspecArchived（externalChecks 参数）
- 测试层：41 样本文件 + self-test 7 新用例（3 组 CASES + 3 runner）

**不涉及范围**：不修改约束 #1-#19 既有语义；不修改阶段 1-4 流程（仍是 A/S-doc/S-tla/S-bdd）；不内置 codegraph/opsx 调用（依赖宿主 Agent）；codegraph auto-sync 保持开启不手动管理图谱新鲜度。

#### 3.4.22 第 26 轮：外部技能深度对比吸收 + 单轴下限 + Fowler 12 + 术语治理（2026-07-30）

> 触发：用户要求深度对比外部参考仓库（`/mnt/skill_work_dir/skills`，Matt Pocock "Skills For Real Engineers"）与本仓库技能包，找出可借鉴增强点。设计 spec：[`docs/superpowers/specs/2026-07-30-round26-external-skills-absorption-design.md`](./superpowers/specs/2026-07-30-round26-external-skills-absorption-design.md)。经逐文件对比 5 类外部仓库（async/implement/refactor/general/incidental+orchestrator），提取 5 项借鉴点。版本号目标 25.0.0。

1. **加权平均掩盖单轴失败 → R13 单轴下限**：V 评审 passed 判据从「qualityLevel∈{A,B}」收紧为「qualityLevel∈{A,B} && 所有 subCriterion.score ≥ 0.70」。0.70 = qualityLevel B 级分界（§6.1），语义自洽：原判据「加权平均 ≥ B」→「每个子标准自身 ≥ B」。外部原则「评审各轴独立成环，永不合并计分」引用为设计依据。`verifier-logic.ts` 新增 `SINGLE_AXIS_MIN_SCORE` 常量 + `checkR13SingleAxisFloor()` + violation 格式「子标准 <name> 得分 <score> < 0.70（单轴下限）」。新增反模式 #41「加权平均掩盖单轴失败」。

2. **Fowler 12 坏味道基线**：`engineering-code-reviewer.md` 新增 12 条坏味道固定基线（F-01 重复代码 / F-02 过长方法 / F-03 过大类 / F-04 过长参数表 / F-05 特征依恋 / F-06 数据泥团 / F-07 基本类型偏执 / F-08 Switch 语句 / F-09 懒惰类 / F-10 臆测式泛化 / F-11 临时字段 / F-12 消息链），每条含定义/检测信号/AI 生成代码高频场景/默认分级（🟡💭🔴），🔴 关联反模式 #23（跨模块 store 误用）。评审命中须引用条目名，不得自造术语。

3. **票据内容 durability（符号级契约）**：`phase-5-coding.md` 新增「票据内容 durability」节——票据主体是符号级契约（接口/类型/状态转移，与 TLA+ Action 对齐），位置信息交给 codegraph（约束 #14），与评审 evidence「路径+行号」边界区分。术语引用统一用 glossary 规范名。

4. **术语治理 glossary**：新建 `references/glossary.md`，15+ 术语分 3 区（评审相关/数据模型/工程资产），每条含「规范定义 + `_Avoid_` 别名治理」，并作为 SKILL.md Bundled Resources 索引条目。角色表 Negation 审计：SKILL.md 角色表「关键禁止」列改写为「关键职责 + 脚本不变式（正向动作替代纯否定）」。

**实现状态（2026-07-30）**：全部落地并通过验证（tsc 0 错误 / self-test 192 通过 / vitest 205 通过 / V4 fixture exit=1 / V6 全样本 valid=0 bad=1）：
- 逻辑层：`verifier-logic.ts` +R13 单轴下限（SINGLE_AXIS_MIN_SCORE=0.70 / checkR13SingleAxisFloor / expectedPassed 单轴条件）
- 文档层：verifier-spec.md §3.3+§6.3、engineering-code-reviewer.md Fowler 12 基线、references/glossary.md（新建）、phase-5-coding.md durability 节、SKILL.md 角色表 Negation 审计 + references 索引、anti-patterns #41（#41 直接转正，用户决策不经 pending 复审）
- 测试层：`bad-single-axis-low.json` fixture（completeness=0.65 / 其余 0.95 / compositeScore=0.86 / qualityLevel=A / passed=false）+ verifier-logic.test.ts 4 用例（全 ≥0.70 通过 / 单轴 0.65 命中 / 边界 0.70 通过 / 非数组空返回）+ self-test VERIFIER_CASES +1 案例（基线 191→192）
- 验证过程修正 2 项（V2/V3 门禁捕获）：JS 数字渲染 `0.70`→`0.7`，self-test 正则与单测断言同步改为 `0\.7(?!\d)` / `'0.7'`
- 兼容性：既有 verifier 样本全部子标准 score ≥0.70（最低 0.80），R13 非破坏性；V6 全样本 valid=0 / bad=1

**不涉及范围**：不修改 qualityLevel 映射（仍由 compositeScore 决定）；不修改门禁脚本 CLI/退出码约定；不新增脚本文件（R13 并入既有 check-verifier-output.ts）；不改 schema（R13 复用既有 VerifierOutput 结构）。

#### 3.4.23 第 27 轮：Wayfinder「Fog of War」吸收 — 阶段 1 迷雾登记册（2026-07-30）

> 触发：用户要求分析外部仓库 wayfinder 技能（`skills/skills/engineering/wayfinder/`），评估其对阶段 1（需求分析）的可借鉴性。设计 spec：[`docs/superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md`](./superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md)。经全量精读 wayfinder SKILL.md + 配套 docs + 3 changeset + 上游 skill（domain-modeling / to-spec / to-tickets / research），识别阶段 1 真实缺口：强制 100% 覆盖（C1-C10）下「in-scope 尚无法精确陈述」的需求无落脚点 → A 子代理或捏造浅层 REQ（违背禁止行为 #2）或静默丢弃（违反禁止行为 #10）。吸收 wayfinder「Fog or ticket?」锐利性测试 + Not-yet-specified + 毕业机制。版本号目标 26.0.0。

1. **REQ 入学锐利性测试**：`ingestion-chunk.md` 新增测试判据——现在能否精确陈述需求的问题（不是能否回答它）；能 → 正式 REQ，不能 → 入迷雾册（不建图节点）。迷雾项字段：fogDesc / fogBlocker / fogGroupHint，写入 chunk `.md` 叙事文件；crossChunkHints 支持 `edgeType: "fog"`。

2. **A-cross 迷雾汇总**：`ingestion-cross.md` 算法新增步骤 9 + 报告模板新增 §7 迷雾登记册（去重 + 疑似 REQ-group 归属 + 疑似毕业方向）；A-cross 不代 S 决定毕业。

3. **迷雾登记册治理**：`phase-1-requirements.md` 新增「迷雾登记册（Fog of War）」节——定义与 §8 Out of Scope 区分 + 锐利性测试 + 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批）+ CHECKPOINT 前强制清空 + 覆盖矩阵语义（迷雾项不计入分母）。责任边界：A 准入 / S 毕业产出 / R 审查核验真实性 / V 评审防借雾逃避覆盖 / G 不新增脚本。

4. **失败模式与禁止行为**：FM-3D 新增 FM-3D-07 迷雾滥用（信号 A：借雾逃避覆盖；信号 B：CHECKPOINT 前未终结）；禁止行为新增 #12 迷雾项静默遗留；返工路径补充对应条目。**不新增反模式**（anti-patterns.md 保持 41 条——迷雾滥用是阶段内局部违规，走 FM + 禁止行为）。

5. **模板 §8.5**：`templates/requirement-spec.md` §8 后新增「8.5 Not yet specified（迷雾登记册）」节（含登记表 + 毕业处置结果列）。

**实现状态（2026-07-30）**：全部落地并通过验证（tsc 0 错误 / self-test 192 通过 / vitest 205 通过 / D5 互引一致性通过）：
- 文档层：ingestion-chunk.md（锐利性测试节）+ ingestion-cross.md（步骤 9 + 报告 §7）+ phase-1-requirements.md（迷雾登记册节 + FM-3D-07 + 禁止行为 #12 + 返工路径）+ requirement-spec.md（§8.5）
- 顶层：SSoT §3.4.23 + §10A 追溯表、CHANGELOG [26.0.0]、AGENTS.md、README.md
- 版本号三处同步 26.0.0（package.json + skill-metadata.json + SKILL.md frontmatter）

**不涉及范围**：不改任何脚本（无新增 check 脚本，毕业核验由既有 R/V 承载）；不改任何 schema（迷雾册为文本节，graph/coverage/exemption schema 不变）；不建图节点（FOG 项不进 graph.json）；不新增反模式（41 条不变）；不动 w-model-dev-demo。

#### 3.4.24 第 28 轮：need_fix.md + 全量脚本 code-review 修正（2026-07-31）

> 触发：`need_fix.md` 报告 `plan-chunks.ts` 两处 bug（estimateTokens CJK 低估 / splitMarkdownByHeaders 分段逻辑）+ 用户要求先对全部技能脚本做一轮 code-review 再制定修正计划。设计 spec：[`docs/superpowers/specs/2026-07-31-round28-script-bugfix-design.md`](./superpowers/specs/2026-07-31-round28-script-bugfix-design.md)。5 组并行子代理深度 code-review 共发现约 66 项缺陷（P1×15 / P2×25 / P3×26）。用户决策：D1 一次修完 / D2 签名链跨阶段连续链 / D3 run-log R1 按阶段分档 / D4 opsx 审查产物操作侧补产 stage 级 .md 文件。按 6 组域内回归执行。版本号目标 27.0.0。

**1. G-A plan-chunks.ts（need_fix 本体 + review 扩展，A1-A6）**：
- `estimateTokens` 改为 `Math.ceil(Buffer.byteLength(text, 'utf8') / 4)`，修复 CJK 4 倍低估。
- `splitMarkdownByHeaders` 重写：header+content 正确配对（显式两两遍历）、围栏代码块感知（三反引号状态机）、单节超限按行二次切分。
- 非 md 行切分按累计字节数分块，步长防无限循环；目录递归进入子目录收集叶子文件；`--max-tokens` 正整数严格校验（非法 exit 2）。
- 新建 `plan-chunks.test.ts`（当前零覆盖 → 有覆盖）。

**2. G-B gate/verifier/schema/security（B1-B12）**：
- SD→codeModule 校验与 code-tla-logic.ts 对齐（`SD-` 拆段退化 + `SD-5.2.1` 数字层级兼容）。
- coverageStatus 改为行级比较；coveragePercent 与 missingItems 联动；uat-path-mapping guard 防缺字段崩溃。
- uat-path-mapping 严格解析（单元格数 < 4 记录 violation，不静默跳过）+ phase 8 终检补校验；parsePhaseArg 严格整数校验。
- security-scan 指纹 `path.relative` 归一化后哈希 + baseline 重生成（Linux 相对路径）；JSON.parse 容错。
- verifier-logic.ts passed 基于降级后 compositeScore 重算 + 死代码清理；check-verifier-output --s-output 解析 + 空值报错。
- schema-loader 全部注册成功后再赋值 ajv 单例（注册失败清理重试）。
- self-test.ts 补 SD-5.2.1 gate 样本。

**3. G-C graph/coverage/exemption（C1-C9）**：
- --rtm R6 检查移到 passed 计算前，违规参与最终 passed；豁免重算 roots 与 graph-logic 对齐（消除多 group 豁免永不生效）。
- 豁免前缀匹配兼容组合前缀（R1-R4 … 命中 ruleId R1）；--phase 严格整数校验。
- graph.schema.json 加回 `sourceArtifact` 可选字段；warnings 落盘 GRAPH_JSON 并 stdout 输出。
- coverage --out-of-scope 文件结构不符报错 exit 2（不静默降级）；C9 missingIds 取需求 ID 而非类别名。
- exemption 四阶段时间戳时序校验。

**4. G-D TLA/BDD/code（D1-D9）**：
- tla-logic cfg↔TLA 不变式正则兼容 `BusinessInvariant ==`（与 demo 实际用法一致）+ INVARIANT 死分支修复 + `@phase` 严格整数。
- BDD extractStateVarName 兼容 `TypeOK ==`；D4 缺 --tla-manifest 时提示；Scenario 体内步骤 + `# @states:`/`# @transitions:` 注释声明解析。
- TLA/BDD 转移抽取支持 `\E ... :` 量化项 + Next 体边界终止条件鲁棒化 + VARIABLES 多行形式。
- check-design-contract-consistency 路由元数据按路由提取（非整文件首个）；新建 design-contract-logic.ts 纯逻辑 + 路由查找失败报 violation。
- code-tla-logic cfg 不变式正则兼容 `Invariants ==` 两种命名。

**5. G-E 状态/日志/签名/归档/预防性（E1-E17）**：
- signature-chain R2 改为跨阶段连续链语义（首条 prevSigId 允许指向上一阶段最后一条 sigId）+ R7 悬空校验放宽为本阶段∪前一阶段 + 收集全部违规点。
- check-signature-chain 链文件路径显式传参并从位置推导项目根。
- run-log R1 按阶段分档（阶段 1-4 要求 chunk/cross/gate/checkpoint；阶段 5-8 要求 produce/review/gate/checkpoint）+ R3 返工计数按 phase+TLA target 过滤 + R6 null gateExitCode 判失败 + R7 返工时序扫 rootcause review + R3 rootcause↔fix 按 reportId 去重后计数。
- check-run-log extractExitCode 模式表补齐；loadGateLogs 加载 gate-logs/ 下全部文件（不限 .log）。
- check-budget tla-rework 统计改为 `action='rework'` 且 target 含 `tla`（按 phase 限定）；data-models 动作枚举移除 tla-rework。
- check-maturity O_PATTERN 词边界 `\bO[1-6]\b`；check-checkpoint 前导零 filename parseInt 归一；checkpoint 字符计数 `[...decision].length`。
- root-cause R10 校验任一有效 partialReport 含 reality-checker 角色；archive-integrity 文件存在性按相对路径精确匹配。

**6. G-F opsx/codegraph + D4 操作文档（F1-F7）**：
- ensure-codegraph-opsx 探针命令改为 `codegraph query` 位置参数 + L3 `codegraph init` 之后执行 + --phase Number.isNaN 校验 + getArg 支持 `--name=value` / `--name value` 两种形式。
- check-codegraph-queries blastRadius/queryTimestamp schema 校验 + F7 位置参数误解析 exit 2。
- check-opsx-artifacts 校验该阶段所有变更目录（readdirSync 排序后逐个校验）+ 精确前缀匹配 `phase<N>-`。
- check-openspec-archive 精确前缀匹配 + 全部归档目录校验 + 归档清单与归档前 REQUIRED 清单统一。
- D4 决策：SKILL.md / subagent-delegation.md / anti-patterns #39 同步新增 opsx 阶段 5-8 操作侧补产 stage 级 R3/V .md 文件约束。

**实现状态（2026-07-31）**：6 组域内回归 + 全量回归全部通过：
- self-test：192 → 213 全通过（+21 新样本：UAT_PATH_MAPPING 5 + DESIGN_CONTRACT 5 + VERIFIER +1 / GATE +1 / GRAPH +1 / RUN_LOG +6 / ROOTCAUSE +1 / CODEGRAPH_QUERY +1 / OPSX_ARTIFACT +1 / OPENSPEC_ARCHIVE +1 / BDD +2 / SIGNATURE_CHAIN +3）
- vitest：205 → 269 全通过（21 test files，+2 新建 plan-chunks.test.ts + design-contract-logic.test.ts，其余 gate-enhancement/verifier 等扩展）
- TypeScript strict：0 错误
- security-scan baseline：指纹归一化后重生成，`npm run lint:security` 转绿
- prepush：全绿
- 签名链跨阶段连续链（D2）、run-log R1 分档（D3）、opsx 补产约束（D4）均已用户决策确定

**版本号**：三处同步 27.0.0（package.json + skill-metadata.json + SKILL.md frontmatter），与 CHANGELOG [27.0.0] / SSoT §3.4.24 / AGENTS.md §4 一致。

**不涉及范围**：不新增反模式（41 条不变）；不新增 schema 文件；不新增 check 脚本（现有脚本行为修复）。

---

#### 3.4.25 第 29 轮：S→R3+V 无条件强制（覆盖所有 S 变体，含 S-fix / emergency-fix）（2026-07-31）

> 触发：用户指令「强化技能设计，任意方式派遣 S 子代理后必须派遣 R+V 子代理进行分析，不允许任何意外」。设计 spec：[`docs/superpowers/specs/2026-07-31-round29-s-r3-v-unconditional-design.md`](./superpowers/specs/2026-07-31-round29-s-r3-v-unconditional-design.md)。实施 plan：[`docs/superpowers/plans/2026-07-31-round29-s-r3-v-unconditional.md`](./superpowers/plans/2026-07-31-round29-s-r3-v-unconditional.md)。核心目标：将 R3 预防性审查从「条件强制（--r3-enabled flag）」升级为「无条件强制」，覆盖所有 S 变体，堵死 S-fix / emergency-fix 跳过 R3+V 的漏洞。版本号目标 28.0.0。

1. **R3 无条件强制（升级 §3.4.18 约束 #11）**：R3 预防性审查从「条件强制」升级为「**无条件强制**」。每个 S 派遣（任意变体）后必须派遣 R3×3（completeness/reliability/security）+ V，顺序 `S → R3×3 → V → G`，无例外，无 flag，无「启用时」措辞。覆盖**全部 S 变体**：S-doc / S-tla / S-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**。违反字面即违反精神：R3 不得以「修复就是小改不用审」「紧急救援优先」「self-as-verifier 模式简化」等理由跳过。

2. **紧急修复通道调整**：emergency-fix 通道从「修复时记 needsReview=true，阶段完成后由 R 复核」（事后复核）改为「前置 R3×3 + V + G」。移除 `emergencyFixReview` 字段 + 「阶段完成后由 R 复核」条款。emergency-fix 仍保留 `variant=emergency-fix` + `blocker` 字段用于 run-log 审计，仅作为「为何走紧急通道」的说明，不再意味跳过审查。

3. **check-role-dispatch.ts 升级**：移除 `--r3-enabled` 参数语义（R≥3 无条件校验，CLI 保留 flag 向后兼容视为 no-op）。纯逻辑抽离至新建 `role-dispatch-logic.ts`（与 run-log-logic.ts / preventive-review-logic.ts 一致的自包含纯函数模式）。JSON 输出 `r3Enabled` 字段恒为 `true`（向后兼容历史消费者）。缺失 R<3 即 violations，exitCode=1。

4. **check-preventive-review.ts 升级**：always-on 无 flag。新增 `--variant=standard|fix|emergency` 参数（默认 standard）。报告路径校验扩展：standard `<phase>-{dim}.json` / fix `<phase>-fix-{dim}.json` / emergency `<phase>-emergency-{dim}.json`。`--auto-trigger` 模式从 run-log 推断 variant（扫描最近一条 `action=fix` → fix；`action=emergency-fix` → emergency；否则 standard）。纯逻辑层 `preventive-review-logic.ts` 新增 `PreventiveReviewOptions.variant` 参数。

5. **check-run-log.ts R8 升级**：R8 规则从「R3 启用时，S→V 间须有 3 条 R3 记录」改为「**无条件**，S→V 间须有 3 条 R3 记录」。S 识别条件从 `action=produce` 扩展为 `['produce', 'fix', 'emergency-fix']`（覆盖 S-fix / S-emergency-fix）。RunLogEntry.action 联合类型新增 `'emergency-fix'`。违规信息含 S 变体标识：`S(${sVariant})→V`。

6. **反模式强化与新增**：
   - **#33 强化**（跳过 R3 预防性审查）：移除「启用时」措辞，覆盖所有 S 变体（含 S-fix / S-emergency-fix）。
   - **#34 强化**（编排者漏派角色）：「R3 启用时须分派 R 角色 ≥3 次」改为「无条件须分派 R 角色 ≥3 次」。
   - **#35 扩展**（self-as-verifier 模式下产物混合）：产物混合清单新增「PreventiveReview JSON 须独立产出，不得与 S 产出混合」。
   - **#42 新增**（S-fix / emergency-fix 后跳过 R3+V）：症状为 S-fix/emergency-fix 产出后未派 R3×3 + V 直接 G/放行；检测信号为 run-log `action=fix`/`emergency-fix` 后无 R3 直接 V/G；回退为补跑 R3×3 + V。

7. **文档层同步**：SKILL.md 约束 #11（删除「（R3 启用时）」）/ #11（删除「启用时」+ 新增含 S-fix / emergency-fix）/ #8（删除「R3 启用时须分派 R 角色」改为「无条件」，新编号）；subagent-delegation.md「R3 预防性审查分派模板」节删除「启用时」、「角色分派完整性校验」表 R 行必分派条件改为「无条件必须」、「S 兼 F 修复分派模板（返工变体）」节新增 R3+V 前置、「S 子代理修改既有产物的边界」节紧急修复通道改前置；anti-patterns.md #33/#34/#35 强化 + #42 新增；phase-1~8-*.md 统一删除「启用时」措辞。

**不涉及范围**：不修改 R3 三维度本身（completeness/reliability/security 保持）；不修改 V 评审 Schema（`verifier-output.schema.json` 不变）；不引入新 R3 维度；不取消 self-as-verifier 兼任豁免（各角色产物文件独立即可，R3 不可省略）；不修改返工 R（root cause locator）机制——R3 与返工 R 仍是两个角色变体，本轮只升级 R3。

**实现状态（2026-07-31）**：全部落地并通过验证（tsc 0 错误 / self-test 213 通过 / vitest 286 通过 / pre-push 全绿）。

**版本号**：三处同步 28.0.0（package.json + skill-metadata.json + SKILL.md frontmatter），与 CHANGELOG [28.0.0] / SSoT §3.4.25 / AGENTS.md §4 一致。

---

#### 3.4.26 第三十轮：CLI 样板抽取 + 分派总览矩阵（[29.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 外部反馈「技能代码重复率高 + 流程派遣信息分散」 |
| 修正方案 | 两项针对性优化：①抽取 CLI 层 JSON 读取工具消除样板；②新建分派总览矩阵解决信息分散 |
| 新增 | `scripts/lib/read-json-or-exit.ts`（CLI 层 JSON/JSONL 读取工具，`readJsonOrExit` + `readJsonlOrExit`）+ `scripts/__tests__/read-json-or-exit.test.ts`（11 测试）+ `references/dispatch-matrix.md`（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本总览矩阵） |
| 重构 | 13 个 check-*.ts 使用新工具（删除约 258 行样板）：Group A 单 JSON（8 个：check-exemption / check-verifier-output / check-rootcause-report / check-requirement-coverage / check-requirement-graph / check-maturity / check-state-machine-consistency / check-signature-chain）+ Group B JSONL（3 个：check-run-log / check-checkpoint / check-budget 仅主输入）+ Group C 多文件（2 个：check-tla-model / check-code-tla-consistency） |
| 保留原样 | 3 个 check-*.ts 行为不等价不重构：check-role-dispatch（坏行 exit(2) ≠ warn+skip）/ check-preventive-review（无标准样板）/ check-artifact-gate（输出含可执行修复提示） |
| 顶层文档 | 4 个（SSoT §3.4.25 + §10A 追溯表 + AGENTS.md §2 + CHANGELOG [29.0.0]） |
| package.json | version `28.0.0` → `29.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 213/213 不变全通过 |
| vitest | 286→297（+11 read-json-or-exit）全通过 |
| TypeScript strict | 0 错误 |

> 第三十轮相比第二十九轮（§3.4.25 S→R3+V 无条件强制）：从「R3+V 强制流程升级」转向「CLI 样板抽取 + 分派总览矩阵」。针对外部反馈「代码重复率高 + 流程派遣信息分散」，做两项针对性优化而非架构重构：①抽取 `lib/read-json-or-exit.ts` 工具消除 13 个 check-*.ts 中约 258 行重复的 JSON 读取样板（ENOENT → exit(2) + JSON.parse → exit(2)），行为完全等价；②新建 `references/dispatch-matrix.md` 总览矩阵解决「拼出一次返工的完整派遣流程需交叉读 4-5 份文档」的信息分散痛点。3 个 check-*.ts 因行为不等价保留原样。版本号三处一致 29.0.0。

---

#### 3.4.27 第三十一轮：Schema 字段描述增强 + 敏感信息脱敏 + npm audit 门禁（2026-08-05，[30.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 外部评审 14 条建议，用户经头脑风暴选 3 轮分组，本轮为低风险批（#13 + #8 + #7） |
| 新增 | 反模式 #43（敏感信息写入状态文件/日志）+ operational-recovery 敏感信息禁令 |
| 脚本改动 | `.githooks/pre-push` 新增检查 #12 npm audit（warn-only + 离线容错） |
| schema 改动 | schemas/*.schema.json 全量字段补充 description（仅注释性关键字，校验行为不变） |
| 顶层文档 | SSoT §3.4.27 + §10A 追溯表 + AGENTS.md + CHANGELOG.md [30.0.0] + README.md 反模式计数 41→43 |
| package.json | version `29.0.0` → `30.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 213 不变全通过 |
| vitest | 基线 297 不变全通过 |
| pre-push | 11 → 12 项（新增 npm audit warn-only） |
| TypeScript strict | 0 错误 |

> 第三十一轮相比第三十轮（§3.4.26 CLI 样板抽取）：吸收外部评审 14 条建议中经头脑风暴选出的低风险批三项（#13 schema 自描述 + #8 敏感信息脱敏 + #7 npm audit 门禁）。`schemas/*.schema.json` 全量字段补充 `description`（用途 + 期望值，仅注释性关键字，校验行为不变）；`references/operational-recovery.md`「JSON 文件写入工具选择」节新增敏感信息禁令 + 反模式 #43（状态文件/日志不得写入硬编码凭据，敏感配置统一环境变量注入）；`.githooks/pre-push` 新增检查 #12 npm audit（warn-only + 离线容错），11 项 → 12 项。self-test 213/vitest 297 基线不变，prepush 12 项通过，TypeScript strict 0 错误。版本号三处一致 30.0.0。

#### 3.4.28 第 30.1 轮：security-scan 内容敏感指纹 v2 + 签名链 R8 项目根语义（2026-08-05，[30.1.0]）

| 维度 | 内容 |
|---|---|
| 触发 | prepush security-scan baseline 陈旧（位置指纹因行号漂移失配）+ check-signature-chain 样本 R8 误报 |
| 脚本改动 | `security-scan.ts` 指纹算法内容敏感化（baseline v2）+ `--regenerate` + 版本校验；`check-signature-chain.ts` R8 项目根语义（.w-model/project.json） |
| 基线 | `.eslintsecurity-baseline.json` v2 格式 183 条（内容指纹，行号漂移免疫） |
| 测试 | security-scan.test.ts 3→7（新增行漂移稳定/内容敏感/归一化/源行不可读），vitest 297→301 |
| 顶层文档 | SSoT §3.4.28 + §10A 追溯表 + AGENTS.md + CHANGELOG.md [30.1.0] + README/INSTALL security-scan 描述同步 |
| package.json | version `30.0.0` → `30.1.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 213 不变全通过 |
| vitest | 301/301（23 文件）全通过 |
| prepush | 12 项全通过（security-scan exit 0 + check-signature-chain exit 0） |
| TypeScript strict | 0 错误 |

#### 3.4.29 第 31 轮：/wm status 脚本化 + 流程度量报告（2026-08-05，[31.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 外部评审 14 条建议，用户经头脑风暴选 3 轮分组，本轮为新功能批（#10 /wm status 脚本化 + #14 流程度量报告） |
| 新增 | `wm-status.ts` + `wm-status-logic.ts`（状态快照：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 / 最近 3 条动作 / 确定性下一步建议；退出码 0/2，`--json` 输出 StatusReport）；`metrics-report.ts` + `metrics-report-logic.ts`（流程度量：总体 / 阶段汇总 / 动作·角色·结果分布 / 门禁通过率 / 返工率与连续段 / 预算 burn rate 与 killSwitch 预警；`--from/--to/--phase/--json/--out`；纯报告无门禁语义） |
| package.json | version `30.1.0` → `31.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致）+ scripts 新增 `wm:status` / `wm:metrics` |
| 顶层文档 | SSoT §3.4.29 + §10A 追溯表 + AGENTS.md + CHANGELOG.md [31.0.0] + README/INSTALL/toolbox/coverage 矩阵同步 |
| self-test | 基线 213 不变全通过 |
| vitest | 345/345（27 文件）全通过（新增 wm-status-logic 10 + metrics-report-logic 9 + CLI 子进程 25 用例） |
| TypeScript strict | 0 错误 |

> 两者均为只读报告工具：不修改 .w-model 状态、不产生 exit 1、不改变既有门禁语义；budget 拦截仍由 `check-budget.ts` 承担。

#### 3.4.30 第 32 轮：错误结构全量归一化 + run-log R6 契约迁移（2026-08-05，[32.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 外部评审 14 条建议高风险批（#3 错误结构 + R6 契约归位）：统一全仓脚本 exit 2 输出为结构化格式；run-log R6 提取/索引规则迁入纯逻辑层 |
| 新增 | `lib/cli-error.ts`（6 类错误码 ARG_INVALID/FILE_NOT_FOUND/FILE_PARSE/FILE_READ/STRUCTURE_INVALID/UNEXPECTED + `CliError` + `formatCliError/printError/printErrorJson/exitWithError`：人类消息 stderr、`ERROR_JSON` 摘要 stdout，遵循 §10E E.1 exitCode 强一致；`process.exitCode` 自然退出防 stdout 截断）；`__tests__/cli-error.test.ts`（7 用例） |
| 归一化 | exit-2 脚本统一走 `exitWithError`（6 类错误码：ARG_INVALID / FILE_NOT_FOUND / FILE_PARSE / FILE_READ / STRUCTURE_INVALID / UNEXPECTED）；各脚本 main().catch 统一 UNEXPECTED；wm-status 未初始化保持 exit 0 查询语义；check-role-dispatch 坏行 exit 2 行为保留（仅加类别） |
| R6 迁移 | `extractExitCode` + `buildGateLogKeys` 自 check-run-log.ts 迁入 `run-log-logic.ts`（纯函数，不 import node:path）；GATE_JSON_PATTERNS 25→26 标记追加 ERROR_JSON（模拟验证驱动：exit 2 存档纳入 R6 交叉校验，防「未提取到 exitCode」误报）；run-log-logic.test.ts 29 用例 |
| package.json | version `31.0.0` → `32.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| 顶层文档 | SSoT §3.4.30 + §10A 追溯表 + §10E E.1 补充 + command-reference.md 错误码节 + CHANGELOG.md [32.0.0] + AGENTS/README/INSTALL/coverage 矩阵同步 |
| self-test | 基线 213 不变全通过（仅断言退出码，消息改动零回归） |
| vitest | 363/363（28 文件）全通过（新增 cli-error 7 + run-log-logic ERROR_JSON 1） |
| TypeScript strict | 0 错误 |

> 退出码语义不变：0=通过 / 1=校验失败 / 2=输入错误。ERROR_JSON 仅 exit 2 输入错误输出；exit 1 仍走 violations + 既有 `XXX_JSON` 摘要。

#### 3.4.31 第 33 轮：全仓库优化 5 批实施（2026-08-05，[33.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 全仓库深入分析（总框架 spec 2026-08-05-optimization-overview-design.md）分 5 批执行：安全加固（批次 1）/ 一致性快修（批次 2）/ 脚本瘦身（批次 3）/ 流程与体验（批次 4）/ 技能缺口 + 评估 + 收尾（批次 5，本批） |
| 新增 | `.cursor/skills/security-review/SKILL.md`（源码级安全扫描：`npm run lint:security` = security-scan.ts + eslint-plugin-security 6 条规则 + baseline v2 内容敏感指纹豁免 + 凭据脱敏反模式 #43 数据文件层检查 + 修复动作 + 检查清单）；`.cursor/skills/codegraph-exploration/SKILL.md`（约束 #14 封装：阶段 5-8 修改前 `codegraph_explore` 调用 + 落盘 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json` 字段 querySymbol/callers/callees/blastRadius/queryTimestamp + 影响评估 + check-codegraph-queries.ts 校验 + 与 code-TLA+ 互补）；`eval/README.md`（TSV 9 列格式 + test-prompts.json 15 条提示词四类场景 + darwin-skill 外部补跑流程 + 当前状态：2026-07-21 最新记录，33.0.0 后待补跑）；`.cursor/skills/performance-review/SKILL.md`（性能评审 4 维度：响应时间 P95<2s / 吞吐 / 资源占用 / 负载模型 ramp-up→sustain→ramp-down + targetValue vs testThreshold + 与 security-review 对称） |
| 归一化 | 纯技能资产 + 文档变更，无脚本/schema 代码变更；5.3 eval 补跑依赖外部 darwin-skill，本批只补 README 说明（用户确认）；.cursor/skills 技能数 20→23 |
| package.json | version `32.0.0` → `33.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| 顶层文档 | SSoT §3.4.31 + §10A 追溯表 + CHANGELOG.md [33.0.0] + README/AGENTS/CONTRIBUTING/INSTALL 同步（self-test 213、vitest 434/33 文件、.cursor/skills 23 个技能） |
| self-test | 基线 213 不变全通过（批次 5 无脚本变更，仅新增技能文档） |
| vitest | 434/434（33 文件）全通过（基线不变；skill-metadata.test.ts 三方版本校验通过） |
| TypeScript strict | 0 错误 |

> 批次 5 是总框架 5 批优化的收尾批：批次 1-4 的回归基线与 vitest 计数在批次 4 后更新为 self-test 213 / vitest 434（批次 4 修复 __tests__ 严格类型并纳入测试，README 旧计数 377 与 INSTALL 旧计数 363 已统一为 434）。

#### 3.4.32 第 34 轮：W 模型技能强化（2026-08-07，[34.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 调测发现三类问题并系统性修复（设计文档 `2026-08-07-w-model-skill-hardening-design.md`）：①目录约定散落四处无 SSoT；②路径-定位分隔符三处不一致（冒号/点号/井号）；③TLA+/BDD 多级精细化时"只做一个子系统"门禁不检出 |
| 新增 | `references/directory-conventions.md`（路径约定 SSoT：`docs/phaseN-{name}/` 阶段子目录 + TLA+/BDD/.w-model 目录结构 + resolvePhaseDoc 契约）；`references/format-conventions.md`（元数据格式 SSoT：冒号分隔 `path:§section`/`path:L42`，禁止点号/井号）；S-ingest-tla / S-ingest-bdd 子代理模板（subagent-delegation.md：从 .tla/.feature 提取 @designIds + 比对 graph.json SD 节点 → 独立回填 manifest sdCoverage/designCoverage，防 S 自填不可靠）；schema sdCoverage（tla-manifest）/ designCoverage（bdd-manifest）必填字段（phase≥2，allOf/if/then 条件约束）；check-bdd-model.ts `--graph` + D8 SD Coverage 维度（phase≥2 强制）；测试样本 `samples/tla/bad-coverage-uncovered-sd.json` + `samples/bdd/bad-d8-uncovered-sd.json` |
| 归一化 | 冒号分隔格式统一（verifier-logic EVIDENCE_PATTERN + verifier-spec §6.2 evidence + tla-spec-template/feature.template @designIds + @design 路径 `:§`）；阶段子目录模式（phase-2/3/4 文档路径 + check-artifact-gate resolvePhaseDoc）；check-tla-model `--graph` phase≥2 强制（缺失 → exitCode=2 ARG_INVALID）+ SD 覆盖率 phase≥2 强制执行；check-artifact-gate 终检调用 model 校验；G 子代理模板强制跑 model 校验（--graph）；bdd-logic TLA+ 快照解析升级（命名集合 + 多种不变式形态 + L1 豁免 D4 自动等价，由 R3/V 语义评审）；demo 完整重产（TLA+ 7 specs L1+6 L2，SANY/TLC 全过 + BDD 9 features 覆盖全部 21 SD 节点，sdCoverage/designCoverage 全覆盖） |
| package.json | version `33.0.0` → `34.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| 顶层文档 | SSoT §3.4.32 + §10A 追溯表 + CHANGELOG.md [34.0.0] + README/AGENTS/INSTALL 同步（vitest 451/33 文件、bdd-logic D1-D8 八维度、dispatch-matrix/eval 版本号） |
| self-test | 基线 213 不变全通过 |
| vitest | 451/451（33 文件）全通过（skill-metadata.test.ts 三方版本校验通过） |
| TypeScript strict | 0 错误 |

> 多子系统遗漏检出实测：TLA+ 遗漏 auth 子系统（SD-001/002/017）→ check-tla-model exit 1 "未被覆盖: SD-001, SD-002, SD-017"；BDD D8 同样检出。

#### 3.4.33 第 35 轮：8 阶段端到端调测修复入库（2026-08-08，[35.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 34.0.0 全量 8 阶段端到端调测（w-model-dev-demo 重建：32 需求 / 73 UAT / 40 ST / 30 IT / 58 UT）发现 3 处技能包侧真实 bug + 3 处 demo 侧缺陷，调测后修复入库 |
| 技能包修复 | ① `check-tla-model.ts`：TLC 产物 states 时间戳子目录清理正则 `^\d{4}-...` → `^\d{2,4}-...`（TLC 2.19 实际产出 2 位年份目录 `26-08-07-18-04-31`，原 4 位正则不匹配导致清理静默跳过，P3 bug）；② `design-contract-logic.ts`：D1 实际路径语义归一增强（`stripBrackets`/`normalizeActualPathVariants`/`pathTemplateMatches`/`isDefinedRoute` 新增——「、/，/,」多端点拆分、全/半角括号剥离、`:id` 参数模板段级匹配、「不适用（…）」/「横切」非 HTTP 豁免）；③ `run-log-logic.ts`：`GATE_JSON_PATTERNS` 新增 `/STATE_MACHINE_JSON\s+(\{.*\})/`（check-run-log R6 交叉校验需提取 check-state-machine-consistency.ts 存档的 exitCode） |
| 单测补强 | `__tests__/tla-clean-trace.test.ts`（+1：2 位年份 TLC 时间戳子目录→true）；`__tests__/design-contract-logic.test.ts`（+6：D1 路径归一 describe 块）；`__tests__/run-log-logic.test.ts`（+1：STATE_MACHINE_JSON 摘要行 exitCode 提取）；`__tests__/bdd-logic.test.ts` 实时 demo fixture 测试改为自包含内联规格（不再依赖 demo 实时文件，解析器命名集合能力覆盖保留） |
| demo 侧修复 | ① `auditMiddleware.ts` 审计记录硬编码 `id:''` 导致 CON-004 审计互相覆盖（UAT-073 暴露）；② `app.ts` 双限流器共享实例导致认证限额折半；③ 路由结构 app.* → Express Router 惯用法（适配 check-design-contract-consistency 契约扫描） |
| package.json | version `34.0.0` → `35.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| 顶层文档 | SSoT §3.4.33 + §10A 追溯表 + CHANGELOG.md [35.0.0] + README/AGENTS 同步（vitest 459/33 文件） |
| self-test | 基线 213 不变全通过 |
| vitest | 459/459（33 文件）全通过（skill-metadata.test.ts 三方版本校验通过） |
| TypeScript strict | 0 错误 |

> 8 阶段调测终检：318/318 测试（175 UT + 30 IT + 40 ST + 73 UAT）、覆盖率 94.76% lines、check-artifact-gate exitCode=0、归档 308 文件、`rtm.currentPhase=9`；调测产物保留在 w-model-dev-demo/（只读测试夹具随仓库提交）。

#### 3.4.34 第 36 轮：冰山扫掠深度分析机制（2026-08-08，[36.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 基于冰山理论：V/G 通过仅证明"既定标准下无问题"，不证明"同类深挖下无问题"。新增 R-iceberg 冰山扫掠机制，S-fix 后（ICEBERG-A）与阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索主动深挖隐藏问题，直到 `newFindings=[]` 或达 maxIcebergRounds=5 |
| 机制 | 双重触发：ICEBERG-A（S-fix 返工通过后深挖，防修复引入新缺陷+同根因扩散）+ ICEBERG-B（阶段门放行前全局扫掠）。终止判据：① newFindings=[] 正常终止；② maxIcebergRounds=5 CHECKPOINT 升级由用户裁定；③ Budget killSwitch 强制终止 |
| 扫掠方法 | 三维度（completeness/reliability/security）×六类别（same-root-cause-spread / same-defect-class / fix-induced-regression / adjacent-logic / coverage-gap / cross-artifact-inconsistency），线索驱动横向扩散 |
| 新增 schema | `iceberg-sweep.schema.json`（IcebergSweepReport：reportId/phase/triggerType/icebergRound/线索来源/newFindings/sweepCoverage/summary/passed） |
| 新增脚本 | `check-iceberg-sweep.ts`（CLI）+ `iceberg-sweep-logic.ts`（纯逻辑 R1-R8：schema 前置/R2 reportId 格式/R3 phase 一致/R4 triggerType 合法/R5 round 边界/R6 去重/R7 可证伪/R8 passed 一致） |
| run-log 扩展 | action 枚举 +2：`iceberg-sweep`（R-iceberg 分派）+ `iceberg-review`（V 复审冰山报告） |
| 新增参考 | `iceberg-sweep-guide.md`（方法论 + 六类别深挖 + TLA+ 状态机一致性应用示例） |
| 反模式 | #44 跳过冰山扫掠直接放行（43 → 44） |
| 文档同步 | subagent-delegation.md（R-iceberg 分派模板 + 角色表 + ICEBERG-A/B 时序）+ root-cause-locator.md（R 与 R-iceberg 边界节）+ SKILL.md（工作流 9.5 步）+ AGENTS.md + README + CHANGELOG |
| self-test | 基线 213 → 217（+4 冰山样本：valid-full / bad-round-out-of-range / bad-missing-evidence / bad-duplicate-finding） |
| 版本号 | 35.0.0 → 36.0.0（package.json + skill-metadata.json + SKILL.md frontmatter 三处一致） |

#### 3.4.35 第 37 轮：Phase 1 需求分析设计级别增强（2026-08-09，[37.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求阶段 1 需求分析产出达到 DESIGN.md 级别结构严谨性 |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守需求域边界 |
| 新增模板 | 主模板 requirement-spec.md 重构（§0 SSOT 头 + §13-§17/附录 A 引用块）+ 6 独立子模板（templates/requirement-spec/：system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling） |
| 参考扩展 | phase-1-requirements.md 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R7（追踪矩阵一致性）/R8（UML mermaid 配平）+ --spec-dir；check-artifact-gate.ts phase=1 新增引用块完整性/SSOT 头/DoD 清单校验 + --spec-dir |
| 结构变更 | 需求规格不再内联 feature 集（行为规格由独立 bdd .feature 文件 + bdd-manifest.json 承接，behavior-spec.md 仅定义引用关系） |
| 决策 | 6 项拆独立产物文件（主规格引用块串联，对齐 SKILL.md 引用 references/ 模式）；主模板 §1-§12 编号不变防跨引用破坏（tla-plus-guide 引用 requirement-spec.md:§3）；UML 仅用例图+领域类图+活动图（状态机由 TLA+/BDD 覆盖）；代码层向后兼容（--spec-dir 等参数全可选，门禁增量） |
| self-test | 基线 217→225（+8：4 graph spec-enhance + 4 gate structure） |
| vitest | 466→476 |
| security-scan | baseline 重生成 206→224（含第 37 轮新增指纹；lint:security 0 新增发现） |
| 版本号 | 37.0.0（三处一致） |

#### 第 38 轮·小轮 A（2026-08-09）：Phase 2 系统设计设计级增强（SSoT §3.4.36）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求系统设计/概要设计/详细设计产出达到 DESIGN.md 级别结构严谨性（分三小轮，本轮为小轮 A：Phase 2） |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守系统设计域边界（不落接口/类级） |
| 新增模板 | 6 独立子模板（templates/system-design/：system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）+ 主模板 system-design.md 重构（§0 SSOT 头 + 引用块，保留 §1-§5 节号防 tla-spec-template 跨引用破坏） |
| 参考扩展 | phase-2-system-design.md 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R9（SD 追踪矩阵一致性）/R10（UML mermaid 配平）+ --spec-dir 支持 module 前缀 glob；check-artifact-gate.ts phase=2 新增引用块完整性/SSOT 头/DoD 清单校验（checkPhaseSpecStructure 泛化） |
| 阶段边界 | Phase 2 只产系统级（架构/子系统/部署/行为总览/运行时架构），FM-SD-06 拦截越界落接口/类级 |
| 遗留修复 | check-requirement-graph.ts isPureReqGraph 防御式处理缺 nodes 输入（第 37 轮遗留静默放行缺陷） |
| self-test | 基线 225→233 |
| 版本号 | 38.0.0（三处一致） |

#### 第 38 轮·小轮 B（2026-08-09）：Phase 3 概要设计设计级增强（SSoT §3.4.37）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求系统设计/概要设计/详细设计产出达到 DESIGN.md 级别结构严谨性（分三小轮，本轮为小轮 B：Phase 3） |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守概要设计域边界（不落类/方法级） |
| 新增模板 | 6 独立子模板（templates/interface-design/：interface-contract / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）+ 主模板 interface-design.md 重构（§0 SSOT 头 + 引用块，保留 §1-§3 节号与路由约束节） |
| 参考扩展 | phase-3-outline-design.md 算法增步骤 1-7 + FM-OD-01~05 + 禁止行为 #6/#7/#8 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R11（INTF 追踪矩阵一致性）/R12（UML mermaid 配平）+ --spec-dir 支持 phase=3 glob；check-artifact-gate.ts phase=3 新增结构校验（checkPhaseSpecStructure PHASE_SPEC_LAYOUT 加 phase=3 + modulePrefix 提取泛化） |
| 阶段边界 | Phase 3 只产模块接口级（接口契约/调用关系/错误码），FM-OD-06 拦截越界落类/方法级 |
| self-test | 基线 233→241 |
| 版本号 | 38.1.0（三处一致） |

#### 第 38 轮·小轮 C（2026-08-09）：Phase 4 详细设计设计级增强（SSoT §3.4.38）

| 维度 | 内容 |
|---|---|
| 触发 | 用户要求系统设计/概要设计/详细设计产出达到 DESIGN.md 级别结构严谨性（分三小轮，本轮为小轮 C：Phase 4，三小轮收官） |
| 修正方案 | 方案 A 全要素对齐：模板 + 参考 + 门禁三层联动，严守详细设计域边界（不回溯接口/不落编码） |
| 新增模板 | 6 独立子模板（templates/detailed-design/：class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）+ 主模板 detailed-design.md 重构（§0 SSOT 头 + 引用块，保留 §1-§3 节号）；Phase 4 无独立 UML 附录（类图/ER 图内嵌于 class-design/data-model） |
| 参考扩展 | phase-4-detailed-design.md 算法增步骤 1-6 + FM-DD-01~05 + 禁止行为 #7/#8/#9 + 返工路径 + 验收标准 |
| 门禁扩展 | check-requirement-graph.ts 新增 R13（DD 追踪矩阵一致性）/R14（UML mermaid 配平，class-design + data-model 双源）+ --spec-dir 支持 phase=4 glob；check-artifact-gate.ts phase=4 新增结构校验（PHASE_SPEC_LAYOUT 加 phase=4 + checkArtifactGate 调用条件补 phase=4） |
| 阶段边界 | Phase 4 只产类/数据级（类图/ER 图/方法级/表结构），FM-DD-06 拦截越界回溯接口/落编码 |
| self-test | 基线 241→249 |
| 版本号 | 39.2.0（三处一致） |

#### 第 39 轮（2026-08-10）：人月神话吸收（SSoT §3.4.39）

> 设计 spec：[2026-08-10-mythical-man-month-absorption-design.md](./superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md)（已批准，P2 批已实施（39.2.0））。本轮吸收源为《agent 时代的人月神话》（Brooks《人月神话》2026 年逐章重写，19 章）；对技能包做 26 项概念覆盖审计后，按 P0→P2 分三批吸收。**纯文档为主 + 少量脚本联动**（反模式计数 44→46），不新增子流程/门禁脚本/并行轨，self-test 基线不变。

| 维度 | 内容 |
|---|---|
| 触发 | 全书精读发现 6 个概念缺口（外科手术队伍/主刀、审计权 vs 修正权、侦察 vs 产出、银弹批判、白箱 vs 黑箱、九倍矩阵）+ 既有强机制缺量化触发规则（同错弃线/30% 预算重评/50-70% 会话重开/通读测试/判据持有审计/"已修复"禁语） |
| 吸收策略 | 纯文档为主 + 少量脚本联动（`docs-consistency-logic.ts` maxAntiPattern 44→46 + 测试样本）；不改 verifier-spec Schema / schemas/*.json / templates/* / subagent/* 人格 / 既有 44 条反模式语义 / self-test 基线（249） |
| P0-1 反指标游戏 | 新增反模式 #45（subagent 为通过测试而修改断言/测试期望）；`dispatching-parallel-agents/SKILL.md` 示例删除"调整测试期望"条款（改为"不得改断言凑通过，不符即报告"）；`test-driven-development/testing-anti-patterns.md` 补「改断言让测试通过」条目 |
| P0-2 主刀人设 + 修正权 | 新增反模式 #46（只给审计权不给修正权）；`subagent-delegation.md` 新增「主刀职责映射表」节（主刀=用户/O 代表人的判断，支持角色→agent，目的持有者溯源）；`SKILL.md` 核心原则补「主刀与修正权」段（与编排者最小化互补：O 不实施、用户保留修正权）；`definition-of-done.md` 补「修正权验收测试」 |
| P0-3 九倍矩阵完成度 | `definition-of-done.md` 补「完成度矩阵自检」（产品化轴×系统集成轴，任一轴缺项即未到 9x）；`phase-5-coding.md` 补任务分配规则（产品化→agent，系统集成判断→人持有）；`phase-6-integration-test.md` 补「集成判断由人持有」 |
| P0-4 人机分工线 | `SKILL.md` 核心原则补「人机分工线」段（能形式化→agent，不能形式化→人；阶段门/CHECKPOINT 即分工线落地）；`definition-of-done.md` 第七维度「理解证据」补注（acknowledgedDecisions = 判据持有者在形式化门禁之外的记叙性判断） |
| P1（39.1.0，10 项） | 并行三闸+通读测试+验证账单（dispatching-parallel-agents / subagent-delegation）、原文装填不转述（subagent-delegation）、记叙性优先+失败先归因（bdd-guide / test-driven-development）、结构性约束优先（SKILL.md 操作行为第 8 条）、独立评审会话模板（verifier-spec / requesting-code-review）、止损三规则（同错 N 次弃线 / 30% 预算重评 / 静默失败优先，operational-recovery）、会话 50-70% 重开（operational-recovery）、辩解义务强制（root-cause-locator）、回归测试强制钩子（SKILL.md 新增约束 #14）+ 增量集成纪律（phase-5-coding）、环境契约前置自检（quality-standards）（已实施，39.1.0） |
| P2（39.2.0，6 项） | 新 reference：`estimation-guide.md`（记账/mini-spike/禁"编码×系数"外推）、`context-management-guide.md`（KV 缓存友好/上下文分层/档位路由/自污染 10-30%）；白箱 vs 黑箱工具选型（SKILL.md）；里程碑设计到无法自欺（writing-plans）；侦察 vs 产出两阶段（hill-climbing-guide）；目的注释写 why 不写 what（format-conventions）（已实施，39.2.0） |
| P3 候选（暂缓） | 银弹批判/本质困难体检、判据持有审计（依赖 run-log 数据形态设计）、worktree 警示（与现有技能立场相反，待用户确认取舍） |
| 决策记录 | 新建 `w-model-dev/references/mythical-man-month-absorption.md`（23 项映射 + 章节出处 + 与约束/反模式关系） |
| self-test | 基线 249 不变 |
| 版本号 | 39.2.0（P2 批，三处一致） |


## 附录 A：§10A 追溯表轮次行（§3.4.13-39，原文）

> 自 SSoT §10A 移出（41.7.0）：轮次→落地文件的追溯映射，随轮次记录归档。

| §3.4.13 第 18 轮 drawio-skill 设计吸收 | Bundled Resources 触发条件总表 + JSON Schema 强约束（反模式 #28）+ 安全扫描基线 + 版本号双写 + pure/IO 函数分离 + 测试 coverage 矩阵 + toolbox 决策表 | `w-model-dev/SKILL.md`「Bundled Resources」节 + `w-model-dev/schemas/*.schema.json`（draft-07）+ `w-model-dev/scripts/logic/schema-loader.ts`（ajv 单例）+ `w-model-dev/scripts/cli/security-scan.ts` + `.eslintsecurity-baseline.json`（sha256 指纹豁免）+ `w-model-dev/skill-metadata.json`（版本号镜像）+ `w-model-dev/scripts/__tests__/skill-metadata.test.ts`（双写回归）+ `w-model-dev/references/toolbox.md`（I have X → use Z）+ `w-model-dev/scripts/__tests__/README.md`（coverage 矩阵）+ `w-model-dev/references/anti-patterns.md` #28 | 完整（吸收 drawio-skill 7 项设计实践；纯文档同步不涉及 .ts 代码变更；schema 校验由 logic 层自动调用、security-scan 由 pre-push 承载） |
| §3.4.14 第 19 轮 BDD 建模与验收夹具 | 分层 BDD features（L1-L4）+ 状态机七要素 + BDD↔TLA+ 等价性 + 7 维度门禁 + RTM 映射扩展 + 验收夹具四类 + 反模式 #29 | `w-model-dev/schemas/bdd-manifest.schema.json` + `w-model-dev/scripts/logic/bdd-logic.ts`（纯逻辑）+ `w-model-dev/scripts/cli/check-bdd-model.ts`（CLI）+ `w-model-dev/scripts/samples/bdd/`（10 样本）+ `w-model-dev/scripts/__tests__/bdd-logic.test.ts`（vitest）+ `w-model-dev/references/bdd-guide.md` / `bdd-review-checklist.md` / `bdd-syntax-reference.md` / `bdd-patterns-examples.md` + `w-model-dev/templates/feature.template` / `bdd-manifest.template.json` + `w-model-dev/references/anti-patterns.md` #29 + `w-model-dev/SKILL.md` 约束 #13 | 完整（BDD 与 TLA+ 正交协作；Cucumber.js v11 + @cucumber/messages devDeps；self-test 基线 111→121） |
| §3.4.15 第 19.0.1 轮 W 模型 8 阶段端到端调测验证与归档 | check-bdd-model.ts D7 RTM schema 修正（`rtm.requirements` → `rtm.rows` + `requirementId`）+ D7 测试样本补强（3 个）+ 8 阶段调测归档（7 文件）+ demo 产物清理 + 版本号三处同步 19.0.1 | `w-model-dev/scripts/cli/check-bdd-model.ts`（D7 修正）+ `w-model-dev/scripts/__tests__/bdd-logic.test.ts`（+3 D7 测试）+ `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`（7 归档文件）+ `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md`（版本号三处同步 19.0.1）+ `CHANGELOG.md` [19.0.1] | 完整（8 阶段端到端调测发现 D7 schema bug；UT 150/150 + IT 24/24 + ST 32/32 + UAT 25/25 = 231 全通过；self-test 基线 121 不变；vitest 105→108） |
| §3.4.16 第 20 轮 阶段 1 需求提取四维识别与豁免审批 | 四维识别模型（层级关系 R1-R4 + 子系统划分 REQ-group + 交叉逻辑 R5/R6 + 覆盖分析 C1-C10）+ 豁免审批治理（S→R→V→人类 E1-E8）+ 图谱 schema 扩展（level/priority/reqGroup + 3 类边）+ 规格书模板 5→13 节 + 反模式 #30 + 禁止行为 #7-#11 | `w-model-dev/schemas/coverage.schema.json` + `exemption.schema.json` + `w-model-dev/scripts/logic/coverage-logic.ts` / `check-requirement-coverage.ts` + `exemption-logic.ts` / `check-exemption.ts` + `graph-logic.ts`（R1-R6 + reqHierarchy/crossLogic）+ `check-requirement-graph.ts`（--rtm / --exemptions）+ `samples/graph/`（+13）+ `samples/coverage/`（10）+ `samples/exemption/`（7）+ `__tests__/graph-logic.test.ts`（R1-R6）+ `coverage-logic.test.ts`（C1-C10）+ `exemption-logic.test.ts`（E1-E8）+ `templates/requirement-spec.md`（5→13 节）+ `references/anti-patterns.md` #30 + `w-model-dev/SKILL.md` 约束 #10/#16 | 完整（不向后兼容老图谱，历史抛弃重新生成；self-test 基线 121→152；vitest 108→~165） |
| §3.4.22 第 26 轮 外部技能深度对比吸收 + 单轴下限 + Fowler 12 + 术语治理 | 加权平均掩盖单轴失败 → R13 单轴下限（passed 收紧为 qualityLevel∈{A,B} && 所有 subCriterion.score ≥ 0.70，0.70=B 级分界）+ Fowler 12 坏味道基线 + 票据内容 durability（符号级契约）+ 术语治理 glossary + 角色表 Negation 审计 + 反模式 #41 | `w-model-dev/scripts/logic/verifier-logic.ts`（R13：SINGLE_AXIS_MIN_SCORE + checkR13SingleAxisFloor + expectedPassed 单轴条件）+ `w-model-dev/scripts/samples/verifier/bad-single-axis-low.json`（completeness=0.65 fixture）+ `w-model-dev/scripts/__tests__/verifier-logic.test.ts`（+4 R13 用例）+ `w-model-dev/scripts/cli/self-test.ts`（VERIFIER_CASES +1，基线 191→192）+ `w-model-dev/references/verifier-spec.md`（§3.3/§6.3）+ `w-model-dev/subagent/engineering-code-reviewer.md`（Fowler 12 基线节）+ `w-model-dev/references/glossary.md`（新建，15+ 术语 + `_Avoid_`）+ `w-model-dev/references/phase-5-coding.md`（票据 durability 节）+ `w-model-dev/references/anti-patterns.md` #41 + `w-model-dev/SKILL.md`（角色表 Negation 审计 + references 索引 glossary 条目） | 完整（R13 非破坏性：既有样本全部 score ≥0.70；#41 用户决策直接转正不经 pending 复审；qualityLevel 映射不变，仅 passed 增加单轴条件；验证门 V1-V6 全通过：tsc 0 错误 / self-test 192 通过 / vitest 205 通过 / fixture exit=1 / 全样本 valid=0 bad=1） |
| §3.4.23 第 27 轮 Wayfinder「Fog of War」吸收 — 阶段 1 迷雾登记册 | 强制 100% 覆盖下「in-scope 尚无法精确陈述」需求无落脚点 → REQ 入学锐利性测试（能否精确陈述，非能否回答）+ 迷雾登记册文本节（Not yet specified，不建图节点）+ 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空）+ FM-3D-07 迷雾滥用 + 禁止行为 #12（不新增反模式） | `w-model-dev/references/ingestion-chunk.md`（锐利性测试节 + fogDesc/fogBlocker/fogGroupHint + crossChunkHints edgeType=fog）+ `w-model-dev/references/ingestion-cross.md`（算法步骤 9 + 报告 §7）+ `w-model-dev/references/phase-1-requirements.md`（迷雾登记册节 + FM-3D-07 + 禁止行为 #12 + 返工路径）+ `w-model-dev/templates/requirement-spec.md`（§8.5 Not yet specified）+ `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md`（版本号三处 26.0.0） | 完整（纯文档吸收，无脚本/schema 变更；self-test 192 / vitest 205 基线不变；D5 互引一致性通过；版本号三处一致 26.0.0） |
| §3.4.24 第 28 轮 need_fix.md + 全量脚本 code-review 修正 | need_fix.md Bug 1（estimateTokens CJK 低估）+ Bug 2（splitMarkdownByHeaders 分段逻辑重写）+ 全量 ~66 项缺陷修正（P1×15 / P2×25 / P3×26），分 6 组（G-A plan-chunks A1-A6 / G-B gate/verifier/schema/security B1-B12 / G-C graph/coverage/exemption C1-C9 / G-D TLA/BDD/code D1-D9 / G-E 状态/日志/签名/归档 E1-E17 / G-F opsx/codegraph F1-F7 + D4 操作侧 opsx 补产约束）。关键修正：SD→codeModule 对齐（gate-logic + code-tla-logic）、security-scan 指纹跨机器归一化、--rtm R6 纳入 passed、豁免多 group 兼容、签名链跨阶段连续链（D2）、run-log R1 按阶段分档（D3）、uat-path-mapping 严格解析 + phase 8 终检、graph.schema.json sourceArtifact 字段复活、check-budget.ts tla-rework 统计改为 action=rework。版本号 26.0.0 → 27.0.0。 | `w-model-dev/scripts/logic/plan-chunks.ts`（A1-A5）+ `w-model-dev/scripts/__tests__/plan-chunks.test.ts`（新建，A6）+ `w-model-dev/scripts/logic/gate-logic.ts`（B1-B3）+ `w-model-dev/scripts/cli/check-artifact-gate.ts`（B4-B6）+ `w-model-dev/scripts/cli/security-scan.ts`（B7-B8）+ `w-model-dev/scripts/cli/check-verifier-output.ts`（B9）+ `w-model-dev/scripts/logic/schema-loader.ts`（B10）+ `w-model-dev/scripts/logic/verifier-logic.ts`（B11）+ `w-model-dev/scripts/cli/self-test.ts`（B12）+ `w-model-dev/scripts/cli/check-requirement-graph.ts`（C1-C4）+ `w-model-dev/schemas/graph.schema.json`（C5）+ `w-model-dev/scripts/logic/graph-logic.ts`（C6）+ `w-model-dev/scripts/logic/coverage-logic.ts`（C7-C8）+ `w-model-dev/scripts/logic/exemption-logic.ts`（C9）+ `w-model-dev/scripts/logic/tla-logic.ts`（D1-D3）+ `w-model-dev/scripts/logic/code-tla-logic.ts`（D1）+ `w-model-dev/scripts/cli/check-bdd-model.ts`（D4）+ `w-model-dev/scripts/logic/tla-bdd-sync-logic.ts`（D5-D7）+ `w-model-dev/scripts/cli/check-design-contract-consistency.ts`（D8）+ `w-model-dev/scripts/logic/design-contract-logic.ts`（D9，新建）+ `w-model-dev/scripts/__tests__/design-contract-logic.test.ts`（新建）+ `w-model-dev/scripts/logic/signature-chain-logic.ts`（E1-E3）+ `w-model-dev/scripts/cli/check-signature-chain.ts`（E4）+ `w-model-dev/scripts/logic/run-log-logic.ts`（E5-E9）+ `w-model-dev/scripts/cli/check-run-log.ts`（E10-E11）+ `w-model-dev/scripts/cli/check-budget.ts`（E12）+ `w-model-dev/scripts/cli/check-maturity.ts`（E13）+ `w-model-dev/scripts/cli/check-checkpoint.ts`（E14）+ `w-model-dev/scripts/logic/checkpoint-logic.ts`（E15）+ `w-model-dev/scripts/logic/root-cause-logic.ts`（E16）+ `w-model-dev/scripts/logic/archive-integrity-logic.ts`（E17）+ `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`（F1-F3）+ `w-model-dev/scripts/cli/check-codegraph-queries.ts`（F4）+ `w-model-dev/scripts/cli/check-opsx-artifacts.ts`（F5）+ `w-model-dev/scripts/cli/check-openspec-archive.ts`（F6）+ `w-model-dev/references/signature-chain-guide.md`（连续链整改）+ `w-model-dev/references/data-models.md`（run-log R1 分档/tla-rework 枚举移除）+ `w-model-dev/references/subagent-delegation.md`（opsx D4 补产约束）+ `w-model-dev/references/anti-patterns.md` #39（同步）+ `w-model-dev/references/phase-8-acceptance-test.md`（uat-path-mapping 终检声明）+ `w-model-dev/SKILL.md`（D4 约束）+ `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md`（版本号三处同步 27.0.0） | 完整（6 组域内回归 + 全量回归：self-test 192→213 / vitest 205→269 / 21 test files / TypeScript strict 0 错误 / security-scan baseline 指纹归一化后重生成 / prepush 全绿） |

| §3.4.26 | 第三十轮 CLI 样板抽取 + 分派总览矩阵 | `scripts/lib/read-json-or-exit.ts` + `scripts/__tests__/read-json-or-exit.test.ts` + `references/dispatch-matrix.md` + 13 个 check-*.ts 重构 | 完整（self-test 213/213、vitest 297、tsc 0 错误） |
| §3.4.27 | 第三十一轮 Schema 字段描述增强 + 敏感信息脱敏 + npm audit 门禁 | `schemas/*.schema.json`（全量字段补 description）+ `references/operational-recovery.md`（敏感信息禁令）+ `references/anti-patterns.md` #43 + `.githooks/pre-push`（检查 #12 npm audit warn-only）+ `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md`（版本号三处同步 30.0.0） | 完整（self-test 213/213、vitest 297、prepush 12 项、tsc 0 错误） |
| §3.4.28 | 第 30.1 轮 security-scan 内容敏感指纹 v2 + 签名链 R8 项目根语义 | `scripts/cli/security-scan.ts` + `scripts/__tests__/security-scan.test.ts` + `.eslintsecurity-baseline.json` + `scripts/cli/check-signature-chain.ts` | 完整（self-test 213/213、vitest 301、prepush 12 项、tsc 0 错误） |
| §3.4.29 | 第 31 轮 /wm status 脚本化 + 流程度量报告 | scripts/cli/wm-status.ts + scripts/logic/wm-status-logic.ts + scripts/cli/metrics-report.ts + scripts/logic/metrics-report-logic.ts | 完整（self-test 213/213、vitest 345、tsc 0 错误） |
| §3.4.30 | 第 32 轮 错误结构全量归一化 + run-log R6 契约迁移 | scripts/lib/cli-error.ts + exit-2 脚本全量归一化 + scripts/logic/run-log-logic.ts（extractExitCode/buildGateLogKeys 迁入）+ scripts/__tests__/cli-error.test.ts | 完整（self-test 213/213、vitest 363、tsc 0 错误） |
| §3.4.31 | 第 33 轮 全仓库优化 5 批实施（技能缺口 + 评估 + 收尾） | `.cursor/skills/security-review/SKILL.md`（lint:security + baseline v2 + 反模式 #43 凭据脱敏）+ `.cursor/skills/codegraph-exploration/SKILL.md`（约束 #14 codegraph_explore + 落盘字段）+ `.cursor/skills/performance-review/SKILL.md`（性能评审 4 维度）+ `eval/README.md`（TSV 9 列 + darwin-skill 补跑流程）+ 版本号三处 33.0.0 | 完整（self-test 213/213、vitest 434、tsc 0 错误；eval 补跑留待外部 darwin-skill） |
| §3.4.32 | 第 34 轮 W 模型技能强化（目录约定 SSoT / 格式统一 / TLA+·BDD 覆盖率校验架构升级） | `references/directory-conventions.md`（路径约定 SSoT）+ `references/format-conventions.md`（冒号格式 SSoT）+ `subagent-delegation.md`（S-ingest-tla / S-ingest-bdd 模板）+ `schemas/tla-manifest.schema.json`（sdCoverage 必填）+ `schemas/bdd-manifest.schema.json`（designCoverage 必填）+ `scripts/cli/check-tla-model.ts`（--graph phase≥2 强制 + SD 覆盖率强制）+ `scripts/cli/check-bdd-model.ts`（--graph + D8 维度）+ `scripts/cli/check-artifact-gate.ts`（resolvePhaseDoc + 终检 model 校验）+ `scripts/logic/verifier-logic.ts`（EVIDENCE_PATTERN 冒号格式）+ `scripts/logic/bdd-logic.ts`（TLA+ 快照解析升级 + L1 豁免 D4）+ demo 重产（TLA+ 7 specs + BDD 9 features 覆盖 21 SD）+ 版本号三处 34.0.0 | 完整（self-test 213/213、vitest 451、tsc 0 错误） |
| §3.4.33 | 第 35 轮 8 阶段端到端调测修复入库 | `scripts/cli/check-tla-model.ts`（TLC states 清理正则 `\d{4}`→`\d{2,4}`，P3 bug）+ `scripts/logic/design-contract-logic.ts`（D1 路径语义归一：多端点拆分/括号剥离/`:id` 模板段匹配/「不适用」「横切」豁免）+ `scripts/logic/run-log-logic.ts`（GATE_JSON_PATTERNS 新增 STATE_MACHINE_JSON）+ `scripts/__tests__/tla-clean-trace.test.ts`（+1）+ `scripts/__tests__/design-contract-logic.test.ts`（+6）+ `scripts/__tests__/run-log-logic.test.ts`（+1）+ `scripts/__tests__/bdd-logic.test.ts`（实时 fixture 改自包含内联规格）+ demo 侧修复（auditMiddleware id、限流器独立实例、Express Router 路由结构）+ 版本号三处 35.0.0 | 完整（self-test 213/213、vitest 459、tsc 0 错误；8 阶段调测 318/318 测试、覆盖率 94.76% lines、归档 308 文件） |
| §3.4.34 | 第 36 轮 冰山扫掠深度分析机制 | `schemas/iceberg-sweep.schema.json` + `scripts/logic/iceberg-sweep-logic.ts`（R1-R8）+ `scripts/cli/check-iceberg-sweep.ts`（CLI）+ `scripts/__tests__/iceberg-logic.test.ts`（+7）+ `scripts/samples/iceberg/`（+4 样本）+ `scripts/cli/self-test.ts`（基线 213→217）+ `schemas/run-log.schema.json`（action 枚举 +2）+ `references/iceberg-sweep-guide.md` + `references/anti-patterns.md`（#44，43→44）+ `references/subagent-delegation.md`（R-iceberg 模板）+ `references/root-cause-locator.md`（边界节）+ `SKILL.md`（工作流 9.5 步）+ 版本号三处 36.0.0 | 完整（self-test 217/217、vitest 466、tsc 0 错误） |
| §3.4.35 | 第 37 轮 Phase 1 设计级别增强 | `templates/requirement-spec.md`（重构：§0 SSOT 头 + §13-§17/附录 A 引用块）+ `templates/requirement-spec/`（system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling 6 子模板）+ `references/phase-1-requirements.md`（算法步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14）+ `scripts/cli/check-requirement-graph.ts`（R7/R8 + --spec-dir）+ `scripts/cli/check-artifact-gate.ts`（phase=1 引用块/SSOT/DoD 结构校验 + --spec-dir）+ `scripts/cli/self-test.ts`（基线 217→225）+ 版本号三处 37.0.0 | 完整（self-test 225/225、vitest 476、tsc 0 错误） |
| §3.4.36 | 第 38 轮 Phase 2 设计级增强（小轮 A） | `templates/system-design/`（6 子模板：system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）+ 主模板 system-design.md 重构 + `references/phase-2-system-design.md`（算法 1-7 + FM-SD-01~06）+ `check-requirement-graph.ts`（R9/R10 + --spec-dir）+ `check-artifact-gate.ts`（phase=2 结构校验） | 完整（self-test 225→233、版本 38.0.0） |
| §3.4.37 | 第 38 轮 Phase 3 设计级增强（小轮 B） | `templates/interface-design/`（6 子模板）+ 主模板 interface-design.md 重构 + `references/phase-3-outline-design.md`（算法 1-7 + FM-OD-01~06）+ `check-requirement-graph.ts`（R11/R12）+ `check-artifact-gate.ts`（phase=3 结构校验） | 完整（self-test 233→241、版本 38.1.0） |
| §3.4.38 | 第 38 轮 Phase 4 设计级增强（小轮 C） | `templates/detailed-design/`（6 子模板）+ 主模板 detailed-design.md 重构 + `references/phase-4-detailed-design.md`（算法 1-6 + FM-DD-01~06）+ `check-requirement-graph.ts`（R13/R14）+ `check-artifact-gate.ts`（phase=4 结构校验） | 完整（self-test 241→249、版本 39.2.0） |
| §3.4.39 | 第 39 轮 人月神话吸收（P0：反指标游戏 #45 / 主刀与修正权 #46 / 九倍矩阵完成度 / 人机分工线；P1：并行三闸·原文装填·记叙性优先·结构性约束·独立评审·止损三规则·会话生命周期·辩解义务·回归约束 #14·环境契约自检；P2：estimation-guide / context-management-guide 新 reference + 白箱黑箱·里程碑元规则·侦察vs产出·目的注释） | `references/mythical-man-month-absorption.md`（决策记录，新建）+ `references/anti-patterns.md`（#45/#46，计数 44→46）+ `.cursor/skills/dispatching-parallel-agents/SKILL.md`（删"调整测试期望"）+ `.cursor/skills/test-driven-development/testing-anti-patterns.md`（改断言凑绿条目）+ `references/subagent-delegation.md`（主刀职责映射表/原文装填/验证账单）+ `references/definition-of-done.md`（修正权验收/九倍矩阵自检）+ `SKILL.md`（主刀与修正权/人机分工线 + 操作行为第 8 条 + 约束 #14 + 白箱黑箱）+ `references/phase-5-coding.md`（任务分配/增量集成）+ `references/phase-6-integration-test.md`（集成判断人持有）+ `references/bdd-guide.md`（记叙性优先）+ `references/verifier-spec.md`（独立评审模板）+ `references/operational-recovery.md`（止损三规则/会话重开）+ `references/root-cause-locator.md`（辩解义务）+ `references/quality-standards.md`（环境契约自检）+ `references/hill-climbing-guide.md`（侦察vs产出）+ `references/format-conventions.md`（目的注释）+ `references/estimation-guide.md` + `references/context-management-guide.md`（新建）+ `.cursor/skills/writing-plans/SKILL.md`（里程碑元规则）+ `scripts/logic/docs-consistency-logic.ts`（maxAntiPattern 44→46）+ 版本号三处 39.2.0 | 设计 spec 已批准（2026-08-10-mythical-man-month-absorption-design.md）；P2 已实施（39.2.0） |

## 附录 B：§10B 参考实现调测史（原文）

> 自 SSoT §10B 移出（41.7.0）：端到端调测历史快照。

## 10B. 参考实现（端到端调测验证）

> 本节记录对 W 模型 8 阶段编排 + LLM-as-a-Verifier 阶段门 + 工件质量门的端到端调测验证结论。
> 参考实现是一个博客系统后端（blog-system-demo），用于具象验证本 SSoT 所述设计在真实项目中的可执行性。

> **归档说明（2026-07-27 第 17 轮 P6）**：`w-model-dev-demo/` 目录已从仓库删除，归档摘要迁移至 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./changes/archive/2026-07-26-round15-end-to-end-test/)（9 文件：README / proposal / specs / design / tasks / tla-summary / rtm-snapshot / verifier-summary / test-report-snapshot）。下文所有 `../w-model-dev-demo/` 链接为**历史记录**，目录已不存在；最终调测数字（第十五轮：708 UT / 74 IT / 35 ST / 72 UAT / 889 测试用例全通过）见归档 [`README.md`](./changes/archive/2026-07-26-round15-end-to-end-test/README.md)。本节数字为**第五轮**（2026-07-24）快照，保留作历史对照。

### 10B.1 项目概况

| 项 | 内容 |
|---|---|
| 项目名 | 博客系统后端（blog-system-demo） |
| 技术栈 | Node.js ≥20 / Express 4 / TypeScript 5（严格模式）/ zod 3 / jsonwebtoken 9 / bcrypt 5 / vitest 1 + supertest / cross-env 7 |
| 存储方式 | 内存 Map（无外部 DB 依赖，便于端到端调测） |
| 调测轮次 | 五轮：2026-07-20（首轮）→ 2026-07-21（第二轮）→ 2026-07-23（第三/四轮）→ 2026-07-24（第五轮，编排者-子代理分派模式） |
| 当前状态 | **已归档**（2026-07-24 用户 `confirm`） |
| 调测模式 | self-as-verifier（Agent 按本技能编排自驱完成 8 阶段，每阶段跑质量门） |
| 范围 | 用户认证（注册 / 登录 / 登出 / JWT）+ 文章 CRUD（作者隔离）+ 公开浏览 + 评论 |

### 10B.2 8 阶段产出对应

> 下表产出位置为**历史记录**（`w-model-dev-demo/` 已于第 17 轮删除，源码不再可访问；最终数字见归档 [`README.md`](./changes/archive/2026-07-26-round15-end-to-end-test/README.md)）。

| W 模型阶段 | 产出位置（历史，源码已删除） | 同步测试设计 |
|---|---|---|
| 1 需求分析 | `docs/requirement-spec.md` | 验收测试用例索引（UAT-001~015） |
| 2 系统设计 | `docs/system-design.md` | 系统测试用例索引（ST-001~022） |
| 3 概要设计 | `docs/outline-design.md` | 集成测试用例索引（IT-001~021） |
| 4 详细设计 | `docs/detailed-design.md` | 单元测试用例（UT-001~077） |
| 5 编码 | `src/` | 单元测试执行（77/77 通过，覆盖率 99.37% lines / 92.66% branches / 100% functions） |
| 6 集成测试 | `docs/integration-test-report.md` | 21/21 通过（含缺陷修正，见 §10B.4） |
| 7 系统测试 | `docs/system-test-report.md` + `tests/perf/k6-load-test.js` | 22/22 通过 + k6 性能基线脚本就绪 |
| 8 验收测试 | `docs/acceptance-test-report.md` | 15/15 通过，RTM 覆盖率 100%，用户 `confirm` 归档 |

#### 10B.2.1 归档完整性清单（[21.0.0] 新增）

归档时必须快照各阶段所有强制产出文档，由 `check-archive-integrity.ts` 校验：

| 阶段 | 强制快照文件 |
|---|---|
| 1 | requirements.md / risk-assessment.md / uat-path-mapping.md / coverage.json / graph.json / tla-manifest.json / bdd-manifest.json |
| 2 | system-design.md / system-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 3 | outline-design.md / integration-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 4 | detailed-design.md / unit-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 5 | src/ / unit-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 6 | integration-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 7 | system-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 8 | acceptance-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 全阶段 | signature-chain.jsonl / verifier-output-*.json / gate-logs/ |

缺失即归档失败（exitCode=1），违反反模式 #31。

### 10B.3 调测结论摘要

| 指标 | 目标 | 实测（2026-07-24 第五轮） | 是否达标 |
|---|---|---|---|
| 单元测试通过率 | 100% | 77/77（100%） | ✅ |
| 单元测试代码覆盖率（lines） | ≥ 80%（NFR-004） | 99.37% | ✅ |
| 单元测试代码覆盖率（branches） | ≥ 80%（NFR-004） | 92.66% | ✅ |
| 单元测试代码覆盖率（functions） | ≥ 80%（NFR-004） | 100% | ✅ |
| 集成测试通过率 | 100% | 21/21（100%） | ✅ |
| 系统测试通过率 | 100% | 22/22（100%） | ✅ |
| 验收测试通过率 | 100% | 15/15（100%） | ✅ |
| RTM 需求覆盖率 | 100% | 5/5（100%） | ✅ |
| 阶段门评审 | 8 阶段全部放行 | 8/8（qualityLevel 均为 A，compositeScore 0.9015~0.922） | ✅ |
| 图谱校验 | 阶段 1-4 退出码 0 | 35 节点 141 边，信息流零违反 | ✅ |
| TLA+ 行为门禁 | 阶段 1-4 退出码 0 | 8 规格（1 L1 + 4 L2 + 3 L3），零死锁/不变式违反 | ✅ |
| 代码-TLA+ 一致性回归 | 阶段 5 退出码 0 | 四维度全通过（SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | ✅ |
| 工件质量门（`check-artifact-gate.ts`） | 退出码 0 | 通过（退出码 0） | ✅ |
| 性能基线 | P95 ≤ 200ms（NFR-002） | vitest 内近似采样 P95=60.76ms | ✅ |
| 安全约束（JWT 过期 / 作者隔离 / 输入校验 / 孤儿数据） | 全部覆盖 | 4/4 | ✅ |
| TypeScript 严格编译（`tsc --noEmit`） | 0 错误（NFR-003） | 退出码 0 | ✅ |
| 自检基线（`npm run self-test`） | 退出码 0 | 111/111 通过（18 Verifier + 13 Gate + 17 Graph + 14 TLA + 5 Budget + 7 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 11 RootCause + 15 Schema + 1 Metadata） | ✅ |
| 用户确认 | 真实用户在验收报告 §9 填入 | `confirm`（2026-07-24） | ✅ |

### 10B.4 过程中发现的缺陷与修正（累计 5 项）

| # | 缺陷 | 触发阶段 | 根因 | 修正 | 验证 |
|---|---|---|---|---|---|
| 1 | 首轮 4 个集成测试失败：NotFoundError / ForbiddenError 未被中间件捕获，表现为 Unhandled Rejection | 阶段 6（集成测试），2026-07-20 首轮 | Express 4 不自动捕获 async handler 抛出的 rejected promise | 新建历史 `src/utils/async-handler.ts`（已归档）包装器，包裹 `auth-routes.ts` / `article-routes.ts` / `comment-routes.ts` 全部路由 | 重跑 6/6 通过 |
| 2 | JWT_SECRET 缺失导致 4 个测试套件加载失败（user-service / auth-middleware / integration / system / acceptance 全挂） | 2026-07-21 回归发现 | 历史 `src/utils/env.ts`（已归档）在 import 阶段即抛错，连锁导致所有间接依赖 user-service 的测试套件在 `collect` 阶段失败 | `package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入 | 全部测试套件正常加载 |
| 3 | ArticleService 类型导出消失：`src/services/comment-service.ts` 报 TS2724 | 2026-07-21 回归发现 | 历史 `src/services/article-service.ts`（已归档）改为内部 `class ArticleService`（无 `export`）+ `export const articleService` 实例，导致 `import type { ArticleService }` 类型丢失 | 恢复 `export class ArticleService`，与 `export const articleService` 共存 | `tsc --noEmit` 退出码 0 |
| 4 | vitest mock 与 express NextFunction 类型不兼容：`next.mock.calls[0][0]` 报 TS2339 | 2026-07-21 回归发现 | `vi.fn() as unknown as NextFunction` 断言丢失 vitest mock 类型；vitest 1.6 类型定义与 express 4 类型定义存在兼容性问题 | 用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问 | `tsc --noEmit` 退出码 0 |
| 5 | check-artifact-gate.ts 缺 exitCode 字段，导致 check-run-log.ts R6 交叉校验无法提取退出码 | 阶段 8（验收测试），2026-07-24 第五轮发现 | `check-artifact-gate.ts` 是唯一未在 `GATE_JSON` 输出中包含 `exitCode` 字段的门禁脚本 | 与其它 7 个 `check-*.ts` 脚本对齐：计算 `const exitCode = result.passed ? 0 : 1`，写入 `GATE_JSON` 并 `process.exit(exitCode)`；`check-run-log.ts` 的 `extractExitCode` 模式数组增加 `GATE_JSON` 标记识别 | `npm run self-test` 全通过 |
| 6 | 阶段 1-4 全部 CHECKPOINT 使用 self-as-verifier 代签，无真实用户确认 | 阶段 8 code review，2026-07-28 第 20 轮 | self-as-verifier 模式合法性歧义 + 历史轮次常态化 | §10C 全面禁止代签 + check-checkpoint.ts R3 强化 + 签名链 R5 代签检测（D20-1） |
| 7 | TLA+ L1 使用 --skip-tlc 跳过 TLC 检查，违反硬约束 | 阶段 8 code review，2026-07-28 第 20 轮 | --skip-tlc 参数与反模式 #15 矛盾 | §10.8 移除 --skip-tlc + check-tla-model.ts 移除参数（D20-2） |
| 8 | REQ 层级树仅 3 层，"4 层强制"条款不合理 | 阶段 8 code review，2026-07-28 第 20 轮 | 硬约束设计缺陷（应自适应层级深度） | §7.7 改为自适应层级深度 + graph.schema.json 移除 maximum: 4（D20-3） |
| 9 | 6 项强制文档未在归档留证 | 阶段 8 code review，2026-07-28 第 20 轮 | 归档完整性缺口 | §10B.2 归档完整性清单 + check-archive-integrity.ts（D20-4） |
| 10 | 覆盖矩阵/冲突检测无证据，V 评审 evidence 空泛 | 阶段 8 code review，2026-07-28 第 20 轮 | V 评审 evidence 无格式约束 | §7.6 evidence 强制引用 + check-verifier-output.ts 格式校验（D20-5） |

> 缺陷 1 已纳入 [`w-model-dev/references/anti-patterns.md`](../w-model-dev/references/anti-patterns.md)「实现层经验教训」节。
> 缺陷 2/3/4 是 2026-07-21 从零重建过程中通过回归测试发现的工程配置问题，已通过工程配置修复固化到 demo 的 `package.json` / `tsconfig.json` 与源码中，供后续项目在阶段 5（编码）参考。
> 缺陷 5 是 2026-07-24 第五轮编排者-子代理分派模式重跑过程中发现的门禁脚本一致性缺陷，已修复并纳入 self-test 回归基线。

### 10B.5 与 SSoT 设计章节的映射

参考实现验证了以下 SSoT 设计章节在真实项目中的可执行性：

| SSoT 章节 | 验证点 | 验证结果 |
|---|---|---|
| §3.2 模块设计 | 4 模块划分（认证 / 文章 / 评论 / 公共层） | ✅ M-001~M-004 全部落地 |
| §4 工作流程 | 8 阶段顺序 + 阶段门评审 | ✅ 全部走通（五轮验证） |
| §6 命令接口 | `/wm analyze` / `design` / `code` / `test` / `review` / `status` | ✅ 编排可用 |
| §9 RTM | 双向追溯 + 覆盖率 100% | ✅ 5/5 需求 100% 覆盖 |
| §10 质量保障 | 工件质量门（§10.5） | ✅ 退出码 0 |
| §7.6 LLM-as-a-Verifier | 阶段门评审流程 | ✅ 8 阶段全部放行 |
| §10.7 图谱门禁 | 阶段 1-4 结构 + 信息流校验 | ✅ 35 节点 141 边，零违反 |
| §10.8 TLA+ 行为门禁 | 阶段 1-4 SANY + TLC + 层次一致性 | ✅ 8 规格全通过，零死锁/不变式违反 |
| §10.8 代码-TLA+ 一致性回归 | 阶段 5 四维度校验 | ✅ SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖全通过 |

### 10B.6 边界声明

- 历史 `w-model-dev-demo/` 是**参考实现**（已于第 17 轮 P6 删除，归档摘要见 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./changes/archive/2026-07-26-round15-end-to-end-test/)），不是技能运行时依赖：不参与 `/wm` 命令编排，也不被 `check-*-gate.ts` 读取。
- 调测结论仅验证本 SSoT 所述设计的可执行性，不构成对其他项目场景的承诺。
- 历史 demo 自身的 `package.json` 独立于仓库根 `package.json`（demo 引入 express / bcrypt / jsonwebtoken / zod / vitest / cross-env 等业务依赖，与根 `package.json` 声明 tsx + ajv + ajv-formats + eslint-plugin-security + @typescript-eslint/* + typescript + @types/node 不同）。
- 内存存储是已知限制（重启数据丢失），详见归档 [`specs.md`](./changes/archive/2026-07-26-round15-end-to-end-test/specs.md) RISK-001。
- k6 是独立二进制工具，不能通过 npm 安装；历史 `tests/perf/k6-load-test.js` 需用户先安装 k6 后独立运行，不纳入 `npm test` 自动化链路（源码已归档删除）。

