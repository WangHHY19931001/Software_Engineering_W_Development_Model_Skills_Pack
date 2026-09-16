# Task 5 报告：pre-commit staged-only 与跨平台执行

## 结论

实现了 index snapshot 校验：hook 先由 index tree 生成临时快照，再对每个暂存路径用 `git show :path` 写入快照；Prettier 使用快照绝对路径，TypeScript 检查在快照目录执行。hook 不调用 `git add` / `git reset`，不覆盖工作树，并通过 `trap` 保存/恢复 `GIT_INDEX_FILE`、记录退出码、清理临时目录；清理失败最多重试 5 次并使成功状态变为失败。

## 实际命令与结果

| 命令 | 结果 |
|---|---|
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts` | PASS，3 tests passed |
| `npm run --silent typecheck` | PASS，修正测试中的可选索引访问后通过 |
| `npx --no-install prettier --write --config config/prettier.config.cjs config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | PASS |
| `git diff --check` | PASS |
| 用户指定的三文件 focused 命令 | 已启动但 docs-consistency 子进程长时间无终态输出，按用户要求中断；未将其记为通过 |

新增测试覆盖：暂存内容合法而工作树非法时通过、暂存内容非法而工作树合法时失败、JSON staged-only 格式边界、工作树/index 保持不变、无 `exit127`/`EBUSY` 输出。

## 配置与平台限制

`config/vitest.config.ts` 在本任务开始时已登记 `pre-commit-hook.test.ts`、`platform-deps-hook.test.ts` 和 `docs-consistency-logic.test.ts` 到 `SUBPROCESS_TEST_FILES`，本次保持登记并由 Prettier 格式化。

当前验证主机为 Windows Node，`bash` 由 `C:\Windows\system32\bash.exe` 提供并运行在 WSL 兼容层；测试路径显式转换为 `/mnt/<drive>/...`。未在独立 Git Bash/MSYS/MINGW 主机上执行，故这些平台的实机行为未能独立证明。

未解决问题：三文件 focused 套件包含既有长耗时 docs-consistency 子进程测试，本轮被中断，platform-deps 与 docs-consistency 的完整最终结果缺失；未运行全量 `npm test`。
