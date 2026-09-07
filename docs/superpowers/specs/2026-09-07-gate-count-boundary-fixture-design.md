# 门禁项数边界测试与隔离负例设计

- 日期：2026-09-07
- 状态：已批准
- 前置规格：`docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md`
- 前置实现：`gate-count-stale-scan` campaign（最终 HEAD `632f4dc`）
- 版本：42.2.1 不 bump

## 1. 背景

最终宽范围审查确认 `gate-count-docs` 运行逻辑正确，但留下两项非阻塞观察：

1. 正则边界测试未覆盖无空格序数 `第13项`、`(?!目)` 的「N 项目」排除，以及同一行混合序数/过期计数。
2. CLI 负向验证通过 `sed` 修改真实 `docs/troubleshooting.md`，短时间内使复制真实仓库的 7 个 CLI fixture 测试失败；还原后虽恢复，但验证过程污染了共享工作树。

本补充只增强回归保护与验证隔离，不改变 `gate-count-docs` 生产逻辑、白名单、pre-push 18 项门禁或版本。

## 2. 范围

### 2.1 正则边界测试

在 `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 既有 `gate-count-docs` describe 中增加 3 个测试：

| 场景         | 输入                                               | 期望                                                    |
| ------------ | -------------------------------------------------- | ------------------------------------------------------- |
| 无空格序数   | `pre-push 第13项 npm audit warn（门禁不阻断）`     | `gate-count-docs` 违规数为 0；不得把 `3项` 误识别为计数 |
| 「项目」排除 | `门禁说明：3 项目目录不计数`                       | 违规数为 0；`(?!目)` 生效                               |
| 混合命中     | `第 13 项 npm audit（门禁稳定）且 17 项门禁未同步` | 违规数为 1；序数跳过，真正的 `17 项` 被捕获             |

用例必须调用真实 `runDocConsistencyChecks(baseInput({ gateCountDocs }))`，并断言具体 `gate-count-docs` 结果，不得 mock 正则或只断言总违规数。

### 2.2 隔离 CLI 负例

在同一测试文件中新增一个真实 CLI 边界测试，复用已有 helper：

- `withDocsConsistencyFixture` 复制完整仓库到受控 `mkdtemp` 目录，并在 `finally` 删除临时根目录；
- `writeVitestCount(fixtureRoot, 1002)` 写入合法动态 facts/provenance；
- 读取临时 `docs/troubleshooting.md`，只在临时副本中将 `本次推送未执行 18 项门禁` 替换为 `本次推送未执行 17 项门禁`；
- `runDocsConsistencyCli(fixtureRoot, {}, ['--json'])` 运行真实 CLI；
- 解析 stdout JSON，断言 exit code 为 1，`gate-count-docs` 违规存在，且 message 指向 `docs/troubleshooting.md` 与替换行号；
- 测试结束由 helper 的 `finally` 清理临时目录，真实 checkout 的 `docs/troubleshooting.md` 不写入、不还原、不依赖 `git checkout`。

负向测试应使用唯一稳定替换目标；若目标文本缺失，测试应显式失败而不是静默继续。不得修改 `process.env` 全局状态来实现隔离；动态 facts 使用 helper 的受控环境注入。

## 3. 计划同步

更新原计划 `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md` Task 2 步骤 3：

- 删除通过 `sed -i` 修改真实 `docs/troubleshooting.md` 的命令；
- 改为引用 `withDocsConsistencyFixture` / `writeVitestCount` / `runDocsConsistencyCli` 的隔离负例；
- 保留 exit 1、`gate-count-docs`、文件名/行号断言和临时目录自动清理要求；
- 明确此验证不改变真实工作树。

原计划的验收描述同步为「隔离 fixture 负向 CLI 验证」，避免未来执行者复制旧的污染式流程。

## 4. 非目标

- 不改 `docs-consistency-logic.ts` 的正则、白名单或错误消息。
- 不改 `check-docs-consistency.ts` CLI 接线。
- 不改 `.githooks/pre-push`、`EXPECTED.prePushCount`、CHANGELOG、eval 逻辑或版本。
- 不新增依赖。
- 不把所有 CLI fixture 抽象成新的 helper；复用现有 `withDocsConsistencyFixture` 即可。
- 不修复评审者列为「可延后」的 `lines[i]!` 可维护性建议。

## 5. 测试与验收

1. 聚焦 `docs-consistency-logic.test.ts`：原 169 个用例 + 新增 4 个用例全部通过，输出除既存 npm 配置 warning 外无失败/错误。
2. 新隔离负例断言真实 CLI exit 1 与 `gate-count-docs` message；真实 `docs/troubleshooting.md` 内容保持 18 项，测试后无需还原。
3. 完整 `npm test` 全绿。
4. `npm run prepush` 18/18 exit 0。
5. `npx tsx eval/runner.ts` 60/60 exit 0。
6. 原计划与补充规格中的验证方式一致，不再出现修改真实 checkout 的负向 CLI 命令。
