# Task C3 报告：拆分仓库验证与 Skill 安装路径

## 结果

- 已在 `README.md` 首屏拆分「验证仓库」与「安装 Skill」两个独立入口。
- 仓库验证入口披露 Node.js ≥20、Git、npm registry/网络、仓库根目录执行要求，并使用仓库 remote 对应的 canonical URL：`https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack.git`。
- PowerShell 5.1 示例严格使用两行和分号，不依赖 `&&`；`self-test` / `doctor` 不要求 Git Bash，Bash 仅用于 `pre-push` 与平台依赖检查。
- 明确 `npm install` 的 `postinstall` 运行 `scripts/setup-hooks.cjs` 并设置本地 `core.hooksPath=.githooks`；该副作用不是 Agent Skill 激活必需。
- 明确 `pre-push` 不自动安装或修复平台依赖；`platform-deps:check` 只检查，`platform-deps:install` 当前 fail-closed 并指引人工 `npm install`。
- 明确 Windows 与 WSL 不在同一 checkout 混用 `node_modules`，并将 Skill 复制路径改为 Agent-specific placeholder；不把 `.agent` 当通用路径，不伪造无法验证的 Agent canonical URL。
- `docs/INSTALL.md`、`docs/adoption-guide.md`、`AGENTS.md`、`CONTRIBUTING.md`、`CHANGELOG.md` 已同步入口、平台边界和贡献者/普通用户职责。

## TDD 与 codegraph 替代记录

- 先在 `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 增加按文档路径读取的 C3 契约负例测试；旧文档首次运行按预期红灯。
- 文档更新后同一测试绿灯，未新增测试用例数量：最终该文件 `112/112`，全量仍为 `52 files / 853 tests`。
- 本任务只修改文档和文档测试，按 C3 简报允许不调用 codegraph；以仓库现有索引/文件路径逐项读取作为无索引替代，并通过 `git diff --name-only` 检查禁止范围。未修改实现逻辑、hook、package、schema、baseline、计划或规格。

## 验证

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts --reporter=dot`：`1 file / 112 tests passed`。
- `npm run check:docs-consistency`：通过，`schema=21`、`exit-2 scripts=33`、`persona=28`、`test files=52`、`vitest=853`，`violationCount=0`。
- `npm test`：`52 files / 853 tests passed`。
- `npm run typecheck`：通过。
- `npm run lint:security`：通过，`新增发现数=0`，未修改 baseline。
- `npm run self-test`：通过，全部样本匹配期望。
- `npm run prepush`：通过全部 17 项门禁，包括 npm audit、文档一致性、samples 覆盖、Prettier 与 typecheck。

## 提交

提交信息：`docs: separate repository verification from skill installation`
