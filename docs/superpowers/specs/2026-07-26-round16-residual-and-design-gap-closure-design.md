# 第 16 轮：遗留问题与设计层缺口闭环修正设计 spec

> 2026-07-26 第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 + 4 demo 层设计缺口 + 4 技能包侧设计缺口）全量修正设计。
> 采用方案 A 全量修正：技能包侧预防 demo 缺陷（不重建 demo）+ 脚本文档双改闭环 #14 + 反模式补强。
> 关联调测：[w-model-dev-demo 第 15 轮归档](../../w-model-dev-demo/.w-model/project.json) status=项目完成，currentPhase=9。
> 关联上一轮设计：[2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md](./2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md)（第 13 轮门禁鲁棒性）。

## 1. 问题清单与优先级

### P1 脚本 schema 校验缺失（1 个，遗留）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P1.1 | tla-logic.ts 未校验 `checkRounds` schema，子代理误把 phase 级摘要写入 | [tla-logic.ts:76-85](../../w-model-dev/scripts/logic/tla-logic.ts) 定义了 `checkRounds` 类型但校验逻辑无对应 R 编号；第 15 轮阶段 3 子代理把 phase 级摘要（含 `summary` / `phaseSummary` 字段）写入 checkRounds，未被检测；[tla-plus-guide.md:233-256](../../w-model-dev/references/tla-plus-guide.md) 文档明确为 spec 级返工记录，但脚本不强制 | schema 漂移，子代理写入非法字段不被拦截，违反"脚本退出码为准"原则；遗留至本轮（CHANGELOG [15.0.0] 问题 #14） |

### P2 schema 边界混淆（1 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P2.1 | RunLogEntry 与 EventIngress schema 边界未在 data-models.md 显式区分 | [data-models.md:347-381](../../w-model-dev/references/data-models.md) RunLogEntry 字段 `runId/action/role/outcome`，[data-models.md:503-530](../../w-model-dev/references/data-models.md) EventIngress 字段 `eventId/eventType/source/summary`；两 schema 之间无对照表，第 15 轮阶段 1 子代理误用 `eventId`/`eventType`/`decisions`（EventIngress 字段）写 run-log.jsonl，触发 R1 失败（共性问题 B） | 子代理频繁混用字段，阶段 1/6/7/8 多次返工；data-models.md 缺少显式对照表导致边界模糊 |

### P3 demo 层设计缺口预防（4 个，技能包侧补强）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P3.1 | phase-5-coding.md「禁止行为」节缺角色越权预防条款 | 第 15 轮 P7-001 reader 可发博文（authRequired 仅校验 token 存在未校验角色）；[phase-5-coding.md:201-211](../../w-model-dev/references/phase-5-coding.md) 6 条禁止行为无角色校验项 | 角色越权缺陷带入运行时，security-auditor persona 无 phase-5 检查项可依 |
| P3.2 | phase-3/4 设计文档缺跨模块数据源选择约束 | 第 15 轮 P7-002 BloggerService.follow 校验 follower 在 blogger store（设计标注 user+）；P7-003 CommentService.create 仅校验 user store（blogger token sub 是 bloggerId）；[phase-3-interface-design.md] / [phase-4-detailed-design.md] 无「跨模块 store 须与 schema 一致」约束 | 跨模块数据流缺陷在系统测试才发现，修复成本高 |
| P3.3 | phase-5-coding.md「禁止行为」节缺副作用时序一致预防条款 | 第 15 轮 P7-004 PostController.get 响应体返回 recordView 自增前旧 viewCount；[phase-5-coding.md:201-211](../../w-model-dev/references/phase-5-coding.md) 无副作用时序约束 | 响应体字段与已生效状态不一致，集成测试难发现 |
| P3.4 | phase-7-system-test.md「禁止行为」节缺跨模块/角色/时序检测条款 | [phase-7-system-test.md:79-89](../../w-model-dev/references/phase-7-system-test.md) 6 条禁止行为无对应检测项 | 系统测试阶段无明确检查项覆盖 P7-001~P7-004 类缺陷 |

### P4 文档增强与工具约束（3 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P4.1 | checkpoint-logic.ts 的 ID_PATTERNS / TECH_KEYWORDS 集合无注释说明 | [checkpoint-logic.ts:71-86](../../w-model-dev/scripts/logic/checkpoint-logic.ts) 定义了 `ID_PATTERNS`（5 个正则）和 `TECH_KEYWORDS`（27 个关键词），但无注释说明集合用途、扩展规则、与 R2 校验的关系；第 15 轮阶段 6/7/8 多次因 acknowledgedDecisions 不含关键词返工（共性问题 C） | 子代理不知道哪些关键词会被识别，凭印象填写；扩展集合时无规则可循 |
| P4.2 | 无「JSON 文件写入工具选择」约束 | 第 15 轮共性问题 A：PowerShell ConvertTo-Json 不稳定（BOM + 深度）在阶段 5/6/7/8 多次返工；[operational-recovery.md] 无工具选择节；anti-patterns.md 无对应反模式 | 子代理持续用 PowerShell 写 JSON，返工循环未断 |
| P4.3 | tla-plus-guide.md §checkRounds 字段表 `violations` 类型与脚本不一致 | [tla-plus-guide.md:249](../../w-model-dev/references/tla-plus-guide.md) 文档 `violations: number`，[tla-logic.ts:83](../../w-model-dev/scripts/logic/tla-logic.ts) 脚本 `violations: string[]`；类型不一致 | 子代理按文档填 number 触发类型校验失败 |

---

## 2. 修正设计

### P1.1 tla-logic.ts 新增 R13 checkRounds schema 校验

**当前状态**：
- [tla-logic.ts:76-85](../../w-model-dev/scripts/logic/tla-logic.ts) 定义 `checkRounds?: Array<{phase, round, timestamp?, specId, syntaxCheck, tlcCheck, violations: string[], converged}>`，但无对应校验函数
- [tla-plus-guide.md:233-256](../../w-model-dev/references/tla-plus-guide.md) 文档明确为 spec 级返工记录
- [tla/valid.json:52](../../w-model-dev/scripts/samples/tla/valid.json) checkRounds 为 `[]`（合法）

**修正方案**：
1. 在 tla-logic.ts 新增 `R13_checkRoundsSchema` 校验函数：
   - checkRounds 可选，缺省视为 `[]`（合法）
   - 必须是数组（非数组 → R13 违反）
   - 每个元素须含全部必填字段：`phase` / `round` / `specId` / `syntaxCheck` / `tlcCheck` / `violations` / `converged`（`timestamp` 可选）
   - 字段类型校验：
     - `phase`: number ∈ [1, 8]
     - `round`: number ≥ 1
     - `specId`: 非空字符串
     - `syntaxCheck` / `tlcCheck` / `converged`: boolean
     - `violations`: string[]（与 tla-logic.ts 类型定义一致，修正 P4.3 文档错误）
   - **禁止字段**：元素不得含 `phaseSummary` / `summary` / `phaseDecisions` 等 phase 级摘要字段（命中 → R13 违反）
2. 将 R13 加入 `TlaCheckResult` 违反列表（新增 `checkRoundsViolations: string[]` 字段）
3. check-tla-model.ts 末尾 JSON 摘要同步输出 `checkRoundsViolations`
4. self-test.ts 新增 1 条样本：`tla/bad-checkrounds-phase-summary.json`（含 `phaseSummary` 字段触发 R13）

**fixture 设计**：
- `tla/bad-checkrounds-phase-summary.json`：在 valid.json 基础上，checkRounds 含一条带 `phaseSummary` 字段的记录，应触发 R13
- valid.json 保持 `checkRounds: []`（合法空数组）

**涉及文件**：
- `w-model-dev/scripts/logic/tla-logic.ts`：新增 R13 校验函数 + `checkRoundsViolations` 字段
- `w-model-dev/scripts/cli/check-tla-model.ts`：JSON 摘要输出新字段
- `w-model-dev/scripts/cli/self-test.ts`：新增 1 条 R13 样本（基线 94 → 95）
- `w-model-dev/scripts/samples/tla/bad-checkrounds-phase-summary.json`：新 fixture

### P2.1 data-models.md 新增 Schema 边界对照表

**当前状态**：
- RunLogEntry（[data-models.md:347-381](../../w-model-dev/references/data-models.md)）字段：`runId/timestamp/phase/phaseName/action/role/duration_s/tokens/estimated/subagentSpawns/gateExitCode/gateLogPath/outcome/acknowledgedDecisions/note/artifacts`
- EventIngress（[data-models.md:503-530](../../w-model-dev/references/data-models.md)）字段：`eventId/timestamp/source/eventType/summary/affectedArtifacts/affectedRequirements/evidence/routedTo`
- 两 schema 之间无对照表，子代理易混用 `eventId`/`eventType`/`decisions`（EventIngress 字段）写 run-log.jsonl

**修正方案**：
1. 在 data-models.md 的 `## 事件接驳模型` 节前新增 `### RunLogEntry vs EventIngress Schema 边界对照表`：
   - 用途对照：RunLogEntry = 编排者 O 维护的运行日志（append-only），EventIngress = 外部事件接驳（消费方写入）
   - 字段对照表（易混淆字段显式标注）：
     | 用途 | RunLogEntry 字段 | EventIngress 字段 | 区别 |
     |---|---|---|---|
     | 标识 | `runId` | `eventId` | 不同 ID 命名空间 |
     | 动作 | `action`（枚举） | `eventType`（枚举） | 不同枚举集 |
     | 角色 | `role`（O/A/S/V/G/R） | `source`（webhook/cron/manual） | 不同维度 |
     | 结果 | `outcome`（success/fail/...） | `routedTo`（路由决策） | 不同语义 |
     | 决策 | `acknowledgedDecisions`（数组） | 无 | 仅 RunLogEntry |
   - 禁止混用：`eventId`/`eventType`/`source`/`summary` 不得出现在 run-log.jsonl；`runId`/`action`/`role`/`outcome` 不得出现在 event-ingress.jsonl
2. 在 RunLogEntry 节末尾「使用约定」补一条：**禁止字段混用**：不得用 EventIngress 字段（`eventId`/`eventType`/`source`/`summary`）写 run-log.jsonl

**涉及文件**：
- `w-model-dev/references/data-models.md`：新增 Schema 边界对照表 + RunLogEntry 使用约定补条

### P3.1 phase-5-coding.md 新增角色越权预防条款

**修正方案**：
1. phase-5-coding.md「禁止行为」节新增第 7 条：
   - **禁止行为**：路由层或控制器入口仅校验 token 存在未校验角色（如 authRequired=true 但未校验 user/reader/blogger 角色）
   - **正确做法**：路由层或控制器入口必须显式校验 `requiredRole`，与需求/设计中的角色枚举一致；token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403
2. 新增「角色校验清单」节（在「代码审查」节后）：
   - 每个受保护端点须有 `requiredRole` 显式声明
   - 路由层或控制器入口须校验 `token.role ∈ requiredRoles`
   - 测试须覆盖「跨角色越权」场景（如 reader 调用 blogger-only 端点应返回 403）

**涉及文件**：
- `w-model-dev/references/phase-5-coding.md`：「禁止行为」节新增 #7 + 新增「角色校验清单」节

### P3.2 phase-3/4 新增跨模块数据源选择约束

**修正方案**：
1. phase-3-interface-design.md 新增「跨模块数据源选择约束」节：
   - 跨模块调用时，数据源（store）选择须在接口设计文档显式声明
   - store 选择须与 schema 一致（如 follower 校验应在 user store，不应在 blogger store）
   - 违反 → 集成测试阶段发现跨模块数据流缺陷，回 phase-3 返工
2. phase-4-detailed-design.md 同步约束：
   - 详细设计文档须列出每个跨模块调用的数据源选择
   - 数据源选择须与 phase-3 接口设计一致

**涉及文件**：
- `w-model-dev/references/phase-3-interface-design.md`：新增「跨模块数据源选择约束」节
- `w-model-dev/references/phase-4-detailed-design.md`：同步约束（引用 phase-3 节）

### P3.3 phase-5-coding.md 新增副作用时序一致预防条款

**修正方案**：
1. phase-5-coding.md「禁止行为」节新增第 8 条：
   - **禁止行为**：响应体字段返回副作用自增前的旧值（如 viewCount 自增后响应体仍返回旧值）
   - **正确做法**：副作用（如计数器自增、状态变更）须在响应体构造前完成；响应体字段须反映已生效的状态
2. 在「角色校验清单」节后新增「副作用时序一致性清单」节：
   - 每个含副作用的端点须在响应体构造前完成副作用
   - 测试须覆盖「副作用与响应体一致性」场景

**涉及文件**：
- `w-model-dev/references/phase-5-coding.md`：「禁止行为」节新增 #8 + 新增「副作用时序一致性清单」节

### P3.4 phase-7-system-test.md 新增检测条款

**修正方案**：
1. phase-7-system-test.md「禁止行为」节新增第 7 条：
   - **禁止行为**：系统测试未覆盖跨模块数据流校验 / 角色越权检测 / 副作用时序一致性检测
   - **正确做法**：系统测试用例须包含：
     - 跨模块数据流用例（验证 store 选择与 schema 一致）
     - 角色越权用例（验证 reader 不能调用 blogger-only 端点）
     - 副作用时序用例（验证响应体字段反映已生效状态）

**涉及文件**：
- `w-model-dev/references/phase-7-system-test.md`：「禁止行为」节新增 #7

### P4.1 checkpoint-logic.ts 注释补充

**修正方案**：
1. checkpoint-logic.ts 在 `ID_PATTERNS` 和 `TECH_KEYWORDS` 集合定义前新增注释块：
   - 集合用途：R2 决策内容具体性校验，每条 acknowledgedDecision 须命中 ID_PATTERNS 任一正则或 TECH_KEYWORDS 任一关键词
   - 扩展规则：
     - ID_PATTERNS 新增需求/设计/测试 ID 模式时，须同步更新 tla-plus-guide.md / data-models.md 对应字段表
     - TECH_KEYWORDS 新增技术关键词时，须与 project.json techStack 字段对齐
   - 与 R2 关系：命中黑名单 → 报黑名单违规；长度 < 10 → 报长度违规；无 ID/关键词 → 报名词违规

**涉及文件**：
- `w-model-dev/scripts/logic/checkpoint-logic.ts`：ID_PATTERNS / TECH_KEYWORDS 注释补充

### P4.2 operational-recovery.md + anti-patterns.md 新增 JSON 写入工具约束

**修正方案**：
1. operational-recovery.md 新增「JSON 文件写入工具选择」节：
   - **强制工具**：Node.js `fs.writeFileSync(path, content, 'utf-8')`
   - **禁止工具**：
     - PowerShell `ConvertTo-Json`（BOM + 深度问题，深度 > 2 时字段丢失）
     - PowerShell `Add-Content -Encoding UTF8`（中文乱码，UTF-8 BOM 导致 JSON 解析失败）
     - PowerShell `Out-File -Encoding UTF8`（同上）
   - **理由**：第 15 轮共性问题 A，PowerShell ConvertTo-Json 在阶段 5/6/7/8 多次返工
   - **示例**：
     ```javascript
     import { writeFileSync } from 'node:fs';
     writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
     ```
2. anti-patterns.md 新增 #25（候选，需 V 复审）：
   - **名称**：JSON 文件写入用 PowerShell ConvertTo-Json / Add-Content
   - **检测信号**：run-log.jsonl 中 note 字段含 "PowerShell" / "ConvertTo-Json" / "Add-Content" / "Out-File"
   - **违反后果**：回阶段起点，改用 Node.js fs.writeFileSync 重写
3. SKILL.md 快速自检补「JSON 文件写入用 Node.js fs.writeFileSync」

**涉及文件**：
- `w-model-dev/references/operational-recovery.md`：新增「JSON 文件写入工具选择」节
- `w-model-dev/references/anti-patterns.md`：新增 #25
- `w-model-dev/SKILL.md`：快速自检补条

### P4.3 tla-plus-guide.md §checkRounds 字段表类型修正

**修正方案**：
1. tla-plus-guide.md §checkRounds 字段表中 `violations` 类型从 `number` 改为 `string[]`
2. 新增「禁止字段」节：明确 checkRounds 元素不得含 `phaseSummary` / `summary` / `phaseDecisions` 等 phase 级摘要字段
3. data-models.md tla-manifest.json 节字段表同步对齐（如有引用）

**涉及文件**：
- `w-model-dev/references/tla-plus-guide.md`：§checkRounds 字段表类型修正 + 新增「禁止字段」节

### 反模式新增（5 条候选，需 V 复审）

1. **#22 角色越权**（P3.1 预防）：authRequired 仅校验 token 存在未校验角色
2. **#23 跨模块 store 误用**（P3.2 预防）：跨模块调用时 store 选择与 schema 不一致
3. **#24 副作用时序不一致**（P3.3 预防）：响应体字段返回副作用自增前的旧值
4. **#25 JSON 文件 PowerShell 写入**（P4.2 预防）：用 PowerShell ConvertTo-Json / Add-Content 写 JSON
5. **#26 RunLogEntry 与 EventIngress 字段混用**（P2.1 预防）：run-log.jsonl 含 eventId/eventType/decisions 等 EventIngress 字段

每条反模式须填写：
- 反模式名称 + 危害 + 正确做法
- 命中高发阶段
- 与门禁脚本的对应关系（#22 → 无脚本，靠 V-code 评审 + 系统测试用例；#23 → 无脚本，靠 V-design 评审 + 集成测试；#24 → 无脚本，靠 V-code 评审 + 系统测试；#25 → 无脚本，靠 run-log note 检测；#26 → check-run-log.ts R1 校验）
- 检测信号与回退动作

**涉及文件**：
- `w-model-dev/references/anti-patterns.md`：新增 #22~#26 + 目录/对应关系/检测信号表同步

### 顶层文档同步

1. SSoT §3.4 新增 §3.4.11 第十六轮约束小节
2. AGENTS.md §4 追加第十六轮修正结论（含指标表 + 与第十五轮对比）
3. CHANGELOG.md 追加 [16.0.0] 节

**涉及文件**：
- `docs/skill-design-document_SSoT.md`：新增 §3.4.11
- `AGENTS.md`：§4 追加第十六轮结论
- `CHANGELOG.md`：追加 [16.0.0]

---

## 3. 不涉及范围（明确边界）

- **不重建 w-model-dev-demo**（P7-001~P7-004 demo 层代码不修复，仅在技能包侧补预防条款）
- **不修改 w-model-dev-demo/.w-model/** （第 15 轮已归档，project.json status=项目完成）
- **不修改 check-run-log.ts / check-checkpoint.ts 的 R 编号**（#26 反模式靠现有 R1 校验覆盖，不新增 R 编号）
- **不新增 vitest 测试**（本轮以脚本 schema 校验 + 文档约束为主，vitest 76/76 不变；如需新增 R13 单元测试由 Part A 自决）
- **不修改 verifier-spec.md**（反模式靠 V-code/V-design 评审覆盖，不新增 targetKind）
- **不修改 subagent-delegation.md**（O/S/V/G/R 边界不变）
- **不新增脚本**（仅扩展现有 tla-logic.ts + checkpoint-logic.ts 注释）
- **不修改 maturity-logic.ts / budget-logic.ts / run-log-logic.ts / graph-logic.ts / code-tla-logic.ts**（与本轮问题无关）

---

## 4. 验证策略

1. **TypeScript strict**：0 错误（修改后 `npx tsc --noEmit`）
2. **self-test**：基线 94 → 95（新增 1 条 R13 checkRounds schema 样本）
3. **vitest**：76/76 不变（不修改 vitest 测试套件；如 Part A 新增 R13 单元测试则基线 76 → 77+）
4. **R13 手动验证**：用 `tla/bad-checkrounds-phase-summary.json` 跑 `check-tla-model.ts`，应输出 R13 违反，退出码 1
5. **文档一致性**：
   - tla-plus-guide.md §checkRounds ↔ data-models.md tla-manifest.json 节 ↔ tla-logic.ts 类型定义（violations: string[]）
   - anti-patterns.md #22~#26 ↔ phase-3/4/5/7 禁止行为节 ↔ SKILL.md 快速自检
   - operational-recovery.md「JSON 文件写入工具选择」↔ anti-patterns.md #25
   - data-models.md Schema 边界对照表 ↔ anti-patterns.md #26
   - SSoT §3.4.11 ↔ AGENTS.md §4 第十六轮 ↔ CHANGELOG [16.0.0]

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| R13 校验过严，历史 demo 的 tla-manifest.json 触发新违反 | 低 | 中 | 第 15 轮 demo 已清理，无回归风险；valid.json checkRounds=[] 合法 |
| 反模式 #22~#26 过度约束 | 低 | 低 | #22/#23/#24 靠 V 评审 + 系统测试覆盖，非强制门禁；#25/#26 靠 run-log 检测，退出码不阻断 |
| Schema 边界对照表与现有 RunLogEntry/EventIngress 节重复 | 低 | 低 | 对照表聚焦"易混用字段"，不重复 schema 完整定义；原节保留 |
| phase-3/4 新增约束导致历史 demo 设计文档不合规 | 低 | 低 | demo 已清理；新约束仅对未来项目生效 |
| 反模式 #25 检测信号 run-log note 含 "PowerShell" 误报 | 低 | 低 | note 字段非必填，子代理可主动标注；检测信号为软检测（V 评审），非脚本强制 |

---

## 6. 实施顺序

**Part A：脚本与 fixture（独立，可并行）**
1. P1.1 tla-logic.ts 新增 R13 checkRounds schema 校验 + `checkRoundsViolations` 字段
2. P1.1 check-tla-model.ts JSON 摘要输出新字段
3. P1.1 新增 fixture `tla/bad-checkrounds-phase-summary.json`
4. P1.1 self-test.ts 新增 R13 样本（基线 94 → 95）
5. P4.1 checkpoint-logic.ts ID_PATTERNS / TECH_KEYWORDS 注释补充
6. （可选）P1.1 vitest 新增 R13 单元测试（基线 76 → 77+）

**Part B：reference 文档（依赖 Part A 完成）**
7. P4.3 tla-plus-guide.md §checkRounds 字段表 `violations` 类型修正为 `string[]` + 新增「禁止字段」节
8. P1.1 tla-plus-guide.md §checkRounds 明确「禁止 phase 级摘要」语义
9. P2.1 data-models.md 新增「RunLogEntry vs EventIngress Schema 边界对照表」节 + RunLogEntry 使用约定补条
10. P1.1 data-models.md tla-manifest.json 节字段表对齐 tla-plus-guide.md
11. P3.1 phase-5-coding.md「禁止行为」节新增 #7（角色越权）+ 新增「角色校验清单」节
12. P3.3 phase-5-coding.md「禁止行为」节新增 #8（副作用时序一致）+ 新增「副作用时序一致性清单」节
13. P3.2 phase-3-interface-design.md 新增「跨模块数据源选择约束」节
14. P3.2 phase-4-detailed-design.md 同步约束（引用 phase-3）
15. P3.4 phase-7-system-test.md「禁止行为」节新增 #7
16. P4.1 phase-8-acceptance-test.md 补「acknowledgedDecisions 决策条目须含关键词」
17. P4.2 operational-recovery.md 新增「JSON 文件写入工具选择」节

**Part C：反模式与顶层文档（依赖 Part A/B 完成）**
18. anti-patterns.md 新增 #22~#26 + 目录/对应关系/检测信号表同步
19. SKILL.md 快速自检补「JSON 文件写入用 Node.js fs.writeFileSync」+ 「acknowledgedDecisions 关键词」
20. SSoT §3.4 新增 §3.4.11 第十六轮约束小节
21. AGENTS.md §4 追加第十六轮修正结论
22. CHANGELOG.md 追加 [16.0.0] 节

**Part D：最终回归验证（依赖 Part A/B/C 完成）**
23. npx tsc --noEmit（TypeScript strict 0 错误）
24. npm run self-test（基线 95/95 全通过）
25. npx vitest run（76/76 或 77+ 全通过）
26. R13 手动验证（check-tla-model.ts 跑 bad-checkrounds-phase-summary.json 应退出码 1）
27. 文档一致性人工检查（5 项互引一致）

Part A 内部 6 项可并行；Part B 内部 11 项部分可并行（不同文件无依赖）；Part C 内部 5 项部分可并行；Part D 顺序执行。
