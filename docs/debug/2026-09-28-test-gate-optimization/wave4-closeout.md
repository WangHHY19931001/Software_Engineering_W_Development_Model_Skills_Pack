# Wave 4 收口记录 · prepush 三车道并行重组（2026-09-29）

> 规格与计划：`docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md` / 计划 Task 14-15。
> Task 14（b233ef29）落地 `.githooks/pre-push` 三车道重组 + platform-deps-hook.test.ts 对齐；本记录为 Task 15 Step 1-2.5 收口产物（三连跑实测 + 文档同步面 + 硬指标如实登记）。

## 一、三车道结构摘要（Task 14 落地形态）

| 车道        | 内容                                                                                                                                                                                                                                 | 执行机制                                                                         | 依赖                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| L1 并行车道 | 第 1-11、14、16-19 项（self-test / check:verifier×3 / check:gate / security-scan / check-bdd-model×2 / check:coverage / check:exemption / check-signature-chain / npm audit / samples 矩阵 / prettier / tsc / eval——静态项与独立项） | `par_expect` 后台并发；退出码/起止毫秒落盘 `lane_dir/<idx>.{log,code,start,end}` | 无（与 L2 同时发起）                                                                                                            |
| L2 主车道   | 第 12 项 vitest 全量 + coverage（`--reporter=json --outputFile` 落盘同次 JSON）                                                                                                                                                      | `par_expect` 后台并发                                                            | 无（与 L1 同时发起）                                                                                                            |
| L3 尾车道   | 第 13 项 check-coverage-scope + 第 15 项 check-docs-consistency                                                                                                                                                                      | 沿用 Wave 1 `run_expect` 顺序执行                                                | 复用 L2 产物：node 封装 provenance 后 export `WM_VITEST_COUNT_FILE` / `WM_VITEST_PROVENANCE_FILE` / `WM_VITEST_PROVENANCE_ROOT` |

- **19 项语义清单与退出码契约不变**（序号 = 原 19 项编号，命令行/描述/期望码与重组前一致）；执行形态差异如实登记：重组前首错即停；重组后跑完全部车道再汇总——换取完整失败画像与并行墙钟。汇总循环按发起顺序 wait（wait 只做同步，判定以 `.code` 落盘为准），`fail_count ≠ 0` → 汇总后 exit 1。
- **KEEP 红路径保 JSON**：`PREPUSH_KEEP_VITEST_JSON` 复制置于全部 wait 完成之后、红路径退出之前——失败也先保留 vitest JSON 证据再中止（Wave 1 教训落地）。
- **notice 通道**：`par_expect` 内命令体 stdout/stderr 重定向进 `<idx>.log`（观察者不可见）；命令可写 `<idx>.notice`，子壳在收尾时 cat 转抛 hook stdout——第 14 项 audit 网络跳过提示经 `14.notice` 恢复上屏可见（对齐重组前 warn 直上终端形态），`14.log` 同步留痕。
- **fail-closed 净化**：`now_ms` 对 node 输出空/非纯数字回退 `date +%s000`（防空串进入算术上下文中止汇总环导致 fail-open）；汇总循环对 `.code` 缺失/非数字按 1（失败）计、`.start`/`.end` 缺失/非数字按 0 计——耗时失真可容忍，判定不可丢。`item14_audit` 在 `set +e` 子壳内不恢复 `set -e`（防阻断路径 return 1 直接终止子壳、吞掉 `.code`/`.end` 落盘）。

## 二、三连跑实测数据（Task 15 Step 1）

| 运行                      | 日志                | 总耗时 | 第 12 项 vitest | 结果                           |
| ------------------------- | ------------------- | ------ | --------------- | ------------------------------ |
| RUN1                      | `wave4-run1.log`    | 1349s  | 1335s           | 19/19 全绿                     |
| RUN2                      | `wave4-run2.log`    | 1314s  | 1299s           | 19/19 全绿                     |
| RUN3                      | `wave4-run3.log`    | 1489s  | 1474s           | 19/19 全绿                     |
| 验证 attempt 3（Task 14） | `wave4-prepush.log` | 1402s  | 1387s           | 19/19 全绿（`PREPUSH_EXIT=0`） |

- **中位 = 1349s（约 22.5 min）**；**共 4 次全量 prepush 全绿、零 flaky**。
- L3 尾车道实测 ≈ 10-15s（coverage-scope 1s + docs-consistency 9-10s）；L1 束与 L2 并行后被 L2 墙钟完全吸收。
- 受控 vitest JSON：`wave4-vitest.json`（KEEP 通道落盘：testResults 107 文件 / numTotalTests 1874 全过 / failed 0，与 Wave 3 终态计数一致——Task 14 未增删用例）。

## 三、硬指标未达（如实登记）

**硬指标「中位 ≤ 15 min（900s）」未达：中位 1349s > 900s，超出 449s。** 终局裁定由控制者上报用户，本记录只做如实登记与归因。

**归因**：

1. 重组后总时长 ≈ max(L2, L1 束) + L3 尾 ≈ **vitest 全量本体 + ~15s**——L1 并行收益（原其余项 ~70s 压缩到 ~10s 尾车道）被 L1/L2 启动期抢核部分抵消（vitest 单项 1231→1387s 量级波动；本四跑实测 1299-1474s）。
2. vitest 全量本体 ~20min 主导总时长，其中 **docs-consistency-logic（~367s，CLI 自采集 vitest）与 platform-deps-hook（~204s，bash 夹具）为两大慢文件、均在规格排除面**。
3. 硬指标 ≤15min 需另行动用排除面或进一步拆分，**超出本计划授权面**。

**后续路径三选项（供用户裁定）**：

| 选项              | 内容                                                                                                                       | 代价 / 风险                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| A. 动用规格排除面 | 处理两大慢文件（docs-consistency-logic 的 CLI 自采集 vitest 改注入受控工件 / platform-deps-hook 的真实 bash 夹具减 spawn） | 需规格变更授权；触碰「真实 spawn 证据」防线，须等价证明 |
| B. serial 池再拆  | SUBPROCESS 串行池（cli-serial-a/b）进一步拆分或降低串行项内部 spawn 次数                                                   | Wave 3 循环聚合后剩余 spawn 为结构性，收益上限有限      |
| C. 接受现状       | 中位 22.5min、4 次全绿零 flaky；并行化已完成结构性收益（L1 其余项 ~70s → 尾车道 ~10s），硬指标降级为观察项                 | 无改动成本；15min 硬指标放弃                            |

## 四、platform-deps-hook.test.ts 对齐记录（Task 14，b233ef29）

1. **lifecycle 失败样例迁移（L1 prettier → L3 docs-consistency）**：三车道新形态下 L1 失败在汇总循环即 exit 1，L3 尾车道不再执行——原「唯一失败样例 = L1 prettier」的夹具无法触达 L3 工件消费断言。迁移后唯一失败样例 = L3 末项 docs-consistency（消费 `WM_VITEST_COUNT_FILE` 写 `docs-consumed` 后 return 1），工件消费 + tempRoot 清理断言全保留；并新增负向断言「无 L1/L2 汇总失败行（并行车道 N 项不符预期）」锚定失败来源唯一性。
2. **PREPUSH_KEEP_VITEST_JSON 继承根因与钉空修复**：该变量经「外层 hook → vitest 进程 → 本测试 → 内层 mock hook」逐层继承；三车道「跑完全部车道再汇总」使内层 hook 必达 KEEP 块（重组前首错即停在 item 1，永不触达）。未 mock 的 `cp` 真实执行导致：(a) 命中 `export -f` mock cp 的 `\bcp\b` 负向断言误红（定向跑无此变量故绿）；(b) 夹具假 results.json 竞态覆写外层 prepush 正在写的证据 JSON。修复 = 三处夹具显式钉 `PREPUSH_KEEP_VITEST_JSON=''`（export 空串，hook 内 `${VAR:-}` 判空固定「未请求 KEEP」默认行为）；负向正则（npm install/pack/tar）零放宽。

## 五、Task 15 文档同步面（本提交）

- `.githooks/pre-push` 头注（触发条件块后）：追加三车道执行形态说明（19 项清单与退出码契约不变；首错即停→全量汇总）。
- `w-model-dev/references/command-reference.md` check-docs-consistency 条目（prepush 相关唯一条目）：态 1 注入处补 L3 尾车道执行位置注记。
- `AGENTS.md` §2 pre-push 行 / `README.md` CI 策略：执行结构表述同步为三车道并行、全量汇总、任一不符即 exit 1。
- `w-model-dev/scripts/__tests__/README.md`：核实无「顺序执行/首错即停」断言（矩阵行均为边界事实），零改动。
- 同类结论：`CONTRIBUTING.md`/`docs/INSTALL.md`/`docs/troubleshooting.md`/其余 references 仅含「19 项」计数与边界事实（重组后仍真），零改动；`subagent-delegation.md:640`「≈35-45 分钟」为时长期望值（重组后实际 ~22-25min，偏高但不误导后台化决策），本波不动。
