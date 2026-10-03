# 阶段多角色讨论分析机制设计规格（阶段角色集矩阵 + A-lead 协议 + 机器门禁 + 研制要求）

> **日期**：2026-10-03
> **状态**：D1-D8 已裁定（D1-D3 用户三项裁定 + D4-D8 按推荐采定），待用户审查后进入实现计划
> **来源**：用户 2026-10-03 规范模型指令（需求/设计/详细设计的多角色参与模型，含逐阶段角色集）——独立立项，**不属五批次吸收计划**（五批次与收口文档已全部合入 main，42.10.1）
> **定位**：本机制把「阶段产出前由多领域角色讨论分析」纳入 W 模型阶段 1-4 时序；编排者最小化架构不变——讨论=分析动作（A 侧多视角 persona），落笔=S 唯一产出，评审=V（含新覆盖核验），判定=G

---

## 0. 问题定义（现状对照结论）

- **阶段 1-4 无多角色讨论分析机制**：现状 O 路由 → 单一 A 子代理分析 → S 产出 → V/G 评审。phase-2 细则 grep「角色/参与/讨论/多角色」零命中——设计/需求产出前无「多领域角色讨论→需求分解」协议。多视角分派机制形态已存在（`agent-personas.md` R-persona 两键矩阵、V-lead 多角度选择矩阵）但 scoped 到 R/V，未到 A/S 产出侧。
- **人格库缺 3 类角色**：需求分析师、测试经理、算法专家无对应人格（其余 5 类——系统架构师/产品经理/UX/数据库专家/软件工程师——已有 `engineering-software-architect` / `product-manager` / `design-ux-architect` / `engineering-database-optimizer` / `engineering-senior-developer`）。
- **「研制要求」零承载**：全仓无该字样；阶段 1 有 `requirement-spec.md` 主模板（需求说明书）但无研制要求（GJB 语境顶层技术要求条目化）模板/节。
- **V 无角色覆盖核验**：V 评审不知晓各角色关注面是否被产出承接。

## 1. 裁定记录（D1-D8）

| # | 决策点 | 裁定 |
|---|---|---|
| D1 | 范围 | **全量批次**（用户裁定）：阶段 1-4 全量接入 + 3 persona + 研制要求子模板 + A-lead 协议 + V 核验维度 + 四阶段细则接线 |
| D2 | 机制强度 | **讨论+门禁**（用户裁定）：A-lead 讨论协议 + 机器门禁（run-log 结构化留痕 + `check-role-dispatch` 新增校验维度，时序 fail-closed）；不做讨论质量语义门禁（语义仍归 V） |
| D3 | 研制要求形态 | **阶段 1 新子模板**（用户裁定）：`templates/requirement-spec/development-requirements.md`，跨阶段子模板 10 种→11 种；`gate-logic.ts` `PHASE_SPEC_LAYOUT` 常量同步（单一事实源）；**存量 phase-1 fixtures/samples 硬切补齐**（仓库「硬切全量」惯例） |
| D4 | 角色映射 | 3 新 persona（`product-requirements-analyst` / `testing-test-manager` / `engineering-algorithm-expert`）+ 5 既有 persona 复用；映射表见 §2（逐字采用用户角色集） |
| D5 | 协议角色归属 | **A-lead = A 类 lead 变体**（仿 R-lead/V-lead 先例）：分派 N persona 视角分析、汇总分歧、调度交叉质询、产出共识纪要——全部属分析动作；**阶段交付物仍 S 唯一落笔**（S 派单简报以共识纪要为前置条件）；O 只做路由/CHECKPOINT/持久化（编排者最小化不破坏，反模式 #10 口径） |
| D6 | 分歧出口 | 未决分歧 → **迷雾登记册**（阶段 1 需求层迷雾册 / 阶段 2-4 设计层迷雾册，批次 2 机制衔接，零新通道）；已决分歧 → 共识纪要记录决议与理由；迷雾毕业三选一既有流程不变 |
| D7 | 门禁形态 | `run-log.schema.json` 根级 `additionalProperties: false` → **schema 先行**新增可选 `persona?: string`（role=A 多视角分析记录携带）；`check-role-dispatch` **新增校验维度**（脚本数不变）：阶段 1-4 须有与矩阵行数一致的 role=A persona 分析记录（persona 字段非空且互异）+ 1 条 A-lead 综合记录 + S 产出记录时序**晚于**全部 persona 分析记录；不满足 → exit 1（fail-closed）；脚本内部无既有 R 编号体系，新维度命名由实现按脚本现状定 |
| D8 | 立项与版本 | 独立项目（非五批次）；文档先行（本规格先提交 main）；实现分支 `feature/phase-multi-role-analysis` 待规格获批后开启；版本 **42.11.0**（七处同步） |
| D9 | 交叉轮次纪律（用户 2026-10-03 追加裁定：「讨论必然是并行+多轮交叉」） | **并行多轮交叉直到收敛**，不设固定小轮数上限：每轮将全部未决分歧点**并行**定向分派相关 persona 成组对辩，A-lead 逐轮汇总；**收敛判据 = 单轮内零新增分歧点 ∧ 全部分歧已转为已决或登记迷雾册**；**5 轮安全阀**（对齐既有「每任务 5 轮」数值口径，零新增数值）未收敛 → 🔴 CHECKPOINT 用户裁定（加轮继续 / 未决项全部登记迷雾册收口 / 终止阶段）——不静默续跑也不静默掐断；共识纪要须记录实际轮次数 |

## 2. 阶段角色集矩阵（权威表，落 `agent-personas.md` 新节）

**矩阵（逐字采用用户角色集；视角关注面为本规格定义）**：

| 阶段 | 角色集（顺序=分派顺序） | persona 映射 |
|---|---|---|
| 1 需求分析 | 需求分析师 → 产品经理 → 测试经理 → 系统架构师 → UX 专家 → 算法专家（6） | `product-requirements-analyst` / `product-manager` / `testing-test-manager` / `engineering-software-architect` / `design-ux-architect` / `engineering-algorithm-expert` |
| 2 系统设计 / 3 概要设计 | 测试经理 → 系统架构师 → 软件工程师 → 产品经理 → 数据库专家 → UX 专家 → 算法专家（7） | `testing-test-manager` / `engineering-software-architect` / `engineering-senior-developer` / `product-manager` / `engineering-database-optimizer` / `design-ux-architect` / `engineering-algorithm-expert` |
| 4 详细设计 | 测试经理 → 系统架构师 → 软件工程师 → 产品经理 → UX 专家 → 数据库专家 → 算法专家（7） | `testing-test-manager` / `engineering-software-architect` / `engineering-senior-developer` / `product-manager` / `design-ux-architect` / `engineering-database-optimizer` / `engineering-algorithm-expert`（集合同 2/3，顺序随本行角色序） |

**各角色视角关注面（矩阵列，指导视角分析报告）**：需求分析师=需求分解与追溯完整性；产品经理=范围/优先级/价值；测试经理=可测试性与验收判据（测试左移——与 W 模型阶段 1 产验收测试设计同源）；系统架构师=边界/分层/架构约束；软件工程师=实现可行性与复杂度；数据库专家=数据模型与一致性；UX 专家=交互与可用性；算法专家=模型选型/复杂度/精度约束。

**与既有矩阵划界**：R-persona 矩阵（根因，`rootCause.category`+风险域两键）与 V-lead 多角度矩阵（评审）不变；本矩阵只服务 **A-lead 阶段产出前分析**，三者互不替代、同文件分节。

## 3. A-lead 多视角协议（阶段 1-4 产出前时序）

插入点：各阶段 O 路由确认后、S 产出派单前（细则接线见 §7）。

1. **O 派单 A-lead**（派单契约两段，批次 4 形态）：前置条件=矩阵节与 persona 文件实存 + 前阶段产物就绪；可验证终态=共识纪要落盘 + run-log 含 N 条 persona 分析记录 + 1 条综合记录。
2. **并行分派 N 个 persona 视角分析**（role=A，`persona=<id>`）：输入=前阶段产物+本阶段输入+视角关注面；产出=视角分析报告（Markdown：发现/风险/约束建议/分歧点候选），落盘 `.w-model/phase-analyses/phase-<N>/<persona>.md`；run-log 逐条记录（`persona` 字段）。
3. **汇总与并行多轮交叉**（A-lead，D9）：提取分歧点 → **每轮把全部未决分歧点并行定向分派**相关 persona 成组对辩（role=A，`persona` 字段逐条留痕）→ A-lead 逐轮汇总；**重复直到收敛**（收敛判据 = 单轮内零新增分歧 ∧ 全部分歧已决或登记迷雾册）；达 **5 轮安全阀**未收敛 → 🔴 CHECKPOINT 用户裁定（加轮继续 / 未决项全部登记迷雾册收口 / 终止阶段）；产出**共识纪要**（每分歧一项：决议+理由，或迷雾册去向；纪要含实际交叉轮次数）落盘 `.w-model/phase-analyses/phase-<N>/consensus-minutes.md`；run-log 逐轮综合记录。
4. **分歧登记**：未决分歧由 S 产出时登记入对应阶段迷雾登记册（D6）；A-lead 不改迷雾册（登记义务在 S 产出侧，与批次 2「S 产出时执行锐利性测试」同位）。
5. **S 产出**：派单简报前置条件含「共识纪要实存且 N 视角齐备」（机器可核，§4）；S 依据纪要产出阶段交付物（落笔唯一性不变）。
6. **V 评审**：既有子标准与权重不变；新增「阶段角色集覆盖核验」参考项（§6）。
7. **G 门禁**：阶段门既有 `check-role-dispatch` 调用点自然承载新维度（§4），无新增调用。

**轻量豁免**：成熟度 L0/L1 项目或用户显式 `--lite` 时，允许 N=1（仅需求分析师/系统架构师单视角）+ 纪要注明降级——门禁按实际 N 校验（不冒充全矩阵）；L2+ 全矩阵强制。

## 4. 机器门禁设计（D2）

- **schema 先行**：`run-log.schema.json` 新增可选 `persona?: string`（description 自描述；role≠A 时不得出现——以 `if/then` 条件约束或留给 logic 校验，实现按既有 schema 形态定）；`additionalProperties: false` 之下先改 schema 再动 logic（仓规）。
- **check-role-dispatch 新维度**（脚本数不变，logic 层 `role-dispatch-logic.ts` 扩展）：
  - **维度 a（覆盖）**：阶段 1-4 的 run-log 中，role=A 且 action=分析类（action 枚举实查 `run-log.schema.json:189` 后对齐）且 `persona` 非空的记录，其 persona 集合须 ⊇ 该阶段矩阵 persona 集（含 lite 降级登记形态的实际 N）；缺 → 计入 blocking（`roleDispatchMissing` 同形态扩展 `phaseRoleCoverageMissing` 明细）。
  - **维度 b（时序）**：本阶段 role=S 产出记录的时间戳须**严格晚于**全部 persona 分析记录（同秒不算晚——对齐 check-run-log R11「严格早于」口径）；违反 → blocking。
  - **维度 c（互异）**：同阶段 persona 记录互异（无重复 persona 冒充多视角）。
  - 既有语义（每阶段 S/V/G ≥1、R3 三维度、空/全无效 fail-closed、`--r3-enabled` no-op）**零改动**。
- **登记义务全套**（新维度）：`command-reference.md` check-role-dispatch 条目、`self-test.ts` 新增 CASES（≥3：全矩阵合规 / 缺 persona / 时序倒置）、`samples/run-log/` fixtures（valid+bad 各 ≥1）、`NEGATIVE-COVERAGE.md` 登记行、`__tests__/role-dispatch-logic` 扩展单测。
- **不新建脚本**：脚本 48 个 .ts 不变；`AGENTS.md` §8 表 check-role-dispatch 行更新描述。

## 5. 研制要求子模板（D3）

- **文件**：`templates/requirement-spec/development-requirements.md`（阶段 1 第 7 个子模板，跨阶段 10→11 种）。结构：条目表（列：要求 ID `DEVREQ-<NNN>` / 类别（功能/性能/接口/环境/安全性/约束）/ 要求描述 / 量化指标 / 验证方法 / 追溯 REQ id）+ 填写规则（逐条须追溯 ≥1 REQ；类别六类枚举；量化指标须可验证）。
- **PHASE_SPEC_LAYOUT 同步**（`gate-logic.ts:1262` 单一事实源）：phase 1 `refs` 追加 `development-requirements.md`；下游（check-artifact-gate 文档完整性、check-requirement-graph `--spec-dir` 引用块校验等消费方）随常量自然生效，实现时逐一实查消费点并回归。
- **存量硬切**：全部 phase-1 valid fixtures/samples（`w-model-dev/scripts/samples/` 下 gate/graph/coverage 等涉及 phase-1 spec 布局的用例）补齐新子模板引用块；docs-consistency/quick-self-check 等活体文档中「10 种独立子模板」计数逐处同步为 11（`templates/README.md` / `quality-standards.md` / `AGENTS.md` / SSoT 等，grep 逐一确认）；`check-requirement-coverage` 等若断言布局同样跟进。
- **不进图**：研制要求是文档层条目（可选能力先例同款边界），不建图节点；追溯核验归 V（条目 REQ id 抽查实指）。

## 6. V 核验维度

- `verifier-spec.md` §7.2（需求）/ §7.2A 或设计对应节追加参考项（仿「BDD features 评审额外参考 bdd.md（7 项清单）」先例，**不新增子标准名与权重**）：「阶段 1-4 评审额外参考 [agent-personas.md](agent-personas.md)『阶段角色集矩阵』——核验共识纪要 N 视角关注面在产出中的承接（缺任一关注面承接 → 对应子标准降分依据；非独立门禁）」。

## 7. 范围与改动面锁定

| 文件 | 动作 |
|---|---|
| `w-model-dev/subagent/product-requirements-analyst.md` / `testing-test-manager.md` / `engineering-algorithm-expert.md` | **新增**（frontmatter 四字段契约，persona-capability-declarations 门禁强制） |
| `w-model-dev/references/agent-personas.md` | 修改（阶段角色集矩阵新节 + 三矩阵划界） |
| `w-model-dev/references/subagent-delegation.md` | 修改（A-lead 角色定义 + 多视角分析/共识纪要两个分派模板 + dispatch-matrix 登记行；22 模板基数实查后 +2） |
| `w-model-dev/references/phase-1-requirements.md` / `phase-2-system-design.md` / `phase-3-outline-design.md` / `phase-4-detailed-design.md` | 修改（「多角色讨论分析」节 + 时序插入 + CHECKPOINT 验收清单行） |
| `w-model-dev/schemas/run-log.schema.json` | 修改（persona 可选字段，schema 先行） |
| `w-model-dev/scripts/logic/role-dispatch-logic.ts` + `cli/check-role-dispatch.ts` | 修改（三新维度；脚本数不变） |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改（PHASE_SPEC_LAYOUT phase 1 refs） |
| `w-model-dev/templates/requirement-spec/development-requirements.md` + `templates/README.md` | 新增/修改 |
| `w-model-dev/scripts/samples/**` phase-1 布局相关 fixtures + `self-test.ts` + `NEGATIVE-COVERAGE.md` + `__tests__/` | 修改（硬切 + 新 CASES + 新单测） |
| `w-model-dev/references/command-reference.md` / `quality-standards.md` / `SKILL.md`（时序句+计数）/ `AGENTS.md`（§1 索引 + §2 persona 计数 33→36 + §8 表行） | 修改 |
| `docs/skill-design-document_SSoT.md`（§10P 新节 + §10A 行） | 修改 |
| `CHANGELOG.md`（42.11.0）+ 版本七处 | 修改 |
| eval 语料（可选）：+1 条「多角色缺位即派单 S」L2 语料 | 修改（mappings/prompts id 65） |

**不做**：讨论质量的语义门禁（归 V）；O 参与内容综合（反模式 #10）；迷雾册新通道（复用批次 2）；R/V 既有矩阵改动；五批次总纲改动（独立项目不登总纲）；check-role-dispatch 新脚本化（扩展现有）。

## 8. 验收标准（DoD）

1. 矩阵节在场且逐字含用户角色集；3 新 persona 落位且过 persona-capability-declarations；A-lead 协议与两个分派模板（契约两段形态）在 subagent-delegation 落位。
2. 门禁三维度（覆盖/时序/互异）实现且 exit 0/1 双向经单测 + self-test + samples 实证；run-log persona 字段 schema 先行（bad-additional-props 样本更新不回归）。
3. 研制要求子模板在场；PHASE_SPEC_LAYOUT 同步后**全量 self-test + vitest 回归**（phase-1 fixtures 硬切后零失败）；活体文档「10 种→11 种」计数逐处同步（grep 清单实证）。
4. 四阶段细则「多角色讨论分析」节 + CHECKPOINT 行；lite 降级形态在细则与门禁两侧一致。
5. V 核验参考项在场（verifier-spec）；SSoT §10P + §10A 行；AGENTS/SKILL 计数与索引；CHANGELOG 42.11.0 + 七处同步。
6. `npm run prepush` 19 项全绿收口。

## 9. 风险与已知代价

- **风险 1**：@typescript-eslint 已升 8，本批不动依赖——零依赖风险；但 PHASE_SPEC_LAYOUT 波及面（fixtures 硬切）是最大回归源 → 缓解：DoD 3 全量回归 + 硬切清单 grep 实证。
- **风险 2**：多角色分派 + 并行多轮交叉推高 token 成本 → 缓解：收敛判据以「分歧不再新增」为停机条件（不空转）；5 轮安全阀 CHECKPOINT 由用户控预算；lite 降级形态（L0/L1 或显式 `--lite`）；矩阵 persona 数已按用户角色集定死不膨胀。
- **风险 3**：A-lead 与既有 A/S 边界混淆 → 缓解：D5 归属句 + subagent-delegation 角色表更新 + 分派模板契约两段（终态=纪要+记录，不含交付物）。
- **风险 4**：run-log persona 字段被旧格式记录缺失 → 门禁只对**新机制生效后的阶段**强制（阶段门按 run-log 中该阶段记录判；历史 run 无 persona 记录不追溯——维度 a 仅要求「有 S 产出记录的阶段须有先行 persona 记录」，与 R11 闭环形态同理，实现计划阶段钉死判据细节）。

## 10. 仓内证据锚点（实施定位）

- 矩阵先例：`w-model-dev/references/agent-personas.md`（R-persona 两键矩阵 + V-lead 多角度矩阵节）
- 角色边界先例：`subagent-delegation.md`（O/A/S/V/G/R 定义 + R-lead/V-lead 多角度 + 22 分派模板 + 派单契约两段）
- run-log：`w-model-dev/schemas/run-log.schema.json`（:7 additionalProperties、:189 action 枚举、:224 role 枚举）+ `logic/run-log-logic.ts`（action-role 配对）+ `logic/role-dispatch-logic.ts` / `cli/check-role-dispatch.ts`
- 模板布局：`logic/gate-logic.ts:1262` PHASE_SPEC_LAYOUT（phase 1 refs 六项）+ `templates/README.md:3`（布局一致性声明）+ `templates/requirement-spec/`（6 子模板目录）
- 迷雾衔接：`phase-1-requirements.md`「迷雾登记册（Fog of War）」节 + phase-2/3/4 设计期迷雾节
- V 参考项先例：`verifier-spec.md` §7.2「TLA+ 审查参考清单」「BDD features 评审额外参考 bdd.md」句式
- persona 门禁：docs-consistency `persona-capability-declarations` 检查
- 计数面：`templates/README.md` / `quality-standards.md` / `AGENTS.md` §2（33 人格）/ SKILL.md 资源计数行
