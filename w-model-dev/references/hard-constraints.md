# 不可违反的约束（Hard Constraints）

> 14 条硬红线：**命中即回退**（回到当前阶段起点），与「核心操作行为」（日常准则，违反不回退）互补。
> 第 44 轮由 `SKILL.md` 移入本文件按需加载；`SKILL.md` 保留 14 条单行摘要 + 本文件指针。

## #1 测试设计前置

阶段 1–4 的开发产物完成后，立即产出对应测试设计，不得推迟到编码后。

## #2 阶段门放行（含豁免审批）

产物评审通过且用户在 🔴 CHECKPOINT 明确确认后，才能推进。L1+ 自主成熟度下的操作型 CHECKPOINT 自动放行是选择性激活（见 [operational-recovery.md](operational-recovery.md)「成熟度与 CHECKPOINT 放行」节），非绕过；决策型 CHECKPOINT 在所有级别均等用户；阶段门放行须填 `acknowledgedDecisions` 理解证据（见 [definition-of-done.md](definition-of-done.md) 第六维度）。

**豁免审批强制四阶段**（原约束 #16 并入）：任何豁免须 S→R→V→人类四阶段流程，禁止跳步。S 提出 → R 审查 → V 校验 → 人类 CHECKPOINT 确认 → [`check-exemption.ts`](../scripts/cli/check-exemption.ts) E1-E9 全通过。跳过任一阶段命中反模式 #30。

## #3 RTM 为事实源 + 每阶段回填

`.w-model/rtm.json` 是追溯与测试状态的唯一事实源；变更产物时同步更新。

**RTM 实体每阶段必须回填**（原约束 #18 并入）：S 子代理产出后须更新 `.w-model/rtm.json`；阶段门 CHECKPOINT 须展示 RTM 文件路径与 coverage 字段。S 子代理返回时须列出 `rtm.json` 文件路径与 coverage 百分比；coverageStatus 字段为"100%"时 coveragePercent 须 = 100，为"部分"时 coveragePercent 须 < 100，为"待覆盖" → 违反约束（回退）。详见 [subagent-delegation.md](subagent-delegation.md)「S 子代理职责」。

## #4 真实执行

不得估算覆盖率、测试结果或门禁结果；必须执行真实测试/脚本并记录输出。

## #5 失败即回退

评审 C/D、测试失败或门禁退出码 1/2 均不得放行。

## #6 按需加载

只读取当前命令和阶段需要的参考；禁止一次加载整个 `references/`。

## #7 如实状态

未完成、未评审或未确认的阶段不得标为完成。

## #8 编排者最小化 + 角色分派完整性

编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本）。任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。命中反模式 #10 一律回退到当前阶段起点。详见 [subagent-delegation.md](subagent-delegation.md)。

**角色分派完整性**（原约束 #19 并入）：编排者每阶段须至少分派 S/V/G 三角色各 1 次；**无条件须分派 R 角色 ≥3 次**（completeness/reliability/security 三阶段各 1 次，第 29 轮升级为无条件强制，覆盖所有 S 变体含 S-fix / S-emergency-fix）；self-as-verifier 模式下兼任时须产出各角色独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON / PreventiveReview JSON 三份）。O 须在 CHECKPOINT 前确认 run-log 中含 role=S/V/G 各 ≥1 条记录。命中反模式 #34 一律回退到当前阶段起点补派缺失角色。详见 [subagent-delegation.md](subagent-delegation.md)「角色分派完整性校验」。

## #9 门禁退出码不可伪

所有 `check-*.ts` 的 JSON 摘要须含 `exitCode` 字段，与 `process.exit()` 强一致；G 子代理须存档 stdout 到 `.w-model/gate-logs/`；`check-run-log.ts` 交叉校验 run-log 中 `gateExitCode` 与 `gate-logs/` 存档一致，不一致一律视为伪造并回退（SSoT §10E）。编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行作为放行证据（不得仅引用 JSON 摘要）。

## #10 系统层级树 + REQ 层级标注

层级树根 = REQ 系统节点，子系统根 = SD（parent 依附），接口根 = INTF；图谱须覆盖 7 层（结构 / 依赖 / 追溯 / 信息流 / 治理 / 协作 / 派生）；横切边（`governs` / `collaborates-with` / `derives`）不依附层级树，但**不替代追溯**——追溯仍以 RTM 为事实源（SSoT §10.10）。

**REQ 层级强制标注**（原约束 #15 并入）：REQ 节点须标注 `level`（1-4）强制必填，无降级；无法判断时 blocked 返回要求用户重述（禁止默认填 level=3）。`level=1` REQ 即 REQ-group 候选；`level≥2` REQ 须有 `reqGroup` 指向 `level=1` 祖先。不向后兼容老图谱（历史抛弃，重新生成）。

## #11 闭环机制强制校验 + R3 预防性审查

`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`（无条件）5 脚本须在每个阶段门执行，`exitCode=0` 才可放行；任一脚本非 0 视为闭环未达成，回到当前阶段起点（SSoT §10C/§10D）。`check-preventive-review.ts` 支持 `--auto-trigger` 模式：从 run-log 读取当前阶段，自动校验对应阶段的 3 份 R3 报告（completeness/reliability/security），exitCode=0 方可进入 V 评审。

**R3 预防性审查强制**（原约束 #17 并入，无条件，覆盖所有 S 变体）：所有阶段 S 产出后须触发三阶段 R 预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 三份报告。**第 29 轮升级为无条件强制**，覆盖所有 S 变体（S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**），无 flag，无「启用时」措辞。S-fix 走 `<phase>-fix-{dim}.json` 路径，S-emergency-fix 走 `<phase>-emergency-{dim}.json` 路径，S-ingest-tla / S-ingest-bdd 走 `<phase>-ingest-{dim}.json` 路径。V 评审前 G 子代理须跑 [`check-preventive-review.ts`](../scripts/cli/check-preventive-review.ts)（支持 `--variant=standard|fix|emergency|ingest`）校验报告完整性。跳过 R3 直接进入 V 评审命中反模式 #33；S-fix / emergency-fix 后跳过 R3+V 命中反模式 #42。阶段 5-8 opsx 三段式（S-explore → S-propose → S-coding）每段另有 stage 级 R3 审查：产出 `.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md` ×9 + `.w-model/v-reviews/phase<N>-{explore,propose,coding}.md` ×3（与 `check-opsx-artifacts.ts` 一致）。详见 [subagent-delegation.md](subagent-delegation.md)「R3 预防性审查分派模板」。

## #12 返工必经根因定位

V/G 不通过后，必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。详见 [root-cause-locator.md](root-cause-locator.md)。

## #13 行为门禁按成熟度分级（TLA+ + BDD）

阶段 1–4 须产出对应层级的 TLA+ 状态机规格（L1 系统内外交互 → L2 子系统 → L3 原子行为 → L4 递归拆解按需，`.tla` + `.cfg` + `tla-manifest.json`）与对应层级 BDD features（L1/L2/L3/L4，`.feature` + `bdd-manifest.json`）；阶段 5-8 执行对应层级 cucumber scenarios 且 [`check-bdd-model.ts`](../scripts/cli/check-bdd-model.ts) exitCode=0。G 子代理跑 [`check-tla-model.ts`](../scripts/cli/check-tla-model.ts)（语法 + TLC + 无死锁/不变式违反/状态爆炸）与 `check-bdd-model.ts`（D1 头标注 / D2 Gherkin 语法 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射 / D8 SD Coverage）。

**强制级别按项目成熟度分级**：

| 成熟度 | 适用 | TLA+ / BDD 强制级别 |
|---|---|---|
| L1 | 教学 / demo / 小工具 | 可选（其余门禁照跑） |
| L2 | 生产小项目 | TLA+ L1 + BDD L1 必跑，其余可选 |
| L3 | 生产中大型 | 全必跑 |

阶段 4 TLA+ 零违反 + 图谱零违反才放行进编码。TLA+ 不接受占位/简化/错误实现（反模式 #16）；建模须符合需求和设计，符合后仍有问题须修正需求/设计并回退重跑（反模式 #17）；BDD↔TLA+ 不等价必须走 R→V→G→S-fix 循环（反模式 #29）。详见 [tla-plus-guide.md](tla-plus-guide.md) 与 [bdd-guide.md](bdd-guide.md)。

## #14 代码改动前后门禁（codegraph + 回归）

**codegraph 修改前强制查询**（原约束 #20 并入）：阶段 5-8 任何代码/测试文件 `Edit`/`Write` 前，S-coding 子代理须先调用宿主 Agent 的 `codegraph_explore` MCP 工具查询目标符号影响半径（callers/callees/blast radius），并将查询结果落盘到 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`（含 querySymbol / callers[] / callees[] / blastRadius / queryTimestamp）。未查询直接修改命中反模式 #38，回到当前阶段起点。codegraph 与 code-TLA+ 一致性校验（修改后回归）互补：前者预防、后者回归。

**回归测试强制钩子**（原约束 #21 并入）：任何 agent 改动代码后必须跑回归测试（修复引入新 bug 概率 20-50%，第 39 轮 P1 批新增）；禁止"改动代码但不跑回归"的工作流。

详见 [phase-5-coding.md](phase-5-coding.md)「codegraph 修改前影响分析」+「增量集成纪律」节。

