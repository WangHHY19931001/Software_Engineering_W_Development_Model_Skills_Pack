# Wave A 验收证据：门禁语义与牙齿（2026-09-25）

> 来源：计划「8 阶段 live run 调测发现全量修复」任务 5（`docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md`）、规格 `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` §3（WS-1..WS-4）；输入证据 = 8 阶段 live run 报告 `docs/debug/2026-09-23-wm-8phase-live-run/README.md`（D-1/N-1、D-2/N-2、D-6、D-7）。
> 执行环境：分支 `feat/live-run-findings-remediation`，验收起点 HEAD `8060d470`；验收子代理**只读**执行（未改任何 `w-model-dev/` 源码）。本文所有退出码为真实进程退出码，未经人工改写；仓外临时工作区 `D:/w_skill_opt/_waveA_acceptance/` 承载差分脚本、harness 与原始日志（不入库）。

## 1. WS ↔ 提交 ↔ 本轮验收命令对应表

| WS                                           | 发现项                     | 实现提交（区间）                                     | 本轮验收命令                                                                                                          | 结果                                                                                                                                                            |
| -------------------------------------------- | -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WS-1 iceberg R6 命名空间分池                 | D-1 / N-1                  | `a7efbd60` + `881a2b9a`（`845cf956..881a2b9a`）      | demo 真实上游产物 R6 差分复现（shipped 逻辑 + shipped CLI）+ 单测 `iceberg-logic.test.ts` + self-test `ICEBERG_CASES` | 窄池（tla）噪声消除；宽池（graph↔rtm）真实差异保留 → **见 §3.3 与 §7-2**                                                                                        |
| WS-2 coding-plan R5 内容下限 + `--preflight` | D-2 / N-2                  | `75778b70` + `5ddf8516` + `25a9f8d7`                 | `check-coding-plan --preflight`（demo 阶段 5）+ 单测/样本（prepush 项 1、12）                                         | exit 0、`missing=[] invalid=[]`（§4）                                                                                                                           |
| WS-3 codegraph 显式降级契约 + 索引探测       | D-6                        | `c3113d7e`                                           | demo 查询记录字段核验 + 单测 `check-codegraph-queries.test.ts` C14a-d（prepush 项 1、12）                             | 记录已带 `evidenceKind:artifact` + `degradationReason` + `alternativeEvidence`；CLI 对 demo exit 1 的唯一理由是 headRef 过期（装配器绑定，非 WS-3 判据）→ 见 §5 |
| WS-4 maturity R5 真值通道 + 未接线可见化     | D-7                        | `b1873fc6` + `8060d470`（区间 `b1873fc6..8060d470`） | `check-maturity` 三态（17 处引用 / 未传 `--run-log` / 3× `operationalFailureModes`）                                  | exit 0 + 诊断 / exit 0 + 诊断 / exit 1 + R5 违规（§2）                                                                                                          |
| 卫生                                         | security-scan 新增发现清零 | `b1873fc6`                                           | prepush 项 6 `security-scan`                                                                                          | `无新增风险（exit 0）`                                                                                                                                          |

**计数影响**：Wave A 四 WS **未新增任何 CLI 或 schema 文件**（`git diff --name-status 845cf956^..8060d470` 的 `A` 条目只有 samples/fixture 与规格/计划文档），故 **exit-2 族保持 45**（`references/conventions.md:124`：27 个 `check-*` + 18 个工具 CLI，不含 `self-test.ts`）、**schema 保持 34**（`ls w-model-dev/schemas/*.json | wc -l` 实测 34）。

## 2. 步骤 1a：`check-maturity`（WS-4 / D-7）

### 2.1 简报命令形态（当前 demo 工作区）

```
$ cd eval/e2e/demo
$ npx tsx ../../../w-model-dev/scripts/cli/check-maturity.ts .w-model/maturity.json \
    --project=.w-model/project.json --run-log=.w-model/run-log.jsonl --json
EXIT=0
{"type":"maturity","passed":true,"reasons":[],"violations":[],"warnings":[],"durationMs":116,"exitCode":0}
```

**为何没有诊断**：当前 `eval/e2e/demo` 是装配器重建后的基准态（`.w-model/run-log.jsonl` 恰 104 行 = 装配器基准行数，`project.json` 为 `createdAt=2026-09-19T03:00:00+08:00` 的基准轨迹），run-log 内**没有 O1..O6 字样**，故按 D-7 新口径既无词法诊断、也不误计 R5。live run 的 17 处引用命中见 §2.2。

### 2.2 D-7 直接验收：live run 保全快照 run-log（17 处引用命中 → exit 0 + 诊断）

live run 的 run-log 由装配器 fail-closed 快照保全（`eval/e2e/demo-snapshots/20260925T163707Z/run-log.jsonl`，443 行；保全机制见 `eval/e2e/demo-assets/README.md`「销毁前证据保全」「非基准态检测与证据快照」）。

```
$ cd eval/e2e/demo
$ npx tsx ../../../w-model-dev/scripts/cli/check-maturity.ts .w-model/maturity.json \
    --project=.w-model/project.json \
    --run-log=../demo-snapshots/20260925T163707Z/run-log.jsonl --json
EXIT=0
{"type":"maturity","passed":true,"reasons":[],"violations":[],"warnings":[],
 "diagnostics":["疑似引用 17 处（含规则编号引用，非运维失败）；若确为运维失败请在记录中以 operationalFailureModes 标注：p1-G-verifier-10, p1-V-main-08, p1-G-verifier-15, p1-V-main-13, p1-G-maturity-16, p2-G-verifier-03b, p2-V-rootcause-02c, p3-G-verifier-03, p4-G-verifier-04, p5-G-verifier-01, p5-R-rootcause-02, p5-V-finalize-04, p6-G-verifier-05, p7-G-verifier-02, p7-V-finalize-02b, p8-G-verifier-01"],
 "durationMs":131,"exitCode":0}
```

即：**17 处词法命中不再计入 R5**（旧口径 17 ≥ `downgradeTriggers.operationalFailureStreak=3` 会判违规），改为非阻断诊断，并保留「确为运维失败请改用 `operationalFailureModes` 标注」的指引；命中位置（runId）逐条列出，不丢事实。这就是简报「17 处引用命中 → exit 0 + 诊断」的直接验收。

### 2.3 未接线可见化（未传 `--run-log`）

```
$ cd eval/e2e/demo
$ npx tsx ../../../w-model-dev/scripts/cli/check-maturity.ts .w-model/maturity.json \
    --project=.w-model/project.json --json
EXIT=0
{"type":"maturity","passed":true,"reasons":[],"violations":[],"warnings":[],
 "diagnostics":["R5 未生效：未提供 --run-log（O 系列失败模式未校验）"],"durationMs":121,"exitCode":0}
```

### 2.4 真值通道有牙（合成探针：3 × `operationalFailureModes` → exit 1）

探针 run-log 为**合成**（取 live-run 快照前 3 条真实记录 + 注入 `operationalFailureModes:['O3']`，runId `p1-A-chunk-01 / p1-A-cross-02 / p1-G-graph-01`），仅用于验证真值通道（产物在仓外 `D:/w_skill_opt/_waveA_acceptance/d7c/`）。

```
$ npx tsx w-model-dev/scripts/cli/check-maturity.ts maturity.json --run-log=run-log.jsonl --json
EXIT=1
{"type":"maturity","passed":false,"reasons":["R5: O 系列失败模式命中 3 次 ≥ downgradeTriggers.operationalFailureStreak 3，应触发降级评估"],"violations":[{"rule":"violation","count":1}],"warnings":["R3 未校验：未提供 --project"],"durationMs":494,"exitCode":1}
```

三态合起来即 D-7 完整语义：**词法命中 → 诊断（exit 0）／未接线 → 诊断（exit 0）／真值字段命中 → R5 违规（exit 1）**。

## 3. 步骤 1b：`check-iceberg-sweep`（WS-1 / D-1 + N-1）

### 3.1 简报命令形态不可执行的原因（如实登记）

简报形态依赖 `eval/e2e/demo/.w-model/iceberg-reports/phase{2..8}-*.json`，该目录在当前 checkout **不存在**：

```
$ ls eval/e2e/demo/.w-model/iceberg-reports/
（无此目录；eval/e2e/demo/.w-model/gate-logs/ 亦为空）
$ find . -type d -name "iceberg-reports"     # 全仓
（无命中）
```

原因：demo 工作区是 gitignored 瞬态目录，live run 的 `iceberg-reports/*.json` **不在装配器保全快照的保全面内**——快照只拷 `run-log.jsonl` / `signature-chain.jsonl` / `checkpoint-log/` / `gate-logs/`（`eval/e2e/demo-assets/README.md`「命中后的行为」第 1 条），且工作区已于 2026-09-26 01:58 重建为基准态。故按规格 WS-1「验收」的兜底条款（「若报告声明字段与新口径冲突则以 samples 正例代替，并在证据中说明」）改用下述三类证据。

### 3.2 before：live run 保全快照的 iceberg gate logs（阶段 2-8 全 exit 1）

`eval/e2e/demo-snapshots/20260925T163707Z/gate-logs/p*-G-*-iceberg*.log` 记录了旧口径下的真实拦截（R6 差异项为命名空间宽度噪声）：

| 阶段日志                                                              | 旧 exit | R6 差异（原文摘录）                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p2-G-06-iceberg-sweep.log`                                           | 1       | `graph↔tla 差异项：INTF-001, INTF-002, INTF-003；graph↔rtm 差异项：INTF-001, INTF-002, INTF-003`（note：**结构性预期拦截（O 预裁定存证）：R6 三视角结构性不等（checker 设计缺陷，O 已裁定存证）**） |
| `p3-G-05-iceberg.log` / `p3-G-06-01-iceberg.log`                      | 1       | `graph↔tla … INTF-001..003；tla↔rtm 差异项：INTF-003, INTF-001, INTF-002`                                                                                                                           |
| `p4-G-06-01-iceberg.log`                                              | 1       | `graph↔tla / graph↔rtm 差异项：INTF-001, INTF-002, INTF-003, DD-001, DD-002, DD-003`                                                                                                                |
| `p5-G-13-1` / `p5-G-14-1` / `p6-G-07-01` / `p7-G-04-1` / `p8-G-07-01` | 1       | 同 p4，另附 `R7 视角缺席未显式声明：scope`（demo 的 scope 文件名为 `change-scope.p5.json`，CLI 只读 `change-scope.json` → scope 视角缺席）                                                          |

### 3.3 after：demo 真实上游产物的 R6 差分复现（shipped 实现 + shipped CLI）

复现方式（仓外脚本，只读）：读 demo 真实上游产物 `eval/e2e/demo/.w-model/{ingestion/graph.json, tla-manifest.json, rtm.json}`（`change-scope.json` 缺失 → scope 视角缺席），用 shipped `deriveViewSets` 派生视角集，分别按 **pre-fix 两两平权口径**（逐字复制自 `845cf956^:w-model-dev/scripts/logic/iceberg-sweep-logic.ts` 的 R6 循环）与 **现行分池口径**（直接调用 shipped `checkIcebergSweep`）判定；再经**真实 CLI**（`check-iceberg-sweep.ts`，报告置于仓外 harness 工程根后向下派生真实视角集）取退出码。

派生视角集（阶段 2-8 相同）：`graph = [SD-001, INTF-001, DD-001]`、`tla = [SD-001]`、`rtm = [SD-001]`、`scope` 缺席（阶段 5-8）。

| 阶段            | 旧口径（两两平权）                                                                  | 新口径（分池）                                                                                        | CLI exit（新版）             |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| 2-8（逐一实跑） | exit 1：`graph↔tla 差异项：INTF-001, DD-001` + `graph↔rtm 差异项：INTF-001, DD-001` | 窄池 `graph↔tla` 噪声**已消除**；宽池 `R6[design-wide] graph↔rtm 差异项：INTF-001, DD-001` **仍失败** | 1（唯一理由 = 上述宽池一条） |

```
$ npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts \
    D:/w_skill_opt/_waveA_acceptance/harness/.w-model/iceberg-reports/phase2-harness.json --json
EXIT=1
{"type":"iceberg-sweep","passed":false,"reasons":["R6 视角间存在未对账差异：R6[design-wide] graph↔rtm 差异项：INTF-001, DD-001（设计 ID 分池对账，差异即刻失败，走普通 V/G 失败链由 R 定位）"], …}
```

双向结论（如实）：

- **达成**：tla 视角的 SD-only 命名空间宽度差不再被当成缺口（旧文案的 `graph↔tla` 分支消失；文案按池命名 `R6[design-wide]`/`R6[design-sd]`），这正是 D-1 的结构性噪声；`scope`（文件路径命名空间）不再参与 R6/R8（N-1）。
- **未完全达成**：demo 既有产物上 `graph↔rtm`（池 A，设计 ID 宽池）**仍有差异**——demo 基准态 `rtm.json` 的 `designDoc` 只引用 `SD-001`，而 graph 含 `INTF-001`/`DD-001` 节点。按规格池 A 定义（「graph ↔ rtm 精确相等——两视角同源于 designDoc，漂移即装配缺陷」）这是**刻意保留的真实差异**（有牙），但因此 WS-1 验收里「demo 阶段 2-8 既有证据上复跑 → R6 不再差异」**在 demo 既有产物上不成立**；live run 快照旧日志显示的同类差异（`graph↔rtm`：`INTF-001..003`、`DD-001..003`）按同一口径复跑亦仍会红。→ 登记为未达成项（§7-2）。

### 3.4 仓内 fixture 与单测（正例/负例，prepush 覆盖）

```
$ npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts
EXIT=0
✓ w-model-dev/scripts/__tests__/iceberg-logic.test.ts (34 tests)
 Test Files  1 passed (1) / Tests  34 passed (34)
```

Task 1 新增的 `R6 命名空间分池` describe（8 例）覆盖：宽池精确相等（含 DD/INTF）→ 通过；宽池 DD 漂移 → 违规且文案含 `design-wide`；tla 落 SD 子集 → 通过；tla 含 graph 外 SD → 违规（`R6[design-sd]`）；宽视角 SD 未进 tla（反向守护——**阶段 5-8 无 `check-tla-model` 复检 `uncoveredSdNodes` 不变量**，故由 R6 窄池双向守护）→ 违规；重复 ID 文案去重；scope 不参与 R6/R8。CLI 层由 `self-test.ts` 的 `ICEBERG_CASES` 覆盖（`bad-r6-wide-dd-drift.json` 期望 `/R6/, /design-wide/, /graph↔rtm.*DD-003/`；`valid-phase5-scope-present.json` 期望 passed）——prepush 项 1 `self-test` exit 0。

> 附注：`check-iceberg-sweep.ts` 单跑 `samples/iceberg/*.json` 时，R6 需上游产物注入（脚本从报告所在目录向上找 `.w-model/`）；samples 目录无上游产物 → R6 整块跳过，故负例在 CLI 单跑形态下 exit 0（既有设计：注入前不误红）。实测 10 个样本 CLI 退出码见仓外 `iceberg-samples.out`（`bad-r6-wide-dd-drift.json` exit 0 = 未注入 viewSets；其 R6 判别力由 self-test 注入用例锁定）。

## 4. 步骤 1c：`check-coding-plan`（WS-2 / D-2 + N-2）

`--preflight`（N-2）对 demo 阶段 5：

```
$ npx tsx w-model-dev/scripts/cli/check-coding-plan.ts eval/e2e/demo --phase=5 \
    --scope=.w-model/change-scope.p5.json --preflight
EXIT=0
CODING_PLAN_PREFLIGHT_JSON {"required":[".w-model/r3-reviews/phase5-plan-completeness.md",
 …（R3×9 + V×3 = 12 份）…, "docs/plans/phase5-demo.plan.md",
 ".superpowers/sdd/phase5-demo.plan/progress.md"],"missing":[],"invalid":[],
 "artifacts":[".superpowers/sdd/phase5-demo.plan/review-phase5-demo-t1.diff",
 "…task-1..3-brief/report…"]}
（stderr 非阻断诊断）○ --preflight 诊断：scope 未通过校验，按 scope.changeId=phase5-demo 出清单
（清单只判产物在盘与否，与 scope 有效性无关；headRef 过期：scope.headRef=c3113d7e… 不等于当前 HEAD=8060d470…）
```

即：清单化输出（14 项必需 + 7 项三件套），`missing=[]`、`invalid=[]`，exit 0，且**不执行 R1-R6**（scope 有效性不过也不改清单语义，仅 stderr 非阻断诊断）。R5 的「非空阻断 + 锚非阻断诊断」与三条负例（空文件 `bad-review-empty` → exit 1；无锚但非空 → exit 0 + stderr 诊断；demo 既有 15 份 review 产物在非空判据下仍绿）由 `coding-plan-logic.test.ts` / `check-coding-plan.test.ts` 与 self-test 锁定（prepush 项 1、12 全绿）。

## 5. 步骤 1d：`check-codegraph-queries`（WS-3 / D-6）

demo 阶段 5 查询记录字段（真实产物 `eval/e2e/demo/.w-model/codegraph-queries/phase5-demo-Counter.json`）：

```json
"evidenceKind": "artifact",
"degradationReason": "demo 瞬态工作区无 .codegraph/ 索引（codegraph CLI 探测 CodeGraph not initialized），按授权以制品级查询记录替代",
"alternativeEvidence": [{"command": "codegraph query Counter", "evidencePath": ".w-model/codegraph-queries/phase5-demo-Counter.json"}]
```

demo 无 `.codegraph/` 索引（实测 `ls -d eval/e2e/demo/.codegraph` → 不存在）→ 记录必须声明降级，已满足。CLI 复跑：

```
$ npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts eval/e2e/demo --phase=5 \
    --scope=.w-model/change-scope.p5.json --json
EXIT=1
{"type":"codegraph-queries","passed":false,"reasons":["headRef 过期：scope.headRef=c3113d7ecb5e7ad39da65d77f0bc85771b74c86c 不等于当前 HEAD=8060d470dca0f25bc4e60902c347951487d1f42a（scope 须与实际变更同步创建/更新）"],"violations":[{"rule":"violation","count":1}],"durationMs":176,"exitCode":1}
```

exit 1 的唯一理由是 **git 绑定过期**（demo 装配时 HEAD `c3113d7e`，验收时 HEAD 已前移 `8060d470`——装配器 README 已把「工作区重建后 HEAD 前移须重建」写为设计行为），**不是** WS-3 判据违规（记录已按 D-6 显式降级）。WS-3 的三条验收判据由单测锁定（`check-codegraph-queries.test.ts`，prepush 项 12）：C14a 无索引 + 未声明降级 → exit 1；C14b 无索引 + `artifact` + 替代证据 → exit 0；C14c 有索引却声明 `artifact` → exit 1；C14d 有索引 + `cli` → exit 0。样本侧新增 `bad-degraded-without-evidence` / `bad-cli-kind-without-index`（CLI 形态需 `--scope`，无 scope 时按 fail-closed exit 1，原始退出码见仓外 `ws3-codegraph-samples.out`）。

## 6. 步骤 2：定向 + 全量（`npm run test:affected` → `npm run prepush`）

```
$ npm run test:affected
▸ 参与判定的改动文件（2）：docs/debug/2026-09-19-wm-8phase-full-debug/、docs/debug/2026-09-23-wm-8phase-live-run/
▸ 命中涟漪路径 → 影响面无法用文件名映射枚举，直接跑**全量**：…（同上）
▸ npx vitest run --config config/vitest.config.ts
 Test Files  104 passed (104)
   Duration  1393.13s (transform 15.20s, setup 0ms, import 25.33s, tests 1404.59s, environment 16ms)
AFFECTED_EXIT=0
```

（未提交改动只有两个 untracked `docs/debug/` 目录，命中涟漪规则 → 按设计回退全量 vitest；结果 104/104 通过。）

`npm run prepush`（`bash .githooks/pre-push --force`）19 项逐项与退出码（原始日志：仓外 `step2-prepush.log`）：

| #    | 门禁项                                         | 结果                                  |
| ---- | ---------------------------------------------- | ------------------------------------- |
| 前置 | 平台依赖检查（`ensure-platform-deps --check`） | `✓ 平台依赖齐备（win32-x64）`         |
| 1    | self-test 全部样本匹配期望                     | `✓（exit 0）`                         |
| 2    | check:verifier 无参数退出 2                    | `✓（exit 2）`                         |
| 3    | check:gate 不存在目录退出 2                    | `✓（exit 2）`                         |
| 4    | check:verifier 有效样本退出 0                  | `✓（exit 0）`                         |
| 5    | check:verifier 无效样本退出 1                  | `✓（exit 1）`                         |
| 6    | security-scan 无新增风险                       | `✓（exit 0）`                         |
| 7    | check-bdd-model 有效 BDD 样本退出 0            | `✓（exit 0）`                         |
| 8    | check-bdd-model schema 不合规样本退出 2        | `✓（exit 2）`                         |
| 9    | check:coverage 有效覆盖样本退出 0              | `✓（exit 0）`                         |
| 10   | check:exemption 有效豁免样本退出 0             | `✓（exit 0）`                         |
| 11   | check-signature-chain 有效签名链样本退出 0     | `✓（exit 0）`                         |
| 12   | vitest 单元测试 + coverage 阈值通过            | `✓（exit 0）`                         |
| 13   | 规则层覆盖口径（logic+lib）达阈值              | `✓（exit 0）`                         |
| 14   | npm audit 依赖漏洞扫描（high 以上阻断）        | `✓ 未发现 high 以上漏洞`              |
| 15   | docs-consistency 活体文档一致                  | `✓（exit 0）`                         |
| 16   | samples 覆盖矩阵一致（无未登记 fixture）       | `✓（exit 0）`                         |
| 17   | prettier 格式一致性（`--check`）               | `✓（exit 0）`                         |
| 18   | tsc 类型检查 0 错误                            | `✓（exit 0）`                         |
| 19   | eval 语料断言与覆盖矩阵全绿                    | `✓（exit 0）`                         |
| 收尾 | —                                              | `[pre-push] 全部门禁通过，允许推送 ✓` |

```
PREPUSH_EXIT=0
```

末 30 行原文（去色后）：

```
（node:286992) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true …
AFFECTED_EXIT=0
--- CMD2: npm run prepush ---
> w-model-dev-skill@42.2.1 prepush
> bash .githooks/pre-push --force
[pre-push] 检测到校验脚本相关变更，启动推送前门禁...
[pre-push] 平台依赖检查（ensure-platform-deps --check）...
[ensure-deps] ✓ 平台依赖齐备（win32-x64）
[pre-push] ✓ self-test 全部样本匹配期望（exit 0）
[pre-push] ✓ check:verifier 无参数退出 2（exit 2）
[pre-push] ✓ check:gate 不存在目录退出 2（exit 2）
[pre-push] ✓ check:verifier 有效样本退出 0（exit 0）
[pre-push] ✓ check:verifier 无效样本退出 1（exit 1）
[pre-push] ✓ security-scan 无新增风险（exit 0）
[pre-push] ✓ check-bdd-model 有效 BDD 样本退出 0（exit 0）
[pre-push] ✓ check-bdd-model schema 不合规 BDD 样本退出 2（exit 2）
[pre-push] ✓ check:coverage 有效覆盖样本退出 0（exit 0）
[pre-push] ✓ check:exemption 有效豁免样本退出 0（exit 0）
[pre-push] ✓ check-signature-chain 有效签名链样本退出 0（exit 0）
[pre-push] ✓ vitest 单元测试 + coverage 阈值通过（exit 0）
[pre-push] ✓ 规则层覆盖口径 (logic+lib) 达阈值（exit 0）
[pre-push] npm audit 依赖漏洞扫描（high 以上阻断）...
[pre-push] ✓ npm audit 未发现 high 以上漏洞
[pre-push] ✓ docs-consistency 活体文档一致（exit 0）
[pre-push] ✓ samples 覆盖矩阵一致（无未登记 fixture）（exit 0）
[pre-push] ✓ prettier 格式一致性（--check）（exit 0）
[pre-push] ✓ tsc 类型检查 0 错误（exit 0）
[pre-push] ✓ eval 语料断言与覆盖矩阵全绿（exit 0）
[pre-push] 全部门禁通过，允许推送 ✓
PREPUSH_EXIT=0
=== END 2026-09-25T20:58:26Z ===
```

（`run_expect` 仅在失败时打印被捕获的子命令输出，故通过项在日志中只有 `✓` 行；vitest 明细被捕获后随临时文件删除，全量结果以项 12 的 `exit 0` 为准，可复跑 `npm run prepush` 重建。）

## 7. 未达成项与原因

1. **简报 step 1 的 iceberg 命令形态不可执行**：`eval/e2e/demo/.w-model/iceberg-reports/`（阶段 2-8 报告）在当前 checkout 不存在——demo 为 gitignored 瞬态工作区，装配器保全快照只含 `run-log` / `signature-chain` / `checkpoint-log` / `gate-logs`，报告未保全；工作区已重建为基准态。已按规格兜底条款改用「live-run 快照 gate logs（before）+ demo 真实上游产物分池差分（after）+ samples/单测（判据锁定）」取证（§3.2-§3.4）。
2. **WS-1 验收「demo 阶段 2-8 既有证据上 R6 不再差异」未完全达成**：窄池（tla ↔ 宽视角 SD 切片）噪声已消除；**宽池 `graph↔rtm` 在 demo 既有产物上仍报差异**（`INTF-001, DD-001`），原因是 demo 基准态 `rtm.json` 只引用 `SD-001`，而 graph 含 `INTF-001`/`DD-001` 节点。按规格池 A 定义这是**刻意保留的真实装配差异**（不是命名空间噪声），但该条验收因此不能判为达成。live run 快照旧日志显示同类差异（`INTF-001..003`/`DD-001..003`）——用同一产物复跑池 A 仍会红，故对 live-run 形态的「R6 全绿」结论**不予背书**，建议后续用 8 阶段完整产物（或修复 RTM 对设计 ID 的引用后）复核。
3. **`check-codegraph-queries` 对 demo 的 exit 1 非 WS-3 判据失败**：唯一理由是 `headRef 过期`（装配器按当时 HEAD `c3113d7e` 装配，验收时 HEAD `8060d470`）。WS-3 三判据由单测 C14a-d 锁定，demo 记录字段核验通过（§5）。
4. **`check-iceberg-sweep` 对 samples 的 CLI 单跑不触发 R6**：脚本从报告所在项目根向上找 `.w-model/` 派生视角集，samples 目录无上游产物 → R6 整块跳过（既有设计：不注入不误红），故负例 CLI 单跑 exit 0；R6 判别力只在「有上游产物」或 self-test 注入形态下体现。
5. **仓外验收工作区**：`D:/w_skill_opt/_waveA_acceptance/`（差分脚本 `r6-differential.ts`、harness、日志、合成探针）不入库；复现方式见本文件 §2.4、§3.3、§6 的命令与说明。
