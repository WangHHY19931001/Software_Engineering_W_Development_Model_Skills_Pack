# BDD 审查参考清单（BDD Review Checklist）

> **来源**：W 模型 v19.0.0 新增（与 [bdd-guide.md](./bdd-guide.md) 配套）
> **W 模型适配**：不新增 `targetKind=bdd`（违反第 9 轮 P2.5 的 4 值枚举约束）。V-bdd 子代理评审 BDD features 时仍用 `targetKind=test`，本清单作为 §7.3「测试用例」的参考资料
> **加载时机**：V-bdd 子代理审查 BDD features 时必读

## 7 项审查清单

> 与 spec §12.3 一一对应。每项含：检查点描述 + 通过标准 + 失败处理。

### 1. 状态机七要素完整性

**检查点**：Background 节是否声明状态集/初始/终态/转移表/不变式/accepting-rejecting/guard-action 七要素。

**通过标准**：
- Background 节含全部 7 个 `@` 字段：`@states` / `@initial-state` / `@terminal-states` / `@accepting-states` / `@rejecting-states` / `@transitions` / `@invariants`
- `@states` 至少 1 个状态（不允许空集）
- `@initial-state` 在 `@states` 中
- `@terminal-states` 字段必须声明（值可空 `()`）；非空时每个在 `@states` 中
- `@accepting-states` 至少 1 个；每个在 `@states` 中
- `@rejecting-states` 字段必须声明（值可空 `()`）；非空时每个在 `@states` 中
- `@transitions` 至少 1 条转移；格式 `From + Event -> To [guard: ...] [action: ...]`；From/To 在 `@states` 中
- `@invariants` 至少 1 条不变式；逻辑表达式

**失败处理**：
- 缺失字段或值不合法 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D3（stateMachineCompleteness）退出码 1
- 走 V→G→R→V→G→S-fix 循环修正

### 2. scenario 路径合法性

**检查点**：每个 scenario 的 Given→When→Then 是否为状态转移表中的合法路径。

**通过标准**：
- 每个 scenario 的 `Given` 起始状态在 `@states` 中
- 每个 `When` 事件在 `@transitions` 中有匹配的 `From + Event` 记录
- 转移后的状态与 `Then` 声明一致
- 多事件 scenario（`And When` 连接）按链式查找：S0 + e1 -> S1, S1 + e2 -> S2, ..., 最终 Sn 与 `Then` 一致
- 每条转移路径完整可在转移表中复现

**失败处理**：
- 路径非法（如 `Given Unauthenticated + When logout + Then LoggedOut`，但转移表中无此 From+Event 组合）→ 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D6（scenarioPathValidity）退出码 1
- 走 V→G→R→V→G→S-fix 循环修正

### 3. TLA+ 等价性

**检查点**：BDD 状态集与同层 TLA+ spec 状态集是否等价（双向包含）。

**通过标准**：
- `set(BDD.states) == set(TLA+ State 集合)`（双向包含）
- `set((From, Event, To) for BDD) == set((From, Event, To) for TLA+ Next 分支)`（双向包含）
- `BDD.initialState == TLA+ Init`
- 不变式集等价：归一化字符串匹配通过；或 R 子代理判定实质一致（措辞不同但语义等价）

**失败处理**：
- 状态集/转移集/初始状态不等价 → 标注 `Critical:` reworkHint
- 不变式集字符串匹配失败 → 触发 R 子代理语义等价判定
  - 实质一致：放行，R 报告记录判定依据
  - 实质不一致：上报人类决策（修正 BDD / 修正 TLA+ / 修正需求设计三选项）
- 触发 `check-bdd-model.ts` D4（tlaEquivalence）退出码 1
- 走 V→G→R→V→G→S-fix 循环

### 4. step 绑定完整性

**检查点**：所有 step 文本是否有对应 step definition（cucumber 报告无 undefined/pending）。

**通过标准**：
- **阶段 1-4**：D5 跳过（step definitions 尚未实现），由 D6（scenario 路径合法性）+ D7（RTM 映射）替代校验
- **阶段 5-8**：
  - `features/step_definitions/` 下所有 .steps.ts 文件提取 Given/When/Then 步骤文本模式
  - 每个 .feature 文件中的 step 文本均有匹配的 step definition
  - cucumber 运行报告（`.w-model/bdd/reports/report.json`）中 `undefined` / `pending` 计数为 0
  - `cucumber.js` 配置 `strict: true`（undefined/pending 视为失败）

**失败处理**：
- 存在 undefined/pending step → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D5（stepBinding）退出码 1
- 阶段 5：S-code 补全 step definition；阶段 6/7/8：S-test 修正 step 或 scenario

### 5. 追溯完整性

**检查点**：features 文件头标注 + scenario TAG 是否覆盖所有相关 REQ/SD/INTF/DD。

**通过标准**：
- features 文件头 `@req` 列表中的每个 REQ ID 在 RTM 中存在
- features 文件头 `@design` 列表中的每个 SD/INTF/DD ID 在图谱中存在
- features 文件头 `@tla-spec` 在 tla-manifest.json 中存在
- features 文件头 `@state-machine` 在 bdd-manifest.json 中存在
- scenario TAG 中所有 `@REQ-NNN` 必须在 features 文件头 `# @req:` 列表中
- scenario TAG 中 `@UAT-NNN` / `@ST-NNN` / `@IT-NNN` / `@UT-NNN` 必须在 RTM 对应 REQ 行的对应字段中
- 每个 REQ 至少有 1 个 scenario 的 TAG 含 `@REQ-<该 REQ ID>`
- `@parent-features` / `@child-features` 与 bdd-manifest.json 一致

**失败处理**：
- 追溯缺失或不一致 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D1（headerCompleteness）+ D7（rtmMapping）退出码 1
- 走 V→G→R→V→G→S-fix 循环修正

### 6. 夹具完备性

**检查点**：scenario 引用的 fixture 文件是否存在于 `features/fixtures/`。

**通过标准**：
- scenario step 文本中引用的 fixture 文件（匹配 `fixtures/<type>/<name>.json`）必须存在于 `features/fixtures/` 对应子目录
- 四类夹具位置合规：
  - Cucumber World 对象在 `features/fixtures/world/custom-world.ts`
  - 测试数据 fixture 在 `features/fixtures/data/*.json`
  - 环境准备 setup/teardown 在 `features/fixtures/hooks/*.ts`
  - 验收产出快照 fixture 在 `features/fixtures/snapshots/*.json`
- 夹具命名遵循约定（数据 `<entity>s.json` / 快照 `<scenario-context>-<num>.json`）

**失败处理**：
- 引用不存在的 fixture → 标注 `Important:` reworkHint
- 触发 `check-bdd-model.ts` D5（stepBinding）扩展校验退出码 1
- S-code / S-test 补全缺失 fixture 或修正引用

### 7. 不变式覆盖

**检查点**：每个状态机不变式至少有 1 个 scenario 验证（Then 步骤含断言）。

**通过标准**：
- Background 节 `@invariants` 中声明的每条不变式至少有 1 个 scenario 的 `Then` / `And` 步骤引用
- scenario 中 `And 不变式 "<表达式>" 应成立` 引用的表达式在 `@invariants` 中已声明
- 不变式断言对应的终态满足该不变式（语义校验由 V 子代理执行，门禁做存在性校验）

**失败处理**：
- 不变式未被任何 scenario 验证 → 标注 `Important:` reworkHint
- scenario 引用未声明的不变式 → 标注 `Critical:` reworkHint
- 触发 `check-bdd-model.ts` D3（stateMachineCompleteness）+ D6（scenarioPathValidity）退出码 1
- S-bdd 补充 scenario 或修正不变式引用

---

## 与 verifier-spec.md 5 维度的映射

V-bdd 子代理产出 VerifierOutput JSON 时，本清单 7 项按以下映射归入 5 维度（不修改 5 维度定义，仅作参考）：

| 本清单项 | verifier-spec.md §7.3 维度 | weight |
|---|---|---|
| 1 状态机七要素完整性 | correctness | 0.25 |
| 2 scenario 路径合法性 | correctness | 0.25 |
| 3 TLA+ 等价性 | coverage | 0.30 |
| 4 step 绑定完整性 | independence | 0.20 |
| 5 追溯完整性 | coverage | 0.30 |
| 6 夹具完备性 | independence | 0.20 |
| 7 不变式覆盖 | coverage | 0.30 |

> 完整 5 维度权重：`coverage` 0.30 / `correctness` 0.25 / `independence` 0.20 / `clarity` 0.15 / `priority-reasonableness` 0.10。

详见 [verifier-spec.md §7.3 测试用例（targetKind = `test`）](./verifier-spec.md)。

## 评审时序与门禁分工

```
阶段 N（1/2/3/4）features 设计完成
  ↓
V 子代理评审（targetKind=test + bdd-review-checklist）
  → 输出 VerifierOutput JSON（meta.targetKind='test'）
  → check-verifier-output.ts 校验 schema + 方差 + evidence（既有）
  ↓ 通过
G 子代理门禁
  → check-bdd-model.ts 静态结构校验
  → 校验 7 维度：D1 头标注 / D2 语法 / D3 状态机 / D4 TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射
  ↓ exitCode=0
阶段门放行
```

**门禁分工原则**（与 TLA+ 对称）：
- `check-verifier-output.ts` 校验 V 评审输出的 schema 合规性（防 LLM 漂移）
- `check-bdd-model.ts` 校验 BDD features 本身的静态结构合规性（防占位/简化/错误实现）
- 两者正交：V 评审可能通过但 G 门禁失败（features 结构问题），或 V 评审失败但 G 门禁通过（features 结构合规但内容质量不足）

## evidence 引用规则

BDD features 评审的 `subCriteria[*].evidence` 须引用 features 文件内具体位置：

| 引用类型 | 格式 | 示例 |
|---|---|---|
| features 文件 + 行号 | `features/L1/blog_system-001.feature:L23-45` | scenario 步骤引用 |
| 状态机声明 | `features/L1/blog_system-001.feature:Background:L5-15` | 状态集/转移表引用 |
| scenario TAG | `features/L1/blog_system-001.feature@REQ-001:L17` | 追溯 TAG 引用 |
| step definition | `features/step_definitions/auth.steps.ts:L42-58` | step 绑定引用 |
| TLA+ spec 对照 | `tla/L1_blog_system.tla:L30-50` | 等价性 evidence |

> 与 §6.2.1 evidence 可追溯约束一致：禁止仅引用文件名不标行号。

## V 子代理自检清单扩展

在 §4.2.1 V 子代理约束清单基础上，BDD features 评审额外自检：

6. **BDD 状态机 evidence**：`coverage` 子标准的 evidence 须引用 Background 节状态机声明的具体行号，且状态数与同层 TLA+ spec 状态数一致
7. **scenario 路径 evidence**：`correctness` 子标准的 evidence 须引用至少 3 个 scenario 的 Given/When/Then 行号 + 对应状态转移表行号
8. **TLA+ 等价性 evidence**：`coverage` 子标准须包含 1 条 evidence 引用同层 TLA+ spec 的 State/Next 定义行号，证明状态集等价

## W 模型交叉引用

- [反模式 #29](./anti-patterns.md)：BDD 建模与需求/设计/TLA+ 不符未回退
- [bdd-guide.md](./bdd-guide.md)：BDD 建模指南（流程约束 / 头标注 / 状态机七要素 / 门禁调用）
- [bdd-syntax-reference.md](./bdd-syntax-reference.md)：Gherkin 完整语法
- [bdd-patterns-examples.md](./bdd-patterns-examples.md)：BDD 模式示例库（按 L1/L2/L3/L4 分类）
- [tla-plus-review-checklist.md](./tla-plus-review-checklist.md)：TLA+ 评审 7 项清单（对称参考）
