# 8 阶段 live run 调测发现全量修复 实施规格 v1.0

> 状态：**待批准**（批准后立计划、按波次实施）
> 依据：8 阶段真实调测报告 `docs/debug/2026-09-23-wm-8phase-live-run/README.md`（D-1..D-10）+ `CHANGELOG.md:57` 未解清单 ③④⑥。
> 基线：main @ `4085a181`（工作树含两个未跟踪 debug 目录）。计数基线：cli .ts 46 / exit-2 45（check-* 27 + 工具 18）/ self-test 357 / references 44 / schema 34 / 反模式 48 / run-log action 30 / pre-push 19。
> 核验方法：本规格的全部事实断言经 **4 路只读子代理独立核验**（非采信报告原文），凡与报告不一致处以核验结论为准并在 §1 逐条订正；证据一律给 `file:line` 或可复核命令。
> 与报告的关系：报告是**只读调测**（未改技能包）。本规格是「修复全部问题」的设计层裁定，报告原文不改写，订正记录在本规格与 CHANGELOG 落地。

---

## 1. 事实基座与核验结论

裁定记号：**成立** = 报告断言与代码事实一致；**成立（订正）** = 现象成立但归因/口径需改写；**部分成立** = 现象成立但范围/计数与实测不符；**已消解** = 该问题在当前 HEAD 已不存在。

| # | 报告断言（摘要） | 核验裁定 | 关键证据（逐字引用见 §4 各 WS） |
| --- | --- | --- | --- |
| D-1 | iceberg R6 三视角命名空间不等宽 → 阶段 2-8 结构性不可过 | **成立（订正）** | `logic/iceberg-sweep-logic.ts:116` 设计 ID 正则硬编码 SD/DD/INTF；`:161-167` tla 视角只取 `sdCoverage.coveredSdNodes`（SD-only）；`logic/tla-logic.ts:1021-1029` 锁定 SD 语义。实测 demo：graph/rtm 各 8 项、tla 2 项 → R6 exit 1。**订正**：阶段 3-8 结构性必红；阶段 2 取决于图内容（SD-only 图可过），非「阶段 2-8 全部必红」 |
| D-2 | 阶段 5-8 双 R3 规约互不相认，每阶段需双份 R3×9；聚合使全组成为硬义务 | **成立（订正）** | `logic/coding-plan-logic.ts:305-320`（`r3-reviews/phase<N>-<stage>-<dim>.md` 9 份 + `v-reviews/phase<N>-<stage>.md` 3 份，**仅 `existsSync`，不校验内容甚至不校验非空**）vs `cli/check-preventive-review.ts:228-234`（`preventive-reviews/<N>[-variant]-<dim>.json`，schema 校验）。**订正**：真实成本是 **12 份 MD/阶段 + 3 份 JSON/(阶段×变体)**；双轨是 `references/hard-constraints.md:57` 明文设计-of-record，非意外；聚合硬义务见 `cli/check-artifact-gate.ts:286-289,592,624` |
| D-3 | R7 只检相邻单调，无法检出既有行就地改写 | **成立（比报告更严重）** | `logic/run-log-logic.ts:1100-1111`（`valid` 按文件顺序，逐对比较时间戳）。实测突变 4 类（改 note / 改时间戳 / 删行 / 插行）+ 删除签名链引用的 14 条记录 → `check-run-log` 与 `check-signature-chain` **双双 exit 0**；签名链 sigHash 不含 run-log 行内容（`logic/signature-chain-logic.ts:119-124`）且 `check-signature-chain` 完全不读 run-log。在盘硬证据：live `run-log.jsonl` 443 行 vs 归档快照 419 行、另存快照 404 行，14 条已归档记录行号整体 +3（3 条位置插入的整分钟时间戳记录），归档门禁 exit 0 |
| D-4 | R11 与 check-checkpoint 自我指涉 → 逐阶段自举，8 阶段全用 D-6 变体 | **已消解（残余为纪律缺口）** | R0 首阶段自举形态已实施（`logic/checkpoint-logic.ts:241-250`，提交 `1800d106` 在 main 上且早于调测起始日）。最小 fixture 实测：阶段 1 自然时序 `check-checkpoint` **exit 0**（含 `BOOTSTRAP_VALIDATION` 诊断）；阶段 ≥2 自然时序 `check-checkpoint` 与 `check-run-log` **均 exit 0**。反向（先写放行后补门）仍必红：阶段 ≥2 实测 12 条违规（5×R11 + 6×R8 + 1×顺序倒置）。**结论**：结构性死锁不存在；缺的是顺序纪律成文（D-8） |
| D-5 | ① wm-write/olog 强制单调与回溯需求冲突；② Σtokens 因 R3 重复归账放大至约一半 | **①成立（订正）②部分成立** | ① 单调强制在**调测自建物** `eval/e2e/demo/.w-model/tools/olog.py:81-85`（gitignored，非技能包资产）；技能包 `logic/state-write-logic.ts` / `cli/wm-write.ts` 全无时间戳策略，但**也没有任何 O 侧 append 工具**——这才是每个项目自造工具（且其行为不受约束）的根因。② `cli/check-budget.ts:156-167` 无去重键累计；实测可归因重复 15 组（全为 R3 三条目）共 72.8M = **13.9%**，非「约一半」；真因是 **9/9 次 `check-budget` 调用均未传 `--run-log`**（`budget-logic.ts:182-185` 静默跳过 R6/R5-b，且权威调用表 `operational-recovery.md:449-455` 本身未写该参数） |
| D-6 | codegraph CLI 在但 demo 无索引 → 制品级记录替代真实查询，门禁接受 | **成立（补充）** | `cli/check-codegraph-queries.ts:215-365` 只验 schema + `changeId`/`targetFiles` 覆盖 + 时序，**不读 callers/callees/blastRadius 内容**；`schemas/codegraph-query.schema.json` 无任何可证明执行过的字段（无 cliVersion/exitCode/耗时/原始输出）；实测手工编造记录（项目无 `.codegraph/`）**exit 0**。**补充**：`cli/ensure-codegraph.ts:97-115,201-216` 的 L3 自动 `codegraph init` **已实现且技术可行**（实测 init 成功），但本轮 run-log 中 `ensure_deps` / `codegraph_query` 动作记录 **0 条**——是运行纪律缺失而非能力缺失；且 `references/hard-constraints.md:79` 明令「不得伪造查询记录」 |
| D-7 | maturity R5 `O_PATTERN(\bO[1-6]\b)` 与 O3 规则编号冲突；无豁免通道 | **成立（补充）** | `cli/check-maturity.ts:82-99` 扫 run-log 的 `note` 字段；`logic/maturity-logic.ts:142-152` R5 无容差无豁免。方案语义冲突实体：运维模式 O3=Verifier Theater（`SSoT:669`、`data-models.md:520`）vs V 门禁的 evidence 扣分也叫 O3（`logic/verifier-logic.ts:622`）。实测 demo run-log 命中 17 次（含「O3 evidence 文法」「O3 罚分清零」等纯引用）→ R5 判 `passed=false`。**补充**：存在**隐性规避通道**——省略 `--run-log` 即静默跳过 R5（`p1-G-17-maturity.log` exit 0 现场），live run 8 阶段全用它 |
| D-8 | 文档称阶段 1 允许后置、实现要求严格早于 | **成立（订正 · 方向相反）** | 实现**确实**有 phase-1 × check-checkpoint 后置窗口（`run-log-logic.ts:1473-1479`，实测 E7 生效）。文档现状：`operational-recovery.md:462,470-484`、`SSoT:1458,1891`、`AGENTS.md:160` **一致**；缺的是 `hard-constraints.md:55`、`SSoT:1937`、`data-models.md:574`、`command-reference.md:69` 的**例外登记**，以及 `SKILL.md:69,88,92-101` 完全未写「放行记录须为阶段末条」这一顺序步骤。`AGENTS.md:160` 的「见 check-checkpoint.ts 行」是无行号悬空引用 |
| D-9 | 归档 366 件中 186 件含本机绝对路径；归档 README 与 checkpoint-log 已披露 | **成立（订正）** | gitignored 归档目录实测 **185/366** 含 `w_skill_opt`（demo git `HEAD=185 / HEAD~1=0`，零 remote）；tracked `docs/changes/archive/**` **0 命中**（gitignore 保护在）。**订正**：归档 README **未**披露（grep 零命中）；且 `references/phase-8-acceptance-test.md:284` 本就明文「archive 产物禁止具体文件路径」——**这不是缺规则，是既有规则与「逐字节快照」义务的张力未被裁定** |
| D-10 | V 子代理 rawScores 构造模式反复被拦（13 次、5 阶段），建议固化进 V 简报模板 | **部分成立** | 现象属实：实测 16 份 verifier exit-1 日志、等差文案 44 次、跨 6 个阶段前缀；模板侧三条硬约束**全部缺失**（`subagent-delegation.md:743-752`、`:1190-1194`、`agent-personas.md`、`verifier-spec.md:803-834`）。**订正**：① 标签错位——等差判据是 P3.10（`verifier-logic.ts:533-555`，且 logits 豁免），R13 是单轴下限（`:215-232`）；② **无**整数/比例检测（报告未主张，但需明确）；③ O3 文案的真实成因之一是**双 L 形态** `path:L51-L53=` 不符 `EVIDENCE_PATTERN`（`verifier-logic.ts:317`）却报成「空泛声明」 |

### 1.1 核验中新增登记（报告未登，本规格纳入修复）

| # | 发现 | 证据 | 影响 |
| --- | --- | --- | --- |
| N-1 | iceberg `scope` 视角与设计 ID 视角**同池两两比对**：只要 `.w-model/change-scope.json` 在盘，阶段 5-8 的 R6 必红（文件路径 vs 设计 ID 命名空间），且 R8 收敛集含 scope 文件项会接力报红 | `iceberg-sweep-logic.ts:63-66,261-267,302`；`cli/check-iceberg-sweep.ts:185`。demo 因命名差异（`change-scope.p5.json`）侥幸未命中 | 与 D-1 同根，必须一并修 |
| N-2 | coding-plan R5 只查文件名存在性（**空文件充数**），与同文件 R3（首行身份 + `Task N: complete`）、R4（`size === 0` 拒）形成质量缺口 | `coding-plan-logic.ts:310` vs `:339-359,:368` | D-2 的成本被「12 份零内容文件」放大 |
| N-3 | `samples/run-log/valid.jsonl` 的 phase-1 决策文本疑似不满足 `check-checkpoint` R4 阶段主题词（待实施期实测确认） | `checkpoint-logic.ts` PHASE_KEYWORDS + R4；该 fixture 被 `self-test.ts:1314,1485` 引用 | 既有样本自洽性，实施期核查 |
| N-4 | verifier O3 失败文案把「格式不符（双 L）」误报为「空泛声明」，掩盖真实修法 | `verifier-logic.ts:317-322,610-624` | D-10 的返工成本主因之一 |
| N-5 | 技能包缺**O 侧 run-log append 工具**（`wm-write` 是整文件原子写，无追加语义）→ 每个项目自造工具，行为不受约束 | `cli/wm-write.ts:171-178` 无追加；`state-write-logic.ts` 无时间戳/顺序策略 | D-5① 的真身，且是 D-3 篡改能力的前置条件 |
| N-6 | 阶段门**权威调用表**未含 `--run-log` → budget R6 永不生效 | `operational-recovery.md:449-455`、`subagent-delegation.md:337`、`toolbox.md:17` | D-5② 的真因 |
| N-7 | evidence **producer 侧**要求 `.w-model/signature-chains/`（复数目录），而全仓约定是根级 `signature-chain.jsonl` → 真实项目的导出链**整体不可用**（`MISSING_SIGNATURE_CHAIN` exit 1），比 ⑥ 的措辞（「白名单缺根级文件」）更严重 | `logic/evidence-provenance-logic.ts:385,433`；`logic/evidence-export-logic.ts:109-114,185-188,297-298`；约定见 `references/signature-chain-guide.md:7,178`、`archive-integrity-logic.ts:33-37` | 遗漏⑥(b) 的根因；必修 |

---

## 2. 修复方案总览（三选一）

| 方案 | 内容 | 优点 | 缺点 |
| --- | --- | --- | --- |
| ① 单批全量 | 一个规格 + 一次收口，全部 WS 一起上 | 无跨批漂移，一次 prepush | 改动面过大（1 新 CLI、4 schema 文件、20+ 测试、30+ 文档位置），单次评审不可控，prepush 失败定位成本高 |
| ② **三波（推荐）** | Wave A 门禁语义与牙齿（D-1/N-1、D-2/N-2、D-6、D-7）→ Wave B 完整性与纪律（D-3/D-5①、D-4/D-8、D-5②/N-6）→ Wave C 披露面/产物形态/遗留销项（D-9、D-10、③④⑥/N-7）+ 收口 | 每波独立可验收（含目标门禁回归 + 全量 prepush），单波评审面可控；风险高的篡改-evidence 机制单独成波、单独取证据 | 波间需维护「登记一致」（每波末尾更新 CHANGELOG 与计数） |
| ③ 最小集 | 只修高危（D-1、D-2、D-3、D-6、D-7），其余登记 | 成本最低 | 违背「修复全部问题」的指令；D-4/D-8/D-9/D-10 与 ③④⑥ 会再次以同形态复发 |

**选定 ②（三波）**，全部 11 个 WS（WS-0..WS-10）均实施，无裁剪；波次只影响顺序与验收边界。

### 2.1 全局设计原则（约束，全部 WS 适用）

1. **SSoT 优先**：先改 `docs/skill-design-document_SSoT.md`，再改 `w-model-dev/` 资产，最后同步 `README.md`/`AGENTS.md`/`CHANGELOG.md`/`CONTRIBUTING.md`。
2. **零新增 LLM 调用、脚本自包含、logic 层零 `node:fs`**（新模块遵 2026-09-22 WS-A 成文的 IO 约定：注入参数 + CLI/lib 适配器；`w-model-dev/scripts/cli|lib|logic` 只依赖本目录 + Node 标准库 + 已声明 devDeps）。
3. **不改判据编号**：新增语义一律**并入既有规则**（run-log R7、maturity R5、coding-plan R5 各自扩展），不新增 R 编号（避免 `GATE_JSON` 摘要键、文档规则表、self-test 正则三面连锁）。
4. **不新增反模式编号**：伪造时序类禁令写成既有约束 #11 的补充句（避免 48 条计数四方同步；口径沿用 RC-2 裁定）。
5. **不新增 schema 文件**（34 份不变）、**不新增 references 文件**（44 份不变）、**不新增模板文件**（避免资产计数连锁）。
6. **新字段一律可选**：历史 fixture（24 份 run-log JSONL + samples 诸族）不改即绿；历史记录走 LEGACY 段 + 非阻断诊断。
7. **每处 exit-2 门禁必须补 NEGATIVE-COVERAGE 登记**（四列语法 + `文件#唯一子串锚`），并让 `check-samples-coverage` 的串行探针闭环。

---

## 3. Wave A · 门禁语义与牙齿

### WS-1 · iceberg 三视角命名空间分池（D-1 + N-1）

**方案对比**

| 方案 | 语义 | 代价 |
| --- | --- | --- |
| A 收窄到 SD-only 等宽 | graph/rtm/tla 三视角全部只比 SD | 丢失 graph↔rtm 的 DD/INTF 漂移检出（**新盲区**，需另找门承担） |
| B 加宽 tla 视角 | 让 tla manifest 覆盖 DD/INTF | 与「`@designIds` = SD 节点 ID」规约（`tla-plus.md:260,281`）冲突，须改 4 处规约 + schema + 回填规约，语义倒退 |
| **C 命名空间分池（选定）** | 按视角语义分池比对，不做「全体两两相等」 | R6 算法重构 + 测试重构 |

**选定 C**，判据（逐池）：
- **池 A（设计 ID · 宽）**：`graph ↔ rtm` **精确相等**（保留 DD/INTF 漂移检出——两视角同源于 designDoc，漂移即装配缺陷）；
- **池 B（设计 ID · SD 切片）**：`tla` 与宽视角的 **SD 切片双向相等**（`tla == (graph ∩ rtm) ∩ SD`，超出与漏项都报）。tla 的 SD-only 是**规约语义**，故跨命名空间的 DD/INTF 宽度差不构成差异；反向「SD 未被 TLA 覆盖」**不豁免**——该方向的守护分工是：阶段 1-4 由 `check-tla-model` 的 `uncoveredSdNodes`（phase≥2 强制为空 + 与 `graphSdNodes` 交叉校验）承担，**阶段 5-8 该门不再复检该不变量**（`SKILL.md:99`：`check-tla-model` 仅阶段 1-4 列入 G 门禁），故阶段 5-8 由 R6 的窄池双向判据守护——「不重复主张」不成立，双向是必要加固（门禁能力不可为省一次重复而退化）；
- **scope（文件路径命名空间）**：**退出 R6 比对与 R8 收敛集**，仅保留 R7 的存在性声明。
- R6 违规文案按池命名（`R6[design-wide] graph↔rtm 差异项：…`）以便排障。

**落点**：`logic/iceberg-sweep-logic.ts`（`:116` 抽取参数化、`:138-189` deriveViewSets 标注视角命名空间、`:261-267` R6 分池、`:300-310` R8 收敛集限定设计 ID 视角）。
**同步面**：`__tests__/iceberg-logic.test.ts:181-190,239-257,297-307`（宽抽取断言改 SD 期望 + 新增 scope-不参与 R6 用例 + 新增「graph↔rtm 的 DD 漂移仍红」负例）；`samples/iceberg/*` + `self-test.ts:1729-1756` ICEBERG_CASES；`samples/README.md:29`、`NEGATIVE-COVERAGE.md:81`（新增负例登记）；文档 `references/iceberg-sweep-guide.md:197-206`（§8.1 表）、§8.3/8.4、`SSoT:2267-2271`（§10L.3，改正自相矛盾句）、`AGENTS.md:20,170`、`CHANGELOG.md`。
**风险**：判据变化后历史归档的 iceberg 结论不可重放复现同一退出码（归档不跑门禁，接受；写进 CHANGELOG）。
**验收**：demo 阶段 2-8 既有证据上复跑 `check-iceberg-sweep` → R6 不再差异（若报告声明字段与新口径冲突则以 samples 正例代替，并在证据中说明）；负向探针 **4 条**：`graph↔rtm` 删一个 DD → exit 1；`tla` 含 graph 外 SD → exit 1；`tla` 漏 SD（graph 有而 tla 无）→ exit 1（反向守护：阶段 5-8 无 `check-tla-model` 复检该不变量）；`scope` 在盘且与 ID 不一致 → **exit 0**（修为目的）。

### WS-2 · 编码链 R3×9+V×3 契约固化与前置自检（D-2 + N-2）

**方案对比**

| 方案 | 评价 |
| --- | --- |
| A R5 接受 preventive 形态 | 破坏 stage 粒度（preventive JSON 是 phase 级），须改 `preventive-review.schema.json` 加 `stage`，并让两门互认 → 判定面翻转，波及全部 8 阶段 |
| B 单一产物双门共享 | 弃 JSON 等于弃 `passed=false ⇒ findings ≥1`（约束 #11）与反模式 #33 的机器挂点 → 最高风险，否决 |
| **C 保持双轨 + 契约固化 + 前置自检（选定）** | 与 `hard-constraints.md:57` 设计-of-record 一致；成本转向「防漏」与「内容下限」 |

**选定 C**，三项落地：
1. **R5 内容下限**（补 N-2）：12 份 MD 由「文件存在」升级为「**非空 + 至少 1 条行级证据锚**」（锚形态沿用 verifier 的 `path:Lnn` / `path:§sec` 家族，作为**下限**而非质量评审——质量仍属 V/R3 职责）。
2. **前置自检**：`cli/check-coding-plan.ts` 新增只读 `--preflight` 模式——打印本阶段必需清单（plan / 账本 / 三件套 / R3×9 / V×3 / scope / codegraph 记录）与缺失项，**不改 R5 判据、不影响退出码语义**（缺失即 exit 1，但输出清单化，供 O 在电池前一次性对齐）。
3. **契约成文**：把「12 份 MD + 3 份 JSON 的分工与路径」写进 `templates/coding-plan.md:54`、`subagent-delegation.md:316,1069`（派发清单）、`phase-5-coding.md:105`、`hard-constraints.md:57,794`、`SSoT:1947`。

**同步面**：`samples/coding-plan/{valid-phase5,bad-missing-ledger,bad-task-missing-verify}` 各补 R3/V 文件内容（非空 + 锚）；新增负样本 `bad-review-empty`（空文件 → exit 1）与 `bad-review-no-anchor`（无锚 → exit 1）；`__tests__/coding-plan-logic.test.ts:421-445` + `check-coding-plan.test.ts:80-86` + `artifact-gate-external.test.ts:107-113` helper；`samples/README.md:43`、`NEGATIVE-COVERAGE.md`（check-coding-plan 行）。
**验收**：`--preflight` 对 demo 阶段 5 plan 打印全清单且 exit 0/1 语义不变；空文件与无锚样本双双 exit 1；demo 既有 12 份产物（含内容）在新判据下仍绿。

### WS-3 · codegraph 真实性与显式降级（D-6）

**方案对比**：A 加密（要求 CLI 证据字段 + 索引存在）会在无 CLI/离线环境造成死锁，并打红全部既有制品；**选定 B（显式降级）+ C（运行纪律）**：
1. `schemas/codegraph-query.schema.json` 增**可选**字段：`evidenceKind: 'cli' | 'artifact'`、`degradationReason`（string）、`alternativeEvidence`（≥1 条 `{command, evidencePath}`）。
2. `cli/check-codegraph-queries.ts` 新判据：项目存在 `.codegraph/` 索引 → 记录必须 `evidenceKind: 'cli'`（否则 violation）；不存在 → 必须 `evidenceKind: 'artifact'` + 非空 `degradationReason` + ≥1 条 `alternativeEvidence`（否则 violation）。**未声明即 violation**（把隐形制品口径变为显式声明）。
3. 运行纪律：`phase-5-coding.md`「codegraph 修改前影响分析」节补「无索引降级路径 + `codegraph sync`（索引陈旧同步）」；`hard-constraints.md:79` 措辞区分「降级声明（合法）」与「伪造查询（禁止）」；`ensure-codegraph` 记录义务写入分派清单（run-log `ensure_deps` 动作已在词表内）。

**同步面**：`samples/codegraph-queries/{valid-phase5,bad-missing-blastradius,bad-missing-field,bad-empty}`（补 `evidenceKind`）+ 新增 `bad-degraded-without-evidence`、`bad-cli-kind-without-index`；`self-test.ts:1850-1879` CODEGRAPH_QUERY_CASES；`__tests__/check-codegraph-queries.test.ts`；`samples/README.md:42`、`NEGATIVE-COVERAGE.md:84`；`eval/mappings.json` #22 锚点核对。
**验收**：无索引 + 无降级声明 → exit 1；无索引 + 降级 + 替代证据 → exit 0；有索引 + artifact 声明 → exit 1。

### WS-4 · maturity R5 口径（D-7）

**选定**：机器可读通道 + 词法降级为诊断 + 未接线可见化：
1. `schemas/run-log.schema.json` 增**可选** `operationalFailureModes: string[]`（enum `O1`..`O6`，每项至多一次）。R5 计数**只读该字段**（真值通道）。
2. 词法扫描（`\bO[1-6]\b`）保留为**非阻断诊断**：命中即输出「疑似引用 N 处（含规则编号引用，非运维失败）；若确为运维失败请在记录中以 `operationalFailureModes` 标注」。这既消除 17 次误计，也避免「收紧词表 → 形同虚设」的假阴性。
3. 未提供 `--run-log` → 输出非阻断诊断「R5 未生效」，堵隐性规避通道。
**同步面**：`cli/check-maturity.ts:82-99`（含 `--run-log` 缺失诊断）、`logic/maturity-logic.ts:142-152`（+ warnings 通道）；`data-models.md:520`（标注约定）、`SSoT:669,674`（§4A.2a O 系列标注格式）、`conventions.md`；`samples/run-log/*` 新增 `valid-operational-modes.jsonl`（字段命中 → exit 1）与 `valid-o3-mention-only.jsonl`（仅引用 → exit 0）；`__tests__/maturity-logic.test.ts`（现无 `countOperationalFailures` 覆盖，新增用例）。
**验收**：demo run-log（17 次引用命中）→ **exit 0** + 诊断；手工插入 1 条 `operationalFailureModes:['O3']`×3 → exit 1；未传 `--run-log` → exit 0 + 诊断。

---

## 4. Wave B · 完整性与纪律

### WS-5 · run-log 防篡改（D-3 + D-5① + N-5）

**机制设计（四层，含固有限制的诚实边界）**

| 层 | 机制 | 捕获的篡改 |
| --- | --- | --- |
| L1 **追加器**（新 CLI `wm-append-runlog.ts`） | 读现有 JSONL → schema 校验 → 链校验 → 追加（**时间戳严格单调**：系统时间不递增时**拒绝**；`--timestamp=<iso>` 或 `--allow-clock-adjust=<reason>` 显式注入并在 note 记录）→ 走 `state-write-logic` 的锁+备份+tmp/rename+回读原子写；`--correct=<runId>` 生成**更正记录**（`note` 含 `correction-of:<runId>`，不删不改旧行） | 静默时间戳覆盖（olog.py 形态）从机制上消失；手改历史行不再是唯一路径 |
| L2 **记录哈希链**（可选字段 `recordHash`/`prevRecordHash`） | `recordHash = sha256(prevRecordHash + '\n' + canonicalJson(record − recordHash))`；`check-run-log` R7 扩展为「①时间戳单调（现状）②链连续（对携带字段的记录）③锚自洽」，链断 = blocking，首个无哈希记录之前为 LEGACY 段（非阻断诊断） | 改/插/删**中段**记录（须整链重算才能不被发现） |
| L3 **checkpoint 锚**（可选字段 `runLogAnchor: {lines, sha256}`） | 锚 = **该放行时间戳之前的记录前缀**（文件序、按 timestamp ≤ releaseAt 过滤）摘要；`check-run-log` 校验每条锚自洽 | 放行后对历史前缀的改写/插入（observed 案例） |
| L4 **归档前缀性**（`check-archive-integrity` 新可选参数 `--live-run-log=<path>`） | 归档内 `run-log.jsonl` 快照必须是 live run-log 的**字节前缀**；缺失该参数时为非阻断诊断 | demo 实测形态（归档 419 vs live 443、14 行位移） |

**固有限制（诚实登记）**：锚定机制给出的是**前缀不可变**保证——最后一个锚点之后的尾部在下一次锚定前不可证伪；且掌握工具链的攻击者可整链重算 + 重算全部下游锚。最强外部锚是本仓库既有的**归档快照**与**导出包 SHA-256 manifest**（L4 与 evidence 导出），本规格不主张「密码学不可抵赖」。

**方案对比**：A 纯哈希链（历史日志须 LEGACY 窗口，否则全红）；B run-log↔签名链交叉绑定（签名环 166 ≪ 443 行，且会打红全部既有签名链，否决）；**选定 A+C+D（L1/L2/L3/L4 组合，全部新字段可选）**，不新增脚本以外的编号（并入 R7）。

**落点**：新增 `w-model-dev/scripts/cli/wm-append-runlog.ts` + `w-model-dev/scripts/logic/run-log-append-logic.ts`（纯函数，零 `node:fs`）+ `w-model-dev/scripts/lib/run-log-append-fs.ts`（适配器外置，遵 WS-A 约定）；`logic/run-log-logic.ts:1100-1111` R7 扩展；`logic/archive-integrity-logic.ts` + `cli/check-archive-integrity.ts`（L4，注入式读文件）。
**同步面（登记连锁，机械但必须）**：`AGENTS.md` §1 脚本计数（45→46）与 §8 表新增行、`conventions.md`（脚本计数 45→46）、`subagent-delegation.md:375` + §6 dispatch-matrix、`data-models.md`（run-log 字段表 + 状态写入节）、`check-docs-consistency` 的 exit2 计数与「AGENTS §8 cli 基名登记」、`samples/NEGATIVE-COVERAGE.md` 新增一行（新 CLI 的 exit-2 探针）、`samples/README.md` 矩阵、`self-test.ts` 新用例、`__tests__/`（新 CLI 测试 + run-log-logic R7 新用例）。
**文档禁令（替代动作必须给出）**：`data-models.md:517` 附近 + `references/operational-recovery.md` + `hard-constraints.md:55`（约束 #11 补句）写明：「run-log 时间戳必须为写入时刻真值；**禁止回溯改写历史行或重排时间戳**；记录修正只允许经 `wm-append-runlog --correct` 追加更正记录」。禁令与替代动作成对出现，否则等于把 O 逼回手搓。
**验收（反伪造探针，在 `docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl` 副本上做，只读仓库）**：改 note → **exit 1**；改历史时间戳 → exit 1；删行 → exit 1；插行 → exit 1；追加一条（正确用法）→ exit 0。L4 探针：把归档快照尾部截断/在归档区插入 → exit 1；保持前缀 → exit 0。

### WS-6 · 自举顺序纪律与文档例外登记（D-4 + D-8）

**选定：仅文档/流程修复，不动 R11 判据**（删 phase-1 后置窗口会打红历史 run-log；且 R11 的「严格早于」语义本身正确）。四项：
1. `SKILL.md:88,92-101` 增显式顺序步骤：① `checkpoint-log/phase-N` 用户确认落盘 → ② 闭环五门串行（含 `check-checkpoint`，阶段 1 走 R0 自举形态）→ ③ **放行记录（`action=checkpoint`）为阶段末条**（R8 终点），其后不得有新记录。
2. `references/operational-recovery.md:445-484`：自然时序从「阶段 1」扩写为**所有阶段**（附 phases≥2 一行）、明确「同秒不算早于」、把 D-6 后置窗口定性为历史日志兼容。
3. 例外登记补齐（4 处）：`hard-constraints.md:55`（约束 #11）、`SSoT:1937`、`data-models.md:574`、`command-reference.md:69` 各补「phase-1 × `check-checkpoint.ts` 后置窗口为历史兼容例外」。
4. `AGENTS.md:160` 悬空引用「见 check-checkpoint.ts 行」补实锚（`logic/checkpoint-logic.ts:241-250`）。
**附带核查（N-3）**：实测 `samples/run-log/valid.jsonl` 是否满足 `check-checkpoint` R4；不满足则修正该 fixture 的决策文本或登记理由。
**验收**：`check-docs-consistency` 绿；三态 fixture 复现（E1/E2b/E3b 自然时序 exit 0；「先写放行后补门」阶段 ≥2 仍 exit 1）作为反伪造方向的回归锚。

### WS-7 · 记账口径与预算接线（D-5② + N-6）

**选定**：C（接线 + 可见化 + 上界口径澄清）+ 轻量诊断；**不做** schema 去重字段（去重键在 legacy 记录上不可靠：`reportId` 阶段 1-4 为空、`timestamp` 等值会误并真实并发分派；登记为后续可选）。
1. **强制接线**：`operational-recovery.md:449-455` 权威调用表、`subagent-delegation.md:337`、`toolbox.md:17` 全部改为**必带** `--run-log=.w-model/run-log.jsonl --phase=N`。
2. **可见化**：`cli/check-budget.ts` 在未提供 `--run-log` 时输出非阻断诊断「R6/R5-b 未生效（未提供 run-log）」；新增「疑似重复归账」诊断（同 `timestamp`+`tokens`+`duration_s` 多行 → 提示 Σtokens 为上界口径）。**保持**「未提供 `--run-log` 行为不变、exit 0」的向后兼容硬线（`__tests__/budget-logic.test.ts:260`）。
3. **口径成文**：`data-models.md:399` 写明「Σtokens 为**上界**口径（同一次分派的多条归账会重复累计），预算判定按上界执行」+ R3 三条目归账约定（能拆分则各自填、不能拆分则只填一条其余为 0）。
**验收**：demo run-log 复跑 `check-budget --run-log` → **exit 1** 且含 `R6：` 文案（证明牙齿真实存在，522M > 300M）；静态口径（无 `--run-log`）→ exit 0 + 诊断；`budget-cli-wiring.test.ts` 扩展新诊断断言。

---

## 5. Wave C · 披露面、产物形态与遗留销项

### WS-8 · 归档披露面（D-9）

**裁定**：**不做归档就地脱敏**（A 否决——绝对路径与 `cwd` 本身是「本机真实执行」证据，就地脱敏会同时破坏归档 README 声明的逐字节 sha256 等价与 `copiedIntoArchive` 契约）。
1. **规则澄清（主）**：`references/phase-8-acceptance-test.md:270-285` 把 `:284`「archive 产物禁止具体文件路径」改写为可执行口径：**归档允许保留执行证据原貌**（gate-log 头部 `cwd`/输入路径属证据），**禁止的是设计文档/README 中的具体文件路径**；并新增一句「**交付/外发前必须经 `wm-export-evidence` 脱敏包，禁止直接外发归档目录**」。
2. **义务成文**：`AGENTS.md:25`（本地生成物与审计证据节）与 `:31-33`（Source-bound 边界节）、`docs/INSTALL.md:15,35` 同步该义务；归档 README 惯例写入 phase-8 规范（**不新建模板文件**，避免资产计数连锁）。
3. **可选非阻断诊断（登记为后续）**：`check-archive-integrity` 增「绝对路径披露计数」——须把文件内容读取注入 logic 层，属中等成本；本规格登记不实施，理由：义务与澄清已可执行，诊断无阻断力。
**订正登记**：报告 D-9 称「归档 README 已披露」不成立；实际披露位是 gitignored 的 `checkpoint-log/phase-8.txt` 与 debug 报告，本规格在 CHANGELOG 订正。

### WS-9 · V 产物形态固化（D-10）

三项（A 主 / B 辅 / C 样本）：
1. **A 模板固化**：`subagent-delegation.md:743-752`（V 简报产出契约）与 `:1190-1194`（V-rootcause 模板）追加**三条硬约束 + 自检清单**：① rawScores 须真实离散（排序后相邻差不得恒等、不得为 0.01 完美等差；`text-parse` 下 `max-min ∈ [0.01, 0.10]`）；② evidence 每条须 `path:§sec=陈述` 或 `path:Lnn=陈述`（**禁双 L 形态 `path:L51-L53=`**）；③ `reviewedAt` 须为评审完成真实时刻（不得早于被评审产物存在时刻）。`verifier-spec.md:314-317` 自检清单 +2 条、`:530-540` 补双 L 反例；`agent-personas.md` 各 Persona「评审规则」节各补 1 行。
2. **B 文案区分**：`verifier-logic.ts:551`（等差）追加改进指引；`:317-322,610-624` 的 O3 文案区分「**格式不符**（须 `path:Lnn=stmt` 单 L 形态）」与「**空泛声明**」。改文案须同步 `verifier-logic-rule-loadbearing.test.ts:149-151` 的 anchor 字符串。
3. **C 样本补齐**：新增 `samples/verifier/bad-arithmetic-sequence.json`、`bad-resolution-floor.json`、`bad-evidence-double-l.json`；同步 `self-test.ts` VERIFIER_CASES、`samples/README.md:13`（计数）、`NEGATIVE-COVERAGE.md:69`。
**明确不做**：`reviewedAt` 时序**不**做成门禁判据（会引入时钟依赖、破坏 logic 层确定性与纯函数契约；有效检出位是冰山 R 子代理的四路时钟对账——已在 live run 实证两次捕获）。理由在 CHANGELOG 登记。

### WS-10 · 遗留销项（CHANGELOG ③④⑥ + N-7）

| 项 | 裁定 | 落点 |
| --- | --- | --- |
| ③ codingPlanSnapshot 未激活 | **激活**：装配器 `eval/e2e/demo-assets/build_workspace.py:834-845` 在归档根补 `<changeId>.plan.md` + `progress.md` + `task-<N>-{brief,report}.md`（复用 `samples/archive-integrity/valid-coding-plan-snapshot/` 形态）；驱动 `run_trajectory.sh:121` **保持不传** `--change-id`（顺带覆盖「自动派生恰一」分支） | 装配器 + 驱动 + CHANGELOG 销项 |
| ④ code-tla D4 fixture 缺口 | **补装配器**（非放宽门禁）：`build_workspace.py:211-218` 的 `src/counter.ts` 加 `import assert from 'node:assert/strict'` + `inc()/reset()` 各 ≥1 条 `assert.ok`（判据只要求全 src ≥1 条）；同改 `:957-959` 注释（现写死「D4 在 demo 源码上为红」） | 装配器 + 重建重放 + CHANGELOG 销项 |
| ⑥(a) 无 git provenance | **实现 no-git 形态 + 硬护栏**：`provenanceKind: 'git' \| 'no-git'`（新可选字段 + 条件必填）；no-git 时以「工作区内容摘要 `workspaceDigest`（对导出源集合的规范化清单 sha256）+ 身份（user/host/runId）」替代 HEAD，且**该包永久只能 package-only**——`--source-project` 复验必须拒绝（新 reason `NOT_SOURCE_BOUND_NO_GIT`）。护栏写进 schema description + AGENTS 边界节 + INSTALL | `logic/evidence-provenance-logic.ts:186-225,382,659-673`、`schemas/evidence-provenance.schema.json`、`schemas/evidence-manifest.schema.json`、`cli/wm-verify-evidence-source.ts`、测试与 6 份 localEvidenceDocs 的 token 契约核对 |
| ⑥(b) 导出白名单 | **修根因（N-7）**：`evidence-export-logic.ts:109-114,185-188,285-300` 增根级 `signature-chain.jsonl` 出口；producer 侧 `evidence-provenance-logic.ts:385,433` 同步接受根级文件（`signature-chains/` 目录保留为 legacy）；两者并存 → fail-closed（歧义拒绝） | 两个 logic 文件 + `__tests__/evidence-export-logic.test.ts:222-231,473`、`evidence-provenance-logic.test.ts:48,51` + `AGENTS.md:25`、`INSTALL.md:15`、`command-reference.md` |

### WS-0 · 收口与登记连锁

1. **计数与登记**：exit-2 脚本 45→46（`conventions.md:119`、`AGENTS.md` §1/§8、`subagent-delegation.md:375`+§6、`check-docs-consistency` 计数与基名登记）；schema 34 / references 44 / action 30 / 反模式 48 / pre-push 19 **保持不变**（本规格全程不动其口径）。
2. **文档同步顺序**：SSoT → 资产 → README/AGENTS/CONTRIBUTING/CHANGELOG（SSoT 优先约束）。
3. **CHANGELOG**：新增版本节（建议 `42.3.0`，判据：门禁判据 + 新 CLI + schema 字段 = 行为变更；是否 bump 在实施期按仓库惯例二次确认），逐 WS 登记 + 未解清单 ③④⑥ 全量销项 + D-9 订正句。
4. **全量验收**：`npm run prepush`（19 项，含全量 vitest + 覆盖率阈值 + 规则层覆盖口径 + samples 覆盖矩阵 + security-scan + prettier + tsc + eval 语料）；`npm run audit:l0-links`；每波各跑一次（波内先 `npm run test:affected`）。
5. **demo 侧回归**：Wave C 结束后按「先提交再重建」顺序跑 `build_workspace.py --reset` + `run_trajectory.sh`（期望 119/119）+ `run_negative_probes.sh`（期望 9/9）——重建会销毁 live-run 瞬态态，须先确认证据已保全（`docs/debug/2026-09-23-wm-8phase-live-run/snapshots/` 在盘）。

---

## 6. 显式不修项与登记理由

| 项 | 理由 |
| --- | --- |
| iceberg `tla` 视角加宽到 DD/INTF | 与 `@designIds = SD 节点 ID` 规约冲突，语义倒退（WS-1 方案 B 否决） |
| 合并 R3 双轨为单一产物 | 会弃掉 `passed=false ⇒ findings ≥1` 与反模式 #33 的机器挂点（WS-2 方案 B 否决） |
| 归档就地脱敏 | 破坏执行证据原真性与 sha256 等价契约（WS-8 方案 A 否决） |
| `check-archive-integrity` 绝对路径诊断 | 中等成本、无阻断力，登记为后续可选（WS-8.3） |
| `reviewedAt` 时序门禁 | 引入时钟依赖、破坏 logic 纯函数与确定性（WS-9） |
| budget Σtokens 去重字段（`parentDispatchId`） | 去重键在 legacy 记录上不可靠（阶段 1-4 `reportId` 为空；`timestamp` 等值误并并发分派），登记为后续可选（WS-7） |
| 新增反模式编号（伪造时序） | 48 条计数四方同步成本收益不匹配；改为约束 #11 补充句（沿用 RC-2 裁定口径） |
| 删除 R11 的 phase-1 后置窗口 | 会打红历史 run-log；R11「严格早于」语义正确（WS-6） |

---

## 7. 验收策略与反伪造判据

1. **每 WS 目标验收**：见各 WS「验收」段（正例 + 至少 1 条负例，负例优先走 samples + `check-samples-coverage` 串行探针）。
2. **全局反伪造探针（Wave B 结束必做）**：在 `docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl` **副本**上跑 5 类突变（改 note / 改历史时间戳 / 删行 / 插行 / 正确追加），前 4 类必须 exit 1、第 5 类 exit 0；结果落 `docs/debug/`（新增一节或独立文件）。
3. **demo 证据回归（只读）**：Wave A 后复跑 `check-iceberg-sweep`（阶段 2-8）与 `check-maturity --run-log`；Wave B 后复跑 `check-budget --run-log`（预期 exit 1，证明牙齿）与 `check-run-log --json`（预期 exit 0，历史记录不得因新规则变红）。
4. **不得回归的红线**：历史 fixture 零改动即绿（新字段全可选）；`samples/run-log/valid.jsonl` 等既有样本在新规则下维持原退出码；load-bearing 锚与禁语保留（`checkpoint-logic-rule-loadbearing.test.ts`、`verifier-logic-rule-loadbearing.test.ts`）。
5. **验收证据落点**：每波产 `docs/debug/2026-09-2X-<wave>-<topic>/`（或复用既有 debug 目录新增文件），含命令、退出码、原始输出；CHANGELOG 每波登记。

---

## 8. 开放裁定点（实施前可被用户否决/调整）

| # | 议题 | 本规格取值 | 备选 |
| --- | --- | --- | --- |
| O-1 | D-3 完整性机制深度 | L1+L2+L3+L4 全做（含新 CLI） | 只做 L1+L4（省 schema 字段与链规则） |
| O-2 | ⑥(a) 无 git provenance | 实现 `provenanceKind:'no-git'` + 永久 package-only 护栏 | 仅文档明示（零代码） |
| O-3 | 版本号 | bump `42.3.0` | 保持 42.2.1（沿用 rc-closeout 惯例） |
| O-4 | R5 内容下限强度 | 非空 + ≥1 行级证据锚 | 仅非空（更保守） |
| O-5 | 波次划分 | 三波（A/B/C） | 单批全量 |
