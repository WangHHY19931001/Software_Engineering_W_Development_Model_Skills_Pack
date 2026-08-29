---
name: w-model-dev
version: 41.19.0
description: >-
  Use when the user explicitly invokes /wm, mentions W-model, W 模型 or W 开发模型,
  requests requirements traceability (RTM), stage gates, quality gates, or development
  and testing in parallel. When the user only asks for an end-to-end or complete
  development process without these signals, ask whether to use the W-model first.
---

# W-Model Development

## 核心原则

W 模型将开发与测试设计同步推进：需求分析 ↔ 验收测试设计、系统设计 ↔ 系统测试设计、概要设计 ↔ 集成测试设计、详细设计 ↔ 单元测试设计。RTM 追踪需求、设计、代码和四级测试，阶段门阻止未经验证的推进。

技能只提供编排、参考、模板和确定性门禁脚本；LLM-as-a-Verifier 由外部 Agent 按提示词执行，技能脚本不调用 LLM。设计决策以 `docs/skill-design-document_SSoT.md` 为准。

**交付层**：L0「纯 skill」= `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/`，拷贝即激活；L1「带门禁」= L0 + `scripts/` + `samples/` + `tools/`（需项目根 `npm install`）。5 分钟上手见 [references/quickstart.md](references/quickstart.md)；安装细节见 `docs/INSTALL.md` §2。

## 触发决策

| 用户信号 | 行为 |
| --- | --- |
| `/wm ...`、W-model、W 模型、W 开发模型 | 立即启用 |
| 明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
| 只说"完整流程""从需求到交付""全生命周期开发" | 先询问"是否采用 W 模型（含并行测试设计、RTM 和阶段门）？"；确认前不初始化 |
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理 |

## 任务规模适配

**轻量 = 降载门禁强度，不是跳过阶段**：阶段流程、RTM、CHECKPOINT 一律不变；禁止以「任务小」为由跳过 S→V→G 顺序、RTM 回填或用户确认（反模式 #10/#21）。

| 任务规模 | 适配形态 | 门禁强度 |
| --- | --- | --- |
| 极小任务（demo/教学） | L0 交付层 + self-as-verifier（仅限 demo，模式细则见 subagent-delegation.md） | TLA+/BDD 可选，其余照跑 |
| 生产小项目 | 完整 8 阶段 + maturity L2 | TLA+ L1 + BDD L1 必跑，其余照跑 |
| 常规生产功能 | 完整 8 阶段 + maturity L3 | 全必跑 |

成熟度分级细则见 [references/operational-recovery.md](references/operational-recovery.md)。

## 不可违反的约束（14 条硬红线）

命中即回退到当前阶段起点。**执行前必读** [references/hard-constraints.md](references/hard-constraints.md)（含违反回退动作、关联脚本与反模式全表）。

| # | 约束 | 一句话语义 |
| --- | --- | --- |
| 1 | 测试设计前置 | 阶段 1–4 产物完成后立即产出对应测试设计 |
| 2 | 阶段门放行 | 评审通过 + 🔴 CHECKPOINT 用户确认才推进 |
| 3 | RTM 为事实源 | `.w-model/rtm.json` 唯一事实源，coverageStatus 与 coveragePercent 强一致 |
| 4 | 真实执行 | 不得估算覆盖率/测试/门禁结果，必须真实执行并记录 |
| 5 | 失败即回退 | 评审 C/D、测试失败、门禁 exit 1/2 均不得放行 |
| 6 | 按需加载 | 只读当前命令和阶段需要的参考 |
| 7 | 如实状态 | 未完成/未评审/未确认不得标为完成 |
| 8 | 编排者最小化 | O 只编排；实施动作由子代理执行；每阶段 S/V/G 各 ≥1 + R ≥3 |
| 9 | 门禁退出码不可伪 | exitCode 与 process.exit 强一致；G 存档 stdout；run-log 交叉校验 |
| 10 | 系统层级树 + REQ 层级 | 7 层图谱；REQ level 1-4 必填、level≥2 须 reqGroup |
| 11 | 闭环机制 + R3 审查 | 5 脚本每阶段门 exitCode=0；S 产出后 R3 三报告强制 |
| 12 | 返工必经根因定位 | V/G 不通过先 R 报告 → V 复审 → G 门禁 → S-fix |
| 13 | 行为门禁按成熟度分级 | 阶段 1-4 TLA+ + BDD 按成熟度强制 |
| 14 | 代码改动前后门禁 | 修改前 codegraph 影响分析落盘 + 改动后回归测试 |

完整反模式（48 条）、检测信号和回退动作见 [references/hard-constraints.md](references/hard-constraints.md)「反模式」节。

## 编排者-子代理边界

编排者（O）只做路由、状态读写、CHECKPOINT 等待、分派子代理、持久化和只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行（越权命中反模式 #10，回退当前阶段起点）。

| 角色 | 职责 | 关键不变式 |
| --- | --- | --- |
| S 产出 | 阶段产物 + 同步测试设计 + 回填 RTM；F（修复）由 S 兼任 | 签名链 inputProvenance 来源证明 |
| V 评审 | 按 agent-personas.md + verifier-spec.md 产出 VerifierOutput | R1-R13；单轴下限 <0.70 判失败 |
| G 门禁 | 独立跑 check-* 门禁 + 回填 exitCode 证据 | run-log R6 用 gate-logs 交叉校验 |
| A 分析 | 阶段 1–4 分块分析、合并建图 | 只产出 ingestion 中间产物 |
| R 根因 | 定位根因产出 RootCauseReport；R3 预防性审查 | 只产出报告，不实施修复 |

每阶段时序：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出 → R3 预防性审查 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新状态。细则（S 拆分、self-as-verifier 模式、只读脚本例外、dispatch-matrix 总览）见 [references/subagent-delegation.md](references/subagent-delegation.md)。

## 执行工作流

1. **路由任务**（O）：识别命令、阶段和用户意图；歧义触发先确认。
2. **环境自检**（O）：首次启用或门禁报依赖错误时跑 `npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla]`。
3. **读取状态**（O）：读 `.w-model/project.json` 与 `rtm.json`；损坏先恢复（operational-recovery.md）。
4. **检查前置产物**（O）：缺上游产物拒绝跳阶段，指出应返回的命令。
5. **加载最小引用集**（O）：只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件。
6. **初始化确认**（O）：🔴 CHECKPOINT · 项目初始化（复述阶段/同步测试设计/预期产物）。
7. **产出**（O→S）：生成产物 + 同步测试设计 + 更新 RTM；阶段 1–4 额外产出 TLA+ 规格与 BDD features（按成熟度）；ingestion 子流程（plan-chunks → A-chunk/A-cross → check-requirement-graph，收敛循环 MAX_ROUNDS=5）见 ingestion-chunk.md。
8. **R3 预防性审查**（O→R）：S 产出后、V 评审前三阶段审查（completeness/reliability/security）。
9. **评审**（O→V）：按 targetKind 路由 Persona 产出 VerifierOutput。**编排者不得自评**。
10. **门禁**（O→G）：跑 check-verifier-output.ts；阶段 1–4 额外 check-tla-model.ts + check-bdd-model.ts；阶段 5 额外 check-code-tla-consistency.ts。
11. **验证与暂停**（O）：失败 → R 根因 → V 复审 → G 门禁 → S-fix → 重走 V→G（跳过 R 命中反模式 #18）；S-fix 后与放行前分派冰山扫掠（iceberg-sweep-guide.md）。
12. **持久化**（O）：用户放行后才更新 `project.status`；状态写入统一经 wm-write.ts（锁 + 备份 + 原子写）。

> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 的「质量等级 / 各子标准分 / reworkHints」，等待用户选择放行或返工。
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检跑 check-artifact-gate.ts，退出码 0 后展示 RTM 覆盖率、四级测试结果，等待用户选择发布或回退。

完整阶段切换与回退流程见 [references/workflow.md](references/workflow.md)。

## 命令速查

| 命令 | 路由 | 分派 |
| --- | --- | --- |
| `/wm analyze <需求>` | 阶段 1（首次初始化 + 验收测试设计） | O→S→V→G |
| `/wm design type=<架构\|概要\|详细>` | 阶段 2/3/4（须有已放行上游产物） | O→S→V→G |
| `/wm code <功能>` | 阶段 5（须有已放行详细设计；真实执行单测） | O→S→V→G |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8（result 必填且必须来自真实测试输出） | O→S→V→G |
| `/wm review <目标>` | 阶段门（外部 Agent 评审） | O→V→G |
| `/wm status` / `/wm help` / `/wm metrics` | 只读 | O 只读 |
| `/wm reset` / `/wm import <文件>` | 状态操作（🔴 CHECKPOINT 后执行） | O 执行 |
| `/wm export [目录]` / `/wm hill-climbing` | 导出 / 改进信号 | O 只读 / O 分析 |

每命令的输入、输出、失败动作见 [references/command-reference.md](references/command-reference.md)。门禁脚本 37 个 .ts，登记总览见 subagent-delegation.md「dispatch-matrix」节。

## 阶段路由

| # | 开发阶段 | 同步/执行测试 | 吸收标记 | 必读参考 |
| --- | --- | --- | --- | --- |
| 1 | 需求分析 | 验收测试设计 | User Stories | phase-1-requirements.md |
| 2 | 系统设计 | 系统测试设计 | seam | phase-2-system-design.md |
| 3 | 概要设计 | 集成测试设计 | Tracer-bullet+opsx | phase-3-outline-design.md |
| 4 | 详细设计 | 单元测试设计 | opsx 三段式 | phase-4-detailed-design.md |
| 5 | 编码实现 | 单元测试执行 | archive+opsx | phase-5-coding.md |
| 6 | 集成测试 | 集成测试执行 | — | phase-6-integration-test.md |
| 7 | 系统测试 | 系统测试执行 | — | phase-7-system-test.md |
| 8 | 验收测试 | 验收测试执行 | — | phase-8-acceptance-test.md |

所有阶段另读 rtm-guide.md；TLA+（阶段 1-4）→ tla-plus.md；BDD → bdd.md；评审 → verifier-spec.md；状态 Schema → data-models.md；异常恢复 → operational-recovery.md；分派 → subagent-delegation.md。按需加载契约见 [references/subagent-delegation.md](references/subagent-delegation.md) 与 [references/toolbox.md](references/toolbox.md)。

## 快速自检

推进或完成声明前按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验；交互样例按需读 [examples/](examples/)。
