# P2-B 规则负载性、完整性与回滚证伪 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 补齐门禁可信度的最后两层——「规则确实是负载性的」（S25：剥离规则文本必须复现旧行为）与「声明的清单没有漏网载体」（S31：declared-list + 扫描找未登记载体）；同时落地 S27（revertEvidence 回滚证伪）、S32（评审包确定性 CLI）、S30（L0 载体定量预算断言），并清偿 P2-A 搁置的 3 项 Minor。

**架构：** S25/S30/S27/S31 全部落在既有载体（l0 逻辑测试 / vitest 单测 / run-log schema+门禁 / check-docs-consistency 新维度），**唯一新增脚本是 S32 的 `cli/review-package.ts`**——它会使 cli 计数 44→45、exit-2 计数 43→44，触发一整串门禁强制同步（§2 台账）。任务顺序保证每个提交都绿。

**技术栈：** 既有 tsx + vitest + ajv；零新增依赖。

---

## 0. 实测基线（勘察报告 2026-09-15，worktree @584adb57，全部带 file:line）

| 实测事实 | 对设计的影响 |
| --- | --- |
| `logic/l0-link-audit-logic.ts` 只 import `node:fs`/`node:path`，**无相对 import**；全部规则是单一函数 `auditL0RelativeLinks`（:309）内的分支，不可函数级剥离 | S25「剥离规则」采用**源码变异副本**：把 logic 源文件按唯一子串定位剥掉目标规则块，写入 `os.tmpdir()` 临时副本动态 import——零 import 改写、零 monkey-patch、不 spawn 子进程 |
| run-log schema：`allOf[1]` 绑定 `action ∈ {fix, emergency-fix}` → `basedOnReport`+`artifacts`；同文件有 LEGACY 吸收先例（`LEGACY_VARIANT` 非阻断） | S27 按 AC-8 fallback 新增**一个**条件字段 `revertEvidence`（形态复用 assertionHash 的 command-证据模式）；既有 fix 记录用时间戳 cutoff 吸收为 LEGACY 非阻断，照抄 variant 先例 |
| references 入链实测：43 个文件**零孤儿**（SKILL.md + references 互链全覆盖） | S31 孤儿检测门禁可**先天严格**，豁免清单留空常量（带注释） |
| asset-authoring.md §5（:63-72）阈值现为散文；实测 SKILL.md 正文 124 行、references 43 文件/16438 行/无子目录/最大 2295 行（tla-plus.md）；全仓**无任何**体积/行数断言（grep lineCount = 0） | S30 用 vitest 真实包断言（先例：`l0-link-audit-logic.test.ts:506-518`），钉上限而非现状 |
| check-docs-consistency 单独跑慢的唯一原因：无 `WM_VITEST_COUNT_FILE` 时 spawn 全量 vitest（`collectVitestMeasurements` :628-667，timeout 1_800_000）；pre-push 里 vitest 先行 + 环境变量复用（`.githooks/pre-push:415-423`） | S31 新维度必须是**纯字符串/文件操作**，不得新增任何 spawn；单独跑慢不是本计划要修的问题（如实告知实现者，勿误判为挂死） |
| 新增 cli 脚本的门禁强制面：exit-2 探针（:234-241 白名单外全部）、`checkExit2ScriptCount`（AGENTS.md:22）、`checkConventionsExit2Count`（conventions.md:118 算术三重）、`checkScriptRegistry`（subagent-delegation.md 子串 + SKILL.md .ts 计数 :108/:131）、`EXPECTED_GATE_COUNT=43`（exit2-failure-atomicity.test.ts:62）、`negative-coverage-missing`（NEGATIVE-COVERAGE.md 缺行即红） | S32 的同步清单见 §2 台账，**一处漏改 = pre-push 红**；这正是 P2-A 留下的 tripwire 按设计生效 |
| NEGATIVE-COVERAGE.md 分组：A=28（:23-50）/ B=1（:56）/ C=14（:62-75）；:7/:10 有「43 行」自述 | review-package（无文件输入，负向=未知 flag）进 C 组 14→15，全表 43→44 |

### 0.1 范围裁定（控制者决定，实现者不得擅自变更）

1. **S25 只做 `audit:l0-links` 的 3 条关键规则**（规格 AC-7③ 原文限定「关键 L0 规则」）：① `{{module}}` 占位符规则（logic :418-425）；② L0 分发边界（:460-464，L0 外/非 SKILL.md 目标）；③ 目标存在性（:466-474）。每条规则三态：GREEN（合规输入→无违规）/ RED（违规输入→报违规）/ STRIPPED（同一违规输入 × 剥离副本→**不再报** = 复现旧行为）。若某规则块无法用唯一子串干净剥离，**换相邻规则并在报告中记录替代与理由**（不许放宽 STRIPPED 语义为"注释掉断言"）。
2. **S25 的 fixture 全部用 `os.tmpdir()` 临时目录**（与既有 l0 测试同构），**不进 `samples/`**——进 samples/ 会触发 self-test 引用 + 矩阵声明两张同步义务，而它们不是门禁 fixture（这是测试输入，非门禁样本）。规格「新增 fixture 须同步矩阵」仅在 samples/ 载体上触发，计划显式选择不触发。
3. **S30 断言集**（vitest 真实包测试，全部为**上限**预算，常量带理由注释）：SKILL.md 正文 ≤ 499 行（现 124）；references/*.md 每文件 ≤ 2500 行（现最大 2295）；references 文件数 ≤ 48（现 43）；references 无子目录（现平坦）；references 总行数 ≤ 20 000（现 16 438）；SKILL.md 单个围栏代码块 ≤ 50 行。**>100 行需 TOC 的规则只对 >1000 行的文件断言**（现 5 个：tla-plus/bdd/subagent-delegation/data-models/verifier-spec）——实现时先实测这 5 个有无 TOC，缺者**补 TOC**（小的文档改动，在范围内）；词数类阈值（<150/<200/<500 词）**不断言**（中文字数无可靠确定性度量，按 S04 精神不编码不可测物，计划记录该裁定）。
4. **S27 字段形态**：`revertEvidence: { command: string(minLength 1), description?: string }`（复用 command-证据模式；`expectedExitCode` 不设——回滚复跑的红由 S 在真实执行中出示，G 只验载体存在与形态）。落在 allOf[1]（fix/emergency-fix 共用）；**schema 层 optional、逻辑层 R9 强制**（新记录必须携带；记录时间戳早于 `LEGACY_REVERT_EVIDENCE_CUTOFF` 常量 → `LEGACY_REVERT_EVIDENCE` 非阻断，照抄 LEGACY_VARIANT 结构）。反模式 #45 不新增条目（保住 `maxAntiPattern: 48`），只把 hard-constraints.md:898 的「门禁脚本：无专用脚本」改为指向新 R9——这就是规格 :113「补反模式 #45」的含义（给既有 #45 补确定性挂点）。
5. **S31 两个新维度**：`orphan-reference`（每个 `references/*.md` 须有 ≥1 条来自 SKILL.md 或 references/*.md 的相对入链；豁免常量留空）+ `agents-nav-missing`（每个 `cli/*.ts` 基名须以子串出现在 AGENTS.md——把「AGENTS.md §8 表漂移」这类债变成门禁强制）。落地前实测 AGENTS.md 现状是否已覆盖全部 44 个基名，缺行先补行再上门禁。
6. **M07 不在本计划**：用户已于 2026-09-15 单独批准 M07 的 RTM `testSummary` Schema 变更（裁定 D-2 前置满足），但按「每期独立可审阅、独立可回滚」（规格 §11），M07 在 P2-B 合并后**另立计划**。本计划不得触碰 `rtm.schema.json`。
7. **顺手清偿（P2-A 搁置裁定移交）**：NEGATIVE-COVERAGE.md:24 `:373`→`:381`；:62 `:2342`→`:2344`（变异点）并把该行「所防回归」改为如实表述（实际缺守卫会抛 ENOENT 或退化为 43 条 missing/exit 1，不是「被当作通过」）；AGENTS.md:182 与 references/subagent-delegation.md:313 的 check-samples-coverage 描述补全为四条规则（现状只写两条）。**维持搁置不动**：.githooks/pre-push:320「262 条」旧注释、`.code-health-governance.json` `selfTestSamples:322`、docs-consistency-logic.ts:1309/:231 过时注释、quickstart.md 322/332（P1 裁定仍有效，不扩大战场）。

---

## 1. 全局约束（每个任务都适用）

1. **零新增依赖 / 零新增 Schema 文件**（S27 只改既有 run-log.schema.json 的字段；文件数保持 34）；**不得调用 LLM**。
2. **不升版本号**（package.json / skill-metadata.json / SKILL.md frontmatter / README.md / docs/INSTALL.md 五处镜像不动；`checkVersionConsistency` 会拦）。
3. **不得写 `.w-model/`**（测试临时目录一律 `os.tmpdir()`）。
4. **不得放松任何既有判据**（反模式 #45）；本计划所有门禁改动只允许**新增规则/收紧**。
5. **不触碰** `CHANGELOG.md`、`docs/changes/`、`eval/**`、`.githooks/**`、`package.json` 的 scripts 段（S32 不加 npm 别名，调用形态 = `npx tsx w-model-dev/scripts/cli/review-package.ts`，先例 plan-chunks）。
6. **S32 命名与行为契约**：`w-model-dev/scripts/cli/review-package.ts`；参数 `--repo=<dir>` `--base=<sha>` `--head=<sha>` `--out=<file>`（`--repo` 缺省为 cwd；重复 flag → ARG_INVALID；`--d4-invalid-argument` 这类未知 flag → ARG_INVALID **在任何磁盘写入之前**）；成功 exit 0，stdout 单行 `REVIEW_PACKAGE_JSON {path, base, head, commits, bytes}`；文件内容 = 提交列表（`git log --oneline base..head`）+ stat（`git diff --stat`）+ `-U10` 全 diff + 头尾元信息，**不含任何时间戳**（同输入同字节 = 可复现）；git 调用一律走 `lib/run-sync.ts` 的 `runSync`（不进 SYNC_PROCESS_EXCEPTIONS）；写盘前先完成全部校验（保证原子性探针在 `--d4-invalid-argument` 下状态零污染）。
7. **计数契约同步义务**：凡提交使计数变化，同一提交内完成 §2 台账全部行；门禁强制的计数（§2 标注）漏一处 = pre-push 红。
8. **S25 不得给 pre-push 加任何逐文件全库扫描**（规格 §4.3 边界）；两态 fixture 是测试内临时目录。
9. **S31 新维度零 spawn**；扫描范围用既有采集数据（cli readdir / skillPkgDocs / references readdir），不新增全仓遍历。
10. **每任务验证清单（P2-A 三次同类红灯的教训，强制）**：(a) `npm run lint:security` exit 0 且新增发现 0；(b) 触及文件的聚焦 vitest **加**全局契约守卫组（`vitest-project-split.test.ts`、`run-sync.test.ts`、`gate-report.test.ts`、`check-samples-coverage.test.ts`、`docs-consistency-logic.test.ts`、`skill-metadata.test.ts`）或直接全量 `npx vitest run --config config/vitest.config.ts`；(c) 凡新增「必需文件/必需字段」，先全仓 grep 消费该契约的夹具与测试并同步。T4（契约面最大）与 T7 必须跑全量 vitest。
11. **TDD**：每个新门禁规则/断言先写会红的用例（RED 证据入报告），再实现。
12. **诚实性**：报告中的每条证据命令必须真实跑过并贴真实输出（P2-A 教训：AC-7 行内 `grep -c '^| '`=43 实为 49 被审查打回）；不得声称「已获用户批准」——本环境无用户在场，实现者按技术必要性自行判定并如实归因。
13. worktree 内先 `npm install`（新 worktree 无 node_modules）。
14. **不新增反模式条目**（`maxAntiPattern: 48` 不变）；不新增 pre-push 项（18 不变）；不新增 run-log action 枚举值（27 不变）。

---

## 2. S32 计数契约同步台账（T4 的验收清单；标注 = 门禁强制）

| # | 位置 | 现值 | 改后 | 强制 |
| --- | --- | --- | --- | --- |
| 1 | `w-model-dev/scripts/cli/` 实物 | 44 .ts | 45 .ts | — |
| 2 | AGENTS.md:22 | 「43 个脚本」 | 「44 个脚本」 | ✅ checkExit2ScriptCount |
| 3 | references/conventions.md:118 | 「= 43（26 个 check-* + 17 个工具 CLI…）」 | 「= 44（26 个 check-* + 18 个工具 CLI…）」算术自洽 | ✅ checkConventionsExit2Count |
| 4 | SKILL.md:108 与 :131 | 「44 个 .ts」 | 「45 个 .ts」 | ✅ checkScriptRegistry |
| 5 | references/subagent-delegation.md:305 | 「44 个 .ts」 | 「45 个 .ts」 | 散文（一并改） |
| 6 | references/subagent-delegation.md §6.4 dispatch-matrix | — | 新增 review-package 行（格式照 :327 plan-chunks 样例） | ✅ checkScriptRegistry 子串 |
| 7 | AGENTS.md §8 脚本导航表 | — | 新增 review-package 行 | 散文（但 T5 将使它强制） |
| 8 | samples/NEGATIVE-COVERAGE.md | 43 行 / C=14 / :7 与 :10 自述「43」 | 44 行 / C=15 / 自述 44；新行机制=invocation、证据=review-package 自身 cli 测试的 exit-2 断言 `文件:行号`、所防回归如实 | ✅ negative-coverage 规则 |
| 9 | `exit2-failure-atomicity.test.ts:62` | `EXPECTED_GATE_COUNT = 43` | 44 | ✅ 集合守卫 :268 |
| 10 | 新测试文件登记 | — | 若含 `node:child_process` import 或 runSync/execFile 调用 → `config/vitest.config.ts` SUBPROCESS_TEST_FILES | ✅ vitest-project-split 双向 |
| 11 | security baseline | — | 若 review-package.ts 有新扫描发现 → 按该文件既有风格加带理由的 eslint-disable 或 `--regenerate`（优先前者，不扩大豁免面） | ✅ checkBaselineSync/lint:security |
| 12 | review-package.ts 头注 | — | 用法/退出码/四条行为契约（照 plan-chunks.ts:1-26 风格） | 散文 |

---

## 3. 任务分解

### 任务 1（S27）：revertEvidence 回滚证伪协议

- [ ] **步骤 1**：`w-model-dev/schemas/run-log.schema.json`：在根 `properties` 加 `revertEvidence`（`type: object`，`required: ["command"]`，`properties: { command: {type:string, minLength:1, description:…}, description: {type:string, description:…} }`，顶层 `description` 写明「S-fix 复现测试的回滚证伪声明：执行 command 使复现测试回到失败态（AC-8）」——`checkSchemaFieldDescriptions` 会查）；定义挂进 `allOf[1]` 的 then 不必 required（逻辑层 R9 管强制）。
- [ ] **步骤 2**：`logic/run-log-logic.ts` 新规则 **R9**：`action ∈ {fix, emergency-fix}` 的记录必须携带合法 `revertEvidence.command`（非空字符串）；缺失/非法 → blocking violation；记录 `timestamp` < `LEGACY_REVERT_EVIDENCE_CUTOFF`（常量，取本计划合并日，注释说明）→ 非阻断 `LEGACY_REVERT_EVIDENCE` 标注（**结构照抄 LEGACY_VARIANT**，含 `checkRunLog` 返回结构的 legacy 数组与 CLI 呈现）。`check-run-log.ts` CLI 输出 JSON 带上 r9 计数（照既有 r1-r8 字段风格）。
- [ ] **步骤 3**：TDD——先在 self-test / run-log 夹具写会红的用例（合法携带=绿、缺失=红、畸形 command=红、cutoff 前=绿+legacy 标注），RED 证据入报告；同步更新所有既有 `action=fix` 样本夹具（consumer 搜索：`grep -rn 'emergency-fix\|"action": *"fix"' w-model-dev/scripts/samples/ w-model-dev/scripts/__tests__/`）。
- [ ] **步骤 4**：文档同步：hard-constraints.md #45 的「门禁脚本」行改为指向 R9（:898）；AGENTS.md §8 check-run-log 行「R1-R8」→「R1-R9」；references/command-reference.md 的 run-log 节补 R9（该文档无数值门禁，如实写）。
- [ ] **验证**：约束 10 全套 + `npx tsx w-model-dev/scripts/cli/check-run-log.ts <含 fix 的合法样本>` exit 0 且含 r9；`npm run self-test` 332+新增 全过。
- [ ] **Commit**：`feat(gates): require revertEvidence on fix actions via run-log R9 (S27)`

### 任务 2（S25）：L0 规则负载性三态 fixture

- [ ] **步骤 1**：新测试 `w-model-dev/scripts/__tests__/l0-rule-loadbearing.test.ts`（纯 vitest，无子进程）：顶部实现 `stripRule(source, uniqueSubstring): string`（唯一子串定位 → 删除所在规则块；实现可按 ①②③ 各自的块结构分别写剥离函数，**禁止**通用正则瞎删）与 `loadStripped(tempDir)`（写副本 → `import(pathToFileURL(...))`）。
- [ ] **步骤 2**：三条规则 × 三态（§0.1.1）。RED fixture 例：①违规 = 非 templates/ 文件含 `{{module}}` 链接占位；②违规 = L0 文件直链 L1 目标（或非 SKILL.md 的 L0 外目标）；③违规 = 指向不存在目标。每条断言：GREEN 合规根 → 该规则类零违规；RED 违规根 → 报该违规；STRIPPED 同一违规根 × 剥离副本 → **该违规消失**（且副本对合规根仍正常工作，防"剥坏了函数"假阳性）。
- [ ] **步骤 3**：若子串定位在实现时失效（源码与 :418-425/:460-464/:466-474 行号漂移），以**唯一子串**为准重新定位；确实剥不开的规则按 §0.1.1 换规则并报告。
- [ ] **验证**：约束 10 全套；确认本测试无 spawn → 不需要 SUBPROCESS_TEST_FILES 登记（写进报告）。
- [ ] **Commit**：`test(l0): prove three key L0 rules are load-bearing via stripped-copy fixtures (S25)`

### 任务 3（S30）：L0 载体定量预算断言

- [ ] **步骤 1**：先实测：SKILL.md 围栏代码块行数分布；5 个 >1000 行 references 的 TOC 有无。结果入报告。
- [ ] **步骤 2**：新测试 `w-model-dev/scripts/__tests__/asset-budget.test.ts`（读真实 `w-model-dev/`，先例 `l0-link-audit-logic.test.ts:506-518`）：按 §0.1.3 断言集，常量集中为 `ASSET_BUDGET` 对象、每项注释引 asset-authoring.md §5 行号 + 当前实测值（照 L0_BASELINE 的 rebaseline 注释风格）。
- [ ] **步骤 3**：若 5 个大文件缺 TOC → 逐个补最小 TOC（标题链接列表，放文件头部引言后）；缺几个补几个，如实报告。TOC 判定标准在测试内写清（首个二级标题前存在 ≥3 条指向本文锚点的链接列表，或既有等价形态）。
- [ ] **验证**：约束 10 全套；`npm run audit:l0-links` 不受 TOC 新链接影响（相对锚点链接不在 L0 审计范围？——实测：若锚点链接触发 `violations`，改用纯文本列表形态并记录）。
- [ ] **Commit**：`test(budget): pin L0 carrier size budgets as deterministic caps (S30)`

### 任务 4（S32）：评审包 CLI + 计数契约同步

- [ ] **步骤 1**：TDD——先写 `w-model-dev/scripts/__tests__/review-package-cli.test.ts`：临时 git 仓（`git init` + 两个提交，经 `runSync`）上断言：成功写出文件且字节级可复现（同输入跑两次内容一致、无时间戳）；未知 flag → exit 2 + stdout ERROR_JSON 且**目标路径不出现文件**（原子性）；缺参/重复 flag/坏 rev → exit 2。该测试含真实子进程 → 登记 SUBPROCESS_TEST_FILES（台账 #10）。
- [ ] **步骤 2**：实现 `w-model-dev/scripts/cli/review-package.ts`（§1.6 契约；结构照 plan-chunks.ts：头注/parseFlagValue/exitWithError/runMain）。diff 生成顺序固定：header、`git log --oneline base..head`、`git diff --stat base..head`、`git diff -U10 base..head`。
- [ ] **步骤 3**：完成 §2 台账 12 行同步（NEGATIVE-COVERAGE.md 新行 + :7/:10 自述、EXPECTED_GATE_COUNT 44、AGENTS.md:22、conventions.md:118、SKILL.md:108/:131、subagent-delegation.md:305+§6.4 行、AGENTS.md §8 行、台账 #11 security、#12 头注）。
- [ ] **验证**：约束 10 全套 + **全量 vitest**（本任务契约面最大）+ `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0 + `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 不可行（>975s）→ 用 prepush 兜底，报告中如实写明用 `WM_VITEST_COUNT_FILE` 快路径的聚焦验证（`node -e` 模拟环境变量 + 只跑 docs-consistency 的聚焦单测）替代。
- [ ] **Commit**：`feat(cli): add deterministic review-package CLI and sync count contracts (S32)`

### 任务 5（S31）：check-docs-consistency 完整性审计双维度

- [ ] **步骤 1**：实测 AGENTS.md 现状已含全部 44 个 cli 基名（含 T4 新增）；缺则先补行。
- [ ] **步骤 2**：`logic/docs-consistency-logic.ts` 新增两个 check（结构照既有 check* 先例；`DocConsistencyInput` 加输入字段；`buildDocConsistencyReport` :751+ 挂载）：`checkOrphanReferences`（§0.1.5，入链解析覆盖 SKILL.md + references/*.md 的相对 .md 链接，豁免常量空数组带注释）与 `checkAgentsNavCoverage`（cli 基名 × AGENTS.md 子串）。违规码 `orphan-reference` / `agents-nav-missing`。
- [ ] **步骤 3**：CLI 侧（`cli/check-docs-consistency.ts` main :683+）喂入：references readdir（已有 :713）、cli readdir（已有 :730）、SKILL.md/references 文件内容（复用 `collectSkillPkgDocs` :355-375 或定向读取，零新增 spawn）。
- [ ] **步骤 4**：TDD——docs-consistency-logic.test.ts 变异用例（先例 :2342 风格）：造孤儿 references → 红；造未登记 cli 基名 → 红；豁免名单生效 → 绿。
- [ ] **验证**：约束 10 全套；确认真实包两维度零违规（门禁生于绿）。
- [ ] **Commit**：`feat(docs-consistency): add orphan-reference and agents-nav completeness checks (S31)`

### 任务 6：清偿 P2-A 搁置 Minor

- [ ] NEGATIVE-COVERAGE.md:24 `:373`→`:381`；:62 `:2342`→`:2344` 且第 4 列改写为如实表述（§0.1.7）；核对改后两行仍满足第 4 条规则（机制/证据列不变）。
- [ ] AGENTS.md:182 与 references/subagent-delegation.md:313 的 check-samples-coverage 描述补全为四条规则（fixture 登记 / 引用闭环 / 矩阵声明 / 负向覆盖 missing+dangling），措辞与 cli/check-samples-coverage.ts:8-31 头注一致。
- [ ] **验证**：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0；约束 10 的 (a)(b)。
- [ ] **Commit**：`docs(samples): pay down P2-A parked pointer and description minors`

### 任务 7：收口——全量门禁 + AC 回填 + 计划收尾节

- [ ] `npm run prepush`（`sh -c '…; echo $?'` 直捕退出码，后台 + 轮询，约 20 分钟；预期 18/18 + `PREPUSH_EXIT=0`；vitest 失败按诚实性分类处置）。
- [ ] 一致性自查：`audit:l0-links`（三计数 vs L0_BASELINE——S30 补的 TOC 若改变 relativeLinkCount须按 rebaseline 流程更新基线并逐条说明）；`self-test`（332+新增）；`check-samples-coverage` exit 0；`git diff --stat <base>..HEAD -- w-model-dev/scripts/cli/`（恰 1 新增：review-package.ts）。
- [ ] 规格 §13 回填（只加状态不改判据）：AC-7 行内 ③「未达成（P2-B 的 S25）」→ **已达成（P2-B）** + 可复现证据命令（**每条命令真实跑过并贴输出**——P2-A 49≠43 教训）；AC-8 行尾追加 **已达成（P2-B）** + R9/revertEvidence 证据。`git diff --numstat` 仅规格文件两行。
- [ ] 本计划文件追加「收尾」节（审查记录、搁置裁定、M07 移交清单：字段形态决定、rtm.schema.json + check-run-log/testSummary 门禁联动、testSummary 消费方搜索义务）。
- [ ] **Commit**：`docs(spec): record P2-B acceptance status for AC-7③ and AC-8`

---

## 自检结果

**1. 规格覆盖度**：S25→T2；S26/S28/S29 已在 P2-A；S27→T1；S30→T3；S31→T5；S32→T4；M07→§0.1.6 移交独立计划（用户 2026-09-15 已单独批准 Schema 变更）；AC-7③→T7 回填；AC-8→T1+T7 回填；:213「同步计数器 + dispatch-matrix」→T4 台账；§4.3「逐文件跑不得当门禁」→约束 8。
**2. 占位符扫描**：无「待定/后续补充」。T3 步骤 1 与 T5 步骤 1 是**先实测再动手**的有界出口，不是占位符。
**3. 命名一致性**：`review-package.ts` / `REVIEW_PACKAGE_JSON` / `revertEvidence` / `LEGACY_REVERT_EVIDENCE` / `orphan-reference` / `agents-nav-missing` / `l0-rule-loadbearing.test.ts` / `asset-budget.test.ts`，与既有命名风格一致。
**4. 与既有验收的关系**：AC-8 由 T1 落地、T7 回填；AC-7③ 由 T2 落地、T7 回填；AC-11 复验项（无新依赖/新 hook/新 npm script）由约束 1/5 保证，T7 用 `git diff <base>..HEAD -- package.json` 为空复验。

---

## 收尾（实现完成后由控制者回填）

### 1. 交付与提交序列

P2-B base = `dd8d7016`（本计划），HEAD 见下方序列，共 11 个提交（9 个实现/修复 + 本收尾节）：

`96f93583`(T1/S27 revertEvidence→R10) → `b9410314`(T2/S25 三态) → `3e3b521f`(T1-fix L0 重基线+镜像) → `01907a75`(T3/S30 预算) → `b4026cec`(T3-fix 溯源注释) → `262e2d71`(T4/S32 评审包 CLI+台账) → `dbba33f7`(T5/S31 双维度) → `f76b2367`(T6/清偿) → `9256f597`(T7/AC 回填) → `5ea0f508`(最终修复波)

### 2. 审查记录（SDD：任务级 7 轮 + 最终 1 轮 + 修复波 1 + 定向复审 1）

- **任务级**：T1 通过带 1 Important→修复轮 1（L0 重基线红灯 + 注释失准 + data-models/CONTRIBUTING 镜像，复审 4/4 ADDRESSED）；T2 通过（0C/0I）；T3 通过带 1 Important→修复轮 1（ASSET_BUDGET 溯源注释，复审 ADDRESSED）；T4 通过（0C/0I；实现者被会话超时终止于等全量 vitest，控制者补跑 85/1983/exit0 并代提交 262e2d71，审查者逐字节对账无夹带）；T5 通过（run-sync.ts 38 行逐行核实为纯行号钉扎同步）；T6 通过（五处逐字核验）；T7 通过（字节级重建证实判据零改动 + 全部承重证据可复现；prepush 18/18 绿）。
- **整分支最终审查**：**修完再合**——1 Important（samples/README.md:46 计数漏网 332/300）+ 3 Minor 进修复波（AC-7③「无其他规则兜底」措辞限定、CONTRIBUTING:104 与 samples/README:64 四条规则口径）；其余 15 项搁置 Minor 全部裁定继续搁置（逐条理由见审查记录）；已申报偏差（R9→R10、:2344→:2347、T4 代提交、TOC 判据按实测形态）均有据合理。修复波 = `5ea0f508`（3 文件 +4/−4），定向复审随后执行并记于账本。
- **权威门禁运行**：T7 收口 `npm run prepush` 18/18 全绿（PREPUSH_EXIT=0，9256f597 上）；本收尾节与修复波为 docs-only 追加，合并前在最终树上复跑一次全量 prepush 作最终确认（结果记于账本；若红则中止合并）。

### 3. 搁置项裁定（最终审查裁定，维持搁置）

T1 emergency-fix 用例断言对称性；T2 fs.rm Windows EPERM 韧性、①STRIPPED 白名单分支健康检查、报告行号注记；T3 报告 15/17 笔误、readdir 三份重复；T4 review-package 7 位缩写 range / writeFileSync 非 tmp+rename / --out= 空串无专测；T5 orphanAuditDocs 重复读、孤儿判定不校验入链目标存在（由 internal-links 正交承担）、两份 .md 存量 prettier（非门禁面）；quickstart.md:22「322/322」（已落后两个基线，随下次内容性改动顺带清偿）；既有 .code-health-governance.json selfTestSamples:322、docs-consistency-logic.ts 过时注释（行号已漂移至约 :1414/:246）、check-docs-consistency 单独跑慢——均维持搁置。

### 4. M07 移交清单（独立计划；用户 2026-09-15 已单独批准 RTM `testSummary` Schema 变更——裁定 D-2 前置满足）

1. **范围**：把 code-health 的 redEvidence/assertionHash 证据模式扩展到阶段 5-8 RTM `testSummary`（`rtm.schema.json` + 消费门禁）；与 P2-B 的 R10 revertEvidence 同族但载体不同（RTM vs run-log），设计时须明确两者边界避免双写同一证据。
2. **前置实测**：rtm.schema.json `executionSummary.{unit,integration,system,acceptance}TestSummary` 字段（total/passed/failed/pending/coverage 全 required，:87-96）；testSummary 的生产者与消费者全仓搜索义务（约束 10c）。
3. **计划缺口教训入法**（P2-A 三次 + P2-B 一次同类）：任务级验证清单必须含 lint:security、全量 vitest 或全部全局契约守卫（现为**十文件**：八守卫 + gate-report + docs-consistency-logic）、新增必需字段/文件先全仓 consumer 搜索；**触及 .md 链接须同步 L0_BASELINE**（P2-B 教训 ④）。
4. **流程**：沿用 SDD + worktree；counts 契约若 rtm.schema.json 字段变化不触发文件计数门禁，但 checkSchemaFieldDescriptions 管 description。
