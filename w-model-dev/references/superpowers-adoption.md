# superpowers 方法论采用指南（Superpowers Adoption Guide）

> 上游版本锚：[obra/superpowers](https://github.com/obra/superpowers) **v6.3.0**（commit `b36e082`），MIT License，Copyright (c) 2025 Jesse Vincent——本文件改编自其 `README.md` 与 `skills/*/SKILL.md`，按 MIT 条款保留版权声明。
>
> **本仓适配**：中文裁剪 + W-Model 角色映射（只 vendor 方法论文本）。本机 `~/.agents/skills/` 安装的中文 fork（superpowers-zh）**仅作参考、不作版本契约**；版本锚定与中文表述均由本仓自行维护。
>
> **架构原则**：本文件不调用 LLM、不引入上游运行时依赖、不要求宿主安装 superpowers；技能包保持自包含，宿主已装 superpowers 时仅为加速项（见 §4）。替代 openspec（opsx）后的制品与门禁契约见 §5。

## 目录

- 定位与版本锚
- 编码链七技能要点
- W-Model 角色映射
- 宿主安装为可选加速（三层检测）
- 与 opsx 的替代关系与迁移边界

## 1. 定位与版本锚

superpowers 是「完整的软件开发方法论」：14 个可组合技能 + 会话启动钩子，跨 14+ 宿主分发（Claude Code / Codex / Cursor / Gemini CLI / Devin / OpenCode / Kimi / Hermes 等）。其形态是**纯 Markdown 技能 + 提示词模板 + 少量 bash 脚本——没有制品格式，也没有退出码门禁**。

因此本仓的采用方式固定为两条：

1. **方法论层**：vendor 其编码链纪律（本文件），由 O/A/S/V/G/R 角色按 §3 映射执行；
2. **制品层**：用 W-Model 自有「编码计划制品契约」承接门禁锚点（§5）——机器可查的部分必须落在本仓脚本，不能依赖上游文本。

## 2. 编码链七技能要点

按上游 README 的 Basic Workflow 顺序，逐技能记「触发时机 / 核心纪律 / 与 W-Model 阶段的对应」。

**1. brainstorming**（Socratic 设计精炼）

- 触发：任何创造性工作（新功能、新组件、行为变更）之前，动代码之前。
- 核心纪律：先分类三路径——spike（可行性探针，产物是答案不是代码）/ bounded（仓内既有流程的小改动，聊天里给短设计）/ architectural（新项目、新子系统、接口重构，走全流程）；**HARD-GATE**：任何路径都必须先把意图讲清楚并获人类批准才可实施，「太简单不需要批准」是明列反模式；architectural 产物落 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，写完自审（占位符 / 内部矛盾 / 范围 / 歧义）并交用户评审，终点只能是 writing-plans。
- 对应 W-Model：阶段 1 需求分析与锐利化 + 🔴 CHECKPOINT 的用户批准语义（O 复述、用户确认后才推进）。

**2. using-git-worktrees**（隔离工作区）

- 触发：设计批准后、执行实现计划前。
- 核心纪律：Step 0 先检测是否已在隔离工作区（`GIT_DIR` vs `GIT_COMMON`，另用 `git rev-parse --show-superproject-working-tree` 排除子模块）；**先原生 worktree 工具再回退 `git worktree add`**（绕过原生工具会造出宿主不可见的幽灵状态）；建前须获用户同意；目录优先级 = 显式声明 > 既有 `.worktrees/`（优先）或 `worktrees/` > 默认 `.worktrees/`，且**必须先 `git check-ignore` 确认已忽略**（否则整个工作区会被提交进仓库）；建好跑一次基线测试，脏基线不得开工。
- 对应 W-Model：阶段 5 开工前的隔离与基线纪律（工作区形态选择，不替代任何门禁）。

**3. writing-plans**（任务级实现计划）

- 触发：规格/需求已批准、动代码之前。
- 核心纪律：计划写给「零项目上下文、测试习惯可疑的工程师」——逐任务精确文件路径（创建/修改/测试）、完整代码、运行命令与期望结果、commit 行；步骤切到 2-5 分钟粒度（写失败测试 → 看它失败 → 最小实现 → 看它通过 → 提交）；计划头必含 Goal / Architecture / Tech Stack / Spec / Global Constraints（约束逐字抄自规格）；**禁占位符**（TBD、"加适当的错误处理"、"同 Task N"）；写完自审三项：规格覆盖、占位符扫描、类型/签名一致。计划存 `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`。
- 对应 W-Model：S-plan 产出 `docs/plans/<changeId>.plan.md`（§5 的制品契约）。

**4. subagent-driven-development（SDD）/ executing-plans**（计划执行）

- 触发：有实现计划且任务基本独立、在同一会话内执行。
- 核心纪律（SDD）：**每任务派新实施子代理**（绝不继承会话历史，只给本任务 brief + 接口 + 全局约束）；实施者回报只在 DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED 四态；每任务后派任务评审，**规格符合与代码质量两个结论缺一不可**，实施者自评不能替代；发现即进修复循环，**上限 5 轮**（1-3 轮续原实施者，4-5 轮换更强模型的新实施者），到顶仍不收敛则由控制者逐条裁定并记账；全部任务后**一次整支评审**；进度写 `.superpowers/sdd/<plan>/progress.md` 账本（抗上下文压缩，`Task N: complete (...)` 行是恢复地图），分派前先落 `task-N-brief.md`、评审前先落 review-package diff；执行中「裁定而非停摆」（不可逆操作、安全敏感动作、工作区外副作用、计划整体不可用四类才停）；控制器不亲自修代码。
- executing-plans 是备选形态：无子代理或需人工检查点时，加载计划 → 批判性评审（有疑虑先问）→ 逐任务按步执行 → 阻塞立刻停并问 → 收口转 finishing-a-development-branch。
- 对应 W-Model：S-coding 执行 + V 任务评审 + 修复循环（与 [subagent-delegation.md](subagent-delegation.md) 的分派/评审/账本纪律同构）。

**5. test-driven-development**（先红后绿）

- 触发：实现任何功能或缺陷修复之前。
- 核心纪律：铁律「**没有失败的测试，不写生产代码**」；先写码再写测试 = 删除重来（不留作参考、不"边写测试边适配"）；RED（一个行为、清晰命名、真实代码）→ **必须亲眼看它失败**且失败原因正确 → GREEN（最小实现，不加测试外的功能）→ **亲眼看它通过**且其他测试不坏 → REFACTOR（仅保持绿的前提下清重命名抽）；测试难看 = 设计问题。
- 对应 W-Model：阶段 5 编码纪律；与 RTM 四级测试衔接——测试结果必须来自真实运行器回填（约束「真实测试结果回填」）。

**6. requesting-code-review**（独立评审）

- 触发：SDD 每任务后、主要功能完成后、合并前（强制）；也可用于卡住时、重构前、复杂缺陷修复后。
- 核心纪律：派**独立评审子代理**，只给精确构造的上下文——`{DESCRIPTION}` / `{PLAN_OR_REQUIREMENTS}` / `{BASE_SHA}` / `{HEAD_SHA}` 四个占位符，**绝不给会话历史**（评审对象是工作产物，不是思路过程）；按严重度处置：Critical 立即修、Important 修完再走、Minor 记录待办；评审有误须带技术理由反驳，不因"简单"跳过评审。
- 对应 W-Model：V 评审（Persona 化），评审模板与 [verifier-spec.md](verifier-spec.md) §6 Schema 对接；配套 receiving-code-review（收到评审反馈后先技术核验再实施，不敷衍附和不盲目执行）。

**7. finishing-a-development-branch**（分支收口）

- 触发：实现完成、全部测试通过，需要决定如何集成。
- 核心纪律：Step 1 **先跑全量测试**（失败即停——"本会话早先绿过"不算）；Step 2 探测环境（普通仓 / 命名分支工作区 / detached HEAD）决定菜单与清理方式；Step 3 确认 base 分支（不确定就问）；Step 4 呈三条处置（本地合并 / 推远端开 PR / 保留分支），**discard 只在人类明确要求并键入确认词后执行**；Step 5 合并后**在合并结果上复跑测试**再清理；Step 6 只清理 `.worktrees/`、`worktrees/` 下的自建工作区，移除被拒（`contains modified or untracked files`）时绝不擅自 `--force`，先摊开未提交文件让人类选。
- 对应 W-Model：阶段 8 收口与分支处置（对接 check-archive-integrity 的归档清单校验）。

**辅助技能（非编码链主线，按需接驳）**

- **systematic-debugging**：铁律「**未完成根因调查，不得提出修复**」；四阶段 = 根因调查（读全错误、稳定复现、查最近变更、多组件系统在组件边界插桩取证、沿调用栈回溯到坏值源头）→ 模式分析（找可用样例、逐行读完参考实现、列出全部差异、弄清依赖假设）→ 假设与验证（单一假设、最小改动单变量验证，不叠加修复）→ 实施（先写失败用例、单次修复根因、验证通过；同一问题修 3 次未果即停，转为质疑架构）。
- **verification-before-completion**：铁律「**没有新鲜的验证证据，不得声称完成**」；声称前必过闸门函数 = 确定验证命令 → 完整跑一遍 → 读输出与退出码 → 对照结论 → 才作断言；"应该通过""我很有把握""上次跑过"一律不接受，子代理自报成功也必须独立复核。
- 两者对应 W-Model 的 **R 根因定位 / 修复后复验**：与 [root-cause-locator.md](root-cause-locator.md) 互补，是反模式 #18（跳过 R 直接返工）/#19（R 报告未经 V+G）背后的通行纪律。
- **dispatching-parallel-agents**：可独立并行任务的分派参考；在 W-Model 内受编排者最小化约束（O 只分派不实施，见 [hard-constraints.md](hard-constraints.md)）。

## 3. W-Model 角色映射

设计依据见 SSoT 与 `docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md` §3。逐行落地：

| superpowers 技能                                      | W-Model 对应                                            | 落地要点                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| brainstorming                                         | 阶段 1 A-cross / 需求锐利化                             | 已共生：`docs/superpowers/specs/` 即其产物位；批准语义由 🔴 CHECKPOINT 承接                   |
| writing-plans                                         | **S-plan**（新，替代 S-explore / S-propose 的规划半边） | 产 `docs/plans/<changeId>.plan.md`：逐任务文件路径 + 完整代码 + 验证命令 + commit 信息        |
| subagent-driven-development                           | **S-coding 执行 + V 任务评审 + 修复循环**               | 与 subagent-delegation.md 的分派/评审/账本纪律同构（每任务新子代理 + 双结论评审 + ≤5 轮修复） |
| executing-plans                                       | S-coding 的并行会话变体                                 | 备选执行形态：分批执行 + 人工检查点                                                           |
| test-driven-development                               | 阶段 5 编码纪律（先红后绿）                             | 与 RTM 四级测试衔接（真实运行器回填）                                                         |
| requesting-code-review                                | V 评审（Persona 化）                                    | 评审模板与 verifier-spec.md §6 Schema 对接                                                    |
| finishing-a-development-branch                        | 阶段 8 收口 / 分支处置                                  | 对接 check-archive-integrity                                                                  |
| systematic-debugging / verification-before-completion | R 根因定位 / 修复后复验                                 | 与 root-cause-locator.md 互补（反模式 #18/#19 的纪律来源）                                    |

## 4. 宿主安装为可选加速（三层检测）

`ensure-codegraph.ts`（阶段 5-8 初始化与复检）与 `doctor.ts` 共用 `lib/superpowers-detect.ts` 的同一判据，三层**只检测、不安装、不创建**：

| 层                      | 判据                                                            | 含义                                           |
| ----------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| L1 宿主技能目录         | `~/.agents/skills` 与 `~/.claude/skills` 并集含 ≥3 个关键技能子目录（子目录内含 `SKILL.md` 即计） | 宿主已装 superpowers，可自动触发，属加速项     |
| L2 技能包 vendored 副本 | `<skillRoot>/references/superpowers-adoption.md`（本文件）      | 方法论要点随包交付，自包含                     |
| L3 项目目录             | `<projectRoot>/docs/superpowers/`                               | 规格 / 计划 / 交接产物的项目侧默认位置         |

L1 的关键技能集（源码常量 `SUPERPOWERS_KEY_SKILLS`，最低 3 个）：brainstorming / writing-plans / subagent-driven-development / executing-plans / test-driven-development。

**缺 L1 / L3 的含义与处置**：ensure-codegraph 将其列为 `checkpoint` 项、退出码 **1**——阶段 5-8 放行前以 🔴 CHECKPOINT 交用户裁定（补齐后再进，或显式豁免）；同一事实在 doctor 中是 **warn 级提示**（doctor 退出码 0，允许 warn）。**严重度不对称是刻意的**：ensure 是阶段门的初始化闸口（缺则阻断等裁定），doctor 是环境自检（可选加速项缺失不应阻断仓库验证）。补齐路径都由用户手动完成——宿主技能按宿主技能安装流程装（本包不分发也不自动安装 superpowers），`docs/superpowers/` 由项目侧创建。

宿主已装 superpowers 时，其技能、钩子与模板可作为执行加速；**但 W-Model 不依赖它**：方法论要点已 vendor 于本文件，缺宿主安装时按本文件与 [phase-5-coding.md](phase-5-coding.md)、[phase-8-acceptance-test.md](phase-8-acceptance-test.md) 执行即可。

## 5. 与 opsx 的替代关系与迁移边界

阶段 5-8 的规格级规划由 openspec（opsx）三段式改为 **superpowers 编码链 + W-Model 编码计划制品契约**：

| 制品         | 位置                                                                            | 门禁可查形态                                                       |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 编码计划     | `docs/plans/<changeId>.plan.md`                                                 | 逐任务：目标 / 文件 / 步骤 / **验证命令** / commit 信息；与 RTM 行关联 |
| 执行账本     | `.superpowers/sdd/<plan>/progress.md`                                           | `Task N: complete (commits a..b, review clean)` 覆盖 plan 全部任务 |
| 任务评审证据 | `.superpowers/sdd/<plan>/{task-N-brief,task-N-report}.md` + review-package diff | brief / report / review 三件套存在且非空                           |
| 归档         | `docs/changes/archive/<日期>-<changeId>/`                                       | 复用既有受控归档位，**归档时把账本 + 三件套复制进归档快照**（不新造第二个归档位） |

门禁与词表：

- `check-coding-plan.ts`：plan 结构 + 账本覆盖 + 三件套存在性 + R3×9 / V×3 齐全性；阶段 5-8 由 check-artifact-gate 以 `--scope` 聚合。
- 归档快照校验并入 check-archive-integrity（原 check-openspec-archive 已退役，不新增第二归档门）。
- run-log：`opsx_explore / opsx_propose / opsx_apply / opsx_archive` 转为 **LEGACY**（历史记录仍可解析，不再由新流程产生）；新动作 `plan_propose / plan_task / plan_review` 与 S-plan / S-coding / V 任务评审配对。
- 归档快照而非改 gitignore：`.superpowers/sdd/` 仍是 gitignored 瞬态工作区，账本与三件套通过归档复制变成可查证据，避免把瞬态工作区变成被跟踪面。

**迁移边界**：`--scope` / change-scope 契约绑定 git 区间，与 opsx 无关，替换不触及；新链路（`check-coding-plan.ts` + check-archive-integrity 的 `codingPlanSnapshot`）不再读取 `openspec/changes/<changeId>/` 目录——该目录的**现存活体引用**（`check-opsx-artifacts.ts` 本体、`self-test.ts` 用例、vitest SUBPROCESS 登记、AGENTS / README 的对外声明等）随批次 5（任务 10）的 openspec 残留清理一并退役，在那之前它们仍会按旧目录约定执行；superpowers 本身无制品格式，因此「机器可查」的部分一律由上述 W-Model 脚本承担，不把门禁建立在上游文本或宿主安装状态之上。
