# 批次 3 实施计划：脚本瘦身（12 项行为等价重构）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 12 项脚本瘦身——① 统一 23 个 check-*.ts 收尾模板（lib/gate-report.ts）；② 统一 --phase 校验（lib/parse-phase.ts）；③ graph-logic 索引化 O(n²)→O(n)；④ getLine 改 ts API；⑤ state-machine 纯逻辑下沉 state-machine-logic.ts；⑥ 收敛 BDD/TLA+ 快照解析至 bdd-logic；⑦ 收敛 UAT 表格解析至 design-contract-logic；⑧ JSONL 扫描样板复用 readJsonlOrExit；⑨ 移除 @cucumber devDeps + SCRIPT_JSON 死模式 + 孤儿样本；⑩ 删 diag-fix.ts + gate-logs 产物；⑪ signature-chain 副本排序；⑫ 抽 readJsonOptional。**全部行为等价**，版本号不升（批次 5 统一 33.0.0）。

**Architecture:** 12 项独立重构，互不依赖（3.5 与批次 1 同文件的 isMain 守卫已完成，本批只下沉逻辑）。核心新增 4 个纯工具模块（gate-report / parse-phase / state-machine-logic / readJsonOptional 扩展），其余为机械收敛。设计 spec：[`docs/superpowers/specs/2026-08-05-opt-batch-3-script-slimming-design.md`](../../docs/superpowers/specs/2026-08-05-opt-batch-3-script-slimming-design.md)。

**Tech Stack:** TypeScript strict + tsx + vitest；typescript 已是 devDep（code-tla 已 import）；无新运行时依赖。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 跑 vitest 单文件：`npx vitest run w-model-dev/scripts/__tests__/<file>.test.ts`。
- vitest 当前基线 378 / 30 files、self-test 213 条：本批预期新增 state-machine-logic + parse-phase + readJsonOptional 单测（+N，按实测更新）。
- `*-logic.ts` 纯逻辑层不得 import node:fs / node:child_process（pure 边界）。
- **行为等价抽查**：对每个重构脚本用 `git stash` 前留旧版副本，跑 samples 对比 stdout/stderr/exit code（spec §5.3 方法）。

## 任务总览（12 任务）

| 任务 | 内容 | 产物 | commit |
|---|---|---|---|
| 1 | 抽 gate-report.ts 统一收尾（22 处收敛 + design-contract 冒号归一） | lib/gate-report.ts + 23 个 check-*.ts | `refactor(scripts): 统一门禁收尾模板 printGateReport` |
| 2 | 抽 parse-phase.ts 统一 --phase（13 文件收敛 + signature-chain 补校验） | lib/parse-phase.ts + 13 文件 + 单测 | `refactor(scripts): 统一 --phase 校验 parsePhaseArg` |
| 3 | graph-logic 索引化（4 处 O(n²)→O(n)） | graph-logic.ts | `perf(graph): outEdges/inEdges 索引替换线性扫描` |
| 4 | getLine 改 ts.getLineAndCharacterOfPosition | code-tla-logic.ts | `perf(code-tla): getLine 改用 ts API O(1)` |
| 5 | state-machine 逻辑下沉（新建 logic + 单测） | state-machine-logic.ts + check-state-machine-consistency.ts 瘦身 + 单测 | `refactor(state-machine): 纯逻辑下沉 state-machine-logic.ts` |
| 6 | 收敛 BDD/TLA+ 快照解析至 bdd-logic（含 self-test） | bdd-logic.ts + check-bdd-model.ts + self-test.ts | `refactor(bdd): 解析收敛 parseFeatureFile/parseTlaSpecSnapshot` |
| 7 | 收敛 UAT 表格解析至 design-contract-logic | design-contract-logic.ts + check-design-contract-consistency.ts + check-artifact-gate.ts | `refactor(contract): UAT 表格解析合一` |
| 8 | JSONL 扫描复用 readJsonlOrExit（3 处 + role-dispatch 注释） | check-budget.ts + check-maturity.ts + check-preventive-review.ts + check-role-dispatch.ts | `refactor(scripts): JSONL 扫描复用 readJsonlOrExit` |
| 9 | 移除 @cucumber devDeps + SCRIPT_JSON 死模式 + 孤儿样本 | package.json + INSTALL.md + bdd-guide.md + run-log-logic.ts + 删除 samples 3 组 | `chore(deps): 移除 @cucumber + SCRIPT_JSON 死模式 + 孤儿样本` |
| 10 | 删 diag-fix.ts + gate-logs + .gitignore 补规则 | 删除 2 处 + .gitignore | `chore(cleanup): 删 diag-fix.ts 与 gate-logs 运行时产物` |
| 11 | signature-chain 副本排序（3 处） | signature-chain-logic.ts | `fix(signature-chain): 原地 sort 改副本排序` |
| 12 | 抽 readJsonOptional + readJsonlOptional（12 文件收敛） | read-json-or-exit.ts + 12 文件 + 单测 | `refactor(lib): readJsonOptional 收敛可选 JSON 样板` |

---

## Task 1: 统一门禁收尾模板（lib/gate-report.ts）

**Files:**
- Create: `w-model-dev/scripts/lib/gate-report.ts`
- Modify: 23 个 `check-*.ts` 的 main() 收尾三行

- [ ] **Step 1: 写失败测试（TDD）**

创建 `w-model-dev/scripts/__tests__/gate-report.test.ts`：捕获 stdout 验证格式（`─'.repeat(60)` 分隔线 + `${label}_JSON ` 前缀 + exitCode 键 + process.exit 码）。process.exit 用 mock 拦截。

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/gate-report.test.ts`
Expected: FAIL——模块不存在。

- [ ] **Step 3: 实现 lib/gate-report.ts**

按 spec §3.1 实现 `printGateReport(label, summary, exitCode): never`。注意 summary 展开顺序：`JSON.stringify({ ...summary, exitCode })`（exitCode 置末）。

- [ ] **Step 4: 逐脚本替换收尾三行**

对 22 处模板（23 个脚本除 check-design-contract-consistency.ts）：
```ts
// 原样（以 check-maturity.ts 为例）：
const exitCode = result.passed ? 0 : 1;
console.log('─'.repeat(60));
console.log('MATURITY_JSON ' + JSON.stringify({ type: 'maturity', passed: result.passed, exitCode, violations: result.violations }));
process.exit(exitCode);
// 替换为：
printGateReport('MATURITY', { type: 'maturity', passed: result.passed, violations: result.violations }, result.passed ? 0 : 1);
```
- 每文件顶部加 `import { printGateReport } from './lib/gate-report.js';`。
- **保留**每个脚本 summary 里除 passed/violations 外的额外字段（如 check-run-log 的 stage 统计、check-bdd-model 的 totals）。
- **check-design-contract-consistency.ts:278**：`CONTRACT_JSON:` 冒号归一为空格，删除局部 `exitCode` 变量（若有），同样改调 printGateReport。
- **注意**：删除原 `const exitCode = ...` 行（printGateReport 内部计算），勿遗留未用变量（tsc strict 会报）。

- [ ] **Step 5: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。

抽查（spec §4.2）：对 4 个代表脚本（verifier-output / artifact-gate / run-log / design-contract）各跑 1 个 valid + 1 个 bad 样本，对比 `git show HEAD:<file>` 旧版输出——stdout 逐字节一致（除 stderr 无输出、exit code 一致）。

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run`（全量）、`npm run self-test`（213 条）
```bash
git add w-model-dev/scripts/lib/gate-report.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/cli/check-*.ts
git commit --no-gpg-sign -m "refactor(scripts): 统一门禁收尾模板 printGateReport（22 处收敛）"
```

---

## Task 2: 统一 --phase 校验（lib/parse-phase.ts）

**Files:**
- Create: `w-model-dev/scripts/lib/parse-phase.ts`
- Create: `w-model-dev/scripts/__tests__/parse-phase.test.ts`
- Modify: 13 个文件（check-artifact-gate / check-requirement-graph / check-tla-model / check-signature-chain / check-budget / check-bdd-model / check-codegraph-queries / check-opsx-artifacts / check-openspec-archive / check-preventive-review / metrics-report / plan-chunks / ensure-codegraph-opsx）

- [ ] **Step 1: 写失败测试**

`parse-phase.test.ts`：`--phase=5`、`--phase 5`、位置参数（positional:0）、非法（abc/0/9/-1/空）、min/max 自定义（5-8）、无 --phase 返回 undefined。

- [ ] **Step 2: 跑测试验证失败**

Expected: FAIL——模块不存在。

- [ ] **Step 3: 实现 lib/parse-phase.ts**

按 spec §3.2。注意兼容两形态：`--phase=N` 与 `--phase N`；`positional` 可选。

- [ ] **Step 4: 逐文件收敛（保留各自 min/max 语义）**

| 文件 | 现范围 | 调用 |
|---|---|---|
| check-artifact-gate | 1-8 | `parsePhaseArg(argv, { min: 1, max: 8 })`（std 形态，行为不变） |
| check-requirement-graph | 1-4 | `{ min: 1, max: 4 }` |
| check-tla-model | 1-8 | `{ min: 1, max: 8 }` |
| check-signature-chain | **无范围校验** | `{ min: 1, max: 8 }`（行为收紧：非法 phase 拒绝，与 gate 一致） |
| check-budget | 1-8 | `{ min: 1, max: 8 }` |
| check-bdd-model | 1-8 | `{ min: 1, max: 8 }` |
| check-codegraph-queries | 5-8 | `{ min: 5, max: 8 }` |
| check-opsx-artifacts | 5-8 | `{ min: 5, max: 8 }` |
| check-openspec-archive | 5-8 | `{ min: 5, max: 8 }` |
| check-preventive-review | 1-8 | `{ min: 1, max: 8 }` |
| metrics-report | 1-8 | `{ min: 1, max: 8 }`（其 `split('=')[1]` 形态被 parsePhaseArg 覆盖） |
| plan-chunks | 1-4 | `{ min: 1, max: 4, positional: <下标> }`（确认其参数形态） |
| ensure-codegraph-opsx | 5-8 | `{ min: 5, max: 8 }` |

- 各文件保留解析结果的使用方式（如 `phase` 变量赋值、错误消息文案——文案不变，仅校验逻辑收敛）。
- **注意**：部分文件将 `phase` 用于逻辑层参数，收敛时保持类型（number | undefined）。

- [ ] **Step 5: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：artifact-gate / tla-model / signature-chain 三文件，合法 phase（1/4/8）+ 非法（abc/0/9/缺省）对比旧版输出；signature-chain 非法 phase 行为收紧记录到提交说明。

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run`、`npm run self-test`
```bash
git add w-model-dev/scripts/lib/parse-phase.ts w-model-dev/scripts/__tests__/parse-phase.test.ts <13 文件>
git commit --no-gpg-sign -m "refactor(scripts): 统一 --phase 校验 parsePhaseArg（13 文件收敛，signature-chain 补范围校验）"
```

---

## Task 3: graph-logic 索引化

**Files:**
- Modify: `w-model-dev/scripts/logic/graph-logic.ts`

- [ ] **Step 1: 构建索引上移**

将 449-458 的 outEdges/inEdges 构建移到 nodeMap 构建之后（约 322 附近），使 4 处线性扫描可用；新增 `conflictsAdj` Set（`${from}->${to}`）。

- [ ] **Step 2: 替换 4 处扫描**

1. rootCandidates（333-338）：`inEdges.get(n.id)?.some(e => e.type === 'parent')`；
2. orphan BFS（387-398）：`for (const e of outEdges.get(cur) ?? [])` 过滤 `e.type === 'parent'`；
3. conflicts-with 对称（685-689）：`conflictsAdj.has(`${e.to}->${e.from}`)`；
4. cross-cuts 节点查找（691-705）：`nodeMap.get(e.to)`（确认 nodeMap 已含全部节点）。

- [ ] **Step 3: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：graph samples 全量（self-test GRAPH_CASES 覆盖 valid+bad），对比重构前后 self-test 输出（self-test 输出含 per-case 判定行，213 条断言即等价证明）。

- [ ] **Step 4: 全量回归 + 提交**

Run: `npx vitest run`、`npm run self-test`（重点 graph 组）
```bash
git add w-model-dev/scripts/logic/graph-logic.ts
git commit --no-gpg-sign -m "perf(graph): outEdges/inEdges/conflictsAdj 索引替换 4 处线性扫描（O(n²)→O(n)）"
```

---

## Task 4: getLine 改 ts API

**Files:**
- Modify: `w-model-dev/scripts/logic/code-tla-logic.ts`（218-227）

- [ ] **Step 1: 替换 getLine**

```ts
function getLine(node: TsType.Node): number {
  return ts.getLineAndCharacterOfPosition(ast, node.getStart(ast, false)).line + 1;
}
```
（ast 已是模块级变量，getLine 闭包引用即可）

- [ ] **Step 2: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：code-tla samples（valid.json + bad-*.json 各 1），self-test CODE_TLA 组断言通过。

- [ ] **Step 3: 提交**

Run: `npx vitest run`、`npm run self-test`
```bash
git add w-model-dev/scripts/logic/code-tla-logic.ts
git commit --no-gpg-sign -m "perf(code-tla): getLine 改用 ts.getLineAndCharacterOfPosition（O(n²)→O(1)）"
```

---

## Task 5: state-machine 纯逻辑下沉（TDD）

**Files:**
- Create: `w-model-dev/scripts/logic/state-machine-logic.ts`
- Create: `w-model-dev/scripts/__tests__/state-machine-logic.test.ts`
- Modify: `w-model-dev/scripts/cli/check-state-machine-consistency.ts`（瘦身）

- [ ] **Step 1: 写失败测试**

`state-machine-logic.test.ts`：复用 samples/state-machine/（valid-consistent / bad-missing-transition / bad-extra-transition）断言 checkStateMachineConsistency 的 passed/reasons。

- [ ] **Step 2: 跑测试验证失败**

Expected: FAIL——`state-machine-logic.js` 不存在。

- [ ] **Step 3: 新建 state-machine-logic.ts**

从 check-state-machine-consistency.ts 原样迁移：类型 `Transition`/`StateMachineConsistencyInput`/`StateMachineConsistencyResult`（27-51）、`transitionKey`（53-55）、`checkStateMachineConsistency`（57-104）。纯函数，无 node:fs import。

- [ ] **Step 4: CLI 文件瘦身**

check-state-machine-consistency.ts 改为 import `{ checkStateMachineConsistency, type ... } from './state-machine-logic.js'`；删除迁移的 78 行；保留参数解析 + readJsonOrExit + 人类报告 + STATE_MACHINE_JSON 收尾（Task 1 已统一为 printGateReport）+ isMain 守卫。

- [ ] **Step 5: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：`npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts w-model-dev/scripts/samples/state-machine/valid-consistent.json` → STATE_MACHINE_JSON passed:true exit 0；bad 样本 exit 1。

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run`、`npm run self-test`
```bash
git add w-model-dev/scripts/logic/state-machine-logic.ts w-model-dev/scripts/__tests__/state-machine-logic.test.ts w-model-dev/scripts/cli/check-state-machine-consistency.ts
git commit --no-gpg-sign -m "refactor(state-machine): 纯逻辑下沉 state-machine-logic.ts（消除逻辑与 CLI 同文件反例）"
```

---

## Task 6: 收敛 BDD/TLA+ 快照解析（含 self-test）

**Files:**
- Modify: `w-model-dev/scripts/logic/bdd-logic.ts`（新增导出）
- Modify: `w-model-dev/scripts/cli/check-bdd-model.ts`（改 import）
- Modify: `w-model-dev/scripts/cli/self-test.ts`（改 import）
- 参考（不改）：`w-model-dev/scripts/logic/tla-logic.ts`（复用 parseTlaHeader）

- [ ] **Step 1: 行为对比表（先记录，后收敛）**

读取 check-bdd-model.ts:106-169（parseFeatureFile + extractStateFromStep + extractEventsFromWhen + extractInvariantsFromThen）与 self-test.ts:2300-2389（extractBddStateFromStep + extractBddEventsFromWhen + extractBddInvariantsFromThen + scenario 提取），列出每处正则与取值差异：
- state：两处正则是否一致
- events：check-bdd-model 仅 `When`，self-test 用 `(?:When|And)`
- invariants：check-bdd-model 取最后一个 Then，self-test 取第一个 Then

- [ ] **Step 2: bdd-logic.ts 新增导出**

`parseFeatureFile(content): ParsedFeature`——语义以 self-test 基线为准（`(?:When|And)` 双取 + 首个 Then），并核对 check-bdd-model 的 samples 断言不回归（若 check-bdd-model 依赖末 Then，需在调用侧取末元素或统一断言——**以 self-test 213 条通过为硬约束**，冲突时回到 Step 1 对比表逐条定方向）。

- [ ] **Step 3: TLA+ 快照解析下沉**

`parseTlaSpecSnapshot(tlaContent, specId): TlaSpecSnapshot`——复用 tla-logic 的 parseTlaHeader（若已导出）+ 提取 States/Init/Next/Invariants（迁移 check-bdd-model.ts:423-529 的 extractTla* 实现）；bdd-logic.ts 已有 `TlaSpecSnapshot` 接口（381-440），若字段不匹配按 bdd-logic 接口对齐。

- [ ] **Step 4: 两调用方改 import**

check-bdd-model.ts 删内联 parseFeatureFile/extractTla*，改 import；self-test.ts 删 extractBdd*，改 import。**注意 self-test 输出断言依赖解析结果**——收敛后逐条断言应与收敛前一致（213 条回归）。

- [ ] **Step 5: tsc + 全量回归**

Run: `npx tsc --noEmit` → 0 错误。
Run: `npm run self-test` → 213 条全通过（BDD 组 + TLA 组重点）。
Run: `npx vitest run` → bdd-logic.test.ts / tla-logic.test.ts 通过。

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/logic/bdd-logic.ts w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/cli/self-test.ts
git commit --no-gpg-sign -m "refactor(bdd): scenario/TLA+ 快照解析收敛至 bdd-logic（消除 check-bdd-model 与 self-test 复制漂移）"
```

---

## Task 7: 收敛 UAT 表格解析

**Files:**
- Modify: `w-model-dev/scripts/logic/design-contract-logic.ts`（新增导出）
- Modify: `w-model-dev/scripts/cli/check-design-contract-consistency.ts`（改调用）
- Modify: `w-model-dev/scripts/cli/check-artifact-gate.ts`（复用 strict 版）

- [ ] **Step 1: 对比两套解析字段与语义**

读取 check-artifact-gate.ts:59-93（严格版：首列 `UAT-\d+` 正则 + cells ≥4 + 畸形 violation + 返回 rows）与 check-design-contract-consistency.ts:43-61（宽松版：单行整正则 + 静默跳过 + 返回 mappings），确认字段名差异（uatId/actualPath/mappingType vs uatId/designPath/actualPath/mappingType）。

- [ ] **Step 2: design-contract-logic.ts 新增导出**

`parseUatPathMappingContent(content, opts?: { strict?: boolean })`：
- 返回统一结构 `{ rows: Array<{ uatId, cells: string[] }>, violations: string[] }`（保留原始 cells 供调用方各自映射字段）；
- strict=true 时畸形行 push violation（对齐 artifact-gate）；默认 false 静默跳过（对齐 design-contract 现状）。

- [ ] **Step 3: 两调用方收敛**

- check-design-contract-consistency.ts:43-61 改调用（默认非 strict），字段映射到 designPath/actualPath/mappingType；
- check-artifact-gate.ts:59-93 改调用（strict=true），字段映射到 actualPath/mappingType，保留其 violation 文案与行号格式（**逐字节一致**）。

- [ ] **Step 4: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：design-contract samples（valid-consistent / bad-path-mismatch / bad-param-mismatch / bad-status-mismatch / bad-route-not-found）与 artifact-gate UAT_PATH_MAPPING samples（valid-phase5 / bad-empty-table / bad-malformed-row / bad-empty-cell / bad-unbackfilled）——self-test 两组断言全过即等价。

- [ ] **Step 5: 全量回归 + 提交**

Run: `npm run self-test`、`npx vitest run`
```bash
git add w-model-dev/scripts/logic/design-contract-logic.ts w-model-dev/scripts/cli/check-design-contract-consistency.ts w-model-dev/scripts/cli/check-artifact-gate.ts
git commit --no-gpg-sign -m "refactor(contract): UAT 表格解析合一（strict 开关兼容两语义）"
```

---

## Task 8: JSONL 扫描复用 readJsonlOrExit

**Files:**
- Modify: `w-model-dev/scripts/cli/check-budget.ts`（76-106）
- Modify: `w-model-dev/scripts/cli/check-maturity.ts`（78-100）
- Modify: `w-model-dev/scripts/cli/check-preventive-review.ts`（66-141）
- Modify: `w-model-dev/scripts/cli/check-role-dispatch.ts`（46-81，仅补注释）

- [ ] **Step 1: 核对语义等价**

读取三处手写样板与 readJsonlOrExit（lib/read-json-or-exit.ts:58-86）语义：warn+skip 坏行、ENOENT→exit 2、空行跳过。确认等价后收敛。

- [ ] **Step 2: 三处改调 readJsonlOrExit**

- check-budget.ts:76-106：`const entries = await readJsonlOrExit(runLogAbs, 'run-log');`（原坏行 warn 消息由 readJsonlOrExit 的 label 参数生成，文案对齐——确认原消息格式含「run-log 第 N 行」后可直接用 label）。
- check-maturity.ts:78-100：同上（label='run-log'）。
- check-preventive-review.ts:66-141：auto-trigger 扫描改调（label='run-log'）。

- [ ] **Step 3: role-dispatch 补注释**

check-role-dispatch.ts:72 附近补充：`// 第 29 轮决策：坏行 exit 2（不复用 readJsonlOrExit 的 warn+skip，行为不等价）`。

- [ ] **Step 4: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：budget / maturity / preventive-review 三脚本 samples（valid + bad 各 1）+ 无 run-log 参数场景（ENOENT→exit 2）对比旧版。

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx vitest run`、`npm run self-test`
```bash
git add w-model-dev/scripts/cli/check-budget.ts w-model-dev/scripts/cli/check-maturity.ts w-model-dev/scripts/cli/check-preventive-review.ts w-model-dev/scripts/cli/check-role-dispatch.ts
git commit --no-gpg-sign -m "refactor(scripts): JSONL 扫描复用 readJsonlOrExit（role-dispatch 保留第 29 轮 exit 2 语义）"
```

---

## Task 9: 移除 @cucumber devDeps + SCRIPT_JSON 死模式 + 孤儿样本

**Files:**
- Modify: `package.json`（删 2 个 devDep）
- Modify: `docs/INSTALL.md`（:33 附近文字）
- Modify: `w-model-dev/references/bdd-guide.md`（:37-38 附近文字）
- Modify: `w-model-dev/scripts/logic/run-log-logic.ts`（删 SCRIPT_JSON 正则）
- Delete: `w-model-dev/scripts/samples/event-ingress/`、`w-model-dev/scripts/samples/hill-climbing/`、`w-model-dev/scripts/samples/bdd/valid-manifest-root.json`

- [ ] **Step 1: 复核无引用**

grep `@cucumber` 全仓（确认仅文档文字提及，无 import）；grep `SCRIPT_JSON`（确认仅 run-log-logic.ts:433 一处正则，无输出方）；grep event-ingress / hill-climbing / valid-manifest-root（确认 self-test/vitest 无引用）。

- [ ] **Step 2: package.json 删 devDep**

删 `@cucumber/cucumber`、`@cucumber/messages`。Run: `npm install` → 干净无告警。

- [ ] **Step 3: 文档文字同步**

- INSTALL.md:33：「生产环境用 @cucumber/messages Gherkin 解析器」改为「场景解析为手写正则（check-bdd-model.ts 的 parseFeatureFile）」；
- bdd-guide.md:37-38：同步说明。

- [ ] **Step 4: 删 SCRIPT_JSON 正则**

run-log-logic.ts:432-444 数组删 `/SCRIPT_JSON\s+(\{.*\})/,`。

- [ ] **Step 5: 删孤儿样本**

删 samples/event-ingress/（4 文件）、samples/hill-climbing/（5 文件）、samples/bdd/valid-manifest-root.json。删除前确认 samples/schema/ 下与 schema 用例相关文件（如 bad-event-ingress-missing-required.json）保留（它们在 self-test SCHEMA_CASES 引用）。

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx tsc --noEmit`、`npm run self-test`（213 条不变）、`npx vitest run`
```bash
git add package.json package-lock.json docs/INSTALL.md w-model-dev/references/bdd-guide.md w-model-dev/scripts/logic/run-log-logic.ts
git rm -r w-model-dev/scripts/samples/event-ingress w-model-dev/scripts/samples/hill-climbing w-model-dev/scripts/samples/bdd/valid-manifest-root.json
git commit --no-gpg-sign -m "chore(deps): 移除 @cucumber devDeps + SCRIPT_JSON 死模式 + 孤儿样本"
```

---

## Task 10: 删 diag-fix.ts + gate-logs + .gitignore

**Files:**
- Delete: `w-model-dev/scripts/diag-fix.ts`
- Delete: `w-model-dev/scripts/samples/.w-model/gate-logs/`（4 文件）
- Modify: 根 `.gitignore`（补 gate-logs 规则）

- [ ] **Step 1: 复核无引用**

grep diag-fix（确认仅 .eslintsecurity-baseline.json 指纹与设计文档提及，无 import）；grep gate-logs（确认无测试引用）。

- [ ] **Step 2: 删除**

`git rm w-model-dev/scripts/diag-fix.ts`；`git rm -r w-model-dev/scripts/samples/.w-model/gate-logs`。

- [ ] **Step 3: .gitignore 补规则**

检查根 .gitignore 是否已有 `.w-model/` 或 `gate-logs` 覆盖；若无，补：
```
# 运行时产物：门禁脚本输出的 gate-logs（check-bdd-model 等写入）
**/samples/.w-model/gate-logs/
```

- [ ] **Step 4: security-scan 基线**

Run: `npm run lint:security` → baseline 比对失败（diag-fix 指纹消失）。Run: `npm run lint:security -- --regenerate`（或等效命令）更新基线。若 3.10 与 3.9 合并执行，基线只 regenerate 一次。

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx tsc --noEmit`、`npm run self-test`、`npx vitest run`
```bash
git add .gitignore .eslintsecurity-baseline.json
git rm w-model-dev/scripts/diag-fix.ts
git rm -r w-model-dev/scripts/samples/.w-model/gate-logs
git commit --no-gpg-sign -m "chore(cleanup): 删 diag-fix.ts 与 gate-logs 运行时产物 + .gitignore 防再提交"
```

---

## Task 11: signature-chain 副本排序

**Files:**
- Modify: `w-model-dev/scripts/logic/signature-chain-logic.ts`（128 / 156 / 190）

- [ ] **Step 1: 三处副本排序**

- 128：`const phaseEntries = [...scopedEntries].sort((a, b) => ...);`
- 156：`const allSorted = [...(entries as SignatureChainEntry[])].sort(...);`
- 190：同 156。

- [ ] **Step 2: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：signature-chain samples（valid-all-roles / valid-continuous-chain / bad-*）self-test SIGNATURE_CHAIN 组断言全过。

- [ ] **Step 3: 提交**

Run: `npx vitest run`（signature-chain-logic.test.ts）、`npm run self-test`
```bash
git add w-model-dev/scripts/logic/signature-chain-logic.ts
git commit --no-gpg-sign -m "fix(signature-chain): 原地 sort 改副本排序（消除调用方数据副作用）"
```

---

## Task 12: 抽 readJsonOptional + readJsonlOptional（TDD）

**Files:**
- Modify: `w-model-dev/scripts/lib/read-json-or-exit.ts`
- Modify: `w-model-dev/scripts/__tests__/read-json-or-exit.test.ts`（扩充）
- Modify: 12 个文件约 24 处（check-artifact-gate / check-budget / check-maturity / check-tla-model / check-requirement-coverage / check-requirement-graph / wm-status / metrics-report / check-preventive-review / check-bdd-model / check-run-log / check-signature-chain）

- [ ] **Step 1: 写失败测试**

扩充 read-json-or-exit.test.ts：`readJsonOptional`（存在→解析 / ENOENT→null / 损坏→exit 2）、`readJsonlOptional`（存在→数组 / ENOENT→[] / 坏行 warn+skip）。

- [ ] **Step 2: 跑测试验证失败**

Expected: FAIL——函数未导出。

- [ ] **Step 3: 实现**

lib/read-json-or-exit.ts 追加：
```ts
export async function readJsonOptional<T = unknown>(file: string): Promise<T | null> {
  const abs = path.resolve(file);
  let raw: string;
  try { raw = await fs.readFile(abs, 'utf-8'); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
  try { return parseJsonSafe<T>(raw); }
  catch { console.error(`✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: ${abs}`); process.exit(2); }
}
export async function readJsonlOptional(file: string, label = '行'): Promise<unknown[]> {
  const abs = path.resolve(file);
  let raw: string;
  try { raw = await fs.readFile(abs, 'utf-8'); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []; throw err; }
  // 与 readJsonlOrExit 相同逐行解析（warn+skip）
}
```

- [ ] **Step 4: 12 文件收敛**

按探索报告行号清单逐处替换三分支样板（保留各调用方既有「ENOENT→跳过/警告」与「损坏→exit 2」语义）：
- check-requirement-coverage.ts（3 处）与 check-requirement-graph.ts（2 处）的三分支错误分类样板收敛为 readJsonOptional；
- 其余文件按行号收敛。
**注意**：check-bdd-model / check-tla-model 等有「解析失败→继续流程（manifestExists=false）」语义的，用 readJsonOptional 后在其调用侧 catch null 分支处理（不得吞掉 exit 2 场景）。**逐文件核对语义后再改**。

- [ ] **Step 5: tsc + 行为等价抽查**

Run: `npx tsc --noEmit` → 0 错误。
抽查：artifact-gate（graph/tla/bdd/uap 四附属输入，缺文件 + 损坏 + 合法三态）、check-requirement-coverage（三附属输入）对比旧版输出。

- [ ] **Step 6: 全量回归 + 提交**

Run: `npx vitest run`、`npm run self-test`
```bash
git add w-model-dev/scripts/lib/read-json-or-exit.ts w-model-dev/scripts/__tests__/read-json-or-exit.test.ts <12 文件>
git commit --no-gpg-sign -m "refactor(lib): readJsonOptional/readJsonlOptional 收敛可选 JSON 三分支样板（12 文件）"
```

---

## 收尾验证（全部任务后）

- [ ] **全局基线**：`npm run self-test` 213 条（按实测同步计数）；`npx vitest run` 全通过（按实测更新基线）；`npx tsc --noEmit` 0 错误；`npm run lint:security` baseline 通过。
- [ ] **净行数**：`git diff --stat <批次3起点>..HEAD` 净减少 ≥ 600 行（3.1 模板 + 3.9/3.10 删除 + 3.12 样板）。
- [ ] **npm install 干净**：无告警（3.9 删依赖后）。
- [ ] **工作区干净**：`git status --short` 空输出。
- [ ] **行为收紧记录**：3.2 signature-chain 非法 phase 拒绝、3.6 BDD 解析语义统一（若有断言差异需在提交说明记录）。

---

## 自审记录（writing-plans self-review）

- **Spec 覆盖**：spec §3.1→Task 1；§3.2→Task 2；§3.3→Task 3；§3.4→Task 4；§3.5→Task 5；§3.6→Task 6；§3.7→Task 7；§3.8→Task 8；§3.9→Task 9；§3.10→Task 10；§3.11→Task 11；§3.12→Task 12；spec §4 验收→收尾验证。无缺口。
- **行为等价约束**：除 3.2（signature-chain 补校验）与 3.6（语义统一）两处明示行为收紧外，其余全部等价；每任务均有「行为等价抽查」步骤，用 samples valid+bad 对比三要素。
- **风险点**：Task 6 的语义统一以 self-test 213 条为硬约束（冲突回退到对比表）；Task 7 的 design-contract 宽松语义保留（strict 开关）；Task 8 的 role-dispatch 不合并（第 29 轮决策）；Task 9/10 删除前均有复核引用步骤。
- **删除授权**：diag-fix.ts / gate-logs / @cucumber / SCRIPT_JSON / 孤儿样本均在总框架 D4 决策范围内。
