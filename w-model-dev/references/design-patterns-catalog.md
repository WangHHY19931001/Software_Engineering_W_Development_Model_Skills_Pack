# 设计模式速查表（Design Patterns Catalog）

> 提炼自 GoF《Design Patterns》23 模式 + 引言（1.1/1.3-1.8）+ 案例（ch2）+ 结论（ch6）。
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
