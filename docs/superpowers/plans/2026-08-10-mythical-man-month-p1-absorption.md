# 人月神话吸收 P1 批（39.1.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地《agent 时代的人月神话》吸收设计 P1 批 10 项强化——并行三闸/通读测试/验证账单、原文装填不转述、记叙性优先+失败先归因、结构性约束优先（操作行为第 8 条）、独立评审会话模板、止损三规则、会话生命周期、辩解义务强制、回归约束 #21+增量集成纪律、环境契约前置自检——并完成操作行为 7→8 级联、P0 遗留术语统一、版本 39.0.0 → 39.1.0。

**Architecture:** 纯文档为主 + 少量脚本联动（操作行为 7→8 触发 docs-consistency 逻辑与测试样本级联）。13 个 Task：T1 操作行为第 8 条 + 七→八级联；T2 约束 #21 回归钩子；T3-T10 八处文档新增节（dispatching-parallel-agents / subagent-delegation / bdd-guide / test-driven-development / verifier-spec / requesting-code-review / operational-recovery / root-cause-locator / phase-5 / quality-standards）；T11 P0 遗留术语统一（含 #45 bdd-guide 前瞻引用回检）；T12 SSoT P1 状态 + 版本 39.1.0（7 处）+ CHANGELOG + 吸收记录；T13 全量验证。self-test 基线 249 不变、pre-push 项数 14 不变。

**Tech Stack:** TypeScript strict（tsx runtime）、vitest、Markdown 文档编辑。

**设计文档（SSoT）:** `docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md` §5（P1 细节）+ SSoT §3.4.39（P1 行）

---

## 文件结构

**修订（13）：** `w-model-dev/SKILL.md`（操作行为第 8 条 + 约束 #21）/ `.cursor/skills/dispatching-parallel-agents/SKILL.md` / `w-model-dev/references/subagent-delegation.md` / `w-model-dev/references/bdd-guide.md` / `.cursor/skills/test-driven-development/SKILL.md` / `w-model-dev/references/verifier-spec.md` / `.cursor/skills/requesting-code-review/SKILL.md` / `w-model-dev/references/operational-recovery.md` / `w-model-dev/references/root-cause-locator.md` / `w-model-dev/references/phase-5-coding.md` / `w-model-dev/references/quality-standards.md` / `w-model-dev/references/anti-patterns.md`（#45 引用回检）/ `w-model-dev/references/mythical-man-month-absorption.md`（P1 状态）

**脚本联动（2）：** `w-model-dev/scripts/docs-consistency-logic.ts`（操作行为 7→8）/ `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（样本）

**顶层（8）：** `README.md`（操作行为 8 条）/ `docs/skill-design-document_SSoT.md`（§3.4.39 P1 状态 + 版本行 + 4A 行）/ `AGENTS.md`（约束 #21 登记）/ `package.json` / `w-model-dev/skill-metadata.json` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `CHANGELOG.md`（[39.1.0]）

---

### Task 1: SKILL.md 操作行为第 8 条 + 七条→八条级联

**Files:**
- Modify: `w-model-dev/SKILL.md` / `README.md` / `docs/skill-design-document_SSoT.md` / `w-model-dev/scripts/docs-consistency-logic.ts` / `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

> 设计 §5.4「结构性约束优先」。加第 8 条操作行为会触发 docs-consistency 门禁的「### 七条操作行为」与「7 条核心操作行为」检查，必须全链路级联（参照 P0 反模式 44→46 的联动先例）。

- [ ] **Step 1: SKILL.md 标题与表格**

`### 七条操作行为` → `### 八条操作行为`（L122）

表格（L124-132，第 7 行 Choose Highest Seam 之后）追加：
`| 8 | **Structure Over Persuasion** | 能焊进结构的约束（权限 / 只读 / 网络隔离 / schema 拦截）就不写进提示词；提示词约束是说服性的、每一步都要选择遵守，结构约束是确定性的（第 39 轮 P1 批吸收） |`

- [ ] **Step 2: README.md L82**

`+ 7 条核心操作行为 + 10 条失败模式` → `+ 8 条核心操作行为 + 10 条失败模式`

- [ ] **Step 3: SSoT §10A 4A 行（L2688）**

`| 4A 核心操作行为与失败模式 | 7 条核心操作行为 + 10 条失败模式（F1~F10）+ 6 条运维失败模式（O1~O6）` → `| 4A 核心操作行为与失败模式 | 8 条核心操作行为 + 10 条失败模式（F1~F10）+ 6 条运维失败模式（O1~O6）`

- [ ] **Step 4: docs-consistency-logic.ts（L177/L180）**

`if (!skill.includes('### 七条操作行为'))` → `if (!skill.includes('### 八条操作行为'))`（L177，消息同改）
`if (!readme.includes('7 条核心操作行为'))` → `if (!readme.includes('8 条核心操作行为'))`（L180，消息同改）

- [ ] **Step 5: docs-consistency-logic.test.ts 样本**

`skill: '### 七条操作行为',` → `skill: '### 八条操作行为',`（约 L24）
`readme: '7 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',` → `readme: '8 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',`（约 L20，DoD 维度仍 7，只改操作行为数）

- [ ] **Step 6: 验证门禁**

Run: `npx vitest run w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` → 全 PASS
Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts` → exit 0

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/SKILL.md README.md docs/skill-design-document_SSoT.md w-model-dev/scripts/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "docs: add operating behavior #8 (structure-over-persuasion), cascade 7->8"
```

### Task 2: 约束 #21 回归测试强制钩子

**Files:**
- Modify: `w-model-dev/SKILL.md` / `AGENTS.md`

> 设计 §5.9。SKILL.md 约束清单当前 #1-#20（#20 为 codegraph 修改前查询），追加 #21；AGENTS.md 行动约束登记。

- [ ] **Step 1: SKILL.md 约束清单追加 #21**

在约束 #20（codegraph 修改前强制查询）之后追加：
`21. **回归测试强制钩子**：任何 agent 改动代码后必须跑回归测试（修复引入新 bug 概率 20-50%，第 39 轮 P1 批新增）；禁止"改动代码但不跑回归"的工作流。详见 [references/phase-5-coding.md](references/phase-5-coding.md)「增量集成纪律」节。`

- [ ] **Step 2: AGENTS.md 行动约束登记**

在 AGENTS.md §6 行动约束（「- **修改前 codegraph 查询**（约束 #20）：…」条目，约 L126）之后追加：
`- **回归测试强制钩子**（约束 #21）：任何 agent 改动代码后必须跑回归测试（第 39 轮 P1 批新增）；详见 [w-model-dev/references/phase-5-coding.md](./w-model-dev/references/phase-5-coding.md)「增量集成纪律」节。`

- [ ] **Step 3: re-read + Commit**

Read 确认约束清单编号连续（#1-#21 无断裂）、AGENTS.md 条目格式一致。

```bash
git add w-model-dev/SKILL.md AGENTS.md
git commit -m "docs: add constraint #21 (regression-test hook) for agent code changes"
```

### Task 3: 并行三闸 + 通读测试 + 验证账单（dispatching-parallel-agents）

**Files:**
- Modify: `.cursor/skills/dispatching-parallel-agents/SKILL.md`

> 设计 §5.1（第 2 章）。在「## 不适用的场景」（约 L130）之后插入新节。

- [ ] **Step 1: 插入「## 并行开启判据（第 39 轮 P1 批吸收）」节**

```
## 并行开启判据（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 2 章「人月神话」：分工是有代价的，代价不在你视野里。

**并行三闸**（任一不满足则单线）：
1. 子任务彼此完全独立（无共享状态、无信息依赖）
2. 聚合规则明确（聚合成本低、可确定）
3. 主无需读子任务中间过程即可聚合

**能否通读测试**：语料塞得进上下文 → 主 agent 自己读（更快且省转述失真）；塞不进且不需要中间过程 → 才可开 subagent 并行滤噪。

**验证账单**：每加一个 subagent，预算一笔"主读产出并验证"的 token/时间成本；验证链可省步、省不到零，最终裁决者必须是持有目的的人。
```

- [ ] **Step 2: Commit**

```bash
git add .cursor/skills/dispatching-parallel-agents/SKILL.md
git commit -m "docs: add parallel-launch criteria (three gates + read-through test) to dispatching-parallel-agents"
```

### Task 4: 原文装填不转述 + 验证账单（subagent-delegation）

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

> 设计 §5.2（第 6 章）。在「## 文件落地交接协议与编排者状态日志」（约 L51 前）或「## 每阶段分派时序」（约 L159）之前插入装填原则节。

- [ ] **Step 1: 插入「## 上下文装填原则（第 39 轮 P1 批吸收）」节**

```
## 上下文装填原则（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 6 章「贯彻执行」：任何一次转述都是一次未声明的重新定义。

- **原文照搬**：任务背景原文装填，不翻译、不分解、不预处理；补充说明写下来也视为原文。
- **禁止自撰摘要**：长期项目启动禁止给"自己整理的摘要"——让 agent 读原始文档，或 RAG/grep 随用随取；你以为在帮 agent，实际是在替它做你没意识到的判断。
- **验证账单**：每加一个 subagent，预算一笔"主读产出并验证"的 token/时间成本；验证链可省步、省不到零，最终裁决者必须是持有目的的人。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs: add context-loading principles (verbatim, no paraphrase) to subagent-delegation"
```

### Task 5: 记叙性优先 + 失败先归因（bdd-guide + TDD）

**Files:**
- Modify: `w-model-dev/references/bdd-guide.md` / `.cursor/skills/test-driven-development/SKILL.md`

> 设计 §5.3（第 6 章）。bdd-guide 在「## §5 门禁脚本调用」（约 L318）前插入；TDD 技能在「## 好的测试」（约 L203）节后插入。

- [ ] **Step 1: bdd-guide.md 插入「## 记叙性优先（第 39 轮 P1 批吸收）」节**

```
## 记叙性优先（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 6 章：形式化定义（测试断言）在 agent 时代有一个 1975 年不存在的攻击面——它是可以被优化的目标。评分函数一旦成为目标，就会被 Goodhart 定律攻破。

- **测试断言不是金标准**：只给形式化的会收获"过了测试，但做错了事"的失败。记叙性定义（需求意图）没有可被算法直接优化的形式，守住形式化定义漏掉的部分。
- **失败先归因**：测试失败先问——是改动的错，还是断言本身写错了？该改断言就改断言，需求意图是标准。
- **与反模式 #45 呼应**：subagent 为通过测试而改测试属反指标游戏；归因流程走 R→V→G，禁止擅自改断言凑绿。
```

- [ ] **Step 2: test-driven-development/SKILL.md 插入「### 测试失败先归因（第 39 轮 P1 批吸收）」节**

在「## 好的测试」节之后追加：
```
### 测试失败先归因（第 39 轮 P1 批吸收）

红灯不是终点——测试失败先问三件事：
1. 是改动的错？（修实现）
2. 是断言写错了？（修断言，但须说明与需求对照的依据）
3. 是需求理解变了？（先更新需求/设计文档，经主刀/用户批准后再同步断言）

禁止为凑绿静默改断言（反指标游戏，见 testing-anti-patterns.md 反模式 6 与反模式 #45）。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/bdd-guide.md .cursor/skills/test-driven-development/SKILL.md
git commit -m "docs: add narrative-first principle (assertions not gold standard) to bdd-guide and TDD"
```

### Task 6: 独立评审会话模板（verifier-spec + requesting-code-review）

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md` / `.cursor/skills/requesting-code-review/SKILL.md`

> 设计 §5.5（第 6/13 章）。verifier-spec 补独立评审模板（含目录更新）；requesting-code-review 引用同一模板。

- [ ] **Step 1: verifier-spec.md 目录 + 新增节**

目录（「## 目录」约 L11-19 列表）追加条目：`- 独立评审会话模板（第 39 轮 P1 批吸收）`

在「## 5. PPT 优先级排序」（约 L263）之前插入：
```
## 独立评审会话模板（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 6/13 章：新会话是不带沉没成本的独立评审者——成本几美分，换来真正独立、无内部政治的评审。

**模板提示词**（V 子代理或新会话执行）：
「你不知道这份文档之前的讨论，仅凭它本身给出评审意见——指出所有含糊、遗漏、内部矛盾的地方。」

**使用规则**：
- 重要决策"拍完板之后"用新会话审读，效果优于共享上下文会话（无沉没成本、会问"你说做完了 X，我看代码里没有 X 的实现"）。
- **评估不等于必须改**：评审意见须甄别——特别是明显是馊主意或幻觉的建议，不必执行（第 14 章）。
```

- [ ] **Step 2: requesting-code-review/SKILL.md 引用节**

在「## 如何请求」（约 L29）节内或后追加：
```
**独立评审会话（第 39 轮 P1 批吸收）**：重要决策拍板后，开新会话丢文档独立审读，提示词「你不知道这份文档之前的讨论，仅凭它本身给出评审意见」。评估不等于必须改——馊主意或幻觉建议不执行（详见 verifier-spec.md「独立评审会话模板」节）。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/verifier-spec.md .cursor/skills/requesting-code-review/SKILL.md
git commit -m "docs: add independent-review-session template to verifier-spec and requesting-code-review"
```

### Task 7: 止损三规则 + 会话生命周期（operational-recovery）

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

> 设计 §5.6/§5.7（第 14/11 章）。目录（L6-17）+ 两个新节。

- [ ] **Step 1: 目录追加两行**

在目录列表末尾追加：
`- 止损与弃线规则（第 39 轮 P1 批吸收）`
`- 会话生命周期管理（第 39 轮 P1 批吸收）`

- [ ] **Step 2: 插入「## 止损与弃线规则（第 39 轮 P1 批吸收）」节**

在「## 成本预算与运行日志」（约 L164）之前插入：
```
## 止损与弃线规则（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 14 章「祸起萧墙」：项目这样延迟——一次一天；agent 静默失败按小时计费，成本是崩溃失败的几十倍且不打断你。

- **同错 N 次即弃线**（默认 3，可配）：同一报错 N 次即弃线、节点级资源上限、总预算硬顶——焊进 harness，不靠人在过程中自觉。
- **30% 上下文预算重评**：任何一次 agent 尝试花掉上下文预算 30% 且无明显进展，停下重新讨论方向（打断"再试一次"诱惑，逼你脱离执行模式回到设计模式）。
- **静默失败优先排查**：崩溃节点秒级定损 vs 静默失败按小时计费——后者的成本是前者的几十倍且不会打断你，让你有借口继续等。
```

- [ ] **Step 3: 插入「## 会话生命周期管理（第 39 轮 P1 批吸收）」节**

在「## 大项目与用户中断」（约 L85）之后插入：
```
## 会话生命周期管理（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 11 章「未雨绸缪」：长会话的上下文是 Lehman-Belady 熵增的新宿主——重开会话就是重新设计。

- **50%-70% 位置沉淀重开**：会话超过约几十轮、或出现"agent 不太理解我的意思"信号，在 50%-70% 位置把关键结论沉淀为 markdown 并开新会话装填（最多 85%）。
- **上下文压缩有隐性成本**：压缩消耗额度——内容本来能固化到文档让别的模型接力，死在对话里是亏损；额度骤减时注意是否触发压缩。
- **重开信号**：agent 反复误解指令、早期结论与后期修正冲突、上下文占用逼近上限。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "docs: add stop-loss/abort rules and session lifecycle management to operational-recovery"
```

### Task 8: 辩解义务强制（root-cause-locator）

**Files:**
- Modify: `w-model-dev/references/root-cause-locator.md`

> 设计 §5.8（第 11 章）。在「## 7. R 与 R-iceberg 的边界」（约 L134）之后追加。

- [ ] **Step 1: 插入「## 8. 辩解义务强制（第 39 轮 P1 批吸收）」节**

```
## 8. 辩解义务强制（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 11 章：agent 被训练成"简洁完成任务"，没有内在动机承担辩解义务——把辩解义务做进结构，让不辩解比辩解更麻烦。

- **"已修复"不可接受**：每个 bug 修复必须附一条决策记录（三行：根因 / 所选修法 / 放弃备选）。
- **大改动附自述**：每个大改动必须附一段"这里发生了什么"的自述。
- **会话收尾总结**：每个 agent 会话结束时留一份"这次会话学到了什么"的简短总结。
- **机制价值**：同一 agent 在"只需要说已修复"和"必须解释为什么这样修"两种约束下的表现质量差别很大。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/root-cause-locator.md
git commit -m "docs: add justification-obligation rules to root-cause-locator"
```

### Task 9: 增量集成纪律（phase-5-coding）

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

> 设计 §5.9（第 11/13 章）。在「## 任务分配规则：产品化 vs 系统集成（第 39 轮吸收）」（约 L29，P0 新增）之后插入。

- [ ] **Step 1: 插入「## 增量集成纪律（第 39 轮 P1 批吸收）」节**

```
## 增量集成纪律（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 11/13 章：修复引入新 bug 概率 20-50%（agent 时代只高不低）；大而稀的整体重写让"这次改了什么"在结构上不可问。

- **每次 agent 改动 = 可审 diff + 有对应测试 + 能被独立评审**。
- **禁止大而稀的整体重写式变更**（变更量子无穷大时连 diff 都不存在，"这次改了什么"在结构上不可问）。
- **回归测试强制钩子**（约束 #21）：任何 agent 改动代码后必须跑回归测试；禁止"改动代码但不跑回归"的工作流。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs: add incremental-integration discipline to phase-5"
```

### Task 10: 环境契约前置自检（quality-standards）

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`

> 设计 §5.10（第 13 章）。在「## 质量保障流程（质量门）」（约 L60）之前插入。

- [ ] **Step 1: 插入「## 环境契约前置自检（第 39 轮 P1 批吸收）」节**

```
## 环境契约前置自检（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 13 章：外部依赖没准备好时，agent 的工作会从"实现"退化为"实现 + 环境 debug"的混合——误诊、写 workaround、假装能连上，所有产出的价值都被污染。

- **任务开始前独立验证**：外部依赖（API 密钥 / 服务在线 / 库版本 / 数据库连接）用独立脚本或 CI 步骤验证，不能靠 agent 信任 harness 的承诺。
- **未通过自检前不让 agent 开工**：环境正常性必须先被独立验证，再装填任务。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/quality-standards.md
git commit -m "docs: add environment-contract pre-check to quality-standards"
```

### Task 11: P0 遗留术语统一（含 #45 bdd-guide 引用回检）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md` / `w-model-dev/references/definition-of-done.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/subagent-delegation.md`

> P0 整体终审的 5 项建议级措辞变体。统一为：①「修正权验收测试」（DoD 条目名与 anti-patterns/设计文档对齐）；②「不用整体重跑」；③ #45 关联的 bdd-guide「P1 批新增节」→ 真实节名「记叙性优先」。

- [ ] **Step 1: DoD L61 条目名统一**

`- [ ] 修正权验收：用户能在过程中间修改产物而不用整体重跑（不能 = 仅审计权，反模式 #46）` → `- [ ] 修正权验收测试：用户能在过程中间修改产物而不用整体重跑（不能 = 仅审计权，反模式 #46）`

- [ ] **Step 2: SKILL.md L19 措辞统一**

`只给审计权（日志/面板）不给修正权的流程不合格` → `只给审计权（日志/面板）不给修正权的流程不合格（反模式 #46）`（若已含则跳过；核查实际文本）

把「能在过程中间改产物而不用整体重跑」统一为全文同款（SKILL.md L19 与 subagent-delegation L49 若为「不用重跑一遍」则改为「不用整体重跑」）。

- [ ] **Step 3: #45 关联行 bdd-guide 引用回检（anti-patterns.md L708 附近）**

`"记叙性优先"（测试断言不是金标准，失败先归因，见 [bdd-guide.md](bdd-guide.md) P1 批新增节）` → `"记叙性优先"（测试断言不是金标准，失败先归因，见 [bdd-guide.md](bdd-guide.md)「记叙性优先」节）`

- [ ] **Step 4: 复核 + Commit**

Grep 复核：`P1 批新增节` 应 0 命中（anti-patterns.md）；`修正权验收`（不带"测试"）在 DoD 应 0 命中。

```bash
git add w-model-dev/references/anti-patterns.md w-model-dev/references/definition-of-done.md w-model-dev/SKILL.md w-model-dev/references/subagent-delegation.md
git commit -m "docs: unify P0 terminology (correction-right test, bdd-guide narrative-first ref)"
```

### Task 12: SSoT P1 状态 + 版本 39.1.0 + CHANGELOG + 吸收记录

**Files:**
- Modify: `docs/skill-design-document_SSoT.md` / `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `w-model-dev/references/mythical-man-month-absorption.md`

- [ ] **Step 1: SSoT §3.4.39 版本行（L1111）**

`| 版本号 | 39.0.0（P0 批，三处一致；P1→39.1.0 / P2→39.2.0 排期） |` → `| 版本号 | 39.1.0（P1 批，三处一致；P2→39.2.0 排期） |`

- [ ] **Step 2: SSoT §3.4.39 P1 行增补已实施标注**

P1 行末尾追加 `（已实施，39.1.0）`。

- [ ] **Step 3: SSoT §10A §3.4.39 行版本描述**

`版本号三处 39.0.0（P1→39.1.0 / P2→39.2.0 排期）` → `版本号三处 39.1.0（P2→39.2.0 排期）`

- [ ] **Step 4: 版本号 7 处同步（39.0.0 → 39.1.0）**

1. `package.json` L3 / 2. `w-model-dev/skill-metadata.json` L3（updatedAt 保持 2026-08-10）/ 3. `w-model-dev/SKILL.md` frontmatter / 4. `README.md` L12 / 5. `docs/INSTALL.md` L141 / 6. `docs/skill-design-document_SSoT.md` L1092（§3.4.38 版本行）/ 7. `CONTRIBUTING.md` L231

- [ ] **Step 5: CHANGELOG 顶部新增 [39.1.0]（插在 `## [39.0.0]` 之前）**

```markdown
## [39.1.0] - 2026-08-10

### Added
- 操作行为第 8 条 Structure Over Persuasion（结构性约束优先于提示词）；操作行为 7 → 8 级联（SKILL.md/README/SSoT/docs-consistency）
- 约束 #21 回归测试强制钩子（任何 agent 改动代码后必须跑回归测试）+ AGENTS.md 登记
- 并行三闸 + 能否通读测试 + 验证账单（dispatching-parallel-agents）
- 原文装填不转述（subagent-delegation 上下文装填原则）
- 记叙性优先：测试断言不是金标准 + 失败先归因（bdd-guide / test-driven-development）
- 独立评审会话模板（verifier-spec / requesting-code-review）
- 止损三规则（同错弃线 / 30% 预算重评 / 静默失败优先）+ 会话 50-70% 重开（operational-recovery）
- 辩解义务强制（root-cause-locator）
- 增量集成纪律（phase-5-coding）
- 环境契约前置自检（quality-standards）

### Changed
- P0 遗留术语统一（修正权验收测试 / bdd-guide 记叙性优先引用回检）
- 版本号 39.0.0 → 39.1.0（7 处同步）
```

- [ ] **Step 6: 吸收记录 §2.2 P1 状态更新**

`- P1（39.1.0）：并行三闸 / 原文装填 / 记叙性优先 / 结构性约束 / 独立评审 / 止损三规则 / 会话生命周期 / 辩解义务 / 回归约束 #21 / 环境契约自检` → 末尾追加 `（已实施）`

- [ ] **Step 7: 复核 + Commit**

Grep `39.0.0` 在 7 个同步文件应 0 命中（CHANGELOG 历史条目与 plans/specs 历史文档除外）。

```bash
git add docs/skill-design-document_SSoT.md package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md CONTRIBUTING.md CHANGELOG.md w-model-dev/references/mythical-man-month-absorption.md
git commit -m "chore: bump 39.0.0 -> 39.1.0, changelog [39.1.0]"
```

### Task 13: 全量验证

- [ ] **Step 1: self-test**

Run: `npm run self-test` → 249/249，exit 0。

- [ ] **Step 2: vitest 全量**

Run: `npx vitest run` → 35 files / 521 tests 全过（docs-consistency 样本已更新）。

- [ ] **Step 3: TypeScript strict**

Run: `npx tsc --noEmit` → 0 错误。

- [ ] **Step 4: docs-consistency**

Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts` → exit 0。

- [ ] **Step 5: 破坏样本（操作行为计数）**

临时把 docs-consistency-logic.ts 的 `### 八条操作行为` 检查改回 `### 七条操作行为` → 跑 check-docs-consistency → exit 1（operating-behaviors 违规）→ 还原。

- [ ] **Step 6: 其余门禁抽样**

Run: `npm run lint:security` → exit 0（0 新增）；`npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid.json` → exit 0。

- [ ] **Step 7: 版本残留复核**

Grep 7 个同步文件 `39.0.0` → 0 命中。

---

## Self-Review

**1. Spec 覆盖（对照设计文档 §5 十项）：**
- 5.1 并行三闸/通读测试/验证账单 → T3+T4 ✓
- 5.2 原文装填 → T4 ✓
- 5.3 记叙性优先/失败先归因 → T5 ✓
- 5.4 结构性约束 → T1（操作行为第 8 条 + 级联）✓
- 5.5 独立评审模板 → T6 ✓
- 5.6 止损三规则 → T7 ✓
- 5.7 会话生命周期 → T7 ✓
- 5.8 辩解义务 → T8 ✓
- 5.9 回归约束 #21 + 增量集成 → T2+T9 ✓
- 5.10 环境契约自检 → T10 ✓
- P0 遗留术语统一 → T11 ✓；版本/CHANGELOG/吸收记录 → T12 ✓；验证 → T13 ✓

**2. Placeholder 扫描：** 全部步骤含精确替换字符串与验证命令；插入内容给出完整文本；无 TBD/TODO。

**3. 类型/计数一致性：**
- 操作行为 7→8：T1（SKILL.md/README/SSoT/docs-consistency 逻辑+样本）→ T13 Step 5 破坏样本验证，闭环一致。
- 约束 #21：T2（SKILL.md 约束清单 #1-#21 连续）+ AGENTS.md 登记 → T13 门禁。
- 版本：T12 7 处同步 + CHANGELOG，T13 Step 7 grep 复核。
- 术语：T11 统一后 `P1 批新增节` 0 命中、`修正权验收测试` 一致。
- 链接路径：T5 引用 testing-anti-patterns.md 为同技能目录相对路径（`.cursor/skills/test-driven-development/testing-anti-patterns.md`）；T2/T9 引用 phase-5-coding.md 分别为 SKILL.md（references/phase-5-coding.md）与 AGENTS.md（./w-model-dev/references/phase-5-coding.md）正确相对路径。
