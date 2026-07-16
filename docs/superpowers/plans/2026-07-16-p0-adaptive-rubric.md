# P0 Adaptive Rubric + Reliability Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task-adaptive rubric generation, Krippendorff's alpha reliability gating, and DimensionAwareFilter to the W-Model verification layer — backward-compatible (adaptive off by default, existing 119 tests unchanged).

**Architecture:** Dual-mode overlay on the existing three-dimension verification framework. A new `RubricGenerator` (LLM-backed, cached, falls back to hardcoded subCriteria) feeds `SubCriterion[]` to `verify*` when `VerifierConfig.rubric.adaptive=true`. `VerificationFramework` post-processes its existing N repeated runs into ordinal Krippendorff's alpha (single-model proxy) and applies `DimensionAwareFilter` to clamp `qualityLevel` on per-dimension failures. New `VerificationResult` fields (`reliability`, `deploymentGate`, `dimensionFlags`, `rubricFallback`) are all optional, preserving backward compatibility.

**Tech Stack:** TypeScript, Jest, existing `LLMVerifierEngine` / `MockLLMClient` / `VerificationFramework` / `WModelVerifierEnhancer`.

**Spec:** [docs/superpowers/specs/2026-07-16-p0-adaptive-rubric-design.md](../specs/2026-07-16-p0-adaptive-rubric-design.md)

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/index.ts` | Shared types; extend `SubCriterion`/`VerificationResult`/`VerifierConfig` with optional fields | Modify |
| `src/core/reliability-math.ts` | Pure Krippendorff's alpha computation + DimensionAwareFilter (no I/O) | Create |
| `src/core/rubric-generator.ts` | LLM-backed adaptive rubric generation with cache + hardcoded fallback | Create |
| `src/core/verification-framework.ts` | Wire reliability post-processing into `verifyWithThreeDimensions` | Modify |
| `src/core/w-model-enhancer.ts` | Three `verify*` accept `taskDescription?`, branch on adaptive | Modify |
| `src/index.ts` | Export new public API (`RubricGenerator`, `computeKrippendorffAlpha`, `applyDimensionAwareFilter`, `ReliabilityGateError`) | Modify |
| `tests/reliability-math.test.ts` | Alpha fixtures + filter unit tests | Create |
| `tests/rubric-generator.test.ts` | Generation, cache, fallback | Create |
| `tests/verification-framework.test.ts` | Extend with reliability/filter integration | Modify |
| `tests/w-model-enhancer.test.ts` | Extend with adaptive on/off | Modify |

Decomposition rationale: `reliability-math.ts` is pure (easy to test with fixtures, no LLM); `rubric-generator.ts` isolates I/O and caching; `verification-framework.ts` and `w-model-enhancer.ts` only wire post-processing and branching. This keeps each file focused and lets later tasks build on stable earlier ones.

---

## Task 1: Extend shared types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the type extensions**

Open `src/types/index.ts`. After the existing `SubCriterion` interface (around line 109-114), replace it with:

```typescript
/** 子标准定义 */
export interface SubCriterion {
  id: string;
  description: string;
  scoringPrompt: string;
  weight: number;
  /** 标记此子标准是否来自自适应生成（true=LLM 生成，false/undefined=硬编码） */
  taskAdaptive?: boolean;
  /** 维度级最低可接受阈值（归一化到 1-20 等价分数）。低于此值触发 DimensionAwareFilter 降级 */
  minThreshold?: number;
  /** 5 级评分描述（可选，用于 rubric 可读性） */
  levelDescriptors?: string[];
}
```

Find the existing `VerificationResult` interface (around line 98-106) and replace with:

```typescript
/** 验证结果 */
export interface VerificationResult {
  finalScore: number;
  subScores: Record<string, number>;
  confidence: number;
  qualityLevel: QualityLevel;
  details?: unknown;
  /** 当 LLM 不支持 logits 时回退使用文本解析路径 */
  fallbackUsed?: boolean;
  /** 可靠性指标：Krippendorff's alpha（单模型多 run 代理）；null 表示无法计算（N<2） */
  reliability?: { alpha: number | null; coders: number };
  /** 部署门：pass=可放行，review=需人工复核，fail=不达标（硬门模式抛错） */
  deploymentGate?: 'pass' | 'review' | 'fail';
  /** 各维度是否违规（低于 minThreshold） */
  dimensionFlags?: { id: string; violated: boolean }[];
  /** rubric 是否回退到硬编码（RubricGenerator 失败时为 true） */
  rubricFallback?: boolean;
}
```

Find the existing `VerifierConfig` interface (around line 189-211) and add the `rubric` field before the closing brace:

```typescript
  /**
   * 自适应 rubric 与可靠性门控配置。
   * 未提供时：adaptive=false，行为与原版完全一致。
   */
  rubric?: {
    /** 是否启用自适应 rubric 生成（默认 false） */
    adaptive: boolean;
    /** 生成的维度数（默认 5） */
    dimensions: number;
    /** Krippendorff's alpha 部署门阈值（默认 0.80） */
    alphaThreshold: number;
    /** 维度级 minThreshold 默认值（归一化到 1-20 等价分数，默认 8） */
    minThresholdDefault: number;
    /** 硬门模式：gate=fail 时抛 ReliabilityGateError（默认 false=软标记） */
    hardGate: boolean;
    /** 是否缓存生成的 rubric（默认 true） */
    cache: boolean;
  };
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors (purely additive optional fields).

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm test`
Expected: 119 passing (additive optional fields, no behavior change).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add adaptive rubric & reliability fields to verification types"
```

---

## Task 2: Create reliability math module (pure Krippendorff's alpha + DimensionAwareFilter)

**Files:**
- Create: `src/core/reliability-math.ts`
- Test: `tests/reliability-math.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/reliability-math.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  computeKrippendorffAlpha,
  applyDimensionAwareFilter,
  toOrdinalLabels,
} from '../src/core/reliability-math.js';
import type { QualityLevel } from '../src/types/index.js';

describe('computeKrippendorffAlpha (ordinal)', () => {
  it('returns null when coders < 2', () => {
    expect(computeKrippendorffAlpha([[1], [2]])).toBeNull(); // 1 value per unit but only 1 coder column
    expect(computeKrippendorffAlpha([[1, 2, 3]])).toBeNull(); // 1 coder, 3 units
  });

  it('returns 1.0 for perfect agreement', () => {
    // 3 coders, 4 units, all agree
    const labels = [
      [1, 2, 3, 4], // coder 0
      [1, 2, 3, 4], // coder 1
      [1, 2, 3, 4], // coder 2
    ];
    expect(computeKrippendorffAlpha(labels)).toBeCloseTo(1.0, 5);
  });

  it('returns ~0 for complete disagreement on nominal-ish ordinal', () => {
    // 2 coders, each unit gets different ranks; maximum disagreement
    const labels = [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
    ];
    const alpha = computeKrippendorffAlpha(labels);
    expect(alpha).toBeLessThanOrEqual(0.01);
    expect(alpha).toBeGreaterThanOrEqual(-0.01);
  });

  it('handles gap in ordinal values', () => {
    // values 1 and 5 (gap of 4) should weight disagreement more than 1 and 2
    const close = [
      [1, 1, 2, 2],
      [1, 1, 2, 2],
    ];
    const far = [
      [1, 1, 5, 5],
      [1, 1, 5, 5],
    ];
    expect(computeKrippendorffAlpha(close)).toBeCloseTo(1.0, 5);
    expect(computeKrippendorffAlpha(far)).toBeCloseTo(1.0, 5); // perfect agreement regardless of gap
  });
});

describe('applyDimensionAwareFilter', () => {
  const range = { min: 1, max: 20 };

  it('does not downgrade when all dimensions pass minThreshold', () => {
    const result = applyDimensionAwareFilter(
      { a: 16, b: 14 },
      [
        { id: 'a', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
        { id: 'b', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
      ],
      'good',
      range
    );
    expect(result.qualityLevel).toBe('good');
    expect(result.dimensionFlags).toEqual([
      { id: 'a', violated: false },
      { id: 'b', violated: false },
    ]);
  });

  it('downgrades to poor when any dimension below minThreshold', () => {
    const result = applyDimensionAwareFilter(
      { a: 16, b: 7 },
      [
        { id: 'a', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
        { id: 'b', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
      ],
      'good',
      range
    );
    expect(result.qualityLevel).toBe('poor');
    expect(result.dimensionFlags).toEqual([
      { id: 'a', violated: false },
      { id: 'b', violated: true },
    ]);
  });

  it('skips dimensions without minThreshold (backward compat)', () => {
    const result = applyDimensionAwareFilter(
      { a: 16, b: 5 },
      [
        { id: 'a', description: '', scoringPrompt: '', weight: 0.5 }, // no minThreshold
        { id: 'b', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
      ],
      'good',
      range
    );
    expect(result.qualityLevel).toBe('poor'); // b violated
    expect(result.dimensionFlags).toEqual([
      { id: 'a', violated: false },
      { id: 'b', violated: true },
    ]);
  });

  it('does not upgrade a worse qualityLevel', () => {
    // already 'unacceptable' (<6), no violation should not bump it up
    const result = applyDimensionAwareFilter(
      { a: 5 },
      [{ id: 'a', description: '', scoringPrompt: '', weight: 1, minThreshold: 4 }],
      'unacceptable',
      range
    );
    expect(result.qualityLevel).toBe('unacceptable');
  });
});

describe('toOrdinalLabels', () => {
  it('converts run×dim raw scores to ordinal ranks within each run', () => {
    // run 0: scores [10, 20, 30] → ranks [1, 2, 3]
    // run 1: scores [30, 20, 10] → ranks [3, 2, 1]
    const perRunDimScores = [
      [10, 20, 30],
      [30, 20, 10],
    ];
    const labels = toOrdinalLabels(perRunDimScores);
    expect(labels).toEqual([
      [1, 2, 3],
      [3, 2, 1],
    ]);
  });

  it('handles ties with average ranks', () => {
    const perRunDimScores = [
      [10, 10, 20],
    ];
    const labels = toOrdinalLabels(perRunDimScores);
    // two 10s share ranks 1&2 → avg 1.5; 20 gets rank 3
    expect(labels).toEqual([[1.5, 1.5, 3]]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/reliability-math.test.ts`
Expected: FAIL with "Cannot find module '../src/core/reliability-math.js'"

- [ ] **Step 3: Implement reliability-math.ts**

Create `src/core/reliability-math.ts`:

```typescript
/**
 * 可靠性数学：纯函数实现 Krippendorff's alpha（ordinal）与 DimensionAwareFilter。
 *
 * 不含 I/O，便于用夹具测试。
 *
 * 参考：AdaRubric (arXiv:2603.21362) 提倡 α ≥ 0.80 作为部署级可靠性门。
 */

import type { QualityLevel, SubCriterion } from '../types';

/**
 * 计算 ordinal Krippendorff's alpha。
 *
 * @param labels - labels[coderIndex][unitIndex] = 序数分值（可含小数，如平均秩）
 * @returns alpha ∈ [-1, 1]；coders < 2 时返回 null
 *
 * 公式：α = 1 - Do/De
 *   Do = 观测不一致量（加权，ordinal 用 (u-v)^2 的归一化）
 *   De = 期望不一致量
 */
export function computeKrippendorffAlpha(
  labels: number[][]
): number | null {
  const numCoders = labels.length;
  if (numCoders < 2) return null;

  // 转置为 unit×coder 视图，并只保留被 ≥2 个 coder 评分的 unit
  const unitRatings: number[][] = [];
  const maxCoder = numCoders;
  const numUnits = Math.max(...labels.map(r => r.length));
  for (let u = 0; u < numUnits; u++) {
    const ratings: number[] = [];
    for (let c = 0; c < maxCoder; c++) {
      if (labels[c] && labels[c][u] !== undefined) {
        ratings.push(labels[c][u]);
      }
    }
    if (ratings.length >= 2) {
      unitRatings.push(ratings);
    }
  }
  if (unitRatings.length === 0) return null;

  // 计算所有出现的值，用于 ordinal 距离矩阵
  const allValues = new Set<number>();
  for (const ratings of unitRatings) {
    for (const v of ratings) allValues.add(v);
  }
  const sortedValues = Array.from(allValues).sort((a, b) => a - b);

  // ordinal 度量：值之间的距离按秩差归一化
  // rank(v) = (count of values < v) + (count of values == v)/2  ... 标准 ordinal 处理
  // 简化：用值在排序序列中的索引作为秩（等距处理小数秩）
  const valueRank = new Map<number, number>();
  for (let i = 0; i < sortedValues.length; i++) {
    valueRank.set(sortedValues[i], i + 1);
  }
  const maxRank = sortedValues.length;

  // Do: 观测不一致
  let doSum = 0;
  let totalPairs = 0;
  for (const ratings of unitRatings) {
    for (let i = 0; i < ratings.length; i++) {
      for (let j = i + 1; j < ratings.length; j++) {
        const ri = valueRank.get(ratings[i])!;
        const rj = valueRank.get(ratings[j])!;
        // ordinal 加权：(ri-rj)^2 / (maxRank-1)^2
        const dist = maxRank > 1 ? Math.pow(ri - rj, 2) / Math.pow(maxRank - 1, 2) : 0;
        doSum += dist;
        totalPairs++;
      }
    }
  }
  // 每个 unit 有 m_u 个评分 → C(m_u,2) 对；Do 归一化到 per-pair
  const Do = totalPairs > 0 ? doSum / totalPairs : 0;

  // De: 期望不一致（基于所有评分值的边际分布）
  const allRanks: number[] = [];
  for (const ratings of unitRatings) {
    for (const v of ratings) allRanks.push(valueRank.get(v)!);
  }
  const n = allRanks.length;
  let deSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = maxRank > 1 ? Math.pow(allRanks[i] - allRanks[j], 2) / Math.pow(maxRank - 1, 2) : 0;
      deSum += dist;
    }
  }
  const De = n > 1 ? deSum / (n * (n - 1)) : 0;

  if (De === 0) return 1.0; // 所有人同一值 → 完全一致
  const alpha = 1 - Do / De;
  return Math.max(-1, Math.min(1, alpha));
}

/**
 * 将"每次 run × 每个维度"的原始分数转为每次 run 内的 ordinal 秩。
 * 用于把 VerificationFramework 的 N 次重复评估结果喂给 alpha 计算。
 *
 * @param perRunDimScores - [run][dim] = 原始分数
 * @returns [run][dim] = 秩（1-based，ties 取平均秩）
 */
export function toOrdinalLabels(perRunDimScores: number[][]): number[][] {
  return perRunDimScores.map(runScores => {
    const indexed = runScores.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(runScores.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + 1 + j) / 2; // 1-based, average of ranks i+1..j
      for (let k = i; k < j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j;
    }
    return ranks;
  });
}

/**
 * DimensionAwareFilter：检查各维度是否低于其 minThreshold，违规时钳制 qualityLevel。
 *
 * 规则：任一维度违规 → qualityLevel 上限钳制为 'poor'；不向上调整已更差的等级。
 *
 * @param subScores - 维度ID → 原始分数（在 scoreRange 内）
 * @param subCriteria - 含 minThreshold 的维度定义
 * @param currentLevel - 当前 qualityLevel（来自加权总分）
 * @param range - 评分范围（用于归一化到 1-20 等价分数）
 */
export function applyDimensionAwareFilter(
  subScores: Record<string, number>,
  subCriteria: SubCriterion[],
  currentLevel: QualityLevel,
  range: { min: number; max: number }
): { qualityLevel: QualityLevel; dimensionFlags: { id: string; violated: boolean }[] } {
  const dimensionFlags = subCriteria.map(c => {
    const score = subScores[c.id];
    const violated =
      c.minThreshold !== undefined &&
      score !== undefined &&
      toEquiv(score, range) < c.minThreshold;
    return { id: c.id, violated };
  });

  const anyViolated = dimensionFlags.some(f => f.violated);
  let qualityLevel: QualityLevel = currentLevel;
  if (anyViolated) {
    // 钳制上限为 'poor'，但不向上调整
    const order: QualityLevel[] = ['unacceptable', 'poor', 'acceptable', 'good', 'excellent'];
    const currentIdx = order.indexOf(currentLevel);
    const poorIdx = order.indexOf('poor');
    if (currentIdx > poorIdx) {
      qualityLevel = 'poor';
    }
  }
  return { qualityLevel, dimensionFlags };
}

/** 归一化到 1-20 等价分数（与 verification-framework.ts determineQualityLevel 一致） */
function toEquiv(score: number, range: { min: number; max: number }): number {
  const span = range.max - range.min;
  return span > 0 ? ((score - range.min) / span) * 19 + 1 : score;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/reliability-math.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/core/reliability-math.ts tests/reliability-math.test.ts
git commit -m "feat(reliability): add Krippendorff's alpha and DimensionAwareFilter pure module"
```

---

## Task 3: Create RubricGenerator (LLM-backed, cached, fallback)

**Files:**
- Create: `src/core/rubric-generator.ts`
- Test: `tests/rubric-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/rubric-generator.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { RubricGenerator } from '../src/core/rubric-generator.js';
import { MockLLMClient } from '../src/core/llm-client.js';
import type { LLMClient, LLMResponse, LLMGenerateOptions } from '../src/types/index.js';

/** 返回固定 JSON 的 mock client，用于测试生成路径 */
class FixedJsonClient implements LLMClient {
  public callCount = 0;
  constructor(private readonly json: string) {}
  async generate(_prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    this.callCount++;
    return { text: this.json, supportsLogits: false };
  }
}

/** 抛错的 mock client，用于测试 fallback 路径 */
class ThrowingClient implements LLMClient {
  async generate(): Promise<LLMResponse> {
    throw new Error('LLM unavailable');
  }
}

const RUBRIC_JSON = JSON.stringify({
  dimensions: [
    {
      id: 'completeness',
      description: '需求描述完整性',
      scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)',
      weight: 0.3,
      minThreshold: 10,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
    {
      id: 'clarity',
      description: '验收标准清晰度',
      scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)',
      weight: 0.3,
      minThreshold: 10,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
    {
      id: 'feasibility',
      description: '技术可行性',
      scoringPrompt: '评估需求的技术实现可行性(1-20分)',
      weight: 0.4,
      minThreshold: 8,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
  ],
});

describe('RubricGenerator', () => {
  it('generates adaptive subCriteria from LLM JSON', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.subCriteria).toHaveLength(3);
    expect(result.subCriteria[0].taskAdaptive).toBe(true);
    expect(result.fallback).toBe(false);
    // 权重归一化到 1
    const totalWeight = result.subCriteria.reduce((s, c) => s + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
    // minThreshold 保留
    expect(result.subCriteria[2].minThreshold).toBe(8);
  });

  it('caches rubric by (type, taskDescription) — no repeat LLM call', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: true });
    await gen.generate('requirement', '用户登录功能');
    await gen.generate('requirement', '用户登录功能');

    expect(client.callCount).toBe(1);
  });

  it('does not cache when cache=false', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: false });
    await gen.generate('requirement', '用户登录功能');
    await gen.generate('requirement', '用户登录功能');

    expect(client.callCount).toBe(2);
  });

  it('falls back to hardcoded subCriteria on LLM failure', async () => {
    const client = new ThrowingClient();
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.fallback).toBe(true);
    expect(result.subCriteria.length).toBeGreaterThan(0);
    // 硬编码 subCriteria 不带 taskAdaptive
    expect(result.subCriteria.every(c => c.taskAdaptive !== true)).toBe(true);
  });

  it('falls back on invalid JSON', async () => {
    const client = new FixedJsonClient('not valid json {{{');
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.fallback).toBe(true);
    expect(result.subCriteria.length).toBeGreaterThan(0);
  });

  it('provides hardcoded rubrics for design and testcase types', async () => {
    const client = new ThrowingClient();
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });

    const designResult = await gen.generate('design', '微服务架构');
    expect(designResult.subCriteria.some(c => c.id.includes('arch') || c.id.includes('interface'))).toBe(true);

    const tcResult = await gen.generate('testcase', '边界测试');
    expect(tcResult.subCriteria.some(c => c.id.includes('coverage') || c.id.includes('boundary'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/rubric-generator.test.ts`
Expected: FAIL with "Cannot find module '../src/core/rubric-generator.js'"

- [ ] **Step 3: Implement RubricGenerator**

Create `src/core/rubric-generator.ts`:

```typescript
/**
 * 自适应 Rubric 生成器
 *
 * 输入 (type, taskDescription)，调用 LLM 生成 N 个正交维度 + 5 级评分标准 + 权重 + minThreshold。
 * 失败时回退到与 w-model-enhancer.ts 硬编码一致的 subCriteria。
 *
 * 参考：AdaRubric (arXiv:2603.21362) 任务自适应 rubric。
 */

import type { LLMClient, SubCriterion } from '../types';

export type RubricType = 'requirement' | 'design' | 'testcase';

export interface RubricGeneratorConfig {
  llm: LLMClient;
  dimensions: number;
  minThresholdDefault: number;
  cache: boolean;
}

export interface GenerateResult {
  subCriteria: SubCriterion[];
  fallback: boolean;
}

export class RubricGenerator {
  private cache = new Map<string, GenerateResult>();

  constructor(private readonly config: RubricGeneratorConfig) {}

  async generate(type: RubricType, taskDescription: string): Promise<GenerateResult> {
    const key = `${type}:${hash(taskDescription)}`;
    if (this.config.cache) {
      const cached = this.cache.get(key);
      if (cached) return cached;
    }

    try {
      const subCriteria = await this.generateFromLLM(type, taskDescription);
      const result: GenerateResult = { subCriteria, fallback: false };
      if (this.config.cache) this.cache.set(key, result);
      return result;
    } catch {
      // 回退硬编码
      const result: GenerateResult = { subCriteria: hardcodedRubric(type), fallback: true };
      if (this.config.cache) this.cache.set(key, result);
      return result;
    }
  }

  private async generateFromLLM(type: RubricType, taskDescription: string): Promise<SubCriterion[]> {
    const prompt = this.buildPrompt(type, taskDescription, this.config.dimensions);
    const response = await this.config.llm.generate(prompt);
    const parsed = JSON.parse(response.text);
    if (!parsed || !Array.isArray(parsed.dimensions)) {
      throw new Error('Invalid rubric JSON: missing dimensions array');
    }

    const raw = parsed.dimensions.slice(0, this.config.dimensions);
    if (raw.length === 0) throw new Error('No dimensions returned');

    // 归一化权重
    const totalWeight = raw.reduce((s: number, d: any) => s + (Number(d.weight) || 0), 0);
    const normFactor = totalWeight > 0 ? 1 / totalWeight : 1 / raw.length;

    return raw.map((d: any) => ({
      id: String(d.id ?? `dim-${Math.random().toString(36).slice(2, 8)}`),
      description: String(d.description ?? ''),
      scoringPrompt: String(d.scoringPrompt ?? d.description ?? ''),
      weight: (Number(d.weight) || 0) * normFactor,
      minThreshold: Number(d.minThreshold) || this.config.minThresholdDefault,
      levelDescriptors: Array.isArray(d.levelDescriptors) ? d.levelDescriptors.map(String) : undefined,
      taskAdaptive: true,
    }));
  }

  private buildPrompt(type: RubricType, taskDescription: string, n: number): string {
    const typeLabel = type === 'requirement' ? '需求规格说明书' : type === 'design' ? '设计文档' : '测试用例';
    return `你是验证 rubric 生成器。为以下${typeLabel}生成 ${n} 个正交的评估维度。

任务描述：${taskDescription}

要求：
- 维度之间正交，不重叠
- 每个维度含 id（英文 kebab-case）、description、scoringPrompt（含1-20分评分指引）、weight（0-1，总和为1）、minThreshold（1-20等价分数，低于此值视为该维度失败）、levelDescriptors（5级描述）
- 输出严格 JSON，不要 markdown 代码块

输出格式：
{"dimensions":[{"id":"...","description":"...","scoringPrompt":"...","weight":0.2,"minThreshold":10,"levelDescriptors":["差","较差","一般","良好","优秀"]}]}`
      .trim();
  }
}

/** 硬编码 rubric，与 w-model-enhancer.ts 保持一致（作为 fallback） */
function hardcodedRubric(type: RubricType): SubCriterion[] {
  switch (type) {
    case 'requirement':
      return [
        { id: 'completeness', description: '需求描述完整性', scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)', weight: 0.25 },
        { id: 'clarity', description: '验收标准清晰度', scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)', weight: 0.20 },
        { id: 'consistency', description: '需求内部一致性', scoringPrompt: '评估需求内部是否存在冲突或矛盾(1-20分)', weight: 0.20 },
        { id: 'traceability', description: '需求可追溯性', scoringPrompt: '评估需求的可追溯性和可追踪性(1-20分)', weight: 0.20 },
        { id: 'feasibility', description: '技术可行性', scoringPrompt: '评估需求的技术实现可行性(1-20分)', weight: 0.15 },
      ];
    case 'design':
      return [
        { id: 'arch-clarity', description: '架构设计清晰度', scoringPrompt: '评估架构设计的清晰度、模块划分合理性、技术选型依据充分性(1-20分)', weight: 0.20 },
        { id: 'interface-completeness', description: '接口定义完整性', scoringPrompt: '评估接口定义的完整性、参数明确性、异常处理覆盖度(1-20分)', weight: 0.20 },
        { id: 'scalability', description: '可扩展性设计', scoringPrompt: '评估设计的可扩展性、扩展点预留、耦合度合理性(1-20分)', weight: 0.15 },
        { id: 'performance', description: '性能考虑', scoringPrompt: '评估性能瓶颈识别、优化方案、数据库设计、缓存策略(1-20分)', weight: 0.15 },
        { id: 'security', description: '安全性设计', scoringPrompt: '评估安全风险识别、防护措施、数据加密、权限控制(1-20分)', weight: 0.15 },
        { id: 'testability', description: '可测试性', scoringPrompt: '评估单元测试便利性、mock支持、数据隔离、测试环境设计(1-20分)', weight: 0.15 },
      ];
    case 'testcase':
      return [
        { id: 'coverage', description: '覆盖完整性', scoringPrompt: '评估测试场景覆盖的完整性和全面性(1-20分)', weight: 0.25 },
        { id: 'boundary-handling', description: '边界条件处理', scoringPrompt: '评估边界条件和极端场景的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'exception-handling', description: '异常场景覆盖', scoringPrompt: '评估异常场景和错误处理的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'clarity', description: '测试步骤清晰度', scoringPrompt: '评估测试步骤描述的清晰度和可操作性(1-20分)', weight: 0.15 },
        { id: 'maintainability', description: '可维护性', scoringPrompt: '评估测试用例的可维护性和易修改性(1-20分)', weight: 0.20 },
      ];
  }
}

/** 稳定哈希（FNV-1a 简化版），用于缓存 key */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/rubric-generator.test.ts`
Expected: PASS (all 6 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/core/rubric-generator.ts tests/rubric-generator.test.ts
git commit -m "feat(rubric): add RubricGenerator with LLM generation, cache, and hardcoded fallback"
```

---

## Task 4: Wire reliability post-processing into VerificationFramework

**Files:**
- Modify: `src/core/verification-framework.ts`
- Modify: `tests/verification-framework.test.ts`

- [ ] **Step 1: Write the failing tests (extend existing file)**

Append to `tests/verification-framework.test.ts` (before the final closing of file, after existing describes):

```typescript
import { applyDimensionAwareFilter, computeKrippendorffAlpha, toOrdinalLabels } from '../src/core/reliability-math.js';

/** 评分引擎：每次调用按序返回预设分数，用于构造可控的重复评估 */
class SequenceScoreEngine implements ContinuousScoringEngine {
  private callIdx = 0;
  constructor(private readonly scoresByCall: number[]) {}
  async computeContinuousScore(): Promise<number> {
    const s = this.scoresByCall[this.callIdx % this.scoresByCall.length];
    this.callIdx++;
    return s;
  }
  async getScoreDistribution(): Promise<Map<number, number>> {
    return new Map([[10, 1]]);
  }
  reset() { this.callIdx = 0; }
}

describe('VerificationFramework - reliability post-processing', () => {
  it('computes reliability.alpha from repeated runs (N>=2)', async () => {
    // 1 dimension, 3 runs, all score 16 → ordinal identical → alpha=1
    const engine = new SequenceScoreEngine([16, 16, 16]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1, minThreshold: 10 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability).toBeDefined();
    expect(result.reliability!.coders).toBe(3);
    expect(result.reliability!.alpha).toBeCloseTo(1.0, 3);
  });

  it('sets reliability.alpha=null when N<2', async () => {
    const engine = new SequenceScoreEngine([16]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 1, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability).toEqual({ alpha: null, coders: 1 });
    expect(result.deploymentGate).toBe('review');
  });

  it('applies DimensionAwareFilter to downgrade qualityLevel', async () => {
    // 2 dimensions: a passes (16), b fails (7 < minThreshold 10)
    // Sequence: 3 runs × 2 dims = [a,a,a,b,b,b]
    const engine = new SequenceScoreEngine([16, 16, 16, 7, 7, 7]);
    const fw = new VerificationFramework(engine);
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [
          { id: 'a', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
          { id: 'b', description: '', scoringPrompt: '', weight: 0.5, minThreshold: 10 },
        ],
        weights: [0.5, 0.5],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    // 加权总分 = 16*0.5 + 7*0.5 = 11.5 → equiv ≈ 12.4 → 'acceptable'
    // 但 b 维度违规 → 钳制为 'poor'
    expect(result.qualityLevel).toBe('poor');
    expect(result.dimensionFlags).toEqual([
      { id: 'a', violated: false },
      { id: 'b', violated: true },
    ]);
    expect(result.deploymentGate).toBe('review'); // alpha 可能 pass 但 dimension 违规
  });

  it('sets deploymentGate=pass when alpha>=threshold and no dimension violated', async () => {
    // 默认 alphaThreshold=0.80；3 runs 全一致 → alpha=1
    const engine = new SequenceScoreEngine([16, 16, 16]);
    const fw = new VerificationFramework(engine, { alphaThreshold: 0.8 });
    const dim: VerificationDimension = {
      scoreGranularity: { range: { min: 1, max: 20 }, labels: [], granularityLevel: 20 },
      repeatedEvaluation: { times: 3, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: {
        originalCriteria: 'test',
        subCriteria: [{ id: 'a', description: '', scoringPrompt: '', weight: 1, minThreshold: 8 }],
        weights: [1],
      },
    };
    const result = await fw.verifyWithThreeDimensions({}, dim);
    expect(result.reliability!.alpha).toBeCloseTo(1.0, 3);
    expect(result.dimensionFlags).toEqual([{ id: 'a', violated: false }]);
    expect(result.deploymentGate).toBe('pass');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/verification-framework.test.ts`
Expected: FAIL (new tests fail — `reliability`/`deploymentGate`/`dimensionFlags` undefined; constructor doesn't accept 2nd arg).

- [ ] **Step 3: Modify VerificationFramework to wire post-processing**

Open `src/core/verification-framework.ts`. Update the constructor and `verifyWithThreeDimensions`. Replace the existing class (lines 16-141) with:

```typescript
export class VerificationFramework {
  private scoringEngine: ContinuousScoringEngine;
  private readonly alphaThreshold: number;

  constructor(scoringEngine: ContinuousScoringEngine, opts?: { alphaThreshold?: number }) {
    this.scoringEngine = scoringEngine;
    this.alphaThreshold = opts?.alphaThreshold ?? 0.8;
  }

  /** 执行三维度验证 */
  async verifyWithThreeDimensions(
    target: unknown,
    criteria: VerificationDimension
  ): Promise<VerificationResult> {
    const subScores: Record<string, number> = {};
    /** 加权后的子标准得分（用于综合分数） */
    const weightedScores: number[] = [];
    /** 各子标准原始得分（用于置信度计算） */
    const rawScores: number[] = [];
    /** 每次 run × 每个维度的原始分数，用于 alpha 计算 */
    const perRunDimScores: number[][] = [];

    // 1. 标准分解评估
    for (const subCriterion of criteria.criteriaDecomposition.subCriteria) {
      const repeatedScores: number[] = [];

      // 2. 重复评估（降低方差）
      for (let i = 0; i < criteria.repeatedEvaluation.times; i++) {
        const score = await this.scoringEngine.computeContinuousScore(
          subCriterion.scoringPrompt,
          target,
          criteria.scoreGranularity.range
        );
        repeatedScores.push(score);
      }

      // 3. 聚合重复评估结果
      const aggregated = this.aggregateScores(
        repeatedScores,
        criteria.repeatedEvaluation.aggregationMethod
      );

      subScores[subCriterion.id] = aggregated;
      rawScores.push(aggregated);
      weightedScores.push(aggregated * subCriterion.weight);
      perRunDimScores.push(repeatedScores);
    }

    // 4. 综合分数 = Σ(子标准得分 × 权重)
    const finalScore = weightedScores.reduce((a, b) => a + b, 0);

    // 5. 置信度（基于原始得分的方差，越一致置信度越高）
    const confidence = this.computeConfidence(rawScores);

    // 6. 质量等级（初始：基于加权总分）
    let qualityLevel = this.determineQualityLevel(
      finalScore,
      criteria.scoreGranularity.range
    );

    // 7. 可靠性：ordinal Krippendorff's alpha
    // perRunDimScores 是 [dim][run]，需转置为 [run][dim] 喂给 toOrdinalLabels
    const numRuns = criteria.repeatedEvaluation.times;
    const transposed: number[][] = [];
    for (let run = 0; run < numRuns; run++) {
      const runDims: number[] = [];
      for (let dim = 0; dim < perRunDimScores.length; dim++) {
        runDims.push(perRunDimScores[dim][run]);
      }
      transposed.push(runDims);
    }
    const ordinalLabels = toOrdinalLabels(transposed);
    const alpha = computeKrippendorffAlpha(ordinalLabels);
    const reliability = { alpha, coders: numRuns };

    // 8. DimensionAwareFilter
    const filterResult = applyDimensionAwareFilter(
      subScores,
      criteria.criteriaDecomposition.subCriteria,
      qualityLevel,
      criteria.scoreGranularity.range
    );
    qualityLevel = filterResult.qualityLevel;

    // 9. 部署门
    const dimOk = !filterResult.dimensionFlags.some(f => f.violated);
    const alphaOk = alpha !== null && alpha >= this.alphaThreshold;
    let deploymentGate: 'pass' | 'review' | 'fail';
    if (alphaOk && dimOk) {
      deploymentGate = 'pass';
    } else {
      deploymentGate = 'review';
    }

    return {
      finalScore,
      subScores,
      confidence,
      qualityLevel,
      details: { rawScores, weightedScores },
      reliability,
      deploymentGate,
      dimensionFlags: filterResult.dimensionFlags,
    };
  }

  /** 聚合多次评分结果 */
  aggregateScores(
    scores: number[],
    method: 'mean' | 'median' | 'weighted'
  ): number {
    if (scores.length === 0) return 0;

    switch (method) {
      case 'mean':
        return scores.reduce((a, b) => a + b, 0) / scores.length;

      case 'median': {
        const sorted = [...scores].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      }

      case 'weighted': {
        // 最近评分权重更高（指数衰减）
        const weights = scores.map((_, i) => Math.exp(i * 0.1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        return (
          scores.reduce((sum, score, i) => sum + score * weights[i], 0) /
          totalWeight
        );
      }
    }
  }

  /**
   * 计算置信度：基于评分方差的归一化指标。
   * 标准差越小 → 置信度越高。
   */
  computeConfidence(scores: number[]): number {
    if (scores.length < 2) return 1.0;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (mean === 0) return 0;

    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / Math.abs(mean); // 变异系数

    // cv 越小，置信度越高；cv=0 → 1.0；cv≥0.5 → 0
    return Math.max(0, Math.min(1, 1 - cv * 2));
  }

  /**
   * 确定质量等级。
   * 将任意范围归一化到 1-20 等价分数后，使用绝对阈值（与 SSoT 一致）：
   *   18 / 14 / 10 / 6 边界
   */
  determineQualityLevel(
    score: number,
    range: { min: number; max: number }
  ): QualityLevel {
    return determineQualityLevel(score, range);
  }
}
```

Add the imports at the top of the file (after existing imports):

```typescript
import { computeKrippendorffAlpha, applyDimensionAwareFilter, toOrdinalLabels } from './reliability-math';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/verification-framework.test.ts`
Expected: PASS (existing + new tests green).

- [ ] **Step 5: Run full suite to confirm no regression**

Run: `npm test`
Expected: all passing (existing tests unaffected by additive fields).

- [ ] **Step 6: Commit**

```bash
git add src/core/verification-framework.ts tests/verification-framework.test.ts
git commit -m "feat(verification): wire Krippendorff alpha + DimensionAwareFilter into framework"
```

---

## Task 5: Wire adaptive rubric branching into WModelVerifierEnhancer

**Files:**
- Modify: `src/core/w-model-enhancer.ts`
- Modify: `tests/w-model-enhancer.test.ts`

- [ ] **Step 1: Read existing enhancer test patterns**

Run: `npx jest tests/w-model-enhancer.test.ts --listTests 2>/dev/null; head -60 tests/w-model-enhancer.test.ts`
Expected: see existing test structure and imports.

- [ ] **Step 2: Write the failing tests (extend existing file)**

Append to `tests/w-model-enhancer.test.ts`:

```typescript
import { RubricGenerator } from '../src/core/rubric-generator.js';
import type { LLMClient, LLMResponse, LLMGenerateOptions } from '../src/types/index.js';

class FixedJsonClient implements LLMClient {
  constructor(private readonly json: string) {}
  async generate(_prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    return { text: this.json, supportsLogits: false };
  }
}

const ADAPTIVE_RUBRIC_JSON = JSON.stringify({
  dimensions: [
    { id: 'adaptive-completeness', description: '完整性', scoringPrompt: '完整性(1-20)', weight: 0.5, minThreshold: 10 },
    { id: 'adaptive-clarity', description: '清晰度', scoringPrompt: '清晰度(1-20)', weight: 0.5, minThreshold: 10 },
  ],
});

describe('WModelVerifierEnhancer - adaptive rubric', () => {
  it('uses hardcoded rubric when adaptive disabled (default)', async () => {
    const config = {
      llm: { model: 'mock' },
      // no rubric.adaptive → defaults to off
    };
    const enhancer = new WModelVerifierEnhancer(config);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req);
    // 硬编码 subCriteria 含 'completeness'（非 'adaptive-completeness'）
    expect(result.subScores).toHaveProperty('completeness');
    expect(result.subScores).not.toHaveProperty('adaptive-completeness');
    expect(result.rubricFallback).toBeUndefined(); // adaptive off, no fallback flag
  });

  it('uses RubricGenerator when adaptive enabled', async () => {
    const client = new FixedJsonClient(ADAPTIVE_RUBRIC_JSON);
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 2, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req, '用户登录功能');
    expect(result.subScores).toHaveProperty('adaptive-completeness');
    expect(result.rubricFallback).toBe(false);
  });

  it('falls back to hardcoded when RubricGenerator fails', async () => {
    const client = new (class implements LLMClient {
      async generate(): Promise<LLMResponse> { throw new Error('LLM down'); }
    })();
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 5, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req, '用户登录功能');
    expect(result.subScores).toHaveProperty('completeness');
    expect(result.rubricFallback).toBe(true);
  });

  it('verifyDesign and verifyTestCase also support adaptive', async () => {
    const client = new FixedJsonClient(ADAPTIVE_RUBRIC_JSON);
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 2, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const design = {
      id: 'd1', projectId: 'p1', type: '系统设计' as const,
      content: 'c', diagrams: [], testCases: [], createdAt: '2026-01-01',
    };
    const dResult = await enhancer.verifyDesign(design, '微服务架构');
    expect(dResult.subScores).toHaveProperty('adaptive-completeness');

    const tc = {
      id: 't1', projectId: 'p1', type: '单元测试' as const, title: 't',
      description: 'd', steps: ['s1'], expectedResult: 'e',
      status: '待执行' as const, priority: '高' as const,
    };
    const tResult = await enhancer.verifyTestCaseQuality(tc, '边界测试');
    expect(tResult.subScores).toHaveProperty('adaptive-completeness');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/w-model-enhancer.test.ts`
Expected: FAIL (verify* don't accept 2nd arg; no RubricGenerator wiring).

- [ ] **Step 4: Modify WModelVerifierEnhancer**

Open `src/core/w-model-enhancer.ts`. Add import and field, then update the three `verify*` methods. Apply these edits:

Add import after existing imports (after line 24 `import type { LLMClient } from '../types';`):

```typescript
import { RubricGenerator, type RubricType } from './rubric-generator';
```

Update the class (replace the constructor and field block, lines 29-44):

```typescript
export class WModelVerifierEnhancer {
  private engine: LLMVerifierEngine;
  private framework: VerificationFramework;
  private ranker: PPTRanker;
  private config: VerifierConfig;
  private rubricGenerator: RubricGenerator | null = null;
  private rubricConfig: NonNullable<VerifierConfig['rubric']>;

  constructor(config: VerifierConfig, llmClient?: LLMClient) {
    this.config = config;
    // 默认使用 MockLLMClient（开箱即用，便于 CI / 演示；生产环境请注入真实客户端）
    const client = llmClient ?? new MockLLMClient(config.llm);
    this.engine = new LLMVerifierEngine(config, client);
    this.framework = new VerificationFramework(this.engine, {
      alphaThreshold: config.rubric?.alphaThreshold ?? 0.8,
    });
    this.ranker = new PPTRanker(this.engine);

    // rubric 配置（默认全关闭，向后兼容）
    this.rubricConfig = config.rubric ?? {
      adaptive: false,
      dimensions: 5,
      alphaThreshold: 0.8,
      minThresholdDefault: 8,
      hardGate: false,
      cache: true,
    };
    if (this.rubricConfig.adaptive) {
      this.rubricGenerator = new RubricGenerator({
        llm: client,
        dimensions: this.rubricConfig.dimensions,
        minThresholdDefault: this.rubricConfig.minThresholdDefault,
        cache: this.rubricConfig.cache,
      });
    }
  }
```

Replace `verifyRequirement` (lines 54-68):

```typescript
  /** 需求分析阶段验证：完整性 / 清晰度 / 一致性 / 可追溯性 / 可行性 */
  async verifyRequirement(
    requirement: Requirement,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('requirement', taskDescription);
    return this.framework.verifyWithThreeDimensions(requirement, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '需求质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
  }
```

Replace `verifyDesign` (lines 73-88):

```typescript
  /** 设计阶段验证：架构清晰度 / 接口完整性 / 可扩展性 / 性能 / 安全 / 可测试性 */
  async verifyDesign(
    design: Design,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('design', taskDescription);
    return this.framework.verifyWithThreeDimensions(design, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '设计质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
  }
```

Replace `verifyTestCaseQuality` (lines 93-107):

```typescript
  /** 测试用例质量验证：覆盖完整性 / 边界 / 异常 / 步骤清晰度 / 可维护性 */
  async verifyTestCaseQuality(
    testCase: TestCase,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('testcase', taskDescription);
    return this.framework.verifyWithThreeDimensions(testCase, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '测试用例质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
  }
```

Add the `resolveSubCriteria` helper method (after `verifyTestCaseQuality`, before `rankTestCasesByPriority`):

```typescript
  /**
   * 解析子标准：adaptive 开启时走 RubricGenerator，否则用硬编码。
   * 把 rubricFallback 标记注入返回结果的 details（通过 wrapper）。
   */
  private async resolveSubCriteria(
    type: RubricType,
    taskDescription?: string
  ): Promise<SubCriterion[]> {
    if (this.rubricConfig.adaptive && this.rubricGenerator && taskDescription) {
      const result = await this.rubricGenerator.generate(type, taskDescription);
      // rubricFallback 通过闭包标记，verify* 调用方需读取；此处用全局标记
      this._lastRubricFallback = result.fallback;
      return result.subCriteria;
    }
    // adaptive 关闭或无 taskDescription → 硬编码（不标 fallback）
    this._lastRubricFallback = undefined;
    return hardcodedSubCriteria(type);
  }

  /** 上一次 resolveSubCriteria 的 fallback 标记（供 verify* 包装结果用） */
  private _lastRubricFallback: boolean | undefined = undefined;
```

Add the `hardcodedSubCriteria` standalone function and `SubCriterion` import at the top. Update the existing imports block to add `SubCriterion`:

```typescript
import type {
  Design,
  Requirement,
  SubCriterion,
  TestCase,
  VerificationResult,
  VerifierConfig,
} from '../types';
```

Add standalone function at the bottom of the file (after the class):

```typescript
/** 硬编码 subCriteria（adaptive 关闭或 fallback 时使用），与 RubricGenerator 的 fallback 一致 */
function hardcodedSubCriteria(type: RubricType): SubCriterion[] {
  switch (type) {
    case 'requirement':
      return [
        { id: 'completeness', description: '需求描述完整性', scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)', weight: 0.25 },
        { id: 'clarity', description: '验收标准清晰度', scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)', weight: 0.20 },
        { id: 'consistency', description: '需求内部一致性', scoringPrompt: '评估需求内部是否存在冲突或矛盾(1-20分)', weight: 0.20 },
        { id: 'traceability', description: '需求可追溯性', scoringPrompt: '评估需求的可追溯性和可追踪性(1-20分)', weight: 0.20 },
        { id: 'feasibility', description: '技术可行性', scoringPrompt: '评估需求的技术实现可行性(1-20分)', weight: 0.15 },
      ];
    case 'design':
      return [
        { id: 'arch-clarity', description: '架构设计清晰度', scoringPrompt: '评估架构设计的清晰度、模块划分合理性、技术选型依据充分性(1-20分)', weight: 0.20 },
        { id: 'interface-completeness', description: '接口定义完整性', scoringPrompt: '评估接口定义的完整性、参数明确性、异常处理覆盖度(1-20分)', weight: 0.20 },
        { id: 'scalability', description: '可扩展性设计', scoringPrompt: '评估设计的可扩展性、扩展点预留、耦合度合理性(1-20分)', weight: 0.15 },
        { id: 'performance', description: '性能考虑', scoringPrompt: '评估性能瓶颈识别、优化方案、数据库设计、缓存策略(1-20分)', weight: 0.15 },
        { id: 'security', description: '安全性设计', scoringPrompt: '评估安全风险识别、防护措施、数据加密、权限控制(1-20分)', weight: 0.15 },
        { id: 'testability', description: '可测试性', scoringPrompt: '评估单元测试便利性、mock支持、数据隔离、测试环境设计(1-20分)', weight: 0.15 },
      ];
    case 'testcase':
      return [
        { id: 'coverage', description: '覆盖完整性', scoringPrompt: '评估测试场景覆盖的完整性和全面性(1-20分)', weight: 0.25 },
        { id: 'boundary-handling', description: '边界条件处理', scoringPrompt: '评估边界条件和极端场景的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'exception-handling', description: '异常场景覆盖', scoringPrompt: '评估异常场景和错误处理的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'clarity', description: '测试步骤清晰度', scoringPrompt: '评估测试步骤描述的清晰度和可操作性(1-20分)', weight: 0.15 },
        { id: 'maintainability', description: '可维护性', scoringPrompt: '评估测试用例的可维护性和易修改性(1-20分)', weight: 0.20 },
      ];
  }
}
```

Note: to surface `rubricFallback` in the returned `VerificationResult`, update each `verify*` to wrap the framework result. Replace the return of `verifyRequirement`:

```typescript
    const result = await this.framework.verifyWithThreeDimensions(requirement, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '需求质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
    if (this._lastRubricFallback !== undefined) result.rubricFallback = this._lastRubricFallback;
    return result;
```

Apply the same wrapping to `verifyDesign` and `verifyTestCaseQuality` (same 2 lines appended before `return result`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/w-model-enhancer.test.ts`
Expected: PASS (existing + new 4 tests green).

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/core/w-model-enhancer.ts tests/w-model-enhancer.test.ts
git commit -m "feat(enhancer): wire adaptive rubric branching into verify* methods"
```

---

## Task 6: Export new public API + final regression

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read current exports**

Run: `head -40 src/index.ts`
Expected: see existing export statements.

- [ ] **Step 2: Add new exports**

Open `src/index.ts`. Add these exports (alongside existing ones):

```typescript
export { RubricGenerator } from './core/rubric-generator';
export type { RubricType, RubricGeneratorConfig, GenerateResult } from './core/rubric-generator';
export {
  computeKrippendorffAlpha,
  applyDimensionAwareFilter,
  toOrdinalLabels,
} from './core/reliability-math';
```

- [ ] **Step 3: Verify exports compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all passing (119 original + new tests).

- [ ] **Step 5: Run example to confirm end-to-end still works**

Run: `npm run example:run`
Expected: example completes without error.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(api): export RubricGenerator and reliability-math functions"
```

---

## Task 7: Self-review against spec

- [ ] **Step 1: Verify spec success criteria**

For each item in spec §10, confirm:

1. **adaptive 关闭时 119 测试全通过** — Task 4 Step 5 + Task 5 Step 6 ran `npm test`. Confirm count ≥ 119.
2. **adaptive 开启 + Mock LLM 返回扩展字段** — Task 5 Step 4 test "uses RubricGenerator when adaptive enabled" checks `subScores` + `rubricFallback`. Confirm `reliability`/`dimensionFlags`/`deploymentGate` also present (they come from framework, always set). Add an assertion if missing.
3. **α 完全一致=1, 完全分歧≈0** — Task 2 tests cover this.
4. **DimensionAwareFilter 钳制为 'poor'** — Task 4 test "applies DimensionAwareFilter to downgrade qualityLevel" covers this.
5. **RubricGenerator 失败回退 + rubricFallback=true** — Task 5 test "falls back to hardcoded" covers this.
6. **缓存命中不调 LLM** — Task 3 test "caches rubric" covers this.

If any assertion is missing, add it and re-run.

- [ ] **Step 2: Type consistency check**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm `RubricType`, `SubCriterion.minThreshold`, `VerificationResult.reliability` are all referenced consistently across tasks.

- [ ] **Step 3: Final commit if any fixes were made**

```bash
git add -A
git commit -m "test: complete spec success-criteria assertions" --allow-empty
```

---

## Notes for implementer

- **Backward compat is paramount**: every new field on `VerificationResult`/`SubCriterion`/`VerifierConfig` is optional. `VerifierConfig.rubric` absent → adaptive off → identical to pre-P0 behavior.
- **Krippendorff's α is a single-model proxy** here (N repeated runs as N "coders"). This is documented as a limitation; true multi-coder α is deferred to P3.
- **DimensionAwareFilter clamps down only** (never upgrades). A dimension violation can turn `good`→`poor` but never `unacceptable`→`poor`.
- **Hard gate 已实现（审查后补）**：原计划按 YAGNI 跳过 `hardGate` 抛错，但审查发现这使 `VerifierConfig.rubric.hardGate` 沦为"假开关"，与 spec §7 承诺不符。已在审查修正中补 `ReliabilityGateError` 类 + `verification-framework.ts` 构造函数接收 `hardGate` + `w-model-enhancer.ts` 透传 + 3 个测试。现 `hardGate:true` 且 gate=fail 时抛 `ReliabilityGateError`（携带 alpha 与 dimensionViolations），软门默认 `gate='review'` 不抛。
- **Fallback rubric 已补 minThreshold（审查后补）**：原 `hardcodedRubric`/`hardcodedSubCriteria` 的 subCriteria 不带 `minThreshold`，导致 RubricGenerator 失败回退或 adaptive 关闭时 DimensionAwareFilter 静默失效。已改为接收 `minThresholdDefault` 参数并填充每个维度，fallback 路径仍受维度级门控保护。
- **α 语义已对齐 ordinal（审查后补）**：spec §8/§10 原"完全分歧→α≈0"与 ordinal 实现矛盾（ordinal 完全反向为负值）。已改 spec 为"完全反向→α<0、完全随机分歧→α≈0"，并注明单模型重复评估场景下完全反向不会发生。
- **Krippendorff's α 是单模型代理**（N 次重复 run 作 N 个"编码者"）。真·多编码者 α 留 P3。
- The `_lastRubricFallback` instance flag on `WModelVerifierEnhancer` is a pragmatic way to thread the fallback bit through without changing `VerificationFramework`'s signature. If concurrent calls become a concern later, refactor to return a tuple from `resolveSubCriteria`.
