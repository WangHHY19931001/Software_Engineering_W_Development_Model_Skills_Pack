import { validateBySchema } from './schema-loader.js';

export interface IcebergFinding {
  findingId: string;
  severity: 'Critical' | 'Required' | 'Optional';
  category: 'same-root-cause-spread' | 'same-defect-class' | 'fix-induced-regression'
           | 'adjacent-logic' | 'coverage-gap' | 'cross-artifact-inconsistency';
  location: string;
  description: string;
  evidence: string;
  hypothesis: string;
  relatedFixedPoint: string;
}

export interface IcebergSweepReport {
  reportId: string;
  phase: string;
  triggerType: 'ICEBERG-A' | 'ICEBERG-B';
  icebergRound: number;
  sweptAt: string;
  sweptBy: string;
  线索来源: {
    reworkHintsHistory: string[];
    fixedPoints: string[];
    previousFindings: string[];
  };
  newFindings: IcebergFinding[];
  sweepCoverage: {
    sweptArtifacts: string[];
    sweptDimensions: ('completeness' | 'reliability' | 'security')[];
  };
  summary: string;
  passed: boolean;
}

export interface IcebergSweepCheckResult {
  passed: boolean;
  reasons: string[];
  reportSummary: {
    reportId: string;
    triggerType: string;
    icebergRound: number;
    newFindingsCount: number;
    passed: boolean;
  };
}

const MAX_ICEBERG_ROUNDS = 5;

export function checkIcebergSweep(report: IcebergSweepReport): IcebergSweepCheckResult {
  const reasons: string[] = [];
  // R1: schema 前置校验（反模式 #28）
  const schemaResult = validateBySchema('iceberg-sweep', report);
  if (!schemaResult.valid) {
    for (const msg of schemaResult.errorMessages) {
      reasons.push(`[schema] ${msg}`);
    }
  }
  // R5: icebergRound 边界（1-5）
  if (report.icebergRound < 1 || report.icebergRound > MAX_ICEBERG_ROUNDS) {
    reasons.push(`icebergRound 越界：${report.icebergRound}，须 1-${MAX_ICEBERG_ROUNDS}`);
  }
  // R6: newFindings 去重
  const prevSet = new Set(report.线索来源.previousFindings);
  for (const f of report.newFindings) {
    if (prevSet.has(f.findingId)) {
      reasons.push(`findingId 重复：${f.findingId} 已在上一轮发现`);
    }
    // R7: 可证伪 + 证据非空
    if (!f.hypothesis || !f.evidence) {
      reasons.push(`finding ${f.findingId} 缺 hypothesis 或 evidence（禁止空泛）`);
    }
  }
  // R8: passed 一致性
  const expectedPassed = report.newFindings.length === 0;
  if (report.passed !== expectedPassed) {
    reasons.push(`passed 不一致：newFindings=${report.newFindings.length} 但 passed=${report.passed}`);
  }
  return {
    passed: reasons.length === 0,
    reasons,
    reportSummary: {
      reportId: report.reportId,
      triggerType: report.triggerType,
      icebergRound: report.icebergRound,
      newFindingsCount: report.newFindings.length,
      passed: report.passed,
    },
  };
}
