# LLM-as-a-Verifier 评审规范（Verifier Spec）

> **§0 按需分节加载导引**（约束 #6）：本文件较大，按下表只读所需节，禁止整文件载入上下文。
>
> | 触发场景 | 只读章节 |
> |---|---|
> | 评审某 targetKind 用哪套子标准 | §2 + §7（对应子节） |
> | 构造评审提示词 | §8 |
> | 输出 JSON 前自检必填字段 / 防编造 | §4.2.1 + §6 |
> | 校验脚本调用与退出码 | §10 |
> | LLM 失败 / 降级 / 方差超阈值 | §11 |
> | 多候选排序 | §5 |
> | 跨阶段 evidence 一致性 | §12 |
>
> 适用对象：外部 AI Agent（TRAE / Claude / 其他）按本规范对 W 模型各阶段产物执行
> LLM-as-a-Verifier 评审，并将结构化结果写入 JSON 文件交由
> [`scripts/cli/check-verifier-output.ts`](../scripts/cli/check-verifier-output.ts) 校验防漂移。
>
> 本技能**不内置 LLM 调用**。技能只提供「提示词 + 输出 schema + 校验脚本」三件套，
> 评审执行由外部 Agent 完成。技能演化（SkillOpt / darwin-skill）与本规范解耦：
> 本规范只覆盖「阶段产物校验流程」，不包含 Rollout / Reflect / Edit 等轨迹内容。

## 速查摘要

> 一页速查：LLM-as-a-Verifier 评审规范。评审执行由外部 Agent 完成，技能只提供「提示词 + 输出 schema + 校验脚本」三件套，不内置 LLM 调用。

| 维度 | 核心锚点 | 详见 |
|---|---|---|
| 目标类型 | 5 种 targetKind（requirement/design/code/test/rootcause）+ 各阶段 subCriteria 标准模板 | §2 |
| 三维度验证 | 评分粒度（≥3 子标准）/ 重复评估（repeatTimes≥3）/ 标准分解（evidence 必填） | §3 |
| 连续评分 | logits 期望值 / text-parse 回退（±0.05 扰动） | §4 |
| PPT 排序 | 多候选优先级排序（k/temperature/rounds） | §5 |
| 输出 Schema | VerifierOutput JSON（subCriteria==5 项 / compositeScore / qualityLevel / passed） | §6 |
| 质量等级 | A[0.85,1] / B[0.70,0.85) / C[0.50,0.70) / D[0,0.50) | §6.1 |
| 通过判定 | passed = (A‖B) && 所有子标准 ≥0.70（单轴下限 R13） | §6.3 |
| 子标准定义 | 5 类目标各自的 5 项子标准 + 权重 | §7 |
| 校验脚本 | check-verifier-output.ts（退出码 0/1/2） | §10 |
| 异常处理 | 重试 / 降级 / 方差超阈值 / evidence 失效 | §11 |
| 跨阶段一致性 | 后阶段 evidence 不得否定前阶段 | §12 |
| self-as-verifier | V 评审产出独立性（路径/内容/run-log/视角） | §13 |

**按场景只读 §X**：

| 场景 | 应读章节 |
|---|---|
| 评审某 targetKind 用哪套子标准 | §2 + §7（对应子节） |
| 构造评审提示词 | §8（模板 + 占位符） |
| 输出 JSON 前自检必填字段 / 防编造 | §4.2.1 + §6 |
| 校验脚本调用与退出码 | §10 |
| LLM 失败 / 降级 / 方差超阈值 | §11 |
| 多候选排序 | §5 |
| 跨阶段 evidence 一致性 | §12 |
| self-as-verifier 模式 | §13 |
| 评审独立性 / 误报质疑 / scoped re-review / spec 自审与校准口径 | §15（含 §15.1-§15.4） |

## 目录

- §1–2：设计原则与目标类型
- §3–5：三维验证、连续评分与 PPT 排序
- §6：输出 Schema 与质量等级
- §7：各目标类型子标准
- §8：外部 Agent 提示词模板
- §9–11：校验、集成与异常处理
- §12：跨阶段 evidence 一致性
- §13：self-as-verifier 模式（V 评审产出独立性）
- 独立评审会话模板

## 1. 设计原则

1. **技能内不做 LLM 调用**：所有 LLM 推理由外部 Agent 执行。本规范只规定提示词与输出格式。
2. **结构化输出优先**：评审必须输出严格符合 §6 Schema 的 JSON，禁止自由文本。
3. **校验脚本防漂移**：[`check-verifier-output.ts`](../scripts/cli/check-verifier-output.ts)
   对输出 JSON 做字段、数值范围、子标准覆盖、可重复性方差等校验，不符合规范直接判失败。
4. **三维度验证 + 连续评分 + PPT 排序**：保留原 LLM-as-a-Verifier 学术框架的三大支柱
   （见 §3 / §4 / §5），但实现方式改为「提示词描述算法 + 外部 Agent 执行」。

### 验证器定位三原则

1. **验证器是编辑者，不是作者**（失控 ch19）：自然选择/评审只裁剪不合适的变体，不承担创造职责；创造来自变体（S 子代理多方案），验证器负责选择——与「编排者最小化」同构（O 不实施，V 只校验）。
2. **调节器不关心原因，只检测偏差并纠正**（失控 ch7）：外部验证 Agent 检测偏差（对照硬约束/RTM/TLA+ 不变式），不需要也不应该承担根因定位——根因定位归专门的 R 循环（root-cause-locator.md）；单一强门禁可间接约束全局质量状态（钢厂只控制牵引一个变量稳住全部厚度偏差）。
3. **运行系统是发现涌现结构的唯一且最短路径**（失控 ch2）：任何纸面推演/评审都无法替代把系统跑起来——"是否放行"由确定性脚本的真实运行结果（exitCode）决定，评审是概率性意见，运行是可重复证据（强化约束 4/10）。

## 2. 适用目标类型

| 目标类型 | targetKind | ID 前缀 | 评审子标准集合 |
|---|---|---|---|
| 需求 | `requirement` | `REQ-` | §7.1 |
| 设计文档 | `design` | `DESIGN-` | §7.2 |
| 测试 | `test` | `UAT-` / `ST-` / `IT-` / `UT-` | §7.3 |
| 代码 | `code` | （文件路径） | §7.4 |
| 根因报告 | `rootcause` | `RC-` | §7.5 |

> `/wm review <target>` 命令会识别目标类型并指引外部 Agent 加载本规范相应章节。

### 2.1 目标类型与产出阶段

| targetKind | 产出阶段 | 产物示例 |
|---|---|---|
| `requirement` | 阶段 1 需求分析 | 需求规格说明书（`*-requirement-spec.md`） |
| `design` | 阶段 2 系统设计 / 阶段 3 概要设计 / 阶段 4 详细设计 | 系统设计/接口设计/详细设计文档 |
| `test` | 阶段 1~4（设计）/ 阶段 5~8（执行） | 验收/系统/集成/单元测试用例 |
| `code` | 阶段 5 编码 | 源代码文件（`.ts` / `.py` / `.java` 等） |
| `rootcause` | 全阶段 普通 V/G 失败链（hard-constraints） | RootCauseReport（`.w-model/rootcause/<reportId>.json`） |

### 2.2 targetKind 枚举规范

> `meta.targetKind` 必须取自以下 5 值枚举。`testcase` / `file` 已废弃，分别用 `test` / `code` 替代。`rootcause` 为 V 复审根因报告（RootCauseReport）的专用 `targetKind`。

**合法枚举**：

| 枚举值 | 适用阶段 | 含义 | 与原值的关系 |
|---|---|---|---|
| `requirement` | phase 1 | 需求规格说明 | 不变 |
| `design` | phase 2 / 3 / 4 | 系统 / 接口 / 详细设计 | 不变 |
| `code` | phase 5 | 源代码 | **取代原 `file`** |
| `test` | phase 6 / 7 / 8 | 集成 / 系统 / 验收测试 | **取代原 `testcase`** |
| `rootcause` | 返工循环（V 复审 R 报告） | 根因报告复审（§7.5 子标准集合） | —（无旧值映射） |

**废弃值映射**：

| 废弃值 | 新值 | 迁移说明 |
|---|---|---|
| `testcase` | `test` | 阶段 1~4 测试用例设计文档 + 阶段 6~8 测试执行报告统一用 `test` |
| `file` | `code` | 阶段 5 源代码评审用 `code`，与 `code-tla-consistency` 维度命名对齐 |

> `rootcause` 为 V 复审根因报告（RootCauseReport）的合法 `targetKind`（详见 §7.5）：`check-verifier-output.ts` 按 §7.5 子标准集合（correctness / completeness / falsifiability / actionability / prevention）校验该 VerifierOutput；RootCauseReport 本身（rootCauseChain / fixRecommendation / prevention 等字段）由 `check-rootcause-report.ts` 独立校验（R1-R11）。两者互补不互替。

**校验**（由 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 强制执行）：

```typescript
const allowedKinds: TargetKind[] = ['requirement', 'design', 'code', 'test', 'rootcause'];
if (!allowedKinds.includes(targetKind as TargetKind)) {
  reasons.push(`meta.targetKind 必须为 ${allowedKinds.join(' / ')}，实际为 ${JSON.stringify(targetKind)}（P2.5: 'testcase'/'file' 已废弃，分别用 'test'/'code'）`);
  return { passed: false, ... };
}
```

非法值（含 `testcase` / `file` / 其他任意值）→ 退出码 1，VerifierOutput 判定不通过。

### 2.3 各阶段 subCriteria 标准模板

> 各阶段的 `verifier-output.subCriteria` 名称必须取自下表标准集合（允许子集，但不允许新增名称）。本表与 §7 子标准定义一致，按 `targetKind` 推断阶段后校验。

**5 targetKind × subCriteria 标准模板**：

| targetKind | 适用阶段 | subCriteria 标准名称（权重） | 权重和 |
|---|---|---|---|
| `requirement` | phase 1 | `completeness`(0.30) / `clarity`(0.25) / `consistency`(0.20) / `testability`(0.15) / `traceability`(0.10) | 1.00 |
| `design` | phase 2 / 3 / 4 | `architecture-soundness`(0.25) / `requirement-coverage`(0.25) / `interface-consistency`(0.20) / `feasibility`(0.15) / `testability`(0.15) | 1.00 |
| `code` | phase 5 | `correctness`(0.30) / `security`(0.20) / `readability`(0.15) / `maintainability`(0.15) / `conformance`(0.20) | 1.00 |
| `test` | phase 6 / 7 / 8 | `coverage`(0.30) / `correctness`(0.25) / `independence`(0.20) / `clarity`(0.15) / `priority-reasonableness`(0.10) | 1.00 |
| `rootcause` | 返工循环（V 复审 R 报告） | `correctness`(0.25) / `completeness`(0.25) / `falsifiability`(0.20) / `actionability`(0.15) / `prevention`(0.15)（§7.5） | 1.00 |

**8 阶段对照表**（按 `targetKind` 推断阶段）：

| 阶段 | targetKind | subCriteria 来源 | 备注 |
|---|---|---|---|
| phase 1 需求分析 | `requirement` | §7.1 | 5 项标准 |
| phase 2 系统设计 | `design` | §7.2 | 5 项标准 |
| phase 3 概要设计 | `design` | §7.2 | 同 phase 2（系统/接口/详细设计共用 design 集合） |
| phase 4 详细设计 | `design` | §7.2 | 同 phase 2 |
| phase 5 编码实现 | `code` | §7.4 | 5 项标准；五轴评审维度（§7.4A）映射到 `conformance`/`security` 等 |
| phase 6 集成测试 | `test` | §7.3 | 5 项标准 |
| phase 7 系统测试 | `test` | §7.3 | 同 phase 6（集成/系统/验收测试共用 test 集合） |
| phase 8 验收测试 | `test` | §7.3 | 同 phase 6 |
| 返工循环（V 复审 R 报告） | `rootcause` | §7.5 | 5 项标准；根因诊断专用维度（不使用 §7.4A 五轴） |

**权重说明**：

- 表中所列权重为标准值，所有 subCriteria 权重之和必须为 `1.0`（由 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 校验）。
- subCriteria 数量必须等于标准集合大小（5 项），不允许子集或超集（与 §3.1「≥3 个」最小约束叠加：脚本强制 == 5 项）。
- 名称必须精确匹配（大小写敏感、连字符敏感），不允许新增名称或重命名。

**校验逻辑**（由 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 强制执行）：

```typescript
const expected = SUB_CRITERIA[targetKind as TargetKind];
if (subCriteria.length !== expected.length) {
  reasons.push(`targetKind=${targetKind} 应有 ${expected.length} 个子标准，实际 ${subCriteria.length} 个`);
}
// 逐项校验 name 与 weight
```

> 8 阶段对照通过 `targetKind` 推断阶段实现（phase 2/3/4 共用 `design`，phase 6/7/8 共用 `test`）；subCriteria 标准按 targetKind × 5 项组织（`rootcause` 按 §7.5 集合）。

> 多角度评审（V-lead 加载 N 个 V-persona）不影响 subCriteria 标准：每个 V-persona 仍按本表标准集合评估，V-lead 聚合产出最终 VerifierOutput（详见 [agent-personas.md](agent-personas.md) §3）。

### 2.4 常见违规示例

> V 子代理常见违规：手工编造 subCriteria 名称、使用非法 mappingType、添加额外字段（缺陷 D12/D31 类）。以下为常见违规示例及正确写法。

**违规示例 1：mappingType 使用非法值**

```json
// ❌ 违规：mappingType 使用 "NFR" / "CON" 不在枚举内
{ "mappingType": "NFR" }
{ "mappingType": "CON" }

// ✅ 正确：mappingType 须 ∈ ["直接", "等价", "替代"]
{ "mappingType": "直接" }
```

**违规示例 2：subCriteria.name 不匹配标准名称**

```json
// ❌ 违规：使用中文或不匹配 ^[a-z][a-z-]*$ 模式
{ "name": "性能" }
{ "name": "安全" }
{ "name": "Correctness" }

// ✅ 正确：使用 §2.3 表格中的标准名称（小写+连字符）
{ "name": "correctness" }
{ "name": "security" }
{ "name": "architecture-soundness" }
```

**违规示例 3：额外字段违反 additionalProperties: false**

```json
// ❌ 违规：添加 schema 未定义的字段
{ "name": "correctness", "weight": 0.3, "customField": "xxx" }

// ✅ 正确：仅使用 schema 定义字段（name/description/weight/score/rawScores/variance/evidence）
{ "name": "correctness", "weight": 0.3, "score": 0.85, "rawScores": [0.83, 0.85, 0.87], "variance": 0.000267, "evidence": "L45-52" }
```

**推荐 subCriteria 名称清单**（直接引用 §2.3 表格）：
- requirement: `completeness` / `clarity` / `consistency` / `testability` / `traceability`
- design: `architecture-soundness` / `requirement-coverage` / `interface-consistency` / `feasibility` / `testability`
- code: `correctness` / `security` / `readability` / `maintainability` / `conformance`
- test: `coverage` / `correctness` / `independence` / `clarity` / `priority-reasonableness`

## 3. 三维度验证（Three-Dimension Verification）

每个目标必须按以下三个维度独立评估，最终综合分数由三维度融合得出。

### 3.1 评分粒度（Granularity）

- 不接受单一整体打分。必须将目标拆分为 ≥3 个评估子标准（见 §7），每个子标准独立打分。
- 子标准分数取值范围：`[0.0, 1.0]` 连续浮点（保留 4 位小数）。
- 综合分数 = 子标准分数的加权平均（权重见 §7 各子表）。

### 3.2 重复评估（Repetition）

- 同一目标必须独立评估 `repeatTimes` 次（默认 `3`，可由 Agent 配置但 ≥3）。
- 每次评估使用不同的随机种子（温度 / 上下文扰动），不得共享中间状态。
- 最终子标准分数 = `repeatTimes` 次评估的均值。
- 子标准方差必须 ≤ `varianceThreshold`（默认 `0.10`），否则视为不可重复，
  `check-verifier-output.ts` 会判失败并要求重评。
- **防漂移**：`check-verifier-output.ts` 会根据 `rawScores` **重算方差**并与输出
  的 `variance` 字段对比，误差超过 `1e-6`（§3.2.1 规则 2）即判失败。Agent 不得谎报低方差以
  掩盖「实际只评估 1 次、复制 N 次填入 rawScores」的作弊行为。

#### 3.2.1 防漂移实现规则（`check-verifier-output.ts` 强制执行）

> 命中以下任一规则即判失败（退出码 1）。针对 D12 缺陷：V 子代理曾手工编造 `rawScores`、误算 `variance`，以下规则为可执行检测项。

1. **rawScores 全同检测**：`rawScores` 所有元素严格相等（`max === min`）→ fail。视为「复制填入」作弊，与 `repeatTimes ≥ 3` 矛盾（多次独立扰动不可能产生完全一致的分值）。
2. **variance 重算校验**：用 `rawScores` 重算方差（**总体方差公式** `Var = Σ(xᵢ - μ)² / N`，注意是除以 `N` 而非样本方差的 `N-1`），与输出 JSON 声明的 `variance` 字段对比，差异 > `1e-6` → fail。Agent 必须采用同一公式计算，避免因 `N` vs `N-1` 导致阈值级误差。
3. **±0.05 扰动范围校验**（`meta.scoringMethod === 'text-parse'` 模式专属）：`max(rawScores) - min(rawScores)` 须落在 `[0.01, 0.10]` 区间。
   - `< 0.01` → 警告（扰动过小，疑似未实际扰动，提示重评）；
   - `> 0.10` → fail（扰动超出 ±0.05 设计上限 `2 × 0.05 = 0.10`，疑似手工编造分值）。
4. **logits 模式豁免**：`meta.scoringMethod === 'logits'` 时不校验扰动范围（logits 期望值天然有差异，无需 ±0.05 扰动约束），但仍执行规则 1 / 2。

### 3.3 标准分解（Decomposition）

- 每个子标准必须给出：`name` / `description` / `weight` / `score` / `evidence`。
- `evidence` 必须引用目标内部的具体片段（行号 / 段落 ID / 字段名），不得空泛描述。
- `evidence` 缺失或与目标内容无关 → 子标准判 0 分。
- **单轴下限（R13）**：每个子标准 `score` 必须 ≥ `0.70`（B 级分界，§6.1）。
  任一子标准低于该值即视为该维度不达标，`passed=false`——即使其余子标准高分将
  `compositeScore` 加权平均拉至 ≥ 0.70 也不放行（防止加权平均掩盖单轴失败，
  对应外部 code-review 双轴报告永不合并原则；详见 §6.3 与反模式 #41）。
- **多子代理协作评审维度（R14-R17）**：当评审对象由多个角色/子代理共同产出（如 S-doc/S-tla/S-bdd 组合、ingestion A-chunk 合并、opsx 三段式产物），V 评审须额外回答协作质量四问（Agentic Design Patterns ch7+ch19）：
  - **R14 交接完整性**：角色间交接的信息是否传对/传全（对照 signature-chain inputProvenance）。
  - **R15 计划坚持度**：产出是否偏离既定计划/票据（对照 tickets.md frontier / opsx propose）。
  - **R16 角色-任务匹配**：是否为任务选对了角色/persona（对照 agent-personas.md「Persona 矩阵」节）。
  - **R17 增量价值**：新增角色/子代理是否带来增量价值（无价值则提示精简）。
  - 实现：R14-R17 为评审附加检查项，四问结论以固定前缀写入 VerifierOutput 的 `summary` 文本
    （`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），**不进入 `subCriteria` 数组**——§2.3 与 verifier-logic.ts
    强制 subCriteria 数量固定为 5（不允许子集/超集），追加会破坏 `check-verifier-output.ts` 校验。
    R14-R17 仅当 `VerifierOutput.targetKind ∈ {design, code}` 且产物含多角色来源时启用；不破坏既有 R1-R13。

## 4. 连续评分（Continuous Scoring）

### 4.1 推荐实现（logits 期望值）

若底层 LLM 提供 logits 接口，按以下算法计算连续分数：

1. 在提示词末尾追加单选题：「请用字母作答：本子标准的达成度属于哪一档？
   A=完全达成 / B=基本达成 / C=部分达成 / D=完全未达成」。
2. 取 A / B / C / D 四个 token 的 logits，做 log-softmax 归一化得概率 `p_A, p_B, p_C, p_D`。
3. 连续分数 = `1.00 * p_A + 0.67 * p_B + 0.33 * p_C + 0.00 * p_D`。
4. 该方法数值稳定，且与离散打分兼容（取 argmax 即恢复字母档）；字母语义与 §6.1 质量等级一致（A 优 / D 差），避免同一字母在不同章节含义冲突。

### 4.2 文本回退实现（text-parse）

若 LLM 不提供 logits，按以下流程：

1. 在提示词末尾追加：「请仅输出一个字母作答：A / B / C / D」。
2. 解析模型输出首个出现的字母（A-D），忽略大小写。
3. 连续分数 = 该字母对应的离散锚点（A=1.00 / B=0.67 / C=0.33 / D=0.00）+ `±0.05` 的稳定扰动
   （扰动种子由子标准 name + 目标 ID 哈希得到，保证可复现）。

> 两种实现均输出 `[0.0, 1.0]` 连续分数，下游消费方不感知差异。
> Agent 必须在输出 JSON 的 `scoringMethod` 字段标注实际使用的方法。

#### 4.2.1 V 子代理约束清单（防手工编造）

> 针对 D12 / D31 缺陷：V 子代理曾手工编造 `rawScores`、误算 `variance`、漏填必填字段，导致 VerifierOutput 跨 3 阶段系统性不合规。以下为 V 子代理执行评审时的强制清单，输出 JSON 前必须逐项自检。

V 子代理在输出 VerifierOutput JSON 前必须自检：

1. **必填字段齐全**：`meta` / `subCriteria`（评估维度，含每项的 `name` / `weight` / `score` / `rawScores` / `variance` / `evidence`）/ `compositeScore` / `qualityLevel` / `passed` / `summary` 均不得缺失。
2. **禁止手工编造 rawScores**：必须实际执行 `repeatTimes ≥ 3` 次扰动评分（不同随机种子 / 温度 / 上下文扰动），将每次真实评分填入 `rawScores`；禁止复制同一个分数填满数组（详见 §3.2.1 规则 1）。
3. **rawScores 须有实际差异**：`rawScores` 各元素不得全同；text-parse 模式下 `max - min` 须 ∈ `[0.01, 0.10]`（详见 §3.2.1 规则 3）。
4. **variance 须由 rawScores 自动计算**：禁止手工填写 `variance` 字段；必须用总体方差公式 `Var = Σ(xᵢ - μ)² / N` 从 `rawScores` 计算（与 `check-verifier-output.ts` 重算公式一致，避免因 `N` vs `N-1` 差异导致 `1e-6` 误差判失败；详见 §3.2.1 规则 2）。
8. **不变式业务语义对齐**（P2.6）
   - 校验：TLA+ 每个不变式是否真实反映设计文档的业务约束
   - 评审者须为每个不变式提供：
     - 设计文档引用（如 `design.md §X.X`）
     - 业务语义解释（一句话说明不变式约束的业务含义）
   - 评分权重：纳入 compositeScore 计算
   - 不变式仅语法/模型检查通过但业务语义无法对应设计文档 → 该项 0 分
9. **断言强度与「是否真的在测东西」自检**（S21，判据见 `quality-standards.md`「测试质量判据（S21/S19/S20/M03）」§①/§②）：`targetKind=test` 时逐条核对——测试是否只断言「有意的决定」而成为 change detector；是否只断言「源文本包含某行」而落入 string-presence trap；测试名 / 意图能否**点名它抓的破坏**（"Name the break" 前置门，点不出即判测试无效并要求重命名或删除）；期望值是否由被测代码或其 helper 推导 / 复制（mirror assertion）。并按 **Mutation Check 5 类变异**核对「每个现实变异至少让一个测试转红」。本项**不新增子标准名**，作为 `correctness` / `clarity` / `independence` 既有子标准的证据要求。
10. **mock 规则自检**（S20，判据见同节 §③）：替换真实方法前是否已学清其**全部副作用**；替身是否镜像被替对象的**全部已文档化字段**（而非只镜像测试读到的字段）；生产类是否混入 **test-only 方法**。**作用域限定**：本项只评审**被测生产代码**；门禁 fixture（`samples/**`）与本仓脚本按「是否忠实模拟被替对象」判定，**不适用** mock 三条硬规则。
11. **S-tickets 产出评审自检**（S18，判据见 `command-reference.md`「S18 票据内容门禁」条——六条黑名单 + Buildability 三条负面判据 + 已知边界）：评审 S-tickets 产出时，按该判据核对票据内容（符号级契约是否点名、占位短语 / 无具体动作祈使 / 未定义符号引用 / Buildability 负面形态是否为零；已知边界由 V 复核兜底）。本项**不新增子标准名**，作为既有子标准的证据要求；判据全文以 `command-reference.md` 与 `gate-logic.ts` 实现为权威，此处只指向、不复制。

## 独立评审会话模板

> 吸收自《agent 时代的人月神话》第 6/13 章：新会话是不带沉没成本的独立评审者——成本几美分，换来真正独立、无内部政治的评审。

**模板提示词**（V 子代理或新会话执行）：
「你不知道这份文档之前的讨论，仅凭它本身给出评审意见——指出所有含糊、遗漏、内部矛盾的地方。」

**使用规则**：
- 重要决策"拍完板之后"用新会话审读，效果优于共享上下文会话（无沉没成本、会问"你说做完了 X，我看代码里没有 X 的实现"）。
- **评估不等于必须改**：评审意见须甄别——特别是明显是馊主意或幻觉的建议，不必执行（第 14 章）。

## 5. PPT 优先级排序（Probabilistic Pivot Tournament）

当一次评审涉及多个候选目标（如多份候选设计文档、多个测试用例）需要排出优先级时，使用 PPT：

### 5.1 算法描述

> 算法源自 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 「LLM-as-a-Verifier: A General-Purpose Verification Framework」§4.3 Probabilistic Pivot Tournament (PPT)。
> 本节为算法描述，**由外部 Agent 执行**；技能仅校验输出 JSON 的 `ranking` 字段合理性（见 §6 / [`scripts/logic/verifier-logic.ts`](../scripts/logic/verifier-logic.ts)），不实现算法本身。

**核心思路**：将 N 个候选的两两全比较（O(N²)）替换为「每候选 vs k 个枢轴」比较（O(N·k)），在保留排序质量的前提下显著降低 token 预算。

**关键参数**：

| 参数 | 默认 | 取值约束（由校验脚本强制） | 含义 |
|---|---|---|---|
| `k` | `5` | 整数 ∈ [2, 1000] | 锦标赛规模；每候选与 `k` 个枢轴比较 |
| `temperature` | `4.0` | 正数 ≤ 100 | 软比较温度；放大分数差以提升 sigmoid 区分度 |
| `rounds` | `N * k` | 整数 ≥ 1 | 总比较轮数；由 Agent 根据预算与精度权衡确定 |

**算法流程**（5 阶段流水线）：

1. **候选池**：收集 N 个候选目标，每个已有综合分数 `score_i ∈ [0,1]`（来自 §4 连续评分）。
2. **环状配对**（Ring Pairing，消除位置偏差）：将候选按环形配对，先用 Bradley-Terry 模型做初步两两比较，得到每个候选的 ring-pass 分数 `w(i)`。
3. **枢轴选择**：按 `w(i)` 降序排序，取 top-`k` 作为枢轴集 `P`（保留最强候选作为锚点，避免随机枢轴浪费预算）。
4. **枢轴锦标赛**：每个非枢轴候选 `i` 与 `P` 中所有 `k` 个枢轴 `p` 做软比较；累计 `k` 次胜率均值作为候选 `i` 的最终得分。
5. **排序输出**：按累计胜率降序，输出 `ordered` 数组。

**软比较胜率公式**：

```
p(i ≻ j) = sigmoid((score_i - score_j) × temperature)
         = 1 / (1 + exp(-(score_i - score_j) × temperature))
```

- 当 `temperature → ∞` 时退化为 `argmax`（硬比较，区分度最大但对噪声敏感）；
- 当 `temperature → 0` 时退化为 `0.5`（无区分度）；
- 默认 `4.0` 在分数差 `0.10` 时给出胜率 ≈ `0.60`，区分度足够且不过度放大噪声。

**时间复杂度**：每候选比较 `k` 次，`N` 个候选共 `N·k` 次软比较；每次软比较涉及一次 LLM 调用（logits 读取或文本解析），总开销 `O(N·k)`。相比 round-robin 全比较 `O(N²)`，当 `k ≪ N` 时显著节省 token。

**伪代码**：

```
输入: candidates[1..N], scores[1..N], k, temperature
输出: ordered[1..N]

# 第 2-3 阶段：环状配对 + 选枢轴
1. ring_scores = ring_pairing_tournament(candidates, scores)
2. pivots = top_k(ring_scores, k)             # |pivots| = k

# 第 4 阶段：枢轴锦标赛
3. for i in 1..N:
4.   win_rate[i] = mean( sigmoid((scores[i] - scores[p]) * temperature)
                        for p in pivots )

# 第 5 阶段：排序输出
5. ordered = sort_by(win_rate, descending=True)
6. return ordered
```

> **本技能的边界**：技能不实现 PPT 算法本身，只校验外部 Agent 输出的 `ranking` 字段（见 §6）。参数 `k` / `temperature` / `rounds` 的合理性边界由 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 强制（`k ∈ [2,1000]`、`temperature ∈ (0,100]`、`rounds ≥ 1` 的整数）。

### 5.2 输出

PPT 结果作为 `ranking` 字段输出（仅当多候选时存在，单候选可省略）：

```json
{
  "ranking": {
    "algorithm": "PPT",
    "k": 5,
    "temperature": 4.0,
    "rounds": 25,
    "ordered": ["DESIGN-002", "DESIGN-001", "DESIGN-003"]
  }
}
```

## 6. 输出 Schema（JSON）

外部 Agent 必须输出严格符合以下 Schema 的 JSON 文件，供
[`check-verifier-output.ts`](../scripts/cli/check-verifier-output.ts) 校验：

```typescript
interface VerifierOutput {
  /** Schema 版本，当前固定为 "1.0" */
  schemaVersion: '1.0';

  /** 评审元信息 */
  meta: {
    /** 评审目标类型 */
    targetKind: 'requirement' | 'design' | 'code' | 'test' | 'rootcause'; // 5 值枚举（§2.2）；rootcause 为合法 targetKind（§2.2 / §7.5），RootCauseReport 本身由 check-rootcause-report.ts 独立校验
    /** 目标 ID 或文件路径 */
    target: string;
    /** 评审时间 ISO 8601 */
    reviewedAt: string;
    /** 评审 Agent 标识（如 "claude-opus-4" / "gpt-4o" / "trae-glm-5"） */
    agent: string;
    /** 评分方法：logits 期望值 或 文本回退 */
    scoringMethod: 'logits' | 'text-parse';
    /** 重复评估次数 */
    repeatTimes: number;
    /** 方差阈值 */
    varianceThreshold: number;
  };

  /** 子标准评估结果（== 5 项，对应 §7 各目标类型；§2.3 与脚本强制固定为 5 项，不允许子集/超集） */
  subCriteria: Array<{
    /** 子标准名称，必须命中 §7 中定义的子标准名 */
    name: string;
    /** 子标准说明（可省略，用于人类可读） */
    description?: string;
    /** 权重，所有子标准权重之和必须 = 1.0 */
    weight: number;
    /** 子标准最终分数（重复评估均值），范围 [0.0, 1.0] */
    score: number;
    /** 重复评估各次原始分数，长度 = meta.repeatTimes */
    rawScores: number[];
    /** 子标准分数方差，必须 ≤ meta.varianceThreshold */
    variance: number;
    /** 证据引用（目标内行号 / 段落 ID / 字段名），不得为空字符串 */
    evidence: string;
  }>;

  /** 综合分数 = Σ(score * weight)，范围 [0.0, 1.0] */
  compositeScore: number;

  /** 质量等级（由综合分数映射） */
  qualityLevel: 'A' | 'B' | 'C' | 'D';

  /** 主结论与改进建议（人类可读）；须为阶段 digest 三要素（见 §6.1） */
  summary: string;

  /** 是否通过阶段门评审 */
  passed: boolean;

  /** 不通过时的返工建议（passed=false 时必填） */
  reworkHints?: string[];

  /** 多候选排序（可选，仅当一次评审涉及多候选时） */
  ranking?: {
    algorithm: 'PPT';
    k: number;
    temperature: number;
    rounds: number;
    ordered: string[];
  };
}
```

### 6.1 质量等级映射

| 综合分数 | 等级 | 含义 |
|---|---|---|
| `[0.85, 1.00]` | A | 完全达成，可放行 |
| `[0.70, 0.85)` | B | 基本达成，可附条件放行 |
| `[0.50, 0.70)` | C | 部分达成，需返工 |
| `[0.00, 0.50)` | D | 未达成，必须返工 |

### 6.2 summary 字段内容要求（阶段 digest 三要素）

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/concepts.md` 的 Comprehension Debt 概念。`summary` 不仅是主结论，更是**阶段 digest**——供用户在 CHECKPOINT 放行时对照理解，填写 `acknowledgedDecisions`（见 [quick-self-check.md](quick-self-check.md)「完成定义（DoD）」节 第六维度）。

V 子代理须在 `summary` 中包含：

1. **本阶段关键决策摘要**（≥1 条）：设计选型/架构决策/范围取舍/风险接受。
2. **本阶段产物核心结构**（1-2 句）：如"系统设计含 4 模块、3 接口、2 数据模型"。
3. **遗留风险/已知限制**（如有）：如"TLA+ L2 未覆盖文章删除级联"、"性能基线待阶段 7 k6 实测"。

**示例**：

```
本阶段系统设计采用 Express+TypeScript+内存存储，4 模块（auth/article/comment/common），REST API 3 接口。关键决策：评论模块独立存储降低耦合。遗留风险：内存存储重启数据丢失（RISK-001），性能基线待阶段 7 k6 实测。
```

> `summary` 为空或仅"通过"/"符合要求"等无信息字符串 → 视为 O3（Verifier Theater）命中，V 评审降级重做。

**summary 三要素要求**（sig-001 改进，防止模板化）：
1. **≥1 关键决策摘要**：本阶段产出的核心决策（如「采用 RBAC 权限模型」）
2. **1-2 句产物核心结构**：产出的关键结构（如「22 SD + 22 INTF + 75 DD，TLA+ 22 规格」）
3. **遗留风险**：未解决的问题或后续需关注的风险（如「L4 audit_log_retention 不变式需运行时验证」）

**禁止措辞**：「评审通过」「质量良好」「符合要求」等空泛表述。summary 长度须 ≥ 50 字符（R11 校验）。

**evidence 格式规范**（冒号分隔）：evidence 字段每条须含 `<文件路径>:<定位>=<值>` 格式，定位为 `§section` 或 `L行号`。
- 合法示例：`docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全` / `src/auth.ts:L42-58=JWT 签发逻辑`
- 非法示例：`coverage.json.matrices.stakeholder.coverage=100%`（点号格式，已废弃）/ `C1-C10 全通过` / `质量良好` / `评审通过`
- 空泛声明视为 O3（Verifier Theater）命中，V 评审降级重做
- 格式约定见 [conventions.md](conventions.md#格式约定) §2.1

### 6.2.1 evidence 字段可追溯约束

> 针对 D14 缺陷：V 子代理曾伪造 TLA+ evidence（声称 5 个不变量，实际产物有 10 个）。evidence 必须可追溯至目标产物内的具体位置，禁止编造。

`subCriteria[*].evidence` 与 `reworkHints[*]` 中引用产物时：

1. **须标注路径 + 行号**：格式如 `tla/L1_shell_agent.tla:L356-366` / `docs/phase2-design/{module}-system-design.md:§3.2` / `src/auth.ts:42-58`。路径相对项目根目录。
2. **不得仅引用产物名不标注行号**：如仅写 `system-design.md` 或 `L1_shell_agent.tla` 视为 evidence 失效，该子标准判 0 分（§3.3 / §11.4）。
3. **引用须真实存在**：行号 / 段落 ID 必须能在目标产物中定位到对应内容；编造不存在的引用（如声称「5 个不变量」但实际产物有 10 个）→ 视为 Verifier Theater（O3），V 评审降级重做。
4. **跨阶段 evidence 一致性**：后阶段 V 评审的 evidence 不得否定前阶段已放行项的 evidence（详见 §12）。

### 6.3 通过判定

`passed = (qualityLevel === 'A' || qualityLevel === 'B') && 所有 subCriterion.score >= 0.70`。

（即综合分数 ≥ 0.70 视为通过阶段门，**且**每个子标准得分 ≥ 0.70——单轴下限 R13。）

> **单轴下限（R13）说明**：`qualityLevel` 仍由 `compositeScore` 加权平均按 §6.1 映射，
> 但 `passed` 判定额外要求每个子标准 ≥ 0.70（B 级分界）。理由：
> 5 子标准加权平均下，某子标准失败（如 completeness=0.65）可被其余高分拉过 0.70 线；
> 该维度根本性不达标时不得用其它维度补偿（对应外部 code-review 双轴报告永不合并原则）。
> 违反判定 → 命中反模式 #41「加权平均掩盖单轴失败」，`check-verifier-output.ts` 判失败。
> 任一子标准低于 0.70 时 `passed=false`，`reworkHints` 必须非空（§7.8 强制）。

## 7. 子标准定义

### 7.1 需求（targetKind = `requirement`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `completeness` | 0.30 | 功能 / 非功能 / 约束需求是否齐全；缺失项是否标注。**四维识别增强**：须额外核验①§4 层级树覆盖所有 REQ（每个 REQ 出现且 level 必填）；②§5 REQ-group 覆盖所有 level=1 REQ（至少 1 个 group）；③§6 四类交叉逻辑矩阵（depends-on/precedes/conflicts-with/cross-cuts）无遗漏，无内容时填「无」并加说明；④§7 四张覆盖矩阵（stakeholder/业务场景/需求类型/NFR-CON 横切）完整且每维度覆盖率 100%。覆盖缺失项须经豁免审批（FM-4D-01~05），不得隐式遗漏。 |
| `clarity` | 0.25 | 表述是否无歧义；输入输出边界是否明确 |
| `consistency` | 0.20 | 需求之间是否冲突；术语是否前后一致；conflicts-with 边是否均有处置 |
| `testability` | 0.15 | 验收标准是否可测试；是否可观测可量化 |
| `traceability` | 0.10 | 是否能映射到业务目标；RTM 是否可登记 |

权重和 = 1.00。

> **completeness 四维核验对照**：V 子代理评审 `targetKind=requirement` 时，须在 `evidence` 中引用需求规格 §4-§7 的具体位置作为四维覆盖证据。任一维度缺失（如 §6 某矩阵只写「无」未加说明，或 §7.5 覆盖率 < 100% 且无豁免审批）→ `completeness` 判 0 分。四维核验命中 FM-3D-01~06 / FM-4D-01~05 / FM-EXEMPT-01~05 任一失败模式 → `passed=false`。
>
> - 归档完整性缺失 → completeness 判 0 分
> - 签名链断裂 → completeness 判 0 分
> - 阶段 1 需求规格结构完整性：
>   - 主规格 §13/§14/§15/§16/§17/附录 A 引用块指向的 6 个独立文件（system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）均存在且内容非空
>   - traceability-matrix.md 字段与主规格 §4 层级树 / §7 覆盖矩阵 / §12 RTM 一致（对应 R7 门禁）
>   - uml-modeling.md mermaid 三图配平且与主规格 §3/§4 对应（对应 R8 门禁）
>   - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
> - 阶段 2 系统设计结构完整性：
>   - 主文档 §1/§6/§7/§8/§9/附录 A 引用块指向的 6 个独立文件（system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）均存在且内容非空
>   - traceability-matrix.md 字段与主文档 §3 模块划分 / phase1 追踪矩阵一致（对应 R9 门禁）
>   - uml-modeling.md mermaid 四图配平且与主文档 §1/§3 对应（对应 R10 门禁）
>   - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
>   - 未越过阶段边界落接口契约/类定义（FM-SD-06 检测）
> - 阶段 3 概要设计结构完整性：
>   - 主文档 §2/§4/§5/§6/§7/附录 A 引用块指向的 6 个独立文件（interface-contract / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）均存在且内容非空
>   - traceability-matrix.md 字段与主文档 §2 接口定义 / phase2 追踪矩阵一致（对应 R11 门禁）
>   - uml-modeling.md mermaid 三图配平且与主文档 §1/§2 对应（对应 R12 门禁）
>   - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
>   - 未越过阶段边界落类/方法级实现（FM-OD-06 检测）
- 阶段 4 详细设计结构完整性：
  - 主文档 §1/§2/§4/§5/§6/§7 引用块指向的 6 个独立文件（class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）均存在且内容非空
  - traceability-matrix.md 字段与主文档 §1/§2 / phase3 追踪矩阵一致（对应 R13 门禁）
  - class-design.md + data-model.md mermaid 块配平且与主文档 §1/§2 对应（对应 R14 门禁）
  - discipline-dod.md DoD 清单 ≥ 8 项且已勾选核对
  - 未越过阶段边界回溯重定义接口契约/落编码实现（FM-DD-06 检测）

### 7.2 设计（targetKind = `design`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `architecture-soundness` | 0.25 | 架构是否合理；分层 / 模块边界是否清晰 |
| `requirement-coverage` | 0.25 | 是否覆盖所有相关需求；RTM 设计列是否可登记 |
| `interface-consistency` | 0.20 | 接口定义是否一致；上下游是否对齐 |
| `feasibility` | 0.15 | 技术选型是否可行；是否存在不可实现项 |
| `testability` | 0.15 | 是否可设计对应测试用例（系统 / 集成 / 单元） |

权重和 = 1.00。

**TLA+ 审查参考清单**：评审 `targetKind=design` 且产物为 TLA+ 规格（.tla/.cfg）时，V-tla 子代理须额外参考 [tla-plus.md](./tla-plus.md) 的 7 项清单。该清单与上述 5 维度的映射见 review-checklist 文档「与 verifier-spec.md 5 维度的映射」节。不新增 targetKind 枚举值（仍为 `design`）。

- **备选方案对比检查**：设计文档是否含关键接口/类的 ≥2 个备选方案对比？无对比的"一次做对"设计 → feasibility 降分。
- **复杂性下沉提问（APoSD ch8）**：暴露的配置参数/异常是否"用户能比我们确定更好的值"？把决策负担推给用户 = 降分。
- **概念完整性提问（APoSD ch21）**：最重要的概念是否被突出/中心化（决定周围结构）？"认为太多重要"= 浅类之源，"漏认重要"= 未知的未知之源。

### 7.3 测试（targetKind = `test`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `coverage` | 0.30 | 是否覆盖对应需求 / 设计点；是否含正例与反例 |
| `correctness` | 0.25 | 预期输出是否正确；步骤是否可复现 |
| `independence` | 0.20 | 用例之间是否独立；是否避免耦合依赖 |
| `clarity` | 0.15 | 步骤描述是否清晰；输入输出是否明确 |
| `priority-reasonableness` | 0.10 | 优先级标注是否合理 |

权重和 = 1.00。

> BDD features 评审额外参考 [bdd.md](bdd.md)（7 项清单）。
> 不新增 targetKind 枚举值，BDD features 评审用 `targetKind=test` + 附加清单（仿 TLA+ 用 `design` + `tla-plus.md`）。

### 7.4 代码（targetKind = `code`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `correctness` | 0.30 | 逻辑是否正确；是否符合需求 / 设计意图 |
| `security` | 0.20 | 是否存在注入 / 越权 / 敏感信息泄漏等高危项 |
| `readability` | 0.15 | 命名 / 注释 / 结构是否易读 |
| `maintainability` | 0.15 | 是否易于扩展 / 修改；耦合是否合理 |
| `conformance` | 0.20 | 是否符合代码规范（ESLint / Prettier / 语言等价工具） |

权重和 = 1.00。

- **三信息来源检查**：评审时对目标代码依次问：① 抽象是否减少信息量（深接口掩盖实现细节）？② 是否复用约定/已有知识（相似事物相似处理）？③ 好名称/注释是否补充信息（而非复述）？三来源皆弱 → readability 降分。
- **复杂三症状提问（APoSD ch2）**：评审顶层提问"这份代码的复杂性来自哪个症状"——变更放大 / 认知负荷 / 未知的未知（对照 coding-quality「代码坏味道清单」组 X）。

### 7.4A 五轴评审维度与 Severity 标签（吸收自 addyosmani/agent-skills）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `code-review-and-quality` 技能的五轴评审与 Severity 标签模式。
> 本节**不改变** §7.4 的子标准 name 与 weight（避免破坏 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 的校验），只规定：
> 1. 评审 `targetKind=code` 时，发现项按五轴组织；
> 2. `reworkHints` 每条建议前缀 Severity 标签；
> 3. 结构性问题必须配 Structural Remedy。

#### 7.4A.1 五轴与子标准映射

`targetKind=code` 的 5 个子标准（§7.4）与 addyosmani 五轴的映射：

| 五轴 | 对应子标准 (§7.4) | 评审重点 |
|---|---|---|
| Correctness（正确性） | `correctness` (0.30) | 逻辑是否符合需求 / 设计；边界条件；错误路径；off-by-one；竞态 |
| Readability（可读性） | `readability` (0.15) | 命名；控制流；组织；「clever」技巧；注释必要性；dead code |
| Architecture（架构） | `maintainability` (0.15) | 模块边界；依赖方向；抽象层次；特性逻辑泄漏；类型边界显式性 |
| Security（安全） | `security` (0.20) | 输入校验；密钥管理；鉴权；SQL 参数化；XSS；依赖来源 |
| Performance（性能） | `conformance` (0.20) | N+1 查询；无界循环；同步阻塞；UI 重渲染；分页缺失；热路径大对象 |

> 注：Performance 轴映射到 `conformance` 是 W 模型适配——`conformance` 原指「符合代码规范」，扩展为「符合性能与规范双约束」。若项目有独立性能子标准，可在 [phase-7-system-test.md](phase-7-system-test.md) 单独评审（k6 性能基线）。

- **来源时效/权威性校验**：评审中引用的依据/参考来源（规范文档、需求行、外部资料）须校验时效性与权威性——过期来源（如 2020 博客 vs 2025 政策）与冲突来源须显式标注；知识缺口（无来源支撑的断言）须记录为证据缺失。落点：R3 preventive review 的 reliability 维度检查项。
- **最小权限与数据暴露最小化**：子代理简报/评审输入不得包含任务无关的凭据、密钥、敏感上下文；权限授予遵循最小权限原则（agent 只获得任务所需最小权限）。落点：R3 preventive review 的 security 维度检查项。
- **prompt 注入防护提示**：对子代理输入（外部资料/用户内容拼入提示词时）做注入风险标注；不构建完整守卫体系，仅作为 R3 security 提示项。
- **8 类重新设计原因检查**：逐条问"当前设计是否因 ① 显式指定类 ② 依赖特定操作 ③ 平台依赖 ④ 依赖对象表示/实现 ⑤ 算法依赖 ⑥ 紧耦合 ⑦ 子类化扩展爆炸 ⑧ 无法方便改类 而被迫重构"，命中即要求补对应模式的权衡声明（对照 coding-quality「设计模式目录」「8 类原因→模式」表）。
- **"哪个类层次最常变化"（GoF Visitor 判据）**：结构稳定而操作多变用 Visitor，反之用其他——评审问"设计声称封装的变化点是否与最常变化的层次一致"。
- **接口交集 vs 并集**（GoF ch2）：抽象接口取功能交集则只强如最弱实现，取并集则庞大且漂移——评审问"此抽象接口取交集还是并集、为何"。
- **网关/编排层职责是否轻量**（凤凰架构 service-routing）：网关=路由器+过滤器；过度增加网关职责是危险的——与编排者最小化同构，评审问"中间层是否承载了过多业务职责"。
- **认证方案检查**：认证三层（信道 TLS / 协议 HTTP 认证框架 / 内容 Web 表单/WebAuthn）；OAuth2 四模式适配（授权码最严谨/隐式无服务端/密码仅限高度可信/客户端用于服务间）。
- **授权模型检查**：RBAC96（角色/许可/资源建模、最小特权、角色继承与互斥）；最小特权 + 职责分离。
- **凭证管理检查**：Cookie-Session（服务端状态，集群遇 CAP 三难）vs JWT（客户端状态、防篡改不防泄漏、难以主动失效）；密码存储 = 慢哈希（BCrypt）+ 每用户随机盐 + 服务端二次哈希。
- **传输安全检查**：HTTPS 为唯一可行传输方案；mTLS 用于服务间认证；零信任五特征（身份只来源于服务/服务间无默认信任/集中策略实施点/软件供应链/强隔离）。

#### 7.4A.2 Severity 标签

`reworkHints` 数组每条建议**必须**以下列前缀之一开头，便于返工优先级排序：

| 前缀 | 含义 | 作者动作 |
|---|---|---|
| `Critical:` | 阻断合并 | 安全漏洞 / 数据丢失 / 功能破坏；必须修复才能放行 |
| `Required:` | 必修变更 | 合并前必须处理 |
| `Optional:` / `Consider:` | 建议 | 值得考虑但非必须 |
| `Nit:` | 小事可选 | 作者可忽略——格式 / 风格偏好 |
| `FYI:` | 仅供参考 | 无需动作——未来参考上下文 |
| （无前缀） | 默认 Required | 按 Required 处理 |

示例：

```json
"reworkHints": [
  "Critical: SQL 拼接导致注入风险（src/store/user.ts:42），改用参数化查询",
  "Required: 缺少 JWT 过期分支测试（src/utils/jwt.ts:18-25），补 UT-031B",
  "Nit: 命名 `data` 过于宽泛（src/services/article.ts:67），建议改为 `articleInput`",
  "FYI: 此模式与 w-model-dev-demo 的 async-handler 包装一致，可作为参考"
]
```

> Severity 标签是字符串前缀约定，**不改变** §6 Schema 的 `reworkHints: string[]` 类型；[`check-verifier-output.ts`](../scripts/cli/check-verifier-output.ts) 不强制校验前缀（避免误判历史 JSON），由 Agent 自检与 LLM-as-a-Verifier 在 `summary` 中标注「Severity 标签缺失」。

#### 7.4A.3 Structural Remedies

对结构性问题，`reworkHints` **必须**提出命名修复方案，而非只指出问题。可用的命名修复（吸收自 addyosmani）：

| 命名修复 | 适用场景 |
|---|---|
| Replace a chain of conditionals with a typed model or dispatcher | 条件链重复判断同一 shape |
| Collapse duplicate branches into a single clearer flow | 重复分支 |
| Separate orchestration from business logic | 编排与业务逻辑纠缠 |
| Move feature-specific logic out of shared module | 特性逻辑泄漏到共享模块 |
| Reuse the canonical helper instead of a near-duplicate | 重复实现近似 helper |
| Make a type boundary explicit so downstream branching disappears | `any` / `unknown` / silent fallback 掩盖不变量 |
| Delete a pass-through wrapper that adds indirection | 透传包装增加间接层无收益 |
| Extract a helper, or split a large file into focused modules | 单文件过大（>1000 行） |

示例：

```json
"reworkHints": [
  "Required: auth-routes.ts 内 4 处 if (role === 'admin') 条件链重复判断同一 shape，Structural Remedy: Replace a chain of conditionals with a typed model——提取 RolePermission 表，按 role 查表分发"
]
```

> 仅指出「这里复杂」而不给修复方向，会让作者猜测；命名修复让作者直接看到重构路径。

#### 7.4A.4 与 addyosmani/agent-skills 的差异

- addyosmani 的五轴是**完整评审维度**，每轴独立打分。
- 本规范的五轴是**发现项组织方式**——子标准仍是 §7.4 的 5 个（`correctness` / `security` / `readability` / `maintainability` / `conformance`），五轴用于在 `reworkHints` 中归类发现项。
- 这样既吸收了五轴评审的结构化思维，又不破坏 [`verifier-logic.ts`](../scripts/logic/verifier-logic.ts) 对子标准 name/weight 的校验。
- Performance 轴在 W 模型中通常由阶段 7 系统测试（含 k6 性能基线）独立验证，`code` 评审中只标注明显性能反模式（N+1 / 无界循环），不做完整性能评审。

### 7.5 根因报告（targetKind = `rootcause`）

> V 复审 R 子代理产出的 RootCauseReport 时使用。对应 spec §5.2（`docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md`） V 复审根因报告分派模板。
> V 复审仍输出 VerifierOutput JSON（§6 Schema），`meta.targetKind='rootcause'`，`meta.target` 为 R 报告 `reportId`（如 `RC-phase5-1-01`）。

| 子标准 name | weight | 描述 |
|---|---|---|
| `correctness` | 0.25 | 根因链是否逻辑自洽？每步 `evidence` 是否支持该步 `answer`？根因分类（`rootCause.category`）是否准确？ |
| `completeness` | 0.25 | 是否触及根本原因而非停在现象？`rootCauseChain` 是否充分追溯（2-5 步）？`upstreamDefect` 是否被正确检测或排除？ |
| `falsifiability` | 0.20 | `rootCause.falsifiabilityCheck` 是否含「若...则」可验证假设？假设是否真的可证伪（非泛化描述）？ |
| `actionability` | 0.15 | `fixRecommendation` 是否针对根因且可执行？每条是否含 `target`/`location`/`action`/`rationale` 四字段？`rationale` 是否说明「为何这样修复能消除根因」？ |
| `prevention` | 0.15 | `prevention` 是否可落实？每条是否含 `scope`/`measure`/`owner` 三字段？措施是否具体（非「加强评审」泛化建议）？ |

权重和 = 1.00。

**rootcause 子标准与五轴评审的关系**：

rootcause 复审不使用 §7.4A 的五轴（Correctness / Readability / Architecture / Security / Performance），而是使用上述 5 个根因诊断专用维度。两者映射关系：

| rootcause 子标准 | 对应 §7.4A 五轴（参考） | 说明 |
|---|---|---|
| `correctness` | Correctness | 根因链逻辑正确性（类比代码逻辑正确性） |
| `completeness` | —（无直接对应） | 根因追溯完整性（根因诊断专属维度） |
| `falsifiability` | —（无直接对应） | 可证伪假设（根因诊断专属维度，防幻想根因） |
| `actionability` | Architecture | 修复建议的结构性（类比架构修复方向） |
| `prevention` | Conformance | 预防措施落实（类比规范符合性） |

**Severity 标签适配**：

rootcause 复审的 `reworkHints` 仍使用 §7.4A.2 的 Severity 标签前缀（`Critical:` / `Required:` / `Optional:` / `Nit:` / `FYI:`）。`reworkHints` 含 `[Critical]`/`[Required]` 时表示根因报告不准确，须重派 R（见 spec §6.3 场景 2）。

**多角度复审**：

根因报告 V 复审为**强制多角度**场景（spec §9.11）：V-lead 须加载 N 个 V-persona（规范 `testing-reality-checker` + `engineering-incident-response-commander` + `testing-evidence-collector`，详见 [agent-personas.md](agent-personas.md) §3）从多角度复审，并行或串行分派均可。`testing-reality-checker` 是 R10 的 canonical persona，confidence >= 0.5；已有合法归档中的 `reality-checker` 仅在 canonical 缺失时作为 legacy fallback。两者同时出现时 canonical 优先，同 artifact 不增加 persona 计数；跨 artifact 或异常重复/冲突由 R10 fail-closed。V-lead 聚合规则见 spec §9.7。

<r10-contract id="canonical-name" relation='{"canonicalPersona":"testing-reality-checker"}'>canonical persona is testing-reality-checker</r10-contract>
<r10-contract id="threshold" relation='{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}'>testing-reality-checker confidence >= 0.5</r10-contract>
<r10-contract id="legacy-fallback" relation='{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}'>legacy reality-checker is fallback only when canonical is absent</r10-contract>
<r10-contract id="same-artifact-dedupe" relation='{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}'>same artifact canonical-first and not counted twice</r10-contract>
<r10-contract id="cross-artifact-conflict" relation='{"artifactRelation":"different","conflict":"fail-closed"}'>different artifact conflict is fail-closed</r10-contract>
<r10-contract id="canonical-duplicate" relation='{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>canonical > 1 duplicate is fail-closed</r10-contract>
<r10-contract id="legacy-duplicate" relation='{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>legacy > 1 duplicate is fail-closed</r10-contract>

V-lead 聚合规则见 spec §9.7。

## 8. 评审提示词模板

外部 Agent 执行评审时，按以下模板构造提示词（替换 `{{}}` 占位符）。

### 8.0 占位符列表

所有提示词模板共享以下占位符，Agent 在构造提示词前必须先准备好这些值：

| 占位符 | 来源 / 取值约束 | 示例 |
|---|---|---|
| `{{repeatTimes}}` | 由 Agent 配置，整数 ≥3（spec §3.2 默认 `3`）；与输出 JSON `meta.repeatTimes` 一致 | `3` |
| `{{scoringMethod}}` | Agent 选择，`logits` 或 `text-parse`（spec §4 / §6）；与输出 JSON `meta.scoringMethod` 一致 | `logits` |
| `{{targetKind}}` | 评审目标类型，`requirement` / `design` / `code` / `test` / `rootcause`（spec §2 / §7）；与输出 JSON `meta.targetKind` 一致 | `requirement` |
| `{{target}}` | 目标 ID（前缀见 §2）或文件路径；与输出 JSON `meta.target` 一致 | `REQ-001` |
| `{{targetContent}}` | 目标的完整文本内容（需求规格 / 设计文档 / 测试用例 / 代码片段），由 Agent 从项目工件中读取后整体填入 | （省略） |
| `{{subSection}}` | §7 中对应 `targetKind` 的子节号（1-5）；用于让模型按正确子标准集合评估 | `1`（对应 §7.1 需求） |
| `{{k}}` | PPT 锦标赛规模，整数 ∈ [2, 1000]（spec §5.1 默认 `5`）；与输出 JSON `ranking.k` 一致 | `5` |
| `{{temperature}}` | PPT 软比较温度，正数 ≤ 100（spec §5.1 默认 `4.0`）；与输出 JSON `ranking.temperature` 一致 | `4.0` |
| `{{candidates}}` | 候选目标列表，每行 `ID<TAB>综合分数`，由 Agent 收集所有候选的 `compositeScore` 后填充 | （省略） |

> 占位符取值必须与输出 JSON 的对应字段保持一致，否则 [`check-verifier-output.ts`](../scripts/cli/check-verifier-output.ts) 会以「字段不一致」为由判失败。

### 8.1 系统提示词（System Prompt）

```
你是一名严格的 LLM-as-a-Verifier，对 W 模型开发流程中的阶段产物做质量评审。
你必须遵守以下规则：

1. 不得给出单一整体打分；必须按规范定义的子标准逐项打分。
2. 每个子标准分数取值 [0.0, 1.0]，保留 4 位小数。
3. 每个子标准必须引用目标内的具体片段作为 evidence（行号 / 段落 ID / 字段名）。
4. 同一目标需独立重复评估 {{repeatTimes}} 次，每次使用不同随机种子。
5. 最终输出必须是严格符合 VerifierOutput Schema 的 JSON，禁止任何额外文本。
6. 评分方法：{{scoringMethod}}
   - logits：在末尾追加字母题 A/B/C/D，取 logits 做 log-softmax 后加权得连续分数
   - text-parse：在末尾追加字母题 A/B/C/D，解析首个字母并加 ±0.05 稳定扰动
7. 子标准集合见 w-model-dev/references/verifier-spec.md §7，权重不得改动。

Schema 参见 w-model-dev/references/verifier-spec.md §6。
```

### 8.2 用户提示词（User Prompt）

```
评审目标类型: {{targetKind}}
目标 ID / 路径: {{target}}
目标内容:
<<<
{{targetContent}}
>>>

请按 verifier-spec.md §7.{{subSection}} 的子标准集合逐项评估，重复 {{repeatTimes}} 次。
输出严格符合 VerifierOutput Schema 的 JSON。
```

### 8.3 多候选排序提示词

```
以下为 N 个候选目标，每个目标已有综合分数。请按 PPT 算法（k={{k}}, temperature={{temperature}}）
排出优先级，输出 ranking 字段。算法细节见 verifier-spec.md §5。
候选列表:
{{candidates}}
```

## 9. 与外部技能演化工具的关系

本规范只覆盖「阶段产物校验流程」，是 W 模型技能**内部**的产物质量保障。

技能**演化**（即根据评审结果迭代技能本身的提示词 / 模板 / 子标准）由外部工具完成：

- **SkillOpt**（微软）：https://github.com/microsoft/SkillOpt
  - 提供 Rollout → Reflect → Edit → Gate → Commit 训练循环
- **darwin-skill**：https://github.com/alchaincyf/darwin-skill
  - 提供基于进化算法的技能搜索与筛选

外部演化工具可消费本规范产出的 `VerifierOutput` JSON 作为训练信号，
但本技能本身不包含任何演化逻辑、轨迹分析、Rollout 记录等内容。

## 10. 校验脚本调用

外部 Agent 完成 LLM-as-a-Verifier 评审并写出 JSON 后，必须立即调用校验脚本：

```bash
# 校验输出 JSON 是否符合 §6 Schema、子标准是否齐全、方差是否达标等
# 退出码 0=通过 / 1=校验失败 / 2=输入错误
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <output.json>
```

校验未通过即视为评审无效，Agent 必须按脚本输出的 `reasons` 重新执行评审。

## 11. 异常处理与降级策略（边界条件）

> 评审执行中常见异常的检测与处理。Agent 须按以下策略处理，**禁止因异常而跳过评审或放行**。

### 11.1 LLM 调用失败重试策略

| 失败类型 | 检测信号 | 重试策略 | 重试上限 |
|---|---|---|---|
| 网络超时 / API 5xx | HTTP 状态码 ≠ 2xx / 请求超时 | 指数退避：1s → 2s → 4s → 8s → 16s | 5 次 |
| 限流（429） | `Retry-After` 响应头 | 按 `Retry-After` 等待后重试 | 3 次 |
| 响应非 JSON / 解析失败 | `JSON.parse` 抛异常 | 重新构造提示词，追加「必须输出严格 JSON」约束后重试 | 3 次 |
| 响应截断（max_tokens） | `finish_reason='length'` | 提升 `max_tokens` 至 2 倍后重试；仍失败则拆分子标准分批评估 | 2 次 |
| 子标准缺失 | `subCriteria` 数量 < §7 定义数 | 在提示词中显式列出缺失子标准 name 后重试 | 2 次 |

重试失败处理：所有重试用尽后仍失败 → 该目标 `passed=false`，`reworkHints=['LLM 评审不可用，须人工评审或更换模型']`；普通失败先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再按 R 结论返工。

### 11.2 logits 不可用 → text-parse 降级

| 检测信号 | 降级动作 | 输出标注 |
|---|---|---|
| LLM API 不返回 logits（仅返回 text） | 改用 §4.2 text-parse 实现：解析首个字母 A-D + `±0.05` 稳定扰动 | `meta.scoringMethod = 'text-parse'` |
| logits 返回但 A/B/C/D token 缺失 | 同上降级 | 同上 |
| text-parse 解析失败（输出无 A-D 字母） | 在提示词追加「仅输出一个字母」后重试 1 次；仍失败则该子标准 `score=0` | `meta.scoringMethod = 'text-parse'`，`evidence` 标注「解析失败」 |

> 降级后必须更新 `meta.scoringMethod`，否则 `check-verifier-output.ts` 校验失败。

### 11.3 方差超阈值处理

当 `subCriteria[i].variance > meta.varianceThreshold`（默认 0.10）时：

1. **检测**：`check-verifier-output.ts` 重算方差并对比，误差 > `1e-6`（§3.2.1 规则 2）或方差超阈值 → 退出码 1。
2. **重评**：对该子标准增加 `repeatTimes` 至 5 次（默认 3 次基础上 +2），使用更强温度扰动（如 0.7 → 0.9）。
3. **离群值剔除**：若 `rawScores` 中存在明显离群值（与中位数偏差 > 2×MAD），剔除后重算均值与方差。
4. **仍超阈值**：判定该子标准不可重复 → `passed=false`，`reworkHints` 标注「子标准 `<name>` 不可重复，须人工评审」。
5. **防作弊**：`check-verifier-output.ts` 检测 `rawScores` 全相同（方差=0）且 `repeatTimes≥3` → 视为复制填入，判失败。

### 11.4 evidence 引用失效处理

| 失效类型 | 检测信号 | 处理 |
|---|---|---|
| 引用行号超出目标范围 | `evidence` 含「L123」但目标仅 100 行 | 该子标准 `score=0`，`evidence` 标注「引用失效」 |
| 引用段落 ID 不存在 | `evidence` 含 `§3.5` 但目标无该节 | 同上 |
| 目标内容已变更（评审期间被修改） | `evidence` 引用片段与目标当前内容不匹配 | 重新读取目标最新版本后重评；若仍不匹配则 `passed=false` |
| evidence 为空字符串 | `evidence === ''` | 子标准判 0 分（§3.3 已规定） |

> evidence 失效一律不得放行；`check-verifier-output.ts` 校验 evidence 非空，但行号/段落有效性须由 Agent 自检。

### 11.5 异常处理流程总览

```
LLM 调用 → 失败？─是─► §11.1 重试策略（≤5 次指数退避）
              │否
              ▼
          返回 logits？─否─► §11.2 降级 text-parse
              │是
              ▼
          重算方差超阈值？─是─► §11.3 重评 + 离群剔除
              │否
              ▼
          evidence 失效？─是─► §11.4 子标准判 0 分或重评
              │否
              ▼
          输出 VerifierOutput JSON → check-verifier-output.ts 校验
```

## 12. 跨阶段 evidence 一致性

> 针对 D15 缺陷：phase2 与 phase3 的 V 评审 evidence 互相矛盾，但两者均被放行。本节规定跨阶段 evidence 一致性约束，由编排者在分派 V 子代理时传递前阶段已放行 evidence 清单强制执行。

### 12.1 一致性约束

1. **不得矛盾**：后阶段 V 评审的 evidence 不得与前阶段已放行项的 evidence 矛盾。例如：阶段 2 V 评审 evidence 标注「系统设计含 4 模块」，阶段 3 V 评审 evidence 不得标注「系统设计含 5 模块」且两者均放行。
2. **矛盾处理**：若后阶段 V 评审发现与前阶段 evidence 矛盾，须将该矛盾点标注为 `reworkHint`（前缀 `Critical:`，参考 §7.4A.2 Severity 标签），并回溯修正前阶段产物与前阶段 V 评审 JSON；不得仅在后阶段标注后放行。
3. **跨阶段方差阈值一致**：全项目 `meta.varianceThreshold` 须统一（`0.05` 或 `0.10`），不得阶段间取不同值。编排者在分派 V 子代理时须传递统一阈值。
   > `check-verifier-output.ts` 不强制跨阶段一致性（脚本只校验单 JSON 内部），跨阶段一致性由编排者按本节约束保证。

### 12.2 编排者职责

编排者（O）在分派阶段 N 的 V 子代理时，须：

1. 将阶段 1 ~ N-1 所有已放行项的 `evidence` 汇总为「前阶段 evidence 清单」，注入 V 子代理上下文。
2. 要求 V 子代理在 `summary` 中声明「已对照前阶段 evidence，无矛盾」或「发现矛盾 N 处，已标注 reworkHint」。
3. 若 V 子代理声明存在矛盾，编排者须回溯触发对应前阶段的返工流程，不得直接放行阶段 N。

## 13. self-as-verifier 模式

> V 评审产出独立性要求。**启用条件（同 SKILL.md）：仅限 demo / 非生产 / 教学演示项目，生产项目禁止**；启用时 `project.status` 须标记 `selfAsVerifier: true`。

### V 评审产出独立性

self-as-verifier 模式下（单 Agent 兼任 S/V/G/R），V 评审产出须满足独立性要求：

1. **VerifierOutput JSON 须独立产出**：文件路径不得与 S 产出文件路径相同
   - 合规：`S 产出 = docs/phase1-requirements/requirements-spec.md`，`V 产出 = .w-model/verifier-outputs/1-requirements.json`
   - 违规：`S 产出 = docs/phase1-requirements/requirements-spec.md`，`V 产出 = docs/phase1-requirements/requirements-spec.md`（同路径）
2. **VerifierOutput 内容须独立**：不得在 S 产出文档中直接嵌入评审结论；评审结论须以独立 JSON 结构产出（按 §6 Schema）
3. **run-log 记录独立**：V 评审须有独立 run-log 条目（即使 `runId` 与 S 相同，`role` 字段须明确标记 V）
4. **评审视角独立（偏置缓解）**：V 评审须选用与 S 产出视角**不同的 Persona 提示词**运行（按 `targetKind` 从 [agent-personas.md](agent-personas.md) 4 个评审 Persona 或 `subagent/` 人格库选用），并在 VerifierOutput `summary` 中注明所用 Persona 名称；不得以 S 产出者视角重复评审自身产出。该模式不消除自我偏置，仅将其限制在 demo / 教学范围。

### 校验

`check-verifier-output.ts --self-as-verifier --s-output=<path>` 校验 VerifierOutput JSON 路径与 S 产出路径不同。违反命中反模式 #35。

## 14. 评审偏移检测（标准 / 校准 / 惰性）

> **编号说明**：本节 R9 属 `run-log-logic.ts` 命名空间，R18 属 `verifier-logic.ts` 命名空间；
> 与 §7 的 R11-R17（评审附加检查项）、以及各阶段设计文档门禁里同号的 R11-R14 是**不同命名空间**，勿混。
> 阈值与最少数据点均为**代码常量**（权威为实现），本节不复制数值。

V 评审的失效不只是"评错"，还包括"评审者漂移"。三类偏移各有对应判据：

### 14.1 标准偏移（R9 跨轮次评审不一致）

**判据**（`run-log-logic.ts`）：同一产物在不同轮次被 review 判出差异显著的 `qualityLevel`
（档差 ≥ `REVIEW_LEVEL_SPREAD`，按 A>B>C>D 计），即评审标准发生实质漂移。
1 档差异可能合理（产物确实改进了），跨越多档不是。

- **数据基础已具备**：run-log 既有 `qualityLevel` 与 `artifacts` 字段，无需新字段。
- **首次评审豁免**：仅一次评审无"不一致"可言（`REVIEW_LEVEL_MIN_POINTS`）；按产物聚合，四条记录只报一次。
- **处置刻意不同于 R6（冰山三视角不一致）**：此处不一致的是**评审者自身**，而 R 无法自查评审标准。
  故按 [design-philosophy.md](design-philosophy.md) 的人机分工线，走高成熟度 **CHECKPOINT 交人裁定，不走 R**。
  这与"产物之间的客观差异"必须区分：后者才走普通 V/G 失败链由 R 定位。

### 14.2 校准偏移（R18 分辨力下限）

**判据**（`verifier-logic.ts`）：某子标准 `rawScores` 的方差低于 `RESOLUTION_FLOOR`**且非全等**，
即评分分布坍缩——V 打了分但没有区分正负样本的能力。

- **与既有"全等检测"互补、不重复**：主循环的防漂移规则检 `max === min`（完全相等 = 复制填入作弊）；
  R18 检**非全等但方差极小**。全等是"没打分"，方差坍缩是"打了分但没分辨力"。故 `max === min` 时 R18 跳过。
- 少于 `RESOLUTION_MIN_POINTS` 个数据点不足以判定坍缩。
- **论文依据**：粒度上升 → 正负样本分离 SNR 上升（Table 1：`G=1 → 0.775`、`G=20 → 0.799`）；
  标准 judge 在 100 次重复中 **88 次产生平局**。分辨力不足是真实且可测量的失效模式，不是理论担忧。
- 与 R13 同形态接入 `reasons`，不改变 `passed` 判定公式本身（任何 `reasons` 即 `passed=false`）。
- **阈值取值的教训**：初版按设计直觉取 `1e-4`，实测会命中 **100% 的合法 V 产物**
  （仓库内合法 fixture 的实测方差一律 `6.67e-5`，高于 `1e-4`）——即"计划里的代码片段只是意图草图"的实例。
  现取值的依据是对仓库 fixture 实测重算，两侧各留约两个数量级余量，而非设计期估算。

### 14.3 惰性偏移（R11/R12/O3 加强）

既有判据已覆盖"评审敷衍"：`summary` 空泛（R11）、`evidence` 为纯描述无具体引用（R12）、
以及运维侧的 O3。本节不新增规则，仅在 14.1/14.2 落地后明确：**惰性与漂移是两类失效**，
前者是"没认真评"，后者是"评了但不一致/无分辨力"，三者的修复路径不同（惰性 → 重评；
标准偏移 → 人裁定；校准偏移 → 校准评审方法）。

### 14.4 校准集是**非门禁**（重要）

本战役配套的 A-3f 校准集（用已知答案的样本反向检验 V 的判别力）**不是门禁**，不参与阶段门放行，
不产生 `exitCode`。它是**离线诊断工具**：用来观察 V 是否漂移、阈值是否需要调整。
后续维护者不得把它当作可阻断流程的检查项，也不得因它"未接入 CI"而判定其失效。

### 14.5 参数核对结论

`k=5` / `temperature=4.0` / `repeatTimes≥3` 经核对**无需改动**：与 14.2 的失效模式
（方差坍缩）正交——前者决定采样分布形状，后者是分布坍缩的信号。改动这些参数不会修复坍缩，
调整 `RESOLUTION_FLOOR` 才会。

## 15. 评审侧信任、质疑与校准契约（S07 / S08 / S09 / S16）

> 吸收自 superpowers：**不信任报告**（`skills/subagent-driven-development/task-reviewer-prompt.md` L64-71 / L84-85 / L153-157，台账 :233-265）、**对外部评审结论的合理质疑**（`skills/receiving-code-review/SKILL.md` L68-84 / L88-98 / L113-129，台账 :268-313）、**spec 自审与评审者校准**（`skills/brainstorming/SKILL.md` L211-219 与 `skills/brainstorming/spec-document-reviewer-prompt.md` L19-34，台账 :603-630）。
> 本节是**评审行为契约**：只规定 V 与 spec 评审者的判断口径，**不新增任何 Schema 字段**（S08 的质疑结论以固定前缀写入既有文本字段，先例为 §3.3 R14-R17 的 `summary` 固定前缀写入）。§15.1 / §15.2 / §15.3 / §15.4 分别对应 S07 / S08 / S16 / S09（§15.4 是 S09 的 V 侧摘要）。

### 15.1 不信任报告（S07）

**报告不是证据，产物才是。** V 评审由 S 子代理（实现者）自述过程的目标（尤其 `targetKind=code`）时，按下述四条执行：

1. **实现者报告 = 未经核实的 claim**：报告可能不完整、不准确、或过于乐观（"unverified claims about the code… may be incomplete, inaccurate, or optimistic"）。V 须**对照 diff / 产物本身**核实报告中的每条断言，不得以报告的自述结案。
2. **报告里的设计 rationale 同样是 claim，不得据此降级 severity**：「按 YAGNI 保留」「刻意保持简单」之类理由，是**实现者在给自己的作业打分**（"the implementer grading their own work"）。发现项按代码 / 产物本身的性质定级——**陈述了理由从不降低 finding 的 severity**（"a stated rationale never downgrades a finding's severity"）。理由可作 finding 的上下文，但不改变 Critical / Required / Optional 的归属（§7.4A.2）。
3. **实现者报告的测试输出里的 warning / 噪声即 finding**：测试输出应当是干净的（"test output should be pristine"）；V 在报告里看到的 warning、噪声、被忽略的输出**本身就是 finding**，不得当作背景噪声略过。报告对 warning 的沉默不是「干净」，而是漏报。
4. **plan 作者不自评自己的 plan**：当 plan / 简报**显式要求**了本规范认定为缺陷的东西（什么都不断言的空测试、逻辑块的逐字复制），**那仍然是 finding**——按 **Required** 报出并标注 `plan-mandated`（上游原文记作 Important；本规范统一用 §7.4A.2 的 `Required` 前缀，不引入表外档位）。**plan 的作者不为自己的 plan 评分，由人类裁决**（"The plan's authorship does not grade its own work; the human decides."）；W 模型中该判断由独立评审者 V 报出、最终裁决权在人。这与 `subagent-delegation.md` §3.4.1「禁止编排者预判 findings」互为两侧：O 不得在分派阶段预先压制 finding，V 不得因「计划已经这么选了」一类 rationale 将其降级。

> 边界：本节不要求 V 对报告做「有罪推定」，只要求**把报告与产物分开对待**——报告是线索，产物是证据。

### 15.2 误报质疑通道（S08）

V 的 finding 被 S / O 认为误报时，**有正规出口，但出口既不是「不报」，也不是「由 O 拍板」**。分派侧的书写规则见 `subagent-delegation.md` §3.4.5（固定前缀通道与禁预判），本节规定质疑与裁决的口径。

**质疑格式（技术性，禁情绪化）**：

```
FALSE-POSITIVE-CHALLENGE: <finding 一行摘要> — <技术理由 + 反证>
```

- **须给技术理由与反证**：引用可运行的测试 / 代码 / 规范（"Use technical reasoning, not defensiveness"、"Ask specific questions"、"Reference working tests/code"）；不得以情绪化措辞、资历或「已经改过了」代替论证。
- **无法自行核实就说出来**：不具前置条件（缺环境 / 缺上下文）时不得断言误报，须显式说明「无法在 [X] 条件下核实」（"IF can't easily verify: Say so"）。
- **与人类既有决策冲突时停下**：质疑若与用户既有架构决策冲突，先交用户讨论，不由子代理层层加码（"IF conflicts with your human partner's prior decisions: Stop and discuss with your human partner first"）。
- **YAGNI 质疑须给用法证据**：对「要实现得更正规」类 finding，先 grep 代码库确认实际使用；确认未被调用才可提出 YAGNI 质疑（"grep codebase for actual usage" / "IF unused: … Remove it (YAGNI)?"）。用户是最终裁决者——"You and reviewer both report to me"。

**裁决者 = 新的 V，不是 O**：

| 角色 | 对误报质疑的权限 |
| --- | --- |
| 质疑者（S，或 O 转述 S 的理由） | 提质疑：技术理由 + 反证 |
| **裁决者：新 V**（V-lead，或换 Persona 的另一位 V 重新评审） | 判定 finding 成立 / 不成立 |
| 编排者（O） | **只转达与记录，不得裁决** |
| 用户 | 质疑未被受理时的最终升级对象 |

- O 自行判定 finding 成立与否**命中反模式 #10（编排者越权实施）**：预支评审判断与预判 findings（`subagent-delegation.md` §3.4.1）同属越权。
- 被质疑的那位 V **不得自行改判自己的 finding**；改判须由新 V 重新评审并产出结论，避免「评审者自证」。
- 质疑结论承载走**既有文本字段的固定前缀**（`summary` / `reworkHints`），**不新增 Schema 字段**（§6 不变）。
- **质疑未受理时的升级路径 = 🔴 CHECKPOINT（交用户裁决）**：不得由 O 拍板，也不得静默丢弃。
- 质疑**不改变返工链前置**：V/G 不通过仍须先派 R 定位根因，R 报告经 V 复审 + G 门禁（`check-rootcause-report.ts` exitCode=0）后才可分派 S-fix（反模式 #18 / #19）。质疑成立与否都不构成跳过 R 的路径。

### 15.3 spec 自审与评审者校准（S16）

#### 15.3.1 作者自审四项

spec 文档（阶段 1-4 需求 / 设计类产物）写完，作者须**换一双眼睛**自查四项，并**就地修正**：

1. **占位符扫描**：`TBD` / `TODO` / 未完成章节 / 含糊需求——补齐。
2. **内部一致性**：章节之间是否互相矛盾；架构描述与特性描述是否对得上。
3. **范围检查**：是否聚焦到可由**单一**实施计划承载，还是需要拆分。
4. **歧义检查**：是否有需求可被两种方式理解——若是，**选定一种并写明**。

> 四项自查**就地修完即走**（"Fix any issues inline. No need to re-review"）：不额外生成一轮评审记录，也不新增门禁检查项。

> 与 S18 的分工：本节的占位符扫描（`TBD` / `TODO` / 未完成章节）是 **spec 类作者自审**（阶段 1-4 需求 / 设计类产物），且不新增门禁检查项；S18 是**票据类门禁**（阶段 5-8 票据内容，`check-artifact-gate.ts --tickets=<path>` 确定性校验，判据见 `command-reference.md`）——载体不同（spec 文档 vs 票据文件），不冲突。

#### 15.3.2 独立 spec reviewer 五类别

独立评审者（V 评审 `targetKind ∈ {requirement, design}` 的目标）按五类别组织发现项：

| 类别 | 看什么 |
| --- | --- |
| Completeness（完整性） | `TODO`、占位符、`TBD`、未完成章节 |
| Consistency（一致性） | 内部矛盾、互相冲突的需求 |
| Clarity（清晰度） | 需求含糊到足以让人构建出错误的东西 |
| Scope（范围） | 聚焦到单一计划可承载——不覆盖多个相互独立的子系统 |
| YAGNI | 未被请求的特性、过度设计 |

> 与 §7.4A 同构：这五类别是**发现项的组织方式**，**不是新的 subCriteria**——§7.1 / §7.2 的子标准集合与权重不变，`subCriteria` 仍固定 5 项（§2.3 与 `verifier-logic.ts` 强制）。

#### 15.3.3 calibration 阈值（散文判据）

**只报会导致实施期真实问题的问题**（"Only flag issues that would cause real problems during implementation planning"）：

- **是问题的**：缺章节、自相矛盾、歧义到可被两种方式解读的需求。
- **不是问题的**：措辞改进、风格偏好、「本节不如其它节详细」。
- **默认批准**：除非存在会导致计划走偏的**严重缺口**，否则批准（"Approve unless there are serious gaps that would lead to a flawed plan"）。

> 本小节是**散文判据**（照 §14.4「校准集是非门禁」的既有形态）：**不新增字段、不新增门禁检查项**——它约束 V 的判据口径，由 V 在输出 JSON 时自检；`check-verifier-output.ts` 不为它新增校验（形态同 §7.4A.2 对 Severity 前缀的处理）。

**与 §14.2 R18（分辨力下限）的区别——勿混淆**：两者都谈「校准」，但治的是相反方向的失效。

- **R18 治「不给分辨」**：某子标准 `rawScores` 方差坍缩（非全等但极小）＝ V 打了分却没有区分正负样本的能力，属**评分分布**问题，由 `verifier-logic.ts` 按 `RESOLUTION_FLOOR` 自动判据、随 R13 同形态进入 `reasons`。
- **本节治「过度判负」**：V 把措辞 / 风格偏好 / 详略不均当成缺陷报出，使合格 spec 被反复打回——属**判据口径**问题，靠本小节的散文判据约束，无阈值、无门禁。
- 一个是「评了但没分辨力」，另一个是「分辨了但尺子太严」：调整 R18 阈值不会改善过度判负，改 calibration 口径也不会修复方差坍缩。

#### 15.4 scoped re-review 契约（S09）

> 本节是 **V 侧摘要**：让评审者知道复审的范围与结论形状。**完整契约与分派书写规则见 `subagent-delegation.md` §3.4**（§3.4.2 范围 / §3.4.3 逐 finding 结论 / §3.4.4 Minor / §3.4.5 承载通道 / §3.4.6 R 前置），本节**不复制**其全文，避免出现两处事实源。

S-fix 之后的复审是**受范围约束的复审**（scoped re-review），不是第二次全量评审：

- **范围 = findings 清单 + fix diff 两项**：对 findings 清单**逐条**出结论，并检查 fix diff 本身是否引入新问题；fix 未触及的代码不在本次复审范围内。
- **逐 finding 结论**（按 findings 原顺序）：`<finding 一行摘要> — ADDRESSED | NOT ADDRESSED`，附 `file:line` 证据；**「Attempted」不算 addressed**——那条具体缺陷必须已经不存在。
- **Minor 不进 loop**：Minor 记入进度台账并指向最终整分支复审，不触发 fix 分派、不计入轮次上限。
- **一轮 = 一次 fix 分派 + 一次 scoped re-review**，**每任务最多 5 轮**；该上限不放松 `budget.json.perPhase.maxReworkRounds`，两者取更严者。
- **范围外观察不阻塞**：完全落在 fix diff 之外的问题记为范围外观察，不阻塞本任务、不延长 loop。
- **R 前置不变（`普通 V/G 失败链`）**：V/G 不通过须先分派 R 定位根因，R 报告经 V 复审 + G 门禁（`check-rootcause-report.ts` exitCode=0）通过后才分派 S-fix；scoped re-review 不是跳过 R 的旁路（反模式 #18 / #19）。

**与 §15.2 误报质疑通道的关系**：质疑由新 V 裁决。**质疑成立**（该 finding 确为误报）→ 撤回该 finding，不进入返工；**质疑不成立** → 该 finding 维持原样，按上述范围契约进入 fix 分派与复审；**裁决未被受理**时走 §15.2 的 🔴 CHECKPOINT 升级。质疑既不扩大也不缩小 §3.4.2 的范围与轮次契约。

## 相关资源

- 代码审查员提示模板：参见 [agent-personas.md](agent-personas.md)（code-reviewer persona）
