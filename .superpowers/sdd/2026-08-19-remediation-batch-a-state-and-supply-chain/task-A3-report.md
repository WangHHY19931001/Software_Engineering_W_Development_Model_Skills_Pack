# A3 完成报告

## 实施范围

- `.githooks/ensure-platform-deps.sh`
  - 默认和 `--check` 仅做探测；缺失依赖时退出 1，并提示 `npm run platform-deps:install`。
  - 仅识别 `--check` 和 `--install`；未知参数退出 2。
  - 未覆盖平台、Node 不可用、或 esbuild/rolldown 主包缺失均 fail closed。
  - 删除自动 `npm install`、`npm pack`、`tar`、解包和 node_modules 覆盖行为。
  - `--install` 保留为显式、安全的 fail-closed 入口，提示人工 `npm install`。
- `.githooks/pre-push`
  - node_modules 缺失时退出 1 并提示 `npm install`，不再自行安装。
  - 仅调用 `ensure-platform-deps.sh --check`。
  - `needs_gate` 增加 `config/**`、根 `scripts/**` 和 `package-lock.json`。
- `package.json`
  - 添加 `platform-deps:check` 与 `platform-deps:install` 显式脚本。
- `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`
  - 新增 11 项受控 shell/静态测试。所有模拟均在临时目录与 shell 函数内执行，未调用真实 npm 下载、打包、解包、push 或修改真实 node_modules。

## TDD 证据

先新增测试并运行，旧实现失败：旧默认路径会跳过缺失主包/未覆盖平台、缺少显式参数与 package scripts，并在 pre-push 自动安装和调用自动补装路径。随后实施最小修复并转绿。

## 验证

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts` — 1 文件、11 测试通过。
- `npm run platform-deps:check` — 通过（当前 win32-x64 平台依赖齐备）。
- `npm run typecheck` — 通过。
- `npm test` — 49 文件、762 测试通过。
- `bash -n .githooks/ensure-platform-deps.sh`、`bash -n .githooks/pre-push`、`git diff --check` — 通过。

未执行 npm install、npm pack、tar、真实 push，也未修改状态逻辑、Schema、文档或计划。

## 第 1/5 轮审查修复

- I1：新增 `--install` 的两条执行级受控 shell 测试：缺失 native 包时断言 fail-closed、精确人工 `npm install` 指引和零 npm/tar/cp/rm/mv/mkdir 调用；依赖齐备时断言 exit 0、仅报告齐备且不宣称补装。
- I2：移除源码正则“无副作用”断言，改为实际运行已触发且最小 node_modules 齐备的 pre-push。测试通过记录型 npm/tar/cp/rm/mv/mkdir 包装器验证实际经过 `ensure-platform-deps.sh --check`，没有平台补装、下载、归档、复制、移动、建目录或 node_modules 删除。既有 pre-push 临时日志清理只允许删除其 `/tmp` 文件。
- I3：参数解析按完整 argc + argv 校验；`--check unexpected` 与 `--install unexpected` 都输出 usage 并 exit 2。

第 1/5 轮验证：目标测试 14 passed；`npm run platform-deps:check`、`npm run typecheck` 和 `npm test`（49 文件、765 测试）通过；hook 语法和 `git diff --check` 通过。
