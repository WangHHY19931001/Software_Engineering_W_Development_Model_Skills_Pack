# 人月神话吸收 P2 批（39.2.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地《agent 时代的人月神话》吸收设计 P2 批 6 项强化——估算纪律（新 reference `estimation-guide.md`）、上下文管理手册（新 reference `context-management-guide.md`）、白箱 vs 黑箱工具选型、里程碑设计到无法自欺、侦察 vs 产出两阶段、目的注释写 why 不写 what——并完成版本 39.1.0 → 39.2.0 同步（7 处）、SSoT P2 状态、CHANGELOG [39.2.0]、吸收记录 P2 标注。

**Architecture:** 纯文档为主（2 个新 reference + 4 处文档强化），无脚本联动（P2 不新增门禁/不改变 docs-consistency 期望值；反模式计数 46 不变；self-test 基线 249 不变）。8 个 Task：T1 estimation-guide.md 新建 + Bundled Resources 登记；T2 context-management-guide.md 新建 + Bundled Resources 登记；T3 SKILL.md 白箱 vs 黑箱；T4 writing-plans 里程碑元规则；T5 hill-climbing-guide 侦察 vs 产出；T6 format-conventions 目的注释；T7 SSoT P2 状态 + 版本 39.2.0（7 处）+ CHANGELOG + 吸收记录；T8 全量验证。pre-push 项数 14 不变。

**Tech Stack:** Markdown 文档编辑 + 已有校验脚本（vitest / tsc / check-docs-consistency / self-test）。

**设计文档（SSoT）:** `docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md` §6（P2 细节）+ §3.3（P2 改动文件）+ §9.3（P2 验收清单）

---

## 文件结构

**新增（2）：** `w-model-dev/references/estimation-guide.md` / `w-model-dev/references/context-management-guide.md`

**修订（7）：** `w-model-dev/SKILL.md`（白箱 vs 黑箱原则段 + Bundled Resources 两行登记）/ `.cursor/skills/writing-plans/SKILL.md`（里程碑元规则节）/ `w-model-dev/references/hill-climbing-guide.md`（侦察 vs 产出节 + 目录条目）/ `w-model-dev/references/format-conventions.md`（目的注释节）/ `docs/skill-design-document_SSoT.md`（§3.4.39 P2 状态 + 版本行 + 4A 行）/ `w-model-dev/references/mythical-man-month-absorption.md`（P2 状态）/ `CHANGELOG.md`（[39.2.0]）

**版本号同步（7 处）：** `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` frontmatter / `README.md` / `docs/INSTALL.md` / `docs/skill-design-document_SSoT.md`（§3.4.38 版本行）/ `CONTRIBUTING.md`

---

### Task 1: 新建 estimation-guide.md + Bundled Resources 登记

**Files:**
- Create: `w-model-dev/references/estimation-guide.md`
- Modify: `w-model-dev/SKILL.md`（Bundled Resources 表追加一行）

> 设计 §6.1「估算纪律」（第 8 章）。新增 reference 须按仓库惯例带目录与头部引言。

- [ ] **Step 1: 新建 estimation-guide.md**

```
# 估算纪律（Estimation Guide）

> 吸收自《agent 时代的人月神话》第 8 章：编码份额趋近零——"五分钟是编码，一小时×3 是其他工序"。
> SSoT [§3.4.39](../../docs/skill-design-document_SSoT.md)（第 39 轮 P2 批）为权威定义，本文件为可执行细则。
> 强制等级：违反本文件「禁外推」规则属估算失实（与约束 #4『真实执行』同族）。

## 目录

- 禁"编码×系数"外推
- mini-spike 前置
- 记账模板
- 玩具外推警戒

## 禁"编码×系数"外推

- 编码份额趋近零："让 agent 写这段代码要多久"不是可估的问题——编码只占总工序的一小块。
- 估"完全搞清楚这段代码应该做什么并验证做对了要多久"，不估"让 agent 写这段代码要多久"。
- 任何按"编码耗时 × 系数"外推总工期的估算一律标记不可靠。

## mini-spike 前置

- 正式估算前跑一段真实小片段（成本几十美分，节省误差可能数周）。
- "我不知道，我们跑一小段真实工作试试看"是最诚实的估算。
- mini-spike 产物可弃，学到的结论记入决策记录（见记账模板）。

## 记账模板

每周几分钟录入，一年后是自己的估算基线：

| 字段 | 说明 |
|---|---|
| 任务名 | 可检索的名称 |
| 开始时间 | 本次工作开始 |
| 结束时间 | 本次工作结束 |
| agent 用量 | token 或费用 |
| 你的判断内容 | 简短几句（判断依据 / 中间结论） |
| 结果 | 实际产出 / 是否达标 |

## 玩具外推警戒

凡"看到 demo 做 X → 估我做 Y 也这个时间"一律标记不可靠：demo 的复杂度、边界与你的任务不在同一量级。
```

- [ ] **Step 2: SKILL.md Bundled Resources 表追加登记行**

在 [SKILL.md L261](w-model-dev/SKILL.md)（`mythical-man-month-absorption.md` 行）之后追加：

`| estimation-guide.md | 估算任务 / 编制实施计划前做工作量估算时 |`

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/estimation-guide.md w-model-dev/SKILL.md
git commit -m "docs: add estimation-guide reference (bookkeeping, mini-spike, no multiply-by-factor)"
```

### Task 2: 新建 context-management-guide.md + Bundled Resources 登记

**Files:**
- Create: `w-model-dev/references/context-management-guide.md`
- Modify: `w-model-dev/SKILL.md`（Bundled Resources 表追加一行）

> 设计 §6.2「上下文管理手册」（KV 缓存友好 / 上下文分层 / 自污染 / 档位路由 / 输出结构模板库）。

- [ ] **Step 1: 新建 context-management-guide.md**

```
# 上下文管理手册（Context Management Guide）

> 吸收自《agent 时代的人月神话》第 9/10 章：上下文窗口是有限资源，管理糟糕的账单可达合理版本十倍。
> SSoT [§3.4.39](../../docs/skill-design-document_SSoT.md)（第 39 轮 P2 批）为权威定义，本文件为可执行细则。
> 强制等级：违反本文件「KV 缓存友好」规则（随意改系统提示词前缀）属高成本反模式，禁止。

## 目录

- KV 缓存友好
- 上下文分层
- 自污染
- 档位路由表
- 输出结构模板库

## KV 缓存友好

- 稳定内容放上下文开头、常变内容放末尾（前缀复用是 KV 缓存的命中前提）。
- 禁止随意改系统提示词前缀：整条缓存作废、全价重算。
- 管理糟糕的账单可达合理版本十倍。

## 上下文分层

- 常驻：系统提示 / 当前任务。
- 按需：历史决策 / 参考代码（随用随取，不进上下文常驻）。
- 剔除：早期讨论、已落地内容。
- 判断标准是"这次任务需要吗"，不是"以后可能用得上吗"。

## 自污染

窗口填得越接近上限注意力越分散——合理占用率体感 10%-30%，超过即主动沉淀重开或剔除。

## 档位路由表

| 任务类型 | 档位 |
|---|---|
| 搜索 / 格式转换 / 简单分类 | 低档 |
| 写代码 / 多步推理 / 判断歧义 | 中档 |
| 核心决策 / 关键判断 | 强档 |

备好档位切换机制，任务中途按实际复杂度切换。

## 输出结构模板库

给表格模板（每行一个提取项、列固定）比"把提示词写得更用力"有效——稳定性差一个数量级。
```

- [ ] **Step 2: SKILL.md Bundled Resources 表追加登记行**

在 estimation-guide.md 登记行（T1 新增）之后追加：

`| context-management-guide.md | 长会话上下文管理 / 上下文占用高 / 档位选择时 |`

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/context-management-guide.md w-model-dev/SKILL.md
git commit -m "docs: add context-management-guide reference (kv-cache, layering, routing, self-pollution)"
```

### Task 3: SKILL.md 白箱 vs 黑箱工具选型

**Files:**
- Modify: `w-model-dev/SKILL.md`

> 设计 §6.3（第 17 章）。核心原则区追加 P2 吸收加粗段（与 L19「主刀与修正权」、L21「人机分工线」同模式）。

- [ ] **Step 1: 插入「白箱 vs 黑箱」段**

在 L21「人机分工线」段之后、L23「## 触发决策」之前插入：

```
**白箱 vs 黑箱（第 39 轮 P2 批吸收）**：保留思维链可见 / 可中断 / 可指挥的工具优先；"只允许、不透明"式约束视为红旗；允许和只允许，就是白箱和黑箱的区别——工具选型时白箱优先，黑箱工具须人确认取舍。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs: add whitebox-vs-blackbox tool-selection principle to SKILL.md"
```

### Task 4: writing-plans 里程碑设计到无法自欺

**Files:**
- Modify: `.cursor/skills/writing-plans/SKILL.md`

> 设计 §6.4（第 14 章）。「## 任务结构」（L68-109）之后插入新节。

- [ ] **Step 1: 插入「## 里程碑设计到无法自欺（第 39 轮 P2 批吸收）」节**

在「## 任务结构」节（L68-109，代码围栏结束）之后、「## 禁止占位符」（L111）之前插入：

```
## 里程碑设计到无法自欺（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 14 章：模糊里程碑给自欺留空间——"能跑了就算做完"。

- **里程碑必须预先写明"什么算做完"**：完成判据可度量、无法自欺；模糊里程碑给自欺留空间。
- **评分函数 / 自动检查 ≠ 完成目标任务**：自动检查通过只是形式化侧证据，最终审计位点必须留给人（呼应人机分工线）。
```

- [ ] **Step 2: Commit**

```bash
git add .cursor/skills/writing-plans/SKILL.md
git commit -m "docs: add milestone-design-until-uncheatable to writing-plans"
```

### Task 5: hill-climbing-guide 侦察 vs 产出两阶段

**Files:**
- Modify: `w-model-dev/references/hill-climbing-guide.md`

> 设计 §6.5（第 11 章）。「## 设计原则」（L19-26）之后插入新节 + 目录条目（L17 后）。

- [ ] **Step 1: 目录追加条目**

在目录列表（L11-17）末尾追加：

`- 侦察 vs 产出两阶段（第 39 轮 P2 批吸收）`

- [ ] **Step 2: 插入「## 侦察 vs 产出两阶段（第 39 轮 P2 批吸收）」节**

在「## 设计原则」节（L21-26 表格）之后、「## HarnessImprovementReport Schema」（L28）之前插入：

```
## 侦察 vs 产出两阶段（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 11 章：侦察成本几美分到几美元，跳过成本可能是几天。

- **Pilot-run 侦察流程**：正式任务前先跑小规模真实样本，产物可弃，学到的结论记入决策记录。
- **两阶段模式分离**：侦察阶段快速勇于犯错；产出阶段严格核对。不要把侦察的宽松带进产出，也不要用产出的严格拖慢侦察。
- **成本对照**：侦察成本几美分到几美元；跳过侦察直接正式执行的失败成本可能是几天。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/hill-climbing-guide.md
git commit -m "docs: add recon-vs-production two-phase to hill-climbing-guide"
```

### Task 6: format-conventions 目的注释规则

**Files:**
- Modify: `w-model-dev/references/format-conventions.md`

> 设计 §6.6（第 15 章）。文件末尾（「## 4. 引用关系」节之后）新增编号节。

- [ ] **Step 1: 追加「## 5. 注释与提示词目的规范（第 39 轮 P2 批吸收）」节**

在文件末尾（「## 4. 引用关系」节内容之后）追加：

```
## 5. 注释与提示词目的规范（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 15 章：注释写 why 不写 what；提示词/注释能表达要求但不能表达要求的分量。

- **注释写 why 不写 what**：凡只翻译代码的注释视为废注释（代码本身已表达 what）。
- **目的注释**：记录"这段代码为什么存在 / 服务于什么目的"，给未来 agent 与人的判断依据。
- **提示词的边界**：提示词/注释能表达要求，但不能表达要求的分量——分量靠结构（门禁 / 校验 / 权限）承载。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/format-conventions.md
git commit -m "docs: add purpose-comment rule (why not what) to format-conventions"
```

### Task 7: SSoT P2 状态 + 版本 39.2.0 + CHANGELOG + 吸收记录

**Files:**
- Modify: `docs/skill-design-document_SSoT.md` / `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `w-model-dev/references/mythical-man-month-absorption.md`

> 仿 P1-T12 模式。P2 无脚本联动，版本同步 39.1.0 → 39.2.0。

- [ ] **Step 1: SSoT §3.4.39 版本行（L1111）**

`| 版本号 | 39.1.0（P1 批，三处一致；P2→39.2.0 排期） |` → `| 版本号 | 39.2.0（P2 批，三处一致） |`

- [ ] **Step 2: SSoT §3.4.39 P2 行（L1107）增补已实施标注**

P2 行末尾追加 `（已实施，39.2.0）`。

- [ ] **Step 3: SSoT §3.4.39 引言（L1096）状态更新**

`（已批准，P1 批已实施（39.1.0））` → `（已批准，P2 批已实施（39.2.0））`

- [ ] **Step 4: SSoT §10A §3.4.39 行（L2723）版本描述与状态**

`版本号三处 39.1.0（P2→39.2.0 排期）` → `版本号三处 39.2.0`；行末 `P1 已实施（39.1.0）` → `P2 已实施（39.2.0）`。

- [ ] **Step 5: 版本号 7 处同步（39.1.0 → 39.2.0）**

1. `package.json` L3 / 2. `w-model-dev/skill-metadata.json` L3（updatedAt 保持 2026-08-10）/ 3. `w-model-dev/SKILL.md` L3 frontmatter / 4. `README.md` L12 / 5. `docs/INSTALL.md` L141 / 6. `docs/skill-design-document_SSoT.md` L1092（§3.4.38 版本行）/ 7. `CONTRIBUTING.md` L231

- [ ] **Step 6: CHANGELOG 顶部新增 [39.2.0]（插在 `## [39.1.0]` 之前）**

```markdown
## [39.2.0] - 2026-08-10

### Added
- 新 reference：estimation-guide.md（记账模板 / mini-spike 前置 / 禁"编码×系数"外推 / 玩具外推警戒）
- 新 reference：context-management-guide.md（KV 缓存友好 / 上下文分层 / 自污染 10-30% / 档位路由 / 输出结构模板库）
- 白箱 vs 黑箱工具选型（SKILL.md 核心原则）
- 里程碑设计到无法自欺 + 人作最终审计位点（writing-plans）
- 侦察 vs 产出两阶段（hill-climbing-guide）
- 目的注释：写 why 不写 what（format-conventions）

### Changed
- 版本号 39.1.0 → 39.2.0（7 处同步）
```

- [ ] **Step 7: 吸收记录 §2.2 P2 状态更新**

`- P2（39.2.0）：estimation-guide / context-management-guide / 白箱黑箱 / 里程碑元规则 / 侦察vs产出 / 目的注释` → 末尾追加 `（已实施）`。

- [ ] **Step 8: 复核 + Commit**

Grep `39.1.0` 在 7 个同步文件应 0 命中（CHANGELOG [39.1.0] 历史条目与 plans/specs 历史文档除外）；`check-docs-consistency` exit 0（验证版本三处一致）。

```bash
git add docs/skill-design-document_SSoT.md package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md CONTRIBUTING.md CHANGELOG.md w-model-dev/references/mythical-man-month-absorption.md
git commit -m "chore: bump 39.1.0 -> 39.2.0, changelog [39.2.0]"
```

### Task 8: 全量验证

- [ ] **Step 1: self-test**

Run: `npm run self-test` → 249/249，exit 0。

- [ ] **Step 2: vitest 全量**

Run: `npx vitest run` → 35 files / 524 tests 全过。

- [ ] **Step 3: TypeScript strict**

Run: `npx tsc --noEmit` → 0 错误。

- [ ] **Step 4: docs-consistency**

Run: `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → exit 0。

- [ ] **Step 5: 破坏样本（操作行为计数）**

临时把 docs-consistency-logic.ts 的 `### 八条操作行为` 检查改回 `### 七条操作行为` → 跑 check-docs-consistency → exit 1（operating-behaviors 违规）→ 还原 → exit 0。

- [ ] **Step 6: 其余门禁抽样**

Run: `npm run lint:security` → exit 0（0 新增）；`npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid.json` → exit 0。

- [ ] **Step 7: 版本残留复核**

Grep 7 个同步文件 `39.1.0` → 0 命中。

---

## Self-Review

**1. Spec 覆盖（对照设计文档 §6 六项 + §9.3 验收清单）：**
- 6.1 估算纪律 → T1 ✓
- 6.2 上下文管理手册 → T2 ✓
- 6.3 白箱 vs 黑箱 → T3 ✓
- 6.4 里程碑元规则 → T4 ✓
- 6.5 侦察 vs 产出 → T5 ✓
- 6.6 目的注释 → T6 ✓
- §9.3 Bundled Resources 登记（estimation/context-management）→ T1/T2 ✓；版本/CHANGELOG/吸收记录 → T7 ✓；门禁全绿 → T8 ✓

**2. Placeholder 扫描：** 全部步骤含精确插入文本与验证命令；两个新 reference 内容完整给出；无 TBD/TODO。

**3. 类型/计数一致性：**
- 反模式计数 46 不变（P2 无新增反模式）；self-test 基线 249 不变。
- docs-consistency 期望值不变（操作行为 8 条、约束 #21 不变）；T8 Step 5 破坏样本验证 8 条守卫仍生效。
- 版本：T7 7 处同步 39.1.0 → 39.2.0 + CHANGELOG [39.2.0]，T8 Step 7 grep 复核。
- 链接路径：新 reference 位于 `w-model-dev/references/`，SKILL.md 相对路径 `references/estimation-guide.md` 正确；Bundled Resources 表登记行与文件实际存在一一对应。
- SSoT §10A 版本描述随 T7 同步，无漂移。
