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
