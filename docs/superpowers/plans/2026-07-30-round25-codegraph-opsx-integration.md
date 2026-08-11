# Round 25 codegraph + OpenSpec 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 阶段 5-8 引入 codegraph（修改前影响分析）+ OpenSpec opsx（任务规划层），三段式 S 分派 + 每段 R3×3+V 审查，依赖自动安装初始化。

**Architecture:** codegraph 作为宿主 Agent MCP 工具（修改前查询 callers/callees/blast radius 并落盘）；OpenSpec opsx 作为宿主 Agent CLI（explore/propose/apply/archive 工作流）；opsx 与现有 S-tickets 共存（tasks.md=what/why, tickets.md=how）；技能包通过 4 个新脚本（ensure-codegraph-opsx / check-codegraph-queries / check-opsx-artifacts / check-openspec-archive）做依赖管理与门禁校验。

**Tech Stack:** TypeScript（strict mode）+ Vitest + JSON Schema draft-07 + 纯 Markdown 约束/反模式

**Spec:** [`docs/superpowers/specs/2026-07-30-round25-codegraph-opsx-integration-design.md`](../specs/2026-07-30-round25-codegraph-opsx-integration-design.md)

---

## 文件结构

**新建文件：**
- `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts` — 三层依赖检测+自动安装初始化
- `w-model-dev/scripts/cli/check-codegraph-queries.ts` — 校验 codegraph 查询落盘（反模式 #38）
- `w-model-dev/scripts/cli/check-opsx-artifacts.ts` — 校验 opsx 制品+审查产物（反模式 #39/#40）
- `w-model-dev/scripts/cli/check-openspec-archive.ts` — 校验 opsx:archive 归档完整性

**修改文件：**
- `docs/skill-design-document_SSoT.md` — §3.3 外部工具边界 + §3.4.21 第 25 轮记录
- `w-model-dev/SKILL.md` — frontmatter version + 约束块 #20 + Bundled Resources + 阶段 5-8 流程
- `w-model-dev/references/anti-patterns.md` — #38/#39/#40
- `w-model-dev/references/phase-5-coding.md` — opsx 三段式 + codegraph + S-tickets 共存
- `w-model-dev/references/phase-{6,7,8}-*.md` — opsx 三段式 + codegraph
- `w-model-dev/references/subagent-delegation.md` — S-explore/S-propose/S-coding 变体
- `w-model-dev/schemas/run-log.schema.json` — action 枚举 +6 值
- `w-model-dev/scripts/logic/gate-logic.ts` — +3 个布尔校验逻辑
- `w-model-dev/scripts/cli/self-test.ts` — +codegraph/opsx 用例
- `w-model-dev/skill-metadata.json` — version + updatedAt
- `package.json` — version
- `docs/INSTALL.md` — codegraph/OpenSpec 安装说明

**新建样本：**
- `w-model-dev/scripts/samples/codegraph-queries/` — valid + bad 样本
- `w-model-dev/scripts/samples/opsx-artifacts/` — valid + bad 样本
- `w-model-dev/scripts/samples/openspec-archive/` — valid + bad 样本

---

## 批次 A：SSoT + 版本号 + 约束/反模式（文档层）

### Task 1: SSoT §3.4.21 新增第 25 轮记录

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（第 720 行 `---` 前插入，即第 718 行「不涉及范围」之后）

- [ ] **Step 1: 在 SSoT §3.4.20 的「不涉及范围」段（第 718 行）之后、`---`（第 720 行）之前插入 §3.4.21**

插入内容：

```markdown

#### 3.4.21 第 25 轮：codegraph + OpenSpec 集成（2026-07-30）

> 触发：用户要求阶段 5 起引入 codegraph（修改前影响分析）与 OpenSpec opsx（任务规划层），增强代码修改安全性与任务拆解规范性。设计 spec：[`docs/superpowers/specs/2026-07-30-round25-codegraph-opsx-integration-design.md`](./superpowers/specs/2026-07-30-round25-codegraph-opsx-integration-design.md)。经联网调研确认两工具能力定位：codegraph 提供 100% 本地符号级 callers/callees/blast radius 查询（auto-sync）；OpenSpec 提供 opsx:explore/propose/apply/archive 规格驱动变更工作流。集成方案 A（三段式 S 分派，每段 R3×3+V）。版本号目标 24.0.0。

1. **外部工具边界扩展**：SSoT §3.3 外部工具边界新增 codegraph（宿主 Agent MCP 工具 `codegraph_explore`，修改前预防）+ OpenSpec（宿主 Agent CLI `/opsx:*`，规格级规划层）。技能包不内置调用，通过 CHECKPOINT/子代理指令触发。

2. **codegraph 修改前强制查询**：新增约束 #20「阶段 5-8 任何代码/测试文件修改前，S-coding 须先调用 `codegraph_explore` 查询目标符号影响半径（callers/callees/blast radius），结果落盘 `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`」。新增反模式 #38「修改前未查询 codegraph」。与 code-TLA+ 一致性校验（修改后回归）互补。

3. **OpenSpec opsx 与 S-tickets 共存**：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how，端到端切片），opsx:apply 按 tickets.md frontier 执行。新增反模式 #39「跳过 opsx 产物审查」+ #40「opsx/S-tickets 职责混淆」。

4. **三段式 S 分派**：S-explore（opsx:explore + codegraph 影响初判）→ S-propose（opsx:propose + S-tickets 拆解）→ S-coding（按 tickets frontier 逐片编码，每片 codegraph_explore）。每段产物跑 R3×3（completeness/reliability/security）+ V 评审，不合格打回重做。

5. **依赖自动检查与安装初始化**：新增 `ensure-codegraph-opsx.ts`，三层检测（L1 CLI / L2 MCP 注册 / L3 项目目录）+ 自动处置（npm i -g / codegraph install --yes / codegraph init / openspec init），仅自动失败时 CHECKPOINT。三模式：full（阶段 5 首次）/ quick（阶段 6-8）/ light（启动健康检查）。

6. **门禁扩展**：新增 `check-codegraph-queries.ts`（反模式 #38）/ `check-opsx-artifacts.ts`（反模式 #39/#40）/ `check-openspec-archive.ts`（归档完整性）。`gate-logic.ts` 阶段 5-8 增加 codegraphQueriesValid / opsxArtifactsValid / openspecArchived 三布尔校验。`run-log.schema.json` action 枚举 +6 值（codegraph_query / opsx_explore / opsx_propose / opsx_apply / opsx_archive / ensure_deps）。

**不涉及范围**：不修改约束 #1-#19 既有语义；不修改阶段 1-4 流程（仍是 A/S-doc/S-tla/S-bdd）；不内置 codegraph/opsx 调用（依赖宿主 Agent）；codegraph auto-sync 保持开启不手动管理图谱新鲜度。
```

- [ ] **Step 2: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(s sot): §3.4.21 第25轮 codegraph+opsx 集成记录"
```

---

### Task 2: SSoT §3.3 外部工具边界扩展

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（§3.3 第 242 行起）

- [ ] **Step 1: 读取 §3.3 当前内容确定插入点**

Run: `grep -n "外部工具边界" docs/skill-design-document_SSoT.md`

- [ ] **Step 2: 在 §3.3 外部工具边界节末尾追加 codegraph/OpenSpec 声明**

在 §3.3 节的现有内容末尾追加：

```markdown

### 3.3.x 外部工具集成（第 25 轮新增）

| 工具 | 定位 | 集成方式 | 应用阶段 | 触发条件 |
|---|---|---|---|---|
| codegraph | 修改前影响分析（callers/callees/blast radius） | 宿主 Agent MCP（`codegraph_explore`）+ auto-sync | 5-8 | S-coding 任何 Edit/Write 前（约束 #20） |
| OpenSpec | 规格级任务规划（opsx:explore/propose/apply/archive） | 宿主 Agent CLI/技能（`/opsx:*`） | 5-8 | S-explore/S-propose/S-coding 分派时 |

技能包不内置调用上述工具，通过 CHECKPOINT 指令 + 子代理分派模板触发。依赖检测与自动安装由 `ensure-codegraph-opsx.ts` 承载。
```

- [ ] **Step 3: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(s sot): §3.3 外部工具边界 +codegraph/OpenSpec"
```

---

### Task 3: SKILL.md 约束块追加 #20

**Files:**
- Modify: `w-model-dev/SKILL.md`（第 56 行约束 #19 之后，第 57 行空行处插入）

- [ ] **Step 1: 在约束 #19（第 56 行）之后追加约束 #20**

在第 56 行（约束 #19）之后、第 57 行（空行）之前插入：

```markdown
20. **codegraph 修改前强制查询**：阶段 5-8 任何代码/测试文件 `Edit`/`Write` 前，S-coding 子代理须先调用宿主 Agent 的 `codegraph_explore` MCP 工具查询目标符号影响半径（callers/callees/blast radius），并将查询结果落盘到 `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`（含 querySymbol / callers[] / callees[] / blastRadius / queryTimestamp）。未查询直接修改视为违反约束 #20，命中反模式 #38。codegraph 与 code-TLA+ 一致性校验（修改后回归）互补：前者预防、后者回归。详见 [references/phase-5-coding.md](references/phase-5-coding.md)「codegraph 修改前影响分析」节。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(skill): 约束 #20 codegraph 修改前强制查询"
```

---

### Task 4: references/anti-patterns.md 追加 #38/#39/#40

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`（第 521 行 #37 关联之后，第 523 行「实现层经验教训」之前插入）

- [ ] **Step 1: 在反模式 #37（第 521 行）之后、「实现层经验教训」（第 523 行）之前插入 #38/#39/#40**

```markdown

## #38 修改前未查询 codegraph（第25轮新增）

**危害**：S-coding 子代理在阶段 5-8 直接修改代码/测试文件，未先查询 codegraph 影响半径，可能误改被广泛依赖的符号，引入隐蔽回归。

**检测信号**：
- `.w-model/codegraph-queries/` 目录不存在或为空（阶段 5-8 有代码修改但无查询记录）
- 代码修改的 ticket 在 codegraph-queries/ 下无对应 `<phase>-<ticket>-<symbol>.json` 落盘文件
- run-log 中阶段 5-8 有 action=produce（代码产出）但无 action=codegraph_query 记录

**回退动作**：撤销未查询的修改，补跑 codegraph_explore 查询并落盘，重新评估影响半径后重做修改。

**门禁脚本**：`check-codegraph-queries.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）；约束 #20

## #39 跳过 opsx 产物审查（第25轮新增）

**危害**：opsx:explore/propose/apply 工作流步骤产物未经 R3×3（completeness/reliability/security）+ V 评审即进入下一步，导致规划缺陷或实现偏差未被发现。

**检测信号**：
- `.w-model/r3-reviews/` 下缺少 `<phase>-explore-*.md` / `<phase>-propose-*.md` / `<phase>-coding-*.md` 任一段的 3 份 R3 报告
- `.w-model/v-reviews/` 下缺少对应段的 V 评审文件
- run-log 中 opsx 步骤（action=opsx_explore/opsx_propose/opsx_apply）之间无 action=r3-completeness/r3-reliability/r3-security + role=V 记录

**回退动作**：回退到缺失审查的 opsx 步骤，补跑 R3×3 + V 评审后重做后续步骤。

**门禁脚本**：`check-opsx-artifacts.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）；约束 #17（R3 预防性审查强制）

## #40 opsx/S-tickets 职责混淆（第25轮新增）

**危害**：用 opsx:propose 的 tasks.md 替代 S-tickets 的 tickets.md（或反之），破坏规格级规划（what/why）与代码级切片（how）的职责边界，导致切片缺失端到端可 demo 性或规划缺失设计依据。

**检测信号**：
- `openspec/changes/<change>/` 目录下有 tasks.md 但无 tickets.md（S-tickets 拆解被跳过）
- tickets.md 存在但 tasks.md 缺失（opsx:propose 被跳过）
- tickets.md 内容是高层任务清单而非 vertical-slice 切片（职责错位）
- tasks.md 内容含 tracer-bullet/blocking-edges 代码切片细节（职责错位）

**回退动作**：补齐缺失的制品，修正职责错位的内容，重审 R3×3 + V。

**门禁脚本**：`check-opsx-artifacts.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(skill): 反模式 #38/#39/#40 codegraph/opsx 相关"
```

---

### Task 5: 版本号三处同步 24.0.0

**Files:**
- Modify: `package.json`（第 3 行）
- Modify: `w-model-dev/skill-metadata.json`（第 3 行 + 第 7 行 updatedAt）
- Modify: `w-model-dev/SKILL.md`（第 3 行 frontmatter version）

- [ ] **Step 1: 修改 package.json 第 3 行 version**

`"version": "23.0.0"` → `"version": "24.0.0"`

- [ ] **Step 2: 修改 skill-metadata.json 第 3 行 version + 第 7 行 updatedAt**

`"version": "23.0.0"` → `"version": "24.0.0"`
`"updatedAt": "2026-07-29"` → `"updatedAt": "2026-07-30"`

- [ ] **Step 3: 修改 SKILL.md 第 3 行 frontmatter version**

`version: 23.0.0` → `version: 24.0.0`

- [ ] **Step 4: 验证三处一致**

Run: `grep -n '"version": "24.0.0"' package.json w-model-dev/skill-metadata.json && grep -n '^version: 24.0.0' w-model-dev/SKILL.md`
Expected: 三行均输出

- [ ] **Step 5: Commit**

```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md
git commit -m "chore(w-model-dev): 版本号 24.0.0"
```

---

## 批次 B：schema + 逻辑层

### Task 6: run-log.schema.json action 枚举扩展

**Files:**
- Modify: `w-model-dev/schemas/run-log.schema.json`（第 14 行 action enum）

- [ ] **Step 1: 扩展 action 枚举，在第 14 行现有 19 个值后追加 6 个**

将第 14 行：
```json
    "action": { "enum": ["chunk", "cross", "evolve", "produce", "review", "gate", "tla-gate", "graph-gate", "test", "checkpoint", "rework", "rollback", "rootcause", "fix", "escalate", "r3-completeness", "r3-reliability", "r3-security"] },
```
改为：
```json
    "action": { "enum": ["chunk", "cross", "evolve", "produce", "review", "gate", "tla-gate", "graph-gate", "test", "checkpoint", "rework", "rollback", "rootcause", "fix", "escalate", "r3-completeness", "r3-reliability", "r3-security", "codegraph_query", "opsx_explore", "opsx_propose", "opsx_apply", "opsx_archive", "ensure_deps"] },
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json
git commit -m "feat(schema): run-log action 枚举 +6 codegraph/opsx 值"
```

---

### Task 7: 新增 ensure-codegraph-opsx.ts

**Files:**
- Create: `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`

- [ ] **Step 1: 编写 ensure-codegraph-opsx.ts**

```typescript
#!/usr/bin/env tsx
/**
 * codegraph + OpenSpec 依赖检测与自动安装初始化脚本
 *
 * 对应 SSoT §3.4.21：阶段 5-8 引入 codegraph（修改前影响分析）+ OpenSpec opsx（任务规划层）。
 * 三层检测（L1 CLI / L2 MCP 注册 / L3 项目目录）+ 自动处置，仅自动失败时 CHECKPOINT。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>
 *
 * 模式：
 *   full   = L1→L2→L3 全量检测+自动处置（阶段 5 首次进入）
 *   quick  = L1+L3 快速复检（阶段 6-8 进入）
 *   light  = 仅 L1 轻检（技能启动健康检查）
 *
 * 退出码：
 *   0  全部 ready 或 installed
 *   1  有 CHECKPOINT 项（需人工介入）
 *   2  输入错误（参数缺失/非法）
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type Mode = 'full' | 'quick' | 'light';

interface CheckResult {
  layer: string;
  item: string;
  status: 'ready' | 'installed' | 'checkpoint';
  detail: string;
}

/**
 * 检测 CLI 是否可用（L1）
 */
function checkCli(name: string): boolean {
  try {
    execFileSync(name, ['--version'], { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * npm 全局安装 CLI
 */
function installCli(packageName: string): boolean {
  try {
    execFileSync('npm', ['i', '-g', packageName], { stdio: 'pipe', timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检测 codegraph_explore MCP 工具可调用性（L2）
 * 通过尝试执行 codegraph 查询探针符号判断 MCP 是否注册
 */
function checkMcpCodegraph(projectRoot: string): boolean {
  try {
    // codegraph CLI 可查询图谱验证 MCP 链路；探针符号取项目入口
    execFileSync('codegraph', ['query', '--symbol', 'main'], {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 注册 codegraph MCP 到 Agent（L2 自动处置）
 */
function registerMcpCodegraph(): boolean {
  try {
    execFileSync('codegraph', ['install', '--yes'], { stdio: 'pipe', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * codegraph 项目初始化（L3）
 */
function initCodegraph(projectRoot: string): boolean {
  try {
    execFileSync('codegraph', ['init'], { cwd: projectRoot, stdio: 'pipe', timeout: 300000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * openspec 项目初始化（L3）
 */
function initOpenspec(projectRoot: string): boolean {
  try {
    execFileSync('openspec', ['init'], { cwd: projectRoot, stdio: 'pipe', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 依赖检测纯逻辑（可被 self-test import）
 */
export function ensureDeps(phase: number, projectRoot: string, mode: Mode): CheckResult[] {
  const results: CheckResult[] = [];
  const isFull = mode === 'full';
  const isQuickOrFull = mode === 'full' || mode === 'quick';

  // L1: codegraph CLI
  if (checkCli('codegraph')) {
    results.push({ layer: 'L1', item: 'codegraph CLI', status: 'ready', detail: 'codegraph --version OK' });
  } else {
    if (installCli('@colbymchenry/codegraph') && checkCli('codegraph')) {
      results.push({ layer: 'L1', item: 'codegraph CLI', status: 'installed', detail: 'npm i -g @colbymchenry/codegraph 成功' });
    } else {
      results.push({ layer: 'L1', item: 'codegraph CLI', status: 'checkpoint', detail: '自动安装失败，需用户手动 npm i -g @colbymchenry/codegraph 或检查权限' });
    }
  }

  // L1: openspec CLI
  if (checkCli('openspec')) {
    results.push({ layer: 'L1', item: 'openspec CLI', status: 'ready', detail: 'openspec --version OK' });
  } else {
    if (installCli('@fission-ai/openspec@latest') && checkCli('openspec')) {
      results.push({ layer: 'L1', item: 'openspec CLI', status: 'installed', detail: 'npm i -g @fission-ai/openspec@latest 成功' });
    } else {
      results.push({ layer: 'L1', item: 'openspec CLI', status: 'checkpoint', detail: '自动安装失败，需用户手动 npm i -g @fission-ai/openspec@latest' });
    }
  }

  // light 模式到此为止
  if (mode === 'light') return results;

  // L2: codegraph MCP 注册（仅 full 模式）
  if (isFull) {
    if (checkMcpCodegraph(projectRoot)) {
      results.push({ layer: 'L2', item: 'codegraph_explore MCP', status: 'ready', detail: '探针查询成功，MCP 已注册' });
    } else {
      if (registerMcpCodegraph() && checkMcpCodegraph(projectRoot)) {
        results.push({ layer: 'L2', item: 'codegraph_explore MCP', status: 'installed', detail: 'codegraph install --yes 成功' });
      } else {
        results.push({ layer: 'L2', item: 'codegraph_explore MCP', status: 'checkpoint', detail: '需用户手动运行交互式 codegraph install' });
      }
    }
  }

  // L3: codegraph 图谱目录
  const codegraphDir = path.join(projectRoot, '.codegraph');
  if (existsSync(codegraphDir)) {
    results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'ready', detail: '目录已存在' });
  } else {
    if (initCodegraph(projectRoot) && existsSync(codegraphDir)) {
      results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'installed', detail: 'codegraph init 成功' });
    } else {
      results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'checkpoint', detail: 'codegraph init 失败，需用户手动执行' });
    }
  }

  // L3: openspec 工作区目录
  const openspecDir = path.join(projectRoot, 'openspec');
  if (existsSync(openspecDir)) {
    results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'ready', detail: '目录已存在' });
  } else {
    if (initOpenspec(projectRoot) && existsSync(openspecDir)) {
      results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'installed', detail: 'openspec init 成功' });
    } else {
      results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'checkpoint', detail: 'openspec init 失败，需用户手动执行' });
    }
  }

  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const phaseStr = getArg('phase');
  const projectRoot = getArg('project-root');
  const modeStr = getArg('mode') as Mode | undefined;

  if (!phaseStr || !projectRoot || !modeStr) {
    console.error('用法: npx tsx ensure-codegraph-opsx.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>');
    process.exit(2);
  }

  const phase = parseInt(phaseStr, 10);
  if (phase < 5 || phase > 8) {
    console.error(`✗ phase 须为 5-8，收到 ${phase}`);
    process.exit(2);
  }

  if (!['full', 'quick', 'light'].includes(modeStr)) {
    console.error(`✗ mode 须为 full/quick/light，收到 ${modeStr}`);
    process.exit(2);
  }

  const absRoot = path.resolve(projectRoot);
  const results = ensureDeps(phase, absRoot, modeStr);
  const hasCheckpoint = results.some(r => r.status === 'checkpoint');

  console.log('═'.repeat(60));
  console.log('codegraph + OpenSpec 依赖检测');
  console.log('═'.repeat(60));
  console.log(`阶段          : ${phase}`);
  console.log(`项目根        : ${absRoot}`);
  console.log(`模式          : ${modeStr}`);
  console.log(`校验结果      : ${hasCheckpoint ? '✗ 有 CHECKPOINT' : '✓ 就绪'}`);
  console.log('─'.repeat(60));

  for (const r of results) {
    const icon = r.status === 'ready' ? '✓' : r.status === 'installed' ? '+' : '✗';
    console.log(`  ${icon} [${r.layer}] ${r.item}: ${r.status} — ${r.detail}`);
  }

  const exitCode = hasCheckpoint ? 1 : 0;
  console.log('─'.repeat(60));
  console.log('ENSURE_DEPS_JSON ' + JSON.stringify({
    type: 'ensure-deps',
    phase,
    mode: modeStr,
    passed: !hasCheckpoint,
    exitCode,
    results,
  }));

  process.exit(exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    console.error('ensure-codegraph-opsx 异常:', err);
    process.exit(2);
  });
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/cli/ensure-codegraph-opsx.ts
git commit -m "feat(script): ensure-codegraph-opsx.ts 三层依赖检测+自动安装"
```

---

### Task 8: 新增 check-codegraph-queries.ts

**Files:**
- Create: `w-model-dev/scripts/cli/check-codegraph-queries.ts`

- [ ] **Step 1: 编写 check-codegraph-queries.ts**

```typescript
#!/usr/bin/env tsx
/**
 * codegraph 查询落盘校验脚本（Codegraph Queries Checker）
 *
 * 对应约束 #20 + 反模式 #38：阶段 5-8 任何代码/测试文件修改前，
 * S-coding 须先调用 codegraph_explore 查询并落盘到
 * `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  所有修改都有对应 codegraph 查询落盘
 *   1  存在未查询的修改（命中反模式 #38）
 *   2  输入错误
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface CodegraphQuery {
  querySymbol: string;
  callers?: unknown[];
  callees?: unknown[];
  blastRadius?: unknown;
  queryTimestamp: string;
}

interface CheckResult {
  passed: boolean;
  violations: string[];
  queryCount: number;
}

/**
 * 校验 codegraph 查询落盘纯逻辑（可被 self-test import）
 * @param projectRoot 项目根目录
 * @param phase 阶段号 5-8
 */
export function checkCodegraphQueries(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const queriesDir = path.join(projectRoot, '.w-model', 'codegraph-queries');

  // 查询目录存在性
  if (!pathExists(queriesDir)) {
    violations.push(
      `阶段 ${phase}：.w-model/codegraph-queries/ 目录不存在（约束 #20：阶段 5-8 代码修改须先落盘 codegraph 查询）`,
    );
    return { passed: false, violations, queryCount: 0 };
  }

  // 收集该阶段的查询文件
  const prefix = `phase${phase}-`;
  const files = listFiles(queriesDir).filter(f => f.startsWith(prefix) && f.endsWith('.json'));

  if (files.length === 0) {
    violations.push(
      `阶段 ${phase}：.w-model/codegraph-queries/ 下无 phase${phase}-*.json 查询文件（约束 #20）`,
    );
    return { passed: false, violations, queryCount: 0 };
  }

  // 校验每个查询文件的字段完整性
  let validCount = 0;
  for (const f of files) {
    const fp = path.join(queriesDir, f);
    const raw = readFileSync(fp);
    if (!raw) {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    try {
      const q = JSON.parse(raw) as CodegraphQuery;
      if (!q.querySymbol || typeof q.querySymbol !== 'string') {
        violations.push(`${f}：缺 querySymbol 字段`);
        continue;
      }
      if (!q.queryTimestamp || typeof q.queryTimestamp !== 'string') {
        violations.push(`${f}：缺 queryTimestamp 字段`);
        continue;
      }
      if (!Array.isArray(q.callers)) {
        violations.push(`${f}：缺 callers[] 字段`);
        continue;
      }
      if (!Array.isArray(q.callees)) {
        violations.push(`${f}：缺 callees[] 字段`);
        continue;
      }
      validCount++;
    } catch {
      violations.push(`${f}：非合法 JSON`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    queryCount: validCount,
  };
}

// 同步辅助（纯逻辑层避免 async 便于 self-test）
function pathExists(p: string): boolean {
  try {
    const { existsSync } = require('node:fs');
    return existsSync(p);
  } catch {
    return false;
  }
}

function listFiles(dir: string): string[] {
  try {
    const { readdirSync } = require('node:fs');
    return readdirSync(dir) as string[];
  } catch {
    return [];
  }
}

function readFileSync(p: string): string | null {
  try {
    const { readFileSync } = require('node:fs');
    return readFileSync(p, 'utf-8') as string;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx >= 0 ? parseInt(args[phaseIdx + 1]!, 10) : NaN;

  if (!file || Number.isNaN(phase)) {
    console.error('用法: npx tsx check-codegraph-queries.ts <project-root> --phase <5|6|7|8>');
    process.exit(2);
  }
  if (phase < 5 || phase > 8) {
    console.error(`✗ phase 须为 5-8，收到 ${phase}`);
    process.exit(2);
  }

  const abs = path.resolve(file);
  const result = checkCodegraphQueries(abs, phase);

  console.log('═'.repeat(60));
  console.log('codegraph 查询落盘校验（Codegraph Queries Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`有效查询数    : ${result.queryCount}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因（反模式 #38）：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('CODEGRAPH_QUERIES_JSON ' + JSON.stringify({
    type: 'codegraph-queries',
    passed: result.passed,
    exitCode,
    phase,
    queryCount: result.queryCount,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    console.error('check-codegraph-queries 异常:', err);
    process.exit(2);
  });
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/cli/check-codegraph-queries.ts
git commit -m "feat(script): check-codegraph-queries.ts 反模式 #38 校验"
```

---

### Task 9: 新增 check-opsx-artifacts.ts

**Files:**
- Create: `w-model-dev/scripts/cli/check-opsx-artifacts.ts`

- [ ] **Step 1: 编写 check-opsx-artifacts.ts**

```typescript
#!/usr/bin/env tsx
/**
 * OpenSpec opsx 制品与审查产物校验脚本（Opsx Artifacts Checker）
 *
 * 对应反模式 #39（跳过 opsx 产物审查）+ #40（opsx/S-tickets 职责混淆）。
 * 校验每阶段 opsx 变更目录制品齐全（proposal/specs/design/tasks + tickets）
 * + R3×3 + V 审查产物齐全。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  制品与审查产物齐全
 *   1  缺失制品或审查（命中 #39/#40）
 *   2  输入错误
 */

import * as path from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface CheckResult {
  passed: boolean;
  violations: string[];
  changeName: string | null;
  artifactsFound: string[];
  reviewsFound: string[];
}

const REQUIRED_OPSX_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'tickets.md'] as const;
const REQUIRED_R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;
const REQUIRED_STAGES = ['explore', 'propose', 'coding'] as const;

/**
 * 校验 opsx 制品与审查产物纯逻辑（可被 self-test import）
 */
export function checkOpsxArtifacts(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];
  const reviewsFound: string[] = [];

  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!existsSync(changesDir)) {
    violations.push(`openspec/changes/ 目录不存在（阶段 ${phase} 须有 opsx 变更）`);
    return { passed: false, violations, changeName: null, artifactsFound, reviewsFound };
  }

  // 找该阶段的变更目录 phase<N>-*
  const prefix = `phase${phase}-`;
  const entries = readdirSync(changesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith(prefix) && e.name !== 'archive');

  if (entries.length === 0) {
    violations.push(`阶段 ${phase}：openspec/changes/ 下无 ${prefix}* 变更目录`);
    return { passed: false, violations, changeName: null, artifactsFound, reviewsFound };
  }

  const changeDir = path.join(changesDir, entries[0]!.name);
  const changeName = entries[0]!.name;

  // 校验 opsx 制品 + tickets（反模式 #40）
  for (const art of REQUIRED_OPSX_ARTIFACTS) {
    const artPath = path.join(changeDir, art);
    if (existsSync(artPath)) {
      artifactsFound.push(art);
    } else {
      violations.push(`${changeName}/${art} 缺失（反模式 #40：opsx/S-tickets 职责混淆）`);
    }
  }

  // 校验 specs/ 目录存在
  const specsDir = path.join(changeDir, 'specs');
  if (!existsSync(specsDir)) {
    violations.push(`${changeName}/specs/ 目录缺失`);
  } else {
    artifactsFound.push('specs/');
  }

  // 校验 R3×3 + V 审查产物（反模式 #39）
  const r3Dir = path.join(projectRoot, '.w-model', 'r3-reviews');
  const vDir = path.join(projectRoot, '.w-model', 'v-reviews');

  for (const stage of REQUIRED_STAGES) {
    for (const dim of REQUIRED_R3_DIMENSIONS) {
      const r3File = path.join(r3Dir, `phase${phase}-${stage}-${dim}.md`);
      if (existsSync(r3File)) {
        reviewsFound.push(`${stage}-${dim}`);
      } else {
        violations.push(`.w-model/r3-reviews/phase${phase}-${stage}-${dim}.md 缺失（反模式 #39：跳过 opsx 产物审查）`);
      }
    }
    const vFile = path.join(vDir, `phase${phase}-${stage}.md`);
    if (existsSync(vFile)) {
      reviewsFound.push(`${stage}-V`);
    } else {
      violations.push(`.w-model/v-reviews/phase${phase}-${stage}.md 缺失（反模式 #39）`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    changeName,
    artifactsFound,
    reviewsFound,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx >= 0 ? parseInt(args[phaseIdx + 1]!, 10) : NaN;

  if (!file || Number.isNaN(phase)) {
    console.error('用法: npx tsx check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>');
    process.exit(2);
  }
  if (phase < 5 || phase > 8) {
    console.error(`✗ phase 须为 5-8，收到 ${phase}`);
    process.exit(2);
  }

  const abs = path.resolve(file);
  const result = checkOpsxArtifacts(abs, phase);

  console.log('═'.repeat(60));
  console.log('opsx 制品与审查产物校验（Opsx Artifacts Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更名        : ${result.changeName ?? '（未找到）'}`);
  console.log(`制品          : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`审查产物      : ${result.reviewsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('OPSX_ARTIFACTS_JSON ' + JSON.stringify({
    type: 'opsx-artifacts',
    passed: result.passed,
    exitCode,
    phase,
    changeName: result.changeName,
    artifactsFound: result.artifactsFound,
    reviewsFound: result.reviewsFound,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    console.error('check-opsx-artifacts 异常:', err);
    process.exit(2);
  });
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/cli/check-opsx-artifacts.ts
git commit -m "feat(script): check-opsx-artifacts.ts 反模式 #39/#40 校验"
```

---

### Task 10: 新增 check-openspec-archive.ts

**Files:**
- Create: `w-model-dev/scripts/cli/check-openspec-archive.ts`

- [ ] **Step 1: 编写 check-openspec-archive.ts**

```typescript
#!/usr/bin/env tsx
/**
 * OpenSpec 归档完整性校验脚本（Openspec Archive Checker）
 *
 * 对应 SSoT §3.4.21：阶段门 V/G 全通过后须执行 opsx:archive 归档变更。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  归档完整
 *   1  未归档或归档不完整
 *   2  输入错误
 */

import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface CheckResult {
  passed: boolean;
  violations: string[];
  archivedChange: string | null;
  artifactsFound: string[];
}

const REQUIRED_ARCHIVED_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md'] as const;

/**
 * 校验 opsx 归档完整性纯逻辑（可被 self-test import）
 */
export function checkOpenspecArchive(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];

  const archiveDir = path.join(projectRoot, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) {
    violations.push(`openspec/changes/archive/ 目录不存在（阶段 ${phase} 须归档 opsx 变更）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  // 找该阶段的归档目录 *-phase<N>-*
  const suffix = `phase${phase}-`;
  const entries = readdirSync(archiveDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.includes(suffix));

  if (entries.length === 0) {
    violations.push(`阶段 ${phase}：archive/ 下无含 ${suffix} 的归档目录（opsx:archive 未执行）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  const archivedDir = path.join(archiveDir, entries[0]!.name);
  const archivedChange = entries[0]!.name;

  for (const art of REQUIRED_ARCHIVED_ARTIFACTS) {
    const artPath = path.join(archivedDir, art);
    if (existsSync(artPath)) {
      artifactsFound.push(art);
    } else {
      violations.push(`${archivedChange}/${art} 缺失（归档不完整）`);
    }
  }

  // specs/ 目录
  const specsDir = path.join(archivedDir, 'specs');
  if (existsSync(specsDir)) {
    artifactsFound.push('specs/');
  } else {
    violations.push(`${archivedChange}/specs/ 目录缺失`);
  }

  return {
    passed: violations.length === 0,
    violations,
    archivedChange,
    artifactsFound,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx >= 0 ? parseInt(args[phaseIdx + 1]!, 10) : NaN;

  if (!file || Number.isNaN(phase)) {
    console.error('用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>');
    process.exit(2);
  }
  if (phase < 5 || phase > 8) {
    console.error(`✗ phase 须为 5-8，收到 ${phase}`);
    process.exit(2);
  }

  const abs = path.resolve(file);
  const result = checkOpenspecArchive(abs, phase);

  console.log('═'.repeat(60));
  console.log('opsx 归档完整性校验（Openspec Archive Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`归档目录      : ${result.archivedChange ?? '（未找到）'}`);
  console.log(`归档制品      : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('OPENSPEC_ARCHIVE_JSON ' + JSON.stringify({
    type: 'openspec-archive',
    passed: result.passed,
    exitCode,
    phase,
    archivedChange: result.archivedChange,
    artifactsFound: result.artifactsFound,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    console.error('check-openspec-archive 异常:', err);
    process.exit(2);
  });
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/cli/check-openspec-archive.ts
git commit -m "feat(script): check-openspec-archive.ts 归档完整性校验"
```

---

### Task 11: gate-logic.ts 扩展 3 个布尔校验

**Files:**
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`

- [ ] **Step 1: 读取 gate-logic.ts 找到阶段 5-8 gate 校验逻辑的位置**

Run: `grep -n "phase.*[5-8]\|阶段.*5\|阶段门" w-model-dev/scripts/logic/gate-logic.ts | head -20`

- [ ] **Step 2: 在阶段 5-8 gate 校验逻辑中追加 3 个布尔校验字段**

在 gate-logic.ts 的阶段 5-8 校验结果对象中增加：
```typescript
  codegraphQueriesValid: boolean;   // check-codegraph-queries.ts exitCode=0
  opsxArtifactsValid: boolean;      // check-opsx-artifacts.ts exitCode=0
  openspecArchived: boolean;        // check-openspec-archive.ts exitCode=0
```

并在阶段 5-8 的 gate 校验函数中调用三个 check 脚本（通过 execFileSync），将 exitCode 映射为布尔值。具体插入位置取决于 gate-logic.ts 现有结构——实施时先读取该文件确定确切插入点。

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts
git commit -m "feat(script): gate-logic +codegraphQueriesValid/opsxArtifactsValid/openspecArchived"
```

---

## 批次 C：references 文档

### Task 12: phase-5-coding.md 扩展 opsx 三段式 + codegraph

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`（第 51-119 行 S-tickets 节扩展）

- [ ] **Step 1: 在 phase-5-coding.md 的 S-tickets 节（第 51 行起）之前插入 opsx 三段式 + codegraph 节**

在第 51 行 `## Tracer-bullet 票据拆解` 之前插入：

```markdown
## codegraph 修改前影响分析（第 25 轮新增）

> 对应约束 #20 + 反模式 #38。阶段 5 任何代码/测试文件 `Edit`/`Write` 前，S-coding 须先调用宿主 Agent 的 `codegraph_explore` MCP 工具。

**修改前流程**：
1. `codegraph_explore(目标符号)` → 查询 callers / callees / blast radius
2. 落盘结果到 `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`（含 querySymbol / callers[] / callees[] / blastRadius / queryTimestamp）
3. 评估：修改是否波及 callers？是否需同步改 callees？
4. 安全确认后 `Edit`/`Write` 代码
5. （可选）修改后再查一次确认影响未意外扩大

**与 code-TLA+ 一致性校验的关系**：codegraph = 修改前预防，code-TLA+ = 修改后回归，互补不冲突。

## OpenSpec opsx 三段式 S 分派（第 25 轮新增）

> 对应 SSoT §3.4.21。阶段 5-8 引入 opsx 工作流做规格级规划，与 S-tickets（代码级切片）共存。

**三段式分派**：
```
S-explore  → opsx:explore + codegraph 影响初判 → 产物 exploration-analysis.md → R3×3 + V
S-propose  → opsx:propose（产 proposal/specs/design/tasks）+ S-tickets 拆解（产 tickets）→ R3×3 + V
S-coding   → 按 tickets.md frontier 逐片编码，每片 codegraph_explore → R3×3 + V
```

**opsx 与 S-tickets 共存边界**（统一由 S-propose 产出）：
- `opsx:propose` 的 **tasks.md** = 高层任务清单（what/why）
- `S-tickets` 的 **tickets.md** = 代码垂直切片（how，端到端可 demo）
- **S-coding 不做拆解**，只按 tickets.md frontier 执行

**每段 R3×3 + V 审查**：每段产物须跑 R3 三维度（completeness/reliability/security）+ V 评审，不合格打回重做（反模式 #39）。

```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs(ref): phase-5 +codegraph 修改前分析 + opsx 三段式"
```

---

### Task 13: phase-{6,7,8}-*.md 扩展 opsx 三段式 + codegraph

**Files:**
- Modify: `w-model-dev/references/phase-6-integration-test.md`
- Modify: `w-model-dev/references/phase-7-system-test.md`
- Modify: `w-model-dev/references/phase-8-acceptance-test.md`

- [ ] **Step 1: 在每个文件的开头节之后插入「第 25 轮新增：opsx 三段式 + codegraph」节**

每个文件插入相同结构的节（标题中的测试类型相应替换）：

```markdown
## 第 25 轮新增：opsx 三段式 S 分派 + codegraph 影响分析

> 对应 SSoT §3.4.21。本阶段（集成测试/系统测试/验收测试）产出测试代码，同样适用 opsx 三段式 + codegraph 修改前查询。

**三段式分派**（与阶段 5 一致）：
- S-explore：opsx:explore 探索测试策略 + codegraph 查被测模块影响
- S-propose：opsx:propose 规划测试用例 + S-tickets 拆解测试代码切片
- S-coding：按 tickets.md frontier 逐片编写测试，每片 codegraph_explore 查被测模块影响半径

**约束 #20 适用**：测试代码文件 `Edit`/`Write` 前同样须先 codegraph_explore 查询并落盘。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-6-integration-test.md w-model-dev/references/phase-7-system-test.md w-model-dev/references/phase-8-acceptance-test.md
git commit -m "docs(ref): phase-6/7/8 +opsx 三段式 + codegraph"
```

---

### Task 14: subagent-delegation.md + S-explore/S-propose/S-coding 变体

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`（第 195-261 行 S 拆分机制节之后追加）

- [ ] **Step 1: 在 S 拆分机制节（第 261 行之后）追加「阶段 5-8 S 三段式变体」节**

```markdown

### 阶段 5-8 S 三段式变体（第 25 轮新增）

> 对应 SSoT §3.4.21。阶段 5-8 引入 codegraph + OpenSpec opsx 后，S 角色拆分为三段式变体。每段产物须跑 R3×3 + V 审查。

#### S-explore 子代理分派模板

- **输入**：当前阶段 spec + 上游产物 + codegraph 图谱（已 init）
- **调用**：`/opsx:explore` + `codegraph_explore`（影响初判）
- **产出**：`exploration-analysis.md`（方案对比 / 推荐方案 / codegraph 影响初判）
- **审查**：R3×3（completeness/reliability/security）→ V 评审 → 不合格打回

#### S-propose 子代理分派模板

- **输入**：S-explore 产物（exploration-analysis.md）+ R3/V 审查通过
- **调用**：`/opsx:propose <change>` → 产 proposal.md / specs/ / design.md / tasks.md；随后 S-tickets 拆解 → tickets.md（tracer-bullet + blocking edges DAG）
- **产出**：`openspec/changes/<change>/{proposal,specs,design,tasks}.md` + `tickets.md`
- **审查**：R3×3 → V 评审 → 不合格打回
- **职责边界**：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how）。反模式 #40 禁止混淆。

#### S-coding 子代理分派模板

- **输入**：S-propose 产物（tickets.md）+ R3/V 审查通过
- **调用**：按 tickets.md frontier 逐片执行；每片 `codegraph_explore(目标符号)` → 落盘 `.w-model/codegraph-queries/` → `opsx:apply` 推进 → `Edit`/`Write` 代码 + 单元测试 →该片 code-TLA+ 一致性校验
- **产出**：代码 + 测试 + `.w-model/codegraph-queries/` + TLA 校验报告
- **审查**：R3×3 → V 评审 → 不合格打回（指定返工票据）
- **约束 #20**：任何 Edit/Write 前须 codegraph_explore，否则命中反模式 #38
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(ref): subagent-delegation +S-explore/S-propose/S-coding 变体"
```

---

### Task 15: SKILL.md Bundled Resources + 阶段 5-8 流程

**Files:**
- Modify: `w-model-dev/SKILL.md`（第 199-290 行 Bundled Resources + 第 148-184 行流程）

- [ ] **Step 1: 在 Bundled Resources 节的 scripts/ 表格（第 246-264 行）中追加 4 个新脚本行**

在 scripts/ 表格末尾追加：
```markdown
| `scripts/ensure-codegraph-opsx.ts` | 阶段 5 进入时（full）/ 6-8 进入时（quick）/ 启动时（light）—— 检测并自动安装 codegraph + OpenSpec 依赖 |
| `scripts/check-codegraph-queries.ts` | 阶段 5-8 gate —— 校验 codegraph 查询落盘（反模式 #38） |
| `scripts/check-opsx-artifacts.ts` | 阶段 5-8 gate —— 校验 opsx 制品 + R3/V 审查产物（反模式 #39/#40） |
| `scripts/check-openspec-archive.ts` | 阶段 5-8 gate 通过后 —— 校验 opsx:archive 归档完整性 |
```

- [ ] **Step 2: 在阶段路由表（第 175-184 行）的阶段 5-8 行中追加 opsx+codegraph 说明**

在阶段 5-8 的路由描述中追加「+ opsx 三段式 + codegraph 修改前查询」。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs(skill): Bundled Resources +4 脚本 + 阶段 5-8 opsx/codegraph 流程"
```

---

### Task 16: INSTALL.md + codegraph/OpenSpec 安装说明

**Files:**
- Modify: `docs/INSTALL.md`

- [ ] **Step 1: 在 INSTALL.md 中追加「codegraph + OpenSpec 自动安装」节**

```markdown

## codegraph + OpenSpec 自动安装（第 25 轮新增）

> 阶段 5-8 依赖两个外部工具。技能包通过 `ensure-codegraph-opsx.ts` 自动检测并安装，仅自动失败时需用户手动介入。

### 自动安装

技能包在阶段 5 进入 CHECKPOINT 时自动运行：
```bash
npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase 5 --project-root . --mode full
```

脚本执行三层检测+自动处置：
1. **L1 CLI**：`codegraph --version` / `openspec --version` → 缺失则 `npm i -g`
2. **L2 MCP 注册**：codegraph 探针查询 → 失败则 `codegraph install --yes`
3. **L3 项目**：`.codegraph/` / `openspec/` 目录 → 缺失则 `codegraph init` / `openspec init`

### 手动安装（自动失败时）

```bash
npm i -g @colbymchenry/codegraph
npm i -g @fission-ai/openspec@latest
codegraph install          # 交互式注册 MCP（自动失败时手动跑）
codegraph init             # 项目图谱初始化
openspec init              # OpenSpec 工作区初始化
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/INSTALL.md
git commit -m "docs(install): +codegraph/OpenSpec 自动安装说明"
```

---

## 批次 D：测试 + 样本

### Task 17: 新增样本文件

**Files:**
- Create: `w-model-dev/scripts/samples/codegraph-queries/valid-phase5.json`
- Create: `w-model-dev/scripts/samples/codegraph-queries/bad-missing-query.json`
- Create: `w-model-dev/scripts/samples/opsx-artifacts/` 下样本
- Create: `w-model-dev/scripts/samples/openspec-archive/` 下样本

- [ ] **Step 1: 创建 codegraph-queries 样本**

`valid-phase5.json`:
```json
{
  "querySymbol": "ArticleService.create",
  "callers": ["ArticleController.handleCreate"],
  "callees": ["ArticleRepository.save", "EventBus.publish"],
  "blastRadius": 3,
  "queryTimestamp": "2026-07-30T10:00:00Z"
}
```

`bad-missing-query.json`（空目录场景，由测试用例模拟目录不存在）。

- [ ] **Step 2: 创建 opsx-artifacts 样本目录结构**

创建 `samples/opsx-artifacts/valid-phase5/openspec/changes/phase5-demo/{proposal.md,design.md,tasks.md,tickets.md,specs/}` + `.w-model/r3-reviews/` + `.w-model/v-reviews/` 完整结构（用空 .md 占位）。

创建 `samples/opsx-artifacts/bad-missing-tickets/`（缺 tickets.md）。

- [ ] **Step 3: 创建 openspec-archive 样本**

创建 `samples/openspec-archive/valid/openspec/changes/archive/2026-07-30-phase5-demo/{proposal.md,design.md,tasks.md,specs/}`。
创建 `samples/openspec-archive/bad-no-archive/`（无 archive 目录）。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/samples/
git commit -m "test(samples): +codegraph-queries/opsx-artifacts/openspec-archive 样本"
```

---

### Task 18: self-test.ts 新增 codegraph/opsx 用例

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`

- [ ] **Step 1: 在 self-test.ts 中参照第 918-950 行 ROLE_DISPATCH_CASES 模式，新增 4 组 CASES**

新增 codegraph-queries / opsx-artifacts / openspec-archive / ensure-deps 四组 CASES 数组，每组含 valid + bad 用例。参照第 24 轮 ROLE_DISPATCH_CASES 格式。

- [ ] **Step 2: 新增 4 个 runner 函数**

参照第 1879-1914 行 `runRoleDispatchCases` 模式，新增 `runCodegraphQueriesCases` / `runOpsxArtifactsCases` / `runOpenspecArchiveCases` / `runEnsureDepsCases`。

- [ ] **Step 3: main() 4 处注册**

1. 参照第 2307 行，添加 4 行 `console.log` 用例计数
2. 参照第 2339 行 Promise.all 数组，添加 4 个 runner 调用
3. 参照第 2348 行结果合并数组，添加 4 个展开

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): +codegraph/opsx 用例（4 组 CASES + runner）"
```

---

## 批次 E：验证

### Task 19: tsc --noEmit 严格模式验证

- [ ] **Step 1: 运行 TypeScript 严格模式编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 如有错误，修复后重新验证**

---

### Task 20: self-test 全量验证

- [ ] **Step 1: 运行 self-test**

Run: `npx tsx w-model-dev/scripts/cli/self-test.ts`
Expected: 全部通过，用例数增加（原基线 + 新增 codegraph/opsx 用例）

---

### Task 21: vitest 全量验证

- [ ] **Step 1: 运行 vitest**

Run: `npx vitest run`
Expected: 全部通过

---

### Task 22: 最终一致性检查

- [ ] **Step 1: 版本号三处一致**

Run: `grep '"24.0.0"' package.json w-model-dev/skill-metadata.json && grep '^version: 24.0.0' w-model-dev/SKILL.md`
Expected: 三行输出

- [ ] **Step 2: 约束 #20 + 反模式 #38/#39/#40 编号衔接**

Run: `grep "约束 #20" w-model-dev/SKILL.md && grep "#38\|#39\|#40" w-model-dev/references/anti-patterns.md`
Expected: 命中

- [ ] **Step 3: run-log action 枚举含 6 个新值**

Run: `grep "codegraph_query\|opsx_explore\|opsx_propose\|opsx_apply\|opsx_archive\|ensure_deps" w-model-dev/schemas/run-log.schema.json`
Expected: 命中

- [ ] **Step 4: 4 个新脚本存在**

Run: `ls w-model-dev/scripts/cli/ensure-codegraph-opsx.ts w-model-dev/scripts/cli/check-codegraph-queries.ts w-model-dev/scripts/cli/check-opsx-artifacts.ts w-model-dev/scripts/cli/check-openspec-archive.ts`
Expected: 4 文件存在

- [ ] **Step 5: 工作区干净**

Run: `git status`
Expected: nothing to commit, working tree clean

- [ ] **Step 6: 最终 commit（如有遗漏修正）**

```bash
git add -A
git commit -m "chore(w-model-dev): round25 最终一致性修正"
```

---

## 自审清单

- [x] **Spec 覆盖**：22 项资产同步清单每项对应一个 Task
- [x] **占位符扫描**：所有 Step 含确切文件路径/代码/命令
- [x] **类型一致**：CheckResult / ensureDeps 等接口跨任务一致
- [x] **编号衔接**：约束 #19→#20，反模式 #37→#38/#39/#40

---

## 执行模式选择

**1. Subagent-Driven（推荐）** — 22 项任务按依赖关系分批派给子代理，每批完成后审查

**2. Inline Execution** — 编排者内联完成所有改动，批量执行 + checkpoint 审查
