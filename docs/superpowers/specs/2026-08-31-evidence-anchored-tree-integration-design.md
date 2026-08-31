# 证据支撑树方法论集成设计草案（Evidence-Anchored Tree Integration）

> **状态**：草案，供审阅。未实施任何技能资产修改。
> **日期**：2026-08-31
> **定位**：按 AGENTS.md §6「SSoT 优先」纪律，先产出设计草案；经审阅后由子代理按批次实施。
> **关联**：外部方法论「证据支撑树联合分析模式」（Evidence-Anchored Decision Tree with Upward Root-Cause Analysis）。

> **角色归位修正（v2）**：graph.json 节点由 **A 子代理**产出（SSoT §7.7 维护边界：A 产出、O 不写、S 不改图谱节点，违反命中反模式 #11）。
> 故 evidenceAnchor 由 **A 子代理在 ingestion 阶段声明**（A-chunk 提取 REQ 节点时，若该节点结论来自明确文档/用户原话/外部依赖版本则声明）；
> S 子代理产出需求规格 §4.2 时**只读 graph.json 同步呈现**，不写回图谱。下表已按此归位。

---

## 0. 结论摘要

证据支撑树方法论由 5 项成熟技术组装（苏格拉底拷问 / 决策树穷举 / 5-Why+鱼骨图根因分析 / ADR 活文档 / 三色证据状态），**其中 90% 已被 w-model-dev 现有机制覆盖且实现更强**（确定性门禁 + 退出码 + 48 条反模式 + 14 硬约束 + R 子代理 + R3 + R-iceberg + graph.json + RTM + 迷雾登记册）。

唯一定位为**真实增量**的能力：**「节点结论的产出期事实锚点（evidenceAnchor）」**——w-model 现状只在评审期（VerifierOutput.evidence）验证"评审者的证据"，缺失"产出期声明该节点结论依据什么事实"的前置显式化。

**落地范围（最小化）**：
- 改动 1：`graph.schema.json` 节点新增可选 `evidenceAnchor` 字段 + conventions 术语登记 + requirement-spec 模板增加列 + graph-logic 轻量校验。
- 改动 2：新增 `w-model-dev/references/evidence-anchored-tree.md` 方法论参照文档（含映射表 + 明确拒绝照搬的 4 点）。
- **不**新增命令、不新增门禁脚本、不新增 .w-model 状态文件、不改 eval 25 条映射、不新增 ADR 目录。

---

## 1. 改动 1：evidenceAnchor 字段（核心增量）

### 1.1 变更文件清单

| # | 文件 | 变更类型 | 内容 |
|---|---|---|---|
| 1 | `w-model-dev/schemas/graph.schema.json` | 修改 | `nodes[].properties` 新增可选 `evidenceAnchor` |
| 2 | `w-model-dev/references/conventions.md` | 修改 | 术语表新增 `evidenceAnchor` 条目（规范定义 + `_Avoid_`） |
| 3 | `w-model-dev/templates/requirement-spec.md` | 修改 | §4.2 层级节点表新增列 |
| 4 | `w-model-dev/scripts/logic/graph-logic.ts` | 修改 | 新增轻量校验 R15（仅校验"声明了则格式合法"） |
| 5 | `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 修改 | 新增对应用例 |
| 6 | `docs/skill-design-document_SSoT.md` | 修改 | §4A.1 操作行为 + §7.7 graph schema + §10A 追溯表 |

### 1.2 schema 变更（graph.schema.json）

在 `nodes[].properties` 内、`reqGroup` 之后新增：

```json
"evidenceAnchor": {
  "description": "节点结论的前提事实锚点（可选）：产出期声明该 REQ/SD/INTF/DD 节点结论所依据的事实来源，格式遵循 conventions.md 列定位约定（path:§section=statement 或 path:L42= 或用户原话/外部依赖版本）。由 A 子代理 ingestion 时声明；S 子代理产出规格 §4.2 只读同步；V 评审校验存在性。未声明不阻断（可选字段，向后兼容）。",
  "type": "string",
  "minLength": 1
}
```

**设计决策**：
- **可选**（不加进 `required`）：保持向后兼容，存量 graph.json（round23 等）不受影响；check-samples-coverage 的 fixture 无需全量回填。
- **格式复用**：直接复用 `verifier-logic.ts` 的 EVIDENCE_PATTERN（`/^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/`），不新造格式，避免第三套 evidence 格式漂移（反模式 #26/#28 同源纪律）。
- **声明者**：A 子代理（ingestion 提取时，A-chunk 对 REQ 节点的结论来源做锚点声明；A-cross 合并时保留；S 不改图谱节点，仅 §4.2 同步展示）。

### 1.3 conventions.md 术语条目

在「工程资产相关」节新增：

```markdown
### evidenceAnchor

- **规范定义**：图谱节点（graph.json nodes[]）结论的事实锚点，由 **A 子代理 ingestion 时**声明"该节点结论依据什么事实"（A-chunk 提取 REQ 节点时对来源声明，A-cross 合并保留），
  格式遵循本文件「格式约定」§2.1（`path:§section=statement` / `path:L42=statement`）；未声明时省略该字段（可选）。
  S 子代理产出需求规格 §4.2 时**只读 graph.json 同步呈现**，不改图谱节点（S 改图谱命中反模式 #11）。
  与 VerifierOutput.subCriteria[].evidence 的区别：evidence 是**评审者**证明"我核验过"的证据；
  evidenceAnchor 是**产出者（A）**声明"我依据这个"的前提，二者互补不互相替代。
- **_Avoid_**：证据锚点/sourceRef/proof（字段名固定「evidenceAnchor」；「证据」在 VerifierOutput 语境指评审证据）
```

### 1.4 requirement-spec.md 模板变更

§4.2 层级节点表新增一列：

```markdown
| 需求 ID | level | priority | reqGroup | parent | 类型 | 描述 | 验收标准 | evidenceAnchor |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | 1 | P0 | REQ-001 | — | domain | {{领域描述}} | — | {{可选: 依据文档/用户原话}} |
```

> 列尾新增、可选填；模板套用时未填留空即可，不强制。

### 1.5 graph-logic.ts 轻量校验

在既有 R1-R11 结构校验后新增 **R15**（只校验"声明了则格式必须合法"，不校验"必须声明"）：

```typescript
// R15: evidenceAnchor 格式校验（可选字段，声明了则须合法；复用 verifier-logic EVIDENCE_PATTERN 语义）
const EVIDENCE_ANCHOR_PATTERN = /^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/;
const badAnchors: string[] = [];
for (const n of g.nodes) {
  if (n.evidenceAnchor !== undefined && n.evidenceAnchor !== '' && !EVIDENCE_ANCHOR_PATTERN.test(n.evidenceAnchor)) {
    badAnchors.push(`${n.id}（${n.evidenceAnchor}）`);
  }
}
if (badAnchors.length > 0) {
  result.violations.push(`R15 evidenceAnchor 格式校验失败：${badAnchors.join('；')}`);
}
```

> 对应测试用例：
> - 合法：`REQ-001` 带 `docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）` → 通过
> - 非法：`REQ-001` 带 `登录需要密码`（无定位）→ R15 violation
> - 省略：无 evidenceAnchor 字段 → 通过（向后兼容）

### 1.6 SSoT 变更

| SSoT 位置 | 变更 |
|---|---|
| §4A.1 八条核心操作行为 | 新增一条：「产出期证据锚点声明——A 子代理 ingestion 时对可达的 REQ/SD/INTF/DD 节点可声明 evidenceAnchor 注明该节点结论的事实依据（文档§/行号/用户原话）；声明了则须符合列定位格式，由 G 门禁 R15 校验；未声明不视为缺陷；S 不改图谱节点」 |
| §7.7 graph.json schema | 节点属性补充 evidenceAnchor（引用 §1.2 schema）；维护边界注明 A 声明、S 只读 |
| §10A SSoT ↔ 实现追溯表 | 新增行：本次机制 ↔ graph.schema.json R15 ↔ conventions.md ↔ requirement-spec.md §4.2 |

---

## 2. 改动 2：reference 文档初稿

> 目标文件：`w-model-dev/references/evidence-anchored-tree.md`（新增，不替换任何现有参考）。

### 2.1 文档结构（定稿草案）

```markdown
# 证据支撑树方法论参照（Evidence-Anchored Decision Tree）

> 定位：外部方法论「证据支撑树联合分析模式」的 W 模型适配参照。
> 适用场景：**路径不确定 / 需求模糊**的决策任务（与阶段 1 迷雾登记册互补）。
> 边界：本文件是方法论参照，不是新流程——W 模型 8 阶段、CHECKPOINT、门禁脚本、反模式体系为权威流程。
> 集成结论一句话：该方法论 90% 能力 w-model 已有且更强；唯一增量 = 产出期 evidenceAnchor（见 §3）。

## 1. 方法论摘要
[原方法论四层架构 + SOP 五阶段 + 三色标签的精简版，标注哪些已由 w-model 更强覆盖]

## 2. 与 W 模型映射表

| 证据支撑树组件 | W 模型对应机制 | 复用/新增 |
|---|---|---|
| 决策树穷尽 | ingestion 子流程 + graph.json + check-requirement-graph R1-R11/R7-R14 | 复用（更强） |
| 苏格拉底拷问 | /wm analyze 需求解析步骤 1-2（歧义→暂停要用户重述） | 复用（更强） |
| 三色证据状态 🟢/🟡/🔴 | coverageStatus covered/partial/not-covered + qualityLevel A-D + outcome | 复用（枚举等价） |
| 上行根因分析 | R 子代理 + root-cause-locator.md（5-Why/鱼骨图/缺陷链/上游回溯）+ 反模式 #18/#19 | 复用（更强） |
| 决策日志 | run-log.jsonl RunLogEntry.acknowledgedDecisions + event-ingress.jsonl | 复用 |
| 术语一致性校验 | conventions.md 术语表 + 阶段 1 glossary.md | 复用 |
| Token 预算切分 | budget.json + check-budget.ts | 复用 |
| 代码事实核对 | codegraph_explore 强制（约束 #14）+ check-code-tla-consistency.ts | 复用 |
| **产出期证据锚点** | **graph.json nodes[].evidenceAnchor（新增，可选）** | **新增（唯一增量）** |
| EVIDENCE_GRAPH.md 血缘视图 | graph.json + run-log 决策摘要（人类可读视图可选用模板 §4） | 轻量映射 |
| 熔断判定树 Q1-Q4 | 反模式 #18/#19 + R→V→G→S-fix 循环 | 复用（更强） |
| 每 3 个叶子周期校验 | R3 预防性审查 x3 + ICEBERG-A/B + 阶段门 | 复用（节奏更强） |

## 3. 唯一增量：evidenceAnchor

- 定义：见 conventions.md 术语表。
- 声明者：A 子代理 ingestion 时声明；S 规格 §4.2 只读同步；V 评审核验；G 门禁 R15 格式校验。
- 落地：graph.schema.json 可选字段 + graph-logic R15 轻校验 + requirement-spec 模板列。

## 4. 明确拒绝照搬的点（避免破坏架构）

| 方法论原文 | 拒绝原因 | W 模型正确做法 |
|---|---|---|
| 阶段 5 清空上下文重载 PLAN.md | 违反编排者持久化 | .w-model/*.json + wm-write.ts 锁写 |
| AI 每叶子声明证据并标 🟡 | 违反编排者最小化（反模式 #10） | S 产出时声明，V 评审核验 |
| 新增三色 emoji 标签体系 | 与 coverageStatus/qualityLevel 语义重叠，schema 漂移风险 | 复用现有枚举 |
| 新增 CONTEXT.md/ADR/ 文档体系 | 已有 conventions.md + decision-log/ | 不新建目录 |
| 每 3 叶子强制校验 | 破坏阶段门节奏 | R3 + ICEBERG-B 兜底 |

## 5. 采用建议

- 路径不确定项目进入 /wm analyze 前，可先按本文件 §2 映射表自查已覆盖能力，聚焦补 evidenceAnchor。
- 不新增命令 / 不新增脚本 / 不改 eval。
```

### 2.2 可选：evidence-graph.md 模板（改动 3，暂缓）

当前**不建议**实施（改动 3 为可选、不加门禁）。留作后续选项：

- 文件：`w-model-dev/templates/requirement-spec/evidence-graph.md`（新增）
- 内容：graph.json 人类可读血缘视图（节点表含 evidenceAnchor 列 + 典型路径 + 决策日志摘要）
- 理由：与现有 6 独立产物模式一致，但 V 评审子标准不新增则收益有限；等改动 1 落地跑一轮再评估。

---

## 3. 实施清单（审阅通过后由子代理执行）

按 AGENTS.md §6 SSoT 优先顺序，由 S 子代理实施（编排者不越权，反模式 #10）：

| 步骤 | 动作 | 执行方 | 验证 |
|---|---|---|---|
| 1 | 改 `docs/skill-design-document_SSoT.md`（§4A.1 / §7.7 / §10A） | S 子代理 | V 评审 + G 门禁 |
| 2 | 改 `w-model-dev/schemas/graph.schema.json` | S 子代理 | npx tsx self-test（schema 变更须同步 samples） |
| 3 | 改 `w-model-dev/references/conventions.md`（术语） | S 子代理 | check-docs-consistency |
| 4 | 改 `w-model-dev/templates/requirement-spec.md`（列） | S 子代理 | 模板占位符检查 |
| 5 | 改 `w-model-dev/scripts/logic/graph-logic.ts`（R15）+ `__tests__/graph-logic.test.ts` | S 子代理 | `npx vitest run --config config/vitest.config.ts` |
| 6 | 改 `w-model-dev/references/ingestion-chunk.md` / `ingestion-cross.md`（A 声明证据锚点指引） | S 子代理 | 按需加载契约（SKILL.md） |
| 7 | 新增 `w-model-dev/references/evidence-anchored-tree.md` | S 子代理 | 按需加载契约（SKILL.md） |
| 8 | 更新 README / CHANGELOG / AGENTS.md（如文档结构变化） | S 子代理 | check-docs-consistency + pre-push |

**回归保障**：改动涉及 schema，须同步 `w-model-dev/scripts/samples/` fixture 与新用例；`npm run self-test`（260 条基线）与 `npm run prepush`（17 项门禁）全绿才可收尾。

**风险**：R15 仅校验"声明了则格式合法"，不校验"必须声明"——避免存量 graph.json 全量回填，同时保证声明的质量。若后续要强制，可升级为 constraints 层变更（届时须走 S→R→V→人类豁免流程）。

---

## 4. 参考

- 外部方法论**原文基准**：[../sources/2026-08-31-evidence-anchored-tree-methodology.md](../sources/2026-08-31-evidence-anchored-tree-methodology.md)（唯一拷贝基准，本文档所有映射以该文件为准）
- `w-model-dev/scripts/logic/graph-logic.ts`（R1-R11 + R7-R14 现有校验结构）
- `w-model-dev/scripts/logic/verifier-logic.ts`（EVIDENCE_PATTERN 现网正则）
- `w-model-dev/schemas/graph.schema.json`（节点属性现状）
- `w-model-dev/references/conventions.md`（术语表 + 格式约定）
- `w-model-dev/templates/requirement-spec.md`（§4.2 层级节点表）
- `w-model-dev/references/root-cause-locator.md`（R 方法论，复用依据）
