# 四源吸收设计：软件设计哲学 / 凤凰架构 / GoF 设计模式 / 失控

> **设计日期**：2026-08-10
> **状态**：待批准
> **版本目标**：40.2.0 → 41.0.0（批次 A，P0）/ 41.1.0（批次 B，P1）/ 41.2.0（批次 C，P2）
> **吸收源**：《软件设计哲学》第二版中文翻译（aposd2e-zh，22 章）、《凤凰架构》（awesome-fenix，开源架构书）、《Design Patterns》（GoF，23 模式 + 引言/案例/结论/附录）、《失控》（OutOfControl，Kevin Kelly）
> **吸收策略**：分批吸收（P0/P1/P2 各一个计划循环）；纯文档为主 + 少量模板/机制联动；四源 67 个吸收点中绝大多数是方法论/规范/评审基准层，不新增子流程脚本
> **权威定义**：本文件为吸收设计 spec；落地后以 `docs/skill-design-document_SSoT.md` §3.4.41 + 各 reference 新增节 + `w-model-dev/references/four-source-absorption.md` 为权威定义。

---

## 1. 背景与目标

### 1.1 背景

对四本书完整精读并与技能包资产逐一对照（四源并行 search 子代理逐章/逐文件深读 + 落点文件核实），结论：

1. **技能包的互补空白集中在四类**：
   - **设计质量判据缺失**：技能包有门禁/覆盖率（判定"是否达标"），缺设计期质量判据（"好在哪、为什么好"）——深/浅模块、信息泄露、复杂三症状、组合拆分四信号（APoSD）。
   - **方案词汇表缺失**：refactoring-catalog（重构手法）与 code-smells-checklist（坏味道）已有，但无"设计模式方案词汇表"——S 子代理设计阶段缺"可选方案检索地图"，V 评审 Architecture 轴缺"模式恰当性基准"（GoF）。
   - **架构决策框架缺失**：phase-2 技术选型决策矩阵有框架无内容源——CAP/一致性谱系、微服务粒度判定、容错策略、可观测性职责边界、安全纵深（凤凰架构）。
   - **机制说理层缺失**：技能包强流程（21 约束 + 47 反模式 + 门禁）有"是什么/怎么做"，缺"为什么必须这样"的理论背书——蜂群共识、元控制、错误≠缺陷、不连续系统穷举、约束创造（失控）。
2. **四源 67 个吸收点中约 1/3 是"强化既有机制"（补判据/补问题/补说理），2/3 是"新增小条目"（checklist 追加组/模板字段/评审提问）**——吸收以"补强/细化"为主，避免重复建设与文档膨胀。

### 1.2 目标

四源高价值内容按 P0→P1→P2 三批吸收，每批一个完整循环（spec → writing-plans → 执行 → 验证）：

- **批次 A（P0，41.0.0）**：设计质量层——APoSD 深/浅模块、信息泄露、设计两次、注释哲学、命名三原则 + GoF 方案必附权衡 + 失控"运行系统是唯一最短路径"说理。
- **批次 B（P1，41.1.0）**：架构决策层——凤凰 CAP/微服务粒度/容错/安全纵深/REST 契约 + GoF 模式目录与选择/使用 + APoSD 下沉复杂性与性能设计。
- **批次 C（P2，41.2.0）**：机制说理层——失控蜂群/元控制/爬山法/约束创造 + 凤凰可观测性/共识/流量控制 + APoSD 战略式编程/一致性/易理解代码。

### 1.3 非目标

- 不替换 W 模型 8 阶段主流程、不新增并行轨。
- **不新增自研 AST/语义扫描脚本**（延续三源吸收先例：代码坏味道/设计判据须用"语言静态工具 + LLM 语义评审"双轨）。
- 不引入任何 LLM 调用（脚本零 LLM 架构不变；LLM 语义评审由 V 子代理按提示词执行）。
- 不改 verifier-spec 既有 5 轴/Schema 结构（只增评审问题与说理引用，不破坏 R1-R17）。
- 不改既有 #1~#47 反模式语义（候选新增另计，见 §4.3）。
- 不改 self-test 基线（249 条不变）；不改 pre-push 项数（14 不变）。
- 不改 schemas/*.json 强制字段（class-design 模板字段候选为批次 A 待确认项，不破坏 schema）。
- 不把「必须用设计模式」写成硬约束（GoF 自身警告过度设计）。
- 不引入无实证来源的数字作为硬阈值（APoSD 经验比例仅作参考表述）。
- 不改 demo/归档产物（`docs/changes/archive/**` 不动）。

---

## 2. 吸收决策

### 2.1 落地策略：分批吸收 + 纯文档为主 + 少量模板联动

| 决策点 | 选定 | 理由 |
|---|---|---|
| 分批方式 | P0/P1/P2 各一批，每批一个计划循环 | 与 39/40 轮分批先例一致；67 个吸收点体量大，分轮可控 |
| 模板联动 | 仅 2 处候选：① class-design 模板新增「方案权衡」必填节（批次 A，需同步 phase-4 引用说明，**不新增脚本**）；② design-patterns-catalog 挂 Bundled Resources（批次 B） | 其余全部纯文档；「方案权衡」为模板字段级提示，不触发 check 脚本改动 |
| 设计判据检查 | **双轨**：机械规则（函数长度/参数个数/重复）→ 语言静态工具；语义判据（深/浅模块、信息泄露、透传、过度通用/专用）→ V 子代理按 code-smells-checklist + quality-standards LLM 评审 | 延续三源吸收双轨先例，符合"脚本零 LLM、LLM 评审归 V"架构 |
| 机制说理 | 以注释/说理节形式并入既有文档（verifier-spec / anti-patterns / hill-climbing-guide / tla-plus-guide 等），不单独成章 | 避免文档膨胀（参考失控子代理建议） |

### 2.2 优先级分轮

| 批 | 版本 | 内容 | 主要改动类型 |
|---|---|---|---|
| A | 41.0.0 | P0 设计质量层（§3.1） | 1 新建 reference（吸收决策记录）+ 6 修订 + class-design 模板字段 + 级联 |
| B | 41.1.0 | P1 架构决策层（§3.2） | 1 新建 reference（design-patterns-catalog）+ 7 修订 |
| C | 41.2.0 | P2 机制说理层（§3.3） | 9 修订 + 级联 |

---

## 3. 总体架构与改动清单

### 3.1 批次 A（P0，41.0.0）——设计质量层

| # | 文件 | 改动类型 | 内容摘要 |
|---|---|---|---|
| 1 | `w-model-dev/references/code-smells-checklist.md` | 修订 | 新增「组 X：复杂度症状（APoSD ch2）」：变更放大 / 认知负荷 / 未知的未知，各配检测信号与分级；新增「信息泄露（后门型）」「时间分解」「过度专用方法」「特殊情况爆炸」「透传变量」「实现文档污染接口」「难以描述」「难以取名」「通用容器滥用」「隐藏副作用于构造函数」等条目；「中间人」分级从"仅供参考"升至"建议修改"；组 F 补「为拆而拆（浅方法群）」与「深方法优先于长度」平衡判据 |
| 2 | `w-model-dev/references/quality-standards.md` | 修订 | 「类设计规则」节追加：深度优先于大小（深/浅模块判据）、多类症警报、组合 vs 拆分四信号（共享信息/总是一起用双向/概念重叠/不看一段难理解另一段）、通用-专用分离（上移或下移）；「设计投资」节（10-20% 参考性表述，不写硬阈值） |
| 3 | `w-model-dev/references/format-conventions.md` | 修订 | §5 注释规范追加：「接口注释必备清单」（行为/参数/返回/副作用/异常/前置条件）、「接口注释与实现注释分离」（实现文档污染接口=坏注释）、「先写注释流程」（ch15）；§6 命名约定追加：「命名一致性三要求」（同目的同名/该名不得他用/目的足够窄）、「难取名警报」（难取名=设计不洁信号） |
| 4 | `w-model-dev/references/phase-4-detailed-design.md` | 修订 | 类设计节追加「信息隐藏检查」（本类封装什么知识？该知识还出现在哪些其他类？）；「下沉复杂性检查」（每个配置参数/异常回答"用户能比我们确定更好的值吗"）；「异常策略三选项」节（规避/屏蔽/聚合，RAMCloud 错误升级为最后手段并标注须人工判定）；「备选方案对比」子步骤（每个关键接口/类产出 ≥2 个备选签名草案 + 一行优缺点） |
| 5 | `w-model-dev/references/phase-3-outline-design.md` | 修订 | 接口契约节前置「备选方案对比」子步骤；引用 GoF 案例「目标+约束→方案→模式」叙述格式；「接口交集 vs 并集」设计自检 |
| 6 | `w-model-dev/references/verifier-spec.md` | 修订 | §7.4 readability 轴补「三信息来源检查」（抽象减少信息量？约定复用已有知识？好名称/注释补充信息？）；design 评审补「备选方案对比」检查项、「复杂性下沉」提问、「概念完整性」提问（最重要概念是否被突出/中心化）；code 评审补「复杂三症状提问」 |
| 7 | `w-model-dev/templates/detailed-design/class-design.md` | 修订 | 方法级定义表补「方案权衡」必填列（每个新抽象/新类层须列 1 条优点 + 1 条代价）；方法定义「异常」列补审查提示（能否通过定义规避？是否采用屏蔽/聚合策略？）；接口注释/实现注释分离提示 |
| 8 | `w-model-dev/references/anti-patterns.md` | 修订 | 候选反模式登记（见 §4.3，APoSD-α 复杂性增量累积 + GoF-α 模式装饰性引用 + 失控-α 过度 swarm 化 + 失控-β 纸面理由替代真实门禁）：先入「候选反模式检测信号」节（§11 候选生命周期），本批不正式编号 |
| 9 | `w-model-dev/references/four-source-absorption.md` | **新建** | 吸收决策记录（67 项映射总表 + 章节出处 + 与约束/反模式关系 + 28 项不吸收清单 + 5 个决策点回溯） |
| 10 | `docs/skill-design-document_SSoT.md` | 修订 | 新增 §3.4.41「第 41 轮：四源吸收」；§10A 追溯表补行 |
| 11 | 顶层文档 | 修订 | Bundled Resources 补登记（无新脚本）；CHANGELOG [41.0.0]；版本号三处同步（package.json / skill-metadata.json / SKILL.md frontmatter） |

### 3.2 批次 B（P1，41.1.0）——架构决策层

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `w-model-dev/references/design-patterns-catalog.md` | **新建**（GoF）：23 模式目录条目（名称/速写/意图/适用性/权衡一句话，沿用 refactoring-catalog 记录格式）+ 模式对照表（Adapter vs Bridge vs Facade / Composite vs Decorator / Mediator vs Observer 等）+ 决策辅助节（表 1.2「考虑什么应可变」23 模式各自封装的变化点）+ 使用 8 步 + 过度设计警告；与 refactoring-catalog/code-smells-checklist 互引 |
| 2 | `w-model-dev/references/refactoring-catalog.md` | 修订 | 补「目标结构」注解列（如"以委托取代继承→目标是 GoF 委托/Strategy 结构"）；头部加注「重构动机优先于实现需求（ch16.1）」 |
| 3 | `w-model-dev/references/code-smells-checklist.md` | 修订 | 组 G 补「子类爆炸」「继承破坏封装」（GoF ch1.6 + Lexi 案例）；组 F 补「Getter/Setter 浅方法」（APoSD ch19.6） |
| 4 | `w-model-dev/references/phase-2-system-design.md` | 修订 | 「技术选型决策矩阵」补内容源：CAP 三取舍、一致性谱系、刚性 vs 柔性事务（凤凰 transaction/distributed）；微服务粒度判定（下界独立+内聚+完备 / 上界 2 Pizza Team 一个周期 / 过细三反噬）；「边界条件与异常处理」补微服务四前提（康威定律认知/技术专家/自治自动化/复杂性成主矛盾） |
| 5 | `w-model-dev/references/quality-standards.md` | 修订 | 补「容错设计检查清单」（7 种容错策略对比、断路器三态、舱壁隔离、重试 4 前提 + 乘法效应反例）；「日志规范」（4 个输出反模式 + TraceID） |
| 6 | `w-model-dev/references/verifier-spec.md` | 修订 | Architecture 轴补评审问题：8 类重新设计原因逐条检查（GoF ch1.6）、「哪个类层次最常变化」（Visitor 判据）、「接口取交集还是并集」、「网关/编排层职责是否轻量」（凤凰 service-routing）；Security 轴补认证/授权/传输安全检查维度（凤凰 system-security + zero-trust） |
| 7 | `w-model-dev/references/tla-plus-guide.md` | 修订 | 建模场景补：断路器状态机（CLOSED/OPEN/HALF OPEN）、TCC/SAGA 状态机（Try/Confirm/Cancel、正向/反向恢复）；术语补 Safety vs Liveness（不变式=Safety、最终一致=Liveness 弱化形式，凤凰 consensus） |
| 8 | `.cursor/skills/security-review/SKILL.md` | 修订 | 扩充「认证/授权/传输安全」检查维度（凤凰 system-security：认证三层、RBAC96 最小特权、OAuth2 四模式适配、JWT 防篡改不防泄漏、密码存储慢哈希+盐；zero-trust 五特征） |
| 9 | `w-model-dev/references/phase-6-integration-test.md` | 修订 | 补「分布式事务补偿路径测试」（TCC 确认/取消、SAGA 反向恢复）；「容错/故障注入测试用例生成」（重试终止条件、降级路径、超时） |
| 10 | `docs/skill-design-document_SSoT.md` | §3.4.41 增补 P1 小节；CHANGELOG [41.1.0] |

### 3.3 批次 C（P2，41.2.0）——机制说理层

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `w-model-dev/references/subagent-persona-matrix.md` | 评审角色描述补「证据加权共识」：评审结论不靠单一权威裁决，靠多个独立角度各带证据强度投票、可复现证据与递增共识收敛（失控 ch2 蜜蜂决策；与白箱优先/signature-chain 兼容） |
| 2 | `w-model-dev/references/verifier-spec.md` | 设计原则节补：验证器=编辑者非作者（失控 ch19）；调节器不关心原因只检测偏差（失控 ch7，与 R 根因定位职责分离呼应）；「运行系统是发现涌现结构的唯一最短路径」说理（失控 ch2） |
| 3 | `w-model-dev/references/anti-patterns.md` | 反模式候选转正评审：APoSD-α / GoF-α / 失控-α / 失控-β 四候选按 §11 候选生命周期（人审 + ≥2 项目回归验证）评估是否正式编号 #48+；「错误聚集/超标丢弃」进入失败模式说理 |
| 4 | `w-model-dev/references/hill-climbing-guide.md` | 补「爬山法哲学基础」节：变异→选择→累积→再变异循环（失控 ch14/15，搜索空间足够大时搜索≈创造力）；「育种者只选择不生成」与编排者最小化呼应 |
| 5 | `w-model-dev/references/tla-plus-guide.md` | 开篇补「为什么」段落：不连续系统不可抽样外推（63.25mph 案例）→ 模型检查穷举 / BDD 离散覆盖而非抽样（失控 ch11） |
| 6 | `w-model-dev/references/operational-recovery.md` | 补「集成初期混沌预期管理」（封闭系统初始混沌期 60-100 天属常态，重试预算）；「超标模块重写」规则（错误超过阈值丢弃重写，换不同开发者；早期错误预示后期错误，失控 ch11） |
| 7 | `w-model-dev/references/quality-standards.md` | 补「硬约束=结构来源」说理段（失控 ch19 约束创造：变异必须受限才能落在可行盆地）；「满意化完成」依据（不追最优追多重目标，失控 ch24） |
| 8 | `w-model-dev/references/phase-7-system-test.md` | 补「可观测性验收标准」节：日志含 TraceID、关键指标暴露、调用链可追踪（凤凰 observability 三支柱） |
| 9 | `w-model-dev/SKILL.md` | 核心原则/工具选型补：「受控的失控」边界声明（失控只能发生在硬约束包络之内）；「clockware vs swarmware」选择法则（确定性脚本=clockware 校验/门禁，LLM 多代理=swarmware 设计/评审） |
| 10 | `docs/skill-design-document_SSoT.md` | §3.4.41 增补 P2 小节；CHANGELOG [41.2.0] |

---

## 4. 关键设计决策

### 4.1 设计判据双轨（延续三源吸收先例）

| 检查项 | 检测手段 | 落点 |
|---|---|---|
| 机械规则（函数长度、参数个数、重复片段） | 项目语言标准静态检查工具 + 文档化规则集 | phase-5-coding.md「静态检查工具接入」节（已有） |
| 语义设计判据（深/浅模块、信息泄露、透传、过度通用/专用、异常可规避性） | **LLM 语义理解**：V 子代理按 code-smells-checklist + quality-standards + phase-3/4 自检节评审 | code-smells-checklist / quality-standards / phase-3/4 新增节；verifier-spec 引用 |

**边界**：不新增自研 AST/语义扫描脚本；LLM 评审归 V 子代理（脚本零 LLM 架构不变）。**与三源吸收的区别**：三源吸收补的是"代码内容规范"（怎么写），本批补的是"设计判据"（为什么这样设计好）——作用于 phase-3/4 设计产出与 V 的 design/code 评审，非编码阶段。

### 4.2 「方案权衡」模板字段（批次 A 唯一结构联动）

- `templates/detailed-design/class-design.md` 方法级定义表新增「方案权衡」必填列：每个新抽象/新类层须列 1 条优点 + 1 条代价（GoF Consequences 写法）。
- **不新增脚本**：该字段为模板提示级，由 V 评审按缺项降分（verifier-spec design 评审项），不触发 check 脚本改动——保持 self-test/vitest 基线不变。
- 与 FM-DD-02「缺项即返工」兼容：模板字段写为必填，S 子代理产出缺项时由 V 评审指出进入返工循环。

### 4.3 候选反模式（本批不正式编号，登记候选区）

| 候选 | 来源 | 检测信号 | 转正路径 |
|---|---|---|---|
| APoSD-α 复杂性增量累积 | APoSD ch02.4/ch03 | 每个小改都塞一点复杂性，累积不可控；与 #47 反向呼应 | 候选生命周期：人审 + ≥2 项目回归验证 |
| GoF-α 模式装饰性引用 | GoF ch1.8/ch6 | 引用模式名但无参与者/意图/权衡支撑（橡皮图章） | 同上（类比 #16 占位实现） |
| 失控-α 过度 swarm 化 | 失控 ch2 | 无门禁的多代理自由发挥，缺确定性收口 | 同上 |
| 失控-β 纸面理由替代真实门禁 | 失控 ch2/ch11 | 以评审意见替代 exitCode 真实执行 | 同上（强化约束 4/10） |

**处理原则**：批次 A 将四候选写入 anti-patterns.md「候选反模式检测信号」节（§11 已有生命周期框架），批次 C 按生命周期评估转正；不新增 docs-consistency 期望值联动（候选区不计入最大编号）。

### 4.4 说理层吸收边界（失控专项）

- 吸收"受控的失控"：失控只能发生在硬约束包络之内（21 条硬约束=包络，违反=回退）。
- **不吸收**：绝对失控倾向、Lamarckian 优越主张、神学/宗教叙事、"系统整体不可理解"的消极面（与白箱优先冲突）。
- 说理并入既有文档对应节（注释级），不新增独立"失控哲学"参考文档。

### 4.5 新增 reference 挂接

`four-source-absorption.md`（批次 A）、`design-patterns-catalog.md`（批次 B）挂入 SKILL.md Bundled Resources 表 + AGENTS.md references 描述，由 S 设计 / V 评审按需加载（约束 6 按需加载）。

---

## 5. 版本与级联

| 批 | 版本 | 级联范围 |
|---|---|---|
| A | 41.0.0 | 版本号 3 处（package.json / skill-metadata.json / SKILL.md frontmatter）+ README + INSTALL + CONTRIBUTING；新 reference 挂接（four-source-absorption.md）；CHANGELOG [41.0.0]；SSoT §3.4.41 |
| B | 41.1.0 | 版本号 3 处；新 reference 挂接（design-patterns-catalog.md）；CHANGELOG [41.1.0]；SSoT §3.4.41 增补 |
| C | 41.2.0 | 版本号 3 处；CHANGELOG [41.2.0]；SSoT §3.4.41 增补 |

每批验证：`npm run self-test`（249 条）/ `npx vitest run`（35 files）/ `npx tsc --noEmit` / `npm run check:docs-consistency` / `bash .githooks/pre-push --force`（14 项）。

---

## 6. 不吸收清单（四源合计 28 项，摘要）

| 内容 | 来源 | 理由 |
|---|---|---|
| TDD 全面批判 | APoSD ch19.4 | 与 TDD 技能/W 模型「测试设计前置」冲突；只吸收"修复缺陷前先写失败测试"共识 |
| 「类应该小」完全否定 | APoSD ch04.6 | 与已吸收 Clean Code SRP 冲突；只吸收「深优先于小」平衡判据 |
| 瀑布式模型批判 | APoSD ch01 | W 模型是并行测试设计+返工路径，非其批判对象 |
| 上下文对象整体采纳 | APoSD ch07.5 | 作者自承「远非理想」；只吸收「透传变量是坏味道」诊断 |
| 「让程序崩溃」通用策略 | APoSD ch10.8 | 仅作异常策略最后手段，标注须人工判定 |
| 经验性数字硬编码 | APoSD ch03/12/20 | 无实证来源；不得写入 schema/门禁硬阈值 |
| 各模式 C++/Smalltalk 示例代码 | GoF 各 Sample Code | 语言特定，无复用价值 |
| 附录 B/C（OMT 记号/基础类实现） | GoF | 已过时/现代语言自带等价物 |
| 第 6 章历史/社区叙事 | GoF | 纯背景，无方法论增量 |
| Interpreter/Flyweight/Memento 细节正文 | GoF | 目录收录意图即可，细节不展开 |
| Singleton 实现细节与争议 | GoF | 现代共识倾向 DI/容器 |
| K8s/容器/网络/存储实操 | 凤凰 immutable-infrastructure + appendix | 与技能包方法论定位不符 |
| 具体工具/框架选型罗列 | 凤凰 各文 | W 模型保持工具中立；只保留决策框架 |
| 过深底层实现细节（ARIES/TLS 握手/X.509） | 凤凰 transaction/security | 只保留决策层语义 |
| 占位文档（pattern/、concurrent/ 等 20+ 文件） | 凤凰 | 本书未完成章节，无内容可吸收 |
| 共享事务 share.md | 凤凰 | 书中自评「更可能是伪需求」；仅作反面教材 |
| 纯生物学/实验细节 | 失控 | 机制已提炼，具体数据无操作价值 |
| 宗教/神学/神秘主义叙事 | 失控 ch13 | 保留内核剥神学外衣 |
| 「绝对失控」倾向 + Lamarckian 优越主张 | 失控 ch2/15 | 与「受控的失控」+ Loop 4 人审手动应用冲突 |
| 「系统整体不可理解」消极面 | 失控 ch2 | 与白箱优先冲突 |
| 过时技术预言（90 年代电子货币/SIMNET） | 失控 ch11-13 | 只保留机制原则 |
| 电子货币/工业生态学等无关章节 | 失控 ch12/10 | 主题距离软件工程太远 |

---

## 7. 重叠核查结论（无需重复吸收）

- **APoSD vs Clean Code/Refactoring 2（第 40 轮已吸收）**：命名规则（N1-N7）与 APoSD ch14 一致性三要求互补不重复（前者防坏名，后者防一名多义）；「函数只做一件事」与「深方法优先于长度」为两源平衡，在 checklist 组 F 以"先验深度再验长度"注明判定顺序；注释规范 C1-C5 与 APoSD 接口注释清单互补（前者禁坏注释，后者正面给必备内容）。
- **GoF vs refactoring-catalog（第 40 轮已吸收）**：重构手法（做法层）与设计模式（目标结构层）互补——GoF ch6「模式是重构的目标」直接打通"坏味道→手法→目标结构"闭环。
- **凤凰 vs concurrency-guide（第 40 轮已吸收）**：锁/隔离级别对照已有，凤凰 local/global 事务只补"2PC/3PC 缺陷 + FLP"决策层语义，不重复并发原语。
- **失控 vs 人月神话（第 39 轮已吸收）**：「判断的组织」与人机分工线已有，失控补"蜂群共识/育种者只选择"作为其机制说理，不重复立场。
- **失控 vs agentic 四问（第 40 轮已吸收）**：协作质量四问与蜂群加权共识互补（前者评审流程，后者机制原理）。

---

## 8. 自审记录

- **占位符扫描**：无 TBD/TODO；每个吸收点均给出精确落点（文件+节）与来源（章节/行）。
- **内部一致性**：批次 A 含唯一结构联动（class-design 模板字段，无脚本）；候选反模式不触发 docs-consistency 联动；四候选转正路径明确（候选生命周期）。
- **范围检查**：三批各为一个独立计划循环，可顺序执行；批次 A 最大（11 项），批次 B/C 相对独立；67 吸收点全部有落点或明确列入不吸收。
- **歧义检查**：明确「方案权衡」为模板提示级不触发脚本；明确说理层并入既有文档不新增哲学参考；明确 APoSD 经验数字仅作参考表述不写硬阈值。
- **与先例一致性**：格式与 39 轮（人月神话）/40 轮（三源）spec 一致；吸收策略（分批 + 纯文档为主 + 双轨检查）延续先例。
