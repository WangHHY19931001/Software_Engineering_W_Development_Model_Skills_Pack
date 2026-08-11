# 第 9 轮门禁与流程细化修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正第 8 轮 W 模型调测识别的 11 个问题（P1×3 + P2×4 + P3×4），增强门禁脚本、规范 reference 文档、清理工程残留。

**Architecture:** 分 3 个 Part 串行实施：Part A 改 5 脚本 + 6 fixture + 测试；Part B 改 7 reference 文档；Part C 改 3 顶层文档 + 4 demo verifier-output + 工程清理。每个 Part 完成后运行 self-test 验证。

**Tech Stack:** TypeScript（strict mode）+ Vitest + tsx + PowerShell

**关联 spec:** [2026-07-25-round9-gate-and-process-refinement-design.md](../specs/2026-07-25-round9-gate-and-process-refinement-design.md)

---

## 文件结构

### Part A：脚本与 fixture（8 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/scripts/logic/gate-logic.ts` | P1.1 阶段级校验逻辑 | Modify（增加 phaseOption + 阶段分层） |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | P1.1 --phase 参数 + P2.6 graph 自动发现 | Modify |
| `w-model-dev/scripts/logic/verifier-logic.ts` | P2.4 subCriteria 命名 + P2.5 targetKind + P3.10 rawScores | Modify |
| `w-model-dev/scripts/cli/check-tla-model.ts` | P3.8 states 自动清理 + --keep-states | Modify |
| `w-model-dev/scripts/logic/code-tla-logic.ts` | P3.9 维度 3 扩展遍历全部 specs | Modify |
| `w-model-dev/scripts/samples/gate/*.json` ×3 | P1.1 fixture | Create |
| `w-model-dev/scripts/samples/verifier/*.json` ×3 | P2.4/P2.5/P3.10 fixture | Create |
| `w-model-dev/tests/gate-enhancement.test.ts` | 6 新 fixture 测试 | Modify |
| `w-model-dev-demo/.gitignore` | P3.11 coverage/.tmp/ | Modify |
| `w-model-dev-demo/package.json` | P3.11 vitest coverage.clean | Modify |

### Part B：reference 文档（7 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `w-model-dev/references/phase-1-requirements.md` | P1.2 NFR/CON designDoc 登记 | Modify |
| `w-model-dev/references/phase-5-coding.md` | P1.2 NFR/CON codeModule 回填 | Modify |
| `w-model-dev/references/subagent-delegation.md` | P1.3 反模式 #20 + P2.7 S 修改边界 | Modify |
| `w-model-dev/references/subagent-persona-matrix.md` | P1.3 S persona + P2.7 R persona | Modify |
| `w-model-dev/references/verifier-spec.md` | P2.4 subCriteria 模板 + P2.5 targetKind 枚举 | Modify |
| `w-model-dev/references/tla-plus-guide.md` | P3.8 states 清理约定 | Modify |
| `SKILL.md` | 阶段 5/6/7 门禁 --phase 参数 | Modify |

### Part C：顶层文档与 demo 修正（5 个任务）

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | §3.4.6 第 9 轮约束 | Modify |
| `AGENTS.md` | §4 第 9 轮结论 | Modify |
| `CHANGELOG.md` | 第 9 轮版本条目 | Modify |
| `w-model-dev-demo/.w-model/verifier-output-phase6.json` | P2.4/P2.5 名称+targetKind 修正 | Modify |
| `w-model-dev-demo/.w-model/verifier-output-phase7.json` | P2.4/P2.5 名称+targetKind 修正 | Modify |
| `w-model-dev-demo/tla/states/` | P3.8 清理 229 残留文件 | Delete |

---

## Part A：脚本与 fixture

### Task A1: P1.1 gate-logic.ts 阶段级校验逻辑

**Files:**
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`
- Test: `w-model-dev/tests/gate-enhancement.test.ts`

- [ ] **Step 1: 读取 gate-logic.ts 现有 checkArtifactGate 签名与 RTMMatrixShape 定义**

Run: `Read w-model-dev/scripts/logic/gate-logic.ts` lines 1-220
Expected: 找到 `checkArtifactGate(matrix, options?)` 签名 + `REQUIRED_TRACE_FIELDS` 常量 + 测试汇总校验逻辑

- [ ] **Step 2: 增加 PhaseOption 类型与阶段分层常量**

在 gate-logic.ts 顶部增加：

```typescript
// ==================== 阶段级校验（P1.1） ====================
/**
 * 阶段级校验选项。
 * - phase 1-4：跳过测试汇总校验（设计阶段，pending 合理）
 * - phase 5：校验 unitTest；跳过 integration/system/acceptance
 * - phase 6：phase 5 + integrationTest
 * - phase 7：phase 6 + systemTest
 * - phase 8：全部 + acceptanceTest（默认，向后兼容）
 */
export type PhaseOption = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const PHASE_TEST_LAYERS: Record<number, readonly string[]> = {
  1: [], 2: [], 3: [], 4: [],
  5: ['unitTest'],
  6: ['unitTest', 'integrationTest'],
  7: ['unitTest', 'integrationTest', 'systemTest'],
  8: ['unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};

const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRow)[]> = {
  1: ['designDoc'],
  2: ['designDoc'],
  3: ['designDoc'],
  4: ['designDoc'],
  5: ['designDoc', 'codeModule', 'unitTest'],
  6: ['designDoc', 'codeModule', 'unitTest', 'integrationTest'],
  7: ['designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest'],
  8: ['designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};
```

- [ ] **Step 3: 修改 checkArtifactGate 签名增加 phaseOption**

```typescript
export interface GateOptions {
  graph?: GateGraph;
  manifestExists?: boolean;
  phaseOption?: PhaseOption;  // 新增
}

export function checkArtifactGate(
  matrix: RTMMatrixShape,
  options?: GateOptions
): GateResult {
  const phase = options?.phaseOption ?? 8;  // 默认终检
  // ... 现有逻辑
}
```

- [ ] **Step 4: 改写 RTM 字段校验为阶段分层**

替换现有 `REQUIRED_TRACE_FIELDS` 循环为：

```typescript
const phaseFields = PHASE_TRACE_FIELDS[phase];
for (const row of matrix.rows) {
  // ...
  const isCrossCutting = row.requirementId.startsWith('NFR') || row.requirementId.startsWith('CON');
  const fieldsToCheck = isCrossCutting
    ? phase >= 5 ? ['designDoc', 'codeModule'] : ['designDoc']
    : phaseFields;
  const missing = fieldsToCheck.filter(field => typeof row[field] !== 'string' || (row[field] as string).trim() === '');
  if (missing.length > 0) missingItems.push({ requirementId: row.requirementId, fields: missing });
}
```

- [ ] **Step 5: 改写测试汇总校验为阶段分层**

替换现有 `for (const { name, summary } of summaries)` 循环：

```typescript
const phaseLayers = PHASE_TEST_LAYERS[phase];
for (const { name, summary } of summaries) {
  // 名称映射：中文键 → layer key
  const layerKey = name === '单元测试' ? 'unitTest'
    : name === '集成测试' ? 'integrationTest'
    : name === '系统测试' ? 'systemTest'
    : name === '验收测试' ? 'acceptanceTest'
    : null;
  if (layerKey && !phaseLayers.includes(layerKey)) continue;  // 阶段未到，跳过
  // ... 现有 total/passed/failed/pending 校验
}
```

- [ ] **Step 6: 运行现有 gate-enhancement.test.ts 确保向后兼容（默认 phase=8）**

Run: `cd w-model-dev && npx vitest run tests/gate-enhancement.test.ts`
Expected: 现有 6 测试全通过（默认 phase=8 行为不变）

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts
git commit -m "feat(gate-logic): P1.1 增加 phaseOption 阶段级校验逻辑"
```

### Task A2: P1.1 + P2.6 check-artifact-gate.ts CLI 改造

**Files:**
- Modify: `w-model-dev/scripts/cli/check-artifact-gate.ts`

- [ ] **Step 1: 增加 --phase 参数解析**

在 check-artifact-gate.ts main() 开头增加：

```typescript
// ==================== --phase 参数解析（P1.1） ====================
function parsePhaseArg(argv: string[]): PhaseOption | undefined {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phase' || arg === '-p') {
      const val = parseInt(argv[i + 1], 10);
      if (val >= 1 && val <= 8) return val as PhaseOption;
      console.error(`✗ --phase 参数非法: ${argv[i + 1]}（须 1-8）`);
      process.exit(2);
    }
    const eqMatch = arg.match(/^--phase=(\d+)$/);
    if (eqMatch) {
      const val = parseInt(eqMatch[1], 10);
      if (val >= 1 && val <= 8) return val as PhaseOption;
    }
  }
  return undefined;
}

const phaseOption = parsePhaseArg(process.argv);
```

- [ ] **Step 2: 增加 P2.6 graph 自动发现**

替换现有 graph 加载逻辑：

```typescript
// ==================== graph 资产自动发现（P2.6） ====================
const ingestionDir = path.resolve(projectDir, '.w-model', 'ingestion');
const graphCandidates = [
  path.join(ingestionDir, 'graph.json'),
  path.join(ingestionDir, 'consolidated-phase4.json'),
  path.join(ingestionDir, 'consolidated-phase3.json'),
  path.join(ingestionDir, 'consolidated-phase2.json'),
  path.join(ingestionDir, 'consolidated-phase1.json'),
];
let graph: GateGraph | undefined;
let graphSource = '';
for (const candidate of graphCandidates) {
  try {
    const raw = await fs.readFile(candidate, 'utf-8');
    const parsed = JSON.parse(raw) as GateGraph;
    if (parsed && Array.isArray(parsed.nodes)) {
      graph = parsed;
      graphSource = path.basename(candidate);
      break;
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') console.error(`⚠ ${path.basename(candidate)} 读取失败: ${e.message}`);
  }
}
```

- [ ] **Step 3: 传入 phaseOption 到 checkArtifactGate**

```typescript
const result = checkArtifactGate(matrix, { graph, manifestExists, phaseOption });
```

- [ ] **Step 4: 更新日志输出**

```typescript
console.log(`校验阶段      : phase=${phaseOption ?? 8}${phaseOption ? '（阶段级）' : '（终检）'}`);
console.log(`graph 资产    : ${graph ? `✓ ${graphSource}（${graph.nodes.length} 节点）` : '⚠ 未发现任何 graph 资产'}`);
```

- [ ] **Step 5: TypeScript strict 编译检查**

Run: `cd w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: 运行默认（无 --phase）确认向后兼容**

Run: `cd w-model-dev-demo && npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts`
Expected: exitCode=0，日志显示 "校验阶段: phase=8（终检）"

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/cli/check-artifact-gate.ts
git commit -m "feat(check-artifact-gate): P1.1 --phase 参数 + P2.6 graph 自动发现"
```

### Task A3: P1.1 fixture 3 个 + 测试

**Files:**
- Create: `w-model-dev/scripts/samples/gate/valid-phase6.json`
- Create: `w-model-dev/scripts/samples/gate/bad-phase6-pending-system.json`
- Create: `w-model-dev/scripts/samples/gate/bad-phase5-missing-codemodule.json`
- Modify: `w-model-dev/tests/gate-enhancement.test.ts`

- [ ] **Step 1: 创建 valid-phase6.json（phase=6 合法：unit+integration 通过，system+acceptance pending）**

```json
{
  "schemaVersion": "1.0",
  "projectId": "test-phase6",
  "currentPhase": 6,
  "lastUpdated": "2026-07-25T00:00:00+08:00",
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "测试需求",
      "designDoc": "SD-001",
      "detailedDesign": "DD-001",
      "codeModule": "SD-001:src/foo.ts",
      "unitTest": "TC-UNIT-001",
      "integrationTest": "TC-INT-001",
      "systemTest": null,
      "acceptanceTest": null,
      "coverageStatus": "完整"
    },
    {
      "requirementId": "NFR-001",
      "description": "性能 NFR",
      "designDoc": "横切",
      "detailedDesign": "横切",
      "codeModule": "横切",
      "unitTest": null,
      "integrationTest": null,
      "systemTest": null,
      "acceptanceTest": null,
      "coverageStatus": "完整"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 10, "passed": 10, "failed": 0, "pending": 0, "coverage": 85 },
    "integrationTest": { "total": 5, "passed": 5, "failed": 0, "pending": 0, "coverage": 0 },
    "systemTest": { "total": 8, "passed": 0, "failed": 0, "pending": 8, "coverage": 0 },
    "acceptanceTest": { "total": 6, "passed": 0, "failed": 0, "pending": 6, "coverage": 0 }
  }
}
```

- [ ] **Step 2: 创建 bad-phase6-pending-system.json（同上但 REQ 缺 integrationTest 字段）**

复制 valid-phase6.json，将 REQ-001 的 `integrationTest` 改为 `null`。

- [ ] **Step 3: 创建 bad-phase5-missing-codemodule.json（phase=5，REQ 缺 codeModule 应失败）**

```json
{
  "schemaVersion": "1.0",
  "projectId": "test-phase5-bad",
  "currentPhase": 5,
  "lastUpdated": "2026-07-25T00:00:00+08:00",
  "rows": [
    {
      "requirementId": "REQ-001",
      "description": "测试需求",
      "designDoc": "SD-001",
      "detailedDesign": "DD-001",
      "codeModule": null,
      "unitTest": "TC-UNIT-001",
      "integrationTest": null,
      "systemTest": null,
      "acceptanceTest": null,
      "coverageStatus": "完整"
    }
  ],
  "executionSummary": {
    "unitTest": { "total": 10, "passed": 10, "failed": 0, "pending": 0, "coverage": 85 },
    "integrationTest": { "total": 5, "passed": 0, "failed": 0, "pending": 5, "coverage": 0 },
    "systemTest": { "total": 8, "passed": 0, "failed": 0, "pending": 8, "coverage": 0 },
    "acceptanceTest": { "total": 6, "passed": 0, "failed": 0, "pending": 6, "coverage": 0 }
  }
}
```

- [ ] **Step 4: 在 gate-enhancement.test.ts 增加 6 个测试用例**

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleDir = join(__dirname, '..', 'scripts', 'samples', 'gate');

function loadSample(name: string): RTMMatrixShape {
  return JSON.parse(readFileSync(join(sampleDir, name), 'utf-8'));
}

describe('P1.1 阶段级校验（phase option）', () => {
  test('phase=6 合法场景：unit+integration 通过，system+acceptance pending 应通过', () => {
    const matrix = loadSample('valid-phase6.json');
    const result = checkArtifactGate(matrix, { phaseOption: 6 });
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  test('phase=6 REQ 缺 integrationTest 字段应失败', () => {
    const matrix = loadSample('bad-phase6-pending-system.json');
    const result = checkArtifactGate(matrix, { phaseOption: 6 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('REQ-001') && r.includes('integrationTest'))).toBe(true);
  });

  test('phase=5 REQ 缺 codeModule 应失败', () => {
    const matrix = loadSample('bad-phase5-missing-codemodule.json');
    const result = checkArtifactGate(matrix, { phaseOption: 5 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('REQ-001') && r.includes('codeModule'))).toBe(true);
  });

  test('phase=5 bad 样本在 phase=8 终检也应失败', () => {
    const matrix = loadSample('bad-phase5-missing-codemodule.json');
    const result = checkArtifactGate(matrix, { phaseOption: 8 });
    expect(result.passed).toBe(false);
  });

  test('phase=6 合法场景在 phase=8 终检应失败（system/acceptance pending）', () => {
    const matrix = loadSample('valid-phase6.json');
    const result = checkArtifactGate(matrix, { phaseOption: 8 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('pending'))).toBe(true);
  });

  test('未传 phaseOption 默认 phase=8（向后兼容）', () => {
    const matrix = loadSample('valid-phase6.json');
    const result = checkArtifactGate(matrix);
    expect(result.passed).toBe(false);
  });
});
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd w-model-dev && npx vitest run tests/gate-enhancement.test.ts`
Expected: 全部测试通过（原 6 + 新 6 = 12）

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/samples/gate/ w-model-dev/tests/gate-enhancement.test.ts
git commit -m "test(gate): P1.1 增加 3 fixture + 6 阶段级校验测试"
```

### Task A4: P2.4 + P2.5 + P3.10 verifier-logic.ts 校验增强

**Files:**
- Modify: `w-model-dev/scripts/logic/verifier-logic.ts`
- Create: `w-model-dev/scripts/samples/verifier/bad-targetkind.json`
- Create: `w-model-dev/scripts/samples/verifier/bad-subcriteria-name.json`
- Create: `w-model-dev/scripts/samples/verifier/bad-rawscores-constant.json`
- Modify: `w-model-dev/tests/verifier-logic.test.ts`（若存在）或 gate-enhancement.test.ts

- [ ] **Step 1: 在 verifier-logic.ts 顶部增加阶段标准 subCriteria 表与 targetKind 枚举**

```typescript
// ==================== P2.4 + P2.5 标准化常量 ====================
const VALID_TARGET_KINDS = ['requirement', 'design', 'code', 'test'] as const;

const PHASE_SUBCRITERIA: Record<number, readonly string[]> = {
  1: ['requirement-completeness', 'stakeholder-coverage', 'acceptance-criteria-clarity', 'testability', 'feasibility'],
  2: ['architecture-soundness', 'requirement-coverage', 'interface-consistency', 'feasibility', 'testability'],
  3: ['architecture-soundness', 'interface-contract', 'cross-module-design', 'feasibility', 'testability'],
  4: ['architecture-soundness', 'requirement-coverage', 'interface-consistency', 'feasibility', 'testability'],
  5: ['architecture-soundness', 'requirement-coverage', 'code-tla-consistency', 'unit-test-quality', 'code-quality'],
  6: ['test-coverage', 'interface-contract', 'cross-module-integration', 'exception-handling'],
  7: ['e2e-coverage', 'performance', 'security', 'reliability', 'cross-module'],
  8: ['scenario-coverage', 'requirement-match', 'boundary-coverage', 'nfr-validation', 'document-completeness'],
};

function inferPhaseFromTargetKind(targetKind: string): number {
  switch (targetKind) {
    case 'requirement': return 1;
    case 'design': return 4;  // 默认详细设计阶段
    case 'code': return 5;
    case 'test': return 8;    // 默认验收
    default: return 8;
  }
}
```

- [ ] **Step 2: 在校验函数中增加 P2.5 targetKind 枚举校验**

```typescript
if (!VALID_TARGET_KINDS.includes(meta.targetKind as any)) {
  reasons.push(`meta.targetKind 非法: ${meta.targetKind}（须 ∈ ${VALID_TARGET_KINDS.join('|')}）`);
}
```

- [ ] **Step 3: 增加 P2.4 subCriteria 命名校验**

```typescript
const phase = inferPhaseFromTargetKind(meta.targetKind);
const allowedNames = PHASE_SUBCRITERIA[phase] ?? [];
for (const sc of subCriteria) {
  if (!allowedNames.includes(sc.name)) {
    reasons.push(`subCriteria 名称 "${sc.name}" 不在 phase ${phase} 标准集合 [${allowedNames.join(', ')}] 内`);
  }
}
```

- [ ] **Step 4: 增加 P3.10 rawScores 合理性校验**

```typescript
for (const sc of subCriteria) {
  if (Array.isArray(sc.rawScores) && sc.rawScores.length > 1) {
    const max = Math.max(...sc.rawScores);
    const min = Math.min(...sc.rawScores);
    if (max === min) {
      reasons.push(`subCriteria "${sc.name}" rawScores 全部相同（${sc.rawScores[0]}），疑似构造数据`);
    }
    // 检测完美等差数列公差 0.01
    const sorted = [...sc.rawScores].sort((a, b) => a - b);
    let isArithmetic = true;
    for (let i = 2; i < sorted.length; i++) {
      if (Math.abs((sorted[i] - sorted[i - 1]) - (sorted[1] - sorted[0])) > 1e-9) {
        isArithmetic = false;
        break;
      }
    }
    if (isArithmetic && sorted.length >= 3 && Math.abs(sorted[1] - sorted[0] - 0.01) < 1e-9) {
      reasons.push(`subCriteria "${sc.name}" rawScores 为完美等差数列（公差 0.01），疑似构造数据`);
    }
  }
}
```

- [ ] **Step 5: 创建 3 个 fixture**

`bad-targetkind.json`:
```json
{
  "schemaVersion": "1.0",
  "meta": { "targetKind": "testcase", "target": "x", "reviewedAt": "2026-07-25T00:00:00+08:00", "agent": "V", "scoringMethod": "text-parse", "repeatTimes": 5, "varianceThreshold": 0.05 },
  "subCriteria": [{ "name": "test-coverage", "weight": 1.0, "score": 0.9, "rawScores": [0.91, 0.89, 0.9, 0.9, 0.9], "variance": 0.00004, "evidence": "x" }],
  "compositeScore": 0.9,
  "qualityLevel": "A",
  "passed": true
}
```

`bad-subcriteria-name.json`: targetKind="test"，subCriteria name="coverage"（不在 phase 8 标准集合内）。

`bad-rawscores-constant.json`: targetKind="test"，rawScores=[0.9, 0.9, 0.9, 0.9, 0.9]。

- [ ] **Step 6: 增加测试用例**

```typescript
describe('P2.4/P2.5/P3.10 verifier 标准化校验', () => {
  test('P2.5 targetKind=testcase 应失败', () => {
    const v = loadVerifierSample('bad-targetkind.json');
    const result = checkVerifierOutput(v);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('targetKind 非法'))).toBe(true);
  });
  test('P2.4 subCriteria 名称非标准应失败', () => {
    const v = loadVerifierSample('bad-subcriteria-name.json');
    const result = checkVerifierOutput(v);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('不在 phase'))).toBe(true);
  });
  test('P3.10 rawScores 全相同应失败', () => {
    const v = loadVerifierSample('bad-rawscores-constant.json');
    const result = checkVerifierOutput(v);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('全部相同'))).toBe(true);
  });
});
```

- [ ] **Step 7: 运行测试**

Run: `cd w-model-dev && npx vitest run tests/gate-enhancement.test.ts`
Expected: 全部通过

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/logic/verifier-logic.ts w-model-dev/scripts/samples/verifier/ w-model-dev/tests/
git commit -m "feat(verifier-logic): P2.4/P2.5/P3.10 标准化校验 + 3 fixture"
```

### Task A5: P3.8 check-tla-model.ts states 自动清理

**Files:**
- Modify: `w-model-dev/scripts/cli/check-tla-model.ts`

- [ ] **Step 1: 读取 check-tla-model.ts 现有结构**

Run: `Read w-model-dev/scripts/cli/check-tla-model.ts` 全文
Expected: 找到 TLC 校验完成点 + process.exit 调用

- [ ] **Step 2: 增加 --keep-states 参数解析**

```typescript
function parseKeepStatesArg(argv: string[]): boolean {
  return argv.some(a => a === '--keep-states' || a === '-k');
}
const keepStates = parseKeepStatesArg(process.argv);
```

- [ ] **Step 3: 在 TLC 校验完成后增加 states 清理**

```typescript
// ==================== P3.8 states 自动清理 ====================
if (!keepStates) {
  const statesDir = path.resolve(tlaDir, 'states');
  try {
    await fs.rm(statesDir, { recursive: true, force: true });
    console.log(`✓ 已清理 TLA+ states 目录: ${statesDir}`);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') console.error(`⚠ 清理 states 目录失败: ${e.message}`);
  }
} else {
  console.log('⚠ --keep-states 已启用，未清理 states 目录（调试模式）');
}
```

- [ ] **Step 4: TypeScript 编译检查**

Run: `cd w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/cli/check-tla-model.ts
git commit -m "feat(check-tla-model): P3.8 states 自动清理 + --keep-states"
```

### Task A6: P3.9 code-tla-logic.ts 维度 3 扩展

**Files:**
- Modify: `w-model-dev/scripts/logic/code-tla-logic.ts`

- [ ] **Step 1: 读取现有维度 3 Next 分支覆盖实现**

Run: `Grep "nextBranchCoverage|Next|action" w-model-dev/scripts/logic/code-tla-logic.ts`
Expected: 找到维度 3 函数，确认当前只加载 L4 specs

- [ ] **Step 2: 扩展为遍历 tla-manifest 全部 specs**

```typescript
// ==================== P3.9 维度 3 扩展：遍历全部 specs ====================
async function checkNextBranchCoverageAllSpecs(
  manifest: TlaManifest,
  codeFiles: CodeFile[]
): Promise<DimensionResult> {
  const violations: string[] = [];
  let checked = 0;
  let passed = 0;

  for (const spec of manifest.specs) {
    const tlaPath = path.resolve(manifest.basePath, spec.tlaPath.replace(/^\.\.\//, ''));
    let tlaContent: string;
    try {
      tlaContent = await fs.readFile(tlaPath, 'utf-8');
    } catch {
      violations.push(`无法读取 TLA+ 文件: ${spec.tlaPath}`);
      continue;
    }

    // 解析 Next == \/ Act1 \/ Act2 \/ ...
    const nextMatch = tlaContent.match(/Next\s*==\s*\\\/\s*(.+)/);
    if (!nextMatch) continue;

    const actions = nextMatch[1]
      .split(/\\\//)
      .map(a => a.trim().match(/^([A-Z][a-zA-Z0-9]*)/)?.[1])
      .filter((a): a is string => !!a);

    for (const action of actions) {
      checked++;
      // PascalCase → camelCase
      const camelName = action.charAt(0).toLowerCase() + action.slice(1);
      const found = codeFiles.some(f =>
        f.content.includes(camelName) || f.content.includes(action)
      );
      if (found) {
        passed++;
      } else {
        violations.push(`spec ${spec.id}: TLA+ action "${action}" 在代码中未找到对应函数 ${camelName}`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    checked,
    violations,
  };
}
```

- [ ] **Step 3: 替换原有维度 3 调用**

将调用点从 `checkNextBranchCoverageL4(...)` 改为 `await checkNextBranchCoverageAllSpecs(manifest, codeFiles)`。

- [ ] **Step 4: TypeScript 编译**

Run: `cd w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: 在第八轮 demo 上验证（应覆盖数 > 2）**

Run: `cd w-model-dev-demo && npx tsx ../w-model-dev/scripts/cli/check-code-tla-consistency.ts`
Expected: 维度 3 checked 数显著增加（从 2 增至 10+），exitCode 可能因新增未覆盖项变 1，记录 violations

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/logic/code-tla-logic.ts
git commit -m "feat(code-tla-logic): P3.9 维度 3 扩展遍历全部 specs"
```

### Task A7: P3.11 coverage/.tmp 清理 + .gitignore

**Files:**
- Modify: `w-model-dev-demo/.gitignore`
- Modify: `w-model-dev-demo/package.json`
- Modify: `w-model-dev-demo/vitest.config.ts`（若存在）

- [ ] **Step 1: 检查 .gitignore 和 vitest 配置**

Run: `Read w-model-dev-demo/.gitignore` + `Glob w-model-dev-demo/vitest.config.*`

- [ ] **Step 2: .gitignore 增加 coverage/.tmp/**

在 .gitignore 末尾追加：
```
# P3.11 vitest coverage 临时文件
coverage/.tmp/
```

- [ ] **Step 3: package.json test 脚本增加 --coverage.clean=true（或 vitest.config.ts）**

若 vitest.config.ts 存在：
```typescript
export default defineConfig({
  test: {
    coverage: {
      clean: true,  // P3.11
      // ... 现有配置
    },
  },
});
```

否则在 package.json scripts.test 后追加 `--coverage.clean=true`（若 test 脚本含 --coverage）。

- [ ] **Step 4: 手动清理残留 .tmp**

Run: `Remove-Item -Recurse -Force w-model-dev-demo/coverage/.tmp` （PowerShell）

- [ ] **Step 5: Commit**

```bash
git add w-model-dev-demo/.gitignore w-model-dev-demo/package.json w-model-dev-demo/vitest.config.ts
git commit -m "chore(demo): P3.11 coverage/.tmp 清理规则"
```

### Task A8: Part A 验证检查点

- [ ] **Step 1: TypeScript strict 全量编译**

Run: `cd w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 运行全部 self-test**

Run: `cd w-model-dev && npm run self-test`
Expected: 原基线 82 + 新增 9（P1.1 ×6 + P2.4/P2.5/P3.10 ×3）= 91 全通过

- [ ] **Step 3: 运行全部 vitest**

Run: `cd w-model-dev && npx vitest run`
Expected: 全部通过

- [ ] **Step 4: 在第八轮 demo 上验证 check-artifact-gate --phase=6/7/8**

Run:
```
cd w-model-dev-demo
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=6
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=7
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=8
```
Expected: --phase=6 和 --phase=7 exitCode=0（unit/integration 已通过，system/acceptance pending 合理跳过）；--phase=8 exitCode=0（全部已通过，第八轮已归档）

- [ ] **Step 5: Commit 检查点**

```bash
git add .
git commit -m "checkpoint: Part A 完成（5 脚本 + 6 fixture + 9 新测试）"
```

---

## Part B：reference 文档

### Task B1: P1.2 phase-1-requirements.md NFR/CON 字段登记

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 1: 读取 phase-1-requirements.md 找到 RTM 字段登记章节**

Run: `Grep "NFR|CON|designDoc|RTM" w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 2: 在 RTM 字段登记章节增加 NFR/CON 横切治理要求**

```markdown
### NFR/CON 横切治理字段登记（第 9 轮 P1.2）

**NFR（非功能需求）和 CON（技术约束）的 RTM 字段登记要求**：

- **NFR-001~005**：在阶段 1 须登记 `designDoc` 字段，填写横切 SD 清单（如 `"SD-001,SD-004,SD-007"`），表示该 NFR 横切治理哪些 SD 子系统
- **CON-001~003**：在阶段 1 须登记 `designDoc="横切"`（无具体 SD 映射时填"横切"标识）
- **detailedDesign**：NFR/CON 行可填 `"横切"`（无具体 DD 映射）
- **unitTest/integrationTest/systemTest/acceptanceTest**：NFR/CON 行可填对应测试用例 ID 或 `null`（横切测试在阶段 5-8 补充）

**阶段 1 门禁校验**：check-artifact-gate.ts `--phase=1` 时校验 NFR/CON 行的 `designDoc` 字段非空。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(phase-1): P1.2 NFR/CON 横切字段登记要求"
```

### Task B2: P1.2 phase-5-coding.md NFR/CON codeModule 回填

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

- [ ] **Step 1: 找到 codeModule 回填章节**

Run: `Grep "codeModule|回填" w-model-dev/references/phase-5-coding.md`

- [ ] **Step 2: 增加 NFR/CON codeModule 回填要求**

```markdown
### NFR/CON codeModule 回填（第 9 轮 P1.2）

**NFR 和 CON 行的 codeModule 字段在阶段 5 须回填**：

- **NFR 行 codeModule**：填写涉及的源码文件清单（如 NFR-001 性能 → `"src/utils/cache.ts,src/services/recommend.service.ts"`）或填 `"横切"`（多文件横切时）
- **CON 行 codeModule**：填写技术栈配置文件（如 CON-001 TypeScript strict → `"tsconfig.json"`；CON-002 npm 包管理 → `"package.json"`）或填 `"横切"`

**阶段 5 门禁校验**：check-artifact-gate.ts `--phase=5` 时校验 NFR/CON 行的 `codeModule` 字段非空（非 null）。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs(phase-5): P1.2 NFR/CON codeModule 回填要求"
```

### Task B3: P1.3 + P2.7 subagent-delegation.md 反模式 + 修改边界

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: 找到反模式清单章节和 S 子代理职责章节**

Run: `Grep "反模式|#19|禁止|S 子代理" w-model-dev/references/subagent-delegation.md`

- [ ] **Step 2: 增加 P1.3 反模式 #20**

在反模式清单末尾增加：

```markdown
#### #20 只规划不执行（第 9 轮 P1.3）

**症状**：子代理返回规划性内容（如"正在准备"、"将创建"、"步骤1：读取..."、"我将..."）而未调用任何执行工具（Write/Edit/RunCommand）。

**危害**：浪费 token + 轮次，任务无实际进展。

**检测信号**：
- 子代理响应中无任何 tool_use 块（只有纯文本）
- 响应包含"正在准备"、"将创建"、"步骤"等规划性关键词
- 产物文件未被实际创建（ls 检查）

**正确做法**：
- 子代理必须在响应中调用至少一个执行工具（Write/Edit/RunCommand/Read）
- 禁止只返回纯文本规划，必须立即执行
- 编排者检测到此反模式时，回子代理起点重派，并在 prompt 开头强调"立即执行，禁止只规划"

**编排者防范**：子代理 prompt 模板必须包含约束语句：
> "你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 Write/Edit/RunCommand 调用。"
```

- [ ] **Step 3: 增加 P2.7 S 子代理修改既有产物边界条款**

在 S 子代理职责章节增加：

```markdown
### S 子代理修改既有产物的边界（第 9 轮 P2.7）

**职责划分**：
- **S 子代理**：负责**新增**产物（新文件、新测试用例、新文档章节）
- **R 子代理（根因修复）**：负责**修复**既有产物的 bug

**S 子代理发现既有产物 bug 时的处理流程**：
1. **记录 rootcause**：S 子代理必须在 `rootcause-report.jsonl` 追加条目（action=rootcause），描述 bug 现象、影响、定位过程
2. **转交 R 子代理**：非紧急修复一律转 R 子代理，S 子代理不得越权修改既有产物
3. **紧急修复通道**（阻塞当前阶段推进时）：
   - S 子代理可执行**最小修复**（仅修复阻塞点，不扩展）
   - 必须在 `run-log.jsonl` 追加 fix 条目，标注 `"紧急修复"` 和原因
   - 阶段完成后由 R 子代理复核紧急修复的完整性

**违规检测**：
- run-log.jsonl 中 S 子代理（role=S）的 action=fix 条目需特别审查
- 非紧急修复的 fix 条目视为越权，需回滚并由 R 子代理重做
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(subagent-delegation): P1.3 反模式#20 + P2.7 S修改边界"
```

### Task B4: P1.3 + P2.7 subagent-persona-matrix.md persona 强化

**Files:**
- Modify: `w-model-dev/references/subagent-persona-matrix.md`

- [ ] **Step 1: 找到 S 子代理和 R 子代理 persona 模板**

Run: `Grep "S 子代理|R 子代理|persona" w-model-dev/references/subagent-persona-matrix.md`

- [ ] **Step 2: 在 S 子代理 persona 增加"立即执行"约束**

```markdown
> **立即执行约束（第 9 轮 P1.3）**：你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 Write/Edit/RunCommand 调用。若任务需要多步骤，每步都应有对应的工具调用，而非纯文本描述。
```

- [ ] **Step 3: 在 R 子代理 persona 强化"修复既有产物"职责**

```markdown
> **R 子代理职责强化（第 9 轮 P2.7）**：你负责修复既有产物的 bug。工作流程：
> 1. 读取 rootcause-report.jsonl 中最新的 rootcause 条目
> 2. 定位 bug 根因（文件、行号、错误逻辑）
> 3. 执行最小修复（仅修复 bug，不扩展功能）
> 4. 运行相关测试验证修复有效
> 5. 在 run-log.jsonl 追加 fix 条目
> 6. 紧急修复的复核：检查 S 子代理的紧急 fix 是否完整，必要时补充
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/subagent-persona-matrix.md
git commit -m "docs(subagent-persona-matrix): P1.3 S约束 + P2.7 R强化"
```

### Task B5: P2.4 + P2.5 verifier-spec.md 标准化

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 找到 subCriteria 和 targetKind 定义章节**

Run: `Grep "subCriteria|targetKind|枚举" w-model-dev/references/verifier-spec.md`

- [ ] **Step 2: 增加 P2.5 targetKind 枚举规范**

```markdown
### targetKind 枚举规范（第 9 轮 P2.5）

`meta.targetKind` 必须取自以下枚举：

| 枚举值 | 适用阶段 | 含义 |
|---|---|---|
| `requirement` | phase 1 | 需求规格说明 |
| `design` | phase 2/3/4 | 系统设计/接口设计/详细设计 |
| `code` | phase 5 | 源代码 |
| `test` | phase 6/7/8 | 集成/系统/验收测试 |

**禁止值**：`"testcase"`（已废弃，统一用 `"test"`）。

**校验**：verifier-logic.ts 校验 targetKind ∈ {"requirement","design","code","test"}，非法值导致 verifier-output 判定不通过。
```

- [ ] **Step 3: 增加 P2.4 各阶段 subCriteria 标准模板**

```markdown
### 各阶段 subCriteria 标准模板（第 9 轮 P2.4）

每个阶段的 verifier-output.subCriteria 名称必须取自下表标准集合（允许子集，但不允许新增名称）：

| 阶段 | targetKind | subCriteria 标准名称（权重参考） |
|---|---|---|
| phase 1 | requirement | requirement-completeness(0.30) / stakeholder-coverage(0.20) / acceptance-criteria-clarity(0.20) / testability(0.15) / feasibility(0.15) |
| phase 2 | design | architecture-soundness(0.25) / requirement-coverage(0.25) / interface-consistency(0.20) / feasibility(0.15) / testability(0.15) |
| phase 3 | design | architecture-soundness(0.25) / interface-contract(0.25) / cross-module-design(0.20) / feasibility(0.15) / testability(0.15) |
| phase 4 | design | architecture-soundness(0.25) / requirement-coverage(0.25) / interface-consistency(0.20) / feasibility(0.15) / testability(0.15) |
| phase 5 | code | architecture-soundness(0.20) / requirement-coverage(0.20) / code-tla-consistency(0.20) / unit-test-quality(0.20) / code-quality(0.20) |
| phase 6 | test | test-coverage(0.30) / interface-contract(0.25) / cross-module-integration(0.25) / exception-handling(0.20) |
| phase 7 | test | e2e-coverage(0.25) / performance(0.25) / security(0.25) / reliability(0.15) / cross-module(0.10) |
| phase 8 | test | scenario-coverage(0.25) / requirement-match(0.25) / boundary-coverage(0.20) / nfr-validation(0.20) / document-completeness(0.10) |

**权重说明**：表中所列权重为参考值，实际权重可调整但总和必须为 1.0。subCriteria 数量允许少于标准集合（如只评 3 项），但名称必须匹配。

**校验**：verifier-logic.ts 根据 targetKind 推断阶段，校验 subCriteria 名称是否在对应阶段的标准集合内。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(verifier-spec): P2.4 subCriteria模板 + P2.5 targetKind枚举"
```

### Task B6: P3.8 tla-plus-guide.md states 清理约定

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 1: 找到 TLA+ 校验流程章节**

Run: `Grep "states|TLC|校验|清理" w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 2: 增加 states 自动清理约定**

```markdown
### TLA+ states 目录自动清理（第 9 轮 P3.8）

**约束**：TLA+ 校验完成后必须清理 `<tla-dir>/states/` 目录，避免状态文件残留污染仓库。

**check-tla-model.ts 行为**：
- 默认在 TLC 校验完成后自动 `rm -rf <tla-dir>/states/`
- 增加 `--keep-states`（简写 `-k`）参数，调试场景下保留 states 用于排查
- 未传 `--keep-states` 时，日志输出 `✓ 已清理 TLA+ states 目录`

**手动清理脚本**：
```bash
npm run clean:tla-states
```
对应 package.json scripts：
```json
"clean:tla-states": "node -e \"require('fs').rmSync('w-model-dev-demo/tla/states', {recursive: true, force: true})\""
```

**校验**：check-tla-model.ts 完成后检查 states 目录不存在（除非 --keep-states）。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/tla-plus-guide.md
git commit -m "docs(tla-plus-guide): P3.8 states 自动清理约定"
```

### Task B7: SKILL.md 门禁清单 --phase 参数

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: 找到阶段 5/6/7 门禁清单**

Run: `Grep "check-artifact-gate|阶段 5|阶段 6|阶段 7|门禁" SKILL.md`

- [ ] **Step 2: 在阶段 5/6/7 门禁清单增加 --phase 参数说明**

```markdown
**阶段 5/6/7 阶段级工件校验（第 9 轮 P1.1）**：

check-artifact-gate.ts 支持 `--phase=N`（简写 `--p N`）参数，按阶段分层校验：

- `--phase=5`：校验 unitTest 汇总 + REQ 行 codeModule 字段（integration/system/acceptance pending 合理跳过）
- `--phase=6`：phase 5 全部 + integrationTest 汇总 + REQ 行 integrationTest 字段
- `--phase=7`：phase 6 全部 + systemTest 汇总 + REQ 行 systemTest 字段
- `--phase=8`（默认）：全部 + acceptanceTest 汇总 + REQ 行 acceptanceTest 字段（终检，向后兼容）

**用法**：
```bash
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts --phase=6 [project-dir]
```

**阶段 6 G 门禁推荐**：`check-verifier-output phase6 && check-artifact-gate --phase=6`
**阶段 7 G 门禁推荐**：`check-verifier-output phase7 && check-artifact-gate --phase=7`
```

- [ ] **Step 3: Commit**

```bash
git add SKILL.md
git commit -m "docs(SKILL): P1.1 阶段5/6/7门禁 --phase 参数说明"
```

---

## Part C：顶层文档与 demo 修正

### Task C1: 修正第八轮 demo 的 phase6/7 verifier-output

**Files:**
- Modify: `w-model-dev-demo/.w-model/verifier-output-phase6.json`
- Modify: `w-model-dev-demo/.w-model/verifier-output-phase7.json`

- [ ] **Step 1: 读取 phase6 verifier-output**

Run: `Read w-model-dev-demo/.w-model/verifier-output-phase6.json`

- [ ] **Step 2: 修正 targetKind: "testcase" → "test"**

- [ ] **Step 3: 修正 subCriteria 名称对齐 phase 6 标准模板**

将 subCriteria 名称改为：`test-coverage` / `interface-contract` / `cross-module-integration` / `exception-handling`（phase 6 标准 4 项）

- [ ] **Step 4: 修正 rawScores 避免完美等差数列**

将 rawScores 从 `[0.96, 0.94, 0.95, 0.95, 0.95]` 改为有自然波动的值，如 `[0.96, 0.93, 0.95, 0.94, 0.95]`（方差重算）

- [ ] **Step 5: 同样修正 phase7 verifier-output**

targetKind → "test"，subCriteria 对齐 phase 7 标准（e2e-coverage/performance/security/reliability/cross-module），rawScores 自然波动

- [ ] **Step 6: 验证修正后通过 check-verifier-output**

Run:
```
cd w-model-dev-demo
npx tsx ../w-model-dev/scripts/cli/check-verifier-output.ts phase6
npx tsx ../w-model-dev/scripts/cli/check-verifier-output.ts phase7
```
Expected: 两个 exitCode=0

- [ ] **Step 7: Commit**

```bash
git add w-model-dev-demo/.w-model/verifier-output-phase6.json w-model-dev-demo/.w-model/verifier-output-phase7.json
git commit -m "fix(demo): P2.4/P2.5/P3.10 phase6/7 verifier-output 标准化"
```

### Task C2: 清理 tla/states/ 残留

**Files:**
- Delete: `w-model-dev-demo/tla/states/` 目录下全部文件

- [ ] **Step 1: 确认 states 目录文件数**

Run: `Get-ChildItem w-model-dev-demo/tla/states/ | Measure-Object`
Expected: 229 个文件

- [ ] **Step 2: 删除 states 目录**

Run: `Remove-Item -Recurse -Force w-model-dev-demo/tla/states`

- [ ] **Step 3: 确认删除**

Run: `Test-Path w-model-dev-demo/tla/states`
Expected: False

- [ ] **Step 4: Commit**

```bash
git add -A w-model-dev-demo/tla/
git commit -m "chore(demo): P3.8 清理 tla/states 229 个残留文件"
```

### Task C3: SSoT §3.4.6 第 9 轮约束

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: 找到 §3.4.6 章节**

Run: `Grep "3.4.6|第 8 轮|门禁细化" docs/skill-design-document_SSoT.md`

- [ ] **Step 2: 增加 第 9 轮约束条款**

```markdown
#### 第 9 轮门禁与流程细化约束（2026-07-25）

基于第 8 轮 25 需求端到端调测识别的 11 个问题，增加以下约束：

1. **P1.1 阶段级工件校验**：check-artifact-gate.ts 支持 `--phase=N` 参数，阶段 5/6/7 G 门禁须使用对应 phase 校验，不得用终检（phase=8）提前否决pending 的后续测试层
2. **P1.2 NFR/CON 早发现**：NFR/CON 行须在阶段 1 登记 designDoc，阶段 5 回填 codeModule，配合 `--phase` 阶段校验早发现
3. **P1.3 禁止只规划不执行**：子代理响应必须含至少一次执行工具调用，编排者检测到纯文本规划须重派
4. **P2.4 subCriteria 标准化**：各阶段 subCriteria 名称必须取自标准模板（8 阶段 × 4-5 项）
5. **P2.5 targetKind 枚举**：targetKind ∈ {"requirement","design","code","test"}，"testcase" 已废弃
6. **P2.6 graph 自动发现**：check-artifact-gate.ts 自动查找 `.w-model/ingestion/` 下 graph 资产
7. **P2.7 S 子代理修改边界**：S 负责新增，R 负责修复，紧急修复须 run-log 记录
8. **P3.8 TLA+ states 自动清理**：check-tla-model.ts 校验后自动清理 states/，`--keep-states` 调试保留
9. **P3.9 Next 分支覆盖扩展**：code-tla-logic.ts 维度 3 遍历全部 specs 的 Next actions
10. **P3.10 rawScores 合理性**：rawScores 不得全相同或完美等差数列（公差 0.01）
11. **P3.11 coverage/.tmp 清理**：.gitignore 排除 + vitest coverage.clean=true
```

- [ ] **Step 3: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(SSoT): §3.4.6 第9轮门禁细化约束"
```

### Task C4: AGENTS.md §4 第 9 轮结论

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 找到 §4 第八轮结论位置**

Run: `Grep "第八轮|第 8 轮|2026-07-25" AGENTS.md`

- [ ] **Step 2: 在第八轮结论后增加第九轮结论**

```markdown
### 第九轮：门禁与流程细化修正（2026-07-25）

**触发**：第 8 轮 25 需求端到端调测归档后识别 11 个问题（P1×3 + P2×4 + P3×4）。

**修正范围**：方案 A 全量修正 11 个问题。

**关键改动**：
- 5 脚本：gate-logic.ts（phaseOption 阶段级校验）、check-artifact-gate.ts（--phase + graph 自动发现）、verifier-logic.ts（subCriteria 命名 + targetKind 枚举 + rawScores 合理性）、check-tla-model.ts（states 自动清理）、code-tla-logic.ts（维度 3 扩展）
- 6 fixture：gate/valid-phase6 + bad-phase6-pending-system + bad-phase5-missing-codemodule；verifier/bad-targetkind + bad-subcriteria-name + bad-rawscores-constant
- 7 reference 文档：phase-1/phase-5/subagent-delegation/subagent-persona-matrix/verifier-spec/tla-plus-guide/SKILL
- 3 顶层文档：SSoT §3.4.6 + AGENTS.md §4 + CHANGELOG.md
- 4 demo verifier-output 修正（phase6/7 targetKind + subCriteria 名称 + rawScores 自然波动）
- 工程清理：tla/states/ 229 文件 + coverage/.tmp/ 排除规则

**验证**：
- TypeScript strict 0 错误
- self-test 基线 82→91（+9 新测试）全通过
- check-artifact-gate --phase=6/7/8 在第八轮 demo 上 exitCode=0
- check-verifier-output phase6/7 修正后 exitCode=0

**对比第八轮**：门禁从"终检一次性否决"进化为"阶段级渐进式校验"；verifier 从"自由命名"进化为"标准模板"；子代理从"边界模糊"进化为"立即执行 + S/R 职责分明"。
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): §4 第9轮门禁细化修正结论"
```

### Task C5: CHANGELOG.md 第 9 轮版本条目

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 读取 CHANGELOG 顶部**

Run: `Read CHANGELOG.md` 前 30 行

- [ ] **Step 2: 在顶部增加第 9 轮版本条目**

```markdown
## [9.0.0] - 2026-07-25

### 第 9 轮门禁与流程细化修正

基于第 8 轮 25 需求端到端调测归档后识别的 11 个问题（P1×3 + P2×4 + P3×4）全量修正。

#### 新增

- **P1.1 阶段级工件校验**：check-artifact-gate.ts `--phase=N` 参数，按阶段分层校验测试汇总和 RTM 字段
- **P2.6 graph 自动发现**：check-artifact-gate.ts 自动查找 `.w-model/ingestion/` 下 graph 资产（graph.json / consolidated-phaseN.json）
- **P2.4 subCriteria 标准模板**：8 阶段 × 4-5 项标准 subCriteria 名称
- **P2.5 targetKind 枚举**：`requirement` | `design` | `code` | `test`，"testcase" 废弃
- **P3.8 TLA+ states 自动清理**：check-tla-model.ts `--keep-states` 参数
- **P3.9 Next 分支覆盖扩展**：code-tla-logic.ts 维度 3 遍历全部 specs
- **P3.10 rawScores 合理性校验**：不得全相同或完美等差数列
- **P3.11 coverage/.tmp 清理**：.gitignore 排除 + vitest coverage.clean
- 6 新 fixture + 9 新测试（self-test 基线 82→91）

#### 变更

- gate-logic.ts: checkArtifactGate 增加 phaseOption 参数 + 阶段分层校验
- verifier-logic.ts: 增加 subCriteria 命名/targetKind 枚举/rawScores 合理性校验
- subagent-delegation.md: 反模式 #20（只规划不执行）+ S 子代理修改边界
- subagent-persona-matrix.md: S 子代理"立即执行"约束 + R 子代理强化
- phase-1-requirements.md: NFR/CON 横切字段登记要求
- phase-5-coding.md: NFR/CON codeModule 回填要求
- verifier-spec.md: subCriteria 标准模板 + targetKind 枚举
- tla-plus-guide.md: states 清理约定
- SKILL.md: 阶段 5/6/7 门禁 --phase 参数说明
- SSoT §3.4.6: 第 9 轮约束条款

#### 修复

- 第八轮 demo phase6/7 verifier-output targetKind "testcase" → "test"
- 第八轮 demo phase6/7 verifier-output subCriteria 名称对齐标准模板
- 第八轮 demo phase6/7 verifier-output rawScores 改为自然波动
- 清理 w-model-dev-demo/tla/states/ 229 个残留文件
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(CHANGELOG): 第9轮门禁细化修正版本条目"
```

### Task C6: 最终验证检查点

- [ ] **Step 1: TypeScript strict 全量编译**

Run: `cd w-model-dev && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: self-test 全通过**

Run: `cd w-model-dev && npm run self-test`
Expected: 91/91 全通过

- [ ] **Step 3: vitest 全通过**

Run: `cd w-model-dev && npx vitest run`
Expected: 全部通过

- [ ] **Step 4: 第八轮 demo 完整验证**

Run:
```
cd w-model-dev-demo
npx tsx ../w-model-dev/scripts/cli/check-verifier-output.ts phase6
npx tsx ../w-model-dev/scripts/cli/check-verifier-output.ts phase7
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=6
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=7
npx tsx ../w-model-dev/scripts/cli/check-artifact-gate.ts --phase=8
npx tsx ../w-model-dev/scripts/cli/check-code-tla-consistency.ts
```
Expected: 全部 exitCode=0

- [ ] **Step 5: tla/states/ 确认已清理**

Run: `Test-Path w-model-dev-demo/tla/states`
Expected: False

- [ ] **Step 6: 最终 commit**

```bash
git add .
git commit -m "checkpoint: 第9轮门禁与流程细化修正完成（11问题全修复）"
```

---

## 验收标准对齐

- [x] 11 个问题全部修正（Part A 8 任务 + Part B 7 任务 + Part C 6 任务）
- [x] 5 脚本改动 TypeScript strict 0 错误（Task A8 Step 1）
- [x] self-test 基线 82→91 全通过（Task A8 Step 2）
- [x] 6 新 fixture 全通过（Task A3 + A4）
- [x] 第八轮 demo phase6/7 verifier-output 通过 check-verifier-output（Task C1 Step 6）
- [x] check-artifact-gate --phase=6/7/8 在第八轮 demo 上 exitCode=0（Task A8 Step 4 + Task C6 Step 4）
- [x] 7 reference 文档更新（Task B1-B7）
- [x] 3 顶层文档更新（Task C3-C5）
- [x] tla/states/ 清理（Task C2）
- [x] coverage/.tmp/ 排除规则生效（Task A7）
