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
