# 第22轮 P0-P3 技能问题修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 W 模型开发技能包在第21轮8阶段调测中发现的10个P0-P3技能层面问题，新增S→R3→V→G预防性审查流程。

**Architecture:** SSoT先行（14项文档）→ schemas层（1项）→ scripts层（7项）→ samples层（8项）→ 测试层 → 自测。核心变更为在S产出后、V评审前插入三阶段R预防性审查（完整性/可靠性/安全性），复用现有R子代理机制但产出PreventiveReview三份报告。

**Tech Stack:** TypeScript (strict mode), JSON Schema (draft-07), vitest, tsx

**Spec:** `docs/superpowers/specs/2026-07-29-round22-p0-p3-skill-fixes-design.md`

**重要修正:** spec §7.1 新增反模式编号为#31，但 anti-patterns.md 中#31已被"归档完整性缺失"占用，#32为"签名链断裂"。本plan统一使用#33。

---

## File Structure

### SSoT 层（14项文档修改）

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 1 | `references/workflow.md` | 新增R3流程描述 | Modify (L35后插入流程图更新 + L109后插入R3说明) |
| 2 | `references/subagent-delegation.md` | R子代理新增预防性审查模式 | Modify (L306后插入R3分派模板) |
| 3 | `references/phase-1-requirements.md` | demo范围声明 + uat-path-mapping强制产出 | Modify (L20后 + L198后) |
| 4 | `references/phase-3-outline-design.md` | 字段命名业务语义对齐 | Modify (L57后插入) |
| 5 | `references/phase-4-detailed-design.md` | 设计项→装配点→测试seam一致性 + 字段命名 | Modify (L90后插入) |
| 6 | `references/phase-5-coding.md` | codeModule格式规范 + 跨平台环境变量 | Modify (L163后 + L183后) |
| 7 | `references/phase-8-acceptance-test.md` | UAT路径映射强制校验 + demo范围N/A | Modify (L71后插入) |
| 8 | `references/rtm-guide.md` | codeModule格式规范 | Modify (L96后插入) |
| 9 | `references/verifier-spec.md` | 常见违规示例 + subCriteria名称清单 | Modify (L132后插入) |
| 10 | `references/anti-patterns.md` | 新增#33跳过R3预防性审查 | Modify (L442后插入) |
| 11 | `references/tla-plus-guide.md` | TLA+/BDD自动化同步校验节 | Modify (L641末尾追加) |
| 12 | `references/bdd-guide.md` | TLA+/BDD自动化同步校验节 | Modify (L549前插入) |
| 13 | `examples/coding.md` | 跨平台.env示例 | Modify (L43末尾追加) |
| 14 | `SKILL.md` + `skill-metadata.json` | 约束#17 R3强制 + 版本号升级 | Modify |

### schemas 层（1项新增）

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 15 | `schemas/preventive-review.schema.json` | PreventiveReview报告schema | Create |

### scripts 层（7项修改/新增）

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 16 | `scripts/gate-logic.ts` | codeModule格式校验 + uat-path-mapping回填校验逻辑 | Modify |
| 17 | `scripts/check-artifact-gate.ts` | phase=1 uat-path-mapping存在性 + phase=5回填+codeModule格式 | Modify |
| 18 | `scripts/check-bdd-model.ts` | 多路径查找（根目录/子目录回退） | Modify (L193-196) |
| 19 | `scripts/check-design-contract-consistency.ts` | uat-path-mapping缺失明确提示 | Modify (L205-211) |
| 20 | `scripts/check-run-log.ts` | R3记录校验（S→V间须有3条R3记录） | Modify |
| 21 | `scripts/check-preventive-review.ts` | 新增：校验R3三份报告完整性 | Create |
| 22 | `scripts/check-tla-bdd-sync.ts` | 新增：TLA+/BDD转移/状态/不变式diff比对 | Create |

### samples 层（8项新增）

| # | 路径 | 用途 | 操作 |
|---|---|---|---|
| 23 | `samples/gate/bad-phase5-missing-uat-path-mapping.json` | P0-1缺失文件 | Create |
| 24 | `samples/gate/valid-phase5-with-uat-path-mapping.json` | P0-1合规 | Create |
| 25 | `samples/gate/bad-phase5-codemodule-format.json` | P0-2格式错误（3个bad） | Create |
| 26 | `samples/bdd/valid-manifest-root.json` | P2-6根目录manifest | Create |
| 27 | `samples/preventive-review/valid-completeness.json` | R3完整性合规 | Create |
| 28 | `samples/preventive-review/bad-missing-evidence.json` | R3缺失evidence | Create |
| 29 | `samples/tla-bdd-sync/valid.json` | TLA+/BDD一致 | Create |
| 30 | `samples/tla-bdd-sync/bad-transition-mismatch.json` | TLA+/BDD转移不一致 | Create |

### 测试层

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 31 | `scripts/preventive-review-logic.ts` | R3校验纯逻辑层 | Create |
| 32 | `scripts/tla-bdd-sync-logic.ts` | TLA+/BDD同步纯逻辑层 | Create |
| 33 | `scripts/__tests__/preventive-review-logic.test.ts` | R3单元测试 | Create |
| 34 | `scripts/__tests__/tla-bdd-sync-logic.test.ts` | TLA+/BDD同步单元测试 | Create |
| 35 | `scripts/__tests__/gate-enhancement.test.ts` | 覆盖新校验逻辑 | Modify |
| 36 | `scripts/self-test.ts` | 注册新校验器 | Modify |

---

## Task 1: SSoT - workflow.md 新增R3流程描述

**Files:**
- Modify: `w-model-dev/references/workflow.md:35` (流程图后)
- Modify: `w-model-dev/references/workflow.md:109` (阶段门评审后)

- [ ] **Step 1: 在L35流程图后插入R3流程说明**

在 `## 总体流程图` 章节的流程图代码块结束后（L35后）插入：

```markdown

### R3 预防性审查流程（第22轮新增）

```
O 路由 → CHECKPOINT → S 产出 → R3 预防性审查 → V 评审 → G 门禁 → CHECKPOINT 放行
```

S 产出后、V 评审前，强制插入三阶段R预防性审查（R3）：

| 阶段 | 审查维度 | 检查项 | 产出文件 |
|---|---|---|---|
| R-完整性 | 产物完整性 | 字段齐全/模板套用/RTM登记/demo范围边界/N-A标记/uat-path-mapping回填 | `.w-model/preventive-reviews/<phase>-completeness.json` |
| R-可靠性 | 逻辑可靠性 | TLA+/BDD等价性/状态机一致性/接口契约/字段命名业务语义对齐/设计项装配点与测试seam一致性 | `.w-model/preventive-reviews/<phase>-reliability.json` |
| R-安全性 | 安全风险 | 输入校验/鉴权/越权/敏感信息/限流装配/密码哈希 | `.w-model/preventive-reviews/<phase>-security.json` |

**与返工R的区别**：返工R在V/G不通过后触发，定位根因；R3在S产出后主动触发，预防性审查。详见 [subagent-delegation.md](subagent-delegation.md)「R3 预防性审查分派模板」。
```

- [ ] **Step 2: 在L109阶段门评审后插入R3强制说明**

在 `## 阶段门评审（每个阶段统一）` 章节的LLM-as-a-Verifier评审描述后（L109后）插入：

```markdown

**R3 预防性审查强制**：V 评审前须先完成 R3 三阶段审查（completeness/reliability/security），产出三份 PreventiveReport JSON。V 子代理须读取 R3 报告并将发现纳入 reworkHints。跳过 R3 直接进入 V 评审命中反模式 #33。G 子代理须跑 `check-preventive-review.ts` 校验三份报告完整性。
```

- [ ] **Step 3: 验证修改**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx -e "console.log('workflow.md check')"`
Expected: 无输出错误

- [ ] **Step 4: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/workflow.md
git commit -m "docs(ssot): workflow.md 新增R3预防性审查流程描述"
```

---

## Task 2: SSoT - subagent-delegation.md 新增R3分派模板

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md:306` (R子代理分派模板后)

- [ ] **Step 1: 在L306后插入R3预防性审查分派模板**

在 `### R 子代理分派模板` 章节末尾（L306后）插入：

```markdown

### R3 预防性审查分派模板（第22轮新增）

> S 产出后、V 评审前触发。R3 复用 R 子代理机制，但目的为预防性审查而非根因定位。

**分派时序**：S 产出 → R3-completeness / R3-reliability / R3-security（可并行）→ V 评审

**R3 子代理输入**：
- 当前阶段产物路径
- 上游产物（需求/设计文档、RTM、TLA+ 规格、BDD features）
- 审查维度（completeness / reliability / security）

**R3 子代理产出**：`.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`

**PreventiveReview schema**：见 `schemas/preventive-review.schema.json`

**R3 审查清单（按维度）**：

| 维度 | 检查项 |
|---|---|
| completeness | 字段齐全 / 模板套用 / RTM 登记 / demo 范围边界 / N-A 标记 / uat-path-mapping 回填 |
| reliability | TLA+/BDD 等价性 / 状态机一致性 / 接口契约 / 字段命名业务语义对齐 / 设计项装配点与测试 seam 一致性 |
| security | 输入校验 / 鉴权 / 越权 / 敏感信息 / 限流装配 / 密码哈希 |

**R3 与返工R的区别**：

| 属性 | 返工R（现有） | 预防R3（新增） |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S 产出后主动触发 |
| 目的 | 定位根因 | 预防性审查 |
| 产出 | RootCauseReport | PreventiveReview 三份报告 |
| 方法论 | root-cause-locator.md（5-Why / 鱼骨图 / 上游回溯）定位根因 | 借鉴 root-cause-locator.md 分析工具，但目的不同：预防性审查用「完整性清单 + 可靠性核验 + 安全基线」三维度检查产物，不定位根因 |
| schema | rootcause-report.schema.json | preventive-review.schema.json |

**V 评审参考方式**：V 子代理在评审时须读取 R3 三份报告，将 R3 发现的问题纳入 `reworkHints`。V 不得跳过 R3 报告直接评审（命中反模式 #33）。
```

- [ ] **Step 2: 验证修改**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx -e "console.log('subagent-delegation.md check')"`
Expected: 无输出错误

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(ssot): subagent-delegation.md 新增R3预防性审查分派模板"
```

---

## Task 3: SSoT - phase-1-requirements.md 新增demo范围声明+uat-path-mapping强制产出

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md:20` (§输出)
- Modify: `w-model-dev/references/phase-1-requirements.md:198` (§并行任务)

- [ ] **Step 1: 在L20 §输出章节后追加uat-path-mapping.md强制产出**

在 `## 输出` 章节的现有产出列表末尾（L20后）追加：

```markdown
- `docs/uat-path-mapping.md`：UAT 路径映射表（**强制产出**，第22轮 P0-1 修正）。阶段1产出初始模板，阶段5回填实际路径，阶段8验收时校验完整性。格式见 [phase-8-acceptance-test.md](phase-8-acceptance-test.md) §UAT 路径映射表。
```

- [ ] **Step 2: 在L198 §并行任务后追加demo范围声明要求**

在 `## 并行任务（强制）` 章节末尾（L198后）追加：

```markdown

### demo 范围声明（第22轮 P1-3 修正）

S-doc 产出需求规格时，须在 `Out of Scope` 节显式声明 demo 范围外子系统。验收测试设计须对照 Out of Scope 标记 N/A 用例（附注释说明缺失端点名和原因）。

**R3 完整性维度校验**：
- 验收测试设计的 N/A 用例是否与 Out of Scope 声明一致
- N/A 用例是否附注释说明缺失端点名和原因
- 不一致或注释缺失 → R3 报告标注 finding，V 评审纳入 reworkHints
```

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(ssot): phase-1 新增demo范围声明+uat-path-mapping强制产出"
```

---

## Task 4: SSoT - phase-3-outline-design.md 新增字段命名业务语义对齐

**Files:**
- Modify: `w-model-dev/references/phase-3-outline-design.md:57` (接口契约Schema模板后)

- [ ] **Step 1: 在L57后插入字段命名业务语义对齐检查项**

在 `## 接口契约 Schema 模板` 章节末尾（L57后）插入：

```markdown

## 字段命名业务语义对齐（第22轮 P1-4 修正）

设计文档字段命名须与业务语义对齐。若因技术约束无法对齐，须在设计文档「Implementation Decisions」节说明字段映射。

**检查规则**（R3 可靠性审查项，非硬性门禁）：
- 字段命名须反映业务语义（如「关注关系」用 `followerId/followeeId` 而非 `userId/bloggerId`）
- 若因技术约束无法对齐，须在 Implementation Decisions 节说明字段映射关系
- 不一致且无 Implementation Decisions 说明 → R3 可靠性审查标注 finding（severity=Required），V 评审纳入 reworkHints

**示例**：
- ✅ `followerId/followeeId`（业务语义清晰）
- ❌ `userId/bloggerId`（业务语义模糊，需 Implementation Decisions 说明映射）
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/phase-3-outline-design.md
git commit -m "docs(ssot): phase-3 新增字段命名业务语义对齐"
```

---

## Task 5: SSoT - phase-4-detailed-design.md 新增设计项装配点+字段命名

**Files:**
- Modify: `w-model-dev/references/phase-4-detailed-design.md:90` (并行任务后)

- [ ] **Step 1: 在L90后插入设计项→装配点→测试seam一致性校验**

在 `## 并行任务（强制）` 章节的L4 BDD features设计部分后（L90后）插入：

```markdown

## 设计项→装配点→测试 seam 三者一致性（第22轮 P1-5 修正）

每个设计项（如 DD-026 RateLimitMiddleware）须声明：
- **装配点**：中间件链位置（如 `app.use('/api/', rateLimitMiddleware)`）
- **测试 seam**：HTTP 层 / 独立实例 / 白盒

**校验规则**（R3 可靠性审查项）：
- 若装配点为空但测试 seam 为 HTTP 层 → R3 可靠性审查标注 finding
- 设计项须在详细设计文档中显式声明装配点和测试 seam

## 字段命名业务语义对齐（第22轮 P1-4 修正，同步 phase-3）

详细设计文档中的字段命名须与 phase-3 概要设计保持一致。若因技术约束无法对齐，须在「Implementation Decisions」节说明字段映射。
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/phase-4-detailed-design.md
git commit -m "docs(ssot): phase-4 新增设计项装配点一致性+字段命名对齐"
```

---

## Task 6: SSoT - phase-5-coding.md 新增codeModule格式规范+跨平台环境变量

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md:163` (codeModule强制条款后)
- Modify: `w-model-dev/references/phase-5-coding.md:183` (NFR/CON codeModule回填后)

- [ ] **Step 1: 在L163后插入codeModule格式规范**

在 `## RTM 登记` 章节的强制条款P1.4后（L163后）插入：

```markdown

### codeModule 格式规范（第22轮 P0-2 修正）

`codeModule` 字段须按以下格式填写，由 `check-artifact-gate.ts --phase=5` 强制校验：

| 行类型 | 格式 | 正则 | 示例 |
|---|---|---|---|
| REQ 行 | `SD-xxx:src/path/to/file.ts` | `^SD-[\d.]+:src/.+\.(ts\|js\|py\|java)$` | `SD-5.2.1:src/auth/login.ts` |
| NFR 行 | `src/path/to/file.ts` 或 `横切` | `^src/.+\.(ts\|js\|py\|java)$` 或 `^横切$` | `src/middleware/rateLimit.ts` |
| CON 行 | 同 NFR | 同 NFR | `横切` |

**校验逻辑**：
- REQ 行（`requirementId` 以 `REQ-` 开头）：校验 `codeModule` 匹配 `^SD-[\d.]+:src/.+`
- NFR 行（`requirementId` 以 `NFR-` 开头）：校验 `codeModule` 匹配 `^src/.+` 或 `=== "横切"`
- CON 行（`requirementId` 以 `CON-` 开头）：同 NFR
- 格式不匹配 → check-artifact-gate.ts 退出码 1，reasons 列出具体 requirementId
```

- [ ] **Step 2: 在L183后插入跨平台环境变量设置节**

在 `### NFR/CON codeModule 回填` 章节末尾（L183后）插入：

```markdown

## 跨平台环境变量设置（第22轮 P3-9 修正）

Windows PowerShell 下 `cross-env` 可能失效。推荐方案：

### 推荐方案：dotenv

在项目根创建 `.env` 文件，`import 'dotenv/config'` 自动加载：

```bash
# .env
JWT_SECRET=test-secret-blog-demo
PORT=3000
```

```typescript
// src/app.ts 首行
import 'dotenv/config';
// process.env.JWT_SECRET 自动可用
```

### 备选方案：cross-env

`package.json` scripts 使用 `cross-env`（需安装为 devDependency）：

```json
{
  "devDependencies": {
    "cross-env": "^7.0.3"
  },
  "scripts": {
    "test": "cross-env JWT_SECRET=test-secret-blog-demo npx vitest run"
  }
}
```

### Windows PowerShell 适配

`cross-env` 在 PowerShell 下可能失效，建议用以下方式之一：
- `$env:JWT_SECRET="test-secret-blog-demo"` 临时设置
- 使用 `dotenv` 包（推荐）
```

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs(ssot): phase-5 新增codeModule格式规范+跨平台环境变量"
```

---

## Task 7: SSoT - phase-8-acceptance-test.md 新增UAT路径映射强制校验

**Files:**
- Modify: `w-model-dev/references/phase-8-acceptance-test.md:71` (UAT路径映射表后)

- [ ] **Step 1: 在L71后插入强制校验说明和demo范围N/A标记要求**

在 `## UAT 路径映射表` 章节末尾（L71后）插入：

```markdown

### 强制校验说明（第22轮 P0-1 修正）

`docs/uat-path-mapping.md` 为阶段1强制产出，阶段5回填实际路径，阶段8验收时校验完整性。

**校验规则**（由 `check-artifact-gate.ts` 执行）：
- phase=1：校验 `docs/uat-path-mapping.md` 文件存在性
- phase=5：校验每条 UAT-NNN 的「实际路径」列非 `_待阶段5回填_`，且 `mappingType` ∈ `["直接","等价","替代"]`
- 缺失文件或未回填项 → 退出码 1，reasons 列出具体 UAT ID

### demo 范围 N/A 标记要求（第22轮 P1-3 修正）

验收测试设计的 N/A 用例须：
- 与阶段1 Out of Scope 声明一致
- 附注释说明缺失端点名和原因
- R3 完整性维度校验不一致或注释缺失 → 标注 finding
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/phase-8-acceptance-test.md
git commit -m "docs(ssot): phase-8 新增UAT路径映射强制校验+demo范围N/A要求"
```

---

## Task 8: SSoT - rtm-guide.md 新增codeModule格式规范

**Files:**
- Modify: `w-model-dev/references/rtm-guide.md:96` (各阶段RTM字段更新清单后)

- [ ] **Step 1: 在L96后插入codeModule格式规范**

在 `### 1. 各阶段 RTM 字段更新清单` 表格末尾（L96后）插入：

```markdown

### codeModule 格式规范（第22轮 P0-2 修正）

`codeModule` 字段须按行类型填写不同格式：

| 行类型 | 格式 | 正则 | 示例 |
|---|---|---|---|
| REQ 行 | `SD-xxx:src/path/to/file.ts` | `^SD-[\d.]+:src/.+\.(ts\|js\|py\|java)$` | `SD-5.2.1:src/auth/login.ts` |
| NFR 行 | `src/path/to/file.ts` 或 `横切` | `^src/.+\.(ts\|js\|py\|java)$` 或 `^横切$` | `src/middleware/rateLimit.ts` |
| CON 行 | 同 NFR | 同 NFR | `横切` |

**校验时机**：`check-artifact-gate.ts --phase=5` 强制校验。
**校验逻辑**：按 `requirementId` 前缀（`REQ-` / `NFR-` / `CON-`）分支匹配正则。
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/rtm-guide.md
git commit -m "docs(ssot): rtm-guide 新增codeModule格式规范"
```

---

## Task 9: SSoT - verifier-spec.md 新增常见违规示例

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md:132` (§2.3 subCriteria标准模板后)

- [ ] **Step 1: 在L132后插入常见违规示例节**

在 `### 2.3 各阶段 subCriteria 标准模板` 章节末尾（L132后）插入：

```markdown

### 2.4 常见违规示例（第22轮 P2-7 修正）

> 针对 D12/D31 缺陷：V 子代理曾手工编造 subCriteria 名称、使用非法 mappingType、添加额外字段。以下为常见违规示例及正确写法。

**违规示例 1：mappingType 使用非法值**

```json
// ❌ 违规：mappingType 使用 "NFR" / "CON" 不在枚举内
{ "mappingType": "NFR" }
{ "mappingType": "CON" }

// ✅ 正确：mappingType 须 ∈ ["直接", "等价", "替代"]
{ "mappingType": "直接" }
```

**违规示例 2：subCriteria.name 不匹配标准名称**

```json
// ❌ 违规：使用中文或不匹配 ^[a-z][a-z-]*$ 模式
{ "name": "性能" }
{ "name": "安全" }
{ "name": "Correctness" }

// ✅ 正确：使用 §2.3 表格中的标准名称（小写+连字符）
{ "name": "correctness" }
{ "name": "security" }
{ "name": "architecture-soundness" }
```

**违规示例 3：额外字段违反 additionalProperties: false**

```json
// ❌ 违规：添加 schema 未定义的字段
{ "name": "correctness", "weight": 0.3, "customField": "xxx" }

// ✅ 正确：仅使用 schema 定义字段（name/description/weight/score/rawScores/variance/evidence）
{ "name": "correctness", "weight": 0.3, "score": 0.85, "rawScores": [0.83, 0.85, 0.87], "variance": 0.000267, "evidence": "L45-52" }
```

**推荐 subCriteria 名称清单**（直接引用 §2.3 表格）：
- requirement: `completeness` / `clarity` / `consistency` / `testability` / `traceability`
- design: `architecture-soundness` / `requirement-coverage` / `interface-consistency` / `feasibility` / `testability`
- code: `correctness` / `security` / `readability` / `maintainability` / `conformance`
- test: `coverage` / `correctness` / `independence` / `clarity` / `priority-reasonableness`
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(ssot): verifier-spec 新增常见违规示例节"
```

---

## Task 10: SSoT - anti-patterns.md 新增#33跳过R3预防性审查

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md:442` (#32签名链断裂后)
- Modify: `w-model-dev/references/anti-patterns.md:50` (反模式清单表)

- [ ] **Step 1: 在L442后插入#33反模式**

在 `## #32 签名链断裂` 章节末尾（L442后）插入：

```markdown

## #33 跳过 R3 预防性审查（第22轮新增）

**检测信号**：
- S 产出后未触发 R3 三阶段审查，直接进入 V 评审
- run-log 中 S→V 之间缺少 3 条 R3 记录（completeness/reliability/security）
- `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 文件缺失
- V 评审未读取 R3 报告（reworkHints 未纳入 R3 发现）

**回退动作**：回到 S 产出后起点，补跑 R3 三阶段审查，产出三份 PreventiveReview JSON，再进入 V 评审。

**门禁脚本**：`check-preventive-review.ts` 校验三份报告完整性；`check-run-log.ts` 校验 S→V 间 R3 记录数。
```

- [ ] **Step 2: 在L50反模式清单表中追加#33行**

在反模式清单表格中（#30行之后）追加：

```markdown
| #33 | 跳过 R3 预防性审查 | S 产出后未触发 R3 三阶段审查，直接进入 V 评审 | 回到 S 产出后起点，补跑 R3 |
```

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/anti-patterns.md
git commit -m "docs(ssot): anti-patterns 新增#33跳过R3预防性审查"
```

---

## Task 11: SSoT - tla-plus-guide.md 新增TLA+/BDD自动化同步校验节

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md:641` (文件末尾)

- [ ] **Step 1: 在L641文件末尾追加新章节**

```markdown

## 15. TLA+/BDD 自动化同步校验（第22轮 P3-10 修正）

> TLA+ 与 BDD 等价性维护成本高，手动比对易遗漏。新增 `check-tla-bdd-sync.ts` 脚本自动化 diff 比对。

### 校验内容

从 TLA+ 文件抽取：
- 转移名（`Next == \/ Act1 \/ Act2`）
- 状态名（`vars` 声明）
- 不变式名（`Inv == ...`）

从 BDD feature 文件 Background 节抽取状态机七要素，diff 比对两者差异。

### 脚本调用

```bash
npx tsx scripts/check-tla-bdd-sync.ts <tla-file> <feature-file>
```

退出码：0=一致 / 1=有差异 / 2=输入错误

### 与 check-bdd-model.ts 的关系

`check-bdd-model.ts` D4 等价性校验可调用本脚本（可选，不强制）。本脚本作为独立工具，便于开发阶段快速验证 TLA+/BDD 一致性。
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/tla-plus-guide.md
git commit -m "docs(ssot): tla-plus-guide 新增TLA+/BDD自动化同步校验节"
```

---

## Task 12: SSoT - bdd-guide.md 新增TLA+/BDD自动化同步校验节

**Files:**
- Modify: `w-model-dev/references/bdd-guide.md:549` (W模型交叉引用前)

- [ ] **Step 1: 在L549前插入新章节**

在 `## W 模型交叉引用` 之前（L549前）插入：

```markdown

## §9 TLA+/BDD 自动化同步校验（第22轮 P3-10 修正）

> BDD features 与 TLA+ 规格的等价性维护成本高，手动比对易遗漏。新增 `check-tla-bdd-sync.ts` 脚本自动化 diff 比对。

### 校验内容

| 维度 | TLA+ 来源 | BDD 来源 | 比对规则 |
|---|---|---|---|
| 转移名 | `Next == \/ Act1 \/ Act2` | Background 节 `When` 步骤 | 名称完全一致 |
| 状态名 | `vars` 声明 | Background 节 `Given` 步骤 | 名称完全一致 |
| 不变式名 | `Inv == ...` | Background 节 `Then` 步骤 | 名称完全一致 |

### 脚本调用

```bash
npx tsx scripts/check-tla-bdd-sync.ts <tla-file> <feature-file>
```

退出码：0=一致 / 1=有差异 / 2=输入错误

### 与 check-bdd-model.ts D4 的关系

`check-bdd-model.ts` D4 等价性校验在阶段门禁时执行；`check-tla-bdd-sync.ts` 作为独立开发工具，便于在编写 TLA+/BDD 时快速验证一致性。两者可互补使用。
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/references/bdd-guide.md
git commit -m "docs(ssot): bdd-guide 新增TLA+/BDD自动化同步校验节"
```

---

## Task 13: SSoT - examples/coding.md 新增跨平台.env示例

**Files:**
- Modify: `w-model-dev/examples/coding.md:43` (文件末尾)

- [ ] **Step 1: 在L43文件末尾追加跨平台示例**

```markdown

## 跨平台环境变量示例（第22轮 P3-9 修正）

### Windows PowerShell 适配

`cross-env` 在 PowerShell 下可能失效，推荐使用 `dotenv`：

```bash
# 安装 dotenv
npm install dotenv

# 创建 .env 文件
echo JWT_SECRET=test-secret-blog-demo > .env
echo PORT=3000 >> .env
```

```typescript
// src/app.ts 首行
import 'dotenv/config';

// process.env.JWT_SECRET 自动可用
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');
```

### 备选：PowerShell 临时设置

```powershell
$env:JWT_SECRET="test-secret-blog-demo"
npx vitest run
```
```

- [ ] **Step 2: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/examples/coding.md
git commit -m "docs(ssot): examples/coding 新增跨平台.env示例"
```

---

## Task 14: SSoT - SKILL.md + skill-metadata.json 新增约束#17+版本升级

**Files:**
- Modify: `w-model-dev/SKILL.md:53` (约束#16后)
- Modify: `w-model-dev/skill-metadata.json`

- [ ] **Step 1: 在SKILL.md L53约束#16后插入约束#17**

在约束#16（豁免审批强制四阶段）后插入：

```markdown
17. **R3 预防性审查强制**：所有阶段 S 产出后须触发三阶段 R 预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 三份报告。V 评审前 G 子代理须跑 [`check-preventive-review.ts`](scripts/check-preventive-review.ts) 校验报告完整性。跳过 R3 直接进入 V 评审命中反模式 #33。详见 [references/subagent-delegation.md](references/subagent-delegation.md)「R3 预防性审查分派模板」。
```

- [ ] **Step 2: 更新SKILL.md版本号**

将 `version: 21.0.0` 修改为 `version: 22.0.0`。

- [ ] **Step 3: 更新skill-metadata.json版本号**

读取 `skill-metadata.json`，将版本号同步更新为 `22.0.0`。

- [ ] **Step 4: 更新SKILL.md执行工作流步骤6**

在步骤6「分派 S 子代理产出」后、步骤7「分派 V 子代理评审」前，插入R3步骤：

```markdown
6.5. **分派 R3 预防性审查**（O → R3）：S 产出后、V 评审前，分派 R 子代理执行三阶段预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`。R3 三阶段可并行分派。G 子代理跑 `check-preventive-review.ts` 校验报告完整性。
```

- [ ] **Step 5: 验证版本号双写一致性**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx scripts/self-test.ts`
Expected: metadata 检查通过（版本号双写一致）

- [ ] **Step 6: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json
git commit -m "docs(ssot): SKILL.md 新增约束#17 R3强制+版本号升级至22.0.0"
```

---

## Task 15: schemas - 新增 preventive-review.schema.json

**Files:**
- Create: `w-model-dev/schemas/preventive-review.schema.json`

- [ ] **Step 1: 创建schema文件**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/preventive-review.schema.json",
  "title": "PreventiveReview",
  "type": "object",
  "additionalProperties": false,
  "required": ["reviewedAt", "reviewer", "phase", "dimension", "findings", "passed"],
  "properties": {
    "reviewedAt": { "type": "string", "format": "date-time" },
    "reviewer": { "type": "string", "minLength": 1 },
    "phase": { "type": "integer", "minimum": 1, "maximum": 8 },
    "dimension": { "enum": ["completeness", "reliability", "security"] },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["severity", "description", "evidence"],
        "properties": {
          "severity": { "enum": ["Critical", "Required", "Optional", "Nit", "FYI"] },
          "description": { "type": "string", "minLength": 1 },
          "evidence": { "type": "string", "minLength": 1 }
        }
      }
    },
    "passed": { "type": "boolean" }
  }
}
```

- [ ] **Step 2: 验证schema可加载**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx -e "import { validateBySchema } from './scripts/schema-loader.js'; const r = validateBySchema('preventive-review', {reviewedAt:'2026-07-30T10:00:00Z',reviewer:'R3-bot',phase:1,dimension:'completeness',findings:[],passed:true}); console.log(JSON.stringify(r));"`
Expected: `{"valid":true,"errorMessages":[]}`

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/schemas/preventive-review.schema.json
git commit -m "feat(schemas): 新增preventive-review.schema.json"
```

---

## Task 16: scripts - gate-logic.ts 新增codeModule格式校验+uat-path-mapping回填校验逻辑

**Files:**
- Modify: `w-model-dev/scripts/gate-logic.ts` (在checkArtifactGate函数前新增校验函数)

- [ ] **Step 1: 在gate-logic.ts中新增codeModule格式校验函数**

在 `checkSdToCodeModuleMapping` 函数后（约L153前）插入：

```typescript

// ==================== codeModule 格式校验（第22轮 P0-2） ====================
/**
 * codeModule 格式校验（按行类型分支）。
 * - REQ 行：^SD-[\d.]+:src/.+
 * - NFR/CON 行：^src/.+ 或 === "横切"
 */
export function checkCodeModuleFormat(rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  const reqPattern = /^SD-[\d.]+:src\/.+/;
  const nfrPattern = /^src\/.+/;

  for (const row of rows) {
    if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;

    const id = row.requirementId;
    const cm = row.codeModule.trim();

    if (id.startsWith('REQ-')) {
      if (!reqPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：REQ 行 ${id} 的 codeModule "${cm}" 须匹配 ^SD-[\\d.]+:src/.+（示例：SD-5.2.1:src/auth/login.ts）`,
        );
      }
    } else if (id.startsWith('NFR-') || id.startsWith('CON-')) {
      if (cm !== '横切' && !nfrPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：${id.startsWith('NFR-') ? 'NFR' : 'CON'} 行 ${id} 的 codeModule "${cm}" 须匹配 ^src/.+ 或 === "横切"`,
        );
      }
    }
  }
  return violations;
}

// ==================== uat-path-mapping 回填校验（第22轮 P0-1） ====================
export interface UatPathMappingRow {
  uatId: string;
  actualPath: string;
  mappingType: string;
}

/**
 * uat-path-mapping 回填校验。
 * - 每条 UAT-NNN 的 actualPath 非 "_待阶段5回填_"
 * - mappingType ∈ ["直接", "等价", "替代"]
 */
export function checkUatPathMappingBackfill(mappings: UatPathMappingRow[]): string[] {
  const violations: string[] = [];
  const validMappingTypes = ['直接', '等价', '替代'];

  for (const m of mappings) {
    if (!m || typeof m.uatId !== 'string') continue;
    if (m.actualPath.includes('_待阶段5回填_') || m.actualPath.trim() === '') {
      violations.push(`uat-path-mapping 未回填：${m.uatId} 的实际路径仍为 "_待阶段5回填_" 或为空`);
    }
    if (!validMappingTypes.includes(m.mappingType)) {
      violations.push(
        `uat-path-mapping mappingType 非法：${m.uatId} 的 mappingType "${m.mappingType}" 须 ∈ ["直接", "等价", "替代"]`,
      );
    }
  }
  return violations;
}
```

- [ ] **Step 2: 在checkArtifactGate函数中集成codeModule格式校验**

在 `checkArtifactGate` 函数中（约L288 TLA+资产校验后）添加：

```typescript

  // ==================== codeModule 格式校验（第22轮 P0-2，仅 phase >= 5） ====================
  if (phase >= 5) {
    const formatViolations = checkCodeModuleFormat(matrix.rows);
    for (const v of formatViolations) reasons.push(v);
  }
```

- [ ] **Step 3: 验证TypeScript编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/gate-logic.ts
git commit -m "feat(scripts): gate-logic 新增codeModule格式校验+uat-path-mapping回填校验"
```

---

## Task 17: scripts - check-artifact-gate.ts 新增phase=1/5校验

**Files:**
- Modify: `w-model-dev/scripts/check-artifact-gate.ts` (main函数中)

- [ ] **Step 1: 在main函数中新增phase=1的uat-path-mapping.md存在性校验**

在 `main()` 函数中读取RTM后（约L115前），添加phase=1校验：

```typescript
  // P0-1: phase=1 校验 docs/uat-path-mapping.md 存在性
  if (phase === 1) {
    const uatMappingPath = path.resolve(projectDir, 'docs', 'uat-path-mapping.md');
    try {
      await fs.access(uatMappingPath);
    } catch {
      result.reasons.push('P0-1 校验失败：docs/uat-path-mapping.md 不存在，阶段1须产出该文件（见 phase-1-requirements.md §输出）');
    }
  }
```

- [ ] **Step 2: 在main函数中新增phase=5的uat-path-mapping回填校验**

在phase=1校验后，添加phase=5校验：

```typescript
  // P0-1: phase=5 校验 uat-path-mapping 回填
  if (phase === 5) {
    const uatMappingPath = path.resolve(projectDir, 'docs', 'uat-path-mapping.md');
    try {
      const content = await fs.readFile(uatMappingPath, 'utf-8');
      const mappings = parseUatPathMappingFromContent(content);
      const backfillViolations = checkUatPathMappingBackfill(mappings);
      for (const v of backfillViolations) result.reasons.push(v);
    } catch {
      result.reasons.push('P0-1 校验失败：docs/uat-path-mapping.md 不存在或无法读取');
    }
  }
```

- [ ] **Step 3: 新增parseUatPathMappingFromContent辅助函数**

在文件顶部import区后添加：

```typescript
import { checkUatPathMappingBackfill, type UatPathMappingRow } from './gate-logic.js';

/**
 * 从 uat-path-mapping.md 内容解析映射行。
 * 格式：| UAT-001 | POST /api/posts | POST /api/posts | 直接 | ... |
 */
function parseUatPathMappingFromContent(content: string): UatPathMappingRow[] {
  const rows: UatPathMappingRow[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\|\s*(UAT-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      rows.push({
        uatId: match[1].trim(),
        actualPath: match[3].trim(),
        mappingType: match[4].trim(),
      });
    }
  }
  return rows;
}
```

- [ ] **Step 4: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/check-artifact-gate.ts
git commit -m "feat(scripts): check-artifact-gate 新增phase=1/5 uat-path-mapping校验"
```

---

## Task 18: scripts - check-bdd-model.ts 多路径查找

**Files:**
- Modify: `w-model-dev/scripts/check-bdd-model.ts:193-196` (路径解析逻辑)

- [ ] **Step 1: 新增resolveFeatureFile多路径查找函数**

在文件中（约L84前）新增辅助函数：

```typescript
import { existsSync } from 'node:fs';

/**
 * 多路径查找 feature 文件（第22轮 P2-6 修正）。
 * 依次尝试：basePath + filePath → .w-model/ + filePath → .w-model/bdd/ + filePath → projectDir + filePath
 * 返回第一个存在的路径，都不存在返回 null
 */
function resolveFeatureFile(basePath: string, filePath: string, projectDir: string): string | null {
  const candidates = [
    path.resolve(basePath, filePath),
    path.resolve(projectDir, '.w-model', filePath),
    path.resolve(projectDir, '.w-model', 'bdd', filePath),
    path.resolve(projectDir, filePath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
```

- [ ] **Step 2: 修改L193-196路径解析逻辑**

将：
```typescript
const manifestDir = path.resolve(path.dirname(args.manifestFile));
const projectDir = path.resolve(manifestDir, '..');
const basePath = path.resolve(projectDir, manifest.basePath);
```

修改为：
```typescript
const manifestDir = path.resolve(path.dirname(args.manifestFile));
const projectDir = path.resolve(manifestDir, '..');
const basePath = manifest.basePath
  ? path.resolve(projectDir, manifest.basePath)
  : manifestDir; // basePath 缺失时回退到 manifest 所在目录
```

- [ ] **Step 3: 修改features文件解析循环**

将L200-213的features文件解析循环修改为支持多路径回退：

```typescript
for (const f of manifest.features) {
  const resolved = resolveFeatureFile(basePath, f.filePath, projectDir);
  if (!resolved) {
    violations.push(`D2: feature 文件不存在：${f.filePath}（已尝试 basePath / .w-model/ / .w-model/bdd/ / projectDir）`);
    continue;
  }
  const feature = await parseFeatureFile(resolved);
  features.push({ ...f, parsed: feature });
}
```

- [ ] **Step 4: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/check-bdd-model.ts
git commit -m "fix(scripts): check-bdd-model 多路径查找支持根目录/子目录回退"
```

---

## Task 19: scripts - check-design-contract-consistency.ts 缺失提示

**Files:**
- Modify: `w-model-dev/scripts/check-design-contract-consistency.ts:205-211` (存在性校验)

- [ ] **Step 1: 修改L205-211的ENOENT错误处理**

将现有的ENOENT处理修改为更友好的提示：

```typescript
  // P2-8: uat-path-mapping.md 缺失时输出明确提示
  try {
    await fs.access(mappingPath);
  } catch {
    console.error('✗ uat-path-mapping.md 不存在，请在阶段1产出该文件（见 phase-1-requirements.md §输出）');
    console.error(`  期望路径：${mappingPath}`);
    const result: DesignContractCheckResult = {
      passed: false,
      violations: [{
        dimension: 'D1',
        severity: 'Critical',
        description: 'uat-path-mapping.md 不存在',
        evidence: `期望路径：${mappingPath}`,
      }],
    };
    console.log(JSON.stringify({ ...CONTRACT_JSON, exitCode: 2, passed: false, violations: result.violations }, null, 2));
    process.exit(2);
  }
```

- [ ] **Step 2: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/check-design-contract-consistency.ts
git commit -m "fix(scripts): check-design-contract uat-path-mapping缺失明确提示"
```

---

## Task 20: scripts - check-run-log.ts 新增R3记录校验

**Files:**
- Modify: `w-model-dev/scripts/run-log-logic.ts` (纯逻辑层新增R3校验)
- Modify: `w-model-dev/scripts/check-run-log.ts` (main调用)

- [ ] **Step 1: 在run-log-logic.ts中新增R3记录校验函数**

在 `checkRunLog` 函数中新增R3校验逻辑：

```typescript
  // ==================== R3 预防性审查记录校验（第22轮新增） ====================
  // 校验：每个阶段的 S→V 之间须有 3 条 R3 记录（completeness/reliability/security）
  const r3Dimensions = ['completeness', 'reliability', 'security'];
  const phaseEntries = new Map<number, Array<{ role: string; action: string }>>();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number') continue;
    if (!phaseEntries.has(entry.phase)) phaseEntries.set(entry.phase, []);
    phaseEntries.get(entry.phase)!.push({ role: entry.role, action: entry.action });
  }

  for (const [phase, entryList] of phaseEntries) {
    // 查找 S 产出和 V 评审的位置
    let sIndex = -1, vIndex = -1;
    for (let i = 0; i < entryList.length; i++) {
      if (entryList[i].role === 'S' && entryList[i].action === 'produce') sIndex = i;
      if (entryList[i].role === 'V' && entryList[i].action === 'review' && sIndex >= 0 && vIndex === -1) vIndex = i;
    }
    if (sIndex >= 0 && vIndex > sIndex) {
      // 检查 S→V 之间是否有 3 条 R3 记录
      const r3Records = entryList.slice(sIndex + 1, vIndex).filter(
        e => e.role === 'R' && r3Dimensions.some(d => e.action.includes(d)),
      );
      if (r3Records.length < 3) {
        reasons.push(
          `R3 记录校验失败：阶段 ${phase} 的 S→V 之间仅有 ${r3Records.length} 条 R3 记录，须有 3 条（completeness/reliability/security）`,
        );
      }
    }
  }
```

- [ ] **Step 2: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/run-log-logic.ts
git commit -m "feat(scripts): run-log-logic 新增R3记录校验"
```

---

## Task 21: scripts - 新增 check-preventive-review.ts

**Files:**
- Create: `w-model-dev/scripts/preventive-review-logic.ts` (纯逻辑层)
- Create: `w-model-dev/scripts/check-preventive-review.ts` (CLI入口)

- [ ] **Step 1: 创建preventive-review-logic.ts纯逻辑层**

```typescript
import { validateBySchema } from './schema-loader.js';

export interface PreventiveReviewFinding {
  severity: 'Critical' | 'Required' | 'Optional' | 'Nit' | 'FYI';
  description: string;
  evidence: string;
}

export interface PreventiveReview {
  reviewedAt: string;
  reviewer: string;
  phase: number;
  dimension: 'completeness' | 'reliability' | 'security';
  findings: PreventiveReviewFinding[];
  passed: boolean;
}

export interface PreventiveReviewCheckResult {
  passed: boolean;
  reasons: string[];
  reviews: { dimension: string; passed: boolean; findingCount: number }[];
}

const REQUIRED_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/**
 * 校验 R3 三份报告完整性（第22轮新增）。
 * - 三份报告须全部存在
 * - 每份报告通过 schema 校验
 * - 每份报告 passed=true（或 passed=false 但 V 已纳入 reworkHints，此处只校验报告存在性和格式）
 */
export function checkPreventiveReview(
  reviews: Record<string, PreventiveReview | null>,
  expectedPhase: number,
): PreventiveReviewCheckResult {
  const reasons: string[] = [];
  const reviewSummaries: { dimension: string; passed: boolean; findingCount: number }[] = [];

  for (const dim of REQUIRED_DIMENSIONS) {
    const review = reviews[dim];
    if (!review) {
      reasons.push(`R3 报告缺失：${dim} 维度报告未找到`);
      reviewSummaries.push({ dimension: dim, passed: false, findingCount: 0 });
      continue;
    }

    // schema 校验
    const schemaResult = validateBySchema('preventive-review', review);
    if (!schemaResult.valid) {
      for (const msg of schemaResult.errorMessages) {
        reasons.push(`[schema] ${dim}: ${msg}`);
      }
      reviewSummaries.push({ dimension: dim, passed: false, findingCount: 0 });
      continue;
    }

    // phase 一致性
    if (review.phase !== expectedPhase) {
      reasons.push(`R3 报告 phase 不一致：${dim} 维度 phase=${review.phase}，期望=${expectedPhase}`);
    }

    // dimension 一致性
    if (review.dimension !== dim) {
      reasons.push(`R3 报告 dimension 不匹配：文件名维度=${dim}，报告维度=${review.dimension}`);
    }

    reviewSummaries.push({
      dimension: dim,
      passed: review.passed,
      findingCount: review.findings.length,
    });
  }

  return {
    passed: reasons.length === 0,
    reasons,
    reviews: reviewSummaries,
  };
}
```

- [ ] **Step 2: 创建check-preventive-review.ts CLI入口**

```typescript
#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { checkPreventiveReview, type PreventiveReview } from './preventive-review-logic.js';

const PREVENTIVE_REVIEW_JSON = {
  script: 'check-preventive-review.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reviews: [] as { dimension: string; passed: boolean; findingCount: number }[],
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectDir = args.find(a => !a.startsWith('--')) ?? '.';
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const phase = phaseArg ? parseInt(phaseArg.split('=')[1], 10) : undefined;

  if (!phase || phase < 1 || phase > 8) {
    console.error('用法: check-preventive-review.ts <project-dir> --phase=<1-8>');
    process.exit(2);
  }

  const reviewsDir = path.resolve(projectDir, '.w-model', 'preventive-reviews');
  const dimensions = ['completeness', 'reliability', 'security'] as const;
  const reviews: Record<string, PreventiveReview | null> = {};

  for (const dim of dimensions) {
    const filePath = path.resolve(reviewsDir, `${phase}-${dim}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      reviews[dim] = JSON.parse(content) as PreventiveReview;
    } catch {
      reviews[dim] = null;
    }
  }

  const result = checkPreventiveReview(reviews, phase);
  const output = {
    ...PREVENTIVE_REVIEW_JSON,
    exitCode: result.passed ? 0 : 1,
    passed: result.passed,
    reasons: result.reasons,
    reviews: result.reviews,
  };

  console.log(JSON.stringify(output, null, 2));

  // 写入 gate-logs
  const gateLogsDir = path.resolve(projectDir, '.w-model', 'gate-logs');
  try {
    await fs.mkdir(gateLogsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(
      path.resolve(gateLogsDir, `${timestamp}-preventive-review.json`),
      JSON.stringify(output, null, 2),
    );
  } catch {
    // gate-logs 写入失败不阻塞
  }

  process.exit(output.exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
```

- [ ] **Step 3: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/preventive-review-logic.ts w-model-dev/scripts/check-preventive-review.ts
git commit -m "feat(scripts): 新增check-preventive-review.ts校验R3三份报告完整性"
```

---

## Task 22: scripts - 新增 check-tla-bdd-sync.ts

**Files:**
- Create: `w-model-dev/scripts/tla-bdd-sync-logic.ts` (纯逻辑层)
- Create: `w-model-dev/scripts/check-tla-bdd-sync.ts` (CLI入口)

- [ ] **Step 1: 创建tla-bdd-sync-logic.ts纯逻辑层**

```typescript
export interface TlaBddSyncViolation {
  dimension: 'transition' | 'state' | 'invariant';
  tlaName: string;
  bddName: string | null;
  description: string;
}

export interface TlaBddSyncResult {
  passed: boolean;
  violations: TlaBddSyncViolation[];
  tlaTransitions: string[];
  bddTransitions: string[];
  tlaStates: string[];
  bddStates: string[];
  tlaInvariants: string[];
  bddInvariants: string[];
}

/**
 * 从 TLA+ 内容抽取转移名。
 * 匹配 Next == \/ Act1 \/ Act2 格式。
 */
export function extractTlaTransitions(tlaContent: string): string[] {
  const transitions: string[] = [];
  const nextMatch = tlaContent.match(/Next\s*==\s*\\/\s*([\s\S]+?)(?:\n\n|\n\(\*|$)/);
  if (nextMatch) {
    const nextBody = nextMatch[1];
    const matches = nextBody.matchAll(/\\/\s*([A-Za-z_][A-Za-z0-9_]*)/g);
    for (const m of matches) {
      transitions.push(m[1]);
    }
  }
  return transitions;
}

/**
 * 从 TLA+ 内容抽取状态变量名。
 * 匹配 vars == var1 == ... \* var2 == ... 格式。
 */
export function extractTlaStates(tlaContent: string): string[] {
  const states: string[] = [];
  const varsMatch = tlaContent.match(/VARIABLES?\s+([\s\S]+?)(?:\n\n|\n\(\*|$)/);
  if (varsMatch) {
    const varsBody = varsMatch[1];
    const matches = varsBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g);
    for (const m of matches) {
      const name = m[1];
      if (!['VARIABLES', 'CONSTANTS', 'EXTENDS', 'MODULE'].includes(name)) {
        states.push(name);
      }
    }
  }
  return states;
}

/**
 * 从 TLA+ 内容抽取不变式名。
 * 匹配 InvName == ... 格式。
 */
export function extractTlaInvariants(tlaContent: string): string[] {
  const invariants: string[] = [];
  const matches = tlaContent.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*==\s*.*?(?:\n(?!\s)|$)/gm);
  for (const m of matches) {
    const name = m[1];
    // 排除已知非不变式名称
    if (!['Next', 'Init', 'vars', 'VARIABLES', 'CONSTANTS', 'EXTENDS', 'MODULE'].includes(name)) {
      // 简单启发：不变式通常包含 Inv 或 Type 前缀
      if (name.includes('Inv') || name.includes('Type') || name.includes('Invariant')) {
        invariants.push(name);
      }
    }
  }
  return invariants;
}

/**
 * 从 BDD feature 内容抽取 Background 节的状态机七要素。
 */
export function extractBddStateMachine(featureContent: string): {
  states: string[];
  transitions: string[];
  invariants: string[];
} {
  const states: string[] = [];
  const transitions: string[] = [];
  const invariants: string[] = [];

  const bgMatch = featureContent.match(/Background:\s*([\s\S]+?)(?:\nScenario|\n@|$)/);
  const bgContent = bgMatch ? bgMatch[1] : featureContent;

  // Given → 状态
  const givenMatches = bgContent.matchAll(/Given\s+(.+)/g);
  for (const m of givenMatches) {
    const parts = m[1].trim().split(/\s+/);
    if (parts.length >= 2) states.push(parts[parts.length - 1]);
  }

  // When → 转移
  const whenMatches = bgContent.matchAll(/When\s+(.+)/g);
  for (const m of whenMatches) {
    const parts = m[1].trim().split(/\s+/);
    if (parts.length >= 1) transitions.push(parts[0]);
  }

  // Then → 不变式
  const thenMatches = bgContent.matchAll(/Then\s+(.+)/g);
  for (const m of thenMatches) {
    const parts = m[1].trim().split(/\s+/);
    if (parts.length >= 1) invariants.push(parts[0]);
  }

  return { states: [...new Set(states)], transitions: [...new Set(transitions)], invariants: [...new Set(invariants)] };
}

/**
 * diff 比对 TLA+ 与 BDD 的转移/状态/不变式。
 */
export function checkTlaBddSync(tlaContent: string, featureContent: string): TlaBddSyncResult {
  const tlaTransitions = extractTlaTransitions(tlaContent);
  const tlaStates = extractTlaStates(tlaContent);
  const tlaInvariants = extractTlaInvariants(tlaContent);

  const bdd = extractBddStateMachine(featureContent);

  const violations: TlaBddSyncViolation[] = [];

  // 转移比对
  for (const t of tlaTransitions) {
    if (!bdd.transitions.includes(t)) {
      violations.push({
        dimension: 'transition',
        tlaName: t,
        bddName: null,
        description: `TLA+ 转移 "${t}" 在 BDD 中未找到对应 When 步骤`,
      });
    }
  }
  for (const b of bdd.transitions) {
    if (!tlaTransitions.includes(b)) {
      violations.push({
        dimension: 'transition',
        tlaName: b,
        bddName: b,
        description: `BDD 转移 "${b}" 在 TLA+ Next 中未找到`,
      });
    }
  }

  // 状态比对（BDD 状态名可能映射到 TLA+ 变量）
  // 状态比对较宽松，只记录 TLA+ 有但 BDD 无的状态
  for (const s of tlaStates) {
    if (!bdd.states.some(bs => bs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(bs.toLowerCase()))) {
      violations.push({
        dimension: 'state',
        tlaName: s,
        bddName: null,
        description: `TLA+ 状态变量 "${s}" 在 BDD Given 中未找到对应`,
      });
    }
  }

  // 不变式比对
  for (const inv of tlaInvariants) {
    if (!bdd.invariants.some(bi => bi.toLowerCase().includes(inv.toLowerCase()) || inv.toLowerCase().includes(bi.toLowerCase()))) {
      violations.push({
        dimension: 'invariant',
        tlaName: inv,
        bddName: null,
        description: `TLA+ 不变式 "${inv}" 在 BDD Then 中未找到对应`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    tlaTransitions,
    bddTransitions: bdd.transitions,
    tlaStates,
    bddStates: bdd.states,
    tlaInvariants,
    bddInvariants: bdd.invariants,
  };
}
```

- [ ] **Step 2: 创建check-tla-bdd-sync.ts CLI入口**

```typescript
#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import { checkTlaBddSync } from './tla-bdd-sync-logic.js';

const SYNC_JSON = {
  script: 'check-tla-bdd-sync.ts',
  exitCode: 0,
  passed: false,
  violations: [] as unknown[],
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('用法: check-tla-bdd-sync.ts <tla-file> <feature-file>');
    process.exit(2);
  }

  const [tlaFile, featureFile] = args;

  try {
    const tlaContent = await fs.readFile(tlaFile, 'utf-8');
    const featureContent = await fs.readFile(featureFile, 'utf-8');
    const result = checkTlaBddSync(tlaContent, featureContent);

    const output = {
      ...SYNC_JSON,
      exitCode: result.passed ? 0 : 1,
      passed: result.passed,
      violations: result.violations,
      summary: {
        tlaTransitions: result.tlaTransitions,
        bddTransitions: result.bddTransitions,
        tlaStates: result.tlaStates,
        bddStates: result.bddStates,
        tlaInvariants: result.tlaInvariants,
        bddInvariants: result.bddInvariants,
      },
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(output.exitCode);
  } catch (err) {
    console.error('输入错误：', err);
    process.exit(2);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
```

- [ ] **Step 3: 验证编译**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/tla-bdd-sync-logic.ts w-model-dev/scripts/check-tla-bdd-sync.ts
git commit -m "feat(scripts): 新增check-tla-bdd-sync.ts TLA+/BDD自动化同步校验"
```

---

## Task 23-30: samples - 新增8项样本文件

**Files:**
- Create: `w-model-dev/scripts/samples/gate/bad-phase5-missing-uat-path-mapping.json`
- Create: `w-model-dev/scripts/samples/gate/valid-phase5-with-uat-path-mapping.json`
- Create: `w-model-dev/scripts/samples/gate/bad-phase5-codemodule-format.json`
- Create: `w-model-dev/scripts/samples/bdd/valid-manifest-root.json`
- Create: `w-model-dev/scripts/samples/preventive-review/valid-completeness.json`
- Create: `w-model-dev/scripts/samples/preventive-review/bad-missing-evidence.json`
- Create: `w-model-dev/scripts/samples/tla-bdd-sync/valid.json`
- Create: `w-model-dev/scripts/samples/tla-bdd-sync/bad-transition-mismatch.json`

- [ ] **Step 1: 创建gate样本目录并新增3个样本**

`bad-phase5-missing-uat-path-mapping.json`（P0-1缺失文件场景，RTM合规但uat-path-mapping.md不存在）:

```json
{
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "用户登录",
      "designDoc": "SD-1",
      "codeModule": "SD-1.1:src/auth/login.ts",
      "unitTest": "UT-001",
      "integrationTest": "IT-001",
      "systemTest": "ST-001",
      "acceptanceTest": "UAT-001"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 10, "passed": 10, "failed": 0, "pending": 0, "coverage": 90 },
    "integrationTest": { "total": 5, "passed": 5, "failed": 0, "pending": 0, "coverage": 100 },
    "systemTest": { "total": 3, "passed": 3, "failed": 0, "pending": 0, "coverage": 100 },
    "acceptanceTest": { "total": 2, "passed": 2, "failed": 0, "pending": 0, "coverage": 100 }
  }
}
```

`valid-phase5-with-uat-path-mapping.json`（P0-1合规场景）:

```json
{
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "用户登录",
      "designDoc": "SD-1",
      "codeModule": "SD-1.1:src/auth/login.ts",
      "unitTest": "UT-001",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": "UAT-001"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 10, "passed": 10, "failed": 0, "pending": 0, "coverage": 90 },
    "integrationTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "systemTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "acceptanceTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 }
  }
}
```

`bad-phase5-codemodule-format.json`（P0-2格式错误，3个bad行）:

```json
{
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "用户登录",
      "designDoc": "SD-1",
      "codeModule": "src/auth/login.ts",
      "unitTest": "UT-001",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": "UAT-001"
    },
    {
      "requirementId": "NFR-001",
      "description": "限流",
      "designDoc": "SD-2",
      "codeModule": "SD-2.1:src/middleware/rateLimit.ts",
      "unitTest": "",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": ""
    },
    {
      "requirementId": "CON-001",
      "description": "日志",
      "designDoc": "SD-3",
      "codeModule": "",
      "unitTest": "",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": ""
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 10, "passed": 10, "failed": 0, "pending": 0, "coverage": 90 },
    "integrationTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "systemTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "acceptanceTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 }
  }
}
```

- [ ] **Step 2: 创建bdd样本 valid-manifest-root.json**

```json
{
  "schemaVersion": "1.0",
  "currentPhase": 2,
  "basePath": "",
  "features": [
    { "filePath": "valid-l2.feature", "level": "L2", "requirementIds": ["REQ-001"] }
  ]
}
```

- [ ] **Step 3: 创建preventive-review样本目录并新增2个样本**

`valid-completeness.json`:

```json
{
  "reviewedAt": "2026-07-30T10:00:00Z",
  "reviewer": "R3-completeness-bot",
  "phase": 1,
  "dimension": "completeness",
  "findings": [
    {
      "severity": "FYI",
      "description": "Out of Scope 声明完整",
      "evidence": "requirement-spec.md §Out of Scope L45-50"
    }
  ],
  "passed": true
}
```

`bad-missing-evidence.json`:

```json
{
  "reviewedAt": "2026-07-30T10:00:00Z",
  "reviewer": "R3-reliability-bot",
  "phase": 2,
  "dimension": "reliability",
  "findings": [
    {
      "severity": "Critical",
      "description": "TLA+ 转移缺失",
      "evidence": ""
    }
  ],
  "passed": false
}
```

- [ ] **Step 4: 创建tla-bdd-sync样本目录并新增2个样本**

`valid.json`（TLA+/BDD一致）:

```json
{
  "tlaContent": "EXTENDS Naturals\nVARIABLES state\nInit == state = \"idle\"\nNext == \\ Login \\ Logout\nLogin == state = \"idle\" /\\ state' = \"active\"\nLogout == state = \"active\" /\\ state' = \"idle\"\nTypeInvariant == state \\in {\"idle\", \"active\"}",
  "featureContent": "Feature: Test\nBackground:\n  Given state idle\n  When Login\n  Then TypeInvariant"
}
```

`bad-transition-mismatch.json`（TLA+有Register但BDD无）:

```json
{
  "tlaContent": "EXTENDS Naturals\nVARIABLES state\nInit == state = \"idle\"\nNext == \\ Login \\ Logout \\ Register\nLogin == state = \"idle\" /\\ state' = \"active\"\nLogout == state = \"active\" /\\ state' = \"idle\"\nRegister == state = \"idle\" /\\ state' = \"registered\"\nTypeInvariant == state \\in {\"idle\", \"active\", \"registered\"}",
  "featureContent": "Feature: Test\nBackground:\n  Given state idle\n  When Login\n  Then TypeInvariant"
}
```

- [ ] **Step 5: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/samples/gate/bad-phase5-missing-uat-path-mapping.json w-model-dev/scripts/samples/gate/valid-phase5-with-uat-path-mapping.json w-model-dev/scripts/samples/gate/bad-phase5-codemodule-format.json w-model-dev/scripts/samples/bdd/valid-manifest-root.json w-model-dev/scripts/samples/preventive-review/ w-model-dev/scripts/samples/tla-bdd-sync/
git commit -m "feat(samples): 新增8项P0-P3修正样本"
```

---

## Task 31: 测试 - 新增 preventive-review-logic.test.ts

**Files:**
- Create: `w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`

> 注：preventive-review-logic.ts 已在 Task 21 创建，此为对应单元测试。

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest';
import { checkPreventiveReview, type PreventiveReview } from '../preventive-review-logic.js';

describe('checkPreventiveReview', () => {
  it('三份报告齐全且合规 → passed=true', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('缺失 completeness 报告 → passed=false', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: null,
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('R3 报告缺失：completeness 维度报告未找到');
  });

  it('phase 不一致 → passed=false', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 2, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('phase 不一致'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx vitest run scripts/__tests__/preventive-review-logic.test.ts`
Expected: 3 tests passed

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/__tests__/preventive-review-logic.test.ts
git commit -m "test: 新增preventive-review-logic单元测试"
```

---

## Task 32: 测试 - 新增 tla-bdd-sync-logic.test.ts

**Files:**
- Create: `w-model-dev/scripts/__tests__/tla-bdd-sync-logic.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest';
import { checkTlaBddSync, extractTlaTransitions, extractBddStateMachine } from '../tla-bdd-sync-logic.js';

describe('checkTlaBddSync', () => {
  const validTla = `EXTENDS Naturals
VARIABLES state
Init == state = "idle"
Next == \\/ Login \\/ Logout
Login == state = "idle" /\\ state' = "active"
Logout == state = "active" /\\ state' = "idle"
TypeInvariant == state \\in {"idle", "active"}`;

  const validFeature = `Feature: Test
Background:
  Given state idle
  When Login
  Then TypeInvariant`;

  it('TLA+/BDD 一致 → passed=true', () => {
    const result = checkTlaBddSync(validTla, validFeature);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('TLA+ 有 Register 但 BDD 无 → violations 非空', () => {
    const tlaWithRegister = validTla.replace(
      'Next == \\/ Login \\/ Logout',
      'Next == \\/ Login \\/ Logout \\/ Register',
    ).replace(
      'TypeInvariant == state \\in {"idle", "active"}',
      'Register == state = "idle" /\\ state\' = "registered"\nTypeInvariant == state \\in {"idle", "active", "registered"}',
    );
    const result = checkTlaBddSync(tlaWithRegister, validFeature);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.dimension === 'transition' && v.tlaName === 'Register')).toBe(true);
  });

  it('extractTlaTransitions 正确解析转移名', () => {
    const transitions = extractTlaTransitions(validTla);
    expect(transitions).toContain('Login');
    expect(transitions).toContain('Logout');
  });

  it('extractBddStateMachine 正确解析状态机七要素', () => {
    const sm = extractBddStateMachine(validFeature);
    expect(sm.transitions).toContain('Login');
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx vitest run scripts/__tests__/tla-bdd-sync-logic.test.ts`
Expected: 4 tests passed

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/__tests__/tla-bdd-sync-logic.test.ts
git commit -m "test: 新增tla-bdd-sync-logic单元测试"
```

---

## Task 33: 测试 - 更新 gate-enhancement.test.ts 覆盖新校验

**Files:**
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **Step 1: 在gate-enhancement.test.ts中新增codeModule格式校验测试**

在文件末尾（最后一个 `});` 前）新增：

```typescript
  describe('P0-2 codeModule 格式校验（第22轮）', () => {
    it('REQ 行 codeModule 缺 SD 前缀 → 失败', () => {
      const matrix: RTMMatrixShape = {
        rows: [{
          requirementId: 'REQ-001',
          description: '登录',
          designDoc: 'SD-1',
          codeModule: 'src/auth/login.ts',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
        }],
        executionSummary: {
          unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
          integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        },
      };
      const result = checkArtifactGate(matrix, { phaseOption: 5 });
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(true);
    });

    it('NFR 行 codeModule 带非法 SD 前缀 → 失败', () => {
      const matrix: RTMMatrixShape = {
        rows: [{
          requirementId: 'NFR-001',
          description: '限流',
          designDoc: 'SD-2',
          codeModule: 'SD-2.1:src/middleware/rateLimit.ts',
          unitTest: '',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: '',
        }],
        executionSummary: {
          unitTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        },
      };
      const result = checkArtifactGate(matrix, { phaseOption: 5 });
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(true);
    });

    it('REQ 行 codeModule 格式正确 → 通过', () => {
      const matrix: RTMMatrixShape = {
        rows: [{
          requirementId: 'REQ-001',
          description: '登录',
          designDoc: 'SD-1',
          codeModule: 'SD-1.1:src/auth/login.ts',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
        }],
        executionSummary: {
          unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
          integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
          acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        },
      };
      const result = checkArtifactGate(matrix, { phaseOption: 5 });
      expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(false);
    });
  });
```

- [ ] **Step 2: 运行测试**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx vitest run scripts/__tests__/gate-enhancement.test.ts`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "test: gate-enhancement 覆盖codeModule格式校验"
```

---

## Task 34: 测试 - 更新 self-test.ts 注册新校验器

**Files:**
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 新增 PreventiveReviewCase 接口和用例数组**

在 self-test.ts 中（约L835 RootCauseCase后）新增：

```typescript
// ==================== Preventive Review Cases（第22轮新增） ====================
interface PreventiveReviewCase {
  name: string;
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns: string[];
  description: string;
}

const PREVENTIVE_REVIEW_CASES: PreventiveReviewCase[] = [
  {
    name: 'valid-completeness',
    file: 'preventive-review/valid-completeness.json',
    expectedPassed: true,
    expectedReasonPatterns: [],
    description: 'R3 完整性报告合规',
  },
  {
    name: 'bad-missing-evidence',
    file: 'preventive-review/bad-missing-evidence.json',
    expectedPassed: false,
    expectedReasonPatterns: ['evidence'],
    description: 'R3 报告缺失 evidence 字段',
  },
];
```

- [ ] **Step 2: 新增 runPreventiveReviewCases 函数**

在 `runRootCauseCases` 函数后（约L1653后）新增：

```typescript
async function runPreventiveReviewCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of PREVENTIVE_REVIEW_CASES) {
    try {
      const filePath = path.resolve(samplesDir, c.file);
      const raw = await fs.readFile(filePath, 'utf-8');
      const review = JSON.parse(raw) as PreventiveReview;
      const reviews: Record<string, PreventiveReview | null> = { [review.dimension]: review };
      // 补齐其他维度为 null 以测试缺失场景
      for (const dim of ['completeness', 'reliability', 'security']) {
        if (!reviews[dim]) reviews[dim] = null;
      }
      const result = checkPreventiveReview(reviews, review.phase);
      const passed = result.passed === c.expectedPassed;
      const unmatched = matchReasonPatterns(result.reasons, c.expectedReasonPatterns);
      results.push({
        name: c.name,
        passed: passed && unmatched.length === 0,
        description: c.description,
        details: unmatched.length > 0 ? `未匹配: ${unmatched.join(', ')}` : undefined,
      });
    } catch (err) {
      results.push({ name: c.name, passed: false, description: c.description, details: String(err) });
    }
  }
  return results;
}
```

- [ ] **Step 3: 在main()的Promise.all中注册新校验器**

在 `main()` 函数的 `Promise.all([...])` 数组中（约L2036-2061）追加：

```typescript
    runPreventiveReviewCases(samplesDir),
```

- [ ] **Step 4: 新增 TlaBddSyncCase 并注册**

类似地，新增 TLA+/BDD 同步校验用例：

```typescript
interface TlaBddSyncCase {
  name: string;
  file: string;
  expectedPassed: boolean;
  description: string;
}

const TLA_BDD_SYNC_CASES: TlaBddSyncCase[] = [
  { name: 'valid', file: 'tla-bdd-sync/valid.json', expectedPassed: true, description: 'TLA+/BDD 一致' },
  { name: 'bad-transition-mismatch', file: 'tla-bdd-sync/bad-transition-mismatch.json', expectedPassed: false, description: 'TLA+/BDD 转移不一致' },
];

async function runTlaBddSyncCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of TLA_BDD_SYNC_CASES) {
    try {
      const filePath = path.resolve(samplesDir, c.file);
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as { tlaContent: string; featureContent: string };
      const result = checkTlaBddSync(data.tlaContent, data.featureContent);
      results.push({
        name: c.name,
        passed: result.passed === c.expectedPassed,
        description: c.description,
      });
    } catch (err) {
      results.push({ name: c.name, passed: false, description: c.description, details: String(err) });
    }
  }
  return results;
}
```

在 `Promise.all` 中追加 `runTlaBddSyncCases(samplesDir),`。

- [ ] **Step 5: 运行self-test**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx scripts/self-test.ts`
Expected: 所有用例通过，包括新增的 preventive-review 和 tla-bdd-sync 用例

- [ ] **Step 6: Commit**

```bash
cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack
git add w-model-dev/scripts/self-test.ts
git commit -m "test: self-test 注册preventive-review和tla-bdd-sync校验器"
```

---

## Task 35: 自测 - 运行全套测试+TypeScript编译

**Files:**
- 无文件修改，仅验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 运行全套单元测试**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 3: 运行 self-test**

Run: `cd d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev && npx tsx scripts/self-test.ts`
Expected: 所有用例通过

- [ ] **Step 4: 验证版本号双写一致性**

确认 SKILL.md 和 skill-metadata.json 的版本号均为 `22.0.0`。

---

## Self-Review

### 1. Spec 覆盖检查

| Spec 章节 | 对应 Task | 状态 |
|---|---|---|
| §2 S→R3→V→G 流程 | Task 1 (workflow.md), Task 2 (subagent-delegation.md), Task 14 (SKILL.md) | ✅ |
| §3.1 P0-1 uat-path-mapping | Task 3 (phase-1), Task 7 (phase-8), Task 16 (gate-logic), Task 17 (check-artifact-gate), Task 23-24 (samples) | ✅ |
| §3.2 P0-2 codeModule格式 | Task 6 (phase-5), Task 8 (rtm-guide), Task 16 (gate-logic), Task 25 (samples) | ✅ |
| §4.1 P1-3 demo范围 | Task 3 (phase-1), Task 7 (phase-8) | ✅ |
| §4.2 P1-4 字段命名 | Task 4 (phase-3), Task 5 (phase-4) | ✅ |
| §4.3 P1-5 限流装配 | Task 5 (phase-4) | ✅ |
| §5.1 P2-6 bdd路径 | Task 18 (check-bdd-model), Task 26 (samples) | ✅ |
| §5.2 P2-7 verifier schema | Task 9 (verifier-spec) | ✅ |
| §5.3 P2-8 design-contract提示 | Task 19 (check-design-contract) | ✅ |
| §6.1 P3-9 cross-env | Task 6 (phase-5), Task 13 (examples/coding) | ✅ |
| §6.2 P3-10 TLA+/BDD同步 | Task 11 (tla-plus-guide), Task 12 (bdd-guide), Task 22 (check-tla-bdd-sync), Task 29-30 (samples) | ✅ |
| §7.1 新增反模式#33 | Task 10 (anti-patterns) | ✅ |
| §7.2 check-preventive-review | Task 21 (新脚本), Task 27-28 (samples) | ✅ |
| §7.3 preventive-review.schema | Task 15 (schema) | ✅ |
| §7.4 check-run-log R3校验 | Task 20 (run-log-logic) | ✅ |

### 2. 占位符扫描

- Task 18 Step 1 的 `resolveFeatureFile` 函数原有空的 try-catch 块 → **已修正**：改为使用 `existsSync()` 实际检查文件存在性并返回第一个存在的路径。

### 3. 类型一致性

- `UatPathMappingRow` 在 Task 16 (gate-logic.ts) 和 Task 17 (check-artifact-gate.ts) 中一致 ✅
- `PreventiveReview` 接口在 Task 15 (schema) 和 Task 21 (preventive-review-logic.ts) 中一致 ✅
- `TlaBddSyncResult` 在 Task 22 (tla-bdd-sync-logic.ts) 和 Task 34 (self-test.ts) 中一致 ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-round22-p0-p3-skill-fixes.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
