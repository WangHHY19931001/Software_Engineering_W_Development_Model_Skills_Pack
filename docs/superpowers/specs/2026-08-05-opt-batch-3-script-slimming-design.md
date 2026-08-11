# 第 33 轮 · 批次 3 设计：脚本瘦身（行为等价重构）

> 触发：全仓库深入分析识别脚本层重复样板与低效实现，共 12 项（7 项 P2 + 5 项 P3）。总框架 spec 见 [2026-08-05-optimization-overview-design.md](./2026-08-05-optimization-overview-design.md) §3.3。
>
> 当前版本：`32.0.0`（版本号在全部批次完成后统一升级 33.0.0，本批不升版本号）。
>
> 依赖：批次 1（3.5 与 check-state-machine-consistency.ts 同文件，批次 1 已先修 isMain 守卫，本批再下沉逻辑）。
>
> 工作流：总框架头脑风暴 → 本批次 spec → 本批次 plan → 实施 → 回归 → 提交。

## 1. 背景与缺口（探索实测，2026-08-05）

| # | 级别 | 现状（只读探索证据） | 代价 / 风险 |
|---|---|---|---|
| 3.1 | P2 | 23 个 `check-*.ts` 的 main() 底部使用同构收尾模板（`'─'.repeat(60)` + `XXX_JSON` 摘要 + `process.exit`），22 处重复；`check-design-contract-consistency.ts:278` 用冒号分隔是唯一格式偏差 | 模板漂移风险（如 exitCode 与 process.exit 实参不一致）、约 600+ 行重复样板 |
| 3.2 | P2 | `--phase` 校验在 13 个文件存在至少 5 种形态（正则+isInteger+range / parseInt+isInteger+includes / parseInt+NaN+range / Number()+isInteger+range / 仅 parseInt 无校验）；`check-signature-chain.ts` 缺范围校验 | 行为不一致：同一非法 `--phase` 在不同脚本表现不同；标准仅 artifact-gate 完整实现 |
| 3.3 | P2 | `graph-logic.ts` 的 `checkRequirementGraph`（215-783）已在 449-458 建 outEdges/inEdges 索引，但 4 处仍做全图线性扫描：rootCandidates（333-338）O(m)/节点、orphan BFS（387-398）O(m)/出队、conflicts-with 对称（685-689）O(m²)、cross-cuts 节点查找（691-705）O(m×n) | 大图 O(n²)/O(m²) 性能退化 |
| 3.4 | P2 | `code-tla-logic.ts:218-227` getLine 每次调用 `ast.getFullText()` + 逐字符扫描，对每个赋值/分支/断言节点调用 → O(n²) | 大文件慢；`ts.getLineAndCharacterOfPosition` O(1) 替代 |
| 3.5 | P2 | `check-state-machine-consistency.ts`（177 行）为「CLI + 纯逻辑」混合体：`transitionKey`（53-55）、`checkStateMachineConsistency`（57-104）、类型（27-51）与 I/O 同文件；`state-machine-logic.ts` 不存在 | 违反「*-logic.ts 纯逻辑层」架构（全仓唯一反例）；AGENTS 引用已修正 |
| 3.6 | P2 | TLA+ 快照解析两处重复：`check-bdd-model.ts:263-292` 内联简化版 + `extractTlaStates/Init/Transitions/Invariants`（423-529），tla-logic.ts 已有 parseTlaHeader；BDD scenario 解析两处同构：`check-bdd-model.ts:106-137` vs `self-test.ts:2300-2389`，且语义漂移（When|And vs When、首 Then vs 末 Then） | 复制漂移：两处正则未来可能再分化 |
| 3.7 | P2 | UAT 表格解析两套：`check-artifact-gate.ts:59-93` 严格版（畸形→violation）+ `check-design-contract-consistency.ts:43-61` 宽松版（畸形静默跳过） | 同一文件格式两种容错语义，行为不一致 |
| 3.8 | P2 | JSONL 扫描样板 4 处未复用 `readJsonlOrExit`：check-budget.ts:76-106、check-maturity.ts:78-100、check-role-dispatch.ts:46-81、check-preventive-review.ts:66-141 | 样板重复；其中 role-dispatch 坏行 exit 2 语义是第 29 轮决策（与 warn+skip 不等价） |
| 3.9 | P3 | `package.json:22-23` 声明 `@cucumber/cucumber`、`@cucumber/messages`，全仓无任何 import（场景解析是手写正则）；`run-log-logic.ts:433` SCRIPT_JSON 是死模式（22 个摘要键均无 SCRIPT_JSON）；孤儿样本：samples/event-ingress/（4 文件）、samples/hill-climbing/（5 文件）、samples/bdd/valid-manifest-root.json | 无用依赖拖慢 npm install；死正则误导维护者；孤儿样本增加扫描噪音 |
| 3.10 | P3 | `diag-fix.ts`（24 行一次性诊断脚本，无任何引用，设计文档 D4/3.10 已定删除）；`samples/.w-model/gate-logs/`（4 个运行时 gate-logs JSON 已提交） | 已提交运行时产物污染仓库 |
| 3.11 | P3 | `signature-chain-logic.ts:128/156/190` 三处原地 `.sort()`，其中 156/190 直接原地排序**调用方传入的 entries 数组**，副作用泄漏 | 调用方数据被改写，隐藏 bug 面 |
| 3.12 | P3 | 「可选 JSON 附属输入」三分支样板约 24 处跨 12 个文件（ENOENT→跳过/警告、解析失败→分类、存在→解析）；check-requirement-coverage.ts 同一文件内三重复制 | 样板重复 + 错误分类不一致 |

### 1.1 不涉及范围

- 不改任何脚本的 stdout / stderr / exit code 语义（行为等价是硬门槛）。
- 不改 `XXX_JSON` 输出键名与结构（Agent 解析契约，批次 1 §1.1 已声明）。
- 不改 check-role-dispatch 坏行 exit 2 行为（第 29 轮决策，3.8 合并时保留该语义，不强行等价 readJsonlOrExit）。
- 不新增运行时依赖（复用 node 内置 + 既有 devDeps；typescript 已是 devDep）。
- 版本号不升（批次 5 收尾统一 33.0.0）。

## 2. 方案（12 项）

| # | 方案 | 说明 | 结论 |
|---|---|---|---|
| 3.1 | 抽 `lib/gate-report.ts` 统一收尾模板 | `printGateReport(label, summary, exitCode)` 输出 `'─'.repeat(60)` + `LABEL_JSON ...` + `process.exit(exitCode)`；22 处收敛为调用；design-contract 冒号格式归一 | 删 ~600 行，消除漂移 |
| 3.2 | 抽 `lib/parse-phase.ts` 统一 `--phase` 校验 | `parsePhaseArg(argv, { min=1, max=8 })` 用 artifact-gate 标准（`/^\d+$/` + Number.isInteger + range），13 处收敛；signature-chain 补齐范围校验 | 行为归一；signature-chain 补校验为既有标准对齐（无输出变化，仅非法输入行为更严格——与 gate 一致） |
| 3.3 | graph-logic 索引化 | 将 outEdges/inEdges 构建上移（322 附近），新增 conflictsAdj 集合，4 处线性扫描改走索引 | O(n²)→O(n)，行为等价 |
| 3.4 | getLine 改 ts API | `ts.getLineAndCharacterOfPosition(ast, pos).line + 1` | O(n²)→O(1) |
| 3.5 | 新建 `state-machine-logic.ts` | 下沉类型 + `transitionKey` + `checkStateMachineConsistency`；CLI 只留 main + 报告 + isMain 守卫 | 消除「逻辑与 CLI 同文件」唯一反例 |
| 3.6 | 收敛 BDD/TLA+ 快照解析 | bdd-logic.ts 导出 `parseFeatureFile` + `parseTlaSpecSnapshot`（复用 tla-logic parseTlaHeader），check-bdd-model.ts 与 self-test.ts 改 import 调用；**语义统一**：When\|And 双取 + 首个 Then（以 self-test 既有断言基线为准，回归 self-test 213 条验证） | 消除复制漂移 |
| 3.7 | 收敛 UAT 表格解析 | design-contract-logic.ts 增导出 `parseUatPathMappingContent(content)`（复用 artifact-gate 严格解析逻辑），check-design-contract-consistency.ts 改调用；**注意**：design-contract 场景若需保留「无畸形行 violation」语义，则严格版仅当显式开启时才报畸形——由 plan 详查调用方断言后定 | 消除两套正则 |
| 3.8 | 复用 readJsonlOrExit | check-budget / check-maturity / check-preventive-review 改调 `readJsonlOrExit`（语义等价 warn+skip）；check-role-dispatch 保留现状（第 29 轮决策，注释注明不复用原因） | 3 处收敛，1 处明示保留 |
| 3.9 | 移除未用 devDeps + 死模式 + 孤儿 | package.json 删 `@cucumber/*`（同步 INSTALL.md / bdd-guide.md 文字说明）；`run-log-logic.ts:433` 删 SCRIPT_JSON 正则；删 samples/event-ingress、samples/hill-climbing、samples/bdd/valid-manifest-root.json（实施时复核引用后删） | 依赖瘦身 + 死代码清理 |
| 3.10 | 删 diag-fix.ts + gate-logs | 删 `diag-fix.ts`；删 `samples/.w-model/gate-logs/`（4 文件）；检查 .gitignore 是否需要补 gate-logs 规则（运行时产物防再提交） | 清理已提交运行时产物 |
| 3.11 | 副本排序 | 128/156/190 三处改 `[...x].sort(...)` | 消除调用方数据副作用 |
| 3.12 | 抽 `readJsonOptional` | lib/read-json-or-exit.ts 增 `readJsonOptional(file)`（ENOENT→null 不 exit；解析失败→exit 2 或返回 {error} 由调用方分类）+ `readJsonlOptional`（同 readJsonlOrExit 但 ENOENT→null）；12 文件约 24 处收敛 | 样板收敛 + 错误分类统一 |

### 2.1 关键决策

1. **行为等价优先**：3.1/3.2/3.3/3.4/3.11/3.12 为纯等价收敛，输出三要素（stdout/stderr/exit code）不变；3.2 的 signature-chain 补校验属「对齐既有标准」——非法 phase 输入从"无校验"变"exit 2/1"，与其余 gate 一致，属验收可接受的行为收紧。
2. **3.6 语义统一以 self-test 基线为准**：self-test.ts 与 check-bdd-model.ts 的解析漂移统一后，以 self-test 213 条断言为回归基线；若统一引入个别用例行为差异，须先确认测试预期再定统一方向（plan 中给出对比表）。
3. **3.7 不改变两脚本既有输出语义**：design-contract 的宽松解析若被其测试断言依赖（无畸形 violation），则严格版通过可选参数控制畸形报告开关。
4. **删除类操作按总框架 D4 授权执行**：diag-fix.ts、gate-logs、孤儿样本、@cucumber devDeps、SCRIPT_JSON 均已在总框架 §3.3/§2 决策确认。
5. **readJsonlOrExit 语义不变**：warn+skip 坏行、ENOENT→exit 2；role-dispatch 不合并（第 29 轮决策）。

## 3. 详细设计

### 3.1 lib/gate-report.ts

```ts
/**
 * 门禁脚本统一收尾报告（批次 3 §3.1）
 *
 * 收敛 23 个 check-*.ts 的「分隔线 + XXX_JSON 摘要 + exit」样板。
 * 输出格式与历史逐字节一致：分隔线、`<LABEL>_JSON <json>`、exit 码。
 */
export function printGateReport(label: string, summary: { passed: boolean; violations: string[] } & Record<string, unknown>, exitCode: number): never {
  console.log('─'.repeat(60));
  console.log(`${label}_JSON ` + JSON.stringify({ ...summary, exitCode }));
  process.exit(exitCode);
}
```

- 调用点：`printGateReport('VERIFIER', { passed, violations }, result.passed ? 0 : 1)`。
- `check-design-contract-consistency.ts:278` 的 `CONTRACT_JSON:` 冒号归一为空格（其余 22 处均为空格分隔；确认无脚本按冒号截取）。
- 含额外输出的脚本（如 check-bdd-model 写 gate-logs 文件）在调用前保留各自 I/O，仅收尾三行收敛。

### 3.2 lib/parse-phase.ts

```ts
/** 统一 --phase 解析（批次 3 §3.2）。标准：/^\d+$/ + Number.isInteger + [min,max]（对齐 check-artifact-gate round28 G-B B6）。 */
export interface PhaseParseResult { phase: number; raw: string; }
export function parsePhaseArg(argv: string[], opts?: { min?: number; max?: number; positional?: number }): PhaseParseResult | undefined {
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 8;
  // 支持 --phase=N 与 --phase N 与位置参数
  const idx = argv.indexOf('--phase');
  let s: string | undefined;
  if (idx !== -1) {
    const inline = argv[idx].split('=')[1];
    s = inline ?? argv[idx + 1];
  } else if (opts?.positional !== undefined) {
    s = argv[opts.positional];
  }
  if (!s || !/^\d+$/.test(s)) return undefined;
  const val = Number(s);
  if (!Number.isInteger(val) || val < min || val > max) return undefined;
  return { phase: val, raw: s };
}
```

- 13 处收敛；metrics-report 的 `split('=')[1]` 与 plan-chunks 的位置参数形态均覆盖。
- signature-chain 由「无范围校验」对齐为 [1,8]（其 phase 语义即阶段号）。

### 3.3 graph-logic.ts 索引化

将 449-458 的 outEdges/inEdges 构建上移到 322 附近（nodeMap 之后），并新增：
```ts
const outEdges = new Map<string, GraphEdge[]>();
const inEdges = new Map<string, GraphEdge[]>();
const conflictsAdj = new Set<string>(); // "from->to" 规范化键
```
4 处替换：
1. rootCandidates（333-338）：`inEdges.get(n.id)?.some(e => e.type === 'parent')` 判有无父；
2. orphan BFS（387-398）：`outEdges.get(cur) ?? []` 过滤 parent 边；
3. conflicts-with 对称（685-689）：`conflictsAdj.has(`${e.to}->${e.from}`)`；
4. cross-cuts 节点查找（691-705）：`nodeMap.get(e.to)`。

### 3.4 code-tla-logic.ts getLine

```ts
function getLine(node: TsType.Node): number {
  return ts.getLineAndCharacterOfPosition(ast, node.getStart(ast, false)).line + 1;
}
```

### 3.5 state-machine-logic.ts

新建 `scripts/state-machine-logic.ts`，下沉：类型 `Transition`/`StateMachineConsistencyInput`/`StateMachineConsistencyResult` + `transitionKey` + `checkStateMachineConsistency`（纯函数，不 import node:fs）。CLI 文件保留：参数解析、readJsonOrExit、人类报告、STATE_MACHINE_JSON、isMain 守卫。新增 `__tests__/state-machine-logic.test.ts` 单测（复用 samples/state-machine 样本）。

### 3.6 bdd-logic.ts 收敛解析

- `bdd-logic.ts` 新增导出 `parseFeatureFile(content)`（合并 check-bdd-model.ts:106-137 与 self-test.ts:2300-2389，语义取并集：`(?:When|And)` 双取 + 首个 Then——以 self-test 断言基线验证）与 `parseTlaSpecSnapshot(tlaContent, specId)`（复用 tla-logic 的 parseTlaHeader + 提取 States/Init/Next/Invariants，替换 check-bdd-model.ts:263-292 内联简化版）。
- check-bdd-model.ts 与 self-test.ts 改为 import 调用；原内联函数删除。
- plan 中给出「统一前后行为对比表」：对现有 samples 断言逐条核对，漂移点以 self-test 通过为准。

### 3.7 design-contract-logic.ts 收敛 UAT 解析

- `design-contract-logic.ts` 增导出 `parseUatPathMappingContent(content, opts?: { strict?: boolean })`：strict=true 时畸形行记 violation（对齐 artifact-gate），默认 false 时静默跳过（对齐 design-contract 现状）。
- `check-design-contract-consistency.ts:43-61` 改调用（默认非 strict 保持其既有输出不变）。
- `check-artifact-gate.ts:59-93` 复用 strict 版（输出不变）。
- 若两脚本解析字段名不同（uatId/designPath vs uatId/actualPath/mappingType），plan 中定统一返回结构 + 各自映射。

### 3.8 readJsonlOrExit 复用

- check-budget.ts:76-106、check-maturity.ts:78-100、check-preventive-review.ts:66-141 改调 `readJsonlOrExit`（确认语义等价：warn+skip 坏行、ENOENT→exit 2）。
- check-role-dispatch.ts:46-81 保留现状，注释补「第 29 轮决策：坏行 exit 2，不复用 readJsonlOrExit（warn+skip）」。

### 3.9 依赖/死模式/孤儿清理

- package.json 删 `@cucumber/cucumber`、`@cucumber/messages`；同步 INSTALL.md:33、bdd-guide.md:37-38 的文字（改为「场景解析为手写正则（check-bdd-model.ts）」）。
- run-log-logic.ts:432-444 删 `/SCRIPT_JSON\s+(\{.*\})/`。
- 删 samples/event-ingress/、samples/hill-climbing/、samples/bdd/valid-manifest-root.json（实施时复核：self-test 无引用、vitest 无引用）。

### 3.10 diag-fix.ts + gate-logs

- 删 `scripts/diag-fix.ts`。
- 删 `samples/.w-model/gate-logs/`。
- `.gitignore` 检查：若根 .gitignore 未覆盖 `**/.w-model/gate-logs/` 运行时产物，补一条（防再提交）。

### 3.11 signature-chain-logic 副本排序

- 128：`const phaseEntries = [...scopedEntries].sort(...)`；
- 156：`const allSorted = [...(entries as SignatureChainEntry[])].sort(...)`；
- 190：同 156。

### 3.12 readJsonOptional

lib/read-json-or-exit.ts 新增：
```ts
/** 可选 JSON 输入：ENOENT→null（不 exit）；解析失败→exit 2（与 readJsonOrExit 一致） */
export async function readJsonOptional<T = unknown>(file: string): Promise<T | null>;
/** 可选 JSONL 输入：ENOENT→[]；其余同 readJsonlOrExit */
export async function readJsonlOptional(file: string, label?: string): Promise<unknown[]>;
```
12 文件约 24 处三分支收敛（ENOENT 跳过语义保留；损坏→exit 2 的既有行为保留）。

## 4. 验证策略（批次 3 验收标准）

1. **全局基线**：`npm run self-test` 213 条全通过（3.6 语义统一后按实测确认不变或同步计数）；`npx vitest run` 全通过（新增 state-machine-logic 单测 + readJsonOptional 单测 + parse-phase 单测，总数按实测记录）；`npx tsc --noEmit` 0 错误；`npm run lint:security` baseline 通过（删代码后按需 regenerate）。
2. **行为等价抽查（spec §5.3 方法）**：对 3.1/3.2/3.3/3.4/3.7/3.8/3.11/3.12 每个涉及脚本，用 samples/ 代表性样本（valid+bad+边界：无参数、目录路径、非法 phase 格式）对比重构前后 stdout/stderr/exit code，差异 0。
3. **3.2 特例**：signature-chain 非法 `--phase=abc`/`--phase=0`/`--phase=9` 从"无校验"变为拒绝（与 gate 一致）——记录为行为收紧，用 samples 复验合法 phase 输出不变。
4. **3.6 特例**：self-test BDD 用例 + check-bdd-model 的 samples 全量回归，统一后 213 条断言不变。
5. **依赖瘦身**：`npm install` 干净无告警；grep `@cucumber` 仅剩文档历史提及（CHANGELOG/历史 spec 除外）。
6. **净代码行数**：删除 + 收敛后 `git diff --stat` 净减少 ≥ 600 行（3.1 模板 + 3.9/3.10 删除 + 3.12 样板）。

## 5. 影响文件清单

| 类别 | 文件 | 动作 |
|---|---|---|
| 新增 lib | `w-model-dev/scripts/lib/gate-report.ts` | 新增（3.1） |
| 新增 lib | `w-model-dev/scripts/lib/parse-phase.ts` | 新增（3.2） |
| 新增 logic | `w-model-dev/scripts/state-machine-logic.ts` | 新增（3.5） |
| 修改 lib | `w-model-dev/scripts/lib/read-json-or-exit.ts` | 修改（3.12） |
| 修改 | 23 个 check-*.ts 收尾（3.1）+ 13 个文件 --phase（3.2） | 修改 |
| 修改 | `graph-logic.ts`（3.3）、`code-tla-logic.ts`（3.4）、`bdd-logic.ts`（3.6）、`design-contract-logic.ts`（3.7）、`run-log-logic.ts`（3.9）、`signature-chain-logic.ts`（3.11） | 修改 |
| 修改 | `check-state-machine-consistency.ts`（3.5 瘦身）、`check-bdd-model.ts`（3.6）、`self-test.ts`（3.6）、`check-design-contract-consistency.ts`（3.7）、`check-budget.ts`/`check-maturity.ts`/`check-preventive-review.ts`（3.8） | 修改 |
| 修改 | `package.json`、`docs/INSTALL.md`、`bdd-guide.md`（3.9 文字）、根 `.gitignore`（3.10） | 修改 |
| 删除 | `scripts/diag-fix.ts`、`samples/.w-model/gate-logs/`、`samples/event-ingress/`、`samples/hill-climbing/`、`samples/bdd/valid-manifest-root.json` | 删除 |
| 测试 | `__tests__/state-machine-logic.test.ts`、`__tests__/parse-phase.test.ts`、`__tests__/read-json-or-exit.test.ts`（扩充） | 新增/修改 |

提交粒度（子任务级）：3.1 模板 → 3.2 phase → 3.3 graph → 3.4 getLine → 3.5 state-machine → 3.6 bdd 解析 → 3.7 UAT 解析 → 3.8 JSONL → 3.9 依赖/死码 → 3.10 删除 → 3.11 sort → 3.12 readJsonOptional。
