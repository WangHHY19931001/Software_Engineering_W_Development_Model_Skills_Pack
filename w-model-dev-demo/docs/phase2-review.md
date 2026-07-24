# 阶段 2 评审报告（V 子代理 / LLM-as-a-Verifier）

> 评审对象：blog-system-demo 阶段 2 系统设计 + 系统测试设计 + L2 TLA+ 规格 + 图谱一致性 + 阶段 1 决策落实
> 评审 Agent：V-subagent-phase2（trae-glm-5，text-parse 模式，repeatTimes=3）
> 评审时间：2026-07-25T06:30:00+08:00
> 评审依据：verifier-spec.md §7.2（design 子标准）、phase-2-system-design.md 验收标准、graph-guide.md 信息流不变式、tla-plus-guide.md 规范

## 0. 评审范围

| # | 评审对象 | 路径 |
|---|---|---|
| 1 | 系统设计文档 | docs/system-design.md |
| 2 | 系统测试设计文档 | docs/system-test-design.md |
| 3 | L2 TLA+ 规格（6 份） | tla/L2_identity_access.tla ~ L2_infrastructure.tla |
| 4 | TLA+ 清单 | .w-model/tla-manifest.json |
| 5 | 图谱 | .w-model/ingestion/graph.json |
| 6 | 阶段 1 产物（对照基准） | docs/requirement-spec.md + tla/L1_blog_system.tla + .w-model/verifier-output-phase1.json |

## 1. 评审结论摘要

- **综合分数**：0.8240
- **质量等级**：B（基本达成，可附条件放行）
- **是否通过**：❌ **未通过**——存在 1 项 P0 阻断项（TLA+ L2 规范未通过语法+TLC 校验，违反硬约束）
- **放行条件**：完成 P0 修复（6 份 L2 TLA+ 规范通过 SANY 语法检查 + TLC 模型校验，确认零死锁/零不变式违反/零状态爆炸）后可放行进入阶段 3。

### 1.1 阶段 digest（三要素）

1. **关键决策摘要**：系统设计采用 Express 4 + TypeScript 5 strict + 内存 Map + WAL 文件存储，划分 6 子系统（SD-001~006），SD-006 基础设施为 governance 治理节点统辖 SD-001~005。技术选型按 5 维度决策矩阵评分（存储/邮件/测试框架）。阶段 1 的 CONFLICT-001（邮件必需）/CONFLICT-002（WAL vs 审计日志分离）+ GAP-001~012 + REQ-012 六态状态机均已落实。
2. **产物核心结构**：系统设计含 C4 架构图 + 部署图 + 6 子系统模块划分 + 12 实体数据模型 + RBAC 4 角色权限矩阵 + 文章六态状态机（14 合法转换）。系统测试设计含 8 条 TC-DES（端到端/性能基线 P95≤200ms 100QPS/安全基线/跨子系统集成/崩溃恢复）。6 份 L2 TLA+ 覆盖 6 SD，variableCombination 均 <1000。图谱 30 节点 148 边，单根 REQ-000，零信息流违反。
3. **遗留风险/已知限制**：P0——6 份 L2 TLA+ 规范均未通过 SANY 语法检查与 TLC 模型校验（tla-manifest.json 全部 syntaxChecked=false, tlcChecked=false, invariantsHold=false, converged=false），无法确认零死锁/零不变式违反。P2——REQ-005/008/009/013 系统测试仅间接覆盖；graph.json 存在 REQ-000↔子节点双向 produces 冗余边。

### 1.2 跨阶段 evidence 一致性

已对照阶段 1 verifier-output-phase1.json 的 evidence，无矛盾：
- 阶段 1「21 条需求全部登记」→ 阶段 2 图谱仍含 21 REQ（13 功能 + 5 NFR + 3 CON），新增 6 SD，未删改需求节点 ✓
- 阶段 1「REQ-012 状态机已补登 scheduled_publish 第 6 状态」→ 阶段 2 L2_content_management.tla ArticleState 含 6 态含 scheduled_publish ✓
- 阶段 1「graph.json 24 节点 83 边」→ 阶段 2 演化为 30 节点 148 边（新增 6 SD + 对应边），属阶段 2 正常增长 ✓
- 阶段 1「L1 TLA+ SANY+TLC 双通过（973 states）」→ 阶段 2 tla-manifest L1 仍为 syntaxChecked=true, tlcChecked=true ✓

## 2. 子标准评分

| 子标准 | 权重 | 分数 | 方差 | 评级 |
|---|---|---|---|---|
| architecture-soundness | 0.25 | 0.8900 | 0.000067 | 优 |
| requirement-coverage | 0.25 | 0.8700 | 0.000067 | 优 |
| interface-consistency | 0.20 | 0.7200 | 0.000267 | 中 |
| feasibility | 0.15 | 0.7500 | 0.000067 | 中 |
| testability | 0.15 | 0.8500 | 0.000067 | 优 |
| **综合** | **1.00** | **0.8240** | — | **B** |

> 评分方法：text-parse（A/B/C/D 字母 + ±0.05 稳定扰动）。rawScores 见 verifier-output-phase2.json。

## 3. 问题清单（按优先级）

### P0 阻断项（必须修复方可放行）

#### P0-1：6 份 L2 TLA+ 规范未通过语法检查与 TLC 模型校验

- **违反约束**：硬约束「TLA+ models must pass tool syntax check and TLC check; no deadlocks, state explosions, invariant violations, or implementation errors allowed」
- **证据**：`.w-model/tla-manifest.json` 第 54~58、80~84、104~108、130~134、156~160、184~188 行——6 份 L2 规格（L2_identity_access / L2_content_management / L2_interaction / L2_operations_support / L2_discovery / L2_infrastructure）均标记 `syntaxChecked: false`、`tlcChecked: false`、`invariantsHold: false`、`deadlockFree: false`、`converged: false`。checkRounds 第 204~255 行全部 `converged: false`。
- **影响**：无法确认 L2 规范无死锁、无不变式违反、无状态爆炸。TLA+ 规范作为状态机验证器的基础作用未生效，后续阶段 5~8 的 code-TLA 一致性回归缺乏可信基准。
- **修复建议**：
  1. 删除 states/ 目录与 trace 文件（tla-plus-guide.md 预检清单要求）
  2. 对 6 份 L2 .tla 逐一执行 `java -jar tla2tools.jar <spec>.tla`（SANY 语法检查）
  3. 对 6 份 .cfg 逐一执行 `java -jar tla2tools.jar <spec>.cfg`（TLC 模型校验）
  4. 更新 tla-manifest.json：将 syntaxChecked/tlcChecked/deadlockFree/invariantsHold 标记为 true，checkRounds converged=true
  5. 若发现违反，修正 .tla 或 .cfg 后重跑，直至零违反

---

### P1 重要项（建议修复）

> 本阶段无 P1 项。GAP-010/011/012 已在 system-design.md §9 阶段 1 决策落实表（第 825~827 行）中落实，仅测试设计覆盖表未追溯，降级为 P2。

---

### P2 建议项（非阻断，可后续优化）

#### P2-1：system-test-design.md 决策验证覆盖表遗漏 GAP-010/011/012

- **证据**：`docs/system-test-design.md` 第 386~399 行「阶段 1 决策验证覆盖」表仅列 GAP-001~009，未含 GAP-010（搜索历史 50 条/用户 FIFO）、GAP-011（推荐位 ≤20）、GAP-012（广告 ≤100 次/用户/日）。此三项已在 `docs/system-design.md:825-827` 落实表中登记，但测试设计未追溯对应验证用例。
- **建议**：在 system-test-design.md 决策验证覆盖表补登 GAP-010→TC-DES-008（搜索 P95）/GAP-011→TC-DES-010（推荐位）/GAP-012→TC-DES-005（间接）。

#### P2-2：graph.json 存在 REQ-000↔子节点双向 produces 冗余边

- **证据**：`.w-model/ingestion/graph.json` 第 321~341 行有 21 条 `REQ-000→REQ-001~CON-003` produces 边，第 343~363 行又有 21 条 `REQ-001~CON-003→REQ-000` 反向 produces 边。parent 边已表达层级关系，双向 produces 语义冗余且增加图谱噪声。
- **建议**：保留单向 `REQ-000→子节点` produces（表示系统根产出需求），删除反向 `子节点→REQ-000` produces，减少 21 条冗余边。

#### P2-3：system-design.md §1.1 节点计数与实际图谱不一致

- **证据**：`docs/system-design.md:113` 标注「24 节点」，但 graph.json 实际含 30 节点（24 phase-1 + 6 SD）。该计数未随阶段 2 SD 节点新增而更新。
- **建议**：更新为「30 节点（REQ-000 根 + 21 REQ + EXT-IN-001 + EXT-OUT-001 + 6 SD）」。

#### P2-4：REQ-005/008/009/013 系统测试仅间接覆盖

- **证据**：`docs/system-test-design.md:352-360` 覆盖说明中，REQ-005（广告）、REQ-008（标签）、REQ-009（分类）、REQ-013（交叉引用）均标注「部分覆盖（间接）」，缺独立系统级直接测试用例。
- **建议**：阶段 7 系统测试执行前，为上述 4 条需求各补充 ≥1 条直接系统测试用例（如广告投放时间范围校验、标签云排序、分类树环检测、交叉引用双向一致性）。

#### P2-5：SD→SD 同时存在 produces 与 depends-on 边，语义重叠

- **证据**：graph.json 第 396~402 行 SD 间 depends-on 边（如 SD-002→SD-001 depends-on）与第 411~418 行 SD 间 produces 边（如 SD-001→SD-002 produces）并存。depends-on 已表达依赖方向，produces 语义重叠。
- **建议**：SD 间保留 depends-on 表达依赖，produces 边仅保留 SD→EXT-OUT-001（输出到外部汇），删除 SD→SD produces 减少冗余。

## 4. 五维度评审详情

### 维度 1：系统设计完整性（architecture-soundness, 0.25, score=0.89）

| 检查项 | 结果 | 证据 |
|---|---|---|
| C4 架构图（分层+组件+数据流） | ✅ | system-design.md §1.1 Mermaid 图：EXT-IN→Controller→Service→Store→EXT-OUT 闭环 + SD-006 governs 虚线 |
| 技术选型决策矩阵（5 维度） | ✅ | system-design.md §2.1~§2.3：存储（内存Map+WAL 4.80分）、邮件（nodemailer 4.45分）、测试框架（vitest）均有候选清单+总分+选型理由 |
| 模块划分（6 子系统） | ✅ | SD-001~006 职责清晰，SD-006 governance=true 统辖 SD-001~005，无循环依赖（TC-DES-001 步骤 5 madge 检测） |
| 部署架构 | ✅ | system-design.md §4.1：单实例 Node.js 20+，WAL 文件 + 审计日志独立存储 |
| 数据模型（12 实体） | ✅ | system-design.md §5.1：User/Blogger/Article/Comment/Notification/Tag/Category/Ad/AdSlot/SiteConfig/Stats/SearchHistory 等 12 实体含字段定义 |
| RBAC 权限矩阵（4 角色） | ✅ | system-design.md §6：user/blogger/admin/super_admin × 资源 × 操作矩阵 |
| 文章状态机（6 态） | ✅ | system-design.md §7.2：draft→pending_review→scheduled_publish→published→taken_down→archived + 14 合法转换 + 7 非法转换 |

**扣分点**：graph.json 双向 produces 冗余边（P2-2）；节点计数文档不一致（P2-3）。

### 维度 2：系统测试设计覆盖（testability + requirement-coverage, score=0.85/0.87）

| 检查项 | 结果 | 证据 |
|---|---|---|
| TC-DES-001 架构设计验证 | ✅ | system-test-design.md:24-55：7 步验证（目录结构/分层/6 子系统/governance/循环依赖/数据流/strict 编译） |
| TC-DES-005 系统测试用例生成 | ✅ | system-test-design.md:58-86：13 REQ × 6 SD 覆盖矩阵 |
| TC-DES-007 端到端流程 | ✅ | system-test-design.md:89-129：15 步（注册→登录→发文→审核→评论→通知→已读→WAL→审计→崩溃恢复） |
| TC-DES-008 性能基线 | ✅ | system-test-design.md:132-167：P95≤200ms（通用）/≤500ms（搜索）、100 QPS 10min、错误率≤0.1%、内存≤512MB |
| TC-DES-009 安全基线 | ✅ | system-test-design.md:171-210：16 步（原型链污染×2/RBAC 越权×3/JWT 篡改×4/zod 校验×5/bcrypt/审计日志） |
| 跨子系统集成场景 | ✅ | TC-DES-010（发文→统计→推荐流）、TC-DES-011（评论→通知→热度→搜索）、TC-DES-012（崩溃恢复 WAL 重放） |
| 功能点覆盖 13/13 | ✅ | system-test-design.md:346-362：13 功能需求全覆盖（8 直接 + 5 间接 UAT 补充） |
| 子系统覆盖 6/6 | ✅ | system-test-design.md:366-374：SD-001~006 均有用例 |
| NFR 覆盖 5/5 | ✅ | system-test-design.md:378-384：NFR-001~005 均覆盖 |

**扣分点**：4 条 REQ 仅间接覆盖（P2-4）；GAP-010~012 未在测试覆盖表追溯（P2-1）。

### 维度 3：L2 TLA+ 规格合规性（interface-consistency + feasibility, score=0.72/0.75）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 文件头 8 个 @ 字段完整 | ✅ | 6 份 L2 .tla 均含 @system/@requirement/@design/@parent/@sibling/@child/@level/@phase（如 L2_identity_access.tla:1-10） |
| MODULE 名合规（无连字符） | ✅ | L2_identity_access / L2_content_management / L2_interaction / L2_operations_support / L2_discovery / L2_infrastructure 均用下划线 |
| BusinessInvariant 聚合 | ✅ | 6 份 .tla 均有 BusinessInvariant == /\ TypeInvariant /\ ... 聚合（如 L2_infrastructure.tla:164-169） |
| .cfg INVARIANTS 与 .tla BusinessInvariant 一致 | ✅ | 逐一核对：L2_identity_access.cfg（5 不变式匹配）、L2_content_management.cfg（5 匹配）、L2_interaction.cfg（5 匹配）、L2_operations_support.cfg（5 匹配）、L2_discovery.cfg（4 匹配）、L2_infrastructure.cfg（5 匹配） |
| .cfg 无 MODULE 声明 | ✅ | 6 份 .cfg 均以 `SPECIFICATION Spec` 开头，无 MODULE 行 |
| variableCombination <1000 | ✅ | 768/126/900/384/256/192 均 <1000，decompositionDecision=kept-below-threshold |
| L2 覆盖 6 SD | ✅ | tla-manifest 6 份 L2 分别对应 SD-001~006，requirementIds 覆盖对应 REQ |
| **SANY 语法检查通过** | ❌ | tla-manifest 全部 syntaxChecked=false（P0-1） |
| **TLC 模型校验通过** | ❌ | tla-manifest 全部 tlcChecked=false, invariantsHold=false, deadlockFree=false（P0-1） |

**扣分点**：6 份 L2 规范均未通过语法检查与 TLC 校验（P0-1），导致无法确认零死锁/零不变式违反/零状态爆炸。

### 维度 4：图谱与 RTM 一致性（architecture-soundness + interface-consistency）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 单根 REQ-000 | ✅ | graph.json rootId="REQ-000"，所有节点经 parent 边可达 |
| 6 SD 经 parent 边挂接 | ✅ | graph.json:367-372：REQ-000→SD-001~006 parent 边 |
| SD implements 边覆盖全部 REQ | ✅ | graph.json:374-394：20 条 implements 边，SD-001~006 实现全部 21 REQ（13 功能+5 NFR+3 CON） |
| SD-006 governance + governs 边 | ✅ | graph.json:258 governance=true；404-408 五条 governs 边至 SD-001~005 |
| EXT-IN/EXT-OUT 边界节点存在 | ✅ | EXT-IN-001（信息源）、EXT-OUT-001（信息汇）均存在 |
| 无黑洞（out-degree=0 业务节点） | ✅ | 所有 REQ/SD 节点均有出边（parent→子 / implements→REQ / produces→EXT-OUT） |
| 无奇迹（in-degree=0 业务节点） | ✅ | 所有 REQ/SD 节点均有入边（parent from REQ-000 / implements from SD） |
| 无死模块（in=0 且 out=0） | ✅ | 无节点同时入度=0 且出度=0 |
| analysisRounds phase 2 零违反 | ✅ | graph.json:439-446：phase 2 round 1 violations=[], converged=true |

**扣分点**：双向 produces 冗余边（P2-2）；SD→SD produces 与 depends-on 语义重叠（P2-5）。

### 维度 5：阶段 1 决策落实（requirement-coverage）

| 决策 ID | 落实状态 | 证据 |
|---|---|---|
| CONFLICT-001（邮件通知必需） | ✅ | system-design.md:814 落实表：§2.1.7 选型 nodemailer / §5.1.1 Notification.channel='in_app'/'email'/'both' / notificationSettings.email 开关 |
| CONFLICT-002（WAL vs 审计日志） | ✅ | system-design.md:815 落实表：§1.1 架构图 / §4.1 部署图 wal.store.ts + audit.store.ts 独立 / §4.2 数据流 |
| GAP-001（密码策略） | ✅ | system-design.md:816 落实表：§8.5 / §5.1.1 User.passwordHash，8 字符+1 字母+1 数字，bcrypt cost≥10 |
| GAP-002（推荐等权） | ✅ | system-design.md §8.2：等权 1/3 + 7 天衰减 |
| GAP-003（秒级定时） | ✅ | system-design.md §4.1：setInterval 1s 轮询 |
| GAP-004（JWT 2h+7d） | ✅ | system-test-design.md TC-DES-009 步骤 8/9 验证 |
| GAP-005（敏感词词库） | ✅ | system-test-design.md TC-DES-011 步骤 10 验证 |
| GAP-006（热度公式） | ✅ | system-test-design.md TC-DES-010 步骤 8 验证 |
| GAP-007（nodemailer 允许） | ✅ | system-design.md:184 选型理由 + :200 依赖登记说明 |
| GAP-008（评论嵌套≤3 级） | ✅ | system-test-design.md TC-DES-011 步骤 9 验证 MAX_DEPTH_EXCEEDED |
| GAP-009（操作日志 90 天） | ✅ | system-test-design.md TC-DES-012 步骤 12 验证 |
| GAP-010（搜索历史 50 条） | ✅ | system-design.md:825 落实表：§5.1.12 SearchHistory.queries FIFO ≤50 |
| GAP-011（推荐位≤20） | ✅ | system-design.md:826 落实表：§5.1.11 RecommendSlot.maxCount ≤20 |
| GAP-012（广告≤100 次/用户/日） | ✅ | system-design.md:827 落实表：§5.1.8 Ad.maxImpressionsPerUserPerDay ≤100 |
| REQ-012 六态状态机 | ✅ | L2_content_management.tla:43-65 ArticleState 含 6 态 + ValidTransitions 14 合法转换 |

**结论**：阶段 1 全部 2 冲突 + 12 缺失项 + REQ-012 状态机均已在 system-design.md §9 落实表登记并对应设计章节。

## 5. 放行建议

### 5.1 当前状态：❌ 未通过（P0 阻断）

阶段 2 产物整体设计质量良好（综合 0.824，B 级），但存在 1 项 P0 阻断项：

- **P0-1**：6 份 L2 TLA+ 规范未通过 SANY 语法检查与 TLC 模型校验，违反硬约束。

### 5.2 放行条件（满足后可放行进入阶段 3）

1. 对 6 份 L2 TLA+ 规范执行 SANY 语法检查（`java -jar tla2tools.jar <spec>.tla`），全部退出码 0。
2. 对 6 份 .cfg 执行 TLC 模型校验（`java -jar tla2tools.jar <spec>.cfg`），确认零死锁、零不变式违反、零状态爆炸。
3. 更新 tla-manifest.json：6 份 L2 的 syntaxChecked/tlcChecked/deadlockFree/invariantsHold 标记为 true，checkRounds converged=true。
4. 若发现违反，修正 .tla 或 .cfg 后重跑直至零违反。

### 5.3 P2 建议项（非阻断，可在阶段 3 前或并行处理）

- P2-1：补登 GAP-010/011/012 至测试覆盖表
- P2-2：清理 graph.json 双向 produces 冗余边
- P2-3：更新 system-design.md 节点计数
- P2-4：补充 REQ-005/008/009/013 直接系统测试用例
- P2-5：清理 SD→SD produces 与 depends-on 语义重叠

## 6. 评审自检

- [x] 按 verifier-spec.md §7.2 design 子标准逐项打分（5 子标准，权重和=1.00）
- [x] rawScores 3 次独立扰动评分，非全同，max-min ∈ [0.01, 0.10]
- [x] variance 由总体方差公式从 rawScores 计算
- [x] evidence 引用含路径+行号（如 tla-manifest.json:54-58、system-design.md:814-827）
- [x] summary 含阶段 digest 三要素（关键决策/产物结构/遗留风险）
- [x] 已对照阶段 1 evidence，无跨阶段矛盾
- [x] 严格评审，发现真实问题（1 P0 + 5 P2），未放行 P0
