# eval/ — W-Model 技能评估数据

本目录存放 W-Model 技能（`w-model-dev/`）的评估资产与记录：

| 文件 | 用途 |
| --- | --- |
| `w-model-dev-test-prompts.json` | 60 条测试提示词（id 1-60），含 category（N1-N10/A1-A3）与 route（enable/ask/skip）字段，作为技能回归测试与外部评估的标准化输入 |
| `mappings.json` | 60 条提示词 → 技能资产锚点映射（version 2），含顶层 matrix 覆盖矩阵声明 |
| `runner.ts` | 断言引擎（`npm run eval`）：L1/L1N/L2 三层断言 + notContains 守卫 + coverageMatrix 五项校验 |
| `results.json` | 最近一次全量运行结果（含 matrixProblems） |
| `w-model-dev-results.tsv` | 评估结果表（TSV，逐轮记录） |
| `e2e/` | e2e 基线与终值记录（`e2e/demo/` 为 gitignored 瞬态工作区） |

按仓库约定（AGENTS.md 目录速查表），`eval/` 是**外部工具（darwin-skill）评估产物归档，不属技能包**，Agent 一般无需读取；`w-model-dev/` 技能资产本身不含本目录。

## 1. TSV 结果表格式（w-model-dev-results.tsv）

表头一行 + 数据行，全部以 **tab（`\t`）分隔**，共 9 列：

| 列名 | 含义 |
|---|---|
| `timestamp` | 评估时间（ISO 格式，如 `2026-07-20T11:00`） |
| `commit` | 评估对象：本轮改动对应的 git commit hash（如 `a3698f2`）；由外部工具（darwin-skill）执行时为**评估会话 id**（如 `darwin-01`、`darwin-02-01`） |
| `skill` | 被测技能路径：可指向整技能（`w-model-dev`）、单文件（`w-model-dev/SKILL.md`、`w-model-dev/references/phase-2-system-design.md`）、文件分组（`w-model-dev/references/phase-1-4`），或 e2e 模式的演示项目（`w-model-dev-demo`） |
| `old_score` | 前一轮得分；dry_run 模式的**首行 baseline 记录**及 e2e 记录为 `-`（无前值可比） |
| `new_score` | 本轮得分（百分制小数，如 `85.4`）；e2e 记录为 `-`（不以单分度量） |
| `status` | 结果状态：`baseline`（仅首次评估基线行）、`keep`（其余全部，维持/采纳该轮改动） |
| `dimension` | 聚焦维度：如 `dim4检查点`、`dim5可执行具体性`、`dim9反例黑名单`、`dim7冗余消解`，或多维组合（`dim1/3/5/8`、`dim3/4/5/8/9`）；e2e 记录为 `e2e_rebuild` |
| `note` | 变更摘要（单条记录内用 `;` 分隔多个要点） |
| `eval_mode` | 评估模式：`dry_run`（离线盲评，独立 judge 对新版本技能打分）或 `e2e`（端到端重建，从零跑完整流程） |

### 记录形态

- **dry_run 模式**（共 31 条，2026-07-17 至 2026-07-20）：首条为 baseline 基线（`old_score` 为 `-`，`status=baseline`）；后续每条为一次迭代评估，`commit` 列或为 git hash、或为 darwin 会话 id，`old_score` 取上一轮 `new_score` 形成爬坡曲线（70.8 → 85.4 → 84.9 → 86.8 → … → 90.5）。
- **e2e 模式**（1 条，2026-07-21T22:30）：`commit=f79d72d`，`skill=w-model-dev-demo`，`old_score/new_score` 均为 `-`，`status=keep`，`dimension=e2e_rebuild`；note 记录端到端重建结果（8 阶段从零重建第 2 轮、107/107 通过、覆盖率 100%×4 维、gate 退出码 0、self-test 17/17、历史修复回归等）。

## 2. 测试提示词集（w-model-dev-test-prompts.json）

25 条测试提示词，每条含 4 个字段：`id`（1-25）/ `scenario`（场景名）/ `prompt`（输入提示词）/ `expected`（期望行为断言）。按场景字段归为五类：

| 类别 | id | 覆盖点 |
|---|---|---|
| 典型触发 | 1、2、4、5 | 自然语言触发、显式 `/wm` 命令、正向补齐 RTM、英文触发词同义词（W-model / RTM / stage gates） |
| 歧义场景 | 3 | 走完整流程但未明确 W 模型——应先询问确认，不直接初始化 |
| 反误触发 | 6、7 | 普通单文件修复、普通需求解释——不得强行启动 W 模型流程 |
| 流程防护 | 8-15 | 跳过详细设计直接编码、伪造测试通过、阶段门拒绝、异常恢复（RTM JSON 损坏）、跨平台路径（Windows 含空格）、验收被拒仍归档、质量门脚本退出码、Verifier 输出校验等边界与防护用例 |
| 新机制 | 16-25 | R3 缺失拦截、冰山扫掠 ICEBERG-B 未触发、TLA+ L2 跳过 TLC、BDD 头标注缺失、ingestion 第 6 轮未收敛、opsx 三段跳步、codegraph 修改前未查询、self-as-verifier 产物同路径、编排者越权实施（#10）、gate-logs exitCode 伪造等新机制防护用例 |

用途：**技能回归测试与外部评估的标准化输入**——回归测试时逐条执行并断言行为命中 `expected`；外部工具评估时以 `prompt` 字段驱动对新版本技能评分。

## 3. darwin-skill 外部评估工具

`darwin-skill`（<https://github.com/alchaincyf/darwin-skill>）是基于进化算法的技能搜索与筛选工具，与 SkillOpt 同为本仓库的**外部技能自演化/评估工具**：

- 仓库内**无 darwin-skill 的配置或脚本**——技能自演化不在本仓库（见 AGENTS.md、docs/skill-design-document_SSoT.md §11），本目录仅**归档其评估产物**；
- darwin-skill 的本地评估产物（`.claude/skills/darwin-skill/` 等）由外部工具维护，不纳入版本控制（见根 `.gitignore`）；
- TSV 中 `commit` 列的 `darwin-01`、`darwin-02-01` ~ `darwin-02-11` 即 darwin-skill 评估会话 id。

### 补跑流程

1. 用 `w-model-dev-test-prompts.json` 的提示词驱动 darwin-skill 对新版本技能评分（外部工具执行，产出得分与维度聚焦信息）；
2. 将结果按 TSV 格式（tab 分隔、9 列，`commit` 填评估会话 id 或对应 git hash）**追加**到 `w-model-dev-results.tsv`；
3. `git add` + `git commit` 提交归档。

## 4. 当前状态

> **评估已恢复（2026-08-28 起）。** 三维度优化批次 1 起重建仓内评估闭环：`eval/mappings.json`（25 条提示词→资产锚点）+ `eval/runner.ts` 断言引擎 + `npm run eval`（25/25）；e2e 端到端重建恢复并在批次 1（基线）与批次 3（终值）各完整执行一轮。批次 2（可靠性）聚焦红灯清零，评估锚点保持 25/25。

- **仓内断言**：`npm run eval` = **25/25**（批次 1 基线 `28da1d1`、批次 3 基线 `6a2d6bd` 各记 1 行 dry_run，均为 baseline/100.0）。
- **e2e 重建记录**：
  - 基线（批次 1）：`eval/e2e/2026-08-28-baseline.md` + TSV `a9808ea`——8 阶段 verifier 全 A、74/74、返工循环 3、偏差 D1-D11（D9=cucumber 证据不可满足已知红灯）；
  - **终值（批次 3）**：`eval/e2e/2026-08-28-final.md` + TSV `6a2d6bd`——**新 SKILL.md（106 非空行）**下 8 阶段 verifier 全 A（0.9295/0.8770/0.886/0.894/0.8757/0.8942/0.9028/0.9057）、四级测试 74/74、返工 8 项（1 完整 R 循环 + 7 R3-Required S-fix）、分派 ≈52（vs 基线 ≈74）、CHECKPOINT 18（判据代行）；**D9 常驻红灯由真实 cucumber 报告通道消除（零常驻红灯收尾）**；偏差登记：UAT-002 验收设计过度收紧（冻结规格权威裁定，D7 谱系）+ 超限体大客户端 ECONNRESET（R3 security Required，src/ 修复 + ≥1MB 用例防回潮）。
- TSV 最新记录：`2026-08-30T10:30:00+08:00`（commit `6a2d6bd`，dry_run 25/25 baseline + e2e 终值 keep）。
- v42.0.0 起：wave 合并重链与 SKILL.md 重写已由仓内断言 + e2e 终值双通道覆盖；外部 darwin-skill / SkillOpt 盲评仍可按 §3「补跑流程」可选补跑（非阻塞，本仓库内不伪造评估证据）。

## 5. 如何新增一条评估记录

在 `w-model-dev-results.tsv` 末尾按 tab 分隔追加一行即可，格式与既有记录一致。以下为格式演示（取值仅用于说明字段含义，不反映真实评估）：

```
2026-08-06T10:00	demo-run-01	w-model-dev/SKILL.md	90.5	92.0	keep	dim3	演示：示例变更摘要	dry_run
```

要点：

- 首行 baseline：`old_score` 填 `-`、`status` 填 `baseline`；
- dry_run 普通记录：`old_score` 取上一轮 `new_score`、`status` 填 `keep`；
- e2e 记录：`old_score`/`new_score` 均填 `-`、`dimension` 填 `e2e_rebuild`、`eval_mode` 填 `e2e`，评估结果写入 `note`；
- 追加后 `git add eval/w-model-dev-results.tsv` 并提交。

## 6. 覆盖矩阵（coverageMatrix）

`mappings.json` 顶层 `matrix` 声明 `routeTotals` / `minPerCategory` / `guidePath`；`npm run eval` 据此校验：① 语料与映射 route/category 对齐 ② 各 route 总数符合声明 ③ 每类别条数 ≥ 下限 ④ `activation-guide.md` 每类别节示例数 == 该类语料条数（双向锚定，防双份维护漏改）⑤ 每负向类别 ≥1 组「立即启用」行 notContains 守卫。任一不符即 exit 1。
