# 负向覆盖登记册（Negative Coverage Register）

> 本表由 `check-samples-coverage.ts` 的第 4 条规则强制：`w-model-dev/scripts/cli/*.ts` 减去
> `self-test.ts` 的**每一个 exit-2 门禁**都必须登记一条**会失败的**负向案例。未登记 →
> `negative-coverage-missing`（exit 1）；`fixture` 机制的证据路径必须在盘存在，否则 →
> `negative-coverage-dangling`（exit 1）。口径与 `check-docs-consistency.ts` 的 exit-2 中心探针一致
> （44 个脚本；`security-scan.ts` / `wm-export-evidence.ts` / `wm-status.ts` / `metrics-report.ts`
> 使用特殊探针参数，但仍计入集合）。
>
> - **门禁脚本**：基名（`w-model-dev/scripts/cli/<name>.ts` 去掉 `.ts`）。全表 44 行，每门禁恰一行。
> - **负向机制**：只允许 `fixture`（在盘 `samples/` fixture）/ `invocation`（CLI 参数或测试临时目录调用）/
>   `mutated-copy`（测试内改写文本副本）三种。
> - **负向案例 / 证据位置**：`fixture` 行写 `` `samples/...` ``（相对 `w-model-dev/scripts/`），可附
>   `（self-test.ts:<行>）`；`invocation` / `mutated-copy` 行写 `文件:行号`。
> - `由任务 3 的 exit2-failure-atomicity.test.ts 提供`：该门禁当前没有既有 exit-2 断言，其负向断言由
>   P2-A 任务 3 统一建立（此处如实登记为缺口，不冒充既有证据）。
> - **所防回归**：若该负向案例被删掉 / 放宽，会漏掉的那一个具体回归；禁止「防止出错」这类空话。

### A 组（含 B 组强化两行）：已有强负向 fixture（28）

| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |
| --- | --- | --- | --- |
| check-verifier-output | fixture | `samples/verifier/bad-ranking-k.json`（self-test.ts:178） | 放宽分数与一致性不变量将漏掉 ranking.k=2.5 非整数、compositeScore≠Σ(score*weight) 仍判 passed 的漂移 |
| check-artifact-gate | fixture | `samples/gate/valid-phase6.json`（self-test.ts:381，B 组强化后断言 /待执行/） | 去掉 /待执行/ 断言后 phase=8 终检会漏掉 system/acceptance 仍 pending 却被判合格 |
| check-requirement-graph | fixture | `samples/graph/bad-isolated.json`（self-test.ts:454） | 放宽图谱结构门将漏掉孤立节点（无入边/出边）被当作合法需求图放行 |
| check-tla-model | fixture | `samples/tla/bad-no-l1-root.json`（self-test.ts:975） | 放宽 manifest 校验将漏掉缺 L1 根节点的规格仍被当作可建模通过 |
| check-bdd-model | fixture | `samples/bdd/bad-schema.manifest.json`（self-test.ts:1824） | 放宽 BDD 校验将漏掉 manifest 缺必填字段仍通过 D1/D2 |
| check-budget | fixture | `samples/budget/bad-stale.json`（self-test.ts:1104） | 放宽 R1 时效性将漏掉过期 budget 不再被拦截，预算约束形同虚设 |
| check-run-log | fixture | `samples/run-log/bad-incomplete.jsonl`（self-test.ts:1152） | 放宽 R1 完整性将漏掉缺字段的 run-log 记录被静默接受 |
| check-maturity | fixture | `samples/maturity/bad-stale.json`（self-test.ts:1269） | 放宽周期校验将漏掉 maturity 过期未降级导致的成熟度虚高 |
| check-checkpoint | fixture | `samples/checkpoint/bad-empty-decisions.jsonl`（self-test.ts:1303） | 放宽 R1 决策非空将漏掉空决策的 CHECKPOINT 被判通过（人类确认被绕过） |
| check-code-tla-consistency | fixture | `samples/code-tla/bad-sd-no-code-module.json`（self-test.ts:1330） | 放宽 SD→codeModule 将漏掉设计组件无对应实现仍通过一致性回归 |
| check-rootcause-report | fixture | `samples/rootcause/bad-r1-missing-fields.json`（self-test.ts:1369） | 放宽 R1 将漏掉缺必填字段的 RootCauseReport 被 V/G 接受进入返工 |
| check-preventive-review | fixture | `samples/preventive-review/valid-completeness.json`（self-test.ts:1452，B 组强化后断言 /R3 报告缺失/） | 去掉缺失维度断言后 reliability/security 缺二仍整体 passed=true |
| check-iceberg-sweep | fixture | `samples/iceberg/bad-round-out-of-range.json`（self-test.ts:1500） | 放宽 R1-R5 将漏掉 iceberg round 越界（超过 maxIcebergRounds）仍被接受 |
| check-role-dispatch | fixture | `samples/run-log/bad-missing-V-role.jsonl`（self-test.ts:1580） | 放宽角色分派完整性（约束 #8）将漏掉阶段缺 V 分派记录仍通过 |
| check-state-machine-consistency | fixture | `samples/state-machine/bad-missing-transition.json`（self-test.ts:1610） | 放宽状态集/转移集一致将漏掉设计文档缺转移而代码存在该分支 |
| check-codegraph-queries | fixture | `samples/codegraph-queries/bad-empty`（self-test.ts:1647） | 放宽查询落盘覆盖将漏掉未做 codegraph 查询（空目录）直接改代码（反模式 #38 逃逸） |
| check-opsx-artifacts | fixture | `samples/opsx-artifacts/bad-missing-tickets`（self-test.ts:1686） | 放宽制品齐全性将漏掉缺 tickets 或 R3/V 审查产物的变更进入 apply（反模式 #39/#40） |
| check-openspec-archive | fixture | `samples/openspec-archive/bad-no-archive`（self-test.ts:1719） | 放宽归档校验将漏掉未归档的 change 被判归档完成 |
| check-requirement-coverage | fixture | `samples/coverage/bad-empty-stakeholder.json`（self-test.ts:1963） | 放宽 C1-C10 将漏掉 stakeholder 覆盖率缺口与 metrics 重算不一致 |
| check-exemption | fixture | `samples/exemption/bad-s-self-approve.json`（self-test.ts:2027） | 放宽 E1-E9 将漏掉 S 自批（缺人类四阶段审批）的豁免被放行 |
| check-design-contract-consistency | fixture | `samples/design-contract/bad-path-mismatch.json`（self-test.ts:2078） | 放宽 D1-D4 将漏掉设计路径/参数/状态码/响应字段与实现不一致 |
| check-signature-chain | fixture | `samples/signature-chain/bad-missing-V.jsonl`（self-test.ts:2126） | 放宽 R1-R10 将漏掉缺 V 签名或被篡改的链条被判完整 |
| check-archive-integrity | fixture | `samples/archive-integrity/bad-missing-phase1-docs.json`（self-test.ts:2236） | 放宽归档清单校验将漏掉引用缺失文件仍判归档成功 |
| code-health-gap | fixture | `samples/code-health/phase2/missing-security.json`（self-test.ts:2659） | 放宽七维度 gap 将漏掉缺 security 维度却因 coverage=100% 被授权跳过 |
| code-health-tests | fixture | `samples/code-health/phase3/bad-author-age-deletion.json`（self-test.ts:2745） | 放宽受保护测试 inventory 将漏掉以作者年龄作删除依据的受保护测试误删 |
| code-health-apply | fixture | `samples/code-health/apply/approval-required.json`（self-test.ts:2610） | 放宽 approval gate 将漏掉无人类 approval 的删除提案被应用（scope 失控） |
| code-health-duplicates | fixture | `samples/code-health/phase4/bad-test-only.json`（self-test.ts:2826） | 放宽 abstraction guard 将漏掉 test-only 调用点被当作可抽象权威而错误授权合并 |
| code-health-phase1 | fixture | `samples/code-health/phase1/static/blocked.json`（self-test.ts:2546） | 放宽只读发现将漏掉源文件不可读时产出 dead 结论（把「未知」误判为「可删」） |

### B 组：仅 B 覆盖的门禁（1）

| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |
| --- | --- | --- | --- |
| check-tla-bdd-sync | fixture | `samples/tla-bdd-sync/bad-transition-mismatch.json`（self-test.ts:1562，任务 1 强化后断言转移未找到） | 去掉转移等价断言后 TLA+ 转移在 BDD 中缺对应 When 步骤仍判等价 |

### C 组：负向输入是参数或变异副本（15）

| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |
| --- | --- | --- | --- |
| check-docs-consistency | mutated-copy | `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts:2347` | 去掉该计数变异断言后，script-registry 维度退化为空转/假绿，SKILL.md 的 `.ts` 计数改错（如 44→43）无人发现 |
| check-samples-coverage | invocation | `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts:228`（缺 NEGATIVE-COVERAGE.md → exit 2） | 缺失必需文件（清单本身）不再 exit 2 时，清单缺失会被当作通过，负向覆盖不变量静默失效 |
| code-health-archive | invocation | `w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts:710` | malformed produce 输入不被 exit 2 拒绝，归档会写入半成品证据 |
| code-health-ledger | invocation | `w-model-dev/scripts/__tests__/code-health-cli.test.ts:696` | 未知子命令不再 exit 2，append-only ledger 可能被非法子命令破坏 |
| doctor | invocation | 由任务 3 的 exit2-failure-atomicity.test.ts 提供 | doctor 对非法参数返回 0/1 而非 2，环境缺失会被误报为通过 |
| ensure-codegraph-opsx | invocation | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts:293` | 非法/重复 phase 不再 exit 2，「重复值 flag」会以 last-wins 参数静默安装依赖 |
| metrics-report | invocation | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts:176` | 非法 `--phase` 不再 exit 2，度量报告会在错误阶段上给出结论 |
| plan-chunks | invocation | `w-model-dev/scripts/__tests__/cli-arg-unification.test.ts:139` | 重复 `--phase` 返回 0，分块规划会按 first-wins 的静默阶段执行 |
| platform-deps-install | invocation | `w-model-dev/scripts/__tests__/platform-deps-install.test.ts:1173` | 缺 `--lockfile` / `--package` 不再 exit 2，平台依赖会在未验证 lockfile 时安装 |
| review-package | invocation | `w-model-dev/scripts/__tests__/review-package-cli.test.ts:163`（同测试 :166 断言目标 out 路径零文件） | 未知 flag 不在任何写盘前被拒时，评审包会以残缺参数先写盘再失败，留下半成品或覆盖既有 diff 文件（exit-2 失败原子性失守） |
| security-scan | invocation | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts:217` | baseline 缺失不再 exit 2，扫描会以「无新增」通过而实际未做比对 |
| wm-export-evidence | invocation | `w-model-dev/scripts/__tests__/evidence-export-logic.test.ts:1191` | 非法参数不再 exit 2 且可能建出输出目录，导出会留下半成品证据包 |
| wm-status | invocation | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts:231` | project.json 损坏不再 exit 2，状态快照会以默认值给出假状态 |
| wm-verify-evidence-source | invocation | 由任务 3 的 exit2-failure-atomicity.test.ts 提供 | 非法参数不再 exit 2，provenance 会以 package-only 冒充 source-bound 证据 |
| wm-write | invocation | `w-model-dev/scripts/__tests__/wm-write.test.ts:196` | 非法 `--lock-timeout`（负数/小数/非数字）不再 exit 2，锁超时会以未定义值执行 |

> 重叠说明：`check-artifact-gate` / `check-preventive-review` 同属计划的 A、B 两组，本表只在 A 段各登记
> 一行，证据取任务 1（`56fde6d0`）强化后的断言行，避免同一门禁出现两行。
