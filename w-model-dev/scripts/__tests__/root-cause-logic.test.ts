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
 *   - R10 多角度场景 testing-reality-checker canonical / reality-checker legacy confidence ≥ 0.5
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkRootCauseReport, type RootCauseReportShape } from '../logic/root-cause-logic.js';

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
    expect(result.reasons.some((r) => /rootCause/.test(r))).toBe(true);
  });
});

describe('R2 rootCauseChain 长度', () => {
  it('chain 仅 1 步时失败', async () => {
    const report = await loadSample('bad-r2-chain-length.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    // schema minItems:2 前置拦截 1 步链（[schema] 前缀），业务规则长度校验不再触达
    expect(result.reasons.some((r) => /\[schema\].*rootCauseChain/.test(r))).toBe(true);
  });
});

describe('R3 falsifiabilityCheck 句式', () => {
  it('无「若...则」句式时失败', async () => {
    const report = await loadSample('bad-r3-falsifiability.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /falsifiabilityCheck.*若.*则/.test(r))).toBe(true);
  });
});

describe('R4 fixRecommendation 四字段', () => {
  it('缺 rationale 时失败', async () => {
    const report = await loadSample('bad-r4-fix-recommendation.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /fixRecommendation.*rationale/.test(r))).toBe(true);
  });
});

describe('R5 prevention 三字段', () => {
  it('缺 owner 时失败', async () => {
    const report = await loadSample('bad-r5-prevention.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /prevention.*owner/.test(r))).toBe(true);
  });
});

describe('R6 upstreamDefect 后续字段', () => {
  it('present=true 但缺 upstreamPhase 时失败', async () => {
    const report = await loadSample('bad-r6-upstream-defect.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /upstreamDefect.*upstreamPhase/.test(r))).toBe(true);
  });
});

describe('R7 qualityLevel 与 passed 一致', () => {
  it('qualityLevel=C 但 passed=true 时失败', async () => {
    const report = await loadSample('bad-r7-quality-level.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /qualityLevel.*passed.*一致/.test(r))).toBe(true);
  });
});

describe('R8 reportId 格式', () => {
  it('reportId 含下划线时失败', async () => {
    const report = await loadSample('bad-r8-report-id.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /reportId.*格式/.test(r))).toBe(true);
  });
});

describe('R9 多角度场景 partialReports', () => {
  it('method=combined 但无 partialReports 时失败', async () => {
    const report = await loadSample('bad-r9-partial-missing.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /partialReports.*非空/.test(r))).toBe(true);
  });
});

describe('R10 reality-checker confidence', () => {
  it('reality-checker confidence=0.3 时失败', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /reality-checker.*confidence/.test(r))).toBe(true);
  });

  it('combined 方法 partialReports 缺失 reality-checker 时失败', async () => {
    const report = await loadSample('bad-r10-no-reality-checker.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(
      result.reasons.some((r) => /R10.*缺失 reality checker.*testing-reality-checker.*reality-checker/.test(r)),
    ).toBe(true);
  });

  it('canonical testing-reality-checker confidence 足够时通过', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    report.partialReports = [
      {
        personaSlice: 'testing-reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json',
        confidence: 0.8,
      },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('legacy reality-checker confidence 足够时仍通过', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    report.partialReports = [
      {
        personaSlice: 'reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json',
        confidence: 0.8,
      },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('canonical 与指向同一 artifact 的 legacy 条目不虚增 persona 语义并通过', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const realityPath = '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json';
    report.partialReports = [
      { personaSlice: 'testing-reality-checker', path: realityPath, confidence: 0.8 },
      { personaSlice: 'reality-checker', path: realityPath, confidence: 0.2 },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('canonical 与指向不同 artifact 的 legacy 条目冲突时 fail-closed', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    report.partialReports = [
      {
        personaSlice: 'testing-reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json',
        confidence: 0.8,
      },
      {
        personaSlice: 'reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/reality-checker.json',
        confidence: 0.8,
      },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /R10.*冲突|R10.*conflict/i.test(r))).toBe(true);
  });

  it('canonical confidence 不足时不被高 confidence legacy alias 绕过', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const realityPath = '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json';
    report.partialReports = [
      { personaSlice: 'testing-reality-checker', path: realityPath, confidence: 0.3 },
      { personaSlice: 'reality-checker', path: realityPath, confidence: 0.9 },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /testing-reality-checker.*confidence/.test(r))).toBe(true);
  });

  it('两个 canonical testing-reality-checker 条目按 canonical duplicate fail-closed', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    report.partialReports = [
      {
        personaSlice: 'testing-reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker-a.json',
        confidence: 0.8,
      },
      {
        personaSlice: 'testing-reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker-b.json',
        confidence: 0.9,
      },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => /重复|duplicate/i.test(reason))).toBe(true);
    expect(result.reasons.some((reason) => /canonical=2/.test(reason))).toBe(true);
    expect(result.reasons.some((reason) => /legacy=0/.test(reason))).toBe(true);
  });

  it('两个 legacy reality-checker 条目按 legacy duplicate fail-closed', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    report.partialReports = [
      {
        personaSlice: 'reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/reality-checker-a.json',
        confidence: 0.8,
      },
      {
        personaSlice: 'reality-checker',
        path: '.w-model/rootcause/partial/RC-phase5-1-01/reality-checker-b.json',
        confidence: 0.9,
      },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => /重复|duplicate/i.test(reason))).toBe(true);
    expect(result.reasons.some((reason) => /canonical=0/.test(reason))).toBe(true);
    expect(result.reasons.some((reason) => /legacy=2/.test(reason))).toBe(true);
  });

  it('同 artifact canonical 高 confidence 优先于 legacy 低 confidence', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const realityPath = '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json';
    report.partialReports = [
      { personaSlice: 'testing-reality-checker', path: realityPath, confidence: 0.8 },
      { personaSlice: 'reality-checker', path: realityPath, confidence: 0.2 },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('valid 样本', () => {
  it('完整合规样本通过', async () => {
    const report = await loadSample('valid.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('调查与缓解证据完整的 noRootCause 合法出口通过', async () => {
    const report = await loadSample('valid-no-root-cause.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('noRootCause 合法出口', () => {
  it('无调查记录的 noRootCause 宣告失败并指向 investigation', async () => {
    const report = await loadSample('bad-no-root-cause-missing-investigation.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => /noRootCause.*investigation/.test(reason))).toBe(true);
  });
});
