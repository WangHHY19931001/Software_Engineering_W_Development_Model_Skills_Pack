# agency-agents-zh 源料摘录（阶段多角色讨论分析机制，2026-10-03）

> **上游**：[jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh) @ commit `811e51c370f26ec4f37ca277b4368b4ff895741f`（见 UPSTREAM-COMMIT.txt）；上游再上游 = msitarzewski/agency-agents（213 个角色译自英文版 + 64 个中国原创）。**License：MIT**（上游 LICENSE）。
> **性质**：本目录是**原文唯一拷贝基准**（sources 先例：2026-09-14 摘录文件）；供 `w-model-dev/subagent/` 3 个新 persona **改编**用，非直接投运——改编产物须满足四字段 frontmatter 契约（`persona-capability-declarations` 门禁）与视角关注面节（SSoT §10P / agent-personas「阶段角色集矩阵」）。
> **既有人格库同源性**：`w-model-dev/subagent/` 现有 33 人格与本上游同源（engineering-*/testing-*/product-*/project-* 命名与部门对应），本批改编沿用同源形态保持一致性。

## 提取清单与改编映射

| 源文件（本目录） | 上游路径 | 提取理由 | 改编目标 persona |
|---|---|---|---|
| `product-manager.md` | product/ | 需求发现→路线图全链（①需求分析师无完全对口角色，此为最佳主源） | `product-requirements-analyst`（主源） |
| `product-sprint-prioritizer.md` | product/ | 优先级裁决视角 | `product-requirements-analyst`（辅源） |
| `product-feedback-synthesizer.md` | product/ | 诉求提炼与冲突识别 | `product-requirements-analyst`（辅源） |
| `testing-reality-checker.md` | testing/ | 质量把关/现实检验（②测试经理无对口角色，此为最佳主源） | `testing-test-manager`（主源） |
| `testing-test-results-analyzer.md` | testing/ | 结果分析与判定纪律 | `testing-test-manager`（辅源） |
| `testing-evidence-collector.md` | testing/ | 证据纪律 | `testing-test-manager`（辅源） |
| `engineering-ai-engineer.md` | engineering/ | ③算法专家最佳匹配（机器学习全链路） | `engineering-algorithm-expert`（主源） |
| `engineering-data-engineer.md` | engineering/ | 数据需求侧补充 | `engineering-algorithm-expert`（辅源） |

## 改编义务（改编者必读）

1. **三不保留**：不保留上游的工具绑定（OpenClaw/Cursor 转换形态）、营销/游戏等部门语境、与人设口癖——只取方法论与职责骨架。
2. **四字段契约**：改编产 frontmatter 六键（name/description/capabilities/inputs/outputs/boundaries）逐字入库（计划任务 1 简报给定），缺一即 `persona-capability-declarations` exit 1。
3. **视角关注面节**：每个改编 persona 正文必含「视角关注面（多角色讨论）」节 + 逐答清单（规格 §2 关注面定义）。
4. **来源标注**：改编 persona 正文头部加一行来源标注（「改编自 agency-agents-zh `<源文件>`（MIT，commit 811e51c3），经 W 模型四字段契约适配」）。
5. **判定权威**：改编与上游内容的取舍分歧以规格 [2026-10-03-phase-multi-role-analysis-design.md](../../specs/2026-10-03-phase-multi-role-analysis-design.md) §2 为准（用户角色集逐字）。
