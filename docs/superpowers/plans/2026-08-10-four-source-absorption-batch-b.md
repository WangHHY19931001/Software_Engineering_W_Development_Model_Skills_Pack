# 四源吸收批次 B（P1，41.1.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地四源吸收 P1 架构决策层 10 项：新建 design-patterns-catalog.md、refactoring-catalog 目标结构列、phase-2 CAP/微服务粒度/事务决策矩阵、quality-standards 容错/日志规范、verifier-spec Architecture/Security 评审、tla-plus-guide 断路器/TCC-SAGA 场景、security-review 认证授权维度、phase-6 补偿/故障注入测试，版本 41.0.0 → 41.1.0。

**Architecture:** 纯文档为主（10 项全部）；无脚本改动。design-patterns-catalog.md 与 refactoring-catalog/code-smells-checklist 构成"坏味道→手法→目标结构"三件套，挂 Bundled Resources 按需加载。凤凰架构决策框架（CAP/粒度/容错）作为 phase-2 决策矩阵的内容源与 verifier-spec Architecture/Security 轴的评审问题集。

**Tech Stack:** Markdown、TypeScript（仅验证命令用 tsx/vitest/tsc）。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-four-source-absorption-design.md`

**版本级联:** 41.0.0 → 41.1.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `w-model-dev/references/design-patterns-catalog.md` | **新建**（GoF）：23 模式目录 + 对照表 + 决策辅助 + 使用 8 步 + 过度设计警告 |
| `w-model-dev/references/refactoring-catalog.md` | 补「目标结构」注解列 + 重构动机优先注 |
| `w-model-dev/references/code-smells-checklist.md` | 组 G 补子类爆炸/继承破坏封装；组 F 补 Getter/Setter 浅方法 |
| `w-model-dev/references/phase-2-system-design.md` | 技术选型决策矩阵补 CAP/一致性谱系/事务/粒度内容源 |
| `w-model-dev/references/quality-standards.md` | 补容错设计检查清单 + 日志规范 |
| `w-model-dev/references/verifier-spec.md` | Architecture 轴补 8 类重新设计原因/Visitor 判据/交集并集/网关轻量；Security 轴补认证授权传输 |
| `w-model-dev/references/tla-plus-guide.md` | 建模场景补断路器/TCC-SAGA；术语补 Safety/Liveness |
| `.cursor/skills/security-review/SKILL.md` | 扩充认证/授权/传输安全检查维度 |
| `w-model-dev/references/phase-6-integration-test.md` | 补分布式事务补偿路径测试 + 容错/故障注入测试生成 |
| `docs/skill-design-document_SSoT.md` | §3.4.41 增补 P1 小节 |
| `w-model-dev/SKILL.md` | Bundled Resources 挂 design-patterns-catalog.md |
| `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `skill-metadata.json` | 级联（新 reference 挂接、版本号） |

---

### Task 1: 新建 design-patterns-catalog.md（GoF 三件套之一）

**Files:**
- Create: `w-model-dev/references/design-patterns-catalog.md`

- [ ] **Step 1: 写入文件**

```markdown
# 设计模式速查表（Design Patterns Catalog）

> 第 41 轮四源吸收：提炼自 GoF《Design Patterns》23 模式 + 引言（1.1/1.3-1.8）+ 案例（ch2）+ 结论（ch6）。
> 用法：S 子代理在阶段 3/4 设计时作"可选方案词汇表"（引用的前提是命名后讨论）；V 子代理评审 Architecture 轴时作"模式恰当性基准"（声称用了某模式须能指出参与者与意图，否则判定过度设计）。
> 记录格式：名称 / 速写 / 意图 / 适用性 / 权衡（一句话）。与 [refactoring-catalog.md](refactoring-catalog.md)（重构手法）+ [code-smells-checklist.md](code-smells-checklist.md)（坏味道）互引。

## 使用纪律（GoF 1.8）

- **8 步用法**：通读 → 研究结构/参与者/协作 → 看示例 → 取有意义的名字（融入应用上下文，如 `SimpleLayoutStrategy`）→ 定义类 → 定义应用化操作名 → 实现。
- **过度设计警告**：模式不应被不加区分地应用——间接层有代价；只在确实需要其灵活性时应用（Consequences 节是评估工具）。设计引用模式名时必须附权衡声明（class-design「方案权衡」列），无权衡声明 = 四源-β 候选反模式。

## 创建型（Creational）

| 模式 | 速写 | 意图 | 权衡 |
|---|---|---|---|
| Abstract Factory | 相关对象族统一创建 | 隔离具体类创建，支持产品族切换 | 优点：解耦客户端与具体类；代价：支持新产品困难 |
| Builder | 分步构建复杂对象 | 将复杂对象构造与表示分离 | 优点：构造过程可复用；代价：每产品需一 Builder |
| Factory Method | 子类决定实例化哪个类 | 将对象创建延迟到子类 | 优点：开闭原则；代价：类数量增加 |
| Prototype | 克隆原型而非新建 | 用原型实例指定创建种类 | 优点：运行时动态添加类型；代价：克隆语义需实现 |
| Singleton | 全局唯一实例 | 保证类只有一个实例 | 优点：全局访问点；代价：全局状态（现代倾向 DI/容器管理） |

## 结构型（Structural）

| 模式 | 速写 | 意图 | 权衡 |
|---|---|---|---|
| Adapter | 接口转换（事后） | 让接口不兼容的类协同工作 | 优点：复用旧类；代价：适配层间接 |
| Bridge | 抽象与实现分离（事前） | 使抽象与实现可独立演化 | 优点：分离变化维度；代价：类层次增加 |
| Composite | 树形部分-整体 | 以统一方式处理单个与组合对象 | 优点：客户端一致；代价：过度泛化风险 |
| Decorator | 动态附加职责 | 不修改对象而扩展功能 | 优点：组合优于继承；代价：易产生浅类群（APoSD ch7 警告） |
| Facade | 统一门面 | 为子系统提供统一接口 | 优点：简化客户端；代价：门面膨胀风险 |
| Flyweight | 共享细粒度对象 | 大量相似对象共享状态 | 优点：节省内存；代价：状态分离复杂度（现代语言场景价值低） |
| Proxy | 代理控制访问 | 为对象提供替身控制访问 | 优点：延迟/权限/日志；代价：间接层 |

## 行为型（Behavioral）

| 模式 | 速写 | 意图 | 权衡 |
|---|---|---|---|
| Chain of Responsibility | 责任链传递请求 | 多个对象机会处理请求 | 优点：解耦发送/接收；代价：链已存在才适用 |
| Command | 请求对象化 | 将请求封装为对象（可排队/撤销） | 优点：事务化操作；代价：类数量增加 |
| Interpreter | 文法解释 | 为语言定义文法并解释 | 优点：文法可扩展；代价：维护复杂（现代语言/DSL 价值低） |
| Iterator | 顺序访问聚合 | 提供统一遍历接口 | 优点：解耦遍历；代价：现代语言原生支持 |
| Mediator | 集中协调 | 对象间通信集中到中介者 | 优点：减少耦合；代价：中介者可能成为上帝对象 |
| Memento | 状态快照恢复 | 捕获并外部化对象状态 | 优点：可撤销；代价：快照存储成本 |
| Observer | 发布-订阅 | 一对多依赖通知 | 优点：松耦合；代价：通知顺序/泄漏 |
| State | 状态封装为对象 | 状态行为变化自动切换 | 优点：消除条件分支；代价：类数量增加（与 TLA+ 状态机建模协同） |
| Strategy | 算法族封装 | 算法可替换 | 优点：开闭原则；代价：客户端须知策略差异 |
| Template Method | 骨架+钩子 | 定义算法骨架，子类实现步骤 | 优点：复用骨架；代价：继承耦合 |
| Visitor | 双分派操作 | 操作加到稳定结构 | 优点：新增操作易；代价：结构变化则波及（判据：哪个类层次最常变化） |

## 模式对照表（防"用错模式"最高频来源）

| 对照 | 判定基准 |
|---|---|
| Adapter vs Bridge vs Facade | Adapter 事后让已设计的协同；Bridge 事前已知抽象/实现各自演化；Facade 定义新接口（复用旧接口=Adapter） |
| Composite vs Decorator vs Proxy | 结构相似意图异：Composite 树形部分-整体；Decorator 动态职责；Proxy 控制访问 |
| Mediator vs Observer | Mediator 集中通信（自定义分发伤类型安全）；Observer 松绑定适合数据依赖 |
| Factory Method → Abstract Factory/Builder/Prototype | 设计常从 Factory Method 开始，随发现更多灵活性需求演化 |
| Command vs Chain of Responsibility | Command 一对一绑定；CoR 适合链已存在的场景 |

## 决策辅助：考虑什么应可变（GoF 表 1.2 提炼）

| 独立变化点 | 推荐模式 |
|---|---|
| 对象创建方式 | Abstract Factory / Factory Method / Prototype |
| 算法 | Strategy / Template Method |
| 对象状态 | State |
| 对象实现 | Bridge |
| 子系统接口 | Facade |
| 操作处理链 | Chain of Responsibility |
| 请求执行/撤销 | Command |
| 结构遍历 | Iterator / Visitor |
| 对象间通知 | Observer / Mediator |

> 用法：设计时对每个"可能变化的需求点"查表选模式；评审时反查"设计声称要封装的变点，是否确实被某模式隔离"（V 评审 architecture-soundness 轴）。

## 为变化设计：8 类重新设计原因 → 模式（GoF 1.6）

| 重新设计原因 | 对应模式 |
|---|---|
| 显式指定类 | Abstract Factory / Factory Method / Prototype |
| 依赖特定操作 | Chain of Responsibility / Command |
| 平台依赖 | Abstract Factory / Bridge |
| 依赖对象表示/实现 | Abstract Factory / Bridge / Memento / Proxy |
| 算法依赖 | Builder / Iterator / Strategy / Template Method / Visitor |
| 紧耦合 | Abstract Factory / Bridge / Chain / Command / Facade / Mediator / Observer |
| 子类化扩展爆炸 | Bridge / Chain / Composite / Decorator / Observer / Strategy |
| 无法方便改类 | Adapter / Decorator / Visitor |

> V 评审 Architecture 轴逐条问"当前设计是否因其中某类原因会在未来被迫重构"，命中即要求补对应模式的权衡声明。

## 与技能包机制的关系

- **模式是重构的目标**（GoF ch6）：refactoring-catalog 的手法通向 GoF 目标结构——"以委托取代继承"→ Strategy/委托结构。
- **共同设计词汇表**：设计文档描述结构可引用模式名（"本类用 Strategy 封装算法"），读者不必反向工程。
- **与 TLA+ 协同**：State/Command/Observer 模式的状态语义可直接映射 TLA+ 状态机建模（见 tla-plus-guide 建模场景）。
- **与 APoSD 平衡**：GoF 鼓励模式，APoSD 警告浅类群（Decorator 过用）——评审时两源并用（先问深度再问模式恰当性）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/design-patterns-catalog.md
git commit -m "feat: add design-patterns-catalog reference (GoF 23 patterns + selection/usage guidance)"
```

### Task 2: refactoring-catalog.md 补「目标结构」注解列

**Files:**
- Modify: `w-model-dev/references/refactoring-catalog.md`

- [ ] **Step 1: 头部补目标结构说明 + 重构动机注**

在文件头部引用块（L3-5）之后追加：

```markdown
> 第 41 轮四源吸收（GoF ch6）：模式是重构的目标——本表手法通向 GoF 目标结构，形成"坏味道→手法→目标结构"闭环。
> 重构动机优先于实现需求（APoSD ch16.1）：每次修改都应让系统更像"一开始就设计成这样"，而非只满足当前功能。
```

- [ ] **Step 2: 「封装」节目标结构注解**

在 `| 以对象取代基本类型 | 基本类型偏执（魔法数/裸字符串） | 提取为值对象/枚举 |` 行之后追加目标结构列，将封装节改为含目标结构：

```markdown
| 隐藏委托 | 消息链/火车失事 | 在委托方提供直调方法 | → Facade（新接口） |
| 移除中间人 | 中间人只转发不增值 | 直接调用被委托对象 | → 直接调用（消除 Adapter 式间接） |
| 以委托取代继承 | 子类爆炸/继承破坏封装 | 用组合+委托替代继承 | → Strategy / 委托结构（GoF 优先组合原则） |
```

> 注：原表为「手法 | 动机 | 做法」三列，目标结构以 `→` 追加在做法后，作为第四列注解。

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/refactoring-catalog.md
git commit -m "feat(refactoring-catalog): add target-structure annotations linking to GoF patterns"
```

### Task 3: code-smells-checklist.md 补 GoF 条目

**Files:**
- Modify: `w-model-dev/references/code-smells-checklist.md`

- [ ] **Step 1: 组 G 补「子类爆炸」「继承破坏封装」**

在组 G 表 G34 行之后追加：

```markdown
| G35 子类爆炸 | 用继承做修饰/变体导致类数组合爆炸（BorderedScrollableComposition 案例） | 必须修复 | 组合+装饰/策略（GoF ch2） |
| G36 继承破坏封装 | 子类依赖父类实现细节，父类变化波及子类 | 建议修改 | 以委托取代继承（GoF 1.6） |
```

- [ ] **Step 2: 组 F 补「Getter/Setter 浅方法」**

在组 F 表 F5 行之后追加：

```markdown
| F6 Getter/Setter 浅方法 | 公开实例变量违反信息隐藏；getter/setter 堆砌无行为 | 建议修改 | 封装行为入类（APoSD ch19.6） |
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/code-smells-checklist.md
git commit -m "feat(code-smells): add GoF subclass-explosion and inheritance-breaks-encapsulation smells, getter/setter shallow-method"
```

### Task 4: phase-2-system-design.md 技术选型决策矩阵内容源

**Files:**
- Modify: `w-model-dev/references/phase-2-system-design.md`

- [ ] **Step 1: 「技术选型决策矩阵」节后追加「架构决策框架（凤凰架构吸收）」**

在 `输出格式：候选清单 + 每项 5 维度评分 + 总分 + 一句话选型理由。无评分依据的选型一律返工。` 之后追加：

```markdown
### 架构决策框架（第 41 轮四源吸收，凤凰架构）

技术选型评分时，以下第一性原则作为 5 维度评分的约束输入（写入 ADR 的「上下文」节）：

**CAP 与一致性谱系**（transaction/distributed）：三选一——放弃 P 假设通信永远可靠（现实中不成立）；放弃 A 分区时离线（CP 如 HBase）；主流选 AP（分区可用）。强一致/弱一致/最终一致是谱系不是离散点；ACID 刚性事务 vs 可靠事件队列/TCC/SAGA 柔性事务按场景取舍（无包治百病方案，因地制宜）。

**微服务粒度判定**（methodology/forward-msa/granularity）：
- 下界：独立（可独立发布/部署/运行/测试）+ 内聚（强相关功能与数据同服务）+ 完备（至少一项业务实体与完整操作）。
- 上界：2 Pizza Team 一个研发周期内能完成的全部需求。
- 过细三反噬：进程内 vs 网络调用数量级差距（性能）、强一致数据须聚合（一致性）、双向依赖须合并（可用性）。

**微服务前提四问**（prerequest）：① 决策者与执行者认知康威定律？② 组织内有技术专家？③ 具备自治型自动化与监控？④ 复杂性已成为制约生产力的主要矛盾？任一不满足 → 不选微服务（"能分布式 ≠ 应该分布式"）。

**分布式事务模式选择**（transaction/distributed）：可靠事件队列（本地事务+消息表+幂等+最大努力交付）/ TCC（Try 冻结资源，业务侵入强，不适用第三方资源）/ SAGA（补偿代回滚，T/C 须幂等+交换律）/ AT（全局锁防脏写）。决策矩阵须显式声明所选模式与失败路径。
```

- [ ] **Step 2: 「边界条件与异常处理」表补事务/一致性异常**

在边界条件表末尾追加两行：

```markdown
| 强一致数据被拆到多服务 | 跨服务强一致操作（原可单库事务） | 聚合数据到单一服务，或显式采用柔性事务（TCC/SAGA）并登记失败路径 |
| 分区/网络异常下的可用性声明 | 系统无分区处理策略 | 按 CAP 三选一显式声明取舍（AP/CP），写入 ADR |
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/phase-2-system-design.md
git commit -m "feat(phase-2): add architecture decision framework (CAP, microservice granularity, transaction patterns) from Fenix"
```

### Task 5: quality-standards.md 容错设计 + 日志规范

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`

- [ ] **Step 1: 追加「容错设计检查清单」节**

在 `### 性能三法` 节之后追加：

```markdown
### 容错设计检查清单（第 41 轮四源吸收，凤凰架构 failure.md）

设计评审/系统测试设计时逐项核对：

| 检查项 | 判定基准 | 不通过 → 动作 |
|---|---|---|
| 容错策略选择 | 7 策略对比（故障转移/快速失败/安全失败/沉默失败/故障恢复/并行调用/广播调用）按场景选型 | 回设计补策略声明 |
| 断路器状态机 | CLOSED/OPEN/HALF OPEN 三态；OPEN 触发 = 请求数阈值 + 故障率阈值双条件 | 回设计补状态机（可映射 TLA+ 建模） |
| 舱壁隔离 | 线程池 / 信号量隔离下游故障 | 回设计补隔离方案 |
| 重试四前提 | ① 仅主路关键服务 ② 仅瞬时故障 ③ 仅幂等服务 ④ 有超时/次数终止条件 | 违反任一即重试反模式；多组件同开重试致乘法效应（4×4×4×4=256） |

### 日志规范（第 41 轮四源吸收，凤凰架构 observability/logging.md）

- **日志 = 离散事件记录**：应含 TraceID 与关键事件上下文；日志只记事件，不承担追踪/度量职责（职责分离）。
- **4 个输出反模式**（禁止）：① 记录敏感信息；② 日志中执行慢操作（阻塞）；③ 打印追踪诊断信息（应走 Tracing）；④ 误导他人（无上下文/无级别区分）。
- **验证**：phase-7 系统测试验收含"日志含 TraceID、关键事件可关联"检查（见 phase-7-system-test.md 可观测性验收节）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/quality-standards.md
git commit -m "feat(quality-standards): add fault-tolerance design checklist and logging norms from Fenix"
```

### Task 6: verifier-spec.md Architecture/Security 评审问题

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: Architecture 轴补评审问题**

在 design/Architecture 相关评审说明处追加：

```markdown
- **8 类重新设计原因检查（第 41 轮四源吸收，GoF ch1.6）**：逐条问"当前设计是否因 ① 显式指定类 ② 依赖特定操作 ③ 平台依赖 ④ 依赖对象表示/实现 ⑤ 算法依赖 ⑥ 紧耦合 ⑦ 子类化扩展爆炸 ⑧ 无法方便改类 而被迫重构"，命中即要求补对应模式的权衡声明（对照 design-patterns-catalog「8 类原因→模式」表）。
- **"哪个类层次最常变化"（GoF Visitor 判据）**：结构稳定而操作多变用 Visitor，反之用其他——评审问"设计声称封装的变化点是否与最常变化的层次一致"。
- **接口交集 vs 并集**（GoF ch2）：抽象接口取功能交集则只强如最弱实现，取并集则庞大且漂移——评审问"此抽象接口取交集还是并集、为何"。
- **网关/编排层职责是否轻量**（凤凰架构 service-routing）：网关=路由器+过滤器；过度增加网关职责是危险的——与编排者最小化同构，评审问"中间层是否承载了过多业务职责"。
```

- [ ] **Step 2: Security 轴补认证/授权/传输检查**

在 Security 子标准说明处追加：

```markdown
- **认证方案检查**（第 41 轮四源吸收，凤凰架构 system-security）：认证三层（信道 TLS / 协议 HTTP 认证框架 / 内容 Web 表单/WebAuthn）；OAuth2 四模式适配（授权码最严谨/隐式无服务端/密码仅限高度可信/客户端用于服务间）。
- **授权模型检查**：RBAC96（角色/许可/资源建模、最小特权、角色继承与互斥）；最小特权 + 职责分离。
- **凭证管理检查**：Cookie-Session（服务端状态，集群遇 CAP 三难）vs JWT（客户端状态、防篡改不防泄漏、难以主动失效）；密码存储 = 慢哈希（BCrypt）+ 每用户随机盐 + 服务端二次哈希。
- **传输安全检查**：HTTPS 为唯一可行传输方案；mTLS 用于服务间认证；零信任五特征（身份只来源于服务/服务间无默认信任/集中策略实施点/软件供应链/强隔离）。
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add GoF redesign-cause and Fenix security architecture review questions"
```

### Task 7: tla-plus-guide.md 建模场景 + Safety/Liveness 术语

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 1: 「层级模型」节后追加「建模场景库」**

在 `## 文件头规范（强制）` 之前追加：

```markdown
## 建模场景库（第 41 轮四源吸收，凤凰架构 + GoF）

以下场景为 TLA+ 状态机建模的成熟参考模式（可作阶段 1-4 建模起点）：

| 场景 | 状态集 | 转移 | 不变式要点 |
|---|---|---|---|
| 断路器（凤凰 failure.md） | CLOSED / OPEN / HALF OPEN | CLOSED→OPEN（请求数+故障率双阈值）；OPEN→HALF OPEN（超时探测）；HALF OPEN→CLOSED（探测成功）/→OPEN（探测失败） | 双阈值触发条件；HALF OPEN 探测放行不违反不变式 |
| TCC 事务（凤凰 distributed.md） | INIT / TRYING / CONFIRMING / CANCELLING / DONE | TRY 冻结资源；Confirm/Cancel 二选一 | 幂等：Confirm/Cancel 重复执行收敛；冻结资源不可双重使用 |
| SAGA（凤凰 distributed.md） | RUNNING / FAILED / COMPENSATING / DONE | 正向 Ti 失败 → 反向 Ci 补偿；区分正向恢复（重试 Ti）与反向恢复（执行 Ci） | 补偿操作满足交换律；补偿后到达终态 |
| State 模式（GoF） | 各状态对象 | 事件驱动状态切换 | 每个状态的事件处理完备（无未处理事件死锁） |

> Safety vs Liveness（凤凰架构 consensus 术语）：不变式 = Safety（坏事永不发生）；收敛/最终一致 = Liveness 弱化形式（好事终将发生）。TLA+ 中不变式断言对应 Safety，模型检查的"可达性/活性"对应 Liveness。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/tla-plus-guide.md
git commit -m "feat(tla-plus-guide): add modeling scenario library (circuit-breaker, TCC, SAGA, State) and Safety/Liveness terms"
```

### Task 8: security-review 技能扩充认证/授权/传输维度

**Files:**
- Modify: `.cursor/skills/security-review/SKILL.md`

- [ ] **Step 1: 追加「认证/授权/传输安全评审维度」节**

在文件末尾追加：

```markdown
## 认证/授权/传输安全评审维度（第 41 轮四源吸收）

> 源码扫描（上文）发现"有没有"，本节评审"设计对不对"。对设计/架构评审场景执行。

| 维度 | 检查项 | 高危信号 |
|---|---|---|
| 认证 | 认证三层覆盖（信道 TLS / 协议 / 内容）；OAuth2 四模式与场景适配 | 密码模式用于第三方应用；无 TLS 强制 |
| 授权 | RBAC96 建模（角色/许可/资源）；最小特权 + 职责分离；角色互斥 | 全量管理员角色；越权直接对象引用（IDOR） |
| 凭证 | 密码存储 = 慢哈希 + 每用户盐 + 服务端二次哈希；JWT 防篡改不防泄漏 | 明文/弱哈希存密码；JWT 用于会话态管理（无法主动失效） |
| 传输 | HTTPS 强制；mTLS 服务间认证；零信任（服务间无默认信任、集中策略实施点） | 内网明文 HTTP；服务间默认互信 |
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add .cursor/skills/security-review/SKILL.md
git commit -m "feat(security-review): add auth/authz/transport security review dimensions from Fenix"
```

### Task 9: phase-6-integration-test.md 补偿/故障注入测试

**Files:**
- Modify: `w-model-dev/references/phase-6-integration-test.md`

- [ ] **Step 1: 测试用例设计表补事务/容错用例**

在 IT-005 行之后追加：

```markdown
| IT-006 | 分布式事务补偿路径 | TCC 确认/取消、SAGA 正向/反向恢复 | 补偿执行后状态收敛（幂等），无脏数据残留 | 高 |
| IT-007 | 容错/故障注入 | 下游超时/熔断/重试终止条件 | 断路器 OPEN→HALF OPEN 探测放行；重试达上限停止 | 高 |
```

- [ ] **Step 2: 「执行方法论」失败分支补两行**

在 `| IT-005 不兼容 | ...` 行之后追加：

```markdown
| IT-006 补偿路径 | `npx vitest run tests/integration/ --grep "补偿"` | 幂等断言（重复执行收敛）+ 终态断言 |
| IT-007 容错 | `npx vitest run tests/integration/ --grep "容错"` 或故障注入框架（chaos 实验） | 断路器三态转移 + 重试终止 |
```

失败分支追加：

```markdown
- IT-006 补偿失败 → 检查 TCC/SAGA 状态机实现（回编码），核对补偿操作幂等性（回 phase-2 事务模式决策）
- IT-007 断路器不触发 → 检查阈值配置（回 phase-2 容错设计），重跑故障注入
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/phase-6-integration-test.md
git commit -m "feat(phase-6): add distributed-transaction compensation and fault-injection test cases"
```

### Task 10: SSoT §3.4.41 增补 P1 + SKILL.md 挂接 + 级联 + 版本

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `w-model-dev/SKILL.md`
- Modify: `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `w-model-dev/skill-metadata.json`

- [ ] **Step 1: SSoT §3.4.41 增补 P1 小节**

在 §3.4.41 节 P0 描述后追加：

```markdown
**P1（41.1.0，10 项）**：design-patterns-catalog（新建 reference，GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列（坏味道→手法→GoF 模式闭环）、code-smells 补子类爆炸/继承破坏封装/Getter-Setter 浅方法、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture 评审问题（8 类重新设计原因/Visitor 判据/交集并集/网关轻量）+ Security 评审（认证/授权/凭证/传输）、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness 术语、security-review 认证授权传输维度、phase-6 补偿/故障注入测试用例。
```

- [ ] **Step 2: SKILL.md Bundled Resources 挂 design-patterns-catalog.md**

在 Bundled Resources 表 `refactoring-catalog.md | 编码/重构时查重构手法或坏味道→手法映射` 行之后追加：

```
| design-patterns-catalog.md | 阶段 3/4 设计时选型参考 / V 评审 Architecture 轴模式恰当性基准 |
```

- [ ] **Step 3: 顶层级联（新 reference 挂接 + 版本号 41.1.0）**

1. `AGENTS.md`：references 行补 `design-patterns-catalog`。
2. `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md`：版本号 → 41.1.0。
3. `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` frontmatter：version 41.0.0 → 41.1.0。
4. `CHANGELOG.md` 顶部新增：

```markdown
## [41.1.0] - 2026-08-10

### Added
- 四源吸收 P1（10 项）：design-patterns-catalog.md（GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture/Security 评审问题、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness、security-review 认证授权传输维度、phase-6 补偿/故障注入测试

### Changed
- code-smells-checklist 补子类爆炸/继承破坏封装/Getter-Setter 浅方法
- 版本号 41.0.0 → 41.1.0
```

- [ ] **Step 4: 全量验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files 全过
npx tsc --noEmit             # 0 错误
npm run check:docs-consistency  # exit 0
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md w-model-dev/SKILL.md README.md AGENTS.md docs/INSTALL.md CHANGELOG.md CONTRIBUTING.md package.json w-model-dev/skill-metadata.json
git commit -m "feat: P1 four-source absorption (41.1.0) — design-patterns catalog, architecture decision framework, fault-tolerance"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 B 10 项全部映射：spec §3.2 #1（Task 1）、#2（Task 2）、#3（Task 3）、#4（Task 4）、#5（Task 5）、#6（Task 6）、#7（Task 7）、#8（Task 8）、#9（Task 9）、#10（Task 10）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown；无 TBD/TODO。
- **类型一致性**：design-patterns-catalog 的「8 类重新设计原因→模式」表与 verifier-spec 引用一致（Task 6 引用 Task 1 目录）；断路器三态（CLOSED/OPEN/HALF OPEN）在 quality-standards（Task 5）与 tla-plus-guide（Task 7）一致；IT-006/IT-007 在 phase-6 表与执行方法论一致。
- **无脚本改动确认**：本批 10 项全部纯文档；self-test/vitest 基线不变。
