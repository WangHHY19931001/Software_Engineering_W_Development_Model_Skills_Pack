# 轮次决策记录：第 50 批（批次 8 文档与协议一致性，43.2.0）

> 41.7.0 起 SSoT 只承载当前设计事实，本文件登记批次 8（43.2.0）实施前的用户决策与实施期裁定，
> 对应 [43.2.0]（CHANGELOG.md 条目随批次 8 发布回填）。裁定来源：主规格
> [2026-10-06-w-model-remediation-design.md](../../superpowers/specs/2026-10-06-w-model-remediation-design.md) §7 +
> 增量规格 [2026-10-07-remediation-leftovers-design.md](../../superpowers/specs/2026-10-07-remediation-leftovers-design.md) §3 +
> 批次 7 执行账本的 10 项 riders；SSoT 权威摘要见其 §10T（随批次 8 收口回填）。原文保留，不篡改。
>
> **本文件为批次 8 累积登记**：任务 7 建文件并登记 C6 归档矛盾 + Loop 3/4 成熟度标注；批次 8 其余实施裁定由任务 17 追加。

#### 第 50 批：文档与协议一致性（43.2.0，2026-10-07）

**目的**：销账主规格 §7 全部（单一事实源修复 / 协议口径修正 / 计数与覆盖 / 资产质量 / 如实化标注）+ 增量规格 §3 三项（subagentSpawns 门禁化 / C19 三类易残留锚点 / ai-native-sdlc:134）+ 批次 7 执行期登记的 10 项后续 riders。

**C6：round23 归档 README「pending」vs checkpoint-summary「exit 0」矛盾（如实化标注，归档不改写）**

- **现象**：`docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/` 内两份文档对同一轮收口给出互斥视图——`README.md` §三 门禁表把四道门记为 `pending`（备注「由 G 子代理」），而 `checkpoint-summary.md` 记四门 `exit 0` 且阶段 8 终检 `退出码 0`。
- **两处引文原文**（逐字摘录，不作改写）：

  `README.md:45-48`（§三 门禁表，staged 快照）：

  ```
  | `check-artifact-gate.ts` (阶段 8 终检) | pending | 由 G 子代理（编排者分派） |
  | `check-requirement-graph.ts --phase=4` | pending | 由 G 子代理 |
  | `check-tla-model.ts --phase=4` | pending | 由 G 子代理 |
  | `check-bdd-model.ts --phase=8` | pending | 由 G 子代理 |
  ```

  `checkpoint-summary.md:25-28`（闭环机制表，终态）+ `:32`（总结）：

  ```
  | check-budget.ts | 0 | budget R1-R5 通过 |
  | check-run-log.ts | 0 | run-log R1-R7 通过 |
  | check-maturity.ts | 0 | maturity R1-R5 通过 |
  | check-checkpoint.ts | 0 | checkpoint R1-R5 通过（acknowledgedDecisions 含 ID 模式或 TECH_KEYWORDS） |

  8 阶段 CHECKPOINT 全部通过。阶段 8 终检（check-artifact-gate.ts）退出码 0 = 630 tests pass + RTM 100% + 覆盖率达标 + TLA+/BDD 0 违反。
  ```

  同 README `:122`（§十 结论）：「✅ check-budget / check-run-log / check-maturity / check-checkpoint 全 exitCode=0」。

- **裁定**：
  1. **以 `checkpoint-summary.md` 为终态视图为准**；README §三 门禁表的 `pending` 行为 **staged 快照残留**——快照时点早于 G 子代理执行（表内备注「由 G 子代理（编排者分派）」即该时点的意图登记），非最终判定。同一 README §十 `:122` 已记四门 `exitCode=0`，与 `checkpoint-summary.md:25-28` 一致，故 README 内部即为「staged 表 vs 终态结论」两视图并存，本质是**时间点标注缺失的文档缺陷**，而非两文各执一词的实质冲突。
  2. **引用规则**：该归档的收口状态以 `checkpoint-summary.md` 为准；引用 README §三 门禁表须注明其为运行中途快照，不得作为收口结论的依据。
  3. **如实存疑（不下过头结论）**：`check-requirement-graph.ts --phase=4` / `check-tla-model.ts --phase=4` / `check-bdd-model.ts --phase=8` 三项在归档内**无逐项最终 exit code 的直接记录**——仅有 `checkpoint-summary.md:32`「TLA+/BDD 0 违反」、`tla-summary.md`（SANY/TLC 通过、0 违反）、`bdd-summary.md`（D1-D7 全 ✓）与 `checkpoint-summary.md` 阶段 4 门行（「4 TLA+ L1-L4 / 4 BDD 32 scenarios」）作**间接佐证**。本登记按「间接证据、非逐项直接记录」标注，不复述为 `exit 0`。
  4. `README.md:80` 与 `checkpoint-summary.md:18-19` / `:34` 的「用户确认 pending」（项目级放行须用户在 `acceptance-test-report.md` §9 确认 `confirm`）**两文一致，不属矛盾**，不得并入本矛盾叙述。
  5. **归档不改写**（同「不篡改演进史」原则）：不改 README 的 pending 行、不加脚注、不修订任何归档文件；本登记即为消歧位，后续引用按上述规则执行。

**Loop 3/4 成熟度头部标注（如实化标注）**

- **落点**：`w-model-dev/references/event-ingress-guide.md` 头部（来源行之后）与 `w-model-dev/references/hill-climbing-guide.md` 头部（来源行之后）各加一行：

  ```
  > **成熟度：文档协议，无运行时执行器**（本指南定义协议与判据；执行由 Agent 按协议进行，仓库不含自动执行器）。
  ```

- **依据**：两指南自述「技能不内置 cron/webhook/GitHub Actions/Slack bot」（Loop 3 事件接驳）与「技能只产出改进信号，不自动改 harness」（Loop 4 爬坡循环），但此前头部未显式声明「无运行时执行器」，易被读为已实现自动化能力。标注仅为文档级如实化，**无机制改动、无门禁新增、无运行时行为变化**。

| 维度 | 内容 |
|---|---|
| 版本号 | 43.2.0（批次 8 目标版本） |
| 门禁影响 | 无（decision-log 不参与门禁；两 guide 仅头部加注，无脚本消费该行） |
| 归档处理 | round23 归档零改写；矛盾以本文件登记消歧（C6） |
| 验证 | docs-consistency 0 违规 + eval 68/68（任务 7 实测，见批次 8 执行账本）；其余批次收口见任务 17/18 |

---

#### 实施期裁定与后续登记（任务 17 追加，2026-10-07 批次 8 收口）

**预飞裁定（R-B8-1…R-B8-3，批次 8 计划执行前登记）**

| # | 裁定 | 内容 |
|---|---|---|
| R-B8-1 | 计数口径 | 主规格 §7 头注 15 项（含 C15）vs 增量规格 §5 表 14 项——本批按「**C15 纳入**」执行（任务 14 落地），销账口径 = 15 C 项 + 增量 §3 三项 + 批次 7 执行期 riders 10 项 |
| R-B8-2 | 行号基准 | 计划行号为 HEAD=42620669 时点参考，实施以内容定位为准（各任务实测漂移 +1~-7 行不等，均按内容命中、无漏改） |
| R-B8-3 | CHANGELOG 样式 | 任务 17 不预写未跑测结论（批次 7 T14 教训）——验证记录占位只写「待任务 18 回填」，耗时数字不引不存在出处 |

**C18 反模式分级判据（R-B8-4，任务 10 实施裁定，控制者独立复核同意）**

- **判据锚 = 条目本体，非例示具体度**：条目本体的缺陷模式与教训跨项目、跨技术栈成立即「通用」；本体教训仅在特定工具链/技术栈下可复现（典型信号：本体陈述不可去除特定工具/命令名）即「项目教训化石」。
- 技能内建方法栈（TLA+/BDD/codegraph/skill 自身 schema 契约）对技能的每个采用者都存在、教训可迁移，按定义计入通用，不因「技能内部」而计化石。
- 结果：48 条 = **47 通用 + 1 项目教训化石**（#25 PowerShell ConvertTo-Json 写入——BOM/深度/中文乱码教训仅在 PowerShell/Windows 工具链可复现）；#22/#23/#24/#36 四条争议条目经「本体抽象化」裁定归通用（如 #22 本体 = 「仅认证未鉴权」，跨栈成立）。
- 形态约束：主清单表行首前缀 `【通用】`/`【项目教训化石】`，**不加表列**——`docs-consistency-logic.ts` 以精确字符串锚定表头与 `\| 48 \|` 区间，加列会破坏门禁锚；前缀形态对全部门禁锚点零影响（任务 10 侦察证据）。
- 同族口径（C17 人格去栈化）：36 个 persona 的工具链残留按「教训保留、参数级 1:1 改写为跨栈表述」处置（jdeps / EXPLAIN ANALYZE / Lighthouse 等命令名清除），与 C18 判据同源（跨栈可迁移性）。

**C9 五处收敛扩张（任务 4 实测，规格登记之外）**

- 规格 §7 登记 C9 时的副本清单不完整：实测全仓 `<r10-contract` 全文副本**五处**（verifier-spec §7.5 / root-cause-locator / command-reference / agent-personas / SSoT），较规格登记多出三处。
- 裁定：权威 = **verifier-spec §7.5 保留全文**；其余四处改一行指针（各保留一句消费语境）；SSoT 处用引用+说明（保留设计语境，不复制 XML）。
- 门禁配套（T4 修复轮 1）：`check-docs-consistency.ts` 的 R10 指针判定加固——非围栏 + 同段 + 否定拒斥 + 跨行，消费方三向 fail-closed；防指针被静默改回复述或被误判为合规。

**C6 矛盾登记的引用规则（承接任务 7 登记，CHANGELOG [43.2.0] 已引用）**

- CHANGELOG [43.2.0] 以本文件 C6 登记为 round23 归档收口状态的唯一消歧位：引用归档 README §三 门禁表须注明「运行中途快照」；收口结论以 `checkpoint-summary.md` 为准；三项无逐项 exit code 直接记录的门（requirement-graph / tla-model --phase=4、bdd-model --phase=8）按「间接证据、非逐项直接记录」标注。归档零改写。

**后续候选登记（本批不修）**

| 来源 | 登记项 | 处置 |
|---|---|---|
| T5 审查次要 5 | 模型档位全覆盖 20 处缺（C12 只保证 S 模板范围内，余量未覆盖） | 后续批次候选 |
| T5 审查登记 | `phase-1-requirements.md` 表 6/7 张力（既存） | 后续 docs 批次候选 |
| T5 审查登记 | subagent-delegation「另读」vs「按需」措辞松紧（:96 附近） | 后续批次候选 |
| T15 审查次要 1 | task-15 报告「无新增漏报」绝对化措辞被析取窗口保守方向证伪、须软化——报告文件在 gitignored 执行账本内，随账本记录，仓库文件不改 | 登记 |
| 各审查 Minor 其余 | 见批次 8 执行账本（`.superpowers/sdd/2026-10-07-batch8-docs-consistency/progress.md`，gitignored 账本）逐条留痕，已逐条指派或登记 | 逐条处置 |

| 维度 | 内容 |
|---|---|
| 版本号 | 43.2.0（本节为该版本实施裁定的收口登记） |
| 门禁影响 | `check-budget.ts` R7 成真（Breaking，见 CHANGELOG [43.2.0]）；`check-docs-consistency.ts` R10 指针判定加固（本批唯一门禁改造） |
| 验证 | docs-consistency 0 违规 + eval 101/101（任务 17 提交前实测）；prepush 19 项待任务 18 回填（R-B8-3 样式纪律） |

---

#### 第 50 批（批次 9）：工程化卫生（43.3.0，2026-10-08）

**目的**：销账主规格 [`2026-10-06-w-model-remediation-design.md`](../../superpowers/specs/2026-10-06-w-model-remediation-design.md) §8 全部十三项（D1-D8 工程化卫生 + A10/A16/A17/A18/A19 杂项修正）+ 批次 8 终审建议 5 条 + 账本 deferred 候选（10 项 riders，R-B9-1 ~ R-B9-10）。实现计划 [`2026-10-08-batch9-engineering-hygiene.md`](../../superpowers/plans/2026-10-08-batch9-engineering-hygiene.md)；执行账本 `.superpowers/sdd/2026-10-08-batch9-engineering-hygiene/progress.md`（gitignored，逐任务留痕）。本文件登记批次 9 实施期裁决与 registered-minor 合并清单（R-B9-3）。

**D5 判据收敛裁决（任务 7 产出）**

- 三判据参数化落 `lib/project-root.ts` 后，**默认收敛为 graph 最严判据**（8 层上溯 walk）。三调用点等价映射、差分探针 576 对比 0 mismatch、新单测 18 用例全绿。
- **signature-chain 保留 `requireProjectFile`（判据正交，不收敛）**：以 project.json 为唯一判据，收敛会变宽松（上溯 walk 遇 project.json 即停 vs 现行为），故不收敛。
- **iceberg 宽判据暂保留**：真实项目 `.w-model/` 必有状态文件，后续可安全切换为默认最严判据，但**须先补 icebg e2e 回归后再切**——切换为批次 N 候选。
- 计划措辞偏差登记：计划「strictWModel」之谓实现为 `looseWModel`（iceberg 侧宽判据），方向一致更优，非缺陷。

**D7 security baseline 复审结论（任务 14 产出）**

- **测试侧清零**：`__tests__/` 全部 60 条 fs + 15 条 object-injection（含 HEAD 预存新发现 `artifact-gate-logic.test.ts:40`）逐条有理由 eslint-disable 消除，测试侧 fs/obj 基线残留归零——**非批量无脑 disable**，每文件头注释留理由；`sourceKeys` no-unused-vars 由仅作类型改真实驱动 sources 逐键加载。
- **生产侧逐点复审保留**：state-write-logic（22 条路径拼接）、gate-logic / tla-logic / cli/* 逐点登记「复审通过理由」——动态项目根受控 `.w-model` 子树 + schema 白名单兜底、代码常量表受控键、循环与白名单下标、安全访问器插件误报；无实质风险降低的修复点。
- **R-B9-6（实义清除）**：docs-consistency-logic 2 条 no-useless-escape（字符类内 `\[` 去转义，node 穷举 19683 串等价验证 ALL SAME）+ 测试 1 条 no-unused-vars 已随 `--regenerate` 吸收。
- **基线 294→219**：真删 79（测试侧 75 + no-useless-escape 2 + 生产 2）/ 真增 4（HEAD 预存新发现 4 生产位）/ hash 位移 42（净零），程序化对账一致。**计划基数补注**：D7 计划步骤 1 以 baseline 目录数 67/17 为预估，实态为 60 fs + 14 obj（含 1 新 obj），以实态为准。
- **HEAD 基线曾过期（重要教训，T16 收编①）**：干净 HEAD 树 `lint:security` 即报 6 新发现——T13（1f326a97）/T13-fix（7c72dc1d）实测 **6 新增 exit 1**，来源 = T8（fa855ddb）+ T9（7a44d568）改生产代码后未随改 `security-scan --regenerate`，时间线 T8-T13 **红**。**教训：`lint:security` 绿/新增校验须绑定任务自身终态（随改随 regenerate 或显式确认每任务面 0 新增），pre-push 为强制执行点**。已于任务 14 重生成 baseline 后绿（exit 0）。

**A18 方案选择（任务 13 产出）**

- 两案（a 引号转义 / b 去 shell）择 **b（去 shell）**：`findVitestBin` 强化为 JS 入口解析器（root/node_modules/vitest/package.json 精确路径 + `createRequire` 上溯），`process.execPath` 直接 spawn、参数数组原样透传——**无拼接即无注入面**；`.bin` shim 弃用（Windows .cmd / POSIX shell 脚本均需 shell，非单一免 shell 跨平台形态）；入口不可得时 `-1` 哨兵保持 fail-closed（显式 `--spawn-vitest` 时 vitest 缺失仍 vitest-* 违规 exit 1）。

**R-B9-1 demo R7 e2e 缺口处置（终审建议① T2 Minor⑦）——接受登记**

- 现象：`eval/e2e/demo/.w-model/budget.json`（gitignored 瞬态 e2e 脚手架）仅含 `perPhase.maxTokens`，无 `perPhase.maxSubagentSpawns`。
- 裁定：**接受登记、不物化**——R7 判定的门禁覆盖由 `samples/budget/` 5 份 fixtures（`valid.json` 含 `maxSubagentSpawns: 10`）+ 门禁单测提供；demo 为 gitignored 瞬态工作区，字段为**可选**（缺省时 R7 跳过并出非阻断警告，[43.2.0] Breaking 口径），不构成门禁覆盖缺口。若后续把 demo 纳入 CI 真跑则补该字段（批次 N 候选）。

**R-B9-7 check-budget 微竞态——登记不回退**

- `readJsonlOptional`（`lib/read-json-or-exit.ts:123`）微竞态无自然收敛点：D4 为 `checkRunLog` 纯函数拆分（run-log-logic.ts），readJsonlOptional 属 **lib I/O 层**、跨 CLI 共享，随 D4 重构顺带收敛无落点。登记不回退；批次 N 若 lib I/O 层统一收口再评估。

**R-B9-10 探针矩阵 2 格登记（TLA probe 格）**

- D4（checkRunLog 拆分）不触 tla 面、D5（project-root）不触 TLA probe、D7（baseline）不产出等价性探针——本批无 TLA 侧差分/等价性探针产出，2 格（TLA probe 矩阵）登记空缺原因 = 无 tla 面变更。批次 N 若做 TLA 侧等价性探针再回填。

**R-B9-9 CHANGELOG:58 测试计数快照核正**

- [43.2.0] 节「vitest 收集计数以 prepush 实测为准（T18 回填）」为陈旧占位（T18 prepush 已实跑 19/19 全绿，1464s）。按动态 facts 约定（CONTRIBUTING §4：vitest 文件数/用例数属动态 facts，只来自同次受控 JSON/provenance，**不入活体文档硬编码**）改为引用式——以 `npm run prepush`/`npm test` 当前命令输出为准，并注明 T18 已实测 prepush 全绿。README/INSTALL/CONTRIBUTING「以当前命令输出为准」口径一致。

**registered-minor 合并清单（R-B9-3，去向列：修 = 本批已修 / 登记 = 登记不修 / 批 N 候选）**

> 批次 8→9 riders 与批次 9 各任务 Minor 合并；R-B9-5 计数口径说明见末行。

| # | 来源 | 登记项 | 去向 |
|---|---|---|---|
| 1 | R-B9-1（终审① T2 M⑦） | demo budget.json 无 maxSubagentSpawns（R7 e2e 缺口） | 登记（接受，见上） |
| 2 | R-B9-2（终审②） | Lighthouse×2（engineering-frontend-developer.md:59/:161） | 修（中性「性能分数（Lighthouse）」，l0-links 0 违规 + self-test 412 验证） |
| 3 | R-B9-3（终审③） | deferred minors 显式化 | 修（本清单建立） |
| 4 | R-B9-4（终审④） | 验证面教训入 CONTRIBUTING §3 | 修 |
| 5 | R-B9-6（账本） | no-useless-escape ×2 + no-unused-vars ×1 | 修（D7 内实义清除） |
| 6 | R-B9-7（账本） | check-budget readJsonlOptional 微竞态 | 登记（不回退，见上） |
| 7 | R-B9-8（账本） | 模型档位全覆盖 20 处缺 / phase-1 表 6-7 措辞 | 批 N 候选（处置见下） |
| 8 | R-B9-9（账本） | CHANGELOG:58 测试计数快照陈旧 | 修（引用式，见上） |
| 9 | R-B9-10（账本） | 探针矩阵 2 格未提交 | 登记（无 tla 面变更，见上） |
| 10 | T2 review M②④ | java 探针 continue-on-error / 顶层 permissions | 修（ci.yml 注释⑤⑥ 落地） |
| 11 | T2 review M①③ | 提交信息反引号剥除 / 双触发全量门禁成本 | 登记（git 卫生提示；CI 成本优化候选） |
| 12 | T3 review M① | `.tmp-d3gen/` 批次终局清理 | 修（T17 已清理：2026-10-08 删除 8 个 T4 瞬态生成物，无引用、gitignored） |
| 13 | T3 review M② | `.tmp-*` 置于 `*.log` 之后 | 登记（功能等价） |
| 14 | T4 review M①③ | 报告措辞（1 行整体替换）/ RED→GREEN 独立复算吸收 | 登记（gitignored 账本内，已入账） |
| 15 | T5 review M① | eval/runner.ts 证据面前提留痕（map 全表透传注释） | 批 N 候选（无实险） |
| 16 | T5 review M② | samples/README 计数入 D8 扫描面扩展候选 | 登记（D8 扫描面含 decision-log/samples；samples/README 精确豁免） |
| 17 | T5 review M③ | GOLDEN 双表维护约定（抽表前黄金快照 + 对账断言 2/2） | 修（本清单登记为约定） |
| 18 | T6 review M① | task-6-report §2 行号落后实测 | 登记（gitignored 账本内） |
| 19 | T6 review M② | collectValidEntries 第 7 函数超「六段」字面 | 登记（行为中性受控超集，计划-实施对账） |
| 20 | T7 review M① | graph 回归 **7/7 → 实为 6/6**（C1 e2e 3 非 4） | 登记（报告计数更正） |
| 21 | T7 review M② | strictWModel vs 实现 looseWModel | 登记（D5 段措辞偏差说明） |
| 22 | T7 review M③ | 行为保持型重构差分探针源码归档惯例（docs/debug 或 .w-model/probe） | 批 N 候选 |
| 23 | T8 review M① | 报告基数 off-by-one（930 vs 929，净 −43 自洽） | 登记（报告修正） |
| 24 | T8 review M② | 行数比对代理局限 → 内容 hash 升级 | 批 N 候选 |
| 25 | T8 review M③ | docs-consistency 动态面表述口径（未 spawn-vitest 的「动态 0」注明采样） | 登记（报告口径） |
| 26 | T9 review M① | detectCycle 多环顺序缺提交级锚点 →「一图两环」fixture | 批 N 候选 |
| 27 | T9 review M② | precedes 分支注释补「依赖 R16 唯一性」提示行 | 登记（纯提示，不动作） |
| 28 | T9 review M③ | R15e 无穷 confirmed 节点不加建 | 登记（信息性） |
| 29 | T10 review M① | 报告单测口径（实为 11 既有 + 4 新增，报告写 12+3） | 登记（报告修正） |
| 30 | T10 review M② | sortedJoin 注释点名 .sort() UTF-16 字典序 | 修（T16 顺手，JSDoc 已补） |
| 31 | T11 review M①②③ | AGENTS.md §8 表行 / data-models.md:293 / operational-recovery.md:50-51 同口径 | 修（T16 顺手补齐） |
| 32 | T12 review M① | gate-report JSDoc tailFields 契约句（不得含 exitCode/summary 键） | 修（T16 顺手） |
| 33 | T12 review M② | 非确定双跑断言 flaky 候选 | 登记（不强制） |
| 34 | T13 review M① | 全量绿留待 T17 prepush 真实证据 | 登记（T17 收口，R-B8-3 纪律） |
| 35 | T13 fix 轮 1 | dependency-boundaries 行数 987→985（B1）+ 报告如实化（B2） | 修（7c72dc1d） |
| 36 | T14 收编① | T13 lint:security 绿声称被推翻（时间线 T8-T13） | 教训固化（见 D7 段 + CONTRIBUTING §3，prepush 为强制执行点） |
| 37 | T14 收编② | 报告计数小疵（位移 42→43 / 76↔75 口径） | 登记（以程序化对账 42 净零为准） |
| 38 | T14 收编③ | §2 表漏 iceberg-logic 3 obj 行 | 登记（iceberg-logic 3 obj 为 `result[name]` 受控键 + 数字下标，生产侧保留范畴） |
| 39 | T14 收编④ | sweptBy icebg:167 | 登记（iceberg scan 登记同一受控键访问模式，无需修正） |
| 40 | T14 收编⑤ | artifact-gate-assets 逐行 disable 冗余无害 | 登记（保持逐行有理由形态，不并文件头） |
| 41 | T14 收编⑥ | D7 计划基数 67/17 vs 实态 60/14 | 登记（D7 段补注） |
| 42 | T15 review N1 | D8 模式决策正式入段 | 修（本节「D8 模式决策」段） |
| 43 | T15 review N2 | §1 数字叙事更正（首跑 66→65 / 已登记 48→47 / 未登记 18→31 / 表 13） | 登记（处置与终态全正确，仅叙事口径更正，见下） |
| 44 | T15 review N3 | 注释矛盾（cli:66-68 vs 目录项登记 + 符号 `isCountClaimRegistered`→`isRegistered`） | 修（T16 顺手校正） |
| 45 | T15 review N4 | references 目录项已知取舍（豁免表 docstring 约束防静默吞漂移源） | 登记（豁免表 docstring 已承载） |
| 46 | 批次 8 遗留 | subagent-delegation「另读」vs「按需」措辞松紧（:96 附近） | 批 N 候选 |

**R-B9-8 模型档位全覆盖 20 处缺 / phase-1 表 6-7 措辞——批 N 候选（登记，本批不修）**

- 模型档位：`estimation-guide.md` 强制「分派子代理始终显式写出模型档位」已有 S/V/R/S-fix 4 个模板带该字段（subagent-delegation.md），其余 **14 个完整模板块（G / A-chunk / A-cross / S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd / R-iceberg / V-rootcause / R-lead / S-豁免 / R-豁免 / V-豁免）缺**（即「20 处缺」的主体；批 8 后 R-B9-3 清单 #7 承接）。S-plan/S-coding/S-finalize 为 bullet 形态、无「角色/任务」行，不在模板块计数内。本批不修的原因：模板块为编排者逐字引用的实例正文，14 处机械补全涉及统一措辞裁决（各角色档位指引父句），需一次定向评审；已登记去向 = 批 N 候选（建议随 subagent-delegation 一并的叙事批次处理）。
- phase-1 表 6/7 措辞：批次 8 T5 登记的「表 6/7 张力」原始上下文在批次 8 账本（gitignored、本工作区不可见），本工作区无法还原具体两行措辞，**不得臆改**——登记为批 N 候选，须先从批次 8 账本取回原文再裁定。

**T15 收编：N1 D8 模式决策 + N2 计数叙事更正 + N4 豁免表约束**

- **N1（D8 模式决策正式入段）**：计划建议的 `\b\d+…` 模式实测近死（中文文本仅命中 1 文件）——按「保守模式起步 + 过噪收紧 + 登记口径」授权以实测定稿：行级模式 `(?<![\d.])\d+(?!\.\d)\s*(?:项|条|处|份|款|种)(?!目)` + `共\s*\d+`（不收个/类，防「1.1 项目体」与「N 项目」误报）。扫描面 = 被跟踪活体 markdown 165 份（排除 docs/changes|superpowers|debug、.superpowers、eval/e2e、samples fixture、CHANGELOG-archive、node_modules）。首跑 66 命中 → 已登记 48 → 未登记 18 → 处置：REQUIRED_PATHS 补 references 目录项（14 份 references 全登记）+ 豁免表 6 项（3 精确：ai-native-sdlc-adoption / eval/README（已 101 对齐）/ samples/README + 3 前缀：decision-log / examples / templates）。漏登记即红（fail-closed）。
- **N2（§1 数字叙事更正口径）**：任务 15 报告 §1 首跑叙事「66 命中 / 48 已登记 / 18 未登记」在终态后重述为「65 / 47 / 31（未登记）× 13（表）= 0 未处置」时数字口径漂移——**处置与终态全正确**，仅叙事表述需按实态更正。权威口径：首跑 66 命中（65 唯一行 + 1 文件级），已登记 48，未登记 18，全部处置（14 references + 6 豁免 = 20 项落位，余 0）。后续引用以 D8 段为准。
- **N4（references 目录项取舍）**：REQUIRED_PATHS 的 `w-model-dev/references` 目录项 = **登记面**（前缀下全部 .md 视为已登记）而非扫描面（仍逐文件扫描）——取舍已由 COUNT_CLAIM_EXEMPTIONS docstring 的「禁止靠既有前缀条目静默吞掉真实漂移源」约束承载；新增含计数表述的 references 文件仍会被扫描命中（登记面已覆盖故不红），新增**精确豁免**须显式登记理由。

**R-B9-11 D1 CI 首跑登记（T17 收口）——待用户推库触发的 parked 项（不写已首跑全绿）**

- `.github/workflows/ci.yml`（ubuntu-latest + node 20 + `npm ci` + 主入口 `npm run prepush` + self-test/eval 显式冗余兜底 + 不可移植项 ①-⑥ 登记）已本地验证：YAML node yaml 1.2 解析断言通过（T2 review 实证）+ 与 prepush 等价子集由本批 T17 全量 prepush 19/19 全绿兜底（实测 1641s，2026-10-08，本机运行）。**CI 首跑 = 待用户推库触发 GitHub Actions 的 parked 项**：本机不可真跑 GitHub Actions，**不写「已首跑全绿」**；推库后首跑核对登记为批次 N 候选（用户推库时核对 workflow 绿态与不可移植项处置）。

**R-B9-12 云端 CI 口径同步（终审 B1）——三处导航文档同步登记（首跑待推库）**

- 批次终审阻塞项 B1：D1 已把 `.github/workflows/ci.yml` 提交入盘（被跟踪、`on: [push, pull_request]`），但 README.md:244 / CONTRIBUTING.md:233 / AGENTS.md:59 三处活体导航文档仍断言「仓库无云端 CI / 唯一门禁」，口径矛盾且未登记。S-fix 轮（任务 17-fix-B1）统一口径为：**本地 pre-push 为主门禁 + GitHub Actions workflow（D1，43.3.0）作云端兜底**；**CI 首跑待首次推库触发验证**，按 R-B9-11 parked 口径**不写「已首跑全绿」**。三处文档同步改文 + 本登记落位，计数 / 链接 / 脚本计数面零漂移（docs-consistency 0 + `audit:l0-links` 0 + self-test 412/412 + eval 101/101 + typecheck 0，实测见修复报告）。

**R-B9-13 云 CI 断言 sweep 登记（终审 B1a）——同类「无云端 CI」断言 4 处同行收口（首跑待推库）**

- 批次终审重审裁定 B1a：B1 已闭环三处（README.md:244 / CONTRIBUTING.md:233 / AGENTS.md:59），但同类「仓库无云端 CI / 唯一门禁 / 唯一质量屏障」活体断言仍散落 4 处，须合并前闭环。S-fix 轮（任务 17-fix-B1a）统一为「本地 pre-push 为主门禁 + GitHub Actions workflow（D1，43.3.0）作云端兜底」口径（同 README「CI 策略」节；CI 首跑仍按 R-B9-11 / R-B9-12 parked 口径**不写「已首跑全绿」**），4 处：
  1. `.github/PULL_REQUEST_TEMPLATE.md:11`（B1a-3）：模板校验要点句「本仓库无云端 CI…」→「主门禁 + GitHub Actions workflow 作云端兜底；以下校验要点须本地通过」。
  2. `docs/troubleshooting.md:26`（B1a-1）：1.2 节契约声明改按 README:244 口径对齐，注明 `--no-verify` 仅绕过本地门禁、云端 CI 仍触发，保留「破坏契约」警告。
  3. `docs/user-guide.md:114`（B1a-2）：6 节依赖巡检背景改「仓库此前不集成云端 CI，Dependabot 已剔除；43.3.0 起已配置 GitHub Actions workflow 作 CI 兜底，Dependabot 仍剔除，依赖巡检维持人工定期执行」（Dependabot 剔除决策来源为 `2026-08-11-p0-p2-fixes-design.md` §6；背景改写按重审建议未再内联引用）。
  4. `CONTRIBUTING.md:215`（B1a-4）：提交流程「19 项本地门禁，替代云端 CI」→「19 项主门禁，云端 CI 兜底同源执行」，与 233 行口径自洽。
- **云 CI 断言 sweep 关键词集（防同类复发，纳入一致性自省复查，批 N 候选）**：`不集成云端|无云端 CI|唯一门禁|唯一质量屏障|替代云端 CI|GitHub Actions`；复查面 = 活跃导航文档 README / AGENTS / CONTRIBUTING / INSTALL / adoption-guide / user-guide / troubleshooting / `.github/PULL_REQUEST_TEMPLATE`。命中仅定位待核文档（词面出现 ≠ 违规），须人审断言语义与「主门禁 + 云端兜底」当前口径是否一致后再改 / 引入断言（`GitHub Actions` 词面在正确口径文案中属常规出现，不作禁词）。建议随下一轮一致性自省复查落地为批 N 候选（decision-log 登记或复查清单项）；本登记同时作为 43.3.0 时点全文 sweep 证据——修复后既有 3 处 + 本轮 4 处全口径统一，**当前态**无残留「无云端 CI / 唯一门禁 / 唯一质量屏障」断言；关键词集回扫仅余 user-guide:114 的**过去时**历史表述「此前不集成云端 CI」（既定口径，非当前态断言，按建议保留）。
- 修后实测：docs-consistency 0 + `audit:l0-links` 0 + self-test 412/412 + eval 101/101 + typecheck 0（4 文件均被跟踪在 docs 面 / 模板面，纯 prose 改动；实测绿项见任务 17-fix-B1a 报告）。

**R-B9-14 云端 CI 撤除裁定（用户裁定 2026-10-09，S-fix 任务 18）——workflow 删除 + 活体文档口径回摆 + 防复发约束**

- **用户裁定全文**：本仓库**未开启 GitHub Actions workflow 权限**，不使用云端 CI——批次 9 D1 引入的 `.github/workflows/ci.yml` 须撤除，全部活体文档口径回摆为「本地 pre-push 唯一门禁」，并在 decision-log 登记裁定与防复发约束。**R-B9-11（CI 首跑 parked 登记）、R-B9-12（云端兜底口径同步）、R-B9-13（四处 sweep 收口）中的「CI 首跑待推库 / 云端兜底」口径全部作废关闭**：workflow 已删除，不存在待触发的首跑；三登记作为历史留痕保留（不篡改原文），当前口径以本条为准。
- 处置：① `git rm .github/workflows/ci.yml`（`.github/` 其余内容 ISSUE_TEMPLATE / PULL_REQUEST_TEMPLATE 等保留）；② 活体文档 7 处口径回摆为「本地 pre-push 为唯一门禁；仓库未开启 GitHub Actions workflow 权限，不集成云端 CI（用户裁定 2026-10-09，R-B9-14）」——README.md「CI 策略」节 / AGENTS.md pre-push 表行（恢复「仓库无 `.github/workflows/`」）/ CONTRIBUTING.md:215（恢复「19 项本地门禁，替代云端 CI」）与 :233 / `.github/PULL_REQUEST_TEMPLATE.md` / docs/troubleshooting.md §1.2（保留「破坏契约」警告与 `--no-verify` 说明）/ docs/user-guide.md §6（保留 Dependabot 剔除叙述，其「无 CI 时价值有限」理由恢复有效）；③ CHANGELOG 43.3.0 节按未发布版本如实反映最终态（移除 D1 Feat 条目，验证记录 CI parked 表述改为撤除说明；「先红后绿」「1641s」等实测记录保留）。
- **防复发约束**：后续批次不得引入云 CI workflow（GitHub Actions / GitLab CI 等），除非用户显式开启权限并另行裁定。
- **sweep 关键词方向更新（替代 R-B9-13 的「主门禁 + 云端兜底」对照口径）**：活体导航文档出现 `GitHub Actions|workflows/` 词面即须人审对照本裁定（裁定 = 不集成云 CI；技能能力边界类陈述——SSoT「不内置 GitHub Actions」、activation-guide 触发反例、模板示例等——不属违规）；R-B9-13 关键词集其余词面（`不集成云端|无云端 CI|唯一门禁|唯一质量屏障|替代云端 CI`）在回摆后均为合法口径，命中仅定位、不判违规。

**R-B9-5 计数口径说明**

- 批次 8 账本以 `42620669..HEAD` 为计数口径（26 提交，含批 8 收口提交重放差异），本批以 `main..HEAD` 为口径（16 提交 + 未合入收口提交）。**两口径在「批次边界是否含收口提交」上有差**，不影响任何门禁（git 提交计数非门禁面）；为防止跨批对账混淆，本清单固定口径：**主线提交数以 `main..HEAD` 计，批次边界以计划书基线 commit 为准**。

| 维度 | 内容 |
|---|---|
| 版本号 | 43.3.0（批次 9 目标版本） |
| 门禁影响 | `check-docs-consistency.ts` 新增 D8（count-claim-live-docs，漏登记即红）+ A18 去 shell（`findVitestBin` JS 入口 + spawn 数组透传，fail-closed 保持）；`lib/project-root.ts` 统一三调用点（等价映射，运行期行为不变）；`logic/artifact-gate-logic.ts` 下沉 gate-log 读取（行为不变）；`gate-report.ts` 新增第 4 参 tailFields（可选，向后兼容）；`.eslintsecurity-baseline.json` 294→219（重新生成，lint:security 绿） |
| 验证 | prepush 19/19 全绿（实测 1641s，2026-10-08，本机运行；**先红后绿诚实性**：首轮第 14 项 npm audit 因 registry 瞬时 `connect ETIMEDOUT` 未命中 T2 收敛 skip 枚举而 fail-closed 红 1 项、其余 18 项全绿，网络恢复复跑后 19/19 全绿，留痕见 T17 报告）+ 专项复跑（l0-links 0 / eval 101/101+覆盖矩阵 / self-test 412/412 / docs-consistency 0）+ D3 变异抽测 RED 证据（翻转共享期望表 gate.ts 1 条 expectedPassed → self-test 对应用例转红 411/1 → 还原 412/0）+ 重复度抽区复测（verifier/gate 区无第二份独立声明）；**CI 首跑 = 待用户推库触发 GitHub Actions 的 parked 项（R-B9-11，不写已首跑全绿）**；任务 16 提交时点实测：docs-consistency 0 违规 + eval 101/101 + self-test 412/412 + typecheck 0 + `audit:l0-links` 0 违规（819 链接） |
