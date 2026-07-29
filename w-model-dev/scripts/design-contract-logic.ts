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
  for (const mapping of input.uatPathMappings) {
    if (!mapping.actualPath || mapping.actualPath.trim() === '') {
      continue; // 未回填的跳过（阶段 5 前允许空）
    }
    if (mapping.actualPath === '横切') {
      continue; // NFR/CON 横切豁免
    }
    const found = input.routeDefinitions.some(
      (route) => route.path === mapping.actualPath,
    );
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

  // D2 参数一致性：验收测试使用的参数名须与路由定义一致
  for (const assertion of input.acceptanceAssertions) {
    const route = input.routeDefinitions.find(
      (r) => r.path === assertion.path && r.method === assertion.method,
    );
    if (!route) continue;
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
  for (const assertion of input.acceptanceAssertions) {
    const route = input.routeDefinitions.find(
      (r) => r.path === assertion.path && r.method === assertion.method,
    );
    if (!route) continue;
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
  for (const assertion of input.acceptanceAssertions) {
    const route = input.routeDefinitions.find(
      (r) => r.path === assertion.path && r.method === assertion.method,
    );
    if (!route) continue;
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
