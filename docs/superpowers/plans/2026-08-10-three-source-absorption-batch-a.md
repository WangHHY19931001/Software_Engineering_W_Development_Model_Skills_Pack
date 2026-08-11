# 三源吸收批次 A（P0，40.0.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地三源吸收 P0 强吸收项 16 项：坏味道清单（评审/编码双轨）、测试规范、复现测试、agentic 4 项（轨迹模板/简报质疑权/协作评审维度/HOTL 授权）、反模式 #47、命名约定，版本 39.2.0 → 40.0.0。

**Architecture:** 纯文档为主（14 项）+ 2 处脚本联动（check-run-log.ts 新增 R8 轨迹模板校验、docs-consistency-logic.ts 反模式期望 46→47）；坏味道/并发检查采用"语言静态工具 + LLM 语义评审"双轨，不新增自研 AST 脚本。所有文档改动挂接既有节结构，不新建并行轨。

**Tech Stack:** Markdown、TypeScript（tsx runtime）、vitest、ajv。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-three-source-absorption-design.md`

**版本级联:** 39.2.0 → 40.0.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `.cursor/skills/chinese-code-review/SKILL.md` | 新增「坏味道检查清单」节（V 评审"审什么"） |
| `w-model-dev/references/code-smells-checklist.md` | **新建**：Clean-Code ch17 六组 + Refactoring ch3 合并评审清单 |
| `w-model-dev/references/phase-5-coding.md` | 禁止行为表扩 5 条 + 断言规范/重构纪律/测试基线/第三方边界/静态工具接入 5 节 |
| `w-model-dev/references/quality-standards.md` | 测试代码整洁标准 + 函数与错误处理规范 + 性能三法 3 小节 |
| `.cursor/skills/test-driven-development/SKILL.md` | 补 4 条：故意失败验证/夹具独立/边界清单/failure vs error |
| `w-model-dev/references/root-cause-locator.md` | 补「复现测试强制」节 + 覆盖空洞线索 |
| `w-model-dev/references/anti-patterns.md` | 新增反模式 #47；计数 46→47（7 处） |
| `w-model-dev/references/subagent-delegation.md` | 新增「S 子代理简报质疑权」节 |
| `w-model-dev/references/operational-recovery.md` | 新增「HOTL 规则化授权」节 |
| `w-model-dev/references/verifier-spec.md` | 新增「多子代理协作评审维度」R14-R17 节 |
| `w-model-dev/references/format-conventions.md` | 第 6 节「命名约定」 |
| `w-model-dev/scripts/logic/run-log-logic.ts` | 新增 R8 轨迹模板校验（纯逻辑） |
| `w-model-dev/scripts/cli/check-run-log.ts` | R8 报告文案 + 摘要 |
| `w-model-dev/scripts/__tests__/run-log-logic.test.ts` | 新增 R8 用例（TDD） |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts` | EXPECTED.maxAntiPattern 46→47 |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 样本 #1~#46 → #1~#47 |
| `w-model-dev/references/clean-code-refactoring-agentic-absorption.md` | **新建**：吸收决策记录 |
| `docs/skill-design-document_SSoT.md` | §3.4.40 + §10A 追溯表补行 |
| `w-model-dev/SKILL.md` | Bundled Resources 挂新 reference |
| `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `skill-metadata.json` | 级联（反模式计数、新 reference、版本号） |

---

### Task 1: TDD red — run-log-logic R8 轨迹模板校验（失败测试）

**Files:**
- Modify: `w-model-dev/scripts/__tests__/run-log-logic.test.ts`

- [ ] **Step 1: 追加 R8 测试 describe 块**

在文件末尾追加以下 describe 块（复用既有 `makeEntry`/`makeR3` 辅助函数；若文件无这些辅助函数，先读文件顶部确认既有样本构造方式并沿用）：

```typescript
describe('run-log R8 轨迹模板校验（第 40 轮三源吸收：agentic Ch19 轨迹符合性）', () => {
  it('已完成阶段 gate 在 checkpoint 之后 → 违规', () => {
    const lines = [
      makeEntry({ runId: 'r1', phase: 1, action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: 'r2', phase: 1, action: 'review', role: 'V', outcome: 'success' }),
      makeEntry({ runId: 'r3', phase: 1, action: 'checkpoint', role: 'O', outcome: 'success', acknowledgedDecisions: ['ok'] }),
      makeEntry({ runId: 'r4', phase: 1, action: 'gate', role: 'G', outcome: 'success', gateExitCode: 0, script: 'check-artifact-gate.ts' }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*gate.*checkpoint/.test(v))).toBe(true);
  });

  it('V 失败后无 rootcause 直接 S-fix → 违规（反模式 #18 轨迹检测）', () => {
    const lines = [
      makeEntry({ runId: 'r1', phase: 1, action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: 'r2', phase: 1, action: 'review', role: 'V', outcome: 'fail' }),
      makeEntry({ runId: 'r3', phase: 1, action: 'fix', role: 'S', outcome: 'rework', basedOnReport: 'RC-1' }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*rootcause/.test(v))).toBe(true);
  });

  it('checkpoint 非阶段最后记录 → 违规', () => {
    const lines = [
      makeEntry({ runId: 'r1', phase: 1, action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: 'r2', phase: 1, action: 'checkpoint', role: 'O', outcome: 'success', acknowledgedDecisions: ['ok'] }),
      makeEntry({ runId: 'r3', phase: 1, action: 'review', role: 'V', outcome: 'success' }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*checkpoint/.test(v))).toBe(true);
  });

  it('理想轨迹 produce→V→G→checkpoint 通过', () => {
    const lines = [
      makeEntry({ runId: 'r1', phase: 1, action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: 'r2', phase: 1, action: 'review', role: 'V', outcome: 'success' }),
      makeEntry({ runId: 'r3', phase: 1, action: 'gate', role: 'G', outcome: 'success', gateExitCode: 0, script: 'check-artifact-gate.ts' }),
      makeEntry({ runId: 'r4', phase: 1, action: 'checkpoint', role: 'O', outcome: 'success', acknowledgedDecisions: ['ok'] }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });
});
```

> 若文件已有 `makeEntry` 辅助函数但签名不同（如接收对象拼默认值），以既有签名为准调整上例调用；**不得改动既有辅助函数签名**，仅新增条目字段以最小差异构造。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: 4 个新用例失败（R8 未实现 → 不产生 R8 违规 → 断言失败）；其余用例仍通过。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/run-log-logic.test.ts
git commit -m "test: add failing run-log R8 trajectory template checks (TDD red)"
```

### Task 2: 实现 R8 轨迹模板校验（run-log-logic.ts）

**Files:**
- Modify: `w-model-dev/scripts/logic/run-log-logic.ts`

- [ ] **Step 1: 在 R7 扩展之后、`return` 之前插入 R8 块**

定位 `// R7 扩展：返工路径时序 rootcause → review(targetKind=rootcause) → fix（spec §7.6）` 的 for 循环结束处（约 L424 的 `}` 之后），在 `return { passed: violations.length === 0, violations };` 之前插入：

```typescript
  // R8 轨迹模板校验（第 40 轮三源吸收：agentic Ch19 轨迹符合性）
  // 理想阶段轨迹：S 变体(produce/fix/emergency-fix) → R3×3 → V(review) → G(gate 类) → checkpoint(阶段最后)。
  // 从「时序正确」（R7）升级为「轨迹正确」：偏离理想动作序列即违规。
  const GATE_ACTIONS = new Set(['gate', 'tla-gate', 'graph-gate']);
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter(e => e.phase === phase);
    const checkpointIndexes = phaseEntries
      .map((e, i) => (e.action === 'checkpoint' && e.outcome === 'success' ? i : -1))
      .filter(i => i >= 0);
    const lastCheckpoint = checkpointIndexes.length > 0 ? checkpointIndexes[checkpointIndexes.length - 1] : -1;

    // R8-1: checkpoint 必须是该阶段最后一条记录（阶段结束后再无后续动作）
    if (lastCheckpoint >= 0 && lastCheckpoint !== phaseEntries.length - 1) {
      violations.push(
        `R8: 阶段 ${phase} checkpoint 非阶段最后记录（checkpoint 之后仍有 ${phaseEntries.length - 1 - lastCheckpoint} 条动作，理想轨迹中 checkpoint 为阶段终点）`,
      );
    }

    // R8-2: gate 类动作必须出现在最后一个 checkpoint 之前
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (entry && GATE_ACTIONS.has(entry.action) && lastCheckpoint >= 0 && i > lastCheckpoint) {
        violations.push(
          `R8: 阶段 ${phase} gate 动作(${entry.action})出现在 checkpoint 之后，理想轨迹中 gate 先于 checkpoint`,
        );
      }
    }

    // R8-3: V(review) 失败后不得直接 S 变体——须先 rootcause（反模式 #18 轨迹检测）
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (!entry || entry.action !== 'review' || entry.outcome !== 'fail') continue;
      for (let j = i + 1; j < phaseEntries.length; j++) {
        const next = phaseEntries[j];
        if (!next) continue;
        if (next.action === 'rootcause') break; // 正确路径：先 R 再 S-fix
        if (S_VARIANTS.includes(next.action)) {
          violations.push(
            `R8: 阶段 ${phase} V(review) 失败(${entry.runId})后直接 S(${next.action})(${next.runId})，理想轨迹须先 rootcause 再 S-fix（反模式 #18）`,
          );
          break;
        }
        if (next.action === 'checkpoint' && next.outcome === 'success') break; // 阶段结束，不再追溯
      }
    }
  }
```

> `S_VARIANTS` 已在 R3 节定义（`['produce', 'fix', 'emergency-fix']`），复用即可，勿重复声明。

- [ ] **Step 2: 更新文件头注释**

文件头注释（L6-8）末尾追加一行：

```
 *       + R8 轨迹模板校验（理想阶段轨迹：S→R3×3→V→G→checkpoint）
```

- [ ] **Step 3: 运行确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: 全部用例通过（含 4 个新用例）。

Run: `npx tsc --noEmit` — 0 错误。

- [ ] **Step 4: 全量回归**

Run: `npx vitest run`
Expected: 35 files 全过（注意：样本/既有用例可能触发新 R8 逻辑——若既有合法样本出现 checkpoint 非最后记录等，属预期破坏，须按样本语义调整样本或放宽规则，在 commit 说明中记录）。

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts
git commit -m "feat: add R8 trajectory template check to run-log-logic (TDD green)"
```

### Task 3: check-run-log.ts 报告文案 + 摘要

**Files:**
- Modify: `w-model-dev/scripts/cli/check-run-log.ts`

- [ ] **Step 1: 更新输出描述**

`main()` 中 L187 的通过文案：

`'运行日志符合 data-models.md RunLogEntry schema：动作完整 + tokens 合规 + 返工一致 + 无 O 越权 + exitCode 一致 + append-only。'`
→ `'运行日志符合 data-models.md RunLogEntry schema：动作完整 + tokens 合规 + 返工一致 + 无 O 越权 + exitCode 一致 + append-only + 轨迹符合。'`

- [ ] **Step 2: 更新处置提示**

L194 的处置提示追加：

`'（补全动作记录 / 修正 tokens / 对齐返工计数 / 补 acknowledgedDecisions / 停止越权 / 修正 exitCode / 恢复 append-only / 对齐理想轨迹，详见 w-model-dev/references/operational-recovery.md §5.2）'`

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit` — 0 错误。
```bash
git add w-model-dev/scripts/cli/check-run-log.ts
git commit -m "docs: surface R8 trajectory check in check-run-log report"
```

### Task 4: 反模式 #47 级联 — docs-consistency 期望值 46→47

**Files:**
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **Step 1: logic 期望值**

`EXPECTED` 中 `maxAntiPattern: 46,` → `maxAntiPattern: 47,`

- [ ] **Step 2: 测试样本更新**

`docs-consistency-logic.test.ts` L21 baseInput 默认值 `antiPatterns: '反模式清单（#1~#46；\n| 46 | 冰山扫掠... |',` → `antiPatterns: '反模式清单（#1~#47；\n| 47 | 大规模重构... |',`；L119 断言 `message.includes('46')` → `message.includes('47')`。

- [ ] **Step 3: 验证**

Run: `npx vitest run w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 通过。
Run: `npx tsc --noEmit` — 0 错误。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "feat: bump expected max anti-pattern 46->47 for #47"
```

### Task 5: anti-patterns.md 新增反模式 #47（大规模重构式改动）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 反模式清单表尾新增行**

定位清单表（L18-67 之间）最后一行 `| 46 | 只给审计权不给修正权...` 之后追加：

```
| 47 | 大规模重构式改动（单次 diff 重写整个模块，第40轮新增） | 变更量子无穷大，"这次改了什么"在结构上不可问 | 小步重构 + 每步保持可编译可测试（增量集成纪律）；一次性 diff 拆分为多个可审 slice |
```

- [ ] **Step 2: 检测信号与回退动作表尾新增行**

定位「检测信号与回退动作」表（L117 附近）最后一行之后追加：

```
| #47（大规模重构式改动） | 阶段 5 | 单次 diff 重写整个模块 → 拆分为可审 slice 逐片提交，保持每片可编译可测试 |
```

- [ ] **Step 3: 门禁脚本表尾新增行**

定位「与门禁脚本的对应关系」表（L164 附近）最后一行之后追加：

```
| #47（大规模重构式改动） | 无专用脚本（diff 可审性由评审人工核验 + 增量集成纪律约束） |
```

- [ ] **Step 4: detailed 节追加 #47**

在 `## #46 只给审计权不给修正权（第 39 轮新增）` 节（L709-726）之后、`## 实现层经验教训` 之前追加：

```
## #47 大规模重构式改动（第 40 轮新增）

**症状**：单次 diff 重写整个模块/大面积重构与非目标功能改动混杂；变更量子无穷大，评审无法回答"这次改了什么"。

**为何是反模式**：增量主义的反面——大规模重构会毁掉程序（Clean-Code ch14《On Incrementalism》）；"这次改了什么"在结构上不可问时，diff 不复存在，回归也无法定位。

**检测信号**：
- 单次 diff 覆盖整个模块（新增/删除行数占文件 50%+）
- 重构与非目标功能改动在同一 commit
- 无法为该 diff 指出单一职责

**回退动作**：回到当前阶段起点，将改动拆分为多个可审 slice（每片保持可编译可测试 + 跑回归），逐片提交。

**例外**：新建文件的首次落地（无历史 diff 可比）不适用。

**门禁脚本**：无专用脚本（diff 可审性由评审人工核验 + 增量集成纪律约束）

**关联**：SSoT §3.4.40（[40.0.0] 新增）；[phase-5-coding.md](phase-5-coding.md)「增量集成纪律」节；反模式 #21（阶段级门禁跳过）
```

- [ ] **Step 5: 计数联动（anti-patterns.md 内 7 处）**

将文件中所有 `#1~#46` → `#1~#47`、`46 条流程反模式` → `47 条流程反模式`、`与 46 条流程反模式` → `与 47 条流程反模式`、`已收录的 #1~#46` → `已收录的 #1~#47`、`正式加入 #1~#46` → `正式加入 #1~#47`（覆盖 L9/L755/L778/L813/L816/L875/L897 共 7 处；L117/L164 为 #47 新行不含计数）。

- [ ] **Step 6: 验证 + Commit**

Grep 确认 `#1~#47` 连续区间存在、无 `#1~#46` 残留（anti-patterns.md 内）。
```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(anti-patterns): add #47 large-scale refactor, bump count to 47"
```

### Task 6: 新建 code-smells-checklist.md（评审清单）

**Files:**
- Create: `w-model-dev/references/code-smells-checklist.md`

- [ ] **Step 1: 写入文件**

内容为 Clean-Code ch17 六组（C/E/F/G/N/T）与 Refactoring ch3 合并的评审清单。结构：

```markdown
# 代码坏味道检查清单（Code Smells Checklist）

> 第 40 轮三源吸收：合并《代码整洁之道》ch17（六组启发式 C/E/F/G/N/T）与《重构 2》ch3（24 种坏味道）。
> 用途：V-code 评审子代理按此清单检查（LLM 语义理解）；S-coding 子代理编码自检。
> 与 [anti-patterns.md](anti-patterns.md) 的关系：反模式是流程破坏（命中回退）；本清单是代码结构坏味道（评审标注，不触发阶段回退）。

## 用法

1. V-code 评审时逐组扫描目标代码，命中项按「分级」标注（[必须修复]/[建议修改]/[仅供参考]）。
2. 命中项写入 VerifierOutput 的 reworkHints，引用本清单条目号。
3. 机械规则（函数长度/参数个数/重复片段）由项目语言静态检查工具先行扫描，本清单聚焦语义层。

## 组 C：注释（Clean-Code ch17 C1-C5）

| 条目 | 检测信号 | 分级 | 对应 Refactoring 味道 |
|---|---|---|---|
| C1 不恰当的信息 | 注释描述了应记录在版本控制/issue 的信息 | 建议修改 | — |
| C2 废弃的注释 | 注释与代码现状不符 | 必须修复 | — |
| C3 冗余注释 | 注释复述代码本身（what） | 建议修改 | — |
| C4 糟糕的注释 | 注释表达不清、误导 | 必须修复 | — |
| C5 注释掉的代码 | 被注释的代码块 | 必须修复 | 注释（ch3.24） |

## 组 E：环境（Clean-Code ch17 E1-E2）

| 条目 | 检测信号 | 分级 |
|---|---|---|
| E1 需要多步才能构建 | 构建步骤未脚本化 | 建议修改 |
| E2 需要多步才能测试 | 测试运行未一键化 | 建议修改 |

## 组 F：函数（Clean-Code ch17 F1-F4）

| 条目 | 检测信号 | 分级 | 对应 Refactoring 味道 |
|---|---|---|---|
| F1 参数过多 | 函数参数超过 3 个（尤其布尔标记参数） | 必须修复 | 过长参数列表（ch3.5）/布尔标记参数（ch11.3） |
| F2 输出参数 | 用参数传出结果而非返回值 | 建议修改 | — |
| F3 标识参数 | 布尔参数控制两套行为 | 必须修复 | 标记参数 |
| F4 死函数 | 未被调用的函数 | 建议修改 | 冗赘元素（ch3.10） |

## 组 G：通用（Clean-Code ch17 G1-G36，精选 14 条）

| 条目 | 检测信号 | 分级 | 对应 Refactoring 味道 |
|---|---|---|---|
| G5 重复 | 相似代码段重复出现（DRY 首要） | 必须修复 | 重复代码（ch3.2） |
| G7 模糊意图 | 命名/结构不表达意图 | 建议修改 | 神秘命名（ch3.1） |
| G8 错误地做对的事 | 巧合正确、缺乏防御 | 建议修改 | — |
| G14 选择性参数 | 调用者必须查文档才能用 | 建议修改 | — |
| G16 不恰当的静态方法 | 静态方法与实例语义不符 | 建议修改 | — |
| G20 重复的抽象 | 多处重复相同的抽象/常量 | 建议修改 | — |
| G22 过度表达 | 命名含冗余信息 | 仅供参考 | — |
| G24 跟随约定 | 违反团队既有约定 | 建议修改 | — |
| G25 用命名常量代替魔法数 | 裸魔法数 | 必须修复 | 基本类型偏执（ch3.8） |
| G27 结构优于约定 | 用约定而非结构强制 | 建议修改 | — |
| G28 封装条件 | 裸 if 条件表达式 | 建议修改 | — |
| G29 避免否定条件 | `if (!isNotX)` 类双重否定 | 仅供参考 | — |
| G30 函数只做一件事 | 函数混多职责 | 必须修复 | 过长函数/发散式变化 |
| G34 函数只降一层抽象 | 抽象层级跳跃 | 建议修改 | — |

## 组 N：命名（Clean-Code ch17 N1-N7）

| 条目 | 检测信号 | 分级 | 对应 Refactoring 味道 |
|---|---|---|---|
| N1 选择描述性名称 | 名称不描述意图 | 必须修复 | 神秘命名 |
| N2 名称与抽象层级一致 | 名称误导层级 | 建议修改 | — |
| N3 使用标准命名 | 不用领域标准术语 | 建议修改 | — |
| N4 无歧义名称 | 一词多义 | 建议修改 | — |
| N5 为长名称使用较长范围 | 短名用在大作用域 | 建议修改 | — |
| N6 编码前缀 | `m_`/`str` 等匈牙利前缀 | 仅供参考 | — |
| N7 名称描述副作用 | 名称掩盖副作用 | 必须修复 | 命令与查询分离 |

## 组 T：测试（Clean-Code ch17 T1-T9）

| 条目 | 检测信号 | 分级 |
|---|---|---|
| T1 测试不足 | 明显分支/边界未测 | 必须修复 |
| T2 使用覆盖率工具 | 未用覆盖率工具发现空洞 | 建议修改 |
| T4 快速测试 | 测试缓慢 | 建议修改 |
| T5 每个边界一个测试 | 边界合并进 happy path | 建议修改 |
| T7 失败模式揭示问题 | 测试失败模式未被用于根因定位 | 建议修改 |

## 补充：Refactoring ch3 独有坏味道（未并入上表）

| 味道 | 检测信号 | 分级 | 推荐手法 |
|---|---|---|---|
| 霰弹式修改 | 一改动散落多处 | 必须修复 | 搬移函数/字段（ch8） |
| 依恋情结 | 方法频繁访问其他对象数据 | 建议修改 | 搬移函数/提炼函数（ch6/ch8） |
| 数据泥团 | 数据项总是一起出现 | 建议修改 | 提炼类/引入参数对象（ch7） |
| 发散式变化 | 一个类因多个原因修改 | 必须修复 | 拆分阶段/拆分循环 |
| 中间人 | 对象大量转发调用 | 仅供参考 | 移除中间人/内联函数 |
| 内幕交易 | 模块间私下交换数据 | 建议修改 | 搬移函数/隐藏委托 |
| 被拒绝的遗赠 | 子类不用父类多数成员 | 仅供参考 | 以委托取代继承 |
| 纯数据类 | 只有 getter/setter 无行为 | 建议修改 | 搬移函数入类 |
| 临时字段 | 仅特定场景使用的字段 | 建议修改 | 提炼类/引入特例 |
| 消息链 | `a.b().c().d()` 长链 | 建议修改 | 隐藏委托 |

## 参考

- 重构手法速查见 [refactoring-catalog.md](refactoring-catalog.md)（第 40 轮批次 C 新建，P2）
- 并发专项检查见 [concurrency-guide.md](concurrency-guide.md)（第 40 轮批次 C 新建，P2）
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/code-smells-checklist.md
git commit -m "feat: add code-smells-checklist reference (Clean-Code ch17 + Refactoring ch3)"
```

### Task 7: chinese-code-review 技能新增「坏味道检查清单」节

**Files:**
- Modify: `.cursor/skills/chinese-code-review/SKILL.md`

- [ ] **Step 1: 在文件末尾追加节**

```markdown
## 坏味道检查清单（第 40 轮三源吸收）

> 评审"审什么"的结构化清单。完整清单见 `w-model-dev/references/code-smells-checklist.md`；本节为高频 TOP 12 摘要（与 AI 生成代码最相关）。
> 用法：评审时逐条扫描目标代码，命中项用既有分级标注（[必须修复]/[建议修改]/[仅供参考]）并引用条目。

| # | 坏味道 | 检测信号 | 分级 | 对应重构手法 |
|---|---|---|---|---|
| 1 | 重复代码 | 相似代码段重复 ≥2 处 | 必须修复 | 提炼函数 / 提取类 |
| 2 | 过长函数 | 单函数超 ~40 行 / 多层嵌套 | 必须修复 | 提炼函数（意图与实现分离） |
| 3 | 过长参数列表 | 参数 >3 个 | 建议修改 | 引入参数对象 / 保持对象完整 |
| 4 | 布尔标记参数 | `fn(x, true)` 控制两套行为 | 必须修复 | 移除标记参数 / 拆函数 |
| 5 | 副作用与查询混合 | 有返回值函数还改状态 | 必须修复 | 命令与查询分离 |
| 6 | 全局/可变数据 | 裸全局变量 / 广泛共享可变状态 | 必须修复 | 封装变量 |
| 7 | 依恋情结 | 方法频繁访问他对象数据 | 建议修改 | 搬移函数 |
| 8 | 数据泥团 | 数据项总一起出现 | 建议修改 | 提炼类 / 引入参数对象 |
| 9 | 基本类型偏执 | 魔法数 / 裸字符串散落 | 建议修改 | 以对象取代基本类型 / 命名常量 |
| 10 | 夸夸其谈通用性 | 为假设需求建的抽象 | 建议修改 | 折叠层次 / 内联 |
| 11 | 注释除臭剂 | 注释复述代码 what | 建议修改 | 重构让注释多余 |
| 12 | 纯数据类 | 只有 getter/setter 无行为 | 建议修改 | 搬移函数入类 |
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add .cursor/skills/chinese-code-review/SKILL.md
git commit -m "feat(chinese-code-review): add bad-smell checklist section (P0 absorption)"
```

### Task 8: phase-5-coding.md 编码规范扩展（6 处）

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

- [ ] **Step 1: 禁止行为表扩 5 条（L339 之后追加）**

```
| 9 | 复制粘贴重复代码段 | 须提炼函数/类消除重复（坏味道清单 #1，第 40 轮吸收） |
| 10 | 单函数超 ~40 行不拆分 | 按单一职责拆分，保持函数短小（坏味道清单 #2） |
| 11 | 使用布尔标记参数 | 拆分为两个意图明确的函数或枚举参数（坏味道清单 #4） |
| 12 | 有返回值函数还产生可见副作用 | 命令与查询分离：有返回值的函数不修改状态（坏味道清单 #5） |
| 13 | 裸全局可变数据跨模块共享 | 封装变量 / 限制共享数据作用域（坏味道清单 #6 + concurrency-guide） |
```

- [ ] **Step 2: 「断言规范」节（追加在副作用时序一致性清单之后）**

```markdown
## 断言规范（第 40 轮三源吸收）

> 吸收自《重构 2》ch10.6「引入断言」：断言标注"必须为真"的假设，失败表示程序员错误，不应被捕获。

- **内部假设用断言**：前置条件/不变式（如"此值恒非负"）用断言表达，放设值函数（错误源头）优于使用点。
- **外部输入用一等校验**：用户输入/外部服务数据须显式校验并返回错误，不得用断言代替（断言失败 = 崩溃，不适合用户输入）。
- **断言失败不捕获**：断言表示代码错误，捕获即掩盖；禁止 `try { assert(...) } catch {}`。
```

- [ ] **Step 3: 「重构纪律」节（追加在断言规范之后）**

```markdown
## 重构纪律（第 40 轮三源吸收）

> 吸收自《重构 2》ch2：两顶帽子 / 三次法则 / 何时不该重构。

- **两顶帽子**：添加功能 vs 重构是两种状态；重构时不加功能、不加测试，切换时明确当前戴哪顶帽子。
- **三次法则**：事不过三——第一次照做、第二次反感但做、第三次重构。
- **何时不该重构**：① 代码凌乱但无需修改且可藏在接口后 → 不动；② 重写比重构容易 → 重写（但须先建测试基线）。
- **营地法则边界**：顺手的小清理限本次改动触及的代码半径内（与操作行为 #5 划界）；大清理记便笺另立票据。
```

- [ ] **Step 4: 「改动前测试基线」节（追加在重构纪律之后）**

```markdown
## 改动前测试基线（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch16：重构遗留/不熟代码前先跑覆盖率工具测基线（案例 50%→92%），自己写独立测试补足，再动手改。

- **改动前确认覆盖基线**：对即将修改的模块先跑覆盖率工具 + 既有测试，确认改动前基线。
- **缺口先补**：基线覆盖率低的模块，先补关键路径测试再动手，避免改动后无法区分"新 bug vs 旧债"。
- **与约束 #21 的关系**：约束 #21 管"改动后必跑回归"，本节补"改动前基线"形成闭环。
```

- [ ] **Step 5: 「第三方代码边界管理 + 学习性测试」节（追加在改动前测试基线之后）**

```markdown
## 第三方代码边界管理（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch8「边界」。

- **封装边界接口**：第三方类型（如 Map/客户端对象）不跨系统传递，只在少数边界点引用，用包装/ADAPTER 隔离。
- **学习性测试**：用测试学习第三方 API 行为；在库升级时自动检测行为变化（写入 phase-6 集成测试对第三方依赖执行）。
- **使用尚不存在的代码**：接口契约未定时先定义"我想要的接口"+ ADAPTER 桥接，测试用 Fake，待真实实现就绪再替换。
```

- [ ] **Step 6: 「静态检查工具接入」节（追加在第三方边界之后）**

```markdown
## 静态检查工具接入（第 40 轮三源吸收）

> 用户确认：代码坏味道/并发无法用脚本可靠检查，须用"特定开发语言的静态检查工具 + LLM 语义理解"双轨。

- **机械规则 → 语言静态工具**：编码后须运行项目语言的静态检查工具 + 相关规则集，结果落盘为门禁证据：
  - TypeScript/JS：`eslint`（`max-lines-per-function` / `max-params` / `no-duplicate-imports` 等）+ `tsc --noEmit`
  - Python：`pylint` / `ruff`；Java：`spotbugs` / `PMD`；Go：`golangci-lint`
- **语义坏味道 → LLM 评审**：V-code 评审子代理按 [code-smells-checklist.md](code-smells-checklist.md) 清单执行语义层检查（依恋情结/霰弹式修改/副作用混合/竞态等），命中项标注分级并写入 reworkHints。
- **静态工具结果须真实落盘**：禁止估算"应该没违规"；工具退出码/报告须由 G 子代理核验（约束 #4 真实执行）。
- **工具缺失降级**：项目语言标准工具缺失时，参照 quality-standards.md「工具缺失与降级处理」节——尝试等价工具，仍缺失则 LLM 评审承担全部检查并在评审中注明。
```

- [ ] **Step 7: 验证 + Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "feat(phase-5): add smell bans, assertion norms, refactoring discipline, test baseline, third-party boundary, static-tool hook"
```

### Task 9: quality-standards.md 三小节

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`

- [ ] **Step 1: 「测试代码整洁标准」小节（追加在测试质量标准表之后）**

```markdown
### 测试代码整洁标准（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch9 + 《重构 2》ch4。现有测试标准管覆盖率/用例状态（量），本节管测试代码自身质量（质）。

- **测试与生产代码同等重要**：脏测试=没测试；测试代码三要素=清晰、简洁、表达密度。
- **F.I.R.S.T. 五规则**：Fast（快速）/ Independent（独立）/ Repeatable（可重复）/ Self-Validating（自验证，断言式而非打印比对）/ Timely（及时，先于产品代码）。
- **一概念一测试**：每个测试函数测一个概念；BUILD-OPERATE-CHECK 三段式；断言数最小化。
- **测试夹具独立性**：每测新建 fixture（beforeEach），禁止跨测试共享可变 fixture（共享→时序依赖 bug）。
- **新测试先失败一次**：临时注入错误→确认红→恢复（防"永远通过的假测试"）。
- **风险驱动取舍**：重点测"最担心出错的部分"；不为只读/写字段的简单访问函数写测试。
- **测试充分性 = 主观信心**：判据="若有人引入缺陷，测试集多大可能揪出来？"；改测试时间 > 改代码时间 = 测试过多征兆。
- **边界条件探测**：空集合 / 0 / 负值 / 空字符串 / 最大值。
```

- [ ] **Step 2: 「函数与错误处理规范」小节（追加在测试代码整洁标准之后）**

```markdown
### 函数与错误处理规范（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch3/ch7 + 《重构 2》ch11.1。

- **函数短小、只做一件事**：单抽象层级 + 向下规则（Step-down Rule：调用者在被调用者上方）；函数超 ~40 行视为拆分信号。
- **参数 ≤ 3 且禁 flag**：布尔标记参数拆分为独立函数或枚举参数。
- **指令查询分离**：有返回值的函数不应有可见副作用。
- **异常而非返回码**：先写 try-catch-finally；异常带上下文信息；按调用者需要定义异常类（包装第三方 API）。
- **特例模式**：用特例对象避免返回 null 与层层判空；别返回 null、别传 null（用 Optional/空对象替代）。
- **内部假设用断言、外部输入用一等校验**（见 phase-5-coding.md「断言规范」节）。
```

- [ ] **Step 3: 「性能三法」小节（追加在函数与错误处理规范之后）**

```markdown
### 性能三法（第 40 轮三源吸收）

> 吸收自《重构 2》ch2.8。

1. **时间预算法**：实时系统按预算分配各部件耗时。
2. **持续关注法**：不推荐（与增量重构冲突）。
3. **先写可调优代码再热点调优**：先写风格清晰、易于调优的代码，性能瓶颈出现后再优化；**实际度量不臆测**——优化前必须 profile 定位热点（Ron Jeffries 案例：全凭猜测的优化全错）。
```

- [ ] **Step 4: 验证 + Commit**

```bash
git add w-model-dev/references/quality-standards.md
git commit -m "feat(quality-standards): add test cleanliness, function/error norms, performance three-methods"
```

### Task 10: test-driven-development 技能补 4 条

**Files:**
- Modify: `.cursor/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 在「测试失败先归因」节后追加「测试构筑四则」节**

```markdown
### 测试构筑四则（第 40 轮三源吸收）

> 吸收自《重构 2》ch4。补足红-绿-重构内循环之外的测试构筑纪律。

1. **新测试先失败一次**：每次新增测试，先确认它在该失败时真的失败——临时注入错误 → 确认红 → 恢复。从未看到失败的测试可能是"永远通过的假测试"。
2. **夹具独立性**：每测新建 fixture，禁止跨测试共享可变 fixture。共享 fixture → 测试间交互 → 时序依赖偶发失败（经典 flaky 根因）。
3. **边界条件探测清单**：空集合 / 0 / 负值 / 空字符串 / 最大值。把测试火力集中在边界。
4. **区分 failure 与 error**：断言失败 = failure（逻辑错）；前置阶段抛异常 = error（环境错）。异常输入是否校验取决于数据源可信度：内部模块不滥加校验，外部服务必须校验。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add .cursor/skills/test-driven-development/SKILL.md
git commit -m "feat(tdd): add four test-construction rules (fail-first, fixture independence, boundaries, failure/error)"
```

### Task 11: root-cause-locator.md 补复现测试 + 覆盖空洞线索

**Files:**
- Modify: `w-model-dev/references/root-cause-locator.md`

- [ ] **Step 1: 在「3. R 产出质量标准」节前追加「复现测试强制」节**

```markdown
## 2.5 复现测试强制（第 40 轮三源吸收）

> 吸收自《重构 2》ch4.7：每当你收到 bug 报告，请先写一个单元测试来暴露这个 bug；仅当测试通过才视为 bug 修完。

- **R 报告须附复现测试要求**：R 产出 RootCauseReport 时，须在修复建议中明确要求"先写复现测试再修复"。
- **S-fix 执行顺序**：S-fix 先写复现 bug 的失败测试 → 确认红 → 修复 → 确认绿（与 TDD 技能"测试构筑四则"第 1 条一致）。
- **覆盖空洞是根因线索**（Clean-Code ch16 T7）：测试覆盖空洞/死分支往往是根因位置（如"变量恒为负导致 if 永不执行"）——R 分析时把覆盖报告作为输入之一。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/root-cause-locator.md
git commit -m "feat(root-cause-locator): add reproduction-test mandate and coverage-gap clue"
```

### Task 12: subagent-delegation.md 新增「S 子代理简报质疑权」

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: 在「上下文装填原则」节后追加节**

```markdown
## S 子代理简报质疑权（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch19「承包商模型·协商反馈」：承包商对合约可协商——发现数据源不可达/范围歧义时，先返回质疑，而非硬做或静默改动。

- **S 收到简报先评估可执行性**：依赖缺失 / 上游产物不可达 / 范围歧义 / 简报与当前阶段产物矛盾时，S 须返回质疑清单（含缺失项 + 所需输入 + 建议），不得硬做、不得自行改范围。
- **质疑清单格式**：`blockers[]`（阻断项）+ `assumptions[]`（当前假设）+ `requestedInputs[]`（所需输入）+ `suggestedPath`（建议路径）。
- **O 处置**：收到质疑清单 → 补齐输入或裁决范围 → 重发简报；不得忽略质疑直接派下一个动作。
- **与操作行为的关系**：强化操作行为 #2（Manage Confusion）与 #3（Push Back）的 S 侧落点——把返工成本从产物层提前到简报层。
- **与反模式 #9/#10 的关系**：质疑不等于越权——S 不实施 O 的裁决动作，只返回问题；O 保留路由裁决权。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "feat(subagent-delegation): add S brief-challenge right (agentic Ch19)"
```

### Task 13: operational-recovery.md 新增「HOTL 规则化授权」

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

- [ ] **Step 1: 在「成熟度与 CHECKPOINT 放行」节后追加节**

```markdown
## HOTL 规则化授权（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch13「Human-on-the-loop」：人类以显式、可验证的规则定义授权边界，AI 在规则内自主执行、规则外升级。

- **授权规则必须显式可验证**：L2+ 操作型自动放行不得基于模糊意图，须基于规则化条件（等同 run-log 可校验的条件表达式），如"单元测试全过 + 覆盖率 ≥ 80% + 门禁退出码 0"。
- **规则外必升级**：超出授权规则（高危路径 / 预算超限 / 新依赖）时强制升级到人（复用豁免 E1-E8 流程）。
- **与成熟度阶梯的关系**：L0-L1 决策型 CHECKPOINT 在所有级别均等用户（人机分工线）；HOTL 规则化授权只作用于 L2+ 的操作型放行，且规则本身须经人批准。
- **授权规则登记**：规则条件写入 `project.status` 或成熟度配置，随 run-log 留痕，可审计。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "feat(operational-recovery): add HOTL rule-based authorization (agentic Ch13)"
```

### Task 14: verifier-spec.md 新增 R14-R17 协作评审维度

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 在「3.3 标准分解」的 R13 条目后追加 R14-R17**

定位 `- **单轴下限（R13，第 26 轮）**：每个子标准 \`score\` 必须 ≥ \`0.70\`（B 级分界，§6.1）。` 之后追加：

```markdown
- **多子代理协作评审维度（R14-R17，第 40 轮三源吸收）**：当评审对象由多个角色/子代理共同产出（如 S-doc/S-tla/S-bdd 组合、ingestion A-chunk 合并、opsx 三段式产物），V 评审须额外回答协作质量四问（Agentic Design Patterns ch7+ch19）：
  - **R14 交接完整性**：角色间交接的信息是否传对/传全（对照 signature-chain inputProvenance）。
  - **R15 计划坚持度**：产出是否偏离既定计划/票据（对照 tickets.md frontier / opsx propose）。
  - **R16 角色-任务匹配**：是否为任务选对了角色/persona（对照 subagent-persona-matrix）。
  - **R17 增量价值**：新增角色/子代理是否带来增量价值（无价值则提示精简）。
  - 实现：R14-R17 为评审附加检查项，四问结论记录于 VerifierOutput 的 `summary` 字段（如 `collaborationReview: { handoff, planAdherence, roleFit, incrementalValue }`），**不进入 `subCriteria` 数组**——§2.3 与 verifier-logic.ts 强制 subCriteria 数量固定为 5（不允许子集/超集），追加会破坏 `check-verifier-output.ts` 校验。R14-R17 仅当 `VerifierOutput.targetKind ∈ {design, code}` 且产物含多角色来源时启用；不破坏既有 R1-R13。
```

- [ ] **Step 2: 更新目录（如有）**

若 verifier-spec.md 有目录，在「3.3 标准分解」对应行补 R14-R17 说明。

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add R14-R17 multi-subagent collaboration review dimensions"
```

### Task 15: format-conventions.md 新增「命名约定」节

**Files:**
- Modify: `w-model-dev/references/format-conventions.md`

- [ ] **Step 1: 在文件末尾追加第 6 节**

```markdown
## 6. 命名约定（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch2。命名是代码可读性的第一来源；机械规则由语言静态工具 + 团队规范承载，本节为语义级约定。

- **名副其实**：名称直接表达意图（`elapsedTimeInDays` 而非 `d`）；若需注释解释名称含义，名称不合格。
- **有意义区分**：`a1/a2`、`data/data2`、`get/getInfo` 类无语义区分是废名。
- **可搜索**：名称长度随作用域增长；短名（`i`）只用于局部小循环；魔法数用命名常量（坏味道清单 G25）。
- **避免思维映射**：不用领域外隐喻（单字母/自造缩写让读者做心智翻译）。
- **一词一义**：同一概念统一用词（`fetch/get/retrieve` 不混用）；一词一义的反面（同词多义）也避免。
- **解决方案 vs 问题领域**：技术性名称（`Queue`/`Decorator`）用解决方案域词汇；业务语义用问题域词汇。
- **不加多余语境**：`GSD_` 类前缀、类名中重复的模块前缀是噪音。
- **类/对象命名**：名词短语；函数命名：动词/动词短语（`save`/`isActive`）；布尔函数用 `is/has/can` 前缀。
- **与坏味道清单的关系**：命名违规对应 code-smells-checklist 组 N（N1-N7）与神秘命名味道。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/format-conventions.md
git commit -m "feat(format-conventions): add naming conventions section (Clean-Code ch2)"
```

### Task 16: 新建吸收决策记录 + SSoT §3.4.40 + SKILL.md 挂接 + 顶层级联 + 版本

**Files:**
- Create: `w-model-dev/references/clean-code-refactoring-agentic-absorption.md`
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `w-model-dev/SKILL.md`
- Modify: `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `w-model-dev/skill-metadata.json`

- [ ] **Step 1: 新建吸收决策记录**

```markdown
# Clean Code / Refactoring 2 / Agentic Design Patterns Absorption（三源吸收决策记录）

> 吸收源：《代码整洁之道》（Clean-Code-zh，17 章 + apA）、《重构 2》（Refactoring2-zh，12 章）、《Agentic Design Patterns》（21 章 + 附录）。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.40 + 各 reference 新增节为准；本文件为吸收映射与决策回溯。
> 设计 spec：`docs/superpowers/specs/2026-08-10-three-source-absorption-design.md`。

## 1. 吸收源清单与落点（P0 批次）

| 源 | 精华 | 落点 |
|---|---|---|
| Refactoring ch3 | 24 种坏味道 → 评审清单 | chinese-code-review + code-smells-checklist |
| Clean-Code ch17 | 六组启发式 C/E/F/G/N/T | code-smells-checklist（新建） |
| Clean-Code ch2 | 命名规则 | format-conventions §6 |
| Clean-Code ch3/ch7 + Refactoring ch11.1 | 函数/错误处理规范 | quality-standards + phase-5 禁止行为 #9-#13 |
| Clean-Code ch9 + Refactoring ch4 | 测试代码整洁 / 测试构筑 | quality-standards + TDD 技能 |
| Refactoring ch4.7 + Clean-Code ch16 | 复现测试 / 覆盖空洞 | root-cause-locator §2.5 |
| Refactoring ch10.6 | 断言规范 | phase-5「断言规范」 |
| Refactoring ch2 | 重构纪律（两顶帽子/三次法则/何时不重构） | phase-5「重构纪律」 |
| Clean-Code ch14 | 大规模重构反模式 | anti-patterns #47 |
| Clean-Code ch8 | 第三方边界/学习性测试 | phase-5「第三方边界」 |
| Clean-Code ch13 + apA | 并发 | 批次 C：concurrency-guide（P2） |
| Refactoring ch6~ch12 | 重构手法速查 | 批次 C：refactoring-catalog（P2） |
| agentic Ch19 | 轨迹符合性 | run-log-logic R8 |
| agentic Ch19 | 承包商协商反馈 | subagent-delegation「简报质疑权」 |
| agentic Ch7+Ch19 | 协作质量四问 | verifier-spec R14-R17 |
| agentic Ch13 | HOTL 规则化授权 | operational-recovery |
| agentic Ch10/14/16/17/18/20 + Clean-Code ch4/ch6/ch10 + Refactoring ch2.6/2.8 | P1/P2 条目 | 批次 B/C 计划 |

## 2. 吸收决策

- 落地策略：分批（P0/P1/P2 各一个计划循环）；纯文档为主 + 2 处脚本联动（R8 轨迹模板、docs-consistency 期望值）。
- 坏味道/并发检查：双轨（语言静态工具 + LLM 语义评审），**不新增自研 AST 扫描脚本**（用户确认）。
- 优先级：P0（本批 16 项）→ P1（批次 B，40.1.0）→ P2（批次 C，40.2.0）。

## 3. 明确不吸收

- agentic：完整辩论框架/RL 训练/SICA 自改工具链/网络模型/多层 supervisor/完整 RAG/A2A/MCP 实现。
- Clean-Code：教学示例代码（ch14-16）/Java 特定（checked exception、EJB、JDBC）/组织政治叙事。
- Refactoring：教学示例（ch1）/组织政治（ch2.4）/Java/语言特定风格偏好/"函数 6 行硬阈值"。

## 4. 与现有约束/反模式的关系

- 新增反模式 #47（大规模重构）；不修改 #1~#46 语义。
- 新增约束 #21 之外无新硬约束（全部为操作行为/规范层）。
- R8 与 R7 互补（时序→轨迹）；不替代反模式 #18（R8 是轨迹检测，反模式 #18 是流程回退）。
```

- [ ] **Step 2: SSoT 新增 §3.4.40**

在 SSoT §3.4.39（第 39 轮）节后新增：

```markdown
### 3.4.40 第 40 轮：三源吸收（Clean Code / Refactoring 2 / Agentic Design Patterns）

**目的**：补四类空白——代码内容规范、代码结构坏味道维度、测试代码自身质量、agentic 编排缺口（轨迹/简报质疑/协作评审/HOTL 授权）。

**P0（40.0.0，16 项）**：坏味道清单（chinese-code-review + code-smells-checklist）、编码规范（phase-5 六节）、质量规范（quality-standards 三小节）、TDD 四则、复现测试（root-cause-locator §2.5）、反模式 #47、命名约定（format-conventions §6）、agentic 4 项（run-log R8 / 简报质疑权 / R14-R17 / HOTL 授权）。

**P1（40.1.0，10 项）**：多评审分歧上缴人 / MCP 契约准则 / R3 来源校验 / MASS 三阶段 / 升级时效 / 修剪优先级 / 坏注释黑名单 / 类设计规则 / 对象数据结构 / 级联。

**P2（40.2.0，9 项）**：concurrency-guide / refactoring-catalog（2 新 reference）/ 推理预算 / decisionConfidence 字段 / 最小权限 / 票据动态重排 / 错误分类 / persona 能力声明。

**关键决策**：坏味道/并发检查双轨（语言静态工具 + LLM 语义评审，不新增 AST 脚本）；轨迹符合性校验（check-run-log R8）；吸收决策记录见 references/clean-code-refactoring-agentic-absorption.md。
```

并在 SSoT §10A 追溯表补一行（新增 §3.4.40 ↔ 实现文件映射）。

- [ ] **Step 3: SKILL.md Bundled Resources 挂新 reference**

在 Bundled Resources 表 `quality-standards.md | 编码后质量检查` 行附近追加：

```
| code-smells-checklist.md | 阶段 5 编码自检 / V-code 评审（坏味道清单） |
```

- [ ] **Step 4: 顶层级联（反模式计数 + 新 reference + 版本号 40.0.0）**

1. `AGENTS.md`：references 行补 `code-smells-checklist / clean-code-refactoring-agentic-absorption`；反模式计数 `46 条` → `47 条`（若出现）。
2. `README.md`：反模式计数 46 → 47；版本号 → 40.0.0。
3. `docs/INSTALL.md`：L187 `46 条反模式` → `47 条反模式`；版本号 → 40.0.0。
4. `CONTRIBUTING.md`：版本号示例 → 40.0.0。
5. `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` frontmatter：version 39.2.0 → 40.0.0。
6. `CHANGELOG.md` 顶部新增：

```markdown
## [40.0.0] - 2026-08-10

### Added
- 三源吸收 P0（16 项）：坏味道清单（code-smells-checklist + chinese-code-review）、phase-5 六节（坏味道禁令 #9-#13/断言规范/重构纪律/测试基线/第三方边界/静态工具接入）、quality-standards 三小节（测试整洁/函数错误规范/性能三法）、TDD 四则、复现测试强制（root-cause-locator §2.5）、反模式 #47（大规模重构）、命名约定（format-conventions §6）
- agentic 4 项：run-log R8 轨迹模板校验（agentic Ch19）、S 子代理简报质疑权（subagent-delegation）、verifier-spec R14-R17 协作评审维度、HOTL 规则化授权（operational-recovery）
- 新 reference：code-smells-checklist.md / clean-code-refactoring-agentic-absorption.md

### Changed
- 反模式计数 46 → 47（docs-consistency 期望值 + 7 处文档联动）
- 版本号 39.2.0 → 40.0.0
```

- [ ] **Step 5: 全量验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files 全过
npx tsc --noEmit             # 0 错误
npm run check:docs-consistency  # exit 0「✓ 全部一致」（12 项）
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/references/clean-code-refactoring-agentic-absorption.md docs/skill-design-document_SSoT.md w-model-dev/SKILL.md README.md AGENTS.md docs/INSTALL.md CHANGELOG.md CONTRIBUTING.md package.json w-model-dev/skill-metadata.json
git commit -m "feat: P0 three-source absorption (40.0.0) — smells checklist, coding norms, agentic trajectory, #47"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 A 16 项全部映射：spec §3.1 #1（Task 7）、#2（Task 6）、#3（Task 8）、#4（Task 9）、#5（Task 10）、#6（Task 11）、#7（Task 5）、#8（Task 12）、#9（Task 13）、#10（Task 14）、#11（Task 15）、#12（Task 1-3）、#13（Task 16）、#14（Task 16）、#15（Task 4）、#16（Task 16）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown/代码；无 TBD/TODO。Task 1 中 `makeEntry` 以"若文件有辅助函数"兜底说明——执行时若签名不同以既有为准，属执行期适配非占位符。
- **类型一致性**：R8 复用 `S_VARIANTS`/`GATE_ACTIONS`（Task 2 内定义）；`completedPhases`/`valid` 为既有变量；测试断言 `startsWith('R8')` 与实现违规前缀 `R8:` 一致。
- **已知风险**：R8-1（checkpoint 非最后记录）可能对既有合法样本误报——Task 2 Step 4 已列为预期破坏，须按样本语义调整；若误报面大，可在 R8 增加"self-as-verifier 模式豁免"或在 run-log 文档注明 checkpoint 后仍可追加 R3 记录（执行期裁决）。
