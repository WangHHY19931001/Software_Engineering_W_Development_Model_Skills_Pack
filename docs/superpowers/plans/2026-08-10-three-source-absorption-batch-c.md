# 三源吸收批次 C（P2，40.2.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地三源吸收 P2 弱吸收项 9 项：新建 concurrency-guide / refactoring-catalog 两个 reference、推理预算、decisionConfidence 可选字段、最小权限、票据动态重排、错误分类、persona 能力声明、级联，版本 40.1.0 → 40.2.0。

**Architecture:** 纯文档为主（7 项）+ 1 处 schema 扩展（run-log decisionConfidence 可选字段，不破坏 additionalProperties:false 样本）+ 1 处级联。沿用"精确插入文本 + 子代理驱动 + 两阶段评审"模式。

**Tech Stack:** Markdown、JSON Schema（run-log.schema.json，可选字段不触发样本破坏）、TypeScript 接口（run-log-logic.ts 可选字段）。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-three-source-absorption-design.md` §3.3

**版本级联:** 40.1.0 → 40.2.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `w-model-dev/references/concurrency-guide.md` | **新建**：并发防御三原则/同步区/死锁四条件/偶发失败（Clean-Code ch13 + apA） |
| `w-model-dev/references/refactoring-catalog.md` | **新建**：坏味道→手法→一句话做法速查表（Refactoring ch6~ch12） |
| `w-model-dev/references/estimation-guide.md` | 「模型档位 × 思考预算」条目（agentic Ch17） |
| `w-model-dev/schemas/run-log.schema.json` | decisionConfidence 可选字段（agentic Ch18） |
| `w-model-dev/references/data-models.md` | RunLogEntry 接口补 decisionConfidence |
| `w-model-dev/scripts/run-log-logic.ts` | RunLogEntry 接口补 decisionConfidence（可选字段） |
| `w-model-dev/references/verifier-spec.md` | R3 security 补「最小权限+数据最小化」「prompt 注入防护」（agentic Ch18+Ch13） |
| `w-model-dev/references/phase-5-coding.md` | Tracer-bullet 票据拆解补「动态重排规则」（agentic Ch20） |
| `w-model-dev/references/operational-recovery.md` | 「错误分类处置表」（agentic Ch12） |
| `w-model-dev/references/subagent-persona-matrix.md` | persona 条目补「能力声明」字段（agentic Ch15） |
| `docs/skill-design-document_SSoT.md` | §3.4.40 增补 P2 标注 + §10A |
| `CHANGELOG.md` + 顶层级联 6 处 | 版本 40.2.0 |

---

### Task 1: 新建 concurrency-guide.md

**Files:**
- Create: `w-model-dev/references/concurrency-guide.md`

- [ ] **Step 1: 写入文件**

```markdown
# 并发编程指南（Concurrency Guide）

> 第 40 轮三源吸收：提炼自《代码整洁之道》ch13 + 附录 A（并发编程 II）。
> 用途：阶段 5 编码涉及并发/多线程/异步代码时，S-coding 自检 + V-code 评审按此检查。
> 检查双轨：机械规则（同步区大小、共享可变状态声明）由语言静态工具扫描；语义判断（竞态/死锁风险）由 V 子代理 LLM 评审。

## 并发防御三原则

1. **并发代码独立成类**（SRP）：并发相关逻辑单独封装，不混入业务类。
2. **限制共享数据作用域**：共享可变状态范围越小越好；优先使用数据副本/不可变数据。
3. **线程尽量独立**：减少线程间协作点；协作点越少，竞态窗口越小。

## 同步区纪律

- **同步区尽量小**：锁只保护临界资源，不做无关计算；持锁时间越短，死锁/争用概率越低。
- **警惕同一共享对象上的多个同步方法的组合依赖**：client/server/adapted 三种加锁策略中，推荐 server-based（对象内部方法级同步，调用方无需理解锁语义）。

## 死锁四条件（apA）

死锁成立须同时满足四条件，打破任一即可防死锁：

| 条件 | 含义 | 破局手段 |
|---|---|---|
| 互斥 | 资源一次只能一个线程使用 | 用不可变数据/副本替代 |
| 持有并等待 | 持有一资源等待另一资源 | 一次性申请全部资源 |
| 不可抢占 | 已获资源不能被强制夺走 | 超时释放/可中断锁 |
| 循环等待 | 线程间形成等待环 | 全序锁顺序（按固定顺序加锁） |

## 测试线程代码

- **偶发失败先当线程问题**：禁止归咎"one-off"；先单线程跑通，再多线程重复跑。
- **线程数 > 处理器数**：放大竞争暴露竞态。
- **多平台重复跑**：调度器差异可暴露时序 bug。
- **插桩逼出竞态**：jiggle 随机扰动 / ConTest 类工具主动打乱时序。

## 静态工具 + LLM 评审双轨

- **机械规则**：同步区大小 / 共享可变状态声明 → 语言静态工具（TS: eslint 相关 rule；Java: SpotBugs/PMD 并发规则；Go: go vet -copylocks）。
- **语义判断**：竞态窗口 / 死锁可能 / 组合依赖 → V-code 评审按上表逐条 LLM 检查，命中项标注分级写入 reworkHints。

## 参考

- 坏味道通用清单见 [code-smells-checklist.md](code-smells-checklist.md)（组 G 可变数据条目）。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/concurrency-guide.md
git commit -m "feat: add concurrency-guide reference (Clean-Code ch13 + apA)"
```

### Task 2: 新建 refactoring-catalog.md

**Files:**
- Create: `w-model-dev/references/refactoring-catalog.md`

- [ ] **Step 1: 写入文件**

```markdown
# 重构手法速查表（Refactoring Catalog）

> 第 40 轮三源吸收：提炼自《重构 2》ch6~ch12（62 种手法精选 24 条）。
> 用法：V-code 评审按坏味道命中后推荐对应手法；S-coding 编码/重构时参考。
> 记录格式（ch5）：名称 / 速写 / 动机 / 做法（一句话）。与 [code-smells-checklist.md](code-smells-checklist.md) 互引。

## 提炼与简化（ch6）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 提炼函数 | 意图与实现分离：需花时间浏览才能弄清作用的代码 | 将代码块提取为独立函数，以意图命名 |
| 内联函数 | 函数体与名称同样清晰 | 将函数体替换调用点并删除函数 |
| 提炼变量 | 表达式难以理解 | 将子表达式提取为命名变量 |
| 内联变量 | 变量名不比表达式表达更多 | 用表达式替换变量引用 |
| 改名函数/变量 | 名称不达意 | 重命名为表达意图的名称（迁移式改名） |

## 封装（ch7）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 封装变量 | 裸全局/可变数据 | 用 getter/setter 封装访问 |
| 封装记录 | 裸数据结构跨模块传递 | 包装为类，隐藏内部结构 |
| 封装集合 | 集合直接暴露可被外部修改 | 返回只读视图 + 提供增删方法 |
| 以对象取代基本类型 | 基本类型偏执（魔法数/裸字符串） | 提取为值对象/枚举 |
| 隐藏委托 | 消息链/火车失事 | 在委托方提供直调方法 |
| 移除中间人 | 中间人只转发不增值 | 直接调用被委托对象 |

## 搬移特性（ch8）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 搬移函数 | 依恋情结/函数用他对象数据多于本类 | 将函数移到数据所在类 |
| 搬移字段 | 字段被其他类更多访问 | 移动字段并更新引用 |
| 拆分循环 | 一个循环做多件事 | 拆为多个单职责循环 |
| 移除死代码 | 冗赘元素/死函数 | 删除未使用代码（版本控制可恢复） |

## 重新组织数据（ch9）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 拆分变量 | 一个变量承担多语义 | 拆为多个单一语义变量 |
| 以查询取代派生变量 | 派生值手动同步易错 | 改为每次按源数据计算 |

## 简化条件逻辑（ch10）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 分解条件表达式 | 长条件难以阅读 | 将各分支提取为命名函数 |
| 合并条件表达式 | 多个条件结果相同 | 合并为一个条件（用 || / &&） |
| 卫语句提前返回 | 嵌套 if-else 中一分支是前置检查 | 用卫语句（提前 return）替代嵌套 |
| 多态取代条件 | 类型分支重复出现 | 用多态/策略替代 switch 分支 |
| 引入特例对象 | 大量 null/空对象判空 | 返回特例对象（空对象模式） |
| 引入断言 | 内部假设"必须为真" | 在设值函数/入口加断言（不捕获） |

## 重构 API（ch11）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 查询与修改分离 | 有返回值函数还改状态 | 拆为纯查询 + 独立修改函数 |
| 移除标记参数 | 布尔标记参数控制两套行为 | 拆为两个意图明确的函数 |
| 参数对象 | 参数列表过长 | 将相关参数打包为对象 |
| 保持对象完整 | 只取对象部分字段却传整个对象 | 传整个对象让被调方自行取用 |

## 处理继承（ch12）

| 手法 | 动机 | 做法（一句话） |
|---|---|---|
| 以委托取代继承 | 子类只用父类部分能力（被拒绝的遗赠） | 改为组合：持有父类实例并委托 |
| 提炼超类 | 两兄弟类大量重复 | 提取公共超类 |

## 与坏味道清单的映射

| 坏味道 | 首选手法 |
|---|---|
| 重复代码 | 提炼函数 / 提取超类 |
| 过长函数 | 提炼函数 / 分解条件 |
| 过长参数列表 | 参数对象 / 保持对象完整 |
| 布尔标记参数 | 移除标记参数 |
| 副作用与查询混合 | 查询与修改分离 |
| 全局/可变数据 | 封装变量 |
| 依恋情结 | 搬移函数 |
| 数据泥团 | 提炼类 / 参数对象 |
| 基本类型偏执 | 以对象取代基本类型 |
| 中间人 | 移除中间人 |
| 消息链 | 隐藏委托 |
| 被拒绝的遗赠 | 以委托取代继承 |

## 参考

- 坏味道检测信号见 [code-smells-checklist.md](code-smells-checklist.md)；并发专项见 [concurrency-guide.md](concurrency-guide.md)。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/refactoring-catalog.md
git commit -m "feat: add refactoring-catalog reference (Refactoring ch6-12)"
```

### Task 3: estimation-guide.md 补「模型档位 × 思考预算」

**Files:**
- Modify: `w-model-dev/references/estimation-guide.md`

- [ ] **Step 1: 在「玩具外推警戒」节后追加**

```markdown
## 模型档位 × 思考预算（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch17「推理扩展定律」：性能 = 模型大小 × 推理计算投入；给更小模型更多"思考预算"可超越更大模型。

- **预算权衡判据**：任务超出当前模型档位能力时，先评估"增加思考轮次/反思预算"（成本可控）vs "换更大模型"（成本跃升）——小模型 + 多轮反思常是更优成本决策。
- **估入预算**：多轮反思/自我修正会显著增加 token 消耗，须计入估算（见记账模板 agent 用量字段）。
- **不臆测档位**：模型档位选择与预算决策记入估算依据；不得静默降档换量。
```

- [ ] **Step 2: 同步目录（可选，先读取确认目录列表）**

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/estimation-guide.md
git commit -m "feat(estimation): add model-tier x thinking-budget tradeoff (agentic Ch17)"
```

### Task 4: run-log decisionConfidence 可选字段（schema + data-models + logic 接口）

**Files:**
- Modify: `w-model-dev/schemas/run-log.schema.json`
- Modify: `w-model-dev/references/data-models.md`
- Modify: `w-model-dev/scripts/run-log-logic.ts`

- [ ] **Step 1: schema 追加 properties**

`run-log.schema.json` 的 properties 对象末尾（`"validFindings"` 行之后、`}` 之前）追加：

```json
    ,
    "decisionConfidence": { "description": "决策置信度（agentic Ch18 结构化思维链日志，第40轮新增）：评审/门禁/返工等关键决策的置信度 0.0-1.0，可选字段；供 Loop 4 劣化分析（低置信度高频出现 = 流程或任务定义问题信号）", "type": "number", "minimum": 0, "maximum": 1 }
```

> 注意追加位置的逗号正确性：`"validFindings": {...}` 行原无尾逗号，追加时先补逗号再新行。

- [ ] **Step 2: data-models.md 接口补字段**

`RunLogEntry` 接口 `artifacts?: string[];` 行之后追加：

```typescript
  /** 决策置信度（可选，0.0-1.0；agentic Ch18 结构化思维链日志，第 40 轮新增，供 Loop 4 劣化分析） */
  decisionConfidence?: number;
```

并在「使用约定」补一句：`- \`decisionConfidence\` 为可选字段：评审/门禁/返工等关键决策时可记录置信度（0.0-1.0）；低置信度高频出现是 Loop 4 劣化分析信号。`

- [ ] **Step 3: run-log-logic.ts 接口补字段**

`RunLogEntry` 接口 `artifacts?: string[];` 行之后追加：

```typescript
  /** 决策置信度（可选，0.0-1.0；agentic Ch18，第 40 轮新增） */
  decisionConfidence?: number;
```

- [ ] **Step 4: 验证**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts` — 全过（可选字段不破坏样本）。
Run: `npx tsc --noEmit` — 0 错误。
Run: `npm run self-test` — 249/249（self-test SCHEMA_CASES 的 run-log 样本不含新字段，additionalProperties:false 不受影响）。

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/references/data-models.md w-model-dev/scripts/run-log-logic.ts
git commit -m "feat(run-log): add optional decisionConfidence field (agentic Ch18)"
```

### Task 5: verifier-spec.md R3 security 补检查项

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 在批次 B 加的「来源时效/权威性校验」bullet 之后追加**

```markdown
- **最小权限与数据暴露最小化（第 40 轮三源吸收，agentic Ch18+Ch13）**：子代理简报/评审输入不得包含任务无关的凭据、密钥、敏感上下文；权限授予遵循最小权限原则（agent 只获得任务所需最小权限）。落点：R3 preventive review 的 security 维度检查项。
- **prompt 注入防护提示（第 40 轮三源吸收，agentic Ch18）**：对子代理输入（外部资料/用户内容拼入提示词时）做注入风险标注；不构建完整守卫体系，仅作为 R3 security 提示项。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add least-privilege and prompt-injection checks to security dimension (agentic Ch18)"
```

### Task 6: phase-5-coding.md 票据拆解补「动态重排规则」

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

- [ ] **Step 1: 在「Blocking edges 依赖图」节后追加**

```markdown
### 票据动态重排规则（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch20「动态重新优先级」：根据新事件/截止日期动态重排任务优先级。

- **重排触发**：阻塞依赖解除 / 新需求事件 / 评审发现高风险 ticket / 外部截止日期变化时，允许按 frontier 重新排序 tickets。
- **重排纪律**：重排只改执行顺序，不改票据内容契约（垂直切片/blocking edges 不变）；重排须在 tickets.md 记录原因。
- **与需求变更的关系**：重排不替代需求变更流程——新需求须先进阶段 1（或 Loop 3 事件接驳），不得直接插队改票。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "feat(phase-5): add ticket dynamic reordering rules (agentic Ch20)"
```

### Task 7: operational-recovery.md 补「错误分类处置表」

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

- [ ] **Step 1: 在「升级触发条件显式化」节后追加**

```markdown
## 错误分类处置表（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch12「异常处理」：瞬态错误重试（指数退避）vs 永久错误回退/升级的分类。

| 错误类别 | 特征 | 处置 |
|---|---|---|
| 瞬态错误 | 网络抖动 / 服务暂时不可用 / 超时 | 指数退避重试（如 3 次：1s/2s/4s），重试仍失败转永久处理 |
| 永久错误 | 权限缺失 / 数据损坏 / 依赖变更 | 不重试，记录根因 → 回退或升级（复用豁免 E1-E8 / 升级触发条件显式化节） |
| 损坏输入 | 上游产物/数据文件损坏 | 跳过并记录 note，不中止流程（若为关键路径则升级） |

- **重试边界**：重试次数与退避策略须显式（禁止无限重试 = 静默死循环）。
- **与止损规则的关系**：重试成本计入预算；触发止损三规则（同错弃线/30% 预算重评）时停止重试转人工。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "feat(operational-recovery): add error classification disposition table (agentic Ch12)"
```

### Task 8: subagent-persona-matrix.md persona 补「能力声明」

**Files:**
- Modify: `w-model-dev/references/subagent-persona-matrix.md`

- [ ] **Step 1: 在「1. 现有人格库盘点」节后追加**

```markdown
## 1.5 persona 能力声明字段（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch15「Agent 卡片」能力清单理念（不吸收 A2A 协议本身）。

每个 persona 条目建议补充「能力声明」字段（随 persona 文件头或矩阵表注明）：

- **能力**：该 persona 擅长/不擅长什么（如 code-reviewer：擅长类型/错误处理评审，不擅长性能调优）。
- **输入模式**：接受什么输入（代码文件 / 设计文档 / JSON 产物）。
- **输出模式**：产出什么（评审意见 / VerifierOutput 片段 / 分析结论）。
- **使用边界**：何时适用 / 何时应换其它 persona（供 V-lead/R-lead 分派时判断，避免选错角色 = 协作评审 R16 角色-任务匹配）。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/subagent-persona-matrix.md
git commit -m "feat(subagent-persona-matrix): add persona capability declaration field (agentic Ch15)"
```

### Task 9: SSoT 增补 P2 标注 + CHANGELOG + 版本 40.2.0 级联

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `CHANGELOG.md` / `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md`

- [ ] **Step 1: SSoT §3.4.40 标注 P2 已落地 + §10A P2 行**

§3.4.40 的 P2 行行尾追加「（已落地，40.2.0）」；§10A 追溯表补第 40 轮 P2 行（格式与 P0/P1 行一致，含 9 项落点）。

- [ ] **Step 2: 版本号 40.1.0 → 40.2.0（6 处）**

package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」 / INSTALL frontmatter 示例 / CONTRIBUTING tag 示例。历史文档保留 40.1.0 不误改。

- [ ] **Step 3: CHANGELOG 顶部新增 [40.2.0]**

```markdown
## [40.2.0] - 2026-08-10

### Added
- 三源吸收 P2（9 项）：concurrency-guide（并发防御三原则/死锁四条件/偶发失败=线程问题）、refactoring-catalog（24 手法速查表 + 坏味道映射）、模型档位×思考预算（estimation-guide）、run-log decisionConfidence 可选字段、最小权限+数据最小化+prompt 注入提示（verifier-spec security）、票据动态重排（phase-5）、错误分类处置表（operational-recovery）、persona 能力声明（subagent-persona-matrix）

### Changed
- 版本号 40.1.0 → 40.2.0（6 处同步）
```

- [ ] **Step 4: 验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files / 530 tests 全过
npx tsc --noEmit             # 0 错误
npx tsx w-model-dev/scripts/check-docs-consistency.ts .  # exit 0 全部一致
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md CHANGELOG.md package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md CONTRIBUTING.md
git commit -m "feat: P2 three-source absorption (40.2.0) — concurrency, refactoring catalog, optional fields, hardening"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 C 9 项全部映射：spec §3.3 #1（Task 1）、#2（Task 2）、#3（Task 3）、#4（Task 4，含 schema+data-models+logic 三处同步）、#5（Task 5）、#6（Task 6）、#7（Task 7）、#8（Task 8）、#9（Task 9）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown/JSON/TS；无 TBD/TODO。
- **类型一致性**：decisionConfidence 在三处（schema/data-models/run-log-logic 接口）字段名与类型（number 0-1）一致。
- **已知风险**：Task 4 schema 追加逗号位置是易错点（已标注先补逗号）；self-test SCHEMA_CASES 的 run-log 样本不含新字段，additionalProperties:false 下可选字段不破坏；run-log-logic 接口追加字段不影响既有测试（TS 结构化类型允许多余字段）。
- **执行期补充**：Task 9 额外同步 AGENTS.md references 列表挂接 2 个新 reference（concurrency-guide / refactoring-catalog），属仓库级联既有惯例（同 b6aad36/f88a2a3），已纳入 commit。
