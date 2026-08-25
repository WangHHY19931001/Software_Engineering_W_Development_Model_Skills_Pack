# Task C1 报告：Persona 真实 CLI 回归

日期：2026-08-25
基线：`4e86554`
工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`

## 变更

- 在 `w-model-dev/scripts/__tests__/verifier-logic.test.ts` 保留既有 `checkVerifierOutput` 逻辑级回归，并增加真实独立 `tsx` 子进程回归：
  - `persona-code-reviewer.json`
  - `persona-test-engineer.json`
  - `persona-security-auditor.json`
  - `persona-performance-auditor.json`
- 每个 Persona CLI 用例执行 `check-verifier-output.ts --json <fixture>`，断言进程 exit 0、stderr 为空、stdout 可整体 `JSON.parse`、`type=verifier-output`、`passed=true`、`qualityLevel=A`、`reasons=[]`、`exitCode=0`。
- 增加 test-owned 临时目录负样本：从合法 `persona-code-reviewer.json` 变体加入阻断性 `[Critical]` `reworkHints` 并故意保留 `passed=true`。真实 CLI 断言 exit 1、`passed=false`、`qualityLevel=C`，且 `reasons` 含阻断性 hint 契约错误。
- `check-verifier-output.ts --json` 报告补充 `qualityLevel`；`JsonReport.qualityLevel` 为可选字段，保持其他 CLI 报告兼容。
- verifier logic 增加 Persona 既有严重级别契约的 fail-closed 校验：`[Critical]` / `[Required]` / `[High]` / `[Medium]`（以及 `Critical:` 等规范前缀）不得与 A/B 级放行结果并存；命中时报告阻断原因、按 C 级计算并要求 `passed=false`。不修改四个 Persona fixture 的语义或 Schema 字段。
- 未新增 fixture 或测试文件，因此不需要修改 `samples/README.md` 或 `check-samples-coverage` 登记；四个既有 fixture 的 samples 矩阵声明保持不变。

## TDD 记录

1. 先新增真实子进程测试，执行：

   ```text
   npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
   ```

   红灯结果：exit 1；`26 tests | 5 failed`。四个 CLI 正样本均暴露 `--json` 报告缺少 `qualityLevel`；负样本初始变体因既有逻辑未执行 Persona 阻断 hint 契约而错误返回 exit 0。该失败证明了真实 CLI 回归边界，不是测试拼写或启动错误。

2. 增加最小生产修复（JSON 报告的 `qualityLevel` 投影，以及阻断性 Persona hint 与 A/B 放行结果冲突时的 fail-closed 校验）。最终定向测试为 26/26 通过。

3. 最终定向测试结果见验证记录。

## CodeGraph / fallback

已尝试 CodeGraph 查询，服务返回：当前工作树向上没有 `.codegraph/` 索引，因此不可查询；未伪造 callers、callees 或 blast-radius 结果。

fallback 记录：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability/.w-model/codegraph-queries/2026-08-25-C1-verifier-cli.md`（不提交）。

fallback 方法：读取 `verifier-logic.test.ts`、`check-verifier-output.ts`、四个 Persona fixture、`run-sync.ts`、`gate-report.ts`、Verifier Schema 和 samples 覆盖约定；用 `rg` 追踪 `runSync`/`tsx` 子进程模式、`checkVerifierOutput` 调用链、`reworkHints`/`qualityLevel`/`--json` 输出协议及既有 fixture 注册。

## 真实验证命令与结果

以下命令均从工作树根目录执行；未运行无界全量测试、TLC 或 SANY。

1. 定向 Vitest：

   ```text
   npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
   ```

   结果：exit 0；`1 passed` test file，`26 passed` tests，0 failed。输出确认四个真实 CLI 子进程用例和阻断 hint 负样本均通过。

2. TypeScript：

   ```text
   npm run typecheck
   ```

   结果：exit 0；`tsc -p config/tsconfig.json` 无错误。

3. 目标文件 Prettier：

   ```text
   npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/lib/types.ts w-model-dev/scripts/logic/verifier-logic.ts
   ```

   结果：exit 0；`All matched files use Prettier code style!`。

4. Diff 空白：

   ```text
   git diff --check
   ```

   结果：exit 0。工作树中已有 `progress.md` 的 LF/CRLF warning 未形成 diff-check violation，且该文件未纳入提交。

## Concerns

- 阻断 hint 识别复用 Persona 文档已有的 `[Critical]` / `[Required]` / `[High]` / `[Medium]` 与 `Critical:` 等前缀；普通未标级别的 `reworkHints` 不新增前缀门禁。
- `--json` 现在额外暴露 `qualityLevel`，字段为通用报告类型的可选属性，不改变其他门禁的输出形状或 exit 0/1/2 语义。
- CodeGraph 索引缺失是环境现状；已用并记录 fallback，未把 fallback 当成真实 CodeGraph 结果。
- 未提交 `.w-model` fallback 查询、运行时状态或既有 `.superpowers/sdd/w-model-reliability-optimization/progress.md` 改动。

## 提交范围

仅提交 C1 测试、verifier CLI/logic 为使真实回归成立所需的最小修复，以及本报告；不提交 `progress.md`、`.w-model` 或无关格式化变更。

---

# C1 修复轮 1（接管）

日期：2026-08-25
基线：`38aab70`
提交消息：`fix(verifier): preserve severity and quality semantics`（最终 commit hash 以 `git log -1` 为准）

## 根因与修复

- **I1**：上一轮将 `[Medium]` / `Medium:` 与 `[High]` / `High:` 无条件视为通用阻断，混淆了不同 Persona 的局部严重度规则。按 `verifier-spec.md §7.4A.2` 的统一字符串契约，通用校验器现在只识别显式 `Critical` / `Required`（支持 `[Critical]`、`Critical:`、`[Required]`、`Required:`，大小写不敏感）；`Medium` 保持非阻断。
- **I2**：阻断 hint 不再改写 `qualityLevel`。等级始终由 evidence 扣分后的 `compositeScore` 映射；阻断 hint 独立将 `expectedPassed` 置为 false，并追加包含 `reworkHints[index]`、严重度与规范引用的结构化原因。这样 A 分 + 阻断会 exit 1，A 分 + Medium 会保持通过，原 `passed=false` 仍不会被放行。
- **I3**：真实子进程回归补齐默认模式协议，以及缺失文件 / malformed JSON 的 `ERROR_JSON` + exit 2；保留四个 Persona fixture 的真实 `--json` exit 0 覆盖。

Persona 规则未修改。`agent-personas.md` 中 test/security/performance Persona 的 High/Medium 局部行动语义不被提升为全局 checker 规则；若需按特定 Persona 阻断，应由该 Persona 产出统一的 `Critical` / `Required` 前缀。

## TDD 记录

1. 先新增 I1/I2/I3 失败测试；红灯真实结果：`34 tests | 6 failed`。失败集中在四种显式阻断格式、Medium 非阻断和原 `passed=false` 的等级保留，证明测试命中了上一轮实现的真实缺陷；默认模式与 exit 2 测试当时已通过。
2. 最小实现：收窄 `BLOCKING_REWORK_HINT_PATTERN` 到 `Critical|Required`；不再给 `qualityLevel` 赋值；以 `hasBlockingReworkHint` 独立参与 `expectedPassed` 并追加索引化原因。
3. 绿灯结果：`1 passed` test file，`34 passed` tests，0 failed。

## 真实验证记录

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts`：exit 0；34/34 通过。
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`：exit 0；`fixtureCount=280`、`unregistered=0`、`undeclaredDirs=0`。
- `npm run check-samples-coverage`：exit 1，因为当前 `package.json` 未登记该 npm script；已使用仓库现有 CLI 入口执行等价检查并通过。
- `npm run typecheck`：exit 0；`tsc -p config/tsconfig.json` 无错误。
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/logic/verifier-logic.ts`：exit 0；`All matched files use Prettier code style!`。
- `git diff --check`：exit 0；仅有既存 `progress.md` / 报告文件的 CRLF 提示，无 whitespace violation。

## CodeGraph / fallback

当前工作树仍无 `.codegraph/` 索引，未伪造 CodeGraph 结果；沿用上一轮已落盘但不提交的 fallback 记录：
`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability/.w-model/codegraph-queries/2026-08-25-C1-verifier-cli.md`。

## Concerns

- `qualityLevel` 在阻断 hint 场景仍可能为 A/B，这是有意保持的 score-derived 事实；`passed=false` 与 exit 1 才表达放行阻断，不伪造 C/D 等级。
- 本轮不修改 Persona 文档、四个 fixture、samples 矩阵、`progress.md` 或 `.w-model`。

---

# C1 修复轮 2：隔离原始失败回归

日期：2026-08-25
基线：`87118d9`
工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
提交消息：`test(verifier): isolate original failure regression`

## 复审结论与变更

- 定向复审发现原测试 `verifier-logic.test.ts:141-160` 从合法 A 分 fixture 注入 `[Critical]` 后再设置 `passed=false`。该样本的 exit 1 可由阻断 hint 触发，不能独立证明“无阻断 hint、A 分、原始 passed=false”路径被拒绝。
- 将该用例改为删除 `reworkHints`、保留合法 A 分子标准与分数、仅设置 `passed=false`，并保留真实 `check-verifier-output.ts --json` 子进程断言：进程 exit 1、报告 `passed=false`、`qualityLevel=A`、`exitCode=1`。
- 增加 reasons 精确约束：必须包含 `passed false 与 qualityLevel A 不一致`，且不得包含 `reworkHints`，从而证明失败来自原始 `passed=false` 契约，而非阻断 hint。
- 更新 `w-model-dev/scripts/__tests__/README.md`：qualityLevel 仍 score-derived；阻断性 reworkHints 单独强制 `passed=false/exit 1` 且不改写等级；同时登记无阻断原始 `passed=false` 的 CLI 负样本。
- 未修改 Persona 规则、生产 verifier 实现、四个 fixture、samples fixture 矩阵、`progress.md` 或 `.w-model`。

## TDD 记录

1. **红灯前基线**：在修改断言前，现有 34 个定向测试全通过；原用例仍使用 `[Critical]`，因此缺口未被暴露。
2. **红灯**：先删除阻断 hint、保留 `passed=false`，并加入“reasons 为空”的临时诊断断言，执行：

   ```text
   npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts -t '合法 A 分、无阻断 hint 的原始 passed=false'
   ```

   结果：exit 1；`1 failed | 33 skipped`。真实 CLI 返回 reasons：`["passed false 与 qualityLevel A 不一致（应 = true）"]`。失败原因正是当前契约拒绝原始 `passed=false`，且没有 `reworkHints` 原因，证明测试覆盖了目标路径。

3. **绿灯**：将临时断言改为要求该精确 passed/qualityLevel 原因，并断言 reasons 不含 `reworkHints`；未修改生产实现。

## 真实验证命令与结果

1. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts`

   结果：exit 0；`1 passed` test file，`34 passed` tests，0 failed。输出包含四个 Persona 的真实 CLI exit 0 回归、阻断 hint exit 1 回归，以及本轮无阻断原始 `passed=false` 的 exit 1/reasons 回归。

2. `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`

   结果：exit 0；`SAMPLES_COVERAGE_JSON {"fixtureCount":280,"referencedFiles":242,"referencedDirs":15,"unregistered":0,"undeclaredDirs":0,"exitCode":0}`。

3. `npm run typecheck`

   结果：exit 0；执行 `tsc -p config/tsconfig.json`，无 TypeScript 错误。

4. `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/verifier-logic.test.ts .superpowers/sdd/w-model-reliability-optimization/task-C1-report.md`

   结果：exit 0；`All matched files use Prettier code style!`。README 仅做单行矩阵登记，未纳入目标格式化文件，避免无关重排。

5. `git diff --check`

   结果：exit 0；仅报告既有 `progress.md` 的换行转换提示，未发现 diff 空白错误。

## CodeGraph / fallback

当前工作树无 `.codegraph/` 索引；已尝试 `mcp__codegraph__codegraph_explore`，服务返回未找到索引，因此未伪造 CodeGraph 结果。本轮仅修改测试、测试矩阵与报告，不涉及阶段 5-8 代码修改前门禁要求；沿用既有 fallback 记录：
`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.w-model/codegraph-queries/2026-08-25-C1-verifier-cli.md`（不提交）。

## Concerns

- 本轮验证的 exit 1 由 `passed=false` 与 score-derived `qualityLevel=A` 不一致触发；`reworkHints` 未提供，故不会把阻断 hint 当作原因。
- 原生产契约保持不变：A/B 且无 R13 单轴违规时，`passed` 必须为 true；显式 `Critical`/`Required` hint 则独立强制失败，但 qualityLevel 仍由分数映射。
- `npx tsx ... check-samples-coverage.ts` 是本仓库现有 CLI 入口；此前 `npm run check-samples-coverage` 未登记脚本，故不作为本轮命令。
- 不提交 `.w-model` fallback 查询、运行时状态或既有 `.superpowers/sdd/w-model-reliability-optimization/progress.md` 改动。
