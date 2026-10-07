# 批次 8：文档与协议一致性（43.2.0）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 销账主规格 §7 全部（单一事实源修复 / 协议口径修正 / 计数与覆盖 / 资产质量 / 如实化标注）+ 增量规格 §3 三项（subagentSpawns 门禁化、C19 三类易残留锚点、ai-native-sdlc:134）+ 批次 7 执行期登记的 10 项后续 riders。

**架构：** 文档级收敛为主（双副本→单点+指针、编号重排、口径统一），机制级仅两处（subagentSpawns 门禁化、eval runner 覆盖断言扩展）；人格去栈化为 36 文件机械重写（frontmatter 四字段与 persona-capability-declarations 门禁保持绿）。版本 43.2.0。

**技术栈：** TypeScript + tsx、vitest 三 project、ajv draft-07、tla2tools（Java 17）、self-test、pre-push 19 项。

**规格：** 主规格 `2026-10-06-w-model-remediation-design.md` §7 + 增量规格 `2026-10-07-remediation-leftovers-design.md` §3；riders 来源 = 批次 7 执行账本的「批次 8 候选」清单（逐项注明）。

**执行纪律（每任务适用）**：预期超 6 分钟的命令一律 run_in_background（全量 vitest ≈25 分钟）并轮询；前台只跑聚焦测试/self-test/typecheck/eval/grep/单次真机 TLC；不要跑 prepush（任务 18 除外）；每完成一个阶段往报告文件追加几行。**行号均为编写时点参考（HEAD=42620669），以内容定位为准。**

---

## 文件结构（创建/修改的主要文件及职责）

| 文件 | 职责 | 任务 |
| --- | --- | --- |
| `w-model-dev/references/data-models.md` | subagentSpawns 口径段；EdgeType 12 类对齐（C15） | 2, 14 |
| `w-model-dev/schemas/budget.schema.json` | `perPhase.maxSubagentSpawns` 回归（A5 删除的字段使约束成真） | 2 |
| `w-model-dev/scripts/logic/budget-logic.ts` + `cli/check-budget.ts` | Σ(subagentSpawns, 按阶段) > 阈值 → blocking | 2 |
| `w-model-dev/SKILL.md` | C3 双副本收敛；C7 资源计数补接线率；步骤 8 `--prev-status` 接线 | 3, 6, 16 |
| `w-model-dev/references/subagent-delegation.md` | C10 §0 三重收敛；C11 拆分预算口径；C12 S 模板；§6.1 `--prev-status` | 3, 5, 16 |
| `w-model-dev/references/verifier-spec.md` | C8 §4.2.1 编号重排 + §0/速查双表收敛；C9 R10 XML 权威保留点 | 4 |
| `w-model-dev/references/root-cause-locator.md`、`command-reference.md`、`agent-personas.md`、`docs/skill-design-document_SSoT.md` | C9 R10 XML 四处改指针；C13 规则 #3 改指针 | 4, 5 |
| `w-model-dev/references/hard-constraints.md` | C7 接线率写入对应节；C18 反模式分级标注 | 6, 10 |
| `docs/INSTALL.md` | C20 检出内跑门禁 + cp 排除 node_modules | 6 |
| `.githooks/pre-push` | C5 注释 60→68 | 6 |
| `docs/changes/decision-log/rounds-50-*.md` | C6 round23 矛盾登记（归档不改写） | 7 |
| `w-model-dev/references/event-ingress-guide.md`、`hill-climbing-guide.md` | Loop 3/4 成熟度头部标注 | 7 |
| `w-model-dev/subagent/*.md`（36 个） | C17 去栈化（工程类 / 其余四类两批） | 8, 9 |
| `eval/mappings.json` + `eval/runner.ts` | C19 45 个 references 全覆盖 + 三类易残留锚点 + subagentSpawns 锚点 + runner 覆盖断言 | 11, 12, 13 |
| `w-model-dev/references/evidence-anchored-tree.md`、SSoT §10L | R15b 子项表补「pending 未核验」（rider） | 14 |
| `docs/ai-native-sdlc-adoption.md` | :134 行头中性命名 | 14 |
| `w-model-dev/references/tla-plus.md` | Example 5 fairness 强化（rider，真机验证） | 15 |
| `w-model-dev/scripts/logic/tla-logic.ts`、`bdd-logic.ts` | riders：空转析取窗口/extractTlaDefBody 边界 | 15 |
| `w-model-dev/scripts/logic/evidence-export-logic.ts` | rider：文本面脱敏边界 | 16 |
| `w-model-dev/references/operational-recovery.md` | `--prev-status` 调用表接线（rider） | 16 |
| `w-model-dev/scripts/samples/...`、`config/...security-baseline.json` | riders：测试补齐 + baseline 失效条目清理 | 15, 16 |

---

### 任务 1：基线验证

- [ ] **步骤 1**：在批次 7 合入后的 main 上开分支：

```bash
cd "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" && git checkout main && git checkout -b fix/batch8-docs-consistency && git log --oneline -1
```

- [ ] **步骤 2**：`npm run --silent typecheck && npm run --silent self-test 2>&1 | tail -1 && npm run --silent eval && npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 预期全绿（typecheck 0 / 412 / 68 通过且覆盖矩阵通过 / 0 违规）。任一非绿停下修基线。

---

### 任务 2：subagentSpawns 门禁化（决策 5）

**文件：** `references/data-models.md`（口径段）、`schemas/budget.schema.json`（字段回归）、`logic/budget-logic.ts` + `cli/check-budget.ts`（新规则）、测试、fixtures。

- [ ] **步骤 1：口径定义**——`data-models.md` 在 run-log 字段口径区（约 :443 一带）补段：「`subagentSpawns` = run-log 记录自报的本记录触发的子代理分派数；**estimated=true 记录不计入**聚合」（estimated 语义以 schema 现状为准——先核实 `run-log.schema.json` 是否仍有 estimated 概念；若 A5 已使其违规化/移除，口径简化为「Σ 按阶段」并在报告写明裁定）。
- [ ] **步骤 2：schema 回填**——`budget.schema.json` 恢复 `perPhase.maxSubagentSpawns`（非负整数，description 写明「43.2.0 使约束成真：A5 曾按零消费死字段删除（eacc8d6a），本版 check-budget 消费之」）；required 名单同步（对照 A5 删除前形态：`git show eacc8d6a^:w-model-dev/schemas/budget.schema.json` 取原字段形态）。
- [ ] **步骤 3：失败测试**（先写，RED）：①某阶段 Σ subagentSpawns 超 maxSubagentSpawns → blocking；②未超 → 零违规；③estimated 记录不计入（按步骤 1 裁定口径）；④无 perPhase.maxSubagentSpawns 的 budget → 不触发（可选字段包容）。
- [ ] **步骤 4：实现**——budget-logic 纯函数（IO 注入形态）+ check-budget 消费 `--run-log`（复用既有接线）；恢复 A5 删除的对应测试（`git show eacc8d6a^` 取原测试形态）并补新规则用例；fixtures 回填（samples/budget 或 samples/run-log 形态对齐）。
- [ ] **步骤 5**：聚焦测试 + self-test（后台+轮询）+ docs-consistency + eval → Commit `feat(budget)!: perPhase.maxSubagentSpawns 回归并成真——Σ 阶段分派数超限 blocking（决策#5，43.2.0）`

---

### 任务 3：单一事实源修复 I——C3 + C10

**文件：** `SKILL.md`、`references/subagent-delegation.md`。

- [ ] **步骤 1：C3 双副本收敛**——SKILL.md 现 :90（「编排者-子代理边界」节内含完整五门序列与参数形态）与 :101（执行工作流第 8 步）为同一「三步+五门」内容的两个版本，最长逐字公共串 143 字符。**保留 :90 侧完整版为唯一权威**（含五门各自参数形态），:101 第 8 步改写为一行指针（「阶段门放行三步的权威表述与五门参数形态见『编排者-子代理边界』节；分派细则见 subagent-delegation.md §6.3」）；grep 确认无第三处复述。
- [ ] **步骤 2：C10 subagent-delegation §0 收敛**——现存在三块加载说明：:9「### 0. 按阶段分节加载导引」（新表）、:442-452 旧 §0 块（触发场景表，dispatch-matrix 并入时的残留）、:454-465「## 加载导引」。**收敛为一处**：:9 保留为唯一 §0（若 :442 旧表的触发场景维度有独立价值，并入 :9 表为增补列/行），:442 与 :454 两处删除或改为一行指针。
- [ ] **步骤 3：C10 §2 时序标注**——:84 现「> 本图为精简时序…以本文正文…全版图为准」→ 按主规格口径补「（摘要，权威=正文）」措辞（或等价限定语，语义为「本节为摘要，权威为正文全版图」）。
- [ ] **步骤 4：验证 + Commit**——docs-consistency 0 违规 + eval 全绿 + grep 复核双副本已收敛（C3 公共串计数、C10 加载说明处数）→ `docs(skill): SKILL.md 三步五门收敛单点 + subagent-delegation §0 三重收敛（C3/C10）`

---

### 任务 4：单一事实源修复 II——C8 + C9

**文件：** `references/verifier-spec.md`、`references/root-cause-locator.md`、`references/command-reference.md`、`references/agent-personas.md`、`docs/skill-design-document_SSoT.md`。

- [ ] **步骤 1：C8 编号重排**——verifier-spec §4.2.1（:310）清单编号实测 1-4 后跳到 8-13（5/6/7 缺失）。重排为连续编号（1-N 顺延，**不发明新条目**），并全文核对引用该清单条号的位置同步更新（grep「4.2.1」与「§4.2.1」引用点）。
- [ ] **步骤 2：C8 双表收敛**——§0 导引表（:3-13）与速查摘要的「按场景只读 §X」表（:42-54）为同一「场景→章节」映射两份（速查另增 self-as-verifier/§15 两行）。**收敛为一处**：保留 §0（文件头导引，约束 #6 形态）为唯一场景表，速查中的该表删除或改为一行指针，独有的两行并入 §0 表；速查其余内容保留。
- [ ] **步骤 3：C9 R10 contract XML 单点**——实测全仓**五处**全文副本（verifier-spec §7.5 :795-801、root-cause-locator :254-261、command-reference :228-234、agent-personas :795-801、SSoT :1672-1678；规格登记之外多出三处）。**权威 = verifier-spec §7.5 保留全文**，其余四处改为一行指针（「R10 contract XML 权威定义见 verifier-spec §7.5」+ 各自的消费语境一句话）；SSoT 处用引用+说明（SSoT 保留设计语境，不复制 XML）。
- [ ] **步骤 4：验证 + Commit**——docs-consistency 0 违规 + eval 全绿 + grep 复核（`<r10-contract` 全文出现处 = 1；双表处数 = 1）→ `docs(verifier): §4.2.1 编号重排 + §0/速查双表收敛 + R10 contract XML 五处收敛单点（C8/C9）`

---

### 任务 5：协议口径修正——C11 + C12 + C13

**文件：** `references/subagent-delegation.md`、`SKILL.md`、`references/command-reference.md`。

- [ ] **步骤 1：C11 拆分预算口径**——现 :628-636「任务拆分预算」含「产出文件 ≤ 3 个」通用上限；改为「**单一产出类型 + 类型内文件数由该产出类型的契约定义**」（引用既有契约：阶段 1 七文件契约 phase-1-requirements.md:274、S-doc 拆分档 :958-975 等），删除无条件「≤3」。
- [ ] **步骤 2：C12 S 模板修正**——:790-791 输入产物「（已附）」→ 指针措辞（与 :594「O（指针型，非内容）…路径列表」一致）；S 模板段（:781-810）补「模型档位：<显式指定，不得省略>」字段（对齐 V :818 / R :1150 / R-lead :1396 既有形态）。
- [ ] **步骤 3：C13 最小引用集统一**——SKILL.md:96「只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件」为权威；command-reference:18 规则 #3 的差异表述（+ rtm-guide.md）改为指针（「最小引用集权威见 SKILL.md『…』节」）或按 SKILL.md 对齐（同一事实，不重复维护）；subagent-delegation :67/:685 的复述核对同步。
- [ ] **步骤 4：验证 + Commit**——docs-consistency + eval → `docs(protocol): 拆分预算改产出契约定义 + S 模板指针措辞与模型档位 + 最小引用集单点（C11/C12/C13）`

---

### 任务 6：计数与安装——C7 + C20 + C5

**文件：** `references/hard-constraints.md`、`SKILL.md`、`docs/INSTALL.md`、`.githooks/pre-push`。

- [ ] **步骤 1：C7 接线率披露**——hard-constraints「与门禁脚本的对应关系」节（:356-402）补接线率说明：**强制接线率 = 放行链 8 + 阶段专属 12 = 20/47（≈43%）**——放行链 8 分解写实（五门 §6.1 五门 :341-345 + 常驻三门 :351-354；subagent-delegation 侧）；SKILL.md 资源计数（:148 与 :123）同步一句。数字须与 subagent-delegation §6.1/§6.3 实际枚举一致（写前逐个核对脚本名）。
- [ ] **步骤 2：C20 INSTALL 两条**——§3 安装命令（:88-96）补「cp 时排除 `node_modules`」提示（示例命令加 `--exclude`/说明）；§3.1 或 §4 挑明「门禁脚本必须在仓库检出内运行（需 node_modules 与 Java 等平台依赖），Skill 拷贝到 Agent 目录仅为提示词侧安装，不能在其上跑门禁」。
- [ ] **步骤 3：C5 注释同步**——`.githooks/pre-push:495` 注释「60 条触发边界语料」→ 68（与 mappings.json 现状一致；eval/README 已无 60 残留，核对一遍）。
- [ ] **步骤 4：验证 + Commit**——docs-consistency + eval + `npm run prepush` 不跑（本批任务 18 统一）；grep 复核 20/47 数字来源链条 → `docs(counts): 接线率 20/47 披露 + INSTALL 检出内跑门禁与排除 node_modules + pre-push 注释 60→68（C7/C20/C5）`

---

### 任务 7：如实化标注——C6 + Loop 3/4 成熟度

**文件：** `docs/changes/decision-log/rounds-50-*.md`（新建）、`docs/changes/decision-log/README.md`、`references/event-ingress-guide.md`、`references/hill-climbing-guide.md`。

- [ ] **步骤 1：C6 round23 归档矛盾登记**——事实：`docs/changes/archive/2026-07-30-round23-.../README.md:45-48` 记 `check-artifact-gate`/`check-requirement-graph --phase=4`/`check-tla-model --phase=4`/`check-bdd-model --phase=8` 为 pending，而同目录 `checkpoint-summary.md:25-32` 记四门 exit 0/630 tests/RTM 100%——两文互斥。**归档不改写**：在 decision-log 新建 rounds-50 文件登记该矛盾（现象/两处引文/裁定「以 checkpoint-summary 为准、README 为 staged 视图残留」或如实存疑）+ README 表行。
- [ ] **步骤 2：Loop 3/4 成熟度头部标注**——`event-ingress-guide.md`（:1-10）与 `hill-climbing-guide.md`（:1-8）头部各加一行标注：「**成熟度：文档协议，无运行时执行器**（本指南定义协议与判据；执行由 Agent 按协议进行，仓库不含自动执行器）」。
- [ ] **步骤 3：验证 + Commit**——docs-consistency + eval → `docs(rounds-50): round23 归档矛盾登记 + Loop 3/4 成熟度标注（C6）`

---

### 任务 8：人格去栈化 I——engineering 类（C17）

**文件：** `w-model-dev/subagent/engineering-*.md`（13 个；逐个核对实际清单）。

- [ ] **步骤 1：清单与残留盘点**——列出 engineering 类全部文件，逐个 grep 特定技术栈残留（`Laravel|Livewire|FluxUI|Three\.js|React|Vue|Angular|PostgreSQL|MySQL|Supabase|PlanetScale|Rails|Spring|Django|Next\.js|```python|```typescript|```php|npm |pip |artisan` 等）。
- [ ] **步骤 2：去栈化改写**——逐文件：frontmatter 四字段（capabilities/inputs/outputs/boundaries）与正文中**特定技术栈命令与叙事**改为栈中立表述（如「Laravel/Livewire 集成需求」→「框架集成需求」；具体命令示例→通用形态或删除）；**保留** frontmatter 结构与四字段契约、通用纪律与角色职责。
- [ ] **步骤 3：门禁核验**——`persona-capability-declarations` 检查（docs-consistency 内）保持绿；grep 复核 engineering 类栈关键词清零（白名单：文档用途说明中的通用技术词如「数据库」不在此列——以具体产品/框架/命令名为准）。
- [ ] **步骤 4：验证 + Commit**——docs-consistency + eval → `docs(personas): engineering 类人格去栈化（C17 批一）`

---

### 任务 9：人格去栈化 II——testing/design/product/project 类（C17）

**文件：** `w-model-dev/subagent/`（其余约 23 个文件；testing-reality-checker / testing-api-tester 等已知含残留）。

- [ ] **步骤 1-3**：同任务 8 流程（盘点 → 改写 → 门禁核验）。
- [ ] **步骤 4：全量复核 + Commit**——全 36 文件栈关键词 grep（39 个文件的并集口径：具体产品/框架/命令名）；docs-consistency + eval → `docs(personas): testing/design/product/project 类人格去栈化（C17 批二，36 文件全量核验）`

---

### 任务 10：反模式分级标注（C18）

**文件：** `references/hard-constraints.md`。

- [ ] **步骤 1：分级判据设计**——在反模式节头部补一句分级判据：「**通用** = 跨项目、跨技术栈成立的流程纪律；**项目教训化石** = 源自特定项目/技术栈的具体教训，作为化石保留（标注后可泛化使用）」。
- [ ] **步骤 2：逐条标注**——48 条逐条通读分级：明确的技术栈/项目特定项（如 #22 角色越权（authRequired/requiredRole 具体代码形态）、#24 副作用时序（响应体具体形态）、#25 PowerShell ConvertTo-Json 写入）按判据标注「项目教训化石」；其余标「通用」。判据边界有争议的条目在报告中列出你的裁定与理由。字面操作最小化：不重写条目文本，加分级标记（表列或前缀，形态自定但全节一致）。
- [ ] **步骤 3：验证 + Commit**——docs-consistency + eval → `docs(anti-patterns): 48 条按泛化度分级标注（通用/项目教训化石，C18）`

---

### 任务 11：C19-a——runner 覆盖断言扩展 + 三类易残留锚点 + subagentSpawns 锚点

**文件：** `eval/runner.ts`、`eval/mappings.json`。

- [ ] **步骤 1：runner 覆盖断言**——现有 coverageMatrix 五项（①route/category 对齐 ②route 总数 ③类别下限 ④guide 示例数 ⑤负向守卫）**不含 references 文件覆盖**。新增第 ⑥ 项：**45 个 references 文件全覆盖断言**（从 `w-model-dev/references/*.md` 枚举实况文件集，映射的 assertions/evidence 路径并集须覆盖之；差集非空 → exit 1）。先写该断言（此时差集 32 项 → RED，作为本任务与任务 12/13 的驱动）。
- [ ] **步骤 2：三类易残留锚点映射**（批次 6 终审实证「非锚点行的级联残留逃过全部既有门禁」，语料锚点化=结构性封堵）：
  - ① `signature-chain-guide.md:15` D-1 行（`targetKind` 入哈希 v3）→ 新增映射（route 从既有三分法择一，断言含该行关键短语）；
  - ② `superpowers-adoption.md:126` action 词表行（32→18 权威 enum 指向）→ 新增映射；
  - ③ `docs/loop-engineering-adoption-design.md:338/363/386/647` 退役注记行（`unlockConditions` 已随 A4 移除）→ 新增映射（**注意该文件在 docs/ 不在 references/**——runner 的路径断言机制须支持 docs/ 锚点，若不支持则在 runner 层扩展锚点根目录并在报告说明）；
  - ④ subagentSpawns 新锚点（任务 2 的口径段：`data-models.md` 口径行 + budget.schema 字段）→ 新增映射。
- [ ] **步骤 3：routeTotals/minPerCategory 同步**——新增映射后重算 route 三分量并更新 `routeTotals`；核对 guide 节示例数断言（④）与新增语料的联动（activation-guide 是否需要同步——以 runner 断言实况为准，需要则一并改并说明）。
- [ ] **步骤 4：验证 + Commit**——`npm run eval` 绿（①-⑤ 全过 + ⑥ 差集缩减为 29±）；self-test 若依赖 eval 计数同步 → `test(eval): references 覆盖断言 + 三类易残留锚点与 subagentSpawns 锚点（C19 批一）`

---

### 任务 12：C19-b——补映射至全覆盖（一）

**文件：** `eval/mappings.json`（+ `eval/runner.ts` 按需）。

- [ ] **步骤 1：映射撰写**——为 ⑥ 差集中的**前 16 项** references 文件各写 1-2 条映射（含 graph-guide / rtm-guide / signature-chain-guide 剩余锚点已由任务 11 覆盖的不重复；phase-1/2/3/4/6/7-* 六个阶段文档、quality-standards、quick-self-check、quickstart、root-cause-locator、data-models、conventions、coding-quality、concurrency-guide、estimation-guide、context-management-guide、toolbox 等）。每条：scenario（真实使用场景描述）+ layer + route（三分法）+ assertions（`contains`/`notContains`/`fileExists` 指向该文件的具体锚点行）+ evidence。
- [ ] **步骤 2：质量要求**——断言锚点须为**承重行**（关键判据/权威口径），非标题或泛句；负向 route 类别满足 ⑤ 守卫；route 分布不得使 category 数跌破 minPerCategory。
- [ ] **步骤 3：验证 + Commit**——`npm run eval` 绿（⑥ 差集 ~13）；routeTotals 同步 → `test(eval): references 覆盖补映射批一（16 项，C19 批二）`

---

### 任务 13：C19-c——补映射至全覆盖（二）+ 计数同步

**文件：** `eval/mappings.json`、`eval/README.md`、`eval/runner.ts`（如需）。

- [ ] **步骤 1：映射撰写**——剩余差集（~13 项）补齐至 **45/45 全覆盖**；runner ⑥ 断言绿。
- [ ] **步骤 2：计数同步**——mappings 条目数（68 → 68+N）在 `eval/README.md` 各计数句（:7/:8/:39/:69）与 `description` 字段同步；`.githooks/pre-push` 若引用条目数同步（任务 6 已改的 68 若因本批再度变化则再同步）；self-test/相关测试若引用 eval 计数同步。
- [ ] **步骤 3：验收（批次级）**——`npm run eval` 全绿 + 覆盖 45/45 + `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 0 违规（增量规格 §6 批次 8 专项复跑= eval 全绿 + docs-consistency）→ Commit `test(eval): references 覆盖补映射批二至 45/45 全覆盖 + 计数同步（C19 批三，43.2.0 验收核心）`

---

### 任务 14：C15 + R15b 表 + ai-native:134（+C19 收尾核对）

**文件：** `references/data-models.md`、`references/evidence-anchored-tree.md`、`docs/skill-design-document_SSoT.md`、`docs/ai-native-sdlc-adoption.md`。

- [ ] **步骤 1：C15 边类型对齐**——`data-models.md:174-189` 的 `export type EdgeType` 代码块现为 9 类，与 :1004「12 类」声明及 `logic/graph-logic.ts:21-38`（12 类，多 `precedes`/`conflicts-with`/`cross-cuts`）不符 → 补齐为 12 类并与实现逐名一致。
- [ ] **步骤 2：R15b 子项表**（rider）——`evidence-anchored-tree.md:56` 与 `SSoT:2282` 的 R15b 行（现「`evidenceStatus` 非法（缺失或不在枚举内）」）补「pending 未核验（放行前阻断；豁免 ruleId=R15b）」语义（43.1.0 A12 变化）；两处同构同步。
- [ ] **步骤 3：ai-native:134**——划界表行头「sigHash v2 vs evidence provenance」→ 中性命名「签名链哈希 vs 证据 provenance」（行内正文同步核对：v3 口径）。
- [ ] **步骤 4：验证 + Commit**——docs-consistency + eval（若 mappings 引用了上述文件锚点，一并核对） → `docs(models): EdgeType 12 类对齐 + R15b 表补 pending 语义 + 划界表中性命名（C15/rider/ai-native:134）`

---

### 任务 15：形式化 riders 收口

**文件：** `references/tla-plus.md`、`scripts/logic/tla-logic.ts`、`references/bdd.md`、`scripts/__tests__/tla-logic.test.ts`、`config/...security-baseline.json`。

- [ ] **步骤 1：Example 5 fairness 强化（rider，批次 7 T4 后续）**——tla-plus.md Example 5（Elevator）的 `FairSpec == Spec /\ WF_Vars(Next)` 下 `CallsServiced` 属性被 TLC 判违反（批次 7 探针 C 实证，反例经 ReverseDirection 弹跳）→ 强化公平性为**按动作 WF 组合**（对 ProgressDirection/StopAtFloor/BoardPassenger 等推进动作各加 WF_Vars），使属性可满足；**真机验证**：逐字提取 Example 5 文本重建工作区，`SPECIFICATION FairSpec` + `PROPERTIES CallsServiced` 下 TLC 零违反（提取脚本+日志落盘），并在文档注释中更新指引（含「属性成立与否由 TLC 判定」限定语的最终形态）。
- [ ] **步骤 2：空转析取窗口收口（rider，批次 7 T7 复审）**——`checkIdleNext` 对「全恒等 + 无撇号纯守卫」析取分支的误报窗口（`Next == Idle \/ Guard`，Idle 恒等、Guard 无赋值）：按批次 7 复审建议，对顶层 `\/` 析取或整块括号形态走**保守 pass**（不误报优先）；补测试（该形态零违规 + 既有形态零回归）。
- [ ] **步骤 3：extractTlaDefBody 边界 + 单测（rider，批次 7 T3/T13b）**——①把 body 内缩进 `H == x > 0`（LET 体）视为续行或仅列 0 起始为顶层边界（消除提前截断的假阴性面）；②补该函数直接单测（含 `Inv==2`/元字符名/缩进 LET 体/多行合取四形态），把批次 7 的差分 harness 收编为测试。
- [ ] **步骤 4：bdd §3.4.2 口径 + 边界测试补齐（riders）**——①`bdd.md` §3.4.2 已知限制注对 Outline 例证加限定「（Outline 块体当前不被解析，此项为口径说明）」；②`tla-logic.test.ts` 补 combo=1001 边界与空 variables 数组用例。
- [ ] **步骤 5：baseline 失效条目清理（rider，T13b③）**——`config/...security-baseline` 中 `wm-status-logic.ts` 的失效条目（line 125，hash `352edefd…`）清理（若手工删除则跑 lint:security 确认仍 exit 0）。
- [ ] **步骤 6：验证 + Commit**——真机 TLC（步骤 1）+ 聚焦测试 + self-test（后台+轮询）+ docs-consistency + eval → `fix(tla/bdd): Example 5 公平性强化（真机零违反）+ 空转析取窗口收口 + 提取器边界与单测 + 口径与边界补齐（批次 7 riders）`

---

### 任务 16：脱敏文本面 + 接线 riders 收口

**文件：** `scripts/logic/evidence-export-logic.ts`、`SKILL.md`、`references/subagent-delegation.md`、`references/operational-recovery.md`、`references/verifier-spec.md`（normalizeEol 词）。

- [ ] **步骤 1：脱敏文本面边界（rider，批次 7 终审范围外观察）**——`.md/.log/.txt` 与 JSON **字符串值**的脱敏路径（`sanitizeSensitiveAssignment` / `isSensitiveCell`）仍为「整键规范化精确相等」；实测 `refresh_token: abc` 文本形态不脱敏而 `token: abc` 脱敏。改造两处复用 `isSensitiveKey`（含驼峰切分）；补测试（`refresh_token: abc` / `refreshToken: abc` / `passwordPolicy: {...}` 文本形态脱敏；`mytoken:`/`token_count:` 零误伤守卫）。注意保守代价（passwordPolicy 文本形态同样脱敏）与 NEGATIVE-COVERAGE 登记同步。
- [ ] **步骤 2：`--prev-status` 接线（rider，批次 7 T9②）**——三处调用面补参数形态：①`SKILL.md` 步骤 8 五门序列的 `check-maturity.ts` 行（或权威表述处）注明「放行时随 `--run-log` 一并传 `--prev-status=<上一状态>`（若 project.json 无历史则省略）」；②`subagent-delegation.md` §6.1 该行同步；③`operational-recovery.md` 调用时机表 :472 行同步。`--rollback-approved` 单独给出（无 prev-status）时补非阻断诊断（批次 7 T9 Minor②），加测试。
- [ ] **步骤 3：normalizeEol 措辞（rider，T2②）**——`verifier-spec.md`/schema 的 sha256 描述补「文本产物」限定（既有「归一化内容（CRLF→LF）的 SHA-256」→ 加一词明确适用文本产物）。
- [ ] **步骤 4：验证 + Commit**——聚焦测试 + self-test + docs-consistency + eval → `fix(evidence/protocol): 文本面脱敏复用 isSensitiveKey + --prev-status 三处接线与诊断 + 措辞限定（批次 7 riders）`

---

### 任务 17：版本 43.2.0 + CHANGELOG + 决策日志

**文件：** `package.json`、`package-lock.json`、`w-model-dev/skill-metadata.json`、`w-model-dev/SKILL.md`、`README.md`、`docs/INSTALL.md`、`CHANGELOG.md`、`docs/changes/decision-log/rounds-50-*.md`、SSoT。

- [ ] **步骤 1**：`npm version 43.2.0 --no-git-tag-version` + 七处镜像同步（skill-metadata version+updatedAt=2026-10-07）。
- [ ] **步骤 2**：CHANGELOG 43.2.0 节——Changed：文档/协议收敛（C3/C8/C9/C10/C11/C12/C13/C15/C17/C18/C20）；Breaking：subagentSpawns 门禁成真（含 A5→43.2.0 字段回归来龙去脉）；Feat：eval 覆盖 45/45 + 三类易残留锚点；Fixed：批次 7 riders（fairness/空转析取/文本面脱敏/接线等）；计数影响（mappings 68→68+N、self-test 若变化）；验证记录 prepush 占位。**样式纪律：不写未跑测的「全绿」断言**（批次 7 T14 教训——占位语只写「待任务 18 回填」；耗时数字只写可核验来源）。
- [ ] **步骤 3**：rounds-50 追加本批裁定（C17 分级判据、C9 五处收敛扩张、C6 矛盾登记引用等——rounds-50 文件在任务 7 已建，此处追加）+ decision-log README 表行 + SSoT §10T（或 §10R/§10S 之后新节，按体例）追加批次 8 bullet + §10A 追溯行。
- [ ] **步骤 4**：`check-docs-consistency` + eval → Commit `chore(release): 43.2.0——批次 8 文档与协议一致性 + subagentSpawns 门禁化`

---

### 任务 18：prepush + 专项复跑收口 + 终审 + 合入

- [ ] **步骤 1**：`npm run --silent prepush`（19 项单次全绿；**后台+轮询**，记录实测耗时）。
- [ ] **步骤 2：专项复跑（增量规格 §6：批次 8 = eval 全绿 + docs-consistency 全绿）**——①`npm run eval` 覆盖 45/45；②`check-docs-consistency` 0 违规；③批次 7 回归探针不退化抽测（恒真不变式/空转 Next 各一例 + C1 豁免出口 e2e）；④demo 三门复跑（资产未动，应仍 3/3）。
- [ ] **步骤 3**：CHANGELOG 回填实测耗时；销账核对（主规格 §7 的 15 C 项 + 增量 §3 三项 + riders 10 项逐项勾销）→ Commit `docs(plans): 批次 8 收口——prepush 全绿 + 专项复跑（43.2.0 终）`
- [ ] **步骤 4**：终审宽范围审查（控制者分派）→ 合入 main → 汇报后进入批次 9 计划编写。

---

## 自检记录

1. **规格覆盖度**：主规格 §7 全部（C3/C5-C13/C15/C17-C20）↔ 任务 3-14；增量 §3 三项（subagentSpawns 门禁化=任务 2；C19 三类易残留锚点=任务 11；ai-native:134=任务 14）↔ ✓；批次 7 账本 riders 10 项 ↔ 任务 14/15/16（逐项有辖）。
2. **计数口径说明**：主规格 §7 头注「15 项」（含 C15）与增量 §5 表「14 项」差在 C15 归属——本计划将 C15 纳入（任务 14），实际销账 15 C 项 + 2 增量 + 10 riders。
3. **占位符扫描**：无待定/TODO；不确定项（estimated 语义、runner ⑥ 的 docs/ 锚点支持）均给出「先核实现状→按裁定落地→报告写明」的明确动作。
4. **类型一致性**：`maxSubagentSpawns`（任务 2 全程）、runner 覆盖断言（任务 11-13 驱动同一 RED→GREEN）、`isSensitiveKey` 复用（任务 16）跨任务一致。
5. **样式经验**：任务 17 步骤 2 内置批次 7 的 CHANGELOG 教训（不预写未跑测结论）。
