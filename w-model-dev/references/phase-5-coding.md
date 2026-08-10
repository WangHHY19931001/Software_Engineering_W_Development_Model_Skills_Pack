# 阶段 5：编码实现（执行单元测试）

> W 模型左 V 第 5 阶段（编码），对应右 V 测试执行：**单元测试执行**。
> 命令入口：`/wm code <功能描述>`（生成代码 + 单元测试）+ `/wm test type=单元`

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

## 任务分配规则：产品化 vs 系统集成（第 39 轮吸收）

> 吸收自《agent 时代的人月神话》第 1 章「九倍矩阵」：9x = 3x（产品化）× 3x（系统集成）。

- **产品化类任务**（判据住代码内，agent 擅长）：补文档、测试、类型注解、错误处理、边界情况、重构 → 优先分派 S 子代理。
- **系统集成类判断**（判据住大系统处境里，agent 不擅长）：对接外部系统、生产环境适配、跨模块契约裁决、版本兼容决策 → 必须由人/主刀持有，不得外包给 agent。
- 完成度判定："agent 跑通了"只证明左下角（1x 一次性脚本）；交付到右上角（可依赖构件产品）须产品化轴与系统集成轴逐项自检（见 [definition-of-done.md](definition-of-done.md)「完成度矩阵自检」）。

## 增量集成纪律（第 39 轮 P1 批吸收）

> 吸收自《agent 时代的人月神话》第 11/13 章：修复引入新 bug 概率 20-50%（agent 时代只高不低）；大而稀的整体重写让"这次改了什么"在结构上不可问。

- **每次 agent 改动 = 可审 diff + 有对应测试 + 能被独立评审**。
- **禁止大而稀的整体重写式变更**（变更量子无穷大时连 diff 都不存在，"这次改了什么"在结构上不可问）。
- **回归测试强制钩子**（约束 #21）：任何 agent 改动代码后必须跑回归测试；禁止"改动代码但不跑回归"的工作流。

## 代码生成算法

```
输入: 详细设计文档
  1. 解析类和方法定义
     ├─ 失败: 设计文档字段缺失/类型不明 → 暂停，回到 phase-4 补充详细设计
     └─ 成功: 产出结构化的类/方法/字段清单
  2. 根据技术栈生成代码模板
     ├─ 失败: 技术栈未在 project.json 登记 → 暂停向用户确认技术栈
     └─ 成功: 产出分层骨架（controllers/services/models/routes）
  3. 填充业务逻辑实现
     ├─ 失败: 依赖外部服务未定义 → 标注缺失依赖并暂停，不得伪造实现
     └─ 成功: 产出可编译的实现代码
  4. 生成单元测试代码（套用阶段 4 用例设计）
     ├─ 失败: 用例无明确断言 → 回 phase-4 补断言格式，禁止生成无断言占位用例
     └─ 成功: 产出可执行测试文件
  5. 代码质量检查和优化
     ├─ 失败: ESLint/Prettier 报 error → 列出具体违规项并修复，禁止 // eslint-disable 绕过
     └─ 成功: 0 error 0 warning
输出: 可运行代码 + 单元测试 + 覆盖率报告
```

## codegraph 修改前影响分析（第 25 轮新增）

> 对应约束 #20 + 反模式 #38。阶段 5 任何代码/测试文件 `Edit`/`Write` 前，S-coding 须先调用宿主 Agent 的 `codegraph_explore` MCP 工具。

**修改前流程**：
1. `codegraph_explore(目标符号)` → 查询 callers / callees / blast radius
2. 落盘结果到 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`（含 querySymbol / callers[] / callees[] / blastRadius / queryTimestamp）
3. 评估：修改是否波及 callers？是否需同步改 callees？
4. 安全确认后 `Edit`/`Write` 代码
5. （可选）修改后再查一次确认影响未意外扩大

**与 code-TLA+ 一致性校验的关系**：codegraph = 修改前预防，code-TLA+ = 修改后回归，互补不冲突。

## OpenSpec opsx 三段式 S 分派（第 25 轮新增）

> 对应 SSoT §3.4.21。阶段 5-8 引入 opsx 工作流做规格级规划，与 S-tickets（代码级切片）共存。

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

## Tracer-bullet 票据拆解（第 10 轮外部技能吸收）

> 吸收 to-tickets tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract 方法论。S 子代理编码前兼任 S-tickets 角色，产出 `tickets.md` 作为 S-coding 执行单元。

### 时序

```
原时序: O 路由 → CHECKPOINT → S-coding（直接编码）→ V → G
新时序: O 路由 → CHECKPOINT → S-tickets（票据拆解）→ S-coding（按票据执行）→ V → G
```

- S-tickets 由 S 子代理兼任（不新增角色）
- S-tickets 产出 `tickets.md`（位于 `.w-model/tickets.md` 或 `docs/tickets.md`，由用户选择）
- S-tickets 必须在 S-coding 前完成，V/G 不单独评审 tickets.md（合并到阶段 5 V/G 评审）（第25轮更新：启用 opsx 三段式分派时，S-propose 段的 tickets.md 须按三段式 R3×3 + V 审查执行，见上方「OpenSpec opsx 三段式 S 分派」节；未启用 opsx 时本规则仍适用。）

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

### 票据内容 durability（第 26 轮外部技能吸收）

> 对应外部 implement-* 系列 SKILL.md 的 Agent Brief durability 原则：票据主体是**符号级契约**（接口 / 类型 / 行为），不是**文件路径 / 行号**（fragile reference，重构即失效）。

- **票据主体 = 符号级契约**：目标行为的接口签名 / 类型约束 / 状态转移（与 TLA+ 状态机 Action 对齐），如「实现 `ArticleService.create` 契约：入参 `{title, content}`，返回 `Article`，触发状态 `draft → published`」——而非「改 `src/services/article-service.ts:42`」
- **位置信息交给 codegraph**（约束 #20）：文件路径由 `codegraph_explore` 查询获得，票据不预设路径。票据只写「实现 `XX` 符号契约」，位置由查询结果落盘的 `.w-model/codegraph-queries/` 决定
- **与评审 evidence 的边界**：评审 evidence 须路径 + 行号（[verifier-spec.md](verifier-spec.md) §6.2.1，可追溯性）；实施票据**不**须——二者定位不同：evidence 是「评审时证明我看过哪」，票据是「实现时做什么契约」
- 票据引用术语统一用 [glossary.md](glossary.md) 规范名（如 `codeModule` / `mappingType`），不得自造别名

### Blocking edges 依赖图
- blocking edges 形成有向无环图（DAG）
- frontier = blockers 全完成的票据（可立即开始）
- 纯线性链：top to bottom
- 编排者按 frontier 一次性分派全部可启动票据（串行执行时按票据号顺序处理，与"主机不支持并行则串行"约束协同）
- 每张票据对应 RTM `codeModule` 字段的 ≥1 条目（SD-xxx:src/path 格式不变）
- 票据 ID（NN）不写入 RTM（RTM 保持现有 schema，不污染数据模型）
- 票据的 Next 分支实现必须与 TLA+ Action 名对应（与约束"TLA+ Next 分支 PascalCase ↔ code camelCase"协同）

### 票据动态重排规则（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch20「动态重新优先级」：根据新事件/截止日期动态重排任务优先级。

- **重排触发**：阻塞依赖解除 / 新需求事件 / 评审发现高风险 ticket / 外部截止日期变化时，允许按 frontier 重新排序 tickets。
- **重排纪律**：重排只改执行顺序，不改票据内容契约（垂直切片/blocking edges 不变）；重排须在 tickets.md 记录原因。
- **与需求变更的关系**：重排不替代需求变更流程——新需求须先进阶段 1（或 Loop 3 事件接驳），不得直接插队改票。

### Out of 票据化的例外
- 单一 bug 修复（直接走 R→S-fix 返工循环）
- 单一 TLA+ 不变式违反修复（同上）
- 阶段 5 仅 1 个 SD 子系统且改动 ≤1 文件时（直接编码，不拆票据）
- 不需要票据化时产出 `tickets.md` 仅含一行声明「本阶段改动范围小，不票据化，直接编码」
- V 子代理评审时检查该声明是否合理（避免漏拆）

## 执行方法论

| 步骤 | 工具 / 命令 | 阈值 |
|---|---|---|
| 单元测试执行 | `npx vitest run`（或 `jest`/`pytest` 等价运行器） | 全部通过 |
| 覆盖率统计 | `npx vitest run --coverage` | 分支 + 行覆盖率 ≥ 80% |
| 规范检查 | `npx eslint . --max-warnings=0` + `npx prettier --check .` | 0 error，0 warning |
| 编译验证 | `npx tsc --noEmit`（TS）/ `npm run build` | 退出码 0 |

## 测试用例设计（本阶段执行单元测试）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| TC-COD-001 | 代码生成 | 详细设计文档 | 可编译运行的代码 | 高 |
| TC-COD-002 | 代码质量检查 | 生成的代码 | 无语法错误、符合代码规范 | 高 |
| TC-COD-003 | 单元测试生成 | 代码文件 | 覆盖核心逻辑的单元测试用例 | 高 |
| TC-COD-004 | 单元测试代码覆盖率 | 执行单元测试 | 单元测试代码覆盖率 ≥ 80% | 高 |
| TC-COD-005 | 边界条件处理 | 边界输入 | 正确处理并返回预期结果 | 中 |

## 并行任务（强制）

生成代码后，**立即**生成并执行单元测试。单元测试代码覆盖率不达标时回到编码返工，补充测试或修正实现。

## 代码审查（`/wm review`）

代码生成后进入代码审查，审查报告套用 [templates/review-report.md](../templates/review-report.md)。审查要点：安全性、可读性、可维护性、规范一致性、潜在缺陷。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中补登：代码模块列（实现文件路径）。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

> **强制条款（P1.4）**：编码完成后、code-TLA 一致性检查前，必须回填 RTM.codeModule 列。
> 格式：`SD-xxx:src/path/to/file.ts`（多个模块用逗号分隔）。
> 缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1，violation 明确指出回填时机。

### codeModule 格式规范（第22轮 P0-2 修正）

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

### NFR/CON codeModule 回填（第 9 轮 P1.2）

> NFR（非功能需求）与 CON（技术约束）行的 `codeModule` 字段在阶段 5 须回填。与 [phase-1-requirements.md](phase-1-requirements.md)「NFR/CON 横切治理字段登记」节配套：阶段 1 已登记 `designDoc`（横切关系），阶段 5 闭环到代码层。

**字段回填要求**：

| 行类型 | `codeModule` 回填要求 | 示例值 |
|---|---|---|
| `NFR-001~005` | 填写涉及的源码文件清单（多文件用逗号分隔）或填 `"横切"`（多文件横切时） | NFR-001 性能 → `"src/utils/cache.ts,src/services/recommend.service.ts"`；NFR-003 可观测性 → `"横切"` |
| `CON-001~003` | 填写技术栈配置文件或填 `"横切"` | CON-001 TypeScript strict → `"tsconfig.json"`；CON-002 npm 包管理 → `"package.json"`；CON-003 全局约束 → `"横切"` |

**与 REQ 行的差别**：

- REQ 行 `codeModule` 格式严格为 `SD-xxx:src/path/to/file.ts`（须带 SD 前缀，便于 `check-code-tla-consistency.ts` 维度 1 反向追溯）。
- NFR/CON 行因横切多个 SD 或对应全局配置文件，**不带 SD 前缀**，直接填文件路径或 `"横切"` 标识。

**阶段 5 门禁校验**：`check-artifact-gate.ts --phase=5` 校验 NFR/CON 行的 `codeModule` 字段非空（非 `null`、非空字符串）。缺失即门禁退出码 1，回到阶段 5 补回填。

> 与阶段 1 的衔接：阶段 1 已登记 `NFR/CON.designDoc`（横切 SD 清单或 `"横切"`），阶段 5 须保证 `codeModule` 与 `designDoc` 横切关系一致——若 `designDoc="横切"` 而 `codeModule` 只指向单个文件，V 子代理评审时应提示「横切范围与代码实现不匹配」（可选 reworkHint，非阻断）。

## 跨平台环境变量设置（第22轮 P3-9 修正）

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

> 第 22 轮新增。第 21 轮调测发现 6 处编码与验收设计不一致（路径/参数/状态码/字段偏离设计）。

编码完成后，S 子代理须对照阶段 1 的 `docs/uat-path-mapping.md` 逐条核对：

- [ ] 路径一致性：映射表中「实际路径」列已回填且与路由定义一致
- [ ] 参数一致性：分页/筛选参数名与验收测试设计一致
- [ ] 状态码一致性：成功/错误状态码与验收测试设计一致
- [ ] 响应字段一致性：响应体字段名与验收测试设计一致

G 子代理跑 [`check-design-contract-consistency.ts`](../scripts/check-design-contract-consistency.ts) 校验，exitCode=0 才放行。

违反任一条 → 回编码修正，禁止「以代码为准」忽略设计。

## 验收标准

- [ ] 代码可编译通过
- [ ] 代码规范检查通过（ESLint / Prettier 或对应语言规范工具）
- [ ] 单元测试代码覆盖率 ≥ 80%
- [ ] 测试报告清晰，包含通过率和单元测试代码覆盖率
- [ ] 代码审查无高危问题
- [ ] RTM 已补登代码模块映射

> 🔴 **CHECKPOINT · 阶段门放行**：代码审查 + 单元测试执行完成后暂停。Agent 必须向用户展示「编译结果 / 规范检查 / 单元测试通过率 / 覆盖率 / 审查报告摘要」，由用户确认「放行进入阶段 6」或「返工」。覆盖率 < 80% 或规范检查非 0 退出码 → 一律返工，不得放行。

## 阶段门评审

代码审查 + 单元测试通过 → 进入阶段 6（集成测试）。
不通过 → 回到编码实现返工，按审查报告 reworkHints 修复后重跑单元测试与规范检查。

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 生成无断言的占位单元测试 | 每个用例必须有明确断言（期望值 vs 实际值） |
| 2 | 只为 happy path 生成单元测试 | 必须覆盖边界条件、异常输入、错误路径 |
| 3 | 让单元测试依赖外部服务（DB/网络） | 用 mock/stub 隔离，单元测试不得发起真实网络或 DB 调用 |
| 4 | 用 `// eslint-disable` 绕过规范检查 | 修复违规源，禁止整文件 disable |
| 5 | 覆盖率不达标时调低阈值放行 | 阈值固定 ≥ 80%，不达标必须补测试 |
| 6 | 伪造实现（TODO/stub）当完成 | 缺失依赖必须暂停标注，不得伪造业务逻辑 |
| 7 | 路由层或控制器入口仅校验 token 存在未校验角色（如 `authRequired=true` 但未校验 `user`/`reader`/`blogger` 角色） | 路由层或控制器入口必须显式校验 `requiredRole`，与需求/设计中的角色枚举一致；token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 Forbidden。详见下方「角色校验清单」节（第 16 轮 P3.1，预防 P7-001 类缺陷） |
| 8 | 响应体字段返回副作用自增前的旧值（如 `viewCount` 自增后响应体仍返回旧值） | 副作用（如计数器自增、状态变更、关联记录创建）须在响应体构造前完成；响应体字段须反映已生效的状态。详见下方「副作用时序一致性清单」节（第 16 轮 P3.3，预防 P7-004 类缺陷） |
| 9 | 复制粘贴重复代码段 | 须提炼函数/类消除重复（坏味道清单 #1，第 40 轮吸收） |
| 10 | 单函数超 ~40 行不拆分 | 按单一职责拆分，保持函数短小（坏味道清单 #2） |
| 11 | 使用布尔标记参数 | 拆分为两个意图明确的函数或枚举参数（坏味道清单 #4） |
| 12 | 有返回值函数还产生可见副作用 | 命令与查询分离：有返回值的函数不修改状态（坏味道清单 #5） |
| 13 | 裸全局可变数据跨模块共享 | 封装变量 / 限制共享数据作用域（坏味道清单 #6 + concurrency-guide） |

## 角色校验清单

> 第 15 轮 P7-001 reader 可发博文（`authRequired` 未校验角色）缺陷的预防清单。每个受保护端点须通过以下检查：

- [ ] 每个受保护端点须有 `requiredRole` 显式声明（在路由配置或控制器入口）
- [ ] `requiredRole` 须与需求/设计文档中的角色枚举一致（如 `user` / `reader` / `blogger` / `admin`）
- [ ] token 解码后须断言 `token.role ∈ requiredRoles`，否则返回 403 Forbidden
- [ ] 单元测试须覆盖「跨角色越权」场景（如 `reader` 调用 `blogger-only` 端点应返回 403）
- [ ] 系统测试须覆盖「越权用例」（详见 [phase-7-system-test.md](phase-7-system-test.md) 禁止行为 #7）

违反任一条 → V-code 评审标注 `reworkHints` + 系统测试用例失败，回 phase-5 返工。关联反模式 [#22 角色越权](anti-patterns.md)。

## 副作用时序一致性清单

> 第 15 轮 P7-004 `PostController.get` 响应体返回 `recordView` 自增前旧 `viewCount` 缺陷的预防清单。每个含副作用端点须通过以下检查：

- [ ] 副作用（如计数器自增、状态变更、关联记录创建）须在响应体构造前完成
- [ ] 响应体字段须反映已生效的状态（如自增后的 `viewCount`，不是自增前的旧值）
- [ ] 单元测试须覆盖「副作用与响应体一致性」场景（断言响应体字段 = 已生效状态）
- [ ] 系统测试须覆盖「时序用例」（详见 [phase-7-system-test.md](phase-7-system-test.md) 禁止行为 #7）

违反任一条 → V-code 评审标注 `reworkHints` + 系统测试用例失败，回 phase-5 返工。关联反模式 [#24 副作用时序不一致](anti-patterns.md)。

## 断言规范（第 40 轮三源吸收）

> 吸收自《重构 2》ch10.6「引入断言」：断言标注"必须为真"的假设，失败表示程序员错误，不应被捕获。

- **内部假设用断言**：前置条件/不变式（如"此值恒非负"）用断言表达，放设值函数（错误源头）优于使用点。
- **外部输入用一等校验**：用户输入/外部服务数据须显式校验并返回错误，不得用断言代替（断言失败 = 崩溃，不适合用户输入）。
- **断言失败不捕获**：断言表示代码错误，捕获即掩盖；禁止 `try { assert(...) } catch {}`。

## 重构纪律（第 40 轮三源吸收）

> 吸收自《重构 2》ch2：两顶帽子 / 三次法则 / 何时不该重构。

- **两顶帽子**：添加功能 vs 重构是两种状态；重构时不加功能、不加测试，切换时明确当前戴哪顶帽子。
- **三次法则**：事不过三——第一次照做、第二次反感但做、第三次重构。
- **何时不该重构**：① 代码凌乱但无需修改且可藏在接口后 → 不动；② 重写比重构容易 → 重写（但须先建测试基线）。
- **营地法则边界**：顺手的小清理限本次改动触及的代码半径内（与操作行为 #5 划界）；大清理记便笺另立票据。

## 改动前测试基线（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch16：重构遗留/不熟代码前先跑覆盖率工具测基线（案例 50%→92%），自己写独立测试补足，再动手改。

- **改动前确认覆盖基线**：对即将修改的模块先跑覆盖率工具 + 既有测试，确认改动前基线。
- **缺口先补**：基线覆盖率低的模块，先补关键路径测试再动手，避免改动后无法区分"新 bug vs 旧债"。
- **与约束 #21 的关系**：约束 #21 管"改动后必跑回归"，本节补"改动前基线"形成闭环。

## 第三方代码边界管理（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch8「边界」。

- **封装边界接口**：第三方类型（如 Map/客户端对象）不跨系统传递，只在少数边界点引用，用包装/ADAPTER 隔离。
- **学习性测试**：用测试学习第三方 API 行为；在库升级时自动检测行为变化（写入 phase-6 集成测试对第三方依赖执行）。
- **使用尚不存在的代码**：接口契约未定时先定义"我想要的接口"+ ADAPTER 桥接，测试用 Fake，待真实实现就绪再替换。

## 静态检查工具接入（第 40 轮三源吸收）

> 用户确认：代码坏味道/并发无法用脚本可靠检查，须用"特定开发语言的静态检查工具 + LLM 语义理解"双轨。

- **机械规则 → 语言静态工具**：编码后须运行项目语言的静态检查工具 + 相关规则集，结果落盘为门禁证据：
  - TypeScript/JS：`eslint`（`max-lines-per-function` / `max-params` / `no-duplicate-imports` 等）+ `tsc --noEmit`
  - Python：`pylint` / `ruff`；Java：`spotbugs` / `PMD`；Go：`golangci-lint`
- **语义坏味道 → LLM 评审**：V-code 评审子代理按 [code-smells-checklist.md](code-smells-checklist.md) 清单执行语义层检查（依恋情结/霰弹式修改/副作用混合/竞态等），命中项标注分级并写入 reworkHints。
- **静态工具结果须真实落盘**：禁止估算"应该没违规"；工具退出码/报告须由 G 子代理核验（约束 #4 真实执行）。
- **工具缺失降级**：项目语言标准工具缺失时，参照 [quality-standards.md](quality-standards.md)「工具缺失与降级处理」节——尝试等价工具，仍缺失则 LLM 评审承担全部检查并在评审中注明。

## L4 features 作为 TDD 夹具

S-code 子代理在编码时遵循 TDD 红-绿-重构循环，以 L4 BDD features 作为夹具：
1. 先跑 `npx cucumber-js features/L4/` 观察 all scenarios fail（红）
2. 实现 step definitions（`features/step_definitions/L4_*.steps.ts`）+ 业务代码
3. 重跑 cucumber 直到 all scenarios pass（绿）
4. 重构代码（保持 scenarios 绿）

G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=5 --cucumber-report=<report.json>` 校验 D5（step 绑定）+ D6（scenario 路径）+ cucumber 报告无失败。

## 返工路径

阶段门评审不通过时，按以下路径返工：
- 设计文档字段缺失/类型不明 → 回 phase-4 补充详细设计
- 技术栈未登记 → 暂停向用户确认技术栈
- 依赖未定义 → 标注缺失依赖并暂停，不得伪造实现
- 单元测试无断言 → 回 phase-4 补断言格式
- ESLint/Prettier 报 error → 列出违规项并修复，禁止 // eslint-disable 绕过
- 覆盖率 < 80% → 补充测试用例，禁止调低阈值

## 退出状态

项目 `status` 更新为 `集成测试`。

## 相关资源

- 编写实现计划技能：参见 [.cursor/skills/writing-plans/SKILL.md](../../.cursor/skills/writing-plans/SKILL.md)
