# 批次 5：治理与叙事（C2 agent 威胁模型 + C4 整批否决权/回收路径 + C1 Phase 5-8 迁移素材）设计规格

> **日期**：2026-10-03
> **状态**：三项前置裁定已获用户批准（D1-D3，见 §1），文档先行（D4）——实现分支待本规格获批后自 main 开启
> **来源**：13 来源吸收批次总纲（[2026-09-30-absorption-batches-master-outline.md](./2026-09-30-absorption-batches-master-outline.md)）批次 5 行 + §3 阻塞条件；三项裁定为用户 2026-10-03 会话指令
> **前置**：批次 1-4 已全部合入 main（42.9.0）。本批次改动面与批次 1-4 零重叠（`quality-standards.md` / `code-health-governance.md` / SSoT §10K / `verifier-spec.md`:671 行均未被批次 1-4 触及）

---

## 0. 问题定义

- **C2（agent 威胁模型）**：`verifier-spec.md:671` 对 agent 流水线自身威胁只有一行「prompt 注入防护提示……不构建完整守卫体系，仅作为 R3 security 提示项」；仓库已散落多处反伪造机制（约束 #9 退出码不可伪、`wm-append-runlog` 时间戳反伪造、签名链 v2+R11 字节绑定、evidence provenance、导出脱敏链、code-health RevisionIdentity/EvidenceBinding），但**没有统一的威胁→机制映射叙事**——R3 security 审查与 V security-auditor 无威胁清单可对照，机制覆盖了什么、没覆盖什么不可见。
- **C4（整批否决权/回收路径）**：逐候选的 CHECKPOINT approve/reject/defer、`git apply -R` 回滚、`rolled-back` 状态均已实现；但 campaign/批次级的**整批否决**与**整批回收**没有治理规则，全仓无任何「整批」语义登记；「已外发脱敏证据包不可召回」这一缺口也从未披露。
- **C1（Phase 5-8 迁移素材）**：迁移 = 在 W 模型阶段 5-8 受 code-health 治理的代码/测试迁移类变更（语境先例：`docs/superpowers/plans/2026-09-07-code-health-governance.md:1085`「Phase 5-8 若迁移代码/测试」）。SSoT §10K 对此仅有「未实现（不得据此执行）」一句，**无任何设计锚点**；总纲 §3 要求先有需求输入（目标迁移类型/规模/边界）才能立项实现。

## 1. 裁定记录（D1-D5）

| # | 决策点 | 裁定 |
|---|---|---|
| D1 | C2 边界裁定（总纲 §3 前置） | **文档叙事形态**：威胁模型 = 文档叙事 + 既有机制映射，**不属「守卫体系」**；新增 `references/agent-threat-model.md`（零新脚本、零 schema、零新检测信号）；`:671` 边界句细化为「不构建自动化守卫脚本；威胁登记与机制映射属 R3 叙事层」 |
| D2 | C4 强度 | **纯文档治理规则**：整批否决 = campaign 级批量 CHECKPOINT 语义（整批 reject/defer 后逐候选登记既有 ledger 事件）；回收 = 整批 rolled-back 编组规则（逐候选复用既有 `git apply -R` + 快照证明原语）；落 `quality-standards` + `code-health-governance` + SSoT 权威节；零新脚本零 schema |
| D3 | C1 需求输入 | **需求框架先行**：SSoT §10K 新增「Phase 5-8 迁移设计锚点（素材）」节 = 定义句 + 迁移类型分类学占位 + 规模/边界待输入字段表 + 需求征集清单；全程维持「未实现（不得据此执行）」；实现仍单独立项（2026-09-27 勘误先例：「体量差两个数量级」） |
| D4 | 版本与分支 | **43.0.0**（7 处版本镜像同步，批次 4 先例）；**文档先行**——本规格先提交 main，实现分支 `feature/batch5-governance-narrative` 待规格获批后自 main 开启 |
| D5 | 范围 | C2+C4+C1 三项全做；**不做**：新脚本/schema/CLI、pre-push 扩项、全局反模式新增（含 hard-constraints 候选 C1/C2 的 V 复审——不在总纲批次 5 清单）、Phase 5-8 迁移实现、C3 指标、eval mappings 扩（总纲批次 5 改动面不含 eval）、persona 文件与模板改动 |

## 2. C2 设计：`references/agent-threat-model.md`（新增）

### 2.1 文件定位（首节「定位与边界」）

- 本文件是**叙事/映射文档**，三条不承诺开宗明义：**不构建自动化守卫脚本、不新增检测信号、不改变任何 G 门禁判定**——「守卫」的唯一执行体仍是既有门禁脚本与硬约束，本文件只登记「威胁是什么、既有机制覆盖到哪、缺口在哪」。
- 消费角色：① R3 预防性审查 security 维度（`check-preventive-review.ts` 三报告的 security 报告审查参考）；② V security-auditor（按 `agent-personas.md` 选用）评审 `targetKind=code|design` 时的参考清单。两者均为「参考清单」，不新增强制检查项。
- 与 `verifier-spec.md:671` 的关系：细化而非推翻（见 2.3）。

### 2.2 威胁目录（T1-T7，每类四件：威胁描述 / 攻击面示例 / 既有机制映射 / 已知缺口）

| # | 威胁 | 既有机制映射（覆盖强度） | 已知缺口（如实登记） |
|---|---|---|---|
| T1 | 提示注入（外部资料/用户内容拼入子代理简报） | verifier-spec §7.4A 注入提示项（提示级）；简报最小权限与数据暴露最小化（提示级，verifier-spec:670） | 无自动注入检测——不建守卫，登记为缺口 |
| T2 | 证据伪造（run-log 时间戳回溯/重排、绕过更正通道） | `wm-append-runlog` 时间戳三态 + 反伪造 + `--correct` 通道（阻断级）；`check-run-log` R0-R11 时序/回滚证伪（检测级） | — |
| T3 | 门禁结果冒充（谎报退出码、自评放行、LLM 估算） | 约束 #9 退出码不可伪（阻断）；约束 #4 真实执行；gate 角色独占（反模式）；`check-verifier-output` R13 单轴下限防漂移（检测级） | — |
| T4 | 字节篡改与抵赖（产物改后声明不变） | 签名链 sigHash v1/v2 + R11 sha256 必填（检测级）；GATE_JSON `verifiedArtifacts`（检测级）；evidence provenance source-bound（检测级，**非密码学签名**——按既有边界如实标注）；code-health RevisionIdentity/EvidenceBinding（阻断级）；archive manifest SHA-256（**完整性校验和非签名**——如实标注） | gate-log↔签名链跨文件自动核查未建（批次 3 §4.1 既有登记） |
| T5 | 越权实施（编排者越权、绕过 apply 直改） | 编排者最小化 + 反模式 #10（流程级）；`wm-write` 锁 + 原子写（阻断级）；code-health 人类 approval + exact-scope 回读 fail-closed（阻断级） | — |
| T6 | 敏感数据泄漏与不当外发 | 导出脱敏链白名单（阻断级）；code-health redaction `blocked` 不导出（阻断级）；「禁止直接外发归档目录」边界（流程级） | 已外发脱敏证据包不可召回（只能补发更正包）——与 C4 交叉披露 |
| T7 | 输出漂移与静默语义偏移（LLM 评审/产出偏离契约） | LLM-as-a-Verifier 提示词契约 + 门禁脚本防输出漂移（检测级）；iceberg 扫掠（检测级）；R3 三维度预防性审查（检测级） | — |

- 映射总表后附**维护规则**：新增缓解机制（新脚本/新约束/新边界句）合入时须同步本表一行——与 SSoT §10A 追溯表同款纪律。
- 威胁类目刻意**不复用 STRIDE 六类名**（网络威胁建模分类在 agent 流水线语境错配），T1-T7 为本仓自有编号。

### 2.3 `verifier-spec.md:671` 行修订（唯一触及 verifier-spec 处）

- 原句保留，句尾追加两件事：① 边界细化声明「（批次 5 D1 裁定细化：「不构建完整守卫体系」指**不构建自动化守卫脚本**；威胁登记与既有机制映射属 R3 叙事层）」；② 指针「威胁目录与机制映射见 [agent-threat-model.md](agent-threat-model.md)」。
- 该指针同时是 S31 orphan-reference 审计（`docs-consistency-logic.ts:231`）的入链来源（references→references 入链合法），满足新文件可达性义务。

## 3. C4 设计：整批否决权/回收路径（纯文档，三落点）

### 3.1 `quality-standards.md`「代码健康治理质量门（Phase 1–4）」节内新增子节「整批否决权与回收路径（campaign 级，批次 5）」

- **整批否决权**：campaign 收口 CHECKPOINT（既有「候选放行」CHECKPOINT 的批量形态）处，人类可对**同 campaign 候选清单**整批 reject/defer。三条语义锚定：① **批量判定**=逐候选既有 CHECKPOINT 判定的编组，不新增权限（human 唯一授权者不变）；② **非降门槛**——整批放行≠单候选证据豁免，每个候选仍须各自满足 SSoT §10K.3 证据链；③ **逐候选落账**——整批否决后每候选各自登记既有 `rejected`/`deferred` ledger 事件（append-only 原语不变，不新增批量事件类型）。
- **回收路径**：已 `archivedAsPassed` 的 campaign 发现**系统性问题**（判据示例：某等价证明方法学缺陷影响整批结论）→ 人类 CHECKPOINT 发起整批回收：逐候选走既有回滚原语（受控 patch `git apply -R` + pre-change 快照回读证明）→ ledger 逐候选登记 `rolled-back` → archive 重新 produce（回收候选以终态**非成功**证据归档，`archivedAsPassed=false`）。明确**不建**「一键回滚」——回收是逐候选原语的编组，不是新自动化能力。
- **与阶段级对称性**（一句）：W 模型阶段 5-8 的「整批」形态已存在 = 阶段回退（`workflow.md`），本节补的是 campaign 级。
- **缺口披露**：已外发的脱敏证据包**不可召回**，只能补发更正包（与 AGENTS.md「本地生成物与审计证据」节交付边界一致，交叉引用）。

### 3.2 `code-health-governance.md` §6「CHECKPOINT 与失败链」内新增操作小节

操作视角三段：① 整批 CHECKPOINT 展示清单格式（campaign id + 候选清单 + 各候选 scopeHash，批量 approve/reject/defer/混合）；② 整批 reject 后逐候选事件登记顺序（ledger append 逐条，禁批量伪造单事件）；③ 回收触发判据与步骤（判据=系统性问题且逐候选受影响证明；步骤=3.1 回收路径的操作化）。

### 3.3 SSoT 权威句

并入 §10O（见 §5）落点表与「能力分工不夸大」披露：整批否决权/回收路径 = 批量 CHECKPOINT + 既有原语编组，零新机制；§10K 不另设重复节。

## 4. C1 设计：SSoT §10K.7「Phase 5-8 迁移设计锚点（素材，待需求输入）」

- **节首继承警告（黑体）**：「未实现（不得据此执行）」——本节是设计锚点**素材**，不构成可用能力，不得文档化为可用；实现单独立项（2026-09-27-deferred-closeout-design.md:17 先例：「体量差两个数量级」）。
- **定义句**：迁移 = 在 W 模型阶段 5-8 受 code-health 治理的代码/测试迁移类变更（move/relocate），复用 P1-P4 的「人类授权 + 证据锚定 + 可回滚」骨架。
- **动作枚举占位**：`migrate-code` / `migrate-test`（候选名，标注**待需求输入后定稿**，不入任何 schema/类型）。
- **待输入字段表（需求征集清单）**：

| 字段 | 待输入内容 | 状态 |
|---|---|---|
| 目标迁移类型 | 文件迁移 / 符号迁移 / 测试归属迁移 / 其他 | 待输入 |
| 规模上界 | 单 campaign 候选数上限 / 单候选 diff 规模 | 待输入 |
| 边界 | 哪些变更不算迁移（→ 走正常阶段 5-8 流程） | 待输入 |
| 接线形态 | 与 codegraph 前置（约束 #14）、编码计划制品（R1-R6）的接线 | 待输入 |
| 宿主前提 | `.codegraph` 索引要求、目标仓 git 形态 | 待输入 |

- **伴生一处指针**：`code-health-governance.md:5` 头部实现边界句追加「Phase 5-8 迁移的设计锚点素材见 SSoT §10K.7（待需求输入）」；`quality-standards.md:263` 勾选项「不执行未实现的 Phase 5–8 迁移」**保持原样**（仍然真实）。

## 5. SSoT §10O、版本与总纲状态

- **SSoT 新增 `## 10O. agent 威胁模型、整批否决权与迁移素材（批次 5，2026-10-03）`**（插在 §10N 之后、§10.10 之前），四件套形态（批次 2/4 先例）：目标 + 落点表（6-7 行）+ 能力分工不夸大（威胁模型=叙事映射非守卫体系；整批=编组语义非新自动化；素材=待输入非可用能力）+ 判据披露（D1 裁定与 :671 细化全文）。§10A 追溯表加一行。
- **版本 43.0.0**：`package.json` + 5 处镜像（`skill-metadata.json` / SKILL.md frontmatter / README / INSTALL / `package-lock.json` ×2）——批次 4 七处同步先例，`checkVersionConsistency` 门禁强制。
- **总纲状态**：§1 总览表批次 5 行状态改「规格已提交（2026-10-03，D1-D3 阻塞裁定已解除）」；§5 状态表批次 5 行登记规格文件名（实现后再回填终值）。

## 6. 范围与改动面锁定

| 文件 | 动作 |
|---|---|
| `w-model-dev/references/agent-threat-model.md` | **新增**（C2，D1） |
| `w-model-dev/references/verifier-spec.md`（:671 行） | 修改（边界句细化 + 指针，C2） |
| `w-model-dev/references/quality-standards.md` | 修改（C4 整批否决/回收子节） |
| `w-model-dev/references/code-health-governance.md` | 修改（C4 §6 操作小节 + C1 头部指针句） |
| `w-model-dev/SKILL.md`（:144 资源计数行） | 修改（references 44→45；`checkReferencesCount`（docs-consistency-logic.ts:1826）机器强制） |
| `AGENTS.md` | 修改（§2 references 表新行 + §1 机制索引一句） |
| `docs/skill-design-document_SSoT.md` | 修改（§10K.7 新子节 + §10O 新节 + §10A 行） |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md` | 修改（§1/§5 批次 5 状态） |
| `CHANGELOG.md`（43.0.0）+ 7 处版本镜像 | 修改 |
| 本规格 + 实现计划（docs/superpowers/specs、plans） | 新增 |

**明确不做**（D5）：新脚本/schema/CLI/eval/pre-push 扩项/全局反模式（含候选 C1/C2 V 复审，仅指认 `hard-constraints.md:536-558` 为既有 pending 状态）/Phase 5-8 迁移实现/C3 指标/persona 文件/templates 改动/`quality-standards.md:263` 勾选项改写。

## 7. 验收标准（批次 5 DoD）

1. `agent-threat-model.md` 在场：首节三不承诺；威胁目录 T1-T7 每类含威胁描述、≥1 既有机制映射（带文档锚点 + 覆盖强度标注）、已知缺口如实登记（T1/T4/T6 至少各一）；维护规则节在场。
2. `verifier-spec.md:671` 修订在场：原句保留 + D1 细化声明 + 指针；指针即 orphan 审计入链，`check-docs-consistency` exit 0（含 `references-count` 44→45 同步）。
3. C4 三落点在场：quality-standards 子节（批量 CHECKPOINT 语义 + 非降门槛 + 缺口披露）、code-health-governance §6 操作小节、SSoT 权威句；零新脚本零 schema（脚本 48 .ts、schema 34 份计数不变）。
4. C1 §10K.7 在场：继承警告 + 定义句 + 动作枚举占位 + 五字段待输入表；code-health-governance 头部指针句；§10K 头部既有「未实现」边界句不删。
5. SSoT §10O 四件套 + §10A 行；AGENTS.md §2 表行 + §1 索引句；总纲 §1/§5 批次 5 状态；CHANGELOG 43.0.0 + 版本七处同步（`package.json` / skill-metadata / SKILL.md frontmatter / README / INSTALL / package-lock ×2，批次 4 先例）。
6. `npm run prepush` 19 项全绿收口；全仓 `grep` 证明「整批」新语义只在三个文档落点出现（无脚本/schema 误接线）。

## 8. 风险与已知代价

- **风险 1**：威胁模型文档被误读为「守卫体系已存在」→ 缓解：首节三不承诺 + 映射表覆盖强度列（提示级如实标注）+ §10O 判据披露。
- **风险 2**：整批否决被误用为降门槛捷径 → 缓解：非降门槛条款（整批放行≠证据豁免）+ 逐候选落账义务 + 回收须系统性问题判据。
- **风险 3**：C1 素材节被误读为可用能力 → 缓解：继承黑体警告 + code-health-governance 头部边界句不删 + quality-standards:263 勾选项原样。
- **风险 4**：references 计数与 orphan 审计两道机器门禁 → 缓解：SKILL.md:144 同步 + :671 入链，DoD 6 prepush 实证。

## 9. 与总纲共享契约的关系

- 总纲 §4.1-§4.3 契约**零触碰**：无 ChangeClassification 取值、无 StructuredViolation 字段、无 GATE_JSON 键改动（本批次零代码）。
- 总纲 §7 不吸收清单不受影响：C4 是治理规则文档化，非 Anthropic managed settings / Basecamp 产品策略类配置或基建吸收。

## 10. 仓内证据锚点（实施定位）

- `w-model-dev/references/verifier-spec.md:671`（注入提示行；:669-670 相邻行为「落点：R3 preventive review」句式先例）
- `w-model-dev/scripts/logic/docs-consistency-logic.ts:1826`（checkReferencesCount）、`:231`（S31 orphan-reference 审计数据源）
- `w-model-dev/SKILL.md:144`（资源计数行 references 44）、`:121`（脚本计数 48 .ts——本批不改）
- `w-model-dev/references/quality-standards.md:253-263`（代码健康治理质量门节 + :263 勾选项）
- `w-model-dev/references/code-health-governance.md:5`（头部边界句）、`:72-78`（§6 CHECKPOINT 与失败链）
- `docs/skill-design-document_SSoT.md:2189-2244`（§10K 全节）、`:2379-2394`（§10N，§10O 插入点在其后、§10.10 :2395 之前）、§10A 追溯表
- `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md:18`（批次 5 行）、`:70-76`（§5 表）
- 语境先例：`docs/superpowers/plans/2026-09-07-code-health-governance.md:1085`（Phase 5-8 迁移语境）、`docs/superpowers/specs/2026-09-27-deferred-closeout-design.md:17`（体量差两个数量级）
- 本批不做项的既有状态锚点：`w-model-dev/references/hard-constraints.md:536-558`（候选 C1/C2 pending V 复审）
