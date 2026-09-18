# 负向覆盖登记册（Negative Coverage Register）

> 本表由 `check-samples-coverage.ts` 的第 4 / 5 条规则强制：`w-model-dev/scripts/cli/*.ts` 减去
> `self-test.ts` 的**每一个 exit-2 门禁**都必须登记一条**会失败的**负向案例。
>
> - **第 4 条（登记完整性）**：未登记 → `negative-coverage-missing`（exit 1）。
> - **第 5 条（严格 + 可执行）**：登记行必须**语法完整**（每行恰四列且四列非空）、**证据可解析**、
>   且经**真实 exit-2 探针**验证——登记不是「写一行」就成立：
>   - 语法/集合类违规（各自具名）：`negative-coverage-malformed`（列数或空列）、
>     `negative-coverage-unknown-mechanism`（机制不在三值内）、`negative-coverage-unknown-gate`
>     （登记的基名不在 exit-2 集合内）、`negative-coverage-duplicate`（同一门禁多行）；
>   - 证据类违规：`fixture` 证据路径必须项目内在盘（`negative-coverage-dangling`）；
>     `invocation` / `mutated-copy` 证据与 `fixture` 行的引用位置都必须解析为**锚寻址** `文件#锚`
>     （`negative-coverage-evidence-anchor`）——正文只写「由某任务提供」**不是证据**
>     （未解析出锚式引用 → `negative-coverage-evidence-invalid`）；`fixture` 行的锚还须落在登记该
>     fixture 的用例条目内，且同一 `引用文件#锚` 不得被两条指向不同 fixture 的 fixture 行共用
>     （`negative-coverage-evidence-relevance` / `negative-coverage-evidence-shared-anchor`）；
>   - 探针类违规：`negative-coverage-probe-failed`——执行
>     `lib/exit2-probe-registry.ts`（与 `check-docs-consistency.ts` 中心探针**同一事实源**）登记的负向调用，
>     **每个探针一个独立隔离根**（`mkdtemp` 后在该根内物化该门禁的专用 fixture）并有界并发（4 路），
>     断言 exit code=2、stdout 含可解析 `ERROR_JSON`（`exitCode=2` 且 category 属 exit-2 类别）、
>     stderr 含同类别人类错误行、且**该探针自己的**隔离根调用前后逐项不变（不得留下半成品）。
>     独立根是并发的前提，同时把不变量加强为「本探针在自己根内不留半成品」（共享根只能做弱归因）；
>     实测 48 探针由串行 71s 降至约 22s，断言一字未减。tsx 不可用等
>     探针不可用情形按失败处理，不静默跳过。
> - 口径与中心探针一致（46 个脚本；`security-scan.ts` / `wm-export-evidence.ts` / `wm-status.ts` /
>   `metrics-report.ts` 使用特殊探针参数，但仍计入集合）。
>
> - **门禁脚本**：基名（`w-model-dev/scripts/cli/<name>.ts` 去掉 `.ts`）。全表 46 行，每门禁恰一行。
> - **负向机制**：只允许 `fixture`（在盘 `samples/` fixture）/ `invocation`（CLI 参数或测试临时目录调用）/
>   `mutated-copy`（测试内改写文本副本）三种。
> - **负向案例 / 证据位置**：`fixture` 行写 `` `samples/...` ``（相对 `w-model-dev/scripts/`），并附
>   `` `self-test.ts#锚` ``——该引用**由门禁校验**（旧版头注称其「不参与校验」，与代码不符，此处按代码
>   真实行为更正）；`invocation` / `mutated-copy` 行写 `` `文件#锚` ``（相对 repo-root）。
> - **引用判据（2026-09-18 任务 3.5 起为锚寻址）**：`#` 后是**锚**——被指行在该文件内**恰好出现一次**
>   的特征子串（通常直接取该行 trim 后的文本，行尾 ASCII 逗号可省）。门禁校验三件事：引用文件存在且
>   为普通文件、锚非空、**锚在该文件内命中次数恰为 1**（0 命中 =「锚零命中」，>1 =「锚不唯一」，
>   违规码均为 `negative-coverage-evidence-anchor`）。**fixture 行另有两项相关度判据**（2026-09-18
>   修复轮补回：锚唯一只约束「在被引文件内唯一」，不蕴含「与本条 fixture 相关」；违规码
>   `negative-coverage-evidence-relevance` / `negative-coverage-evidence-shared-anchor`）：锚必须落在
>   **self-test.ts 内登记该 fixture 的用例条目**内（条目 = `_CASES` 数组内的对象字面量，条目登记的
>   `file` / `manifestFile` / `ticketsFile` / `featureFiles` / `auxFiles` / `sampleDir` 须覆盖该 fixture；
>   锚指到别的 fixture 的条目 → exit 1），且同一 `引用文件#锚` 不得被两条指向不同 fixture 的 fixture
>   行共用。锚内不得含全角逗号 / 全角括号 / 全角分号 / `#` /
>   反引号（这些字符标志锚结束），锚之后的文字是描述性备注。整条引用裹为 Markdown 行内代码（反引号）：
>   `w-model-dev/scripts/__tests__/...` 一类路径含 `__`，不裹代码会被 Markdown 当作强调而改写
>   （prettier 重排实测会渲染成 `**tests**`）。
> - **为什么不再用行号**：行号是位置、不是内容——被引文件上方插入任意行即整表漂移（2026-09-17 实测
>   29 条 fixture 行号全部漂移；2026-09-18 同一会话内三次人工回填），而门禁真正依赖的是内容。锚是
>   内容寻址：插行不漂移，被指内容改写或搬走则立即「零命中」失败。旧行号语法（文件后跟冒号加数字）
>   一律判违规，不留双语法兼容。
> - **锚的选取约定**：`fixture` 行取自引用该 fixture 的**用例条目**（`file:` / `manifestFile:` /
>   `sampleDir:` 行；该行不唯一时取该用例条目内另一条唯一行）——这条对 fixture 行**由门禁强制到条目
>   粒度**（锚落在别的 fixture 的条目或别的文件上即 exit 1，见上）；C 组取自对应断言行或该用例的
>   `it(...)` 标题行，仍是约定（门禁只强制「文件在盘 + 锚唯一」）。
> - **为什么「锚唯一」本身不蕴含相关度**（2026-09-18 修复轮更正此处旧表述）：锚的唯一性是**在被引文件
>   内**唯一，并不要求跨条目 / 跨行互异——旧版头注称「锚唯一性来强制二者各自锚到自己的用例条目」是
>   错的说法（实现自身即可用同一锚登记两条 fixture 行）。`budget` 与 `maturity` 的 `bad-stale.json`
>   同名，两个用例条目内都含 `bad-stale.json`，因此「条目内含 fixture 基名」这类粗判据对这对 fixture
>   恒真；两行互换锚时每条锚在被引文件内**仍各自唯一**，唯一性判据同样不报错。现在的判据落在**条目
>   归属**上：锚必须落在登记该 fixture 的用例条目内（同名 fixture 分属不同条目，故可区分），并叠加
>   「同一 `引用文件#锚` 不得被两条指向不同 fixture 的 fixture 行共用」。
> - **所防回归**：若该负向案例被删掉 / 放宽，会漏掉的那一个具体回归；禁止「防止出错」这类空话。

### A 组（含 B 组强化两行）：已有强负向 fixture（28）

| 门禁脚本                          | 负向机制 | 负向案例 / 证据位置                                                                                                                 | 所防回归（一句话）                                                                                   |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| check-verifier-output             | fixture  | `samples/verifier/bad-ranking-k.json`（`self-test.ts#file: 'bad-ranking-k.json'`）                                                  | 放宽分数与一致性不变量将漏掉 ranking.k=2.5 非整数、compositeScore≠Σ(score*weight) 仍判 passed 的漂移 |
| check-artifact-gate               | fixture  | `samples/gate/valid-phase6.json`（`self-test.ts#expectedReasonPatterns: [/待执行/]`，phase=8 终检应失败）                           | 去掉 /待执行/ 断言后 phase=8 终检会漏掉 system/acceptance 仍 pending 却被判合格                      |
| check-requirement-graph           | fixture  | `samples/graph/bad-isolated.json`（`self-test.ts#file: 'bad-isolated.json'`）                                                       | 放宽图谱结构门将漏掉孤立节点（无入边/出边）被当作合法需求图放行                                      |
| check-tla-model                   | fixture  | `samples/tla/bad-no-l1-root.json`（`self-test.ts#file: 'bad-no-l1-root.json'`）                                                     | 放宽 manifest 校验将漏掉缺 L1 根节点的规格仍被当作可建模通过                                         |
| check-bdd-model                   | fixture  | `samples/bdd/bad-schema.manifest.json`（`self-test.ts#manifestFile: 'bad-schema.manifest.json'`）                                   | 放宽 BDD 校验将漏掉 manifest 缺必填字段仍通过 D1/D2                                                  |
| check-budget                      | fixture  | `samples/budget/bad-stale.json`（`self-test.ts#expectedReasonPatterns: [/updatedAt == createdAt/]`）                                | 放宽 R1 时效性将漏掉过期 budget 不再被拦截，预算约束形同虚设                                         |
| check-run-log                     | fixture  | `samples/run-log/bad-incomplete.jsonl`（`self-test.ts#file: 'bad-incomplete.jsonl'`）                                               | 放宽 R1 完整性将漏掉缺字段的 run-log 记录被静默接受                                                  |
| check-maturity                    | fixture  | `samples/maturity/bad-stale.json`（`self-test.ts#expectedReasonPatterns: [/\[schema\].*level/]`）                                   | 放宽周期校验将漏掉 maturity 过期未降级导致的成熟度虚高                                               |
| check-checkpoint                  | fixture  | `samples/checkpoint/bad-empty-decisions.jsonl`（`self-test.ts#file: 'bad-empty-decisions.jsonl'`）                                  | 放宽 R1 决策非空将漏掉空决策的 CHECKPOINT 被判通过（人类确认被绕过）                                 |
| check-code-tla-consistency        | fixture  | `samples/code-tla/bad-sd-no-code-module.json`（`self-test.ts#file: 'bad-sd-no-code-module.json'`）                                  | 放宽 SD→codeModule 将漏掉设计组件无对应实现仍通过一致性回归                                          |
| check-rootcause-report            | fixture  | `samples/rootcause/bad-r1-missing-fields.json`（`self-test.ts#file: 'bad-r1-missing-fields.json'`）                                 | 放宽 R1 将漏掉缺必填字段的 RootCauseReport 被 V/G 接受进入返工                                       |
| check-preventive-review           | fixture  | `samples/preventive-review/valid-completeness.json`（`self-test.ts#file: 'valid-completeness.json'`，B 组强化后断言 /R3 报告缺失/） | 去掉缺失维度断言后 reliability/security 缺二仍整体 passed=true                                       |
| check-iceberg-sweep               | fixture  | `samples/iceberg/bad-round-out-of-range.json`（`self-test.ts#file: 'bad-round-out-of-range.json'`）                                 | 放宽 R1-R5 将漏掉 iceberg round 越界（超过 maxIcebergRounds）仍被接受                                |
| check-role-dispatch               | fixture  | `samples/run-log/bad-missing-V-role.jsonl`（`self-test.ts#file: 'bad-missing-V-role.jsonl'`）                                       | 放宽角色分派完整性（约束 #8）将漏掉阶段缺 V 分派记录仍通过                                           |
| check-state-machine-consistency   | fixture  | `samples/state-machine/bad-missing-transition.json`（`self-test.ts#file: 'bad-missing-transition.json'`）                           | 放宽状态集/转移集一致将漏掉设计文档缺转移而代码存在该分支                                            |
| check-codegraph-queries           | fixture  | `samples/codegraph-queries/bad-empty`（`self-test.ts#sampleDir: 'codegraph-queries/bad-empty'`）                                    | 放宽查询落盘覆盖将漏掉未做 codegraph 查询（空目录）直接改代码（反模式 #38 逃逸）                     |
| check-opsx-artifacts              | fixture  | `samples/opsx-artifacts/bad-missing-tickets`（`self-test.ts#sampleDir: 'opsx-artifacts/bad-missing-tickets'`）                      | 放宽制品齐全性将漏掉缺 tickets 或 R3/V 审查产物的变更进入 apply（反模式 #39/#40）                    |
| check-openspec-archive            | fixture  | `samples/openspec-archive/bad-no-archive`（`self-test.ts#sampleDir: 'openspec-archive/bad-no-archive'`）                            | 放宽归档校验将漏掉未归档的 change 被判归档完成                                                       |
| check-requirement-coverage        | fixture  | `samples/coverage/bad-empty-stakeholder.json`（`self-test.ts#file: 'bad-empty-stakeholder.json'`）                                  | 放宽 C1-C10 将漏掉 stakeholder 覆盖率缺口与 metrics 重算不一致                                       |
| check-exemption                   | fixture  | `samples/exemption/bad-s-self-approve.json`（`self-test.ts#file: 'bad-s-self-approve.json'`）                                       | 放宽 E1-E9 将漏掉 S 自批（缺人类四阶段审批）的豁免被放行                                             |
| check-design-contract-consistency | fixture  | `samples/design-contract/bad-path-mismatch.json`（`self-test.ts#file: 'bad-path-mismatch.json'`）                                   | 放宽 D1-D4 将漏掉设计路径/参数/状态码/响应字段与实现不一致                                           |
| check-signature-chain             | fixture  | `samples/signature-chain/bad-missing-V.jsonl`（`self-test.ts#file: 'bad-missing-V.jsonl'`）                                         | 放宽 R1-R10 将漏掉缺 V 签名或被篡改的链条被判完整                                                    |
| check-archive-integrity           | fixture  | `samples/archive-integrity/bad-missing-phase1-docs.json`（`self-test.ts#file: 'bad-missing-phase1-docs.json'`）                     | 放宽归档清单校验将漏掉引用缺失文件仍判归档成功                                                       |
| code-health-gap                   | fixture  | `samples/code-health/phase2/missing-security.json`（`self-test.ts#file: 'missing-security.json'`）                                  | 放宽七维度 gap 将漏掉缺 security 维度却因 coverage=100% 被授权跳过                                   |
| code-health-tests                 | fixture  | `samples/code-health/phase3/bad-author-age-deletion.json`（`self-test.ts#file: 'bad-author-age-deletion.json'`）                    | 放宽受保护测试 inventory 将漏掉以作者年龄作删除依据的受保护测试误删                                  |
| code-health-apply                 | fixture  | `samples/code-health/apply/approval-required.json`（`self-test.ts#file: 'approval-required.json'`）                                 | 放宽 approval gate 将漏掉无人类 approval 的删除提案被应用（scope 失控）                              |
| code-health-duplicates            | fixture  | `samples/code-health/phase4/bad-test-only.json`（`self-test.ts#file: 'bad-test-only.json'`）                                        | 放宽 abstraction guard 将漏掉 test-only 调用点被当作可抽象权威而错误授权合并                         |
| code-health-phase1                | fixture  | `samples/code-health/phase1/static/blocked.json`（`self-test.ts#expectedBlocked: true`）                                            | 放宽只读发现将漏掉源文件不可读时产出 dead 结论（把「未知」误判为「可删」）                           |

### B 组：仅 B 覆盖的门禁（1）

| 门禁脚本           | 负向机制 | 负向案例 / 证据位置                                                                                                                     | 所防回归（一句话）                                            |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| check-tla-bdd-sync | fixture  | `samples/tla-bdd-sync/bad-transition-mismatch.json`（`self-test.ts#file: 'bad-transition-mismatch.json'`，任务 1 强化后断言转移未找到） | 去掉转移等价断言后 TLA+ 转移在 BDD 中缺对应 When 步骤仍判等价 |

### C 组：负向输入是参数或变异副本（17）

| 门禁脚本                  | 负向机制     | 负向案例 / 证据位置                                                                                                                                                                                | 所防回归（一句话）                                                                                                                   |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| check-docs-consistency    | mutated-copy | `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts#it('SKILL.md 声明 .ts 计数与实测不符 → script-registry 违规', () => {`（同测试变异 SKILL.md 的 .ts 计数后过滤 script-registry 违规） | 去掉该计数变异断言后，script-registry 维度退化为空转/假绿，SKILL.md 的 `.ts` 计数改错（如 44→43）无人发现                            |
| check-samples-coverage    | invocation   | `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts#expect(r.stdout).toContain('NEGATIVE-COVERAGE.md');`（缺 NEGATIVE-COVERAGE.md 的用例断言行；同测试上一行断言 exit 2）                | 缺失必需文件（清单本身）不再 exit 2 时，清单缺失会被当作通过，负向覆盖不变量静默失效                                                 |
| check-pollution           | invocation   | `w-model-dev/scripts/__tests__/check-pollution-cli.test.ts#expect(run.stderr).toContain('✗ [ARG_INVALID]');`（同测试断言项目目录快照逐字节不变）                                                   | 未知 flag 不在任何扫描前被拒时，污染定位会在非法参数下继续跑（半程结果被当作结论），「吞掉测试失败只看产物」的工具自己先吞掉输入错误 |
| check-coverage-scope      | invocation   | `w-model-dev/scripts/__tests__/check-coverage-scope.test.ts#expect(runCli(['--nope', 'x', ...FLAGS]).code).toBe(2);`（同测试断言 stdout 含 ERROR_JSON 且 stderr 含 `✗ [`）                         | 未知 flag 不在任何扫描前被拒时，覆盖口径门禁会以残缺参数继续跑并把半程结果当结论，白名单失配被静默掩盖                               |
| code-health-archive       | invocation   | `w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts#expect(malformedProduce.exitCode).toBe(2);`                                                                                    | malformed produce 输入不被 exit 2 拒绝，归档会写入半成品证据                                                                         |
| code-health-ledger        | invocation   | `w-model-dev/scripts/__tests__/code-health-cli.test.ts#expect(unknown.code).toBe(2);`                                                                                                              | 未知子命令不再 exit 2，append-only ledger 可能被非法子命令破坏                                                                       |
| doctor                    | invocation   | `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts#const outcome = await runNegativeProbe(gateFile, probeRoot);`（同测试逐门禁循环对 doctor 断言 exit 2）                              | doctor 对非法参数返回 0/1 而非 2，环境缺失会被误报为通过                                                                             |
| ensure-codegraph-opsx     | invocation   | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts#const invalid = runScript(ENSURE_SCRIPT, ['--phase', '4', '--project-root', projectRoot, '--mode', 'light'], {`                            | 非法/重复 phase 不再 exit 2，「重复值 flag」会以 last-wins 参数静默安装依赖                                                          |
| metrics-report            | invocation   | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts#const invalid = runScript(METRICS_SCRIPT, [directory, '--phase=99']);`                                                                     | 非法 `--phase` 不再 exit 2，度量报告会在错误阶段上给出结论                                                                           |
| plan-chunks               | invocation   | `w-model-dev/scripts/__tests__/cli-arg-unification.test.ts#const r = runCli('plan-chunks.ts', [f, '--phase=1', '--phase', '9', '--node-type=REQ']);`                                               | 重复 `--phase` 返回 0，分块规划会按 first-wins 的静默阶段执行                                                                        |
| platform-deps-install     | invocation   | `w-model-dev/scripts/__tests__/platform-deps-install.test.ts#expect(result.stdout).toMatch(/ERROR_JSON .*"rule":"P0-1"/);`                                                                         | 缺 `--lockfile` / `--package` 不再 exit 2，平台依赖会在未验证 lockfile 时安装                                                        |
| review-package            | invocation   | `w-model-dev/scripts/__tests__/review-package-cli.test.ts#it('无值选项、空白值和未知位置参数均为 ARG_INVALID', async () => {`（同测试断言目标 out 路径零文件）                                     | 未知 flag 不在任何写盘前被拒时，评审包会以残缺参数先写盘再失败，留下半成品或覆盖既有 diff 文件（exit-2 失败原子性失守）              |
| security-scan             | invocation   | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts#const invalid = runScript(SECURITY_SCRIPT, [], { cwd: directory, env });`                                                                  | baseline 缺失不再 exit 2，扫描会以「无新增」通过而实际未做比对                                                                       |
| wm-export-evidence        | invocation   | `w-model-dev/scripts/__tests__/evidence-export-logic.test.ts#for (const args of [[], ['--unknown-option'], ['--verify']]) {`                                                                       | 非法参数不再 exit 2 且可能建出输出目录，导出会留下半成品证据包                                                                       |
| wm-status                 | invocation   | `w-model-dev/scripts/__tests__/cli-natural-exit.test.ts#const invalid = runScript(STATUS_SCRIPT, [directory]);`                                                                                    | project.json 损坏不再 exit 2，状态快照会以默认值给出假状态                                                                           |
| wm-verify-evidence-source | invocation   | `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts#const outcome = await runNegativeProbe(gateFile, probeRoot);`（同测试逐门禁循环对 wm-verify-evidence-source 断言 exit 2）           | 非法参数不再 exit 2，provenance 会以 package-only 冒充 source-bound 证据                                                             |
| wm-write                  | invocation   | `w-model-dev/scripts/__tests__/wm-write.test.ts#])('--lock-timeout %s is ARG_INVALID with exit 2', (_caseName, args) => {`                                                                         | 非法 `--lock-timeout`（负数/小数/非数字）不再 exit 2，锁超时会以未定义值执行                                                         |

> 重叠说明：`check-artifact-gate` / `check-preventive-review` 同属计划的 A、B 两组，本表只在 A 段各登记
> 一行，避免同一门禁出现两行；两条证据均取自任务 1（`56fde6d0`）强化后的用例条目（其中
> `check-artifact-gate` 直接锚到强化后的 `/待执行/` 断言行）。
