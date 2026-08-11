# 批次 5 实施计划：技能缺口 + 评估 + 收尾

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 项核心技能缺口（security-review / codegraph-exploration / performance-review）+ eval README + 收尾（版本号 33.0.0 + SSoT §3.4.31 + CHANGELOG [33.0.0] + 顶层文档同步）。**本批升级版本号 32.0.0→33.0.0**（三处同步）。

**Architecture:** 3 个新技能独立创建（writing-skills 流程）；eval README 独立；收尾为版本号 + 文档同步（串行执行）。设计 spec：[`docs/superpowers/specs/2026-08-05-opt-batch-5-skill-gap-closure-design.md`](../../docs/superpowers/specs/2026-08-05-opt-batch-5-skill-gap-closure-design.md)。

**Tech Stack:** markdown 技能文档（YAML frontmatter）+ 版本号同步 + 文档同步。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 文档修改串行执行、禁止并行（用户既定规则）。
- 新技能遵循 writing-skills 校验（frontmatter 规范、指令可执行、无占位符）。

## 任务总览（5 任务）

| 任务 | 内容 | 产物 | commit |
|---|---|---|---|
| 1 | 新建 security-review 技能 | `.cursor/skills/security-review/SKILL.md` | `feat(skill): 新建 security-review 技能（安全扫描 + 凭据脱敏）` |
| 2 | 新建 codegraph-exploration 技能 | `.cursor/skills/codegraph-exploration/SKILL.md` | `feat(skill): 新建 codegraph-exploration 技能（约束 #20 封装）` |
| 3 | eval 补 README | `eval/README.md` | `docs(eval): 补 README 说明 TSV 格式与 darwin-skill 用法` |
| 4 | 新建 performance-review 技能 | `.cursor/skills/performance-review/SKILL.md` | `feat(skill): 新建 performance-review 技能` |
| 5 | 收尾：版本号 + SSoT + CHANGELOG + 顶层文档 | 版本号三处 + SSoT + CHANGELOG + 4 顶层文档 | `chore(release): 版本号 33.0.0 + SSoT §3.4.31 + CHANGELOG + 顶层文档同步` |

---

## Task 1: 新建 security-review 技能

**Files:**
- Create: `.cursor/skills/security-review/SKILL.md`

- [ ] **Step 1: 读参考技能结构**

读取 `.cursor/skills/brainstorming/SKILL.md` 的 frontmatter 与正文结构（name/description/version/license/metadata.hermes.tags + 分节指令 + 检查清单）。

- [ ] **Step 2: 读 security-scan 规则与反模式 #43**

读取 `.eslintrc.cjs`（规则清单）与 `w-model-dev/references/anti-patterns.md` 反模式 #43（凭据脱敏，646-661 行）。

- [ ] **Step 3: 创建 SKILL.md**

按 spec §3.1 创建 `.cursor/skills/security-review/SKILL.md`：frontmatter + 指令覆盖源码级安全扫描（lint:security + baseline 机制）+ 凭据脱敏（反模式 #43）+ 修复动作 + 检查清单。**无占位符、指令可执行**。

- [ ] **Step 4: 校验 + 提交**

Run: 检查 frontmatter 规范（name/description/version/license）、无占位符（TBD/TODO/xxx）。
```bash
git add .cursor/skills/security-review/SKILL.md
git commit --no-gpg-sign -m "feat(skill): 新建 security-review 技能（安全扫描 + 凭据脱敏）"
```

---

## Task 2: 新建 codegraph-exploration 技能

**Files:**
- Create: `.cursor/skills/codegraph-exploration/SKILL.md`

- [ ] **Step 1: 读约束 #20 与字段要求**

读取 `w-model-dev/references/phase-5-coding.md:51-62`（约束 #20）与 `w-model-dev/scripts/cli/check-codegraph-queries.ts:26-32`（字段要求）。

- [ ] **Step 2: 创建 SKILL.md**

按 spec §3.2 创建：frontmatter + 指令覆盖 codegraph_explore 调用 + 落盘字段（querySymbol/callers/callees/blastRadius/queryTimestamp）+ 修改前影响分析 + 与 code-TLA+ 互补。**无占位符**。

- [ ] **Step 3: 校验 + 提交**

Run: frontmatter 规范 + 无占位符。
```bash
git add .cursor/skills/codegraph-exploration/SKILL.md
git commit --no-gpg-sign -m "feat(skill): 新建 codegraph-exploration 技能（约束 #20 封装）"
```

---

## Task 3: eval 补 README

**Files:**
- Create: `eval/README.md`

- [ ] **Step 1: 读 eval 现状**

读取 `eval/w-model-dev-results.tsv`（表头 + 记录格式）与 `eval/w-model-dev-test-prompts.json`（结构）。

- [ ] **Step 2: 创建 README**

按 spec §3.3 创建 `eval/README.md`：TSV 格式说明（timestamp/commit/skill/old_score/new_score/status/dimension/note/eval_mode）、test-prompts.json 用途、darwin-skill 用法（外部工具，补跑流程）、当前最新记录（2026-07-21，第 32 轮后待补跑）。

- [ ] **Step 3: 提交**

```bash
git add eval/README.md
git commit --no-gpg-sign -m "docs(eval): 补 README 说明 TSV 格式与 darwin-skill 用法"
```

---

## Task 4: 新建 performance-review 技能

**Files:**
- Create: `.cursor/skills/performance-review/SKILL.md`

- [ ] **Step 1: 读 quality-standards 性能指标**

读取 `w-model-dev/references/quality-standards.md` 的性能指标（P95 响应 < 2s、负载模型等）。

- [ ] **Step 2: 创建 SKILL.md**

按 spec §3.4 创建：frontmatter + 指令覆盖性能评审维度（响应时间/吞吐/资源占用/负载模型）+ 检查清单 + 与 security-review 对称。**无占位符**。

- [ ] **Step 3: 校验 + 提交**

Run: frontmatter 规范 + 无占位符。
```bash
git add .cursor/skills/performance-review/SKILL.md
git commit --no-gpg-sign -m "feat(skill): 新建 performance-review 技能"
```

---

## Task 5: 收尾（版本号 + SSoT + CHANGELOG + 顶层文档）

**Files:**
- Modify: `package.json`、`w-model-dev/SKILL.md`、`w-model-dev/skill-metadata.json`（版本号 33.0.0）
- Modify: `docs/skill-design-document_SSoT.md`（§3.4.31 + §10A）
- Modify: `CHANGELOG.md`（[33.0.0]）
- Modify: `README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md`（同步）

- [ ] **Step 1: 版本号三处 32.0.0→33.0.0**

package.json:3、w-model-dev/SKILL.md:3、w-model-dev/skill-metadata.json:3 同步升级。

- [ ] **Step 2: SSoT 新增 §3.4.31**

`docs/skill-design-document_SSoT.md` 在 §3.4.30 后新增 `#### 3.4.31 第 33 轮：全仓库优化 5 批实施（2026-08-05，[33.0.0]）`，格式同 §3.4.30（维度|内容表格：触发/新增/归一化/package.json/顶层文档/self-test/vitest/TypeScript strict）。§10A 追溯表追加一行。

- [ ] **Step 3: CHANGELOG 插入 [33.0.0]**

在 `## [32.0.0]` 上方插入 `## [33.0.0] - 2026-08-05` 条目，含 5 批实施摘要 + 验证（self-test 213、vitest 434、tsc 0、lint:security 0 新增）。

- [ ] **Step 4: 顶层文档同步**

- README.md：结构树补 3 个新技能、self-test 213、vitest 计数（核对 377 vs 363 不一致处）、版本号；
- AGENTS.md：目录速查表补 3 个新技能、self-test 213；
- CONTRIBUTING.md：self-test 213 样本清单、版本号；
- docs/INSTALL.md：version: 32.0.0→33.0.0、self-test 213、vitest 计数、结构树补新技能。
**文档修改串行执行**（逐文件 grep→读→改→确认）。

- [ ] **Step 5: 全量回归 + 提交**

Run: `npm run self-test`（213）、`npx vitest run`（全量，含 skill-metadata.test.ts 三方版本校验）、`npx tsc --noEmit`（0）、`npm run lint:security`（0 新增）。
Run: grep 版本号 32.0.0 全仓 → 0 命中（除历史记录）。
```bash
git add package.json w-model-dev/SKILL.md w-model-dev/skill-metadata.json docs/skill-design-document_SSoT.md CHANGELOG.md README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md
git commit --no-gpg-sign -m "chore(release): 版本号 33.0.0 + SSoT §3.4.31 + CHANGELOG + 顶层文档同步"
```

---

## 收尾验证（全部任务后）

- [ ] **全局基线**：self-test 213、vitest 全过（含 skill-metadata 三方校验）、tsc 0、lint:security 0 新增。
- [ ] **版本一致性**：三处 33.0.0 一致（skill-metadata.test.ts 通过）。
- [ ] **新技能校验**：3 个新技能 frontmatter 规范 + 无占位符。
- [ ] **5.3 特例**：eval/README.md 存在。
- [ ] **收尾特例**：SSoT §3.4.31 + §10A、CHANGELOG [33.0.0]、顶层文档同步；grep 32.0.0 0 命中（除历史）。
- [ ] **工作区干净**：`git status --short` 空输出。

---

## 自审记录（writing-plans self-review）

- **Spec 覆盖**：spec §3.1→Task 1；§3.2→Task 2；§3.3→Task 3；§3.4→Task 4；§3.5→Task 5；spec §4 验收→收尾验证。无缺口。
- **版本号**：本批升级 33.0.0（三处同步），skill-metadata.test.ts 自动验证。
- **5.3 边界**：eval 补跑依赖外部 darwin-skill，本批只补 README（用户已确认）。
- **风险点**：新技能须通过 writing-skills 校验（无占位符）；顶层文档同步须串行执行；grep 32.0.0 0 命中（除历史记录）。
