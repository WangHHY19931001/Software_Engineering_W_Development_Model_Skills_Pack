/**
 * 设计契约一致性校验纯逻辑层（Design Contract Consistency Logic）
 *
 * 对应 SSoT §10I「设计契约一致性校验」。
 * 供 check-design-contract-consistency.ts（CLI）调用，校验编码与验收设计一致性。
 *
 * 单点事实源，不依赖任何 LLM。
 */

import { validateBySchema } from './schema-loader.js';

// ==================== 类型定义 ====================

export interface DesignContractViolation {
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  severity: 'error' | 'warning';
  message: string;
  expected: string;
  actual: string;
}

export interface DesignContractCheckResult {
  passed: boolean;
  reasons: string[];
  violations: DesignContractViolation[];
}

// ==================== 输入类型 ====================

export interface UatPathMapping {
  uatId: string;
  designPath: string;
  actualPath: string;
  mappingType?: '直接' | '等价' | '替代';
}

// ==================== uat-path-mapping.md 表格解析 ====================

export interface UatPathMappingParseRow {
  uatId: string;
  /** 原始单元格（cells[0]=uatId，cells[1]=设计路径，cells[2]=实际路径，cells[3]=映射类型），供调用方各自映射字段 */
  cells: string[];
}

export interface UatPathMappingParseResult {
  rows: UatPathMappingParseRow[];
  violations: string[];
}

/**
 * 从 uat-path-mapping.md 内容解析映射行（严格 / 宽松双语义，strict 开关控制）。
 *
 * 统一解析基线（两种模式一致）：
 * - 逐行 trim 后非空且以 `|` 开头才可能是表格行（标题 / 说明段落跳过）；
 * - `|` 切分 + 去首尾空串得到 cells；首列须匹配 `UAT-\d+`（表头 / 分隔行 / 其它表格行忽略）；
 * - 结构性畸形：单元格数 < 4 → 畸形行。
 *
 * 空单元格（前 4 列任一为空）语义按 strict 分流：
 * - strict=true（对齐 check-artifact-gate 严格版）：判畸形 push violation（文案与行号格式逐字节一致），
 *   文件非空但解析不出映射行 → violation「uat-path-mapping 无有效映射行」；
 * - strict=false（默认，对齐 check-design-contract-consistency 宽松版）：接受该行（cells 原样入 rows，
 *   空字段由调用方按自身语义消费——宽松整行正则同样会把空列解析为空字段），不产生 violation。
 *
 * 返回 rows 保留原始 cells，字段映射由调用方按各自消费语义完成。
 * 纯字符串处理，不读文件（*-logic.ts 纯逻辑层约束）。
 */
export function parseUatPathMappingContent(content: string, opts?: { strict?: boolean }): UatPathMappingParseResult {
  const strict = opts?.strict ?? false;
  const rows: UatPathMappingParseRow[] = [];
  const violations: string[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (line === '' || !line.startsWith('|')) continue; // 非表格行（标题 / 说明段落）
    let cells = line.split('|').map((c) => c.trim());
    cells = cells.slice(1); // 去掉行首 '|' 前的空串
    if (cells.length > 0 && cells[cells.length - 1] === '') {
      cells = cells.slice(0, -1); // 去掉行尾 '|' 产生的空串
    }
    const firstCol = cells[0] ?? '';
    // 表头校验：首列必须为 UAT- 前缀（表头 / 分隔行 / 其它表格一律忽略）
    if (!/^UAT-\d+$/.test(firstCol)) continue;
    const lineNo = i + 1;
    // 结构性畸形：单元格数须 ≥4（两种模式一致判畸形；strict 才报 violation）
    if (cells.length < 4) {
      if (strict) {
        violations.push(`uat-path-mapping 第${lineNo}行畸形（单元格数 ${cells.length}，须 ≥4）`);
      }
      continue;
    }
    const actualPath = cells[2] ?? '';
    const mappingType = cells[3] ?? '';
    // 空单元格：strict 判畸形（报 violation 跳过，对齐 artifact-gate 严格版）；
    // 非 strict 接受该行（保留空字段，对齐 design-contract 宽松整行正则的解析结果）
    if (cells[1] === '' || actualPath === '' || mappingType === '') {
      if (strict) {
        violations.push(`uat-path-mapping 第${lineNo}行畸形（含空单元格）`);
        continue;
      }
    }
    rows.push({ uatId: firstCol, cells });
  }
  // 文件非空但解析不出任何映射行 → violation「uat-path-mapping 无有效映射行」（仅严格模式，对齐 artifact-gate）
  if (strict && rows.length === 0 && content.trim() !== '') {
    violations.push('uat-path-mapping 无有效映射行');
  }
  return { rows, violations };
}

export interface RouteDefinition {
  method: string;
  path: string;
  params: string[];
  successStatus: number;
  responseFields: string[];
}

export interface AcceptanceTestAssertion {
  uatId: string;
  method: string;
  path: string;
  params: string[];
  expectedStatus: number;
  assertedFields: string[];
}

export interface DesignContractCheckInput {
  uatPathMappings: UatPathMapping[];
  routeDefinitions: RouteDefinition[];
  acceptanceAssertions: AcceptanceTestAssertion[];
}

// ==================== 主校验函数 ====================

/**
 * 校验编码与验收设计一致性。
 *
 * @param input 设计契约校验输入（路径映射 + 路由定义 + 验收断言）
 * @returns 校验结果（passed + reasons + violations）
 */
export function checkDesignContractConsistency(
  input: DesignContractCheckInput | null | undefined,
): DesignContractCheckResult {
  if (!input) {
    return {
      passed: false,
      reasons: ['设计契约输入为空'],
      violations: [],
    };
  }

  // Schema 前置校验（反模式 #28）
  const schemaResult = validateBySchema('design-contract', input);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      violations: [],
    };
  }

  const violations: DesignContractViolation[] = [];

  // D1 路径一致性：映射表中「实际路径」须在路由定义中存在
  // actualPath 可能是纯路径 "/api/posts" 或含方法前缀 "POST /api/posts"
  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  function stripMethodPrefix(p: string): string {
    const parts = p.trim().split(/\s+/);
    const first = parts[0];
    if (parts.length >= 2 && first !== undefined && HTTP_METHODS.includes(first.toUpperCase())) {
      return parts.slice(1).join(' ');
    }
    return p.trim();
  }

  const data = input;

  // D1 实际路径语义归一（多端点组合 / 括号说明 / 非 HTTP 豁免）：
  // - 一行 UAT 可覆盖多端点，actualPath 以「、」/「,」/「，」分隔（如 "PUT /api/posts、DELETE /api/posts"），逐项匹配；
  // - 端点名可带括号说明（如 "POST /api/posts/:id/publish（触发 Webhook 分发）"），匹配前剥离全/半角括号；
  // - 具体请求实例（如 "GET /api/articles/art-nonexist（404 兜底）"）按路由参数模板段级匹配（/api/articles/:id 命中）；
  // - "不适用（...）" 行与 "横切" 同语义豁免（无 HTTP 路由断言）。
  function stripBrackets(p: string): string {
    return p
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
  }
  function normalizeActualPathVariants(raw: string): string[] {
    return raw
      .split(/[、，,]/)
      .map((p) => stripMethodPrefix(stripBrackets(p)))
      .map((p) => p.trim())
      .filter((p) => p !== '');
  }
  function pathTemplateMatches(template: string, concrete: string): boolean {
    const t = template.split('/');
    const c = concrete.split('/');
    if (t.length !== c.length) return false;
    for (let i = 0; i < t.length; i++) {
      const seg = t[i]!;
      if (seg.startsWith(':')) continue;
      if (seg !== c[i]) return false;
    }
    return true;
  }
  function isDefinedRoute(p: string): boolean {
    return data.routeDefinitions.some((route) => route.path === p || pathTemplateMatches(route.path, p));
  }

  for (const mapping of data.uatPathMappings) {
    if (!mapping.actualPath || mapping.actualPath.trim() === '') {
      continue; // 未回填的跳过（阶段 5 前允许空）
    }
    if (mapping.actualPath === '横切' || mapping.actualPath.startsWith('不适用')) {
      continue; // NFR/CON 横切豁免 / 非 HTTP 用例（无路由断言）豁免
    }
    const normalizedPaths = normalizeActualPathVariants(mapping.actualPath);
    const found = normalizedPaths.length > 0 && normalizedPaths.every(isDefinedRoute);
    if (!found) {
      violations.push({
        dimension: 'D1',
        severity: 'error',
        message: `UAT 路径映射 ${mapping.uatId} 的实际路径 "${mapping.actualPath}" 在路由定义中不存在`,
        expected: mapping.actualPath,
        actual: '路由定义中未找到',
      });
    }
  }

  function normalizePath(p: string): string {
    let normalized = p.replace(/\?.*$/, '');
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  function findRoute(method: string, path: string): RouteDefinition | undefined {
    const np = normalizePath(path);
    return data.routeDefinitions.find((r) => r.method === method && normalizePath(r.path) === np);
  }

  // D2 参数一致性：验收测试使用的参数名须与路由定义一致
  for (const assertion of data.acceptanceAssertions) {
    const route = findRoute(assertion.method, assertion.path);
    if (!route) {
      violations.push({
        dimension: 'D2',
        severity: 'error',
        message: `路由 ${assertion.method} ${assertion.path} 未在路由定义中找到`,
        expected: `${assertion.method} ${assertion.path}`,
        actual: '路由定义中未找到',
      });
      continue;
    }
    for (const param of assertion.params) {
      if (!route.params.includes(param)) {
        violations.push({
          dimension: 'D2',
          severity: 'error',
          message: `验收断言 ${assertion.uatId} 使用参数 "${param}" 但路由 ${assertion.method} ${assertion.path} 定义中未包含该参数`,
          expected: param,
          actual: route.params.join(', '),
        });
      }
    }
  }

  // D3 状态码一致性：验收测试预期状态码须与路由实际返回一致
  for (const assertion of data.acceptanceAssertions) {
    const route = findRoute(assertion.method, assertion.path);
    if (!route) {
      violations.push({
        dimension: 'D3',
        severity: 'error',
        message: `路由 ${assertion.method} ${assertion.path} 未在路由定义中找到`,
        expected: `${assertion.method} ${assertion.path}`,
        actual: '路由定义中未找到',
      });
      continue;
    }
    if (assertion.expectedStatus !== route.successStatus) {
      violations.push({
        dimension: 'D3',
        severity: 'error',
        message: `验收断言 ${assertion.uatId} 预期状态码 ${assertion.expectedStatus} 但路由 ${assertion.method} ${assertion.path} 实际返回 ${route.successStatus}`,
        expected: String(assertion.expectedStatus),
        actual: String(route.successStatus),
      });
    }
  }

  // D4 响应字段一致性：验收测试断言字段须在实际响应体中存在
  for (const assertion of data.acceptanceAssertions) {
    const route = findRoute(assertion.method, assertion.path);
    if (!route) {
      violations.push({
        dimension: 'D4',
        severity: 'error',
        message: `路由 ${assertion.method} ${assertion.path} 未在路由定义中找到`,
        expected: `${assertion.method} ${assertion.path}`,
        actual: '路由定义中未找到',
      });
      continue;
    }
    for (const field of assertion.assertedFields) {
      if (!route.responseFields.includes(field)) {
        violations.push({
          dimension: 'D4',
          severity: 'error',
          message: `验收断言 ${assertion.uatId} 断言字段 "${field}" 但路由 ${assertion.method} ${assertion.path} 响应体中未包含该字段`,
          expected: field,
          actual: route.responseFields.join(', '),
        });
      }
    }
  }

  const reasons = violations.map((v) => `[${v.dimension}] ${v.message}`);
  return {
    passed: violations.length === 0,
    reasons,
    violations,
  };
}
