#!/usr/bin/env tsx
/**
 * 设计契约一致性校验脚本（Design Contract Consistency Checker）
 *
 * 对应 SSoT §10I「设计契约一致性校验」。
 * 供 G 子代理在阶段 5 编码完成后 + 阶段 8 终检时调用，
 * 校验编码与验收设计一致性（D1 路径 / D2 参数 / D3 状态码 / D4 响应字段）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-design-contract-consistency.ts [project-dir]
 *
 * 参数：
 *   project-dir  项目根目录（默认：当前工作目录）
 *
 * 读取：
 *   <project-dir>/docs/uat-path-mapping.md  （设计路径 ↔ 实际路径映射）
 *   <project-dir>/src/routes/*.ts           （实际路由定义，通过正则提取）
 *   <project-dir>/tests/acceptance/*.test.ts （验收测试用例，通过正则提取断言）
 *
 * 退出码：
 *   0  校验通过（编码与验收设计一致）
 *   1  校验失败（发现不一致，reasons 列出具体原因）
 *   2  输入错误（文件不存在 / 格式非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要 CONTRACT_JSON，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkDesignContractConsistency,
  type DesignContractCheckInput,
  type DesignContractCheckResult,
  type UatPathMapping,
  type RouteDefinition,
  type AcceptanceTestAssertion,
} from './design-contract-logic.js';
import { exitWithError } from './lib/cli-error.js';

// ==================== uat-path-mapping.md 解析 ====================

async function parseUatPathMapping(filePath: string): Promise<UatPathMapping[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const mappings: UatPathMapping[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    // 解析 Markdown 表格行：| UAT-001 | POST /api/posts | POST /api/posts | 直接 | ... |
    const match = line.match(/^\|\s*(UAT-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|/);
    if (match) {
      const [, uatId, designPath, actualPath, mappingType] = match;
      mappings.push({
        uatId: uatId!.trim(),
        designPath: designPath!.trim(),
        actualPath: actualPath!.trim(),
        mappingType: mappingType?.trim() as '直接' | '等价' | '替代' | undefined,
      });
    }
  }
  return mappings;
}

// ==================== 路由定义提取 ====================

async function parseRouteDefinitions(routesDir: string): Promise<RouteDefinition[]> {
  const routes: RouteDefinition[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(routesDir);
  } catch {
    return routes;
  }
  for (const fileName of entries) {
    if (!fileName.endsWith('.ts')) continue;
    const filePath = path.join(routesDir, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const positions: { method: string; path: string; start: number }[] = [];
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      positions.push({
        method: match[1]!.toUpperCase(),
        path: match[2]!,
        start: match.index,
      });
    }
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]!;
      const nextStart = (i + 1 < positions.length) ? positions[i + 1]!.start : content.length;
      const segment = content.slice(pos.start, nextStart);
      routes.push({
        method: pos.method,
        path: pos.path,
        params: extractParamsFromRoute(segment),
        successStatus: extractSuccessStatus(segment),
        responseFields: extractResponseFields(segment),
      });
    }
  }
  return routes;
}

function extractParamsFromRoute(content: string): string[] {
  const params: string[] = [];
  // 提取 req.query.xxx 形式
  const queryRegex = /req\.query\.(\w+)/g;
  let match;
  while ((match = queryRegex.exec(content)) !== null) {
    if (!params.includes(match[1]!)) params.push(match[1]!);
  }
  // 提取 req.body.xxx 形式
  const bodyRegex = /req\.body\.(\w+)/g;
  while ((match = bodyRegex.exec(content)) !== null) {
    if (!params.includes(match[1]!)) params.push(match[1]!);
  }
  return params;
}

function extractSuccessStatus(content: string): number {
  // 查找 res.status(N) 形式，返回第一个状态码
  const statusMatch = content.match(/res\.status\((\d+)\)/);
  return statusMatch ? parseInt(statusMatch[1]!, 10) : 200;
}

function extractResponseFields(content: string): string[] {
  const fields: string[] = [];
  // 提取 res.json({ field1: ..., field2: ... }) 形式
  const jsonRegex = /res\.json\s*\(\s*\{([^}]+)\}/g;
  let match;
  while ((match = jsonRegex.exec(content)) !== null) {
    const body = match[1]!;
    const fieldRegex = /(\w+)\s*:/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      if (!fields.includes(fieldMatch[1]!)) fields.push(fieldMatch[1]!);
    }
  }
  return fields;
}

// ==================== 验收测试断言提取 ====================

async function parseAcceptanceAssertions(testDir: string): Promise<AcceptanceTestAssertion[]> {
  const assertions: AcceptanceTestAssertion[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(testDir);
  } catch {
    return assertions;
  }
  for (const fileName of entries) {
    if (!fileName.endsWith('.test.ts')) continue;
    const filePath = path.join(testDir, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    // 提取 request(app).get/post/put/delete('path').expect(N) 形式
    const testRegex = /request\(app\)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`][\s\S]*?\.expect\((\d+)\)/g;
    let match;
    while ((match = testRegex.exec(content)) !== null) {
      const method = match[1]!.toUpperCase();
      const testPath = match[2]!;
      const expectedStatus = parseInt(match[3]!, 10);
      // 提取该测试块内的断言字段
      const blockStart = match.index! + match[0].length;
      const blockEnd = content.indexOf('});', blockStart);
      const block = content.slice(blockStart, blockEnd > 0 ? blockEnd : undefined);
      const assertedFields: string[] = [];
      const fieldRegex = /res\.body\.(\w+)/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(block)) !== null) {
        if (!assertedFields.includes(fieldMatch[1]!)) assertedFields.push(fieldMatch[1]!);
      }
      // 提取参数
      const params: string[] = [];
      const paramRegex = /\.query\(\s*\{([^}]+)\}/g;
      while ((fieldMatch = paramRegex.exec(block)) !== null) {
        const paramBody = fieldMatch[1]!;
        const paramNameRegex = /(\w+)\s*:/g;
        let paramMatch;
        while ((paramMatch = paramNameRegex.exec(paramBody)) !== null) {
          if (!params.includes(paramMatch[1]!)) params.push(paramMatch[1]!);
        }
      }
      const sendRegex = /\.send\(\s*\{([^}]+)\}/g;
      while ((fieldMatch = sendRegex.exec(block)) !== null) {
        const paramBody = fieldMatch[1]!;
        const paramNameRegex = /(\w+)\s*:/g;
        let paramMatch;
        while ((paramMatch = paramNameRegex.exec(paramBody)) !== null) {
          if (!params.includes(paramMatch[1]!)) params.push(paramMatch[1]!);
        }
      }
      assertions.push({
        uatId: `UAT-${assertions.length + 1}`,
        method,
        path: testPath,
        params,
        expectedStatus,
        assertedFields,
      });
    }
  }
  return assertions;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  const projectDir = process.argv[2] ?? '.';
  const projectDirAbs = path.resolve(projectDir);

  const mappingPath = path.join(projectDirAbs, 'docs', 'uat-path-mapping.md');
  const routesDir = path.join(projectDirAbs, 'src', 'routes');
  const testDir = path.join(projectDirAbs, 'tests', 'acceptance');

  // P2-8: uat-path-mapping.md 缺失时输出明确提示
  try {
    await fs.access(mappingPath);
  } catch {
    const result: DesignContractCheckResult = {
      passed: false,
      reasons: ['uat-path-mapping.md 不存在'],
      violations: [{
        dimension: 'D1',
        severity: 'error',
        message: 'uat-path-mapping.md 不存在',
        expected: `期望路径：${mappingPath}`,
        actual: '文件不存在',
      }],
    };
    console.log(`CONTRACT_JSON: ${JSON.stringify({
      passed: false,
      exitCode: 2,
      violationCount: result.violations.length,
      violations: result.violations,
    }, null, 2)}`);
    exitWithError({
      category: 'FILE_NOT_FOUND',
      message: '文件不存在',
      file: mappingPath,
      detail: 'uat-path-mapping.md 不存在，请在阶段1产出该文件（见 phase-1-requirements.md §输出）',
      exitCode: 2,
    });
    return;
  }

  const uatPathMappings = await parseUatPathMapping(mappingPath);
  const routeDefinitions = await parseRouteDefinitions(routesDir);
  const acceptanceAssertions = await parseAcceptanceAssertions(testDir);

  const input: DesignContractCheckInput = {
    uatPathMappings,
    routeDefinitions,
    acceptanceAssertions,
  };

  const result = checkDesignContractConsistency(input);

  console.log('═'.repeat(60));
  console.log('设计契约一致性校验（Design Contract Consistency）');
  console.log('═'.repeat(60));
  console.log(`项目目录      : ${projectDirAbs}`);
  console.log(`路径映射条目  : ${uatPathMappings.length}`);
  console.log(`路由定义条目  : ${routeDefinitions.length}`);
  console.log(`验收断言条目  : ${acceptanceAssertions.length}`);
  console.log(`违反数        : ${result.violations.length}`);
  console.log('─'.repeat(60));

  if (result.violations.length > 0) {
    for (const v of result.violations) {
      console.log(`✗ [${v.dimension}] ${v.message}`);
      console.log(`  期望: ${v.expected}`);
      console.log(`  实际: ${v.actual}`);
    }
  } else {
    console.log('✓ 设计契约一致性校验通过');
  }

  console.log('─'.repeat(60));
  console.log(`CONTRACT_JSON: ${JSON.stringify({
    passed: result.passed,
    exitCode: result.passed ? 0 : 1,
    violationCount: result.violations.length,
    violations: result.violations,
  })}`);

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
