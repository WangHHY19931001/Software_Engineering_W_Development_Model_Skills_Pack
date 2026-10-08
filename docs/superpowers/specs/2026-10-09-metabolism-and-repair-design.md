# W-Model 技能包代谢机制与结构减负规格（三子项目：卫生批 / 机制批 / 减负批）

- 日期：2026-10-09
- 状态：已批准（用户 5 项决策定案后编写；设计分节展示获批准，含证据树集成增补）
- 输入：2026-10-09 两轮子代理全面分析（第一轮 5 组并行深潜：技能核心 / 门禁脚本架构 / 参考文档体系 / 人格·模板·Schema / 工程化交付；第二轮 2 组交叉复核：12 条负面断言逐条验证 + 12 组数字口径仲裁 + 6 处盲区填补）。负面发现经复核可靠率约 87%，本规格引用的每条问题均以复核后结论为准。
- 关系：独立新规格。问题清单为 43.3.0 现状复核所得；与既有 `2026-10-06-w-model-remediation-design.md` / `2026-10-07-remediation-leftovers-design.md` 条目的潜在撞车项，在各子项目实现计划编写阶段逐项核对并在证据图中登记（登记为 🟡 待核，不预设无重叠）。
- 下游：三个子项目各一份实现计划（`docs/superpowers/plans/`）与一份证据图（`docs/superpowers/evidence/`），前一批合入后编写下一批计划。

## 0. 决策记录（2026-10-09，用户定案）

| #   | 决策点     | 结果                                                                                         |
| --- | ---------- | -------------------------------------------------------------------------------------------- |
| 1   | 执行载体   | **直接批次工程**：沿用仓库惯例（plans 写计划 → 直接实施 → prepush 收口），不做 /wm 八阶段 dogfood |
| 2   | 机制强度   | **混合分级**：度量类=只读脚本；预算类=强制门禁（fail-closed）；退役/降级类=人类 CHECKPOINT 裁定 |
| 3   | 存量处理   | **立即全量拆分**：6 份千行文档、巨石脚本、33/36 未适配人格等存量在子项目③一次性处理到位        |
| 4   | 计划形态   | **三个子项目序列**：① P0 卫生批 → ② 代谢机制批 → ③ 结构减负批；各自独立 spec/plan，可中途叫停   |
| 5   | 取证支撑   | **引入证据支撑树**（evidence-anchored decision tree）：证据锚定 + 三色状态 + 上行根因，横切三个子项目 |

## 1. 问题清单与证据锚点（复核后）

### 高严重度

| 问题                                                                 | 证据锚点                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| reality-checker 人格正文与其承重职责完全错位（正文是 Web 前端测试剧本） | `w-model-dev/subagent/testing-reality-checker.md:7/26/50/70/99`；职责定义 `references/root-cause-locator.md:251`（confidence<0.5 → passed=false） |

### 中严重度

| 问题                                       | 证据锚点                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| 人格库 33/36 正文未适配 W 模型语境，全库正文对 RTM/run-log/verifier 等制品零引用 | 大小写敏感 grep 零命中（唯一命中为 insertMany 子串误报）                              |
| design-ux-architect / project-manager-senior 残留外来路径 `ai/memory-bank/` | `subagent/design-ux-architect.md:319-323`；`subagent/project-manager-senior.md:27/35` |
| 反模式 #48 缺席两张速查表；检测信号表「48」缺 `#` 前缀；脚本映射表还跳过 #18/#19/#20 | `references/hard-constraints.md:356/412/451`                                  |
| AGENTS.md 未提及 scripts/ 的 application/ 与 infrastructure/ 两目录；references 清单漏 quickstart.md | `find w-model-dev/scripts -maxdepth 1 -type d` 实测 6 子目录；AGENTS.md grep 零命中 |
| parseArgs 双轨：19 个 CLI 本地定义 vs 28 个用 lib/parse-args.ts，零重叠 | `grep -l "function parseArgs" cli/*.ts` = 19；`grep -l "parse-args"` = 28      |
| pre-push 全量 27 分钟（1641s 实测），文档变更亦触发全量                 | CHANGELOG.md:40（43.3.0「实测 1641s」）；`.githooks/pre-push` 触发面含 docs/**/*.md |

### 低严重度（代表项）

| 问题                                              | 证据锚点                                        |
| -------------------------------------------------- | ----------------------------------------------- |
| 零 git tag，semver 沦为轮次计数器                  | `git tag \| wc -l` = 0；版本仅存于文件声明         |
| 「返工路径」（阶段 1-5）vs「返工定位表」（阶段 6-8）术语分叉 | 逐文件 grep 分布零交叉                        |
| 子模板头部「对应 DESIGN.md §…」指向不明文档         | templates 子模板头部                            |
| 内联修订沉积（「D-6 已删除」「A15 死词」「审查更正」批注散布活文档） | hard-constraints.md 反模式 #21 三段叠加批注等   |
| wm-write 全链路无 fsync（断电一致性缺口）           | `logic/state-write-logic.ts:604-607`            |
| 巨石脚本：self-test.ts 5662 行、docs-consistency-logic.ts 2721 行、gate-logic.ts 2048 行、run-log-logic.ts 1769 行 | wc -l 实测                                     |
| 6 份巨型文档（Top10 占 references 64.5% 行数）      | tla-plus 2471 / subagent-delegation 2008 / bdd 1873 / verifier-spec 1159 / data-models 1080 / hard-constraints 1037 |
| docs/debug/ 下 6 个 vitest JSON 快照约 28MB（仓库最大 tracked 文件群） | `docs/debug/2026-09-28-test-gate-optimization/` |
| 规则只增不减：反模式候选区 C1/C2 长期挂起、无任何退役记录 | hard-constraints.md 候选区                      |
| eval 效果评估停滞：LLM 在环盲评停在 2026-07，现仅存资产存在性断言 | eval/w-model-dev-results.tsv 时点；mappings 全为 contains/fileExists 级 |

### 系统性风险（跨维度）

1. 规则总量逼近 LLM 可遵从上限，且只有入口没有出口（无退役机制）。
2. 巨型文件侵蚀渐进披露（阈值只约束 SKILL.md 与引用深度，未给 references/ 设单文件上限）。
3. 编排开销与小任务不成比例；CHECKPOINT 密度被 SSoT 自认瓶颈（本规格不直接改此点，避免动核心编排设计——见 §6 YAGNI）。

## 2. 子项目 ①：P0 卫生批（版本 43.4.0）

纯事实修复，无设计决策，不触 SSoT 优先链。条目：

| #   | 项                   | 修复方式                                                                                                                            |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | reality-checker 重写 | 保留 frontmatter；正文重写为根因置信度核验职责（对齐 root-cause-locator.md:251 的 confidence<0.5 判失败机制）+「默认拒绝」认知立场 + `.w-model` 制品词汇与落盘路径。以已适配的 3 份人格（algorithm-expert / requirements-analyst / test-manager）为范式 |
| 2   | 外来路径清理 ×2      | design-ux-architect.md:319-323、project-manager-senior.md:27/35 的 `ai/memory-bank/` 改为 `.w-model/` 等价路径                           |
| 3   | #48 表缺口           | hard-constraints.md「命中高发阶段」表与「门禁脚本对应」表补 #48 行；「48」补 `#` 前缀；**先核实**映射表跳过 #18/#19/#20 是否有意——无意则补齐，有意则加注说明（证据图 🟡→🟢 闭环） |
| 4   | AGENTS.md 导航补全   | 补 application/、infrastructure/ 目录描述；references 清单补 quickstart.md（口径过 count-claim 门禁）                                    |
| 5   | 术语统一             | 「返工路径/返工定位表」统一为单一术语（实现计划定名），conventions.md 登记                                                                  |
| 6   | 死指针修正           | 子模板头部 DESIGN.md 指向改为现行文档                                                                                              |
| 7   | git tag 启用         | 补打 43.3.0 tag；此后每版本发布打 tag（写入 CONTRIBUTING.md 发布节）                                                                  |

**出口判据**：全项通过 `npm run prepush`（含 docs-consistency / eval 锚点）；tag 已推送；证据图全部叶子 🟢。

## 3. 子项目 ②：代谢机制批（版本 43.5.0）

四维度各落一机制 + 一项仪式。强度按决策 2 分级。先写 SSoT §10U（批次 10 权威摘要），再落资产，最后同步 AGENTS/README/CONTRIBUTING/CHANGELOG。

### M1 复杂度度量与预算（复杂度维度）

- **只读脚本** `wm-complexity-report.ts`（exit 0/2）：单行 `COMPLEXITY_REPORT_JSON` 输出——references/ 与 scripts/ 各文件行数、反模式/硬约束计数、交叉引用出度、人格适配比（按「正文含 W 模型制品词汇」grep 信号）、内联修订沉积计数（匹配「已删除/已退役/审查更正」批注模式）。基线落 `eval/complexity-baseline.json`（入库跟踪；eval/ 是仓库既有基线家园）。
- **强制门禁** `check-complexity-budget.ts`（exit 0/1/2，**棘轮式**）：预算文件 `eval/complexity-caps.json` 入库，初值=落地时实测值（落地时不红），**只许下调**；机器路径无上调。唯一例外：确需新增规则/扩大文件时，cap 上调须经 🔴 CHECKPOINT 人类裁定并在 decision-log 登记——机制不给机器开口子，但保留人类的路。维度：单文件行数上限（references/scripts 分列）、反模式/硬约束计数（只减）、人格适配计数（只增）、沉积批注计数（只减）。
- **与决策 3 的合成**：子项目③每拆一个文件，同一提交内下调对应 cap——拆分进度机器可验、永不回弹。棘轮是「立即全量拆分」的执行载体与保全机制，不是替代。

### M2 规则生命周期（治理维度）

- **登记册** `w-model-dev/rule-registry.json` + 新 schema `rule-registry.schema.json`：每条反模式/硬约束登记 `{id, status: candidate|active|retired, boundScript, rationale}`。docs-consistency 的计数断言改为从登记册派生（计数获得单一事实源，简化既有七处计数镜像维护）。
- **只读脚本** `wm-rule-lifecycle.ts`：输出退役候选报告。判据=活文档引用零命中 + 无绑定脚本（或绑定探针在 gate-logs 全量中零触发）+ 存续超过 10 个 minor 版本（N=10 钉死；避免刚立的规则被过早退役）。**候选只报告不自动退役**。
- **退役动作**：人类 CHECKPOINT 裁定 + decision-log 记录；退役条目移入 hard-constraints.md「已退役」区（保留考古、排除出阶段必读清单与计数）。首批裁决长期挂起的 C1/C2 候选。

### M3 门禁效能反馈（门禁维度）

- **只读脚本** `wm-gate-effectiveness.ts`：消费既有 `.w-model/gate-logs/`（1,065 条真实记录），按门禁统计调用数/阻断数/错误数/末次触发/触发文件分布，输出 `GATE_EFFECTIVENESS_JSON`。
- 消费点=M4 仪式。零阻断门禁标记为**降级候选**（预防性门禁 0 阻断≠无用，只提交人类评审，不自动降级）；反复阻断同一文件者标记为上游修复候选。无证据锚点的降级建议不进入 CHECKPOINT 议程。

### M4 定期简化检查点（仪式，写入 CONTRIBUTING.md）

触发：每个新的优化批次开工前强制执行。四步定型：跑 M1/M2/M3 三只读脚本 → 刷新证据图状态 → 🔴 CHECKPOINT 人类评审三份报告并裁定本批次简化配额（拆什么/退役什么/降级什么）→ 决策落 decision-log。这是「本体系最缺的退役与简化流程」的制度化。

### M5 pre-push 快/全双档

快速档**仅当** diff 纯属 `docs/**`、README、CHANGELOG、AGENTS、CONTRIBUTING（仓库元文档，不触 `w-model-dev/**` 技能资产）——跳过 vitest 全量与覆盖率两项大头；其余一律全量；版本号变更提交强制全量。维持「本地 pre-push 唯一门禁」裁定（R-B9-14）不变。

### 注册与测试清单（全部新脚本统一适用）

dispatch-matrix 登记 + NEGATIVE-COVERAGE.md 加行 + 真实 exit-2 探针 + self-test 用例 + samples fixture + vitest 单测（logic 纯函数 + cli 调用形态）+ `check-complexity-budget.ts` 接入 pre-push。**不加任何 LLM 调用**；三个只读脚本只读既有数据、不新增检测信号语义。

## 4. 子项目 ③：结构减负批（版本 44.0.0，一次性全量拆分）

按决策 3 彻底处理存量。风险由仓库自身元门禁兜底：每步 `npm run eval` 锚点断言 + docs-consistency + prepush 全绿才能前进。

1. **6 份巨型文档拆分**：各拆为「薄入口 + 领域子文件」，逐文件拆分边界在 ③ 实现计划中定义（证据图 🟡 → 计划定稿后 🟢）。已知锚点：subagent-delegation 按既有 §0 分节切（派单契约 / 分派模板 / 反馈回路 / 登记表）；hard-constraints 拆出 anti-patterns.md。同步更新：eval/mappings 101 条锚点、docs-consistency 锚点、SKILL.md 指针、全部交叉链接。
2. **巨石脚本拆分**：self-test.ts 按既有 57 个 runXxxCases 切到 `self-test/cases/*.ts` 聚合器模式；docs-consistency-logic / gate-logic / run-log-logic 按规则族切。**同一提交内**更新 `CLI_LAYERING_EXCEPTIONS` 行数钉死值与 `asset-budget.test.ts` oversized 基线（不更新即红——这是保护）。
3. **36 人格全量适配**：以 3 份已适配人格为范式统一改写——职责对齐 + 视角关注面 + 产出格式锚定 templates/schemas + `.w-model` 落盘路径；① 重写的 reality-checker 做一致性终检。
4. **脚本债清偿**：19 个本地 parseArgs 归并到 lib/parse-args.ts（逐 CLI 核对 `--phase` 双形态与重复 flag 语义，迁移配对测试）；wm-write 关键路径补 fsync（tmp 写、备份复制、rename 前落盘）；`docs/debug/` 大快照加入 .gitignore 增量规则（存量保留不删）。
5. **eval 效果评估复活**：定义每版本最小 LLM 在环评估规程（N≥5 条提示词覆盖 routeTotals 三类，结果续录 TSV）；本批先补跑一次刷新过期盲评数据；周期执行挂入 M4 仪式清单。

## 5. 证据支撑树集成（横切 ①②③）

定位：证据树在**项目决策层**运作（哪个问题→哪个修复→哪个验证→什么状态），与仓库既有**运行期机器证据层**（gate-logs / run-log / evidence-provenance）互补不重叠。

- **E1 项目级证据图**：每子项目一份 `docs/superpowers/evidence/2026-10-09-<子项目>-evidence-graph.md`（入库，与 spec/plan 同版本）。初始化即挂载两轮分析复核后的 🟢 叶子（§1 表即锚点来源）；真实 🟡 如实登记（如 #18-#20 有意性、拆分边界），不得伪装 🟢。
- **E2 执行期证据闭环**：执行会话只加载同版本已批准的 PLAN + EVIDENCE_GRAPH；每完成 ≤3 个叶子跑一次状态校验——全 🟢 才继续；🟡 冻结依赖路径补验证；🔴 触发「叶→枝→根」上行分析（与仓库 R 根因定位者方法论同构，冲突时按仓库流程走）。验证产物（prepush 退出码、eval 锚点、行数实测）回挂对应叶子。
- **E3 机制取证强化**：M2 退役前提=零使用证据达 🟢 级（grep 零命中 + gate-logs 零触发均已复核）；退役 CHECKPOINT 决策同时落证据图决策日志与 decision-log（单一动作、两处按各自格式留痕，不复制内容）。M3 降级候选同规则。
- **E4 状态变更纪律**：一切状态迁移记录「旧状态→新状态、触发证据、时间、影响范围」；被否决路径同样留痕（根治「候选区长期挂起无裁决」）。

## 6. 执行与质量保障

- **顺序**：① → ② → ③ 串行。② 棘轮初值依赖 ① 后实测；③ 的逐文件 cap 下调依赖 ② 预算门禁在场。每子项目独立 spec/plan/版本号/prepush 收口，可中途叫停。
- **SSoT 纪律**：② 的机制设计先写 SSoT §10U，再落资产，最后同步外围文档；①③ 纯实施不动设计决策（③ 的拆分若改变「渐进披露阈值」等成文规则，随拆分提交一并修订 asset-authoring.md 对应节）。
- **回滚**：每子项目内小步提交，单步红了 `git revert` 单提交即可。
- **明确不做（YAGNI）**：门禁脚本内不做任何自动退役/降级裁决（只报告）；不引入云端 CI（维持 R-B9-14 裁定）；不为度量发明新数据格式（复用单行 JSON 约定）；不新增反模式（本次全部是修复与退役，不是新规则）；不动核心编排设计（CHECKPOINT 密度、R3 强制链等留待机制运转产生数据后另行立项）。

## 7. 设计级证据图（决策层快照）

- 图谱状态：已批准（2026-10-09，用户批准设计）
- 根节点 R1：修复 43.3.0 复核发现的全部问题并建立四维度自迭代机制 | 🟢（本规格 §1-§6）

| 节点 | 父节点 | 结论/假设 | 证据锚点 | 状态 | 验证动作 |
| --- | ------ | --------- | -------- | ---- | -------- |
| B1   | R1     | 问题清单真实且经交叉复核 | 两轮分析报告 + §1 锚点表 | 🟢 | 已复核（87% 可靠率，证伪项已剔除） |
| B2   | R1     | 三子项目序列可行且顺序依赖成立 | §6 顺序论证 | 🟢 | 各子项目 plan 编写时复核 |
| L1   | B1     | #18/#19/#20 映射表缺席是否有意 | hard-constraints.md:412 | 🟡 | ① 计划首要验证动作 |
| L2   | B2     | 6 份文档拆分边界 | ③ plan 逐文件定义 | 🟡 | ③ 计划定稿后转 🟢 |
| L3   | B2     | 与既往 remediation 规格无撞车条目 | 两份前序规格 | 🟡 | 各子项目 plan 编写时逐项核对 |
| L4   | B1     | 四项用户裁定（§0 决策 1-4） | 用户决策（AskUserQuestion 记录） | 🟢 | 用户决策类证据 |
| L5   | B1     | 证据树集成（决策 5） | 用户决策 + skill 加载记录 | 🟢 | 用户决策类证据 |

## 8. 验收标准（三子项目总 DoD）

1. §1 中/高严重度问题逐项消失且有证据图叶子闭环（🟢 + 验证产物回挂）。
2. `check-complexity-budget.ts` 在 pre-push 生效；caps 相对初值单调下降；③ 完成后全部存量文件处于目标预算内。
3. `rule-registry.json` 成为反模式/硬约束计数的单一事实源；C1/C2 候选获裁决（active 或 retired，不留 pending）。
4. M4 仪式写入 CONTRIBUTING.md；三个只读脚本在 ② 落地时（① 已合入的仓库上）即可产出非空报告。
5. 每子项目独立 prepush 全绿 + eval 锚点断言全绿；版本 tag 已打。
6. 每子项目一份已批准证据图，决策日志完整（含被否决路径）。
