# P6（M08 拒绝知识库）任务 3 / 4 / 5 落地报告

> 分支 `feat/p6-rejection-knowledge-base`，BASE `4746ecac`。纯 Markdown 变更（零 `.ts` / 零 Schema / 零新增文件）。
> 报告行号为**变更后**文件的实际行号（`grep -n` 实测）。

## 0. 变更文件一览

| 文件 | 变更性质 | 净增行 |
| --- | --- | --- |
| `w-model-dev/references/ingestion-chunk.md` | 插入 1 个子节（`:75-95`） | +21 |
| `w-model-dev/references/phase-1-requirements.md` | 改写 1 行（`:162`）+ 插入 1 个节（`:174-192`） | +20 |
| `w-model-dev/references/command-reference.md` | 插入 1 个子节（`:392-404`） | +13 |
| `docs/skill-design-document_SSoT.md` | 插入 1 个子节（`:1376-1391`） | +16 |
| `AGENTS.md` | 改 1 处数字（`:41` 43→45） | 0 |
| `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` | 改 1 处数字（`:213` 43→45） | 0 |

`git diff -U0 | grep '^-[^-]'` 全文仅 **3 行**被删（两处计数行 + `phase-1-requirements.md:162` 旧支句），其余全部为插入 —— **零删除、零重排**。

## 1. 任务 3a：§0.1.3 五个入口读取动作 → `ingestion-chunk.md:75-95`

落点：`w-model-dev/references/ingestion-chunk.md`「REQ 入学锐利性测试」节内的新子节 `#### 需求入口读取动作（拒绝登记去重，M08）`（`:75`）。

| 计划/来源条目 | 落点 | 原文摘引 |
| --- | --- | --- |
| 动作 1「读 §8 全量」 | `ingestion-chunk.md:77` | 「**读 §8 全量**：读取 `docs/phase1-requirements/requirement-spec.md` §8 Out of Scope 的**全部**登记行（概念粒度的持久拒绝登记）。规格书尚不存在（首次进入）时本步无对象，直接继续正常 ingest。」 |
| 动作 2「概念相似度匹配（非关键词）」+ 来源同型例子 | `ingestion-chunk.md:78` | 「**按概念相似度匹配（非关键词匹配）**：……例：请求「night theme」匹配 `dark-mode`（换词不换概念，关键词匹配会漏）；「深色主题」「夜间配色」同此。」 |
| 动作 3「命中则向用户 surface」+ 固定句式 | `ingestion-chunk.md:79` | 「**命中则向用户 surface**：照固定句式报出——「与 §8 `<conceptKey>` 相似；此前因 `<拒绝理由>` 拒绝；是否仍持此见？」。」 |
| 动作 4「三选一」 | `ingestion-chunk.md:80-83` | 「**给三选一**（由用户裁定，A 子代理不得代选）：」 |
| 动作 5「判定必须口播」 | `ingestion-chunk.md:84` | 「**判定必须口播给用户**：匹配结果与用户选择**必须口播**，不得静默匹配后自行处置（不得自行 Confirm / 自行改状态 / 自行判 Disagree）。用户选择由 S 子代理写入 §8——A-chunk 不写正式阶段产物（见本文件「禁止」节）。」 |
| 未命中 → 正常 ingest | `ingestion-chunk.md:86` | 「**未命中** → 不 surface、不给三选一，正常 ingest（本动作对结论零影响）。」 |

### Confirm / Reconsider / Disagree 三支

| 分支 | 落点 | 原文摘引 |
| --- | --- | --- |
| Confirm | `ingestion-chunk.md:81` | 「**Confirm**：把本次请求标识追加进该行 `Prior requests`，**本次不再走正常 ingest**（去重生效）。」 |
| Reconsider | `ingestion-chunk.md:82` | 「**Reconsider**：该行 `状态` 改 `reconsidered` 并写替代指向，**本次走正常 ingest**（该概念重新进入范围）。」（按用户裁定改写为状态标记，**不删除**） |
| Disagree | `ingestion-chunk.md:83` | 「**Disagree**：相关但不同（是另一个概念），**本次走正常 ingest**，§8 不动（不改 `Prior requests`、不改 `状态`；确属新概念时由 S 在 §8 另开一行）。」 |

### 「不改变既有确定性分流」声明

| 要求 | 落点 | 原文摘引 |
| --- | --- | --- |
| 读取义务、非新路由、不新增 `/wm` 子命令 | `ingestion-chunk.md:90` | 「本动作**不改变 ingest 的既有确定性分流**：它是 A 子代理在入口处的**读取义务**，**不是新路由**，也不新增 `/wm` 子命令；锐利性测试、level 判定、blocked 条件与图节点提取规则全部照旧。」 |

## 2. 任务 3b：迷雾毕业第 2 支改写 → `phase-1-requirements.md:162`

| 计划条目 | 落点 | 原文摘引 |
| --- | --- | --- |
| 「判 Out of Scope」改写为「向 §8 表追加一行」 | `phase-1-requirements.md:162` | 「2. **判 Out of Scope**：**向规格书 §8 表追加一行**（概念粒度：一概念一行；`状态 = rejected`；`Prior requests` 记本次标识），即进入 §8 的**持久拒绝登记**——**永不毕业**（除非目的地重画）。与本节不变量一致：登记行**不计入覆盖矩阵分母**（仍是非正式 REQ、非图节点），且**禁止隐式消失**——§8 的登记行正是该迷雾项的显式落脚点」 |

改写前原文（`git diff` 删除行）：「2. **判 Out of Scope**：写入规格书 §8，永不毕业（除非目的地重画）」——「永不毕业」语义逐字保留。

## 3. 任务 3b：登记规则五条 + 边界句 → `phase-1-requirements.md:174-192`

新节 `### 拒绝登记规则（§8 Out of Scope，M08）`（`:174`），置于「覆盖矩阵语义」之后、「Implementation/Testing Decisions 分离」之前。

| 登记规则 | 落点 | 原文摘引 |
| --- | --- | --- |
| ① 概念粒度 | `:180` | 「**概念粒度**：一概念一行；同一概念的多个请求归并入该行的 `Prior requests`，**不另开行**。」 |
| ② `conceptKey` 唯一 | `:181` | 「**`conceptKey` 唯一**：kebab-case 概念键；节内不得重复（唯一性由门禁确定性校验）。」 |
| ③ `Prior requests` 回链（§0.1.7 既有标识体系） | `:182` | 「**`Prior requests` 回链**：逗号分隔的非空标识列表，**取本仓既有可引用标识**，按可得性优先级：`REQ-xxx`（已建图节点 id）/ 阶段轮次形态 `<轮次>-<序号>`（如 `R23-07`）/ 请求原文短引；无回链时写 `-`（显式空，不得留白）。**不得发明第二套编号体系**……」 |
| ④ 仅 rejected enhancement 入册 / 已实现者拒收 / bug 不入册 | `:183` | 「**入册范围**：**仅 rejected enhancement 入册**；**bug / 缺陷不入册**（缺陷走缺陷返工流程，登记会污染去重判据）；**已实现者拒收**……」 |
| ⑤ Reconsider = 状态标记 + 替代指向，任何情况下不删除行 | `:184` | 「**不删除行**：**Reconsider 一律改状态标记**——`状态` 由 `rejected` 改为 `reconsidered`（枚举仅此二值），并在 `拒绝理由` 列写明替代指向（`→ REQ-xxx` 或 `→ 见 §8.5`）；**任何情况下不得删除或清空既有行**……」 |
| 入口读取动作（消费方）回指 | `:188` | 「**入口读取动作（消费方）**：新需求进入时由 A-chunk 读 §8 全量 → 按**概念相似度（非关键词）**匹配 → 命中则向用户 surface 并给 **Confirm / Reconsider / Disagree** 三选一（判定必须口播）……」 |
| **边界句（必写）** | `:190` | 「**边界（必读，不得夸大）**：门禁**只校验登记结构**——§8 节存在、表头五列齐、`conceptKey` 非空且唯一、`状态` ∈ {`rejected`, `reconsidered`}、`Prior requests` 单元格非空（`-` 合法）；**「概念相似度」由入口读取动作的语义匹配承担**，确定性脚本**不校验语义**。因此「门禁通过」**不等于**「去重已发生」，两者是**结构门禁 + 语义读取**的分工，不得声称门禁校验了概念相似度。」 |
| 反模式挂靠（不新增 #49） | `:192` | 「**反模式挂靠（不新增条目，仍 48 条）**：本纪律挂靠 #3……#10……与既有「禁止平行事实源」约束（`references/phase-5-coding.md`）。」 |

同一范围（§8 表头五列 / 边界句）也写入 `command-reference.md:403` 与 `SSoT:1391`，三处口径一致。

## 4. 任务 4a：门禁契约 → `command-reference.md:392-404`

新节 `### §8 拒绝登记结构校验（M08，phase 1）`（`:392`），置于「Artifact Gate 项目阶段证据门」节内、phase 1-4 TLA/BDD 条目之后。

| 计划条目 | 落点 | 原文摘引 |
| --- | --- | --- |
| 哪条命令 | `:394` | 「**命令**：`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts <project-dir> --phase=1 --spec-dir=<dir>`。判据纯函数 = `w-model-dev/scripts/logic/gate-logic.ts` 的 `checkOutOfScopeRegister`……**增强既有脚本：不新增 CLI、不新增参数、不新增 Schema。**」 |
| 输入 | `:395` | 「**输入**：`--spec-dir=<dir>` 指向阶段 1 规格目录……**未传 `--spec-dir` 时本项不生效**（既有调用方零影响）；非 phase 1……**不施加**该组判定。」 |
| 判定 (a) | `:397` | 「(a) **§8 节缺失** → 违规（「无」也必须显式声明该节）；」 |
| 判定 (b) | `:398` | 「(b) **§8 无固定列表格** → 违规。旧散文形态（节内含 `- {{`）的消息带迁移指引……无表格的自由散文同样 fail-closed……」 |
| 判定 (c) | `:399` | 「(c) **§8 有表格** → 校验表头**五列齐**（`conceptKey` / `拒绝理由` / `Prior requests` / `状态` / `来源`）、`conceptKey` **非空且唯一**、`状态` ∈ {`rejected`,`reconsidered`}、`Prior requests` 单元格**非空**……另校验**至少 1 行数据行**……」 |
| 退出码语义（违规 → exit 1） | `:400` | 「**退出码语义**：任一 (a)(b)(c) 违规 → **exit 1**（并入既有 exit 1 语义，**不新增退出码**；输入/参数错误仍为 exit 2，不静默跳过）。」 |
| **如何读证据（审查者裁定）** | `:401` | 「**如何读证据（审查者裁定，必读）**：以 **`GATE_JSON.reasons` 中 §8 桶的计数 = 0** 判定合规——即 `reasons` 中以 `structure: §8` 开头的条目数为 0。**不得以整体退出码为据**：`check-artifact-gate.ts` 是**聚合门**，退出码是三态聚合结果，会被**无关缺件**（如 tla/bdd/uat 资产缺失、RTM 覆盖率不足）掩盖——「exit 0」不证明 §8 合规，「exit 1」也不证明 §8 违规（可能是别的原因）。」 |
| **AC-11 披露义务 / 判据强化** | `:402` | 「**判据强化披露（AC-11 义务）**：本项**不新增命令、不新增放行路径**，但**改变了「什么样的 phase-1 规格能过门」**——phase-1 规格从此**须含合规 §8 表格**，旧散文形态的 §8 不再放行；这属既有门禁的**判据强化（数据要求收紧）**，不是「门禁未变」。**不引入 legacy 时间豁免**……」 |
| 门禁只校验结构的边界 | `:403` | 「**边界（不得夸大）**：门禁**只校验登记结构**；**「概念相似度」由需求入口读取动作的语义匹配承担**……门禁通过**不等于**去重已发生——两者是**结构门禁 + 语义读取**的分工（AC-10 措辞不得被夸大）。」 |
| 失败处置（带规范短名） | `:404` | 「**失败处置**：exit 1 属普通 V/G 失败 → 先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再按 R 结论由 S-fix 补齐/表化 §8 后重跑门禁。」 |

**证据读法依据（实测）**：`gate-logic.ts` 在 `checkArtifactGate` 内把 `specStructureViolations.outOfScope` 逐条 push 进 `reasons`（`gate-logic.ts:1183-1191`），故 §8 桶 = `reasons` 中前缀 `structure: §8` 的条目集合；`GATE_JSON.reasons` 为该数组的序列化（已由任务 2 实现与 `gate-enhancement.test.ts` 63 用例锁定）。

## 5. 任务 4b：SSoT 先行落点 → `SSoT:1376-1391`

| 计划条目 | 落点 | 原文摘引 |
| --- | --- | --- |
| M08 落点与小节（SSoT 优先） | `SSoT:1376-1386` | 「#### 10.5.3 §8 拒绝登记结构校验（M08，2026-09-16）」+ 五面落点表（事实源 / 门禁 / 入口读取动作 / 登记规则 / 门禁契约文档） |
| 不新增 Schema / 不新增 CLI / 不改 RTM | `SSoT:1388` | 「**零面承诺（D7 确认的可证形式）**：**不新增 Schema**（`w-model-dev/schemas/**` 零变更，尤其**不改 `rtm.schema.json`**）、**不新增 CLI**（`cli/*.ts` 46 不变、exit-2 45 不变）、**不改 `rtm.json` 字段或关系**（D7 负向约束）、**不新增 `.w-model/*.json`**、**不升版本号**、**反模式仍 48 条**（不新增 #49）。」 |
| 能力分工（不得夸大） | `SSoT:1389` | 「**能力分工（不得夸大）**：门禁**只校验登记结构**……**「概念相似度」由入口读取动作的语义匹配承担**，确定性脚本**不校验语义**。「门禁通过」**不等于**「去重已发生」……」 |
| AC-11 披露 | `SSoT:1390` | 「**判据强化（AC-11 披露义务）**：本机制**不新增命令、不新增放行路径**，但**改变了「什么样的 phase-1 规格能过门」**……**不引入 legacy 时间豁免**……」 |

## 6. 任务 5：陈旧 exit-2 计数清偿（两处，只改数字）

| 位置 | 改动 | 原文摘引（改后） |
| --- | --- | --- |
| `AGENTS.md:41` | `43` → `45` | 「**完整 exit-2 脚本 45 清单见 §8「脚本导航表」与 [subagent-delegation.md](w-model-dev/references/subagent-delegation.md) §6 权威登记表**」 |
| `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md:213` | `exit2ScriptCount: 43` → `45` | 「**一切新增/增强的脚本与 Schema 都必须同步** `check-docs-consistency` 的联动计数器（`exit2ScriptCount: 45` / `schemaCount: 34` / `runLogActionCount: 27` / `prePushCount: 18` / `maxAntiPattern: 48` / 资产计数）与 dispatch-matrix 登记表。」（该行判据文本**一字未动**，仅数字变更） |

- `AGENTS.md:22`「45 个脚本」维持不变，与 `:41` 现已一致（两处 grep 实测 = 45/45）。
- **未**触碰其他已裁定搁置的陈旧计数：`docs/user-guide.md` 332 / `.githooks/pre-push` 注释 262 / `.code-health-governance.json` `selfTestSamples: 322`（按 P2-B 裁定继续搁置）。

### gate-count 自查（`gateCountLiveDocs`，白名单含 `AGENTS.md`）

```
$ grep -n "门禁\|检查" AGENTS.md | grep -oE "[0-9]+ 项" | sort | uniq -c
      3 18 项
```

三条均 == 18（`prePushCount`），**零违规**；本次改的是「N **清单**」（无「项」），未误伤 gate-count 规则。

## 7. 验证实测输出

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| L0 链接审计 | `npm run audit:l0-links` | `L0_LINK_AUDIT_JSON {"passed":true,...,"relativeLinkCount":672,"l1OnlyCount":95,"templatePlaceholderCount":36,"violations":[],"exitCode":0}` —— **exit 0，672/95/36 未变，无需重基线**（新内容一律用反引号纯文本引用，零新增相对链接） |
| 安全扫描 | `npm run lint:security` | `新增发现数 : 0` / `✓ 无新增安全风险` |
| 守卫子集 | `npx vitest run --config config/vitest.config.ts` × {examples-contract, asset-budget, l0-link-audit-logic, skill-metadata, gate-enhancement} | `Test Files 5 passed (5)` / `Tests 142 passed (142)` |
| 标题零删改 | `diff <(git show HEAD:<f> \| grep '^#') <(grep '^#' <f>)` | 6 个文件全部仅**新增 1 个标题**（`ingestion-chunk.md:75` / `phase-1-requirements.md:174` / `command-reference.md:392` / `SSoT:1376`），`AGENTS.md` 与规格文件标题序列完全相同；**零删除、零重排** |
| 删除行审计 | `git diff -U0 \| grep -E '^-[^-]'` | 仅 3 行（两处计数行 + `phase-1-requirements.md:162` 旧支句），其余全为插入 |
| 计数不变 | `ls` | `cli=46 schemas=34 refs=43`（与 BASE 同）；未新增 `.ts`/Schema/文件 |
| 工作区 | `git status --porcelain` | 6 个 ` M`（即本报告所述 6 文件）+ 未跟踪的 `.superpowers/sdd/2026-09-16-p6-rejection-kb/`（工作笔记目录） |

## 8. 零面与边界声明

- **零新增文件 / 零 `.ts` / 零 Schema / 零依赖 / 零 LLM 调用**；未改 `rtm.schema.json`（D7）；未升版本号；反模式仍 48（未新增 #49）。
- **未跑**：`npm run prepush`、全量 `check-docs-consistency.ts`、任何 `.md` 的 prettier（`.md` 不在 prettier 面内，不作为验证项）。
- **能力边界（如实申明）**：本批文档落地的门禁**只校验 §8 登记结构**；**概念相似度语义匹配由 A-chunk 入口读取动作承担**，确定性脚本不校验语义——**不得**表述为「门禁校验了概念相似度」（AC-10 措辞未被夸大）。
- 未引用第二套编号体系：`Prior requests` 回链标识体系照 §0.1.7 取既有可引用标识（`REQ-xxx` / `<轮次>-<序号>` / 请求原文短引）。
