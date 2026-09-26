# 未解/延后全量清收 设计规格（2026-09-27）

> 来源：live-run-findings-remediation 批次账本（`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md`）全部 minor(deferred) 项 + CHANGELOG `[42.3.0]` 显式不修项中的「后续可选」2 项 + `docs/debug/2026-09-19` 报告 F-5。
> 用户裁定（头脑风暴会话 2026-09-27）：范围 = 账本全部延后 + 后续可选 2 项 + F-5（**减 F-6**）；处置准则 = 修复为主 + 少数销账（销账名单 8 项已批准）；结构 = 单批四组 + 终局全量 prepush。
> 执行分支：`feat/deferred-closeout`（Task 0 建分支，禁直接改 main）。

## 1. 范围与显式不修

**纳入**：A 账本延后 minor 全量（含已标「deferred→Task 8 顺手收口」但经核对未闭合者）+ B「后续可选」2 项（`check-archive-integrity` 绝对路径诊断、budget `parentDispatchId`）+ C 的 F-5（阶段 2-4 图谱正例夹具）。

**显式不修（随本批登记，理由成文）**：

| 项 | 理由 |
| --- | --- |
| F-6 真实 /wm 会话正向导出演练 | 语义上需要真实会话逐 gate 产出的测量文件，纯代码批无法替代；另约真实会话执行 |
| R5 行级证据锚阻断化 | 维持观察期：非阻断诊断上线后先积累命中数据，再评估升级（规格 §6 原裁定延续） |
| code-health Phase 5-8 迁移 | 独立子系统（SSoT §10K「未实现（不得凭步执行）」），体量差两个数量级，单独立项 |

## 2. 全局约束（沿用 2026-09-25 批次口径）

1. **SSoT 优先**：设计决策先落 SSoT，再同步 `w-model-dev/` 资产与活体文档。
2. 零 LLM 调用、脚本自包含、logic 层零 `node:fs`；新依赖面须过 `dependency-boundaries` 既有白名单。
3. **不改判据编号**：新语义并入既有规则；**新字段一律可选**（历史 fixture 零改动即绿）。
4. 不新增 schema / references / templates 文件（34 / 44 计数不变）；不新增反模式编号。
5. 每处 exit-2 门禁的负向登记变化走 `check-samples-coverage` 探针闭环。
6. **版本保持 42.3.0 不动**，CHANGELOG 在 `[42.3.0]` 节内新增「未解/延后清收（2026-09-27）」小节（先例：Wave A/B 行为增量同样登记于 42.2.1 节内，版本随批次收口统一演进）。
7. 回归纪律：`.ts` 编辑前 codegraph 查询落盘（约束 #14）；每组定向 vitest；终局全量 `npm run prepush` 19 项 + `check-docs-consistency` + `check-samples-coverage`。

## 3. 逐项处置表

> 处置图例：**修** = 本批实施；**销** = 销账（理由见 §5，CHANGELOG 登记后从延后清单除名）；**不修** = §1 显式不修。来源锚 = 账本 Task N。
> 计数（账本行合并口径，多落点单行计 1 项）：**合计 61 = 修 50 + 销 8 + 显式不修 3**。组表行数多于「修」计数属正常——核对类行（G1-7/G1-16）与多落点行在账本口径各计 1。

### G1 文档措辞面（约 25 项，全部「修」）

| # | 来源 | 项 | 落点 |
| --- | --- | --- | --- |
| G1-1 | Task 1 | 规格 §3 WS-1 判据式写 `(graph ∩ rtm)` 与实现（宽视角并集比对）不一致 | 改规格判据句为宽并集表述 |
| G1-2 | Task 2 | 活体文档写「非空(size>0)」未反映 `isFile() && size > 0` 与「非普通文件」新文案 | subagent-delegation / hard-constraints 对应句 |
| G1-3 | Task 3 | 合规降级范例 `evidencePath` 自指（指记录自身） | command-reference / phase-5-coding 范例改指真实替代制品 |
| G1-4 | Task 4 | SSoT:1751,1758（§10C）未指向 `operationalFailureModes` 真值口径 | SSoT §10C 两处 |
| G1-5 | Task 6 | `__tests__/README.md:89` 矩阵行「≤ 末条步进」未反映「< 拒绝」 | 该行改口径 |
| G1-6 | Task 6 | INSTALL.md:111 lib 计数 / self-test.ts:17 注释计数 / NEGATIVE-COVERAGE 头注耗时句 三处漂移 | 逐一订正（注释/文档，非门禁面） |
| G1-7 | Task 7 | doc 两处「向前逐条验证」vs 实现向后扫描（核对 Task 8 是否已顺手收口，未则修） | data-models / run-log-logic 注释 |
| G1-8 | Task 7 | canonicalJson doc 未写「与 JSON.stringify 同口径」；测试矩阵描述未覆盖链用例 | data-models / __tests__/README |
| G1-9 | Task 8 | data-models.md:565 未提 LEGACY 分支会输出一条诊断 | 该行补句 |
| G1-10 | Tasks 9-10 | command-reference:76 拒绝原因枚举不全（缺 TARGET_MISSING_FOR_MTIME / INVALID_JSON）+ `--json` 扩展键漏 ok/legacyInvalidLines | command-reference 补全 |
| G1-11 | Tasks 9-10 | SKILL.md:88 五门表述与 operational-recovery:447 新口径待对齐 | SKILL.md 对齐 |
| G1-12 | Tasks 9-10 | operational-recovery:456 表内自指「不在本表」 | 措辞消除自指 |
| G1-13 | Tasks 9-10 | data-models:527 形态与新增登记未同一 | 补齐同一段 |
| G1-14 | Tasks 9-10 | CLI 头注与两 markdown 时间戳三态非逐字 | 三落点统一逐字 |
| G1-15 | Tasks 9-10 | SSoT:1923 / data-models:530 / subagent-delegation:403 / operational-recovery:487 未提 ③ 的 `auto+<N>ms` 形态 | 四处补形态 |
| G1-16 | Tasks 9-10 | 逃生口表述未提「--timestamp 需晚于末条/与载荷互斥」的文档复述点 | 核对 CLI 头注已收口，文档补复述 |
| G1-17 | Task 11 | 文档未提「提供但读取失败不出未接线诊断」 | operational-recovery / data-models 补句 |
| G1-18 | Task 11 | budget 调用表占位风格不一 | 三处表格排版统一 |
| G1-19 | Task 12 | CHANGELOG「四处例外」句不可定位 | 补四个实锚路径 |
| G1-20 | Task 12 | CHANGELOG「非静默假通过」措辞 | 精确化（区分「诊断可见」与「阻断」） |
| G1-21 | Task 12 | 引用 gitignored 账本未注明来源 | 注明「账本 gitignored，锚为路径引用」 |
| G1-22 | Task 12 | wave-b 证据 README 四处：#3 窗口标注、§3.0 标题致表格落子节、:416 clock-injected 括注、§7.2「末30行」 | docs/debug/2026-09-25-wave-b-integrity/README.md |
| G1-23 | Tasks 13-14 | conventions.md §2.1 未登记「禁双 L」 | 补登记 |
| G1-24 | Tasks 13-14 | verifier-spec.md:328 自检引文仍引改前文案 | 更新引文 |
| G1-25 | Task 11/15 | hard-constraints / subagent-delegation 中「非空(size>0)」同族表述 | 与 G1-2 同批统一 |

### G2 测试补强面（约 9 项，全部「修」）

| # | 来源 | 项 | 落点 |
| --- | --- | --- | --- |
| G2-1 | Task 4 | maturity 三态测试缺 `--json` 透出/空数组/重复值 3 条断言 | maturity-logic.test / check-maturity 相关 |
| G2-2 | Task 11 | `countSuspectedDuplicateGroups` 无直接单测 | 新增直测（含 tokens=0/缺 duration 噪声键排除，联动 G3-7） |
| G2-3 | Task 3 | `degradationReason` 全空白 与 `alternativeEvidence[i]` 空字段 两子分支无用例 | check-codegraph-queries.test 2 例 |
| G2-4 | Task 2 | artifacts 变长项缺 CLI 级断言（删 task-2-report.md 仍 exit 0） | check-coding-plan.test 子进程断言 |
| G2-5 | Task 6 | CRLF/BOM/无换行结尾 与 `--lock-timeout` 非法值用例缺失 | run-log-append / wm-write 相关测试 |
| G2-6 | Task 1 | 窄池退化解（graph/rtm 同缺 + tla 在盘）守卫用例（联动 G3-3） | iceberg-logic.test |
| G2-7 | Task 7 | 测试矩阵描述未覆盖哈希链用例（登记面） | __tests__/README.md 矩阵行 |
| G2-8 | Task 4 | NEGATIVE-COVERAGE 每行只机器校验首个锚 → 行语法扩展支持第二锚（`；` 分隔）机器校验（**向后兼容**：既有单锚行行为一字不变） | check-samples-coverage + 登记册 |
| G2-9 | Task 2 | bad-review-empty 非空 11 份文案与「唯一失败点」不一致 → fixture 注释对齐 | samples/coding-plan fixture |

### G3 代码小额面（18 行 = 修 16 + 销 2：销2 落 G3-17；G3-1 的「探测基准改 git 顶层」半项销，stat 判别半项修）

| # | 来源 | 项 | 处置 | 落点 |
| --- | --- | --- | --- | --- |
| G3-1 | Task 3 | 索引探测 `existsSync` 不区分文件/目录 | 修 | `codegraphIndexPresent` 改 stat 判别（目录/文件均可，非二者拒绝 + 诊断）；「探测基准改 git 顶层」销——无 git 工作区形态本无 git 顶层，projectRoot 基准与 e2e/降级形态自洽（销账理由并入 §5） |
| G3-2 | Tasks 17-18 | `collectRootFile` 缺 `isFile()` | 修 | 补 stat.isFunction 判别 + 测试 |
| G3-3 | Task 1 | 窄池退化解把全部 ID 报超出 | 修 | 宽视角全缺时窄池跳过比对 + 非阻断诊断（宽池无基准无从比对，不是「一致」也不是「超出」） |
| G3-4 | Task 2 | 锚诊断在 scope 未通过（exit 1 输入原因）时也打印 | 修 | 诊断打印挂 scope 解析成功之后 |
| G3-5 | Task 2 | preflight 路径裸 statSync/readdirSync 竞态可 exit 2 | 修 | try/catch + isFile 守卫（对齐 Task 2 发现 1 修法） |
| G3-6 | Tasks 17-18 | `resolveProvenanceIdentity` 注释不符实际 | 修 | 注释对齐实现 |
| G3-7 | Task 11 | 重复归账键噪声（tokens=0 / duration 缺字段计入疑似组） | 修 | 键构造守卫（tokens 有限正数才计入），诊断精度提升，退出码不变 |
| G3-8 | Wave A | `.eslintsecurity-baseline.json` 5 条 orphan 行 | 修 | 清孤儿行 + security-scan 0 新增验证 |
| G3-9 | Task 8 | 4 处「字节前缀」用户可见文案（含 check-archive-integrity.ts:27 / archive-integrity-logic.ts:189） | 修 | 文案改「记录边界前缀」（措辞，判定一字不动） |
| G3-10 | Task 8 | Part B 注释 90s/240s 不自洽；run-sync.ts:74,84 与 troubleshooting:105 仍写 1800s | 修 | 注释/文档统一新超时口径 |
| G3-11 | Task 11 | `check-budget.ts:16` usage 仍写「可选」未加接线硬线限定 | 修 | usage 补「阶段门必带 --run-log --phase=N」 |
| G3-12 | Task 2 | `TASK_ARTIFACT_RE`/`REVIEW_DIFF_RE` 与 R4 内联正则多事实源、账本路径第三处 hardcode | 修 | 抽共享常量单源（logic 内导出，CLI/测试复用） |
| G3-13 | Tasks 9-10 | `run-log-append-logic.ts:22-28` 自编号与文档编号错位 | 修 | 代码注释编号改为与文档 ①②③ 一致 |
| G3-14 | 后续可选 | `check-archive-integrity` 绝对路径诊断 | 修 | 对归档清单内含本机绝对路径的条目输出**非阻断诊断**（计数 + 交付前脱敏义务提示；不改退出码、不改动清单判定） |
| G3-15 | 后续可选 | budget Σtokens 去重字段 `parentDispatchId` | 修 | run-log schema 可选字段 + 疑似重复归账判定在场时按其精确化（legacy 缺字段维持现判定）；description 写明上界口径不变 |
| G3-16 | Tasks 17-18 | 白名单字面量两侧各一份 | 修 | 抽单源共享（evidence 两 logic 同层互 import 一方导出常量） |
| G3-17 | Tasks 17-18 | `collectExportSources` 冗余防御 | **销 #2** | §5 |

### G4 登记与夹具面（约 4 项，全部「修」）

| # | 来源 | 项 | 落点 |
| --- | --- | --- | --- |
| G4-1 | Task 2 | NEGATIVE-COVERAGE:85 行替换丢 bad-missing-ledger 锚 | 补回登记（配合 G2-8 多锚语法复核） |
| G4-2 | Task 3 | NEGATIVE-COVERAGE:84 行替换丢 bad-empty 且未点名 bad-cli-kind-without-index | 补齐两行登记 |
| G4-3 | Task 1 | SSoT「ICEBERG_VIEW_PRESENCE 取值待调测核定」 | 按代码事实定值（`iceberg-sweep-logic.ts` 现值 + 调测各阶段实测在场表） |
| G4-4 | F-5 | 样本库补阶段 2-4 图谱正例 3 份 | samples/graph/ 新增 p2/p3/p4 形态正例 + self-test GRAPH_CASES + samples/README 矩阵（正例无 NEGATIVE 登记义务） |
| G4-5 | Tasks 9-10 | 其余负向 fixture 决策文本不对称 | 统一 fixture 决策文本 |

### 销账 8 项（§5 详述理由）

| # | 来源 | 项 |
| --- | --- | --- |
| 销1 | Tasks 13-14 | O3「空泛声明」桶不可达（语义兜底，升级为显式不修项登记） |
| 销2 | Tasks 17-18 | collectExportSources 冗余防御 |
| 销3 | Tasks 15-16 | 归档快照名与目录后缀不闭合（无门禁消费） |
| 销4 | Task 2 | `--preflight=true`/拼错旗标静默忽略（既有布尔 flag 语义，全 CLI 主题不混入） |
| 销5 | Task 6 | state-write appended 口径吸收非法 JSON 历史行（与裁定 E 一致，产品无洞） |
| 销6 | Tasks 9-10 | 逃生口 `--timestamp` 互斥表述（CLI 头注已收口，文档复述归 G1-16） |
| 销7 | Task 12 | test:affected 无记录（快速车道非验收依据已成文） |
| 销8 | Task 7 | writer 比 checker 宽容无告警（产品路径不可达，checker 有牙） |

## 4. 验证策略

1. 每组完成后跑定向 vitest（组内触及的测试文件全集）。
2. 终局：`npm run prepush`（19 项）+ `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` + `check-samples-coverage` 全 exit 0。
3. 行为增量两处（G3-14 诊断输出 / G3-15 可选字段）各补正负样本或单测断言；`parentDispatchId` 在场/缺场两态均有用例。
4. 全程历史零回归：既有 2615 vitest 用例终局全绿；负载性锚（rule-loadbearing 测试）不动。

## 5. 销账理由（8 项，CHANGELOG 登记）

1. **O3 桶不可达**：`EVIDENCE_PATTERN` 的 `^` 行首锚定与 `path:` 前缀互斥是既有判据形态；令「空泛声明」可达需放宽锚定，会改变全部 evidence 判定语义、误伤正常产物。保留为 VAGUE 检查的语义兜底（无行为），升级登记为显式不修。
2. **冗余防御**：防御性分支在输入异常时给出稳定失败而非崩溃；删除属「为修而修」且降低稳健性。
3. **归档快照命名**：「目录名须以 changeId 结尾」口径无任何门禁消费（不在 R6 解析根内）；装配器命名与「阶段 8 活动位产物同源」的既有语义绑定，强改破坏同源性。
4. **布尔旗标严格化**：`--preflight=true` 与拼错旗标静默忽略是全仓布尔 flag 既有语义（`--json` 同）；全 CLI 严格化属独立主题，混入本批会放大评审面。
5. **appended 口径吸收非法 JSON 历史行**：与裁定 E「追加器只校验新增记录、legacy 历史行非阻断」语义一致；收紧会打红合法 legacy 历史追加场景，产品路径无洞。
6. **`--timestamp` 互斥表述**：CLI 头注已在 Tasks 9-10 修复轮 2 收口（可证纯注释）；剩余动作只有文档复述，归 G1-16 执行，本项无独立剩余物。
7. **test:affected 记录**：AGENTS 已成文「快速车道不得作验收依据」；为已经声明无效的通道补记录无信息增量。
8. **writer 宽容告警**：追加器写盘时链字段由追加器自身构造，调用方无法注入不匹配链字段（`--correct` 已剔除继承）；「哈希段后无哈希尾行可追加」形态在产品路径不可达，且 check-run-log 侧有牙（哈希段后未入链记录 = blocking）。

## 6. 登记落点

- CHANGELOG `[42.3.0]` 节内新增「未解/延后清收（2026-09-27）」小节：处置统计（修 52 / 销 8 / 不修 3）、销账 8 项理由（§5 全文）、显式不修 3 项（§1）。
- SDD 账本 `.superpowers/sdd/2026-09-27-deferred-closeout/`：首行身份 + 逐任务 complete + 三件套。
- 本批完成即「账本延后清单」清零：progress.md 的 deferred 项全部转为「已处置（修/销）」，无新增延后（除 §1 三项显式不修）。
