# 用 obra/superpowers 替换 OpenSpec（opsx）作为编码阶段依赖 —— 分析与替换设计 v1.0

> 状态：**待批准**（分析依据已核实到代码/仓库级；批准后按 §6 迁移计划分批实施）
> 分析基线：本仓 `fix/gate-contract-rework-chain` @ `4dc4d66f`；superpowers 上游 `obra/superpowers` v6.3.0（已 clone 至 `D:\w_skill_opt\superpowers`，commit `b36e082`，MIT License）。

## §0 结论先行（TL;DR）

**支持你的判断，但「替换」的正确形态不是删门禁，而是「方法论层换 superpowers，制品层换 W-Model 自有编码计划契约」。**

三条关键证据：

1. **opsx 在本仓的实际交付物非常薄**。全部门禁脚本**从不调用 openspec CLI**——`ensure-codegraph-opsx.ts` 是唯一触点（L1 `openspec --version` 检测 + `openspec init` 初始化）；两道制品门（`check-opsx-artifacts.ts` / `check-openspec-archive.ts`）校验的只是 `openspec/changes/<changeId>/` 这个**目录约定**。2026-09-20 真实 8 阶段调测中 openspec CLI 不可用（D-9），阶段 5-8 照样全绿——因为 S 子代理手写目录就能满足门禁。调测发现的 D-7（归档/未归档两门互斥）本身就是这套仪式的成本。
2. **superpowers 方法论已被证明能驱动本仓的编码阶段**。本会话正在执行的「门禁-返工链契约修复」就是用 superpowers 的 SDD（subagent-driven-development）+ writing-plans + review-package 流程跑的（本仓 `docs/superpowers/{specs,plans,handoffs}/` 目录即其产物约定）；其技能链与 W-Model 的 O/A/S/V/G/R 角色模型几乎一一对应（§3 映射表）。
3. **但 superpowers 不产出任何机器可查的制品**（纯 Markdown 技能 + 提示词模板 + bash 脚本，无退出码契约）。W-Model 的核心价值主张是「LLM-as-a-Verifier + 确定性工件质量门」，因此直接删掉 opsx 制品位会让阶段 5-8 失去门禁锚点。正确做法：用 W-Model 自有的「编码计划制品契约」（writing-plans 产物 + SDD 账本 + 逐任务评审包）承接原 opsx 制品位，门禁改写而非删除。

## §1 现状盘点：opsx 的真实依赖面（全部核实过）

| 层 | 触点 | 说明 |
|---|---|---|
| 制品位 | `openspec/changes/<changeId>/{proposal,design,tasks,tickets}.md + specs/`；归档 `archive/<日期>-<changeId>/` | 由 S-propose 手工产出；下游**无任何消费者**（除门禁本身） |
| 门禁 | `check-opsx-artifacts.ts`（制品 + R3×9 + V×3 齐全性）、`check-openspec-archive.ts`（归档完整性）、`check-artifact-gate.ts` 阶段 5-8 聚合（`--scope`）、`check-codegraph-queries.ts`（`--scope` 绑定） | 只读目录结构；不调 openspec CLI |
| 检测/安装 | `ensure-codegraph-opsx.ts`：L1 `openspec --version`（缺则 `npm i @fission-ai/openspec@latest`）、L2 MCP、L3 `openspec init` | 唯一真正依赖 CLI 的位置 |
| run-log 词表 | `opsx_explore / opsx_propose / opsx_apply / opsx_archive` 四动作 + `ensure_deps` | run-log schema 枚举（共 27 值中的 5 个） |
| scope 契约 | `lib/change-scope.ts` + `--scope=<file>` / `--change/--base/--head` | **与 opsx 无关**（绑定 git 区间），替换不受影响 |
| 文档面 | `references/phase-5-coding.md`（「OpenSpec opsx 三段式 S 分派」节）、phase-6/7/8、`conventions.md`、`command-reference.md`、`data-models.md`、`subagent-delegation.md`、`hard-constraints.md`（反模式 #39/#40）、`verifier-spec.md`、SSoT、AGENTS.md、README | 量大但均为文本 |
| 样本 | `samples/opsx-artifacts/`（valid/bad/multi 簇）、`samples/openspec-archive/` + `samples/README.md` 矩阵 + `NEGATIVE-COVERAGE.md` 登记 | 迁移时须保覆盖矩阵闭合 |
| 实证 | D-7（两门互斥，本轮已修但属给仪式打补丁）、D-9（CLI 不可用仍全绿）、38 次拦截中「change-scope schema 不合规 / opsx 目录命名缺 phaseN- 前缀 / 归档时序互斥」3 类均为 opsx 仪式成本 | 见 `docs/debug/2026-09-20-wm-8phase-live-run/README.md` |

## §2 superpowers 盘点（v6.3.0）

- **定位**：「完整的软件开发方法论」，14 个可组合技能 + session-start hook（自动触发）+ 跨 14+ harness 分发（Claude Code / Codex / Cursor / Gemini CLI / …各自装法）。
- **编码链**：`brainstorming`（设计精炼）→ `using-git-worktrees`（隔离工作区）→ `writing-plans`（任务级实现计划，含精确路径/代码/验证步骤）→ `subagent-driven-development`（逐任务新子代理 + 规格/质量两段评审 + 修复循环 ≤5 轮）或 `executing-plans`（批量执行 + 人工检查点）→ `test-driven-development`（RED-GREEN-REFACTOR）→ `requesting-code-review`（按严重度评审）→ `finishing-a-development-branch`（收口）；辅助：`systematic-debugging`、`verification-before-completion`、`receiving-code-review`、`dispatching-parallel-agents`。
- **形态**：每个技能 = `SKILL.md` + 提示词模板 + 少量 bash 脚本；**无制品格式、无退出码门禁**。
- **许可**：MIT（Jesse Vincent, 2025）——可 vendor、可改编，须保留版权声明。
- **与本仓的既有关系**：本环境 `~/.agents/skills/` 安装的是其**中文 fork**（superpowers-zh）；本仓 `docs/superpowers/{specs,plans,handoffs}/` 与 `.superpowers/sdd/<plan>/`（SDD 账本，gitignored）即该方法的产物约定，本次修复计划全程在其上运行。

## §3 适配性判定：方法论与 W-Model 角色模型的映射

| superpowers 技能 | W-Model 对应 | 说明 |
|---|---|---|
| brainstorming | 阶段 1 A-cross / 需求锐利化 | 已共生（`docs/superpowers/specs/` 即其产物） |
| writing-plans | **S-plan（新，替代 S-explore/S-propose 的规划半边）** | 产 `docs/plans/<changeId>.plan.md`：逐任务文件路径+完整代码+验证步骤 |
| subagent-driven-development | **S-coding 执行 + V 任务评审 + 修复循环** | 与 `subagent-delegation.md` 的分派/评审/账本纪律同构；本会话已实证 |
| executing-plans | S-coding 的并行会话变体 | 备选执行形态 |
| test-driven-development | 阶段 5 编码纪律（先红后绿） | 与 RTM 四级测试衔接 |
| requesting-code-review | V 评审（Persona 化） | 评审模板与 `verifier-spec.md` §6 Schema 对接 |
| finishing-a-development-branch | 阶段 8 收口 / 分支处置 | 对接 check-archive-integrity |
| systematic-debugging / verification-before-completion | R 根因定位 / 修复后复验 | 与 root-cause-locator.md 互补 |

**判定：适配度高**；缺口只有一个——superpowers 无机器可查制品（§4 制品层补齐）。

## §4 替换设计（四层，语义增补式）

### 4.1 方法论层（phase 5-8 分派改写 + vendor）

- 重写 `references/phase-5-coding.md`「OpenSpec opsx 三段式 S 分派」节为「superpowers 编码链 S 分派」：`S-plan`（writing-plans）→ `S-coding`（SDD 逐任务 + TDD）→ `V`（任务评审 + requesting-code-review 模板）→ `G`（新门禁）→ 收口（finishing-a-development-branch）。phase-6/7/8 同步。
- 新增 `references/superpowers-adoption.md`（仿 `skillopt-adoption.md` 先例）：vendor 关键技能的方法论要点 + 模板，**标注上游版本锚（v6.3.0 / commit b36e082）与本地中文 fork 的差异**；W-Model 包保持自包含（不要求宿主装了 superpowers 才能跑，宿主已装则为加速项）。

### 4.2 制品层（新增「编码计划制品契约」，承接门禁锚点）

| 制品 | 位置 | 门禁可查形态 |
|---|---|---|
| 编码计划 | `docs/plans/<changeId>.plan.md` | 逐任务含：目标/文件/步骤/**验证命令**/commit 信息；与 RTM 行关联 |
| 执行账本 | `.superpowers/sdd/<plan>/progress.md` | 逐任务 `Task N: complete (commits a..b, review clean)` 行覆盖 plan 全部任务 |
| 任务评审证据 | `.superpowers/sdd/<plan>/{task-N-brief,task-N-report}.md` + review-package diff | brief/report/review 三件套存在且非空 |
| 归档 | `docs/changes/archive/<日期>-<changeId>/`（**复用既有受控归档位**，不新造 openspec 式第二归档位——这正是 D-7 的教训） | 由 check-archive-integrity 既有机制覆盖 |

> 注意：当前 `.superpowers/sdd/.gitignore` 为 `*`（本地不入库）。替换后账本要成为门禁可查证据，需把「账本 + 三件套」纳入归档快照（归档时复制进 archive 目录），而不是改变 gitignore——避免把瞬态工作区变成被跟踪面。

### 4.3 门禁层（改写，非删除）

| 现脚本 | 处置 | 新脚本 |
|---|---|---|
| `check-opsx-artifacts.ts` | **改写**（保留 R3×9/V×3 齐全性语义与 `--scope` 聚合） | `check-coding-plan.ts`：plan 结构 + 账本覆盖 + 三件套存在性 + R3×9/V×3 |
| `check-openspec-archive.ts` | **退役**（归档校验并入 check-archive-integrity 的清单 + 新账本快照项） | —（不新增第二归档门，吸取 D-7 教训） |
| `ensure-codegraph-opsx.ts` | **改写** | `ensure-codegraph.ts`：**codegraph 依赖收敛为对其 CLI 的依赖**（用户指令 2026-09-21）——L1 CLI 必需（缺失保留 `@colbymchenry/codegraph` 自动安装）+ L3 项目 `.codegraph/` 目录（`codegraph init`）保留；**L2 MCP 注册降级为可选加速项**（不再作为依赖强制、不再自动 `codegraph install`），探针改走 CLI；阶段 5-8 修改前影响分析查询改为 CLI 优先（`.w-model/codegraph-queries/` 落盘义务不变）。superpowers 检测 = L1 宿主技能目录有关键技能 / L2 仓内 vendored 副本 / L3 `docs/superpowers/`，只检测不安装（openspec 的检测与 `@fission-ai/openspec` 安装整体删除） |
| run-log `opsx_*` 四动作 | schema 枚举保留 + `check-run-log` 以 **LEGACY 吸收**（既有机制，向后兼容）+ 新增 `plan_propose / plan_task / plan_review` 三动作（description 注明与角色的配对语义） | — |

### 4.4 数据/文档层

- schema：`run-log.schema.json` 枚举扩充（27→30 值）+ description 改写；`code-health-*` 无涉。
- samples：`opsx-artifacts/`、`openspec-archive/` 两簇迁移为 `coding-plan/` 簇（valid/bad/ambiguous 负例齐备），`samples/README.md` 矩阵 + `NEGATIVE-COVERAGE.md` 登记同步（覆盖矩阵必须闭合，否则 check-samples-coverage 红）。
- 文档：SSoT（opsx 节改写为新链）、AGENTS §1/§6、README、`command-reference.md`、`conventions.md`、`data-models.md`、`subagent-delegation.md`（反模式 #39/#40 措辞）、CHANGELOG。

## §5 与进行中工作的关系（重要）

- 当前分支 `fix/gate-contract-rework-chain` 剩余任务（T8 run-log V 重发配对、T9 文档同步、T10 端到端验收）**均与 opsx 无关**，先按原计划收口（T10 的 prepush 里 opsx 两门仍按现状跑绿）。
- 替换工作**开新分支**实施；迁移批次 4 的端到端复验需要**重建 demo workspace** 并用新链路重走阶段 5-8（这一步同时天然复验本轮全部修复）。
- D-7 的修复（check-opsx-artifacts 归档回退）在替换后随脚本改写被吸收，不浪费——其「归档位恰一匹配 + fail-closed」语义直接平移进新门禁的归档校验。

## §6 迁移计划（批次草案，批准后细化为正式实施计划）

| 批次 | 内容 | 验收 |
|---|---|---|
| 1 | `check-coding-plan.ts` 新门禁（logic 纯函数 + CLI + 正反例单测）+ run-log 词表扩充 + LEGACY 吸收 + samples 迁移 + 覆盖矩阵闭合 | 单测正反例 + self-test 358 + `check-samples-coverage` + docs-consistency |
| 2 | references 文档面（phase-5/6/7/8、superpowers-adoption 新文件、conventions、command-reference、data-models、subagent-delegation、SSoT、AGENTS、README、CHANGELOG） | docs-consistency + L0 链接审计 |
| 3 | `ensure-codegraph-superpowers.ts`（codegraph 检测保留 + superpowers 三层检测，零安装）+ `doctor.ts` 同步 + `check-openspec-archive.ts` 退役（归档校验并入 archive-integrity 清单） | doctor --json + self-test |
| 4 | demo 端到端复验：重建 workspace，用新链路重走阶段 5-8；旧 opsx 产物以 LEGACY 形态共存验证 | 12 项门禁全绿 + prepush 19 |
| 5 | openspec 残留清理：`ensure_*` 不再检测/安装 openspec、run-log opsx_* 转 LEGACY-only、`docs/` 退役声明 | grep 零活引用 + prepush |

## §7 风险与开放问题（需你裁定）

1. **顺序**：是否同意「先收口当前修复分支（T8-T10），再开替换分支」？（推荐：是——两批改动都碰 `run-log-logic.ts`/schema，并行必冲突）
2. **vendored vs 宿主依赖**：推荐「vendor 方法论文本进包（自包含）+ 宿主已装则加速」；若你希望强依赖宿主安装（像今天对 codegraph 的 L1 检测），批次 3 的检测语义改为 fail-CHECKPOINT。
3. **归档证据入库**：SDD 账本/三件套目前 gitignored；替换后是否按 §4.2 的「归档时复制进 archive」方案？（推荐：是——不改变瞬态工作区性质）
4. **中文 fork 锚定**：vendor 以**上游 v6.3.0**（英文，MIT）为版本锚、由本仓自行维护中文适配；还是跟随本地中文 fork？（推荐：上游锚定——fork 无版本契约）
