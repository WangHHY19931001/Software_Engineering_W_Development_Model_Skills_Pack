# 证据支撑树集成实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 w-model-dev 集成证据支撑树方法论的唯一增量——图谱节点产出期证据锚点 `evidenceAnchor`（A 声明 / S 只读 / V 核验 / G 门禁 R15 格式校验），并新增方法论参照文档。

**架构：** 在 `graph.schema.json` 节点属性加可选 `evidenceAnchor` 字段；`graph-logic.ts` 的 `checkRequirementGraph` 增加 R15 轻量格式校验（复用 VerifierOutput 的 EVIDENCE_PATTERN 语义）；`conventions.md` 登记术语；`requirement-spec.md` 模板加可选列；A 子代理 ingestion 指引文档说明声明时机；新增 `references/evidence-anchored-tree.md` 方法论参照；同步 SSoT / SKILL.md / README / CHANGELOG / skill-metadata。

**技术栈：** TypeScript（tsx）、JSON Schema draft-07、vitest、现有 17 项 pre-push 门禁体系。

**关键事实（实施者必读）：**
- evidenceAnchor 是**可选**字段，不进 schema `required`；未声明不视为缺陷（向后兼容，round23 等存量 graph.json 零影响）。
- R15 插入位置：`graph-logic.ts` `checkRequirementGraph` 内「轮次上限校验」块之后、「汇总 passed」之前（约 L795/L797）。
- R15 violations 累积进 `result.violations`，L816 汇总 `passed` 自动纳入；**无需**改 `recalculatePassed`。
- references 计数 58→59，必须同步 SKILL.md「门禁契约与资源清单」节 + README.md 文件树。
- self-test 用例数 260→262（GRAPH_CASES 28→30），须同步 samples/README.md 矩阵与合计行。
- 版本 42.0.0 → 42.1.0（SKILL.md frontmatter + skill-metadata.json + CHANGELOG 新节）。
- 详细规则见详细设计：[../specs/2026-08-31-evidence-anchored-tree-detailed-design.md](../specs/2026-08-31-evidence-anchored-tree-detailed-design.md)。

---

### 任务 1：graph.json schema 增加 evidenceAnchor 可选字段

**文件：**
- 修改：`w-model-dev/schemas/graph.schema.json`（nodes[].properties，reqGroup 之后）
- 测试：`w-model-dev/scripts/__tests__/graph-logic.test.ts`（R15 相关用例在本任务一并完成，见下）

- [ ] **步骤 1：先看现网 schema 结构**

运行：`npx tsx -e "const s=require('./w-model-dev/schemas/graph.schema.json'); console.log(Object.keys(s.properties.nodes.items.properties))"`
预期：列出 `id,type,phase,title,summary,sourceChunk,sourceArtifact,attributes,governance,derivationProduct,level,priority,reqGroup`

- [ ] **步骤 2：修改 schema——新增 evidenceAnchor 属性**

在 `w-model-dev/schemas/graph.schema.json` 的 `nodes.items.properties.reqGroup` 之后新增：

```json
"evidenceAnchor": {
  "description": "节点结论的前提事实锚点（可选）：产出期声明该 REQ/SD/INTF/DD 节点结论所依据的事实来源，格式遵循 conventions.md 列定位约定（path:§section=statement 或 path:L42= 或用户原话/外部依赖版本）。由 A 子代理 ingestion 时声明；S 子代理产出规格 §4.2 只读同步；V 评审校验存在性；G 门禁 R15 校验格式。未声明不阻断（可选字段，向后兼容）。",
  "type": "string",
  "minLength": 1
}
```

`required` 数组**保持** `["id","type","phase","title","summary"]` 不变。

- [ ] **步骤 3：运行 schema 自检确认合法**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts` 中 graph 相关用例（或全量）
预期：exit 0；存量 fixture（无 evidenceAnchor 字段）全部通过——证明向后兼容

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/schemas/graph.schema.json
git commit -m "feat(schema): add optional evidenceAnchor to graph nodes (evidence tree integration)"
```

---

### 任务 2：graph-logic.ts 增加 GraphNode 字段与 R15 校验

**文件：**
- 修改：`w-model-dev/scripts/logic/graph-logic.ts`（GraphNode 接口 + checkRequirementGraph 内 R15 块）
- 测试：`w-model-dev/scripts/__tests__/graph-logic.test.ts`（本任务新增 4 个用例）

- [ ] **步骤 1：GraphNode 接口增加可选字段**

在 `w-model-dev/scripts/logic/graph-logic.ts` 的 `export interface GraphNode`（约 L38-58）中 reqGroup 字段后新增：

```typescript
/** 节点结论的前提事实锚点（可选；格式见 conventions.md 列定位约定；由 A 子代理 ingestion 时声明） */
evidenceAnchor?: string;
```

- [ ] **步骤 2：在 checkRequirementGraph 内增加 R15 块**

在「轮次上限校验」块（以 `const overRoundRecords` 开头、`);` 结束）之后、「// 汇总 passed」注释之前插入：

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

- [ ] **步骤 3：编写失败的测试（R15 四用例）**

在 `w-model-dev/scripts/__tests__/graph-logic.test.ts` 末尾新增测试块：

```typescript
describe('R15 evidenceAnchor 格式校验', () => {
  function makeReqGraph(anchor?: string, nodes?: Array<Record<string, unknown>>) {
    const baseNodes = [
      { id: 'REQ-001', type: 'REQ', phase: 1, title: '用户登录', summary: '登录', level: 1 },
      { id: 'REQ-002', type: 'REQ', phase: 1, title: '密码策略', summary: '密码', level: 2, reqGroup: 'REQ-001' },
    ];
    const ns = nodes ?? baseNodes;
    if (anchor !== undefined) ns = ns.map((n) => (n.id === 'REQ-002' ? { ...n, evidenceAnchor: anchor } : n));
    return {
      version: 1,
      currentPhase: 1,
      nodes: ns,
      edges: [
        { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
        { from: 'REQ-001', to: 'REQ-002', type: 'produces' },
      ],
      analysisRounds: [{ phase: 1, round: 1, violations: [], converged: true }],
    };
  }

  test('合法锚点通过（path:§section=statement）', () => {
    const r = checkRequirementGraph(
      makeReqGraph('docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）'),
      1,
    );
    expect(r.passed).toBe(true);
    expect(r.violations.some((v) => v.includes('R15'))).toBe(false);
  });

  test('合法锚点通过（path:L42=statement）', () => {
    const r = checkRequirementGraph(makeReqGraph('src/auth.ts:L42-58=JWT 签发逻辑'), 1);
    expect(r.passed).toBe(true);
    expect(r.violations.some((v) => v.includes('R15'))).toBe(false);
  });

  test('非法锚点（无定位）R15 拦截', () => {
    const r = checkRequirementGraph(makeReqGraph('登录需要密码'), 1);
    expect(r.violations.some((v) => v.includes('R15 evidenceAnchor 格式校验失败'))).toBe(true);
    expect(r.passed).toBe(false);
  });

  test('省略锚点向后兼容（空串由 schema minLength:1 拦截，非 R15 路径）', () => {
    expect(checkRequirementGraph(makeReqGraph(undefined), 1).passed).toBe(true);
    const rEmpty = checkRequirementGraph(makeReqGraph(''), 1);
    expect(rEmpty.violations.some((v) => v.includes('R15 evidenceAnchor 格式校验失败'))).toBe(false);
    expect(rEmpty.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });
});
```

> 注：`makeReqGraph` 须满足既有 R1-R11 最低要求（连通 / 单根 / REQ level 单调）。若 `requires` import 未引入 `checkRequirementGraph`，在文件顶部补 import（与现网 import 风格一致）。若测试夹具因多根/信息流校验失败，参照 `valid-req-hierarchy.json` 结构补齐边。

- [ ] **步骤 4：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/graph-logic.test.ts -t "R15"`
预期：FAIL——R15 尚不存在或断言不满足

- [ ] **步骤 5：运行测试验证通过（步骤 2 代码已就位则直接通过）**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/graph-logic.test.ts -t "R15"`
预期：4 用例全 PASS

- [ ] **步骤 6：全量 vitest 回归**

运行：`npx vitest run --config config/vitest.config.ts`
预期：全绿（无既有用例回归）

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/graph-logic.ts w-model-dev/scripts/__tests__/graph-logic.test.ts
git commit -m "feat(graph-logic): add R15 evidenceAnchor format check (optional field)"
```

---

### 任务 3：样本 fixture + self-test 集成（260→262）

**文件：**
- 新增：`w-model-dev/scripts/samples/graph/valid-evidence-anchor.json`
- 新增：`w-model-dev/scripts/samples/graph/bad-evidence-anchor.json`
- 修改：`w-model-dev/scripts/cli/self-test.ts`（GRAPH_CASES += 2）
- 修改：`w-model-dev/scripts/samples/README.md`（矩阵行 + 合计行）

- [ ] **步骤 1：读现网 `valid-req-hierarchy.json` 作为夹具底本**

运行：`cat w-model-dev/scripts/samples/graph/valid-req-hierarchy.json`
预期：phase=1 纯 REQ 图（连通 / 单根 / level 单调），作为两个新 fixture 的结构底本

- [ ] **步骤 2：新增 `valid-evidence-anchor.json`**

复制 `valid-req-hierarchy.json` 结构，给其中 1 个 REQ 节点增加合法字段：

```json
"evidenceAnchor": "docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）"
```

保持其余节点结构不变。

- [ ] **步骤 3：新增 `bad-evidence-anchor.json`**

复制 `valid-req-hierarchy.json` 结构，给其中 1 个 REQ 节点增加非法字段：

```json
"evidenceAnchor": "登录需要密码"
```

- [ ] **步骤 4：修改 self-test.ts GRAPH_CASES**

在 `w-model-dev/scripts/cli/self-test.ts` 的 `GRAPH_CASES` 数组末尾追加：

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

- [ ] **步骤 5：修改 samples/README.md 计数**

graph 矩阵行：`GRAPH_CASES（28）` → `GRAPH_CASES（30）`；合计行 `260 条` → `262 条`。

- [ ] **步骤 6：运行 self-test 验证 262 条全绿**

运行：`npm run self-test`
预期：exit 0；输出 `Graph 用例 : 30`；总用例 262

- [ ] **步骤 7：运行样本覆盖门禁**

运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：exit 0

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/samples/graph/ w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md
git commit -m "test(samples): add evidenceAnchor R15 fixtures, self-test baseline 260→262"
```

---

### 任务 4：conventions.md 术语 + requirement-spec 模板列 + ingestion 指引

**文件：**
- 修改：`w-model-dev/references/conventions.md`（术语表新增 evidenceAnchor）
- 修改：`w-model-dev/templates/requirement-spec.md`（§4.2 表增列 + 说明）
- 修改：`w-model-dev/references/ingestion-chunk.md`（A-chunk 可选声明指引）
- 修改：`w-model-dev/references/ingestion-cross.md`（A-cross 保留/取舍指引）

- [ ] **步骤 1：conventions.md 术语表新增条目**

在 `### R3 预防性审查` 条目之后新增：

```markdown
### evidenceAnchor

- **规范定义**：图谱节点（graph.json nodes[]）结论的事实锚点，由 **A 子代理 ingestion 时**声明"该节点结论依据什么事实"（A-chunk 提取 REQ 节点时对来源声明，A-cross 合并保留），
  格式遵循本文件「格式约定」§2.1（`path:§section=statement` / `path:L42=statement`）；未声明时省略该字段（可选，R15 不强制）。
  S 子代理产出需求规格 §4.2 时**只读 graph.json 同步呈现**，不改图谱节点（S 改图谱命中反模式 #11）。
  与 VerifierOutput.subCriteria[].evidence 的区别：evidence 是**评审者**证明"我核验过"的证据；
  evidenceAnchor 是**产出者（A）**声明"我依据这个"的前提，二者互补不互相替代。
- **_Avoid_**：证据锚点/sourceRef/proof（字段名固定「evidenceAnchor」；「证据」在 VerifierOutput 语境指评审证据）
```

- [ ] **步骤 2：requirement-spec.md 模板 §4.2 表增列**

表头追加 `| evidenceAnchor |`，每行最后一个单元格改为 `| {{可选: 依据文档/用户原话}} |`（模板示例行套 `{{}}` 占位）。表下「强制项/禁止行为」说明追加一句：

```markdown
> `evidenceAnchor` 列为可选（A 子代理在 graph.json 声明、S 只读同步展示）；未声明不影响本模板合法性。
```

- [ ] **步骤 3：ingestion-chunk.md 增加 A-chunk 声明指引**

在「REQ 入学锐利性测试」节附近追加小节：

```markdown
### evidenceAnchor 可选声明（A-chunk）

- 提取 REQ 节点时，若该节点结论来自明确事实（用户原话 / 指定文档段落 / 外部依赖版本 / 已读代码），在节点上填写 `evidenceAnchor`（格式见 conventions.md 列定位约定）。
- 无法定位到具体事实时**省略**该字段（不强制、不填空串）；可选字段不影响图谱通过。
- 示例：`"evidenceAnchor": "docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）"`
```

- [ ] **步骤 4：ingestion-cross.md 增加 A-cross 保留指引**

在合并细则中追加：

```markdown
### evidenceAnchor 保留与取舍（A-cross）

- 合并时保留各节点 `evidenceAnchor`；同节点多来源冲突时取来源最具体的，并在 `cross-analysis-report.md` 记录取舍理由。
- 不因合并歧义而删除既有合法锚点（除非来源确实失效，此时省略并记录）。
```

- [ ] **步骤 5：运行 docs-consistency 确认无新红灯**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（此时 references 仍 58——evidence-anchored-tree.md 尚未新增）

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/references/conventions.md w-model-dev/templates/requirement-spec.md w-model-dev/references/ingestion-chunk.md w-model-dev/references/ingestion-cross.md
git commit -m "docs(evidence-tree): register evidenceAnchor term + template column + ingestion guidance"
```

---

### 任务 5：新增 references/evidence-anchored-tree.md 方法论参照

**文件：**
- 新增：`w-model-dev/references/evidence-anchored-tree.md`

- [ ] **步骤 1：整文件写入（内容见详细设计 §5 定稿）**

从 `docs/superpowers/specs/2026-08-31-evidence-anchored-tree-detailed-design.md` §5 复制完整 Markdown 到 `w-model-dev/references/evidence-anchored-tree.md`，逐字一致。

- [ ] **步骤 2：运行 docs-consistency 确认 references 计数同步提示**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 1，提示"SKILL.md 声明 58 个 .md，实际 59"（预期红灯，下一步修 SKILL.md）

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/references/evidence-anchored-tree.md
git commit -m "docs(evidence-tree): add methodology reference (evidence-anchored-tree)"
```

> 注意：步骤 2 的 exit 1 是**预期过渡态**——本任务单独提交后可先合并任务 6 修复 SKILL.md 计数，再跑最终门禁；若仓库要求单提交全绿，则与任务 6 合并为一个提交。

---

### 任务 6：版本号 + SKILL.md + README + skill-metadata 同步（v42.1.0）

**文件：**
- 修改：`w-model-dev/SKILL.md`（frontmatter version 42.0.0→42.1.0；资源计数 references 58→59；按需加载表追加）
- 修改：`w-model-dev/skill-metadata.json`（version + updatedAt）
- 修改：`w-model-dev/scripts/__tests__/skill-metadata.test.ts`（若硬编码版本则同步；若动态比对 SKILL.md 则仅改 SKILL.md）
- 修改：`README.md`（文件树 references 58→59；`必读文档` 或相关列表可加 evidence-anchored-tree.md）

- [ ] **步骤 1：确认 skill-metadata.test.ts 是否硬编码版本**

运行：`grep -n "42\.0\.0\|version" w-model-dev/scripts/__tests__/skill-metadata.test.ts | head`
按结果决定：动态比对 → 只改 SKILL.md frontmatter；硬编码 → 同步改。

- [ ] **步骤 2：SKILL.md frontmatter 版本号**

`version: 42.0.0` → `version: 42.1.0`

- [ ] **步骤 3：SKILL.md 资源计数**

「门禁契约与资源清单」节：`references/`（58 个 .md）→ `references/`（59 个 .md）。

- [ ] **步骤 4：SKILL.md 按需加载表**

「所有阶段另读 rtm-guide.md；…」行，在 `decision 相关` 后追加：`证据支撑树参照（路径不确定项目）→ evidence-anchored-tree.md`。

- [ ] **步骤 5：skill-metadata.json**

`"version": "42.1.0"`、`"updatedAt": "2026-08-31"`。

- [ ] **步骤 6：README.md 文件树**

`references/`（58 份…）→ `references/`（59 份…）。

- [ ] **步骤 7：运行 docs-consistency 确认全绿**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（references-count 59=59）

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json w-model-dev/scripts/__tests__/skill-metadata.test.ts README.md
git commit -m "release(42.1.0): add evidenceAnchor + evidence-tree reference, bump version"
```

---

### 任务 7：SSoT 更新（§4A.1b / §7.7 / §10A）

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`

- [ ] **步骤 1：§4A.1 表后新增 §4A.1b**

在 §4A.1 表格之后、`### 4A.2 失败模式清单` 之前插入（定稿见详细设计 §6.1）：

```markdown
### 4A.1b 产出期证据锚点声明（evidenceAnchor）

- **行为**：A 子代理 ingestion 提取 REQ 节点时，可对结论来源声明 `evidenceAnchor`（用户原话 / 文档段落 / 外部依赖版本，格式见 conventions.md 列定位约定）；S 子代理产出规格 §4.2 只读同步；S 不改图谱节点（反模式 #11）。
- **强度**：可选——未声明不视为缺陷；声明了则格式必须合法（G 门禁 R15）。
- **与评审证据的关系**：evidenceAnchor 是产出者声明（前提），VerifierOutput.evidence 是评审者核验（证明），二者互补。
- **吸收来源**：外部方法论「证据支撑树联合分析模式」（Evidence-Anchored Decision Tree），参照文档 `w-model-dev/references/evidence-anchored-tree.md`。
```

- [ ] **步骤 2：§7.7 要点追加 evidenceAnchor 行**

在 §7.7「要点」的 REQ level 说明之后追加：

```markdown
- **可选字段 evidenceAnchor**：节点结论的前提事实锚点（产出期声明，A 子代理 ingestion 时写 / S 规格 §4.2 只读同步 / G 门禁 R15 格式校验）；未声明不阻断（向后兼容）。
```

- [ ] **步骤 3：§10A 追加一行**

在 §10A 表格 `| 4A 核心操作行为与失败模式 |` 行之后追加（定稿见详细设计 §6.3）。

- [ ] **步骤 4：Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): add 4A.1b evidenceAnchor behavior + 7.7 field + 10A trace row"
```

---

### 任务 8：CHANGELOG + 全量门禁验证

**文件：**
- 修改：`CHANGELOG.md`

- [ ] **步骤 1：CHANGELOG 顶部新增 42.1.0 节**

在 `# 变更日志` 头部说明之后、`## [42.0.0]` 之前插入：

```markdown
## [42.1.0] - 2026-08-31

### 新增（证据支撑树方法论集成）

- **产出期证据锚点（evidenceAnchor）**：图谱节点可选声明结论事实锚点（由 A 子代理 ingestion 时声明、S 规格 §4.2 只读同步、V 评审可核验、G 门禁 R15 格式校验）；复用现有 EVIDENCE_PATTERN 格式，向后兼容存量 graph.json（未声明不阻断）。graph.schema.json / graph-logic.ts / conventions.md / requirement-spec.md 同步。
- **方法论参照文档**：新增 `references/evidence-anchored-tree.md`（证据支撑树 × W 模型映射 + 唯一增量 + 明确拒绝照搬点）。references 58→59。
- **自我纳入机制**：A 子代理 ingestion 指引（ingestion-chunk/cross）注明 evidenceAnchor 可选声明时机；SSoT §4A.1b / §7.7 / §10A 同步；self-test 基线 260→262。
- 设计/SSoT 变更草案与详细设计见 `docs/superpowers/specs/2026-08-31-evidence-anchored-tree-*.md`，实施计划见 `docs/superpowers/plans/2026-08-31-evidence-anchored-tree-integration.md`。
```

- [ ] **步骤 2：全量门禁验证**

运行：`npm run self-test`
预期：exit 0，262 条

运行：`npx vitest run --config config/vitest.config.ts`
预期：全绿

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0

运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：exit 0

运行：`npm run prepush`
预期：17 项门禁全绿（若环境缺 node_modules/网络则按仓库纪律处理，绝不 `npm install` 自动补装）

- [ ] **步骤 3：Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 42.1.0 evidence-anchored-tree integration"
```

---

### 任务 9：收尾复核（可选，若 pre-push 有红灯）

**文件：** 视红灯定位；预计涉及 `w-model-dev/scripts/samples/README.md` 或 README 计数微调。

- [ ] **步骤 1：定位红灯**

运行：`npm run prepush`
若失败，逐条查看输出；优先核对 references 计数（三处文档）、self-test 用例数（README/samples-README/self-test）、schema/生成物清单。

- [ ] **步骤 2：修复并复跑**

修复后重跑 `npm run prepush` 直到 17 项全绿。

- [ ] **步骤 3：Commit**

```bash
git add -A
git commit -m "fix: resolve prepush red lights from 42.1.0 integration"
```

---

## 自检记录（编写时执行）

- **规格覆盖度**：详细设计 §2.1-2.5（schema/类型/R15/术语/模板）→ 任务 1/2/4；§4 文档清单全部 16 项 → 任务 1-8 全覆盖；§5 reference 全文 → 任务 5；§6 SSoT 三节 → 任务 7；§7 测试设计（单测 4 例 + 样本 2 个）→ 任务 2/3。
- **占位符扫描**：所有代码块为完整可粘贴内容；无 TODO/待定/后续实现；fixture 以现网 valid-req-hierarchy.json 为底本（任务 3 明确给出操作）。
- **类型一致性**：`evidenceAnchor?: string`（GraphNode）↔ schema `"type":"string"` ↔ R15 正则检查一致；R15 violation 消息字符串在单测断言与 self-test expectedReasonPatterns 中逐字一致（`R15 evidenceAnchor 格式校验失败`）；版本号 42.1.0 在 SKILL.md/skill-metadata/CHANGELOG 三处一致。

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-08-31-evidence-anchored-tree-integration.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点
