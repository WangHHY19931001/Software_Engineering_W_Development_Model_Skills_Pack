# P2-A 门禁负向覆盖与失败原子性 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让"门禁真的会咬人"成为一条**被强制的不变量**而不是一次性的观察——每个 exit-2 门禁都必须有一条**会失败的**负向案例（fixture / 参数 / 变异副本三种机制之一），并断言它失败后**没有污染状态**；同时消灭现存 3 处"仅存在不算"的弱断言。

**架构：** 不新增门禁脚本，只改既有门禁 + 既有测试 + 新增一个测试文件与一个声明式清单。核心手法是"先补事实、再上规则"：先把缺失的负向案例与原子性断言补齐，再让 `check-samples-coverage.ts` 把"每个 exit-2 门禁有负向案例"变成会红的规则——这样每一步提交都是绿的，而规则一旦落地就不会再退化。

**技术栈：** 既有确定性门禁（`tsx` + vitest + `check-docs-consistency` + `check-samples-coverage`）；零新增依赖。

---

## 0. 本计划的范围修正（必读，先于一切实现）

本计划的**范围是实测出来的，不是照抄规格的**。设计规格 §4.3 的前提是「W-model 的 43 个 exit-2 门禁 + 332 条 self-test **只**证明'合法输入通过'；**不**证明'非法输入会失败'」。**实测否证了这个前提**：

| 实测事实（证据见 §1 的审计台账） | 对规格前提的影响 |
| --- | --- |
| `self-test.ts` 已有 **213** 条 `expectedPassed: false` 用例，覆盖 **207** 个 fixture 标识 | 负向覆盖**并非为零**，而是已大面积存在 |
| 43 个 exit-2 门禁中 **27 个**已有 fixture 级负向案例，且断言**强**（`expectedReasonPatterns` / `expectedRule` / `expectedExitCode` / `expectedViolations`） | "不证明非法输入会失败"**不成立** |
| **3 处是弱断言**（`self-test.ts:378`、`:1450`、`:1557`，`expectedPassed:false` 但**无任何** reason/exitCode 断言） | AC-7 明确要治的"仅存在不算"→ 真实缺口，必修 |
| `check-samples-coverage.ts` 的三条规则（`:233-246`）只查"登记 / 引用闭环 / 矩阵声明"，**从不解析 `expectedPassed`** → 一个门禁零负向案例也能通过 | M06 的真实缺口：**负向覆盖没有被强制** |
| `samples/README.md:10` 的覆盖矩阵是 5 列，**无"所防回归"列** | S28 的真实缺口 |
| 「失败后状态逐字节不变」的断言**只存在于 `__tests__/` 的 code-health 区**（如 `code-health-archive-boundary.test.ts:387`、`code-health-cli.test.ts:717`），**fixture 级为零** | S26 的真实缺口 |
| 全部 43 个门禁的 exit-2 路径**已被 `check-docs-consistency.ts:217-340` 的中心探针在运行时覆盖**（断言 `status===2` 且 `ERROR_JSON` 的 `category ∈ 6 类枚举`、`rule` 匹配 `/^P0-[1-9][0-9]*$/`） | 工具类 CLI 的负向输入**是参数而非 fixture**，不该被要求造 fixture |

**因此本计划采纳实测范围**：不做"43 个门禁各造负向 fixture"（那是给不存在的缺陷写指引，违反已采纳的 S04「对照不复现失败就停下、不要写这条指引」与反模式 #47 的精神），而是做三件真事：

1. **补齐 3 处弱断言**（让"存在"变成"会咬人"）；
2. **把负向覆盖变成强制不变量**：新增声明式清单 + `check-samples-coverage.ts` 第 4 条规则，逐个门禁登记其负向机制（fixture / 参数 / 变异副本），缺登记即红；
3. **补上 S26 的真实缺口**：在测试层对每个 exit-2 门禁断言"负向路径失败后状态逐字节不变"。

**配套范围决定（须向用户报告，不是本计划擅自扩大）**：

- **M07 移出 P2**：裁定 D-2 要求 RTM `testSummary` 的 Schema 变更**单独批准**，故 M07 须自成一个"Schema 变更批准 + 计划"单元，不得包裹在本计划内。
- **P2 拆为 P2-A / P2-B**：设计规格 §11 要求每期"独立可审阅、独立可回滚"。P2-A = M06 + S26 + S28 + S29（负向覆盖、失败原子性、矩阵列、测试替身保真）；P2-B = S25 + S31 + S32 + S30 + S27（规则负载性两态 fixture、完整性审计、评审包 CLI、定量预算断言、revertEvidence）。**本文件只覆盖 P2-A**；P2-B 另立计划。

### 0.1 本计划的勘误（由任务 2 的实现者发现、审查者独立复核后修正）

| # | 原写法 | 实际 | 处置 |
| --- | --- | --- | --- |
| **E1** | 多处以 `npm run check:samples-coverage` 作为验证命令 | **该 npm 脚本不存在**（`package.json` 里 `grep -c 'check:samples-coverage'` = 0；易与 `check:coverage`（另一个脚本 `check-requirement-coverage.ts`）混淆）。正确形式是本仓既有惯例的 CLI 直调：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | 本文件已全文改写为正确命令；**不新增 npm 脚本别名**（那会改动 `package.json`，超出本计划授权面） |
| **E2** | §2 台账写「A 组 **27** 个」「C 组 **13** 个」 | 实测枚举为 **A = 28**、**C = 14**（B 组 3 个中有 2 个与 A 重叠，独有 `check-tla-bdd-sync`）；三组名字**并集仍恰为 43** | 本文件已改为 28 / 14；**任务 5 回填 AC-7 时须按校正后的标签叙述**。清单本身（43 行）**未受影响**——审查者已独立完成集合比对，确认与门禁集合精确等集 |

> 两处都是**计划文档的错误**，不是实现错误；据 SDD，计划强制与计划自身出错同属必须显式留痕的事项，故记于此。


---

## 1. 全局约束（每个任务都适用）

**裁定与架构约束**

1. **零新增依赖 / 零新增 Schema**；**不得调用 LLM**。
2. **不升版本号**（`package.json` / `w-model-dev/skill-metadata.json` / `SKILL.md` frontmatter / `README.md` / `docs/INSTALL.md` 五处镜像一律不动）。
3. **不得写 `.w-model/`**（测试若需要临时项目目录，一律用 `os.tmpdir()` 下的临时目录）。
4. **不得放松任何既有判据**：不得为了让测试变绿而删断言、改期望值、放宽门禁阈值（反模式 #45）。
5. **不得触碰** `docs/superpowers/` 历史记录、`CHANGELOG.md`、`docs/changes/`。
6. **只改本计划点名的文件**。**特别注意：本计划不打算新增 `w-model-dev/scripts/cli/*.ts`**（S32 的评审包 CLI 属 P2-B），因此 §2 的 cli 计数契约（`44 个 .ts` / `43 个脚本`）**不应发生变化**——若你的实现让它们变了，说明越界了，停下来报告。

**仓库硬契约（改坏即门禁红）**

7. **`check-samples-coverage.ts` 的三条既有规则与消息文案不得改动**（`check-samples-coverage.test.ts` 断言它们）；新规则是**追加**第 4 条。
8. **`samples/README.md` 覆盖矩阵的解析契约**：`check-samples-coverage.ts:185-199` 只要求每个**顶层子目录**作为某行的**第一个单元格**出现（反引号会被剥掉）。新增列**不得**破坏"第一单元格 = 目录名"这一契约。
9. **所有 CLI 脚本不得直接 `process.exit(...)`**（`cli-natural-exit.test.ts:139-148` 静态扫描全部 `scripts/cli/*.ts`）——本计划新增测试文件若 spawn CLI，只做读/断言，不写脚本。
10. **新增会启动子进程的测试文件必须登记进 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES`**，否则 `vitest-project-split.test.ts:95-112` 会红（判定口径：源码含 `from 'node:child_process'` 或调用 `runSync(/execSync(/spawnSync(/execFile(`，且未被 `vi.mock('node:child_process')`）。本计划的任务 3 会新增这样一个文件。
11. **覆盖率阈值只统计 `logic/` + `lib/`**（`config/vitest.config.ts:98-101`：stmts 75 / branch 65 / funcs 85 / lines 75）——新增测试文件不影响阈值，但**修改 `logic/` 或 `lib/` 下实现文件会影响**，须确保新增分支被覆盖。
12. **L0 链接计数基线**：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts:38-40` 钉死 `{ relativeLinkCount: 670, l1Only: 93, placeholders: 36 }`。任何在 `w-model-dev/` 的 L0 文档（`SKILL.md` / `references/` / `templates/` / `examples/` / `subagent/` / `schemas/`）里增删相对链接的改动都要重基线（跑 `npm run audit:l0-links` 取真实三数 + 按该文件头注释风格加一行）。
13. **安全基线**：改动 `w-model-dev/scripts/**/*.ts` 若引入新的 eslint-plugin-security 发现，`security-scan`（pre-push 第 6 项）会红 → 需 `npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate`。指纹是**行内容敏感**的（`computeFindingHash` 为 `sha256(file + "\0" + ruleId + "\0" + 归一化行内容)`，行号/列号不参与），所以"在发现之上插入行"安全、"改被标记行的内容"会变成新发现。

**验证纪律**

14. 每个任务收尾**必须实跑**该任务"预期"节列出的命令，把**真实输出**写进报告；不得以推理代替运行。
15. **任务级验证**：`npm run self-test`（332 条基线）、该任务点名的 vitest 文件、必要时 `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`。**`npm run prepush`（18 项，约 20 分钟）只在最后任务跑一次**。
16. **诚实性**：vitest 有本仓库**已记录的并行抖动**（`docs/changes/vitest-parallel-flakiness-finding.md`：同一命令同一代码两次运行失败数可差 10 倍，基线提交同样复现，阻断推送但非真实回归；配置已把子进程类文件拆到 `cli-serial` 串行）。若出现 1–3 个失败：先看形态是否在已记录抖动内，再**聚焦重跑该文件一次**；判定为抖动须在报告里写明失败文件名、断言原文、聚焦重跑结果与依据。**不得把真实失败说成抖动，也不得把抖动说成绿。**

---

## 2. 审计台账（本计划的事实基础；实现时按此逐条对照）

**43 个 exit-2 门禁的负向覆盖现状**（登记清单的正确性由任务 2 的门禁强制）：

| 组 | 门禁 | 负向案例机制 | 现状 |
| --- | --- | --- | --- |
| **A. 已有强负向 fixture（28）** | `check-verifier-output` / `check-artifact-gate` / `check-requirement-graph` / `check-tla-model` / `check-bdd-model` / `check-budget` / `check-run-log` / `check-maturity` / `check-checkpoint` / `check-code-tla-consistency` / `check-rootcause-report` / `check-preventive-review` / `check-iceberg-sweep` / `check-role-dispatch` / `check-state-machine-consistency` / `check-codegraph-queries` / `check-opsx-artifacts` / `check-openspec-archive` / `check-requirement-coverage` / `check-exemption` / `check-design-contract-consistency` / `check-signature-chain` / `check-archive-integrity` / `code-health-gap` / `code-health-tests` / `code-health-apply` / `code-health-duplicates` / `code-health-phase1` | fixture（`samples/<area>/bad-*`）+ `expectedPassed:false` 或等价断言字段 | 已有，**登记即可**（无需新增 fixture） |
| **B. 弱断言，须强化（3 用例）** | `check-artifact-gate`（`self-test.ts:378`）· `check-preventive-review`（`:1450`）· `check-tla-bdd-sync`（`:1557`） | fixture 已有但**无断言机制** | 任务 1 强化 |
| **C. 无 fixture 概念，负向输入是参数（14）** | `check-docs-consistency` / `check-samples-coverage` / `code-health-archive` / `code-health-ledger` / `doctor` / `ensure-codegraph-opsx` / `metrics-report` / `plan-chunks` / `platform-deps-install` / `security-scan` / `wm-export-evidence` / `wm-status` / `wm-verify-evidence-source` / `wm-write`（其中 `check-docs-consistency` 的负向覆盖在 `docs-consistency-logic.test.ts` 的**变异副本**用例里） | **参数**（`--d4-invalid-argument` 等）或**变异副本** | 已在中心探针/`__tests__` 覆盖；任务 2 登记机制 + 任务 3 补原子性断言 |

> **注**：C 组里 `wm-write` / `metrics-report` / `wm-status` / `plan-chunks` / `platform-deps-install` / `security-scan` / `wm-export-evidence` / `wm-verify-evidence-source` 已有 CLI 级 vitest 的 exit-2 断言（如 `wm-write.test.ts`、`metrics-report.test.ts`、`project-read-validation.test.ts:100`）。任务 2 须**逐个核实**并在清单里写明其**证据位置**；核实不到的才是真正要补的缺口。

**关键行号（实现时直接用）**

- 覆盖规则：`w-model-dev/scripts/cli/check-samples-coverage.ts:51`（`EXEMPT_DIRS`）、`:54`（`SKIP_NAMES`）、`:65-126`（引用提取）、`:128-165`（未登记 fixture 扫描）、`:167-183`（悬挂引用）、`:185-199`（矩阵未声明）、`:233-247`（三条规则与退出码）。
- self-test 用例接口：`w-model-dev/scripts/cli/self-test.ts:129-137`。
- 三处弱断言：`self-test.ts:378`、`:1450`、`:1557`。
- 覆盖矩阵表头：`w-model-dev/scripts/samples/README.md:10`。
- exit-2 探针与计数：`w-model-dev/scripts/cli/check-docs-consistency.ts:217-340`；`w-model-dev/scripts/logic/docs-consistency-logic.ts:320-369`。
- 原子性断言的既有范例（照其风格写）：`w-model-dev/scripts/__tests__/cli-natural-exit.test.ts:299-321`（sha256 比对原文件未被改动）、`code-health-cli.test.ts:717`、`code-health-archive-boundary.test.ts:360-390`。

---

### 任务 1：消灭 3 处"仅存在不算"的弱断言（M06 的"仅存在不算"）

**信号：** 3 条负向用例写了 `expectedPassed: false` 却**没有任何断言机制**，即"负向案例存在"但"不会咬人"——若被检行为悄悄变成通过，这 3 条不会红。

**文件：**
- 修改：`w-model-dev/scripts/cli/self-test.ts`（3 处用例）

- [ ] **步骤 1：实测每条用例的**真实**失败原因。** 对 3 个 fixture 逐个跑对应门禁，把**真实**输出记下来（这是补断言的事实依据，不得凭猜）。三个 fixture：`samples/gate/valid-phase6.json`（`:378` 的用例）、`samples/preventive-review/valid-completeness.json`（`:1450`）、`samples/tla-bdd-sync/bad-transition-mismatch.json`（`:1557`）。
  先定位每个用例所属的 runner 与它调用的校验函数（读 `:378` / `:1450` / `:1557` 附近 ±40 行），再用对应的 `npm run` / `npx tsx` 入口对**真实 fixture** 跑一次，收集失败原因字符串。

- [ ] **步骤 2：为每条用例补"会失败"的断言。** 按该用例所在接口已有的断言字段补（不要新造字段）：`expectedReasonPatterns: [/.../]`（或该 runner 的等价字段，如 `expectedViolations` / `expectedRulesFailed` / 对 BDD 用 `expectedExitCode`）。断言必须命中**步骤 1 实测到的**原因要点，而不是"能匹配任意字符串"的宽正则——**写完后自问：如果把被检逻辑改成错误的实现，这条断言会不会红？不会红就再收紧。**

- [ ] **步骤 3：跑基线确认强化后仍全绿。** 运行：`npm run self-test`
  预期：exit 0，且末行汇总的样本数**与改动前一致**（强化断言不新增用例）。若某条新断言**红了**，说明你写错了pattern（或该 fixture 的失败原因与预期不同）——按实测原因修正，**不得**为了让基线变绿而删掉新断言。

- [ ] **步骤 4：证明新断言确实能失败（S28 纪律）。** 对 3 条中的**至少 1 条**做一次"让它红"的验证：临时把那条例的 pattern 改成必然不匹配的值（如 `/__nope__/`），跑 `npm run self-test` 确认**它确实失败**，然后**立刻改回**并复跑确认绿。
  ⚠ 这一步的临时改动**不得留在提交里**；在报告中记录两次运行的真实输出（红一次、绿一次），作为"断言不是装饰"的证据。若该 test 的 runner 结构不允许单条试红，改为对该 runner 的**目标文件**做一次只读的变异推理并在报告中说明你如何确认断言会红。

- [ ] **步骤 5：Commit。**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): make the three presence-only negative cases actually bite (M06)"
```

---

### 任务 2：把"每个 exit-2 门禁都有会失败的负向案例"变成强制不变量（M06 主体 + S28）

**信号：** `check-samples-coverage.ts` 从不解析负向断言，因此**一个门禁零负向案例也能通过**；负向覆盖没有任何不变量守护，会随时间退化（这正是 M01 的 sediment/relevance 判据要治的）。
**影响文件：** 3 个（新建清单 1 + 改门禁 1 + 改矩阵 1）。

**文件：**
- 创建：`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（声明式清单，逐门禁登记负向机制与证据）
- 修改：`w-model-dev/scripts/cli/check-samples-coverage.ts`（**追加**第 4 条规则）
- 修改：`w-model-dev/scripts/samples/README.md`（覆盖矩阵加"所防回归"列）
- 测试：`w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`（追加新规则的用例）

- [ ] **步骤 1：写清单。** 按 §2 的 A/B/C 三组，为**全部 43 个** exit-2 门禁各写一行，列固定为：

  `| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |`

  - 负向机制取值**只允许三种**：`fixture`（`samples/<area>/bad-*.json` 等）、`invocation`（CLI 参数，如 `--d4-invalid-argument`）、`mutated-copy`（测试里改写文本副本，如 `docs-consistency-logic.test.ts` 改 `AGENTS.md` 计数的用例）。
  - **证据位置必须是可核验的**：`fixture` → 一个**在盘存在**的 fixture 相对路径；`invocation` / `mutated-copy` → `文件:行号`。
  - **所防回归**列写"如果这条负向案例被删掉 / 放宽，会漏掉什么回归"，一句话、具体（例："放宽 coverage 汇总的计数不变量将漏掉 passed+failed+pending≠total"）。**禁止**写"防止出错"这类空话（这正是 S28 要治的形式）。
  - C 组逐条**先核实**其 exit-2 证据是否真的存在（§2 注里点了候选位置）；**核实不到的**在"负向机制"里写 `invocation` 并在"证据位置"写明"由任务 3 的原子性测试提供"——这类门禁的负向断言将由任务 3 统一建立。

- [ ] **步骤 2：给门禁追加第 4 条规则。** 在 `check-samples-coverage.ts` 里追加（**不改**既有三条规则与它们的消息文案）：
  - 解析 `samples/NEGATIVE-COVERAGE.md` 的表格行，取第一单元格为门禁脚本名；
  - 门禁集合的来源必须是**既有事实源**，不得在门禁里另写一份硬编码列表——用与 `check-docs-consistency` 相同的口径：`w-model-dev/scripts/cli/*.ts` 减去 `self-test.ts`（即 43 个）。**若你觉得"减哪些"有歧义，就以 `check-docs-consistency.ts:233-243` 的排除清单为准**（排除 `self-test.ts` / `security-scan.ts` / `wm-export-evidence.ts` / `wm-status.ts` / `metrics-report.ts` 的**基础探针**，但这 4 个以特殊探针计入——所以最终集合仍是全部 43 个，不含 `self-test.ts`）；
  - 违反 → 新 check id `negative-coverage-missing`，消息形如：`samples/NEGATIVE-COVERAGE.md 未登记负向案例：<name>（每个 exit-2 门禁须有会失败的负向案例）`；
  - `fixture` 机制的行，其"证据位置"必须是**在盘存在**的相对路径，否则 → 新 check id `negative-coverage-dangling`，消息形如：`负向案例指向不存在的 fixture：<path>`；
  - **退出码语义不变**：有违反 → 1；缺必需文件（`samples/`、`self-test.ts`、`README.md`、`NEGATIVE-COVERAGE.md`）→ 2。`NEGATIVE-COVERAGE.md` 缺失按 2 处理，与既有三文件的处理一致；
  - 把新维度并入 `SAMPLES_COVERAGE_JSON` 的字段（例：`negativeCoverageMissing` / `negativeCoverageDangling`），并保持既有字段不变。

- [ ] **步骤 3：给覆盖矩阵加"所防回归"列。** 在 `w-model-dev/scripts/samples/README.md:10` 的表头**追加**一列 `| 所防回归 |`，并给该表**每一行**补上对应单元格（逐行一句话，与清单里同一子目录的"所防回归"保持一致口径）。
  ⚠ **契约红线**：`check-samples-coverage.ts:185-199` 只解析每行的**第一个单元格**为子目录名，所以新列必须加在**行尾**；改完必须跑步骤 5 的矩阵门禁确认仍绿。⚠ 该矩阵有约 28 行，逐行补单元格是本任务最大的机械工作，**不得**用"同上"敷衍（S28 要的是每行给出它所防的那个具体回归）。

- [ ] **步骤 4：给新规则写测试。** 在 `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts` 追加用例（照该文件既有风格构造临时 fixture 目录）：
  - 清单缺一个门禁 → exit 1 且消息含 `negative-coverage-missing`；
  - 清单某行指向不存在的 fixture → exit 1 且消息含 `negative-coverage-dangling`；
  - 清单齐全 → exit 0。
  ⚠ 该测试文件已在 `SUBPROCESS_TEST_FILES` 中（它 spawn CLI）；**不要**改 `config/vitest.config.ts` 除非你新增了测试文件。

- [ ] **步骤 5：跑验证。** 依次：
  - `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` → exit 0（清单齐全、矩阵行尾新列不破坏第一单元格契约）
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts` → 全通过
  - `npm run self-test` → exit 0
  - `npm run check:docs-consistency` 的 `references-count`/`asset-counts` 不受影响（本任务未动 `references/`）；若你想省时间，可跳过这条（它由最后任务的全量 prepush 覆盖）

- [ ] **步骤 6：Commit。**

```bash
git add w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/samples/README.md w-model-dev/scripts/__tests__/check-samples-coverage.test.ts
git commit -m "test(samples): enforce one failing negative case per exit-2 gate (M06+S28)"
```

---

### 任务 3：为每个 exit-2 门禁断言"失败后状态逐字节不变"（S26）

**信号：** 「失败时没留下半成品」目前**只在 `__tests__/` 的 code-health 区**被断言，其余 30+ 门禁的负向路径没有任何原子性保证。

**文件：**
- 创建：`w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts`
- 修改：`config/vitest.config.ts`（把新文件登记进 `SUBPROCESS_TEST_FILES`）

- [ ] **步骤 1：定测试设计。** 该文件对**每个** exit-2 门禁（43 个，口径同任务 2 步骤 2）做一次负向调用，并在调用前后比对状态：
  - **调用方式**：与既有探针同源——用 `execFile(process.execPath, [tsxCli, scriptPath, '--d4-invalid-argument'])`（`check-docs-consistency.ts:233-243` 的原样口径）；对 5 个需要特殊参数的脚本（`security-scan` / `metrics-report` / `wm-export-evidence` / `wm-status` / `wm-status`）用 `:246-276` 的对应参数。
  - **状态快照**：照 `code-health-task1-integration.test.ts:190-213` 的 `snapshotTree()` 风格，对**仓库工作树中该调用可能触碰的路径**做 sha256 快照并断言前后相等。**为避免把 43 次全仓快照做成 20 分钟的开销**，只快照与被测脚本相关的路径：`w-model-dev/scripts/samples/.w-model/`（gate-log 输出）、仓库根的 `coverage/`、`.w-model/`（若存在）、以及 `git status --porcelain` 的**无变化**。
  - **断言**：该调用 `status === 2`；且快照与 `git status` 前后相等；且仓库根 `git diff --name-only` 为空。
  - 预期耗时预算：43 次 `tsx` 冷启动约 60–90 秒（该文件会落进 `cli-serial` 串行项目）。**若实测超过 vitest 的 30s 单测上限**，把每个门禁做成**一个 `it()`**（而不是一个 `it()` 里循环 43 次），并给该文件整体设 `testTimeout`（在文件内用 `describe` 的 `timeout` 选项或 `it(..., timeoutMs)`，**不要**改全局 `config/vitest.config.ts` 的 timeout 值）。

- [ ] **步骤 2：登记子进程清单。** 在 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES` 里加入 `'exit2-failure-atomicity.test.ts'`（它 `import` 了 `node:child_process` / 调用了 `execFile(`，会被 `vitest-project-split.test.ts` 判定为 spawn 文件）。

- [ ] **步骤 3：先证明它会红（S28 纪律）。** 在**临时**把快照比对改成"故意不等"（例如断言 `snapshotBefore` 不等于自身的一份改动副本）跑一次，确认该断言**能失败**；改回后复跑确认绿。**临时改动不得留在提交里**，两次真实输出写进报告。

- [ ] **步骤 4：跑验证。**
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts` → 全通过
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts` → 全通过（证明登记双向一致：无 `missing`、无 `stale`）
  - `npm run self-test` → exit 0

- [ ] **步骤 5：Commit。**

```bash
git add w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts config/vitest.config.ts
git commit -m "test(gates): assert every exit-2 gate leaves state byte-identical on failure (S26)"
```

---

### 任务 4：测试替身保真——让 mock 复刻真实契约（S29）

**信号：** 门禁单测里的 mock/替身若与真实契约脱节，会让"测试绿"与"真实行为"分叉；外部证据要求替身**复刻历史 bug 的真实契约**。

**文件：**
- 修改：`w-model-dev/scripts/__tests__/*.test.ts` 中**点名的**替身（见步骤 1，最多 2 个文件）
- 测试：同上

- [ ] **步骤 1：定位"替身与真实契约可能脱节"的点（只做一次聚焦勘察）。** 运行：`grep -rn "vi.mock\|vi.fn()\|stub\|fake" w-model-dev/scripts/__tests__/*.test.ts | head -40`
  从命中里挑出**替身替代了真实产物结构**的那些（典型：mock 掉 `node:child_process` 的 `runSync` 返回值、mock 掉 fs 读取返回的 JSON 形状），逐个核对替身返回的**结构/字段/退出码**是否与真实实现一致。
  ⚠ **不要**把"用 `vi.mock` 隔离副作用"本身当缺陷——`config/vitest.config.ts:19-20` 明确认可 `vi.mock('node:child_process')` 的文件（`artifact-gate-assets` / `run-sync`）**不算 spawn**，那是正当手法。本任务只处理**替身形状与真实契约不符**的情形。

- [ ] **步骤 2：修不符处。** 对每个核对出的不符：让替身返回**真实契约**的形状（字段名、类型、退出码语义、错误类别），并在替身旁写一句注释说明它复刻的是哪个真实契约（例如"复刻 `runMain` 的 `process.exitCode` 契约：不从内部 `process.exit`"）。
  **若勘察结果是"没有不符"**：不要为了交差而改代码。改为**把这个结论固化成证据**——在报告中列出你核对过的替身清单（`文件:行号` + 真实契约来源 + 结论"一致"），并**跳过**步骤 3 的提交但保留报告。这是允许且更正确的结果（S04：对照不复现失败就停下）。

- [ ] **步骤 3：跑验证与提交。**
  - `npx vitest run --config config/vitest.config.ts <你改动的测试文件>` → 全通过
  - 若改了任何 `logic/` 或 `lib/` 文件（预期**不需要**）：加跑 `npx vitest run --coverage --config config/vitest.config.ts` 确认阈值未跌
  - 若无改动：**不提交**，在报告中写明"勘察后无不符，未改动"。
  若有改动：

```bash
git add <改动的测试文件>
git commit -m "test(gates): make test doubles mirror the real contracts (S29)"
```

---

### 任务 5：P2-A 收口——全量门禁 + AC-7 状态回填

**信号：** 前 4 个任务只跑了任务级检查，必须有一次覆盖全仓 18 项门禁的权威运行；并把 AC-7 的真实达成情况回填进设计规格。

**文件：**
- 修改：`docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md`（§13 的 AC-7 一行）

- [ ] **步骤 1：确认工作树干净且只含本计划改动。** `git status --porcelain`（预期除 `.superpowers/` 外为空）、`git log --oneline <P2-A base>..HEAD`。

- [ ] **步骤 2：跑全量门禁。** `npm run prepush`（**后台跑 + 轮询**，它约 20 分钟，超过单次前台命令上限；不要中途杀掉）。
  预期：末行 `[pre-push] 全部门禁通过，允许推送 ✓`，`PREPUSH_EXIT=0`。
  ⚠ **用 `sh -c 'npm run prepush > /tmp/p2a-prepush.log 2>&1; echo "PREPUSH_EXIT=$?"'` 之类方式捕获真实退出码**——**不要**把输出接 `tail` 再断言退出码，管道会吞掉真实退出码（P1 阶段踩过这个坑）。
  若 vitest 出现失败，按全局约束 16 的诚实性处理。

- [ ] **步骤 3：一致性自查（记入报告）。**
  - `npm run audit:l0-links` → exit 0 且 `violations: []`（三个计数与基线一致，或已重基线）
  - `npm run self-test` → exit 0，样本数如实记录
  - `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` → exit 0
  - `git diff --stat <base>..HEAD -- w-model-dev/scripts/cli/` → 确认**没有新增** cli 脚本（契约 6）；`grep -n "个脚本\|个 \.ts" AGENTS.md w-model-dev/SKILL.md` → 计数**未变**（仍为 43 / 44）

- [ ] **步骤 4：回填 AC-7 的真实状态。** 在 §13 的 AC-7 行**行内追加**状态标注，**只加状态、不改判据文本**。按实测如实写，格式照 AC-2/AC-4/AC-11 的既有风格（`**P2-A 范围内已达成 / 部分达成**：…证据命令…`）。须覆盖 AC-7 的四个分句各自的真实状态：
  1. 「每个 exit-2 门禁 ≥1 个负向 fixture 且断言**必须失败**（仅存在不算）」→ **按实测口径校正**：43 个门禁的负向机制已逐条登记于 `samples/NEGATIVE-COVERAGE.md` 并由 `check-samples-coverage.ts` 第 4 条规则强制（给出证据命令）；**并如实写明与规格字面的差异**——工具类 CLI 的负向输入是**参数**而非 fixture，故"负向 fixture"按"负向案例（fixture/参数/变异副本三机制）"落地，理由是被测对象不含文件输入。**不得**含糊成"已全部满足"。
  2. 「断言**失败后状态逐字节不变**」→ 由 `exit2-failure-atomicity.test.ts` 对 43 个门禁统一断言（证据：该文件通过 + vitest 用例数）。
  3. 「关键 L0 规则有'含规则/剥离规则'两态 fixture 且剥离态复现违规」→ **本计划未做**（属 P2-B 的 S25），如实标 **未达成（P2-B）**。
  4. 「覆盖矩阵含'所防回归'列」→ 已达成（证据：`samples/README.md` 表头）。
  另如实记录 **S29 的结论**（一致/已修）、以及 **M07 移出 P2** 的依据（裁定 D-2 要求单独批准）。

- [ ] **步骤 5：Commit。**

```bash
git add docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md
git commit -m "docs(spec): record P2-A acceptance status for AC-7"
```

---

## 自检结果

**1. 规格覆盖度（P2-A 与 P2 的对照）**

| P2 采纳项 | 落点（规格 §3.3 / §5） | 本计划任务 |
| --- | --- | --- |
| **M06** 负向 fixture 协议（注入违规必须失败） | `check-samples-coverage.ts` + `samples/README.md` | 任务 2（规则 + 清单 + 矩阵列）；任务 1 补"仅存在不算" |
| **S26** fail-closed + 状态逐字节不变 | 同上 | 任务 3 |
| **S28** "断言必须能失败"的自检纪律 + 矩阵"所防回归"列 | `samples/README.md` 矩阵 | 任务 2 步骤 3/4；任务 1 步骤 4 与任务 3 步骤 3 各含一次"证明会红" |
| **S29** 测试替身保真 | 门禁单测 | 任务 4 |
| **S25** 规则负载性两态 fixture | 新增规则级 fixture 协议 | **移出本计划 → P2-B** |
| **S31** 完整性审计维度 | `check-docs-consistency.ts` | **移出 → P2-B** |
| **S32** 评审包 CLI | 新确定性脚本 | **移出 → P2-B**（且它会改变 cli 计数契约，见全局约束 6） |
| **S30** 定量预算断言 | 门禁/单测 | **移出 → P2-B** |
| **S27** `revertEvidence` | 门禁扩展（补反模式 #45） | **移出 → P2-B** |
| **M07** RTM `testSummary` RED 证据 | `rtm.schema.json` + 门禁 | **移出 → 独立批准单元**（裁定 D-2） |

**2. 占位符扫描：** 无"待定/TODO/后续补充/类似任务 N"。任务 4 显式允许"勘察后无缺口 → 不改动并出证据"这一**合法出口**（不是占位符，而是 S04 要求的诚实结果）。

**3. 类型与命名一致性：** 全程统一使用 `NEGATIVE-COVERAGE.md`、三个机制取值 `fixture|invocation|mutated-copy`、新 check id `negative-coverage-missing` / `negative-coverage-dangling`、新测试文件 `exit2-failure-atomicity.test.ts`、门禁集合口径"`cli/*.ts` 减 `self-test.ts` = 43"。与既有命名（`fixture-unregistered` / `reference-dangling` / `matrix-undeclared`）风格一致。

**4. 与既有验收标准的关系：** AC-7 由任务 5 如实回填（四项分句分别标达成/部分达成/未达成）；AC-8（S27）不在本计划；AC-11 的"无新依赖/新脚本/新 Schema"由全局约束 1/6 保证，任务 5 步骤 3 用命令复验。
