# 门禁完整性修复与证据分母设计（verifier-spec 悬空规范 + SKILL.md 死引用 + 冰山分分母对账）

> 状态：已获用户批准的设计（brainstorming 产物）。
> 日期：2026-09-12。
> 背景：四轮外部调研（源库 `D:\w_skill_opt\skills` 与目标库双向交叉核验）发现三项与"选择性吸收外部方法论"无关、但会污染吸收工作的既有缺陷。本设计是三项缺陷的统一落地规格。外部方法论吸收另立 Spec B，显式引用本设计引入的证据形态。
> 执行模式：待用户选择（Subagent-Driven / Inline）。

## 0. 背景与动机

四轮调研中，对目标库自身的独立核验（读 checker 源码 + 真机跑门禁）暴露三项缺陷。三项均**不是**"缺少外部方法论"，而是既有机制的内部不一致或判据漏接：

1. **verifier-spec 悬空规范**：`verifier-spec.md:278` 规定 R14-R17 四问结论记录于 `summary` 的结构化对象 `collaborationReview: { handoff, planAdherence, roleFit, incrementalValue }`，但 `verifier-output.schema.json:48` 声明 `"summary": {"type":"string","minLength":50}`，且父对象 `additionalProperties: false`。真机实验（round 3）证实：`summary` 传对象 → `/summary: must be string`；传顶层额外键 → `must NOT have additional properties`；两者均 exit 1。**没有任何输入能同时满足规范与 schema。** 且全仓 grep `collaborationReview|planAdherence|roleFit|incrementalValue` 在 `.ts`/`.json` **零命中**——R14-R17 仅有散文规范，无任何实现与消费方。

2. **SKILL.md 死引用**：`SKILL.md` 无 `阶段门与质量门` 章节（实际章节为 核心原则 / 触发决策 / 任务规模适配 / 不可违反的约束 / 编排者-子代理边界 / 执行工作流 / 命令速查 / 阶段路由 / 门禁契约与资源清单），但全仓共 **8 处**引用该不存在的章节（`w-model-dev/` 内），**全部为死引用**（含 `workflow.md:11` 的目录项——该文件章节已拆分为「阶段门评审」与「质量门」两节）。命中的是**安全关键路径**：反模式 #1（跳过阶段门评审）与质量门 CHECKPOINT 的指引均指向该节。这些是**散文式章节引用而非 markdown 链接**，因此 `checkInternalLinks`（只校验 `[text](path)` 的链接目标）结构上无法捕获。

3. **"空即合规"**：冰山扫掠与 R3 预防性审查的通过判据在最小努力与最大努力产物之间不可区分。

   - **冰山扫掠**：`iceberg-sweep-logic.ts:99` 的 `expectedPassed = report.newFindings.length === 0`——**通过 ≡ 声明"未发现任何东西"**。且 `sweepCoverage.sweptArtifacts` 在 schema 中为 `{"type":"array","items":{"type":"string"}}`，**无 `minItems`**，空数组合法。更严重的是：该报告**没有任何字段能表达"本该扫多少"**，因此无法区分"扫完了、确实没有"与"根本没扫"。

   **精确说明消费面**：`check-iceberg-sweep.ts` **确实**被 `self-test.ts` 调用（`samples/iceberg/` 4 个 fixture 已登记），并出现在 `samples/README.md` 矩阵；但它**未**被 `check-artifact-gate.ts` 聚合（该脚本不引用 iceberg）。故现状是"形状检查会被跑，但形状本身可被空声明满足"——缺口在于判据而非接线。
   - **R3 预防性审查**：`preventive-review-logic.ts:46` 自述"此处只校验报告存在性和格式"；`:89-90` 把 `review.passed` 与 `findingCount` 抄入 summary **但从不 push 进 `reasons`**。三份 `{"findings":[],"passed":true}` 报告即通过。此为 **checker 漏接判据的 bug**，与冰山的"契约缺字段"不同类。

三项缺陷的共性：**它们都让"看起来合规"与"真的合规"无法区分**，而本仓库的核心价值主张正是确定性门禁。在吸收外部方法论之前修复，可避免新规则建立在不可信的判据之上。

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
| 15 | `CHANGELOG.md`                                          | 修改     | 新增 `### <campaign>（<slug>，2026-09-12）` 小节                      |

### 3.1 不改动的文件（明确边界）

| 类别                | 不改动理由                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `verifier-output.schema.json` | A-1 采方案 A，落回字符串，零 schema 变动                          |
| `verifier-logic.ts`           | `summary` 校验逻辑（`:591` 非空字符串）本就正确               |
| `run-log.schema.json`         | 无新 action；证据分母不进 run-log                             |
| `hard-constraints.md` 反模式编号 | 不新增反模式（#44 措辞可能需微调，见风险节；编号上限 48 不变） |
| `check-docs-consistency.ts`   | 无新计数、无新脚本、无新 reference 文件                       |
| `subagent-delegation.md`      | 无新脚本；dispatch-matrix 不变                                |
| `templates/`                  | 无新模板                                                      |
| `eval/`                       | 无触发面变更，语料库与 coverageMatrix 不动                    |
| `docs/changes/archive/**`     | 历史不可改                                                    |

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

1. 构造三视角不一致的冰山报告 → 跑 `check-iceberg-sweep.ts` → 断言 exit 1 且 reasons 含差异项 → 还原。
2. 构造 `newFindings: []` + `sweptArtifacts: []` 的报告 → 断言 schema `minItems` 拦截（exit 2 或 1，按实现）→ 还原。
3. 构造 `passed=false` 的 R3 报告 → 跑 `check-preventive-review.ts` → 断言 exit 1 → 还原。

## 5. 风险与回退

| 风险                                                    | 缓解                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **严格失败导致阶段 1-2 频繁红**                          | 按 D6 走 R 定位；若根因是在场表定义错误则修在场表（D9），**不放宽不一致判定**              |
| 三视角对账的实现口径与既有 graph/TLA/RTM 结构不匹配      | 实施时先读 `graph-logic.ts` / `tla-logic.ts` / `rtm-guide.md` 确认可解析的集合表达；口径不确定则在 spec 评审阶段上报 |
| 在场表具体取值设计期无法定稿                             | 上表为设计意图；最终值须实施时按各阶段实际产出物核定，并作为代码常量评审                  |
| `preventive-review-logic.ts` 改动触发覆盖率跌破阈值      | 补针对性用例（变更清单 #8）                                                              |
| 反模式 #44 措辞与新判据不一致                            | 实施时核查；如需微调则同步 `hard-constraints.md`（编号不变，故 `EXPECTED.maxAntiPattern` 不动） |
| 样本新增漏登记导致 `check-samples-coverage` red          | 按三向闭包流程：fixture 文件 + `self-test.ts` 用例 + `samples/README.md` 矩阵行           |

**回退**：本 spec 全部改动可按文件粒度 `git revert`。无 schema 破坏性变更（仅加约束），无历史归档改动。

## 6. 与现有约束/反模式的关系

- **强化**：约束 #9（门禁退出码不可伪）、约束 #11（闭环机制）；反模式 #44（跳过冰山扫掠）——A-3b 使其判据可对账。
- **不引入新约束**：14 条硬约束不变。
- **不新增反模式**：编号上限 48 不变，`EXPECTED.maxAntiPattern` 不动。
- **不弱化现有反模式**：仅 A-2 修正引用目标，语义不变。

## 7. 未来扩展（非本轮）

- **Spec B（选择性吸收）**：`diagnosing-bugs` 机制层（10 项循环阶梯、3–5 排名可证伪假设、单变量埋点、`[DEBUG-xxxx]` 标签、无法构建信号时的升级清单）；`tdd` 同义反复禁令（期望值须来自独立真值源）；写作技艺层；`grilling`/`codebase-design` 作为词汇契约改造既有文件。**Spec B 的可红信号词汇应引用本 spec 的 A-3b 分母对账，而非另造一套。**
- 本 spec 的 A-3b 提供"分母可对账"，Spec B 提供"发现可验证"（可红信号），二者互补而非重复。
- 独立于本轮的既有缺陷（不在本 spec 范围）：`docs/user-guide.md:75` 反模式计数 47（权威 48）；`subagent-delegation.md:132` references 计数 59/39/19（实际 42，且"19 个 stub"为编造）；`quality-standards.md:46` 与 `:197/:246` 模板计数 13 vs 12；`samples/README.md:3` 262 vs `:45` 322；`__tests__/README.md` 矩阵漏 20 个测试文件；`command-reference.md:417` 引 `SSoT §1338`（不存在）；`bdd.md:1028` 字段数 9 vs 10。**这些属文档漂移，建议独立立案。**

## 8. 开放问题

（无。设计期已逐项收敛；在场表最终取值属实施期核定项，已在风险节登记。）
