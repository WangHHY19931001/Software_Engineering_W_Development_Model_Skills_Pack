# 阶段 4：详细设计（同步单元测试设计）

> W 模型左 V 第 4 阶段。对应右 V 测试设计：**单元测试设计**。
> 命令入口：`/wm design type=详细`

## 功能描述

基于概要设计进行类 / 方法级设计，并**同步设计单元测试用例**。详细设计子模块产出类图、数据库设计、方法级定义。

## 输入

- 《接口设计文档》（阶段 3 产出）
- 技术栈要求

## 输出

- 《详细设计文档》（套用 [templates/detailed-design.md](../templates/detailed-design.md)）
  - 类图（符合 UML 规范）
  - 数据库设计（ER 图、表结构、索引设计）
  - 方法级定义（签名、职责、前置 / 后置条件）
- 单元测试用例设计文档（套用 [templates/test-case.md](../templates/test-case.md)，类型=单元测试）

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

## 并行任务（强制）

类 / 方法级设计产出后，**立即**同步生成单元测试用例，覆盖核心逻辑与边界条件。单元测试用例将在阶段 5（编码）中实现为可执行测试代码。

### L4 BDD features 设计（与 TLA+ L4 spec 并行）

S-bdd 子代理在 S-doc 产出详细设计后：
1. 套用 [`templates/feature.template`](../templates/feature.template) 产出 L4 features（每个 DD ≥1 个 .feature 文件，parent 指向 L3）
2. 在 Background 节声明 L4 状态机七要素
3. 更新 `.w-model/bdd-manifest.json`（追加 features + stateMachines）
4. 在 RTM `unitTest` 列登记 `UT-NNN | BDD-L4-<system>_<subsystem>_<atom>-<num>.feature`

V 子代理评审 features（targetKind=test + [bdd-review-checklist.md](bdd-review-checklist.md)）。
G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=4` 校验 D1-D7。

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

## 返工路径

阶段门评审不通过时，按以下路径返工：

- 方法签名缺前置 / 后置条件 → 回到方法级定义，补全前置 + 后置 + 异常
- 单元测试用例无断言 → 回到并行任务，补全 `expect()` 或等价断言，禁止 `// TODO: assert` 占位
- 边界条件未覆盖 → 回到并行任务，按边界必覆盖清单补全（空 / null / 极值 / 越界 / 类型不符 / 并发竞态）
- ER 图缺索引设计 → 回到数据库设计，补全字段 + 索引 + 关系
- 覆盖率评估无阈值 → 回到测试用例生成算法，给出分支覆盖 ≥ 80% 目标
- 单元测试依赖外部服务 → 回到并行任务，补全 mock / stub 隔离方案

## 退出状态

项目 `status` 更新为 `编码`。
