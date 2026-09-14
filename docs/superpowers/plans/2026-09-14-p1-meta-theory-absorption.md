# P1 元理论层内化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把两个外部技能仓库中"如何写技能资产"与"如何按失败类型写规则"的元理论，内化成 W-model 自己的 L0 规则资产，使 48 条反模式有可复算的表述判据、技能资产的编写与剪枝有可观测判据与数字阈值。

**架构：** 纯 L0 文档改动，零新增脚本、零新增 Schema、零新增运行时依赖。新建 1 份 `references/asset-authoring.md` 承载 M01+S03+S04；在既有 4 份资产（`SKILL.md` / `hard-constraints.md` / `subagent-delegation.md` / SSoT）内就地补判据；同步 3 处既有注册点（SKILL.md 计数、README 目录树注释、subagent-delegation 触发表）与 1 处既有门禁基线（`l0-baseline.ts`）。

**技术栈：** Markdown 技能资产；验证依赖仓库既有确定性门禁（`tsx` + vitest + `check-docs-consistency` + `audit-l0-links`）。不引入任何新工具链。

---

## 全局约束（每个任务都适用，逐字遵守）

**裁定约束**（来源：`docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md` §10.2，已获用户同意）

1. **D-1**：48 条反模式**主表述不得整批改写**。只新增"失败类型 → 指令形式"分流判据与两条硬子规则。全量改写的前置是本地 A/B 出证据，**已执行且未支持改写**，故本计划不得触碰 `| 1 |`~`| 48 |` 任何一行的描述、危害、正确做法三列。
2. **D-5**：不得为 `/wm` 引入任务级轻量路由；`check-artifact-gate.ts --phase=N` 的强制边界不变。
3. **D-3**：拒绝知识库（M08）属 P6，本计划不得新建目录或 `/wm` 子命令。
4. **D-6**：worktree 内禁止写 `.w-model`；本计划全程只在 worktree 内改文档，**不产生任何 `.w-model/` 写入**。

**既有架构不变式**（来源：`AGENTS.md` §6 / `w-model-dev/SKILL.md`）

5. **不引入 LLM 调用**：技能包内任何文件都不得直接调用 LLM。
6. **SSoT 优先**：改设计决策先改 `docs/skill-design-document_SSoT.md`，再同步 `w-model-dev/` 资产。
7. **脚本自包含**：`w-model-dev/scripts/cli/*.ts` 不得 `import` 任何 `src/` 或外部业务模块。
8. **devDep 纪律**：只允许 `ajv` / `ajv-formats` / `eslint-plugin-security` / `tsx` / `typescript` / `vitest`。本计划不得新增任何依赖。
9. **退出码约定**：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。门禁结果以脚本退出码为准，**不得用 LLM 估算**。
10. **`wm-write` 排他**：`.w-model/*.json` 写入统一走 `wm-write.ts`。本计划不写该目录。
11. **零绕门**：不得用"任务小"为由跳过任何门禁或 CHECKPOINT。

**本计划的硬性编辑边界**

12. **计数契约不可变**：`hard-constraints.md` 反模式节必须同时保留主清单表区间内的 `| 48 |` 行与 `#1~#48` 连续区间字符串（`check-docs-consistency.ts` 的 `checkAntiPatterns` 校验）。`EXPECTED` 常量（`maxAntiPattern: 48` / `exit2ScriptCount: 43` / `schemaCount: 34` / `runLogActionCount: 27` / `prePushCount: 18`）**一个都不许改**。
13. **反模式表插入位置禁令**：`checkAntiPatterns` 把"主清单表区间"定义为 **表头行 → 其后第一个标题行**。**严禁在表头行与 `| 48 |` 行之间插入任何 `#` 标题**，否则 `| 48 |` 落到区间外直接判违规。
14. **新 references 文件必须先注册**：`checkReferencesCount` 用正则 `/（(\d+) 个 \.md）/` 从 `w-model-dev/SKILL.md` 解析计数并与实测比对。当前实测 **42** 份，新增 1 份后必须同步为 **43**，否则门禁 exit 1。
15. **L0 链接计数基线**：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` 钉死 `{ relativeLinkCount: 666, l1Only: 93, placeholders: 36 }`，由 `l0-link-audit-logic.test.ts` 与 `l0-link-audit-cli.test.ts` 对**真实技能包**断言。**任何增删相对链接的改动都必须重基线**：跑 `npm run audit:l0-links` 取 `L0_LINK_AUDIT_JSON` 的三个真实数字写回该文件，并按文件头既有注释风格追加一行变更说明。这是该门禁的既定工作流（文件头已写明"rebaseline 流程"），不是违规。
16. **技能包内链接不得逃出包根**：`checkSkillOutboundLinks` 拒绝 `resolved === '..' || resolved.startsWith('../')`。`references/*.md` 内**不得**写 `../../docs/...` 之类的仓库根链接；引用仓库根文档（含 `docs/superpowers/sources/` 的 vendor 摘录）一律用**纯文本路径**，不写成 Markdown 链接。
17. **`examples-contract.test.ts` 会扫描全部 references 语料**：`GUIDANCE_CORPUS_FILES` 由 `markdownFiles('w-model-dev/references')` 动态构造，所以**新写的每一段文字都会进入这些扫描**：① 失败路由绕行扫描（不得出现"失败即返回/返工"而无 `普通 V/G 失败链` 标记的表述）；② 不得出现直接 R→S-fix 绕行；③ 可复制的 `/wm test` 命令必须带 `result=pass|fail` 有界取值；④ 段落级 failure-guidance 扫描。**写完必须实跑该测试文件确认，不得凭推理判定。**
18. **格式门禁不覆盖 Markdown**：pre-push 的 prettier 检查只覆盖 `w-model-dev/scripts/**/*.ts`、`config/**/*.{cjs,ts}`、`scripts/*.cjs`，Markdown 不受格式门禁约束。但若本计划改动了 `l0-baseline.ts`（.ts），则该文件必须 `npm run format` 后仍通过 `npx prettier --check`。
19. **不升版本号**：`package.json` / `skill-metadata.json` / `SKILL.md` frontmatter / README / INSTALL 五处版本镜像（`skill-metadata.test.ts` 断言一致）本计划**不动**；版本号是发布动作，不属于 P1。
20. **证据标记纪律**：S 源的两条量化主张（S01 `:31` 的"禁令臂劣于无指引对照"、S25 的"50/50 运行零失败"）**无随仓可复核证据**，写入本仓库时必须显式标注为**未验证假设**，不得作为既定事实陈述（源：设计 spec §4.1 边界、§2.3 元规则）。

**每任务的通用验证纪律**

21. 每个任务收尾必须实跑该任务"预期"节列出的命令，并把**真实输出**贴进报告文件；不得以推理代替运行。
22. **两级验证（成本分摊，不是跳门禁）**：
    - **任务级（快，每个任务都跑）**：① 该任务点名的 vitest 测试文件，命令形如 `npx vitest run --config config/vitest.config.ts <文件...>`；② `npm run audit:l0-links`（exit 0 且 violations 为 `[]`）；③ **静态计数自查**：`ls w-model-dev/references/*.md | wc -l` 的输出必须等于 `w-model-dev/SKILL.md` 里 `（N 个 .md）` 声明的 N。
    - **P1 级（慢，只在任务 8 跑一次）**：`npm run prepush`（18 项门禁，含全量 vitest 与 coverage 阈值）。
23. **`npm run check:docs-consistency` 为何不在任务级跑**：该命令独立运行时**没有** pre-push 提供的 `WM_VITEST_COUNT_FILE` 等环境变量，会**自行 spawn 整个 vitest 套件**（实测十余分钟）。pre-push 的第 14 项门禁在**同一批测量**上跑它（复用第 12 项的 JSON），因此**任务 8 的 `npm run prepush` 已完整覆盖该门禁**。任务级不得因"快"而放宽任何判据，只是不在每个任务重复触发那次全量 spawn；若某任务的正确性**只**由该命令能判定（如 `anti-patterns` / `ssot-headings` 结构断言），也必须等任务 8，且**任务 8 一旦红，回到对应任务修**。

---

### 任务 1：新建 `references/asset-authoring.md` 并完成注册（M01 + S03 + S04）

**信号：** 技能资产编写元理论（no-op test / 渐进披露阈值 / 授权不写）本仓库缺失。
**影响文件：** 3 个（新建 1 + 注册 2）。**说明**：其中 `l0-baseline.ts` 是门禁基线的机械同步（约束 15），不是独立设计信号；三者必须在同一任务内完成，否则中间态门禁必红。

**文件：**
- 创建：`w-model-dev/references/asset-authoring.md`
- 修改：`w-model-dev/SKILL.md:130`（计数 42 → 43）+ 加入指向新文件的指针链接
- 修改：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts:20-22`（重基线三个数字）

**内容权威来源（逐字依据，已在仓库内）：** 本节全部规则文本的原文依据是 `docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md` 的 `## M01 资产编写杠杆`（该文件 L11-87）、`docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md` 的 `## S03`（L114-183）与 `## S04`（L185-202）。**这些是纯文本路径引用，不得在产出文件里写成 Markdown 链接**（约束 16）。

- [ ] **步骤 1：写新文件。** 用中文写成仓库原生规则，**必须**含以下 13 个小节，且内容与三个 vendor 节一一对应（不得新增源文没有的机制，不得遗漏源文给出的数字）：

  1. **适用范围与自我适用**——本节规则同时约束 `SKILL.md` / `references/` / `templates/` 的编写与评审；本文件自身也必须满足其数字阈值（自证）。
  2. **两种负载**——context load（常驻上下文成本）vs cognitive load（人的索引成本，不是要最小化而是要在人的判断有价值处花费）；只经指针到达的材料以"指针自身一行"的代价免除 context load。
  3. **信息层级阶梯**——in-file step（主层）/ in-file reference（按需查阅，扁平同级集合不坏）/ disclosed reference（推出文件、经指针到达）。
  4. **渐进披露判据（分支判据）**——最干净的披露判据是分支：每个分支都要的**内联**，只有部分分支到达的**推到指针之后**；披露不足顶部臃肿，披露过度藏起 agent 真正需要的材料。
  5. **数字阈值（S03，权威数值）**——`SKILL.md` body < 500 行；接近上限即拆文件；**> 100 行**的参考文件必须拆出；**< 50 行**的代码/内容保持内联；引用**只允许一层深**（嵌套引用会导致 agent 用 `head -100` 预读而非完整读文件）；**> 100 行**的参考文件顶部加目录；目标词数：getting-started 工作流 < 150 词 / 高频加载技能 < 200 词总计 / 其他 < 500 词。
  6. **跨文件/跨角色引用约定**——用显式要求标记（`**REQUIRED SUB-SKILL:**` / `**REQUIRED BACKGROUND:**`）而非含糊的"参见"；**禁止 `@` 深链**，理由是 `@` 立即强加载、在任何需要之前就烧掉 200k+ 上下文。
  7. **指针措辞（context pointer）**——指针的**措辞**（而非其目标）决定 agent 何时到达材料以及到达的可靠性；必须有的目标配弱措辞的指针是**方差缺陷**，先磨措辞，磨不动才内联；三条剪枝：leading word 前置 / 每分支只留一个触发（同义改写是同一分支写两遍）/ 删掉正文已承载的身份。
  8. **leading word**——已经活在模型预训练里的紧凑概念，作为**token 重复**而非句子重复，累积出分布式定义；自造词不招募先验（要用定义 token 付费），优先用既有词；示例：把"fast, deterministic, low-overhead"收成 _tight_，把"a loop you believe in"收成 **_red_**（模糊门 → 二值可观测状态）。
  9. **完成判据（completion criterion）与 premature completion 防御顺序**——两个属性：**clarity**（能否区分"做完了"与"没做完"；含糊的界会诱发 premature completion）与 **demand**（要求多少，"每一个被修改的 model 都要交代" > "产出一份变更清单"）；防御**按序**：先磨界（局部且便宜），只有当界不可约地模糊**且**观察到抢工时才用"拆序列把后续步骤藏起来"，而藏只在**真实上下文边界**（交接或子代理分派）上有效——内联调用不清理任何东西。
  10. **co-location**——一个概念的**定义 / 规则 / 注意事项放在同一标题下**，而非散落；判据：文档应当读起来像"为 agent 写的文档"。与重复不同：重复是把一个含义写在两处，散落是把一个含义碎在多处。
  11. **pruning 四刀**——① 单一事实源（一个含义一个权威位置）；② 环境也是事实源（`package.json` scripts / 配置文件 / 目录布局 / `--help` 输出），复述环境即**缓存**，只在查询昂贵时才配得上负载（缓存"看也看不出的约定、选择背后的理由、没有配置会承认的坑"）；③ relevance（每一行是否仍与文档要做的事相关；不 pruning 的默认归宿是 **sediment**：因为"加安全、删危险"而沉积的过期层）；④ 逐句猎 no-op。
  12. **no-op test（可观测判据）**——判据是**行为性的**："删掉这一行，agent 的行为是否改变？"；该判据是**模型相对**的，不是读者相对的（两个人对 no-op 有分歧，其实是两人对"默认行为"有分歧，用**跑文档**而不是辩论来裁定）；某句不过关时**删整句**，而不是从句子里修剪词；该测试同样给 leading word 评级——弱到打不过默认的词（agent 本已 thorough-ish 时写 _be thorough_）就是 no-op，修法是换**更强的词**（_relentless_），不是换技术。
  13. **授权不写（no-guidance control，S04）**——行为塑造类指引的**准入闸**：先取一个不写该指引的对照，"**如果对照没有表现出该失败，就没有要修的东西——停下，不要写这条指引**"；已完成的行为塑造类指引须做措辞微测（**≥5 次重复**，且**每一条被判命中的匹配都人工读过**），纯 reference 类技能不适用此条。

- [ ] **步骤 2：写文件头与目录。** 文件开头加一节元信息（机制来源、两位来源与 commit、本文件自证满足 < 500 行），并在正文前加**目录**（本文件必然 > 100 行，受约束 5 的自证要求）。文件末尾加一节**自检清单**，至少含：number 阈值是否满足 / 每个指针是否有清晰措辞与单一触发 / 是否有句子通不过 no-op test / 是否存在 sediment（过期层）。文件引用来源时按约束 16 用纯文本路径。

- [ ] **步骤 3：确认文件规模。** 运行：`wc -l w-model-dev/references/asset-authoring.md`
  预期：> 100 行（故必须有目录）且 **< 500 行**（约束 5 的上限，本文件自证）。

- [ ] **步骤 4：注册计数。** 把 `w-model-dev/SKILL.md:130` 的资源计数行从 `` `references/`（42 个 .md） `` 改为 `` `references/`（43 个 .md） ``，其余部分（`schemas/` 34 份、门禁脚本 44 个 .ts）逐字不动。

- [ ] **步骤 5：注册指针。** 在 `w-model-dev/SKILL.md` 的「门禁契约与资源清单」节内加入一条指针链接，措辞按约束 7 写成"必须有的目标 + 清晰措辞"（例：`- **技能资产编写**：写或评审 \`SKILL.md\`/\`references/\`/\`templates/\` 前必读 [references/asset-authoring.md](references/asset-authoring.md)（no-op test、渐进披露阈值、授权不写）。`）。措辞必须让"何时该读"可判定，不得写成"另见 X"。

- [ ] **步骤 6：重基线 L0 链接计数。** 运行：`npm run audit:l0-links`
  预期：exit 0，`L0_LINK_AUDIT_JSON` 的 `violations` 为 `[]`。读出 `relativeLinkCount` / `l1Only` / `templatePlaceholderCount` 三个真实数字（新文件内部链接 + SKILL.md 新指针会让 `relativeLinkCount` 增大）。
  **只有 exit 0 才能继续**；若 violations 非空，先修链接（多半是逃出包根），不得直接改基线掩盖。

- [ ] **步骤 7：把三个真实数字写回基线。** 改 `w-model-dev/scripts/__tests__/helpers/l0-baseline.ts:20-22`，并按该文件既有注释风格在 `relativeLinkCount` 上方追加一行说明（格式：`// <新值> = <旧值> + <增量>（2026-09-14 P1 Task 1：新增 references/asset-authoring.md 的 N 条同目录链接 + SKILL.md 指针 1 条；由 npm run audit:l0-links 实测 rebaseline，violations 仍 0）。`）。

- [ ] **步骤 8：跑定向门禁。** 依次运行，逐项确认：
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts w-model-dev/scripts/__tests__/l0-link-audit-cli.test.ts` → 全通过
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts` → 全通过（约束 17）
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）（含 `references-count` 与 `linkDocs` 内链存在性；注意此命令独立运行会自行 spawn 全量 vitest，耗时较长）
  - `npm run format` 后 `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts"` → exit 0（约束 18，因改了 `l0-baseline.ts`）

- [ ] **步骤 9：Commit。**

```bash
git add w-model-dev/references/asset-authoring.md w-model-dev/SKILL.md w-model-dev/scripts/__tests__/helpers/l0-baseline.ts
git commit -m "feat(references): add asset-authoring rules (M01+S03+S04) and register them"
```

---

### 任务 2：同步 references 计数与触发表（2 处既有注册点）

**信号：** 新增 1 份 references 后，两处"42 份"的既有表述过期（sediment 类型缺陷，受任务 1 本节的 no-op/relevance 判据约束，属真实缺陷）。
**影响文件：** 2 个。

**文件：**
- 修改：`README.md:196`（目录树注释 `# 42 份阶段细则与规范` → `43 份`）
- 修改：`w-model-dev/references/subagent-delegation.md:130` 与 `:132`（`42 份 .md` → `43 份 .md`），并在 §3.1 触发表内新增一行 `asset-authoring`

- [ ] **步骤 1：改 README 目录树注释。** `README.md:196` 的 `# 42 份阶段细则与规范（按需加载，禁止一次性全读）` 改为 `43 份`，括号内语义逐字保留。**不得**改动该行之外任何内容（`checkDoDDimensions` 与 `skill-metadata.test.ts` 都读 README）。

- [ ] **步骤 2：改触发表计数。** `w-model-dev/references/subagent-delegation.md:130`（标题 `### 3.1 全 references 触发条件表（42 份 .md，无 stub；行按主题组织）`）与 `:132`（`> \`references/\` 目录共 42 份 .md（无 stub——...）`）两处的 `42` 改为 `43`。`:132` 中"42.0.0 的合并已就地完成"里的 `42.0.0` 是**版本号**，**不得改**——这是本步骤最容易误伤的地方，改完必须肉眼复核该行。

- [ ] **步骤 3：加触发表行。** 在 §3.1 表内按既有列格式（文件 / 内容 / 跳数）新增一行 `asset-authoring`，内容列写"技能资产编写杠杆 + 渐进披露数字阈值 + 授权不写（no-op test / 指针措辞 / pruning 四刀）"，跳数列为 `1 跳`。触发器语义须与该表其他行一致。

- [ ] **步骤 4：跑定向门禁。**
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）（`references-count` 读的是 SKILL.md，本任务动的是另外两处；此命令顺带校验这两份文档的内链存在性）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts w-model-dev/scripts/__tests__/skill-metadata.test.ts` → 全通过

- [ ] **步骤 5：Commit。**

```bash
git add README.md w-model-dev/references/subagent-delegation.md
git commit -m "docs(references): sync the references count to 43 and add the asset-authoring trigger row"
```

---

### 任务 3：`SKILL.md` description 改为"只写 when"（S02）

**信号：** 现网违规——`w-model-dev/SKILL.md:4-11` 的 description 概括了工作流（"ask whether to use the W-model first"是行为指令）并带了否定链（`Do NOT use for ...` 十类）。外部事故链证据：description 概括工作流会让 agent **照着 description 做而不读技能正文**（源：`docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md:60-71`，含"description 写 code review between tasks 导致 agent 只做 1 次评审，而流程图要求 2 次"的因果记录）。
**影响文件：** 1 个。

**文件：**
- 修改：`w-model-dev/SKILL.md:4-9`（frontmatter `description`）

- [ ] **步骤 1：替换 description。** 把 `SKILL.md:4-9` 的 description 替换为（逐字）：

```yaml
description: >-
  Use when the user invokes /wm, mentions W-model, W 模型 or W 开发模型, requests
  requirements traceability (RTM), stage gates, quality gates, or development and
  testing in parallel, or asks for an end-to-end / complete development process.
  Trigger boundaries, anti-scenarios and the handling of ambiguous requests are
  defined in references/activation-guide.md.
```

- [ ] **步骤 2：自查三条禁令。** 确认新 description：① 不含 `Do NOT use for ...` 一类**否定链**（M02：整句否定会把被禁行为拖入上下文）；② **不概括工作流/过程**（不得出现"先询问是否采用""按 N 阶段推进"一类过程描述）；③ 仍以 `Use when` 开头且含具体触发信号。被删掉的两段语义**不丢失**——它们已在 `SKILL.md`「触发决策」表第 2/3 行（`只说"完整流程"... → 先询问`）与 `references/activation-guide.md` 中，本任务**不修改**这两处。

- [ ] **步骤 3：确认没有别处逐字复制旧 description。** 运行：`grep -rn "one-off scripts, styling fixes" --include=*.md --include=*.ts --include=*.json . | grep -v node_modules`
  预期：无命中（若有命中，说明有文档镜像了旧文案，须同步为新语义；**skill-metadata.json 的 description 字段若存在也须同步**）。

- [ ] **步骤 4：跑定向门禁。**
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/skill-metadata.test.ts` → 全通过（该测试断言 name/version 一致，不约束 description；本任务不得动 `version:`）
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）

- [ ] **步骤 5：Commit。**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs(skill): make the description name when-to-use only (S02)"
```

---

### 任务 4：`hard-constraints.md` 新增"失败类型 → 指令形式"分流判据（M02 + S01）

**信号：** 48 条反模式只有"不要做 / 危害 / 正确做法"三列，没有"该用哪种指令形式"的判据；照 S01 的证据，**对"形状错/漏必填项"类失败用禁令会反噬**。
**影响文件：** 1 个。

**文件：**
- 修改：`w-model-dev/references/hard-constraints.md`（反模式节内新增一个 `###` 子节）

**内容权威来源（逐字依据）：** `docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md` 的 `## S01`（L11-41，含四行对照表原文与两条硬子规则）与 `## M02`（`docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md` L88-97，否定式表述的危害）。**纯文本路径引用，不写成 Markdown 链接**（约束 16）。

- [ ] **步骤 1：定插入位置（**先做且必须正确**）。** 打开 `w-model-dev/references/hard-constraints.md`，确认结构是：`### 反模式清单`（表头在 L186）→ 48 行表格 → `### 命中高发阶段`（L237）→ 阶段表。
  **插入位置（唯一口径）：** 紧接 `| 48 |` 行（L235）**之后**、`### 命中高发阶段`（L237）**之前**，作为**同级 `###` 子节**。**严禁**把新子节插到 L186 表头与 `| 48 |` 行（L235）之间——`checkAntiPatterns` 的主清单表区间是"表头 → 其后第一个标题行"，中间插标题会让 `| 48 |` 掉出区间（约束 13）。按本口径落地时，主清单表区间 = 表头 → 新子节标题，`| 48 |`（L235）仍在区间内，门禁保持绿灯。

- [ ] **步骤 2：写新子节。** 加入 `### 反模式表述形式：按失败类型分流`，内容包含四部分：
  1. 一句话立意：写指引前**先分类基线失败**，对一种失败类型"防弹"的形式在另一种上会**可测地反噬**。
  2. 四行对照表（表头：基线失败 / 正确形式 / 错误形式），逐字对应 S01 的四行：压力下明知故犯 → 禁令 + rationalization 表 + 红旗信号（错：软指引"prefer / consider"）；**遵循了但输出形状错** → 正向 recipe 或契约（说明输出**是什么**，按序列出它的部件）（错：禁令清单"don't restate / never narrate"）；**漏掉已产出物里的必填元素** → 结构性：把必填字段/槽位放进他们本来就要填的模板（错：模板旁边的散文提醒）；**行为应当取决于某条件** → 以**可观测谓词**为键的条件句（错：无条件规则 + 豁免子句）。
  3. 两条硬子规则（逐字对应 S01）：**No nuance clauses**——"Don't X unless it matters"重新打开谈判，真实例外必须写成以可观测谓词为键的独立条件句；**Exemption clauses don't scope**——"该限制不适用于代码块"仍会压制代码块，必须重构到规则够不着它。
  4. **接地说明（必写）**：① 本仓库 48 条的**主表述本轮不改写**，理由三重（规则自洽 / 对照臂未复现失败 / 量化证据缺失），依据 `docs/superpowers/specs/2026-09-14-d1-local-ab-evidence.md` §5.3；② S01 源文声称"禁令臂产出劣于无指引对照（分布完全分离）"属**未验证假设**——该量化排序在 S 源中**无随仓可复核证据**，且本地 A/B 因 treatment×metric 混淆**未能裁定**，故本仓库只采纳其**形状判据**（可自证），不采纳其量化排序（约束 20）。

- [ ] **步骤 3：守住计数契约。** 自查：`grep -c "^| [0-9]* |" w-model-dev/references/hard-constraints.md` 的行数关系未变；`grep -n "#1~#48" w-model-dev/references/hard-constraints.md` 仍有命中；`| 48 |` 仍在主清单表区间内（跑门禁验证，勿凭肉眼）。
  同时 `grep -n "48 条" w-model-dev/references/hard-constraints.md` 的所有既有表述**保持不矛盾**（新子节说"本轮不改写主表述"，与"48 条反模式"的总数陈述不冲突）。

- [ ] **步骤 4：跑定向门禁。**
  - **本任务的关键门禁可在任务级廉价实跑**（复刻 `checkAntiPatterns` 的完整判据，读**真实文件**，不 spawn 全量 vitest）：运行

    ```bash
    node -e "const t=require('fs').readFileSync('w-model-dev/references/hard-constraints.md','utf8');const H='| # | 反模式（不要做） | 危害 | 正确做法 |';const i=t.indexOf(H);const tail=i<0?'':t.slice(i);const m=tail.search(/\r?\n#{1,6} /);const main=m<0?tail:tail.slice(0,m);const stale=['#1~#29','#1~#19','#1～#29','#1～#19'].filter(s=>t.includes(s));console.log(JSON.stringify({headerFound:i>=0,has48InMain:main.includes('\n| 48 |'),hasRange48:t.includes('#1~#48'),staleRangesPresent:stale}))"
    ```

    预期输出：`{"headerFound":true,"has48InMain":true,"hasRange48":true,"staleRangesPresent":[]}`。
    三个常量与判据的权威定义：`w-model-dev/scripts/logic/docs-consistency-logic.ts:234`（`ANTI_PATTERN_MAIN_TABLE_HEADER`）、`:245`（`STALE_RANGES`）、`:221`（`EXPECTED.maxAntiPattern = 48`）、`:1318/:1327`（两条断言）。**任一为 false 或 stale 非空即门禁必红**，必须回步骤 1 调整插入位置。注意新子节的文字**不得**出现 `#1~#29` / `#1~#19` / `#1～#29` / `#1～#19` 这四个过时区间串。
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts` → 全通过（新文字进入语料扫描，约束 17）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` → 全通过

- [ ] **步骤 5：Commit。**

```bash
git add w-model-dev/references/hard-constraints.md
git commit -m "docs(hard-constraints): add failure-type -> instruction-form routing (M02+S01)"
```

---

### 任务 5：SSoT §3.5 补"机械约束→自动化"判据（S05）

**信号：** L0/L1 边界目前**既**由文档定义**又**由 `audit:l0-links` 机械判定，但 SSoT §3.5 没有写明"哪部分归脚本、哪部分归文档"的分工判据，导致文档可能复述机械判定（S05：能用正则/校验强制的就自动化，文档只留判断题）。
**影响文件：** 1 个。

**文件：**
- 修改：`docs/skill-design-document_SSoT.md` §3.5（`### 3.5 L0/L1 链接边界（交付分层导航规则）`，L426-428）

- [ ] **步骤 1：读现状。** 读 `docs/skill-design-document_SSoT.md:426-428`，确认该节当前内容是：L0 目录清单 + "L0 中指向 `scripts/`/`samples/`/`tools/` 的相对链接统一为 L1-only 导航" + 审计入口 `npm run audit:l0-links [-- --root=<skill-root>]`（只读，exit 0/1/2）+ "本节是该边界的权威定义；INSTALL §2 与 w-model-dev 侧描述均以本节为准"。

- [ ] **步骤 2：追加分工判据段。** 在该节末尾追加一段（不新增标题、不删除既有句子，避免动 `checkSsotHeadings` 的结构断言）：

  > **机械判定与判断题的分工**：能被正则 / 计数 / 存在性机械判定的部分**一律由 `audit:l0-links` 执行**（链接是否存在、是否逃出包根、是否命中 `scripts/`、`samples/`、`tools/` 这三类 L1-only 目标、占位符是否合法），文档**不得**把这部分复述成需要人来核对的规则；本节只保留**判断题**——分层的**归属判据**（哪些目标属于 L0、哪些属于 L1-only）以及"链接检查结论不得表述为『L0 全链接通过』"这类**语义约束**。新增 L0/L1 边界规则时，先问它能否被脚本判定：能则加进审计实现，不能才写进本节。

- [ ] **步骤 3：措辞与命令一致性自查。** 新段落里出现的命令与路径必须与 SSoT 该节既有文本**逐字一致**（`npm run audit:l0-links [-- --root=<skill-root>]`、`w-model-dev/scripts/application/audit-l0-links.ts`）；不得引入新的命令名或新脚本（否则会与 `checkScriptRegistry` / dispatch-matrix 登记表冲突）。

- [ ] **步骤 4：跑定向门禁。**
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）（该门禁含 `ssot-headings` 与 `ssot-architecture-boundaries` 两项 SSoT 结构校验）
  - `npm run audit:l0-links` → exit 0，`violations` 为 `[]`（本任务只改 SSoT，不在技能包内，不应改变链接计数；若 `relativeLinkCount` 变了说明误改了 L0 文档，须回退）

- [ ] **步骤 5：Commit。**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): define the mechanical-vs-judgment split for the L0/L1 boundary (S05)"
```

---

### 任务 6：`subagent-delegation.md` 补调用分类与跨阶段交接写法（M15）

**信号：** 本仓库有"按需加载"契约但**没有"调用分类"与"跨阶段交接必须写成显式动作句"的书写规则**；外部证据（M15）指出裸命令式提及与跨目录深链会降低命中率、且把交接意图藏在含糊措辞里。
**影响文件：** 2 个。

**文件：**
- 修改：`w-model-dev/references/subagent-delegation.md`（新增 `###` 子节）
- 修改：`w-model-dev/SKILL.md`（在既有"编排者-子代理边界"节加一句指针/一句话规则；若加链接须重基线，见步骤 5）

**内容权威来源：** `docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md` 的 `## M15 调用分类与跨阶段交接写法`（L627-654）。**纯文本路径引用**（约束 16）。

- [ ] **步骤 1：写调用分类段。** 在 `subagent-delegation.md` 新增 `### 调用分类：人类入口 vs 模型可达`，按 M15 的分类落成 W-model 的对应物：
  - **人类入口（user-invoked）**：只能由人显式发起的入口。本仓库唯一实例是 `/wm` 命令本身。人类入口的**描述文本面向人**（一行摘要即可，去掉触发清单）。
  - **模型可达（model-invoked）**：模型或人都能到达的资产。本仓库实例是全部 `references/*.md` / `templates/` / `subagent/*.md`——它们**只能经指针**（`SKILL.md` 的触发条件表、`subagent-delegation.md` §3.1）到达。模型可达资产的描述文本**面向模型**，保留丰富触发措辞（"当用户…时"），以便自动命中。
  - **判定问题**：该资产是否会被模型**自主**需要？需要则模型可达并必须有清晰指针；不需要则不要给它指针，避免污染按需加载契约。

- [ ] **步骤 2：写跨阶段交接写法段。** 同节追加 `### 跨阶段与跨角色交接的书写规则`，落成三条**硬规则**（对应 M15 的证据）：
  1. **依赖必须写成显式动作句**：交接写"分派 S 子代理产出 X，输入为 `<路径>`，产出落到 `<路径>`"，**不写**裸命令式提及（如仅出现 "见 references/xxx.md" 或 "/wm test"），也**不写** `../other/FILE.md` 式跨目录深链。
  2. **一个动作一个接收者**：需要两个角色/两个动作时写两句（"先派 R 定位，再派 S 修复"），不写成"请 A 和 B 一起处理"——后者会被读成一次调用承担两件事（M15 原证据：Skill 工具一次只接一个技能）。
  3. **人类入口不可被模型代达**：当某步骤的前置是**人类入口**（如 `/wm` 本身、CHECKPOINT 确认）时，必须写成"告诉用户执行 X"，**不得**写成"由子代理调用 X"（否则命中反模式 #8 越过 CHECKPOINT / #10 编排者越权）。

- [ ] **步骤 3：在 SKILL.md 加一句规则指针。** 在 `w-model-dev/SKILL.md`「编排者-子代理边界」节末尾（该节现有末句为"细则（S 拆分、self-as-verifier 模式、只读脚本例外、dispatch-matrix 总览）见 [references/subagent-delegation.md](references/subagent-delegation.md)。"）追加：`跨阶段/跨角色交接与调用分类的书写规则见 [references/subagent-delegation.md](references/subagent-delegation.md)「调用分类」与「跨阶段与跨角色交接的书写规则」两节；交接必须写成显式动作句，人类入口不得由子代理代达。`
  **注意**：该句含 1 条指向 `subagent-delegation.md` 的链接；若该链接是**新增**（不是复用既有链接），必须走步骤 5 的重基线。

- [ ] **步骤 4：自查不与既有契约冲突。** 确认新段落：① 不引入任何新命令或新脚本（`checkScriptRegistry` 读 `subagent-delegation.md` 的 dispatch-matrix 节，**改动不得触及该节**）；② 不与 §3.1 触发表重复（调用分类讲的是"谁可达"，触发表讲的是"何时加载"）；③ 不新增 `.w-model` 写入或状态字段。

- [ ] **步骤 5：跑定向门禁（含可能的重基线）。**
  - `npm run audit:l0-links` → exit 0。若 `relativeLinkCount` 与任务 1 写入的基线不同，按约束 15 的流程重基线（跑实测 → 写回 `l0-baseline.ts` → 加一行注释说明）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts w-model-dev/scripts/__tests__/l0-link-audit-cli.test.ts` → 全通过
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）（含 `script-registry`：`subagent-delegation.md` 必须仍含 dispatch-matrix 权威登记表）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts` → 全通过

- [ ] **步骤 6：Commit。**

```bash
git add w-model-dev/references/subagent-delegation.md w-model-dev/SKILL.md
# 若步骤 5 触发了重基线，一并加入：
# git add w-model-dev/scripts/__tests__/helpers/l0-baseline.ts
git commit -m "docs(delegation): add invocation classes and cross-phase handoff wording (M15)"
```

---

### 任务 7：安装/快速开始的单一权威文案纪律（M16）

**信号：** 安装与快速开始的命令序列在 README 与 AGENTS.md 里被**复述**；复述块会过期（外部事故记录：M 源安装块曾整体过期，处理方式是**删除而非修正**）。
**影响文件：** 2 个。

**文件：**
- 修改：`README.md`（消除 **README 内部**的两处命令块重复：L40-51 的快速开始块 与 L162-163 的命令块）
- 修改：`AGENTS.md`（把 L67-68 的字面命令块改为指向权威块；顺带在 §2 的 `references/` 行补 `asset-authoring`）
- 修改：`docs/INSTALL.md`（§5 的「触发条件摘要」4 条改为指向 `references/activation-guide.md`；并修正 §5 节标题）
- **文件数说明（3 个，属规格授权）**：设计 spec §3.1 给 M16 指定的落点就是 `README.md` / `docs/INSTALL.md` / `AGENTS.md` **三个文件**，故本任务的 3 文件是规格要求的，不是越界（`skillopt-adoption.md` 的"单信号 ≤2 文件"是对自发信号的启发式裁剪，规格点名落点优先）。

- [ ] **步骤 1：定权威块并写声明。** 先读三处现状：`README.md:40-51`（快速开始）、`README.md:162-163`（命令注释块）、`docs/INSTALL.md` §3（标准安装）、`AGENTS.md:62-80`（仓库验证与安装两入口）。**权威分工如下，写进被改文件的注释或小节导语**：
  - **Skill 安装** 的单一权威 = `docs/INSTALL.md`（§2 前置条件 + §3 标准安装）。
  - **仓库验证**（`npm install` / `npm run self-test` / `npm run doctor`）的单一权威 = `README.md` 的快速开始块。
  两者**互不复述**：说是"Skill 安装"就指向 INSTALL，说是"仓库验证"就以 README 快速开始为准。

- [ ] **步骤 2：README 内部去重。** 把 `README.md:162-163` 的两行命令块改为**指向快速开始块**的一行（例：`# 仓库验证命令见上文「快速开始」；此处不重复命令，避免两处过期`），或直接删除该重复块并保留其所在列表的语义。**保留** `README.md:44-45` 的快速开始块作为权威（它是人类入口）。**不得**改动 README 中 DoD 相关内容与"当前版本 X.Y.Z"字样（`checkDoDDimensions` 与 `skill-metadata.test.ts:50-58` 分别依赖）。

- [ ] **步骤 3：AGENTS.md 去复述。** 把 `AGENTS.md:67-68` 的字面命令块（`git clone ...` + `Set-Location ...; npm install; npm run self-test; npm run doctor`）替换为指向 `docs/INSTALL.md` §3 的**显式动作句**（按任务 6 新立的书写规则：写成"按 [docs/INSTALL.md](./docs/INSTALL.md) §3 标准安装"这类可执行指引），**保留**其前后两句仓库验证专属说明（"仓库验证与 Skill 安装是两个独立入口…"与"`self-test`/`doctor` 可在 PowerShell…"）——那两句是**本仓库特有信息**，不是对权威块的复述。
  **必须保住**的既有断言文本：`AGENTS.md` 中的"`N 个脚本`"计数表述（`checkExit2ScriptCount` 用正则解析）与 "18 项门禁"（`checkPrePushCount`）。改完自查这两处仍在。

- [ ] **步骤 4：补 §2 的 references 枚举。** 在 `AGENTS.md` §2 表格的 `w-model-dev/references/` 行内，按该行既有格式补入 `asset-authoring（技能资产编写杠杆 + 渐进披露阈值 + 授权不写，三合一）`。该行是散文式枚举、无门禁校验，但补入可避免新的过期层（受任务 1 的 relevance/sediment 判据约束）。

- [ ] **步骤 4b：`docs/INSTALL.md` §5 的触发摘要改为指向（由任务 3 的审查者发现，控制者裁定并入本任务）。** 现状：`docs/INSTALL.md:286-291` 的「触发条件摘要」4 条是**手工维护的触发信号复述**，与 `description` / `references/activation-guide.md` 构成同类漂移面（任务 3 已把该节的 `description` 镜像删掉，这 4 条是**同一节里剩余的**同类复述）；且它未覆盖新 description 的 `W-model`（英文）与 "stage gates" 措辞。
  处理：把 4 条**替换为指向权威的一条说明**（按 M16「消费者指向、不复述」），语义须包含"触发边界的权威定义在 `references/activation-guide.md`，触发决策表在 `w-model-dev/SKILL.md`，本节不再复述触发清单"。**不要**把 activation-guide 的 10 类反例再抄一遍。
  同一步顺手修正 §5 的节标题 `## 5. 激活机制（来自 \`SKILL.md\` frontmatter）`（`docs/INSTALL.md:269`）——yaml 块现已含 frontmatter 中不存在的注释行，故标题宜改成 `## 5. 激活机制（来自 \`SKILL.md\` frontmatter，节选）`。
  ⚠ 不得动 `docs/INSTALL.md:278` 的 `version: 42.2.1`（`skill-metadata.test.ts` 用 `/^version:\s*(\d+\.\d+\.\d+)\s*$/m` 提取它，必须恰 1 行），也不得动 §2/§3 的安装内容。

- [ ] **步骤 5：跑定向门禁。**
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/skill-metadata.test.ts` → 全通过（README/INSTALL 版本镜像未动）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` → 全通过
  - `npm run check:docs-consistency` → exit 0（**按约束 22/23：此命令在任务级只在必要时跑——它独立运行会 re-spawn 全量 vitest；任务 8 的 `npm run prepush` 已完整覆盖它。此处列出的检查点须在任务 8 逐项确认；若本任务能在任务级跑就更好**）（含 `exit2-script-count` 读 AGENTS.md、`pre-push-count`、`dod-dimensions` 读 README）
  - `npm run audit:l0-links` → exit 0 且 `relativeLinkCount` 与本分支基线一致（若不一致须按约束 15 重基线；README/AGENTS 的链接也在 L0 采集范围内）

- [ ] **步骤 6：Commit。**

```bash
git add README.md AGENTS.md
# 若步骤 5 触发了重基线，一并加入 l0-baseline.ts
git commit -m "docs: single authoritative install/quick-start wording (M16)"
```

---

### 任务 8：P1 收口——全量门禁 + 一致性终检

**信号：** 前 7 个任务各自只跑定向门禁，必须有一次覆盖全仓 18 项门禁的终检；且新增资产容易留下"未登记的载体"（S31 类风险）。
**影响文件：** 0（纯验证；除非发现残留才产生修复编辑）。

- [ ] **步骤 1：确认工作树干净且只含本计划改动。** 运行：`git status --porcelain` 与 `git log --oneline 228b1168..HEAD`
  预期：`git status` 除 `.superpowers/`（SDD 工作区，自忽略）外为空；提交列表即任务 1–7 的提交。

- [ ] **步骤 2：跑全量 pre-push 门禁。** 运行：`npm run prepush`
  预期：末行 `[pre-push] 全部门禁通过，允许推送 ✓`，exit 0。**这是 18 项门禁的唯一权威运行**（含 vitest 全量 + coverage 阈值 + security-scan + npm audit + samples 覆盖矩阵 + prettier + tsc + eval 语料断言）。耗时可达十余分钟，**必须真跑**，不得以定向检查代替。
  若 npm audit 因网络瞬态（DNS 失败 / 连接重置 / 超时 / HTTP 429、5xx / socket hang up）或 registry 不支持 audit endpoint 而跳过，按 hook 既有语义记录为跳过（非本计划引入的问题）。

- [ ] **步骤 3：残留上报（只在有失败时执行）。** 若步骤 2 有失败：**不要在本任务里即兴改设计**。把失败的门禁名、退出码与原始输出记进报告文件，判断它属于哪一类：① 本计划引入的机械遗漏（如计数未同步、链接逃出包根、语料扫描命中）→ 回到对应任务修；② 与 P1 无关的既有失败 → 记录为观察项，附上"基线是否同样失败"的核查结论（不得声称是本计划造成的）。**不得**为了让门禁变绿而放宽任何判据（约束 5/#45）。

- [ ] **步骤 4：一致性自查（人工，非门禁）。** 逐条确认并记入报告：
  - `grep -rn "42 份\|（42 个 \.md" README.md AGENTS.md w-model-dev/ docs/ --include=*.md` → 除历史归档 `docs/changes/archive/` 外**无命中**
  - `grep -n "个 \.md" w-model-dev/SKILL.md` → 恰一处且为 43
  - `npm run audit:l0-links` → exit 0，violations `[]`
  - `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` 的 §13 **AC-2**（M01+S03+S04 规则文件存在 + 可观测判据 + 数字阈值）与 **AC-4**（S02 后 description 只描述何时使用）与 **AC-11**（不新增依赖/hook/HTML/本地服务，`audit:l0-links` 保持 exit 0）→ 逐条给出**达成 / 未达成**判定与证据命令。

- [ ] **步骤 5：更新 spec 的验收状态。** 在 `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` §13 内，把 AC-2 / AC-4 的状态按实测结果行内标注（达成则标 `**已达成（P1）**` 并给出证据命令；AC-11 标为"P1 范围内已满足，P2–P6 落地时须复验"）。**只改 §13 这三行的状态标注**，不改 AC 的判据文本。

- [ ] **步骤 6：Commit。**

```bash
git add docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md
git commit -m "docs(spec): record P1 acceptance status for AC-2 / AC-4 / AC-11"
```

---

## 自检结果

**1. 规格覆盖度**（对照设计 spec §11 的 P1 范围 = M01 + S03 + S04 + S02 + S05 + M02 + S01 + M16 + M15）

| P1 采纳项 | 落点（spec §3.1） | 本计划任务 |
| --- | --- | --- |
| M01 资产编写杠杆 | 新增 `references/asset-authoring.md` | 任务 1 |
| S03 渐进披露数字阈值 + 指针约定 | 同上（作为权威数值） | 任务 1（步骤 1 第 5/6 小节） |
| S04 no-guidance control「授权不写」 | 同上（与 M01 双持） | 任务 1（步骤 1 第 13 小节） |
| S02 description 只写 when | `SKILL.md` frontmatter | 任务 3 |
| S05 机械约束→自动化 | SSoT §3.5 / `audit-l0-links` 边界判据 | 任务 5 |
| M02 反模式表述整改 | `hard-constraints.md` | 任务 4 |
| S01 Match the Form to the Failure | `hard-constraints.md`（修正 M02） | 任务 4 |
| M16 单一权威文案纪律 | `README.md` / `INSTALL.md` / `AGENTS.md` | 任务 7 |
| M15 调用分类与跨阶段交接写法 | `subagent-delegation.md` / `SKILL.md` | 任务 6 |

**绑定注册与终检：** 任务 2（计数/触发表同步）、任务 8（全量门禁 + AC 状态）。P1 交付判据"纯 L0、零 Schema/零脚本、M02/S01 保持 `#1~#48` 计数契约、无随仓证据的量化主张标注为假设"分别由全局约束 12/13、任务 4 步骤 3、任务 4 步骤 2.4、约束 20 覆盖。

**不在本计划范围**（防越界）：M07 的 RTM Schema 变更（P2，须单独批准，约束 1/D-2）、M08 拒绝知识库（P6，D-3）、任何 worktree 内 `.w-model` 写入（D-6）、任何新脚本/Schema/依赖、`/wm` 命令行为变更、版本号提升（约束 19）。

**2. 占位符扫描：** 无"待定/TODO/后续补充/类似任务 N"；每个内容型步骤都给出了逐字文本或明确的原文锚点 + 必须含的小节清单；每个验证步骤都给了确切命令与预期退出码/输出。

**3. 类型与命名一致性：** 全程使用同一组标识——新文件路径 `w-model-dev/references/asset-authoring.md`、基线常量 `L0_BASELINE`、门禁命令 `npm run check:docs-consistency` / `npm run audit:l0-links` / `npm run prepush`、测试路径 `w-model-dev/scripts/__tests__/...`、计数 42→43、区间契约 `#1~#48` / `| 48 |`。任务 6 与任务 7 的书写规则共用任务 6 新立的"显式动作句"术语，无同义漂移。
