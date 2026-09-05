# 核查修复战役设计（audit-fixes，2026-09-06）

> 输入：`verify-campaign-2026-09-05` 独立核查战役（8 域 × 4 子代理 = 32 份报告）+ 4 份独立复核裁定（`review/VERDICT-SUMMARY.md`）。
> 结论基础：**0 Critical / 6 Important / 49 Moderate + 64 说明级 + 1 已裁定不改**（去重前实列 12I+65M；权威去重目录 = 姊妹文件 `2026-09-06-audit-fixes-findings-catalog.md`，随本规格同 commit 入库，含逐条去重映射）。
> 用户决策记录：①修复范围 = 全部纳入单战役（2026-09-06 AskUserQuestion）；②I-1 命名 = 「完整普通失败链」全量归一为规范短名（同日）；③设计批准（同日）。

## 1. 目标与不可变约束

修复上述全部 I/M 级发现，说明级逐条处置（fix / defer / 已裁定不改）。不可变约束：

- 版本保持 **42.2.1**，不运行 version bump；不推送远端；`.superpowers/` 报告不提交。
- 主工作树 tracked 文件只读；全部实施在隔离 worktree（`task/audit-fixes`）由子代理完成。
- 普通 V/G 失败必须走完整 R 链（V/G → R → V 复审 → G(check-rootcause-report) → S-fix → R3×3 → G → V → G → CHECKPOINT）；不得放宽 gate、不得伪造测试结果。
- 阶段 5-8 的任何代码/测试编辑前先做 codegraph 查询并落盘（本仓库无 codegraph index 时，按约束 #14 以「查询不可用」记录并停在依赖检查点，不伪造查询）。
- 台账 parent-chain 40 字符零豁免延续（见 §6）。
- 完成条件：定向负例 + 全量回归 + `npm run prepush` 17 项全绿 + 独立终审（BASE..tip 全提交，0 Critical / 0 Important 且 Minor 有处置）+ 用户明确同意后本地 ff-merge；**不 push**。

## 2. 发现处置原则

- **6 条 I 级**（全部经复核 CONFIRMED）内联如下，逐条修复：

| # | 位置 | 主张 | 任务 |
|---|---|---|---|
| I-1 | `examples-contract.test.ts:192/:519` + 语料 40 处 | 扫描器把非规范名「完整普通失败链」当合规判据；`_Avoid_` 缺主犯；`hard-constraints.md:85` 标题含禁用词 | T1 |
| I-2 | `logic/coverage-logic.ts:152` | crossCuts 空矩阵 + metrics=100 + 无 `--graph` → exit 0 放行 | T2 |
| I-3 | 8 个 CLI 入口 | 重复 flag 静默取第一/最后一值，「全 CLI 生效」声明不成立 | T3 |
| I-4 | `lib/parse-phase.ts:4-16` vs 4 个脚本 | `--phase N` 空格形态声称 13 脚本统一支持，实际仅 6 个；budget/signature-chain/tla-model/metrics-report 静默忽略 | T3 |
| I-5 | `check-state-machine-consistency.ts:66-68` + `state-machine-logic.ts:43-46` | 顶层非对象输入静默 exit 0，缺 STRUCTURE_INVALID 门 | T3 |
| I-6 | `run-log.schema.json:292-298` + `run-log-logic.ts` | review 行 `passed=false` 时 reworkHints 约束零强制，实测 exit 0 + CLOSED | T4 |

- **M 级**：权威清单 = 姊妹目录主表 **49 条**（F-G1-02…F-G8-07，含严重度有分歧标注 2 条），按 §4 D1-D8 域集群修复；任务完成后在目录「处置」列回填 fix / defer / wontfix / 已裁定不改。说明级 64 条（S1-S64）逐条处置：随域顺带修复或登记 defer，不允许无处置。
- **已裁定不改（2 项）**：change-scope 绝对路径/`..` 越界返回 exit 2（`STRUCTURE_INVALID`）——按退出码约定正确，仅修正 MANIFEST 口径表述；budget/maturity 无 `--project` 时条件规则不激活——语义保留，仅补非阻断可见性提示。
- **说明级**：随所属 D 项顺带修复或在目录中登记 defer，不允许无处置。

## 3. 方案取舍（已批准）

| 决策点 | 采用 | 否决方案与理由 |
|---|---|---|
| CLI 参数统一 | 全部 8 入口改走 `parseFlagValue`/`DuplicateFlagError`；`parse-phase` 统一「重复即错」并原生支持空格形态 | 各入口自加检测——留下 8 处散乱实现，A4 声明继续失真 |
| role-dispatch 坏行口径 | 并入 blocking violations → exit 1（文案与 run-log `PARSE_INCOMPLETE...blocking` 对齐） | 文档化 exit 2 例外——两 checker 锁步校验同一文件，口径必须一致 |
| project.json 读取校验 | 三处读取统一 `loadAndValidate('project')`，schema 失败 exit 2（STRUCTURE_INVALID） | 仅 warn——受控状态文件，警告保留旁路 |
| requirement-coverage 缺省 `--graph` | 空 crossCuts + 无 graph → blocking（C7b）；非空 + 无 graph → 非阻断 diagnostic + `skippedRules:['C7']` 标记 | 强制 `--graph`——破坏既有无 graph 调用方 |

## 4. 设计决策

### D1 术语收口（I-1 + G1 全部 M）— T1

- **字面量定死（两式）**：正文式 `普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）`；表格式 `普通 V/G 失败链（hard-constraints）`。替换规则：叙述句用正文式，表格单元格用表格式；同句已有锚点引用的（如 `phase-5-coding.md:193`）只删冗长名不重复挂锚。
- **替换范围（机械执行，共 47 处/16 文件全类型口径）**：references 35 处/10 文件（workflow 11、hard-constraints 5、bdd 5、quality-standards 5、phase-6 2、phase-8 2、data-models 2、phase-2 1、phase-3 1、subagent-delegation 1）、`templates/review-report.md` 1、examples 4（stage6:71、stage7:72/:77、test-execution:99——箭头链全句保留豁免，描述词归一）。变体一并清理：裸「普通失败链」2 处（`phase-5-coding.md:193`、`templates/acceptance-test.md:72`）、「普通失败返工链」2 处（`acceptance-test.md:76`、`templates/coding.md:91`）、「普通失败完整链」1 处（`hard-constraints.md:342`）、「完整返工链」1 处（`examples/test-execution.md:23`）、「普通返工链」1 处（`data-models.md:528`）；`verifier-spec.md:102` 逗号第三式「（普通 V/G 失败链，hard-constraints）」并入表格式（F-G1-05/F-G1-06）。
- **权威定义收口**：`conventions.md:124` 定义句去除「标准返工链」措辞；`:125` `_Avoid_` 增补「完整普通失败链/普通失败链/普通失败返工链/普通失败完整链/完整返工链」；`hard-constraints.md:85` 标题改 `## 普通 V/G 失败链`（删括注），`:91` 短名引用形态句保持两式不变。
- **扫描器收紧**：`examples-contract.test.ts:189-194` `hasChainMarker` 删除「完整普通失败链」分支；`:516-522` skip 子句同步（逐条核对 `下方完整链` 等子句在替换后语料上是否仍需保留）；`:146-147` 注释改为「canonical marker = 规范短名或完整箭头链」；fixtures `:574/:584/:602` 期望字符串同步为替换后语料；新增负例——「只含非规范名、无箭头链」的行必须被判违规（以复核 r1 的因果闭环样本为蓝本）。
- **l0 休眠缺陷修复**：`logic/l0-link-audit-logic.ts:56/:59` target 字符类加 `\r\n` 排除；引用定义 bare destination 平衡括号归一；补「引用定义后随其他行」「平衡括号目标」两单测；实测 `L0_BASELINE`（650/92/36）不漂移（仓库现无引用定义行），如漂移按实测更新并如实登记。
- `scripts/__tests__/README.md:10` 描述同步。回归：prettier + `audit:l0-links` + `check-docs-consistency` + examples-contract 全绿。

### D2 requirement-coverage 空矩阵（I-2）— T2

- `logic/coverage-logic.ts:152` C7 改造：无 `graphCrossCuts` 时——`crossCuts` 为空数组 → blocking violation `C7b`（文案：「crossCuts 为空且未提供 --graph，无法证明横切一致性（fail-closed）」）；非空 → 非阻断 diagnostic + 结果 JSON 增 `skippedRules:['C7']`。有 graph 时 C7 行为不变。
- `samples/coverage/valid-out-of-scope-declared.json` 的 `crossCuts: []` 改为 1 条合法边（非空 + 无 graph = warning 放行，exit 0 保持，self-test 262 口径不变）；新增负例 fixture（空矩阵 + 无 graph → exit 1）并接入 self-test。
- `references/command-reference.md` check-requirement-coverage 节同步 C7b 语义。

### D3 CLI 参数与结构（I-3/I-4/I-5 + G3 M）— T3

- **8 入口接入统一解析**（复核 r3 定位）：`check-code-tla-consistency.ts:79-81`、`metrics-report.ts:55-58`（`--phase` 门控一并改直连 `parsePhaseArg`）、`ensure-codegraph-opsx.ts:302-308`（getArg 换 parseFlagValue + parsePhaseArg）、`plan-chunks.ts:45-53/:95`（内联循环换 parseFlagValue；`:105` 生效值统一取 `parsePhaseArg` 结果；报错 detail 取生效值，修复「报错值与生效值不一致」）、`check-codegraph-queries.ts:363`、`check-openspec-archive.ts:220`、`check-opsx-artifacts.ts:220`（三者 `--phase` 重复语义随 parsePhaseArg 统一为重复即错）、`wm-write.ts:70-122`（switch 循环换 parseFlagValue，杜绝 last-wins）。
- **parse-phase 统一**：`lib/parse-phase.ts` 增加 `--phase` 重复检测（重复 → `DuplicateFlagError`）并保留空格/等号两形态；头注释 `:4-16` 改为准确契约（13 个 importer、两形态、重复即错、requirement-graph 非法值必须报错）。`check-budget.ts:64/:118-130`、`check-signature-chain.ts:66`、`check-tla-model.ts:73` 改直连 `parsePhaseArg`（空格形态生效、非法值 ARG_INVALID）；`check-requirement-graph` 非法空格值补报错；`check-bdd-model.ts:114`、`check-preventive-review.ts:97` 保留仅等号形态，但 ARG_INVALID 消息注明「--phase 仅支持等号形态」。
- **state-machine 结构门（I-5）**：`check-state-machine-consistency.ts:66-68` 或 `logic/state-machine-logic.ts:43-46` 增顶层对象 + `designTransitions/codeTransitions/designStates/codeStates` 四字段形状校验；非对象/字段缺失或类型错误 → `STRUCTURE_INVALID` exit 2 + ERROR_JSON。
- **tla-model 顶层分类对齐（F-G3-04）**：`check-tla-model.ts:313-320` 顶层非对象当前判 ARG_INVALID「无法确定 phase」，与 `command-reference.md:408` STRUCTURE_INVALID 定义漂移——改为 STRUCTURE_INVALID 分类（与 I-5 同型校验复用；同文件 `:339-347` 行为正确不动）。
- **--scope 形态提示（F-G3-05）**：3 个阶段 5-8 checker 的「未提供 --scope」失败消息追加「仅支持 `--scope=<file>` 等号形态」（行为不变，补自查线索）。
- `check-samples-coverage.ts:255` 改挂 `runMain`（补 UNEXPECTED 兜底）；`docs-consistency.ts:655` 未知 `--*` flag → ARG_INVALID。
- `references/command-reference.md:358/:393/:408` 同步（重复 flag 全 CLI 生效、`--phase` 两形态与重复语义、state-machine STRUCTURE_INVALID）。

### D4 run-log reworkHints（I-6）— T4

- `run-log.schema.json`：allOf（`:22-126`）新增条件——`action ∈ {review, iceberg-review}`（以 `:150` 枚举实际名为准）且 `passed=false` → `reworkHints` `minItems: 1`；`:292` description 与实现一致化。
- `logic/run-log-logic.ts`：新增对应规则校验；兼容口径复用 `LEGACY_VARIANT_CUTOFF`（`:23`，`2026-09-01T00:00:00Z`）——cutoff 前旧行缺 hints → 非阻断诊断（`LEGACY_REWORK_HINTS`），cutoff 后 → blocking；吸收逻辑挂 `:380-388` 同型判定。
- fixtures：正例（passed=false + 1 条 hint → 通过）、负例（cutoff 后 passed=false 无 hints → exit 1）、legacy 例（cutoff 前 → 诊断放行）各一进 self-test/samples；`references/data-models.md`、`command-reference.md` 同步。

### D5 门禁口径与语义（G2/G6 M）— T5

- `check-role-dispatch.ts:88-99`：坏行改并入 blocking violations（exit 1，文案 `PARSE_INCOMPLETE: line N ...; blocking`），删除 `:91-93` 旧口径注释；与 run-log 对同一 fixture 输出同 exit。
- `logic/iceberg-sweep-logic.ts:81-91`：R3 去重增 `newFindings` 内部 `findingId` Set 检测（重复 → blocking）；`schemas/iceberg-sweep.schema.json` description 同步；失败运行不再产生 `GATE_LOG_SCHEMA_INVALID` 噪音（gate-log 写入前置校验或降级 stderr 诊断）。
- `budget-logic.ts:88-95`、`maturity-logic.ts:107-118`：无 `--project`/context 时输出非阻断 diagnostic「R1/R3 未校验（未提供 --project）」，CLI `--json` 增 `warnings` 呈现。
- **budget/maturity 死分支与单测（F-G2-05/F-G2-06）**：删除 schema 前置拦截下的不可达死分支（`budget-logic.ts:102-104/:112-114` R2/R4、`maturity-logic.ts:98-100` R1）或改为 schema 后置说明；`budget-logic.test.ts` 补 R1/R2/R3/R5 逐规则单测（现 4 例全为 R4-A）。
- `check-checkpoint.ts`：目录存在但空/无匹配时的 reason 文案改为实际语义（「checkpoint-log 无 phase-N 匹配记录」）。
- `lib/change-scope.ts:84-90`：`isIsoDateTimeString` 落实拒小写 `t`/`z`（对齐 A8 声明与 `change-scope.schema.json:42` 同步句；正反例进测试）；`:177` 注释改「所有 `.githooks/` 前缀文件」；STRUCTURE_INVALID 错误 detail 输出具体 schema 违规（不再吞并）；`codegraph-query` targetFiles 排除 `.` 开头段路径。
- `cli/check-codegraph-queries.ts:241-246`：scope 实际变更无 code/test 文件时跳过目录存在性/查询文件数检查（exit 0 + 证据注记），修复 docs-only 变更被阻断。
- `check-artifact-gate.ts`：`--json` 输出补 `external` summary（与 GATE_JSON 同构，O1 增强）。

### D6 文档契约与计数（G4/G7 M）— T6

- project.json 读取校验：`check-budget.ts:151-160`、`check-maturity.ts:132-147`、`wm-status.ts:65` 三处统一 `loadAndValidate('project')`；schema 失败 → exit 2 `STRUCTURE_INVALID`（wm-status 作为只读查询工具同样 fail-closed，输出 ERROR_JSON）。
- schema description 补全：`evidence-provenance.schema.json`（17 处）、`evidence-manifest.schema.json`（7 处）、`gate-log.schema.json`（6 处）；`docs-consistency-logic.ts` 新增「25 份 schema 属性级 description 全覆盖」静态检查（使 AGENTS.md:43 声明受门禁强制）。
- `rtm.schema.json` `$defs` → `definitions`（draft-07）；verifier `repeatTimes` description 与 `minimum` 对齐；`data-models.md` 幽灵字段（`actorRole`/`coveragePercent`）清理；8 处嵌套 `additionalProperties:true` 逐个评估收紧（保留确有开集语义者并在目录注明）。
- 计数与弱校验：`conventions.md:119`「35」→ 36 并修正构成口径；docs-consistency 新增该行计数检查；`conventions.md:58` action 27 值列表挂接既有 run-log-action 检查；`subagent-delegation.md` §6.4「26+10」算术修正为实际构成；`AGENTS.md:164` 表格管道符转义；§8「只登记一处」措辞修正（script-registry 兜底对象改为 AGENTS.md 计数句 + dispatch-matrix 双源）。
- **pre-push 17 项强校验**：`docs-consistency-logic.ts:1358-1374` `checkPrePushCount` 重写为解析真实编号块并断言连续 `#1..#17`（伪造中间删除即红）；用复核反例-1 的 3 块样本做负例测试。
- samples 门禁：`check-samples-coverage` 引用指向缺失文件 → exit 1（双向闭环）；矩阵声明改精确声明行匹配（反引号出现 ≠ 声明）。
- `docs/troubleshooting.md:90`「1300+ 用例」改「以当前命令输出为准」措辞。

### D7 pre-push 健壮性（G5 M）— T7

- `.githooks/pre-push:378` blocking 语料扩展：`vulnerabilit(y|ies)` 增补独立 `vulnerable`（表驱动加 2 行：含 vulnerable 的漏洞行必须 blocking）。
- `:394` 状态词锚定分支 4 处 GNU `\b` 改 POSIX 等价边界（如 `(^|[^[:alnum:]_])` / `([^[:alnum:]_]|$)` 包裹），GNU/BSD 双兼容；`:38` 注释补「audit 正则 POSIX 兼容，无 GNU 专有语法」。
- `platform-deps-hook.test.ts` 补防回归断言：`docs/*.md` 跨 `/` 命中（含 docs/changes、docs/superpowers 深层）、根级文件清单、`.githooks/**`、深层 `w-model-dev/**`、`-c core.quotePath=false` 在 4 处 git 调用存在（源级断言，参照 `:1017` 既有模式）。

### D8 测试套件质量（G8 M）— T8（在 T1 之后执行，同文件顺序依赖）

- `wm-write.test.ts:319-344` 双子进程并发用例改受控交错（第一写者确认落盘后再启第二子进程断言 `MTIME_CONFLICT`），消除调度依赖 flake；`run-sync.test.ts:441` 墙钟硬界改相对窗口 `elapsedMs ∈ [timeout, timeout+margin]` + `error.code === 'ETIMEDOUT'` 断言。
- `examples-contract.test.ts`：`FAILURE_CHAIN`（全句）与 `ORDINARY_FAILURE_CHAIN`（短名）按 D1 后语义自然分离，增 `expect(...).not.toBe(...)` 守卫；`:174/:180/:525-528` 三份禁词正则收敛单源；`:147`、`:558-578` 注释与替换后语料同步；补「否定式/提及式措辞不得作为合规标记」断言。
- `self-test.ts:3457-3490` 头部补印 `DesignContract 用例` 行（分项 257→262 闭合）；`:17` 注释「26 个用例数组」改「26 个样本子目录（33+1 数组）」。
- 全部用例总数变化如实登记（不影响 262 口径的前提下保持不变；若变，同步 samples README 与相关计数）。

### D9 台账与收尾 — T9

- 台账补链与追加（`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`「独立提交与版本同步」父链表）：**先补上一战役两个未链收口提交** `98bfda09cb9daaac0ea0f1f1a651b946556f514c`、`2fa27d637a7bf35831d2cdb02d57783d3b5d2796` 两行，再按时间顺序追加本战役全部提交行（规格、计划、T1-T8；40 字符完整 SHA + subject 逐字引用）；本战役台账收口提交自身按规则不入链，由下一轮活动链接。
- `CHANGELOG.md` 42.2.1 节追加本战役处置散文段（对照 review2-fixes 段式）；姊妹目录文件「处置」列全量回填。

## 5. 任务切分与提交纪律

| 任务 | 内容 | 主要触及 |
|---|---|---|
| T1 | D1 术语收口 + 扫描器 + l0 修复 | references/templates/examples、conventions、hard-constraints、examples-contract、l0-link-audit-logic |
| T2 | D2 requirement-coverage | coverage-logic、samples/coverage、command-reference |
| T3 | D3 CLI 参数与结构 | 8 入口、parse-phase/parse-args、state-machine、samples-coverage、docs-consistency、command-reference |
| T4 | D4 reworkHints | run-log.schema、run-log-logic、samples、data-models |
| T5 | D5 门禁口径 | role-dispatch、iceberg、budget/maturity、checkpoint、change-scope、codegraph-queries、artifact-gate |
| T6 | D6 文档契约与计数 | 3 读取侧 + 3 schema + docs-consistency + conventions/subagent-delegation/AGENTS/troubleshooting |
| T7 | D7 pre-push | pre-push、platform-deps-hook.test |
| T8 | D8 测试质量 | wm-write/run-sync/examples-contract/self-test |
| T9 | D9 台账 + 全量回归 + prepush + 终审准备 | CHANGELOG、acceptance、catalog 回填 |

每任务：独立 commit + codegraph 查询落盘（约束 #14）+ 定向回归真实退出码登记；V/G 失败走完整 R 链；发现超纲缺陷登记不扩线。提交顺序即上表；T8 必须在 T1 之后。

## 6. 台账纪律

- 父链表格式：`| \`<40 字符完整 SHA>\` | \`<subject 逐字>\` |`；零豁免延续；subject 内嵌短 SHA 属原文不展开（既有表注沿用）。
- 首个实现提交（T1）起，每个后续 commit 追加前一 commit 的链行；T9 汇总校验全链连续（`git log --format=%%H` 与表逐行比对）。
- 本战役收口提交（台账收口）自身不入链，由下一轮链接（沿用 review2-fixes 惯例）。

## 7. 验收矩阵（全部保存真实退出码）

1. **定向负例**：非规范名行被抓（r1 样本）；空 crossCuts + 无 graph → exit 1，非空 + 无 graph → exit 0 + `skippedRules`；8 入口重复 flag → exit 2；`--phase 8` 空格在 budget/signature-chain/tla-model 生效且非法值 ARG_INVALID；state-machine 顶层数组 → exit 2；cutoff 后 passed=false 无 hints → exit 1（cutoff 前 → 诊断）；role-dispatch 与 run-log 对同一坏行同为 exit 1；iceberg 内部重复 findingId → exit 1；project.json 缺必填 → exit 2；pre-push 伪造编号（3 块 + 文字）→ docs-consistency exit 1；samples 引用缺失文件 → exit 1；小写 t/z 时间戳 → 拒绝。
2. **全量回归**：`npx vitest run --config config/vitest.config.ts`（用例数变化如实登记）、`npm run self-test`（262）、`npm run eval`（25）、`npm run typecheck`、`npm run lint:security`、`check-docs-consistency`、`check-samples-coverage`、`audit:l0-links`、`npm run doctor`、`npm audit --audit-level=high`。
3. **prepush**：最终 `npm run prepush` 17 项全绿；已知负载敏感 flake 只隔离重跑并如实记录，不放宽 gate。
4. **独立终审**：范围 = `2fa27d6`..tip 全部提交；0 Critical / 0 Important 且 M 有处置；经用户同意后本地 ff-merge 到 main；**不 push**。

## 8. 交付边界

不包含：版本 bump、依赖升级、推送远端、`.superpowers/` 报告提交、`.superpowers/sdd/` 27 个 tracked 历史文件清理（独立决策）、metrics-report/wm-status 空日志查询语义变更、`docs/api/media/` 旧快照同步（defer 登记）、`.github/workflows` 引入。
