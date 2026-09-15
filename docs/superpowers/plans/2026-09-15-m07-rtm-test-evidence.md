# M07 RTM 测试证据可验证化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **批准依据：** 用户已于 2026-09-15 **单独批准**本项 RTM `testSummary` 的 Schema 变更（裁定 D-2 前置满足；D-2 原文见 `docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md:107-111`、:204 回执、:222 实施约束：「**只能是新增可选字段**；不得改动 RTM 实体、关系、覆盖率语义」）。**本计划是该项的唯一实现单元**，不得顺带改动 RTM 其它任何内容。

**目标：** 把 code-health 的 redEvidence/greenEvidence 证据模式**扩展到阶段 5-8 的 RTM `testSummary`**——让「本阶段测试结果 X 通过 / Y 失败 / Z 待执行」不再是一串可随意填写的数字，而必须携带**真实测试运行的证据**（命令 + 退出码，可选原始输出文件与 SHA-256），并由门禁做**确定性一致性校验**（含「有失败必来自非零退出」的 RED 绑定）。

**架构：** 只动三处承重面——`schemas/rtm.schema.json`（新增一个**可选**对象字段）、`logic/gate-logic.ts`（四条确定性校验规则 + cutoff 吸收，由 `check-artifact-gate.ts` 调用）、夹具与文档。**零新增脚本、零新增 Schema 文件、零新增依赖。**

**技术栈：** 既有 tsx + vitest + ajv；`node:crypto` 做哈希（仓内已有先例：code-health TDD harness）。

---

## 0. 实测基线（勘察报告 2026-09-15，worktree @42da6b44，全部带 file:line）

| 实测事实 | 对设计的影响 |
| --- | --- |
| `rtm.schema.json` 119 行；顶层 `additionalProperties:false`:7；`executionSummary`:79-93 同级 `additionalProperties:false`:82；`definitions.testSummary`:95-118 `additionalProperties:false`:99，`required: [total,passed,failed,pending,coverage]`:100 | 新字段必须**同时**写进 schema（否则 `additionalProperties:false` 直接拒绝）；历史证据：`eval/e2e/2026-08-28-final.md:57/:66/:75/:91` 记载曾有项目想在 `testSummary` 内加 `coverageNote` 被该约束拒——本计划获批正是为解这类「证据无处安放」 |
| RTM 内**无**任何 cutoff/可选证据机制（全文无 allOf） | cutoff 吸收要在**逻辑层**实现，照 run-log `revertEvidence` 先例（`run-log.schema.json:326-341` optional + `logic/run-log-logic.ts:32` cutoff 常量 + `LEGACY_REVERT_EVIDENCE` 非阻断） |
| `testSummary`/`executionSummary` 的**全部**消费者（全仓 grep）：`logic/gate-logic.ts`（类型 :23-37、存在性 :477-481、按阶段层存在性 :497-514、计数不变量 :600-628）与 `logic/wm-status-logic.ts`（:55-60 容忍缺字段、:92-95、:136-145）+ `cli/wm-status.ts:135-142`。**非消费者**：coverage-logic / code-tla-logic / code-health-* / check-run-log | 承重面只有 gate-logic；wm-status 容忍缺字段（新可选字段对它零影响）；无第三方消费 → 扩展面可控 |
| `gate-logic.ts` 现有 RTM 校验共 11 组（schema 前置 :456-468 / 结构 :477-481 / 层存在性 :497-514 / 行唯一性 :518-531 / 追溯字段 :540-548 / 覆盖率重算 :550-557 / coverageStatus :559-581 / NFR 双字段 :583-598 / 四级计数 :600-628 / TLA+ 资产 :630-634 / SD→codeModule :635-645）——**无任何**「结果与真实运行绑定」的校验 | M07 的缺口精确在此；新规则挂进同一函数族，风格照既有（无独立 rule-id 命名空间，用一致的 message 前缀） |
| 测试摘要的**生产者**是 S 子代理（`computer-reference.md`→ 实为 `references/command-reference.md:153,155-157` `/wm test` 链路；`rtm-guide.md:97-106`；`examples/test-execution.md:123`），写 `.w-model/rtm.json` 经 `wm-write.ts`（`data-models.md:282`）；**对错只验计数自洽**（`gate-logic.ts:600-628`） | 文档需同步 S 的新义务（登记 evidence）与 G 的新校验；`command-reference.md:140-160` 是权威命令面 |
| 夹具：`samples/gate/` 含 executionSummary 的 15 个；`bad-structure.json` 故意缺（`self-test.ts:337-342`）；`GATE_CASES` 20 条（self-test.ts:301-435）；schema 负例 `samples/schema/bad-rtm-wrong-type.json`（self-test.ts:2364-2370） | 新夹具落 `samples/gate/` + `SCHEMA_CASES`；须同步 `samples/README.md:13`（GATE_CASES 计数）与全仓「333 条」声明（`samples/README.md:3/:46`、`README.md:27`、`CONTRIBUTING.md:62/90/259`、`AGENTS.md:177`、`docs/INSTALL.md:298`）；`NEGATIVE-COVERAGE.md` check-artifact-gate 行已存在 → **不新增行** |
| `checkSchemaList` 按**文件粒度**（`docs-consistency-logic.ts:1096`）→ schema 文件数 34 不变则零影响；`checkSchemaFieldDescriptions` 递归 `properties`/`definitions`/`$defs`/`items`，缺 description 即红（:1509-1528） | 新字段及其嵌套对象**必须**全部带 description |
| 文档面：`rtm-guide.md` **从不提** executionSummary（零命中）；`data-models.md` 对 RTM 为文件级清单行 :968-973 + 行字段演进表 :219-242，另有 run-log 字段语义段先例 :561/:563 | 新字段的文档落点 = `data-models.md` RTM 区新增一小段语义（照 :563 revertEvidence 先例）+ `rtm-guide.md` 新增一节 + `command-reference.md` `/wm test` 节补 S 义务 + `templates/rtm.md:26-33` 摘要表下加一行说明 |
| 状态回填位置：规格 §13 AC 表（:355-368），样式照 AC-7/AC-8「**已达成（…）**——证据命令（均真实跑）」（:364/:365）；M07 目前**没有**独立 AC 行，仅 AC-11 :368 内含「（M07 的 Schema 变更单独批准）」 | 收口时**在 AC-11 行内**追加 M07 达成标注（不新增 AC 编号——规格未预留，擅自加编号会改验收结构） |
| 实测基线：self-test 333/333；schemas 34；`docs/user-guide.md:110` 仍写「332 条」（**既有陈旧值**，本计划不扩大战场，登记为搁置） | 计数同步面以「谁声明谁同步」为准；user-guide 陈旧值搁置 |

### 0.1 设计裁定（控制者决定，实现者不得擅改）

1. **字段形态**（唯一新增物）：`definitions.testSummary` 增加**可选**属性 `evidence`：
   - `evidence.command`：`string`，`minLength:1`，`pattern` 禁 `;&|<>` 与换行（照 `code-health-gap.schema.json:188-193` 同款约束）
   - `evidence.exitCode`：`integer`，`minimum:0`（真实进程退出码；本字段就是「结果与运行绑定」的锚点）
   - `evidence.observedAt`：`string`，UTC ISO-8601 毫秒 `pattern`（照 code-health `startedAt` :210-215）
   - `evidence.rawOutputPath`（可选）：`string`，相对路径 pattern（照 :194-198）
   - `evidence.rawOutputSha256`（可选）：`string`，`^[0-9a-f]{64}$`
   - `evidence` 自身 `additionalProperties:false`；**schema 层绝不 required**（D-2 硬约束：只能是新增可选字段）
2. **四条逻辑规则**（`gate-logic.ts`，由 `check-artifact-gate.ts` 在既有 RTM 校验链路上执行）：
   - **E1 配对**：`rawOutputPath` 与 `rawOutputSha256` 要么都无、要么都有；只出现其一 → 违规。
   - **E2 哈希核验**（仅当二者齐备）：以项目根解析 `rawOutputPath`（必须相对路径，禁越出根），文件必须存在；其 sha256 必须等于 `rawOutputSha256` → 不符/缺失即违规。**这是最强的机器可验层。**
   - **E3 结果一致性**（有 `evidence` 时强制）：`failed === 0 && pending === 0` ⇒ `exitCode === 0`；`failed > 0` ⇒ `exitCode >= 1`（RED 绑定：记录里有失败，就不可能来自一次绿色运行）；`failed === 0 && pending > 0` 不作约束（部分执行两种退出码都合理，如实不编码）。
   - **E4 存在性要求 + cutoff 吸收**：当 RTM 的 `lastUpdated >= M07_TEST_EVIDENCE_CUTOFF`（新常量 `'2026-09-15T00:00:00Z'`，注释引 D-2 与批准日期）时，**当前阶段必须存在的每个测试层**（既有 `PHASE_TEST_LAYERS`:62-71 决定）只要 `total > 0` 就必须携带合法 `evidence`；缺失 → 违规。`lastUpdated` 早于 cutoff → 非阻断 `LEGACY_TEST_EVIDENCE` 标注（结构照 run-log 的 `LEGACY_REVERT_EVIDENCE`：进入独立 legacy 数组、CLI/GATE_JSON 呈现、不阻断）。`lastUpdated` 缺失或不可解析 → **保守按 cutoff 后处理**（不吸收，与 run-log 既有方向一致）。
3. **不做的事**：不改 RTM 实体/关系/覆盖率语义（D-2）；不改 `rows` 任何字段；不加 `assertionHash`（RTM 无断言集粒度，硬造指纹是不可验证的形式主义——**如实记录该取舍**）；不改 `additionalProperties`；不动 `wm-status` 的展示（新字段可选，它容忍缺字段）。
4. **测试落点**：新夹具一律落 `samples/gate/`（既有目录，走既有 `GATE_CASES` 机制），不新建 samples 子目录（避免矩阵新增行义务）；`samples/schema/` 补一个类型负例。**若**实现需要临时目录夹具（如哈希核验的产物文件），用 `os.tmpdir()`（P2-B 先例）并在报告中说明。
5. **既有 15 个含 executionSummary 夹具的处理**：先实测各自 `lastUpdated`；早于 cutoff 者依赖 LEGACY 吸收**保持绿且不改动**；晚于/等于 cutoff 者（若有）必须补 evidence 而**不得**改其 lastUpdated 以逃避规则（那就是放松判据）。实测结果与处置逐条入报告。

---

## 1. 全局约束（每个任务都适用）

1. **零新增依赖 / 零新增 Schema 文件**（schemas 计 34 不变）；**不得调用 LLM**。
2. **不升版本号**（package.json / skill-metadata.json / SKILL.md frontmatter / README.md / docs/INSTALL.md 五处镜像不动）。
3. **不得写 `.w-model/`**（测试临时目录一律 `os.tmpdir()`）。
4. **不得放松任何既有判据**；本计划只允许新增规则/收紧。**尤其**：不得为让夹具变绿而改其 `lastUpdated`、删断言、改期望值。
5. **不触碰** `CHANGELOG.md`、`docs/changes/`、`eval/**`、`.githooks/**`、`package.json`、**run-log 相关任何文件**（P2-B 领地：`run-log.schema.json` / `run-log-logic.ts` / check-run-log）。
6. **D-2 硬约束**：RTM 侧只允许「新增可选字段」；不得改 `rows`、不得改覆盖率语义、不得改 `additionalProperties`。
7. **计数契约同步义务**：凡提交使计数变化（如 self-test 用例数、GATE_CASES 数），同一提交内同步全部声明处（清单见 §0 表格与任务 3）。
8. **每任务验证清单（P2-B 教训，强制）**：(a) `npm run lint:security` exit 0 新增 0；(b) 触及文件的聚焦 vitest **加**全局契约守卫组（**十文件**：vitest-project-split / run-sync / gate-report / check-samples-coverage / docs-consistency-logic / skill-metadata / l0-link-audit-logic / l0-link-audit-cli / exit2-failure-atomicity / artifact-gate 系）或全量 `npx vitest run --config config/vitest.config.ts`；(c) 凡新增「必需文件/必需字段/新契约」，先全仓 grep 消费该契约的夹具与测试并同步；(d) **凡在 L0 文档新增 markdown 链接，必须同步 `L0_BASELINE`**（P2-B 教训 ④——先例：`helpers/l0-baseline.ts:38-44` + 来源注释）；(e) prettier 用权威配置 `npx prettier --config config/prettier.config.cjs --check <files>`（裸 `npx prettier` 不加载仓配置）。
9. **TDD**：每条新规则先写会红的用例/夹具（RED 证据入报告），再实现；每一级「会红」都要能说明它防的是什么回归。
10. **诚实性**：证据命令必须真实跑过并贴真实输出；不得声称用户批准（批准记录已在 §0 顶部）；不得把未达成写成达成。
11. worktree 内 `npm install` 已就绪；`.superpowers/` 为本地账本，不入库。
12. **不新增反模式条目**（48 不变）；不新增 pre-push 项（18 不变）；不新增 run-log action 枚举（27 不变）。

---

## 2. 任务分解

### 任务 1（Schema）：`testSummary.evidence` 新增可选字段

- [ ] **步骤 1**：实测既有 15 个含 executionSummary 夹具的 `lastUpdated` 值（列表入报告）——这决定任务 2 是否需要顺带补夹具。
- [ ] **步骤 2**：TDD——`samples/schema/` 新增负例 `bad-rtm-evidence-wrong-type.json`（如 `evidence.exitCode` 给字符串）并在 self-test 的 `SCHEMA_CASES` 加会红用例；RED 证据入报告。
- [ ] **步骤 3**：`w-model-dev/schemas/rtm.schema.json` 的 `definitions.testSummary.properties` 加 `evidence`（§0.1.1 逐字段 + 全节点 description；`additionalProperties:false`；不 required）。**只加这一个属性**。
- [ ] **验证**：约束 8 的 (a)(b)；schema 负例绿；`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 不跑（>975s），用 docs-consistency-logic 聚焦批（在十文件守卫组内）兜底；schema 文件数仍 34。
- [ ] **Commit**：`feat(rtm): add optional testSummary.evidence schema field (M07)`

### 任务 2（门禁规则）：E1-E4 + cutoff 吸收

- [ ] **步骤 1**：TDD——按 §0.1.2 四条规则各写会红用例（先例：`__tests__/artifact-gate-external.test.ts` / `gate-enhancement.test.ts` 的内联 RTM 夹具 + 临时目录；哈希核验用例用 `os.tmpdir()` 写真实产物文件算真实 sha256）。用例至少覆盖：E1 单边输出字段 → 红；E2 哈希不符 → 红、文件缺失 → 红；E3 `failed>0 && exitCode===0` → 红、`failed>0 && exitCode===1` → 绿、`failed===0&&pending===0&&exitCode===1` → 红；E4 cutoff 后 phase6 层无 evidence → 红、cutoff 前 → 绿 + `LEGACY_TEST_EVIDENCE` 标注、`lastUpdated` 不可解析 → 红（保守）。RED 证据入报告。
- [ ] **步骤 2**：`logic/gate-logic.ts` 实现：常量 `M07_TEST_EVIDENCE_CUTOFF`（注释引 D-2）、E1-E4 校验、legacy 收集与输出结构（照 run-log `LEGACY_REVERT_EVIDENCE` 形态：`checkArtifactGate` 返回值加 legacy 数组，`check-artifact-gate.ts` 的 `GATE_JSON` 带 legacy 与 e-rule 计数）。
- [ ] **步骤 3**：若步骤 1 实测发现既有夹具 `lastUpdated >= cutoff`：按 §0.1.5 处置（补 evidence，**不许改 lastUpdated**）并如实报告；否则明确记录「全部早于 cutoff，依赖 LEGACY 吸收，零改动」。
- [ ] **验证**：约束 8 的 (a)(b)(c)——consumer 搜索 `grep -rn "executionSummary\|testSummary"`（重点确认 `wm-status` 系与 `__tests__` 内联夹具不因新规则转红）；`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts` 对既有合法样本 exit 0（真实包口径）。
- [ ] **Commit**：`feat(gate): bind RTM test summaries to real run evidence with cutoff legacy (M07)`

### 任务 3（夹具与用例）：正反夹具 + 计数同步

- [ ] **步骤 1**：`samples/gate/` 新增（命名照既有 `valid-*` / `bad-*` 风格）：
  - `valid-test-evidence.json`：phase≥6、`failed=0 pending=0`、`exitCode=0`、带 `rawOutputPath`+`rawOutputSha256` 指向**同目录**一个小产物文件（真实 hash）→ 绿
  - `bad-test-evidence-hash-mismatch.json`：hash 故意不符 → 红
  - `bad-test-evidence-exitcode-mismatch.json`：`failed>0` 而 `exitCode=0`（RED 绑定反例）→ 红
  - `bad-test-evidence-unpaired-output.json`：只有 `rawOutputPath` → 红
  - `bad-test-evidence-missing.json`：cutoff 后、phase6 层 `total>0` 无 evidence → 红
  - `valid-test-evidence-legacy.json`：同上但 `lastUpdated` 早于 cutoff → 绿（legacy 非阻断）
  - 产物文件 `test-evidence-output.txt`（小而稳定，内容自述用途）
- [ ] **步骤 2**：`self-test.ts` 的 `GATE_CASES` 加对应条目（正例断言 `expectedPassed: true` + 反例断言**具体原因正则**——照 P2-A 强化后的「必须失败且原因可辨」标准，不准只断言 `expectedPassed:false`）。TDD：先写用例跑到红/绿符合预期，RED→GREEN 证据入报告。
- [ ] **步骤 3**：计数同步：`samples/README.md`（GATE_CASES 计数 :13、总数 :3/:46 的算术、矩阵行若涉及）+ `README.md:27`、`CONTRIBUTING.md:62/90/259`、`AGENTS.md:177`、`docs/INSTALL.md:298` 的「333 条」→ 实测新值。**`check-samples-coverage.ts` 必须 exit 0**（新夹具被 self-test 引用 + 落既有目录）。
- [ ] **验证**：约束 8 的 (a)(b)(c)；`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0；`npm run self-test` 全过且尾行数与同步后的声明逐处一致。
- [ ] **Commit**：`test(rtm): add positive and negative evidence fixtures with reason assertions (M07)`

### 任务 4（文档同步）：S 的新义务与 G 的新校验

- [ ] `references/command-reference.md` `/wm test` 节（:140-160）：S 回填时须登记 `evidence`（命令/退出码，可选输出文件+sha256）；G 会校验 E1-E4；旧项目 cutoff 吸收说明。
- [ ] `references/rtm-guide.md`：新增一节「测试执行证据（M07）」（字段形态、四条规则、cutoff、与 run-log `revertEvidence` 的分工——**边界写清：run-log 证伪 S-fix 的复现测试；RTM 证据绑定阶段级测试运行，两者载体不同、不得互相替代**）。
- [ ] `references/data-models.md` RTM 区：字段语义段（照 :563 revertEvidence 先例的格式与位置风格）。
- [ ] `templates/rtm.md`：摘要表（:26-33）下加一行说明（证据义务与 cutoff），不改表结构。
- [ ] `references/quality-standards.md:75` 与 `references/workflow.md:78/86/96`：仅在确有必要时改（若其表述已兼容则**不改**并在报告说明）。
- [ ] **验证**：约束 8 的 (a)(b)(d)——**新增 markdown 链接若改变 L0 三计数必须同步 `L0_BASELINE`**（带来源注释）；`npm run audit:l0-links` exit 0。
- [ ] **Commit**：`docs(rtm): document the test evidence field, gate rules, and run-log boundary (M07)`

### 任务 5（收口）：全量门禁 + 状态回填

- [ ] `npm run prepush`（`sh -c '… > log 2>&1; echo $?'` 直捕退出码；后台 + 轮询；约 20 分钟；预期 18/18 + `PREPUSH_EXIT=0`）。
- [ ] 一致性自查：`audit:l0-links` exit 0（三计数与基线一致或已按流程重基线）；`self-test` 全过且与声明数一致；`check-samples-coverage` exit 0；`ls w-model-dev/schemas/*.schema.json | wc -l` = 34；`git diff --stat <base>..HEAD -- w-model-dev/scripts/cli/`（**零新增** cli 脚本）。
- [ ] 规格 §13 **AC-11 行内**追加 M07 达成标注（**不新增 AC 编号**）：`**M07 已达成（独立批准单元，2026-09-15）**：…` + 四条规则的落点 + 证据命令（**每条真实跑过并贴真实输出**；`check-artifact-gate` 正/反样本各一、`npm run self-test` 尾行、`grep` 数）。只加状态，AC-11 判据文本一字不动。
- [ ] 本计划文件追加「收尾」节（控制者在最终审查后回填；本任务只须留好账本）。
- [ ] **Commit**：`docs(spec): record M07 acceptance status in AC-11`

---

## 自检结果

**1. 规格覆盖度**：M07（§3.3 :114 / §5 :209 / D7 :270 / D-2 :107-111,:222）→ T1（schema）+T2（门禁规则）+T3（夹具）+T4（文档）+T5（收口）；「RED 证据可验证化」的四条规则中 E2（哈希核验）与 E3（RED 绑定）是核心，E1/E4 保证证据不会半途而废；「不改 RTM 实体/关系/覆盖率语义」→ 约束 6 + §0.1.3；「单独批准」→ 计划顶部与 §0.1 记录批准依据。
**2. 占位符扫描**：无「待定/后续补充/类似任务 N」。T1 步骤 1 与 T2 步骤 3 是**先实测再处置**的有界出口（既有夹具 lastUpdated 实测决定是否补数据），非占位符。
**3. 命名一致性**：`evidence` / `rawOutputPath` / `rawOutputSha256` / `observedAt` / `M07_TEST_EVIDENCE_CUTOFF` / `LEGACY_TEST_EVIDENCE`，与 run-log `revertEvidence` 与 code-health `definitions.command` 的既有命名同族。
**4. 与既有验收的关系**：AC-11 由 T5 行内回填；AC-9/AC-10 等无关；本计划不触碰 `/wm` 命令语义（新增的是校验与文档义务，命令输入输出不变）。M07 无独立 AC 行——已裁定不新增编号，理由见 §0 表格末行。

---

## 收尾（实现完成后由控制者回填）

### 1. 交付与提交序列

M07 base = `f19682a0`，共 6 个提交：

`bea9e9d1`(T1 schema 可选字段) → `6abbe31c`(T2 E1-E4 + cutoff) → `ad55d6f0`(T3 夹具与计数) → `dddc38ae`(T4 文档同步) → `44c515e5`(T5 收口 + AC-11 回填) → `c909b591`(最终修复波)

（勘误：`dddc38ae` 实为 `dddc38ae`。）

### 2. 审查记录（SDD：任务级 5 轮 + 最终 1 轮 + 修复波 1 + 定向复审 1）

- **任务级**：T1 通过（D-2 边界经「去字段后与 base 深度相等」结构化证明；RED 形态如实记录为 `additionalProperties` 拦截）；T2 通过（四规则语义逐条对照 §0.1.2，legacy 确非阻断，**全 diff 无任何 lastUpdated 增删改**）；T3 通过（六夹具语义独立复算为真、E2 哈希不变量三态一致、auxFiles 经复核为不放松覆盖门禁的唯一最小方案）；T4 通过（逐句与 schema/gate-logic/CLI 点名对应，最危险的越界表述三处均未踩）；T5 通过（回填每个数字与行为断言均经仓库复现，判据原文 609 字符逐字节保留、无新 AC 编号）。
- **整分支最终审查**：**修完再合**——D-2 批准边界**完全干净**（schema 只增一个可选字段、required/additionalProperties/rows/覆盖率语义原样、零删除、零越界新增物）；1 Important = 文档层 `GATE_JSON.testEvidence` 只写 8 键中的 3 个且 `legacy` 同名不同型未说明（`references/rtm-guide.md:91` 等三处）→ 修复波 `c909b591`（3 个 .md，+19/−3）写全 8 键形状 + 阶段作用域精确化；定向复审 ADDRESSED、无新破坏（L0 三计数 672/95/36 未变）。8 项其余搁置 Minor 全部裁定继续搁置（逐条理由见审查记录）。
- **权威门禁运行**：T5 收口 `npm run prepush` 18/18 全绿（PREPUSH_EXIT=0，`44c515e5` 上）；修复波与收尾节为 docs-only，合并前在最终树上复跑一次全量 prepush 作最终确认（结果记于账本；若红则中止合并）。

### 3. 搁置项裁定（最终审查裁定，维持搁置）

`docs/user-guide.md:110`（332）与 `.githooks/pre-push:320`（262）与 `.code-health-governance.json`（selfTestSamples:322）——既有陈旧值，计划 §0 已登记不扩大战场；`samples/README.md:47`「相差 32 条是元数据校验用例」措辞（BASE 既有文本）；`self-test.ts:3021` 死分支（行为等价）；`bad-test-evidence-exitcode-mismatch.json` 非唯一原因（正则可辨）；E2 越界检查 lexical（schema pattern 前置拦截，非对抗面可接受）；`.gitattributes` 在 `w-model-dev/` 可分发单元之外（安装方不跑 self-test，边界已披露）；`auxFiles` 登记与消费解耦（可选增强）；`rtm-guide.md:84` 对 E3 附加前提的简化表述（既有文本）。

### 4. 程序级遗留（非本单元）

- **CHANGELOG 缺口**：`AGENTS.md` §6 要求资产改动同步 `CHANGELOG.md`，但本计划约束 5 与 P2 各期一致**显式禁止触碰**（避免多期并发冲突）。属已批准偏差，须在 M 程序收口时统一补记（P1/P2-A/P2-B/M07 四批）。
- **分发边界**：`w-model-dev/` 拷贝到 autocrlf=true 的仓库时，`valid-test-evidence.json` 的 E2 可能平台性红（`.gitattributes` 在包外）——安装方不跑 self-test，实际影响为零；若未来要求可分发单元自足，须把该行或等价机制纳入包内。
- **`docs/user-guide.md:110` 等陈旧计数**：建议随下次内容性改动统一清偿（已跨三个基线）。
