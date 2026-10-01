# 负向覆盖登记册（Negative Coverage Register）

> 本表由 `check-samples-coverage.ts` 的第 4 / 5 条规则强制：`w-model-dev/scripts/cli/*.ts` 减去
> `self-test.ts` 的**每一个 exit-2 门禁**都必须登记一条**会失败的**负向案例。全表 47 行，每门禁恰一行。
>
> - **第 4 条（登记完整性）**：未登记 → `negative-coverage-missing`（exit 1）。
> - **第 5 条（严格 + 真实探针）**：四列形态 `| 门禁 | fixture | 机制 | 所防回归 |`。
>   - **第 1 列（门禁）**：基名（`w-model-dev/scripts/cli/<name>.ts` 去掉 `.ts`）。
>   - **第 2 列（fixture）**：负向案例的落点。`fixture` 机制行写 `samples/...`（相对
>     `w-model-dev/scripts/`，不在盘 → `negative-coverage-dangling`；不以 `samples/` 开头 →
>     `negative-coverage-malformed`）；`invocation` / `mutated-copy` 行写承载负向调用的仓库相对文件
>     路径（相对 repo-root，不在盘 → `negative-coverage-dangling`）。
>   - **第 3 列（机制）**：只允许 `fixture` / `invocation` / `mutated-copy` 三值，表外值 →
>     `negative-coverage-unknown-mechanism`。
>   - **fixture 行三重判据（2026-09-27 任务 1 / T1 收紧）**：① fixture 在盘；② 该 fixture 被
>     `self-test.ts` 引用**恰一处**（多个用例条目同时覆盖 → `negative-coverage-ambiguous-coverage`；
>     无任何条目覆盖 → `negative-coverage-not-failing`）；③ 覆盖它的那个用例条目必须是**期望失败**用例
>     （`expectedPassed: false` / 非空 `expectedReasonPatterns` / `expectedBlocked: true` / 拒绝型
>     `expected`·`expectedStatus`）——诊断型 exit 0 这类**非失败样本不得占行**
>     （→ `negative-coverage-not-failing`）。
>   - 集合 / 语法类违规（各自具名）：`negative-coverage-malformed`（列数 ≠ 4 或空列）、
>     `negative-coverage-unknown-gate`（基名不在 exit-2 集合内）、`negative-coverage-duplicate`
>     （同一门禁多行）。
>   - **派生锚（取代手写锚，2026-09-27 任务 1 / T1）**：本表**不再手写**「证据位置 / 锚」——锚是
>     `self-test.ts` 覆盖信息的抄本，fixture 改名 / 搬迁 / 条目重排都要人工回填。每行的覆盖位置由门禁
>     从用例条目**派生**并输出 `self-test.ts#<覆盖条目标识>`（如 `self-test.ts#file: 'bad-ranking-k.json'`），
>     既进人类可读输出，也进 `SAMPLES_COVERAGE_JSON` 的 `derivedAnchors`（数组，顺序 = 本表行序）。
>     **已移除的上一版机制**：手写锚 `文件#唯一子串锚`（含「锚零命中 / 锚不唯一」判据）、全角分号 `；`
>     分隔的多锚语法、fixture 行锚相关度与共用锚判据，及其违规码 `negative-coverage-evidence-anchor` /
>     `-evidence-invalid` / `-evidence-relevance` / `-evidence-shared-anchor`。
>   - **真实 exit-2 探针**：逐门禁执行 `lib/exit2-probe-registry.ts`（与 `check-docs-consistency.ts`
>     中心探针**同一事实源**）登记的负向调用，**每个探针一个独立隔离根**（`mkdtemp` 后在该根内物化该
>     门禁的专用 fixture）并有界并发（4 路），断言 exit code=2、stdout 含可解析 `ERROR_JSON`
>     （`exitCode=2` 且 category 属 exit-2 类别）、stderr 含同类别人类错误行、且**该探针自己的**隔离根
>     调用前后逐项不变（不得留下半成品）。独立根是并发的前提，同时把不变量加强为「本探针在自己根内不留
>     半成品」（共享根只能做弱归因）；探针数量以 `lib/exit2-probe-registry.ts` 注册表为准，墙钟随机器与
>     并发度变化（串行 → 有界并发显著缩短，均不写死数字），断言一字未减。tsx 不可用等探针不可用情形按
>     失败处理，不静默跳过（→ `negative-coverage-probe-failed`）。
> - 口径与中心探针一致（47 个脚本；`security-scan.ts` / `wm-export-evidence.ts` / `wm-status.ts` /
>   `metrics-report.ts` 使用特殊探针参数，但仍计入集合）。
> - **所防回归**：若该负向案例被删掉 / 放宽，会漏掉的那一个具体回归；禁止「防止出错」这类空话。

## 一、`fixture` 机制（29 行）

| 门禁脚本                          | fixture                                                   | 机制    | 所防回归（一句话）                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| check-verifier-output             | `samples/verifier/bad-ranking-k.json`                     | fixture | 放宽分数与一致性不变量将漏掉 ranking.k=2.5 非整数、compositeScore≠Σ(score\*weight) 仍判 passed 的漂移                                                                            |
| check-artifact-gate               | `samples/gate/bad-rtm-coverage-below-100.json`            | fixture | 放宽覆盖率门禁将漏掉 RTM coveragePercent=66% < 100% 的工件仍被放行（约束 #3）；SDMAP 前缀精确对账/锚点校验放宽将漏掉幽灵 SD 与无锚点映射（bad-sdmap-mapping / bad-sdmap-anchor） |
| check-requirement-graph           | `samples/graph/bad-isolated.json`                         | fixture | 放宽图谱结构门将漏掉孤立节点（无入边 / 出边）被当作合法需求图放行                                                                                                                |
| check-tla-model                   | `samples/tla/bad-no-l1-root.json`                         | fixture | 放宽 manifest 校验将漏掉缺 L1 根节点的规格仍被当作可建模通过                                                                                                                     |
| check-bdd-model                   | `samples/bdd/bad-schema.manifest.json`                    | fixture | 放宽 BDD 校验将漏掉 manifest 缺必填字段仍通过 D1/D2                                                                                                                              |
| check-budget                      | `samples/budget/bad-stale.json`                           | fixture | 放宽 R1 时效性将漏掉过期 budget 不再被拦截，预算约束形同虚设                                                                                                                     |
| check-run-log                     | `samples/run-log/bad-incomplete.jsonl`                    | fixture | 放宽 R1 完整性将漏掉缺字段的 run-log 记录被静默接受                                                                                                                              |
| check-maturity                    | `samples/maturity/bad-stale.json`                         | fixture | 放宽周期校验将漏掉 maturity 过期未降级导致的成熟度虚高                                                                                                                           |
| check-checkpoint                  | `samples/checkpoint/bad-empty-decisions.jsonl`            | fixture | 放宽 R1 决策非空将漏掉空决策的 CHECKPOINT 被判通过（人类确认被绕过）                                                                                                             |
| check-code-tla-consistency        | `samples/code-tla/bad-sd-no-code-module.json`             | fixture | 放宽 SD→codeModule 将漏掉设计组件无对应实现仍通过一致性回归                                                                                                                      |
| check-rootcause-report            | `samples/rootcause/bad-r1-missing-fields.json`            | fixture | 放宽 R1 将漏掉缺必填字段的 RootCauseReport 被 V/G 接受进入返工                                                                                                                   |
| check-preventive-review           | `samples/preventive-review/valid-completeness.json`       | fixture | 去掉缺失维度断言后 reliability / security 缺二仍整体 passed=true                                                                                                                 |
| check-iceberg-sweep               | `samples/iceberg/bad-r6-wide-dd-drift.json`               | fixture | 放宽 R6 宽池 graph↔rtm 精确相等将漏掉 DD 漂移仍判三视角一致                                                                                                                      |
| check-role-dispatch               | `samples/run-log/bad-missing-V-role.jsonl`                | fixture | 放宽角色分派完整性（约束 #8）将漏掉阶段缺 V 分派记录仍通过                                                                                                                       |
| check-state-machine-consistency   | `samples/state-machine/bad-missing-transition.json`       | fixture | 放宽状态集 / 转移集一致将漏掉设计文档缺转移而代码存在该分支                                                                                                                      |
| check-codegraph-queries           | `samples/codegraph-queries/bad-degraded-without-evidence` | fixture | 放宽降级声明判据将漏掉无 `.codegraph/` 索引却缺 degradationReason / alternativeEvidence 的降级声明被当作已查询放行（D-6）                                                        |
| check-coding-plan                 | `samples/coding-plan/bad-review-empty`                    | fixture | 放宽 R5 内容下限（stage 审查产物 0 字节）将漏掉空审查产物被放行                                                                                                                  |
| check-requirement-coverage        | `samples/coverage/bad-empty-stakeholder.json`             | fixture | 放宽 C1-C10 将漏掉 stakeholder 覆盖率缺口与 metrics 重算不一致                                                                                                                   |
| check-exemption                   | `samples/exemption/bad-s-self-approve.json`               | fixture | 放宽 E1-E9 将漏掉 S 自批（缺人类四阶段审批）的豁免被放行                                                                                                                         |
| check-design-contract-consistency | `samples/design-contract/bad-path-mismatch.json`          | fixture | 放宽 D1-D4 将漏掉设计路径 / 参数 / 状态码 / 响应字段与实现不一致                                                                                                                 |
| check-signature-chain             | `samples/signature-chain/bad-missing-V.jsonl`             | fixture | 放宽 R1-R10 将漏掉缺 V 签名或被篡改的链条被判完整                                                                                                                                |
| check-archive-integrity           | `samples/archive-integrity/bad-missing-phase1-docs.json`  | fixture | 放宽归档清单校验将漏掉引用缺失文件仍判归档成功                                                                                                                                   |
| code-health-gap                   | `samples/code-health/phase2/missing-security.json`        | fixture | 放宽七维度 gap 将漏掉缺 security 维度却因 coverage=100% 被授权跳过                                                                                                               |
| code-health-tests                 | `samples/code-health/phase3/bad-author-age-deletion.json` | fixture | 放宽受保护测试 inventory 将漏掉以作者年龄作删除依据的受保护测试误删                                                                                                              |
| code-health-apply                 | `samples/code-health/apply/approval-required.json`        | fixture | 放宽 approval gate 将漏掉无人类 approval 的删除提案被应用（scope 失控）                                                                                                          |
| code-health-duplicates            | `samples/code-health/phase4/bad-test-only.json`           | fixture | 放宽 abstraction guard 将漏掉 test-only 调用点被当作可抽象权威而错误授权合并                                                                                                     |
| code-health-phase1                | `samples/code-health/phase1/static/blocked.json`          | fixture | 放宽只读发现将漏掉源文件不可读时产出 dead 结论（把「未知」误判为「可删」）                                                                                                       |
| check-tla-bdd-sync                | `samples/tla-bdd-sync/bad-transition-mismatch.json`       | fixture | 去掉转移等价断言后 TLA+ 转移在 BDD 中缺对应 When 步骤仍判等价                                                                                                                    |
| check-design-fog                  | `samples/design-fog/bad-unresolved-fog.md`                | fixture | 放宽 R4 终结性（处置结果空/待定放行）将让未毕业迷雾项静默通过阶段门，迷雾逃逸设计义务且绕过三选一毕业处置                                                                        |

## 二、`invocation` / `mutated-copy` 机制（18 行）

| 门禁脚本                  | fixture                                                                                                             | 机制         | 所防回归（一句话）                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| check-docs-consistency    | `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（同测试变异 SKILL.md 的 .ts 计数后过滤违规）         | mutated-copy | 去掉该计数变异断言后，script-registry 维度退化为空转 / 假绿，SKILL.md 的 `.ts` 计数改错（如 44→43）无人发现                                                                                |
| check-samples-coverage    | `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`（缺 NEGATIVE-COVERAGE.md 的用例；同测试断言 exit 2） | invocation   | 缺失必需文件（清单本身）不再 exit 2 时，清单缺失会被当作通过，负向覆盖不变量静默失效                                                                                                       |
| check-pollution           | `w-model-dev/scripts/__tests__/check-pollution-cli.test.ts`（同测试断言项目目录快照逐字节不变）                     | invocation   | 未知 flag 不在任何扫描前被拒时，污染定位会在非法参数下继续跑（半程结果被当作结论），「吞掉测试失败只看产物」的工具自己先吞掉输入错误                                                       |
| check-coverage-scope      | `w-model-dev/scripts/__tests__/check-coverage-scope.test.ts`（同测试断言 stdout 含 ERROR_JSON 且 stderr 含 `✗ [`）  | invocation   | 未知 flag 不在任何扫描前被拒时，覆盖口径门禁会以残缺参数继续跑并把半程结果当结论，白名单失配被静默掩盖                                                                                     |
| code-health-archive       | `w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts`                                                | invocation   | malformed produce 输入不被 exit 2 拒绝，归档会写入半成品证据                                                                                                                               |
| code-health-ledger        | `w-model-dev/scripts/__tests__/code-health-cli.test.ts`                                                             | invocation   | 未知子命令不再 exit 2，append-only ledger 可能被非法子命令破坏                                                                                                                             |
| doctor                    | `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts`（同测试逐门禁循环对 doctor 断言 exit 2）            | invocation   | doctor 对非法参数返回 0/1 而非 2，环境缺失会被误报为通过                                                                                                                                   |
| ensure-codegraph          | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts`                                                            | invocation   | 非法 / 重复 phase 不再 exit 2，「重复值 flag」会以 last-wins 参数静默安装依赖                                                                                                              |
| metrics-report            | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts`                                                            | invocation   | 非法 `--phase` 不再 exit 2，度量报告会在错误阶段上给出结论                                                                                                                                 |
| plan-chunks               | `w-model-dev/scripts/__tests__/cli-arg-unification.test.ts`                                                         | invocation   | 重复 `--phase` 返回 0，分块规划会按 first-wins 的静默阶段执行                                                                                                                              |
| platform-deps-install     | `w-model-dev/scripts/__tests__/platform-deps-install.test.ts`                                                       | invocation   | 缺 `--lockfile` / `--package` 不再 exit 2，平台依赖会在未验证 lockfile 时安装                                                                                                              |
| review-package            | `w-model-dev/scripts/__tests__/review-package-cli.test.ts`（同测试断言目标 out 路径零文件）                         | invocation   | 未知 flag 不在任何写盘前被拒时，评审包会以残缺参数先写盘再失败，留下半成品或覆盖既有 diff 文件（exit-2 失败原子性失守）                                                                    |
| security-scan             | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts`                                                            | invocation   | baseline 缺失不再 exit 2，扫描会以「无新增」通过而实际未做比对                                                                                                                             |
| wm-append-runlog          | `w-model-dev/scripts/__tests__/wm-append-runlog-cli.test.ts`（同测试断言零创建 / 时间戳倒退且文件 sha256 不变）     | invocation   | 重复值 flag（--timestamp）不再 exit 2 时，追加器会按 last-wins 静默改写时间戳来源；时间戳倒退不再 exit 1 时，run-log 的严格递增 / append-only 契约退化——即手搓追加脚本静默覆盖时间戳的复现 |
| wm-export-evidence        | `w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`                                                       | invocation   | 非法参数不再 exit 2 且可能建出输出目录，导出会留下半成品证据包                                                                                                                             |
| wm-status                 | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts`                                                            | invocation   | project.json 损坏不再 exit 2，状态快照会以默认值给出假状态                                                                                                                                 |
| wm-verify-evidence-source | `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts`（同测试逐门禁循环断言 exit 2）                      | invocation   | 非法参数不再 exit 2，provenance 会以 package-only 冒充 source-bound 证据                                                                                                                   |
| wm-write                  | `w-model-dev/scripts/__tests__/wm-write.test.ts`                                                                    | invocation   | 非法 `--lock-timeout`（负数 / 小数 / 非数字）不再 exit 2，锁超时会以未定义值执行                                                                                                           |

> **2026-09-27 任务 1（T1）迁移说明（逐行裁定的两处具名结果，其余 44 行 fixture / 落点不变）**：
>
> - `check-artifact-gate` 行原指向 `samples/gate/valid-phase6.json`——该 fixture 被 3 个用例条目覆盖
>   （1 个期望通过 + 2 个期望失败），不满足「恰一处」，故换件为唯一覆盖且期望失败的
>   `samples/gate/bad-rtm-coverage-below-100.json`。原「phase=8 终检 system/acceptance pending」断言仍在
>   `self-test.ts` 的 `GATE_CASES` 中执行（只是不再占本表行）。
> - `check-budget` 行原附带诊断型样本 `samples/run-log/bad-duplicate-groups.jsonl`（G3-15 疑似重复归账，
>   实测 exit 0、仅非阻断诊断）——非失败样本不占行；其归属仍由 `samples/README.md` 矩阵与
>   `BUDGET_RUN_LOG_CASES` 用例承担。本行失败证据为 `samples/budget/bad-stale.json`。
> - `check-verifier-output`（D-10 形态三样本）、`check-maturity`（R5 真值通道样本）、
>   `check-codegraph-queries`（G4-2 空查询目录 / 无索引两样本）、`check-coding-plan`（bad-missing-ledger /
>   bad-task-missing-verify）等行原列的同门禁**其余**样本，同样因「一行一 fixture」不再列出——它们仍由
>   `self-test.ts` 的对应用例数组逐条执行，所防回归未失守。
