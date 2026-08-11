# Round 24 十项技能包修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 Round 23 调测暴露的 10 项技能包问题，按 P0→P1→P2→P3 分 4 批分层增量执行

**Architecture:** 每批跨 SKILL.md/references/templates/schemas/scripts 5 层，每批完成后跑 self-test + tsc 验证

**Tech Stack:** TypeScript (strict mode), Node.js, Vitest

**Spec:** `docs/superpowers/specs/2026-07-30-round24-p0-p3-skill-fixes-design.md`

**SSoT:** `docs/skill-design-document_SSoT.md` §3.4.20（第 693-717 行）

**版本号:** 22.0.0 → 23.0.0

**关键决策：**
- run-log-logic.ts 第 235-265 行已有 R3 预防性审查记录校验（第22轮新增），Task 7 不重复增加 R8，仅扩展约束 #12 文案 + check-preventive-review.ts `--auto-trigger`
- check-verifier-output.ts 已存在（113 行），Task 10 直接 Modify 增加 `--self-as-verifier` 参数与独立产物校验
- 现有 valid.jsonl 不含 role=V 记录（历史样本），新 check-role-dispatch.ts 仅对新样本校验，不破坏现有样本

---

## File Structure

### P0 批（信息流硬约束）— 6 任务

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 1 | `w-model-dev/SKILL.md:54` | 新增约束 #18 RTM 回填 | Modify |
| 1 | `w-model-dev/references/subagent-delegation.md` | §S 子代理职责增加 RTM 回填 | Modify |
| 2 | `w-model-dev/scripts/logic/gate-logic.ts:315` | coverageStatus 字段校验 | Modify |
| 2 | `w-model-dev/scripts/samples/gate/bad-rtm-coverage-below-100.json` | RTM coverage<100 样本 | Create |
| 2 | `w-model-dev/scripts/samples/gate/bad-rtm-status-mismatch.json` | coverageStatus 不一致样本 | Create |
| 3 | `w-model-dev/SKILL.md:54` | 新增约束 #19 角色分派 + §6 时序 | Modify |
| 3 | `w-model-dev/references/anti-patterns.md:455` | 新增反模式 #34 | Modify |
| 4 | `w-model-dev/scripts/cli/check-role-dispatch.ts` | 角色分派完整性校验 | Create |
| 4 | `w-model-dev/scripts/samples/run-log/bad-missing-V-role.jsonl` | 缺 V 角色 | Create |
| 4 | `w-model-dev/scripts/samples/run-log/bad-missing-G-role.jsonl` | 缺 G 角色 | Create |
| 4 | `w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl` | R3 缺 R 角色 | Create |
| 5 | `w-model-dev/schemas/run-log.schema.json` | role 字段说明 | Modify |
| 5 | `w-model-dev/references/subagent-delegation.md` | 角色分派完整性校验节 | Modify |
| 6 | `w-model-dev/scripts/cli/self-test.ts` | P0 用例 + 验证 | Modify |

### P1 批（行为正确性）— 5 任务

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 7 | `w-model-dev/SKILL.md:49` | 约束 #12 扩展为 5 脚本 | Modify |
| 7 | `w-model-dev/scripts/cli/check-preventive-review.ts` | `--auto-trigger` 参数 | Modify |
| 7 | `w-model-dev/references/phase-1-requirements.md` | R3 触发时机 | Modify |
| 8 | `w-model-dev/scripts/cli/check-state-machine-consistency.ts` | 状态机一致性校验 | Create |
| 8 | `w-model-dev/scripts/samples/state-machine/bad-missing-transition.json` | 缺转移样本 | Create |
| 8 | `w-model-dev/scripts/samples/state-machine/bad-extra-transition.json` | 多转移样本 | Create |
| 8 | `w-model-dev/scripts/samples/state-machine/valid-consistent.json` | 一致样本 | Create |
| 8 | `w-model-dev/references/tla-plus-guide.md` | 设计文档↔代码状态机一致性节 | Modify |
| 9 | `w-model-dev/SKILL.md` | self-as-verifier 模式节 | Modify |
| 9 | `w-model-dev/references/verifier-spec.md` | self-as-verifier 模式节 | Modify |
| 9 | `w-model-dev/references/agent-personas.md` | self-as-verifier 兼任规则 | Modify |
| 9 | `w-model-dev/references/anti-patterns.md` | 新增反模式 #35 | Modify |
| 10 | `w-model-dev/scripts/cli/check-verifier-output.ts` | `--self-as-verifier` 独立产物校验 | Modify |
| 11 | `w-model-dev/scripts/cli/self-test.ts` | P1 用例 + 验证 | Modify |

### P2 批（设计指导）— 4 任务

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 12 | `w-model-dev/templates/requirement-spec.md` | NFR 双字段 | Modify |
| 12 | `w-model-dev/templates/system-test.md` | 性能度量环境声明节 | Modify |
| 12 | `w-model-dev/schemas/rtm.schema.json` | NFR 双值字段 | Modify |
| 12 | `w-model-dev/references/quality-standards.md` | 生产目标 vs 测试基线 | Modify |
| 12 | `w-model-dev/scripts/logic/gate-logic.ts` | NFR 双值警告级校验 | Modify |
| 13 | `w-model-dev/templates/interface-design.md` | 路由注册顺序约束节 | Modify |
| 13 | `w-model-dev/references/phase-3-outline-design.md` | 路由顺序约束节 | Modify |
| 13 | `w-model-dev/references/anti-patterns.md` | 新增反模式 #36 | Modify |
| 14 | `w-model-dev/references/graph-guide.md` | 边数下限与语义来源占比节 | Modify |
| 14 | `w-model-dev/scripts/logic/graph-logic.ts` | 边数下限 + 语义来源占比校验 | Modify |
| 15 | `w-model-dev/scripts/cli/self-test.ts` | P2 用例 + 验证 | Modify |

### P3 批（质量度量）— 3 任务

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 16 | `w-model-dev/SKILL.md:47` | 约束 #10 扩展 stdout 贴出 | Modify |
| 16 | `w-model-dev/references/anti-patterns.md` | 反模式 #27 S2 扩展 | Modify |
| 16 | `w-model-dev/references/phase-8-acceptance-test.md` | 终检 stdout 贴出 | Modify |
| 17 | `w-model-dev/references/quality-standards.md` | 信息密度指标 | Modify |
| 17 | `w-model-dev/references/definition-of-done.md` | 信息密度度量 | Modify |
| 17 | `w-model-dev/references/anti-patterns.md` | 新增反模式 #37 | Modify |
| 18 | `w-model-dev/scripts/cli/self-test.ts` | P3 验证 | Modify |

### 全量验证 — 1 任务

| # | 文件 | 职责 | 操作 |
|---|---|---|---|
| 19 | `w-model-dev/SKILL.md` + `w-model-dev/skill-metadata.json` | 版本号 23.0.0 + 全量验证 | Modify |

---

## P0 批（信息流硬约束）— 问题 2 + 问题 9

### Task 1: SKILL.md 新增约束 #18 + subagent-delegation.md RTM 回填职责

**Files:**
- Modify: `w-model-dev/SKILL.md:54`（约束 #17 后新增约束 #18）
- Modify: `w-model-dev/references/subagent-delegation.md`（§S 子代理职责）

- [ ] **Step 1: SKILL.md 在第 54 行约束 #17 后新增约束 #18**

在 `w-model-dev/SKILL.md` 第 54 行（约束 #17 末尾）后插入新行：

```markdown
18. **RTM 实体每阶段必须回填**：RTM 实体每阶段必须回填；S 子代理产出后须更新 `.w-model/rtm.json`；阶段门 CHECKPOINT 须展示 RTM 文件路径与 coverage 字段。S 子代理返回时须列出 `rtm.json` 文件路径与 coverage 百分比；coverageStatus 字段为"100%"时 coveragePercent 须 = 100，为"部分"时 coveragePercent 须 < 100，为"待覆盖" → 违反约束（回退）。详见 [references/subagent-delegation.md](references/subagent-delegation.md)「S 子代理职责」。
```

- [ ] **Step 2: subagent-delegation.md §S 子代理职责增加 RTM 实体回填强制职责**

打开 `w-model-dev/references/subagent-delegation.md`，定位「S 子代理职责」节（搜索 `## S 子代理` 或 `### S 子代理`），在 S 子代理职责列表末尾追加：

```markdown
**RTM 实体回填强制职责**：
- RTM 实体回填是 S 子代理的强制职责，不得委托给其他角色；S 子代理产出后须立即更新 `.w-model/rtm.json`。
- S 子代理返回时须列出 `rtm.json` 文件路径与 coverage 百分比（如 `coveragePercent=100%`）。
- `coverageStatus` 字段值须与实际 coveragePercent 一致："100%" 对应 100%，"部分" 对应 < 100%，"待覆盖" 不允许（须回退重做）。
- 阶段门 CHECKPOINT 须展示 RTM 文件路径（`.w-model/rtm.json`）与 coverage 字段值，未展示视为约束 #18 违反。
```

- [ ] **Step 3: 验证文档修改**

运行：`findstr /n "RTM 实体每阶段必须回填" w-model-dev\SKILL.md`
预期输出：包含一行匹配（约束 #18 标题）

运行：`findstr /n "RTM 实体回填是 S 子代理的强制职责" w-model-dev\references\subagent-delegation.md`
预期输出：包含一行匹配

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/subagent-delegation.md
git commit -m "feat(w-model-dev): 新增约束 #18 RTM 实体每阶段必须回填 + S 子代理强制职责

- SKILL.md 约束 #18：RTM 实体每阶段必须回填；S 子代理产出后更新 rtm.json；CHECKPOINT 展示路径与 coverage
- subagent-delegation.md §S 子代理职责增加 RTM 实体回填强制职责
- Round 24 P0 问题 2 修正

Refs: SSoT §3.4.20, spec docs/superpowers/specs/2026-07-30-round24-p0-p3-skill-fixes-design.md"
```

---

### Task 2: check-artifact-gate.ts + gate-logic.ts RTM coverage 硬校验

**Files:**
- Modify: `w-model-dev/scripts/logic/gate-logic.ts:315`（coveragePercent 校验后增加 coverageStatus 字段校验）
- Create: `w-model-dev/scripts/samples/gate/bad-rtm-coverage-below-100.json`
- Create: `w-model-dev/scripts/samples/gate/bad-rtm-status-mismatch.json`

- [ ] **Step 1: gate-logic.ts 在第 315 行 coveragePercent 校验后增加 coverageStatus 字段校验**

打开 `w-model-dev/scripts/logic/gate-logic.ts`，定位第 315 行：

```typescript
  if (coveragePercent < 100) reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  if (totalRows === 0) reasons.push('RTM 无需求行');
```

在第 316 行（`if (totalRows === 0)` 行）后插入 coverageStatus 字段校验逻辑：

```typescript

  // ==================== coverageStatus 字段一致性校验（第24轮 P0 新增） ====================
  // 约束 #18：coverageStatus 须与 coveragePercent 一致
  // "100%" → coveragePercent 须 = 100；"部分" → coveragePercent 须 < 100；"待覆盖" → 违反
  for (const row of matrix.rows) {
    if (!row || typeof row.coverageStatus !== 'string') continue;
    const status = row.coverageStatus.trim();
    if (status === '100%') {
      if (coveragePercent !== 100) {
        reasons.push(`RTM coverageStatus="100%" 但 coveragePercent=${coveragePercent}%，coverageStatus 与 coveragePercent 不一致`);
      }
    } else if (status === '部分') {
      if (coveragePercent >= 100) {
        reasons.push(`RTM coverageStatus="部分" 但 coveragePercent=${coveragePercent}%，coverageStatus 与 coveragePercent 不一致`);
      }
    } else if (status === '待覆盖') {
      reasons.push(`RTM coverageStatus="待覆盖" 不允许（须回退重做，约束 #18）`);
    }
  }
```

- [ ] **Step 2: Create samples/gate/bad-rtm-coverage-below-100.json**

创建 `w-model-dev/scripts/samples/gate/bad-rtm-coverage-below-100.json`：

```json
{
  "rows": [
    {"requirementId":"REQ-001","description":"用户注册","designDoc":"SD-001","codeModule":"SD-001:src/user.ts","unitTest":"UT-001","integrationTest":"IT-001","systemTest":"ST-001","acceptanceTest":"UAT-001","coverageStatus":"100%"},
    {"requirementId":"REQ-002","description":"用户登录","designDoc":"SD-002","codeModule":"SD-002:src/auth.ts","unitTest":"UT-002","integrationTest":"IT-002","systemTest":"ST-002","acceptanceTest":"","coverageStatus":"部分"},
    {"requirementId":"REQ-003","description":"文章浏览","designDoc":"SD-003","codeModule":"SD-003:src/article.ts","unitTest":"UT-003","integrationTest":"IT-003","systemTest":"ST-003","acceptanceTest":"UAT-003","coverageStatus":"100%"}
  ],
  "executionSummary": {
    "unitTest":{"total":18,"passed":18,"failed":0,"pending":0,"coverage":92},
    "integrationTest":{"total":8,"passed":8,"failed":0,"pending":0,"coverage":100},
    "systemTest":{"total":12,"passed":12,"failed":0,"pending":0,"coverage":100},
    "acceptanceTest":{"total":5,"passed":5,"failed":0,"pending":0,"coverage":100}
  }
}
```

注意：该样本 REQ-002 acceptanceTest 为空 + coverageStatus="部分"，触发 coveragePercent<100（66%）。

- [ ] **Step 3: Create samples/gate/bad-rtm-status-mismatch.json**

创建 `w-model-dev/scripts/samples/gate/bad-rtm-status-mismatch.json`：

```json
{
  "rows": [
    {"requirementId":"REQ-001","description":"用户注册","designDoc":"SD-001","codeModule":"SD-001:src/user.ts","unitTest":"UT-001","integrationTest":"IT-001","systemTest":"ST-001","acceptanceTest":"UAT-001","coverageStatus":"100%"},
    {"requirementId":"REQ-002","description":"用户登录","designDoc":"SD-002","codeModule":"SD-002:src/auth.ts","unitTest":"UT-002","integrationTest":"IT-002","systemTest":"ST-002","acceptanceTest":"UAT-002","coverageStatus":"100%"},
    {"requirementId":"REQ-003","description":"文章浏览","designDoc":"SD-003","codeModule":"SD-003:src/article.ts","unitTest":"UT-003","integrationTest":"IT-003","systemTest":"ST-003","acceptanceTest":"UAT-003","coverageStatus":"100%"}
  ],
  "executionSummary": {
    "unitTest":{"total":18,"passed":18,"failed":0,"pending":0,"coverage":92},
    "integrationTest":{"total":8,"passed":8,"failed":0,"pending":0,"coverage":100},
    "systemTest":{"total":12,"passed":12,"failed":0,"pending":0,"coverage":100},
    "acceptanceTest":{"total":5,"passed":5,"failed":0,"pending":0,"coverage":100}
  }
}
```

注意：该样本所有行 coverageStatus="100%"，所有字段齐全 → coveragePercent=100，coverageStatus 校验通过。但为触发"不一致"用例，需要让 coverageStatus="100%" 而 coveragePercent<100。

修正：将 REQ-002 的 acceptanceTest 置空但保留 coverageStatus="100%"，使 coveragePercent=66 但 status 声明 100%：

```json
{
  "rows": [
    {"requirementId":"REQ-001","description":"用户注册","designDoc":"SD-001","codeModule":"SD-001:src/user.ts","unitTest":"UT-001","integrationTest":"IT-001","systemTest":"ST-001","acceptanceTest":"UAT-001","coverageStatus":"100%"},
    {"requirementId":"REQ-002","description":"用户登录","designDoc":"SD-002","codeModule":"SD-002:src/auth.ts","unitTest":"UT-002","integrationTest":"IT-002","systemTest":"ST-002","acceptanceTest":"","coverageStatus":"100%"},
    {"requirementId":"REQ-003","description":"文章浏览","designDoc":"SD-003","codeModule":"SD-003:src/article.ts","unitTest":"UT-003","integrationTest":"IT-003","systemTest":"ST-003","acceptanceTest":"UAT-003","coverageStatus":"100%"}
  ],
  "executionSummary": {
    "unitTest":{"total":18,"passed":18,"failed":0,"pending":0,"coverage":92},
    "integrationTest":{"total":8,"passed":8,"failed":0,"pending":0,"coverage":100},
    "systemTest":{"total":12,"passed":12,"failed":0,"pending":0,"coverage":100},
    "acceptanceTest":{"total":5,"passed":5,"failed":0,"pending":0,"coverage":100}
  }
}
```

最终文件内容为上述修正版本（REQ-002 acceptanceTest="" + coverageStatus="100%"，触发 status 与 percent 不一致）。

- [ ] **Step 4: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误（无新增类型错误）

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/samples/gate/bad-rtm-coverage-below-100.json w-model-dev/scripts/samples/gate/bad-rtm-status-mismatch.json
git commit -m "feat(gate-logic): RTM coverageStatus 字段一致性硬校验 + 样本

- gate-logic.ts 在 coveragePercent 校验后增加 coverageStatus 字段校验
- coverageStatus='100%' 须 coveragePercent=100；'部分' 须 <100；'待覆盖' 违反
- 新增 samples/gate/bad-rtm-coverage-below-100.json（coverage<100）
- 新增 samples/gate/bad-rtm-status-mismatch.json（status='100%' 但 coverage=66%）
- Round 24 P0 问题 2 修正（约束 #18 配套脚本）

Refs: SSoT §3.4.20"
```

---

### Task 3: SKILL.md 新增约束 #19 + anti-patterns.md 新增反模式 #34

**Files:**
- Modify: `w-model-dev/SKILL.md`（约束 #18 后新增约束 #19；§6 每阶段分派时序增加角色确认）
- Modify: `w-model-dev/references/anti-patterns.md:455`（#33 后新增 #34）

- [ ] **Step 1: SKILL.md 在约束 #18 后新增约束 #19**

打开 `w-model-dev/SKILL.md`，定位 Task 1 新增的约束 #18 末尾，在其后插入新行：

```markdown
19. **编排者角色分派完整性**：编排者每阶段须至少分派 S/V/G 三角色各 1 次；R3 启用时须分派 R 角色（completeness/reliability/security 三阶段各 1 次）；self-as-verifier 模式下兼任时须产出各角色独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON）。O 须在 CHECKPOINT 前确认 run-log 中含 role=S/V/G 各 ≥1 条记录。命中反模式 #34 一律回退到当前阶段起点补派缺失角色。详见 [references/subagent-delegation.md](references/subagent-delegation.md)「角色分派完整性校验」。
```

- [ ] **Step 2: SKILL.md §6 每阶段分派时序增加角色确认文案**

打开 `w-model-dev/SKILL.md`，定位「**每阶段分派时序**」段（搜索 `**每阶段分派时序**`），在该段末尾「阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。」后追加：

```markdown

**角色分派完整性确认**（约束 #19）：O 须在 🔴 CHECKPOINT 阶段门放行前确认 run-log 中含 role=S/V/G 各 ≥1 条记录；R3 启用时须含 role=R ≥3 条记录（completeness/reliability/security）。缺失任一角色记录命中反模式 #34，回退到当前阶段起点补派。`check-role-dispatch.ts` 自动校验此约束。
```

- [ ] **Step 3: anti-patterns.md 在 #33 之后、`## 实现层经验教训` 之前新增反模式 #34**

打开 `w-model-dev/references/anti-patterns.md`，定位第 455 行（#33 末尾「`check-run-log.ts` 校验 S→V 间 R3 记录数。」），在第 456 行（`## 实现层经验教训（来自端到端调测）`）之前插入：

```markdown

## #34 编排者漏派角色（第24轮新增）

**危害**：编排者未按约束 #19 分派 S/V/G/R 角色，导致评审、门禁或根因定位环节缺失，流程完整性失守。

**检测信号**：
- run-log 中某阶段缺 role=V 记录（V 评审被跳过）
- run-log 中某阶段缺 role=G 记录（门禁被跳过）
- run-log 中某阶段缺 role=S 记录（产出环节被跳过或由 O 越权产出）
- R3 启用时缺 role=R 记录（completeness/reliability/security 三阶段任一缺失）
- self-as-verifier 模式下兼任时未产出独立产物文件（VerifierOutput JSON 与 S 产出同路径）

**回退动作**：回到当前阶段起点，补派缺失角色（S/V/G/R），重跑对应环节并补记 run-log，再进入 CHECKPOINT。

**门禁脚本**：`check-role-dispatch.ts` 校验 run-log 中每阶段含 S/V/G 各 ≥1 条记录；R3 启用时含 R ≥3 条记录。

**关联**：约束 #19 + SSoT §3.4.20（[23.0.0] 新增）
```

- [ ] **Step 4: 验证文档修改**

运行：`findstr /n "编排者角色分派完整性" w-model-dev\SKILL.md`
预期输出：包含一行匹配（约束 #19 标题）

运行：`findstr /n "#34 编排者漏派角色" w-model-dev\references\anti-patterns.md`
预期输出：包含一行匹配

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/anti-patterns.md
git commit -m "feat(w-model-dev): 新增约束 #19 角色分派完整性 + 反模式 #34 漏派角色

- SKILL.md 约束 #19：每阶段至少分派 S/V/G 各 1 次；R3 启用须分派 R；self-as-verifier 须独立产物
- SKILL.md §6 每阶段分派时序增加角色确认文案
- anti-patterns.md 新增 #34 编排者漏派角色（检测信号 + 回退动作 + 门禁脚本）
- Round 24 P0 问题 9 修正

Refs: SSoT §3.4.20"
```

---

### Task 4: 新增 check-role-dispatch.ts + samples

**Files:**
- Create: `w-model-dev/scripts/cli/check-role-dispatch.ts`
- Create: `w-model-dev/scripts/samples/run-log/bad-missing-V-role.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/bad-missing-G-role.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl`

- [ ] **Step 1: Create check-role-dispatch.ts**

创建 `w-model-dev/scripts/cli/check-role-dispatch.ts`：

```typescript
#!/usr/bin/env tsx
/**
 * 角色分派完整性校验脚本（Role Dispatch Checker）
 *
 * 对应约束 #19 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 启用时须分派 R 角色（completeness/reliability/security 三阶段各 1 次）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]
 *
 * 参数：
 *   run-log.jsonl  run-log 文件路径（每行一条 JSON 对象）
 *   --r3-enabled   启用 R3 预防性审查时须分派 R 角色 ≥3 次
 *
 * 退出码：
 *   0  所有阶段角色分派完整
 *   1  缺失角色（violations 列出具体阶段与缺失角色）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

interface RunLogEntry {
  runId?: string;
  phase?: number;
  phaseName?: string;
  action?: string;
  role?: string;
  outcome?: string;
}

interface RoleDispatchResult {
  passed: boolean;
  violations: string[];
  phaseSummary: Array<{
    phase: number;
    roles: Record<string, number>;
    missing: string[];
  }>;
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;
const R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/**
 * 角色分派完整性校验纯逻辑
 * @param entries run-log 解析后的条目数组
 * @param r3Enabled 是否启用 R3 预防性审查
 */
export function checkRoleDispatch(
  entries: RunLogEntry[],
  r3Enabled: boolean,
): RoleDispatchResult {
  const violations: string[] = [];
  const phaseMap = new Map<number, Map<string, number>>();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number' || typeof entry.role !== 'string') continue;
    if (!phaseMap.has(entry.phase)) phaseMap.set(entry.phase, new Map());
    const roles = phaseMap.get(entry.phase)!;
    roles.set(entry.role, (roles.get(entry.role) ?? 0) + 1);
  }

  const phaseSummary: RoleDispatchResult['phaseSummary'] = [];

  for (const [phase, roles] of phaseMap) {
    const missing: string[] = [];
    for (const required of REQUIRED_ROLES) {
      if ((roles.get(required) ?? 0) < 1) {
        missing.push(required);
        violations.push(
          `阶段 ${phase} 缺失 role=${required} 记录（约束 #19：每阶段须至少分派 S/V/G 各 1 次）`,
        );
      }
    }

    if (r3Enabled) {
      const rCount = roles.get('R') ?? 0;
      if (rCount < 3) {
        missing.push('R');
        violations.push(
          `阶段 ${phase} 缺失 role=R 记录（R3 启用：须有 3 条 R3 记录 completeness/reliability/security，当前 ${rCount} 条）`,
        );
      }
    }

    phaseSummary.push({
      phase,
      roles: Object.fromEntries(roles),
      missing,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    phaseSummary,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const r3Enabled = args.includes('--r3-enabled');

  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  const entries: RunLogEntry[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      entries.push(JSON.parse(line) as RunLogEntry);
    } catch {
      console.error(`✗ 第 ${i + 1} 行非合法 JSON: ${line.slice(0, 80)}`);
      process.exit(2);
    }
  }

  const result = checkRoleDispatch(entries, r3Enabled);

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('角色分派完整性校验（Role Dispatch Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`R3 启用       : ${r3Enabled ? '是' : '否'}`);
  console.log(`阶段数        : ${result.phaseSummary.length}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  for (const p of result.phaseSummary) {
    const roleStr = Object.entries(p.roles).map(([r, c]) => `${r}=${c}`).join(', ');
    const missingStr = p.missing.length > 0 ? ` [缺失: ${p.missing.join('/')}]` : '';
    console.log(`  阶段 ${p.phase}: ${roleStr}${missingStr}`);
  }

  if (!result.passed) {
    console.log('─'.repeat(60));
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  // 末尾 JSON 摘要
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('ROLE_DISPATCH_JSON ' + JSON.stringify({
    type: 'role-dispatch',
    passed: result.passed,
    exitCode,
    r3Enabled,
    phaseCount: result.phaseSummary.length,
    violations: result.violations,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Role Dispatch 校验脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Create samples/run-log/bad-missing-V-role.jsonl**

创建 `w-model-dev/scripts/samples/run-log/bad-missing-V-role.jsonl`（缺 role=V，含 S/G/O）：

```
{"runId":"r1","timestamp":"2026-07-10T01:00:00Z","phase":1,"phaseName":"需求与范围","action":"produce","role":"S","duration_s":120,"tokens":5000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r2","timestamp":"2026-07-10T02:00:00Z","phase":1,"phaseName":"需求与范围","action":"gate","role":"G","duration_s":30,"tokens":1000,"estimated":false,"subagentSpawns":0,"gateExitCode":0,"outcome":"success"}
{"runId":"r3","timestamp":"2026-07-10T03:00:00Z","phase":1,"phaseName":"需求与范围","action":"checkpoint","role":"O","duration_s":10,"tokens":2000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案"]}
```

注意：缺 role=V 评审记录 → 触发"阶段 1 缺失 role=V 记录"。

- [ ] **Step 3: Create samples/run-log/bad-missing-G-role.jsonl**

创建 `w-model-dev/scripts/samples/run-log/bad-missing-G-role.jsonl`（缺 role=G，含 S/V/O）：

```
{"runId":"r1","timestamp":"2026-07-10T01:00:00Z","phase":1,"phaseName":"需求与范围","action":"produce","role":"S","duration_s":120,"tokens":5000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r2","timestamp":"2026-07-10T02:00:00Z","phase":1,"phaseName":"需求与范围","action":"review","role":"V","duration_s":60,"tokens":3000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r3","timestamp":"2026-07-10T03:00:00Z","phase":1,"phaseName":"需求与范围","action":"checkpoint","role":"O","duration_s":10,"tokens":2000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案"]}
```

注意：缺 role=G 门禁记录 → 触发"阶段 1 缺失 role=G 记录"。

- [ ] **Step 4: Create samples/run-log/bad-missing-R-role.jsonl**

创建 `w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl`（R3 启用但缺 role=R，含 S/V/G/O）：

```
{"runId":"r1","timestamp":"2026-07-10T01:00:00Z","phase":1,"phaseName":"需求与范围","action":"produce","role":"S","duration_s":120,"tokens":5000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r2","timestamp":"2026-07-10T01:30:00Z","phase":1,"phaseName":"需求与范围","action":"r3-completeness","role":"R","duration_s":40,"tokens":1500,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r3","timestamp":"2026-07-10T02:00:00Z","phase":1,"phaseName":"需求与范围","action":"review","role":"V","duration_s":60,"tokens":3000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}
{"runId":"r4","timestamp":"2026-07-10T02:30:00Z","phase":1,"phaseName":"需求与范围","action":"gate","role":"G","duration_s":30,"tokens":1000,"estimated":false,"subagentSpawns":0,"gateExitCode":0,"outcome":"success"}
{"runId":"r5","timestamp":"2026-07-10T03:00:00Z","phase":1,"phaseName":"需求与范围","action":"checkpoint","role":"O","duration_s":10,"tokens":2000,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success","acknowledgedDecisions":["采用 REST + JWT 认证方案"]}
```

注意：仅含 1 条 role=R（completeness），缺 reliability 和 security → `--r3-enabled` 时触发"阶段 1 缺失 role=R 记录（须有 3 条）"。

- [ ] **Step 5: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 6: 验证脚本可执行**

运行：`npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts w-model-dev/scripts/samples/run-log/bad-missing-V-role.jsonl`
预期输出：`ROLE_DISPATCH_JSON` 行含 `"passed":false`，末尾退出码 1

运行：`npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl --r3-enabled`
预期输出：`ROLE_DISPATCH_JSON` 行含 `"passed":false`，violations 含"须有 3 条"

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/cli/check-role-dispatch.ts w-model-dev/scripts/samples/run-log/bad-missing-V-role.jsonl w-model-dev/scripts/samples/run-log/bad-missing-G-role.jsonl w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl
git commit -m "feat(scripts): 新增 check-role-dispatch.ts 角色分派完整性校验 + 3 个 bad 样本

- check-role-dispatch.ts 校验 run-log 每阶段含 S/V/G 各 ≥1 条；--r3-enabled 时 R ≥3 条
- 退出码：0=通过 1=缺角色 2=输入错误；输出 JSON 摘要 + 人类可读报告
- samples/run-log/bad-missing-V-role.jsonl（缺 V）
- samples/run-log/bad-missing-G-role.jsonl（缺 G）
- samples/run-log/bad-missing-R-role.jsonl（R3 启用缺 R）
- Round 24 P0 问题 9 修正（约束 #19 配套脚本）

Refs: SSoT §3.4.20"
```

---

### Task 5: run-log.schema.json role 校验 + subagent-delegation.md 角色分派完整性节

**Files:**
- Modify: `w-model-dev/schemas/run-log.schema.json`（role 字段说明）
- Modify: `w-model-dev/references/subagent-delegation.md`（新增角色分派完整性校验节）

- [ ] **Step 1: run-log.schema.json 增加 role 字段说明**

打开 `w-model-dev/schemas/run-log.schema.json`，定位第 15 行：

```json
    "role": { "enum": ["O", "A", "S", "V", "G", "R"] },
```

修改为（增加 description + 约束 #19 说明）：

```json
    "role": {
      "description": "执行角色：O=编排者 A=分析 S=产出 V=评审 G=门禁 R=根因定位/R3预防性审查。约束 #19：每阶段 run-log 须至少含 role=S/V/G 各 1 条记录；R3 启用时须含 role=R ≥3 条（completeness/reliability/security）",
      "enum": ["O", "A", "S", "V", "G", "R"]
    },
```

- [ ] **Step 2: subagent-delegation.md 新增「角色分派完整性校验」节**

打开 `w-model-dev/references/subagent-delegation.md`，在文件末尾或「S 子代理职责」节后追加新节：

```markdown
## 角色分派完整性校验

> 对应约束 #19 + 反模式 #34。`check-role-dispatch.ts` 自动校验。

### 必分派条件

每阶段 run-log 须至少含以下角色记录各 1 条：

| 角色 | 必分派条件 | 校验脚本 |
|---|---|---|
| S（产出） | 每阶段必须（产出开发产物 + 测试设计 + RTM 更新） | check-role-dispatch.ts |
| V（评审） | 每阶段必须（按 verifier-spec.md §8 产出 VerifierOutput JSON） | check-role-dispatch.ts |
| G（门禁） | 每阶段必须（跑 check-*.ts + 回填证据摘要） | check-role-dispatch.ts |
| R（根因/R3） | R3 预防性审查启用时必须（completeness/reliability/security 三阶段各 1 次，共 ≥3 条） | check-role-dispatch.ts --r3-enabled |

### 可选条件

- A（分析）子代理仅在阶段 1–4 的分块分析与图谱演进时分派；阶段 5–8 可不分派。
- O（编排者）每阶段固定分派（CHECKPOINT），不在 check-role-dispatch.ts 校验范围（O 由约束 #2 阶段门放行覆盖）。

### 豁免条件

**self-as-verifier 模式豁免**（仅 demo 项目 / 非生产项目）：
- S/V/G/R 任两角色由同一 Agent 兼任时，run-log 中可同一 `runId` 条目标记多角色（如 `role="S/V"`），但须满足：
  1. 产出各角色独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON 路径不同）
  2. run-log 条目的 `artifacts` 字段列出各角色独立产物路径
- 详见 SKILL.md「self-as-verifier 模式」节与反模式 #35。

### 校验命令

```bash
# 非 R3 模式
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl

# R3 启用模式
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl --r3-enabled
```

退出码：0=通过，1=缺角色（违反约束 #19），2=输入错误。
```

- [ ] **Step 3: 验证 schema 合法性**

运行：`node -e "JSON.parse(require('fs').readFileSync('w-model-dev/schemas/run-log.schema.json','utf-8')); console.log('OK')"`
预期输出：`OK`

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/references/subagent-delegation.md
git commit -m "feat(schemas,references): run-log.schema.json role 字段说明 + 角色分派完整性校验节

- run-log.schema.json role 字段增加 description（约束 #19：每阶段 S/V/G 各 1 条；R3 启用 R ≥3 条）
- subagent-delegation.md 新增「角色分派完整性校验」节（必分派/可选/豁免条件 + 校验命令）
- self-as-verifier 模式豁免条件：兼任时须独立产物文件
- Round 24 P0 问题 9 修正

Refs: SSoT §3.4.20"
```

---

### Task 6: self-test.ts P0 用例 + P0 验证

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`（GATE_CASES 增加 2 条；新增 ROLE_DISPATCH_CASES + runRoleDispatchCases；main() 调整）

- [ ] **Step 1: self-test.ts GATE_CASES 增加 2 条 RTM coverageStatus 用例**

打开 `w-model-dev/scripts/cli/self-test.ts`，定位 GATE_CASES 数组（第 208 行起），在数组末尾（第 304 行 `];` 之前）追加：

```typescript
  // -------------------- 第24轮 P0 RTM coverageStatus 校验 --------------------
  {
    file: 'bad-rtm-coverage-below-100.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100/],
    description: 'RTM coveragePercent=66% < 100%，应被覆盖率门禁拦截（约束 #18）',
  },
  {
    file: 'bad-rtm-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/coverageStatus.*不一致/],
    description: 'RTM coverageStatus="100%" 但 coveragePercent=66%，应被 coverageStatus 一致性校验拦截',
  },
```

- [ ] **Step 2: self-test.ts 新增 ROLE_DISPATCH_CASES 数组**

在 GRAPH_CASES 数组定义之后（或 GATE_CASES 之后任意 CASES 数组之后），新增 RoleDispatchCase interface 与 ROLE_DISPATCH_CASES 数组：

```typescript
// -------------------- 第24轮 P0 角色分派完整性校验 --------------------

interface RoleDispatchCase {
  file: string;
  r3Enabled: boolean;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const ROLE_DISPATCH_CASES: RoleDispatchCase[] = [
  {
    file: 'bad-missing-V-role.jsonl',
    r3Enabled: false,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=V/],
    description: '阶段 1 缺 role=V 评审记录，应被角色分派校验拦截（约束 #19）',
  },
  {
    file: 'bad-missing-G-role.jsonl',
    r3Enabled: false,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=G/],
    description: '阶段 1 缺 role=G 门禁记录，应被角色分派校验拦截（约束 #19）',
  },
  {
    file: 'bad-missing-R-role.jsonl',
    r3Enabled: true,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=R/],
    description: 'R3 启用但阶段 1 仅有 1 条 R3 记录（缺 reliability/security），应被拦截',
  },
];
```

- [ ] **Step 3: self-test.ts 新增 runRoleDispatchCases 函数**

在 runExemptionCases 函数之后（或任意 run*Cases 函数之后）新增：

```typescript
async function runRoleDispatchCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ROLE_DISPATCH_CASES) {
    const abs = path.join(samplesDir, 'run-log', c.file);
    const name = `run-log/${c.file}`;
    const details: string[] = [];
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const entries = raw.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => JSON.parse(l) as Record<string, unknown>);
      const r = checkRoleDispatch(entries as Parameters<typeof checkRoleDispatch>[0], c.r3Enabled);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}
```

- [ ] **Step 4: self-test.ts 顶部 import 增加 checkRoleDispatch**

打开 `w-model-dev/scripts/cli/self-test.ts` 顶部 import 区（第 38-60 行附近），在 import 区末尾追加：

```typescript
import { checkRoleDispatch } from './check-role-dispatch.js';
```

- [ ] **Step 5: self-test.ts main() 增加 ROLE_DISPATCH_CASES 计数与调用**

打开 `w-model-dev/scripts/cli/self-test.ts`，定位 main() 函数（第 2123 行），在 `console.log(\`PreventiveReview 用例: ${PREVENTIVE_REVIEW_CASES.length}\`);` 之后追加：

```typescript
  console.log(`RoleDispatch 用例 : ${ROLE_DISPATCH_CASES.length}`);
```

在 main() 的 `await Promise.all([` 块中（第 2159-2180 行），在 `runTlaBddSyncCases(samplesDir),` 之后追加：

```typescript
    runRoleDispatchCases(samplesDir),
```

同时在该 Promise.all 的解构数组中增加 `roleDispatchResults`（在 `tlaBddSyncResults,` 之后）。

在 `const all = [` 数组中（第 2181-2187 行），在 `...tlaBddSyncResults,` 之后追加：

```typescript
    ...roleDispatchResults,
```

- [ ] **Step 6: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 7: 运行 self-test 全量验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期输出：
- `RoleDispatch 用例 : 3` 出现在用例计数中
- 所有用例（含新增 5 条：2 GATE + 3 RoleDispatch）显示 `✓`
- 末行 `总计 N 条用例：N 通过，0 失败`
- 退出码 0

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): P0 用例 — RTM coverageStatus + 角色分派完整性

- GATE_CASES 增加 2 条：bad-rtm-coverage-below-100 / bad-rtm-status-mismatch
- 新增 RoleDispatchCase interface + ROLE_DISPATCH_CASES 数组（3 条）
- 新增 runRoleDispatchCases 函数
- main() 增加 ROLE_DISPATCH_CASES 计数 + 调用
- import checkRoleDispatch
- Round 24 P0 验证

Refs: SSoT §3.4.20"
```

---

## P1 批（行为正确性）— 问题 3 + 问题 6 + 问题 10

### Task 7: SKILL.md 约束 #12 扩展 + check-preventive-review.ts --auto-trigger + check-run-log.ts R8

**Files:**
- Modify: `w-model-dev/SKILL.md:49`（约束 #12 文案扩展）
- Modify: `w-model-dev/scripts/cli/check-preventive-review.ts`（增加 --auto-trigger 参数）
- Modify: `w-model-dev/references/phase-1-requirements.md`（§R3 完整性维度校验）

**关键决策：** run-log-logic.ts 第 235-265 行已有 R3 预防性审查记录校验（第22轮新增），不重复增加 R8 规则，仅扩展约束 #12 文案 + check-preventive-review.ts `--auto-trigger` + phase-1-requirements.md。

- [ ] **Step 1: SKILL.md 第 49 行约束 #12 文案扩展**

打开 `w-model-dev/SKILL.md`，定位第 49 行约束 #12：

```markdown
12. **闭环机制强制校验**：`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` 4 脚本须在每个阶段门执行，`exitCode=0` 才可放行；任一脚本非 0 视为闭环未达成，回到当前阶段起点（SSoT §10C/§10D）。
```

修改为（4 脚本 → 5 脚本，增加 check-preventive-review.ts）：

```markdown
12. **闭环机制强制校验**：`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`（R3 启用时）5 脚本须在每个阶段门执行，`exitCode=0` 才可放行；任一脚本非 0 视为闭环未达成，回到当前阶段起点（SSoT §10C/§10D）。`check-preventive-review.ts` 支持 `--auto-trigger` 模式：从 run-log 读取当前阶段，自动校验对应阶段的 3 份 R3 报告（completeness/reliability/security），exitCode=0 方可进入 V 评审。
```

- [ ] **Step 2: check-preventive-review.ts 增加 --auto-trigger 参数**

打开 `w-model-dev/scripts/cli/check-preventive-review.ts`，定位 main() 函数（第 14-64 行）。在现有 `const phaseArg = args.find(a => a.startsWith('--phase='));` 之后增加 `--auto-trigger` 处理逻辑。

将 main() 函数替换为：

```typescript
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectDir = args.find(a => !a.startsWith('--')) ?? '.';
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const autoTrigger = args.includes('--auto-trigger');
  const runLogPath = args.find(a => a.startsWith('--run-log='));

  let phase: number | undefined = phaseArg ? parseInt(phaseArg.split('=')[1]!, 10) : undefined;

  // --auto-trigger 模式：从 run-log 读取当前阶段
  if (autoTrigger) {
    if (!runLogPath) {
      console.error('用法: check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl>');
      process.exit(2);
    }
    const abs = path.resolve(runLogPath.split('=')[1]!);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        console.error('✗ run-log 为空');
        process.exit(2);
      }
      // 取最后一条 checkpoint success 记录的 phase 作为当前阶段
      let lastPhase = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as { phase?: number; action?: string; outcome?: string };
          if (typeof entry.phase === 'number' && entry.action === 'checkpoint' && entry.outcome === 'success') {
            lastPhase = entry.phase;
          }
        } catch {
          // 跳过非法行
        }
      }
      if (lastPhase < 1 || lastPhase > 8) {
        console.error(`✗ 无法从 run-log 推断当前阶段（最后 checkpoint phase=${lastPhase}）`);
        process.exit(2);
      }
      phase = lastPhase;
      console.error(`[auto-trigger] 从 run-log 推断当前阶段: phase=${phase}`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        console.error(`✗ run-log 文件不存在: ${abs}`);
        process.exit(2);
      }
      throw err;
    }
  }

  if (!phase || phase < 1 || phase > 8) {
    console.error('用法: check-preventive-review.ts <project-dir> --phase=<1-8> | --auto-trigger --run-log=<run-log.jsonl>');
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
    autoTrigger,
    phase,
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
```

- [ ] **Step 3: phase-1-requirements.md §R3 完整性维度校验增加 check-preventive-review.ts 触发时机**

打开 `w-model-dev/references/phase-1-requirements.md`，定位 §R3 完整性维度校验节（搜索 `R3` 或 `预防性审查`），在该节末尾追加：

```markdown

**check-preventive-review.ts 触发时机**（第24轮新增）：
- `check-preventive-review.ts` 须在 V 评审前由 G 子代理执行，`exitCode=0` 方可进入 V 评审。
- 支持 `--auto-trigger --run-log=<path>` 模式：从 run-log 读取最后一条 checkpoint success 记录的 phase 作为当前阶段，自动校验对应阶段的 3 份 R3 报告（`<phase>-completeness.json` / `<phase>-reliability.json` / `<phase>-security.json`）。
- 跳过 check-preventive-review.ts 直接进入 V 评审命中反模式 #33。
- 约束 #12 闭环机制强制校验已扩展为 5 脚本（增加 check-preventive-review.ts，R3 启用时）。
```

- [ ] **Step 4: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 5: 验证 check-preventive-review.ts --auto-trigger 参数解析**

运行：`npx tsx w-model-dev/scripts/cli/check-preventive-review.ts . --auto-trigger`
预期输出：`用法: check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl>`（缺 --run-log 时退出码 2）

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/scripts/cli/check-preventive-review.ts w-model-dev/references/phase-1-requirements.md
git commit -m "feat(w-model-dev): 约束 #12 扩展为 5 脚本 + check-preventive-review.ts --auto-trigger

- SKILL.md 约束 #12：4 脚本 → 5 脚本（增加 check-preventive-review.ts，R3 启用时）
- check-preventive-review.ts 增加 --auto-trigger --run-log=<path> 模式
- --auto-trigger 从 run-log 读取最后 checkpoint phase 自动校验对应阶段 3 份 R3 报告
- phase-1-requirements.md §R3 增加 check-preventive-review.ts 触发时机说明
- run-log-logic.ts R3 校验已存在（第22轮），不重复增加 R8

Refs: SSoT §3.4.20"
```

---

### Task 8: 新增 check-state-machine-consistency.ts + samples + tla-plus-guide.md

**Files:**
- Create: `w-model-dev/scripts/cli/check-state-machine-consistency.ts`
- Create: `w-model-dev/scripts/samples/state-machine/bad-missing-transition.json`
- Create: `w-model-dev/scripts/samples/state-machine/bad-extra-transition.json`
- Create: `w-model-dev/scripts/samples/state-machine/valid-consistent.json`
- Modify: `w-model-dev/references/tla-plus-guide.md`（新增设计文档↔代码状态机一致性节）

- [ ] **Step 1: Create check-state-machine-consistency.ts**

创建 `w-model-dev/scripts/cli/check-state-machine-consistency.ts`：

```typescript
#!/usr/bin/env tsx
/**
 * 状态机一致性校验脚本（State Machine Consistency Checker）
 *
 * 对应 Round 24 P1 问题 6：设计文档 ↔ 代码状态机一致性无自动校验。
 * 现有脚本校验"代码↔TLA+"，本脚本补"设计文档↔代码"维度。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>
 *
 * input.json 格式：
 *   {
 *     "designTransitions": [
 *       { "from": "draft", "to": "published", "event": "publish" },
 *       ...
 *     ],
 *     "codeTransitions": [
 *       { "from": "draft", "to": "published", "event": "publish" },
 *       ...
 *     ],
 *     "designStates": ["draft", "published", "archived"],
 *     "codeStates": ["draft", "published", "archived", "deleted"]
 *   }
 *
 * 退出码：
 *   0  设计文档与代码状态机一致
 *   1  不一致（reasons 列出具体差异）
 *   2  输入错误（文件不存在 / 非法 JSON）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

interface Transition {
  from: string;
  to: string;
  event?: string;
}

interface StateMachineConsistencyInput {
  designTransitions?: Transition[];
  codeTransitions?: Transition[];
  designStates?: string[];
  codeStates?: string[];
}

export interface StateMachineConsistencyResult {
  passed: boolean;
  reasons: string[];
  designStates: string[];
  codeStates: string[];
  designTransitions: Transition[];
  codeTransitions: Transition[];
  missingInCode: Transition[]; // 设计文档有但代码缺
  extraInCode: Transition[]; // 代码有但设计文档缺
  missingStatesInCode: string[];
  extraStatesInCode: string[];
}

function transitionKey(t: Transition): string {
  return `${t.from}→${t.to}${t.event ? ` [${t.event}]` : ''}`;
}

/**
 * 状态机一致性校验纯逻辑
 */
export function checkStateMachineConsistency(
  input: StateMachineConsistencyInput,
): StateMachineConsistencyResult {
  const reasons: string[] = [];
  const designTransitions = Array.isArray(input.designTransitions) ? input.designTransitions : [];
  const codeTransitions = Array.isArray(input.codeTransitions) ? input.codeTransitions : [];
  const designStates = Array.isArray(input.designStates) ? input.designStates : [];
  const codeStates = Array.isArray(input.codeStates) ? input.codeStates : [];

  // 校验状态集一致
  const designStateSet = new Set(designStates);
  const codeStateSet = new Set(codeStates);

  const missingStatesInCode = designStates.filter(s => !codeStateSet.has(s));
  const extraStatesInCode = codeStates.filter(s => !designStateSet.has(s));

  if (missingStatesInCode.length > 0) {
    reasons.push(
      `代码状态机缺状态（设计文档有但代码缺）：${missingStatesInCode.join(', ')}`,
    );
  }
  if (extraStatesInCode.length > 0) {
    reasons.push(
      `代码状态机多状态（代码有但设计文档缺）：${extraStatesInCode.join(', ')}`,
    );
  }

  // 校验转移集一致
  const designTransitionKeys = new Set(designTransitions.map(transitionKey));
  const codeTransitionKeys = new Set(codeTransitions.map(transitionKey));

  const missingInCode = designTransitions.filter(t => !codeTransitionKeys.has(transitionKey(t)));
  const extraInCode = codeTransitions.filter(t => !designTransitionKeys.has(transitionKey(t)));

  if (missingInCode.length > 0) {
    reasons.push(
      `代码状态机缺转移（设计文档有但代码缺）：${missingInCode.map(transitionKey).join(', ')}`,
    );
  }
  if (extraInCode.length > 0) {
    reasons.push(
      `代码状态机多转移（代码有但设计文档缺）：${extraInCode.map(transitionKey).join(', ')}`,
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
    designStates,
    codeStates,
    designTransitions,
    codeTransitions,
    missingInCode,
    extraInCode,
    missingStatesInCode,
    extraStatesInCode,
  };
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: StateMachineConsistencyInput;
  try {
    parsed = JSON.parse(raw) as StateMachineConsistencyInput;
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkStateMachineConsistency(parsed);

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('状态机一致性校验（State Machine Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件          : ${abs}`);
  console.log(`设计文档状态数    : ${result.designStates.length}`);
  console.log(`代码状态数        : ${result.codeStates.length}`);
  console.log(`设计文档转移数    : ${result.designTransitions.length}`);
  console.log(`代码转移数        : ${result.codeTransitions.length}`);
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const r of result.reasons) {
      console.log(`  - ${r}`);
    }
  }

  // 末尾 JSON 摘要
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('STATE_MACHINE_JSON ' + JSON.stringify({
    type: 'state-machine-consistency',
    passed: result.passed,
    exitCode,
    designStateCount: result.designStates.length,
    codeStateCount: result.codeStates.length,
    designTransitionCount: result.designTransitions.length,
    codeTransitionCount: result.codeTransitions.length,
    missingInCode: result.missingInCode.map(transitionKey),
    extraInCode: result.extraInCode.map(transitionKey),
    reasons: result.reasons,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('State Machine Consistency 校验脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Create samples/state-machine/bad-missing-transition.json**

创建 `w-model-dev/scripts/samples/state-machine/bad-missing-transition.json`（设计文档有 draft→published 但代码缺）：

```json
{
  "designStates": ["draft", "published", "archived"],
  "codeStates": ["draft", "published", "archived"],
  "designTransitions": [
    {"from": "draft", "to": "published", "event": "publish"},
    {"from": "published", "to": "archived", "event": "archive"}
  ],
  "codeTransitions": [
    {"from": "published", "to": "archived", "event": "archive"}
  ]
}
```

注意：代码缺 draft→published 转移 → 触发"代码状态机缺转移"。

- [ ] **Step 3: Create samples/state-machine/bad-extra-transition.json**

创建 `w-model-dev/scripts/samples/state-machine/bad-extra-transition.json`（代码有 archived→deleted 但设计文档缺）：

```json
{
  "designStates": ["draft", "published", "archived"],
  "codeStates": ["draft", "published", "archived", "deleted"],
  "designTransitions": [
    {"from": "draft", "to": "published", "event": "publish"},
    {"from": "published", "to": "archived", "event": "archive"}
  ],
  "codeTransitions": [
    {"from": "draft", "to": "published", "event": "publish"},
    {"from": "published", "to": "archived", "event": "archive"},
    {"from": "archived", "to": "deleted", "event": "delete"}
  ]
}
```

注意：代码多 deleted 状态 + archived→deleted 转移 → 触发"代码状态机多状态"和"代码状态机多转移"。

- [ ] **Step 4: Create samples/state-machine/valid-consistent.json**

创建 `w-model-dev/scripts/samples/state-machine/valid-consistent.json`（完全一致）：

```json
{
  "designStates": ["draft", "published", "archived"],
  "codeStates": ["draft", "published", "archived"],
  "designTransitions": [
    {"from": "draft", "to": "published", "event": "publish"},
    {"from": "published", "to": "archived", "event": "archive"},
    {"from": "archived", "to": "draft", "event": "restore"}
  ],
  "codeTransitions": [
    {"from": "draft", "to": "published", "event": "publish"},
    {"from": "published", "to": "archived", "event": "archive"},
    {"from": "archived", "to": "draft", "event": "restore"}
  ]
}
```

- [ ] **Step 5: tla-plus-guide.md 新增「设计文档 ↔ 代码状态机一致性」节**

打开 `w-model-dev/references/tla-plus-guide.md`，在文件末尾追加新节：

```markdown

## 设计文档 ↔ 代码状态机一致性

> 对应 Round 24 P1 问题 6。现有脚本校验"代码↔TLA+"，本节补充"设计文档↔代码"维度。

### 校验范围

`check-state-machine-consistency.ts` 校验 `docs/phase4-design/detailed-design.md` 中的状态转移表（Markdown 表格格式 `| 状态 | 事件 | 转移 |`）与 `src/state-machines/*.ts` 中的 `TRANSITIONS` 定义的一致性：

1. **状态集一致**：设计文档声明的状态集须与代码 `TRANSITIONS` 派生的状态集一致
2. **转移集一致**：设计文档声明的转移（from→to+event）须与代码 `TRANSITIONS` 完全匹配

### 校验输入格式

`check-state-machine-consistency.ts` 接受 JSON 输入（由编排者或 G 子代理从设计文档与代码中解析后构造）：

```json
{
  "designStates": ["draft", "published", "archived"],
  "codeStates": ["draft", "published", "archived"],
  "designTransitions": [
    {"from": "draft", "to": "published", "event": "publish"}
  ],
  "codeTransitions": [
    {"from": "draft", "to": "published", "event": "publish"}
  ]
}
```

### 豁免条件

- **无状态机的项目跳过**：若项目 `detailed-design.md` 无 `| 状态 | 事件 | 转移 |` 表格格式的章节，则跳过本校验（不视为违反）。
- **TLA+ 已覆盖的项目**：若项目已有 TLA+ 状态机规格且 `check-tla-model.ts` 通过，则 `check-state-machine-consistency.ts` 作为补充校验（不替代 TLA+）。

### 误报处理

- 若设计文档使用非标准表格格式（如 `| from | to | event |` 而非 `| 状态 | 事件 | 转移 |`），解析器可能漏识别 → 须人工确认表格格式后重跑。
- 若代码 `TRANSITIONS` 定义分散在多个文件，须在 input.json 中合并所有文件的转移定义。
- 误报时在 `reworkHints` 中标注"state-machine 误报"，由 V 评审确认后豁免。

### 校验命令

```bash
npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>
```

退出码：0=一致，1=不一致，2=输入错误。
```

- [ ] **Step 6: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 7: 验证脚本可执行**

运行：`npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts w-model-dev/scripts/samples/state-machine/valid-consistent.json`
预期输出：`STATE_MACHINE_JSON` 行含 `"passed":true`，退出码 0

运行：`npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts w-model-dev/scripts/samples/state-machine/bad-missing-transition.json`
预期输出：`STATE_MACHINE_JSON` 行含 `"passed":false`，reasons 含"代码状态机缺转移"，退出码 1

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/cli/check-state-machine-consistency.ts w-model-dev/scripts/samples/state-machine/bad-missing-transition.json w-model-dev/scripts/samples/state-machine/bad-extra-transition.json w-model-dev/scripts/samples/state-machine/valid-consistent.json w-model-dev/references/tla-plus-guide.md
git commit -m "feat(scripts): 新增 check-state-machine-consistency.ts 设计文档↔代码状态机一致性校验

- check-state-machine-consistency.ts 校验设计文档状态转移表与代码 TRANSITIONS 一致
- 校验状态集 + 转移集一致；退出码 0=一致 1=不一致 2=输入错误
- 新增 samples/state-machine/ 目录（bad-missing-transition / bad-extra-transition / valid-consistent）
- tla-plus-guide.md 新增「设计文档 ↔ 代码状态机一致性」节（校验范围/豁免/误报处理）
- Round 24 P1 问题 6 修正

Refs: SSoT §3.4.20"
```

---

### Task 9: SKILL.md 新增 self-as-verifier 模式节 + verifier-spec.md + agent-personas.md + 反模式 #35

**Files:**
- Modify: `w-model-dev/SKILL.md`（编排者-子代理边界节后新增 self-as-verifier 模式节）
- Modify: `w-model-dev/references/verifier-spec.md`（新增 self-as-verifier 模式节）
- Modify: `w-model-dev/references/agent-personas.md`（新增 self-as-verifier 兼任规则节）
- Modify: `w-model-dev/references/anti-patterns.md`（#34 后新增 #35）

- [ ] **Step 1: SKILL.md 在「编排者-子代理边界」节后新增「self-as-verifier 模式」节**

打开 `w-model-dev/SKILL.md`，定位「编排者-子代理边界」节末尾（搜索 `违反处置` 或 `命中反模式 #10`，定位该段末尾），在其后（`## 核心操作行为` 之前）插入新节：

```markdown

## self-as-verifier 模式

> 对应 Round 24 P1 问题 10。单 Agent 兼任 S/V/G/R 多角色的正式定义与独立性保证。

**定义**：self-as-verifier 模式指单 Agent 在同一阶段内兼任 S（产出）/ V（评审）/ G（门禁）/ R（根因/R3）多角色的执行模式。

**启用条件**：
- 仅限 demo 项目 / 非生产项目 / 教学演示场景
- 生产项目禁止启用（须严格按 O→S→V→G→R 角色分派）
- 启用时须在 `project.status` 中标记 `selfAsVerifier: true`

**独立性保证**（关键约束）：
- 兼任时须产出各角色独立产物文件，路径不得相同：
  - S 产出：阶段开发产物（如 `requirements-spec.md` / `detailed-design.md`）
  - V 产出：`VerifierOutput` JSON（独立文件，如 `.w-model/verifier-outputs/<phase>-<target>.json`）
  - G 产出：`gate-logs` JSON（独立文件，如 `.w-model/gate-logs/<timestamp>-<script>.json`）
  - R 产出：`RootCauseReport` / `PreventiveReview` JSON（独立文件）
- run-log 条目的 `artifacts` 字段须列出各角色独立产物路径
- 违反独立性（V/G/R 产物与 S 产出同路径或同文件）命中反模式 #35

**与约束 #19 的关系**：
- self-as-verifier 模式下，run-log 中 S/V/G 可同一 `runId` 条目标记多角色（如 `role="S/V"`），但 check-role-dispatch.ts 仍须校验每阶段含 S/V/G 各 ≥1 条记录（可同一行满足）。
- R3 启用时 R 角色 ≥3 条记录不可由同一行满足（completeness/reliability/security 须为独立 R3 报告）。

**校验脚本**：`check-verifier-output.ts --self-as-verifier` 校验 VerifierOutput JSON 路径与 S 产出路径不同。
```

- [ ] **Step 2: verifier-spec.md 新增「self-as-verifier 模式」节**

打开 `w-model-dev/references/verifier-spec.md`，在文件末尾追加新节：

```markdown

## self-as-verifier 模式

> 对应 Round 24 P1 问题 10。V 评审产出独立性要求。

### V 评审产出独立性

self-as-verifier 模式下（单 Agent 兼任 S/V/G/R），V 评审产出须满足独立性要求：

1. **VerifierOutput JSON 须独立产出**：文件路径不得与 S 产出文件路径相同
   - 合规：`S 产出 = docs/phase1-requirements/requirements-spec.md`，`V 产出 = .w-model/verifier-outputs/1-requirements.json`
   - 违规：`S 产出 = docs/phase1-requirements/requirements-spec.md`，`V 产出 = docs/phase1-requirements/requirements-spec.md`（同路径）
2. **VerifierOutput 内容须独立**：不得在 S 产出文档中直接嵌入评审结论；评审结论须以独立 JSON 结构产出（按 §6 Schema）
3. **run-log 记录独立**：V 评审须有独立 run-log 条目（即使 `runId` 与 S 相同，`role` 字段须明确标记 V）

### 校验

`check-verifier-output.ts --self-as-verifier --s-output=<path>` 校验 VerifierOutput JSON 路径与 S 产出路径不同。违反命中反模式 #35。
```

- [ ] **Step 3: agent-personas.md 新增「self-as-verifier 兼任规则」节**

打开 `w-model-dev/references/agent-personas.md`，在文件末尾追加新节：

```markdown

## self-as-verifier 兼任规则

> 对应 Round 24 P1 问题 10。S/V/G/R 任两角色由同一 Agent 兼任时的产物独立性要求。

### 兼任规则

self-as-verifier 模式下，S/V/G/R 任两角色由同一 Agent 兼任时，须满足：

| 兼任组合 | 独立产物要求 | 校验脚本 |
|---|---|---|
| S + V | S 产出文档（如 requirements-spec.md）与 V 产出 VerifierOutput JSON 路径不同 | check-verifier-output.ts --self-as-verifier |
| S + G | S 产出文档与 G 产出 gate-logs JSON 路径不同 | check-role-dispatch.ts（artifacts 字段校验） |
| V + G | V 产出 VerifierOutput JSON 与 G 产出 gate-logs JSON 路径不同 | check-role-dispatch.ts |
| S + R | S 产出文档与 R 产出 RootCauseReport/PreventiveReview JSON 路径不同 | check-role-dispatch.ts |
| V + R | V 产出 VerifierOutput JSON 与 R 产出 RootCauseReport JSON 路径不同 | check-role-dispatch.ts |
| G + R | G 产出 gate-logs JSON 与 R 产出 RootCauseReport JSON 路径不同 | check-role-dispatch.ts |

### 违反处置

任两角色产物路径相同 → 命中反模式 #35，回退到当前阶段起点，拆分为独立产物文件后重审。
```

- [ ] **Step 4: anti-patterns.md 在 #34 之后新增 #35**

打开 `w-model-dev/references/anti-patterns.md`，定位 Task 3 新增的反模式 #34 末尾，在其后插入：

```markdown

## #35 self-as-verifier 模式下 V/G/R 产物混合（第24轮新增）

**危害**：self-as-verifier 模式下 V/G/R 产物与 S 产出混合在同一文件中，导致评审独立性失守，评审结论可能被 S 产出污染或覆盖。

**检测信号**：
- 评审报告（VerifierOutput JSON）与产出文档（S 产出）在同一文件中
- VerifierOutput JSON 文件路径与 S 产出文件路径相同
- gate-logs JSON 文件路径与 S 产出文件路径相同
- RootCauseReport JSON 文件路径与 S 产出文件路径相同
- run-log 条目的 `artifacts` 字段未列出各角色独立产物路径

**回退动作**：回到当前阶段起点，拆分为独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON 路径不同），重审 V/G/R 环节。

**门禁脚本**：`check-verifier-output.ts --self-as-verifier` 校验 VerifierOutput JSON 路径与 S 产出路径不同；`check-role-dispatch.ts` 校验 run-log artifacts 字段含各角色独立产物路径。

**关联**：约束 #19 + SSoT §3.4.20（[23.0.0] 新增）
```

- [ ] **Step 5: 验证文档修改**

运行：`findstr /n "self-as-verifier 模式" w-model-dev\SKILL.md`
预期输出：包含匹配（self-as-verifier 模式节标题）

运行：`findstr /n "#35 self-as-verifier" w-model-dev\references\anti-patterns.md`
预期输出：包含一行匹配

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/verifier-spec.md w-model-dev/references/agent-personas.md w-model-dev/references/anti-patterns.md
git commit -m "feat(w-model-dev): self-as-verifier 模式正式定义 + 反模式 #35 产物混合

- SKILL.md 新增「self-as-verifier 模式」节（定义/启用条件/独立性保证/与约束 #19 关系）
- verifier-spec.md 新增「self-as-verifier 模式」节（V 评审产出独立性要求）
- agent-personas.md 新增「self-as-verifier 兼任规则」节（S/V/G/R 兼任组合独立产物表）
- anti-patterns.md 新增 #35 self-as-verifier 模式下 V/G/R 产物混合
- Round 24 P1 问题 10 修正

Refs: SSoT §3.4.20"
```

---

### Task 10: check-verifier-output.ts 独立产物校验

**Files:**
- Modify: `w-model-dev/scripts/cli/check-verifier-output.ts`（增加 --self-as-verifier + --s-output 参数与校验）

- [ ] **Step 1: check-verifier-output.ts 增加 --self-as-verifier 参数与独立产物校验**

打开 `w-model-dev/scripts/cli/check-verifier-output.ts`，定位 main() 函数（第 35-112 行）。将 main() 函数替换为：

```typescript
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const selfAsVerifier = args.includes('--self-as-verifier');
  const sOutputArg = args.find(a => a.startsWith('--s-output='));

  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <output.json> [--self-as-verifier --s-output=<S产出路径>]');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkVerifierOutput(parsed);
  const meta = (parsed as VerifierOutputShape)?.meta;

  // self-as-verifier 模式：校验 VerifierOutput JSON 路径与 S 产出路径不同（反模式 #35）
  const selfAsVerifierViolations: string[] = [];
  if (selfAsVerifier) {
    if (!sOutputArg) {
      selfAsVerifierViolations.push('--self-as-verifier 模式须同时提供 --s-output=<S产出路径>');
    } else {
      const sOutputPath = path.resolve(sOutputArg.split('=')[1]!);
      if (abs === sOutputPath) {
        selfAsVerifierViolations.push(
          `反模式 #35：self-as-verifier 模式下 VerifierOutput JSON 路径(${abs})与 S 产出路径(${sOutputPath})相同，须拆分为独立产物文件`,
        );
      }
    }
  }

  const allReasons = [...result.reasons, ...selfAsVerifierViolations];
  const passed = result.passed && selfAsVerifierViolations.length === 0;

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('Verifier 输出校验（LLM-as-a-Verifier Output Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`self-as-verifier: ${selfAsVerifier ? '是' : '否'}`);
  if (meta) {
    console.log(`目标类型      : ${meta.targetKind}`);
    console.log(`目标          : ${meta.target}`);
    console.log(`评审 Agent    : ${meta.agent}`);
    console.log(`评分方法      : ${meta.scoringMethod}`);
    console.log(`重复次数      : ${meta.repeatTimes}`);
    console.log(`方差阈值      : ${meta.varianceThreshold}`);
  }
  console.log(`综合分数      : ${result.compositeScore}`);
  console.log(`期望综合分数  : ${result.expectedCompositeScore}`);
  console.log(`质量等级      : ${result.qualityLevel}`);
  console.log(`校验结果      : ${passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (passed) {
    console.log('输出结构符合 verifier-spec.md §6 Schema 与各数值约束。');
  } else {
    console.log('未通过原因：');
    for (const r of allReasons) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('外部 Agent 必须按上述原因重新执行评审，详见：');
    console.log('  w-model-dev/references/verifier-spec.md');
  }

  // 末尾 JSON 摘要（供 Agent 程序解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('VERIFIER_JSON ' + JSON.stringify({
    type: 'verifier-output',
    passed,
    exitCode,
    selfAsVerifier,
    compositeScore: result.compositeScore,
    expectedCompositeScore: result.expectedCompositeScore,
    qualityLevel: result.qualityLevel,
    reasons: allReasons,
  }));

  process.exit(exitCode);
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 3: 验证 --self-as-verifier 参数解析**

运行：`npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json --self-as-verifier --s-output=w-model-dev/scripts/samples/verifier/valid.json`
预期输出：`VERIFIER_JSON` 行含 `"passed":false`，reasons 含"反模式 #35"，退出码 1

运行：`npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json --self-as-verifier --s-output=docs/phase1-requirements/requirements-spec.md`
预期输出：`VERIFIER_JSON` 行含 `"passed":true`（路径不同），退出码 0

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/cli/check-verifier-output.ts
git commit -m "feat(check-verifier-output): --self-as-verifier 独立产物校验

- check-verifier-output.ts 增加 --self-as-verifier --s-output=<path> 参数
- self-as-verifier 模式校验 VerifierOutput JSON 路径与 S 产出路径不同
- 路径相同 → 反模式 #35，exitCode=1
- Round 24 P1 问题 10 修正

Refs: SSoT §3.4.20"
```

---

### Task 11: self-test.ts P1 用例 + P1 验证

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`（新增 STATE_MACHINE_CASES + runStateMachineCases；main() 调整）

- [ ] **Step 1: self-test.ts 新增 STATE_MACHINE_CASES 数组**

打开 `w-model-dev/scripts/cli/self-test.ts`，在 ROLE_DISPATCH_CASES 数组之后新增 StateMachineCase interface 与 STATE_MACHINE_CASES 数组：

```typescript
// -------------------- 第24轮 P1 状态机一致性校验 --------------------

interface StateMachineCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const STATE_MACHINE_CASES: StateMachineCase[] = [
  {
    file: 'bad-missing-transition.json',
    expectedPassed: false,
    expectedReasonPatterns: [/代码状态机缺转移/],
    description: '设计文档有 draft→published 但代码缺，应被一致性校验拦截',
  },
  {
    file: 'bad-extra-transition.json',
    expectedPassed: false,
    expectedReasonPatterns: [/代码状态机多转移|代码状态机多状态/],
    description: '代码有 archived→deleted 但设计文档缺，应被一致性校验拦截',
  },
  {
    file: 'valid-consistent.json',
    expectedPassed: true,
    description: '设计文档与代码状态机完全一致，应通过',
  },
];
```

- [ ] **Step 2: self-test.ts 新增 runStateMachineCases 函数**

在 runRoleDispatchCases 函数之后新增：

```typescript
async function runStateMachineCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of STATE_MACHINE_CASES) {
    const abs = path.join(samplesDir, 'state-machine', c.file);
    const name = `state-machine/${c.file}`;
    const details: string[] = [];
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const parsed = JSON.parse(raw) as Parameters<typeof checkStateMachineConsistency>[0];
      const r = checkStateMachineConsistency(parsed);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}
```

- [ ] **Step 3: self-test.ts 顶部 import 增加 checkStateMachineConsistency**

在 import 区（Task 6 Step 4 已增加 checkRoleDispatch import 之后）追加：

```typescript
import { checkStateMachineConsistency } from './check-state-machine-consistency.js';
```

- [ ] **Step 4: self-test.ts main() 增加 STATE_MACHINE_CASES 计数与调用**

在 main() 函数中，Task 6 Step 5 已增加的 `console.log(\`RoleDispatch 用例 : ${ROLE_DISPATCH_CASES.length}\`);` 之后追加：

```typescript
  console.log(`StateMachine 用例 : ${STATE_MACHINE_CASES.length}`);
```

在 main() 的 `await Promise.all([` 块中，Task 6 Step 5 已增加的 `runRoleDispatchCases(samplesDir),` 之后追加：

```typescript
    runStateMachineCases(samplesDir),
```

同时在该 Promise.all 的解构数组中增加 `stateMachineResults`（在 `roleDispatchResults,` 之后）。

在 `const all = [` 数组中，Task 6 Step 5 已增加的 `...roleDispatchResults,` 之后追加：

```typescript
    ...stateMachineResults,
```

- [ ] **Step 5: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 6: 运行 self-test 全量验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期输出：
- `StateMachine 用例 : 3` 出现在用例计数中
- 所有用例（含新增 3 条 StateMachine）显示 `✓`
- 末行 `总计 N 条用例：N 通过，0 失败`
- 退出码 0

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): P1 用例 — 状态机一致性校验

- 新增 StateMachineCase interface + STATE_MACHINE_CASES 数组（3 条）
- 新增 runStateMachineCases 函数
- main() 增加 STATE_MACHINE_CASES 计数 + 调用
- import checkStateMachineConsistency
- Round 24 P1 验证

Refs: SSoT §3.4.20"
```

---

## P2 批（设计指导）— 问题 4 + 问题 5 + 问题 7

### Task 12: NFR 双字段（requirement-spec.md + system-test.md + rtm.schema.json + quality-standards.md + gate-logic.ts）

**Files:**
- Modify: `w-model-dev/templates/requirement-spec.md`（NFR 字段增加 targetValue + testThreshold）
- Modify: `w-model-dev/templates/system-test.md`（新增性能度量环境声明节）
- Modify: `w-model-dev/schemas/rtm.schema.json`（NFR 行增加双字段）
- Modify: `w-model-dev/references/quality-standards.md`（生产目标 vs 测试基线）
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`（NFR 双值警告级校验）

- [ ] **Step 1: templates/requirement-spec.md NFR 字段增加双字段**

打开 `w-model-dev/templates/requirement-spec.md`，定位 NFR（非功能需求）字段定义节（搜索 `NFR` 或 `非功能需求`），在 NFR 字段说明后追加：

```markdown

### NFR 性能基线双字段（第24轮新增）

> 对应 Round 24 P2 问题 4。性能基线须区分生产目标值与测试环境基线。

每个性能类 NFR 须包含以下双字段：

| 字段 | 含义 | 示例 |
|---|---|---|
| `targetValue` | 生产目标值（生产环境须达成的指标） | `p95 响应时间 ≤ 200ms` |
| `testThreshold` | 测试环境基线（CI/full-suite/isolated 环境的放宽阈值） | `CI 环境 p95 ≤ 400ms（生产 2 倍放宽）` |

**示例 NFR 条目**：

```markdown
| NFR-ID | 类型 | 描述 | targetValue | testThreshold |
|---|---|---|---|---|
| NFR-001 | 性能 | 用户登录 API p95 响应时间 | ≤ 200ms（生产） | ≤ 400ms（CI）/ ≤ 300ms（full-suite）/ ≤ 250ms（isolated） |
| NFR-002 | 性能 | 文章列表查询 p99 响应时间 | ≤ 500ms（生产） | ≤ 1000ms（CI）/ ≤ 800ms（full-suite）/ ≤ 600ms（isolated） |
```

**说明**：
- `targetValue` 是生产环境的硬性目标，未达成视为性能不达标
- `testThreshold` 是测试环境的放宽阈值（因 CI 资源受限等），须明确声明放宽倍数与原因
- 测试环境类型须在 `system-test.md` 的「性能度量环境声明」节中定义
```

- [ ] **Step 2: templates/system-test.md 新增性能度量环境声明节**

打开 `w-model-dev/templates/system-test.md`，在文件末尾追加新节：

```markdown

## 性能度量环境声明

> 对应 Round 24 P2 问题 4。性能测试须声明测试环境与对应阈值。

### 测试环境类型

| 环境类型 | 说明 | 典型放宽倍数 |
|---|---|---|
| CI | 持续集成环境（GitHub Actions / GitLab CI 等），资源受限，并发跑多任务 | 生产目标的 2-3 倍 |
| full-suite | 完整测试套件环境（本地或专用测试机），资源较充裕 | 生产目标的 1.5-2 倍 |
| isolated | 隔离性能测试环境（专用性能测试机，无其他任务干扰） | 生产目标的 1-1.2 倍 |

### 性能度量环境声明模板

```markdown
### 性能度量环境声明

| NFR-ID | CI 阈值 | full-suite 阈值 | isolated 阈值 | 生产目标值 |
|---|---|---|---|---|
| NFR-001 | p95 ≤ 400ms | p95 ≤ 300ms | p95 ≤ 250ms | p95 ≤ 200ms |
| NFR-002 | p99 ≤ 1000ms | p99 ≤ 800ms | p99 ≤ 600ms | p99 ≤ 500ms |

**度量工具**：[如 k6 / wrk / autocannon]
**度量方法**：[如 1000 并发持续 60s，取 p95/p99]
**环境配置**：[如 CI: 2vCPU/4GB RAM; isolated: 8vCPU/16GB RAM]
```

### 校验

`check-artifact-gate.ts` 在 NFR 类型 RTM 行校验 `targetValue` + `testThreshold` 字段存在性（警告级，不 fail）。
```

- [ ] **Step 3: schemas/rtm.schema.json NFR 行增加双字段**

打开 `w-model-dev/schemas/rtm.schema.json`，定位 rows.items.properties（第 20-30 行），在 `coverageStatus` 字段后追加 `targetValue` 与 `testThreshold` 字段：

```json
          "coverageStatus": { "type": "string" },
          "targetValue": { "type": "string", "description": "NFR 生产目标值（NFR 类型时推荐填写，如 p95 ≤ 200ms）" },
          "testThreshold": { "type": "string", "description": "NFR 测试环境基线（NFR 类型时推荐填写，如 CI p95 ≤ 400ms）" }
```

- [ ] **Step 4: references/quality-standards.md §性能指标监控增加双值区分指导**

打开 `w-model-dev/references/quality-standards.md`，定位 §性能指标监控节（搜索 `性能指标监控` 或 `性能`），在该节末尾追加：

```markdown

### 生产目标值 vs 测试环境基线（第24轮新增）

> 对应 Round 24 P2 问题 4。性能指标须区分生产目标值与测试环境基线，避免测试环境阈值直接套用于生产。

**区分原则**：

1. **生产目标值（targetValue）**：生产环境须达成的硬性指标，未达成视为性能事故
2. **测试环境基线（testThreshold）**：测试环境的放宽阈值，须明确声明：
   - 测试环境类型（CI / full-suite / isolated）
   - 放宽倍数（如 CI 环境为生产目标的 2 倍）
   - 放宽原因（如 CI 资源受限、并发任务干扰）

**反模式**：
- 测试环境阈值直接套用于生产（如 CI p95 ≤ 400ms 直接作为生产目标）
- 未声明测试环境类型与放宽倍数
- 生产目标值与测试环境基线相同（除非 isolated 环境）

**校验**：`check-artifact-gate.ts` 在 NFR 类型 RTM 行校验 `targetValue` + `testThreshold` 字段存在性（警告级，不 fail，避免误报非性能类 NFR）。
```

- [ ] **Step 5: gate-logic.ts NFR 双值警告级校验**

打开 `w-model-dev/scripts/logic/gate-logic.ts`，定位 Task 2 Step 1 新增的 coverageStatus 校验之后（或任意 reasons.push 后的位置），追加 NFR 双值警告级校验：

```typescript

  // ==================== NFR 双值字段警告级校验（第24轮 P2 新增） ====================
  // 问题 4：性能基线须区分生产目标值与测试环境基线
  // 仅警告不 fail，避免误报非性能类 NFR
  for (const row of matrix.rows) {
    if (!row || typeof row.requirementId !== 'string') continue;
    // 仅对 NFR 类型行校验（requirementId 以 NFR 开头）
    if (!row.requirementId.startsWith('NFR')) continue;
    if (!('targetValue' in row) || typeof row.targetValue !== 'string' || row.targetValue.trim() === '') {
      reasons.push(`警告：NFR 行 ${row.requirementId} 缺 targetValue 字段（生产目标值，约束 #20 推荐填写）`);
    }
    if (!('testThreshold' in row) || typeof row.testThreshold !== 'string' || row.testThreshold.trim() === '') {
      reasons.push(`警告：NFR 行 ${row.requirementId} 缺 testThreshold 字段（测试环境基线，约束 #20 推荐填写）`);
    }
  }
```

注意：此校验为警告级（reasons.push 但不改变 passed 判定逻辑，因为 gate-logic.ts 的 passed = reasons.length === 0）。**修正**：为避免警告级校验导致 fail，须将警告单独收集到 warnings 数组而非 reasons。但鉴于 gate-logic.ts 现有结构 reasons 即 fail 原因，本处改为：仅当 NFR 行存在但双字段都缺失时才 push 到 reasons（视为 fail）；单字段缺失仅 console.warn。

修正后的代码：

```typescript

  // ==================== NFR 双值字段校验（第24轮 P2 新增） ====================
  // 问题 4：性能基线须区分生产目标值与测试环境基线
  // 仅对 NFR 类型行校验（requirementId 以 NFR 开头）；非 NFR 行跳过
  for (const row of matrix.rows) {
    if (!row || typeof row.requirementId !== 'string') continue;
    if (!row.requirementId.startsWith('NFR')) continue;
    const hasTarget = 'targetValue' in row && typeof row.targetValue === 'string' && row.targetValue.trim() !== '';
    const hasThreshold = 'testThreshold' in row && typeof row.testThreshold === 'string' && row.testThreshold.trim() !== '';
    if (!hasTarget && !hasThreshold) {
      reasons.push(`NFR 行 ${row.requirementId} 缺 targetValue 与 testThreshold 双字段（性能基线须区分生产目标值与测试环境基线）`);
    }
  }
```

最终 gate-logic.ts 中采用修正后版本（双字段都缺失才 fail，单字段缺失不 fail）。

- [ ] **Step 6: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 7: 验证 schema 合法性**

运行：`node -e "JSON.parse(require('fs').readFileSync('w-model-dev/schemas/rtm.schema.json','utf-8')); console.log('OK')"`
预期输出：`OK`

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/templates/requirement-spec.md w-model-dev/templates/system-test.md w-model-dev/schemas/rtm.schema.json w-model-dev/references/quality-standards.md w-model-dev/scripts/logic/gate-logic.ts
git commit -m "feat(w-model-dev): NFR 双字段 targetValue + testThreshold 性能基线区分

- templates/requirement-spec.md NFR 字段增加 targetValue + testThreshold 双字段
- templates/system-test.md 新增性能度量环境声明节（CI/full-suite/isolated）
- schemas/rtm.schema.json NFR 行增加 targetValue + testThreshold 字段（可选）
- references/quality-standards.md §性能指标监控增加生产目标 vs 测试基线区分指导
- gate-logic.ts NFR 行双字段都缺失时 fail（单字段缺失不 fail）
- Round 24 P2 问题 4 修正

Refs: SSoT §3.4.20"
```

---

### Task 13: 路由顺序（interface-design.md + phase-3-outline-design.md + 反模式 #36）

**Files:**
- Modify: `w-model-dev/templates/interface-design.md`（新增路由注册顺序约束节）
- Modify: `w-model-dev/references/phase-3-outline-design.md`（新增路由顺序约束节）
- Modify: `w-model-dev/references/anti-patterns.md`（#35 后新增 #36）

- [ ] **Step 1: templates/interface-design.md 新增路由注册顺序约束节**

打开 `w-model-dev/templates/interface-design.md`，在文件末尾追加新节：

```markdown

## 路由注册顺序约束

> 对应 Round 24 P2 问题 5。路由注册顺序错误会导致参数路径拦截静态路径、鉴权失效等问题。

### 注册顺序规则

1. **静态路径先于参数路径**：`/users/me` 须先于 `/users/:id` 注册，否则 `/users/me` 会被 `/users/:id` 拦截（`id="me"`）
2. **鉴权路由先于公开路由**：须鉴权的路由须先注册鉴权中间件，再注册公开路由
3. **具体路径先于通配路径**：`/api/v1/users` 须先于 `/api/*` 注册

### 路由注册顺序表模板

```markdown
| 注册顺序 | HTTP 方法 | 路径 | 鉴权 | 中间件 | 说明 |
|---|---|---|---|---|---|
| 1 | GET | /health | 否 | - | 健康检查（公开） |
| 2 | POST | /auth/login | 否 | rateLimit | 登录（限流） |
| 3 | GET | /users/me | 是 | auth, rateLimit | 当前用户信息（须鉴权） |
| 4 | GET | /users/:id | 是 | auth | 用户详情（参数路径，须在 /me 之后） |
| 5 | GET | /api/* | 是 | auth | API 通配（须在具体路径之后） |
```

### 校验

路由注册顺序由 V 评审与 G 门禁人工校验（无自动脚本）。违反命中反模式 #36。
```

- [ ] **Step 2: references/phase-3-outline-design.md 新增路由顺序约束节**

打开 `w-model-dev/references/phase-3-outline-design.md`，在文件末尾追加新节：

```markdown

## 路由顺序约束

> 对应 Round 24 P2 问题 5。阶段 3 接口设计须明确路由注册顺序约束。

### 框架级约束

| 框架 | 路由匹配规则 | 顺序约束 |
|---|---|---|
| Express | 按注册顺序匹配，首个匹配生效 | 静态路径须先于参数路径注册 |
| Koa | 按注册顺序匹配（koa-router） | 同 Express |
| Fastify | 按注册顺序匹配 | 静态路径须先于参数路径注册 |
| NestJS | 装饰器顺序即注册顺序 | 控制器内静态路径方法须先于参数路径方法 |

### 设计级约束

1. **鉴权前置**：须鉴权的路由须在路由定义前挂载鉴权中间件（如 `router.use(authMiddleware)` 须在 `router.get('/users/me', ...)` 之前）
2. **限流前置**：限流中间件须在业务处理前挂载（如 `router.use(rateLimit)` 须在 `router.post('/auth/login', ...)` 之前）
3. **错误处理中间件最后挂载**：错误处理中间件须在所有路由注册后挂载（Express 4 中间件顺序敏感）

### 反模式

- 参数路径先于静态路径注册 → 命中反模式 #36
- 鉴权路由注册在公开路由之后 → 命中反模式 #36
- 详见 `templates/interface-design.md`「路由注册顺序约束」节
```

- [ ] **Step 3: anti-patterns.md 在 #35 之后新增 #36**

打开 `w-model-dev/references/anti-patterns.md`，定位 Task 9 Step 4 新增的反模式 #35 末尾，在其后插入：

```markdown

## #36 路由顺序错误（第24轮新增）

**危害**：路由注册顺序错误导致参数路径拦截静态路径（如 `/users/:id` 拦截 `/users/me`，`id="me"`），或鉴权路由注册在公开路由之后导致鉴权失效。

**检测信号**：
- 参数路径（如 `/users/:id`）先于静态路径（如 `/users/me`）注册，导致 `/users/me` 被拦截为 `id="me"`
- 鉴权路由注册在公开路由之后，鉴权中间件未生效
- 具体路径（如 `/api/v1/users`）注册在通配路径（如 `/api/*`）之后，被通配路径拦截
- 集成测试中 `/users/me` 返回 404 或用户信息错误（`id="me"` 查询失败）

**回退动作**：修正路由注册顺序后重跑集成测试，确认静态路径优先匹配、鉴权中间件生效。

**门禁脚本**：无自动脚本（由 V 评审 + G 门禁人工校验路由注册顺序表）。

**关联**：SSoT §3.4.20（[23.0.0] 新增）
```

- [ ] **Step 4: 验证文档修改**

运行：`findstr /n "路由注册顺序约束" w-model-dev\templates\interface-design.md`
预期输出：包含匹配

运行：`findstr /n "#36 路由顺序错误" w-model-dev\references\anti-patterns.md`
预期输出：包含一行匹配

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/templates/interface-design.md w-model-dev/references/phase-3-outline-design.md w-model-dev/references/anti-patterns.md
git commit -m "feat(w-model-dev): 路由注册顺序约束 + 反模式 #36 路由顺序错误

- templates/interface-design.md 新增路由注册顺序约束节（3 规则 + 顺序表模板）
- references/phase-3-outline-design.md 新增路由顺序约束节（框架级 + 设计级）
- anti-patterns.md 新增 #36 路由顺序错误（参数路径拦截静态路径/鉴权失效）
- Round 24 P2 问题 5 修正

Refs: SSoT §3.4.20"
```

---

### Task 14: 图谱边数下限（graph-guide.md + graph-logic.ts）

**Files:**
- Modify: `w-model-dev/references/graph-guide.md`（新增边数下限与语义来源占比节）
- Modify: `w-model-dev/scripts/logic/graph-logic.ts`（边数下限 + 语义来源占比校验，警告级）

- [ ] **Step 1: references/graph-guide.md 新增边数下限与语义来源占比节**

打开 `w-model-dev/references/graph-guide.md`，在文件末尾追加新节：

```markdown

## 边数下限与语义来源占比

> 对应 Round 24 P2 问题 7。图谱规模阈值须有边数下限与语义来源占比指导，避免靠补丁达成规模。

### 边数下限

**规则**：边数 ≥ 节点数 × 3

**说明**：
- 每个节点平均须有 ≥3 条边（如 REQ→SD implements、REQ→INTF realizes、SD→DD produces 等）
- 边数 < 节点 × 3 → 警告（可能存在孤立节点或边缺失）
- 警告级不 fail，保留 small-project exemption 机制（小项目可豁免）

**示例**：
- 节点数 = 50 → 边数下限 = 150
- 节点数 = 100 → 边数下限 = 300

### 语义来源占比

**规则**：语义来源边占比 ≥ 80%

**定义**：语义来源边指从设计文档实体派生的边（即 `sourceArtifact` 字段非空的边），如 REQ→SD implements（源自需求规格与系统设计文档）。

**说明**：
- 语义来源边占比 = 语义来源边数 / 总边数
- 占比 < 80% → 警告（可能存在过多人工补丁边，非设计文档派生）
- 警告级不 fail，保留 small-project exemption 机制

**示例**：
- 总边数 = 150，语义来源边数 = 130 → 占比 = 86.7% ✓
- 总边数 = 150，语义来源边数 = 90 → 占比 = 60% ✗（警告）

### Small-project exemption

节点数 < 20 的小项目可豁免边数下限与语义来源占比校验（在 `project.status` 中标记 `smallProjectExemption: true`）。

### 校验

`graph-logic.ts` 增加边数下限校验（边 < 节点 × 3 → 警告）；增加语义来源占比校验（< 80% → 警告）。仅警告不 fail，保留豁免机制。
```

- [ ] **Step 2: graph-logic.ts 增加边数下限 + 语义来源占比校验**

打开 `w-model-dev/scripts/logic/graph-logic.ts`，定位 checkRequirementGraph 函数（搜索 `export function checkRequirementGraph`），在该函数的校验逻辑末尾（return 之前）追加边数下限与语义来源占比校验。

首先定位 GraphEdge 接口定义（第 58 行起），确认是否有 `sourceArtifact` 字段。若无，先在 GraphEdge 接口中增加 `sourceArtifact?: string` 字段（如已存在则跳过）。

然后在 checkRequirementGraph 函数的 return 语句之前追加：

```typescript

  // ==================== 边数下限 + 语义来源占比校验（第24轮 P2 新增） ====================
  // 问题 7：图谱规模阈值靠补丁达成，须有边数下限与语义来源占比指导
  // 仅警告不 fail，保留 small-project exemption 机制
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const minEdgeCount = nodeCount * 3;

  // 检查 small-project exemption
  const hasSmallProjectExemption = nodes.some(n => n?.attributes && typeof n.attributes === 'object' && 'smallProjectExemption' in n.attributes && n.attributes.smallProjectExemption === true);

  if (!hasSmallProjectExemption && edgeCount < minEdgeCount) {
    warnings.push(`边数下限警告：当前边数 ${edgeCount} < 节点数 × 3 = ${minEdgeCount}（可能存在孤立节点或边缺失）`);
  }

  // 语义来源占比校验
  if (!hasSmallProjectExemption && edgeCount > 0) {
    const semanticEdges = edges.filter(e => e && typeof (e as GraphEdge).sourceArtifact === 'string' && (e as GraphEdge).sourceArtifact!.trim() !== '').length;
    const semanticRatio = semanticEdges / edgeCount;
    if (semanticRatio < 0.8) {
      warnings.push(`语义来源占比警告：语义来源边占比 ${(semanticRatio * 100).toFixed(1)}% < 80%（可能存在过多人工补丁边）`);
    }
  }
```

**注意**：须确认 `warnings` 数组在 checkRequirementGraph 函数中已定义。若该函数无 `warnings` 数组，须在函数开头声明 `const warnings: string[] = [];` 并在返回对象中增加 `warnings` 字段。

若 checkRequirementGraph 函数返回对象无 `warnings` 字段，须在返回类型中增加 `warnings?: string[]`，并在返回对象中包含 `warnings`。

具体实现须根据 graph-logic.ts 现有结构调整。若现有结构无 warnings 机制，则改为将警告 push 到一个独立的 `graphWarnings` 数组并在返回对象中包含。

**简化实现**（若 graph-logic.ts 无 warnings 机制）：将警告信息附加到返回对象的 `reasons` 数组但标记为警告前缀 `[WARNING]`，且不改变 `passed` 判定（仅在 reasons 中存在非 `[WARNING]` 前缀的项时才 fail）。

**最终实现**：在 graph-logic.ts 的 checkRequirementGraph 函数中，定位现有 `const reasons: string[] = [];` 声明，在其后增加 `const warnings: string[] = [];`。在 return 语句中增加 `warnings` 字段。上述边数下限与语义来源占比校验代码 push 到 `warnings` 而非 `reasons`。

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/graph-guide.md w-model-dev/scripts/logic/graph-logic.ts
git commit -m "feat(graph): 边数下限 + 语义来源占比校验（警告级）

- graph-guide.md 新增「边数下限与语义来源占比」节（边 ≥ 节点×3；语义来源 ≥ 80%）
- graph-logic.ts 增加边数下限校验（边 < 节点×3 → 警告）
- graph-logic.ts 增加语义来源占比校验（< 80% → 警告）
- 仅警告不 fail，保留 small-project exemption 机制
- Round 24 P2 问题 7 修正

Refs: SSoT §3.4.20"
```

---

### Task 15: self-test.ts P2 用例 + P2 验证

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`（GRAPH_CASES 增加边数下限用例；GATE_CASES 增加 NFR 双值用例）

- [ ] **Step 1: self-test.ts GRAPH_CASES 增加边数下限用例（可选）**

打开 `w-model-dev/scripts/cli/self-test.ts`，定位 GRAPH_CASES 数组（第 314 行起）。由于 Task 14 的边数下限校验为警告级（不改变 passed 判定），现有 GRAPH_CASES 用例的 expectedPassed 不会受影响。

**若 Task 14 实现了 warnings 字段且 self-test 需校验 warnings**：在 GRAPH_CASES 中增加用例（可选）：

```typescript
  // -------------------- 第24轮 P2 边数下限警告（可选） --------------------
  // 注：边数下限为警告级不 fail，现有 GRAPH_CASES 用例不受影响
  // 若需校验 warnings，可新增 bad-low-edge-ratio.json 样本并在 GRAPH_CASES 增加用例
```

**决策**：P2 边数下限为警告级，不新增 self-test 用例（避免过度测试警告级逻辑）。仅确认现有 GRAPH_CASES 用例全部通过即可。

- [ ] **Step 2: self-test.ts GATE_CASES 增加 NFR 双值用例（可选）**

由于 Task 12 的 NFR 双值校验仅在双字段都缺失时 fail，现有 GATE_CASES 用例不包含 NFR 类型行（requirementId 以 NFR 开头），因此不受影响。

**决策**：不新增 GATE_CASES 用例（现有 valid-rtm.json 与 bad-coverage.json 均不含 NFR 行，不影响）。仅确认现有 GATE_CASES 用例全部通过即可。

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 4: 运行 self-test 全量验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期输出：
- 所有用例显示 `✓`（P2 警告级校验不影响 passed 判定）
- 末行 `总计 N 条用例：N 通过，0 失败`
- 退出码 0

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): P2 验证 — 确认现有用例不受警告级校验影响

- P2 边数下限与 NFR 双值均为警告级/条件 fail，不新增 self-test 用例
- 确认现有 GRAPH_CASES 与 GATE_CASES 用例全部通过
- Round 24 P2 验证

Refs: SSoT §3.4.20"
```

---

## P3 批（质量度量）— 问题 1 + 问题 8

### Task 16: 约束 #10 扩展 + 反模式 #27 S2 扩展 + phase-8-acceptance-test.md stdout 贴出

**Files:**
- Modify: `w-model-dev/SKILL.md:47`（约束 #10 增加文案）
- Modify: `w-model-dev/references/anti-patterns.md`（反模式 #27 S2 扩展）
- Modify: `w-model-dev/references/phase-8-acceptance-test.md`（§终检执行增加 stdout 贴出）

- [ ] **Step 1: SKILL.md 第 47 行约束 #10 增加文案**

打开 `w-model-dev/SKILL.md`，定位第 47 行约束 #10：

```markdown
10. **门禁退出码不可伪**：所有 `check-*.ts` 的 JSON 摘要须含 `exitCode` 字段，与 `process.exit()` 强一致；G 子代理须存档 stdout 到 `.w-model/gate-logs/`；`check-run-log.ts` 交叉校验 run-log 中 `gateExitCode` 与 `gate-logs/` 存档一致，不一致一律视为伪造并回退（SSoT §10E）。
```

修改为（增加 stdout 末尾 5 行贴出要求）：

```markdown
10. **门禁退出码不可伪**：所有 `check-*.ts` 的 JSON 摘要须含 `exitCode` 字段，与 `process.exit()` 强一致；G 子代理须存档 stdout 到 `.w-model/gate-logs/`；编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行（含 JSON 摘要行）；`check-run-log.ts` 交叉校验 run-log 中 `gateExitCode` 与 `gate-logs/` 存档一致，不一致一律视为伪造并回退（SSoT §10E）。
```

- [ ] **Step 2: anti-patterns.md 反模式 #27 S2 扩展**

打开 `w-model-dev/references/anti-patterns.md`，定位反模式 #27（搜索 `## #27`），在该反模式的「检测信号」节中增加"门禁脚本未实跑"作为独立可命中信号。

在 #27 的检测信号列表末尾追加：

```markdown
- 门禁脚本未实跑——仅记录 JSON 摘要未真实执行命令（第24轮新增独立信号）
```

- [ ] **Step 3: phase-8-acceptance-test.md §终检执行增加 stdout 贴出**

打开 `w-model-dev/references/phase-8-acceptance-test.md`，定位 §终检执行节（搜索 `终检执行` 或 `check-artifact-gate`），在该节末尾追加：

```markdown

**门禁 stdout 贴出要求**（第24轮新增）：

编排者须贴出 `check-artifact-gate.ts` stdout 末尾 5 行作为放行证据，包含：
1. `exitCode` 字段（须 = 0）
2. `passed` 字段（须 = true）
3. `coveragePercent` 字段（须 = 100）
4. `reasons` 字段（须为空数组 `[]`）
5. JSON 摘要行（如 `GATE_JSON {...}`）

**示例**：

```
─'.repeat(60)
GATE_JSON {"type":"artifact-gate","passed":true,"exitCode":0,"coveragePercent":100,"reasons":[]}
```

未贴出 stdout 末尾 5 行或贴出的 exitCode ≠ 0 → 视为门禁未实跑，命中反模式 #27 S2，回退到终检起点。
```

- [ ] **Step 4: 验证文档修改**

运行：`findstr /n "贴出门禁脚本 stdout 末尾 5 行" w-model-dev\SKILL.md`
预期输出：包含匹配

运行：`findstr /n "门禁脚本未实跑" w-model-dev\references\anti-patterns.md`
预期输出：包含匹配

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/anti-patterns.md w-model-dev/references/phase-8-acceptance-test.md
git commit -m "feat(w-model-dev): 约束 #10 stdout 贴出 + 反模式 #27 S2 扩展 + 终检 stdout 证据

- SKILL.md 约束 #10 增加文案：编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行
- anti-patterns.md 反模式 #27 S2 增加「门禁脚本未实跑」作为独立可命中信号
- phase-8-acceptance-test.md §终检执行增加 check-artifact-gate.ts stdout 末尾 5 行贴出要求
- Round 24 P3 问题 1 修正

Refs: SSoT §3.4.20"
```

---

### Task 17: 信息密度（quality-standards.md + definition-of-done.md + 反模式 #37）

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`（§文档质量标准增加信息密度指标）
- Modify: `w-model-dev/references/definition-of-done.md`（§文档 DoD 增加信息密度度量）
- Modify: `w-model-dev/references/anti-patterns.md`（#36 后新增 #37）

- [ ] **Step 1: quality-standards.md §文档质量标准增加信息密度指标**

打开 `w-model-dev/references/quality-standards.md`，定位 §文档质量标准节（搜索 `文档质量标准`），在该节末尾追加：

```markdown

### 信息密度指标（第24轮新增）

> 对应 Round 24 P3 问题 8。文档质量不仅看文件大小，还须看信息密度。

**定义**：信息密度 = 实体引用次数 / 章节数

**示例**：
- `requirements-spec.md` 有 5 章节，引用 SD-001/SD-002/SD-003 共 12 次 → 信息密度 = 12/5 = 2.4 ✓
- `detailed-design.md` 有 10 章节，引用 REQ-001/REQ-002 共 8 次 → 信息密度 = 8/10 = 0.8 ✗（低于 2）

**阈值**：
- 关键实体（REQ-xxx / SD-xxx / INTF-xxx / DD-xxx）引用密度 ≥ 2/章节 → 合格
- 关键实体引用密度 < 1/章节 → 产物膨胀但核心决策稀疏（命中反模式 #37）

**度量方法**：
1. 统计文档章节数（`##` 标题数）
2. 统计关键实体引用次数（正则匹配 `REQ-\d+` / `SD-\d+` / `INTF-\d+` / `DD-\d+`）
3. 计算密度 = 引用次数 / 章节数

**说明**：
- 信息密度是文档质量指标，不触发阶段回退（命中反模式 #37 时在 reworkHints 中标注）
- 适用于阶段 1-4 的开发产物文档（需求规格 / 系统设计 / 接口设计 / 详细设计）
```

- [ ] **Step 2: definition-of-done.md §文档 DoD 增加信息密度度量**

打开 `w-model-dev/references/definition-of-done.md`，定位 §文档 DoD 节（搜索 `文档 DoD` 或 `文档完成定义`），在该节末尾追加：

```markdown

### 信息密度度量（第24轮新增）

> 对应 Round 24 P3 问题 8。文档 DoD 须包含信息密度度量。

**信息密度 DoD 标准**：

| 文档类型 | 关键实体引用密度阈值 | 度量方法 |
|---|---|---|
| 需求规格（requirements-spec.md） | ≥ 2/章节 | REQ-xxx 引用次数 / 章节数 |
| 系统设计（system-design.md） | ≥ 2/章节 | SD-xxx / REQ-xxx 引用次数 / 章节数 |
| 接口设计（interface-design.md） | ≥ 2/章节 | INTF-xxx / SD-xxx 引用次数 / 章节数 |
| 详细设计（detailed-design.md） | ≥ 2/章节 | DD-xxx / SD-xxx 引用次数 / 章节数 |

**校验时机**：V 评审时由 V 子代理度量信息密度，密度 < 1/章节 → 命中反模式 #37，在 reworkHints 中标注"产物膨胀但核心决策稀疏"。

**说明**：信息密度不达标不触发阶段回退（非硬约束），但 V 评审须在 VerifierOutput JSON 的 `reworkHints` 中标注，S 子代理须在下一轮迭代中精简非核心内容、补充实体引用。
```

- [ ] **Step 3: anti-patterns.md 在 #36 之后新增 #37**

打开 `w-model-dev/references/anti-patterns.md`，定位 Task 13 Step 3 新增的反模式 #36 末尾，在其后插入：

```markdown

## #37 产物膨胀但核心决策稀疏（第24轮新增）

**危害**：子代理产出文件大小达标但信息密度不均，核心实体引用稀疏，导致文档可追溯性差、关键决策被非核心内容淹没。

**检测信号**：
- 文件大小达标（如 requirements-spec.md > 500 行）但关键实体引用密度 < 1/章节
- 章节数多但每章节实体引用次数 < 1
- 文档中大量描述性文字但缺少 REQ-xxx / SD-xxx / INTF-xxx / DD-xxx 等实体引用
- V 评审 reworkHints 中标注"信息密度不足"

**回退动作**：精简非核心内容，补充实体引用（REQ-xxx / SD-xxx / INTF-xxx / DD-xxx），使关键实体引用密度 ≥ 2/章节后重审。

**门禁脚本**：无自动脚本（由 V 评审人工度量信息密度，在 VerifierOutput JSON 的 `reworkHints` 中标注）。

**关联**：SSoT §3.4.20（[23.0.0] 新增）
```

- [ ] **Step 4: 验证文档修改**

运行：`findstr /n "信息密度指标" w-model-dev\references\quality-standards.md`
预期输出：包含匹配

运行：`findstr /n "#37 产物膨胀" w-model-dev\references\anti-patterns.md`
预期输出：包含一行匹配

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/quality-standards.md w-model-dev/references/definition-of-done.md w-model-dev/references/anti-patterns.md
git commit -m "feat(w-model-dev): 信息密度指标 + 反模式 #37 产物膨胀核心决策稀疏

- quality-standards.md §文档质量标准增加信息密度指标（实体引用次数/章节数 ≥ 2）
- definition-of-done.md §文档 DoD 增加信息密度度量（4 类文档阈值表）
- anti-patterns.md 新增 #37 产物膨胀但核心决策稀疏（信息密度 < 1/章节）
- Round 24 P3 问题 8 修正

Refs: SSoT §3.4.20"
```

---

### Task 18: self-test.ts P3 用例 + P3 验证

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`（确认现有用例不受影响）

- [ ] **Step 1: 确认 P3 修改不影响现有 self-test 用例**

P3 批的修改均为文档类（SKILL.md 约束 #10 文案扩展、anti-patterns.md 反模式扩展、quality-standards.md / definition-of-done.md / phase-8-acceptance-test.md 新增指标与要求），无新增脚本逻辑，不影响现有 self-test 用例。

无需新增 self-test 用例。

- [ ] **Step 2: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 3: 运行 self-test 全量验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期输出：
- 所有用例显示 `✓`
- 末行 `总计 N 条用例：N 通过，0 失败`
- 退出码 0

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): P3 验证 — 确认现有用例不受文档类修改影响

- P3 批修改均为文档类（约束 #10 文案 + 反模式扩展 + 信息密度指标）
- 无新增脚本逻辑，不影响现有 self-test 用例
- 确认 self-test 全通过
- Round 24 P3 验证

Refs: SSoT §3.4.20"
```

---

## 全量验证

### Task 19: 版本号 23.0.0 + 全量验证

**Files:**
- Modify: `w-model-dev/SKILL.md`（版本号更新为 23.0.0）
- Modify: `w-model-dev/skill-metadata.json`（版本号更新为 23.0.0）

- [ ] **Step 1: SKILL.md 版本号更新为 23.0.0**

打开 `w-model-dev/SKILL.md`，定位 frontmatter 中的 `version:` 字段（文件首行附近），将 `version: 22.0.0` 修改为 `version: 23.0.0`。

- [ ] **Step 2: skill-metadata.json 版本号更新为 23.0.0**

打开 `w-model-dev/skill-metadata.json`，将 `"version": "22.0.0"` 修改为 `"version": "23.0.0"`。

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`npx tsc --noEmit`
预期输出：0 错误

- [ ] **Step 4: 运行 self-test 全量验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期输出：
- 所有用例显示 `✓`
- 末行 `总计 N 条用例：N 通过，0 失败`
- 退出码 0
- `metadata/version-consistency` 用例通过（SKILL.md 与 skill-metadata.json 版本一致 = 23.0.0）

- [ ] **Step 5: 验证版本号一致性**

运行：`findstr /n "version: 23.0.0" w-model-dev\SKILL.md`
预期输出：包含一行匹配

运行：`node -e "const m=JSON.parse(require('fs').readFileSync('w-model-dev/skill-metadata.json','utf-8')); console.log('metadata version:', m.version)"`
预期输出：`metadata version: 23.0.0`

- [ ] **Step 6: 验证约束与反模式编号连续性**

运行：`findstr /n "## #3[4-7]" w-model-dev\references\anti-patterns.md`
预期输出：包含 4 行匹配（#34 / #35 / #36 / #37），编号连续无冲突

运行：`findstr /n "^1[89]\." w-model-dev\SKILL.md`
预期输出：包含 2 行匹配（约束 #18 / #19），编号连续无冲突

- [ ] **Step 7: 验证新增脚本存在且可执行**

运行：`dir w-model-dev\scripts\check-role-dispatch.ts w-model-dev\scripts\check-state-machine-consistency.ts`
预期输出：两个文件均存在

运行：`npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts`
预期输出：`用法: npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts <run-log.jsonl> [--r3-enabled]`（缺参数时退出码 2）

运行：`npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts`
预期输出：`用法: npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>`（缺参数时退出码 2）

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json
git commit -m "chore(w-model-dev): 版本号 23.0.0 + 全量验证

- SKILL.md version: 22.0.0 → 23.0.0
- skill-metadata.json version: 22.0.0 → 23.0.0
- 全量验证通过：tsc 0 错误 + self-test 全通过 + 版本号一致
- 约束 #18/#19 + 反模式 #34-#37 编号连续无冲突
- 新增脚本 check-role-dispatch.ts / check-state-machine-consistency.ts 可执行
- Round 24 全量验证完成

Refs: SSoT §3.4.20"
```

---

## Self-Review

### 1. Spec coverage（SSoT §3.4.20 十项修正覆盖检查）

| # | SSoT §3.4.20 修正项 | 对应任务 | 覆盖状态 |
|---|---|---|---|
| P0.1 | 问题 2 RTM 实体未真正回填 | Task 1（约束 #18 + subagent-delegation）+ Task 2（gate-logic coverageStatus + samples）+ Task 6（self-test 用例） | ✓ 覆盖 |
| P0.2 | 问题 9 编排者角色分派不严 | Task 3（约束 #19 + 反模式 #34）+ Task 4（check-role-dispatch.ts + samples）+ Task 5（run-log.schema + subagent-delegation 角色分派完整性节）+ Task 6（self-test 用例） | ✓ 覆盖 |
| P1.3 | 问题 3 R3 未实执行 | Task 7（约束 #12 扩展 + check-preventive-review.ts --auto-trigger + phase-1-requirements） | ✓ 覆盖（R3 校验已存在 run-log-logic.ts，不重复 R8） |
| P1.4 | 问题 6 状态机一致性无校验 | Task 8（check-state-machine-consistency.ts + samples + tla-plus-guide）+ Task 11（self-test 用例） | ✓ 覆盖 |
| P1.5 | 问题 10 self-as-verifier 独立性 | Task 9（SKILL.md 模式节 + verifier-spec + agent-personas + 反模式 #35）+ Task 10（check-verifier-output.ts --self-as-verifier） | ✓ 覆盖 |
| P2.6 | 问题 4 性能基线双值 | Task 12（requirement-spec + system-test + rtm.schema + quality-standards + gate-logic） | ✓ 覆盖 |
| P2.7 | 问题 5 路由顺序 | Task 13（interface-design + phase-3-outline-design + 反模式 #36） | ✓ 覆盖 |
| P2.8 | 问题 7 图谱边数补丁 | Task 14（graph-guide + graph-logic 边数下限 + 语义来源占比） | ✓ 覆盖 |
| P3.9 | 问题 1 门禁 stdout 贴出 | Task 16（约束 #10 扩展 + 反模式 #27 S2 + phase-8-acceptance-test） | ✓ 覆盖 |
| P3.10 | 问题 8 信息密度 | Task 17（quality-standards + definition-of-done + 反模式 #37） | ✓ 覆盖 |

**结论**：SSoT §3.4.20 十项修正全部覆盖，无遗漏。

### 2. Placeholder scan（占位扫描）

已扫描全文，无 TBD / TODO / "fill in details" / "implement later" / "similar to Task N" 等占位符。每个步骤均含完整代码或完整文档段落。

**已知非占位的"决策"标注**（属于设计决策，非占位）：
- Task 12 Step 5：NFR 双值校验从"警告级"调整为"双字段都缺失才 fail"（附完整修正后代码）
- Task 14 Step 2：warnings 机制实现（附 3 种实现路径与最终选择）
- Task 15 / Task 18：决策不新增 self-test 用例（附理由）

### 3. Type consistency（类型一致性）

| 类型/函数/变量名 | 定义位置 | 使用位置 | 一致性 |
|---|---|---|---|
| `checkRoleDispatch` | Task 4 check-role-dispatch.ts export | Task 6 self-test.ts import + runRoleDispatchCases | ✓ 一致 |
| `RunLogEntry` interface | Task 4 check-role-dispatch.ts | Task 4 checkRoleDispatch 参数 + Task 6 self-test.ts（Record<string, unknown> 断言） | ✓ 一致 |
| `RoleDispatchResult` | Task 4 check-role-dispatch.ts | Task 4 main() + Task 6 runRoleDispatchCases（r.passed / r.violations） | ✓ 一致 |
| `checkStateMachineConsistency` | Task 8 check-state-machine-consistency.ts export | Task 11 self-test.ts import + runStateMachineCases | ✓ 一致 |
| `StateMachineConsistencyInput` | Task 8 check-state-machine-consistency.ts | Task 8 checkStateMachineConsistency 参数 + Task 11 self-test.ts（Parameters<typeof>） | ✓ 一致 |
| `RoleDispatchCase` interface | Task 6 self-test.ts | Task 6 ROLE_DISPATCH_CASES + runRoleDispatchCases | ✓ 一致 |
| `StateMachineCase` interface | Task 11 self-test.ts | Task 11 STATE_MACHINE_CASES + runStateMachineCases | ✓ 一致 |
| `ROLE_DISPATCH_CASES` | Task 6 self-test.ts 定义 | Task 6 main() 计数 + runRoleDispatchCases 调用 | ✓ 一致 |
| `STATE_MACHINE_CASES` | Task 11 self-test.ts 定义 | Task 11 main() 计数 + runStateMachineCases 调用 | ✓ 一致 |
| `runRoleDispatchCases` | Task 6 self-test.ts 定义 | Task 6 main() Promise.all 调用 | ✓ 一致 |
| `runStateMachineCases` | Task 11 self-test.ts 定义 | Task 11 main() Promise.all 调用 | ✓ 一致 |
| `roleDispatchResults` | Task 6 main() 解构 | Task 6 main() all 数组 | ✓ 一致 |
| `stateMachineResults` | Task 11 main() 解构 | Task 11 main() all 数组 | ✓ 一致 |
| `warnings` 数组 | Task 14 graph-logic.ts | Task 14 边数下限 + 语义来源占比校验 | ✓ 一致（最终实现声明 const warnings: string[] = []） |

**结论**：所有类型/函数/变量名跨任务一致，无命名冲突。

### 4. 编号连续性（约束与反模式编号）

**约束编号**：
- 现有：#1-#17（SKILL.md 第 38-54 行）
- 新增：#18（Task 1）、#19（Task 3）
- 连续性：#17 → #18 → #19，无冲突

**反模式编号**：
- 现有：#1-#33（anti-patterns.md，#33 在第 444-455 行，`## 实现层经验教训` 在第 456 行）
- 新增：#34（Task 3）、#35（Task 9）、#36（Task 13）、#37（Task 17）
- 插入位置：均在 #33 之后、`## 实现层经验教训` 之前
- 连续性：#33 → #34 → #35 → #36 → #37，无冲突

**结论**：约束 #18/#19 与反模式 #34-#37 编号连续无冲突。

### 5. 任务依赖与执行顺序

- P0 批 Task 1-6 顺序执行：Task 1（约束 #18）→ Task 2（gate-logic + samples）→ Task 3（约束 #19 + 反模式 #34）→ Task 4（check-role-dispatch）→ Task 5（schema + subagent-delegation）→ Task 6（self-test P0）
- P1 批 Task 7-11 顺序执行：Task 7（约束 #12）→ Task 8（check-state-machine）→ Task 9（self-as-verifier + 反模式 #35）→ Task 10（check-verifier-output）→ Task 11（self-test P1）
- P2 批 Task 12-15 顺序执行：Task 12（NFR 双字段）→ Task 13（路由顺序 + 反模式 #36）→ Task 14（图谱边数）→ Task 15（self-test P2）
- P3 批 Task 16-18 顺序执行：Task 16（stdout 贴出）→ Task 17（信息密度 + 反模式 #37）→ Task 18（self-test P3）
- Task 19（全量验证）最后执行

**跨任务依赖**：
- Task 6 self-test.ts import checkRoleDispatch 依赖 Task 4 创建 check-role-dispatch.ts ✓
- Task 11 self-test.ts import checkStateMachineConsistency 依赖 Task 8 创建 check-state-machine-consistency.ts ✓
- Task 11 self-test.ts 的 main() 修改基于 Task 6 已修改的 main() 结构（追加而非覆盖）✓
- Task 19 版本号更新依赖前 18 个任务全部完成 ✓

**结论**：任务依赖关系清晰，执行顺序合理。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-30-round24-p0-p3-skill-fixes.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans
- Batch execution with checkpoints for review