# W-Model 技能包核查报告六项修复 — 设计规格

- **日期**：2026-08-19
- **版本基线**：41.18.0 → 41.19.0（单次 minor，一个 CHANGELOG 条目）
- **来源**：外部核查报告六项实锤问题，经 2026-08-19 本地复核全部属实（含 self-test 256/256、vitest 47 files / 717 tests 实跑确认）
- **决策记录**：范围 = 六项全修（P1×4 + P2×2）；P1-1 深度 = 数字修正 + 门禁扩展；P1-4 = 提交 package-lock.json；P2-2 = 只强化 PR 模板（远程 runner 仍受限）；实施 = 方案 A（依赖序 5 批 + 单次发布）

## 1. 问题清单（复核确认）

| ID | 问题 | 复核证据 |
|---|---|---|
| P1-1 | CONTRIBUTING.md:96 写「40 files / 623 tests」（实际 47/717，且与同文件 :214 自相矛盾）；PR 模板:13 写「14 项通过」（实际 16 项，修复后为 17 项）；docs-consistency `REQUIRED_PATHS` 不覆盖两文件 | 行级取证 + `check-docs-consistency.ts:50-70` 白名单核实 |
| P1-2 | README:21 声称「tsc 0 错误」但 pre-push 16 项与 package.json 均无 tsc；SSoT §10H.5 V1 已列 `npx tsc -p config/tsconfig.json`（exit 0）为验证门 | pre-push 全文 + SSoT:1839 核实 |
| P1-3 | `.trae-html-share-packages/docs/index.html.zip`（1.17 KB）被 git 跟踪（commit 55c2ad8），.gitignore 无对应条目 | `git ls-files` 核实 |
| P1-4 | `.gitignore:45` 忽略 package-lock.json，devDeps 全 `^` 范围，audit 与门禁行为不可复现 | .gitignore + package.json 核实 |
| P2-1 | pre-push 纯 cmd/PowerShell 分支黄警告后 exit 0，门禁静默跳过且无未跑清单提示 | pre-push:56-61 核实（README/CONTRIBUTING 已声明该妥协，属刻意设计） |
| P2-2 | `.github/` 无 workflows，PR 合入质量无机器背书（runner 受限为历史原因，本轮维持） | `git ls-files .github/` 核实 |

## 2. 目标与范围

修复全部六项 + 反哺两项防复发门禁（typecheck 第 17 项、docs-consistency 覆盖扩展），单次 minor 发布。

### 2.1 范围外（明确不做）

- GitHub Actions（远程 runner 仍受限，用户决策）
- P3 各项：PREPUSH_AUDIT_STRICT 开关、覆盖率阈值上调节奏、self-test 用例表外置、大文件拆分
- SSoT 改动（tsc 门禁是 SSoT §10H.5 既有契约 V1 的实现对齐，非新设计决策，不触发 AGENTS.md §6 SSoT 优先流程）
- pre-push 纯 Windows 分支的阻断语义（保留 exit 0 妥协，只强化警告）

## 3. 关键设计决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | typecheck 以**第 17 项 append**（prettier 之后），不插入中间重排 | 避免 pre-push 内「第 13 项 npm audit」「第 14 项 docs-consistency 复用」等交叉引用注释连锁改号；命令与 SSoT §10H.5 V1 完全一致 |
| D2 | docs-consistency 扩展用**可选输入字段 + 缺省跳过**既有模式（同 `linkDocs`/`skillPkgDocs`） | 存量 78 条单测零破坏；新规则由新增用例覆盖 |
| D3 | CONTRIBUTING 计数检查**复用 `checkVitestTestCount` 的两套 stale 正则**（`N files / M tests`、`N 个 .test.ts / N 条`） | 正是本该拦住 :96 漂移的规则形态；逐处比对可同时盯住 :96 与 :214 |
| D4 | SSoT 零改动 | 见 §2.1 |
| D5 | 版本 41.19.0 单次 minor + CHANGELOG 单条目 | 沿用 16fixes 轮 D5 发布策略 |
| D6 | PR 模板数字修正（批3）与结构重构（批4）**串行编辑同文件** | 遵循禁止并行修改文档约定 |

## 4. 批次设计（依赖序，每批 1 commit）

### 批1 · 仓库卫生（P1-3 + P1-4）— `chore(repo)`

1. `.gitignore` IDE 节追加 `.trae-html-share-packages/`；`git rm --cached -r .trae-html-share-packages`（保留本地文件）
2. 删 `.gitignore:45` `package-lock.json` 行（保留 npm-debug.log*/yarn-error.log* 行与「npm 安装产物」注释，注释改为「npm 运行产物（lock 已入库保证依赖可复现）」）
3. `npm install --package-lock-only` 刷新 lock 后 `git add package-lock.json`
4. 预检：`npm audit --audit-level=high`——若报 high 漏洞，升级对应 devDeps 并回归 vitest（风险 R2，届时汇报）

### 批2 · typecheck 第 17 项门禁（P1-2）— `feat(gate)`

**前置检查（第一步，未通过则停下汇报）**：`npx tsc -p config/tsconfig.json` 须退出码 0；非 0 则先修存量类型错误（风险 R1）。

| # | 文件 | 改动 |
|---|---|---|
| 1 | package.json | 工具类组加 `"typecheck": "tsc -p config/tsconfig.json"` |
| 2 | .githooks/pre-push | :247 后 append 第 17 项（`run_expect "tsc 类型检查 0 错误" 0 npx tsc -p config/tsconfig.json`，注释标注「对齐 SSoT §10H.5 V1」）；:141「16 项检查」→「17 项检查」 |
| 3 | w-model-dev/scripts/logic/docs-consistency-logic.ts:90 | `prePushCount: 16` → `17` |
| 4 | w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts | 正向 fixture（:126 一处）16→17；负向 fixture（:324 的 13 项、:484 的 15 项）与 17 仍不等，天然有效不动 |
| 5 | README.md | :23、:152-153、:158（枚举句补「tsc 类型检查」）、:343 共 4 处 16→17 |
| 6 | AGENTS.md | :45（§2 表）、:71（§3 注释）共 2 处 16→17 |
| 7 | CONTRIBUTING.md | :81、:165、:182 共 3 处 16→17 + 门禁表（:83-100）追加第 17 行（`npx tsc -p config/tsconfig.json`，期望退出码 0） |
| 8 | docs/troubleshooting.md | :28（FAQ 1.2）、:99（平台表）共 2 处 16→17 |

收尾验证：`npm run self-test` + `npx vitest run`。

### 批3 · 数字修正 + 门禁扩展（P1-1）— `feat(gate)`

1. **先改代码与测试**：
   - `check-docs-consistency.ts`：`REQUIRED_PATHS` += `CONTRIBUTING.md`、`.github/PULL_REQUEST_TEMPLATE.md`；input 组装处 read 注入 `contributing` / `prTemplate`
   - `docs-consistency-logic.ts`：`DocConsistencyInput` 加可选字段 `contributing?: string`、`prTemplate?: string`（注释：缺省跳过）；新增 `checkContributingVitestCount`（`vitestTestCount < 0` 或字段缺省跳过；存在性检查 + 两套 stale 正则逐处比对）与 `checkPrTemplatePrePushCount`（缺省跳过；模板内全部「(\d+) 项」表述须 == `EXPECTED.prePushCount`）；`runDocConsistencyChecks` 挂载两函数
   - `docs-consistency-logic.test.ts` 新增 ≥4 用例：两字段合法注入无违规 / contributing 含 40/623 报 vitest-tests 违规 / prTemplate 含 14 项报 pre-push 违规 / 两字段缺省跳过
2. **跑 `npx vitest run` 取实测用例总数 N**（预期 717 + 新增数）
3. **以 N 同步全部活体文档计数**（本仓活体文档机制：测试用例增删须同步文档）：
   - CONTRIBUTING.md:96（40/623 → 47 files / N tests）与 :214（47 个 .test.ts / N 条）
   - README.md:19、:158；AGENTS.md「47 个 .test.ts / 717 条」各处；pre-push:205 注释（47 test files / N tests）
   - `.github/PULL_REQUEST_TEMPLATE.md:13`「14 项通过」→「17 项通过」
   - `__tests__/README.md` 若声明用例总数则同步
4. 收尾验证：`npm run self-test` + `npx vitest run` + `npm run check:docs-consistency`

### 批4 · P2-1 警告强化 + P2-2 PR 模板强化 — `feat(hook)`（单 commit，含 PR 模板/troubleshooting 文档变更）

1. pre-push:56-61 纯 Windows 分支：黄警告（`\033[33m⚠`）升红（`\033[31m✗`）+ 明示「本次推送未执行 17 项门禁」+ 关键项提示（self-test / vitest / docs-consistency / tsc）+ 补跑命令（Git Bash 下 `npm run prepush`）；**保留 exit 0**；保持 printf 容错模式（`2>/dev/null || true`）
2. troubleshooting.md FAQ 1.1「现象」同步新警告文案（FAQ 已存在，无需新增——修正来源报告「增加该场景 FAQ」的假设）
3. PR 模板「校验要点」区块重构为可勾选清单：`npm run prepush` 17 项通过 / vitest 计数已同步（新增 .test.ts 时）/ 涉及规则 ID + 新增要求「附 `npm run prepush` 输出末尾摘要」

收尾验证：`npm run self-test` + `npx vitest run`。

### 批5 · 发布收尾 — `chore(release)`

1. `node scripts/version-bump.cjs 41.19.0`（六处同步 + CHANGELOG 节头自动插入）
2. 填 CHANGELOG 正文：六项修复逐条 + typecheck 门禁新增 + lock 可复现性说明
3. 终验：`npm run prepush`（17 项全绿）
4. commit `chore(release): 41.19.0 — 核查报告六项修复全量同步`

## 5. 验证策略

- 批2/批3/批4 每批收尾：`npm run self-test`（256）+ `npx vitest run`
- 批1 收尾：`git status` / `git ls-files` 复核（`.trae-html-share-packages` 为空、`package-lock.json` 已跟踪）+ npm audit 预检
- 批5：`npm run prepush` 全量 17 项（Windows 下经 bash 执行）
- 批3 附加：`npm run check:docs-consistency` 单跑确认

## 6. 提交与回滚策略

- 5 个独立 commit：`chore(repo)` → `feat(gate)` ×2 → `feat(hook)`（含文档变更）→ `chore(release)`
- **不自动 push**：全部完成后向用户汇报，由用户决定推送
- 回滚：每批可单独 `git revert`；批1 的 `git rm --cached` 可逆（`git restore --staged` + 重新 add）

## 7. 风险与前置检查

| 风险 | 处置 |
|---|---|
| R1 tsc 存量错误（README「0 错误」为 2026-08-18 手测值，可能过期） | 批2 第一步实跑验证；非 0 则先修类型错误，工作量届时汇报后再继续 |
| R2 lock 入库后依赖树解析变化导致 audit 新报 high 漏洞 | 批1 后预检；有则升级 devDeps 并回归 vitest，届时汇报 |
| R3 EXPECTED.prePushCount 变更后正向 fixture 遗漏同步 | vitest 全量兜底（docs-consistency-logic 78 条用例） |
| R4 PR 模板「N 项」正则误报 | 模板内仅一处计数表述，全等比对 + 负向用例覆盖 |
| R5 新增单测后用例总数 N 与文档同步遗漏 | 批3 步骤 2-3 强制「先实测 N 再同步」，check:docs-consistency 门禁兜底 |

## 8. DoD（完成标准）

1. `npx tsc -p config/tsconfig.json` 退出码 0，且作为 pre-push 第 17 项存在
2. 活体文档（README / AGENTS / CONTRIBUTING / troubleshooting / pre-push / PR 模板）门禁语境「16 项」零残留（CHANGELOG.md 历史条目如 :12/:65/:91、CHANGELOG-archive、decision-log、superpowers 历史规格/计划等历史/归档记录不计、不修改）
3. CONTRIBUTING.md 无「40 files / 623 tests」残留；PR 模板无「14 项」；全部活体文档 vitest 计数 == 实测 N
4. `git ls-files .trae-html-share-packages` 为空；`git ls-files package-lock.json` 非空；.gitignore 无 package-lock.json 行、含 `.trae-html-share-packages/`
5. docs-consistency 含 CONTRIBUTING/PR 模板两新检查 + ≥4 新单测；vitest 全绿
6. `npm run prepush` 17 项全绿
7. 版本六处一致 41.19.0；CHANGELOG 41.19.0 条目正文完整覆盖六项修复
8. 实施共 5 个 commit（不含本规格文档自身提交），未 push
