/**
 * root-cause-logic.ts 单元测试 —— R 报告校验 R1-R11 规则
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
 *   - R11 多角度场景 personaSlice 须为矩阵内已知 persona，且与 rootCause.category 行有交集
 *
 * 同质用例已按「循环内多断言 + 逐行具名消息」聚合（wave 3 第 B 批）；
 * R1-R10 负例族为 NEGATIVE-COVERAGE fixture 载体：循环行键 = fixture 文件名，逐 fixture 具名。
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

describe('R1-R10 负例矩阵（bad-r*.json fixture 载体，逐 fixture 具名）', () => {
  // 循环行键 = fixture 文件名（NEGATIVE-COVERAGE 登记面：探针语义不变，逐 fixture 可定位）
  const BAD_FIXTURES: readonly [string, RegExp][] = [
    ['bad-r1-missing-fields.json', /rootCause/],
    // schema minItems:2 前置拦截 1 步链（[schema] 前缀），业务规则长度校验不再触达
    ['bad-r2-chain-length.json', /\[schema\].*rootCauseChain/],
    ['bad-r3-falsifiability.json', /falsifiabilityCheck.*若.*则/],
    ['bad-r4-fix-recommendation.json', /fixRecommendation.*rationale/],
    ['bad-r5-prevention.json', /prevention.*owner/],
    ['bad-r6-upstream-defect.json', /upstreamDefect.*upstreamPhase/],
    ['bad-r7-quality-level.json', /qualityLevel.*passed.*一致/],
    ['bad-r8-report-id.json', /reportId.*格式/],
    ['bad-r9-partial-missing.json', /partialReports.*非空/],
    ['bad-r10-reality-confidence.json', /reality-checker.*confidence/],
    ['bad-r10-no-reality-checker.json', /R10.*缺失 reality checker.*testing-reality-checker.*reality-checker/],
  ];

  it(`R1-R10 负例矩阵（${BAD_FIXTURES.length} 个 bad-r*.json fixture）逐 fixture fail`, async () => {
    for (const [fixture, pattern] of BAD_FIXTURES) {
      const report = await loadSample(fixture);
      const result = checkRootCauseReport(report);
      expect(result.passed, `${fixture} 应 fail`).toBe(false);
      expect(
        result.reasons.some((r) => pattern.test(r)),
        `${fixture} 应报 ${pattern}`,
      ).toBe(true);
    }
  });
});

describe('R10 reality-checker confidence', () => {
  const realityPath = '.w-model/rootcause/partial/RC-phase5-1-01/testing-reality-checker.json';

  it('confidence 对照对（2 态：canonical / legacy confidence 足够时通过）', async () => {
    const rows: readonly [string, NonNullable<RootCauseReportShape['partialReports']>][] = [
      [
        'canonical testing-reality-checker confidence 足够',
        [{ personaSlice: 'testing-reality-checker', path: realityPath, confidence: 0.8 }],
      ],
      [
        'legacy reality-checker confidence 足够',
        [{ personaSlice: 'reality-checker', path: realityPath, confidence: 0.8 }],
      ],
    ];
    for (const [name, partialReports] of rows) {
      const report = await loadSample('bad-r10-reality-confidence.json');
      report.partialReports = partialReports;
      const result = checkRootCauseReport(report);
      expect(result.passed, `${name} 应通过`).toBe(true);
      expect(result.reasons, `${name} 应无 reasons`).toHaveLength(0);
    }
  });

  it('canonical 与指向同一 artifact 的 legacy 条目不虚增 persona 语义并通过', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
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
    report.partialReports = [
      { personaSlice: 'testing-reality-checker', path: realityPath, confidence: 0.8 },
      { personaSlice: 'reality-checker', path: realityPath, confidence: 0.2 },
    ];

    const result = checkRootCauseReport(report);

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('R11 多角度 persona 选择矩阵', () => {
  it('R11 矩阵负例（2 个 bad-r11-*.json fixture 逐具名）→ fail', async () => {
    const rows: readonly [string, RegExp, ((result: ReturnType<typeof checkRootCauseReport>) => void) | null][] = [
      ['bad-r11-unknown-persona.json', /R11.*矩阵外 persona.*engineering-testability/, null],
      [
        'bad-r11-category-mismatch.json',
        /R11.*与 rootCause\.category=coding-error 的矩阵行无交集/,
        // 视角本身都是已知 persona：不因「矩阵外」而失败，只命中交集规则
        (result) => {
          expect(
            result.reasons.some((r) => /R11.*矩阵外/.test(r)),
            'bad-r11-category-mismatch.json 不应报「矩阵外」',
          ).toBe(false);
        },
      ],
    ];
    for (const [fixture, pattern, extra] of rows) {
      const report = await loadSample(fixture);
      const result = checkRootCauseReport(report);
      expect(result.passed, `${fixture} 应 fail`).toBe(false);
      expect(
        result.reasons.some((r) => pattern.test(r)),
        `${fixture} 应报 ${pattern}`,
      ).toBe(true);
      if (extra) extra(result);
    }
  });

  it('R10 样本不误报 R11（仅触发目标规则）', async () => {
    const report = await loadSample('bad-r10-no-reality-checker.json');
    const result = checkRootCauseReport(report);
    expect(result.reasons.filter((r) => /^R11:/.test(r))).toHaveLength(0);
    expect(result.reasons.filter((r) => /^R10:/.test(r))).toHaveLength(1);
  });

  it('legacy reality-checker 归一化后满足第一键行交集', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const result = checkRootCauseReport(report);
    // 该样本仅 R10 置信度不达标；R11 不应因 legacy 名称而报「矩阵外」
    expect(result.reasons.some((r) => /R11/.test(r))).toBe(false);
    expect(result.reasons.some((r) => /R10.*confidence/.test(r))).toBe(true);
  });

  // 全 7 行负载性（2026-09-17 审查修复）：此前仅 design-flaw / coding-error 两行被钉住，
  // 变异实验证明把 tool-gap 行换成任意两个真实 persona 后 27 个用例仍全绿。
  // 这里用「本行任一 persona + reality-checker」与「仅 reality-checker」两臂覆盖全部 7 行。
  const ROW_PERSONAS: Array<[string, string[]]> = [
    ['coding-error', ['engineering-code-reviewer', 'engineering-senior-developer', 'testing-evidence-collector']],
    [
      'design-flaw',
      ['engineering-software-architect', 'engineering-backend-architect', 'engineering-frontend-developer'],
    ],
    ['requirement-gap', ['product-manager', 'product-feedback-synthesizer']],
    ['test-gap', ['testing-api-tester', 'testing-performance-benchmarker', 'testing-test-results-analyzer']],
    [
      'process-missing',
      ['project-manager-senior', 'testing-workflow-optimizer', 'engineering-incident-response-commander'],
    ],
    ['tool-gap', ['engineering-autonomous-optimization-architect', 'testing-tool-evaluator']],
    [
      'upstream-defect',
      [
        'engineering-incident-response-commander',
        'engineering-codebase-onboarding-engineer',
        'engineering-technical-writer',
      ],
    ],
  ];

  it(`R11 第一键行负载性：含本行任一 persona 即通过（${ROW_PERSONAS.length} 行循环，category 具名）`, async () => {
    for (const [category, personas] of ROW_PERSONAS) {
      const report = await loadSample('bad-r10-reality-confidence.json');
      (report.rootCause as { category: string }).category = category;
      report.partialReports = [
        { personaSlice: personas[0]!, path: `.w-model/rootcause/partial/RC-x/${personas[0]!}.json`, confidence: 0.9 },
        {
          personaSlice: 'testing-reality-checker',
          path: '.w-model/rootcause/partial/RC-x/testing-reality-checker.json',
          confidence: 0.9,
        },
      ];
      const result = checkRootCauseReport(report);
      expect(
        result.reasons.filter((r) => /R11/.test(r)),
        `category=${category} 含本行 persona 应通过 R11`,
      ).toEqual([]);
    }
  });

  // 负向臂只取「行内本就含 reality-checker 之外、且不含 reality-checker」的 5 行：
  // design-flaw 与 requirement-gap 的**矩阵行确实含 testing-reality-checker**（见 agent-personas.md §2），
  // 故对这两行「仅 reality-checker」是合法视角，不应拦截（首版测试按错名单断言，已修正）。
  const NEGATIVE_ARM_CATEGORIES = [
    'coding-error',
    'test-gap',
    'process-missing',
    'tool-gap',
    'upstream-defect',
  ] as const;

  it(`R11 第一键行：仅 reality-checker（不在本行）即拦截（${NEGATIVE_ARM_CATEGORIES.length} 行循环，category 具名）`, async () => {
    for (const category of NEGATIVE_ARM_CATEGORIES) {
      const report = await loadSample('bad-r10-reality-confidence.json');
      (report.rootCause as { category: string }).category = category;
      report.partialReports = [
        {
          personaSlice: 'testing-reality-checker',
          path: '.w-model/rootcause/partial/RC-x/testing-reality-checker.json',
          confidence: 0.9,
        },
      ];
      const result = checkRootCauseReport(report);
      expect(
        result.reasons.some((r) => /R11.*与 rootCause\.category=.*的矩阵行无交集/.test(r)),
        `category=${category} 仅 reality-checker 应被拦截`,
      ).toBe(true);
    }
  });

  it('noRootCause 分支无 category，不进入 R11', async () => {
    const report = await loadSample('valid-no-root-cause.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(true);
    expect(result.reasons.filter((r) => /R11/.test(r))).toHaveLength(0);
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
