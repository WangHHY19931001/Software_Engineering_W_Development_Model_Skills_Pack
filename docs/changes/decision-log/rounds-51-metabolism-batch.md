# 第 51 批（批次 5，43.5.0）代谢机制——M1 棘轮预算 cap 上调裁定

> 本批为「代谢机制批」（M1 度量/预算 / M2 漂移预警-KPI 追踪 / M3 基线重跑 / M4 熵审计巡检 / M5 仓库健康仪表盘）。
> 本文件仅登记与 M1 棘轮预算 cap 上调直接相关的 CHECKPOINT 决策；批次其余决策见各任务报告与 CHANGELOG 43.5.0 节。

**M1-1 棘轮预算 cap 上调（用户 CHECKPOINT 裁定 2026-10-09，任务 3）**

- **触发**：任务 3（M1 预算）在真实仓库根跑 `check-complexity-budget.ts` 时，两处文件实测行数超过任务 2 基线 caps：
  1. `scripts/cli/self-test.ts` > cap 5766（先实测 5881，prettier 规范化后终值 5893）；
  2. `references/subagent-delegation.md` 2011 > cap 2010（+1）。
- **根因**：上调幅度全部可归因于任务 3 **强制编辑自身**（非复杂度漂移）——self-test.ts 增长来自控制者要求的自测三态用例（a 合法 caps exit 0 / b 负向 fixture exit 1 / c 坏 JSON exit 2，进程内调用形态，较任务 2 基线新增注册面）与 prettier 规范化（仓库 config：semi/singleQuote/printWidth=120/trailingComma=all 的规范输出较手写态多 12 行）；subagent-delegation.md 增长来自 §6.4 权威登记表新增 `check-complexity-budget` 行（dispatch-matrix，FC-1 注册五件套之一）。先前的单用例最小实现亦已 +20 行超限，结构性无法压回 5766。
- **裁定**（棘轮规则「上调唯一通道=🔴 CHECKPOINT+decision-log」）：**用户批准按实测值上调并留痕**——
  - `eval/complexity-caps.json`：`scriptsExceptions["scripts/cli/self-test.ts"]` 5766→**5893**（prettier 规范化后终值）；`referencesExceptions["references/subagent-delegation.md"]` 2010→**2011**。
  - caps 文件 `description` 登记本次 CHECKPOINT 上调与裁定日期；此后两 cap 只许下调。
  - 其余全部 cap 保持任务 2 基线实测值（5893/2011 之外无改动）。
- **防复发**：棘轮语义不变——后续任何超限（含新增/改名文件）不再自动加豁免，只许下调或以本通道显式裁定；异常表键必须与采集器显示路径完全一致（否则异常表不命中→误报或按 default 误报）。

| 维度 | 内容 |
|---|---|
| 版本号 | 43.5.0（批次 5 代谢机制批） |
| 门禁影响 | 新增 `cli/check-complexity-budget.ts`（M1 棘轮预算门禁，pre-push 第 20 项）；`.githooks/pre-push` 19→20 项；`logic/docs-consistency-logic.ts` EXPECTED.prePushCount 19→20；`eval/complexity-caps.json` 入库；计数同步五件套（self-test.ts / cli-subprocess-smoke.test.ts / NEGATIVE-COVERAGE.md / dispatch-matrix / SKILL.md / AGENTS.md / conventions.md / hard-constraints.md） |
| 验证 | 定向 vitest（complexity-logic + cli-subprocess-smoke）绿；`check-complexity-budget.ts` 默认 caps exit 0 / 超限 caps exit 1 / 坏 JSON exit 2；check-docs-consistency exit 0；check-samples-coverage exit 0（negativeCoverageRows 49）；全量 prepush 由控制者后台跑（首次含第 20 项） |
