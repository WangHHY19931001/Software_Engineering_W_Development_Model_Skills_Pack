# 批次 2 设计规格：设计期未决问题（A3 设计期迷雾登记册 + A4 可选能力≠运行时边）

> **日期**：2026-10-02
> **状态**：已裁定（D1-D5，见 §7），待用户审查后进入实现计划
> **来源**：13 来源吸收批次总纲（[2026-09-30-absorption-batches-master-outline.md](./2026-09-30-absorption-batches-master-outline.md)）批次 2；机制蓝本 = 阶段 1 迷雾登记册（[2026-07-30-round27-wayfinder-fog-absorption-design.md](./2026-07-30-round27-wayfinder-fog-absorption-design.md) + `phase-1-requirements.md:147-172`）
> **前置**：批次 1、3 已合入 main（42.7.0）。本批次改动面与其不相交（总纲 §2）。

---

## 0. 问题定义

- **A3**：阶段 1 已有迷雾登记册（in-scope 但无法精确陈述的需求项：登记→锐利性测试→毕业三选一→CHECKPOINT 强制清空）。阶段 2-4 **完全没有**未决项登记机制——设计期的「方向已见但说不清」（依赖未定/技术不成立/边界未定/容量未知）无处可去，只能散落正文或被占位词禁令逼进沉默。探索证实：phase-2/3/4 零迷雾字样、零开放问题登记；唯一近似物是 phase-2:132 选型冲突的 decisions/ 记录（已能陈述且已选的另一回事）。
- **A4**：图硬约束「每 SD ≥1 implements」「无黑洞/奇迹/死模块」与「可选能力」（设计提及但非本次承诺的能力）冲突。现状图模型无任何可选语义（graph.schema 节点枚举 6 类、无 marker）；若可选能力被建成 SD 节点，要么被迫满足全部不变量（变相强制），要么需要豁免语义（稀释门禁）。必须给一条明文边界。

## 1. 裁定记录（D1-D5）

| # | 决策点 | 裁定 |
|---|---|---|
| D1 | A4 图内语义 | **方案 A：图内无可选语义**——可选能力不建图节点/边，只登记在设计文档层；graph-guide 明文「进入图 = 承诺为运行时事实，全部不变量适用」。不动 schema、不动 graph-logic（否决方案 B：optionalCapability marker + 门禁豁免——豁免语义稀释校验强度，且可选 SD 的 codeModule 对账义务成新难题） |
| D2 | A3 机制强度 | **文档机制 + 脚本校验**——阶段细则/模板/DoD/CHECKPOINT 披露全文档化，**另增** `check-design-fog.ts` 门禁脚本扫描迷雾册终结态（用户裁定，超出推荐面） |
| D3 | A3 毕业落点 | **三选一 + 需求级回退**：①毕业成设计项（SD/INTF/DD 正式内容+图节点）②判入非目标（§10/§8 持久拒绝登记）③需求级回退（发现是需求级未知 → 走需求规格 §11.5 迷雾毕业变更流程，用户 CHECKPOINT）。豁免审批保持阶段 1 专属（check-exemption 不扩阶段） |
| D4 | 迷雾册字段 | **复用阶段 1 四字段 + 疑点轴放宽**：fogId/fogDesc/fogBlocker/fogGroupHint 不变，fogBlocker 疑点轴扩设计期枚举；表格列与阶段 1 §8.5 同构（六列） |
| D5 | 范围 | phase-2/3/4 三阶段全量 + 三主模板 + discipline-dod×3 + graph-guide + system-architecture 表达位 + ingestion-cross 修订 + AGENTS/SSoT/subagent-delegation 登记 + samples/self-test/NEGATIVE-COVERAGE + CHANGELOG 42.8.0；**不做**：新全局反模式、schema 改动、豁免扩阶段、script 进 pre-push（项目侧门禁非仓门禁） |

## 2. A3 设计：设计期迷雾登记册

### 2.1 机制定义（写入 phase-2/3/4 阶段细则新节「设计期迷雾登记册」）

- **定义**：设计期迷雾项 = in-scope、方向已见、但**当前无法精确陈述该设计决策的问题**的设计事项（注意判据与阶段 1 同构：锐利性测试判「能否精确陈述问题」，不判「能否给出答案」——能精确陈述 → 走 ADR/decisions/ 正常决策；不能 → 入迷雾册）。
- **疑点轴（fogBlocker 设计期枚举，放宽语义不换字段）**：`依赖未定`（外部系统/团队决策未回）/ `技术不成立`（候选方案可行性存疑）/ `边界未定`（模块/接口归属拿不准）/ `容量未知`（性能/规模约束缺输入）/ `需求级可疑`（细看发现是需求本身说不清——毕业时优先分流到 ③）。
- **谁维护**（角色映射照阶段 1 分工）：准入 = S 子代理设计产出时执行锐利性测试（S-plan/S-design 角色侧）；登记载体 = 设计主模板迷雾节表格；核验 = V 评审核验毕业处置完整性 + R 预防性审查核验迷雾真实性（是否本可精确陈述却借雾逃避设计义务）；**毕业 = S 子代理在阶段收口前给出三选一处置**。
- **毕业三选一（设计期落点）**：
  1. **毕业成设计项**：补全为正式设计内容并建图节点（SD/INTF/DD 按阶段），全部图谱不变量适用（implements/信息流/锚点）；
  2. **判入非目标**：写入本阶段主模板非目标节（持久拒绝登记，永不自动复活；复活=正式变更）；
  3. **需求级回退**：判定为需求级未知（非设计层能解决）→ 走需求规格书 §11.5 迷雾毕业变更流程（用户 🔴 CHECKPOINT 确认，可能触发范围重画）。
- **CHECKPOINT 强制清空**：阶段 2/3/4 阶段门放行前，迷雾册每项必须有终结处置结果，禁止静默遗留（阶段本地判罚，见 2.4）。CHECKPOINT 展示清单追加一行「设计期迷雾登记册：N 项，全部终结 / 本阶段无迷雾项」。
- **与既有通道划界（写入阶段细则节）**：已能陈述且已选 → ADR/`decisions/` 记录（phase-2:110/:132 既有通道）；不能精确陈述 → 迷雾册；明确不做 → 非目标；明确不做需求 → 阶段 1 §8 Out of Scope。四者互斥，V 评审按此划界。
- **探索通道**：复用阶段 1 受控低仪式探索通道口径（phase-1:164-166：question-first + 捕获纪律 + 默认零持久化，探索物不入册不建图）。

### 2.2 模板落点（三主模板 + DoD）

- `templates/system-design.md`：§10「设计边界与非目标」内新增子节 **迷雾登记册**（子节编号按各模板现状顺延，**解析器按标题字面含「迷雾登记册」定位，不依赖编号**），六列表（迷雾项 ID / 模糊描述 / 疑点 / 疑似归属 / 毕业方向 / 毕业处置结果）+「本阶段无未终结迷雾项」标记行说明；fogId 命名 `FOG-P2-NN`（阶段前缀，阶段 3/4 为 `FOG-P3-NN`/`FOG-P4-NN`）；fogGroupHint 语义 = 疑似设计项归属（SD/INTF/DD id 候选）。
- `templates/interface-design.md` §8 与 `templates/detailed-design.md` §8：同款子节（`FOG-P3-NN`/`FOG-P4-NN`）。
- **禁止占位词白名单扩**（三模板 :25/:24/:23 同款规则）：「`待定` 仅允许出现在 §10 非目标显式标注」→「`待定` 仅允许出现在非目标显式标注与迷雾登记册节」。
- `discipline-dod.md`×3：新增 DoD 勾选项「设计期迷雾清空：迷雾登记册每项有终结处置结果（或标注本阶段无迷雾项）」。

### 2.3 门禁脚本 check-design-fog.ts（D2 新增，仓内第 47 个 exit-2 脚本）

- **CLI**：`npx tsx w-model-dev/scripts/cli/check-design-fog.ts --doc=<设计主文档.md> --phase=2|3|4`。`--doc`/`--phase` 单值（重复值 ARG_INVALID 走 lib/parse 既有约定）；stdout 单行 `FOG_JSON` 摘要（照 GATE_JSON 先例，printJsonReport 形态：type/passed/reasons/violations/fogStats{total,terminal,unresolved}/durationMs/exitCode）。
- **规则**：
  - **R1 节存在性**：--doc 文档内存在标题含「迷雾登记册」的节；缺失 → violation（fail-closed：无法区分「无雾」与「被删」；模板已含节，正常态节必在）。
  - **R2 表结构**：节内表格列头含六列字面（迷雾项 ID/模糊描述/疑点/疑似归属/毕业方向/毕业处置结果）；或存在「本阶段无未终结迷雾项」标记（替代空表）。
  - **R3 fogId 格式**：每行首列匹配 `FOG-P<phase>-\d{2,}` 且 phase 与 `--phase` 一致。
  - **R4 终结性**：每行「毕业处置结果」列非空且非「待定」占位；空/待定 → violation（CHECKPOINT 前未终结）。
  - **R5 标记互斥**：有「无未终结迷雾项」标记时不得同时存在数据行；有数据行时不得带该标记。
  - **R6 归档一致性（轻）**：毕业方向列若填「设计项」则疑似归属列须非空（提示性，不强校验 id 存在性——YAGNI）。
- **退出码**：0=通过（全部终结或合法无雾标记）/ 1=校验失败 / 2=输入错误（缺参/坏 phase/文件不可读；走 lib/cli-error.ts 结构化错误 ✗[CATEGORY] + ERROR_JSON）。
- **实现形态**：自包含 CLI（依赖 tsx + 本目录 lib/logic；logic 层纯函数 `checkDesignFog(markdown, phase)` 供单测）；不读 .w-model 状态、不建图。
- **登记义务清单（新增脚本全套）**：
  - AGENTS.md §8 脚本导航表新增行 + §2「46 个脚本」两处计数 → 47（含 docs-consistency exit-2 计数检查实况对齐）；
  - `subagent-delegation.md` §6 dispatch-matrix 登记行（阶段 2-4，G 角色）；
  - `package.json` 增 `check:fog` alias（照 check:verifier 先例）；
  - `self-test.ts` 新增 CASES（≥3：valid 全终结 / bad 未终结 / bad 缺节或标记互斥）；
  - `samples/design-fog/` fixtures（valid/bad 各 ≥1，真实 Markdown 形态）+ `samples/README.md` 矩阵行 + `NEGATIVE-COVERAGE.md` 登记行（exit-2 门禁负向案例登记义务）+ 探针（exit2-probe-registry 共用）；
  - `__tests__/` 新增 logic 单测（R1-R6 逐规则）+ CLI 集成测试（exit 0/1/2 三态）。

### 2.4 流程接线（phase-2/3/4 细则 + 判罚）

- 阶段门 CHECKPOINT 行（phase-2:228 / phase-3:254 / phase-4:247）：验收清单追加「G 跑 `check-design-fog.ts --doc=<主文档> --phase=N` exit 0」；展示清单追加迷雾清空披露。
- 失败模式矩阵与禁止行为表（各阶段本地）：新增「迷雾滥用（设计期）」判罚条（信号：S 借雾逃避设计义务 / CHECKPOINT 前存在未终结项 / 迷雾项被静默删除），处置走普通 V/G 失败链——**不加全局反模式**（round27:133 分层先例）。
- `ingestion-cross.md`：:113「迷雾登记册在阶段 1 已固化」修订为「阶段 1 固化**需求层**迷雾；阶段 2-4 维护**设计层**迷雾（见各阶段细则）」；A-evolve 算法步骤增「设计变更引入的新未决项登记入对应阶段迷雾册」。

### 2.5 文档对齐（机制索引与权威）

- `AGENTS.md:18` 机制索引：「阶段 1 迷雾登记册」→「阶段 1-4 迷雾登记册（需求层 + 设计层）」+ 一句 A3 摘要。
- SSoT 新增权威摘要节（仿 §10.5.3 四件套形态：目标 + 落点表 + 能力分工不夸大 + 判据披露），声明 phase-1-requirements.md 与 phase-2/3/4 细则节为分层权威。
- `subagent-delegation.md` dispatch-matrix 对应行更新（阶段 2-4 含迷雾登记册）。

## 3. A4 设计：可选能力≠运行时边（方案 A）

- **graph-guide 新节「可选能力边界」**（权威表述）：
  1. 「**进入图 = 承诺为运行时事实**」：节点/边只承载本次交付承诺的运行时结构；全部不变量（implements/defines/realizes/信息流/锚点）无一豁免。
  2. 设计提及但非本次承诺的**可选能力**（未来扩展/可选集成/降级路径）**不建图节点、不建边**，登记于设计文档：未决的入迷雾册，明确不做的入非目标，已决策暂缓的入非目标并注明决策引用。
  3. **P2（可以）≠ 可选能力**：priority 是需求排序语义（MoSCoW），范围内 P2 需求照常建 REQ/SD 图节点并承担全部不变量；两套「可选」划界声明，防混用。
  4. 可选能力后续转正 = 正式变更（走迷雾毕业①或需求变更流程），转正时按当时阶段建节点补全不变量。
- **模板表达位**：`templates/system-design/system-architecture.md` §2 规范性子系统清单与 §7 运行时架构增「可选能力（不进图）」注记位——列出名称 + 去向指针（迷雾册/非目标），并显式标注「不承担图谱不变量、不产生 codeModule 对账义务」。
- **phase-2/3/4 禁止行为**（阶段本地条目）：「可选能力建图节点/边」列为禁止（含判罚信号：图出现无 implements 意图的设计提及物）；「把非目标/迷雾项写进 §3 模块划分」同列。
- **SSoT**：§10.7 邻域补一句权威边界（图内无可选语义，A4 方案 A）；**顺带核对** SSoT:1058 evidenceAnchor「可选字段」滞后表述 vs graph.schema.json:24 required（批次 1 同族文档对齐先例，表述向 schema 对齐）。
- **不接线任何脚本/schema**：批次 1 的 SDMAP 对账与 codeModule 锚点天然不受影响（可选能力不产生 SD 节点 → 无对账义务）——这是方案 A 相对方案 B 的关键优势，写入 graph-guide 节说明。

## 4. 范围与改动面锁定

| 文件 | 动作 |
|---|---|
| `w-model-dev/scripts/cli/check-design-fog.ts` + `logic/design-fog-logic.ts` | **新增**（D2） |
| `w-model-dev/scripts/lib/cli-error.ts` 等既有 lib | 复用不改（除非 R 规则需 helper，最小化） |
| `w-model-dev/scripts/__tests__/design-fog-logic.test.ts` + CLI 测试 + `self-test.ts`（+3 CASES） | 新增/修改 |
| `w-model-dev/scripts/samples/design-fog/`（fixtures）+ `samples/README.md` + `NEGATIVE-COVERAGE.md` + exit2-probe-registry | 新增/登记 |
| `templates/system-design.md` / `interface-design.md` / `detailed-design.md` + 各 `discipline-dod.md` + `system-design/system-architecture.md` | 修改（迷雾节 + 占位词白名单 + 可选能力注记位） |
| `w-model-dev/references/phase-2-system-design.md` / `phase-3-outline-design.md` / `phase-4-detailed-design.md` | 修改（机制节 + CHECKPOINT 接线 + 禁止行为） |
| `w-model-dev/references/graph-guide.md` | 修改（可选能力边界节） |
| `w-model-dev/references/ingestion-cross.md` | 修改（:113 固化句 + A-evolve 步骤） |
| `w-model-dev/references/subagent-delegation.md`（dispatch-matrix） | 修改 |
| `docs/skill-design-document_SSoT.md`（A3 摘要节 + A4 边界句 + :1058 对齐） | 修改 |
| `AGENTS.md`（机制索引 + §8 表行 + 46→47 计数） | 修改 |
| `package.json`（check:fog alias）+ `CHANGELOG.md`（42.8.0） | 修改 |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md`（§5 表修复 + 批次 2/3 状态登记） | 修改 |

**不做**：schema 改动（graph/gate-log 等全部不动）；graph-logic/check-requirement-graph 改动；豁免扩阶段；pre-push 项扩；全局反模式新增；eval mappings 扩（B4 才涉及 eval）。

## 5. 验收标准（DoD）

1. `check-design-fog.ts` 六规则实现，exit 0/1/2 三态经单测 + CLI 测试 + self-test 实证；exit-2 结构化错误走 lib/cli-error。
2. 新脚本登记全套闭合：AGENTS §8 + 46→47 计数、dispatch-matrix、package alias、samples 矩阵、NEGATIVE-COVERAGE、probe 注册——docs-consistency / check-samples-coverage exit 0。
3. phase-2/3/4 各含「设计期迷雾登记册」节（机制/判据/三选一/划界/判罚）+ CHECKPOINT 接线行；三主模板迷雾节 + 占位词白名单扩 + DoD 勾选项。
4. graph-guide「可选能力边界」节四条权威表述在场；system-architecture 表达位在；phase-2/3/4 禁止行为条目在。
5. ingestion-cross :113 修订 + A-evolve 步骤；AGENTS 机制索引更新；SSoT 摘要节 + A4 边界句 + :1058 对齐。
6. CHANGELOG 42.8.0 + 总纲 §5 表修复与批次 2/3 状态登记；prepush 19 项全绿。

## 6. 明确不做与风险

- **不做**（防重复讨论）：§7 总纲不吸收清单不受影响；C3 指标、批次 4/5 内容不预设。
- **风险 1**：Markdown 表格解析脆性——R2 六列列头为硬约定，模板变更会破坏解析；缓解：列头字面入 spec 与模板双固定 + 探针测试钉住。
- **风险 2**：「待定」白名单扩削弱占位词纪律——范围严格限「迷雾登记册节内」，DoD 勾选项与 R4 复核处置结果列非「待定」，闭环不松。
- **风险 3**：设计期迷雾与阶段 1 迷雾语义混淆——靠 D3-③ 回退通道 + 四通道划界（ADR/迷雾/非目标/Out of Scope）+ fogId 阶段前缀区分。

## 7. 与总纲共享契约的关系

- 本批次不新增 ChangeClassification 取值、不动 StructuredViolation/GATE_JSON——总纲 §4.1-§4.3 契约零触碰；A4 方案 A 使批次 1 的 SDMAP/锚点对账面零受扰。
- 总纲 §5 状态表由本批次立项时修复（批次 1 更新遗留的孤行结构）并登记批次 2/3 状态。
