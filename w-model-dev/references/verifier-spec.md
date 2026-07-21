# LLM-as-a-Verifier 评审规范（Verifier Spec）

> 适用对象：外部 AI Agent（TRAE / Claude / 其他）按本规范对 W 模型各阶段产物执行
> LLM-as-a-Verifier 评审，并将结构化结果写入 JSON 文件交由
> [`scripts/check-verifier-output.ts`](../scripts/check-verifier-output.ts) 校验防漂移。
>
> 本技能**不内置 LLM 调用**。技能只提供「提示词 + 输出 schema + 校验脚本」三件套，
> 评审执行由外部 Agent 完成。技能演化（SkillOpt / darwin-skill）与本规范解耦：
> 本规范只覆盖「阶段产物校验流程」，不包含 Rollout / Reflect / Edit 等轨迹内容。

## 目录

- §1–2：设计原则与目标类型
- §3–5：三维验证、连续评分与 PPT 排序
- §6：输出 Schema 与质量等级
- §7：各目标类型子标准
- §8：外部 Agent 提示词模板
- §9–11：校验、集成与异常处理

## 1. 设计原则

1. **技能内不做 LLM 调用**：所有 LLM 推理由外部 Agent 执行。本规范只规定提示词与输出格式。
2. **结构化输出优先**：评审必须输出严格符合 §6 Schema 的 JSON，禁止自由文本。
3. **校验脚本防漂移**：[`check-verifier-output.ts`](../scripts/check-verifier-output.ts)
   对输出 JSON 做字段、数值范围、子标准覆盖、可重复性方差等校验，不符合规范直接判失败。
4. **三维度验证 + 连续评分 + PPT 排序**：保留原 LLM-as-a-Verifier 学术框架的三大支柱
   （见 §3 / §4 / §5），但实现方式改为「提示词描述算法 + 外部 Agent 执行」。

## 2. 适用目标类型

| 目标类型 | targetKind | ID 前缀 | 评审子标准集合 |
|---|---|---|---|
| 需求 | `requirement` | `REQ-` | §7.1 |
| 设计文档 | `design` | `DESIGN-` | §7.2 |
| 测试用例 | `testcase` | `UAT-` / `ST-` / `IT-` / `UT-` | §7.3 |
| 代码 / 文件 | `file` | （文件路径） | §7.4 |

> `/wm review <target>` 命令会识别目标类型并指引外部 Agent 加载本规范相应章节。

### 2.1 目标类型与产出阶段

| targetKind | 产出阶段 | 产物示例 |
|---|---|---|
| `requirement` | 阶段 1 需求分析 | 需求规格说明书（`*-requirement-spec.md`） |
| `design` | 阶段 2 系统设计 / 阶段 3 概要设计 / 阶段 4 详细设计 | 系统设计/接口设计/详细设计文档 |
| `testcase` | 阶段 1~4（设计）/ 阶段 5~8（执行） | 验收/系统/集成/单元测试用例 |
| `file` | 阶段 5 编码 | 源代码文件（`.ts` / `.py` / `.java` 等） |

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
  的 `variance` 字段对比，误差超过 `1e-4` 即判失败。Agent 不得谎报低方差以
  掩盖「实际只评估 1 次、复制 N 次填入 rawScores」的作弊行为。

### 3.3 标准分解（Decomposition）

- 每个子标准必须给出：`name` / `description` / `weight` / `score` / `evidence`。
- `evidence` 必须引用目标内部的具体片段（行号 / 段落 ID / 字段名），不得空泛描述。
- `evidence` 缺失或与目标内容无关 → 子标准判 0 分。

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

## 5. PPT 优先级排序（Probabilistic Pivot Tournament）

当一次评审涉及多个候选目标（如多份候选设计文档、多个测试用例）需要排出优先级时，使用 PPT：

### 5.1 算法描述

> 算法源自 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 「LLM-as-a-Verifier: A General-Purpose Verification Framework」§4.3 Probabilistic Pivot Tournament (PPT)。
> 本节为算法描述，**由外部 Agent 执行**；技能仅校验输出 JSON 的 `ranking` 字段合理性（见 §6 / [`scripts/verifier-logic.ts`](../scripts/verifier-logic.ts)），不实现算法本身。

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

> **本技能的边界**：技能不实现 PPT 算法本身，只校验外部 Agent 输出的 `ranking` 字段（见 §6）。参数 `k` / `temperature` / `rounds` 的合理性边界由 [`verifier-logic.ts`](../scripts/verifier-logic.ts) 强制（`k ∈ [2,1000]`、`temperature ∈ (0,100]`、`rounds ≥ 1` 的整数）。

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
[`check-verifier-output.ts`](../scripts/check-verifier-output.ts) 校验：

```typescript
interface VerifierOutput {
  /** Schema 版本，当前固定为 "1.0" */
  schemaVersion: '1.0';

  /** 评审元信息 */
  meta: {
    /** 评审目标类型 */
    targetKind: 'requirement' | 'design' | 'testcase' | 'file';
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

  /** 子标准评估结果（≥3 项，对应 §7 各目标类型） */
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

  /** 主结论与改进建议（人类可读） */
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

### 6.2 通过判定

`passed = (qualityLevel === 'A' || qualityLevel === 'B')`。
（即综合分数 ≥ 0.70 视为通过阶段门。）

## 7. 子标准定义

### 7.1 需求（targetKind = `requirement`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `completeness` | 0.30 | 功能 / 非功能 / 约束需求是否齐全；缺失项是否标注 |
| `clarity` | 0.25 | 表述是否无歧义；输入输出边界是否明确 |
| `consistency` | 0.20 | 需求之间是否冲突；术语是否前后一致 |
| `testability` | 0.15 | 验收标准是否可测试；是否可观测可量化 |
| `traceability` | 0.10 | 是否能映射到业务目标；RTM 是否可登记 |

权重和 = 1.00。

### 7.2 设计（targetKind = `design`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `architecture-soundness` | 0.25 | 架构是否合理；分层 / 模块边界是否清晰 |
| `requirement-coverage` | 0.25 | 是否覆盖所有相关需求；RTM 设计列是否可登记 |
| `interface-consistency` | 0.20 | 接口定义是否一致；上下游是否对齐 |
| `feasibility` | 0.15 | 技术选型是否可行；是否存在不可实现项 |
| `testability` | 0.15 | 是否可设计对应测试用例（系统 / 集成 / 单元） |

权重和 = 1.00。

### 7.3 测试用例（targetKind = `testcase`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `coverage` | 0.30 | 是否覆盖对应需求 / 设计点；是否含正例与反例 |
| `correctness` | 0.25 | 预期输出是否正确；步骤是否可复现 |
| `independence` | 0.20 | 用例之间是否独立；是否避免耦合依赖 |
| `clarity` | 0.15 | 步骤描述是否清晰；输入输出是否明确 |
| `priority-reasonableness` | 0.10 | 优先级标注是否合理 |

权重和 = 1.00。

### 7.4 代码 / 文件（targetKind = `file`）

| 子标准 name | weight | 描述 |
|---|---|---|
| `correctness` | 0.30 | 逻辑是否正确；是否符合需求 / 设计意图 |
| `security` | 0.20 | 是否存在注入 / 越权 / 敏感信息泄漏等高危项 |
| `readability` | 0.15 | 命名 / 注释 / 结构是否易读 |
| `maintainability` | 0.15 | 是否易于扩展 / 修改；耦合是否合理 |
| `conformance` | 0.20 | 是否符合代码规范（ESLint / Prettier / 语言等价工具） |

权重和 = 1.00。

### 7.4A 五轴评审维度与 Severity 标签（吸收自 addyosmani/agent-skills）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `code-review-and-quality` 技能的五轴评审与 Severity 标签模式。
> 本节**不改变** §7.4 的子标准 name 与 weight（避免破坏 [`verifier-logic.ts`](../scripts/verifier-logic.ts) 的校验），只规定：
> 1. 评审 `targetKind=file` 时，发现项按五轴组织；
> 2. `reworkHints` 每条建议前缀 Severity 标签；
> 3. 结构性问题必须配 Structural Remedy。

#### 7.4A.1 五轴与子标准映射

`targetKind=file` 的 5 个子标准（§7.4）与 addyosmani 五轴的映射：

| 五轴 | 对应子标准 (§7.4) | 评审重点 |
|---|---|---|
| Correctness（正确性） | `correctness` (0.30) | 逻辑是否符合需求 / 设计；边界条件；错误路径；off-by-one；竞态 |
| Readability（可读性） | `readability` (0.15) | 命名；控制流；组织；「clever」技巧；注释必要性；dead code |
| Architecture（架构） | `maintainability` (0.15) | 模块边界；依赖方向；抽象层次；特性逻辑泄漏；类型边界显式性 |
| Security（安全） | `security` (0.20) | 输入校验；密钥管理；鉴权；SQL 参数化；XSS；依赖来源 |
| Performance（性能） | `conformance` (0.20) | N+1 查询；无界循环；同步阻塞；UI 重渲染；分页缺失；热路径大对象 |

> 注：Performance 轴映射到 `conformance` 是 W 模型适配——`conformance` 原指「符合代码规范」，扩展为「符合性能与规范双约束」。若项目有独立性能子标准，可在 [phase-7-system-test.md](phase-7-system-test.md) 单独评审（k6 性能基线）。

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

> Severity 标签是字符串前缀约定，**不改变** §6 Schema 的 `reworkHints: string[]` 类型；[`check-verifier-output.ts`](../scripts/check-verifier-output.ts) 不强制校验前缀（避免误判历史 JSON），由 Agent 自检与 LLM-as-a-Verifier 在 `summary` 中标注「Severity 标签缺失」。

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
- 这样既吸收了五轴评审的结构化思维，又不破坏 [`verifier-logic.ts`](../scripts/verifier-logic.ts) 对子标准 name/weight 的校验。
- Performance 轴在 W 模型中通常由阶段 7 系统测试（含 k6 性能基线）独立验证，`file` 评审中只标注明显性能反模式（N+1 / 无界循环），不做完整性能评审。

## 8. 评审提示词模板

外部 Agent 执行评审时，按以下模板构造提示词（替换 `{{}}` 占位符）。

### 8.0 占位符列表

所有提示词模板共享以下占位符，Agent 在构造提示词前必须先准备好这些值：

| 占位符 | 来源 / 取值约束 | 示例 |
|---|---|---|
| `{{repeatTimes}}` | 由 Agent 配置，整数 ≥3（spec §3.2 默认 `3`）；与输出 JSON `meta.repeatTimes` 一致 | `3` |
| `{{scoringMethod}}` | Agent 选择，`logits` 或 `text-parse`（spec §4 / §6）；与输出 JSON `meta.scoringMethod` 一致 | `logits` |
| `{{targetKind}}` | 评审目标类型，`requirement` / `design` / `testcase` / `file`（spec §2 / §7）；与输出 JSON `meta.targetKind` 一致 | `requirement` |
| `{{target}}` | 目标 ID（前缀见 §2）或文件路径；与输出 JSON `meta.target` 一致 | `REQ-001` |
| `{{targetContent}}` | 目标的完整文本内容（需求规格 / 设计文档 / 测试用例 / 代码片段），由 Agent 从项目工件中读取后整体填入 | （省略） |
| `{{subSection}}` | §7 中对应 `targetKind` 的子节号（1-4）；用于让模型按正确子标准集合评估 | `1`（对应 §7.1 需求） |
| `{{k}}` | PPT 锦标赛规模，整数 ∈ [2, 1000]（spec §5.1 默认 `5`）；与输出 JSON `ranking.k` 一致 | `5` |
| `{{temperature}}` | PPT 软比较温度，正数 ≤ 100（spec §5.1 默认 `4.0`）；与输出 JSON `ranking.temperature` 一致 | `4.0` |
| `{{candidates}}` | 候选目标列表，每行 `ID<TAB>综合分数`，由 Agent 收集所有候选的 `compositeScore` 后填充 | （省略） |

> 占位符取值必须与输出 JSON 的对应字段保持一致，否则 [`check-verifier-output.ts`](../scripts/check-verifier-output.ts) 会以「字段不一致」为由判失败。

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
npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
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

重试失败处理：所有重试用尽后仍失败 → 该目标 `passed=false`，`reworkHints=['LLM 评审不可用，须人工评审或更换模型']`，回阶段起点返工。

### 11.2 logits 不可用 → text-parse 降级

| 检测信号 | 降级动作 | 输出标注 |
|---|---|---|
| LLM API 不返回 logits（仅返回 text） | 改用 §4.2 text-parse 实现：解析首个字母 A-D + `±0.05` 稳定扰动 | `meta.scoringMethod = 'text-parse'` |
| logits 返回但 A/B/C/D token 缺失 | 同上降级 | 同上 |
| text-parse 解析失败（输出无 A-D 字母） | 在提示词追加「仅输出一个字母」后重试 1 次；仍失败则该子标准 `score=0` | `meta.scoringMethod = 'text-parse'`，`evidence` 标注「解析失败」 |

> 降级后必须更新 `meta.scoringMethod`，否则 `check-verifier-output.ts` 校验失败。

### 11.3 方差超阈值处理

当 `subCriteria[i].variance > meta.varianceThreshold`（默认 0.10）时：

1. **检测**：`check-verifier-output.ts` 重算方差并对比，误差 > `1e-4` 或方差超阈值 → 退出码 1。
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
