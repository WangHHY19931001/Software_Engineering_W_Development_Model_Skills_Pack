# B3 报告：统一同步子进程边界

状态：DONE_WITH_CONCERNS

## 变更

- `w-model-dev/scripts/lib/run-sync.ts`
  - 保留并强化 `runSync()` 的集中边界：正的有限 timeout、`SIGKILL`、`utf-8`、有限 `maxBuffer`。
  - 保留迁移调用的 `SYNC_PROCESS_EXCEPTIONS` 审计 provenance，不删除条目；迁移项标记 `migratedToRunSync`，并更新到实际调用行。
- `w-model-dev/scripts/cli/check-docs-consistency.ts`
  - `git diff --name-only HEAD`、`git status --porcelain`、`git rev-parse HEAD` 与 Vitest 子进程统一使用 `runSync()`。
  - Git 探针固定 15s；Vitest 保持 300s 长 timeout 与 64 MiB buffer；Git 失败仍按原逻辑保守返回，不抛未处理异常。
- `w-model-dev/scripts/cli/check-tla-model.ts`
  - Java 环境探针统一使用 `runSync()` 与 `EXEC_LIMITS.shortTimeoutMs`。
  - 环境错误、timeout/error、非零退出和不可解析版本均映射到既有环境错误语义；修复预检非零退出但输出可解析时可能误放行的问题。
  - SANY/TLC 保持直接 `execFileSync` 的集中长 timeout、`SIGKILL`、`utf-8` 与有限 buffer，不改长 timeout。
- `w-model-dev/scripts/cli/security-scan.ts`
  - ESLint 使用 `runSync()`，固定 300s timeout 与既有 10 MiB maxBuffer。
  - `r.error`、无输出非零退出均保持可观察并映射为 exit 2；JSON 解析与扫描 exit 0/1 协议不变。
- `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`
  - 补齐现有直接 `execFileSync` 调用的固定 timeout、`SIGKILL`、`utf-8` 与 16 MiB maxBuffer，保持原有 try/catch 返回和日志语义。
- `w-model-dev/scripts/__tests__/run-sync.test.ts`
  - 增加非零退出/error 可观察性、三处迁移调用静态安全边界、所有生产直接同步调用的 options 审计、无 `missing-followup`、迁移 provenance 行号准确性断言。
  - 既有 timeout、killSignal、encoding、maxBuffer 和真实慢子进程测试保持通过。

CodeGraph 影响分析：先查询，工作树无 `.codegraph/` 索引，查询返回 unavailable；复用并核对已有 ignored 记录 `.w-model/codegraph-queries/2026-08-25-B3-run-sync.md`，以 `rg`、import/call-site 分析替代，未伪造 CodeGraph 结果。

## 测试与真实输出

### TDD 红灯记录

1. 新增迁移/审计断言后首次运行：
   - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts`
   - 结果：失败，1/17；首先暴露 `SYNC_PROCESS_EXCEPTIONS` 中 stale 行号（期望 194，实际 AST 调用 193）。
2. 增加 direct-call 完整 options 断言后：
   - 同命令
   - 结果：失败，2/18；暴露 `ensure-codegraph-opsx.ts` 直接调用缺少 `killSignal`/`encoding`/`maxBuffer`，以及旧 provenance 行号不准确。
3. 增加 Java 预检非零退出断言后：
   - 同命令
   - 结果：失败，1/18；暴露预检只用 `error || parsed major` 判断、未拒绝非零 status。
4. 增加 security runner error 断言后：
   - 同命令
   - 结果：失败，1/18；暴露 `r.error` 未纳入 ESLint 执行失败分支。

以上红灯均为预期功能缺口或真实审计 provenance 不一致，随后以最小生产修复转绿。

### 最终通过验证

1. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/security-scan.test.ts`
   - `Test Files 2 passed (2)`
   - `Tests 25 passed (25)`
   - Duration 1.70s
2. `npm run typecheck`
   - 输出：`> tsc -p config/tsconfig.json`
   - 退出码 0
3. `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/lib/run-sync.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/cli/ensure-codegraph-opsx.ts w-model-dev/scripts/cli/security-scan.ts`
   - 输出：`All matched files use Prettier code style!`
   - 退出码 0
4. `git diff --check`
   - 退出码 0；仅输出既有 `progress.md` 的 LF/CRLF warning
5. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
   - 结果：`150 passed, 7 failed`，退出码 1，耗时约 188.94s。
   - 失败原因不是 B3 过程边界测试：fixture 复制的活体文档/脚本登记与当前 checkout 已有漂移，报告包含 `platform-deps-install` 未登记、SKILL 脚本计数漂移、fixture 中该探针 ERROR_JSON 缺 rule 等；这些属于既有 B2/D4 文档/登记状态，不修改范围外文件。该测试未重新运行 TLC，且没有 B3 相关断言失败证据。

未运行 TLC、无界全量测试或联网命令。

## 疑虑

- `progress.md` 是接管时已有未提交差异，未修改、未暂存、未提交。
- `.w-model/codegraph-queries/` 为 ignored 生成物，未提交；已有 B3 记录被复用并核对。
- docs-consistency 大型 fixture 回归仍受上述既有文档/脚本登记漂移阻断，因此整体 B3 状态标记 `DONE_WITH_CONCERNS`；B3 定向 run-sync/security 测试、typecheck、Prettier、diff-check 均通过。

## B3 修复轮（接管后）

状态：DONE_WITH_CONCERNS

### 审查发现

- B3 初始提交 `8315c52` 已完成三个生产迁移调用点的边界实现，但缺少运行时错误/超时测试：`detectScriptsChanges` 的 Git 探针、`checkEnvironment` 的 Java 探针，以及 security-scan 的 ESLint runner。
- `sync-boundary-runtime.test.ts` 在当前工作树不存在；未重复创建文件，运行时断言补入既有 `w-model-dev/scripts/__tests__/run-sync.test.ts`，避免拆散既有 `runSync` 审计测试。
- 严格类型检查另外发现新增测试辅助函数的 spy 参数隐式 `any` 与 `process.exitCode` 类型不完整；已仅修正测试类型声明，不改变生产逻辑。

### 修复与覆盖确认

现有测试现在明确覆盖并通过以下 9 类运行时场景：

1. `detectScriptsChanges`：Git `git diff`/`git status` timeout/error 保守返回 `false`。
2. `detectScriptsChanges`：Git 非零退出即使带输出也不误判为脚本变更，返回 `false`。
3. `checkEnvironment`：Java timeout 映射为 `EnvironmentStatus.errors`。
4. `checkEnvironment`：Java 执行 error 映射为 `EnvironmentStatus.errors`。
5. `checkEnvironment`：Java 非零退出映射为包含退出码的 `EnvironmentStatus.errors`。
6. security-scan：runner `r.error` 使用既有 exit 2 / `FILE_READ` / `P0-3` 语义。
7. security-scan：无 stdout 的非零 runner 结果使用既有 exit 2 语义。
8. security-scan：runner 输出不可解析 JSON 使用既有 exit 2 / `FILE_PARSE` / `P0-3` 语义。
9. 所有上述调用继续断言进程边界参数（timeout、`SIGKILL`、UTF-8、有限 `maxBuffer`），并由集中审计确认无 `missing-followup`。

### 修复轮真实验证输出

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/security-scan.test.ts`
  - `Test Files 2 passed (2)`
  - `Tests 25 passed (25)`
  - Duration `1.81s`
- `npm run typecheck`
  - `tsc -p config/tsconfig.json`
  - exit `0`
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/lib/run-sync.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/cli/security-scan.ts`
  - `All matched files use Prettier code style!`
  - exit `0`
- `git diff --check`
  - exit `0`
  - 仅报告既有 `progress.md` 的 LF/CRLF warning，未发现 whitespace error。

### docs-consistency 基线隔离与遗留 Minor

- detached baseline `c82eff2` worktree `/tmp/wm-b3-baseline-xiGAKA`：既有同条件实测为 exit `1`，`150 passed / 7 failed`。
- 旧记录曾将 B3 HEAD 写成“沿用既有有限核对结果”且声明本轮未重跑；该表述已由下方“修复轮 2”真实实测纠正。
- 7 项共同失败集中在既有登记漂移而非 B3 边界行为：`platform-deps-install` 未登记、`SKILL.md` 脚本计数 `36` 与实测 `37` 不一致、probe 的 `ERROR_JSON` 缺少 `rule`。这些属于基线隔离的 Minor，未修改范围外文档/状态文件。
- 未运行 TLC、全量无界测试或联网命令。`progress.md` 的既有未提交改动未触碰、未暂存、未提交；`.w-model` ignored 证据未提交。

## B3 修复轮 2（报告证据纠正）

状态：DONE_WITH_CONCERNS

### 同条件实测

- 基线：detached baseline `c82eff2`（`/tmp/wm-b3-baseline-xiGAKA`），先前同条件实测为 exit `1`，`150 passed / 7 failed`。
- B3 HEAD：`8a755ad`，本轮仅运行一次与上述基线相同的有限定向命令：
  - 命令：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
  - 实际退出码：`1`
  - 实际摘要：`Test Files 1 failed (1)`；`Tests 7 failed | 150 passed (157)`；耗时 `178.38s`（测试耗时 `177.96s`）。
  - 运行输出同时显示：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts (157 tests | 7 failed)`。
- 与 baseline 的差异：passed `0`、failed `0`，本轮 B3 HEAD 实测为 `150 passed / 7 failed`，与 baseline 完全相同。

### 失败分类与归因边界

- 共同既有漂移（7 项）：本次输出中的 7 项失败均为 baseline 已有的文档/登记漂移，具体包括 `platform-deps-install` 未登记、`SKILL.md` 声明 `36` 个 `.ts` 而实际为 `37`，以及该探针原始 `ERROR_JSON` 缺少 `rule`；本次运行观察到的这些失败无法归因 B3。
- 额外观察：上一轮独立复审曾得到 B3 HEAD `149 passed / 8 failed`，第 8 项为外部 artifact 测试超时；该 nondeterministic 现象仅在此前运行中观察到，并明确记录为“本次运行观察到，无法归因 B3”（“本次”指观察到该额外超时的那次运行）。本次修复轮 2 的同条件运行没有观察到该额外超时，故不把它计入本轮 HEAD 结果，也不修改范围外 docs。
- 本轮未改变 B3 代码范围，未修改范围外文档、`progress.md` 或 `.w-model`。
