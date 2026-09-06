# 触发边界可度量性 campaign 设计（eval 语料库 + 反例登记册 + L0 复用指南）

> 状态：已获用户批准的设计（brainstorming 产物）。
> 日期：2026-09-07。
> 背景：对 arXiv:2608.20274（"Break It Down, Pass It On: Cross-Task Skill Transfer in LLM Agents"）重构建议的仓库内分析，结论为不采纳整包拆分方案，吸收三项低成本改进。本设计是三项吸收项的统一落地规格。

## 0. 背景与动机

外部建议主张将 `w-model-dev/` 拆分为 15+ 原子子技能图谱并引入动态 Planner 与嵌入检索 Utility 门禁。仓库内分析（2026-09-07 会话）判定：该建议的污染路径依赖"被动整包加载"这一本仓库不存在的机制（触发决策表规定普通开发任务不启用；硬约束 #6 + 反模式 #5 强制按需加载），其 Utility 定量为未测量的赋值，且拆分会瓦解跨阶段门禁与状态一致性。

分析确认论文对本仓库的真实启示是：**技能的检索/触发边界要可度量**。正确落点不是拆包，而是：

1. 扩充 `eval/` 任务描述语料库并建立负向断言（不引入嵌入模型）；
2. 在 SKILL.md 触发决策表扩充显式反例清单（anti_scenarios 思想）；
3. 以文档级复用指南落地 L0 子能力独立分发（packaging，不拆包）。

三项互相锚定（反例清单是负向断言的锚定基底，语料库是反例清单的数据源），作为一个 campaign 一次设计一次落地。

## 1. 已锁定决策（用户逐项确认）

| # | 决策点 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | 设计范围 | 1/2/3 三项全做 | 三项互相锚定，一次落地 |
| D2 | 语料库规模 | 约 60 条精编（现有 25 保留 + 新增 35） | 每条人工撰写 prompt + expected + 独立锚点，质量优先 |
| D3 | 反例清单载体 | SKILL.md 精简示例行 + references/activation-guide.md 完整清单分层 | 常驻面几乎不增重，完整防御在按需层 |
| D4 | 负向断言机制 | notContains + 类别锚点 + 覆盖矩阵三层 | 检出"反例被误写进启用条件"的反向污染，并保证反例覆盖完备性 |
| D5 | L0 分发形态 | 文档级复用指南（docs/INSTALL.md 新节） | 零结构风险，不新增双向同步负担 |
| D6 | 数据架构 | 扩展现有双文件（prompts.json + mappings.json v2） | 零新评估文件，prompts↔mappings 1:1 契约不动 |

## 2. 设计

### §1 目标与成功标准

把"技能触发/检索边界"从一句话约定变成可回归度量的资产。成功标准：

- `npm run eval` 对 60 条语料全通过（exit 0），负向 22 条每条有类别归属与独立锚点；
- SKILL.md 常驻面增量 ≤ 15 行；frontmatter description 增一句英文反例信号；
- 不引入任何新依赖（仅 node stdlib），runner exit code 语义不变（0/1）；
- 治理链完整：SSoT 先行 + TSV 新轮次 + prepush 17 项全过。

### §2 反例类别体系与 60 条构成

负向类别（route=skip，不启用）10 类：

| 类别 | 典型场景 |
| --- | --- |
| N1 一次性数据/文件脚本 | 批量重命名、CSV 清洗、格式转换 |
| N2 UI 样式与小 bug 修复 | CSS 调整、文案修正 |
| N3 纯问答与技术解释 | 概念问答、原理讲解 |
| N4 环境与配置变更 | 装依赖、改 tsconfig、CI 配置 |
| N5 纯文档撰写与排版 | 写 README、排版 |
| N6 数据查询与正则提取 | SQL 查询、日志提取 |
| N7 依赖升级与小重构 | 升级框架版本、小范围重构 |
| N8 非软件开发任务 | 周报、PPT、日程 |
| N9 单点执行指令 | "直接把这个函数改了"（无流程信号且无 `.w-model` 状态） |
| N10 已由其他工具接管的请求 | lint、格式化、构建 |

歧义类别（route=ask，先询问）3 类：

| 类别 | 典型场景 |
| --- | --- |
| A1 完整流程未提 W 模型 | "从需求开始走完整流程"（现有 id 3 类目化） |
| A2 大型新项目仅说"开始做" | "开始做这个新系统" |
| A3 模糊合规表述 | "正规一点""按规范来" |

构成：60 = 现有 25（id 6/7 升级为 L1N 类目化，id 3 类目化）+ 新增 35（负向 20 / 歧义 7 / 正向 8）。终态分布：负向 22 / 歧义 8 / 正向 L1 12 / L2 机制存在性 18。

每条新增语料的验收 checklist：有类别归属；≥1 个非共享锚点（activation-guide 对应节内该条 prompt 关键词命中）；expected 可判定（路由三值之一 + 具体行为描述）。

### §3 references/activation-guide.md（新建，references 第 41 份）

约 150-200 行，触发决策时刻按需加载：

- 触发决策总则（与 SKILL.md 触发决策表一致的浓缩版）；
- 13 个类别节（`## N1 …` 至 `## A3 …`），每节含：
  - 判定理由（为什么这类不该激活 / 该先询问）；
  - 典型示例（= 语料库该类全部 prompt，双向锚定）；
  - 边界说明（何时升级为 ask/enable，例如 N1 脚本若用户提及"高可靠性"则转 A 类询问）；
- 数据源声明：`eval/w-model-dev-test-prompts.json` 是数据源，本文件是视图，覆盖矩阵保证两者一致。

### §4 SKILL.md 改造（常驻面 ≤ 15 行增量）

- frontmatter description 尾部追加一句反例信号：`Do NOT use for one-off scripts, styling fixes, pure explanations, config changes, document writing, or non-development tasks.`（与现有 description 英文语言一致；检索面即技能加载器的匹配面，反例信号直接作用于误激活防御）
- 触发决策表第 3 行"不启用"单元格扩充：10 个负向类别名一行速览 + 链接 `references/activation-guide.md`；
- 其余结构不动（"立即启用"行与"先询问"行语义不变）。

### §5 runner.ts 扩展

- 新断言类型 `NotContainsAssertion { type: 'notContains'; target: string; substring: string }`；
- Mapping 增加可选字段 `category?: string`、`route?: 'enable' | 'ask' | 'skip'`（向后兼容，旧条目无此字段不报错）；
- mappings.json 升 version 2，顶层新增声明式 matrix：

```json
"matrix": {
  "routeTotals": { "skip": 22, "ask": 8, "enable": 12 },
  "minPerCategory": 2,
  "guidePath": "w-model-dev/references/activation-guide.md"
}
```

- 新函数 `coverageMatrix` 五项校验：
  1. 语料每条的 route/category 与 mappings 对齐（保留既有 prompts↔mappings 1:1 crossCheckIds）；
  2. 各 route 总数与 matrix.routeTotals 声明一致；
  3. 每个负向/歧义类别条数 ≥ minPerCategory；
  4. guide 中每个类别节（标题锚）存在，且节内示例数 == 该类语料条数（防双份维护漏改的核心断言）；
  5. 每个负向类别 ≥ 1 条 notContains 类别守卫断言（类别名不得出现在 SKILL.md「立即启用」行）；
- `--self-check` 扩展 notContains 与 matrix 校验的已知真/假用例（复用现有 FileSystemAdapter 注入模式）；
- results.json 增 matrix 摘要块；exit code 语义不变；无新依赖。

### §6 L0 复用指南（docs/INSTALL.md 新节「子能力单独复用」）

- 可单独拷贝（方法论自包含，初判清单，实现时做一次依赖审计确认）：`root-cause-locator.md` / `iceberg-sweep-guide.md` / `agent-personas.md` + `subagent/` 人格库 / `conventions.md` / `estimation-guide.md` / `context-management-guide.md` / `coding-quality.md` / `toolbox.md`；
- 不可单独拷贝（依赖编排/状态/门禁）：`phase-N-*.md` / `subagent-delegation.md` / `signature-chain-guide.md` / `rtm-guide.md` / `graph-guide.md` / `hard-constraints.md`（反模式回退链引用门禁脚本与阶段状态）；
- 版本对齐义务：拷贝时记录上游 SKILL.md version，更新须手工对齐；单独拷贝不带门禁脚本语义；
- `docs/adoption-guide.md` 加交叉链接；
- 定位声明：可跨任务迁移的是方法论原子，不是流程整体——这是对论文"迁移密度"视角的仓库内正确回应。

### §7 治理链与同步面（SSoT 优先顺序，共 8 步）

1. `docs/skill-design-document_SSoT.md`：新增「触发边界与反例登记册」节（权威定义：类别全集、route 三值语义、prompts=数据源 / activation-guide=视图 / matrix=一致性契约、L0 复用分级原则）；
2. `w-model-dev/SKILL.md`（§4 改造）；
3. `w-model-dev/references/activation-guide.md`（新建）；
4. `eval/w-model-dev-test-prompts.json` + `eval/mappings.json`（v2）+ `eval/runner.ts`；
5. `eval/README.md`：修正过时描述（现称"共两个文件"，与实际清单不符），补 matrix 机制说明；
6. `docs/INSTALL.md` 复用指南节 + `docs/adoption-guide.md` 交叉链接；
7. `README.md` / `AGENTS.md`（references 计数 40→41 等目录速查同步）+ `CHANGELOG.md`；
8. `eval/w-model-dev-results.tsv` 新增 dry_run 轮次行（9 列格式照旧）。

实现时验证点：跑 `check-docs-consistency.ts` 确认是否消费 references 计数，若消费则在脚本登记处同步。

### §8 验收清单

- `npx tsx eval/runner.ts --self-check` exit 0（含新增 notContains / matrix 用例）；
- `npm run eval` exit 0（60/60 通过 + matrix 全绿）；
- `npm run self-test` exit 0（262 条基线不受影响）；
- `npm run prepush` 全过（17 项，Windows Git Bash）；
- 破坏性验证（实现时各做一次，验后恢复）：临时删 activation-guide 某节一条示例 → `npm run eval` 必须失败；临时把某类别名写进 SKILL.md 启用行 → notContains 守卫必须失败。

### §9 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 语料/guide 双份维护漏改 | matrix 校验④（节内示例数 == 语料条数）+ 破坏性验证 |
| frontmatter 加长影响检索精度 | 反例信号单句控制在一行内 |
| 60 条"精编独立性"主观 | 每条验收 checklist（§2 末） |
| check-docs-consistency 计数漂移 | 实现时跑门禁定位登记点再同步 |
| 类别边界争议（如 N9 单点指令 vs 已有 `.w-model` 状态的项目） | guide 每节强制写"边界说明：何时升级为 ask/enable" |

## 3. 非目标（明确不做）

- 不拆分技能包、不引入子技能图谱 / Planner / 嵌入检索；
- 不引入嵌入模型或任何新 devDep；
- 不改变 8 阶段流程语义、触发决策表前两行语义、门禁脚本退出码约定；
- 不在本 campaign 内创建独立子技能副本（L0 分发仅文档级，试点拆包留待未来按需求评估）。
