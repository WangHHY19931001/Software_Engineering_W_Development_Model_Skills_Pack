# 批次 4 实施计划：流程与体验（10 项）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10 项流程与体验改进——① .gitignore 补规则；② tsconfig 纳入 __tests__；③ pre-push 加固 + Windows 兼容；④ demo 清理 16 文件；⑤ 孤悬 design.md 归档；⑥ 技能双轨交叉引用；⑦ 覆盖矩阵补 15 行；⑧ start-server.sh 加固；⑨ brainstorming 路径前缀；⑩ systematic-debugging 孤立产物归档。**版本号不升**（批次 5 统一 33.0.0）。

**Architecture:** 10 项独立改进，互不依赖。多为配置/文档/清理类，无脚本行为等价重构（除 4.3/4.8 的 shell 加固）。设计 spec：[`docs/superpowers/specs/2026-08-05-opt-batch-4-process-experience-design.md`](../../docs/superpowers/specs/2026-08-05-opt-batch-4-process-experience-design.md)。

**Tech Stack:** bash（pre-push / start-server.sh）+ tsconfig + markdown 文档 + git 文件操作。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 删除/移动文件用 git rm / git mv。
- 文档修改串行执行、禁止并行（用户既定规则）。

## 任务总览（10 任务）

| 任务 | 内容 | 产物 | commit |
|---|---|---|---|
| 1 | .gitignore 补规则 | 根 .gitignore + demo .gitignore | `chore(gitignore): 补 coverage/tsbuildinfo/eslintcache + demo .w-model` |
| 2 | tsconfig 纳入 __tests__ | tsconfig.json | `chore(tsconfig): __tests__ 纳入 tsc 类型检查` |
| 3 | pre-push 加固 + Windows 兼容 | .githooks/pre-push | `chore(pre-push): set -euo pipefail + 样本数 213 + Windows 兼容` |
| 4 | demo 清理 16 文件 | w-model-dev-demo/ 删除 | `chore(demo): 清理 11 个 build-*.cjs + 5 个 integration-*.txt` |
| 5 | 孤悬 design.md 归档 | docs/changes/ 移动 + 2 plan 引用 | `docs(changes): 孤悬 design.md 归档 + 更新 plan 引用` |
| 6 | 技能双轨交叉引用 | 4 份文档 | `docs(skills): 双轨契约交叉引用（writing-plans↔phase-5、code-reviewer↔verifier-spec）` |
| 7 | 覆盖矩阵补 15 行 | __tests__/README.md | `docs(tests): 覆盖矩阵补 15 行（33/33）` |
| 8 | start-server.sh 加固 | brainstorming/scripts/start-server.sh | `chore(brainstorm): start-server.sh set -euo pipefail + PID 归属校验` |
| 9 | brainstorming 路径前缀 | brainstorming/SKILL.md | `fix(brainstorm): SKILL.md 路径前缀 skills/→.cursor/skills/` |
| 10 | systematic-debugging 孤立产物归档 | 4 文件 → archive/ | `chore(systematic-debugging): 孤立测试产物归档` |

---

## Task 1: .gitignore 补规则

**Files:**
- Modify: 根 `.gitignore`
- Modify: `w-model-dev-demo/.gitignore`

- [ ] **Step 1: 根 .gitignore 补 3 项**

在根 `.gitignore` 合适分组追加：
```
# 测试与构建缓存
coverage/
*.tsbuildinfo
.eslintcache
```
（先读现有 .gitignore 确认分组位置，避免重复）

- [ ] **Step 2: demo .gitignore 补完整 .w-model/**

`w-model-dev-demo/.gitignore` 追加完整 `.w-model/` 规则（现有只有子路径 `.w-model/tla/states/` 与 `.w-model/gate-logs/*.log`）：
```
# W-Model 运行时状态（完整忽略，含 tickets.md / codegraph-queries/ 等）
.w-model/
```
（保留现有 coverage/、dist/、node_modules/ 等规则）

- [ ] **Step 3: 验证**

Run: `git check-ignore -v coverage/foo.tsbuildinfo .eslintcache`（根）；`git check-ignore -v w-model-dev-demo/.w-model/tickets.md`（demo）→ 应命中新规则。

- [ ] **Step 4: 提交**

```bash
git add .gitignore w-model-dev-demo/.gitignore
git commit --no-gpg-sign -m "chore(gitignore): 补 coverage/tsbuildinfo/eslintcache + demo .w-model"
```

---

## Task 2: tsconfig 纳入 __tests__

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: 移除 exclude**

`tsconfig.json:33` 的 exclude 数组移除 `"w-model-dev/scripts/__tests__"`。

- [ ] **Step 2: tsc 验证**

Run: `npx tsc --noEmit` → 0 错误。
若报错（noUnusedLocals 等），**修复对应 test 文件**（不降 tsconfig 严格度），直到 0 错误。

- [ ] **Step 3: 全量回归 + 提交**

Run: `npm run self-test`（213 条）、`npx vitest run`（全量）。
```bash
git add tsconfig.json <修复的 test 文件>
git commit --no-gpg-sign -m "chore(tsconfig): __tests__ 纳入 tsc 类型检查"
```

---

## Task 3: pre-push 加固 + Windows 兼容

**Files:**
- Modify: `.githooks/pre-push`

- [ ] **Step 1: set -euo pipefail**

L19 `set -u` → `set -euo pipefail`。

- [ ] **Step 2: L109 注释 149→213**

L109 `# 1. self-test：149 条样本回归基线（含 10 BDD + 10 Coverage + 7 Exemption），必须 exit 0` → 改为 `213 条样本回归基线`（核对 self-test 实际样本数，若注释含分组明细则同步更新为当前分组）。

- [ ] **Step 3: Windows 兼容入口**

在 pre-push 顶部（set 之后）加 OS 检测：Windows（MSYSTEM/MINGW/CYGWIN 或 uname 检测）下提示使用 Git Bash 或调用 .cmd 包装。以最小改动为原则，不破坏 Linux/macOS 行为。参考仓库既有跨平台处理（如有）。

- [ ] **Step 4: 验证**

Run: `bash -n .githooks/pre-push` → 语法正确。
Run: `PREPUSH_FORCE=1 bash .githooks/pre-push`（Linux/macOS 或 Git Bash）→ 12 项全过（若环境可跑）。

- [ ] **Step 5: 提交**

```bash
git add .githooks/pre-push
git commit --no-gpg-sign -m "chore(pre-push): set -euo pipefail + 样本数 213 + Windows 兼容入口"
```

---

## Task 4: demo 清理 16 文件

**Files:**
- Delete: `w-model-dev-demo/` 11 个 build-*.cjs + 5 个 integration-*.txt

- [ ] **Step 1: 确认产物文档完整**

确认 `docs/phase3-design/` 下 integration-test.md、interface-design.md 等产物文档已提交（git ls-files 确认）。若产物缺失，停止并报告。

- [ ] **Step 2: 复核无引用**

grep `build-graph|build-phase|build-interface|build-integration|integration-result|integration-final`（限 .ts/.json/.md）→ 确认无引用。

- [ ] **Step 3: 删除**

`git rm` 11 个 build-*.cjs + 5 个 integration-*.txt。

- [ ] **Step 4: 验证 + 提交**

Run: demo 的 test 脚本（`cd w-model-dev-demo && npm test` 或等效）→ 不受影响。
```bash
git rm <16 文件>
git commit --no-gpg-sign -m "chore(demo): 清理 11 个 build-*.cjs + 5 个 integration-*.txt（瘦身 15-20%）"
```

---

## Task 5: 孤悬 design.md 归档

**Files:**
- Move: `docs/changes/2026-07-28-round20-phase1-4dim-identification/design.md` → archive/
- Modify: 2 个 plan 引用路径

- [ ] **Step 1: 确认归档目标**

确认 `docs/changes/archive/` 结构（现有 round15/19/20/23 归档目录）。决定归档方式：新建 `docs/changes/archive/2026-07-28-round20-phase1-4dim-identification/` 并移入 design.md，或并入现有 round20 归档。

- [ ] **Step 2: 移动**

`git mv` design.md 到归档目录。

- [ ] **Step 3: 更新 2 个 plan 引用**

`docs/superpowers/plans/2026-07-28-phase1-4dim-identification.md` 与 `-phase-D-G.md` 中引用该 design.md 的路径更新为归档后路径。

- [ ] **Step 4: 验证 + 提交**

Run: grep 引用路径 → 无 404（目标存在）。
```bash
git add -A docs/changes docs/superpowers/plans
git commit --no-gpg-sign -m "docs(changes): 孤悬 design.md 归档 + 更新 plan 引用"
```

---

## Task 6: 技能双轨交叉引用

**Files:**
- Modify: `.cursor/skills/writing-plans/SKILL.md`
- Modify: `w-model-dev/references/phase-5-coding.md`
- Modify: `.cursor/skills/requesting-code-review/code-reviewer.md`
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 补 4 处交叉引用**

按 spec §3.6，补 4 处互引（保持文档风格，markdown 相对链接）：
- writing-plans SKILL.md → 引用 `w-model-dev/references/phase-5-coding.md`；
- phase-5-coding.md → 引用 writing-plans 技能；
- code-reviewer.md → 引用 `w-model-dev/references/verifier-spec.md`；
- verifier-spec.md → 引用 code-reviewer 技能。
每处先读目标文档上下文，选合适位置（如"相关资源"节）插入一行引用，不改变内容语义。

- [ ] **Step 2: 验证 + 提交**

Run: 4 处引用目标文件存在（无 404）。
```bash
git add <4 文件>
git commit --no-gpg-sign -m "docs(skills): 双轨契约交叉引用（writing-plans↔phase-5、code-reviewer↔verifier-spec）"
```

---

## Task 7: 覆盖矩阵补 15 行

**Files:**
- Modify: `w-model-dev/scripts/__tests__/README.md`

- [ ] **Step 1: 核对缺失**

对照实际 __tests__ 目录 33 个 test 文件与矩阵现有 18 行，确认缺失的 15 个（含批次 3 新增的 state-machine-logic.test.ts）。

- [ ] **Step 2: 补 15 行**

按 `File | Area | What's locked in` 格式补 15 行。Area 与 What's locked in 从各 test 文件实际覆盖内容提炼（读各 test 文件 describe/it 标题）。保持字母序。

- [ ] **Step 3: 验证 + 提交**

Run: 矩阵行数 = 实际 test 文件数（33）。
```bash
git add w-model-dev/scripts/__tests__/README.md
git commit --no-gpg-sign -m "docs(tests): 覆盖矩阵补 15 行（33/33）"
```

---

## Task 8: start-server.sh 加固

**Files:**
- Modify: `.cursor/skills/brainstorming/scripts/start-server.sh`

- [ ] **Step 1: set -euo pipefail**

顶部（L1 shebang 后）加 `set -euo pipefail`。

- [ ] **Step 2: kill 前 PID 归属校验**

L147 `kill "$old_pid"` 前加归属校验：确认该 PID 属于本脚本启动的 server.cjs 进程（如检查 `/proc/$pid/cmdline` 或 `ps -p $pid -o command=` 含 server.cjs），不匹配则跳过 kill（并提示）。以最小改动为原则。

- [ ] **Step 3: 验证 + 提交**

Run: `bash -n .cursor/skills/brainstorming/scripts/start-server.sh` → 语法正确。
```bash
git add .cursor/skills/brainstorming/scripts/start-server.sh
git commit --no-gpg-sign -m "chore(brainstorm): start-server.sh set -euo pipefail + kill 前 PID 归属校验"
```

---

## Task 9: brainstorming 路径前缀

**Files:**
- Modify: `.cursor/skills/brainstorming/SKILL.md`

- [ ] **Step 1: 修正 L169**

`skills/brainstorming/visual-companion.md` → `.cursor/skills/brainstorming/visual-companion.md`。

- [ ] **Step 2: 验证 + 提交**

Run: grep `skills/` 前缀（brainstorming SKILL.md）→ 0 命中。
```bash
git add .cursor/skills/brainstorming/SKILL.md
git commit --no-gpg-sign -m "fix(brainstorm): SKILL.md 路径前缀 skills/→.cursor/skills/"
```

---

## Task 10: systematic-debugging 孤立产物归档

**Files:**
- Move: `.cursor/skills/systematic-debugging/` 4 个孤立测试产物 → archive/

- [ ] **Step 1: 确认孤立**

确认 test-academic.md + test-pressure-1/2/3.md 无任何引用（grep 全仓）。

- [ ] **Step 2: 归档**

新建 `.cursor/skills/systematic-debugging/archive/`，`git mv` 4 个文件入内。

- [ ] **Step 3: 验证 + 提交**

Run: grep 4 个文件名 → 仅 archive/ 内命中。
```bash
git add -A .cursor/skills/systematic-debugging
git commit --no-gpg-sign -m "chore(systematic-debugging): 孤立测试产物归档至 archive/"
```

---

## 收尾验证（全部任务后）

- [ ] **全局基线**：`npm run self-test` 213 条；`npx vitest run` 全通过；`npx tsc --noEmit` 0 错误（含 4.2 纳入 __tests__）；`npm run lint:security` baseline 通过。
- [ ] **4.3 特例**：`npm run prepush` 在可用环境 12 项全过。
- [ ] **4.4 特例**：demo 测试套件不受影响。
- [ ] **4.5/4.6 特例**：引用无 404。
- [ ] **4.7 特例**：覆盖矩阵 33 行 = 实际 33 个。
- [ ] **4.8 特例**：`bash -n` 语法正确。
- [ ] **4.9 特例**：`skills/` 前缀 0 命中。
- [ ] **工作区干净**：`git status --short` 空输出。

---

## 自审记录（writing-plans self-review）

- **Spec 覆盖**：spec §3.1→Task 1；§3.2→Task 2；§3.3→Task 3；§3.4→Task 4；§3.5→Task 5；§3.6→Task 6；§3.7→Task 7；§3.8→Task 8；§3.9→Task 9；§3.10→Task 10；spec §4 验收→收尾验证。无缺口。
- **行为等价**：本批无脚本行为等价重构（除 4.3/4.8 shell 加固，属健壮性增强非语义变更）；4.2 纳入 __tests__ 后 tsc 0 错误为硬门槛。
- **删除/移动授权**：4.4（demo 16 文件）、4.5（design.md 归档）、4.10（4 个孤立产物归档）均在总框架 D4 决策范围内；删除前均有复核引用步骤。
- **风险点**：4.2 若 tsc 报错须修测试不降严格度；4.3 Windows 兼容以最小改动为原则；4.5 归档后 plan 引用须可达。
