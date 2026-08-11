# 第二十五轮（2026-07-30）codegraph + OpenSpec 集成设计规格

> **创建日期**：2026-07-30
> **轮次**：Round 25
> **触发原因**：用户要求阶段 5 起引入 codegraph（修改前影响分析）与 OpenSpec opsx（任务规划层），增强代码修改安全性与任务拆解规范性
> **修正范围**：阶段 5-8 全部引入双工具；三段式 S 分派；每段 R3×3 + V 审查；依赖自动安装初始化
> **执行模式**：待定（spec 评审后由用户选择 Subagent-Driven / Inline）
> **版本变更**：23.0.0 → 24.0.0

---

## 一、背景

### 1.1 触发缘由

Round 24 完成 P0-P3 技能包问题修正后，技能包在阶段 5-8 的代码实现环节存在两个增强点：

1. **修改前影响分析缺失**：现有机制只有"修改后回归"（code-TLA+ 一致性校验），缺乏"修改前预防"（影响半径查询）。S-coding 子代理在 Edit/Write 前无法量化修改波及范围，可能误改被广泛依赖的符号。
2. **任务拆解规范性不足**：阶段 5 现有 S-tickets（tracer-bullet 垂直切片 + blocking edges DAG）解决了"如何切片"，但缺乏规格级"做什么/为什么"的显式规划层，规划与实现边界模糊。

### 1.2 引入工具

经联网调研确认两个第三方工具的能力定位：

| 工具 | 仓库 | 定位 | 集成方式 |
|---|---|---|---|
| **codegraph** | colbymchenry/codegraph | 100% 本地的语义代码图谱，提供符号级 callers/callees/blast radius 查询 | 宿主 Agent MCP（`codegraph_explore`）+ auto-sync |
| **OpenSpec** | Fission-AI/OpenSpec | 规格驱动变更管理，提供 opsx:explore/propose/apply/archive 工作流 | 宿主 Agent CLI/技能（`/opsx:*`） |

### 1.3 设计目标

- 阶段 5-8 所有代码/测试文件修改前强制 codegraph 影响分析（预防层）
- 阶段 5-8 引入 opsx 工作流做规格级规划，与现有 S-tickets（代码级切片）共存
- 三段式 S 分派（S-explore / S-propose / S-coding），每段产物跑 R3 三维度 + V 评审
- 技能包自动检测并安装/初始化两个工具的依赖，仅自动处置失败时才 CHECKPOINT

---

## 二、工具调研结论

### 2.1 codegraph

**能力**：
- 构建项目完整代码图谱（符号、调用关系、类型层级），100% 本地运行
- auto-sync：文件变更自动更新图谱，索引永不过期
- MCP 工具 `codegraph_explore`：查询符号的 callers / callees / blast radius
- 支持 Claude Code / Cursor / Codex 等多 Agent

**安装命令**（官方 README）：
```bash
# 方式1：npm 全局安装
npm i -g @colbymchenry/codegraph
# 方式2：脚本安装（curl/irm）
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh  # macOS/Linux
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex       # Windows
```

**Agent 注册**（自动注入 MCP 配置）：
```bash
codegraph install         # 交互式，连接 Agent
codegraph install --yes   # 非交互式（本设计采用）
```

**项目初始化**：
```bash
codegraph init            # 创建 .codegraph/ 并构建完整图谱（一步到位）
```

**升级 / 卸载**：
```bash
codegraph upgrade         # 原地升级
codegraph uninstall       # 移除 Agent 配置 + CLI
```

**关键约束**：技能包不内置 codegraph 调用，依赖宿主 Agent 的 MCP 工具 `codegraph_explore`。

### 2.2 OpenSpec

**能力**：
- opsx 工作流：explore（思路探索）→ propose（规格规划）→ apply（实现）→ archive（归档）
- propose 产出标准制品：`proposal.md` / `specs/` / `design.md` / `tasks.md`
- explore 不产出正式制品（思考伙伴）
- apply 按 tasks.md 推进实现
- archive 归档完成的变更到 `openspec/changes/archive/`

**安装命令**（官方 README）：
```bash
npm install -g @fission-ai/openspec@latest
openspec init             # 初始化 openspec/ 目录
```

**opsx 命令**（宿主 Agent 技能/CLI）：
```
/opsx:explore             # 思路探索，无制品
/opsx:propose <change>    # 产 proposal/specs/design/tasks
/opsx:apply               # 按 tasks 推进实现
/opsx:archive             # 归档变更
```

**关键约束**：技能包不内置 opsx 调用，依赖宿主 Agent 的 `/opsx:*` 技能。

---

## 三、集成架构

### 3.1 总体架构与范围

**轮次定位**：第 25 轮（SSoT §3.4.21），版本号 `23.0.0 → 24.0.0`（三处同步：package.json + SKILL.md frontmatter + skill-metadata.json）。

**外部工具边界**（SSoT §3.3 扩展）：
- codegraph = 宿主 Agent MCP 工具，技能包通过 CHECKPOINT/子代理指令触发查询，不内置调用
- OpenSpec = 宿主 Agent CLI/技能，技能包通过 CHECKPOINT/子代理指令触发 opsx 命令，不内置调用

**应用范围**：阶段 5-8（编码 + 集成/系统/验收测试，所有产出代码的阶段）。阶段 1-4 不受影响（仍是 A/S-doc/S-tla/S-bdd 流程）。

**与现有架构关系**：
- codegraph（修改前预防）与 code-TLA+ 一致性校验（修改后回归）互补，不冲突
- OpenSpec opsx（规格级规划层）与 S-tickets（代码级垂直切片）共存：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how，端到端切片），opsx:apply 内部按票据执行
- 三段式 S 分派：`S-explore → S-propose → S-coding`（S-coding 内含 S-tickets 拆解）

### 3.2 依赖自动检查与安装初始化

**三层检测 + 自动处置矩阵**：

| 层级 | 检测项 | 检测方式 | 缺失时自动处置 | 失败处置 |
|---|---|---|---|---|
| **L1 CLI** | codegraph CLI | `codegraph --version` | `npm i -g @colbymchenry/codegraph` | CHECKPOINT |
| **L1 CLI** | openspec CLI | `openspec --version` | `npm i -g @fission-ai/openspec@latest` | CHECKPOINT |
| **L2 Agent 注册**（仅 codegraph） | `codegraph_explore` MCP 工具可调用 | 尝试调用 `codegraph_explore` 查询一个探针符号（如项目入口 `main`/`index`），成功则可调用，超时/报错则缺失 | `codegraph install --yes`（非交互注入 MCP 配置） | CHECKPOINT（需用户手动跑交互式 `codegraph install`） |
| **L3 项目** | codegraph 图谱 | `.codegraph/` 目录存在 | `codegraph init` | CHECKPOINT |
| **L3 项目** | openspec 工作区 | `openspec/` 目录存在 | `openspec init` | CHECKPOINT |

**执行时机**：
- **阶段 5 进入 CHECKPOINT**：运行 `scripts/ensure-codegraph-opsx.ts --phase 5 --full`，完整跑 L1→L2→L3，输出结构化报告，退出码 0=就绪 / 1=有 CHECKPOINT
- **阶段 6-8 进入**：运行 `scripts/ensure-codegraph-opsx.ts --phase <N> --quick`，仅复检 L1（CLI 可用）+ L3（目录存在），不重装；L2 MCP 注册一次即持久
- **技能启动健康检查**：SKILL.md 加载时运行 `scripts/ensure-codegraph-opsx.ts --phase 5 --light`，仅跑 L1 轻检，缺失则在最早 CHECKPOINT 提示

**脚本设计**（`scripts/ensure-codegraph-opsx.ts`）：
```
输入: --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>
模式:
  full   = L1→L2→L3 全量检测+自动处置（阶段 5 首次进入）
  quick  = L1+L3 快速复检（阶段 6-8 进入）
  light  = 仅 L1 轻检（技能启动健康检查）
流程(full 模式):
  1. L1: codegraph --version → 缺失则 npm i -g @colbymchenry/codegraph → 复验 --version
  2. L1: openspec --version → 缺失则 npm i -g @fission-ai/openspec@latest → 复验 --version
  3. L2: 调用 codegraph_explore 查探针符号(main/index) → 报错则 codegraph install --yes → 复验探针查询
  4. L3: 检测 .codegraph/ → 缺失则 codegraph init
  5. L3: 检测 openspec/ → 缺失则 openspec init
  6. 输出 JSON: { layer, item, status: ready|installed|checkpoint, detail }[]
退出码: 0=全 ready/installed / 1=有 checkpoint
注: quick 跳过 L2；light 仅跑 L1 步骤 1-2
```

**幂等性**：所有检测+安装均幂等（已安装则跳过，`codegraph init` 已存在目录则跳过，`openspec init` 已存在则跳过）。脚本可安全重复执行。

**与现有 gate 脚本集成**：`ensure-codegraph-opsx.ts` 作为阶段 5-8 gate 的前置子检查，纳入 `phase5-gate`（及 6/7/8）调用链；失败（退出码 1）阻塞阶段进入。

### 3.3 codegraph 集成

**初始化**：阶段 5 进入时，`ensure-codegraph-opsx.ts` 执行 `codegraph init` 构建 `.codegraph/` 图谱（若已存在则跳过）。阶段 6-8 进入时图谱已存在，依赖 auto-sync 保持新鲜。

**核心机制——修改前强制查询（新约束 #20）**：
- S-coding 子代理在**任何**代码/测试文件 `Edit`/`Write` 前，必须先调用 `codegraph_explore` MCP 工具查询目标符号的影响半径
- 查询三要素：**callers**（谁调用了它）/ **callees**（它调用了谁）/ **blast radius**（修改波及范围）
- 查询结果落盘：`.w-model/codegraph-queries/<phase>-<ticket-id>-<symbol>.json`，含 `querySymbol` / `callers[]` / `callees[]` / `blastRadius` / `queryTimestamp`
- **未查询直接修改 → 命中新反模式 #38**

**影响分析契约**：
```
S-coding 修改前流程:
  1. codegraph_explore(目标符号) → 查询影响半径
  2. 落盘查询结果到 .w-model/codegraph-queries/
  3. 评估：修改是否波及 callers？是否需同步改 callees？
  4. 安全确认后 Edit/Write 代码
  5. （可选）修改后再查一次确认影响未意外扩大
```

**与 code-TLA+ 一致性校验的关系**：

| 维度 | codegraph | code-TLA+ 一致性 |
|---|---|---|
| 时机 | 修改**前**（预防） | 修改**后**（回归） |
| 校验内容 | 符号级影响半径（callers/callees/blast radius） | SD→codeModule 映射 / 状态转移 / Next 分支 / 不变式 |
| 失败处置 | 打回 S-coding 重新评估影响 | 打回 S-coding 返工（R→S-fix 流程） |

### 3.4 OpenSpec opsx 集成（含 S-tickets 共存）

**opsx 工作流映射到阶段 5-8**：

```
opsx:explore  → S-explore 子代理：思路探索 + codegraph 影响初判
                  产物：exploration-analysis.md（方案对比/推荐方案/影响初判）
opsx:propose  → S-propose 子代理：规格级变更规划 + S-tickets 代码级垂直切片拆解
                  产物：openspec/changes/<change>/{proposal.md, specs/, design.md, tasks.md}
                       + tickets.md（tracer-bullet + blocking edges DAG）
                  职责边界：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how，端到端切片）
opsx:apply    → S-coding 子代理：按 tickets.md frontier 逐片编码
                  每片修改前 codegraph_explore
opsx:archive  → V/G 通过后 S 子代理归档：openspec/changes/archive/
```

**opsx 与 S-tickets 共存机制**（统一由 S-propose 子代理产出，消除歧义）：
- S-propose 子代理在一次分派中先后执行：`opsx:propose`（产 tasks.md）→ S-tickets 拆解（产 tickets.md）
- `opsx:propose` 的 **tasks.md** = 高层任务清单（what/why，实现步骤概述）
- `S-tickets` 的 **tickets.md** = 代码垂直切片（how，每片贯穿 schema+service+store+单元测试，端到端可 demo）
- `opsx:apply` 内部按 `tickets.md` 的 **frontier**（blockers 全完成的票据）分派 S-coding，与现有 tracer-bullet 机制一致
- **不替代**：opsx:propose 不产出 tickets.md（那是 S-tickets 职责）；S-tickets 不产出 proposal/design（那是 opsx:propose 职责）
- **S-coding 不做拆解**：S-coding 只按 tickets.md frontier 执行，不参与切片规划

**目录结构**（与 `.w-model/` 并列）：
```
project-root/
├── .w-model/              # 现有状态文件
├── .codegraph/            # codegraph 图谱（codegraph init 产出）
├── openspec/              # OpenSpec 变更管理
│   ├── config.yaml        # openspec 项目配置（可选）
│   └── changes/
│       ├── phase5-<feature>/   # 当前进行中的变更
│       │   ├── proposal.md
│       │   ├── specs/
│       │   ├── design.md
│       │   └── tasks.md
│       └── archive/            # 已归档变更
└── src/                   # 业务代码
```

**change-name 命名规范**：`phase<N>-<feature-or-test-type>`，如 `phase5-article-lifecycle` / `phase6-integration-test` / `phase7-system-test` / `phase8-acceptance-test`。

**opsx:archive 时机**：阶段门 V/G 全通过后，S 子代理执行 `opsx:archive` 将变更归档到 `openspec/changes/archive/<date>-<change-name>/`。归档完整性纳入现有 `check-archive-integrity.ts` 校验范围（新增 openspec 制品清单）。

**阶段 6-8 适配**：
- 阶段 6（集成测试）：opsx:explore 探索集成策略 → opsx:propose 规划集成测试用例 → S-tickets 拆解测试代码切片 → opsx:apply 编写测试（每片 codegraph_explore 查被测模块影响）
- 阶段 7/8 同理，apply 产出对应测试代码

---

## 四、三段式 S 分派 + R3×3 + V 审查流程

### 4.1 阶段 5-8 统一分派模型

每阶段一个变更 change，分派流程如下：

```
O(编排)
 ├─ S-explore 子代理
 │    调用: opsx:explore + codegraph_explore(影响初判)
 │    产物: exploration-analysis.md(方案对比/推荐/codegraph 影响初判)
 │    审查: R3×3(completeness/reliability/security) → V 评审
 │    不合格 → 打回 S-explore 重做
 │
 ├─ S-propose 子代理
 │    调用: opsx:propose → 产 proposal.md/specs/design.md/tasks.md
 │         + S-tickets 拆解 → tickets.md(tracer-bullet + blocking edges DAG)
 │    产物: openspec/changes/<change>/{proposal,specs,design,tasks}.md + tickets.md
 │    审查: R3×3 → V 评审
 │    不合格 → 打回 S-propose 重做
 │
 ├─ S-coding 子代理(按 tickets.md frontier 逐片)
 │    每片流程:
 │      a. codegraph_explore(目标符号) → 落盘 .w-model/codegraph-queries/
 │      b. 评估影响半径 → 安全确认
 │      c. opsx:apply 推进该片 → Edit/Write 代码 + 单元测试
 │      d. 该片完成后: code-TLA+ 一致性校验(修改后回归)
 │    全部切片完成后产物: 代码 + 测试 + codegraph-queries/ + TLA 校验报告
 │    审查: R3×3 → V 评审
 │    不合格 → 打回 S-coding(指定返工票据)
 │
 └─ G(阶段门) → 通过后 S 子代理 opsx:archive
```

### 4.2 R3 三维度审查产物模板

每段每维度一份 R3 报告，落盘到 `.w-model/r3-reviews/<phase>-<stage>-<dimension>.md`：

| 维度 | 审查要点 |
|---|---|
| **completeness** | 产物是否覆盖 spec 要求的所有项（opsx 制品齐全 / S-tickets 切片完整 / codegraph 查询落盘） |
| **reliability** | 逻辑正确性、边界条件、错误处理、codegraph 影响半径评估是否充分 |
| **security** | 输入校验、权限、依赖安全、codegraph blast radius 是否可控 |

### 4.3 V 评审

每段 R3×3 完成后，V 角色评审 R3 报告 + 段产物，输出 `.w-model/v-reviews/<phase>-<stage>.md`，含：
- 三维度 R3 报告汇总
- 通过/不通过判定
- 不通过时的返工清单

### 4.4 打回机制

V 评审不合格时，编排器 O 生成 `rework-ticket.md`，指定：
- 返工段（explore/propose/coding）
- 返工原因
- R3/V 发现的问题清单
S 子代理据此重做后重审。

### 4.5 审查重量估算

| 阶段 | S 分派 | R3 报告 | V 评审 | 备注 |
|---|---|---|---|---|
| 阶段 5（编码） | 3 | 9 | 3 | 最重（切片多，可能 1-2 轮打回） |
| 阶段 6（集成测试） | 3 | 9 | 3 | 较重 |
| 阶段 7（系统测试） | 3 | 9 | 3 | 较重 |
| 阶段 8（验收测试） | 3 | 9 | 3 | 较重 |
| **合计** | **12** | **36** | **12** | + 可能打回轮次 |

---

## 五、新增约束 / 反模式 / 脚本

### 5.1 新增约束 #20

> 阶段 5-8 任何代码/测试文件修改前，S-coding 子代理必须先调用 `codegraph_explore` 查询目标符号影响半径（callers/callees/blast radius），并将查询结果落盘到 `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`。未查询直接修改视为违反约束 #20。

写入位置：`w-model-dev/SKILL.md` 约束块（第 36-58 行编号列表，追加第 20 条）。

> **注**：经上下文核实，`constraints.schema.json` 不存在——约束以纯 Markdown 编号列表存于 SKILL.md，SSoT §3.4.x 轮次记录中仅以"新增约束 #N"文本引用。

### 5.2 新增反模式

| # | 名称 | 描述 |
|---|---|---|
| **#38** | 修改前未查询 codegraph | 阶段 5-8 跳过 codegraph 影响分析直接修改代码 |
| **#39** | 跳过 opsx 产物审查 | opsx 工作流步骤产物（exploration/proposal/apply）未经 R3×3 + V 审查即进入下一步 |
| **#40** | opsx/S-tickets 职责混淆 | 用 opsx:propose 的 tasks.md 替代 S-tickets 的 tickets.md，或反之 |

写入位置：`w-model-dev/references/anti-patterns.md`（二级标题分节格式 `## #N 标题（第25轮新增）`，含危害/检测信号/回退动作/门禁脚本/关联 6 段）。

> **注**：经上下文核实，`anti-patterns.schema.json` 不存在——反模式以纯 Markdown 二级标题分节存于 references/anti-patterns.md。

### 5.3 新增脚本

| 脚本 | 职责 | 退出码 |
|---|---|---|
| `scripts/ensure-codegraph-opsx.ts` | 三层依赖检测+自动安装初始化（§3.2） | 0=就绪 / 1=有 CHECKPOINT |
| `scripts/check-codegraph-queries.ts` | 校验阶段 5-8 每次 Edit/Write 前都有对应 codegraph-queries 落盘文件；命中反模式 #38 则失败 | 0=通过 / 1=失败 |
| `scripts/check-opsx-artifacts.ts` | 校验每阶段 opsx 变更目录制品齐全（proposal/specs/design/tasks + tickets）+ R3×3+V 审查产物齐全；命中 #39/#40 则失败 | 0=通过 / 1=失败 |
| `scripts/check-openspec-archive.ts` | 校验阶段门通过后 opsx:archive 已执行，archive/ 下制品完整 | 0=通过 / 1=失败 |

### 5.4 schema 与逻辑扩展

> **经上下文核实**：`constraints.schema.json` / `anti-patterns.schema.json` / `phase-gate.schema.json` 三个文件均不存在。约束存于 SKILL.md 编号列表，反模式存于 references/anti-patterns.md 二级标题分节，阶段门校验逻辑存于 `scripts/gate-logic.ts` + `check-artifact-gate.ts`。因此本节改为扩展真实存在的文件。

| 文件 | 变更 |
|---|---|
| `w-model-dev/schemas/run-log.schema.json` | action 枚举（第 14 行，现有 19 个值）增加 `codegraph_query` / `opsx_explore` / `opsx_propose` / `opsx_apply` / `opsx_archive` / `ensure_deps` |
| `w-model-dev/scripts/logic/gate-logic.ts` | 阶段 5-8 gate 校验增加 `codegraphQueriesValid` / `opsxArtifactsValid` / `openspecArchived` 三个布尔校验逻辑（调用 check-codegraph-queries.ts / check-opsx-artifacts.ts / check-openspec-archive.ts） |

---

## 六、SSoT 资产同步清单

### 6.1 SSoT §3.4.21 新增（第 25 轮记录）

- 引入 codegraph（修改前影响分析）+ OpenSpec opsx（任务规划层），应用阶段 5-8
- 三段式 S 分派：S-explore / S-propose / S-coding，每段 R3×3 + V
- codegraph 修改前强制查询（约束 #20）+ 落盘
- opsx 与 S-tickets 共存（tasks.md vs tickets.md 职责边界）
- 依赖自动检查与安装初始化（ensure-codegraph-opsx.ts）
- 版本 23.0.0 → 24.0.0

### 6.2 资产同步清单（22 项）

> **经上下文核实修正**：SSoT 无 §3.2 约束表/§3.3 反模式表（约束/反模式散落在 §3.4.x 轮次记录中引用）；三个 schema 文件不存在。清单已据此修正。

| # | 资产 | 变更内容 |
|---|---|---|
| 1 | `w-model-dev/SKILL.md` 约束块（第 36-58 行） | 追加第 20 条：codegraph 修改前强制查询 |
| 2 | `w-model-dev/references/anti-patterns.md` | 追加 #38 / #39 / #40 三条（二级标题分节格式） |
| 3 | SSoT §3.3 外部工具边界（第 242 行起） | + codegraph / OpenSpec 边界声明 |
| 4 | SSoT §3.4.21（第 720 行 `---` 前插入） | 第 25 轮记录（仿 §3.4.20 格式） |
| 5 | SSoT §3.4.21 触发说明 | 声明版本号目标 24.0.0（SSoT 无独立版本字段） |
| 6 | `w-model-dev/SKILL.md` frontmatter（第 3 行） | version → 24.0.0 |
| 7 | `w-model-dev/SKILL.md`「Bundled Resources」（第 199-290 行） | + codegraph/opsx 触发条件 |
| 8 | `w-model-dev/SKILL.md` 阶段 5-8 流程（第 148-184 行） | + 三段式 S 分派 + codegraph 修改前查询 |
| 9 | `w-model-dev/skill-metadata.json`（第 3 行） | version → 24.0.0，updatedAt → 2026-07-30 |
| 10 | `package.json`（第 3 行） | version → 24.0.0 |
| 11 | `w-model-dev/references/phase-5-coding.md` | + opsx 三段式 + codegraph + S-tickets 共存（第 51-119 行 S-tickets 节扩展） |
| 12 | `w-model-dev/references/phase-{6,7,8}-*.md` | + opsx 三段式 + codegraph |
| 13 | `w-model-dev/references/subagent-delegation.md`（第 195-261 行 S 拆分机制） | + S-explore / S-propose / S-coding 变体分派模板 |
| 14 | `w-model-dev/schemas/run-log.schema.json`（第 14 行 action 枚举） | + `codegraph_query` / `opsx_explore` / `opsx_propose` / `opsx_apply` / `opsx_archive` / `ensure_deps` |
| 15 | `w-model-dev/scripts/logic/gate-logic.ts` | + `codegraphQueriesValid` / `opsxArtifactsValid` / `openspecArchived` 三个布尔校验逻辑 |
| 16 | `docs/INSTALL.md` | + codegraph/OpenSpec 自动安装说明节 |
| 17 | `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts` | 新增（三层依赖检测+自动安装初始化） |
| 18 | `w-model-dev/scripts/cli/check-codegraph-queries.ts` | 新增（校验 codegraph 查询落盘，命中 #38） |
| 19 | `w-model-dev/scripts/cli/check-opsx-artifacts.ts` | 新增（校验 opsx 制品+审查产物，命中 #39/#40） |
| 20 | `w-model-dev/scripts/cli/check-openspec-archive.ts` | 新增（校验 opsx:archive 归档完整性） |
| 21 | `w-model-dev/scripts/cli/self-test.ts` | + codegraph/opsx 相关 self-test 用例（4 组 CASES + runner + main 注册） |
| 22 | `w-model-dev/scripts/samples/` | + codegraph-queries / opsx-artifacts / openspec-archive 样本文件 |

---

## 七、验证策略

### 7.1 单元测试

新增 4 个脚本的单元测试（`scripts/__tests__/`）：
- `ensure-codegraph-opsx.test.ts`：模拟各层缺失场景，验证自动处置 + 退出码
- `check-codegraph-queries.test.ts`：构造有/无落盘文件场景，验证 #38 命中
- `check-opsx-artifacts.test.ts`：构造制品缺失场景，验证 #39/#40 命中
- `check-openspec-archive.test.ts`：构造未归档/归档不完整场景，验证失败

### 7.2 self-test 用例

新增 self-test 用例验证：
- 约束 #20 在 constraints.schema.json 中存在且可校验
- 反模式 #38/#39/#40 在 anti-patterns.schema.json 中存在且可校验
- phase-gate.schema.json 三个新布尔字段存在
- run-log.schema.json 六个新 action 枚举存在
- 版本号三处一致（24.0.0）

### 7.3 TypeScript 严格模式

所有新增脚本通过 `tsc --noEmit` 0 错误。

### 7.4 端到端调测（可选，Round 26）

在 blog-system-demo 上跑完整 8 阶段，验证阶段 5-8 的 codegraph + opsx 集成在实际开发中的效果。

---

## 八、风险与回退

### 8.1 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| codegraph MCP 工具在宿主 Agent 不可用 | 中 | 阶段 5-8 无法做影响分析 | ensure-codegraph-opsx.ts L2 检测 + CHECKPOINT 提示用户手动 `codegraph install` |
| codegraph 图谱构建慢（大项目） | 低 | 阶段 5 进入延迟 | codegraph init 一次性构建，后续 auto-sync 增量 |
| opsx 命令在宿主 Agent 不可用 | 中 | 无法跑 opsx 工作流 | ensure-codegraph-opsx.ts L1 检测 + CHECKPOINT |
| token 消耗激增（每阶段 9 R3 + 3 V） | 高 | 阶段执行成本上升 | 接受（用户已确认方案 A）；可后续优化为按需 R3 |
| npm 全局安装权限问题 | 低 | L1 自动安装失败 | CHECKPOINT 提示用户手动安装或用 npx |

### 8.2 回退

若集成出现问题，回退路径：
1. 注释掉 phase-gate 中 `codegraphQueriesValid` / `opsxArtifactsValid` / `openspecArchived` 三个字段的强制校验
2. SSoT §3.4.21 标注"Round 25 集成暂缓，待 Round 26 修复"
3. 版本号回退至 23.0.0
4. 保留所有新增脚本和 schema 字段（不删除），仅禁用强制校验

---

## 九、执行模式选择

本 spec 评审通过后，由用户选择执行模式：
- **Subagent-Driven**（推荐）：22 项资产同步任务按依赖关系分批派给子代理执行
- **Inline Execution**：编排者内联完成所有改动

---

## 十、开放问题

无。所有设计决策已在 brainstorming 阶段确认：
1. 应用阶段范围：阶段 5-8 全部
2. opsx 与 S-tickets 关系：共存
3. codegraph 同步语义：修改前强制 codegraph_explore 查询
4. 三阶段 R 语义：复用 R3 三维度
5. 集成方案：方案 A（三段式 S 分派，每段 R3×3 + V）
6. 依赖安装：技能自动检查并安装初始化
