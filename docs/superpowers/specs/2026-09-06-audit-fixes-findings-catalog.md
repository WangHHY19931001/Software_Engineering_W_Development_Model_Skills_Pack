# W-Model Skill Pack 核查战役 · 发现目录（FINDINGS CATALOG，2026-09-06）

> 输入：32 份子报告（`g{1..8}-*/a{1..4}-report.md`）+ 4 份复核裁定（`review/r{1..4}-verdict.md`）+ 总裁定（`review/VERDICT-SUMMARY.md`）。
> 本目录为后续修复战役的**权威输入**，并闭合复核指出的「M 数去重映射未记录」可追溯性缺口。

> **处置回填（2026-09-06，task 9 收口；2026-09-07 定向补修更新）**：主表「处置建议」列已按战役实现逐条落定并括注实现任务与 commit——6 I + 48 M 于战役内全部 fix；唯一 defer 例外 F-G4-03 经 2026-09-07 定向补修 fix（规划遗漏→定向补修，见该行标注）；F-G6-03 维持「已裁定不改」。说明级 64 条：13 条 fix（S2/S3/S4/S18/S19/S20/S22/S25/S46/S49/S56/S57/S64）、51 条 defer。全量回归与 prepush 证据见验收记录 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`「核查发现修复（audit-fixes）验证记录（2026-09-06）」节。

## 0. 去重口径说明

1. **合并规则**：同一缺陷被多个子区/子报告报告 → 合并为一条，`来源报告` 列列出全部来源；合并关系在第 4 节逐条列出。
2. **严重度口径**：以复核裁定为准（C/I/M/说明）。6 条 I 级与复核编号 I-1…I-6 一一对应（0 Critical 维持不变）。
3. **复核修正优先**：I-1 计数口径取 r1 三口径（guidance corpus 40/14；全域纯 md 41/15；含 docs 历史 62/19；a1 原 CHANGELOG/docs-changes 数字系行数口径、次数为 5/6，且漏计 `docs/superpowers/plans/2026-09-05-review2-fixes.md` 4 处）；I-3 措辞取 r3 修正「静默取**第一或最后一值**」（wm-write、plan-chunks 内联循环为 last-wins）；账目双口径沿 VERDICT-SUMMARY §三（去重前 ~62 vs 主报告 ~39 不可重构）。
4. **子报告间严重度冲突**：无复核裁定的取更严者并标注「严重度有分歧」。本目录两处：F-G3-05（g3-a4 定 M / g6-a1 定说明）、F-G4-05（g4-a2 定 M / g6-a1 定说明）。另：g8-a4 将 self-test 分项 257≠262 定为说明级，r4 抽样定为 M 且 CONFIRMED，按「复核优先」计入 M（F-G8-07）；g1-a1 对「逗号第三式」清单列说明、分档列 M，按分档取 M。
5. **来源路径**均相对 `.superpowers/sdd/verify-campaign-2026-09-05/`；「#」后为报告内节名/编号。产品码位置相对仓库根。

## 1. 主表（0C / 6I / 49M + 1 条已裁定不改）

| ID | 严重度 | 域 | 位置(文件:行号) | 主张（一句话） | 修复方向（一句话） | 来源报告（路径#节） | 处置建议 |
|---|---|---|---|---|---|---|---|
| F-G1-01 | **I** | G1 术语 | `w-model-dev/scripts/__tests__/examples-contract.test.ts:192,:519`；`references/conventions.md:125`；`references/hard-constraints.md:85` | **I-1** 扫描器把非规范名「完整普通失败链」当合规判据（r1 全 CONFIRMED：guidance corpus 40 处/14 文件、全域纯 md 41/15、含 docs 历史 62/19 全部逃逸；vitest 27/27 全绿佐证），并连带：`_Avoid_` 缺主犯词条、conventions.md:124 定义句与 hard-constraints.md:85 锚点标题自用禁用词「标准返工链」、裸短名不校验锚点（a1 F2/a3 #5 原分列 I/M，并入本条） | `hasChainMarker`/:519 仅认锚点短名或全句内联；`_Avoid_` 增补全族；改 :124/:85 措辞；语料 40 处迁移规范短名并同步 fixtures :575/:584/:602 | g1-terminology/a1-report.md#§2-F1~F4 + a2-report.md#§三-反例1 + a3-report.md#§二-F1~F6 + a4-report.md#§二-1,2；review/r1-verdict.md（6 子主张 CONFIRMED） | fix（T1 de79cfe） |
| F-G1-02 | M | G1 | `references/hard-constraints.md:342` | 词序变体「普通失败完整链」孤例，同行含规范名故逃逸扫描 | 改词序或并入 `_Avoid_` | g1-terminology/a1-report.md#§2-F5 | fix（T1 de79cfe） |
| F-G1-03 | M | G1 | `references/phase-5-coding.md:193`；`templates/acceptance-test.md:72` | 裸「普通失败链」2 处（无 V/G 修饰、无锚点、非全句），MANIFEST 已知线索核实成立 | 改规范带锚点短名 | g1-terminology/a1-report.md#§4-M + a2-report.md#M-1 + a3-report.md#§一-4 + a4-report.md#§二-4 | fix（T1 de79cfe） |
| F-G1-04 | M | G1 | `examples/stage6-integration-test.md:71`、`examples/stage7-system-test.md:72` | examples 豁免区以非规范长名作纯标签而未内联全句（豁免仅限全句内联） | 改规范短名或补全句 | g1-terminology/a2-report.md#M-2 | fix（T1 de79cfe） |
| F-G1-05 | M | G1 | `references/verifier-spec.md:102` | 逗号第三式「（普通 V/G 失败链，hard-constraints）」为 conventions.md:124 授权两式之外的变体 | 并入表格形 | g1-terminology/a1-report.md#§2-G2 | fix（T1 de79cfe） |
| F-G1-06 | M | G1 | `references/data-models.md:528` | 「普通返工链」非规范变体 1 处（a3 曾称 2 处，a4 复核 operational-recovery.md:232 实为「普通返工循环」） | 改规范名 | g1-terminology/a1-report.md#§2-G3 + a4-report.md#对账说明 | fix（T1 de79cfe） |
| F-G1-07 | M | G1(l0) | `w-model-dev/scripts/logic/l0-link-audit-logic.ts:56,:59` | 引用定义 target 字符类未排除换行，target 吞并后续行（潜在误报；现仓库 0 引用定义行，基线不受影响） | 字符类加 `\r\n` 排除并补「后随其他行」单测 | g1-terminology/a4-report.md#§三-反例1 | fix（T1 de79cfe） |
| F-G1-08 | M | G1(l0) | `w-model-dev/scripts/logic/l0-link-audit-logic.ts:56` | CommonMark 合法平衡括号 bare destination `(./x.md)` 前导括号被并入 target（潜在误报） | 括号配平解析并补单测 | g1-terminology/a4-report.md#§三-反例2 | fix（T1 de79cfe） |
| F-G2-01 | **I** | G2 门禁 | `w-model-dev/scripts/logic/coverage-logic.ts:152,:83-84`；`cli/check-requirement-coverage.ts:61,:69-73`；`schemas/coverage.schema.json:59-67` | **I-2** crossCuts 整张空 + metrics=100 + 不传 `--graph` → exit 0 放行（C7 守卫 `options.graphCrossCuts` 缺省整段跳过、recalcRate 空集返回 100；r2 实跑 CONFIRMED，有 graph 时 C7 确会拦截） | crossCuts 加 `minItems:1` 或增「第 4 矩阵非空」规则；`--graph` 缺省降级 warning；README.md:132 阶段 1 调法补 `--graph` | g2-gate-failclosed/a3-report.md#§4-F1(CX7/CX7b) + a4-report.md#§四；review/r2-verdict.md#I-2 | fix（T2 562fce8） |
| F-G2-02 | M | G2 | `w-model-dev/scripts/logic/iceberg-sweep-logic.ts:81-91`；`schemas/iceberg-sweep.schema.json` | newFindings 内部重复 findingId 漏检 exit 0（R3 仅比对 previousFindings；newFindingsCount 虚高破坏去重语义；r2 M-b CONFIRMED） | 对 newFindings 自身做 Set 去重并报 violation | g2-gate-failclosed/a2-report.md#发现1,CE17；review/r2-verdict.md#M-b | fix（T5 a6e898e） |
| F-G2-03 | M | G2 | `cli/check-role-dispatch.ts:88-99` vs `cli/check-run-log.ts:242-252` | 同一 malformed-only 输入 role-dispatch exit 2（FILE_PARSE）、run-log exit 1（PARSE_INCOMPLETE blocking），两 checker exit 口径不一致（均 blocking 非 fail-open；r2 M-a CONFIRMED） | role-dispatch 坏行并入 exit 1，或在 MANIFEST 口径标注例外 | g2-gate-failclosed/a4-report.md#发现6,#10 + a2-report.md#CE13；review/r2-verdict.md#M-a | fix（T5 a6e898e） |
| F-G2-04 | M | G2 | `logic/budget-logic.ts:88-95`；`logic/maturity-logic.ts:107-118` | budget R1 时效 / maturity R3 周期为可选 `--project` context 触发，不传时 bad 样本静默 exit 0 且无「未校验」提示 | 补非阻断「context 未提供，R1/R3 未校验」提示 | g2-gate-failclosed/a4-report.md#发现7(汇总#18,#20) | fix（T5 a6e898e） |
| F-G2-05 | M | G2 | `logic/budget-logic.ts:102-104,:112-114`；`logic/maturity-logic.ts:98-100` | budget R2/R4 与 maturity R1 为 schema 前置拦截下的不可达死分支 | 删除死分支或改为 schema 后置说明 | g2-gate-failclosed/a3-report.md#F2 | fix（T5 a6e898e） |
| F-G2-06 | M | G2 | `w-model-dev/scripts/__tests__/budget-logic.test.ts:27-53` | budget R1-R5 无逐规则单测（4 例全为 R4-A），回归脆弱 | 补 R1/R2/R3/R5 单测 | g2-gate-failclosed/a3-report.md#F3 | fix（T5 a6e898e） |
| F-G3-01 | **I** | G3 CLI | `check-code-tla-consistency.ts:79-81`、`metrics-report.ts:55-58`、`ensure-codegraph-opsx.ts:302-308`、`plan-chunks.ts:45-53,:95`、`check-codegraph-queries.ts:363`、`check-openspec-archive.ts:220`、`check-opsx-artifacts.ts:220`、`wm-write.ts:76-77` | **I-3** 重复值 flag「ARG_INVALID 全 CLI 生效」不成立：8 入口无重复检测、静默取**第一或最后一值**（r3 逐入口 CONFIRMED；并复现 a1-M1：plan-chunks 报错 detail 取 last-wins 值而生效值为 first-wins，错误消息与实际判定不一致，随本条修复；对照 parse-args.ts:15-20/run-main.ts:15-17 机制存在未接入） | 前 7 入口收敛 parseFlagValue 或对 parsePhaseArg 增重复检测；wm-write 循环内对单值 flag 计数 | g3-cli-arg-errors/a1-report.md#I-1,I-2,M-1,M-2 + a3-report.md#C2,#2 + a4-report.md#反例3,M2；review/r3-verdict.md#I-3 | fix（T3 6fc9624） |
| F-G3-02 | **I** | G3 CLI | `lib/parse-phase.ts:4-7`；静默组 `check-budget.ts:64,:118-130`、`check-signature-chain.ts:66,:106-119`、`check-tla-model.ts:73`、`metrics-report.ts:57,:182`；部分组 `check-requirement-graph.ts:92-96`；拒绝组 `check-bdd-model.ts:114`、`check-preventive-review.ts:91,:97` | **I-4** parse-phase 声称 13 脚本统一支持 `--phase N` 空格形态，实际仅 6 完整支持（1 部分、4 静默忽略、2 报错拒绝），非法空格值不触发 ARG_INVALID（r3 CONFIRMED：check-budget 空格合法/非法均静默 vs check-artifact-gate 空格完整生效，对照排除环境因素） | 增形态无关 phaseFlagPresent 门控替换 `parseFlagValue(args,'phase')` 门与 ARG_INVALID 门两处；bdd-model 裸 `--phase` 加入判定 | g3-cli-arg-errors/a2-report.md#M1~M6(6 条全并入) + a1-report.md#I-2；review/r3-verdict.md#I-4 | fix（T3 6fc9624） |
| F-G3-03 | **I** | G3 CLI | `cli/check-state-machine-consistency.ts:66-68`；`logic/state-machine-logic.ts:43-46`；`references/command-reference.md:408` | **I-5** 顶层非对象输入（JSON 数组/标量）被当「全空合法图」exit 0 放行，缺 STRUCTURE_INVALID 门（r3 仓库既有顶层数组实跑 CONFIRMED，fail-open） | CLI 或 logic 层补顶层对象+四字段形状校验，不符即 STRUCTURE_INVALID exit 2 | g3-cli-arg-errors/a3-report.md#C1,#1；review/r3-verdict.md#I-5 | fix（T3 6fc9624） |
| F-G3-04 | M | G3 | `cli/check-tla-model.ts:313-320` | 顶层非对象输入判 ARG_INVALID「无法确定 phase」，与 command-reference.md:408 STRUCTURE_INVALID 定义漂移（同文件 :339-347 行为正确） | 对齐错误分类或修订文档 | g3-cli-arg-errors/a3-report.md#C3,#3 | fix（T3 6fc9624） |
| F-G3-05 | M | G3 | `cli/check-codegraph-queries.ts` 等 3 个阶段 5-8 checker 的 `--scope` 处理；`command-reference.md:358` | `--scope <file>` 空格形态按「未提供」处理与契约一致（fail-closed），但失败消息无形态提示，用户无从自查（严重度有分歧：g3-a4 定 M、g6-a1 F5 定说明，取 M） | 「未提供 --scope」消息追加「仅支持 `--scope=<file>` 等号形态」 | g3-cli-arg-errors/a4-report.md#§五-1 + g6-codegraph-opsx/a1-report.md#F5 | fix（T3 6fc9624） |
| F-G4-01 | **I** | G4 Schema | `schemas/run-log.schema.json:292,:295-298`（无 minItems、allOf 无 if/then）；`logic/run-log-logic.ts:111`（纯类型声明） | **I-6** run-log review 行 passed=false 时 reworkHints 缺省/空数组零强制，exit 0 + CLOSED_UNDER_CURRENT_RULES（与 preventive-review.schema.json:9-19 已修复的同构绑定不对称；r4 四 fixture 放行 + 负对照 CONFIRMED） | schema 补 if/then（passed=false→reworkHints.minItems:1）+ run-log-logic 补校验 + 补用例 | g4-schema-logic/a1-report.md#发现3；review/r4-verdict.md#I-6 | fix（T4 bf20d93） |
| F-G4-02 | M | G4 | `schemas/run-log.schema.json:52,:251,:255` | emergency-fix 描述未提驱动吸收/阻断边界的 `LEGACY_VARIANT_CUTOFF='2026-09-01T00:00:00Z'`（run-log-logic.ts:23），描述宽于实现 | 描述补具体分界日期 | g4-schema-logic/a1-report.md#发现1 | fix（T4 bf20d93） |
| F-G4-03 | M | G4 | `schemas/run-log.schema.json:209`；`logic/run-log-logic.ts:884-888` | gateLogPath「必填」描述无任何强制点（官方样例 phase5-valid.jsonl gate 行无此字段仍 exit 0） | 补条件 required 或改描述 | g4-schema-logic/a1-report.md#发现7 | fix（333a7f3，描述对齐实现；T1-T8 规划遗漏→2026-09-07 定向补修：不加条件 required（262 基线 gate 行均无此字段，会翻转基线），仅对齐描述） |
| F-G4-04 | M | G4/G6 | `schemas/change-scope.schema.json:42`；`lib/change-scope.ts:79-90`；`cli/check-codegraph-queries.ts:315-318` | scopeCreatedAt「以 TS 层为准」A8 同步句未落实：isIsoDateTimeString 仅校验 queryTimestamp，小写 t/z、空格分隔的 scopeCreatedAt 实测通过阶段 5 全链路门禁 exit 0（跨域并条，见 §3.2-9） | resolveCliScope/validateChangeScope 对 scopeCreatedAt 补 isIsoDateTimeString 复核，或删「以 TS 层为准」 | g4-schema-logic/a2-report.md#F1,A1-A2 + g6-codegraph-opsx/a1-report.md#F1,CA-m | fix（T5 a6e898e） |
| F-G4-05 | M | G4/G6 | `schemas/codegraph-query.schema.json:33` | targetFiles pattern 缺 `.` 段排除，与 change-scope.schema.json:51 及 TS 层构成三层口径不一（`src/./test.ts` schema 放行、仅 TS 层兜底；严重度有分歧：g4-a2 定 M、g6-a1 F6 定说明，取 M） | pattern 对齐补 `(?!.*(?:^|/)\.(?:/|$))` | g4-schema-logic/a2-report.md#F2,B4 + g6-codegraph-opsx/a1-report.md#F6 | fix（T5 a6e898e） |
| F-G4-06 | M | G4 | `lib/change-scope.ts:84` | isIsoDateTimeString JSDoc「拒绝…无毫秒/时区形态」与实现矛盾（实现接受秒级+时区形态） | 重写 JSDoc 为精确接受/拒绝形态清单 | g4-schema-logic/a2-report.md#F3 | fix（T5 a6e898e） |
| F-G4-07 | M | G4 | `lib/change-scope.ts:177,:186-187` | `.githooks/` 例外注释限定「无扩展名 shell」，实现 `startsWith` 覆盖全部前缀文件，`.githooks/*.md`/`.txt` 也被强制要求 codegraph 覆盖（潜在误伤） | 统一注释与实现口径（限定无扩展名或明示全包含） | g4-schema-logic/a2-report.md#F4 | fix（T5 a6e898e） |
| F-G4-08 | M | G4/G7 | `schemas/evidence-provenance.schema.json`（17/17 属性+root 全缺 description）、`evidence-manifest.schema.json`（7/28）、`gate-log.schema.json`（6/26）；`AGENTS.md:43` | 「25 份全字段 description 自描述（含 evidence-provenance）」失实且无门禁强制（r4-M3 CONFIRMED 17/17；g4-a3 曾计 22/22 系含 defs 口径；跨域并条，见 §3.2-11） | 补全 3 份 description 或收紧 AGENTS.md:43 声明，并评估为 docs-consistency 增加 description 覆盖检查 | g4-schema-logic/a3-report.md#核心1 + g7-docs-consistency/a4-report.md#发现5；review/r4-verdict.md#M3 | fix（T6 9bed229） |
| F-G4-09 | M | G4 | `schemas/rtm.schema.json:42-45,:49-62` | 唯一使用 `$defs`/`#/$defs/` 的 schema，draft-2019-09+ 关键字混入自称 draft-07 的文件，严格 draft-07 校验器会解析失败 | 改用 definitions | g4-schema-logic/a3-report.md#核心2 | fix（T6 9bed229） |
| F-G4-10 | M | G4 | `references/data-models.md:981` | 幽灵字段 actorRole：schema 与消费方均无此字段（实为 role/sourceRole） | 修文档字段名 | g4-schema-logic/a3-report.md#核心3 | fix（T6 9bed229） |
| F-G4-11 | M | G4 | `schemas/verifier-output.schema.json:22`；`logic/verifier-logic.ts:134,:357` | repeatTimes 描述「整数 >=3」但 minimum:1，实测 2 被 schema 接受、被业务层拒绝（schema 与自述语义不一致） | schema 改 minimum:3 | g4-schema-logic/a3-report.md#核心4,反例B | fix（T6 9bed229） |
| F-G4-12 | M | G4 | `references/data-models.md:977` vs `schemas/coverage.schema.json:80-83` | coverage 行声称「coveragePercent [0,100]」，实际 schema 无该字段、4 个 metrics 数值无 [0,100] 边界（消费方仅判 ===100） | 修文档并评估数值边界 | g4-schema-logic/a3-report.md#核心5 | fix（T6 9bed229） |
| F-G4-13 | M | G4 | `schemas/code-tla-manifest.schema.json:13,:21,:65,:73,:86,:100,:108`；`tla-manifest.schema.json:106`；`data-models.md:964,:989` | 8 处嵌套 additionalProperties:true 与「全层级禁止未知字段」不符（7 处有自述、checkRounds 无自述），实测未声明字段被接受 | 修订 data-models.md 措辞或补 justify | g4-schema-logic/a3-report.md#核心6,反例A | fix（T6 9bed229） |
| F-G4-14 | M | G4 | `cli/check-budget.ts:151-160`、`cli/check-maturity.ts:132-147`、`wm-status.ts:65` | project.json 读取侧零 schema 校验（运行时 `validateBySchema('project')`=0 处），必填字段缺失仅 warn-and-skip exit 0，仅写路径有强制（r4-M1 CONFIRMED） | 3 处读取统一走 loadAndValidate(file,'project') 并在 command-reference 明确口径 | g4-schema-logic/a4-report.md#M-1,反例c；review/r4-verdict.md#M1 | fix（T6 9bed229） |
| F-G5-01 | M | G5 hook | `.githooks/pre-push:378-380` | audit blocking 语料只匹配 vulnerability/vulnerabilities，不覆盖形容词「vulnerable packages」，构造样本被 SKIP（漏报向，当前 npm 措辞下触发概率低） | blocking 语料放宽为 `vulnerab[a-z]*` | g5-prepush-hook/a2-report.md#M发现1 | fix（T7 1c56f5a） |
| F-G5-02 | M | G5 hook | `.githooks/pre-push:394`（4 处 `\b`） | 残留 GNU ERE `\b` 词边界，macOS BSD grep 按字面失败 → 状态词类 skip 退化为 blocking（fail-closed 向但 macOS 误阻断；r4-M7 CONFIRMED 4 处；「Linux/macOS 不受影响」注释未覆盖此限制） | 改 POSIX 等价边界或文档显式声明依赖 GNU grep | g5-prepush-hook/a3-report.md#M + a2-report.md#说明3；review/r4-verdict.md#M7 | fix（T7 1c56f5a） |
| F-G5-03 | M | G5 测试 | `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`（全文件无 docs/ 用例）vs `pre-push:112` | `docs/*.md` 跨 `/` 过包含口径零测试护卫（CONTRIBUTING/头注释卖点语义，改坏不报警） | 补 it.each 路径过滤用例 | g5-prepush-hook/a4-report.md#M3,反例4 + a3-report.md#说明1 | fix（T7 1c56f5a） |
| F-G5-04 | M | G5 测试 | `pre-push:110-111` vs 测试用例分布 | 根级 7 文件仅 package-lock.json 有测试；`.githooks/**`、`w-model-dev/**` 深层嵌套零直接用例 | 补路径过滤用例 | g5-prepush-hook/a4-report.md#M4 | fix（T7 1c56f5a） |
| F-G5-05 | M | G5 测试 | `pre-push:148,:212,:221,:252` | `-c core.quotePath=false` 4 处无任何测试断言（mock 按子串分派），回归将静默 | mock 断言补该 flag | g5-prepush-hook/a4-report.md#M5 + a3-report.md#说明2 | fix（T7 1c56f5a） |
| F-G6-01 | M | G6 | `cli/check-codegraph-queries.ts:217-223,:241-246`；`cli/check-artifact-gate.ts:243` | docs-only 变更在阶段 5-8 无法通过：目录存在性/查询文件存在性检查先于 required==0 判定无条件执行，逼 S 为 docs 文件伪造查询（与 hard-constraints.md:79、phase-5-coding.md:79「校验实际覆盖而非目录存在」不符；gate 聚合路径同样阻断） | strict 入口先算 required，required==0 直接 passed（存在性检查仅在 required>0 时执行） | g6-codegraph-opsx/a2-report.md#缺陷1,d1-d3 + a4-report.md#O2 | fix（T5 a6e898e） |
| F-G6-02 | M | G6 | `lib/change-scope.ts:396-398`；`lib/cli-error.ts:35,:46-51` | STRUCTURE_INVALID 的具体 schema 违规 detail 永不显示（formatCliError 取 `e.file || e.detail` 而 file 恒存在；printErrorJson 不含 detail），`/changedFiles/0: must match pattern` 等定位信息丢失 | printErrorJson 增补 detail 或调整 stderr 展示（影响全 CLI，需评估 ERROR_JSON 契约） | g6-codegraph-opsx/a1-report.md#F2 | fix（T5 a6e898e） |
| F-G6-03 | 说明 | G6 | change-scope 装载链（schema pattern 前置，`lib/change-scope.ts`） | changedFiles 含绝对路径/`..` 越界实测 exit 2（非战役任务文本期望的 exit 1）；复核裁定 exit 2 正确（schema 非法=输入错误，与 command-reference.md:393 一致，fail-closed 成立） | —（不改代码；可选在战役口径文档标注） | g6-codegraph-opsx/a1-report.md#F3,CA-d1,d2 | 已裁定不改 |

（注：F-G7-01…F-G7-08、F-G8-01…F-G8-07 见下——本表按域续排。）

| ID | 严重度 | 域 | 位置(文件:行号) | 主张（一句话） | 修复方向（一句话） | 来源报告（路径#节） | 处置建议 |
|---|---|---|---|---|---|---|---|
| F-G7-01 | M | G7 文档 | `references/subagent-delegation.md:279` | 「26 个 check-* + 10 个工具」与同句「37 个 .ts」算术不符（实际 11 个工具，plan-chunks 未入 §6.4 表） | 改「+11 个工具」并补 plan-chunks 行或注明见 §2 | g7-docs-consistency/a1-report.md#M1,Re3 | fix（T6 9bed229） |
| F-G7-02 | M | G7 | `AGENTS.md:164` | check-preventive-review 行 3 个未转义管道符致 Markdown 表格破列（8 列），且无任何规则校验 §8 表格结构 | 转义为 `\|`（参照 :149 先例） | g7-docs-consistency/a1-report.md#M2,Re4 | fix（T6 9bed229） |
| F-G7-03 | M | G7 | `subagent-delegation.md:281`；`logic/docs-consistency-logic.ts:1007-1032` | 「只在本文件登记一处」不精确：SKILL.md/AGENTS.md 计数须同步，且 AGENTS §8 脚本行不受任何门禁保护（漏加行门禁全绿） | 修指导语并评估 §8 纳入 script-registry 双向核对 | g7-docs-consistency/a1-report.md#M3,Re5 | fix（T6 9bed229） |
| F-G7-04 | M | G7 | `conventions.md:119`；`logic/docs-consistency-logic.ts:1333-1356` | exit-2 计数「=35」与实测/AGENTS「36」不一致（r4-M2 CONFIRMED 36，两文档自相矛盾），且 conventions.md 不在 checkExit2ScriptCount 检查源，漂移在门禁上不可见 | 将 conventions.md:119 并入检查源或删计数改指针 | g7-docs-consistency/a2-report.md#M-1,A1；review/r4-verdict.md#M2 | fix（T6 9bed229） |
| F-G7-05 | M | G7 | `conventions.md:58`；`logic/docs-consistency-logic.ts:1376-1388` | action「共 27 值」列表无任何强制（checkGlossaryAction 仅两点），篡改列表 0 violation，schema 演进时静默漂移 | 增「glossary action 列表 == schema enum」逐值断言 | g7-docs-consistency/a2-report.md#M-2,A2 | fix（T6 9bed229） |
| F-G7-06 | M | G7 | `cli/check-samples-coverage.ts:120-152` | 覆盖门禁单向校验：只核对「在盘 fixture 被引用」，不核对「引用指向在盘文件」，dangling 引用 exit 0（反例实跑复现） | 增反向 reference-dangling 校验并 exit 1 | g7-docs-consistency/a3-report.md#M-1,反例3 | fix（T6 9bed229） |
| F-G7-07 | M | G7 | `cli/check-samples-coverage.ts:155-163` | matrix-undeclared 实为「README 全文反引号提及名字」弱校验而非矩阵行校验，正文提及即绕过 | 判据收紧为解析矩阵表行 | g7-docs-consistency/a3-report.md#M-2,反例4 | fix（T6 9bed229） |
| F-G7-08 | M | G7 | `logic/docs-consistency-logic.ts:1358-1374` | pre-push 项数门禁弱校验：仅查「最大编号=17 + 文本『17 项检查』」，伪造 3 块检查的 pre-push 可全绿（node 复刻反例成功） | 解析真实检查块并断言连续 1..17，或从实际执行行推导 | g7-docs-consistency/a4-report.md#发现3,反例1 | fix（T6 9bed229） |
| F-G8-01 | M | G8 测试 | `examples-contract.test.ts:8-9,:80-81` | FAILURE_CHAIN ≡ ORDINARY_FAILURE_CHAIN 字符级相同（长 140），两类链契约在断言层面恒真耦合、不可区分，双源演进必分叉且无用例守卫（r4-M4 CONFIRMED） | 按 G1 语义分离两常量并加 `expect(...).not.toBe(...)` 守卫 | g8-test-suite/a1-report.md#反例1 + a2-report.md#M4；review/r4-verdict.md#M4 | fix（T8 e3bb923） |
| F-G8-02 | M | G8 | `examples-contract.test.ts:189-194,:504-535` | marker 子串即豁免：「无需完整普通失败链」「详见普通 V/G 失败链」等否定式/提及式旁路被放行（CX1/CX2 实跑复现），弱于 :146-147 注释契约 | marker 判定加肯定式前置词（完成/先走/执行）或拆句同句判定 | g8-test-suite/a2-report.md#M1,CX1,CX2 | fix（T1 de79cfe） |
| F-G8-03 | M | G8 | `examples-contract.test.ts:146-147` | 注释漏列锚名合规路径，且称「完整普通失败链」为 canonical，与文件 :101/:313/:419/:480 及 conventions.md 规范自相矛盾 | 统一锚名指称 | g8-test-suite/a2-report.md#M2 | fix（T8 e3bb923） |
| F-G8-04 | M | G8 | `examples-contract.test.ts:558-578` | 测试 provenance 注释引用的 hard-constraints 语料状态已过期（:369/:372 末格已为合规全链，grep 零命中旧文本），误导维护者 | 改「构造样本」措辞或改引真实行 | g8-test-suite/a2-report.md#M3 | fix（T8 e3bb923） |
| F-G8-05 | M | G8 | `wm-write.test.ts:319-344` | 双真实子进程并发用例依赖加锁/检测交错时序，a3 实测 5 跑 1 失败（真实 flake 源；r4-M6 CONFIRMED） | 引入受控交错或显式枚举两 summary 的等价交错 | g8-test-suite/a3-report.md#M1,反例B + a4-report.md#反例2；review/r4-verdict.md#M6 | fix（T8 e3bb923） |
| F-G8-06 | M | G8 | `run-sync.test.ts:441` | 墙钟硬界 `elapsedMs<2000` 与实现 timeout(250ms) 耦合，慢 CI/重负载下可 flake（探针实测边界翻转；r4-M5 CONFIRMED） | 改相对窗口断言（elapsed∈[timeout, timeout+斜率]）+ 验证 ETIMEDOUT | g8-test-suite/a3-report.md#M2,反例A；review/r4-verdict.md#M5 | fix（T8 e3bb923） |
| F-G8-07 | M | G8 | `cli/self-test.ts:3457-3490` | 头部分项漏印 `DesignContract 用例` 行，分项合计 257 ≠ 尾部总计 262（DESIGN_CONTRACT_CASES 5 条确实执行；子报告定说明级、复核 r4-M8 抽样定 M CONFIRMED，从复核） | 补印该行或改为从数组动态打印 | g8-test-suite/a4-report.md#反例1；review/r4-verdict.md#M8 | fix（T8 e3bb923） |

## 2. 说明级单列表（供 defer 判断；不含上表 F-G6-03）

| # | 域 | 位置 | 要点 | 来源 | 处置 |
|---|---|---|---|---|---|
| S1 | G1 | `templates/system-test.md` | 全文件无失败链/返工指令节，模板族覆盖不一致 | g1/a2#核查5 | defer |
| S2 | G1 | `templates/review-report.md:43` vs `:54` | 同文件非规范长名与规范短名并存自相矛盾 | g1/a2#说明 | fix（T1 de79cfe） |
| S3 | G1 | `templates/acceptance-test.md:74,76`、`templates/coding.md:63,:91,:93` | 「普通失败返工链」标题与「下方完整链条/完整链执行」短语漂移 | g1/a2#说明 + a4#H 行 | fix（T1 de79cfe） |
| S4 | G1 | examples-contract.test.ts:192,:519,:575,:584,:602 | 语料迁移规范短名后扫描器字面量与 fixtures 必须同步，否则迁移审计失效 | g1/a3#结论7 | fix（T1 de79cfe） |
| S5 | G1 | `package.json:23` | l0 工具命名漂移：实为 `application/audit-l0-links.ts`，无 `cli/l0-link-audit-cli.ts` | g1/a4#说明 | defer |
| S6 | G1 | —（口径注记） | 「完整普通失败链」计数口径族：47/16 全类型、40/14 guidance corpus、41/15 全域纯 md、62/19 含 docs 历史 | r1-verdict + g1/a4#§四-3 | defer |
| S7 | G2 | `logic/run-log-logic.ts:1196-1202` | 极简日志（单条 produce）即报 CLOSED_UNDER_CURRENT_RULES，与 schema lifecycleStatus 描述存在措辞张力 | g2/a1#F8 | defer |
| S8 | G2 | `logic/run-log-logic.ts:564-567` | R2 负值 tokens 分支为 schema 前置下的不可达冗余防御 | g2/a1#F10 | defer |
| S9 | G2 | `__tests__/checkpoint-logic.test.ts`（51 行 3 用例全为 R3） | checkpoint R1/R2/R4/R5 无单测固化（CLI 反例中功能正常） | g2/a2#说明2 | defer |
| S10 | G2 | `cli/check-iceberg-sweep.ts:192-196` | iceberg 失败运行 gate-log 写入 `GATE_LOG_SCHEMA_INVALID`，失败事件无审计足迹（不影响主 exit） | g2/a2#说明3 + g2/a4#发现8（合并） | defer |
| S11 | G2 | `logic/checkpoint-logic.ts:134-139,:263-274` | checkpoint R4 阶段 5-8 匹配空窗（注释明示设计内） | g2/a2#说明4 | defer |
| S12 | G2 | `logic/checkpoint-logic.ts:253-257` | 代签检测为启发式（确认文件存在且非空即过，无内容一致性/签名校验） | g2/a2#说明5 | defer |
| S13 | G2 | `cli/check-role-dispatch.ts:83-100` | 不做 run-log schema 前置校验，瘦条目计入 S/V/G 计数（由 check-run-log 域兜底，非 fail-open） | g2/a2#说明6 | defer |
| S14 | G2 | `logic/iceberg-sweep-logic.ts:65-80` | iceberg R2 分支 CLI 路径不可达（schema 先拦截），冗余死代码 | g2/a2#说明7 | defer |
| S15 | G2 | `logic/coverage-logic.ts:207-211` | C9 未提供 --out-of-scope 时降级 warning（设计内窗口，C8/C10 兜底，与 F-G2-01 同根） | g2/a3#F4 | defer |
| S16 | G2 | `scripts/samples/coverage/valid-cross-cuts-consistent.json` + `samples/graph/valid-cross-cuts-nfr.json` | 按命名配套实跑不通过（C7 双向不一致），self-test 用手工选项未交叉验证 | g2/a3#F5 | defer |
| S17 | G2 | `schemas/exemption.schema.json:58-60` | decidedBy「非 O 角色」仅有描述无强制，E1-E9 未覆盖代签语义 | g2/a3#F6 | defer |
| S18 | G2 | `cli/check-checkpoint.ts` 加载层 | 空目录/无匹配文件时文案「未提供 --checkpoint-log」误导排查方向 | g2/a4#发现9 | fix（T5 a6e898e） |
| S19 | G3 | `references/command-reference.md:408` vs budget/maturity 实现 | STRUCTURE_INVALID「顶层非对象」文档定义与实现（exit 1 schema violations）语义不一致，建议文档对齐 | g3/a3#说明4,C3 | fix（T3 6fc9624） |
| S20 | G3 | `cli/check-samples-coverage.ts:255` | 缺参归 UNEXPECTED（语义可优化）且不挂 runMain，主流程异常将退化为原生堆栈 exit 1 无 ERROR_JSON | g3/a3#说明5 + g3/a4#说明4（合并） | fix（T3 6fc9624） |
| S21 | G3 | `check-artifact-gate.ts:329-341`、`check-run-log.ts` | 文件存在性校验先于重复 flag 检测的掩蔽现象（顺序设计，前置满足后检测生效） | g3/a4#说明3 | defer |
| S22 | G3 | `docs-consistency.ts:655` | 未知 `--*` flag 静默丢弃，与 l0-link-audit「未知→ARG_INVALID」口径不一致 | g3/a4#说明5 | fix（T3 6fc9624） |
| S23 | G3 | `__tests__/metrics-report.test.ts:101-140` 等 | CLI 测试只断言 exit 码+stderr，未断言 stdout ERROR_JSON 结构（结构性断言缺口） | g3/a3#说明6 | defer |
| S24 | G3 | `check-bdd-model.ts:99-104`、`wm-export-evidence.ts:38-45` | 重复 flag 由自有 validateArgs/长度兜底拦截（合规；原报告列「次要」故计入 G3 去重前账） | g3/a1#说明 | defer |
| S25 | G4 | `logic/run-log-logic.ts:348-349` | 注释引用旧函数名 isLegacyIdentitySchemaFailure（现名 isLegacySchemaFailure），纯注释陈旧 | g4/a1#发现2 | fix（T4 bf20d93） |
| S26 | G4 | `schemas/run-log.schema.json:259-266` | fixedLocation/fixBasedOn 声明「审计用」但无任何消费方/强制 | g4/a1#发现8 | defer |
| S27 | G4 | `schemas/run-log.schema.json:216-220` | acknowledgedDecisions 语义由 checkpoint 门实施，schema description 未注明分工 | g4/a1#发现9 | defer |
| S28 | G4 | `schemas/gate-log.schema.json:12` | script enum 仅 3 个 producer，与 data-models.md:966 泛指措辞不完全对应（当前一致） | g4/a3#说明7 | defer |
| S29 | G4 | `schemas/rtm.schema.json:30` | rows[].coverageStatus 裸 string，宽于消费方三值联合类型（展示用，影响小） | g4/a3#说明8 | defer |
| S30 | G4 | `infrastructure/schema-loader.ts:88-93` | validateBySchema 未注册名静默返回 invalid（现无错名，有拼写旁路隐患） | g4/a4#说明2 | defer |
| S31 | G4 | checkpoint-log/event-ingress/hill-climbing-report 三 schema | fixture-only 无运行时消费方，仍进共享 Ajv 严格实例（strict 违规恐波及全 CLI，未实测） | g4/a4#说明3 | defer |
| S32 | G4 | `cli/check-state-machine-consistency.ts:66` | 读 JSON 但无对应 schema（「无 schema」设计确认项） | g4/a4#说明4 | defer |
| S33 | G5 | pre-push :171-177 等 | 解析边界（5 字段 extra、空行、无换行尾、大写 hex、双全零、tab/CRLF）实现正确但零测试钉死 | g5/a1#发现1 | defer |
| S34 | G5 | `pre-push:212-216` | 新分支「merge-base 可证明但 git diff 失败」分支无测试 | g5/a1#发现2 | defer |
| S35 | G5 | `pre-push:89` | 「IFS 空白分隔」注释不精确（IFS=' ' 不拆 tab，安全向） | g5/a1#发现3 | defer |
| S36 | G5 | `pre-push:133-153` | 新分支排除集依赖 tracking 新鲜度（stale 只多包含不减少，安全向） | g5/a1#发现5 | defer |
| S37 | G5 | `pre-push:393-395` | E404 上下文行须自带 npm 前缀（丢失前缀时保守阻断，安全向） | g5/a2#说明2 | defer |
| S38 | G5 | `pre-push:394` | registry 不支持 audit 的另类措辞不入可跳信号（安全方向，可不改） | g5/a2#说明4 | defer |
| S39 | G5 | `pre-push:39-66` | Windows 兼容入口与纯 Windows exit 0 放行分支零测试（真实 cmd 下不可达，形式性放行） | g5/a4#说明10 | defer |
| S40 | G5 | `CONTRIBUTING.md:161` | 触发路径列举遗漏 .gitignore/.eslintsecurity-baseline.json（实现更宽=安全方向） | g5/a4#说明9 | defer |
| S41 | G5 | stdin CRLF/audit 退出码 0/2/3 | 其余安全向盲区（CRLF 致 fail-closed、audit 退出码路径无测试） | g5/a4#说明10 | defer |
| S42 | G6 | `change-scope.ts:226-257` | untracked 工作树文件计入实际变更集合（严格精确语义，非缺陷；scope 文件宜放项目根外或 gitignore） | g6/a1#F4 | defer |
| S43 | G6 | `check-opsx-artifacts.ts:90-96` | specs/ 仅校验目录存在，空目录通过（低风险，与 archive 口径一致） | g6/a3#说明2 | defer |
| S44 | G6 | `check-opsx-artifacts.ts:124-159` | legacy 全扫描层仅 self-test 引用存活，新调用方误 import 即回归混扫，建议 JSDoc 明示禁用 | g6/a3#说明3 | defer |
| S45 | G6 | `command-reference.md:389` vs 战役反例 a 措辞 | 双 active 目录「精确选择其一 exit 0」与战役「期望失败」措辞张力，行为与文档一致，需文档层澄清 | g6/a3#说明1 | defer |
| S46 | G6 | `check-artifact-gate.ts:545 vs :475-488` | --json 模式输出不含 external summary（GATE_JSON 才有），编排消费建议补齐 | g6/a4#O1 | fix（T5 a6e898e） |
| S47 | G6 | `check-openspec-archive.ts:182-187` | 多匹配失败消息不逐项回读日期前缀、不列非法日历日（纯展示层） | g6/a4#O3 | defer |
| S48 | G6 | `check-codegraph-queries.ts:274-279` | querySymbol 相关性不校验（盲区非缺陷，文档契约未要求） | g6/a2#建议 | defer |
| S49 | G7 | `docs/troubleshooting.md:90` | 硬编码「1300+ 用例」与「以当前命令输出为准」哲学冲突（实测 1509） | g7/a4#说明6 | fix（T6 9bed229） |
| S50 | G7 | `docs/api/media/AGENTS.md:37` | 旧快照「20 份」schema 计数（现 25），非活体未被门禁覆盖 | g7/a4#说明7 | defer |
| S51 | G7 | `check-samples-coverage.ts:46` | `.w-model`/`states` 全局豁免：28 个嵌套 fixture 数据文件不参与核对，仅 sampleDir 整树兜底 | g7/a3#说明1 | defer |
| S52 | G7 | `check-samples-coverage.ts:68-109` | 提取引用的正则对 run 函数/join 写法敏感（fail-safe 向误报），新自测须字面量写法 | g7/a3#说明2 | defer |
| S53 | G7 | `command-reference.md` | 不声明 run-log action 枚举（无强制点，设计边界，可补「以 schema 为准」） | g7/a2#说明① | defer |
| S54 | G7 | targetKind 检查覆盖面 | 覆盖 4 活体+6 设计文档，不扫 data-models/hard-constraints 等（今日全仓 0 命中，无风险） | g7/a2#说明② | defer |
| S55 | G7 | `logic/run-log-logic.ts:28` | 类型保留 file/testcase legacy 值属有意设计（有注释），不应按废弃标记处理 | g7/a2#说明③ | defer |
| S56 | G8 | `examples-contract.test.ts:174,:180,:525-528` | 禁词正则三份拷贝，改 LINE_PROHIBITION 需三处同步（建议随 F-G8-01 去重为单源） | g8/a1#线索 + a2#说明 | fix（T8 e3bb923） |
| S57 | G8 | `examples-contract.test.ts:584` | 断言不隔离 marker 分支（删「完整普通失败链」仍经 hasRFirstRouting 放行） | g8/a2#说明 | fix（T8 e3bb923） |
| S58 | G8 | `examples-contract.test.ts:205-207,:342-343` | isIngestionException 贪婪 `.*` 与段落级 adjacentContext（±1 段）豁免偏宽（潜在盲区） | g8/a2#说明 | defer |
| S59 | G8 | `run-log-logic.test.ts:1326-1340` | 黄金文件字节/length 14125/sha256 自指断言（字节变异有力、语义真空、rebaseline 脆弱） | g8/a1#反例2 | defer |
| S60 | G8 | `phase-doc-map.test.ts:21` | 断言常量刻意缺 phase 5（有效守卫但脆弱） | g8/a1#说明2 | defer |
| S61 | G8 | `docs-consistency-logic.test.ts:2817` 等 | 多处用例经模块级 helper 间接断言，存在「用例与 helper 同源写错」风险 | g8/a1#说明3 | defer |
| S62 | G8 | `state-write-logic.test.ts:402,652,720,793`、`wm-write.test.ts:103,231` | 活锁制造用 new Date().toISOString() 与 60s stale TTL 墙钟比较耦合（>60s 停顿才翻转，概率极低） | g8/a3#说明 | defer |
| S63 | G8 | `check-opsx-artifacts.test.ts:181,198`、`check-openspec-archive.test.ts:184` | scopeCreatedAt 用 new Date() 输入非确定，但两 CLI 不读该字段，断言不依赖墙钟（无害佐证） | g8/a3#说明 | defer |
| S64 | G8 | `self-test.ts:17` | 「26 个用例数组」注释实为 26 个子目录（数组 33+1），措辞不精确 | g8/a4#汇总 | fix（T8 e3bb923） |

## 3. 账目：去重前 → 去重后映射（闭合「M 数去重映射未记录」缺口）

### 3.1 分域映射表

| 域 | 去重前子报告条数（I / M / 说明，按子报告自报档位实列） | 去重后（I / M / 说明） | 映射与差异说明 |
|---|---|---|---|
| G1 | 6I + 9M + 若干说明 | 1I + 7M + 6 说明 | 6 条 I 级子报告条目全部并入 I-1（r1 六子主张 CONFIRMED 支撑并条）；M：a1「standalone 普通失败链」与 a2-M1 合并（9→8），a3-#5（裸短名无锚点，M）并入 I-1（8→7）。主报告 ~5M 为估计：a1 内部清单曾将逗号第三式等列说明，本目录按分档更严口径保留 M |
| G2 | 1I + 5M + 若干说明 | 1I + 5M + 12 说明 | 无 M 级合并。r4 对账「M 5→3 需去重未注明」：经逐条比对，5 条 M 互不重复，主报告 ~3 系估计偏差而非合并结果（本目录裁定 5 条独立立项） |
| G3 | 4I + 13M + 若干说明 | 3I + 2M + 6 说明 | a1-I1 + a1-I2 + a3-#2 + a4-M2 并入 I-3；a2-M1~M6（6 条）并入 I-4；a3-#1 = I-5（4I→3I，r4 对账「可解释（a3#2 跨 a1）」即此）；M 13→2：9 条并入 I-3/I-4，a1 的 2 条「次要」（bdd-model/wm-export 兜底合规）重分类为说明 S24 |
| G4 | 1I + 13M + 若干说明 | 1I + 13M + 9 说明 | 无域内合并；吸收 2 条跨域副本（g6-a1-F1→F-G4-04、g7-a4-#5→F-G4-08，见 §3.2）。注：a3 头部自称 5M、实列 6 条 [M]，r4 对账按 5 计（12 总），本目录按实列 6 计（13 总），差异已注明 |
| G5 | 0I + 5M + 若干说明 | 5M + 9 说明 | 无合并（a2-说明3 / a3-说明1 / a3-说明2 三条说明分别并入 F-G5-02/03/05，不计 M 账）。主报告全域行「3M」只计 a4 三个测试覆盖缺口，**漏计 a2-M（vulnerable 语料）与 a3-M（BSD `\b`）两个实现/移植性 M**，本目录补记为 5 |
| G6 | 0I + 3M + 若干说明 | 2M + 7 说明 + 1 已裁定不改 | a1 的 2M 中 F1（scopeCreatedAt）并入 F-G4-04，F2 保留为 F-G6-02；a2 缺陷 1 = F-G6-01（a4-O2 同根并注，a4 全域行「1 Major」即此条）；与主报告 ~2 ✓ |
| G7 | 0I + 9M + 若干说明 | 8M + 7 说明 | a4-#5（description 自描述）并入 F-G4-08（9→8）；r4 对账「9 vs 7」：主报告 ~7 差的 1 条即此跨域并条，其余 8 条经查互不重复 |
| G8 | 0I + 8M + 若干说明 | 7M + 9 说明 | a1-M 与 a2-M4 为同一常量重复的两个视角，合并为 F-G8-01（8→7，主报告 7 ✓）；self-test 分项子报告定说明级，r4-M8 抽样定 M CONFIRMED，按复核优先计入 M（故去重前记 8 而非 7） |
| **合计** | **12I + 65M + 说明若干** | **6I + 49M + 64 说明 + 1 已裁定不改** | **0 Critical 维持不变** |

### 3.2 逐条合并关系

1. **F-G1-01 (I-1)** ← g1-a1#§2-F1、F2 及 I 类2（F3+F4）+ g1-a2#§三-反例1（a2-I-1）+ g1-a3#§二-F1(#1)、F2(#2)、F3(#3)、F5(#4)、F6(#5，M 并入) + g1-a4#§二-1,2；复核 r1-verdict（6 子主张全 CONFIRMED）。
2. **F-G1-03** ← g1-a1#§4-M（standalone）+ g1-a2#M-1 + g1-a3#§一-4（线索核实）+ g1-a4#§二-4。
3. **F-G2-02** ← g2-a2#发现1（CE17）≡ r2-verdict#M-b（同一条，非两缺陷）。
4. **F-G2-03** ← g2-a4#发现6（汇总表 #10）≡ r2-verdict#M-a。
5. **F-G3-01 (I-3)** ← g3-a1#I-1、I-2、M-1、M-2 + g3-a3#C2、#2 + g3-a4#M2（--phase 双策略）+ r3-verdict（含 plan-chunks 报错值不一致佐证，随本条修复）。注：g3-a3#C2 提及的 artifact-gate/design-contract「未知 flag 静默」面由 g3-a4 反例 1 部分缓解（C 族值 flag 重复实测均被拒），权威清单为 a1 的 8 入口。
6. **F-G3-02 (I-4)** ← g3-a2#M1、M2、M3、M4、M5、M6（6 条全部并入）+ g3-a1#I-2（根因部分）。
7. **F-G3-03 (I-5)** ← g3-a3#C1、#1。
8. **F-G3-05** ← g3-a4#§五-1（M）+ g6-a1#F5（说明并入；取 M，严重度有分歧已标注）。
9. **F-G4-04** ← g4-a2#F1（A1/A2 反例）+ **g6-a1#F1**（CA-m，跨域并条，G6 账 −1）。
10. **F-G4-05** ← g4-a2#F2（B4 反例，M）+ **g6-a1#F6**（说明并入；取 M，严重度有分歧已标注）。
11. **F-G4-08** ← g4-a3#核心1 + **g7-a4#发现5**（跨域并条，G7 账 −1）+ r4-verdict#M3（17/17 精确复现；g4-a3 的 22/22 系含 defs 口径差）。
12. **F-G5-02** ← g5-a3#M + g5-a2#说明3（a2 明示「提请 a3 合并处理」）。
13. **F-G5-03** ← g5-a4#M3（反例 4）+ g5-a3#说明1。
14. **F-G5-05** ← g5-a4#M5 + g5-a3#说明2。
15. **F-G6-01** ← g6-a2#缺陷1（d1/d2/d3）+ g6-a4#O2（同根并注，不重复立项）。
16. **F-G8-01** ← g8-a1#反例1（M）+ g8-a2#M4（同一重复的两面）+ r4-verdict#M4。
17. **F-G8-07** ← g8-a4#反例1（子报告说明级）→ r4-verdict#M8（抽样定 M CONFIRMED，复核优先升档）。
18. 说明级并条：S10 ← g2-a2#说明3 + g2-a4#发现8；S20 ← g3-a3#说明5 + g3-a4#说明4。

### 3.3 总账双口径声明（沿 VERDICT-SUMMARY §三）

- 主报告口径：0C / 6I / M 合计 ~39（G1~G8 = ~5/~3/~4/~8/~3/~2/~7/~7）——**不可由在盘 a4 单独重构**（g1/g2/g3/g4 的 a4 缺全域 C/I/M 行）。
- r4 对账口径（子报告自报求和）：~62（G4 取 a3 头部 5、G5 取全域行 3、G8 取 7）。
- 本目录逐条实列口径：**65 M 级条目 → 去重后 49 M**；与 ~62 的三点差异：G4（a3 头部 5 vs 实列 6）、G5（全域行 3 漏 a2/a3 各 1 个 M）、G8（self-test 分项经复核升 M）。本节即「去重映射未记录」缺口的闭合记录，后续修复战役以本目录 49 M 为准。

## 4. 反例盲区汇总（各报告「反例盲区提示」去重后 9 条）

1. **examples-contract 扫描器变体面**（G1/G8）：FAILURE_SIGNALS/DIRECT_ACTIONS 词表外措辞（「未达标」「返回起点重做」）、R-first 三要素旁路、`hasCompleteOrdinaryFailureChain` 全变体与 :584/:602 parse 级用例未逐一枚举；isIngestionException 贪婪 `.*` 跨句跨段豁免边界、fenced 块 `/wm test` 折行解析未做变异验证。
2. **l0-link-audit 解析面**（G1）：ref-def 反例仅覆盖「后随其他行」「平衡括号」两类；`)>` 与 `#`/`%` 混合、全角括号未穷举；POSIX 路径解析差异未复测；改「按组件解码」须同步 L0_BASELINE（650 将漂移）。
3. **G2 门禁组合面**：--gate-logs 目录实体破坏路径未实跑（仅代码论证）；R8-3 反模式 #18 未 CLI 复跑；--auto-trigger 与 run-log 交叉 phase 核对未覆盖；checkpoint 阶段 5-8 决策未覆盖；preventive「passed=false+findings」放行语义正例未 CLI 复验；strict phase-8 跨 reportId 借用证据未 CLI 级验证。
4. **G3 参数形态边界**：openspec-archive/opsx-artifacts 重复 flag 未逐一实跑（同构推断）；`--phase` 缺值（argv[i+1] undefined）形态未测；阶段 5-8「--phase 与 scope 冲突→ARG_INVALID」需真实 change-scope 项目夹具未构造；FILE_READ（EACCES）Windows 难构造；--phase=N 前导零/超大数边界未逐脚本验证。
5. **G4 scope/schema 深水面**：scopeCreatedAt 完全不可解析（Date.parse=NaN）时 :318 比较的静默行为未验证；Windows 盘符+反斜杠在 pattern 与 TS 层的拦截顺序未验证；strict-mode 违规 schema 文件波及共享 Ajv 实例未实测（触碰只读红线）；rootcause-report 深层嵌套 additionalProperties 专项反例未做；event-ingress/hill-climbing-report 无运行态消费方，字段漂移仅 self-test 可捕获。
6. **G5 hook 环境面**：禁真实 npm audit，某版本 npm 网络错误文本/退出码全集未实测；--json 解析路径未覆盖；文件名含换行极端场景、`docs/.md` 空串匹配为无害放向；非 ASCII 文件名 quotePath 实际行为未复测（仓库 0 非 ASCII 文件名）；audit 退出码 0/2/3 路径无测试。
7. **G6 Git 绑定边角**：git 二进制从 PATH 移除场景未构造（仅非仓库目录覆盖）；薄封装 --base/--head 指向非 commit 对象（blob SHA）未实测；targetFiles 大小写归一（Windows 大小写不敏感）未做；phase 8 archive×gate 端到端未覆盖（设计取舍）。
8. **G7 门禁自健壮性**：checkGlossaryAction 区间截取在 conventions 节位置变化时的健壮性未测；checkScriptRegistry 子串语义的偶然命中漏报风险与「doc 表行→file」正向锚定缺失；sampleDir 指向空目录/子结构改名、嵌套 `.w-model` fixture 被删场景未构造；矩阵「对应 check 脚本」列与 pre-push 项联动未验证；provenance 篡改仅实测 commitSha 维度（hash/runId/路径逃逸由既有测试覆盖）。
9. **G8 测试强度面**：未做改造式变异测试（只读铁律），「真空」推断基于静态证据+通过路径实跑；wm-write flake 当次 diff 未捕获、run-sync 2s 上限在极端 CI 的真实溢出未实测、活锁 60s 阈值翻转未实测；全量仅单次独占（「本次绿」不构成无 flake 证据）；self-test 262 的样本语义正确性未逐条人工核对。
