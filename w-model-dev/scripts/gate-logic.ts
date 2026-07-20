export interface RTMRowShape {
  requirementId: string;
  description: string;
  designDoc: string;
  codeModule: string;
  unitTest: string;
  integrationTest: string;
  systemTest: string;
  acceptanceTest: string;
  coverageStatus?: '100%' | '部分' | '待覆盖';
}

export interface RTMMatrixShape {
  rows: RTMRowShape[];
  executionSummary: {
    unitTest: TestSummaryShape;
    integrationTest: TestSummaryShape;
    systemTest: TestSummaryShape;
    acceptanceTest: TestSummaryShape;
  };
}

export interface TestSummaryShape {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  coverage: number;
}

export interface ArtifactGateResult {
  passed: boolean;
  reasons: string[];
  coveragePercent: number;
  missingItems: Array<{ requirementId: string; fields: string[] }>;
  unitCoveragePercent: number;
}

const REQUIRED_TRACE_FIELDS: Array<keyof RTMRowShape> = [
  'description',
  'designDoc',
  'codeModule',
  'unitTest',
  'integrationTest',
  'systemTest',
  'acceptanceTest',
];

function failureResult(reasons: string[], coveragePercent = 0): ArtifactGateResult {
  return { passed: false, reasons, coveragePercent, missingItems: [], unitCoveragePercent: 0 };
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

export function checkArtifactGate(
  matrix: RTMMatrixShape | null | undefined,
): ArtifactGateResult {
  if (!matrix) return failureResult(['RTM 未初始化']);

  const reasons: string[] = [];
  if (!Array.isArray(matrix.rows)) reasons.push('RTM 结构错误：rows 字段缺失或非数组');
  if (!matrix.executionSummary || typeof matrix.executionSummary !== 'object') {
    reasons.push('RTM 结构错误：executionSummary 字段缺失或非对象');
  }
  if (reasons.length > 0) return failureResult(reasons);

  const requiredTestTypes: Array<{ key: keyof RTMMatrixShape['executionSummary']; name: string }> = [
    { key: 'unitTest', name: '单元测试' },
    { key: 'integrationTest', name: '集成测试' },
    { key: 'systemTest', name: '系统测试' },
    { key: 'acceptanceTest', name: '验收测试' },
  ];
  const summaries: Array<{ name: string; summary: TestSummaryShape | undefined }> = [];

  for (const { key, name } of requiredTestTypes) {
    const summary = matrix.executionSummary[key];
    if (!summary || typeof summary !== 'object') {
      reasons.push(`RTM 结构错误：executionSummary.${key}（${name}汇总）缺失或非对象`);
    }
    summaries.push({ name, summary });
  }

  const missingItems: Array<{ requirementId: string; fields: string[] }> = [];
  const ids = new Set<string>();
  for (let index = 0; index < matrix.rows.length; index++) {
    const row = matrix.rows[index];
    if (!row || typeof row !== 'object') {
      reasons.push(`RTM 结构错误：rows[${index}] 非对象`);
      continue;
    }
    if (typeof row.requirementId !== 'string' || row.requirementId.trim() === '') {
      reasons.push(`RTM 结构错误：rows[${index}].requirementId 必须为非空字符串`);
      continue;
    }
    if (ids.has(row.requirementId)) {
      reasons.push(`RTM 结构错误：需求 ID 重复（${row.requirementId}）`);
    }
    ids.add(row.requirementId);
    const missing = REQUIRED_TRACE_FIELDS.filter(field => typeof row[field] !== 'string' || row[field].trim() === '');
    if (missing.length > 0) missingItems.push({ requirementId: row.requirementId, fields: missing });
  }

  for (const item of missingItems) {
    reasons.push(`RTM 追溯不完整：${item.requirementId} 缺少 ${item.fields.join('、')}`);
  }

  const totalRows = matrix.rows.length;
  const coveredRows = totalRows - missingItems.length;
  const coveragePercent = totalRows > 0 ? Math.round((coveredRows / totalRows) * 100) : 0;
  if (coveragePercent < 100) reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  if (totalRows === 0) reasons.push('RTM 无需求行');

  let unitCoveragePercent = 0;
  for (const { name, summary } of summaries) {
    if (!summary || typeof summary !== 'object') continue;
    const values = [summary.total, summary.passed, summary.failed, summary.pending];
    if (!values.every(isFiniteNonNegativeInteger)) {
      reasons.push(`${name}: total/passed/failed/pending 必须为非负整数`);
      continue;
    }
    if (summary.passed + summary.failed + summary.pending !== summary.total) {
      reasons.push(`${name}: passed + failed + pending 必须等于 total`);
    }
    if (summary.total === 0) reasons.push(`${name}: 无用例`);
    if (summary.failed > 0) reasons.push(`${name}: ${summary.failed} 个失败`);
    if (summary.pending > 0) reasons.push(`${name}: ${summary.pending} 个待执行`);
    if (typeof summary.coverage !== 'number' || !Number.isFinite(summary.coverage) || summary.coverage < 0 || summary.coverage > 100) {
      reasons.push(`${name}: coverage 必须为 [0,100] 范围内的有限数字`);
    }
    if (name === '单元测试' && typeof summary.coverage === 'number' && Number.isFinite(summary.coverage)) {
      unitCoveragePercent = summary.coverage;
      if (summary.coverage < 80) reasons.push(`单元测试代码覆盖率未达 80%（当前 ${summary.coverage}%）`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    coveragePercent,
    missingItems,
    unitCoveragePercent,
  };
}
