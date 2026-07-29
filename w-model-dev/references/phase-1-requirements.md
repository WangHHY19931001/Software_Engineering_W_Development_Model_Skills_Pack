# 阶段 1：需求分析（同步验收测试设计）

> W 模型左 V 第 1 阶段。对应右 V 测试设计：**验收测试设计**。
> 命令入口：`/wm analyze <需求描述>`

## 功能描述

将自然语言需求转化为结构化的《需求规格说明书》，并**同步设计验收测试用例**。测试对象不仅是程序，还包括需求文档本身——需对需求做完整性检查与冲突检测。

## 输入

- 用户自然语言需求描述
- 业务背景信息（可选但建议提供）

## 输出

- 《需求规格说明书》（套用 [templates/requirement-spec.md](../templates/requirement-spec.md)）
- 验收测试用例设计文档（套用 [templates/test-case.md](../templates/test-case.md)，类型=验收测试）
- 需求风险评估报告（含风险等级与缓解措施）
- `docs/uat-path-mapping.md`：UAT 路径映射表初始版（设计路径列，实际路径待阶段5回填）

## AI 能力应用

- **自然语言理解与结构化提取**：识别功能需求 / 非功能需求 / 约束需求
- **需求完整性检查**：检测缺失项（如登录功能缺少密码策略）
- **需求冲突检测**：识别相互矛盾的描述
- **验收测试用例自动生成**：为每个功能点生成验收场景

## ingestion 子流程（A→S 路径，阶段 1 专用）

阶段 1 进入时，编排者先跑 `plan-chunks.ts` 对输入分块（一句话输入产 1 chunk，仍走完整流程），并行分派 A-chunk 提取 REQ 节点，再分派 A-cross 合并建图、G 跑 `check-requirement-graph.ts` 校验连通性与单根。收敛后 S 子代理读 `graph.json` 产出正式需求规格。

详见 [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md) 与设计文档 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §1.3。

## 需求解析算法

```
输入: 自然语言需求描述
  1. LLM 意图识别和实体提取
     ├─ 失败: 意图置信度低 / 需求歧义 → 暂停，要求用户重述或拆解，禁止 LLM 自行补全默认值
     └─ 成功: 产出功能/非功能/约束需求实体清单
  2. 构建需求层级树【维度1】（自适应层级深度）
     ├─ 每个 REQ 节点须标注 level（正整数，从 1 开始单调递增，无上限）
     ├─ level≥2 REQ 须有 parent 指向 level-1 祖先；level=1 REQ 即 REQ-group 候选
     ├─ priority 字段可选（P0-P3）；reqGroup 字段：level≥2 节点指向 level=1 祖先
     ├─ 失败: level 非正整数或非单调 → blocked 返回（见 [ingestion-chunk.md](ingestion-chunk.md) level 识别规则）
     ├─ 失败: 模块归属不明 → 标注待澄清项，向用户确认归属
     └─ 成功: 产出 自适应层级树（含 level/priority/reqGroup 字段）
  3. 检测需求冲突和缺失【维度3】（含四类交叉逻辑边识别）
     ├─ 同步在 graph.json 写入 conflicts-with 边（A 与 B 矛盾）
     ├─ 同步识别 depends-on / precedes / cross-cuts 边并写入 graph.json
     ├─ 失败: 检测到 conflicts-with 冲突 → 风险评估报告标注冲突对，同步写入 graph.json，启动豁免审批流程（S→R→V→人类）
     ├─ 失败: 检测到缺失项（如登录无密码策略）→ 提示用户补充，禁止自动填默认策略
     └─ 成功: 0 冲突、缺失项已标注、四类交叉边已登记
  4. 生成验收标准（每个功能点 ≥ 1 条可验证标准）
     ├─ 失败: 验收标准不可验证（含"快速"/"友好"等主观词）→ 改写为可量化标准（如"响应 < 2s"）
     └─ 成功: 产出可验证的验收标准 + 验收测试用例
  5. REQ-group 识别与候选子系统划分【维度2】
     ├─ level=1 REQ 即 REQ-group 候选（每个 domain 对应一个候选子系统）
     ├─ 验证 reqGroup 字段：level≥2 节点须指向 level=1 祖先
     ├─ 产出 REQ-group 清单（§5.1）+ group 划分依据（§5.2）+ 待阶段2决策事项（§5.3）
     ├─ 失败: REQ-group 边界模糊（FM-3D-04）→ 标注待澄清，向用户确认 group 归属
     └─ 成功: 产出 REQ-group 候选清单，正式子系统划分待阶段 2
  6. 需求覆盖分析【维度4】（四张覆盖矩阵 + 100% 覆盖率）
     ├─ stakeholder 识别后未关联 REQ → FM-4D-01，须经豁免审批
     ├─ 场景类型缺失（正常/异常/边界/NFR/CON）→ FM-4D-02，须经豁免审批
     ├─ 覆盖率 < 100%（stakeholder/场景/需求类型）→ FM-4D-03，须经豁免审批
     ├─ cross-cuts 横切不一致 → FM-4D-04
     ├─ partial 覆盖未补齐 → FM-4D-05，须经豁免审批
     ├─ 失败: 覆盖率不达标且未走豁免审批 → 回步骤 6，补覆盖或申请豁免
     └─ 成功: 四张矩阵完整，每维度覆盖率 100%（含豁免审批处置的缺失项）
输出: 结构化需求规格（§1-§12）+ 验收测试用例 + 风险评估报告 + 豁免审批记录
```

**自适应层级深度规则**（[21.0.0] 新增）：

- 最小层级深度 = 2（domain → acceptance，适用极小项目）
- 推荐层级深度 = 4（domain → module → feature → acceptance）
- 最大层级深度 = 不限（复杂项目可扩展至 5+ 层）
- 校验规则：level 单调性（子节点 level > 父节点 level）+ 根节点 level=1 + 叶节点须可追溯到验收级

## User Stories 长列表（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 产出需求规格时，在「需求清单」前必须包含 User Stories 节，覆盖正常/异常/边界/NFR/CON 全场景。

**模板**：

```markdown
## User Stories

1. As a <actor>, I want <feature>, so that <benefit>
2. As a <actor>, I want <feature>, so that <benefit>
...
```

**规则**：
- 每条 user story 对应 ≥1 个 REQ 行（RTM `requirementId` 可追溯）
- 列表「extensive」——覆盖正常/异常/边界/NFR/CON 全场景
- 与「需求清单」互补：user stories 是用户视角，需求清单是系统视角
- A 子代理 ingestion 时把 user stories 作为 chunk 之一（不破坏现有分块策略）

## Out of Scope 显式声明（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 在「需求清单」后必须包含 Out of Scope 节，明确排除的功能/场景。

**模板**：

```markdown
## Out of Scope

- <明确排除的功能/场景>
- <原因：依赖未就绪/范围过大/下轮迭代>
```

**规则**：
- 至少 1 条（即使是「无」也要显式声明）
- 与 NFR/CON 横切治理互补：NFR/CON 是「要做什么」，Out of Scope 是「不做什么」
- V 子代理评审时检查「Out of Scope 是否覆盖了用户提到的边界场景」
- Brownfield 项目须明确声明不动哪些历史模块（见 SSoT §11A.5）

## Implementation/Testing Decisions 分离（第 10 轮外部技能吸收）

> 吸收 to-spec PRD 结构。S-doc 在「风险与缓解」前必须包含 Implementation Decisions + Testing Decisions 两节，分离架构决策与测试决策。

**模板**：

```markdown
## Implementation Decisions
- <架构/模块/接口/Schema/API 契约决策>
- <避免具体文件路径与代码片段（除非 prototype 产出的决策密集片段）>

## Testing Decisions
- <测试 seam 选择及理由>
- <哪些模块测试、参考哪些既有测试>
```

**规则**：
- Implementation Decisions 与现有「设计假设」互补：假设是「未确认的前提」，决策是「已选定的方向」
- Testing Decisions 与阶段 1 同步验收测试设计互补：本节是「为什么这样测」，验收测试设计是「测什么」
- 禁止具体文件路径（OpenSpec 与 to-spec 共识：路径易过期）

## 执行方法论

> 本节规定产出物的工具级落地方式，确保产出可复现、可追溯、可审计。

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 需求规格说明书 | 套用 `templates/requirement-spec.md` 模板，按"功能 / 非功能 / 约束"三类填充 | `<模块>-requirement-spec.md` |
| 验收测试用例 | 套用 `templates/test-case.md` 模板，`type=验收测试`，每个功能点 ≥ 1 条用例 | `<模块>-acceptance-test.md` |
| 风险评估报告 | 产出风险等级（高 / 中 / 低）+ 缓解措施表格；冲突对与缺失项单独列出 | `<模块>-risk-assessment.md` |
| graph.json | A 子代理产出，记录 REQ 节点与 parent/depends-on 边 | `.w-model/ingestion/graph.json`（跨阶段演进） |

**执行顺序**：需求解析算法（步骤 1-4）→ 套用模板产出需求规格 → 同步产出验收测试用例（覆盖正常 + 异常 + 边界）→ 产出风险评估报告 → RTM 登记。

## 测试用例设计（本阶段产出验收测试用例）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-REQ-001 | 自然语言需求解析 | "我需要一个用户登录功能" | 结构化需求，含功能描述、输入输出、验收标准 | 高 |
| TC-REQ-002 | 复杂需求分解 | "在线商城系统，支持用户注册、商品浏览、购物车和订单功能" | 分解为 4 个独立模块需求 | 高 |
| TC-REQ-003 | 需求完整性检查 | "用户登录功能"（缺少密码策略） | 提示缺少密码复杂度要求 | 高 |
| TC-REQ-004 | 需求冲突检测 | "用户登录需要邮箱验证" AND "用户登录不需要验证" | 检测到冲突并提示 | 高 |
| TC-REQ-005 | 验收测试用例生成 | 完整需求描述 | 生成对应的验收测试用例 | 高 |

## 并行任务（强制）

产出需求规格后，**立即**同步生成验收测试用例，覆盖所有功能点。验收测试用例将在阶段 8（验收测试）执行，本阶段只做设计。

### L1 BDD features 设计（与 TLA+ L1 spec 并行）

S-bdd 子代理在 S-doc 产出需求规格后：
1. 套用 [`templates/feature.template`](../templates/feature.template) 产出 L1 features（每个 REQ ≥1 个 .feature 文件）
2. 在 Background 节声明 L1 状态机七要素（states / initialState / terminalStates / acceptingStates / rejectingStates / transitions / invariants）
3. 更新 `.w-model/bdd-manifest.json`（features + stateMachines）
4. 在 RTM `acceptanceTest` 列登记 `UAT-NNN | BDD-L1-<system>-<num>.feature`

V 子代理评审 features（targetKind=test + [bdd-review-checklist.md](bdd-review-checklist.md) 7 项清单）。
G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=1` 校验 D1-D7（D5 step 绑定阶段 1-4 跳过）。

### 验收测试前置条件分析（强制）

> 第 22 轮新增。第 21 轮调测发现 5 个验收用例因前置条件缺失而失败（如用公开接口测 token 失效、管理员场景未预创建管理员用户）。

每条验收测试用例须包含以下前置条件分析：

| 前置条件类型 | 要求 | 示例 |
|---|---|---|
| 认证状态 | 明确标注是否需认证 + 角色 | 需 admin token / 需普通用户 token / 无需认证 |
| 数据依赖 | 明确标注依赖的测试数据 | 需预创建文章/用户/标签 |
| 接口路径 | 明确标注 API 路径 + HTTP 方法 | POST /api/posts |

**禁止行为（新增）**：

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 12 | 用公开接口测试认证失效 | 须选需要认证的接口验证 token 失效 |
| 13 | 验收用例未声明前置条件 | 每条用例须含前置条件分析节 |

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中登记：需求 ID、需求描述、验收测试列。其余列（设计文档 / 代码模块 / 单元 / 集成 / 系统测试）留待后续阶段填充。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

### NFR/CON 横切治理字段登记（第 9 轮 P1.2）

> NFR（非功能需求）与 CON（技术约束）的 RTM 字段登记要求。横切治理类需求在阶段 1 完成 `designDoc` 字段登记，避免阶段 5 编码后才发现"未挂载到任何 SD 子系统"。

**字段登记要求**：

| 行类型 | `designDoc` 登记要求 | 示例值 |
|---|---|---|
| `NFR-001~005` | 须登记横切 SD 清单（多 SD 用逗号分隔），表示该 NFR 横切治理哪些 SD 子系统 | `"SD-001,SD-004,SD-007"` |
| `CON-001~003` | 须登记 `designDoc="横切"`（无具体 SD 映射时填"横切"标识，表示为全局技术约束） | `"横切"` |

**其他字段约定**：

- `detailedDesign`：NFR/CON 行可填 `"横切"`（无具体 DD 映射），待阶段 2–4 设计细化后再补充具体 DD-xxx。
- `codeModule`：阶段 1 留空，由阶段 5 回填（详见 [phase-5-coding.md](phase-5-coding.md)「NFR/CON codeModule 回填」节）。
- `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest`：NFR/CON 行可填对应测试用例 ID 或 `null`（横切测试在阶段 5–8 补充）。

**阶段 1 门禁校验**：`check-artifact-gate.ts --phase=1` 校验 NFR/CON 行的 `designDoc` 字段非空（非 `null`、非空字符串）。缺失即门禁退出码 1，回到阶段 1 补登记。

> 与 REQ 行的差别：REQ 行在阶段 1 登记时 `designDoc` 可暂留空（待阶段 2 系统设计后映射到 SD-xxx）；NFR/CON 行**必须在阶段 1 完成横切登记**，因为 NFR/CON 是横切治理类需求，不挂在具体 SD 上会丢失治理关系。

## 验收标准

- [ ] 需求规格说明书符合模板规范
- [ ] 验收测试用例覆盖所有功能点
- [ ] 需求风险评估报告包含风险等级和缓解措施
- [ ] 需求冲突 / 缺失项均已处理或标注
- [ ] RTM 已登记需求与验收测试映射
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=1` 退出码 0（连通 + 单根 + 父唯一）

> 🔴 **CHECKPOINT · 阶段门放行**：需求规格 + 验收测试用例产出后暂停。Agent 必须向用户展示「需求清单 / 冲突与缺失项 / 验收标准可验证性 / 风险评估 / RTM 需求登记」，由用户确认「放行进入阶段 2」或「返工」。存在未解决的冲突或不可验证的验收标准 → 一律返工，不得放行。

## 阶段门评审

评审通过 → 进入阶段 2（系统设计）。
评审不通过 → 回到需求分析起点返工（如需求不明确、验收标准缺失、冲突未解决）。

## 失败模式矩阵（FM）

> 第 20 轮四维识别与豁免审批增强（v20.0.0）。FM 矩阵定义四维识别与豁免审批流程的失败模式，由 V 子代理在评审时对照核验，命中即触发返工或豁免审批。

### FM-3D（三维结构失败模式）

> 对应维度1（层级树）/ 维度2（REQ-group）/ 维度3（交叉逻辑）。

| FM ID | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-3D-01 | 层级缺根 | 无 level=1 REQ；graph.json 无 REQ-group 根 | 回步骤 2 补 level=1 domain REQ |
| FM-3D-02 | orphan 节点 | level≥2 REQ 无 parent 指向 level-1 祖先 | 回步骤 2 补 parent 边 |
| FM-3D-03 | multiParent | 一个 REQ 有多个 parent | 回步骤 2 拆分或确认唯一 parent |
| FM-3D-04 | REQ-group 边界模糊 | level=1 REQ 对应的 group 范围不清；reqGroup 指向非 level=1 节点 | 回步骤 5 向用户确认 group 归属 |
| FM-3D-05 | 依赖时序环 | depends-on / precedes 边形成环 | 回步骤 3 拆解环或申请豁免 |
| FM-3D-06 | conflicts-with 未解决 | conflicts-with 边存在但无处置记录 | 启动豁免审批（S→R→V→人类） |

### FM-4D（四维覆盖失败模式）

> 对应维度4（覆盖分析）。

| FM ID | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-4D-01 | stakeholder 未关联 REQ | stakeholder 识别后无关联 REQ | 补 REQ 或申请豁免审批 |
| FM-4D-02 | 场景类型缺失 | 正常/异常/边界/NFR/CON 场景未全覆盖 | 补场景或申请豁免审批 |
| FM-4D-03 | 覆盖率不达标 | stakeholder/场景/需求类型覆盖率 < 100% | 补覆盖或申请豁免审批 |
| FM-4D-04 | cross-cuts 不一致 | 横切边在 graph.json 与覆盖矩阵不一致 | 回步骤 3 对齐 cross-cuts 边 |
| FM-4D-05 | partial 未补齐 | 覆盖矩阵标 partial 但未补齐 | 补齐或申请豁免审批 |

### FM-EXEMPT（豁免审批失败模式）

> 对应豁免审批治理（S→R→V→人类四阶段）。

| FM ID | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-EXEMPT-01 | S 自行决定豁免 | S 产出 exemption-request.json 后直接声明豁免生效 | 作废豁免，回 R 审查 |
| FM-EXEMPT-02 | R 模板化审查 | R 的 exemption-review.json 缺 5-Why/上游回溯/可证伪性 | 重派 R 补审查 |
| FM-EXEMPT-03 | V 未通过即放行 | exemption-verification.json passed=false 但豁免已生效 | 作废豁免，回 V 复审 |
| FM-EXEMPT-04 | 人类未确认 | 无 CHECKPOINT 人类确认记录，豁免已生效 | 暂停，回 CHECKPOINT 等人类确认 |
| FM-EXEMPT-05 | 掩盖需求遗漏 | 用豁免审批掩盖本应补充的需求 | 作废豁免，回步骤 1 补需求 |

## 豁免审批治理（S→R→V→人类四阶段）

> 第 20 轮新增。覆盖缺失、conflicts-with 冲突、覆盖率不达标等事项须经强制四阶段审批流程，禁止任何角色自行决定豁免生效。

### 流程

```
S 识别需豁免项 → 产出 exemption-request.json（含豁免理由、影响范围、替代方案）
  ↓
R 按 root-cause-locator.md 方法论审查 → 产出 exemption-review.json（5-Why/上游回溯/可证伪性）
  ↓ 不得直接批准豁免生效
V 校验 reviewDecision / rootCauseAnalysis / falsifiabilityCheck / conditions → 产出 exemption-verification.json
  ↓
人类 CHECKPOINT 确认 → approve 写入 granted.json / reject 回到原规则
```

### 角色边界

- **S 角色**：识别需豁免项，产出 `exemption-request.json`；**禁止 S 自行决定豁免生效**。
- **R 角色**：按 [root-cause-locator.md](root-cause-locator.md) 方法论审查（5-Why / 上游回溯 / 可证伪性），产出 `exemption-review.json`；**不得直接批准豁免生效**。
- **V 角色**：校验 `reviewDecision` / `rootCauseAnalysis` / `falsifiabilityCheck` / `conditions`，产出 `exemption-verification.json`。
- **人类**：CHECKPOINT 确认，approve 写入 `granted.json`，reject 回到原规则。

### check-exemption 校验（E1-E8）

豁免生效前须通过 `check-exemption` E1-E8 全部校验（豁免请求完整 / R 审查方法论齐全 / V 校验通过 / 人类确认记录存在 / 豁免理由非掩盖遗漏 / 影响范围已评估 / 替代方案已考虑 / 条件可落实）。

> 与反模式 #30（豁免审批跳步）的关系：任何豁免未按四阶段流程执行即命中 #30，见 [anti-patterns.md](anti-patterns.md)。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 把非功能需求当功能需求登记 | 严格区分功能 / 非功能 / 约束三类，NFR 单独标记 |
| 2 | 为缺失项自动补全默认值 | 缺失项必须提示用户补充，禁止 LLM 自行填默认策略 |
| 3 | 验收标准含主观词（"快速"/"友好"） | 必须改写为可量化标准（"响应 < 2s"/"操作 ≤ 3 步"） |
| 4 | 跳过冲突检测直接生成用例 | 步骤 3 冲突检测必须执行，冲突未解决不得进入步骤 4 |
| 5 | 验收测试用例只覆盖 happy path | 必须覆盖正常 + 异常 + 边界场景 |
| 6 | 需求规格未套用模板 | 必须套用 [templates/requirement-spec.md](../templates/requirement-spec.md) |
| 7 | REQ 节点不标注 level（正整数） | 每个 REQ 节点必须标注 level（强制必填，无降级）；level 非正整数或非单调 → blocked 返回，禁止降级为缺省值 |
| 8 | LLM 自行决定 REQ-group 归属 | level=1 REQ 即 REQ-group 候选（确定性规则）；group 边界模糊（FM-3D-04）须向用户确认，禁止 LLM 自行裁定 |
| 9 | 省略 §4-§7 任一节（层级树/REQ-group/交叉逻辑/覆盖分析） | 四维识别强制节必须全部产出；无内容时填「无」并加说明，禁止省略 |
| 10 | 覆盖缺失项隐式遗漏 | 覆盖缺失项须经豁免审批（FM-4D-01/02/03/05）并在 §8 Out of Scope 显式声明，禁止隐式遗漏 |
| 11 | 跳过豁免审批流程 | 豁免须经 S→R→V→人类四阶段流程 + check-exemption E1-E8 全通过；跳步即命中反模式 #30 |

## 返工路径

阶段门评审不通过时，按以下路径返工：

- 需求歧义 / 置信度低 → 回到步骤 1，要求用户重述或拆解
- 需求冲突未解决 → 回到步骤 3，向用户决策冲突对（conflicts-with 启动豁免审批）
- 缺失项未补充 → 回到步骤 3，向用户提示补充
- 验收标准不可验证 → 回到步骤 4，改写为可量化标准
- 层级缺根 / orphan / multiParent（FM-3D-01/02/03）→ 回到步骤 2，补 level=1 根或 parent 边
- REQ-group 边界模糊（FM-3D-04）→ 回到步骤 5，向用户确认 group 归属
- 依赖时序环 / conflicts-with 未解决（FM-3D-05/06）→ 回到步骤 3，拆解环或启动豁免审批
- 覆盖缺失（FM-4D-01/02/03/05）→ 回到步骤 6，补覆盖或申请豁免审批
- cross-cuts 不一致（FM-4D-04）→ 回到步骤 3，对齐横切边
- 豁免审批跳步（FM-EXEMPT-01/02/03/04/05）→ 回到豁免审批对应阶段（S/R/V/人类）
- 验收测试未覆盖全部功能点 → 回到并行任务，补充用例

## 退出状态

项目 `status` 更新为 `系统设计`。
