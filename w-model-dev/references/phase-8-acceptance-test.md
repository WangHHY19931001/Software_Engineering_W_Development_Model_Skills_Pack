# 阶段 8：验收测试（执行）

> W 模型右 V 测试执行阶段（终点）。设计来源：阶段 1（需求分析）产出的验收测试用例。
> 命令入口：`/wm test type=验收`

## 功能描述

确认软件是否满足最初的需求规格。执行阶段 1 设计的验收测试用例，进行用户需求匹配验证，由用户确认系统满足需求。

## 输入

- 验收测试设计文档（阶段 1 产出）
- 完整系统（系统测试通过）

## 输出

- 验收测试报告（套用 [templates/test-report.md](../templates/test-report.md)，类型=验收测试）
- 用户确认结果：在验收测试报告的「用户确认」区记录 `confirm` / `confirm-with-comments` / `reject`；不得使用未定义的 `/wm sign` 命令。
- `.w-model/rtm.json` 是 RTM 唯一事实源；Markdown RTM 仅用于导出或展示。

## AI 能力应用

- **验收测试用例执行**：按用户场景验证
- **用户需求匹配验证**：逐条比对原始需求与系统功能

## 第 25 轮新增：opsx 三段式 S 分派 + codegraph 影响分析

> 对应 SSoT §3.4.21。本阶段（验收测试）产出测试代码，同样适用 opsx 三段式 + codegraph 修改前查询。

**三段式分派**（与阶段 5 一致）：
- S-explore：opsx:explore 探索测试策略 + codegraph 查被测模块影响
- S-propose：opsx:propose 规划测试用例 + S-tickets 拆解测试代码切片
- S-coding：按 tickets.md frontier 逐片编写测试，每片 codegraph_explore 查被测模块影响半径

**约束 #20 适用**：测试代码文件 `Edit`/`Write` 前同样须先 codegraph_explore 查询并落盘。

## 执行方法论

| 步骤 | 工具 / 命令 | 参数 / 阈值 |
|---|---|---|
| UAT-001~003 验收测试 | 按阶段 1 产出验收测试用例手动/半自动执行 | 每条验收标准通过 |
| UAT-004 文档完整性 | 对照 `templates/` 8 个模板逐一核验 | 文件存在 + 内容与模板结构匹配 |
| RTM 终检 | `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]` | 退出码 0（RTM 100% + 四级测试全通过） |
| 用户确认 | 在验收测试报告「用户确认」区记录 | `confirm` / `confirm-with-comments` / `reject` |

## 测试用例设计（执行）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| UAT-001 | 需求匹配验证 | 原始需求描述 | 系统功能与需求一致 | 高 |
| UAT-002 | 用户场景测试 | 用户真实操作流程 | 流程顺畅，符合预期 | 高 |
| UAT-003 | 验收标准验证 | 验收标准列表 | 每项标准均满足 | 高 |
| UAT-004 | 文档完整性 | 交付文档列表 | 文档齐全，格式规范 | 中 |

### 验收测试前置条件校验清单

> 第 22 轮新增。第 21 轮调测发现 5 个验收用例因前置条件未满足而失败。

执行验收测试前，须逐条校验用例的前置条件：

- [ ] 认证状态：需认证的用例已准备有效 token
- [ ] 角色权限：管理员场景已预创建管理员用户
- [ ] 数据依赖：依赖的测试数据已准备
- [ ] 接口选择：测试 token 失效用例须选需认证接口（非公开接口）

## UAT 路径映射表

> 阶段1设计 UAT 时须同时产出 `docs/uat-path-mapping.md`；阶段5编码后回填实际路径列。

| UAT ID | 设计路径（阶段1） | 实际路径（阶段5回填） | 映射类型 | 说明 |
|---|---|---|---|---|
| UAT-001 | POST /api/site/config | _待阶段5回填_ | _待填_ | |

**映射类型**：
- `直接`：路径完全一致
- `等价`：路径不同但语义等价（如路由分组调整）
- `替代`：因技术约束替代（须说明原因）

**流程**：
1. 阶段1设计 UAT 时产出初始表（设计路径列）
2. 阶段5编码后回填实际路径列 + 映射类型
3. 阶段8验收测试编写时按此表映射，禁止凭主观判断

### 强制校验说明（第22轮 P0-1 修正）

`docs/uat-path-mapping.md` 为阶段1强制产出，阶段5回填实际路径，阶段8验收时校验完整性。

**校验规则**（由 `check-artifact-gate.ts` 执行）：
- phase=1：校验 `docs/uat-path-mapping.md` 文件存在性
- phase=5：校验每条 UAT-NNN 的「实际路径」列非 `_待阶段5回填_`，且 `mappingType` ∈ `["直接","等价","替代"]`
- 缺失文件或未回填项 → 退出码 1，reasons 列出具体 UAT ID

### demo 范围 N/A 标记要求（第22轮 P1-3 修正）

验收测试设计的 N/A 用例须：
- 与阶段1 Out of Scope 声明一致
- 附注释说明缺失端点名和原因
- R3 完整性维度校验不一致或注释缺失 → 标注 finding

## §自驱模式 vs 交互模式（P2.7）

> phase-8 三段暂停点在不同执行模式下的处理方式：

| 段 | 交互模式 | 自驱模式（self-as-verifier） |
|---|---|---|
| A 段（用例执行） | 每用例后暂停 | 连续执行不暂停 |
| B 段（每 30% 暂停） | 每 30% 暂停 | 合并为单次中点检查（50% 时） |
| C 段（最终用户确认） | 强制暂停 | **强制暂停（不变）** |

**说明**：
- 自驱模式下 B 段合并为单次中点检查，减少上下文切换
- C 段在任何模式下都强制暂停，须用户在 §9 确认区填入 `confirm` / `confirm-with-comments` / `reject`
- 自驱模式判定：执行模式配置 `executionMode: "self-as-verifier"` 时启用

## RTM 终检

在 [templates/rtm.md](../templates/rtm.md) 中核验：所有需求 → 设计 → 代码 → 单元 / 集成 / 系统 / 验收测试均建立映射，RTM 需求覆盖率 100%。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

**门禁脚本 stdout 贴出要求**（第24轮新增）：
- 编排者须贴出 `check-artifact-gate.ts` / `check-requirement-graph.ts` / `check-tla-model.ts` / `check-bdd-model.ts` / `check-role-dispatch.ts` 等门禁脚本 stdout 末尾 5 行作为放行证据
- 不得仅引用 JSON 摘要中的 `passed: true` 作为放行依据
- 违反命中反模式 #27 S2（门禁脚本未实跑）
- 约束 #10 已扩展：编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行

## 验收标准

- [ ] 所有验收测试用例通过
- [ ] 用户确认系统满足需求
- [ ] 交付文档完整
- [ ] 系统可正常部署和运行
- [ ] RTM 需求覆盖率 100%

## 项目级验收检查清单

- [ ] 需求规格说明书完整
- [ ] 设计文档完整且符合规范
- [ ] 代码实现完成且通过编译
- [ ] 单元测试代码覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 系统测试全部通过
- [ ] 安全测试无高危漏洞
- [ ] 性能测试达标
- [ ] 验收测试通过
- [ ] 用户确认签字
- [ ] 交付文档齐全
- [ ] RTM 需求覆盖率 100%

> 🔴 **CHECKPOINT · 验收放行（项目级，三段暂停点）**
>
> 为防止 Agent 自主失控，验收测试执行过程拆为三段，每段必须有用户确认才能进入下一段。
>
> **🔴 CHECKPOINT-A · 执行前（环境与用例就位）**
> - 阶段 1 验收测试设计文档已加载，用例总数与优先级清单已展示
> - 完整系统已通过系统测试（阶段 7），RTM 系统测试列 100%
> - 用户代表（UAT 执行人）已确认参会，或已签署「异步确认协议」（见异常场景处理）
> - 测试环境与生产环境配置差异已记录（如数据库规模、缓存命中率）
>
> 满足以上条件后暂停，等待用户「开始执行」确认才进入 CHECKPOINT-B。
>
> **🟡 CHECKPOINT-B · 执行中（分批结果同步）**
>
> 每完成 30% 用例（或每个业务域一批）暂停一次，向用户展示：
> - 本批通过 / 失败 / 阻塞用例清单
> - 失败用例的根因初判（需求偏差 / 实现缺陷 / 环境问题）
> - 是否继续执行下一批 / 暂停排查
>
> 任一批次失败率 > 20% → 强制暂停，回到编码或需求阶段返工。
>
> **🔴 CHECKPOINT-C · 执行后（项目级放行）**
>
> 验收测试全部执行完成后暂停。Agent 必须逐条展示项目级检查清单、RTM 覆盖率、四级测试汇总，并请求真实用户在验收测试报告的「用户确认」区记录 `confirm` 或 `confirm-with-comments`。RTM 覆盖率 < 100% 或四级测试任一未通过时不得请求确认，必须回对应阶段返工。`.w-model/rtm.json` 是 RTM 唯一事实源，Markdown 仅用于导出或展示。Agent 不得代签，也不得通过未定义的 `/wm sign` 命令代替用户确认。

## 阶段门评审

验收测试通过 + 用户确认（`confirm` / `confirm-with-comments`） → **项目完成**，归档全部文档与 RTM。
不通过（`reject` 或 RTM 未达 100%） → 回到需求分析，重新走 W 模型流程（缺陷溯源到对应阶段）。

## L1 BDD features 执行

S-test 子代理执行 `npx cucumber-js features/L1/` 运行所有 scenarios：
- 失败走 R→V→G→S-fix 循环（反模式 #29）
- 通过后 G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=8 --cucumber-report=<report.json>` 门禁
- cucumber 报告不得有 undefined/pending/failed step（D5 校验）

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | Agent 代用户签字 | 必须由真实用户在验收测试报告「用户确认」区填入确认状态 |
| 2 | RTM 覆盖率 < 100% 即归档 | 必须所有需求建立四级测试映射后才可请求确认 |
| 3 | 跳过用户确认直接标记项目完成 | 必须暂停等用户 `confirm`，禁止 Agent 自行判定完成 |
| 4 | 用单元测试代替验收测试 | 验收测试必须从用户场景出发，不得复用单元/集成测试用例 |
| 5 | 验收用例只覆盖 happy path | UAT 必须覆盖正常流程 + 异常流程 + 边界场景 |
| 6 | 文档完整性只检查文件存在 | 必须对照 [templates/](../templates/) 8 个模板逐一核验内容完整性 |

### acknowledgedDecisions 决策条目须含关键词

> 第 15 轮共性问题 C：`acknowledgedDecisions` 多次因未含 ID 模式或 `TECH_KEYWORDS` 返工。第 16 轮 P4.1 补充约束。

每条 `acknowledgedDecisions`（[run-log.jsonl](data-models.md) 的 `RunLogEntry.acknowledgedDecisions` 字段）须命中以下任一，否则触发 [`check-checkpoint.ts`](../scripts/check-checkpoint.ts) R2 名词违规：

- **ID 模式**（正则匹配，5 个）：
  - `REQ-\d+`（需求 ID，如 `REQ-001`）
  - `SD-[\d.]+`（系统设计 ID，如 `SD-5.2.1`）
  - `INTF-[\d.]+`（接口设计 ID，如 `INTF-3.1.2`）
  - `DD-[\d.]+`（详细设计 ID，如 `DD-4.2.3`）
  - `TC-\w+-\d+`（测试用例 ID，如 `TC-UNIT-001`、`TC-INT-012`）

- **技术关键词**（中英，37 个）：
  - **英文（16 个）**：`REST` / `GraphQL` / `JWT` / `OAuth` / `SQLite` / `PostgreSQL` / `Redis` / `Koa` / `Express` / `React` / `Vue` / `TypeScript` / `WebSocket` / `HTTP` / `API` / `CRUD`
  - **中文（21 个）**：`认证` / `鉴权` / `缓存` / `存储` / `模块` / `接口` / `表` / `字段` / `状态机` / `不变式` / `需求` / `设计` / `架构` / `数据库` / `前端` / `后端` / `网关` / `队列` / `事务` / `锁` / `索引`

泛化模板（如「同意」/「确认」/「OK」/「好的」/「继续」/「通过」/「确认放行」/「yes」）视为空，触发 R2 黑名单违规。完整集合与扩展规则见 [`checkpoint-logic.ts`](../scripts/checkpoint-logic.ts) `ID_PATTERNS` / `TECH_KEYWORDS`（含集合用途、扩展规则、与 R2 关系注释，第 16 轮 P4.1 补充）。

## 返工路径

| 失败场景 | 根因定位 | 返工目标 |
|---|---|---|
| 验收测试用例失败 | 逐条比对原始需求与系统功能，定位偏差 | 回编码修复后重跑验收测试 |
| RTM 覆盖率 < 100% | 核验 RTM 登记项，定位未覆盖需求 | 回对应阶段补齐测试映射 |
| 用户 reject | 收集用户反馈，定位不满点 | 回需求分析，重新走 W 模型流程 |
| 文档不完整 | 对照 templates/ 8 模板核验 | 回对应阶段补齐文档 |

## 异常场景处理

| 场景 | 处理路径 |
|---|---|
| 用户 `reject` | 1. 触发反馈收集模板（见下）；2. 按回退决策树回退到对应阶段；3. 在 RTM 标注 `reject` + 根因阶段 + 重启时间 |
| 部分用例通过 | 通过项归档为「阶段性验收通过」；未通过项按 reject 路径处理；用户须显式选择「接受部分通过 + 缺陷追溯」或「整体 reject」 |
| 用户无法参会 | 启用异步确认协议：1. Agent 输出完整 UAT 报告（含截图/日志）；2. 用户在 3 个工作日内在验收测试报告「用户确认」区异步追加 `confirm` / `confirm-with-comments` / `reject`；3. 代理人制度：用户可指定代理人（需提前在 RTM 备案），代理人签字等同用户签字 |

**reject 反馈收集模板**（必填）：

- 不满意点：________
- 影响范围（单选）：□ 单个功能 □ 模块级 □ 系统级
- 期望修复时间（单选）：□ 1 周内 □ 1 月内 □ 下版本
- 是否阻塞上线（单选）：□ 是 □ 否

**回退决策树**：

- 需求理解偏差 → 回阶段 1（需求分析）
- 设计缺陷（架构 / 接口） → 回阶段 2/3（系统 / 概要设计）
- 实现缺陷 → 回阶段 5（编码）
- 测试覆盖不足 → 回对应测试阶段（6/7）

## Archive 机制（第 10 轮外部技能吸收）

> 吸收 OpenSpec archive 机制。项目级放行后，S 子代理执行 archive，沉淀产物到只读目录。

### 触发时机
项目级放行（acceptance-test-report.md §9 用户勾选 confirm）后，S 子代理执行 archive。

### Archive 路径
`changes/archive/<YYYY-MM-DD>-<feature-slug>/`

### Archive 产物清单
- `proposal.md` ← 阶段 1 需求规格的「问题陈述 + 解决方案 + User Stories + Out of Scope」节抽取
- `specs.md` ← RTM 需求行 + 验收测试用例（UAT-xxx）合并
- `design.md` ← 阶段 2-4 设计产物的技术决策摘要（不含具体文件路径）
- `tasks.md` ← 阶段 5 tickets.md 的票据清单 + 完成状态
- `tla-summary.md` ← TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表）
- `rtm-snapshot.json` ← RTM 最终快照（requirementId → {designDoc, codeModule, tests}）
- `verifier-summary.md` ← 8 阶段 V 评审 qualityLevel + compositeScore 摘要

### Archive 规则
- 由 S 子代理执行（编排者不越权，反模式 #10 不变）
- archive 后 `.w-model/` 原始产物保留（不删除，作为可追溯证据）
- archive 产物只读，后续项目引用时只读取不修改
- archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）
- **tickets.md 源路径无关性**：阶段 5 票据产出位置（`.w-model/tickets.md` 或 `docs/tickets.md`）不影响 archive——archive 时 S 子代理从源路径读取内容，写入 archive 的 `tasks.md`，源文件保留不动

### 与 project.json 的关系
- archive 完成后 S 子代理回填 `project.json.status = "项目完成 + 已归档"`
- archive 路径写入 `project.json.archivePath` 字段（可选字段，默认空字符串，向后兼容）
- check-artifact-gate.ts 不校验 archivePath（保持纯文档吸收，不新增脚本校验）

## 退出状态

产物完成但尚未通过阶段门时，保持项目当前 `status` 不变。只有阶段门评审通过且用户确认放行后，才将 `status` 更新为「项目完成」。
