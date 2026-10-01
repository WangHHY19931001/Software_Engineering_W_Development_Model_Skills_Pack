import { describe, it, expect } from 'vitest';

import { checkDesignContractConsistency, type DesignContractCheckInput } from '../logic/design-contract-logic.js';

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
          {
            uatId: 'UAT-001',
            method: 'POST',
            path: '/api/posts',
            params: ['title'],
            expectedStatus: 201,
            assertedFields: ['id'],
          },
          {
            uatId: 'UAT-002',
            method: 'GET',
            path: '/api/posts',
            params: [],
            expectedStatus: 200,
            assertedFields: ['data'],
          },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('多路由不同 params/responseFields 各自独立', () => {
      const input = makeInput({
        routeDefinitions: [
          {
            method: 'POST',
            path: '/api/posts',
            params: ['title', 'content'],
            successStatus: 201,
            responseFields: ['id', 'title'],
          },
          {
            method: 'GET',
            path: '/api/posts',
            params: ['page', 'size'],
            successStatus: 200,
            responseFields: ['data', 'total'],
          },
        ],
        acceptanceAssertions: [
          {
            uatId: 'UAT-001',
            method: 'POST',
            path: '/api/posts',
            params: ['title', 'content'],
            expectedStatus: 201,
            assertedFields: ['id', 'title'],
          },
          {
            uatId: 'UAT-002',
            method: 'GET',
            path: '/api/posts',
            params: ['page', 'size'],
            expectedStatus: 200,
            assertedFields: ['data', 'total'],
          },
        ],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('D9: 路由未找到时报告 violation', () => {
    it('路由缺失对（2 态：具名路由缺失 / 三维度齐报 D2/D3/D4）', () => {
      // 态 1：acceptanceAssertion 指向不存在的路由，报告具名缺失
      const namedMiss = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-020',
              method: 'GET',
              path: '/api/comments',
              params: ['page'],
              expectedStatus: 200,
              assertedFields: ['data'],
            },
          ],
        }),
      );
      expect(namedMiss.passed, '路由缺失·GET /api/comments: 应失败').toBe(false);
      expect(namedMiss.violations.length, '路由缺失·GET /api/comments: 至少 1 条违规').toBeGreaterThanOrEqual(1);
      expect(
        namedMiss.violations.some((v) => v.message.includes('未在路由定义中找到')),
        '路由缺失·GET /api/comments: 应含「未在路由定义中找到」',
      ).toBe(true);
      expect(
        namedMiss.violations.some((v) => v.message.includes('GET /api/comments')),
        '路由缺失·GET /api/comments: 消息应含路由字面',
      ).toBe(true);

      // 态 2：路由不存在时每个维度都报告 violation
      const allDimensions = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-030',
              method: 'POST',
              path: '/api/not-exist',
              params: ['x'],
              expectedStatus: 201,
              assertedFields: ['y'],
            },
          ],
        }),
      );
      const routeNotFound = allDimensions.violations.filter((v) => v.message.includes('未在路由定义中找到'));
      expect(routeNotFound.length, '路由缺失·POST /api/not-exist: D2/D3/D4 各一条').toBe(3);
    });
  });

  describe('D9: 路径归一化', () => {
    it('路径归一化匹配行（3 态：尾部斜杠 / query 剥离 / 组合归一化）', () => {
      for (const [caseName, actualPath, params] of [
        ['尾部斜杠归一化', '/api/posts/', []],
        ['query 参数剥离', '/api/posts?page=1', ['page']],
        ['尾部斜杠+query 组合', '/api/posts/?filter=active', []],
      ] as const) {
        const result = checkDesignContractConsistency(
          makeInput({
            routeDefinitions: [
              {
                method: 'GET',
                path: '/api/posts',
                params: [...params],
                successStatus: 200,
                responseFields: ['data'],
              },
            ],
            acceptanceAssertions: [
              {
                uatId: `UAT-${caseName}`,
                method: 'GET',
                path: actualPath,
                params: [...params],
                expectedStatus: 200,
                assertedFields: ['data'],
              },
            ],
          }),
        );
        expect(result.passed, `${caseName}（${actualPath}）: 归一化后应匹配`).toBe(true);
      }
    });
  });

  describe('D1: UAT 路径映射语义归一', () => {
    it('UAT 语义归一匹配行（4 态：多端点「、」/ 括号说明 / 模板段 / 逗号分隔）', () => {
      for (const { caseName, routeDefinitions, uatPathMapping } of [
        {
          caseName: '多端点组合（「、」分隔）逐项匹配',
          routeDefinitions: [
            { method: 'PUT', path: '/api/posts/:id', params: [], successStatus: 200, responseFields: [] },
            { method: 'DELETE', path: '/api/posts/:id', params: [], successStatus: 204, responseFields: [] },
          ],
          uatPathMapping: {
            uatId: 'UAT-001',
            designPath: 'PUT/DELETE /api/posts/:id',
            actualPath: 'PUT /api/posts/:id、DELETE /api/posts/:id',
            mappingType: '直接',
          },
        },
        {
          caseName: '端点带括号说明剥离后匹配',
          routeDefinitions: [
            { method: 'POST', path: '/api/posts/:id/publish', params: [], successStatus: 200, responseFields: [] },
          ],
          uatPathMapping: {
            uatId: 'UAT-002',
            designPath: 'POST /api/posts/:id/publish',
            actualPath: 'POST /api/posts/:id/publish（触发 Webhook 分发）',
            mappingType: '直接',
          },
        },
        {
          caseName: '具体请求实例按路由参数模板段级匹配（:id 命中具体值）',
          routeDefinitions: [
            { method: 'GET', path: '/api/articles/:id', params: [], successStatus: 200, responseFields: [] },
          ],
          uatPathMapping: {
            uatId: 'UAT-003',
            designPath: 'GET /api/articles/:id',
            actualPath: 'GET /api/articles/art-nonexist（404 兜底）',
            mappingType: '等价',
          },
        },
        {
          caseName: '逗号分隔多端点（，/,）逐项匹配',
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: [] },
            { method: 'GET', path: '/api/comments', params: [], successStatus: 200, responseFields: [] },
          ],
          uatPathMapping: {
            uatId: 'UAT-005',
            designPath: 'GET /api/posts + /api/comments',
            actualPath: 'GET /api/posts, GET /api/comments',
            mappingType: '直接',
          },
        },
      ] as const) {
        const result = checkDesignContractConsistency(
          makeInput({
            // as const 行数据为 readonly 深结构；RouteDefinition 要求可变数组，此处逐字段浅拷贝归一
            routeDefinitions: routeDefinitions.map((route) => ({
              ...route,
              params: [...route.params],
              responseFields: [...route.responseFields],
            })),
            uatPathMappings: [{ ...uatPathMapping }],
          }),
        );
        expect(result.passed, `${caseName}（${uatPathMapping.actualPath}）: 归一后应匹配`).toBe(true);
        expect(result.violations, `${caseName}: 应零违规`).toHaveLength(0);
      }
    });

    it('「不适用（...）」非 HTTP 行豁免（与横切同语义）', () => {
      const input = makeInput({
        routeDefinitions: [{ method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: [] }],
        uatPathMappings: [
          {
            uatId: 'UAT-004',
            designPath: 'NFR-001',
            actualPath: '不适用（性能 NFR，无独立端点）',
            mappingType: '直接',
          },
        ],
        acceptanceAssertions: [],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('多端点组合中存在未定义路由 → D1 violation', () => {
      const input = makeInput({
        routeDefinitions: [
          { method: 'PUT', path: '/api/posts/:id', params: [], successStatus: 200, responseFields: [] },
        ],
        uatPathMappings: [
          {
            uatId: 'UAT-006',
            designPath: 'PUT/DELETE /api/posts/:id',
            actualPath: 'PUT /api/posts/:id、DELETE /api/comments/:id',
            mappingType: '直接',
          },
        ],
        acceptanceAssertions: [],
      });
      const result = checkDesignContractConsistency(input);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.dimension === 'D1')).toBe(true);
    });
  });

  describe('null/undefined input', () => {
    it('空输入（2 态：null / undefined）返回失败', () => {
      for (const [caseName, input] of [
        ['null input', null],
        ['undefined input', undefined],
      ] as const) {
        const result = checkDesignContractConsistency(input);
        expect(result.passed, `${caseName}: 应失败`).toBe(false);
        expect(result.reasons, `${caseName}: 应含空输入原因`).toContain('设计契约输入为空');
      }
    });
  });

  describe('批次3 双轨：structuredViolations（rule/subject/fixHints）', () => {
    it('D1 路径不一致：rule=dimension、subject="uatId → actualPath"、fixHints 非空', () => {
      const r = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'PUT', path: '/api/posts/:id', params: [], successStatus: 200, responseFields: [] },
          ],
          uatPathMappings: [
            {
              uatId: 'UAT-006',
              designPath: 'PUT/DELETE /api/posts/:id',
              actualPath: 'PUT /api/posts/:id、DELETE /api/comments/:id',
              mappingType: '直接',
            },
          ],
        }),
      );
      expect(r.passed, 'D1 场景: 应失败').toBe(false);
      expect(r.violations, 'D1 场景: 恰 1 条违规').toHaveLength(1);
      const v = r.violations[0]!;
      expect(v.dimension).toBe('D1');
      const sv = r.structuredViolations[0]!;
      expect(sv.rule, 'structured.rule 应等于 dimension').toBe(v.dimension);
      expect(sv.message, 'structured.message 保留原文（消费者兼容）').toBe(v.message);
      expect(sv.classification, '契约一致性全为 semantic').toBe('semantic');
      expect(sv.subject, 'D1 subject = "<uatId> → <actualPath>"').toBe(
        'UAT-006 → PUT /api/posts/:id、DELETE /api/comments/:id',
      );
      expect(Array.isArray(sv.fixHints), 'fixHints 为数组且非空').toBe(true);
      expect(sv.fixHints!.length).toBeGreaterThan(0);
    });

    it('D2 参数不一致：subject=参数名', () => {
      const r = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: ['pageSize'], successStatus: 200, responseFields: ['data'] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-001',
              method: 'GET',
              path: '/api/posts',
              params: ['limit'],
              expectedStatus: 200,
              assertedFields: ['data'],
            },
          ],
        }),
      );
      expect(r.passed).toBe(false);
      const d2 = r.structuredViolations.find((sv) => sv.rule === 'D2')!;
      expect(d2).toBeDefined();
      expect(d2.subject, 'D2 subject = 参数名').toBe('limit');
      expect(d2.fixHints!.length).toBeGreaterThan(0);
      expect(d2.classification).toBe('semantic');
    });

    it('D3 状态码不一致：subject=状态码对', () => {
      const r = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'DELETE', path: '/api/posts/:id', params: [], successStatus: 200, responseFields: [] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-001',
              method: 'DELETE',
              path: '/api/posts/:id',
              params: [],
              expectedStatus: 204,
              assertedFields: [],
            },
          ],
        }),
      );
      expect(r.passed).toBe(false);
      const d3 = r.structuredViolations.find((sv) => sv.rule === 'D3')!;
      expect(d3).toBeDefined();
      expect(d3.subject, 'D3 subject = 状态码对（断言预期 → 路由实际）').toBe('204 → 200');
      expect(d3.fixHints!.length).toBeGreaterThan(0);
      expect(d3.classification).toBe('semantic');
    });

    it('D4 响应字段不一致：subject=字段名', () => {
      const r = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: [], successStatus: 200, responseFields: ['data'] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-001',
              method: 'GET',
              path: '/api/posts',
              params: [],
              expectedStatus: 200,
              assertedFields: ['createdAt'],
            },
          ],
        }),
      );
      expect(r.passed).toBe(false);
      const d4 = r.structuredViolations.find((sv) => sv.rule === 'D4')!;
      expect(d4).toBeDefined();
      expect(d4.subject, 'D4 subject = 字段名').toBe('createdAt');
      expect(d4.fixHints!.length).toBeGreaterThan(0);
      expect(d4.classification).toBe('semantic');
    });

    it('路由缺失三连报（D2/D3/D4）：subject=路由字面', () => {
      const r = checkDesignContractConsistency(
        makeInput({
          routeDefinitions: [
            { method: 'GET', path: '/api/posts', params: ['page'], successStatus: 200, responseFields: ['data'] },
          ],
          acceptanceAssertions: [
            {
              uatId: 'UAT-030',
              method: 'POST',
              path: '/api/not-exist',
              params: ['x'],
              expectedStatus: 201,
              assertedFields: ['y'],
            },
          ],
        }),
      );
      expect(r.passed).toBe(false);
      const notFound = r.structuredViolations.filter((sv) => sv.rule === 'D2' || sv.rule === 'D3' || sv.rule === 'D4');
      expect(notFound, '路由缺失时 D2/D3/D4 各派生一条 structured').toHaveLength(3);
      for (const sv of notFound) {
        expect(sv.subject, '路由缺失场景 subject = "<method> <path>" 路由字面').toBe('POST /api/not-exist');
        expect(sv.fixHints!.length).toBeGreaterThan(0);
        expect(sv.classification).toBe('semantic');
      }
    });

    it('通过时 structuredViolations 恒在场（空数组，恒存在先例）', () => {
      const r = checkDesignContractConsistency(makeInput());
      expect(r.passed).toBe(true);
      expect(Array.isArray(r.structuredViolations)).toBe(true);
      expect(r.structuredViolations).toHaveLength(0);
    });

    it('null 输入：structuredViolations 恒在场（空数组）', () => {
      const r = checkDesignContractConsistency(null);
      expect(r.passed).toBe(false);
      expect(Array.isArray(r.structuredViolations)).toBe(true);
      expect(r.structuredViolations).toHaveLength(0);
    });
  });
});
