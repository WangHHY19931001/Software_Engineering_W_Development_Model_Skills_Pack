# 测试/门禁优化 设计规格（2026-09-28）

> 动机：上一批「门禁/测试瘦身」（`73e7e036`，T1-T6 留牙齿砍记账）与「遗留收口」（`75ef63bb`，L1-L12）已并入 main。用户裁定新一轮优化，四目标全开（**提速 / 瘦身 / 降维护成本 / 提质**），约束边界放宽至**牙齿清单可重审**，验收口径为「**定性重审 + 硬指标下限**」，覆盖面含 vitest 套件、prepush 执行结构、self-test / eval 语料；被测实现层不设禁（仍遵循最小改动原则）。
> 方案裁定：A「进程内化 + 分层重组」外科手术（B 激进统一运行器被否——重写 45 文件且放弃真实子进程保真面；C 框架内调参被否——只到 ~20 min 且瘦身/提质落空）。B 的进程内化以「试点—推广」剂量进入 Wave 2；C 的快赢（npx 残留清理）并入 Wave 2 第 1 层。
> 执行分支：`feat/test-gate-optimization`（Task 0 建分支；基线 `75ef63bb`）。

## 1. 基线数据（2026-09-28 实测/文档取证）

| # | 事实 | 数值 / 出处 |
| --- | --- | --- |
| B1 | prepush 总时长 | ~35-45 min（`.githooks/pre-push` 19 项；子代理同步等待事故记录，见遗留收口 L11） |
| B2 | vitest 规模 | 运行计数 **2617 例 / 106 文件**（最近 prepush 实测口径）；静态统计 2238 处 `it(`/`test(` 直写（不含 `it.each` 展开） |
| B3 | 串行瓶颈 | `cli-serial` 项目 **45 文件 / 静态 1120 例被强制串行**（`config/vitest.config.ts` `fileParallelism:false`） |
| B4 | 串行根因 | CLI 集成测试逐例 spawn 子进程；Windows 单次 node+tsx+模块图加载约 2-5s；测试内同步子进程调用点实测 **137 处 / 40 文件**（CLI spawn 与 git/环境探针混合，CLI 类为主体） |
| B5 | 已规避 npx 开销 | 大部分测试已 `runSync(process.execPath, [tsxCli, …])` 直调；**npx tsx 直调残留 7 处**（run-sync 台账口径：coverage-logic×3、eval-runner×2、check-codegraph-queries×1、check-coding-plan×1；Wave 1 复核） |
| B6 | 已证伪的提速路 | `--maxWorkers=4`、`testTimeout=120000`（2026-09 实测否定，见 vitest.config.ts 头注）——**全局共享 workers 形态**下子进程互抢致偶发失败 |
| B7 | 非瓶颈面 | self-test 381 例**进程内**跑（self-test.ts 4000+ 行 runner 循环调用，无逐例 spawn）；check-samples-coverage 48 探针有界并发 4（~1 min） |
| B8 | 快车道已存在 | `scripts/test-affected.cjs`（涟漪路径回退全量，设计合理）——痛点集中在**终局 prepush** |
| B9 | 漂移/盲点 | ① SUBPROCESS 清单注释写 41、实测 45；② `run-sync.test.ts:472-486` 文件级 mock 中藏真实 spawn（vi.doUnmock 后真实 ETIMEDOUT 断言）未登记；③ coverage exclude 全量运行不生效（机制未查明）；④ coverage 双口径（第 12 项全分母阈值 + 第 13 项 logic+lib 白名单重算） |
| B10 | 全量墙钟实测 | vitest 全量 `--reporter=json` 墙钟 **1962s**（run-sync.ts:74 台账注释，2026-09-26）——超 1800s 超时后调至 3600s |

## 2. 目标与硬指标（验收口径）

| 指标 | 基线 | 下限（验收） |
| --- | --- | --- |
| prepush 时长 | ~35-45 min | **≤ 15 min**（Wave 5 终态，2-3 次运行取中位） |
| vitest 用例数 | 2617 | **≤ 2100**（-20%），逐删登记「仍被覆盖（指向聚合用例）/ 有意退休（理由）」 |
| 漂移盲点（B9 ①-④） | 4 项在场 | 全部修复或进入 §7 裁定表有归宿 |
| flaky | 子进程竞争史（B6） | 分组并行若引入，**连跑 3 次零 flaky 才保留，否则回退串行** |

**底线：防御语义零损失**——执行方式（顺序/进程形态/并行度）可变，检查内容（每项检查什么、期望退出码、fail-closed 语义）不变；每处降级/删除登记「原牙齿 → 替代承载」。定性重审：每条被动的牙齿有裁定记录（防什么 / 是否真触发过 / 替代承载）。

## 3. Wave 1 · 测量先行

**原则：不靠推测设计，Wave 2/3 的文件选择全部由本波数据驱动。**

1. **prepush 逐项计时**：`log()`/`run_expect()` 前后打时间戳（毫秒），控制台输出逐项耗时分解；零语义变化（不改任何检查与退出码契约）。
2. **vitest 逐文件耗时**：直接从第 12 项已落盘的 jest 兼容 JSON（`--reporter=json` 本就为 docs-consistency 产出）提取 `testResults[].perfStats` / 逐例 duration——**零新增基建**。
3. **契约依赖地图**：grep + 交叉核对，枚举所有断言 prepush 结构（19 项清单/顺序）、vitest 用例数、SUBPROCESS 清单成员、coverage 阈值的门禁与活体文档落点（check-docs-consistency 校验面、`__tests__/README.md` 矩阵、AGENTS 计数句等）——Wave 4 重组前必须知道谁在看着这些契约。
4. **npx 残留复核**：全量 grep 确认 B5 的 7 处清单完备。
5. **跑一次全量 prepush 取基线**（一次性 ~40 min 成本），产出基线报告（本规格附录或 `docs/debug/` 留档）：时长分解表 + spawn 密度 top 文件榜 + 契约依赖地图 + Wave 2/3 文件选择清单。

## 4. Wave 2 · spawn 成本削减（提速主战场）

三层递进，每层独立可回退：

### 4.1 npx 残留清理（快赢）

B5 的 7 处 `execSync('npx tsx …')` → 统一 `runSync(process.execPath, [tsxCli, …])` 直调（与既有主流形态一致），顺带继承 runSync 强制的有限超时 / SIGKILL / utf-8 / maxBuffer。台账条目随调用形态更新（锚点同步）。

### 4.2 进程内调用层（试点 → 推广）

- **CLI 最小重构**：被选中 CLI 的 `main()` 改签名为 `export async function main(argv: string[])`（argv 显式传入），文件底部 `main(process.argv.slice(2))` 保持真实子进程入口不变。不重写实现逻辑。
- **测试 helper**：新增 `__tests__/helpers/cli-invoker.ts`——动态 `import()` CLI 模块 + 注入 argv / cwd / env + `vi.spyOn(process, 'exit')` 与 stdout/stderr 捕获，返回 `{ exitCode | 'no-exit', stdout, stderr }` 三态。
- **试点 2 个文件**（选无嵌套子进程依赖的，如 `wm-status`、`check-verifier-output`）：验证保真度（exit code / stdout 逐字节 / cwd 语义 / 错误路径），与真实子进程用例做同输入对照（试点文件保留原 spawn 用例至对照通过）。
- **推广**：按 Wave 1 spawn 密度榜单从高到低改造；每 CLI **保留 ≥1 条真实子进程冒烟**（三态之一）；48 条 exit-2 探针本就是独立子进程层（`lib/exit2-probe-registry.ts`），真实进程保真面（PATH/env/Windows 编码）不归零。
- **连锁收益**：不再 spawn 的测试文件按 `vitest-project-split.test.ts` 双向守护**移出 SUBPROCESS_TEST_FILES → 迁入 unit-parallel 项目并行执行**。
- **不适用面**：自身再 spawn 子进程的 CLI（如 check-docs-consistency 的 vitest 自采集）、依赖真实 stdin / 进程隔离语义的用例——留在子进程形态，不硬转。

### 4.3 serial 池分组并行（可选，数据说话）

- 剩余真实 spawn 文件拆 2-3 组（组内 `fileParallelism:false`，组间并行）——复刻 samples-coverage 探针「有界并发 + 独立隔离根」思路，与 B6 已证伪的「全局共享 workers」是不同机制。
- **验收门槛：连跑 3 次零 flaky 才保留，否则整组回退串行**（保留回退开关：单 project 配置即可还原）。
- 启用判据是 **vitest 全量墙钟**（非 prepush 总时长——后者需 Wave 4 重组后才见终效）：若 4.1+4.2 后全量墙钟已降至 ≈12 min 以内，4.3 降级为「不做」。

## 5. Wave 3 · 同质用例合并（瘦身 + 降维护）

- **目标面**：同族逐字段 / 逐分支断言 → 表驱动聚合（`it.each` / 循环内多断言，失败仍指名具体条目，断言信息不丢）。候选由 Wave 1 逐文件耗时 + 用例文本扫描产出（典型族：schema description 全字段断言、exit-code 三态重复、NEGATIVE-COVERAGE 相邻变体复测）。
- **不碰**：48 条 exit-2 探针、四类负例探针、有门禁强制的计数契约断言（除非 §7 裁定表逐条放行）。
- **逐删登记纪律**（沿用上一批）：每个被合并/删除用例 →「仍被覆盖（指向聚合用例）/ 有意退休（理由）」，不允许静默消失。
- **self-test / eval 语料**（用户指定在范围内，如实处置）：二者**不是提速瓶颈**（B7：self-test 进程内跑、eval 是交付资产）。本波只做**重审**——找同质样本对 / 重复覆盖并登记；仅当 vitest 侧瘦身不足以达 §2 下限时，才作为补充删减面启用。不硬凑数字。

## 6. Wave 4 · prepush 分层重组（执行结构）

**19 项语义清单不变**（每项检查内容、期望退出码、fail-closed 全保留），执行结构改三车道并行：

| 车道 | 内容 | 依赖 |
| --- | --- | --- |
| L2 主车道 | 第 12 项 vitest 全量 + coverage（含 JSON 落盘） | 无 |
| L1 并行车道 | 静态秒级项（第 6 security-scan、14 npm audit、17 prettier、18 tsc）+ 独立项（第 1-11、16、19 项：self-test、各 CLI 三态、samples-coverage、eval） | 无，与 L2 同时发起 |
| L3 尾车道 | 第 15 项 docs-consistency（复用 L2 的 vitest JSON + provenance）、第 13 项 coverage-scope（复用 L2 的 coverage-final.json） | L2 完成 |

- 实现：bash 后台 job + `wait` 收集退出码，任一失败即整体失败（退出码语义 = 现行「任何一项失败即中止」）；输出聚合打印，沿用现有 printf 容错模式（Git Bash fd 兼容）。
- **预估终态**：总时长 ≈ max(L2, L1 并行束) ≈ Wave 2 后的 vitest 本身（10-14 min）。
- **契约同步**：按 Wave 1 契约依赖地图逐点同步（prepush 头注、command-reference、`__tests__/README` 等）；若 check-docs-consistency 断言 19 项顺序，改为断言「19 项集合 + 各自退出码」——语义不变、顺序解耦。

## 7. Wave 5 · 牙齿重审裁定表

每条裁定四栏：**防什么 / 触发证据（是否真发生过）/ 替代承载 / 裁定**。最终审查确认后才动：

| # | 牙齿 | 裁定方向（预设，待证据复核） |
| --- | --- | --- |
| T1 | coverage 双口径（第 12 项全分母阈值 stmts 75/branch 65/funcs 85/lines 75 + 第 13 项 logic+lib 80/75/90/85） | **单口径化**：保留第 13 项 scope 口径为主牙（白名单分母重算，绕开 v8 include 不生效行为）；第 12 项全分母阈值撤销——「新增低覆盖 CLI import 即假红」已有实测证据（全分母 stmts 76.83 距阈值仅 1.8pp，与产品回归无关） |
| T2 | npm audit 网络容错（~40 行 grep -E 复合正则，pre-push:386-405） | 阻断语义保留；容错判定收敛简化（网络错误码白名单收敛为枚举短表；「状态词须同行锚定」等防误放行分支重审去留） |
| T3 | run-sync 台账 `SYNC_PROCESS_EXCEPTIONS` 锚点手工维护（reason 含行号漂移史注释） | AST 审计已存在（`auditSynchronousChildProcessSource`）→ 探索**台账由脚本派生/校验**（自动核对 anchor 可命中、timeout 状态真实），手工 reason 仅保留不可派生部分 |
| T4 | SUBPROCESS_TEST_FILES 清单 + 注释计数（写 41 实为 45） | 随 Wave 2 自然缩短；注释计数改自描述（「以清单长度为准，由 vitest-project-split.test.ts 双向守护」） |
| T5 | `run-sync.test.ts:472-486` mock 盲点（vi.doUnmock 后真实 spawn 未登记） | **修复**：逐调用点判定（文件级 mock 判定改调用点判定）或按实情登记；vitest.config.ts 头注「已知盲点」段随之销账。**时序：可与 Wave 2 合并执行**（同为 SUBPROCESS 判定口径触碰面，避免两次改动同一守护机制） |
| T6 | coverage exclude 全量不生效（机制未查明） | 随 T1 单口径化后该行为不再相关——销账（保留 vitest.config.ts 内如实标注的历史记录） |

## 8. 全局纪律与约束

1. **防御语义零损失**（§2 底线）；每处降级/删除登记「原牙齿 → 替代承载」（沿用上批格式）。
2. **机器可读契约变更面**：prepush 执行序、SUBPROCESS 清单、用例数、coverage 阈值形态——相关计数契约与活体文档按 Wave 1 契约依赖地图**逐点同步**，不允许先改代码后补文档的窗口期跨波存在。
3. **回归纪律**：`.ts` 改动前 codegraph 查询落盘；每波定向 vitest；**每波末全量 prepush**；历史不改写（CHANGELOG 历史条目、docs/debug 证据原貌不动）。
4. **版本**：行为面可见变更（prepush 执行结构、CLI main 签名、测试组织）→ 预计 **42.5.0**，六镜像同步；CHANGELOG 新条目如实登记（含各 Wave 的「原牙齿 → 替代承载」）。
5. 五波**串行推进**（波间数据依赖：1→2→3，2/3→4，全→5；例外：§7 T5 可并入 Wave 2 执行），每波独立可回退；每波收口在本规格追加「实测结果」段后再进下一波。
6. 不重写被测实现逻辑（CLI main 签名化与 invoker 是最小改动）；不动 self-test/eval 的交付语义（§5 重审除外）。

## 9. 风险登记

| 项 | 登记 |
| --- | --- |
| 进程内调用保真度（exit/stdout/cwd 与真实子进程不一致） | 试点 2 文件先行 + 同输入对照（保留原 spawn 用例至对照通过）；不适用面明确排除（§4.2） |
| Wave 4 bash 后台 job 在 Git Bash 的 fd/退出码聚合兼容性 | 沿用现有 printf 容错模式；L3 复用文件路径经 cygpath 翻译（既有做法）；试点先以「审计模式」（并行执行但逐项打印）验证一轮 |
| 分组并行重蹈 B6 覆辙 | 连跑 3 次零 flaky 门槛 + 单配置回退开关；不达标整组回退（§4.3） |
| 用例合并丢断言信息 | 表驱动聚合失败仍指名条目；逐删登记纪律（§5）；终局全量 prepush 零回归 |
| 契约同步遗漏（某文档/门禁仍断言旧结构） | Wave 1 契约依赖地图为强制前置产物；每波收口 grep 校验旧形态零残留 |
| Wave 1 基线单次运行偶然性 | 基线取 2 次运行（prepush 成本已计入）；终态验收另取 2-3 次中位 |

## 10. 显式不做

- 不统一 vitest / self-test / eval 为单一运行器（方案 B 已否）。
- 不动 test:affected 快车道（B8，现状设计合理）。
- 不动 48 条 exit-2 探针与四类负例探针本体（只在裁定表框架下处理其外围）。
- 不做 vitest.config include/exclude 机制的根因排查（T1 单口径化后不再相关，T6 销账）。
- eval 语料不因瘦身目标硬删（§5 重审优先，证据不足不动）。

## 11. 实测结果（2026-09-29 收口）

### Wave 1 · 测量先行

- prepush 计时仪表 + `PREPUSH_KEEP_VITEST_JSON` 保留开关落地；基线全量 19/19 绿 **2144s**（vitest 项 2047s，cli-serial 占 97.3%）。
- 契约依赖地图（`docs/debug/2026-09-28-test-gate-optimization/contract-map.md`）：四类断言落点登记（prepush 结构/用例数/SUBPROCESS/coverage 阈值）。

### Wave 2 · spawn 成本削减

- npx 残留 7 处迁移 runSync；cli-invoker 进程内调用层 + runMain VITEST 守卫 + spawn 层 VITEST 剥离（守卫前提对照实验证伪后补剥离）；9 CLI main 签名化 + wrapper 三态收敛；冒烟集中 `cli-subprocess-smoke.test.ts`；SUBPROCESS 47→43。
- 收口 prepush 19/19 绿 **1262s**（vitest 项 2047→1191s，**-42%**）。
- serial 池拆 a/b 两组（奇偶派生），3 连跑零 flaky。

### Wave 3 · 同质用例合并

- 276 族循环内聚合（执行登记 A-E + 补遗，1 部分退回如实登记），vitest **2631→1874 例**（对规格基线 2617：**-743，-28%**，硬线 ≤2100 达成余量 226）。
- self-test / eval 重审表 22 行全保留（删减面未触发，如实登记）。
- 收口 prepush 19/19 绿 1303s。墙钟说明：用例 -28% 但 vitest 项墙钟持平（serial 项目跨 it 调度并行度消失 + 重 fixture 族每迭代自备夹具），提速主战场在 Wave 2（进程内化）与 Wave 4（并行）。

### Wave 4 · prepush 分层重组

- 三车道（L1 并行 + L2 vitest + L3 尾车道复用 L2 产物）落地，19 项语义/退出码契约不变，首错即停→全量汇总如实登记；KEEP 红路径保 JSON；audit skip 消息 notice 通道；落盘数据 fail-closed 净化。
- 三连跑全绿零 flaky：1349/1314/1489 → 中位 1349s；文档同步 5 落点（`wave4-closeout.md`）。
- **硬指标未达（如实登记）**：中位 1349s > 900s。归因：总时长 ≈ vitest 全量本体（~20min 主导；docs-consistency-logic ~367s 与 platform-deps-hook ~204s 均在规格排除面）；L1 并行收益被启动期抢核部分抵消。后续三选项（动用排除面 / serial 池再拆 / 接受现状）留待用户裁定。

### Wave 5 · 牙齿重审落地

- T1 单口径化（scope 为唯一牙齿，全分母假红面撤销）/ T2 容错收敛枚举短表（只缩小可跳过面）/ T3 守护确认 + reason 17 条行号史清理 / T4 自描述核对 / T5 已随 Wave 2 登记 / T6 销账句补齐；裁定表终稿 `teeth-adjudication.md`（六行，每处「原牙齿→替代承载」）。

### 硬指标对照表（验收口径）

| 指标 | 基线 | 下限 | 终态 | 裁定 |
| --- | --- | --- | --- | --- |
| prepush 时长 | 2144s（35.7min） | ≤15min | **中位 1314s（21.9min，-39%）** | **未达**——vitest 全量本体主导，结构性缺口，留待裁定 |
| vitest 用例数 | 2617 | ≤2100 | **1874（-743，-28%）** | **达成**（余量 226） |
| 漂移盲点 B9①-④ | 4 项在场 | 全部修复或销账 | 全部有归宿（①④自描述/守护、②登记、③④销账） | 达成 |
| flaky | 子进程竞争史 | 分组并行连跑 3 次零 flaky | cli-serial 拆组 3 连跑 + 终局 3 连跑零 flaky | 达成 |

终局 3 连跑（含 Wave 5 改动）：1335/1314/1288s，19/19 全绿，vitest 1874 例全过（`final-vitest.json`）。
