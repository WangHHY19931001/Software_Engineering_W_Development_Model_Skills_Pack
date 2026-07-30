# 第二十四轮（2026-07-30）技能包修正设计规格

> **创建日期**：2026-07-30
> **轮次**：Round 24
> **触发原因**：Round 23 完整 8 阶段调测暴露 10 项技能包层面问题
> **修正范围**：10 项全修（P0→P1→P2→P3 分 4 批分层增量）
> **执行模式**：待定（spec 评审后由用户选择 Subagent-Driven / Inline）

---

## 一、背景

Round 23 采用"编排者-子代理分派 + self-as-verifier + R3 预防审查"模式完成 32 需求 / 630 测试的完整 8 阶段调测。调测过程中暴露 10 项技能包层面的问题，经 search 子代理在 skill 文件中逐项验证，确认：3 项部分存在（基础约束已有但缺关键执行机制）、7 项确实存在（完全缺失关键内容）。

本 spec 定义 10 项问题的修正设计，按 P0→P1→P2→P3 分 4 批分层增量执行，每批完成后跑 self-test 验证。

---

## 二、问题清单与验证结论

| # | 问题 | 验证结论 | 修正优先级 | 根因摘要 |
|---|---|---|---|---|
| 1 | 门禁脚本声明通过与实际执行脱节 | 部分存在 | P3 | 约束 #4/#10 已有，但缺"贴出 stdout 末尾 N 行"具体要求；反模式 #27 未显式覆盖"门禁脚本未实跑"形态 |
| 2 | RTM 实体未真正回填 | 部分存在 | P0 | S-rtm 无触发时机硬约束；coverageStatus 字段未硬校验；阶段门未强制 RTM 回填证据展示 |
| 3 | R3 预防审查启用但未实执行 | 部分存在 | P1 | check-preventive-review.ts 未焊死在 CHECKPOINT 强制执行链；触发依赖人工；run-log R3 记录数未硬编码校验 |
| 4 | 性能基线未区分生产目标值与测试环境基线 | 确实存在 | P2 | NFR 字段无 targetValue + testThreshold 双字段；schema 无双值；测试环境基线未定义 |
| 5 | 路由顺序设计指导缺失 | 确实存在 | P2 | interface-design.md 模板无"路由注册顺序约束"节；phase-3 无路由顺序指导 |
| 6 | 状态机设计文档与代码实现一致性无自动校验 | 确实存在 | P1 | 无 check-state-machine-consistency.ts；现有脚本校验"代码↔TLA+"，不校验"设计文档↔代码" |
| 7 | 图谱规模阈值靠补丁达成 | 确实存在 | P2 | 无边数下限阈值；无语义来源占比指导；无违反数与边数比例健康度指标 |
| 8 | 子代理产出文件大小达标但信息密度不均 | 确实存在 | P3 | 无"信息密度"指标；无产物信息熵/决策密度度量；无相关反模式 |
| 9 | 编排者对子代理任务边界把控不严 | 确实存在 | P0 | 无"每角色必须至少分派一次"硬约束；无 check-role-dispatch.ts；漏派检测信号未明确 |
| 10 | self-as-verifier 模式下 V/G/R 独立性存疑 | 确实存在 | P1 | self-as-verifier 模式无正式定义；未规定兼任时独立产物文件；启用条件未定义 |

**优先级调整说明**（对比 Round 23 初判）：
- 问题 2 和 9 上调至 P0：两者是信息流硬约束，影响整个流程的可追溯性和角色分派完整性
- 问题 1 下调至 P3：约束 #4/#10 已有基础，只是缺"贴出 stdout 末尾 N 行"这一具体要求，风险较低

---

## 三、修正架构

### 3.1 分层策略

```
P0（信息流硬约束）→ P1（行为正确性）→ P2（设计指导）→ P3（质量度量）
     问题 2, 9           问题 3, 6, 10      问题 4, 5, 7       问题 1, 8
```

每批改动跨 5 层：
1. **SKILL.md**：约束块 / 反模式条目 / 执行工作流
2. **references/**：阶段指导 / 角色指导 / 质量标准
3. **templates/**：产出模板字段
4. **schemas/**：JSON Schema 字段
5. **scripts/**：门禁脚本逻辑 + self-test 用例 + samples

### 3.2 依赖关系

```
P0 问题 9（角色分派完整性）
  └─→ P1 问题 3（R3 实执行）：check-preventive-review.ts 焊死在 CHECKPOINT 依赖角色分派完整性校验
  └─→ P1 问题 10（self-as-verifier 独立性）：兼任时独立产物依赖角色定义

P0 问题 2（RTM 回填）
  └─→ P3 问题 1（stdout 贴出）：RTM 回填证据展示与 stdout 贴出同属 CHECKPOINT 证据展示机制

P1 问题 6（状态机一致性）
  └─→ 无下游依赖（独立脚本）

P2 问题 4, 5, 7 互不依赖，可并行
P3 问题 1, 8 互不依赖，可并行
```

---

## 四、P0 层详细设计（信息流硬约束）

### 4.1 问题 2：RTM 实体未真正回填

**根因**：S-rtm 无触发时机硬约束；coverageStatus 字段未硬校验；阶段门未强制 RTM 回填证据展示。

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| SKILL.md | 约束块 | 新增约束 #18："RTM 实体每阶段必须回填；S 子代理产出后须更新 `.w-model/rtm.json`；阶段门 CHECKPOINT 须展示 RTM 文件路径与 coverage 字段" |
| references | subagent-delegation.md | §S 子代理职责增加"RTM 实体回填是 S 子代理的强制职责，不得委托给其他角色；S 子代理返回时须列出 rtm.json 文件路径与 coverage 百分比" |
| references | phase-8-acceptance-test.md | §终检执行增加"check-artifact-gate.ts 须校验 rtm.json 存在 + coveragePercent ≥ 100 + 四级测试通过字段非空" |
| scripts | check-artifact-gate.ts | 增加 RTM coveragePercent 硬校验：< 100 → exitCode 1（当前仅校验存在性 + JSON 合法性） |
| scripts | gate-logic.ts | 增加 coverageStatus 字段校验：值为"100%"或"部分"时须与 coveragePercent 一致；"待覆盖" → exitCode 1 |
| scripts | self-test.ts | 新增 test case：RTM coveragePercent=80 → exitCode=1；RTM coverageStatus="100%" 但 coveragePercent=80 → exitCode=1 |
| samples | gate/ | 新增 bad-rtm-coverage-below-100.json；bad-rtm-status-mismatch.json |

### 4.2 问题 9：编排者对子代理任务边界把控不严

**根因**：无"每角色必须至少分派一次"硬约束；无 check-role-dispatch.ts；漏派检测信号未明确。

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| SKILL.md | 约束块 | 新增约束 #19："编排者每阶段须至少分派 S/V/G 三角色各 1 次；R3 启用时须分派 R 角色；self-as-verifier 模式下兼任时须产出各角色独立产物文件" |
| SKILL.md | 执行工作流 | §6 每阶段分派时序增加"O 须在 CHECKPOINT 前确认 run-log 中含 role=S/V/G 各 ≥1 条记录" |
| references | subagent-delegation.md | 新增 §"角色分派完整性校验"：定义 S/V/G/R 四角色的必分派条件、可选条件、豁免条件 |
| references | anti-patterns.md | 新增反模式 #34："编排者漏派角色——run-log 中某阶段缺 role=V 或 role=G 记录" |
| scripts | 新增 check-role-dispatch.ts | 校验 run-log 中每阶段含 S/V/G 各 ≥1 条记录；R3 启用时含 R ≥3 条记录（completeness/reliability/security） |
| scripts | self-test.ts | 新增 test case：缺 role=V → exitCode=1；缺 role=G → exitCode=1；R3 启用缺 role=R → exitCode=1 |
| schemas | run-log.schema.json | role 字段枚举增加校验：每阶段至少含 S/V/G 各 1 条 |
| samples | run-log/ | 新增 bad-missing-V-role.jsonl；bad-missing-G-role.jsonl；bad-missing-R-role.jsonl |

---

## 五、P1 层详细设计（行为正确性）

### 5.1 问题 3：R3 预防审查启用但未实执行

**根因**：check-preventive-review.ts 未焊死在 CHECKPOINT 强制执行链；触发依赖人工；run-log R3 记录数未硬编码校验。

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| SKILL.md | 约束 #12 | 闭环机制强制校验 4 脚本扩展为 5 脚本：增加 check-preventive-review.ts（R3 启用时） |
| references | phase-1-requirements.md | §R3 完整性维度校验增加"check-preventive-review.ts 须在 V 评审前由 G 子代理执行，exitCode=0 方可进入 V 评审" |
| scripts | check-run-log.ts | R1-R7 规则增加 R8："R3 启用时，run-log 中 S→V 之间须含 3 条 role=R 记录（completeness/reliability/security）" |
| scripts | check-preventive-review.ts | 增加 --auto-trigger 模式：从 run-log 读取当前阶段，自动校验对应阶段的 3 份 R3 报告 |
| scripts | self-test.ts | 新增 test case：R3 启用但缺 completeness 报告 → exitCode=1；R3 报告存在但 finding 字段为空 → 警告但不 fail |

### 5.2 问题 6：状态机设计文档与代码实现一致性无自动校验

**根因**：无 check-state-machine-consistency.ts；现有脚本校验"代码↔TLA+"，不校验"设计文档↔代码"。

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| scripts | 新增 check-state-machine-consistency.ts | 解析 detailed-design.md 中的状态转移表（Markdown 表格）与 src/state-machines/*.ts 中的 TRANSITIONS 定义，校验状态集 + 转移集一致 |
| references | tla-plus-guide.md | 新增 §"设计文档 ↔ 代码状态机一致性"：定义校验范围、豁免条件、误报处理 |
| scripts | self-test.ts | 新增 test case：设计文档有 `draft→published` 但代码缺 → exitCode=1；代码有 `archived→deleted` 但设计文档缺 → exitCode=1 |
| samples | 新增 state-machine/ | bad-missing-transition.json；bad-extra-transition.json；valid-consistent.json |

### 5.3 问题 10：self-as-verifier 模式下 V/G/R 独立性存疑

**根因**：self-as-verifier 模式无正式定义；未规定兼任时独立产物文件；启用条件未定义。

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| SKILL.md | 新增 §self-as-verifier 模式 | 定义：单 Agent 兼任 S/V/G/R 多角色；启用条件：仅 demo 项目 / 非生产项目；独立性保证：兼任时须产出各角色独立产物文件 |
| references | verifier-spec.md | 新增 §self-as-verifier 模式：定义 V 评审产出独立性要求（VerifierOutput JSON 须独立产出，不得与 S 产出混合） |
| references | agent-personas.md | 新增 §self-as-verifier 兼任规则：S/V/G/R 任两角色由同一 Agent 兼任时，须产出独立的 VerifierOutput JSON / RootCauseReport / gate-logs JSON 文件 |
| references | anti-patterns.md | 新增反模式 #35："self-as-verifier 模式下 V/G/R 产物混合——评审报告与产出文档在同一文件中" |
| scripts | check-verifier-output.ts | 增加校验：self-as-verifier 模式下 VerifierOutput JSON 文件路径不得与 S 产出文件路径相同 |
| scripts | self-test.ts | 新增 test case：VerifierOutput 路径与 S 产出路径相同 → exitCode=1 |

---

## 六、P2 层详细设计（设计指导）

### 6.1 问题 4：性能基线未区分生产目标值与测试环境基线

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| templates | requirement-spec.md | NFR 字段增加 targetValue（生产目标值）+ testThreshold（测试环境基线）双字段 |
| templates | system-test.md | 新增 §"性能度量环境声明"：须声明测试环境（CI/full-suite/isolated）与对应阈值 |
| schemas | rtm.schema.json | NFR 行增加 targetValue + testThreshold 字段（可选，NFR 类型时推荐） |
| references | quality-standards.md | §性能指标监控增加"生产目标值 vs 测试环境基线"区分指导 |
| scripts | check-artifact-gate.ts | NFR 类型 RTM 行校验 targetValue + testThreshold 字段存在性（警告级，不 fail） |

### 6.2 问题 5：路由顺序设计指导缺失

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| templates | interface-design.md | 新增 §"路由注册顺序约束"：静态路径先于参数路径；鉴权路由先于公开路由；须列出注册顺序表 |
| references | phase-3-outline-design.md | 新增 §"路由顺序约束"：框架级约束（Express/Koa 等）+ 设计级约束（鉴权前置/限流前置） |
| references | anti-patterns.md | 新增反模式 #36："路由顺序错误——参数路径先于静态路径导致拦截" |

### 6.3 问题 7：图谱规模阈值靠补丁达成

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| references | graph-guide.md | 新增 §"边数下限与语义来源占比"：边数下限按节点数比例（边 ≥ 节点 × 3）；语义来源占比 ≥ 80%（从设计文档实体派生的边占比） |
| scripts | graph-logic.ts | 增加边数下限校验（边 < 节点 × 3 → 警告）；增加语义来源占比校验（< 80% → 警告） |
| scripts | self-test.ts | 新增 test case：边数 = 节点 × 2 → 警告；语义来源占比 60% → 警告 |

---

## 七、P3 层详细设计（质量度量）

### 7.1 问题 1：门禁脚本声明通过与实际执行脱节

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| SKILL.md | 约束 #10 | 增加文案："G 子代理须存档 stdout 到 `.w-model/gate-logs/`；编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行" |
| references | anti-patterns.md | 反模式 #27 S2 增加"门禁脚本未实跑——仅记录 JSON 摘要未真实执行命令"作为独立可命中信号 |
| references | phase-8-acceptance-test.md | §终检执行增加"编排者须贴出 check-artifact-gate.ts stdout 末尾 5 行作为放行证据" |

### 7.2 问题 8：子代理产出文件大小达标但信息密度不均

**修正项**：

| 层 | 文件 | 改动 |
|---|---|---|
| references | quality-standards.md | §文档质量标准增加"信息密度"指标：实体引用次数 / 章节数（如 SD-xxx 引用次数 / 章节数 ≥ 2） |
| references | definition-of-done.md | §文档 DoD 增加"信息密度"度量：关键实体引用密度 ≥ 2/章节 |
| references | anti-patterns.md | 新增反模式 #37："产物膨胀但核心决策稀疏——文件大小达标但实体引用密度 < 1/章节" |

---

## 八、验证策略

### 8.1 每批验证

每批（P0/P1/P2/P3）完成后须通过：
1. `npx tsc --noEmit`（TypeScript strict 0 错误）
2. `npx vitest run scripts/__tests__/self-test.ts`（self-test 全通过）
3. `npx vitest run scripts/__tests__/`（全部门禁脚本测试通过）
4. 版本号一致性校验（SKILL.md 与 skill-metadata.json 的 version 一致）

### 8.2 全量验证

4 批全部完成后须通过：
1. 上述每批验证全部通过
2. 新增/修改的 samples 全部被 self-test 覆盖
3. 新增约束 #18/#19 与反模式 #34/#35/#36/#37 在 anti-patterns.md 中编号连续无冲突
4. 新增脚本 check-role-dispatch.ts / check-state-machine-consistency.ts 在 scripts/ 目录中存在且可执行

### 8.3 回归验证

用 Round 23 的 w-model-dev-demo 产物重新跑一遍 8 阶段门禁，确认新增校验不会误报已有产物。

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 新增约束 #18/#19 与已有约束冲突 | 低 | 中 | spec 评审时对照约束 #1-#17 全文 |
| 新增反模式 #34-#37 编号冲突 | 低 | 低 | 对照 anti-patterns.md 已有 #1-#33 |
| check-role-dispatch.ts 误报 self-as-verifier 模式 | 中 | 中 | 增加豁免条件：self-as-verifier 模式下 S/V/G 可同一 run-log 条目，但须有独立产物文件 |
| check-state-machine-consistency.ts 解析 Markdown 表格不稳定 | 中 | 中 | 限制解析范围：仅校验有明确 `| 状态 | 转移 |` 表格格式的章节 |
| 图谱边数下限校验误报小项目 | 中 | 中 | 保留 small-project exemption 机制 |

---

## 十、交付物清单

### 10.1 新增文件

| 文件 | 层 | 所属批次 |
|---|---|---|
| scripts/check-role-dispatch.ts | scripts | P0 |
| scripts/check-state-machine-consistency.ts | scripts | P1 |
| scripts/samples/run-log/bad-missing-V-role.jsonl | samples | P0 |
| scripts/samples/run-log/bad-missing-G-role.jsonl | samples | P0 |
| scripts/samples/run-log/bad-missing-R-role.jsonl | samples | P0 |
| scripts/samples/gate/bad-rtm-coverage-below-100.json | samples | P0 |
| scripts/samples/gate/bad-rtm-status-mismatch.json | samples | P0 |
| scripts/samples/state-machine/bad-missing-transition.json | samples | P1 |
| scripts/samples/state-machine/bad-extra-transition.json | samples | P1 |
| scripts/samples/state-machine/valid-consistent.json | samples | P1 |

### 10.2 修改文件

| 文件 | 所属批次 |
|---|---|
| SKILL.md（约束 #10/#12/#18/#19 + 反模式 #34-#37 + self-as-verifier 模式节） | P0/P1/P2/P3 |
| references/anti-patterns.md（#27 扩展 + #34-#37 新增） | P0/P1/P2/P3 |
| references/subagent-delegation.md（角色分派完整性校验节） | P0 |
| references/phase-8-acceptance-test.md（RTM 校验 + stdout 贴出） | P0/P3 |
| references/phase-1-requirements.md（R3 触发时机） | P1 |
| references/verifier-spec.md（self-as-verifier 模式节） | P1 |
| references/agent-personas.md（self-as-verifier 兼任规则） | P1 |
| references/quality-standards.md（信息密度 + NFR 双值） | P2/P3 |
| references/definition-of-done.md（信息密度度量） | P3 |
| references/graph-guide.md（边数下限与语义来源占比） | P2 |
| references/phase-3-outline-design.md（路由顺序约束） | P2 |
| references/tla-plus-guide.md（设计文档↔代码状态机一致性） | P1 |
| templates/requirement-spec.md（NFR 双字段） | P2 |
| templates/system-test.md（性能度量环境声明） | P2 |
| templates/interface-design.md（路由注册顺序约束节） | P2 |
| schemas/rtm.schema.json（NFR 双值字段） | P2 |
| schemas/run-log.schema.json（role 枚举校验） | P0 |
| scripts/check-artifact-gate.ts（RTM coverage 硬校验 + NFR 双值校验） | P0/P2 |
| scripts/gate-logic.ts（coverageStatus 校验） | P0 |
| scripts/check-run-log.ts（R8 规则：R3 记录数） | P1 |
| scripts/check-preventive-review.ts（--auto-trigger 模式） | P1 |
| scripts/check-verifier-output.ts（self-as-verifier 独立产物校验） | P1 |
| scripts/graph-logic.ts（边数下限 + 语义来源占比） | P2 |
| scripts/self-test.ts（新增 test cases） | P0/P1/P2/P3 |
| skill-metadata.json（版本号 23.0.0） | 全量 |

### 10.3 版本号

- 当前版本：22.0.0
- 目标版本：23.0.0
- SKILL.md 与 skill-metadata.json 须同步更新

---

## 十一、执行模式选择

spec 评审通过后，用户须选择执行模式：
- **Subagent-Driven**（推荐）：分 4 批分派子代理，每批完成后 review
- **Inline**：单 Agent 顺序执行 4 批

---

## 十二、Spec 自检

- [x] 占位扫描：无 TBD/TODO/占位
- [x] 内部一致性：优先级与问题清单一致；依赖关系与批次顺序一致
- [x] 范围检查：10 项问题全部覆盖；每项含根因 + 修正项 + 验证
- [x] 歧义检查：每项修正的文件路径 + 改动内容明确
- [x] 反模式编号连续：#34/#35/#36/#37 无冲突
- [x] 约束编号连续：#18/#19 无冲突
