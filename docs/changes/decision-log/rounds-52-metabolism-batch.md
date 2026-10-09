# 第 52 批（批次 5，43.5.0）代谢机制——C1/C2 候选裁决 + M1 棘轮预算 cap 终值上调裁定

> 本批为「代谢机制批」（M1 度量/预算 / M2 漂移预警-KPI 追踪 / M3 基线重跑 / M4 熵审计巡检 / M5 仓库健康仪表盘）。
> 本文件登记任务 10 🔴 CHECKPOINT 的两项用户裁定（C1/C2 候选处置 + M1 caps 终值上调）；批次其余决策见各任务报告与 CHANGELOG 43.5.0 节。

## 裁定 1：C1/C2 候选三选一 → C2 转正（反模式 #49）+ C1 维持候选设复审期限

**背景（任务 10 CHECKPOINT，用户 2026-10-10 AskUserQuestion 裁定）**：按计划任务 10 步骤 2，向用户提交 C1/C2 三选一（转正 / 退役 / 维持候选+复审期限），附 SHIT 框架判定（吸收① stop-that-shit）辅助：

- **C2「无限返工循环」= SHIT 的 T（任务打转）本体**：同一 finding/任务反复修复不升级、换编号重开循环、改写 finding 定义使裁决永不收敛——既有分层反馈回路（L0-L4）五轮安全阀→🔴 CHECKPOINT 升级义务即为活文档守卫面（`subagent-delegation.md`「分层反馈回路」节点名），证据充分、跨批反复验证（批次 4 提出 → 批次 5 转正），**C2 转正**（候选区 → 反模式 #49）。
- **C1「V 评审 summary 模板化」= Verifier 漂移启发式**：与 `verifier-spec.md` R11 summary 摘要长度校验重叠、独立证据不足，**C1 维持候选并设复审期限 2027-04**（期满未转正/未退役则按候选治理重审）。

**裁定内容**：C2 转正 → 反模式 #49（五处联动：登记册 / hard-constraints 主表-速查-检测 / 计数 48→49 活体文档 / EXPECTED.maxAntiPattern / caps+baseline antiPattern 计数）；C1 保持候选 + rationale 记复审期限 2027-04。不创建「已退役反模式与约束」区（未选退役）。

**证据**：`wm-rule-lifecycle` 候选报告（C1/C2 具名登记 + 活文档引用面）；SHIT 四类判定（S 范围膨胀 / H 无用防御 / I 意图越界 / T 任务打转）中 C1=H 启发式、C2=T 本体；批次 4 设计规格 `2026-10-02-batch4-dispatch-contract-design.md` D14 候选通道记录。

**机械后果**（任务 10 落地，详见任务报告）：
- 登记册 `rule-registry.json`：C2→`ap-49`（kind=anti-pattern、status=active、boundScript=null）；C1 rationale 追加复审期限。
- `hard-constraints.md`：候选区去掉 C2；C1 候选节状态更新（复审期限 2027-04）；C2 候选节删除 + 新增详情节 `### #49 无限返工循环`；反模式主表 / 速查 / 命中高发 / 门禁对应 / 检测信号五处补 #49 行。
- 计数 48→49 全链联动：`SKILL.md` / `operation-behaviors.md` / `phase-1-requirements.md` / `quick-self-check.md` / `subagent-delegation.md` / `conventions.md` / `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `docs/user-guide.md` / SSoT / `docs/ai-native-sdlc-adoption.md`；`rule-registry-logic.ts` EXPECTED_ACTIVE_AP 48→49、`docs-consistency-logic.ts` EXPECTED.maxAntiPattern 48→49；`eval/complexity-caps.json` / `eval/complexity-baseline.json` antiPattern 计数 +1；登记册样本 `samples/registry/valid-registry.json` + 期望表镜像跟进；测试硬编码 48 期望同步（rule-registry-logic / complexity-logic / docs-consistency-logic）。

## 裁定 2：M1 棘轮预算 cap 按实测终值上调 + 追认任务 3 rounds-51 记录

**触发（任务 10 前置观测）**：真实仓库根 `check-complexity-budget.ts` 实测三处超限（cap 仍为 rounds-51 终值且该等增长发生于任务 3/6/7 强制编辑后，非复杂度漂移）：

1. `references/subagent-delegation.md` 实测 2013 > cap 2011（+2，任务 3 §6.4 登记行）；
2. `scripts/cli/self-test.ts` 实测 6179 > cap 5893（+286，任务 3 自测用例 + 任务 6/7 门禁用例注册面）；
3. `scripts/logic/docs-consistency-logic.ts` 实测 2841 > cap 2722（+119，任务 6/7 新检查接线）。

**裁定**（棘轮规则「上调唯一通道=🔴 CHECKPOINT+decision-log」）：**用户 2026-10-10 批准按实测终值上调**——

- `eval/complexity-caps.json`：`referencesExceptions["references/subagent-delegation.md"]` 2011→**2013**；`scriptsExceptions["scripts/cli/self-test.ts"]` 5893→**6179**；`scriptsExceptions["scripts/logic/docs-consistency-logic.ts"]` 2722→**2841**；`antiPatternMaxCount` 48→**49**（随裁定 1 C2 转正联动）。
- `eval/complexity-baseline.json`：`antiPatternCount` 48→49（随本批真值，其余行数面不改）。
- **追认任务 3 rounds-51 记录**：rounds-51 仅登记自测三态用例与 §6.4 登记行所致的 5893/2011，未预登记后续任务 6/7 门禁用例接线所致的增幅——本裁定一并追认（`docs-consistency-logic.ts` 2841 即任务 6/7 接线所致，归入同批 CHECKPOINT 上调通道）。
- caps 文件 `description` 登记本次 CHECKPOINT 上调与裁定日期；此后三文件 cap 只许下调。

## 防复发

- 棘轮语义不变：后续任何超限（含新增/改名文件）不再自动加豁免，只许下调或以「🔴 CHECKPOINT + decision-log」显式裁定上调。
- 反模式计数随登记册单一事实源联动（`EXPECTED.maxAntiPattern` / `EXPECTED_ACTIVE_AP` / caps / baseline 四处同源），新增反模式须走候选→复审→转正通道，不得静默改计数。
- C1 复审期限 2027-04 到期后：转正（→#50）/ 退役（移入已退役区）/ 维持候选三选一须再次经 🔴 CHECKPOINT 裁定，不得自动续期。

| 维度 | 内容 |
|---|---|
| 版本号 | 43.5.0（批次 5 代谢机制批，任务 10） |
| 门禁影响 | 无新脚本；`check-complexity-budget.ts` antiPattern 49≤49、三处超限红线消除；`check-docs-consistency` EXPECTED.maxAntiPattern 49 后无计数漂移；`check-run-log.ts` / `check-signature-chain.ts` 等不涉及 |
| 验证 | `check-complexity-budget.ts` exit 0；`check-docs-consistency` exit 0；tsc 0；定向 vitest（rule-registry-logic / complexity-logic / cli-subprocess-smoke / docs-consistency-logic）绿；`wm-rule-lifecycle` candidates 不含 C2（C1 仍在且 rationale 含复审期限 2027-04）；全量 prepush 由任务 12 收口执行 |
