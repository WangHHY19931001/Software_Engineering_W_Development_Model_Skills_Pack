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
