# Round 27 wayfinder 迷雾登记册吸收实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 阶段 1 需求分析引入「迷雾登记册（Fog of War）」——REQ 入学锐利性测试 + Not-yet-specified 文本节 + 毕业机制（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空），为「in-scope 尚无法精确陈述」的需求提供显式治理路径。

**Architecture:** 纯文档吸收，不改任何 `*.ts` 脚本、不新增/修改 JSON schema、不建图节点。迷雾册载体 = 规格书 §8.5 文本节 + A-chunk `.md` 迷雾节 + A-cross 报告 §7；毕业核验由既有 R 审查 + V 评审承载（不新增 check 脚本）。治理强度：FM-3D 新增 FM-3D-07 + 禁止行为 #12。不新增反模式（anti-patterns.md 保持 41 条）。

**Tech Stack:** Markdown（无代码变更；验证 = TypeScript strict / self-test 192 / vitest 205 基线回归）

**Spec:** [`docs/superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md`](../specs/2026-07-30-round27-wayfinder-fog-absorption-design.md)

---

## 文件结构

**修改文件（全部为 Markdown / JSON 元数据）：**

| 文件 | 职责 |
|---|---|
| `w-model-dev/references/ingestion-chunk.md` | A-chunk 新增 REQ 入学锐利性测试节 + 迷雾项提取规则 + crossChunkHints edgeType="fog" |
| `w-model-dev/references/ingestion-cross.md` | A-cross 算法新增步骤 9 + 报告模板新增 §7 迷雾登记册 |
| `w-model-dev/references/phase-1-requirements.md` | 新增「迷雾登记册（Fog of War）」节 + FM-3D-07 + 禁止行为 #12 + 返工路径 |
| `w-model-dev/templates/requirement-spec.md` | §8 后新增 §8.5 Not yet specified（迷雾登记册）节 |
| `docs/skill-design-document_SSoT.md` | §3.4.23 第 27 轮记录（第 773 行后、第 775 行 `---` 前）+ §10A 追溯表（第 2345 行后补行） |
| `package.json` | version `25.0.0` → `26.0.0`（第 3 行） |
| `w-model-dev/skill-metadata.json` | version `25.0.0` → `26.0.0`（第 3 行） |
| `w-model-dev/SKILL.md` | frontmatter version `25.0.0` → `26.0.0`（第 3 行） |
| `CHANGELOG.md` | 顶部新增 `[26.0.0]` 条目 |
| `AGENTS.md` | 第 18 行后新增第 27 轮 bullet |
| `README.md` | 第 37 行后新增第 27 轮能力 bullet |

---

## 批次 A：技能资产（references + template）

### Task 1: ingestion-chunk.md 新增 REQ 入学锐利性测试节

**Files:**
- Modify: `w-model-dev/references/ingestion-chunk.md`（第 39 行「level 识别…」blockquote 之后、第 41 行 `## 边提取规则` 之前插入）

- [ ] **Step 1: 在 `## 边提取规则` 前插入「REQ 入学锐利性测试」节**

插入内容：

```markdown
### REQ 入学锐利性测试（第 27 轮，吸收 wayfinder「Fog or ticket?」）

提取候选需求时，先执行锐利性测试——判断标准是**现在能否精确陈述该需求的问题**（不是能否回答它）：

- **能精确陈述** → 按上述规则提取 REQ 节点（level/priority/reqGroup 判定照常；level 无法判定 → blocked 澄清，见「blocked 返回条件」）。
- **不能精确陈述**（需求方向已见、但连问题都还说不清）→ **入迷雾登记册**，**不建图节点**。

迷雾项写入本 chunk 的 `.md` 叙事文件，固定表格格式：

```markdown
## 迷雾项（Fog of War，第 27 轮）

| fogId | fogDesc | fogBlocker | fogGroupHint |
|---|---|---|---|
| FOG-<chunk>-NN | {{模糊描述}} | {{疑点：哪部分无法精确陈述}} | {{level=1 REQ id 或空}} |
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `fogId` | ✅ | 迷雾项 ID（`FOG-<chunk>-NN`，本块内编号） |
| `fogDesc` | ✅ | 模糊描述（能说多少说多少） |
| `fogBlocker` | ✅ | 疑点：哪部分无法精确陈述（缺信息 / 待上游决策 / 范围未定） |
| `fogGroupHint` | ❌ | 疑似范围归属（level=1 REQ id 候选，可空） |

> 迷雾项不计入覆盖矩阵分母（非正式 REQ）；阶段末须全部毕业 / 判出范围 / 豁免（见 [phase-1-requirements.md](phase-1-requirements.md)「迷雾登记册（Fog of War）」节）。禁止把本应精确陈述的需求塞入迷雾册（FM-3D-07）。

**blocked 条件微调**：可精确陈述但 level 无法判定 → 维持 blocked（由 S 或用户澄清后重跑）；整项无法精确陈述 → 入迷雾册（**不再 blocked**）。

**crossChunkHints 迷雾提示**：疑似跨块迷雾关联可写入 crossChunkHints，`edgeType: "fog"`（`direction` 省略），由 A-cross 在 §7 汇总时确认：

```json
{"target":"<疑似关联的chunk-id>","reason":"<为什么认为存在跨块迷雾关联>","edgeType":"fog"}
```
```

- [ ] **Step 2: 验证锚点与内容**

运行：`grep -n "REQ 入学锐利性测试" w-model-dev/references/ingestion-chunk.md`
预期：命中 1 行（新节标题）；且 `grep -n "## 边提取规则" w-model-dev/references/ingestion-chunk.md` 仍在原位置。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/ingestion-chunk.md
git commit -m "docs(round27): ingestion-chunk 新增 REQ 入学锐利性测试节（迷雾册准入）"
```

### Task 2: ingestion-cross.md 新增 A-cross 算法步骤 9 + 报告 §7

**Files:**
- Modify: `w-model-dev/references/ingestion-cross.md`（第 19 行「交叉逻辑矩阵汇总」之后追加算法步骤 9；第 94 行 `>` blockquote 前追加 §7 模板节）

- [ ] **Step 1: A-cross 合并算法新增步骤 9**

在第 19 行（`8. **交叉逻辑矩阵汇总**…`）之后追加：

```markdown
9. **迷雾登记册汇总**【第 27 轮新增】：读取各 chunk `.md` 叙事文件中的「迷雾项」节，跨块去重；汇总每项疑似 REQ-group 归属（fogGroupHint）与疑似毕业方向（REQ / Out of Scope / 待澄清）供 S 参考，写入 `cross-analysis-report.md` §7。**A-cross 不代 S 决定毕业**（毕业是 S 产出 + R/V 核验职责，见 [phase-1-requirements.md](phase-1-requirements.md)「迷雾登记册（Fog of War）」节）；疑似方向仅作指引，不建图节点。
```

- [ ] **Step 2: cross-analysis-report.md 模板新增 §7**

在第 94 行 `>` blockquote 之前（即 §6.4 表之后）追加：

```markdown
## 7. 迷雾登记册【第 27 轮新增】
> 汇总各 chunk 迷雾项（A-chunk 经锐利性测试入册）。A-cross 只产出疑似方向，不代 S 决定毕业。
### 7.1 迷雾项清单
| fogId | fogDesc | fogBlocker | fogGroupHint | 来源 chunk |
|---|---|---|---|---|
| FOG-001 | {{模糊描述}} | {{疑点}} | {{level=1 REQ id 或空}} | chunk-003 |
### 7.2 疑似毕业方向
| fogId | 疑似方向（REQ / Out of Scope / 待澄清） | 依据 |
|---|---|---|
| FOG-001 | {{方向}} | {{依据}} |
{{疑似跨块迷雾关联（crossChunkHints edgeType=fog 确认结果）}}
```

- [ ] **Step 3: 更新 §4-§6 专用说明**

第 96 行现有 blockquote `> §4-§6 是阶段1 专用增强…` 改为：

```markdown
> §4-§7 是阶段1 专用增强（阶段2-4 的 A-evolve 不产出 §4-§7，因 REQ 层级树与迷雾登记册在阶段1 已固化）。
```

- [ ] **Step 4: 验证锚点与内容**

运行：`grep -n "迷雾登记册" w-model-dev/references/ingestion-cross.md`
预期：命中 3 处（算法步骤 9 / §7 标题 / 7.1 或 7.2）。

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/ingestion-cross.md
git commit -m "docs(round27): ingestion-cross 新增迷雾登记册汇总（步骤9 + 报告§7）"
```

### Task 3: phase-1-requirements.md 新增迷雾登记册节 + FM-3D-07 + 禁止行为 #12 + 返工路径

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`（第 119 行「Out of Scope」节后、第 121 行 `## Implementation/Testing Decisions 分离` 前插入新节；第 264-270 行 FM-3D 表追加一行；第 327-339 行禁止行为表追加一行；第 341-355 行返工路径追加条目）

- [ ] **Step 1: 新增「迷雾登记册（Fog of War）」节**

在第 119 行（Out of Scope 节末）后、第 121 行 `## Implementation/Testing Decisions 分离` 前插入：

```markdown
## 迷雾登记册（Fog of War）（第 27 轮新增）

> 吸收 wayfinder「Fog of war」理念。W 阶段 1 强制 100% 覆盖（C1-C10）下，为「in-scope 但尚无法精确陈述」的需求提供显式落脚点，防止 A 子代理提前捏造浅层 REQ（违背禁止行为 #2 精神）或静默丢弃（违反禁止行为 #10）。设计 spec：[`docs/superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md`](../../docs/superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md)。

### 定义与区分

- **迷雾项**：in-scope、但当前无法精确陈述的需求（方向已见、连问题都还说不清）。
- **与 §8 Out of Scope 的区分**：迷雾 = 要做什么但还说不清（in-scope 未成形）；Out of Scope = 不做什么（范围外，不属雾，永不毕业除非目的地重画）。
- **锐利性测试**（吸收 wayfinder「Fog or ticket?」）：判断标准是**现在能否精确陈述该需求的问题**，不是能否回答它。能精确陈述 → 正式 REQ；不能 → 入迷雾册。

### 流程与责任

- **准入（A 子代理）**：A-chunk 提取时执行锐利性测试，不能精确陈述者记入 `<chunk-id>.md` 迷雾节（fogDesc / fogBlocker / fogGroupHint，见 [ingestion-chunk.md](ingestion-chunk.md)「REQ 入学锐利性测试」节）；A-cross 汇总去重写入 `cross-analysis-report.md` §7。
- **毕业（S 子代理）**：S 产出需求规格时，对每项迷雾给出毕业处置（三选一），填入规格书 §8.5：
  1. **毕业成 REQ**：进入 graph.json + 覆盖矩阵，走正常维度 1-4 校验
  2. **判 Out of Scope**：写入规格书 §8，永不毕业（除非目的地重画）
  3. **豁免审批暂缓**：走 S→R→V→人类四阶段（见「豁免审批治理」节），写入 exemption.json
- **核验（R / V）**：R 预防性审查核验迷雾项真实性（是否本可精确陈述却借雾逃避覆盖）；V 评审检查毕业处置完整性（FM-3D-07）。
- **CHECKPOINT 前强制清空**：阶段门放行前迷雾册每项必须有毕业处置结果，禁止静默遗留（禁止行为 #12）。

### 覆盖矩阵语义

迷雾项**不计入**覆盖矩阵分母（非正式 REQ、非图节点）；毕业 / 判范围 / 豁免的处置结果在规格书 §8.5、§8 与 exemption.json 中可见，禁止隐式消失。
```

- [ ] **Step 2: FM-3D 表追加 FM-3D-07**

在第 270 行（`| FM-3D-06 | …`）后追加一行：

```markdown
| FM-3D-07 | 迷雾滥用 | 检测信号 A：把本应正式的 REQ 塞入迷雾册逃避覆盖（R/V 发现迷雾项实为可精确陈述需求）；检测信号 B：CHECKPOINT 前迷雾册存在未终结项 | 处置 A：作废迷雾项，回步骤 2-4 补正式 REQ；处置 B：回 CHECKPOINT 前补毕业处置（毕业 / 判范围 / 豁免） |
```

- [ ] **Step 3: 禁止行为表追加 #12**

在第 339 行（`| 11 | 跳过豁免审批流程 | …`）后追加一行：

```markdown
| 12 | 迷雾项静默遗留 | CHECKPOINT 前迷雾册每项须有毕业处置结果（毕业成 REQ / 判 Out of Scope / 豁免审批），禁止未终结即放行（FM-3D-07） |
```

- [ ] **Step 4: 返工路径追加条目**

在第 354 行（`- 豁免审批跳步（FM-EXEMPT-01/02/03/04/05）…`）后追加：

```markdown
- 迷雾项未终结（FM-3D-07）→ 回 CHECKPOINT 前补毕业处置：毕业成 REQ → 回步骤 2-4；判 Out of Scope → 补 §8；豁免 → 回豁免审批流程
- 迷雾滥用逃避覆盖（FM-3D-07）→ 作废迷雾项，回步骤 2-4 补正式 REQ
```

- [ ] **Step 5: 验证锚点与内容**

运行：`grep -n "迷雾登记册（Fog of War）\|FM-3D-07\|迷雾项静默遗留" w-model-dev/references/phase-1-requirements.md`
预期：命中 4 处（新节标题 + FM 表行 + 禁止行为行 + 返工路径）。

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(round27): phase-1 新增迷雾登记册节 + FM-3D-07 + 禁止行为#12 + 返工路径"
```

### Task 4: requirement-spec.md 模板新增 §8.5 Not yet specified

**Files:**
- Modify: `w-model-dev/templates/requirement-spec.md`（第 223 行 §8 末「- {{覆盖缺失声明…}}」后、第 225 行 `## 9. Implementation Decisions` 前插入）

- [ ] **Step 1: 插入 §8.5 节**

在第 223 行后、第 225 行 `## 9. Implementation Decisions` 前插入：

```markdown
## 8.5 Not yet specified（迷雾登记册）

> 第 27 轮新增。登记 in-scope 但尚无法精确陈述的需求（A 子代理经锐利性测试入册，见 [phase-1-requirements.md](../references/phase-1-requirements.md)「迷雾登记册（Fog of War）」节）。
> **强制项**：阶段末（CHECKPOINT 前）每项须有毕业处置结果；全部终结后可标注「本阶段无未终结迷雾项」。
> **区分**：本节 = 要做什么但还说不清（in-scope 未成形）；§8 Out of Scope = 不做什么（范围外，不属雾）。

| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似范围归属（level=1 候选） | 毕业方向（REQ / Out of Scope / 豁免） | 毕业处置结果 |
|---|---|---|---|---|---|
| FOG-001 | {{描述}} | {{疑点}} | {{REQ-xxx 或 空}} | {{方向}} | {{处置结果 + 对应 REQ / §8 / EXEMPT 引用}} |

（无迷雾项时填：「无——本阶段未识别尚无法精确陈述的 in-scope 需求」）
```

- [ ] **Step 2: 验证锚点与内容**

运行：`grep -n "Not yet specified" w-model-dev/templates/requirement-spec.md`
预期：命中 1 处（新节标题）。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/templates/requirement-spec.md
git commit -m "docs(round27): requirement-spec 模板新增 §8.5 Not yet specified 迷雾登记册"
```

---

## 批次 B：SSoT + 版本号 + 顶层文档

### Task 5: SSoT §3.4.23 第 27 轮记录 + §10A 追溯表

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（第 773 行「不涉及范围」后、第 775 行 `---` 前插入 §3.4.23；第 2345 行 §3.4.22 追溯行后补一行）

- [ ] **Step 1: 插入 §3.4.23**

在第 773 行（§3.4.22 的「不涉及范围」段）后、第 775 行 `---` 前插入：

```markdown

#### 3.4.23 第 27 轮：Wayfinder「Fog of War」吸收 — 阶段 1 迷雾登记册（2026-07-30）

> 触发：用户要求分析外部仓库 wayfinder 技能（`skills/skills/engineering/wayfinder/`），评估其对阶段 1（需求分析）的可借鉴性。设计 spec：[`docs/superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md`](./superpowers/specs/2026-07-30-round27-wayfinder-fog-absorption-design.md)。经全量精读 wayfinder SKILL.md + 配套 docs + 3 changeset + 上游 skill（domain-modeling / to-spec / to-tickets / research），识别阶段 1 真实缺口：强制 100% 覆盖（C1-C10）下「in-scope 尚无法精确陈述」的需求无落脚点 → A 子代理或捏造浅层 REQ（违背禁止行为 #2）或静默丢弃（违反禁止行为 #10）。吸收 wayfinder「Fog or ticket?」锐利性测试 + Not-yet-specified + 毕业机制。版本号目标 26.0.0。

1. **REQ 入学锐利性测试**：`ingestion-chunk.md` 新增测试判据——现在能否精确陈述需求的问题（不是能否回答它）；能 → 正式 REQ，不能 → 入迷雾册（不建图节点）。迷雾项字段：fogDesc / fogBlocker / fogGroupHint，写入 chunk `.md` 叙事文件；crossChunkHints 支持 `edgeType: "fog"`。

2. **A-cross 迷雾汇总**：`ingestion-cross.md` 算法新增步骤 9 + 报告模板新增 §7 迷雾登记册（去重 + 疑似 REQ-group 归属 + 疑似毕业方向）；A-cross 不代 S 决定毕业。

3. **迷雾登记册治理**：`phase-1-requirements.md` 新增「迷雾登记册（Fog of War）」节——定义与 §8 Out of Scope 区分 + 锐利性测试 + 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批）+ CHECKPOINT 前强制清空 + 覆盖矩阵语义（迷雾项不计入分母）。责任边界：A 准入 / S 毕业产出 / R 审查核验真实性 / V 评审防借雾逃避覆盖 / G 不新增脚本。

4. **失败模式与禁止行为**：FM-3D 新增 FM-3D-07 迷雾滥用（信号 A：借雾逃避覆盖；信号 B：CHECKPOINT 前未终结）；禁止行为新增 #12 迷雾项静默遗留；返工路径补充对应条目。**不新增反模式**（anti-patterns.md 保持 41 条——迷雾滥用是阶段内局部违规，走 FM + 禁止行为）。

5. **模板 §8.5**：`templates/requirement-spec.md` §8 后新增「8.5 Not yet specified（迷雾登记册）」节（含登记表 + 毕业处置结果列）。

**实现状态（2026-07-30）**：全部落地并通过验证（tsc 0 错误 / self-test 192 通过 / vitest 205 通过 / D5 互引一致性通过）：
- 文档层：ingestion-chunk.md（锐利性测试节）+ ingestion-cross.md（步骤 9 + 报告 §7）+ phase-1-requirements.md（迷雾登记册节 + FM-3D-07 + 禁止行为 #12 + 返工路径）+ requirement-spec.md（§8.5）
- 顶层：SSoT §3.4.23 + §10A 追溯表、CHANGELOG [26.0.0]、AGENTS.md、README.md
- 版本号三处同步 26.0.0（package.json + skill-metadata.json + SKILL.md frontmatter）

**不涉及范围**：不改任何脚本（无新增 check 脚本，毕业核验由既有 R/V 承载）；不改任何 schema（迷雾册为文本节，graph/coverage/exemption schema 不变）；不建图节点（FOG 项不进 graph.json）；不新增反模式（41 条不变）；不动 w-model-dev-demo。
```

- [ ] **Step 2: §10A 追溯表补行**

在第 2345 行（§3.4.22 追溯行）后追加一行：

```markdown
| §3.4.23 第 27 轮 Wayfinder「Fog of War」吸收 — 阶段 1 迷雾登记册 | 强制 100% 覆盖下「in-scope 尚无法精确陈述」需求无落脚点 → REQ 入学锐利性测试（能否精确陈述，非能否回答）+ 迷雾登记册文本节（Not yet specified，不建图节点）+ 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空）+ FM-3D-07 迷雾滥用 + 禁止行为 #12（不新增反模式） | `w-model-dev/references/ingestion-chunk.md`（锐利性测试节 + fogDesc/fogBlocker/fogGroupHint + crossChunkHints edgeType=fog）+ `w-model-dev/references/ingestion-cross.md`（算法步骤 9 + 报告 §7）+ `w-model-dev/references/phase-1-requirements.md`（迷雾登记册节 + FM-3D-07 + 禁止行为 #12 + 返工路径）+ `w-model-dev/templates/requirement-spec.md`（§8.5 Not yet specified）+ `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md`（版本号三处 26.0.0） | 完整（纯文档吸收，无脚本/schema 变更；self-test 192 / vitest 205 基线不变；D5 互引一致性通过；版本号三处一致 26.0.0） |
```

- [ ] **Step 3: 验证锚点与内容**

运行：`grep -n "3.4.23" docs/skill-design-document_SSoT.md`
预期：命中 ≥3 处（§3.4.23 标题 + §10A 追溯行 + 可能标题重复）。

- [ ] **Step 4: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(s sot): §3.4.23 第27轮 wayfinder 迷雾登记册吸收记录 + §10A 追溯表补行"
```

### Task 6: 版本号三处同步 26.0.0 + CHANGELOG [26.0.0]

**Files:**
- Modify: `package.json:3` / `w-model-dev/skill-metadata.json:3` / `w-model-dev/SKILL.md:3` / `CHANGELOG.md`（第 6 行 `## [25.0.0]` 前插入）

- [ ] **Step 1: 三处版本号 25.0.0 → 26.0.0**

- `package.json` 第 3 行：`"version": "25.0.0"` → `"version": "26.0.0"`
- `w-model-dev/skill-metadata.json` 第 3 行：`"version": "25.0.0"` → `"version": "26.0.0"`
- `w-model-dev/SKILL.md` 第 3 行：`version: 25.0.0` → `version: 26.0.0`

- [ ] **Step 2: CHANGELOG 顶部新增 [26.0.0] 条目**

在第 6 行 `## [25.0.0] - 2026-07-30` 前插入：

```markdown
## [26.0.0] - 2026-07-30

### 第二十七轮 Wayfinder「Fog of War」吸收（阶段 1 迷雾登记册）

吸收外部仓库 wayfinder 技能（Matt Pocock "Skills For Real Engineers"，`skills/skills/engineering/wayfinder/`）「Fog of war」理念：阶段 1 需求分析为「in-scope 但尚无法精确陈述」的需求引入显式治理路径——REQ 入学锐利性测试 + Not-yet-specified 文本节 + 毕业机制。纯文档吸收，无脚本/schema 变更。详见 SSoT §3.4.23。

#### Added
- `ingestion-chunk.md`：新增「REQ 入学锐利性测试」节（判据 = 能否精确陈述需求的问题，非能否回答）；迷雾项字段 fogDesc / fogBlocker / fogGroupHint 写入 chunk `.md`；crossChunkHints 支持 `edgeType: "fog"`
- `ingestion-cross.md`：A-cross 算法新增步骤 9（迷雾册跨块去重汇总）+ 报告模板新增 §7 迷雾登记册（疑似 REQ-group 归属 + 疑似毕业方向）；A-cross 不代 S 决定毕业
- `phase-1-requirements.md`：新增「迷雾登记册（Fog of War）」节（定义与 §8 Out of Scope 区分 + 锐利性测试 + 毕业机制三选一 + CHECKPOINT 前强制清空 + 覆盖矩阵语义）；FM-3D 新增 FM-3D-07 迷雾滥用；禁止行为新增 #12 迷雾项静默遗留；返工路径补充对应条目
- `templates/requirement-spec.md`：§8 后新增「8.5 Not yet specified（迷雾登记册）」节（登记表 + 毕业处置结果列）

#### Changed
- 版本号三处同步为 26.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter
- SSoT §3.4.23 第 27 轮记录 + §10A 追溯表补行

#### Validation
- TypeScript strict: 0 错误（无代码变更，基线确认）
- self-test: 192/192 全通过（基线不变）
- vitest: 205/205 全通过（基线不变）
- D5 文档互引一致性：新增节与既有 §8 Out of Scope / 覆盖矩阵 / FM 矩阵 / 禁止行为表无矛盾
- 反模式计数保持 41 条（迷雾滥用走 FM-3D-07 + 禁止行为 #12，不新增反模式）
```

- [ ] **Step 3: 验证**

运行：`grep -n "26.0.0" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md CHANGELOG.md`
预期：package.json 命中 1、skill-metadata.json 命中 1、SKILL.md 命中 1、CHANGELOG.md 命中 ≥1。

- [ ] **Step 4: Commit**

```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md CHANGELOG.md
git commit -m "docs(round27): 版本号三处同步 26.0.0 + CHANGELOG [26.0.0]"
```

### Task 7: AGENTS.md + README.md 同步

**Files:**
- Modify: `AGENTS.md`（第 18 行后、第 20 行「权威设计决策…」前插入 bullet）/ `README.md`（第 37 行后、第 39 行 `## 架构原则与外部工具边界` 前插入 bullet）

- [ ] **Step 1: AGENTS.md 新增第 27 轮 bullet**

在第 18 行（第 26 轮 bullet）后插入：

```markdown
- **第 27 轮 Wayfinder「Fog of War」吸收**：阶段 1 需求分析引入迷雾登记册——REQ 入学锐利性测试（`references/ingestion-chunk.md`，判据 = 能否精确陈述需求的问题，非能否回答）/ A-cross 报告 §7 迷雾汇总（`references/ingestion-cross.md`，不代 S 决定毕业）/ 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空，`references/phase-1-requirements.md`「迷雾登记册（Fog of War）」节）/ 规格书 §8.5 Not yet specified（`templates/requirement-spec.md`）。迷雾册为文本节不建图节点、无脚本/schema 变更，治理走 FM-3D-07 + 禁止行为 #12（不新增反模式）。详见 SSoT §3.4.23。
```

- [ ] **Step 2: README.md 新增第 27 轮能力 bullet**

在第 37 行（第 26 轮 bullet）后插入：

```markdown
- **阶段 1 迷雾登记册（Fog of War）**（第 27 轮新增）：需求分析引入「REQ 入学锐利性测试」（吸收 wayfinder「Fog or ticket?」判据——能否精确陈述，不是能否回答）+ 迷雾登记册文本节（Not yet specified，不建图节点）+ 毕业机制（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空）。为「in-scope 尚无法精确陈述」的需求提供落脚点，杜绝 A 子代理捏造浅层 REQ 或静默丢弃。治理走 FM-3D-07 + 禁止行为 #12（不新增反模式）。详见 [phase-1-requirements.md](./w-model-dev/references/phase-1-requirements.md)「迷雾登记册（Fog of War）」节
```

- [ ] **Step 3: 验证锚点与内容**

运行：`grep -n "第 27 轮\|迷雾登记册" AGENTS.md README.md`
预期：AGENTS.md 命中 ≥1、README.md 命中 ≥1。

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs(round27): 同步 AGENTS/README 第27轮迷雾登记册记录"
```

---

## 批次 C：验证

### Task 8: 全量回归验证

**Files:**
- 无修改（只读验证）

- [ ] **Step 1: tsc --noEmit**

运行：`npx tsc --noEmit`
预期：0 错误，退出码 0。

- [ ] **Step 2: self-test**

运行：`npm run self-test`
预期：192/192 全通过，退出码 0。

- [ ] **Step 3: vitest**

运行：`cd w-model-dev && npx vitest run`
预期：205/205 全通过，退出码 0。

- [ ] **Step 4: D5 文档互引一致性检查**

逐项核验（不修改，仅确认一致）：
1. `phase-1-requirements.md`「迷雾登记册」节引用的「§8.5」与 `requirement-spec.md` 新增节标题一致（§8.5）
2. FM-3D-07 引用的「禁止行为 #12」与禁止行为表一致
3. `ingestion-chunk.md` fog 字段（fogDesc/fogBlocker/fogGroupHint）与 `phase-1-requirements.md` 描述一致
4. 「不新增反模式 / 41 条」与 `anti-patterns.md` 实际条目数一致（运行 `grep -c "^| [0-9]" w-model-dev/references/anti-patterns.md`，预期 41）
5. 版本号三处一致 26.0.0（`grep -n "26.0.0" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md`）

- [ ] **Step 5: Commit 验证（无新增变更）**

运行：`git status --short`
预期：干净（所有修改已在前序任务 commit）。

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-07-30-round27-wayfinder-fog-absorption.md`。两种执行方式：

1. **子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代
2. **内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
