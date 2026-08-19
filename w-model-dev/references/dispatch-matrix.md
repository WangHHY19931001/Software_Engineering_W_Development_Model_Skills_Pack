# 分派总览矩阵（Dispatch Matrix）

> 工具/命令速查见 [toolbox.md](toolbox.md)（「I have X, I want Y → use Z」决策表，按用户意图组织，与本文档按阶段/角色组织互补）。

> 编排者分派子代理前的必读总览。本文件是 [subagent-delegation.md](subagent-delegation.md) 的索引视图，不替代其权威定义。

## 0. 按阶段分节加载导引

> 编排者进入某阶段前，按本导引只加载该阶段所需分节，避免一次性载入全文（反模式 #5）。
> 各阶段对应分节如下：

| 阶段 | 加载分节 | 对应表格 |
|---|---|---|
| 1 需求 | §1 + §2 + §3（阶段 1 行）+ §6.3（阶段 1 门） | §3 阶段 1 需求 S-doc/S-tla/S-bdd 三行；§6.3 阶段 1 门禁 |
| 2 系统设计 | §1 + §2 + §3（阶段 2 行）+ §6.3（阶段 2 门） | §3 阶段 2 系统设计三行；§6.3 阶段 2 门禁 |
| 3 概要设计 | §1 + §2 + §3（阶段 3 行）+ §6.3（阶段 3 门） | §3 阶段 3 概要设计三行；§6.3 阶段 3 门禁 |
| 4 详细设计 | §1 + §2 + §3（阶段 4 行）+ §6.3（阶段 4 门） | §3 阶段 4 详细设计三行；§6.3 阶段 4 门禁 |
| 5 编码 | §1 + §2 + §3（阶段 5 行）+ §5 三段式 + §6.3（阶段 5 门） | §3 阶段 5 编码三行；§5 explore/propose/coding 表；§6.3 阶段 5 门禁 |
| 6 集成测试 | §1 + §2 + §3（阶段 6 行）+ §5 三段式 + §6.3（阶段 6 门） | §3 阶段 6 集成测试三行；§5 三段式表；§6.3 阶段 6 门禁 |
| 7 系统测试 | §1 + §2 + §3（阶段 7 行）+ §5 三段式 + §6.3（阶段 7 门） | §3 阶段 7 系统测试三行；§5 三段式表；§6.3 阶段 7 门禁 |
| 8 验收测试 | §1 + §2 + §3（阶段 8 行）+ §5 三段式 + §6.3（阶段 8 门） | §3 阶段 8 验收测试三行；§5 三段式表；§6.3 阶段 8 门禁 |
| 返工循环 | §4 返工循环分派 + §1（R 角色）+ §6.2 | §4 返工循环表 + S-emergency-fix 表 |
| 全阶段通用 | §1 角色速查 + §7 反模式→check 映射 | §1 角色表 + §7 反模式映射表 |

> 阶段 1-4 的 A 子代理 ingestion 子流程见 §2 注（A-chunk/A-cross/A-evolve 分别加载 ingestion-chunk/ingestion-cross/graph-guide）。
> 阶段 5-8 进入 CHECKPOINT 时另跑 ensure-codegraph-opsx（见 §5 依赖引导）。

## 1. 角色速查

| 角色 | 简称 | 职责一句话 | 关键禁止动作 |
|---|---|---|---|
| O | 编排者 | 路由 / 状态 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本 | 不实施任何产物（反模式 #10） |
| S | 产出 | 生成阶段产物 + 同步测试设计 + 回填 RTM | 不跑门禁 / 不改 status |
| V | 评审 | 按 targetKind 路由 Persona + 产出 VerifierOutput JSON | 不改产物 / 不跑门禁 |
| G | 门禁 | 跑 check 脚本 + 回填证据摘要 | 不改产物 / 不产出评审 |
| A | 分析 | 阶段 1-4 分块 / 合并 / 图谱演进 | 不跑图谱门禁 / 不写正式产物 |
| R | 根因 | 返工时定位根因 + R3 预防性审查 | 不实施修复 / 不跨阶段 |

> S 变体（10 种）：S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd（阶段 1-4 拆分）/ S-explore / S-propose / S-coding（阶段 5-8 三段式）/ S-fix / S-emergency-fix（返工）。

### 1.1 S 变体 × R3/V/G 触发矩阵（消歧）

> 事实基准（check-preventive-review.ts 已确认）：R3 变体按**工作类型** 4 种（standard / fix / emergency / ingest），**不按 S 角色拆分**——S-doc / S-tla / S-bdd 共享同一套 standard R3×3。每阶段每变体一套 R3×3 + V×1 + G×1；阶段 5-8 opsx 按段（explore / propose / apply）各一套。消除 18→30 分派漂移歧义。

| 工作类型 variant | 触发场景 | R3 报告前缀 | R3×3 | V×1 | G×1 |
|---|---|---|---|---|---|
| standard | 标准 S 产出（S-doc / S-tla / S-bdd 共享一套） | `<phase>-{dim}.json` | ✅ | ✅ | ✅ |
| fix | S-fix 返工后 | `<phase>-fix-{dim}.json` | ✅ | ✅ | ✅ |
| emergency | S-emergency-fix 紧急修复后 | `<phase>-emergency-{dim}.json` | ✅ | ✅ | ✅ |
| ingest | S-ingest-tla / S-ingest-bdd 后 | `<phase>-ingest-{dim}.json` | ✅ | ✅ | ✅ |

阶段 5-8 opsx 三段式（每段各一套 R3×3 + V×1 + G×1）：

| 段 | S 变体 | R3×3 | V×1 | G×1 |
|---|---|---|---|---|
| explore | S-explore | ✅ | ✅ | ✅ |
| propose | S-propose | ✅ | ✅ | ✅ |
| apply | S-coding | ✅ | ✅ | ✅ |

## 2. 每阶段分派时序

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
O: 若 exitCode≠0 或 qualityLevel∈{C,D} → 返工循环（见 §4）
O: 若通过 → 🔴 CHECKPOINT · 阶段门放行（展示 G 证据 + RTM coverage）
O: 用户放行 → 更新 project.status → 进入下一阶段
```

> 阶段 1-4 ingestion 子流程（A→G 路径）：O 跑 plan-chunks.ts → A-chunk ×N → A-cross/A-evolve → G 跑 check-requirement-graph.ts → 收敛循环（MAX_ROUNDS=5）→ CHECKPOINT 收敛确认 → S 产出。

> 阶段 8 终检额外分派 G 跑 check-artifact-gate.ts（无 --phase 参数，终检）。

## 3. 阶段 × S 变体 × 产物 × reference × check 脚本总表

### 阶段 1-4（设计阶段，S 拆分为 S-doc / S-tla / S-bdd）

| 阶段 | S 变体 | 产出物 | 加载的 reference | 触发的 check 脚本 |
|---|---|---|---|---|
| 1 需求 | S-doc | 需求规格 + 验收测试用例 + 风险评估 + uat-path-mapping.md + RTM | phase-1-requirements / ingestion-chunk / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=1) / check-requirement-coverage / check-verifier-output / check-exemption(豁免时) |
| 1 需求 | S-tla | L1 TLA+ 规格（.tla + .cfg）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=1) / check-tla-bdd-sync |
| 1 需求 | S-bdd | L1 BDD features + bdd-manifest.json + RTM acceptanceTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=1) |
| 2 系统设计 | S-doc | 系统设计文档 + 系统测试用例（含性能/安全基线）+ RTM | phase-2-system-design / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=2) / check-verifier-output |
| 2 系统设计 | S-tla | L2 TLA+ 规格（L1 细化 + L2）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=2, --graph 强制) / check-tla-bdd-sync |
| 2 系统设计 | S-bdd | L2 BDD features（parent→L1）+ bdd-manifest.json + RTM systemTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=2, --graph 强制) |
| 3 概要设计 | S-doc | 接口设计文档 + 集成测试用例 + RTM | phase-3-outline-design / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=3) / check-verifier-output |
| 3 概要设计 | S-tla | L3 TLA+ 规格（L2 细化 + L3）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=3, --graph 强制) / check-tla-bdd-sync |
| 3 概要设计 | S-bdd | L3 BDD features（parent→L2）+ bdd-manifest.json + RTM integrationTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=3, --graph 强制) |
| 4 详细设计 | S-doc | 详细设计文档 + 单元测试用例 + RTM | phase-4-detailed-design / ingestion-cross / graph-guide / rtm-guide / design-patterns-catalog | check-requirement-graph(--phase=4，零违反硬约束) / check-verifier-output |
| 4 详细设计 | S-tla | L4 TLA+ 规格（L3 + 按需 L4）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=4, --graph 强制) / check-tla-bdd-sync |
| 4 详细设计 | S-bdd | L4 BDD features（parent→L3）+ bdd-manifest.json + RTM unitTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=4, --graph 强制) |

### 阶段 5-8（编码/测试执行阶段，S 三段式：S-explore / S-propose / S-coding）

| 阶段 | S 变体 | 产出物 | 加载的 reference | 触发的 check 脚本 |
|---|---|---|---|---|
| 5 编码 | S-explore | exploration-analysis.md（方案对比 + codegraph 影响初判） | phase-5-coding / rtm-guide | check-codegraph-queries / check-opsx-artifacts |
| 5 编码 | S-propose | opsx 产物（proposal/specs/design/tasks）+ tickets.md | phase-5-coding / rtm-guide | check-opsx-artifacts |
| 5 编码 | S-coding | 代码 + 单元测试 + codegraph-queries 落盘 + code-TLA 校验报告 + RTM codeModule 回填 | phase-5-coding / rtm-guide / quality-standards | check-code-tla-consistency / check-design-contract-consistency / check-state-machine-consistency / check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=5 cucumber) / check-artifact-gate(--phase=5) |
| 6 集成测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块） | phase-6-integration-test / rtm-guide | check-codegraph-queries / check-opsx-artifacts |
| 6 集成测试 | S-propose | opsx 产物 + tickets.md（测试代码切片） | phase-6-integration-test / rtm-guide | check-opsx-artifacts |
| 6 集成测试 | S-coding | 集成测试代码 + codegraph-queries 落盘 + 测试报告 + RTM integrationTest 回填 | phase-6-integration-test / rtm-guide | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=6 cucumber) / check-artifact-gate(--phase=6) |
| 7 系统测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块） | phase-7-system-test / rtm-guide / quality-standards | check-codegraph-queries / check-opsx-artifacts |
| 7 系统测试 | S-propose | opsx 产物 + tickets.md（测试代码切片） | phase-7-system-test / rtm-guide / quality-standards | check-opsx-artifacts |
| 7 系统测试 | S-coding | 系统测试代码 + codegraph-queries 落盘 + 性能/安全/兼容性报告 + RTM systemTest 回填 | phase-7-system-test / rtm-guide / quality-standards | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=7 cucumber) / check-artifact-gate(--phase=7) |
| 8 验收测试 | S-explore | exploration-analysis.md（测试策略 + codegraph 查被测模块） | phase-8-acceptance-test / rtm-guide | check-codegraph-queries / check-opsx-artifacts |
| 8 验收测试 | S-propose | opsx 产物 + tickets.md（测试代码切片） | phase-8-acceptance-test / rtm-guide | check-opsx-artifacts |
| 8 验收测试 | S-coding | 验收测试代码 + codegraph-queries 落盘 + 验收报告 + Archive 产物 + RTM acceptanceTest 回填 | phase-8-acceptance-test / rtm-guide | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-design-contract-consistency / check-openspec-archive |

> A 子代理（阶段 1-4 ingestion）：A-chunk 加载 ingestion-chunk / graph-guide；A-cross 加载 ingestion-cross / graph-guide；A-evolve 加载 ingestion-cross / graph-guide。A 不跑 check 脚本（G 负责）。

> V 子代理通用加载：agent-personas / verifier-spec / definition-of-done（阶段门时）；评审 BDD 时加 bdd-review-checklist；评审代码时加 quality-standards。

> O / 全角色通用加载：hard-constraints（14 条硬约束完整版，执行前必读）/ operation-behaviors（八条操作行为 + F1-F10）/ quick-self-check（推进前自检清单）/ design-philosophy（五条设计哲学）/ operational-recovery「成熟度与行为门禁」节（约束 #13 强制级别判定）/ estimation-guide（工期/预算估算时）/ context-management-guide（长会话上下文管理时）。

## 3.1 全 references 触发条件表（53 文件）

> `references/` 目录恰 53 份 .md。下表按「触发条件」组织，供编排者判断何时加载某文件。
> 标注 **2 跳** 的文件不直接出现在 §3 各阶段 reference 列，需经其上游文件（如 anti-patterns / phase-N / subagent-delegation）间接引用才可达——编排者按需显式加载，勿遗漏。

| 文件 | 触发条件 | 可达性 |
|---|---|---|
| agent-personas | V 子代理评审时选用 Persona（code-reviewer/test-engineer/security-auditor/performance-auditor） | 1 跳 |
| anti-patterns | 全阶段反模式 #1-#47 权威清单；编排者自查 / V/G 核验时 | 1 跳 |
| bdd-guide | 阶段 1-4 S-bdd 建模 + BDD↔TLA+ 同步 | 1 跳 |
| bdd-patterns-examples | S-bdd 产出 BDD features 时参考示例 | 1 跳 |
| bdd-review-checklist | V 评审 BDD 时 | 1 跳 |
| bdd-syntax-reference | S-bdd 产出 BDD features 时语法参考 | 1 跳 |
| code-smells-checklist | 阶段 5 代码评审 / 重构时识别坏味道（组 C/N 等） | 2 跳 |
| command-reference | 全命令 / 错误码 / ERROR_JSON 约定速查；O 分派脚本前 | 2 跳 |
| concurrency-guide | 阶段 5 并发专项检查 / 并发代码评审时 | 2 跳 |
| context-management-guide | 长会话上下文管理时（O 通用加载） | 1 跳 |
| data-models | `.w-model/*.json` 数据模型 / schema 强约束 / RunLogEntry vs EventIngress 边界 | 2 跳 |
| definition-of-done | 项目级 DoD 七维度；V 阶段门评审时 | 1 跳 |
| design-patterns-catalog | 阶段 4 详细设计套用设计模式时 | 1 跳 |
| design-philosophy | 五条设计哲学（主刀与修正权等）；O 通用加载 | 1 跳 |
| directory-conventions | 产出路径约定（阶段 1-4 产物落盘路径） | 2 跳 |
| dispatch-matrix | 本文件；编排者分派前必读总览 | — |
| estimation-guide | 工期 / 预算估算时（O 通用加载） | 1 跳 |
| event-ingress-guide | Loop 3 事件接驳；L2+ 成熟度激活时 | 2 跳 |
| format-conventions | 文档格式 / 命名 / 分隔符约定 | 2 跳 |
| glossary | 术语表权威定义；阶段 1-4 产出 glossary 子集时 | 2 跳 |
| graph-guide | 阶段 1-4 图谱门禁与收敛准则（A 子代理 + G） | 1 跳 |
| hard-constraints | 14 条硬约束完整版；执行前必读（O 通用加载） | 1 跳 |
| hill-climbing-guide | Loop 4 爬坡循环；run-log 分析伴侣 | 2 跳 |
| iceberg-sweep-guide | 冰山扫掠深度分析（S-fix 后 ICEBERG-A / 阶段门前 ICEBERG-B） | 2 跳 |
| ingestion-chunk | 阶段 1-4 A-chunk 分块细则 | 1 跳 |
| ingestion-cross | 阶段 1-4 A-cross/A-evolve 合并与图谱演进 | 1 跳 |
| operation-behaviors | 八条操作行为 + 失败模式 F1-F10；O 通用加载 | 1 跳 |
| operational-recovery | 恢复 / 成熟度与行为门禁分级（约束 #13）；O 通用加载 | 1 跳 |
| phase-1-requirements | 阶段 1 需求细则（含迷雾登记册 Fog of War） | 1 跳 |
| phase-2-system-design | 阶段 2 系统设计细则 | 1 跳 |
| phase-3-outline-design | 阶段 3 概要设计细则 | 1 跳 |
| phase-4-detailed-design | 阶段 4 详细设计细则 | 1 跳 |
| phase-5-coding | 阶段 5 编码细则（codegraph 修改前影响分析） | 1 跳 |
| phase-6-integration-test | 阶段 6 集成测试细则 | 1 跳 |
| phase-7-system-test | 阶段 7 系统测试细则 | 1 跳 |
| phase-8-acceptance-test | 阶段 8 验收测试细则 | 1 跳 |
| quality-standards | 阶段 5/7 代码质量 / 评审代码时 | 1 跳 |
| quick-self-check | 推进前自检清单；O 通用加载 | 1 跳 |
| refactoring-catalog | 阶段 5 重构手法速查（与 code-smells-checklist 互引） | 2 跳 |
| root-cause-locator | R 子代理根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯） | 2 跳 |
| rtm-guide | RTM 维护 / 回填规则 | 1 跳 |
| signature-chain-guide | 角色链式签名 + 产出来源正确性（反模式 #32） | 2 跳 |
| skillopt-adoption | SkillOpt 方法论吸收（bounded edit 边界规则） | 2 跳 |
| subagent-delegation | O/A/S/V/G/R 编排者-子代理边界权威定义 | 1 跳 |
| subagent-persona-matrix | R-lead / V-lead 多角度 persona 选择矩阵 | 2 跳 |
| tla-plus-guide | 阶段 1-4 TLA+ 层次化状态机建模与行为门禁 | 1 跳 |
| tla-plus-patterns-examples | S-tla 产出 TLA+ 规格时参考示例 | 1 跳 |
| tla-plus-review-checklist | V 评审 TLA+ 时 | 1 跳 |
| tla-plus-syntax-reference | S-tla 产出 TLA+ 规格时语法参考 | 1 跳 |
| tla-plus-tlc-configuration | S-tla 配置 TLC 模型检查时 | 1 跳 |
| toolbox | 工具/命令速查（「I have X, I want Y → use Z」决策表） | 1 跳 |
| verifier-spec | V 子代理评审提示词 + 五轴评审 §7.4A + self-as-verifier 模式 | 1 跳 |
| workflow | 完整工作流程（初始化项目 / 阶段切换 / 向用户解释整体流程时） | 2 跳 |

> 2 跳文件共 16 个：code-smells-checklist / command-reference / concurrency-guide / data-models / directory-conventions / event-ingress-guide / format-conventions / glossary / hill-climbing-guide / iceberg-sweep-guide / refactoring-catalog / root-cause-locator / signature-chain-guide / skillopt-adoption / subagent-persona-matrix / workflow。
> 其余 36 个文件均直接出现在 §3 各阶段 reference 列或 O/V 通用加载（1 跳），加本文件共 37 个 1 跳可达。

## 4. 返工循环分派

V/G 不通过 → R 定位 → V 复审 → G 门禁 → S-fix 修复 → R3×3 → V → G（约束 #12 + #11 + #8）

| 步骤 | 角色 | 产物 | check 脚本 | R3 报告路径前缀 |
|---|---|---|---|---|
| 1 | R | RootCauseReport JSON + .md | check-rootcause-report | — |
| 2 | V | VerifierOutput（targetKind=rootcause） | check-verifier-output | — |
| 3 | G | gate-logs 证据 | check-rootcause-report + check-verifier-output | — |
| 4 | S-fix | 修复后的产物 + RTM 更新 | 同原阶段 check 脚本 | `<phase>-fix-{dim}.json` |
| 5 | R3×3 | 3 份 preventive-review JSON（completeness/reliability/security） | check-preventive-review(--variant=fix) | `<phase>-fix-{dim}.json` |
| 6 | V | VerifierOutput | check-verifier-output | — |
| 7 | G | gate-logs 证据 | 原阶段门禁脚本 + 5 闭环脚本 | — |

### S-emergency-fix（紧急修复通道，仅阻塞当前阶段时启用）

| 步骤 | 角色 | 产物 | check 脚本 | R3 报告路径前缀 |
|---|---|---|---|---|
| 1 | S-emergency-fix | 最小修复（仅阻塞点）+ run-log 标注 blocker | 同原阶段 check 脚本 | `<phase>-emergency-{dim}.json` |
| 2 | R3×3 | 3 份 preventive-review JSON | check-preventive-review(--variant=emergency) | `<phase>-emergency-{dim}.json` |
| 3 | V | VerifierOutput | check-verifier-output | — |
| 4 | G | gate-logs 证据 | 原阶段门禁脚本 + 5 闭环脚本 | — |

> 约束 #11：S-fix / S-emergency-fix 与标准 S 一视同仁，产出后须 R3×3 → V → G，不得跳过。跳过命中反模式 #42。事后 R 复核机制（emergencyFixReview 字段）已移除，由前置 R3+V+G 兜底。

> 冰山扫掠（反模式 #44）：S-fix 返工通过后跑 ICEBERG-A、阶段门放行前跑 ICEBERG-B（`check-iceberg-sweep.ts` R1-R5）；`newFindings=[]` 或达 maxIcebergRounds=5 才放行，新发现须经 V 复审后走标准 R→V→G→S-fix。

> 跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。

## 5. 阶段 5-8 三段式 S 分派（opsx + codegraph）

> 约束 #14。每段产物须跑 R3×3 + V 审查（反模式 #39）。
> 依赖引导：阶段 5 进入 CHECKPOINT 时另跑 `ensure-codegraph-opsx.ts`（L1 CLI / L2 MCP / L3 项目目录三层检测 + 自动安装）；阶段 6-8 复检（--mode quick）。

| 段 | S 变体 | 产物 | reference | check 脚本 |
|---|---|---|---|---|
| explore | S-explore | exploration-analysis.md（方案对比 / 推荐 / codegraph 影响初判） | phase-N-*.md + rtm-guide | check-codegraph-queries / check-opsx-artifacts |
| propose | S-propose | opsx 产物（proposal/specs/design/tasks）+ tickets.md（tracer-bullet + blocking edges DAG） | phase-N-*.md + rtm-guide | check-opsx-artifacts |
| coding | S-coding | 代码 + 测试 + codegraph-queries 落盘 + TLA 校验报告 | phase-N-*.md + rtm-guide + quality-standards(阶段5/7) | check-codegraph-queries + check-opsx-artifacts + 原阶段 check |

### stage 级 R3 + V 产物（阶段 5-8 opsx 三段式专属）

| 产物类型 | 路径 | 数量 |
|---|---|---|
| R3 报告 | `.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md` | 9 份 |
| V 评审 | `.w-model/v-reviews/phase<N>-{explore,propose,coding}.md` | 3 份 |

> 缺失任一文件命中反模式 #39（跳过 opsx 产物审查），由 check-opsx-artifacts.ts 校验。

### opsx 与 S-tickets 职责边界（反模式 #40）

| 制品 | 产出者 | 内容 | 职责 |
|---|---|---|---|
| tasks.md | opsx:propose | 高层任务清单（what/why） | 规格级规划 |
| tickets.md | S-tickets（S-propose 兼任） | 代码垂直切片（how，端到端可 demo） | 代码级切片 |

> S-coding 不做拆解，只按 tickets.md frontier 执行。每片 Edit/Write 前须 codegraph_explore（约束 #14，反模式 #38）。

## 6. 每阶段门禁脚本清单

### 6.1 全阶段必跑脚本（约束 #11，5 个闭环脚本）

| 脚本 | 用途 | 触发时机 |
|---|---|---|
| check-budget | 预算检查 | 每阶段门放行前 |
| check-run-log | run-log 完整性 + 字段 schema + R3 记录数 | 每阶段门放行前 |
| check-maturity | 成熟度判定 | 每阶段门放行前 |
| check-checkpoint | CHECKPOINT acknowledgedDecisions 关键词 | 每阶段门放行前 |
| check-preventive-review | R3 三份报告完整性（--variant=standard/fix/emergency/ingest） | V 评审前（always-on） |

### 6.2 全阶段通用脚本

| 脚本 | 用途 | 触发时机 |
|---|---|---|
| check-verifier-output | V 评审 JSON 校验（R1-R13，含 R13 单轴下限） | V 产出后 G 跑 |
| check-rootcause-report | RootCauseReport 校验（R1-R10：根因链 / 可证伪 / 修复建议 / 预防 / 上游缺陷 / 质量等级 / 报告 ID / 多角度 / reality-checker 置信度） | 返工循环：R 定位后 G 校验（见 §4 步骤 1/3） |
| check-role-dispatch | 角色 S/V/G 各 ≥1 + R ≥3 无条件校验（约束 #8） | 每阶段门放行前 |
| check-signature-chain | 签名链 R1-R10（含 O 越权 / 代签检测） | 每阶段门放行前 |
| check-iceberg-sweep | 冰山扫掠报告校验（R1-R5，反模式 #44） | S-fix 通过后（ICEBERG-A）+ 阶段门放行前（ICEBERG-B） |

### 6.3 阶段专属脚本

| 阶段门 | 必跑脚本（约束 #11 通用） | 阶段专属脚本 |
|---|---|---|
| 1 需求 | 5 闭环 + check-verifier-output + check-role-dispatch + check-signature-chain | check-requirement-graph(--phase=1) / check-requirement-coverage / check-tla-model(--phase=1) / check-bdd-model(--phase=1) / check-tla-bdd-sync / check-exemption(豁免时) |
| 2 系统设计 | 同上 | check-requirement-graph(--phase=2) / check-tla-model(--phase=2, --graph 强制) / check-bdd-model(--phase=2, --graph 强制) / check-tla-bdd-sync |
| 3 概要设计 | 同上 | check-requirement-graph(--phase=3) / check-tla-model(--phase=3, --graph 强制) / check-bdd-model(--phase=3, --graph 强制) / check-tla-bdd-sync |
| 4 详细设计 | 同上 | check-requirement-graph(--phase=4，零违反硬约束) / check-tla-model(--phase=4, --graph 强制) / check-bdd-model(--phase=4, --graph 强制) / check-tla-bdd-sync |
| 5 编码 | 同上 | check-code-tla-consistency / check-design-contract-consistency / check-state-machine-consistency / check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=5 cucumber) / check-artifact-gate(--phase=5) |
| 6 集成测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=6 cucumber) / check-artifact-gate(--phase=6) |
| 7 系统测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=7 cucumber) / check-artifact-gate(--phase=7) |
| 8 验收测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-design-contract-consistency / check-openspec-archive |

> 阶段 4 硬约束：check-requirement-graph.ts --phase=4 + check-tla-model.ts --phase=4 退出码必须为 0（零违反），否则不放行进阶段 5 编码。

> 反模式 #21（阶段级门禁跳过）：阶段 6/7/8 完成时必须跑对应 `--phase=N`，不得跳过直接跑 `--phase=8` 终检。

### 6.4 工具与元门禁脚本（门禁脚本权威登记表收尾）

> 本小节补全非阶段门触发的工具类 CLI 与元门禁脚本，与 `w-model-dev/scripts/cli/` 目录 33 个 .ts
> 一一对应（26 个 check-* + 7 个工具：ensure-codegraph-opsx 见 §5 / 其余见下表）。
> **新增 / 改名门禁脚本时只在本文件登记一处**——`check-docs-consistency.ts` 的 script-registry 检查
> 核对全部 33 个 cli 脚本名均出现于本文件（漏登记即门禁失败，pre-push 第 14 项拦截）。

| 脚本 | 类别 | 用途 | 触发时机 |
|---|---|---|---|
| check-docs-consistency | 元门禁 | 活体文档一致性门禁（计数 / 枚举 / 版本七处 / 章节号连续性 / 脚本注册表） | 仓库维护（pre-push 第 14 项），非项目阶段门 |
| check-samples-coverage | 元门禁 | samples 覆盖矩阵门禁（每个 fixture 被 self-test 引用 + 目录在 samples/README 声明） | 仓库维护（pre-push 第 15 项），非项目阶段门 |
| security-scan | 工具 | eslint-plugin-security 扫描 + baseline v2 内容敏感指纹豁免 | 仓库维护（pre-push 第 6 项），非项目阶段门 |
| self-test | 工具 | 256 条样本回归基线（全部 check 逻辑通过/失败/输入错误三态） | 仓库维护（pre-push 第 1 项），非项目阶段门 |
| wm-status | 工具 | 状态快照（只读） | O 只读查询，不分派子代理 |
| metrics-report | 工具 | 流程度量报告（只读） | O 只读查询，不分派子代理 |
| wm-write | 工具 | 状态文件安全写（.bak 备份 + mtime 乐观锁 + 原子替换 + 回读校验；logic/state-write-logic.ts） | O/A/S 持久化 `.w-model/*.json` 状态文件时统一经此写入（防手写漂移） |
| doctor | 工具 | 环境自检（node/tsx/ajv/java/tla2tools/codegraph/openspec 逐项 ✅/❌/⚠️ + 修复指引；--with-tla 升级 TLA+ 项为阻断级；logic/doctor-logic.ts） | 首次启用 / 依赖报错时诊断（SKILL 步骤 1.5），非阶段门 |

## 7. 反模式 → check 脚本映射速查

| 反模式 | 守护脚本 / 机制 |
|---|---|
| #1 跳过评审 | check-verifier-output + 🔴 CHECKPOINT 阶段门 |
| #3 / #6 估算质量门/RTM | check-artifact-gate |
| #4 评审未通过悄悄小修 | check-verifier-output（rework 闭环） |
| #10 编排者越权 | check-signature-chain + check-role-dispatch |
| #11-13 ingestion 图谱 | check-requirement-graph |
| #14-17 TLA+ 行为门禁 | check-tla-model |
| #18 跳过 R 直接 S 返工 | check-rootcause-report + run-log R3 扩展 |
| #19 R 报告未 V 复审 | check-verifier-output(targetKind=rootcause) |
| #21 阶段级门禁跳过 | check-artifact-gate --phase=N（阶段 6/7/8 必须跑对应 --phase=N） |
| #26 字段混用 | check-run-log R1 |
| #28 schema 前置校验缺失 | schema-loader validateBySchema |
| #29 BDD 不符未回退 | check-bdd-model D4 等价性 |
| #30 豁免审批跳步 | check-exemption E1-E9 |
| #33 跳过 R3 | check-preventive-review（--variant=standard|fix|emergency|ingest）+ check-run-log R8 |
| #34 漏派角色 | check-role-dispatch（R≥3 无条件） |
| #38 codegraph 未查询 | check-codegraph-queries |
| #39 跳过 opsx 审查 | check-opsx-artifacts |
| #41 单轴失败掩盖 | check-verifier-output R13 |
| #42 S-fix 跳过 R3+V | check-preventive-review(--variant=fix/emergency) + check-run-log R8 |
| #44 跳过冰山扫掠直接放行 | check-iceberg-sweep（R1-R5，ICEBERG-A/B 触发）+ V 复审新发现 |
| #48 子代理越界实施 | check-run-log.ts（R5 role-action 配对）/ check-signature-chain.ts |

> 数据来源：SKILL.md + subagent-delegation.md + phase-1~8-*.md + anti-patterns.md；本矩阵随版本演进，以当前 SKILL.md 为准。
