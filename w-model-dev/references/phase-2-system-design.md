# 阶段 2：系统设计（同步系统测试设计）

> W 模型左 V 第 2 阶段。对应右 V 测试设计：**系统测试设计**。
> 命令入口：`/wm design type=架构`

## 功能描述

基于《需求规格说明书》进行系统架构设计，并**同步设计系统测试用例**。系统设计子模块产出系统架构图、技术选型建议、模块划分方案。

## 系统设计算法

  1. 系统架构建模
     ├─ 基于需求规格，产出 docs/phase2-design/{module}-system-architecture.md（顶层组件图 + 子系统清单 + 系统树）
     ├─ 主模板 §1 引用块指向 system-architecture.md
     ├─ 失败: 架构图无数据流标注 → 补全组件间数据流向（FM-SD-01）
     └─ 成功: 子系统清单与模块划分候选对应
  2. 技术选型与 ADR
     ├─ 按技术选型决策矩阵 5 维度评分（适用性/成熟度/可维护性/引入成本/风险敞口）
     ├─ 架构决策记录 ADR 写入 system-architecture.md §5
     ├─ 失败: 选型无评分依据 / ADR 无上下文-后果 → 回步骤 2（FM-SD-02）
     └─ 成功: 选型理由成立，主模板 §2 技术选型表填实
  3. 模块划分与部署架构
     ├─ 基于子系统清单，产出主模板 §3 模块划分表（模块 ID 与子系统清单对应）
     ├─ 产出主模板 §4 部署架构
     ├─ 失败: 模块循环依赖 → 列出环路径重新划分（FM-SD-03）；子系统清单与模块划分不对应 → 回步骤 1
     └─ 成功: 模块划分无环且与子系统清单一致
  4. 系统上下文与术语建模
     ├─ 承接 phase1 system-context.md 外部边界，产出 docs/phase2-design/{module}-glossary.md（系统设计域术语子集）
     ├─ 主模板 §6 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. UML 系统级建模
     ├─ 产出 docs/phase2-design/{module}-uml-modeling.md（部署图/顶层组件图/包图/用例图）
     ├─ 主模板附录 A 引用块指向 uml-modeling.md
     ├─ 失败: 图与主模板 §1/§3 不对应 → 回步骤 5 对齐（FM-SD-04）
     └─ 成功: 四图产出，mermaid 块配平
  6. 追踪矩阵与行为规格引用
     ├─ 产出 docs/phase2-design/{module}-traceability-matrix.md（SD×需求 8 字段 + 测试层级矩阵）
     ├─ 产出 docs/phase2-design/{module}-behavior-spec.md（L2 .feature 引用关系）
     ├─ 主模板 §7/§8 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/3 不一致 → 回步骤 6 对齐（FM-SD-05）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  7. Phase 2 工程纪律与 DoD
     ├─ 产出 docs/phase2-design/{module}-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §9 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立

## 输入

- 《需求规格说明书》（阶段 1 产出）
- 技术约束与偏好（若已确认技术栈则直接采用）

## 输出

- 《系统设计文档》（套用 [templates/system-design.md](../templates/system-design.md)）
  - 系统架构图
  - 技术选型建议
  - 模块划分方案
- 系统测试用例设计文档（套用 [templates/test-case.md](../templates/test-case.md)，类型=系统测试）
- 独立产物文件：
  - `{module}-system-architecture.md`：系统架构（组件图/子系统清单/系统树/架构原则/ADR/行为总览/运行时架构）
  - `{module}-glossary.md`：术语表（系统设计域子集）
  - `{module}-traceability-matrix.md`：系统设计追踪矩阵（SD×需求 8 字段 + 测试层级矩阵）
  - `{module}-behavior-spec.md`：行为规格模型（L2 .feature 引用关系）
  - `{module}-discipline-dod.md`：工程纪律与 DoD 可勾选清单
  - `{module}-uml-modeling.md`：UML 系统级建模（部署图/组件图/包图/用例图）

> 路径约定见 [directory-conventions.md](directory-conventions.md)。

## AI 能力应用

- **架构设计建议生成**：依据需求规模与质量属性给出分层 / 微服务等架构建议
- **UML 图自动生成**：组件图、部署图
- **技术选型**：前端 / 后端 / 数据库 / 缓存 / 中间件
- **测试用例设计**：覆盖系统级功能与质量属性场景

## 执行方法论

> 本节规定产出物的工具级落地方式，确保产出可复现、可追溯、可审计。

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 系统设计文档 | 套用 `templates/system-design.md` 模板，含架构图 / 技术选型 / 模块划分 | `docs/phase2-design/{module}-system-design.md` |
| 系统测试用例 | 套用 `templates/test-case.md` 模板，`type=系统测试`，必须含 TC-DES-008/009 | `docs/phase2-design/{module}-system-test.md` |
| 系统架构 | 套用 `templates/system-design/system-architecture.md` | `docs/phase2-design/{module}-system-architecture.md` |
| 术语表 | 套用 `templates/system-design/glossary.md` | `docs/phase2-design/{module}-glossary.md` |
| UML 系统级建模 | 套用 `templates/system-design/uml-modeling.md`，mermaid 四图 | `docs/phase2-design/{module}-uml-modeling.md` |
| 系统设计追踪矩阵 | 套用 `templates/system-design/traceability-matrix.md` | `docs/phase2-design/{module}-traceability-matrix.md` |
| 行为规格模型（L2） | 套用 `templates/system-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase2-design/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/system-design/discipline-dod.md` | `docs/phase2-design/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/system-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase2-design/{module}-system-design.md` |
| 架构图 | 用 Mermaid / PlantUML 语法产出 C4 组件图 + 部署图（嵌入系统设计文档） | 内嵌于 `docs/phase2-design/{module}-system-design.md` |

**架构图语法约束**：C4 组件图须体现分层 + 组件间依赖；部署图须体现节点 + 进程 + 数据流。禁止以纯文字描述替代图形产出。

## 技术选型决策矩阵

每个候选技术按 5 维度评分（1=差 / 5=优），加权汇总后取最高分；并列时按「可维护性 > 成熟度 > 适用性」破局。

| 维度 | 评分依据 | 权衡问题（评分前必答） |
|---|---|---|
| 适用性 | 与需求场景匹配度 | 是否覆盖核心 QAR（性能/安全/可用）？有无功能缺口？ |
| 成熟度 | 社区活跃度 / 生产案例 | 是否有 ≥3 个生产案例？最近 6 个月是否有 commit/release？ |
| 可维护性 | 文档质量 / 调试成本 | 团队是否能在 1 周内独立运维？是否有 LTS 版本？ |
| 引入成本 | 学习曲线 / 依赖体积 | 是否引入新运行时？是否与现有 CI 兼容？ |
| 风险敞口 | 替换难度 / 锁定程度 | 若 1 年后替换，重写工作量有多大？ |

输出格式：候选清单 + 每项 5 维度评分 + 总分 + 一句话选型理由。无评分依据的选型一律返工。

### 架构决策框架

技术选型评分时，以下第一性原则作为 5 维度评分的约束输入（写入 ADR 的「上下文」节）：

**CAP 与一致性谱系**（transaction/distributed）：三选一——放弃 P 假设通信永远可靠（现实中不成立）；放弃 A 分区时离线（CP 如 HBase）；主流选 AP（分区可用）。强一致/弱一致/最终一致是谱系不是离散点；ACID 刚性事务 vs 可靠事件队列/TCC/SAGA 柔性事务按场景取舍（无包治百病方案，因地制宜）。

**微服务粒度判定**（methodology/forward-msa/granularity）：
- 下界：独立（可独立发布/部署/运行/测试）+ 内聚（强相关功能与数据同服务）+ 完备（至少一项业务实体与完整操作）。
- 上界：2 Pizza Team 一个研发周期内能完成的全部需求。
- 过细三反噬：进程内 vs 网络调用数量级差距（性能）、强一致数据须聚合（一致性）、双向依赖须合并（可用性）。

**微服务前提四问**（prerequest）：① 决策者与执行者认知康威定律？② 组织内有技术专家？③ 具备自治型自动化与监控？④ 复杂性已成为制约生产力的主要矛盾？任一不满足 → 不选微服务（"能分布式 ≠ 应该分布式"）。

**分布式事务模式选择**（transaction/distributed）：可靠事件队列（本地事务+消息表+幂等+最大努力交付）/ TCC（Try 冻结资源，业务侵入强，不适用第三方资源）/ SAGA（补偿代回滚，T/C 须幂等+交换律）/ AT（全局锁防脏写）。决策矩阵须显式声明所选模式与失败路径。

## 边界条件与异常处理

| 异常场景 | 检测 / 触发条件 | Fallback 路径 |
|---|---|---|
| Mermaid 语法错误（C4 图渲染失败） | `npx -y @mermaid-js/mermaid-cli -i <file> -o /tmp/check.svg` 退出码 ≠ 0 | 降级为 ASCII 框图（用 `+---+` / `-->` 手绘），并在文档头部标注「Mermaid 渲染失败，已降级 ASCII」 |
| 技术选型冲突（用户偏好与最佳实践冲突） | 决策矩阵评分差距 ≥3 分且用户偏好得分较低 | 列出冲突点 + 评分依据 + 风险，请用户显式「接受风险」或「采纳建议」，记录到 `decisions/` |
| 模块循环依赖 | `npx -y madge --circular --extensions ts,js <module-root>` 或 `npx -y dependency-cruiser -c .dependency-cruiser.cjs <src>` 退出码 ≠ 0 | 列出环路径，回到模块划分重新拆分（引入接口层 / 倒置依赖），禁止带环放行 |
| C4 组件图缺数据流标注 | 图中无 `-.->` 或 `>>` 数据流箭头 | 回到架构图生成，补全组件间数据流向（输入/输出/同步异步） |
| 强一致数据被拆到多服务 | 跨服务强一致操作（原可单库事务） | 聚合数据到单一服务，或显式采用柔性事务（TCC/SAGA）并登记失败路径 |
| 分区/网络异常下的可用性声明 | 系统无分区处理策略 | 按 CAP 三选一显式声明取舍（AP/CP），写入 ADR |

执行顺序：先跑检测命令（以退出码为准），再触发 fallback；fallback 后必须重新检测，确保闭环。

## 失败模式矩阵

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-SD-01 | 架构图缺数据流标注 | system-architecture.md 组件图无 `-.->`/`>>` 数据流箭头 | 回步骤 1 补全数据流向 |
| FM-SD-02 | 选型无评分依据 / ADR 缺上下文后果 | 技术选型表无 5 维度评分；ADR 缺 context/consequences | 回步骤 2 补全评分与 ADR 结构 |
| FM-SD-03 | 模块循环依赖 | 模块划分 DFS 三色染色检测到环 | 回步骤 3 重新划分边界 |
| FM-SD-04 | UML 建模与架构/模块划分脱节 | uml-modeling.md 图与主模板 §1/§3 不对应 | 回步骤 5 对齐 UML 建模 |
| FM-SD-05 | 追踪矩阵字段不一致 | traceability-matrix.md 与主模板 §3/phase1 追踪矩阵不一致 | 回步骤 6 对齐追踪矩阵字段 |

> 注：FM-SD-06（越过阶段边界落接口/类级）为越界检测信号，见禁止行为 #8 与返工路径，不单列于上表。

## 测试用例设计（本阶段产出系统测试用例）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-DES-001 | 系统架构设计 | 需求规格说明书 | 完整架构图、技术选型、模块划分 | 高 |
| TC-DES-005 | 系统测试用例生成 | 系统设计文档 | 覆盖系统级功能的测试用例 | 高 |
| TC-DES-007 | 端到端流程（设计） | 核心业务流程描述 | 至少 1 条端到端用例（覆盖注册→登录→下单→支付全链路） | 高 |
| TC-DES-008 | 性能基线（设计） | 预期用户量 / QPS | 性能基线用例（P95 < 2s，100 QPS 持续 10min） | 高 |
| TC-DES-009 | 安全基线（设计） | OWASP Top 10 | 安全基线用例（SQL注入/XSS/CSRF 防御验证） | 高 |

## 测试 seam 决策

> 吸收 to-spec seam-first testing 方法论。系统级 seam 决策服务于阶段 7 系统测试设计，与现有「系统测试设计」节互补：seam 决策是「在哪测」，系统测试设计是「测什么」。

**模板**：

```markdown
## 测试 seam 决策

### 候选 seam 列表
- <seam-1>: <描述> — <钩住点（HTTP / CLI / 模块导出 / 进程边界）>
- <seam-2>: ...

### 选定 seam
- 系统测试主 seam: <seam-id>（最高 seam，理由：<覆盖最广/最稳定/最少新 seam>）
- 系统测试辅 seam: <seam-id 或 无>（仅当主 seam 无法覆盖某场景）

### 理由
- 为什么主 seam 是最高 seam
- 为什么现有 seam 优于新建 seam
- 新建 seam 的代价与收益（如有新建）
```

**规则**：
- "最高 seam"在系统层 = HTTP API / CLI / 进程边界（外部可观测点）
- 禁止为了"覆盖率"在系统层引入新 seam（违反 to-spec「fewer seams better」原则）
- 阶段 3 必须显式引用阶段 2 选定 seam（"复用阶段 2 seam 的部分"非空，或显式声明"无复用，理由"）

## 并行任务（强制）

架构设计产出后，**立即**同步生成系统测试用例，覆盖各模块集成场景与系统级功能（端到端流程、性能基线、安全基线）。系统测试用例将在阶段 7（系统测试）执行，本阶段只做设计。

### L2 BDD features 设计（与 TLA+ L2 spec 并行）

S-bdd 子代理在 S-doc 产出系统设计后：
1. 套用 [`templates/feature.template`](../templates/feature.template) 产出 L2 features（每个 SD ≥1 个 .feature 文件，parent 指向 L1）
2. 在 Background 节声明 L2 状态机七要素
3. 更新 `.w-model/bdd-manifest.json`（追加 features + stateMachines）
4. 在 RTM `systemTest` 列登记 `ST-NNN | BDD-L2-<system>_<subsystem>-<num>.feature`

V 子代理评审 features（targetKind=test + [bdd-review-checklist.md](bdd-review-checklist.md)）。
G 子代理跑 [`check-bdd-model.ts`](../scripts/cli/check-bdd-model.ts) `--phase=2` 校验 D1-D8。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中补登：设计文档列（系统设计）、系统测试列。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

## ingestion 子流程（S→A 路径，阶段 2）

阶段 2 的 S 子代理先产出 system-design.md，再由 A-evolve 从中提取 SD 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=2` 校验连通 + 单根 + SD_without_implements=0。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。

## 验收标准

- [ ] 架构设计已按「技术选型决策矩阵」5 维度评分（含候选清单 + 总分 + 选型理由）
- [ ] 系统架构图、模块划分清晰
- [ ] 系统测试用例覆盖关键系统级路径
- [ ] RTM 已补登设计文档与系统测试映射
- [ ] {module}-system-architecture.md + {module}-glossary.md 已产出，主模板 §1/§6 引用块成立
- [ ] {module}-traceability-matrix.md（SD×需求 + 测试层级矩阵）与主模板 §3/phase1 矩阵一致，主模板 §7 引用块成立
- [ ] {module}-uml-modeling.md 四图与主模板 §1/§3 对应、mermaid 块配平，主模板附录 A 引用块成立
- [ ] {module}-behavior-spec.md + {module}-discipline-dod.md 已产出，主模板 §8/§9 引用块成立

> 🔴 **CHECKPOINT · 阶段门放行**：系统设计 + 系统测试用例产出后暂停。Agent 必须向用户展示「架构图 / 技术选型 / 模块划分 / 系统测试用例（含端到端 + 性能基线 + 安全基线）/ RTM 补登」，由用户确认「放行进入阶段 3」或「返工」。架构图缺失或系统测试用例未含性能/安全基线 → 一律返工。

## 阶段门评审

评审通过 → 进入阶段 3（概要设计）。
评审不通过 → 回到系统设计起点返工（如架构不清晰、测试用例缺失性能/安全基线）。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 把架构图当模块划分图 | 架构图体现分层 + 部署 + 数据流；模块划分图体现职责边界 |
| 2 | 省略性能 / 安全基线用例 | TC-DES-008/009 必须产出，不得只给功能用例 |
| 3 | 只生成单模块功能用例 | 系统测试必须覆盖端到端 + 跨模块集成场景 |
| 4 | 技术选型无原则依据 | 必须按「技术选型决策矩阵」5 维度评分给出选型理由 |
| 5 | 模块划分存在循环依赖 | 必须检测循环依赖，有则重新划分 |
| 6 | 追踪矩阵字段与主模板 §3 模块划分 / phase1 追踪矩阵不一致 | 步骤 6 须对齐 traceability-matrix.md（FM-SD-05） |
| 7 | UML 图表与架构/模块划分脱节 | uml-modeling.md 四图须对应主模板 §1/§3（FM-SD-04） |
| 8 | 越过阶段边界落接口契约/类定义 | 接口/类级设计属阶段 3/4，本阶段只产系统级（FM-SD-06 禁止越界） |

## 返工路径

阶段门评审不通过时，按以下路径返工：

- 架构不清晰 → 回到功能描述，补充分层 / 部署 / 数据流
- 模块划分有循环依赖 → 回到模块划分，重新划分边界
- 系统测试缺性能 / 安全基线 → 回到并行任务，补充 TC-DES-008/009
- 技术选型无原则依据 → 回到技术选型，按「技术选型决策矩阵」5 维度评分补全理由
- 端到端用例缺失 → 回到并行任务，补全 TC-DES-007
- 架构图缺数据流（FM-SD-01）→ 回步骤 1 补全
- 选型无依据（FM-SD-02）→ 回步骤 2 补全评分/ADR
- 循环依赖（FM-SD-03）→ 回步骤 3 重新划分
- UML 脱节（FM-SD-04）→ 回步骤 5 对齐
- 追踪矩阵不一致（FM-SD-05）→ 回步骤 6 对齐
- 越界落接口/类级（FM-SD-06）→ 移除越界内容，移交阶段 3/4

## 退出状态

项目 `status` 更新为 `概要设计`。
