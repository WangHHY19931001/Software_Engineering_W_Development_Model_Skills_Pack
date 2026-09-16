# 阶段 5：编码实现（执行单元测试）

> W 模型左 V 第 5 阶段（编码），对应右 V 测试执行：**单元测试执行**。
> 命令入口：`/wm code <功能描述>`（生成代码 + 单元测试）+ `/wm test type=单元 result=<pass|fail>`；`result` 只能由真实测试运行器输出回填。

## 功能描述

根据《详细设计文档》生成代码，并将阶段 4 设计的单元测试用例实现为可执行测试代码，执行后产出覆盖率报告。

## 输入

- 《详细设计文档》（阶段 4 产出）
- 单元测试用例设计（阶段 4 产出）
- 技术栈要求

## 输出

- 完整代码实现（按技术栈分层：controllers / services / models / routes 等）
- 单元测试代码
- 测试覆盖率报告（套用 [templates/test-report.md](../templates/test-report.md)）

## AI 能力应用

- **代码自动生成**：依据类图 / 方法定义生成实现
- **代码质量检查**：语法、规范、安全
- **单元测试用例生成**：将设计用例转为可执行测试
- **测试执行与报告生成**：运行测试、统计覆盖率

## 任务分配规则：产品化 vs 系统集成

> 吸收自《agent 时代的人月神话》第 1 章「九倍矩阵」：9x = 3x（产品化）× 3x（系统集成）。

- **产品化类任务**（判据住代码内，agent 擅长）：补文档、测试、类型注解、错误处理、边界情况、重构 → 优先分派 S 子代理。
- **系统集成类判断**（判据住大系统处境里，agent 不擅长）：对接外部系统、生产环境适配、跨模块契约裁决、版本兼容决策 → 必须由人/主刀持有，不得外包给 agent。
- 完成度判定："agent 跑通了"只证明左下角（1x 一次性脚本）；交付到右上角（可依赖构件产品）须产品化轴与系统集成轴逐项自检（见 [quick-self-check.md](quick-self-check.md)「完成定义（DoD）」节「完成度矩阵自检」）。

## 增量集成纪律

> 吸收自《agent 时代的人月神话》第 11/13 章：修复引入新 bug 概率 20-50%（agent 时代只高不低）；大而稀的整体重写让"这次改了什么"在结构上不可问。

- **每次 agent 改动 = 可审 diff + 有对应测试 + 能被独立评审**。
- **禁止大而稀的整体重写式变更**（变更量子无穷大时连 diff 都不存在，"这次改了什么"在结构上不可问）。
- **回归测试强制钩子**（约束 #14）：任何 agent 改动代码后必须跑回归测试；禁止"改动代码但不跑回归"的工作流。

## 代码生成算法

```
输入: 详细设计文档
  1. 解析类和方法定义
     ├─ 失败: 设计文档字段缺失/类型不明 → 暂停并记为 R 定位线索；普通 V/G 失败先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）后，按 R 结论回 phase-4 补充详细设计
     └─ 成功: 产出结构化的类/方法/字段清单
  2. 根据技术栈生成代码模板
     ├─ 失败: 技术栈未在 project.json 登记 → 暂停向用户确认技术栈
     └─ 成功: 产出分层骨架（controllers/services/models/routes）
  3. 填充业务逻辑实现
     ├─ 失败: 依赖外部服务未定义 → 标注缺失依赖并暂停，不得伪造实现
     └─ 成功: 产出可编译的实现代码
  4. 生成单元测试代码（套用阶段 4 用例设计）
     ├─ 失败: 用例无明确断言 → 记为 R 定位线索；普通 V/G 失败先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），R 才可建议回阶段 4 补断言格式
     └─ 成功: 产出可执行测试文件
  5. 代码质量检查和优化
     ├─ 失败: ESLint/Prettier 报 error → 列出具体违规项并修复，禁止 // eslint-disable 绕过
     └─ 成功: 0 error 0 warning
输出: 可运行代码 + 单元测试 + 覆盖率报告
```

## codegraph 修改前影响分析

> 对应约束 #14 + 反模式 #38。阶段 5-8 任何代码/测试文件 `Edit`/`Write` 前，S-coding 须先调用宿主 Agent 的 `codegraph_explore` MCP 工具。

**修改前流程**（ChangeScope 绑定，2026-09-04 audit-gate-closure）：
1. **变更上下文**：阶段 5-8 门禁要求 codegraph 查询与实际变更绑定——S-coding 须维护 ChangeScope manifest（`schemas/change-scope.schema.json`，落盘如 `.w-model/change-scope.json`：`changeId` 含 `phaseN-` 前缀 / `phase` / `baseRef` / `headRef` / `scopeCreatedAt` / `changedFiles`），保证 `headRef=当前 HEAD`、`changedFiles` 与实际 Git 变更集合精确一致（门禁重算比对，不符 fail-closed）
2. `codegraph_explore(目标符号)` → 查询 callers / callees / blast radius
3. 落盘结果到 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`：除 querySymbol / callers[] / callees[] / blastRadius / queryTimestamp 外，strict 模式（阶段 5-8 CLI）**必须含 `changeId`（精确等于 scope.changeId）与 `targetFiles`（本次查询服务的变更文件，全部属于 scope.changedFiles；每条查询至少声明一个目标文件）**；`queryTimestamp` 不得晚于 scopeCreatedAt。记录结构见 `schemas/codegraph-query.schema.json`
4. 评估：修改是否波及 callers？是否需同步改 callees？
5. 安全确认后 `Edit`/`Write` 代码
6. （可选）修改后再查一次确认影响未意外扩大

**覆盖义务**：scope 中每个须覆盖的 code/test 变更文件（`docs/`、`schemas/`、`config/`、`eval/`、`.w-model/`、`openspec/` 等顶层段、dotfile 与 `*.md` 之外，按工程源码/测试扩展名判定，分类函数 `lib/change-scope.ts` `isCodeOrTestFile`）至少被一个合法查询的 `targetFiles` 覆盖——门禁校验的是**实际覆盖**而非目录存在；未查询/未绑定的变更文件逐文件 violation。`.githooks/` 下无扩展名脚本（如 pre-push）按 code 文件计，改动须被查询覆盖。

**门禁调用**：G 侧 `check-codegraph-queries.ts <project-root> --phase 5|6|7|8 --scope=<change-scope.json>`（或薄封装 `--change=<id> --base=<ref> --head=<ref>`；缺 scope → exit 1 fail-closed；文件/JSON/schema 非法 → exit 2）；阶段 5-8 artifact gate（`check-artifact-gate.ts --phase=N --scope=<file>`）把本 checker 与 opsx strict 校验聚合进 reasons/exitCode。

**与 code-TLA+ 一致性校验的关系**：codegraph = 修改前预防，code-TLA+ = 修改后回归，互补不冲突。

## OpenSpec opsx 三段式 S 分派

> 阶段 5-8 引入 opsx 工作流做规格级规划，与 S-tickets（代码级切片）共存。

**三段式分派**：
```
S-explore  → opsx:explore + codegraph 影响初判 → 产物 exploration-analysis.md → R3×3 + V
S-propose  → opsx:propose（产 proposal/specs/design/tasks）+ S-tickets 拆解（产 tickets）→ R3×3 + V
S-coding   → 按 tickets.md frontier 逐片编码，每片 codegraph_explore → R3×3 + V
```

**opsx 与 S-tickets 共存边界**（统一由 S-propose 产出）：
- `opsx:propose` 的 **tasks.md** = 高层任务清单（what/why）
- `S-tickets` 的 **tickets.md** = 代码垂直切片（how，端到端可 demo）
- **S-coding 不做拆解**，只按 tickets.md frontier 执行

**每段 R3×3 + V 审查**：每段产物须跑 R3 三维度（completeness/reliability/security）+ V 评审，不合格打回重做（反模式 #39）。

## Tracer-bullet 票据拆解

> 吸收 to-tickets tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract 方法论。S 子代理编码前兼任 S-tickets 角色，产出 `tickets.md` 作为 S-coding 执行单元。

### 时序

```
原时序: O 路由 → CHECKPOINT → S-coding（直接编码）→ V → G
新时序: O 路由 → CHECKPOINT → S-tickets（票据拆解）→ S-coding（按票据执行）→ V → G
```

- S-tickets 由 S 子代理兼任（不新增角色）
- S-tickets 产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- S-tickets 必须在 S-coding 前完成，V/G 不单独评审 tickets.md（合并到阶段 5 V/G 评审）

### 票据清单模板

```markdown
## Tracer-bullet 票据拆解

### 票据清单
| # | 标题 | Blocked by | What it delivers | Status |
|---|---|---|---|---|
| 01 | <标题> | None | <端到端行为，用户视角> | ready-for-agent |
| 02 | <标题> | 01 | <端到端行为> | blocked |
| ... | | | | |

### Wide refactor（如有）
- <refactor-1>: <机械改动描述> — blast radius <范围>
  - Expand: <ticket-id>（添加新形式，旧形式不破坏）
  - Migrate batch 1: <ticket-id>（blocked by Expand）
  - Migrate batch 2: <ticket-id>（blocked by batch 1）
  - Contract: <ticket-id>（删除旧形式，blocked by 所有 batch）
```

### vertical-slice 规则
- 每片贯穿全层（schema + service + store + 单元测试），不是单层切片
- 每片可独立 demo 或验证（独立跑测试通过）
- 每片大小适配单个新鲜上下文窗口（与"子代理任务 ≤1000 词"约束协同）
- 优先 prefactor：先做让实现更容易的预备改动（to-tickets 原则）

### Wide refactor 例外
- 单一机械改动（重命名/重类型）blast radius 跨全代码库时，不强制 tracer-bullet
- 用 expand-contract 序列：expand（新旧并存）→ migrate batches（每批 CI 绿）→ contract（删旧）
- 每批大小按 blast radius（按目录/按包）
- **兜底（扩展期跨多个部署单元 / 多批次时）**：当同一机械改动的 blast radius 横跨多个部署单元，使任何单独 migrate 批次都无法自证 CI 绿时，**保持 expand → migrate → contract 序列不变**，但让全部 migrate 批次**共享一条 integration 分支**；「绿」只在最后一张 **integrate-and-verify 票**上承诺，各 migrate 批次自身不再单独承诺绿。该票不改变 expand / migrate / contract 三阶段语义，只改变「绿在哪里被承诺」。
- **integrate-and-verify 票的内容契约**（沿用「票据内容契约」节三字段，一律符号级）：
  - **What to build**：在共享 integration 分支上合并全部 migrate 批次并完成验证——给出该宽重构的**符号级终态**（被重命名 / 被重类型的符号名及其新接口签名、类型约束或状态转移）与验证动作（跑全量回归 + 该符号全部调用点的契约测试）；不写文件路径与行号（位置由 `codegraph_explore` 查询决定）。
  - **Blocked by**：全部 migrate 批次票据；本票不反向阻塞任何 migrate 批次，各票既有 `Blocked by` 关系与 expand → migrate → contract 序列均不变，本票仅作为「绿」的唯一承诺点。
  - **验收标准**：integration 分支全量测试绿（含每批次的独立测试与该宽重构的回归测试）；被改符号的新旧两种形式在分支上均已通过契约测试；符号级检查确认无残留旧形式调用点（新形式调用点计数与调用点迁移清单一致）。

### 票据内容契约

```markdown
# <NN> — <标题>

**What to build:** 端到端行为，用户视角（非层-by-layer 实现列表）
**Blocked by:** <票据号/标题列表，或 "None — can start immediately">
**Status:** ready-for-agent | blocked | in-progress | done

- [ ] 验收标准 1
- [ ] 验收标准 2
```

- 禁止具体文件路径与代码片段（to-tickets 与 to-spec 共识：路径易过期）
- 例外：prototype 产出的决策密集片段（状态机/reducer/schema/type shape）可内联，标注来源
- 验收标准与 RTM `unitTest` 字段对应（每张票据 ≥1 单元测试）

### 票据内容 durability

> 对应外部 implement-* 系列 SKILL.md 的 Agent Brief durability 原则：票据主体是**符号级契约**（接口 / 类型 / 行为），不是**文件路径 / 行号**（fragile reference，重构即失效）。

- **票据主体 = 符号级契约**：目标行为的接口签名 / 类型约束 / 状态转移（与 TLA+ 状态机 Action 对齐），如「实现 `ArticleService.create` 契约：入参 `{title, content}`，返回 `Article`，触发状态 `draft → published`」——而非「改 `src/services/article-service.ts:42`」
- **位置信息交给 codegraph**（约束 #14）：文件路径由 `codegraph_explore` 查询获得，票据不预设路径。票据只写「实现 `XX` 符号契约」，位置由查询结果落盘的 `.w-model/codegraph-queries/` 决定
- **与评审 evidence 的边界**：评审 evidence 须路径 + 行号（[verifier-spec.md](verifier-spec.md) §6.2.1，可追溯性）；实施票据**不**须——二者定位不同：evidence 是「评审时证明我看过哪」，票据是「实现时做什么契约」
- 票据引用术语统一用 [conventions.md](conventions.md) 术语表规范名（如 `codeModule` / `mappingType`），不得自造别名

### Blocking edges 依赖图
- blocking edges 形成有向无环图（DAG）
- frontier = blockers 全完成的票据（可立即开始）
- 纯线性链：top to bottom
- 编排者按 frontier 一次性分派全部可启动票据（串行执行时按票据号顺序处理，与"主机不支持并行则串行"约束协同）
- 每张票据对应 RTM `codeModule` 字段的 ≥1 条目（SD-xxx:src/path 格式不变）
- 票据 ID（NN）不写入 RTM（RTM 保持现有 schema，不污染数据模型）
- 票据的 Next 分支实现必须与 TLA+ Action 名对应（与约束"TLA+ Next 分支 PascalCase ↔ code camelCase"协同）

### Preflight 成对冲突扫描表（开工前）

> 吸收 subagent-driven-development 的 preflight 扫描：分派第 1 张票据**之前**把票据清单整体扫一遍，扫描产物是**表**而不是结论——「扫描干净」而无对应行，即等于没扫。本表一律**符号级**表述（接口签名 / 类型约束 / 状态转移 / 类型与事件字段），与「票据内容 durability」节一致：不写具体文件路径与行号（位置由 `codegraph_explore` 查询决定），也不内联代码片段。

- **时机**：S-tickets 完成票据拆解与 `Blocked by` 依赖图之后、S-coding 分派第 1 张票据之前，逐对扫一遍；扫描表写入 `tickets.md`。
- **覆盖面（缺任一类行即视为未执行扫描）**：① 每对**共享同一符号**（同名接口 / 类型 / 状态机 Action / 事件字段）的票据各一行；② 每张票据自身一行（它声明的验收标准与其声明的符号契约是否自洽）；③ 票据与阶段全局约束（阶段 1-4 需求 / spec / RTM / TLA+ 不变式）相抵触的，各一行。
- **裁定**：扫描发现的每项冲突须在开工前裁定完毕，裁定以阶段 1-4 产物（需求 / spec / RTM / TLA+ 不变式）为约束权威、票据文本为被审对象；每项裁定记录在其冲突行旁。扫描干净则不作评论、直接推进 S-coding。
- **与 V/G 的分工**：本表只拦「票据文本之间 / 票据与全局约束之间」的静态冲突；实现期才暴露的冲突仍由 V/G 评审回路兜底，本表不替代 V/G。

| 冲突对（符号级） | 扫描动作（逐对扫一遍） | 发现冲突的处置 |
|---|---|---|
| 两票同时改**同一符号的契约**（接口签名 / 类型约束 / 状态转移） | 抽取全部票据声明的符号契约，按符号名配对，比对同一符号是否被给出**同一**终态签名 / 类型 / 状态转移 | 改为扩展式拆分：一票只做向后兼容的新形式，另一票 `Blocked by` 它；或把两处改动**合并**为一票 |
| 一票**新增字段 / 新增符号**，另一票假设其**不存在**（按旧类型约束或旧状态集消费） | 对每个被新增的类型字段 / 符号，扫描其余票据是否仍断言旧形状（旧可选性 / 旧字段集 / 旧状态集） | 把假设不存在的票 `Blocked by` 新增票；或改写该票为「新旧两种形状均接受」的向后兼容消费 |
| **迁移票与其消费者票顺序倒置**（消费者先于迁移落地） | 对每条迁移票据，列出消费该符号新形式的票据，检查其 `Blocked by` 是否指向迁移票 | 调整 `Blocked by`（消费者票 blocked by 迁移票）；若两票本就不可分离，**合并**为一票 |
| 一票的**产出符号**与另一票的**消费符号**同名但形状不一致（参数签名 / 返回类型 / 事件字段名） | 对每条「产出符号」声明配合同名的「消费符号」声明，逐字段比对形状 | 对齐两端为同一签名 / 类型约束；无法对齐则拆出独立适配符号并明确归属 |
| 两票对**同一状态机**给出互斥转移，或同一不变式被一票加强、被另一票放松 | 抽取各票声明的状态转移与不变式，按 Action 名 / 不变式名配对，检查是否与 TLA+ 既有 Action 及不变式相容 | 以 TLA+（阶段 1-4 产物）为权威统一转移语义并改票对齐；若属真实语义变更，退回阶段 1-4 走需求 / 设计变更流程 |
| 单票**自相矛盾**（其验收标准与它声明的符号契约不符；或它新建的符号与它随后修改的符号冲突） | 对每张票据单独通读：验收标准能否只凭本票声明的符号契约判定；同票内新建 / 修改的符号是否互斥 | 修正票内文本使其自洽；无法自洽则拆票 |

### 票据动态重排规则

> 吸收自 Agentic Design Patterns ch20「动态重新优先级」：根据新事件/截止日期动态重排任务优先级。

- **重排触发**：阻塞依赖解除 / 新需求事件 / 评审发现高风险 ticket / 外部截止日期变化时，允许按 frontier 重新排序 tickets。
- **重排纪律**：重排只改执行顺序，不改票据内容契约（垂直切片/blocking edges 不变）；重排须在 tickets.md 记录原因。
- **与需求变更的关系**：重排不替代需求变更流程——新需求须先进阶段 1（或 Loop 3 事件接驳），不得直接插队改票。

### Out of 票据化的例外
- 单一 bug 修复：可免除票据拆解，但**不得**绕过 普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。
- 单一 TLA+ 不变式违反修复：同样可免除票据拆解，但不得直接 R→S-fix；普通失败必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。
- 阶段 5 仅 1 个 SD 子系统且改动 ≤1 文件时：可直接编码而不拆票据；若出现普通 V/G 失败，必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。
- 不需要票据化时产出 `tickets.md` 仅含一行声明「本阶段改动范围小，不票据化，直接编码」
- 候选影响阶段由 R 给出；O 只在完整 R/V/G 证据和用户 CHECKPOINT 后执行阶段切换。
- V 子代理评审时检查该声明是否合理（避免漏拆）

## 执行方法论

| 步骤 | 工具 / 命令 | 阈值 |
|---|---|---|
| 单元测试执行 | `npx vitest run`（或 `jest`/`pytest` 等价运行器） | 全部通过 |
| 覆盖率统计 | `npx vitest run --coverage` | 分支 + 行覆盖率 ≥ 80% |
| 规范检查 | `npx eslint . --max-warnings=0` + `npx prettier --check .` | 0 error，0 warning |
| 编译验证 | `npx tsc --noEmit`（TS）/ `npm run build` | 退出码 0 |

## worktree 纪律（S23）

> 依据：S23 台账 `docs/superpowers/specs/2026-09-14-superpowers-capability-survey.md:176`；D-6 裁定 `docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md:133-134`（§10.2 回执 `:224`）；设计规格 §4.4 `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md:190-198`。本节是**文档规则**（git-only），不配脚本、不新增门禁。

### `.w-model/` 归属（D-6 定稿）

**worktree 内禁止写 `.w-model/`（含其锁目录）；跨 worktree 的状态与证据一律回主仓 `.w-model/` 登记；`wm-write.ts` 的锁只在主仓路径上生效，worktree 内的平行 `.w-model/` 构成平行事实源，禁止创建。**

D-6 裁定原文（`:133`）：「worktree 内**禁止**写 `.w-model`；跨 worktree 的状态与证据**一律回主仓**」。

三点依据（D-6 实测理由，`:134`）：

1. **平行事实源**：新建 worktree **不继承** `.w-model/`；风险不是继承，而是「worktree 内跑 `/wm` 会**新建**一份」，造成**写入位置分叉**。
2. **锁**：`wm-write.ts` 的锁在**同一文件路径**上生效，**跨 worktree 不互斥**，多 worktree 各写各的不保证全局单写者（设计规格 §4.4 `:195`）。
3. **SSoT `headRef`**：SSoT `:283` 要求 ChangeScope 的 `headRef` 解析 sha **等于当前 HEAD**，而每个 worktree 有独立 HEAD——这正是设计规格 §4.4 `:195` 所指的冲突点（该 headRef 规则所属 SSoT 节为 §3.3.1 外部工具集成，正文见 `:283`）。

### 五条隔离纪律

| # | 纪律 | 为什么 |
|---|---|---|
| 1 | **Step0 已隔离检测 + submodule 守卫**：动手前先判定自己是否已在 worktree 内，再用 `git rev-parse --show-superproject-working-tree` 守卫 submodule 场景 | 已在隔离区再建一层，会得到 harness 看不见的双重工作树 |
| 2 | **建前取用户同意**：创建 worktree 前必须取得用户明确同意 | worktree 改变工作区语义，属用户决策，不是 Agent 自决 |
| 3 | **原生工具优先**：一律用 `git worktree` 原生命令，不用平台工具或手工目录绕过 | **绕过会产生 harness 看不见的 phantom state** |
| 4 | **`git check-ignore` 强制**：`git check-ignore <path>` 未命中即先加入 `.gitignore` 并 commit，再建 worktree | 未忽略的隔离目录会被误纳入变更集合，污染 ChangeScope 与评审包 |
| 5 | **clean baseline 强制**：开工前工作区与暂存区必须干净（"A dirty baseline makes every later failure ambiguous"） | **脏基线会让后续每一次失败都变得不可归因**，无法区分新缺陷与旧污染 |

### 清理拥有权判定与 `prune` 自愈

- **拥有权判定**：收尾时只清理位于 `.worktrees/` / `worktrees/` 下、且**由本次工作创建**的 worktree；**非自建的一律不清理**，交还用户处置。PR 未落地前不删 worktree。
- **`git worktree prune` 自愈**：元数据残留（工作目录已删但 `.git/worktrees/` 记录仍在）用 `git worktree prune` 收敛；**不做手工 `rm -rf` 元数据**。

### 边界

- **git-only**：本节纪律一律用 git 原生命令表达——**W-model 不引入平台工具**（设计规格 §4.4 `:197`）。
- **不得自动 `git reset`、不得自动清理用户文件**（同 `:197`）。
- **不新增检测脚本**：S23 纪律为**文档规则**（无脚本配额）——不得为本节新增任何 `.ts` 检测脚本，也不得修改既有脚本。

## 测试用例设计（本阶段执行单元测试）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-COD-001 | 代码生成 | 详细设计文档 | 可编译运行的代码 | 高 |
| TC-COD-002 | 代码质量检查 | 生成的代码 | 无语法错误、符合代码规范 | 高 |
| TC-COD-003 | 单元测试生成 | 代码文件 | 覆盖核心逻辑的单元测试用例 | 高 |
| TC-COD-004 | 单元测试代码覆盖率 | 执行单元测试 | 单元测试代码覆盖率 ≥ 80% | 高 |
| TC-COD-005 | 边界条件处理 | 边界输入 | 正确处理并返回预期结果 | 中 |

## 并行任务（强制）

生成代码后，**立即**生成并执行单元测试。单元测试代码覆盖率不达标时，覆盖率缺口是 **R 定位线索**；实际返工先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再补充测试或修正实现。

## 代码审查（`/wm review`）

代码生成后进入代码审查，审查报告套用 [templates/review-report.md](../templates/review-report.md)。审查要点：安全性、可读性、可维护性、规范一致性、潜在缺陷。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中补登：代码模块列（实现文件路径）。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

> **强制条款（P1.4）**：编码完成后、code-TLA 一致性检查前，必须回填 RTM.codeModule 列。
> 格式：`SD-xxx:src/path/to/file.ts`（多个模块用逗号分隔）。
> 缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1，violation 明确指出回填时机。

### codeModule 格式规范

`codeModule` 字段须按以下格式填写，由 `check-artifact-gate.ts --phase=5` 强制校验：

| 行类型 | 格式 | 正则 | 示例 |
|---|---|---|---|
| REQ 行 | `SD-xxx:src/path/to/file.ts` | `^SD-[\d.]+:src/.+\.(ts\|js\|py\|java)$` | `SD-5.2.1:src/auth/login.ts` |
| NFR 行 | `src/path/to/file.ts` 或 `横切` | `^src/.+\.(ts\|js\|py\|java)$` 或 `^横切$` | `src/middleware/rateLimit.ts` |
| CON 行 | 同 NFR | 同 NFR | `横切` |

**校验逻辑**：
- REQ 行（`requirementId` 以 `REQ-` 开头）：校验 `codeModule` 匹配 `^SD-[\d.]+:src/.+`
- NFR 行（`requirementId` 以 `NFR-` 开头）：校验 `codeModule` 匹配 `^src/.+` 或 `=== "横切"`
- CON 行（`requirementId` 以 `CON-` 开头）：同 NFR
- 格式不匹配 → check-artifact-gate.ts 退出码 1，reasons 列出具体 requirementId

### NFR/CON codeModule 回填

> NFR（非功能需求）与 CON（技术约束）行的 `codeModule` 字段在阶段 5 须回填。与 [phase-1-requirements.md](phase-1-requirements.md)「NFR/CON 横切治理字段登记」节配套：阶段 1 已登记 `designDoc`（横切关系），阶段 5 闭环到代码层。

**字段回填要求**：

| 行类型 | `codeModule` 回填要求 | 示例值 |
|---|---|---|
| `NFR-001~005` | 填写涉及的源码文件清单（多文件用逗号分隔）或填 `"横切"`（多文件横切时） | NFR-001 性能 → `"src/utils/cache.ts,src/services/recommend.service.ts"`；NFR-003 可观测性 → `"横切"` |
| `CON-001~003` | 填写技术栈配置文件或填 `"横切"` | CON-001 TypeScript strict → `"tsconfig.json"`；CON-002 npm 包管理 → `"package.json"`；CON-003 全局约束 → `"横切"` |

**与 REQ 行的差别**：

- REQ 行 `codeModule` 格式严格为 `SD-xxx:src/path/to/file.ts`（须带 SD 前缀，便于 `check-code-tla-consistency.ts` 维度 1 反向追溯）。
- NFR/CON 行因横切多个 SD 或对应全局配置文件，**不带 SD 前缀**，直接填文件路径或 `"横切"` 标识。

**阶段 5 门禁校验**：`check-artifact-gate.ts --phase=5` 校验 NFR/CON 行的 `codeModule` 字段非空（非 `null`、非空字符串）。缺失即门禁退出码 1，作为 R 定位线索并执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）；仅在用户 CHECKPOINT 确认后，按 R 结论补回填。

> 与阶段 1 的衔接：阶段 1 已登记 `NFR/CON.designDoc`（横切 SD 清单或 `"横切"`），阶段 5 须保证 `codeModule` 与 `designDoc` 横切关系一致——若 `designDoc="横切"` 而 `codeModule` 只指向单个文件，V 子代理评审时应提示「横切范围与代码实现不匹配」（可选 reworkHint，非阻断）。

## 跨平台环境变量设置

Windows PowerShell 下 `cross-env` 可能失效。推荐方案：

### 推荐方案：dotenv

在项目根创建 `.env` 文件，`import 'dotenv/config'` 自动加载：

```bash
# .env
JWT_SECRET=test-secret-blog-demo
PORT=3000
```

```typescript
// src/app.ts 首行
import 'dotenv/config';
// process.env.JWT_SECRET 自动可用
```

### 备选方案：cross-env

`package.json` scripts 使用 `cross-env`（需安装为 devDependency）：

```json
{
  "devDependencies": {
    "cross-env": "^7.0.3"
  },
  "scripts": {
    "test": "cross-env JWT_SECRET=test-secret-blog-demo npx vitest run"
  }
}
```

### Windows PowerShell 适配

`cross-env` 在 PowerShell 下可能失效，建议用以下方式之一：
- `$env:JWT_SECRET="test-secret-blog-demo"` 临时设置
- 使用 `dotenv` 包（推荐）

### 验收设计反向对照（强制）

> 编码与验收设计不一致（路径/参数/状态码/字段偏离设计）是高频缺陷源，须逐条反向对照。

编码完成后，S 子代理须对照阶段 1 的 `docs/uat-path-mapping.md` 逐条核对：

- [ ] 路径一致性：映射表中「实际路径」列已回填且与路由定义一致
- [ ] 参数一致性：分页/筛选参数名与验收测试设计一致
- [ ] 状态码一致性：成功/错误状态码与验收测试设计一致
- [ ] 响应字段一致性：响应体字段名与验收测试设计一致

G 子代理跑 [`check-design-contract-consistency.ts`](../scripts/cli/check-design-contract-consistency.ts) 校验，exitCode=0 才放行。

违反任一条 → 记录为 **R 定位线索**，禁止「以代码为准」忽略设计。若 V/G 因此不通过，O 必须分派 R，随后走 普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）；不得直接命令 S 回编码。

## 验收标准

- [ ] 代码可编译通过
- [ ] 代码规范检查通过（ESLint / Prettier 或对应语言规范工具）
- [ ] 单元测试代码覆盖率 ≥ 80%
- [ ] 测试报告清晰，包含通过率和单元测试代码覆盖率
- [ ] 代码审查无高危问题
- [ ] RTM 已补登代码模块映射

> 🔴 **CHECKPOINT · 阶段门放行**：代码审查 + 单元测试执行完成后暂停。Agent 必须向用户展示「编译结果 / 规范检查 / 单元测试通过率 / 覆盖率 / 审查报告摘要」，由用户确认「放行进入阶段 6」或「返工」。覆盖率 < 80% 或规范检查非 0 退出码 → 一律返工，不得放行。

## 阶段门评审

代码审查 + 单元测试通过后，O 展示真实测试、R3/V/G 证据并在 🔴 CHECKPOINT 等待用户放行；用户确认后才进入阶段 6（集成测试）。
普通 V/G 不通过 → 普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。R 的 upstreamDefect 判定可推荐回到阶段 1-4；不得只按 reworkHints 直接分派 S。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 生成无断言的占位单元测试 | 每个用例必须有明确断言（期望值 vs 实际值） |
| 2 | 只为 happy path 生成单元测试 | 必须覆盖边界条件、异常输入、错误路径 |
| 3 | 让单元测试依赖外部服务（DB/网络） | 用 mock/stub 隔离，单元测试不得发起真实网络或 DB 调用 |
| 4 | 用 `// eslint-disable` 绕过规范检查 | 修复违规源，禁止整文件 disable |
| 5 | 覆盖率不达标时调低阈值放行 | 阈值固定 ≥ 80%，不达标必须补测试 |
| 6 | 伪造实现（TODO/stub）当完成 | 缺失依赖必须暂停标注，不得伪造业务逻辑 |
| 7 | 路由层或控制器入口仅校验 token 存在未校验角色（如 `authRequired=true` 但未校验 `user`/`reader`/`blogger` 角色） | 路由层或控制器入口必须显式校验 `requiredRole`，与需求/设计中的角色枚举一致；token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 Forbidden。详见下方「角色校验清单」节 |
| 8 | 响应体字段返回副作用自增前的旧值（如 `viewCount` 自增后响应体仍返回旧值） | 副作用（如计数器自增、状态变更、关联记录创建）须在响应体构造前完成；响应体字段须反映已生效的状态。详见下方「副作用时序一致性清单」节 |
| 9 | 复制粘贴重复代码段 | 须提炼函数/类消除重复（坏味道清单 #1） |
| 10 | 单函数超 ~40 行不拆分 | 按单一职责拆分，保持函数短小（坏味道清单 #2） |
| 11 | 使用布尔标记参数 | 拆分为两个意图明确的函数或枚举参数（坏味道清单 #4） |
| 12 | 有返回值函数还产生可见副作用 | 命令与查询分离：有返回值的函数不修改状态（坏味道清单 #5） |
| 13 | 裸全局可变数据跨模块共享 | 封装变量 / 限制共享数据作用域（坏味道清单 #6 + concurrency-guide） |

## 角色校验清单

> reader 可发博文（`authRequired` 未校验角色，缺陷 P7-001）的预防清单。每个受保护端点须通过以下检查：

- [ ] 每个受保护端点须有 `requiredRole` 显式声明（在路由配置或控制器入口）
- [ ] `requiredRole` 须与需求/设计文档中的角色枚举一致（如 `user` / `reader` / `blogger` / `admin`）
- [ ] token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 Forbidden
- [ ] 单元测试须覆盖「跨角色越权」场景（如 `reader` 调用 `blogger-only` 端点应返回 403）
- [ ] 系统测试须覆盖「越权用例」（详见 [phase-7-system-test.md](phase-7-system-test.md) 禁止行为 #7）

违反任一条 → V-code 评审标注 `reworkHints` + 系统测试用例失败，作为 **R 定位线索**；实际返工先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。关联反模式 [#22 角色越权](hard-constraints.md)。

## 副作用时序一致性清单

> `PostController.get` 响应体返回 `recordView` 自增前旧 `viewCount`（缺陷 P7-004）的预防清单。每个含副作用端点须通过以下检查：

- [ ] 副作用（如计数器自增、状态变更、关联记录创建）须在响应体构造前完成
- [ ] 响应体字段须反映已生效的状态（如自增后的 `viewCount`，不是自增前的旧值）
- [ ] 单元测试须覆盖「副作用与响应体一致性」场景（断言响应体字段 = 已生效状态）
- [ ] 系统测试须覆盖「时序用例」（详见 [phase-7-system-test.md](phase-7-system-test.md) 禁止行为 #7）

违反任一条 → V-code 评审标注 `reworkHints` + 系统测试用例失败，作为 **R 定位线索**；实际返工先执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。关联反模式 [#24 副作用时序不一致](hard-constraints.md)。

## 断言规范

> 吸收自《重构 2》ch10.6「引入断言」：断言标注"必须为真"的假设，失败表示程序员错误，不应被捕获。

- **内部假设用断言**：前置条件/不变式（如"此值恒非负"）用断言表达，放设值函数（错误源头）优于使用点。
- **外部输入用一等校验**：用户输入/外部服务数据须显式校验并返回错误，不得用断言代替（断言失败 = 崩溃，不适合用户输入）。
- **断言失败不捕获**：断言表示代码错误，捕获即掩盖；禁止 `try { assert(...) } catch {}`。

## 重构纪律

> 吸收自《重构 2》ch2：两顶帽子 / 三次法则 / 何时不该重构。

- **两顶帽子**：添加功能 vs 重构是两种状态；重构时不加功能、不加测试，切换时明确当前戴哪顶帽子。
- **三次法则**：事不过三——第一次照做、第二次反感但做、第三次重构。
- **何时不该重构**：① 代码凌乱但无需修改且可藏在接口后 → 不动；② 重写比重构容易 → 重写（但须先建测试基线）。
- **营地法则边界**：顺手的小清理限本次改动触及的代码半径内（与操作行为 #5 划界）；大清理记便笺另立票据。

## 改动前测试基线

> 吸收自《代码整洁之道》ch16：重构遗留/不熟代码前先跑覆盖率工具测基线（案例 50%→92%），自己写独立测试补足，再动手改。

- **改动前确认覆盖基线**：对即将修改的模块先跑覆盖率工具 + 既有测试，确认改动前基线。
- **缺口先补**：基线覆盖率低的模块，先补关键路径测试再动手，避免改动后无法区分"新 bug vs 旧债"。
- **与约束 #14 的关系**：约束 #14 管"改动后必跑回归"，本节补"改动前基线"形成闭环。

## 第三方代码边界管理

> 吸收自《代码整洁之道》ch8「边界」。

- **封装边界接口**：第三方类型（如 Map/客户端对象）不跨系统传递，只在少数边界点引用，用包装/ADAPTER 隔离。
- **学习性测试**：用测试学习第三方 API 行为；在库升级时自动检测行为变化（写入 phase-6 集成测试对第三方依赖执行）。
- **使用尚不存在的代码**：接口契约未定时先定义"我想要的接口"+ ADAPTER 桥接，测试用 Fake，待真实实现就绪再替换。

## 静态检查工具接入

> 用户确认：代码坏味道/并发无法用脚本可靠检查，须用"特定开发语言的静态检查工具 + LLM 语义理解"双轨。

- **机械规则 → 语言静态工具**：编码后须运行项目语言的静态检查工具 + 相关规则集，结果落盘为门禁证据：
  - TypeScript/JS：`eslint`（`max-lines-per-function` / `max-params` / `no-duplicate-imports` 等）+ `tsc --noEmit`
  - Python：`pylint` / `ruff`；Java：`spotbugs` / `PMD`；Go：`golangci-lint`
- **语义坏味道 → LLM 评审**：V-code 评审子代理按 [coding-quality.md](coding-quality.md)「代码坏味道清单」清单执行语义层检查（依恋情结/霰弹式修改/副作用混合/竞态等），命中项标注分级并写入 reworkHints。
- **静态工具结果须真实落盘**：禁止估算"应该没违规"；工具退出码/报告须由 G 子代理核验（约束 #4 真实执行）。
- **工具缺失降级**：项目语言标准工具缺失时，参照 [quality-standards.md](quality-standards.md)「工具缺失与降级处理」节——尝试等价工具，仍缺失则 LLM 评审承担全部检查并在评审中注明。

## L4 features 作为 TDD 夹具

S-code 子代理在编码时遵循 TDD 红-绿-重构循环，以 L4 BDD features 作为夹具：
1. 先跑 `npx cucumber-js features/L4/` 观察 all scenarios fail（红）
2. 实现 step definitions（`features/step_definitions/L4_*.steps.ts`）+ 业务代码
3. 重跑 cucumber 直到 all scenarios pass（绿）
4. 重构代码（保持 scenarios 绿）

G 子代理跑 [`check-bdd-model.ts`](../scripts/cli/check-bdd-model.ts) `--phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json` 校验 D5（step 绑定）+ D6（scenario 路径）+ D8 SD Coverage；项目门缺真实 Cucumber 报告时为 D5 violation / exit 1。

## 返工路径

阶段门评审不通过时，以下内容仅作为 **R 定位线索**，不能直接触发 S 或跨阶段回退：
- 设计文档字段缺失/类型不明：R 核验是否为阶段 4 上游缺陷
- 技术栈未登记：暂停并由用户确认技术栈
- 依赖未定义：标注缺失依赖并暂停，不得伪造实现
- 单元测试无断言：R 核验是否为阶段 4 测试设计缺陷
- ESLint/Prettier 报 error：作为实现缺陷证据，禁止 // eslint-disable 绕过
- 覆盖率 < 80%：作为测试/实现缺口证据，禁止调低阈值

任何普通 V/G 失败均先走 普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）。R 的 `upstreamDefect` 才能建议回阶段 1-4；O 只在展示证据后的用户 CHECKPOINT 执行获批准的阶段切换。

## 退出状态

项目 `status` 更新为 `集成测试`。
