# 三源吸收设计：Clean Code / Refactoring 2 / Agentic Design Patterns

> **设计日期**：2026-08-10
> **状态**：待批准
> **版本目标**：39.2.0 → 40.0.0（批次 A，P0）/ 40.1.0（批次 B，P1）/ 40.2.0（批次 C，P2）
> **吸收源**：《代码整洁之道》中文版（Clean-Code-zh，17 章 + 附录 A）、《重构：改善既有代码的设计（第 2 版）》中文版（Refactoring2-zh，12 章）、《Agentic Design Patterns》（agentic-design-patterns，21 章 + 附录）
> **吸收策略**：分批吸收（P0/P1/P2 各一个计划循环）；纯文档为主 + 少量脚本联动（check-run-log.ts 轨迹模板校验、docs-consistency 期望值）；坏味道/并发检查采用"语言静态工具 + LLM 语义评审"双轨，**不新增自研 AST 扫描脚本**
> **权威定义**：本文件为吸收设计 spec；落地后以 `docs/skill-design-document_SSoT.md` §3.4.40 + 各 reference 新增节 + `w-model-dev/references/clean-code-refactoring-agentic-absorption.md` 为权威定义。

---

## 1. 背景与目标

### 1.1 背景

对三本书完整精读并与技能包资产逐一对照后，结论：

1. **技能包的互补空白集中在四类**：
   - **代码内容规范缺失**：技能包有门禁/覆盖率（判定"是否达标"），缺代码"内容规范"（判定"好在哪、怎么写"）——命名、函数、错误处理、测试代码整洁标准。
   - **代码结构坏味道维度缺失**：46 条反模式全是**流程**反模式；代码结构坏味道（依恋情结、霰弹式修改、夸夸其谈通用性等）无结构化清单。
   - **测试代码自身质量缺失**：现有标准只讲覆盖率/用例状态，未管测试代码本身（F.I.R.S.T.、一概念一测试）。
   - **agentic 编排缺口 4 个**：轨迹符合性校验、S 子代理简报质疑权、多智能体协作质量四问、human-on-the-loop 规则化授权。
2. **约 11 章 agentic 内容 / 大量原则性条目已被现有机制覆盖**（详见 §6），吸收以"补强/细化"为主，避免重复建设。

### 1.2 目标

三源高价值内容按 P0→P1→P2 三批吸收，每批一个完整循环（spec → writing-plans → 执行 → 验证）：

- **批次 A（P0，40.0.0）**：坏味道清单、编码规范、测试规范、复现测试、agentic 4 项、check-run-log 轨迹模板。
- **批次 B（P1，40.1.0）**：评审聚合、MCP 契约、来源校验、MASS、升级时效、修剪优先级、类设计规则。
- **批次 C（P2，40.2.0）**：新建 concurrency-guide / refactoring-catalog、推理预算、置信度字段、最小权限、错误分类等。

### 1.3 非目标

- 不替换 W 模型 8 阶段主流程、不新增并行轨。
- **不新增自研 AST/语义扫描脚本**（用户确认：代码坏味道/并发无法用脚本可靠检查，须用"特定语言静态检查工具 + LLM 语义理解"）。
- 不引入任何 LLM 调用（脚本零 LLM 架构不变；LLM 语义评审由 V 子代理按提示词执行）。
- 不改 verifier-spec 既有 5 轴/Schema 结构（R14-R17 为新增协作评审维度，不破坏现有 R1-R13）。
- 不改既有 #1~#46 反模式语义（#47 为新增）。
- 不改 self-test 基线（249 条不变）；不改 pre-push 项数（14 不变）。
- 不改 demo/归档产物（`docs/changes/archive/**` 不动）。

---

## 2. 吸收决策

### 2.1 落地策略：分批吸收 + 纯文档为主 + 少量脚本联动

| 决策点 | 选定 | 理由 |
|---|---|---|
| 分批方式 | P0/P1/P2 各一批，每批一个计划循环 | 用户确认"全部分批做"；与 39 轮 mythical-man-month 分批先例一致 |
| 脚本联动 | 仅 2 处：`check-run-log.ts` 轨迹模板（批次 A）+ `docs-consistency` 期望值（反模式 #47） | 其余全部纯文档；坏味道/并发检查走"静态工具 + LLM 评审"双轨，无新脚本 |
| 坏味道检查 | **双轨**：机械规则→语言静态工具（eslint/tsc 等，文档化规则集）；语义坏味道→V 子代理按 `code-smells-checklist.md` LLM 评审 | 用户确认脚本无法检查语义层；符合"脚本零 LLM、LLM 评审归 V"架构 |
| 并发检查 | 同上双轨：`concurrency-guide.md` 作为 V 评审清单 + 静态工具机械规则 | 同左 |

### 2.2 优先级分轮

| 批 | 版本 | 内容 | 主要改动类型 |
|---|---|---|---|
| A | 40.0.0 | P0 强吸收（详见 §3.1）+ check-run-log 轨迹模板 | 7 文件修订 + 2 新建 + 1 脚本 + 级联 |
| B | 40.1.0 | P1 中吸收（详见 §3.2） | 9 文件修订 |
| C | 40.2.0 | P2 弱吸收 + 2 新 reference（详见 §3.3） | 2 新建 + 6 修订 |

---

## 3. 总体架构与改动清单

### 3.1 批次 A（P0，40.0.0）

| # | 文件 | 改动类型 | 内容摘要 |
|---|---|---|---|
| 1 | `.cursor/skills/chinese-code-review/SKILL.md` | 修订 | 新增「坏味道检查清单」节：Refactoring ch3 24 味 + Clean-Code ch17 精选，每条配检测信号 / 分级标注（必须修复/建议修改/仅供参考）/ 对应重构手法 |
| 2 | `w-model-dev/references/code-smells-checklist.md` | **新建** | Clean-Code ch17 六组（C/E/F/G/N/T）+ Refactoring ch3 合并的完整评审清单；挂入 SKILL.md Bundled Resources，供 V-code 评审与 S-coding 自检引用 |
| 3 | `w-model-dev/references/phase-5-coding.md` | 修订 | ① 禁止行为表扩 5 条坏味道禁令（复制粘贴重复代码 / 单函数过长 / 布尔标记参数 / 副作用查询混合 / 裸全局可变数据）；② 「断言规范」节（内部假设用断言、外部输入用一等校验，Refactoring ch10.6）；③ 「重构纪律」节（两顶帽子 / 三次法则 / 何时不该重构，Refactoring ch2）；④ 「改动前测试基线」（Clean-Code ch16）；⑤ 「第三方代码边界管理 + 学习性测试」（Clean-Code ch8）；⑥ **「静态检查工具接入」节**：编码后须运行项目语言的静态工具 + 相关规则集（TS: max-lines-per-function/max-params/no-duplicate 等），结果落盘为门禁证据 |
| 4 | `w-model-dev/references/quality-standards.md` | 修订 | ① 「测试代码整洁标准」小节（F.I.R.S.T. / 一概念一测试 / BUILD-OPERATE-CHECK / 风险驱动取舍 / 测试充分性=主观信心，Clean-Code ch9 + Refactoring ch4）；② 「函数与错误处理规范」小节（短小 / 只做一件事 / 参数≤3 禁 flag / 指令查询分离 / 异常带上下文 / 特例模式 / 别返回传 null，Clean-Code ch3/ch7 + Refactoring ch11.1）；③ 「性能三法」（Refactoring ch2.8：时间预算 / 先可调优再热点 / 度量不臆测） |
| 5 | `.cursor/skills/test-driven-development/SKILL.md` | 修订 | 补 4 条：新测试先失败一次（故意注入错误验证，Refactoring ch4.3）/ 夹具独立性（禁共享可变 fixture，ch4.4）/ 边界条件探测清单（空/0/负/空串，ch4.6）/ failure vs error 区分（ch4.6） |
| 6 | `w-model-dev/references/root-cause-locator.md` | 修订 | 补「复现测试强制」节（bug 先写复现测试再修复，Refactoring ch4.7）+ 覆盖空洞/死分支根因线索（Clean-Code ch16 T7） |
| 7 | `w-model-dev/references/anti-patterns.md` | 修订 | 新增反模式 #47「大规模重构式改动」（Clean-Code ch14：检测信号=单次 diff 重写整个模块）；计数 #1~#46 → #1~#47 |
| 8 | `w-model-dev/references/subagent-delegation.md` | 修订 | 新增「S 子代理简报质疑权」节（agentic Ch19 承包商协商反馈：简报不可执行时返回质疑清单而非硬做/静默改范围） |
| 9 | `w-model-dev/references/operational-recovery.md` | 修订 | 新增「HOTL 规则化授权」节（agentic Ch13：L2+ 操作型自动放行须基于显式可验证规则，而非模糊意图） |
| 10 | `w-model-dev/references/verifier-spec.md` | 修订 | 新增「多子代理协作评审维度」R14-R17（agentic Ch7+Ch19：交接完整性 / 计划坚持度 / 角色-任务匹配 / 增量价值） |
| 11 | `w-model-dev/references/format-conventions.md` | 修订 | 新增「命名约定」节（Clean-Code ch2：名副其实 / 有意义区分 / 可搜索 / 一词一义 / 避免思维映射 / 不加多余语境） |
| 12 | `w-model-dev/scripts/cli/check-run-log.ts` | 修订 | **轨迹模板校验**（agentic Ch19）：每阶段理想轨迹动作序列（阶段门：S→V→G→CHECKPOINT + R3×3），run-log 动作序列偏离即违规；不破坏现有 R1-R7 |
| 13 | `w-model-dev/references/clean-code-refactoring-agentic-absorption.md` | **新建** | 吸收决策记录（三源映射表 + 章节出处 + 与约束/反模式关系 + 不吸收清单） |
| 14 | `docs/skill-design-document_SSoT.md` | 修订 | 新增 §3.4.40「第 40 轮：三源吸收」；§10A 追溯表补行 |
| 15 | `w-model-dev/scripts/logic/docs-consistency-logic.ts` + 测试 | 修订 | 反模式最大编号期望 46 → 47；样本更新 |
| 16 | 顶层文档 | 修订 | 反模式计数 46 → 47 联动（AGENTS.md / README / INSTALL.md）；新 reference 挂 Bundled Resources；CHANGELOG [40.0.0]；版本号三处同步 |

### 3.2 批次 B（P1，40.1.0）

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `w-model-dev/references/subagent-persona-matrix.md` | 补「多评审分歧上缴人裁决」节（agentic Ch7：高争议决策分派 2+ V-persona 独立评审，分歧纪要交用户裁决，不自动共识） |
| 2 | `.cursor/skills/mcp-builder/SKILL.md` | 补「面向智能体的 API/工具契约准则」节（agentic Ch10：确定性过滤/排序优先、可解析格式、结构化错误、描述写明何时用/何时不用） |
| 3 | `w-model-dev/references/verifier-spec.md` | R3 reliability 维度补「来源时效/权威性校验」检查项（agentic Ch14） |
| 4 | `w-model-dev/references/hill-climbing-guide.md` | 补「MASS 三阶段方法论」节（agentic Ch17：先单提示→再拓扑→后工作流，改进信号三档分类） |
| 5 | `w-model-dev/references/subagent-delegation.md` 或 operational-recovery.md | 补「升级触发条件显式化」节（agentic Ch13：何时升级/升级给谁/等待时长 + 超时降级选项，E1-E8 之外） |
| 6 | `w-model-dev/references/context-management-guide.md` | 补「上下文修剪优先级」节（agentic Ch16：保留决策证据/门禁输出，丢弃中间推理草稿） |
| 7 | `w-model-dev/references/format-conventions.md` | 第 5 节扩展「坏注释黑名单」6 条（Clean-Code ch4） |
| 8 | `w-model-dev/references/quality-standards.md` + phase-4-detailed-design.md | 补「类设计规则」（Clean-Code ch10：25 词测试 / 职责数度量 / 类名含 Manager 是警报 / OCP/DIP） |
| 9 | `.cursor/skills/chinese-code-review/SKILL.md` + phase-4-detailed-design.md | 补「对象/数据结构 + 得墨忒耳律」条目（Clean-Code ch6） |
| 10 | `docs/skill-design-document_SSoT.md` | §3.4.40 增补 P1 小节；CHANGELOG [40.1.0] |

### 3.3 批次 C（P2，40.2.0）

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `w-model-dev/references/concurrency-guide.md` | **新建**（Clean-Code ch13 + apA）：并发防御三原则（独立成类/SRP、限制共享数据作用域、数据副本）/ 同步区最小化 / 死锁四条件 / 偶发失败=候选线程问题 / 静态工具规则 + V 评审清单双轨说明 |
| 2 | `w-model-dev/references/refactoring-catalog.md` | **新建**（Refactoring ch6~ch12）：坏味道→推荐手法→一句话做法的速查表，采用 ch5 记录格式（名称/速写/动机/做法/范例简版） |
| 3 | `w-model-dev/references/estimation-guide.md` | 补「模型档位 × 思考预算」权衡条目（agentic Ch17 推理扩展定律） |
| 4 | `w-model-dev/references/run-log` 数据模型 | 补可选字段 `decisionConfidence`（agentic Ch18 结构化思维链日志，可选不破坏 schema） |
| 5 | `w-model-dev/references/verifier-spec.md` | R3 security 补「最小权限 + 数据暴露最小化」「prompt 注入防护」检查项（agentic Ch18+Ch13） |
| 6 | `w-model-dev/references/phase-5-coding.md` | Tracer-bullet 票据拆解补「动态重排规则」（agentic Ch20） |
| 7 | `w-model-dev/references/operational-recovery.md` | 补「错误分类处置表」（agentic Ch12：瞬态→重试/永久→回退升级/损坏→跳过记录） |
| 8 | `w-model-dev/references/subagent-persona-matrix.md` | persona 条目补「能力声明」字段（agentic Ch15 Agent 卡片理念） |
| 9 | `docs/skill-design-document_SSoT.md` | §3.4.40 增补 P2 小节；CHANGELOG [40.2.0] |

---

## 4. 关键设计决策

### 4.1 坏味道/并发检查双轨（用户修正确认）

| 检查项 | 检测手段 | 落点 |
|---|---|---|
| 机械规则（函数长度、参数个数、重复片段、布尔标记参数、同步区大小） | 项目语言标准静态检查工具（eslint/tsc/pylint/spotbugs 等）+ 文档化规则集 | phase-5-coding.md「静态检查工具接入」节；结果落盘为门禁证据 |
| 语义坏味道（依恋情结、霰弹式修改、夸夸其谈通用性、注释除臭剂、副作用混合、竞态/死锁） | **LLM 语义理解**：V 子代理按坏味道清单评审 | `code-smells-checklist.md` + `concurrency-guide.md` + `chinese-code-review` 技能；verifier-spec 引用 |

**边界**：不新增自研 AST 扫描脚本；静态工具按项目语言选型（文档化规则集，不内置工具）；LLM 评审归 V 子代理（脚本零 LLM 架构不变）。

### 4.2 轨迹模板校验（check-run-log.ts）

- 每阶段定义理想轨迹动作序列（如阶段门：`S→V→G→CHECKPOINT→R3×3`），run-log 动作序列偏离（如 S 后未 V 直接 G、V 失败未 R 直接 S）即违规。
- 从"时序正确"（R7）升级为"轨迹正确"；新增校验维度，不破坏现有 R1-R7。
- 模板表沉淀于 `workflow.md`；本批为唯一脚本行为改动。

### 4.3 反模式 #47 级联

新增 #47 触发 `docs-consistency-logic.ts` 期望值 46 → 47 + 测试样本 + 顶层文档计数联动（同 39 轮 #45/#46 先例）。

### 4.4 新增 reference 挂接

`code-smells-checklist.md`（批次 A）、`concurrency-guide.md` / `refactoring-catalog.md`（批次 C）挂入 SKILL.md Bundled Resources 表 + AGENTS.md references 描述，由 V-code 评审 / S-coding 自检引用。

---

## 5. 版本与级联

| 批 | 版本 | 级联范围 |
|---|---|---|
| A | 40.0.0 | 版本号 3 处（package.json / skill-metadata.json / SKILL.md frontmatter）+ README + INSTALL + CONTRIBUTING；反模式 46→47 计数；新 reference 挂接；CHANGELOG |
| B | 40.1.0 | 版本号 3 处；CHANGELOG；SSoT §3.4.40 增补 |
| C | 40.2.0 | 版本号 3 处；新 reference 挂接；CHANGELOG；SSoT §3.4.40 增补 |

每批验证：`npm run self-test`（249 条）/ `npx vitest run`（35 files）/ `npx tsc --noEmit` / `npm run check:docs-consistency` / `bash .githooks/pre-push --force`（14 项）。

---

## 6. 不吸收清单（明确排除）

| 内容 | 来源 | 理由 |
|---|---|---|
| 完整辩论框架 CoD/GoD、RL/进化学习、SICA 自我修改工具链 | agentic Ch7/9 | 与轻量 V 评审、"Loop 4 不自动改 harness 人审后手动应用"冲突 |
| 网络模型 / 层次化多级 supervisor | agentic Ch7 | 与单一 O 集中编排架构冲突 |
| 完整 RAG、A2A 协议、MCP 传输层实现 | agentic Ch14/15/10 | 不内置知识库、角色是会话内 prompt 角色、工具由宿主提供 |
| ch1/ch14-16 全部教学示例代码（statement/Args/SerialDate） | Refactoring/Clean-Code | 只提炼纪律，不吸收代码 |
| "注释掉的测试代表期望行为" | Clean-Code ch16 | 与约束 #4 真实执行冲突 |
| "怎么对经理说"等组织政治 | Refactoring ch2.4 | 与约束 #7 如实状态精神相悖 |
| Java 特定内容（checked exception 辩论/EJB/JDBC/Executor API） | 两书 | 跨语言不适用 |
| "函数 6 行即发臭"作硬阈值 | Refactoring ch6.1 | Fowler 个人标准，降级为参考信号 |
| 语言特定风格偏好（Object.assign/管道分号/命名风格） | Refactoring ch6-12 | 不宜作跨栈强制规范 |

---

## 7. 重叠核查结论（无需重复吸收）

- Refactoring：小步重构/真实执行/失败即回退/测试设计前置/只动该动的/YAGNI/expand-contract → 已被约束 #21/#4/#5/#1、操作行为 #5/#4、Tracer-bullet 覆盖。
- Clean-Code：DRY（操作行为 #4）、增量重构+回归（约束 #21 + 增量集成纪律）、反指标改断言（反模式 #45）、code review 表达方式（chinese-code-review 已完备）。
- agentic：反思（V+R3+返工循环）、目标监控（verifier-spec）、异常恢复（operational-recovery）、护栏（46 反模式+约束 #10）、路由/并行/记忆（dispatch-matrix/dispatching-parallel-agents/context-management）、学习适应（Loop 4）、附录 G（第 39 轮已吸收）。

---

## 8. 自审记录

- **占位符扫描**：无 TBD/TODO。
- **内部一致性**：批次 A 含唯一脚本行为改动（check-run-log 轨迹模板）；坏味道/并发双轨与"脚本零 LLM"一致；反模式 #47 与 docs-consistency 级联闭环。
- **范围检查**：三批各为一个独立计划循环，可顺序执行；批次 A 最大（16 项），批次 B/C 相对独立。
- **歧义检查**：明确"静态工具按项目语言选型、不内置工具"；明确 R14-R17 为新增维度不破坏 R1-R13。
