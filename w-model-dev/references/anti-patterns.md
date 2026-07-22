# 反例与黑名单（Anti-Patterns）

> W 模型执行中真实高发陷阱。命中任一条即视为流程破坏，必须回退到对应阶段起点。
>
> 本文件由 [`w-model-dev/SKILL.md`](../SKILL.md) 的“反例与黑名单”节拆出，供 Agent 在阶段门评审前对照核验。

## 目录

- 反模式清单（12 条流程反模式 #1~#12）
- 命中高发阶段
- 与门禁脚本的对应关系
- 检测信号与回退动作
- 实现层经验教训（代码层 L1~L4）
- 失败模式清单（10 条行为退化 F1~F10）

## 反模式清单

| # | 反模式（不要做） | 危害 | 正确做法 |
|---|---|---|---|
| 1 | 跳过阶段门评审"直接进入下一阶段" | 缺陷后移，测试前置失效 | 必须按 SKILL.md「阶段门与质量门」节走完评审 + 🔴 CHECKPOINT 放行 |
| 2 | 将测试设计后置到编码之后 | 破坏 W 模型并行原则，测试失去前置发现能力 | 进入开发阶段时同步产出对应测试设计（见并行对应表） |
| 3 | 用 LLM 自行"估算"质量门结果 | 估算不可信，RTM 覆盖率 / 测试通过状态会被编造 | 必须执行 [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)，以退出码 + GATE_JSON 为准 |
| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评 |
| 5 | 一次性载入全部 `references/` | 上下文污染，阶段聚焦丢失 | 仅加载当前阶段所需 `references/phase-N-*.md` |
| 6 | 用 LLM 估算 RTM 覆盖率 | RTM 覆盖率造假，追溯链断裂 | 实际核验 RTM 登记项，RTM 覆盖率必须 100% |
| 7 | 质量门脚本退出码 1/2 时放行发布 | 缺陷带病上线 | 退出码非 0 一律回到编码实现，附 GATE_JSON 详情 |
| 8 | 越过 🔴 CHECKPOINT 自动推进 | 用户失去决策权，自主失控 | 到达 CHECKPOINT 必须暂停等用户确认 |
| 9 | 谎报阶段状态（未完成标为完成） | 阶段门依赖断裂，下游全部失真 | `status` 字段如实反映，未完成不得推进 |
| 10 | 编排者越权实施（写代码 / 改文档 / 产出评审 JSON / 改 RTM 实体 / 生成测试用例） | 编排者上下文污染、评审独立性丧失、状态机失真、违反「技能不内置 LLM」架构原则 | 编排者仅分派 S / V / G 子代理执行实施动作；自身只做路由 + 状态 + CHECKPOINT + 只读脚本（见 [subagent-delegation.md](subagent-delegation.md)） |
| 11 | ingestion 跳过图谱校验 | 阶段 1-4 结构连通性失守，孤立 / 多根 / 追溯断裂带入编码，graph.json 形同虚设 | 阶段 1-4 必须跑 [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)，不得跳过 A→G 收敛循环（见 [graph-guide.md](graph-guide.md)） |
| 12 | A 子代理自评收敛（用 LLM 输出判定收敛） | "LLM 估算质量门"在 ingestion 场景的变体，收敛判定漂移 | 收敛判定由 G 跑 `check-requirement-graph.ts` 退出码决定，A 的 `reworkHints` 仅作指引 |

### 命中高发阶段

| 反模式 | 最易命中阶段 | 阶段指引 |
|---|---|---|
| #1（跳过评审） | 全阶段 | 各 phase-N「阶段门评审」节 |
| #2（测试设计后置） | 阶段 1~4 | 各 phase-N「并行任务（强制）」节 |
| #3（估算质量门） | 阶段 5~7 | [phase-5-coding.md](phase-5-coding.md) / [phase-7-system-test.md](phase-7-system-test.md) |
| #4（评审未通过悄悄小修） | 全阶段 | 各 phase-N「返工路径」节 |
| #5（一次性载入全部 references） | 全阶段 | SKILL.md「不可违反的约束」第 6 条「按需加载」 |
| #6（估算 RTM 覆盖率） | 阶段 7~8 | [phase-7-system-test.md](phase-7-system-test.md) / [phase-8-acceptance-test.md](phase-8-acceptance-test.md) |
| #7（退出码 1/2 放行） | 阶段 5~7 | [quality-standards.md](quality-standards.md)「质量门检查清单」 |
| #8（越过 CHECKPOINT） | 全阶段 | 各 phase-N「🔴 CHECKPOINT」标记 |
| #9（谎报状态） | 全阶段 | [data-models.md](data-models.md)「项目数据模型」 |
| #10（编排者越权实施） | 全阶段 | [subagent-delegation.md](subagent-delegation.md)「强制约束」节 + SKILL.md「不可违反的约束」第 8 条 |
| #11（ingestion 跳过图谱校验） | 阶段 1~4 | [graph-guide.md](graph-guide.md) + [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) |
| #12（A 自评收敛） | 阶段 1~4 | [graph-guide.md](graph-guide.md)「收敛准则」节 |

## 与门禁脚本的对应关系

| 反模式 | 由哪个脚本 / 机制守护 |
|---|---|
| #1（跳过评审） | SKILL.md「阶段门与质量门」节 + 🔴 CHECKPOINT · 阶段门放行 |
| #2（测试设计后置） | SKILL.md「不可违反的约束」第 1 条「测试设计前置」 |
| #3 / #6（估算质量门 / RTM 覆盖率） | [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)（退出码 0 才算通过） |
| #4（评审未通过悄悄小修） | [`check-verifier-output.ts`](../scripts/check-verifier-output.ts)（rework 闭环校验） |
| #5（一次性载入全部 references） | SKILL.md「不可违反的约束」第 6 条「按需加载」 |
| #7（退出码 1/2 放行） | 🔴 CHECKPOINT · 发布放行（明确「退出码 1/2 一律不得放行」） |
| #8（越过 CHECKPOINT） | 🔴 CHECKPOINT 视觉标记（Agent 扫描锚点） |
| #9（谎报状态） | [data-models.md](data-models.md)「项目数据模型」+ `status` 字段约束 |
| #10（编排者越权实施） | [subagent-delegation.md](subagent-delegation.md)「强制约束」节 + 编排者自身动作清单（O/S/V/G 角色表） |
| #11（ingestion 跳过图谱校验） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)（退出码 0 才算通过）+ 🔴 CHECKPOINT · ingestion 收敛确认 |
| #12（A 自评收敛） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts) 退出码（A 的 `reworkHints` 不替代 G 判定） |

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
| #10 | 编排者会话出现 `Write` / `Edit` 调用写阶段产物文件；或编排者直接产出 `VerifierOutput` JSON 内容；或编排者 `git diff` 含非 `.w-model/*.json` 状态文件改动；或编排者会话出现代码 / 测试用例 / 评审 JSON 的生成内容 | 回到当前阶段起点：① 已越权产出的实体作废重做；② 重新分派 S 子代理产出；③ 重走 V → G；④ 编排者会话内仅保留路由 / 状态 / CHECKPOINT / 只读脚本记录 | 无脚本；编排者自检动作清单 + 宿主 Agent 工具调用日志（`Write`/`Edit` 不得出现在编排者会话） |
| #11 | 阶段 1-4 未跑 `check-requirement-graph.ts` 直接进 S 产出 / V 评审；或编排者跳过 A→G 收敛循环 | 回到当前阶段起点，补跑 ingestion 子流程（A-chunk → A-cross/A-evolve → G 图谱校验） | `check-requirement-graph.ts` 退出码 0 才算收敛闭环 |
| #12 | A-cross/A-evolve 的 LLM 输出被直接用作收敛判定，未经 G 跑 `check-requirement-graph.ts` | 作废 A 的收敛声明，分派 G 跑脚本，按退出码重新判定 | `check-requirement-graph.ts` 退出码 0=通过 / 1=校验失败 / 2=输入错误 |

### 门禁脚本退出码精确对应表

| 脚本 | 退出码 | 含义 | 触发的反模式 | 回退动作 |
|---|---|---|---|---|
| `check-verifier-output.ts` | 0 | 评审通过 | — | 可推进到下一阶段 |
| `check-verifier-output.ts` | 1 | 评审未通过（schema / 方差 / 分数不达标） | #1 / #4 | 回到当前阶段起点返工 |
| `check-verifier-output.ts` | 2 | 输入错误（JSON 缺失 / 路径错误） | #1 | 重新执行评审产出 JSON |
| `check-artifact-gate.ts` | 0 | 质量门通过 | — | 可发布 |
| `check-artifact-gate.ts` | 1 | 质量门未通过（覆盖率 / 测试状态不达标） | #3 / #6 / #7 | 回阶段 5 编码返工 |
| `check-artifact-gate.ts` | 2 | 输入错误（`rtm.json` 缺失 / 字段错误） | #9 | 修复 `rtm.json` 后重跑 |
| `check-requirement-graph.ts` | 0 | 图谱结构门禁通过（连通 / 单根 / 父唯一 / 阶段追溯零违反） | — | 可推进（阶段 4 通过即可进阶段 5 编码） |
| `check-requirement-graph.ts` | 1 | 图谱校验失败（孤立 / 多根 / orphan / multiParent / 追溯违反） | #11 / #12 | 回到当前阶段起点，补跑 A→G 收敛循环 |
| `check-requirement-graph.ts` | 2 | 输入错误（`graph.json` / `consolidated.json` 缺失或损坏） | #11 | 从 `graph.phase-N.bak.json` 恢复或重跑 ingestion |

> 退出码 1/2 一律不得放行；Agent 必须在交互中明示退出码数值与触发回退的反模式编号。

## #11 ingestion 跳过图谱校验

**检测信号**：阶段 1-4 未跑 `check-requirement-graph.ts` 直接进 S 产出 / V 评审；或编排者跳过 A→G 收敛循环。

**回退动作**：回到当前阶段起点，补跑 ingestion 子流程（A-chunk → A-cross/A-evolve → G 图谱校验）。

**与约束 4 的关系**：图谱校验是"真实执行"在结构层的延伸，不得用 LLM 估算替代脚本退出码。

## #12 A 子代理自评收敛

**检测信号**：A-cross/A-evolve 的 LLM 输出被直接用作收敛判定，未经 G 跑 `check-requirement-graph.ts`。

**回退动作**：作废 A 的收敛声明，分派 G 跑脚本，按退出码重新判定。

**与反模式 #3/#6 的关系**：这是"LLM 估算质量门"在 ingestion 场景的变体——A 的 reworkHints 是指引不是判定。

## 实现层经验教训（来自端到端调测）

> 以下不属于 W 模型**流程**反模式（命中不会触发阶段回退），而是 W 模型端到端调测中沉淀的**代码层**经验教训。
> Agent 在阶段 5（编码）与阶段 6（集成测试）应主动规避，避免重蹈覆辙。
> 来源：[`w-model-dev-demo/`](../../w-model-dev-demo) 博客系统后端端到端调测（两轮：2026-07-20 首轮 + 2026-07-21 从零重建第二轮）。

| # | 教训 | 触发场景 | 危害 | 规避做法 |
|---|---|---|---|---|
| L1 | Express 4 路由直接使用 `async (req, res, next) => {...}` 而不包装 | 阶段 5 编码：在 Express 4 路由中抛出 `AppError` 子类（如 `ForbiddenError` / `NotFoundError`） | rejected promise 不被错误中间件捕获，表现为 Unhandled Rejection，错误响应体不符合 `{error: string}` 契约，首轮集成测试集体失败 | 引入 `asyncHandler` 包装器包裹全部路由：`(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`；详见 [w-model-dev-demo/src/utils/async-handler.ts](../../w-model-dev-demo/src/utils/async-handler.ts) 与 [integration-test-report.md](../../w-model-dev-demo/docs/integration-test-report.md) §5 |
| L2 | 模块加载阶段读取环境变量并直接 `throw`（如 `process.env.JWT_SECRET ?? (() => { throw ... })()`） | 阶段 5 编码：在 `src/utils/env.ts` 等模块顶层用 IIFE 抛错保护必填环境变量 | 测试套件在 `collect` 阶段即崩溃（模块 import 失败），连锁导致所有间接依赖该模块的测试文件 0 用例；vitest 报 `0 test` 而非 `fail`，掩盖真实失败数 | ① 模块加载阶段只读不抛，运行时（如服务启动）再校验必填；② 测试脚本统一注入环境变量（如 `cross-env JWT_SECRET=test-secret`）；详见 [w-model-dev-demo/src/utils/env.ts](../../w-model-dev-demo/src/utils/env.ts) 与 [w-model-dev-demo/package.json](../../w-model-dev-demo/package.json) |
| L3 | service 类导出方式反复：内部 `class Foo` + `export const foo = new Foo()` 实例，丢失类型导出 | 阶段 5 编码：将原 `export class ArticleService` 改为内部 `class ArticleService` + `export const articleService`，但其他模块仍 `import type { ArticleService }` | `tsc --strict` 报 TS2724「no exported member named 'ArticleService'」，违反 NFR-003「tsc 0 错误」；回归测试发现后必须回退导出 | 类型与实例可同时导出：`export class ArticleService {}` + `export const articleService = new ArticleService()`；改导出方式前先 `grep -rE "import type \{ .*ArticleService"` 全仓库扫描消费者；详见 [w-model-dev-demo/src/services/article-service.ts](../../w-model-dev-demo/src/services/article-service.ts) |
| L4 | vitest mock 与 express 中间件类型不兼容：`vi.fn() as unknown as NextFunction` 后访问 `next.mock.calls` | 阶段 5 编码：测试中 `const next = vi.fn() as unknown as NextFunction`，断言 `next.mock.calls[0][0]` | `tsc --strict` 报 TS2339「Property 'mock' does not exist on type 'NextFunction'」；vitest 1.6 类型定义与 express 4 类型定义存在兼容性差异 | 用 `ReturnType<typeof vi.fn>` 做类型断言：`(next as ReturnType<typeof vi.fn>).mock.calls[0][0]`；或断言为 vitest `Mock` 类型：`import type { Mock } from 'vitest'; (next as Mock).mock.calls[0][0]`；详见 [w-model-dev-demo/tests/unit/auth-middleware.test.ts](../../w-model-dev-demo/tests/unit/auth-middleware.test.ts) |

### 适用范围与扩展规则

- 本节仅记录**真实调测中发现并修正过**的代码层教训，每条须可指向具体的缺陷与修正证据（demo 内的代码 / 报告链接）。
- 新增教训时，同步在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 「过程中发现的缺陷与修正」表登记对应缺陷行，保证双向可追溯。
- 教训不命中阶段回退；若 Agent 在阶段 6 集成测试中再次触发已记录教训，应在《测试报告》「备注」节标注「重蹈 L#」并提示用户复核阶段 5 编码规范。
- L1 来自 2026-07-20 首轮调测；L2/L3/L4 来自 2026-07-21 从零重建第二轮回归测试发现。

## 失败模式清单（F1~F10）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills` 元技能的 Failure Modes。
> SSoT [§4A.2](../../docs/skill-design-document_SSoT.md) 为权威定义，本节为可执行细则。
>
> **与 12 条流程反模式（#1~#12）的关系**：反模式是「流程破坏」，命中即触发阶段回退（由门禁脚本或 CHECKPOINT 强制）；失败模式是「行为退化」，命中不触发回退但降低产物质量。二者互补：反模式关注「是否走完流程」，失败模式关注「流程中行为是否健康」。
>
> **与 4 条实现层经验教训（L1~L4）的关系**：L1~L4 是代码层教训（特定技术栈的具体坑），F1~F10 是行为层模式（跨技术栈的通用陷阱）。
>
> **登记规则**：Agent 重复命中同一失败模式 ≥2 次时，应在本节「实现层经验教训」登记为新 L# 教训（即 F# 退化如果具体化为代码层坑，升级为 L#），并在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 同步登记对应缺陷行。

### F1~F10 失败模式表

| # | 失败模式 | 检测信号（Agent 自查） | 与反模式 / 操作行为的关系 | 处理流程 |
|---|---|---|---|---|
| F1 | 静默假设未检查就推进 | 阶段产物中存在「未询问用户就采用的假设」（如默认技术栈、默认数据模型、默认错误码）；ingestion 场景：A-chunk 静默跳过疑似跨块关系而不在 `crossChunkHints` 登记 | 与 #9（谎报状态）互补：#9 是结果撒谎，F1 是过程撒谎；对应 §4A.1 行为 1「Surface Assumptions」 | ① 立即暂停推进；② 在产物「假设声明」节显式列出已采用的假设；③ 向用户确认假设是否成立；④ 假设被否决则回退到产物起点修正 |
| F2 | 困惑时不暂停、硬猜推进 | Agent 内部对话出现「这里不太确定，但应该是 X 吧」类语句；RTM 字段值与上游不一致但未提出 | 与 #8（越过 CHECKPOINT）互补：#8 是显式节点越过，F2 是隐式困惑越过；对应 §4A.1 行为 2「Manage Confusion Actively」 | ① STOP 当前任务；② 命名具体困惑（「RTM 的 REQ-001 与设计文档 SD-3.2 字段名不一致」）；③ 向用户提出具体澄清问题；④ 等待解决后再继续 |
| F3 | 注意到不一致但不指出 | Agent 跨文档扫描时发现术语 / 接口 / 字段冲突但未在产物「备注」节登记 | 与 #4（评审未通过悄悄小修）互补：#4 是评审后，F3 是评审中；对应 §4A.1 行为 3「Push Back When Warranted」 | ① 在当前产物「备注」节登记不一致点（位置 + 描述 + 影响）；② 在阶段门评审的 `reworkHints` 中以「[FYI] 跨文档不一致：xxx」前缀呈现；③ 由用户决定是否本阶段修复或下阶段修复 |
| F4 | 非显然决策不呈现 tradeoff | 设计文档 / 评审报告中只有结论无替代方案对比（如「采用 JWT」但无「vs Session vs OAuth」对比） | — | ① 在决策点补 tradeoff 表（选项 / 优势 / 劣势 / 选择理由）；② tradeoff 写入设计文档「技术选型」节或评审报告 `summary` 字段 |
| F5 | 对明显有问题的方案 sycophantic「当然可以」 | 用户提出违反硬约束的请求（如「跳过 CHECKPOINT」「估算覆盖率放行」），Agent 直接同意 | 对应 §4A.1 行为 3「Push Back When Warranted」 | ① 指出与哪条硬约束冲突（约束编号 + 原文）；② 量化代价（「跳过 CHECKPOINT 会导致用户失去决策权，后续阶段全部失真」）；③ 提出替代方案（「我可以加速但不跳过：把 CHECKPOINT 与下一阶段初始化合并展示」）；④ 接受用户在完整信息下的覆盖决策，但在产物「备注」节登记冲突 |
| F6 | 过度复杂化代码与 API | 代码中出现「资深工程师会问『为何不直接……』」的抽象；1000 行能 100 行完成；为单次使用建抽象层 | 对应 §4A.1 行为 4「Enforce Simplicity」 | ① 编码前自问「能否更少行？抽象是否物有所值？」；② 命中后在代码评审 `reworkHints` 中以「[Required] 过度复杂化：建议简化为 xxx」前缀呈现；③ 回到编码返工 |
| F7 | 修改任务外的代码或注释 | `git diff` 显示改动触及了规格外的文件（如修 bug 时顺手「清理」无关代码） | 对应 §4A.1 行为 5「Maintain Scope Discipline」 | ① 立即回滚任务外改动；② 如改动确有价值，单独创建任务处理；③ 在产物「备注」节登记「已识别但未处理的改进点：xxx」 |
| F8 | 删除未完全理解的代码 | Agent 删除了「看似无用」的代码 / 注释 / 配置但无法解释其存在原因 | 对应 §4A.1 行为 5「Maintain Scope Discipline」；与 Chesterton's Fence 原则冲突 | ① 立即恢复删除；② 通过 git blame / 提交历史 / 上下文调查代码存在原因；③ 如确认无用，在产物「备注」节登记「拟删除 + 调查证据」；④ 由用户决定是否删除 |
| F9 | 因「显而易见」而无规格就编码 | 阶段 5 编码开始但阶段 4 详细设计文档对该功能无对应条目；或测试设计前置约束被绕过 | 与 W 模型核心约束「测试设计前置」冲突 | ① 回到阶段 4 补详细设计 + 单元测试设计；② 不得以「这功能太简单不需要设计」为由跳过；③ 在阶段门评审中如发现此模式，`passed=false` |
| F10 | 因「看起来对」跳过验证 | 阶段产物已产出但未执行测试运行器 / 门禁脚本；或仅凭 LLM 文本说「通过」就推进；ingestion 场景：仅凭 A-cross/A-evolve 的 LLM 输出说「图谱已收敛」就推进，未跑 `check-requirement-graph.ts`（与 #12 互补） | 与 #3（估算质量门）/ #6（估算 RTM 覆盖率）互补；对应 §4A.1 行为 6「Verify, Don't Assume」 | ① 立即执行对应验证（单元测试 / `check-verifier-output.ts` / `check-artifact-gate.ts` / `check-requirement-graph.ts`（阶段 1-4 图谱门禁））；② 验证证据（退出码 + 输出摘要）写入产物「验证证据」节；③ 无证据不得推进 |

### 失败模式与反模式的对照

| 维度 | 反模式 #1~#12 | 失败模式 F1~F10 |
|---|---|---|
| 性质 | 流程破坏 | 行为退化 |
| 命中后果 | 立即回退到对应阶段起点 | 不回退，但降低产物质量 |
| 强制方式 | 门禁脚本退出码 / 🔴 CHECKPOINT | Agent 自检 / LLM-as-a-Verifier 在评审中标注 |
| 登记位置 | 《测试报告》「备注」节 + `reworkHints` | 阶段产物「备注」节 + `reworkHints`（前缀 `[FYI]` 或对应 Severity） |
| 升级规则 | 命中即升级，无升级概念 | 重复命中同一 F# ≥2 次 → 升级为新 L# 教训（如 F1 多次命中且具体化为某技术栈坑 → L5） |
| 与操作行为关系 | 部分反模式对应操作行为违反（如 #8 ↔ 行为 2） | 大部分失败模式直接对应操作行为违反（F1↔行为1 / F2↔行为2 / F5↔行为3 / F6↔行为4 / F7/F8↔行为5 / F10↔行为6） |

### 失败模式的标注约定

在阶段产物的「备注」节或评审报告的 `reworkHints` 中标注失败模式：

```
[F1] 阶段 1 需求规格 — 静默假设：默认采用 JWT 而非 Session，未询问用户
[F3] 阶段 2 系统设计 — 跨文档不一致：REQ-001 字段名 userId 与 SD-3.2 字段名 uid 冲突，未在产物登记
[F6] 阶段 5 编码 — 过度复杂化：src/utils/auth-helper.ts 为单次使用建了 3 层抽象
```

LLM-as-a-Verifier 在评审中识别到失败模式时，应在 `reworkHints` 中以 `[F#]` 前缀呈现，并在 `summary` 字段统计命中数（如「命中 2 条失败模式：F1 / F6」）。

### 与 addyosmani/agent-skills 的差异

| 维度 | addyosmani 原版 | W 模型适配版 |
|---|---|---|
| 失败模式触发后果 | 由 Agent 自检，无强制机制 | 命中不回退但须登记；重复 ≥2 次升级为 L# 教训 |
| 与反模式关系 | 失败模式与反模式未明确区分 | 明确二分：反模式 = 流程破坏（回退），失败模式 = 行为退化（登记） |
| 标注位置 | Agent 内部对话 | 阶段产物「备注」节 + 评审报告 `reworkHints`（`[F#]` 前缀） |
| 升级路径 | 无 | F# 重复命中 → L# 教训 → SSoT §10B.4 缺陷表（双向追溯） |
| 与操作行为对应 | 失败模式与 Core Operating Behaviors 一一对应 | 直接吸收对应关系，且与 W 模型 7 条硬约束互补 |
