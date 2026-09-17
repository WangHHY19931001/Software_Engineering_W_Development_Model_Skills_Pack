---
name: w-model-dev
version: 42.2.1
description: >-
  Use when the user invokes /wm, mentions W-model, W 模型 or W 开发模型, requests
  requirements traceability (RTM), stage gates, quality gates, or development and
  testing in parallel, or asks for an end-to-end / complete development process.
  Trigger boundaries, anti-scenarios and the handling of ambiguous requests are
  defined in references/activation-guide.md.
---

# W-Model Development

## 核心原则

W 模型将开发与测试设计同步推进：需求分析 ↔ 验收测试设计、系统设计 ↔ 系统测试设计、概要设计 ↔ 集成测试设计、详细设计 ↔ 单元测试设计。RTM 追踪需求、设计、代码和四级测试，阶段门阻止未经验证的推进。

技能只提供编排、参考、模板和确定性门禁脚本；LLM-as-a-Verifier 由外部 Agent 按提示词执行，技能脚本不调用 LLM。设计决策以 `docs/skill-design-document_SSoT.md` 为准。

**交付层**：L0「纯 skill」= `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/`，拷贝即激活；L1「带门禁」= L0 + `scripts/` + `samples/` + `tools/`（需项目根 `npm install`）。L0 文档中指向 `scripts/`、`samples/`、`tools/` 的链接统一为 **L1-only 导航**（权威定义：SSoT §3.5）：L0 副本预期不含目标，链接检查须将其分类为分层边界且不得报告“L0 全链接通过”；取得 L1 后才校验这些目标。5 分钟上手见 [references/quickstart.md](references/quickstart.md)；安装细节见 `docs/INSTALL.md` §2。

## 触发决策

| 用户信号                                                                              | 行为                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/wm ...`、W-model、W 模型、W 开发模型，或明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用                                                                                                                                                                                                                                                                                                        |
| 只说"完整流程""从需求到交付""全生命周期开发"                                          | 先询问"是否采用 W 模型（含并行测试设计、RTM 和阶段门）？"；确认前不初始化                                                                                                                                                                                                                                       |
| 普通需求、设计、编码、测试、修复或技术解释                                            | 不启用，按普通任务处理。反例十类速览：一次性数据/文件脚本、样式与小 bug 修复、纯问答与技术解释、环境与配置变更、纯文档撰写与排版、数据查询与正则提取、依赖升级与小重构、非软件开发任务、单点执行指令、已由其他工具接管的请求——判定细则与边界见 [references/activation-guide.md](references/activation-guide.md) |

## 任务规模适配

**轻量 = 降载门禁强度，不是跳过阶段**：阶段流程、RTM、CHECKPOINT 一律不变；禁止以「任务小」为由跳过 S→V→G 顺序、RTM 回填或用户确认（反模式 #10/#21）。成熟度分级细则见 [references/operational-recovery.md](references/operational-recovery.md)。

| 任务规模              | 适配形态                                                                     | 门禁强度                        |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| 极小任务（demo/教学） | 交付层 L0-only 副本 + maturity L0/L1 + self-as-verifier（仅限 demo，模式细则见 subagent-delegation.md） | TLA+/BDD 可选，其余照跑         |
| 生产小项目            | 完整 8 阶段 + maturity L2                                                    | TLA+ L1 + BDD L1 必跑，其余照跑 |
| 常规生产功能          | 完整 8 阶段 + maturity L3                                                    | 全必跑                          |

## 阶段开工前分诊

开工前把请求归为 **spike / bounded / architectural** 之一。该分类**只是标签，不是执行路径**：它**不选择流程、不改变门禁强度、不改写执行工作流第 1 步的命令路由**（`/wm` 命令仍决定阶段与分派）；本节规定的是**口播义务**，不是路由表。

- **分类必须口播给用户可否决**：说出分类、判据与将受影响的文档仪式，等用户确认或否决；用户否决时按其裁定执行，不得静默按分类推进。这是本节唯一的机制性要求。
- **仪式可缩、门不可缩**：只有**文档与仪式**的轻重可随分类调整；**阶段门 / RTM / CHECKPOINT / S→V→G 顺序**一律不缩、不并、不跳。
- **单向棘轮**：分类**不得在任务中途下调**（"Nothing downgrades mid-task"）；发现低估时只能上调并重新口播。
- **「给贴标签的动机本身即怀疑」**：为换取轻量路径而贴标签的动机即红灯；分类不得用作省略产物的理由。
- **bounded 不得成为绕过阶段门 / CHECKPOINT 的后门**：bounded 仅表示「问题边界已明」；任何以 bounded 为由回避「阶段 1–4 设计级产物强制」的用法一律无效——它不是「门可以少走」。
- **不引入路由**：本**不**为 `/wm` 引入任务级轻量路由；分类不决定执行路径，`check-artifact-gate.ts --phase=N` 的强制边界**不变**。若将来确需轻量出口，须另立规格。

**与 `## 任务规模适配` 的划界**：该节管的是**成熟度分级**（L0/L2/L3 → 门禁强度档位，由脚本按 `--phase=N` 判定）；本节管的是**请求性质的分类口播义务**（标签说给用户 + 可否决）。两者不重叠，本节**不构成第二个「轻量出口」**。

## 不可违反的约束（14 条硬红线）

命中即回退到当前阶段起点。**执行前必读** [references/hard-constraints.md](references/hard-constraints.md)（含违反回退动作、关联脚本与反模式全表）。

| #   | 约束                  | 一句话语义                                                                                        |
| --- | --------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | 测试设计前置          | 阶段 1–4 产物完成后立即产出对应测试设计                                                           |
| 2   | 阶段门放行            | 评审通过 + 🔴 CHECKPOINT 用户确认才推进                                                           |
| 3   | RTM 为事实源          | `.w-model/rtm.json` 唯一事实源，coverageStatus 与 coveragePercent 强一致                          |
| 4   | 真实执行              | 不得估算覆盖率/测试/门禁结果，必须真实执行并记录                                                  |
| 5   | 失败即回退            | 评审 C/D、测试失败、门禁 exit 1/2 均不得放行                                                      |
| 6   | 按需加载              | 只读当前命令和阶段需要的参考                                                                      |
| 7   | 如实状态              | 未完成/未评审/未确认不得标为完成                                                                  |
| 8   | 编排者最小化          | O 只编排；实施动作由子代理执行；每阶段 S/V/G 各 ≥1，R3 三维度（role=R 的 r3-* success 记录）各 ≥1 |
| 9   | 门禁退出码不可伪      | exitCode 与 process.exit 强一致；G 存档 stdout；run-log 交叉校验                                  |
| 10  | 系统层级树 + REQ 层级 | 7 层图谱；REQ level 1-4 必填、level≥2 须 reqGroup                                                 |
| 11  | 闭环机制 + R3 审查    | 5 脚本每阶段门 exitCode=0；S 产出后 R3 三报告强制                                                 |
| 12  | 返工必经根因定位      | V/G 不通过先 R 报告 → V 复审 → G 门禁 → S-fix                                                     |
| 13  | 行为门禁按成熟度分级  | 阶段 1-4 TLA+ + BDD 按成熟度强制                                                                  |
| 14  | 代码改动前后门禁      | 修改前 codegraph 影响分析落盘 + 改动后回归测试                                                    |

完整反模式（48 条）、检测信号和回退动作见 [references/hard-constraints.md](references/hard-constraints.md)「反模式」节。

## 编排者-子代理边界

编排者（O）只做路由、状态读写、CHECKPOINT 等待、分派子代理、持久化和只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行（越权命中反模式 #10，回退当前阶段起点）。

| 角色   | 职责                                                        | 关键不变式                       |
| ------ | ----------------------------------------------------------- | -------------------------------- |
| S 产出 | 阶段产物 + 同步测试设计 + 回填 RTM；F（修复）由 S 兼任      | 签名链 inputProvenance 来源证明  |
| V 评审 | 按 agent-personas.md + verifier-spec.md 产出 VerifierOutput | R1-R18（R14-R17 见 verifier-spec.md §3.3，R18 见 §14.2；单轴下限 <0.70 判失败） |
| G 门禁 | 独立跑 check-* 门禁 + 回填 exitCode 证据                    | run-log R6 用 gate-logs 交叉校验 |
| A 分析 | 阶段 1–4 分块分析、合并建图                                 | 只产出 ingestion 中间产物        |
| R 根因 | 定位根因产出 RootCauseReport；R3 预防性审查                 | 只产出报告，不实施修复           |

每阶段时序：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出 → R3 预防性审查 → G 运行 `check-preventive-review.ts`（exitCode=0）→ V 评审 → G 常规门禁 → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新状态。细则（S 拆分、self-as-verifier 模式、只读脚本例外、dispatch-matrix 总览）见 [references/subagent-delegation.md](references/subagent-delegation.md)。跨阶段/跨角色交接与调用分类的书写规则见同文件「调用分类」与「跨阶段与跨角色交接的书写规则」两节；交接必须写成显式动作句，人类入口不得由子代理代达。

## 执行工作流

1. **路由任务**（O）：识别命令、阶段和用户意图；歧义触发先确认。
2. **读取状态与环境自检**（O）：读 `.w-model/project.json` 与 `rtm.json`（损坏先恢复，见 operational-recovery.md）；首次启用或门禁报依赖错误时跑 `npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla]`。
3. **前置产物与最小引用集**（O）：缺上游产物拒绝跳阶段并指出应返回的命令；只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件。
4. **初始化确认**（O）：🔴 CHECKPOINT · 项目初始化（复述阶段/同步测试设计/预期产物）。
5. **产出**（O→S）：生成产物 + 同步测试设计 + 更新 RTM；阶段 1–4 额外产出 TLA+ 规格与 BDD features（按成熟度）；ingestion 子流程（plan-chunks → A-chunk/A-cross → check-requirement-graph，收敛循环 MAX_ROUNDS=5）见 ingestion-chunk.md。
6. **R3 预防性审查**（O→R→G）：S 产出后分派 R 完成 completeness/reliability/security 三份报告，再由 G 运行 check-preventive-review.ts；exitCode=0 后才可进入 V。
7. **评审**（O→V）：按 targetKind 路由 Persona 产出 VerifierOutput。**编排者不得自评**。
8. **门禁**（O→G）：跑 check-verifier-output.ts；阶段 1–4 额外 check-tla-model.ts + check-bdd-model.ts；阶段 5 额外 check-code-tla-consistency.ts。
9. **验证与暂停**（O）：普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）；跳过 R 或 R 报告复审/门禁分别命中反模式 #18/#19。S-fix 后与放行前分派冰山扫掠（iceberg-sweep-guide.md）；阶段 1 ingestion 图谱失败仍走 A→G 专用收敛循环。
10. **持久化**（O）：用户放行后才更新 `project.status`；状态写入统一经 wm-write.ts（锁 + 备份 + 原子写）。

> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 的「质量等级 / 各子标准分 / reworkHints」，等待用户选择放行或返工；阶段 8 终检跑 check-artifact-gate.ts，退出码 0 后展示 RTM 覆盖率与四级测试结果，等待用户选择发布或回退。

完整阶段切换与回退流程见 [references/workflow.md](references/workflow.md)；推进或完成声明前按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验；交互样例按需读 [examples/](examples/)。

## 命令速查

| 命令                                                         | 路由                                                                 | 分派                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------- |
| `/wm analyze <需求>`                                         | 阶段 1（首次初始化 + 验收测试设计）                                  | O→S→V→G               |
| `/wm design type=<架构\|概要\|详细>`                         | 阶段 2/3/4（须有已放行上游产物）                                     | O→S→V→G               |
| `/wm code <功能>`                                            | 阶段 5（须有已放行详细设计；真实执行单测）                           | O→S→V→G               |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8（result 必填且必须来自真实测试输出）                        | O→S→V→G               |
| `/wm review <目标>`                                          | 阶段门（外部 Agent 评审）                                            | O→V→G                 |
| `/wm status` / `/wm help` / `/wm metrics`                    | 只读                                                                 | O 只读                |
| `/wm code-health <phase>`                                    | Phase 1–4 代码健康治理（只读发现 → 人工授权 → 受控应用；campaign 归档已实现，`--verify` 无 `--source-project` 仅 package-only） | O→A/S→V→G；human 授权 |
| `/wm reset` / `/wm import <文件>`                            | 状态操作（🔴 CHECKPOINT 后执行）                                     | O 执行                |
| `/wm export [目录]` / `/wm hill-climbing`                    | 导出 / 改进信号                                                      | O 只读 / O 分析       |

每命令的输入、输出、失败动作见 [references/command-reference.md](references/command-reference.md)。门禁脚本 47 个 .ts，登记总览见 subagent-delegation.md「dispatch-matrix」节。

> **`/wm code-health` 权限与 CHECKPOINT**：O 只路由 / 只读 / 持久化；A 只解读 O/G 执行的 Phase 1–2 CLI 输出并登记发现（发现不是结论）；S 仅在人类批准 scope 内经 `code-health-apply.ts` 执行最小可逆改动；V 独立复核分类 / 等价证明 / scope / 回滚；G 跑 code-health CLI 并回填真实退出码；R 定位 `blocked` 候选根因；**只有 human 能批准**（精确 candidate ID / action / files / symbols / scopeHash）。实现前与放行前均须 🔴 CHECKPOINT 等待人类决定；失败链 `gate-failure → blocked → R → V → G → S(rework) → evidenced` 顺序不可跳过。详见 [references/code-health-governance.md](references/code-health-governance.md)。

## 阶段路由

| #   | 开发阶段 | 同步/执行测试 | 吸收标记           | 必读参考                    |
| --- | -------- | ------------- | ------------------ | --------------------------- |
| 1   | 需求分析 | 验收测试设计  | User Stories       | phase-1-requirements.md     |
| 2   | 系统设计 | 系统测试设计  | seam               | phase-2-system-design.md    |
| 3   | 概要设计 | 集成测试设计  | Tracer-bullet+opsx | phase-3-outline-design.md   |
| 4   | 详细设计 | 单元测试设计  | opsx 三段式        | phase-4-detailed-design.md  |
| 5   | 编码实现 | 单元测试执行  | archive+opsx       | phase-5-coding.md           |
| 6   | 集成测试 | 集成测试执行  | —                  | phase-6-integration-test.md |
| 7   | 系统测试 | 系统测试执行  | —                  | phase-7-system-test.md      |
| 8   | 验收测试 | 验收测试执行  | —                  | phase-8-acceptance-test.md  |

所有阶段另读 rtm-guide.md；TLA+（阶段 1-4）→ tla-plus.md；BDD → bdd.md；评审 → verifier-spec.md；状态 Schema → data-models.md；异常恢复 → operational-recovery.md；分派 → subagent-delegation.md；路径不确定/需求模糊 → evidence-anchored-tree.md；代码健康治理（`/wm code-health`，Phase 1–4）→ code-health-governance.md。按需加载契约见 [references/subagent-delegation.md](references/subagent-delegation.md) 与 [references/toolbox.md](references/toolbox.md)。

## 门禁契约与资源清单

- **核心操作行为**：完整的八条操作行为与失败模式 F1-F10 见 [references/operation-behaviors.md](references/operation-behaviors.md)，按需加载。
- **技能资产编写**：写或评审 `SKILL.md`/`references/`/`templates/` 前必读 [references/asset-authoring.md](references/asset-authoring.md)（no-op test、渐进披露阈值、授权不写）。
- **资源计数**：`references/`（43 个 .md）、`schemas/`（34 份 JSON Schema draft-07，含 change-scope / codegraph-query 与 evidence-manifest / evidence-provenance）、门禁脚本 47 个 .ts。
- **状态写锁协议**：状态写入统一经 `wm-write.ts` 使用 `<target>.lock` 持久目录与可转移 `owner` 对象实施跨进程锁，锁内校验 mtime 并毫秒+UUID 备份、tmp+rename 原子替换与回读恢复；CLI 用 `--lock-timeout` 控制等待，陈旧锁必须显式 `--recover-stale-lock`，否则以退出码 1 拒绝写入。
- **行为门禁**：阶段 1-4 传 `--require-tla-equivalence --tla-manifest=<path>`，阶段 5-8 传 `--require-cucumber-report --cucumber-report=<path>`。
- **证据与审计**：`coverage/`、`.zcode/` 与 `.w-model/` 是 Git 忽略的本地生成物，默认不随 Git 交付；需要交付审计证据时先运行 `npm run wm:verify-evidence-source -- <project-dir>`（`wm-verify-evidence-source.ts` producer+verify 命令，写入 source-bound provenance，登记 `evidence-provenance.schema.json`），再运行 `npm run wm:export-evidence -- <project-dir> <output-dir>` 生成脱敏、带 SHA-256 manifest 的证据包；`wm-export-evidence --verify` 默认仅做 package-only 校验，传 `--source-project` 才做 source-bound 重验；受控本机 provenance 提供流程完整性，不是密码学签名，也不是第三方不可抵赖证明；导出后仍须按项目安全策略审阅，且不会自动提交或发布。受控且被跟踪的历史归档是 `docs/changes/archive/`，与本地 `.w-model/` 不同。
