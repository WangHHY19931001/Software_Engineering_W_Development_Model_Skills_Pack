import { describe, it, expect } from 'vitest';
import { checkDesignContractConsistency, type DesignContractCheckInput } from '../design-contract-logic.js';

function makeInput(overrides: Partial<DesignContractCheckInput> = {}): DesignContractCheckInput {
  return {
    uatPathMappings: [],
    routeDefinitions: [],
    acceptanceAssertions: [],
    ...overrides,
  };
}

describe('design-contract-logic', () => {

  describe('valid input', () => {
    it('空输入应通过', () => {
      const result = checkDesignContractConsistency(makeInput());
      expect(result.passed).toBe(true);
    });
  });

  describe('D8: 多路由不同状态码无交叉污染', () => {
    it('POST 201 和 GET 200 同文件中不会误报 D3', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'POST', path: '/api/posts', params: ['title'], successStatus: 201, responseFields: ['id'] },
          { method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-001', method: 'POST', path: '/api/posts', params: ['title'], expectedStatus: 201, assertedFields: ['id'] },
          { uatId: 'UAT-002', method: 'GET', path: '/api/posts', params: [], expectedStatus: 200, assertedFields: ['data'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('多路由不同 params/responseFields 各自独立', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'POST', path: '/api/posts', params: ['title', 'content'], successStatus: 201, responseFields: ['id', 'title'] },
          { method: 'GET', path: '/api/posts', params: ['page', 'size'], successStatus: 200, responseFields: ['data', 'total'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-001', method: 'POST', path: '/api/posts', params: ['title', 'content'], expectedStatus: 201, assertedFields: ['id', 'title'] },
          { uatId: 'UAT-002', method: 'GET', path: '/api/posts', params: ['page', 'size'], expectedStatus: 200, assertedFields: ['data', 'total'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('D9: 路由未找到时报告 violation', () => {
    it('acceptanceAssertion 指向不存在的路由应生成 D2/D3/D4 violations', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-020', method: 'GET', path: '/api/comments', params: ['page'], expectedStatus: 200, assertedFields: ['data'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
      expect(result.violations.some(v => v.message.includes('未在路由定义中找到'))).toBe(true);
      expect(result.violations.some(v => v.message.includes('GET /api/comments'))).toBe(true);
    });

    it('路由不存在时每个维度都报告 violation（D2/D3/D4）', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-030', method: 'POST', path: '/api/not-exist', params: ['x'], expectedStatus: 201, assertedFields: ['y'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      const routeNotFound = result.violations.filter(
        v => v.message.includes('未在路由定义中找到'),
      );
      expect(routeNotFound.length).toBe(3);
    });
  });

  describe('D9: 路径归一化', () => {
    it('尾部斜杠应被归一化后匹配', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-040', method: 'GET', path: '/api/posts/', params: [], expectedStatus: 200, assertedFields: ['data'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
    });

    it('query 参数应被剥离后匹配', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-041', method: 'GET', path: '/api/posts?page=1', params: ['page'], expectedStatus: 200, assertedFields: ['data'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
    });

    it('尾部斜杠+query组合归一化', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: ['data'] },
        ],
        acceptanceAssertions: [
          { uatId: 'UAT-042', method: 'GET', path: '/api/posts/?filter=active', params: [], expectedStatus: 200, assertedFields: ['data'] },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
    });
  });

  describe('null/undefined input', () => {
    it('null input 返回失败', () => {
      const result = checkDesignContractConsistency(null);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('设计契约输入为空');
    });

    it('undefined input 返回失败', () => {
      const result = checkDesignContractConsistency(undefined);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('设计契约输入为空');
    });
  });
});
