# 批次 7：形式化与图谱门禁收严（43.1.0）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 销账遗留规格 §2 全部 21 项——形式化子系统加固（恒真不变式防御/死锁指引/示例库/NEGATIVE fixtures/§0 导引）、图谱与 RTM/状态机收严（环检全 phase/pending 违规化/coverageStatus enum/status 转移校验）、批次 6 五项新增（归一化哈希/降级 human 授权/R6 首条 from==L0/gate-log 损坏两用例/D-1 收窄负例）。

**架构：** 沿用批次 6 模式——logic 层纯函数（IO 由 CLI 注入）、判据直接收紧不留兼容、fixtures 机械重写、文档级联由 docs-consistency 兜底。版本 43.1.0。

**技术栈：** TypeScript + tsx、vitest 三 project、ajv draft-07、tla2tools（Java 17）、self-test、pre-push 19 项。

**规格：** 主规格 `2026-10-06-w-model-remediation-design.md` §6 + 增量规格 `2026-10-07-remediation-leftovers-design.md` §1 机制侧/§2。

**执行纪律（每任务适用）**：预期超 6 分钟的命令一律 run_in_background（全量 vitest ≈25 分钟）并轮询；前台只跑聚焦测试/self-test/typecheck/eval/grep；不要跑 prepush（任务 15 除外）；每完成一个阶段往报告文件追加几行（前批多次因无活动失活的教训）。真机 TLC 单次 3-4 秒可前台。

---

## 文件结构（创建/修改的主要文件及职责）

| 文件 | 职责 | 任务 |
| --- | --- | --- |
| `w-model-dev/scripts/lib/reviewed-artifacts.ts` | 哈希前 CRLF→LF 归一化 | 2 |
| `w-model-dev/scripts/samples/verifier/*.json` | 登记哈希按归一化口径重算（codemod） | 2 |
| `w-model-dev/schemas/verifier-output.schema.json` + `references/verifier-spec.md` | sha256 语义改「归一化内容」 | 2 |
| `w-model-dev/scripts/logic/tla-logic.ts` | 恒真不变式启发式 + CONSTRAINT 禁用 + variableCombination basis | 3, 6 |
| `w-model-dev/scripts/samples/tla*/`、`samples/NEGATIVE-COVERAGE.md` | 五类退化解负例 | 3, 7 |
| `w-model-dev/references/tla-plus.md` | 死锁指引/cfg 更正/§14.3/示例库/§0 导引 | 4 |
| `w-model-dev/references/bdd.md` | D6 ASCII 判据/§0 导引 | 5 |
| `w-model-dev/scripts/logic/bdd-logic.ts` | L1 豁免 SKIPPED 证据 | 6 |
| `w-model-dev/scripts/logic/graph-logic.ts` | depends-on 全 phase 环检；pending → violation | 8 |
| `w-model-dev/scripts/samples/graph/` | depends-on 环负例 + pending 负例 | 8 |
| `w-model-dev/schemas/rtm.schema.json` + `logic/gate-logic.ts` | coverageStatus enum + 缺字段违规 | 9 |
| `w-model-dev/scripts/lib/constants.ts` + `logic/maturity-logic.ts`、`cli/check-maturity.ts`、`cli/wm-status-logic.ts` | 8/9 双常数统一 + status 转移校验 | 9 |
| `w-model-dev/schemas/project.schema.json` | 删 currentPhase 引用描述 | 9 |
| `w-model-dev/references/graph-guide.md` | 承诺项对齐 | 9 |
| `w-model-dev/scripts/logic/evidence-export-logic.ts` | isSensitiveKey 词段守卫取消 | 10 |
| `w-model-dev/schemas/maturity.schema.json` + `logic/maturity-logic.ts` + `cli/check-maturity.ts` | 降级 human 授权 R7 + history 迁移 | 12 |
| `w-model-dev/scripts/logic/signature-chain-logic.ts`、`__tests__/signature-chain-logic.test.ts` | D-1 收窄负例 | 13 |
| `eval/mappings.json` | 易残留锚点三条（D-1 行/词表行/退役注记行） | 15 |

---

### 任务 1：基线验证

- [ ] **步骤 1**：在 43.0.1 合入后的 main 上开 `fix/batch7-formalization-gates` 分支：

```bash
cd "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" && git checkout main && git checkout -b fix/batch7-formalization-gates && git log --oneline -1
```
- [ ] **步骤 2**：`npm run --silent typecheck && npm run --silent self-test 2>&1 | tail -1 && npm run --silent eval && npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 预期全绿（typecheck 0 / 403 / 68 / 0 违规）。任一非绿停下修基线。

---

### 任务 2：归一化哈希机制侧（规格 §1 后半）

**文件：** 修改 `lib/reviewed-artifacts.ts`、`schemas/verifier-output.schema.json`、`references/verifier-spec.md` §6.2；重登记 `samples/verifier/*.json` 登记哈希；测试 `evidence-export-logic.test.ts` 不动、`verifier-logic.test.ts`/CLI 测试按需。

- [ ] **步骤 1：失败测试**（CLI 级）：构造 `samples/verifier/README.md` 的 CRLF 副本于临时目录（同内容 + `\r\n`），fixture 登记哈希不变（LF 哈希），断言 CLI 仍 exit 0——现状会哈希失配 exit 1（RED）。
- [ ] **步骤 2：实现**——`lib/reviewed-artifacts.ts` 哈希处：

```ts
const normalizeEol = (bytes: Buffer): Buffer => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
// 哈希与行数统计均消费 normalizeEol 结果：
const digest = createHash('sha256').update(normalizeEol(bytes)).digest('hex');
const lineCount = normalizeEol(bytes).toString('utf8').split('\n').length;
```
- [ ] **步骤 3：登记哈希重算 codemod**（对 51 个 verifier fixture 的 reviewedArtifacts[].sha256 全部按归一化口径重算；幂等脚本同批次 6 任务 4 形态）+ schema description 与 verifier-spec §6.2 措辞改「归一化内容（CRLF→LF）的 SHA-256」。
- [ ] **步骤 4：验证**（聚焦 + self-test 403/403 + 步骤 1 的 CRLF 副本用例 GREEN）+ Commit `fix(verifier): reviewedArtifacts 哈希改归一化内容口径，对 checkout 行尾配置免疫（43.1.0）`。

---

### 任务 3：恒真不变式防御 + CONSTRAINT 禁用（B1 判据侧/B10 部分）

**文件：** 修改 `logic/tla-logic.ts`；新增负例 fixture；测试 `tla-logic.test.ts`、self-test TLA_CASES。

- [ ] **步骤 1：失败测试**（四个）：

```ts
it('B1a：INVARIANTS 全部为 Type 类（名字以 Type 开头）→ 违规「缺非 Type 业务不变式」', () => { /* cfg INVARIANTS 仅 TypeOK */ });
it('B1b：业务不变式定义体语法等价于 TRUE → 违规', () => { /* Inv == TRUE */ });
it('B1c：业务不变式定义体与某 TypeInvariant 定义体相同 → 违规', () => { /* Inv 与 TypeOK 同体 */ });
it('B10c：cfg 含 CONSTRAINT/CONSTRAINTS 段 → 违规「不得用约束砍状态空间」', () => { /* cfg 带 CONSTRAINT */ });
```
- [ ] **步骤 2：实现**（tla-logic cfg 一致性检查区新增）：

```ts
// B1：恒真/空洞不变式防御。业务不变式 = cfg INVARIANTS 中名字不以 'Type' 开头者。
// ①须 ≥1 条；②定义体归一化后（trim + 折叠空白）不得为 'TRUE'，
// ③不得与任一 Type 类不变式定义体相同（同规格内比对）。
// B10c：cfg 出现 CONSTRAINT/CONSTRAINTS 段名 → 违规（状态空间砍削掩盖死锁/爆炸，
// 正道是规格拆解——反模式 #16 家族）。
```
CFG_SECTION_KEYWORDS 已含 CONSTRAINT/CONSTRAINTS（批次 6 A6 补齐），检测用既有解析器。
- [ ] **步骤 3：NEGATIVE fixtures**：`samples/tla/`（或 tla-e2e）新增 `bad-only-type-invariants`、`bad-tautology-invariant`、`bad-duplicate-of-type`、`bad-constraint-shrink` 四个 manifest+cfg/tla 组合，登记 NEGATIVE-COVERAGE。
- [ ] **步骤 4：真机回归**——counter-pass 与 deadlock/invviolation 三 fixture 行为不变（pass 仍 0 / fail 仍 1 且原因不变；**注意**：若既有 valid fixture 的 INVARIANTS 恰好全 Type 类，给它补一条平凡但非 Type 的业务不变式使其继续有效，并在报告声明）。
- [ ] **步骤 5：self-test 同步 + Commit** `feat(tla)!: 恒真不变式防御（缺非 Type 业务不变式/TRUE 体/与 Type 同体）+ cfg CONSTRAINT 禁用（B1/B10c，43.1.0 breaking）`

---

### 任务 4：tla-plus.md 指南修正 + §0 导引（B1/B3/B4/B5/B6 文档侧 + B10 半）

**文件：** 修改 `references/tla-plus.md`。

- [ ] **步骤 1：死锁指引修正（B1）**：`SPECIFICATION Spec` 模板处补配套不变式模板 `NoStuckState == \A s \in States : s \in Terminal \/ ENABLED Next`（终态集合按规格命名替换）；`CHECK_DEADLOCK FALSE` 示例（Elevator cfg :2039 一带）改写为「显式豁免 + 理由登记」形态或删除；「正常软件系统不允许死锁」公理段交叉引用 NoStuckState。
- [ ] **步骤 2：cfg 指南更正（B3）**：:2104-2105/:2171-2177 的内联表达式示例改为算子名引用（`CONSTRAINT CtrBound` + 规格内 `CtrBound == counter < 100 /\ Len(buffer) <= 10`）；:1939-1949 模板的 PROPERTIES 引用改为实际存在的算子名；cfg 示例 1 的 `INVARIANTS TxLifecycle` 悬空引用修复（补定义或改引已有）。
- [ ] **步骤 3：§14.3 正例修复（B4）**：`PurgeExpiredLogs` 增加 `oldestAge' = 0` 重置；`expiredCount` 补定义或删除引用。
- [ ] **步骤 4：示例库去坏（B5）**：Elevator 补方向反转/乘客到达动作（去 CHECK_DEADLOCK FALSE）；Smokers 集合等式改可读形态；CallsServiced 补 fairness 或删活性断言。每处修复后**真机验证**（`check-tla-model` 对应 manifest exit 0）。
- [ ] **步骤 5：字段口径收敛（B6）**：全文统一 8 字段口径（:253 规范句与 :256-266 示例头对齐），删「@designIds 必填」表述（:279）或把 @designIds 纳入 REQUIRED_HEADER_FIELDS——取「文档向代码收敛」（8 字段，@designIds 降为可选注记）。
- [ ] **步骤 6：§0 分节加载导引（B10 半）**：仿 data-models §0 形态在文件头加节级加载表（按角色 S/V/G × 任务 建模/门禁/模板/示例/配置 给出「读哪些节」）。
- [ ] **步骤 7：验证**（`check-docs-consistency` + eval + 抽一个 tla 真机）+ Commit `docs(tla): 死锁指引/cfg 更正/§14.3/示例库修复 + §0 导引 + 字段口径收敛（B1/B3-B6/B10）`

---

### 任务 5：bdd.md 修正 + §0 导引 + D6 判据（B8/B10 半）

**文件：** 修改 `references/bdd.md`；`logic/bdd-logic.ts` 的 D6 提取正则（若判据落地为代码）或仅文档。

- [ ] **步骤 1：D6 ASCII 词尾判据（B8）**：文档明确「`@transitions` 行末事件名必须为 ASCII 词（`[A-Za-z0-9_]+`），非 ASCII 词尾（如中文事件名）将提取不到事件并被 D6 报 end-state mismatch」；抽查官方示例 :1132 等处按判据改写；在 bdd-logic 提取处补一条「事件名为空」的显式 violation（而非静默 mismatch）——小代码改动 + 测试。
- [ ] **步骤 2：§0 分节加载导引（B10 半）**：同任务 4 形态。
- [ ] **步骤 3：验证 + Commit** `docs(bdd): D6 ASCII 词尾判据显式化 + §0 导引（B8/B10）`

---

### 任务 6：D4 L1 SKIPPED 证据 + variableCombination 推导注记（B7/B9）

**文件：** 修改 `logic/bdd-logic.ts`（:943 豁免处）、`logic/tla-logic.ts`（:538-559）、`schemas/tla-manifest.schema.json`（若需新字段）、报告形态消费点（self-test/测试）。

- [ ] **步骤 1：失败测试**（两）：
```ts
it('B7：L1 状态机 D4 豁免输出显式 SKIPPED 证据（不再零输出）', () => { /* 断言报告含 tlaEquivalence: 'SKIPPED(level=1)' 形态字段/文案 */ });
it('B9：variableCombination >1000 kept 且无推导注记 → 违规', () => { /* manifest 无 variableCombinationBasis */ });
```
- [ ] **步骤 2：实现**：①L1 分支输出 `SKIPPED(level=1)`（JSON 字段 + 人类报告行），既有测试断言同步；②`tla-manifest.schema.json` 增可选 `variableCombinationBasis: {variables: [{name, cardinality}]}`；tla-logic 在 >1000 kept 时校验 basis 存在且 `Πcardinality === 声明值`（乘积不符 → violation），≤1000 不要求。
- [ ] **步骤 3：demo fixture**——给 eval/e2e demo 的 L1 状态机 manifest 视需要补 basis 或保持 ≤1000（核实现状再动）。
- [ ] **步骤 4：验证 + Commit** `feat(bdd/tla): D4 L1 豁免显式 SKIPPED 证据；variableCombination 须附推导注记（B7/B9）`

---

### 任务 7：五类退化解 NEGATIVE fixtures 收口（B10）

**文件：** `samples/NEGATIVE-COVERAGE.md`、self-test CASES 对账。

- [ ] **步骤 1：对账**——五类逐项核对已有承载：①恒真不变式（任务 3）②空转 Next（`Next == x' = x`——tla-logic 新检测：Next 定义体归一化后无任何 `var' =` 赋值 → violation「空转规格」；若已有则登记）③CONSTRAINT 砍空间（任务 3）④L1 规避 D4（任务 6 的 SKIPPED 断言即锁）⑤feature 缺失（批次 6 A8 已建）。
- [ ] **步骤 2：补缺**——②空转 Next 若无检测则实现 + fixture；NEGATIVE-COVERAGE 五行齐备（单门禁单行规则：tla 区扩写既有行）。
- [ ] **步骤 3：self-test 同步 + Commit** `test(tla): 五类退化解负例收口，空转 Next 检测补齐（B10）`

---

### 任务 8：图谱收严（A11/A12）

**文件：** 修改 `logic/graph-logic.ts`、`schemas/graph.schema.json`（pending 描述）、`samples/graph/`；测试 `graph-logic.test.ts`。

- [ ] **步骤 1：失败测试**（三）：
```ts
it('A11：phase=3 图 depends-on 成环 → violation（环检测不再限于 phase 1）', () => {});
it('A12a：evidenceStatus=pending → violation（放行前阻断，豁免走 check-exemption）', () => {});
it('A12b：evidenceStatus=confirmed/锚点合规 → 零违规（既有行为不回归）', () => {});
```
- [ ] **步骤 2：前置核查**——`grep -rn "depends-on" w-model-dev/scripts/samples/graph/` 盘点存量 fixtures 的 depends-on 边，确认无环（有环先修 fixture 并声明）。
- [ ] **步骤 3：实现**：①把 depends-on 的 `detectCycle` 调用移出 `if (phase === 1)` 块（:805-908 区域），全 phase 执行；②R15b 改判：`evidenceStatus === 'pending'` → violation「放行前 pending 节点须转 confirmed 或走 evidence-anchor 豁免（check-exemption）」；schema description 的 pending 承诺句同步。
- [ ] **步骤 4：NEGATIVE fixtures**（环图 + pending 图）+ 登记登记册 + **验证**（demo graph 重跑 exit 0 + 全量 graph fixtures 零意外变红）+ Commit `feat(graph)!: depends-on 环检扩展全 phase；evidenceStatus=pending violation 化（A11/A12，43.1.0 breaking）`

---

### 任务 9：RTM/状态机收严（A13/A14/C16）

**文件：** 修改 `schemas/rtm.schema.json`、`logic/gate-logic.ts`（:1687 一带）、`lib/constants.ts`、`logic/maturity-logic.ts` + `cli/check-maturity.ts` + `cli/wm-status-logic.ts`（常数统一）、`schemas/project.schema.json`、`references/graph-guide.md`；测试若干。

- [ ] **步骤 1：失败测试**（四）：
```ts
it('A13a：rtm 行缺 coverageStatus → P0 违规（不再 continue 跳过）', () => {});
it('A13b：coverageStatus 非三值 → schema 拒绝', () => {});
it('A14a：project.status 非法转移（如 需求分析→编码）→ 违规', () => {});
it('A14b：「项目完成」常数单一来源（lib/constants 导出，两消费点相等）', () => {});
```
- [ ] **步骤 2：实现**：①rtm.schema.json `coverageStatus` 加 `enum: ["100%","部分","待覆盖"]` 并入 rows.items.required；gate-logic P0 循环删 `continue` 缺字段分支改 violation；②`lib/constants.ts` 新增 `PROJECT_STATUSES`（9 态有序数组）与 `PROJECT_STATUS_TO_PHASE`（单一映射，含 display/count 双口径字段），check-maturity 与 wm-status-logic 改消费该常量；gate-logic/check-maturity 增 status 转移合法性校验（合法 = 前向链下一步 ∪ 场景 5 用户批准回退 ∪ 终态「项目完成」）；③project.schema.json 描述删 currentPhase 引用；④graph-guide 承诺项对齐（depends-on 禁环已全 phase、pending 已违规化、同层端点/横切边标注「未实现，V 人工核验」）。
- [ ] **步骤 3：验证（含 demo 项目三门重跑）+ Commit** `feat(gate)!: rtm coverageStatus enum+必填；project.status 转移校验；8/9 常数统一（A13/A14/C16，43.1.0 breaking）`

---

### 任务 10：`*_token` 盲区消除 + 防复生（决策 4）

**文件：** 修改 `logic/evidence-export-logic.ts`；测试 `evidence-export-logic.test.ts`；`samples/NEGATIVE-COVERAGE.md`。

- [ ] **步骤 1：失败测试**（四）：
```ts
it('决策4a：refresh_token/session_token/jwt_token 全部脱敏', () => {});
it('决策4b：token_count 被保守脱敏（显式声明代价）', () => {});
it('决策4c：passwordPolicy/path/durationMs 仍零误伤（既有负例保持）', () => {});
it('决策4d：mytoken（无分隔后缀）不脱敏（后缀分支 ≥6 守卫保留）', () => {});
```
- [ ] **步骤 2：实现**——`isSensitiveKey` 词段分支取消长度守卫：
```ts
// 词段命中：键的任意分隔词段等于/包含已知敏感词干 → 脱敏（词段边界本身即强信号，
// 取消词段分支的 ≥6 守卫——决策 2026-10-07#4；保守代价：token_count 类计数键被脱敏，
// 已在 NEGATIVE-COVERAGE 与本测试显式声明）。
const isSensitiveKey = (normalizedKey: string): boolean =>
  SENSITIVE_KEYS.has(normalizedKey) ||
  [...SENSITIVE_KEYS].some((stem) => stem.length >= 6 && normalizedKey.endsWith(stem)) ||
  segmentsOf(normalizedKey).some((seg) => [...SENSITIVE_KEYS].some((stem) => seg === stem || (stem.length >= 5 && seg.endsWith(stem))));
```
（`segmentsOf` 为既有分隔切分；`seg.endsWith(stem)` 覆盖 `refresh_token`→`token` 段尾命中；实现时以测试四态为准精化。）
- [ ] **步骤 3：防复生**——NEGATIVE-COVERAGE 登记 evidence-export 行扩写（变体家族 + token_count 声明）；修正批次 6 遗留的注释错例（「tokens 由精确 Set 语义保住」——T12 deferred→T15 已修则核对即可）。
- [ ] **步骤 4：验证 + Commit** `fix(evidence)!: 词段命中取消长度守卫，*_token 变体盲区消除并防复生（决策#4，43.1.0 breaking）`

---

### 任务 11：降级须 human 授权（决策 2）

**文件：** 修改 `logic/maturity-logic.ts`（新增 R7）、`cli/check-maturity.ts`（装载签名链）、`references/operational-recovery.md`、`data-models.md`；测试 `maturity-logic.test.ts`。

- [ ] **步骤 1：失败测试**（三）：
```ts
it('决策2a：level < 末条 to（降级形态）且无有效 human 审批链 → R7 blocking', () => {});
it('决策2b：降级形态 + 有效审批链（verifyMaturityApproval 通过）→ 零违规', () => {});
it('决策2c：升级形态不受 R7 影响（既有 R6 用例零漂移）', () => {});
```
- [ ] **步骤 2：实现**：①`signature-chain-logic.ts` 的 `verifyMaturityApproval` 保持导出；②`maturity-logic.ts` 新增 R7：`levelRank(level) < levelRank(last.to)` 时要求 `deps.maturityApprovalOk === true`（logic 纯函数，链校验结果由调用方注入——`evaluateTlaBddWaiver` 同款接缝）；③`cli/check-maturity.ts` 装载链（仿 check-artifact-gate 的 `loadSignatureChainIfExists`）并把 `verifyMaturityApproval(chain, maturity).ok` 注入；④operational-recovery 降级流程改写：「降级须用户在 CHECKPOINT 明确确认，O 据此落 role=human/targetKind=maturity 审批条目；无条目降级无法过闭环五门（应急处置路径=用户确认即授权）」。
- [ ] **步骤 3：fixture**——`samples/maturity/` 增 `bad-downgrade-without-approval.json`（history 末条 L2、level L0、无链）与 `valid-downgrade-with-approval.json`（配链），登记 NEGATIVE-COVERAGE。
- [ ] **步骤 4：验证 + Commit** `feat(maturity)!: 降级须 human 审批授权（R7），无授权降级 blocking（决策#2，43.1.0 breaking）`

---

### 任务 12：R6 首条 from==L0 + 资产迁移（决策 3）

**文件：** 修改 `logic/maturity-logic.ts`、`eval/e2e/demo-assets/build_workspace.py`、涉 history 的 fixtures；测试 `maturity-logic.test.ts`。

- [ ] **步骤 1：失败测试**：
```ts
it('决策3：history 首条 from≠L0 → R6 违规「完整升级链须自 L0 起步」', () => {});
it('决策3b：首条 from==L0 的切片链（L0→L1→L2）→ 零违规（迁移后形态）', () => {});
```
- [ ] **步骤 2：实现**——R6 追加第四判定 `h[0].from !== 'L0' → violation`；迁移：`build_workspace.py` maturity.json history 前插 `{from:'L0', to:'L1'}`；grep 全部含 history 的 fixtures/测试逐个迁移；e2e demo 工作区如已生成则重建（`build_workspace.py` 自带重建路径）。
- [ ] **步骤 3：验证（maturity 聚焦 + demo 三门 + self-test）+ Commit** `feat(maturity)!: R6 第四判定首条 from==L0，存量资产迁移（决策#3，43.1.0 breaking）`

---

### 任务 13：gate-log 损坏两用例 + D-1 收窄负例（新增5/6）

**文件：** 修改 `__tests__/check-run-log-cli.test.ts`、`__tests__/signature-chain-logic.test.ts`。

- [ ] **步骤 1：两用例**（CLI 级，对齐既有 spawn 形态）：
```ts
it('gate-log 非 JSON → 默认路径 R6 fail-closed exit 1', async () => {});
it('gate-log 顶层 exitCode 非 number → 默认路径 R6 fail-closed exit 1', async () => {});
```
- [ ] **步骤 2：负例**：
```ts
it('D-1 收窄：S 消费 R 且 action 为 produce（非 fix）→ R9 违规', () => {});
```
- [ ] **步骤 3：验证 + Commit** `test(run-log/sigchain): 默认路径损坏 gate-log fail-closed 两用例 + D-1 收窄负例（批次 6 终审跟进项）`

---

### 任务 14：版本 43.1.0 + CHANGELOG + 决策日志

- [ ] **步骤 1**：`npm version 43.1.0 --no-git-tag-version` + 七处同步 + skill-metadata updatedAt。
- [ ] **步骤 2**：CHANGELOG 43.1.0 节（Changed/Breaking：A11-A14 breaking 收严 + 决策 2/3/4；Fixed：B 组；Docs：§0 导引；计数影响；验证记录 prepush 占位）；decision-log 追加 rounds-49 文件（7 项决策登记 + 批次 7 裁定）+ README 表行；SSoT §10R 追加批次 7 bullet 或新 §10S（按 §10R 体例）。
- [ ] **步骤 3**：`check-docs-consistency` + eval + Commit `chore(release): 43.1.0——批次 7 形式化与图谱门禁收严（breaking）`

---

### 任务 15：prepush + 专项复跑收口

- [ ] **步骤 1**：`npm run --silent prepush`（19 项单次全绿；后台跑，记录实测耗时）。
- [ ] **步骤 2：专项复跑**——红队实验 1/2/3（同批次 6 收口形态）；恒真不变式/空转 Next/CONSTRAINT/L1-SKIPPED 四探针；fresh-clone self-test（若热修后未做过二次确认）；demo 项目 check-tla-model/check-bdd-model/check-requirement-graph 三门。
- [ ] **步骤 3**：CHANGELOG 回填耗时 + 销账核对（增量规格 §5 批次 7 的 21 项逐项勾销）+ Commit `docs(plans): 批次 7 收口——prepush 全绿 + 专项复跑（43.1.0 终）`。
- [ ] **步骤 4**：终审宽范围审查 → 合入 main → 汇报后进入批次 8 计划编写。

---

## 自检记录

1. **规格覆盖度**：主规格 §6 的 B1-B10（任务 3-7）、A11-A14（任务 8-9）、C16（任务 9）+ 增量规格 §1 机制侧（任务 2）、§2 五项（任务 3/6/10/11/12/13）——21 项全部有任务对应。
2. **占位符扫描**：无待定/TODO；所有代码步骤含目标形态；B8/B9 的「若现状已满足则登记」类步骤给出了明确判定动作。
3. **类型一致性**：`normalizeEol`（任务 2）、`evaluateTlaBddWaiver` 注入接缝形态复用为 R7 的 `deps.maturityApprovalOk`（任务 11）、`levelRank`（任务 11/12 共用）、`CFG_SECTION_KEYWORDS`（任务 3）——跨任务一致。
