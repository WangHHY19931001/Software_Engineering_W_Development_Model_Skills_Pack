# 四源吸收批次 C（P2，41.2.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地四源吸收 P2 机制说理层 10 项：subagent-persona-matrix 证据加权共识、verifier-spec 编辑者/调节器说理、anti-patterns 候选转正评审、hill-climbing 爬山法哲学、tla-plus 不连续系统穷举、operational-recovery 混沌预期/超标重写、quality-standards 约束创造/满意化、phase-7 可观测性验收、SKILL.md 受控失控/clockware-swarmware，版本 41.1.0 → 41.2.0。

**Architecture:** 纯文档为主（10 项全部）；无脚本改动。失控（OutOfControl）为机制说理层——所有吸收以注释/说理节形式并入既有文档对应节，不新增独立哲学参考；凤凰可观测性三支柱进 phase-7 验收。候选反模式（四源-α/β/γ/δ）按候选生命周期评估转正，不强制编号。

**Tech Stack:** Markdown、TypeScript（仅验证命令用 tsx/vitest/tsc）。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-four-source-absorption-design.md`

**版本级联:** 41.1.0 → 41.2.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `w-model-dev/references/subagent-persona-matrix.md` | 评审角色补「证据加权共识」（失控 ch2 蜜蜂决策） |
| `w-model-dev/references/verifier-spec.md` | 设计原则节补编辑者非作者/调节器不关心原因/运行系统最短路径说理 |
| `w-model-dev/references/anti-patterns.md` | 候选反模式转正评审；错误聚集/超标丢弃进失败模式说理 |
| `w-model-dev/references/hill-climbing-guide.md` | 补爬山法哲学基础节（失控 ch14/15） |
| `w-model-dev/references/tla-plus-guide.md` | 开篇补「为什么」段落（不连续系统不可抽样） |
| `w-model-dev/references/operational-recovery.md` | 补集成初期混沌预期 + 超标模块重写规则 |
| `w-model-dev/references/quality-standards.md` | 补硬约束=结构来源 + 满意化完成说理 |
| `w-model-dev/references/phase-7-system-test.md` | 补可观测性验收标准节 |
| `w-model-dev/SKILL.md` | 核心原则补受控的失控 + clockware/swarmware 选择法则 |
| `docs/skill-design-document_SSoT.md` | §3.4.41 增补 P2 小节 |
| `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `skill-metadata.json` | 级联（版本号） |

---

### Task 1: subagent-persona-matrix.md 补「证据加权共识」

**Files:**
- Modify: `w-model-dev/references/subagent-persona-matrix.md`

- [ ] **Step 1: 「多评审分歧上缴人裁决」节后追加「证据加权共识」节**

在 `### 多评审分歧上缴人裁决（第 40 轮三源吸收）` 节之后追加：

```markdown
### 证据加权共识（第 41 轮四源吸收，失控 ch2 蜂群思维）

> 吸收自《失控》第 2 章：蜜蜂选巢 = 舞蹈强度加权投票 + 递增回报，无中心仲裁，涌现共识（"愚者的选举大厅却运作得极好"）。女王只是谦卑的跟随者。

- **评审结论不靠单一权威裁决**：多个独立角度（R-lead 复核 / V-lead 验证 / G 门禁证据）各带"证据强度"投票，靠可复现证据与递增共识收敛。
- **舞蹈强度 = 论据强度**：评审意见须附证据链（evidence 具体引用，signature-chain inputProvenance），无证据的意见不参与加权。
- **与白箱优先兼容**：每个"舞蹈"（评审意见）必须白箱可见（可追溯来源），不存在凌驾于证据之上的中心权威。
- **与「多评审分歧上缴人裁决」的关系**：共识在证据层收敛；证据仍分歧时按第 40 轮机制上缴人裁决（不自动共识）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/subagent-persona-matrix.md
git commit -m "feat(subagent-persona-matrix): add evidence-weighted consensus principle (Out of Control ch2)"
```

### Task 2: verifier-spec.md 补设计原则说理三则

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 在设计原则节追加「验证器定位」说理**

在 verifier-spec.md 的设计原则/验证器定位相关节追加：

```markdown
### 验证器定位三原则（第 41 轮四源吸收，失控）

1. **验证器是编辑者，不是作者**（失控 ch19）：自然选择/评审只裁剪不合适的变体，不承担创造职责；创造来自变体（S 子代理多方案），验证器负责选择——与「编排者最小化」同构（O 不实施，V 只校验）。
2. **调节器不关心原因，只检测偏差并纠正**（失控 ch7）：外部验证 Agent 检测偏差（对照硬约束/RTM/TLA+ 不变式），不需要也不应该承担根因定位——根因定位归专门的 R 循环（root-cause-locator.md）；单一强门禁可间接约束全局质量状态（钢厂只控制牵引一个变量稳住全部厚度偏差）。
3. **运行系统是发现涌现结构的唯一且最短路径**（失控 ch2）：任何纸面推演/评审都无法替代把系统跑起来——"是否放行"由确定性脚本的真实运行结果（exitCode）决定，评审是概率性意见，运行是可重复证据（强化约束 4/10）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add verifier-positioning principles (editor-not-author, regulator, run-to-discover)"
```

### Task 3: anti-patterns.md 候选转正评审 + 错误聚集说理

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 「候选反模式检测信号」节补转正评审说明**

在候选反模式生命周期节（`### 候选反模式生命周期` 附近）追加：

```markdown
#### 四源候选转正评审（第 41 轮）

批次 A 登记的四源候选（α 复杂性增量累积 / β 模式装饰性引用 / γ 过度 swarm 化 / δ 纸面理由替代真实门禁）按下列判据评估转正：
- **人审通过**：用户确认该反模式在真实项目中可识别、有检测信号、有明确回退动作。
- **≥2 项目回归验证**：在至少 2 个 W 模型项目中确认命中时确实对应流程/质量破坏。
- **不强制编号**：未达转正判据的候选保持候选区（不触发 docs-consistency 最大编号联动）；本批不新增正式反模式编号。
```

- [ ] **Step 2: 失败模式说理补「错误聚集/超标丢弃」**

在失败模式相关节追加：

```markdown
#### 错误聚集与超标丢弃（第 41 轮四源吸收，失控 ch11）

- **错误聚集（蟑螂法则）**：见到一个错误，还有二十三个潜伏——失败模块的错误不是孤立的，R 根因定位与冰山扫掠（iceberg-sweep）须沿失败聚集处深挖，而非修完单点即止。
- **超标模块重写**：错误超过阈值 → 丢弃重写（换不同开发者/视角），而非原地修补；早期错误预示后期错误——高错误密度模块是候选重写对象（operational-recovery.md「超标模块重写」节）。
- **与反模式 #18 的关系**：错误聚集支持 R 深挖（先根因再修），不绕过返工循环。
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(anti-patterns): add candidate promotion review criteria and error-clustering/rewrite rationale"
```

### Task 4: hill-climbing-guide.md 补爬山法哲学基础

**Files:**
- Modify: `w-model-dev/references/hill-climbing-guide.md`

- [ ] **Step 1: 「设计原则」节后追加「爬山法哲学基础」节**

在 `## 设计原则` 节之后追加：

```markdown
## 爬山法哲学基础（第 41 轮四源吸收，失控 ch14/15）

> 吸收自《失控》第 14 章「形态图书馆」与第 15 章「人工进化」：Loop 4 爬坡循环与 SkillOpt 的理论原型。

- **爬山法 = 沿"越来越好"的等高线必到顶峰**：只要确保始终上坡（每个 HarnessImprovementReport 改进信号都比前一个好），就必然收敛到可接受的改进——完美方案周围有"越来越差的伪方案同心环"（适应度景观）。
- **定向进化 = 监督学习 = 育种**：选择压力由育种者（人/评审）决定——育种者只做选择（淘汰不合格），不做生成；与「编排者最小化」（O 不生成、只路由）一致。
- **搜索空间足够大时，有效搜索与真正创造力不可区分**：Loop 4 的变异（bounded edit）→ 选择（人审）→ 累积（validation gate 放行）→ 再变异循环，就是智能搜索。
- **死亡是最好的老师**：失败的变体提供最多信息——改进信号中"为什么此方案不 work"与"如何改进"同等重要。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/hill-climbing-guide.md
git commit -m "feat(hill-climbing-guide): add hill-climbing philosophy section (Out of Control ch14/15)"
```

### Task 5: tla-plus-guide.md 开篇补「为什么」段落

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 1: 「公理」节后追加「为什么需要穷举」段落**

在 `## 公理` 节之后追加：

```markdown
## 为什么需要模型检查穷举（第 41 轮四源吸收，失控 ch11）

> 吸收自《失控》第 11 章：汽车是连续系统（50/60/70mph 通过测试即可推断 55/67mph），但软件/分布式网络/活系统是**不连续系统**——"运行多年后在某组特定值（63.25mph）突然炸掉"，不可能测试每个案例，也不能依赖抽样外推。

- **LLM 评审是抽样性的**（不可靠）：按经验抽几个点评估，可能漏掉不连续边界。
- **确定性脚本对声明式规则是全量校验**：check-*.ts 逐条扫 schema/引用/状态，是"全量而非抽样"。
- **TLA+ TLC 对状态空间是穷举/模型检查**：这是 W 模型为何要 TLA+ 行为门禁的工程根据——不连续系统的正确性不能靠抽样测试外推。
- **BDD 离散覆盖**：BDD scenarios 覆盖离散行为场景（而非抽样），与 TLA+ 穷举互补（tla-bdd-sync 校验等价）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/tla-plus-guide.md
git commit -m "feat(tla-plus-guide): add why-exhaustive-model-checking section (discontinuous systems, Out of Control ch11)"
```

### Task 6: operational-recovery.md 补混沌预期 + 超标重写

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

- [ ] **Step 1: 「止损与弃线规则」节前追加「集成初期混沌预期管理」**

在 `## 止损与弃线规则（第 39 轮 P1 批吸收）` 之前追加：

```markdown
## 集成初期混沌预期管理（第 41 轮四源吸收，失控 ch8 封闭系统）

> 吸收自《失控》第 8 章：密封生态需 60-100 天初始混沌期，之后"很少有什么能颠覆它"；"适度多样性的封闭生态几乎从不失败"。

- **系统集成初期的混沌/不稳定是常态而非故障**：多模块首次集成时接口漂移、环境差异、偶发失败属预期，须管理重试预算与预期，而非每次失败都判定为根本缺陷。
- **重试预算**：集成初期的失败重试有预算上限（与「止损与弃线规则」联动）；预算内重试，超预算走 R 根因定位。
- **适度多样性 = 鲁棒性**：容忍小失败/冗余（而非追求完美纯净）是系统长期稳定的前提（失控 ch5：一点点随机性/错误反而创造长期稳定）——与「受控的失控」边界一致（容忍发生在硬约束包络内）。

## 超标模块重写（第 41 轮四源吸收，失控 ch11）

- **错误超过阈值 → 丢弃重写**：失败模块错误密度超阈值（见 anti-patterns.md「错误聚集与超标丢弃」）时，丢弃重写（换不同开发者/视角），而非原地修补——早期错误预示后期错误，修补只是延长劣质模块生命周期。
- **重写前先建测试基线**：与 phase-5「改动前测试基线」节联动——重写前用既有测试/覆盖率锁定行为契约，重写后回归。
- **与返工循环的关系**：超标重写不绕过 R→V→G→S-fix；重写本身是 S-fix 的一种形式，仍须 R 报告 + V 复审 + G 门禁。
```

- [ ] **Step 2: 更新目录**

在目录（L6-19）的 `- 止损与弃线规则（第 39 轮 P1 批吸收）` 之前追加两行：

```
- 集成初期混沌预期管理（第 41 轮四源吸收）
- 超标模块重写（第 41 轮四源吸收）
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "feat(operational-recovery): add integration chaos expectation and over-threshold module rewrite rules"
```

### Task 7: quality-standards.md 补约束创造 + 满意化说理

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`

- [ ] **Step 1: 头部补「硬约束=结构来源」+「满意化完成」说理**

在 `## 代码质量标准` 之前追加：

```markdown
## 硬约束 = 结构来源（第 41 轮四源吸收，失控 ch19）

> 吸收自《失控》第 19 章「约束创造」：约束既保留旧也组装新——阻碍物种漂移的同一引力，也把随机排列拉入可能性的盆地（Mayr："自由变异只存在于基因型有限部分"）。

- **21 条硬约束不是束缚，而是使系统可进化的结构前提**：变异（S 子代理的方案/编码）必须受限才能落在可行盆地——硬约束包络内允许自组织，违反硬约束 = 撞出包络 = 回退。
- **与 SkillOpt bounded edit 一致**：变异只发生在允许区域（bounded edit），改动限制在可行空间内。

## 满意化完成（第 41 轮四源吸收，失控 ch24）

> 吸收自《失控》第 24 章定律 7「不追求最优，追求多重目标」：复杂自适应机器无法高效，只能满意化（satisficing）；忘掉优雅，能用即美。

- **Definition of Done 是满意化而非最优**：完成 = 达到硬约束包络内可交付（测试/覆盖率/门禁全过），不是"每个指标都最优"。
- **反对过度优化单个局部指标**：Goodhart 风险（反模式 #45 同源）——优化局部指标可能伤害整体目标；评审与 DoD 以多重目标（质量/成本/时间/可维护性）平衡为准。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/quality-standards.md
git commit -m "feat(quality-standards): add constraints-create-structure and satisficing-completion principles"
```

### Task 8: phase-7-system-test.md 补可观测性验收标准

**Files:**
- Modify: `w-model-dev/references/phase-7-system-test.md`

- [ ] **Step 1: 「验收标准」节前追加「可观测性验收标准」节**

在 `## 验收标准` 之前追加：

```markdown
## 可观测性验收标准（第 41 轮四源吸收，凤凰架构 observability）

> 吸收自《凤凰架构》可观测性三支柱（日志/度量/追踪）。系统测试验收除功能/性能/安全外，须验证系统的"可观测性"是否达交付标准。

| 支柱 | 验收判据 | 检测方法 |
|---|---|---|
| 日志 | 关键事件有日志；含 TraceID；无敏感信息/慢操作/追踪诊断/误导（quality-standards 日志规范 4 反模式） | 抽查日志输出 + 敏感信息扫描 |
| 度量 | 关键指标暴露（Counter/Gauge/Histogram 类，如请求量/P95/错误率）；指标可被采集（Pull/Push 端点） | 指标端点探测 + 采样验证 |
| 追踪 | 核心链路可追踪（Trace/Span 树）；跨模块调用有 traceId 传递 | 分布式调用链采样验证 |

**不通过 → 动作**：回编码补可观测性（日志 TraceID / 指标暴露 / 追踪埋点），重跑系统测试。
```

- [ ] **Step 2: 验收标准 checklist 补一项**

在 `## 验收标准` 的 checklist 追加：

```markdown
- [ ] 可观测性达标（日志含 TraceID、关键指标暴露、调用链可追踪）
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/phase-7-system-test.md
git commit -m "feat(phase-7): add observability acceptance criteria (logging/metrics/tracing pillars)"
```

### Task 9: SKILL.md 补受控的失控 + clockware/swarmware

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 核心原则补两段**

在 `**白箱 vs 黑箱（第 39 轮 P2 批吸收）**` 段之后追加：

```markdown
**受控的失控（第 41 轮四源吸收）**：失控只能发生在硬约束包络之内——21 条硬约束是"包络"（系统在包络内自组织、弹回；违反硬约束 = 撞出包络 = 回退）。"放手让复杂系统长出来"与"门禁/人审守住边界"互补：子代理在约束内自由发挥，确定性脚本与 CHECKPOINT 守住失控的边界。

**clockware vs swarmware（第 41 轮四源吸收）**：确定性脚本（校验/门禁/RTM）是 clockware（钟表式精确）；LLM 多代理（设计/评审/头脑风暴）是 swarmware（蜂群式涌现）。选择法则：需要确定性与可复现 → clockware；需要多样性与涌现 → swarmware。swarmware 环节必须由 clockware 收口（如 S 产出 → V 评审 → G 门禁退出码），防止"无门禁的多代理自由发挥"（候选反模式四源-γ）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(SKILL.md): add controlled-chaos boundary and clockware/swarmware selection principles"
```

### Task 10: SSoT §3.4.41 增补 P2 + 级联 + 版本

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `w-model-dev/skill-metadata.json`

- [ ] **Step 1: SSoT §3.4.41 增补 P2 小节**

在 §3.4.41 节 P1 描述后追加：

```markdown
**P2（41.2.0，10 项）**：subagent-persona-matrix 证据加权共识（失控 ch2 蜜蜂决策）、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing-guide 爬山法哲学基础（变异-选择-累积循环）、tla-plus-guide 不连续系统穷举「为什么」段落、operational-recovery 集成初期混沌预期 + 超标模块重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准（日志/度量/追踪）、SKILL.md 受控的失控 + clockware/swarmware 选择法则。
```

- [ ] **Step 2: 顶层级联（版本号 41.2.0）**

1. `AGENTS.md`：SKILL.md 相关描述若含版本引用同步更新。
2. `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md`：版本号 → 41.2.0。
3. `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` frontmatter：version 41.1.0 → 41.2.0。
4. `CHANGELOG.md` 顶部新增：

```markdown
## [41.2.0] - 2026-08-10

### Added
- 四源吸收 P2（10 项）：subagent-persona-matrix 证据加权共识、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing 爬山法哲学基础、tla-plus 不连续系统穷举「为什么」、operational-recovery 集成混沌预期 + 超标重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准、SKILL.md 受控的失控 + clockware/swarmware 选择法则

### Changed
- 版本号 41.1.0 → 41.2.0
```

- [ ] **Step 3: 全量验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files 全过
npx tsc --noEmit             # 0 错误
npm run check:docs-consistency  # exit 0
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 4: Commit**

```bash
git add docs/skill-design-document_SSoT.md README.md AGENTS.md docs/INSTALL.md CHANGELOG.md CONTRIBUTING.md package.json w-model-dev/skill-metadata.json
git commit -m "feat: P2 four-source absorption (41.2.0) — reasoning layer (controlled chaos, evidence consensus, observability)"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 C 10 项全部映射：spec §3.3 #1（Task 1）、#2（Task 2）、#3（Task 3）、#4（Task 4）、#5（Task 5）、#6（Task 6）、#7（Task 7）、#8（Task 8）、#9（Task 9）、#10（Task 10）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown；无 TBD/TODO。
- **类型一致性**：候选反模式命名（四源-α/β/γ/δ）在 Task 3 与批次 A Task 8 登记一致；「错误聚集/超标丢弃」在 anti-patterns（Task 3）与 operational-recovery（Task 6）互引一致；「受控的失控」在 SKILL.md（Task 9）与 quality-standards 硬约束=结构来源（Task 7）说理一致；可观测性三支柱在 phase-7（Task 8）与 quality-standards 日志规范（批次 B Task 5）一致。
- **无脚本改动确认**：本批 10 项全部纯文档；候选反模式不正式编号（docs-consistency 最大编号期望保持 47）；self-test/vitest 基线不变。
