// w-model-dev/scripts/logic/coverage-scope-logic.ts
/**
 * 规则层覆盖口径计算（coverage-final.json → logic+lib 白名单分母）。
 *
 * 背景（2026-09-17 审计 B 项）：vitest v8 provider 对被 import 的文件总是出报告，
 * `coverage.include` 只影响未触及文件，导致全量运行分母混入 cli/application/infrastructure 层；
 * 两种 `exclude` 写法全量运行均不生效（机制未查明）。本模块绕开报告器行为：
 * 直接对 istanbul-lib-coverage 格式（v8 provider 的 coverage/coverage-final.json）
 * 按白名单前缀重算四指标，供 check-coverage-scope.ts 门禁与 O 选文件复用。
 *
 * 计数口径（istanbul 惯例）：
 *   statements = s 值 > 0 的键数 / s 键总数；
 *   functions  = f 值 > 0 的键数 / f 键总数；
 *   branches   = b 值数组中 > 0 的元素数 / 数组元素总数；
 *   lines      = statementMap 中出现过的行集合为分母，其上有任一 s>0 语句的行集合为分子。
 * 合并值 = 各文件 covered/total 求和后再算百分比（加权，不是百分比平均）。
 */

export class CoverageScopeFormatError extends Error {
  constructor(detail: string) {
    super(`coverage-final.json 格式不符（istanbul-lib-coverage 期待 s/b/f/statementMap）: ${detail}`);
    this.name = 'CoverageScopeFormatError';
  }
}

export interface CoverageScopeThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}
export interface CoverageScopeMetrics {
  covered: number;
  total: number;
  pct: number;
}
export interface CoverageScopeFileReport {
  /** 显示路径（正斜杠，取 w-model-dev/scripts/ 之后的相对后缀，如 logic/foo-logic.ts） */
  file: string;
  statements: CoverageScopeMetrics;
  branches: CoverageScopeMetrics;
  functions: CoverageScopeMetrics;
  lines: CoverageScopeMetrics;
}
export interface CoverageScopeReport {
  fileCount: number;
  totals: CoverageScopeThresholds;
  files: CoverageScopeFileReport[];
  failures: string[];
  passed: boolean;
}

function isIncluded(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, '/').toLowerCase();
  return norm.includes('/w-model-dev/scripts/logic/') || norm.includes('/w-model-dev/scripts/lib/');
}

function toDisplayFile(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/');
  const marker = '/w-model-dev/scripts/';
  const idx = norm.toLowerCase().indexOf(marker);
  // isIncluded 已保证白名单路径必含 marker；idx<0 的兜底分支仅为防御性保留。
  return idx < 0 ? norm : norm.slice(idx + marker.length);
}

function pct(covered: number, total: number): number {
  if (total === 0) return 100;
  return Math.round(((covered * 100) / total) * 100) / 100;
}

function asRecord(v: unknown, what: string, file: string): Record<string, unknown> {
  if (v === undefined || v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new CoverageScopeFormatError(`${file} 缺 ${what}`);
  }
  return v as Record<string, unknown>;
}

function metrics(covered: number, total: number): CoverageScopeMetrics {
  return { covered, total, pct: pct(covered, total) };
}

function fileMetrics(file: string, raw: unknown): CoverageScopeFileReport {
  const cv = asRecord(raw, '条目对象', file);
  const s = asRecord(cv.s, 's', file);
  const f = asRecord(cv.f, 'f', file);
  const b = asRecord(cv.b, 'b', file);
  const statementMap = asRecord(cv.statementMap, 'statementMap', file);

  let sCov = 0;
  let sTot = 0;
  let fCov = 0;
  let fTot = 0;
  let bCov = 0;
  let bTot = 0;
  for (const v of Object.values(s)) {
    if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} s 值非数字`);
    sTot += 1;
    if (v > 0) sCov += 1;
  }
  for (const v of Object.values(f)) {
    if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} f 值非数字`);
    fTot += 1;
    if (v > 0) fCov += 1;
  }
  for (const arr of Object.values(b)) {
    if (!Array.isArray(arr)) throw new CoverageScopeFormatError(`${file} b 值非数组`);
    for (const v of arr) {
      if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} b 元素非数字`);
      bTot += 1;
      if (v > 0) bCov += 1;
    }
  }
  const lineTotal = new Set<number>();
  const lineCovered = new Set<number>();
  for (const [id, loc] of Object.entries(statementMap)) {
    const line = (loc as { start?: { line?: unknown } } | undefined)?.start?.line;
    if (typeof line !== 'number') throw new CoverageScopeFormatError(`${file} statementMap[${id}] 无 start.line`);
    lineTotal.add(line);
    const hit = s[id];
    if (typeof hit === 'number' && hit > 0) lineCovered.add(line);
  }
  return {
    file,
    statements: metrics(sCov, sTot),
    functions: metrics(fCov, fTot),
    branches: metrics(bCov, bTot),
    lines: metrics(lineCovered.size, lineTotal.size),
  };
}

function mergeTotals(files: CoverageScopeFileReport[]): CoverageScopeThresholds {
  const sum = (pick: (f: CoverageScopeFileReport) => CoverageScopeMetrics) =>
    files.reduce(
      (acc, f) => {
        const m = pick(f);
        acc.c += m.covered;
        acc.t += m.total;
        return acc;
      },
      { c: 0, t: 0 },
    );
  const st = sum((f) => f.statements);
  const br = sum((f) => f.branches);
  const fu = sum((f) => f.functions);
  const li = sum((f) => f.lines);
  return { statements: pct(st.c, st.t), branches: pct(br.c, br.t), functions: pct(fu.c, fu.t), lines: pct(li.c, li.t) };
}

export function computeCoverageScope(report: unknown, thresholds: CoverageScopeThresholds): CoverageScopeReport {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new CoverageScopeFormatError('根对象不是 object');
  }
  const files: CoverageScopeFileReport[] = [];
  for (const [absPath, raw] of Object.entries(report as Record<string, unknown>)) {
    if (!isIncluded(absPath)) continue;
    files.push(fileMetrics(toDisplayFile(absPath), raw));
  }
  // 输出顺序确定性：门禁 JSON（COVERAGE_SCOPE_JSON 的 files 数组）逐字节可复现，按显示路径 localeCompare 升序。
  files.sort((a, b) => a.file.localeCompare(b.file));
  const totals = mergeTotals(files);
  const label: Record<keyof CoverageScopeThresholds, string> = {
    statements: 'statements',
    branches: 'branches',
    functions: 'functions',
    lines: 'lines',
  };
  const failures: string[] = [];
  for (const key of Object.keys(label) as Array<keyof CoverageScopeThresholds>) {
    if (totals[key] < thresholds[key]) {
      failures.push(`${key} ${totals[key]} < 阈值 ${thresholds[key]}`);
    }
  }
  return { fileCount: files.length, totals, files, failures, passed: files.length > 0 && failures.length === 0 };
}
