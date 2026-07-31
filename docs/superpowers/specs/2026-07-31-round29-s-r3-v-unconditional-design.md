# 第 29 轮设计：S→R3+V 无条件强制（覆盖所有 S 变体，含 S-fix / emergency-fix）

> 触发：用户指令「强化技能设计，任意方式派遣 S 子代理后必须派遣 R+V 子代理进行分析，不允许任何意外」。
>
> 当前版本：`27.0.0`；目标版本：`28.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。
>
> 工作流：头脑风暴 → 设计（本文）→ 计划 → 同步 SSoT → 实施 → 回归 → 同步 SSoT/README/AGENTS/INSTALL/CHANGELOG。

## 1. 背景与缺口

### 1.1 现状

第 22 轮（§3.4.18）引入 S→R3→V→G 预防性审查流程，第 24 轮（§3.4.20 P0.2）新增约束 #19 + 反模式 #34 + `check-role-dispatch.ts` 强制角色分派完整性。但 R3 当前是**条件强制**：

- `check-role-dispatch.ts` 仅在传入 `--r3-enabled` 时校验 `role=R ≥3`；不传则不校验。
- SKILL.md 约束 #12 / #17 / #19 措辞含「R3 启用时」字样。
- subagent-delegation.md「角色分派完整性校验」表标注「R3 预防性审查启用时必须」。
- anti-patterns.md #33 / #34 含「启用时」措辞。
- S-fix（返工变体）与 S-emergency-fix（紧急修复变体）后**未明确**前置 R3+V：
  - S-fix 走标准 V→G，但 R3 缺失。
  - emergency-fix 按「修复时记 needsReview=true，阶段完成后由 R 复核」机制，属事后复核，不前置 R3+V。

### 1.2 缺口清单

| 缺口 | 现状 | 用户要求 |
|---|---|---|
| G1 | R3 启用为 flag | **无条件**：移除 flag，R3×3 对每个 S 派遣都强制 |
| G2 | 仅覆盖标准 S / opsx 三段式 S | 覆盖**全部 S 变体**：S-doc / S-tla / S-bdd / S-explore / S-propose / S-coding / S-fix / S-emergency-fix |
| G3 | emergency-fix 事后 R 复核 | **前置** R3×3 + V（用户决策：强制 R3+V 前置，无条件） |
| G4 | #33 / #34 措辞「启用时」 | 改为「无条件」 |
| G5 | 无专门针对 S-fix / emergency-fix 跳 R3+V 的反模式 | **新增 #42**：S-fix / emergency-fix 后跳过 R3+V |
| G6 | #35 仅覆盖 S/V/G/R 产物混合 | 扩展含 R3 |

### 1.3 不涉及范围

- 不修改 R3 三维度本身（completeness / reliability / security 保持）。
- 不修改 V 评审 Schema（`verifier-output.schema.json` 不变）。
- 不引入新 R3 维度。
- 不取消 self-as-verifier 兼任豁免（各角色产物文件独立即可，R3 不可省略）。
- 不修改返工 R（root cause locator）机制 —— R3 与返工 R 仍是两个角色变体，本文只升级 R3。

## 2. 核心规则升级

### 2.1 R3 从条件强制 → 无条件强制

```
每个 S 派遣（任意变体）后必须派遣 R3×3（completeness/reliability/security）+ V，
顺序：S → R3×3 → V → G。无例外，无 flag，无「启用时」措辞。
```

**违反字面即违反精神**。R3 不得以「修复就是小改不用审」「紧急救援优先」「self-as-verifier 模式简化」等理由跳过。

### 2.2 覆盖的 S 变体（穷举）

| S 变体 | 阶段 | 既有流程 | 升级后流程 |
|---|---|---|---|
| S（标准） | 1-8 | S → R3×3 → V → G | 不变（已强制） |
| S-doc | 1-4 | S-doc → S-tla → S-bdd → R3×3 → V → G | 不变（已强制） |
| S-tla | 1-4 | 同上 | 不变 |
| S-bdd | 1-4 | 同上 | 不变 |
| S-explore | 5-8 | R3×3 → V | 不变（已强制） |
| S-propose | 5-8 | R3×3 → V | 不变 |
| S-coding | 5-8 | R3×3 → V | 不变 |
| **S-fix** | 全阶段返工 | S-fix → V → G | **升级：S-fix → R3×3 → V → G** |
| **S-emergency-fix** | 阻塞 bug | 修复记 needsReview，事后 R 复核 | **升级：S-emergency-fix → R3×3 → V → G 前置** |

### 2.3 紧急修复通道调整

按用户决策，emergency-fix 通道：

- **移除**事后 R 复核机制（`emergencyFixReview` 字段 + 「阶段完成后由 R 复核」条款）。
- emergency-fix 与其他 S 变体一视同仁：前置 R3×3 + V + G。
- emergency-fix 仍保留 `variant=emergency-fix` + `blocker` 字段用于 run-log 审计，仅作为「为何走紧急通道」的说明，不再意味跳过审查。

## 3. 脚本层修改

### 3.1 check-role-dispatch.ts

- 移除 `--r3-enabled` 参数语义（保留向后兼容：传入视为 no-op 不报错）。
- R ≥3 校验改为**无条件**：每阶段 run-log 须含 `role=R` 记录 ≥3 条。
- 缺失即 violations，exitCode=1。
- `r3Enabled` 字段在 ROLE_DISPATCH_JSON 输出中保留但恒为 `true`（向后兼容历史消费者）。

### 3.2 check-preventive-review.ts

- always-on，无 flag。
- 报告路径校验扩展覆盖 S-fix / S-emergency-fix：
  - 标准路径：`.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`
  - 返工路径（S-fix）：`.w-model/preventive-reviews/<phase>-fix-{completeness,reliability,security}.json`
  - 紧急路径（S-emergency-fix）：`.w-model/preventive-reviews/<phase>-emergency-{completeness,reliability,security}.json`
- `--auto-trigger` 模式从 run-log 读取当前阶段 + S 变体（含 fix/emergency），自动校验对应 R3 报告。

### 3.3 check-run-log.ts

- R8 规则从「R3 启用时，S→V 间须有 3 条 R3 记录」改为「**无条件**，S→V 间须有 3 条 R3 记录（completeness/reliability/security）」。
- 扩展到 S-fix → V、S-emergency-fix → V 间也须有 R3 记录（按 action=fix / action=emergency-fix 识别 S 变体）。

### 3.4 纯逻辑层 + 测试

- `role-dispatch-logic.ts` / `preventive-review-logic.ts` / `run-log-logic.ts` 纯逻辑层同步。
- 对应 vitest 单元测试同步：role-dispatch-logic.test.ts / preventive-review-logic.test.ts / run-log-logic.test.ts。

## 4. 反模式修改

### 4.1 #33 强化（跳过 R3 预防性审查）

- 现状：「R3 启用时」措辞 + 仅覆盖标准 S / opsx 三段式。
- 升级：移除「启用时」，覆盖**所有 S 变体**（含 S-fix / S-emergency-fix）。

### 4.2 #34 强化（编排者漏派角色）

- 现状：「R3 启用时须分派 R 角色 ≥3 次」。
- 升级：「**无条件**须分派 R 角色 ≥3 次」。

### 4.3 #35 扩展（self-as-verifier 模式下产物混合）

- 现状：覆盖 S/V/G/R 产物混合。
- 扩展：含 R3（PreventiveReview JSON 须独立产出，不得与 S 产出混合）。

### 4.4 #42 新增（S-fix / emergency-fix 后跳过 R3+V）

- 症状：S-fix 或 emergency-fix 产出后未派 R3×3 + V，直接 G 门禁或放行。
- 检测信号：run-log 中 `action=fix` / `action=emergency-fix` 后无 R3 记录直接 V/G。
- 回退：回到 S-fix / emergency-fix 产出后起点，补跑 R3×3 + V。

## 5. 文档层修改

### 5.1 SSoT

- §3.4.18 #17：从「R3 预防性审查强制（启用时）」改为「无条件强制（所有 S 变体，含 S-fix / emergency-fix）」。
- §3.4.20 P0.2：约束 #19 中「R3 启用时须分派 R 角色」改为「无条件须分派 R 角色 ≥3 次」。
- 新增 §3.4.25（第 29 轮）条目，追溯表新增一行。
- §10F/§10I 等约束/反模式总表同步。

### 5.2 subagent-delegation.md

- 「R3 预防性审查分派模板」节删除「启用时」措辞，改为无条件。
- 「角色分派完整性校验」表中 R 行的「必分派条件」从「R3 启用时必须」改为「无条件必须」。
- 「S 兼 F 修复分派模板（返工变体）」节新增「产出后须 R3×3 → V → G」。
- 「S 子代理修改既有产物的边界」节紧急修复通道条款改为前置 R3+V（移除事后 R 复核）。

### 5.3 SKILL.md

- 约束 #12：删除「（R3 启用时）」字样，改为无条件 5 脚本。
- 约束 #17：删除「启用时」措辞，改为无条件，新增「含 S-fix / emergency-fix」。
- 约束 #19：删除「R3 启用时须分派 R 角色」，改为「无条件须分派 R 角色 ≥3 次」。

### 5.4 anti-patterns.md

- #33 强化（§4.1）。
- #34 强化（§4.2）。
- #35 扩展（§4.3）。
- #42 新增（§4.4）。

### 5.5 phase-1~8-*.md

- 各阶段 R3 启用条件措辞统一删除，改为无条件强制。

## 6. 版本与回归

- 版本号：`27.0.0` → `28.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。
- self-test 基线：213 → ~218（+5 新样本：role-dispatch unconditional ×1、preventive-review fix/emergency 路径 ×2、run-log R8 unconditional ×1、anti-pattern #42 ×1）。
- vitest：269 → ~280（role-dispatch / preventive-review / run-log R8 测试扩展）。
- pre-push：11 项门禁全通过。

## 7. 验收标准

- [ ] `check-role-dispatch.ts` 不传 `--r3-enabled` 时 R≥3 也校验；传入 `--r3-enabled` 不报错（向后兼容）。
- [ ] `check-preventive-review.ts` 支持 S-fix / S-emergency-fix 后 R3 报告路径校验。
- [ ] `check-run-log.ts` R8 无条件校验 S→V 间 R3 记录，覆盖 action=fix / emergency-fix。
- [ ] SKILL.md 约束 #12 / #17 / #19 删除「启用时」措辞。
- [ ] anti-patterns.md #33 / #34 / #35 强化，#42 新增。
- [ ] subagent-delegation.md 紧急修复通道改为前置 R3+V。
- [ ] SSoT §3.4.18 / §3.4.20 同步 + §3.4.25 新增条目。
- [ ] 版本号三处同步 28.0.0。
- [ ] self-test 全通过；vitest 全通过；pre-push 全通过。
