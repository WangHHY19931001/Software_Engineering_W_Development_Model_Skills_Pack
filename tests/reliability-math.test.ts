import { describe, it, expect } from '@jest/globals';
import {
  computeKrippendorffAlpha,
  applyDimensionAwareFilter,
  toOrdinalLabels,
} from '../src/core/reliability-math.js';
import type { QualityLevel } from '../src/types/index.js';

describe('computeKrippendorffAlpha (ordinal)', () => {
  it('returns null when coders < 2', () => {
    // 1 coder, 3 units → null
    expect(computeKrippendorffAlpha([[1, 2, 3]])).toBeNull();
    // empty → null
    expect(computeKrippendorffAlpha([])).toBeNull();
  });

  it('returns 0 for complete disagreement between 2 coders on 1 unit', () => {
    // 2 coders each rate 1 unit with opposite values → maximum disagreement → alpha=0
    expect(computeKrippendorffAlpha([[1], [2]])).toBeCloseTo(0, 5);
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

  it('returns negative alpha for complete rank reversal (ordinal)', () => {
    // 2 coders, fully reversed rankings. Ordinal alpha is negative (stronger than nominal).
    const labels = [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
    ];
    const alpha = computeKrippendorffAlpha(labels);
    // ordinal 完全反向 → 负值（与 nominal 不同，nominal 才 ≈0）
    expect(alpha).toBeLessThan(0);
    expect(alpha).toBeGreaterThanOrEqual(-1);
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
