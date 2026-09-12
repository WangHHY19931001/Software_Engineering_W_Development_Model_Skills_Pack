# 门禁完整性修复与证据事实对账设计（verifier-spec 悬空规范 + SKILL.md 死引用 + 证据从"形状合规"升级为"事实对账"）

> 状态：已获用户批准的设计（brainstorming 产物）。
> 日期：2026-09-12。
> 背景：四轮外部调研（源库 `D:\w_skill_opt\skills` 与目标库双向交叉核验）发现三项与"选择性吸收外部方法论"无关、但会污染吸收工作的既有缺陷；随后用户要求引入 LLM-as-a-Verifier 的防偏移机制与证据支撑树方法论的常态校验，核验发现**前者已被吸收**（`verifier-spec.md` §3/§4/§5 三支柱 + `verifier-logic.ts` 60+ 条防伪造判据）、**后者已被吸收**（`evidence-anchored-tree.md`，2026-08-31），但两者各有语义丢失。本设计是三项缺陷 + 四项证据对账的统一落地规格。外部方法论吸收另立 Spec B，显式引用本设计引入的证据形态。
> 执行模式：待用户选择（Subagent-Driven / Inline）。

## 0. 背景与动机

### 0.1 三项既有缺陷

四轮调研中，对目标库自身的独立核验（读 checker 源码 + 真机跑门禁）暴露三项缺陷。三项均**不是**"缺少外部方法论"，而是既有机制的内部不一致或判据漏接：

1. **verifier-spec 悬空规范**：`verifier-spec.md:278` 规定 R14-R17 四问结论记录于 `summary` 的结构化对象 `collaborationReview: { handoff, planAdherence, roleFit, incrementalValue }`，但 `verifier-output.schema.json:48` 声明 `"summary": {"type":"string","minLength":50}`，且父对象 `additionalProperties: false`。真机实验（round 3）证实：`summary` 传对象 → `/summary: must be string`；传顶层额外键 → `must NOT have additional properties`；两者均 exit 1。**没有任何输入能同时满足规范与 schema。** 且全仓 grep `collaborationReview|planAdherence|roleFit|incrementalValue` 在 `.ts`/`.json` **零命中**——R14-R17 仅有散文规范，无任何实现与消费方。

2. **SKILL.md 死引用**：`SKILL.md` 无 `阶段门与质量门` 章节（实际章节为 核心原则 / 触发决策 / 任务规模适配 / 不可违反的约束 / 编排者-子代理边界 / 执行工作流 / 命令速查 / 阶段路由 / 门禁契约与资源清单），但全仓共 **8 处**引用该不存在的章节（`w-model-dev/` 内），**全部为死引用**（含 `workflow.md:11` 的目录项——该文件章节已拆分为「阶段门评审」与「质量门」两节）。命中的是**安全关键路径**：反模式 #1（跳过阶段门评审）与质量门 CHECKPOINT 的指引均指向该节。这些是**散文式章节引用而非 markdown 链接**，因此 `checkInternalLinks`（只校验 `[text](path)` 的链接目标）结构上无法捕获。

3. **"空即合规"**：冰山扫掠与 R3 预防性审查的通过判据在最小努力与最大努力产物之间不可区分。

   - **冰山扫掠**：`iceberg-sweep-logic.ts:99` 的 `expectedPassed = report.newFindings.length === 0`——**通过 ≡ 声明"未发现任何东西"**。且 `sweepCoverage.sweptArtifacts` 在 schema 中为 `{"type":"array","items":{"type":"string"}}`，**无 `minItems`**，空数组合法。更严重的是：该报告**没有任何字段能表达"本该扫多少"**，因此无法区分"扫完了、确实没有"与"根本没扫"。

   **精确说明消费面**：`check-iceberg-sweep.ts` **确实**被 `self-test.ts` 调用（`samples/iceberg/` 4 个 fixture 已登记），并出现在 `samples/README.md` 矩阵；但它**未**被 `check-artifact-gate.ts` 聚合（该脚本不引用 iceberg）。故现状是"形状检查会被跑，但形状本身可被空声明满足"——缺口在于判据而非接线。
   - **R3 预防性审查**：`preventive-review-logic.ts:46` 自述"此处只校验报告存在性和格式"；`:89-90` 把 `review.passed` 与 `findingCount` 抄入 summary **但从不 push 进 `reasons`**。三份 `{"findings":[],"passed":true}` 报告即通过。此为 **checker 漏接判据的 bug**，与冰山的"契约缺字段"不同类。

三项缺陷的共性：**它们都让"看起来合规"与"真的合规"无法区分**，而本仓库的核心价值主张正是确定性门禁。在吸收外部方法论之前修复，可避免新规则建立在不可信的判据之上。

### 0.2 两项方法论已被吸收（不重复吸收，仅补语义丢失）

用户提出引入两项外部方法论。核验结论：**两者均已吸收，不应重做**，但各有语义丢失，构成本设计的 A-3 四项。

**（一）LLM-as-a-Verifier（arXiv:2607.05391，github.com/llm-as-a-verifier/llm-as-a-verifier）已吸收。**

`docs/llm-verifier-integration-design.md` 记录三支柱已落地，该文档已降级为指针（"与 `verifier-spec.md` 不一致处，以 `verifier-spec.md` 为准"）：

| 支柱 | 落地位置 | 现状 |
| --- | --- | --- |
| 连续评分（logits 期望值） | `verifier-spec.md` §4.1（§4.2 text-parse 回退） | 已实现 |
| 三维度验证（粒度/重复/分解） | `verifier-spec.md` §3 | 已实现 |
| PPT 优先级排序 | `verifier-spec.md` §5（k=5 / temperature=4.0） | 已实现，含 `ranking` 校验 |

且**防伪造判据强于论文框架**：`verifier-logic.ts` 含 60+ 条 `reasons.push`，其中针对 V 漂移的专项检测包括 `rawScores` 全等判定（"视为复制填入作弊"）、`variance` 重算比对（误差 > 1e-6 即失败，且强制总体方差 N 而非 N-1）、扰动范围 > 0.10 判定、`compositeScore ≠ Σ(score*weight)` 判定、单轴下限 R13（论文无此项）。

**真实缺口**：目标库能检测 V **伪造**评分，检测不了 V **偏移**。三类偏移（用户裁定全要）：
- **标准偏移**：同一产物跨轮次被判出差异显著的等级 → 无检测（run-log 已记 `qualityLevel` 与 `artifacts`，数据基础已具备）
- **校准偏移**：V 分辨力不足（正负样本都给高分）→ 无检测（`samples/verifier/` 25 个 fixture 全是"JSON 是否合法"，**无一是"判断是否正确"**）
- **惰性偏移**：V 走形式（模板化 summary、空泛 evidence）→ 部分覆盖（R11/R12/O3），但 R12 只校验 evidence **格式**不校验被引内容真实存在

**（二）证据支撑树方法论（Evidence-Anchored Decision Tree）已吸收。**

`docs/superpowers/specs/2026-08-31-evidence-anchored-tree-{detailed,integration}-design.md` 两份吸收 spec + `docs/superpowers/sources/2026-08-31-evidence-anchored-tree-methodology.md` 逐字拷贝基准 + `w-model-dev/references/evidence-anchored-tree.md` 落地参照。该文件首句即结论："该方法论 90% 能力 w-model 已有且更强；唯一增量 = 产出期 `evidenceAnchor`"。

**真实缺口（三处语义丢失）**：
- **🟡 Pending 未获一等状态**：映射表称"三色状态 🟢🟡🔴 → 复用 `coverageStatus` + `qualityLevel`（枚举等价）"，但 `coverageStatus.partial` 语义是"覆盖不完整"，**不是"结论待验证"**。方法论中 🟡 是**常态触发**状态（"基于逻辑推理、尚未验证、优先验证"，且"递归证据请求"沿依赖链上行），目标库无等价机制。
- **`evidenceAnchor` 只校验格式**：`graph-logic.ts:800` 的 R15 为纯正则 `/^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/`，不检查文件存在、不打开文件、不验证陈述被支持。`src/nonexistent.ts:L999=捏造的断言` 可通过。
- **V 侧无交叉对账**：`evidenceAnchor` 仅加在 `graph.json` 节点（阶段 1-4 图谱侧），`VerifierOutput.evidence` 只校验格式（R12）。**"产出者声明依据什么"与"评审者声称核验过"之间零交叉校验**——这正是方法论"递归证据请求"要解决的问题。

### 0.3 统一抽象

A-3 的四项与 A-3b（冰山分母）共享同一抽象：**从"形状合规"升级为"事实对账"**。故并入同一 spec，避免出现两套"未验证即阻断"的判据（同型错误见 §4 拒绝表："新增三色 emoji 标签体系 → 与既有枚举语义重叠、schema 漂移风险"）。

## 1. 已锁定决策（用户逐项确认）

| #   | 决策点                    | 结论                                                                                  | 理由                                                                                                                                 |
| --- | ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | 缺陷 3 修复深度           | 可红信号（最大档）                                                                    | 用户选择；形状加固拦不住虚报，对账加固仅拦虚填路径；证据形态才是根治                                                                 |
| D2  | 规格组织                  | 两份 spec，缺陷优先                                                                   | 缺陷 3 与吸收 diagnosing-bugs 共享证据形态；本 spec 先立概念，Spec B 引用而非重造                                                     |
| D3  | 缺陷 1 修法               | 方案 A：规范落回 `summary` 文本                                                       | R14-R17 零实现零消费，且明示"不进入 subCriteria"、本不参与打分；零 schema/脚本成本，不为无消费者预建结构                              |
| D4  | 缺陷 2 修法               | 改引用（非新增章节）                                                                  | SKILL.md 为常驻入口（102 非空行 / 18KB），且调研已证其存在 15/42 reference 不可达；为不存在标题新增章节会加剧膨胀。真实语义已在 workflow.md 与 quality-standards.md |
| D5  | 三视角关系                | **始终平权**，由阶段动态决定在场                                                      | 用户裁定：用可解析性决定权威等于"谁好算谁说了算"，会使不一致被"主分母"吸收掉，交叉校验失去意义                                        |
| D6  | 不一致处置                | 走普通 V/G 失败链（R → V → G → S-fix）；问题大则回退阶段                               | 用户裁定：不一致**本身**即缺陷信号，不在扫掠层做处置分级；回退路径已存在于 `operational-recovery.md` 场景 5                            |
| D7  | 分母权威性                | 分母**不由 R 声明**，由 checker 从上游产物实测                                        | 让 R 自报 `total` 仍属自证，只是从"自报发现了什么"变为"自报该发现多少"                                                                |
| D8  | 视角差异严格性            | **严格**：任意两视角差异即刻失败，不允许"已说明"豁免                                   | 用户裁定；任何"说明了就可以"的通道就是下一个"空即合规"                                                                                |
| D9  | 在场表载体                | 代码常量（`iceberg-sweep-logic.ts` 内）                                               | 确定性判据的一部分；写进文档会与实现漂移（参照 `subagent-delegation.md` 的"59 份/39 stub"漂移成因）。先例：`gate-logic.ts` 的 `PHASE_TEST_LAYERS` |
| D10 | R3 判据修复归属           | 留在 Spec A，独立小节                                                                 | 纯 checker bug、零设计风险，早修早受益，不必等吸收工作                                                                                |
| D11 | 两类已吸收方法论的处置     | **不重复吸收**，仅补语义丢失                                                          | 用户要求引入的两项方法论均已落地（§0.2 有谱）；重做等于推翻既有 spec 与逐字拷贝基准                                                   |
| D12 | 防偏移范围                | 标准偏移 + 校准偏移 + 惰性偏移 **三者全要**                                            | 用户裁定                                                                                                                              |
| D13 | 🟡 Pending 触发方式       | **常态触发**（非返工触发）：阶段门放行前强制扫描未验证锚点，有 🟡 即阻断                | 用户裁定；贴合方法论原意——🟡 是"未证先验"而非"失败后补救"                                                                            |
| D14 | `evidenceAnchor` 必填范围 | **方案 i：阶段 1-4 全部节点必填**                                                      | 用户裁定；"关键节点"的界定本身即判断、会引入新模糊面。存量迁移成本已实测（31 fixture / 124 节点），可机械完成                          |
| D15 | 三色标签处置              | **不新增第三色**；用 `evidenceStatus: confirmed \| pending` 二值字段                   | 🟢/🟡 由该字段承载；🔴 由既有 `coverageStatus.not-covered` + 反模式 #18/#19 返工链承载。避免"新增三色 emoji"被拒的同型错误（§4）      |
| D16 | 校准偏移实现形态          | **非门禁**：人维护的锚定集 + 可运行校准命令 + 校准报告                                | 锚定正解需人标注，且校准需真实跑 LLM（外部 Agent 执行）——不符合确定性门禁定义。**声明为非门禁诊断工具，不得表述为门禁**              |

## 2. 设计

### 2.1 A-1：verifier-spec R14-R17 落回字符串（单侧修正）

**性质**：规范错、schema 对。`verifier-spec.md:464` 的类型定义 `summary: string` 本就是正确一侧，`:278` 是错的一侧。故为单侧修正，非双向调和。

**改动**：`w-model-dev/references/verifier-spec.md:278`，将结构化对象示例改为固定前缀的文本约定：

```
- 实现：R14-R17 为评审附加检查项，四问结论以固定前缀写入 VerifierOutput 的 `summary` 文本
  （`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），**不进入 `subCriteria` 数组**——
  §2.3 与 verifier-logic.ts 强制 subCriteria 数量固定为 5（不允许子集/超集）。
  R14-R17 仅当 `VerifierOutput.targetKind ∈ {design, code}` 且产物含多角色来源时启用；
  不破坏既有 R1-R13。
```

固定前缀的选取理由：机器仍可用正则索引四问是否作答，V 仍被要求逐问回答，而 schema 完全不动。这与仓库既有的 `severity` 前缀约定（`[Critical]`/`[Required]` 作为 `reworkHints` 前缀）同构。

**影响面**：零 schema、零脚本、零样本、零 self-test 变动。`check-verifier-output.ts` 行为不变（`verifier-logic.ts:591` 仍只校验非空字符串）。

### 2.2 A-2：8 处死引用改为指向真实承载章节

**关键区分**：8 处中 `workflow.md:11` 需单独判定。它是 `workflow.md` 的目录项，但该文件**并无** `## 阶段门与质量门` 章节——实际章节已拆分为 `## 阶段门评审（每个阶段统一）`（`:113`）与 `## 质量门（编码及之后阶段强制）`（`:187`）。故 `:11` 是**指向已拆分章节的过期目录项**，须改为两个目录项（分别指向 `:113` 与 `:187` 所属章节）。**因此死引用实际为 7 处，而非 6 处。**

逐处映射（**实施时必须先读上下文确认语义，不得批量替换**）：

| # | 位置                        | 当前引用语义                   | 改为指向                                                                 |
| - | --------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 1 | `hard-constraints.md:188`   | 反模式 #1：阶段门评审流程      | `workflow.md`「阶段门评审（每个阶段统一）」节                            |
| 2 | `hard-constraints.md:208`   | 反模式 #21：`--phase=N` 强制   | `quality-standards.md`（质量门检查清单节）                               |
| 3 | `hard-constraints.md:261`   | 反模式 #21 脚本映射行          | `quality-standards.md`                                                   |
| 4 | `hard-constraints.md:293`   | 反模式 #1 检测信号行（门+CHK） | `workflow.md`「阶段门评审」节                                            |
| 5 | `hard-constraints.md:507`   | self-as-verifier 下 `--phase=N` | `quality-standards.md`                                                   |
| 6 | `quality-standards.md:185`  | 质量门 CHECKPOINT              | 同文件自指 → 改为 `workflow.md`「质量门（编码及之后阶段强制）」节 + 本文件 #3/#6/#7 引用保留 |
| 7 | `workflow.md:121`           | 评审流程                       | 保留 `verifier-spec.md` 链接，删除 SKILL.md 死引用，改指本文件「阶段门评审」节 |
| 8 | `workflow.md:11`            | 目录项（指向已拆分章节）       | 拆为两项：`- 阶段门评审（每个阶段统一）` + `- 质量门（编码及之后阶段强制）` |

**影响面**：零 schema、零计数、零脚本。改后 `checkInternalLinks` 仍通过（这些是散文引用，本就不在其校验面内）；本节为**净改进**而非门禁需求。

### 2.3 A-3a：R3 预防性审查判据接上（checker bug 修复）

**性质**：checker 漏接判据，非契约缺字段。字段齐备且 schema 已正确强制：`preventive-review.schema.json` 的 `allOf` 规定 `passed=false` 时 `findings.minItems: 1`，即"报告声称有问题就必须写出问题"这一约束**本就存在**；缺的是 checker 从不读 `passed`。

**改动**：`w-model-dev/scripts/logic/preventive-review-logic.ts`

1. `review.passed === false` 的维度 push 进 `reasons`（现状：仅抄入 summary，从不 push）。
2. `findingCount` 参与输出而非仅记录。
3. `:46` 注释改为反映新行为（当前注释描述的是修复前的行为）。

**处置**：按 D6，纳入 `reasons` 即产生失败信号 → 走普通 V/G 失败链（`hard-constraints.md`「普通 V/G 失败链」节）。**不做 warning 分级。**

**影响面**：逻辑/ 层改动 → 触发覆盖阈值（`config/vitest.config.ts` 75/65/85/75）；需补 `preventive-review-logic.test.ts` 用例；若新增样本须按 `check-samples-coverage.ts` 三向闭包登记（`self-test.ts` 用例数组 + `samples/README.md` 矩阵行）。

### 2.4 A-3b：冰山扫掠分母对账（本 spec 的真正设计工作）

**核心洞察**：冰山的问题**不是缺证据字段，而是缺分母**。`newFindings` 已是有结构的对象数组（每条要求 `findingId/severity/category/location/description/evidence/hypothesis/relatedFixedPoint`，`additionalProperties: false`）；缺的是"本该扫什么"的表达能力。

**设计原则（D5 + D7 + D8）**：

- **分母不由 R 填写**。分母从**上游已放行产物实测**得出。让 R 自报 `total` 仍属自证。
- **三视角平权**。graph / TLA / RTM 各自独立给出"应扫集合"，无主次、无仲裁优先级。checker **不做"以某方为准"的归一化**，只做两两比对并如实报出差异项。
- **差异严格失败**。任意两视角差异即刻产生失败信号，不提供"已说明"豁免通道。
- **分母从三视角收敛得出**，非预先指定。

**契约改动（最小化）**：仅给既有字段加约束，**不新增字段**：

- `w-model-dev/schemas/iceberg-sweep.schema.json`：`sweepCoverage.sweptArtifacts` 加 `"minItems": 1`。
- 新增字段 `sweepDenominator` **不引入**——分母既然由 checker 从上游产物实测，就没有理由让 R 在报告里再写一遍。

**checker 新增算法**（`w-model-dev/scripts/logic/iceberg-sweep-logic.ts`）：

```
1. 确定在场视角集合（按阶段，读 ICEBERG_VIEW_PRESENCE 常量）
2. 各在场视角独立算出应扫集合 S_graph / S_tla / S_rtm
3. 两两对账：任意 |Si \ Sj| > 0 → 失败信号「视角间存在未对账差异」
   逐条列出差异项；不归一化、不取并集后放行
4. 三视角一致 → 收敛集合 S*
   校验 R 的 sweptArtifacts ⊇ S*（或显式豁免 + 理由）
5. 零发现（newFindings === []）且覆盖不足 → 失败信号
```

**在场表作为代码常量（D9）**，置于 `iceberg-sweep-logic.ts`，风格对齐 `gate-logic.ts` 的 `PHASE_TEST_LAYERS`：

```ts
/** 各阶段冰山扫掠的三视角在场集合（缺席者显式记为不适用，禁止静默跳过）。 */
const ICEBERG_VIEW_PRESENCE: Record<number, readonly IcebergView[]> = {
  1: ['graph', 'rtm'],
  2: ['graph', 'tla', 'rtm'],
  3: ['graph', 'tla', 'rtm'],
  4: ['graph', 'tla', 'rtm'],
  5: ['tla', 'rtm', 'scope'],
  6: ['tla', 'rtm', 'scope'],
  7: ['tla', 'rtm', 'scope'],
  8: ['tla', 'rtm', 'scope'],
};
```

（具体取值须在实施时按各阶段实际产出物核定；上表为设计意图表达，非最终值。）

**缺席不静默**：某视角产物在该阶段不存在时不参与校核，但**必须被显式记为"不适用"并写入报告**。理由：`check-signature-chain.ts` R8 在找不到 `project.json` 时静默跳过，正是同类陷阱，不得重犯。

**处置（D6）**：三类失败信号（视角不一致 / 分母未覆盖 / 零发现但覆盖不足）**全部**走普通 V/G 失败链，无一例外、无分级。R 的 `upstreamDefect` 字段已存在（`rootcause-report.schema.json` 要求 `upstreamDefect.present` 与 `rollbackRecommended`），阶段回退路径已存在（`operational-recovery.md` 场景 5：R 标记 upstreamDefect → V 复核 → 强制 CHECKPOINT → 产物作废重做）。**故"问题很大就回退阶段"不需要任何新机制。**

**已知后果（须在实施时验证并记录）**：严格失败会使早期阶段更易红。若某阶段天然不一致（如阶段 1 的 RTM 尚未补登 TLA 相关行），按 D6 正确处置是走 R 定位；若根因是"该阶段 TLA 本不应在场"，则暴露的是**在场表定义错误**，修正在场表——而非放宽不一致判定。

### 2.5 A-3c：`evidenceAnchor` 必填 + `evidenceStatus` 常态扫描（图谱侧）

**性质**：契约扩展（当前 `evidenceAnchor` 为可选、"未声明不阻断"）。

**必填化的理由**：常态触发（D13）要求阶段门放行前能区分"已验证"与"未验证"。若保持可选，则"不声明"成为最省力的通过路径——与 `newFindings: []`、`sweptArtifacts: []` 是同一个漏洞（**"不填"即通过**）。故必须消除"未声明"状态。

**契约改动**：

```
nodes[].evidenceAnchor: string     ← 由可选改必填（阶段 1-4 全节点，D14）
nodes[].evidenceStatus: "confirmed" | "pending"   ← 新增，必填（D15）
```

- `pending` 语义严格对齐方法论 🟡：**基于逻辑推理、尚未验证**（区别于 `coverageStatus.partial` 的"覆盖不完整"）。
- **不新增第三色**（D15）：🔴 由既有 `coverageStatus.not-covered` + 反模式 #18/#19 返工链承载。
- 节点对象为 `additionalProperties: false`，故 `evidenceStatus` **必须先写入 schema**，任何 fixture 才能携带它。

**checker 改动**（`graph-logic.ts` 的 `checkRequirementGraph` 内 R15 块，经 `check-requirement-graph.ts` CLI 暴露）：

1. `evidenceAnchor` 缺失或为空 → violation（原为"未声明不阻断"）。
2. `evidenceStatus` 缺失或非 `confirmed|pending` → violation。
3. `evidenceAnchor` 的 `path` 部分**真实性校验**（见 A-3e）。
4. 格式正则校验保留（复用 `EVIDENCE_PATTERN` 语义，禁止定义第三套）。

**常态触发挂载点（D13）**：阶段门放行前（`quick-self-check.md` 的 DoD 自检清单，已有"阶段门放行已填理解证据""预算与成熟度已检查"两个同类检查项）新增一条：**扫描 `graph.json` 中 `evidenceStatus === 'pending'` 的节点，存在即阻断**，要求先验证转 `confirmed`，或走豁免审批（`exemption.json` / `check-exemption.ts` E1-E9 既有机制）。

**为什么不走 R**：🟡 不是缺陷，是"尚未验证"。走 R 会把"没做功课"误判为"产物有缺陷"。正确处置是**阻断并要求补验证**；若补验证后发现结论站不住，那才触发返工链。

### 2.6 A-3d：V 侧证据交叉对账（防标准偏移）

**性质**：新增对账判据，数据基础已具备（run-log 已记 `qualityLevel` + `artifacts`）。

**判据一 · 跨轮次一致性（标准偏移）**——`check-run-log.ts` 新增 R 规则：

- 同一 `artifacts` 路径的多次 `action=review` 记录中，`qualityLevel` **差异 ≥ 2 档**（如 A → C）或综合分差 > 0.15 → 失败信号。
- 1 档差异可能合理（产物确实改进了）；2 档意味着评审标准发生实质漂移。
- 仅一次评审记录时不触发（无不一致可言）。
- **处置（重要且与 D6 不同）**：**走高成熟度 CHECKPOINT 交人裁定，不走 R**。理由——不一致的是**评审者自身**，而 R 无法自查评审标准；按 `design-philosophy.md` 人机分工线，"判据 / 处境判断 → 人"。这与 A-3b 三视角不一致（产物间的客观差异，可由 R 定位）性质不同，**不得混同**。

**判据二 · 惰性偏移加强（复用既有 R11/R12/O3，不新建机制）**：

- O3 措辞黑名单扩充：补入模板化模式（相邻两次评审的 `summary` 相似度过高 → 疑似复制）。
- `VerifierOutput.evidence` 的 path 部分真实性校验（原只校验格式）→ 与 A-3e 同源实现。
- `targetKind=code` 的评审连续 N 轮 `reworkHints` 无 `[Critical]` → 记入 run-log note 作为 O3 候选信号，**仅告警不阻断**（确实可能一直无严重问题）。

### 2.7 A-3e：证据路径真实性校验（从形状到事实）

**性质**：把"格式合规"升级为"被引内容真实存在"。这是 §0.2 两处缺口的共同修复。

**实现**：`evidenceAnchor`（图谱侧）与 `VerifierOutput.evidence`（评审侧）的 `path` 部分，从"匹配正则"升级为"匹配正则 **∧** path 存在"：

- 复用既有 path 解析约定（`conventions.md` 列定位约定），**禁止定义第三套解析**。
- 不打开文件验证陈述被支持（那需要语义判断，属 V 评审职责）；**只验证存在性**——这是确定性可判的部分。
- 这是"递归证据请求"的最小可机检子集：方法论要求"沿依赖链向上追溯直到所有链路有证据状态"，完全实现需语义判断；**当前只实现"引用的东西真的在那里"**。**此边界须在文档中写明，不得声称已实现完整递归追溯。**

### 2.8 A-3f：校准集规范（防校准偏移，非门禁）

**性质**：诊断工具，**明确非门禁**（D16）。

**落地**：

- 新增 `w-model-dev/scripts/samples/verifier-calibration/`，存放带**人工标注正解**的锚定产物：每个样本声明 `expectedQualityLevel`（必须 A / 必须 D）与理由。
- 定义校准命令（`/wm calibrate` 或 command-reference 中的可选脚本）：对锚定样本跑评审，比对 V 判定与人工正解，输出**校准报告**（命中率 + 混淆矩阵）。
- **边界声明（必须写入文档）**：校准**不是**门禁，不阻断阶段推进。理由：锚定正解由人标注，且校准需真实跑 LLM（外部 Agent 执行）——两者都不符合"确定性门禁"定义。**把它说成门禁即为过度声明。**
- 由此产生的新可漂移物：锚定样本的正解标注本身需维护。**登记为已知风险**（§5）。

## 3. 变更清单

| # | 文件                                                    | 类型     | 内容                                                                 |
| - | ------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| 1 | `w-model-dev/references/verifier-spec.md`               | 修改     | `:278` 四问落回 `summary` 固定前缀文本                                |
| 2 | `w-model-dev/references/hard-constraints.md`            | 修改     | 5 处死引用改指（`:188/:208/:261/:293/:507`）                          |
| 3 | `w-model-dev/references/quality-standards.md`           | 修改     | `:185` 死引用改指                                                    |
| 4 | `w-model-dev/references/workflow.md`                    | 修改     | `:121` 删除 SKILL.md 死引用；`:11` 目录项拆为两项                      |
| 5 | `w-model-dev/scripts/logic/preventive-review-logic.ts`  | 修改     | `passed`/`findingCount` 纳入 `reasons`；`:46` 注释更新                |
| 6 | `w-model-dev/scripts/logic/iceberg-sweep-logic.ts`      | 修改     | `ICEBERG_VIEW_PRESENCE` 常量 + 三视角对账算法 + 三类失败信号          |
| 7 | `w-model-dev/schemas/iceberg-sweep.schema.json`         | 修改     | `sweptArtifacts` 加 `minItems: 1`                                     |
| 8 | `w-model-dev/scripts/__tests__/preventive-review-logic.test.ts` | 修改 | 补 `passed=false` 产出 violation 的用例                              |
| 9 | `w-model-dev/scripts/__tests__/iceberg-logic.test.ts`   | 修改     | 补三视角一致/不一致/缺席/零发现覆盖不足用例                           |
| 10 | `w-model-dev/scripts/samples/iceberg/`                  | 修改/新增 | 视角不一致、缺席、零发现覆盖不足各 ≥1 反例（现有 4 个 fixture 保留）   |
| 11 | `w-model-dev/scripts/samples/README.md`                 | 修改     | 新增样本的矩阵行                                                     |
| 12 | `w-model-dev/scripts/cli/self-test.ts`                  | 修改     | 新样本登记进 `<AREA>_CASES`                                          |
| 13 | `w-model-dev/references/iceberg-sweep-guide.md`         | 修改     | 同步对账算法与三类失败信号（文档侧说明，权威为实现）                  |
| 14 | `docs/skill-design-document_SSoT.md`                    | 修改     | 新增权威定义节（SSoT-first）；R14-R17 承载方式更正                    |
| 15 | `w-model-dev/schemas/graph.schema.json`                 | 修改     | `nodes[].evidenceAnchor` 改必填；新增 `nodes[].evidenceStatus`（枚举 confirmed\|pending） |
| 16 | `w-model-dev/scripts/logic/graph-logic.ts`              | 修改     | R15 扩展：必填校验 + `evidenceStatus` 校验 + path 真实性校验          |
| 17 | `w-model-dev/scripts/logic/run-log-logic.ts`            | 修改     | 新增跨轮次一致性规则（同产物 `qualityLevel` 差异 ≥2 档 / 分差 >0.15）  |
| 18 | `w-model-dev/scripts/__tests__/graph-logic.test.ts`     | 修改     | 补 evidenceAnchor 缺失/evidenceStatus 非法/path 不存在用例            |
| 19 | `w-model-dev/scripts/__tests__/run-log-logic.test.ts`   | 修改     | 补跨轮次一致性触发/不触发/首次豁免用例                                |
| 20 | `w-model-dev/scripts/samples/graph/`                    | 修改     | **31 个 fixture / 124 个节点**补 `evidenceAnchor` + `evidenceStatus`（实测规模，机械迁移） |
| 21 | `w-model-dev/scripts/samples/run-log/`                  | 修改/新增 | 跨轮次不一致反例                                                     |
| 22 | `w-model-dev/scripts/samples/verifier-calibration/`      | 新增     | 锚定集（人工标注正解）+ 目录 README（声明非门禁）                      |
| 23 | `w-model-dev/references/quick-self-check.md`            | 修改     | DoD 自检清单新增"未验证锚点扫描"项（常态触发挂载点）                   |
| 24 | `w-model-dev/references/evidence-anchored-tree.md`      | 修改     | §3 更新：必填化 + `evidenceStatus` + 三处语义丢失的补齐说明            |
| 25 | `w-model-dev/references/verifier-spec.md`               | 修改     | 新增 §12"评审偏移检测"（标准/校准/惰性三类 + 边界声明）                |
| 26 | `docs/llm-verifier-integration-design.md`               | 修改     | 指针文档补记本次补齐（三支柱已实现 + 三类偏移检测新增）                |
| 27 | `CHANGELOG.md`                                          | 修改     | 新增 `### <campaign>（<slug>，2026-09-12）` 小节                      |

### 3.1 不改动的文件（明确边界）

| 类别                | 不改动理由                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `verifier-output.schema.json` | A-1 采方案 A，落回字符串，零 schema 变动                          |
| `verifier-logic.ts`           | `summary` 校验逻辑（`:591` 非空字符串）本就正确；`evidence` 真实性校验在 A-3e 中评估是否入此文件 |
| `run-log.schema.json`         | 无新 action；`qualityLevel`/`artifacts` 字段已存在，跨轮次规则无需新字段 |
| `hard-constraints.md` 反模式编号 | 不新增反模式（#44 措辞可能需微调，见风险节；编号上限 48 不变） |
| `check-docs-consistency.ts`   | 无新计数、无新脚本；`samples/verifier-calibration/` 为新增样本目录需在 `samples/README.md` 声明矩阵行（由 `check-samples-coverage.ts` 强制） |
| `subagent-delegation.md`      | 无新脚本；dispatch-matrix 不变                                |
| `templates/`                  | 无新模板（校准集是样本非模板）                                |
| `eval/`                       | 无触发面变更，语料库与 coverageMatrix 不动                    |
| `docs/changes/archive/**`     | 历史不可改                                                    |
| `samples/verifier/` 既有 25 fixture | 不动——它们是 schema 合法性用例，与校准集职责不同            |

## 4. 验证策略

| 阶段 | 命令                                                                 | 退出码要求 | 失败处理                       |
| ---- | -------------------------------------------------------------------- | ---------- | ------------------------------ |
| 静态 | `npx tsc -p config/tsconfig.json`                                    | 0          | 修正类型                       |
| 格式 | `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts"` | 0 | `--write` |
| 单测 | `npx vitest run --config config/vitest.config.ts`                    | 0          | 修正逻辑或用例                 |
| 覆盖 | `npm run coverage`                                                   | 0（75/65/85/75） | 补用例                   |
| 基线 | `npm run self-test`                                                  | 0          | 修正样本或期望                 |
| 样本 | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`          | 0          | 补登记                         |
| 文档 | `npm run check:docs-consistency`                                     | 0          | 同步计数/引用                  |
| 评估 | `npm run eval`                                                       | 0          | 触发面未变，应恒绿             |
| 全量 | `npm run prepush`                                                    | 0          | 18 项门禁全绿                  |

**破坏性验证（必做，参照 trigger-boundary campaign 先例）**：

1. 三视角不一致的冰山报告 → `check-iceberg-sweep.ts` → 断言 exit 1 且 reasons 含差异项 → 还原。
2. `newFindings: []` + `sweptArtifacts: []` → 断言 schema `minItems` 拦截 → 还原。
3. `passed=false` 的 R3 报告 → `check-preventive-review.ts` → 断言 exit 1 → 还原。
4. 节点缺 `evidenceAnchor` → `check-requirement-graph.ts` → 断言 exit 1 → 还原（**关键：验证"未声明不再放行"**）。注：R15 实体在 `graph-logic.ts` 的 `checkRequirementGraph`，CLI 为薄包装；实施时改逻辑层、经 CLI 验证。
5. 节点 `evidenceStatus: "pending"` → 阶段门扫描 → 断言阻断 → 还原（**关键：验证常态触发真的阻断**）。
6. `evidenceAnchor` 指向不存在路径 → 断言 exit 1 → 还原（**关键：验证路径真实性**）。
7. 同一产物两次 `review` 记录 `qualityLevel` A→C → `check-run-log.ts` → 断言 exit 1 → 还原。

**迁移验证**：124 个节点补字段后 `npm run self-test` 与 `check-requirement-graph.ts` 必须全绿；若有 fixture 语义本就不含锚点（如反例 fixture），须显式确认它期望的是**新增的锚点 violation** 而非原 violation（避免测试意图被迁移掩盖）。

## 5. 风险与回退

| 风险                                                    | 缓解                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **严格失败导致阶段 1-2 频繁红**                          | 按 D6 走 R 定位；若根因是在场表定义错误则修在场表（D9），**不放宽不一致判定**              |
| 三视角对账的实现口径与既有 graph/TLA/RTM 结构不匹配      | 实施时先读 `graph-logic.ts` / `tla-logic.ts` / `rtm-guide.md` 确认可解析的集合表达；口径不确定则在 spec 评审阶段上报 |
| 在场表具体取值设计期无法定稿                             | 上表为设计意图；最终值须实施时按各阶段实际产出物核定，并作为代码常量评审                  |
| `preventive-review-logic.ts` 改动触发覆盖率跌破阈值      | 补针对性用例（变更清单 #8）                                                              |
| 反模式 #44 措辞与新判据不一致                            | 实施时核查；如需微调则同步 `hard-constraints.md`（编号不变，故 `EXPECTED.maxAntiPattern` 不动） |
| 样本新增漏登记导致 `check-samples-coverage` red          | 按三向闭包流程：fixture 文件 + `self-test.ts` 用例 + `samples/README.md` 矩阵行           |
| **124 节点必填迁移改变既有反例 fixture 的测试意图**      | 迁移验证（§4 末）要求逐 fixture 确认期望 violation 未变；反例 fixture 若依赖"缺锚点不阻断"则须重写为期望新 violation |
| **`evidenceStatus` 被填 `confirmed` 而无实据**           | 本 spec **不解决**：`confirmed` 的真实性需语义判断（V 评审职责 + A-3d 惰性检测间接约束）。**此为已知残留缺口，须在文档中写明，不得声称已解决** |
| **A-3e 只验证存在性、不验证陈述被支持**                   | 已在 §2.7 显式声明边界；完整"递归证据请求"需语义判断，列为 Spec B 的候选               |
| **校准集正解标注本身成为新的可漂移物**                   | A-3f 声明为非门禁；标注维护责任登记于此。校准报告可发现漂移但不阻断                       |
| **A-3d 跨轮次阈值（≥2 档 / 0.15）为设计取值**             | 实施时以既有 run-log 历史数据回测（若有），避免阈值过严产生假阳性；阈值为代码常量便于调整 |
| 常态触发增加每阶段门强制成本                             | 与既有 DoD 自检项同批执行（`quick-self-check.md` 已有同类项），不新增独立流程             |

**回退**：本 spec 全部改动可按文件粒度 `git revert`。**注意 `graph.schema.json` 的必填化是破坏性契约变更**（相对原"可选、未声明不阻断"），回退时须同时还原 31 个 fixture；无历史归档改动。

## 6. 与现有约束/反模式的关系

- **强化**：约束 #9（门禁退出码不可伪）、约束 #11（闭环机制）；反模式 #44（跳过冰山扫掠）——A-3b 使其判据可对账；反模式 #38（修改前未查询 codegraph）——A-3e 与"事实核对"同源。
- **不引入新约束**：14 条硬约束不变。
- **不新增反模式**：编号上限 48 不变，`EXPECTED.maxAntiPattern` 不动。
- **不弱化现有反模式**：仅 A-2 修正引用目标，语义不变。
- **与 `evidence-anchored-tree.md` §4 拒绝表的一致性**：该表曾拒绝"新增三色 emoji 标签体系"（理由：与 `coverageStatus`/`qualityLevel` 语义重叠、schema 漂移风险）。本 spec 的 D15 **遵守该裁决**——只用二值 `evidenceStatus` 承载 🟢/🟡，🔴 复用既有枚举，不新增第三色。
- **与该表"新增 CONTEXT.md/ADR 文档体系 → 拒绝"的一致性**：A-3f 的校准集落在 `samples/`（既有样本体系），**不新建文档目录**。

## 7. 未来扩展（非本轮）

- **Spec B（选择性吸收）**：`diagnosing-bugs` 机制层（10 项循环阶梯、3–5 排名可证伪假设、单变量埋点、`[DEBUG-xxxx]` 标签、无法构建信号时的升级清单）；`tdd` 同义反复禁令（期望值须来自独立真值源）；写作技艺层；`grilling`/`codebase-design` 作为词汇契约改造既有文件。**Spec B 的可红信号词汇应引用本 spec 的 A-3b 分母对账与 A-3e 路径真实性，而非另造一套。**
- 本 spec 提供"分母可对账 + 锚点可扫描 + 路径真实存在"（事实基岩）；Spec B 提供"发现可验证"（可红信号）。二者互补而非重复。
- **A-3e 的完整形态**（"递归证据请求"：沿依赖链向上追溯直到所有链路有证据状态）需语义判断，且需 A-3d 的锚点对账作为基础；建议作为 Spec B 之后或独立课题。
- 独立于本轮的既有缺陷（不在本 spec 范围）：`docs/user-guide.md:75` 反模式计数 47（权威 48）；`subagent-delegation.md:132` references 计数 59/39/19（实际 42，且"19 个 stub"为编造）；`quality-standards.md:46` 与 `:197/:246` 模板计数 13 vs 12；`samples/README.md:3` 262 vs `:45` 322；`__tests__/README.md` 矩阵漏 20 个测试文件；`command-reference.md:417` 引 `SSoT §1338`（不存在）；`bdd.md:1028` 字段数 9 vs 10。**这些属文档漂移，建议独立立案。**

## 8. 开放问题

（无。设计期已逐项收敛；在场表最终取值与 A-3d 阈值回测属实施期核定项，已在风险节登记。）
