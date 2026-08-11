# 第 16 轮遗留问题与设计层缺口闭环修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全量修正第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 #14 + 4 demo 层设计缺口 P7-001~P7-004 + 4 技能包侧设计缺口 D1~D4），新增 5 条反模式 #22~#26，闭环第 15 轮共性问题 A/B/C/D。

**Architecture:** 分 4 个 Part 串行实施：Part A 改 2 脚本 + 1 fixture + self-test（基线 94→95）；Part B 改 7 reference 文档；Part C 改反模式 + SKILL.md + 3 顶层文档；Part D 全量回归验证。每个 Part 完成后运行 self-test + tsc 验证。

**Tech Stack:** TypeScript（strict mode）+ Vitest + tsx

**关联 spec:** [2026-07-26-round16-residual-and-design-gap-closure-design.md](../specs/2026-07-26-round16-residual-and-design-gap-closure-design.md)

---

## 文件结构

### Part A：脚本与 fixture（6 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/scripts/logic/tla-logic.ts` | P1.1 新增 R13 checkRounds schema 校验 + `checkRoundsViolations` 字段 | Modify |
| `w-model-dev/scripts/cli/check-tla-model.ts` | P1.1 JSON 摘要输出 `checkRoundsViolations` | Modify |
| `w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json` | P1.1 R13 触发 fixture | Create |
| `w-model-dev/scripts/cli/self-test.ts` | P1.1 新增 R13 样本（基线 94→95） | Modify |
| `w-model-dev/scripts/__tests__/tla-logic.test.ts` | P1.1 R13 单元测试（可选） | Modify |
| `w-model-dev/scripts/logic/checkpoint-logic.ts` | P4.1 ID_PATTERNS / TECH_KEYWORDS 注释补充 | Modify |

### Part B：reference 文档（11 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/tla-plus-guide.md` | P4.3 §checkRounds violations 类型修正 + 禁止字段节 + spec 级语义明确 | Modify |
| `w-model-dev/references/data-models.md` | P2.1 新增 Schema 边界对照表 + RunLogEntry 使用约定补条 + tla-manifest 节字段表对齐 | Modify |
| `w-model-dev/references/phase-5-coding.md` | P3.1 禁止行为 #7 角色越权 + 角色校验清单节 + P3.3 禁止行为 #8 副作用时序 + 副作用时序清单节 | Modify |
| `w-model-dev/references/phase-3-interface-design.md` | P3.2 新增跨模块数据源选择约束节 | Modify |
| `w-model-dev/references/phase-4-detailed-design.md` | P3.2 同步约束（引用 phase-3） | Modify |
| `w-model-dev/references/phase-7-system-test.md` | P3.4 禁止行为 #7 跨模块/角色/时序检测 | Modify |
| `w-model-dev/references/phase-8-acceptance-test.md` | P4.1 acknowledgedDecisions 关键词约束 | Modify |
| `w-model-dev/references/operational-recovery.md` | P4.2 新增 JSON 文件写入工具选择节 | Modify |

### Part C：反模式与顶层文档（5 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/anti-patterns.md` | 新增 #22~#26 + 目录/对应关系/检测信号表同步 | Modify |
| `w-model-dev/SKILL.md` | 快速自检补 JSON 写入工具 + acknowledgedDecisions 关键词 | Modify |
| `docs/skill-design-document_SSoT.md` | §3.4.11 第十六轮约束 | Modify |
| `AGENTS.md` | §4 第十六轮结论 | Modify |
| `CHANGELOG.md` | [16.0.0] 第十六轮版本条目 | Modify |

### Part D：最终回归验证（5 个任务）

| 验证项 | 命令 |
|---|---|
| TypeScript strict | `npx tsc --noEmit` |
| self-test | `npm run self-test` |
| vitest | `npx vitest run` |
| R13 手动验证 | `npx tsx w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json --skip-tlc` |
| 文档一致性 | 5 项互引人工检查 |

---

## Part A：脚本与 fixture（6 个任务）

### Task A1：P1.1 tla-logic.ts 新增 R13 checkRounds schema 校验

- [ ] 在 `w-model-dev/scripts/logic/tla-logic.ts` 的 `TlaCheckResult` 接口新增 `checkRoundsViolations: string[]` 字段（紧跟 `cfgStructureViolations` 后）：
  ```typescript
  /** checkRounds schema 违反（如元素缺字段、字段类型错、含 phase 级摘要字段，见 §checkRounds 字段语义） */
  checkRoundsViolations: string[];
  ```
- [ ] 在 tla-logic.ts 新增 `R13_checkRoundsSchema` 校验函数（参考其他 R 编号函数风格），逻辑：
  ```typescript
  function R13_checkRoundsSchema(manifest: TlaManifest): string[] {
    const violations: string[] = [];
    const cr = manifest.checkRounds;
    if (cr === undefined) return violations; // 可选缺省合法
    if (!Array.isArray(cr)) {
      violations.push('R13: checkRounds 必须是数组，实际为 ' + typeof cr);
      return violations;
    }
    const REQUIRED_FIELDS = ['phase', 'round', 'specId', 'syntaxCheck', 'tlcCheck', 'violations', 'converged'] as const;
    const FORBIDDEN_FIELDS = ['phaseSummary', 'summary', 'phaseDecisions', 'phaseLevelSummary'] as const;
    cr.forEach((entry, i) => {
      if (typeof entry !== 'object' || entry === null) {
        violations.push(`R13: checkRounds[${i}] 必须是对象，实际为 ${typeof entry}`);
        return;
      }
      // 必填字段检查
      for (const f of REQUIRED_FIELDS) {
        if (!(f in entry)) {
          violations.push(`R13: checkRounds[${i}] 缺必填字段 ${f}`);
        }
      }
      // 字段类型检查
      if (typeof entry.phase !== 'number' || entry.phase < 1 || entry.phase > 8) {
        violations.push(`R13: checkRounds[${i}].phase 须为 number ∈ [1,8]，实际为 ${JSON.stringify(entry.phase)}`);
      }
      if (typeof entry.round !== 'number' || entry.round < 1) {
        violations.push(`R13: checkRounds[${i}].round 须为 number ≥ 1，实际为 ${JSON.stringify(entry.round)}`);
      }
      if (typeof entry.specId !== 'string' || entry.specId.trim() === '') {
        violations.push(`R13: checkRounds[${i}].specId 须为非空字符串，实际为 ${JSON.stringify(entry.specId)}`);
      }
      if (typeof entry.syntaxCheck !== 'boolean') {
        violations.push(`R13: checkRounds[${i}].syntaxCheck 须为 boolean，实际为 ${typeof entry.syntaxCheck}`);
      }
      if (typeof entry.tlcCheck !== 'boolean') {
        violations.push(`R13: checkRounds[${i}].tlcCheck 须为 boolean，实际为 ${typeof entry.tlcCheck}`);
      }
      if (typeof entry.converged !== 'boolean') {
        violations.push(`R13: checkRounds[${i}].converged 须为 boolean，实际为 ${typeof entry.converged}`);
      }
      if (!Array.isArray(entry.violations) || entry.violations.some(v => typeof v !== 'string')) {
        violations.push(`R13: checkRounds[${i}].violations 须为 string[]，实际为 ${Array.isArray(entry.violations) ? '含非字符串元素' : typeof entry.violations}`);
      }
      // 禁止字段检查
      for (const f of FORBIDDEN_FIELDS) {
        if (f in entry) {
          violations.push(`R13: checkRounds[${i}] 含禁止字段 ${f}（phase 级摘要字段，checkRounds 为 spec 级返工记录）`);
        }
      }
    });
    return violations;
  }
  ```
- [ ] 在主校验函数（`checkTlaModel` 或等价入口）调用 R13 并填充 `result.checkRoundsViolations`，合并到 `result.violations` 使退出码非 0
- [ ] 验证：TypeScript strict 编译通过（`npx tsc --noEmit`）

### Task A2：P1.1 check-tla-model.ts JSON 摘要输出新字段

- [ ] 修改 `w-model-dev/scripts/cli/check-tla-model.ts` 的 JSON 摘要输出（末尾 `console.log('===JSON===...')` 处），新增 `checkRoundsViolations` 字段：
  ```typescript
  const summary = {
    passed: result.passed,
    phase: result.phase,
    totalSpecs: result.totalSpecs,
    checkedSpecs: result.checkedSpecs,
    headerViolations: result.headerViolations,
    hierarchyViolations: result.hierarchyViolations,
    decompositionViolations: result.decompositionViolations,
    syntaxErrors: result.syntaxErrors,
    deadlockViolations: result.deadlockViolations,
    invariantViolations: result.invariantViolations,
    stateExplosionSpecs: result.stateExplosionSpecs,
    coverageViolations: result.coverageViolations,
    cfgConsistencyViolations: result.cfgConsistencyViolations,
    cfgStructureViolations: result.cfgStructureViolations,
    checkRoundsViolations: result.checkRoundsViolations, // 新增
    environmentOk: result.environmentOk,
    environmentErrors: result.environmentErrors,
    violations: result.violations,
    exitCode: result.violations.length === 0 ? 0 : 1,
  };
  ```
- [ ] 验证：TypeScript strict 编译通过

### Task A3：P1.1 新增 fixture `tla/bad-checkrounds-phase-summary.json`

- [ ] 创建 `w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json`，在 `valid.json` 基础上，`checkRounds` 含一条带 `phaseSummary` 字段的记录：
  ```json
  {
    "version": 1,
    "project": "tla-sample-bad-checkrounds",
    "currentPhase": 2,
    "basePath": ".",
    "tools": {
      "jarPath": "w-model-dev/tools/tla2tools.jar",
      "javaMinVersion": 11
    },
    "specs": [
      {
        "id": "L1-system",
        "level": "L1",
        "phase": 1,
        "system": "sample-system",
        "requirementIds": ["REQ-001"],
        "designRef": "docs/requirement-spec.md#§3",
        "tlaPath": "tla/L1-system.tla",
        "cfgPath": "tla/L1-system.cfg",
        "parent": null,
        "siblings": [],
        "children": [],
        "variableCombination": 240,
        "decompositionDecision": "kept-below-threshold",
        "syntaxChecked": true,
        "tlcChecked": true,
        "deadlockFree": true,
        "invariantsHold": true,
        "stateExplosion": false
      }
    ],
    "checkRounds": [
      {
        "phase": 2,
        "round": 1,
        "timestamp": "2026-07-26T10:00:00Z",
        "specId": "L1-system",
        "syntaxCheck": true,
        "tlcCheck": true,
        "violations": [],
        "converged": true,
        "phaseSummary": "本阶段所有 spec 一次性通过 SANY+TLC，零违反收敛"
      }
    ]
  }
  ```
- [ ] 验证：`npx tsx w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json --skip-tlc` 应输出 `R13: checkRounds[0] 含禁止字段 phaseSummary`，退出码 1

### Task A4：P1.1 self-test.ts 新增 R13 样本

- [ ] 修改 `w-model-dev/scripts/cli/self-test.ts`，在 TLA 样本组新增 1 条：
  ```typescript
  {
    name: 'tla R13 checkRounds schema (phase summary forbidden)',
    script: 'check-tla-model.ts',
    args: ['samples/tla/bad-checkrounds-phase-summary.json', '--skip-tlc'],
    expectedExitCode: 1,
    expectedOutputIncludes: ['R13', 'phaseSummary'],
  },
  ```
- [ ] 更新 self-test 顶部基线计数注释（`94` → `95`）
- [ ] 验证：`npm run self-test` 应 95/95 全通过

### Task A5：P1.1 vitest 新增 R13 单元测试（可选）

- [ ] 修改 `w-model-dev/scripts/__tests__/tla-logic.test.ts`，新增 R13 校验单元测试（≥3 用例）：
  - `checkRounds` 为 `[]` → 不触发 R13
  - `checkRounds` 为非数组 → 触发 R13
  - `checkRounds` 元素含 `phaseSummary` → 触发 R13
  - `checkRounds` 元素缺 `specId` → 触发 R13
  - `checkRounds` 元素 `violations` 为非字符串数组 → 触发 R13
- [ ] 验证：`npx vitest run scripts/__tests__/tla-logic.test.ts` 全通过

### Task A6：P4.1 checkpoint-logic.ts 注释补充

- [ ] 修改 `w-model-dev/scripts/logic/checkpoint-logic.ts`，在 `ID_PATTERNS`（72 行附近）和 `TECH_KEYWORDS`（81 行附近）定义前新增注释块：
  ```typescript
  /**
   * R2 决策内容具体性校验的关键词集合。
   *
   * 用途：每条 acknowledgedDecision 须命中 ID_PATTERNS 任一正则 OR TECH_KEYWORDS 任一关键词，
   *      否则 R2 报"名词违规"（决策内容无具体名词）。详见 R2 校验逻辑（checkpoint-logic.ts §R2）。
   *
   * 扩展规则：
   *   - ID_PATTERNS 新增需求/设计/测试 ID 模式时，须同步更新：
   *     - w-model-dev/references/tla-plus-guide.md（如 TLA+ 相关 ID）
   *     - w-model-dev/references/data-models.md（如数据模型相关 ID）
   *     - w-model-dev/references/rtm-guide.md（如 RTM 相关 ID）
   *   - TECH_KEYWORDS 新增技术关键词时，须与 project.json techStack 字段对齐；
   *     新增前在 phase-8-acceptance-test.md「acknowledgedDecisions 决策条目须含关键词」节登记。
   *
   * 与 R2 关系：
   *   - 命中黑名单（BLACKLIST）→ 报黑名单违规（同条决策不再重复报长度/名词）
   *   - 长度 < 10 → 报长度违规（同条决策不再重复报名词）
   *   - 无 ID_PATTERN 命中 且 无 TECH_KEYWORD 命中 → 报名词违规
   *
   * 当前集合（共 5 个 ID 模式 + 27 个技术关键词）由第 16 轮 P4.1 补充注释。
   */
  const ID_PATTERNS: RegExp[] = [ ... ];
  const TECH_KEYWORDS = [ ... ];
  ```
- [ ] 验证：TypeScript strict 编译通过

### Part A 完成验证

- [ ] `npx tsc --noEmit` 0 错误
- [ ] `npm run self-test` 95/95 全通过
- [ ] `npx vitest run` 全通过（76/76 或 77+/77+）
- [ ] R13 fixture 手动验证：`npx tsx w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json --skip-tlc` 退出码 1

---

## Part B：reference 文档（11 个任务）

### Task B1：P4.3 + P1.1 tla-plus-guide.md §checkRounds 修正

- [ ] 修改 `w-model-dev/references/tla-plus-guide.md` §checkRounds 字段表（249 行附近），将 `violations` 类型从 `number` 改为 `string[]`：
  ```
  | `violations` | string[] | 本轮违反详情列表（死锁 + 不变式违反 + 状态爆炸等合计，每条为具体违反描述） |
  ```
- [ ] 在「空值约定」节后新增「禁止字段」节：
  ```markdown
  ### 禁止字段（phase 级摘要）

  > checkRounds 元素为 **spec 级返工记录**，不得含 phase 级摘要字段。第 15 轮调测发现子代理误把 phase 级摘要写入 checkRounds（共性问题 D），第 16 轮 R13 校验强制拦截。

  | 禁止字段 | 说明 |
  |---|---|
  | `phaseSummary` | phase 级摘要（应写在 run-log.jsonl 的 note 字段） |
  | `summary` | phase 级摘要（同上） |
  | `phaseDecisions` | phase 级决策列表（应写在 acknowledgedDecisions） |
  | `phaseLevelSummary` | phase 级总结（同上） |

  命中禁止字段 → R13 违反，check-tla-model.ts 退出码 1。
  ```
- [ ] 在「checkRounds 字段语义」节顶部补一句明确 spec 级语义：
  ```markdown
  > **spec 级返工记录**：每条 checkRounds 元素对应一次 spec 的 TLA+ 校验轮次（specId 标识），不是 phase 级摘要。phase 级摘要应写在 run-log.jsonl 的 note 字段。
  ```
- [ ] 验证：文档可读，无 Markdown 语法错误

### Task B2：P2.1 data-models.md 新增 Schema 边界对照表

- [ ] 修改 `w-model-dev/references/data-models.md`，在 `## 事件接驳模型` 节（498 行附近）前新增 `### RunLogEntry vs EventIngress Schema 边界对照表`：
  ```markdown
  ### RunLogEntry vs EventIngress Schema 边界对照表

  > 第 15 轮调测发现子代理频繁混用 RunLogEntry（run-log.jsonl）与 EventIngress（event-ingress.jsonl）字段（共性问题 B），第 16 轮 P2.1 新增此对照表显式区分边界。

  | 用途 | RunLogEntry 字段 | EventIngress 字段 | 区别 |
  |---|---|---|---|
  | 标识 | `runId`（UUID 或时间戳） | `eventId`（UUID 或时间戳） | 不同 ID 命名空间，不可混用 |
  | 时间戳 | `timestamp` | `timestamp` | 相同（ISO 8601） |
  | 阶段 | `phase` + `phaseName` | 无（路由后才有阶段） | RunLogEntry 强制阶段，EventIngress 路由前无 |
  | 动作 | `action`（chunk/cross/produce/review/gate/...） | `eventType`（bug-report/requirement-change/...） | 不同枚举集，不可混用 |
  | 角色 | `role`（O/A/S/V/G/R） | `source`（webhook/cron/manual/...） | 不同维度，不可混用 |
  | 结果 | `outcome`（success/fail/rework/...） | `routedTo`（路由决策对象） | 不同语义，不可混用 |
  | 决策 | `acknowledgedDecisions`（数组） | 无 | 仅 RunLogEntry |
  | 耗时 | `duration_s` / `tokens` | 无 | 仅 RunLogEntry |
  | 影响范围 | `artifacts`（产物路径） | `affectedArtifacts` + `affectedRequirements` + `evidence` | EventIngress 更具体 |

  **禁止混用规则**：
  - run-log.jsonl 不得含 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`）
  - event-ingress.jsonl 不得含 RunLogEntry 字段（`runId` / `action` / `role` / `outcome` / `acknowledgedDecisions` / `duration_s` / `tokens` / `estimated` / `subagentSpawns` / `gateExitCode` / `gateLogPath`）
  - 命中混用 → check-run-log.ts R1 动作完整性校验失败（run-log.jsonl）或 EventIngress schema 校验失败（event-ingress.jsonl）
  ```
- [ ] 在 RunLogEntry 节末尾「使用约定」（393 行附近）补一条：
  ```markdown
  - **禁止字段混用**：不得用 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`）写 run-log.jsonl。第 15 轮共性问题 B 子代理误用 `eventId` / `eventType` / `decisions` 触发 R1 失败。详见上方「RunLogEntry vs EventIngress Schema 边界对照表」。
  ```
- [ ] 验证：文档可读

### Task B3：P1.1 data-models.md tla-manifest.json 节字段表对齐

- [ ] 检查 `w-model-dev/references/data-models.md` tla-manifest.json 节（604 行附近），如字段表引用 checkRounds，须对齐 tla-plus-guide.md 修正后的类型（violations: string[]）
- [ ] 如无引用，跳过此任务

### Task B4：P3.1 phase-5-coding.md 新增角色越权预防 + 角色校验清单

- [ ] 修改 `w-model-dev/references/phase-5-coding.md`「禁止行为」节（201 行附近），新增第 7 条：
  ```markdown
  | 7 | 路由层或控制器入口仅校验 token 存在未校验角色（如 authRequired=true 但未校验 user/reader/blogger 角色） | 路由层或控制器入口必须显式校验 `requiredRole`，与需求/设计中的角色枚举一致；token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 |
  ```
- [ ] 在「代码审查」节（153 行附近）后新增「角色校验清单」节：
  ```markdown
  ## 角色校验清单

  > 第 15 轮 P7-001 reader 可发博文（authRequired 未校验角色）缺陷的预防清单。每个受保护端点须通过以下检查：

  - [ ] 每个受保护端点须有 `requiredRole` 显式声明（在路由配置或控制器入口）
  - [ ] `requiredRole` 须与需求/设计文档中的角色枚举一致（如 user / reader / blogger / admin）
  - [ ] token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 Forbidden
  - [ ] 单元测试须覆盖「跨角色越权」场景（如 reader 调用 blogger-only 端点应返回 403）
  - [ ] 系统测试须覆盖「越权用例」（详见 phase-7-system-test.md「禁止行为」#7）

  违反任一条 → V-code 评审标注 + 系统测试用例失败，回 phase-5 返工。
  ```

### Task B5：P3.3 phase-5-coding.md 新增副作用时序一致 + 清单

- [ ] 修改 `w-model-dev/references/phase-5-coding.md`「禁止行为」节，新增第 8 条：
  ```markdown
  | 8 | 响应体字段返回副作用自增前的旧值（如 viewCount 自增后响应体仍返回旧值） | 副作用（如计数器自增、状态变更）须在响应体构造前完成；响应体字段须反映已生效的状态 |
  ```
- [ ] 在「角色校验清单」节后新增「副作用时序一致性清单」节：
  ```markdown
  ## 副作用时序一致性清单

  > 第 15 轮 P7-004 PostController.get 响应体返回 recordView 自增前旧 viewCount 缺陷的预防清单。每个含副作用端点须通过以下检查：

  - [ ] 副作用（如计数器自增、状态变更、关联记录创建）须在响应体构造前完成
  - [ ] 响应体字段须反映已生效的状态（如自增后的 viewCount，不是自增前的旧值）
  - [ ] 单元测试须覆盖「副作用与响应体一致性」场景（断言响应体字段 = 已生效状态）
  - [ ] 系统测试须覆盖「时序用例」（详见 phase-7-system-test.md「禁止行为」#7）

  违反任一条 → V-code 评审标注 + 系统测试用例失败，回 phase-5 返工。
  ```

### Task B6：P3.2 phase-3-interface-design.md 新增跨模块数据源选择约束

- [ ] 修改 `w-model-dev/references/phase-3-interface-design.md`，新增「跨模块数据源选择约束」节（位置在「接口契约」或等价节后）：
  ```markdown
  ## 跨模块数据源选择约束

  > 第 15 轮 P7-002 BloggerService.follow 校验 follower 在 blogger store（设计标注 user+）、P7-003 CommentService.create 仅校验 user store（blogger token sub 是 bloggerId）缺陷的预防约束。

  跨模块调用时，数据源（store）选择须满足：

  - **显式声明**：每个跨模块调用须在接口设计文档显式声明所用的 store（如 user store / blogger store / article store）
  - **schema 一致**：store 选择须与 schema 中的实体定义一致（如 follower 是 user 实体的子集 → 须在 user store 校验，不应在 blogger store）
  - **token sub 对齐**：如调用方携带 token，token.sub 须与所选 store 的主键一致（如 blogger token sub=bloggerId → 不应在 user store 校验 follower）

  违反 → 集成测试阶段发现跨模块数据流缺陷，回 phase-3 返工。
  ```

### Task B7：P3.2 phase-4-detailed-design.md 同步约束

- [ ] 修改 `w-model-dev/references/phase-4-detailed-design.md`，新增同步约束节（位置在「详细设计」或等价节后）：
  ```markdown
  ## 跨模块数据源选择约束（同步 phase-3）

  > 详细设计文档须列出每个跨模块调用的数据源选择，与 phase-3 接口设计一致。详见 [phase-3-interface-design.md「跨模块数据源选择约束」](phase-3-interface-design.md#跨模块数据源选择约束)。

  - 每个跨模块调用须在详细设计中显式声明所用 store
  - store 选择须与 phase-3 接口设计一致（不得在详细设计阶段变更 store 选择）
  - 如需变更 → 回 phase-3 返工接口设计
  ```

### Task B8：P3.4 phase-7-system-test.md 新增检测条款

- [ ] 修改 `w-model-dev/references/phase-7-system-test.md`「禁止行为」节（79 行附近），新增第 7 条：
  ```markdown
  | 7 | 系统测试未覆盖跨模块数据流校验 / 角色越权检测 / 副作用时序一致性检测 | 系统测试用例须包含：(1) 跨模块数据流用例（验证 store 选择与 schema 一致）；(2) 角色越权用例（验证 reader 不能调用 blogger-only 端点，应返回 403）；(3) 副作用时序用例（验证响应体字段反映已生效状态） |
  ```

### Task B9：P4.1 phase-8-acceptance-test.md 补 acknowledgedDecisions 关键词约束

- [ ] 修改 `w-model-dev/references/phase-8-acceptance-test.md`，在「acknowledgedDecisions」或「阶段门评审」相关节补：
  ```markdown
  ### acknowledgedDecisions 决策条目须含关键词

  > 第 15 轮共性问题 C：acknowledgedDecisions 多次因未含 ID 模式或 TECH_KEYWORDS 返工。第 16 轮 P4.1 补充约束。

  每条 acknowledgedDecision 须命中以下任一：
  - **ID 模式**（正则匹配）：`REQ-\d+` / `SD-[\d.]+` / `INTF-[\d.]+` / `DD-[\d.]+` / `TC-\w+-\d+`
  - **技术关键词**（中英）：`REST` / `GraphQL` / `JWT` / `OAuth` / `SQLite` / `PostgreSQL` / `Redis` / `Koa` / `Express` / `React` / `Vue` / `TypeScript` / `WebSocket` / `HTTP` / `API` / `CRUD` / `认证` / `鉴权` / `缓存` / `存储` / `模块` / `接口` / `表` / `字段` / `状态机` / `不变式` / `需求` / `设计` / `架构` / `数据库` / `前端` / `后端` / `网关` / `队列` / `事务` / `锁` / `索引`

  泛化模板（如「同意」/「确认」/「OK」/「好的」）视为空，触发 R2 名词违规。完整集合见 [checkpoint-logic.ts](../scripts/checkpoint-logic.ts) `ID_PATTERNS` / `TECH_KEYWORDS`。
  ```

### Task B10：P4.2 operational-recovery.md 新增 JSON 文件写入工具选择节

- [ ] 修改 `w-model-dev/references/operational-recovery.md`，新增「JSON 文件写入工具选择」节（位置在合适处，如「成本预算与运行日志」节后或独立节）：
  ```markdown
  ## JSON 文件写入工具选择

  > 第 15 轮共性问题 A：PowerShell ConvertTo-Json / Add-Content 在阶段 5/6/7/8 多次返工（BOM + 深度 + 中文乱码）。第 16 轮 P4.2 强制工具选择。

  ### 强制工具

  ```javascript
  import { writeFileSync } from 'node:fs';
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  ```

  - **Node.js `fs.writeFileSync`**：跨平台、UTF-8 无 BOM、深度无限制、中文不乱码
  - 适用于所有 JSON 文件写入（run-log.jsonl / maturity.json / budget.json / graph.json / tla-manifest.json / project.json / rtm.json 等）

  ### 禁止工具

  | 工具 | 问题 | 表现 |
  |---|---|---|
  | PowerShell `ConvertTo-Json` | BOM + 深度问题 | 深度 > 2 时字段丢失，文件仅剩 BOM |
  | PowerShell `Add-Content -Encoding UTF8` | 中文乱码 | UTF-8 BOM 导致中文被 GBK 误解析 |
  | PowerShell `Out-File -Encoding UTF8` | 中文乱码 | 同上 |
  | PowerShell `Set-Content -Encoding UTF8` | 中文乱码 | 同上 |

  命中禁止工具 → 回阶段起点，改用 Node.js `fs.writeFileSync` 重写。详见 [anti-patterns.md #25](anti-patterns.md#25-json-文件-powershell-写入)。
  ```

### Task B11：Part B 完成验证

- [ ] 文档一致性检查：tla-plus-guide.md §checkRounds ↔ data-models.md tla-manifest.json 节 ↔ tla-logic.ts 类型定义（violations: string[]）
- [ ] 文档一致性检查：data-models.md Schema 边界对照表 ↔ RunLogEntry 使用约定
- [ ] 文档可读性检查：所有新增节 Markdown 语法正确
- [ ] `npx tsc --noEmit` 0 错误（仅脚本改动，文档改动不影响编译）

---

## Part C：反模式与顶层文档（5 个任务）

### Task C1：anti-patterns.md 新增 #22~#26

- [ ] 修改 `w-model-dev/references/anti-patterns.md`「反模式清单」表（21 行附近），新增 5 行：
  ```markdown
  | 22 | 角色越权（authRequired 仅校验 token 存在未校验角色） | 越权缺陷带入运行时，security-auditor persona 无 phase-5 检查项可依 | 路由层或控制器入口必须显式校验 `requiredRole`，token 解码后断言 `token.role ∈ requiredRoles`（见 [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节） |
  | 23 | 跨模块 store 误用（跨模块调用时 store 选择与 schema 不一致） | 跨模块数据流缺陷在系统测试才发现，修复成本高 | 跨模块调用时数据源选择须在 phase-3 接口设计显式声明，与 schema 一致（见 [phase-3-interface-design.md](phase-3-interface-design.md)「跨模块数据源选择约束」节） |
  | 24 | 副作用时序不一致（响应体字段返回副作用自增前的旧值） | 响应体字段与已生效状态不一致，集成测试难发现 | 副作用须在响应体构造前完成，响应体字段反映已生效状态（见 [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节） |
  | 25 | JSON 文件写入用 PowerShell ConvertTo-Json / Add-Content | BOM + 深度 + 中文乱码，阶段 5/6/7/8 多次返工（第 15 轮共性问题 A） | 必须用 Node.js `fs.writeFileSync(path, content, 'utf-8')` 写 JSON（见 [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节） |
  | 26 | RunLogEntry 与 EventIngress 字段混用（run-log.jsonl 含 eventId/eventType/decisions 等 EventIngress 字段） | schema 漂移，R1 动作完整性校验失败（第 15 轮共性问题 B） | run-log.jsonl 须用 `runId/action/role/outcome`，event-ingress.jsonl 须用 `eventId/eventType/source/summary`（见 [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节） |
  ```
- [ ] 同步更新「目录」节：`反模式清单（18 条流程反模式 #1~#17 + #21；#20 见 subagent-delegation.md）` → `反模式清单（23 条流程反模式 #1~#17 + #21~#26；#20 见 subagent-delegation.md）`
- [ ] 同步更新「命中高发阶段」表（新增 #22~#26 行）：
  ```markdown
  | #22（角色越权） | 阶段 5 | [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节 |
  | #23（跨模块 store 误用） | 阶段 3/4 | [phase-3-interface-design.md](phase-3-interface-design.md)「跨模块数据源选择约束」节 |
  | #24（副作用时序不一致） | 阶段 5 | [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节 |
  | #25（JSON 文件 PowerShell 写入） | 阶段 5/6/7/8 | [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节 |
  | #26（RunLogEntry 与 EventIngress 字段混用） | 阶段 1/6/7/8 | [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节 |
  ```
- [ ] 同步更新「与门禁脚本的对应关系」表（新增 #22~#26 行）：
  ```markdown
  | #22（角色越权） | V-code 评审（reworkHints 标注）+ 系统测试用例（越权场景应返回 403） |
  | #23（跨模块 store 误用） | V-design 评审（reworkHints 标注）+ 集成测试用例（跨模块数据流） |
  | #24（副作用时序不一致） | V-code 评审（reworkHints 标注）+ 系统测试用例（副作用与响应体一致性） |
  | #25（JSON 文件 PowerShell 写入） | run-log.jsonl note 字段检测（"PowerShell" / "ConvertTo-Json" / "Add-Content" / "Out-File"） |
  | #26（RunLogEntry 与 EventIngress 字段混用） | [`check-run-log.ts`](../scripts/check-run-log.ts) R1 动作完整性校验（字段不符 schema 即失败） |
  ```
- [ ] 同步更新「检测信号与回退命令」表（如有，新增 #22~#26 行）

### Task C2：SKILL.md 快速自检补条

- [ ] 修改 `w-model-dev/SKILL.md`「快速自检」或等价节，补两条：
  ```markdown
  - [ ] JSON 文件写入用 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell ConvertTo-Json / Add-Content（反模式 #25）
  - [ ] acknowledgedDecisions 决策条目须含 ID 模式（REQ-/SD-/INTF-/DD-/TC-）或 TECH_KEYWORDS（JWT/HTTP/状态机/不变式/接口等），「同意」/「确认」视为空（反模式 #26 关联，R2 校验）
  ```

### Task C3：SSoT §3.4.11 第十六轮约束小节

- [ ] 修改 `docs/skill-design-document_SSoT.md` §3.4，新增 §3.4.11：
  ```markdown
  ### §3.4.11 第 16 轮：遗留问题与设计层缺口闭环

  > 2026-07-26 第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 + 4 demo 层设计缺口 + 4 技能包侧设计缺口）全量修正。

  | 约束 ID | 内容 | 关联文件 |
  |---|---|---|
  | P1.1 | tla-logic.ts 新增 R13 checkRounds schema 校验：元素须含 phase/round/specId/syntaxCheck/tlcCheck/violations(converged)，禁止 phaseSummary/summary/phaseDecisions 等 phase 级摘要字段 | tla-logic.ts / check-tla-model.ts / tla-plus-guide.md §checkRounds |
  | P2.1 | data-models.md 新增 RunLogEntry vs EventIngress Schema 边界对照表，显式区分两 schema 字段，禁止混用 | data-models.md |
  | P3.1 | phase-5-coding.md 新增禁止行为 #7（角色越权）+ 角色校验清单节 | phase-5-coding.md |
  | P3.2 | phase-3-interface-design.md 新增跨模块数据源选择约束节；phase-4-detailed-design.md 同步约束 | phase-3-interface-design.md / phase-4-detailed-design.md |
  | P3.3 | phase-5-coding.md 新增禁止行为 #8（副作用时序一致）+ 副作用时序一致性清单节 | phase-5-coding.md |
  | P3.4 | phase-7-system-test.md 新增禁止行为 #7（跨模块/角色/时序检测） | phase-7-system-test.md |
  | P4.1 | checkpoint-logic.ts ID_PATTERNS / TECH_KEYWORDS 集合补充注释（用途/扩展规则/与 R2 关系）；phase-8-acceptance-test.md 补 acknowledgedDecisions 关键词约束 | checkpoint-logic.ts / phase-8-acceptance-test.md |
  | P4.2 | operational-recovery.md 新增 JSON 文件写入工具选择节（强制 Node.js fs.writeFileSync，禁止 PowerShell）；anti-patterns.md 新增 #25 | operational-recovery.md / anti-patterns.md |
  | P4.3 | tla-plus-guide.md §checkRounds 字段表 violations 类型修正为 string[]（与 tla-logic.ts 一致）+ 新增禁止字段节 | tla-plus-guide.md |
  | 反模式 | 新增 #22（角色越权）/#23（跨模块 store 误用）/#24（副作用时序不一致）/#25（JSON PowerShell 写入）/#26（RunLogEntry 与 EventIngress 字段混用） | anti-patterns.md |
  ```

### Task C4：AGENTS.md §4 追加第十六轮结论

- [ ] 修改 `AGENTS.md` §4，在「第十五轮」结论后追加「第十六轮」结论：
  ```markdown
  - **第十六轮：遗留问题与设计层缺口闭环**（2026-07-26）：

  | 指标 | 数值 |
  |---|---|
  | 触发 | 第 15 轮端到端调测归档后识别 9 项问题（1 遗留 + 4 demo 层设计缺口 + 4 技能包侧设计缺口） |
  | 修正方案 | 方案 A 全量修正：技能包侧预防 demo 缺陷（不重建 demo）+ 脚本文档双改闭环 #14 + 反模式补强 |
  | 脚本改动 | 2 个（tla-logic.ts 新增 R13 checkRounds schema 校验 + checkpoint-logic.ts 注释补充） |
  | 新增 fixture | 1 个（tla/bad-checkrounds-phase-summary.json） |
  | reference 文档 | 8 个（tla-plus-guide / data-models / phase-3-interface-design / phase-4-detailed-design / phase-5-coding / phase-7-system-test / phase-8-acceptance-test / operational-recovery） |
  | 反模式新增 | 5 条（#22 角色越权 / #23 跨模块 store 误用 / #24 副作用时序不一致 / #25 JSON PowerShell 写入 / #26 RunLogEntry 与 EventIngress 字段混用） |
  | 顶层文档 | 3 个（SSoT §3.4.11 + AGENTS.md §4 + CHANGELOG.md [16.0.0]） |
  | self-test | 基线 94→95（+1 R13 样本）全通过 |
  | vitest | 76/76 或 77+/77+ 全通过 |
  | TypeScript strict | 0 错误 |

  > 第十六轮（2026-07-26）相比第十五轮（端到端调测）：从「demo 层调测发现 32 问题」进化为「技能包侧预防条款补强」，不重建 demo 仅在 reference 补强约束。tla-logic.ts 从「类型定义不校验」进化为「R13 schema 校验强制拦截 phase 级摘要」。data-models.md 从「RunLogEntry/EventIngress 分散定义」进化为「显式 Schema 边界对照表禁止混用」。anti-patterns.md 从「21 条」扩展为「26 条」，覆盖角色越权/跨模块 store 误用/副作用时序/PowerShell 写入/字段混用 5 类高发陷阱。
  ```

### Task C5：CHANGELOG.md 追加 [16.0.0]

- [ ] 修改 `CHANGELOG.md`，在文件顶部 `[15.0.0]` 节前新增 `[16.0.0]` 节：
  ```markdown
  ## [16.0.0] - 2026-07-26

  ### 第 16 轮 遗留问题与设计层缺口闭环

  全量修正第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 #14 + 4 demo 层设计缺口 P7-001~P7-004 + 4 技能包侧设计缺口 D1~D4），新增 5 条反模式 #22~#26，闭环第 15 轮共性问题 A/B/C/D。

  #### 新增

  - **tla-logic.ts R13 checkRounds schema 校验**：元素须含 phase/round/specId/syntaxCheck/tlcCheck/violations/converged，禁止 phaseSummary/summary/phaseDecisions 等 phase 级摘要字段（第 15 轮遗留 #14 闭环）
  - **data-models.md RunLogEntry vs EventIngress Schema 边界对照表**：显式区分两 schema 字段，禁止混用（第 15 轮共性问题 B 闭环）
  - **phase-5-coding.md 禁止行为 #7（角色越权）+ 角色校验清单节**：预防 P7-001 类缺陷
  - **phase-5-coding.md 禁止行为 #8（副作用时序一致）+ 副作用时序一致性清单节**：预防 P7-004 类缺陷
  - **phase-3-interface-design.md 跨模块数据源选择约束节 + phase-4-detailed-design.md 同步约束**：预防 P7-002/P7-003 类缺陷
  - **phase-7-system-test.md 禁止行为 #7（跨模块/角色/时序检测）**：系统测试阶段强制覆盖
  - **operational-recovery.md JSON 文件写入工具选择节**：强制 Node.js fs.writeFileSync，禁止 PowerShell（第 15 轮共性问题 A 闭环）
  - **anti-patterns.md #22~#26**：5 条新反模式覆盖角色越权/跨模块 store 误用/副作用时序/PowerShell 写入/字段混用
  - **checkpoint-logic.ts ID_PATTERNS / TECH_KEYWORDS 注释补充**：集合用途/扩展规则/与 R2 关系（第 15 轮共性问题 C 闭环）
  - **phase-8-acceptance-test.md acknowledgedDecisions 关键词约束节**：显式列出 ID 模式 + 技术关键词集合
  - **1 新 fixture**：tla/bad-checkrounds-phase-summary.json（R13 触发）
  - **1 新 self-test**（基线 94→95）：R13 checkRounds schema 样本

  #### 变更

  - tla-plus-guide.md §checkRounds 字段表 violations 类型从 `number` 改为 `string[]`（与 tla-logic.ts 一致，P4.3）
  - tla-plus-guide.md §checkRounds 新增「禁止字段」节 + spec 级语义明确
  - check-tla-model.ts JSON 摘要输出新增 checkRoundsViolations 字段
  - SKILL.md 快速自检补「JSON 文件写入用 Node.js fs.writeFileSync」+ 「acknowledgedDecisions 关键词」
  - anti-patterns.md 目录/对应关系/检测信号表同步 #22~#26

  #### 验证

  - TypeScript strict: 0 错误
  - self-test: 95/95 全通过（基线 94→95）
  - vitest: 76/76 或 77+/77+ 全通过
  - R13 手动验证：bad-checkrounds-phase-summary.json 触发 R13 退出码 1
  - 文档一致性：tla-plus-guide.md §checkRounds ↔ data-models.md ↔ tla-logic.ts / anti-patterns.md #22~#26 ↔ phase-3/4/5/7/8 ↔ SKILL.md / SSoT §3.4.11 ↔ AGENTS.md §4 ↔ CHANGELOG [16.0.0]
  ```

### Part C 完成验证

- [ ] 文档一致性检查：anti-patterns.md #22~#26 ↔ phase-3/4/5/7/8 禁止行为节 ↔ SKILL.md 快速自检
- [ ] 文档一致性检查：operational-recovery.md「JSON 文件写入工具选择」↔ anti-patterns.md #25
- [ ] 文档一致性检查：data-models.md Schema 边界对照表 ↔ anti-patterns.md #26
- [ ] 文档一致性检查：SSoT §3.4.11 ↔ AGENTS.md §4 第十六轮 ↔ CHANGELOG [16.0.0]
- [ ] `npx tsc --noEmit` 0 错误
- [ ] `npm run self-test` 95/95 全通过
- [ ] `npx vitest run` 全通过

---

## Part D：最终回归验证（5 个任务）

### Task D1：TypeScript strict 编译

- [ ] 执行 `npx tsc --noEmit`
- [ ] 预期：0 错误

### Task D2：self-test 全量回归

- [ ] 执行 `npm run self-test`
- [ ] 预期：95/95 全通过

### Task D3：vitest 全量回归

- [ ] 执行 `npx vitest run`
- [ ] 预期：76/76 或 77+/77+ 全通过（视 Part A Task A5 是否实施）

### Task D4：R13 手动验证

- [ ] 执行 `npx tsx w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json --skip-tlc`
- [ ] 预期：输出 `R13: checkRounds[0] 含禁止字段 phaseSummary`，退出码 1

### Task D5：文档一致性人工检查

- [ ] 检查 1：tla-plus-guide.md §checkRounds ↔ data-models.md tla-manifest.json 节 ↔ tla-logic.ts 类型定义（violations: string[]）
- [ ] 检查 2：anti-patterns.md #22~#26 ↔ phase-3/4/5/7/8 禁止行为节 ↔ SKILL.md 快速自检
- [ ] 检查 3：operational-recovery.md「JSON 文件写入工具选择」↔ anti-patterns.md #25
- [ ] 检查 4：data-models.md Schema 边界对照表 ↔ anti-patterns.md #26
- [ ] 检查 5：SSoT §3.4.11 ↔ AGENTS.md §4 第十六轮 ↔ CHANGELOG [16.0.0]

---

## 执行清单

**Part A（6 任务，可并行）**：A1 tla-logic.ts R13 / A2 check-tla-model.ts JSON / A3 fixture / A4 self-test / A5 vitest（可选）/ A6 checkpoint-logic.ts 注释

**Part B（11 任务，部分并行）**：B1 tla-plus-guide / B2 data-models Schema 边界 / B3 data-models tla-manifest / B4 phase-5 角色越权 / B5 phase-5 副作用时序 / B6 phase-3 数据源 / B7 phase-4 同步 / B8 phase-7 检测 / B9 phase-8 关键词 / B10 operational-recovery JSON 工具 / B11 验证

**Part C（5 任务，部分并行）**：C1 anti-patterns #22~#26 / C2 SKILL.md 自检 / C3 SSoT §3.4.11 / C4 AGENTS.md §4 / C5 CHANGELOG [16.0.0]

**Part D（5 任务，顺序执行）**：D1 tsc / D2 self-test / D3 vitest / D4 R13 手动 / D5 文档一致性

总计 27 任务（含 1 可选 + 1 验证），按 spec 实施顺序串行 Part A→B→C→D，Part 内并行。
