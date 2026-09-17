# Task 6–7 独立复审（range `fd387daa..b0d87ec1`）

**Verdict: NEEDS_FIXES**

- 复审对象：`fd387daa..b0d87ec1`（3 个提交：`957aa1fc` 安全卫生 + 后代枚举断言、`77f46144` Task 6/7 主体、`b0d87ec1` phase-6 fixture 修复 + SDD 记录）。
- 权威规格：`docs/superpowers/plans/2026-09-16-review-remediation.md` §1.2–§1.4 / §2 Task 6–7 / §3 验收矩阵。
- 立场：只读。**未修改任何被审文件**（本报告为交付物，按要求新建）。
- 环境：Windows 10 + Git Bash；**复审期间该 worktree 正在跑一次完整 `npm run prepush`**，故未并行运行任何 vitest 文件（理由与影响见「未验证项」）。

---

## 1. 结论摘要

**功能面全部为真**：我独立执行的门禁全部通过且非空转——`check-samples-coverage --json` 真实 exit 0（登记册严格解析通过、47 条探针逐条真实 exit 2）、`lint:security` exit 0 且 baseline 零改动（`git diff` 为空）、tests-matrix 90=90、AGENTS §8 46=46、`valid-phase6` phase=6 通过 / phase=8 与默认相位失败均可复现。探针注册表抽取经逐项比对确为构造等价。

**裁决为 NEEDS_FIXES 的唯一原因**：Task 6 声称「逐行核对行内容确为 exit-2 断言后才改」的两处行号修正中，**`check-pollution` 那一处是错的**——它指向的是**改动前**（`fd387daa`）的文件坐标，本 range 自己在同一文件插入 6 行使断言移到 `:228`/`:232`，而登记册仍写 `:222`/`:226`（`:222` 现为 `eslint-disable` 注释、`:226` 现为探针调用行）。同册另有两行（`check-samples-coverage`、`check-docs-consistency`）的行号注释同样可证伪。这属于本次整改的核心承诺「负向证据必须真实、可审计」，且新第 5 条规则**只校验行号落在文件行数内**，对内容漂移完全不设防，故「漂移」这一本体缺陷在门禁里仍然不可见。修复成本极低（改 3 个整数），但「逐行核对」的书面声明与事实不符，不能按 CLEAN 放行。

---

## 2. Findings

### BLOCKER

无。未发现安全绕过、门禁假绿、状态被破坏或不可回滚的改动。

### IMPORTANT

**I-1（in-range，主裁决依据）登记册行号证据指向错误行，且本 range 的修正基于过期文件视图。**

- `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md:76`：
  `| check-pollution | invocation | \`...check-pollution-cli.test.ts:222\`（同测试 :226 断言项目目录快照逐字节不变） |`
- 实测当前文件：`check-pollution-cli.test.ts:228` = `expect(run.code).toBe(2);`，`:232` = `expect(await snapshotTree(projectDir)).toEqual(before);`；**`:222` 是 `// eslint-disable-next-line security/detect-non-literal-fs-filename` 注释，`:226` 是 `const run = runCheckPollution([...])` 调用行**——两处都不是注释里声称的断言。
- 漂移成因可精确复现：`fd387daa` 版本中该断言**恰在** `:222`/`:226`；本 range 在 `check-pollution-cli.test.ts:61–70`（`runCheckPollution` 增加 `localeEnv`）插入 6 行，故 `:222+6=:228`、`:226+6=:232`。即修正值是**对 `fd387daa` 旧文件算出来的**，未在新文件上复核。
- `task-6-report.md` 「实现事实 4」与提交信息均写「逐行核对行内容确为 exit-2 断言后才改」——该声明对 `review-package` 成立（见下），对 `check-pollution` 不成立。

**I-2（pre-existing，本 range 未触碰，但正落在 Task 6 的承诺范围内）同册另两行的行号注释可证伪。**

- `NEGATIVE-COVERAGE.md:75`：`check-samples-coverage.test.ts:228`（缺 `NEGATIVE-COVERAGE.md` → exit 2）。实测 `:228` = `await fs.mkdir(path.dirname(p), { recursive: true });`（`setupGateRepo` 内部）；被描述的那条测试的 exit-2 断言在 `:387`。（`fd387daa` 时 `:228` 亦非该测试，说明修正前即为错的陈旧值。）
- `NEGATIVE-COVERAGE.md:74`：`docs-consistency-logic.test.ts:2347`（计数变异回归）。实测 `:2347` = `});`；被描述断言在 `:2352–2358`（`SKILL.md 声明 .ts 计数与实测不符`）。（`fd387daa` 时 `:2347` 是 dispatch-matrix 那条测试的 `const v =` 行。）
- **共同后果**：新规则 `validateFileLineEvidence`（`check-samples-coverage.ts:359–386`）只做「文件存在 + 行号 ∈ 1..总行数」。一个陈旧行号只要还落在此文件内就会永远通过；将来若引用测试被删/被移动，登记册仍绿——这正是 Task 6 想消灭的缺陷类。

**I-3（计划步骤未完成，已如实登记，非隐瞒）Task 7 步骤 3 整体未做、步骤 4 缺 exit-0 态。**

- `task-7-report.md` 与 `progress.md` 都显式写「未完成 / 部分完成」并给出理由（全仓快照会重新引入已记录的 vitest 抖动；仓库不存在 phase-8 全外检可过的项目 fixture）。我核对代码：`exit2-failure-atomicity.test.ts` 仍只快照 `samples/`、`coverage/`、`.w-model/` 三个可写面 + git 污点单调口径，**没有任何代码或文档宣称已覆盖完整仓库**；`gate-test-evidence.test.ts` 只有「业务违规 → exit 1」与「输入错误 → exit 2」两组真实子进程断言。故 **不存在「宣称了未拥有的覆盖」**，属诚实的未完成项。
- 但计划 §2 Task 7 的 7 个步骤中 1.5 个未落地，**不能表述为「Task 7 已全部完成」**；`progress.md` 写的是「complete with two registered deviations」，措辞可接受，但放行时应保留该缺口。

### MINOR

- **M-1** `NEGATIVE-COVERAGE.md:79`/`:88`（doctor / wm-verify-evidence-source）指向 `exit2-failure-atomicity.test.ts:290`：`:290` 是 `expect(` 的消息模板（内容含 "exit 2"），真正的断言 `.toBe(2)` 在 `:291`；注释「`:273` 起的逐门禁循环」实际 `for` 在 `:272`、`it` 在 `:273`。两处各差 1 行。实质主张（该循环对全部 45 个门禁断言 exit 2）为真。
- **M-2** 「唯一事实源」仍存在两份类别判据：`lib/exit2-probe-registry.ts:53–59` 的 `EXIT2_ERROR_CATEGORIES` **排除** `UNEXPECTED`，而 `logic/docs-consistency-logic.ts:327–334` 的 `EXIT2_CATEGORIES` **包含** `UNEXPECTED`。check-docs-consistency 用的是后者（未被本 range 改动，故行为等价成立），但两个消费者对「什么算 exit-2」口径不同；注册表注释已解释为何排除，建议把该判据也收敛为单一来源。
- **M-3** `parseNegativeCoverage`（`check-samples-coverage.ts:311`）对首列为空但列数恰为 4 的行走 `continue` 静默丢弃，而非 `negative-coverage-malformed`；`fixture` 行 `（self-test.ts:<行>）` 备注中的行号完全不校验（task-6-report「未完成项」已自认后者）。
- **M-4** `checkTestsMatrixCoverage` 扫描 README **全部**表格行首列（不限「测试文件清单」这一张表）。当前 README 只有一张表且 90=90，但未来新增任何表格会产生 `tests-matrix-orphan` 假阳性。
- **M-5（超出本计划范围）** locale 无关化只落在 `check-pollution.ts`（计划步骤 5 只点名它）。仓库内仍有 7 处 `localeCompare`：`cli/plan-chunks.ts:62`、`cli/security-scan.ts:143`、`logic/docs-consistency-logic.ts:594`（canonical JSON 序列化排序，非 ASCII 键时有确定性命中面）、`logic/evidence-provenance-logic.ts:340/442`、`cli/check-openspec-archive.ts:165`、`cli/check-opsx-artifacts.ts:71`。合规，但「确定性与 locale 无关」只做了点，未成面。
- **M-6** 成本：计划确实要求探针**串行**（§2 Task 6 步骤 3），故 +47 子进程属计划内。但我在与本 worktree 的 pre-push 并发时实测 `check-samples-coverage` 耗时 **5m38s**（报告单跑 68.7s）——说明该门禁在高并发下会被放大到分钟级，pre-push 反馈环显著变慢。已登记，供维护者决定。

---

## 3. 必查项核查

| # | 主张 | 裁决 | 依据（file:line / 实测） |
| --- | --- | --- | --- |
| 1 | 抽取后 check-docs-consistency 行为等价（45 门禁 / 47 探针、id/args/cwd/env/outputPath 同语义） | **成立** | `git show fd387daa:.../check-docs-consistency.ts:217–338` 与 `lib/exit2-probe-registry.ts:70–122` 逐项一致：基础探针 `--d4-invalid-argument`；`security-scan` env 清空 PATH；`metrics-report` args=`join(workRoot,'probe-project')`+`--phase=0 --json`、cwd=workRoot；`wm-export` ×3 outputPath=export-probes/output；`wm-status` 用损坏 `.w-model/project.json`。口径 46−1=45；41 基础 + 6 专用 = 47。`cliScriptFiles` 原本已 `.sort()`，`listGateScripts` 的再排序不改变顺序。`countValidExit2Scripts` 未被本 range 修改。 |
| 2 | 登记册严格解析（四列 / 机制枚举 / 一门一行 / `file:line` 落在文件行数内）+ 47 探针串行隔离根执行、断言 exit2 + ERROR_JSON + 同类别 stderr + 根零漂移 | **成立（非空转已证）** | 实跑 `check-samples-coverage.ts . --json` → `{"passed":true,...,"exitCode":0}`，exit 0：45 行全登记（否则 `negative-coverage-missing`）、严格解析全通过、47 探针（我未单独打印计数，用「零 violations + passed=true」间接约束）全部满足四重断言。反向非空转由测试构造保证：`check-samples-coverage.test.ts:348–357` 用「不实现 exit-2 契约」的 stub（`:76–78`）→ 断言 `negative-coverage-probe-failed` + "exit code 应为 2"；重复/未知门禁/缺列/未知机制/文字伪证据/行号越界各有具名断言（`:290–346`）。fail-closed：tsx 解析失败 → `setupFailure` → exit 1（`:451–458`）；超时/崩溃 → status≠2 → exit 1（`:504–513`、`:541`）。 |
| 3 | 两个占位改为真实证据；两处修正行号确为 exit-2 / 零写断言 | **部分不成立** | `review-package-cli.test.ts:415` = `expect(result.code).toBe(2)`、`:418` = `await expect(fs.access(out)).rejects.toThrow()` ✓。`check-pollution-cli.test.ts:222` = lint 注释、`:226` = `runCheckPollution(...)` 调用 ✗（真断言在 `:228`/`:232`）。`exit2-failure-atomicity.test.ts:290` 为消息模板（断言在 `:291`，循环 for 在 `:272`）。详见 I-1 / I-2 / M-1。 |
| 4 | `checkAgentsNavCoverage` 只计 §8 表格行（正文 / 代码块 / 相似前缀不计），活体通过 | **成立** | `logic/docs-consistency-logic.ts:1985–2001` `parseAgentsNavRows` 限定 `^##\s*8\.` 到下一 H2 且只取 `^\s*\|` 行首单元格，精确名匹配（`<base>.ts` 或 `<base>`）。独立磁盘核对：§8 表 46 行 = `cli/*.ts` 46 个，violations `[]`；新增 4 条反向用例见 `docs-consistency-logic.test.ts:2640–2668`（正文提及 / 相似前缀 / 同章代码块均报缺、精确行通过）。 |
| 5 | `checkTestsMatrixCoverage` 双向集合比较；活体一致（missing/orphan/duplicate 均有处理） | **成立** | 独立磁盘解析：README 首列 90 项 = 在盘 `*.test.ts` 90 个，orphans `[]`、missing `[]`、duplicates `[]`。实现 `logic/docs-consistency-logic.ts:2018–2065` 三向判定；CLI 恒注入 `testsMatrix`（`cli/check-docs-consistency.ts:679–691`，README 缺失 → `null` → `tests-matrix-missing`），非缺省跳过。用例覆盖 null/missing/orphan/duplicate/相等（`docs-consistency-logic.test.ts:2688–2734`）。 |
| 6 | pollution 排序 locale 无关；新测试确能抓住旧 `localeCompare` | **成立（测试对旧实现非空转）** | `cli/check-pollution.ts:57` 改为码元比较。廉价反证：`node -e` 实测 `['zebra.lock','Ärger.lock','Öffnung.lock','änderung.lock']`，`localeCompare` 序 = `änderung,Ärger,Öffnung,zebra`，码元序 = `zebra,Ärger,Öffnung,änderung` —— 二者不同，而新用例第二条断言 `expect(paths).toEqual([...paths].sort(codeunit))`（`check-pollution-cli.test.ts:249–251`）正是拿码元序作期望，故旧实现必红。**但需注意**：跨 locale 逐字节一致那条断言在本机是弱证据——Windows 上 Node 忽略 `LANG/LC_ALL`（实测 `LANG=C`/`sv_SE.UTF-8`/`de_DE.UTF-8` 下 `Intl` 解析 locale 恒为 `zh-CN`），单独看它旧实现也会绿；只有 Linux/WSL 才会真正因 locale 变化而红。 |
| 7 | 清除 83 项既有发现且**未改** baseline；抑制为「窄且有理」 | **成立** | `git diff fd387daa..b0d87ec1 -- .eslintsecurity-baseline.json` 输出为空（未触碰）。实跑 `npm run --silent lint:security` → `baseline 指纹数 312 / 新增发现数 0`，`LINT_EXIT=0`。生产代码无文件级 disable：`review-package.ts:68`（1 行，`args[name]` 写入 + 白名单理由）、`safe-project-path.ts:23/32`（2 行，helper 本体就是审查候选路径）、`gate-logic.ts` 的 `eslint-disable security/detect-object-injection` 位于 `parseSymbolHead` 正前、`/* eslint-enable ... */` 紧随其闭合括号（`:434` / `:499`），块内只有该函数，其后是 `isSymbolSpan`，未外溢；`no-control-regex` 单行豁免紧邻 NUL 判据。两处文件级 `detect-non-literal-fs-filename` 均在 `__tests__/*.test.ts`（`platform-deps-hook.test.ts:1`、`pre-commit-hook.test.ts:1`），与既有约定（`check-samples-coverage.test.ts:1`、`exit2-failure-atomicity.test.ts`）一致。 |
| 8 | `valid-phase6.json` 补 M07 evidence 未破坏 phase-8 / 默认相位应失败的用例 | **成立** | 直接调用 `checkArtifactGate` 实测：`{phaseOption:6}` → `passed:true, reasons:[]`；`{phaseOption:8}` → `passed:false`，含 `系统测试: 8 个待执行`、`验收测试: 6 个待执行` 及 E4；`{}`（默认 phase=8）同 phase-8。`self-test.ts:356–359` 期望 `true`、`:383–395` 期望 `/待执行/` 与 `/系统测试: 8 个待执行/`，均仍匹配。`PHASE_TEST_LAYERS[6]=['unitTest','integrationTest']`（`gate-logic.ts:144`），故新增的两层 evidence 恰是当前相位所需。 |

### 指定风险项裁决

| 风险 | 裁决 |
| --- | --- |
| `gate-logic.ts` E2 NUL 检查重构语义等价 | **等价**。原 `if (hasPath && !RE.test(p)) return false;` 与新 `if (hasPath) { const ok = RE.test(p); if (!ok) return false; }` 在 `hasPath` 真时为同一谓词取反；`hasPath` 假时因前置 `hasPath !== hasSha` 已排除，新代码跳过块后 `return !hasSha || ...` 同样返回 `true`（`gate-logic.ts:1248–1258`）。未见新的短路差异；正则与 `\u0000` 判据原样保留，只新增 `no-control-regex` 豁免注释。 |
| `parseSymbolHead` 块级 `detect-object-injection` 是否只限该函数 | **是**。disable 在函数声明前一行，enable 在其闭合 `}` 之后，中间无其他顶层声明（`gate-logic.ts:434` 与 `:499`）。 |
| 47 子进程 +68s 是否可接受、失败模式是否 fail-closed | **计划内且 fail-closed**。串行是计划 §2 Task 6 步骤 3 的明文要求；tsx 不可用 → `setupFailure` → `negative-coverage-probe-failed` + exit 1；超时（60s，`PROBE_TIMEOUT_MS`）与崩溃 → `status` 非 2 → exit 1；`execFile` 非零抛错时仍解析 stdout/stderr，不会吞掉为绿。唯一保留意见是 M-6 的并发放大（实测 5m38s）。 |
| 两项偏差（Task 7 步骤 3 全仓快照 / 步骤 4 exit-0 态）是否诚实 | **诚实**。两者均在 `task-7-report.md`「偏差（显式登记，未以『已完成』含混）」与 `progress.md` 中标注未完成/部分完成，代码与活体文档中**不存在**相反宣称；我核对 `exit2-failure-atomicity.test.ts` 确仍为 3 可写面快照、`gate-test-evidence.test.ts` 确无 exit-0 态。属 I-3 的「诚实未完成」，不构成「宣称了未拥有的覆盖」。 |

---

## 4. 我实际执行的命令与真实结果

| 命令 | 真实结果 |
| --- | --- |
| `git log/show --stat/diff fd387daa..b0d87ec1`（3 提交 + 全量 diff） | 见 §2；3 提交 touched files 与报告一致 |
| `node -e`（解析 `__tests__/README.md` 首列 vs 在盘 `*.test.ts`） | `declared entries: 90`；`on-disk test files: 90`；orphans/missing/duplicates 全 `[]` |
| `node -e`（解析 `AGENTS.md` §8 表 vs `cli/*.ts`） | `§8 rows: 46`；`cli scripts: 46`；`violations: []`；非 `.ts` 行 `[]` |
| `node -e`（locale 反证，默认 / `LANG=C` / `sv_SE` / `de_DE`） | 默认 resolved locale `zh-CN`；四组 `localeCompare` 结果均为 `änderung,Ärger,Öffnung,zebra`（Windows Node 忽略 LANG），码元序为 `zebra,Ärger,Öffnung,änderung` |
| `node --import tsx -e`（对 `valid-phase6.json` 调 `checkArtifactGate`） | phase6 `passed:true,[]`；phase8 与默认 `passed:false`，含 `待执行` 与 `E4` reasons（原文见 §3 第 8 行） |
| `npm run --silent lint:security` | `baseline 指纹数 312 / 已豁免 410 / 新增发现 0` → `LINT_EXIT=0` |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts . --json` | `{"type":"samples-coverage","passed":true,"reasons":[],"violations":[],"exitCode":0}` → `COVERAGE_EXIT=0`；`real 5m38.868s`（与并发中的 pre-push 争用） |
| `git diff fd387daa..b0d87ec1 -- .eslintsecurity-baseline.json` | 空输出（未改动） |
| `awk` 逐行核对登记册全部 `file:line` 证据行内容 | 见 §2 I-1/I-2/M-1；`self-test.ts:<行>` 属 `fixture` 行的描述性备注，按登记册表头约定不参与校验 |

### 未验证项（不声称已通过）

- **未运行任何 vitest 文件**。原因：复审期间本 worktree 有完整 pre-push 在跑（`tasklist` 见十余个 node + 多个 bash 进程），且单跑 `check-samples-coverage` 已观测到约 5 倍放大（68.7s→5m38s），并发运行会既超时又可能产生争用型假红。因此 `check-samples-coverage.test.ts`(17)、`docs-consistency-logic.test.ts`(198)、`gate-test-evidence.test.ts`、`check-pollution-cli.test.ts`、`pre-commit-hook.test.ts`、`self-test`(352) 的**通过结论均来自实现者报告，我未亲见退出码与 summary**。
- **未运行 `npm run self-test` / `npm run typecheck` / `npm run prepush` / check-docs-consistency CLI**（后者会再起 47 个探针）。故「45 计数的既有断言仍绿」「self-test 352/352」「18/18」在本复审中**未被独立复现**。
- **未执行 Task 7 步骤 3/4 的替代验证**（无完整仓库快照对照、无 phase-8 合法项目 fixture）。
- 探针「不实现 exit-2 契约 → 必红」分支我只做了**代码与 stub 逻辑审查**，未运行该测试（见上）。

---

## 5. 剩余风险与放行条件

**放行条件（必须满足）**

1. 修正 `samples/NEGATIVE-COVERAGE.md:76` 的 `check-pollution` 证据行号：`:222`→`:228`、`:226`→`:232`（改后请在该文件上重新核对，而非引用旧 revision）。
2. 修正同册 `:75`（`check-samples-coverage.test.ts:228`→`:387`）与 `:74`（`docs-consistency-logic.test.ts:2347`→`:2352`，或指向真正承载断言的行）。
3. 更正 `task-6-report.md` 中「逐行核对行内容确为 exit-2 断言后才改」的表述，或补做核对后保持声明成立（当前对 `check-pollution` 不实）。
4. 在 Task 8 收口记录中保留 I-3 的两项未完成项，不得表述为「Task 7 全部完成」。

**建议（不阻断放行）**

- 给第 5 条规则补一条**内容级**证据校验（例如 `invocation`/`mutated-copy` 的证据行必须匹配 `toBe(2)`/`exitCode`/`exit 2` 之一），使行号漂移从「不可见」变为「可发现」；否则 `file:line` 只是弱占位。
- 收敛 `EXIT2_CATEGORIES`（含 `UNEXPECTED`）与注册表 `EXIT2_ERROR_CATEGORIES`（不含）为单一来源（M-2）。
- 若采纳 M-6 的成本，评估把 47 探针放到 pre-push 之外的可选/并行通道；当前串行 47 探针在高并发下可达分钟级。

**残余风险（本复审无法消除）**

- 本 range 的功能绿灯最终仍依赖 `self-test 352/352`、`typecheck`、`prepush 18/18` 与 5 个测试文件的通过——这些在并发的 pre-push 结束后应由 Task 8 以退出码与 summary 回填；若其中任何一项为红，本报告的「功能面为真」结论需相应下调。
- 登记册行号属「会腐烂的证据」。即便本次全部改对，只要没有内容级校验，下一次测试文件插行就会再次静默失真（I-1 已证明该失效模式成本极低）。
