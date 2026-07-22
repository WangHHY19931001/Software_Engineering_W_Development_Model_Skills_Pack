# 编排者-子代理边界（Orchestrator-Subagent Boundary）

> SSoT [§3.4](../../docs/skill-design-document_SSoT.md) 为权威定义，本文件为可执行细则。
>
> **目的**：编排者工作最小化——编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本），任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。
>
> **强制等级**：违反本文件「强制约束」节命中反模式 #10「编排者越权实施」（见 [anti-patterns.md](anti-patterns.md)），**命中即回退到当前阶段起点**。
>
> **与 [agent-personas.md](agent-personas.md) / [verifier-spec.md](verifier-spec.md) 的关系**：本文件定义「谁来做」（角色划分与分派），agent-personas.md 定义 V 子代理内部的角色视角，verifier-spec.md §7-§8 定义 V 子代理的输出 Schema 与提示词模板。三者互补，不冲突。

## 目录

- 角色划分（O / S / V / G）
- 每阶段分派时序
- 子代理分派模板
- 回填契约
- 强制约束
- 与现有约束的兼容性
- 失败模式与回退

## 角色划分（O / S / V / G）

| 角色 | 简称 | 职责 | 允许动作 | 禁止动作 |
|---|---|---|---|---|
| **编排者** | O | 路由、状态读写、CHECKPOINT 等待、分派子代理、持久化 | ① 读 `.w-model/project.json` / `.w-model/rtm.json`；② 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（只读，用于向用户展示或路由判定）；③ `git status` / `ls` / `Read` 等只读核验；④ 在 CHECKPOINT 暂停等待用户决定；⑤ 用户放行后更新 `project.status` 与 `updatedAt`；⑥ 分派 S / V / G 子代理 | ① 用 `Write` / `Edit` 写或修改任何阶段产物文件；② 产出 `VerifierOutput` JSON 内容；③ 修改 `rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 生成测试用例代码或业务代码；⑤ 跳过 S → V → G 顺序（如自评自审） |
| **产出子代理** | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体 | ① 写文件（需求规格 / 设计文档 / 代码 / 测试用例代码 / 测试报告）；② 跑测试运行器（仅产出阶段，如 `npx vitest run`）；③ 改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 加载当前阶段 `phase-N-*.md` 与对应模板 | ① 跑 `check-verifier-output.ts` / `check-artifact-gate.ts`（由 G 子代理负责）；② 越阶段产出（仅产当前阶段）；③ 改 `project.status`（由编排者负责） |
| **评审子代理** | V | 按 [agent-personas.md](agent-personas.md) + [verifier-spec.md](verifier-spec.md) §8 产出 `VerifierOutput` JSON | ① 读产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告）；② 按 `targetKind` 选用 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor）；③ 产出 `VerifierOutput` JSON（满足 [verifier-spec.md](verifier-spec.md) §7 Schema） | ① 跑门禁脚本（由 G 子代理负责）；② 改产物文件；③ 改 RTM；④ 跨阶段评审 |
| **门禁子代理** | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | ① 跑 `npx tsx w-model-dev/scripts/check-verifier-output.ts "<json>"`；② 跑 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]`；③ 读 GATE_JSON / Verifier JSON；④ 产出证据摘要字符串（含退出码 / 质量等级 / `passed` / `reworkHints`） | ① 改产物文件；② 产出 `VerifierOutput` JSON（由 V 子代理负责）；③ 改 RTM 实体；④ 跑测试运行器（由 S 子代理负责） |

> **只读脚本例外**：编排者可执行 `npx tsx w-model-dev/scripts/check-*.ts`、`git status`、`ls` 等确定性只读命令以核验状态/展示证据，但不得**写入或修改**任何产物/评审/RTM 内容。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施，也**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

## 每阶段分派时序

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集（SKILL.md + 当前阶段 phase-N）
O: 🔴 CHECKPOINT · 项目初始化（首次）或阶段进入确认
  ↓ 分派 S
S: 产出开发文档 + 同步测试设计 + 更新 RTM 实体 → 返回 {产物路径, RTM diff}
  ↓ 分派 V
V: 按 targetKind 路由 Persona → 产出 VerifierOutput JSON
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/check-verifier-output.ts "<json>"
   → 返回 {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode ≠ 0 或 qualityLevel ∈ {C,D}
   → 分派 S 返工（带 reworkHints），重走 V → G
O: 若通过
   → 🔴 CHECKPOINT · 阶段门放行（编排者展示 G 子代理返回的证据给用户）
O: 用户放行 → 编排者更新 project.status → 进入下一阶段
```

阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`：

```
O: 阶段 8 验收测试产物已放行
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
   → 返回 {exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果）}
O: 若 exitCode ≠ 0 → 分派 S 回阶段 5 返工
O: 若通过 → 🔴 CHECKPOINT · 发布放行（展示 GATE_JSON 给用户）
O: 用户确认 → 编排者更新 project.status = 验收通过 → 项目完成
```

## 子代理分派模板

> 编排者分派子代理时必须使用宿主 Agent 的子代理机制（如 Trae 的 Task 工具 / Claude Code 的 Task 工具 / Cursor 的子代理）。分派指令须包含完整上下文，子代理不得继承编排者会话历史。

### S 子代理分派模板

```
角色：产出子代理（S）
当前 W 模型阶段：<阶段 N - 名称>
任务：按 phase-<N>-*.md 产出本阶段开发产物 + 同步测试设计 + 更新 RTM 实体
上下文：
  - 项目状态：.w-model/project.json（已附）
  - 当前 RTM：.w-model/rtm.json（已附）
  - 上游产物路径：<列出已放行的上游产物路径>
  - 技术栈：<从 project.json.techStack 读取>
必读：
  - references/phase-<N>-*.md（按当前阶段加载）
  - references/rtm-guide.md
  - templates/<对应模板>.md
产出契约：
  1. 文件路径：<按 phase-N 定义>
  2. 同步测试设计：<按并行对应表>
  3. RTM 实体更新：<列出本次新增 / 修改的实体 ID>
  4. 返回编排者：{产物路径, RTM diff 摘要, 自检结果（按 phase-N 验收标准）}
禁止：
  - 跑 check-verifier-output.ts / check-artifact-gate.ts
  - 越阶段产出
  - 改 project.status
```

### V 子代理分派模板

```
角色：评审子代理（V）
评审目标：<targetKind> / <targetId>
任务：按 agent-personas.md 对应 Persona + verifier-spec.md §8 提示词产出 VerifierOutput JSON
上下文：
  - 待评审批产物路径：<列出 S 子代理产出的文件路径>
  - 上游产物路径（用于追溯）：<列出>
必读：
  - references/agent-personas.md（按 targetKind 选用 Persona）
  - references/verifier-spec.md §7（输出 Schema）+ §8（提示词模板）+ §7.4A（五轴 + Severity）
  - references/quality-standards.md（如评审代码 / 测试）
  - references/definition-of-done.md（如评审阶段门）
产出契约：
  1. VerifierOutput JSON 文件路径：<约定路径>
  2. 必须满足 verifier-spec.md §7 Schema（subCriteria / compositeScore / qualityLevel / passed / reworkHints）
  3. Severity 标签作为 reworkHints 前缀（[Critical] / [Required] / [Optional] / [Nit] / [FYI]）
  4. 返回编排者：{VerifierOutput JSON 路径, summary 摘要}
禁止：
  - 跑门禁脚本
  - 改产物文件
  - 改 RTM
  - 跨阶段评审
```

### G 子代理分派模板

```
角色：门禁子代理（G）
任务：跑确定性门禁脚本 + 回填证据摘要
上下文：
  - 待校验文件路径：<V 子代理产出的 VerifierOutput JSON / project-dir>
执行：
  - 阶段 1~7 门：npx tsx w-model-dev/scripts/check-verifier-output.ts "<verifier-output.json>"
  - 阶段 8 终检：npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
产出契约：
  1. 退出码（0 / 1 / 2）
  2. 证据摘要：
     - 阶段门：{exitCode, qualityLevel, passed, reworkHints}
     - 终检：{exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果）}
  3. 返回编排者：上述结构化摘要
禁止：
  - 改产物文件
  - 产出 VerifierOutput JSON
  - 改 RTM 实体
  - 跑测试运行器
```

## 回填契约

子代理返回编排者的数据格式（结构化，便于编排者路由判定与 CHECKPOINT 展示）：

### S 子代理返回

```json
{
  "role": "S",
  "phase": "<阶段 N - 名称>",
  "artifacts": ["<产物文件路径 1>", "<产物文件路径 2>"],
  "rtmDiff": {
    "added": ["REQ-001", "UAT-001"],
    "modified": ["REQ-002"],
    "removed": []
  },
  "selfCheck": {
    "acceptanceCriteriaMet": true,
    "notes": "<按 phase-N 验收标准自检的结果>"
  }
}
```

### V 子代理返回

```json
{
  "role": "V",
  "targetKind": "<file | testcase | design>",
  "targetId": "<目标 ID>",
  "persona": "<code-reviewer | test-engineer | security-auditor | performance-auditor>",
  "verifierOutputPath": "<VerifierOutput JSON 文件路径>",
  "summary": "<评审摘要>",
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>
}
```

### G 子代理返回

```json
{
  "role": "G",
  "script": "check-verifier-output.ts | check-artifact-gate.ts",
  "exitCode": 0,
  "evidence": {
    "qualityLevel": "<A | B | C | D，仅 check-verifier-output.ts>",
    "passed": <true | false，仅 check-verifier-output.ts>,
    "reworkHints": ["<仅 check-verifier-output.ts，按 Severity 前缀>"],
    "gateJson": {
      "coverage": "<仅 check-artifact-gate.ts，RTM 覆盖率>",
      "unitTestPassed": "<仅 check-artifact-gate.ts>",
      "integrationTestPassed": "<仅 check-artifact-gate.ts>",
      "systemTestPassed": "<仅 check-artifact-gate.ts>",
      "acceptanceTestPassed": "<仅 check-artifact-gate.ts>"
    }
  }
}
```

编排者收到 G 子代理返回后：
- `exitCode=0` 且 `qualityLevel ∈ {A,B}` 且 `passed=true` → 进入 🔴 CHECKPOINT · 阶段门放行；
- `exitCode=1` → 分派 S 子代理返工（带 `reworkHints`），重走 V → G；
- `exitCode=2` → 输入错误，重新分派 V 子代理产出 JSON（阶段门）或修复 `rtm.json`（终检）。

## 强制约束

编排者不得直接执行以下任何动作（命中即触发反模式 #10，回到当前阶段起点重做）：

1. **写产物**：用 `Write` / `Edit` 写或修改任何阶段产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告 / 评审报告）。
2. **产出评审**：直接产出 `VerifierOutput` JSON 内容（评审必须分派 V 子代理）。
3. **改 RTM 实体**：修改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果；编排者只可更新 `project.status` 与 `updatedAt`）。
4. **生成代码**：生成测试用例代码或业务代码。
5. **跳过顺序**：跳过 S → V → G 顺序（如编排者自评自审、或跳过 V 直接由编排者判断质量）。

编排者**允许**的动作：
- 读 `.w-model/project.json` / `.w-model/rtm.json`；
- 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（用于向用户展示或路由判定，不替代 G 子代理的回填职责）；
- `git status` / `ls` / `Read` 等只读核验；
- 在 CHECKPOINT 暂停等待用户决定；
- 用户放行后更新 `project.status` 与 `updatedAt`；
- 分派 S / V / G 子代理。

> **检测信号**：编排者会话出现 `Write` / `Edit` 调用写阶段产物文件；或编排者直接产出 `VerifierOutput` JSON 内容；或编排者 `git diff` 含非 `.w-model/*.json` 状态文件改动；或编排者会话出现代码 / 测试用例 / 评审 JSON 的生成内容。命中任一信号即触发反模式 #10。

> **回退动作**：① 立即停止编排者当前动作；② 已越权产出的实体作废重做；③ 重新分派 S 子代理产出；④ 重走 V → G；⑤ 编排者会话内仅保留路由 / 状态 / CHECKPOINT / 只读脚本记录。

## 与现有约束的兼容性

- **约束 4「真实执行」**：G 子代理跑脚本 + 回填退出码 = 真实执行，不冲突。
- **约束 6「按需加载」**：子代理按需加载对应 `phase-N-*.md`，编排者只加载 `SKILL.md` + 状态文件，加载面更窄。
- **约束 2「阶段门放行」**：G 子代理返回证据 → 编排者展示给用户 → CHECKPOINT 等待，不冲突。
- **[`verifier-spec.md`](verifier-spec.md) §7.6「外部 Agent 执行」**：V 子代理即「外部 Agent」，边界一致。
- **[`agent-personas.md`](agent-personas.md) 4 个 Persona**：V 子代理按 `targetKind` 选用，无改动。
- **技能不内置 LLM**：V 子代理由编排者通过宿主 Agent 的子代理机制（如 Task 工具）启动，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用。

## 失败模式与回退

| 失败场景 | 处理 |
|---|---|
| S 子代理产出未通过自检（`acceptanceCriteriaMet=false`） | 编排者不分派 V，直接分派 S 返工 |
| V 子代理产出 JSON 不满足 Schema | G 子代理 `check-verifier-output.ts` 退出码 2 → 编排者分派 V 重新产出 |
| G 子代理 `check-verifier-output.ts` 退出码 1（评审未通过） | 编排者分派 S 返工（带 `reworkHints`），重走 V → G |
| G 子代理 `check-artifact-gate.ts` 退出码 1（质量门未通过） | 编排者分派 S 回阶段 5 返工 |
| 编排者自身越权实施（命中反模式 #10） | 回到当前阶段起点，已越权产出的实体作废重做 |
| 子代理无法独立完成（如 BLOCKED 状态） | 子代理返回 `{"status": "BLOCKED", "reason": "..."}`；编排者向用户澄清后重新分派 |

## 与 addyosmani/agent-skills 的差异

| 维度 | addyosmani 原版 | W 模型适配版 |
|---|---|---|
| 子代理分派方式 | 由 Agent 自身决定 | 强制 O / S / V / G 四角色，编排者不得越权实施 |
| 评审独立性 | 由 Agent 自评 | V 子代理物理隔离，不接触 S 子代理内部推理 |
| 门禁执行 | 由 Agent 直接跑 | G 子代理独立跑 + 回填证据摘要 |
| 编排者越权处置 | 无强制机制 | 反模式 #10，命中即回退 |
