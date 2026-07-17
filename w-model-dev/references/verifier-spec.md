# LLM-as-a-Verifier 评审规范（Verifier Spec）

> 适用对象：外部 AI Agent（TRAE / Claude / 其他）按本规范对 W 模型各阶段产物执行
> LLM-as-a-Verifier 评审，并将结构化结果写入 JSON 文件交由
> [`scripts/check-verifier-output.ts`](../scripts/check-verifier-output.ts) 校验防漂移。
>
> 本技能**不内置 LLM 调用**。技能只提供「提示词 + 输出 schema + 校验脚本」三件套，
> 评审执行由外部 Agent 完成。技能演化（SkillOpt / darwin-skill）与本规范解耦：
> 本规范只覆盖「阶段产物校验流程」，不包含 Rollout / Reflect / Edit 等轨迹内容。

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

### 3.3 标准分解（Decomposition）

- 每个子标准必须给出：`name` / `description` / `weight` / `score` / `evidence`。
- `evidence` 必须引用目标内部的具体片段（行号 / 段落 ID / 字段名），不得空泛描述。
- `evidence` 缺失或与目标内容无关 → 子标准判 0 分。

## 4. 连续评分（Continuous Scoring）

### 4.1 推荐实现（logits 期望值）

若底层 LLM 提供 logits 接口，按以下算法计算连续分数：

1. 在提示词末尾追加单选题：「请用字母作答：本子标准的达成度属于哪一档？
   A=完全未达成 / B=部分达成 / C=基本达成 / D=完全达成」。
2. 取 A / B / C / D 四个 token 的 logits，做 log-softmax 归一化得概率 `p_A, p_B, p_C, p_D`。
3. 连续分数 = `0.00 * p_A + 0.33 * p_B + 0.67 * p_C + 1.00 * p_D`。
4. 该方法数值稳定，且与离散打分兼容（取 argmax 即恢复字母档）。

### 4.2 文本回退实现（text-parse）

若 LLM 不提供 logits，按以下流程：

1. 在提示词末尾追加：「请仅输出一个字母作答：A / B / C / D」。
2. 解析模型输出首个出现的字母（A-D），忽略大小写。
3. 连续分数 = 该字母对应的离散锚点（0.00 / 0.33 / 0.67 / 1.00）+ `±0.05` 的稳定扰动
   （扰动种子由子标准 name + 目标 ID 哈希得到，保证可复现）。

> 两种实现均输出 `[0.0, 1.0]` 连续分数，下游消费方不感知差异。
> Agent 必须在输出 JSON 的 `scoringMethod` 字段标注实际使用的方法。

## 5. PPT 优先级排序（Probability Pivot Tournament）

当一次评审涉及多个候选目标（如多份候选设计文档、多个测试用例）需要排出优先级时，使用 PPT：

### 5.1 算法描述

- 输入：`N` 个候选目标，每个已有综合分数（连续值）。
- 锦标赛规模 `k`（默认 `5`）：每轮随机抽取 `k` 个候选做「软比较」。
- 软比较胜率 = `sigmoid((score_i - score_j) * temperature)`，`temperature` 默认 `4.0`。
- 每轮胜者累计 1 分，败者累计 0 分；总分高者优先级高。
- 总轮数 = `N * k`（保证每个候选平均被比较 `k` 次）。
- 时间复杂度 `O(N×k)`，相比 `O(N²)` 全比较显著节省 token。

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

## 8. 评审提示词模板

外部 Agent 执行评审时，按以下模板构造提示词（替换 `{{}}` 占位符）。

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
