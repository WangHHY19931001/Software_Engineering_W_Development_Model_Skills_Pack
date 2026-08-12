# 分派总览矩阵（Dispatch Matrix）

> 编排者分派子代理前的必读总览。本文件是 [subagent-delegation.md](subagent-delegation.md) 的索引视图，不替代其权威定义。

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
| 1 需求 | S-doc | 需求规格 + 验收测试用例 + 风险评估 + uat-path-mapping.md + RTM | phase-1-requirements / ingestion-chunk / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=1) / check-verifier-output / check-exemption(豁免时) |
| 1 需求 | S-tla | L1 TLA+ 规格（.tla + .cfg）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=1) |
| 1 需求 | S-bdd | L1 BDD features + bdd-manifest.json + RTM acceptanceTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=1) |
| 2 系统设计 | S-doc | 系统设计文档 + 系统测试用例（含性能/安全基线）+ RTM | phase-2-system-design / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=2) / check-verifier-output |
| 2 系统设计 | S-tla | L2 TLA+ 规格（L1 细化 + L2）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=2, --graph 强制) |
| 2 系统设计 | S-bdd | L2 BDD features（parent→L1）+ bdd-manifest.json + RTM systemTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=2, --graph 强制) |
| 3 概要设计 | S-doc | 接口设计文档 + 集成测试用例 + RTM | phase-3-outline-design / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=3) / check-verifier-output |
| 3 概要设计 | S-tla | L3 TLA+ 规格（L2 细化 + L3）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=3, --graph 强制) |
| 3 概要设计 | S-bdd | L3 BDD features（parent→L2）+ bdd-manifest.json + RTM integrationTest 列 | bdd-guide / bdd-syntax-reference / bdd-patterns-examples | check-bdd-model(--phase=3, --graph 强制) |
| 4 详细设计 | S-doc | 详细设计文档 + 单元测试用例 + RTM | phase-4-detailed-design / ingestion-cross / graph-guide / rtm-guide | check-requirement-graph(--phase=4，零违反硬约束) / check-verifier-output |
| 4 详细设计 | S-tla | L4 TLA+ 规格（L3 + 按需 L4）+ tla-manifest.json | tla-plus-guide / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-syntax-reference / tla-plus-tlc-configuration | check-tla-model(--phase=4, --graph 强制) |
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
| 8 验收测试 | S-coding | 验收测试代码 + codegraph-queries 落盘 + 验收报告 + Archive 产物 + RTM acceptanceTest 回填 | phase-8-acceptance-test / rtm-guide | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-openspec-archive |

> A 子代理（阶段 1-4 ingestion）：A-chunk 加载 ingestion-chunk / graph-guide；A-cross 加载 ingestion-cross / graph-guide；A-evolve 加载 ingestion-cross / graph-guide。A 不跑 check 脚本（G 负责）。

> V 子代理通用加载：agent-personas / verifier-spec / definition-of-done（阶段门时）；评审 BDD 时加 bdd-review-checklist；评审代码时加 quality-standards。

> O / 全角色通用加载（第 44 轮新增，SKILL.md 减负后按需取用）：hard-constraints（14 条硬约束完整版，执行前必读）/ operation-behaviors（八条操作行为 + F1-F10）/ quick-self-check（推进前自检清单）/ design-philosophy（五条设计哲学）/ operational-recovery「成熟度与行为门禁」节（约束 #13 强制级别判定）。

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

> 约束 #11（第29轮升级）：S-fix / S-emergency-fix 与标准 S 一视同仁，产出后须 R3×3 → V → G，不得跳过。跳过命中反模式 #42。事后 R 复核机制（emergencyFixReview 字段）已移除，由前置 R3+V+G 兜底。

> 跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。

## 5. 阶段 5-8 三段式 S 分派（opsx + codegraph）

> 对应 SSoT §3.4.21 + 约束 #14。每段产物须跑 R3×3 + V 审查（反模式 #39）。

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
| check-preventive-review | R3 三份报告完整性（--variant=standard/fix/emergency） | V 评审前（always-on） |

### 6.2 全阶段通用脚本

| 脚本 | 用途 | 触发时机 |
|---|---|---|
| check-verifier-output | V 评审 JSON 校验（R1-R13，含 R13 单轴下限） | V 产出后 G 跑 |
| check-role-dispatch | 角色 S/V/G 各 ≥1 + R ≥3 无条件校验（约束 #8） | 每阶段门放行前 |
| check-signature-chain | 签名链 R1-R10（含 O 越权 / 代签检测） | 每阶段门放行前 |

### 6.3 阶段专属脚本

| 阶段门 | 必跑脚本（约束 #11 通用） | 阶段专属脚本 |
|---|---|---|
| 1 需求 | 5 闭环 + check-verifier-output + check-role-dispatch + check-signature-chain | check-requirement-graph(--phase=1) / check-tla-model(--phase=1) / check-bdd-model(--phase=1) / check-exemption(豁免时) |
| 2 系统设计 | 同上 | check-requirement-graph(--phase=2) / check-tla-model(--phase=2, --graph 强制) / check-bdd-model(--phase=2, --graph 强制) |
| 3 概要设计 | 同上 | check-requirement-graph(--phase=3) / check-tla-model(--phase=3, --graph 强制) / check-bdd-model(--phase=3, --graph 强制) |
| 4 详细设计 | 同上 | check-requirement-graph(--phase=4，零违反硬约束) / check-tla-model(--phase=4, --graph 强制) / check-bdd-model(--phase=4, --graph 强制) |
| 5 编码 | 同上 | check-code-tla-consistency / check-design-contract-consistency / check-state-machine-consistency / check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=5 cucumber) / check-artifact-gate(--phase=5) |
| 6 集成测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=6 cucumber) / check-artifact-gate(--phase=6) |
| 7 系统测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=7 cucumber) / check-artifact-gate(--phase=7) |
| 8 验收测试 | 同上 | check-codegraph-queries / check-opsx-artifacts / check-bdd-model(--phase=8 cucumber) / check-artifact-gate(终检) / check-archive-integrity / check-openspec-archive |

> 阶段 4 硬约束：check-requirement-graph.ts --phase=4 + check-tla-model.ts --phase=4 退出码必须为 0（零违反），否则不放行进阶段 5 编码。

> 反模式 #21（阶段级门禁跳过）：阶段 6/7/8 完成时必须跑对应 `--phase=N`，不得跳过直接跑 `--phase=8` 终检。

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
| #21 阶段级门禁跳过 | check-artifact-gate --phase=N + run-log R5 |
| #26 字段混用 | check-run-log R1 |
| #28 schema 前置校验缺失 | schema-loader validateBySchema |
| #29 BDD 不符未回退 | check-bdd-model D4 等价性 |
| #30 豁免审批跳步 | check-exemption E1-E8 |
| #33 跳过 R3 | check-preventive-review + check-run-log R8 |
| #34 漏派角色 | check-role-dispatch（R≥3 无条件） |
| #38 codegraph 未查询 | check-codegraph-queries |
| #39 跳过 opsx 审查 | check-opsx-artifacts |
| #41 单轴失败掩盖 | check-verifier-output R13 |
| #42 S-fix 跳过 R3+V | check-preventive-review(--variant=fix/emergency) + check-run-log R8 |

> 数据来源：SKILL.md + subagent-delegation.md + phase-1~8-*.md + anti-patterns.md，版本号 35.0.0。
