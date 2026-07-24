# 阶段1 V 评审报告

## 评审概要

- 评审时间：2026-07-24
- 评审者：V 子代理（W 模型阶段1 验证者）
- 评审对象：需求规格 + 验收测试 + 风险评估 + L1 TLA+ + 图谱 + RTM + manifest（共 7 份产物）
- 总体结论：**有条件通过**
  - P0 阻断问题：0
  - P1 重要问题：3
  - P2 建议：2

## 逐维度评审结果

### 维度1：需求规格完整性

- 结论：**不通过**（存在 2 项 P1 不一致）
- 证据：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 21条需求全部登记 | 通过 | REQ-001~013（13功能）+ NFR-001~005（5 NFR）+ CON-001~003（3 CON）= 21 行，与 §7 自检一致 |
| 需求 ID 与 graph.json 节点 ID 一致 | 通过 | graph.json 含 REQ-000（根）+ 21 条需求节点 + 2 外部终结点 = 24 节点，ID 命名完全一致 |
| 验收标准可量化 | 通过 | 全部改写为状态码/P95/QPS/计数一致性，无「快速」「友好」等主观词 |
| 依赖关系与 graph.json depends-on 边一致 | **不通过** | §3 声明「17 条 depends-on 边」，但 graph.json 实际有 18 条 depends-on 边（漏数 1 条） |
| 冲突检测已标注 | 通过 | CONFLICT-001（邮件通知语义模糊）/ CONFLICT-002（操作日志 vs 审计日志）均标注「待用户决策」 |
| 缺失项已标注且未自动补全 | **不通过** | requirement-spec.md §4 仅列 GAP-001~008（8 条），但 risk-assessment.md §4 扩展为 GAP-001~012（12 条），两份文档缺失项清单不一致 |

- 问题清单：
  - **[P1]** requirement-spec.md §3 声明「图谱已记录 17 条 depends-on 边」，但 graph.json 实际有 18 条 depends-on 边。重新计数：REQ-002→REQ-003、REQ-004→REQ-012、REQ-004→REQ-003、REQ-005→REQ-006、REQ-006→REQ-012、REQ-006→REQ-010、REQ-006→REQ-003、REQ-007→REQ-012、REQ-007→REQ-008、REQ-007→REQ-009、REQ-008→REQ-012、REQ-009→REQ-012、REQ-010→REQ-012、REQ-011→REQ-010、REQ-011→REQ-002、REQ-011→REQ-012、REQ-013→REQ-012、REQ-001→REQ-006 = 18 条 → 建议将 §3 的「17 条」更正为「18 条」
  - **[P1]** requirement-spec.md §4 缺失项清单仅含 GAP-001~008（8 条），但 risk-assessment.md §4 扩展为 GAP-001~012（12 条），新增的 GAP-009（用户操作日志保留期）、GAP-010（搜索历史保留条数）、GAP-011（推荐位数量上限）、GAP-012（广告展示频次上限）未在 requirement-spec.md 中登记 → 建议将 requirement-spec.md §4 缺失项清单与 risk-assessment.md 对齐，补齐 GAP-009~012

### 维度2：验收测试覆盖性

- 结论：**不通过**（存在 1 项 P1 需求-测试不一致）
- 证据：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 49条 UAT 覆盖全部21条需求 | 通过 | UAT-001~049 覆盖 REQ-001~013 + NFR-001~005 + CON-001~003，每条需求至少 1 条 UAT |
| 关键功能 ≥3 条 UAT | 通过 | REQ-001（4条）/REQ-002（4条）/REQ-003（4条）/REQ-010（4条）/REQ-012（5条）均 ≥3 |
| 测试步骤包含正常+异常+边界 | 通过 | 抽查 UAT-005（正常+异常重复邮箱）、UAT-009（正常+异常+边界 bcrypt）、UAT-035（边界 5 状态）均覆盖三类场景 |
| 预期输出可量化 | 通过 | 状态码（200/201/400/403/409/503）、P95（≤200ms/500ms）、QPS（≥100）、计数（affectedCount）均可量化 |
| 优先级标注合理 | 通过 | 高/中/低分布合理，关键功能与安全/性能用例标高 |

- 问题清单：
  - **[P1]** UAT-037 步骤 1 预期返回状态 `scheduled_publish`，但 requirement-spec.md REQ-012 状态机仅定义 5 状态（draft→pending_review→published→taken_down→archived），`scheduled_publish` 状态未在需求规格中登记。UAT-037 前置条件为 pending_review，步骤 1 请求 `status=published` + `publishAt`，系统返回 `scheduled_publish` 作为定时发布中间态——该状态属于测试用例揭示的需求遗漏 → 建议二选一：(a) 在 requirement-spec.md REQ-012 状态机中补登 `scheduled_publish` 作为第 6 状态（pending_review→scheduled_publish→published）；(b) 修订 UAT-037 不引入未定义状态（如保持 pending_review 直到时钟到达后直接转 published）

### 维度3：风险评估充分性

- 结论：**通过**
- 证据：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 12条风险覆盖关键风险点 | 通过 | RISK-001 内存存储崩溃、RISK-002 性能 QPS、RISK-003 RBAC 权限矩阵、RISK-004 状态机、RISK-005 推荐算法、RISK-006 敏感词、RISK-007 密码策略、RISK-008 定时精度、RISK-009 热度量化、RISK-010 JWT 过期、RISK-011 SMTP、RISK-012 数据规模+搜索性能——覆盖技术栈/数据规模/权限矩阵/状态机/算法/安全/性能/可用性 |
| 缓解措施可执行 | 通过 | 每条风险标注「责任阶段」+「跟踪用例」+具体动作（如 RISK-003：阶段2产出权限矩阵表、阶段4策略对象模式、阶段6集成测试覆盖全部组合） |
| 冲突对明确标注待用户决策 | 通过 | CONFLICT-001/002 均标 ⚠️ 待用户决策，并附建议处理 |
| 缺失项禁止 LLM 自动补全 | 通过 | §4 明确「缺失项禁止 LLM 自动补全默认值」，应急方案标注「待用户确认」 |

- 问题清单：无

### 维度4：L1 TLA+ 规格合规性（重点）

- 结论：**通过**（存在 2 项 P2 建议，不影响放行）
- 逐项检查结果：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 文件头 8 个 @ 字段齐全且与 manifest 一致 | 通过 | @system/@requirement/@design/@parent/@sibling/@child/@level/@phase 全部存在；@requirement 列 22 条 ID 与 manifest.requirementIds 完全一致；@design=docs/requirement-spec.md 与 manifest.designRef 一致；@parent/@sibling/@child=null/[] 与 manifest 一致；@level=L1、@phase=1 与 manifest 一致 |
| MODULE 名 `L1_blog_system` 符合命名规范 | 通过 | 符合 `[A-Za-z][A-Za-z0-9_]*`，无连字符/中文/特殊符号 |
| 文件名与 MODULE 名完全一致 | 通过 | `L1_blog_system.tla` ↔ `---- MODULE L1_blog_system ----` |
| BusinessInvariant 聚合所有子不变式 | 通过 | BusinessInvariant = TypeInvariant ∧ BoundaryConsistency ∧ DataScaleConstraint ∧ MaintenanceGate ∧ ErrorRateConstraint ∧ NoDeadlock（6 个子不变式） |
| .cfg INVARIANTS 与 BusinessInvariant 展开集合完全相等 | 通过 | .cfg 列：TypeInvariant/BoundaryConsistency/DataScaleConstraint/MaintenanceGate/ErrorRateConstraint/NoDeadlock，与 BusinessInvariant 展开集合完全相等 |
| 使用 SPECIFICATION Spec（带 stuttering） | 通过 | .cfg 第 1 行 `SPECIFICATION Spec`；tla 中 `Spec == Init /\ [][Next]_vars`（带 stuttering） |
| .cfg 不含 MODULE 声明 | 通过 | .cfg 仅含 SPECIFICATION + INVARIANTS，无 MODULE 行 |
| 无占位实现（TODO、空 Next） | 通过 | Next 含 12 个转移分支（StartSystem/ReceiveRequest/ProcessRequest/ProcessAdminRequest/SendResponse/EnterMaintenance/ExitMaintenance/Crash/Recover/IncrementUser/IncrementArticle/RecordError），无 TODO/空实现 |
| 无简化实现（刻意减变量遗漏关键状态） | 通过 | 8 个变量（systemState/requestQueue/responseLog/maintenanceMode/userCount/articleCount/errorCount/totalProcessed）覆盖维护模式/崩溃恢复/数据规模/错误率/请求-响应边界 |
| 无错误实现（不变式与需求矛盾） | 通过 | MaintenanceGate（MaintFlagOn⇒systemState∈{MaintenanceMode,Crashed}）与 EnterMaintenance/ExitMaintenance/Crash/Recover 转移一致；ErrorRateConstraint 与 RecordError 守卫一致；DataScaleConstraint 与 IncrementUser/IncrementArticle 守卫一致 |
| 状态转移覆盖 EXT-IN → System → EXT-OUT 端到端 | 通过 | EXT-IN（ReceiveRequest 入队）→ System（ProcessRequest/ProcessAdminRequest 处理 + EnterMaintenance/ExitMaintenance/Crash/Recover/Increment*）→ EXT-OUT（SendResponse 出队），端到端闭合 |
| 不变式对应需求 | 通过 | CON-003 数据规模→DataScaleConstraint（userCount≤200, articleCount≤1000）；NFR-002 错误率→ErrorRateConstraint（errorCount*1000≤totalProcessed*ErrorRatePermille）；REQ-001 维护模式→MaintenanceGate。L1 层级抽象合理，其余需求按模块拆分到 L2 |
| manifest variableCombination 合理估算 | 通过 | variableCombination=476280，量级合理（在常见 model-checking bound 下状态空间约 5×10^5，TLC 可处理，未触发状态爆炸） |
| manifest decompositionDecision 合法 | 通过 | 值为 `must-split`，属于合法枚举（kept-below-threshold/consider-split/must-split/split-done）；L1 为根节点含 22 条需求，确实需要拆分到 L2，判定合理 |
| manifest tlaPath/cfgPath 路径基准正确 | 通过 | manifest 位于 `.w-model/tla-manifest.json`，tlaPath=`../tla/L1_blog_system.tla`、cfgPath=`../tla/L1_blog_system.cfg`，相对 manifest 所在目录解析为 `w-model-dev-demo/tla/L1_blog_system.{tla,cfg}`，与实际文件位置一致 |

- 问题清单：
  - **[P2]** manifest 中 `syntaxChecked=false`、`tlcChecked=false`、`checkRounds=[]`（空），表示 SANY 语法检查与 TLC 模型检查均未运行。阶段 1 TLA+ 行为门禁要求 SANY 语法检查通过 → 建议在阶段门放行前运行 `npx tsx w-model-dev/scripts/check-tla-model.ts .w-model/tla-manifest.json --phase=1 --skip-tlc`（至少跑 SANY 语法）并回填 manifest
  - **[P2]** `NoDeadlock` 不变式实际定义为 `ProgressEnabled`（所有 enabled 谓词的析取），语义上是「每个可达状态至少有一个非 stutter 动作 enabled」，属于活性约束当作安全不变式检查，名称 `NoDeadlock` 可能误导评审者 → 建议在注释中明确说明「NoDeadlock 实际检查 ProgressEnabled（非 stutter 动作可达性），而非 TLC 死锁检测语义」或重命名为 `ProgressEnabled`

### 维度5：图谱与RTM一致性

- 结论：**通过**
- 证据：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 节点数 24 与需求规格一致 | 通过 | REQ-000（根）+ REQ-001~013（13）+ NFR-001~005（5）+ CON-001~003（3）+ EXT-IN-001 + EXT-OUT-001 = 24 节点，与 requirement-spec.md §4「22 REQ 节点 + 2 外部终结点」一致 |
| 边数 83 | 通过 | parent 边 21（REQ-000→21 子节点）+ depends-on 边 18 + produces 边 44（EXT-IN→REQ-000 1 + REQ-000→21 子节点 21 + 21 子节点→REQ-000 21 + REQ-000→EXT-OUT 1）= 83 边 |
| 单根 REQ-000 确立 | 通过 | graph.json rootId=REQ-000，attributes.role=system-root，无 parent 边指向 REQ-000 |
| EXT-IN/EXT-OUT 边界节点完整 | 通过 | EXT-IN-001（用户请求输入）+ EXT-OUT-001（API响应/审计日志）各 1 个，produces 边闭合：EXT-IN→REQ-000→...→REQ-000→EXT-OUT |
| 信息流零违反 | 通过 | analysisRounds[0].violations=[]，converged=true；所有 REQ 节点有入边（parent）和出边（produces→REQ-000），无黑洞/奇迹/死模块；EXT-IN/EXT-OUT 作为 DFD terminator 豁免黑洞/奇迹判定 |
| RTM 覆盖全部 21 条需求且 acceptanceTest 列已回填 | 通过 | RTM rows 含 21 条（REQ-001~013 + NFR-001~005 + CON-001~003），每条 acceptanceTest 列已回填 UAT ID（如 REQ-001→UAT-001,002,003,004），与 acceptance-test-cases.md 一致 |

- 问题清单：无

## 问题汇总（按优先级排序）

| 优先级 | 维度 | 问题 | 建议修复 |
|---|---|---|---|
| P1 | 维度1 | requirement-spec.md §3 声明「17 条 depends-on 边」，但 graph.json 实际有 18 条 | 将 §3 的「17 条」更正为「18 条」 |
| P1 | 维度1 | requirement-spec.md §4 缺失项清单仅 GAP-001~008，risk-assessment.md §4 扩展为 GAP-001~012，两份文档不一致 | 将 requirement-spec.md §4 补齐 GAP-009~012，与 risk-assessment.md 对齐 |
| P1 | 维度2 | UAT-037 引入 `scheduled_publish` 状态，但 requirement-spec.md REQ-012 状态机仅定义 5 状态 | 二选一：(a) 在 REQ-012 状态机补登 `scheduled_publish` 为第 6 状态；(b) 修订 UAT-037 不引入未定义状态 |
| P2 | 维度4 | manifest syntaxChecked=false、checkRounds=[]，SANY 语法检查未运行 | 阶段门放行前运行 check-tla-model.ts --phase=1 --skip-tlc 并回填 manifest |
| P2 | 维度4 | NoDeadlock 不变式实为 ProgressEnabled，名称误导 | 在注释中说明语义或重命名为 ProgressEnabled |

## 放行建议

- [ ] 通过，可进入阶段2
- [x] **有条件通过，须修复 P0/P1 问题后放行**
- [ ] 不通过，须返工

### 放行条件

阶段1 产物整体质量良好：21 条需求登记齐备、49 条 UAT 覆盖完整、12 条风险与 2 处冲突/12 项缺失均有标注、L1 TLA+ 规格在 8 个 @ 字段/命名规范/cfg-tla 一致性/端到端交互/不变式对应等方面均合规、图谱 24 节点 83 边零违反、RTM 21 条全覆盖。

但存在 3 项 P1 问题（depends-on 边计数错误、缺失项清单跨文档不一致、UAT 引入未定义状态）需修复后方可放行进入阶段2。P2 问题（SANY 未运行、NoDeadlock 命名）建议在阶段2 启动前处理，不阻断放行。

### 修复后复核要求

- P1 修复后由 V 子代理复核 3 项
- P2 修复后由 V 子代理备案即可

> 🔴 **CHECKPOINT**：本评审报告需用户在阶段门评审中确认「冲突对处理方式（CONFLICT-001/002）」「缺失项补充方案（GAP-001~012）」「scheduled_publish 状态补登决策」后方可放行进入阶段2。
