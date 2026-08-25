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
