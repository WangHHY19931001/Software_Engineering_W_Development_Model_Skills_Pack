# 文档一致性修正 + 防漂移脚本设计

- 日期：2026-08-10
- 状态：已批准（方案 B：拆两轮）
- 范围：活体文档一致性修正（Round 1）+ check-docs-consistency.ts 防漂移脚本（Round 2）

## 1. 背景

外部评审报告对仓库做了深入分析（实测校验 + 17 条修正意见），并经逐行复核确认。核心结论：

- 代码 / 脚本 / 测试 / 门禁层质量过硬，量化声称全部属实（self-test 249 / vitest 498 / tsc 0 错误 / pre-push 13 项等）。
- 系统性问题是「文档漂移」：内容随轮次演进（targetKind testcase/file → test/code、DoD 5→7 维度、schema 19→20 份、操作行为 6→7 条、反模式 #29→#44），但 README / AGENTS / SSoT / 部分 references 的计数与名称未同步。
- 实测澄清：exit-2 脚本数 AGENTS.md 原文「29」即为正确值（24 个 check-*.ts + 5 工具：ensure-codegraph-opsx / wm-status / metrics-report / security-scan / plan-chunks）；外部报告 m8 建议的「27」有误，执行中已回退，AGENTS 维持 29。

本轮修正全部为文档级改动，不涉及任何门禁逻辑变更（Round 1）；Round 2 新增防漂移脚本。

## 2. 原则与范围

### 2.1 活体文档（唯一修改对象）

README.md / AGENTS.md / CONTRIBUTING.md / .githooks/pre-push / w-model-dev/SKILL.md / w-model-dev/references/*.md / w-model-dev/skill-metadata.json / package.json / docs/skill-design-document_SSoT.md / docs/INSTALL.md（如涉及）。

### 2.2 历史信息处理（用户指示）

- 活体文档中的过时计数与历史证据块：**改为当前事实或删除数值**，不加「当时 N，现 M」注记。
- SSoT 轮次记录表（§3.4.x / §10A 追溯表）与轮次叙述中仅含历史数值的表述：**删除数值，保留动作描述**（不篡改轮次事实）。
- 轮次归档（docs/superpowers/plans|specs/、docs/changes/archive/、eval/）与 CHANGELOG 既有条目：**保持不动**（历史快照）。
- CHANGELOG：新增本次修正条目。

### 2.3 不误伤

「5 维度」在仓库中存在两种不同语义，仅修 DoD 语义，**不得触碰**技术选型决策矩阵「5 维度评分」、五轴评审「五轴」等其它含义。

## 3. Round 1：文档修正清单（约 68 处行级修改）

### 3.1 verifier-spec.md（targetKind 全族 11 处）

| 行 | 当前 | 修正 |
|---|---|---|
| 36 | `\| 测试用例 \| \`testcase\` \| ...` | `\| 测试 \| \`test\` \| ...` |
| 37 | `\| 代码 / 文件 \| \`file\` \| ...` | `\| 代码 \| \`code\` \| ...` |
| 48 | `\| \`testcase\` \| 阶段 1~4（设计）/ ...` | `\| \`test\` \| 阶段 1~4（设计）/ ...` |
| 49 | `\| \`file\` \| 阶段 5 编码 \| ...` | `\| \`code\` \| 阶段 5 编码 \| ...` |
| 354 | `targetKind: 'requirement' \| 'design' \| 'testcase' \| 'file' \| 'rootcause';` | `targetKind: 'requirement' \| 'design' \| 'code' \| 'test';`（注：rootcause 由 check-rootcause-report.ts 独立校验） |
| 533 | `### 7.3 测试用例（targetKind = \`testcase\`）` | `### 7.3 测试（targetKind = \`test\`）` |
| 548 | `### 7.4 代码 / 文件（targetKind = \`file\`）` | `### 7.4 代码（targetKind = \`code\`）` |
| 564 | `评审 \`targetKind=file\` 时` | `评审 \`targetKind=code\` 时` |
| 570 | `\`targetKind=file\` 的 5 个子标准（§7.4）` | `\`targetKind=code\` 的 5 个子标准（§7.4）` |
| 638 | `\`file\` 评审中只标注明显性能反模式` | `\`code\` 评审中只标注明显性能反模式` |
| 687 | `\`requirement\` / \`design\` / \`testcase\` / \`file\`（spec §2 / §7）` | `\`requirement\` / \`design\` / \`code\` / \`test\`（spec §2 / §7）` |

§2.2（4 值枚举 / 废弃映射 / 迁移策略）为正确表述，保留不动。

### 3.2 command-reference.md（3 处）

| 行 | 修正 |
|---|---|
| 59 | `targetKind=file` → `targetKind=code` |
| 72 | `targetKind=testcase` → `targetKind=test` |
| 81 | `UAT-/ST-/IT-/UT- → testcase；否则为 file` → `UAT-/ST-/IT-/UT- → test；否则为 code` |

### 3.3 agent-personas.md（12 处）

| 行 | 修正 |
|---|---|
| 138 | `targetKind=file` → `targetKind=code` |
| 246 | `targetKind=testcase` → `targetKind=test` |
| 369 | `targetKind=file` → `targetKind=code` |
| 526 | `targetKind=file` → `targetKind=code` |
| 38 / 150 / 258 / 383 | 「主要 `targetKind`：`file`/`testcase`」声明 → `code`/`test` |
| 101 / 208 / 330 / 476 | JSON 示例 `"targetKind": "file"/"testcase"` → `"code"/"test"` |

### 3.4 SSoT（19 处）

**targetKind 6 处**：

| 行 | 修正 |
|---|---|
| 1440 | test-engineer 行 `\`testcase\`` → `\`test\`` |
| 1457 | `（requirement / design / testcase / file）` → `（requirement / design / code / test）` |
| 1458 | `targetKind=file` → `targetKind=code` |
| 1459 | `targetKind=testcase` → `targetKind=test` |
| 1625 | `requirement / design / testcase / file` → `requirement / design / code / test` |
| 1631 | `（targetKind=file）` → `（targetKind=code）` |

**DoD 维度 2 处**：§10.6 表（1949-1956）补第 7 维度「签名链完整性」行（对齐 definition-of-done.md:32-34）；§10A 追溯表 :2678 维度列表补「签名链完整性」（6→7）。

**操作行为 1 处**：:2668「6 条核心操作行为」→「7 条核心操作行为」。

**角色表述 1 处**：:2659「（O/A/S/V/G/R 六角色，...」→「（O/A/S/V/G/R 六类核心角色 + R-iceberg 变体，...」。

**轮次记录删历史数值 9 处**（保留动作描述，删除已过时计数）：

| 行 | 修正 |
|---|---|
| 580 | `+ 13 份 schemas/*.schema.json` → `+ schemas/*.schema.json` |
| 921 | `19 份 schemas/*.schema.json 全量字段补充 description` → `schemas/*.schema.json 全量字段补充 description` |
| 929 | `19 份 \`schemas/*.schema.json\` 全量字段补充 \`description\`` → `\`schemas/*.schema.json\` 全量字段补充 \`description\`` |
| 966 | `29 个脚本（23 check-*.ts + 5 工具 + read-json-or-exit）exit 2 路径统一走 \`exitWithError\`` → `exit-2 脚本统一走 \`exitWithError\`（6 类错误码）` |
| 1031 | `action 枚举 +2：...，25 → 27 值` → `action 枚举 +2：...` |
| 2660 | `（13 份 draft-07）` → `（draft-07）` |
| 2690 | `（19 份，全量字段补 description）` → `（全量字段补 description）` |
| 2693 | `29 脚本 exit 2 归一化` → `exit-2 脚本全量归一化` |
| 2697 | `（action 25→27）` → `（action 枚举 +2）` |

### 3.5 README.md（5 处）

| 行 | 修正 |
|---|---|
| 82 | `6 条核心操作行为` → `7 条核心操作行为` |
| 83 | `5 维度（功能 / 质量 / 测试 / 文档 / 部署）` → `7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）` |
| 152 | `（O/A/S/V/G/R 六角色 + 分派模板 + 回填契约）` → `（O/A/S/V/G/R 六类核心角色 + R-iceberg 变体 + 分派模板 + 回填契约）` |
| 267 | `O/A/S/V/G/R 六角色 + 分派模板 + 回填契约` → `O/A/S/V/G/R 六类核心角色 + R-iceberg 变体 + 分派模板 + 回填契约` |
| 276 | `（5 维度）` → `（7 维度）` |

### 3.6 AGENTS.md（2 处）

| 行 | 修正 |
|---|---|
| 20 | `全仓 29 个脚本 exit 2` → `全仓 27 个脚本 exit 2` |
| §8 表 | check-code-tla-consistency 退出码 `0=通过，1=失败` → `0=通过，1=校验失败，2=输入错误` |

### 3.7 definition-of-done.md（2 处）

| 行 | 修正 |
|---|---|
| 65 | `五维度自检` → `七维度自检` |
| 83 | `五维度（测试 / 行为 / 文档 / RTM / 状态）中` → `七维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）中` |

### 3.8 anti-patterns.md（8 处）

| 行 | 修正 |
|---|---|
| 9 | 目录 `（#1~#19 + #20 + #21~#30 + #33~#44；...` → `（#1~#44；...`（保留括注） |
| 49 | `schema 清单 19 份` → `schema 清单 20 份` |
| 142 | `schema 清单（19 份）` → `schema 清单（20 份）` |
| 373 | 历史证据块（13 份 schema / 10 个 *-logic.ts / self-test 99→111 / vitest 90 测试 9 文件）→ 删除历史数值，仅保留方法要点 |
| 736 | `反模式 #1~#29` → `反模式 #1~#44` |
| 774 | `流程反模式 #1~#29` → `流程反模式 #1~#44` |
| 833 | `已收录的 #1~#29` → `已收录的 #1~#44` |
| 855 | `正式加入 #1~#19 或 F1~F10 或 O1~O6 清单` → `正式加入 #1~#44 或 F1~F10 或 O1~O6 清单` |

### 3.9 data-models.md（2 处）

| 行 | 修正 |
|---|---|
| 822 | `### Schema 清单（19 份）` → `### Schema 清单（20 份）`，并在表格末尾补 iceberg-sweep 行（`\`iceberg-sweep\` \| \`iceberg-sweep.schema.json\` \| IcebergSweepReport \| additionalProperties:false；reportId/phase/triggerType/icebergRound/线索来源/newFindings/sweepCoverage/summary/passed \| iceberg-sweep-logic.ts`） |
| 832 | `action enum（15 类）` → `action enum（27 类）` |

### 3.10 glossary.md（1 处）

:49 action 枚举对齐 run-log.schema.json 27 值（chunk/cross/evolve/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback/rootcause/fix/emergency-fix/escalate/r3-*/codegraph_query/opsx_*/ensure_deps/iceberg-sweep/iceberg-review；V 评审用 `review` 非 `verify`）。

### 3.11 subagent-delegation.md（1 处）

:22 `## 角色划分（O / S / V / G / A / R）` → `## 角色划分（六类核心角色 O / S / V / G / A / R + R-iceberg 变体）`。

### 3.12 CONTRIBUTING.md（1 处）

:11 仅声明 `tsx` + vitest → 声明 `tsx` + `ajv`/`ajv-formats`（schema 校验 runtime 依赖）+ `eslint-plugin-security`（安全扫描）+ `@typescript-eslint/*` + `vitest` 等开发依赖。

### 3.13 .githooks/pre-push（1 处）

:138 `12 项检查（第 12 项 npm audit 为 warn-only）` → `13 项检查（第 13 项 npm audit 为 warn-only）`。

### 3.14 版本号与 CHANGELOG

- package.json / w-model-dev/skill-metadata.json（updatedAt 同步 2026-08-10）/ SKILL.md frontmatter：`38.2.0` → `38.3.0`（三处同步）。
- CHANGELOG.md 顶部新增 [38.3.0] 条目，摘要上述修正。

## 4. Round 2：check-docs-consistency.ts 防漂移脚本

### 4.1 结构（仿既有脚本约定）

- `w-model-dev/scripts/logic/docs-consistency-logic.ts`：纯逻辑，无 IO。
- `w-model-dev/scripts/cli/check-docs-consistency.ts`：CLI，exit `0=通过 / 1=校验失败 / 2=输入错误`，错误结构走 `lib/cli-error.ts`。
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`：vitest 覆盖各检查项通过/失败样本。
- **不新增 self-test 基线样本**（避免 249 计数级联）；不新增 schema 文件。

### 4.2 检查项（全部确定性，无 LLM）

1. **schema 一致性**：`schemas/` 目录文件数 == 20；data-models.md「Schema 清单」表逐文件覆盖每个 schema 文件名。
2. **run-log action 枚举**：run-log.schema.json `action.enum` 长度 == 27；data-models.md run-log 行含「27 类」。
3. **targetKind 一致性**：verifier-spec.md / command-reference.md / agent-personas.md / SSoT 中不得出现废弃标记（`targetKind=file`、`targetKind=testcase`、`targetKind = \`file\``、`targetKind = \`testcase\``、`targetKind：\`file\``、`targetKind：\`testcase\``、`"targetKind": "file"`、`"targetKind": "testcase"`）；verifier-spec §2.2 须含 4 值枚举行。
4. **DoD 维度**：definition-of-done.md「七维度标准」表维度数 == 7；README 含「7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）」且不含「5 维度（功能」。
5. **操作行为**：SKILL.md 含「七条操作行为」；README 含「7 条核心操作行为」且不含「6 条核心操作行为」。
6. **反模式**：anti-patterns.md 反模式表最大编号 == 44；目录行含「#1~#44」。
7. **exit-2 脚本数**：脚本目录实测计数（check-*.ts 25 + 5 工具 ensure-codegraph-opsx/wm-status/metrics-report/security-scan/plan-chunks，含自身）== 30；AGENTS.md 含「30 个脚本」且无「29 个脚本」「27 个脚本」。
8. **pre-push 项数**：pre-push 编号注释最大值与「N 项检查」注释一致。
9. **glossary action**：action 条目含 `review` 且不含 `verify`。
10. **资产计数**：`subagent/` 人格文件数 == 28；`.cursor/skills` 目录数 == 23。

### 4.3 接入与级联

- package.json 新增 `"check:docs-consistency"` script。
- pre-push 新增检查 #14：`13 项` → `14 项`（同步更新 pre-push:138 注释、README/AGENTS 中所有「13 项」计数）。
- AGENTS.md §8 脚本导航表 + SKILL.md Bundled Resources 表登记新脚本。
- **exit-2 脚本数级联**：新脚本自身 exit 2，实测计数 29 → 30；AGENTS.md「29 个脚本」→「30 个脚本」。
- 版本 `38.3.0` → `38.4.0`（三处同步）+ CHANGELOG 新增条目。

## 5. 验证方案

Round 1：

- `tsc --noEmit` 0 错误（文档改动理论上不触发，防误触）。
- `npm run self-test` 249 基线不变。
- `npx vitest run scripts/__tests__/` 全绿。
- 手工 `grep` 复核：全仓活体文档零残留（`targetKind=file`、`targetKind=testcase`、`29 个脚本`、`19 份`、`13 份 schema`、`5 维度（功能`、`#1~#29`、`#1~#19`、`六角色`、`6 条核心操作行为`、`12 项检查`、`15 类`）。

Round 2：

- `npm run check:docs-consistency` 通过；故意破坏样本（如临时改 data-models 计数）→ exit 1。
- vitest 新增用例全绿；self-test 249 基线不变。
- pre-push 全绿（14 项）。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| 误伤「选型矩阵 5 维度 / 五轴评审」等其它语义 | 修正仅限 DoD 语境，grep 复核白名单 |
| SSoT 轮次记录改写破坏追溯 | 只删数值不动事实，且 SSoT 为活体文档属本轮修正范围 |
| 计数级联遗漏（13→14、38.3→38.4） | Round 2 计划中显式列出全部级联点 |
| 新脚本检查项与文档耦合过紧 | 检查项以「文件存在 + 关键行匹配」为主，避免脆断 |
