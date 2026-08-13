# `/wm` 命令参考

> 仅在执行 `/wm` 命令时读取。本文件定义输入、输出、失败动作和状态更新；阶段内容仍以对应 `phase-N-*.md` 为准。
>
> **编排者-子代理边界**：所有实施动作（产出 / 评审 / 门禁）由子代理执行，编排者（O）只路由 + CHECKPOINT + 状态持久化 + 只读脚本。详见 [subagent-delegation.md](subagent-delegation.md)。下表「执行方」列标注每个动作由哪个角色执行（O / S / V / G）。

## 目录

- 通用命令规则
- `/wm analyze`、`design`、`code`、`test`
- `/wm review`、`status`、`metrics`、`hill-climbing`、`help`
- `/wm reset`、`export`、`import`

## 通用命令规则

1. 编排者（O）先读取 `.w-model/project.json` 与 `.w-model/rtm.json`；首次 `/wm analyze` 可初始化。**编排者只可读取/更新状态文件，不得修改 RTM 实体字段**（实体字段由 S 子代理更新）。
2. 编排者（O）检查命令所需上游阶段产物；缺失时拒绝执行并给出返回命令。
3. 编排者（O）只加载 `SKILL.md` + 当前阶段 `phase-N-*.md` 摘要 + `rtm-guide.md`；阶段细则由 S 子代理按需加载。
4. 编排者（O）所有状态写操作完成后同步 `updatedAt`；只有阶段放行后才更新 `status`。
5. 编排者（O）写入前使用项目语言可用的原子写入方式（临时文件后 rename），避免并发写坏 JSON。
6. **实施动作分派**：产出由 S 子代理执行；评审由 V 子代理执行；门禁由 G 子代理执行。编排者越权实施命中反模式 #10（见 [anti-patterns.md](anti-patterns.md) #10）。

## `/wm analyze <需求>`

- **路由**：阶段 1 需求分析。
- **执行方**：O 路由 + CHECKPOINT → **S 产出** → **V 评审** → **G 门禁** → O 持久化。
- **输入**：需求描述、业务背景；首次进入还需技术栈。
- **读取**（S 子代理）：`phase-1-requirements.md`、`rtm-guide.md`、需求与测试模板。
- **产出**（S 子代理）：需求规格、验收测试设计、风险清单、RTM 初始映射。
- **评审**（V 子代理）：按 `targetKind=requirement` 路由 Persona，产出 `VerifierOutput` JSON。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts`，回填 `{exitCode, qualityLevel, passed, reworkHints}`。
- **ingestion**：触发 A 角色 ingestion 子流程（`plan-chunks` → A-chunk → A-cross → G 图谱校验 → 收敛循环），产出 `graph.json`（REQ 节点）；A→S 路径——先由 A 收敛图谱（连通 + 单根），再分派 S 读 `graph.json` 产出需求规格。详见 [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md)。
- **失败**：信息不足时列出缺失项并暂停；不得猜测关键业务规则。评审未通过由 O 分派 S 返工。
- **状态**（O）：初始化为“需求分析”；阶段门与用户均放行后才更新为“系统设计”。

## `/wm design type=<架构|概要|详细>`

| `type` | 路由 | 必需上游产物 | 同步测试设计 |
|---|---|---|---|
| `架构` | 阶段 2 系统设计 | 已放行需求规格 | 系统测试 |
| `概要` | 阶段 3 概要设计 | 已放行系统设计 | 集成测试 |
| `详细` | 阶段 4 详细设计 | 已放行概要设计 | 单元测试 |

- **执行方**：O 路由 + CHECKPOINT → **S 产出** → **V 评审** → **G 门禁** → O 持久化。
- **产出**（S 子代理）：对应设计文档 + 同步测试设计 + RTM 设计/接口/详细列。
- **评审**（V 子代理）：按 `targetKind=design` 路由 Persona（系统设计可选 security-auditor 架构评审）。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts` 回填证据。
- **ingestion**：触发 A 角色 ingestion 子流程（S→A 路径——S 先产出正式设计文档，再 A-chunk 分块 → A-evolve 图谱演进 → G 跑 `check-requirement-graph.ts` → 收敛循环）；按 `type` 追加对应节点到 `graph.json`：`架构`→SD 节点（implements 校验）、`概要`→INTF 节点（defines 校验）、`详细`→DD 节点（realizes 校验，零违反硬约束才放行进编码）。详见 [graph-guide.md](graph-guide.md)。
- **失败**：`type` 缺失/非法返回合法值；上游产物缺失则拒绝跳阶段。评审未通过由 O 分派 S 返工。
- **状态**（O）：对应阶段门与用户放行后才切换到下一阶段。

## `/wm code <功能>`

- **路由**：阶段 5 编码实现。
- **执行方**：O 路由 + CHECKPOINT → **S 产出代码 + 单测 + 跑测试运行器 + RTM 代码列** → **V 代码审查** → **G 门禁** → O 持久化。
- **前置**：存在已放行详细设计和单元测试设计。
- **读取**（S 子代理）：`phase-5-coding.md`、`rtm-guide.md`；质量检查时追加 `quality-standards.md`。
- **产出**（S 子代理）：实现代码、单元测试、测试与覆盖率输出、代码检查结果、RTM 代码映射。
- **评审**（V 子代理）：按 `targetKind=code` 路由 `code-reviewer` Persona（五轴评审）。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts` 回填证据。
- **失败**：没有详细设计时拒绝编码并引导 `/wm design type=详细`；测试/编译/lint 失败时留在阶段 5。评审未通过由 O 分派 S 返工。
- **状态**（O）：代码评审、单元测试和覆盖率门槛均满足且用户放行后才能进入“集成测试”。

## `/wm test type=<类型> result=<pass|fail>`

- **类型**：`单元 | 集成 | 系统 | 验收`。
- **执行方**：O 路由 + CHECKPOINT → **S 执行测试运行器 + 回填 RTM 执行结果** → **V 评审测试报告** → **G 门禁**（阶段 8 跑 `check-artifact-gate.ts`）→ O 持久化。
- **必要证据**（S 子代理产出）：测试命令、退出码、`passed/failed/pending`；单元测试还需覆盖率。
- **真实回填**（S 子代理）：`result` 必须与测试输出一致；缺证据或冲突时拒绝回填。**编排者不得直接回填 RTM 执行结果**。
- **`pass`**（S 子代理）：仅将实际通过用例标为通过，并更新 `executionSummary.<type>Test`。
- **`fail`**（S 子代理）：记录失败用例、根因和关联模块，更新 RTM，按阶段参考回退。
- **评审**（V 子代理）：按 `targetKind=test` 路由 `test-engineer` Persona。
- **门禁**（G 子代理）：阶段 1~7 跑 `check-verifier-output.ts`；阶段 8 跑 `check-artifact-gate.ts`。
- **产出**（S 子代理）：使用 `templates/test-report.md` 生成测试报告。
- **禁止**：未执行即标通过、LLM 估算结果、`result` 缺省、把 pending 当 passed、**编排者越权回填 RTM 实体**（反模式 #10）。

## `/wm review <target>`

返回评审指引，不由命令本身调用 LLM。**编排者不得自评**——评审必须分派 V 子代理执行（反模式 #10）：

1. 编排者（O）按前缀识别目标：`REQ-` → requirement；`DESIGN-` → design；`UAT-/ST-/IT-/UT-` → test；否则为 code。
2. 编排者（O）读取 `verifier-spec.md` 对应子标准与提示词占位符。
3. 编排者（O）输出 `targetKind`、目标、子标准、提示词占位符和以下命令：

```bash
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<output.json>"
```

4. 编排者（O）分派 V 子代理按 Persona 产出 `VerifierOutput` JSON，再分派 G 子代理跑上述命令。
5. 编排者（O）说明 A/B 且 `passed=true` 才能进入用户放行检查点；C/D 由 O 分派 S 子代理按 `reworkHints` 返工。

## `/wm status`

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/wm-status.ts <project-dir> [--json]`（project-dir 默认 cwd）：
  - 只读 `.w-model/project.json`（必读）、`.w-model/rtm.json` 与 `.w-model/run-log.jsonl`（缺失降级），输出：
    1. 当前阶段与 `updatedAt`；
    2. 已完成阶段数 / 8 与进度；
    3. RTM 已覆盖需求数 / 总需求数（coverageStatus=100% 计数）；
    4. 四级测试 `total/passed/failed/pending`；
    5. 最近 3 条动作；
    6. 确定性下一步建议。
  - `--json` 输出单行 `StatusReport` JSON（供展示证据或机器消费）。
- 退出码：0 = 正常（含未初始化提示「项目未初始化」）；2 = project/rtm JSON 损坏（转 `operational-recovery.md`，不得猜测状态）。

## `/wm metrics`

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/metrics-report.ts <project-dir> [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]`：
  - 必读 `.w-model/run-log.jsonl`，可选读 `.w-model/budget.json`（缺失时预算区为 null）；
  - 输出 9 节流程度量摘要：总体（tokens/耗时/分派/返工）、阶段汇总、动作分布、角色分布、结果分布、门禁通过率、返工连续段、预算 burn rate 与 killSwitch 预警、预警列表；
  - `--json` 输出完整报告 JSON；`--out <path>` 写入文件；`--phase`/`--from`/`--to` 过滤。
- 退出码：0 = 生成成功（预警不改退出码）；2 = run-log 缺失 / `--phase` 非法 / JSON 损坏。
- 纯报告无门禁语义：预算超限/返工超阈仅预警，拦截仍由 `check-budget.ts` 与门禁流程承担（反模式 #3/#6）。

## `/wm hill-climbing`

- **执行方**：O 确定性分析 run-log，不分派子代理；**无 LLM 调用**（约束 4：基于实际记录，不 LLM 估算）。
- **适用**：L2+ 项目（maturity.level ≥ L2）。
- 分析 `.w-model/run-log.jsonl`（可选 `--from=ISO` / `--to=ISO` 时间窗口、`--phase=N` 阶段过滤），产出 `HarnessImprovementReport`：
  1. 信号（signal）：类别 `prompt` / `tool` / `verification-rule` / `anti-pattern` / `maturity` / `budget`，严重度 S1-S3，含 run-log 证据引用与量化指标（occurrences/trend）；
  2. 元分析（metaAnalysis）：Top 失败模式、返工热点阶段、V-G 矛盾次数、预算消耗趋势、O 失败模式命中频次、acknowledgedDecisions 信息质量；
  3. 改进建议（recommendations）：promptTweaks / toolImprovements / verificationRuleTightening / candidateAntiPatterns / maturityAdjustments；
  4. 应用状态（applicationStatus）：人审后由用户填写 reviewedBy / appliedSignals / deferredSignals / rejectedSignals。
- 产出存 `.w-model/hill-climbing/<timestamp>-report.json`（符合 `hill-climbing-report.schema.json`）。
- **边界（反模式 #10）**：只产出改进信号，**不自动改 prompt/工具/验证规则**；外部 SkillOpt/darwin-skill 消费信号做演化，人审后手动应用。详见 [hill-climbing-guide.md](hill-climbing-guide.md)。

## `/wm help`

- **执行方**：O 只读，不分派子代理。
- 输出命令速查、阶段与测试对应关系，以及以下五条：测试设计前置、阶段门不可跳过、测试结果必须真实、退出码 1/2 不得放行、**编排者不得越权实施（反模式 #10）**。不读取项目状态。

## `/wm reset`

- **执行方**：O 执行（仅状态文件操作，非阶段产物，不构成越权实施）。
> 🔴 **CHECKPOINT · 重置确认**：执行前展示将删除的实体和将保留的项目元信息，必须获得确认。

- **保留**：`id/name/description/techStack/createdAt`。
- **清空**：需求、设计、测试用例、RTM 实体与执行结果。
- **重置**：`status=需求分析`，刷新 `updatedAt`。
- 用户拒绝时不修改文件，也不重复施压。

## `/wm export [输出目录]`

- **执行方**：O 只读导出，不分派子代理。
- 默认目录 `./w-model-export/`。
- 生成 `project.json`、`rtm.md`、`requirements.json`、`designs.json`、`testcases.json`。
- 校验聚合文件与独立文件实体数一致；不一致时导出失败并列出差异。
- 输出路径、文件大小和实体数；路径含空格时命令参数加双引号。

## `/wm import <project.json>`

- **执行方**：O 执行（仅状态文件操作）。
1. 编排者（O）按 `data-models.md` 校验必填字段、阶段枚举、实体枚举和 ID 唯一性。
2. 校验失败列出字段路径和原因，退出码语义为 2，不写任何文件。
3. `.w-model/` 已有数据时触发覆盖确认检查点；拒绝则不写入。
4. 确认后编排者（O）原子写入 `project.json` 与 `rtm.json`，刷新 `updatedAt`。
5. 输出项目名、阶段、需求数、测试用例数和 RTM 覆盖率。

## 错误码与 ERROR_JSON 约定

所有 check-*.ts 与工具脚本的 **输入错误（exit 2）** 输出统一结构：

- **stderr**（人类可读）：`✗ [CATEGORY] <message>: <file|detail>`（类别见下表）
- **stdout**（机器可读，遵循 SSoT §10E E.1）：`ERROR_JSON {"category","message","exitCode","file"}`，`exitCode` 与 `process.exit()` 实参强一致

| 类别 | 场景 | 示例 |
|---|---|---|
| `ARG_INVALID` | 参数值非法（phase/variant/mode/node-type/max-tokens 等） | `✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数` |
| `FILE_NOT_FOUND` | 文件/目录不存在（ENOENT） | `✗ [FILE_NOT_FOUND] 文件不存在: C:\...\project.json` |
| `FILE_PARSE` | JSON 解析失败（含 JSONL 坏行） | `✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: C:\...\rtm.json` |
| `FILE_READ` | 读取异常非 ENOENT | `✗ [FILE_READ] 文件读取失败: C:\...\x.json（EACCES）` |
| `STRUCTURE_INVALID` | 合法 JSON 形状不符（顶层非对象/缺字段/类型错） | `✗ [STRUCTURE_INVALID] 结构不符: C:\...\x.json（缺 rows 数组）` |
| `UNEXPECTED` | 未预期异常（main().catch 兜底） | `✗ [UNEXPECTED] 脚本异常: <message>` |

- exit 1（校验失败）结构不变：violations 列表 + 既有 `XXX_JSON` 摘要（含 exitCode=1），不输出 ERROR_JSON。
- 异常不变量：`ERROR_JSON.exitCode` 恒等于脚本 `process.exit()` 实参（§10E E.1 防伪三层机制）。
- 流分离：stderr 承载人类诊断（`✗ [CATEGORY] ...`），stdout 仅承载机器可读 `ERROR_JSON` 行——`ERROR_JSON` 同属 stdout JSON 摘要家族（§10E E.1），可被 gate-logs 存档后由 `check-run-log.ts` R6 交叉校验（`run-log-logic.ts` `extractExitCode` 26 个标记含 ERROR_JSON）。
