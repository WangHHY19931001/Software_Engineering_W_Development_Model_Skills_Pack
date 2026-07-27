# 第 17 轮 D5 文档不一致修正与简化行为预防实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全量修正第 16 轮 D5 文档一致性检查发现的 4 项互引不一致 + 2 项状态问题（demo 未清理 + 第 16 轮变更未提交）+ 1 项简化行为预防条款补强，闭环第 16 轮遗留 D5 任务并预防调测者简化倾向。

**Architecture:** 分 4 个 Part 串行实施：Part A 修 4 项 D5 文档不一致（6 个文件）；Part B 补强简化行为预防条款（operational-recovery.md + anti-patterns.md + SKILL.md）；Part C 状态清理（demo 删除 + 第 16/17 轮变更提交）；Part D 全量回归验证。每个 Part 完成后运行 self-test + tsc 验证。

**Tech Stack:** TypeScript（strict mode）+ Vitest + tsx

**关联:** 本计划无需独立 spec（问题清晰、修正方向明确，非设计决策）。第 16 轮 spec：[`2026-07-26-round16-residual-and-design-gap-closure-design.md`](../specs/2026-07-26-round16-residual-and-design-gap-closure-design.md)

---

## 问题清单（7 项）

### Part A：D5 文档不一致（4 项，来自第 16 轮 D5 检查）

| # | 问题 | 严重级别 | 影响 |
|---|---|---|---|
| P1 | `data-models.md` 第 710 行 `violations: number`（应为 `string[]`）+ 第 711 行注释 `violations === 0`（应为 `violations.length === 0`） | high | 与 tla-plus-guide.md（string[]）+ tla-logic.ts（string[]）类型不一致，S 子代理按 data-models 写 number 会触发 R13 |
| P2 | `anti-patterns.md` 第 45 行 #25 主表描述仅列 2 种 PowerShell 工具（ConvertTo-Json/Add-Content），缺 Out-File/Set-Content；第 141 行检测信号缺 Set-Content 关键词 | medium | Set-Content 写入的 JSON 不触发 run-log note 关键词检测，守护盲区 |
| P3 | `anti-patterns.md` 第 46 行 #26 主表描述将 `decisions` 标为 EventIngress 字段，实为命名/归类错误（正确字段名 `acknowledgedDecisions`，且属 RunLogEntry 字段） | medium | S 子代理对字段名产生歧义；与同文件第 142 行检测信号（正确用 acknowledgedDecisions）不一致 |
| P4 | `SKILL.md` 第 333 行将「acknowledgedDecisions 关键词」标注为「反模式 #26 关联」，但 #26 主题是字段混用（R1 校验），关键词约束是 R2 校验，维度不同 | low | 标注松散关联，非严格互引错误；但为严格一致须修正为「P4.1 / R2 校验」 |

### Part B：简化行为预防（1 项，来自第 15 轮归档反思）

| # | 问题 | 严重级别 | 影响 |
|---|---|---|---|
| P5 | 调测者在归档过程中存在简化倾向：上下文压缩丢失细节 + 追求效率省略步骤 + 未对照硬约束核验。无预防条款 | high | 简化行为无反模式/operational-recovery 条款约束，会反复发生 |

### Part C：状态清理（2 项）

| # | 问题 | 严重级别 | 影响 |
|---|---|---|---|
| P6 | `w-model-dev-demo/` 未清理（第 15 轮调测产物，用户曾要求"移除所有产物"；第 14.1 轮已清理过第 12 轮 demo） | medium | 仓库膨胀；vitest 默认扫描会误扫（第 15 轮问题 #32 已加 vitest.config.ts 规避，但 demo 本身应清理） |
| P7 | 第 16 轮变更未提交（17 个修改文件 + 5 个新文件未 commit） | medium | 变更未入库，第 17 轮修正无干净基线 |

---

## 文件结构

### Part A：D5 文档不一致修正（4 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/data-models.md` | P1 修 violations 类型 number→string[] + 注释 violations===0→violations.length===0 | Modify |
| `w-model-dev/references/anti-patterns.md` | P2 #25 主表描述补全 4 种工具 + 检测信号补 Set-Content；P3 #26 主表描述 decisions→acknowledgedDecisions 并修正归类 | Modify |
| `w-model-dev/SKILL.md` | P4 acknowledgedDecisions 关键词条目标注「#26 关联」→「P4.1 / R2 校验」 | Modify |

### Part B：简化行为预防（3 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/operational-recovery.md` | P5 新增「调测者简化行为预防」节（3 类简化倾向 + 检测信号 + 回退动作） | Modify |
| `w-model-dev/references/anti-patterns.md` | P5 新增 #27 调测者简化（含 3 子类 a/b/c）+ 目录/对应关系/检测信号表同步 | Modify |
| `w-model-dev/SKILL.md` | P5 快速自检补「简化行为自检」条 | Modify |

### Part C：状态清理（2 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev-demo/` | P6 删除整个目录（第 15 轮调测产物已归档至 docs/changes/archive/，AGENTS.md §4 第十五轮结论已记录） | Delete |
| git | P7 提交第 16 轮 + 第 17 轮变更（分 2 个 commit：[16.0.0] + [17.0.0]） | Command |

### Part D：最终回归验证（4 个任务）

| 验证项 | 命令 |
|---|---|
| TypeScript strict | `npx tsc --noEmit` |
| self-test | `npm run self-test` |
| vitest | `npx vitest run` |
| D5 文档一致性复检 | 5 项互引人工检查（修正后应全一致） |

---

## Part A：D5 文档不一致修正（4 个任务）

### Task A1：P1 data-models.md violations 类型修正

- [ ] 读取 `w-model-dev/references/data-models.md` 第 700-715 行（TlaCheckRound 接口定义）
- [ ] 将第 710 行 `violations: number;` 改为 `violations: string[];`
- [ ] 将第 709 行注释 `/** 本轮违反数（死锁 + 不变式违反 + 状态爆炸等合计） */` 改为 `/** 本轮违反详情列表（死锁 + 不变式违反 + 状态爆炸等合计，每条为具体违反描述） */`
- [ ] 将第 711 行注释 `/** 本轮是否零违反收敛（violations === 0） */` 改为 `/** 本轮是否零违反收敛（violations.length === 0） */`
- [ ] 检查同节字段说明表（如第 718 行附近）是否有 `violations` 行，如有须同步类型为 `string[]`
- [ ] 验证：与 tla-plus-guide.md 第 251 行（`violations: string[]`）+ tla-logic.ts 第 83 行（`violations: string[]`）一致

### Task A2：P2 anti-patterns.md #25 工具清单补全

- [ ] 读取 `w-model-dev/references/anti-patterns.md` 第 45 行（#25 主表描述）
- [ ] 将第 45 行反模式描述中「PowerShell ConvertTo-Json / Add-Content」改为「PowerShell ConvertTo-Json / Add-Content / Out-File / Set-Content」（与 operational-recovery.md 第 113-118 行禁止工具表 4 种一致）
- [ ] 读取第 141 行附近（#25 检测信号）
- [ ] 在检测信号关键词列表中补 `Set-Content`（现有 ConvertTo-Json / Add-Content / Out-File，缺 Set-Content）
- [ ] 同步检查 operational-recovery.md 第 120 行检测信号，补 `Set-Content` 关键词（与 anti-patterns.md 一致）
- [ ] 验证：anti-patterns.md #25 主表描述 + 检测信号 ↔ operational-recovery.md 禁止工具表 + 检测信号 ↔ SKILL.md 快速自检，三处工具清单完全一致（4 种）

### Task A3：P3 anti-patterns.md #26 字段名修正

- [ ] 读取 `w-model-dev/references/anti-patterns.md` 第 46 行（#26 主表描述）
- [ ] 将第 46 行 `含 eventId/eventType/decisions 等 EventIngress 字段` 改为 `含 eventId/eventType/source/summary 等 EventIngress 字段，或误用 acknowledgedDecisions 字段归属` 
  - 注意：`decisions` 不是任何 schema 的字段；正确字段名是 `acknowledgedDecisions`（RunLogEntry 字段）；EventIngress 字段为 eventId/eventType/source/summary/affectedArtifacts/affectedRequirements/evidence/routedTo
- [ ] 验证：与同文件第 142 行检测信号（正确用 acknowledgedDecisions）+ data-models.md 第 517-519 行禁止混用规则字段清单一致
- [ ] 检查 data-models.md 第 395 行历史叙述「误用 eventId / eventType / decisions」是否须同步修正（decisions→acknowledgedDecisions 或保留为历史叙述加注）

### Task A4：P4 SKILL.md acknowledgedDecisions 标注修正

- [ ] 读取 `w-model-dev/SKILL.md` 第 333 行附近（快速自检 acknowledgedDecisions 关键词条目）
- [ ] 将「（反模式 #26 关联，第 16 轮 P4.1，R2 校验）」改为「（第 16 轮 P4.1，R2 校验；与反模式 #26 字段混用同属 schema 边界约束但维度不同：#26 管字段归属 R1，本条管字段内容 R2）」
  - 或简化为「（第 16 轮 P4.1，R2 校验，详见 phase-8-acceptance-test.md）」并删除 #26 关联措辞
- [ ] 同步检查 CHANGELOG.md 第 24 行是否有相同「#26 关联」措辞，如有须同步修正
- [ ] 验证：SKILL.md acknowledgedDecisions 条目标注 ↔ phase-8-acceptance-test.md「acknowledgedDecisions 决策条目须含关键词」节（应引用 R2/checkpoint-logic.ts，非 #26）

### Part A 完成验证

- [ ] D5 检查 1 复检：tla-plus-guide.md §checkRounds（violations: string[]）↔ data-models.md tla-manifest.json 节（violations: string[]）↔ tla-logic.ts 类型定义（violations: string[]）→ 三处一致
- [ ] D5 检查 3 复检：operational-recovery.md「JSON 文件写入工具选择」（4 种工具）↔ anti-patterns.md #25 主表（4 种）+ 检测信号（4 种关键词）→ 一致
- [ ] D5 检查 4 复检：data-models.md Schema 边界对照表 ↔ anti-patterns.md #26 主表（字段名正确）+ 检测信号 → 一致
- [ ] `npx tsc --noEmit` 0 错误（文档改动不影响编译，但需确认无脚本误改）

---

## Part B：简化行为预防（3 个任务）

### Task B1：P5 operational-recovery.md 新增「调测者简化行为预防」节

- [ ] 读取 `w-model-dev/references/operational-recovery.md` 结构，定位合适插入位置（如「成本预算与运行日志」节后或「JSON 文件写入工具选择」节后）
- [ ] 新增「调测者简化行为预防」节：
  ```markdown
  ## 调测者简化行为预防

  > 第 15 轮归档反思识别的调测者简化倾向。self-as-verifier 模式下调测者兼具 S/V/G 角色，简化行为无外部评审拦截，须靠自检条款预防。第 17 轮 P5 新增。

  ### 三类简化倾向

  | # | 简化倾向 | 表现 | 检测信号 | 回退动作 |
  |---|---|---|---|---|
  | S1 | 上下文压缩丢失细节 | 长会话后遗漏硬约束（如 RTM 须 100%、TLA+ 须零违反、checkRounds 须 spec 级）；复述阶段产物时省略字段 | run-log.jsonl note 字段缺关键约束名 / checkpoint acknowledgedDecisions 缺硬约束 ID | 回当前阶段起点，重读硬约束 + 重走 S→V→G |
  | S2 | 追求效率省略步骤 | 跳过 ingestion 子流程 / 跳过 R 根因定位直接 S 返工 / 跳过阶段级 G 直接终检 / V 评审省略 reworkHints | run-log.jsonl 缺 chunk/cross/review/gate 动作 / 缺 reworkHints 字段 / 阶段级 --phase=N 缺失 | 回当前阶段起点，补全 S→V→G 全流程 |
  | S3 | 未对照硬约束核验 | V 评审不核验信息流零违反 / G 门禁不核验 exitCode 与 JSON passed 一致 / 归档不核验 acceptance-test-report §9 用户确认 | verifier-output 缺硬约束核验项 / gate JSON exitCode ≠ passed / 归档缺 §9 确认 | 回当前阶段起点，逐条核验硬约束清单 |

  ### 自检清单

  - [ ] 每阶段 S 产出后，复述硬约束清单（RTM 100% / TLA+ 零违反 / 信息流零违反 / exitCode 与 passed 一致 / acknowledgedDecisions 含关键词）
  - [ ] 每阶段 V 评审后，确认 reworkHints 非空（即使 passed=true 也有 FYI 提示）
  - [ ] 每阶段 G 门禁后，确认 7 脚本全 exitCode=0（check-verifier / check-artifact-gate --phase=N / check-budget / check-maturity / check-run-log / check-checkpoint；阶段 1-4 额外 check-tla-model / check-requirement-graph）
  - [ ] 归档前确认 acceptance-test-report.md §9 用户确认区已勾选（self-as-verifier 模式须留代签痕迹）
  - [ ] 长会话（>20 轮）后重读 project_memory.md 硬约束 + 当前阶段 phase-N-*.md 摘要

  命中任一简化倾向 → 回当前阶段起点，按自检清单逐条核验。详见 [anti-patterns.md #27](anti-patterns.md#27-调测者简化行为)。
  ```

### Task B2：P5 anti-patterns.md 新增 #27 调测者简化行为

- [ ] 读取 `w-model-dev/references/anti-patterns.md` 反模式清单（#26 后）
- [ ] 新增 #27：
  ```markdown
  | 27 | 调测者简化行为（上下文压缩丢细节 / 追求效率省步骤 / 未对照硬约束核验） | self-as-verifier 模式下无外部评审拦截简化行为，硬约束遗漏带入归档 | 调测者须按 operational-recovery.md「调测者简化行为预防」节自检清单逐条核验（见 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节） |
  ```
- [ ] 同步更新「目录」节：`反模式清单（23 条流程反模式 #1~#17 + #21~#26）` → `反模式清单（24 条流程反模式 #1~#17 + #21~#27）`
- [ ] 同步更新「命中高发阶段」表（新增 #27 行）：`| #27（调测者简化行为） | 阶段 1-8（self-as-verifier 模式全阶段） | [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节 |`
- [ ] 同步更新「与门禁脚本的对应关系」表（新增 #27 行）：`| #27（调测者简化行为） | run-log.jsonl 动作完整性（R1）+ checkpoint R2 + gate exitCode 一致性（R6）交叉检测 |`
- [ ] 同步更新「检测信号与回退命令」表（新增 #27 行）

### Task B3：P5 SKILL.md 快速自检补「简化行为自检」条

- [ ] 读取 `w-model-dev/SKILL.md` 快速自检节（第 332-333 行附近）
- [ ] 在 acknowledgedDecisions 关键词条目后新增：
  ```markdown
  - [ ] **调测者简化行为自检**（反模式 #27，第 17 轮 P5）：self-as-verifier 模式下每阶段须按 operational-recovery.md「调测者简化行为预防」节自检清单逐条核验（硬约束复述 / reworkHints 非空 / 7 脚本全 exitCode=0 / §9 确认 / 长会话重读硬约束）。命中任一简化倾向回阶段起点。
  ```

### Part B 完成验证

- [ ] 文档一致性检查：operational-recovery.md「调测者简化行为预防」↔ anti-patterns.md #27 ↔ SKILL.md 快速自检（三向互引闭合）
- [ ] `npx tsc --noEmit` 0 错误

---

## Part C：状态清理（2 个任务）

### Task C1：P6 删除 w-model-dev-demo/

- [ ] 确认第 15 轮调测结论已归档至 `w-model-dev-demo/docs/changes/archive/2026-07-26-round15-end-to-end-test/`（9 文件：README/proposal/specs/design/tasks/tla-summary/verifier-summary/rtm-snapshot/test-report-snapshot）
- [ ] 确认 AGENTS.md §4 第十五轮结论已记录（含 32 问题归纳 + 7 共性问题 + 4 设计层缺口）
- [ ] 确认 CHANGELOG.md [15.0.0] 已记录
- [ ] **前置**：将归档目录 `w-model-dev-demo/docs/changes/archive/2026-07-26-round15-end-to-end-test/` 拷贝至 `docs/changes/archive/2026-07-26-round15-end-to-end-test/`（仓库级归档，与 demo 目录解耦）
- [ ] 删除 `w-model-dev-demo/` 整个目录
- [ ] 验证：`git status` 显示 w-model-dev-demo/ 全部 untracked 文件消失
- [ ] 验证：`npx vitest run` 不报错（vitest.config.ts 已 exclude w-model-dev-demo/**，删除后无影响）
- [ ] 验证：`npm run self-test` 仍 95/95 通过（self-test 不依赖 demo）

### Task C2：P7 提交第 16 轮 + 第 17 轮变更

- [ ] **第 16 轮 commit**（[16.0.0]）：
  - 暂存第 16 轮变更文件（17 modified + 4 new：spec/plan/samples/vitest.config.ts）
  - 不暂存 w-model-dev-demo/（将在第 17 轮 commit 中删除）
  - commit message：`feat(round16): 遗留问题与设计层缺口闭环（R13 checkRounds schema + 5 反模式 #22~#26 + 8 reference 文档）[16.0.0]`
- [ ] **第 17 轮 commit**（[17.0.0]）：
  - 暂存第 17 轮变更文件（Part A 修 3 文件 + Part B 改 3 文件 + 删除 w-model-dev-demo/ + 本计划文档 + 归档目录拷贝）
  - commit message：`fix(round17): D5 文档不一致修正 + 简化行为预防 #27 + demo 清理 [17.0.0]`
- [ ] 验证：`git log --oneline -5` 显示 2 个新 commit
- [ ] 验证：`git status` clean（无未提交变更）
- [ ] **注意**：不 push（除非用户明确要求）

### Part C 完成验证

- [ ] `w-model-dev-demo/` 不存在
- [ ] `docs/changes/archive/2026-07-26-round15-end-to-end-test/` 存在（9 文件）
- [ ] `git status` clean
- [ ] `npx vitest run` 全通过
- [ ] `npm run self-test` 95/95 全通过

---

## Part D：最终回归验证（4 个任务）

### Task D1：TypeScript strict 编译

- [ ] 执行 `npx tsc --noEmit`
- [ ] 预期：0 错误

### Task D2：self-test 全量回归

- [ ] 执行 `npm run self-test`
- [ ] 预期：95/95 全通过（未改脚本逻辑，仅改文档）

### Task D3：vitest 全量回归

- [ ] 执行 `npx vitest run`
- [ ] 预期：76/76 或 77+/77+ 全通过

### Task D4：D5 文档一致性复检（5 项全一致）

- [ ] 检查 1：tla-plus-guide.md §checkRounds（violations: string[]）↔ data-models.md tla-manifest.json 节（violations: string[]，已修）↔ tla-logic.ts 类型定义（violations: string[]）→ 一致 ✓
- [ ] 检查 2：anti-patterns.md #22~#27 ↔ phase-3/4/5/7/8 禁止行为节 ↔ SKILL.md 快速自检 → 一致 ✓
- [ ] 检查 3：operational-recovery.md「JSON 文件写入工具选择」（4 种工具）↔ anti-patterns.md #25 主表（4 种，已补）+ 检测信号（4 种关键词，已补 Set-Content）→ 一致 ✓
- [ ] 检查 4：data-models.md Schema 边界对照表 ↔ anti-patterns.md #26 主表（字段名已修）+ 检测信号 → 一致 ✓
- [ ] 检查 5：SSoT §3.4.11 ↔ AGENTS.md §4 第十六轮 ↔ CHANGELOG [16.0.0] → 一致 ✓（第 16 轮已一致，第 17 轮不改顶层文档数值）
- [ ] 新增检查 6：operational-recovery.md「调测者简化行为预防」↔ anti-patterns.md #27 ↔ SKILL.md 快速自检 → 一致 ✓

---

## 顶层文档同步（可选，如需记录第 17 轮）

### Task E1（可选）：SSoT §3.4.12 第十七轮约束

- [ ] 在 `docs/skill-design-document_SSoT.md` §3.4 新增 §3.4.12「第 17 轮：D5 文档不一致修正与简化行为预防」
- [ ] 记录 7 项问题 + 修正方案 + 验证结果

### Task E2（可选）：AGENTS.md §4 追加第十七轮结论

- [ ] 在 `AGENTS.md` §4 第十六轮结论后追加第十七轮结论
- [ ] 记录指标：触发 / 修正方案 / 文档改动 / 反模式新增 / 验证

### Task E3（可选）：CHANGELOG.md 追加 [17.0.0]

- [ ] 在 `CHANGELOG.md` 顶部 [16.0.0] 节前新增 [17.0.0] 节
- [ ] 记录新增 / 变更 / 验证

---

## 执行清单

**Part A（4 任务，可并行）**：A1 data-models violations 类型 / A2 anti-patterns #25 工具补全 / A3 anti-patterns #26 字段名修正 / A4 SKILL.md 标注修正

**Part B（3 任务，串行）**：B1 operational-recovery 简化预防节 / B2 anti-patterns #27 / B3 SKILL.md 自检条

**Part C（2 任务，串行）**：C1 删除 demo / C2 git commit（16 轮 + 17 轮）

**Part D（4 任务，顺序执行）**：D1 tsc / D2 self-test / D3 vitest / D4 D5 复检

**Part E（可选，3 任务）**：E1 SSoT §3.4.12 / E2 AGENTS.md §4 / E3 CHANGELOG [17.0.0]

总计 13 必做任务 + 3 可选任务，按 Part A→B→C→D 串行，Part 内并行/串行。

---

## 风险与注意事项

1. **Task C1 删除 demo 不可逆**：删除前确认归档目录已拷贝至 `docs/changes/archive/`，AGENTS.md §4 + CHANGELOG [15.0.0] 已记录结论
2. **Task C2 提交分 2 个 commit**：第 16 轮变更（不含 demo 删除）+ 第 17 轮变更（含 demo 删除），保持语义清晰
3. **Part B 新增 #27 反模式**：反模式编号从 26 扩展到 27，须同步更新 anti-patterns.md 目录 + 对应关系表 + 检测信号表 + 命中高发阶段表（4 处）
4. **不 push**：除非用户明确要求，commit 后不 push 到远程
5. **Part E 可选**：如用户不要求记录第 17 轮顶层文档，可跳过；但建议执行以保持轮次记录完整
