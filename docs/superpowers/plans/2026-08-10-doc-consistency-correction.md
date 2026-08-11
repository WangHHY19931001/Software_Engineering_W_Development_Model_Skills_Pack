# 文档一致性修正 + 防漂移脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正全部活体文档漂移（targetKind 废弃值 / DoD 维度 / 操作行为 / schema 份数 / 反模式范围 / 脚本计数 / pre-push 项数 / 角色表述 / action 枚举 / devDeps），并新增 check-docs-consistency.ts 防漂移门禁。

**Architecture:** 拆两轮。Round 1：约 60 处行级文档修正 + 版本 38.3.0（三处同步）+ CHANGELOG 条目，不涉及脚本逻辑。Round 2：新增 `docs-consistency-logic.ts`（纯逻辑）+ `check-docs-consistency.ts`（CLI，exit 0/1/2）+ vitest 测试，接入 pre-push（13→14 项级联），exit-2 脚本数 29→30 级联，版本 38.4.0。

**Tech Stack:** TypeScript strict（tsx runtime）、vitest、Markdown 文档编辑。

**设计文档（SSoT）:** `docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md`

---

## 文件结构

**Round 1 修改（活体文档）：** README.md / AGENTS.md / CONTRIBUTING.md / .githooks/pre-push / w-model-dev/SKILL.md（frontmatter 版本）/ w-model-dev/references/{verifier-spec,command-reference,agent-personas,definition-of-done,anti-patterns,data-models,glossary,subagent-delegation}.md / docs/skill-design-document_SSoT.md / package.json / w-model-dev/skill-metadata.json / CHANGELOG.md（新增条目）。

**Round 2 新增：** `w-model-dev/scripts/docs-consistency-logic.ts`（纯逻辑）/ `w-model-dev/scripts/check-docs-consistency.ts`（CLI）/ `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（vitest）。修改：package.json（script + version）/ .githooks/pre-push（#14）/ AGENTS.md（§8 表 + 计数）/ w-model-dev/SKILL.md（Bundled Resources + frontmatter）/ README.md（14 项）/ w-model-dev/skill-metadata.json / CHANGELOG.md。

---

# Round 1：文档修正（Task 1-13）

### Task 1: verifier-spec.md targetKind 全族修正（11 处）

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 修正 §2 适用目标类型表（L36-37）**

`| 测试用例 | \`testcase\` | \`UAT-\` / \`ST-\` / \`IT-\` / \`UT-\` | §7.3 |` → `| 测试 | \`test\` | \`UAT-\` / \`ST-\` / \`IT-\` / \`UT-\` | §7.3 |`
`| 代码 / 文件 | \`file\` | （文件路径） | §7.4 |` → `| 代码 | \`code\` | （文件路径） | §7.4 |`

- [ ] **Step 2: 修正 §2.1 目标类型与产出阶段表（L48-49）**

`| \`testcase\` | 阶段 1~4（设计）/ 阶段 5~8（执行） | 验收/系统/集成/单元测试用例 |` → `| \`test\` | 阶段 1~4（设计）/ 阶段 5~8（执行） | 验收/系统/集成/单元测试用例 |`
`| \`file\` | 阶段 5 编码 | 源代码文件（\`.ts\` / \`.py\` / \`.java\` 等） |` → `| \`code\` | 阶段 5 编码 | 源代码文件（\`.ts\` / \`.py\` / \`.java\` 等） |`

- [ ] **Step 3: 修正 §6 输出 Schema 接口（L354）**

`    targetKind: 'requirement' | 'design' | 'testcase' | 'file' | 'rootcause';` → `    targetKind: 'requirement' | 'design' | 'code' | 'test'; // 4 值枚举（§2.2）；rootcause 由 check-rootcause-report.ts 独立校验`

- [ ] **Step 4: 修正 §7.3 / §7.4 节标题（L533 / L548）**

`### 7.3 测试用例（targetKind = \`testcase\`）` → `### 7.3 测试（targetKind = \`test\`）`
`### 7.4 代码 / 文件（targetKind = \`file\`）` → `### 7.4 代码（targetKind = \`code\`）`

- [ ] **Step 5: 修正 §7.4A 两处引用（L564 / L570）**

`> 1. 评审 \`targetKind=file\` 时，发现项按五轴组织；` → `> 1. 评审 \`targetKind=code\` 时，发现项按五轴组织；`
`\`targetKind=file\` 的 5 个子标准（§7.4）与 addyosmani 五轴的映射：` → `\`targetKind=code\` 的 5 个子标准（§7.4）与 addyosmani 五轴的映射：`

- [ ] **Step 6: 修正 §7.4 性能轴（L638）**

`独立验证，\`file\` 评审中只标注明显性能反模式` → `独立验证，\`code\` 评审中只标注明显性能反模式`

- [ ] **Step 7: 修正 §8 提示词占位符（L687）**

`评审目标类型，\`requirement\` / \`design\` / \`testcase\` / \`file\`（spec §2 / §7）` → `评审目标类型，\`requirement\` / \`design\` / \`code\` / \`test\`（spec §2 / §7）`

- [ ] **Step 8: 复核**

Run: `npx grep -rn "targetKind=file\|targetKind=testcase\|targetKind = \`file\`\|targetKind = \`testcase\`" w-model-dev/references/verifier-spec.md`
Expected: 0 命中（§2.2 废弃映射/迁移策略中无 targetKind= 前缀形式，不命中）。

- [ ] **Step 9: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs: fix targetKind enum drift in verifier-spec (testcase/file -> test/code)"
```

### Task 2: command-reference.md + agent-personas.md targetKind 修正（7 处 + 延伸 8 处）

**Files:**
- Modify: `w-model-dev/references/command-reference.md`
- Modify: `w-model-dev/references/agent-personas.md`

- [ ] **Step 1: command-reference.md L59 / L72 / L81**

`- **评审**（V 子代理）：按 \`targetKind=file\` 路由 \`code-reviewer\` Persona（五轴评审）。` → `- **评审**（V 子代理）：按 \`targetKind=code\` 路由 \`code-reviewer\` Persona（五轴评审）。`
`- **评审**（V 子代理）：按 \`targetKind=testcase\` 路由 \`test-engineer\` Persona。` → `- **评审**（V 子代理）：按 \`targetKind=test\` 路由 \`test-engineer\` Persona。`
`1. 编排者（O）按前缀识别目标：\`REQ-\` → requirement；\`DESIGN-\` → design；\`UAT-/ST-/IT-/UT-\` → testcase；否则为 file。` → `1. 编排者（O）按前缀识别目标：\`REQ-\` → requirement；\`DESIGN-\` → design；\`UAT-/ST-/IT-/UT-\` → test；否则为 code。`

- [ ] **Step 2: agent-personas.md L138 / L246 / L369 / L526**

`- **经 \`/wm review\` 调用**：\`targetKind=file\` 时默认路由到本 Persona。` → `...\`targetKind=code\` 时默认路由到本 Persona。`
`- **经 \`/wm review\` 调用**：\`targetKind=testcase\` 时路由到本 Persona。` → `...\`targetKind=test\` 时路由到本 Persona。`
`- **经 \`/wm review\` 调用**：\`targetKind=file\` 且文件涉及安全敏感面` → `...\`targetKind=code\` 且文件涉及安全敏感面`
`- **经 \`/wm review\` 调用**：\`targetKind=file\` 且文件涉及性能热点` → `...\`targetKind=code\` 且文件涉及性能热点`

- [ ] **Step 3: agent-personas.md「主要 targetKind」声明与 JSON 示例（延伸 8 处，执行中发现的同族遗漏）**

L38 `- 主要 \`targetKind\`：\`file\`` → `- 主要 \`targetKind\`：\`code\``
L101 `    "targetKind": "file",` → `    "targetKind": "code",`
L150 `- 主要 \`targetKind\`：\`testcase\`` → `- 主要 \`targetKind\`：\`test\``
L208 `    "targetKind": "testcase",` → `    "targetKind": "test",`
L258/L383 `- 主要 \`targetKind\`：\`file\` / \`design\`` → `- 主要 \`targetKind\`：\`code\` / \`design\``（两处）
L330/L476 `    "targetKind": "file | design",` → `    "targetKind": "code | design",`（两处）

> 同内容行（258/383、330/476）用携带相邻行的长片段确保精确替换到对应 persona。

- [ ] **Step 4: 复核 + 两次 Commit**

Run: `npx grep -rn "targetKind=file\|targetKind=testcase" w-model-dev/references/command-reference.md w-model-dev/references/agent-personas.md` → 0 命中；另查 `targetKind：\`file\``、`targetKind：\`testcase\``、`"targetKind": "file"`、`"targetKind": "testcase"` → 0 命中。
```bash
git add w-model-dev/references/command-reference.md w-model-dev/references/agent-personas.md
git commit -m "docs: fix targetKind enum drift in command-reference and agent-personas"
git add w-model-dev/references/agent-personas.md
git commit -m "docs: fix remaining targetKind drift in agent-personas (major targetKind declarations and JSON examples)"
```

### Task 3: README.md 修正（5 处）

**Files:**
- Modify: `README.md`

- [ ] **Step 1: L82 操作行为 6→7**

`- **负面知识库**：6 条核心操作行为 + 10 条失败模式` → `- **负面知识库**：7 条核心操作行为 + 10 条失败模式`

- [ ] **Step 2: L83 DoD 维度**

`- **项目级 Definition of Done**：5 维度（功能 / 质量 / 测试 / 文档 / 部署）的每次变更日常标准` → `- **项目级 Definition of Done**：7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）的每次变更日常标准`

- [ ] **Step 3: L152 / L267 角色表述**

`│   │   ├── subagent-delegation.md# 编排者-子代理边界（O/A/S/V/G/R 六角色 + 分派模板 + 回填契约）` → `│   │   ├── subagent-delegation.md# 编排者-子代理边界（O/A/S/V/G/R 六类核心角色 + R-iceberg 变体 + 分派模板 + 回填契约）`
`- [编排者-子代理边界](./w-model-dev/references/subagent-delegation.md) - O/A/S/V/G/R 六角色 + 分派模板 + 回填契约` → `- [编排者-子代理边界](./w-model-dev/references/subagent-delegation.md) - O/A/S/V/G/R 六类核心角色 + R-iceberg 变体 + 分派模板 + 回填契约`

- [ ] **Step 4: L276 DoD 维度**

`- [项目级 DoD](./w-model-dev/references/definition-of-done.md) - 每次变更的日常标准（5 维度）` → `- [项目级 DoD](./w-model-dev/references/definition-of-done.md) - 每次变更的日常标准（7 维度）`

- [ ] **Step 5: 复核 + Commit**

Run: `npx grep -n "6 条核心操作行为\|5 维度（功能\|六角色\|（5 维度）" README.md` → 0 命中。
```bash
git add README.md
git commit -m "docs: fix README drift (operating behaviors 7, DoD 7 dimensions, roles + R-iceberg)"
```

### Task 4: AGENTS.md 修正（3 处）

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 核对 exit-2 脚本数（保持 29）**

实测口径：24 个 check-*.ts + 5 工具（ensure-codegraph-opsx / wm-status / metrics-report / security-scan / plan-chunks，均含 exitWithError exitCode:2 路径）= **29**。AGENTS.md「全仓 29 个脚本 exit 2」为正确值，**保持不变**（曾误改为 27 后已回退，见 Task 4-fix）。

- [ ] **Step 2: §3 常用命令 check-code-tla-consistency 退出码**

`阶段 5 代码-TLA+ 一致性回归，退出码 0/1` → `阶段 5 代码-TLA+ 一致性回归，退出码 0/1/2`

- [ ] **Step 3: §8 脚本导航表 check-code-tla-consistency 行**

`| check-code-tla-consistency.ts | 代码-TLA+ 一致性回归（四维度：SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | 5 | 0=通过，1=失败 |` → `| check-code-tla-consistency.ts | 代码-TLA+ 一致性回归（四维度：SD→codeModule / 代码状态转移 / Next 分支 / 不变式覆盖） | 5 | 0=通过，1=校验失败，2=输入错误 |`

- [ ] **Step 4: 复核 + Commit**

Run: `npx grep -n "29 个脚本\|退出码 0/1$" AGENTS.md` → 0 命中。
```bash
git add AGENTS.md
git commit -m "docs: fix AGENTS exit-2 script count (27) and check-code-tla-consistency exit codes"
```

### Task 5: definition-of-done.md 修正（2 处）

**Files:**
- Modify: `w-model-dev/references/definition-of-done.md`

- [ ] **Step 1: L65 / L83**

`| DoD（本文件） | 每次变更后 | 五维度自检 | 软性（违反不回退但降低质量） |` → `| DoD（本文件） | 每次变更后 | 七维度自检 | 软性（违反不回退但降低质量） |`
`- 五维度（测试 / 行为 / 文档 / RTM / 状态）中，RTM 与状态是 W 模型特有的；测试 / 行为 / 文档与 addyosmani 一致。` → `- 七维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）中，RTM 与状态是 W 模型特有的；测试 / 行为 / 文档与 addyosmani 一致。`

- [ ] **Step 2: 复核 + Commit**

Run: `npx grep -n "五维度" w-model-dev/references/definition-of-done.md` → 0 命中。
```bash
git add w-model-dev/references/definition-of-done.md
git commit -m "docs: fix DoD dimension count 5->7 in definition-of-done"
```

### Task 6: anti-patterns.md 修正（8 处）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: L9 目录连续区间**

`- 反模式清单（#1~#19 + #20 + #21~#30 + #33~#44；#20 在 subagent-delegation.md；#30 第 20 轮新增；#33~#41 见各 detailed 节；#42 第 29 轮新增；#43 第三十一轮新增；#44 第 36 轮新增）` → `- 反模式清单（#1~#44；#20 在 subagent-delegation.md；#30 第 20 轮新增；#33~#41 见各 detailed 节；#42 第 29 轮新增；#43 第三十一轮新增；#44 第 36 轮新增）`

- [ ] **Step 2: L49 / L142 schema 份数 19→20**

L49（#28 行）末尾：`「JSON Schema 强约束」节 schema 清单 19 份）` → `「JSON Schema 强约束」节 schema 清单 20 份）`
L142：`schema 清单（19 份）` → `schema 清单（20 份）`

- [ ] **Step 3: L372-376 历史证据块删除历史数值**

将以下整块：
```
**实现证据**（Task 3，借鉴点 2）：
- 13 份 schema 已落地于 `w-model-dev/schemas/*.schema.json`（详见 [data-models.md](data-models.md)「JSON Schema 强约束」节 schema 清单）。
- 10 个 `*-logic.ts`（verifier / gate / graph / tla / code-tla / budget / run-log / maturity / checkpoint / root-cause）已集成 `validateBySchema` 前置校验。
- self-test 基线 99 → 111（+12，对应 12 份新 schema 各 1 条样本用例）。
- vitest 90 测试全通过（9 个 .test.ts 文件）。
```
替换为：
```
**实现证据**（Task 3，借鉴点 2）：
- schema 文件统一存放于 `w-model-dev/schemas/*.schema.json`（详见 [data-models.md](data-models.md)「JSON Schema 强约束」节 schema 清单）。
- 各 `*-logic.ts` 校验函数入口已集成 `validateBySchema` 前置校验，失败时以 `[schema]` 前缀返回错误。
```

- [ ] **Step 4: L736 / L774 / L833 / L855 反模式范围**

`| 维度 | 反模式 #1~#29 | 失败模式 F1~F10 |` → `| 维度 | 反模式 #1~#44 | 失败模式 F1~F10 |`
`> 层 1：流程反模式 #1~#29（命中即回退，脚本守护）` → `> 层 1：流程反模式 #1~#44（命中即回退，脚本守护）`
`> **与已收录反模式的关系**：已收录的 #1~#29 + F1~F10 + O1~O6 是技能包内置清单；` → `> **与已收录反模式的关系**：已收录的 #1~#44 + F1~F10 + O1~O6 是技能包内置清单；`
`正式加入 #1~#19 或 F1~F10 或 O1~O6 清单` → `正式加入 #1~#44 或 F1~F10 或 O1~O6 清单`

- [ ] **Step 5: 复核 + Commit**

Run: `npx grep -n "19 份\|13 份 schema\|#1~#29\|#1~#19" w-model-dev/references/anti-patterns.md` → 0 命中。
```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "docs: fix anti-patterns stale counts (schema 20, range #1~#44)"
```

### Task 7: data-models.md 修正（2 处）

**Files:**
- Modify: `w-model-dev/references/data-models.md`

- [ ] **Step 1: L822 清单标题 + 补 iceberg-sweep 行**

`### Schema 清单（19 份）` → `### Schema 清单（20 份）`
在表格末尾（signature-chain 行之后）追加一行：
`| \`iceberg-sweep\` | \`iceberg-sweep.schema.json\` | IcebergSweepReport | additionalProperties:false；reportId/phase/triggerType/icebergRound/线索来源/newFindings/sweepCoverage/summary/passed | iceberg-sweep-logic.ts |`

- [ ] **Step 2: L832 run-log action 枚举 15→27**

`additionalProperties:false；action enum（15 类）；role enum（O/A/S/V/G/R）` → `additionalProperties:false；action enum（27 类）；role enum（O/A/S/V/G/R）`

- [ ] **Step 3: 复核 + Commit**

Run: `npx grep -n "Schema 清单（19 份）\|action enum（15 类）" w-model-dev/references/data-models.md` → 0 命中；并确认 `iceberg-sweep.schema.json` 在清单表中。
```bash
git add w-model-dev/references/data-models.md
git commit -m "docs: fix data-models schema list (20, add iceberg-sweep row) and run-log action enum (27)"
```

### Task 8: glossary.md + subagent-delegation.md 修正（2 处）

**Files:**
- Modify: `w-model-dev/references/glossary.md`
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: glossary.md action 枚举对齐 27 值（L49）**

`- **规范定义**：run-log 动作类型枚举（\`execute\` / \`checkpoint\` / \`verify\` / \`gate\` / \`dispatch\` / \`rework\` / \`codegraph_query\` / \`opsx_explore\` / \`opsx_propose\` / \`opsx_apply\` / \`opsx_archive\` / \`ensure_deps\` 等）。` → `- **规范定义**：run-log 动作类型枚举（共 27 值，以 \`run-log.schema.json\` 为准）：\`chunk\` / \`cross\` / \`evolve\` / \`produce\` / \`review\`（V 评审）/ \`gate\` / \`tla-gate\` / \`graph-gate\` / \`test\` / \`checkpoint\` / \`rework\` / \`rollback\` / \`rootcause\` / \`fix\` / \`emergency-fix\` / \`escalate\` / \`r3-completeness\` / \`r3-reliability\` / \`r3-security\` / \`codegraph_query\` / \`opsx_explore\` / \`opsx_propose\` / \`opsx_apply\` / \`opsx_archive\` / \`ensure_deps\` / \`iceberg-sweep\` / \`iceberg-review\`。`

- [ ] **Step 2: subagent-delegation.md L22 标题**

`## 角色划分（O / S / V / G / A / R）` → `## 角色划分（六类核心角色 O / S / V / G / A / R + R-iceberg 变体）`

- [ ] **Step 3: 复核 + Commit**

Run: `npx grep -n "\`verify\`\|dispatch\`" w-model-dev/references/glossary.md`（仅应命中「_Avoid_」语境或 0 命中）。
```bash
git add w-model-dev/references/glossary.md w-model-dev/references/subagent-delegation.md
git commit -m "docs: align glossary action enum with schema (27), add R-iceberg variant to role header"
```

### Task 9: CONTRIBUTING.md + .githooks/pre-push 修正（2 处）

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `.githooks/pre-push`

- [ ] **Step 1: CONTRIBUTING.md L11 devDeps**

`本仓库是单纯的编排 + 校验脚本技能，工程化极简：根目录有一个 \`package.json\`，仅声明 \`tsx\` 作为开发依赖（用于运行 \`w-model-dev/scripts/*.ts\`）+ vitest 测试框架，无构建步骤、无 \`src/\`、无编程式 SDK。` → `本仓库是单纯的编排 + 校验脚本技能，工程化极简：根目录有一个 \`package.json\`，声明 \`tsx\`（运行 \`w-model-dev/scripts/*.ts\`）+ \`ajv\`/\`ajv-formats\`（schema 校验 runtime 依赖）+ \`eslint-plugin-security\`（安全扫描）+ \`@typescript-eslint/*\` + \`vitest\` 等开发依赖，无构建步骤、无 \`src/\`、无编程式 SDK。`

- [ ] **Step 2: pre-push L138 注释 12→13**

`# 与原 CI 一致：12 项检查（第 12 项 npm audit 为 warn-only），退出码必须全部符合预期才放行。` → `# 与原 CI 一致：13 项检查（第 13 项 npm audit 为 warn-only），退出码必须全部符合预期才放行。`

- [ ] **Step 3: 复核 + Commit**

Run: `npx grep -n "仅声明\|12 项检查" CONTRIBUTING.md .githooks/pre-push` → 0 命中。
```bash
git add CONTRIBUTING.md .githooks/pre-push
git commit -m "docs: fix CONTRIBUTING devDeps and pre-push check count (13)"
```

### Task 10: SSoT A — targetKind / DoD / 操作行为 / 角色（10 处）

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: targetKind 6 处（L1440 / L1457-1459 / L1625 / L1631）**

L1440 test-engineer 行：`| \`testcase\` | 覆盖率缺口清单` → `| \`test\` | 覆盖率缺口清单`
L1457：`1. 识别 \`target\` 的 \`targetKind\`（\`requirement\` / \`design\` / \`testcase\` / \`file\`）；` → `1. 识别 \`target\` 的 \`targetKind\`（\`requirement\` / \`design\` / \`code\` / \`test\`）；`
L1458：`2. 若 \`targetKind=file\`：默认路由到 \`code-reviewer\`；` → `2. 若 \`targetKind=code\`：默认路由到 \`code-reviewer\`；`
L1459：`3. 若 \`targetKind=testcase\`：路由到 \`test-engineer\`；` → `3. 若 \`targetKind=test\`：路由到 \`test-engineer\`；`
L1625：`- **适用目标类型**：\`requirement\` / \`design\` / \`testcase\` / \`file\`，各自对应一组子标准与权重。` → `- **适用目标类型**：\`requirement\` / \`design\` / \`code\` / \`test\`，各自对应一组子标准与权重。`
L1631：`代码评审（\`targetKind=file\`）的子标准按五轴` → `代码评审（\`targetKind=code\`）的子标准按五轴`

- [ ] **Step 2: §10.6 DoD 表补第七维度（L1956 后）**

在理解证据行后追加：
`| **签名链完整性** | 每阶段每角色动作完成后写入 \`signature-chain.jsonl\`；G 跑门禁前校验 R1-R10 全通过；断裂视为 #32 命中拒绝放行 | \`check-signature-chain.ts\` R1-R10 | 补齐缺失角色签名与来源证明 |`

- [ ] **Step 3: §10A 追溯表 DoD 列表补签名链（L2678）**

`| 10.6 项目级 Definition of Done | 每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据） |` → `| 10.6 项目级 Definition of Done | 每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性） |`

- [ ] **Step 4: 操作行为 6→7（L2668）**

`| 4A 核心操作行为与失败模式 | 6 条核心操作行为 + 10 条失败模式（F1~F10）+ 6 条运维失败模式（O1~O6）` → `| 4A 核心操作行为与失败模式 | 7 条核心操作行为 + 10 条失败模式（F1~F10）+ 6 条运维失败模式（O1~O6）`

- [ ] **Step 5: 角色表述（L2659）**

`编排者最小化（O/A/S/V/G/R 六角色，A 为阶段 1–4 分析子代理，R 为返工循环根因定位，F 由 S 兼任）` → `编排者最小化（O/A/S/V/G/R 六类核心角色 + R-iceberg 变体，A 为阶段 1–4 分析子代理，R 为返工循环根因定位，F 由 S 兼任）`

- [ ] **Step 6: 复核 + Commit**

Run: `npx grep -n "targetKind=file\|targetKind=testcase\|6 条核心操作行为\|六角色" docs/skill-design-document_SSoT.md` → 0 命中（L2668 已改；「运维失败模式 6 条」不计入）。
```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs: fix SSoT targetKind, DoD 7th dimension, operating behaviors, roles"
```

### Task 11: SSoT B — 轮次记录删历史数值（9 处）

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: L580**

`2. **JSON Schema 强约束**：引入 ajv (draft-07) + 13 份 schemas/*.schema.json，所有 .w-model/*.json 在 logic 层前置 schema 校验，反模式 #28` → `2. **JSON Schema 强约束**：引入 ajv (draft-07) + schemas/*.schema.json，所有 .w-model/*.json 在 logic 层前置 schema 校验，反模式 #28`

- [ ] **Step 2: L921 / L929（第 30 轮记录）**

`| schema 改动 | 19 份 schemas/*.schema.json 全量字段补充 description（仅注释性关键字，校验行为不变） |` → `| schema 改动 | schemas/*.schema.json 全量字段补充 description（仅注释性关键字，校验行为不变） |`
L929：`。19 份 \`schemas/*.schema.json\` 全量字段补充 \`description\`` → `。\`schemas/*.schema.json\` 全量字段补充 \`description\``

- [ ] **Step 3: L966（第 32 轮记录）**

`| 归一化 | 29 个脚本（23 check-*.ts + 5 工具 + read-json-or-exit）exit 2 路径统一走 \`exitWithError\`；` → `| 归一化 | exit-2 脚本统一走 \`exitWithError\`（6 类错误码：ARG_INVALID / FILE_NOT_FOUND / FILE_PARSE / FILE_READ / STRUCTURE_INVALID / UNEXPECTED）；`

- [ ] **Step 4: L1031（第 36 轮记录）**

`| run-log 扩展 | action 枚举 +2：\`iceberg-sweep\`（R-iceberg 分派）+ \`iceberg-review\`（V 复审冰山报告），25 → 27 值 |` → `| run-log 扩展 | action 枚举 +2：\`iceberg-sweep\`（R-iceberg 分派）+ \`iceberg-review\`（V 复审冰山报告） |`

- [ ] **Step 5: L2660（§10A 追溯表第 18 轮行）**

`w-model-dev/schemas/*.schema.json\`（13 份 draft-07）+` → `w-model-dev/schemas/*.schema.json\`（draft-07）+`

- [ ] **Step 6: L2690 / L2693 / L2697（§10A 追溯表第 30/32/36 轮行）**

`| §3.4.27 | ... | \`schemas/*.schema.json\`（19 份，全量字段补 description）+ ...` → `... \`schemas/*.schema.json\`（全量字段补 description）+ ...`
`| §3.4.30 | ... | scripts/lib/cli-error.ts + 29 脚本 exit 2 归一化 + ...` → `| §3.4.30 | ... | scripts/lib/cli-error.ts + exit-2 脚本全量归一化 + ...`
`| §3.4.34 | ... | \`schemas/run-log.schema.json\`（action 25→27）+ ...` → `... \`schemas/run-log.schema.json\`（action 枚举 +2）+ ...`

- [ ] **Step 7: 复核 + Commit**

Run: `npx grep -n "13 份\|19 份\|29 个脚本\|29 脚本\|25 → 27\|25→27" docs/skill-design-document_SSoT.md` → 0 命中。
```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs: remove stale round-record counts in SSoT"
```

### Task 12: 版本号三处 + CHANGELOG [38.3.0]

**Files:**
- Modify: `package.json`
- Modify: `w-model-dev/skill-metadata.json`
- Modify: `w-model-dev/SKILL.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 三处版本 38.2.0 → 38.3.0**

package.json：`"version": "38.2.0"` → `"version": "38.3.0"`
skill-metadata.json：`"version": "38.2.0"` → `"version": "38.3.0"`；`"updatedAt": "2026-08-08"` → `"updatedAt": "2026-08-10"`
SKILL.md frontmatter：`version: 38.2.0` → `version: 38.3.0`

- [ ] **Step 2: CHANGELOG 顶部新增条目（插在 `## [38.2.0]` 之前）**

```markdown
## [38.3.0] - 2026-08-10

### Changed
- 文档一致性修正（设计文档 `docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md`）：
  - targetKind 枚举统一（testcase/file → test/code）：verifier-spec §2/§2.1/§6/§7.3/§7.4/§7.4A/§8 + command-reference + agent-personas + SSoT
  - DoD 维度 5→7：README + definition-of-done（七维度自检）+ SSoT §10.6 补第七维度「签名链完整性」
  - 核心操作行为 6→7：README + SSoT §4A/§10A
  - schema 份数 19→20：anti-patterns + data-models（补 iceberg-sweep 清单行）；SSoT 轮次记录删历史计数
  - exit-2 脚本数 29→27：AGENTS；check-code-tla-consistency 退出码补充 2=输入错误
  - pre-push 注释 12→13；反模式范围 #1~#44；角色表述「六类核心角色 + R-iceberg 变体」；glossary action 枚举对齐 27 值；CONTRIBUTING devDeps 描述
- 版本号 38.2.0 → 38.3.0（三处同步）
```

- [ ] **Step 3: 复核 + Commit**

Run: `npx grep -rn "38\.2\.0" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md` → 0 命中。
```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md CHANGELOG.md
git commit -m "chore: bump version 38.3.0 and add doc-consistency changelog entry"
```

### Task 13: Round 1 全量复核

- [ ] **Step 1: 零残留 grep**

在仓库根运行，以下均应 0 命中：
```bash
npx grep -rn "targetKind=file\|targetKind=testcase\|targetKind = \`file\`\|targetKind = \`testcase\`" README.md AGENTS.md CONTRIBUTING.md w-model-dev/SKILL.md w-model-dev/references docs/skill-design-document_SSoT.md
npx grep -rn "29 个脚本\|19 份\|13 份 schema\|5 维度（功能\|#1~#29\|#1~#19\|六角色\|6 条核心操作行为\|12 项检查\|15 类" README.md AGENTS.md CONTRIBUTING.md .githooks/pre-push w-model-dev/references docs/skill-design-document_SSoT.md
```
注意：`5 维度` 仅允许「选型决策矩阵 5 维度评分」语境（templates/system-design.md 等，非活体清单）。

- [ ] **Step 2: 回归验证**

```bash
npm run self-test        # 期望 249 全部通过（基线不变）
npx vitest run           # 期望 34 test files / 498 tests 全通过
npx tsc --noEmit         # 期望 0 错误
```
注意：pre-push 不运行（push 时自动跑；手动 `npm run prepush` 亦可，需 Git Bash）。

- [ ] **Step 3: 记录结果** — 三项命令退出码均为 0 后，Round 1 完成。

---

# Round 2：check-docs-consistency.ts（Task 14-20）

### Task 14: 写失败测试 docs-consistency-logic.test.ts

**Files:**
- Create: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **Step 1: 写测试文件**

```typescript
import { describe, expect, it } from 'vitest';
import { runDocConsistencyChecks, type DocConsistencyInput } from '../docs-consistency-logic.js';

function baseInput(overrides: Partial<DocConsistencyInput> = {}): DocConsistencyInput {
  return {
    schemaFiles: ['verifier-output.schema.json', 'run-log.schema.json', 'iceberg-sweep.schema.json'],
    personaCount: 28,
    cursorSkillCount: 23,
    exit2ScriptCount: 30,
    dataModels: [
      '### Schema 清单（20 份）',
      '| `verifier-output` | `verifier-output.schema.json` | ... |',
      '| `run-log` | `run-log.schema.json` | ... | action enum（27 类） |',
      '| `iceberg-sweep` | `iceberg-sweep.schema.json` | ... |',
    ].join('\n'),
    verifierSpec: '第 9 轮标准化：`meta.targetKind` 必须取自以下 4 值枚举。',
    commandReference: 'UAT-/ST-/IT-/UT- → test；否则为 code',
    agentPersonas: '`targetKind=code` 时默认路由到本 Persona。',
    definitionOfDone: '## 七维度标准\n| 测试 | ... |\n| **签名链完整性** | ... |',
    readme: '7 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
    antiPatterns: '反模式清单（#1~#44；\n| 44 | 冰山扫掠... |',
    glossary: '### action（RunLogEntry）\n- **规范定义**：run-log 动作类型枚举（共 27 值）：`review` / `gate` / ...',
    runLogSchema: JSON.stringify({ properties: { action: { enum: new Array(27).fill('x') } } }),
    skill: '### 七条操作行为',
    agents: '30 个脚本',
    ssot: [
      '7 条核心操作行为',
      '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
      '| **签名链完整性** | ... |',
    ].join('\n'),
    prePush: '# 14. docs-consistency\n# 与原 CI 一致：14 项检查',
    ...overrides,
  };
}

describe('runDocConsistencyChecks', () => {
  it('全部一致时零违规', () => {
    expect(runDocConsistencyChecks(baseInput())).toEqual([]);
  });

  it('schema 清单缺行 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `verifier-output` | ... |' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'schema-list' && x.message.includes('iceberg-sweep.schema.json'))).toBe(true);
  });

  it('schema 清单标题份数不符 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（19 份）\n| `verifier-output` | ... |\n| `run-log` | ... |\n| `iceberg-sweep` | ... |' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'schema-list' && x.message.includes('20 份'))).toBe(true);
  });

  it('run-log action 枚举长度非 27 → 违规', () => {
    const input = baseInput({ runLogSchema: JSON.stringify({ properties: { action: { enum: ['a', 'b'] } } }) });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27'))).toBe(true);
  });

  it('data-models run-log 行非 27 类 → 违规', () => {
    const input = baseInput({ dataModels: '### Schema 清单（20 份）\n| `run-log` | ... | action enum（15 类） |' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'run-log-action' && x.message.includes('27 类'))).toBe(true);
  });

  it('targetKind 废弃标记残留 → 违规', () => {
    const input = baseInput({ commandReference: 'targetKind=file 路由 code-reviewer' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'targetkind' && x.message.includes('targetKind=file'))).toBe(true);
  });

  it('README 残留 5 维度 DoD → 违规', () => {
    const input = baseInput({ readme: '5 维度（功能 / 质量 / 测试 / 文档 / 部署）' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('5 维度'))).toBe(true);
  });

  it('definition-of-done 缺七维度标题 → 违规', () => {
    const input = baseInput({ definitionOfDone: '## 五维度标准' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'dod' && x.message.includes('七维度标准'))).toBe(true);
  });

  it('README 缺 7 条操作行为 → 违规', () => {
    const input = baseInput({ readme: '6 条核心操作行为' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'operating-behaviors')).toBe(true);
  });

  it('反模式最大编号非 44 / 旧区间残留 → 违规', () => {
    const input = baseInput({ antiPatterns: '反模式清单（#1~#29；\n| 43 | ... |' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('44'))).toBe(true);
    expect(v.some((x) => x.check === 'anti-patterns' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('exit-2 脚本数非 30 / AGENTS 残留 29 → 违规', () => {
    const input = baseInput({ exit2ScriptCount: 29, agents: '29 个脚本' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('30'))).toBe(true);
    expect(v.some((x) => x.check === 'exit2-scripts' && x.message.includes('29 个脚本'))).toBe(true);
  });

  it('pre-push 编号最大值非 14 → 违规', () => {
    const input = baseInput({ prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查' });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('14'))).toBe(true);
  });

  it('glossary action 含 verify → 违规', () => {
    const input = baseInput({ glossary: '### action（RunLogEntry）\n`verify` / `gate`' });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'glossary-action' && x.message.includes('verify'))).toBe(true);
  });

  it('资产计数不符 → 违规', () => {
    const input = baseInput({ personaCount: 27, cursorSkillCount: 22 });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('28'))).toBe(true);
    expect(v.some((x) => x.check === 'asset-counts' && x.message.includes('23'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/__tests__/docs-consistency-logic.test.ts`
Expected: FAIL — `Cannot find module '../docs-consistency-logic.js'`

### Task 15: 实现 docs-consistency-logic.ts

**Files:**
- Create: `w-model-dev/scripts/docs-consistency-logic.ts`

- [ ] **Step 1: 写纯逻辑文件**

```typescript
/**
 * 文档一致性纯逻辑（docs-consistency-logic.ts）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 * 纯逻辑无 IO；IO（读文件 / 数目录）由 check-docs-consistency.ts 承担。
 * 设计：docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md §4
 */

export interface DocCheckViolation {
  /** 检查项标识（如 schema-list / targetkind） */
  check: string;
  /** 人类可读描述 */
  message: string;
}

export interface DocConsistencyInput {
  /** schemas/ 目录 *.schema.json 文件名列表（含后缀） */
  schemaFiles: string[];
  /** subagent/ 目录 .md 人格文件数（期望 28） */
  personaCount: number;
  /** .cursor/skills 目录数（期望 23） */
  cursorSkillCount: number;
  /** 实测可 exit 2 的 CLI 脚本数（check-*.ts + wm-status + metrics-report + ensure-codegraph-opsx；期望 28） */
  exit2ScriptCount: number;
  dataModels: string;
  verifierSpec: string;
  commandReference: string;
  agentPersonas: string;
  definitionOfDone: string;
  antiPatterns: string;
  glossary: string;
  runLogSchema: string;
  skill: string;
  readme: string;
  agents: string;
  ssot: string;
  prePush: string;
}

export const EXPECTED = {
  schemaCount: 20,
  personaCount: 28,
  cursorSkillCount: 23,
  exit2ScriptCount: 30,
  runLogActionCount: 27,
  maxAntiPattern: 44,
  prePushCount: 14,
} as const;

const SCHEMA_TABLE_HEADING = '### Schema 清单（20 份）';
const DOD_README = '7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
const DOD_SSOT_TRACE = '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
const FORBIDDEN_TARGETKIND = [
  'targetKind=file',
  'targetKind=testcase',
  'targetKind = `file`',
  'targetKind = `testcase`',
  'targetKind：`file`',
  'targetKind：`testcase`',
  '"targetKind": "file"',
  '"targetKind": "testcase"',
];
const STALE_RANGES = ['#1~#29', '#1~#19', '#1～#29', '#1～#19'];
const STALE_EXIT2 = ['29 个脚本', '27 个脚本'];

export function runDocConsistencyChecks(input: DocConsistencyInput): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  violations.push(...checkSchemaList(input.schemaFiles, input.dataModels));
  violations.push(...checkRunLogActionEnum(input.runLogSchema, input.dataModels));
  violations.push(...checkTargetKindLiveDocs(input.verifierSpec, input.commandReference, input.agentPersonas, input.ssot));
  violations.push(...checkDoDDimensions(input.definitionOfDone, input.readme, input.ssot));
  violations.push(...checkOperatingBehaviors(input.skill, input.readme, input.ssot));
  violations.push(...checkAntiPatterns(input.antiPatterns));
  violations.push(...checkExit2ScriptCount(input.exit2ScriptCount, input.agents));
  violations.push(...checkPrePushCount(input.prePush));
  violations.push(...checkGlossaryAction(input.glossary));
  violations.push(...checkAssetCounts(input.personaCount, input.cursorSkillCount));
  return violations;
}

function checkSchemaList(schemaFiles: string[], dataModels: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!dataModels.includes(SCHEMA_TABLE_HEADING)) {
    violations.push({ check: 'schema-list', message: `data-models.md 应含「${SCHEMA_TABLE_HEADING}」标题（当前 ${schemaFiles.length} 个 schema 文件）` });
  }
  for (const file of schemaFiles) {
    const key = file.replace(/\.schema\.json$/, '');
    if (!dataModels.includes(`\`${key}\``)) {
      violations.push({ check: 'schema-list', message: `data-models.md「Schema 清单」表未覆盖 ${file}` });
    }
  }
  return violations;
}

function checkRunLogActionEnum(runLogSchema: string, dataModels: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  let count = 0;
  try {
    const schema = JSON.parse(runLogSchema) as { properties?: { action?: { enum?: unknown[] } } };
    const actionEnum = schema.properties?.action?.enum;
    count = Array.isArray(actionEnum) ? actionEnum.length : 0;
  } catch {
    violations.push({ check: 'run-log-action', message: 'run-log.schema.json 解析失败' });
  }
  if (count !== EXPECTED.runLogActionCount) {
    violations.push({ check: 'run-log-action', message: `run-log.schema.json action.enum 长度应为 ${EXPECTED.runLogActionCount}，实际 ${count}` });
  }
  if (!dataModels.includes(`action enum（${EXPECTED.runLogActionCount} 类）`)) {
    violations.push({ check: 'run-log-action', message: `data-models.md run-log 行应含「action enum（${EXPECTED.runLogActionCount} 类）」` });
  }
  return violations;
}

function checkTargetKindLiveDocs(...contents: string[]): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const content of contents) {
    for (const token of FORBIDDEN_TARGETKIND) {
      if (content.includes(token)) {
        violations.push({ check: 'targetkind', message: `检测到废弃 targetKind 标记「${token}」（应为 code/test）` });
      }
    }
  }
  return violations;
}

function checkDoDDimensions(definitionOfDone: string, readme: string, ssot: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!definitionOfDone.includes('## 七维度标准')) {
    violations.push({ check: 'dod', message: 'definition-of-done.md 应含「## 七维度标准」标题' });
  }
  if (!readme.includes(DOD_README)) {
    violations.push({ check: 'dod', message: 'README 应含 7 维度 DoD 表述' });
  }
  if (readme.includes('5 维度（功能')) {
    violations.push({ check: 'dod', message: 'README 仍含过时「5 维度（功能 / 质量 / 测试 / 文档 / 部署）」' });
  }
  if (!ssot.includes(DOD_SSOT_TRACE) || !ssot.includes('| **签名链完整性** |')) {
    violations.push({ check: 'dod', message: 'SSoT DoD 表述（§10.6 表 / §10A 追溯）应含第七维度「签名链完整性」' });
  }
  return violations;
}

function checkOperatingBehaviors(skill: string, readme: string, ssot: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!skill.includes('### 七条操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'SKILL.md 应含「### 七条操作行为」' });
  }
  if (!readme.includes('7 条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'README 应含「7 条核心操作行为」' });
  }
  if (readme.includes('6 条核心操作行为') || ssot.includes('6 条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'README/SSoT 仍含过时「6 条核心操作行为」' });
  }
  return violations;
}

function checkAntiPatterns(antiPatterns: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!antiPatterns.includes(`\n| ${EXPECTED.maxAntiPattern} |`)) {
    violations.push({ check: 'anti-patterns', message: `anti-patterns.md 反模式表最大编号应为 ${EXPECTED.maxAntiPattern}` });
  }
  if (!antiPatterns.includes('#1~#44')) {
    violations.push({ check: 'anti-patterns', message: 'anti-patterns.md 应含连续区间「#1~#44」' });
  }
  for (const stale of STALE_RANGES) {
    if (antiPatterns.includes(stale)) {
      violations.push({ check: 'anti-patterns', message: `anti-patterns.md 仍含过时区间「${stale}」` });
    }
  }
  return violations;
}

function checkExit2ScriptCount(count: number, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (count !== EXPECTED.exit2ScriptCount) {
    violations.push({ check: 'exit2-scripts', message: `实测 exit-2 脚本数应为 ${EXPECTED.exit2ScriptCount}，实际 ${count}` });
  }
  if (!agents.includes(`${EXPECTED.exit2ScriptCount} 个脚本`)) {
    violations.push({ check: 'exit2-scripts', message: `AGENTS.md 应含「${EXPECTED.exit2ScriptCount} 个脚本」` });
  }
  for (const stale of STALE_EXIT2) {
    if (agents.includes(stale)) {
      violations.push({ check: 'exit2-scripts', message: `AGENTS.md 仍含过时「${stale}」` });
    }
  }
  return violations;
}

function checkPrePushCount(prePush: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  let max = 0;
  for (const m of prePush.matchAll(/^# (\d+)\./gm)) {
    max = Math.max(max, Number(m[1]));
  }
  if (max !== EXPECTED.prePushCount) {
    violations.push({ check: 'pre-push', message: `pre-push 编号注释最大值应为 ${EXPECTED.prePushCount}，实际 ${max}` });
  }
  if (!prePush.includes(`${EXPECTED.prePushCount} 项检查`)) {
    violations.push({ check: 'pre-push', message: `pre-push 注释应含「${EXPECTED.prePushCount} 项检查」` });
  }
  return violations;
}

function checkGlossaryAction(glossary: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const start = glossary.indexOf('### action（RunLogEntry）');
  const end = start >= 0 ? glossary.indexOf('### ', start + 1) : -1;
  const section = start >= 0 && end > start ? glossary.slice(start, end) : '';
  if (!section.includes('`review`')) {
    violations.push({ check: 'glossary-action', message: 'glossary.md action 枚举应含 `review`（V 评审）' });
  }
  if (section.includes('`verify`')) {
    violations.push({ check: 'glossary-action', message: 'glossary.md action 枚举不应含 `verify`' });
  }
  return violations;
}

function checkAssetCounts(personaCount: number, cursorSkillCount: number): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (personaCount !== EXPECTED.personaCount) {
    violations.push({ check: 'asset-counts', message: `subagent/ 人格文件数应为 ${EXPECTED.personaCount}，实际 ${personaCount}` });
  }
  if (cursorSkillCount !== EXPECTED.cursorSkillCount) {
    violations.push({ check: 'asset-counts', message: `.cursor/skills 目录数应为 ${EXPECTED.cursorSkillCount}，实际 ${cursorSkillCount}` });
  }
  return violations;
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 14 tests PASS（Task 14 的全部用例绿）

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts w-model-dev/scripts/docs-consistency-logic.ts
git commit -m "feat: add docs-consistency-logic with vitest coverage"
```

### Task 16: 实现 check-docs-consistency.ts CLI + package.json script

**Files:**
- Create: `w-model-dev/scripts/check-docs-consistency.ts`
- Modify: `package.json`

- [ ] **Step 1: 写 CLI 文件**

```typescript
#!/usr/bin/env tsx
/**
 * 文档一致性门禁（Doc Consistency Checker）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-docs-consistency.ts [repo-root]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 退出码：
 *   0  全部一致
 *   1  存在不一致（violations 列出）
 *   2  输入错误（repo-root 缺必需文件）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exitWithError } from './lib/cli-error.js';
import { printGateReport } from './lib/gate-report.js';
import { runDocConsistencyChecks, type DocConsistencyInput } from './docs-consistency-logic.js';

const REQUIRED_PATHS = [
  'w-model-dev/references/data-models.md',
  'w-model-dev/references/verifier-spec.md',
  'w-model-dev/references/command-reference.md',
  'w-model-dev/references/agent-personas.md',
  'w-model-dev/references/definition-of-done.md',
  'w-model-dev/references/anti-patterns.md',
  'w-model-dev/references/glossary.md',
  'w-model-dev/schemas/run-log.schema.json',
  'w-model-dev/SKILL.md',
  'README.md',
  'AGENTS.md',
  'docs/skill-design-document_SSoT.md',
  '.githooks/pre-push',
];

function main(): void {
  const root = resolve(process.argv[2] ?? '.');
  const missing = REQUIRED_PATHS.filter((p) => !existsSync(join(root, p)));
  if (missing.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      message: 'repo-root 缺少必需文件',
      detail: `[${missing.join(', ')}]（用法: check-docs-consistency.ts [repo-root]）`,
      exitCode: 2,
    });
    return;
  }

  const read = (p: string): string => readFileSync(join(root, p), 'utf-8');
  const schemaFiles = readdirSync(join(root, 'w-model-dev/schemas')).filter((f) => f.endsWith('.schema.json')).sort();
  const personaCount = readdirSync(join(root, 'w-model-dev/subagent')).filter((f) => f.endsWith('.md')).length;
  const cursorSkillCount = readdirSync(join(root, '.cursor/skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  const checkScriptCount = readdirSync(join(root, 'w-model-dev/scripts')).filter((f) => /^check-.*\.ts$/.test(f)).length;
  const exit2ScriptCount = checkScriptCount + 5; // + 5 工具：ensure-codegraph-opsx + wm-status + metrics-report + security-scan + plan-chunks

  const input: DocConsistencyInput = {
    schemaFiles,
    personaCount,
    cursorSkillCount,
    exit2ScriptCount,
    dataModels: read('w-model-dev/references/data-models.md'),
    verifierSpec: read('w-model-dev/references/verifier-spec.md'),
    commandReference: read('w-model-dev/references/command-reference.md'),
    agentPersonas: read('w-model-dev/references/agent-personas.md'),
    definitionOfDone: read('w-model-dev/references/definition-of-done.md'),
    antiPatterns: read('w-model-dev/references/anti-patterns.md'),
    glossary: read('w-model-dev/references/glossary.md'),
    runLogSchema: read('w-model-dev/schemas/run-log.schema.json'),
    skill: read('w-model-dev/SKILL.md'),
    readme: read('README.md'),
    agents: read('AGENTS.md'),
    ssot: read('docs/skill-design-document_SSoT.md'),
    prePush: read('.githooks/pre-push'),
  };

  const violations = runDocConsistencyChecks(input);

  console.log('═'.repeat(60));
  console.log('文档一致性检查（Doc Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`repo-root     : ${root}`);
  console.log(`schema 文件   : ${schemaFiles.length}`);
  console.log(`exit-2 脚本   : ${exit2ScriptCount}`);
  console.log(`persona / cur : ${personaCount} / ${cursorSkillCount}`);
  console.log(`检查结果      : ${violations.length === 0 ? '✓ 全部一致' : `✗ ${violations.length} 项不一致`}`);

  if (violations.length > 0) {
    console.log('─'.repeat(60));
    for (const v of violations) {
      console.log(`  - [${v.check}] ${v.message}`);
    }
  }

  printGateReport('DOCS_CONSISTENCY', { passed: violations.length === 0, violationCount: violations.length }, violations.length === 0 ? 0 : 1);
}

try {
  main();
} catch (err) {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
}
```

- [ ] **Step 2: package.json 加 script**

在 scripts 中（`"wm:metrics"` 之后）添加：
`"check:docs-consistency": "tsx w-model-dev/scripts/check-docs-consistency.ts",`

- [ ] **Step 3: 运行 CLI 验证通过（exit 0）**

Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts .`
Expected: 输出「✓ 全部一致」，`DOCS_CONSISTENCY_JSON {"passed":true,...,"exitCode":0}`，退出码 0。

- [ ] **Step 4: 验证 exit 2（错误输入）**

Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts /nonexistent`
Expected: `✗ [ARG_INVALID] ...` 走 stderr、`ERROR_JSON {...}` 走 stdout，退出码 2。

- [ ] **Step 5: 验证 exit 1（故意破坏样本）**

临时修改 `w-model-dev/references/data-models.md` 中 `### Schema 清单（20 份）` → `### Schema 清单（19 份）`，运行 CLI 期望退出码 1 且列出 schema-list 违规；随后还原修改。

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/check-docs-consistency.ts package.json
git commit -m "feat: add check-docs-consistency CLI and npm script"
```

### Task 17: pre-push 接入 + 级联更新 + 登记

**Files:**
- Modify: `.githooks/pre-push`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `w-model-dev/SKILL.md`（Bundled Resources 表）
- Modify: `w-model-dev/skill-metadata.json` + `package.json` + `w-model-dev/SKILL.md`（版本 38.3.0 → 38.4.0）
- Modify: `CHANGELOG.md`

- [ ] **Step 1: pre-push 新增检查 #14（npm audit 保持 #13）**

在 npm audit 块结束（`fi`）与 `log "全部门禁通过，允许推送 ✓"` 之间插入：

```bash
# 14. check-docs-consistency：活体文档一致性门禁（2026-08-10 新增）
run_expect "docs-consistency 活体文档一致" 0 npm run check:docs-consistency || exit 1
```

同时更新 L138 注释：`# 与原 CI 一致：13 项检查（第 13 项 npm audit 为 warn-only），退出码必须全部符合预期才放行。` → `# 与原 CI 一致：14 项检查（第 13 项 npm audit 为 warn-only），退出码必须全部符合预期才放行。`

> 最终编号注释为 `# 1.` ~ `# 14.` 连续递增，npm audit 保持第 13 项，docs-consistency 为第 14 项（插入在 npm audit 块之后、收尾 log 之前）。该方案满足脚本 check #8（编号最大值 == 14 且注释含「14 项检查」）。

- [ ] **Step 2: README L22**

`| Pre-push 门禁（本地 CI） | ✅ 13 项全通过（Git Bash 与 WSL 双平台实测） |` → `| Pre-push 门禁（本地 CI） | ✅ 14 项全通过（Git Bash 与 WSL 双平台实测） |`

- [ ] **Step 3: AGENTS.md §2 pre-push 行 + §3 注释 + §8 表**

AGENTS §2 pre-push 行：`自动跑 13 项门禁` → `自动跑 14 项门禁`
AGENTS §3：`# 手动跑推送前门禁（不实际推送，13 项门禁检查；...` → `（不实际推送，14 项门禁检查；...`
AGENTS §8 脚本导航表末尾追加行：
`| check-docs-consistency.ts | 活体文档一致性门禁（schema 清单 / targetKind / DoD 维度 / 操作行为 / 反模式 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数） | - | 0=通过，1=不一致，2=输入错误 |`

- [ ] **Step 4: AGENTS.md L21 脚本数 29→30**

`全仓 29 个脚本 exit 2` → `全仓 30 个脚本 exit 2`

- [ ] **Step 5: SKILL.md Bundled Resources 表登记**

在 Bundled Resources 表的脚本区（如 `ensure-codegraph-opsx.ts` 行附近）追加：
`| check-docs-consistency.ts | 文档一致性门禁（活体文档计数/枚举/清单 vs 代码事实）—— 内容升级后必跑 / pre-push 承载 |`

- [ ] **Step 6: 版本 38.3.0 → 38.4.0（三处）**

package.json / skill-metadata.json（updatedAt 保持 2026-08-10）/ SKILL.md frontmatter。

- [ ] **Step 7: CHANGELOG 顶部新增 [38.4.0] 条目（插在 [38.3.0] 之前）**

```markdown
## [38.4.0] - 2026-08-10

### Added
- check-docs-consistency.ts 活体文档一致性门禁（10 项确定性检查：schema 清单 / run-log action 枚举 / targetKind / DoD 维度 / 操作行为 / 反模式范围 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数），pre-push 接入（13 项 → 14 项）
- docs-consistency-logic.ts 纯逻辑 + __tests__/docs-consistency-logic.test.ts（vitest，14 用例）

### Changed
- AGENTS.md 脚本导航表登记 check-docs-consistency；SKILL.md Bundled Resources 登记；exit-2 脚本数 29 → 30
- 版本号 38.3.0 → 38.4.0（三处同步）
```

- [ ] **Step 8: 验证 + Commit**

Run: `npm run check:docs-consistency` → exit 0；`bash .githooks/pre-push`（Git Bash）→ 14 项全通过。
```bash
git add .githooks/pre-push README.md AGENTS.md w-model-dev/SKILL.md w-model-dev/skill-metadata.json package.json CHANGELOG.md
git commit -m "feat: wire check-docs-consistency into pre-push (14 items), bump 38.4.0"
```

### Task 18: Round 2 全量验证

- [ ] **Step 1: 全量回归**

```bash
npm run self-test        # 249 基线不变，全通过
npx vitest run           # 35 test files / 498 + 15 用例 全通过
npx tsc --noEmit         # 0 错误
npm run check:docs-consistency  # exit 0
```

- [ ] **Step 2: 破坏样本回归** — 临时改 `README.md` 中「7 维度」→「5 维度（功能」，`npm run check:docs-consistency` 期望 exit 1 且含 dod 违规；还原后 exit 0。

- [ ] **Step 3: 零残留 grep**（同 Task 13 Step 1，另加 `npx grep -rn "13 项" README.md AGENTS.md .githooks/pre-push` 应仅命中「第 13 项 npm audit」合法语境；另查 `targetKind：\`file\``、`targetKind：\`testcase\``、`"targetKind": "file"`、`"targetKind": "testcase"` 零命中）。

- [ ] **Step 4: 记录结果** — 全部命令退出码 0 后，Round 2 完成。

---

## 自审记录（Self-Review）

- **Spec 覆盖**：Round 1 覆盖 spec §3.1-3.14 全部 60 处；Round 2 覆盖 spec §4.1-4.3（结构 / 10 检查项 / pre-push 接入 + 29→30 级联 + 版本 38.4.0）。
- **占位符扫描**：所有文档修正均给出精确 old→new；脚本给出完整代码；无 TBD/TODO。
- **类型一致性**：`DocConsistencyInput` 字段在 logic / CLI / 测试三处一致；`EXPECTED` 常量单点定义；`runDocConsistencyChecks` 签名一致。
- **已捕获的坑**：新脚本自身 exit 2 → 计数 29→30 级联（spec 已补）；pre-push 编号采用 #14 递增方案（Task 17 已明确）；exit-2 计数口径（24 check-*.ts + 5 工具 = 29）经实测确认（Task 4 曾误改 27 已回退）。
