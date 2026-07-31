# Round 29: S→R3+V Unconditional Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 R3 预防性审查从「条件强制（--r3-enabled flag）」升级为「无条件强制」，覆盖所有 S 变体（含 S-fix / S-emergency-fix），不允许任何跳过 R3+V 的意外。

**Architecture:** 三层同步 —— (1) 纯逻辑层（role-dispatch-logic / preventive-review-logic / run-log-logic）移除条件分支；(2) 脚本 CLI 层（check-*.ts）保留向后兼容（flag 视为 no-op）；(3) 文档层（SSoT / SKILL / references / anti-patterns / phase-*）删除「启用时」措辞，强化反模式 #33/#34/#35，新增 #42。

**Tech Stack:** TypeScript (tsx runtime) + Vitest + 自研 self-test runner。

**版本：** `27.0.0` → `28.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。

**Spec:** [docs/superpowers/specs/2026-07-31-round29-s-r3-v-unconditional-design.md](../specs/2026-07-31-round29-s-r3-v-unconditional-design.md)

---

## File Structure

| 文件 | 责任 | 修改类型 |
|---|---|---|
| `w-model-dev/scripts/check-role-dispatch.ts` | CLI：移除 `--r3-enabled` 语义，R≥3 无条件 | Modify |
| `w-model-dev/scripts/role-dispatch-logic.ts` | （若存在）纯逻辑；否则逻辑在 check-role-dispatch.ts 内 | Modify/Create |
| `w-model-dev/scripts/check-preventive-review.ts` | CLI：扩展 fix/emergency 路径校验 | Modify |
| `w-model-dev/scripts/preventive-review-logic.ts` | 纯逻辑：支持 variant 参数 | Modify |
| `w-model-dev/scripts/run-log-logic.ts` | 纯逻辑：R8 无条件 + 覆盖 fix/emergency-fix | Modify |
| `w-model-dev/scripts/self-test.ts` | 回归：+5 样本，删除 r3Enabled 字段语义 | Modify |
| `w-model-dev/scripts/__tests__/*.test.ts` | vitest：role-dispatch 新建 + preventive/run-log 扩展 | Create/Modify |
| `w-model-dev/scripts/samples/run-log/*.jsonl` | 样本：bad-missing-R-role 改为无条件 + 新增 fix/emergency 样本 | Modify/Create |
| `w-model-dev/scripts/samples/preventive-review/*.json` | 样本：fix/emergency 路径样本 | Create |
| `w-model-dev/SKILL.md` | 约束 #12/#17/#19 + 版本号 | Modify |
| `w-model-dev/references/subagent-delegation.md` | 删除「启用时」+ 紧急修复通道改前置 | Modify |
| `w-model-dev/references/anti-patterns.md` | #33/#34/#35 强化 + #42 新增 | Modify |
| `w-model-dev/references/phase-{1..8}-*.md` | 删除「启用时」措辞 | Modify |
| `docs/skill-design-document_SSoT.md` | §3.4.18/#3.4.20 同步 + §3.4.25 新增 | Modify |
| `w-model-dev/skill-metadata.json` | 版本号 | Modify |
| `package.json` | 版本号 | Modify |
| `README.md` / `AGENTS.md` / `INSTALL.md` / `CHANGELOG.md` | 同步 | Modify |

---

## Task 1: 抽离 role-dispatch 纯逻辑层 + 无条件 R≥3

**Files:**
- Create: `w-model-dev/scripts/role-dispatch-logic.ts`
- Modify: `w-model-dev/scripts/check-role-dispatch.ts`
- Test: `w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts`

**说明：** 当前 `checkRoleDispatch` 逻辑在 check-role-dispatch.ts 内联，接受 `r3Enabled: boolean` 参数。本任务抽离到纯逻辑文件，移除 `r3Enabled` 参数语义（R≥3 无条件），CLI 层保留 flag 兼容（视为 no-op）。

- [ ] **Step 1: 写失败测试 `role-dispatch-logic.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { checkRoleDispatch } from '../role-dispatch-logic.js';

describe('role-dispatch-logic: R≥3 无条件（第29轮）', () => {
  it('缺 R3 记录应失败（不再需要 r3Enabled flag）', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
      // 仅 1 条 R3，缺 reliability/security
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some(v => /缺失 role=R/.test(v))).toBe(true);
  });

  it('S/V/G/R≥3 齐全应通过', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'V', action: 'review', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(true);
  });

  it('缺 V 角色应失败', () => {
    const entries = [
      { phase: 1, role: 'S', action: 'produce', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-completeness', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-reliability', outcome: 'success' },
      { phase: 1, role: 'R', action: 'r3-security', outcome: 'success' },
      { phase: 1, role: 'G', action: 'gate', outcome: 'success' },
    ];
    const r = checkRoleDispatch(entries);
    expect(r.passed).toBe(false);
    expect(r.violations.some(v => /缺失 role=V/.test(v))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 创建 `role-dispatch-logic.ts`（R≥3 无条件）**

```typescript
/**
 * 角色分派完整性校验纯逻辑（Role Dispatch Logic）
 *
 * 对应约束 #19 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 预防性审查无条件须分派 R 角色 ≥3 次（第29轮升级：移除 --r3-enabled flag）。
 *
 * 设计原则（与 run-log-logic.ts / preventive-review-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状
 *   2. 纯函数：无 I/O、无副作用
 *   3. 单点事实：所有「角色分派是否完整」的判定均委托至此
 */

export interface RoleDispatchEntry {
  phase?: number;
  action?: string;
  role?: string;
  outcome?: string;
}

export interface RoleDispatchResult {
  passed: boolean;
  violations: string[];
  phaseSummary: Array<{
    phase: number;
    roles: Record<string, number>;
    missing: string[];
  }>;
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;
const R3_REQUIRED_COUNT = 3;

/**
 * 角色分派完整性校验纯逻辑
 *
 * 第29轮升级：R3 无条件强制。不再接受 r3Enabled 参数；
 * 每阶段 run-log 须含 role=R 记录 ≥3 条（completeness/reliability/security）。
 *
 * @param entries run-log 解析后的条目数组
 */
export function checkRoleDispatch(entries: RoleDispatchEntry[]): RoleDispatchResult {
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

    // R3 无条件强制（第29轮：移除 r3Enabled 条件分支）
    const rCount = roles.get('R') ?? 0;
    if (rCount < R3_REQUIRED_COUNT) {
      missing.push('R');
      violations.push(
        `阶段 ${phase} 缺失 role=R 记录（约束 #19：R3 无条件强制，须有 3 条 R3 记录 completeness/reliability/security，当前 ${rCount} 条）`,
      );
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 重构 `check-role-dispatch.ts` 委托纯逻辑 + CLI 向后兼容**

将 check-role-dispatch.ts 改为：import 纯逻辑，CLI 接受 `--r3-enabled` flag 但视为 no-op（向后兼容），JSON 输出 `r3Enabled` 字段恒为 `true`。

修改要点：
- 删除文件内联的 `checkRoleDispatch` 函数与 `REQUIRED_ROLES`。
- `import { checkRoleDispatch } from './role-dispatch-logic.js';`
- `main()` 中 `r3Enabled` 变量保留（CLI 解析），但调用改为 `checkRoleDispatch(entries)`（不传 r3Enabled）。
- 人类可读报告中 `R3 启用` 行改为 `R3 强制: 是（无条件，第29轮）`。
- JSON 摘要中 `r3Enabled` 字段恒输出 `true`。
- 文件头注释更新：「R3 启用时须分派 R 角色」→「R3 无条件须分派 R 角色 ≥3 次（第29轮）」。

- [ ] **Step 6: 运行 self-test 确认现有 role-dispatch 用例不破**

Run: `cd /workspace && npx tsx w-model-dev/scripts/self-test.ts 2>&1 | tail -20`
Expected: 现有 ROLE_DISPATCH_CASES 仍通过（`bad-missing-R-role.jsonl` 在 r3Enabled=true 时本就期望失败；现在无条件也失败，用例描述需在 Task 5 同步）。若 self-test 因 `c.r3Enabled` 字段类型不匹配报错，先在 Task 5 修样本，本步只确认纯逻辑测试通过即可。

- [ ] **Step 7: Commit**

```bash
cd /workspace
git add w-model-dev/scripts/role-dispatch-logic.ts w-model-dev/scripts/check-role-dispatch.ts w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts
git commit -m "feat(role-dispatch): R3 unconditional enforcement (round 29)

- Extract pure logic to role-dispatch-logic.ts
- R>=3 now unconditional (remove r3Enabled param semantics)
- CLI keeps --r3-enabled flag as no-op for backward compat
- JSON output r3Enabled field always true"
```

---

## Task 2: preventive-review-logic 支持 S-fix / S-emergency-fix variant

**Files:**
- Modify: `w-model-dev/scripts/preventive-review-logic.ts`
- Modify: `w-model-dev/scripts/check-preventive-review.ts`
- Test: `w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`

**说明：** 当前 `checkPreventiveReview` 只校验 `<phase>-{dim}.json` 标准路径。本任务新增 `variant` 参数，支持 `standard` / `fix` / `emergency` 三种路径前缀。

- [ ] **Step 1: 写失败测试（扩展 preventive-review-logic.test.ts）**

在文件末尾追加：

```typescript
describe('preventive-review-logic: variant 路径（第29轮 S-fix/emergency）', () => {
  it('variant=fix 时应校验 <phase>-fix-{dim} 命名约定', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'security', findings: [], passed: true },
    };
    const r = checkPreventiveReview(reviews, 5, { variant: 'fix' });
    expect(r.passed).toBe(true);
  });

  it('variant=emergency 时也应通过（三份齐备）', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-31T00:00:00Z', reviewer: 'R', phase: 5, dimension: 'security', findings: [], passed: true },
    };
    const r = checkPreventiveReview(reviews, 5, { variant: 'emergency' });
    expect(r.passed).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`
Expected: FAIL（`checkPreventiveReview` 不接受第三参数 options）

- [ ] **Step 3: 修改 `preventive-review-logic.ts` 支持 variant**

修改 `checkPreventiveReview` 签名，新增可选第三参数 `options?: { variant?: 'standard' | 'fix' | 'emergency' }`。逻辑层不变（仍校验三份报告完整性），variant 仅用于 CLI 层路径解析与 run-log 推断。在函数 JSDoc 中说明 variant 用途。

```typescript
export interface PreventiveReviewOptions {
  /** S 变体类型：standard（默认）/ fix（S-fix 返工）/ emergency（S-emergency-fix） */
  variant?: 'standard' | 'fix' | 'emergency';
}

export function checkPreventiveReview(
  reviews: Record<string, PreventiveReview | null>,
  expectedPhase: number,
  _options?: PreventiveReviewOptions,
): PreventiveReviewCheckResult {
  // 逻辑不变（第22轮已实现三份齐备校验）；variant 仅用于 CLI 层路径前缀
  // ... 保留现有实现
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 `check-preventive-review.ts` CLI 支持 `--variant` 参数**

在 `main()` 中新增 `--variant=` 参数解析（standard/fix/emergency，默认 standard），并据此构造 R3 报告路径前缀：

- standard: `<phase>-{dim}.json`
- fix: `<phase>-fix-{dim}.json`
- emergency: `<phase>-emergency-{dim}.json`

`--auto-trigger` 模式从 run-log 推断 variant：扫描最近一条 `action=fix` → variant=fix；`action=emergency-fix` → variant=emergency；否则 standard。

JSON 输出新增 `variant` 字段。

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add w-model-dev/scripts/preventive-review-logic.ts w-model-dev/scripts/check-preventive-review.ts w-model-dev/scripts/__tests__/preventive-review-logic.test.ts
git commit -m "feat(preventive-review): support S-fix/emergency-fix variant paths (round 29)"
```

---

## Task 3: run-log-logic R8 无条件 + 覆盖 fix/emergency-fix

**Files:**
- Modify: `w-model-dev/scripts/run-log-logic.ts`
- Test: `w-model-dev/scripts/__tests__/run-log-logic.test.ts`

**说明：** 当前 R8（第264行块）已是无条件（无 r3Enabled flag 包裹），但只识别 `action=produce`（标准 S）。本任务扩展识别 `action=fix` / `action=emergency-fix` 作为 S 变体，要求其后到 V 之间也有 3 条 R3 记录。

- [ ] **Step 1: 写失败测试（扩展 run-log-logic.test.ts）**

```typescript
describe('run-log R8 扩展：S-fix/emergency-fix 后须 R3（第29轮）', () => {
  it('S-fix 后无 R3 直接 V 应失败', () => {
    const entries = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const r = checkRunLog(entries, { gateLogs: new Map() });
    expect(r.violations.some(v => /R3 记录校验失败.*fix/.test(v))).toBe(true);
  });

  it('S-emergency-fix 后无 R3 直接 V 应失败', () => {
    const entries = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'emergency-fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const r = checkRunLog(entries, { gateLogs: new Map() });
    expect(r.violations.some(v => /R3 记录校验失败.*emergency-fix/.test(v))).toBe(true);
  });

  it('S-fix 后有 3 条 R3 再 V 应通过', () => {
    const entries = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'r3-completeness', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '3', timestamp: '2026-07-31T00:02:00Z', phase: 5, phaseName: 'Coding', action: 'r3-reliability', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '4', timestamp: '2026-07-31T00:03:00Z', phase: 5, phaseName: 'Coding', action: 'r3-security', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '5', timestamp: '2026-07-31T00:04:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const r = checkRunLog(entries, { gateLogs: new Map() });
    expect(r.violations.some(v => /R3 记录校验失败/.test(v))).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: FAIL（当前只识别 action=produce）

- [ ] **Step 3: 修改 `run-log-logic.ts` 第264行块**

将 S 识别条件从 `action === 'produce'` 扩展为 `['produce', 'fix', 'emergency-fix'].includes(action)`。同时 RunLogEntry.action 联合类型新增 `'emergency-fix'`。

定位第275-294行，修改：

```typescript
for (const [phase, entryList] of phaseEntries) {
  // 查找 S 产出（含标准 produce / S-fix / S-emergency-fix）和 V 评审的位置
  const S_VARIANTS = ['produce', 'fix', 'emergency-fix'];
  let sIndex = -1, vIndex = -1;
  let sVariant = '';
  for (let i = 0; i < entryList.length; i++) {
    const item = entryList[i];
    if (!item) continue;
    if (item.role === 'S' && S_VARIANTS.includes(item.action) && sIndex === -1) {
      sIndex = i;
      sVariant = item.action;
    }
    if (item.role === 'V' && item.action === 'review' && sIndex >= 0 && vIndex === -1) vIndex = i;
  }
  if (sIndex >= 0 && vIndex > sIndex) {
    const r3Records = entryList.slice(sIndex + 1, vIndex).filter(
      e => e.role === 'R' && r3Dimensions.some(d => e.action.includes(d)),
    );
    if (r3Records.length < 3) {
      violations.push(
        `R3 记录校验失败：阶段 ${phase} 的 S(${sVariant})→V 之间仅有 ${r3Records.length} 条 R3 记录，须有 3 条（completeness/reliability/security）`,
      );
    }
  }
}
```

同时在第25-42行 RunLogEntry.action 联合类型新增 `'emergency-fix'`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /workspace && npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add w-model-dev/scripts/run-log-logic.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts
git commit -m "feat(run-log): R8 unconditional + cover S-fix/emergency-fix (round 29)"
```

---

## Task 4: 新增 anti-pattern #42 + 强化 #33/#34/#35

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 读取现有 #33/#34/#35 内容**

Run: `cd /workspace && grep -n "^### #3[345]\|^### #42" w-model-dev/references/anti-patterns.md`
确认行号。

- [ ] **Step 2: 强化 #33（移除「启用时」，覆盖所有 S 变体）**

定位 #33 节，将「R3 启用时」措辞全部删除，改为「无条件强制」，覆盖列表新增 S-fix / S-emergency-fix。

- [ ] **Step 3: 强化 #34（R≥3 无条件）**

定位 #34 节，「R3 启用时须分派 R 角色 ≥3 次」改为「无条件须分派 R 角色 ≥3 次」。

- [ ] **Step 4: 扩展 #35（含 R3 产物混合）**

定位 #35 节，self-as-verifier 模式产物混合清单新增「PreventiveReview JSON 须独立产出，不得与 S 产出混合」。

- [ ] **Step 5: 新增 #42**

在 #41 之后追加：

```markdown
### #42 S-fix / emergency-fix 后跳过 R3+V

**症状**：S-fix（返工变体）或 S-emergency-fix（紧急修复变体）产出后，未派遣 R3×3（completeness/reliability/security）+ V 评审，直接进入 G 门禁或放行。

**为何是反模式**：第29轮升级后，R3 预防性审查对所有 S 变体无条件强制。「修复就是小改不用审」「紧急救援优先跳过审查」属合理化借口——修复恰好是引入回归风险最高的环节，紧急修复往往跳过完整设计审查，更需要 R3 三维度（完整性/可靠性/安全性）兜底。跳过 R3+V 的修复等于未经验证直接合入。

**检测信号**：
- run-log 中 `action=fix` 或 `action=emergency-fix` 后无 3 条 R3 记录直接出现 `action=review` role=V
- `check-run-log.ts` R8 报「S(fix)→V 之间 R3 记录不足」
- `check-role-dispatch.ts` 报「阶段 N 缺失 role=R」
- `check-preventive-review.ts --variant=fix/emergency` 报告路径缺失

**回退动作**：回到 S-fix / emergency-fix 产出后起点，补跑 R3×3 + V，V 通过后才可 G 门禁。
```

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add w-model-dev/references/anti-patterns.md
git commit -m "docs(anti-patterns): strengthen #33/#34/#35 + add #42 (round 29)"
```

---

## Task 5: self-test 样本与用例同步

**Files:**
- Modify: `w-model-dev/scripts/self-test.ts`
- Modify: `w-model-dev/scripts/samples/run-log/bad-missing-R-role.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/bad-fix-missing-r3.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/bad-emergency-missing-r3.jsonl`

- [ ] **Step 1: 修改 `RoleDispatchCase` 接口与现有用例**

`RoleDispatchCase` 删除 `r3Enabled` 字段（无条件，字段无意义）。`runRoleDispatchCases` 中调用改为 `checkRoleDispatch(entries)`（不传 r3Enabled）。`bad-missing-R-role.jsonl` 用例描述改为「阶段 1 仅有 1 条 R3 记录，无条件强制应被拦截」。

- [ ] **Step 2: 新增 ROLE_DISPATCH 用例 `bad-fix-missing-r3.jsonl`**

样本内容：phase 5 含 S-fix / V / G 但 R 仅 1 条，期望失败，reason 匹配 `/缺失 role=R/`。

- [ ] **Step 3: 新增 run-log R8 用例 `bad-emergency-missing-r3.jsonl`**

样本内容：phase 5 含 S-emergency-fix → V 但中间无 R3，期望 run-log-logic 失败，reason 匹配 `/R3 记录校验失败.*emergency-fix/`。此样本走 run-log-logic 测试路径（若 self-test 有 run-log 用例 runner，否则仅 vitest 覆盖）。

- [ ] **Step 4: 运行 self-test 确认全通过**

Run: `cd /workspace && npx tsx w-model-dev/scripts/self-test.ts 2>&1 | tail -30`
Expected: 全通过，用例计数 ≥ 218。

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add w-model-dev/scripts/self-test.ts w-model-dev/scripts/samples/run-log/
git commit -m "test(self-test): sync role-dispatch unconditional + add fix/emergency samples (round 29)"
```

---

## Task 6: SKILL.md 约束 #12/#17/#19 + 版本号

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 约束 #12 删除「（R3 启用时）」**

定位第49行约束 #12，`check-preventive-review.ts`（R3 启用时）→ `check-preventive-review.ts`（无条件）。5 脚本列表不变。

- [ ] **Step 2: 约束 #17 删除「启用时」+ 新增 S 变体覆盖**

定位第54行约束 #17，删除「启用时」措辞，新增「含 S-fix / emergency-fix（第29轮升级为无条件强制）」。

- [ ] **Step 3: 约束 #19 删除「R3 启用时须分派 R 角色」**

定位第56行约束 #19，「R3 启用时须分派 R 角色」改为「无条件须分派 R 角色 ≥3 次」。

- [ ] **Step 4: 版本号 27.0.0 → 28.0.0**

定位第3行 frontmatter `version: 27.0.0` → `28.0.0`。

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add w-model-dev/SKILL.md
git commit -m "docs(skill): constraints #12/#17/#19 unconditional R3 + bump to 28.0.0 (round 29)"
```

---

## Task 7: subagent-delegation.md 紧急修复通道改前置 + 删除「启用时」

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: 删除「R3 预防性审查分派模板」节「启用时」措辞**

改为无条件。

- [ ] **Step 2: 「角色分派完整性校验」表 R 行「必分派条件」改为「无条件必须」**

- [ ] **Step 3: 「S 兼 F 修复分派模板（返工变体）」节新增 R3+V 前置条款**

新增：「产出后须 R3×3 → V → G（第29轮：S-fix 与标准 S 一视同仁，不得跳过 R3+V）」。

- [ ] **Step 4: 「S 子代理修改既有产物的边界」节紧急修复通道改前置**

移除「修复时记 needsReview=true，阶段完成后由 R 复核」机制，改为「emergency-fix 与其他 S 变体一视同仁：前置 R3×3 + V + G」。保留 `variant=emergency-fix` + `blocker` 字段用于审计说明。

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(subagent-delegation): emergency-fix front-load R3+V + remove 'when enabled' (round 29)"
```

---

## Task 8: phase-1~8-*.md 删除「启用时」措辞

**Files:**
- Modify: `w-model-dev/references/phase-1-*.md` ... `phase-8-*.md`

- [ ] **Step 1: 全局搜索「启用时」「R3 启用」措辞**

Run: `cd /workspace && grep -rn "R3 启用\|启用时" w-model-dev/references/phase-*.md`

- [ ] **Step 2: 逐文件改为无条件强制**

将「R3 启用时须...」改为「须...（无条件）」。删除「启用时」字样。

- [ ] **Step 3: Commit**

```bash
cd /workspace
git add w-model-dev/references/phase-*.md
git commit -m "docs(phase): remove 'when R3 enabled' wording (round 29)"
```

---

## Task 9: SSoT 同步

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: §3.4.18 #17 改为无条件**

定位 §3.4.18 约束 #17，删除「（启用时）」，改为「无条件强制（所有 S 变体，含 S-fix / emergency-fix）」。

- [ ] **Step 2: §3.4.20 P0.2 约束 #19 改为无条件**

「R3 启用时须分派 R 角色」→「无条件须分派 R 角色 ≥3 次」。

- [ ] **Step 3: 新增 §3.4.25 第29轮条目**

在 §3.4.24（第28轮）之后追加 §3.4.25，记录本轮变更要点 + 追溯表新增一行。

- [ ] **Step 4: §10F/§10I 约束/反模式总表同步**

#33/#34/#35 强化，#42 新增。

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): round 29 R3 unconditional + #42 anti-pattern (round 29)"
```

---

## Task 10: 版本号三处同步 + 回归测试

**Files:**
- Modify: `package.json`
- Modify: `w-model-dev/skill-metadata.json`

- [ ] **Step 1: package.json 版本号 27.0.0 → 28.0.0**

- [ ] **Step 2: skill-metadata.json 版本号同步**

- [ ] **Step 3: 运行 vitest 全套**

Run: `cd /workspace && npx vitest run 2>&1 | tail -30`
Expected: 全通过，测试数 ≥ 280。

- [ ] **Step 4: 运行 self-test**

Run: `cd /workspace && npx tsx w-model-dev/scripts/self-test.ts 2>&1 | tail -30`
Expected: 全通过，用例数 ≥ 218。

- [ ] **Step 5: 运行 pre-push（若存在）**

Run: `cd /workspace && ls w-model-dev/scripts/pre-push* 2>/dev/null || ls w-model-dev/scripts/check-all* 2>/dev/null`
若存在 pre-push 脚本，运行之；11 项门禁全 exitCode=0。

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add package.json w-model-dev/skill-metadata.json
git commit -m "chore: bump version to 28.0.0 (round 29)"
```

---

## Task 11: 同步 README/AGENTS/INSTALL/CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `INSTALL.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CHANGELOG.md 新增 28.0.0 条目**

记录：R3 无条件强制、覆盖 S-fix/emergency-fix、新增反模式 #42、强化 #33/#34/#35。

- [ ] **Step 2: README.md 同步约束摘要**

若 README 含约束摘要表，#17/#19 同步无条件措辞。

- [ ] **Step 3: AGENTS.md 同步（若含 R3 相关条款）**

- [ ] **Step 4: INSTALL.md 同步版本号**

- [ ] **Step 5: 最终全量回归**

Run: `cd /workspace && npx vitest run 2>&1 | tail -10 && npx tsx w-model-dev/scripts/self-test.ts 2>&1 | tail -10`
Expected: 全通过。

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add README.md AGENTS.md INSTALL.md CHANGELOG.md
git commit -m "docs: sync README/AGENTS/INSTALL/CHANGELOG for 28.0.0 (round 29)"
```

---

## Self-Review

**1. Spec coverage:**
- §2.1 R3 无条件 → Task 1 (role-dispatch) + Task 9 (SSoT)
- §2.2 S 变体覆盖 → Task 3 (run-log fix/emergency) + Task 5 (samples)
- §2.3 emergency 前置 → Task 7 (subagent-delegation) + Task 4 (#42)
- §3.1 check-role-dispatch → Task 1
- §3.2 check-preventive-review → Task 2
- §3.3 check-run-log → Task 3
- §4.1-4.4 反模式 → Task 4
- §5.1 SSoT → Task 9
- §5.2 subagent-delegation → Task 7
- §5.3 SKILL → Task 6
- §5.4 anti-patterns → Task 4
- §5.5 phase-* → Task 8
- §6 版本与回归 → Task 10
- §7 验收 → Task 10/11 回归

**2. Placeholder scan:** 无 TBD/TODO，所有代码块完整。

**3. Type consistency:** `checkRoleDispatch(entries)` 签名一致；`checkPreventiveReview(reviews, phase, options)` 一致；`S_VARIANTS` 数组在 Task 3 唯一定义。
