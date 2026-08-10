# 阶段 4：详细设计（同步单元测试设计）

> W 模型左 V 第 4 阶段。对应右 V 测试设计：**单元测试设计**。
> 命令入口：`/wm design type=详细`

## 功能描述

基于概要设计进行类 / 方法级设计，并**同步设计单元测试用例**。详细设计子模块产出类图、数据库设计、方法级定义。

## 详细设计算法

  1. 类设计
     ├─ **备选方案对比（第 41 轮吸收，APoSD ch11）**：每个关键类/接口先产出 ≥2 个差异较大的备选签名草案 + 一行优缺点，写入 class-design.md「方案权衡」列；"聪明人一次做对"是幻觉
     ├─ 基于概要设计接口契约，产出 docs/phase4-detailed/{module}-class-design.md（类图 + 类定义 + 方法级定义 + 类状态机 + 方案权衡）
     ├─ 主文档 §1 引用块指向 class-design.md
     ├─ 失败: 方法定义缺前置/后置/异常 → 回步骤 1（FM-DD-02）
     └─ 成功: 类设计完整，主文档 §1 类定义与之对应
  2. 数据模型设计
     ├─ 产出 docs/phase4-detailed/{module}-data-model.md（ER 图 + 表结构 + 索引 + store 归属）
     ├─ 主文档 §2 引用块指向 data-model.md
     ├─ 失败: 表结构缺索引/关系 / store 归属与 phase3 不一致 → 回步骤 2（FM-DD-03）
     └─ 成功: 数据模型完整，store 归属与 phase3 一致
  3. 装配点与测试 seam 声明
     ├─ 每个设计项声明装配点（中间件链位置等）与测试 seam（HTTP 层/独立实例/白盒）
     ├─ 失败: 装配点空但 seam 为 HTTP 层 → 回步骤 3（FM-DD-05）
     └─ 成功: 装配点与 seam 一致性成立
  4. 术语建模（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-glossary.md（详细设计域术语子集）
     ├─ 主模板 §4 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. 追踪矩阵与行为规格引用（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-traceability-matrix.md（DD×INTF 8 字段 + 测试层级矩阵）
     ├─ 产出 docs/phase4-detailed/{module}-behavior-spec.md（L4 .feature 引用关系）
     ├─ 主模板 §5/§6 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/2 不一致 → 回步骤 5 对齐（FM-DD-04）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  6. Phase 4 工程纪律与 DoD（第 38 轮新增）
     ├─ 产出 docs/phase4-detailed/{module}-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §7 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立

## 输入

- 《接口设计文档》（阶段 3 产出）
- 技术栈要求

## 输出

- 《详细设计文档》（套用 [templates/detailed-design.md](../templates/detailed-design.md)）
  - 类图（符合 UML 规范）
  - 数据库设计（ER 图、表结构、索引设计）
  - 方法级定义（签名、职责、前置 / 后置条件）
- 单元测试用例设计文档（套用 [templates/test-case.md](../templates/test-case.md)，类型=单元测试）
- 独立产物文件（第 38 轮新增，主文档引用块指向，均位于 `docs/phase4-detailed/`，带 `{module}-` 前缀）：
  - `{module}-class-design.md`：类设计（类图 + 类定义 + 方法级定义 + 类状态机 + 方案权衡）
  - `{module}-data-model.md`：数据模型（ER 图 + 表结构 + 索引 + store 归属）
  - `{module}-glossary.md`：术语表（详细设计域子集）
  - `{module}-traceability-matrix.md`：详细设计追踪矩阵（DD×INTF 8 字段 + 测试层级矩阵）
  - `{module}-behavior-spec.md`：行为规格模型（L4 .feature 引用关系）
  - `{module}-discipline-dod.md`：工程纪律与 DoD 可勾选清单

> 路径约定见 [directory-conventions.md](directory-conventions.md)。

## AI 能力应用

- **UML 图自动生成**：类图、ER 图
- **数据库设计**：表结构、字段、索引、关系
- **方法签名设计**：输入参数、返回值、异常
- **测试用例设计**：覆盖方法级逻辑与边界条件

## 执行方法论

> 本节规定产出物的工具级落地方式，确保产出可复现、可追溯、可审计。本节与"测试用例生成算法"互补：算法描述逻辑流程，本节规定工具级落地。

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 详细设计文档 | 套用 `templates/detailed-design.md` 模板，含类图 / ER 图 / 方法定义 | `docs/phase4-detailed/{module}-detailed-design.md` |
| 单元测试用例 | 套用 `templates/test-case.md` 模板，`type=单元测试`，每个方法 ≥ 1 用例且含 `expect()` 断言 | `docs/phase4-detailed/{module}-unit-test.md` |
| UML 类图 | 用 Mermaid `classDiagram` 语法产出，符合 UML 规范 | 内嵌于 `docs/phase4-detailed/{module}-detailed-design.md` |
| ER 图 | 用 Mermaid `erDiagram` 语法产出，含表结构 + 字段 + 索引 + 关系 | 内嵌于 `docs/phase4-detailed/{module}-detailed-design.md` |
| 类设计 | 套用 `templates/detailed-design/class-design.md` | `docs/phase4-detailed/{module}-class-design.md` |
| 数据模型 | 套用 `templates/detailed-design/data-model.md` | `docs/phase4-detailed/{module}-data-model.md` |
| 术语表 | 套用 `templates/detailed-design/glossary.md` | `docs/phase4-detailed/{module}-glossary.md` |
| 详细设计追踪矩阵 | 套用 `templates/detailed-design/traceability-matrix.md` | `docs/phase4-detailed/{module}-traceability-matrix.md` |
| 行为规格模型（L4） | 套用 `templates/detailed-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase4-detailed/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/detailed-design/discipline-dod.md` | `docs/phase4-detailed/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/detailed-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase4-detailed/{module}-detailed-design.md` |

**图形语法约束**：类图须体现继承 / 关联 / 依赖关系；ER 图须含主键 / 外键 + 索引标注。禁止以纯文字描述替代图形产出。

## 测试用例设计（本阶段产出单元测试用例）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-DES-002 | 类图生成 | 详细需求描述 | 符合 UML 规范的类图 | 高 |
| TC-DES-003 | 数据库设计 | 数据需求 | ER 图、表结构定义、索引设计 | 高 |

## 测试 seam 决策（第 10 轮外部技能吸收）

> 吸收 to-spec seam-first testing 方法论。原子单元级 seam 决策服务于阶段 5 单元测试设计（同步产物），与现有「测试用例生成算法」互补。

**模板**：

```markdown
## 测试 seam 决策

### 单元测试 seam
- <DD-1>: seam = <函数签名 / 类公共方法>
- <DD-2>: ...

### 选定 seam
- 单元测试主 seam: <seam-id>（绝大多数情况下复用代码公共 API）
- 不复用阶段 2/3 seam 的部分: <列表或 无>

### 理由
- 为什么单元测试不引入新 seam（理想：代码公共 API 即 seam）
- 例外情况（如需测试内部状态机的私有转移）：如何最小化 seam 引入
```

**规则**：
- "最高 seam"在单元层 = 函数/类的公共 API（to-spec 原则：理想零新 seam）
- 私有状态机/内部转移的测试通过 TLA+ 不变式断言覆盖（与约束 9 TLA+ 行为门禁协同），不在代码层引入测试 seam
- 必须显式引用阶段 3 选定 seam

## 类设计规则引用（第 40 轮三源吸收）

详细设计阶段的类划分须遵循 [quality-standards.md](quality-standards.md)「类设计规则」小节：25 词职责测试、SRP/OCP/DIP、类名警报、内聚性。类设计不满足时回改设计再进入编码。

### 信息隐藏检查（第 41 轮四源吸收，APoSD ch5）

每个类设计时回答两个问题，答案记录在 class-design.md 类定义「职责」列旁：
1. **本类封装了什么知识（设计决策）？**
2. **该知识还出现在哪些其他类？** —— 同一设计决策散落多模块 = 信息泄露（最重要的类划分危险信号），后门泄露（多方共享但不在接口）比接口泄露更隐蔽。

修复：合并受影响类，或提取新类封装该知识。

### 下沉复杂性检查（第 41 轮四源吸收，APoSD ch8）

每个暴露的配置参数/异常回答："用户能比我们确定更好的值吗？"
- 不能 → 自动计算 + 合理默认值，不暴露参数（"把难题推给用户 = 偷懒"）。
- 必须暴露 → 提供自动计算默认值，并下沉实现复杂性（接口简单比实现简单更重要）。

### 异常策略三选项（第 41 轮四源吸收，APoSD ch10）

每个方法定义的「异常」列先过此审查（对应 class-design 模板「异常」列提示）：
1. **规避**（首选）：能否通过语义重定义消除异常？（unset→确保变量不存在、substring 越界→截断）；异常是接口一部分，异常多 = 接口浅。
2. **屏蔽**：底层错误由子系统处理（TCP 重传类比），不向上传播。
3. **聚合**：多个底层异常聚合成顶层单处理器（请求级单处理器）。

崩溃是最后手段：仅内存不足等场景，须人工判定、默认不采用（W 模型强调错误处理完备性）。

## 对象/数据结构设计引用（第 40 轮三源吸收）

详细设计阶段的对象/数据结构划分须遵循 [chinese-code-review](../../.cursor/skills/chinese-code-review/SKILL.md)「对象/数据结构与得墨忒耳律」节：遵守得墨忒耳律、数据抽象、避免混合结构、DTO 不塞业务规则。

## 并行任务（强制）

类 / 方法级设计产出后，**立即**同步生成单元测试用例，覆盖核心逻辑与边界条件。单元测试用例将在阶段 5（编码）中实现为可执行测试代码。

### L4 BDD features 设计（与 TLA+ L4 spec 并行）

S-bdd 子代理在 S-doc 产出详细设计后：
1. 套用 [`templates/feature.template`](../templates/feature.template) 产出 L4 features（每个 DD ≥1 个 .feature 文件，parent 指向 L3）
2. 在 Background 节声明 L4 状态机七要素
3. 更新 `.w-model/bdd-manifest.json`（追加 features + stateMachines）
4. 在 RTM `unitTest` 列登记 `UT-NNN | BDD-L4-<system>_<subsystem>_<atom>-<num>.feature`

V 子代理评审 features（targetKind=test + [bdd-review-checklist.md](bdd-review-checklist.md)）。
G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=4` 校验 D1-D8。

## 设计项→装配点→测试 seam 三者一致性（第22轮 P1-5 修正）

每个设计项（如 DD-026 RateLimitMiddleware）须声明：
- **装配点**：中间件链位置（如 `app.use('/api/', rateLimitMiddleware)`）
- **测试 seam**：HTTP 层 / 独立实例 / 白盒

**校验规则**（R3 可靠性审查项）：
- 若装配点为空但测试 seam 为 HTTP 层 → R3 可靠性审查标注 finding
- 设计项须在详细设计文档中显式声明装配点和测试 seam

## 字段命名业务语义对齐（第22轮 P1-4 修正，同步 phase-3）

详细设计文档中的字段命名须与 phase-3 概要设计保持一致。若因技术约束无法对齐，须在「Implementation Decisions」节说明字段映射。

## 测试用例生成算法

```
输入: 需求/设计文档
  1. 分析功能点（每个方法 ≥ 1 用例）
  2. 识别输入输出边界条件（空值/极值/越界/类型不符）
  3. 生成正常场景用例（含明确断言: expect(actual).toBe(expected)）
  4. 生成异常场景用例（抛异常/错误码/边界返回）
  5. 评估测试用例覆盖率（目标: 分支覆盖 ≥ 80%，边界条件必覆盖清单全命中）
输出: 测试用例集合 + 覆盖率预估
```

**断言格式约束**：每个用例必须含 `expect()` 或等价断言，禁止 `// TODO: assert` 占位。
**边界条件必覆盖清单**：空输入、null、极值（MAX/MIN）、越界（±1）、类型不符、并发竞态（若涉及共享状态）。

## 失败模式矩阵（第 38 轮新增）

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-DD-01 | 无断言占位用例 | 单元测试用例无 `expect()` 或等价断言 | 回测试用例生成，补全断言（禁止 // TODO: assert） |
| FM-DD-02 | 方法定义缺前置/后置/异常 | 类方法定义缺前置条件/后置条件/异常任一 | 回步骤 1 补全方法契约 |
| FM-DD-03 | 表结构缺索引/关系 / store 误用 | 表结构缺索引或关系；store 归属与 phase3 不一致 | 回步骤 2 补全表结构或回 phase3 返工 |
| FM-DD-04 | 追踪矩阵字段不一致 | traceability-matrix.md 与主文档 §1/§2/phase3 追踪矩阵不一致 | 回步骤 5 对齐追踪矩阵字段 |
| FM-DD-05 | 装配点与测试 seam 不一致 | 设计项装配点为空但测试 seam 为 HTTP 层 | 回步骤 3 补全装配点或调整 seam |

> 注：FM-DD-06（越过阶段边界回溯重定义接口契约/落编码实现）为越界检测信号，见禁止行为 #9 与返工路径，不单列于上表。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中补登：设计文档列（详细设计）、单元测试列。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

## 跨模块数据源选择约束（同步 phase-3）

> 详细设计文档须列出每个跨模块调用的数据源选择，与 phase-3 接口设计一致。第 16 轮 P3.2 新增。详见 [phase-3-outline-design.md「跨模块数据源选择约束」](phase-3-outline-design.md#跨模块数据源选择约束)。

- 每个跨模块调用须在详细设计中显式声明所用 store（写入类图/方法定义的「依赖」或「数据源」字段）
- store 选择须与 phase-3 接口设计一致（**不得在详细设计阶段变更 store 选择**）
- 如需变更 → 回 phase-3 返工接口设计，再回 phase-4 同步详细设计

**违反后果**：编码阶段按错误 store 实现触发跨模块数据流缺陷（如 P7-002/P7-003 类），回 phase-3 + phase-4 双返工。关联反模式 [#23 跨模块 store 误用](anti-patterns.md)。

## ingestion 子流程（S→A 路径，阶段 4）

阶段 4 的 S 子代理先产出 detailed-design.md，再由 A-evolve 提取 DD 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=4` 校验全部追溯项。

> **阶段 4 硬约束**：`check-requirement-graph.ts --phase=4` 退出码必须为 0（连通 + 单根 + 父唯一 + SD_without_implements=0 + INTF_without_defines=0 + DD_without_realizes=0），否则不放行进阶段 5 编码。阶段 1-3 允许带未解决项强制接受（标注后留后续阶段补），阶段 4 不允许。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。

## 验收标准

- [ ] UML 图符合规范
- [ ] 数据库设计含表结构、字段、索引、关系
- [ ] 方法级定义含签名、职责、前置 / 后置条件
- [ ] 单元测试用例覆盖核心逻辑与边界条件
- [ ] RTM 已补登详细设计与单元测试映射
- [ ] {module}-class-design.md + {module}-data-model.md 已产出，主文档 §1/§2 引用块成立
- [ ] {module}-traceability-matrix.md（DD×INTF + 测试层级矩阵）与主文档 §1/§2/phase3 矩阵一致，主文档 §5 引用块成立
- [ ] {module}-glossary.md + {module}-behavior-spec.md 已产出，主文档 §4/§6 引用块成立
- [ ] {module}-discipline-dod.md 已产出（DoD ≥ 8 项），主文档 §7 引用块成立

> 🔴 **CHECKPOINT · 阶段门放行**：详细设计 + 单元测试用例产出后暂停。Agent 必须向用户展示「类图 / ER 图 / 方法定义（签名+前置后置条件）/ 单元测试用例（含断言格式 + 边界清单）/ RTM 补登」，由用户确认「放行进入阶段 5」或「返工」。单元测试用例存在无断言占位或边界清单未覆盖 → 一律返工。

## 阶段门评审

评审通过 → 进入阶段 5（编码实现）。
评审不通过 → 回到详细设计起点返工（如方法签名不全、测试用例无断言、边界未覆盖）。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 生成无断言的占位用例 | 每个用例必须有 `expect()` 或等价断言 |
| 2 | 只为 happy path 生成用例 | 必须覆盖边界条件必覆盖清单（空/null/极值/越界/类型不符） |
| 3 | 让单元测试依赖外部服务 | 单元测试用例设计时就必须规划 mock/stub 隔离方案 |
| 4 | 方法签名缺前置 / 后置条件 | 每个方法必须定义前置条件 + 后置条件 + 异常 |
| 5 | ER 图缺索引设计 | 表结构必须含字段 + 索引 + 关系 |
| 6 | 覆盖率评估无阈值 | 必须给出分支覆盖 ≥ 80% 目标 + 边界必覆盖清单 |
| 7 | 追踪矩阵字段与主文档 §1/§2 / phase3 追踪矩阵不一致 | 步骤 5 须对齐 traceability-matrix.md（FM-DD-04） |
| 8 | 表结构缺索引/关系 / store 归属与 phase3 不一致 | 步骤 2 须补全表结构与 store 归属（FM-DD-03） |
| 9 | 越过阶段边界回溯重定义接口契约/落编码实现 | 接口契约属阶段 3、编码属阶段 5，本阶段只产类/数据级（FM-DD-06 禁止越界） |

## 返工路径

阶段门评审不通过时，按以下路径返工：

- 方法签名缺前置 / 后置条件 → 回到方法级定义，补全前置 + 后置 + 异常
- 单元测试用例无断言 → 回到并行任务，补全 `expect()` 或等价断言，禁止 `// TODO: assert` 占位
- 边界条件未覆盖 → 回到并行任务，按边界必覆盖清单补全（空 / null / 极值 / 越界 / 类型不符 / 并发竞态）
- ER 图缺索引设计 → 回到数据库设计，补全字段 + 索引 + 关系
- 覆盖率评估无阈值 → 回到测试用例生成算法，给出分支覆盖 ≥ 80% 目标
- 单元测试依赖外部服务 → 回到并行任务，补全 mock / stub 隔离方案
- 无断言占位（FM-DD-01）→ 回测试用例生成补全断言
- 方法契约缺失（FM-DD-02）→ 回步骤 1 补全前置/后置/异常
- 表结构/store 问题（FM-DD-03）→ 回步骤 2 补全或回 phase3 返工
- 追踪矩阵不一致（FM-DD-04）→ 回步骤 5 对齐
- 装配点不一致（FM-DD-05）→ 回步骤 3 补全装配点
- 越界回溯接口/落编码（FM-DD-06）→ 移除越界内容，接口契约移交阶段 3、编码移交阶段 5

## 退出状态

项目 `status` 更新为 `编码`。
