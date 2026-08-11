# 冰山扫掠深度分析机制实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 W 模型返工循环中新增 R-iceberg 冰山扫掠机制——S-fix 后（ICEBERG-A）与阶段门前（ICEBERG-B）以已发现问题为线索主动深挖隐藏缺陷，直到 `newFindings=[]` 或达到 maxIcebergRounds=5。

**Architecture:** 三层分离（与既有模式一致）：`schemas/iceberg-sweep.schema.json`（结构约束）→ `iceberg-sweep-logic.ts`（纯逻辑，入口 `validateBySchema` 前置校验）→ `check-iceberg-sweep.ts`（CLI，退出码 0/1/2）。文档层新增 `references/iceberg-sweep-guide.md`（方法论）+ 反模式 #44 + 各文档同步。版本号三处（package.json / skill-metadata.json / SKILL.md frontmatter）36.0.0 同步。

**Tech Stack:** TypeScript（strict）/ Node ≥20 / vitest / ajv(draft-07) / tsx。既有架构约定：logic 层无 IO、CLI 层用 `lib/cli-error.ts`（6 类错误码）+ `lib/read-json-or-exit.ts` + `lib/safe-json.ts` + `lib/parse-phase.ts` + `lib/gate-report.ts`。

**Spec 依据:** `docs/superpowers/specs/2026-08-08-iceberg-sweep-deep-analysis-design.md`（已批准）

---

## 文件结构总览

| 文件 | 责任 | 类型 |
|---|---|---|
| `w-model-dev/schemas/iceberg-sweep.schema.json` | IcebergSweepReport 结构约束 | Create |
| `w-model-dev/scripts/iceberg-sweep-logic.ts` | 纯校验逻辑（R1-R8） | Create |
| `w-model-dev/scripts/check-iceberg-sweep.ts` | CLI 层（参数/IO/exit） | Create |
| `w-model-dev/scripts/__tests__/iceberg-logic.test.ts` | R1-R8 单测 | Create |
| `w-model-dev/scripts/samples/iceberg/` | valid + bad 样本（self-test 驱动） | Create |
| `w-model-dev/scripts/self-test.ts` | 基线扩展（ICEBERG_CASES） | Modify |
| `w-model-dev/schemas/run-log.schema.json` | action 枚举 +2 | Modify |
| `w-model-dev/references/iceberg-sweep-guide.md` | 方法论 + 六类别 + TLA+ 示例 | Create |
| `w-model-dev/references/anti-patterns.md` | 反模式 #44 | Modify |
| `w-model-dev/references/subagent-delegation.md` | R-iceberg 分派模板 + 时序 | Modify |
| `w-model-dev/references/root-cause-locator.md` | R 与 R-iceberg 边界节 | Modify |
| `w-model-dev/SKILL.md` | 编排时序 + 版本号 | Modify |
| `docs/skill-design-document_SSoT.md` | §3.4.34 新节 + §10A 追溯行 | Modify |
| `AGENTS.md` | §4 参考实现 + §8 脚本导航表 | Modify |
| `CHANGELOG.md` | 36.0.0 条目 | Modify |
| `README.md` | 反模式计数 43→44 | Modify |
| `package.json` | version 36.0.0 | Modify |
| `w-model-dev/skill-metadata.json` | version 36.0.0 | Modify |

---

## Task 1: 新增 iceberg-sweep.schema.json

**Files:**
- Create: `w-model-dev/schemas/iceberg-sweep.schema.json`

- [ ] **Step 1: 创建 schema 文件**

写入以下完整内容（与 spec §3.5 一致，全字段 description 自描述）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/iceberg-sweep.schema.json",
  "title": "IcebergSweepReport",
  "description": "冰山扫掠报告形状（R-iceberg 子代理产出；触发于 S-fix 后或阶段门放行前；以已发现/已修复问题为线索主动深挖隐藏问题）",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "reportId", "phase", "triggerType", "icebergRound",
    "sweptAt", "sweptBy", "线索来源",
    "newFindings", "sweepCoverage", "summary", "passed"
  ],
  "properties": {
    "reportId": {
      "type": "string",
      "pattern": "^IS-phase[1-8]-[1-5]-[0-9]+$",
      "description": "冰山扫掠报告 ID，格式 IS-phase<N>-<round>-<seq>，如 IS-phase3-2-01"
    },
    "phase": {
      "type": "string",
      "description": "当前阶段标识，如 phase3-outline"
    },
    "triggerType": {
      "type": "string",
      "enum": ["ICEBERG-A", "ICEBERG-B"],
      "description": "触发类型：ICEBERG-A=S-fix后深挖（防修复引入新缺陷+同根因扩散），ICEBERG-B=阶段门前全局扫掠"
    },
    "icebergRound": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "description": "冰山轮次（1-5，maxIcebergRounds=5），ICEBERG-A 和 ICEBERG-B 共享计数器，每阶段独立计数，阶段进入时重置为 0"
    },
    "sweptAt": {
      "type": "string",
      "format": "date-time",
      "description": "扫掠时间戳，ISO 8601 字符串"
    },
    "sweptBy": {
      "type": "string",
      "minLength": 1,
      "description": "扫掠者标识（R-iceberg 子代理），非空字符串"
    },
    "线索来源": {
      "type": "object",
      "description": "深挖线索：本轮已发现的问题历史 + 已修复点 + 上一轮冰山发现（去重依据）",
      "additionalProperties": false,
      "required": ["reworkHintsHistory", "fixedPoints", "previousFindings"],
      "properties": {
        "reworkHintsHistory": {
          "type": "array",
          "items": { "type": "string" },
          "description": "本阶段所有 V/G reworkHints 历史数组"
        },
        "fixedPoints": {
          "type": "array",
          "items": { "type": "string" },
          "description": "已修复的缺陷位置列表（文件:行号/节点ID，遵循 format-conventions.md）"
        },
        "previousFindings": {
          "type": "array",
          "items": { "type": "string" },
          "description": "上一轮 IcebergSweepReport 的 findingId 列表（去重依据，本轮不得重复发现）"
        }
      }
    },
    "newFindings": {
      "type": "array",
      "description": "新发现的隐藏问题列表，空数组=无新问题=终止条件①满足",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["findingId", "severity", "category", "location", "description", "evidence", "hypothesis", "relatedFixedPoint"],
        "properties": {
          "findingId": {
            "type": "string",
            "pattern": "^IF-phase[1-8]-[1-5]-[0-9]+$",
            "description": "冰山发现 ID，格式 IF-phase<N>-<round>-<seq>，如 IF-phase3-2-01"
          },
          "severity": {
            "type": "string",
            "enum": ["Critical", "Required", "Optional"],
            "description": "严重等级：Critical=阻断级（须修复后才能放行）/ Required=必须修复 / Optional=可选优化（与 V 的 Severity 对齐，但不含 Nit/FYI 因冰山发现默认须走返工）"
          },
          "category": {
            "type": "string",
            "enum": ["same-root-cause-spread", "same-defect-class", "fix-induced-regression", "adjacent-logic", "coverage-gap", "cross-artifact-inconsistency"],
            "description": "发现类别：same-root-cause-spread=同根因扩散 / same-defect-class=同缺陷类 / fix-induced-regression=修复引入回归 / adjacent-logic=相邻逻辑 / coverage-gap=覆盖缺口 / cross-artifact-inconsistency=跨产物不一致"
          },
          "location": {
            "type": "string",
            "minLength": 1,
            "description": "缺陷位置，格式 path:§section 或 path:L42（遵循 format-conventions.md 冒号分隔）"
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "description": "缺陷描述（非空字符串，具体指出缺陷内容与影响）"
          },
          "evidence": {
            "type": "string",
            "minLength": 1,
            "description": "证据引用（具体产物字段/行号/节点ID），禁止空泛（check-iceberg-sweep.ts R7 校验）"
          },
          "hypothesis": {
            "type": "string",
            "minLength": 1,
            "description": "可证伪假设：若此发现消除，关联现象是否消失（check-iceberg-sweep.ts R7 校验）"
          },
          "relatedFixedPoint": {
            "type": "string",
            "minLength": 1,
            "description": "关联的已修复点（说明为何这是冰山扩散发现，与 fixedPoints 中某项关联）"
          }
        }
      }
    },
    "sweepCoverage": {
      "type": "object",
      "description": "扫掠覆盖范围记录",
      "additionalProperties": false,
      "required": ["sweptArtifacts", "sweptDimensions"],
      "properties": {
        "sweptArtifacts": {
          "type": "array",
          "items": { "type": "string" },
          "description": "扫掠的产物路径列表"
        },
        "sweptDimensions": {
          "type": "array",
          "items": { "type": "string", "enum": ["completeness", "reliability", "security"] },
          "description": "扫掠维度（三维度须全覆盖）",
          "minItems": 3,
          "maxItems": 3
        }
      }
    },
    "summary": {
      "type": "string",
      "minLength": 50,
      "description": "扫掠一句话结论（至少50字符，含发现数+维度覆盖+终止判定）"
    },
    "passed": {
      "type": "boolean",
      "description": "true=newFindings为空（可终止/放行），false=有新发现（须走返工）。check-iceberg-sweep.ts R8 校验 passed 与 newFindings 一致性"
    }
  }
}
```

- [ ] **Step 2: 验证 schema 可被 loader 加载**

Run: `npx tsx w-model-dev/scripts/schema-loader.ts` 的既有自测（若 loader 无独立自测，则跳过直接依赖后续 Task 4 的 self-test；**不新增 loader 测试**——schema 加入目录后自动被 Ajv 加载，Task 4 自检会验证）。

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/schemas/iceberg-sweep.schema.json
git commit -m "feat(iceberg): add iceberg-sweep.schema.json (IcebergSweepReport shape)"
```

---

## Task 2: iceberg-sweep-logic.ts + 单测（TDD）

**Files:**
- Create: `w-model-dev/scripts/iceberg-sweep-logic.ts`
- Create: `w-model-dev/scripts/__tests__/iceberg-logic.test.ts`

- [ ] **Step 1: 写失败单测**

创建 `w-model-dev/scripts/__tests__/iceberg-logic.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { checkIcebergSweep, type IcebergSweepReport } from '../iceberg-sweep-logic.js';

function validReport(overrides: Partial<IcebergSweepReport> = {}): IcebergSweepReport {
  return {
    reportId: 'IS-phase3-1-01',
    phase: 'phase3-outline',
    triggerType: 'ICEBERG-A',
    icebergRound: 1,
    sweptAt: '2026-08-08T10:00:00Z',
    sweptBy: 'R-iceberg',
    线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
    newFindings: [],
    sweepCoverage: { sweptArtifacts: ['docs/phase3-outline/blog-system-outline-design.md'], sweptDimensions: ['completeness', 'reliability', 'security'] },
    summary: '本次扫掠覆盖三维度共 1 份产物，未发现新的隐藏问题，建议放行。',
    passed: true,
    ...overrides,
  };
}

describe('checkIcebergSweep', () => {
  it('合法报告且无新发现 → passed=true', () => {
    const r = checkIcebergSweep(validReport());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it('icebergRound=0 越界 → passed=false（R5）', () => {
    const r = checkIcebergSweep(validReport({ icebergRound: 0 }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.includes('icebergRound'))).toBe(true);
  });

  it('icebergRound=6 越界 → passed=false（R5）', () => {
    const r = checkIcebergSweep(validReport({ icebergRound: 6 }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.includes('icebergRound'))).toBe(true);
  });

  it('findingId 与 previousFindings 重复 → passed=false（R6）', () => {
    const r = checkIcebergSweep(validReport({
      线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: ['IF-phase3-1-01'] },
      newFindings: [{
        findingId: 'IF-phase3-1-01',
        severity: 'Required',
        category: 'same-defect-class',
        location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
        description: '重复发现的转移守卫缺陷',
        evidence: '状态机图 §3.2 缺 archived 守卫',
        hypothesis: '若补齐守卫，archived 状态不可发布',
        relatedFixedPoint: 'IS-phase3-1-01',
      }],
      passed: false,
    }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.includes('已在上一轮发现'))).toBe(true);
  });

  it('finding 缺 hypothesis 或 evidence → passed=false（R7）', () => {
    const r = checkIcebergSweep(validReport({
      newFindings: [{
        findingId: 'IF-phase3-1-02',
        severity: 'Required',
        category: 'coverage-gap',
        location: 'docs/phase3-outline/blog-system-outline-design.md:L50',
        description: 'SD-007 未建模',
        evidence: 'graph.json type=SD 节点全集含 SD-007',
        hypothesis: '',
        relatedFixedPoint: 'IS-phase3-1-01',
      }],
      passed: false,
    }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.includes('hypothesis'))).toBe(true);
  });

  it('passed 与 newFindings 不一致 → passed=false（R8）', () => {
    const r = checkIcebergSweep(validReport({
      newFindings: [{
        findingId: 'IF-phase3-1-03',
        severity: 'Required',
        category: 'adjacent-logic',
        location: 'docs/phase3-outline/blog-system-outline-design.md:L60',
        description: 'UnpublishArticle 未校验 archived',
        evidence: '状态机图 §3.2 Unpublish 转移',
        hypothesis: '若补齐守卫，archived 文章不可下架',
        relatedFixedPoint: 'IS-phase3-1-01',
      }],
      passed: true,
    }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.includes('passed 不一致'))).toBe(true);
  });

  it('schema 违规（缺 required 字段 sweptBy）→ passed=false（R1）', () => {
    const { sweptBy, ...rest } = validReport();
    const r = checkIcebergSweep(rest as IcebergSweepReport);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(m => m.startsWith('[schema]'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/iceberg-logic.test.ts`
Expected: FAIL — `Cannot find module '../iceberg-sweep-logic.js'`

- [ ] **Step 3: 实现纯逻辑层**

创建 `w-model-dev/scripts/iceberg-sweep-logic.ts`：

```typescript
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/iceberg-logic.test.ts`
Expected: PASS — 7 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/iceberg-sweep-logic.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts
git commit -m "feat(iceberg): add iceberg-sweep-logic.ts + R1/R5-R8 unit tests"
```

---

## Task 3: check-iceberg-sweep.ts CLI 层

**Files:**
- Create: `w-model-dev/scripts/check-iceberg-sweep.ts`

- [ ] **Step 1: 创建 CLI 脚本**

先读 `w-model-dev/scripts/check-preventive-review.ts` 全文（第 24-34 行 `reportFilePrefix` 函数、第 36-200 行 `main()`、`exitWithError` 6 类错误码），严格对齐其结构。然后创建 `w-model-dev/scripts/check-iceberg-sweep.ts`：

```typescript
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkIcebergSweep, type IcebergSweepReport } from './iceberg-sweep-logic.js';
import { exitWithError, CliErrorCode } from './lib/cli-error.js';
import { parseJsonSafe } from './lib/safe-json.js';
import { readJsonOrExit } from './lib/read-json-or-exit.js';
import { writeGateReport } from './lib/gate-report.js';

const ICEBERG_JSON = {
  script: 'check-iceberg-sweep.ts',
  exitCode: 0,
  passed: true,
  reasons: [] as string[],
  reportSummary: null as unknown,
};

function parseArgs(argv: string[]): { reportPath: string; autoTrigger: boolean; runLogPath?: string } {
  const reportPath = argv[0];
  const autoTrigger = argv.includes('--auto-trigger');
  const runLogIdx = argv.indexOf('--run-log');
  if (!reportPath) {
    throw exitWithError(CliErrorCode.ARG_INVALID, '缺少 <report.json> 参数', ICEBERG_JSON);
  }
  if (runLogIdx === -1) {
    return { reportPath, autoTrigger: false };
  }
  const runLogPath = argv[runLogIdx + 1];
  if (!runLogPath) {
    throw exitWithError(CliErrorCode.ARG_INVALID, '--run-log 缺少值', ICEBERG_JSON);
  }
  return { reportPath, autoTrigger, runLogPath };
}

function readReport(reportPath: string): IcebergSweepReport {
  const raw = readFileSync(reportPath, 'utf8');
  const parsed = parseJsonSafe(raw, reportPath);
  if (!parsed.ok) {
    throw exitWithError(CliErrorCode.FILE_PARSE, `报告解析失败：${parsed.error}`, ICEBERG_JSON);
  }
  return parsed.value as IcebergSweepReport;
}

function main(): void {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const report = readReport(args.reportPath);
  const result = checkIcebergSweep(report);

  ICEBERG_JSON.exitCode = result.passed ? 0 : 1;
  ICEBERG_JSON.passed = result.passed;
  ICEBERG_JSON.reasons = result.reasons;
  ICEBERG_JSON.reportSummary = result.reportSummary;

  process.stdout.write(JSON.stringify(ICEBERG_JSON, null, 2) + '\n');
  const logPath = writeGateReport('iceberg-sweep', ICEBERG_JSON);
  process.stdout.write(`gate-log: ${logPath}\n`);
  process.exit(ICEBERG_JSON.exitCode);
}

main();
```

> 注：`lib/gate-report.ts` 的 `writeGateReport(name, payload)` 签名请先读取实际实现对齐；若不存在则沿用 `check-preventive-review.ts` 的 gate-log 写入方式（`join(projectDir, '.w-model', 'gate-logs', ...)`）。`parseJsonSafe` 返回值形态（`{ ok, value, error }`）以 `lib/safe-json.ts` 实际实现为准。

- [ ] **Step 2: 手工冒烟测试**

Run: `npx tsx w-model-dev/scripts/check-iceberg-sweep.ts w-model-dev/scripts/samples/iceberg/valid-full.json`
（先创建样本，见 Task 4 Step 1）
Expected: 退出码 0，stdout 输出 `"exitCode": 0` 的 ICEBERG_JSON

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/check-iceberg-sweep.ts
git commit -m "feat(iceberg): add check-iceberg-sweep.ts CLI (exit 0/1/2)"
```

---

## Task 4: 样本 + self-test.ts 基线扩展

**Files:**
- Create: `w-model-dev/scripts/samples/iceberg/valid-full.json`
- Create: `w-model-dev/scripts/samples/iceberg/bad-round-out-of-range.json`
- Create: `w-model-dev/scripts/samples/iceberg/bad-duplicate-finding.json`
- Create: `w-model-dev/scripts/samples/iceberg/bad-missing-evidence.json`
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 创建 valid 样本**

创建 `w-model-dev/scripts/samples/iceberg/valid-full.json`（内容为 Task 2 Step 1 的 `validReport()` 展开后的完整 JSON，passed=true，newFindings=[]，summary ≥50 字符）。

- [ ] **Step 2: 创建 3 个 bad 样本**

- `bad-round-out-of-range.json`：同 valid 但 `icebergRound: 6`（触发 R5）
- `bad-duplicate-finding.json`：`previousFindings: ["IF-phase3-1-01"]` 且 `newFindings[0].findingId: "IF-phase3-1-01"`（触发 R6）
- `bad-missing-evidence.json`：`newFindings[0].evidence: ""`（触发 R7）

- [ ] **Step 3: 扩展 self-test.ts**

先读 `w-model-dev/scripts/self-test.ts` 中 `PreventiveReviewCase` 接口 + `PREVENTIVE_REVIEW_CASES` 数组 + `runPreventiveReviewCases` 执行器 + `main()` 中对应调用段（约 4 处），严格仿照追加：

```typescript
interface IcebergCase {
  name: string;
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns: string[];
}

const ICEBERG_CASES: IcebergCase[] = [
  { name: 'valid-full', file: 'valid-full.json', expectedPassed: true, expectedReasonPatterns: [] },
  { name: 'bad-round-out-of-range', file: 'bad-round-out-of-range.json', expectedPassed: false, expectedReasonPatterns: ['icebergRound'] },
  { name: 'bad-duplicate-finding', file: 'bad-duplicate-finding.json', expectedPassed: false, expectedReasonPatterns: ['已在上一轮发现'] },
  { name: 'bad-missing-evidence', file: 'bad-missing-evidence.json', expectedPassed: false, expectedReasonPatterns: ['evidence'] },
];

function runIcebergCases(samplesDir: string): { total: number; failed: number } {
  // 仿照 runPreventiveReviewCases：读取 samples/iceberg/<file> → checkIcebergSweep
  // → 断言 passed 与 expectedPassed 一致 + 每个 expectedReasonPatterns 在 reasons 中可匹配（matchReasonPatterns）
  // → 收集失败信息
}
```

并在 `main()` 的 `Promise.all` 中追加 `runIcebergCases(samplesDir)`。

- [ ] **Step 4: 运行 self-test 验证**

Run: `npm run self-test`
Expected: 退出码 0，基线 213 → 217 条（+4 冰山样本），输出含 `iceberg: 4/4 passed`

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/samples/iceberg/ w-model-dev/scripts/self-test.ts
git commit -m "feat(iceberg): extend self-test baseline with 4 iceberg samples"
```

---

## Task 5: run-log.schema.json action 枚举扩展

**Files:**
- Modify: `w-model-dev/schemas/run-log.schema.json`

- [ ] **Step 1: 追加 2 个 action 值**

读 `w-model-dev/schemas/run-log.schema.json`，将 `action` 属性 enum 从 25 值扩展为 27 值，在 `"ensure_deps"` 后追加：

```json
"iceberg-sweep",
"iceberg-review"
```

同步更新 `description` 中的"共 25 值"→"共 27 值"，并追加说明：`iceberg-sweep`=R-iceberg 分派 / `iceberg-review`=V 复审冰山报告。

- [ ] **Step 2: 验证 schema 加载**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: PASS（既有 run-log 单测不回归）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/schemas/run-log.schema.json
git commit -m "feat(iceberg): extend run-log action enum with iceberg-sweep/iceberg-review"
```

---

## Task 6: references/iceberg-sweep-guide.md

**Files:**
- Create: `w-model-dev/references/iceberg-sweep-guide.md`

- [ ] **Step 1: 创建方法论指南**

创建文件，内容结构（完全取自 spec §3.6，扩充为可执行指南）：
1. 冰山理论在 W 模型的映射（表格，取自 spec §1.2）
2. 触发时机（ICEBERG-A / ICEBERG-B + 触发边界 + 计数示例，取自 spec §3.2/§3.3）
3. 六类别深挖方法（表 + 每类别深挖方向 + check 脚本盲区对照，取自 spec §3.6.2/§3.6.4）
4. TLA+ 状态机一致性六类别应用示例（完整复刻 spec §3.6.3 的 6 类示例）
5. 扫掠流程（spec §3.6.5 的 5 步）
6. 产出契约 + 禁止事项（spec §3.4 角色定义）

- [ ] **Step 2: 提交**

```bash
git add w-model-dev/references/iceberg-sweep-guide.md
git commit -m "docs(iceberg): add iceberg-sweep-guide.md methodology reference"
```

---

## Task 7: references/anti-patterns.md 反模式 #44

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 追加 #44 反模式**

读文件末尾（#43 之后），追加（遵循既有格式 `## #N 标题（轮次新增）` + 症状/为何/检测信号/回退动作/门禁脚本/关联）：

```markdown
## #44 跳过冰山扫掠直接放行（第 36 轮新增）

**症状**：S-fix 后或阶段门放行前未分派 R-iceberg；或 R-iceberg 发现新问题后未经 V 复审直接放行。

**为何是反模式**：已修复问题只是"水面之上 1/8"，水面之下的同根因扩散/同缺陷类/修复引入回归/相邻逻辑隐患被掩盖，缺陷后移到下游阶段才暴露，修复成本指数级上升。V/G 通过仅证明"既定标准下无问题"，不证明"同类深挖下无问题"。

**检测信号**：
- run-log 中 S-fix 后无 `action=iceberg-sweep` 条目
- 阶段门 CHECKPOINT 前无 ICEBERG-B 报告
- IcebergSweepReport 存在但无对应 V 复审 VerifierOutput
- `check-iceberg-sweep.ts` 退出码 1

**回退动作**：回到 S-fix 产出后起点（ICEBERG-A）或阶段门放行前（ICEBERG-B），补跑 R-iceberg + V 复审。

**门禁脚本**：`check-iceberg-sweep.ts`

**关联**：SSoT §3.4.34（[36.0.0] 新增）；[iceberg-sweep-guide.md](iceberg-sweep-guide.md)
```

- [ ] **Step 2: 更新目录**

读文件头部目录区（第 7-16 行），追加 `#44 第 36 轮新增` 到反模式清单行尾（原 `#43 第三十一轮新增` 之后）。

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "docs(iceberg): add anti-pattern #44 skip-iceberg-sweep"
```

---

## Task 8: subagent-delegation.md + root-cause-locator.md

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`
- Modify: `w-model-dev/references/root-cause-locator.md`

> 注意：这两份文档按用户偏好**串行修改**，先 subagent-delegation.md 完成提交后，再改 root-cause-locator.md。

- [ ] **Step 1: subagent-delegation.md — 目录追加**

读文件目录区，在 `### R3 预防性审查分派模板` 条目后追加 `### R-iceberg 冰山扫掠分派模板（第36轮新增）`。

- [ ] **Step 2: subagent-delegation.md — 追加分派模板节**

在 R3 模板节之后追加（内容取自 spec §3.7，含分派时序 ICEBERG-A/B + 产出路径 `.w-model/iceberg/<reportId>.json` + 禁止事项）。

- [ ] **Step 3: subagent-delegation.md — 提交**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(iceberg): add R-iceberg delegation template to subagent-delegation.md"
```

- [ ] **Step 4: root-cause-locator.md — 追加边界节**

读文件末尾，追加节 `### R 与 R-iceberg 的边界（第36轮新增）`，内容：R=被动定位已暴露问题根因（单问题根因链）；R-iceberg=主动深挖未暴露隐藏问题（多发现扫掠报告）；触发时机/产出/schema 三列对比表；互不替代声明。

- [ ] **Step 5: root-cause-locator.md — 提交**

```bash
git add w-model-dev/references/root-cause-locator.md
git commit -m "docs(iceberg): add R vs R-iceberg boundary section to root-cause-locator.md"
```

---

## Task 9: SKILL.md 编排时序 + 版本号

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: frontmatter 版本号 35.0.0 → 36.0.0**

读第 1-9 行，将 `version: 35.0.0` 改为 `version: 36.0.0`。

- [ ] **Step 2: 执行工作流第 9 步追加冰山扫掠**

读"执行工作流"第 9 步（验证与暂停），在其后追加第 9.5 步：

```markdown
9.5. **冰山扫掠**（O → R-iceberg，第 36 轮新增）：S-fix 后（ICEBERG-A）或阶段门放行前（ICEBERG-B），分派 R-iceberg 子代理以已发现/已修复问题为线索深挖隐藏问题，产出 `.w-model/iceberg/<reportId>.json`（IcebergSweepReport）。G 子代理跑 `check-iceberg-sweep.ts` 校验。`newFindings=[]` 即终止；达 maxIcebergRounds=5 时 CHECKPOINT 升级由用户裁定。
```

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(iceberg): bump SKILL.md to 36.0.0 + add iceberg sweep to workflow"
```

---

## Task 10: 顶层文档 + 版本号同步 + 最终验证

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `w-model-dev/skill-metadata.json`

> 顶层文档按用户偏好**串行修改**（SSoT → AGENTS.md → CHANGELOG.md → README.md），每份提交后继续下一份。

- [ ] **Step 1: SSoT — §3.4.34 新节**

读 `docs/skill-design-document_SSoT.md` §3.4.33（第 35 轮节）之后，追加：

```markdown
#### 3.4.34 第 36 轮：冰山扫掠深度分析机制（2026-08-08，[36.0.0]）
新增 R-iceberg 冰山扫掠机制：S-fix 后（ICEBERG-A）与阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索主动深挖隐藏问题，直到 newFindings=[] 或达 maxIcebergRounds=5。新增 iceberg-sweep.schema.json + check-iceberg-sweep.ts + 反模式 #44。
```

- [ ] **Step 2: SSoT — §10A 追溯表追加行**

在 §10A 表格末尾追加：

```markdown
| §3.4.34 第 36 轮 冰山扫掠深度分析 | 双重触发（ICEBERG-A/B）+ 六类别深挖 + maxIcebergRounds=5 | iceberg-sweep.schema.json + iceberg-sweep-logic.ts + check-iceberg-sweep.ts + iceberg-sweep-guide.md + anti-patterns.md #44 | 完整（self-test 217/217、vitest 全绿、tsc 0 错误） |
```

- [ ] **Step 3: SSoT — 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(iceberg): add SSoT §3.4.34 + §10A traceability row"
```

- [ ] **Step 4: AGENTS.md — §4 参考实现追加第 36 轮表格**

在 §4 表格区末尾追加一行：`| **第三十六轮**（2026-08-08）：冰山扫掠深度分析（新增反模式 #44，版本 36.0.0） |`（列数与既有表格对齐）。

- [ ] **Step 5: AGENTS.md — §8 脚本导航表追加行**

在 §8 表格末尾追加：

```markdown
| check-iceberg-sweep.ts | IcebergSweepReport 校验（R1 schema 前置 / R5 round 边界 1-5 / R6 去重 / R7 可证伪 / R8 passed 一致性，反模式 #44；CLI <report.json> 或 --auto-trigger --run-log=<path>） | 1-8（S-fix 后 / 阶段门前） | 0=通过，1=校验失败，2=输入错误 |
```

- [ ] **Step 6: AGENTS.md — 提交**

```bash
git add AGENTS.md
git commit -m "docs(iceberg): add round-36 row to AGENTS.md §4 + script nav row §8"
```

- [ ] **Step 7: CHANGELOG.md — 追加 36.0.0 条目**

读文件头部，追加 `## [36.0.0] - 2026-08-08` 条目（新增机制 + 反模式 #44 + 文件清单），格式与既有条目对齐。

- [ ] **Step 8: CHANGELOG.md — 提交**

```bash
git add CHANGELOG.md
git commit -m "docs(iceberg): add 36.0.0 changelog entry"
```

- [ ] **Step 9: README.md — 反模式计数 43→44**

读 README.md 第 21 行核心能力 bullet，将"43 条流程反模式"改为"44 条流程反模式"，并在枚举中 `#43 敏感信息写入状态文件/日志` 后追加 ` / #44 跳过冰山扫掠直接放行`。

- [ ] **Step 10: README.md — 提交**

```bash
git add README.md
git commit -m "docs(iceberg): bump anti-pattern count 43→44 in README"
```

- [ ] **Step 11: 版本号同步（package.json + skill-metadata.json）**

将 `package.json` 与 `w-model-dev/skill-metadata.json` 的 `"version": "35.0.0"` 均改为 `"version": "36.0.0"`。

- [ ] **Step 12: 最终验证套件**

Run（依次）:
```bash
npx tsc --noEmit
npm run self-test
npx vitest run
```
Expected: tsc 0 错误；self-test 退出码 0 且基线 217/217；vitest 全绿（459 + 7 = 466 用例）。

- [ ] **Step 13: 版本号一致性提交**

```bash
git add package.json w-model-dev/skill-metadata.json
git commit -m "chore: bump version to 36.0.0 across package.json + skill-metadata.json"
```

- [ ] **Step 14: 最终提交 + 验证记录**

```bash
git add -A
git commit -m "feat(iceberg): complete iceberg sweep deep-analysis mechanism [36.0.0]"
```

Run: `npx vitest run w-model-dev/scripts/__tests__/skill-metadata.test.ts`
Expected: PASS（版本号双写一致性守护）

---

## 自审记录（writing-plans Self-Review）

**1. Spec 覆盖：**
- §3.2 双重触发 → Task 6（指南）+ Task 9（SKILL.md 时序）
- §3.3 终止判据 maxIcebergRounds=5 → Task 2（MAX_ICEBERG_ROUNDS）+ Task 1（schema maximum:5）
- §3.5 Schema → Task 1
- §3.6 方法论 + TLA+ 示例 → Task 6（指南完整复刻）
- §3.7 分派模板 → Task 8（subagent-delegation.md）
- §3.8/3.9 check 脚本 + logic → Task 2/3
- §3.10 反模式 #44 → Task 7
- §3.11 run-log 扩展 → Task 5
- §3.12 编排时序 → Task 9
- §4 影响范围 → Task 1-10 全覆盖（含版本号三处）
- §5 验收标准 → Task 10 Step 12 最终验证 + 各 Task 单测

**2. 占位符扫描：** 无 TBD/TODO；所有代码步骤含完整代码或明确读取指令（CLI 层与既有 lib 的签名对齐需读实际文件，已注明读取目标，非占位符）。

**3. 类型一致性：** `IcebergSweepReport` / `IcebergFinding` / `IcebergSweepCheckResult` 在 Task 2 logic + Task 2 测试 + Task 3 CLI 中签名一致；`线索来源` 中文键名三处一致（logic 接口 / 测试 / schema）；`MAX_ICEBERG_ROUNDS = 5` 与 schema `maximum: 5` 一致；`validateBySchema('iceberg-sweep', ...)` 与 schema 文件 basename `iceberg-sweep.schema.json` 一致。
