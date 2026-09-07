# 门禁项数 STALE 扫描机制设计（gate-count-stale-scan）

- 日期：2026-09-07
- 状态：已批准
- 前置：trigger-boundary 快追（trigger-boundary-fastfollow）终审的「结构性 follow-up」
- 版本：42.2.1 不 bump（沿用快追先例）

## 1. 背景与问题

trigger-boundary-fastfollow 终审发现 F1：pre-push 门禁项数 17→18 后，`docs/troubleshooting.md` 三处「17 项」过期措辞未被任何门禁捕获，仅靠终审人工发现。根因：**门禁项数（`EXPECTED.prePushCount`）是单一事实源，但引用它的活体文档无校验覆盖**。

现状覆盖缺口：

| 承载门禁项数引用的位置 | 现有覆盖 |
| --- | --- |
| `.githooks/pre-push`（编号块 + 声明文本） | ✅ `checkPrePushCount`（F-G7-08 强校验） |
| `.github/PULL_REQUEST_TEMPLATE.md` | ✅ `checkPrTemplatePrePushCount` |
| README.md / AGENTS.md / CONTRIBUTING.md / docs/troubleshooting.md | ❌ **无覆盖（F1 缺口）** |

本设计关闭该缺口：新增 docs-consistency 内部检查，将四份活体文档的门禁项数引用绑定 `EXPECTED.prePushCount`，使未来的 N→N+1 漂移在 `npm run prepush` / `npm run check:docs-consistency` 时 fail-closed 拦截。

## 2. 范围

全部三项（用户确认）：

1. **STALE 门禁项数扫描**（主项）：`checkGateCountLiveDocs` 白名单行级扫描。
2. **:1366 注释历史失真修复**：`docs-consistency-logic.ts:1366-1368` 注释「旧实现…『18 项检查』文本」改为 count 无关写法。
3. **测试 fixture 派生**：`docs-consistency-logic.test.ts:62` `Array.from({ length: 18 }, ...)` 改为 `length: EXPECTED.prePushCount`。

### 非目标（明确不做）

- **不做「第 N 项门禁」下标扫描**：SSoT 用下标形式（「第 18 项门禁」），且「第 13 项 npm audit」是稳定项序号不随总数必变；混扫误伤风险高。SSoT 不入白名单。
- **不改 eval/README.md:9 措辞**：其「L1/L1N/L2 三层断言」已与 canonical 口径兼容（已验证）。
- **不加 runner.ts main() import 守卫**：既有行为非缺陷，YAGNI。
- **不新增 devDeps**：脚本保持 Node 标准库自包含。
- **不改 prePushCount 值（保持 18）**：新检查是 docs-consistency 内部新增项，不改 pre-push 编号块 / 声明文本 / PR 模板 / 既有 18 相关断言。

## 3. 方案（已批准：方案 A — 白名单行级扫描）

### 3.1 组件与接线

- **docs-consistency-logic.ts**：
  - 新增导出函数 `checkGateCountLiveDocs(docs: Array<{ name: string; content: string }> | undefined): DocCheckViolation[]`，check 名 `gate-count-docs`。镜像 `checkPrTemplatePrePushCount` 先例（docs-consistency-logic.ts:1724）。
  - 新增常量 `GATE_COUNT_DOC_NAMES = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/troubleshooting.md']`。代码注释说明排除语义：SSoT 用「第 N 项门禁」下标形式且含日期陈述；CHANGELOG.md / CHANGELOG-archive.md / docs/changes/** / docs/superpowers/** 为历史或内规划录、不可改。
  - `DocConsistencyInput` 新增可选字段 `gateCountDocs?: Array<{ name: string; content: string }>`（缺省 = 跳过，与 `prTemplate` / `linkDocs` 同例，保持 fixture 兼容）。
  - `buildDocConsistencyReport` 接线一行：`violations.push(...checkGateCountLiveDocs(input.gateCountDocs))`。
- **cli/check-docs-consistency.ts**：注入四份文档文本（复用既有 `read()`），构建 `gateCountDocs` 数组。

### 3.2 扫描规则（精确语义）

对每份白名单文档：

1. 按 `/\r?\n/` 切行，记录 1-based 行号。
2. **行门槛**：行不含「门禁」且不含「检查」→ 跳过该行。这是「5 项闭环脚本」（README.md:141）、「3 项目目录」（AGENTS.md:173）等非门禁项数不乱报的机制。
3. **命中模式**：`/(?<!第)(\d+)\s*项(?!目)/g`：
   - `(?<!第)` 排除「第 N 项」下标引用（如 troubleshooting.md:117「第 13 项 npm audit」）。
   - `(?!目)` 排除「N 项目」误匹配（如「3 项目目录」）。
   - 仅 ASCII 数字：中文数字（如「五项校验」）天然不命中。
4. **断言**：每个命中数字必须 == `EXPECTED.prePushCount`。否则违规：
   `{检查名 gate-count-docs}`：`{docName}:{lineNo} 存在过期门禁项数「{hit}」（当前 {EXPECTED.prePushCount} 项），须同步`。

对当前语料 11 处引用的验证（全部应为 0 违规）：README:31（裸「18 项」）、README:209、AGENTS:51、AGENTS:92、CONTRIBUTING:90、CONTRIBUTING:216（「18 项本地门禁」）、CONTRIBUTING:234、troubleshooting:13/:28/:114；无标记行 README:141 / AGENTS:173 被行门槛跳过；troubleshooting:117「第 13 项」被 `(?<!第)` 排除。

### 3.3 数据流与错误处理

- `gateCountDocs` 未注入 → 函数返回空违规（skip），与既有可选输入同例。
- 违规进入既有 violations 管道 → CLI exit 1；`--json` 输出按 `gate-count-docs` 分组。
- 本检查为静态检查，计入 `staticViolations`。

### 3.4 测试

`docs-consistency-logic.test.ts`（baseInput 模式）：

1. clean：四文档全「18 项门禁 / 18 项检查」→ 0 违规。
2. stale：任一文档出现「17 项门禁」→ 违规，消息含文档名与行号。
3. index-exclusion：同一文档行「pre-push 第 13 项 npm audit warn」+ 门禁标记 → 不违规。
4. marker-gate：无标记行「5 项闭环脚本（…）」→ 不违规。
5. bare-form：行「推送前门禁（本地 CI，17 项）」（README:31 形态）→ 违规。
6. 非标白名单文档名（如「CHANGELOG.md」传入）不入白名单 → 不扫描（白名单按文件名匹配，非白名单文件跳过或按调用方注入语义处理——按「只扫白名单名」实现）。
7. undefined 注入 → 0 违规（skip）。
8. 多文档多违规聚合计数。

## 4. 关联 minor 两项

### 4.1 docs-consistency-logic.ts:1366-1368 注释

现状（历史失真，因 fast-follow 把注释内数字同步到 18 所致）：

```
旧实现仅取「最大编号」+「18 项检查」文本
```

旧实现（audit-fixes T6 时代）校验的是**当时**的 `prePushCount`（17）。改为 count 无关写法：

```
旧实现仅取「最大编号」+「N 项检查」声明文本（N 为当时 prePushCount）
```

避免该注释随门禁项数再次过期。

### 4.2 测试 fixture 派生

`docs-consistency-logic.test.ts:60-64` `VALID_PRE_PUSH`：

```ts
...Array.from({ length: 18 }, (_, i) => `# ${i + 1}. 第 ${i + 1} 项门禁检查`),
```

改为 `length: EXPECTED.prePushCount`（测试 import 增加 `EXPECTED`，从 `../logic/docs-consistency-logic.js`）。同文件其他 `length: 18` / 硬编码 18 的 F-G7-08 fixture（如 :972 / :981）**不在本 campaign 范围**——避免过度扩散；如需派生可留待后续统一。

## 5. 治理同步

### 5.1 SSoT

在 `docs/skill-design-document_SSoT.md` 本地 pre-push 边界段（约 :1219 推送范围判定之后）追加一句：

> docs-consistency 对 README.md / AGENTS.md / CONTRIBUTING.md / docs/troubleshooting.md 四份活体文档执行门禁项数扫描（`gate-count-docs`）：行含「门禁/检查」标记时，全部「N 项」计数引用须 == `EXPECTED.prePushCount`；「第 N 项」下标与历史目录（CHANGELOG* / docs/changes / docs/superpowers）不在扫描范围。

（具体位置由实现者按上下文就近放置，保持 SSoT 行文风格。）

### 5.2 CHANGELOG.md

新增 campaign 小节（标题如「门禁项数 STALE 扫描（gate-count-stale-scan，2026-09-07）」），指针 + 摘要 + 「版本保持 42.2.1，不 bump」。沿用 trigger-boundary 先例的条目风格。

### 5.3 eval/w-model-dev-results.tsv

追加一行记录（沿用 trigger-boundary campaign 先例：dimension + dry_run keep，commit 指针指向本 campaign 收尾 commit）。

## 6. 验收标准

1. `npx vitest run --config config/vitest.config.ts` 全绿（含新增 gate-count-docs 用例 ≥7 个）。
2. `npm run check:docs-consistency` exit 0。
3. 人为构造临时的「17 项门禁」于任一白名单文档 → 该命令 exit 1 并报 `gate-count-docs`（负向验证）。
4. `npm run prepush` 18 项全绿。
5. `npx tsx eval/runner.ts` 不受影响（未改 eval/ 逻辑）。
