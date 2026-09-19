# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 41.0.0 之前的历史变更已归档至 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。
> 历史决策详情（轮次记录 / 关键决策 / 验证数据 / 吸收决策记录）归档于
> [`docs/changes/decision-log/`](./docs/changes/decision-log/README.md)（轮次 → 版本 → CHANGELOG 映射见其 README）。

## [42.2.1] - 2026-09-01

### 调测报告订正与技能包诊断修复（2026-09-19，来源：`docs/debug/2026-09-19-wm-8phase-full-debug/`）

> 该目录为**未跟踪审计产物，不随本次提交交付**（同 2026-09-18 外部调测先例）。规格见 `docs/superpowers/specs/2026-09-19-debug-report-corrections-design.md`（含 §5.3 修订 r1、§5.4 修订 r2）、计划见 `docs/superpowers/plans/2026-09-19-debug-report-corrections.md`。版本保持 42.2.1，**不 bump**。
> 验收依据：全量 19 项 `npm run prepush` + 交付资产重放 **119/119**（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status，0 次非零退出）+ 负向探针 **9/9** 被真实拦截（记录 `eval/e2e/2026-09-19-8phase-debug-replay.md`；首轮证据绑定资产提交 `8ae12c56`，最终审查修复轮重放的证据绑定重放 HEAD `bf56f858` / 资产提交 `bcea41d9`）。

- **S1（聚合门子进程预算与诊断）**：`EXEC_LIMITS` 新增 `modelCheckChildTimeoutMs`（360s），`artifact-gate-assets.ts` 三处 `runSync` 显式传入——原实现落回 15s 默认值（既有用例甚至把该默认值写死在断言里），负载下真实 TLC 子进程被杀只报「退出码 unknown：」；`appendProcessViolation` 现报出信号名与超时语义，前缀形态保持不变。
- **S2（层次校验措辞）**：`checkHierarchy` 增可选 `filteredOutPaths/fullPhaseByPath/phase`，被 `--phase` 过滤掉的 child 报「属后续阶段（phase=N；当前校验 phase=M 不包含它）」，不再误报「不在 manifest 中」——该误报正是审计报告把「phase 形态错配」当成「不变式伪造被 TLC 拒绝」的成因；判定结果不变（仍拦截），缺省入参行为与旧文案逐字不变。
- **F-1（RTM 覆盖率单一事实来源）**：`gate-logic.ts` 抽出并导出 `computeRtmTraceCoverage(rows, phase)`，`wm-status` 与 `check-artifact-gate` 共用；原 `wm-status` 按展示字段字面量 `'100%'` 统计，导致全行 `coverageStatus="完整"` 的矩阵显示 0/4（聚合门判 100%）——现同源，实测 4/4（100%）。
- **F-2/F-3/F-4（BDD 约定文档化，含一处事实订正）**：`bdd-manifest.schema.json` 的 `basePath` description 与 `references/bdd.md` 现写明**两处消费方对 `basePath` 的锚点相同（均 `resolve(projectDir, basePath)`），差异在兜底候选集**（`check-bdd-model` 另有 `.w-model/<filePath>`、`.w-model/bdd/<filePath>`、`<projectDir>/<filePath>` 三条；`check-artifact-gate` 无兜底，直接报 `[artifact:bdd] feature file missing`）——审计报告原写「解析基准不同」为误述，本轮按代码事实订正；同处补 D4 的 `SM-` 前缀配对约定与 D6 的 When/And 行「行末 ASCII 词为事件」约定（含经真实正则实测的可复现示例）。
- **可重放资产交付**：`eval/e2e/demo-assets/`（受跟踪：装配器 + 轨迹驱动 + 9 项负向探针 + README）——装配器改为运行时取 `REPLAY_BASE..REPLAY_HEAD` 真实差异、轨迹驱动去绝对路径并内置 `119/0` 计数自断言、工作区残留 `.git` 时 fail-closed（实测该残留会让 p5–p8 的 `--scope` 过期、只剩 114/119）、`--reset` 在 Windows 上能自愈只读 git 对象；负向探针的期望词经加固（`失败规则：.*R6` / `不变式违反 *: *[1-9]` / `--- D5 Step Binding: [1-9]`），避免环境降级或旁因失败被误判为「真实拦截」。
- **报告订正（未跟踪目录内）**：P1–P9 —— 探针归因拆分为「phase 形态错配」与「真实 TLC 拒绝伪造自报」两条（8→9 项）、执行条数口径改为 89+29+1、签名链 48→49、写入 32→29、日志文件 12→13、阶段 1 无 Verifier、F-7 残留措辞；新增 §6.1 如实登记报告自身 F-2/F-4 两处表述不准。
- **最终审查修复轮（2026-09-19 晚，本子节的第一波修复之后）**：装配器**两处**删除点（`--reset` 整树清空、常规 7 目录重建）前加同一条「本装配器工作区」判据——`ROOT` 不存在或为空（首次构建）或含哨兵（`SPEC.md` 与 `.w-model/project.json` 同时存在）才允许，否则 exit 1 并给处置指引（常规路径不再能静默删除 `WORKSPACE` 误指目录的 `.w-model/tla/features/src/test/docs/archive`）；负向探针在 grep 断言**之后**把 `[NP:<id>] EXPECT_MATCH=yes|no` 写回日志，并追加 `probe-orig residue count`（本轮实测 9 yes / 0 no / 0 残留），归档日志自证「命中期望词」；`git diff --name-only` 前插 `-c core.quotePath=false` 并改按行切分；`os.chmod(..., S_IWRITE | S_IREAD)`；`trap` 改为「信号也恢复并中止」。文档侧：规格 §5.4 修订 r2 入档（F-2 由「基准不同」订正为「锚点相同、兜底候选集不同」）、SSoT 子进程预算改为可证形式（每规格各计一次，N×360s）、RTM 覆盖率口径限定「同一 `phase` 下」、`command-reference.md:234` 补整数百分比、`bdd.md` D6 历史示例注记、重放记录删去无日志证据的 wm-status 复跑括注并刷新为修复轮 2 重放（119/119 + 9/9，数字三轮一致）。
- **登记不修（如实列出）**：`references/bdd.md` 全文 63/72 行 `When`/`And` 示例不符 D6 事件正则（既有文档风格，属独立事项；最终审查修复轮已加注记「历史示例为示意，不参与 D6 校验」）；探针 7 的 `codeModule` 词区分度偏宽（`codeModule` 类文案在多条规则中共用）；`build_workspace.py` 的 `_RP` 解析无 try/except。**（原登记两条已由最终审查修复轮修正：`rmtree_force` 的 POSIX 权限收窄 `0o200` → `S_IWRITE | S_IREAD`；探针脚本 `trap` 信号不中断 → 恢复后 `exit 1`。）**

### 全部遗留事项收口（leftovers-closeout：B / J1 / N / O + 第三方调测 D1-D3，2026-09-18）

> 计划与逐任务记录见 `docs/superpowers/plans/2026-09-18-leftovers-closeout.md`（文末新增「收尾记录」节：计数终值逐处来源、L0 rebaseline 实测、窄口径四值与阈值出处、O 的 5 文件普查、外部审计发现登记）与 `.superpowers/sdd/2026-09-18-leftovers-closeout/`（逐任务报告与审查 diff）。版本保持 42.2.1，**不 bump**。
> 验收依据：`npm run prepush` **19 项全量**——收口实测 **19/19 全绿**、`PREPUSH_EXIT=0`、末行「全部门禁通过，允许推送 ✓」（第 12 项 vitest 全量 + coverage 阈值、第 13 项规则层口径、第 15 项 docs-consistency 同次受控运行全部通过；逐项结果见计划文档「收尾记录」§9 与任务 10 报告）。

- **B（规则层覆盖口径门禁）**：新增 `logic/coverage-scope-logic.ts` + `cli/check-coverage-scope.ts`——按 logic+lib 白名单分母重算 istanbul 四指标并独立强制阈值，作为 pre-push **第 13 项**（门禁总数 18 → **19**）；`config/vitest.config.ts` 增 `reporter: ['text','json']` 产出 `coverage/coverage-final.json` 供其消费（白名单零命中 → exit 2 fail-closed）。阈值 = 2026-09-18 实测（logic+lib，`fileCount` 68）stmts **84.26** / branch **77.88** / funcs **93.68** / lines **87.01**，向下取整到 5 的倍数 = **80 / 75 / 90 / 85**（出处：`.githooks/pre-push` 第 13 项注释 + `config/vitest.config.ts` 的 coverage 块注释）；全分母地板维持既有 75/65/85/75（本次未动）。
- **J1（run-log R11 闭环五脚本）**：`logic/run-log-logic.ts` + `cli/check-run-log.ts` 新增 **R11**——凡有 `action=checkpoint` 且 `outcome=success` 放行的阶段，放行前须已有 `check-budget` / `check-run-log` / `check-maturity` / `check-checkpoint` / `check-preventive-review` **五条** `role=G` + `outcome=success` + `gateExitCode=0` 记录，且时间戳**严格早于**放行（同秒不算、**无时间戳豁免**；无放行的 run 不触发、摘要不出现 `r11` 键）；CLI 摘要增 `r11 {checkedGates, missing}`。新增负向样本 `bad-r11-missing-closure.jsonl` 与 `bad-r11-late-closure.jsonl`（后者**必然同时报 R7 append-only**，R11-only 不可达，已在 `samples/README.md` 说明）；`RUN_LOG_CASES` 17 → **19**，self-test 356 → **358**。
- **N（code-health 语义审计 + 真实 git 端到端）**：7 个 code-health CLI 对治理参考逐条审计，16 行判定 = **一致 × 11 / 文档错 × 3 / 实现错 × 1 / 无测试覆盖 × 1**；3 处文档错改治理参考（Phase 1 候选只 `discovered`/`blocked`、`changedFiles` 非空即只读违规、P4 `under-review` 不是批准），1 处实现错按 TDD 修复（`cli/code-health-apply.ts` 的 `SCOPE_MISMATCH` 分支补真实反向应用 + 按 pre-change 快照做 `git status` 残差回读，拒绝时保留受控 patch 与回滚计划）；`code-health-e2e.test.ts` 新增真实 git 隔离仓 e2e（T7-1…T7-6：apply 拒绝分支、archive 两条链、`--guard` 全链路真删+失败回滚、`duplicates` 只读、`phase1 --scenario` 三形态）。审计方法与逐行证据见计划「任务 6 · N 审计表」。
- **O（规则负载性三态测试）**：按 coverage 实测选 statements 最低 5 个 logic 文件——`tla-logic` **61.22** / `verifier-logic` **69.31** / `checkpoint-logic` **69.47** / `code-health-contract` **69.83** / `root-cause-logic` **72.63**（快照 mtime 2026-09-18 11:38），为 **43 条规则**建 GREEN / RED / STRIPPED 三态测试（`*-rule-loadbearing.test.ts` × 5 + `helpers/strip-rule.ts` 剥离助手；vitest 下「tmpdir 副本 + 绝对路径 import」实测可用，**未启用备选方案**），`rule-loadbearing` 实测 **6 文件 57/57 通过**；**未发现死规则 → 零 `logic/` 实现改动**；不可剥离项（无块体单语句 `if`、`} else` / `} else if` 形态）与 schema 分层防御不可达项已逐条如实登记，未硬凑。第 6 名 `preventive-review-logic` 实测 **78.26**（任务 9 报告写的 79.17 为笔误，已在收尾记录勘误）。
- **D1 / D2 / D3（来源：外部第三方 8 阶段全流程调测 `docs/debug/2026-09-18-wm-8phase-full-trace/REPORT.md` §5.1–§5.3，该目录为未跟踪审计产物、不随本次提交交付）**：D1 `cli/doctor.ts` 的 `TOOLS_DIR` 缺 `dirname()` → `tla2tools.jar` 在盘仍恒报缺失、`--with-tla` 误阻断（修复后 `--with-tla` exit 0）；D2 `cli/check-requirement-graph.ts` 的项目根判定被技能自身产出的 gitignored `.w-model/gate-logs/` 残留截断 → R15c 结论随盘面 1↔0 翻转（改为就近判定 + 仅「含常规文件的 `.w-model/`」计为项目状态目录；**未采纳**「全局优先 `.git/`」，实测会误判嵌套项目到外层仓根）；D3 `cli/check-run-log.ts` 的 `--json` 输出剔除非确定性 `durationMs`（人类通道 `RUN_LOG_JSON` 按规格保留，`JsonReport.durationMs` 改可选并写明契约边界）。三项均补红→绿回归，**断言强度未降**。
- **L0 链接审计 rebaseline**：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` 的 `relativeLinkCount` **675 → 676**（`l1Only` 95、`placeholders` 36 不变，`violations` 仍 0；`npm run audit:l0-links` exit 0 实测）——成因是 `references/operational-recovery.md` 补 R9/R10/R11 摘要时新增 1 条同目录链接（`git diff` 实测该文件本次仅此 1 行改动、净 +1 条相对链接），属正当产物、**未回退该链接**。
- **计数与活体文档终值同步**：`self-test` 统一为 **358**（实测「总计 358 条用例：358 通过，0 失败」；44 个 `*_CASES` 数组实加 357 + 1 条元数据用例闭合）——`.code-health-governance.json` 的 `selfTestSamples` 与 `README.md` / `CONTRIBUTING.md`（3 处）/ `.githooks/pre-push` / `AGENTS.md` / `docs/user-guide.md` / `docs/INSTALL.md` / `scripts/test-affected.cjs` / `references/subagent-delegation.md` / `samples/README.md`（含 `RUN_LOG_CASES` 与实加合计）逐处按实测订正；`SUBPROCESS_TEST_FILES` 条目数（实测 **40**，指真实 spawn 子进程的测试文件、非 `*.test.ts` 总数 98）改为「清单长度 + 实测值」表述，不再写死「30 个测试文件」；顺带修正 `samples/README.md` 对 R10 的**已删除**机制（`LEGACY_REVERT_EVIDENCE` cutoff）的描述。
- **登记不修（如实列出）**：外部调测的 **G1–G5** CLI 级正向样本缺口（G1 `check-tla-model` / G2 `GRAPH_CASES` phase 2-4 / G3 `GATE_CASES` phase 7-8 / G4 `ROLE_DISPATCH_CASES` / G5 = 上述计数漂移，**G5 本轮已修**）与 **R-1**（`exit2-failure-atomicity` 的「仓库状态逐字节不变」断言对并发写盘敏感，建议快照范围收窄到门禁自身产物路径）。

### 审查问题修复（review-remediation，2026-09-16 ~ 2026-09-17）

> 计划与逐任务记录见 `docs/superpowers/plans/2026-09-16-review-remediation.md` 与 `.superpowers/sdd/2026-09-16-review-remediation/`（含 3 次独立 V 复审记录）。收口实测：`npm run prepush` 18/18 全绿。

- **严格证据语义，删除时间戳豁免（M07 / R10）**：阶段 5–8 当前阶段层 `total>0` 缺合法 `evidence` **一律阻断**；`fix` / `emergency-fix` 缺合法 `revertEvidence.command` **一律阻断**（`timestamp` / `lastUpdated` 只作日志与 RTM 元数据，不参与信任判定）。`GATE_JSON.testEvidence.legacy` 与 `RUN_LOG_JSON.r10.legacy` 计数键保留但**恒为 0**（含义是「没有时间戳豁免」，不是「历史记录已被证明有效」）。旧数据迁移必须重跑真实命令、保存原始输出与 SHA-256，并经 `wm-verify-evidence-source` producer 记录当前 HEAD / source bundle / 运行身份。
- **安全项目路径**：新增 `lib/safe-project-path.ts`（词法检查 → `lstat`/`realpath` containment → 普通文件判定）；`--tickets` 与 M07 E2 原始输出核验在**任何读取之前**拒绝绝对路径、盘符、UNC、反斜杠、NUL、`..`、symlink/junction 与目录。
- **`review-package.ts`**：只接受等号形态参数（未知参数、空值、无值选项一律 `ARG_INVALID` / exit 2，不回退 cwd）、Git 范围与正文使用**完整 SHA** 与固定日志格式（不受 `core.abbrev` 影响）、同目录**原子写入**（写入失败保留既有目标，不做「先删后改名」降级）。
- **S18 精确符号匹配**：定义与引用按 owner/member 头精确比对，参数名与返回类型不再参与匹配（未定义完整符号头即阻断）；空白 `command` 由 Schema 与逻辑层双重阻断。
- **负向覆盖登记册可执行化（第 5 条规则）**：登记册四列语法严格化、机制枚举、每门禁恰一行、证据必须解析为 `文件:行号` 且在文件行数内；逐门禁**执行真实 exit-2 探针**（探针定义与 `check-docs-consistency` 中心探针共用 `lib/exit2-probe-registry.ts`，每个探针一个独立隔离根 + 有界并发），断言 exit 2 + 可解析 `ERROR_JSON` + 同类别人类错误行 + 探针根零漂移。
- **活体文档一致性**：AGENTS §8 登记判据由**全文子串**收紧为**表格行精确匹配**（正文提及、代码块、相似前缀都不算登记）；新增 `w-model-dev/scripts/__tests__/README.md` 覆盖矩阵与在盘测试文件集合的**双向等价**检查；`check-pollution` 目录排序改为 locale 无关（同输入跨 `LANG`/`LC_ALL` 逐字节一致）。
- **pre-commit 钩子**：判定只读 index 快照（不读工作树同名文件）、hook 内路径统一为当前 Bash 形态、超时按**进程树**终止并在 Git Bash 的 `ps -o` 不可用时探测回退 `ps -ef`（两者都不可用则 fail-closed）。
- **快速车道（DX）**：新增 `npm run test:affected`——按改动映射选择测试文件（触及 `config/**`、`.githooks/**`、`schemas/**`、`references/**`、`samples/**`、`docs/**`、`eval/**`、根 `scripts/**` 与根活体文档时自动退回全量）；**验收必须全量**（`npm run prepush` 18 项）已写入 README「验证仓库」块、CONTRIBUTING「本地推送前门禁」节与 AGENTS §6。
- **门禁自身的既有缺陷一并清偿**：`lint:security` 陈旧 baseline（83 项发现）在代码内逐处具名豁免、baseline 未改；严格 M07 下 `samples/gate/valid-phase6.json` 补真实 evidence；`run-sync` 台账校正行号并补登 10 处未登记的直接子进程调用；`gate-report` 的注释剥离器误报（代码字符串中的 `/*`）与 Windows 跳过的用例一并处置（全仓测试无 `skip`）。

### R-persona 选择可校验化与人格能力声明（r-persona-selection-auditability，2026-09-17）

> 起因：对「R 是否应按需加载证据/定位/code-review 等人格」的分析。结论是 R **已在**按需加载（`subagent/` 28 人格 + 选择矩阵；「R 不调用 Persona」仅指不加载 `agent-personas.md` 的 4 个 V 评审 Persona，理由是 V 之后还要复审 R 的产出，需保持视角独立）。真正的缺口是「按需」不可校验，故本次把三处缺口补齐。

> 收口实测：`npm run prepush` **18/18 全绿**（`PREPUSH_EXIT=0`；经 3 轮才转绿——第 1 轮止于 security-scan 新增发现、第 2 轮止于 `run-sync` 台账行号 provenance 漂移，均按「改代码而非放宽门禁」处置，baseline 未改）。实现记录（含逐轮失败与处置、门禁边界裁定、遗留项）见 `docs/superpowers/plans/2026-09-17-r-persona-selection-auditability.md`。
>
> **兼容性（行为收紧）**：R11 对全部报告生效、**无时间戳豁免**（沿用本版本确立的严格证据语义）——此前可通过的「视角取自矩阵外」或「视角与自述 `category` 不相交」的多角度报告，现在 exit 1。

- **新增 R11 校验规则**（`logic/root-cause-logic.ts`）：多角度报告（`method=combined`）的 `partialReports[].personaSlice` 必须为矩阵内已知 persona，且与 `rootCause.category` 第一键行候选集**有交集**；`partialReports` 缺失由 R9 判失败、`noRootCause` 分支无 category——两者跳过 R11。legacy `reality-checker` 归一化为 canonical 后参与比较。
- **R-persona 两键矩阵**：第一键 `rootCause.category`（R 自述，7 行）+ 第二键风险域信号（安全 / 性能 / AI-LLM，**由 V/G 产出特征读出而非 R 自述**，命中即**叠加**不替换）；新增四条仲裁规则（并集 / 上限 5 时保留必含项与第一键行成员并记录裁剪 / 第一键分歧须改判或记录证据 / 门禁边界如实陈述）。矩阵以 `R_PERSONA_MATRIX`、`R_PERSONA_SIGNAL_MATRIX` 为 R11 判据源。
- **persona 能力声明四字段强制**：28 份 `subagent/*.md` frontmatter 补 `capabilities` / `inputs` / `outputs` / `boundaries`（单行、值内只用全角标点）；`check-docs-consistency.ts` 新增 `persona-capability-declarations` 检查，任一文件缺一字段即 exit 1。`boundaries`（适用 / 换人）是「按需加载」可执行的前提——缺它则人格选择只能照抄矩阵。
- **新增 `rootcause-persona-matrix` 一致性检查**：独立解析 `root-cause-logic.ts` 源码文本（TS AST，不 import 被检查模块）与 `agent-personas.md` §2 两张表的键与候选集**双向等价**，并断言矩阵引用的每个 persona 均存在于 `subagent/<name>.md`。
- **fixture 校正 + 新负向样本**：`bad-r10-no-reality-checker.json` 的 personaSlice 由**不存在的人格名**（`engineering-testability` / `design-architect`）改为真实矩阵人格（保持「仅触发目标规则」的夹具原则，并新增单测钉住该性质）；新增 `bad-r11-unknown-persona.json`（矩阵外人格）与 `bad-r11-category-mismatch.json`（自述 category 与所选视角行无交集），`ROOTCAUSE_CASES` 14 → 16。
- **门禁边界（如实陈述）**：数量约束（默认 3 / 上限 5）与 `incident-response-commander` 必含**不门禁强制**——它们是分派默认，由编排者按 `agent-personas.md` §4 与 token 预算（`budget-logic.ts` R4-A）执行；第二键因报告未声明信号字段亦不门禁强制，仅作分派指导。

### 审查修复第二批：成熟度豁免、覆盖率口径与规则层如实化（audit-remediation-2，2026-09-17）

> 续第一批，处理审查清单中的「建议」级与超范围项；实施记录见 `docs/superpowers/plans/2026-09-17-skill-audit-remediation.md` §8。

- **成熟度豁免落地（行为变更，本批唯一的门禁放宽）**：`check-artifact-gate.ts` 读 `.w-model/maturity.json` 的 `level`；L0/L1（教学 / demo / 小工具）且阶段 1-4 时豁免 TLA+/BDD 资产与同步要求。此前文档承诺该豁免但门禁无 maturity 输入 → 合法 L1 项目按文档走必被阻断。GATE_JSON 新增 `maturityLevel` / `tlaBddWaived`（键恒存在）+ 人类横幅；**缺文件或 level 非法 → 不豁免**（保持严格）。三臂回归：L1+阶段 1 命中豁免、L2+阶段 1 不豁免、L1+阶段 5 不豁免。
- **覆盖率口径：完成测量与归因，问题未解决（如实记录）**。根因确认：**被测试 import 的文件总会进入报告**，`coverage.include` 只影响未被 import 的文件——全量实测 83 个文件（logic 37 / lib 30 / cli 10 / infrastructure 3 / application 2 / __tests__ 1），合并值 stmts **76.83** / branch 71.64 / funcs 87.86 / lines 78.88，statements 距阈值仅 **+1.83pp**。两种 `exclude` 写法（相对路径、`**/` 前缀）在**聚焦运行生效、全量运行均不生效**（机制未查明）→ **已回退配置改动**，不发布"已限定口径"的不实声明；阈值维持 75/65/85/75，风险与两次失败尝试如实写入 `config/vitest.config.ts` 注释。
- **弱断言加固（4 处）**：`fileParallelism ?? true).toBe(true)`（恒真）→ `not.toBe(false)`；三处仅断言 `typeof` 的计数/字节/耗时改为可证伪断言（覆盖计数等于必需数、字节等于磁盘实际大小、耗时整数且有界）。
- **fixture 去伪**：删除与 `valid-manifest.json` 逐字节相同的 `bad-no-rtm-mapping.manifest.json`（其「坏」由 `rtmRows` 参数注入），用例改为直接引用前者；samples/README 增「同字节复用」说明（两对 coverage fixture 的差异同样由参数注入，保留并文档化）。
- **规则层如实化**：反模式 #10 的「signature-chain 检测 O 越权」**经复核实现不存在**（R4 允许 O 出现在任意位置）→ 改为标注「无自动化检测，属人工核验」；#36/#43 的「G 门禁人工校验」改为「V 评审人工核验」（G 的允许动作不含核验）；约束 #11 标注「门禁不校验 5 脚本是否执行」；信息密度阈值统一为「< 2/章节 即命中」（消除 [1,2) 空档）；#20 的伪 action 枚举与 #21 的 `phaseOption` 伪字段改为真实判据；清理 4 处悬空括号。
- **自检断言强度：经复核无缺口（撤回本条初版结论）**。初版扫描称"23 条无断言"，两轮复核后证伪：各数组所用字段名不同（`expectedViolationPatterns` / `expectedRulesFailed` / `expectedReasonPatterns` / `expectedErrorPatterns`），用完整字段集重扫 213 条负向用例 → **无任何断言字段者 0 条**。相关插入已全部回退（`self-test.ts` 本批仅保留 BDD fixture 去重一处改动）。
- **三处自我纠正（如实记录）**：① 自检断言强度的两轮误报（`expectedViolationPatterns` → 再是 `expectedRulesFailed`）——最终结论是**无缺口**，初版与二版结论均已撤回；② 锚点规则在编辑后立刻抓出登记册 10 条引用漂移（新增该规则的目的即在此）；L0 链接基线随之 674 → 675；③ 覆盖率 exclude 的"聚焦生效、全量失效"两种结果并存，未查明机制即回退，不保留不可靠的配置声明。
- **未做（如实列出）**：`code-health` 6 个 CLI 的端到端语义（其规则层已由 self-test 43 条 `CODE_HEALTH_*_CASES` 覆盖）、其余 36 个 `logic/*.ts` 的规则负载性变异测试（建议按覆盖率最低者优先）。

### 全面审查修复：fail-open 治理 / 证据链 / 文档矛盾（audit-remediation，2026-09-17）

> 触发：对技能包的四维度独立审计（门禁脚本 / 文档一致性 / 测试与样本 / 规则与角色），发现按优先级修三批；全部 fail-open 结论均由复现探针确认后再修。
> 实施记录见 `docs/superpowers/plans/2026-09-17-skill-audit-remediation.md`。

**第 1 批 · 堵「零证据=通过」（6 处，逐条探针复现）**
- `check-checkpoint`：run-log 无 checkpoint success 记录时由 exit 0 改为 **R0 零证据守卫** exit 1（原状态还打印「已跳过 R3 校验」，自证跳过）。
- `check-state-machine-consistency`：四数组全空由 exit 0 改为 exit 1——CLI 头注本就写着「不得按全空合法图放行」，而单测固化了相反语义，单测已按新语义更新。
- `check-code-tla-consistency`：manifest 指向的 `.tla` 不可读时由「置空串继续」改为 **exit 2 / FILE_NOT_FOUND**（`tlaContent` 内联的自包含 manifest 保留可用）；实现时踩到 `exitWithError` 只设退出码不中断调用链的坑，探针复现后补 `throw new HandledCliError()`。
- `check-budget` R4-A：未配置 `rootcauseParallelBudget` 时改为**可见跳过**（warning，不再静默）；并修 `checkBudget` 只透传子结果 `violations`、丢弃 `warnings` 的缺陷。
- `check-iceberg-sweep`：`evidence` / `hypothesis` 由真值判断改为 trim 语义（单空格不再算证据）。
- `wm-status --json`：未初始化时输出机器可读对象（原为空 stdout，调用方无法区分「未初始化」与「正常空报告」）。

**第 1 批 · 可见性（把静默跳过变成显式可查）**
- `check-artifact-gate`：阶段 1-4 未传 `--spec-dir` 时 GATE_JSON 新增 `specStructure: checked|skipped|null` + 人类横幅提示（原先整组设计级校验静默不执行且输出侧不可分辨）。
- `check-signature-chain`：未提供 `existingPaths` 时 R8 不再计入 `rulesPassed`，新增 `rulesSkipped` 并修正横幅（原先打印「R1-R10 全通过」）。
- `check-verifier-output` R12：原 `!hasSpecificRef && e.length < 20` 放行「长而无引用」→ 改为**仅结构化引用**（文件路径 / §章节 / 第 N 章节行 / L 级 / 仓库 ID）；收紧时发现裸词根 `行/节/章` 会让「执行」「细节」「文章」误判为引用，故模式改为结构化形态。
- R13：非数值 `score` 不再静默跳过，改为显式违规。

**第 2 批 · 治理证据链**
- 负向覆盖登记册：实测 **29 条 fixture 行号全部漂移**（门禁此前只校验「文件存在 + 行号在范围内」）→ 一次性回填（含 3 条 `sampleDir` 目录型），并给 `check-samples-coverage` 新增**内容锚点**规则（`negative-coverage-evidence-anchor`：引用行内容必须出现该 fixture 名）；正/负两臂验证（注入 +3 漂移即精确报出该行）。
- `selfTestSamples` 与 6 处活体文档：352 → **354**（AST 实测：各 `*_CASES` 实加 353 + 1 元数据用例 = 354）。该常量位于 code-health 删除授权判定链上，诚实声明 354 的候选原先会被误判为矛盾。
- R11 负载性：新增 7 行正向 + 5 行负向测试（此前仅 `design-flaw` / `coding-error` 两行被钉住——变异实验证明 `tool-gap` 行换成任意两个真实 persona 后仍全绿）。

**第 3 批 · 文档矛盾（13 项）**
- 冰山放行判据统一为「`newFindings=[]` **且** R6/R7/R8 三视角对账通过；达 `MAX_ICEBERG_ROUNDS` 走 🔴 CHECKPOINT 由用户裁定」（原 `hard-constraints` 的「或达上限即放行」与 guide「零发现不构成终止」冲突）；规则集号 R1-R5 → R1-R8。
- BDD D2（gherkinSyntax）如实标注**未实装为脚本门禁**（门禁 7 维度，D2 由 V 评审人工核验）；`AGENTS.md` / `hard-constraints.md` 同步。
- code-health 发现者角色三方对齐（CLI 由 O 只读 / G 执行，A 只解读并登记发现）；V 规则枚举 R1-R13 → R1-R18；`verifier-spec` targetKind 4 值 → 5 值；删除 `--skip-tlc` 残留描述；maturity L0 与交付层 L0 同名澄清；模板脆锚修正；examples 份数；**矩阵外 6 份人格入册**（V 可按需指定、R 受 R11 限制不可选）并修正指向它们的换人指针。
- **run-log R8：经复核为规范措辞过度而非实现不足**——两条既有测试断言「无 R3 的 S→V→G→checkpoint」合法，且 R3 三维度齐全**已由 `check-role-dispatch` 阶段级无条件强制**，故按「改文档对齐实现」处置（R8 只校验首个 R3 落在 S 与 V 之间），未加码门禁。

### 人格库上游核查与 5 份人格补充（persona-upstream-audit，2026-09-17）

> 触发：核查人格来源仓库 [jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh) 是否有更新、是否有需要补充的人格。结论：**无内容级更新**；按 R/V 多角度价值补 5 份，人格库 **28 → 33**。

- **上游核查结论（实测）**：对导入基线（`550a29fa`，2026-07-24）后的上游逐份比对——吸收的 28 份中 **20 份与上游当前内容逐字一致**；8 份有差异，其中 2 份是**本仓本地增强**（`engineering-code-reviewer` 的 Fowler 12 坏味道基线、`engineering-technical-writer` 的占位符与外链本地化），另 6 份仅上游把 frontmatter `color` 改为十六进制值（`product-manager` 另加「（PM）」后缀与 `tools:` 字段）——**无正文级更新，均未跟随**（本仓不渲染颜色、无 tools 契约）。
- **新增 5 份人格（28 → 33，均按 §1.5 补四字段声明）**：
  - `engineering-security-engineer` —— 应用安全（威胁建模 / 漏洞评估 / 安全代码审查 / 安全架构 / 事件响应），补矩阵缺失的 **AppSec 视角**（既有 `engineering-threat-detection-engineer` 是 SIEM / MITRE ATT&CK 检测向）；
  - `engineering-sre` —— SLO / 错误预算 / 可观测性 / 混沌工程，补**可靠性视角**（原性能行只有数据库 + 基准 + 后端架构）；
  - `engineering-minimal-change-engineer` —— 最小可行差异、拒绝范围蔓延，用于**返工修复评审**（防「修 bug 变重构雪崩」）；
  - `engineering-codebase-onboarding-engineer` —— 只陈述基于代码的事实的追溯纪律，用于**上游回溯**；
  - `testing-accessibility-auditor` —— WCAG + 辅助技术实测、默认立场是找问题，用于**无障碍审核**。
- **接入矩阵**：R 第一键 `upstream-defect` 行 + 代码库入职引导；R 第二键「安全相关 Critical」+ 应用安全、「性能相关 Critical」+ SRE；V「系统设计评审」+ SRE、「代码评审」+ 应用安全、「测试评审」+ 无障碍审核；**新增 V 行**「返工修复评审（S-fix 产出）」= 最小变更 + code-reviewer + evidence-collector（3 候选）。`R_PERSONA_MATRIX` / `R_PERSONA_SIGNAL_MATRIX` 与 `agent-personas.md` §2 两张表同步（`rootcause-persona-matrix` 逐行对账，本轮实测 0 违规）。
- **来源与收录策略入册**：`agent-personas.md` 新增「人格库来源与收录策略」节（来源 URL / 导入基线 / 收录判据 / 收录规模 / 本地契约 / 已知偏离）——此前仓库内除导入提交信息外**无任何来源记录**，无法判断上游是否更新。
- **计数同步**：README / AGENTS / INSTALL / agent-personas 的人格数 28 → 33（README 的「N 个人格文件」是 `checkAssetCounts` 的解析点，改漏即 exit 1）。
### M 程序：外部技能采纳 P0–P6（expanded-external-skill-adoption，2026-09-14 ~ 2026-09-16）

> 采纳判据与逐项验收见 `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` §13（AC-0…AC-12）；各期提交序列、评审轮次与收口实测记于 `docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md`、`2026-09-14-p1-meta-theory-absorption.md`、`2026-09-14-p2a-gate-negative-coverage-and-atomicity.md`、`2026-09-15-p2b-rule-loadbearing-and-completeness.md`、`2026-09-15-m07-rtm-test-evidence.md`、`2026-09-15-p3-role-independence-and-review.md`、`2026-09-15-p4-test-quality-and-design-rules.md`、`2026-09-16-p5-debug-ops-interaction.md`、`2026-09-16-p6-rejection-knowledge-base.md` 的收尾节。**本节计数一律取收口实测**，不沿用各期文档写作时的中间值（43 / 44 / 332 / 340 / 344）。

- **P0 裁定录入（2026-09-14）**：50 个采纳项全部带裁定记录（44 项直接采纳 + 6 个决策点 D-1 至 D-6 由用户裁定），不存在「实现时再决定」的流程语义；两张 vendor 摘录入库，证据图 4 条 🟡 全部解除；D-1 的「不全量改写 48 条反模式主表述」由「未验证」升级为「有本地 A/B 证据支持」——对照臂未复现失败，按已采纳的 S04 属无可修缺陷。
- **P1 元理论层（M01 / S03 / S04 / S02 / S05 / M02 / S01 / M16 / M15，2026-09-14）**：新增 `references/asset-authoring.md`（资产编写杠杆、渐进披露数字阈值、指针约定、no-guidance control 的「授权不写」）；`SKILL.md` 的 description 收敛为只写 when、不概括工作流（仍是完整触发清单）；`hard-constraints.md` 落地「失败类型 → 指令形式」分流判据与 No nuance clauses / Exemption clauses don't scope（48 条主表述不改写）；单一权威文案纪律落到 `README.md` / `docs/INSTALL.md` / `AGENTS.md`，安装与快速开始命令只留一处权威、其余指向。
- **P2-A 门禁负向覆盖与失败原子性（M06 / S26 / S28 / S29，2026-09-14）**：`check-samples-coverage.ts` 新增「每个 exit-2 门禁都有会失败的负向案例」强制不变量（第四条规则：未登记 missing 与证据悬空均 exit 1）；测试层对每个 exit-2 门禁断言「负向路径失败后状态逐字节不变」；`samples/README.md` 矩阵增「所防回归」列；mock 须复刻真实契约的替身保真判据。
- **P2-B 规则负载性与完整性（S25 / S27 / S30 / S31 / S32，2026-09-15）**：新增规则级三态 fixture 协议（RED / GREEN / PRESSURE——移除该规则文本必须复现旧行为）；run-log 新增 R10 `revertEvidence`（回滚后必须变红，否则该修复无证据）；L0 载体定量预算断言；`check-docs-consistency` 增完整性审计双维度；**新增确定性 CLI `review-package.ts`**（评审包按固定顺序落单文件，同输入同字节可复现、不含时间戳）。
- **M07 RTM 测试证据（独立 Schema 批准单元，2026-09-15）**：经用户单独批准（裁定 D-2）后，`rtm.schema.json` 新增**可选** `testSummary.evidence`（`command` / `exitCode` / `observedAt` + 可选 `rawOutputPath` / `rawOutputSha256`）；`check-artifact-gate.ts` 经 `gate-logic.ts` 新增 E1–E4 四规则（配对 / SHA-256 核验 / 结果一致性含 RED 绑定 `failed>0 ⇒ exitCode≥1` / 存在性 + cutoff，早于 cutoff 吸收为非阻断 legacy）；RTM 实体、关系与覆盖率语义不变，schema 文件数不变。
- **P3 角色独立性与评审（S06 / S07 / S08 / S09 / S10 / S11 / S14 / S16 / M14，2026-09-15）**：禁止编排者在派单提示中预判 findings（不得写 "do not flag" / "at most Minor"）；「不信任报告」——作者 rationale 是 claim、不得据此降级 severity，plan 作者不自评自己的 plan，test output 的 warning 即 finding；面向 V finding 的误报质疑通道（回流新 V，禁编排者裁决）；scoped re-review（只审 fix delta 并逐 finding 判 ADDRESSED / NOT ADDRESSED，"Attempted is not addressed"，Minor 不进 loop）；CHECKPOINT Ruling 三要素（含「若错代价」）；模型档位 × 修复轮次 escalation 且必须显式指定模型；≥3 次修复失败的技术判据（暴露新共享状态且位置不同 / 要求大规模重构 / 别处产生新症状 ⇒ 架构错误）；Loop 4 retro 七类改进源。
- **P4 测试质量与设计规则（S21 / S19 / S20 / M03 / M09 / M10 / M11 / S12 / S18，2026-09-15）**：测试质量判据（change detector / string-presence trap / "Name the break" 前置门 / 期望值独立推导 / Mutation Check 五类变异 / Mock 三条硬规则）；设计压力与 seam 负向判据（两 adapter 才成真 seam、deletion test）与 ADR 入选三问门槛；expand-contract 兜底与票据 preflight 成对冲突扫描表；**票据内容门禁**在 `check-artifact-gate.ts --phase=5` 生效（占位符黑名单 + 可构建性判据），V 侧对应必答项。
- **P5 调试运维与交互（M05 / M17 / S13 / S24 / S22 / M13 / M04 / S17 / M18 / M12 / S15 / S23，2026-09-16）**：R 入场门（红信号四项验收 + 3–5 条排序可证伪假设 + 预测格式）；S 的 loop 构造方法清单与「提高复现率而非干净复现」；「无根因」合法出口（`check-rootcause-report.ts` 新增 `noRootCause` 条件分支——R1/R2/R3 判据逐字保留，是条件豁免而非删除）；条件等待三要素与三反模式；事件接驳前置核实（先核实主张再受理）；CHECKPOINT 提问与呈现规范（每题一想法 + 答案 stub、必给推荐答案、Push right、Brief 三段式）；`.w-model` 在 worktree 内的隔离五条纪律定稿；受控低仪式探索通道；阶段开工前三路径分诊与分类口播；clean baseline 强制与 `git worktree prune` 自愈。
- **P6 拒绝知识库（M08，2026-09-16）**：拒绝登记挂靠阶段 1 规格产物的**既有** §8（五列：`conceptKey` / 拒绝理由 / `Prior requests` / 状态 / 来源；一概念一行、`conceptKey` 归一化后唯一、仅 rejected enhancement 入册），零新增目录、零新增 `.w-model/*.json`；需求入口新增「按概念相似度去重」读取动作（surface → Confirm / Reconsider / Disagree 三选一 → 判定必须口播），**不新增 `/wm` 子命令、不改 ingest 既有确定性分流**；门禁（`gate-logic.ts` 的 `checkOutOfScopeRegister`）只校验**登记结构**——**「门禁通过」≠「去重已发生」**：概念相似度由入口的语义匹配承担，证据须引用 `GATE_JSON.reasons` 中 `structure: §8` 桶的计数，不得以整体退出码为据。
- **三处用户会注意到的语义变化（P5 / P6，如实披露）**：
  - **新增一个按需工具 CLI**：`check-pollution.ts`（污染源二分定位：逐文件跑、停在第一个污染源，确定性、不调用 LLM）。**不进 pre-push**、不接入任何阶段门，`prePushCount` 仍 **18**；`cli/*.ts` 44 → **46**（P2-B 的 `review-package.ts` 与 P5 的 `check-pollution.ts`）。
  - **新增提交前快层 `.githooks/pre-commit`**：staged-only 快层（staged prettier `--ignore-unknown` + 增量 `tsc`），慢层全量 suite 仍留 pre-push；**不引入 husky、不改 `package.json`**。按类别排除 `*.md` / `docs/changes/*` / `eval/*` / `samples/*` / `templates/*` / `docs/index.html`（被排除类别内 `.ts`/`.cjs` 计数为 0，故 hook 检查面 ⊇ pre-push 面，属收敛而非放松）。
  - **phase-1 结构门禁的数据要求收紧**：`docs/phase1-requirements/requirement-spec.md` 的 §8 须为合规五列表格（含 ≥1 数据行或哨兵行），否则阶段 1 结构校验报 `structure: §8 …` 违规（exit 1）。属**既有门禁的判据强化**——不新增命令、不新增放行路径、不改 `/wm` 命令的输入 / 输出 / 语义；未引入 legacy 时间豁免。
- **计数变化（2026-09-16 收口实测）**：exit-2 脚本 43 → **45**；`self-test` 332 → **352**；`cli/*.ts` 44 → **46**；`references/*.md` 42 → **43**；`schemas/*.schema.json` 仍 **34**（M07 为既有 schema 增可选字段）；`prePushCount` 仍 **18**；反模式仍 **48**（无 #49）；`audit:l0-links` exit 0（672 / 95 / 36，`violations: []`）；**版本保持 42.2.1，不 bump**。

### vitest 执行模型与推送前门禁确定性（vitest-project-split，2026-09-14）

> 这是**测试基础设施**变更：不影响 `/wm` 命令语义、不改任何门禁判据、pre-push 项数仍 **18**。现象、根因与排除过程记录在 `docs/changes/vitest-parallel-flakiness-finding.md` 与 `docs/troubleshooting.md` 1.7a 节。

- **先全局串行化（`b71c2fe1`）**：`npm run prepush` 第 12 项（vitest + coverage）偶发红，失败数为 1–2 条（极端时达 20 条）且**每次落在不同文件**，形态为 `expected null to be N`（子进程未真正运行）/ `STACK_TRACE_ERROR` / 30s 超时——同一命令同一代码两次运行失败数可差 10 倍，量级跳动排除「断言写错」；基线 `72081e2` 同样复现。`--maxWorkers=4` 与 `--testTimeout=120000` 实测均无效，唯一有效解是**子进程类文件互不重叠**，故设全局 `fileParallelism: false`。代价是墙钟翻倍（带 coverage 457s 抖动 → 1055s 绿），属接受成本。
- **再收敛为两个 project（`5d212e52`）**：`cli-serial`（30 个真实 spawn CLI 子进程的测试文件，`fileParallelism: false`）与 `unit-parallel`（其余纯逻辑文件，保持默认并行），取代全局串行。成员名单是单一常量 `SUBPROCESS_TEST_FILES`，两个 project 的 include / exclude 由它派生，两个视图不会漂移；新增 `vitest-project-split.test.ts` 按**源码证据双向**守护该清单（真实 spawn 未登记、无证据残留、文件不存在均红灯），并显式登记三类判定陷阱：`vi.mock('node:child_process')` 的替身文件、仅类型导入、注释与正则里的词，均**不算**真实 spawn、不登记。
- **配套校准**：`check-docs-consistency.ts` 的 `VITEST_SPAWN_TIMEOUT_MS` 600s → 1800s（串行后套件 975–1060s，旧上限会把健康仓库误杀成 `vitestTestCount: -1`）；`lib/run-sync.ts` 两条 runSync 行号锚随注释扩充 +2 行顺延（`run-sync.test.ts` 有行级断言）。
- **诚实边界**：全量墙钟几乎不变（974s vs 全串行 975s）——**子进程文件自身的执行时间占大头**；本变更的收益在**结构确定性**（并行集合与串行集合显式化并由守护测试锁定），真正的提速方向是降低子进程测试自身耗时，而非调整并发结构。实测结果：`npm run prepush` 首次获得确定性全绿（18 项、exit 0、1055s），含此前无法可靠通过的第 12 项与第 14 项。

### 门禁完整性与证据事实对账（gate-integrity-evidence-reconciliation，2026-09-12）

> 本 campaign 修的四个缺陷共享同一根因：**形态合规但事实不正确**。同义反复的测试可通过四级门；`newFindings: []` 可通过冰山校验；`passed` 在 R3 中从未被读取；捏造的 `evidenceAnchor` 路径可通过 R15 正则。通用修法是**分母来自上游产物，而非自我声明**。

- **A-1 verifier-spec R14-R17 悬空规范修正**：`:278` 原规定四问结论写入 `summary.collaborationReview` 对象，但 `verifier-output.schema.json` 声明 `summary` 为 string 且父对象 `additionalProperties:false`——**无任何输入可同时满足**（实测：对象 → `must be string`）。改为固定前缀文本（`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），零 schema 成本。
- **A-2 死引用修正（8 处）**：全仓 8 处引用 `SKILL.md「阶段门与质量门」`，该章节不存在（实际已拆为 `workflow.md` 的「阶段门评审」与 `quality-standards.md` 的「质量门检查清单」）。含反模式 #1 的安全关键路径。逐处改指真实承载章节。
- **A-3a R3 预防性审查判据接上**：`preventive-review-logic.ts` 原抄录 `passed`/`findingCount` 但从不纳入 `reasons`，三份 `{"findings":[],"passed":true}` 即通过。现 `passed=false` 产生 violation。
- **A-3b 冰山扫掠分母对账**：原 `expectedPassed = newFindings.length === 0`——**通过 ≡ 声明未发现任何东西**，且 `sweptArtifacts` 无 `minItems`。现分母由上游产物实测，graph/TLA/RTM **三视角平权**两两对账（无主分母、不归一化、不取并集放行），差异即刻失败（R6）；在场表为代码常量（D9）；缺席须显式声明（R7，禁止静默跳过）；零发现但覆盖不足为失败信号（R8）。
- **A-3c 证据锚点必填 + 常态扫描**：`evidenceAnchor` 由可选改**阶段 1-4 全节点必填**，新增 `evidenceStatus`（`confirmed`/`pending`）。阶段门放行前扫描 `pending` 即阻断（**常态触发，非返工触发**——pending 是「尚未验证」而非「产物有缺陷」，走 R 会把没做功课误判为产物有缺陷）。R15 拆为 **R15a/b/c/e** 独立定位（缺失/状态/存在性/签名链环）。**不新增第三色**：invalid 由既有 `coverageStatus` + 返工链承载。
- **A-3d 评审偏移检测**：标准偏移（同一产物跨轮次 `qualityLevel` 差 ≥2 档 → **人裁定，不走 R**——评审者自身不一致，R 无法自查评审标准）、校准偏移（`rawScores` 非全等但方差坍缩 → 分辨力不足；与既有「全等检测」区分，不重复报）。
- **A-3e 证据路径存在性**：原只校验格式，`src/nonexistent.ts:L999=捏造` 可通过。现验存在性 + 与签名链对账。**仍不验语义支持**（需判断，属 V 评审）。
- **A-3f 校准集（非门禁）**：新增 `samples/verifier-calibration/`，人工标注正解，**明确声明非门禁**（标注与 LLM 执行均非确定性）。
- 124 个 graph 节点 / 31 个 fixture 迁移至必填字段；`exemption` 新增第 6 类 `evidence-anchor-pending`（复用 E1-E9 四阶段审批）。
- **两处设计中发现的真问题**（均由"实测而非直觉"捕获）：① 计划的 `RESOLUTION_FLOOR = 1e-4` 会误报 **122/137（89%）** 的合法样本（真实合法方差下限约 `6.67e-5`），定稿 `1e-6`（仅命中刻意负样本）；② `ICEBERG_VIEW_PRESENCE` 原把 `graph` 排除在阶段 5-8 之外，但阶段 2-8 **全部**消费 `graph.json`（D8 SD Coverage），遗漏构成真实盲区——同一产物集在阶段 4 可测出的 graph↔rtm 差异，在阶段 5 会因 graph 视角不派生而被静默吞掉。已修正并补两条回归测试锁定。
- **R15d 已决议不实现**：codegraph `--scope` 覆盖语义限定阶段 5-8，图谱节点只在阶段 1-4，定义域不相交。编号空缺为已决议项，非遗漏。
- **顺带闭合 7 处活体文档漂移**（campaign 审计发现，逐处按**实测值**订正，非估算）：① self-test 计数 6 份活体文档共 11 处写 322 / 262，实测 **332**（历史 CHANGELOG 与既往往验收记录保留其当时数值，属审计轨迹不改）；② `user-guide.md` 反模式计数 47 → **48**（`hard-constraints.md:235` 存在 #48）；③ `subagent-delegation.md` 称 `references/` 有 "59 份 .md（39 非 stub + 19 重定向 stub）"，实测 **42 份且无任何 stub**（42.0.0 合并就地完成，从未留下重定向文件）——"19 个 stub"为编造，已改按实测组成表述并说明表格行按**主题**而非文件计数；④ `quality-standards.md` 三处模板计数 13 / 12，权威为 `templates/README.md` 的 **4 个阶段主模板 + 10 种独立子模板**；⑤ `__tests__/README.md` 矩阵漏登 **21 个**测试文件（80 个中仅 59 有行，整套 code-health / platform-deps / wm-write 缺失），已按各文件自身注释补齐并验证无遗漏无幻影——`check-docs-consistency` 只统计目录数、从不与此矩阵交叉核对，故长期无人发现；⑥ `command-reference.md` 引 "SSoT §1338"（不存在）→ **§10.5.2**；⑦ `bdd.md` 头标注字段数 9 → **10**（§2.2 实定义 10）。**核实为非缺陷**：AGENTS.md 的 "43 个 exit-2 脚本" 正确（门禁 `exit2ScriptCount`=43、`cliScriptCount`=44，系两个不同口径），§8 导航表 44 行与 44 个 CLI 脚本精确一致。
- **本轮验证**：pre-push 18 项全绿；self-test 332/332；Vitest 1904 用例；coverage 76.75/71.92/87.69/78.8（阈值 75/65/85/75）；eval 60/60；docs-consistency 静态/动态违规 0。**破坏性验证十项逐项实测**（记录见 `docs/changes/gate-integrity-destructive-verification.md`），其中 2 项曾以无关红灯充数，已如实标注为无效控制并改用有效证据。阈值定稿依据见 `docs/changes/gate-integrity-threshold-calibration.md`。**已知非本 campaign 缺陷**：并行执行下子进程类测试偶发失败（基线 `72081e2` 同样复现，串行 + coverage 可确定性 1904/1904 全绿），记录见 `docs/changes/vitest-parallel-flakiness-finding.md`。版本保持 42.2.1，不 bump。

### 修复（42.2.0 后静态审计整改）

- **模板链接与门禁一致性**：修正 `templates/requirement-spec.md` 的 6 条子模板路径，并将模板漂移门禁及回归 fixture 同步到 `requirement-spec/` 子目录；聚焦 Vitest 52/52、全量 Vitest 1247/1247。
- **编排闭环与示例契约**：SKILL 恢复 `R3×3 → G(check-preventive-review) → V → G` 顺序和完整普通返工链；examples 总览、阶段 1、阶段 5 编码及阶段 6-8 测试执行示例补齐角色隔离、CHECKPOINT、codegraph/OpenSpec、BDD 必填参数、当前 GRAPH_JSON 字段、真实 `result=pass|fail` 回填及阶段 7 `--phase=7`。
- **L0/L1 与历史证据边界**：保留并明确分类 92 条 L1-only 脚本链接，quickstart 将 npm/doctor 验证限定为 L1，技术写作者模板改为消费项目贡献指南占位；41.9.0 real-run evidence 按历史快照锁定，`272/234/15` 不与 42.2.0 的 `282/244/15` 作趋势比较。
- **独立审查第 1 轮闭合**：补齐此前遗漏的 stage 5-8 独立示例、phase references、BDD 指南、workflow、DoD、分派模板和测试模板。普通 V/G 失败统一为 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3×3/预防审查/V/G/用户 CHECKPOINT；所有可复制 `/wm test` 含真实 `result`，所有项目阶段 BDD 调用按 phase 强制 TLA/graph/Cucumber 参数，stage 6/7 BDD_JSON 采用当前摘要形状。新增严格 L0/L1 审计与 8 条 TDD 回归，仅现存 `scripts/samples/tools` 可归 L1-only，其他断链/越界 fail-closed；当前测量为 645 条、L1-only 92、模板占位 36、意外断链 0。
- **独立审查第 2 轮闭合**：phase 5-8 references 的 `/wm test` 入口统一要求真实 `result=<pass|fail>`，诊断表降级为 R 定位线索，实际返工和跨阶段动作只能经 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3/preventive/V/G/用户 CHECKPOINT。旧需求/设计交互示例补普通失败分支。L0/L1 审计对缺失必需 L0 目录/`SKILL.md` 和包外 L0/L1 symlink fail-closed，新增相应 TDD 回归。
- **独立审查第 3/4 轮闭合**：phase 5 的票据化例外不再允许直接 `R→S-fix`，且新增全量 references/examples/templates 文件扫描契约，单一 bug/TLA+ 不变式违反仍走完整普通失败链；L0 审计对顶层及嵌套 L0 目录 symlink/junction、缺失必需 L0 资产和包外 L0/L1 真实路径 fail-closed。新增公开 `npm run audit:l0-links [-- --root=<skill-root>]` 入口，输出结构化 `L0_LINK_AUDIT_JSON` 与真实 exit 0/1/2，不改变 prepush 17 项或 cli 脚本计数。
- 历史/中间验证：初版分层链接检查为 641 条（后续文档链接新增导致当前严格审计为 647 条），L0 CLI 当前审计 `647/92/36/0`（历史测量；后经 workflow.md 新增 2 条合法引用链接更新为 649/92/36/0，见下——字段口径 relativeLinkCount/l1OnlyCount/templatePlaceholderCount/violations），eval 25/25，self-test 262/262，samples coverage 282 fixtures / 244 referenced files / 15 dirs，docs-consistency 静态/动态违规 0，doctor exit 0（0 阻断 / 3 可选提示）。版本同步后 Git Bash `bash -c "npm run prepush"` 真实 exit 0，17 项全绿；独立审查第 1 轮完整 Vitest 为 61 files / 1265 tests / 1265 passed，第 2 轮为 61 files / 1271 tests / 1271 passed，第 3 轮为 62 files / 1277 tests / 1277 passed，第 4 轮为 62 files / 1279 tests / 1279 passed；这些是历史/中间测量，不冒充当前最终 HEAD。
- **独立审查第 5 轮最终修复**：完整 phase references、templates、legacy examples 的普通失败指引均要求 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；`/wm test` 只接受真实 `result=pass|fail` 占位或运行器实际值 `result=pass`/`result=fail`，非法占位有边界断言。L0 审计以 lstat/realpath fail-closed 拒绝 L0/L1 文件与目录 symlink/junction、包外路径、未允许 broken link 和 malformed percent-encoding，并对未被引用的 L1 链接做不跟随目录扫描；CLI 默认 root、显式 `--root`、exit 0/1/2 和注册表均有契约测试。历史/中间 L0 CLI 测量为 `647/92/36/0`；版本保持 42.2.1。
- **第 5 轮后续收尾**：以 TDD 补齐 Windows drive-letter 正斜杠与反斜杠路径回归；显式识别 `C:/...` 与 `C:\\...`，不依赖 POSIX 上的 `path.isAbsolute`，两类路径均结构化 violation/exit 1。正常 `https:`、`mailto:` 与 fragment URI 继续位于相对链接审计范围之外，畸形 URI 保持 fail-closed。删除 `phase-5-coding.md:262` 尾随 ASCII 空格，并同步验收记录的第 1～5 轮范围与父链提交主题。后续定向测试为 4 files / 68 tests，完整 Vitest 为 62 files / 1303 tests / 1303 passed，串行 docs-consistency 为静态/动态违规 0、provenance 1303/1303；最终 Git Bash prepush 与最终 HEAD 由外部命令核验。

- **最终契约收口**：递归扫描全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作，明确禁止语境与 phase 1 ingestion A-chunk/A-cross→G 专用收敛例外；普通失败均要求完整 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 链，`/wm test` 值按边界断言。补充 L0 根目录 symlink/junction 与 CLI stderr `ERROR_JSON` 回归；README、toolbox、command-reference、subagent registry、dependency-boundaries/security 契约保持登记，版本 42.2.1 与 fast-uri 3.1.7 保持不变。
- **本轮定向验证**：4 files / 70 tests / exit 0（examples-contract 20/20、L0 logic 29/29、CLI 11/11、dependency-boundaries 10/10）；完整 Vitest 62/1307、串行 docs-consistency 重跑 0（1307/1307）、eval/self-test/doctor/samples/security/typecheck/npm audit 均已实测通过；Git Bash prepush 首次在第 13 项因 registry `ENOTFOUND` / audit endpoint 不可达 exit 1，格式化修复后及最终证据同步后均真实 exit 0、17 项全绿；网络失败作为瞬时 concern 留档，未冒充代码通过。
- **Task 8 最终修复轮（2026-09-03）**：`examples-contract.test.ts` 递归覆盖全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作与多行 `/wm test` 命令；普通失败统一走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，phase 1 ingestion 保持 A-chunk/A-cross→G 专用收敛。L0 审计既有 fail-closed 边界补内部非 Markdown 目录 symlink/junction 回归；版本 42.2.1、fast-uri 3.1.7、pre-push 17 项和 CLI 37 项统计均保持不变。
- **最终修复轮验证**：examples-contract 23/23、L0 logic 30/30、L0 CLI 11/11、全量 Vitest 62 files / 1311 tests / 1311 passed；L0 CLI 默认/显式 root 均为 `647/92/36/0`，eval 25/25，self-test 262/262，doctor 0 阻断/3 提示，samples 282/244/15，security 新增 0，typecheck、npm audit high、docs-consistency 均 exit 0。Git Bash `bash -c "npm run prepush"`：证据提交后首次因格式检查发现 1 个文件 exit 1；按 prepush 配置格式化后，在最终记录提交后真实 exit 0、17 项全绿。
- **扫描器收口修复轮（2026-09-03）**：`examples-contract.test.ts` 扫描器改为保留作用域的分析单元——表格行按整行分析（失败信号在「质量门未通过」单元、旁路动作在「回阶段 5 编码返工」单元时不再漏报），普通行按句/单元分析，fenced 代码块跳过；同一单元出现「完整普通失败链」字样或完整箭头链即视为满足，合法 R-first 描述（先分派 R → V 复审 → 才可分派 S-fix）与禁令复述不误报，C/D 仅在路由到动作时构成失败上下文，phase 1 ingestion A-chunk/A-cross→G 专用收敛例外保留。红灯实测定位 6 处真旁路后逐文件闭合：`bdd.md` §4.1 两条独立门禁回退（BDD/TLA+ 门禁失败先走完整普通失败链，S-fix 修复范围限于对应子流程资产、对侧不受影响）、`command-reference.md` `/wm review` 失败动作行（qualityLevel C/D 视为 V/G 失败 → 完整链，`reworkHints` 仅交 R 作定位线索）与 BDD 项目证据门 exit 1 行（扫掠发现同类旁路：先走完整链再按 R 结论由 S-fix 修复/补齐工件）、`hard-constraints.md` 门禁脚本退出码精确对应表 exit-1 两行（改为先走完整普通失败链再按 R 结论返工）。版本保持 42.2.1。

### 审查问题修复（gate-closure，2026-09-04，doc sync）

任务 1/3/4 引入的代码契约在本轮同步进 SSoT、references、活体文档、测试矩阵与验收记录（实现文件为事实源，文档编辑未改任何 `.ts` 校验逻辑；父链现已连续覆盖至合并前 tip 的父提交，完整身份见下表父链追加行——`689e51bd114831a209af92c99e82afea2e97f512` 起至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，逐 commit、40 字符完整 SHA、按时间顺序；本追加提交自身按规则不入链）：

- **ChangeScope + codegraph/opsx/archive strict 绑定**：SSoT §3.3.1 补 ChangeScope 段落（`change-scope.schema.json` / `codegraph-query.schema.json`、headRef=当前 HEAD、changedFiles 与实际 Git 变更集合精确一致、缺 scope exit 1 fail-closed）；SSoT §10.5 新增 §10.5.2（阶段 5-8 门禁顺序 codegraph/opsx strict → artifact gate 聚合 → opsx:archive → archive checker 后置门 → CHECKPOINT；GATE_JSON external summary；`scopeProvidedButFailed` 抑制误导文案；gate-logic externalChecks 透传已删除）；phase-5-coding「codegraph 修改前影响分析」节与 phase-6/7/8、hard-constraints #14/#38、command-reference「阶段 5-8 codegraph/opsx/archive 门禁 CLI」节、subagent-delegation G 模板与阶段 8 终检命令同步 `--scope=` 调用与 fail-closed 语义；examples（coding/stage5/stage8/test-execution/README）与 templates/coding.md 的阶段 5-8 门禁命令补齐 `--scope=.w-model/change-scope.json`。
- **artifact gate 聚合与 R3/run-log 语义**：SSoT 新增 §10D.8（R3 三种证明路径矩阵：standard 阶段级 role-dispatch+preventive-review / fix-emergency run-log identity window+preventive-review / opsx stage 9 份 R3+3 份 V；role-dispatch 空/全 invalid fail-closed、R3 只计 role=R+success 的 r3-* 三维度各 ≥1、r3Missing 明细、`--r3-enabled` no-op）；SSoT §10D.3 补 variant/blocker/fixedLocation/fixBasedOn 字段与坏行语义；data-models RunLogEntry 接口与动作字段表、subagent-delegation 检测脚本措辞（fix variant 可选向后兼容、emergency-fix 强制 variant+blocker、双 legacy 行经合并 legacy 谓词吸收为 LEGACY_VARIANT/LEGACY_UNSCOPED 非阻断）、hard-constraints #34 处置行、preventive-review `passed=false ⇒ findings ≥1` 同步至 schema 清单行与 #11 节。
- **pre-push 真实 push stdin 行为**：SSoT §8.2.4、README CI 策略、AGENTS 目录表、INSTALL §3.1、CONTRIBUTING 钩子节、troubleshooting 新增 1.7b 同步四字段 ref 行解析 / 多 ref 聚合 / 新分支 fork-point/merge-base 可证明基线 / delete-only 放行 / 空 stdin 回退 HEAD@{push} / 解析失败与基线不可建一律 fail-closed 全门禁；`docs/*.md` case 跨目录匹配按实测行为表述。
- **活体文档修正**：troubleshooting 1.7 重写为 docs-consistency 现逻辑（vitest 文件数/用例数是受控动态 facts + provenance 绑定实际提交，不再要求复制到 README/AGENTS/pre-push 文本）；CONTRIBUTING/user-guide/pre-push 注释的 self-test 样本数 260→262（实测 `npm run self-test` = 262/262）；新增测试文件登记进 `__tests__/README.md` 矩阵（artifact-gate-external / change-scope / check-codegraph-queries / check-openspec-archive / check-opsx-artifacts），docs-consistency/role-dispatch/run-log/schema-validation 行描述同步新契约；`l0-link-audit-logic.test.ts` 实包审计链接数 647→649（workflow.md 新增 2 条指向 command-reference/subagent-delegation 的引用链接，violations 仍为 0）。
- **本同步的完整普通失败链锚点**：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 在 8 份 phase references、5 份模板、全部 examples 与相关 references 中逐字保留（grep 核对无删除/改写），examples-contract 28/28 通过。
- 版本保持 42.2.1，不 bump；pre-push 17 项、CLI 37 项、schema 25 份统计口径不变。门禁实测与父链追加见下表及验收记录 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`。

### 审查 26 条处置索引（review-fixes，2026-09-03）

2026-09-03 对 `origin/main`（93f6f3a）→ `f0add11` 的 129 提交完成四独立只读审查，共 26 条发现（4 Important + 22 Minor），逐条处置、全部可追溯：4 Important 与 21 Minor 已修复；B7（`docs-consistency-logic.test.ts:2877-2931` 文本级契约测试脆性）裁定 wontfix——in-file 注释已声明为刻意防线（防 hook 语义漂移），保留现状、不归为缺陷。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-03-review-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 13 项处置索引（archival-fixes，2026-09-04）

2026-09-04 对 42.2.1 域 13 条留档项（最终独立审查 2 条 parked Minor P1/P2 + 账本 11 条延后 Minor D1-D11）逐条处置、全部可追溯：P1/P2 与 D1-D10 已修复；D11（台账收尾）即本段——父链追加行覆盖 `548e43a3553fc1109349e461458a288d0e48e383`..`09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` 全部 first-parent 提交（4 行，含战役前规格与计划提交）、前注与范围句刷新至合并前 tip 的父提交，本追加提交自身按规则不入链。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-04-archival-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 4 项处置索引（archival-fixes-2，2026-09-04）

2026-09-04 对 archival-fixes 最终审查留档的 4 条 Minor（A `ResolvedCliScope` violations 变体 `attemptedChangeId` 必填化 + 薄封装透传断言、B 归档日期前缀注释 0-99 精度、C 上节散文句如实覆盖表述、D L0 内联链接正则注释精度）逐条处置、全部可追溯：4 条全部修复；台账收尾即本段——父链追加行覆盖 `c3636a3b70901f706d15f83bf5daba27ca64fa6a`..`7b52d4cd2559abac09abc1c3bb7a04619037ad29` 全部 first-parent 提交（4 行，含上一战役台账收尾提交与战役前计划提交），上文「审查问题修复（gate-closure）」与验收记录两处范围句终点顺延至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，本追加提交自身按规则不入链。处置计划见 `docs/superpowers/plans/2026-09-04-archival-fixes-2.md`；版本保持 42.2.1，不 bump。

### 审查 27 条处置索引（review2-fixes，2026-09-05）

2026-09-05 对本战役独立审查的 27 条发现（2 Important + 25 Minor）逐条处置、全部可追溯：27 条全部修复，零豁免延续。其中 8 项为脚本/钩子行为变更，A1-A5 与 H3 为收紧，H2/H4 在 registry/advisories 上下文锚定与 npm 7 形态前提下扩大瞬态 skip 豁免、对齐既有 ENOAUDIT/registry 不支持 audit endpoint 的瞬态 skip 策略（A1-A3：l0 内联链接先 title 切分再剥尖括号、reference 定义补冒号后无空白与目标换行两形态且单字母 scheme 不再按 URI 放行、`.githooks/` 前缀判 code；A4：parse-args 重复 flag → `ARG_INVALID`/exit 2；A5：LEGACY_VARIANT 吸收加 `2026-09-01T00:00:00Z` 截止；H2：404 Not Found GET registry/advisories 上下文新增 skip；H3：状态词分支补 network/registry/request 同行上下文锚定；H4：npm 7 `npm warn audit network` 形态新增 skip），其中裸 E404（基线即如此）与裸状态词维持阻断，blocking 优先不变量有 18 行表驱动测试钉死。失败链锚点化（D2）：references/templates/SKILL.md 全句内联由 194 处（193 行）收敛为短名引用「普通 V/G 失败链」，全句仅存 2 处权威落点（hard-constraints.md 新增「普通 V/G 失败链（标准返工链）」节 + conventions.md 术语表新增词条），examples/ 教学示例保留全句，examples-contract 扫描器同步接受锚点短名（27/27 通过）。措辞与流程收尾：D1 三处 graph 缺失归因改为「phase>=2 缺 --graph 为 ARG_INVALID/exit 2（进入 D1-D8 前即拒绝；graph 为 D8 的数据源）」、D3 phase-1 豁免 reject 场景改朴素表述、D4 自然退出契约测试句归位生产 CLI 段、P2 acceptance 轮次子表加父链子集注记。l0 基线 relativeLinkCount 649→650（conventions 词条新增 1 条相对链接，violations 仍 0）。I1/I2 两项 Important（templates 6 处 phase 5-8 `check-artifact-gate.ts` 调用补 `--scope`、SSoT L0/L1 链接边界权威节 + INSTALL 同步）随任务 1 先行落地。规格见 `docs/superpowers/specs/2026-09-05-review2-fixes-design.md`、实施计划见 `docs/superpowers/plans/2026-09-05-review2-fixes.md`；版本保持 42.2.1，不 bump。父链追加行覆盖 `11944cd6130b6f3faa1df497fabae3cea6c8385f` 起至 `a5e2c2723a42eb4e17c5ddc7d10cf1453b2b8f6f` 共 13 行（含上一战役三个台账收口提交与本战役全部 10 个提交，逐 commit、40 字符完整 SHA、按时间顺序），本台账收口提交自身按规则不入链。

### 核查发现处置索引（audit-fixes，2026-09-06）

2026-09-06 对独立核查战役（8 域 × 4 子代理共 32 份报告 + 4 份复核裁定，权威去重目录 0C / 6I / 49M + 64 说明级 + 1 已裁定不改）的全部发现逐条处置、全部可追溯：6 Important 与 49 Moderate 已修复、零 defer——其中 F-G4-03（run-log gateLogPath 条件 required，T1-T8 步骤清单均未覆盖的规划遗漏）于 2026-09-07 经定向补修提交 `333a7f3d669a9d599e0cfb68c3264a1a5c176faa` 实现为描述对齐（不加条件 required：262 基线 gate 行均无该字段，条件强制会翻转基线）；64 条说明级中 13 条随任务修复（S2/S3/S4/S18/S19/S20/S22/S25/S46/S49/S56/S57/S64）、51 条 defer；F-G6-03（change-scope 越界 exit 2）维持「已裁定不改」。定向补修的资产变更为 `schemas/run-log.schema.json` 的 `gateLogPath` description 对齐可选审计语义（schema 不做条件强制、省略不阻断校验；填写后受 R6 gateExitCode 回填与 gate-log 交叉校验约束），纯描述变更、不改运行时逻辑、262 基线不变。行为变更按域收口：T1 术语收口——语料 48 处/24 文件归一规范短名「普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节 / 表格式（hard-constraints））」两式、`_Avoid_` 增补全族变体、examples-contract 扫描器 `hasChainMarker` 删非规范名分支并增 `CHAIN_MARKER_MENTION` 提及守卫（闭合否定式/提及式旁路）、l0 引用定义 target 换行排除与平衡括号 bare destination 归一（基线 650/92/36 零漂移）；T2 requirement-coverage——空 crossCuts 且未提供 `--graph` → blocking `C7b`（fail-closed），非空无 graph → 非阻断 diagnostic + `skippedRules:['C7']`；T3 CLI 参数统一——8 入口重复值 flag → `ARG_INVALID`/exit 2、parse-phase 统一空格/等号两形态且重复即错、state-machine/tla-model 顶层非对象输入 → `STRUCTURE_INVALID`/exit 2、阶段 5-8 checker「未提供 --scope」消息补等号形态提示；T4 run-log——`review`/`iceberg-review` 行 `passed=false` 强制非空 `reworkHints`（schema allOf + logic 规则），以 `LEGACY_VARIANT_CUTOFF`（2026-09-01T00:00:00Z）为吸收/阻断分界；T5 门禁口径——role-dispatch 坏行并入 blocking exit 1（与 run-log 同一 fixture 同 exit）、iceberg newFindings 内部重复 findingId → blocking、budget/maturity 无 `--project` 补非阻断 `warnings`、schema 前置下不可达死分支删除、scopeCreatedAt 严格校验（拒小写 t/z）、codegraph-query targetFiles 排除 `.` 段、docs-only 变更不再被 codegraph/opsx strict 阻断、artifact gate `--json` 补 external summary；T6 文档契约与计数——project.json 三处读取统一 `loadAndValidate` fail-closed（exit 2）、3 份 schema description 补全并新增属性级全覆盖静态检查、rtm `$defs`→`definitions`、pre-push 17 项强校验（解析连续 #1..#17 编号块）、samples 门禁双向化（`reference-dangling` exit 1 + 矩阵行精确声明）、conventions/subagent-delegation/AGENTS/troubleshooting 计数与措辞修正；T7 pre-push 健壮性——audit blocking 语料补 `vulnerable`（闭合漏报向 skip）、GNU `\b` 改 POSIX 等价边界（macOS BSD grep 兼容）、path-filter 与 `core.quotePath=false` 契约以源级断言钉死（76→87 用例）；T8 测试质量——wm-write 并发用例受控交错去 flake、run-sync 墙钟改相对窗口断言、examples-contract 全句/短名链常量分离加互斥守卫、self-test 头部分项补印 DesignContract（分项合计 257→262 闭合）。任务 9 收口：`check-docs-consistency.ts` vitest 自采集 spawn 超时 300s 提为命名常量 `VITEST_SPAWN_TIMEOUT_MS = 600_000`（随套件规模 1600 用例的基建调整，fail-closed 语义不变，`WM_VITEST_COUNT_FILE` 快路径不受影响，direct-call manifest 行号同步）；`npm run lint:security` 13 条基线漂移逐条 triage（2 个 T6 新增测试文件按同批先例加 file-level disable、2 处生产误报加 inline disable 注明理由，baseline 重生成 295→289 指纹）。规格见 `docs/superpowers/specs/2026-09-06-audit-fixes-design.md`、发现目录（处置列已全量回填）见 `docs/superpowers/specs/2026-09-06-audit-fixes-findings-catalog.md`、实施计划见 `docs/superpowers/plans/2026-09-06-audit-fixes.md`；验证记录与父链见 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`「核查发现修复（audit-fixes）验证记录（2026-09-06）」节。版本保持 42.2.1，不 bump。验收记录父链表追加 `98bfda09cb9daaac0ea0f1f1a651b946556f514c` 起至 `e3bb923bd0633e77c437f6a9e77fc2c3debd53c6` 共 12 行（含上一战役两个未链收口提交与本战役全部 10 个提交，逐 commit、40 字符完整 SHA、按时间顺序），本台账收口提交自身按规则不入链。

### 触发边界可度量性 campaign（trigger-boundary-campaign，2026-09-07）

- **触发边界可度量性 campaign**：eval 语料库 25→60 条（负向 22/歧义 8/正向 12，L1N 负向层 + notContains 守卫 + coverageMatrix 五项校验）；新增 `references/activation-guide.md`（第 41 份，13 类反例登记册，与语料双向锚定）；SKILL.md 触发面增反例信号（frontmatter 一句 + 不启用行十类速览）；INSTALL.md 增「子能力单独复用」L0 分级指南；SSoT 新增 §3.6 权威定义。
- 规格见 `docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md`、实施计划见 `docs/superpowers/plans/2026-09-07-trigger-boundary-campaign.md`。
- 版本保持 42.2.1，不 bump。

### 触发边界快追（trigger-boundary-fastfollow，2026-09-07）

- **eval 纳入 pre-push 第 18 项门禁**：路径过滤纳入 `eval/**`（此前 eval/ 变更不触发本地 CI），`EXPECTED.prePushCount` 17→18，编号块/声明文本/CONTRIBUTING 门禁表/README/AGENTS/PR 模板计数全量同步。
- **常驻面速览成员资格钉死**：10 条 `scopeAnchor:"不启用"` contains 断言将十类反例名钉在 SKILL.md「不启用」行——速览删名/改名即 eval 红。
- **selfCheckMatrix 负例扩展**：coverageMatrix 校验①③④⑤各增已知假 fixture（route 失配 / 类别下限 / guide 计数 / 缺守卫），自检从单一 routeTotals 负例扩到五项全覆盖。
- **术语统一**：L1（正向 enable 与歧义 ask）/ L1N（skip 反例）/ L2（机制存在性）口径在 runner 头注释、mappings description、eval/README 三处归一，evidence 明确为字段而非层；eval/README「共 42 条」消歧（category 30 / route 42）。
- 实施计划见 `docs/superpowers/plans/2026-09-07-trigger-boundary-fastfollow.md`（本快追无独立规格文件，计划即需求；最终审查发现来源：主 campaign 宽范围审查）。
- 版本保持 42.2.1，不 bump。

### 代码健康治理（code-health-governance，2026-09-11）

- **新增 `/wm code-health` Phase 1–4 受控治理**：只读发现（P1 静态 inventory + 真实动态 trace + false-positive guard）→ 七维度 gap matrix（P2）→ 受保护测试 inventory（P3，`--guard` 唯一删除路径）→ 重复簇与 abstraction guard（P4）；新增 6 个 CLI（`code-health-phase1` / `code-health-gap` / `code-health-tests` / `code-health-duplicates` / `code-health-ledger` / `code-health-apply`）、纯逻辑与注入边界、9 份 code-health schema、`lib/code-health-tdd-harness.ts` 与 tracked `.code-health-governance.json`。授权链为「人类 approval + HEAD-tracked ledger/evidence/revision 绑定 + 可回滚」；默认拒绝、coverage 仅信号、发现不是结论；`blocked` 走 `gate-failure → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework)` 失败链。**Phase 5–8 迁移**在此时点未实现，不得文档化为可用（campaign 归档随后由 Task 8 实现，见下）。
- **活体文档同步（SSoT-first）**：SSoT 新增 §10K（权威定义）；新增 `references/code-health-governance.md`（第 42 份 references）；SKILL.md 增 `/wm code-health` 路由 / O-A-S-V-G-R-human 权限 / CHECKPOINT / 按需 reference；command-reference / subagent-delegation（dispatch-matrix 登记 6 个新 CLI）/ hard-constraints / rtm-guide / coding-quality / quality-standards / operation-behaviors / data-models / AGENTS / README / CONTRIBUTING / INSTALL / troubleshooting 同步；版本保持 42.2.1，不 bump。
- **计数收口（实测，Task 8 后为最终值）**：cli `.ts` 44、exit-2 脚本 43、references 42、schema 34、self-test 322；docs-consistency 违规 0；pre-push 18 项不变（code-health 不纳入 hook）。
- 本轮无 `.codegraph/` 索引：未接入 codegraph，也未伪造查询记录。

### 代码健康治理 Task 8B（R11 加固 + flake 稳定化 + archive 文档回填，2026-09-11）

- **campaign 归档落地（Task 8A 实现，本任务回填活体文档）**：`code-health-archive.ts` 真实 producer/consumer/verifier；verified 候选（V/G 复审 + G 门禁 + observed passing 命令证据 + 可执行 rollback + clean redaction + revision 匹配）才 `archivedAsPassed=true`，`deferred`/`rejected`/`blocked`/`rolled-back` 只作终态非成功证据；工件经共享 FileVerifier 重验并按真实内容哈希复制，package 原子写入且不覆盖非空 package。`--verify` 不带 `--source-project` 只能 package-only，**不得**表述为 verified source；显式传 `--source-project` 才做 source-bound 重验。活体文档（AGENTS / CHANGELOG / troubleshooting / SSoT §10K / code-health-governance.md / command-reference.md）由「归档未实现」改为上述真实行为。
- **flake 稳定化（R11.7/R8，保留 fail-closed 不变量）**：`code-health-task1-integration.test.ts` 与 `dependency-boundaries.test.ts` 的共享根竞态改为按紧密路径谓词排除兄弟测试瞬态（`.d2-boundary-fixture-<pid>.ts`、`.tmp-code-health-test-output`），**tracked 文件被改动仍由 `git diff --name-only` 断言捕获**（新增双向单测证明）；`evidence-export-logic` / `evidence-provenance-logic` / `l0-link-audit-cli` / `code-health-cli`（30 s→120 s）/ `docs-consistency-logic` 的负载敏感 spawn 超时改为显式 60–120 s，`state-write-logic` 三个 gated-writer 等待用例 5 s→30 s。**未删除/跳过/弱化任何断言**。
- **R11 加固**：Phase 3 apply 增加目录 scope 单元断言与符号链接父目录 canonical containment（修复真实的「根外字节被读入受控 patch」读不对称，现 `SECURITY_BLOCKED`）；`code-health-ledger --help` 可发现用法面；consumer validator 拒绝 `candidateTests.includes(implementationArtifact)`；删除已无消费者的 `logic/code-health-phase-boundaries.ts`；Phase 4 tracked-blob 比较归一化 CRLF/LF（`core.autocrlf` 检出不再误拒）、畸形 `excluded:` 事实 default-deny、`structuralViewSupport` 值侧闭集校验；Phase 1 usage 说明 `changedFiles` 仅覆盖 analyzed targets；`code-health-deletion-authority.ts` 过时措辞修正并增加 `candidateId` 交叉校验。
- **state-write 锁协议真实缺陷修复（非测试 flake）**：`releaseLock` 把 owner 目录改名为 `.releasing-*` 过渡目录、完成交接后才删除；该窗口内 `staleOwnerState` 读不到 owner 元数据即判定 `'stale'`，使合法并发 writer 收到 `STALE_LOCK`（CPU 负载下复现 4/300，修复后 0/300）。修复为：存在 in-flight 过渡目录时视为「尚未判定」并重试；真正的孤儿过渡仍由 TTL 检查回收/暴露，故**真实陈旧锁的 fail-closed `STALE_LOCK` 语义不变**（既有断言全部保留）。
- **文档修正**：quickstart / user-guide 的 self-test 样本数 262→322；coding-quality「合并条件表达式」行转义竖线恢复单行渲染；INSTALL 的 logic `.ts` 计数与 exit-2 口径（42→43）同步。
- 版本保持 42.2.1，不 bump；pre-push 18 项通过（无 `--retry`）。

## 门禁项数 STALE 扫描（gate-count-stale-scan，2026-09-07）

- **docs-consistency 新增 `gate-count-docs` 白名单扫描**：README/AGENTS/CONTRIBUTING/troubleshooting 四份活体文档的门禁项数引用绑定 `EXPECTED.prePushCount`（行含「门禁/检查」标记时全部「N 项」须一致），防门禁项数 N→N+1 后未测试 docs 文件漏改（trigger-boundary-fastfollow 终审 F1 的结构性 follow-up）。
- 源码位置：`docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md` + `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md`；SSoT 门禁项数扫描一句见 §pre-push 边界。
- 版本保持 42.2.1，不 bump。

### 本轮提交身份（最终 SHA 由外部命令核验）

以下为从 42.2.1 整改起点 `bc48824894ae076ff0e80d87cebd6c9de4437833` 至本次最终记录前已存在 HEAD 的完整父提交清单，来源为外部 Git 日志；历史/中间提交不冒充最终 HEAD，本 CHANGELOG 不自引用本次最终记录提交。

| 完整 SHA                                   | 提交身份                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bc48824894ae076ff0e80d87cebd6c9de4437833` | `release(42.2.1): audit remediation fixes`                                                                                                                                           |
| `ea49736869e99d52efe4c66021f235ea621b800f` | `docs(changes): record 42.2.1 audit remediation acceptance`                                                                                                                          |
| `9c1801f9745c3aa95f7be55bd0bb109e173f47a3` | `docs(changes): record final prepush observation`                                                                                                                                    |
| `5bb4dcc7938ec6dde91df503ff722bb013ff15ae` | `test(audit): add strict L0 link boundary coverage`                                                                                                                                  |
| `0da7e05d88e735fb15481ba15cb51ceb336e3148` | `docs(examples): close independent stage rework chains`                                                                                                                              |
| `03f1b249044105f3f28165b4abd60d51943056a3` | `docs(bdd): require complete phase gate arguments`                                                                                                                                   |
| `3c0cbb1644c5b5ea126f7a87498e1414b352e51c` | `docs(workflow): enforce complete rework checkpoints`                                                                                                                                |
| `f3bf1bbb8e4e6c8ae186540f313b0d48727cdb90` | `fix(audit): normalize L0 audit root paths`                                                                                                                                          |
| `664b202936debb5a67e4611f79004c989048a811` | `test(boundaries): register L0 audit filesystem exception`                                                                                                                           |
| `4ea55b44a3f70e56ffae4579c0310fbb166d1317` | `docs(tests): document L0 audit I/O exception`                                                                                                                                       |
| `ef14d03eb5d62a1d47029d35d07fca4305b191f9` | `docs(changes): record review round one remediation`                                                                                                                                 |
| `4d79f04c5d38ba99681e352817b6317790aa6581` | `fix(security): document L0 audit filesystem paths`                                                                                                                                  |
| `7502f6629bd96531d06f6dd430e8372e75f58cc2` | `docs(changes): finalize review round one acceptance`                                                                                                                                |
| `81aed005ae744f25b869e6b16744bd98e7a6560f` | `docs(changes): record review round one final gate`                                                                                                                                  |
| `3fae86e127757027ed40c5e653ca0e0d47083444` | `docs(references): close phase failure routing`                                                                                                                                      |
| `fa30fb982ad080c4ffc11685d9c9411592b20a32` | `fix(audit): fail closed on missing or escaped L0 paths`                                                                                                                             |
| `00f513e6343175fab2db5e3a5360c5b49afc4144` | `test(security): document escaped symlink fixtures`                                                                                                                                  |
| `7319bb716851ceed085c0a13e355df22d8eb6dbb` | `docs(changes): record second review remediation`                                                                                                                                    |
| `b1e364a81a1f877b3fab6e44dea5d46de0279160` | `docs(references): remove direct phase five fix bypass`                                                                                                                              |
| `46a2961937e58a24cc2dc6644dfc39573838c186` | `fix(audit): reject nested L0 directory links`                                                                                                                                       |
| `778ec87fdd2892f1a8c7d68cf5055366c79175f2` | `feat(audit): expose L0 link boundary command`                                                                                                                                       |
| `5ce123a5bd9e2dc2c7d355d7dc31a25a0758cd69` | `test(docs): scan all phase references for fix bypasses`                                                                                                                             |
| `b9958574bbd4be40da2c68da4f5b3beafb9a8ae0` | `fix(audit): reject top-level L0 directory links`                                                                                                                                    |
| `43bd922d0db673c875b9fd72b1e407299742bd76` | `test(docs): include templates in bypass scan`                                                                                                                                       |
| `e3396e5c47226c47e7257c3b0101d4f2a7c0789e` | `docs(changes): record review rounds three and four`                                                                                                                                 |
| `2e3cee897c6ce883468b0d3e53fd1c6453f56c38` | `test(security): avoid unsafe bypass scan regex`                                                                                                                                     |
| `b22191490b9c3d9d56bc47de2d9d33462fc308b5` | `docs(changes): record final audit verification scope`                                                                                                                               |
| `2e78319f8f9a0e25b327aae1509ec1004dcc8a9f` | `docs(changes): register prior audit commit identity`                                                                                                                                |
| `0eee1f48436b1643f14eb449452255e88f4b9418` | `docs(changes): record final audit gate`                                                                                                                                             |
| `cc0a77e9f51771398f309e80754bc15d236b2b1d` | `docs(changes): register final gate commit identity`                                                                                                                                 |
| `0974bc0c6b105d7c486fa30f79f2642a2c9ed7d1` | `docs(changes): register audit history before final gate`                                                                                                                            |
| `15762dde1b62e98d85fb1e5aa2b88ad893446d45` | `docs(changes): record final clean tree gate`                                                                                                                                        |
| `e8f6a5b2c6108b1f31061284551492a79fbc62d1` | `docs(changes): finalize audit acceptance records`                                                                                                                                   |
| `424b91fe57f2ca50dec4f373614c7f0430c2f5b6` | `test(docs): enforce complete ordinary failure routing`                                                                                                                              |
| `1aa684c7226ac1dafdd45b5f05e439e95fb24f1d` | `fix(audit): reject all L0 and L1 symlink boundaries`                                                                                                                                |
| `2a9930a37f91e12dcc3c09d18fb79bb5ab864f34` | `test(audit): close L0 CLI registration contract`                                                                                                                                    |
| `08b80c10916178f8f83d8b5a520dfef290977d9d` | `docs(references): close phase failure fallback paths`                                                                                                                               |
| `88bd58374e17eb737493ae7f75074bd269c48c19` | `fix(audit): report unreadable L1 boundary entries`                                                                                                                                  |
| `46db5fcfd702c3bb8837b0bbfab51ca51105ff4d` | `docs(references): route coding input failures through R`                                                                                                                            |
| `f8ffe0f7b88313af188cdb247586999d447af10f` | `fix(audit): classify L1 directory read failures`                                                                                                                                    |
| `43e60df2fb6582ca8e533f1a7d1fa8781a7475c9` | `test(docs): close ordinary failure routing contract`                                                                                                                                |
| `75d211e8270c16cc8fcb76b4ada70910e6accc4b` | `fix(audit): validate complete link URI encoding`                                                                                                                                    |
| `347f43e796fed39570164b9282e6534afdbd1e1b` | `docs(workflow): enforce complete ordinary failure routing`                                                                                                                          |
| `c6500ed47e36c8d87fc687875af9213ff95bd7ca` | `fix(audit): validate placeholder URI encoding`                                                                                                                                      |
| `d4e0e6788ef362a07edd4be7751893ede0021f07` | `fix(docs): close ordinary failure routing contracts`                                                                                                                                |
| `b030f8087567355147391f4b10203e57d3f5384a` | `fix(audit): close L0 URI and dependency boundaries`                                                                                                                                 |
| `b023dc798916169840d83b2e5411f028d4eb3192` | `fix(test): keep examples contract security-clean`                                                                                                                                   |
| `5f3311f7a889e6a1dc4d3456adb73d0b591a510f` | `fix(deps): patch fast-uri audit vulnerability`                                                                                                                                      |
| `4562e44b71b3544dfcfac4f7d19a966e8e15c810` | `docs(changes): finalize Task 8 acceptance evidence`                                                                                                                                 |
| `60694d336a27c52926eec2d1dc2dcfbd3c6441ae` | `fix(audit): reject Windows drive-letter link paths`                                                                                                                                 |
| `56b7d83d4f3d98497ea00d57902afc4533cbda9c` | `style(references): remove trailing whitespace`                                                                                                                                      |
| `982d051d7804dab1ecc9ef13e7a65cbf37ce04a6` | `test(audit): preserve valid external URI scope`                                                                                                                                     |
| `c74d38ecb4faea1efe20d0b1a47919c16d1c154d` | `test(audit): scan all guidance contracts`                                                                                                                                           |
| `1963406c3ae56ed0e796ffc517f9555fc4b495c2` | `docs(contract): close all ordinary failure routes`                                                                                                                                  |
| `41ebcb6485c7d5aea78745fe853735a6dd18c702` | `test(audit): verify l0 cli error routing`                                                                                                                                           |
| `0e9f1ce3f21f84b73be40017321768a5e5232666` | `test(security): document controlled audit fixtures`                                                                                                                                 |
| `bee1a634d62ac5fce7998cf17ff6c25daa3cc708` | `docs(changes): close task8 audit evidence`                                                                                                                                          |
| `9567415cb861b0fa461540317a8df2b956360827` | `style(test): format workflow contract scanner`                                                                                                                                      |
| `6c6ee22d4e36c93f0a8206449409faee42996f68` | `docs(changes): record final task8 gate`                                                                                                                                             |
| `d997b586afe381c2f8ffcb8edcbcf9d9741fb644` | `docs(changes): finalize task8 evidence`                                                                                                                                             |
| `0b2a62d3be2077b255be3d23204752bb78f1287e` | `docs(changes): record final prepush verification`                                                                                                                                   |
| `a6c805ba51ca7cefc5806f0a779fdbd9b86f4281` | `fix(docs): close ordinary failure routing contract`                                                                                                                                 |
| `751c1e0e172bd49b281e0d5c5919a139440c4e2d` | `test(docs): scan multiline test result tokens`                                                                                                                                      |
| `6ac25be195d3c841360f6ea0ce0c3c7a1399c377` | `test(audit): cover internal non-markdown l0 links`                                                                                                                                  |
| `d1c61732184af15ff563c0d923a316d65caa2397` | `test(docs): harden multiline test command extraction`                                                                                                                               |
| `ebcc2a678362775675972e65a030fa37ccefceec` | `docs(changes): record Task 8 final repair round`                                                                                                                                    |
| `54cdf07e1d178062af02d7146661349231658a10` | `docs(changes): synchronize final parent evidence ledger`                                                                                                                            |
| `7c70e70c0e1f64f22ca6030844ebd7ce524da6ab` | `style(test): align guidance scanner with prepush format`                                                                                                                            |
| `e9062857043ce2e50e2d2ff99b31b0d585b0a397` | `docs(changes): update final verification ledger`                                                                                                                                    |
| `f832febd5f41a831a4e4cce7e9562f1407b31722` | `docs(changes): finalize Task 8 verification evidence`                                                                                                                               |
| `1d148a8a296e159e72f662e2a3b8eaeaa32fa32f` | `docs(changes): record final prepush result`                                                                                                                                         |
| `c24b2442150f65331e98f6ada1862e4d8bfdb968` | `docs(changes): refresh complete final parent ledger`                                                                                                                                |
| `6ddb1978ffc51d790479c25fa9ccb8b9dfb4e81d` | `test(audit): scan whole-row failure routes with chain markers`                                                                                                                      |
| `f63989d12bb7bfe7813b93a6706c3438f82fa69f` | `fix(docs): route BDD/TLA+ gate failures through the complete chain`                                                                                                                 |
| `07832d7b8596ecc93ef49b290ceb4415d2e4dbdf` | `fix(docs): close /wm review C/D and BDD-gate exit-1 routing bypasses`                                                                                                               |
| `7f994e3d1191b671f371e713034ef26b22148b0a` | `fix(docs): route exit-code table rows 363/366 through the full chain`                                                                                                               |
| `44c057a3e342234e9e9faa0cad4744b161659305` | `fix(docs): remove End Patch residue and restore UAT table row`                                                                                                                      |
| `afd99c611b15b5ceb6cb68dac650a7b7fe87cc64` | `docs(changes): record scanner closure round in 42.2.1 changelog`                                                                                                                    |
| `fbfd3363d6961b76dfa8029712e2fc36c5544c73` | `docs(changes): record scanner closure round acceptance`                                                                                                                             |
| `051c688ecb2ddd361ce19bce560664f456355da1` | `style(test): format whole-row failure scanner`                                                                                                                                      |
| `c4e3359176a32e2c623f140c48a352349e8b635c` | `docs(changes): refresh complete final parent ledger`                                                                                                                                |
| `ac91849b7aa27bb605c3fb2f4ac235ac9645129b` | `docs(changelog): expand 2 short SHAs and append c4e3359 to 42.2.1 parent ledger`                                                                                                    |
| `97b91badfc7fe945ab830b5ea4a594d3c25db877` | `docs(changes): expand short SHAs in acceptance records and append ac91849 to 42.2.1 parent ledger`                                                                                  |
| `965095e049bf0688e1b343c5adcdd70407642228` | `docs(changes): annotate verbatim subject citations in parent ledgers`                                                                                                               |
| `689e51bd114831a209af92c99e82afea2e97f512` | `feat(gate): add change-scope and codegraph-query JSON Schemas with inventory sync`                                                                                                  |
| `ac90a78b800e5c163944900d7473136d863136b5` | `feat(gate): bind codegraph/opsx/archive checkers to ChangeScope with strict coverage`                                                                                               |
| `a0f86bbb4c5001f56a3b04143b13834f800b0922` | `refactor(gate): drop dead externalChecks passthrough; aggregate strict codegraph/opsx into artifact gate`                                                                           |
| `5197b21cb97002def958de0f33591ba2f1c73a73` | `fix(gate): suppress misleading no-scope reasons when ChangeScope binding fails`                                                                                                     |
| `ed55ff5b80cc81775c82349648dca81cc17a96bf` | `fix(gate): count R3 by success r3-* dimensions and fail closed on empty role logs`                                                                                                  |
| `ce72badd4373cf99ed236bea816ad3cef90076d6` | `fix(run-log): fail closed on empty and malformed input; block action-role mismatch; align fix variant and preventive schemas`                                                       |
| `36c66581b632571e9bb728edcf3f911776aec280` | `fix(run-log): absorb double-legacy emergency-fix rows via merged legacy predicates`                                                                                                 |
| `6adc3215815cff0d355c13a15a6e00278e393812` | `fix(hooks): consume pre-push stdin refs per-line with fail-closed scope`                                                                                                            |
| `13b942f1c36ae9e92c6d9f8ea22d4854340e117f` | `docs(sot): document ChangeScope gate binding and stage 5-8 aggregation`                                                                                                             |
| `c691023e344864e7262b6776b974fec1f56cc4bc` | `docs(references): sync scope and run-log fail-closed semantics across guidance`                                                                                                     |
| `3da9efa8a2ac4b889af8974029d902743eacc126` | `docs(changes): record gate-closure doc sync in 42.2.1 changelog and acceptance`                                                                                                     |
| `0ee78ea23b21325d186fed0b38be2b554c3d1dfc` | `docs(superpowers): add audit-gate-closure fix plan`                                                                                                                                 |
| `1a032bfab1ae0f224b903024dd3624dfdbfb9733` | `docs(references): state precise R3 dimension counting in summary tables`                                                                                                            |
| `827ebceeb4497a69716a42dd540020b3ae8398c2` | `docs(references): reconcile fix-variant wording and template gate qualifier`                                                                                                        |
| `1a0ed09c460bd42ad1cd964f6b11e35dc1725958` | `fix(gate): report R3 dimension gaps instead of missing R role records`                                                                                                              |
| `25e5bf01a976e234e225bc2bb0397cf5071e2433` | `fix(gate): validate change id in thin scope wrapper`                                                                                                                                |
| `e425642d019d3b2d8d55a4471a867eb81d9661fe` | `refactor(gate): share scope-resolution helper across checkers`                                                                                                                      |
| `f2570709982f458beb2d9bfb4a8e1754d22deb2d` | `docs(schema): align run-log descriptions with enforced pairing`                                                                                                                     |
| `f828b2776a486d674f44d66726d1ab6fa770ed44` | `fix(hooks): skip transient audit network errors and baseline new branches remotely`                                                                                                 |
| `f76dc43fc9571b85964cdefa68bd51df4ccd0e0c` | `docs(references): tighten fix-review wording in violation checks`                                                                                                                   |
| `d17594feb65c9b994a0e637d752355822e1abc84` | `docs(changes): make anchor-grep tally reproducible and date the 647 measurement`                                                                                                    |
| `8a7b503fe6077e36b97d02b24f1a1b3e04130759` | `test(gate): sync direct-call manifest line after change-scope case addition`                                                                                                        |
| `0644a0b740325a2e7eedf9860cfd700ede9b7a99` | `style(test): prettier formatting for hook test additions`                                                                                                                           |
| `f0add116c98b8f4ab109a01aa6f1543312e19bdc` | `fix(hooks): list merge diffs in remote-tracking enumeration with -m`                                                                                                                |
| `6780e109010835df967159ca52796a40f8970730` | `docs(superpowers): add review-fixes design spec (26 findings, 5 slices)`                                                                                                            |
| `a2cab37592f2e622f18eb4a824ea881eb9bd7304` | `docs(superpowers): add review-fixes implementation plan (6 tasks, SDD)`                                                                                                             |
| `de7152224ff2eab6c7be81807b023f05b1692b50` | `fix(scripts): harden change-scope binding (quotePath, shell whitelist, changeId prefix, dot-segment, archive date, phase filenames, external summary)`                              |
| `7076692f9f9aaed021e1a67b8bd155a7658406cf` | `fix(hooks): reject leading-dash remote names in pre-push enumeration (fail-closed)`                                                                                                 |
| `7cd5fcf8e2807db03383c366e010fb931e232afc` | `fix(scripts): parse reference-style links in L0 audit; consolidate pinned baselines; anchor hook failure-source assertion`                                                          |
| `ae73586407c344e1aa2736696414a8808b6f9658` | `docs: require --phase/--scope in gate command examples; document remote-tracking new-branch baseline path`                                                                          |
| `dabbe6bc4f3fd5fa267c7f194121844712c20e57` | `docs: reconcile gate/opsx/run-log/NFR/audit/exit-2-count wording with implementations`                                                                                              |
| `548e43a3553fc1109349e461458a288d0e48e383` | `docs(changes): restore parent-chain continuity (insert 965095e0, append 16 rows through f0add11)`                                                                                   |
| `558075dacc76756ba9909263723950b0f9f70aeb` | `docs(superpowers): add archival-fixes design spec (13 filed items, 3 slices)`                                                                                                       |
| `73b3f600f282bc76bb3a6142f12a844b661aeb86` | `docs(superpowers): add archival-fixes implementation plan (3 tasks, SDD)`                                                                                                           |
| `1c861082066c710847dcd5fac0cd28e8d0f83eaa` | `fix(scripts): close archival items (summary shape, CLI exit-2 coverage, quotePath in docs-consistency, comment precision)`                                                          |
| `09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` | `docs: close archival docs items (GATE_JSON provided, l0 fixture form, AGENTS pretty-format, data-models scope note, run-log punctuation, user-guide audit wording, changelog typo)` |
| `c3636a3b70901f706d15f83bf5daba27ca64fa6a` | `docs(changes): append archival-fixes ledger rows and refresh coverage note (close 13 filed items)`                                                                                  |
| `ccad270ca42706af54ab5911afef6e8c191368b8` | `docs(superpowers): add archival-fixes-2 plan (4 filed minors, single task)`                                                                                                         |
| `34aad9663f5e5cb5c99a8e315e000ad8edc5fbe6` | `fix(scripts): require attemptedChangeId on scope violations; sharpen two comments`                                                                                                  |
| `7b52d4cd2559abac09abc1c3bb7a04619037ad29` | `docs(changes): correct archival index prose to actual ledger coverage`                                                                                                              |
| `11944cd6130b6f3faa1df497fabae3cea6c8385f` | `docs(changes): append archival-fixes-2 ledger rows (close 4 filed minors)`                                                                                                          |
| `e6de501d655406560a91f2f0a69b60f368812fb8` | `docs(changes): backfill review-fixes campaign rows to restore ledger continuity`                                                                                                    |
| `f7f0bba84fce8f780ce7d983785e5caabb4b6ccc` | `docs(changes): chain previous ledger-closing commit c3636a3 (zero-exemption continuity)`                                                                                            |
| `14ccc5f33ee671a67db4d4425a57922ca866ad89` | `docs(superpowers): add review2-fixes design spec (27 findings, 6 tasks)`                                                                                                            |
| `5d7046a0a9737fc3714490cc2703408c63bc9ab9` | `docs(superpowers): add review2-fixes implementation plan (6 tasks, SDD)`                                                                                                            |
| `86162def2f56556bf341a82410cce37bea05dfcd` | `docs: close review2 Importants (template --scope, SSoT L0/L1 boundary anchor)`                                                                                                      |
| `0f9986c25fee563305ca3e4f1b2b7cdba9845708` | `fix(scripts): close l0 parser edge forms and classify .githooks as code`                                                                                                            |
| `63687d42d3b40e937ca95f5f6ab500c8a50cf988` | `fix(scripts): reject duplicate flags, bound legacy variant absorption, unify scope loading`                                                                                         |
| `f79087a6e21c444ebf244e8a0210e30910f6c17f` | `test: close quality minors (dead probe, E5b shape, dedupe scanners, fixed timestamps)`                                                                                              |
| `35f132ee342fbfa5fc359b7768b8d5d430e0757b` | `fix(hooks): quotePath in pre-push git calls and bound audit skip to anchored transient signals`                                                                                     |
| `84fe7cb2be83a4451688575b899f74ab1b4ff382` | `docs: anchor ordinary failure chain and close wording minors (review2-fixes)`                                                                                                       |
| `c38fc88f800281f1e27704f57c718c2b7db8bbb6` | `docs(changes): append review2-fixes ledger rows (close 27 findings)`                                                                                                                |
| `a5e2c2723a42eb4e17c5ddc7d10cf1453b2b8f6f` | `style(scripts): prettier formatting for gate scope files`                                                                                                                           |

注：父链表第二格为提交 subject 逐字引用；subject 内形如短 SHA 的文本（如若干 docs 提交 subject 内嵌的先前提交 SHA）属 commit message 原文，非身份引用，不展开、不补全。

最终记录提交不在 CHANGELOG 的本表中自引用；最终 SHA 与最终 prepush 由外部 `git rev-parse HEAD` / `git status --short --branch` 和 Git Bash 命令核验，`e8f6a5b2c6108b1f31061284551492a79fbc62d1` 保留为历史中间最终记录。

## [42.2.0] - 2026-09-01

### 优化（易用性清债：过期重定向 stub 移除 + SKILL.md 收敛）

- **移除 19 个 42.0.0 wave 合并遗留重定向 stub**（原承诺 42.1.0 移除，因证据支撑树集成顺延至本版）：TLA+ 5 文件 → tla-plus.md、BDD 4 文件 → bdd.md、anti-patterns → hard-constraints.md、dispatch-matrix → subagent-delegation.md、subagent-persona-matrix → agent-personas.md、conventions 三件套 → conventions.md、coding-quality 三件套 → coding-quality.md、definition-of-done → quick-self-check.md。活体引用 13 处先行重链（tools/README ×2、examples ×3、schemas ×8）；references 59 → 40 个 .md，SKILL.md 与 README 资源计数同步。
- **SKILL.md 收敛 106 → 99 非空行**（批次 3 遗留目标 <100 达成）：快速自检节并入工作流尾注、执行工作流 12 步合并为 10 步、触发决策前两行合并、双 CHECKPOINT 引用合并、成熟度指针并入适配节——全部指针与 eval 断言锚点保留，`npm run eval` 25/25。
- 门禁闭合（真实退出码）：eval 25/25、self-test 262/262、docs-consistency、samples-coverage 282 fixtures / unregistered=0、prepush 17 项全绿。

## [42.1.1] - 2026-09-01

### 修复（42.1.0 deferred 项修正收口）

- **run-sync ↔ dependency-boundaries 全量并行竞态**：`collectTypeScriptFiles` 跳过 `.d2-` 瞬态 fixture（dependency-boundaries 并行测试写入的 `scripts/logic/.d2-boundary-fixture-<pid>.ts` 生命周期窗口曾触发 ENOENT），新增回归测试；run-sync × dependency-boundaries 组合 5 连跑全绿（`e20e579` + `0d03b4a`）。
- **security baseline v2 全量对账**：`--regenerate` 消除 49 提交累计卫生债——删除 116 条孤儿条目并修正 line 漂移，411 → 295 条（`7e97baa`）。
- **活体文档/风格微修**：samples/README graph 行 R1-R15、conventions §2.1 evidenceAnchor 复用说明、ingestion-chunk A-chunk L42 代码来源示例、SSoT §10A 4A.1b 表行对齐、subagent-delegation §3.1 触发表补 evidence-anchored-tree 行、graph-logic R15 块 `test()`→`it()` 风格统一（`93f6f3a`）。

## [42.1.0] - 2026-08-31

### 新增（证据支撑树方法论集成）

- **产出期证据锚点（evidenceAnchor）**：图谱节点可选声明结论事实锚点（由 A 子代理 ingestion 时声明、S 规格 §4.2 只读同步、V 评审可核验、G 门禁 R15 格式校验）；复用现有 EVIDENCE_PATTERN 格式，向后兼容存量 graph.json（未声明不阻断）。graph.schema.json / graph-logic.ts / conventions.md / requirement-spec.md 同步。
- **方法论参照文档**：新增 `references/evidence-anchored-tree.md`（证据支撑树 × W 模型映射 + 唯一增量 + 明确拒绝照搬点）。references 58→59。
- **自我纳入机制**：A 子代理 ingestion 指引（ingestion-chunk/cross）注明 evidenceAnchor 可选声明时机；SSoT §4A.1b / §7.7 / §10A 同步；self-test 基线 260→262。
- 设计/SSoT 变更草案与详细设计见 `docs/superpowers/specs/2026-08-31-evidence-anchored-tree-*.md`，实施计划见 `docs/superpowers/plans/2026-08-31-evidence-anchored-tree-integration.md`。

## [42.0.0] - 2026-08-30

### 优化（三维度优化批次 3：易用性大重构 + 终值评估）——版本 42.0.0 发布

三维度优化收官：批次 1（有效性，评估闭环重建）与批次 2（可靠性，红灯清零）后，本批次聚焦**易用性**——技能资产大重构（w-model-dev/），并以同一固定规格重新执行完整 8 阶段 e2e 终值评估对照基线。

**易用性重构（wave-1 + wave-2 合并重链）**

- **去重合并**：TLA+ 指南 5 文件 → `tla-plus.md` 单文件；BDD 指南 4 文件 → `bdd.md` 单文件；anti-patterns 48 条并入 `hard-constraints.md`；角色细则 4 文件 → 2 文件；`conventions.md`（术语表 + 格式 + 目录约定）+ `coding-quality.md` + `quick-self-check.md`（+ DoD）三合一。`references/` 收敛为 58 个 .md，重链 19 文件共 384+ 处交叉引用（跳转 stub 引导旧路径）。
- **SKILL.md 整文件重写**：由约 300 行收敛为 **106 非空行**——「三问」触发决策、14 条硬红线压缩表、编排者-子代理边界表、8 步执行工作流、命令速查、阶段路由表与新「门禁契约与资源清单」节（操作行为指针 / 资源计数 / 状态写锁协议 / 行为门禁 flag / 证据与审计 7 条款）。
- **新增 `references/quickstart.md`**：5 分钟上手（交付层 L0/L1、触发决策、首个任务路径）。
- 门禁契约与评估锚点同步：docs-consistency 13 项契约闭合（单提交内不留隔夜红灯）；`eval/mappings.json` 4 处锚点随文件改名更新（`npm run eval` 保持 25/25）。

**终值评估（Task 3.6，新 SKILL.md 引擎）**

- 同一 todo-rest-demo SPEC（与基线逐字共用）下完整 8 阶段从零重建：**8 阶段 Verifier 全 A**（0.9295 / 0.8770 / 0.886 / 0.894 / 0.8757 / 0.8942 / 0.9028 / 0.9057）；四级测试 **74/74**（UT 35 + IT 17 + ST 11 + UAT 11，coverage 97.56 / 98.00 / 95.45 / 97.67）。
- 易用性收益可量化：**分派 ≈52 vs 基线 ≈74（↓约 30%）**；返工 8 项（1 完整 R 循环 + 7 R3-Required S-fix；基线 R 循环 3）；CHECKPOINT 18（判据代行）。
- **解决基线常驻红灯 D9**：SSoT §10.5.1 阶段 5-8 Cucumber 执行证据 × CON-001 零依赖 × 成熟度 L2 的不可满足，由 S-coding 自建真实 cucumber 报告通道（`.w-model/bdd/generate-bdd-report.ts`，真实 HTTP 往返）消除——阶段 5-8 artifact-gate 全部零常驻红灯。
- 终结偏离登记：阶段 1 R 循环根因为新指南对 TLA↔BDD 同步契约只有「名称完全一致」而无工作示例（基线 D5① 同型未修，本报告登记为 skill-side upstreamDefect，收尾留档）；验收 UAT-002 设计对冻结规格过度收紧（仅空白 title，O 裁定冻结规格权威，D7 谱系）；超限体大客户端 ECONNRESET（R3 security Required 在最终验收门升格，`src/server.ts` 拒绝路径排空 + `Connection: close` 修复，≥1MB 用例防回潮）。
- 评估记录：`eval/w-model-dev-results.tsv` 新增 dry_run（25/25 baseline）与 e2e 终值共 2 行；终值记录 `eval/e2e/2026-08-28-final.md`；`eval/README.md` §4 更新为「评估已恢复（2026-08-28 起）」。

> 本版本累积批次 1（评估闭环：`npm run eval` 25/25 + e2e 基线）与批次 2（可靠性红灯清零：run-sync 清单补登 + 负载敏感探针加固）的变更；完整三维度优化设计与实施计划见 `docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md` 与 `docs/superpowers/plans/2026-08-28-w-model-dev-3dim-optimization.md`。

## [41.19.0] - 2026-08-19

### 修复（D8 run-log lifecycle checker）

- `check-run-log` phase 8 以 `(phase, round, reportId, targetKind, basedOnReport)` 建立 lifecycle segment，严格区分 rootcause V/G 与 implementation V/G，fix 只接受 exact `basedOnReport`，R3/R8 不再跨 report、targetKind 或 phase-wide 首索引误关联。
- 新增 `pending-pre-approval`、`open-approved-lifecycle` 与 `LEGACY_UNSCOPED`/deferred diagnostics；保留真实未完成 implementation lifecycle 的 exit 1，兼容缺身份历史行且不修改 raw JSONL。`--json` 与人类输出均携带 diagnostics，schema/SSoT/运行日志参考同步。
- D8 TDD 新增 8 项 identity、pending/open、R3/R8、legacy diagnostics 与 raw JSONL immutability 回归；focused run-log suite 实测 49/49 通过。

### 修复（R10 persona 契约）

- RootCauseReport R10 采用 canonical-first：接受规范 `testing-reality-checker`，为兼容已有合法归档保留 `reality-checker` legacy fallback；同 artifact 的 canonical+legacy 不虚增 persona 语义，跨 artifact 或异常重复/冲突 fail-closed。同步 rootcause schema、根因定位指南、Verifier 规范、SSoT 与命令参考；本条历史实现说明不把当时的 17 tests / 4 RED 记录表述为已覆盖两个专用 duplicate 分支。保持 R1-R9、退出码 0/1/2 及 `ROOTCAUSE_JSON` / `ERROR_JSON` 合同不变。
- R10 S-fix 补测：新增两个 canonical duplicate 与两个 legacy duplicate 的精确 reason/count 断言，并补充同 artifact canonical 高、legacy 低的优先级用例；当前 root-cause focused 为 20/20，真实全量 Vitest 为 55 files / 942 tests / 942 passed / 0 failed。I1 deterministic metrics probe（显式 projectDir + `--phase=0` + 固定 probe cwd）与 I2 七来源 source×clause mutation 门禁同步完成。
- R10 第二轮 S-fix 澄清：未改写上述历史 17/4、2/2 RED 或 20/20 GREEN 事实；新增语义关系 marker 的 fail-closed contract、Exit2ProbeResult 完整字段/rule 合同、metrics args/cwd identity 规范化及真实七来源 mutation 回归。当前工作区全量 Vitest 实测为 55 files / 954 tests / 954 passed / 0 failed，docs-consistency 的历史 run-log 中间态 exit 1 仍按生命周期事实保留。

### 修复（审计整改批次 B）

- **samples 覆盖门 JSON 退出码对齐**：`check-samples-coverage.ts --json` 复用同一 `exitCode` 输出 JSON 并设置 `process.exitCode`，违规时真实 shell status 与 JSON `exitCode` 均为 1，成功时均为 0；新增真实子进程回归断言。
- **BDD 项目行为证据显式门**：`check-bdd-model.ts` 新增 phase 1-4 的 `--require-tla-equivalence` 与 phase 5-8 的 `--require-cucumber-report`；所需工件缺失均作为 D4/D5 violation / exit 1，错误 phase 组合为 exit 2，未带 flag 保持 fixture 兼容跳过。第 1/5 轮审查修复将 CLI 收紧为参数 allowlist：`=true`、重复、近似拼写和未知 `--*` 统一 `ARG_INVALID` / exit 2，不得静默降级。required Cucumber 报告还必须是 `{ elements: [...] }` 且至少有非空 name scenario 的 `passed` step；failed 仅作诊断，skipped/pending/undefined/未知 status 与匿名 element 不构成执行证据且作为 D5 / exit 1 拒绝。SKILL/指南/命令参考与 pre-push 注释明确区分：pre-push 只直接运行技能包 BDD fixture 回归，TLA、TLA↔BDD 同步和真实项目工件由项目阶段门按成熟度执行。
- **同步子进程边界**：`runSync` 为 B4 受控调用提供 15 秒进程级 timeout、固定 `SIGKILL`、固定 UTF-8 编码和 64 MiB 输出缓冲；非有限/非正 timeout 或 maxBuffer 均回退默认值。artifact gate 的 TLA+/BDD 校验及 gate-report、metrics-report、wm-status 测试调用均迁移至 helper。全目录同步调用已通过 TypeScript AST 与集中清单审计：解析 `node:child_process` 的直接、别名、namespace、解构和静态属性绑定；每处调用均声明理由及现有 timeout 或后续整改状态，动态计算属性访问将阻断审计，未在 B4 范围内的无 timeout 调用不再被默默放过。

### 文档对齐（审计整改批次 C）

- **C3 第 2/5 轮 hooksPath 可执行恢复流程**：README、INSTALL、CONTRIBUTING 分别提供 Bash/PowerShell 的 `git config --local --get` 备份、退出码 1 的原先未设值分支、`git config --local --unset` 撤销和基于 `.git/hooksPath.previous` 的回写；备份文件只保存在本地 `.git/`、不提交，并提示权限与空值注意。文档测试提取统一契约 helper，使用旧 TL;DR、`.agent` 卸载、缺 Bash 边界和缺失 hooksPath 流程的真实文本 fixture 断言失败，同时要求当前文档通过。
- **C3 入口契约加固**：README TL;DR 改为两个独立锚点选择，不再混合 Skill 复制与仓库验证命令；README、INSTALL、CONTRIBUTING 补充 `core.hooksPath` 旧值保存、`git config --unset core.hooksPath` 撤销和按需回写命令；INSTALL 卸载命令统一使用 Agent-specific placeholder，并要求替换安装时目标后再执行破坏性删除；文档测试增加按路径的局部负例和标题顺序、TL;DR、恢复命令、卸载、Bash 边界语义断言。
- **仓库验证与 Skill 安装入口拆分**：README 首屏新增「验证仓库」与「安装 Skill」两个独立入口。仓库验证固定为 canonical GitHub URL、仓库根目录、Node.js ≥20、Git、npm registry/网络、`npm install` → `npm run self-test` → `npm run doctor`；PowerShell 5.1 使用逐行命令，`self-test` / `doctor` 不要求 Git Bash。Skill 安装改为复制 `w-model-dev/` 到 Agent-specific skills 目录，不将 `.agent` 作为通用路径，也不伪造无法验证的 Agent canonical URL。
- **平台与 Hook 边界披露**：文档明确 `postinstall` 运行 `scripts/setup-hooks.cjs` 并设置本地 `core.hooksPath=.githooks`，该副作用不是 Skill 激活必需；Bash 仅用于 `pre-push` 与平台依赖检查；`platform-deps:check` 只检查、`platform-deps:install` 当前 fail-closed 并指引人工 `npm install`；Windows/WSL 不混用同一 checkout 的 `node_modules`。
- **采用与贡献导航**：adoption Day 0 先验证仓库再安装 Skill；INSTALL、AGENTS、CONTRIBUTING 分别引用两个入口，并保留真实测试计数，不新增样本或改变实现逻辑。文档入口的语义由按路径契约测试逐项守护。
- **可执行 Persona Verifier 样例**：将四个 Persona 的失效内嵌 JSON 迁为 `samples/verifier/persona-*.json` 可执行 fixture；每个 fixture 使用当前 Schema 的 meta、子标准、方差与可追溯 evidence，并由 CLI、self-test、samples 覆盖门和 Vitest 逐项验证。`agent-personas.md` 保留字段约束、fixture 链接与校验命令，明确真实评审须基于目标证据重建输出，不能复制固定评分或证据。self-test 基线 256→260，Vitest 实测 52 files / 849→853 tests。
- **SSoT 外部 Agent 边界**：重画 §3.1 架构图，明确技能包仅交付 Markdown 资产、Schema 与确定性 gate scripts；宿主 Agent / 外部 LLM 负责推理、子代理调度和 LLM-as-Verifier；TLA+ TLC、CodeGraph、OpenSpec 为可选外部工具，不属于技能包交付物。同步三项 CLI JSDoc：默认和 `--json` 均先尝试写 gate log，写入失败以 `gateLogWriteError` 报告且不改变主 gate 结果，并由静态测试守护。

### 新增（审计整改批次 D）

- **D7A 可追溯证据包**：`wm-export-evidence` 默认要求 `.w-model/evidence-provenance.json` 证明已通过的运行，并将 run ID、40 位 commit SHA、artifact ID、三类源证据计数/哈希和导出文件清单 content hash 写入严格 manifest。`--verify` 除了路径、Schema 与文件哈希外，重新执行脱敏规范化，拒绝手工同步哈希后重新引入的绝对路径或敏感值。敏感字段识别扩展为 `authorization`、`credential`、`access_token`、`private_key`，忽略大小写及连字符/下划线差异，并覆盖 JSON、JSONL 与 Markdown；真实 CLI 回归覆盖 provenance 缺失/未验证拒绝、合格导出/验证及未脱敏包拒绝。
- **D1 Schema loader 文档路径对齐**：将 `data-models.md`、`docs/INSTALL.md` 与 `docs/user-guide.md` 的 Schema loader 引用统一指向 `w-model-dev/scripts/infrastructure/schema-loader.ts`，并新增文档回归断言防止迁移后的旧 `scripts/logic/` 路径回归；不改变生产逻辑、Schema、hook、package、baseline 或计划/spec。
- **D7C source-bound evidence verification 文档与动态计数**：本条目对应单提交 `d659e82^..d659e82`；仓库外受控 coverage/provenance artifact 绑定测量 HEAD `d659e8239f47c90499066f87ba64731a114cca1a`，相对 artifact ID `vitest/results.json`、SHA-256 `9b4cd0412e95dfc1ec74a19746ebc9c6b4de7955bac224ac9476fe4be0b03af6`、run ID `8f909dd7117df0ac`，实测 23 schemas / 36 CLI scripts / 35 exit-2 scripts / 55 test files / 910 tests / 910 passed / 0 failed / success=true；self-test 为 260/260，samples coverage 为 280 fixtures、242 个文件引用、15 个目录引用、0 未登记。登记 `evidence-provenance.schema.json`、`wm-verify-evidence-source.ts` 与 source-bound/package-only 边界，明确受控本机 provenance 不是密码学签名或第三方不可抵赖证明；D7C 文档与动态门测试保留旧计数负例。**该条目是 historical evidence：measurement commit=d659e8239f47c90499066f87ba64731a114cca1a，不是后续 reviewed/final HEAD 的验收证据。**
- **D8 C1/M1 final-head evidence boundary**：保留 D7C 的历史数值与 artifact/hash/runId 事实，不将其升级为当前验收；最终验证报告必须同时记录 `reviewedHead`、`measurementCommit`、artifact ID/SHA-256、runId 和 provenance，并仅在 `measurementCommit == reviewedHead` 时标记 final-head verification passed。若两者不同，状态只能是 `historical evidence — not final HEAD verification`。
- **D8 I2 natural-exit contract**：D2 约束收窄为 `logic/` 与 `lib/` 不直接退出、gate-report callers 设置 `process.exitCode` 后自然返回；`self-test`、`security-scan`、`wm-status`、`metrics-report`、`ensure-codegraph-opsx` 等 process-level runners 保留直接退出并登记理由，不作无关重构；新增 gate-report caller 或 direct exit 时须同步契约测试与命令参考。
- **D6 同步 D5A 后真实 Vitest 计数**：以当前 HEAD 受控 coverage/provenance artifact 实测的 54 test files / 895 tests / 895 passed / 0 failed / success=true 为唯一来源，同步活体文档、pre-push 第 12 项描述性计数与 docs-consistency fixture；不改变生产逻辑、门禁控制流或 evidence export。
- **D3 可验证运行时审计证据导出**：新增 `wm:export-evidence`，仅导出 `.w-model` 白名单目录与 run-log 的常规文本记录；JSON/JSONL 递归脱敏 `token`、`secret`、`password`、`apiKey` 字段，使用临时目录+原子 rename 发布严格 Schema 的 SHA-256 manifest。`--verify` 会重新执行 manifest Schema、路径安全、文件存在性与哈希校验；输出目录冲突、符号链接/路径逃逸、二进制或未知扩展均 fail-closed，CLI 保持真实 exit 0/1/2 与 `EVIDENCE_EXPORT_JSON` 摘要。
- **D4 动态元数据与本地证据治理**：docs-consistency 保持顶层 `violations` 兼容字段，并按 `staticViolations` / `dynamicViolations` 分组，输出真实 `dynamicMeasurements`。以 coverage JSON 的 `testResults.length` / `numTotalTests` 为事实源同步活体计数；登记 `evidence-manifest` Schema 与 `wm-export-evidence` CLI；README、Agent、安装、贡献、Skill 和命令参考明确 `coverage/` / `.zcode/` / `.w-model/` 是 Git 忽略的本地生成物，审计交付须显式导出脱敏 SHA-256 manifest 包，且与受控 `docs/changes/archive/` 区分。
- **D7B source-bound provenance**：新增 `evidence-provenance` Schema 与 `wm-verify-evidence-source` producer+verify CLI。命令校验真实 Git HEAD、run-log、passed gate-log、signature-chain、source file 清单与 source bundle SHA-256 后原子写入 `.w-model/evidence-provenance.json`；`wm-export-evidence --verify` 无 `--source-project` 明确返回 `package-only`，传入 source project 才返回 `source-bound` 并重验当前源。同步注册表、命令参考、数据模型、测试 fixture 与 55 files / 905 tests 的成功 artifact 计数。

### 修复（审计整改批次 A）

- **状态写并发协议**：`wm-write` 改为 `<target>.lock` 持久目录与可转移 owner 的跨进程锁；锁内执行 mtime、毫秒+UUID 备份、tmp+rename、回读与原子恢复。CLI 增加 `--lock-timeout` 与显式 `--recover-stale-lock`；默认对陈旧锁 fail-closed（`STALE_LOCK` / exit 1），同时保留直接 `writeStateJson` 调用的兼容性隐式恢复。显式恢复仅授权 TTL 已过且 owner/operator PID 已退出的锁或 transition，不能夺取活跃 writer；逻辑层 barrier 与真实 CLI 回归测试覆盖该排他性边界。
- **状态 Schema 写时校验**：`wm-write` 在锁临界区内通过唯一注册表验证 project/rtm/budget/maturity JSON 与 run-log JSONL；未注册 `.w-model` 目标默认以 `UNREGISTERED_TARGET` 拒绝，`--allow-untyped` 只允许该类目标且在 JSON 摘要标识 `untyped:true`，从不绕过注册目标的 `SCHEMA_INVALID` 拒绝。真实子进程回归覆盖两种 exit 1 协议、JSONL 安全行号与无备份/tmp 残留。
- **显式平台修复**：pre-push 不再自动 `npm install`，缺少 `node_modules` 即 exit 1；仅调用 `ensure-platform-deps.sh --check`，默认/`--check` 不下载、不执行 `npm pack`、不解包也不覆盖 `node_modules`。`npm run platform-deps:check` 与 `npm run platform-deps:install` 是显式入口，后者目前 fail-closed 并指引人工 `npm install`。
- **文档契约**：SSoT、skill、状态/命令参考、README、安装/贡献/Agent 指南和 docs-consistency 断言同步上述状态锁与平台依赖边界。
- **Vitest 真实计数同步**：以覆盖率启用的 Vitest JSON `testResults.length` / `numTotalTests` 实测为唯一来源，将活体文档与 pre-push 第 12 项描述性注释统一为 **52 test files / 849 tests**；docs-consistency CLI fixture 保留并断言这两个 JSON 字段，仍通过 `WM_VITEST_COUNT_FILE` 注入真实 CLI。
- **Vitest 计数证据 fail-closed**：无 `WM_VITEST_COUNT_FILE` 时强制采集；Vitest 启动、JSON 或文本解析失败均产生 `vitest-tests` 违规并 exit 1，保留 A8 JSON 注入快路径。SSoT 纳入内链扫描，并修复 CHANGELOG 与 decision-log 三处相对链接。
- **Schema 活体库存同步**：将实际 21 份 Schema 的声明同步至 SSoT、SKILL、anti-patterns 与 user-guide；docs-consistency 对这些权威声明逐一校验实测 Schema 数，缺失或漂移产生 `schema-list` 违规。
- **Prettier 格式阻断修复**：按仓库 `config/prettier.config.cjs` 格式化 `w-model-dev/scripts/logic/docs-consistency-logic.ts`，消除 pre-push 第 16 项格式检查阻断；仅调整尾随逗号与换行，不改变运行时逻辑。

### 修复（核查报告 2026-08-19 六项问题）

- **P1-1 文档数字漂移**：CONTRIBUTING 门禁表 vitest 计数 40/623 → 47/723（与同文件 :214 自相矛盾修复）；docs/INSTALL.md :83/:248 同类漂移一并修正（复核补充）；PR 模板「14 项」→「17 项」；docs-consistency 新增 `vitestExtraDocs` / `prTemplate` 可选输入（checkVitestTestCount 参数化 + checkPrTemplatePrePushCount），堵住 REQUIRED_PATHS 未覆盖 CONTRIBUTING/INSTALL/PR 模板的盲区；CONTRIBUTING 版本机制「五处」→「六处」同步
- **P1-2 typecheck 门禁**：package.json 新增 `typecheck` script；pre-push 第 17 项 `npx tsc -p config/tsconfig.json`（对齐 SSoT §10H.5 V1）——README 健康指标「tsc 0 错误」由手动验证升级为自动化门禁
- **P1-3 IDE 产物出库**：`.trae-html-share-packages/` 移出版本控制并加入 .gitignore（会话生成物，非仓库资产）
- **P1-4 依赖可复现**：package-lock.json 入库（.gitignore 移除忽略行），不同环境 install 结果与 npm audit 行为可复现
- **P2-1 纯 Windows 警告升级**：pre-push 无 bash 环境时黄色 ⚠ 升级为红色 ✗ + 「本次推送未执行 17 项门禁」明示 + 补跑指引（保留 exit 0 刻意妥协）
- **P2-2 PR 模板强化**：校验要点改可勾选清单 + 新增「门禁输出」节要求附 prepush 末尾摘要（远程 runner 仍受限，不加 GitHub Actions）

### 修订（发布后延后项处理）

- version-bump / version-consistency 纳入 package-lock.json 根 version（版本六处 → 七处；防 lock 漂移脏 diff 复发）
- version-bump 顺带刷新 skill-metadata.json updatedAt
- README 健康指标日期更新为 2026-08-19 实测
- docs-consistency CLI 消除 docs/INSTALL.md 重复读取
- pre-push 第 17 项注释括号平衡（纯注释）
- 计划文档残留 grep 验证排除表补 **tests**/logic/cli 源

## [41.18.0] - 2026-08-18

### 修复（审计 2026-08-16 十六项问题）

- **反模式 #48 新增**（子代理越界实施）：修正 SKILL.md 五处 #22 误引（#22 实为目标系统 RBAC 角色越权）；补 #18/#19 详细节；maxAntiPattern 47→48
- **run-log action 枚举同步**：data-models.md interface 15→27 值（补 emergency-fix/r3-_/codegraph_query/opsx__/ensure_deps/iceberg-*），docs-consistency 新增 interface↔enum 语义比对
- **TLA+ 门禁超时**：SANY 60s / TLC 300s（EXEC_LIMITS 集中），TLC 挂死不再阻塞 CHECKPOINT；Java 版本解析单源化（lib/java-version.ts），预检不再硬编码 11
- **wm-write 原子写**：tmpPath 追加 randomUUID（同进程并发安全）；回读失败自动回滚备份（rolledBack 字段）
- **错误出口统一**：HandledCliError + runMain，消除 readJsonOrExit process.exit 截断 ERROR_JSON 风险与 readJsonClassified 双打印
- **分层修复**：plan-chunks 拆分 logic（纯）/cli（入口）；schema-loader 去 process.exit、IO 下沉 lib/schema-fs.ts；bdd-logic 去 as any
- **样板抽取**：lib/parse-args.ts、lib/run-main.ts、lib/gate-log-writer.ts；budget/maturity 复用 readJsonlOptional；artifact-gate 瘦身
- **schema 自描述**：design-contract 补 $id；6 份 schema 补顶层 description
- **persona 统一**：product-manager 删 tools 字段；5 份 hex color 统一命名色
- **文档一致性**：subagent-delegation 六角色矛盾修正；verifier-spec §6/§8 引用修正；command-reference 补 A/R 与 CHECKPOINT 统一清单；INSTALL 目录树 exit-2 脚本计数 31→33 修正；glossary 增反模式/exit-2 口径条目；三个超大引用文件增 §0 分节导引；ensure-codegraph-opsx 吞错加 stderr 日志；gate-logic 首次获得专属单测

## [41.17.0] - 2026-08-15

### Added

- `wm-write` 状态写助手：`.bak` 备份 + mtime 乐观锁 + 原子替换 + 回读校验，状态文件统一经此写入（防手写漂移）
- `doctor` 环境自检：node/tsx/ajv/java/tla2tools/codegraph/openspec 逐项检查 + 修复指引（`--with-tla` 升级 TLA+ 项为阻断级）
- `check-artifact-gate --validate-templates` 模板漂移校验：按 PHASE_SPEC_LAYOUT 校验 templates/ 资产结构标记
- 图谱轮次上限校验（MAX_GRAPH_ROUNDS=5）：防收敛循环无限返工
- 编排质量指标（metrics-report orchestration 区）：R3 套数/findings 分布 + 冰山扫掠轮次分布 + reworkHints 统计
- 评估提示词 15→25 条（w-model-dev-test-prompts.json）
- `templates/README.md` 阶段 × 主模板 × 子模板映射索引

### Changed

- run-log R8 轨迹校验扩展：同阶段内 S 动作 < R3 < V < G < checkpoint 相对顺序约束
- 错误消息补「期望 + 修法」尾注（design-contract-logic / tla-logic 层次校验）
- safe-json BOM 剥离：Windows 下 BOM 导致的 JSON 解析问题修复
- check-docs-consistency 新增文档内链存在性门禁（C3）

### Docs

- 六份重型参考（anti-patterns/verifier-spec/tla-plus-guide/bdd-guide/agent-personas/data-models）分层速查摘要
- anti-patterns 阶段 N 必读反模式索引
- dispatch-matrix S 变体 × R3/V/G 触发矩阵消歧 + 按阶段分节加载导引 + 53 文件触发条件表补全
- subagent-delegation 加载导引（已存在，确认）
- toolbox.md 去孤岛（SKILL.md + dispatch-matrix 指针）

## [41.16.0] - 2026-08-14

### Changed

- 版本号 41.15.0 → 41.16.0（**首次由新脚本 `npm run version:bump` 一处改版、六文件同步**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例 / CHANGELOG.md 节头；`version-consistency` 检查扩展为六处比对）
- **P0-1 消除 vitest 双跑**：pre-push 第 12 项 vitest 落盘 JSON（`--reporter=json --outputFile`），第 14 项 `check-docs-consistency` 经 `WM_VITEST_COUNT_FILE` 复用用例数，不再二次全量 vitest；脚本未变更时跳过重采（软放行）。每次 push vitest 由两次 → 一次，纯文档 push 零次。
- **P0-2 SSoT 章节号归一 + ssot-headings 元门禁**：`3.3.x` → `3.3.1`；`16. 参考文献` → `13. 参考文献`（16.1~~16.3 → 13.1~~13.3，内部 §16.2 引用同步）；新增 `checkSsotHeadings`（顶层章节号 1..N 连续 + 字面 x 占位标题检测），堵住「章节删节未重排」盲点。
- **P1-4 导航表收敛**：`dispatch-matrix.md` §6.4 补全为 31/31 权威登记表（新增/改名门禁脚本只登记一处）；AGENTS.md §2 巨型脚本枚举（~5000 字符）压缩为指针（见 §8 + dispatch-matrix §6），消除唯一整表重复；新增 `script-registry` 检查（全部 cli 脚本名须登记于 dispatch-matrix + SKILL「N 个 .ts」计数一致）。
- **P1-5 eval 状态如实化**：`eval/README.md` 标注「评估暂停中」（v36.0.0~v41.16.0 未外部盲评）+ 待评估版本表 + 恢复评估指引，不再假装闭环在跑。
- **P1-6 硬编码税最小化**：`REQUIRED_PATHS` 补「新增活体文档契约」注释（26 项）+ exit-2 工具数具名常量；`CONTRIBUTING.md` 数字一致性条删陈旧 `EXPECTED.currentVersion` 引用、改指 version:bump。
- 测试增长：vitest 623 → **634 条**（新增 ssot-headings / script-registry / version-consistency CHANGELOG 用例）；同步 README/AGENTS/pre-push 计数表述。
- `check-docs-consistency.ts` REQUIRED_PATHS 增 `dispatch-matrix.md` 与 `CHANGELOG.md`。

## [41.15.0] - 2026-08-14

### Changed

- 版本号 41.14.0 → 41.15.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **README/AGENTS/INSTALL/SSoT 文档同步批次（目录结构等）**：
  - README 项目结构树补 docs/ 缺项（user-guide / troubleshooting / index.html + _sidebar.md / changes/decision-log/；docs/api 注明为 gitignored 生成物）+ 根级 config/、scripts/setup-hooks.cjs、.eslintsecurity-baseline.json；.githooks 行补「16 项」
  - SSoT 追溯表补 7.6A 行（self-as-verifier demo-only 例外：独立产物路径 + Persona 切换 + 反模式 #35 守护）
  - AGENTS §1 补 self-as-verifier 例外指针（SSoT §7.6A）；§2 docs/ 行补排障/用户指南与 docs/api 生成物说明
  - INSTALL 目录树补 skill-metadata.json 行
  - docs/api 本地产物重生成（`npm run docs:build`；docs/api 为 gitignored 生成物，不入库）

## [41.14.0] - 2026-08-14

### Changed

- 版本号 41.13.0 → 41.14.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **self-as-verifier 措辞加固（设计观察 #5）**：
  - SKILL.md self-as-verifier 节新增「偏置缓解」要点：V 评审须切换与 S 产出视角不同的 Persona 提示词 + VerifierOutput `summary` 注明所用 Persona；明确「不消除自我偏置，仅限 demo/教学」
  - verifier-spec §13 补 demo-only 边界复述（原仅 SKILL.md 一处）+ 第 4 条「评审视角独立（偏置缓解）」
  - command-reference `/wm review` 节补 `--self-as-verifier --s-output=<S产出路径>` 参数文档（此前命令参考无该 flag 说明）
  - check-verifier-output.ts 头注释「本脚本自评模式」→ 准确的路径独立性校验措辞（与实现语义一致）
  - **SSoT 补 §7.6A self-as-verifier 模式（demo-only 例外）**——修复 decision-log 声称「SSoT 已新增该节」但正文缺失的文档-实现缺口
- **复杂度收敛引导（设计观察 #6）**：SKILL.md 触发决策节新增「任务规模适配（轻量路径）」小节（极小任务 → L0 交付层 + self-as-verifier + maturity L0/L1；生产小项目 → L2；常规生产 → L3；红线：轻量 = 门禁降载而非跳过阶段）+ SSoT §11A.6 权威段落

## [41.13.0] - 2026-08-14

### Changed

- 版本号 41.12.0 → 41.13.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **format 幂等性修复 + 防复发门禁**：
  - 根因：prettier 版本无漂移（3.9.6 三处一致）；「npm run format 重排 100+ 文件」实为默认 endOfLine=lf 与 Windows CRLF 工作树的行尾归一化 churn，真实格式漂移仅 7 个文件（artifact-gate-assets / phase-doc-map / read-json-or-exit / uat-path-mapping / verifier-logic 五个测试 + check-bdd-model / check-samples-coverage 两个 CLI）
  - `config/prettier.config.cjs` 增加 `endOfLine: 'auto'`（Windows CRLF / WSL LF 双兼容，不改变检出行为）
  - 全量 `npm run format` 统一格式化 7 文件 + `security-scan --regenerate` 重生成 baseline v2（282 → 280 条目）
  - **pre-push 新增第 16 项「prettier --check」格式一致性门禁**：任何 .ts/.cjs 编辑未跑 format 即被阻断，从根上堵住格式漂移复发
  - **15→16 计数级联**：EXPECTED.prePushCount、docs-consistency 测试 fixture、README / AGENTS / CONTRIBUTING（门禁表 +16 行）/ troubleshooting / pre-push 注释全部同步

## [41.12.0] - 2026-08-14

### Changed

- 版本号 41.11.0 → 41.12.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档一致性门禁动态化（消除「文件系统 ↔ EXPECTED 常量 ↔ 文档」三方同步）**：
  - `checkVersionConsistency`：package.json 为版本唯一源，其余四处声明与之比对；删除 `EXPECTED.currentVersion`（版本提升不再需第 6 处代码同步）
  - `checkReferencesCount`：期望值改从 SKILL.md「（N 个 .md）」表述解析，与实测比对
  - `checkAssetCounts`：期望值改从 README「N 个人格文件」表述解析，与实测比对
  - `checkVitestFileCount`：期望值改从 README「N files」/ AGENTS「N 个 .test.ts」表述解析（实测须命中声明集）
  - `checkExit2ScriptCount`：期望值改从 AGENTS「N 个脚本」表述解析，与实测比对
  - 删除死代码 `EXPECTED.schemaCount`（schema 检查早已用动态 `schemaFiles`）
  - docs-consistency 测试：baseInput 补 persona token + package.json 漂移用例语义改写（源漂移 → 其余四处报违规）+ 4 个「文档方向」新用例（51 条）
- **README:116 退出码标注漂移**：check-code-tla-consistency.ts「退出码 0/1」→「0/1/2」（全仓唯一漂移点；docs-consistency 只查计数不查退出码标注的盲区）
- ****tests**/README pure/IO 边界与实现对齐**：gate-logic.ts 标注为唯一例外（nodeFsAdapter 依赖注入做 spec 目录 IO）；检测命令补 `from 'node:path'` 并排除 gate-logic.ts；coverage 矩阵「vitest 35」→「vitest 40」
- **计数级联**：vitest 619 → **623 条**（+4 个 docs-consistency「文档方向」新用例）；README/AGENTS/CONTRIBUTING/INSTALL/troubleshooting/pre-push 计数全部同步（动态门禁自动校验捕获，无需再同步 EXPECTED）

## [41.11.0] - 2026-08-13

### Changed

- 版本号 41.10.0 → 41.11.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **遗留五项收尾**（41.10.0「明确不做」清单）：
  - **technical-writer 占位符规范化**：4 个围栏交付物模板各加「占位符说明」注记；5 处坏 URL 占位（`[工具 X](链接)`、`(链接)` 等）改为合法示例 URL（example.com / docs.npmjs.com）；标准占位（your-package、RFC 2606 示例域、[目标成果] 等）保留
  - **--json 声明张力统一（26 个 check-\*.ts 实测，非 8 个）**：--json 参数说明改为「stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）」；实现不动（ERROR_JSON 前缀为权威约定）
  - **批量任务编号注释自解释化（96 处）**：`B4 --json`×50 去前缀；B5/B6/B8/B3 → 直接描述；`A2b 双轨过渡`×19 → 「结构化违规双轨」；Task A1/批次3 Task7/Task 5/Task 3 → 直接描述；借鉴点 2/3/4 ×12 → 直接描述（Schema 前置校验/内容敏感指纹 diff/版本号双写一致性）；规则 ID 与 spec 文件指针保留
  - **readJsonOptional 死导出删除**（零生产调用）：lib 函数 + 3 条测试移除；**tests**/README 矩阵行补登记 readJsonlOptional / readJsonClassified / loadAndValidate
  - **lib 层 4 模块专属测试**（constants / phase-doc-map / uat-path-mapping / artifact-gate-assets 各 1 个测试文件，41 条用例；runModelChecks 用 vi.mock('node:child_process') mock spawnSync，CLI 集成侧由 pre-push 第 3/7/8 项覆盖）
- **计数级联**：vitest 36 → **40 文件** / 581 → **619 条**（-3 死导出测试 + 41 新 lib 测试）；EXPECTED.vitestFileCount、docs-consistency 测试 fixture、README/AGENTS/INSTALL/CONTRIBUTING/troubleshooting/pre-push 计数全部同步；**tests**/README 矩阵 +4 行

## [41.10.0] - 2026-08-13

### Changed

- 版本号 41.9.0 → 41.10.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓校核修复批次**（4 路并行审计 8 高 / 23 中 / ~14 低，按「以实现为事实源」原则修复）：
  - **高**：dispatch-matrix 补 check-iceberg-sweep（§6.2 通用脚本表 + §7 #44 守护行 + §4 ICEBERG-A/B 说明）；`lib/read-json-or-exit.ts` 4 处 exit 路径统一经 `exitWithError` 输出 ERROR_JSON（14 个 CLI 头注释契约补全；read-json-or-exit.test.ts 同步断言；check-preventive-review/check-iceberg-sweep 绕行注释更新）；CONTRIBUTING 六处陈旧计数（571→576×3、252→254×3）；SSoT §10A 追溯表死节名指针 +「10 个 →12 个 /wm 命令」；user-guide/pre-push/dispatch-matrix 的 E1-E8→E1-E9 ×3；examples/stage1 C1~C9→C1-C10；operational-recovery 锚点死链改无锚点链接
  - **中**：SSoT 死指针/误指清零（verifier-spec §7.6→§1、§10E→§10.8 ×2、「17 条→47 条」演进叙事 ×2、§932/§2219 历史叙事注改现状陈述、「候选反模式检测信号」→「C1（候选）」节 + anti-patterns TOC 对齐）；tla-plus-modeling-design 4 处 `--skip-tlc` 对齐「已移除」；skill-design-document §14/§15 结构描述；troubleshooting 558→576；loop-engineering-design 计数快照（17→47 ×7、37→254）+ SSKILL 笔误；README 树移除 3 个已移出吸收文档 + L1~L4 残留 + 补 /wm hill-climbing；INSTALL lib 9→12 + exit-2 构成口径；references 9 处（SKILL.md 节名 ×2、S 变体 8→10、workflow 拆出节名 + 阶段 3/4 产物 ID 前缀 INTF/DD、real-run-evidence 41.5.0→41.9.0、subagent-delegation 锚点、9→10 脚本自检 ×2、dispatch-matrix #21 守护去「run-log R5」）；**signature-chain-logic 入口补 validateBySchema**（反模式 #28 对齐；schema sigId 模式补 P2-/序号变体；self-test/vitest 期望同步）；**新增 maturity-logic.test.ts**（R1-R5 + schema 前置，vitest 35→36 文件 / 576→581 条级联同步）；check-requirement-graph 头注释补 --rtm/--exemptions；bdd-logic exitCode:2 语义注释、check-preventive-review 头注释对齐实现、check-iceberg-sweep CLI「R3」改名
  - **仓库卫生**：git rm `samples/tla-e2e/states/` 4 个 TLC 残留 + .gitignore 补规则；samples/README 矩阵 3 行条数修正（GATE 20 / TLA 15 / BDD 11，合计 253）
  - **低**：AGENTS §2 补 2 个漏列脚本；dispatch-matrix §3 补 check-tla-bdd-sync（阶段 1-4 S-tla 行）/ check-design-contract-consistency（阶段 8）+ §5 ensure-codegraph-opsx 说明；归档目录补第 5 个（README 树 + AGENTS 表）；「§4 约束 N/SSoT 约束 N」前缀 → 硬约束 #N（SSoT ×4 + adoption-guide ×8）；persona 文件 `project-management-experiment-tracker.md` → `project-experiment-tracker.md`（对齐矩阵短名）；SKILL.md templates 行补 budget.template.json / run-log.template.jsonl 全名；脚本注释类 8 处（Round 24 残留、人类可读报告声明 ×2、violations→reasons ×3、bdd [D2] 标签 ×2、run-log-logic「不 import」旧文案、check-run-log 头注释补 R8 + usage 补 --json、parse-phase 13 口径）
  - **明确不做**（观察清单）：technical-writer 围栏内占位符（示例样板合理）；B4/A2b 等批量任务编号注释（内部批次标识可追溯）；--json 模式 exit 2 单行张力（8 脚本一致固有）；readJsonOptional 公开 API；lib 层 4 模块无专属测试

### Docs

- SSoT §4A.2b/#7.6/#12.4 演进叙事改写为当前事实陈述；troubleshooting/CONTRIBUTING/design-docs 计数与事实对齐

## [41.9.0] - 2026-08-13

### Changed

- 版本号 41.8.0 → 41.9.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档层 + 脚本层去历史化全量清扫**（历史只由 CHANGELOG 体系承载；41.7.0 已清 references/templates，本轮扩展至 scripts/** 与全部根文档）：
  - **脚本层**（logic 18 / lib 12 / cli 12 / **tests** 18，共 60 文件）：删除注释、usage 帮助文本、运行时展示文本、describe/it 名称中的「（第 N 轮）」「[x.y.z]」「第 N 轮新增/升级/移入」标注与演进叙事（如「第 N 轮调测发现 X」）；schema 3 份 description 字段同步（enum/required/type 等约束字段零改动，run-log action enum 27 值零改动）；规则 ID（R1-R10 / D1-D8 / C1-C10 / E1-E9 / P2.5 / R13 等）与「已废弃」「无条件强制」「no-op 向后兼容」等现状声明保留
  - **文档层**（SKILL / references 37 / templates 5 / examples / subagent / docs 6 / README / AGENTS / CONTRIBUTING / pre-push 共 54 文件）：删除残留轮次标注与「第 N 轮由 SKILL.md 移入」句；41.8.0 批次遗留的历史归档指针（「已归档至 legacy-sections.md」等）统一删除，导航由 CHANGELOG/decision-log README 承担；演进叙事（「与原计划的差异」等）改写为当前事实陈述；pre-push「与原 CI 一致」→「全部门禁共 15 项检查」
  - **收尾修正**：checkpoint-logic 运行时消息、docs-consistency 违规消息、docs-consistency 测试 fixture 中的版本/轮次残留清零；verifier-spec rootcause 枚举行「新增」→「—（无旧值映射）」；README 门禁增强历史导航句去轮次
  - **保留项（B 类设计事实/导航）**：规则 ID、反模式 #N、约束 #N、SSoT §X 指针、文件指针、hard-constraints「原约束 #XX 并入」注记、「已废弃/已移除」现状声明、ISO 时间戳、docs/changes/archive 目录名中的 roundN（归档目录名不可改）、examples/real-run-evidence 快照版本元数据
- **门禁必需字符串复核**：anti-patterns `| 47 |` / `#1~#47`、hard-constraints `## #1`~`## #14`、operation-behaviors 八条表、DoD 七维度标题、data-models Schema 清单 20 份、glossary action 枚举、SKILL「（53 个 .md）」、SSoT 4A.1 权威标题、README/AGENTS/pre-push vitest 计数等全部原样保留

## [41.8.0] - 2026-08-13

### Changed

- 版本号 41.7.0 → 41.8.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档-实现一致性全量修正批次**（三路 Explore 扫描 + 逐条核验，以脚本实现为事实源）：
  - **规则编号漂移修正**：run-log 文档 R1-R7 → R1-R8（R8 轨迹模板校验早已实现）；BDD 文档 D1-D7 → D1-D8（D8 SD Coverage；workflow/templates×4 同步）；豁免文档 E1-E8 → E1-E9（E9 时间戳时序；SKILL/hard-constraints/phase-1/operational-recovery/anti-patterns/user-guide/exemption-logic 头注释同步）
  - **iceberg 规则重编号 R1-R8 → R1-R5**：原 R5-R8（轮次边界/去重/可证伪/passed 一致性）重排为 R2-R5，消除 R2-R4 编号空缺；logic 注释 / schema 描述 / self-test 用例描述 / iceberg-logic.test.ts / SKILL/AGENTS/anti-patterns/samples 矩阵同步
  - **S-ingest R3 门禁变体补全**：check-preventive-review.ts 新增 `--variant=ingest`（路径前缀 `<phase>-ingest-{dim}.json`）；hard-constraints/subagent-delegation S 变体清单 8 种 → 10 种（补 S-ingest-tla / S-ingest-bdd）；dispatch-matrix §6.1 同步；preventive-review-logic.test.ts 补 ingest 用例
  - **rootcause targetKind 补全（消解三方矛盾）**：verifier-logic SUB_CRITERIA + verifier-output.schema.json enum 增第 5 种 `rootcause`（§7.5 子标准：correctness 0.25 / completeness 0.25 / falsifiability 0.20 / actionability 0.15 / prevention 0.15）；verifier-spec §2.2/§2.3 重写；anti-patterns #19 检测信号与 dispatch-matrix §4 得以成立；新增 valid/bad rootcause 样本 + verifier-logic.test.ts 4 用例
  - **死锚修正**：anti-patterns.md TOC 三个不存在节（L1~~L4/F1~~F10/O1~O6）改引真实位置（operation-behaviors.md / SSoT §4A.2a / decision-log/legacy-sections.md）；SSoT:599/604/634/640/1969 同步；operation-behaviors:21/36、definition-of-done:59、user-guide:76 同步；#43 两处死锚改指「敏感信息禁令（第三十一轮）」节
  - **SSoT 计数与 typo 修正**：「28 条流程反模式（#1-#19+…）」→「47 条（#1~#47）」×3；「守护反模式 #3/#8」→「#18/#19」×5
  - **闭环脚本 4 → 5 全线统一**：SKILL.md:214 / quick-self-check / workflow / operational-recovery:443 补 check-preventive-review（约束 #11 无条件）
  - **verifier-spec 修正**：variance 重算阈值 §3.2/§11.3 `1e-4` → `1e-6`（对齐 §3.2.1 规则 2 与 VARIANCE_EPSILON；compositeScore 的 1e-4 独立不受影响）；TOC 补 §13；§6 注释「≥3 项」→「==5 项」；§8.0 占位符枚举补 rootcause / 子节号 1-5
  - **过时机制清理**：subagent-persona-matrix §7 移除已废弃 emergencyFixReview 事后复核机制（改由前置 R3×3 + V 兜底）；:93 parallelPersonas 死引用删除
  - **dispatch-matrix 补齐**：阶段 1 补 check-requirement-coverage、阶段 1-4 补 check-tla-bdd-sync、阶段 8 补 check-design-contract-consistency；§3 阶段 4 S-doc 加载 design-patterns-catalog；O 通用加载补 estimation-guide / context-management-guide
  - **模板计数修正**：quality-standards / phase-8「12 个模板」→「13 个」；SKILL.md Bundled Resources 补 schemas/、tools/ 行 + system-test / bdd-manifest.template.json；「6 独立子模板」→「每阶段 6 独立子模板（跨阶段共 10 种）」（SKILL/AGENTS/README）
  - **交付层清单修正**：L1 增加 `tools/`（tla2tools.jar，TLA+ 门禁运行时依赖）——SKILL.md:19 + INSTALL.md §2 交付层表与目录树同步
  - **孤儿 references 补入口**：estimation-guide → phase-1「执行方法论」；context-management-guide → operational-recovery 自检清单；design-patterns-catalog → phase-4「类设计规则引用」
  - **DoD 格式修复**：definition-of-done.md 七维度表补第 7 行（签名链完整性）+ 空粗体「****」修复为「代签判定」
  - **陈旧注释修正**：docs-consistency-logic 注释「57」→「53」×2 + EXPECTED.currentVersion 41.8.0；check-docs-consistency「合计 30」→「31」；run-log-logic「R1-R7」→「R1-R8」；self-test.ts 头部样本目录清单补全为 26 组
  - **samples/vitest 基线增长**：self-test 252 → 254（verifier rootcause 样本 ×2）；vitest 用例 +5（iceberg 重编号无增、preventive ingest +1、verifier rootcause +4）
  - **测试矩阵补齐**：**tests**/README.md 补缺 2 行（docs-consistency-logic / iceberg-logic）+ run-log R8 / preventive ingest / verifier rootcause 描述同步
  - **杂项**：AGENTS.md §8 导航表补 wm-status/metrics-report/security-scan 3 行、移除 gate-enhancement.test.ts 行、`--r3-enabled` 语义修正（无条件 R≥3，flag 为 no-op）；删除 w-model-dev/docs/superpowers 空目录残壳
- **决策记录**：文档与实现矛盾一律「以脚本实现为事实源」回写文档（防漂移门禁已强制计数，本轮补齐编号语义）；L1~L4 教训按 41.7.0 归档决策继续指向 legacy-sections.md，不恢复正文

### Docs

- SSoT §4A 反模式计数与实现位置同步；verifier-spec §2.2/§2.3 rootcause 枚举补全

## [41.7.0] - 2026-08-13

### Changed

- 版本号 41.6.0 → 41.7.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓 md 文档去历史化（架构决策：文档只承载设计事实，历史统一由 CHANGELOG 体系承载）**：
  - **SSoT 纯净化**：删除 §3.4.7-47 全部轮次记录区（~890 行）、§10A 追溯表 37 行轮次行、§10B 参考实现调测史、§14/§15 tombstone；§3.4.1-6 当前定义区与主题章节去轮次标注（~30 处）；历史缺陷引言（§10E/10I/10J/10.10 等 7 处）删除保留规则句；新增「设计决策历史」索引节（指向 decision-log 与 CHANGELOG）；§1.4 参考实现注改指针
  - **新建 decision-log 归档**：`docs/changes/decision-log/`（README 轮次→版本映射 + rounds-09-39 + rounds-40-47 轮次记录原文 + absorptions 4 份吸收决策记录 + legacy-sections 历史段落），原文保留不篡改
  - **根文档去历史化**：AGENTS.md §7 修复记录整节删除（内容已由 CHANGELOG 体系承载）；README/AGENTS/INSTALL/adoption-guide 参考实现节去轮次/指标/修复记录（保留归档导航链接）；SKILL.md 8 处轮次标注去标注
  - **references/templates 批量去标注**：329 处「（第 N 轮）」「[x.y.z] 新增」等 C 类标注清除（规则本体保留，B 类导航指针保留）；A 类叙述（「第 N 轮调测发现 X」等 ~20 处）删除；anti-patterns「实现层经验教训」节与 hard-constraints「编号迁移表」归档；references 中 27 处「SSoT §3.4.7+」轮次指针清理（指向已删节，改指当前定义或删除）
  - **4 份吸收决策文档归档**：four-source / mythical-man-month / external-skills / clean-code-refactoring-agentic absorption 从 references/ 移入 decision-log/absorptions.md（references 57→53，referencesCount 门禁联动）
  - **数据漂移修复**：CONTRIBUTING（249→252 ×3、14→15 项 + 补第 15 行编号表、去「与原 CI 一致」）；user-guide（249→252）；troubleshooting（14→15 ×2）
- **决策逆转记录**：SSoT 按轮次记录设计的旧模式（曾于 41.6.0 以「不篡改演进史」原则保留轮次区）→ 全仓去历史化新模式（CHANGELOG 体系唯一历史承载，SSoT/README/AGENTS/references 只含设计事实）；轮次记录原文无损归档于 decision-log

### Docs

- SSoT 新增「设计决策历史」索引节；CHANGELOG 顶部补 decision-log 指针

## [41.6.0] - 2026-08-13

### Changed

- 版本号 41.5.0 → 41.6.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **SSoT 权威性审查修复**（三路 Explore 全面一致性扫描，41.4.0/41.5.0 两轮变更后核验）：
  - **修 SSoT 内部互斥**：§3.4.3 阶段门 / §3.4.6 P1.2 的 TLA+ 强制门槛（「无例外」绝对式）与 §3.4.44 P1-3 成熟度开关（L1 可选 / L2 / L3）对齐——当前章节补分级说明，P1.2 标题改「按成熟度分级（约束 #13）」
  - **修活体指针**：AGENTS.md 错误结构指针由 §3.4.30 补为「§3.4.30（全量归一化）+ §3.4.42（CliError rule/field，当前定义）」
  - **修 §10A 追溯表**：补缺 §3.4.42 行（CHANGELOG [41.2.0] 声称有而实际缺失）+ 修复 §3.4.36/37/38 三行残缺（2 列 → 完整 4 列，自轮次记录提取补全）
  - **修标题层级**：§3.4.40-46 标题 `###` → `####`（与 §3.4.7-39 轮次记录层级统一，消除 h3/h4 混排）
  - **双副本权威声明**：SSoT §4A.1（八条操作行为）/ §10.6（DoD 七维度）表头标注「权威源 = operation-behaviors.md / definition-of-done.md，本表为摘要副本」；§7 数据模型标注「结构权威 = data-models.md」
  - **历史决策逆转指针**：§3.4.44 关键决策④（C7 重申）追加「已于 41.5.0 §3.4.46 O1 逆转」标注，防误读为现行决策
  - **samples/README.md 基线同步**：头部「249 条回归基线」→「252 条」（41.5.0 轮遗漏，SSoT §3.4.46 已记录 249→252）
- **审查结论**：SSoT 核心职能仍成立（数字全部一致 / 当前状态声明零漂移 / 零死链），无需重写；本轮为止血修复，恢复「当前章节 = 最新决策」的权威一致性

### Docs

- SSoT 新增 §3.4.47 第 47 轮记录 + 追溯表行

## [41.5.0] - 2026-08-13

### Added

- **samples 覆盖矩阵门禁（T1）**：新增 `check-samples-coverage.ts`——自动核对 `samples/` 每个 fixture（文件/嵌套目录）被 `self-test.ts` 用例数组（file / sampleDir / manifestFile / featureFiles 字段）引用，且每个子目录在 `samples/README.md` 覆盖矩阵声明；堵住「新增 fixture 遗忘登记」（未登记 fixture 不参与任何检查，self-test 仍全绿）。新建成 `samples/README.md` 覆盖矩阵（26 子目录 × check 脚本 × 用例数组）；pre-push 第 14 项后新增第 15 项（prePushCount 14→15，docs-consistency EXPECTED 与 README/AGENTS 同步）
- **真实命令证据示例（T2）**：新建 `examples/real-run-evidence.md`——5 个真实门禁命令的 exit 0/1/2 三态输出实录（check-verifier-output / check-requirement-graph / check-samples-coverage）；4 份对话类示例（coding / requirement-analysis / system-design / test-execution）头部标注「伪示例，仅供 LLM 行为对齐」，虚构数字（95% 覆盖率 / 18-18 / 50-50）改为「以真实运行器为准」；coding.md 删除 `echo > .env` 反模式示例（改为环境变量注入两方式）；test-execution.md 质量门语义修正

### Changed

- 版本号 41.4.0 → 41.5.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **孤儿样本登记（check-samples-coverage 首跑发现）**：`samples/` 5 个全仓零引用 fixture——登记 3 个有效样本进 self-test.ts（gate/bad-phase5-codemodule-format → GATE_CASES phase5 codeModule 格式校验；tla/bad-coverage-uncovered-sd → TLA_CASES SD 覆盖完整性；bdd/bad-d8-uncovered-sd → BDD_CASES D8 SD 覆盖）；删除 2 个「名字与实际行为不符」伪样本（gate/valid-phase5-with-uat-path-mapping、gate/bad-phase5-missing-uat-path-mapping）；self-test 基线 249 → 252 条（README / AGENTS / INSTALL / pre-push 同步）；exit-2 脚本计数 30 → 31（新增 check-samples-coverage，AGENTS / SKILL.md / INSTALL / docs-consistency EXPECTED 同步）
- **Markdown 去重（A2 收敛版）**：AGENTS.md §6「编排者最小化」与 §1 同文件双份 → 精简为一句 + 指针；INSTALL.md 安装步骤引导段与 §1/FAQ 重复的角色描述 → 指针化；SKILL.md 内联 14 行硬约束摘要表**保留**（编排入口速查价值，评估结论记录于 SSoT §3.4.46）
- **CHANGELOG 批次拆分（A5）**：41.2.0 的 P0/P1/P2 工程化批次（27 项 Changed + 3 修复 + 文档同步，均不涉及版本语义）移入新建 `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md`；[41.2.0] 条目精简为版本语义 + 批次指针；清理 `docs/changes/` 空目录残留
- **移除 npm workspaces（O1）**：删除根 package.json `workspaces` 字段 + `w-model-dev/package.json`（C7 决策逆转——子包零依赖、全仓零包名引用、createRequire/tsconfig/vitest/pre-push 均不依赖 workspace，空包无实际作用）；INSTALL.md FAQ 改为单根包表述；SSoT §3.4.46 记录决策逆转理由

### Docs

- SSoT 新增 §3.4.46 第 46 轮记录 + 追溯表行

## [41.4.0] - 2026-08-13

### Changed

- 版本号 41.3.1 → 41.4.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **cli/ 分层修正（评审 N1）**：`cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`（check-artifact-gate 拆出的 IO 解析模块）移入 `lib/`；`check-artifact-gate.ts` import/re-export 同步；exit-2 脚本计数 30 不变，`check-docs-consistency` 与 `docs-consistency-logic` 注释修正（5 工具 = 4 工具 CLI + `logic/plan-chunks.ts`，self-test.ts 非 exit-2 不计入）；SKILL.md Bundled Resources `scripts/cli/` 表述改为「30 个 .ts：25 个 check-* 门禁 + 5 个工具 CLI」
- **references 计数修正 + 门禁（评审 D1）**：SKILL.md「references/（53 个 .md）」→「（57 个 .md）」（第 44 轮新建 4 篇未同步）；`check-docs-consistency` 新增 **references-count 检查项**（`EXPECTED.referencesCount=57` + 实测 .md 数 + SKILL.md 表述三重比对，镜像 personaCount 模式）
- **TLA 轨迹清理工具跨层修正（评审 N2）**：`cleanTraceFiles` / `isTlcStatesDir` 自 `cli/check-tla-model.ts` 移入新建 `lib/tla-clean-trace.ts`（IO 辅助归 lib/，logic/ 保持纯函数约定）；`tla-clean-trace.test.ts` import 同步
- `dispatch-matrix.md` 数据来源行移除过时版本号 35.0.0（评审 D2），改为「随版本演进，以当前 SKILL.md 为准」
- AGENTS.md 角色表述澄清（评审 A4）：六类角色 = O（编排者）+ 五类子代理（A/S/V/G/R；R 含 R-iceberg 变体）
- AGENTS.md `docs/` 行声明 `docs/superpowers/` 为内部规划目录（评审 O3），不参与门禁、非面向用户
- 新建 `w-model-dev/tools/README.md`（评审 A6）：tla2tools.jar 版本（TLC2 2.19 of 08 August 2024）/ 来源 / license / 同步策略，权威记录指向 `references/tla-plus-guide.md`

### Docs

- SSoT 新增 §3.4.45 第 45 轮记录 + 追溯表行

## [41.3.1] - 2026-08-13

### Changed

- 版本号 41.3.0 → 41.3.1（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例；41.3.0 发布时 README 未同步导致漂移，本轮补齐并加门禁防再漂）
- `check-docs-consistency` 新增 **version-consistency 检查项**：`EXPECTED.currentVersion` + 五处版本声明全量比对（package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例），任一漂移或不可解析即 exit 1；`REQUIRED_PATHS` 增补 package.json / skill-metadata.json / docs/INSTALL.md；CONTRIBUTING「数字一致性」表述由「三处」更新为「五处」
- `skill-metadata.test.ts` 新增第 5 个用例：README / INSTALL.md 版本与 package.json 一致（五处镜像断言）
- 模板占位符统一：7 份阶段模板 SSOT 头「文档版本」由 `v{{1.0}}`（字面+部分占位）统一为 `{{v1.0}}`（全段占位，与元数据区 9 处既有风格一致）；`format-conventions.md` 新增 §7「模板占位符语法」规范（全段占位约定 + 固定占位符表 + 检查）
- docsify 离线降级：`docs/index.html` 新增 `<noscript>` 提示 + CDN `onerror` 兜底文案（离线/断网白屏时给出解释与本地预览指引）
- **SKILL.md 减负 524 → 216 行**：硬约束完整版 → 新建 `references/hard-constraints.md`；八条操作行为 + F1-F10 → 新建 `references/operation-behaviors.md`；自检清单 → 新建 `references/quick-self-check.md`；顶部 5 段方法论 → 新建 `references/design-philosophy.md`；Bundled Resources 四表压缩为目录级索引；阶段门/质量门说明压缩。`check-docs-consistency` 联动：`checkOperatingBehaviors` 改指针模式（防内联回退），新增 `checkHardConstraints`（## #1-## #14 编号连续性 + SKILL.md 指针）
- **硬约束 21 → 14 条重排**（第 44 轮）：#9 TLA+ 与 #14 BDD 合并为「#13 行为门禁按成熟度分级」；#20 codegraph 与 #21 回归合并为「#14 代码改动前后门禁」；#15/#16/#17/#18/#19 分别并入 #10/#2/#11/#3/#8。全仓活体文件 326+ 处「约束 #N」/「约束 N」引用同步重编号（归档 docs/superpowers、docs/changes、eval 历史记录不动）；`hard-constraints.md` 附「编号迁移表」
- **TLA+/BDD 成熟度开关**（约束 #13 可执行化）：L1 教学/demo 可选 / L2 生产小项目 TLA+ L1 + BDD L1 必跑 / L3 全必跑；编排层开关（非脚本参数，`--skip-tlc` 禁令维持）；`operational-recovery.md` 新增「成熟度与行为门禁」节
- **L0/L1 双交付层**：SKILL.md 顶部「交付层」说明 + INSTALL.md §2「交付层选择」表（L0 纯 Markdown 零依赖拷贝即用 / L1 带门禁需 `npm install`）
- `w-model-dev/test-prompts.json` 删除（14 条孤儿文件，无任何文档/脚本引用；评估场景以 `eval/w-model-dev-test-prompts.json` 15 条为准）
- `CHANGELOG.md` 拆分：41.0.0 之前（含 40.x 及更早）历史条目移入新建 `CHANGELOG-archive.md`（2169 行 → 80 行）
- anti-patterns.md 新增「反模式-硬约束映射」表（14 条硬约束 × 47 条反模式双向定位 + 高频标注）
- vitest 计数 558 → 571（新增 13 条单测），README / AGENTS.md / INSTALL.md / CONTRIBUTING.md / pre-push 同步

### Docs

- SSoT 新增 §3.4.44 第 44 轮记录 + 追溯表行

## [41.3.0] - 2026-08-13

### Changed

- 移除 `.cursor/skills/` 技能包资产残留引用（目录已在 e74b886 中删除，12097 行）：`check-docs-consistency` 门禁解耦——`REQUIRED_PATHS` 移除 `.cursor/skills`（此前缺失直接 exit 2 阻断每次推送）、`EXPECTED` 移除 `cursorSkillCount=23`、`checkAssetCounts` 单参数化（仅 persona）、目录计数删除；`.githooks/pre-push` 变更过滤移除 `.cursor/skills/**` 分支与触发条件注释；AGENTS.md 导航表 / README.md 结构树与 pre-push 注释清理；references 5 处死链修复（phase-5-coding 删除空「相关资源」节、phase-4-detailed-design / anti-patterns / subagent-delegation×2 去链接保留文字、verifier-spec 重定向到技能包内 agent-personas.md）
- 版本号 41.2.0 → 41.3.0（三处一致：package.json / skill-metadata.json / SKILL.md frontmatter；INSTALL.md 示例同步）
- `.gitignore` 追加 `.cursor/`（与 `.claude/` 同款，防误跟踪）

### Docs

- SSoT 新增 §3.4.43 第 43 轮记录 + 追溯表行

## [41.2.0] - 2026-08-10

### Added

- 四源吸收 P2（10 项）：subagent-persona-matrix 证据加权共识、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing 爬山法哲学基础、tla-plus 不连续系统穷举「为什么」、operational-recovery 集成混沌预期 + 超标重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准、SKILL.md 受控的失控 + clockware/swarmware 选择法则

### Changed

- 版本号 41.1.0 → 41.2.0
- P0/P1/P2 工程化批次（2026-08-11 ~ 2026-08-12，不涉及版本语义）已拆分归档至 [`docs/changes/engineering-batches/2026-08-11-p0-p2-batches/`](./docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md)（scripts 四层重组 / check-artifact-gate 拆分 / violations 双轨结构化 / --json 可观测性 / config 集中 / vitest 覆盖率入 pre-push / npm Workspace 等 27 项 + 3 项修复 + 文档同步）

### Fixed

- （批次内修复见 engineering-batches 归档：A6 历史归档恢复 / 54 处旧脚本路径修正 / security baseline 重生成）

### Docs

- SSoT 新增 §3.4.42 第 42 轮 P0-P2 批次记录 + 追溯表行（批次详情见 engineering-batches 归档）

## [41.1.0] - 2026-08-10

### Added

- 四源吸收 P1（10 项）：design-patterns-catalog.md（GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture/Security 评审问题、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness、security-review 认证授权传输维度、phase-6 补偿/故障注入测试

### Changed

- code-smells-checklist 补子类爆炸/继承破坏封装/Getter-Setter 浅方法
- 版本号 41.0.0 → 41.1.0

## [41.0.0] - 2026-08-10

### Added

- 四源吸收 P0（11 项）：code-smells-checklist 组 X 复杂度症状 + 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）、quality-standards 类设计规则补充（深度优先/多类症/组合拆分四信号/通用专用分离）+ 设计投资节、format-conventions 接口注释必备清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 信息隐藏/下沉复杂性/异常策略三选项、verifier-spec 三信息来源 + 复杂三症状 + 设计三项检查、class-design 模板「方案权衡」必填列
- 候选反模式登记：四源-α 复杂性增量累积 / 四源-β 模式装饰性引用 / 四源-γ 过度 swarm 化 / 四源-δ 纸面理由替代真实门禁（候选区，不正式编号）
- 新 reference：four-source-absorption.md（吸收决策记录，挂 Bundled Resources）

### Changed

- 版本号 40.2.0 → 41.0.0
