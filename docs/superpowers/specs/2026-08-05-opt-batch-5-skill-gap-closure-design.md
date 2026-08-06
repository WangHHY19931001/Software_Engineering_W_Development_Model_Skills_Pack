# 第 33 轮 · 批次 5 设计：技能缺口 + 评估 + 收尾

> 触发：全仓库深入分析识别技能缺口（security-review / codegraph-exploration / performance-review）与收尾动作（版本号 33.0.0 + SSoT + CHANGELOG + 顶层文档同步）。总框架 spec 见 [2026-08-05-optimization-overview-design.md](./2026-08-05-optimization-overview-design.md) §3.5。
>
> 当前版本：`32.0.0`；目标版本：`33.0.0`（本批收尾统一升级，三处同步）。
>
> 依赖：批次 1-4 全部完成。
>
> 工作流：总框架头脑风暴 → 本批次 spec → 本批次 plan → 实施 → 回归 → 提交。

## 1. 背景与缺口（探索实测，2026-08-05）

| # | 级别 | 现状（只读探索证据） | 代价 / 风险 |
|---|---|---|---|
| 5.1 | P1 | `.cursor/skills/` 下无 security-review 技能；security-scan.ts 调用 eslint-plugin-security（规则见 .eslintrc.cjs：detect-object-injection / detect-unsafe-regex / detect-non-literal-regexp / detect-non-literal-fs-filename / detect-eval-with-expression / detect-pseudoRandomBytes）；反模式 #43（凭据脱敏）覆盖数据文件层 | 缺安全评审技能，安全扫描与凭据脱敏无流程化指引 |
| 5.2 | P2 | `.cursor/skills/` 下无 codegraph-exploration 技能；约束 #20（phase-5-coding.md:51-62）要求阶段 5 修改前调 codegraph_explore + 落盘 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`（字段 querySymbol/callers/callees/blastRadius/queryTimestamp，check-codegraph-queries.ts:26-32） | 缺 codegraph 探索技能，约束 #20 无封装指引 |
| 5.3 | P2 | `eval/` 目录仅 TSV + test-prompts.json，无 README；TSV 最新记录 2026-07-21（第 32 轮后未补跑）；darwin-skill 为外部工具，仓库内无配置/脚本 | eval 目录缺说明文档；补跑依赖外部工具 |
| 5.4 | P3 | `.cursor/skills/` 下无 performance-review 技能 | 缺性能评审技能（可选） |
| 收尾 | — | 版本号三处 32.0.0 一致；SSoT 最后轮次 §3.4.30（[32.0.0]）；CHANGELOG 最新 [32.0.0]；README/AGENTS/CONTRIBUTING/INSTALL 需同步 | 版本号未升级、轮次记录未补、顶层文档未同步 |

### 1.1 不涉及范围

- 5.3 eval 补跑依赖外部 darwin-skill，本批只补 README 说明，补跑留待外部工具执行（用户已确认）。
- 不新增运行时依赖。
- 新技能遵循 writing-skills 校验（frontmatter 规范、指令可执行、无占位符）。

## 2. 方案（3 项核心 + 收尾）

| # | 方案 | 说明 | 结论 |
|---|---|---|---|
| 5.1 | 新建 `security-review` 技能 | 对齐 security-scan.ts 规则 + 反模式 #43 凭据脱敏；指令覆盖源码级扫描 + 数据文件层凭据检查 | 采纳 |
| 5.2 | 新建 `codegraph-exploration` 技能 | 封装约束 #20 的 codegraph_explore 调用 + 落盘字段 | 采纳 |
| 5.3 | eval 补 README | 说明 TSV 格式 + darwin-skill 用法；补跑留待外部 | 采纳 |
| 5.4 | 新建 `performance-review` 技能 | 性能评审技能（视 5.1/5.2 完成后决定，本批一并新建） | 采纳 |
| 收尾 | 版本号三处 33.0.0 + SSoT §3.4.31 + CHANGELOG [33.0.0] + 顶层文档同步 | 统一收尾 | 采纳 |

### 2.1 关键决策

1. **新技能用 writing-skills 流程**：每个新技能遵循 writing-skills 校验（frontmatter 规范、指令可执行、无占位符、与 w-model-dev 对应机制对齐）。
2. **5.3 只补 README**：eval 补跑依赖外部 darwin-skill，本批补 README 说明 TSV 格式与用法，补跑留待外部（用户已确认）。
3. **5.4 一并新建**：总框架标注"可选，视 5.1/5.2 效果决定"——本批一并新建 performance-review（性能评审是明确缺口，与 security-review 对称）。
4. **版本号收尾**：三处同步 32.0.0→33.0.0（package.json + SKILL.md frontmatter + skill-metadata.json），skill-metadata.test.ts 自动验证一致性。
5. **SSoT 轮次记录**：新增 §3.4.31（第 33 轮），格式同 §3.4.30（维度|内容表格）+ §10A 追溯表追加一行。
6. **CHANGELOG**：在 [32.0.0] 上方插入 [33.0.0] 条目，遵循 Keep a Changelog（最新在上）。

## 3. 详细设计

### 3.1 security-review 技能（5.1）

新建 `.cursor/skills/security-review/SKILL.md`，frontmatter 参照 brainstorming（name/description/version/license/metadata.hermes.tags）。指令覆盖：
- **源码级安全扫描**：调用 `npm run lint:security`（security-scan.ts + eslint-plugin-security），理解 baseline v2 内容敏感指纹豁免机制；
- **凭据脱敏（反模式 #43）**：检查 `.w-model/*.json`、`.w-model/gate-logs/`、`run-log.jsonl`/`event-ingress.jsonl`/`signature-chain.jsonl` 中的硬编码密钥/令牌/密码/连接串（`sk-` 前缀、32+ 位 Base64、`Bearer `、`AKIA`、`password=`/`passwd=` 字段）；检查 SKILL.md 示例、templates/、references/ 示例含真实凭据而非占位符；
- **修复动作**：移除敏感值，改为环境变量引用名（如 `${JWT_SECRET}`）或外部 secrets 管理；修正模板/示例为占位符；
- **检查清单**：编号任务列表（源码扫描 → 数据文件层凭据检查 → 模板/示例占位符检查 → 修复 → 复扫）。

### 3.2 codegraph-exploration 技能（5.2）

新建 `.cursor/skills/codegraph-exploration/SKILL.md`。指令覆盖：
- **约束 #20 流程**：阶段 5 任何代码/测试文件 Edit/Write 前，先调宿主 Agent 的 `codegraph_explore` MCP 工具；
- **落盘字段**：`.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`，含 querySymbol/callers/callees/blastRadius/queryTimestamp（对齐 check-codegraph-queries.ts 校验）；
- **修改前影响分析**：查询 callers/callees/blast radius → 评估波及 → 安全确认后 Edit/Write → 可选再查；
- **与 code-TLA+ 一致性校验互补**：codegraph=修改前预防，code-TLA+=修改后回归。

### 3.3 eval README（5.3）

新建 `eval/README.md`：说明 TSV 格式（timestamp/commit/skill/old_score/new_score/status/dimension/note/eval_mode）、test-prompts.json 用途、darwin-skill 用法（外部工具，补跑流程）、当前最新记录（2026-07-21，第 32 轮后待补跑）。

### 3.4 performance-review 技能（5.4）

新建 `.cursor/skills/performance-review/SKILL.md`。指令覆盖：性能评审维度（响应时间/吞吐/资源占用/负载模型）、与 security-review 对称的检查清单、性能指标达标判定（P95 响应 < 2s 等，对齐 quality-standards.md）。

### 3.5 收尾

**版本号三处**：package.json:3、w-model-dev/SKILL.md:3、w-model-dev/skill-metadata.json:3 同步 32.0.0→33.0.0。

**SSoT**：`docs/skill-design-document_SSoT.md` 新增 `#### 3.4.31 第 33 轮：全仓库优化 5 批实施（2026-08-05，[33.0.0]）`，格式同 §3.4.30（维度|内容表格：触发/新增/归一化/package.json/顶层文档/self-test/vitest/TypeScript strict）；§10A 追溯表追加一行。

**CHANGELOG**：在 `## [32.0.0]` 上方插入 `## [33.0.0] - 2026-08-05` 条目，含 5 批实施摘要 + 验证（self-test 213、vitest 434、tsc 0、lint:security 0 新增）。

**顶层文档同步**：
- README.md：结构树补 3 个新技能、self-test 213、vitest 计数（核对 377 vs 363 不一致处）、版本号；
- AGENTS.md：目录速查表补 3 个新技能、self-test 213；
- CONTRIBUTING.md：self-test 213 样本清单、版本号；
- docs/INSTALL.md：version: 32.0.0→33.0.0、self-test 213、vitest 计数、结构树补新技能。

## 4. 验证策略（批次 5 验收标准）

1. **全局基线**：`npm run self-test` 213 条全通过；`npx vitest run` 全通过；`npx tsc --noEmit` 0 错误；`npm run lint:security` baseline 通过。
2. **版本一致性**：`skill-metadata.test.ts` 通过（三处 33.0.0 一致）。
3. **新技能校验**：3 个新技能通过 writing-skills 校验（frontmatter 规范、指令可执行、无占位符、与 w-model-dev 对应机制对齐）。
4. **5.3 特例**：eval/README.md 存在且说明完整。
5. **收尾特例**：SSoT §3.4.31 + §10A 追溯表、CHANGELOG [33.0.0]、顶层文档版本号/计数同步；grep 版本号 32.0.0 全仓 0 命中（除历史记录）。

## 5. 影响文件清单

| 类别 | 文件 | 动作 |
|---|---|---|
| 新增技能 | `.cursor/skills/security-review/SKILL.md` | 新增（5.1） |
| 新增技能 | `.cursor/skills/codegraph-exploration/SKILL.md` | 新增（5.2） |
| 新增技能 | `.cursor/skills/performance-review/SKILL.md` | 新增（5.4） |
| 新增 | `eval/README.md` | 新增（5.3） |
| 修改 | `package.json`、`w-model-dev/SKILL.md`、`w-model-dev/skill-metadata.json` | 版本号 33.0.0（收尾） |
| 修改 | `docs/skill-design-document_SSoT.md` | §3.4.31 + §10A（收尾） |
| 修改 | `CHANGELOG.md` | [33.0.0]（收尾） |
| 修改 | `README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md` | 同步（收尾） |

提交粒度（子任务级）：5.1 security-review → 5.2 codegraph-exploration → 5.3 eval README → 5.4 performance-review → 收尾（版本号 + SSoT + CHANGELOG + 顶层文档）。
