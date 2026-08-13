# 外部方法论吸收决策记录归档

> 自 `w-model-dev/references/` 移出（41.7.0 全仓去历史化）：4 份吸收决策记录为纯历史文档
> （来源 → 落点 → 优先级分轮 → 不吸收清单），其产物（吸收后的规则）已落地于各当前规则文件
> （code-smells-checklist / refactoring-catalog / format-conventions / quality-standards / phase-N 等）。
> 原文保留，不篡改；对应版本条目见 CHANGELOG-archive.md [40.0.0]-[40.2.0]（三源吸收）与
> CHANGELOG.md [41.0.0]-[41.2.0]（四源吸收）。



---

# 四源吸收（软件设计哲学 / 凤凰架构 / GoF / 失控）（原 `references/four-source-absorption.md`）

# Four-Source Absorption（四源吸收决策记录）

> 吸收源：《软件设计哲学（APoSD 2nd）》22 章、《凤凰架构（awesome-fenix）》、《Design Patterns（GoF）》、《失控（Out of Control）》。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.41 + 各 reference 新增节为准；本文件为吸收映射与决策回溯。
> 调研方式：四源并行深读（每源独立 search 子代理逐章/逐文件精读）+ 落点文件逐一核实（code-smells-checklist / refactoring-catalog / format-conventions / verifier-spec / anti-patterns / SSoT §3.4.39-40）。

## 1. 吸收源清单

| 源 | 形态 | 规模 | 调研结论 |
|---|---|---|---|
| aposd2e-zh（软件设计哲学） | 22 章 + 前言/总结 | 每章 8-40KB | 30 个吸收点 / 9 项不吸收 |
| awesome-fenix（凤凰架构） | 分布式架构开源书 | 30+ 有效文件（部分占位） | 12 个吸收点 / 6 项不吸收 |
| DesignPatterns（GoF） | 23 模式 + 引言/案例/结论/附录 | 约 700KB | 13 个吸收点 / 7 项不吸收 |
| OutOfControl（失控） | Kevin Kelly 哲学/复杂性科学 | 约 1.4MB | 12 个吸收点 / 6 项不吸收 |

## 2. 四源精华 → 技能包落点总表

### 2.1 APoSD（软件设计哲学）——设计质量层

| # | 本书要点（章节） | 精华内容摘要 | 技能包可落点 |
|---|---|---|---|
| P1 | 复杂性三症状（ch02） | 变更放大 / 认知负荷 / 未知的未知；总复杂度 C=Σcp×tp（按触碰频率加权） | code-smells-checklist 新增「复杂度症状」组 + verifier-spec readability 轴 |
| P2 | 战略式编程 + 10-20% 设计投资（ch03） | 战术式编程必然毁掉设计；每次任务附带设计投资，6-18 个月回本 | quality-standards「设计投资」节 + definition-of-done 条目 |
| P3 | 深模块 vs 浅模块 / 多类症（ch04） | 深=简单接口+强大功能；浅=接口不比实现简单；「类应该小」被推向极端成为多类症 | quality-standards「类设计规则」+ class-design 模板「深度优先于大小」判据 |
| P4 | 信息隐藏 / 信息泄露 / 时间分解（ch05） | 同一设计决策散落多模块=信息泄露（最重要危险信号）；按执行顺序切分=时间分解 | phase-4-detailed-design 类设计节 + code-smells-checklist 新增条目 |
| P5 | 通用模块更深 / 消除特殊情况（ch06） | 专用化是最大复杂性来源；特殊情况用统一规则覆盖 | phase-4 类设计规则 + code-smells「过度专用」条目 |
| P6 | 透传方法 / 装饰器过用 / 透传变量（ch07） | 只转发不增值=职责混淆；透传变量强迫中间层知道无关信息 | code-smells「中间人」升级 + context-management-guide 引用 ch07.5 |
| P7 | 下沉复杂性（ch08） | 接口简单比实现简单更重要；配置参数是「把难题推给用户的偷懒机会」 | phase-4「下沉复杂性检查」+ verifier-spec feasibility 轴 |
| P8 | 组合 vs 拆分四信号（ch09） | 共享信息/总是一起用（双向）/概念重叠/不看一段难理解另一段→组合 | quality-standards「类设计规则」补充判定信号 |
| P9 | 深方法：深度优先于长度（ch09.7/.8） | 拆分唯一理由是更清晰的抽象；连体方法危险信号 | code-smells F 组 + refactoring-catalog（与 Clean Code「函数要短」平衡） |
| P10 | 通过定义规避错误（ch10） | 异常是接口一部分；用语义重定义消除异常（unset→确保不存在） | class-design 方法定义「异常」列审查步骤 |
| P11 | 设计两次（ch11） | 每个主要设计决策考虑 ≥2 个备选方案；「聪明人一次做对」是幻觉 | phase-3/4 新增「备选方案对比」子步骤 + verifier-spec design 检查项 |
| P12 | 注释哲学三章（ch12/13/15） | 接口注释=抽象定义、须与实现注释分离；先写注释（设计工具） | format-conventions §5 + code-smells 组 C + phase-5「先写注释」步骤 |
| P13 | 命名三原则（ch14） | 精确性 / 一致性三要求 / 画面；难取名=设计不洁信号 | format-conventions §6 + code-smells 组 N |
| P14 | 修改现有代码保持战略式（ch16） | 每次修改让系统更像「一开始就设计成这样」；注释维护三法 | phase-5 编码纪律 + refactoring-catalog 头部注 |
| P15 | 一致性（ch17） | 认知杠杆；文档+自动工具+审查强制执行；「更好的想法不是引入不一致的借口」 | format-conventions 一致性条款（与 #3/#7 门禁脚本同向） |
| P16 | 易理解代码（ch18） | 软件应易于阅读而非易于编写；通用容器/类型不一致/超出期望造成困惑 | code-smells 新增条目 + verifier-spec readability 轴 |
| P17 | 性能设计（ch20） | 简单性=性能；改前测量；围绕关键路径设计、减少关键路径特殊情况 | performance-review 技能「设计期性能」前置节 + phase-4 |
| P18 | 决定什么是重要的（ch21） | 找杠杆点；最小化重要之事；突出/重复/中心化强调 | subagent-delegation（编排者职责）+ verifier-spec 概念完整性 |
| P19 | 危险信号总清单（summary） | 14 个危险信号=现成设计缺陷检测目录 | code-smells-checklist「APoSD 危险信号」组整体并入 |

### 2.2 GoF 设计模式——方案词汇与评审基准层

| # | 本书要点（章节） | 精华内容摘要 | 技能包可落点 |
|---|---|---|---|
| G1 | 模式四要素（1.1） | 名称/问题/解决方案/后果；「后果常被省略却决定取舍」 | interface-contract「Implementation Decisions」节升级为四要素决策记录格式 |
| G2 | 描述模板 13 节（1.3） | 名称/意图/动机/适用性/结构/参与者/协作/后果/实现/示例/已知应用/相关模式 | class-design 模板字段「撰写指引」（每节回答什么问题） |
| G3 | 方案必附权衡（各模式 Consequences） | 每个模式并列好处与代价 | class-design 新增必填「方案权衡」节 + verifier-spec feasibility 引用 |
| G4 | 目录组织（1.4-1.5） | 目的×范围二维分类；模式关系图；三种关联 | 新建 references/design-patterns-catalog.md（S 方案词汇表 + V 模式恰当性基准） |
| G5 | 如何选择（1.7 表 1.2） | 6 种选法；「考虑什么应可变」表（23 模式各自封装的变化点） | catalog 决策辅助节 + V 评审「变化点是否已封装」检查项 |
| G6 | 如何使用（1.8） | 8 步用法；「模式不应被不分青红皂白地应用」 | phase-4 模式落地 8 步 + V 评审「过度设计/为用而用」检查项 |
| G7 | 为变化设计 8 类原因（1.6） | 显式指定类/依赖特定操作/平台依赖/…/无法方便改类 → 各配模式清单 | verifier-spec architecture-soundness 评审检查清单 |
| G8 | 复用两原则（1.6） | 「面向接口编程」「优先组合而非继承」；白箱 vs 黑箱复用 | refactoring-catalog「目标结构」注解列 + code-smells「子类爆炸」条目 |
| G9 | 案例问题驱动格式（ch2） | 先列目标+约束再评候选方案，最后引出模式 | phase-3/4 算法步骤补充「目标+约束→方案→模式」叙述格式 |
| G10 | 三个可问评审判据（ch2） | 透明封装/子类爆炸、接口交集 vs 并集、Visitor 判据「哪个层次最常变化」 | verifier-spec 评审问题集 + phase-3 接口设计自检 |
| G11 | 模式对照表（各 Discussion 节） | Adapter(事后) vs Bridge(事前) vs Facade(新接口)；Composite vs Decorator 意图差异 | catalog「模式对照表」节（防「用错模式」最高频来源） |
| G12 | 模式是重构的目标（ch6） | 模式为重构提供目标；共同设计词汇表提高抽象层 | refactoring-catalog 补「目标结构」映射列（坏味道→手法→GoF 模式） |
| G13 | 附录 A 词汇表 | OO 术语权威定义（抽象耦合/委托/协议/白箱黑箱复用/acquaintance vs aggregation） | glossary.md 增补「OO 设计术语」分节 |

### 2.3 凤凰架构——架构决策与可靠性层

| # | 本书主题（文件） | 精华内容摘要 | 技能包可落点 |
|---|---|---|---|
| F1 | CAP 与一致性谱系（transaction/distributed） | C/A/P 三种取舍；强/弱/最终一致；BASE；刚性 vs 柔性事务 | phase-2 技术选型决策矩阵 + verifier-spec Architecture 轴 + tla-plus-guide 建模场景 |
| F2 | 分布式事务模式谱系 | 可靠事件队列/TCC/SAGA/AT；「无包治百病方案，因地制宜」 | tla-plus-patterns-examples（TCC/SAGA 状态机）+ phase-6 补偿路径测试 |
| F3 | 事务原理（local/global） | ARIES/WAL、隔离级别与锁、MVCC、2PC/3PC 缺陷、FLP | concurrency-guide（锁与隔离对照）+ phase-2 异常处理 |
| F4 | 微服务粒度边界（methodology/granularity） | 下界=独立+内聚+完备；上界=2 Pizza Team 一个周期；过细反噬 | phase-2/3 模块划分 + class-design 聚合边界 + design-contract 跨模块约束 |
| F5 | 微服务前提与动机（prerequest/objective） | 四前提（康威定律认知/技术专家/自治自动化/复杂性成主矛盾）；目的非性能 | phase-2 决策前置条件 + anti-patterns 候选「微服务动机不成立」 |
| F6 | 治理与复杂性（governance） | 认知负荷 O(k×N) + 协作成本（单体 O(N²) vs 微服务 O(NlogN)）；腐化不可避免 | graph-guide 量化论据 + quality-standards 架构腐化监控 |
| F7 | 架构演进史（architect-history） | 「能分布式≠应该分布式」；SOA 因过度复杂而败；微服务九特征 | verifier-spec Architecture 轴检查清单来源 |
| F8 | 容错策略（traffic-management/failure） | 7 种容错策略；断路器状态机（CLOSED/OPEN/HALF OPEN）；舱壁隔离；重试 4 前提 | tla-plus-guide 断路器建模 + quality-standards 容错检查 + phase-6/7 故障注入用例 |
| F9 | 流量控制（traffic-control） | TPS/HPS/QPS 辨析；限流四模式（计数器/滑窗/漏桶/令牌桶） | phase-2 决策矩阵 + phase-6/7 限流验证用例 |
| F10 | 可观测性三支柱（observability） | 日志=离散事件（4 反模式）；度量五类指标；追踪 Trace/Span | phase-7 观测性验收 + quality-standards 日志规范 |
| F11 | 安全纵深（system-security + secure） | 认证三层、RBAC96、OAuth2 四模式、JWT vs Cookie-Session、零信任五特征 | security-review 技能扩充 + verifier-spec Security 轴 + anti-patterns 凭据入库 |
| F12 | REST 契约与幂等（api-style） | REST 六原则、RMM 成熟度 0-3 级、HTTP 幂等语义 | design-contract D1-D4 校验规范来源 + phase-3 接口评审分级 |
| F13 | 共识算法（consensus） | Safety vs Liveness 定义；Raft 分解三子问题 | tla-plus-guide 术语（不变式=Safety）+ 建模方法论 |

### 2.4 失控——机制设计与说理层

| # | 本书章节 | 精华思想 | 技能包可落点 |
|---|---|---|---|
| O1 | 2 蜂群思维 | 蜜蜂决策=舞蹈加权投票+递增回报，无中心仲裁，涌现共识 | subagent-persona-matrix「证据加权共识」写入评审输出要求 |
| O2 | 2 蜂群思维 | 「运行系统是发现涌现结构的唯一且最短路径」 | anti-patterns 候选「以纸面理由替代真实门禁执行」（说理支撑约束 4/10） |
| O3 | 2 蜂群思维 | Swarm 五缺点（非最优/不可控/不可预测/不可理解/启动慢） | anti-patterns 候选「过度 swarm 化（无门禁的多代理自由发挥）」+ 人回路必要性说理 |
| O4 | 3 机器意欲 | Brooks 六步配方 + 五条经验（增量构建/模块独立层/去中心控制/稀疏通信/反射优先） | phase-5-coding 分层编码 + L1-L4 分层测试策略（只测新涌现层） |
| O5 | 7 控制的兴起 | 「调节器不关心原因，只检测偏差并纠正」；单一强门禁撬动全局 | verifier-spec / llm-verifier-integration-design 设计依据节 |
| O6 | 7 控制的兴起 | 二阶控制=元控制（第二回路设第一回路的目标范围） | SKILL.md 约束 8 说理段（编排者=第二回路） |
| O7 | 8 封闭系统 | 初始混沌期 60-100 天属常态；「适度多样性的封闭生态几乎从不失败」 | operational-recovery（集成初期混沌预期管理） |
| O8 | 11 网络经济学 | 「缺陷=已交付的错误」；poka-yoke 防错；错误聚集（见一错 23 潜伏）；超标丢弃重写 | workflow 返工循环说理 + iceberg-sweep 深挖点 + operational-recovery「超标重写」 |
| O9 | 11 网络经济学 | 不连续系统不可抽样外推（63.25mph 突然炸） | tla-plus-guide / bdd-guide 开篇「为什么」段落（穷举 vs 抽样） |
| O10 | 14 形态图书馆 | 爬山法=沿「越来越好」等高线必到顶峰；搜索空间足够大时搜索≈创造力 | hill-climbing-guide（Loop 4）+ skillopt-adoption 哲学基础 |
| O11 | 19 后达尔文主义 | 「自然选择是编辑者，不是作者」；「约束创造」；不追最优追多重目标 | verifier-spec（验证器=编辑者）+ quality-standards（硬约束=结构来源）+ definition-of-done 满意化 |
| O12 | 24 九条定律 | 分布存在/自底向上控制/培育递增回报/分块增长/最大化边缘/尊重错误/多重目标/持续失衡/改变改变自身 | 机制设计原则引用框架（去神学包装） |

## 3. 吸收决策记录

### 3.1 落地策略：阶段内强化（与先例一致）
- 选项：阶段内强化 / 新增子流程 / 双轨制 / 全量融合
- 选定：阶段内强化
- 理由：与「编排者最小化」约束最契合；四源 67 个吸收点绝大多数是方法论/规范/评审基准层，不新增子流程脚本，方法论由 S/V 子代理按文档执行

### 3.2 吸收深度：纯文档为主 + 少量机制联动
- 选项：纯文档 / 文档+可选脚本 / 强门禁
- 选定：纯文档为主；机制联动仅限 2 处候选（见 §5 需用户确认项）
- 理由：保持 self-test 基线（249）/ vitest（35 files / 530 tests）不破坏；G 子代理既有职责不变

### 3.3 优先级分轮（候选）
- **P0（设计质量层）**：APoSD P1/P3/P4/P8/P11/P12/P13 + GoF G1/G2/G4/G7/G8/G12 + 失控 O1/O2/O5/O6/O11 —— 与既有五轴评审/类设计/编码纪律直接互补，零冲突
- **P1（架构决策层）**：凤凰 F1/F4/F5/F8/F11/F12 + APoSD P7/P17 + GoF G5/G6/G10 —— 需新增/强化 phase-2/3 与 security-review 的检查节
- **P2（机制说理层）**：失控 O3/O4/O7/O8/O9/O10/O12 + 凤凰 F2/F6/F9/F10/F13 + APoSD P14/P15/P16/P18/P19 —— 多为说理注释与 checklist 追加组

### 3.4 明确不吸收（四源合计 28 项）

| 源 | 不吸收内容 | 理由 |
|---|---|---|
| APoSD | TDD 全面批判（ch19.4） | 与技能包 TDD 技能/W 模型「测试设计前置」冲突；只吸收「修复缺陷前先写失败测试」共识 |
| APoSD | 「类应该小」完全否定（ch04.6） | 与已吸收 Clean Code SRP 冲突；只吸收「深优先于小」平衡判据 |
| APoSD | 瀑布式模型批判（ch01） | W 模型是并行测试设计+返工路径，非其批判对象 |
| APoSD | 上下文对象整体采纳（ch07.5） | 作者自承「远非理想」；只吸收「透传变量是坏味道」诊断 |
| APoSD | 「让程序崩溃」通用策略（ch10.8） | W 模型强调错误处理完备性；仅作异常策略最后手段 |
| APoSD | 经验性数字硬编码（10-20%/注释≤10%） | 无实证来源；不得写入 schema/门禁硬阈值 |
| APoSD | Go 短命名风格批判（ch14.6） | 避免社区争议噪音 |
| APoSD | RAMCloud 特定工程决策（ch20.4） | 只吸收「围绕关键路径设计」一般方法 |
| APoSD | 前言/结论元论述 | 核心观点已由各章覆盖 |
| GoF | 各模式 C++/Smalltalk 示例代码 | 语言特定，与 TS/Python 技术栈无复用价值 |
| GoF | 附录 C 基础类实现 | 现代语言自带等价物 |
| GoF | 附录 B 过时 OMT 图形记号 | 已被 uml-modeling 覆盖 |
| GoF | 第 6 章历史/社区叙事 | 纯背景，无方法论增量 |
| GoF | 语言能力差异讨论（CLOS/Smalltalk 泛型） | 与 TS 无关 |
| GoF | Interpreter/Flyweight/Memento 细节正文 | 目录收录意图即可；与技能包机制无协同点 |
| GoF | Singleton 实现细节与争议 | 现代共识倾向 DI/容器；仅保留目录条目 |
| 凤凰 | K8s/容器/网络/存储实操 | 与技能包方法论定位不符 |
| 凤凰 | 具体工具/框架选型罗列 | W 模型保持工具中立；只保留承载的决策框架 |
| 凤凰 | 过深底层实现细节（ARIES/TLS 握手/X.509） | 只保留决策层语义 |
| 凤凰 | 历史/背景叙事（DCE/容器战争/Paxos 轶事） | 只吸收结论性教训 |
| 凤凰 | 占位文档（pattern/、concurrent/ 等 20+ 文件） | 本书未完成章节，无内容可吸收 |
| 凤凰 | 共享事务 share.md | 书中自评「更可能是伪需求」；仅作反面教材 |
| 失控 | 纯生物学/实验细节 | 机制已提炼，具体数据无操作价值 |
| 失控 | 宗教/神学/神秘主义叙事 | 保留内核剥神学外衣 |
| 失控 | 「绝对失控」倾向 + Lamarckian 优越主张 | 与「受控的失控」+ Loop 4 人审手动应用冲突 |
| 失控 | 「系统整体不可理解」消极面 | 与白箱优先冲突；只吸收「用可观测输出代替全知理解」 |
| 失控 | 过时技术与时代内容（90 年代预言） | 只保留机制原则 |
| 失控 | 电子货币/工业生态学等无关章节 | 主题距离软件工程太远 |

## 4. 与现有约束/反模式的关系

### 4.1 强化现有约束
| 约束 | 强化点 | 来源 |
|---|---|---|
| 约束 1（测试设计前置） | 设计两次/问题驱动格式为「设计完整性」提供方法 | APoSD ch11 + GoF ch2 |
| 约束 4（真实执行） | 「运行系统是发现涌现结构的唯一最短路径」说理 | 失控 ch2 |
| 约束 6（按需加载） | 复杂三症状「认知负荷」为按需加载提供理论依据 | APoSD ch2 |
| 约束 8（编排者最小化） | 元控制（第二回路）+ 蜂群无中心仲裁 + 「育种者只选择不生成」 | 失控 ch7/2/15 |
| 约束 13（TLA+ 行为门禁） | 不连续系统不可抽样 → 穷举/模型检查必要性；Safety/Liveness 术语来源 | 失控 ch11 + 凤凰 consensus |
| 约束 9（门禁退出码不可伪） | poka-yoke 防错装置类比 | 失控 ch11 |
| 约束 13（BDD 行为门禁） | 「先写注释」=抽象先行 → BDD 前置设计 | APoSD ch15 |
| 约束 3（RTM 回填） | 错误聚集/超标丢弃 → RTM 覆盖度深挖 | 失控 ch11 |
| 约束 14（回归强制钩子） | 「修改现有代码保持战略式」+ Brooks「做对了就别动它」 | APoSD ch16 + 失控 ch3 |

### 4.2 候选新增反模式（须人审确认，参照候选反模式生命周期 §11）
- **APoSD-α**：复杂性增量累积（每个小改塞一点复杂性，累积不可控）——与 #47 反向呼应
- **GoF-α**：模式装饰性引用（引用模式名但无参与者/意图/权衡支撑，即「橡皮图章」）——类比 #16 占位实现
- **凤凰-α**：微服务动机不成立（为性能/潮流而拆分）——四前提前置校验
- **失控-α**：过度 swarm 化（无门禁的多代理自由发挥）——clockware/swarmware 选择法则
- **失控-β**：以纸面理由替代真实门禁执行（用评审意见替代 exitCode）

### 4.3 不弱化现有反模式
- 反模式 #10（编排者越权）：失控「育种者只选择不生成」反证 O 不实施
- 反模式 #16（TLA+ 占位）：GoF 模式装饰性引用与之类比，不同域
- 反模式 #18（跳过 R 直接 S）：失控「错误聚集/超标丢弃」支持 R 深挖而非直接修
- 反模式 #47（大规模重构）：APoSD「战略式编程」是其正面表述，不冲突

## 5. 需用户确认的决策点（进入 spec 前）

1. **新建 references/design-patterns-catalog.md**（GoF 三件套之一，与 refactoring-catalog/code-smells-checklist 同族）——规模约 23 模式条目 + 对照表 + 决策辅助节
2. **2 处机制联动候选**：① class-design 模板新增「方案权衡」必填节（需同步 templates + check-design-contract 或 gate-logic 字段检查）；② code-smells-checklist 新增 APoSD「复杂度症状」组 + GoF「子类爆炸」等条目（纯文档，无需脚本）
3. **5 条候选反模式是否正式入册**（#48 起编号），或按候选生命周期先入 Loop 4 待验证
4. **分轮落地**：P0 → P1 → P2（每轮一个计划循环，参照三源吸收 P0/P1/P2 先例）
5. **文档同步范围**：SSoT §3.4.41 新增节 + references/ 新增/强化 8-10 个文件 + SKILL.md 版本号 + CHANGELOG

## 6. 不做的事

- 不新增 check-*.ts 脚本（除 §5.2 待确认的模板字段联动）
- 不改 self-test 基线（249）/ vitest 数量（35 files / 530 tests）基线
- 不改既有 #1~#47 反模式语义（新增另计）
- 不改 verifier-spec.md 五轴/子标准权重结构（只增评审问题与说理引用）
- 不改 schemas/*.json 强制字段（除 class-design 模板候选）
- 不把「必须用设计模式」写成硬约束（GoF 自身警告过度设计）
- 不引入无实证来源的数字作为硬阈值（APoSD 经验比例仅作参考表述）
- 不改 docs/changes/archive/**
- 不吸收神学/宗教修辞（失控），不吸收工具/框架罗列（凤凰）

## 7. 未来扩展（非本轮）

- design-patterns-catalog 若需强门禁：可后续扩展「模式引用必须附权衡声明」为字段级校验
- 微服务粒度判定若需固化：可后续在 phase-2 决策矩阵中增加 check 脚本维度的「拆分边界自检」
- 失控「九条定律」若需落地：可作为 skillopt-adoption / 机制设计原则附录

## 9. 批次 A（P0，41.0.0）落点明细

> 注：本表列批次 A 主要落点（含 #15-#18 补充项），与 §3.3 P0 候选清单的组成差异属实施期范围调整。

| # | 吸收点 | 落地文件 | 落地内容 |
|---|---|---|---|
| 1 | 复杂三症状（APoSD P1） | code-smells-checklist.md | 组 X（X1-X3）+ verifier-spec readability 三信息来源 |
| 2 | 深/浅模块 + 多类症（P3） | quality-standards.md | 深度优先于大小 / 多类症警报 |
| 3 | 信息隐藏/泄露/时间分解（P4） | phase-4 + code-smells | 信息隐藏检查 / 信息泄露（后门型）/ 时间分解条目 |
| 4 | 通用模块更深/消特殊情况（P5） | code-smells | 过度专用 / 特殊情况爆炸条目 |
| 5 | 透传方法/变量（P6） | code-smells | 中间人升级 / 透传变量条目 |
| 6 | 下沉复杂性（P7） | phase-4 | 下沉复杂性检查 |
| 7 | 组合 vs 拆分四信号（P8） | quality-standards | 四信号 |
| 8 | 深方法优先于长度（P9） | code-smells 组 F | F5 + 两源平衡注 |
| 9 | 通过定义规避错误（P10） | phase-4 + class-design | 异常策略三选项 / 异常列审查提示 |
| 10 | 设计两次（P11） | phase-3 + phase-4 + verifier-spec | 备选方案对比步骤 + 评审检查项 |
| 11 | 注释哲学（P12） | format-conventions + code-smells | 接口注释清单 / 分离规则 / 先写注释 / 实现文档污染接口 |
| 12 | 命名三原则（P13） | format-conventions | 一致性三要求 / 难取名警报 |
| 13 | 方案必附权衡（GoF G3） | class-design 模板 | 「方案权衡」必填列 |
| 14 | 候选反模式登记 | anti-patterns.md | 四源-α/β/γ/δ 入候选区 |
| 15 | 战略式编程/设计投资（APoSD P2） | quality-standards | 「设计投资」节（10-20% 参考表述） |
| 16 | 问题驱动叙述格式（GoF G9） | phase-3 | 「问题驱动叙述格式」节（目标+约束→方案→权衡） |
| 17 | 接口交集 vs 并集自检（GoF G10） | phase-3 | 步骤 1「接口交集 vs 并集自检」 |
| 18 | 概念完整性提问（APoSD P18） | verifier-spec | §7.2 design 评审「概念完整性提问」 |


---

# 人月神话吸收（原 `references/mythical-man-month-absorption.md`）

# Mythical Man-Month Absorption（人月神话吸收决策记录）

> 吸收源：《agent 时代的人月神话》（Brooks《人月神话》2026 年逐章重写，19 章，agent-mythical-man-month-2026）。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.39 + 各 reference 新增节为准；本文件为吸收映射与决策回溯。
> 设计 spec：`docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md`。

## 1. 吸收源清单

| 章 | 主题 | 吸收批次 | 落点 |
|---|---|---|---|
| 00-序 / 16-18 | 判断的组织 / 人机分工线 / 停机问题 | P0-4 | [design-philosophy.md](design-philosophy.md)「人机分工线」节 |
| 01 焦油坑 | 九倍矩阵（产品化×系统集成） | P0-3 | DoD「完成度矩阵自检」+ phase-5/6 任务分配 |
| 02 人月神话 | 并行三闸 / 通读测试 / 验证账单 / 反指标游戏 | P0-1 + P1 | 反模式 #45 + dispatching-parallel-agents |
| 03 外科手术队伍 | 主刀 / 支持角色 / 审计权 vs 修正权 | P0-2 | 反模式 #46 + subagent-delegation「主刀职责映射表」 |
| 04 贵族专制 | 概念完整性 / Goodhart | P0-1 支撑 | 反模式 #45 说理 |
| 05 画蛇添足 | 提示词最小化 / 预算纪律 | P1（39.1.0） | writing-skills / budget |
| 06 贯彻执行 | 原文装填 / 记叙性优先 / 结构性约束 / 独立评审 | P1（39.1.0） | subagent-delegation / bdd-guide / SKILL.md |
| 07 巴比伦塔 | 入职材料四件套 / 信息隐藏分层 | P1 支撑 | AGENTS.md / context-management |
| 08 胸有成竹 | 估算纪律 / 记账 / mini-spike | P2（39.2.0） | estimation-guide.md（新建） |
| 09 削足适履 | 上下文管理 / KV 缓存 / 档位路由 | P2（39.2.0） | context-management-guide.md（新建） |
| 10 提纲挈领 | 文档即源码 / 决策记录 | 已有机制强化 | SSoT §3.4.39 |
| 11 未雨绸缪 | 侦察 vs 产出 / 辩解义务 / 会话生命周期 / 回归强制 | P1 + P2（39.1.0/39.2.0） | hill-climbing-guide / root-cause-locator / operational-recovery / 约束 #14 |
| 12 干将莫邪 | harness 工程 / 交互式 vs 批处理 | P1 支撑 | SKILL.md 工具选型 |
| 13 整体部分 | Vyssotsky / 环境契约自检 / 增量集成 | P1（39.1.0） | quality-standards / phase-5-coding |
| 14 祸起萧墙 | 里程碑不可自欺 / 止损三规则 / 预注册 | P1 + P2（39.1.0/39.2.0） | operational-recovery / writing-plans |
| 15 另外一面 | 先讨论后动手 / 目的注释 | P2（39.2.0） | format-conventions |
| 16-18 没有银弹 | 本质困难 / 白箱黑箱 / 判据持有审计 | P1/P2 + P3 候选 | SKILL.md / 后续轮 |

## 2. 吸收决策记录

### 2.1 落地策略：纯文档为主 + 少量脚本联动
- 选定：纯文档为主；脚本联动仅限反模式计数 44→46（`docs-consistency-logic.ts` + 测试样本）
- 理由：与"编排者最小化"及既往吸收先例（external-skills-absorption）一致；23 项中 21 项是方法论/规则

### 2.2 优先级分轮
- P0（39.0.0）：反指标游戏 #45 / 主刀与修正权 #46 / 九倍矩阵 / 人机分工线
- P1（39.1.0）：并行三闸 / 原文装填 / 记叙性优先 / 结构性约束 / 独立评审 / 止损三规则 / 会话生命周期 / 辩解义务 / 回归约束 #14 / 环境契约自检（已实施）
- P2（39.2.0）：estimation-guide / context-management-guide / 白箱黑箱 / 里程碑元规则 / 侦察vs产出 / 目的注释（已实施）
- P3（候选）：银弹批判框架 / 判据持有审计 / worktree 警示

### 2.3 明确不吸收
- 不把"全自动 agent 系统必然失败"的立场性批判设为硬约束（仅说理层与边界注释）
- 不新增门禁脚本（九倍矩阵可脚本化项列为二期候选）

## 3. 与现有约束/反模式的关系

### 3.1 新增反模式（2）
- #45 反指标游戏：subagent 为通过测试而修改断言/测试期望
- #46 只给审计权不给修正权：全自动流程把用户锁在"跑完再看"之外

### 3.2 新增约束（P1 批）
- 约束 #14 回归测试强制钩子：任何 agent 改动代码后必须跑回归测试

### 3.3 不弱化现有反模式
- 反模式 #10（编排者越权）：修正权属于用户（人侧），O 仍不实施（agent 侧），两层互补不冲突
- 反模式 #18（跳过 R 直接 S 返工）：#45 的归因流程复用 R→V→G，不绕过返工循环

## 4. 立场冲突处理

| 冲突点 | 处理 |
|---|---|
| dispatching-parallel-agents 原允许"调整测试期望" | P0 修订为"不得改断言凑通过"（与 #45 一致） |
| 编排者最小化 vs 修正权 | 层级区分：O 不实施（agent 侧）vs 用户保留修正权（人侧），写入 SKILL.md |
| worktree 使用 | 书中持悲观态度（"各持现实副本漂移"）；列为 P3 候选，待用户确认取舍 |

## 5. 不做的事

- 不改 verifier-spec.md Schema / schemas/*.json / templates/* / subagent/* 人格
- 不改既有 #1~#44 反模式语义（#45/#46 为新增）
- 不改 self-test 基线（249）/ pre-push 项数（14）
- 不改 docs/changes/archive/**


---

# 外部技能吸收（to-tickets / to-spec / OpenSpec）（原 `references/external-skills-absorption.md`）

# External Skills Absorption

> 三源（to-tickets / to-spec / OpenSpec）吸收决策记录。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.8 / §4A.1 / §11A + 各 `phase-N-*.md` 新增节为准；本文件为吸收映射与决策回溯。

## 1. 吸收源清单

| 源 | URL | 吸收日期 | 吸收范围 |
|---|---|---|---|
| to-tickets | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md | 2026-07-26 | tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract |
| to-spec | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md | 2026-07-26 | seam-first testing + User Stories 长列表 + Out of Scope + Implementation/Testing Decisions 分离 |
| OpenSpec | https://github.com/Fission-AI/OpenSpec | 2026-07-26 | 四产物结构映射 + archive 机制 + brownfield 适配 + context hygiene |

## 2. 吸收决策记录

### 2.1 落地策略：阶段内强化
- 选项：阶段内强化 / 新增子流程 / 双轨制 / 全量融合
- 选定：阶段内强化
- 理由：与"编排者最小化"约束最契合，不新增子流程脚本，方法论由 S 子代理按文档执行

### 2.2 吸收深度：纯文档
- 选项：纯文档 / 文档+可选脚本 / 强门禁
- 选定：纯文档
- 理由：不破坏现有 self-test 基线（91 条），不新增 check-tickets.ts，G 子代理既有职责不变

### 2.3 Brownfield 适配：补充 adoption-guide
- 选项：补充 adoption-guide / 阶段1加分支 / 本轮不做
- 选定：补充 adoption-guide
- 理由：不改阶段主流程，brownfield 路径作为 SSoT §11A.5 子节，与 greenfield 并列

## 3. 三源 → W 模型阶段映射表

| OpenSpec 产物 | W 模型阶段 | W 模型对应产物 | 备注 |
|---|---|---|---|
| proposal.md | 阶段 1 | requirement-spec.md 的「问题陈述+解决方案+User Stories+Out of Scope」节 | 第 4 节强化 |
| specs/ | 阶段 1 | RTM 需求行 + acceptance-test-cases.md | 不变 |
| design.md | 阶段 2-4 | system-design.md + outline-design.md + detailed-design.md | 不变 |
| tasks.md | 阶段 5 | tickets.md（新增） | 第 6 节强化 |
| archive/ | 阶段 8 | changes/archive/YYYY-MM-DD-<feature>/（新增） | 第 7 节强化 |

## 4. 三源精华 → 阶段产物分布

### 4.1 阶段 1（[phase-1-requirements.md](phase-1-requirements.md) 新增节）
- User Stories 长列表（to-spec）
- Out of Scope 显式声明（to-spec）
- Implementation/Testing Decisions 分离（to-spec）

### 4.2 阶段 2-4（phase-2/3/4-*.md 新增「测试 seam 决策」节）
- Seam-first testing 决策（to-spec）
- 三层 seam 一致性约束（to-spec）
- 与 TLA+ 行为门禁正交（已有约束 13）

### 4.3 阶段 5（[phase-5-coding.md](phase-5-coding.md) 新增「Tracer-bullet 票据拆解」节）
- 票据清单 + blocking edges（to-tickets）
- Wide refactor expand-contract（to-tickets）
- 票据内容契约（to-tickets）
- Out of 票据化例外（to-tickets + OpenSpec easy not complex）

### 4.4 阶段 8（[phase-8-acceptance-test.md](phase-8-acceptance-test.md) 新增「archive 机制」节）
- archive 路径 + 产物清单（OpenSpec）
- archive 规则（OpenSpec + to-spec 路径禁用）

### 4.5 adoption-guide（SSoT §11A.5 + [adoption-guide.md](../../docs/adoption-guide.md)）
- Brownfield 适配路径（OpenSpec）

## 5. 与现有约束/反模式的关系

### 5.1 强化现有约束

| 约束 | 强化点 | 来源 |
|---|---|---|
| 约束 1（测试设计前置） | seam 决策是测试设计的前置输入 | to-spec |
| 约束 5（Maintain Scope Discipline） | Out of Scope 显式声明 + brownfield 不重构无关历史代码 | to-spec + OpenSpec |
| 约束 6（按需加载） | context hygiene 提示性补强（阶段切换新会话） | OpenSpec |
| 约束 8（编排者最小化） | S-tickets 由 S 兼任，编排者只按 frontier 路由 | to-tickets |
| 约束 13（TLA+ 行为门禁） | TLA+ 不变式断言覆盖私有状态机，不在代码层引入测试 seam | to-spec |

### 5.2 不引入新约束
- 三源吸收不新增硬红线（保持 19 条约束 + 19 条反模式 + 10 条失败模式不变）
- 新增节是"操作行为"层面（违反不回退，降低质量），不是"硬约束"层面（违反回退）
- §4A.1 第 7 行「Choose Highest Seam」是操作行为，不是硬约束

### 5.3 不弱化现有反模式
- 反模式 #10（编排者越权）：S-tickets 拆解由 S 执行，编排者不越权
- 反模式 #18（跳过 R 直接 S 返工）：票据化不绕过返工循环
- 反模式 #16（TLA+ 占位）：seam 决策不替代 TLA+ 行为门禁

## 6. Verifier 评审影响

### 6.1 不改 verifier-spec.md
- §7.1-§7.5 既有 5 轴评审不变
- 4 targetKind × 5 项标准颗粒度不变
- rawScores 自然波动校验不变

### 6.2 V 子代理引用方式
- V 子代理在 summary digest 时引用各 phase-N-*.md 新增节作为完整性检查项
- 不新增 subCriteria（保持 coverage/correctness/independence/clarity/priority-reasonableness 5 项）
- 不新增 targetKind（保持 requirement/design/code/test/rootcause 5 类）

## 7. 不做的事

- 不新增 check-tickets.ts 脚本（纯文档吸收）
- 不改 check-artifact-gate.ts（不新增票据维度校验）
- 不改 self-test 基线（91 条不变）
- 不改 RTM schema（archivePath 为可选字段，不破坏现有 schema）
- 不改 verifier-spec.md（V 子代理引用方式不变）
- 不改 subagent-delegation.md 角色划分（S-tickets 由 S 兼任）
- 不改 data-models.md 强制字段（archivePath 可选）

## 8. 未来扩展（非本轮）

- 若票据拆解需强门禁：可后续新增 check-tickets.ts（校验 DAG 无环 + frontier + 垂直切片）
- 若 archive 需校验：可后续扩展 check-artifact-gate.ts 校验 archivePath
- 若 brownfield 需独立流程：可后续新增 references/brownfield-guide.md


---

# 三源吸收（Clean Code / Refactoring 2 / Agentic DP）（原 `references/clean-code-refactoring-agentic-absorption.md`）

# Clean Code / Refactoring 2 / Agentic Design Patterns Absorption（三源吸收决策记录）

> 吸收源：《代码整洁之道》（Clean-Code-zh，17 章 + apA）、《重构 2》（Refactoring2-zh，12 章）、《Agentic Design Patterns》（21 章 + 附录）。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.40 + 各 reference 新增节为准；本文件为吸收映射与决策回溯。
> 设计 spec：`docs/superpowers/specs/2026-08-10-three-source-absorption-design.md`。

## 1. 吸收源清单与落点（P0 批次）

| 源 | 精华 | 落点 |
|---|---|---|
| Refactoring ch3 | 24 种坏味道 → 评审清单 | chinese-code-review + code-smells-checklist |
| Clean-Code ch17 | 六组启发式 C/E/F/G/N/T | code-smells-checklist（新建） |
| Clean-Code ch2 | 命名规则 | format-conventions §6 |
| Clean-Code ch3/ch7 + Refactoring ch11.1 | 函数/错误处理规范 | quality-standards + phase-5 禁止行为 #9-#13 |
| Clean-Code ch9 + Refactoring ch4 | 测试代码整洁 / 测试构筑 | quality-standards + TDD 技能 |
| Refactoring ch4.7 + Clean-Code ch16 | 复现测试 / 覆盖空洞 | root-cause-locator §2.5 |
| Refactoring ch10.6 | 断言规范 | phase-5「断言规范」 |
| Refactoring ch2 | 重构纪律（两顶帽子/三次法则/何时不重构） | phase-5「重构纪律」 |
| Clean-Code ch14 | 大规模重构反模式 | anti-patterns #47 |
| Clean-Code ch8 | 第三方边界/学习性测试 | phase-5「第三方边界」 |
| Clean-Code ch13 + apA | 并发 | 批次 C：concurrency-guide（P2） |
| Refactoring ch6~ch12 | 重构手法速查 | 批次 C：refactoring-catalog（P2） |
| agentic Ch19 | 轨迹符合性 | run-log-logic R8 |
| agentic Ch19 | 承包商协商反馈 | subagent-delegation「简报质疑权」 |
| agentic Ch7+Ch19 | 协作质量四问 | verifier-spec R14-R17 |
| agentic Ch13 | HOTL 规则化授权 | operational-recovery |
| agentic Ch10/14/16/17/18/20 + Clean-Code ch4/ch6/ch10 + Refactoring ch2.6/2.8 | P1/P2 条目 | 批次 B/C 计划 |

## 2. 吸收决策

- 落地策略：分批（P0/P1/P2 各一个计划循环）；纯文档为主 + 2 处脚本联动（R8 轨迹模板、docs-consistency 期望值）。
- 坏味道/并发检查：双轨（语言静态工具 + LLM 语义评审），**不新增自研 AST 扫描脚本**（用户确认）。
- 优先级：P0（本批 16 项）→ P1（批次 B，40.1.0）→ P2（批次 C，40.2.0）。

## 3. 明确不吸收

- agentic：完整辩论框架/RL 训练/SICA 自改工具链/网络模型/多层 supervisor/完整 RAG/A2A/MCP 实现。
- Clean-Code：教学示例代码（ch14-16）/Java 特定（checked exception、EJB、JDBC）/组织政治叙事。
- Refactoring：教学示例（ch1）/组织政治（ch2.4）/Java/语言特定风格偏好/"函数 6 行硬阈值"。

## 4. 与现有约束/反模式的关系

- 新增反模式 #47（大规模重构）；不修改 #1~#46 语义。
- 新增约束 #14 之外无新硬约束（全部为操作行为/规范层）。
- R8 与 R7 互补（时序→轨迹）；不替代反模式 #18（R8 是轨迹检测，反模式 #18 是流程回退）。
