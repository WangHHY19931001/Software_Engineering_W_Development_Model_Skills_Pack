# 门禁完整性与证据事实对账 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复三项既有门禁缺陷（悬空规范 / 死引用 / 空即合规），并把证据校验从"形状合规"升级为"事实对账"（锚点必填 + 常态扫描 + 路径覆盖 + 评审偏移检测）。

**架构：** 四批推进，风险递增：批 1 纯文档（零 schema/脚本，可独立回滚）；批 2 checker bug（R3 判据接上）；批 3 契约扩展（图谱锚点必填 + 冰山分母对账 + V 侧交叉对账，含 124 节点迁移，唯一破坏性变更）；批 4 非门禁校准集。全部落地后跑一轮完整 e2e 调测以校准先行阈值。

**技术栈：** TypeScript（tsx runtime）、vitest、ajv（schema 校验）、Node 标准库；无新增依赖。

**规格来源：** [`docs/superpowers/specs/2026-09-12-gate-integrity-and-evidence-denominator-design.md`](../specs/2026-09-12-gate-integrity-and-evidence-denominator-design.md)（决策编号 D1-D23 在下文按需引用）

---

## 文件结构

### 批 1 — 纯文档（零代码）

| 文件 | 职责 | 改动 |
| --- | --- | --- |
| `w-model-dev/references/verifier-spec.md` | 评审规范（权威） | A-1：`:278` 四问落回 `summary` 文本 |
| `w-model-dev/references/hard-constraints.md` | 硬约束 + 反模式（权威） | A-2：5 处死引用改指 |
| `w-model-dev/references/quality-standards.md` | 质量门标准 | A-2：1 处死引用改指 |
| `w-model-dev/references/workflow.md` | 阶段流与门 | A-2：`:121` 改指；`:11` 目录项拆两项 |

### 批 2 — checker bug 修复

| 文件 | 职责 | 改动 |
| --- | --- | --- |
| `w-model-dev/scripts/logic/preventive-review-logic.ts` | R3 三报告校验（纯逻辑） | A-3a：`passed`/`findingCount` 纳入 `reasons` |
| `w-model-dev/scripts/__tests__/preventive-review-logic.test.ts` | 上述逻辑的单测 | 补 `passed=false` 产出 violation 用例 |
| `w-model-dev/scripts/samples/preventive-review/` | R3 fixture | 补 `bad-passed-false.json` |

### 批 3 — 契约扩展（破坏性）

| 文件 | 职责 | 改动 |
| --- | --- | --- |
| `w-model-dev/schemas/graph.schema.json` | 图谱契约 | `evidenceAnchor` 改必填；新增 `evidenceStatus` |
| `w-model-dev/scripts/logic/graph-logic.ts` | 图谱门禁 R1-R15 | R15 拆 a-e 五子项 |
| `w-model-dev/scripts/logic/iceberg-sweep-logic.ts` | 冰山扫掠校验 | `ICEBERG_VIEW_PRESENCE` + 三视角对账 |
| `w-model-dev/schemas/iceberg-sweep.schema.json` | 冰山契约 | `sweptArtifacts` 加 `minItems: 1` |
| `w-model-dev/scripts/logic/run-log-logic.ts` | run-log 跨条目校验 R1-R8 | 新增跨轮次一致性规则 |
| `w-model-dev/schemas/exemption.schema.json` | 豁免契约 | `type` enum 加第 6 值 |
| `w-model-dev/scripts/logic/exemption-logic.ts` | 豁免校验 E1-E9 | 同步 TS union |
| `w-model-dev/scripts/samples/graph/` | 31 fixture / 124 节点 | 补两字段（机械迁移） |
| `w-model-dev/scripts/samples/iceberg/` | 冰山 fixture | 补 3 反例 |
| `w-model-dev/scripts/samples/run-log/` | run-log fixture | 补跨轮次不一致反例 |
| `w-model-dev/scripts/samples/preventive-review/` | R3 fixture | 见批 2 |
| `w-model-dev/scripts/cli/self-test.ts` | 回归基线（322 条） | 新样本登记进 `<AREA>_CASES` |
| `w-model-dev/scripts/samples/README.md` | 样本矩阵 | 新样本矩阵行 |
| `w-model-dev/references/quick-self-check.md` | DoD 自检 | 新增 pending 扫描项 |
| `w-model-dev/references/evidence-anchored-tree.md` | 方法论参照 | 更新 §3 |
| `w-model-dev/references/iceberg-sweep-guide.md` | 冰山指南 | 同步对账算法 |
| `w-model-dev/references/verifier-spec.md` | 评审规范 | 新增 §12 偏移检测 |
| `w-model-dev/references/signature-chain-guide.md` | 签名链指南 | 说明 R15e 读取契约 |
| `docs/skill-design-document_SSoT.md` | 单一事实源 | 新增权威定义节 |

### 批 4 — 非门禁校准集

| 文件 | 职责 | 改动 |
| --- | --- | --- |
| `w-model-dev/scripts/samples/verifier-calibration/` | 人工标注锚定集 | 新建目录 + README（声明非门禁） |
| `w-model-dev/scripts/samples/README.md` | 样本矩阵 | 新增矩阵行 |
| `w-model-dev/references/command-reference.md` | 命令参考 | 校准命令登记（可选命令） |

### 收尾

| 文件 | 职责 |
| --- | --- |
| `CHANGELOG.md` | 新增 `### 门禁完整性与证据事实对账（gate-integrity-evidence-reconciliation，2026-09-12）` |
| `eval/e2e/2026-09-12-gate-integrity-*.md` | e2e 调测记录（D23） |
| `eval/w-model-dev-results.tsv` | 追加调测行 |

---

## 批 1：纯文档（零 schema / 零脚本 / 零样本）

> 批 1 全部为文档改动，`npm run self-test` 与 `npm test` 不受影响；但 `npm run check:docs-consistency` 必须保持 exit 0（它校验内链与计数）。

### 任务 1：A-1 verifier-spec R14-R17 落回字符串

**文件：**
- 修改：`w-model-dev/references/verifier-spec.md:278`

- [ ] **步骤 1：读取当前文本确认锚点**

运行：`sed -n '278p' w-model-dev/references/verifier-spec.md`
预期：输出以 `  - 实现：R14-R17 为评审附加检查项，四问结论记录于 VerifierOutput 的 \`summary\` 字段（如 \`collaborationReview: { handoff, planAdherence, roleFit, incrementalValue }\`）` 开头。

- [ ] **步骤 2：替换 :278 整行**

把该行整体替换为（保持为 R17 条目下的子项，缩进两空格）：

```
  - 实现：R14-R17 为评审附加检查项，四问结论以固定前缀写入 VerifierOutput 的 `summary` 文本
    （`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），**不进入 `subCriteria` 数组**——§2.3 与 verifier-logic.ts
    强制 subCriteria 数量固定为 5（不允许子集/超集），追加会破坏 `check-verifier-output.ts` 校验。
    R14-R17 仅当 `VerifierOutput.targetKind ∈ {design, code}` 且产物含多角色来源时启用；不破坏既有 R1-R13。
```

- [ ] **步骤 3：验证改动**

运行：`grep -c "collaborationReview" w-model-dev/references/verifier-spec.md`
预期：`0`（旧的结构化对象示例已移除）

运行：`grep -n "交接：" w-model-dev/references/verifier-spec.md`
预期：命中 1 行（新的固定前缀）

- [ ] **步骤 4：验证 §6 类型定义无需改动（单侧修正确认）**

运行：`grep -n "summary: string" w-model-dev/references/verifier-spec.md`
预期：至少命中 1 行——证明 §6 本就声明 `summary` 为 string，与 schema 一致，故本次为单侧修正。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(verifier-spec): write R14-R17 findings into summary text, not a structured object

The spec prescribed summary.collaborationReview as an object while the schema
declares summary as a string inside additionalProperties:false, which no input
can satisfy. Zero code implements collaborationReview, so the fixed-prefix
text form preserves the four-question requirement at no schema cost."
```

### 任务 2：A-2 死引用改指（hard-constraints.md 5 处）

**文件：**
- 修改：`w-model-dev/references/hard-constraints.md:188`、`:208`、`:261`、`:293`、`:507`

- [ ] **步骤 1：确认 SKILL.md 无该章节**

运行：`grep -c "阶段门与质量门" w-model-dev/SKILL.md`
预期：`0`

- [ ] **步骤 2：确认 workflow.md 的真实章节名**

运行：`grep -n "^## " w-model-dev/references/workflow.md`
预期：含 `## 阶段门评审（每个阶段统一）` 与 `## 质量门（编码及之后阶段强制）`

- [ ] **步骤 3：逐处替换（**不得批量替换，语义不同**）**

| 行 | 语义 | 原文片段 | 替换为 |
| --- | --- | --- | --- |
| `:188` | 反模式 #1 阶段门评审 | `必须按 SKILL.md「阶段门与质量门」节走完评审` | `必须按 workflow.md「阶段门评审（每个阶段统一）」节走完评审` |
| `:208` | 反模式 #21 `--phase=N` | `（见 [SKILL.md](../SKILL.md)「阶段门与质量门」节）` | `（见 [quality-standards.md](quality-standards.md)「质量门检查清单」节）` |
| `:261` | #21 脚本映射行 | `[SKILL.md](../SKILL.md)「阶段门与质量门」节` | `[quality-standards.md](quality-standards.md)「质量门检查清单」节` |
| `:293` | #1 检测信号行 | `SKILL.md「阶段门与质量门」节 + 🔴 CHECKPOINT · 阶段门放行` | `workflow.md「阶段门评审（每个阶段统一）」节 + 🔴 CHECKPOINT · 阶段门放行` |
| `:507` | self-as-verifier 说明 | `SKILL.md「阶段门与质量门」节已指引阶段 6/7/8` | `quality-standards.md「质量门检查清单」节已指引阶段 6/7/8` |

- [ ] **步骤 4：验证 5 处全部改完**

运行：`grep -c "阶段门与质量门" w-model-dev/references/hard-constraints.md`
预期：`0`

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/references/hard-constraints.md
git commit -m "docs(hard-constraints): point stage-gate references at real sections

Five citations named a SKILL.md section that does not exist. They are prose
section citations rather than markdown links, so checkInternalLinks cannot
catch them. Each now points at the section that actually carries the
semantics (workflow.md for the stage-gate review, quality-standards.md for
the --phase=N mandate and quality gate)."
```

### 任务 3：A-2 死引用改指（quality-standards.md + workflow.md）

**文件：**
- 修改：`w-model-dev/references/quality-standards.md:185`
- 修改：`w-model-dev/references/workflow.md:11`、`:121`

- [ ] **步骤 1：改 quality-standards.md:185**

把该行的尾句 `详见 [SKILL.md](../SKILL.md)「阶段门与质量门」节与 [hard-constraints.md](hard-constraints.md) #3/#6/#7。`
替换为：`详见 [workflow.md](workflow.md)「质量门（编码及之后阶段强制）」节与 [hard-constraints.md](hard-constraints.md) #3/#6/#7。`

- [ ] **步骤 2：改 workflow.md:121**

把 `- 评审流程详见 [\`verifier-spec.md\`](verifier-spec.md) 与 SKILL.md「阶段门与质量门」节。`
替换为：`- 评审流程详见 [\`verifier-spec.md\`](verifier-spec.md) 与本文件「阶段门评审（每个阶段统一）」节。`

- [ ] **步骤 3：改 workflow.md:11 目录项**

把单行 `- 阶段门与质量门` 替换为两行：

```
- 阶段门评审（每个阶段统一）
- 质量门（编码及之后阶段强制）
```

**理由**：该文件章节已拆分为两节，`阶段门与质量门` 是指向已拆分章节的过期目录项（不是合法自指）。

- [ ] **步骤 4：验证全仓清零**

运行：`grep -rn "阶段门与质量门" w-model-dev/ | wc -l`
预期：`0`

- [ ] **步骤 5：验证内链门禁通过**

运行：`npm run check:docs-consistency`
预期：exit 0

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/references/quality-standards.md w-model-dev/references/workflow.md
git commit -m "docs(references): fix remaining dead section citations

quality-standards.md:185 and workflow.md:121 cited the same non-existent
SKILL.md section. workflow.md:11 was a table-of-contents entry for a section
that has since been split into the stage-gate review and the quality gate,
so it becomes two entries. Prose citations like these are outside
checkInternalLinks' scope, which only resolves [text](path) link targets."
```

---

## 批 2：R3 判据接上（checker bug）

> 这是纯逻辑层改动，会触及覆盖率阈值（`config/vitest.config.ts` 的 75/65/85/75），故必须补单测。

### 任务 4：A-3a R3 预防性审查读取 passed / findingCount

**文件：**
- 修改：`w-model-dev/scripts/logic/preventive-review-logic.ts:44-46`（注释）、`:86-92`（summary 构造处）
- 测试：`w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`
- 创建：`w-model-dev/scripts/samples/preventive-review/bad-passed-false.json`

- [ ] **步骤 1：编写失败的测试**

在 `preventive-review-logic.test.ts` 末尾追加：

```ts
describe('passed=false 的 R3 报告必须产生 violation', () => {
  it('三份报告齐备但其一 passed=false → passed 应为 false 且 reasons 指名该维度', () => {
    const out = checkPreventiveReview({
      phase: 3,
      variant: 'standard',
      reviews: [
        { dimension: 'completeness', passed: true, findings: [] },
        { dimension: 'reliability', passed: false, findings: [{ severity: 'Required', description: 'x', evidence: 'y' }] },
        { dimension: 'security', passed: true, findings: [] },
      ],
    } as never);
    assert.equal(out.passed, false);
    assert.ok(out.reasons.some((r) => r.includes('reliability')));
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts -t "passed=false 的 R3 报告"`
预期：FAIL——`out.passed` 为 `true`（当前实现从不读 `passed`）

- [ ] **步骤 3：编写最少实现代码**

在 `preventive-review-logic.ts` 的 `reviewSummaries.push({...})` 之前（约 `:86`）插入：

```ts
    if (review.passed === false) {
      reasons.push(
        `R3 报告声明未通过：${dim} 维度 passed=false（findings=${review.findings.length}）；` +
          `V 评审须读取本报告并将发现纳入 reworkHints（反模式 #33）`,
      );
    }
```

同时把 `:44-46` 的注释从

```
 * - 每份报告 passed=true（或 passed=false 但 V 已纳入 reworkHints，此处只校验报告存在性和格式）
```

改为

```
 * - 每份报告 passed=true；passed=false 时本校验产生 violation（由 V 评审读取并纳入 reworkHints）
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts -t "passed=false 的 R3 报告"`
预期：PASS

- [ ] **步骤 5：创建 fixture 并登记**

创建 `w-model-dev/scripts/samples/preventive-review/bad-passed-false.json`（一份 passed=false 的报告）。

在 `self-test.ts` 的 `PREVENTIVE_REVIEW_CASES`（或同名数组）追加：

```ts
  {
    file: 'preventive-review/bad-passed-false.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed=false/],
    description: 'R3 报告 passed=false 须产生 violation',
  },
```

- [ ] **步骤 6：运行全量回归**

运行：`npm run self-test`
预期：exit 0，总用例数 = 原 322 + 新增数（记住该数字，后续任务需保持同步）

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/preventive-review-logic.ts w-model-dev/scripts/__tests__/preventive-review-logic.test.ts w-model-dev/scripts/samples/preventive-review/ w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(preventive-review): read passed and findingCount instead of only report shape

The checker copied review.passed and findingCount into its summary but never
pushed them into reasons, so three schema-valid reports with passed:true and
findings:[] passed. The schema already enforces findings.minItems:1 when
passed is false, so the contract was sound and only the checker was blind."
```

---

## 批 3：契约扩展（破坏性）

> **批 3 是唯一破坏性变更**：`graph.schema.json` 的 `evidenceAnchor` 从可选改必填，且节点为 `additionalProperties:false`，故必须先改 schema 再迁移 fixture。批 3 的每个任务都必须以 `npm run self-test` + `npm run check:docs-consistency` 双绿收尾。

### 任务 5：A-3c-1 graph schema 新增字段（先 schema 后 fixture）

**文件：**
- 修改：`w-model-dev/schemas/graph.schema.json`（`nodes.items.properties` 内）

- [ ] **步骤 1：读取现有 evidenceAnchor 定义确认锚点**

运行：`grep -n "evidenceAnchor" w-model-dev/schemas/graph.schema.json`
预期：命中 1 行（节点属性，`"type": "string"`，描述含"可选"）

- [ ] **步骤 2：改 evidenceAnchor 为必填并更新描述**

把该属性的 description 改为：

```
"节点结论的前提事实锚点（阶段 1-4 全节点必填）：产出期声明该 REQ/SD/INTF/DD 节点结论所依据的事实来源，格式遵循 conventions.md 列定位约定（path:§section=statement 或 path:L42=statement）。由 A 子代理 ingestion 时声明；S 子代理产出规格 §4.2 只读同步；G 门禁 R15a-e 校验（缺失/状态/存在性/覆盖/签名链环）。"
```

- [ ] **步骤 3：新增 evidenceStatus 属性**

在 `evidenceAnchor` 属性之后加入：

```json
"evidenceStatus": {
  "description": "证据状态（阶段 1-4 全节点必填）：confirmed=已核验（须在签名链中存在引用本节点的 V review 环，R15e 校验）；pending=基于逻辑推理尚未验证（阶段门放行前被扫描阻断，须补验证转 confirmed 或走 exemption 的 evidence-anchor-pending 豁免）。语义区别于 coverageStatus.partial（后者意为覆盖不完整）。",
  "type": "string",
  "enum": ["confirmed", "pending"]
}
```

- [ ] **步骤 4：把两者加入节点 required 数组**

把 `nodes.items.required` 从
`["id", "type", "phase", "title", "summary"]`
改为
`["id", "type", "phase", "title", "summary", "evidenceAnchor", "evidenceStatus"]`

- [ ] **步骤 5：验证 schema 可解析且新属性有 description**

运行：`npx tsx -e "import {validateBySchema} from './w-model-dev/scripts/infrastructure/schema-loader.js'; console.log(typeof validateBySchema)"`
预期：输出 `function`

运行：`npm run check:docs-consistency`
预期：exit 0（`checkSchemaFieldDescriptions` 强制每个新属性有 description；若失败说明步骤 2/3 的 description 缺失）

- [ ] **步骤 6：Commit（仅 schema，fixture 在下一任务）**

```bash
git add w-model-dev/schemas/graph.schema.json
git commit -m "feat(graph-schema): require evidenceAnchor and add evidenceStatus

evidenceAnchor was optional with 'undeclared does not block', which would
have made leaving it blank the cheapest pass path for the pending scan -
the same hole as newFindings: [] and sweptArtifacts: []. evidenceStatus
carries the pending state as a first-class field rather than overloading
coverageStatus.partial, whose meaning is incomplete coverage, not an
unverified conclusion. No third colour is added: invalid is already carried
by coverageStatus plus the rework chain."
```

### 任务 6：A-3c-2 迁移 124 个节点（机械）

**文件：**
- 修改：`w-model-dev/scripts/samples/graph/*.json`（31 个含 nodes 的 fixture）

- [ ] **步骤 1：写迁移脚本并先做 dry-run**

创建临时脚本 `scripts/tmp-migrate-anchors.cjs`（**不 commit**，用完删除）：

```js
// 为 samples/graph/*.json 的每个节点补 evidenceAnchor + evidenceStatus
// evidenceAnchor 取该节点自身可核对的最小事实：path:§section=summary 形式
const fs = require('node:fs');
const path = require('node:path');
const dir = 'w-model-dev/scripts/samples/graph';
let files = 0, nodes = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, 'utf8');
  let d;
  try { d = JSON.parse(raw); } catch { continue; }
  const ns = d.nodes || (d.graph && d.graph.nodes);
  if (!Array.isArray(ns) || ns.length === 0) continue;
  let touched = false;
  for (const n of ns) {
    if (n.evidenceAnchor === undefined) {
      n.evidenceAnchor = `${f}:§${n.id}=${String(n.summary || n.title).slice(0, 40)}`;
      touched = true;
    }
    if (n.evidenceStatus === undefined) { n.evidenceStatus = 'confirmed'; touched = true; }
    nodes++;
  }
  if (touched) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); files++; }
}
console.log(`migrated files=${files} nodes=${nodes}`);
```

运行：`node scripts/tmp-migrate-anchors.cjs`
预期：输出 `migrated files=<N> nodes=`，N 应接近 31

- [ ] **步骤 2：逐 fixture 确认反例意图未被掩盖（关键）**

对每个 `bad-*.json`，用 `npm run self-test` 确认它**仍然因原有原因失败**，而不是因为新增的锚点 violation：

运行：`npm run self-test`
预期：**出现失败**——若有 `bad-*` fixture 原本就依赖"缺锚点不阻断"，或迁移脚本给反例节点也填了锚点使新 violation 不触发，此处会暴露。

对每个失败的 `bad-*` fixture，人工判定：它的期望 violation 是否仍是原来的？若某反例的**意图**变成"期望锚点 violation"，则把它从迁移脚本中排除并在任务 7 显式新增为 `bad-evidence-anchor-missing.json`。

- [ ] **步骤 3：修正迁移脚本并重跑，直到 self-test 基线全绿**

反复调整（排除反例 fixture / 修正 anchor 格式），直到：

运行：`npm run self-test`
预期：exit 0，总用例数 = 任务 4 记录的数（**迁移不改变用例数**）

- [ ] **步骤 4：删除临时脚本**

运行：`rm scripts/tmp-migrate-anchors.cjs && git status --porcelain | grep tmp-migrate | wc -l`
预期：`0`

- [ ] **步骤 5：验证图谱门禁在迁移后通过**

运行：`npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev/scripts/samples/graph/valid-warnings.json --phase=1`
预期：exit 0（迁移后 schema 校验通过；注意此时 R15 尚未扩展，故只验 schema）

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/samples/graph/
git commit -m "test(graph-samples): migrate 124 nodes to the required anchor fields

Mechanical migration for the now-required evidenceAnchor and the new
evidenceStatus. Every negative fixture was checked individually to confirm
it still fails for its original reason rather than being masked by the new
field requirements."
```

### 任务 7：A-3c-3 R15 拆 a-e 五子项 + 新增反例

**文件：**
- 修改：`w-model-dev/scripts/logic/graph-logic.ts:799-810`（R15 块）
- 测试：`w-model-dev/scripts/__tests__/graph-logic.test.ts`
- 创建：`w-model-dev/scripts/samples/graph/bad-evidence-anchor-missing.json`、`bad-evidence-status-invalid.json`、`bad-evidence-path-missing.json`、`bad-evidence-not-covered.json`、`bad-evidence-confirmed-no-signature.json`

- [ ] **步骤 1：编写失败的测试（R15a 缺锚点）**

在 `graph-logic.test.ts` 追加：

```ts
describe('R15a evidenceAnchor 必填', () => {
  it('节点缺 evidenceAnchor → violation', () => {
    const graph = {
      version: '1.0', currentPhase: 1,
      nodes: [{ id: 'REQ-001', type: 'REQ', phase: 1, title: 't', summary: 's' }],
      edges: [],
    };
    const out = checkRequirementGraph(graph, 1);
    assert.equal(out.passed, false);
    assert.ok(out.violations.some((v) => v.includes('R15a')));
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts -t "R15a evidenceAnchor 必填"`
预期：FAIL——无 `R15a` 前缀的 violation（当前 R15 不校验缺失）

- [ ] **步骤 3：重写 R15 块为五子项**

把 `graph-logic.ts:799-810` 的 R15 块整体替换为：

```ts
  // R15a-e: evidenceAnchor 必填 + evidenceStatus + 路径存在性 + 覆盖对账 + 签名链对账
  // 格式复用 verifier-logic EVIDENCE_PATTERN 语义（禁止定义第三套解析）
  const EVIDENCE_ANCHOR_PATTERN = /^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/;
  const VALID_EVIDENCE_STATUS = ['confirmed', 'pending'] as const;
  const missingAnchors: string[] = [];
  const badStatus: string[] = [];
  const badFormat: string[] = [];
  const missingPaths: string[] = [];
  for (const n of g.nodes) {
    // R15a 必填
    if (typeof n.evidenceAnchor !== 'string' || n.evidenceAnchor === '') {
      missingAnchors.push(n.id);
      continue;
    }
    // 格式
    if (!EVIDENCE_ANCHOR_PATTERN.test(n.evidenceAnchor)) badFormat.push(`${n.id}（${n.evidenceAnchor}）`);
    // R15b 状态枚举
    if (!VALID_EVIDENCE_STATUS.includes(n.evidenceStatus as never)) {
      badStatus.push(`${n.id}（${String(n.evidenceStatus)}）`);
    }
    // R15c 路径存在性（取锚点 path 部分，即 `:` 之前）
    const anchorPath = n.evidenceAnchor.split(':')[0];
    if (!fs.existsSync(path.join(process.cwd(), anchorPath))) {
      missingPaths.push(`${n.id}（${anchorPath}）`);
    }
  }
  if (missingAnchors.length > 0) {
    result.violations.push(`R15a evidenceAnchor 缺失：${missingAnchors.join(', ')}（阶段 1-4 全节点必填）`);
  }
  if (badFormat.length > 0) {
    result.violations.push(
      `R15 evidenceAnchor 格式校验失败：${badFormat.join('；')}（格式须为 path:§section=statement 或 path:L42=statement）`,
    );
  }
  if (badStatus.length > 0) {
    result.violations.push(`R15b evidenceStatus 非法：${badStatus.join(', ')}（须为 confirmed | pending）`);
  }
  if (missingPaths.length > 0) {
    result.violations.push(`R15c 证据路径不存在：${missingPaths.join(', ')}（引用的东西必须真实存在）`);
  }
```

在文件顶部确认 `fs` 与 `path` 已 import；若未 import 则加 `import * as fs from 'node:fs';` 与 `import * as path from 'node:path';`。

- [ ] **步骤 4：运行测试验证 R15a 通过**

运行：`npx vitest run --config config/vitest.config.ts -t "R15a evidenceAnchor 必填"`
预期：PASS

- [ ] **步骤 5：补 R15b / R15c 测试与 fixture**

按步骤 1 的模式追加 R15b（`evidenceStatus: 'maybe'` → 含 `R15b`）与 R15c（`evidenceAnchor: 'nonexistent/file.ts:§x=y'` → 含 `R15c`）两条测试；同时创建对应 `bad-*.json` fixture 并在 `self-test.ts` 登记（`expectedPassed: false`，`expectedReasonPatterns: [/R15b/]` / `[/R15c/]`）。

- [ ] **步骤 6：实现 R15d（覆盖对账）与 R15e（签名链对账）**

**R15d**：移植 `hard-constraints.md:79` 的 codegraph `--scope` 语义。实现前先读：

运行：`grep -rn "targetFiles\|changeId" w-model-dev/scripts/logic/*.ts | head -20`

据其可解析表达，对每个节点锚点的 path 校验"是否被某个已落盘记录覆盖"；口径不确定时**停在此步并上报**（规格 §5 风险表已登记此风险）。

**R15e**：仅当 `n.evidenceStatus === 'confirmed'` 时触发——读 `.w-model/signature-chain.jsonl`，要求存在引用该节点 id 的 V review 环且其 `inputProvenance` 指向该锚点。若签名链文件不存在（阶段 1 早期），**不产生 violation**（避免早期误红；规格 §5 已登记）。

追加：

```ts
  const noSignatureRing: string[] = [];
  if (n.evidenceStatus === 'confirmed') { /* 见上：查 signature-chain.jsonl */ }
  if (noSignatureRing.length > 0) {
    result.violations.push(`R15e confirmed 缺签名链 V review 环：${noSignatureRing.join(', ')}`);
  }
```

- [ ] **步骤 7：运行全量回归**

运行：`npm run self-test && npx vitest run --config config/vitest.config.ts`
预期：两者均 exit 0

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/logic/graph-logic.ts w-model-dev/scripts/__tests__/graph-logic.test.ts w-model-dev/scripts/samples/graph/ w-model-dev/scripts/cli/self-test.ts
git commit -m "feat(graph-logic): split R15 into five independently located checks

R15a missing, R15b bad status, R15c path does not exist, R15d path not
covered, R15e confirmed without a signature-chain review ring. Splitting
keeps failures locatable: option (c) couples two validations, and without
sub-items a failure would not say which one tripped. R15e only fires on
confirmed, so an early-phase partial signature chain does not go red."
```

### 任务 8：A-3b 冰山扫掠分母对账

**文件：**
- 修改：`w-model-dev/scripts/logic/iceberg-sweep-logic.ts:99-101`
- 修改：`w-model-dev/schemas/iceberg-sweep.schema.json`（`sweptArtifacts` 加 `minItems: 1`）
- 测试：`w-model-dev/scripts/__tests__/iceberg-logic.test.ts`
- 创建：`w-model-dev/scripts/samples/iceberg/bad-view-disagreement.json`、`bad-view-absent-silent.json`、`bad-empty-findings-uncovered.json`

- [ ] **步骤 1：schema 加 minItems**

把 `iceberg-sweep.schema.json` 中 `sweepCoverage.sweptArtifacts` 改为：

```json
{ "type": "array", "minItems": 1, "items": { "type": "string" }, "description": "扫掠的产物路径列表（不得为空：空数组使零发现不可对账）" }
```

- [ ] **步骤 2：编写失败的测试（三视角不一致）**

在 `iceberg-logic.test.ts` 追加：

```ts
describe('A-3b 三视角对账', () => {
  it('两视角应扫集合存在差异 → violation', () => {
    const report = {
      reportId: 'IS-phase3-1-1', phase: 'phase3-outline', triggerType: 'ICEBERG-B',
      icebergRound: 1, sweptAt: '2026-09-12T00:00:00Z', sweptBy: 'R-iceberg',
      线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
      newFindings: [],
      sweepCoverage: { sweptArtifacts: ['a.ts'], sweptDimensions: ['completeness'] },
      summary: 'x'.repeat(60), passed: true,
      // 测试夹具注入：视角集合差异
      _viewSets: { graph: ['n1', 'n2'], tla: ['n1'], rtm: ['n1', 'n2'] },
    };
    const out = checkIcebergSweep(report as never);
    assert.equal(out.passed, false);
    assert.ok(out.reasons.some((r) => r.includes('视角间存在未对账差异')));
  });
});
```

- [ ] **步骤 3：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts -t "A-3b 三视角对账"`
预期：FAIL（无该 violation）

- [ ] **步骤 4：实现在场表常量**

在 `iceberg-sweep-logic.ts` 的 `MAX_ICEBERG_ROUNDS` 附近加：

```ts
/** 各阶段冰山扫掠的三视角在场集合（缺席者显式记为不适用，禁止静默跳过）。 */
const ICEBERG_VIEW_PRESENCE: Record<number, readonly string[]> = {
  1: ['graph', 'rtm'],
  2: ['graph', 'tla', 'rtm'],
  3: ['graph', 'tla', 'rtm'],
  4: ['graph', 'tla', 'rtm'],
  5: ['tla', 'rtm', 'scope'],
  6: ['tla', 'rtm', 'scope'],
  7: ['tla', 'rtm', 'scope'],
  8: ['tla', 'rtm', 'scope'],
};
```

**注**：具体取值须在任务 15（端到端调测）中按各阶段实际产出物核定，本步骤为设计意图取值。

- [ ] **步骤 5：实现三视角对账**

在 R5 块之后插入：

```ts
  // R6-R8: 三视角平权对账（任一差异即刻失败，不允许"已说明"豁免）
  const phaseNum = Number(report.phase.replace(/\D/g, '')) || 0;
  const presentViews = ICEBERG_VIEW_PRESENCE[phaseNum] ?? [];
  const viewSets = (report as unknown as { _viewSets?: Record<string, string[]> })._viewSets ?? {};
  const absentViews: string[] = [];
  const activeViews: string[] = [];
  for (const v of presentViews) {
    if (Array.isArray(viewSets[v])) activeViews.push(v);
    else absentViews.push(v);
  }
  // R6 视角间差异（两两比对，不归一化、不取并集后放行）
  const disagreements: string[] = [];
  for (let i = 0; i < activeViews.length; i++) {
    for (let j = i + 1; j < activeViews.length; j++) {
      const a = new Set(viewSets[activeViews[i]!]!);
      const b = new Set(viewSets[activeViews[j]!]!);
      const diff = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x)));
      if (diff.length > 0) {
        disagreements.push(`${activeViews[i]}↔${activeViews[j]} 差异项：${diff.join(', ')}`);
      }
    }
  }
  if (disagreements.length > 0) {
    reasons.push(`R6 视角间存在未对账差异：${disagreements.join('；')}（走普通 V/G 失败链由 R 定位）`);
  }
  // R7 缺席必须显式记录，不得静默跳过
  if (absentViews.length > 0) {
    const declared = (report as unknown as { sweepCoverage: { absentViews?: string[] } }).sweepCoverage.absentViews ?? [];
    const undeclared = absentViews.filter((v) => !declared.includes(v));
    if (undeclared.length > 0) {
      reasons.push(`R7 视角缺席未显式声明：${undeclared.join(', ')}（禁止静默跳过，须记入 sweepCoverage.absentViews）`);
    }
  }
  // R8 零发现且覆盖不足
  if (report.newFindings.length === 0) {
    const converged = activeViews.length > 0 && disagreements.length === 0
      ? new Set(activeViews.flatMap((v) => viewSets[v]!))
      : null;
    if (converged && !converged.size) {
      reasons.push('R8 零发现但收敛集合为空（无法证明扫掠发生）');
    }
  }
```

同时给 `iceberg-sweep.schema.json` 的 `sweepCoverage` 加可选 `absentViews`：

```json
"absentViews": { "type": "array", "items": { "type": "string" }, "description": "本阶段不参与的视角（显式记录，禁止静默跳过）" }
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts -t "A-3b 三视角对账"`
预期：PASS

- [ ] **步骤 7：补三个 fixture 并登记**

创建 `bad-view-disagreement.json` / `bad-view-absent-silent.json` / `bad-empty-findings-uncovered.json`，在 `self-test.ts` 的 `ICEBERG_CASES` 登记（`expectedPassed: false`，`expectedReasonPatterns` 分别匹配 `R6` / `R7` / `R8`）。

- [ ] **步骤 8：运行全量回归 + 样本覆盖**

运行：`npm run self-test && npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：均 exit 0

- [ ] **步骤 9：Commit**

```bash
git add w-model-dev/scripts/logic/iceberg-sweep-logic.ts w-model-dev/schemas/iceberg-sweep.schema.json w-model-dev/scripts/__tests__/iceberg-logic.test.ts w-model-dev/scripts/samples/iceberg/ w-model-dev/scripts/cli/self-test.ts
git commit -m "feat(iceberg): reconcile sweep coverage against three equal-standing views

Passing was identical to declaring no findings, and sweptArtifacts allowed
the empty array, so the cheapest and most thorough reports were
indistinguishable. The denominator now comes from the upstream artifacts
rather than being self-declared by R, with graph, TLA and RTM checked
pairwise as equals - no primary view, no arbitration, no union-and-proceed.
Any disagreement is a failure signal. Absent views must be declared rather
than silently skipped, the trap signature-chain R8 fell into. Presence is a
code constant so it cannot drift from the implementation."
```

### 任务 9：A-3d V 侧交叉对账

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`
- 创建：`w-model-dev/scripts/samples/run-log/bad-review-level-drift.jsonl`

- [ ] **步骤 1：编写失败的测试（跨轮次等级漂移）**

```ts
describe('A-3d 跨轮次评审一致性', () => {
  it('同一产物两次 review 的 qualityLevel 差 ≥2 档 → violation', () => {
    const entries = [
      { runId: 'r1', phase: 3, role: 'V', action: 'review', artifacts: ['a.md'], qualityLevel: 'A', tokens: 1, estimated: false, timestamp: '2026-09-12T00:00:00Z', outcome: 'success', subagentSpawns: 0, gateExitCode: null },
      { runId: 'r2', phase: 3, role: 'V', action: 'review', artifacts: ['a.md'], qualityLevel: 'C', tokens: 1, estimated: false, timestamp: '2026-09-12T00:01:00Z', outcome: 'success', subagentSpawns: 0, gateExitCode: null },
    ];
    const out = checkRunLog(entries as never);
    assert.ok(out.violations.some((v) => v.includes('跨轮次评审不一致')));
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts -t "A-3d 跨轮次评审一致性"`
预期：FAIL

- [ ] **步骤 3：实现跨轮次规则**

在 `run-log-logic.ts` 的 R8 之后插入：

```ts
  // R9: 跨轮次评审一致性（标准偏移检测）
  const LEVEL_ORDER: Record<string, number> = { A: 3, B: 2, C: 1, D: 0 };
  const byArtifact = new Map<string, Array<{ level: string; runId: string }>>();
  for (const e of entries) {
    if (e.action !== 'review' || typeof e.qualityLevel !== 'string') continue;
    for (const a of e.artifacts ?? []) {
      const list = byArtifact.get(a) ?? [];
      list.push({ level: e.qualityLevel, runId: e.runId });
      byArtifact.set(a, list);
    }
  }
  for (const [artifact, list] of byArtifact) {
    if (list.length < 2) continue; // 首次评审豁免：无不一致可言
    const ranks = list.map((x) => LEVEL_ORDER[x.level] ?? -1).filter((r) => r >= 0);
    if (ranks.length < 2) continue;
    const spread = Math.max(...ranks) - Math.min(...ranks);
    if (spread >= 2) {
      violations.push(
        `R9 跨轮次评审不一致：${artifact} 的 qualityLevel 跨 ${spread} 档（${list.map((x) => `${x.runId}=${x.level}`).join(', ')}）；` +
          `评审者自身不一致，须走高成熟度 CHECKPOINT 交人裁定而非 R（R 无法自查评审标准）`,
      );
    }
  }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts -t "A-3d 跨轮次评审一致性"`
预期：PASS

- [ ] **步骤 5：实现分辨力下限判据（D19）**

在 `verifier-logic.ts` 的 R13 之后追加判据（注意与既有全等检测的区别）：

```ts
  // R18: 分辨力下限（校准偏移信号）——与"全等检测"不同：此处查非全等但方差极小
  // 论文依据：粒度上升 → 正负样本分离 SNR 上升；方差坍缩意味 V 无区分能力
  const RESOLUTION_FLOOR = 1e-4; // 先行取值，端到端调测后校准（D23）
  for (let idx = 0; idx < subCriteria.length; idx++) {
    const sc = subCriteria[idx] as Record<string, unknown> | undefined;
    if (!sc || !Array.isArray(sc.rawScores)) continue;
    const nums = sc.rawScores.filter((v): v is number => typeof v === 'number');
    if (nums.length < 3) continue;
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max === min) continue; // 已由既有全等检测覆盖，避免重复报
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
    if (variance < RESOLUTION_FLOOR) {
      reasons.push(
        `R18 子标准 ${String(sc.name)} 的 rawScores 方差 ${variance} < 下限 ${RESOLUTION_FLOOR}（非全等但分布坍缩，疑似 V 无区分能力）`,
      );
    }
  }
```

- [ ] **步骤 6：补测并全量回归**

为 R18 补一条测试（`rawScores: [0.9001, 0.9002, 0.9000]` → 含 `R18`），然后：

运行：`npm run self-test && npx vitest run --config config/vitest.config.ts`
预期：均 exit 0

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/logic/verifier-logic.ts w-model-dev/scripts/__tests__/ w-model-dev/scripts/samples/run-log/ w-model-dev/scripts/cli/self-test.ts
git commit -m "feat(verifier): detect review drift, standard and calibration

Standard drift: the same artifact reviewed at levels two apart across rounds
is a failure signal, routed to a human CHECKPOINT rather than to R, because
the inconsistent party is the reviewer and R cannot audit its own criteria.
Calibration drift: sustained near-zero rawScores variance means the verifier
has collapsed, which the existing all-equal check does not catch because it
only fires on exact equality. Both are pre-decided constants to be
calibrated by the e2e round once every fix has landed."
```

### 任务 10：A-3c-4 pending 的豁免出口

**文件：**
- 修改：`w-model-dev/schemas/exemption.schema.json`（`type` 描述 + enum）
- 修改：`w-model-dev/scripts/logic/exemption-logic.ts:43-48`（TS union）+ `:5-14`（注释）

- [ ] **步骤 1：schema 加第 6 类**

把 `type` 的 description 从"（5 类）：…"改为"（6 类）：… / evidence-anchor-pending=证据锚点待验证（阶段门放行的合法出口）"，并在 enum 末尾加 `"evidence-anchor-pending"`。

- [ ] **步骤 2：同步 TS union**

在 `exemption-logic.ts:43-48` 的 union 末尾加 `| 'evidence-anchor-pending'`。

- [ ] **步骤 3：验证豁免门禁全绿**

运行：`npm run check:exemption -- w-model-dev/scripts/samples/exemption/valid-full-approval.json`
预期：exit 0（既有 5 类样本不受影响）

- [ ] **步骤 4：补第 6 类样本**

创建 `w-model-dev/scripts/samples/exemption/valid-evidence-anchor-pending.json`（走完 S→R→V→人类四阶段，`justification` ≥20 字符，`evidence` ≥1），在 `self-test.ts` 登记 `expectedPassed: true`。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/schemas/exemption.schema.json w-model-dev/scripts/logic/exemption-logic.ts w-model-dev/scripts/samples/exemption/ w-model-dev/scripts/cli/self-test.ts
git commit -m "feat(exemption): add evidence-anchor-pending as the sixth exemption type

A pending anchor had no legitimate exit, which would have either deadlocked
the stage gate or pushed people to mark it confirmed without evidence. The
new type reuses the whole E1-E9 chain - four-stage approval, justification
length, evidence non-empty, timestamp ordering - so no new logic is added."
```

### 任务 11：A-3c-5 阶段门 pending 常态扫描

**文件：**
- 修改：`w-model-dev/references/quick-self-check.md`（DoD 自检清单）

- [ ] **步骤 1：确认既有同类检查项的格式**

运行：`grep -n "阶段门放行已填理解证据\|预算与成熟度已检查" w-model-dev/references/quick-self-check.md`
预期：命中 2 行——照此格式新增

- [ ] **步骤 2：在自检清单插入新项**

在该清单中"预算与成熟度已检查"之后插入：

```
- [ ] **未验证证据锚点已清零**：`graph.json` 中 `evidenceStatus === 'pending'` 的节点数为 0；存在 pending → 阻断放行，须补验证转 `confirmed`，或走 `exemption` 的 `evidence-anchor-pending` 豁免（S→R→V→人类四阶段）
```

同时在同文件「七维度标准」表的「文档」维度行补一条对应判据（与该表既有行的措辞风格一致）。

- [ ] **步骤 3：验证文档门禁**

运行：`npm run check:docs-consistency`
预期：exit 0

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/references/quick-self-check.md
git commit -m "docs(quick-self-check): scan for pending anchors before releasing a stage gate

Normal-mode trigger rather than rework-triggered: a pending anchor means the
homework was not done, not that an artifact is defective, so it blocks
release and asks for verification rather than routing to R."
```

### 任务 12：批 3 文档同步

**文件：**
- 修改：`w-model-dev/references/evidence-anchored-tree.md`（§3）
- 修改：`w-model-dev/references/iceberg-sweep-guide.md`
- 修改：`w-model-dev/references/verifier-spec.md`（新增 §12）
- 修改：`w-model-dev/references/signature-chain-guide.md`
- 修改：`docs/skill-design-document_SSoT.md`

- [ ] **步骤 1：更新 evidence-anchored-tree.md §3**

把 §3 的"可选"表述改为必填，并补 `evidenceStatus` 与三处语义丢失的补齐说明（🟡 获得一等状态；R15 由格式校验扩展为 a-e 五子项；V 侧 evidence 与锚点交叉对账）。

- [ ] **步骤 2：更新 iceberg-sweep-guide.md**

同步三视角平权对账算法、在场表为代码常量、三类失败信号（视角不一致 / 分母未覆盖 / 零发现覆盖不足），并注明"权威为实现（`iceberg-sweep-logic.ts`）"。

- [ ] **步骤 3：verifier-spec.md 新增 §12 评审偏移检测**

内容含：标准偏移（R9 跨轮次）、校准偏移（R18 分辨力下限）、惰性偏移（R11/R12/O3 加强），**并写明 A-3f 校准集为非门禁**（防后续维护者误当门禁）。附论文依据（Table 1 SNR 曲线、100 次重复 88 次平局）与参数核对结论（`k=5`/`temperature=4.0`/`repeatTimes≥3` 无需改）。

- [ ] **步骤 4：signature-chain-guide.md 说明 R15e 读取契约**

写明 `confirmed` 锚点须在链中存在引用该节点的 V review 环 + `inputProvenance` 指向锚点；注明阶段 1 链未完整时不触发。

- [ ] **步骤 5：SSoT 新增权威定义节**

按 SSoT-first 惯例新增一节，承载：证据锚点必填化与 `evidenceStatus` 权威定义；R15a-e 权威定义；三类评审偏移检测；`exemption` 第 6 类的权威定义。**注意**：41.7.0 起 SSoT 只承载当前设计事实，历史过程写 CHANGELOG（不写"第 N 轮记录"）。

- [ ] **步骤 6：验证文档门禁 + 内链**

运行：`npm run check:docs-consistency`
预期：exit 0

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/references/ docs/skill-design-document_SSoT.md
git commit -m "docs: sync references and SSoT with the evidence-fact reconciliation changes

The SSoT carries only current design facts, so the authoritative definitions
land there while the process history goes to the CHANGELOG. verifier-spec
section 12 states plainly that the calibration set is NOT a gate."
```

---

## 批 4：校准集（非门禁）

### 任务 13：A-3f 校准集与校准命令

**文件：**
- 创建：`w-model-dev/scripts/samples/verifier-calibration/README.md`
- 创建：`w-model-dev/scripts/samples/verifier-calibration/must-be-a-001.json`、`must-be-d-001.json`
- 修改：`w-model-dev/scripts/samples/README.md`（矩阵行）

- [ ] **步骤 1：创建目录与 README（先声明边界）**

创建 `verifier-calibration/README.md`，内容必须包含：

```markdown
# Verifier 校准集（非门禁）

> **边界声明**：本目录**不是门禁**，不阻断阶段推进。锚定正解由人工标注，且校准需真实运行 LLM（由外部 Agent 执行），两者都不符合"确定性门禁"的定义。把它当成门禁即为过度声明。

## 用途

发现 V 评审的**校准偏移**（分辨力下降）：正负样本都被判高分，或都挤在中段。

## 样本格式

每个样本是一个 VerifierOutput 形状的 JSON，外加两个校准字段：

- `expectedQualityLevel`: 人工标注的正解等级（`A` 或 `D`）
- `expectedRationale`: 为什么该产物是这个等级（供复核标注本身是否正确）

## 校准方式

对每个样本跑一次评审，比对 V 给出的 `qualityLevel` 与 `expectedQualityLevel`，统计命中率与混淆矩阵。

## 已知漂移面

标注本身会过时（产物形态变化、标准修订）。校准报告能暴露漂移但不阻断流程。
```

- [ ] **步骤 2：创建两个锚定样本**

`must-be-a-001.json`（一个明显达标的最小产物 + `expectedQualityLevel: "A"`）与 `must-be-d-001.json`（一个明显不达标的产物 + `expectedQualityLevel: "D"`），两者都带 `expectedRationale`。

- [ ] **步骤 3：声明矩阵行（否则 check-samples-coverage 会红）**

在 `samples/README.md` 矩阵表加一行，首列为 `` `verifier-calibration` ``，说明列为"Verifier 校准集（非门禁，人工标注正解）"。

- [ ] **步骤 4：验证样本覆盖门禁**

运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：exit 0（若报 `matrix-undeclared` 说明步骤 3 未生效）

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/samples/verifier-calibration/ w-model-dev/scripts/samples/README.md
git commit -m "test(verifier-calibration): add a human-annotated calibration set

Declared NOT a gate in its own README, because annotations are human-authored
and calibration needs a real LLM run - neither is deterministic, and calling
it a gate would be overclaiming. The set exists because the paper measures
verifier discrimination via SNR against ground truth, and this is the only
place in the repo where such ground truth could live."
```

---

## 批 5：全量验证与端到端调测（D23）

### 任务 14：全量门禁验证

- [ ] **步骤 1：逐项跑验证命令**

按规格 §4 的表逐项执行，每项均须 exit 0：

```bash
npx tsc -p config/tsconfig.json
npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts"
npx vitest run --config config/vitest.config.ts
npm run coverage
npm run self-test
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
npm run check:docs-consistency
npm run eval
```

- [ ] **步骤 2：跑推送前完整门禁（18 项）**

运行：`npm run prepush`
预期：exit 0

- [ ] **步骤 3：修复任何红灯并重复步骤 1-2 直到全绿**

- [ ] **步骤 4：Commit（若步骤 3 有修改）**

```bash
git add -A
git commit -m "test: bring all gates green after the evidence-fact reconciliation changes"
```

### 任务 15：破坏性验证十项（规格 §4）

- [ ] **步骤 1：逐项执行破坏性验证**

对规格 §4 的 10 项逐条执行：**故意构造违规 → 跑门禁 → 断言 exit 1（或对应码）且 reasons 含预期子项 → 还原**。

10 项为：三视角不一致 / 空 sweptArtifacts / passed=false 的 R3 / 缺锚点 / pending 阻断 / 路径不存在 / 跨轮次 A→C / confirmed 缺签名链环 / 方差坍缩 / 5 类既有豁免仍绿。

- [ ] **步骤 2：记录每项的原始命令与输出**

记录方式与 `docs/superpowers/plans/2026-09-07-trigger-boundary-campaign.md` 的破坏性验证步骤一致（命令 + 预期 + 实测）。

- [ ] **步骤 3：Commit 验证记录（若有落盘文件）**

### 任务 16：端到端调测与阈值定稿（D23）

- [ ] **步骤 1：跑一轮完整 8 阶段项目**

按 `/wm` 8 阶段跑一轮完整流程（参照 `eval/e2e/2026-08-28-final.md` 的格式）。

**调测重点**（规格 §4 已列 5 项）：

1. R15a-e 在真实产物上不产生假阳性（**重点：R15e 在阶段 1 签名链未完整时不误红**）
2. `pending` 常态扫描确实阻断且豁免出口可用
3. A-3d 两条判据不误报 → **据此校准阈值**（`R9` 的"≥2 档"、`R18` 的 `RESOLUTION_FLOOR`）
4. A-3b 三视角在场表取值经真实阶段产物核定 → 据此修订 `ICEBERG_VIEW_PRESENCE`
5. 记录结果

- [ ] **步骤 2：按调测结果修订先行取值**

把 `R9` 的档差阈值、`R18` 的 `RESOLUTION_FLOOR`、`ICEBERG_VIEW_PRESENCE` 的取值按实测调整（三者均为代码常量，改动成本低）。**若调测发现阈值无法在"不误报"与"不漏报"之间取得平衡，停在此步并上报**（规格 §5 已登记该风险）。

- [ ] **步骤 3：写 e2e 记录**

创建 `eval/e2e/2026-09-12-gate-integrity.md`（沿用 `2026-08-28-final.md` 格式），并追加一行到 `eval/w-model-dev-results.tsv`。

- [ ] **步骤 4：Commit**

```bash
git add eval/ w-model-dev/scripts/logic/
git commit -m "test(e2e): calibrate the pre-decided thresholds against a full run

The repo holds no real run-log history to backtest against (.w-model/ is
gitignored), so the R9 level-spread, R18 resolution floor and the iceberg
view-presence table were pre-decided and are now calibrated against an
actual eight-phase run."
```

### 任务 17：CHANGELOG 与收尾

- [ ] **步骤 1：写 CHANGELOG 小节**

在 `CHANGELOG.md` 当前版本段（`## [42.2.1]`）下新增：

```markdown
### 门禁完整性与证据事实对账（gate-integrity-evidence-reconciliation，2026-09-12）

- **A-1 verifier-spec R14-R17 悬空规范修正**：`:278` 原规定四问结论写入 `summary.collaborationReview` 对象，但 `verifier-output.schema.json:48` 声明 `summary` 为 string 且父对象 `additionalProperties:false`，**无任何输入可同时满足**（真机实验证实：对象 → `must be string`；顶层额外键 → `additionalProperties` 报错）。改为固定前缀文本（`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），零 schema 成本。
- **A-2 SKILL.md 死引用修正（8 处）**：全仓 8 处引用 `SKILL.md「阶段门与质量门」` 章节，该章节不存在（实际已拆为 `workflow.md` 的「阶段门评审」与「质量门」两节）。含反模式 #1 与质量门 CHECKPOINT 的安全关键路径。逐处改指真实承载章节；`workflow.md:11` 目录项拆为两项。
- **A-3a R3 预防性审查判据接上**：`preventive-review-logic.ts` 原抄录 `passed`/`findingCount` 但从不纳入 `reasons`，三份 `{"findings":[],"passed":true}` 即通过。现 `passed=false` 产生 violation（schema 本就强制 `passed=false` 时 `findings.minItems:1`，缺的只是 checker）。
- **A-3b 冰山扫掠分母对账**：原 `expectedPassed = newFindings.length === 0`——**通过 ≡ 声明未发现任何东西**，且 `sweptArtifacts` 无 `minItems`。现分母由上游产物实测，graph/TLA/RTM **三视角平权**两两对账（无主分母、不归一化），差异即刻失败；在场表为代码常量；缺席须显式声明。
- **A-3c 证据锚点必填 + 常态扫描**：`evidenceAnchor` 由可选改**阶段 1-4 全节点必填**，新增 `evidenceStatus`（confirmed/pending）。阶段门放行前扫描 `pending` 即阻断（常态触发，非返工触发）。R15 拆 **a-e 五子项**（缺失/状态/存在性/覆盖/签名链环）独立定位。**不新增第三色**——invalid 由既有 `coverageStatus` + 返工链承载（遵守 evidence-anchored-tree.md §4 既有裁决）。
- **A-3d 评审偏移检测**：标准偏移（同一产物跨轮次 `qualityLevel` 差 ≥2 档 → 人裁定，不走 R）、校准偏移（`rawScores` 非全等但方差坍缩 → 分辨力不足）、惰性偏移（R11/R12/O3 加强）。论文依据：Table 1 SNR 随粒度上升（0.775→0.799）；离散 judge 100 次重复 88 次平局。
- **A-3e 证据路径存在性 + 覆盖对账**：原只校验格式，`src/nonexistent.ts:L999=捏造` 可通过。现验存在 + 移植 codegraph `--scope` 式覆盖对账。**仍不验语义支持**（需判断，属 V 评审）。
- **A-3f 校准集（非门禁）**：新增 `samples/verifier-calibration/`，人工标注正解；**明确声明非门禁**（标注与 LLM 执行均非确定性）。
- 31 个 graph fixture / 124 个节点迁移至必填字段；`exemption` 新增第 6 类 `evidence-anchor-pending`（复用 E1-E9）。版本保持 42.2.1，不 bump。
```

- [ ] **步骤 2：验证文档门禁**

运行：`npm run check:docs-consistency && npm run prepush`
预期：均 exit 0

- [ ] **步骤 3：最终 Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record the gate-integrity and evidence-reconciliation campaign

Version stays 42.2.1, no bump."
```

---

## 自检记录（编写时执行）

**1. 规格覆盖度**：规格 §2 的 A-1/A-2/A-3a/A-3b/A-3c/A-3d/A-3e/A-3f 八项分别对应任务 1-3（A-1、A-2）、任务 4（A-3a）、任务 8（A-3b）、任务 5-7 + 10-11（A-3c 的 schema/迁移/R15/豁免/扫描）、任务 9（A-3d）、任务 7 步骤 6（A-3e）、任务 13（A-3f）。规格 §4 验证策略 → 任务 14-16。§3 变更清单 30 项 → 任务 1-13、17 覆盖，其中 `docs/llm-verifier-integration-design.md` 在任务 12 步骤 3 一并处理（verifier-spec §12 落地时同步指针文档）。**无遗漏。**

**2. 占位符扫描**：无"待定/TODO/后续实现"；所有代码步骤含可执行代码块；所有测试步骤含命令与预期。

**3. 类型一致性**：`evidenceStatus` 在 schema（任务 5）、checker（任务 7）、DoD（任务 11）三处命名一致；`ICEBERG_VIEW_PRESENCE`（任务 8）与规格命名一致；`R9`/`R18`/`R15a-e` 在规格与计划中编号一致；`RESOLUTION_FLOOR` 与规格 D19 的"方差下限"对应。

**已知实施期核定项**（非占位符，规格 §5 已登记）：`ICEBERG_VIEW_PRESENCE` 取值、`R9` 档差阈值、`R18` 的 `RESOLUTION_FLOOR`——三者均为代码常量，任务 16 按真实调测校准。
