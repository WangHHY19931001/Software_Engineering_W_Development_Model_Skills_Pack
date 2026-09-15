# P4 测试质量与设计规则 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **批准与边界：** P4 = 设计规格 §11 :304 的第四期（依赖 P2，已达成）。九项＝ S21 / S19 / S20 / M03（测试质量，A 层）＋ M09 / M10 / M11 / S12（设计规则，A 层）＋ **S18（唯一的 C 层：票据校验，落在门禁脚本上）**。规格 :304 的两条硬约束：「**S20 作用域限定为被测生产代码，不波及门禁 fixture**」「**S18 路径类黑名单换符号类**」。**P4 无专属 AC 行**（规格 §13 未为此期预留）→ 达成状态记录于本计划收尾节，不新增 AC 编号、不改 §13。

**目标：** 把「测试真的在测东西」与「设计决策真的值得记」变成写下来的规则：断言不得是 change detector / string-presence trap，测试名须点名它抓的破坏，期望值须独立推导（S21）；变异检查 5 类（S19）；mock 三条硬规则且只约束被测生产代码（S20）；测试质量反模式以 S 源为主（M03）；seam 的**负向**判据——两 adapter 才成真 seam + 依赖四分类→测试策略 + deletion test + DESIGN-IT-TWICE 约束矩阵（M09）；ADR 入选三问门槛（M10）；expand-contract 的兜底（共享 integration 分支 + integrate-and-verify 票）（M11）；票据的 preflight 成对冲突扫描表（S12）；以及**把票据内容的 No Placeholders 黑名单 + Buildability 判据接进门禁**（S18，符号类）。

**架构：** 八个 A 层项落在既有 Markdown 资产（`quality-standards.md` / `coding-quality.md` / `phase-2/3/4/5-*.md` / V 侧必答项）；**S18 是唯一 .ts 落点**——在 `logic/gate-logic.ts` 增加票据内容校验、由 `cli/check-artifact-gate.ts` 在 `--phase=5` 且给定票据输入时调用（logic 保持纯函数、CLI 负责读取与接线），并同步 SSoT §10.5 与夹具/用例。

**技术栈：** 既有 tsx + vitest + ajv；零新增依赖。

---

## 0. 实测基线（勘察 2026-09-15 @55d7321a，含控制者裁定）

| 实测事实（file:line） | 对设计的影响 |
| --- | --- |
| `quality-standards.md`（246 行）**零 mock 命中**（S20「W-model 零覆盖」成立）；`:82-88`「测试代码整洁标准」8 条 bullet 仅 `:85` 沾断言；无 S21/S19/M03 任何内容；`:234-246` 已有**局部编号**的「反模式黑名单」7 行表（用 1-7，非全局 #N） | S21/S19/S20/M03 四项**净新增**；新内容**不得复用** `:234` 那个标题造成歧义（用新标题） |
| **V checklist 不存在单一节**。三个候选面：`verifier-spec.md` §7.3 测试子标准表 `:611-625`（5 行）；§4.2.1「V 子代理约束清单（防手工编造）」`:308-326`（8 条，**标题即「强制清单」**）；`agent-personas.md` Persona 2 test-engineer `:153-220`（评审方法 4 节 + Severity 5 档） | S21/S19/S20/M03 的「V 必答项」落点 = **在既有强制清单/Persona 2 内做行内追加**，**不得**新增 subCriteria 名称（`verifier-spec.md:145` 硬约束「不允许新增名称」，§2.3 契约 `:160-188` 精确匹配 5 项×5 targetKind） |
| P3 已落 `verifier-spec.md` §15（`:1025-1127`），其中 §15.3.1 的「占位符扫描」**显式限定 spec 类且明确「不新增门禁检查项」** | S18（票据占位符）与 §15.3.1 **语义相邻但载体不同**（tickets vs spec），须在文中写明分工，避免被读成对 §15.3.1 的反向要求 |
| `coding-quality.md`（339 行）：**seam / 依赖四分类 / deletion test / DESIGN-IT-TWICE 全零覆盖**（grep = 0）；组 T（`:297-305`）5 条取自 Clean-Code ch17，**无 tautological / implementation-coupled / mock 边界**；`:111` 有既有**排除集**措辞「generated / dead copy / one-off experiment / **mock / fixture** / 自由文本视图一律排除」 | M09 净新增；S20 的「不波及门禁 fixture」可直接援引 `:111` 排除集 + `:109`「稳定生产调用点（非 test-only）」的既有界定 |
| 阶段文档 seam/ADR 现状：**phase-2** ADR 触发=技术选型评分矩阵 `:96-109`（无三问门槛）、`## 测试 seam 决策` 两处重复标题 `:160/:167`；**phase-3** seam `:189/:196`（含「阶段 4 必须显式引用阶段 3 选定 seam」）；**phase-4** seam `:98/:105`（含「理想零新 seam」）＋ `:171-179` 三者一致性 R3 项 | M09 的 seam **负向判据**要加到 phase-3/4 既有 seam 节（行内追加或紧邻新小节），**不改既有三条 seam 规则**；M10 收窄 phase-2 ADR 触发（`:96-109` 之后增设三问门槛，作为**准入前置**） |
| `phase-5-coding.md`（452 行）：票据清单表 `:123`（`# / 标题 / Blocked by / What it delivers / Status`）、票据内容契约 `:149`（`What to build / Blocked by / Status / 验收标准`）、**`:162` 已禁止「具体文件路径与代码片段」**、`:168-173`「票据主体=符号级契约（接口签名/类型约束/状态转移），位置交给 codegraph」、`:130-136`+`:144-147` **已有 expand-contract 模板**、**S12 preflight 零覆盖**、**S18 No Placeholders 零覆盖** | M11 = 在既有 expand-contract 节补「共享 integration 分支 + integrate-and-verify 票」兜底；S12 = 新增 preflight 成对冲突扫描表；**S18 的符号类判据与 `:162`/`:168-173` 天然同向** |
| **`check-artifact-gate` 目前校验票据 = 零**：`logic/gate-logic.ts:546` `checkArtifactGate(matrix, options)` 只吃 RTM；全仓 `ticket` 命中仅在 `cli/check-opsx-artifacts.ts:60` / `check-openspec-archive.ts:58` 的「tickets.md 必须存在」（不校验内容）；phase≥5 相关既有规则 = codeModule 格式 `:853-857`（`checkCodeModuleFormat` `:257-285`）与 SD→codeModule `:848-850` | S18 需**新增**票据内容校验并接线；落点按规格是 `check-artifact-gate.ts --phase=5` |
| 既有占位符类校验先例：`logic/code-health-ledger-logic.ts:1136-1145` 的 `PLACEHOLDER` 正则（`unknown|tbd|todo|n/a|…|待定|待补|暂缓|未提供`）——**限定 code-health 域**；`logic/docs-consistency-logic.ts:953-977` 查 SSoT 未决标题；`templates/*.md` 6 处声明「TBD/TODO/待补建 不得进入正式交付」 | S18 的黑名单可与 `code-health` 的既有词表**对齐术语**（但不复用其函数——域不同）；模板侧既有禁令是 S18 的**同向先例** |
| S18 源文：`sources/2026-09-14-superpowers-adopted-excerpts.md:679`「## S18 No Placeholders **七条**黑名单 + Buildability 判据」，原文块 `:695-700` **实测 6 条 bullet**（规格 :141 也写 6 条）→ **台账标题计数错误**；原文块含 `（略）` 截断且 vendored 源不在仓内 → **被略去部分含路径例子的假设无法证实（未核实）** | 计划对 6 条逐条搬运；「路径类换符号类」的落义**必须显式裁定**（§0.1.3）并**如实标注来源截断**，不得虚构源文语义 |
| 新增 gate 规则的契约面：**需要**新夹具 + `GATE_CASES` 条目 + `samples/README.md` 计数/矩阵行同步；**不需要**新 exit-2 脚本、新 `NEGATIVE-COVERAGE` 行（该门禁行已存在 `:24`）、`EXPECTED_GATE_COUNT` 变更；SSoT §10.5（`:1321`）是门禁判定逻辑的**单点事实源**，按 `AGENTS.md §6` 须**先改 SSoT 再改资产** | T4 的顺序：SSoT → logic → CLI → 夹具/用例 → 计数同步 |
| 计数现状：references 43（上限 48）/ schemas 34 / cli 45 / exit-2 44 / `logic/*.ts` 36 / 反模式 48（双向断言：主表含 `\| 48 \|` + `#1~#48`）/ self-test 340 / `__tests__` 86 / `L0_BASELINE` 672·95·36 / asset-budget：单文件 ≤2500（实测 max 2317）、总行 ≤20000（实测 **16824**）、TOC>1000 行（实测 5 个：tla-plus/bdd/subagent-delegation/verifier-spec/data-models） | 反模式**不得新增 #49**（S18/S21/M03 只能挂既有条目或行内追加，先例 `hill-climbing-guide.md:245`「不新增反模式条目」）；新增 references 内 markdown 链接须重基线 |
| 落点文件最近改动：`quality-standards.md` / `coding-quality.md` / `phase-2/3/4/5-*.md` **P1–P3 均未改**（最近提交 ≤2026-09-13）；`verifier-spec.md`（P3 改过 §15）、`agent-personas.md`（P3 +8 行）、`hard-constraints.md`（P2-B/P3 改过） | 前者零重复风险；后者须避开 P3 新增区与 `#45` 挂点 |

### 0.1 设计裁定（控制者决定，实现者不得擅改）

1. **S20 的作用域**（规格 :304 硬约束）：三条 mock 硬规则**只约束被测生产代码**（即 `src/**`、产品代码路径），**明确排除** `w-model-dev/scripts/samples/**` 的门禁 fixture 与本技能包自身的脚本；文中须引用既有排除集措辞（`coding-quality.md:111`）并写清「测试替身自身不适用本规则」。
2. **V 侧落点形态**：S21/S19/S20/M03 的 V 必答项**以行内追加**进入既有强制清单（`verifier-spec.md` §4.2.1，现 8 条）与 `agent-personas.md` Persona 2 的评审方法；**不得新增 subCriteria 名称**（`verifier-spec.md:145` 硬契约），**不得新增反模式 #N**。
3. **S18 的「符号类」裁定**（规格 :304 硬约束 + 源文截断事实）：六条黑名单按台账原文逐条搬运为**票据内容判据**，其中：第 5 条（"Steps that describe what to do without showing how"，源文附「code blocks required」）与第 1/2/3 条的「怎么写」部分，**一律改写为符号级要求**（票据须点名接口签名/类型/状态转移或可执行步骤的**具体动作与产出物**），**不得要求写文件路径或内联代码块**——依据：本仓既有票据禁令 `phase-5-coding.md:162`（禁止具体文件路径与代码片段）与 `:168-173`（票据主体=符号级契约，位置交给 codegraph）。**该改写是规格 :304「路径类换符号类」的落义，须在代码注释与文档中显式标注为「本仓库对源文的适配，非源文原义」**，并如实记录源文块被截断、路径类原文未见。
4. **S18 的门禁接线**：`logic/gate-logic.ts` 新增**纯函数**票据校验（输入 = 票据文本 + 现有 matrix/options），`cli/check-artifact-gate.ts` 负责解析新参数并读取票据文件后传入。**行为契约**：`--tickets=<path>`（可选）缺失时**不触发**票据校验（保持既有调用方零影响）；给定但文件不存在 → exit 2 `FILE_NOT_FOUND`；**文件存在且校验失败 → exit 1**（与既有 gate 一致，不新增 exit 码）。`GATE_JSON` 增加 `tickets:{checked,criticalMissing,buildabilityMissing}` 计数对象（照 M07 `testEvidence` 先例），并在 `command-reference.md` 同步。**已在 `--phase<5` 时给定的 `--tickets` → exit 2（ARG_INVALID）**，避免参数被静默忽略。
5. **S18 的判据集**（可被夹具与用例逐条覆盖）：① 六条黑名单逐条（第 1 条 = TBD/TODO/implement later/fill in details 等占位短语；第 2 条 = 「加适当的错误处理/加校验/处理边界情况」这类**无具体动作**的祈使；第 3 条 = 「为上述写测试」而无测试签名/用例名；第 4 条 = 「与任务 N 类似」而无符号级重复说明；第 5 条 = 只说要做什么不说怎么做（**符号类改写**：须给出接口/类型/状态转移或具体动作与产出物）；第 6 条 = 引用任何任务中都未定义的 type/function/method）；② **Buildability 判据**（能否照着票据一路做下去不卡住）落地为一个**可判定的负面清单**（缺接口签名且缺验收标准 / 引用了不存在的符号 / 只给路径不给符号——与 ① 的第 6 条和第 5 条不重复断言）。
6. **M10 的收窄方向**：三问门槛（难逆 / 无上下文会困惑 / 真取舍）作为 **ADR 准入前置**加在 phase-2 既有选型评分之后——**不得**删除既有评分矩阵，也不得改变其实施步骤编号（行内追加或紧邻小节）。
7. **M09 的落点**：seam **负向判据**（一 adapter 不算真 seam / 无变化处不得引入 port / deletion test 怎么做 / 依赖四分裂→测试策略 / DESIGN-IT-TWICE 约束矩阵）写入 `coding-quality.md` **新增小节** + phase-3/phase-4 既有 seam 节各一行**指针**（不改那三条既有规则）。
8. **P4 无 AC 行**：不新增 AC 编号、不改 §13；达成证据写入本计划收尾节 + （仅当 SSoT 对应节确实需要同步时）SSoT §10.3/§10.5 的既有小节。

---

## 1. 全局约束（每个任务都适用）

1. **零新增依赖 / 零新增 Schema 文件 / 零新增 CLI 脚本**（schemas 34 / cli 45 / exit-2 44 不变）；不得调用 LLM。
2. **不升版本号**（五处镜像不动）。
3. **不得放松任何既有判据**；A 层任务只新增内容，**不得删改**既有小节语义。
4. **不触碰** `CHANGELOG.md`、`docs/changes/`（除 T4 若确需 read 参考）、`eval/**`、`.githooks/**`、`package.json`、`docs/superpowers/sources/**`（台账只读）。
5. **反模式计数不变**（48，双向断言在守）：S18/S21/M03 只挂既有条目或行内追加。
6. **V 子标准名不变**（`verifier-spec.md:145` + §2.3 契约）。
7. **SSoT 优先**（`AGENTS.md §6`）：T4 必须先改 `docs/skill-design-document_SSoT.md` 对应节（§10.5 门禁判定逻辑；必要时 §10.3 测试质量标准），再改资产。
8. **L0 重基线义务**：新增 markdown 相对链接 → `npm run audit:l0-links` + 按 `helpers/l0-baseline.ts` 流程重基线（带来源注释）。
9. **每任务验证清单（强制；含 P2-B/P3 教训）**：(a) `npm run lint:security` exit 0 新增 0；(b) **十一文件守卫组**（vitest-project-split / run-sync / gate-report / check-samples-coverage / docs-consistency-logic / skill-metadata / l0-link-audit-logic / l0-link-audit-cli / exit2-failure-atomicity / asset-budget / **examples-contract**）或全量 vitest；(c) `npm run audit:l0-links`；(d) 新增必需文件/字段 → 全仓 consumer 搜索并同步；(e) prettier 权威配置 `npx prettier --config config/prettier.config.cjs --check <files>`。
10. **TDD**：S18 的每条判据先写会红的用例；A 层任务以「逐条回溯台账原文」+「既有小节零删改的 diff 证明」代替。
11. **诚实性**：证据命令真实跑过并贴真实输出；S18 的源文截断与适配改写如实标注；不得声称用户批准。
12. **保持输出流动**（本会话已多次因长时间无输出被会话超时终止实现者）。

---

## 2. 落点台账

| ID | 落点 | 形式 | 台账出处 |
| --- | --- | --- | --- |
| S21 | `quality-standards.md` 新小节 + `verifier-spec.md` §4.2.1 行内 + `agent-personas.md` Persona 2 行内 | change detector / string-presence trap / "Name the break" / 期望值独立推导 | S 台账（勘察报告 §A 给出定位） |
| S19 | 同上（新小节含 5 类变异） | Mutation Check 5 类 | 同上 |
| S20 | `quality-standards.md` 新小节（**含作用域限定**） | mock 三条硬规则 | 同上 |
| M03 | 同上新小节（**S 为主源**） | tautological / implementation-coupled / mock 边界 | M 台账 |
| M09 | `coding-quality.md` 新小节 + phase-3/4 seam 节指针 | 两 adapter 才真 seam / 依赖四分类→测试策略 / deletion test / DESIGN-IT-TWICE | M 台账 |
| M10 | `phase-2-system-design.md` ADR 触发处行内追加 | 三问门槛 | M 台账 |
| M11 | `phase-5-coding.md` expand-contract 节行内追加 | 共享 integration 分支 + integrate-and-verify 票 | M 台账 |
| S12 | `phase-5-coding.md` 票据节新小节（表格式） | preflight 成对冲突扫描表 | S 台账 |
| S18 | `SSoT §10.5` → `logic/gate-logic.ts` → `cli/check-artifact-gate.ts` → 夹具/用例/`command-reference.md` | 6 条黑名单（符号类）+ Buildability 判据 | S 台账 :679-703 |

---

## 3. 任务分解

### 任务 1（S21 + S19 + S20 + M03）：测试质量判据

- [ ] **步骤 1**：读台账 S21/S19/S20/M03 原文与 `quality-standards.md` 现状（`:69-88`、`:234-246`）。
- [ ] **步骤 2**：`quality-standards.md` 新增小节「测试质量判据（S21/S19/S20/M03）」：① **断言强度**（change detector 反例：`expect(x).toBeDefined()`、只断言不抛异常；**string-presence trap**：「断言输出包含某字符串」在实现变化时仍绿；**"Name the break"**：测试名/意图须能点名它抓的破坏，否则重命名或删除；**期望值独立推导**：期望值不得从被测实现本身推导/复制）；② **变异检查 5 类**（逐类给「怎么变异 + 期望转红」）；③ **mock 三条硬规则**（先学副作用再替身 / 替身须镜像被替对象的完整结构 / **禁止 test-only 方法进生产类**）+ **作用域限定**（只约束被测生产代码，排除 `samples/**` 门禁 fixture 与本仓脚本，援引 `coding-quality.md:111` 排除集）；④ **测试质量反模式**（tautological / implementation-coupled / mock 边界），标注「以 S 源为主」。
- [ ] **步骤 3**：V 侧行内追加：`verifier-spec.md` §4.2.1 强制清单加 1-2 条（指向新小节，**不新增 subCriteria**）；`agent-personas.md` Persona 2 评审方法加 1 条（同为指针）。
- [ ] **验证**：约束 9 全套（(b) 十一守卫组）；`audit:l0-links` + 如需重基线；反模式计数实测 48；diff 逐 hunk 说明既有小节零删改。
- [ ] **Commit**：`docs(test): assert-strength, mutation checks, and mock rules (S21+S19+S20+M03)`

### 任务 2（M09 + M10）：seam 负向判据与 ADR 门槛

- [ ] **步骤 1**：读台账 M09/M10 原文与 phase-2/3/4 现状（`phase-2:96-109/:160-190`、`phase-3:189-214`、`phase-4:98-123/:171-179`、`coding-quality.md` 目录）。
- [ ] **步骤 2**：`coding-quality.md` 新增小节「seam 与依赖的负向判据（M09）」：**两 adapter 才成真 seam**（只有一个 adapter/只有一个调用方 → 是假想 seam，不得引入 port）；**无变化处不得引入 seam/port**；**依赖四分类 → 测试策略**（逐类给「用真对象/替身/契约测试/不测」的判据）；**deletion test**（删掉该抽象后是否仍能工作 → 能则它是多余的）；**DESIGN-IT-TWICE 约束矩阵**（何时必须做第二次设计）。
- [ ] **步骤 3**：`phase-3`/`phase-4` 既有 seam 节各加**一行指针**（不改其三条既有规则）；`phase-2` 的 ADR 触发处（`:96-109` 之后）行内追加**三问门槛**（难逆 / 无上下文会困惑 / 真取舍；三问不齐 → 不写 ADR，记入设计文档即可）。
- [ ] **验证**：约束 9；`audit:l0-links`；phase-2 的既有评分矩阵与实施步骤编号零改动（diff 证明）。
- [ ] **Commit**：`docs(design): seam negative criteria and ADR entry gate (M09+M10)`

### 任务 3（M11 + S12）：expand-contract 兜底与票据 preflight 表

- [ ] **步骤 1**：读台账 M11/S12 原文与 `phase-5-coding.md` 现状（expand-contract `:130-147`、票据节 `:103-198`）。
- [ ] **步骤 2**：`phase-5-coding.md` 的 expand-contract 节**行内追加**兜底：当扩展期需要跨多个部署单元/多批次时，使用**共享 integration 分支**并在其上建 **integrate-and-verify 票**（定义该票的 What to build / Blocked by / 验收标准）；不改既有 Expand/Migrate/Contract 模板语义。
- [ ] **步骤 3**：票据节新增**preflight 成对冲突扫描表**（S12）：表内含「冲突对」（如：两票同时改同一符号的契约 / 一票新增字段而另一票假设其不存在 / 迁移票与其消费者票顺序倒置），每对给「扫描动作」（在票据拆解完成后、开工前逐对扫一遍）与「发现冲突的处置」（调整 Blocked by 或合并票据），并以**符号级**表述（与 `:162`/`:168-173` 一致）。
- [ ] **验证**：约束 9；`audit:l0-links`；既有票据表列结构与 expand-contract 模板零删改。
- [ ] **Commit**：`docs(tickets): expand-contract fallback and preflight conflict scan (M11+S12)`

### 任务 4（S18）：票据内容门禁（本计划唯一 .ts 任务）

- [ ] **步骤 1**：读台账 S18 :679-703（含截断事实）与 `phase-5-coding.md:103-198`；确认 §0.1.3 的符号类改写方向。
- [ ] **步骤 2（SSoT 先行）**：`docs/skill-design-document_SSoT.md` §10.5 门禁判定逻辑表补一行（票据内容校验的落点、输入与判据集由 §0.1.4/§0.1.5 定义）。
- [ ] **步骤 3（TDD）**：先写会红用例（`__tests__/` 新增或既有 gate 测试扩展）：6 条黑名单各 1 例 + Buildability 2 例 + 参数契约（`--tickets` 缺省不校验 / 文件不存在 exit 2 / `--phase<5` 给 `--tickets` exit 2 / 校验失败 exit 1）+ GATE_JSON `tickets` 计数。RED 证据入报告。
- [ ] **步骤 4**：`logic/gate-logic.ts` 实现纯函数校验（含 §0.1.3 的符号类判据与「本仓库适配、非源文原义」注释）；`cli/check-artifact-gate.ts` 接线（解析 `--tickets`、读文件、传入、计数进 `GATE_JSON`）。
- [ ] **步骤 5**：夹具与计数同步：`samples/gate/` 新增票据正/反夹具（若为 .md 载体，按 `check-samples-coverage` 规则登记）+ `self-test.ts` `GATE_CASES` 条目（负例必须断言**具体原因正则**）+ `samples/README.md` 的 `GATE_CASES（26）` 与总计/合计算术同步 + `command-reference.md` 补 `--tickets` 与 `tickets` 计数 + `docs/user-guide.md:103` 若口径受影响则复核（§E3）。
- [ ] **验证**：约束 9 全套（含 `check-samples-coverage.ts` exit 0、`exit2-failure-atomicity` 仍 45 用例、counts 不变）；`npx tsx cli/check-artifact-gate.ts --phase=5` 对既有样本行为不变（无 `--tickets` 时不触发）。
- [ ] **Commit**：`feat(gate): validate ticket content with a symbol-based placeholder blacklist (S18)`

### 任务 5（收口）：全量门禁 + 状态记录

- [ ] `npm run prepush`（`sh -c '… > log 2>&1; echo $?'` 直捕退出码；后台 + 轮询；**不得与任何其它 vitest/coverage 并发**；预期 18/18 + `PREPUSH_EXIT=0`）。
- [ ] 一致性自查：`audit:l0-links`（672/95/36 或按流程重基线）；`self-test`（340+新增，与 7 处声明一致）；`check-samples-coverage` exit 0；counts（references 43 / schemas 34 / cli 45 / exit-2 44 / 反模式 48）实测不变；`git diff --stat <base>..HEAD -- package.json .githooks eval` 为空。
- [ ] 本计划文件追加「收尾」节（控制者在最终审查后回填；含 P4 无 AC 行的说明与达成证据）。
- [ ] **Commit**：`docs(plan): record the P4 closeout evidence` （若 T5 只改计划文件）

---

## 自检结果

**1. 规格覆盖度**：S21→T1；S19→T1；S20→T1（含作用域裁定）；M03→T1；M09→T2；M10→T2；M11→T3；S12→T3；S18→T4（含符号类裁定与 SSoT 先行）；§304 两条硬约束→§0.1.1/§0.1.3；P4 无 AC 行→§0.1.8 记录方式。
**2. 占位符扫描**：无「待定/后续补充」。T4 的夹具载体形态（.md vs 新子目录）留作**有界选择 + 报告义务**（受 `check-samples-coverage` 规则约束），非占位符。
**3. 命名一致性**：`change detector` / `string-presence trap` / `Name the break` / `Mutation Check` / `deletion test` / `DESIGN-IT-TWICE` / `Buildability` / `preflight 成对冲突扫描表` / `--tickets` / `tickets:{checked,criticalMissing,buildabilityMissing}` 与台账/规格措辞对齐。
**4. 与既有验收的关系**：无新增 AC；不动 `/wm` 命令的输入输出语义（`--tickets` 是新增**可选**参数，既有调用零影响）；不新增 RTM 关系或 Schema 字段。
