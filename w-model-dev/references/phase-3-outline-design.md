# 阶段 3：概要设计（同步集成测试设计）

> W 模型左 V 第 3 阶段。对应右 V 测试设计：**集成测试设计**。
> 命令入口：`/wm design type=概要`

## 功能描述

基于系统设计进行模块接口设计，定义模块间交互契约，并**同步设计集成测试用例**。概要设计聚焦模块边界与接口，**不深入类 / 方法内部**（类/方法级设计属阶段 4 详细设计职责，越界即返工）。

## 概要设计算法

  1. 接口识别与契约定义
     ├─ **备选方案对比**：每个关键接口先产出 ≥2 个差异较大的备选签名草案 + 一行优缺点（写入 interface-contract.md「备选方案」节）；考虑"什么应可变"（GoF 表 1.2 思想）
     ├─ **接口交集 vs 并集自检**：抽象接口取"所有实现的功能交集"则只强如最弱实现，取"并集"则庞大——明确取舍并记录理由
     ├─ 基于系统设计模块划分，产出 docs/phase3-outline/{module}-interface-contract.md（接口清单 + Schema 10 字段 + 错误码分层 + 备选方案）
     ├─ 主文档 §2 引用块指向 interface-contract.md
     ├─ 失败: 接口契约缺 Schema 字段 / 错误码缺段位 → 回步骤 1（FM-OD-01）
     └─ 成功: 接口契约完整，主文档 §2 接口定义与之对应
  2. 调用关系建模
     ├─ 产出 interface-contract.md 调用关系图（模块间调用 + 数据流标注）
     ├─ 主文档 §1 模块调用关系与之对应
     ├─ 失败: 循环依赖 → 列出环路径重新划分（FM-OD-03）
     └─ 成功: 调用关系无环，主文档 §1 对应
  3. 字段语义对齐与数据源选择
     ├─ 字段命名与业务语义对齐（followerId/followeeId 而非 userId/bloggerId）
     ├─ 跨模块调用显式声明 store 选择
     ├─ 失败: 字段语义模糊且无 Implementation Decisions 说明 → 回步骤 3（FM-OD-02）
     └─ 成功: 字段语义清晰，store 选择与 schema 一致
  4. 术语建模
     ├─ 产出 docs/phase3-outline/{module}-glossary.md（接口域术语子集）
     ├─ 主模板 §4 引用块指向 glossary.md
     └─ 成功: glossary.md 产出，引用块成立
  5. UML 模块级建模
     ├─ 产出 docs/phase3-outline/{module}-uml-modeling.md（包图/序列图/通信图）
     ├─ 主模板附录 A 引用块指向 uml-modeling.md
     ├─ 失败: 图与主文档 §1/§2 不对应 → 回步骤 5 对齐（FM-OD-04）
     └─ 成功: 三图产出，mermaid 块配平
  6. 追踪矩阵与行为规格引用
     ├─ 产出 docs/phase3-outline/{module}-traceability-matrix.md（INTF×SD 8 字段 + 测试层级矩阵）
     ├─ 产出 docs/phase3-outline/{module}-behavior-spec.md（L3 .feature 引用关系）
     ├─ 主模板 §5/§6 引用块指向上述独立文件
     ├─ 失败: 追踪矩阵字段与步骤 1/2 不一致 → 回步骤 6 对齐（FM-OD-05）
     └─ 成功: traceability-matrix.md + behavior-spec.md 产出，引用块成立
  7. Phase 3 工程纪律与 DoD
     ├─ 产出 docs/phase3-outline/{module}-discipline-dod.md（DoD 清单 ≥ 8 项）
     ├─ 主模板 §7 引用块指向 discipline-dod.md
     └─ 成功: DoD 清单产出，引用块成立

## 输入

- 《系统设计文档》（阶段 2 产出）
- 模块划分方案

## 输出

- 《接口设计文档》（套用 [templates/interface-design.md](../templates/interface-design.md)）
  - 模块间接口定义
  - 参数定义、返回值、错误码
  - 调用关系图
- 集成测试用例设计文档（套用 [templates/test-case.md](../templates/test-case.md)，类型=集成测试）
- 独立产物文件：
  - `{module}-interface-contract.md`：接口契约（接口清单 + Schema 10 字段 + 调用关系图 + 错误码分层）
  - `{module}-glossary.md`：术语表（接口域子集）
  - `{module}-traceability-matrix.md`：概要设计追踪矩阵（INTF×SD 8 字段 + 测试层级矩阵）
  - `{module}-behavior-spec.md`：行为规格模型（L3 .feature 引用关系）
  - `{module}-discipline-dod.md`：工程纪律与 DoD 可勾选清单
  - `{module}-uml-modeling.md`：UML 模块级建模（包图/序列图/通信图）

> 路径约定见 [directory-conventions.md](directory-conventions.md)。

## AI 能力应用

- **接口定义文档生成**：依据模块职责推导接口契约
- **调用关系分析**：识别模块依赖与数据流向
- **测试用例设计**：覆盖模块间交互的正向 / 异常路径

## 执行方法论

> 本节规定产出物的工具级落地方式，确保产出可复现、可追溯、可审计。

| 产出物 | 落地方式 | 文件命名 |
|---|---|---|
| 接口设计文档 | 套用 `templates/interface-design.md` 模板，含接口签名 / 参数 / 返回值 / 错误码 | `docs/phase3-outline/{module}-interface-design.md` |
| 集成测试用例 | 套用 `templates/test-case.md` 模板，`type=集成测试`，含参数校验 + 跨模块 + 异常路径 | `docs/phase3-outline/{module}-integration-test.md` |
| 调用关系图 | 用 Mermaid `graph` 语法产出模块间调用关系，须标注依赖方向，禁止循环依赖 | 内嵌于 `docs/phase3-outline/{module}-interface-design.md` |
| 接口契约 | 套用 `templates/interface-design/interface-contract.md` | `docs/phase3-outline/{module}-interface-contract.md` |
| 术语表 | 套用 `templates/interface-design/glossary.md` | `docs/phase3-outline/{module}-glossary.md` |
| UML 模块级建模 | 套用 `templates/interface-design/uml-modeling.md`，mermaid 三图 | `docs/phase3-outline/{module}-uml-modeling.md` |
| 概要设计追踪矩阵 | 套用 `templates/interface-design/traceability-matrix.md` | `docs/phase3-outline/{module}-traceability-matrix.md` |
| 行为规格模型（L3） | 套用 `templates/interface-design/behavior-spec.md`（引用 .feature，不内联） | `docs/phase3-outline/{module}-behavior-spec.md` |
| 工程纪律与 DoD | 套用 `templates/interface-design/discipline-dod.md` | `docs/phase3-outline/{module}-discipline-dod.md` |
| 主设计文档 | 套用 `templates/interface-design.md`（骨架 + 引用块指向上述 6 文件） | `docs/phase3-outline/{module}-interface-design.md` |

**调用关系图语法约束**：每个模块间调用须标注接口名 + 数据流向；存在循环依赖时必须重新划分模块边界，禁止带环放行。

## 问题驱动叙述格式

每个关键接口契约按「目标 约束 → 方案 → 权衡」叙述（对应 interface-contract.md「Implementation Decisions」节）：
1. **目标**：本接口要满足什么设计目标（如"统一访问多个存储实现"）。
2. **约束**：不可违背的约束（如"不得引入跨模块共享可变状态"）。
3. **方案**：选定接口签名 + 模式引用（引用设计模式命名，如"本接口用 Strategy 封装 X 算法"）。
4. **权衡**：方案的优点 + 代价（GoF Consequences 写法，缺一即返工 FM-OD-02）。

## 接口契约 Schema 模板

每个接口契约按下表填写完整，缺一项即返工：

| 字段 | 必填 | 示例 |
|---|:---:|---|
| 接口名 | ✅ | `createOrder` |
| 路径 / 触发器 | ✅ | `POST /api/v1/orders` / `event:order.created` |
| 参数名 | ✅ | `userId`, `items[]` |
| 参数类型 | ✅ | `string(uuid)`, `array<Item>` |
| 必填 | ✅ | `true` / `false` |
| 默认值 | ⬜ | `currency="CNY"` |
| 约束 | ✅ | `len(userId)=36`, `items.length ∈ [1,100]` |
| 示例 | ✅ | `{"userId":"...","items":[{"sku":"A1","qty":2}]}` |
| 返回值结构 | ✅ | `{code, message, data: {orderId, status}}` |
| 错误码集合 | ✅ | `40001, 40002, 50001` |

## 字段命名业务语义对齐

设计文档字段命名须与业务语义对齐。若因技术约束无法对齐，须在设计文档「Implementation Decisions」节说明字段映射。

**检查规则**（R3 可靠性审查项，非硬性门禁）：
- 字段命名须反映业务语义（如「关注关系」用 `followerId/followeeId` 而非 `userId/bloggerId`）
- 若因技术约束无法对齐，须在 Implementation Decisions 节说明字段映射关系
- 不一致且无 Implementation Decisions 说明 → R3 可靠性审查标注 finding（severity=Required），V 评审纳入 reworkHints

**示例**：
- ✅ `followerId/followeeId`（业务语义清晰）
- ❌ `userId/bloggerId`（业务语义模糊，需 Implementation Decisions 说明映射）

## 跨模块数据源选择约束

> 缺陷 P7-002（`BloggerService.follow` 校验 `follower` 在 blogger store，设计标注 user+）与 P7-003（`CommentService.create` 仅校验 user store，blogger token sub 是 bloggerId）的预防约束。

跨模块调用时，数据源（store）选择须满足：

- **显式声明**：每个跨模块调用须在接口设计文档显式声明所用的 store（如 `user store` / `blogger store` / `article store`），写入接口契约 Schema 模板的「约束」字段或「备注」字段。
- **schema 一致**：store 选择须与 schema 中的实体定义一致。如 `follower` 是 `user` 实体的子集 → 须在 `user store` 校验，不应在 `blogger store`；如 `comment.bloggerId` 引用 `blogger` 实体主键 → 须在 `blogger store` 校验，不应在 `user store`。
- **token sub 对齐**：如调用方携带 token，`token.sub` 须与所选 store 的主键一致。如 `blogger token sub=bloggerId` → 不应在 `user store` 校验 `follower`；如 `user token sub=userId` → 不应在 `blogger store` 校验 `blogger` 实体。

**违反后果**：集成测试阶段发现跨模块数据流缺陷（如 P7-002/P7-003 类），回 phase-3 返工接口设计。关联反模式 [#23 跨模块 store 误用](anti-patterns.md)。phase-4 详细设计同步此约束（见 [phase-4-detailed-design.md「跨模块数据源选择约束（同步 phase-3）」](phase-4-detailed-design.md)）。

## 错误码分层约定

| 段位 | 范围 | 含义 | 示例 |
|---|---|---|---|
| 4xx | 40000-49999 | 客户端错误（参数/认证/权限） | `40001 参数缺失`, `40101 未授权`, `40301 禁止访问` |
| 5xx | 50000-59999 | 服务端错误（DB/依赖/未知） | `50001 DB 超时`, `50201 下游服务不可用` |
| 业务 | 60000-69999 | 业务规则错误（库存/状态机/风控） | `60001 库存不足`, `60002 订单状态非法` |

每条错误码必须配套 `code` + `message` + `httpStatus` + `retryable`（是否可重试）四元组。

## 边界条件与异常处理

| 异常场景 | 检测算法 / 命令 | Fallback 路径 |
|---|---|---|
| 模块循环依赖 | DFS 三色染色（白=未访问 / 灰=栈中 / 黑=已完成）；遇灰节点即环 | 列出环路径，引入接口层或倒置依赖方向，重新检测直至无环 |
| 模块职责重叠（单一职责违反） | 检查每个模块的「职责描述」关键词重叠率 > 30% | 将重叠职责抽为新模块，或合并到主模块；更新模块划分表 |
| 接口签名缺类型约束 | 静态扫描参数 / 返回值类型注解缺失（TS 项目用 `tsc --noEmit`） | 回到接口定义补全类型；类型不明确时用 `unknown` + 显式类型守卫 |
| 错误码集合不完整 | 接口契约缺 4xx/5xx/业务三类之一 | 回到接口定义按「错误码分层约定」补全三段位 |

检测顺序：先静态扫描（签名/错误码）→ 再图算法（循环依赖）→ 最后语义检查（职责重叠）。

## 失败模式矩阵

| 编号 | 失败模式 | 检测信号 | 处置 |
|---|---|---|---|
| FM-OD-01 | 接口契约缺 Schema 字段 / 错误码缺段位 | interface-contract.md 接口缺 Schema 10 字段之一；错误码缺 4xx/5xx/业务之一 | 回步骤 1 补全契约字段与错误码 |
| FM-OD-02 | 字段语义模糊 / ADR 缺上下文后果 | 字段命名与业务语义不对应且无 Implementation Decisions 说明 | 回步骤 3 补全字段映射或对齐命名 |
| FM-OD-03 | 模块循环依赖 | 调用关系 DFS 三色染色检测到环 | 回步骤 2 重新划分边界 |
| FM-OD-04 | UML 建模与接口/调用关系脱节 | uml-modeling.md 图与主文档 §1/§2 不对应 | 回步骤 5 对齐 UML 建模 |
| FM-OD-05 | 追踪矩阵字段不一致 | traceability-matrix.md 与主文档 §2/phase2 追踪矩阵不一致 | 回步骤 6 对齐追踪矩阵字段 |

> 注：FM-OD-06（越过阶段边界落类/方法级）为越界检测信号，见禁止行为 #8 与返工路径，不单列于上表。

## 测试用例设计（本阶段产出集成测试用例）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-DES-004 | 接口定义 | 模块交互需求 | 接口文档、参数定义、返回值、错误码 | 高 |
| TC-DES-006 | 集成测试用例生成 | 接口定义文档 | 覆盖模块间交互的测试用例 | 高 |
| TC-DES-010 | 接口参数校验（设计） | 合法 / 非法 / 边界参数 | 非法参数返回 400 + 错误码；边界参数正确处理 | 高 |
| TC-DES-011 | 跨模块调用（设计） | 模块 A → 模块 B 调用 | 数据正确传递，返回结构符合契约 | 高 |
| TC-DES-012 | 数据传递异常路径（设计） | 模块 B 超时 / 返回错误码 | 模块 A 按错误码 fallback，不崩溃 | 高 |

## 测试 seam 决策

> 吸收 to-spec seam-first testing 方法论。模块交互级 seam 决策服务于阶段 6 集成测试设计，与现有「集成测试设计」节互补。

**模板**：

```markdown
## 测试 seam 决策

### 模块交互 seam
- <模块对 1>: seam = <模块导出 / 内部接口>
- <模块对 2>: ...

### 选定 seam
- 集成测试主 seam: <seam-id>
- 复用阶段 2 seam 的部分: <列表或无>

### 理由
- 为什么在模块边界而非系统边界测
- 为什么现有模块接口优于新建测试专用接口
```

**规则**：
- "最高 seam"在模块层 = 模块公共导出（不深入私有方法）
- 必须显式声明「复用阶段 2 seam 的部分」（避免重复引入 seam）
- 阶段 4 必须显式引用阶段 3 选定 seam

## 并行任务（强制）

接口定义产出后，**立即**同步生成集成测试用例，覆盖模块间数据传递、接口参数校验、跨模块调用。集成测试用例将在阶段 6（集成测试）执行，本阶段只做设计。

### L3 BDD features 设计（与 TLA+ L3 spec 并行）

S-bdd 子代理在 S-doc 产出接口设计后：
1. 套用 [`templates/feature.template`](../templates/feature.template) 产出 L3 features（每个 INTF ≥1 个 .feature 文件，parent 指向 L2）
2. 在 Background 节声明 L3 状态机七要素
3. 更新 `.w-model/bdd-manifest.json`（追加 features + stateMachines）
4. 在 RTM `integrationTest` 列登记 `IT-NNN | BDD-L3-<system>_<subsystem>-<num>.feature`

V 子代理评审 features（targetKind=test + [bdd-review-checklist.md](bdd-review-checklist.md)）。
G 子代理跑 [`check-bdd-model.ts`](../scripts/cli/check-bdd-model.ts) `--phase=3` 校验 D1-D8。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中补登：设计文档列（概要设计 / 接口）、集成测试列。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

## ingestion 子流程（S→A 路径，阶段 3）

阶段 3 的 S 子代理先产出接口设计文档，再由 A-evolve 提取 INTF 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=3` 校验连通 + 单根 + SD_without_implements=0 + INTF_without_defines=0。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。

## 验收标准

- [ ] 接口定义完整，每条契约按「接口契约 Schema 模板」10 字段填写
- [ ] 错误码按「错误码分层约定」覆盖 4xx/5xx/业务三段位
- [ ] 模块间调用关系清晰，无循环依赖（DFS 三色染色验证）
- [ ] 集成测试用例覆盖关键模块交互路径
- [ ] RTM 已补登接口设计与集成测试映射
- [ ] {module}-interface-contract.md + {module}-glossary.md 已产出，主文档 §2/§4 引用块成立
- [ ] {module}-traceability-matrix.md（INTF×SD + 测试层级矩阵）与主文档 §2/phase2 矩阵一致，主文档 §5 引用块成立
- [ ] {module}-uml-modeling.md 三图与主文档 §1/§2 对应、mermaid 块配平，主文档附录 A 引用块成立
- [ ] {module}-behavior-spec.md + {module}-discipline-dod.md 已产出，主文档 §6/§7 引用块成立

> 🔴 **CHECKPOINT · 阶段门放行**：接口设计 + 集成测试用例产出后暂停。Agent 必须向用户展示「接口契约清单（含错误码）/ 调用关系图（无循环依赖）/ 集成测试用例（含参数校验 + 跨模块 + 异常路径）/ RTM 补登」，由用户确认「放行进入阶段 4」或「返工」。存在循环依赖或接口契约缺错误码 → 一律返工。

## 阶段门评审

评审通过 → 进入阶段 4（详细设计）。
评审不通过 → 回到概要设计起点返工（如接口契约不全、循环依赖、测试用例缺异常路径）。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 深入类 / 方法内部实现 | 类/方法级设计属阶段 4，本阶段只做模块边界与接口契约 |
| 2 | 接口契约缺错误码定义 | 每个接口必须按「错误码分层约定」定义 4xx/5xx/业务三段位错误码集合 |
| 3 | 集成测试用例只覆盖正向调用 | 必须含参数校验 + 跨模块 + 异常路径（超时/错误码） |
| 4 | 忽略循环依赖检测 | 必须用 DFS 三色染色检测模块间循环依赖，有则重新划分模块边界 |
| 5 | 接口签名无类型约束 | 参数与返回值必须按「接口契约 Schema 模板」给出明确类型 约束 |
| 6 | 追踪矩阵字段与主文档 §2 接口定义 / phase2 追踪矩阵不一致 | 步骤 6 须对齐 traceability-matrix.md（FM-OD-05） |
| 7 | UML 图表与接口/调用关系脱节 | uml-modeling.md 三图须对应主文档 §1/§2（FM-OD-04） |
| 8 | 越过阶段边界落类/方法级实现 | 类/方法级设计属阶段 4，本阶段只产模块接口级（FM-OD-06 禁止越界） |

## 返工路径

阶段门评审不通过时，按以下路径返工：

- 接口契约缺错误码 → 回到接口定义，补全成功 + 错误码集合
- 调用关系图存在循环依赖 → 回到模块划分，重新划分边界
- 集成测试缺异常路径 → 回到并行任务，补全超时 / 错误码 fallback 用例
- 接口签名无类型约束 → 回到接口定义，补全参数与返回值类型
- 越界深入类 / 方法内部 → 回到功能描述，将类 / 方法级设计移交阶段 4
- 接口契约缺字段/错误码（FM-OD-01）→ 回步骤 1 补全
- 字段语义模糊（FM-OD-02）→ 回步骤 3 补全映射
- 循环依赖（FM-OD-03）→ 回步骤 2 重新划分
- UML 脱节（FM-OD-04）→ 回步骤 5 对齐
- 追踪矩阵不一致（FM-OD-05）→ 回步骤 6 对齐
- 越界落类/方法级（FM-OD-06）→ 移除越界内容，移交阶段 4

## 退出状态

项目 `status` 更新为 `详细设计`。

## 路由顺序约束

> 阶段 3 接口设计须明确路由注册顺序约束。

### 框架级约束

| 框架 | 路由匹配规则 | 顺序约束 |
|---|---|---|
| Express | 按注册顺序匹配，首个匹配生效 | 静态路径须先于参数路径注册 |
| Koa | 按注册顺序匹配（koa-router） | 同 Express |
| Fastify | 按注册顺序匹配 | 静态路径须先于参数路径注册 |
| NestJS | 装饰器顺序即注册顺序 | 控制器内静态路径方法须先于参数路径方法 |

### 设计级约束

1. **鉴权前置**：须鉴权的路由须在路由定义前挂载鉴权中间件
2. **限流前置**：限流中间件须在业务处理前挂载
3. **错误处理中间件最后挂载**：错误处理中间件须在所有路由注册后挂载

### 反模式

- 参数路径先于静态路径注册 → 命中反模式 #36
- 鉴权路由注册在公开路由之后 → 命中反模式 #36
