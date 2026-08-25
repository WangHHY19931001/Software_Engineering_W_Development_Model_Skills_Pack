# D1 任务报告：统一 CLI 自然退出

- 基线：`f69dae8`
- 目标提交：`refactor(cli): use natural process exit`

## 完成内容

- 将生产 CLI 入口中的结果路径从直接 `process.exit(...)` 改为 `process.exitCode = ...` 后自然返回/结束：
  - `w-model-dev/scripts/cli/metrics-report.ts`
  - `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`
  - `w-model-dev/scripts/cli/security-scan.ts`
  - `w-model-dev/scripts/cli/wm-status.ts`
  - `w-model-dev/scripts/cli/self-test.ts`
- 保留 `exitWithError(...)` 的参数/输入错误语义：exit 2、stderr 人类消息、stdout `ERROR_JSON`。
- 增加生产 CLI AST 静态契约测试，扫描范围仅为 `w-model-dev/scripts/cli`，不扫描测试工具、fixtures、samples；测试/fixture 中必要的 `process.exit` 不会被误报。
- 增加真实子进程 exit 0/1/2 覆盖，涵盖 metrics、security、wm-status、ensure-codegraph、self-test 的代表路径；ensure 测试包含 Windows 命令模拟兼容处理。
- 更新 D2 命令契约文档及既有 gate-report 契约测试，登记迁移后的自然退出约束。

## CodeGraph / fallback

已尝试对工作树执行 CodeGraph 查询，但工作树及其上级目录没有 `.codegraph/` 索引，工具返回 `no .codegraph/ directory found`，因此未伪造图谱结果，改用 fallback 静态影响分析。分析文件：

- `.w-model/codegraph-queries/2026-08-25-D1-cli-exit.md`

该分析追踪了五个入口的 `runMain/main` 调用、`exitWithError` 参数错误分支、输出路径及 exit 0/1/2 兼容边界。`.w-model` 为本地运行时产物，不纳入提交。

## TDD 证据

先将 D1 测试置于基线直接退出实现上运行，静态契约测试按预期红灯，发现 10 个直接退出位置，随后恢复实现并完成绿灯。红灯根因是被测生产 CLI 尚未迁移，而非测试解析错误。

## 真实验证输出

- `npm exec vitest -- run w-model-dev/scripts/__tests__/cli-natural-exit.test.ts w-model-dev/scripts/__tests__/gate-report.test.ts --config config/vitest.config.ts --reporter=dot`
  - 通过：2 个 test files，45 个 tests。
  - 覆盖：静态禁止直接退出、metrics/security/wm-status/ensure-codegraph/self-test 子进程 exit 0/1/2 代表路径。
- `npm run typecheck`
  - 通过：`tsc -p config/tsconfig.json`。
- `npm exec prettier -- --config config/prettier.config.cjs --check <D1 files>`
  - 通过：所有目标文件符合格式。
- `git diff --check`
  - 通过：无 diff 空白错误。

## Concerns / 边界

- CodeGraph 当前不可用，仅完成 fallback 影响分析；后续若工作树建立 `.codegraph` 索引，可补跑同一查询作为增强证据。
- 未运行无界全量 Vitest、self-test 全量命令或 pre-push，符合 D1 简报要求的定向验证范围。
- 未修改 `.superpowers/.../progress.md` 或 `.w-model`；提交仅包含 D1 代码、测试、契约文档和本报告。
