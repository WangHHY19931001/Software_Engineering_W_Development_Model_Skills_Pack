# 编排者-子代理边界（Orchestrator-Subagent Boundary）

## dispatch-matrix（权威脚本登记表）

> 工具/命令速查见 [toolbox.md](toolbox.md)（「I have X, I want Y → use Z」决策表，按用户意图组织，与本文档按阶段/角色组织互补）。

> 编排者分派子代理前的必读总览（42.0.0 重构：原独立 dispatch-matrix 文件内容合并为本文件本节）。本节是 subagent-delegation.md 的分派索引视图，不替代正文角色定义。

### 0. 按阶段分节加载导引

> 编排者进入某阶段前，按本导引只加载该阶段所需分节，避免一次性载入全文（反模式 #5）。
> 各阶段对应分节如下：

| 阶段       | 加载分节                                                 | 对应表格                                                           |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| 1 需求     | §1 + §2 + §3（阶段 1 行）+ §6.3（阶段 1 门）             | §3 阶段 1 需求 S-doc/S-tla/S-bdd 三行；§6.3 阶段 1 门禁            |
| 2 系统设计 | §1 + §2 + §3（阶段 2 行）+ §6.3（阶段 2 门）             | §3 阶段 2 系统设计三行；§6.3 阶段 2 门禁                           |
| 3 概要设计 | §1 + §2 + §3（阶段 3 行）+ §6.3（阶段 3 门）             | §3 阶段 3 概要设计三行；§6.3 阶段 3 门禁                           |
| 4 详细设计 | §1 + §2 + §3（阶段 4 行）+ §6.3（阶段 4 门）             | §3 阶段 4 详细设计三行；§6.3 阶段 4 门禁                           |
| 5 编码     | §1 + §2 + §3（阶段 5 行）+ §5 三段式 + §6.3（阶段 5 门） | §3 阶段 5 编码三行；§5 explore/propose/coding 表；§6.3 阶段 5 门禁 |
| 6 集成测试 | §1 + §2 + §3（阶段 6 行）+ §5 三段式 + §6.3（阶段 6 门） | §3 阶段 6 集成测试三行；§5 三段式表；§6.3 阶段 6 门禁              |
| 7 系统测试 | §1 + §2 + §3（阶段 7 行）+ §5 三段式 + §6.3（阶段 7 门） | §3 阶段 7 系统测试三行；§5 三段式表；§6.3 阶段 7 门禁              |
| 8 验收测试 | §1 + §2 + §3（阶段 8 行）+ §5 三段式 + §6.3（阶段 8 门） | §3 阶段 8 验收测试三行；§5 三段式表；§6.3 阶段 8 门禁              |
| 返工循环   | §4 返工循环分派 + §1（R 角色）+ §6.2                     | §4 返工循环表 + S-emergency-fix 表                                 |
| 全阶段通用 | §1 角色速查 + §7 反模式→check 映射                       | §1 角色表 + §7 反模式映射表                                        |

> 阶段 1-4 的 A 子代理 ingestion 子流程见 §2 注（A-chunk/A-cross/A-evolve 分别加载 ingestion-chunk/ingestion-cross/graph-guide）。
> 阶段 5-8 进入 CHECKPOINT 时另跑 ensure-codegraph-opsx（见 §5 依赖引导）。

### 1. 角色速查

| 角色 | 简称   | 职责一句话                                                | 关键禁止动作                 |
| ---- | ------ | --------------------------------------------------------- | ---------------------------- |
| O    | 编排者 | 路由 / 状态 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本 | 不实施任何产物（反模式 #10） |
| S    | 产出   | 生成阶段产物 + 同步测试设计 + 回填 RTM                    | 不跑门禁 / 不改 status       |
| V    | 评审   | 按 targetKind 路由 Persona + 产出 VerifierOutput JSON     | 不改产物 / 不跑门禁          |
| G    | 门禁   | 跑 check 脚本 + 回填证据摘要                              | 不改产物 / 不产出评审        |
| A    | 分析   | 阶段 1-4 分块 / 合并 / 图谱演进                           | 不跑图谱门禁 / 不写正式产物  |
| R    | 根因   | 返工时定位根因 + R3 预防性审查                            | 不实施修复 / 不跨阶段        |

> S 变体（10 种）：S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd（阶段 1-4 拆分）/ S-explore / S-propose / S-coding（阶段 5-8 三段式）/ S-fix / S-emergency-fix（返工）。

### 1.1 S 变体 × R3/V/G 触发矩阵（消歧）

> 事实基准（check-preventive-review.ts 已确认）：R3 变体按**工作类型** 4 种（standard / fix / emergency / ingest），**不按 S 角色拆分**——S-doc / S-tla / S-bdd 共享同一套 standard R3×3。每阶段每变体一套 R3×3 + V×1 + G×1；阶段 5-8 opsx 按段（explore / propose / apply）各一套。消除 18→30 分派漂移歧义。

| 工作类型 variant | 触发场景                                      | R3 报告前缀                    | R3×3 | V×1 | G×1 |
| ---------------- | --------------------------------------------- | ------------------------------ | ---- | --- | --- |
| standard         | 标准 S 产出（S-doc / S-tla / S-bdd 共享一套） | `<phase>-{dim}.json`           | ✅   | ✅  | ✅  |
| fix              | S-fix 返工后                                  | `<phase>-fix-{dim}.json`       | ✅   | ✅  | ✅  |
| emergency        | S-emergency-fix 紧急修复后                    | `<phase>-emergency-{dim}.json` | ✅   | ✅  | ✅  |
| ingest           | S-ingest-tla / S-ingest-bdd 后                | `<phase>-ingest-{dim}.json`    | ✅   | ✅  | ✅  |

阶段 5-8 opsx 三段式（每段各一套 R3×3 + V×1 + G×1）：

| 段      | S 变体    | R3×3 | V×1 | G×1 |
| ------- | --------- | ---- | --- | --- |
| explore | S-explore | ✅   | ✅  | ✅  |
| propose | S-propose | ✅   | ✅  | ✅  |
| apply   | S-coding  | ✅   | ✅  | ✅  |

### 2. 每阶段分派时序

标准流程（约束 #8 + #11 R3 无条件强制）：

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集
O: 🔴 CHECKPOINT · 阶段进入确认
  ↓ 分派 S 产出（阶段 1-4 可拆 S-doc→S-tla→S-bdd；阶段 5-8 拆 S-explore→S-propose→S-coding）
S: 产出阶段产物 + 同步测试设计 + 回填 RTM
  ↓ 分派 R3 ×3（completeness / reliability / security，可并行）
R3: 三份 PreventiveReview JSON
  ↓ 分派 G 跑 check-preventive-review.ts（V 评审前必须 exitCode=0）
G: check-preventive-review.ts 证据
  ↓ 分派 V 评审（V 须读 R3 三份报告）
V: VerifierOutput JSON
  ↓ 分派 G 门禁
G: check-verifier-output.ts + 阶段专属 check 脚本 → {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode≠0 或 qualityLevel∈{C,D} → 按普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）执行（见 §4）
O: 若通过 → 🔴 CHECKPOINT · 阶段门放行（展示 G 证据 + RTM coverage）
O: 用户放行 → 更新 project.status → 进入下一阶段
```

> 阶段 1-4 ingestion 子流程（A→G 路径）：O 跑 plan-chunks.ts → A-chunk ×N → A-cross/A-evolve → G 跑 check-requirement-graph.ts → 收敛循环（MAX_ROUNDS=5）→ CHECKPOINT 收敛确认 → S 产出。

> 阶段 8 终检额外分派 G 跑 check-artifact-gate.ts（无 --phase 参数，终检）。

### 3. 阶段 × S 变体 × 产物 × reference × check 脚本总表

### 阶段 1-4（设计阶段，S 拆分为 S-doc / S-tla / S-bdd）

| 阶段       | S 变体 | 产出物                                                                   | 加载的 reference                                                                     | 触发的 check 脚本                                                                                                 |
| ---------- | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1 需求     | S-doc  | 需求规格 + 验收测试用例 + 风险评估 + uat-path-mapping.md + RTM           | phase-1-requirements / ingestion-chunk / ingestion-cross / graph-guide / rtm-guide   | check-requirement-graph(--phase=1) / check-requirement-coverage / check-verifier-output / check-exemption(豁免时) |
| 1 需求     | S-tla  | L1 TLA+ 规格（.tla + .cfg）+ tla-manifest.json                           | tla-plus                                                                             | check-tla-model(--phase=1) + project pair sync（两份 manifest 真实有效且双向配对后）                              |
| 1 需求     | S-bdd  | L1 BDD features + bdd-manifest.json + RTM acceptanceTest 列              | bdd                                                                                  | check-bdd-model(--phase=1)                                                                                        |
| 2 系统设计 | S-doc  | 系统设计文档 + 系统测试用例（含性能/安全基线）+ RTM                      | phase-2-system-design / ingestion-cross / graph-guide / rtm-guide                    | check-requirement-graph(--phase=2) / check-verifier-output                                                        |
| 2 系统设计 | S-tla  | L2 TLA+ 规格（L1 细化 + L2）+ tla-manifest.json                          | tla-plus                                                                             | check-tla-model(--phase=2, --graph 强制) + project pair sync（两份 manifest 真实有效且双向配对后）                |
| 2 系统设计 | S-bdd  | L2 BDD features（parent→L1）+ bdd-manifest.json + RTM systemTest 列      | bdd                                                                                  | check-bdd-model(--phase=2, --graph 强制)                                                                          |
| 3 概要设计 | S-doc  | 接口设计文档 + 集成测试用例 + RTM                                        | phase-3-outline-design / ingestion-cross / graph-guide / rtm-guide                   | check-requirement-graph(--phase=3) / check-verifier-output                                                        |
| 3 概要设计 | S-tla  | L3 TLA+ 规格（L2 细化 + L3）+ tla-manifest.json                          | tla-plus                                                                             | check-tla-model(--phase=3, --graph 强制) + project pair sync（两份 manifest 真实有效且双向配对后）                |
| 3 概要设计 | S-bdd  | L3 BDD features（parent→L2）+ bdd-manifest.json + RTM integrationTest 列 | bdd                                                                                  | check-bdd-model(--phase=3, --graph 强制)                                                                          |
| 4 详细设计 | S-doc  | 详细设计文档 + 单元测试用例 + RTM                                        | phase-4-detailed-design / ingestion-cross / graph-guide / rtm-guide / coding-quality | check-requirement-graph(--phase=4，零违反硬约束) / check-verifier-output                                          |
| 4 详细设计 | S-tla  | L4 TLA+ 规格（L3 + 按需 L4）+ tla-manifest.json                          | tla-plus                                                                             | check-tla-model(--phase=4, --graph 强制) + project pair sync（两份 manifest 真实有效且双向配对后）                |
| 4 详细设计 | S-bdd  | L4 BDD features（parent→L3）+ bdd-manifest.json + RTM unitTest 列        | bdd                                                                                  | check-bdd-model(--phase=4, --graph 强制)                                                                          |

### 阶段 5-8（编码/测试执行阶段，S 三段式：S-explore / S-propose / S-coding）

| 阶段       | S 变体    | 产出物                                                                                    | 加载的 reference                                    | 触发的 check 脚本                                                                                                                                                                                                        |
| ---------- | --------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5 编码     | S-explore | exploration-analysis.md（方案对比 + codegraph 影响初判）                                  | phase-5-coding / rtm-guide                          | check-codegraph-queries / check-opsx-artifacts                                                                                                                                                                           |
| 5 编码     | S-propose | opsx 产物（proposal/specs/design/tasks）+ tickets.md                                      | phase-5-coding / rtm-guide                          | check-opsx-artifacts                                                                                                                                                                                                     |
| 5 编码     | S-coding  | 代码 + 单元测试 + codegraph-queries 落盘 + code-TLA 校验报告 + RTM codeModule 回填        | phase-5-coding / rtm-guide / quality-standards      | check-code-tla-consistency / check-design-contract-consistency / check-state-machine-consistency / check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=5 cucumber) / check-artifact-gate(--phase=5) |
| 6 集成测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块）                                | phase-6-integration-test / rtm-guide                | check-codegraph-queries / check-opsx-artifacts                                                                                                                                                                           |
| 6 集成测试 | S-propose | opsx 产物 + tickets.md（测试代码切片）                                                    | phase-6-integration-test / rtm-guide                | check-opsx-artifacts                                                                                                                                                                                                     |
| 6 集成测试 | S-coding  | 集成测试代码 + codegraph-queries 落盘 + 测试报告 + RTM integrationTest 回填               | phase-6-integration-test / rtm-guide                | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=6 cucumber) / check-artifact-gate(--phase=6)                                                                                                    |
| 7 系统测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块）                                | phase-7-system-test / rtm-guide / quality-standards | check-codegraph-queries / check-opsx-artifacts                                                                                                                                                                           |
| 7 系统测试 | S-propose | opsx 产物 + tickets.md（测试代码切片）                                                    | phase-7-system-test / rtm-guide / quality-standards | check-opsx-artifacts                                                                                                                                                                                                     |
| 7 系统测试 | S-coding  | 系统测试代码 + codegraph-queries 落盘 + 性能/安全/兼容性报告 + RTM systemTest 回填        | phase-7-system-test / rtm-guide / quality-standards | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=7 cucumber) / check-artifact-gate(--phase=7)                                                                                                    |
| 8 验收测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块）                                | phase-8-acceptance-test / rtm-guide                 | check-codegraph-queries / check-opsx-artifacts                                                                                                                                                                           |
| 8 验收测试 | S-propose | opsx 产物 + tickets.md（测试代码切片）                                                    | phase-8-acceptance-test / rtm-guide                 | check-opsx-artifacts                                                                                                                                                                                                     |
| 8 验收测试 | S-coding  | 验收测试代码 + codegraph-queries 落盘 + 验收报告 + Archive 产物 + RTM acceptanceTest 回填 | phase-8-acceptance-test / rtm-guide                 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-design-contract-consistency / check-openspec-archive                  |

> A 子代理（阶段 1-4 ingestion）：A-chunk 加载 ingestion-chunk / graph-guide；A-cross 加载 ingestion-cross / graph-guide；A-evolve 加载 ingestion-cross / graph-guide。A 不跑 check 脚本（G 负责）。

> V 子代理通用加载：agent-personas / verifier-spec / quick-self-check（完成定义（DoD）节，阶段门时）；评审 BDD 时加 bdd（评审清单节）；评审代码时加 quality-standards。

> O / 全角色通用加载：hard-constraints（14 条硬约束完整版，执行前必读）/ operation-behaviors（八条操作行为 + F1-F10）/ quick-self-check（推进前自检清单）/ design-philosophy（五条设计哲学）/ operational-recovery「成熟度与行为门禁」节（约束 #13 强制级别判定）/ estimation-guide（工期/预算估算时）/ context-management-guide（长会话上下文管理时）。

### 3.1 全 references 触发条件表（43 份 .md，无 stub；行按主题组织）

> `references/` 目录共 43 份 .md（无 stub——42.0.0 的合并已就地完成，不存在重定向文件）。下表按「触发条件」组织，供编排者判断何时加载某文件；**行的粒度是「主题」而非「文件」**：多份合并来源共用一个主题行（如 bdd 行含 BDD 建模 / 语法速查 / 模式示例 / 评审清单），故行数多于文件数。
> 未列入下表的有 `quickstart.md`（入门速查）、`activation-guide.md`（触发边界与反例）与 `code-health-governance.md`（`/wm code-health` 操作参考），按各自场景直接加载；其余文件均有主题行。行内计数以本节为准（历史数字 `59/39/19` 系旧口径，已失效）。
> 标注 **2 跳** 的文件不直接出现在 §3 各阶段 reference 列，需经其上游文件（如 hard-constraints / phase-N / subagent-delegation）间接引用才可达——编排者按需显式加载，勿遗漏。

| 文件                     | 触发条件                                                                                                                                                    | 可达性 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| agent-personas           | V 子代理评审时选用 Persona（code-reviewer/test-engineer/security-auditor/performance-auditor）+ R-lead/V-lead 多角度 persona 选择矩阵（「Persona 矩阵」节） | 1 跳   |
| asset-authoring          | 技能资产编写杠杆 + 渐进披露数字阈值 + 授权不写（no-op test / 指针措辞 / pruning 四刀）                                                                      | 1 跳   |
| bdd                      | BDD 建模指南 + 语法速查 + 模式示例 + 评审清单（42.0.0 合并）                                                                                                | 1 跳   |
| tla-plus                 | TLA+ 层次化建模指南 + 语法速查 + 模式示例 + 评审清单 + TLC 配置（42.0.0 合并）                                                                              | 1 跳   |
| coding-quality           | 设计模式目录（阶段 3/4 设计套用）/ 重构手法与代码坏味道清单（阶段 5 评审 / 重构识别）                                                                       | 1 跳   |
| command-reference        | 全命令 / 错误码 / ERROR_JSON 约定速查；O 分派脚本前                                                                                                         | 2 跳   |
| concurrency-guide        | 阶段 5 并发专项检查 / 并发代码评审时                                                                                                                        | 2 跳   |
| context-management-guide | 长会话上下文管理时（O 通用加载）                                                                                                                            | 1 跳   |
| conventions              | 术语表权威定义 + 格式约定 + 目录约定（42.0.0 三合一）                                                                                                       | 2 跳   |
| data-models              | `.w-model/*.json` 数据模型 / schema 强约束 / RunLogEntry vs EventIngress 边界                                                                               | 2 跳   |
| design-philosophy        | 五条设计哲学（主刀与修正权等）；O 通用加载                                                                                                                  | 1 跳   |
| estimation-guide         | 工期 / 预算估算时（O 通用加载）                                                                                                                             | 1 跳   |
| evidence-anchored-tree   | 路径不确定 / 需求模糊项目的方法论参照（证据支撑树 × W 模型映射，42.1.0 新增）                                                                               | 1 跳   |
| event-ingress-guide      | Loop 3 事件接驳；L2+ 成熟度激活时                                                                                                                           | 2 跳   |
| graph-guide              | 阶段 1-4 图谱门禁与收敛准则（A 子代理 + G）                                                                                                                 | 1 跳   |
| hard-constraints         | 14 条硬约束 + 反模式（48 条，#1~#48）完整版；执行前必读（O 通用加载；42.0.0 吸收反模式清单）                                                                | 1 跳   |
| hill-climbing-guide      | Loop 4 爬坡循环；run-log 分析伴侣                                                                                                                           | 2 跳   |
| iceberg-sweep-guide      | 冰山扫掠深度分析（S-fix 后 ICEBERG-A / 阶段门前 ICEBERG-B）                                                                                                 | 2 跳   |
| ingestion-chunk          | 阶段 1-4 A-chunk 分块细则                                                                                                                                   | 1 跳   |
| ingestion-cross          | 阶段 1-4 A-cross/A-evolve 合并与图谱演进                                                                                                                    | 1 跳   |
| operation-behaviors      | 八条操作行为 + 失败模式 F1-F10；O 通用加载                                                                                                                  | 1 跳   |
| operational-recovery     | 恢复 / 成熟度与行为门禁分级（约束 #13）；O 通用加载                                                                                                         | 1 跳   |
| phase-1-requirements     | 阶段 1 需求细则（含迷雾登记册 Fog of War）                                                                                                                  | 1 跳   |
| phase-2-system-design    | 阶段 2 系统设计细则                                                                                                                                         | 1 跳   |
| phase-3-outline-design   | 阶段 3 概要设计细则                                                                                                                                         | 1 跳   |
| phase-4-detailed-design  | 阶段 4 详细设计细则                                                                                                                                         | 1 跳   |
| phase-5-coding           | 阶段 5 编码细则（codegraph 修改前影响分析）                                                                                                                 | 1 跳   |
| phase-6-integration-test | 阶段 6 集成测试细则                                                                                                                                         | 1 跳   |
| phase-7-system-test      | 阶段 7 系统测试细则                                                                                                                                         | 1 跳   |
| phase-8-acceptance-test  | 阶段 8 验收测试细则                                                                                                                                         | 1 跳   |
| quality-standards        | 阶段 5/7 代码质量 / 评审代码时                                                                                                                              | 1 跳   |
| quick-self-check         | 推进前自检清单 + 完成定义（DoD）七维度；O 通用加载                                                                                                          | 1 跳   |
| root-cause-locator       | R 子代理根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）                                                                                            | 2 跳   |
| rtm-guide                | RTM 维护 / 回填规则                                                                                                                                         | 1 跳   |
| signature-chain-guide    | 角色链式签名 + 产出来源正确性（反模式 #32）                                                                                                                 | 2 跳   |
| skillopt-adoption        | SkillOpt 方法论吸收（bounded edit 边界规则）                                                                                                                | 2 跳   |
| subagent-delegation      | O/A/S/V/G/R 编排者-子代理边界权威定义                                                                                                                       | 1 跳   |
| toolbox                  | 工具/命令速查（「I have X, I want Y → use Z」决策表）                                                                                                       | 1 跳   |
| verifier-spec            | V 子代理评审提示词 + 五轴评审 §7.4A + self-as-verifier 模式                                                                                                 | 1 跳   |
| workflow                 | 完整工作流程（初始化项目 / 阶段切换 / 向用户解释整体流程时）                                                                                                | 2 跳   |

> 2 跳文件共 11 个：command-reference / concurrency-guide / conventions / data-models / event-ingress-guide / hill-climbing-guide / iceberg-sweep-guide / root-cause-locator / signature-chain-guide / skillopt-adoption / workflow。
> 其余 29 个文件均直接出现在 §3 各阶段 reference 列、O/V 通用加载，或由 `SKILL.md`「触发决策」/「门禁契约与资源清单」节直达（1 跳）。

### 3.2 调用分类：人类入口 vs 模型可达

资产按「谁可以到达它」分为两类。分类决定**描述文本写给谁看**，也决定**要不要给它一条指针**。

| 分类                             | 判定           | 本仓库实例                                                            | 描述文本面向                                                                                                     | 到达方式                                                                                                 |
| -------------------------------- | -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **人类入口**（user-invoked）     | 只能由人显式发起 | `/wm` 命令本身（由人键入发起；本仓库**没有**独立的人类入口描述面——`/wm` 的用法见 `SKILL.md`「触发决策」表与 `README.md` 的说明） | **人**——一行摘要，说清"这个入口做什么"                                                                             | 由人键入 `/wm ...` 发起；模型不得代替人发起，其他资产也不得调用它                                        |
| **模型可达**（model-invoked）    | 模型或人都能到达 | 全部 `references/*.md` / `templates/` / `subagent/*.md`，以及 **`SKILL.md` frontmatter 的 `description`**（它是技能的模型激活面，不是人类入口说明） | **模型**——保留丰富触发措辞（"当用户…时 / 请求…时 / 涉及…时"），以便在对应场景自动命中                             | **只能经指针到达**：`SKILL.md` 的「触发决策」表 + 本文件 §3.1 全 references 触发条件表                    |

- **只有独立的人类入口描述面才去掉触发清单**——当某资产**仅**由人显式发起、且存在**面向人的独立描述面**（如 harness 的斜杠命令列表）时，其描述文本只写一行"它做什么"：`当用户说…时` 是写给模型看的，不是写给人看的。**本仓库当前没有这种独立描述面**，故本条目前**无适用对象**。
- **`SKILL.md` frontmatter 的 `description` 按「模型可达」处理**：它是本技能唯一的**模型激活面**（技能靠它在对应场景被自动命中），承载 S02 落地后的触发条件——必须**只写触发条件、不概括工作流**，并**保留**丰富触发措辞（`/wm`、W-model/W 模型/W 开发模型、RTM/阶段门/质量门、开发与测试并行、端到端流程）。**该 description 不属于上一条的"人类入口描述面"，不受"去掉触发清单"约束；不得删除或削减其触发措辞**（这正是 AC-4 的判据）。
- **模型可达资产的描述文本**保留触发措辞，让编排者在对应场景能命中并按需加载；本仓库的「按需加载」契约（反模式 #5 禁止一次性载入全文）依赖这些措辞如实描述触发边界。
- **判定问题：该资产是否会被模型自主需要？** 需要 → 归入模型可达，并给它一条清晰指针（触发表行或显式引用）；不需要 → **不要给它指针**，否则按需加载契约被稀释，模型会在不相关场景提前加载它。

> 本节只讲"谁可达"，与 §3.1 触发表讲"何时加载"互补——触发表是模型可达资产的主要指针来源之一。

### 3.3 跨阶段与跨角色交接的书写规则

交接意图藏在含糊措辞里会降低命中率，甚至把该由人执行的动作写成"由子代理调用"。以下三条为硬性**书写规则**；交接目录与 `status.json` 结构等机制细则见「文件落地交接协议与编排者状态日志」节。

1. **依赖必须写成显式动作句。** 交接写「分派 S 子代理产出 `<X>`，输入为 `<上游路径>`，产出落到 `<下游路径>`」——把**角色 / 产物 / 输入路径 / 落盘路径**四件事写全。不写裸命令式提及（如只出现「见 references/xxx.md」或「/wm test」而不说谁执行、产出落到哪），也不写 `../other/FILE.md` 式跨目录深链：深链假定目标可在包内解析，而跨阶段交接的接收者是子代理而非当前文件，深链不会触发任何加载，命中率随之下滑。
2. **一个动作一个接收者。** 一次分派只指派一个角色做一件事；需要两个角色或两个动作时写两句（「先派 R 子代理定位根因，再派 S 子代理修复」），不写「请 A 和 B 一起处理」——后者会被读成一次调用同时承担两件事，导致其中一件被漏掉。
3. **人类入口不可被模型代达。** 当某步骤的前置是**人类入口**（`/wm` 命令本身、🔴 CHECKPOINT 用户确认等）时，必须写成「告诉用户执行 `<X>`」，不得写成「由子代理调用 `<X>`」——后者命中反模式 #8（越过 🔴 CHECKPOINT 自动推进）与反模式 #10（编排者越权实施）。

### 3.4 禁预判 findings 与 scoped re-review 契约

本节与 §3.3 并列，都是**分派书写规则**：§3.3 规定交接怎么写，本节规定**评审分派与复审轮次怎么写**。适用对象是编排者（写 V 分派 prompt）与 V（执行复审）；它只约束 V 复审的**范围与结论格式**，返工链的其余步骤（R → V → G → S-fix → R3×3 → V → G）顺序与门禁判据一概不变（见 §3.4.6）。

#### 3.4.1 禁止编排者预判 findings

编排者**不得**在 V 分派 prompt 里预判 findings——不得指示评审者忽略某个问题、不要报某个问题，也不得预先给严重度封顶。命中判断是**逐字**的：prompt 里出现下列任一片语，即停下重写。

| 命中片语（逐字）   | 它在做什么                       |
| ------------------ | -------------------------------- |
| `do not flag`      | 指示评审者不要报某个具体问题     |
| `don't treat X as a defect` | 预先豁免某个具体问题     |
| `at most Minor`    | 预先给严重度封顶                 |
| `the plan chose`   | 用「计划已经这么选了」预先驳回 finding |

**处置：停下重写 prompt。** 如果你正在写的 prompt 含上述任一片语，说明你正在预判 findings——这是为了给自己省掉一轮评审；这不是可接受的理由。删掉预判句后重写，把判断留给 V。

**误报的正确出口**：如果你认为某个 finding 会是误报，**让评审者先把它报出来**，在评审回路里裁决（见 §3.4.5）——不得在分派阶段预先压制 finding。

#### 3.4.2 scoped re-review 的范围契约

S-fix 之后的复审是**受范围约束的复审**（scoped re-review），不是第二次全量评审：

- **范围 = findings 清单 + fix diff 两项**；对 findings 清单**逐条**出结论。
- 检查 fix diff 本身**是否引入新问题**。
- **不复审 fix 未触及的代码**：若发现的问题完全落在 fix diff 之外，写入「范围外观察」（Out-of-Scope Observations）——它**不阻塞本任务，也不延长 loop**；整分支的宽范围复审在所有任务完成后单独进行。
- **一轮 = 一次 fix 分派 + 一次 scoped re-review**；**每任务最多 5 轮**。

> 轮次口径：该 5 轮上限**不放松**既有 `budget.json.perPhase.maxReworkRounds` 预算门禁——两者取更严者；达 `maxReworkRounds` 仍须按既有机制强制 🔴 CHECKPOINT 升级（见「失败模式与回退」节 + operational-recovery.md 场景 5）。

#### 3.4.3 逐 finding 结论：ADDRESSED / NOT ADDRESSED

按 findings 清单的**原有顺序**逐条输出：`<finding 一行摘要> — ADDRESSED | NOT ADDRESSED`，并附 `file:line` 证据。

**"Attempted" is not addressed**——「尝试修复」不算已修复：那条**具体缺陷必须已经不存在**；不得以「已改过该段 / 已加注释 / 已说明理由 / 已部分覆盖」结案。缺陷仍可复现即 `NOT ADDRESSED`。

#### 3.4.4 Minor 不进 loop

- Minor finding 记入进度台账：`Task <N>: minor (deferred): <一行摘要>`，并**明确指向最终整分支复审**，由它分诊哪些必须在合入前修完。
- **没人读的汇总等于静默丢弃**：只记录不指向、或指向了不读，等价于丢弃该 Minor。
- **Minor findings never enter the loop**：Minor 不触发 fix 分派、不计入每任务 5 轮上限。

#### 3.4.5 finding 结论与误报质疑的承载通道（零 Schema 变更）

结论与质疑一律以**固定前缀写入既有文本字段**，**不新增字段、不改 `verifier-output.schema.json`**（先例：`verifier-spec.md` 把 R14-R17 四问结论以固定前缀写入 `summary`，:278-281）。

| 内容           | 承载字段（既有）      | 固定前缀                                                          |
| -------------- | --------------------- | ----------------------------------------------------------------- |
| 逐 finding 结论 | `reworkHints`（`string[]`） | `ADDRESSED: <一行摘要> — <file:line 证据>` ／ `NOT ADDRESSED: <一行摘要> — <file:line 证据>` |
| 误报质疑       | `summary` ／ `reworkHints`  | `FALSE-POSITIVE-CHALLENGE: <finding 摘要> — <技术理由 + 反证>`      |

**误报质疑的裁决者是新的 V**（V-lead，或换 Persona 的另一位 V 重新评审），既不是编排者，也不是被质疑的评审者本人：

- 编排者（O）只能**转达与记录**质疑，**不得裁决 finding 成立与否**——O 自行判定 finding 成立/不成立命中反模式 #10（编排者越权实施）。
- 质疑须给出**技术理由与反证**，不得情绪化；质疑不改变 §3.4.2 的范围与轮次契约。
- 质疑未被受理时的升级路径是 🔴 CHECKPOINT（交用户裁决），不是由 O 拍板。

#### 3.4.6 R 前置不变（本节不构成旁路）

scoped re-review 只改变「S-fix 之后那次 V 复审的**范围**」（只审 fix delta），**不改变普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）的前置顺序**：V/G 不通过仍须**先派 R 定位根因**，R 报告经 **V 复审 + G 门禁**（`check-rootcause-report.ts` exitCode=0）后才可分派 S-fix（反模式 #18 / #19）。

**复审不得成为跳过 R 的旁路**：不得以「这次只审 fix delta」「问题很明确」为由省略 R 定位；误报质疑与 scoped re-review 都不是跳过 R 的合法路径。

### 4. 返工循环分派

普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）（约束 #12 + #11 + #8）

| 步骤 | 角色  | 产物                                                             | check 脚本                                     | R3 报告路径前缀          |
| ---- | ----- | ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------ |
| 1    | R     | RootCauseReport JSON + .md                                       | check-rootcause-report                         | —                        |
| 2    | V     | VerifierOutput（targetKind=rootcause）                           | check-verifier-output                          | —                        |
| 3    | G     | gate-logs 证据                                                   | check-rootcause-report + check-verifier-output | —                        |
| 4    | S-fix | 修复后的产物 + RTM 更新                                          | 同原阶段 check 脚本                            | `<phase>-fix-{dim}.json` |
| 5    | R3×3  | 3 份 preventive-review JSON（completeness/reliability/security） | check-preventive-review(--variant=fix)         | `<phase>-fix-{dim}.json` |
| 6    | V     | VerifierOutput                                                   | check-verifier-output                          | —                        |
| 7    | G     | gate-logs 证据                                                   | 原阶段门禁脚本 + 5 闭环脚本                    | —                        |

### S-emergency-fix（紧急修复通道，仅阻塞当前阶段时启用）

| 步骤 | 角色            | 产物                                       | check 脚本                                   | R3 报告路径前缀                |
| ---- | --------------- | ------------------------------------------ | -------------------------------------------- | ------------------------------ |
| 1    | S-emergency-fix | 最小修复（仅阻塞点）+ run-log 标注 blocker | 同原阶段 check 脚本                          | `<phase>-emergency-{dim}.json` |
| 2    | R3×3            | 3 份 preventive-review JSON                | check-preventive-review(--variant=emergency) | `<phase>-emergency-{dim}.json` |
| 3    | V               | VerifierOutput                             | check-verifier-output                        | —                              |
| 4    | G               | gate-logs 证据                             | 原阶段门禁脚本 + 5 闭环脚本                  | —                              |

> 约束 #11：S-fix / S-emergency-fix 与标准 S 一视同仁，产出后须 R3×3 → V → G，不得跳过。跳过命中反模式 #42。事后 R 复核机制（emergencyFixReview 字段）已移除，由前置 R3+V+G 兜底。

> 冰山扫掠（反模式 #44）：S-fix 完成 R3×3 / 预防审查 / V / G 后跑 ICEBERG-A、阶段门放行前跑 ICEBERG-B（`check-iceberg-sweep.ts` R1-R5）；`newFindings=[]` 或达 maxIcebergRounds=5 才放行，新发现须经 V 复审后走完整 R 报告复审、根因门禁、S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT 链。

> 跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。S-fix 之后那次 V 复审（第 6 步）与后续复审轮次按 §3.4「scoped re-review 契约」执行：只审 fix delta、逐 finding 给 `ADDRESSED` / `NOT ADDRESSED`、Minor 不进 loop、每任务最多 5 轮；该契约**不改变本前置**——复审不得成为跳过 R 的旁路。

### 5. 阶段 5-8 三段式 S 分派（opsx + codegraph）

> 约束 #14。每段产物须跑 R3×3 + V 审查（反模式 #39）。
> 依赖引导：阶段 5 进入 CHECKPOINT 时另跑 `ensure-codegraph-opsx.ts`（L1 CLI / L2 MCP / L3 项目目录三层检测 + 自动安装）；阶段 6-8 复检（--mode quick）。

| 段      | S 变体    | 产物                                                                                       | reference                                             | check 脚本                                                    |
| ------- | --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| explore | S-explore | exploration-analysis.md（方案对比 / 推荐 / codegraph 影响初判）                            | phase-N-*.md + rtm-guide                              | check-codegraph-queries / check-opsx-artifacts                |
| propose | S-propose | opsx 产物（proposal/specs/design/tasks）+ tickets.md（tracer-bullet + blocking edges DAG） | phase-N-*.md + rtm-guide                              | check-opsx-artifacts                                          |
| coding  | S-coding  | 代码 + 测试 + codegraph-queries 落盘 + TLA 校验报告                                        | phase-N-*.md + rtm-guide + quality-standards(阶段5/7) | check-codegraph-queries + check-opsx-artifacts + 原阶段 check |

### stage 级 R3 + V 产物（阶段 5-8 opsx 三段式专属）

| 产物类型 | 路径                                                                                           | 数量 |
| -------- | ---------------------------------------------------------------------------------------------- | ---- |
| R3 报告  | `.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md` | 9 份 |
| V 评审   | `.w-model/v-reviews/phase<N>-{explore,propose,coding}.md`                                      | 3 份 |

> 缺失任一文件命中反模式 #39（跳过 opsx 产物审查），由 check-opsx-artifacts.ts 校验。

### opsx 与 S-tickets 职责边界（反模式 #40）

| 制品       | 产出者                      | 内容                               | 职责       |
| ---------- | --------------------------- | ---------------------------------- | ---------- |
| tasks.md   | opsx:propose                | 高层任务清单（what/why）           | 规格级规划 |
| tickets.md | S-tickets（S-propose 兼任） | 代码垂直切片（how，端到端可 demo） | 代码级切片 |

> S-coding 不做拆解，只按 tickets.md frontier 执行。每片 Edit/Write 前须 codegraph_explore（约束 #14，反模式 #38）。

### 6. 每阶段门禁脚本清单

### 6.1 全阶段必跑脚本（约束 #11，5 个闭环脚本）

| 脚本                    | 用途                                                         | 触发时机              |
| ----------------------- | ------------------------------------------------------------ | --------------------- |
| check-budget            | 预算检查                                                     | 每阶段门放行前        |
| check-run-log           | run-log 完整性 + 字段 schema + R3 记录数                     | 每阶段门放行前        |
| check-maturity          | 成熟度判定                                                   | 每阶段门放行前        |
| check-checkpoint        | CHECKPOINT acknowledgedDecisions 关键词                      | 每阶段门放行前        |
| check-preventive-review | R3 三份报告完整性（--variant=standard/fix/emergency/ingest） | V 评审前（always-on） |

### 6.2 全阶段通用脚本

| 脚本                   | 用途                                                                                                                                                                                          | 触发时机                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| check-verifier-output  | V 评审 JSON 校验（R1-R13，含 R13 单轴下限）                                                                                                                                                   | V 产出后 G 跑                                        |
| check-rootcause-report | RootCauseReport 校验（R1-R10：根因链 / 可证伪 / 修复建议 / 预防 / 上游缺陷 / 质量等级 / 报告 ID / 多角度 / reality-checker 置信度）                                                           | 返工循环：R 定位后 G 校验（见 §4 步骤 1/3）          |
| check-role-dispatch    | 角色 S/V/G 各 ≥1 + R3 三维度（role=R 且 outcome=success 的 r3-completeness/r3-reliability/r3-security 各 ≥1）无条件校验（约束 #8/#11）；空或全无效输入 fail-closed；结果含 r3Missing 维度明细 | 每阶段门放行前                                       |
| check-signature-chain  | 签名链 R1-R10（含 O 越权 / 代签检测）                                                                                                                                                         | 每阶段门放行前                                       |
| check-iceberg-sweep    | 冰山扫掠报告校验（R1-R5，反模式 #44）                                                                                                                                                         | S-fix 通过后（ICEBERG-A）+ 阶段门放行前（ICEBERG-B） |

### 6.3 阶段专属脚本

| 阶段门     | 必跑脚本（约束 #11 通用）                                                    | 阶段专属脚本                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 需求     | 5 闭环 + check-verifier-output + check-role-dispatch + check-signature-chain | check-requirement-graph(--phase=1) / check-requirement-coverage / check-tla-model(--phase=1) / check-bdd-model(--phase=1, required D4) / Artifact Gate pair sync（两份 manifest 真实有效且双向覆盖） / check-exemption(豁免时) |
| 2 系统设计 | 同上                                                                         | check-requirement-graph(--phase=2) / check-tla-model(--phase=2, --graph 强制) / check-bdd-model(--phase=2, --graph 强制, required D4) / Artifact Gate pair sync（两份 manifest 真实有效且双向覆盖）                            |
| 3 概要设计 | 同上                                                                         | check-requirement-graph(--phase=3) / check-tla-model(--phase=3, --graph 强制) / check-bdd-model(--phase=3, --graph 强制, required D4) / Artifact Gate pair sync（两份 manifest 真实有效且双向覆盖）                            |
| 4 详细设计 | 同上                                                                         | check-requirement-graph(--phase=4，零违反硬约束) / check-tla-model(--phase=4, --graph 强制) / check-bdd-model(--phase=4, --graph 强制, required D4) / Artifact Gate pair sync（两份 manifest 真实有效且双向覆盖）              |
| 5 编码     | 同上                                                                         | check-code-tla-consistency / check-design-contract-consistency / check-state-machine-consistency / check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=5 cucumber) / check-artifact-gate(--phase=5)       |
| 6 集成测试 | 同上                                                                         | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=6 cucumber) / check-artifact-gate(--phase=6)                                                                                                          |
| 7 系统测试 | 同上                                                                         | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=7 cucumber) / check-artifact-gate(--phase=7)                                                                                                          |
| 8 验收测试 | 同上                                                                         | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-design-contract-consistency / check-openspec-archive                        |

> 阶段 4 硬约束：check-requirement-graph.ts --phase=4 + check-tla-model.ts --phase=4 退出码必须为 0（零违反），否则不放行进阶段 5 编码。

> 反模式 #21（阶段级门禁跳过）：阶段 6/7/8 完成时必须跑对应 `--phase=N`，不得跳过直接跑 `--phase=8` 终检。

### 6.4 工具与元门禁脚本（门禁脚本权威登记表收尾）

> 本小节补全非阶段门触发的工具类 CLI、code-health 门禁 CLI 与元门禁脚本，与 `w-model-dev/scripts/cli/` 目录 46 个 .ts
> 一一对应（26 个 check-* + 7 个 code-health 门禁 CLI + 13 个工具：ensure-codegraph-opsx 见 §5 / 其余见下表；其中 45 个为 exit-2 脚本，self-test.ts 为 exit 0/1 回归基线，与 conventions.md「= 45（26 个 check-* + 19 个工具 CLI，不含 self-test；19 = 7 个 code-health 门禁 CLI + 12 个工具 CLI）」口径互补）。
> **新增 / 改名门禁脚本时登记点为本表 + SKILL.md/AGENTS.md 计数句（由 checkScriptRegistry 与计数检查双向兜底）**——`check-docs-consistency.ts` 的 checkScriptRegistry
> 核对全部 46 个 cli 脚本名均出现于本文件，SKILL.md「N 个 .ts」/ AGENTS.md「N 个脚本」/ conventions.md 计数句由计数检查同步核对（漏登记即门禁失败，pre-push 第 14 项拦截）。

| 脚本                          | 类别                     | 用途                                                                                                                                                                                                                                                                                             | 触发时机                                                                           |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| check-docs-consistency        | 元门禁                   | 活体文档一致性门禁（计数 / 枚举 / 版本七处 / 章节号连续性 / 脚本注册表 / 孤儿 references 入链 / AGENTS §8 cli 基名登记）                                                                                                                                                                        | 仓库维护（pre-push 第 14 项），非项目阶段门                                        |
| check-samples-coverage        | 元门禁                   | samples 覆盖矩阵门禁（五条规则：fixture 均被 self-test 引用 / 引用路径无悬空 / 子目录均在 samples/README 矩阵声明 / exit-2 门禁均在 NEGATIVE-COVERAGE 登记会失败的负向案例——未登记 missing、证据悬空 dangling 均 exit 1 / 登记册严格语法与证据行号校验 + 逐门禁真实串行 exit-2 探针（隔离探针根零漂移））                                                                                                                                         | 仓库维护（pre-push 第 15 项），非项目阶段门                                        |
| audit-l0-links（application） | 工具                     | L0/L1 分发边界只读审计（Markdown 相对链接、模板占位、目标存在性、包外路径和 symlink/junction fail-closed）                                                                                                                                                                                       | 仓库维护者显式执行 `npm run audit:l0-links [-- --root=<skill-root>]`，非项目阶段门 |
| check-tla-bdd-sync            | 阶段工具                 | TLA+ 与 BDD 配对文件的转移集 / 状态集 / 不变式等价同步校验                                                                                                                                                                                                                                       | 阶段 1-4 Artifact Gate pair sync                                                   |
| code-health-phase1            | code-health 门禁（只读） | Phase 1 静态 inventory + 真实动态 trace + false-positive guard（候选只 `discovered` / `blocked`）；`--root/--output/--scenario`；未知/危险 flag exit 2                                                                                                                                           | `/wm code-health` Phase 1，O 只读执行（反模式 #44 冰山扫掠前）                     |
| code-health-gap               | code-health 门禁（只读） | Phase 2 七维度 gap matrix + RED-GREEN 证据校验（coverage 仅信号）                                                                                                                                                                                                                                | `/wm code-health` Phase 2，O 只读执行                                              |
| code-health-tests             | code-health 门禁         | Phase 3 受保护测试 inventory + 默认拒绝 + `--guard` 唯一删除路径（真实 pre/post suite 身份证据）                                                                                                                                                                                                 | `/wm code-health` Phase 3，G 跑 guard；删除仅经 `code-health-apply`                |
| code-health-duplicates        | code-health 门禁（只读） | Phase 4 重复簇 + abstraction guard（11 维逐项等价证明，权威仅来自 HEAD-tracked ledger）                                                                                                                                                                                                          | `/wm code-health` Phase 4，O 只读执行                                              |
| code-health-ledger            | code-health 门禁         | append-only ledger `init` / `append` / `validate`（拒绝覆盖、复用 id、非法转移、非单调时间戳）                                                                                                                                                                                                   | `/wm code-health` 全程，O 持久化                                                   |
| code-health-apply             | code-health 门禁         | 人类批准后的最小可逆应用（`dry-run` / `patch` / `commit`）；scope 外变更即拒；记录可执行 rollback                                                                                                                                                                                                | `/wm code-health` 应用；S 执行、human 授权                                         |
| code-health-archive           | code-health 门禁         | campaign 证据归档：人类批准 + V/G + 真实命令证据 + 可执行 rollback + 脱敏 clean 才可归档；`--verify` 无 `--source-project` 只能 package-only，绝不表述为 verified source；原子写 + 拒绝覆盖 + 篡改检测 | `/wm code-health` 归档；O 只读执行 / human 授权 |
| security-scan                 | 工具                     | eslint-plugin-security 扫描 + baseline v2 内容敏感指纹豁免                                                                                                                                                                                                                                       | 仓库维护（pre-push 第 6 项），非项目阶段门                                         |
| self-test                     | 工具                     | 352 条样本回归基线（全部 check 逻辑通过/失败/输入错误三态）                                                                                                                                                                                                                                      | 仓库维护（pre-push 第 1 项），非项目阶段门                                         |
| wm-status                     | 工具                     | 状态快照（只读）                                                                                                                                                                                                                                                                                 | O 只读查询，不分派子代理                                                           |
| metrics-report                | 工具                     | 流程度量报告（只读）                                                                                                                                                                                                                                                                             | O 只读查询，不分派子代理                                                           |
| plan-chunks                   | 工具                     | ingestion 分块规划（O 只读 stdout 输出分块建议）                                                                                                                                                                                                                                                 | 阶段 1-4 ingestion 子流程入口（O 执行，见 §5）                                     |
| review-package                | 工具                     | 评审包落盘（S32 确定性单文件：header（base/head range）+ `git log --oneline` + `git diff --stat` + `git diff -U10`，无时间戳，同输入同字节；`--repo`/`--base`/`--head`/`--out`；未知/重复 flag 与坏 rev 均在任何写盘前 exit 2）                                                                     | 评审 / 审计需要可复现 diff 输入时显式执行（O 只读调用，不进编排者上下文），非项目阶段门 |
| check-pollution               | 工具（按需，非门禁）     | 污染源二分定位（S24）：检查项目目录测试污染残留（`.w-model/` 内 `*.lock` 陈旧锁目录、`*.lock` 锁文件、`coverage/` 残留含 `.tmp`、vitest `--outputFile` JSON 残留）；「吞掉测试失败只看产物」语义显式注释；`--project=<dir>`（缺省 cwd）；stdout 单行 `POLLUTION_JSON`                                   | 污染源二分定位时显式执行（R 定位辅助，O 只读调用）；**只作按需工具不得当门禁**——不进 pre-push 18 项、不进任何阶段门 |
| wm-write                      | 工具                     | 状态文件安全写：`<target>.lock` 持久目录和可转移 owner 对象保证跨进程竞争 writer 不会双成功；锁内执行 mtime 校验、毫秒+UUID 备份、tmp+rename、回读与原子恢复。`--lock-timeout` 为安全非负整数；CLI 陈旧锁须显式 `--recover-stale-lock`，否则 `STALE_LOCK` / exit 1（logic/state-write-logic.ts） | O/A/S 持久化 `.w-model/*.json` 状态文件时统一经此写入（防手写漂移）                |
| doctor                        | 工具                     | 环境自检（node/tsx/ajv/java/tla2tools/codegraph/openspec 逐项 ✅/❌/⚠️ + 修复指引；--with-tla 升级 TLA+ 项为阻断级；logic/doctor-logic.ts）                                                                                                                                                      | 首次启用 / 依赖报错时诊断（SKILL 步骤 1.5），非阶段门                              |
| wm-export-evidence            | 工具                     | 将项目 `.w-model/` 白名单状态和文本 run-log 导出为脱敏、SHA-256 manifest 证据包；支持 `--verify` package-only 复核和 `--source-project` source-bound 重验                                                                                                                                        | 需要按项目安全策略交付本地审计证据时显式运行；不自动提交或发布                     |
| wm-verify-evidence-source     | 工具                     | 读取并校验当前 HEAD、run-log、passed gate-log、signature-chain 与 source bundle，生产并原子写入 `.w-model/evidence-provenance.json`；不是只读 verify                                                                                                                                             | 导出证据前显式运行；成功才可产生 source-bound provenance，不自动提交或发布         |
| platform-deps-install         | 工具                     | 在显式 `--install` 路径验证并原子安装 lockfile 指定的 platform 原生包                                                                                                                                                                                                                            | 开发者显式执行，平台依赖缺失时按需运行，非阶段门                                   |

### 7. 反模式 → check 脚本映射速查

| 反模式                   | 守护脚本 / 机制                                                            |
| ------------------------ | -------------------------------------------------------------------------- |
| #1 跳过评审              | check-verifier-output + 🔴 CHECKPOINT 阶段门                               |
| #3 / #6 估算质量门/RTM   | check-artifact-gate                                                        |
| #4 评审未通过悄悄小修    | check-verifier-output（rework 闭环）                                       |
| #10 编排者越权           | check-signature-chain + check-role-dispatch                                |
| #11-13 ingestion 图谱    | check-requirement-graph                                                    |
| #14-17 TLA+ 行为门禁     | check-tla-model                                                            |
| #18 跳过 R 直接 S 返工   | check-rootcause-report + run-log R3 扩展                                   |
| #19 R 报告未 V 复审      | check-verifier-output(targetKind=rootcause)                                |
| #21 阶段级门禁跳过       | check-artifact-gate --phase=N（阶段 6/7/8 必须跑对应 --phase=N）           |
| #26 字段混用             | check-run-log R1                                                           |
| #28 schema 前置校验缺失  | schema-loader validateBySchema                                             |
| #29 BDD 不符未回退       | check-bdd-model D4 等价性                                                  |
| #30 豁免审批跳步         | check-exemption E1-E9                                                      |
| #33 跳过 R3              | check-preventive-review（--variant=standard                                | fix | emergency | ingest）+ check-run-log R8 |
| #34 漏派角色             | check-role-dispatch（S/V/G 各 ≥1 + R3 三维度无条件，`--r3-enabled` no-op） |
| #38 codegraph 未查询     | check-codegraph-queries                                                    |
| #39 跳过 opsx 审查       | check-opsx-artifacts                                                       |
| #41 单轴失败掩盖         | check-verifier-output R13                                                  |
| #42 S-fix 跳过 R3+V      | check-preventive-review(--variant=fix/emergency) + check-run-log R8        |
| #44 跳过冰山扫掠直接放行 | check-iceberg-sweep（R1-R5，ICEBERG-A/B 触发）+ V 复审新发现               |
| #48 子代理越界实施       | check-run-log.ts（R5 role-action 配对）/ check-signature-chain.ts          |

> 数据来源：SKILL.md + subagent-delegation.md + phase-1~8-*.md + hard-constraints.md；本矩阵随版本演进，以当前 SKILL.md 为准。

> **§0 按需分节加载导引**（约束 #6）：本文件较大，按下表只读所需节，禁止整文件载入上下文。
>
> | 触发场景                                   | 只读章节                             |
> | ------------------------------------------ | ------------------------------------ |
> | 首次分派子代理（谁做 / 何时派 / 禁做什么） | 角色划分 + 每阶段分派时序 + 强制约束 |
> | 阶段 1–4 任务过重需拆分 S                  | S 拆分机制                           |
> | 返工需多角度根因定位                       | R-lead 子代理分派模板                |
> | 覆盖缺失 / 冲突 / 覆盖率不达标需豁免       | 豁免审批角色边界                     |
> | S 发现既有产物 bug 需紧急修复              | S 子代理修改既有产物的边界           |
>
> 下方「加载导引」节给出更细的锚点加载策略。

## 加载导引

> 本文件较长，按需分段加载，避免一次性全量载入。加载策略如下：

- **首次分派只读**：编排者首次分派子代理前，只读 [§角色划分](#角色划分六类核心角色-o--s--v--g--a--r--r-iceberg-变体) + [§每阶段分派时序](#每阶段分派时序) + [§强制约束](#强制约束) 三节，建立「谁来做 / 何时派 / 什么不能做」的最小认知，即可开始分派。
- **§S 拆分机制**：阶段 1–4 首次分派 S 子代理时加载（见 [S 拆分机制（阶段 1–4 任务过重时）](#s-拆分机制阶段-1-4-任务过重时)），判断是否需将 S 拆为 S-doc / S-tla / S-bdd / S-ingest 变体。
- **§R-lead**：按场景触发——V/G 命中返工且需多角度根因定位时加载（见 [R-lead 子代理分派模板](#r-lead-子代理分派模板多角度变体并行串行均可)）。
- **§豁免审批**：按场景触发——出现覆盖缺失 / conflicts-with / 覆盖率不达标等需豁免事项时加载（见 [豁免审批角色边界](#豁免审批角色边界)）。
- **§S-emergency-fix**：按场景触发——S 子代理发现既有产物 bug 且阻塞当前阶段推进、需走紧急修复通道时加载（见 [S 子代理修改既有产物的边界](#s-子代理修改既有产物的边界)）。

> SSoT §3.4（`docs/skill-design-document_SSoT.md`） 为权威定义，本文件为可执行细则。
>
> **目的**：编排者工作最小化——编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本），任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。
>
> **强制等级**：违反本文件「强制约束」节命中反模式 #10「编排者越权实施」（见 [hard-constraints.md](hard-constraints.md)），**命中即回退到当前阶段起点**。
>
> **与 [agent-personas.md](agent-personas.md) / [verifier-spec.md](verifier-spec.md) 的关系**：本文件定义「谁来做」（角色划分与分派），agent-personas.md 定义 V 子代理内部的角色视角，verifier-spec.md §6（输出 Schema）+ §8（提示词模板）定义 V 子代理的输出 Schema 与提示词模板。三者互补，不冲突。

## 目录

- 角色划分（O / S / V / G / A / R / R-iceberg）
- 主刀职责映射表
- 文件落地交接协议与编排者状态日志
- 每阶段分派时序
- 子代理分派模板（含 R3 预防性审查 + R-iceberg 冰山扫掠 + V 复审根因 + R-lead）
- 回填契约
- 强制约束
- 与现有约束的兼容性
- 失败模式与回退

## 角色划分（六类核心角色 O / S / V / G / A / R + R-iceberg 变体）

| 角色               | 简称                | 职责                                                                                                                                                               | 允许动作                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 禁止动作                                                                                                                                                                                                              |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **编排者**         | O                   | 路由、状态读写、CHECKPOINT 等待、分派子代理、持久化                                                                                                                | ① 读 `.w-model/project.json` / `.w-model/rtm.json` / `.w-model/budget.json` / `.w-model/run-log.jsonl` / `.w-model/maturity.json`；② 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（只读，用于向用户展示或路由判定）；③ `git status` / `ls` / `Read` 等只读核验；④ 在 CHECKPOINT 暂停等待用户决定；⑤ 用户放行后更新 `project.status` 与 `updatedAt`；⑥ 分派 S / V / G 子代理；⑦ **维护 budget.json / run-log.jsonl / maturity.json**（状态读写+持久化，非实施；见 [operational-recovery.md](operational-recovery.md)「成本预算与运行日志」节 + 「成熟度与 CHECKPOINT 放行」节）：项目初始化创建三文件、每次子代理返回/门禁执行/CHECKPOINT 放行后 append run-log、预算检查、成熟度判定与升降级；⑧ **维护 event-ingress.jsonl + 事件路由**（状态读写+路由判定，非实施；见 [event-ingress-guide.md](event-ingress-guide.md)）：L2+ 激活时读 event-ingress.jsonl 未路由事件、查路由表、写 routedTo、append run-log action=event-route；⑨ **产出 HarnessImprovementReport**（状态分析，非实施；见 [hill-climbing-guide.md](hill-climbing-guide.md)）：分析 run-log 产出改进信号报告，存 `.w-model/hill-climbing/<ts>-report.json`，不自动改 harness | ① 用 `Write` / `Edit` 写或修改任何阶段产物文件；② 产出 `VerifierOutput` JSON 内容；③ 修改 `rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 生成测试用例代码或业务代码；⑤ 跳过 S → V → G 顺序（如自评自审） |
| **产出子代理**     | S                   | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体                                                                                                                    | ① 写文件（需求规格 / 设计文档 / 代码 / 测试用例代码 / 测试报告）；② 跑测试运行器（仅产出阶段，如 `npx vitest run`）；③ 改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 加载当前阶段 `phase-N-*.md` 与对应模板                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ① 跑 `check-verifier-output.ts` / `check-artifact-gate.ts`（由 G 子代理负责）；② 越阶段产出（仅产当前阶段）；③ 改 `project.status`（由编排者负责）                                                                    |
| **评审子代理**     | V                   | 按 [agent-personas.md](agent-personas.md) + [verifier-spec.md](verifier-spec.md) §8 产出 `VerifierOutput` JSON                                                     | ① 读产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告）；② 按 `targetKind` 选用 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor）；③ 产出 `VerifierOutput` JSON（满足 [verifier-spec.md](verifier-spec.md) §6 Schema）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ① 跑门禁脚本（由 G 子代理负责）；② 改产物文件；③ 改 RTM；④ 跨阶段评审                                                                                                                                                 |
| **门禁子代理**     | G                   | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要                                                                                            | ① 跑 `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<json>"`；② 跑 `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>`（阶段 5-8 另须 `--scope=<change-scope.json>`）；③ 读 GATE_JSON / Verifier JSON；④ 产出证据摘要字符串（含退出码 / 质量等级 / `passed` / `reworkHints`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ① 改产物文件；② 产出 `VerifierOutput` JSON（由 V 子代理负责）；③ 改 RTM 实体；④ 跑测试运行器（由 S 子代理负责）                                                                                                       |
| **分析子代理**     | A                   | 分块分析、交叉合并、图谱演进（阶段 1–4）                                                                                                                           | ① 读原始文档分块 / S 产出的正式文档；② 写 `.w-model/ingestion/<chunk-id>.{md,json}`；③ 读所有 chunk json 合并建图；④ 产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`；⑤ 通过晋升 consolidated.json 更新 graph.json                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ① 跑 `check-requirement-graph.ts`（G 负责）；② 写正式阶段产物；③ 改 `project.status`；④ 越阶段产出；⑤ 删除前阶段已通过的图谱节点                                                                                      |
| **根因定位子代理** | R                   | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施）              | ① 读失败产物文件 + 上游产物（需求/设计/代码/测试/TLA+/graph.json）；② 读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON；③ 运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）；④ 产出 `RootCauseReport` JSON + `.md` 报告文件；⑤ 标记 `upstreamDefect`（若根因为上游需求/设计缺陷）；⑥ 作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出（见 root-cause-locator.md §4）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ① 改任何产物文件（由 S 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅定位当前阶段产物的缺陷根因，上游回溯仅标记不修改）；⑥ 评审其他角色产出                                |
| **冰山扫掠子代理** | R-iceberg（R 变体） | S-fix 后（ICEBERG-A）或阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 `IcebergSweepReport`（多发现扫掠报告，找"水面之下"） | ① 读全阶段产物（需求/设计/代码/测试/TLA+/BDD/graph.json/RTM）；② 读本轮 reworkHints 历史 + 修复点；③ 读上一轮 IcebergSweepReport（避免重复发现）；④ 运用冰山扫掠方法（三维度×六类别，见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)）；⑤ 产出 IcebergSweepReport JSON + `.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ① 改任何产物文件（由 S-fix 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅当前阶段产物）；⑥ 评审其他角色产出；⑦ 跳过 V 复审直接触发 S-fix                                   |

> **只读脚本例外**：编排者可执行 `npx tsx w-model-dev/scripts/cli/check-*.ts`、`git status`、`ls` 等确定性只读命令以核验状态/展示证据，但不得**写入或修改**任何产物/评审/RTM 内容。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施，也**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

## 主刀职责映射表

> 吸收自《agent 时代的人月神话》第 3 章「外科手术队伍」。概念完整性只能从"一个头脑的持续持有"里长出来——主刀由人坐，支持角色全部可由 agent 出任。

| 外科手术队伍角色                              | W 模型对应                                                    | 归属  |
| --------------------------------------------- | ------------------------------------------------------------- | ----- |
| 主刀（持有概念 / 拍板 / 核心判断 / 最终负责） | 用户 + 编排者 O（代表人的判断，只做编排不实施）               | 人    |
| 副手（随时可接替主刀）                        | 不支持由 agent 接替——目的持有不可委托；仅陪练/评审可由 V 兼任 | 人    |
| 管理员 / 文档 / 录入 / 工具 / 测试 / 语言律师 | S / A 子代理 + 宿主工具（git / lint / schemas / 测试运行器）  | agent |

**目的持有者溯源**：开工前在 `project.status` 或阶段产物中写明"此任务最终服务于谁的什么目的"，作为判据的最上游锚点，所有子判据向下推导。

**修正权**（与约束 #8『编排者最小化』、反模式 #10『编排者越权实施』互补）：O 不实施（agent 侧约束），但**用户**保留修正权——人在回路的最低标准 = 能在过程中间改产物而不用整体重跑。凡只提供审计权（日志/面板/思维链展示）而无修正路径的产物设计视为不合格（见 [hard-constraints.md](hard-constraints.md) 反模式 #46）。

## 上下文装填原则

> 吸收自《agent 时代的人月神话》第 6 章「贯彻执行」：任何一次转述都是一次未声明的重新定义。

- **原文照搬**：任务背景原文装填，不翻译、不分解、不预处理；补充说明写下来也视为原文。
- **禁止自撰摘要**：长期项目启动禁止给"自己整理的摘要"——让 agent 读原始文档，或 RAG/grep 随用随取；你以为在帮 agent，实际是在替它做你没意识到的判断。
- **验证账单**：每加一个 subagent，预算一笔"主读产出并验证"的 token/时间成本；验证链可省步、省不到零，最终裁决者必须是持有目的的人。

## S 子代理简报质疑权

> 吸收自 Agentic Design Patterns ch19「承包商模型·协商反馈」：承包商对合约可协商——发现数据源不可达/范围歧义时，先返回质疑，而非硬做或静默改动。

- **S 收到简报先评估可执行性**：依赖缺失 / 上游产物不可达 / 范围歧义 / 简报与当前阶段产物矛盾时，S 须返回质疑清单（含缺失项 + 所需输入 + 建议），不得硬做、不得自行改范围。
- **质疑清单格式**：`blockers[]`（阻断项）+ `assumptions[]`（当前假设）+ `requestedInputs[]`（所需输入）+ `suggestedPath`（建议路径）。
- **O 处置**：收到质疑清单 → 补齐输入或裁决范围 → 重发简报；不得忽略质疑直接派下一个动作。
- **与操作行为的关系**：强化操作行为 #2（Manage Confusion）与 #3（Push Back）的 S 侧落点——把返工成本从产物层提前到简报层。
- **与反模式 #9/#10 的关系**：质疑不等于越权——S 不实施 O 的裁决动作，只返回问题；O 保留路由裁决权。

## 文件落地交接协议与编排者状态日志（File-Landing Handoff & Orchestrator Journal）

> **目的**：编排者 token 最小化 + 子代理间信息不经编排者转发 + 编排者工作全程落地可追溯。本节是 [回填契约](#回填契约) 的前置约束：子代理返回 O 的内容须降至最小信标，完整产出以文件为媒介在子代理间直传。
>
> **强制等级**：违反本节「禁止转发」「状态日志强制」命中反模式 #10 变体（编排者越权承担信息搬运），回退到当前分派起点。
>
> **与既有机制的关系**：本节**不替代** `run-log.jsonl`（事件流水 / append-only 审计）、`progress.md`（SDD 完成账本）、task-brief / review-package 文件模式（brief / report 文件雏形）；在它们之上增加「状态日志当前快照」+「status.json 信标」+「O 不读 output」硬约束。

### 1. 编排者状态日志（current / done / next）

编排者在 `.w-model/orchestrator-state.md` 维护一份**当前快照**（非流水），结构固定三段，O 的"我在哪 / 干完了什么 / 下一步干什么"地图：

```markdown
# Orchestrator State

updated: <ISO8601>
phase: <N - 名称>

## CURRENT

- 分派 <role>（<dispatch-id>），等待 <产物 beacon | CHECKPOINT 放行 | 用户澄清>
- started: <ISO8601>

## DONE

- [<dispatch-id>] <role> → <one-line outcome> | beacon: handoff/<dispatch-id>/status.json
- ...

## NEXT

- [<dispatch-id>] <role> 读 handoff/<prev-dispatch-id>/output.md → 产 handoff/<dispatch-id>/output.md
- ...
```

**更新规则**：

- 每次**分派前**与**收到 beacon 后**，O 用 `Write` 整文件覆盖（原子更新，非 append）。
- compaction / 会话恢复后，O 先 `Read` 本文件 + `run-log.jsonl` 尾部重建位置；**不得凭记忆分派**。
- 阶段门 CHECKPOINT 须展示本文件 `DONE` 段作为分派完整性证据（与约束 #8 互补）。

**与既有三文件互补、不替代**：

| 文件                       | 性质                    | 内容                             |
| -------------------------- | ----------------------- | -------------------------------- |
| `orchestrator-state.md`    | 当前快照（覆盖式）      | current / done / next            |
| `run-log.jsonl`            | 事件流水（append-only） | 审计每条分派 / 门禁 / CHECKPOINT |
| `progress.md` / 阶段门记录 | 完成账本（append-only） | 已完成任务 + 提交区间            |

### 2. 交接目录协议（handoff directory）

根目录：`.w-model/handoff/`。每次分派一个子目录 `handoff/<dispatch-id>/`，`<dispatch-id> = phase<N>-<role>-<seq>`（如 `phase1-S-01`、`phase1-V-01`、`phase1-G-01`、`phase1-R-01`、`phase1-S-fix-01`）。

每个分派目录固定三文件：

| 文件          | 写入者              | 内容                                                                      | O 是否可读               |
| ------------- | ------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `brief.md`    | O（指针型，非内容） | 任务一句话定位 + 输入产物**路径列表** + 产出契约 + 禁止项                 | 否（O 已知路径，无需读） |
| `output.md`   | 子代理              | 完整产出（报告 / VerifierOutput JSON 内容 / diff 摘要 / 根因报告 / 证据） | **否**                   |
| `status.json` | 子代理              | 信标（< 200 字节）                                                        | **是（唯一可读）**       |

`status.json` Schema：

```json
{
  "role": "S|V|G|A|R|S-fix",
  "dispatchId": "phase1-S-01",
  "state": "DONE|BLOCKED|NEEDS_CONTEXT",
  "output_path": "handoff/phase1-S-01/output.md",
  "exit_code": 0,
  "quality_level": "A|B|C|D",
  "one_line_summary": "产出需求规格 + RTM REQ 列 + L1 TLA+，coverage 100%",
  "next_hint": "派 V 评审 handoff/phase1-S-01/output.md"
}
```

**禁止转发规则（核心）**：

- O **只** `Read` 各 `status.json`；**禁止** `Read` 任何 `brief.md` / `output.md` 内容。命中即反模式 #10 变体。
- 下游子代理**直接** `Read` 上游 `output.md`，不经 O 搬运：
  - V 读 S 的 `output.md`（+ R3 三份报告路径）
  - G 读 V 的 `output.md`（VerifierOutput JSON）
  - R 读 V/G 的 `output.md`（reworkHints + 失败产物路径）
  - S-fix 读 R 的 `output.md`（RootCauseReport + fixRecommendation）
- O 在下游 `brief.md` 里只写"读 `handoff/<prev-dispatch-id>/output.md`"指针，不粘贴内容。
- 子代理返回 O 的文本 ≤ 5 行：仅 `{state, dispatchId, status.json 路径, one-line}`。完整产出在 `output.md`。

> 与 task-brief / review-package 文件模式的关系：SDD 的 brief / report 文件即本协议 `brief.md` / `output.md` 的雏形；本协议增加 `status.json` 信标与"O 不读 output"硬约束，把"O 读路径"进一步降为"O 只读信标"。

### 3. 任务拆分预算（simplicity budget）

每个子代理任务须满足**全部**，否则 O 必须先拆分再分派：

- **单一产出类型**：doc / tla / bdd / code / review / gate / rootcause 之一；混合产出 → 用既有变体拆分（S-doc / S-tla / S-bdd、S-explore / S-propose / S-coding、R-lead / R-persona）。
- **单一阶段**：越阶段 → 拆分。
- **输入文件 ≤ 5 个**：超出 → 用 `brief.md` 聚合路径列表，子代理按需 `Read`，禁止全量塞入 brief。
- **产出文件 ≤ 3 个**：超出 → 拆分为多次分派。
- **预期单次往返**：复杂任务须先拆；子代理 `BLOCKED` / 轮次膨胀 / 产出质量稀释 → O 拆分后重派（**不计入返工 round**，属编排拆分而非质量返工）。

**过重信号**（命中即拆分重派）：

- 子代理返回 `NEEDS_CONTEXT` ≥ 2 次（上下文过大信号）
- 单次 `output.md` 超过该角色预算（doc ≤ 1 文件、review ≤ 1 JSON、gate ≤ 1 摘要、rootcause ≤ 1 报告）
- 子代理主动报告"任务过大 / 需要拆分"

### 4. 编排者 token 最小化检查清单

O 会话**禁止**出现：阶段产物正文、VerifierOutput JSON 内容、diff 内容、业务/测试代码正文、根因报告正文。

O **只读**：`project.json` / `rtm.json`（仅状态字段）/ `orchestrator-state.md` / `handoff/*/status.json` / `run-log.jsonl`（尾部）/ `check-*.ts` 退出码与 stdout 末尾 5 行（约束 #9 放行证据）。

O **只写**：`orchestrator-state.md` / `project.status` / `run-log.jsonl`（append）/ `handoff/<id>/brief.md`（指针型）/ `handoff/<id>/` 目录创建。

旁白 ≤ 1 句/工具调用（与 SDD 技能"旁白"约束一致）。

### 5. 分派时序示例（文件落地版）

```
O: Read orchestrator-state.md → 重建位置
O: Write handoff/phase1-S-01/brief.md（指针：输入产物路径 + 契约）
O: Write orchestrator-state.md（CURRENT=派 S-01，NEXT=派 V-01 读 S-01/output.md）
O: 分派 S-01（Task 工具，prompt 只含 brief 路径 + status.json 契约 + ≤5 行返回约束）
S-01: Read brief.md → 产出 → Write output.md + Write status.json → 返回 O ≤5 行
O: Read handoff/phase1-S-01/status.json（唯一可读）
O: Write handoff/phase1-V-01/brief.md（指针：读 handoff/phase1-S-01/output.md + R3 报告路径）
O: Write orchestrator-state.md（DONE+=S-01，CURRENT=派 V-01）
O: 分派 V-01
V-01: Read handoff/phase1-S-01/output.md → 产出 → Write output.md + status.json → 返回 ≤5 行
...（G 读 V/output.md，R 读 V+G/output.md，S-fix 读 R/output.md，全程不经 O 转发内容）
```

## 每阶段分派时序

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集（SKILL.md + 当前阶段 phase-N）
O: 🔴 CHECKPOINT · 项目初始化（首次）或阶段进入确认
  ↓ 分派 S
S: 产出开发文档 + 同步测试设计 + 更新 RTM 实体 → 返回 {产物路径, RTM diff}
  ↓ 分派 V
V: 按 targetKind 路由 Persona → 产出 VerifierOutput JSON
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<json>"
   → 返回 {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode ≠ 0 或 qualityLevel ∈ {C,D} → 视为 V/G 失败，必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）
   → 分派 R 定位（输入：reworkHints + 失败产物 + 上游产物）→ R 产出 RootCauseReport
   → 分派 V 复审根因报告（targetKind=rootcause）→ V 返回 {qualityLevel, passed, reworkHints}
   → 分派 G 门禁（check-rootcause-report.ts）→ G 返回 {exitCode, evidence}
   → 分派 S-fix 修复（输入：R 报告 + fixRecommendation）→ S-fix 返回 {artifacts, rtmDiff, fixBasedOn, selfCheck}
   → 分派 R3×3(fix) → G(check-preventive-review exit 0) → V 评审修复产物 → G 门禁
   → O 展示最新证据，在 🔴 CHECKPOINT 等待用户决定
O: 若 S-fix 返工通过 → 分派 R-iceberg（ICEBERG-A，输入：reworkHints + fixedPoints + 全阶段产物）
   → R-iceberg 产出 IcebergSweepReport
   → 若 newFindings 非空 → 分派 V 复审冰山报告 → 每个有效发现走完整 R 报告复审、根因门禁、S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT 链 → 回到 R-iceberg（ICEBERG-A）
   → 若 newFindings=[] → 继续
O: 若通过（首次或返工最终）
   → 分派 R-iceberg（ICEBERG-B，全局扫掠：reworkHints 历史 + fixedPoints + 全阶段产物 + RTM + graph.json）
   → 若 newFindings 非空 → 分派 V 复审 → 每个有效发现走完整 R 报告复审、根因门禁、S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT 链 → 回到 R-iceberg（ICEBERG-A）
   → 若 newFindings=[] → 🔴 CHECKPOINT · 阶段门放行（编排者展示 G 子代理返回的证据给用户）
O: 用户放行 → 编排者更新 project.status → 进入下一阶段
```

阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`：

```
O: 阶段 8 验收测试产物已放行
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --scope=<change-scope.json>（阶段 8 终检，默认 phase=8）
   → 返回 {exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果）}
O: 若 exitCode = 1 → 视为 V/G 失败，先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再按 R 结论处理
O: 若 exitCode = 2 → 仅修正输入并重跑，不得当作失败修复或放行
O: 若通过 → 🔴 CHECKPOINT · 发布放行（展示 GATE_JSON 给用户）
O: 用户确认 → 编排者更新 project.status = 验收通过 → 项目完成
```

> **阶段 5-8 门禁顺序与 ChangeScope（2026-09-04 audit-gate-closure）**：阶段 5-8 的 G 侧执行顺序为 **codegraph/opsx strict 校验 → artifact gate（聚合）→（阶段 8）opsx:archive → check-openspec-archive.ts（归档后置门）→ CHECKPOINT**。`check-artifact-gate.ts --phase=5..8` 与 `check-codegraph-queries.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts` 均须绑定变更上下文：`--scope=<change-scope.json>`（或 `--change=<changeId> --base=<ref> --head=<ref>` 薄封装），缺失 → exit 1（fail-closed；S-coding 须随阶段产物产出并更新 scope，`headRef` 过期或 `changedFiles` 与实际 Git 变更集合不符同样 fail-closed）。artifact gate 把两个 strict checker 的 violations 并入 reasons/exitCode（不得被 RTM 通过掩盖），`GATE_JSON` 含 external summary；archive checker 是 `opsx:archive` 后置门，不在 pre-archive 的 artifact gate 内强制。

## 子代理分派模板

> 编排者分派子代理时必须使用宿主 Agent 的子代理机制（如 Trae 的 Task 工具 / Claude Code 的 Task 工具 / Cursor 的子代理）。分派指令须包含完整上下文，子代理不得继承编排者会话历史。

### S 子代理分派模板

```
角色：产出子代理（S）
当前 W 模型阶段：<阶段 N - 名称>
任务：按 phase-<N>-*.md 产出本阶段开发产物 + 同步测试设计 + 更新 RTM 实体
上下文：
  - 项目状态：.w-model/project.json（已附）
  - 当前 RTM：.w-model/rtm.json（已附）
  - 上游产物路径：<列出已放行的上游产物路径>
  - 技术栈：<从 project.json.techStack 读取>
必读：
  - references/phase-<N>-*.md（按当前阶段加载）
  - references/rtm-guide.md
  - templates/<对应模板>.md
产出契约：
  1. 文件路径：<按 phase-N 定义>
  2. 同步测试设计：<按并行对应表>
  3. RTM 实体更新：<列出本次新增 / 修改的实体 ID>
  4. 返回编排者：{产物路径, RTM diff 摘要, 自检结果（按 phase-N 验收标准）}
禁止：
  - 跑 check-verifier-output.ts / check-artifact-gate.ts
  - 越阶段产出
  - 改 project.status
```

### V 子代理分派模板

```
角色：评审子代理（V）
评审目标：<targetKind> / <targetId>
任务：按 agent-personas.md 对应 Persona + verifier-spec.md §8 提示词产出 VerifierOutput JSON
模型档位：<显式指定，不得省略（省略即静默继承编排者会话模型）；按 diff 规模/复杂度/风险定档，小 fix delta 的 scoped re-review 可用便宜到中档；修复轮次 4-5 时至少比卡住的实现者高一档（本仓库把同轮评审一并纳入升级） — 判据见 estimation-guide.md「模型档位 × 修复轮次 escalation」>
上下文：
  - 待评审批产物路径：<列出 S 子代理产出的文件路径>
  - 上游产物路径（用于追溯）：<列出>
必读：
  - references/agent-personas.md（按 targetKind 选用 Persona）
  - references/verifier-spec.md §6（输出 Schema）+ §8（提示词模板）+ §7.4A（五轴 + Severity）+ §15（评审信任、质疑与校准口径）
  - references/quality-standards.md（如评审代码 / 测试）
  - references/quick-self-check.md（完成定义（DoD）节；如评审阶段门）
产出契约：
  1. VerifierOutput JSON 文件路径：<约定路径>
  2. 必须满足 verifier-spec.md §6 Schema（subCriteria / compositeScore / qualityLevel / passed / reworkHints）
  3. Severity 标签作为 reworkHints 前缀（[Critical] / [Required] / [Optional] / [Nit] / [FYI]）
  4. 返回编排者：{VerifierOutput JSON 路径, summary 摘要}
禁止：
  - 跑门禁脚本
  - 改产物文件
  - 改 RTM
  - 跨阶段评审
```

### G 子代理分派模板

```
角色：门禁子代理（G）
任务：跑确定性门禁脚本 + 回填证据摘要
上下文：
  - 待校验文件路径：<V 子代理产出的 VerifierOutput JSON / project-dir>
执行：
  - 阶段 1 门：
    1. npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<verifier-output.json>"
    2. npx tsx w-model-dev/scripts/cli/check-tla-model.ts "<tla-manifest.json>" --phase=1
    3. npx tsx w-model-dev/scripts/cli/check-bdd-model.ts "<bdd-manifest.json>" --phase=1 --require-tla-equivalence --tla-manifest=<tla-manifest.json>
    4. npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=1
  - 阶段 2~4 门：
    1. npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<verifier-output.json>"
    2. npx tsx w-model-dev/scripts/cli/check-tla-model.ts "<tla-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json
    3. npx tsx w-model-dev/scripts/cli/check-bdd-model.ts "<bdd-manifest.json>" --phase=<N> --require-tla-equivalence --tla-manifest=<tla-manifest.json> --graph=.w-model/ingestion/graph.json
    4. npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>
  - 阶段 5~7 门：
    1. npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<verifier-output.json>"
    2. npx tsx w-model-dev/scripts/cli/check-bdd-model.ts "<bdd-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=<真实报告路径>
    3. npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N> --scope=<change-scope.json>（内部先跑 codegraph/opsx strict 校验并聚合 violations；scope 亦可 --change=<id> --base=<ref> --head=<ref>）
    4. npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts [project-dir] --phase=<N> --scope=<change-scope.json>（定位 codegraph 覆盖问题时单独跑）
    5. npx tsx w-model-dev/scripts/cli/check-opsx-artifacts.ts [project-dir] --phase=<N> --scope=<change-scope.json>（定位 opsx 制品问题时单独跑）
  - 阶段 8 终检：npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --scope=<change-scope.json>（默认 phase=8，同样聚合 codegraph/opsx strict；终检后另运行 `check-bdd-model.ts` 的 phase 8 graph + required Cucumber report 组合）
  - 阶段 8 opsx:archive 后置门：S-coding 执行 opsx:archive 归档后，G 单独跑 npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts [project-dir] --phase=8 --scope=<change-scope.json>（严格锚定 <changeId> 或 <日期>-<changeId> 归档目录）
  - 各阶段还须运行 `check-preventive-review.ts`、其余闭环脚本和 phase-N 定义的专属门禁
产出契约：
  1. 退出码（0 / 1 / 2）
  2. 证据摘要：
     - 阶段门：{exitCode, qualityLevel, passed, reworkHints, tlaModelExitCode, bddModelExitCode}
     - 终检：{exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果 / Model 校验结果）}
  3. 返回编排者：上述结构化摘要
禁止：
  - 改产物文件
  - 产出 VerifierOutput JSON
  - 改 RTM 实体
  - 跑测试运行器
```

### A-chunk 子代理分派模板

```
角色：分析子代理-分块变体（A-chunk）
当前 W 模型阶段：<阶段 N - 名称>
任务：读单个 chunk，提取本阶段节点类型实体，产出 <chunk-id>.{md,json}
上下文：
  - chunk 路径：<文件路径>
  - chunk-id：<chunk-001>
  - 阶段与节点类型：<phase=N, node-type=REQ|SD|INTF|DD>
  - 全局目录树摘要 + 相邻 chunk 标题列表（用于跨块边初判）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-chunk.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/<chunk-id>.md + <chunk-id>.json
  2. JSON 须满足 ingestion-chunk.md schema（nodes/edges/crossChunkHints）
  3. 返回编排者：{role:"A", variant:"chunk", chunkId, entities, edges, blocked?}
禁止：
  - 跑 check-requirement-graph.ts
  - 写正式阶段产物
  - 越阶段产出
```

### A-cross/A-evolve 子代理分派模板

```
角色：分析子代理-合并/演进变体（A-cross 阶段1 / A-evolve 阶段2-4）
任务：合并所有 chunk.json 建图，确认跨块边，产出 consolidated.json + reworkHints
上下文：
  - .w-model/ingestion/*.json 全集
  - 现有 graph.json（仅 A-evolve）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-cross.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/consolidated.json + cross-analysis-report.md
  2. reworkHints 指向具体 chunkId 与原因
  3. 返回编排者：{role:"A", variant:"cross|evolve", totalEntities, totalEdges, isolatedNodes, connectedComponents, roots, reworkHints}
禁止：
  - 跑 check-requirement-graph.ts（G 负责）
  - 写正式阶段产物
  - 删除前阶段图谱节点（A-evolve）
```

### S 拆分机制（阶段 1–4 任务过重时）

> 阶段 1–4 单个 S 子代理任务过重（文档 + 测试设计 + RTM + TLA+ + BDD features 五类产出）时，编排者可将 S 拆为最多三次分派，避免单次上下文超载或产出质量稀释。**拆分为可选项，非强制**；任务粒度可承载时不拆，按标准 S 模板一次产出。

- **S-doc**：产出开发文档 + 同步测试设计 + 更新 RTM 实体；**不产出** `.tla` / `.cfg` / `tla-manifest.json` / `.feature` / `bdd-manifest.json`。
- **S-tla**：产出对应层级 TLA+ 规格（`.tla` + `.cfg`）+ 更新 `tla-manifest.json` 基础字段 + **`.tla` 文件头部含 `@designIds` 字段（列出覆盖的 SD 节点 ID）**；**依赖 S-doc 已产出的设计文档**作为建模输入；**不产出** `tla-manifest.json` 的 `sdCoverage` 字段（由 S-ingest-tla 回填）。
- **S-bdd**：产出对应层级 BDD features（`.feature`）+ 更新 `bdd-manifest.json` 基础字段 + **`.feature` 文件头部含 `@designIds` 字段**；**依赖 S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格**作为等价性对齐输入；**不产出** `bdd-manifest.json` 的 `designCoverage` 字段（由 S-ingest-bdd 回填）。
- **S-ingest-tla**：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage；**依赖 S-tla 已产出的 .tla 文件** + A-evolve 已产出的 graph.json。
- **S-ingest-bdd**：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage；**依赖 S-bdd 已产出的 .feature 文件** + A-evolve 已产出的 graph.json。
- **分派时序**：S-doc → A-evolve(SD 节点入图谱) → S-tla(产出 .tla/.cfg/manifest 基础字段 + @designIds 头部) → S-ingest-tla(回填 manifest sdCoverage) → S-bdd(产出 .feature/manifest 基础字段 + @designIds 头部) → S-ingest-bdd(回填 manifest designCoverage) → R3 → V → G(check-tla-model + check-bdd-model --graph 校验)。
- **返工边界**：V/G 命中 TLA+ 问题 → 仅返工 S-tla；命中 BDD 问题 → 仅返工 S-bdd（若 TLA+ 规格变更影响 BDD 等价性则同步触发 S-bdd 重评）；命中文档 / 测试设计 / RTM 问题 → 仅返工 S-doc，若设计变更影响 TLA+ 模型或 BDD features 则同步触发 S-tla / S-bdd 重评。

#### S-doc 子代理分派模板

```
角色：产出子代理-文档变体（S-doc）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出开发文档 + 同步测试设计 + 更新 RTM 实体（不产出 TLA+ / BDD 实体）
依据：references/phase-<N>-*.md + templates/<对应模板>.md + references/rtm-guide.md
产出：
  1. 开发文档（按 phase-N 定义）
  2. 同步测试设计（按并行对应表）
  3. RTM 实体更新（需求 / 设计 / 测试用例）
  4. 返回：{产物路径, RTM diff, selfCheck}
不产出：
  - .tla / .cfg / tla-manifest.json（由 S-tla 负责）
  - .feature / bdd-manifest.json（由 S-bdd 负责）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
```

#### S-tla 子代理分派模板

```
角色：产出子代理-TLA+ 变体（S-tla）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出对应层级 TLA+ 规格 + 更新 tla-manifest.json；`.tla` 文件头部须含 `@designIds` 字段，列出覆盖的 SD 节点 ID
依据：references/tla-plus.md + templates/tla-spec-template.md + S-doc 已产出的设计文档
产出：
  1. .tla（按 phase-N 层级：L1/L2/L3/L4）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. .cfg（TLC 模型检查配置）
  3. tla-manifest.json 实体更新（基础字段，不含 sdCoverage——由 S-ingest-tla 回填）
  4. 返回：{.tla 路径, .cfg 路径, manifest diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .feature / bdd-manifest.json（由 S-bdd 负责）
  - tla-manifest.json 的 sdCoverage 字段（由 S-ingest-tla 回填）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - .tla 文件头部须含 @designIds 字段（逗号分隔的 SD 节点 ID），读取 .w-model/ingestion/graph.json 提取 SD 节点列表作为覆盖范围依据
```

#### S-bdd 子代理分派模板

```
角色：产出子代理-BDD 变体（S-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出对应层级 BDD features + 更新 bdd-manifest.json
依据：references/bdd.md + templates/feature.template + templates/bdd-manifest.template.json + S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格（用于 BDD↔TLA+ 等价性对齐）
产出：
  1. .feature（按 phase-N 层级：L1/L2/L3/L4，每个 REQ/SD/INTF/DD ≥1 个 .feature 文件）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. bdd-manifest.json 实体更新（features + stateMachines + tlaSpecId 关联，不含 designCoverage——由 S-ingest-bdd 回填）
  3. RTM 测试列追加 BDD 引用（`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`）
  4. 返回：{.feature 路径, manifest diff, RTM diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .tla / .cfg / tla-manifest.json（由 S-tla 负责）
  - bdd-manifest.json 的 designCoverage 字段（由 S-ingest-bdd 回填）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - BDD 状态机七要素须与同层 TLA+ spec 等价（states↔State / initialState↔Init / transitions↔Next / invariants↔Invariants）
  - 文件头 10 个 @ 字段全部必填（@req / @design / @designIds / @system / @tla-spec / @state-machine / @parent-features / @sibling-features / @child-features / @scenario-id-prefix）
  - Background 节七要素全部必填（acceptingStates 不可为空，其余可为 ()）
  - .feature 文件头部须含 @designIds 字段（逗号分隔的 SD 节点 ID），读取 .w-model/ingestion/graph.json 提取 SD 节点列表作为覆盖范围依据
```

#### S-ingest-tla 子代理分派模板

```
角色：产出子代理-TLA+ 图谱导入变体（S-ingest-tla）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage
依据：references/conventions.md + references/tla-plus.md §10
输入：
  - .tla 文件路径列表（S-tla 已产出）
  - tla-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. tla-manifest.json 的 sdCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, sdCoverage 摘要, uncovered 列表}
不产出：
  - .tla / .cfg 文件（由 S-tla 负责，S-ingest 只读不写 .tla）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .tla 文件，不修改
  - @designIds 提取须与 .tla 文件头部一致
  - sdCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```

#### S-ingest-bdd 子代理分派模板

```
角色：产出子代理-BDD 图谱导入变体（S-ingest-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage
依据：references/conventions.md + references/bdd.md D8
输入：
  - .feature 文件路径列表（S-bdd 已产出）
  - bdd-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. bdd-manifest.json 的 designCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, designCoverage 摘要, uncovered 列表}
不产出：
  - .feature 文件（由 S-bdd 负责，S-ingest 只读不写 .feature）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .feature 文件，不修改
  - @designIds 提取须与 .feature 文件头部一致
  - designCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```

### 阶段 5-8 S 三段式变体

> 阶段 5-8 opsx 工作流。阶段 5-8 引入 codegraph + OpenSpec opsx 后，S 角色拆分为三段式变体。每段产物须跑 R3×3 + V 审查。

#### S-explore 子代理分派模板

- **输入**：当前阶段 spec + 上游产物 + codegraph 图谱（已 init）
- **调用**：`/opsx:explore` + `codegraph_explore`（影响初判）
- **产出**：`exploration-analysis.md`（方案对比 / 推荐方案 / codegraph 影响初判）
- **审查**：R3×3（completeness/reliability/security）→ V 评审 → 不合格打回

#### S-propose 子代理分派模板

- **输入**：S-explore 产物（exploration-analysis.md）+ R3/V 审查通过
- **调用**：`/opsx:propose <change>` → 产 proposal.md / specs/ / design.md / tasks.md；随后 S-tickets 拆解 → tickets.md（tracer-bullet + blocking edges DAG）
- **产出**：`openspec/changes/<change>/{proposal,specs,design,tasks}.md` + `tickets.md`
- **审查**：R3×3 → V 评审 → 不合格打回
- **职责边界**：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how）。反模式 #40 禁止混淆。

#### S-coding 子代理分派模板

- **输入**：S-propose 产物（tickets.md）+ R3/V 审查通过
- **调用**：按 tickets.md frontier 逐片执行；每片 `codegraph_explore(目标符号)` → 落盘 `.w-model/codegraph-queries/` → `opsx:apply` 推进 → `Edit`/`Write` 代码 + 单元测试 →该片 code-TLA+ 一致性校验
- **产出**：代码 + 测试 + `.w-model/codegraph-queries/` + TLA 校验报告
- **审查**：R3×3 → V 评审 → 不合格打回（指定返工票据）
- **约束 #14**：任何 Edit/Write 前须 codegraph_explore，否则命中反模式 #38

### R 子代理分派模板

```
角色：根因定位子代理（R）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round，从 1 开始>
模型档位：<显式指定，不得省略（省略即静默继承编排者会话模型）；返工轮次 4-5 时至少比卡住的实现者高一档 — 判据见 estimation-guide.md「模型档位 × 修复轮次 escalation」>
任务：诊断 V/G 命中的返工问题根因，产出 RootCauseReport

上下文：
  - 返工来源：<verifier | gate>
  - V/G 的 reworkHints（原文）：<数组>
  - V 的 VerifierOutput JSON 路径：<路径，可选>
  - G 的 GATE_JSON 路径：<路径，可选>
  - 失败产物路径：<被诊断为不合格的产物文件>
  - 上游产物路径（用于上游回溯）：<列出上游阶段产物路径>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径，可选>
  - 上一轮 R 报告（若 round>1）：<路径，用于避免重复根因>

必读：
  - references/root-cause-locator.md（根因分析方法论）
  - references/hard-constraints.md（避免误判流程问题为产物问题）

方法选择：
  - 单一明确缺陷 → 5-Why
  - 多因素复合缺陷 → 鱼骨图
  - 跨产物传播 → 缺陷链追溯
  - 当前阶段无明显缺陷 → 上游回溯
  - 复杂场景 → 组合

产出契约：
  1. RootCauseReport JSON：<路径> .w-model/rootcause/<reportId>.json
  2. 人类可读报告：<路径> .w-model/rootcause/<reportId>.md
  3. 必须满足 RootCauseReport Schema（见 spec §4）
  4. 返回编排者：{role:"R", reportId, reportPath, rootCauseCategory, upstreamDefect: {present, rollbackRecommended}, qualityLevel, passed, summary}

禁止：
  - 改任何产物文件（由 S 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 修改上游产物（仅标记 upstreamDefect）
  - 评审其他角色产出
  - 跨阶段定位（仅当前阶段产物 + 上游回溯标记）
```

### R3 预防性审查分派模板

> S 产出后、V 评审前触发。R3 复用 R 子代理机制，但目的为预防性审查而非根因定位。
>
> **无条件强制**：R3 覆盖**所有 S 变体**：S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**。任意 S 派遣后必须 R3×3 + V，无 flag，无「启用时」措辞。违反字面即违反精神。

**分派时序**：S 产出（任意变体）→ R3-completeness / R3-reliability / R3-security（可并行）→ V 评审

**S 变体与 R3 报告路径对应**：

| S 变体                          | action          | R3 报告路径前缀                |
| ------------------------------- | --------------- | ------------------------------ |
| 标准 S / S-doc / S-tla / S-bdd  | `produce`       | `<phase>-{dim}.json`           |
| S-ingest-tla / S-ingest-bdd     | `produce`       | `<phase>-ingest-{dim}.json`    |
| S-fix（返工变体）               | `fix`           | `<phase>-fix-{dim}.json`       |
| S-emergency-fix（紧急修复变体） | `emergency-fix` | `<phase>-emergency-{dim}.json` |

`check-preventive-review.ts` 支持 `--variant=standard|fix|emergency|ingest` 参数校验对应路径（ingest 须显式传参）；`--auto-trigger` 模式从 run-log 推断 S 变体。

**R3 子代理输入**：

- 当前阶段产物路径
- 上游产物（需求/设计文档、RTM、TLA+ 规格、BDD features）
- 审查维度（completeness / reliability / security）

**R3 子代理产出**：`.w-model/preventive-reviews/<phase>[-fix|-emergency]-{completeness,reliability,security}.json`

**阶段 5-8 opsx 三段式 stage 级 R3+V 产物**：

opsx 三段式（S-explore → S-propose → S-coding）每段须额外产出 stage 级审查产物：

- **R3（9 份）**：`.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md`
- **V 评审（3 份）**：`.w-model/v-reviews/phase<N>-{explore,propose,coding}.md`

这些 stage 级产物与 `check-opsx-artifacts.ts` 校验口径一致；缺失任一文件命中反模式 #39（跳过 opsx 产物审查）。

**PreventiveReview schema**：见 `schemas/preventive-review.schema.json`

**R3 审查清单（按维度）**：

| 维度         | 检查项                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------- |
| completeness | 字段齐全 / 模板套用 / RTM 登记 / demo 范围边界 / N-A 标记 / uat-path-mapping 回填                 |
| reliability  | TLA+/BDD 等价性 / 状态机一致性 / 接口契约 / 字段命名业务语义对齐 / 设计项装配点与测试 seam 一致性 |
| security     | 输入校验 / 鉴权 / 越权 / 敏感信息 / 限流装配 / 密码哈希                                           |

**R3 与返工R的区别**：

| 属性     | 返工R                                                      | 预防R3                                                                                                                        |
| -------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 触发时机 | V/G 不通过后触发                                           | S 产出后主动触发                                                                                                              |
| 目的     | 定位根因                                                   | 预防性审查                                                                                                                    |
| 产出     | RootCauseReport                                            | PreventiveReview 三份报告                                                                                                     |
| 方法论   | root-cause-locator.md（5-Why / 鱼骨图 / 上游回溯）定位根因 | 借鉴 root-cause-locator.md 分析工具，但目的不同：预防性审查用「完整性清单 + 可靠性核验 + 安全基线」三维度检查产物，不定位根因 |
| schema   | rootcause-report.schema.json                               | preventive-review.schema.json                                                                                                 |

**V 评审参考方式**：V 子代理在评审时须读取 R3 三份报告，将 R3 发现的问题纳入 `reworkHints`。V 不得跳过 R3 报告直接评审（命中反模式 #33）。

### R-iceberg 冰山扫掠分派模板

> S-fix 后（ICEBERG-A）或阶段门放行前（ICEBERG-B）触发。R-iceberg 是 R 子代理的冰山扫掠变体，以已发现/已修复问题为线索主动深挖隐藏问题，与 R（被动定位已暴露问题根因）正交。
> 方法论见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)；schema 见 `iceberg-sweep.schema.json`；校验脚本 `check-iceberg-sweep.ts`（反模式 #44）。

**分派时序**：

- ICEBERG-A：`S-fix 修复 → R3×3(fix) → V → G → [G 通过] → R-iceberg 扫掠`
- ICEBERG-B：`标准 V/G 通过（首次或返工最终）→ R-iceberg 全局扫掠 → newFindings=[] → CHECKPOINT 放行`

**产出路径**：`.w-model/iceberg/<reportId>.json`（JSON 报告）+ `.w-model/iceberg/<reportId>.md`（人类可读报告）

```
角色：根因定位子代理-冰山扫掠变体（R-iceberg）
当前 W 模型阶段：<阶段 N - 名称>
冰山轮次：<icebergRound，1-5>
触发类型：<ICEBERG-A | ICEBERG-B>

任务：以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 IcebergSweepReport

上下文：
  - 线索来源：
    - reworkHints 历史：<本阶段所有 V/G reworkHints 数组>
    - fixedPoints：<已修复的缺陷位置列表>
    - 关联 RootCauseReport 路径：<列表，用于提取根因类别>
    - 上一轮 IcebergSweepReport 路径：<若 icebergRound>1，用于去重>
  - 全阶段产物路径：<列出本阶段所有产物文件路径>
  - 上游产物路径（用于跨产物一致性检查）：<列出>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径>

必读：
  - references/iceberg-sweep-guide.md（冰山扫掠方法论）
  - references/conventions.md「格式约定」（location 格式）
  - references/hard-constraints.md（避免误判流程问题为产物问题）

扫掠方法：
  - 三维度：completeness / reliability / security
  - 六类别：same-root-cause-spread / same-defect-class / fix-induced-regression / adjacent-logic / coverage-gap / cross-artifact-inconsistency
  - 流程：加载线索 → 提取根因类别 → 三维度×六类别扫掠全产物 → 去重 → 产出报告

产出契约：
  1. IcebergSweepReport JSON：.w-model/iceberg/<reportId>.json
  2. 人类可读报告：.w-model/iceberg/<reportId>.md
  3. 必须满足 IcebergSweepReport Schema
  4. newFindings 每项须含可证伪 hypothesis + 具体 evidence
  5. 返回编排者：{role:"R", variant:"iceberg", reportId, reportPath, newFindingsCount, passed, summary}

禁止：
  - 改任何产物文件（由 S-fix 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 跨阶段定位
  - 跳过 V 复审直接触发 S-fix
  - 产出空泛发现（须可证伪 + 具体证据）
```

**ICEBERG 轮次计数**：ICEBERG-A 和 ICEBERG-B 共享 icebergRound 计数器（每阶段独立，阶段进入时重置为 0）。每次 R-iceberg 扫掠递增 1，修复不单独占轮次。达 maxIcebergRounds=5 时 CHECKPOINT 升级由用户裁定（选项：继续深挖 / 接受剩余项并放行 / 阶段回退）。

**R-iceberg 与返工R的区别**：

| 属性     | 返工R                           | R-iceberg                                         |
| -------- | ------------------------------- | ------------------------------------------------- |
| 触发时机 | V/G 不通过后触发                | S-fix 后（ICEBERG-A）+ 阶段门前（ICEBERG-B）      |
| 目的     | 定位已暴露问题的根因            | 主动深挖未暴露的隐藏问题                          |
| 产出     | RootCauseReport（单问题根因链） | IcebergSweepReport（多发现扫掠报告）              |
| 线索     | V/G reworkHints 单条            | reworkHints 历史 + fixedPoints + previousFindings |
| schema   | rootcause-report.schema.json    | iceberg-sweep.schema.json                         |

### V 复审根因报告分派模板（targetKind=rootcause）

```
角色：评审子代理（V）- rootcause 变体
评审目标：targetKind=rootcause / <reportId>
任务：复审 R 的根因报告准确性

上下文：
  - 待复审 R 报告 JSON 路径：<路径>
  - 待复审 R 报告 .md 路径：<路径>
  - 失败产物路径（用于核验根因证据）：<路径>
  - 上游产物路径（用于核验 upstreamDefect）：<列出>
  - 原始 V/G reworkHints：<数组>

必读：
  - references/root-cause-locator.md（方法与质量标准）
  - references/verifier-spec.md §6（输出 Schema，rootcause 复审仍用 VerifierOutput）

复审维度（rootcause 专用子标准）：
  - correctness：根因链是否逻辑自洽？证据是否支持？
  - completeness：是否触及根本原因而非停在现象？
  - falsifiability：可证伪假设是否可验证？
  - actionability：fixRecommendation 是否针对根因且可执行？
  - prevention：预防措施是否可落实？

产出契约：
  1. VerifierOutput JSON：<路径> .w-model/verifier/<reportId>-review.json
  2. targetKind=rootcause，persona=code-reviewer（或新增 rootcause-reviewer persona，待定）
  3. reworkHints 含 [Critical]/[Required] 时表示根因报告不准确，须重派 R
  4. 返回编排者：{role:"V", targetKind:"rootcause", qualityLevel, passed, reworkHints}

禁止：
  - 改 R 报告文件
  - 改产物文件
  - 跑门禁脚本
```

### S 兼 F 修复分派模板（返工变体）

> S-fix 与标准 S 一视同仁，产出后须 **R3×3 → V → G**（无条件强制，不得跳过 R3+V）。命中反模式 #42（S-fix / emergency-fix 后跳过 R3+V）一律回到 S-fix 产出后起点补跑 R3×3 + V。R3 报告路径走 `<phase>-fix-{completeness,reliability,security}.json`。

```
角色：产出子代理-修复变体（S-fix）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
模型档位：<显式指定，不得省略（省略即静默继承编排者会话模型）；返工轮次 4-5 时至少比卡住的实现者高一档 — 判据见 estimation-guide.md「模型档位 × 修复轮次 escalation」>
任务：按 R 报告的 fixRecommendation 修复产物 + 更新 RTM

上下文：
  - R 报告 JSON 路径（已 V 复审通过）：<路径>
  - R 报告 .md 路径：<路径>
  - 待修复产物路径：<路径>
  - 当前 RTM：<路径>
  - 上游产物路径：<列出>

必读：
  - references/phase-<N>-*.md（当前阶段验收标准）
  - references/rtm-guide.md
  - R 报告的 fixRecommendation（必读，修复依据）

产出契约：
  1. 修复后的产物文件（覆盖原文件）
  2. RTM 实体更新（若修复涉及 RTM）
  3. 返回编排者：{role:"S", variant:"fix", artifacts:<修复文件路径>, rtmDiff, fixBasedOn:"<reportId>", selfCheck}
  4. selfCheck 须含 fixRecommendation 落实情况逐条核验

禁止：
  - 无视 R 报告自行修复（命中反模式 #18）
  - 跑门禁脚本
  - 越阶段产出
  - 改 project.status
  - 修复时引入新缺陷（须自检）
```

### R-lead 子代理分派模板（多角度变体，并行/串行均可）

```
角色：根因定位子代理-主聚合变体（R-lead）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
任务：分派 N 个 R-persona 子代理（并行或串行均可，依宿主能力）→ 聚合产出最终 RootCauseReport

上下文：
  - 返工来源 + reworkHints（同 R 模板）
  - 失败产物路径 + 上游产物路径
  - rootCause.category 候选（由 O 根据 reworkHints 初判）
  - persona 选择矩阵（root-cause-locator.md §4.3）
  - 宿主分派方式：<parallel | serial | single-session-degraded>（由 O 根据宿主能力声明）

必读：
  - references/root-cause-locator.md
  - w-model-dev/subagent/<选中的 persona 文件>（R-lead 至少加载 incident-response-commander）

执行：
  1. 按 rootCause.category 选择 N 个 persona
  2. 按宿主能力选择分派方式：
     - parallel：并行分派 N 个 R-persona 子代理，收齐 N 份 PartialReport
     - serial：依次串行分派 N 个 R-persona 子代理，每个产出后归档并收集，N 份齐后进入聚合
     - single-session-degraded：R-lead 自身在 N 轮对话中分别加载 N 个 persona 文件，每轮产出一份 PartialReport
  3. 收集 N 份 PartialRootCauseReport（三种方式均须收齐 N 份）
  4. 按聚合规则（root-cause-locator.md §4.4）产出最终 RootCauseReport

产出契约：
  1. 最终 RootCauseReport JSON + .md（同 spec §4 Schema）
  2. 附录：N 份 PartialRootCauseReport 路径
  3. 返回编排者：{role:"R", variant:"lead", reportId, partialReports:[<id>], aggregationMethod, dispatchMode:<"parallel"|"serial"|"degraded">, rootCauseCategory, upstreamDefect, qualityLevel, passed, summary, disagreementResolved:<bool>}

禁止：
  - 跳过 persona 直接产出报告（强制多角度场景，不论并行/串行）
  - 串行分派时让后一个 persona 读取前一个 persona 的产出（须独立产出）
  - 无视 reality-checker 的 low confidence（须 passed=false）
  - 改产物 / 跑门禁 / 改 RTM
```

## 回填契约

子代理返回编排者的数据格式（结构化，便于编排者路由判定与 CHECKPOINT 展示）：

> **前置约束（[文件落地交接协议](#文件落地交接协议)）**：启用文件落地模式时，下列结构化数据须写入 `handoff/<dispatch-id>/status.json` + `output.md`，子代理返回 O 的文本进一步降至 ≤ 5 行信标（`state` + `dispatchId` + `status.json` 路径 + 一句话）。O 只 `Read` `status.json`，不读 `output.md`。下文 JSON 结构即 `status.json` / `output.md` 的内容契约。

### S 子代理返回

```json
{
  "role": "S",
  "phase": "<阶段 N - 名称>",
  "artifacts": ["<产物文件路径 1>", "<产物文件路径 2>"],
  "rtmDiff": {
    "added": ["REQ-001", "UAT-001"],
    "modified": ["REQ-002"],
    "removed": []
  },
  "selfCheck": {
    "acceptanceCriteriaMet": true,
    "notes": "<按 phase-N 验收标准自检的结果>"
  }
}
```

**RTM 实体回填强制职责**：

- RTM 实体回填是 S 子代理的强制职责，不得委托给其他角色；S 子代理产出后须立即更新 `.w-model/rtm.json`。
- S 子代理返回时须列出 `rtm.json` 文件路径与 coverage 百分比（如 `coveragePercent=100%`）。
- `coverageStatus` 字段值须与实际 coveragePercent 一致："100%" 对应 100%，"部分" 对应 < 100%，"待覆盖" 不允许（须回退重做）。
- 阶段门 CHECKPOINT 须展示 RTM 文件路径（`.w-model/rtm.json`）与 coverage 字段值，未展示视为约束 #3 违反。

### V 子代理返回

```json
{
  "role": "V",
  "targetKind": "<file | testcase | design>",
  "targetId": "<目标 ID>",
  "persona": "<code-reviewer | test-engineer | security-auditor | performance-auditor>",
  "verifierOutputPath": "<VerifierOutput JSON 文件路径>",
  "summary": "<评审摘要>",
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>
}
```

### G 子代理返回

```json
{
  "role": "G",
  "script": "check-verifier-output.ts | check-artifact-gate.ts",
  "exitCode": 0,
  "evidence": {
    "qualityLevel": "<A | B | C | D，仅 check-verifier-output.ts>",
    "passed": <true | false，仅 check-verifier-output.ts>,
    "reworkHints": ["<仅 check-verifier-output.ts，按 Severity 前缀>"],
    "gateJson": {
      "coverage": "<仅 check-artifact-gate.ts，RTM 覆盖率>",
      "unitTestPassed": "<仅 check-artifact-gate.ts>",
      "integrationTestPassed": "<仅 check-artifact-gate.ts>",
      "systemTestPassed": "<仅 check-artifact-gate.ts>",
      "acceptanceTestPassed": "<仅 check-artifact-gate.ts>"
    }
  }
}
```

编排者收到 G 子代理返回后：

- `exitCode=0` 且 `qualityLevel ∈ {A,B}` 且 `passed=true` → 进入 🔴 CHECKPOINT · 阶段门放行；
- `exitCode=1` 视为 V/G 失败 → `reworkHints` 只交 R 形成定位线索；必须完成普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）后，才可按 R 结论返工；
- `exitCode=2` → 输入错误，仅修正输入并重新运行对应命令（阶段门重新产出/终检修复输入），不进入 S-fix 旁路。

### A 子代理返回

```json
{
  "role": "A",
  "variant": "chunk | cross | evolve",
  "chunkId": "<仅 chunk 变体>",
  "entities": "<仅 chunk 变体，int>",
  "edges": "<仅 chunk 变体，int>",
  "totalEntities": "<仅 cross/evolve，int>",
  "totalEdges": "<仅 cross/evolve，int>",
  "isolatedNodes": ["<仅 cross/evolve>"],
  "connectedComponents": "<仅 cross/evolve，int>",
  "roots": ["<仅 cross/evolve>"],
  "reworkHints": [{ "chunkId": "<id>", "reason": "<...>" }],
  "blocked": "<仅 chunk 变体，可选>"
}
```

编排者收到 A 返回后：

- A-chunk `blocked` 非空 → 🔴 CHECKPOINT 介入；
- A-cross/A-evolve 返回后 → 分派 G 跑 `check-requirement-graph.ts`，按退出码决定收敛或补漏。

### R 子代理返回

```json
{
  "role": "R",
  "reportId": "RC-<phase>-<round>-<seq>",
  "reportPath": {
    "json": "<.w-model/rootcause/<reportId>.json>",
    "md": "<.w-model/rootcause/<reportId>.md>"
  },
  "rootCauseCategory": "<requirement-gap | design-flaw | ... | upstream-defect>",
  "upstreamDefect": {
    "present": <true | false>,
    "upstreamPhase": "<仅 present=true>",
    "rollbackRecommended": <true | false>
  },
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>,
  "summary": "<根因分析一句话结论>"
}
```

编排者收到 R 返回后：

- `passed=true` 且 `qualityLevel∈{A,B}` → 分派 V 复审根因报告（targetKind=rootcause）；
- `passed=false` 或 `qualityLevel∈{C,D}` → 重派 R（R 自评不通过，须重新分析）。

### S-fix 子代理返回（返工变体）

```json
{
  "role": "S",
  "variant": "fix",
  "artifacts": ["<修复后的产物文件路径>"],
  "rtmDiff": {
    "added": [],
    "modified": ["<RTM 实体 ID>"],
    "removed": []
  },
  "fixBasedOn": "<reportId>",
  "selfCheck": {
    "fixRecommendationImplemented": true,
    "notes": "<fixRecommendation 逐条落实情况>"
  }
}
```

编排者收到 S-fix 返回后：

- 分派 V 评审修复产物 → G 门禁 → 通过则阶段门放行 / 不通过则 `round++` 重新分派 R 定位。

## 强制约束

编排者不得直接执行以下任何动作（命中即触发反模式 #10，回到当前阶段起点重做）：

1. **写产物**：用 `Write` / `Edit` 写或修改任何阶段产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告 / 评审报告 / `.tla` / `.cfg` / `tla-manifest.json`）。
2. **产出评审**：直接产出 `VerifierOutput` JSON 内容（评审必须分派 V 子代理）。
3. **改 RTM 实体**：修改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果；编排者只可更新 `project.status` 与 `updatedAt`）。
4. **生成代码**：生成测试用例代码或业务代码。
5. **跳过顺序**：跳过 S → V → G 顺序（如编排者自评自审、或跳过 V 直接由编排者判断质量）。
6. **自行合并图谱/写 ingestion 文件**：用 `Write` / `Edit` 写 `.w-model/ingestion/*` 文件（必须分派 A 子代理）。命中即触发反模式 #10 变体。

- **跳过 R 命中反模式 #18**：V/G 不通过后，编排者必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。直接分派 S 返工（无 R 报告作为输入）命中 #18。

编排者**允许**的动作：

- 读 `.w-model/project.json` / `.w-model/rtm.json`；
- 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（用于向用户展示或路由判定，不替代 G 子代理的回填职责）；
- `git status` / `ls` / `Read` 等只读核验；
- 在 CHECKPOINT 暂停等待用户决定；
- 用户放行后更新 `project.status` 与 `updatedAt`；
- 分派 S / V / G 子代理。

> **检测信号**（命中任一即触发反模式 #10）：
>
> - 信号1：编排者会话出现 `Write` / `Edit` 调用写阶段产物文件
> - 信号2：编排者直接产出 `VerifierOutput` JSON 内容
> - 信号3：编排者 `git diff` 含非 `.w-model/*.json` 状态文件改动
> - 信号4：编排者会话出现代码 / 测试用例 / 评审 JSON 的生成内容
> - 信号5：编排者会话出现 `Write` / `Edit` 写 `.tla` / `.cfg` / `tla-manifest.json` 实体

> **回退动作**：① 立即停止编排者当前动作；② 已越权产出的实体作废重做；③ 重新分派 S 子代理产出；④ 重走 V → G；⑤ 编排者会话内仅保留路由 / 状态 / CHECKPOINT / 只读脚本记录。

## 反模式 #20：只规划不执行

> 子代理返回规划性内容而未调用任何执行工具，浪费 token + 轮次，任务无实际进展。本反模式由编排者在子代理返回后立即检测，命中即重派并强调「立即执行」约束。

**症状**：子代理响应中无任何 `tool_use` 块（只有纯文本），或响应包含「正在准备」「将创建」「步骤 1：读取...」「我将...」等规划性关键词，而产物文件未被实际创建（`ls` 检查无对应文件）。

**危害**：

- 浪费 token + 轮次，任务无实际进展
- 编排者误判为「子代理已开始执行」继续等待，CHECKPOINT 失守
- 多次重派仍只规划 → 阶段无法推进，预算耗尽

**检测信号**（命中任一即判反模式 #20）：

- 信号1：子代理响应中无任何 `tool_use` 块（只有纯文本）
- 信号2：响应包含「正在准备」「将创建」「步骤」「我将」等规划性关键词且无对应工具调用
- 信号3：产物文件未被实际创建（`ls` / `Read` 检查无对应文件或文件内容为空）

**正确做法**：

- 子代理必须在响应中调用至少一个执行工具（`Write` / `Edit` / `RunCommand` / `Read`）
- 禁止只返回纯文本规划，必须立即执行
- 多步骤任务每步都应有对应的工具调用，而非纯文本描述步骤
- 子代理返回时应附产物路径或工具调用结果摘要，便于编排者核验

**编排者防范**：

- 子代理 prompt 模板必须包含约束语句（强制）：
  > 「你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 `Write` / `Edit` / `RunCommand` 调用。」
- 编排者收到子代理返回后，先扫描返回中是否存在 `tool_use` 块或产物路径；不存在即判 #20 命中
- 命中后处理：回子代理起点重派，prompt 开头追加「⚠ 上次响应只规划未执行（命中反模式 #20），本次必须立即调用工具」
- 同一子代理连续命中 #20 ≥ 2 次 → 🔴 CHECKPOINT 介入（人工接管或调整任务粒度）

> 与反模式 #9（谎报状态）的关系：#20 是「未执行却声称在执行」的前兆；若子代理不仅规划还声称「已完成」但产物不存在 → 同时命中 #9 + #20，按 #9 处置（回退 + 标注教训）。

## S 子代理修改既有产物的边界

> S 子代理（产出子代理）与 R 子代理（根因定位）+ S-fix 子代理（修复变体）的职责边界。S 负责新增，R 负责定位，S-fix 负责修复——边界混淆会导致修复无根因依据、新产物污染既有产物、紧急修复无复核。

**职责划分**：

| 子代理                       | 产物动作                                                    | 典型场景                                                       |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **S 子代理**（标准变体）     | **新增**产物（新文件、新测试用例、新文档章节、新 RTM 实体） | 阶段首次产出：按 phase-N 定义产出本阶段开发产物 + 同步测试设计 |
| **S-fix 子代理**（返工变体） | **修复**既有产物的 bug（覆盖原文件）                        | 普通 V/G 失败链（hard-constraints）                            |
| **R 子代理**                 | **不修改任何产物**，仅产出 `RootCauseReport`                | 定位根因，输出 fixRecommendation 给 S-fix                      |

> S 子代理**不得**在标准产出阶段直接修复既有产物 bug；发现既有产物 bug 时按下方流程处理。

**S 子代理发现既有产物 bug 时的处理流程**：

1. **记录 rootcause**：S 子代理必须在 `.w-model/rootcause/rootcause-report.jsonl` 追加条目（`action=rootcause`），描述 bug 现象、影响范围、定位过程、初步根因猜测
   - 字段：`{action:"rootcause", phase, foundBy:"S", bugLocation, symptom, impact, guess}`
2. **转交 R 子代理**：非紧急修复一律转 R 子代理正式定位，S 子代理不得越权修改既有产物。R 子代理产出 `RootCauseReport` → V 复审 → G 门禁 → S-fix 修复（标准返工流程）
3. **紧急修复通道**（仅当 bug 阻塞当前阶段推进时启用，前置 R3+V+G）：
   - S 子代理可执行**最小修复**（仅修复阻塞点，不扩展功能、不重构）
   - 必须在 `.w-model/run-log.jsonl` 追加 `action=emergency-fix` 条目（见下格式）并填写阻塞原因
   - 紧急修复条目格式：`{role:"S", action:"emergency-fix", variant:"emergency-fix", blocker:<阻塞描述>, fixedLocation, fixBasedOn:"S-self-assessment"}`
   - emergency-fix 与其他 S 变体一视同仁，产出后须前置 **R3×3（completeness/reliability/security）→ V → G**，不得跳过。R3 报告路径走 `<phase>-emergency-{completeness,reliability,security}.json`（与 `check-preventive-review.ts --variant=emergency` 一致）。跳过 R3+V 命中反模式 #42。`variant=emergency-fix` + `blocker` 字段保留用于 run-log 审计，仅作为「为何走紧急通道」的说明，不再意味跳过审查。
   - **移除机制**：原「阶段完成后由 R 子代理复核紧急修复的完整性（R 复核产出追加到 `RootCauseReport` 的 `emergencyFixReview` 字段）」事后复核机制已移除。紧急修复的完整性由前置 R3×3 + V 兜底。

**违规检测**：

- `run-log.jsonl` 中 S 子代理（`role=S`）的 `action=fix` / `action=emergency-fix` 条目需特别审查：
  - `variant="emergency-fix"` + `blocker` 非空 → 合法紧急修复通道
  - `variant` 若出现须为 `fix` 或 `emergency-fix` 且与 action 一致（`action=fix` 声明 `variant=emergency-fix`、或 `action=emergency-fix` 声明 `variant=fix` 均属 variant 与 action 不符 → schema blocking）；**未声明 variant 的旧 fix 记录按向后兼容处理，不视为越权**——精确语义见本节紧急修复通道规则：仅 `emergency-fix` 强制 `variant=emergency-fix` + `blocker`（缺失即 blocking `[schema]`），`fix` 的 variant 可选（不强制出现）
- 未按返工流程（未经 R 根因定位报告与 V/G 门禁授权，见本文件「S-fix 子代理（返工变体）」返工循环）擅自修复既有产物的 `fix` 条目视为越权（反模式 #10/#18 变体），需回滚并由 R + S-fix 重做
- 检测脚本（精确语义，2026-09-04 与 run-log.schema.json / run-log-logic.ts 对齐）：`check-run-log.ts` 对 `action=fix` / `action=emergency-fix` 条目按以下规则判定——`action=emergency-fix` 强制 `variant=emergency-fix` 且 `blocker` 非空（schema 强制）；`action=fix` 的 `variant` **可选**，出现则必须为 `"fix"`（不强制出现，向后兼容 variant 规则引入前的 fix 记录）；已声明 `variant=emergency-fix` 却缺 `blocker`、或 variant 值不符 const 属真实不一致 → blocking `[schema]`；variant 规则引入前的旧记录（未声明 variant，含同时缺 identity 字段的双 legacy 行）经合并 legacy 谓词吸收为 **LEGACY_VARIANT / LEGACY_UNSCOPED 非阻断 diagnostic**，不进 blocking。动作-角色配对（`fix`/`emergency-fix`/`produce`→role=S 等）由 logic 层 blocking 强制。`preventive-review.schema.json` 另强制 `passed=false ⇒ findings ≥1`。

> 与反模式 #18（跳过 R 直接 S 返工）的关系：本边界条款是 #18 的细化——S 子代理发现既有 bug 时不得自行修复（即便 S 自评根因准确），必须走「记录 rootcause → 转 R → V 复审 → G 门禁 → S-fix」流程。紧急修复通道是「与其他 S 变体一视同仁的前置 R3+V+G 通道」——emergency-fix 产出后仍须 R3×3 + V + G，命中反模式 #42 一律回退。

## 豁免审批角色边界

> 覆盖缺失、conflicts-with 冲突、覆盖率不达标等事项须经强制 S→R→V→人类四阶段审批流程。本节扩展 S/R/V 角色边界，明确各角色在豁免审批中的职责与禁止动作。违反即命中反模式 #30（豁免审批跳步），见 [hard-constraints.md](hard-constraints.md)。

### 角色职责划分

| 角色            | 豁免审批职责                                                                                                      | 产出物                                                                                              | 禁止动作                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **S**           | 识别需豁免项（覆盖缺失 / conflicts-with / 覆盖率不达标），产出豁免请求                                            | `exemption-request.json`（含豁免理由、影响范围、替代方案）                                          | **禁止 S 自行决定豁免生效**（FM-EXEMPT-01）                              |
| **R**           | 按 [root-cause-locator.md](root-cause-locator.md) 方法论审查豁免请求（5-Why / 上游回溯 / 可证伪性）               | `exemption-review.json`（含 reviewDecision / rootCauseAnalysis / falsifiabilityCheck / conditions） | **不得直接批准豁免生效**（FM-EXEMPT-02）；R 仅产出审查意见，批准权在人类 |
| **V**           | 校验 R 的审查质量：`reviewDecision` / `rootCauseAnalysis` / `falsifiabilityCheck` / `conditions` 是否齐全且可证伪 | `exemption-verification.json`（含 passed / reworkHints）                                            | 禁止跳过校验直接放行（FM-EXEMPT-03）                                     |
| **人类**        | CHECKPOINT 确认豁免是否生效                                                                                       | `granted.json`（approve 写入）/ reject 回到原规则                                                   | —（编排者不得代签，FM-EXEMPT-04）                                        |
| **O（编排者）** | 路由豁免审批流程各阶段，分派 S/R/V，在 CHECKPOINT 暂停等人类确认                                                  | run-log 记录豁免审批各阶段                                                                          | 禁止代签人类确认（命中反模式 #10 + #30）                                 |

### 流程时序

```
O: 分派 S 产出需求规格 → V 评审发现覆盖缺失/conflicts-with/覆盖率<100%
  ↓
O: 分派 S 识别需豁免项
S: 产出 exemption-request.json → 返回 {豁免请求路径}
  ↓ （禁止 S 自行声明豁免生效）
O: 分派 R 审查豁免请求
R: 按 root-cause-locator.md 方法论审查 → 产出 exemption-review.json → 返回 {审查路径, reviewDecision}
  ↓ （R 不得直接批准豁免生效）
O: 分派 V 校验审查质量
V: 校验 reviewDecision/rootCauseAnalysis/falsifiabilityCheck/conditions → 产出 exemption-verification.json → 返回 {校验路径, passed}
  ↓
O: 🔴 CHECKPOINT · 豁免审批确认（展示豁免请求 + R 审查 + V 校验给用户）
  ↓
人类: approve → O 写入 granted.json / reject → 回到原规则（补需求或补覆盖）
  ↓
O: 分派 G 跑 check-exemption E1-E9 全通过 → 豁免生效
```

### 分派模板

#### S 豁免请求分派模板

```
角色：产出子代理（S）- 豁免请求变体
任务：识别需豁免项，产出 exemption-request.json
上下文：
  - 豁免来源：<V 评审 reworkHints 中的覆盖缺失/conflicts-with/覆盖率不达标项>
  - 需求规格路径：<路径>
产出契约：
  1. exemption-request.json：含 exemptionId / 豁免理由 / 影响范围 / 替代方案 / 关联 FM ID
  2. 返回编排者：{role:"S", variant:"exemption-request", requestPath, exemptionId}
禁止：
  - 自行决定豁免生效（FM-EXEMPT-01）
  - 用豁免掩盖需求遗漏（FM-EXEMPT-05）
```

#### R 豁免审查分派模板

```
角色：根因定位子代理（R）- 豁免审查变体
任务：按 root-cause-locator.md 方法论审查豁免请求
上下文：
  - exemption-request.json 路径：<路径>
  - 需求规格路径：<路径>
必读：
  - references/root-cause-locator.md
产出契约：
  1. exemption-review.json：含 reviewDecision / rootCauseAnalysis（5-Why）/ upstreamTrace（上游回溯）/ falsifiabilityCheck（可证伪性）/ conditions
  2. 返回编排者：{role:"R", variant:"exemption-review", reviewPath, reviewDecision}
禁止：
  - 直接批准豁免生效（FM-EXEMPT-02）
  - 模板化审查（缺 5-Why/上游回溯/可证伪性）
```

#### V 豁免校验分派模板

```
角色：评审子代理（V）- 豁免校验变体
任务：校验 R 的豁免审查质量
上下文：
  - exemption-request.json 路径：<路径>
  - exemption-review.json 路径：<路径>
产出契约：
  1. exemption-verification.json：含 passed / reworkHints（校验 reviewDecision/rootCauseAnalysis/falsifiabilityCheck/conditions）
  2. 返回编排者：{role:"V", variant:"exemption-verification", verificationPath, passed}
禁止：
  - 跳过校验直接放行（FM-EXEMPT-03）
```

> 豁免审批流程的收敛判定由 G 跑 `check-exemption` E1-E9 退出码决定（仿 ingestion 收敛由 G 跑 `check-requirement-graph.ts` 决定）。S/R/V 的产出仅作流程输入，不替代脚本判定。

## 与现有约束的兼容性

- **约束 4「真实执行」**：G 子代理跑脚本 + 回填退出码 = 真实执行，不冲突。
- **约束 6「按需加载」**：子代理按需加载对应 `phase-N-*.md`，编排者只加载 `SKILL.md` + 状态文件，加载面更窄。
- **约束 2「阶段门放行」**：G 子代理返回证据 → 编排者展示给用户 → CHECKPOINT 等待，不冲突。
- **[`verifier-spec.md`](verifier-spec.md) §7.6「外部 Agent 执行」**：V 子代理即「外部 Agent」，边界一致。
- **[`agent-personas.md`](agent-personas.md) 4 个 Persona**：V 子代理按 `targetKind` 选用，无改动。
- **技能不内置 LLM**：V 子代理由编排者通过宿主 Agent 的子代理机制（如 Task 工具）启动，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用。

## 失败模式与回退

| 失败场景                                                                                                  | 处理                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S 子代理产出未通过自检（`acceptanceCriteriaMet=false`）                                                   | 记录为 R 定位线索；普通失败完成完整链后再由 S-fix 返工：普通 V/G 失败链（hard-constraints）                                       |
| V 子代理产出 JSON 不满足 Schema                                                                           | G 子代理 `check-verifier-output.ts` 退出码 2 → 编排者分派 V 重新产出                                                              |
| G 子代理 `check-verifier-output.ts` 退出码 1（评审未通过）                                                | `reworkHints` 仅作 R 定位线索；必须执行普通 V/G 失败链（hard-constraints）后再由 S-fix 返工                                       |
| G 子代理 `check-artifact-gate.ts` 退出码 1（质量门未通过）                                                | 记录为 R 定位线索；必须执行普通 V/G 失败链（hard-constraints）后再由 S-fix 回阶段 5 返工                                          |
| 编排者自身越权实施（命中反模式 #10）                                                                      | 回到当前阶段起点，已越权产出的实体作废重做                                                                                        |
| 子代理无法独立完成（如 BLOCKED 状态）                                                                     | 子代理返回 `{"status": "BLOCKED", "reason": "..."}`；编排者向用户澄清后重新分派                                                   |
| R 自评不通过（`passed=false` 或 `qualityLevel∈{C,D}`）                                                    | 编排者重派 R（同一 round，不递增）；同一 round 内 R 重派 ≥2 次仍不通过 → 🔴 CHECKPOINT 介入（人工根因分析或调整 maxReworkRounds） |
| V 复审根因不通过（targetKind=rootcause `passed=false`）                                                   | 编排者重派 R（带 V 的 rootcause reworkHints，同一 round）；同一 round 内 V 复审不通过 ≥2 次 → 🔴 CHECKPOINT 介入（用户裁定根因）  |
| G 门禁不通过（`check-rootcause-report.ts` exitCode=1）                                                    | 编排者重派 R（带 G 的校验失败原因，同一 round）；通常为 Schema 不合规，R 修正报告即可                                             |
| S-fix 修复后 V/G 仍不通过                                                                                 | `round++` → 重新分派 R（不沿用上轮 R 报告，因产物已变化）；round 达 maxReworkRounds → 🔴 CHECKPOINT 升级（见场景 5 阶段回退）     |
| 阶段回退（场景 5：round≥2 + R 标记 upstreamDefect.present=true 且 rollbackRecommended=true + V 复审通过） | 强制 🔴 CHECKPOINT · 阶段回退决策，展示返工历史 + R 的 upstreamDefect 详情 + V 复审结论 + 建议回退阶段编号，由用户选择 A/B/C      |

## 与 addyosmani/agent-skills 的差异

| 维度           | addyosmani 原版   | W 模型适配版                                                                                                                                      |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 子代理分派方式 | 由 Agent 自身决定 | 强制 O / S / V / G / A / R 六角色协同：S/V/G 每阶段必派、R3 无条件 ≥3 条、A 阶段 1-4 必派（见本文件「角色分派完整性校验」节），编排者不得越权实施 |
| 评审独立性     | 由 Agent 自评     | V 子代理物理隔离，不接触 S 子代理内部推理                                                                                                         |
| 门禁执行       | 由 Agent 直接跑   | G 子代理独立跑 + 回填证据摘要                                                                                                                     |
| 编排者越权处置 | 无强制机制        | 反模式 #10，命中即回退                                                                                                                            |

## 角色分派完整性校验

> 对应约束 #8 + 反模式 #34。`check-role-dispatch.ts` 自动校验。

### 必分派条件

每阶段 run-log 须至少含以下角色记录各 1 条：

| 角色         | 必分派条件                                                                                                                                                                                                                          | 校验脚本                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| S（产出）    | 每阶段必须（产出开发产物 + 测试设计 + RTM 更新）                                                                                                                                                                                    | check-role-dispatch.ts                                                                         |
| V（评审）    | 每阶段必须（按 verifier-spec.md §6（输出 Schema）+ §8（提示词模板）产出 VerifierOutput JSON）                                                                                                                                       | check-role-dispatch.ts                                                                         |
| G（门禁）    | 每阶段必须（跑 check-*.ts + 回填证据摘要）                                                                                                                                                                                          | check-role-dispatch.ts                                                                         |
| R（根因/R3） | **无条件必须**（每阶段须有 `role=R` 且 `outcome=success` 的 `r3-completeness` / `r3-reliability` / `r3-security` 记录各 ≥1，覆盖所有 S 变体含 S-fix / S-emergency-fix；rootcause / iceberg-sweep / 失败记录不充数，重复维度不充数） | check-role-dispatch.ts（`--r3-enabled` flag 保留为 no-op 向后兼容；结果含 r3Missing 维度明细） |

### 可选条件

- A（分析）子代理仅在阶段 1–4 的分块分析与图谱演进时分派；阶段 5–8 可不分派。
- O（编排者）每阶段固定分派（CHECKPOINT），不在 check-role-dispatch.ts 校验范围（O 由约束 #2 阶段门放行覆盖）。

### 豁免条件

**self-as-verifier 模式豁免**（仅 demo 项目 / 非生产项目）：

- S/V/G/R 任两角色由同一 Agent 兼任时，run-log 中可同一 `runId` 条目标记多角色（如 `role="S/V"`），但须满足：
  1. 产出各角色独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON / PreventiveReview JSON 三份路径不同）
  2. run-log 条目的 `artifacts` 字段列出各角色独立产物路径
- 详见 SKILL.md「self-as-verifier 模式」节与反模式 #35。

### 校验命令

```bash
# R3 无条件强制，--r3-enabled flag 保留为 no-op 向后兼容
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl

# 兼容调用（flag 视为 no-op，行为一致）
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl --r3-enabled
```

退出码：0=通过，1=缺角色或 R3 维度（违反约束 #8/#11：每阶段 S/V/G 各 ≥1，R3 三维度各 ≥1；run-log 为空或全无效输入同样 exit 1——无记录不等于完整），2=输入错误。
