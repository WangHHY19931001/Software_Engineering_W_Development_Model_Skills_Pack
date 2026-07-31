# 第二十七轮（2026-07-30）Wayfinder「Fog of War」吸收 — 阶段 1 迷雾登记册设计规格

> **创建日期**：2026-07-30
> **轮次**：Round 27
> **触发原因**：用户要求分析外部仓库 wayfinder 技能（`skills/skills/engineering/wayfinder/`，Matt Pocock "Skills For Real Engineers"），评估并吸收其阶段 1（需求分析）可借鉴增强点
> **修正范围**：阶段 1 需求分析引入「迷雾登记册（Fog of War）」机制——REQ 入学锐利性测试 + Not-yet-specified 文本节 + 毕业机制（毕业成 REQ / 判 Out of Scope / 豁免审批）；全部为文档变更，无脚本/schema 改动
> **执行模式**：待定（spec 评审后由用户选择 Subagent-Driven / Inline）
> **版本变更**：25.0.0 → 26.0.0

---

## 一、背景

### 1.1 触发缘由

用户要求分析外部仓库 wayfinder 技能，评估其对 W-Model 第一阶段（需求分析）的可借鉴性。经全量精读（`wayfinder/SKILL.md` 128 行 + `docs/engineering/wayfinder.md` + 3 个 changeset + 上游 skill：domain-modeling / to-spec / to-tickets / research），完成适配分析并获用户批准吸收范围。

### 1.2 Wayfinder 核心理念（来源：wayfinder/SKILL.md）

| 概念 | 含义 |
|---|---|
| Decision tickets | 每张票解决一个**决策**（问题），不是待执行的构建切片；地图是**索引**不是仓库 |
| Destination first | 先命名目的地（固定范围）；out-of-scope **永不毕业** |
| **Fog of war** | 地图**刻意不完整**。「Fog or ticket?」测试 = 现在能否**精确陈述**问题（不是能否回答）；能→ticket，不能→**Not yet specified**，随 frontier 推进逐步毕业 |
| 毕业机制 | 解决一张票清除其前方迷雾，把「现在可精确陈述的」毕业为正式票 |
| HITL vs AFK | grilling/prototype=人机对话，research=agent 子代理并行；agent 永不代答自己的问题 |

### 1.3 设计目标

修复阶段 1 需求分析的真实缺口：在强制 100% 覆盖（C1-C10）压力下，「in-scope 但尚无法精确陈述」的需求没有结构化落脚点，导致 A 子代理要么**提前捏造浅层 REQ**（违背禁止行为 #2 精神），要么**静默丢弃**（违反禁止行为 #10）。

吸收方式：锐利性入学测试 + 迷雾登记册（Not yet specified）+ 毕业机制，为「尚未成形的 in-scope 需求」提供显式、可审计、阶段末强制终结的治理路径。

---

## 二、调研结论（适配分析）

### 2.1 已对齐（无需吸收）

| Wayfinder 概念 | W 阶段 1 现状 |
|---|---|
| 阻塞边（frontier 渲染） | precedes / depends-on 边 + 图门禁 R5 无环 |
| Out of Scope 永不毕业 | §8 Out of Scope 节（第 10 轮已吸收 to-spec） |
| Refer by name | REQ-NNN 命名约定 |
| HITL（agent 不代答） | 豁免审批 S→R→V→人类四阶段 + 禁止行为 #2 |
| AFK research 子代理 | A-chunk 并行分块子代理 |

### 2.2 真实缺口（本次吸收）

W 阶段 1 无「in-scope 但尚未成形」档位：§8 Out of Scope 只有「不做什么」，缺「要做什么但还说不清」的中间态。wayfinder 的「Fog or ticket?」测试 + Not-yet-specified + 毕业机制正好补上。

### 2.3 不吸收项（低价值/不适用）

| Wayfinder 概念 | 不吸收原因 |
|---|---|
| claim / one-ticket-per-session | W 是单线程编排者-子代理分派，无并发抢占 |
| Decisions so far 索引 | RTM + graph.json + checkpoint 已覆盖 |
| ticket type 四分类（research/prototype/grilling/task） | W 已隐式对应（A-chunk=AFK / 豁免=HITL） |
| to-tickets 垂直切片 | 更适合阶段 5 拆票，不在阶段 1 |

---

## 三、设计决策（用户头脑风暴确认，2026-07-30）

| # | 决策 | 选择 |
|---|---|---|
| 1 | 迷雾册载体 | **A. 文本节**（规格书 + A-cross 报告），不建图节点、不动 schema、不加 check 脚本 |
| 2 | 版本与轮次 | **A. 完整登记**：SSoT §3.4.23 第 27 轮 + §10A 追溯表补行 + 三处版本号 25.0.0 → 26.0.0 + CHANGELOG [26.0.0] / AGENTS / README |
| 3 | 治理强度 | **A. 强制清空**：CHECKPOINT 前迷雾册每项必须终结（毕业成 REQ / 判 Out of Scope / 豁免审批），禁止静默遗留 |
| 4 | 责任归属 | **A. A 子代理准入 + S 毕业产出 + R 审查 + V 核验**；G 不新增脚本 |

---

## 四、设计：变更清单

### 4.1 `w-model-dev/references/ingestion-chunk.md` — REQ 入学锐利性测试

新增「REQ 入学锐利性测试」节：

1. **测试判据**（吸收 wayfinder「Fog or ticket?」）：提取候选需求时先问「现在能否精确陈述该需求的问题」——判断标准是**能否陈述**，不是能否回答。
   - 能精确陈述 → 按现有规则入图（提取 level/priority/reqGroup，level 无法判定 → 维持 blocked 澄清）
   - 不能精确陈述 → 记入迷雾册（**不建图节点**）
2. **迷雾项提取字段**：模糊描述 / 疑点（哪部分无法精确陈述）/ 疑似范围归属（level=1 候选，可空）。
3. **blocked 条件微调**：可精确陈述但 level 无法判定 → 维持 blocked（由 S 或用户澄清后重跑）；整项无法精确陈述 → 入迷雾册（不再 blocked）。
4. **crossChunkHints 支持迷雾提示**：疑似跨块迷雾关联可写入 crossChunkHints（`edgeType: "fog"`，由 A-cross 汇总）。

### 4.2 `w-model-dev/references/ingestion-cross.md` — A-cross 迷雾汇总

1. `cross-analysis-report.md` 模板新增 **§7 迷雾登记册**：跨块去重后的迷雾项清单 + 疑似 REQ-group 归属（level=1 候选）+ 每项「疑似毕业方向」（REQ / Out of Scope / 待澄清）供 S 参考。
2. **边界**：A-cross 只产出疑似方向，**不代 S 决定毕业**（毕业是 S/R/V 职责，决策 4）。

### 4.3 `w-model-dev/references/phase-1-requirements.md` — 迷雾治理

新增「迷雾登记册（Fog of War）【第 27 轮】」节：

1. **定义**：in-scope 但尚无法精确陈述的需求登记册；与 §8 Out of Scope 的区分——迷雾 = in-scope 未成形（要做什么还说不清），Out of Scope = 范围外（不做什么，不属雾）。
2. **锐利性测试判据**：引用 wayfinder「Fog or ticket?」：判断标准是能否精确陈述，不是能否回答。
3. **毕业机制（三选一，CHECKPOINT 前强制清空）**：
   - 毕业成 REQ：进入 graph.json + 覆盖矩阵，走正常维度 1-4 校验
   - 判 Out of Scope：写入 §8，永不毕业（除非 destination 重画）
   - 豁免审批暂缓：走 S→R→V→人类四阶段，写入 exemption.json
4. **覆盖矩阵语义**：迷雾项**不计入**覆盖矩阵分母（非正式 REQ）；但在 §8 或豁免记录中可见，禁止隐式消失。
5. **责任边界**：A 子代理准入（锐利性测试）；S 子代理毕业产出（规格书 §Not yet specified 填毕业处置）；R 预防性审查核验迷雾项真实性；V 评审防「借雾逃避覆盖」；G 不新增脚本。
6. **FM-3D 新增 FM-3D-07 迷雾滥用**：
   - 检测信号 A：把本应正式的 REQ 塞入迷雾册逃避覆盖（V/R 发现迷雾项实为可精确陈述需求）
   - 检测信号 B：CHECKPOINT 前迷雾册存在未终结项
   - 处置：回对应步骤（毕业/判范围/豁免），标注 R/V finding
7. **禁止行为新增 #12** 迷雾项静默遗留：未毕业/未判范围/未豁免即放行 CHECKPOINT → 正确做法：CHECKPOINT 前迷雾册每项须有毕业处置结果。
8. **返工路径补充**：FM-3D-07 对应条目。

### 4.4 `w-model-dev/templates/requirement-spec.md` — Not yet specified 节

§8 Out of Scope 之后新增「Not yet specified（迷雾登记册）」节，含登记表模板：

| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似范围归属（level=1 候选） | 毕业方向（REQ/Out of Scope/豁免） | 毕业处置结果 |
|---|---|---|---|---|---|
| FOG-001 | {{描述}} | {{疑点}} | {{REQ-xxx 或 空}} | {{方向}} | {{处置结果 + 对应 REQ/§8/EXEMPT 引用}} |

> 阶段末（CHECKPOINT 前）每项须有毕业处置结果；全部终结后本节可标注「本阶段无未终结迷雾项」。

### 4.5 顶层同步

| 文件 | 改动 |
|---|---|
| `docs/skill-design-document_SSoT.md` | §3.4.23 第 27 轮记录（仿 §3.4.22 格式）+ §10A 追溯表补行 |
| `package.json` | version `25.0.0` → `26.0.0` |
| `w-model-dev/skill-metadata.json` | version `25.0.0` → `26.0.0` |
| `w-model-dev/SKILL.md` | frontmatter version `25.0.0` → `26.0.0` |
| `CHANGELOG.md` | `[26.0.0]` 条目 |
| `AGENTS.md` | §2 references 表 phase-1 行提迷雾册 + round 27 记录（§4 参考实现区） |
| `README.md` | 轮次/能力描述同步（不新增反模式，保持 41 条） |

**反模式决策**：本轮**不新增反模式**（anti-patterns.md 保持 41 条）。迷雾滥用治理走 FM-3D-07 + 禁止行为 #12（阶段 1 本地约束），与既有分层一致（反模式=跨阶段流程性违规，FM/禁止行为=阶段内局部违规）。

---

## 五、不涉及范围与验证

### 5.1 不涉及

- 不改任何 `w-model-dev/scripts/*.ts` 脚本、无 schema 变更 → self-test 192 / vitest 205 基线不变
- 不新增 check 脚本（迷雾册为文本节，无 schema 约束；毕业核验由现有 V 评审 + R 审查承载）
- 不建图节点（graph.json / consolidated.json schema 不变）
- 不动 `w-model-dev-demo/`

### 5.2 验证

| 验证项 | 预期 |
|---|---|
| `npx tsc --noEmit` | 0 错误 |
| `npm run self-test` | 192/192 全过（基线不变） |
| `cd w-model-dev && npx vitest run` | 205/205 全过（基线不变） |
| D5 文档互引一致性 | 新增节与既有 §8 Out of Scope / 覆盖矩阵 / FM 矩阵 / 禁止行为表交叉检查无矛盾 |
| 版本号三处一致性 | 26.0.0（package.json + skill-metadata.json + SKILL.md frontmatter） |

---

## 六、执行模式

spec 评审通过后由用户选择执行模式（Subagent-Driven / Inline），与既往轮次一致。
