# 历史段落归档（Legacy Sections）

> 自各活体文档移出（41.7.0 全仓去历史化）：以下段落为变更过程 / 历史对照 / 迁移指令等
> 历史信息，原文保留归档于此。对应版本条目见 CHANGELOG 体系。



---

## 一、anti-patterns.md「实现层经验教训」节（原 L773-793）

## 实现层经验教训（来自端到端调测）

> 以下不属于 W 模型**流程**反模式（命中不会触发阶段回退），而是 W 模型端到端调测中沉淀的**代码层**经验教训。
> Agent 在阶段 5（编码）与阶段 6（集成测试）应主动规避，避免重蹈覆辙。
> 来源：博客系统后端端到端调测（两轮：2026-07-20 首轮 + 2026-07-21 从零重建第二轮）。
> **归档说明（2026-07-27 第 17 轮 P6）**：原 `w-model-dev-demo/` 目录已删除，归档摘要位于 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](../../docs/changes/archive/2026-07-26-round15-end-to-end-test/)。下文「详见」链接为**历史记录**（源码已不在仓库），仅作教训检索参考；最终调测数字见归档 [`README.md`](../../docs/changes/archive/2026-07-26-round15-end-to-end-test/README.md)。

| # | 教训 | 触发场景 | 危害 | 规避做法 |
|---|---|---|---|---|
| L1 | Express 4 路由直接使用 `async (req, res, next) => {...}` 而不包装 | 阶段 5 编码：在 Express 4 路由中抛出 `AppError` 子类（如 `ForbiddenError` / `NotFoundError`） | rejected promise 不被错误中间件捕获，表现为 Unhandled Rejection，错误响应体不符合 `{error: string}` 契约，首轮集成测试集体失败 | 引入 `asyncHandler` 包装器包裹全部路由：`(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`；详见历史 `w-model-dev-demo/src/utils/async-handler.ts` 与 `integration-test-report.md` §5（已归档） |
| L2 | 模块加载阶段读取环境变量并直接 `throw`（如 `process.env.JWT_SECRET ?? (() => { throw ... })()`） | 阶段 5 编码：在 `src/utils/env.ts` 等模块顶层用 IIFE 抛错保护必填环境变量 | 测试套件在 `collect` 阶段即崩溃（模块 import 失败），连锁导致所有间接依赖该模块的测试文件 0 用例；vitest 报 `0 test` 而非 `fail`，掩盖真实失败数 | ① 模块加载阶段只读不抛，运行时（如服务启动）再校验必填；② 测试脚本统一注入环境变量（如 `cross-env JWT_SECRET=test-secret`）；详见历史 `w-model-dev-demo/src/utils/env.ts` 与 `w-model-dev-demo/package.json`（已归档） |
| L3 | service 类导出方式反复：内部 `class Foo` + `export const foo = new Foo()` 实例，丢失类型导出 | 阶段 5 编码：将原 `export class ArticleService` 改为内部 `class ArticleService` + `export const articleService`，但其他模块仍 `import type { ArticleService }` | `tsc --strict` 报 TS2724「no exported member named 'ArticleService'」，违反 NFR-003「tsc 0 错误」；回归测试发现后必须回退导出 | 类型与实例可同时导出：`export class ArticleService {}` + `export const articleService = new ArticleService()`；改导出方式前先 `grep -rE "import type \{ .*ArticleService"` 全仓库扫描消费者；详见历史 `w-model-dev-demo/src/services/article-service.ts`（已归档） |
| L4 | vitest mock 与 express 中间件类型不兼容：`vi.fn() as unknown as NextFunction` 后访问 `next.mock.calls` | 阶段 5 编码：测试中 `const next = vi.fn() as unknown as NextFunction`，断言 `next.mock.calls[0][0]` | `tsc --strict` 报 TS2339「Property 'mock' does not exist on type 'NextFunction'」；vitest 1.6 类型定义与 express 4 类型定义存在兼容性差异 | 用 `ReturnType<typeof vi.fn>` 做类型断言：`(next as ReturnType<typeof vi.fn>).mock.calls[0][0]`；或断言为 vitest `Mock` 类型：`import type { Mock } from 'vitest'; (next as Mock).mock.calls[0][0]`；详见历史 `w-model-dev-demo/tests/unit/auth-middleware.test.ts`（已归档） |

### 适用范围与扩展规则

- 本节仅记录**真实调测中发现并修正过**的代码层教训，每条须可指向具体的缺陷与修正证据（demo 内的代码 / 报告链接）。
- 新增教训时，同步在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 「过程中发现的缺陷与修正」表登记对应缺陷行，保证双向可追溯。
- 教训不命中阶段回退；若 Agent 在阶段 6 集成测试中再次触发已记录教训，应在《测试报告》「备注」节标注「重蹈 L#」并提示用户复核阶段 5 编码规范。
- L1 来自 2026-07-20 首轮调测；L2/L3/L4 来自 2026-07-21 从零重建第二轮回归测试发现。



---

## 二、hard-constraints.md「编号迁移表（第 44 轮，21 条 → 14 条）」（原 L87-104）

## 编号迁移表（第 44 轮，21 条 → 14 条）

| 旧编号 | 新编号 | 合并说明 |
|---|---|---|
| #1-#8 | #1-#8 | 原样保留 |
| #9 TLA+ 行为门禁 | #13 | 与 #14 BDD 合并 + 成熟度分级 |
| #10 门禁退出码不可伪 | #9 | 重排 |
| #11 系统层级树 | #10 | 与 #15 REQ 层级合并 |
| #12 闭环机制强制校验 | #11 | 与 #17 R3 合并 |
| #13 返工必经根因定位 | #12 | 重排 |
| #14 BDD 行为门禁 | #13 | 与 #9 TLA+ 合并 + 成熟度分级 |
| #15 REQ 层级强制标注 | #10 | 并入系统层级树 |
| #16 豁免审批强制四阶段 | #2 | 并入阶段门放行 |
| #17 R3 预防性审查强制 | #11 | 并入闭环机制 |
| #18 RTM 实体每阶段回填 | #3 | 并入 RTM 为事实源 |
| #19 角色分派完整性 | #8 | 并入编排者最小化 |
| #20 codegraph 修改前查询 | #14 | 与 #21 回归测试合并 |
| #21 回归测试强制钩子 | #14 | 与 #20 codegraph 合并 |


---

## 三、SSoT §14 技能演化机制（已移除，原文）

## 14. 技能演化机制（已移除）

> 架构重构后，技能自演化（Rollout / Reflect / Edit / Skill Lift 评估 / 训练日志 / 双时间尺度 / 可训练状态边界 / 验证门等）已**整章移除**。
> 历史版本曾由内置 `SkillOptimizer`（`src/evolution/skill-optimizer.ts`）+ `MetaSkillConfig`（`src/core/meta-skill-config.ts`）+ `w-model-dev/META-SKILL.md` 实现，
> 这些文件均已删除。技能演化现由外部工具完成：
> - [SkillOpt](https://github.com/microsoft/SkillOpt)（微软）：Rollout → Reflect → Edit → Gate → Commit 训练循环
> - [darwin-skill](https://github.com/alchaincyf/darwin-skill)：基于进化算法的技能搜索与筛选
>
> 外部演化工具可消费本技能产出的 `VerifierOutput` JSON（见 §7.6）作为训练信号。
> 与外部工具的协作方式见 §12.4，参考文献见 §16.3。



---

## 四、SSoT §15 技能评估标准（已移除，原文）

## 15. 技能评估标准（已移除）

> 架构重构后，技能本身的评估（ACES Skill Lift / SkillsBench 三条件对照 / SkillLearnBench 三级评估 / 留出任务集 / 确定性 verifier 优先等）已**整章移除**。
> 历史版本曾由内置 `SkillLiftEvaluator`（`src/eval/skill-lift.ts`）实现，该文件已删除。
> 技能评估现由外部工具完成（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)），
> 相关学术基准（ACES / SkillsBench / SkillLearnBench）的引用见 §16.3。
>
> 本技能只保留**工件质量门**（§10.5）作为技能内部的产物质量保障。



---

## 五、verifier-spec.md 历史迁移指令与决策回溯（原 L93 / L137）

> 迁移策略：第八轮及更早的 demo / fixture 中含 `targetKind="testcase"` 的 VerifierOutput 须在第 9 轮 Part C 修正为 `targetKind="test"`（详见 CHANGELOG 第 9 轮条目）。

> 与原计划的差异：第 9 轮设计曾提议按 8 阶段细分（如 phase 1 用 `requirement-completeness` / `stakeholder-coverage` 等），但实际实施时为避免破坏既有 VerifierOutput 历史数据与 §7 子标准定义，保留原 4 targetKind × 5 项标准的颗粒度。8 阶段对照通过 `targetKind` 推断阶段实现（phase 2/3/4 共用 `design`，phase 6/7/8 共用 `test`）。


---

## 六、SSoT §1.4 架构重构说明（原文）

> **架构重构说明（重要）**：本技能已完成架构纯化——**单纯的编排 + 校验脚本技能**，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> 据此，本文档已移除技能演化机制与轨迹分析相关章节（原第 14 章「技能演化机制」、原第 15 章「技能评估标准」、原 §7.7 / §7.8 数据模型、原 §12.4「第四阶段（自演化版）」等），并移除全部 `src/` 编程式引擎（`/wm` 命令、状态持久化、RTM 维护改由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行）。
> LLM-as-a-Verifier 评审由外部 Agent 按提示词执行（规范见 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md)）；
> 技能自演化由外部工具完成（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）。
