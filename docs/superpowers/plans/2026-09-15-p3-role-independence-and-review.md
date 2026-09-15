# P3 角色独立性与评审 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **批准与边界：** P3 = 设计规格 §11 :303 的第三期（依赖 P1，已达成）。九项均为 **A 层流程规则**（§3.2 :89-97、§7 :232 明确 S06/S07/S08/S09/S16 是「ReviewOverlay 降级后的 L0 微增量——真增量在评审独立性与 finding 级处置」）。**本计划只改 Markdown 资产，零 Schema 变更、零新增脚本/文件/依赖**。⚠️ **若实现中发现必须改 Schema 或新增结构化字段（如 finding 级数组、模型档位字段、校准字段），停下并向用户申请单独批准**（裁定 D-2 精神：Schema 变更不得包裹在流程计划内）。

**目标：** 把「评审独立性」与「finding 级处置」从隐含实践变成**写下来的、可被 V/O/R 三方各自执行的规则**：禁止编排者预判 findings；作者 rationale 只是 claim；V 的误报有回流通道且**不得由 O 裁决**；复审只审 fix delta 且逐 finding 给结论（且**不得绕过 R 前置**）；评测不得过度判负；CHECKPOINT 裁决必须记三要素（含若错代价）并穷尽上缴；dispatch 必须显式指定模型且修复轮次到 4-5 轮要升级档位；≥3 次修复失败要有技术判据指向架构错误；Loop 4 的输入要有 retro 七类与 no-op 审计且**标准归评审者**。

**架构：** 全部落在既有 references 资产（`subagent-delegation.md` / `verifier-spec.md` / `root-cause-locator.md` / `command-reference.md` / `estimation-guide.md` / `hill-climbing-guide.md` / `agent-personas.md` / `hard-constraints.md`），实现手段是**散文规则 + 既有「固定前缀写入文本字段」通道**（先例：R14-R17 把四问结论以固定前缀写入 `summary`，`verifier-spec.md:278-281`）——这样零 Schema 改动而仍可被 V/G 校验。

**技术栈：** 纯 Markdown；门禁侧只用既有校验（`check-verifier-output` / `check-docs-consistency` / `audit:l0-links` / `asset-budget` / `self-test`）。

---

## 0. 实测基线（勘察 2026-09-15 @df966a07，含控制者两处勘误）

| 落点 | 现状（file:line） | 与 P3 的关系 |
| --- | --- | --- |
| `references/subagent-delegation.md`（1618 行） | §3.1 触发表 :130-181；§3.2 调用分类 :182-197（P1）；§3.3 交接书写规则 :198-205（P1）；§4 返工循环 :206-234；§6 门禁清单 :264-334；§7 反模式→脚本映射表 :335-374（最新 #48 :369）；V 分派模板禁止项 :674-677；强制约束 :1356-1361；失败模式 :1545-1568 | **S06/S09/S11 净新增**；须避免与 §3.2/§3.3 三条书写规则语义重叠 |
| `references/verifier-spec.md`（1026 行） | §3.3 单轴下限 R13 :269；R14-R17 :273-281（**固定前缀写 summary 的先例**）；§6 输出 Schema :414-485；§7.4A 五轴 :640-731（Severity 前缀不改变 `reworkHints: string[]` 类型 :694-696）；§13 self-as-verifier :951-969；§14 偏移检测 R9/R18 :970-1022 | **S07/S08/S09/S16 净新增**；S16 的 calibration 与 §14.2 R18（治分布坍缩）**主题邻接但语义不同**（S16 治过度判负） |
| `references/root-cause-locator.md`（180 行） | 全文**无** MAX_ROUNDS/≥3 次判据（仅 :98 引用 maxReworkRounds）；§8 辩解义务 :173-180 | **S14 净新增**；规格 :97 要求**不**在 MAX_ROUNDS 逐项列——与现状一致 |
| `references/command-reference.md`（464 行） | CHECKPOINT 统一清单 :453-464（8 行，**无 Ruling 三要素**）；verifier 校准非门禁声明 :426-431 | **S10 净新增** |
| `references/estimation-guide.md`（50 行，本组最小） | §模型档位 × 思考预算 :44-50（:50「不臆测档位」）；**无修复轮次 escalation、无「必须显式指定模型」** | **S11 净新增** |
| `references/hill-climbing-guide.md`（217 行） | HarnessImprovementReport Schema :58-139；信号 8 类 :157-174；与既有机制关系 :207-217；**全仓 `retro` 零命中** | **M14 净新增** |
| `references/agent-personas.md`（723 行） | Persona 1-4（各含评审规则，如 :136-144）；Persona 矩阵 :555-620；强制多角度 :661 | **S16 的 V persona calibration 净新增**（grep 校准/误报零命中） |
| `references/hard-constraints.md`（969 行） | 反模式表 :184-236（表头 :186；#48 :235）；「按失败类型分流」:237-259（P2-A）；脚本对应表 :312-358（#45 已含 P2-B R10 挂点 :356；#46/#47 明示无脚本） | **S06 的「反模式节」落点**：`maxAntiPattern: 48` 有双向断言（:1335/:1344），**不得新增条目** |

**门禁事实：**
- `check-verifier-output` 逻辑在 `logic/verifier-logic.ts`：R1-R13 + R18（R13 单轴下限 `SINGLE_AXIS_MIN_SCORE = 0.7` :145-148；R18 `RESOLUTION_FLOOR` :151-166）。`schemas/verifier-output.schema.json` 顶层 `additionalProperties:false`（:7），`reworkHints` 为 `string[]`（**无 findings 数组**）→ **新增结构化 finding 字段 = Schema 变更 = 须单独批准**。
- `run-log.schema.json` action 枚举 **27 值不可增**；顶层 40 字段含 `round`/`reworkHints`/`revertEvidence`，**无 `model` 字段** → **若 S11 要在 run-log 留痕模型档位 = Schema 变更 = 须单独批准**。S11 的正解是 dispatch 书写规则（文档层）。
- `check-rootcause-report`（`root-cause-logic.ts` R1-R10）**不读 references 文档** → S14 纯散文改动零脚本影响。
- 联动计数（docs-consistency）：`runLogActionCount 27 / maxAntiPattern 48 / prePushCount 18 / hardConstraintCount 14 / schemaCount 34 / exit2ScriptCount 44 / referencesCount 43 / personaCount 28`——**纯 .md 内容改动全部不变**。
- `L0_BASELINE`（`helpers/l0-baseline.ts:9`）：`672/95/36`；**P3 若新增 markdown 相对链接必须重跑 `npm run audit:l0-links` 并按流程重基线 + 逐处来源注释**（P2-B 教训 ④）。
- `asset-budget`（`asset-budget.test.ts:109-138`）：单文件 ≤2500 行（subagent-delegation 1617）、总行 ≤20000（现 16482）、文件数 ≤48（现 43）、>1000 行须 TOC（subagent-delegation / verifier-spec 已在列）——P3 增行余量充足，但**若把某文件推过 1000 行须补 TOC**。
- **无任何脚本断言 verifier-spec/agent-personas/estimation-guide/hill-climbing-guide/root-cause-locator 的小节存在性或锚点** → 新增小节不需同步任何清单。
- `checkRootCauseR10Contract` 会解析 `verifier-spec`/`root-cause-locator`/`command-reference` 里的 `<r10-contract>` 节点（注释/围栏内 fail-closed）→ **P3 不得新增或复制该字样**。

**勘察勘误（控制者实测，E1/E2）：** ① 勘察称「AGENTS.md §8 未列 review-package.ts」**不成立**——`AGENTS.md:186` 已有该行；② 勘察称「AGENTS.md 仍写 332 条」**不成立**——`AGENTS.md:177` 已是「340 条样本」；陈旧值仅在 `docs/user-guide.md:110`（既登记搁置）。两处均为勘察误报，不影响落点判断。

### 0.1 设计裁定（控制者决定，实现者不得擅改）

1. **零 Schema / 零新字段**：S08（误报质疑通道）与 S09（逐 finding 结论）**用既有通道承载**——固定前缀写入既有文本字段（先例 `verifier-spec.md:278-281`）：finding 级结论写 `reworkHints` 的固定前缀行（如 `ADDRESSED: …` / `NOT ADDRESSED: … — 证据 file:line`），误报质疑写 V 输出的 `summary`/`reworkHints` 固定前缀（如 `FALSE-POSITIVE-CHALLENGE: …`）+ 回流流程（新 V 复审）；**不改 `verifier-output.schema.json`**。S16 的 calibration 阈值写成**散文判据**（照 §14.4「校准集是非门禁」的既有形态），不新增字段。S11 的模型档位写成 **dispatch 书写规则**，不进 run-log。
2. **S06 不新增反模式条目**：在 `subagent-delegation.md` 写「禁止编排者预判 findings」规则（含反例短语清单：`do not flag` / `don't treat X as a defect` / `at most Minor` / `the plan chose`）＋在 `hard-constraints.md` 的**既有**反模式/脚本对应表里挂到语义最近的**既有**条目（候选：编排者越权族与「R 报告须 V 复审」族；实现者须读表后择一并写明理由），**不得新增 #49**（`maxAntiPattern: 48` 双向断言在守）。
3. **S09 保留 R 前置**：scoped re-review 章节必须显式写明「复审者只审 fix delta；**返工链的 R 前置不变**——V/G 不通过仍须先 R 定位根因再 S-fix（反模式 #18/#19）；复审不得成为跳过 R 的旁路」。
4. **S08 禁 O 裁决**：误报质疑的裁决者必须是**新 V**（或 V-lead），编排者只能转达与记录，**不得裁定 finding 成立与否**；文中须给出与既有反模式 #10（编排者越权）的挂接。
5. **S14 不逐项列 MAX_ROUNDS**：三判据（暴露新共享状态且位置不同 / 要求大规模重构 / 别处产生新症状 → 架构错误）写在 `root-cause-locator.md` 的**新增小节**，只以一句话引用既有 `maxReworkRounds` 机制，**不复制/不枚举其清单**。
6. **M14 标注来源性质**：上游 retro 是 **STUB**（`external-repo-capability-survey.md:42`；:99/:198 明示「不可引用为已验收实践」）→ 七类改进源与 no-op 审计落地时必须标注「**思想来源，非已验收实践**」，且不得声称其为外部已验证机制。
7. **文本不撞名**：`docs/loop-engineering-adoption-design.md:551-552` 已用「summary 三要素」指 verifier-spec §6.2；S10 的「Ruling 三要素」在 command-reference 内**必须自带定义**（what / why / **cost if wrong**），不得只写「三要素」二字，避免与 §6.2 撞名。
8. **AC-6 只部分满足**：AC-6 覆盖 M05+M17+S13+S14，其中 M05/M17/S13 属 P5 期 → 收口时只回填「S14 判据」与「角色分离可验证」两侧，**不得**声明 AC-6 整体达成。

---

## 1. 全局约束（每个任务都适用）

1. **零 Schema 变更 / 零新增脚本 / 零新增文件 / 零新增依赖 / 零 LLM 调用**；纯 Markdown 改动。
2. **不升版本号**（五处镜像不动）。
3. **不得放松任何既有判据**；不得删改既有规则语义（只新增小节或行内追加）。
4. **不触碰** `CHANGELOG.md`、`docs/changes/`、`eval/**`、`.githooks/**`、`package.json`、`docs/superpowers/sources/**`（台账只读引用）。
5. **计数不变义务**：`maxAntiPattern 48` / `referencesCount 43` / `personaCount 28` / `schemaCount 34` / `exit2ScriptCount 44` / `runLogActionCount 27` 全不变；若发现某项实现会破计数，**停下报告**（那是范围错误）。
6. **L0 重基线义务**：新增 markdown 相对链接 → 跑 `npm run audit:l0-links`，按 `helpers/l0-baseline.ts` 流程重基线 + 逐处来源注释（P2-B 教训 ④）；能避免新增链接就避免（用 code span/纯文本指针）。
7. **不自造规则**：每条新规则的语义必须可回溯到台账原文（S06 :216-227 / S07 :233-265 / S08 :268-313 / S09 :333-373 / S10 :378-401 / S11 :409-454 / S14 :513-548 / S16 :603-630 / M14 见 mattpocock 台账 :594-613）——实现者须先读台账再落笔，**不得凭印象扩写**。
8. **每任务验证清单（强制）**：(a) `npm run lint:security` exit 0 新增 0；(b) 十守卫组或聚焦批（vitest-project-split / run-sync / gate-report / check-samples-coverage / docs-consistency-logic / skill-metadata / l0-link-audit-logic / l0-link-audit-cli / exit2-failure-atomicity / asset-budget）；(c) `npm run audit:l0-links`（若新增链接）；(d) prettier 权威配置（若触及 .ts——本计划预期零 .ts）。
9. **TDD 不适用于纯文档**；替代的强验证 = 「**每条新规则都能在台账原文里指到出处**」+ 「门禁批全绿」+ 「既有小节零删改」的 diff 证明（逐 hunk 说明）。
10. **诚实性**：证据命令真实跑过并贴真实输出；不得声称用户批准（P3 无 Schema 变更，无需单独批准）；M14 的 STUB 性质必须如实标注。
11. **保持输出流动**（本节教训：本会话已四次因长时间无输出被会话超时终止实现者）——长命令分段跑、周期性写中间状态。

---

## 2. 落点台账（每个 ID 一行，供任务引用）

| ID | 落点文件 | 落点形式 | 计数影响 |
| --- | --- | --- | --- |
| S06 | `subagent-delegation.md`（新增小节）+ `hard-constraints.md`（挂既有反模式/对应表） | 规则 + 反例短语清单 | 0（不新增 #N） |
| S07 | `verifier-spec.md` 新小节 | 不信任报告三原则（rationale 是 claim / 不得降级 severity / test output 的 warning 即 finding / plan 作者不自评） | 0 |
| S08 | `verifier-spec.md` 新小节 + 返工链指针（`subagent-delegation.md` §4 行内指针） | 误报质疑通道 + 禁 O 裁决 + 挂 #10 | 0 |
| S09 | `verifier-spec.md` 新小节 + `subagent-delegation.md` §4 行内指针 | scoped re-review 契约（含 R 前置保留 + Minor 不进 loop） | 0 |
| S16 | `verifier-spec.md` 新小节 + `agent-personas.md` V persona 段 | self-review 4 项 + 独立 spec reviewer + calibration 阈值（散文） | 0 |
| S10 | `command-reference.md` CHECKPOINT 清单节 | Ruling 三要素（自带定义）+ 穷尽上缴 | 0 |
| S11 | `estimation-guide.md` 新节 + `subagent-delegation.md` 分派模板行内 | 档位 × 轮次 escalation + 必须显式指定模型 | 0 |
| S14 | `root-cause-locator.md` 新小节 | 三判据 → 架构错误 | 0 |
| M14 | `hill-climbing-guide.md` Loop 4 输入节 | retro 七类 + no-op 审计 + 标准归评审者（标注 STUB） | 0 |

---

## 3. 任务分解

### 任务 1（S06 + S09）：禁止预判 findings + scoped re-review 契约

- [ ] **步骤 1**：读台账原文（superpowers 台账 S06 :216-227、S09 :333-373）与既有 §3.2/§3.3（避免语义重叠）。
- [ ] **步骤 2**：`subagent-delegation.md` 新增小节（放在 §4 返工循环之前或 §3 之后，位置由你判断并说明）：① 禁止编排者预判 findings（含四个反例短语的**逐字清单**与「命中即停下重写 prompt」的处置）；② **scoped re-review 契约**：只审 fix delta + 逐 finding 给 `ADDRESSED` / `NOT ADDRESSED`（含「**Attempted is not addressed**」）+ 每轮 = 一次 fix 分派 + 一次 scoped re-review、**每任务最多 5 轮** + Minor 不进 loop + 范围外观察不阻塞；③ **R 前置保留**（§0.1.3 原文要求）；④ finding 结论与质疑的**承载通道**（固定前缀写 `reworkHints`/`summary`，不给 Schema 加字段）；⑤ 误报质疑回流**新 V**、**禁 O 裁决**（挂反模式 #10）。
- [ ] **步骤 3**：`subagent-delegation.md` §4 返工循环处加**行内指针**（指向新小节），不改 §4 既有语义。
- [ ] **步骤 4**：`hard-constraints.md`：在既有反模式/脚本对应表里把 S06 的禁止项挂到语义最近的**既有**条目（读表后择一；写明理由），**不新增 #49**；若判断「无处可挂」，改为在既有「编排者越权」族条目的正确做法列做**行内追加**并记录理由。
- [ ] **验证**：约束 8(b) 十守卫组；`npm run audit:l0-links` + 如需重基线；反模式计数实测（`grep -c '^| [0-9]' 反模式表` 与 `EXPECTED.maxAntiPattern` 仍 48）；diff 逐 hunk 说明（既有小节零删改）。
- [ ] **Commit**：`docs(review): forbid pre-judging findings and define scoped re-review (S06+S09)`

### 任务 2（S07 + S08 + S16）：不信任报告、误报通道、spec 评审与 calibration

- [ ] **步骤 1**：读台账 S07 :233-265、S08 :268-313、S16 :603-630。
- [ ] **步骤 2**：`verifier-spec.md` 新增三节（或一节三小节，位置自定并说明）：
  - **S07 不信任报告**：作者 rationale 是 claim；**不得**因报告给出理由而降级 severity；plan 作者不自评自己的 plan（人类/独立评审者裁决）；**实现者报告的测试输出里的 warning/噪声即 finding**（不许当背景噪声忽略）；「a stated rationale never downgrades a finding's severity」的等价中文表述。
  - **S08 误报质疑通道**：V finding 被 S/O 认为误报时的**质疑格式**（技术理由 + 反证，禁情绪化）+ **裁决者 = 新 V**（V-lead/换 Persona）+ **O 只转达与记录、不得裁决** + 与反模式 #10 的挂接 + 质疑未受理时的升级路径（CHECKPOINT）。
  - **S16 spec 自审与评审者校准**：self-review 四项（占位符扫描 / 内部一致性 / 范围检查 / 歧义检查）+ 独立 spec reviewer 五类别（完整性/一致性/清晰度/范围/YAGNI）+ **calibration 阈值**（只报会导致实施期真实问题的问题；措辞/风格偏好/「本节不如其它节详细」不算；除非存在严重缺口否则批准）+ 「治 V 过度判负」的目标陈述 + 与 §14.2 R18（治分布坍缩）的**区别说明**（避免读者混淆两者）。
- [ ] **步骤 3**：`agent-personas.md` 的 V persona 段（code-reviewer 等）各加**同一条 calibration 行**（指向 verifier-spec 新节），保持四 persona 一致。
- [ ] **验证**：约束 8(b)；`audit:l0-links`（如需重基线）；**不得出现 `<r10-contract>` 字样**（`checkRootCauseR10Contract` 会解析）；diff 逐 hunk 说明。
- [ ] **Commit**：`docs(verifier): distrust reports, false-positive channel, spec review calibration (S07+S08+S16)`

### 任务 3（S10 + S11）：Ruling 三要素与模型档位 escalation

- [ ] **步骤 1**：读台账 S10 :378-401、S11 :409-454。
- [ ] **步骤 2**：`command-reference.md` 的 CHECKPOINT 清单节（:453-464）**行内追加**：Ruling 记录格式 `Ruling: <决定了什么> — <为什么> — <若错代价>`（**定义自带，不写「三要素」二字**——避与 §6.2「summary 三要素」撞名）+ 收尾须以「我做的裁决」清单**穷尽**列出（写不进最终消息的裁决 = 秘密决策）+ CHECKPOINT 未决时**穷尽上报用户**而非自行裁决。
- [ ] **步骤 3**：`estimation-guide.md` 新增节「模型档位 × 修复轮次 escalation」：三档档位语义（按台账）+ **评审任务可用便宜档**（小 fix delta 的 scoped re-review）+ **修复轮次 4-5 轮须至少比卡住的实现者高一档** + **dispatch 必须显式指定模型**（省略会静默继承会话模型、从而「静默摧毁本节」——照台账语义）+ 与既有 :50「不臆测档位」的衔接（显式指定 ≠ 臆测；判据仍须记入估算依据）。
- [ ] **步骤 4**：`subagent-delegation.md` 的**分派模板区**加行内指针（V/S-fix/R 模板处各一行：分派须显式写模型，修复轮次 4-5 升级档位）。
- [ ] **验证**：约束 8(b)；`audit:l0-links`；diff 逐 hunk；确认未触碰 `run-log.schema.json`（模型档位不进 run-log）。
- [ ] **Commit**：`docs(dispatch): ruling three-part record and model-tier escalation (S10+S11)`

### 任务 4（S14 + M14）：≥3 次失败判据与 Loop 4 retro 输入

- [ ] **步骤 1**：读台账 S14 :513-548 与 mattpocock 台账 :594-613（**注意 STUB 标注**）。
- [ ] **步骤 2**：`root-cause-locator.md` 新增小节「≥3 次修复失败：架构判据」：三条技术判据逐条落地（每次修复都暴露**新的**共享状态/耦合/别处的问题；修复需要「大规模重构」；每次修复在别处产生新症状）→ 结论「**这不是假设失败，是架构错误**」；处置 = 停下、与用户做架构讨论、限制 `maxReworkRounds` 内不逐项列举（**只以一句话引用既有机制**，不复制其清单）；并写清与 R 既有入口（§2.5 复现测试强制、§8 辩解义务）的分工。
- [ ] **步骤 3**：`hill-climbing-guide.md` 的 Loop 4 输入节新增：**retro 七类改进源**（导航 / 自动化检查 / 编码标准 / 全局 AGENTS.md / 工具经济性 / **no-op** / 信息可达性）——**每类给「输入到哪条信号/字段」的映射**（对照既有 8 类信号 :157-174，无对应者标注「仅作为分析视角，不映射信号」）；**no-op 审计**（识别「看起来做了但行为无变化」的改动）；「**标准归评审者**」（编码标准的施加者是评审者而非实现者，且对 AGENTS.md 的增改**极度克制**）；**在节首标注「思想来源，非已验收实践（上游为 STUB）」**。
- [ ] **验证**：约束 8(b)；`audit:l0-links`；**不新增反模式条目**（M14 的「no-op 审计」不得变成新 #N）；diff 逐 hunk。
- [ ] **Commit**：`docs(loop): architectural criterion for repeated fix failures and retro inputs (S14+M14)`

### 任务 5（收口）：全量门禁 + AC-6 部分回填 + 收尾节

- [ ] `npm run prepush`（`sh -c '… > log 2>&1; echo $?'` 直捕退出码；后台 + 轮询；预期 18/18 + `PREPUSH_EXIT=0`）。
- [ ] 一致性自查：`audit:l0-links` exit 0（三计数与基线一致或已按流程重基线）；`self-test` 340/340；`npm run lint:security` exit 0 新增 0；`grep -c '^| [0-9]' ` 反模式表仍 48；`ls w-model-dev/references/*.md | wc -l` = 43；`ls w-model-dev/schemas/*.schema.json | wc -l` = 34。
- [ ] 规格 §13 **AC-6 行内**追加**部分达成**标注（**不得**声明整体达成——M05/M17/S13 属 P5）：明写「S14 的 ≥3 次失败技术判据已可判定（`root-cause-locator.md` 新节）」与「角色分离可验证」的 P3 侧证据（S06/S08/S09 的禁预判、禁 O 裁决、R 前置保留），并注明**未达成部分**（R 入场四项验收与 3–5 条可证伪假设 = M05、S 的 loop 构造清单 = M17、"无根因"合法出口 = S13，均属 P5）。判据文本一字不动；证据命令真实跑过并贴输出。
- [ ] 计划文件追加「收尾」节（控制者在最终审查后回填）。
- [ ] **Commit**：`docs(spec): record the P3 partial satisfaction of AC-6`

---

## 自检结果

**1. 规格覆盖度**：S06→T1；S07/S08/S16→T2；S09→T1；S10/S11→T3；S14/M14→T4；AC-6 部分回填→T5；§303 的两条硬约束（S08 离 O 裁决、S09 保留 R 前置）→ §0.1.3/§0.1.4 写进任务正文；§232 的「L0 微增量」定位 → 架构段；九项全部有落点与验证。
**2. 占位符扫描**：无「待定/后续补充」。T1 步骤 4 的「读表后择一挂接既有反模式」是**有界选择 + 报告义务**，非占位符。
**3. 命名一致性**：`ADDRESSED/NOT ADDRESSED`、`FALSE-POSITIVE-CHALLENGE`、`Ruling: … — … — …`、`no-op 审计`、`calibration 阈值` 均与台账原文措辞对齐。
**4. 与既有验收的关系**：AC-6 部分回填（§0.1.8）；不新增 AC 编号；不动 Schema；不动 `/wm` 命令输入输出语义（S10/S11 是记录与分派规则，命令面不变）。

---

## 收尾（实现完成后由控制者回填）

### 1. 交付与提交序列

P3 base = `e0021ab0`，共 11 个提交：

`3d02872b`(T1 S06+S09) → `5d89051b`(T2 S07+S08+S16) → `ba247fb6`(T3 S10+S11) → `6673654d`(T3-fix) → `bb5d3092`(T4 S14+M14) → `1701adfa`(T1 回归修复) → `814a6a1d`(T5 AC-6 回填) → `f090017f`(T5-fix 转义/口径) → `6be88e92`(最终修复波 C1+I1+I2+I3) → `279e9d9c`(AC-6 证据行补 15.4 与 Schema 支撑) → 本收尾节

### 2. 审查记录（SDD：任务级 5 轮 + 最终 1 轮 + 修复波 1 + 定向复审 1）

- **任务级**：T1 通过（台账逐要素可回溯；三条硬裁定落实）；T2 通过（三节语义逐句回溯、纯插入经 md5 前缀/尾段证明、S16↔R18 区别非套话）；T3 **需要修复**→修复轮（`:482` 与所引台账语义相反且自造机制名「高额度审批」→ 改为仓库适配说明并挂既有 `onExceed`；V 模板补升级句；estimation-guide 两处加限定）→ 复审 4/4 ADDRESSED；T4 通过（S14 三判据含「位置不同」限定词、STUB 标注逐字、no-op 未入反模式）；T5 **需要修复**→控制者修复波（AC-6 行未转义竖线致渲染截断）→ 复审确认。
- **整分支最终审查**：**修完再合** —— 1 **Critical**：`f090017f`（控制者的转义修复）把**准确的证据命令换成了当场可证伪的命令**（`git diff --stat df966a07..HEAD -- w-model-dev` 实测非空 9 files/272+/4−）；3 **Important**：I1 S09 在 `verifier-spec.md` 的落点缺失（规格 §3.2 与计划 §2 均要求两处落点——**计划 §2 与 §3 自相矛盾，非实现者缩水**）；I2 `§15` 不在任何加载路径上（该文件禁整文件载入 + 场景表只到 §13 + V 模板必读无 §15 ⇒ S07/S08 散文规则零入链）；I3 `Important` 与 §7.4A.2 前缀表冲突且与 `agent-personas.md:486` 的统一方向相反。修复波 `6be88e92`（3 个 .md）逐项解决；定向复审确认 4/4 ADDRESSED、无新 Critical/Important，并指出 2 处同族 Minor（§15.4 未被证据命令覆盖、「零 Schema」缺直接支撑命令）——**控制者随即将该行两处一并修正**（`279e9d9c`）：命令扩为含 `#### 15\.4` 并把 `'w-model-dev/**/*.json'` 纳入零-Schema 支撑，**两条命令均按规格原文重跑并核对输出**。
- **回归与修复**：T1 引入的 `examples-contract.test.ts` 违约（`subagent-delegation.md:265` 缺规范短名「普通 V/G 失败链」）由**收口 prepush** 抓到，`1701adfa` 修复（独立复审经全 corpus 复算确认违规 0）。
- **权威门禁运行**：本收尾节与前述 spec-only 提交之后，在最终树上重跑全量 `npm run prepush` 作最终确认（结果记于账本；若红则中止合并）。**注意**：上一轮绿跑（`1701adfa`）**不覆盖** `6be88e92` 对 `references/verifier-spec.md` 与 `subagent-delegation.md` 的资产改动——这正是必须重跑的原因。

### 3. 搁置项裁定（最终审查裁定，维持搁置）

T1/T2/T3/T4/T5 各项 Minor（报告行号与计数记账、`:1026` 台账路径、`:1032`/三处措辞、S08 五条前置核查未逐条落地（源素材非采纳范围）、`hill-climbing:26` 与 `skillopt-adoption:110` 裸 SSoT 指针、`asset-budget.test.ts` 行数注释过期、`/tmp` prepush 日志性质说明、§15 在 §0 导引表缺席（与 §13/§14 同形）、另两个 V 变体模板未列 §15）全部继续搁置；**驳回一项**：T2 称 `:1095` 归因错误——实测 `verifier-spec.md §2.3` 确强制 `subCriteria` 恰 5 项，两处归因都对（误报）。

### 4. 程序级遗留（非本单元）

- **教训**（值得进后续各期计划）：① 新增小节必须同步该文件的「按需分节加载导引」与相关分派模板的**必读**行（否则散文规则在「禁止整文件载入」的文件里等于不存在）——I2 的根因；② **收口前的证据命令必须逐条实跑**（P2-A 的 49≠43、本期的 C1 都是这一类）；③ 用于支撑「X 为空」的命令其 pathspec 与 filter 必须与该主张**同宽**（`--stat` 不含新增语义、需 `--diff-filter=A`）；④ 同族缺陷（未转义竖线致表格行渲染截断）在多个 AC 行都可能存在——控制者的机械校验脚本 `/tmp/scan-pipes.cjs` 证明本仓 13 个 AC 行**只有 AC-6 一处**，其余干净。
- **陈旧计数**：`docs/user-guide.md:110`（332 条，实际 340）、`.githooks/pre-push:320`（262）、`.code-health-governance.json`（`selfTestSamples:322`）——跨三期的既有漂移，建议随下次内容性改动统一清偿。
- **CHANGELOG 缺口**：P1/P2-A/P2-B/M07/P3 五期均按批准偏差禁改 `CHANGELOG.md`，须在 M 程序整体收口时统一补记。
