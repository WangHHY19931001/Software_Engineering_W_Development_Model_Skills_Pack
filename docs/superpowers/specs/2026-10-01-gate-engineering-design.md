# 批次 3：门禁工程（B1 subject/fixHints + B2 字节绑定 + B3 fixRecommendation scope + 同期四项）设计规格

> **日期**：2026-10-01
> **状态**：设计已获批（四节分节展示经用户裁定），文档先行（D10）——实现分支待批次 1 合并后开启
> **来源**：批次总纲 §4 跨批次契约 + 批次 1 复核事实 + 五项裁定（D6-D10，见 §3）
> **前置依赖**：**批次 1（feature/batch1-sdmap-anchors，16 提交）必须先合并**——本批消费其 `ChangeClassification`/`classification`/`sdmapViolations`/`sdAnchorCheck` 地基；总纲 §5.1 的延后项登记亦随批次 1 合并到达 main

---

## 1. 背景与动机

总纲 §4.2/§4.3 锁定批次 3 = StructuredViolation 扩展（subject/fixHints）+ GATE_JSON/签名链字节绑定 + fixRecommendation scope 字段。批次 1 复核实证的缺口：①签名链 sigHash 只绑路径清单不绑内容（`signature-chain-logic.ts:119-124`，R6 重算公式无哈希位）；②主门禁 GATE_JSON 无被验文件哈希（`check-artifact-gate.ts` grep sha256 零命中）；③R 报告修复建议无范围约束字段（`root-cause-logic.ts:110-115` 四字段）；④门禁诊断无符号级 subject 与修复建议字段——R 根因定位与 S-fix 只能解析自由文本。

另外总纲 §5.1（随批次 1 合并到达）登记了四项「批次 3 同期落地」项，纳入本批（§6）。

## 2. 范围与边界

**本批做**：B1（四热点门禁 subject/fixHints 填充）、B2（sigHash v2 版本化 + GATE_JSON verifiedArtifacts）、B3（fixRecommendation.scope 强制）、同期四项、配套 schema/文档/术语/CHANGELOG。

**本批不做**：gate-log↔签名链跨文件对账（gate-log 无索引机制，v2 的「声明 vs 真实字节」自动核查留待后续，见 §4.1 增益边界）；glob 语法深验（scope 项只查非空字符串）；budget/maturity 等非热点门禁的 subject/fixHints 填充（后续批次渐进）；批次 2/4/5 内容。

## 3. 已裁定决策（D6-D10）

| # | 决策 | 裁定 |
|---|---|---|
| D6 | B2 签名链边界 | **C：sigHash 公式版本化**（v1\|v2 分流，v2 纳入内容哈希；历史 v1 链零破坏） |
| D7 | B1 填充面 | **A：四热点门禁先行**（artifact-gate SDMAP / design-contract / code-tla / verifier-output） |
| D8 | B3 scope 形态 | **A：双数组 `{allowed?: string[], forbidden?: string[]}`**（可选声明语义随 D9 收紧为强制存在） |
| D9 | B3 校验强度 | **B：强制存在**（R4 扩展：每条 fixRecommendation 必带 scope；存量 samples/rootcause 全补） |
| D10 | 分支策略 | **C：文档先行**（本规格+计划提交 main；实现分支待批次 1 合并后自 main 开启） |

## 4. B2 详细设计（sigHash v2 + verifiedArtifacts）

### 4.1 sigHash v2 版本化

- `SignatureChainEntry` 增 `sigHashAlgo?: 'v1' | 'v2'`：**字段缺失按 v1**——历史链按 v1 公式重算，零破坏。
- `SourceArtifact` 增 `sha256?: string`（64-hex；v2 链必填，v1 链忽略）。
- v2 公式：`sha256(sigId|phase|role|action|runId|artifactsV2|prevSigHash|signedAt|signer|inputProvenance)`，其中 `artifactsV2 = JSON.stringify({ artifacts, sourceArtifacts })`（两产物清单整体、含 sha256，纳入公式）；`computeSigHash` 按 `entry.sigHashAlgo ?? 'v1'` 分流。
- 校验器（check-signature-chain / signature-chain-logic）：
  - R6 按 algo 分流重算（v1 条目行为与现状逐字节一致）。
  - 新规则 **R11**：`sigHashAlgo === 'v2'` 的条目，`inputProvenance.sourceArtifacts[]` 每条 `sha256` 必填且匹配 `^[a-fA-F0-9]{64}$`。v1 条目不触发 R11。
- schema：`w-model-dev/schemas/signature-chain.schema.json`——SourceArtifact 增 `sha256`（可选，64-hex description）、条目层增 `sigHashAlgo`（enum v1|v2，可选）；两处 `additionalProperties: false` 强制先改 schema。
- **增益边界（知情声明，D6 已裁定接受）**：v2 使「字节声明」不可抵赖（篡改声明字段→R6 重算失败）并为未来自动核查铺路；「声明 vs 真实字节」的自动核查需 gate-log 索引基建，本批不建、登记后续。

### 4.2 GATE_JSON verifiedArtifacts

- `JsonReport`（lib/types.ts）与 `gate-log.schema.json` 增可选 `verifiedArtifacts?: Array<{ path: string; sha256: string; bytes: number }>`——语义：本次门禁判定承重的输入文件字节清单（消费前可复验「门禁验的与消费的是同一字节」）。
- 四热点门禁填充（与 B1 同面）：
  - check-artifact-gate：rtm.json / graph.json / tickets.md 等判定承重输入（复用 M07 E2 的 `sha256OfFile` 先例）；
  - check-design-contract-consistency：设计文档对；
  - check-code-tla-consistency：manifest / graph / rtm 三输入；
  - check-verifier-output：被验 VerifierOutput JSON 单文件。
- 消费契约：`signature-chain-guide.md` 新节——下游 v2 签名的 `sourceArtifacts[].sha256` 从上游 GATE_JSON `verifiedArtifacts` 抄录（存在时）；无上游清单的来源按磁盘现算。

## 5. B1 详细设计（subject/fixHints）

- `lib/types.ts` `StructuredViolation` 增 `subject?: string`（符号/位置，面向修复者 LLM）与 `fixHints?: string[]`（≤3 条祈使句）——总纲 §4.2 路线兑现；只增可选、既有字段不动。
- 四热点填充映射：

| 门禁 | subject | fixHints 来源 |
|---|---|---|
| check-artifact-gate（SDMAP-1..5 + verifiedArtifacts） | `SD-<id>` / `rtm[REQ-x].codeModule`（field 值升级为符号语义） | 每规则 1-3 条固定话术（常量表，照 archify 修复话术表先例） |
| check-design-contract-consistency | `<uatPath> → <routePath>` | 从现有 message 内嵌修复指引抽出为结构化数组 |
| check-code-tla-consistency（四维度） | 维度 1=SD id / 2=transitionKey / 3=action 名 / 4=invariant 名 | 按维度固定话术 |
| check-verifier-output | `subCriterion.name` | 按失败形态固定话术（如 score<0.70 → 补 evidence 定位后重评） |

- 消费契约：`root-cause-locator.md` §4.4 扩展——R 引用 subject 定位根因；reworkHints 按 classification 排序（批次 1 已立）并转写 fixHints（至多 3 条）。
- 文案前缀兼容约束（批次 1 先例）：既有依赖文案子串的断言（self-test 等）逐一保留前缀。

## 6. B3 + 同期四项

### 6.1 B3：fixRecommendation.scope 强制

- `rootcause-report.schema.json`：fixRecommendation.items 增 `scope`（object：`{allowed?: string[], forbidden?: string[]}`，**进入 items.required**，至少一侧非空数组，每项非空字符串——不做 glob 语法深验）；description 同步「R4 强制：范围声明，V scoped re-review 对照消费」。
- `root-cause-logic.ts` R4 扩展：每条 fixRecommendation 必带合规 scope（缺失/空双数组/非字符串项 → R4 违规）。
- `samples/rootcause/` 存量 fixture 全量补 scope（硬切，对齐 D9）。
- 消费契约两处：`subagent-delegation.md` scoped re-review 节（fix diff 触碰 forbidden 或超出 allowed → 该 finding NOT ADDRESSED / 上报 CHECKPOINT）；`root-cause-locator.md` Schema 节（scope 撰写指引：allowed=允许触碰面、forbidden=禁改面如测试/语义/证据）。

### 6.2 同期四项（总纲 §5.1）

1. `check-state-machine-consistency.ts` CLI `differences` 透传（printJsonReport 手写清单增键）+ `root-cause-locator.md` differences 消费句。
2. SDMAP-5 结构化：`checkCodeModuleFormat` 产出 structuredViolations（rule `SDMAP-5`、classification `semantic`、subject=条目 raw）并入 `sdmapViolations`。
3. 双实现一致性 property 测试：新测试文件，表驱动生成 (graph, rtm) 组合，断言 checkArtifactGate SDMAP structured 集合 ≡ checkCodeTlaConsistency 维度 1 集合（按 rule+subject 投影相等）。
4. `state-machine-logic.ts` differences[].classification 改引用 `ChangeClassification` 权威类型（type-only import，纯函数层先例已有）+ sharedTransition 救场路径用例。

## 7. 实施顺序与同步面

1. SSoT 先行：§10.8 签名链节（v2/R11）、§10L 或对应节（subject/fixHints 诊断面）、RTM/根因相关节（scope 强制）——实现时定位精确节号。
2. schemas 三处：signature-chain / gate-log / rootcause-report。
3. 机制层：lib/types.ts（subject/fixHints/verifiedArtifacts）→ signature-chain-logic（v2+R6 分流+R11）→ root-cause-logic（R4 scope）。
4. 四热点门禁填充（B1 映射表 + verifiedArtifacts）。
5. 同期四项。
6. 文档：signature-chain-guide / root-cause-locator / subagent-delegation / command-reference（check-signature-chain R11、check-rootcause-report R4-scope、四热点 subject/fixHints）/ conventions 术语表（subject/fixHints/verifiedArtifacts/sigHashAlgo）。
7. samples：rootcause 补 scope（硬切）；signature-chain 新增 v2 正/负样本（R11）。
8. CHANGELOG 42.7.0 + prepush 收口。

## 8. 测试与验收判据（批次 3 DoD）

1. v1 兼容：既有 signature-chain 样本（无 sigHashAlgo）全部按 v1 重算全绿——零破坏实证。
2. v2 正/负样本：v2+sha256 齐全过 R11；v2 缺 sha256 → R11 违规；篡改 v2 条目 sha256 字段 → R6 抓获。
3. R4-scope：缺 scope/空双数组/非字符串项三类负向各一；存量 samples 补齐后 self-test 全绿。
4. 四热点门禁：subject/fixHints/verifiedArtifacts 快照断言（每门禁至少 1 正例）；文案前缀兼容断言不破。
5. property 测试：表驱动组合下双实现集合等价。
6. docs-consistency / check-samples-coverage / eval / prepush 全绿收口。

## 9. 风险与已知代价（已裁定接受）

- v2 链签名方负担：签名时须读盘计算 sha256（每来源一次）。
- R4 强制 scope：R 子代理产出摩擦增大（每条修复建议须思考范围声明）——D9 裁定接受。
- verifiedArtifacts 覆盖面限四热点：其余门禁的清单为空缺省（键可选）。

## 10. 仓内证据锚点（实施定位）

- `w-model-dev/scripts/logic/signature-chain-logic.ts:119-124`（computeSigHash 现公式）、`:342-353`（R8 磁盘存在性）、规则号现排 R1-R10
- `w-model-dev/schemas/signature-chain.schema.json:77-96`（InputProvenance/SourceArtifact，additionalProperties:false）
- `w-model-dev/schemas/gate-log.schema.json:8`（required 六键）+ `lib/gate-log-writer.ts`（schema 校验落盘先例）
- `w-model-dev/schemas/rootcause-report.schema.json:15-19,194-198`（fixRecommendation 必填与 items）
- `w-model-dev/scripts/logic/root-cause-logic.ts:110-115`（fixRecommendation 形状）、`:391`（R4 现状）
- `w-model-dev/scripts/lib/types.ts:11-20`（StructuredViolation 含 classification）、`gate-report.ts:49-63`（violations 分布）
- `w-model-dev/scripts/cli/check-artifact-gate.ts`（M07 E2 sha256OfFile 先例 :99-123；verifiedArtifacts 接线点：rtm/graph/tickets 读取处）
- 批次 1 先例：`check-artifact-gate.ts` SDMAP structured（subject/fixHints 扩展点）、`state-machine-logic.ts` differences（同期项 4 挂钩点）
