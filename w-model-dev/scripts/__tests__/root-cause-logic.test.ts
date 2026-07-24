/**
 * root-cause-logic.ts 单元测试 —— R 报告校验 R1-R10 规则
 *
 * 覆盖：
 *   - R1 Schema 完整性（必填字段非空）
 *   - R2 rootCauseChain 长度 [2,5] + evidence 非空
 *   - R3 falsifiabilityCheck 含「若...则」句式
 *   - R4 fixRecommendation 四字段
 *   - R5 prevention 三字段
 *   - R6 upstreamDefect.present=true 时后续字段非空
 *   - R7 qualityLevel 与 passed 一致
 *   - R8 reportId 格式 ^RC-[a-z0-9]+-\d+-\d+$
 *   - R9 多角度场景 partialReports 非空
 *   - R10 多角度场景 reality-checker confidence ≥ 0.5
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRootCauseReport, type RootCauseReportShape } from '../root-cause-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'rootcause');

async function loadSample(file: string): Promise<RootCauseReportShape> {
  const raw = await fs.readFile(path.join(samplesDir, file), 'utf-8');
  return JSON.parse(raw);
}

describe('R1 Schema 完整性', () => {
  it('缺 rootCause 字段时失败', async () => {
    const report = await loadSample('bad-r1-missing-fields.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootCause/.test(r))).toBe(true);
  });
});

describe('R2 rootCauseChain 长度', () => {
  it('chain 仅 1 步时失败', async () => {
    const report = await loadSample('bad-r2-chain-length.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootCauseChain.*长度/.test(r))).toBe(true);
  });
});

describe('R3 falsifiabilityCheck 句式', () => {
  it('无「若...则」句式时失败', async () => {
    const report = await loadSample('bad-r3-falsifiability.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /falsifiabilityCheck.*若.*则/.test(r))).toBe(true);
  });
});

describe('R4 fixRecommendation 四字段', () => {
  it('缺 rationale 时失败', async () => {
    const report = await loadSample('bad-r4-fix-recommendation.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /fixRecommendation.*rationale/.test(r))).toBe(true);
  });
});

describe('R5 prevention 三字段', () => {
  it('缺 owner 时失败', async () => {
    const report = await loadSample('bad-r5-prevention.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /prevention.*owner/.test(r))).toBe(true);
  });
});

describe('R6 upstreamDefect 后续字段', () => {
  it('present=true 但缺 upstreamPhase 时失败', async () => {
    const report = await loadSample('bad-r6-upstream-defect.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /upstreamDefect.*upstreamPhase/.test(r))).toBe(true);
  });
});

describe('R7 qualityLevel 与 passed 一致', () => {
  it('qualityLevel=C 但 passed=true 时失败', async () => {
    const report = await loadSample('bad-r7-quality-level.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /qualityLevel.*passed.*一致/.test(r))).toBe(true);
  });
});

describe('R8 reportId 格式', () => {
  it('reportId 含下划线时失败', async () => {
    const report = await loadSample('bad-r8-report-id.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /reportId.*格式/.test(r))).toBe(true);
  });
});

describe('R9 多角度场景 partialReports', () => {
  it('method=combined 但无 partialReports 时失败', async () => {
    const report = await loadSample('bad-r9-partial-missing.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /partialReports.*非空/.test(r))).toBe(true);
  });
});

describe('R10 reality-checker confidence', () => {
  it('reality-checker confidence=0.3 时失败', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /reality-checker.*confidence/.test(r))).toBe(true);
  });
});

describe('valid 样本', () => {
  it('完整合规样本通过', async () => {
    const report = await loadSample('valid.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});
