# D1 任务报告：统一 CLI 自然退出

- 基线：`f69dae8`
- 修复轮 3 代码提交：`48a0568ef27e7355391b2ed79bd7e0da99bbd69c`（`test(cli): tighten fixture isolation evidence`）
- 修复轮 2 代码提交：`45aa48ad8b56df22aa6f5be7b6125af2f568ce2b`（`test(cli): isolate self test fixtures`）
- 修复轮 2 文档记录提交：`52dd499078ec8199ef64a216fb205ca535f6da4f`（`docs(cli): record fixture isolation`）
- 修复轮 2 最终 SHA 回填提交：`c145615093575fec0ac08eaa6ae658686ad8528f`（`docs(cli): finalize fixture isolation report`；D1 报告端点）
- 修复轮 1 代码提交：`46667b28a4b3f9983047af6dc2d834453cf84878`（`test(cli): cover natural exit states`）
- 修复轮 1 文档更正提交：`0d8e305a831d7a4c5b57c107d430e36c730e48c0`（`docs(cli): correct natural exit coverage report`）
- 原始实现提交：`2c3ddd2cbb73ec382d161bdb9c7301a0a93fcec3`（`refactor(cli): use natural process exit`）

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
- 修复轮 2 移除 tracked `samples/verifier/valid.json` 写入：self-test 增加仅测试使用的 `WM_SELF_TEST_SAMPLES_DIR` seam；测试复制完整 samples 到 `mkdtemp` 临时根，仅修改临时副本后运行真实子进程，生产默认路径不变。
- 修复轮 3 将共享 fixture 证据升级为 SHA-256 原始字节前后精确相等，而非仅检查 `"passed": true` 子串，能检测任意共享 fixture 字节变化。

## CodeGraph / fallback

已尝试对工作树执行 CodeGraph 查询，但工作树及其上级目录没有 `.codegraph/` 索引，工具返回 `no .codegraph/ directory found`，因此未伪造图谱结果，改用 fallback 静态影响分析。分析文件：

- `.w-model/codegraph-queries/2026-08-25-D1-cli-exit.md`

该分析追踪了五个入口的 `runMain/main` 调用、`exitWithError` 参数错误分支、输出路径及 exit 0/1/2 兼容边界。`.w-model` 为本地运行时产物，不纳入提交。

## TDD 证据

先将 D1 测试置于基线直接退出实现上运行，静态契约测试按预期红灯，发现 10 个直接退出位置，随后恢复实现并完成绿灯。修复轮 1 又将 self-test aggregate failure 的期望暂写为 exit 0，真实子进程按预期以 exit 1 红灯；恢复为 exit 1 后证明失败路径可注入且测试有效。修复轮 2 先改测试使用临时 samples 根，因生产代码尚未读取 seam 而以 exit 0 红灯；增加最小环境变量 seam 后转绿。红灯均来自契约/实现差异，不是测试解析错误。

## 真实验证输出

- `npm exec vitest -- run w-model-dev/scripts/__tests__/cli-natural-exit.test.ts w-model-dev/scripts/__tests__/gate-report.test.ts --config config/vitest.config.ts --reporter=dot`
  - 修复轮 2 最终结果：2 个 test files，47 个 tests 全部通过（含 test-owned samples 驱动的 self-test aggregate failure exit 1 真实子进程）。
  - 覆盖矩阵：metrics-report 0/2；wm-status 0/2；security-scan 0/1/2；ensure-codegraph 0/1/2；self-test 0/1。
  - 另有静态断言确认 metrics-report/wm-status 没有 `process.exitCode=1` 结果分支。
- `npm run typecheck` 的时点化证据：
  - 历史工作树运行（修复轮 1）：退出码 2；当时未暂存的 `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts` 引入 `os` 与 `LOGIC_DIRECT_IO_MODULES` 未使用（TS6133）。该失败保留为历史记录，不归因于 D1。
  - D1 报告端点独立运行：在 detached worktree 的 `c145615093575fec0ac08eaa6ae658686ad8528f` 上仅叠加修复轮 3 的 D1 测试补丁后，`npm run typecheck` 退出码 0。该端点不含后续 D2/architecture 提交，是 D1 endpoint 的真实类型检查证据。
  - 修复轮 3 当前 HEAD：`48a0568ef27e7355391b2ed79bd7e0da99bbd69c` 上 `npm run typecheck` 退出码 0；该命令仅作为后续集成状态记录，不替代上述 D1 endpoint 证据。
- `npm exec prettier -- --config config/prettier.config.cjs --check <D1 files>`
  - 通过：所有目标文件符合格式。
- `git diff --check`
  - 通过：无 diff 空白错误。

## Concerns / 边界

- CodeGraph 当前不可用，仅完成 fallback 影响分析；后续若工作树建立 `.codegraph` 索引，可补跑同一查询作为增强证据。
- self-test 的未预期异常 `main().catch(...)` 路径没有专用注入点；本轮未虚构该状态覆盖，报告仅记录真实 aggregate failure exit 1。catch 仍设置 exit 1 并保留 stderr，但未作为真实子进程证据宣称覆盖。
- 修复轮 2 明确禁止测试写入共享 tracked fixture：测试只写 `mkdtemp` 下的 samples 副本。修复轮 3 改为对共享 `samples/verifier/valid.json` 在子进程前后计算 SHA-256 并精确比较，消除子串检查的漏检风险。
- `c145615...` 是 D1 报告端点；当前 HEAD 可能含后续工作，因此 D1 结论以 detached endpoint 证据为准，当前 HEAD 结果仅作集成记录。
- 未运行无界全量 Vitest、self-test 全量命令或 pre-push，符合 D1 简报要求的定向验证范围。
- 未修改 `.superpowers/.../progress.md` 或 `.w-model`；提交仅包含 D1 代码、测试、契约文档和本报告。
