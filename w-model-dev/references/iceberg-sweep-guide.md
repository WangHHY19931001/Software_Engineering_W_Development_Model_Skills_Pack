# 冰山扫掠方法论（Iceberg Sweep Guide）

> 本指南供 R-iceberg 子代理使用：以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 IcebergSweepReport。
> Schema：`schemas/iceberg-sweep.schema.json`；校验脚本：`scripts/cli/check-iceberg-sweep.ts`；反模式：#44。
> **权威为实现**（`scripts/logic/iceberg-sweep-logic.ts`）：本文件与实现冲突时以实现为准；阈值与在场表均为代码常量，不在本文件复制数值。

## 1. 冰山理论在 W 模型的映射

冰山理论指出：水面之上可见的部分仅占冰山的 1/8，水面之下不可见的部分占 7/8。映射到 W 模型：

| 冰山理论概念 | W 模型映射 |
|---|---|
| 水面之上（1/8，已发现的问题） | V/G 标准评审命中的 reworkHint，或 S-fix 刚修复的缺陷 |
| 水面之下（7/8，未发现的隐藏问题） | 同根因扩散到其他产物 / 同缺陷类出现在其他位置 / 修复引入的回归 / 相邻逻辑的同类隐患 |
| 深度分析→修复→再分析循环 | R-iceberg 扫掠 → V 复审 → 标准 R 报告复审 / 根因门禁 / S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT → 再次 R-iceberg 扫掠 |
| 直到不能发现问题 | 一轮扫掠 `newFindings=[]` **且**三视角对账通过（分母已覆盖、视角无差异、无静默缺席）即终止——「零发现」单独不构成终止条件，见 §3 |

**核心洞察**：V/G 通过仅证明"既定标准下无问题"，不证明"同类深挖下无问题"。冰山机制填补的是"通过后仍可能有未发现缺陷"的盲区。

## 2. 触发时机

### 2.1 ICEBERG-A：S-fix 后深挖

防修复引入新缺陷 + 同根因扩散。S-fix 修复通过 V/G 后触发。

### 2.2 ICEBERG-B：阶段门放行前全局扫掠

标准 V/G 通过（非返工首次通过，或返工循环结束后最终通过）后、阶段门放行前触发，是放行的最后把关。

### 2.3 触发边界

- ICEBERG-A 仅在 S-fix（返工修复）后触发，标准 S 首次产出不触发（无"已修复问题"可作线索）
- ICEBERG-B 仅在阶段门放行前触发一次
- 紧急修复（S-emergency-fix）同样触发 ICEBERG-A
- 首次通过无返工时，ICEBERG-B 线索为空数组，R-iceberg 退化为"全产物三维度×六类别终检式扫掠"（以产物本身为扫描对象，非以修复点为线索）

### 2.4 计数规则

每次 R-iceberg 扫掠（无论 A/B）递增 icebergRound；修复不单独占轮次。上限为代码常量 `MAX_ICEBERG_ROUNDS`（见 `scripts/logic/iceberg-sweep-logic.ts`），达上限后 CHECKPOINT 升级由用户裁定。

## 3. 六类别深挖方法

| 类别 | 深挖方向 | 示例 |
|---|---|---|
| same-root-cause-spread | 同根因是否扩散到其他产物 | 阶段2 SD 缺状态定义→阶段3 DD 是否也缺、阶段4 INTF 是否也缺 |
| same-defect-class | 同类缺陷是否出现在其他位置 | 文件A缺null检查→同模块其他文件是否也缺 |
| fix-induced-regression | 修复是否引入新缺陷 | S-fix 改了状态转移→是否破坏不变式 / 是否影响 BDD 等价 |
| adjacent-logic | 相邻逻辑是否有同类隐患 | 修复了create路径→update/delete路径是否也有 |
| coverage-gap | 覆盖是否有缺口 | RTM 标记100%但某 REQ 的异常路径未覆盖 |
| cross-artifact-inconsistency | 跨产物是否不一致 | TLA+ states 与 BDD Background states 不一致 |

### 三维度（与 R3 对齐，但目的不同）

- **completeness**：全产物完整性（遗漏字段/未覆盖场景/未定义状态）
- **reliability**：可靠性（TLA+/BDD 等价性是否真等价 / 状态机是否真一致 / 接口契约是否真对齐）
- **security**：安全基线（输入校验/鉴权/越权/敏感信息是否在相邻逻辑也缺失）

## 4. TLA+ 状态机一致性检查的应用示例

> 场景假设：阶段 3 概要设计，V/G 发现 L2_BlogSystem.tla 的 `PublishArticle` 转移缺少 `archived` 状态的守卫条件，S-fix 已修复。R-iceberg 以此修复点为线索深挖。

### 类别 1：same-root-cause-spread（同根因扩散）

根因：`PublishArticle` 转移缺 `archived` 守卫 → 根因是"状态守卫条件不完整"。

```
线索：L2_BlogSystem.tla PublishArticle 修复了 archived 守卫缺失
深挖：
  ├─ 同 spec 其他转移：DeleteArticle / ArchiveArticle / RestoreArticle 是否也缺 archived 守卫？
  │   → 发现：RestoreArticle 转移未校验 source 状态 ∈ {archived}，可从任意状态 restore
  ├─ 同层级其他 spec：L2_CommentSystem.tla 的 AddComment 转移是否校验 article 状态 ∈ {published}？
  │   → 发现：AddComment 未校验 article 状态，archived 文章仍可评论
  └─ 跨层级：L3_ArticleLifecycle.tla（L2 的细化）是否继承了 L2 的守卫缺失？
      → 发现：L3 的 PublishArticle.next 未同步修复
```

盲区：`check-tla-model.ts` 校验转移集语法 + TLC 模型检查，但不校验"守卫条件语义完整性"（需业务逻辑判断）。

### 类别 2：same-defect-class（同缺陷类）

缺陷类：转移的 source 状态集未枚举完整。

```
线索：PublishArticle 转移 source 状态集不完整
深挖：
  ├─ L2_BlogSystem.tla 所有转移的 source 状态集枚举：
  │   PublishArticle: 修复后 = {draft} ✓
  │   ArchiveArticle: source = {published} —— archived 状态可达，是否漏了守卫？
  │   DeleteArticle: source = {draft, published} —— archived 状态下不能删除？业务语义待核验
  ├─ L2_UserSystem.tla：BanUser 转移 source = {active} —— {banned} 状态下是否应禁止再次 Ban？
  └─ L2_CommentSystem.tla：DeleteComment 转移 source = {visible} —— {hidden} 状态下能否删除？
```

盲区：`check-tla-bdd-sync.ts` 校验 TLA+ 与 BDD 转移集等价，但若 BDD 也漏了同一转移，等价性校验仍通过（共因失效）。

### 类别 3：fix-induced-regression（修复引入回归）

修复点：S-fix 给 `PublishArticle` 加了 `state = draft /\ ¬archived` 守卫。

```
线索：PublishArticle 新增 archived 守卫
深挖：
  ├─ 不变式回归：TypeInvariant 仍成立？但业务不变式 `published(a) ⇒ ∃ t. created(a) < t < published(a)`
  │   是否仍满足？→ 发现：时序约束未在不变式中体现（修复暴露不变式不完整）
  ├─ 状态可达性回归：archived 是否变成死状态？RestoreArticle 若也修了守卫需复核
  ├─ BDD 等价性回归：L2_blog_system-002.feature Background states 是否同步更新？
  │   → 发现：transitions 表未加 archived 守卫（修复引入 TLA+/BDD 不一致）
  └─ 代码一致性回归：src/services/article-service.ts publish 方法是否同步加校验？
      → 发现：代码未同步修复（check-code-tla-consistency 阶段5才跑，阶段3须靠冰山发现）
```

### 类别 4：adjacent-logic（相邻逻辑）

修复点：`PublishArticle` 转移（draft→published）。

```
线索：PublishArticle 涉及状态 draft→published
深挖相邻转移（共享 draft 或 published 状态的转移）：
  ├─ 共享 draft 状态：EditArticle（draft→draft）、SubmitArticle —— EditArticle 是否校验 ¬archived？
  │   → 发现：EditArticle 未校验，archived 文章可编辑
  ├─ 共享 published 状态：ArchiveArticle（published→archived）、UnpublishArticle（published→draft）
  │   → 发现：UnpublishArticle 反向转移未校验 ¬archived
  └─ 共享 article 变量的跨 spec 转移：L2_CommentSystem.AddComment 依赖 article.published
      → 前置条件是否需更新为 `article.state = published /\ ¬archived`？
```

### 类别 5：coverage-gap（覆盖缺口）

```
线索：PublishArticle 修复后涉及 archived 状态
深挖：
  ├─ @designIds 覆盖：graph.json type=SD 节点全集 vs L2_BlogSystem.tla @designIds
  │   → 发现：SD-007（文章归档子系统）未在 @designIds 中
  ├─ 状态覆盖：SD-007 描述的 "soft-deleted" 状态是否在 TLA+ 建模？
  └─ 转移覆盖：SD-005 描述的 "批量归档" 转移是否在 Next 中建模？
```

盲区：`check-tla-model.ts --graph` 只看 ID 是否声明，不校验 SD 描述的状态/转移是否真建模（语义覆盖缺口）。

### 类别 6：cross-artifact-inconsistency（跨产物不一致）

```
线索：PublishArticle 转移修复（新增 archived 守卫）
深挖跨产物：
  ├─ TLA+ ↔ 设计文档：设计文档状态机图是否含 archived？→ 发现：只有 {draft, published}
  ├─ TLA+ ↔ BDD：BDD acceptingStates 是否含 archived？→ 发现：acceptingStates={published} 未含终态 archived
  ├─ TLA+ ↔ RTM：archived 状态相关用例是否关联该 spec？→ 发现：UAT-015 未关联
  └─ TLA+ ↔ graph.json：graph.json 是否有 archived 相关边？→ 发现：缺 SD-003 → archived 边
```

## 5. 扫掠流程

```
1. 加载线索（reworkHints 历史 + fixedPoints + previousFindings）
2. 提取每个 fixedPoint 的根因类别（从关联的 RootCauseReport）
3. 对全阶段产物按三维度×六类别扫掠
4. 去重（与 previousFindings 比对）
5. 产出 IcebergSweepReport（sweptArtifacts 须非空且覆盖三视角收敛集合，见 §8）
```

## 6. 产出契约与禁止事项

**产出**：
1. IcebergSweepReport JSON：`.w-model/iceberg/<reportId>.json`
2. 人类可读报告：`.w-model/iceberg/<reportId>.md`
3. 必须满足 IcebergSweepReport Schema
4. newFindings 每项须含可证伪 hypothesis + 具体 evidence
5. 返回编排者：`{role:"R", variant:"iceberg", reportId, reportPath, newFindingsCount, passed, summary}`

**禁止**：
- 改任何产物文件（由 S-fix 修复）
- 跑门禁脚本（由 G 负责）
- 改 RTM 实体 / project.status
- 跨阶段定位（仅当前阶段产物）
- 跳过 V 复审直接触发 S-fix
- 产出空泛发现（须可证伪 + 具体证据）

## 7. 与 R3 / V / R 的区别

| 机制 | 触发时机 | 目的 | 语义 |
|---|---|---|---|
| R3 | S 产出后、V 评审前 | 按清单预防性检查 | 维度检查清单 |
| V | R3 后 | 按既定标准评审 | targetKind 对应评审标准 |
| R | V/G 不通过后 | 定位已暴露问题的根因 | 单一问题根因链 |
| R-iceberg | S-fix 后 + V/G 通过后 | 主动深挖隐藏问题 | 多视角全产物扫掠 |

## 8. 三视角平权对账（分母校验）

> **为什么需要**：在本次修复前，`newFindings=[]` 就能通过——「最省事的报告」与「最彻底的报告」不可区分，
> 且 `sweptArtifacts` 允许空数组，零发现因此无法对账。分母（该扫多少）若由 R 自己声明，仍属自证，
> 只是从"自报发现了什么"变成"自报该发现多少"。故分母改由 checker 从**上游已放行产物实测**。

### 8.1 分母的来源：上游产物，不是报告字段

`iceberg-sweep-logic.ts` 不做 I/O；CLI（`check-iceberg-sweep.ts`）读盘后经 `externalEvidence.viewSets`
注入每个视角的「应扫集合」（与 `graph-logic.ts` 的 `GraphCheckExternalEvidence` 同一约定）。派生口径
（`deriveViewSets`）取三份产物共有的**最窄设计 ID 命名空间** `SD-NNN / DD-NNN / INTF-NNN`：

| 视角 | 集合来源 |
|---|---|
| graph | `graph.json` 各节点 `id` 中的设计 ID |
| tla | `tla-manifest.json` 的 `sdCoverage.coveredSdNodes` |
| rtm | `rtm.json` 各行 `designDoc` 解析出的设计 ID |
| scope | 阶段 5-8 用 `change-scope.json` 的 `changedFiles`（变更范围视角，非 ID 命名空间） |

刻意**不含** REQ/NFR/CON：需求命名空间只有 graph 与 rtm 视角有，混入会制造结构性差异（假阳性）。

### 8.2 在场表是代码常量

各阶段参与哪些视角由 `ICEBERG_VIEW_PRESENCE`（代码常量，非本文档）裁定——写进文档会与实现漂移
（先例：`subagent-delegation.md` 的计数漂移）。**本文件不复制该表数值**；需要时读实现。

### 8.3 三视角**平权**：无主分母、不取并集

graph / TLA / RTM 三视角等权，两两比对，任一方向存在差异即刻失败。**不设主视角、不做仲裁、
不取并集后放行**——取并集会把真实缺口洗成"已覆盖"，取交集会把噪声洗成"一致"。
差异项会逐条列在 `reasons` 里（如 `graph↔tla 差异项：SD-002`）供 R 定位。

### 8.4 三类失败信号

| 信号 | 判据 | 含义 |
|---|---|---|
| R6 视角间存在未对账差异 | 两个在场视角的集合不相等 | 三份产物对"应扫集合"口径不一致 → 走普通 V/G 失败链由 R 定位 |
| R7 视角缺席未显式声明 | 按在场表应在场、但注入面缺该键，且未记入 `sweepCoverage.absentViews` | **禁止静默跳过**。产物在盘但不派生、或产物缺失，都须显式声明缺席 |
| R8 零发现但覆盖不足 | `newFindings=[]` 且（收敛集合为空 或 `sweptArtifacts` 未覆盖收敛集合） | 「零发现」无法证明扫掠真的发生 |

**缺席不静默的理由**：`check-signature-chain.ts` R8 在找不到 `project.json` 时静默跳过，正是同一类陷阱——
"检查没跑"和"检查通过"在输出上不可区分。产物不存在时**不合成空集合**：空集合会被当作"真的一致"从而放行。

### 8.5 未注入注入面时的行为

未注入 `viewSets`（纯逻辑层调用）时 R6/R7/R8 整块跳过，不误红——阶段早期上游产物尚未生成，
此时报红是假阳性（规格 §5）。这是**跳过**而非**通过**：CLI 生产路径总会尝试读盘注入。

### 8.6 报告字段要求

- `sweepCoverage.sweptArtifacts`：**`minItems: 1`**，空数组使零发现不可对账，schema 直接拒绝。
- `sweepCoverage.absentViews`：可选；本阶段确认不参与的视角须显式列入，否则 R7 触发。
