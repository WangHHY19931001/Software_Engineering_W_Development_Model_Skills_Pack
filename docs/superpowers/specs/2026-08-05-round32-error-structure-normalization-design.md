# 第 32 轮设计：错误结构全量归一化 + run-log R6 契约迁移

> 触发：外部评审者就技能包给出 14 条建议，用户经头脑风暴选定 3 轮分组实施。本轮为第 3 轮（高风险改造批）：#3 错误结构全量归一化（消息 + 结构化错误对象）、run-log R6 契约迁移。
>
> 当前版本：`31.0.0`；目标版本：`32.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。
>
> 工作流：头脑风暴 → 设计（本文）→ 计划 → 同步 SSoT → 实施 → 回归 → 同步 SSoT/README/AGENTS/INSTALL/CHANGELOG。
>
> 后续：无规划轮次（14 条建议的 6 项选定批已全部实施完毕）。

## 1. 背景与缺口

### 1.1 现状（探索实测）

| 维度 | 现状 | 缺口 |
|---|---|---|
| 错误消息格式 | 全仓约 40 处 `✗` 错误消息，措辞 4+ 种变体：参数校验有 `✗ --phase 参数非法: 99` / `✗ phase 须为 5-8，收到 9` / `✗ --phase 必须为 1-4，实际: 5` / `✗ --phase 须为 1-8，实际: 9` 等；「文件不存在」有 `✗ RTM 文件不存在` / `✗ 目录不存在` / `✗ 文件不存在` 等；部分带「（转 operational-recovery）」指引、多数没有 | 无统一错误报告结构：人类可读消息措辞漂移；机器无法结构化识别错误类别 |
| 退出码语义 | 大体 0/1/2，但 check-role-dispatch 坏行 exit 2 与 readJsonlOrExit warn+skip 行为不一致（第 29 轮已记录不重构） | 本轮不改变 exit 1 语义；仅统一 exit 2 输入错误的输出结构 |
| JSON 摘要 | 各 check-*.ts stdout 末尾输出 `GATE_JSON` / `TLA_JSON` / `GRAPH_JSON` 等（含 exitCode，§10E E.1）；错误场景（exit 2）无结构化输出 | exit 2 场景缺机器可读错误摘要 |
| R6 交叉校验 | `run-log-logic.ts` R6 判定（gateLogPath 已设但 gateExitCode 非 number → violation；exitCode 与 gate-log 交叉校验）已在 logic 层；但 `extractExitCode`（gate-log 内容提取 exitCode）与 gateLogPath 多索引匹配规则（basename/绝对/相对 cwd + 反斜杠归一化）住在 CLI 层 `check-run-log.ts` `loadGateLogs` 内 | 提取/匹配规则不可单测，契约未归位 logic 层 |

### 1.2 缺口清单

| 缺口 | 本轮动作 |
|---|---|
| G1 无统一错误消息结构 | 新增 `lib/cli-error.ts`：6 类错误码 + `CliError` + `formatCliError` / `printError` / `printErrorJson` / `exitWithError`；全仓 exit 2 路径接入 |
| G2 exit 2 无机器可读摘要 | 每个 exit 2 场景在 **stdout** 输出 `ERROR_JSON {"category","message","exitCode","file"}`（遵循 §10E E.1「JSON 摘要输出 stdout」惯例）；人类可读错误消息保持 **stderr** |
| G3 R6 契约在 CLI 层 | `extractExitCode` + `buildGateLogKeys` 迁入 `run-log-logic.ts`（纯函数），CLI 仅留 IO；新增单测 |

### 1.3 不涉及范围

- **不改 exit 1 语义**：校验失败（violations 列表 + 既有 `XXX_JSON` 摘要含 exitCode=1）结构不变，不额外输出 ERROR_JSON。
- **不改 check-role-dispatch 坏行行为**：第 29 轮已决策（行为不等价，不重构）；本轮仅统一其错误消息格式。
- **不改 run-log/budget/schema/门禁逻辑**：本轮为输出层归一化 + R6 规则归位，不改变任何校验判定。
- **不引入新依赖**：cli-error.ts 仅 node:process。
- **第 32 轮内容不包含**：无后续轮次。

## 2. 方案（已确认）

| 方案 | 说明 | 结论 |
|---|---|---|
| **A（采纳）** | 消息统一（`✗ [CATEGORY] <msg>: <detail>`）+ 结构化错误对象（`CliError` + `ERROR_JSON` 走 stdout）+ R6 提取/匹配规则迁入 logic 层 | 消息可读 + 机器可解析 + 规则可单测 |
| B | 仅统一消息措辞，不引入错误对象 | 机器仍无法结构化识别，不采纳 |
| C | 消息统一 + 结构化错误，但 ERROR_JSON 走 stderr | 与 §10E E.1「JSON 摘要 stdout」惯例冲突，不采纳（用户已确认改 stdout） |

**关键决策（用户确认）**：
1. #3 范围 = **消息 + 结构化错误对象**；
2. R6 = **迁入 logic 层**；
3. **ERROR_JSON 输出到 stdout**（与 GATE_JSON 等既有约定一致，§10E E.1）；人类可读错误消息走 stderr（错误流分离：stderr=诊断，stdout=机器可读 JSON）。

## 3. 详细设计

### 3.1 `lib/cli-error.ts`（结构化错误对象，纯逻辑）

```ts
/** 错误类别（6 类；exit 1 校验失败走既有 violations + XXX_JSON，不占用本表） */
export type ErrorCategory =
  | 'ARG_INVALID'       // 参数非法（值/类型/范围）
  | 'FILE_NOT_FOUND'    // 文件/目录不存在（ENOENT）
  | 'FILE_PARSE'        // JSON 解析失败（非合法 JSON）
  | 'FILE_READ'         // 读取失败（非 ENOENT，如 EACCES）
  | 'STRUCTURE_INVALID' // 合法 JSON 但结构/形状不符（顶层非对象、缺字段、类型错）
  | 'UNEXPECTED';       // 未预期异常（main().catch 兜底）

export interface CliError {
  category: ErrorCategory;
  /** 人类可读描述（不含 ✗ 前缀与路径后缀；由 formatCliError 组装） */
  message: string;
  /** 退出码：当前仅 2（输入错误）；预留 0/1 供未来错误场景 */
  exitCode: 0 | 1 | 2;
  /** 相关文件绝对路径（可选） */
  file?: string;
  /** 补充详情（如收到的参数值 / 底层错误码） */
  detail?: string;
}

/** 组装人类可读消息：`✗ [CATEGORY] <message>: <file|detail>`（file 优先，其次 detail，均无则省略冒号段） */
export function formatCliError(e: CliError): string;

/** stderr 输出人类可读错误消息（formatCliError 结果） */
export function printError(e: CliError): void;

/** stdout 输出结构化错误摘要：`ERROR_JSON {"category","message","exitCode","file"}`（遵循 §10E E.1 约定） */
export function printErrorJson(e: CliError): void;

/** printError + printErrorJson + 设置 process.exitCode（返回后由 Node 自然退出，stdout 先 flush——避免 process.exit() 截断 ERROR_JSON）；main 内输入错误路径与 main().catch 兜底统一调用 */
export function exitWithError(e: CliError): void;
```

**消息模板（全仓统一措辞）**：

| 类别 | 模板 |
|---|---|
| ARG_INVALID | `✗ [ARG_INVALID] 参数非法 <--name>=<value>（须为 <约束>）` |
| FILE_NOT_FOUND | `✗ [FILE_NOT_FOUND] 文件不存在: <abs>` |
| FILE_PARSE | `✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: <abs>` |
| FILE_READ | `✗ [FILE_READ] 文件读取失败: <abs>（<errno>）` |
| STRUCTURE_INVALID | `✗ [STRUCTURE_INVALID] 结构不符: <file>（<描述>）` |
| UNEXPECTED | `✗ [UNEXPECTED] 脚本异常: <message>` |

**ERROR_JSON 输出格式**（stdout 单行，与既有 `GATE_JSON` 等标记风格一致）：

```json
ERROR_JSON {"category":"FILE_PARSE","message":"文件解析失败（非合法 JSON）","exitCode":2,"file":"C:\\proj\\.w-model\\rtm.json"}
```

**关键约束**：
- `ERROR_JSON` 的 `exitCode` 字段与脚本最终退出码（`process.exitCode`）**强一致**（沿用 §10E E.1 防伪三层机制精神）。
- `printError` 走 stderr、`printErrorJson` 走 stdout，两者分离：stdout 不被人类错误消息污染（机器可整体 `ERROR_JSON` 前缀截取）；stderr 不被 JSON 污染（人类可读）。
- exit 1 场景不调用本模块（校验失败已由 violations + `XXX_JSON` 承载）。

### 3.2 全仓 exit 2 路径接入（改造范围）

以下脚本的 exit 2 输入错误路径全部改为 `exitWithError`（参数校验、文件读/解析、结构校验），`main().catch` 兜底改为 `exitWithError({category:'UNEXPECTED', ...})`：

**check-*.ts（23 个）**：check-verifier-output / check-artifact-gate / check-requirement-graph / check-requirement-coverage / check-exemption / check-tla-model / check-bdd-model / check-tla-bdd-sync / check-budget / check-run-log / check-maturity / check-checkpoint / check-rootcause-report / check-code-tla-consistency / check-design-contract-consistency / check-signature-chain / check-role-dispatch / check-preventive-review / check-archive-integrity / check-opsx-artifacts / check-openspec-archive / check-codegraph-queries / check-state-machine-consistency

**工具脚本（5 个）**：plan-chunks / ensure-codegraph-opsx / security-scan / wm-status / metrics-report

**lib（1 个）**：read-json-or-exit.ts（其内部 ENOENT/解析失败消息改为统一格式；保持 exit(2) 行为不变——v29 已确认该工具行为契约，仅换消息格式）

> 改造合计 29 个文件（23 check-*.ts + 5 工具 + 1 lib）。security-scan / wm-status / metrics-report 已含部分统一格式（如 `✗ 文件解析失败（非合法 JSON）`），仅需加类别前缀与 ERROR_JSON。

**具体归一化项（每脚本）**：
1. 参数非法（phase/variant/mode/node-type/max-tokens 等）→ `ARG_INVALID`；
2. 文件/目录不存在（ENOENT）→ `FILE_NOT_FOUND`；
3. JSON.parse 失败 → `FILE_PARSE`；
4. 读取异常（非 ENOENT）→ `FILE_READ`；
5. 合法 JSON 但形状不符（顶层非对象/缺数组/缺字段）→ `STRUCTURE_INVALID`；
6. `main().catch` 未预期异常 → `UNEXPECTED`；
7. 删除各脚本手写 `console.error('✗ ...') + process.exit(2)` 样板，统一走 `exitWithError`。

### 3.3 run-log R6 契约迁移（迁入 logic 层）

**`run-log-logic.ts` 新增导出（纯函数，自包含）**：

```ts
/** 从 gate-log 内容提取 exitCode：扫描 26 个 `XXX_JSON {...}` 摘要标记（含 STATUS_JSON/METRICS_JSON；第 32 轮追加 ERROR_JSON），JSON.parse 后取 exitCode；无匹配返回 undefined（契约与 check-run-log.ts 现行一致，无 exit= 正则回退） */
export function extractExitCode(content: string): number | undefined;

/** 构建 gateLogPath 多索引 key 集：basename / 绝对路径 / 相对 cwd 路径 / 各路径正斜杠归一化（兼容 Windows） */
export function buildGateLogKeys(fileAbs: string, cwd: string): string[];
```

**`check-run-log.ts` 改造**：`loadGateLogs` 保留目录扫描 + 文件读取（IO），删除内部手写索引构建与 extractExitCode 实现，改调 `buildGateLogKeys` / `extractExitCode`（自 `run-log-logic.js` 导入）；`extractExitCode` 内部 JSON 摘要解析复用既有正则（`(GATE_JSON|TLA_JSON|GRAPH_JSON|RUN_LOG_JSON|MATURITY_JSON|...)\s+(\{.*\})` 模式与 `check-run-log.ts` 现行一致）。

> 契约不变：R5/R6 判定逻辑与 gateLogs Map 结构（`Map<string,{exitCode?,content}>`）不变；仅提取/索引规则归位 logic 层使可单测。

> **增量（验证驱动）**：exit 2 场景输出的 `ERROR_JSON` 摘要行须纳入 R6 交叉校验范围（模拟脚本验证：ERROR_JSON 走 stdout 后被 G 子代理存档到 gate-logs，`extractExitCode` 须能解析 exitCode=2 否则 R6 误报「未提取到 exitCode」）。`GATE_JSON_PATTERNS` 追加 `/ERROR_JSON\s+(\{.*\})/`（25→26 个标记）。

### 3.4 版本号

- package.json / skill-metadata.json / SKILL.md frontmatter：`31.0.0` → `32.0.0`。

## 4. 测试设计

### 4.1 `cli-error.test.ts`（7 用例）

1. `formatCliError` 带 file → `✗ [FILE_NOT_FOUND] 文件不存在: <abs>`
2. `formatCliError` 带 detail（无 file）→ `✗ [ARG_INVALID] 参数非法 --phase=99（须为 1-8 整数）`
3. `formatCliError` 无 file/detail → 省略冒号段
4. `printError` 输出到 stderr（spyOn console.error）
5. `printErrorJson` 输出到 stdout（spyOn console.log），格式为 `ERROR_JSON {json}` 且含 exitCode
6. `exitWithError` 设置 `process.exitCode=2` 且正常返回（stdout 先 flush 再退出）
7. ERROR_JSON 的 exitCode 与传入 CliError.exitCode 一致

### 4.2 `run-log-logic.test.ts` 扩展（7 用例）

1. `extractExitCode` JSON 摘要行（`GATE_JSON {"exitCode":0}`）→ 0
2. `extractExitCode` 多标记扫描（`VERIFIER_JSON {"exitCode":1}`）→ 1
3. `extractExitCode` 无匹配 → undefined
4. `buildGateLogKeys` 返回含 basename / 绝对路径 / 相对 cwd / 正斜杠归一化 4 类 key
5. `buildGateLogKeys` 含反斜杠路径归一化（Windows 兼容）
6. `buildGateLogKeys` cwd 为空时退化为 basename + 绝对路径（相对 key 省略）
7. `extractExitCode` 从 ERROR_JSON 摘要行提取 exitCode=2（第 32 轮 exit 2 存档纳入 R6 契约）

**基线**：vitest **363**（实施期实测，含 §4.1 七用例 + §4.2 七用例）；self-test 213 不变；tsc strict 0 错误。

## 5. 文档同步清单

| 文件 | 动作 |
|---|---|
| `w-model-dev/scripts/lib/cli-error.ts` | 新增（纯逻辑） |
| `w-model-dev/SKILL.md` | frontmatter version → 32.0.0 |
| `w-model-dev/references/command-reference.md` | 新增「错误码与 ERROR_JSON 约定」节（6 类错误码表 + 消息模板 + stdout/stderr 分离） |
| `w-model-dev/scripts/__tests__/README.md` | coverage 矩阵 +2 行（cli-error / run-log-logic 扩展说明） |
| `AGENTS.md` | §2 scripts 描述 + cli-error.ts；§8 self-test 行 vitest 计数更新 |
| `README.md` | 版本号/计数引用更新；lib/ 结构 + cli-error.ts |
| `docs/skill-design-document_SSoT.md` | §3.4.30 新节；§10A 追溯表 +行；§10E 补充「ERROR_JSON 属 stdout JSON 摘要家族」说明；§6.1 无命令变更 |
| `docs/INSTALL.md` | 版本号/目录速查 + cli-error.ts |
| `CHANGELOG.md` | 新增 `[32.0.0]` 条目 |
| `package.json` + `w-model-dev/skill-metadata.json` | version → 32.0.0 |

## 6. 验收标准

- vitest 358/358 全通过（345 + 13）
- self-test 213/213 不变（消息文本改动不影响——self-test 仅断言退出码）
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增；新文件若触发误报按惯例 regenerate baseline）
- 冒烟（任选 3 脚本）：
  - `check-artifact-gate.ts --phase=99` → stderr 含 `✗ [ARG_INVALID]`、stdout 含 `ERROR_JSON {...}`、exit 2
  - `wm-status.ts <无 .w-model 目录>` → stderr 原样提示「项目未初始化」、stdout 无 ERROR_JSON、exit 0（查询语义，非错误——第 31 轮决策保留）
  - `metrics-report.ts --phase=abc` → `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2
- prepush 12 项全通过

## 7. 风险与回归

- **改动面大（~29 文件）**：分批实施（Subagent-Driven，每批一个脚本组 + 回归）；self-test 213 仅断言退出码 → 消息改动零回归风险。
- **ERROR_JSON 双输出**：stdout 仅 `ERROR_JSON` 行（不混人类消息）；机器消费按 `ERROR_JSON` 前缀截取（与 GATE_JSON 等既有截取方式一致）。
- **lint:security**：新增 `cli-error.ts` 与批量 `console.error` 改造可能触发 `detect-non-literal-fs-filename` 等误报 → 按仓库惯例 regenerate baseline（历史上 30.1/31 轮已 3 次，模式成熟）。
- **既有测试回归**：`read-json-or-exit.test.ts` 原断言 `stringContaining('✗ 文件不存在')` 与新格式 `✗ [FILE_NOT_FOUND] 文件不存在` **不兼容**（stringContaining 要求连续子串）——实施时已同步更新断言为类别前缀匹配（`[FILE_NOT_FOUND]`/`[FILE_PARSE]`），并在 Task 3 一并提交。
- **口径一致性**：6 类错误码与 command-reference 错误码表、SSoT §3.4.30 三处一致；ERROR_JSON 字段名（category/message/exitCode/file）全仓一致。
