# 证据支撑树集成 · 详细设计（Evidence-Anchored Tree Detailed Design）

> **状态**：详细设计（已获草案批准）。依据 [integration-design](./2026-08-31-evidence-anchored-tree-integration-design.md) 草案深化。
> **日期**：2026-08-31
> **方法论原文基准**：[sources/2026-08-31-evidence-anchored-tree-methodology.md](../sources/2026-08-31-evidence-anchored-tree-methodology.md)
> **实施计划**：[plans/2026-08-31-evidence-anchored-tree-integration.md](../plans/2026-08-31-evidence-anchored-tree-integration.md)（另行产出）
> **原则**：唯一增量 = 产出期证据锚点（evidenceAnchor）；90% 能力复用 w-model 现有机制；零新增命令/脚本/状态文件；向后兼容。

---

## 1. 设计目标与不变量

### 1.1 目标

1. 让"图谱节点结论的事实锚点"成为**产出期可选声明**（A 子代理 ingestion 时），而非评审期才检验。
2. 兼容全部存量产物：不破坏 round23 等既有 graph.json，不要求全量回填。
3. 复用现有证据格式正则（EVIDENCE_PATTERN），不引入第三套格式。

### 1.2 设计不变量（N/A 到产物）

| # | 不变量 | 含义 |
|---|---|---|
| N1 | 可选字段 | `evidenceAnchor` 不进入 schema `required`；未声明不视为缺陷 |
| N2 | 声明则合法 | 声明了（非 undefined 且非空串）必须匹配 EVIDENCE_PATTERN，否则 R15 violation |
| N3 | A 声明 / S 只读 | A 子代理 ingestion 时写 graph.json 节点；S 子代理产出规格 §4.2 只读同步展示，S 不改图谱（反模式 #11） |
| N4 | 格式单源 | R15 正则与 `verifier-logic.ts` EVIDENCE_PATTERN 语义一致（允许复制常量，禁止定义第三套语义） |
| N5 | 零门禁新脚本 | 不新增 check-*.ts；R15 并入既有 `checkRequirementGraph` violations 体系，随 `check-requirement-graph.ts` 自动生效 |
| N6 | 零新命令 / 零新状态文件 | 不加 `/wm` 命令、不改 `.w-model/` schema 清单、不加 run-log action 枚举 |

### 1.3 明确不做（YAGNI）

- 不做 `EVIDENCE_GRAPH.md` 强制产物（改动 3 暂缓，见草案 §2.2）
- 不做"/wm clarify"命令（草案已否决：会破坏 eval 25 条映射 + 阶段门节奏）
- 不做三色 emoji 状态机（与 coverageStatus / qualityLevel 语义重叠）
- 不做强制执行（升级为 constraints 层时另走 S→R→V→人类豁免流程）

---

## 2. 数据结构设计

### 2.1 graph.schema.json 变更（w-model-dev/schemas/graph.schema.json）

在 `nodes[].properties` 中、`reqGroup` 之后新增（**可选**，不进 required）：

```json
"evidenceAnchor": {
  "description": "节点结论的前提事实锚点（可选）：产出期声明该 REQ/SD/INTF/DD 节点结论所依据的事实来源，格式遵循 conventions.md 列定位约定（path:§section=statement 或 path:L42= 或用户原话/外部依赖版本）。由 A 子代理 ingestion 时声明；S 子代理产出规格 §4.2 只读同步；V 评审校验存在性；G 门禁 R15 校验格式。未声明不阻断（可选字段，向后兼容）。",
  "type": "string",
  "minLength": 1
}
```

**变更点**：
- `nodes.items.properties` 增加 1 个属性
- **required 不变**（`["id","type","phase","title","summary"]`）
- `additionalProperties: false` 在 items 层保留——所以存量节点无此字段不受影响，新增节点带此字段合法（schema 白名单）

### 2.2 GraphNode 类型（graph-logic.ts）

`export interface GraphNode`（约 L38-58）增加可选字段：

```typescript
/** 节点结论的前提事实锚点（可选；格式见 conventions.md 列定位约定；由 A 子代理 ingestion 时声明） */
evidenceAnchor?: string;
```

### 2.3 R15 校验规则（graph-logic.ts checkRequirementGraph）

**插入位置**：主函数内、`轮次上限校验` 块之后、「汇总 passed」之前（约 L795 与 L797 之间）。理由：该位置无条件执行（不依赖 REQ 节点存在），对全部节点类型生效，且 violations 会在 L816 自动纳入 `passed`。

**校验逻辑**：

```typescript
// R15: evidenceAnchor 仅声明则须格式合法（可选字段；格式复用 verifier-logic EVIDENCE_PATTERN 语义）
const EVIDENCE_ANCHOR_PATTERN = /^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/;
const badEvidenceAnchors: string[] = [];
for (const n of g.nodes) {
  if (n.evidenceAnchor !== undefined && n.evidenceAnchor !== '' && !EVIDENCE_ANCHOR_PATTERN.test(n.evidenceAnchor)) {
    badEvidenceAnchors.push(`${n.id}（${n.evidenceAnchor}）`);
  }
}
if (badEvidenceAnchors.length > 0) {
  result.violations.push(
    `R15 evidenceAnchor 格式校验失败：${badEvidenceAnchors.join('；')}（格式须为 path:§section=statement 或 path:L42=statement）`,
  );
}
```

**判定表**：

| 节点 evidenceAnchor 值 | 结果 |
|---|---|
| `undefined` / 缺字段 | 通过（N1） |
| `""`（空串） | **schema 拦截**（`minLength:1` → `[schema]` violation → passed=false），不进入 R15（schema 前置校验在业务规则前） |
| `docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）` | 通过 |
| `src/auth.ts:L42-58=JWT 签发逻辑` | 通过 |
| `登录需要密码`（无定位） | R15 violation → passed=false |
| `docs/a.md#§3`（井号分隔） | R15 violation |

**effect on passed**：violations 累积进 `result.violations`，L816 `result.passed = ... && result.violations.length === 0` 自动拦截。**无需**改动 `recalculatePassed`（其只重算 `traceabilityOk/dataflowOk/rootsOk` 相关标记，R15 不依赖这些标记）。

### 2.4 conventions.md 术语条目

在「工程资产相关」节新增（放在 `evidenceAnchor` 对应字母序附近 —— 实际按主题归到「数据模型相关」后）：

```markdown
### evidenceAnchor

- **规范定义**：图谱节点（graph.json nodes[]）结论的事实锚点，由 **A 子代理 ingestion 时**声明"该节点结论依据什么事实"（A-chunk 提取 REQ 节点时对来源声明，A-cross 合并保留），
  格式遵循本文件「格式约定」§2.1（`path:§section=statement` / `path:L42=statement`）；未声明时省略该字段（可选，R15 不强制）。
  S 子代理产出需求规格 §4.2 时**只读 graph.json 同步呈现**，不改图谱节点（S 改图谱命中反模式 #11）。
  与 VerifierOutput.subCriteria[].evidence 的区别：evidence 是**评审者**证明"我核验过"的证据；
  evidenceAnchor 是**产出者（A）**声明"我依据这个"的前提，二者互补不互相替代。
- **_Avoid_**：证据锚点/sourceRef/proof（字段名固定「evidenceAnchor」；「证据」在 VerifierOutput 语境指评审证据）
```

### 2.5 requirement-spec.md 模板变更

§4.2 层级节点表新增**可选末列**：

```markdown
| 需求 ID | level | priority | reqGroup | parent | 类型 | 描述 | 验收标准 | evidenceAnchor |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | 1 | P0 | REQ-001 | — | domain | {{领域描述}} | — | {{可选: 依据文档/用户原话}} |
```

**配套**：模板正文该表下方"强制项/禁止行为"说明处追加一句注释：
> `evidenceAnchor` 列为可选（A 子代理在 graph.json 声明、S 只读同步展示）；未声明不影响本模板合法性。

---

## 3. 行为设计

### 3.1 A 子代理声明行为（ingestion）

- **A-chunk**：提取 REQ 节点时，若该节点结论来自明确事实（用户原话、指定文档段落、外部依赖版本、已读代码），在 `<chunk-id>.json` 节点上填写 `evidenceAnchor`；无法定位到具体事实时**省略**（不强制、不填空串）。
- **A-cross**：合并时保留各节点 evidenceAnchor；冲突（同节点多来源）取来源最具体的，并在 `cross-analysis-report.md` 记录取舍。
- **不新增** A 行为的强制产出字段（unchanged），仅作为一种可选增量。

### 3.2 S 子代理展示行为（阶段 1 需求规格）

- S 产出 `requirement-spec.md` §4.2 表时，读取 graph.json 对应 REQ 节点的 `evidenceAnchor`，填入末列；无则留空。
- **S 不改 graph.json**（遵守 SSoT §7.7 维护边界，反模式 #11）。

### 3.3 V 评审行为

- targetKind=requirement 评审时，V 可把 evidenceAnchor 存在性作为**可选项**纳入 completeness 子标准 evidence 说明（不新增子标准、不改权重、不改 schema）。
- 具体做法：V 在评审提示词占位符中看到节点带 evidenceAnchor 时核验格式合理性；不强制要求所有节点有锚点。

### 3.4 G 门禁行为

- G 跑 `check-requirement-graph.ts`——R15 自动随 `checkRequirementGraph` 生效，无需新参数。
- 退出码 0/1/2 语义不变；R15 违规 → exit 1，violation 进入 GATE_JSON `violations`。

---

## 4. 文档资产变更清单（汇总）

| 文件 | 类型 | 关键变更 |
|---|---|---|
| `w-model-dev/schemas/graph.schema.json` | 修改 | nodes[].properties += evidenceAnchor（可选） |
| `w-model-dev/scripts/logic/graph-logic.ts` | 修改 | GraphNode += evidenceAnchor?；checkRequirementGraph += R15 块（L795 后） |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 修改 | 新增 R15 单测（合法/非法/省略） |
| `w-model-dev/scripts/samples/graph/` | 新增 2 fixture | `bad-evidence-anchor.json` + `valid-evidence-anchor.json` |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | GRAPH_CASES += 2 条 |
| `w-model-dev/scripts/samples/README.md` | 修改 | graph 矩阵行用例数更新 + 用途说明 |
| `w-model-dev/references/conventions.md` | 修改 | 术语表 += evidenceAnchor |
| `w-model-dev/templates/requirement-spec.md` | 修改 | §4.2 表 += evidenceAnchor 列 |
| `w-model-dev/references/ingestion-chunk.md` | 修改 | A-chunk 可选声明 evidenceAnchor 指引 |
| `w-model-dev/references/ingestion-cross.md` | 修改 | A-cross 保留/取舍 evidenceAnchor 指引 |
| `w-model-dev/references/evidence-anchored-tree.md` | 新增 | 方法论参照（见 §5 全文） |
| `docs/skill-design-document_SSoT.md` | 修改 | §4A.1 +§4A.1b 操作行为；§7.7 节点属性；§10A 表格行 |
| `w-model-dev/SKILL.md` | 修改 | 资源计数 references 58→59；按需加载表追加 evidence-anchored-tree.md |
| `README.md` | 修改 | 文件树 references 58→59；必读列表 |
| `CHANGELOG.md` | 修改 | 新增 42.1.0 节 |
| `w-model-dev/skill-metadata.json` | 修改 | version 42.0.0→42.1.0，updatedAt |
| `w-model-dev/scripts/__tests__/skill-metadata.test.ts` | 修改 | 若硬编码版本则同步 |

> **references 计数联动**：新增 `evidence-anchored-tree.md` 后 `references/` = 59 个 .md。必须同步三处：(1) SKILL.md「门禁契约与资源清单」节 `（58 个 .md）`→`（59 个 .md）`；(2) README.md 文件树 `58 份`→`59 份`；(3) `check-docs-consistency.ts` 的 references-count 检查自动比对（实测驱动，无需改代码，但文档声明不一致会亮红灯）。

> **docs-consistency 其他校验联动确认**：`check-docs-consistency` 校验 `runLogActionCount=27`（不变）、`maxAntiPattern=48`（不变）、`hardConstraintCount=14`（不变）、pre-push 17 项（不变）、exit-2 脚本数（新增的是 reference 不是脚本，不变）。无需改 docs-consistency-logic.ts 的 EXPECTED。

---

## 5. references/evidence-anchored-tree.md 全文（定稿）

> 目标位于 `w-model-dev/references/evidence-anchored-tree.md`。以下为**完整定稿**，实施时整文件写入。

```markdown
# 证据支撑树方法论参照（Evidence-Anchored Decision Tree）

> **定位**：外部方法论「证据支撑树联合分析模式」的 W 模型适配参照。
> **适用场景**：**路径不确定 / 需求模糊**的决策任务（与阶段 1 迷雾登记册互补）。
> **边界**：本文件是方法论参照，不是新流程——W 模型 8 阶段、CHECKPOINT、门禁脚本、反模式体系为权威流程。
> **集成结论**：该方法论 90% 能力 w-model 已有且更强；唯一增量 = 产出期 `evidenceAnchor`（见 §3）。
> **原文基准**：`docs/superpowers/sources/2026-08-31-evidence-anchored-tree-methodology.md`（仓库内，非运行时资产）。

## 1. 方法论摘要

证据支撑树联合分析模式（Evidence-Anchored Decision Tree with Upward Root-Cause Analysis）将模糊目标视为决策树：
**决策树穷尽 + 事实交叉验证 + 渐进式文档沉淀**，每个结论挂载证据状态（🟢 Confirmed / 🟡 Pending / 🔴 Invalid），
执行中通过"叶子→枝干→根"上行回溯实现动态自愈。四层架构：
1. **认知引擎层**：苏格拉底式拷问（分支穷尽 / 单线程聚焦 / 信息自足 / 证据锚点声明）
2. **验证校准层**：领域驱动事实交叉验证（术语一致性 / 代码事实核对 / 证据状态快照）
3. **产出沉淀层**：渐进式活文档（PLAN.md / EVIDENCE_GRAPH.md / CONTEXT.md / ADR/）
4. **流程控制层**：范围与保真度管理（Token 预算切分 / 保真度过滤器）

## 2. 与 W 模型映射表

| 证据支撑树组件 | W 模型对应机制 | 复用/新增 |
|---|---|---|
| 决策树穷尽 | ingestion 子流程 + graph.json + check-requirement-graph R1-R15 | 复用（更强） |
| 苏格拉底拷问 | /wm analyze 需求解析步骤 1-2（歧义→暂停要用户重述） | 复用（更强） |
| 三色证据状态 🟢/🟡/🔴 | coverageStatus covered/partial/not-covered + qualityLevel A-D + outcome | 复用（枚举等价） |
| 上行根因分析 | R 子代理 + root-cause-locator.md（5-Why/鱼骨图/缺陷链/上游回溯）+ 反模式 #18/#19 | 复用（更强） |
| 决策日志 | run-log.jsonl RunLogEntry.acknowledgedDecisions + event-ingress.jsonl | 复用 |
| 术语一致性校验 | conventions.md 术语表 + 阶段 1 glossary.md | 复用 |
| Token 预算切分 | budget.json + check-budget.ts | 复用 |
| 代码事实核对 | codegraph_explore 强制（约束 #14）+ check-code-tla-consistency.ts | 复用 |
| **产出期证据锚点** | **graph.json nodes[].evidenceAnchor（新增，可选）+ R15 轻量格式校验** | **新增（唯一增量）** |
| EVIDENCE_GRAPH.md 血缘视图 | graph.json + run-log 决策摘要（人类可读视图可选用模板） | 轻量映射 |
| 熔断判定树 Q1-Q4 | 反模式 #18/#19 + R→V→G→S-fix 循环 | 复用（更强） |
| 每 3 个叶子周期校验 | R3 预防性审查 ×3 + ICEBERG-A/B + 阶段门 | 复用（节奏更强） |

## 3. 唯一增量：evidenceAnchor

- **定义**：图谱节点结论的前提事实锚点，由 A 子代理 ingestion 时声明（A-chunk 提取时对来源声明，A-cross 合并保留）；
  S 子代理产出规格 §4.2 只读同步；V 评审可按 completeness 子标准核验存在性；G 门禁 R15 校验格式。
- **格式**：遵循 conventions.md 列定位约定——`path:§section=statement` 或 `path:L42=statement`（复用 EVIDENCE_PATTERN 语义）。
- **可选**：未声明不视为缺陷（向后兼容存量 graph.json）；声明了则必须合法（R15）。
- **与评审证据区别**：evidenceAnchor = 产出者声明"我依据这个"；VerifierOutput.evidence = 评审者证明"我核验过"。

## 4. 明确拒绝照搬的点（避免破坏 W 模型架构）

| 方法论原文 | 拒绝原因 | W 模型正确做法 |
|---|---|---|
| 阶段 5 清空上下文重载 PLAN.md | 违反编排者持久化 | .w-model/*.json + wm-write.ts 锁写 |
| AI 每叶子声明证据并标 🟡 | 违反编排者最小化（反模式 #10） | A 子代理 ingestion 声明，V 评审核验 |
| 新增三色 emoji 标签体系 | 与 coverageStatus/qualityLevel 语义重叠，schema 漂移风险 | 复用现有枚举 |
| 新增 CONTEXT.md/ADR/ 文档体系 | 已有 conventions.md + decision-log/ | 不新建目录 |
| 每 3 叶子强制校验 | 破坏阶段门节奏 | R3 + ICEBERG-B 兜底 |

## 5. 采用建议

- 路径不确定项目进入 `/wm analyze` 前，可先按 §2 映射表自查已覆盖能力，聚焦补 evidenceAnchor。
- 不新增命令 / 不新增脚本 / 不改 eval。交付物引用本方法论时以本章节映射为准。
```

---

## 6. SSoT 变更（逐节定稿）

### 6.1 §4A.1b 新增操作行为（§4A.1 表后新增小节）

```markdown
### 4A.1b 产出期证据锚点声明（evidenceAnchor）

- **行为**：A 子代理 ingestion 提取 REQ 节点时，可对结论来源声明 `evidenceAnchor`（用户原话 / 文档段落 / 外部依赖版本，格式见 conventions.md 列定位约定）；S 子代理产出规格 §4.2 只读同步；S 不改图谱节点（反模式 #11）。
- **强度**：可选——未声明不视为缺陷；声明了则格式必须合法（G 门禁 R15）。
- **与评审证据的关系**：evidenceAnchor 是产出者声明（前提），VerifierOutput.evidence 是评审者核验（证明），二者互补。
- **吸收来源**：外部方法论「证据支撑树联合分析模式」（Evidence-Anchored Decision Tree），参照文档 `w-model-dev/references/evidence-anchored-tree.md`。
```

### 6.2 §7.7 graph.json schema

在「要点」的节点字段说明处追加一行：

```markdown
- **可选字段 evidenceAnchor**：节点结论的前提事实锚点（产出期声明，A 子代理 ingestion 时写、S 规格 §4.2 只读同步、G 门禁 R15 格式校验）；未声明不阻断（向后兼容）。
```

### 6.3 §10A SSoT ↔ 实现追溯表

追加一行：

```markdown
| 4A.1b 产出期证据锚点（evidenceAnchor） | 图谱节点可选声明结论事实锚点（A 声明 / S 只读 / V 核验 / G R15 校验格式） | `w-model-dev/references/conventions.md` 术语表 + `w-model-dev/schemas/graph.schema.json` + `w-model-dev/scripts/logic/graph-logic.ts` R15 + `w-model-dev/references/evidence-anchored-tree.md` | 完整（复用 EVIDENCE_PATTERN 格式；吸收外部方法论唯一增量；遵守 SSoT §7.7 维护边界：A 写 / S 只读） |
```

---

## 7. 测试设计

### 7.1 单元测试（graph-logic.test.ts 或独立块）

| 用例 | 输入 | 期望 |
|---|---|---|
| GRAPH-R15-1 | 节点带合法 evidenceAnchor `docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略` | passed=true，无 R15 violation |
| GRAPH-R15-2 | 节点带非法 evidenceAnchor `登录需要密码`（无定位） | passed=false，violations 含 `R15 evidenceAnchor 格式校验失败` |
| GRAPH-R15-3 | 节点缺 evidenceAnchor | passed=true（向后兼容，R15 不触发）；空串由 schema `minLength:1` 拦截（`[schema]` violation，非 R15 路径） |
| GRAPH-R15-4 | 多个节点含非法锚点 | violations 列出全部违规节点 id |

> 建议放入 `graph-logic.test.ts`（vitest 直接调 `checkRequirementGraph`），并同时以 samples fixture 走 self-test 集成路径（见 7.2）。

### 7.2 样本（samples/graph/）

新增 2 个 fixture（平铺 JSON，phase=1 纯 REQ 图，需满足既有校验最低要求——连通、单根、REQ 有 level）：

- **`valid-evidence-anchor.json`**：所有节点合法或省略，期望通过（复用 `valid-req-hierarchy.json` 结构 + 1 个节点带合法锚点）。
- **`bad-evidence-anchor.json`**：1 个 REQ 节点带非法锚点，期望 R15 失败（复用 `valid-req-hierarchy.json` 结构 + 1 个节点带非法锚点）。

在 `self-test.ts` GRAPH_CASES 数组追加：

```typescript
{
  file: 'valid-evidence-anchor.json',
  phase: 1,
  expectedPassed: true,
  description: 'REQ 节点带合法 evidenceAnchor（path:§section=statement），应通过 R15',
},
{
  file: 'bad-evidence-anchor.json',
  phase: 1,
  expectedPassed: false,
  expectedReasonPatterns: [/R15 evidenceAnchor 格式校验失败/],
  description: 'REQ 节点 evidenceAnchor 无定位（"登录需要密码"），应被 R15 拦截',
},
```

**用例数联动**：GRAPH_CASES 28→30、总计 260→262 条。samples/README.md graph 矩阵行 `GRAPH_CASES（28）+ ENHANCE×4（16）` → `GRAPH_CASES（30）+ ENHANCE×4（16）`；合计行 260→262。

> **注意**：self-test 总用例数由真实运行测定（docs-consistency 的 vitest-results/references-count 是动态 facts），新增 2 条后 `npm run self-test` 会输出 262；README 与 samples/README 的计数同步更新以避免文档不一致红灯。

### 7.3 vitest 运行命令

```bash
# 单测
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/graph-logic.test.ts
# 全量单测
npx vitest run --config config/vitest.config.ts
# 回归基线（260→262）
npm run self-test
# 文档一致性
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
# 样本覆盖
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
# 推送前全部门禁（17 项）
npm run prepush
```

---

## 8. 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| references 计数 58→59 三处文档未同步 | 中 | check-docs-consistency references-count 自动拦截；计划任务显式列出三处 |
| graph schema 变更破坏存量 fixture | 低 | evidenceAnchor 可选 + additionalProperties 白名单保留；schema 校验对存量图零影响 |
| self-test 用例数 260→262 与文档计数漂移 | 低 | 任务中显式同步 README / samples/README / self-test 输出 |
| A 子代理不理解声明时机 | 中 | ingestion-chunk/cross 文档指引 + V 评审可核验 |
| R15 误伤正常锚点 | 低 | 复用 EVIDENCE_PATTERN 语义（已服务 VerifierOutput 多期），正则保守 |
| skill-metadata.test.ts 版本硬编码 | 低 | 先 grep 确认再改；若为"与 SKILL.md frontmatter 一致"动态校验则只改 SKILL.md frontmatter |
