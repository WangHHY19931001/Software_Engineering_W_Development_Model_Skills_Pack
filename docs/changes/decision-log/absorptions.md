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

---

# 第五源吸收（dsh-normify / Normify 归一化框架图构建器）

> 吸收源：[`yan-mc/dsh-normify`](https://github.com/yan-mc/dsh-normify) v0.5.4（MIT）——DSH 插件，含 `skills/normify-gen/SKILL.md`（生成器技能）+ 31 个 `normify_*` 工具 + 确定性引擎（三层校验 / SHA-256 冻结编译 / 单文件渲染器）。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §10.10.1（R16 节点 id 唯一）与 §10L.2（R15f 行号锚点越界）为准；本文件为吸收映射与决策回溯。
> 调研方式：源 SKILL.md + README 全文精读，配本仓库三路并行盘点（设计产物结构规则 / 门禁登记成本 / 机制等价物对照），落地项均先做缺陷复现或对照再实现。

## 1. 吸收源形态

| 维度 | Normify 的做法 |
|---|---|
| 数据模型 | 分形模块树：每个模块结构完全相同（Markdown + 强制 frontmatter）；只存 `parent`，`children` 编译期派生；API 只存叶子；路径式 `id` + 不变 `uid` |
| 证据 | `source: [{path, line, end_line}]` 代码锚点 + `fingerprint`（源文件字节 SHA-256）+ `revision`（git SHA） |
| 校验 | L1 写时（每次 upsert）/ L2 全项目（`validate`，0 error 门禁）/ L3 冻结（`build` 出 SHA-256 回执） |
| 规则 | `policy.yml` 声明式架构规则（依赖方向 / 禁依赖 / 无环 / 深度 / 跨树 / 命名），设计阶段先行、违规先改设计 |
| 生命周期 | `state: planned \| active \| deprecated` + `replacement` 指针；禁止「假激活」（源码未落地即拒） |
| 伴随流程 | `change_open → brief → check → 计划态建树 → 实现 → refresh(activate) → change_close`（0 error 强制，create 未落地拒关单） |
| 增量 | 只读规划器 `sync`：changed_files / affected / drift_fingerprints / layouts_to_review；**深到浅**重建（叶子重读代码、容器改摘要、祖先只复核统计） |
| 粒度 | 可证伪判据：`source` 覆盖 ≥3 文件 / 单文件跨度 ≥300 行 / 混 ≥2 独立职责 / API ≥6 可分组 → 继续拆；每叶 3–5 API |
| 诊断 | 每条诊断带 `severity / code / message / subject / evidence / supportedFixes`；批量失败给 `root_causes` 指向根因码 |

## 2. 逐项判定

| # | Normify 机制 | 本仓库盘点结论 | 判定 |
|---|---|---|---|
| N1 | `uid` / `id` 全项目唯一 | `graph-guide.md` 散文写「全局唯一」，实现零强制：重复 id 被 `Set` 静默合并，门禁仍判 `passed`（**已复现**，见 §3.1） | **吸收** → R16 |
| N2 | 代码锚点 `path`+行号 + 字节指纹 + 漂移检出 | `evidenceAnchor` 支持 `path:L42-58` 但只验 path 存在、**不验行号**；无内容指纹 | **部分吸收** → R15f（可证伪的那一半）；内容指纹列候选 V1 |
| N3 | 三层校验（L1 写时 / L2 全项目 / L3 冻结回执） | `wm-write`（写时校验 + 锁 + CAS）+ 46 门禁 + `evidence-manifest` SHA-256 已具备 | 不吸收（已具备） |
| N4 | `policy.yml` 声明式架构规则 | 图层语义（REQ→SD→INTF→DD 单调、无环、`governs`/`derives` 源类型）为方法论**内建硬编码**；无项目可声明规则 | 候选 V2（理由见 §4） |
| N5 | `state: planned/active/deprecated` + `replacement` | `evidenceStatus: pending/confirmed`、豁免审批、票据 `status` 已有；**设计产物无生命周期与替代指针** | 候选 V3 |
| N6 | 变更闭环（`change_close` 0 error 强制、create 未落地拒关单） | run-log + checkpoint + signature-chain + artifact-gate 的 SD→codeModule 终检已具备 | 不吸收（已具备） |
| N7 | 零容忍 + 「空操作不得报成功」（v0.5.4 修 `patch` 静默 no-op） | fail-closed 文化强（空输入致死、白名单零命中 exit 2）；**唯一 vacuous 点**是覆盖率空集维度重算为 100% | **部分吸收** → 空集维度显式化（不升 violation） |
| N8 | 诊断码因果链（`dep/target-dropped` → 根因码 + `root_causes`） | `rootCauseChain` / `basedOnReport` / `same-root-cause-spread` + R 子代理方法论已具备 | 不吸收（已有更强） |
| N9 | 增量再生成规划器（只读 `sync`） | `change-scope.json` + codegraph 覆盖门禁（`check-codegraph-queries` 逐文件 coverage）已具备 | 不吸收（已具备） |
| N10 | 渲染数据 `renders/` 与可读性配方 | 本仓库产物为 Markdown + mermaid，R7-R14 只校验 mermaid 配平；**不承载渲染器** | 不吸收（域外） |
| N11 | 几何自检（线不出界/不贴框/不穿框/不压线） | 同上，无渲染器 | 不吸收（域外） |
| N12 | 双语 `name`/`description` 强制非空 | 本仓库单语（中文） | 不吸收（域外） |
| N13 | `help` 分主题渐进披露 | `asset-authoring.md` §4 渐进披露判据 + `command-reference.md` 已具备 | 不吸收（已具备） |
| N14 | 规模不设上限、「token 成本不是收尾的理由」 | `check-budget` 的 `onExceed` / `killSwitch` 把预算越界转为**显式 CHECKPOINT**（`operational-recovery.md`） | 不吸收（**设计冲突**，见 §4） |
| N15 | 深到浅增量复核阶梯 | 无对应条文（冰山扫掠管「深挖」，不管「浅复核深度分层」） | 候选 V4（受「授权不写」约束，见 §5） |
| N16 | 结构粒度自诊断（`leaf-too-coarse` / `shallow-hierarchy`） | 仅散文启发式（25 词职责测试、~40 行、30% 重叠率**未实现**）+ 边数下限 warning | 候选 V5（受「授权不写」约束，见 §5） |
| N17 | 错误信息具体化（点名第 N 条 + 收到值 + 正确形状） | `ERROR_JSON` 已带 `rule` / `field` / `detail` | 不吸收（已具备） |

## 3. 落地的三项

### 3.1 R16 节点 id 全局唯一（`graph-logic.ts` + `check-requirement-graph.ts`）

- **吸收动机**：N1 + N7 合流——「唯一性写在文档里、实现零强制」与「看起来校验了、其实被合并了」是同一类静默假成功。
- **复现**（修复前）：`valid-warnings.json` 加一个与 `REQ-004` 同 id 的节点 → `totalNodes: 5` 而唯一 id 仅 4，门禁 `passed: true`、exit 0，且 `levelDistribution` 出现 `{"4": 2}`（同一 id 承载两个节点）。
- **判据**：在构建 id 集合**之前** `findDuplicateIds(nodes[].id)`，命中即 violation（含 `duplicateNodeIds` 字段供 Agent 定位）。
- **为何是 violation 而非 warning**：合并后的判定单元让父唯一性/孤立/环/信息流互相抵消，门禁给出的 `passed` 是**错的**，不是"不精确的"。

### 3.2 R15f 行号锚点越界（`graph-logic.ts` + `check-requirement-graph.ts`）

- **吸收动机**：N2 的可证伪子集。修复前 `evidenceAnchor: 'x.ts:L99999=…'` 通过门禁——锚点在断言一个不存在的行，「证据」退化成「看起来像证据的字符串」。
- **判据**：行号锚点（`L42` / `L42-58`）须满足 `1 ≤ start ≤ end ≤ 文件内容行数`；越界或区间倒置为 violation。行数按**内容行**计（末尾换行不多算一行），否则 `:L<末尾+1>` 会被误放行。
- **注入面**：logic 层不做 I/O，由 CLI 读盘注入 `anchorLineCounts`（仅对行号锚点读文件）；未注入或 path 不可读即跳过，不误红（与既有 R15c/R15e 同构）。
- **判据边界（诚实声明）**：只判「行号是否落在文件内」，**不判**「该行内容是否支持 `=statement`」——后者是语义判断，仍由 V 评审核验。

### 3.3 覆盖率空集维度显式化（`coverage-logic.ts` + `check-requirement-coverage.ts`）

- **吸收动机**：N7。空集的重算值是 100%（`vacuously true`），与「确实全覆盖」在数值上不可分；报告里的 100% 若来自空集而被读成"已覆盖"，就是「零命中当通过」。
- **做法**：新增 `vacuousDimensions` 字段 + 警告项 + CLI 人类可读行。**不升级为 violation**——非空约束已由 C1/C3/C5（数组非空）与 C7b（`crossCuts` 空且无 `--graph` 时 fail-closed）分别处置，改判会与既有语义冲突。
- **可达性**：项目确实无横切需求、且 graph 亦无 `cross-cuts` 边时，`crossCut` 维度即为空集——无需任何豁免即可到达。

## 4. 明确不吸收（含理由）

- **N14 规模不设上限 / 「token 成本不是收尾的理由」**：Normify 禁止因预算提前收尾；本仓库把预算越界转为 `onExceed: pause|notify|halt` + `killSwitch` 强制的 🔴 CHECKPOINT，由人类裁定。二者不可同时成立。保留本仓库立场——**静默续跑会把成本失控藏在流程里**，而 CHECKPOINT 让它可见；这正是本项目「不可绕过的人工闸门」设计的一部分。
- **N10 / N11 渲染数据与几何自检**：本仓库不承载渲染，产物止于 Markdown + mermaid（仅有配平校验）。可读性配方与几何断言没有消费方，吸收即制造无人使用的资产。
- **N12 双语强制**：本仓库单语，无对应字段。
- **N13 分主题 `help`**：已由 `asset-authoring.md` §4 渐进披露判据 + `command-reference.md` 覆盖，重复引入是 duplication。
- **N8 诊断级因果链**：本仓库的根因承载在 **R 子代理方法论 + RootCauseReport schema + run-log 报告绑定**（`rootCauseChain` / `basedOnReport` / `same-root-cause-spread`），比"诊断码之间连边"更完整；再加一层会形成第二套根因事实源。
- **N4 `policy.yml` 声明式架构规则（降级为候选 V2，非拒绝）**：它的定义域是**代码模块依赖方向**；本仓库该领域由 codegraph 影响分析（约束 #14）+ 阶段 5-8 门禁承担，而图谱门禁管的是需求→设计追溯结构。引入需新 schema + 门禁逻辑 + 模板 + 计数同步，收益与既有 codegraph 机制重叠，且当前处于收口期，不宜扩面。

## 5. 候选（本轮不做，附可证伪的验证方法）

| 编号 | 候选 | 为何本轮不做 | 验证方法（做之前先取证据） |
|---|---|---|---|
| V1 | 设计产物→代码的内容指纹与漂移检出 | `codeModule` 目前只做格式/包含匹配（`rtm-guide.md` 声称的「文件路径存在」校验**未实现**） | 先补「路径存在」这一档并观测真实项目误报率，再评估指纹是否值得；指纹会让每次无关重构都触发漂移告警 |
| V2 | 声明式架构规则 | 见 §4 | 先在 1 个 brownfield 项目实测「分层规则被违反」的发生率；无发生即不写 |
| V3 | 设计产物生命周期（`deprecated` + `replacement` + 禁 inbound 依赖） | 需要图结构新字段与 inbound 判据，且与既有豁免审批/替换路径的关系未定义 | 统计历史轮次中「被废弃但仍有入边」的真实发生次数 |
| V4 | 深到浅增量复核阶梯 | 受 [asset-authoring.md](../../w-model-dev/references/asset-authoring.md) §13「授权不写」约束 | 取一次「不写该指引」的对照：观察是否存在无差别全量重读或只改叶子不复核祖先 |
| V5 | 结构粒度自诊断（过粗/过浅） | 同上；且判据尚未定，误报会产生噪声 | 对照观察是否真的欠分解；判据候选：SD 无同类型子分解边 ∧ `implements` 基数 ≥5；或 SD 全在同一 level |

## 6. 与现有约束 / 反模式的关系

- 不新增硬约束，不新增反模式编号（上限仍为 #48）：R16 与 R15f 是**既有约束的强制化**（「id 全局唯一」「证据锚点须真实存在」此前只有散文与半截实现）。
- 与 SSoT §10L「形状合规 ≠ 实际正确」同源：R16 = 「唯一性合规 ≠ 实际唯一」，R15f = 「路径合规 ≠ 行真实存在」。三者共用同一修复模式（由上游事实提供判据，而非自报）。
- 不改 `run-log` action 枚举、不改 pre-push 项数（19）、不新增 CLI（两处落地都在既有门禁脚本内）——避免计数面扩散。

## 7. 不做的事

- 不新增 CLI / 不新增 schema（保持 46 个 exit-2 脚本与 34 份 schema 不变）。
- 不新增 references 文件（落点全部在既有文件：`graph-guide.md` / `evidence-anchored-tree.md` / `conventions.md` / `command-reference.md`）。
- 不新增 samples fixture（新判据的用例以 vitest 内联对象表达，避免触发 self-test 样本计数链）。
- 不改 `verifier-spec.md` / `subagent/*` 人格 / `templates/*`。

## 8. 深读源码后的订正（§1–§7 写于仅读 README / SKILL.md 之时）

> **触发**：用户质疑「没 clone 源码、没派子代理深入分析，就谈吸收」。该质疑成立——§1–§7 的证据基础只有两份文档（`skills/normify-gen/SKILL.md` 26KB + `README.md` 31KB），且 `CHANGELOG.md` 那次抓取返回 0 字节却被略过。
> **补救**：`git clone` 至 HEAD `ed404e5`，派 5 路子代理精读 `src/`（实测 7749 行，README 自称的 7168 行已过期）、`docs/SPEC.zh-CN.md`（701 行）、`tests/`（585 行，5 个文件）、`CHANGELOG.md`（241 行）与 4 份 release notes。
> **本节订正前文的错误陈述**——本仓库的既定纪律是「交付文件不留不实陈述」（见 42.2.1 节 CHANGELOG 条目）。

| # | §1–§7 的陈述 | 深读后的事实 | 处置 |
|---|---|---|---|
| K1 | N11「几何自检（线不出界/不贴框/不穿框/不压线）」列为一项机制，判「不吸收（域外）」 | **该脚本不存在**：`scripts/` 只有 `build.sh`；`git log --all --diff-filter=D \| grep geometry` 为空（既未提交也未删除）；`package.json` 的 `files` 不发布 `scripts/`；CI 从不运行它。README 的两处宣称（`README.md:78`、`:433-434`「129 模块/28 层：线压线 0 处」）**在可 clone 的产物中无可复现证据**（仓库也不附带任何 normify 项目数据）。真实存在的是渲染器内部的加权代价函数（`template.ts:1156-1180`）与降级标志 `fallback`（写 3 次、读 **0** 次） | 判定改为「**文档过度声称，机制不存在**」。结论「不吸收源侧实现」不变，但理由从"域外"改为此 |
| K2 | N3 三层校验「产出即 SHA-256 冻结进 `receipt.json`」 | 冻结**自身失效**：`compile.ts:281-284` 在把 `receipt.json` 条目插入 `artifacts` **之前**序列化 `receiptText0` 并取其哈希，写入磁盘的却是插入后的 `receiptText`——记录的自哈希与文件实际哈希**必然不等**（`bytes` 字段同理），且全仓无任何重算比对者（`grep artifacts` 仅命中 `compile.ts` 自身）。另：`compiled_at` 使 `tree.json` 与 `receipt.json` **不可复现** | 判定改为「**源侧该项本身是坏的**；本仓库 `evidence-manifest` + `wm-export-evidence --verify` 显著更强」。反向教训入库：**绝不记录"变更前文本"的自哈希，且必须同时交付重算比对者** |
| K3 | N6 变更闭环「`change_close` 0 error 强制、create 未落地拒关单」→ 判「已具备」 | **不是无条件的**：`repoRoot` 是**可选**参数（`companion.ts:50`），缺省时（a）`refresh` 跳过、（b）**落地检查整体被跳过**（`:63` 的 `if (repoRoot !== undefined)`）、（c）`validateProject` 的全部证据校验被跳过（`validate.ts:287`），于是「create 里仍是 planned、source 文件不存在」的变更照样返回 `ok:true, phase:'verified'`；唯一的痕迹是一句 `evidence/checks-skipped` 警告。附加：`change_update` 可直接把 `status` 改成 `verified`（`tools.ts:1609-1615`），**绕过整条 close 闸门** | 判定改为「**条件失效 + 可绕过**」 |
| K4 | N2 指纹表述为「源码变了而结构数据没跟上」 | 精确语义是**工作区字节哈希**（`store.ts:322-338`：按 path 去重升序，逐条 `update(path)+update(0x00)+update(file bytes)`），与之并列的 `revision`（40 位 SHA）**独立记录、无交叉校验** ⇒ 「指纹 + revision」**不能**读作"此内容即 revision X 的内容"（脏工作区完全兼容绿灯） | 表述订正；依旧不吸收（本仓库以 HEAD 绑定的 provenance 更强） |
| K5 | N1 只写「散文声明唯一性、实现零强制」（据本仓库情况推及） | 源侧**确有** `structure/id-duplicate`（`validate.ts:55`）与 `structure/uid-duplicate`（`:66`），但：`structure/cycle` 是**死代码**（`validate.ts:90-114` 的 `seen.has(id)` 先返回，使 `chain.includes(id)` 分支不可达 ⇒ parent 环零诊断，且随后 `compile.ts:204` 的 `countDesc` 会栈溢出）；`dep/*` 六项（self-loop / target-missing / from-api-* / to-api-invalid / duplicate）**全部被 `apis !== undefined` 门控**（`:141-183`），而容器/根**禁止**携带 `apis` ⇒ 承载最多跨模块边的模块其依赖**从不被校验**。README 却把"依赖目标、环"列为 L2 核心校验 | 判定不变（本仓库的 R16 仍是真缺口），但「源侧更规范」的隐含前提被否定 |
| K6 | §3.3 收尾写「不改 pre-push 项数（19）」等处隐含「本仓库 fail-closed 文化强，唯一 vacuous 点是覆盖率空集维度」 | **该判断对本仓库也是错的**。按同三族缺陷对本仓库做定向审计（§10），发现 **A1 是最重的一条**：`--spec-dir` 在缺 `--phase` 时被静默丢弃，且「未执行」提示恰在该分支被抑制——即我吸收 R16/R15f 所针对的那一类，**在本仓库同样存在** | 见 §9（已修）与 §10（登记） |

## 9. 深读后新增的落地：I4 `--spec-dir` 阶段专属参数契约

- **缺陷（已实测复现）**：`check-artifact-gate.ts` 在 `--spec-dir` 缺 `--phase` 时不报错、不做设计级结构校验，`specStructure` 记 `null`（代码注释里 `null` 的语义是"阶段 5-8 不适用"）⇒ 调用方拿到的绿究竟是"校验通过"还是"根本没跑"**读不出来**；`--spec-dir <dir>`（空格形态）与 `--spec-dir=`（空值）也被落成"未提供"，检查整组跳过，而人类可读段的提示反过来写「**未提供 `--spec-dir`**」——调用方明明传了，读到的是"你没传"。
- **修复**：与同文件 `--tickets` 的既有契约对齐（`check-artifact-gate.ts:376-394`，其注释原文即「`--phase<5` 给定 → ARG_INVALID，**不在低阶段静默跳过参数**」），并与 `--scope` 条已写明的原则对齐（`command-reference.md:390`「**不输出「未提供 --scope」误导文案**」）：空格形态 / 空值 → `ARG_INVALID`；阶段 5-8 或未给 `--phase` 而给定 → `ARG_INVALID`。缺省不传行为完全不变。
- **为何这是吸收而非顺手改**：这正是源侧最严重缺陷（K3「以可选输入为条件的门禁就是可选门禁」）的**同族**实例，且修复依据是**本仓库自己已写下的**两条原则，不是引入外部口味。引导≠放宽：合法用法（`--phase=1..4 --spec-dir=<dir>`）与缺省用法断言未变。
- **回归**：`gate-ticket-content.test.ts` 新增 5 例（缺 `--phase` 给定 → exit 2 / `--phase=8` 给定 → exit 2 / 空值 → exit 2 / 空格形态 → exit 2 / `--phase=1` 给定**不得误红** / 缺省 `specStructure==='skipped'`），实测 44/44 通过。

## 10. 同族缺陷定向审计登记（本轮登记不修）

> 方法：以 §8 的「文档保证而机制不保证」三族（可选输入门禁 / 无人读取的契约字段 / 先过滤再校验的遮蔽诊断）对本仓库 `w-model-dev/scripts/` 定向普查。**完整证据与逐条 file:line 见审计记录**；本节只登记结论与处置，供后续轮次取用。登记不修的理由：均超出「吸收」范围，且每条都需要各自的 blast radius 评估与回归，不宜混在本轮交付里。

| 族 | 命中 | 最重的一条 | 处置 |
|---|---|---|---|
| A 可选输入门禁 | 7 处 | **A1 `--spec-dir`（已修，见 §9）**。其余：A2 `check-requirement-graph` 的 R9–R14 无 `--spec-dir` 时整组跳过且 `GRAPH_JSON` **连"未执行"标记都没有**；A3 `check-signature-chain` R8 跳过只写在人类可读行，`--json` 与 `SIGNATURE_CHAIN_JSON` 都不带 `rulesSkipped`（该文件自己的 `iceberg-sweep-guide.md:227` 已点名这是陷阱）；A4 `check-run-log` 的 R5/R6（`--gate-logs`）、R3（`--tla-manifest`）缺输入即跳且机器摘要无标记；A5 `check-iceberg-sweep` 四产物全缺时三视角对账静默跳过；A6 `check-budget`/`check-maturity` 的 killSwitch 触发检测缺 `--run-log` 时**无任何警告**（同文件其它规则都会警告） | 登记；建议统一引入「跳过即具名可见」的摘要字段（`wm-export-evidence` 的 `verificationLevel: package-only / source-bound` 是现成范式） |
| B 无人读取的契约字段 | 4 处（抽样 688 个 schema 属性名，34/34 schema 覆盖） | **B1 `budget.schema.json` 的 `perPhase.maxTokens` / `maxSubagentSpawns` / `maxReworkRounds` / `project.maxTokensPerSession`**：schema 文字承诺「超过触发 onExceed」「强制 CHECKPOINT」，四个名字在非测试脚本里**只出现在类型声明处**，门禁一条都不校验 | 登记；B2 `check-requirement-graph --exemptions` 对 R7–R14 **声称已应用却未应用**（实测同一份 JSON 里 `exemptionsApplied:["R7","R9"]` 与 R7 violation 并存、exit 1）——这条是**正确性**问题，建议优先；B3 `run-log.validFindings`/`decisionConfidence`、B4 `event-ingress` schema 不在任何运行时校验路径上 |
| C 先过滤再校验 | 3 处 | C1 `check-iceberg-sweep`：产物**存在但 JSON 非法**时被静默丢弃，下游报「R7 视角缺席未显式声明」——把"文件坏了"说成"你没声明缺席" | 登记；C2/C3（坏 JSONL 行被跳过后 killSwitch/降级阈值与 `--auto-trigger` 阶段推断都在存活行上计算，机器摘要无 `parseErrors` 字段）同族 |

**对本仓库的净判断**：A 族**实质存在**（与源侧同族，A1 已修）；B 族**边缘到实质**（多数零读取字段已在 `data-models.md` 自认"暂未集成"，属已知死字段而非欺骗；但 B1 是 schema 文字承诺而无人兑现、B2 是正确性缺陷）；C 族**基本干净**——源侧那种"丢模块→把它的依赖者说成目标不存在"的**误指控**没有出现，本仓库更常见的是**静默漏检**（不误报，但也不报）。

---

# 第三源吸收（《需求设计一体化流程》v6.0 — 需求分析 + 开发前设计多智能体协作工作流）

> 吸收源：《需求设计一体化流程》v6.0 —— 需求分析 + 开发前设计多智能体协作工作流（完整执行规格，3116 行 / 117KB）。**仓库外本地文档，不随本仓交付**，故此处只记标题与版本，不记本机路径。形态 = Python 栈的多智能体协作规格：R1–R16 十六角色（每角色含完整系统提示词 + Python 工具实现 + JSON Schema）、三循环嵌套、YAML 编排、SQLite 检查点、错误补偿、HITL 协议、执行引擎。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §10.5.4（本轮两个门禁桶）为准；本文件为吸收映射与决策回溯。
> 调研方式：四路并行精读（需求侧 R1–R5 判据全集 / 设计侧 R6–R16 判据全集 / 三循环·YAML·状态·恢复·HITL·引擎 / 本仓库阶段 1–4 同主题对照），落地点逐条实测。

## 1. 先决事实：该文档的「概念层」与「可执行层」严重不对齐

判断能不能吸收之前必须先说清一件事——**该文档的循环与运行时机制是声明，不是实现**：

| 事实 | 证据 |
|---|---|
| §1.1 三循环（外/中/内）的全部状态名（`CHANGE_INTAKE` / `ITERATION_PLAN` / `ITERATE_EXECUTE` / `REVIEW_GATE` / `CHANGE_IMPACT_ANALYSIS` / `SPIKE_LAUNCH`…）**只出现于那张 ASCII 图各一次**，无状态定义、无进入/退出条件、未被 YAML 引用 | §1.1 (L20–L57) 之外零出现 |
| `on_failure` / `return_to_step` / `route_to_step` 共 6 处声明，**引擎从不读取** `on_failure`；`run()` 只做一次前向拓扑遍历，`completed_steps` 永不清空 ⇒ **返工链在实现层不可能发生** | 执行引擎 (L2922–L2972) |
| 错误分类器 / 重试执行器 / 补偿注册表 / 死信表 / HITL 请求对象**无任何调用点**（导入而未使用）；`emits_files` 断言无实现；并行执行导入 `ThreadPoolExecutor` 后未用 | L2871 / L2884 / L2656 / L2531 / L2872 / L3043–L3060 |
| 设计门禁的 `role_ref` 是**产出者本人**（`R6-design-overview`），即设计质量门由产出者自审 | L2212–L2213 |

**结论**：三循环、补偿回滚、HITL 运行时、错误分类策略这些**不能按"机制"吸收**（它们在本载体里都没跑起来）。可吸收的只有**契约层**：判据、模板字段、禁止事项、路由词汇表。另外该文档内部矛盾密集（同一件事两处给出不同阈值，见 §4），**照抄其数字会把矛盾一起搬进来**。

## 2. 逐项判定

| # | 源侧机制 | 本仓库对照（阶段 1–4） | 判定 |
|---|---|---|---|
| N1 | R4「禁止 AC 中 Then 描述模糊」，AC 须覆盖正常/边界/异常 | 规则**写在模板与失败模式表里，脚本零实现**（`主观词` 在 `scripts/` 命中 0） | **吸收 → J1** |
| N2 | R7「每个 ADR 必须包含 决策/上下文/后果（+备选方案/状态）」 | `system-architecture.md` §5 已写「强制…缺则 FM-SD-02」，**FM-SD-02 在脚本中命中 0** | **部分吸收 → J2**（只吸收三列非空的确定性核） |
| N3 | R4 INVEST 六维检查 | 仓库**完全无** INVEST / SPIDR / 规模阈值 / 垂直切片（切片只在阶段 5 票据） | 不吸收（理由见 §4-①） |
| N4 | R3 SPIDR 五轴切分 + 垂直切片验证 | 同上；阶段 5 已有 tracer-bullet 垂直切片 | 不吸收（源判据已退化为技术词黑名单 + 「和」计数） |
| N5 | R1 停止信号六判（3 ≤ 子目标 ≤ 8 等） | 仓库走 REQ 层级树 R1–R4 + 边数下限 warning，**形态不同**（不分解"子目标"） | 不吸收（数字阈值无对照证据） |
| N6 | R5 红绿灯投票 + 红灯 >30% 触发目标重校准 | 仓库**明文禁止投票**：「不自动共识：禁止为消除分歧而强行折中/投票」（`agent-personas.md`）；跨阶段回退走场景 5（更完备：`round ≥ 2` + R 标记 + V 复审 + 人类三选一） | 不吸收（**立场冲突**） |
| N7 | R14 五类变更 → 路由 + **四维影响分析**（范围/工作量/风险/依赖）+ CCB 四值决策 | 事件入口有六类事件 + 高风险路径表 + 场景 5 回退；**但「四维影响分析」无字段承载** | 候选 V1 |
| N8 | R15 Spike 假设/成功标准/timebox → 实验 → 判定 + 证据 + next_actions | 只有分诊标签（明令**不构成**轻量出口）+ mini-spike 估算纪律；设计期无「假设→实验→判定」产物 | 候选 V2 |
| N9 | design_gate 四项跨产物一致性检查 | `check-design-contract-consistency`（D1–D4）+ `check-code-tla-consistency` 覆盖「契约↔实现」「状态机↔代码」；**「模块划分↔类图」「测试设计↔验收标准」两条无对应** | 候选 V3 |
| N10 | R7 NFR 五字段（需求/指标/方案/验证方法/风险/缓解） | 仓库有 `targetValue` + `testThreshold` 双字段门禁与横切 SD 登记；**「每条 NFR 给技术方案」不存在** | 候选 V4 |
| N11 | 错误三分类（TRANSIENT/BUSINESS/UNCERTAIN）+ 补偿注册表 + 死信表 | 仓库有 F1–F10 失败模式 + O1–O6 运维失败模式 + 普通 V/G 失败链 + 场景 5；源侧分类面向**运行时异常**且零调用点 | 不吸收（需运行时 + 域不同） |
| N12 | HITL 四触发器 + 请求/响应信封 + `TIMEOUT` | 仓库有 🔴 CHECKPOINT（不可绕过）+ `maxReworkRounds` / `maxIcebergRounds` / grant 超时 | 不吸收（已具备，且仓库的闸门是硬约束） |
| N13 | R16 五维评审（安全/效率/可信/可维护/可持续） | 仓库五轴 + 5 子标准 + **R13 单轴下限 0.70**（加权平均不得掩盖单轴失败）+ 阻断三层规则；源侧 `severity → decision` **无映射规则**，且门禁由产出者自审 | 不吸收（仓库更强） |
| N14 | 「acceptance（自然语言）+ assert（机械断言）」双契约 | 仓库每阶段既有验收清单又有门禁脚本——**J1/J2 正是把「只有散文」的两条补成机械断言** | 部分已有（本轮补两条） |
| N15 | §八 五段式执行清单 | 载体专属（roles/ / schemas/ / tools/ / SQLite / Python 模块） | 不吸收（仅在本载体下成立） |

## 3. 落地的两项

### 3.1 J1 §4.2 验收标准可量化校验（phase 1）

- **吸收动机**：N1。`templates/requirement-spec.md` §4.3 写「禁止「快速」「友好」等主观词」、§4.2 的 NFR 提示写「禁止「性能良好」「高可用」「易扩展」等不可测量表述」、`discipline-dod.md` 列为自检项、`phase-1-requirements.md` 禁止行为 #3 也写了——**四处写了规则，`主观词` 在 `scripts/` 命中 0**。这与本项目此前修掉的 R16（写了唯一性无实现）、R15f（写了行号锚点只验 path）、A1（`--spec-dir` 传了没用）同族。
- **判据**：`check-artifact-gate.ts --phase=1 --spec-dir=<dir>` 的 `acceptance` 桶逐行校验 §4.2 表——`类型=acceptance` 行的「验收标准」列不得为空；任一行该列不得含 `SUBJECTIVE_ACCEPTANCE_WORDS` 任一词。占位符 `{{...}}`、`—`、`-` 视为未填。
- **判据边界（如实声明）**：脚本只判可枚举的字面命中；**「该标准是否真的可测」仍由 V 评审 `testability` 轴承担**，门禁通过不等于验收标准合格。词表来源限定为**仓库既有文档自己点名的词**（5 个），不外扩——「等主观词」是类、脚本只能判表，扩表即改动门禁强度。
- **表不存在即整组跳过**：该表的完整性不在本判据职责内，故无存量夹具受影响。

### 3.2 J2 §5 ADR 三列结构校验（phase 2）

- **吸收动机**：N2。`templates/system-design/system-architecture.md` §5 写「强制：每条 ADR 有决策 + 上下文 + 后果（缺则 FM-SD-02）」，而 **FM-SD-02 在 `scripts/` 命中 0**——失败模式编号存在，判据不存在。
- **判据**：`--phase=2` 的 `adr` 桶逐行校验 `*-system-architecture.md` §5 表——`决策` / `上下文` / `后果` 三列非空（`{{...}}` / `—` / `-` 视为未填）。
- **只吸收确定性核，不吸收源侧扩展列**：源侧 ADR 还要 `状态`（提议/已接受/已废弃）与 `备选方案`，并规定「后果须含正负两面」。仓库**不吸收**这两项——`备选方案` 已由阶段 3 的 `interface-contract.md`「备选方案」节与阶段 4 的 `class-design.md`「方案权衡」列承载（GoF Consequences 写法），再在阶段 2 加一列即 duplication；`状态` 与 `决定性` 在阶段 1-4 的短周期内无消费者。**源侧扩展列记为可加项，不是遗漏**。
- **判据边界**：**不判「是否该有 ADR」**（`phase-2-system-design.md` 的三问门槛「难逆 / 无上下文会困惑 / 真取舍」是判断型准入，脚本判不了），故**不强制 ADR 条数 ≥1**，表为空或缺节均不报。
- **判据不越界**：阶段 1 不施加 ADR 判据、阶段 2 不施加验收判据，各有单测钉死。

## 4. 明确不吸收（含理由）

- **① INVEST / SPIDR / 故事规模阈值（N3/N4/N5）**：三条理由叠加。(a) **源侧判据自身退化**——`Estimable` 与 `Testable` 在实现里是**恒真桩**（`{"pass": True}`，永不进 `failed`），故其总体判定实际只由 I/N/V/S 四维决定；(b) **源侧内部矛盾**——R3 判「`i_want > 50 字符` 即过大」而 R4 判「`≤ 100 字符` 即够小」，同一条 60 字符的故事会同时"过大"和"够小"，两套技术词黑名单也不一致（一套含 `表结构`、一套含 `Redis/MySQL` 且大小写敏感）；(c) **与仓库既有语义打架**——源的 `Independent` 判据是「任一依赖即失败」，而仓库的 `precedes` / `depends-on` 是有序交付与数据流的**正当表达**，照搬会把正常依赖判成缺陷。按 `asset-authoring.md` §13，无「不写该指引」的对照证据时不写。
- **② 红绿灯投票 + 红灯 >30% 重校准（N6）**：与仓库**明文立场冲突**——`agent-personas.md` 规定「不自动共识：禁止为消除分歧而强行折中/投票；分歧上缴用户裁决」。仓库已用「证据加权 + 分歧上缴人裁决」+ 场景 5 跨阶段回退（含 `round ≥ 2` 门槛、R 标记、V 复审、人类三选一）覆盖同一目的，且比"红灯占比 > 30%"这一条数字更可审计。
- **③ 三循环嵌套 / 状态总线 / 补偿注册表 / 死信表 / 错误三分类 / HITL 运行时（N11）**：源侧**均无执行者**（§1 已列证据）；仓库对应物是 `.w-model/` 状态文件 + `wm-write` 锁写 + 门禁退出码 + CHECKPOINT，语义更强。吸收一个"自己都没跑起来的机制"只会得到 prose。
- **④ R16 五维评审（N13）**：仓库五轴 + 单轴下限 + 三层阻断规则更强；源侧问题记录要求四字段（描述/严重程度/证据/修复建议）但示例 JSON 只给两字段，且 `severity: HIGH` 与最终 `decision` 之间**无映射规则**——「HIGH 是否必然 FAIL」在源文档里答不出来。
- **⑤ §八 执行清单（N15）**：`roles/` / `schemas/` / `tools/` / SQLite / Python 模块属载体专属，仅在该载体下成立。

## 5. 候选（本轮不做，附可证伪的验证方法）

| 编号 | 候选 | 为何本轮不做 | 验证方法（做之前先取证据） |
|---|---|---|---|
| V1 | 变更「四维影响分析」（范围/工作量/风险/依赖）落入事件入口或 CHECKPOINT 决策记录 | 需要定义承载字段与门禁挂点，且与豁免审批（`check-exemption` E1-E9 已含影响范围/替代方案）的边界未定 | 统计历史轮次中 `requirement-change` 事件的**影响分析缺失**发生率；豁免审批侧已有字段可先复用 |
| V2 | 设计期 Spike 产物（假设/成功标准/timebox → 实验 → 判定 + 证据） | 新增产物类型 + 模板 + schema，成本高；仓库当前只有分诊标签与 mini-spike 估算纪律 | 观测「设计决策因技术不确定性返工」的实际次数；若集中在阶段 2-3 再立产物 |
| V3 | 补两条跨产物一致性检查（模块划分↔类图、测试设计↔验收标准） | 需扩 `check-design-contract-consistency` 的判据域，且「模块划分↔类图」的映射口径（按 SD id？按类名？）未定 | 先在 1 个真实项目上人工对账一轮，统计不一致的真实条数与类型 |
| V4 | 每条 NFR 给技术方案（源 R7 五字段） | 仓库 NFR 双字段门禁只管「目标值 vs 测试阈值」，加「方案/验证方法」需新列 + 门禁；源侧该表**自身内部不一致**（prompt 五字段、输出表四列、丢 `风险/缓解措施`） | 统计 NFR 行在阶段 2-4 是否有「无方案」导致的返工 |

## 6. 不做的事

- 不新增 CLI / 不新增 schema / 不新增 samples fixture（新判据用例以 vitest 内联 `mkFs` 表达，self-test 358 不变）/ 不新增 references 文件。
- 不新增反模式条目（仍 #48）、不新增硬约束（仍 14 条）、不改 pre-push 项数（19）。
- 不吸收源侧任何**数字阈值**（3–8 子目标、50/100 字符、30% 红灯、3 轮协商、timebox 2 天）——它们要么自相矛盾、要么无本仓库对照证据。
