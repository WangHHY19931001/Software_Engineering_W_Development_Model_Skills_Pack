# P6 拒绝知识库 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **批准与边界：** P6 = 设计规格 §11 `:306` 第六期（**M08 拒绝知识库**，依赖 P0；「D7 确认」）。**验收 = AC-10**（`:367`）。规格 §6（D 级：M08）`:215-223` 给出**内化产物**（概念粒度持久拒绝登记 + `Prior requests` 回链 + 阶段 1 入口按概念相似度去重的读取动作；**在既有命令内实现，不新增 `/wm` 子命令**）、**边界**（照搬自由目录会成为平行事实源 → 必须**挂靠既有事实源**并**加门禁**；外部该机制零校验、是漂移高发面；**仅 rejected enhancement 入册，已实现者拒收**）与**交付判据**（**挂靠既有事实源 + 门禁，不得新建自由目录**）。
>
> **用户裁定（2026-09-16，本次会话）：** ① **载体 = 方案 A**（需求规格 §8 表格化 + 既有结构门禁增强；**零 Schema 变更、零计数级联**）；② **Reconsider 分支改写为状态标记**（不删除，`状态 = reconsidered` + 替代指向），以对齐本仓 append-only / 证据留痕文化与 phase-1「禁止隐式消失」不变量。
>
> **D7 确认（本计划的前置，逐条满足并留证）：** D7（`:270`）为**负向约束**——不改 RTM 实体/关系/Schema/覆盖率语义/维护方式；不创建 `termPointers`；不迁移 RTM Schema；不把术语状态写成 RTM 覆盖状态；不自动改写 SSoT；唯一例外 M07 已作为独立批准单元落地（P2 期）。本计划**不触及** `rtm.schema.json`（AC-10 末句「RTM 未新增关系或字段」即其可证判据）。规格 §9 preamble（`:260`）规定 D1–D7 **仅当**某采纳项需要「独立能力运行」时才适用，而 §6 `:221` 对 M08 明示「**在既有命令内实现，不新增 `/wm` 子命令**」→ **D1–D6 不适用**；D7 作为负向约束被满足。**⇒ 「D7 确认」前置达成，无需用户另行批准**（本计划不含 Schema 变更）。

**目标：** 把阶段 1 迷雾毕业的「判 Out of Scope」从**单轮散文**升级为**概念粒度的持久拒绝登记**（含 `Prior requests` 回链），并在**需求入口**加入按概念相似度去重的读取动作，配一条对登记结构生效的确定性门禁——全部**挂靠既有事实源与既有门禁**，不新建自由目录、不新增 CLI、不新增 Schema。

**架构（全部为既有文件的就地增强）：**
- **事实源**：`docs/phase1-requirements/requirement-spec.md` 的 **§8 Out of Scope**（既有节，今天是无门禁散文——`checkRequirementSpecStructure` 只管 6 引用块 / §0 SSOT 头 / DoD≥8，**不查 §8**）。登记形态由散文列表升级为**固定列表格**。
- **门禁**：`w-model-dev/scripts/logic/gate-logic.ts:764` 的 `checkRequirementSpecStructure` 增加各一个 violation 桶做 §8 表格结构校验（经 `check-artifact-gate.ts --phase=1 --spec-dir` 生效）。**增强既有脚本，不新增脚本。**
- **入口读取动作**：`w-model-dev/references/ingestion-chunk.md`「REQ 入学锐利性测试」节（唯一「新需求进入时」必然执行且有确定性分流处）。
- **登记规则与毕业衔接**：`w-model-dev/references/phase-1-requirements.md` 的「迷雾登记册（Fog of War）」节。
- **模板**：`w-model-dev/templates/requirement-spec.md` §8。
- **文档落点**：`w-model-dev/references/command-reference.md`（门禁契约）+ `docs/skill-design-document_SSoT.md`（SSoT 优先）。

**技术栈：** 既有 tsx + vitest + 注入式 fs（`checkRequirementSpecStructure(specDir, fs)` 已是可注入签名）；**零新增依赖**。

---

## 0. 实测基线（勘察 2026-09-16 @ad48e469，worktree `.worktrees/p6-rejection-kb`）

| 实测事实（file:line） | 对设计的影响 |
| --- | --- |
| `checkRequirementSpecStructure` 在 `gate-logic.ts:764`，签名 `(specDir, fs)`（fs 可注入）；现查三组：6 引用块存在 + §0 SSOT 头四项 + `discipline-dod.md` DoD ≥ 8；返回 `RequirementSpecStructureViolations`（`{refs, ssot, dod}`） | §8 校验 = 新增一个 violation 桶（type + 判定 + 消息），**不改既有三组判据** |
| **全仓 `find samples -name requirement-spec.md` = 0** —— self-test 用**内存 fs stub**（`self-test.ts:3166+`，`fsStub` 喂 `checkRequirementSpecStructure`）| 新增 §8 校验**不破坏任何真实夹具**；夹具改动集中在 self-test 的 stub 用例（正向 + 负向各一） |
| 模板 §8 现状 = 三条 `- {{...}}` 散文 bullet（`templates/requirement-spec.md:228-235`）；**§8.5 已是表格**（`| 迷雾项 ID | … | 毕业处置结果 |`，`:237-245`） | §8 升级为表格有**同文件内的形态先例**（§8.5）；迁移标记可机器判别（旧形态含 `- {{`） |
| 迷雾毕业三选一在 `phase-1-requirements.md:160-163`，第 2 支「判 Out of Scope」= 「写入规格书 §8，永不毕业（除非目的地重画）」；覆盖矩阵语义 `:168-170` 明示迷雾项**不计入分母**、禁止隐式消失 | 第 2 支改写为「**向 §8 表追加一行**」，语义与「永不毕业/不计分母」保持不变 |
| 入口候选：`ingestion-chunk.md:41-63`「REQ 入学锐利性测试」= 唯一「新需求进入时必然执行 + 有确定性分流」处 | 读取动作落此处；**不落** `SKILL.md:40` 分诊节（该节自我约束「不引入路由」，落此会制造正面冲突） |
| 来源语义（已 vendor）：`docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md:329-402`——一概念一档 / 入口读全量 / 概念相似度匹配（非关键词）/ surface 给维护者三选一 **Confirm**（追加 `Prior requests` 后关闭）/ **Reconsider**（删除或更新该档）/ **Disagree**（相关但不同，走正常 triage）；**仅 `wontfix` 的 enhancement 入册，bug 不入册** | 登记条目 = 概念粒度；入口动作 = 读全量 + 匹配 + surface 三选一；**Reconsider 按用户裁定改状态标记**（不删） |
| 计数现状：`cli/*.ts` **46** / exit-2 **45** / `schemas` **34** / `runLogActionCount` **27** / `prePushCount` **18** / `maxAntiPattern` **48** / `references/*.md` **43** / persona 28 / `self-test` **344** / `__tests__` 88 / L0 672·95·36 | 本计划**不改**其中任何一项（零新增脚本/Schema/action）；**`self-test` 计数会随新增用例变**（见任务 2，须同步 9 处声明） |
| `check-exit2` 类门禁只匹配「`N 个脚本`」，故 `AGENTS.md:41` 的「完整 exit-2 脚本 **43** 清单」**逃过门禁**（`:22` 已是 45）；规格 `:213` 的 `exit2ScriptCount: 43` 亦过期 | 属**门禁盲区漂移**，P6 顺带修正（任务 5）；此为「顺带清偿」而非新面 |
| `§5 C 级产出清单`（规格 `:200-213`）8 项**不含 M08**（M08 是 D 级 `:215-223`） | **新增 CLI / 新增 Schema 均不属 P0 已批准面** → 本计划**一律不做**（这也是选方案 A 的硬理由） |
| `data-models.md:965`「所有 `.w-model/*.json` 必须先过 JSON Schema 前置校验」；`state-schema-registry.ts:11-33` 是 `.w-model` 文件权威清单（14 条） | 本计划**不新增任何 `.w-model/*.json`** → 该约束自然满足 |
| AC-11（`:368`）禁项含「不改变既有 `/wm` 命令输入/输出/语义；不新增阶段放行路径；不引入平台/会话 hook」 | P6 **不新增命令**、**不新增放行路径**；对 phase-1 结构门禁的**数据要求**收紧属既有门禁的判据强化（详见 §0.1.4 的披露要求） |

### 0.1 设计裁定（控制者决定，实现者不得擅改）

1. **载体 = 需求规格 §8 表格化（方案 A，用户已裁定）。** 登记落 `requirement-spec.md` §8，形态为**固定列表格**：

   | conceptKey | 拒绝理由 | Prior requests | 状态 | 来源 |
   | --- | --- | --- | --- | --- |
   | `<kebab-case 概念键>` | `<为何排斥>` | `<回链：REQ/issue/请求标识，逗号分隔>` | `rejected` / `reconsidered` | `<来源：阶段1 / 轮次 / 请求号>` |

   - **`conceptKey` 唯一**（一概念一行；同概念多请求归并到同一行的 `Prior requests`）。
   - **`Prior requests` 回链**：逗号分隔的非空标识列表；无回链时写 `-`（显式空，不得留白）。
   - **`状态`** 枚举 = `rejected`（仍拒绝）/ `reconsidered`（改主意）。**任何情况下不得删除行**（用户裁定）；`reconsidered` 行须在 `拒绝理由` 列或新增的「替代指向」中写明去向（`→ REQ-xxx` 或 `→ 见 §8.5`）。
   - **仅 rejected enhancement 入册**：**bug / 缺陷不入册**（来源语义）；**已实现者拒收**（规格 `:222`）。
2. **门禁 = 增强 `checkRequirementSpecStructure`（不新增脚本）。** 新增一个 violation 桶（建议名 `outOfScope`），判定：
   - (a) **§8 节缺失** → 违规（须有该节；「无」也要显式声明）；
   - (b) **§8 无表格且含旧模板形态**（`- {{`）→ 违规，消息含迁移指引（旧散文形态须表化）；
   - (c) **§8 有表格** → 校验**表头列齐**（五列：`conceptKey` / `拒绝理由` / `Prior requests` / `状态` / `来源`）、**`conceptKey` 非空且唯一**、**`状态` ∈ {`rejected`,`reconsidered`}**、**`Prior requests` 单元格非空**（`-` 合法）。
   - **不校验语义相似度**（确定性脚本无法判定「概念相似」）——此项由**入口读取动作**（任务 3）以 Agent 语义执行，门禁只保证**登记结构可信**（这正是 AC-10「对应门禁」的落点，须在文档中明写该边界）。
   - `--phase=1` 且提供 `--spec-dir` 时生效；**不新增参数、不新增脚本、不改既有三组判据**。
3. **入口读取动作（任务 3）** 落 `ingestion-chunk.md`「REQ 入学锐利性测试」节：**每次新需求进入时读 §8 全量 → 按概念相似度（非关键词）匹配 → 命中则向用户 surface**（「与 §8 `<conceptKey>` 相似；此前因 `<拒绝理由>` 拒绝；是否仍持此见？」）**并给三选一**：**Confirm**（把本次请求标识追加进该行 `Prior requests`，本次不再走正常 ingest）/ **Reconsider**（该行 `状态` 改 `reconsidered` + 写替代指向，本次走正常 ingest）/ **Disagree**（相关但不同，本次走正常 ingest，§8 不动）。**判定必须口播给用户**（不可静默匹配后自行处置）。
4. **AC-11 披露义务**：本计划对 phase-1 结构门禁**收紧了数据要求**（§8 须为合规表格）。这不新增命令、不新增放行路径，但**改变「什么样的 phase-1 规格能过门」**——属**判据强化**。**计划须在收口节如实记录该收紧及其理由**，并在 `command-reference.md` 的门禁契约处显式写明（避免读者以为门禁未变）。**不得**为此引入 legacy 时间豁免（本仓零 `requirement-spec.md` 夹具，无迁移对象；时间豁免会给「忘了写表格」开永久后门）。
5. **不新增反模式条目**（`maxAntiPattern: 48`，双向断言 `docs-consistency-logic.ts:1335/1344`）。新纪律**挂靠既有条目**：#3（RTM 为事实源——本计划不改 RTM 即其正面证据）、#10（编排者边界）与既有「平行事实源」约束（`phase-5-coding.md:238` 同族）。
6. **零新增文件**：本计划**不新增任何文件**（不改计数：cli 46 / exit-2 45 / schemas 34 / references 43 / `runLogActionCount` 27 / `prePushCount` 18）。**唯一例外**是 `self-test` 用例数（任务 2 会新增用例）与随之的 9 处声明同步。
7. **`Prior requests` 回链的标识体系（有界选择）**：W-model 无 issue 号体系，故回链标识取**本仓既有可引用标识**之一（按可得性优先级：`REQ-xxx` / 阶段轮次 `<轮次>-<序号>` / 请求原文短引）。实现者须在文档中给出**可用形态与生成规则**，**不得**发明第二套编号体系（避免与 REQ/RTM 并列的新事实源）。**若实现者认为需要新编号体系，停下报告**——那会触及 AC-10 的「挂靠既有事实源」。

---

## 1. 全局约束（每个任务都适用）

1. **零新增依赖 / 零新增 Schema 文件 / 零新增 CLI 脚本**（`schemas` 34、`cli/*.ts` 46、exit-2 45 均不变）；**不改 `rtm.schema.json`**（D7 + AC-10 末句）；无 LLM 调用。
2. **不升版本号**（五处镜像不动）。
3. **不得放松任何既有判据**：本计划只**增强** phase-1 结构门禁；既有三组判据（6 引用块 / §0 四项 / DoD≥8）**逐字不动**；不得改动任何其他门禁。
4. **不触碰**：`CHANGELOG.md`、`docs/changes/**`、`docs/superpowers/sources/**`、`package.json`、`package-lock.json`、`eval/**`、`.githooks/**`、`.code-health-governance.json`、`w-model-dev/schemas/**`。
5. **反模式计数不变**（48）。
6. **计数契约同步义务**：`self-test` 计数随新增用例同步（**9 处声明**：`samples/README.md:3` 与文末、`README.md`、`CONTRIBUTING.md` ×3、`AGENTS.md` §8、`docs/INSTALL.md`、`references/subagent-delegation.md` dispatch 表）。
7. **L0 重基线义务**：新增 markdown **相对链接** → `audit:l0-links` + `helpers/l0-baseline.ts` 流程。**优先用反引号纯文本**引用其他 reference 文件以**避免**重基线。
8. **每任务验证清单（强制；教训 ⑤⑥⑦⑧⑨⑩ 全内化）**：(a) `npm run lint:security`；(b) 守卫组或全量 vitest，**凡触及 `.ts` 必须加 `npm run typecheck`**；(c) `npm run audit:l0-links`；(d) 新增必需文件/字段 → consumer 搜索；(e) prettier 权威配置**只作用于 `.ts`/`.cjs`**（`references/*.md`、`templates/*.md`、`.githooks/**` **不在** prettier 面内——P5 勘误，勿对 .md 跑 prettier）；(f) **同一 worktree 内禁止两个 vitest/coverage 并发**。
9. **TDD**：任务 2 的 §8 校验条目先红后绿（负向 fixture 必须在**去掉校验时**变绿、**加上时**变红）；纯文档任务以台账/规格回溯 + 零删改 diff 证明代替。
10. **诚实性**：证据命令真实跑过贴真实输出；**S13/AC 类回填不得夸大**；AC-10 的「对应门禁」若只能达「结构门禁 + 语义读取分离」，**必须如实写明该边界**，不得宣称门禁校验了概念相似度。
11. **保持输出流动**（本会话教训：子代理无输出会被超时终止——每个任务简报都要求逐步输出状态）。

---

## 2. 任务分解

### 任务 1（模板侧）：`templates/requirement-spec.md` §8 散文 → 固定列表格
- [ ] 读 `templates/requirement-spec.md` §8（`:228-235`）与同文件 §8.5 表格形态（`:237-245`）作形态参照；读 `docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md:329-402` 取来源语义。
- [ ] 把 §8 改为固定列表格（五列，见 §0.1.1），保留既有三条 bullet 的**语义**（「至少 1 条（即使是「无」也要显式声明）」与 Brownfield 提示）为表格前后的一行说明；**表头与占位符**照 §0.1.1 逐字；加一行 `-` 的「无」示例行。
- [ ] 表下补一行**登记规则速览**（概念粒度 / `conceptKey` 唯一 / `Prior requests` 回链 / **不删除行，改主意改状态标记** / **仅 rejected enhancement 入册、已实现者拒收、bug 不入册**），并注明权威细则见 `references/phase-1-requirements.md`。
- [ ] **验证**：`git diff` 该文件仅 §8 段变更；`npm run audit:l0-links` exit 0（表内不新增相对链接）。
- [ ] **Commit**：`docs(templates): make §8 out-of-scope a concept-granular rejection register (M08)`

### 任务 2（门禁侧）：`checkRequirementSpecStructure` 增加 §8 结构校验（TDD）
- [ ] 读 `gate-logic.ts:764-810` 全文 + `RequirementSpecStructureViolations` 类型定义 + 所有 consumer（`self-test.ts:44/801/3166-3200`、`check-artifact-gate.ts` 调用点、`docs-consistency` 若有引用）——**列出全部 consumer**（约束 8(d)）。
- [ ] **TDD（先红后绿）**：在 self-test 的 **fs stub 用例**（`:3166+`）新增**正向**（合规 §8 表格 → 无违规）与**负向**（缺 §8 节 / §8 为旧 bullet 形态 / 表头缺列 / `conceptKey` 重复 / `状态` 非法枚举 / `Prior requests` 空白 → **各自恰好报该违规**）；**先跑出红**（如：先只加负向用例再跑 → 失败；贴真实输出）。
- [ ] 实现：`RequirementSpecStructureViolations` 加 `outOfScope: string[]` 桶 + 判定（§0.1.2 的 (a)(b)(c)）；`check-artifact-gate.ts --phase=1` 的既有聚合处**把新桶并入既有 exit 语义**（不改退出码约定：有违规 → exit 1）。
- [ ] **既有三组判据逐字不动**（6 引用块 / §0 四项 / DoD≥8）——给 `git diff` 证据。
- [ ] **计数同步**：`self-test` 用例数变化 → 同步 **9 处声明**（约束 6）。**`cli`/exit-2/`schemas`/`references` 计数不变**。
- [ ] **验证**：`npm run typecheck`；`npm run lint:security`；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/self-test` 相关 + 全量 `npm run self-test`（新计数一致）；`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts <临时 phase-1 项目> --phase=1` 对**合规/不合规 §8** 双向实测（真实退出码），贴输出。
- [ ] **Commit**：`feat(gate): validate the §8 rejection register structure at phase 1 (M08)`

### 任务 3（入口读取动作 + 登记规则）：`ingestion-chunk.md` + `phase-1-requirements.md`
- [ ] `ingestion-chunk.md`「REQ 入学锐利性测试」节（`:41-63`）：新增**入口读取动作**（§0.1.3 逐条：读 §8 全量 / 概念相似度匹配（**非关键词**，给来源的同型例子）/ 命中则 surface + **三选一** Confirm·Reconsider·Disagree / **判定必须口播** / 未命中则正常 ingest）。写清**该动作不改变 ingest 的确定性分流**（这是 A 子代理的读取义务，不是新路由）。
- [ ] `phase-1-requirements.md` 迷雾册「毕业（S 子代理）」第 2 支（`:162`）：改写为「**向 §8 表追加一行**（概念粒度；`状态 = rejected`；`Prior requests` 记本次标识）」，并写明**与「永不毕业/不计分母/禁止隐式消失」不变量一致**；补**登记规则**（§0.1.1 五条 + §0.1.7 的回链标识体系 + **Reconsider = 状态标记不删除**）。
- [ ] **边界句（必写）**：门禁**只校验登记结构**；**「概念相似度」由入口读取动作的语义匹配承担**，确定性脚本不校验语义——如实写明该分工（AC-10 措辞不得被夸大）。
- [ ] **验证**：约束 9（纯文档：十一守卫组 + `audit:l0-links` + `lint:security` + **反模式 48** + 零删改 diff 证明）；新增散文若含失败信号措辞须带规范短名「普通 V/G 失败链」（…节）。
- [ ] **Commit**：`docs(phase-1): entry-time rejection matching and register rules (M08)`

### 任务 4（文档落点）：`command-reference.md` + SSoT
- [ ] `command-reference.md`：在门禁契约处补 **§8 拒绝登记** 的校验说明（哪条命令、何种输入、判定 (a)(b)(c)、退出码语义、**门禁只校验结构** 的边界、以及「phase-1 规格须含合规 §8 表格」这一**判据强化**的显式说明——AC-11 披露义务）。
- [ ] `docs/skill-design-document_SSoT.md`：**先行**补记 M08 的落点与小节（照本仓「SSoT 优先」纪律）；写明**不新增 Schema / 不新增 CLI / 不改 RTM**。
- [ ] **验证**：同任务 3。
- [ ] **Commit**：`docs(reference): document the §8 rejection register gate (M08)`

### 任务 5（顺带清偿）：门禁盲区的陈旧 exit-2 计数
- [ ] `AGENTS.md:41` 的「完整 exit-2 脚本 **43** 清单」→ **45**（实测当前 exit-2 = 45）；核 `:22`「45 个脚本」已正确，两处一致。
- [ ] 规格 `:213` 的 `exit2ScriptCount: 43` → **45**（该行是 §5 的联动计数器清单；**只改数字，判据文本不动**）。
- [ ] **不得**顺手改其他已裁定搁置的陈旧计数（`docs/user-guide.md` 332 / `.githooks/pre-push` 注释 262 / `.code-health-governance.json` `selfTestSamples: 322`）——那些按 P2-B 裁定**继续搁置**。
- [ ] **验证**：`grep -n "43 清单\|exit2ScriptCount" AGENTS.md docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md`；`check-docs-consistency` 的 gate-count 规则不得被误伤（`AGENTS.md` 行含「门禁/检查」时的「N 项」必须 == 18——本处改的是「N 清单」，无「项」，安全，但**改完必须实测自查**）。
- [ ] **Commit**：`docs(fix): correct the stale exit-2 script count references`

### 任务 6（收口）：全量门禁 + AC-10 回填
- [ ] `npm run prepush`（独占，唯一一次；预期 18/18 + `PREPUSH_EXIT=0`）。
- [ ] 一致性自查（实测）：`cli` 46 / exit-2 45 / `schemas` 34 / `references` 43 / 反模式 48 / `prePushCount` 18 / `self-test` 与声明一致 / `audit:l0-links` exit 0（672/95/36）/ `check-samples-coverage` exit 0。
- [ ] **AC-10 行内回填**（规格 §13 `:367`）：**判据文本一字不动**，行末追加 `**已达成（P6，2026-09-16）**` + 逐项证据（挂靠既有事实源=`requirement-spec.md` §8 / 概念粒度条目 / `Prior requests` 回链 / 入口读取动作=`ingestion-chunk.md` 节 / 对应门禁=`checkRequirementSpecStructure` 新桶 / 仅 rejected enhancement / **RTM 未新增关系或字段**——后者的证据 = `git diff <P6 BASE>..HEAD -- w-model-dev/schemas/rtm.schema.json` **为空**）。
- [ ] **AC-11 披露**：在 AC-11 行内或收口节如实记录「phase-1 结构门禁的**数据要求收紧**（§8 须为合规表格）」——不新增命令/放行路径，属判据强化。
- [ ] **AC-0 侧记**：本计划同时构成 **D7 确认**的记录（见计划头「D7 确认」段）；若控制者认为需在 AC-0 行内留一句，一并补（判据文本不动）。
- [ ] 计划收尾节（控制者终版回填）。
- [ ] **Commit**：`docs(spec): close AC-10 after P6`

---

## 自检结果

**1. 规格覆盖度**：M08 单项目标 → 任务 1/2/3/4 四面包（模板 / 门禁 / 入口 / 文档）；AC-10 六子项 → 任务 2（挂靠 + 门禁）+ 任务 3（概念粒度 + 回链 + 入口读取 + 仅 rejected enhancement）+ 任务 6（RTM 未变的证据）；D7 确认 → 计划头 + 任务 6；§5 联动计数器 → 任务 2/5；AC-11 → 任务 4 + 任务 6 披露。
**2. 占位符扫描**：无。`Prior requests` 标识体系为**有界选择 + 报告义务**（§0.1.7）。
**3. 命名一致性**：`conceptKey`（来源「concept」词）/ `Prior requests`（来源逐字）/ `rejected`·`reconsidered`（用户裁定的状态标记）/ `outOfScope`（violation 桶名，与既有 `refs`/`ssot`/`dod` 同风格）。
**4. 与既有验收的关系**：AC-10 达成（任务 6 回填）；**AC-7/AC-8/AC-9 不受影响**（不动 S24/run-log/AC-9 面）；**AC-11 须复验**（任务 6：无新依赖/hook/HTML/CDN/本地服务，`l0` exit 0；并按 §0.1.4 披露判据强化）。
**5. 零面承诺**：**零新增文件 / 零新增 CLI / 零新增 Schema / 零新增依赖 / 零 `run-log` action**；唯一计数变化 = `self-test` 用例数（任务 2 同步 9 处）。

---

## 执行结果（计划收尾节，控制者终版回填 2026-09-16）

**状态：全部 6 个任务完成，验收 AC-10 已闭环、AC-11 已披露。** 分支 `feat/p6-rejection-knowledge-base`，BASE `ad48e469`（main）→ 本收尾节所在提交。**M08 单项目标 12/12 子项落地**（内化产物 4 项 + 边界 3 项 + AC-10 六子项 + D7）。

### 一、提交序列（7 个）

| # | commit | 内容 | 评审 |
| --- | --- | --- | --- |
| 0 | `cf6b8c0d` | 计划本体（含 780 行实测勘察的结论） | — |
| 1 | `6a94ac30` | T1：`templates/requirement-spec.md` §8 散文 → 五列表格 + 哨兵行 + 登记规则速览 | 并入 T2 审查 |
| 2 | `e56e0898` | T2：`checkRequirementSpecStructure` / `checkPhaseSpecStructure` 共用 helper 新增 `outOfScope` 桶（TDD 红→绿） | **不通过**（1 Important） |
| 2b | `4746ecac` | T2 修复：`normalizeMarkdownCell`（仅剥整格单对反引号）+ 模板示例行合规化 + 转义管道语义显式化 | 定向复审**通过** |
| 3 | `a904a020` | T3+T4+T5：入口读取动作 + 登记规则 + 门禁文档 + SSoT 先行 + 陈旧 exit-2 计数清偿 | 并入整分支审查 |
| — | `fd767952` | 修复波：过程报告移出版本控制 + 补「哨兵行 / ≥1 数据行」权威细则 | 控制者机械核验 |
| 6 | `f9d3710b` | T6：AC-10 回填 + AC-11 披露 | — |

### 二、评审与修复轮次

- **逐任务/合并审查 2 轮** + **定向复审 1 轮**：T1+T2 合并审查（独立 V，112509 字节包）判 **不通过**——**1 Important：模板自带的「无」哨兵行过不了它自己的门禁**。根因：模板单元格为反引号包裹（`` `-` ``），而门禁 `splitTableRow` 不剥反引号 → 哨兵豁免失效；**两套既有测试都手写裸 `-`，无任何测试覆盖交付模板的真实文本**；`gate-logic.ts` 的注释「否则模板自身的「无」形态会过不了本门禁」被**证伪**。
- **定向复审用 A/B 四象限证据证明修复两半各自承重**：BASE gate+BASE 模板 = **2**、HEAD gate+BASE 模板 = 1、BASE gate+HEAD 模板 = 2、**HEAD+HEAD = 0**；并独立复核**归一化未过宽**（4 例反向探针仍判非法）、**唯一性用归一化值**（`` `dark-mode` `` 与 `dark-mode` 判重复 = 否则可用反引号绕过唯一性）、**既有三组判据体无 hunk 覆盖**（gate-logic 仅 3 hunk 全 ≤ 860 行）。
- **整分支最终审查**（BASE `ad48e469` → `a904a020`，243967 字节包）：**可合并**（0 Critical / 0 Important / 4 Minor）。逐项判定：M08 内化产物/边界**逐条落地**；交付判据（挂靠既有事实源 + 既有门禁、**无自由目录**）**满足**；**AC-10 六子项全过**；**D7/RTM 未变**；**AC-11 满足且披露义务已履行**；**跨任务一致性五组全组一致**；**T4 的 `GATE_JSON` 证据描述与实测形态完全一致**（实建临时 phase-1 项目核对字段路径）。

### 三、收口门禁（控制者在最终树独占运行）

`npm run prepush` → **18/18 全绿、`PREPUSH_EXIT=0`**，末行「全部门禁通过，允许推送 ✓」（含 `vitest 全量 + coverage 阈值`、`npm audit` **真实执行未网络跳过**、`docs-consistency`、`tsc`、`eval`）。
一致性自查（实测）：`self-test` **352/352**、`audit:l0-links` exit 0（**672/95/36**）、计数 `cli` **46** / `schemas` **34** / `references` **43** / exit-2 **45** / `runLogActionCount` **27** / `prePushCount` **18** / `maxAntiPattern` **48** / 版本 **42.2.1** 全部未变；**「344」计数零残留**。

### 四、AC-10 达成的限定（**必须随验收一起读**）

AC-10 的「**对应门禁**」判定为**达成，但须强制披露边界**。P6 的门禁是**确定性、fail-closed、有负向测试**的**结构**门禁：节存在 / 五列齐 / `conceptKey` 非空且唯一 / `状态` 枚举 / `Prior requests` 非空 / ≥1 数据行（哨兵行豁免）。
**它不校验概念相似度**——概念相似度由入口读取动作的**语义匹配**承担。
**⇒ 「门禁通过」≠「去重已发生」**；两者是「结构门禁 + 语义读取」的分工。该措辞已在四处文档就位（`command-reference.md:403`、SSoT §10.5.3、`phase-1-requirements.md`、`ingestion-chunk.md:90`），并在 AC-10 行内如实写明。

**AC-10 的证据读法（审查者裁定，勿以退出码为据）**：三态（合规 / 旧散文 / 缺 §8）的**整体退出码均为 exit 1**（被无关缺件 `tla-manifest` / `bdd-manifest` / `uat-path-mapping` 掩盖），因此证据**必须**引用 **`GATE_JSON.reasons` 中 `structure: §8` 桶的计数**（合规模板逐字 → **0**；旧散文 → **1**）。

### 五、AC-11 披露：phase-1 门禁的判据强化

P6 对 **phase-1 结构门禁**做了**数据要求收紧**——`docs/phase1-requirements/requirement-spec.md` 的 §8 须为合规五列表格（含 ≥1 数据行或哨兵行），否则报 `structure: §8 …` 违规（exit 1）。
**该收紧不新增命令、不新增放行路径、不改 `/wm` 命令的输入/输出语义**，属**既有门禁的判据强化**。P6 **未**引入 legacy 时间豁免：本仓**零** `requirement-spec.md` 夹具（self-test 走内存 fs stub），无迁移对象；时间豁免会给「忘了写表格」开永久后门。
AC-11 复验：`git diff ad48e469..HEAD -- package.json package-lock.json .githooks/` 为空（零新依赖、零 hook）；无 HTML/CDN/本地服务；`audit:l0-links` exit 0。

### 六、控制者事实更正（审查者独立发现，控制者实测确认并自纠）

1. **「零新增文件」说法错误**：`ad48e469..a904a020` 实际新增 **2** 个（P6 计划本体 + **误提交**的 `.superpowers/sdd/.../task-345-report.md`）。根因：**控制者照抄实现者报告未自行核验**。修复波 `fd767952` 把过程报告 `git rm --cached`（**磁盘保留 16618 B**），改后新增文件**恰 1 个**。
   **教训**：新增文件数必须由控制者亲自 `git diff --diff-filter=A --name-only` 核，不得采信报告。
2. **「`.superpowers/` 是 gitignored」错误告知**：此前多份简报如此声明，**实测不成立**——base 已跟踪 **29** 份该类历史报告（本仓库对该目录**不做** ignore）。后续简报不得再作此声称。
3. **勘察数字勘误**：计划 §0 记 `__tests__` 88 —— 实为 `*.test.ts` = **88**（base = head，非本分支造成）；跟踪文件总数 **92**、非递归口径 **90**。三种口径 base/head 均相同，**属口径差异非漂移**。

### 七、遗留（不属 P6，交后续）

1. **CHANGELOG 缺口**：P1–P6 七期均按批准偏差禁改 CHANGELOG，**须在 M 程序整体收口时统一补记**。
2. **陈旧计数三处**（P2-B 裁定继续搁置）：`docs/user-guide.md` 的 332、`.githooks/pre-push` 注释的「262 条」、`.code-health-governance.json` 的 `selfTestSamples: 322`——实际均为 **352**（P6 后）。
3. **观察项**：模板 §8 用具体 `dark-mode` 示例行替代原占位符（同节已标注「仅为形态示范，须替换」）；`REQ-102` 为新增标识但仍是 `REQ-xxx` 形态（**未发明第二套编号**，符合 §0.1.7）。
4. **P6 不改任何反模式条目**（48 上限双向断言）；新纪律挂靠既有条目：反模式 #3（RTM 为事实源）、#10（编排者边界）与既有「平行事实源」约束（`phase-5-coding.md:238` 同族）。
