# 反例与黑名单（Anti-Patterns）

> W 模型执行中真实高发陷阱。命中任一条即视为流程破坏，必须回退到对应阶段起点。
>
> 本文件由 [`w-model-dev/SKILL.md`](../SKILL.md)「反例与黑名单」节拆出，供 Agent 在阶段门评审前对照核验。

## 反模式清单

| # | 反模式（不要做） | 危害 | 正确做法 |
|---|---|---|---|
| 1 | 跳过阶段门评审"直接进入下一阶段" | 缺陷后移，测试前置失效 | 必须按 SKILL.md §2 走完评审 + 🔴 CHECKPOINT 放行 |
| 2 | 将测试设计后置到编码之后 | 破坏 W 模型并行原则，测试失去前置发现能力 | 进入开发阶段时同步产出对应测试设计（见并行对应表） |
| 3 | 用 LLM 自行"估算"质量门结果 | 估算不可信，RTM 覆盖率 / 测试通过状态会被编造 | 必须执行 [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)，以退出码 + GATE_JSON 为准 |
| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评 |
| 5 | 一次性载入全部 `references/` | 上下文污染，阶段聚焦丢失 | 仅加载当前阶段所需 `references/phase-N-*.md` |
| 6 | 用 LLM 估算 RTM 覆盖率 | RTM 覆盖率造假，追溯链断裂 | 实际核验 RTM 登记项，RTM 覆盖率必须 100% |
| 7 | 质量门脚本退出码 1/2 时放行发布 | 缺陷带病上线 | 退出码非 0 一律回到编码实现，附 GATE_JSON 详情 |
| 8 | 越过 🔴 CHECKPOINT 自动推进 | 用户失去决策权，自主失控 | 到达 CHECKPOINT 必须暂停等用户确认 |
| 9 | 谎报阶段状态（未完成标为完成） | 阶段门依赖断裂，下游全部失真 | `status` 字段如实反映，未完成不得推进 |

### 命中高发阶段

| 反模式 | 最易命中阶段 | 阶段指引 |
|---|---|---|
| #1（跳过评审） | 全阶段 | 各 phase-N「阶段门评审」节 |
| #2（测试设计后置） | 阶段 1~4 | 各 phase-N「并行任务（强制）」节 |
| #3（估算质量门） | 阶段 5~7 | [phase-5-coding.md](phase-5-coding.md) / [phase-7-system-test.md](phase-7-system-test.md) |
| #4（评审未通过悄悄小修） | 全阶段 | 各 phase-N「返工路径」节 |
| #5（一次性载入全部 references） | 阶段 0 | SKILL.md §0「任务接入」步骤 3 |
| #6（估算 RTM 覆盖率） | 阶段 7~8 | [phase-7-system-test.md](phase-7-system-test.md) / [phase-8-acceptance-test.md](phase-8-acceptance-test.md) |
| #7（退出码 1/2 放行） | 阶段 5~7 | [quality-standards.md](quality-standards.md)「质量门检查清单」 |
| #8（越过 CHECKPOINT） | 全阶段 | 各 phase-N「🔴 CHECKPOINT」标记 |
| #9（谎报状态） | 全阶段 | SKILL.md §4「数据与状态管理」 |

## 与门禁脚本的对应关系

| 反模式 | 由哪个脚本 / 机制守护 |
|---|---|
| #1（跳过评审） | SKILL.md §2「阶段门评审」+ 🔴 CHECKPOINT · 阶段门放行 |
| #2（测试设计后置） | SKILL.md §1「执行阶段任务」步骤 2「并行产出测试设计」 |
| #3 / #6（估算质量门 / RTM 覆盖率） | [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)（退出码 0 才算通过） |
| #4（评审未通过悄悄小修） | [`check-verifier-output.ts`](../scripts/check-verifier-output.ts)（rework 闭环校验） |
| #5（一次性载入全部 references） | SKILL.md §0「任务接入」步骤 3 |
| #7（退出码 1/2 放行） | 🔴 CHECKPOINT · 发布放行（明确「退出码 1/2 一律不得放行」） |
| #8（越过 CHECKPOINT） | 🔴 CHECKPOINT 视觉标记（Agent 扫描锚点） |
| #9（谎报状态） | SKILL.md §4「数据与状态管理」+ `status` 字段约束 |

## 命中后的处理流程

1. **立即停止当前阶段推进**：不得继续产出或修改实体。
2. **回退到对应阶段起点**：根据反模式定位回退点（评审 → 重新评审 / 编码 → 返工 / 测试 → 重新执行）。
3. **告知用户**：在交互中明示命中的反模式编号与正确做法，由用户确认回退动作。
4. **记录教训**：在《测试报告》或《评审报告》的「备注」节记录命中的反模式，便于后续阶段避免重复。

## 检测信号与回退命令（指令具体性）

> Agent 自检「是否已命中反模式」的检测信号 + 命中后的具体回退命令。每条与门禁脚本退出码精确对应。

| # | 检测信号（Agent 自查） | 命中后回退命令 | 对应退出码 |
|---|---|---|---|
| #1 | 阶段产物已产出但无 `VerifierOutput` JSON 文件 / 未调用 `check-verifier-output.ts` | `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>`；JSON 不存在则重新执行评审 | `check-verifier-output.ts` 退出码 0 才算评审闭环 |
| #2 | 阶段 1~4 产物存在但对应测试设计文档缺失（如阶段 3 无 `interface-test-design.md`） | 回到阶段 N 起点，按 `phase-N-*.md`「并行任务（强制）」节补产出测试设计 | 无脚本；Agent 比对 `templates/` 模板核验 |
| #3 | 质量门节点未执行 `check-artifact-gate.ts` / 仅 LLM 文本说「通过」 | 立即执行 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]`，退出码非 0 一律回阶段 5 | `check-artifact-gate.ts` 退出码 0=通过 / 1=未通过 / 2=输入错误 |
| #4 | `VerifierOutput.passed=false` 但 `Project.status` 已推进到下一阶段 | 回到本阶段起点，按 `reworkHints` 修复后重评，重置 `status` 字段 | `check-verifier-output.ts` 退出码 0 + `passed=true` |
| #5 | Agent 上下文同时加载 ≥3 个 `references/phase-N-*.md` 文件 | 卸载无关 phase 文档，仅保留当前阶段 + `SKILL.md` + 必要 references | 无脚本；Agent 自检加载列表 |
| #6 | RTM 覆盖率字段为 LLM 估算（无 `check-artifact-gate.ts` 输出佐证） | 执行 `check-artifact-gate.ts` 重新计算覆盖率；估算值不得写入 `rtm.json` | `check-artifact-gate.ts` 退出码 0 + `GATE_JSON.coverage=100%` |
| #7 | `check-artifact-gate.ts` 退出码 1/2 但 `Project.status` 已标「验收通过」 | 重置 `status` 为「编码」，回阶段 5 返工；附 GATE_JSON 详情告知用户 | 退出码 1/2 → 一律回阶段 5 |
| #8 | 到达 🔴 CHECKPOINT 节点后无「等待用户确认」记录直接推进 | 回到 CHECKPOINT 节点重新暂停，向用户展示放行判定并由用户确认 | 无脚本；Agent 自检对话流 |
| #9 | `Project.status` / `Requirement.status` 字段值与实际产物不符（如标「已完成」但无代码） | 按实际进度修正 `status` 字段；未完成不得推进到下一阶段 | 无脚本；Agent 比对 `rtm.json` 与磁盘产物 |

### 门禁脚本退出码精确对应表

| 脚本 | 退出码 | 含义 | 触发的反模式 | 回退动作 |
|---|---|---|---|---|
| `check-verifier-output.ts` | 0 | 评审通过 | — | 可推进到下一阶段 |
| `check-verifier-output.ts` | 1 | 评审未通过（schema / 方差 / 分数不达标） | #1 / #4 | 回到当前阶段起点返工 |
| `check-verifier-output.ts` | 2 | 输入错误（JSON 缺失 / 路径错误） | #1 | 重新执行评审产出 JSON |
| `check-artifact-gate.ts` | 0 | 质量门通过 | — | 可发布 |
| `check-artifact-gate.ts` | 1 | 质量门未通过（覆盖率 / 测试状态不达标） | #3 / #6 / #7 | 回阶段 5 编码返工 |
| `check-artifact-gate.ts` | 2 | 输入错误（`rtm.json` 缺失 / 字段错误） | #9 | 修复 `rtm.json` 后重跑 |

> 退出码 1/2 一律不得放行；Agent 必须在交互中明示退出码数值与触发回退的反模式编号。

## 实现层经验教训（来自端到端调测）

> 以下不属于 W 模型**流程**反模式（命中不会触发阶段回退），而是 W 模型端到端调测中沉淀的**代码层**经验教训。
> Agent 在阶段 5（编码）与阶段 6（集成测试）应主动规避，避免重蹈覆辙。
> 来源：[`w-model-dev-demo/`](../../w-model-dev-demo) 博客系统后端端到端调测（2026-07-20）。

| # | 教训 | 触发场景 | 危害 | 规避做法 |
|---|---|---|---|---|
| L1 | Express 4 路由直接使用 `async (req, res, next) => {...}` 而不包装 | 阶段 5 编码：在 Express 4 路由中抛出 `AppError` 子类（如 `ForbiddenError` / `NotFoundError`） | rejected promise 不被错误中间件捕获，表现为 Unhandled Rejection，错误响应体不符合 `{error: string}` 契约，首轮集成测试集体失败 | 引入 `asyncHandler` 包装器包裹全部路由：`(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`；详见 [w-model-dev-demo/src/utils/async-handler.ts](../../w-model-dev-demo/src/utils/async-handler.ts) 与 [integration-test-report.md](../../w-model-dev-demo/docs/integration-test-report.md) §5 |

### 适用范围与扩展规则

- 本节仅记录**真实调测中发现并修正过**的代码层教训，每条须可指向具体的缺陷与修正证据（demo 内的代码 / 报告链接）。
- 新增教训时，同步在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 「过程中发现的缺陷与修正」表登记对应缺陷行，保证双向可追溯。
- 教训不命中阶段回退；若 Agent 在阶段 6 集成测试中再次触发已记录教训，应在《测试报告》「备注」节标注「重蹈 L#」并提示用户复核阶段 5 编码规范。
