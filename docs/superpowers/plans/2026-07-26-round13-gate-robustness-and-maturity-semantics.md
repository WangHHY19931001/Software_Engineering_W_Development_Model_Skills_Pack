# 第 13 轮门禁鲁棒性与 maturity 语义修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正第 12 轮 W 模型调测识别的 4 个问题（P1×1 + P2×1 + P3×1 + P4×1），增强门禁脚本鲁棒性、修正 maturity R3 语义、新增反模式 #21、补充 TLA+ 时间推进建模指引。

**Architecture:** 分 3 个 Part 串行实施：Part A 改 3 脚本 + 1 fixture + self-test；Part B 改 2 reference 文档（anti-patterns + tla-plus-guide）+ SKILL.md；Part C 改 3 顶层文档。每个 Part 完成后运行 self-test 验证。

**Tech Stack:** TypeScript（strict mode）+ Vitest + tsx + PowerShell

**关联 spec:** [2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md](../specs/2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md)

---

## 文件结构

### Part A：脚本与 fixture（5 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/scripts/cli/check-code-tla-consistency.ts` | P1.1 readJson EISDIR 友好处理 | Modify |
| `w-model-dev/scripts/cli/check-requirement-graph.ts` | P1.1 readFile EISDIR 友好处理 | Modify |
| `w-model-dev/scripts/logic/maturity-logic.ts` | P2.1 R3 单位修正（floor(completedPhases/8)） | Modify |
| `w-model-dev/scripts/cli/check-maturity.ts` | P2.1 违规信息文案对齐 | Modify |
| `w-model-dev/scripts/samples/maturity/bad-r3-cycle-mismatch.json` | P2.1 新 fixture | Create |
| `w-model-dev/scripts/cli/self-test.ts` | P2.1 新增 1 条 R3 样本 | Modify |

### Part B：reference 文档（3 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/anti-patterns.md` | P3.1 反模式 #21 新增 | Modify |
| `w-model-dev/SKILL.md` | P3.1 阶段 6/7/8 路由表强化约束 | Modify |
| `w-model-dev/references/tla-plus-guide.md` | P4.1 新增 §14 时间推进建模模式 | Modify |

### Part C：顶层文档（3 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | §3.4.10 第 13 轮约束 | Modify |
| `AGENTS.md` | §4 第 13 轮结论 | Modify |
| `CHANGELOG.md` | [13.0.0] 第 13 轮版本条目 | Modify |

---

## Part A：脚本与 fixture（5 个任务）

### Task A1：P1.1 check-code-tla-consistency.ts EISDIR 处理

- [ ] 修改 `w-model-dev/scripts/cli/check-code-tla-consistency.ts` 的 `readJson` 函数（73-92 行），在 ENOENT 分支后增加 EISDIR 分支：
  ```typescript
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ ${label} 文件不存在: ${abs}`);
      process.exit(2);
    }
    if (e.code === 'EISDIR') {
      console.error(`✗ ${label} 参数应为文件路径，实际为目录: ${abs}`);
      process.exit(2);
    }
    throw err;
  }
  ```
- [ ] 验证：手动调用 `npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=w-model-dev-demo/.w-model/ingestion --rtm=.w-model/rtm.json --src=src/` 应输出"参数应为文件路径"提示
- [ ] 验证：TypeScript strict 编译通过（`npx tsc --noEmit`）

### Task A2：P1.1 check-requirement-graph.ts EISDIR 处理

- [ ] 修改 `w-model-dev/scripts/cli/check-requirement-graph.ts` 的 `readFile` 错误处理（53-62 行），在 ENOENT 分支后增加 EISDIR 分支：
  ```typescript
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    if (e.code === 'EISDIR') {
      console.error(`✗ 参数应为文件路径，实际为目录: ${abs}`);
      process.exit(2);
    }
    throw err;
  }
  ```
- [ ] 验证：手动调用 `npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev-demo/.w-model/ingestion` 应输出"参数应为文件路径"提示
- [ ] 验证：现有 self-test 不受影响

### Task A3：P2.1 maturity-logic.ts R3 单位修正

- [ ] 修改 `w-model-dev/scripts/logic/maturity-logic.ts` 第 99-109 行 R3 逻辑：
  ```typescript
  // R3 成功阶段更新：completedCycles 为完整 8 阶段周期数
  // 语义：1 完整周期 = 8 阶段，completedCycles 应 ≥ floor(completedPhases / 8)
  if (
    options?.completedPhases !== undefined &&
    uc &&
    typeof uc.completedCycles === 'number' &&
    uc.completedCycles < Math.floor(options.completedPhases / 8)
  ) {
    const expectedCycles = Math.floor(options.completedPhases / 8);
    violations.push(`R3: project 已完成 ${options.completedPhases} 阶段（${expectedCycles} 完整周期），但 unlockConditions.completedCycles=${uc.completedCycles} 未更新`);
  }
  ```
- [ ] 删除原"简化语义"注释，替换为正式语义说明
- [ ] 验证：`npx tsc --noEmit` 通过

### Task A4：P2.1 新增 fixture + self-test 样本

- [ ] 创建 `w-model-dev/scripts/samples/maturity/bad-r3-cycle-mismatch.json`：
  ```json
  {
    "version": "1.0",
    "level": "L0",
    "currentPhase": 9,
    "updatedAt": "2026-07-26T10:00:00Z",
    "createdAt": "2026-07-20T00:00:00Z",
    "unlockConditions": {
      "stableDays": 30,
      "completedCycles": 0,
      "attemptCapRate": 0.85,
      "misjudgeRate": 0.05,
      "convergenceRate": 0.9
    },
    "history": [
      { "phase": 1, "timestamp": "2026-07-20T00:00:00Z", "event": "phase-start" },
      { "phase": 8, "timestamp": "2026-07-26T00:00:00Z", "event": "phase-complete" }
    ],
    "degradation": { "triggered": false, "reason": null }
  }
  ```
  （completedCycles=0 但 completedPhases=8 应触发 R3，因 floor(8/8)=1 > 0）
- [ ] 修改 `w-model-dev/scripts/cli/self-test.ts`，在 maturity 用例数组中新增 1 条：
  ```typescript
  {
    name: 'maturity/bad-r3-cycle-mismatch.json',
    file: 'maturity/bad-r3-cycle-mismatch.json',
    description: 'P2.1 R3 单位修正：completedPhases=8（1 完整周期）但 completedCycles=0，应触发 R3 违规',
    options: { completedPhases: 8 },
    expectPassed: false,
    expectViolationsContain: ['R3'],
  },
  ```
- [ ] 验证：`npm run self-test` 应显示 92/92 通过（基线 91 → 92）

### Task A5：Part A 验证

- [ ] 运行 `npm run self-test` → 92/92 通过，退出码 0
- [ ] 运行 `cd w-model-dev && npx vitest run scripts/__tests__/` → 72/72 通过（不修改 vitest 套件）
- [ ] 运行 `npx tsc --noEmit` → 0 错误
- [ ] 手动验证 EISDIR：`npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev-demo/.w-model/ingestion` 应输出"参数应为文件路径"提示并退出码 2

---

## Part B：reference 文档（3 个任务）

### Task B1：P3.1 anti-patterns.md 反模式 #21

- [ ] 读取 `w-model-dev/references/anti-patterns.md` 定位 #20 之后的位置
- [ ] 新增反模式 #21：
  ```markdown
  ### #21 阶段级门禁跳过（self-as-verifier 模式下跳过中间阶段门禁直接跑终检）

  **检测信号**：run-log.jsonl 中阶段 N（6/7）的 gate 动作类型为 `check-artifact-gate` 但参数为 `--phase=8`（或无 `--phase` 参数，默认终检），且 N < 8。

  **违反后果**：回到阶段 N 起点，强制跑 `--phase=N`。

  **例外**：
  - 阶段 1-4 不强制跑 `check-artifact-gate`（设计阶段，无测试汇总校验）
  - 阶段 5 以 `check-code-tla-consistency` 为主，`--phase=5` 为辅

  **来源**：第 13 轮 P3.1（第 12 轮阶段 7 跳过 `--phase=7` 直接跑 `--phase=8`，导致 REQ-019/021 systemTest 缺失到终检才发现）。
  ```
- [ ] 验证：anti-patterns.md 现有 21 条反模式（#1-#21）

### Task B2：P3.1 SKILL.md 阶段路由表强化约束

- [ ] 读取 `w-model-dev/SKILL.md` 阶段路由表（line 225-232 附近）和阶段 6/7 G 门禁推荐命令节（line 253-269）
- [ ] 在阶段 6/7/8 行的"约束"列追加"必须跑 `--phase=N`，不得跳过"（或等效强化措辞）
- [ ] 在阶段 7 G 门禁推荐命令节末尾增加约束说明：
  ```markdown
  > **反模式 #21**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检。每阶段完成必须跑对应 `--phase=N`，违反则回到阶段起点。
  ```
- [ ] 验证：阶段路由表与 anti-patterns.md #21 互引一致

### Task B3：P4.1 tla-plus-guide.md 新增 §14

- [ ] 读取 `w-model-dev/references/tla-plus-guide.md` 末尾（§13 之后）
- [ ] 新增 §14「L4 时间推进/保留期建模模式」：
  ```markdown
  ## 14. L4 时间推进/保留期建模模式（第 13 轮 P4.1）

  > S-tla 子代理在 L4 层级建模涉及"时间推进/保留期/过期清理"场景时的模式指引。第 12 轮 `L4_audit_log_retention` 靠 TLC 拦截才发现 AdvanceTime 越界，本节提供正反例与通用规则。

  ### 14.1 模式概述

  时间推进动作（AdvanceTime/Tick）+ 保留期不变式（Retention/N/Expiry）是 L4 状态机常见模式：系统按时间推进，过期数据按保留期清理。

  ### 14.2 反例（第 12 轮 L4_audit_log_retention）

  **错误实现**：
  ```tla
  AdvanceTime == oldestAge' = oldestAge + 1
  
  Retention90Days == oldestAge <= RETENTION_DAYS
  ```

  **TLC 报错**：`Invariant Retention90Days is violated.`

  **问题**：`AdvanceTime` 无前置条件，`oldestAge` 可推至 `RETENTION_DAYS+1`，违反不变式。

  ### 14.3 正例

  ```tla
  AdvanceTime ==
    /\ logCount > 0                    \* 前置条件：无日志时不推进
    /\ oldestAge < RETENTION_DAYS      \* 上限约束：不超过保留期
    /\ oldestAge' = oldestAge + 1
    /\ logCount' = logCount
    /\ unchanged otherVars
  
  PurgeExpiredLogs ==
    /\ oldestAge >= RETENTION_DAYS     \* 触发阈值：达到保留期才清理
    /\ logCount' = logCount - expiredCount
    /\ oldestAge' = oldestAge
    /\ unchanged otherVars
  
  Retention90Days == oldestAge <= RETENTION_DAYS
  ```

  ### 14.4 通用规则

  1. **时间推进动作必须有前置条件**：非空集合（`logCount > 0`）或上限约束（`oldestAge < RETENTION_DAYS`），防止无意义推进或越界
  2. **保留期不变式与清理动作触发阈值一致**：`>= RETENTION_DAYS` 触发清理，`< RETENTION_DAYS` 作为不变式守卫，两者边界对齐
  3. **清理动作与时间推进动作分离**：不要在 `AdvanceTime` 中同时清理，保持单一职责
  4. **Next 分支覆盖**：`Next == \/ AdvanceTime \/ \/ PurgeExpiredLogs \/ ...`，确保清理动作可达
  ```

- [ ] 验证：tla-plus-guide.md 现有 §1-§14，§14 与 §4（不变式业务语义对齐）职责不重复

---

## Part C：顶层文档（3 个任务）

### Task C1：SSoT §3.4.10 第 13 轮约束小节

- [ ] 读取 `docs/skill-design-document_SSoT.md` §3.4.9 之后的位置
- [ ] 新增 §3.4.10「第 13 轮门禁鲁棒性与 maturity 语义约束」：
  ```markdown
  ### 3.4.10 第 13 轮：门禁鲁棒性与 maturity 语义约束（2026-07-26）

  第 12 轮 32 需求端到端调测归档后识别的 4 个问题修正约束：

  1. **P1.1 脚本 EISDIR 友好处理**：check-code-tla-consistency.ts / check-requirement-graph.ts 的 readJson/readFile 错误处理增加 EISDIR 分支，输出"参数应为文件路径，实际为目录"明确提示（退出码 2）
  2. **P2.1 maturity R3 单位修正**：R3 逻辑从 `completedCycles < completedPhases` 改为 `completedCycles < Math.floor(completedPhases / 8)`，与 schema 语义"完整 8 阶段周期数"对齐
  3. **P3.1 反模式 #21**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检，违反则回到阶段起点
  4. **P4.1 tla-plus-guide.md §14**：新增 L4 时间推进/保留期建模模式指引（反例 + 正例 + 通用规则），降低 S-tla 子代理对 TLC 试错的依赖
  ```

### Task C2：AGENTS.md §4 第 13 轮结论

- [ ] 读取 `AGENTS.md` §4 第十二轮结论之后的位置
- [ ] 新增第十三轮修正结论：
  ```markdown
  - **第十三轮：门禁鲁棒性与 maturity 语义修正结论**（2026-07-26）：

  | 指标 | 数值 |
  |---|---|
  | 触发 | 第 12 轮 32 需求端到端调测归档后识别 4 个问题（P1×1 + P2×1 + P3×1 + P4×1） |
  | 修正方案 | 方案 A 全量修正 4 个问题 |
  | 脚本改动 | 3 个（check-code-tla-consistency.ts / check-requirement-graph.ts / maturity-logic.ts） |
  | 新增 fixture | 1 个（maturity/bad-r3-cycle-mismatch.json） |
  | reference 文档 | 2 个（anti-patterns.md #21 + tla-plus-guide.md §14） |
  | 顶层文档 | 3 个（SSoT §3.4.10 + AGENTS.md §4 + CHANGELOG.md） |
  | self-test | 基线 91→92（+1 新测试）全通过 |
  | TypeScript strict | 0 错误 |
  | 反模式 | #20 → #21（新增"阶段级门禁跳过"） |

  > 第十三轮（2026-07-26）相比第十二轮（端到端调测）：门禁脚本从"裸 Node 报错"进化为"EISDIR 友好提示"（P1.1）；maturity R3 从"单位矛盾的简化语义"进化为"floor(completedPhases/8) 正式语义"（P2.1）；self-as-verifier 模式从"无阶段级门禁约束"进化为"反模式 #21 强制阶段 6/7/8 跑 --phase=N"（P3.1）；TLA+ 指南从"无时间推进建模指引"进化为"§14 正反例 + 通用规则"（P4.1）。
  ```

### Task C3：CHANGELOG.md [13.0.0] 版本条目

- [ ] 读取 `CHANGELOG.md` 顶部（[12.0.0] 之前）
- [ ] 在 [12.0.0] 之前插入 [13.0.0]：
  ```markdown
  ## [13.0.0] - 2026-07-26

  ### 第 13 轮门禁鲁棒性与 maturity 语义修正

  基于第 12 轮 32 需求端到端调测归档后识别的 4 个问题（P1×1 + P2×1 + P3×1 + P4×1）全量修正。

  #### 新增

  - **P2.1 R3 单位修正**：maturity-logic.ts R3 逻辑从 `completedCycles < completedPhases` 改为 `completedCycles < Math.floor(completedPhases / 8)`，与 schema 语义"完整 8 阶段周期数"对齐
  - **P3.1 反模式 #21**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检
  - **P4.1 tla-plus-guide.md §14**：L4 时间推进/保留期建模模式指引（反例 + 正例 + 通用规则）
  - 1 新 fixture：maturity/bad-r3-cycle-mismatch.json（completedPhases=8, completedCycles=0 应触发 R3）
  - 1 新 self-test（基线 91→92）：P2.1 R3 单位不匹配样本

  #### 变更

  - check-code-tla-consistency.ts: readJson 增加 EISDIR 友好提示（P1.1）
  - check-requirement-graph.ts: readFile 增加 EISDIR 友好提示（P1.1）
  - maturity-logic.ts: R3 逻辑修正 + 删除"简化语义"注释（P2.1）
  - anti-patterns.md: 新增 #21 阶段级门禁跳过（P3.1）
  - SKILL.md: 阶段 6/7/8 路由表强化约束 + 反模式 #21 互引（P3.1）
  - tla-plus-guide.md: 新增 §14 时间推进/保留期建模模式（P4.1）
  - SSoT §3.4.10: 第 13 轮 4 项约束条款
  - AGENTS.md §4: 第 13 轮修正结论（含指标表 + 与第十二轮对比）

  #### 验证

  - TypeScript strict 0 错误
  - self-test 92/92 全通过
  - vitest 72/72 全通过
  - EISDIR 手动验证：check-requirement-graph.ts 传目录路径输出"参数应为文件路径"提示，退出码 2
  - maturity R3 回归：第 12 轮 demo maturity.json（completedCycles=7, completedPhases 未传）不触发 R3
  ```

---

## 最终验证

- [ ] 运行 `npm run self-test` → 92/92 通过，退出码 0
- [ ] 运行 `cd w-model-dev && npx vitest run scripts/__tests__/` → 72/72 通过
- [ ] 运行 `npx tsc --noEmit` → 0 错误
- [ ] EISDIR 手动验证（P1.1）：
  - `npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev-demo/.w-model/ingestion` → 输出"参数应为文件路径，实际为目录" + 退出码 2
  - `npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=w-model-dev-demo/.w-model/ingestion --rtm=.w-model/rtm.json --src=src/` → 输出"graph 参数应为文件路径" + 退出码 2
- [ ] maturity R3 回归（P2.1）：第 12 轮 demo maturity.json 不触发新违规
- [ ] 文档一致性检查：
  - anti-patterns.md #21 ↔ SKILL.md 阶段路由表互引
  - tla-plus-guide.md §14 ↔ SSoT §3.4.10 P4.1 条目
  - SSoT §3.4.10 ↔ AGENTS.md §4 第十三轮 ↔ CHANGELOG [13.0.0] 互引一致

---

## 实施约束

1. **不修改 w-model-dev-demo/**（第 12 轮已归档，不补建产物）
2. **不修改 vitest 测试套件**（P2.1 仅新增 self-test 样本，不新增 vitest 用例）
3. **不修改 data-models.md schema 定义**（P2.1 仅修正 R3 逻辑，保留 completedCycles 语义）
4. **不引入脚本自动发现**（P1.1 仅对齐 EISDIR 处理，自动发现是 check-artifact-gate 特化能力）
5. **每个 Part 完成后运行 self-test 验证**，失败则回到该 Part 起点返工
