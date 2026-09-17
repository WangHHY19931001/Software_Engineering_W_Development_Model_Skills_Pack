# 快速自检（Quick Self-Check）

> 在任何推进或完成声明前核验的清单。
> 编排者（O）在阶段门 / 发布放行前对照本清单逐项确认；与 [hard-constraints.md](hard-constraints.md) 反模式库互补（清单是检查点，反模式是负面知识库）。

- [ ] 触发边界已正确判断，歧义请求已经确认
- [ ] 上游产物与项目状态一致
- [ ] 当前阶段开发产物和对应测试设计均已完成
- [ ] RTM 已同步且没有估算值
- [ ] 真实测试/门禁证据可复核
- [ ] 当前 🔴 CHECKPOINT 已获得用户明确决定
- [ ] 未一次性加载无关参考文件
- [ ] **编排者未越权实施**：会话内无 `Write` / `Edit` 写阶段产物文件（含 .tla/.cfg/tla-manifest.json 实体）、无直接产出的 `VerifierOutput` JSON 内容、无生成的代码或测试用例；所有实施动作均由 S / V / G 子代理执行（反模式 #10）
- [ ] **图谱校验通过**：阶段 1–4 的 `check-requirement-graph.ts` 退出码 0；阶段 4 零违反硬约束达成才放行进编码
- [ ] 图谱信息流无黑洞/奇迹/死模块，且边界（EXT-IN/EXT-OUT）完整（`check-requirement-graph.ts` 退出码 0，`GRAPH_JSON.dataflowViolations` 全空）
- [ ] **TLA+ 行为门禁通过**（约束 #13，L2+ 必跑）：阶段 1–4 的 `check-tla-model.ts` 退出码 0（`TLA_JSON.passed=true`）；phase>=2 时强制 `--graph=<graph.json>`，manifest 须含 sdCoverage 且 `uncoveredSdNodes` 为空（由 S-ingest-tla 回填）；阶段 4 TLA+ 零违反（无死锁/不变式违反/状态爆炸/拆解决策合规）+ 图谱零违反才放行进编码；TLA+ 规格无占位/简化/错误实现（反模式 #16）；建模与需求/设计一致（反模式 #17）
- [ ] **BDD 行为门禁通过**（约束 #13，L2+ 必跑）：项目阶段门使用 [bdd.md §5.3](bdd.md#53-调用方式) 的完整参数组合：阶段 1-4 均传 `--require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json`，阶段 2-4 额外传 `--graph=.w-model/ingestion/graph.json`；阶段 5-8 均传 `--graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=<真实报告路径>`。D1-D8 全通过（D1 头标注 / D2 Gherkin 语法 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射 / D8 SD Coverage）；BDD features 无占位/简化/错误实现，建模与需求/设计/TLA+ 一致（反模式 #29）
- [ ] **Phase 2 系统设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **Phase 3 概要设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **Phase 4 详细设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **阶段5 codeModule 回填**：RTM.codeModule 列已回填（格式 SD-xxx:src/path，编码后强制）；缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1
- [ ] **阶段门放行已填理解证据**：run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行（见本文件「完成定义（DoD）」节 第六维度）
- [ ] **预算与成熟度已检查**：阶段门放行前跑预算检查（超 `budget.json` 限制按 `onExceed` 处置）；CHECKPOINT 类型由 `maturity.json.level` 决定（L1+ 操作型自动放行仍记录 run-log）；见 [operational-recovery.md](operational-recovery.md)
- [ ] **未验证证据锚点已清零**：`graph.json` 中 `evidenceStatus === 'pending'` 的节点数为 0；存在 pending → 阻断放行，须补验证转 `confirmed`，或走 `exemption` 的 `evidence-anchor-pending` 豁免（S→R→V→人类四阶段）。**常态触发（非返工触发）**：pending 不是缺陷而是"尚未验证"，走 R 会把"没做功课"误判为"产物有缺陷"；若补验证后发现结论站不住，那才触发返工链。见 [evidence-anchored-tree.md](evidence-anchored-tree.md) §3
- [ ] `check-budget.ts` 是否 exitCode=0
- [ ] `check-run-log.ts` 是否 exitCode=0
- [ ] `check-maturity.ts` 是否 exitCode=0
- [ ] `check-checkpoint.ts` 是否 exitCode=0
- [ ] `check-preventive-review.ts` 是否 exitCode=0（R3 三份报告齐全，V 评审前，约束 #11 无条件第 5 脚本）
- [ ] **上下文窗口已清理**：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）
- [ ] **TLA+ 资料按需加载**：S-tla/V-tla 子代理按 [tla-plus.md §13 加载矩阵](tla-plus.md) 加载 4 份参考文件，禁止一次加载全部
- [ ] 反模式 #20（只规划不执行）：确认所有规划都有对应执行动作，未停留在规划阶段
- [ ] 反模式 #21（阶段级门禁跳过）：确认阶段 6/7/8 都跑了 `--phase=N` 门禁，未跳过阶段级校验
- [ ] **JSON 文件写入工具**（反模式 #25）：所有 JSON 文件写入用 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell `ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content`（BOM + 深度 + 中文乱码）。详见 [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节
- [ ] **acknowledgedDecisions 关键词**：每条 `acknowledgedDecisions` 决策条目须命中 ID 模式（`REQ-\d+` / `SD-[\d.]+` / `INTF-[\d.]+` / `DD-[\d.]+` / `TC-\w+-\d+`）或 TECH_KEYWORDS（`REST` / `JWT` / `HTTP` / `状态机` / `不变式` / `接口` / `存储` 等 37 个中英关键词）；「同意」/「确认」/「OK」/「好的」视为空，触发 `check-checkpoint.ts` R2 名词违规。完整集合见 [phase-8-acceptance-test.md](phase-8-acceptance-test.md)「acknowledgedDecisions 决策条目须含关键词」节
- [ ] **调测者简化行为自检**（反模式 #27）：self-as-verifier 模式下每阶段须按 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节自检清单逐条核验（硬约束复述 / reworkHints 非空 / 10 脚本全 exitCode=0 / §9 确认 / 长会话重读硬约束）。命中任一简化倾向（S1 上下文压缩丢细节 / S2 追求效率省步骤 / S3 未对照硬约束核验）回阶段起点
- [ ] **Bundled Resources 按需加载**：会话内已加载的文件清单与「Bundled Resources」表对照，未加载无关文件（约束 #6 可执行化）


## 完成定义（DoD）


> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `references/definition-of-done.md`。
> SSoT §10.6（`docs/skill-design-document_SSoT.md`） 为权威定义，本节为可执行细则。
>
> **与工件质量门的关系**：§10.5 工件质量门（`docs/skill-design-document_SSoT.md`） / [`check-artifact-gate.ts`](../scripts/cli/check-artifact-gate.ts) 是「验收阶段的硬门禁」（退出码 0 才放行）；DoD 是「每次变更的日常标准」（每个 `/wm code` / `/wm test` 后自检）。二者不互替。

### 适用范围

DoD 是项目级跨阶段标准，不替代各阶段产物的验收标准（见各 [`phase-N-*.md`](./)）。Agent 在以下场景必须自检 DoD：

- 每次 `/wm code` 完成代码生成后
- 每次 `/wm test type=<单元|集成|系统|验收> result=<pass|fail>` 回填后
- 每次阶段门评审通过前
- 每次发布检查点（🔴 CHECKPOINT · 发布放行）前

### 七维度标准

| 维度 | 标准 | 验证方式 | 不通过 → 动作 |
|---|---|---|---|
| 测试 | 全部测试通过，无回归 | 测试运行器退出码 0；新增/修改代码须配套测试 | 当场补测试或修复回归，禁止「先放行后补」 |
| 行为 | 运行时验证行为符合规格 | 手动或自动化验证关键路径，不得仅凭单测通过；阶段 1-4 须有 BDD features 作为可执行规格（`check-bdd-model.ts` 退出码 0） | 补运行时验证（curl / Postman / 浏览器 / k6），禁止「单测过即视为行为正确」；阶段 1-4 BDD features 缺失或不通过 `check-bdd-model.ts` 须补产出 |
| 文档 | 涉及 API / 接口 / 数据模型的变更须同步更新文档 | `git diff` 包含相关 `docs/` 与 `templates/` 更新；RTM 字段同步 | 补文档更新，禁止「以代码为准」忽略文档 |
| RTM | 需求 / 设计 / 代码 / 测试映射同步 | `.w-model/rtm.json` 字段无空缺；覆盖率不下降；BDD features 引用按 `<Type>-NNN \| BDD-L<level>-<system>-<num>.feature` 格式登记 | 补登记 RTM 字段，禁止「验收时再补」 |
| 状态 | `Project.status` / `Requirement.status` 如实反映；`graph.json` 节点的 `evidenceStatus` 如实反映验证状态 | 字段值与磁盘产物一致；未完成不得标完成；`evidenceStatus === 'pending'` 的节点数为 0（存在即阻断放行，须补验证转 `confirmed` 或走 `exemption` 第 6 类 `evidence-anchor-pending`） | 修正 `status` 字段，禁止「乐观标记」；`confirmed` 须与签名链对账（`check-requirement-graph.ts` R15e），不得把 pending 直接标 confirmed |
| **理解证据** | 阶段门放行须有用户理解证据 | run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"） | 拒绝放行；要求用户填入理解证据（O4 命中） |
| **签名链完整性** | 每阶段每角色动作写入 `signature-chain.jsonl`；断裂视为 #32 命中 | `check-signature-chain.ts` R1-R10 全通过 | 补齐缺失角色签名与来源证明（详见下方「第七维度」节） |

> 第六维度「理解证据」吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/concepts.md` 的 Comprehension Debt 概念，对抗用户对阶段产物 rubber-stamp。放行 ≠ 理解；`acknowledgedDecisions` 非空才算放行。SSoT §10.6（`docs/skill-design-document_SSoT.md`） 为权威定义。
> 补注：acknowledgedDecisions 非空 = 判据持有者（人）在形式化门禁之外行使记叙性判断——这是"人机分工线"在阶段门上的显式兑现（能形式化 → 门禁校验；不能形式化 → 人类确认）。

**代签判定**：self-as-verifier 代签视为 O4 命中（`signature-chain.jsonl` 中 O checkpoint 签名 `signer` 为 O 角色 ID 即代签）。

### 第七维度：签名链完整性

每阶段每角色动作完成后须写入 `signature-chain.jsonl`；G 角色跑门禁脚本前须校验签名链完整性（R1-R10 全通过）；签名链断裂视为 #32 命中，拒绝放行。

### 信息密度度量

> 文档 DoD 须包含信息密度度量。

**度量项**：
- 关键实体引用密度 ≥ 2/章节（SD-xxx / DD-xxx / REQ-xxx / NFR-xxx / INTF-xxx 等设计文档实体 ID 引用次数 / 章节数）
- 信息密度 < 2/章节 → 命中反模式 #37（产物膨胀但核心决策稀疏）。**阈值与上一行同源**（2026-09-17 审查修复：原写 < 1 造成 [1,2) 空档——既不判命中也不达标）

**校验方式**：V 评审人工校验（无自动脚本）。

### 自检清单

每次 `/wm code` 或 `/wm test` 后，Agent 须确认：

- [ ] 测试套件全过（退出码 0），新增/修改代码有配套测试
- [ ] 关键路径已运行时验证（不仅单测）
- [ ] 阶段 1-4 产出对应层级 BDD features 且按 [bdd.md §5.3](bdd.md#53-调用方式) 传 `--require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json`；阶段 2-4 同时传 `--graph=.w-model/ingestion/graph.json`，退出码 0（BDD↔TLA+ 等价性通过）
- [ ] 涉及 API / 接口 / 数据模型的变更已同步 `docs/` 与 `templates/`
- [ ] `.w-model/rtm.json` 字段无空缺，覆盖率未下降；BDD features 引用按 `<Type>-NNN | BDD-L<level>-<system>-<num>.feature` 格式登记
- [ ] `Project.status` / `Requirement.status` 与磁盘产物一致
- [ ] 阶段门 CHECKPOINT 放行时，run-log `acknowledgedDecisions` 已填入 ≥1 关键决策摘要（非"确认"/"同意"）
- [ ] CHECKPOINT 提问与呈现已按 `command-reference.md`「提问与呈现规范（M04+S17）」节执行（每题一想法、每题必给推荐答案、Push right 只重排不删点、Brief 三段式）
- [ ] 阶段门放行前 `graph.json` 中 `evidenceStatus === 'pending'` 的节点数已为 0（或已有 `evidence-anchor-pending` 豁免覆盖）
- [ ] 无未提交的产物文件（`git status` 工作树干净，或显式说明未提交原因）
- [ ] 未命中 [hard-constraints.md](hard-constraints.md)「反模式」节 48 条流程反模式（#1~#48）、[operation-behaviors.md](operation-behaviors.md) F1~F10 失败模式与 SSoT §4A.2a O1~O6 运维失败模式
- [ ] L2+ 项目：阶段门放行后已审查 Loop 4 产出的 HarnessImprovementReport（若有）；appliedSignals/deferredSignals/rejectedSignals 已填入 applicationStatus
- [ ] 修正权验收测试：用户能在过程中间修改产物而不用整体重跑（不能 = 仅审计权，反模式 #46）
- [ ] 完成度矩阵自检：产品化轴（文档/测试/错误处理/边界/可维护性/可观测性）与系统集成轴（接口对齐/版本兼容/多环境/部署回滚/监控告警/备份）逐项打勾，任一轴缺项即未到 9x

### 与阶段验收标准的关系

| 层级 | 触发时机 | 标准 | 强制性 |
|---|---|---|---|
| DoD（本文件） | 每次变更后 | 七维度自检 | 软性（违反不回退但降低质量） |
| 阶段验收标准 | 阶段门评审时 | 各 `phase-N-*.md` 定义的验收清单 | 硬性（不通过则回退，由 `check-verifier-output.ts` 校验） |
| 工件质量门 | 阶段 8 验收时 | RTM 100% + 四级测试全通过 | 硬性（退出码非 0 不放行，由 `check-artifact-gate.ts` 校验） |

### 反例

| # | 反例 | 正确做法 |
|---|---|---|
| 1 | 「单测过了就行，运行时验证不必做」 | 必须运行时验证关键路径；单测覆盖单元，不覆盖集成行为 |
| 2 | 「文档稍后补」 | 当次变更须同步文档；「稍后补」通常等于「永不补」 |
| 3 | 「RTM 字段空着，验收时一起填」 | RTM 字段在产物生成时即填；空字段等于追溯链断裂 |
| 4 | 「状态先标完成，后面再修」 | 状态如实反映；乐观标记触发反模式 #9（谎报状态） |
| 5 | 「DoD 通过 = 工件质量门通过」 | 二者不互替；DoD 是日常标准，工件质量门是验收门禁 |

### 与 addyosmani/agent-skills 的差异

- addyosmani 的 DoD 是「每次变更」的项目级标准，无阶段概念。
- 本技能的 DoD 适配 W 模型 8 阶段：在每次变更自检基础上，叠加阶段验收标准与工件质量门两层硬门禁。
- 七维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）中，RTM 与状态是 W 模型特有的；测试 / 行为 / 文档与 addyosmani 一致。

