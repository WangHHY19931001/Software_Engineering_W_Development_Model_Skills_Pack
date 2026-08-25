# D1 任务报告：统一 CLI 自然退出

- 基线：`f69dae8`
- 修复轮 1 提交：`46667b2`（`test(cli): cover natural exit states`）
- 原始实现提交：`2c3ddd2`（`refactor(cli): use natural process exit`）

## 完成内容

- 将生产 CLI 入口中的结果路径从直接 `process.exit(...)` 改为 `process.exitCode = ...` 后自然返回/结束：
  - `w-model-dev/scripts/cli/metrics-report.ts`
  - `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`
  - `w-model-dev/scripts/cli/security-scan.ts`
  - `w-model-dev/scripts/cli/wm-status.ts`
  - `w-model-dev/scripts/cli/self-test.ts`
- 保留 `exitWithError(...)` 的参数/输入错误语义：exit 2、stderr 人类消息、stdout `ERROR_JSON`。
- 增加生产 CLI AST 静态契约测试，扫描范围仅为 `w-model-dev/scripts/cli`，不扫描测试工具、fixtures、samples；测试/fixture 中必要的 `process.exit` 不会被误报。
- 增加真实子进程退出状态覆盖，并按每个 runner 的实际契约区分状态：metrics-report 与 wm-status 覆盖 0/2（无 exit 1 结果分支）；security-scan 与 ensure-codegraph 覆盖 0/1/2；self-test 覆盖 aggregate 0/1。ensure 测试包含 Windows 命令模拟兼容处理。
- 更新 D2 命令契约文档及既有 gate-report 契约测试，登记迁移后的自然退出约束。

## CodeGraph / fallback

已尝试对工作树执行 CodeGraph 查询，但工作树及其上级目录没有 `.codegraph/` 索引，工具返回 `no .codegraph/ directory found`，因此未伪造图谱结果，改用 fallback 静态影响分析。分析文件：

- `.w-model/codegraph-queries/2026-08-25-D1-cli-exit.md`

该分析追踪了五个入口的 `runMain/main` 调用、`exitWithError` 参数错误分支、输出路径及 exit 0/1/2 兼容边界。`.w-model` 为本地运行时产物，不纳入提交。

## TDD 证据

先将 D1 测试置于基线直接退出实现上运行，静态契约测试按预期红灯，发现 10 个直接退出位置，随后恢复实现并完成绿灯。修复轮 1 又将 self-test aggregate failure 的期望暂写为 exit 0，真实子进程按预期以 exit 1 红灯；恢复为 exit 1 后证明失败路径可注入且测试有效。红灯均来自契约/实现差异，不是测试解析错误。

## 真实验证输出

- `npm exec vitest -- run w-model-dev/scripts/__tests__/cli-natural-exit.test.ts w-model-dev/scripts/__tests__/gate-report.test.ts --config config/vitest.config.ts --reporter=dot`
  - 修复轮 1 目标：2 个 test files，47 个 tests（含 self-test aggregate failure exit 1 真实子进程）。
  - 覆盖矩阵：metrics-report 0/2；wm-status 0/2；security-scan 0/1/2；ensure-codegraph 0/1/2；self-test 0/1。
  - 另有静态断言确认 metrics-report/wm-status 没有 `process.exitCode=1` 结果分支。
- `npm run typecheck`
  - 未通过：退出码 2；失败来自本轮之外的未暂存改动 `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`，其中 `os` 与 `LOGIC_DIRECT_IO_MODULES` 未使用（TS6133）。本轮未修改或提交该文件。
- `npm exec prettier -- --config config/prettier.config.cjs --check <D1 files>`
  - 通过：所有目标文件符合格式。
- `git diff --check`
  - 通过：无 diff 空白错误。

## Concerns / 边界

- CodeGraph 当前不可用，仅完成 fallback 影响分析；后续若工作树建立 `.codegraph` 索引，可补跑同一查询作为增强证据。
- self-test 的未预期异常 `main().catch(...)` 路径没有专用注入点；本轮未虚构该状态覆盖，报告仅记录真实 aggregate failure exit 1。catch 仍设置 exit 1 并保留 stderr，但未作为真实子进程证据宣称覆盖。
- 未运行无界全量 Vitest、self-test 全量命令或 pre-push，符合 D1 简报要求的定向验证范围。
- 未修改 `.superpowers/.../progress.md` 或 `.w-model`；提交仅包含 D1 代码、测试、契约文档和本报告。
