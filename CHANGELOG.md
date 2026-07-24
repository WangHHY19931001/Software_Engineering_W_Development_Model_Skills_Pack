# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归（完整版）

> 修复工作过程中发现的三个问题：① TLA+ 存在多次返工（疑似指南和编写规范问题）；② 编排者出现多次上下文压缩（疑似任务越权或任务设计过于复杂）；③ TLA+ 资产未能作为状态机验证器门禁来回归编码产物。
>
> 走 superpowers-zh 工作流（头脑风暴 → 设计 spec → 编写计划 → 执行 → 修正 SSoT）完整修复。设计文档：[`docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md`](docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md)；实现计划：[`docs/superpowers/plans/2026-07-24-tla-plus-and-orchestration-fix.md`](docs/superpowers/plans/2026-07-24-tla-plus-and-orchestration-fix.md)。

#### 问题1：TLA+ 指南缺陷修复

#### 新增

- `w-model-dev/references/tla-plus-guide.md` 新增三节：
  - §2.0 命名规范（强制）：MODULE 名 `[A-Za-z][A-Za-z0-9_]*` 禁止连字符；`L<level>_<system>` 格式；反例 `L1-blog-system`（连字符）/ `1blog`（数字开头）/ `博客系统`（中文）
  - §2.1 路径解析基准（强制）：`jarPath` 相对 cwd、`tlaPath`/`cfgPath` 相对 manifest 目录、`@parent`/`@sibling`/`@child` 相对 `.tla` 目录
  - §2.2 前置清单：S 产出前 3 项检查（MODULE 名合法 / 路径基准 / cfg-tla 一致性）、G 校验前 3 项检查（含删除 `states/` 目录）
- `w-model-dev/references/tla-plus-guide.md` manifest schema 节补 `checkRounds` 语义：记录每轮 `check-tla-model.ts` 校验结果（含 violations 摘要与 round 编号）；violations 跨轮须单调递减；与 `run-log.jsonl` R3 交叉校验；无返工填 `[]`
- `w-model-dev/templates/tla-spec-template.md` 修正 `.cfg` 写法：L65-83 非法 `INVARIANT` 多行多名 → `INVARIANTS` 关键字 + 列表；补 `BusinessInvariant` 聚合示例；末尾追加 5 个反例节
- `w-model-dev/references/data-models.md` 末尾追加 `### tla-manifest.json` 节，含完整字段表 + `checkRounds` 语义指针

#### 变更

- 全局统一 MODULE 名示例去连字符（`L1-blog-system` → `L1_blog_system`）：`tla-plus-guide.md` / `tla-spec-template.md` / `data-models.md` / `docs/tla-plus-modeling-design.md`

#### 问题2：编排纪律强化

#### 新增

- `w-model-dev/references/subagent-delegation.md` 新增 S-doc/S-tla 拆分机制：
  - **S-doc**：产出开发文档 + 同步测试设计 + 更新 RTM 实体
  - **S-tla**：产出 `.tla` + `.cfg` + `tla-manifest.json` 实体（依赖 S-doc 的设计文档）
  - 分派时序：S-doc → S-tla → V → G
  - S-doc / S-tla 分派模板（含任务边界声明）
- `w-model-dev/references/subagent-delegation.md` 检测信号 5：编排者 `Write`/`Edit` 写 TLA+ 产物实体（`.tla`/`.cfg`/`tla-manifest.json`）

#### 变更

- `w-model-dev/references/subagent-delegation.md` L282 强制约束「写产物」项追加 `.tla`/`.cfg`/`tla-manifest.json` 实体
- `w-model-dev/SKILL.md`：
  - L62 角色表「关键禁止」补 `.tla`/`.cfg`/`tla-manifest.json` 实体
  - L118 阶段 1-4 分派补「可拆 S-doc/S-tla」指引
  - L239 自检清单补「无 `.tla`/`.cfg`/`tla-manifest.json` 实体改动」
  - 阶段 5 门禁节补「额外分派 G 跑 `check-code-tla-consistency.ts`」

#### 问题3：代码-TLA+ 一致性回归（完整版）

#### 新增

- **`w-model-dev/scripts/code-tla-logic.ts`**：代码-TLA+ 一致性校验纯逻辑（单点事实源），四维度校验：
  - 维度1 `checkSdToCodeModule`：SD→codeModule 映射完整性（读 `graph.json` SD 节点，核验 `rtm.json` codeModule 覆盖，多段匹配）
  - 维度2 `extractCodeStateTransfers` + `checkCodeStateTransfer`：代码状态转移抽取（TypeScript Compiler API 解析 AST，抽取 `BinaryExpression(=)` / `IfStatement` / `SwitchStatement`）
  - 维度3 `checkNextBranchCoverage`：Next 分支对应（正则抽取 TLA+ Next 动作名，驼峰匹配代码方法名）
  - 维度4 `checkInvariantCoverage`：断言覆盖不变式（抽取 `BusinessInvariant` 子不变式名，匹配代码 `assert`/`invariant`/`require` 调用）
- **`w-model-dev/scripts/check-code-tla-consistency.ts`**：CLI 入口（参数 `--manifest`/`--graph`/`--rtm`/`--src`；输出 `CODE_TLA_JSON`；退出码 0/1）
- **`w-model-dev/scripts/__tests__/code-tla-logic.test.ts`**：5 条测试样本（3 合规 + 2 违规）
- `w-model-dev/scripts/self-test.ts`：新增 5 条 code-TLA+ 样本用例（回归基线 61→66）

#### 变更

- `w-model-dev/scripts/gate-logic.ts`：`checkArtifactGate` 入参追加 `graph?`/`manifestExists?`；新增 TLA+ 资产存在性校验（manifestExists）+ SD→codeModule 映射校验（读 graph SD 节点）
- `w-model-dev/scripts/check-artifact-gate.ts`：读取 `.w-model/ingestion/graph.json` + 检查 `.w-model/tla-manifest.json` 存在性 + specs 非空；传入 `checkArtifactGate`；修复 `exitCode` 字段缺失缺陷（缺陷5）
- `w-model-dev/scripts/check-run-log.ts`：`extractExitCode` 模式数组增加 `GATE_JSON` 标记识别（配合缺陷5修复）

#### SSoT 修正

- `docs/skill-design-document_SSoT.md`：
  - §10.8 L1203 阶段 5-8 行：从「只读」升级为「冻结只读 + 须通过 `check-code-tla-consistency.ts` 一致性回归」
  - §10.8 L1220-1222 追加校验项：代码状态转移与 Next 对应 / 断言覆盖不变式 / SD 有 codeModule
  - §10.8 新增 §10.8.1「代码-TLA+ 一致性回归（check-code-tla-consistency.ts）」节：CLI 接口 + 四维度校验算法 + 触发时机 + 与其它门禁协同
  - §10.8 L1169 统一 `--phase` 取值口径（1-8，与脚本一致）
  - §7.8 补 `checkRounds` 语义（与 `tla-plus-guide.md` 双向追溯）
  - §10A 追溯表新增 §10.8.1 行
  - §10B 参考实现更新至第五轮（2026-07-24）：调测轮次/缺陷数/测试计数/覆盖率/图谱/TLA+/code-TLA+ 一致性全维度同步

#### demo 项目代码补齐 TLA+ 对齐

- `w-model-dev-demo/src/services/auth.service.ts`：新增 `logout()` / `resetCycle()` 方法 + `assert` 断言覆盖 TLA+ 不变式（TokenIssuedRequiresAuthenticated / LoggedOutImpliesNoToken / InitStateImpliesNoTokenAndNoHash）
- `w-model-dev-demo/src/controllers/auth.controller.ts`：新增 `logout()` 控制器方法
- `w-model-dev-demo/src/routes/auth.routes.ts`：新增 `POST /api/auth/logout` 路由
- `w-model-dev-demo/src/services/article.service.ts`：新增 `startNewArticle()` 方法 + `assert` 断言覆盖 TLA+ 不变式（TypeInvariant / PublishedCountBounded）

#### 验证

- `npx tsc --noEmit` → 0 错误（demo 项目 + skill 脚本）
- `npm run self-test` → 66/66 通过（含 5 条 code-TLA+ 用例），退出码 0
- demo 项目 `check-code-tla-consistency.ts` → 退出码 0（四维度全通过）
- demo 项目 `check-artifact-gate.ts` → 退出码 0（RTM 100% + TLA+ 资产✓ + graph✓）
- demo 项目 `npm test` → 135/135 通过（77 unit + 21 integration + 22 system + 15 acceptance）
- Grep 确认无 MODULE 名连字符残留（仅反例4故意保留）

### 吸收 cobusgreyling/loop-engineering 运维层与成熟度设计（4 项优化）

> 对 [`cobusgreyling/loop-engineering`](https://github.com/cobusgreyling/loop-engineering) 的运维层与自主成熟度概念进行联网调研后，提出并落地 4 项优化设计，扩展 w-model-dev 技能包的「运行时治理层」。
>
> 设计遵循现有架构硬约束：不内置 LLM 调用（约束 4）、CHECKPOINT 不可绕过（约束 2 + #8）、编排者最小化（#10）、SSoT 优先。4 项优化均为声明式 JSON / 字段填写 / append-only 日志，不引入 LLM 估算，不改变门禁脚本退出码语义。
>
> 设计文档：[`docs/loop-engineering-adoption-design.md`](docs/loop-engineering-adoption-design.md)

#### 新增

- **优化 1：成本预算与运行日志**（SSoT §10D + operational-recovery.md）
  - `budget.json`：声明式 perPhase / project 预算；`onExceed` ∈ `warn | pause | abort`；`killSwitch` 全局停摆开关
  - `run-log.jsonl`：append-only 运行日志，每条记录含 `phase` / `action` / `agent` / `tokensEstimate`（宿主 Agent 报实际消耗，`estimated=false`）/ `acknowledgedDecisions`
  - 预算超限 / kill switch 触发 / 运行日志维护三个子表（operational-recovery.md）
  - `data-models.md` 新增 `interface BudgetConfig` / `interface RunLogEntry` 两个 schema
- **优化 2：自主成熟度阶梯 L0~L3**（SSoT §10C + operational-recovery.md）
  - L0（默认）→ L3 四级阶梯；决策型 CHECKPOINT 在所有级别均等用户（不可绕过）；L1+ 操作型 CHECKPOINT 可选择性自动放行（不是绕过，仍在 run-log 留痕）；L3 高风险路径强制人工 gate
  - 放行矩阵覆盖：阶段门放行 / 质量门通过自动放行 / 返工路径 / 工件归档四个维度
  - `maturity.json`：`level` / `unlockConditions` / `history` / `downgradeTriggers`；升级与降级流程
  - `data-models.md` 新增 `interface MaturityConfig` schema
- **优化 3：运维失败模式 O1~O6**（SSoT §4A.2a + anti-patterns.md）
  - 6 条运行健康失败模式：O1 Token Burn / O2 State Rot / O3 Verifier Theater / O4 Comprehension Debt / O5 Cognitive Surrender / O6 Escalation Failure
  - 三层失败模式架构：流程反模式 #1~#17（命中即回退）→ 行为退化 F1~F10（标注不回退）→ 运维失败模式 O1~O6（标注 + 协同检测，部分触发 kill switch）
  - 检测信号 + 处理流程 + 与 loop-engineering 差异表（anti-patterns.md 完整登记）
- **优化 4：理解债务显式化**（SSoT §10.6 第六维度 + verifier-spec.md §6.2 + definition-of-done.md）
  - DoD 从五维度扩展为六维度：新增「理解证据」维度（标准：`acknowledgedDecisions` 已填入；验证方式：run-log.jsonl 比对；不通过动作：要求 Agent 复述关键决策并填 acknowledgedDecisions 后重放行）
  - `verifier-spec.md` §6.2：`summary` 字段要求阶段 digest 三要素（① 关键决策摘要 ② 产物核心结构 ③ 遗留风险/已知限制）；`summary` 为空或仅"通过"视为 O3 命中，V 评审降级重做
  - `definition-of-done.md` 自检清单新增「acknowledgedDecisions 已填入」项；反例引用更新为「17 条流程反模式、F1~F10 失败模式与 O1~O6 运维失败模式」

#### 变更

- `docs/skill-design-document_SSoT.md`：
  - §3.4.5「编排者允许的动作」新增 budget / run-log / maturity 维护项
  - §4A.2 后插入 §4A.2a「运维失败模式清单（O1~O6）」；§4A.3 扩展为三层失败模式架构描述
  - §10.6 DoD 五维度 → 六维度（新增「理解证据」维度）
  - §10A 追溯表新增 §10C / §10D 行，更新 §4A 与 §10.6 行
  - 在 §10.8 与 §10A 之间插入 §10C「自主成熟度阶梯（L0~L3）」与 §10D「成本预算与运行日志」
- `w-model-dev/SKILL.md`：
  - 约束 2「阶段门放行」补充「L1+ 操作型 CHECKPOINT 自动放行是选择性激活，非绕过；决策型 CHECKPOINT 在所有级别均等用户；阶段门放行须填 acknowledgedDecisions 理解证据」
  - 快速自检清单新增「阶段门放行已填理解证据」+「预算与成熟度已检查」两项
- `w-model-dev/references/operational-recovery.md`：新增「成本预算与运行日志」节（预算超限 / kill switch / 运行日志维护 3 子表）+「成熟度与 CHECKPOINT 放行」节（CHECKPOINT 分类与放行 / L3 高风险路径 / 升级与降级 / maturity.json 维护 4 子表）
- `w-model-dev/references/data-models.md`：目录新增 3 行；文件末尾追加 `BudgetConfig` / `RunLogEntry` / `MaturityConfig` 三个 schema 节
- `w-model-dev/references/anti-patterns.md`：目录新增「运维失败模式清单（6 条运行健康 O1~O6）」行；文件末尾追加 O1~O6 完整定义表 + 检测信号与处理流程表 + 标注约定 + 与 loop-engineering 差异表
- `w-model-dev/references/definition-of-done.md`：五维度 → 六维度；自检清单新增「acknowledgedDecisions 已填入」项；反例引用更新
- `w-model-dev/references/verifier-spec.md`：§6.2「通过判定」改为 §6.3；在 §6.1 与 §6.3 之间插入 §6.2「summary 字段内容要求（阶段 digest 三要素）」
- `w-model-dev/references/subagent-delegation.md`：O 角色允许动作新增第 ⑦ 项「维护 budget.json / run-log.jsonl / maturity.json」；扩展读取列表包含 budget / run-log / maturity
- `AGENTS.md`：关键目录速查表 `w-model-dev/references/` 行扩展，新增 verifier-spec summary 阶段 digest 三要素 §6.2 / subagent-delegation O 维护 budget/run-log/maturity / definition-of-done 六维度含理解证据 / anti-patterns O1~O6 / operational-recovery 两节 / 数据模型 schema 说明

#### 设计原则兼容性

- **不内置 LLM 调用（约束 4）**：4 项优化均为声明式 JSON / 字段填写 / append-only 日志，无 LLM 调用；`budget.json` 的 `tokensEstimate` 由宿主 Agent 报告实际消耗（`estimated=false`），不引入 LLM 估算
- **CHECKPOINT 不可绕过（约束 2 + #8）**：L0~L3 阶梯是「选择性激活」而非「绕过」——决策型 CHECKPOINT 始终 attended，L3 高风险路径强制人工 gate，L1+ 自动放行仍在 run-log 记录保留可追溯性
- **编排者最小化（#10）**：budget / run-log / maturity 维护是编排者允许的状态文件读写动作，不涉及阶段产物（代码 / 文档 / 评审 JSON / RTM 实体）的越权产出
- **SSoT 优先**：严格按 AGENTS.md「SSoT 优先」约束，先改 SSoT，再同步 w-model-dev/references/，最后同步 SKILL.md 与 AGENTS.md

#### 验证

- `npm run self-test` → 37/37 用例通过，退出码 0（10 Verifier + 7 Gate + 12 Graph + 8 TLA 样本回归基线未受影响）
- 4 项优化均为增量、声明式扩展，未触及任何 `check-*.ts` 脚本逻辑
- 文档一致性：SSoT §3.4.5 / §4A.2a / §4A.3 / §10.6 / §10A ↔ operational-recovery.md 两节 ↔ data-models.md 3 schema ↔ anti-patterns.md O1~O6 ↔ definition-of-done.md 六维度 ↔ verifier-spec.md §6.2 ↔ subagent-delegation.md O 角色扩展 ↔ SKILL.md 约束 2 + 快速自检 ↔ AGENTS.md 关键目录速查 均已双向同步

### W 模型 8 阶段端到端全量重跑（第四轮，删除全部产物后从零再实现）

> 2026-07-23 删除 `w-model-dev-demo/` 的 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/` 全部阶段产物（保留 `package.json`/`tsconfig.json`/`vitest.config.ts`/`node_modules`），按 W 模型 8 阶段 self-as-verifier 模式从零端到端重跑，验证信息流校验特性合入后技能编排端到端可用。所有门禁退出码 0，图谱零违反收敛。

#### 验证

- 单元测试：53/53 通过（独立再实现，第三轮 71→53），覆盖率 96.37% lines / 93.57% branches / 92.30% functions / 96.37% statements（第三轮 100% 全维度，仍 ≥ 80% 阈值）
- 集成测试：13/13 通过（零 mock，supertest 对真实 Express app）
- 系统测试：8/8 通过，P95 = 4.66ms（≤ 200ms，NFR-002 达标）
- 验收测试：15/15 通过，4/4 需求 RTM 覆盖率 100%
- 全量测试：`npm test` → 18 test files / 89 tests 全通过
- 自检基线：`npm run self-test` → 29/29 通过，退出码 0
- 工件质量门：`npm run check:gate -- w-model-dev-demo` → 通过，退出码 0（RTM 100% + 单元覆盖率 96.37% + 四级测试全通过）

#### 阶段门评审（8 阶段全部 qualityLevel=A）

| 阶段 | compositeScore | 图谱节点/边 | 信息流违反 | 门禁退出码 |
|---|---|---|---|---|
| 1 需求分析 | 0.897 | 7 / 15 | 0 | 0 |
| 2 系统设计 | 0.891 | 19 / 70 | 0 | 0 |
| 3 概要设计 | 0.8895 | 31 / 125 | 0 | 0 |
| 4 详细设计 | 0.8995 | 43 / 182 | 0（1 轮收敛） | 0 |
| 5 编码 | 0.91 | N/A | N/A | 0 |
| 6 集成测试 | 0.9345 | N/A | N/A | 0 |
| 7 系统测试 | 0.9375 | N/A | N/A | 0 |
| 8 验收测试 | 0.9405 | N/A | N/A | 0 |

#### 图谱校验关键回归点（信息流校验特性）

- 阶段 1：REQ 节点信息流闭合，EXT-IN/EXT-OUT 边界完整
- 阶段 2：8 个 SD 节点均有 implements 追溯边（`SD_without_implements=0`）
- 阶段 3：12 个 INTF 节点均有 defines 追溯边（`INTF_without_defines=0`）
- 阶段 4：12 个 DD 节点均有 realizes 追溯边（`DD_without_realizes=0`），零违反硬约束达成放行进编码
- 全阶段：无黑洞/奇迹/死模块（`blackHoles=[]`/`miracles=[]`/`deadModules=[]`），边界完整

#### 变更

- `AGENTS.md` §4 端到端调测结论表更新为第四轮结果（2026-07-23）：测试计数、覆盖率、新增「图谱校验」与「全量测试」行；保留第二/三轮缺陷修正史
- `w-model-dev-demo/` 全部阶段产物从零再实现（`.w-model/`/`docs/`/`src/`/`tests/`/`coverage/`）

#### 与第三轮差异说明

第三轮（2026-07-23 早些时候）为增量更新既有产物；第四轮为全量删除后独立再实现，单元测试粒度与覆盖率与第三轮不完全一致（71→53、100%→96.37%），但均满足 NFR-004 ≥ 80% 阈值，且集成/系统/验收测试计数不变，所有门禁退出码仍为 0。本轮未引入新缺陷。

### W 模型 8 阶段端到端调测重跑（第三轮，含信息流校验特性）

> 2026-07-23 重跑 `w-model-dev-demo/` 全套测试与门禁脚本，验证信息流校验特性合入后端到端仍可用。所有门禁退出码 0，覆盖率提升至 100%。

#### 验证

- 单元测试：71/71 通过（第二轮 65→71），覆盖率 100% lines / 100% branches / 100% functions（第二轮 98.96% / 93.23% / 100%）
- 集成测试：13/13 通过（第二轮 12→13）
- 系统测试：8/8 通过（第二轮 6→8），P95 = 3ms（≤ 200ms）
- 验收测试：15/15 通过，4/4 需求 RTM 覆盖率 100%
- 自检基线：`npm run self-test` → 29/29 通过，退出码 0
- 工件质量门：`npm run check:gate -- w-model-dev-demo` → 通过，退出码 0（RTM 100% + 单元覆盖率 100%）

#### 变更

- `AGENTS.md` §4 端到端调测结论表更新为第三轮结果（2026-07-23）：测试计数、覆盖率、新增「自检基线」行；保留第二轮缺陷修正史

### 信息流校验增强（黑洞 / 奇迹 / 死模块门禁）

> 为图谱门禁新增与结构门禁正交的信息流校验层：任何软件系统都不是黑洞或奇迹，也不存在无信息流经的模块。
> 新增 `produces`/`consumes` 信息流边 + `EXT-IN`/`EXT-OUT` 显式边界节点（DFD terminator），检测黑洞（只进不出）/ 奇迹（只出不进）/ 死模块（无流经）三类信息流反常。
> 阶段 1 REQ 信息流闭合（严格），阶段 4 信息流零违反 + 结构零违反才放行进编码。全程确定性算法，无 LLM；收敛判定仍由 G 跑 `check-requirement-graph.ts` 退出码决定。

#### 新增

- **graph-logic.ts 信息流校验**：`NodeType` 加 `EXT-IN`/`EXT-OUT`；`EdgeType` 加 `produces`/`consumes`；新增 `DataflowViolations`（blackHoles/miracles/deadModules）+ `BoundaryInfo`（extIn/extOut/complete）接口；单根计算豁免边界节点；信息流校验仅对业务节点（REQ/SD/INTF/DD，phase≤当前）判定黑洞/奇迹/死模块 + 边界完整性（EXT-IN≥1 ∧ EXT-OUT≥1）；`passed` 汇总加 `dataflowOk`
- **check-requirement-graph.ts CLI 输出**：人类可读段加信息流违反行 + 边界完整性行；`GRAPH_JSON` 摘要加 `dataflowViolations`/`boundary` 字段
- **4 个信息流样本**：`bad-blackhole.json`（黑洞）/ `bad-miracle.json`（奇迹）/ `bad-dead-module.json`（死模块）/ `valid-dataflow.json`（phase=4 完整图谱）；`valid-graph.json` 按方案 A 补信息流边与边界节点
- **self-test 用例 25→29（+4）**：新增 4 条 Graph 样本用例，覆盖三类信息流违反 + 正常态
- **反模式 #13**：anti-patterns.md 新增「信息流黑洞/奇迹/死模块放行」（反模式清单 / 命中高发阶段表 / 门禁脚本对应表 / 检测信号表 / 详解小节）
- **graph-guide.md「信息流模型」节**：三不变量（黑洞/奇迹/死模块）+ 边界节点 + 方向约定 + 跨阶段收敛 + 与结构门禁的正交性
- **A 子代理信息流边提取规则**：ingestion-chunk.md 加 produces/consumes/EXT-IN/EXT-OUT 提取规则；ingestion-cross.md 加跨块去重与 reworkHints 规则
- **设计文档**：`docs/information-flow-validation-design.md`（信息流校验层设计 spec）

#### 变更

- `w-model-dev/SKILL.md`：快速自检加「信息流无黑洞/奇迹/死模块 + 边界完整」项
- `docs/skill-design-document_SSoT.md`：§7.7 graph.json schema 加信息流边与边界节点；§10.7 图谱门禁加信息流校验算法 + 跨阶段收敛；§10A 追溯表更新；守护反模式引用补 #13
- `docs/ingestion-graph-convergence-design.md`：§2.1 节点类型表加 EXT-IN/EXT-OUT；§2.3 边类型表加 produces/consumes；§3.2 算法加信息流校验步骤 6-8；§3.4 收敛准则加信息流层；§3.5 对照表加信息流闭合行
- `AGENTS.md`：§2 scripts/ 行加信息流校验描述；anti-patterns 计数 12→13；self-test 计数 25→29
- `README.md`：anti-patterns 计数 12→13；graph-logic.ts 描述加信息流校验；相关文档列表加信息流设计文档
- `docs/INSTALL.md`：§3 目录结构补 graph-logic.ts / check-requirement-graph.ts；§7 目录速查补图谱门禁条目

#### 验证

- `npm run self-test` → 29/29 用例通过，退出码 0（10 Verifier + 7 Gate + 12 Graph）
- 三条 bad 样本（bad-blackhole/bad-miracle/bad-dead-module）退出码 1，各自 `dataflowViolations` 对应数组含 REQ-001
- `valid-dataflow.json` + `valid-graph.json`（补边后）phase=4 退出码 0，信息流零违反 + 边界完整
- 旧 7 条 bad 样本仍按原期望失败（信息流校验只增不减违反项，结构违反文案不变）
- 文档一致性：SSoT §7.7/§10.7 ↔ ingestion 设计 §2.1/§2.3/§3.2/§3.4 ↔ graph-guide.md ↔ anti-patterns.md #13 ↔ ingestion-chunk/cross.md ↔ SKILL.md ↔ AGENTS.md ↔ README.md ↔ INSTALL.md 均已同步

### ingestion 子流程与图谱门禁（A 角色 + graph.json + check-requirement-graph.ts）

> 为阶段 1–4（需求分析 → 系统设计 → 概要设计 → 详细设计）新增 ingestion 子流程与分析子代理（A 角色），引入 graph.json 结构层图谱与 check-requirement-graph.ts 图谱门禁，实现「超大/多目录文档分块分析 → 交叉合并 → 图谱演进 → 结构连通性门禁」闭环。
>
> 五角色架构 O/A/S/V/G：A 为阶段 1–4 分析子代理（分块分析 / 交叉合并 / 图谱演进），与 S（产出）/ V（评审）/ G（门禁）协同；编排者 O 不得越权。阶段 1 走 A→S 路径（A 先提取 REQ 节点，S 再产出需求规格），阶段 2/3/4 走 S→A 路径（S 先产出正式设计文档，A 再分块提取 SD/INTF/DD 节点）。
>
> 收敛判定由 G 跑 check-requirement-graph.ts 退出码决定，不由 A 的 LLM 输出决定（约束 4，反模式 #12）。阶段 4 零违反（DD realizes 全覆盖）才放行进阶段 5 编码。

#### 新增

- **A 角色（分析子代理）**：SSoT §3.4.2 角色划分表加 A 行（与 subagent-delegation.md 一致）；subagent-delegation.md 加 A-chunk / A-cross/A-evolve 分派模板与回填契约；SKILL.md「编排者-子代理边界」节同步
- **graph-logic.ts + check-requirement-graph.ts**：图谱结构门禁纯逻辑 + CLI（连通性 / 单根 / 父唯一性 / 阶段递进追溯 implements/defines/realizes），退出码 0/1/2；package.json 加 `check:graph` 快捷脚本
- **plan-chunks.ts**：ingestion 分块策略（混合：文件/目录 + 超限拆分），供编排者分派 A-chunk 前调用
- **ingestion-chunk.md + ingestion-cross.md + graph-guide.md**：A 子代理参考文档（分块分析细则 / 交叉合并与图谱演进细则 / 图谱门禁与收敛准则）
- **graph.json schema**：结构层图谱（nodes/edges/analysisRounds），与 rtm.json 追溯层并存；SSoT §7.7 摘要，权威定义在设计文档 §2.4
- **阶段 4 零违反硬约束**：`--phase=4` 零违反（DD realizes 全覆盖）才放行进阶段 5 编码；SSoT §4.4 + §10.7
- **self-test 用例 17→25（+8）**：新增 8 条 Graph 样本（samples/graph/），覆盖连通/单根/父唯一/阶段追溯各校验路径
- **设计文档**：`docs/ingestion-graph-convergence-design.md`（A 角色 / graph.json schema / 校验算法 / 收敛准则 / 文件清单 / 失败模式）

#### 变更

- `w-model-dev/references/anti-patterns.md`：反模式清单从 10 条扩到 12 条（#11 ingestion 跳过图谱校验 / #12 A 自评收敛）；命中高发阶段表 / 门禁脚本对应关系表 / 检测信号与回退命令表 / 门禁脚本退出码精确对应表 / F1-F10 失败模式表均同步登记 #11/#12 + check-requirement-graph.ts
- `w-model-dev/references/workflow.md`：流程图阶段 1–4 加 ingestion 标注（A 图谱: REQ/SD/INTF/DD 节点 + 校验）；阶段产物清单表加 graph.json；反模式表加 #11/#12 行
- `w-model-dev/references/command-reference.md`：`/wm analyze` 加 `ingestion` 字段（A→S 路径，plan-chunks → A-chunk → A-cross → G 图谱校验 → 收敛循环）；`/wm design` 加 `ingestion` 字段（S→A 路径，按 type 追加 SD/INTF/DD 节点，详细阶段零违反硬约束）
- `w-model-dev/references/subagent-delegation.md`：角色划分表加 A 行；目录加 A-chunk / A-cross/A-evolve 分派模板
- `w-model-dev/examples/requirement-analysis.md`：追加「示例：超大/多目录文档 ingestion」节（完整交互样例：分块规划 CHECKPOINT → 并行 A-chunk → 收敛循环 → 收敛确认 CHECKPOINT → S 产出）
- `docs/skill-design-document_SSoT.md`：§3.4.2 标题改为「四层子代理 + 编排者：O / A / S / V / G」+ 角色表加 A 行；§4.4 新增 ingestion 子流程节；§7.7 新增 graph.json schema；§10.7 新增图谱门禁；§10A 追溯表加 §7.7 / §10.7 行 + §3.4 行更新为五角色 + #10/#11/#12
- `AGENTS.md`：§2 关键目录速查表 scripts/ 行加 graph-logic.ts / check-requirement-graph.ts / plan-chunks.ts；references/ 行加 ingestion-*.md / graph-guide.md + anti-patterns 计数 10→12 + O/A/S/V/G；§3 常用命令加 check:graph + self-test 计数 17→25
- `README.md`：运行门禁校验脚本节加 check:graph（npm run + npx tsx 两种方式）；项目结构树加 graph-logic.ts / check-requirement-graph.ts / plan-chunks.ts / ingestion-*.md / graph-guide.md；anti-patterns 计数 10→12；subagent-delegation O/S/V/G→O/A/S/V/G；相关文档列表加 ingestion-*.md / graph-guide.md / 设计文档

#### 验证

- `npm run self-test` → 25/25 用例通过，退出码 0（10 Verifier + 7 Gate + 8 Graph 样本回归基线）
- 文档一致性：SSoT §3.4.2 / §4.4 / §7.7 / §10.7 ↔ subagent-delegation.md ↔ anti-patterns.md #11/#12 ↔ graph-guide.md ↔ ingestion-chunk.md / ingestion-cross.md ↔ command-reference.md ↔ workflow.md ↔ AGENTS.md ↔ README.md 均已同步至 ingestion + 图谱门禁设计
- SSoT §10A 追溯表 §7.7 / §10.7 行与设计文档 §2.4 / §3 双向链接校验通过

### 编排者最小化（Orchestrator Minimization）

> 将「任何修改、编码、调测、分析、修正、验证都只允许子代理执行，编排者只进行编排，编排者工作最小化」作为强制约束纳入技能设计。
>
> 新增 O / S / V / G 四角色划分（编排者 / 产出子代理 / 评审子代理 / 门禁子代理），每阶段分派时序统一为 O 路由 → 🔴 CHECKPOINT → S 产出 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 放行 → O 持久化。违反约束命中反模式 #10「编排者越权实施」，回到当前阶段起点。
>
> 设计遵循「SSoT 优先 + 不内置 LLM 调用 + CHECKPOINT 不可绕过」三项硬约束：V 子代理即「外部 Agent 执行 LLM-as-a-Verifier」，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用；G 子代理跑确定性门禁脚本回填证据，与「真实执行」约束一致。

#### 新增

- `docs/skill-design-document_SSoT.md` §3.4「编排者-子代理边界」：设计目标 / O-S-V-G 角色表 / 每阶段分派时序 / 与现有约束兼容性 / 强制约束；§10A 追溯表登记 §3.4 行
- `w-model-dev/references/subagent-delegation.md`：编排者-子代理边界可执行细则（角色划分 / 每阶段分派时序 / S-V-G 三类子代理分派模板 / 回填契约 JSON / 强制约束 / 失败模式与回退 / 与 addyosmani 差异表）
- `w-model-dev/references/anti-patterns.md` #10「编排者越权实施」：反模式清单从 9 条扩到 10 条；新增检测信号（编排者会话出现 `Write`/`Edit` 写产物 / 直接产出 VerifierOutput JSON / `git diff` 含非状态文件改动）+ 回退动作（回到当前阶段起点，已越权产出的实体作废重做）；命中高发阶段表 / 与门禁脚本对应表 / 检测信号与回退命令表均同步登记 #10
- `w-model-dev/SKILL.md` 不可违反的约束新增第 8 条「编排者最小化」；新增「编排者-子代理边界」节（O/S/V/G 角色表 + 每阶段分派时序摘要 + 只读脚本例外 + 违反处置）；快速自检加编排者越权检查项

#### 变更

- `w-model-dev/SKILL.md` 执行工作流：从 8 步重写为 10 步（O/S/V/G 角色标注）；原步骤 6「执行阶段」（编排者直接产出）拆为步骤 6「分派 S 子代理产出」+ 步骤 7「分派 V 子代理评审」+ 步骤 8「分派 G 子代理门禁」；原步骤 7「验证与暂停」改为步骤 9「验证与暂停」（基于 G 返回值路由判定 + CHECKPOINT 等待）；命令速查表加「子代理分派」列；按需加载追加 subagent-delegation.md 入口
- `w-model-dev/references/workflow.md` 总体流程图加 O/S/V/G 角色标注；阶段产物清单表加「子代理分派」列（标注每阶段由哪些角色执行）；工作流常见反模式表加第 8 行（对应 #10）
- `w-model-dev/references/command-reference.md` 通用命令规则明确 O 边界（编排者只可读取/更新状态文件，不得修改 RTM 实体字段）；每个 `/wm` 命令加「执行方」字段，标注 S/V/G 分派与 O 持久化职责；`/wm review` 明确「编排者不得自评」；`/wm test` 禁止栏加「编排者越权回填 RTM 实体（反模式 #10）」
- `AGENTS.md` §1 仓库定位新增「编排者最小化」行 + LLM-as-a-Verifier / Agent Personas 描述改为「V 子代理执行」；§2 关键目录速查表 `w-model-dev/references/` 行补 subagent-delegation / anti-patterns 描述从 9 条改为 10 条；§6 行动约束新增「编排者最小化」条目
- `README.md` 核心能力新增「编排者最小化」一项 + LLM-as-a-Verifier / Agent Personas 描述改为「V 子代理执行」+ 反模式计数从 9 条改为 10 条；项目结构树补 `subagent-delegation.md` 条目；相关文档列表补 subagent-delegation.md 链接 + anti-patterns 描述更新到 10 条
- `docs/INSTALL.md` §1 架构定位补「编排者最小化」+ 校验脚本 / LLM-as-a-Verifier 描述改为「G 子代理 / V 子代理执行」；§3 安装后目录结构补 subagent-delegation.md + 编排者-子代理边界说明；§7 目录速查表补 subagent-delegation.md 行；§8 FAQ 新增「编排者-子代理边界如何工作」与「编排者能跑门禁脚本吗」两个问答

#### 设计要点

- **三层子代理 + 编排者（O/S/V/G）**：O 路由 + 状态 + CHECKPOINT + 持久化 + 只读脚本；S 产出（含跑测试运行器）；V 评审（按 Persona 路由）；G 门禁（跑脚本 + 回填证据）。
- **每阶段时序**：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 持久化。阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。
- **只读脚本例外**：O 可跑 `check-*.ts` 看退出码用于展示/路由判定，但**不替代 G 的回填**——G 子代理必须独立跑一次并产出证据摘要。
- **强制等级**：违反即命中反模式 #10，回到当前阶段起点，已越权产出的实体作废重做。
- **兼容性**：与现有约束 2/4/6/8、`verifier-spec.md` §7.6「外部 Agent 执行」、`agent-personas.md` 4 个 Persona 均不冲突；V 子代理即「外部 Agent」，G 子代理跑脚本回填证据 = 真实执行。

#### 验证

- `npm run self-test` → 17/17 用例通过，退出码 0（10 Verifier + 7 Gate 样本回归基线未受影响）
- 文档一致性：`docs/skill-design-document_SSoT.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/subagent-delegation.md`（新建）/ `anti-patterns.md` / `workflow.md` / `command-reference.md` / `AGENTS.md` / `README.md` / `docs/INSTALL.md` / `CHANGELOG.md` 均已同步至编排者最小化设计
- SSoT §3.4 ↔ `subagent-delegation.md` ↔ `SKILL.md`「编排者-子代理边界」节 ↔ `anti-patterns.md` #10 四向链接校验通过
- `command-reference.md` 各命令「执行方」字段与 `workflow.md` 阶段产物表「子代理分派」列一致

### 吸收 addyosmani/agent-skills 设计模式（P1 + P2）

> 将 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 中的 `using-agent-skills` 元技能（6 条核心操作行为 + 10 条失败模式）、`code-review-and-quality`（五轴评审 + Severity 标签 + Structural Remedies）、`references/definition-of-done.md`（项目级 DoD）、`agents/`（Agent Personas）、`docs/adoption-guide.md`（Greenfield vs Brownfield 采用路径）等设计模式吸收到本技能包。
>
> 吸收遵循「SSoT 优先 + 不内置 LLM 调用 + CHECKPOINT 不可绕过」三项硬约束：Persona 定义为「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown，不调用任何 LLM；失败模式与 9 条流程反模式二分（反模式=流程破坏回退，失败模式=行为退化登记）。

#### 新增

- `docs/skill-design-document_SSoT.md` §4A「核心操作行为与失败模式」：6 条核心操作行为（Surface Assumptions / Manage Confusion Actively / Push Back When Warranted / 等）+ 10 条失败模式 F1~F10
- `docs/skill-design-document_SSoT.md` §6.4「Agent Personas（评审角色提示词）」：三层架构（Skill / Persona / Command）+ 4 个 W 模型适配 Persona + 与 §7.6 LLM-as-a-Verifier 的路由关系
- `docs/skill-design-document_SSoT.md` §7.6「五轴评审」：Correctness / Readability / Architecture / Security / Performance 五轴 + Severity 标签（Critical / Required / Optional / Nit / FYI）+ Structural Remedies
- `docs/skill-design-document_SSoT.md` §10.6「项目级 Definition of Done」：5 维度 DoD（功能 / 质量 / 测试 / 文档 / 部署）
- `docs/skill-design-document_SSoT.md` §11A「采用路径（Greenfield vs Brownfield）」：路径选择信号表 + Day 0 全流程 + 增量验证优先 + 收敛表
- `w-model-dev/references/agent-personas.md`：4 个评审角色提示词（code-reviewer / test-engineer / security-auditor / performance-auditor），含 JSON 输出格式、评审规则、组合节、与 addyosmani 差异表；performance-auditor 直接吸收 Metric-Honesty Rule
- `w-model-dev/references/definition-of-done.md`：项目级 DoD（5 维度），SSoT §10.6 为权威定义
- `w-model-dev/references/verifier-spec.md` §7.4A：五轴评审 + Severity 标签 + Structural Remedies（与 SSoT §7.6 双向追溯）
- `docs/adoption-guide.md`：人类可读采用指南（Greenfield Day 0 全流程 + Brownfield 增量验证优先 + 收敛表 + 与 addyosmani 差异表），SSoT §11A 为权威定义

#### 变更

- `w-model-dev/SKILL.md`：新增「核心操作行为」节（6 条）+ 「失败模式 F1~F10」节；YAML frontmatter `description` 同步
- `w-model-dev/references/anti-patterns.md`：新增「失败模式清单 F1~F10」节（10 条行为退化 + 与反模式对照表 + 标注约定 + 与 addyosmani 差异表）；目录同步更新；F# 重复命中 ≥2 次升级为 L# 教训
- `README.md`：项目结构树补 `agent-personas.md` / `definition-of-done.md` / `docs/adoption-guide.md`；`anti-patterns.md` 描述更新为「9 条流程反模式 + L1~L4 教训 + 失败模式 F1~F10」；`verifier-spec.md` 描述补「五轴评审 §7.4A」
- `AGENTS.md`：§1 仓库定位补 Agent Personas 行；§2 关键目录速查表 `w-model-dev/references/` 行补 agent-personas / definition-of-done / 失败模式 F1~F10 / command-reference / operational-recovery；§5 必读文档列表补 `docs/adoption-guide.md`

#### 与 addyosmani/agent-skills 的差异

- **不内置 LLM 调用**：addyosmani 的 Persona 可直接调用 LLM；本技能包 Persona 是「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown
- **Persona 不互相调用**：吸收 addyosmani 规则——组合由命令或用户完成；`code-reviewer` 发现安全问题时在 `reworkHints` 中以「[建议 security-auditor 深审] xxx」前缀呈现，不自动调用
- **失败模式与反模式二分**：反模式=流程破坏（命中即回退），失败模式=行为退化（命中不回退但登记）；F# 重复命中 ≥2 次升级为 L# 教训，并在 SSoT §10B.4 同步登记
- **performance-auditor 适配 W 模型后端场景**：借鉴 addyosmani `web-performance-auditor` 但扩展为前端+后端双场景；Quick 模式（无工具工件）退化为源代码结构反模式扫描；直接吸收 Metric-Honesty Rule（永不编造指标，无工具数据时标 `not measured`）
- **Persona 产出与 §7.6 Schema 对齐**：Persona 产出的 JSON 必须满足 `verifier-spec.md` §7 Schema，Severity 标签作为 `reworkHints` 字符串前缀，不新增 Schema 字段
- **采用路径适配 W 模型 8 阶段**：Greenfield 路径按 8 阶段顺序执行；Brownfield 路径分 4 Phase（上下文与只读 / 先测试后改动 / 新工作跑全流程 / 偿还债务废弃观测）

#### 验证

- `npm run self-test` → 17/17 用例通过，退出码 0（10 Verifier + 7 Gate 样本回归基线未受影响）
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/agent-personas.md` / `definition-of-done.md` / `anti-patterns.md` / `verifier-spec.md` / `docs/adoption-guide.md` 均已同步至 addyosmani/agent-skills 吸收后状态
- SSoT §6.4 ↔ `agent-personas.md` 双向链接校验通过
- SSoT §11A ↔ `docs/adoption-guide.md` 双向链接校验通过
- SSoT §4A ↔ `anti-patterns.md`「失败模式清单 F1~F10」双向链接校验通过
- SSoT §7.6 ↔ `verifier-spec.md` §7.4A 双向链接校验通过
- SSoT §10.6 ↔ `definition-of-done.md` 双向链接校验通过

### 端到端调测第二轮：从零重建 + k6 性能基线 + 文档全面同步

> 通过完全清空 [`w-model-dev-demo/`](./w-model-dev-demo) 后按 W 模型 8 阶段从零重建，
> 验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可重复执行；
> 并通过回归测试发现 3 项工程配置缺陷（JWT_SECRET 缺失 / ArticleService 类型导出 / vitest mock 类型），
> 修复后纳入 [`w-model-dev/references/anti-patterns.md`](./w-model-dev/references/anti-patterns.md)「实现层经验教训」L2~L4。

#### 新增

- `w-model-dev-demo/tests/perf/k6-load-test.js`：k6 性能基线脚本（100 VUs × 30s，P95 < 200ms，覆盖文章列表 / 详情 / 登录）
- `w-model-dev-demo/tests/perf/README.md`：k6 安装 / 运行 / 解读说明（k6 是独立二进制，不纳入 npm 自动化链路）
- `w-model-dev-demo/tests/unit/validate.test.ts`：validate 中间件单元测试 13 用例（UT-031~043），行覆盖率 0% → 100%
- `w-model-dev-demo/tests/unit/jwt.utils.test.ts`：补充 5 边界用例（UT-031B~035B），branches 覆盖率 57.14% → 100%
- `w-model-dev-demo/tests/unit/password.utils.test.ts`：补充 3 边界用例（UT-024B~026B），branches 覆盖率 60% → 100%
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L2（模块加载阶段抛错）+ L3（service 类导出方式反复）+ L4（vitest mock 与 express 类型不兼容）三条教训，与 SSoT §10B.4 双向追溯

#### 变更

- `w-model-dev-demo/` 完全清空后从零重建：4 份设计文档（1021 行）+ 工程配置 + src/ 全部源码 + 9 单元测试文件
- `w-model-dev-demo/package.json`：所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入，修复 L2 缺陷
- `w-model-dev-demo/src/services/article-service.ts`：恢复 `export class ArticleService`，与 `export const articleService` 共存，修复 L3 缺陷
- `w-model-dev-demo/tests/unit/auth-middleware.test.ts` + `tests/unit/error-handler.test.ts`：用 `ReturnType<typeof vi.fn>` / `Mock` 类型断言访问 mock.calls，修复 L4 缺陷
- `w-model-dev-demo/.w-model/rtm.json`：RTM 终检状态更新，8 行需求 × 7 字段全部非空，coverage.rtmCoverage=100 / unitTestCoverage=99
- `w-model-dev-demo/.w-model/project.json`：`status` 改为「已完成」，新增 `completedAt` 与 `acceptance` 字段（用户 `confirm` 归档）
- `w-model-dev-demo/docs/acceptance-test-report.md` §9：用户确认区填入 `confirm`（2026-07-21）
- `w-model-dev-demo/docs/system-test-report.md` §5 + §9.3：k6 脚本引用更新为 `tests/perf/k6-load-test.js`
- `w-model-dev-demo/docs/system-test-cases.md` ST-003：增加「工具」字段，注明 k6 设计原意 + vitest CI 近似验证
- `README.md`：参考实现节调测数据从 2026-07-20 baseline 更新到 2026-07-21 第二轮（65 单元 + 12 集成 + 6 系统 + 15 验收 = 98 测试，覆盖率 98.96%）；项目结构树补 `tests/perf/` 与 `.w-model/`
- `AGENTS.md` §4：参考实现调测数据同步更新；新增 4 项缺陷修正记录
- `docs/skill-design-document_SSoT.md` §1.4 + §10B 1-6 小节：全面重写，新增调测轮次 / 用户确认 / 4 项缺陷 / k6 边界声明
- `docs/INSTALL.md` §8 FAQ：调测数据同步更新，补 4 项缺陷与 L1~L4 指针

#### 端到端调测结论（2026-07-21 第二轮）

| 指标 | 目标 | 实测 | 与 baseline（2026-07-20）对比 |
|---|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 65/65 通过，98.96% lines / 93.23% branches / 100% functions | 用例数 +43，覆盖率 lines -0.04pp（仍远超阈值） |
| 集成测试 | 100% 通过 | 12/12 通过 | 用例数 +6 |
| 系统测试 | 100% 通过 | 6/6 通过 + k6 脚本就绪 | 持平 + 新增 k6 |
| 验收测试 | 100% 通过 | 15/15 通过 + 用户 `confirm` 归档 | 持平 + 归档 |
| RTM 需求覆盖率 | 100% | 4/4（100%） | 持平 |
| 工件质量门 | 退出码 0 | 通过（退出码 0） | 持平 |
| TypeScript 严格编译 | 0 错误 | 退出码 0 | 持平 |
| 性能基线 | P95 ≤ 200ms | k6 脚本就绪，vitest 近似采样 P95=3ms | 新增 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 98 用例全过（65 unit + 12 integration + 6 system + 15 acceptance）
- `w-model-dev-demo/` 内 `npm run coverage` → 总覆盖率 98.96% lines / 93.23% branches / 100% functions
- `w-model-dev-demo/` 内 `npx tsc --noEmit` → 退出码 0
- `w-model-dev-demo/` 内 `npx tsx ../w-model-dev/scripts/check-artifact-gate.ts .` → 退出码 0
- `tests/perf/k6-load-test.js` 通过 `node --check` 语法校验
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `w-model-dev/references/anti-patterns.md` 均已同步至 2026-07-21 第二轮数据
- SSoT §10B.4 与 anti-patterns.md「实现层经验教训」节 L1~L4 双向链接校验通过

### 端到端调测：交付博客系统参考实现 + 文档同步

> 通过 [`w-model-dev-demo/`](./w-model-dev-demo) 完整跑通 W 模型 8 阶段端到端调测，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用，并把调测结论与缺陷修正经验同步到全仓库文档。

#### 新增

- `w-model-dev-demo/`：博客系统后端参考实现（Express 4 + TypeScript 5 + 内存存储）
  - 8 阶段产出文档：`docs/`（需求规格 / 系统设计 / 概要设计 / 详细设计 + 四级测试用例与报告）
  - 可运行代码：`src/`（控制器 / 服务 / 存储 / 中间件，含 `utils/async-handler.ts` 缺陷修正产物）
  - 四级测试：`tests/`（unit 22 / integration 6 / system 6 / acceptance 15）
  - 独立 `package.json` / `tsconfig.json` / `vitest.config.ts`，与仓库根工具链解耦
- `AGENTS.md`：仓库根级 AI Agent 导航（与 README 互补，聚焦 Agent 行动所需最小事实集）
- `docs/skill-design-document_SSoT.md` §10B「参考实现（端到端调测验证）」：6 个子节，含项目概况 / 8 阶段产出对应 / 调测结论摘要 / 缺陷与修正 / 与 SSoT 章节映射 / 边界声明
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L1（Express 4 async handler 不自动 catch）+ 扩展规则（与 SSoT §10B.4 双向追溯）

#### 变更

- `README.md`：新增「参考实现：`w-model-dev-demo/`」节（含调测结论表 + 缺陷修正指针）；项目结构补 `w-model-dev-demo/` / `.githooks/pre-push` / `AGENTS.md`；相关文档列表补 AGENTS.md 与参考实现两项
- `docs/skill-design-document_SSoT.md` §1.4：增加参考实现指针
- `docs/INSTALL.md` §7 目录速查：补「参考实现」与「Agent 仓库导航」两行；§8 FAQ 新增「哪里可以看到 W 模型 8 阶段的完整端到端产出样本？」
- `CONTRIBUTING.md`「项目结构约定」：补 `w-model-dev-demo/` 条目与边界声明；「SSoT 原则」同步链路补 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`

#### 端到端调测结论（2026-07-20）

| 指标 | 目标 | 实测 |
|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 22/22 通过，覆盖率 98% |
| 集成测试 | 100% 通过 | 6/6 通过（含 L1 缺陷修正） |
| 系统测试 | 100% 通过 | 6/6 通过 |
| 验收测试 | 100% 通过 | 15/15 通过 |
| RTM 需求覆盖率 | 100% | 4/4 需求 100% |
| 工件质量门 | 退出码 0 | 通过 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 全部四级测试通过
- 文档一致性：`grep -rE "w-model-dev-demo"` 在 `README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `w-model-dev/references/anti-patterns.md` 均有正确指针；无断链
- SSoT §10B 与 anti-patterns.md「实现层经验教训」节双向链接校验通过

### CI 改为本地推送前门禁

> 远程 GitHub Actions runner 始终无法分配（多次运行卡在 Queued，与代码无关），
> 改为本地 git `pre-push` hook 承载门禁职责，等价覆盖原 CI 的 5 项检查。

- 删除 `.github/workflows/ci.yml`，关闭远程 CI
- 新增 `.githooks/pre-push`：在 `git push` 时自动跑 self-test + 4 项 CLI 退出码冒烟，任一不符预期即中止推送
- 仅当本次推送触及 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 时才跑门禁，纯文档改动直接放行
- `package.json` 新增 `setup:hooks`（一次性启用 hook）与 `prepush`（手动跑全部门禁）快捷脚本
- `CONTRIBUTING.md` 同步说明启用与临时跳过（`git push --no-verify`）方式

### 大规模 Review 优化（P0-P3 共 18 项）

> 基于全项目 Review 报告，按优先级 P0×3 / P1×4 / P2×6 / P3×5 修复一致性、健壮性与可维护性问题。

#### P0 关键正确性

- 修复 `verifier-spec.md` §4.1/§4.2 字母语义与 §6.1 冲突：统一为 `A=完全达成 / D=完全未达成`，公式改为 `1.00*p_A + 0.67*p_B + 0.33*p_C + 0.00*p_D`
- 修复 `verifier-logic.ts` ranking.k/rounds 整数性校验缺失：增加 `Number.isInteger()` + 数值边界（k ∈ [2,1000]、temperature ≤ 100、rounds ≥ 1）
- 修复 `gate-logic.ts` RTM JSON 结构校验缺失：缺 `executionSummary` 时不再抛 TypeError，改为返回结构化 reasons；新增 `rows` / `executionSummary.<type>` / 行对象分层校验

#### P1 一致性

- 统一覆盖率表述：85 处「覆盖率」歧义区分为「单元测试代码覆盖率 ≥ 80%」与「RTM 需求覆盖率 100%」两个独立指标（涉及 SKILL.md / SSoT / phase-5/7/8 / verifier-spec / rtm-guide / quality-standards / templates / examples / scripts）
- 统一测试用例 ID 命名规则：阶段 6/7/8 执行用例从 `TC-INT/SYS/UAT-*` 改为 `IT/ST/UAT-*` 与 RTM 短形式一致；在 `rtm-guide.md` 增加命名规则章节说明两套 ID 体系（运行时 vs 阶段产物验证）
- SSoT §6.1 核心命令表列名「返回值」→「产出」
- `verifier-logic.ts` ranking.k/temperature 增加上界校验（防滥用：MAX_RANKING_K=1000、MAX_TEMPERATURE=100）

#### P2 健壮性与可维护性

- 去重验收检查清单：`SKILL.md` 项目级清单从 12 项压缩为核心 4 项 + 指针，避免与 `phase-8-acceptance-test.md` 重复
- 处理 `.claude/skills/darwin-skill/` 评估产物：迁移至 `eval/`，`.claude/` 加入 `.gitignore`
- 增加校验脚本样本测试：新增 `w-model-dev/scripts/samples/`（verifier 7 条 + gate 4 条共 11 条端到端样本）+ `self-test.ts` 自动跑通所有样本作为回归基线
- 统一 `verifier-spec.md` §8 占位符列表
- 拆分 `phase-1-requirements.md`「可选：需求形式化」节到独立文件
- `verifier-logic.ts` `varianceThreshold` 缺失时改为判失败而非警告

#### 验证

- `npx tsx w-model-dev/scripts/self-test.ts` → 11/11 通过
- `npx tsx w-model-dev/scripts/check-verifier-output.ts <sample.json>` 通过 / 失败路径均符合预期

### 一致性补全：命令执行规则与示例覆盖

> 全面扫描后发现 SKILL.md（Agent 实际读取的入口）在若干命令执行规则上与 SSoT / README / verifier-spec.md 不一致或不完整，本次补全使 10 个 `/wm` 命令均有可执行规则，并消除文档间不一致。

#### 新增

- `w-model-dev/SKILL.md` §5「`/wm test` 结果回填机制」：明确 `result=pass|fail` 必填、真实回填约束、与工件质量门的有效性关联（之前只在 README / SSoT / 脚本注释中说明，SKILL.md 自身缺失）
- `w-model-dev/SKILL.md` §6「辅助命令执行规则」：补全 `/wm review` / `/wm status` / `/wm help` / `/wm reset` / `/wm export` / `/wm import` 六个命令的详细执行步骤与 CHECKPOINT
- `w-model-dev/SKILL.md` §4「数据与状态管理」：补充 `.w-model/` 持久化目录结构与文件用途
- `w-model-dev/examples/test-execution.md`：新增测试执行阶段示例（phase 6 集成 / phase 7 系统 + 质量门 / phase 8 验收 + 项目交付），覆盖 `result=pass|fail` 回填、根因分析、CHECKPOINT 放行全流程

#### 变更

- `w-model-dev/SKILL.md` 命令接口表：
  - `/wm test` 参数补充 `result: pass / fail（必填，真实回填）`，产出列补充「RTM 状态更新」
  - `/wm review` 的 `target` 前缀由 `REQ-/SD-/AT-/文件路径` 修正为 `REQ- / DESIGN- / UAT- / ST- / IT- / UT- / 文件路径`，与 `references/verifier-spec.md` §2 权威定义一致
  - `/wm status` 产出列补充「RTM 覆盖率」
- `w-model-dev/SKILL.md` YAML frontmatter `description`：命令列表由 6 个（analyze/design/code/test/review/status）补全为 10 个（增加 help/reset/export/import），影响 Agent 自动激活触发判断
- `docs/skill-design-document_SSoT.md` §6.1 核心命令表：
  - `/wm design` 的 `type` 由 `(架构/详细)` 修正为 `(架构/概要/详细)`，与 SKILL.md / README 一致
  - `/wm test` 的 `type` 由 `(单元/集成/系统)` 修正为 `(单元/集成/系统/验收)`，并补充 `result` 参数
  - `/wm status` 返回值补充「RTM 覆盖率」
- `docs/skill-design-document_SSoT.md` §10A 追溯表：`6 命令接口` 行的实现位置补充「指令（执行规则）§5 `/wm test` 回填机制 + §6 辅助命令执行规则」
- `docs/skill-design-document_SSoT.md` 附录 A 命令速查：补全遗漏的 3 个命令（`/wm reset` / `/wm export` / `/wm import`），并修正 `/wm design` / `/wm test` 的参数格式
- `CONTRIBUTING.md`「添加新命令」节：删除旧架构残留的 `helpHandler` 引用，改为指向 SKILL.md「指令（执行规则）§1/§2/§3/§6」与 SSoT §6.1 / §6.2 / 附录 A 的同步更新流程

#### 验证

- `grep -E "helpHandler|REQ-/SD-/AT-|设计类型\(架构/详细\)|测试类型\(单元/集成/系统\)"` 在保留文件中无残留
- `npx tsx w-model-dev/scripts/check-verifier-output.ts` 退出码 2（输入错误，符合预期，未传文件）
- `npx tsx w-model-dev/scripts/check-artifact-gate.ts` 退出码 2（输入错误，符合预期，无 .w-model/rtm.json）
- 校验脚本未受影响：`verifier-logic.ts` `SUB_CRITERIA` 与 `verifier-spec.md` §7 完全一致（20/20 子标准）；`determineQualityLevel` 与 §6.1 完全一致
- 所有内部 Markdown 链接目标文件均存在，无断链

### 架构纯化：移除全部编程式接入

> 把本仓库确定为「单纯的编排 + 校验脚本技能」，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。
> 技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> 此变更撤销了此前 [Unreleased] 阶段规划的「内置 `src/` TypeScript 引擎 + `tests/` 测试套件 + `package.json` 工具链」方向，回归纯技能包形态。

#### 删除（编程式引擎与 Node 工具链）

- `src/` 整块移除：`index.ts`、`commands/router.ts`、`state/{project-state,rtm-manager}.ts`、`types/index.ts`（`/wm` 命令路由、状态持久化、RTM 维护改由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态持久化到项目内 `.w-model/*.json`）
- `tests/` 整块移除：`command-router.test.ts`、`project-state.test.ts`、`rtm-manager.test.ts`、`verifier-logic.test.ts`
- `examples/run-wm-flow.ts` 移除（编程式示例，与新架构不符）
- Node 工程化文件移除：`package.json`、`package-lock.json`、`tsconfig.json`、`jest.config.js`、`.eslintrc.cjs`
- `docs/IMPLEMENTATION-PLAN.md` 移除（内置引擎路线图，已不适用）

#### 保留（自包含校验脚本）

- `w-model-dev/scripts/gate-logic.ts`：工件质量门纯逻辑（自包含，仅依赖本目录内文件）
- `w-model-dev/scripts/verifier-logic.ts`：Verifier 输出校验纯逻辑（自包含）
- `w-model-dev/scripts/check-artifact-gate.ts`：工件质量门 CLI（读 `.w-model/rtm.json`，退出码 0/1/2）
- `w-model-dev/scripts/check-verifier-output.ts`：Verifier 输出校验 CLI（防外部 Agent 输出漂移）
- 校验脚本运行依赖仅为 `tsx`（用户通过 `npx tsx` 或全局安装调用），无需 `npm install`

#### 变更（文档同步至纯技能架构）

- `w-model-dev/SKILL.md`：移除「实现位置 / 快速验证 / 编程式接入」尾部章节；文件清单注释中去除 `src/` 引用
- `README.md`：架构边界表「W 模型阶段编排」实现位置改为 `w-model-dev/SKILL.md` + `references/*`；快速上手改为「AI Agent 安装（零依赖）」+「运行门禁校验脚本」；移除「编程式接入」章节与 `src/` / `tests/` / `examples/run-wm-flow.ts` 结构条目
- `docs/INSTALL.md`：重写为单一安装路径（移除模式 B 程序化模式 / 模式 A+B 混合使用 / `npm install` / `createCommandContext` 示例）；新增「为什么没有 npm install / package.json」FAQ
- `docs/skill-design-document_SSoT.md`：§1.4 架构重构说明、§3.3 边界表、§6.3 时序图、§8.1 技术栈表、§10.5 / §10A 追溯表、§11 部署集成方案全面改为纯技能架构描述
- `docs/skill-design-document.md`：用途表「实现入口（TypeScript）| src/index.ts」改为「AI Agent 安装指南 | INSTALL.md」
- `docs/llm-verifier-integration-design.md`：移除「命令路由实现 | ../src/commands/router.ts」引用
- `CONTRIBUTING.md`：移除 `npm test` / `npm run lint` / `npm run typecheck` 工作流与覆盖率阈值；改为 `npx tsx` 端到端校验；新增「脚本不得 import `src/`」自包含规则
- `.gitignore`：移除 `node_modules/` / `dist/` / `build/` / `*.tsbuildinfo` / `coverage/` 等不再相关的条目

#### 验证

- `grep -rE "src/|createCommandContext|dispatch\(|程序化|编程式|模式 ?B|混合使用|npm (run|test|install)|npx (jest|tsc|eslint)"` 在保留文件中无残留编程式接入引用（仅保留明确否定句「不包含编程式接入」与历史 tombstone 说明）
- `w-model-dev/scripts/*.ts` 校验脚本自包含性确认（仅 `import ./gate-logic.js` / `./verifier-logic.js` 与 Node 标准库）

### 已撤销的方向（历史记录）

> 以下为此前 [Unreleased] 阶段规划的「内置 `src/` 引擎」方向，已被上方「架构纯化」整体撤销，所列文件均已删除，保留仅作历史记录。

- 内置 `src/core/*` LLM 评分 / 验证 / 排序 / 增强器 / 客户端 / 元技能配置
- 内置 `src/evolution/skill-optimizer.ts` SkillOpt ReflectTrainer 训练循环
- 内置 `src/eval/skill-lift.ts` ACES Skill Lift 评估
- `w-model-dev/scripts/check-skill-gate.ts` 技能验证门
- `w-model-dev/META-SKILL.md` 可演化元技能配置
- `tests/verifier-logic.test.ts` 等 11 个测试套件、163 个测试
- `examples/run-wm-flow.ts` 编程式全流程示例
- `npx tsc --noEmit` / `npx jest` / `npx eslint` / `npm run example:run` 验证链
- `docs/INSTALL.md` 模式 A / 模式 B 双路径与混合使用说明

## [0.1.0] - 2026-07-16

基于 [issue #5](https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack/issues/5)
的代码审查报告（评分 8.2/10）进行的项目扩大化优化首版。

### 新增

#### 核心引擎实现（issue Critical #1）
- 将 `llm-verifier-implementation-template.ts`（691 行模板）重构为模块化 `src/` 结构
- 实现 `LLMVerifierEngine`：基于 logits 期望值的连续评分，使用 log-softmax 保证数值稳定
- 实现 `VerificationFramework`：三维度验证（评分粒度 + 重复评估 + 标准分解）
- 实现 `PPTRanker`：O(N×k) 概率枢轴锦标赛排序算法
- 实现 `WModelVerifierEnhancer`：需求 / 设计 / 测试用例三阶段验证增强器

#### LLM Verifier 鲁棒性（issue High Priority #2）
- 新增 `fallbackStrategy` 配置：`text-parse` / `discrete` / `throw`
- 当 LLM 不支持 logits 时自动回退，解析字母（A-T）或数字并加稳定扰动
- `MockLLMClient` 支持模拟 logits / scoreLabel，便于离线测试
- `HttpLLMClient` 骨架，支持自部署推理服务（vLLM / TGI）

#### 状态持久化（issue Critical #2）
- 新增 `ProjectStateManager`：JSON 文件持久化（`.w-model/project.json`）
- 支持项目 / 需求 / 设计 / 测试用例 CRUD，自动 ID 生成
- W 模型阶段合法性校验（禁止跨阶段推进，允许回退返工）
- `exportJSON` / `importJSON` 支持项目迁移

#### RTM 自动化（issue Critical #2 + Medium #1）
- 新增 `RTMManager`：从 `ProjectStore` 自动重建需求跟踪矩阵
- 双向追溯：需求 ↔ 设计 ↔ 代码 ↔ 四级测试用例
- 覆盖率自动统计与缺失列告警
- 质量门检查：覆盖率 100% + 所有测试通过
- Markdown 导出（套用 `templates/rtm.md` 格式）
- 变更日志记录

#### /wm 命令路由（issue Critical #2）
- 新增 `commands/router.ts`：10 个命令（analyze / design / code / test / review / status / help / reset / export / import）
- 阶段校验：确保命令在合法阶段执行
- 实体登记：自动关联需求 ↔ 设计 ↔ 测试用例，保证 RTM 双向追溯
- 验证触发：analyze / design / review 时自动调用 LLM Verifier
- 质量门：验收测试阶段自动检查

#### 测试与覆盖率（issue 验收标准）
- 119 个单元测试，覆盖所有核心模块
- 全局分支覆盖率 83.58%（目标 ≥ 70%）
- 核心模块分支覆盖率 91.89%（目标 ≥ 85%）
- TypeScript 严格模式，`tsc --noEmit` 通过

#### 示例与文档
- 新增 `examples/run-wm-flow.ts`：W 模型 8 阶段全流程示例
- 新增 `README.md`：项目导航与快速上手
- 新增 `CONTRIBUTING.md`：贡献指南
- 新增 `IMPLEMENTATION-PLAN.md`：实现路线图
- 新增 `CHANGELOG.md`：本文件

### 变更

#### 文档同步（issue High Priority #1）
- `skill-design-document.md` 精简为指向 SSoT 的指针文档（570 行 → 37 行）
- 统一以 `skill-design-document_SSoT.md` 为单一事实来源

### 工程化
- 新增 `package.json`：ESM 模块，TypeScript 5.4，Jest + ts-jest
- 新增 `tsconfig.json`：ES2020 target，Bundler resolution，strict mode
- 新增 `jest.config.js`：覆盖率阈值配置（全局 70%，核心 85%）
- 新增 `.eslintrc.cjs`、`.gitignore`
