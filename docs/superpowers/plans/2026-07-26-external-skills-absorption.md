# 外部技能吸收实施计划（to-tickets / to-spec / OpenSpec）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 to-tickets / to-spec / OpenSpec 三源精华以"阶段内强化 + 纯文档"方式融入 w-model-dev 8 阶段流程，不改脚本/测试/verifier-spec/反模式。

**Architecture:** 按 SSoT 同步顺序（SSoT → external-skills-absorption.md → phase-N-*.md → SKILL.md → adoption-guide.md → CHANGELOG.md）执行 11 个文档改动任务 + 1 个验证任务。每个任务独立可提交。脚本/测试基线不变，每任务后跑 `npm run build && npm run self-test` 确保未破坏基线。

**Tech Stack:** Markdown 文档 + TypeScript 验证脚本（只读，不改）

**Spec:** [docs/superpowers/specs/2026-07-26-external-skills-absorption-design.md](../specs/2026-07-26-external-skills-absorption-design.md)

---

## 文件结构

| # | 文件 | 改动类型 | 责任 |
|---|---|---|---|
| 1 | `docs/skill-design-document_SSoT.md` | 修订 | §3.4 补一句 + §3.4.8 新增 + §4A.1 第 7 行 + §11A.5 brownfield |
| 2 | `w-model-dev/references/external-skills-absorption.md` | 新增 | 三源吸收映射 + 决策记录 |
| 3 | `w-model-dev/references/phase-1-requirements.md` | 修订 | User Stories + Out of Scope + Implementation/Testing Decisions |
| 4 | `w-model-dev/references/phase-2-system-design.md` | 修订 | 测试 seam 决策节 |
| 5 | `w-model-dev/references/phase-3-outline-design.md` | 修订 | 测试 seam 决策节 |
| 6 | `w-model-dev/references/phase-4-detailed-design.md` | 修订 | 测试 seam 决策节 |
| 7 | `w-model-dev/references/phase-5-coding.md` | 修订 | Tracer-bullet 票据拆解节 |
| 8 | `w-model-dev/references/phase-8-acceptance-test.md` | 修订 | archive 机制节 |
| 9 | `w-model-dev/SKILL.md` | 修订 | 阶段路由表 + 产出契约 + 快速自检 + 操作行为标题 |
| 10 | `docs/adoption-guide.md` | 修订 | Brownfield 适配节 |
| 11 | `CHANGELOG.md` | 修订 | [10.0.0] 条目 |

**不改动的文件**：11 个 `scripts/check-*.ts`、`scripts/__tests__/`、`templates/`、`examples/`、`subagent/`、`references/verifier-spec.md`、`references/subagent-delegation.md`、`references/data-models.md`、`references/anti-patterns.md`、`references/tla-plus-guide.md`、`w-model-dev-demo/**`。

---

## Task 1: SSoT 改动（§3.4 + §3.4.8 + §4A.1 第 7 行 + §11A.5）

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

**改动 1.1：§3.4 编排者-子代理边界补「S-doc 内含票据拆解」**

- [ ] **Step 1: 定位 §3.4.6 门禁增强约束起始行**

Run: `grep -n "^#### 3.4.6 门禁增强约束" docs/skill-design-document_SSoT.md`
Expected: 输出 1 行行号（如 `338:#### 3.4.6 门禁增强约束（2026-07-25）`）

- [ ] **Step 2: 在 §3.4.6 之前插入「S-doc 内含票据拆解」说明**

用 Edit 工具，old_string 为 `#### 3.4.6 门禁增强约束（2026-07-25）`，new_string 为：

```markdown
> **S-doc 内含票据拆解（第 10 轮外部技能吸收）**：阶段 5 进入时，S 子代理在编码前兼任 S-tickets 角色，产出 `tickets.md`（tracer-bullet 垂直切片 + blocking edges DAG）。编排者只按 frontier 分派 S-coding，不参与拆解决策。详见 [phase-5-coding.md](../w-model-dev/references/phase-5-coding.md)「Tracer-bullet 票据拆解」节与 [external-skills-absorption.md](../w-model-dev/references/external-skills-absorption.md)。

#### 3.4.6 门禁增强约束（2026-07-25）
```

- [ ] **Step 3: 验证插入成功**

Run: `grep -c "S-doc 内含票据拆解" docs/skill-design-document_SSoT.md`
Expected: `1`

**改动 1.2：§3.4.7 之后新增 §3.4.8「外部技能吸收」**

- [ ] **Step 4: 定位 §3.4.7 末尾 P3.11 节**

Run: `grep -n "^##### P3.11 coverage/.tmp 清理" docs/skill-design-document_SSoT.md`
Expected: 输出 1 行行号

- [ ] **Step 5: 在 P3.11 节末尾（`---` 之前）插入 §3.4.8**

用 Edit 工具，old_string 为：

```
- vitest `coverage.clean=true`（或 vitest.config.ts 中 `coverage.clean: true`）

---

## 4. 技能工作流程
```

new_string 为：

```markdown
- vitest `coverage.clean=true`（或 vitest.config.ts 中 `coverage.clean: true`）

#### 3.4.8 第 10 轮外部技能吸收约束（2026-07-26）

> 吸收 to-tickets / to-spec / OpenSpec 三源精华，以"阶段内强化 + 纯文档"方式融入 8 阶段流程。不新增脚本、不新增子流程、不新增约束。详细映射与决策记录见 [external-skills-absorption.md](../w-model-dev/references/external-skills-absorption.md)。

##### 阶段 1 强制产出节
- S-doc 产出需求规格时必须包含三节：**User Stories 长列表**（覆盖正常/异常/边界/NFR/CON）、**Out of Scope 显式声明**（至少 1 条）、**Implementation/Testing Decisions 分离**（架构/接口决策与测试 seam 决策分离）
- 禁止具体文件路径与代码片段（除非 prototype 产出的决策密集片段）

##### 阶段 2-4 测试 seam 决策
- S-doc 在系统/概要/详细设计文档中必须包含「测试 seam 决策」节
- 三层一致性：阶段 3 必须引用阶段 2 seam，阶段 4 必须引用阶段 3 seam
- 阶段 2/3 不允许"为覆盖率新建 seam"（违反 to-spec「fewer seams better」原则）
- 阶段 4 私有状态机转移由 TLA+ 不变式断言覆盖，不在代码层引入测试 seam

##### 阶段 5 Tracer-bullet 票据拆解
- S 子代理编码前兼任 S-tickets，产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- 票据为垂直切片（贯穿 schema + service + store + 单元测试），形成 blocking edges DAG
- Wide refactor（重命名/重类型跨全代码库）走 expand-contract 序列
- 例外：单一 bug 修复 / 单一 TLA+ 不变式违反修复 / 单 SD 子系统且 ≤1 文件改动 → 不票据化，直接编码

##### 阶段 8 archive 机制
- 项目级放行（acceptance-test-report.md §9 用户 confirm）后，S 子代理执行 archive
- 路径：`changes/archive/<YYYY-MM-DD>-<feature-slug>/`
- 产物：proposal.md + specs.md + design.md + tasks.md + tla-summary.md + rtm-snapshot.json + verifier-summary.md
- `project.json` 新增可选字段 `archivePath: string`（默认空字符串，向后兼容）

##### §11A Brownfield 阶段级适配
- 阶段 1 Brownfield 入口：codebase survey 5 步（现状调查 → 逆向 RTM → 缺口分析 → User Stories 回填 → Out of Scope 声明）
- 阶段 2-4：seam 决策优先选现有模块边界；DD 仅针对本轮改动模块
- 阶段 5：票据拆解优先 prefactor；Wide refactor 必走 expand-contract
- 不全量补建历史 RTM/TLA+，不重构无关历史代码（约束 5 协同）

---

## 4. 技能工作流程
```

- [ ] **Step 6: 验证 §3.4.8 插入成功**

Run: `grep -c "^#### 3.4.8 第 10 轮外部技能吸收约束" docs/skill-design-document_SSoT.md`
Expected: `1`

**改动 1.3：§4A.1 操作行为表新增第 7 行「Choose Highest Seam」**

- [ ] **Step 7: 修改 §4A.1 标题与表格**

用 Edit 工具，old_string 为：

```
### 4A.1 六条核心操作行为

以下行为在 W 模型 8 阶段全程适用，与「不可违反的约束」互补：约束是「不可越界」的红线，操作行为是「主动遵守」的准则。

| # | 行为 | 在 W 模型中的具体表现 |
|---|---|---|
| 1 | **Surface Assumptions（显式声明假设）** | `/wm analyze` 进入阶段 1 前、`/wm design` 选型前、`/wm code` 生成前，显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义需求 |
| 2 | **Manage Confusion Actively（主动管理困惑）** | 遇到 RTM 不一致、上游产物缺失、跨阶段术语冲突时：STOP → 命名具体困惑 → 向用户提出澄清问题 → 等待解决；禁止「猜一个推进」 |
| 3 | **Push Back When Warranted（必要时反驳）** | 当用户的选择与硬约束冲突（如要求跳过 CHECKPOINT / 估算覆盖率放行）时：直接指出问题 → 量化代价 → 提出替代方案 → 接受用户在完整信息下的覆盖决策 |
| 4 | **Enforce Simplicity（强制简洁）** | 编码前自问「能否更少行？抽象是否物有所值？资深工程师是否会问『为何不直接……』」；1000 行能 100 行完成即失败 |
| 5 | **Maintain Scope Discipline（保持范围纪律）** | 只动该动的；不删除看不懂的注释、不顺手清理无关代码、不重构相邻系统、不删除「看似无用」的代码除非显式批准、不加规格外「看似有用」的功能 |
| 6 | **Verify, Don't Assume（验证而非假设）** | 每个阶段都必须有验证证据（测试通过 / 脚本退出码 / 运行时数据）；「看起来对了」永远不够；§10.5 工件质量门是验证的最后一道闸 |
```

new_string 为：

```markdown
### 4A.1 七条核心操作行为

以下行为在 W 模型 8 阶段全程适用，与「不可违反的约束」互补：约束是「不可越界」的红线，操作行为是「主动遵守」的准则。

| # | 行为 | 在 W 模型中的具体表现 |
|---|---|---|
| 1 | **Surface Assumptions（显式声明假设）** | `/wm analyze` 进入阶段 1 前、`/wm design` 选型前、`/wm code` 生成前，显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义需求 |
| 2 | **Manage Confusion Actively（主动管理困惑）** | 遇到 RTM 不一致、上游产物缺失、跨阶段术语冲突时：STOP → 命名具体困惑 → 向用户提出澄清问题 → 等待解决；禁止「猜一个推进」 |
| 3 | **Push Back When Warranted（必要时反驳）** | 当用户的选择与硬约束冲突（如要求跳过 CHECKPOINT / 估算覆盖率放行）时：直接指出问题 → 量化代价 → 提出替代方案 → 接受用户在完整信息下的覆盖决策 |
| 4 | **Enforce Simplicity（强制简洁）** | 编码前自问「能否更少行？抽象是否物有所值？资深工程师是否会问『为何不直接……』」；1000 行能 100 行完成即失败 |
| 5 | **Maintain Scope Discipline（保持范围纪律）** | 只动该动的；不删除看不懂的注释、不顺手清理无关代码、不重构相邻系统、不删除「看似无用」的代码除非显式批准、不加规格外「看似有用」的功能 |
| 6 | **Verify, Don't Assume（验证而非假设）** | 每个阶段都必须有验证证据（测试通过 / 脚本退出码 / 运行时数据）；「看起来对了」永远不够；§10.5 工件质量门是验证的最后一道闸 |
| 7 | **Choose Highest Seam（选择最高 seam）** | 阶段 2-4 测试设计前置时，优先选现有最高 seam（系统层 HTTP/CLI/进程边界，模块层公共导出，单元层公共 API）；理想零新 seam；禁止为"覆盖率"新建 seam；私有状态机转移由 TLA+ 不变式断言覆盖（与约束 9 协同） |
```

- [ ] **Step 8: 验证第 7 行插入**

Run: `grep -c "Choose Highest Seam" docs/skill-design-document_SSoT.md`
Expected: `1`

**改动 1.4：§11A.4 之后新增 §11A.5「Brownfield 阶段级适配」**

- [ ] **Step 9: 定位 §11A.4 末尾**

Run: `grep -n "^### 11A.4 两条路径的收敛" docs/skill-design-document_SSoT.md`
Expected: 输出 1 行行号

- [ ] **Step 10: 在 §11A.4 表格末尾（`---` 之前）插入 §11A.5**

用 Edit 工具，old_string 为：

```
| 到达全流程时间 | Day 0 | 约一个季度，中间双速 |

---

## 12. 发展规划
```

new_string 为：

```markdown
| 到达全流程时间 | Day 0 | 约一个季度，中间双速 |

### 11A.5 Brownfield 阶段级适配（第 10 轮外部技能吸收）

> 吸收 OpenSpec brownfield 优先理念，对 §11A.3 路径 B 补充阶段级适配细则。权威定义见 [external-skills-absorption.md](../w-model-dev/references/external-skills-absorption.md) §4.5。

#### 适用场景
- 已有代码库引入 W 模型管理后续迭代
- 历史代码无 RTM/无 TLA+ 规格，需要补建追溯
- OpenSpec 风格的 brownfield 项目迁移到 W 模型

#### 阶段 1 Brownfield 入口
S-doc 子代理在阶段 1 产出需求规格前，先执行 codebase survey：

1. **现状调查**：扫描 src/ 产出模块清单（controller/service/store/utils）
2. **逆向 RTM**：从代码反推需求清单（每个公共 API → 候选 REQ 行）
3. **缺口分析**：标注哪些需求有测试覆盖、哪些无覆盖
4. **User Stories 回填**：从代码行为反推 user stories（与 §3.4.8 阶段 1 强制产出节互补）
5. **Out of Scope 声明**：明确本轮 brownfield 迭代不动哪些历史模块

#### 阶段 2-4 Brownfield 适配
- 阶段 2 系统设计：优先复用现有架构，seam 决策优先选现有模块边界
- 阶段 3 概要设计：模块交互 seam 优先选现有公共导出
- 阶段 4 详细设计：新增 DD 仅针对本轮改动模块，历史模块不补 DD（避免范围蔓延）
- TLA+ 规格：仅对本轮改动的 SD 子系统建模（历史模块不补 TLA+）

#### 阶段 5 Brownfield 编码
- 票据拆解时优先 prefactor（to-tickets 原则）：让本轮改动更容易
- Wide refactor 场景（重命名共享符号/重类型）必走 expand-contract
- 历史代码清理不在本轮范围（Out of Scope 声明）

#### Brownfield 不做的事
- 不全量补建历史 RTM（除非用户明确要求，作为独立项目）
- 不全量补建历史 TLA+ 规格（同上）
- 不重构无关历史代码（与 §4A.1 行为 5「Maintain Scope Discipline」协同）

---

## 12. 发展规划
```

- [ ] **Step 11: 验证 §11A.5 插入**

Run: `grep -c "^### 11A.5 Brownfield 阶段级适配" docs/skill-design-document_SSoT.md`
Expected: `1`

- [ ] **Step 12: 跑基线验证（脚本未改，应保持 0 错误 / 91 通过）**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 13: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): add §3.4.8 external skills absorption + §4A.1 row 7 seam + §11A.5 brownfield"
```

---

## Task 2: 新增 external-skills-absorption.md

**Files:**
- Create: `w-model-dev/references/external-skills-absorption.md`

- [ ] **Step 1: 创建文件**

用 Write 工具创建 `w-model-dev/references/external-skills-absorption.md`，内容：

````markdown
# External Skills Absorption

> 三源（to-tickets / to-spec / OpenSpec）吸收决策记录。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.8 / §4A.1 / §11A + 各 `phase-N-*.md` 新增节为准；本文件为吸收映射与决策回溯。

## 1. 吸收源清单

| 源 | URL | 吸收日期 | 吸收范围 |
|---|---|---|---|
| to-tickets | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md | 2026-07-26 | tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract |
| to-spec | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md | 2026-07-26 | seam-first testing + User Stories 长列表 + Out of Scope + Implementation/Testing Decisions 分离 |
| OpenSpec | https://github.com/Fission-AI/OpenSpec | 2026-07-26 | 四产物结构映射 + archive 机制 + brownfield 适配 + context hygiene |

## 2. 吸收决策记录

### 2.1 落地策略：阶段内强化
- 选项：阶段内强化 / 新增子流程 / 双轨制 / 全量融合
- 选定：阶段内强化
- 理由：与"编排者最小化"约束最契合，不新增子流程脚本，方法论由 S 子代理按文档执行

### 2.2 吸收深度：纯文档
- 选项：纯文档 / 文档+可选脚本 / 强门禁
- 选定：纯文档
- 理由：不破坏现有 self-test 基线（91 条），不新增 check-tickets.ts，G 子代理既有职责不变

### 2.3 Brownfield 适配：补充 adoption-guide
- 选项：补充 adoption-guide / 阶段1加分支 / 本轮不做
- 选定：补充 adoption-guide
- 理由：不改阶段主流程，brownfield 路径作为 SSoT §11A.5 子节，与 greenfield 并列

## 3. 三源 → W 模型阶段映射表

| OpenSpec 产物 | W 模型阶段 | W 模型对应产物 | 备注 |
|---|---|---|---|
| proposal.md | 阶段 1 | requirement-spec.md 的「问题陈述+解决方案+User Stories+Out of Scope」节 | 第 4 节强化 |
| specs/ | 阶段 1 | RTM 需求行 + acceptance-test-cases.md | 不变 |
| design.md | 阶段 2-4 | system-design.md + outline-design.md + detailed-design.md | 不变 |
| tasks.md | 阶段 5 | tickets.md（新增） | 第 6 节强化 |
| archive/ | 阶段 8 | changes/archive/YYYY-MM-DD-<feature>/（新增） | 第 7 节强化 |

## 4. 三源精华 → 阶段产物分布

### 4.1 阶段 1（[phase-1-requirements.md](phase-1-requirements.md) 新增节）
- User Stories 长列表（to-spec）
- Out of Scope 显式声明（to-spec）
- Implementation/Testing Decisions 分离（to-spec）

### 4.2 阶段 2-4（phase-2/3/4-*.md 新增「测试 seam 决策」节）
- Seam-first testing 决策（to-spec）
- 三层 seam 一致性约束（to-spec）
- 与 TLA+ 行为门禁正交（已有约束 9）

### 4.3 阶段 5（[phase-5-coding.md](phase-5-coding.md) 新增「Tracer-bullet 票据拆解」节）
- 票据清单 + blocking edges（to-tickets）
- Wide refactor expand-contract（to-tickets）
- 票据内容契约（to-tickets）
- Out of 票据化例外（to-tickets + OpenSpec easy not complex）

### 4.4 阶段 8（[phase-8-acceptance-test.md](phase-8-acceptance-test.md) 新增「archive 机制」节）
- archive 路径 + 产物清单（OpenSpec）
- archive 规则（OpenSpec + to-spec 路径禁用）

### 4.5 adoption-guide（SSoT §11A.5 + [adoption-guide.md](../../docs/adoption-guide.md)）
- Brownfield 适配路径（OpenSpec）

## 5. 与现有约束/反模式的关系

### 5.1 强化现有约束

| 约束 | 强化点 | 来源 |
|---|---|---|
| 约束 1（测试设计前置） | seam 决策是测试设计的前置输入 | to-spec |
| 约束 5（Maintain Scope Discipline） | Out of Scope 显式声明 + brownfield 不重构无关历史代码 | to-spec + OpenSpec |
| 约束 6（按需加载） | context hygiene 提示性补强（阶段切换新会话） | OpenSpec |
| 约束 8（编排者最小化） | S-tickets 由 S 兼任，编排者只按 frontier 路由 | to-tickets |
| 约束 9（TLA+ 行为门禁） | TLA+ 不变式断言覆盖私有状态机，不在代码层引入测试 seam | to-spec |

### 5.2 不引入新约束
- 三源吸收不新增硬红线（保持 19 条约束 + 19 条反模式 + 10 条失败模式不变）
- 新增节是"操作行为"层面（违反不回退，降低质量），不是"硬约束"层面（违反回退）
- §4A.1 第 7 行「Choose Highest Seam」是操作行为，不是硬约束

### 5.3 不弱化现有反模式
- 反模式 #10（编排者越权）：S-tickets 拆解由 S 执行，编排者不越权
- 反模式 #18（跳过 R 直接 S 返工）：票据化不绕过返工循环
- 反模式 #16（TLA+ 占位）：seam 决策不替代 TLA+ 行为门禁

## 6. Verifier 评审影响

### 6.1 不改 verifier-spec.md
- §7.1-§7.5 既有 5 轴评审不变
- 4 targetKind × 5 项标准颗粒度不变
- rawScores 自然波动校验不变

### 6.2 V 子代理引用方式
- V 子代理在 summary digest 时引用各 phase-N-*.md 新增节作为完整性检查项
- 不新增 subCriteria（保持 coverage/correctness/independence/clarity/priority-reasonableness 5 项）
- 不新增 targetKind（保持 requirement/design/code/test/rootcause 5 类）

## 7. 不做的事

- 不新增 check-tickets.ts 脚本（纯文档吸收）
- 不改 check-artifact-gate.ts（不新增票据维度校验）
- 不改 self-test 基线（91 条不变）
- 不改 RTM schema（archivePath 为可选字段，不破坏现有 schema）
- 不改 verifier-spec.md（V 子代理引用方式不变）
- 不改 subagent-delegation.md 角色划分（S-tickets 由 S 兼任）
- 不改 data-models.md 强制字段（archivePath 可选）

## 8. 未来扩展（非本轮）

- 若票据拆解需强门禁：可后续新增 check-tickets.ts（校验 DAG 无环 + frontier + 垂直切片）
- 若 archive 需校验：可后续扩展 check-artifact-gate.ts 校验 archivePath
- 若 brownfield 需独立流程：可后续新增 references/brownfield-guide.md
````

- [ ] **Step 2: 验证文件创建**

Run: `grep -c "^# External Skills Absorption" w-model-dev/references/external-skills-absorption.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/external-skills-absorption.md
git commit -m "docs: add external-skills-absorption.md (three-source mapping + decision record)"
```

---

## Task 3: phase-1-requirements.md 新增三节

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 1: 在「需求解析算法」节之后、「执行方法论」节之前插入三节**

用 Edit 工具，old_string 为：

```
输出: 结构化需求规格 + 验收测试用例 + 风险评估报告
```

```

## 执行方法论
```

new_string 为：

```markdown
输出: 结构化需求规格 + 验收测试用例 + 风险评估报告
```

## User Stories 长列表（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 产出需求规格时，在「需求清单」前必须包含 User Stories 节，覆盖正常/异常/边界/NFR/CON 全场景。

**模板**：

```markdown
## User Stories

1. As a <actor>, I want <feature>, so that <benefit>
2. As a <actor>, I want <feature>, so that <benefit>
...
```

**规则**：
- 每条 user story 对应 ≥1 个 REQ 行（RTM `requirementId` 可追溯）
- 列表「extensive」——覆盖正常/异常/边界/NFR/CON 全场景
- 与「需求清单」互补：user stories 是用户视角，需求清单是系统视角
- A 子代理 ingestion 时把 user stories 作为 chunk 之一（不破坏现有分块策略）

## Out of Scope 显式声明（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 在「需求清单」后必须包含 Out of Scope 节，明确排除的功能/场景。

**模板**：

```markdown
## Out of Scope

- <明确排除的功能/场景>
- <原因：依赖未就绪/范围过大/下轮迭代>
```

**规则**：
- 至少 1 条（即使是「无」也要显式声明）
- 与 NFR/CON 横切治理互补：NFR/CON 是「要做什么」，Out of Scope 是「不做什么」
- V 子代理评审时检查「Out of Scope 是否覆盖了用户提到的边界场景」
- Brownfield 项目须明确声明不动哪些历史模块（见 SSoT §11A.5）

## Implementation/Testing Decisions 分离（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 在「风险与缓解」前必须包含 Implementation Decisions + Testing Decisions 两节，分离架构决策与测试决策。

**模板**：

```markdown
## Implementation Decisions
- <架构/模块/接口/Schema/API 契约决策>
- <避免具体文件路径与代码片段（除非 prototype 产出的决策密集片段）>

## Testing Decisions
- <测试 seam 选择及理由>
- <哪些模块测试、参考哪些既有测试>
```

**规则**：
- Implementation Decisions 与现有「设计假设」互补：假设是「未确认的前提」，决策是「已选定的方向」
- Testing Decisions 与阶段 1 同步验收测试设计互补：本节是「为什么这样测」，验收测试设计是「测什么」
- 禁止具体文件路径（OpenSpec 与 to-spec 共识：路径易过期）

## 执行方法论
```

- [ ] **Step 2: 验证三节插入**

Run: `grep -c "第 10 轮外部技能吸收" w-model-dev/references/phase-1-requirements.md`
Expected: `3`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(phase-1): add User Stories + Out of Scope + Implementation/Testing Decisions"
```

---

## Task 4: phase-2-system-design.md 新增 seam 决策节

**Files:**
- Modify: `w-model-dev/references/phase-2-system-design.md`

- [ ] **Step 1: 在「并行任务（强制）」节之前插入「测试 seam 决策」节**

用 Edit 工具，old_string 为：

```
## 并行任务（强制）

架构设计产出后，**立即**同步生成系统测试用例
```

new_string 为：

```markdown
## 测试 seam 决策（第 10 轮外部技能吸收）

> 吸收 to-spec seam-first testing 方法论。系统级 seam 决策服务于阶段 7 系统测试设计，与现有「系统测试设计」节互补：seam 决策是「在哪测」，系统测试设计是「测什么」。

**模板**：

```markdown
## 测试 seam 决策

### 候选 seam 列表
- <seam-1>: <描述> — <钩住点（HTTP / CLI / 模块导出 / 进程边界）>
- <seam-2>: ...

### 选定 seam
- 系统测试主 seam: <seam-id>（最高 seam，理由：<覆盖最广/最稳定/最少新 seam>）
- 系统测试辅 seam: <seam-id 或 无>（仅当主 seam 无法覆盖某场景）

### 理由
- 为什么主 seam 是最高 seam
- 为什么现有 seam 优于新建 seam
- 新建 seam 的代价与收益（如有新建）
```

**规则**：
- "最高 seam"在系统层 = HTTP API / CLI / 进程边界（外部可观测点）
- 禁止为了"覆盖率"在系统层引入新 seam（违反 to-spec「fewer seams better」原则）
- 阶段 3 必须显式引用阶段 2 选定 seam（"复用阶段 2 seam 的部分"非空，或显式声明"无复用，理由"）

## 并行任务（强制）

架构设计产出后，**立即**同步生成系统测试用例
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "测试 seam 决策（第 10 轮外部技能吸收）" w-model-dev/references/phase-2-system-design.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-2-system-design.md
git commit -m "docs(phase-2): add seam-first testing decision section"
```

---

## Task 5: phase-3-outline-design.md 新增 seam 决策节

**Files:**
- Modify: `w-model-dev/references/phase-3-outline-design.md`

- [ ] **Step 1: 在「并行任务（强制）」节之前插入「测试 seam 决策」节**

用 Edit 工具，old_string 为：

```
## 并行任务（强制）

接口定义产出后，**立即**同步生成集成测试用例
```

new_string 为：

```markdown
## 测试 seam 决策（第 10 轮外部技能吸收）

> 吸收 to-spec seam-first testing 方法论。模块交互级 seam 决策服务于阶段 6 集成测试设计，与现有「集成测试设计」节互补。

**模板**：

```markdown
## 测试 seam 决策

### 模块交互 seam
- <模块对 1>: seam = <模块导出 / 内部接口>
- <模块对 2>: ...

### 选定 seam
- 集成测试主 seam: <seam-id>
- 复用阶段 2 seam 的部分: <列表或无>

### 理由
- 为什么在模块边界而非系统边界测
- 为什么现有模块接口优于新建测试专用接口
```

**规则**：
- "最高 seam"在模块层 = 模块公共导出（不深入私有方法）
- 必须显式声明「复用阶段 2 seam 的部分」（避免重复引入 seam）
- 阶段 4 必须显式引用阶段 3 选定 seam

## 并行任务（强制）

接口定义产出后，**立即**同步生成集成测试用例
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "测试 seam 决策（第 10 轮外部技能吸收）" w-model-dev/references/phase-3-outline-design.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-3-outline-design.md
git commit -m "docs(phase-3): add seam-first testing decision section"
```

---

## Task 6: phase-4-detailed-design.md 新增 seam 决策节

**Files:**
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: 在「并行任务（强制）」节之前插入「测试 seam 决策」节**

用 Edit 工具，old_string 为：

```
## 并行任务（强制）

类 / 方法级设计产出后，**立即**同步生成单元测试用例
```

new_string 为：

```markdown
## 测试 seam 决策（第 10 轮外部技能吸收）

> 吸收 to-spec seam-first testing 方法论。原子单元级 seam 决策服务于阶段 5 单元测试设计（同步产物），与现有「测试用例生成算法」互补。

**模板**：

```markdown
## 测试 seam 决策

### 单元测试 seam
- <DD-1>: seam = <函数签名 / 类公共方法>
- <DD-2>: ...

### 选定 seam
- 单元测试主 seam: <seam-id>（绝大多数情况下复用代码公共 API）
- 不复用阶段 2/3 seam 的部分: <列表或 无>

### 理由
- 为什么单元测试不引入新 seam（理想：代码公共 API 即 seam）
- 例外情况（如需测试内部状态机的私有转移）：如何最小化 seam 引入
```

**规则**：
- "最高 seam"在单元层 = 函数/类的公共 API（to-spec 原则：理想零新 seam）
- 私有状态机/内部转移的测试通过 TLA+ 不变式断言覆盖（与约束 9 TLA+ 行为门禁协同），不在代码层引入测试 seam
- 必须显式引用阶段 3 选定 seam

## 并行任务（强制）

类 / 方法级设计产出后，**立即**同步生成单元测试用例
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "测试 seam 决策（第 10 轮外部技能吸收）" w-model-dev/references/phase-4-detailed-design.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-4-detailed-design.md
git commit -m "docs(phase-4): add seam-first testing decision section"
```

---

## Task 7: phase-5-coding.md 新增 Tracer-bullet 票据拆解节

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

- [ ] **Step 1: 在「代码生成算法」节之后、「执行方法论」节之前插入「Tracer-bullet 票据拆解」节**

用 Edit 工具，old_string 为：

```
输出: 可运行代码 + 单元测试 + 覆盖率报告
```

```

## 执行方法论
```

new_string 为：

```markdown
输出: 可运行代码 + 单元测试 + 覆盖率报告
```

## Tracer-bullet 票据拆解（第 10 轮外部技能吸收）

> 吸收 to-tickets tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract 方法论。S 子代理编码前兼任 S-tickets 角色，产出 `tickets.md` 作为 S-coding 执行单元。

### 时序

```
原时序: O 路由 → CHECKPOINT → S-coding（直接编码）→ V → G
新时序: O 路由 → CHECKPOINT → S-tickets（票据拆解）→ S-coding（按票据执行）→ V → G
```

- S-tickets 由 S 子代理兼任（不新增角色）
- S-tickets 产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- S-tickets 必须在 S-coding 前完成，V/G 不单独评审 tickets.md（合并到阶段 5 V/G 评审）

### 票据清单模板

```markdown
## Tracer-bullet 票据拆解

### 票据清单
| # | 标题 | Blocked by | What it delivers | Status |
|---|---|---|---|---|
| 01 | <标题> | None | <端到端行为，用户视角> | ready-for-agent |
| 02 | <标题> | 01 | <端到端行为> | blocked |
| ... | | | | |

### Wide refactor（如有）
- <refactor-1>: <机械改动描述> — blast radius <范围>
  - Expand: <ticket-id>（添加新形式，旧形式不破坏）
  - Migrate batch 1: <ticket-id>（blocked by Expand）
  - Migrate batch 2: <ticket-id>（blocked by batch 1）
  - Contract: <ticket-id>（删除旧形式，blocked by 所有 batch）
```

### vertical-slice 规则
- 每片贯穿全层（schema + service + store + 单元测试），不是单层切片
- 每片可独立 demo 或验证（独立跑测试通过）
- 每片大小适配单个新鲜上下文窗口（与"子代理任务 ≤1000 词"约束协同）
- 优先 prefactor：先做让实现更容易的预备改动（to-tickets 原则）

### Wide refactor 例外
- 单一机械改动（重命名/重类型）blast radius 跨全代码库时，不强制 tracer-bullet
- 用 expand-contract 序列：expand（新旧并存）→ migrate batches（每批 CI 绿）→ contract（删旧）
- 每批大小按 blast radius（按目录/按包）

### 票据内容契约

```markdown
# <NN> — <标题>

**What to build:** 端到端行为，用户视角（非层-by-layer 实现列表）
**Blocked by:** <票据号/标题列表，或 "None — can start immediately">
**Status:** ready-for-agent | blocked | in-progress | done

- [ ] 验收标准 1
- [ ] 验收标准 2
```

- 禁止具体文件路径与代码片段（to-tickets 与 to-spec 共识：路径易过期）
- 例外：prototype 产出的决策密集片段（状态机/reducer/schema/type shape）可内联，标注来源
- 验收标准与 RTM `unitTest` 字段对应（每张票据 ≥1 单元测试）

### Blocking edges 依赖图
- blocking edges 形成有向无环图（DAG）
- frontier = blockers 全完成的票据（可立即开始）
- 纯线性链：top to bottom
- 编排者按 frontier 一次性分派全部可启动票据（串行执行时按票据号顺序处理，与"主机不支持并行则串行"约束协同）
- 每张票据对应 RTM `codeModule` 字段的 ≥1 条目（SD-xxx:src/path 格式不变）
- 票据 ID（NN）不写入 RTM（RTM 保持现有 schema，不污染数据模型）
- 票据的 Next 分支实现必须与 TLA+ Action 名对应（与约束"TLA+ Next 分支 PascalCase ↔ code camelCase"协同）

### Out of 票据化的例外
- 单一 bug 修复（直接走 R→S-fix 返工循环）
- 单一 TLA+ 不变式违反修复（同上）
- 阶段 5 仅 1 个 SD 子系统且改动 ≤1 文件时（直接编码，不拆票据）
- 不需要票据化时产出 `tickets.md` 仅含一行声明「本阶段改动范围小，不票据化，直接编码」
- V 子代理评审时检查该声明是否合理（避免漏拆）

## 执行方法论
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "Tracer-bullet 票据拆解（第 10 轮外部技能吸收）" w-model-dev/references/phase-5-coding.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs(phase-5): add Tracer-bullet ticket decomposition section"
```

---

## Task 8: phase-8-acceptance-test.md 新增 archive 机制节

**Files:**
- Modify: `w-model-dev/references/phase-8-acceptance-test.md`

- [ ] **Step 1: 在「退出状态」节之前插入「archive 机制」节**

用 Edit 工具，old_string 为：

```
## 退出状态

产物完成但尚未通过阶段门时
```

new_string 为：

```markdown
## Archive 机制（第 10 轮外部技能吸收）

> 吸收 OpenSpec archive 机制。项目级放行后，S 子代理执行 archive，沉淀产物到只读目录。

### 触发时机
项目级放行（acceptance-test-report.md §9 用户勾选 confirm）后，S 子代理执行 archive。

### Archive 路径
`changes/archive/<YYYY-MM-DD>-<feature-slug>/`

### Archive 产物清单
- `proposal.md` ← 阶段 1 需求规格的「问题陈述 + 解决方案 + User Stories + Out of Scope」节抽取
- `specs.md` ← RTM 需求行 + 验收测试用例（UAT-xxx）合并
- `design.md` ← 阶段 2-4 设计产物的技术决策摘要（不含具体文件路径）
- `tasks.md` ← 阶段 5 tickets.md 的票据清单 + 完成状态
- `tla-summary.md` ← TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表）
- `rtm-snapshot.json` ← RTM 最终快照（requirementId → {designDoc, codeModule, tests}）
- `verifier-summary.md` ← 8 阶段 V 评审 qualityLevel + compositeScore 摘要

### Archive 规则
- 由 S 子代理执行（编排者不越权，反模式 #10 不变）
- archive 后 `.w-model/` 原始产物保留（不删除，作为可追溯证据）
- archive 产物只读，后续项目引用时只读取不修改
- archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）
- **tickets.md 源路径无关性**：阶段 5 票据产出位置（`.w-model/tickets.md` 或 `docs/tickets.md`）不影响 archive——archive 时 S 子代理从源路径读取内容，写入 archive 的 `tasks.md`，源文件保留不动

### 与 project.json 的关系
- archive 完成后 S 子代理回填 `project.json.status = "项目完成 + 已归档"`
- archive 路径写入 `project.json.archivePath` 字段（可选字段，默认空字符串，向后兼容）
- check-artifact-gate.ts 不校验 archivePath（保持纯文档吸收，不新增脚本校验）

## 退出状态

产物完成但尚未通过阶段门时
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "Archive 机制（第 10 轮外部技能吸收）" w-model-dev/references/phase-8-acceptance-test.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/references/phase-8-acceptance-test.md
git commit -m "docs(phase-8): add archive mechanism section"
```

---

## Task 9: SKILL.md 同步（路由表 + 产出契约 + 快速自检 + 操作行为标题）

**Files:**
- Modify: `w-model-dev/SKILL.md`

**改动 9.1：阶段路由表补标记**

- [ ] **Step 1: 修改阶段路由表**

用 Edit 工具，old_string 为：

```
| # | 开发阶段 | 同步/执行测试 | 必读参考 |
|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | [references/phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | [references/phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | [references/phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | [references/phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | [references/phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | 集成测试执行 | [references/phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | 系统测试执行 | [references/phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | 验收测试执行 | [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |
```

new_string 为：

```
| # | 开发阶段 | 同步/执行测试 | 第 10 轮外部技能吸收标记 | 必读参考 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | User Stories + Out of Scope + Implementation/Testing Decisions | [references/phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | seam 决策 | [references/phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | seam 决策 | [references/phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | seam 决策 | [references/phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | Tracer-bullet 票据拆解 | [references/phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | 集成测试执行 | — | [references/phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | 系统测试执行 | — | [references/phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | 验收测试执行 | archive 机制 | [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |
```

**改动 9.2：阶段统一产出契约补三要素**

- [ ] **Step 2: 修改阶段统一产出契约**

用 Edit 工具，old_string 为：

```
每个阶段必须：

1. 按阶段参考定义的输入和算法产出文档。
2. 使用对应 [templates/](templates/) 模板；测试用例至少包含 ID、场景、输入、预期输出和优先级。
3. 同步更新 `.w-model/rtm.json` 的需求、设计、代码与测试映射。
4. 给出风险/缺陷等级和缓解措施。
5. 输出阶段摘要：产物路径、RTM 覆盖状态、验证证据、阻塞项和下一步。
```

new_string 为：

```
每个阶段必须：

1. 按阶段参考定义的输入和算法产出文档。
2. 使用对应 [templates/](templates/) 模板；测试用例至少包含 ID、场景、输入、预期输出和优先级。
3. 同步更新 `.w-model/rtm.json` 的需求、设计、代码与测试映射。
4. 给出风险/缺陷等级和缓解措施。
5. 输出阶段摘要：产物路径、RTM 覆盖状态、验证证据、阻塞项和下一步。
6. **第 10 轮外部技能吸收三要素**（适用阶段）：
   - 阶段 1：User Stories + Out of Scope + Implementation/Testing Decisions
   - 阶段 2-4：测试 seam 决策（三层一致性）
   - 阶段 5：Tracer-bullet 票据拆解（tickets.md）
   - 阶段 8：archive 机制（changes/archive/YYYY-MM-DD-<feature>/）
   - 详见 [references/external-skills-absorption.md](references/external-skills-absorption.md)
```

**改动 9.3：操作行为标题改"七条"**

- [ ] **Step 3: 修改 §核心操作行为标题**

先用 Grep 定位：
Run: `grep -n "六条操作行为\|### 六条核心操作行为" w-model-dev/SKILL.md`
Expected: 输出 1 行行号

用 Edit 工具，old_string 为 `### 六条操作行为`，new_string 为 `### 七条操作行为`。

- [ ] **Step 4: 在 SKILL.md §核心操作行为表补第 7 行**

先 Read §核心操作行为表（line 82-92 区域）确认当前结构。

用 Edit 工具，在行为 6 行之后插入行为 7 行。old_string 为行为 6 整行，new_string 为行为 6 + 行为 7。

具体内容（待 Read 后填入）：
```
| 7 | **Choose Highest Seam（选择最高 seam）** | 阶段 2-4 测试设计前置时优先选现有最高 seam；理想零新 seam；私有状态机转移由 TLA+ 不变式覆盖 |
```

**改动 9.4：快速自检补 context hygiene 条目**

- [ ] **Step 5: 在快速自检清单末尾补一条**

用 Edit 工具，old_string 为：

```
- [ ] `check-checkpoint.ts` 是否 exitCode=0

交互样例按需读取
```

new_string 为：

```
- [ ] `check-checkpoint.ts` 是否 exitCode=0
- [ ] **上下文窗口已清理**（第 10 轮外部技能吸收）：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）

交互样例按需读取
```

- [ ] **Step 6: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 7: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add w-model-dev/SKILL.md
git commit -m "docs(skill): sync route table + output contract + self-check + behavior 7"
```

---

## Task 10: adoption-guide.md 同步 Brownfield 节

**Files:**
- Modify: `docs/adoption-guide.md`

- [ ] **Step 1: 在「两条路径的收敛」节之前插入「Brownfield 阶段级适配」节**

用 Edit 工具，old_string 为：

```
---

## 两条路径的收敛
```

new_string 为：

```markdown
---

## Brownfield 阶段级适配（第 10 轮外部技能吸收）

> 吸收 OpenSpec brownfield 优先理念，对路径 B 补充阶段级适配细则。权威定义见 SSoT [§11A.5](./skill-design-document_SSoT.md)。

### 适用场景
- 已有代码库引入 W 模型管理后续迭代
- 历史代码无 RTM/无 TLA+ 规格，需要补建追溯
- OpenSpec 风格的 brownfield 项目迁移到 W 模型

### 阶段 1 Brownfield 入口
S 子代理在阶段 1 产出需求规格前，先执行 codebase survey：

1. **现状调查**：扫描 `src/` 产出模块清单（controller/service/store/utils）
2. **逆向 RTM**：从代码反推需求清单（每个公共 API → 候选 REQ 行）
3. **缺口分析**：标注哪些需求有测试覆盖、哪些无覆盖
4. **User Stories 回填**：从代码行为反推 user stories
5. **Out of Scope 声明**：明确本轮 brownfield 迭代不动哪些历史模块

### 阶段 2-4 Brownfield 适配
- 阶段 2 系统设计：优先复用现有架构，seam 决策优先选现有模块边界
- 阶段 3 概要设计：模块交互 seam 优先选现有公共导出
- 阶段 4 详细设计：新增 DD 仅针对本轮改动模块，历史模块不补 DD（避免范围蔓延）
- TLA+ 规格：仅对本轮改动的 SD 子系统建模（历史模块不补 TLA+）

### 阶段 5 Brownfield 编码
- 票据拆解时优先 prefactor：让本轮改动更容易
- Wide refactor 场景（重命名共享符号/重类型）必走 expand-contract
- 历史代码清理不在本轮范围（Out of Scope 声明）

### Brownfield 不做的事
- 不全量补建历史 RTM（除非用户明确要求，作为独立项目）
- 不全量补建历史 TLA+ 规格（同上）
- 不重构无关历史代码（与 SSoT §4A.1 行为 5「Maintain Scope Discipline」协同）

---

## 两条路径的收敛
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "Brownfield 阶段级适配（第 10 轮外部技能吸收）" docs/adoption-guide.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add docs/adoption-guide.md
git commit -m "docs(adoption): add Brownfield phase-level adaptation section"
```

---

## Task 11: CHANGELOG.md 新增 [10.0.0] 条目

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 在文件头部（[9.0.0] 之前）插入 [10.0.0] 条目**

用 Edit 工具，old_string 为：

```
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [9.0.0] - 2026-07-25
```

new_string 为：

```markdown
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [10.0.0] - 2026-07-26

### 第 10 轮外部技能吸收（to-tickets / to-spec / OpenSpec）

以"阶段内强化 + 纯文档"方式吸收三源精华，不新增脚本、不新增子流程、不新增约束。

#### 新增

- **阶段 1 新增三节**：User Stories 长列表 + Out of Scope 显式声明 + Implementation/Testing Decisions 分离（to-spec PRD 结构）
- **阶段 2-4 新增「测试 seam 决策」节**：seam-first testing（用最高 seam、理想零新 seam、三层一致性约束）
- **阶段 5 新增「Tracer-bullet 票据拆解」节**：垂直切片 + blocking edges DAG + wide refactor expand-contract + Out of 票据化例外
- **阶段 8 新增「archive 机制」节**：`changes/archive/YYYY-MM-DD-<feature>/`，7 类产物，tickets.md 源路径无关性
- **adoption-guide 新增 Brownfield 阶段级适配**：阶段 1 codebase survey 5 步 + 阶段 2-4/5 适配 + 不做的事
- **新增 references/external-skills-absorption.md**：三源吸收映射 + 决策记录 + 与约束/反模式关系
- **SSoT §3.4.8**：第 10 轮外部技能吸收约束小节（阶段 1/2-4/5/8 + §11A.5 brownfield）
- **SSoT §4A.1 第 7 行**：Choose Highest Seam 操作行为（标题改"七条核心操作行为"）
- **SSoT §11A.5**：Brownfield 阶段级适配子节
- **project.json 新增可选字段 archivePath**（默认空字符串，向后兼容）

#### 变更

- SKILL.md 阶段路由表补「第 10 轮外部技能吸收标记」列（阶段 1/2/3/4/5/8 标记，6/7 为 —）
- SKILL.md 阶段统一产出契约补「第 10 轮外部技能吸收三要素」第 6 项
- SKILL.md §核心操作行为标题改"七条操作行为" + 补第 7 行 Choose Highest Seam
- SKILL.md 快速自检补「上下文窗口已清理」条目（OpenSpec context hygiene）
- SSoT §3.4 补「S-doc 内含票据拆解」说明

#### 不变（明确边界）

- 11 个 `scripts/check-*.ts` 脚本不变（纯文档吸收，不新增校验维度）
- self-test 基线 91 条不变
- vitest 测试套件不变
- verifier-spec.md 5 轴 + 5 targetKind 不变
- subagent-delegation.md O-S-V-G-R 边界不变（S-tickets 由 S 兼任）
- anti-patterns.md 19 条反模式不变
- data-models.md 强制字段不变（archivePath 可选）
- w-model-dev-demo/ 不补建新节产物（demo 已归档）

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- vitest 全通过
- 文档一致性人工检查：SSoT §3.4.8 / §4A.1 / §11A.5 与 phase-N-*.md 新增节标题与 SKILL.md 路由表标记一致

## [9.0.0] - 2026-07-25
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "^## \[10.0.0\] - 2026-07-26" CHANGELOG.md`
Expected: `1`

- [ ] **Step 3: 跑基线验证**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build ; npm run self-test`
Expected: build 退出码 0；self-test 91/91 通过

- [ ] **Step 4: 提交**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git add CHANGELOG.md
git commit -m "docs(changelog): add [10.0.0] external skills absorption entry"
```

---

## Task 12: 最终验证（基线 + 文档一致性）

**Files:**
- 无文件改动，仅验证

- [ ] **Step 1: TypeScript strict 编译**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run build`
Expected: 退出码 0，0 错误

- [ ] **Step 2: self-test 基线**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" ; npm run self-test`
Expected: 91/91 全通过

- [ ] **Step 3: vitest 测试**

Run: `cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev" ; npx vitest run scripts/__tests__/`
Expected: 退出码 0，全通过

- [ ] **Step 4: 文档一致性人工检查 — SSoT §3.4.8 与 external-skills-absorption.md §1 引用一致**

Run: `grep -c "external-skills-absorption.md" docs/skill-design-document_SSoT.md`
Expected: ≥1（SSoT §3.4.8 引用 external-skills-absorption.md）

Run: `grep -c "SSoT" w-model-dev/references/external-skills-absorption.md`
Expected: ≥1（absorption.md 引用 SSoT）

- [ ] **Step 5: 文档一致性 — phase-N-*.md 新增节标题与 SKILL.md 路由表标记一致**

Run: `grep -c "第 10 轮外部技能吸收" w-model-dev/references/phase-1-requirements.md w-model-dev/references/phase-2-system-design.md w-model-dev/references/phase-3-outline-design.md w-model-dev/references/phase-4-detailed-design.md w-model-dev/references/phase-5-coding.md w-model-dev/references/phase-8-acceptance-test.md`
Expected: 各文件 ≥1（共 6 个文件，每个至少 1 处「第 10 轮外部技能吸收」标记）

- [ ] **Step 6: 文档一致性 — adoption-guide.md Brownfield 节与 SSoT §11A.5 内容一致**

Run: `grep -c "Brownfield 阶段级适配" docs/adoption-guide.md docs/skill-design-document_SSoT.md`
Expected: 各文件 ≥1

- [ ] **Step 7: 文档一致性 — CHANGELOG [10.0.0] 与实际改动文件清单一致**

Run: `git log --oneline 77b2acd..HEAD`
Expected: 11 个提交（Task 1-11 各一个）

Run: `git diff --stat 77b2acd..HEAD`
Expected: 10 个文件改动（SSoT + external-skills-absorption.md[新增] + phase-1/2/3/4/5/8-*.md + SKILL.md + adoption-guide.md + CHANGELOG.md）

- [ ] **Step 8: 验证基线未破坏**

确认以下三个数字与第 9 轮归档时一致：
- TypeScript 错误数：0
- self-test 通过数：91
- vitest 通过数：与第 9 轮一致（386 + 72 或当前基线）

- [ ] **Step 9: 最终提交（如有未提交的验证记录）**

```bash
cd "d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack"
git status
```
Expected: working tree clean（所有改动已在前 11 个任务提交）

---

## Self-Review

### 1. Spec 覆盖检查

| Spec 节 | 实施任务 | 状态 |
|---|---|---|
| §2 吸收决策（阶段内强化 + 纯文档 + adoption-guide） | 全部任务遵守 | ✅ |
| §3.1 改动文件清单 10 个 | Task 1-11 改 10 个文件 + CHANGELOG | ✅ |
| §3.2 不改动文件边界 | 全部任务不触碰 | ✅ |
| §3.3 OpenSpec 四产物映射 | Task 2 absorption.md §3 映射表 | ✅ |
| §4 阶段 1 强化（User Stories + Out of Scope + Impl/Test Decisions） | Task 3 | ✅ |
| §5 阶段 2-4 seam 决策 | Task 4/5/6 | ✅ |
| §6 阶段 5 票据拆解 | Task 7 | ✅ |
| §7 阶段 8 archive 机制 | Task 8 | ✅ |
| §8 adoption-guide brownfield | Task 10 + Task 1 §11A.5 | ✅ |
| §9 external-skills-absorption.md | Task 2 | ✅ |
| §10 SSoT 同步顺序 + CHANGELOG | Task 1→2→3-8→9→10→11 严格遵守 | ✅ |
| §11 与现有约束/反模式关系 | Task 2 §5 节 | ✅ |
| §12 验证策略 | Task 12 | ✅ |

### 2. 占位符扫描

- 无 TBD / TODO / "implement later"
- 票据模板中的 `<NN>` / `<标题>` / `<seam-id>` 是 S 子代理填充的模板变量（预期保留），非实施占位符
- 所有步骤含完整内容

### 3. 类型/术语一致性

- "第 10 轮外部技能吸收" 在所有文件统一使用
- "Tracer-bullet 票据拆解" 在 phase-5/SKILL/SSoT/absorption 一致
- "测试 seam 决策" 在 phase-2/3/4/SKILL/SSoT 一致
- "Choose Highest Seam" 在 SSoT §4A.1 第 7 行 / SKILL §核心操作行为第 7 行 一致
- "七条核心操作行为"（SSoT）/ "七条操作行为"（SKILL）一致

### 4. 风险点

- Task 9 Step 4 需要先 Read SKILL.md §核心操作行为表确认行结构再插入第 7 行——已在步骤中说明
- PowerShell 不支持 heredoc，所有 git commit 用 `-F` 或单行 `-m`——已用单行 `-m`

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-26-external-skills-absorption.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
