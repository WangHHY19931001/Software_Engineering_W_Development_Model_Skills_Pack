# 设计契约一致性校验与 RTM 增量校验修正 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复第 21 轮 8 阶段调测发现的三类系统性缺陷（设计-实现脱节、测试用例不完整、RTM 滞后），通过三层架构（SSoT→Reference→Script）建立阶段间追溯链的增量校验机制。

**Architecture:** SSoT 先行（新增 §10I/§10J 定义规则）→ Reference 层落实执行方法论（4 个文档增强）→ Script 层提供确定性判定（修复 gate-logic.ts + 新增 check-design-contract-consistency.ts + 样本 + 自测）。

**Tech Stack:** TypeScript 5 (strict mode), Node.js 20, tsx, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | 修改 | 新增 §10I 设计契约一致性校验 + §10J RTM 增量校验修正 |
| `w-model-dev/references/phase-1-requirements.md` | 修改 | 增加验收测试前置条件分析要求 + 禁止行为 #12/#13 |
| `w-model-dev/references/phase-5-coding.md` | 修改 | 增加验收设计反向对照清单 |
| `w-model-dev/references/phase-8-acceptance-test.md` | 修改 | 增加前置条件校验清单 |
| `w-model-dev/references/rtm-guide.md` | 修改 | 增加阶段级增量校验规则 |
| `w-model-dev/scripts/gate-logic.ts` | 修改 | PHASE_TRACE_FIELDS phase 1-4 增加 acceptanceTest |
| `w-model-dev/scripts/design-contract-logic.ts` | 创建 | 设计契约一致性校验纯逻辑层 |
| `w-model-dev/scripts/check-design-contract-consistency.ts` | 创建 | 设计契约一致性校验 CLI |
| `w-model-dev/schemas/design-contract.schema.json` | 创建 | 校验输出 JSON Schema |
| `w-model-dev/scripts/samples/design-contract/valid-consistent.json` | 创建 | 通过样本：全部一致 |
| `w-model-dev/scripts/samples/design-contract/bad-path-mismatch.json` | 创建 | 失败样本：路径不一致 |
| `w-model-dev/scripts/samples/design-contract/bad-param-mismatch.json` | 创建 | 失败样本：参数不一致 |
| `w-model-dev/scripts/samples/design-contract/bad-status-mismatch.json` | 创建 | 失败样本：状态码不一致 |
| `w-model-dev/scripts/self-test.ts` | 修改 | 增加 DesignContract 用例 + runDesignContractCases |

---

## Task 1: SSoT 新增 §10I + §10J

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10H 之后、§10.10 之前插入）

- [ ] **Step 1: 在 §10H 之后插入 §10I**

在 `## 10H. SkillOpt 方法论吸收` 节末尾的 `---` 之后，`## 10.10 系统层级树与多层图谱` 之前，插入：

```markdown
## 10I. 设计契约一致性校验（check-design-contract-consistency.ts）

> 历史缺陷：第 21 轮 8 阶段调测暴露「阶段 1 验收测试设计与阶段 5 编码实现脱节」——
> 6 处接口路径/参数名/状态码/响应字段不一致，`uat-path-mapping.md` 形同虚设。
> 本节确立编码后自动校验设计契约一致性的机制。
> 实现位置：`w-model-dev/scripts/check-design-contract-consistency.ts` + `w-model-dev/references/phase-5-coding.md` 反向对照清单。

**强制校验维度**（D1~D4，任一失败 → exitCode=1，O 不得放行）：

- **D1 路径一致性**：`uat-path-mapping.md` 中「实际路径」须在路由定义中存在
- **D2 参数一致性**：验收测试使用的分页/筛选参数名须与路由定义一致
- **D3 状态码一致性**：验收测试预期状态码须与路由实际返回一致
- **D4 响应字段一致性**：验收测试断言字段须在实际响应体中存在

**校验时机**：
- 阶段 5 编码完成后（G 子代理执行，exitCode=0 才放行进阶段 6）
- 阶段 8 终检时（与 `check-artifact-gate.ts` 并行执行）

**NFR/CON 行例外**：横切治理类需求不强制 D1~D4 校验（允许路径为「横切」）。

---

## 10J. RTM 增量校验修正（phase 1-4 acceptanceTest 补漏）

> 历史缺陷：第 21 轮 8 阶段调测暴露「35 个 INTF/SD 节点 acceptanceTest 字段为 null
> 直到阶段 8 终检才发现」——根因是 `gate-logic.ts` 的 `PHASE_TRACE_FIELDS` 中
> phase 1-4 不含 `acceptanceTest` 字段，导致阶段 1-4 门禁不校验该字段。
> 本节修正 `PHASE_TRACE_FIELDS`，确保阶段 1-4 就校验 acceptanceTest。

**修正内容**：
- phase 1-4 `PHASE_TRACE_FIELDS` 增加 `acceptanceTest`（REQ/SD/INTF/DD 行强制非空）
- NFR/CON 行允许 `acceptanceTest` 为 null（横切治理类豁免，已有 `isCrossCutting` 逻辑覆盖）
- 判定规则：rowId 前缀 `REQ-`/`SD-`/`INTF-`/`DD-` 强制校验；`NFR-`/`CON-` 允许 null

**校验阶段映射**：

| Phase | 新增行类型 | acceptanceTest 校验要求 |
|---|---|---|
| 1 | REQ 行 | 须非空（UAT 用例在阶段 1 设计） |
| 2 | SD 行 | 须非空（映射到已有 UAT 用例） |
| 3 | INTF 行 | 须非空（映射到已有 UAT 用例） |
| 4 | DD 行 | 须非空（映射到已有 UAT 用例） |
```

- [ ] **Step 2: 验证插入位置正确**

Run: `grep -n "## 10I\|## 10J\|## 10H\|## 10\.10" docs/skill-design-document_SSoT.md`
Expected: §10I 和 §10J 出现在 §10H 和 §10.10 之间

- [ ] **Step 3: 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): add §10I design contract consistency and §10J RTM incremental validation"
```

---

## Task 2: 修复 gate-logic.ts PHASE_TRACE_FIELDS

**Files:**
- Modify: `w-model-dev/scripts/gate-logic.ts:78-87`

- [ ] **Step 1: 修改 PHASE_TRACE_FIELDS**

将 `w-model-dev/scripts/gate-logic.ts` 第 78-87 行的：

```typescript
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc'],
  2: ['description', 'designDoc'],
  3: ['description', 'designDoc'],
  4: ['description', 'designDoc'],
  5: ['description', 'designDoc', 'codeModule', 'unitTest'],
  6: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest'],
  7: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest'],
  8: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};
```

改为：

```typescript
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc', 'acceptanceTest'],
  2: ['description', 'designDoc', 'acceptanceTest'],
  3: ['description', 'designDoc', 'acceptanceTest'],
  4: ['description', 'designDoc', 'acceptanceTest'],
  5: ['description', 'designDoc', 'codeModule', 'unitTest', 'acceptanceTest'],
  6: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'acceptanceTest'],
  7: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
  8: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};
```

- [ ] **Step 2: 验证 NFR/CON 豁免不受影响**

现有 `isCrossCutting` 逻辑（第 231-237 行）对 NFR/CON 行使用自己的字段列表（`['description', 'designDoc']` 或 `['description', 'designDoc', 'codeModule']`），不包含 `acceptanceTest`，因此 NFR/CON 行的 acceptanceTest 为 null 不会被拦截。无需修改。

- [ ] **Step 3: 新增 phase 1 acceptanceTest 缺失的 gate 样本**

创建 `w-model-dev/scripts/samples/gate/bad-phase1-missing-acceptance-test.json`：

```json
{
  "schemaVersion": "1.0",
  "projectId": "test-project",
  "currentPhase": 1,
  "lastUpdated": "2026-07-29T00:00:00.000Z",
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "用户注册功能",
      "designDoc": "docs/requirement-spec.md#REQ-001",
      "codeModule": "",
      "unitTest": "",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": "",
      "coverageStatus": "待覆盖"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "integrationTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "systemTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "acceptanceTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 }
  }
}
```

- [ ] **Step 4: 新增 phase 1 acceptanceTest 合法的 gate 样本**

创建 `w-model-dev/scripts/samples/gate/valid-phase1.json`：

```json
{
  "schemaVersion": "1.0",
  "projectId": "test-project",
  "currentPhase": 1,
  "lastUpdated": "2026-07-29T00:00:00.000Z",
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "用户注册功能",
      "designDoc": "docs/requirement-spec.md#REQ-001",
      "codeModule": "",
      "unitTest": "",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": "docs/acceptance-test-cases.md#UAT-001",
      "coverageStatus": "待覆盖"
    },
    {
      "requirementId": "NFR-001",
      "description": "响应时间 P95 ≤ 200ms",
      "designDoc": "SD-001,SD-004",
      "codeModule": "",
      "unitTest": "",
      "integrationTest": "",
      "systemTest": "",
      "acceptanceTest": "",
      "coverageStatus": "待覆盖"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "integrationTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "systemTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 },
    "acceptanceTest": { "total": 0, "passed": 0, "failed": 0, "pending": 0, "coverage": 0 }
  }
}
```

- [ ] **Step 5: 在 self-test.ts GATE_CASES 增加两条用例**

在 `w-model-dev/scripts/self-test.ts` 的 `GATE_CASES` 数组末尾（第 287 行 `];` 之前）插入：

```typescript
  // -------------------- §10J RTM 增量校验修正（第 22 轮） --------------------
  {
    file: 'valid-phase1.json',
    expectedPassed: true,
    phaseOption: 1,
    description: '§10J phase=1 REQ 行 acceptanceTest 非空 + NFR 行豁免，应通过',
  },
  {
    file: 'bad-phase1-missing-acceptance-test.json',
    expectedPassed: false,
    phaseOption: 1,
    expectedReasonPatterns: [/REQ-001.*acceptanceTest/],
    description: '§10J phase=1 REQ 行 acceptanceTest 为空，应被增量校验拦截',
  },
```

- [ ] **Step 6: 运行 self-test 验证**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsx w-model-dev/scripts/self-test.ts`
Expected: 全部通过（含 2 条新用例）

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/scripts/gate-logic.ts w-model-dev/scripts/self-test.ts w-model-dev/scripts/samples/gate/valid-phase1.json w-model-dev/scripts/samples/gate/bad-phase1-missing-acceptance-test.json
git commit -m "fix(gate-logic): add acceptanceTest to PHASE_TRACE_FIELDS phase 1-4 (§10J)

Fixes C-class issue: 35 INTF/SD nodes had null acceptanceTest undetected
until phase 8 final gate. Now phase 1-4 gates check acceptanceTest for
REQ/SD/INTF/DD rows. NFR/CON rows remain exempt via isCrossCutting."
```

---

## Task 3: 创建 design-contract-logic.ts（纯逻辑层）

**Files:**
- Create: `w-model-dev/scripts/design-contract-logic.ts`

- [ ] **Step 1: 创建纯逻辑层文件**

创建 `w-model-dev/scripts/design-contract-logic.ts`：

```typescript
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
```

- [ ] **Step 2: 创建 JSON Schema 文件**

创建 `w-model-dev/schemas/design-contract.schema.json`：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Design Contract Consistency Check Input",
  "type": "object",
  "required": ["uatPathMappings", "routeDefinitions", "acceptanceAssertions"],
  "additionalProperties": false,
  "properties": {
    "uatPathMappings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["uatId", "designPath", "actualPath"],
        "additionalProperties": false,
        "properties": {
          "uatId": { "type": "string", "minLength": 1 },
          "designPath": { "type": "string" },
          "actualPath": { "type": "string" },
          "mappingType": { "enum": ["直接", "等价", "替代"] }
        }
      }
    },
    "routeDefinitions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["method", "path", "params", "successStatus", "responseFields"],
        "additionalProperties": false,
        "properties": {
          "method": { "type": "string", "minLength": 1 },
          "path": { "type": "string", "minLength": 1 },
          "params": { "type": "array", "items": { "type": "string" } },
          "successStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
          "responseFields": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "acceptanceAssertions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["uatId", "method", "path", "params", "expectedStatus", "assertedFields"],
        "additionalProperties": false,
        "properties": {
          "uatId": { "type": "string", "minLength": 1 },
          "method": { "type": "string", "minLength": 1 },
          "path": { "type": "string", "minLength": 1 },
          "params": { "type": "array", "items": { "type": "string" } },
          "expectedStatus": { "type": "integer", "minimum": 100, "maximum": 599 },
          "assertedFields": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

- [ ] **Step 3: 在 schema-loader.ts 注册新 schema**

检查 `w-model-dev/scripts/schema-loader.ts` 中的 schema 注册表，添加 `'design-contract'` 条目。

Run: `grep -n "rtm\|graph\|verifier" w-model-dev/scripts/schema-loader.ts | head -20`

根据现有模式，在 schema 注册表中添加 `'design-contract': 'design-contract.schema.json'`。

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/design-contract-logic.ts w-model-dev/schemas/design-contract.schema.json w-model-dev/scripts/schema-loader.ts
git commit -m "feat(scripts): add design-contract-logic.ts pure logic layer (§10I D1-D4)"
```

---

## Task 4: 创建 check-design-contract-consistency.ts（CLI 层）

**Files:**
- Create: `w-model-dev/scripts/check-design-contract-consistency.ts`

- [ ] **Step 1: 创建 CLI 脚本**

创建 `w-model-dev/scripts/check-design-contract-consistency.ts`：

```typescript
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
  type UatPathMapping,
  type RouteDefinition,
  type AcceptanceTestAssertion,
} from './design-contract-logic.js';

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
    // 提取 router.get/post/put/delete('path', ...) 形式
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1]!.toUpperCase();
      const routePath = match[2]!;
      routes.push({
        method,
        path: routePath,
        params: extractParamsFromRoute(content, routePath),
        successStatus: extractSuccessStatus(content, routePath),
        responseFields: extractResponseFields(content, routePath),
      });
    }
  }
  return routes;
}

function extractParamsFromRoute(content: string, routePath: string): string[] {
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

function extractSuccessStatus(content: string, routePath: string): number {
  // 查找 res.status(N) 形式，返回第一个状态码
  const statusMatch = content.match(/res\.status\((\d+)\)/);
  return statusMatch ? parseInt(statusMatch[1]!, 10) : 200;
}

function extractResponseFields(content: string, routePath: string): string[] {
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

  // 检查 uat-path-mapping.md 存在性
  try {
    await fs.access(mappingPath);
  } catch {
    console.error(`✗ 输入错误：${mappingPath} 不存在`);
    process.exit(2);
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
  console.error('设计契约一致性校验异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/check-design-contract-consistency.ts
git commit -m "feat(scripts): add check-design-contract-consistency.ts CLI (§10I)"
```

---

## Task 5: 创建设计契约样本 + 增强 self-test.ts

**Files:**
- Create: `w-model-dev/scripts/samples/design-contract/valid-consistent.json`
- Create: `w-model-dev/scripts/samples/design-contract/bad-path-mismatch.json`
- Create: `w-model-dev/scripts/samples/design-contract/bad-param-mismatch.json`
- Create: `w-model-dev/scripts/samples/design-contract/bad-status-mismatch.json`
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 创建 valid-consistent.json**

创建 `w-model-dev/scripts/samples/design-contract/valid-consistent.json`：

```json
{
  "uatPathMappings": [
    {
      "uatId": "UAT-001",
      "designPath": "POST /api/posts",
      "actualPath": "POST /api/posts",
      "mappingType": "直接"
    }
  ],
  "routeDefinitions": [
    {
      "method": "POST",
      "path": "/api/posts",
      "params": ["title", "content"],
      "successStatus": 201,
      "responseFields": ["id", "title", "content", "authorId"]
    }
  ],
  "acceptanceAssertions": [
    {
      "uatId": "UAT-001",
      "method": "POST",
      "path": "/api/posts",
      "params": ["title", "content"],
      "expectedStatus": 201,
      "assertedFields": ["id", "title"]
    }
  ]
}
```

- [ ] **Step 2: 创建 bad-path-mismatch.json**

创建 `w-model-dev/scripts/samples/design-contract/bad-path-mismatch.json`：

```json
{
  "uatPathMappings": [
    {
      "uatId": "UAT-017",
      "designPath": "GET /api/posts/search",
      "actualPath": "GET /api/search",
      "mappingType": "替代"
    }
  ],
  "routeDefinitions": [
    {
      "method": "GET",
      "path": "/api/posts",
      "params": ["page", "pageSize"],
      "successStatus": 200,
      "responseFields": ["data", "total"]
    }
  ],
  "acceptanceAssertions": [
    {
      "uatId": "UAT-017",
      "method": "GET",
      "path": "/api/search",
      "params": ["q"],
      "expectedStatus": 200,
      "assertedFields": ["data"]
    }
  ]
}
```

- [ ] **Step 3: 创建 bad-param-mismatch.json**

创建 `w-model-dev/scripts/samples/design-contract/bad-param-mismatch.json`：

```json
{
  "uatPathMappings": [
    {
      "uatId": "UAT-006",
      "designPath": "GET /api/posts",
      "actualPath": "GET /api/posts",
      "mappingType": "直接"
    }
  ],
  "routeDefinitions": [
    {
      "method": "GET",
      "path": "/api/posts",
      "params": ["page", "pageSize"],
      "successStatus": 200,
      "responseFields": ["data", "total"]
    }
  ],
  "acceptanceAssertions": [
    {
      "uatId": "UAT-006",
      "method": "GET",
      "path": "/api/posts",
      "params": ["page", "limit"],
      "expectedStatus": 200,
      "assertedFields": ["data"]
    }
  ]
}
```

- [ ] **Step 4: 创建 bad-status-mismatch.json**

创建 `w-model-dev/scripts/samples/design-contract/bad-status-mismatch.json`：

```json
{
  "uatPathMappings": [
    {
      "uatId": "UAT-013",
      "designPath": "DELETE /api/posts/:id",
      "actualPath": "DELETE /api/posts/:id",
      "mappingType": "直接"
    }
  ],
  "routeDefinitions": [
    {
      "method": "DELETE",
      "path": "/api/posts/:id",
      "params": [],
      "successStatus": 200,
      "responseFields": ["code"]
    }
  ],
  "acceptanceAssertions": [
    {
      "uatId": "UAT-013",
      "method": "DELETE",
      "path": "/api/posts/:id",
      "params": [],
      "expectedStatus": 204,
      "assertedFields": ["code"]
    }
  ]
}
```

- [ ] **Step 5: 在 self-test.ts 增加 DesignContractCase 接口和用例**

在 `w-model-dev/scripts/self-test.ts` 中，在 `SIGNATURE_CHAIN_CASES` 定义之前（搜索 `// -------------------- SignatureChain --------------------`）插入：

```typescript
// -------------------- DesignContract --------------------

interface DesignContractCase {
  /** 样本文件名（相对 samples/design-contract/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const DESIGN_CONTRACT_CASES: DesignContractCase[] = [
  {
    file: 'valid-consistent.json',
    expectedPassed: true,
    description: '路径/参数/状态码/字段全部一致，应通过',
  },
  {
    file: 'bad-path-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D1\]/],
    description: 'UAT 路径映射实际路径在路由定义中不存在，应被 D1 拦截',
  },
  {
    file: 'bad-param-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D2\]/],
    description: '验收测试使用 limit 但路由定义使用 pageSize，应被 D2 拦截',
  },
  {
    file: 'bad-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D3\]/],
    description: '验收测试预期 204 但路由实际返回 200，应被 D3 拦截',
  },
];
```

- [ ] **Step 6: 在 self-test.ts 增加 runDesignContractCases 函数**

在 `runSignatureChainCases` 函数之前插入：

```typescript
async function runDesignContractCases(samplesDir: string): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  for (const tc of DESIGN_CONTRACT_CASES) {
    const filePath = path.join(samplesDir, 'design-contract', tc.file);
    const name = `DesignContract/${tc.file}`;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const input = JSON.parse(content);
      const result = checkDesignContractConsistency(input);
      const passed = result.passed === tc.expectedPassed &&
        (!tc.expectedReasonPatterns || tc.expectedReasonPatterns.every(
          (pat) => result.reasons.some((r) => pat.test(r)),
        ));
      results.push({
        name,
        passed,
        description: tc.description,
        details: passed ? [] : [
          `  expectedPassed=${tc.expectedPassed}, actual passed=${result.passed}`,
          `  reasons: ${result.reasons.join('; ')}`,
        ],
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: tc.description,
        details: [`  异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}
```

- [ ] **Step 7: 在 self-test.ts main() 中注册新用例**

在 `main()` 函数中（约第 1944 行 `console.log('Metadata 用例  : 1');` 之后）添加：

```typescript
  console.log(`DesignContract 用例 : ${DESIGN_CONTRACT_CASES.length}`);
```

在 `Promise.all` 数组中（约第 1970 行 `runMetadataCheck(skillRoot),` 之后）添加 `runDesignContractCases(samplesDir),`。

在 `all` 数组的展开中（约第 1976 行 `...metadataResults,` 之后）添加 `...designContractResults,`。

在 `Promise.all` 的解构中添加 `designContractResults`。

- [ ] **Step 8: 在 self-test.ts 顶部导入 checkDesignContractConsistency**

在 `w-model-dev/scripts/self-test.ts` 顶部 import 区（约第 50 行 `import { checkArchiveIntegrity } from './archive-integrity-logic.js';` 之后）添加：

```typescript
import { checkDesignContractConsistency } from './design-contract-logic.js';
```

- [ ] **Step 9: 运行 self-test 验证**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsx w-model-dev/scripts/self-test.ts`
Expected: 全部通过（含 4 条 DesignContract 用例 + 2 条新 Gate 用例）

- [ ] **Step 10: 提交**

```bash
git add w-model-dev/scripts/samples/design-contract/ w-model-dev/scripts/self-test.ts
git commit -m "test(scripts): add design-contract samples + self-test cases (§10I D1-D4)"
```

---

## Task 6: Reference 层文档增强

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`
- Modify: `w-model-dev/references/phase-5-coding.md`
- Modify: `w-model-dev/references/phase-8-acceptance-test.md`
- Modify: `w-model-dev/references/rtm-guide.md`

- [ ] **Step 1: phase-1-requirements.md 增加验收测试前置条件分析要求**

在 `w-model-dev/references/phase-1-requirements.md` 的「L1 BDD features 设计」节之后、「RTM 登记」节之前，插入：

```markdown
### 验收测试前置条件分析（强制）

> 第 22 轮新增。第 21 轮调测发现 5 个验收用例因前置条件缺失而失败（如用公开接口测 token 失效、管理员场景未预创建管理员用户）。

每条验收测试用例须包含以下前置条件分析：

| 前置条件类型 | 要求 | 示例 |
|---|---|---|
| 认证状态 | 明确标注是否需认证 + 角色 | 需 admin token / 需普通用户 token / 无需认证 |
| 数据依赖 | 明确标注依赖的测试数据 | 需预创建文章/用户/标签 |
| 接口路径 | 明确标注 API 路径 + HTTP 方法 | POST /api/posts |

**禁止行为（新增）**：

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 12 | 用公开接口测试认证失效 | 须选需要认证的接口验证 token 失效 |
| 13 | 验收用例未声明前置条件 | 每条用例须含前置条件分析节 |
```

- [ ] **Step 2: phase-5-coding.md 增加验收设计反向对照清单**

在 `w-model-dev/references/phase-5-coding.md` 的「RTM 登记」节末尾（`check-artifact-gate.ts --phase=5` 段之后）、「验收标准」节之前，插入：

```markdown
### 验收设计反向对照（强制）

> 第 22 轮新增。第 21 轮调测发现 6 处编码与验收设计不一致（路径/参数/状态码/字段偏离设计）。

编码完成后，S 子代理须对照阶段 1 的 `docs/uat-path-mapping.md` 逐条核对：

- [ ] 路径一致性：映射表中「实际路径」列已回填且与路由定义一致
- [ ] 参数一致性：分页/筛选参数名与验收测试设计一致
- [ ] 状态码一致性：成功/错误状态码与验收测试设计一致
- [ ] 响应字段一致性：响应体字段名与验收测试设计一致

G 子代理跑 [`check-design-contract-consistency.ts`](../scripts/check-design-contract-consistency.ts) 校验，exitCode=0 才放行。

违反任一条 → 回编码修正，禁止「以代码为准」忽略设计。
```

- [ ] **Step 3: phase-8-acceptance-test.md 增加前置条件校验清单**

在 `w-model-dev/references/phase-8-acceptance-test.md` 的「测试用例设计（执行）」节之后、「UAT 路径映射表」节之前，插入：

```markdown
### 验收测试前置条件校验清单

> 第 22 轮新增。第 21 轮调测发现 5 个验收用例因前置条件未满足而失败。

执行验收测试前，须逐条校验用例的前置条件：

- [ ] 认证状态：需认证的用例已准备有效 token
- [ ] 角色权限：管理员场景已预创建管理员用户
- [ ] 数据依赖：依赖的测试数据已准备
- [ ] 接口选择：测试 token 失效用例须选需认证接口（非公开接口）
```

- [ ] **Step 4: rtm-guide.md 增加阶段级增量校验规则**

在 `w-model-dev/references/rtm-guide.md` 的「各阶段登记职责」表之后、「测试用例 ID 命名规则」节之前，插入：

```markdown
### 阶段级增量校验（强制）

> 第 22 轮新增。第 21 轮调测发现 35 个节点 acceptanceTest 为 null 直到阶段 8 才发现。

`check-artifact-gate.ts --phase=N` 在每阶段门执行，校验当前阶段应完成的 RTM 字段：

| Phase | 校验的 RTM 字段 | 新增校验项 |
|---|---|---|
| 1 | description, designDoc, **acceptanceTest** | REQ 行 acceptanceTest 须非空 |
| 2 | description, designDoc, **acceptanceTest** | SD 行 acceptanceTest 须非空 |
| 3 | description, designDoc, **acceptanceTest** | INTF 行 acceptanceTest 须非空 |
| 4 | description, designDoc, **acceptanceTest** | DD 行 acceptanceTest 须非空 |
| 5 | + codeModule, unitTest, **acceptanceTest** | 跑 check-design-contract-consistency.ts |
| 8 | 全字段终检 | + check-design-contract-consistency.ts 终检 |

NFR/CON 行的 acceptanceTest 允许为 null（横切治理类豁免，由 `isCrossCutting` 逻辑覆盖）。
```

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/references/phase-1-requirements.md w-model-dev/references/phase-5-coding.md w-model-dev/references/phase-8-acceptance-test.md w-model-dev/references/rtm-guide.md
git commit -m "docs(references): add design contract checklist + pre-condition analysis + RTM incremental validation"
```

---

## Task 7: 最终验证

**Files:**
- 无文件修改，仅验证

- [ ] **Step 1: TypeScript 严格模式编译**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: self-test 全部通过**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx tsx w-model-dev/scripts/self-test.ts`
Expected: 全部通过（原有用例 + 2 条新 Gate 用例 + 4 条 DesignContract 用例）

- [ ] **Step 3: Vitest 全部通过**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npx vitest run`
Expected: 全部通过

- [ ] **Step 4: 确认工作树干净**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && git status`
Expected: working tree clean

- [ ] **Step 5: 总结提交（如有遗漏修正）**

如果以上验证发现问题并修正，统一提交。否则跳过此步。
