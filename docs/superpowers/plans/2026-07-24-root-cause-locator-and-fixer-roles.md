# 根因定位者（R）与修复者（F）角色实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 W 模型返工循环中新增根因定位者（R）角色与修复者（F，由 S 兼任）角色，建立 V/G→R→V→G→S-fix→V→G 返工循环，并集成多人格多角度分析机制（并行/串行均可）。

**Architecture:** 新建 `root-cause-logic.ts`（纯逻辑）+ `check-rootcause-report.ts`（CLI 包装）作为 R 报告校验单点事实；新建 `root-cause-locator.md`（R 方法论指南）+ `subagent-persona-matrix.md`（人格选择矩阵）作为 R 子代理可读文档；扩展 `run-log-logic.ts` / `budget-logic.ts` 接纳新动作类型；同步更新 17 个 references/ 与顶层文档，确保反模式 #18/#19、SKILL.md 约束第 9 条、SSoT §3.4/§6.4 全部落地。

**Tech Stack:** TypeScript（strict 模式，0 errors）、Node ≥20、tsx 运行时、self-test.ts（无框架集成回归）+ vitest（单元测试）、JSON Schema 校验纯函数模式。

**关联 spec：** [2026-07-24-root-cause-locator-and-fixer-roles-design.md](../specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md)

---

## 文件结构总览

### 新建文件（6 个）

| 文件路径 | 责任 |
|---|---|
| `w-model-dev/scripts/root-cause-logic.ts` | R 报告校验纯逻辑（R1-R10 规则、RootCauseReportShape 类型） |
| `w-model-dev/scripts/check-rootcause-report.ts` | R 报告校验 CLI 包装（退出码 0/1/2） |
| `w-model-dev/scripts/__tests__/root-cause-logic.test.ts` | R 校验逻辑单元测试（vitest） |
| `w-model-dev/scripts/samples/rootcause/*.json` | R 报告样本（1 valid + 10 bad，对应 R1-R10） |
| `w-model-dev/references/root-cause-locator.md` | R 方法论指南（4 种方法 + 质量标准 + 多角度节） |
| `w-model-dev/references/subagent-persona-matrix.md` | R-persona / V-persona 选择矩阵 |

> spec §8.1 列 5 项（samples 为目录计数）；本计划按文件粒度展开为 6 个，并把 `root-cause-logic.ts` 从 `check-rootcause-report.ts` 拆出，与 `verifier-logic.ts` / `check-verifier-output.ts` 模式一致。

### 修改文件（17 个）

**设计文档层（5）**：`docs/skill-design-document_SSoT.md`、`w-model-dev/SKILL.md`、`AGENTS.md`、`README.md`、`CHANGELOG.md`

**references/ 层（7）**：`subagent-delegation.md`、`workflow.md`、`anti-patterns.md`、`data-models.md`、`verifier-spec.md`、`agent-personas.md`、`operational-recovery.md`

**scripts/ 层（5）**：`run-log-logic.ts`、`check-budget.ts`、`self-test.ts`、`gate-logic.ts`（可选）、`code-tla-logic.ts`（无变更，仅回归）

---

## 层 1：核心校验逻辑（TDD）

### Task 1: 创建 rootcause 样本目录与 valid 样本

**Files:**
- Create: `w-model-dev/scripts/samples/rootcause/valid.json`

- [ ] **Step 1: 创建 valid.json 样本**

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "reportId": "RC-phase5-1-01",
    "targetKind": "rootcause",
    "targetArtifact": "w-model-dev-demo/src/services/auth.service.ts",
    "targetPhase": "阶段 5 - 编码",
    "reworkRound": 1,
    "reworkSource": "verifier",
    "persona": "root-cause-locator",
    "method": "5-why",
    "analysisTimestamp": "2026-07-24T10:00:00Z"
  },
  "input": {
    "reworkHints": ["[Critical] auth.service.ts login() 未校验密码为空的场景"],
    "verifierOutputPath": ".w-model/verifier/auth-review.json"
  },
  "phenomenon": {
    "summary": "login() 在 password 为空字符串时直接签发 JWT",
    "severity": "Critical",
    "affectedArtifacts": ["w-model-dev-demo/src/services/auth.service.ts"]
  },
  "rootCauseChain": [
    {
      "step": 1,
      "why": "为什么 login() 未校验空密码？",
      "answer": "login() 函数体中无 password 非空检查",
      "evidence": "auth.service.ts:24-30 login() 函数体"
    },
    {
      "step": 2,
      "why": "为什么没有非空检查？",
      "answer": "需求规格 REQ-AUTH-002 未规定 password 为空时的行为",
      "evidence": "requirement-spec.md REQ-AUTH-002 节"
    }
  ],
  "rootCause": {
    "category": "requirement-gap",
    "description": "需求规格 REQ-AUTH-002 未规定空密码的处理，编码默认不检查",
    "evidence": "requirement-spec.md REQ-AUTH-002 缺少空值处理条款",
    "falsifiabilityCheck": "若在 REQ-AUTH-002 中增加空密码拒绝条款并在 login() 增加 password.trim() 非空校验，则空密码登录现象消失"
  },
  "upstreamDefect": {
    "present": true,
    "upstreamPhase": "阶段 1",
    "upstreamArtifactId": "REQ-AUTH-002",
    "defectDescription": "需求规格未规定空密码处理",
    "rollbackRecommended": false
  },
  "fixRecommendation": [
    {
      "target": "w-model-dev-demo/src/services/auth.service.ts",
      "location": "auth.service.ts:26 login() 入口",
      "action": "增加 if (!password || password.trim() === '') throw new ValidationError('密码不能为空')",
      "rationale": "消除根因（空密码未校验），与 REQ-AUTH-002 补充条款一致"
    }
  ],
  "prevention": [
    {
      "scope": "phase-1-requirements",
      "measure": "需求模板增加「输入边界值处理」检查项，强制规定空值/边界值行为",
      "owner": "S-doc"
    }
  ],
  "qualityLevel": "A",
  "passed": true,
  "summary": "空密码登录根因为需求规格 REQ-AUTH-002 未规定空值处理，须补需求 + 补编码校验",
  "reviewNotes": ""
}
```

- [ ] **Step 2: 验证 JSON 合法性**

Run: `node -e "JSON.parse(require('fs').readFileSync('w-model-dev/scripts/samples/rootcause/valid.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/samples/rootcause/valid.json
git commit -m "test(rootcause): 新增 R 报告 valid 样本"
```

---

### Task 2: 创建 10 个 bad 样本（对应 R1-R10 失败场景）

**Files:**
- Create: `w-model-dev/scripts/samples/rootcause/bad-r1-missing-fields.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r2-chain-length.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r3-falsifiability.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r4-fix-recommendation.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r5-prevention.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r6-upstream-defect.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r7-quality-level.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r8-report-id.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r9-partial-missing.json`
- Create: `w-model-dev/scripts/samples/rootcause/bad-r10-reality-confidence.json`

- [ ] **Step 1: 创建 bad-r1-missing-fields.json（缺 rootCause 字段）**

复制 valid.json，删除 `rootCause` 整个对象。

- [ ] **Step 2: 创建 bad-r2-chain-length.json（rootCauseChain 仅 1 步）**

复制 valid.json，`rootCauseChain` 仅保留 step=1 一项。

- [ ] **Step 3: 创建 bad-r3-falsifiability.json（falsifiabilityCheck 无「若...则」句式）**

复制 valid.json，`rootCause.falsifiabilityCheck` 改为 `"应该修复空密码问题"`。

- [ ] **Step 4: 创建 bad-r4-fix-recommendation.json（fixRecommendation 缺 rationale）**

复制 valid.json，`fixRecommendation[0]` 删除 `rationale` 字段。

- [ ] **Step 5: 创建 bad-r5-prevention.json（prevention 缺 owner）**

复制 valid.json，`prevention[0]` 删除 `owner` 字段。

- [ ] **Step 6: 创建 bad-r6-upstream-defect.json（present=true 但缺 upstreamPhase）**

复制 valid.json，`upstreamDefect.present=true` 但删除 `upstreamPhase` / `upstreamArtifactId` / `defectDescription` 三字段。

- [ ] **Step 7: 创建 bad-r7-quality-level.json（qualityLevel=C 但 passed=true）**

复制 valid.json，`qualityLevel` 改为 `"C"`，`passed` 保持 `true`。

- [ ] **Step 8: 创建 bad-r8-report-id.json（reportId 格式非法）**

复制 valid.json，`meta.reportId` 改为 `"RC_phase5_1_01"`（含下划线且无连字符分隔）。

- [ ] **Step 9: 创建 bad-r9-partial-missing.json（多角度场景缺 partialReports 附录）**

复制 valid.json，`meta.method` 改为 `"combined"`（多角度），但顶层无 `partialReports` 数组字段。

- [ ] **Step 10: 创建 bad-r10-reality-confidence.json（reality-checker confidence < 0.5）**

复制 valid.json，新增 `partialReports` 数组，其中 reality-checker 的 PartialReport `confidence` 为 `0.3`。

- [ ] **Step 11: 验证全部 10 个 JSON 合法**

Run: `node -e "const fs=require('fs'); const dir='w-model-dev/scripts/samples/rootcause'; fs.readdirSync(dir).filter(f=>f.startsWith('bad-')).forEach(f=>{JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'))}); console.log('10 bad samples OK')"`
Expected: `10 bad samples OK`

- [ ] **Step 12: Commit**

```bash
git add w-model-dev/scripts/samples/rootcause/bad-*.json
git commit -m "test(rootcause): 新增 10 个 bad 样本对应 R1-R10 校验规则"
```

---

### Task 3: 编写 root-cause-logic.ts 单元测试（TDD - 先写测试）

**Files:**
- Create: `w-model-dev/scripts/__tests__/root-cause-logic.test.ts`

- [ ] **Step 1: 编写测试文件骨架 + R1-R10 测试用例**

```typescript
/**
 * root-cause-logic.ts 单元测试 —— R 报告校验 R1-R10 规则
 *
 * 覆盖：
 *   - R1 Schema 完整性（必填字段非空）
 *   - R2 rootCauseChain 长度 [2,5] + evidence 非空
 *   - R3 falsifiabilityCheck 含「若...则」句式
 *   - R4 fixRecommendation 四字段
 *   - R5 prevention 三字段
 *   - R6 upstreamDefect.present=true 时后续字段非空
 *   - R7 qualityLevel 与 passed 一致
 *   - R8 reportId 格式 ^RC-[a-z0-9]+-\d+-\d+$
 *   - R9 多角度场景 partialReports 非空
 *   - R10 多角度场景 reality-checker confidence ≥ 0.5
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRootCauseReport, type RootCauseReportShape } from '../root-cause-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'rootcause');

async function loadSample(file: string): Promise<RootCauseReportShape> {
  const raw = await fs.readFile(path.join(samplesDir, file), 'utf-8');
  return JSON.parse(raw);
}

describe('R1 Schema 完整性', () => {
  it('缺 rootCause 字段时失败', async () => {
    const report = await loadSample('bad-r1-missing-fields.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootCause/.test(r))).toBe(true);
  });
});

describe('R2 rootCauseChain 长度', () => {
  it('chain 仅 1 步时失败', async () => {
    const report = await loadSample('bad-r2-chain-length.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootCauseChain.*长度/.test(r))).toBe(true);
  });
});

describe('R3 falsifiabilityCheck 句式', () => {
  it('无「若...则」句式时失败', async () => {
    const report = await loadSample('bad-r3-falsifiability.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /falsifiabilityCheck.*若.*则/.test(r))).toBe(true);
  });
});

describe('R4 fixRecommendation 四字段', () => {
  it('缺 rationale 时失败', async () => {
    const report = await loadSample('bad-r4-fix-recommendation.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /fixRecommendation.*rationale/.test(r))).toBe(true);
  });
});

describe('R5 prevention 三字段', () => {
  it('缺 owner 时失败', async () => {
    const report = await loadSample('bad-r5-prevention.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /prevention.*owner/.test(r))).toBe(true);
  });
});

describe('R6 upstreamDefect 后续字段', () => {
  it('present=true 但缺 upstreamPhase 时失败', async () => {
    const report = await loadSample('bad-r6-upstream-defect.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /upstreamDefect.*upstreamPhase/.test(r))).toBe(true);
  });
});

describe('R7 qualityLevel 与 passed 一致', () => {
  it('qualityLevel=C 但 passed=true 时失败', async () => {
    const report = await loadSample('bad-r7-quality-level.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /qualityLevel.*passed.*一致/.test(r))).toBe(true);
  });
});

describe('R8 reportId 格式', () => {
  it('reportId 含下划线时失败', async () => {
    const report = await loadSample('bad-r8-report-id.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /reportId.*格式/.test(r))).toBe(true);
  });
});

describe('R9 多角度场景 partialReports', () => {
  it('method=combined 但无 partialReports 时失败', async () => {
    const report = await loadSample('bad-r9-partial-missing.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /partialReports.*非空/.test(r))).toBe(true);
  });
});

describe('R10 reality-checker confidence', () => {
  it('reality-checker confidence=0.3 时失败', async () => {
    const report = await loadSample('bad-r10-reality-confidence.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /reality-checker.*confidence/.test(r))).toBe(true);
  });
});

describe('valid 样本', () => {
  it('完整合规样本通过', async () => {
    const report = await loadSample('valid.json');
    const result = checkRootCauseReport(report);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试确认全部失败（实现尚未编写）**

Run: `cd w-model-dev-demo && npx vitest run ../w-model-dev/scripts/__tests__/root-cause-logic.test.ts`
Expected: 全部 FAIL（`root-cause-logic.ts` 不存在，导入失败）

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/root-cause-logic.test.ts
git commit -m "test(rootcause): TDD 先写 R1-R10 单元测试（全部 RED）"
```

---

### Task 4: 实现 root-cause-logic.ts（R1-R10 校验纯逻辑）

**Files:**
- Create: `w-model-dev/scripts/root-cause-logic.ts`

- [ ] **Step 1: 编写 root-cause-logic.ts 完整实现**

```typescript
/**
 * RootCauseReport 校验纯逻辑（Root Cause Logic）—— 防止 R 子代理产出漂移
 *
 * 对应 spec §4 RootCauseReport Schema 与 R1-R10 校验规则。
 *
 * 设计原则（与 verifier-logic.ts / graph-logic.ts / tla-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「R 报告是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export type TargetKind = 'rootcause';
export type ReworkSource = 'verifier' | 'gate';
export type AnalysisMethod = '5-why' | 'fishbone' | 'defect-chain' | 'upstream-trace' | 'combined';
export type RootCauseCategory =
  | 'requirement-gap'
  | 'design-flaw'
  | 'coding-error'
  | 'test-gap'
  | 'process-missing'
  | 'tool-gap'
  | 'upstream-defect';
export type QualityLevel = 'A' | 'B' | 'C' | 'D';

export interface RootCauseReportShape {
  schemaVersion: string;
  meta: {
    reportId: string;
    targetKind: 'rootcause';
    targetArtifact: string;
    targetPhase: string;
    reworkRound: number;
    reworkSource: ReworkSource;
    persona: string;
    method: AnalysisMethod;
    analysisTimestamp: string;
  };
  input: {
    reworkHints: string[];
    verifierOutputPath?: string;
    gateJsonPath?: string;
  };
  phenomenon: {
    summary: string;
    severity: 'Critical' | 'Required' | 'Optional' | 'Nit' | 'FYI';
    affectedArtifacts: string[];
  };
  rootCauseChain: Array<{
    step: number;
    why: string;
    answer: string;
    evidence: string;
  }>;
  rootCause: {
    category: RootCauseCategory;
    description: string;
    evidence: string;
    falsifiabilityCheck: string;
  };
  upstreamDefect: {
    present: boolean;
    upstreamPhase?: string;
    upstreamArtifactId?: string;
    defectDescription?: string;
    rollbackRecommended: boolean;
  };
  fixRecommendation: Array<{
    target: string;
    location: string;
    action: string;
    rationale: string;
  }>;
  prevention: Array<{
    scope: string;
    measure: string;
    owner: string;
  }>;
  qualityLevel: QualityLevel;
  passed: boolean;
  summary: string;
  reviewNotes?: string;
  /** 多角度场景（method=combined）附录：PartialReport 路径列表 */
  partialReports?: Array<{
    personaSlice: string;
    path: string;
    confidence: number;
  }>;
}

// ==================== 校验结果 ====================

export interface RootCauseCheckResult {
  passed: boolean;
  reasons: string[];
}

// ==================== 常量 ====================

const SCHEMA_VERSION = '1.0';
const MIN_CHAIN_LENGTH = 2;
const MAX_CHAIN_LENGTH = 5;
const MIN_REALITY_CONFIDENCE = 0.5;
const REPORT_ID_PATTERN = /^RC-[a-z0-9]+-\d+-\d+$/;
const FALSIFIABILITY_PATTERN = /若.*则/;

// ==================== 工具函数 ====================

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim() !== '';
}

function isIso8601(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

// ==================== 主校验函数 ====================

/**
 * 校验外部 R 子代理产出的 RootCauseReport JSON 是否符合 spec §4 Schema。
 *
 * 校验项 R1-R10（见 spec §4.4）：
 *   R1 Schema 完整性
 *   R2 rootCauseChain 长度 [2,5] + evidence 非空
 *   R3 falsifiabilityCheck 含「若...则」句式
 *   R4 fixRecommendation 四字段
 *   R5 prevention 三字段
 *   R6 upstreamDefect.present=true 时后续字段非空
 *   R7 qualityLevel 与 passed 一致
 *   R8 reportId 格式
 *   R9 多角度场景 partialReports 非空
 *   R10 多角度场景 reality-checker confidence ≥ 0.5
 */
export function checkRootCauseReport(input: unknown): RootCauseCheckResult {
  const reasons: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { passed: false, reasons: ['RootCauseReport 必须为对象'] };
  }
  const r = input as Partial<RootCauseReportShape>;

  // schemaVersion
  if (r.schemaVersion !== SCHEMA_VERSION) {
    reasons.push(`schemaVersion 必须为 "${SCHEMA_VERSION}"，实际为 ${JSON.stringify(r.schemaVersion)}`);
  }

  // R1 Schema 完整性：所有必填字段非空
  if (!r.meta || typeof r.meta !== 'object') {
    reasons.push('meta 字段缺失或非对象');
  } else {
    if (!isNonEmptyString(r.meta.reportId)) reasons.push('meta.reportId 必填且非空');
    if (r.meta.targetKind !== 'rootcause') reasons.push('meta.targetKind 必须为 "rootcause"');
    if (!isNonEmptyString(r.meta.targetArtifact)) reasons.push('meta.targetArtifact 必填且非空');
    if (!isNonEmptyString(r.meta.targetPhase)) reasons.push('meta.targetPhase 必填且非空');
    if (typeof r.meta.reworkRound !== 'number' || r.meta.reworkRound < 1) reasons.push('meta.reworkRound 必须为 ≥1 的整数');
    if (!['verifier', 'gate'].includes(r.meta.reworkSource ?? '')) reasons.push('meta.reworkSource 必须为 verifier|gate');
    if (!isNonEmptyString(r.meta.persona)) reasons.push('meta.persona 必填且非空');
    if (!['5-why', 'fishbone', 'defect-chain', 'upstream-trace', 'combined'].includes(r.meta.method ?? '')) {
      reasons.push('meta.method 必须为 5-why|fishbone|defect-chain|upstream-trace|combined');
    }
    if (!isIso8601(r.meta.analysisTimestamp)) reasons.push('meta.analysisTimestamp 必须为 ISO 8601');
  }

  if (!r.input || !Array.isArray(r.input.reworkHints) || r.input.reworkHints.length === 0) {
    reasons.push('input.reworkHints 必须为非空数组');
  }

  if (!r.phenomenon || typeof r.phenomenon !== 'object') {
    reasons.push('phenomenon 字段缺失或非对象');
  } else {
    if (!isNonEmptyString(r.phenomenon.summary)) reasons.push('phenomenon.summary 必填且非空');
    if (!['Critical', 'Required', 'Optional', 'Nit', 'FYI'].includes(r.phenomenon.severity ?? '')) {
      reasons.push('phenomenon.severity 必须为 Critical|Required|Optional|Nit|FYI');
    }
    if (!Array.isArray(r.phenomenon.affectedArtifacts) || r.phenomenon.affectedArtifacts.length === 0) {
      reasons.push('phenomenon.affectedArtifacts 必须为非空数组');
    }
  }

  // R2 rootCauseChain 长度 [2,5] + evidence 非空
  if (!Array.isArray(r.rootCauseChain) || r.rootCauseChain.length < MIN_CHAIN_LENGTH || r.rootCauseChain.length > MAX_CHAIN_LENGTH) {
    reasons.push(`rootCauseChain 长度必须在 [${MIN_CHAIN_LENGTH},${MAX_CHAIN_LENGTH}]，实际为 ${Array.isArray(r.rootCauseChain) ? r.rootCauseChain.length : '非数组'}`);
  } else {
    for (let i = 0; i < r.rootCauseChain.length; i++) {
      const step = r.rootCauseChain[i];
      if (!step || typeof step !== 'object') {
        reasons.push(`rootCauseChain[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(step.why)) reasons.push(`rootCauseChain[${i}].why 必填且非空`);
      if (!isNonEmptyString(step.answer)) reasons.push(`rootCauseChain[${i}].answer 必填且非空`);
      if (!isNonEmptyString(step.evidence)) reasons.push(`rootCauseChain[${i}].evidence 必填且非空`);
    }
  }

  // R1 rootCause 字段 + R3 falsifiabilityCheck 句式
  if (!r.rootCause || typeof r.rootCause !== 'object') {
    reasons.push('rootCause 字段缺失或非对象');
  } else {
    const validCategories: RootCauseCategory[] = ['requirement-gap', 'design-flaw', 'coding-error', 'test-gap', 'process-missing', 'tool-gap', 'upstream-defect'];
    if (!validCategories.includes(r.rootCause.category)) {
      reasons.push(`rootCause.category 必须为 ${validCategories.join('|')} 之一`);
    }
    if (!isNonEmptyString(r.rootCause.description)) reasons.push('rootCause.description 必填且非空');
    if (!isNonEmptyString(r.rootCause.evidence)) reasons.push('rootCause.evidence 必填且非空');
    if (!isNonEmptyString(r.rootCause.falsifiabilityCheck)) {
      reasons.push('rootCause.falsifiabilityCheck 必填且非空');
    } else if (!FALSIFIABILITY_PATTERN.test(r.rootCause.falsifiabilityCheck)) {
      reasons.push('rootCause.falsifiabilityCheck 必须含「若...则」句式（可证伪假设）');
    }
  }

  // R6 upstreamDefect.present=true 时后续字段非空
  if (!r.upstreamDefect || typeof r.upstreamDefect !== 'object') {
    reasons.push('upstreamDefect 字段缺失或非对象');
  } else if (r.upstreamDefect.present === true) {
    if (!isNonEmptyString(r.upstreamDefect.upstreamPhase)) reasons.push('upstreamDefect.present=true 时 upstreamPhase 必填且非空');
    if (!isNonEmptyString(r.upstreamDefect.upstreamArtifactId)) reasons.push('upstreamDefect.present=true 时 upstreamArtifactId 必填且非空');
    if (!isNonEmptyString(r.upstreamDefect.defectDescription)) reasons.push('upstreamDefect.present=true 时 defectDescription 必填且非空');
  }

  // R4 fixRecommendation 四字段
  if (!Array.isArray(r.fixRecommendation) || r.fixRecommendation.length === 0) {
    reasons.push('fixRecommendation 必须为非空数组');
  } else {
    for (let i = 0; i < r.fixRecommendation.length; i++) {
      const f = r.fixRecommendation[i];
      if (!f || typeof f !== 'object') {
        reasons.push(`fixRecommendation[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(f.target)) reasons.push(`fixRecommendation[${i}].target 必填且非空`);
      if (!isNonEmptyString(f.location)) reasons.push(`fixRecommendation[${i}].location 必填且非空`);
      if (!isNonEmptyString(f.action)) reasons.push(`fixRecommendation[${i}].action 必填且非空`);
      if (!isNonEmptyString(f.rationale)) reasons.push(`fixRecommendation[${i}].rationale 必填且非空`);
    }
  }

  // R5 prevention 三字段
  if (!Array.isArray(r.prevention) || r.prevention.length === 0) {
    reasons.push('prevention 必须为非空数组');
  } else {
    for (let i = 0; i < r.prevention.length; i++) {
      const p = r.prevention[i];
      if (!p || typeof p !== 'object') {
        reasons.push(`prevention[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(p.scope)) reasons.push(`prevention[${i}].scope 必填且非空`);
      if (!isNonEmptyString(p.measure)) reasons.push(`prevention[${i}].measure 必填且非空`);
      if (!isNonEmptyString(p.owner)) reasons.push(`prevention[${i}].owner 必填且非空`);
    }
  }

  // R7 qualityLevel 与 passed 一致
  const validLevels: QualityLevel[] = ['A', 'B', 'C', 'D'];
  if (!validLevels.includes(r.qualityLevel)) {
    reasons.push(`qualityLevel 必须为 A|B|C|D，实际为 ${JSON.stringify(r.qualityLevel)}`);
  } else if (typeof r.passed !== 'boolean') {
    reasons.push('passed 必须为 boolean');
  } else {
    const expectedPassed = r.qualityLevel === 'A' || r.qualityLevel === 'B';
    if (r.passed !== expectedPassed) {
      reasons.push(`qualityLevel=${r.qualityLevel} 与 passed=${r.passed} 不一致（A/B→true，C/D→false）`);
    }
  }

  if (!isNonEmptyString(r.summary)) reasons.push('summary 必填且非空');

  // R8 reportId 格式
  if (r.meta && isNonEmptyString(r.meta.reportId) && !REPORT_ID_PATTERN.test(r.meta.reportId)) {
    reasons.push(`meta.reportId 格式必须为 ^RC-[a-z0-9]+-\\d+-\\d+$，实际为 ${r.meta.reportId}`);
  }

  // R9 多角度场景 partialReports 非空
  // R10 多角度场景 reality-checker confidence ≥ 0.5
  const isMultiPersona = r.meta?.method === 'combined';
  if (isMultiPersona) {
    if (!Array.isArray(r.partialReports) || r.partialReports.length === 0) {
      reasons.push('多角度场景（method=combined）partialReports 必须为非空数组');
    } else {
      const realityChecker = r.partialReports.find(p => p.personaSlice?.includes('reality-checker'));
      if (realityChecker && typeof realityChecker.confidence === 'number' && realityChecker.confidence < MIN_REALITY_CONFIDENCE) {
        reasons.push(`多角度场景 reality-checker persona confidence=${realityChecker.confidence} < ${MIN_REALITY_CONFIDENCE}（防幻想根因）`);
      }
    }
  }

  return { passed: reasons.length === 0, reasons };
}
```

- [ ] **Step 2: 运行测试确认全部通过（GREEN）**

Run: `cd w-model-dev-demo && npx vitest run ../w-model-dev/scripts/__tests__/root-cause-logic.test.ts`
Expected: 全部 PASS（11 个测试用例）

- [ ] **Step 3: TypeScript 编译检查**

Run: `cd w-model-dev-demo && npx tsc --noEmit ../w-model-dev/scripts/root-cause-logic.ts --strict --esModuleInterop --moduleResolution node`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/root-cause-logic.ts
git commit -m "feat(rootcause): 实现 R1-R10 校验纯逻辑（GREEN）"
```

---

### Task 5: 实现 check-rootcause-report.ts CLI 包装

**Files:**
- Create: `w-model-dev/scripts/check-rootcause-report.ts`

- [ ] **Step 1: 编写 CLI 包装（参照 check-verifier-output.ts 模式）**

```typescript
#!/usr/bin/env tsx
/**
 * RootCauseReport 校验脚本（Root Cause Report Checker）
 *
 * 对应 spec §4 RootCauseReport Schema。
 * 供 G 子代理在 R 产出 RootCauseReport JSON 后立即调用，
 * 防止 R 子代理输出漂移导致 S-fix 拿到不合规根因报告。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>
 *
 * 参数：
 *   report.json  R 子代理产出的 RootCauseReport JSON 文件路径
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（reasons 列出具体原因，R 必须按原因重新产出）
 *   2  输入错误（文件不存在 / 非法 JSON）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkRootCauseReport, type RootCauseReportShape } from './root-cause-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkRootCauseReport(parsed);
  const meta = (parsed as RootCauseReportShape)?.meta;

  console.log('═'.repeat(60));
  console.log('RootCauseReport 校验（Root Cause Report Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  if (meta) {
    console.log(`报告 ID       : ${meta.reportId}`);
    console.log(`目标产物      : ${meta.targetArtifact}`);
    console.log(`目标阶段      : ${meta.targetPhase}`);
    console.log(`返工轮次      : ${meta.reworkRound}`);
    console.log(`返工来源      : ${meta.reworkSource}`);
    console.log(`分析方法      : ${meta.method}`);
  }
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(`失败原因数    : ${result.reasons.length}`);
  if (result.reasons.length > 0) {
    console.log('─'.repeat(60));
    for (const reason of result.reasons) {
      console.log(`  • ${reason}`);
    }
  }
  console.log('═'.repeat(60));
  console.log(JSON.stringify({ passed: result.passed, reasonCount: result.reasons.length }));

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('RootCauseReport 校验异常:', err);
  process.exit(1);
});
```

- [ ] **Step 2: 手动验证 valid 样本退出码 0**

Run: `npx tsx w-model-dev/scripts/check-rootcause-report.ts w-model-dev/scripts/samples/rootcause/valid.json`
Expected: 退出码 0，输出含 `✓ 通过`

- [ ] **Step 3: 手动验证 bad-r1 样本退出码 1**

Run (PowerShell): `$p = Start-Process -FilePath "npx" -ArgumentList "tsx","w-model-dev/scripts/check-rootcause-report.ts","w-model-dev/scripts/samples/rootcause/bad-r1-missing-fields.json" -Wait -NoNewWindow -PassThru; $p.ExitCode`
Expected: ExitCode = 1

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/check-rootcause-report.ts
git commit -m "feat(rootcause): 实现 check-rootcause-report.ts CLI 包装"
```

---

### Task 6: 注册 rootcause 用例到 self-test.ts（基线 66→77）

**Files:**
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 在 self-test.ts 顶部 import 区新增 RootCause 导入**

定位现有 `import { checkCodeTlaConsistency, ... } from './code-tla-logic.js';` 后，新增：

```typescript
import { checkRootCauseReport, type RootCauseReportShape } from './root-cause-logic.js';
```

- [ ] **Step 2: 在 CASE 定义区新增 RootCauseCase 接口与 ROOTCAUSE_CASES 数组**

定位现有 `interface RunLogCase { ... }` 后，新增：

```typescript
interface RootCauseCase {
  /** 样本文件名（相对 samples/rootcause/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const ROOTCAUSE_CASES: RootCauseCase[] = [
  { file: 'valid.json', expectedPassed: true, description: '完整、合规的 RootCauseReport，应通过所有校验' },
  { file: 'bad-r1-missing-fields.json', expectedPassed: false, expectedReasonPatterns: [/rootCause/], description: 'R1 缺 rootCause 字段' },
  { file: 'bad-r2-chain-length.json', expectedPassed: false, expectedReasonPatterns: [/rootCauseChain.*长度/], description: 'R2 chain 仅 1 步' },
  { file: 'bad-r3-falsifiability.json', expectedPassed: false, expectedReasonPatterns: [/falsifiabilityCheck.*若.*则/], description: 'R3 无若...则句式' },
  { file: 'bad-r4-fix-recommendation.json', expectedPassed: false, expectedReasonPatterns: [/fixRecommendation.*rationale/], description: 'R4 缺 rationale' },
  { file: 'bad-r5-prevention.json', expectedPassed: false, expectedReasonPatterns: [/prevention.*owner/], description: 'R5 缺 owner' },
  { file: 'bad-r6-upstream-defect.json', expectedPassed: false, expectedReasonPatterns: [/upstreamDefect.*upstreamPhase/], description: 'R6 present=true 缺 upstreamPhase' },
  { file: 'bad-r7-quality-level.json', expectedPassed: false, expectedReasonPatterns: [/qualityLevel.*passed.*一致/], description: 'R7 qualityLevel=C 但 passed=true' },
  { file: 'bad-r8-report-id.json', expectedPassed: false, expectedReasonPatterns: [/reportId.*格式/], description: 'R8 reportId 含下划线' },
  { file: 'bad-r9-partial-missing.json', expectedPassed: false, expectedReasonPatterns: [/partialReports.*非空/], description: 'R9 多角度缺 partialReports' },
  { file: 'bad-r10-reality-confidence.json', expectedPassed: false, expectedReasonPatterns: [/reality-checker.*confidence/], description: 'R10 reality-checker confidence=0.3' },
];
```

- [ ] **Step 3: 新增 runRootCauseCases 函数**

定位现有 `async function runCodeTlaCases(...)` 后，新增：

```typescript
async function runRootCauseCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ROOTCAUSE_CASES) {
    const abs = path.join(samplesDir, 'rootcause', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkRootCauseReport(parsed);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    results.push({
      name: `rootcause/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}
```

- [ ] **Step 4: 在 main() 的 Promise.all 中注册 rootcause 用例**

定位现有 `const [ verifierResults, gateResults, ... ] = await Promise.all([ ... ]);`，扩展为：

```typescript
const [
  verifierResults, gateResults, graphResults, tlaResults,
  budgetResults, runLogResults, maturityResults, checkpointResults,
  codeTlaResults, rootcauseResults,
] = await Promise.all([
  runVerifierCases(samplesDir),
  runGateCases(samplesDir),
  runGraphCases(samplesDir),
  runTlaCases(samplesDir),
  runBudgetCases(samplesDir),
  runRunLogCases(samplesDir),
  runMaturityCases(samplesDir),
  runCheckpointCases(samplesDir),
  runCodeTlaCases(samplesDir),
  runRootCauseCases(samplesDir),
]);
const all = [
  ...verifierResults, ...gateResults, ...graphResults, ...tlaResults,
  ...budgetResults, ...runLogResults, ...maturityResults, ...checkpointResults,
  ...codeTlaResults, ...rootcauseResults,
];
```

同时在统计输出区新增 `console.log(\`RootCause 用例 : ${ROOTCAUSE_CASES.length}\`);`

- [ ] **Step 5: 运行 self-test 确认基线从 66 增至 77 且全部通过**

Run: `npx tsx w-model-dev/scripts/self-test.ts`
Expected: `总计 77 条用例：77 通过，0 失败`，退出码 0

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/self-test.ts
git commit -m "test(rootcause): self-test 注册 R 用例（基线 66→77）"
```

---

## 层 2：run-log / budget 扩展

### Task 7: 扩展 run-log-logic.ts（R1/R3/R6/R7 规则）

**Files:**
- Modify: `w-model-dev/scripts/run-log-logic.ts`
- Modify: `w-model-dev/scripts/__tests__/run-log-logic.test.ts`
- Create: `w-model-dev/scripts/samples/run-log/rootcause-valid.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/rootcause-missing-fix.jsonl`
- Create: `w-model-dev/scripts/samples/run-log/rootcause-missing-review.jsonl`

**对应 spec：** §5.5 run-log 新增动作类型 + §7.5/§7.6 R1/R3/R6/R7 扩展

- [ ] **Step 1: 创建 rootcause-valid.jsonl 样本（完整 R + S-fix + V 复审闭环）**

```jsonl
{"action":"produce","phase":"阶段5","actor":"S","artifacts":["src/auth.ts"],"tokens":1000,"timestamp":"2026-07-24T10:00:00Z"}
{"action":"review","phase":"阶段5","actor":"V","target":"src/auth.ts","qualityLevel":"C","passed":false,"reworkHints":["[Critical] 空密码未校验"],"tokens":800,"timestamp":"2026-07-24T10:05:00Z"}
{"action":"rootcause","phase":"阶段5","round":1,"actor":"R","reportId":"RC-phase5-1-01","rootCauseCategory":"requirement-gap","upstreamDefect":false,"rollbackRecommended":false,"tokens":1500,"timestamp":"2026-07-24T10:10:00Z"}
{"action":"review","phase":"阶段5","actor":"V","targetKind":"rootcause","target":"RC-phase5-1-01","qualityLevel":"A","passed":true,"reworkHints":[],"tokens":600,"timestamp":"2026-07-24T10:15:00Z"}
{"action":"fix","phase":"阶段5","round":1,"actor":"S-fix","basedOnReport":"RC-phase5-1-01","artifacts":["src/auth.ts"],"rtmDiff":{},"tokens":700,"timestamp":"2026-07-24T10:20:00Z"}
{"action":"review","phase":"阶段5","actor":"V","target":"src/auth.ts","qualityLevel":"A","passed":true,"reworkHints":[],"tokens":500,"timestamp":"2026-07-24T10:25:00Z"}
{"action":"gate","phase":"阶段5","actor":"G","script":"check-verifier-output.ts","exitCode":0,"tokens":200,"timestamp":"2026-07-24T10:30:00Z"}
```

- [ ] **Step 2: 创建 rootcause-missing-fix.jsonl（有 R 但缺 S-fix 记录）**

复制 rootcause-valid.jsonl，删除 `action:"fix"` 那一行。

- [ ] **Step 3: 创建 rootcause-missing-review.jsonl（有 R 但缺 V 复审 rootcause 记录）**

复制 rootcause-valid.jsonl，删除 `targetKind:"rootcause"` 那一行 review 记录。

- [ ] **Step 4: 在 run-log-logic.ts 的 ACTION_TYPES 常量中新增 rootcause / fix**

定位现有 `const ACTION_TYPES = ['produce','review','gate','rework','checkpoint','ingest-chunk','ingest-cross','ingest-evolve','escalate'] as const;`，扩展为：

```typescript
const ACTION_TYPES = [
  'produce', 'review', 'gate', 'rework', 'checkpoint',
  'ingest-chunk', 'ingest-cross', 'ingest-evolve', 'escalate',
  'rootcause', 'fix',
] as const;
```

- [ ] **Step 5: 在 R1（动作完整性）规则中新增 rootcause/fix 字段约束**

在 R1 校验函数中，针对 `rootcause` 动作新增字段校验：

```typescript
if (entry.action === 'rootcause') {
  if (!isNonEmptyString(entry.reportId)) reasons.push('rootcause 动作须含 reportId');
  if (!isNonEmptyString(entry.rootCauseCategory)) reasons.push('rootcause 动作须含 rootCauseCategory');
  if (typeof entry.upstreamDefect !== 'boolean') reasons.push('rootcause 动作须含 upstreamDefect(boolean)');
  if (typeof entry.rollbackRecommended !== 'boolean') reasons.push('rootcause 动作须含 rollbackRecommended(boolean)');
}
if (entry.action === 'fix') {
  if (!isNonEmptyString(entry.basedOnReport)) reasons.push('fix 动作须含 basedOnReport');
  if (!Array.isArray(entry.artifacts) || entry.artifacts.length === 0) reasons.push('fix 动作须含 artifacts(非空数组)');
}
```

- [ ] **Step 6: 在 R3（返工动作完整性）中扩展 R + S-fix 一一对应 + V 复审数 = R 数**

在 R3 校验函数末尾新增：

```typescript
// 扩展：每轮返工须有 R + S-fix 两条记录，reportId 一一对应，V 复审 rootcause 记录数 = R 记录数
const rootcauseActions = entries.filter(e => e.action === 'rootcause');
const fixActions = entries.filter(e => e.action === 'fix');
const rootcauseReviews = entries.filter(e => e.action === 'review' && e.targetKind === 'rootcause');

if (rootcauseActions.length !== fixActions.length) {
  reasons.push(`R3 扩展：rootcause 记录数(${rootcauseActions.length}) ≠ fix 记录数(${fixActions.length})，须一一对应`);
}
for (const r of rootcauseActions) {
  if (!fixActions.some(f => f.basedOnReport === r.reportId)) {
    reasons.push(`R3 扩展：rootcause 报告 ${r.reportId} 无对应 fix 记录（basedOnReport 缺失）`);
  }
}
if (rootcauseReviews.length !== rootcauseActions.length) {
  reasons.push(`R3 扩展：V 复审 rootcause 记录数(${rootcauseReviews.length}) ≠ R 记录数(${rootcauseActions.length})，每份 R 报告须有 V 复审`);
}
```

- [ ] **Step 7: 在 R6（exitCode 一致性）中新增 ROOTCAUSE_JSON 标记识别**

在 R6 校验函数中新增：

```typescript
// 扩展：check-rootcause-report.ts 产出的 ROOTCAUSE_JSON 标记
const rootcauseGateActions = entries.filter(e => e.action === 'gate' && e.script === 'check-rootcause-report.ts');
for (const g of rootcauseGateActions) {
  if (typeof g.exitCode !== 'number') {
    reasons.push(`R6 扩展：check-rootcause-report.ts gate 记录 ${g.timestamp} 缺 exitCode`);
  }
  // exitCode 须与对应 R 报告的 passed 一致（0=passed, 1=failed）
}
```

- [ ] **Step 8: 在 R7（时序）中扩展 rootcause→review→gate→fix→review→gate 顺序**

在 R7 校验函数中新增时序检查（返工路径内）：

```typescript
// 扩展：返工路径时序 rootcause → review(rootcause) → gate → fix → review → gate
for (let i = 0; i < entries.length; i++) {
  if (entries[i].action === 'rootcause') {
    // 后续须先有 review(rootcause) 再有 fix
    let j = i + 1;
    while (j < entries.length && entries[j].action !== 'review') j++;
    if (j >= entries.length || entries[j].targetKind !== 'rootcause') {
      reasons.push(`R7 扩展：rootcause 记录 ${entries[i].timestamp} 后须紧跟 review(targetKind=rootcause)`);
    }
    // fix 须在 review(rootcause) 之后
    while (j < entries.length && entries[j].action !== 'fix') j++;
    if (j >= entries.length) {
      reasons.push(`R7 扩展：rootcause 记录 ${entries[i].timestamp} 后须有 fix 记录`);
    }
  }
}
```

- [ ] **Step 9: 在 run-log-logic.test.ts 中新增 rootcause 相关测试用例**

```typescript
describe('run-log R1 扩展：rootcause/fix 动作字段', () => {
  it('rootcause 动作缺 reportId 时失败', async () => {
    const lines = await loadRunLogSample('rootcause-valid.jsonl');
    const bad = lines.map(l => l.action === 'rootcause' ? { ...l, reportId: undefined } : l);
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootcause.*reportId/.test(r))).toBe(true);
  });
});

describe('run-log R3 扩展：R + S-fix 一一对应', () => {
  it('有 R 但缺 S-fix 时失败', async () => {
    const lines = await loadRunLogSample('rootcause-missing-fix.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /rootcause.*fix.*一一对应|basedOnReport.*缺失/.test(r))).toBe(true);
  });
  it('有 R 但缺 V 复审 rootcause 时失败', async () => {
    const lines = await loadRunLogSample('rootcause-missing-review.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /V 复审 rootcause.*≠.*R 记录数/.test(r))).toBe(true);
  });
});
```

- [ ] **Step 10: 运行测试确认通过**

Run: `cd w-model-dev-demo && npx vitest run ../w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: 全部 PASS

- [ ] **Step 11: Commit**

```bash
git add w-model-dev/scripts/run-log-logic.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/scripts/samples/run-log/rootcause-*.jsonl
git commit -m "feat(run-log): R1/R3/R6/R7 扩展接纳 rootcause/fix 动作类型"
```

---

### Task 8: 扩展 budget-logic.ts（R4-A 多角度 token 预算规则）

**Files:**
- Modify: `w-model-dev/scripts/budget-logic.ts`
- Modify: `w-model-dev/scripts/__tests__/budget-logic.test.ts`
- Create: `w-model-dev/scripts/samples/budget/rootcause-over-budget.json`

**对应 spec：** §9.9 Token 预算扩展 + §8.2 check-budget.ts R4-A 规则

- [ ] **Step 1: 创建 rootcause-over-budget.json 样本**

```json
{
  "schemaVersion": "1.0",
  "project": "w-model-dev-demo",
  "phase": "阶段5",
  "totalBudget": 1000000,
  "usedBudget": 500000,
  "rootcauseParallelBudget": {
    "maxPersonasPerRound": 5,
    "maxTokensPerPersona": 50000,
    "maxTotalTokensPerRound": 200000
  },
  "rootcauseRounds": [
    {
      "round": 1,
      "personas": [
        { "personaSlice": "engineering-incident-response-commander", "tokens": 48000 },
        { "personaSlice": "engineering-code-reviewer", "tokens": 45000 },
        { "personaSlice": "testing-evidence-collector", "tokens": 50000 },
        { "personaSlice": "testing-reality-checker", "tokens": 60000 }
      ],
      "totalTokens": 203000
    }
  ]
}
```

- [ ] **Step 2: 在 budget-logic.ts 的 BudgetShape 类型中新增 rootcauseParallelBudget + rootcauseRounds**

```typescript
export interface RootcauseParallelBudget {
  maxPersonasPerRound: number;
  maxTokensPerPersona: number;
  maxTotalTokensPerRound: number;
}

export interface RootcauseRoundTokens {
  round: number;
  personas: Array<{ personaSlice: string; tokens: number }>;
  totalTokens: number;
}

export interface BudgetShape {
  // ... 现有字段 ...
  rootcauseParallelBudget?: RootcauseParallelBudget;
  rootcauseRounds?: RootcauseRoundTokens[];
}
```

- [ ] **Step 3: 在 budget-logic.ts 中新增 R4-A 校验函数**

```typescript
/**
 * R4-A：多角度 R 的 token 预算校验（不论并行/串行均累计）
 *
 * 校验规则：
 *   - 每轮 persona 数 ≤ maxPersonasPerRound
 *   - 每个 persona tokens ≤ maxTokensPerPersona
 *   - 每轮总 tokens ≤ maxTotalTokensPerRound（串行分派时累计）
 *
 * 对应 spec §9.9。
 */
export function checkRootcauseBudget(b: BudgetShape): BudgetCheckResult {
  const reasons: string[] = [];
  const cfg = b.rootcauseParallelBudget;
  if (!cfg) {
    // 未配置多角度预算时不校验（向后兼容）
    return { passed: true, reasons: [] };
  }
  if (!Array.isArray(b.rootcauseRounds) || b.rootcauseRounds.length === 0) {
    return { passed: true, reasons: [] };
  }

  for (const round of b.rootcauseRounds) {
    if (round.personas.length > cfg.maxPersonasPerRound) {
      reasons.push(`R4-A：round ${round.round} persona 数 ${round.personas.length} > maxPersonasPerRound ${cfg.maxPersonasPerRound}`);
    }
    for (const p of round.personas) {
      if (p.tokens > cfg.maxTokensPerPersona) {
        reasons.push(`R4-A：round ${round.round} persona ${p.personaSlice} tokens ${p.tokens} > maxTokensPerPersona ${cfg.maxTokensPerPersona}`);
      }
    }
    if (round.totalTokens > cfg.maxTotalTokensPerRound) {
      reasons.push(`R4-A：round ${round.round} 总 tokens ${round.totalTokens} > maxTotalTokensPerRound ${cfg.maxTotalTokensPerRound}（串行分派时累计，触发 killSwitch）`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: 在主 checkBudget 函数中调用 R4-A**

```typescript
const r4a = checkRootcauseBudget(b);
reasons.push(...r4a.reasons);
```

- [ ] **Step 5: 在 budget-logic.test.ts 中新增 R4-A 测试用例**

```typescript
describe('R4-A 多角度 R token 预算', () => {
  it('总 tokens 超限时失败', async () => {
    const b = await loadBudgetSample('rootcause-over-budget.json');
    const result = checkBudget(b);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /R4-A.*总 tokens.*maxTotalTokensPerRound/.test(r))).toBe(true);
  });
});
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd w-model-dev-demo && npx vitest run ../w-model-dev/scripts/__tests__/budget-logic.test.ts`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/budget-logic.ts w-model-dev/scripts/__tests__/budget-logic.test.ts w-model-dev/scripts/samples/budget/rootcause-over-budget.json
git commit -m "feat(budget): 新增 R4-A 多角度 R token 预算规则（并行/串行均累计）"
```

---

## 层 3：R 方法论与人格矩阵文档

### Task 9: 创建 root-cause-locator.md（R 方法论指南）

**Files:**
- Create: `w-model-dev/references/root-cause-locator.md`

**对应 spec：** §3 R 方法论框架 + §9 多角度机制节

- [ ] **Step 1: 创建 root-cause-locator.md**

```markdown
# 根因定位者方法论指南（Root Cause Locator Guide）

> **定位**：R 子代理的可执行方法论指南，与 `agent-personas.md` 平级。
> **权威定义**：见 [skill-design-document_SSoT.md](../../docs/skill-design-document_SSoT.md) §6.4 R 角色定义节。
> **关联 spec**：[2026-07-24-root-cause-locator-and-fixer-roles-design.md](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §3 + §9
> **与 agent-personas.md 的关系**：agent-personas.md 定义 V 子代理的评审角色视角；本文件定义 R 子代理的诊断方法论。两者互补，R 不调用 Persona，Persona 不调用 R。

---

## 1. 根因分析方法库（4 种方法，按场景选用）

### 方法 1：5-Why 追溯（默认方法）

**适用**：单一缺陷的纵向根因追溯。

```
现象（V/G 的 reworkHint）
  └─ Why 1: 为什么出现？→ <直接原因>
       └─ Why 2: 为什么出现直接原因？→ <深层原因>
            └─ Why 3: ...
                 └─ Why N: 直到触及 <根因>
```

**终止条件**：触及「流程缺失 / 规格遗漏 / 设计缺陷 / 上游产物缺陷」之一，或达到 5 层。

### 方法 2：鱼骨图分析（多因素缺陷）

**适用**：一个 reworkHint 涉及多因素。

**维度（适配 W 模型）**：
- **需求维度**：需求规格是否清晰/完整/无歧义？
- **设计维度**：设计是否覆盖需求/接口明确/状态机完整？
- **编码维度**：代码是否遵循设计/边界处理/错误路径覆盖？
- **测试维度**：测试是否覆盖该路径/用例正确？
- **流程维度**：阶段门是否跳过/ingestion 是否遗漏/TLA+ 是否建模？
- **工具维度**：门禁脚本是否漏检/Schema 是否缺失校验？

**产出**：每个维度的「是/否/部分」+ 证据 + 主因标记。

### 方法 3：缺陷链追溯（跨产物传播）

**适用**：缺陷在多个产物间传播。

```
需求规格 ──缺陷──► 系统设计 ──继承──► 详细设计 ──实现──► 代码 ──漏测──► 测试
   ↑                      ↑                    ↑              ↑            ↑
  根因                  传播                  传播           表现         未拦截
```

**产出**：缺陷链节点列表 + 每节点「引入/传播/表现/未拦截」标签 + 根因节点标记。

### 方法 4：上游回溯（跨阶段根因）

**适用**：R 在当前阶段产物中找不到根因，怀疑根因在上游阶段。

**约束**：R 仅标记 `upstreamDefect`，不修改上游产物。`upstreamDefect` 经 V 复审通过后，编排者可触发阶段回退（见 spec §6.5 场景 5）。

---

## 2. 方法选择规则

| reworkHint 特征 | 选用方法 |
|---|---|
| 单一明确缺陷（如 null 指针） | 5-Why |
| 多因素复合缺陷 | 鱼骨图 |
| 缺陷在多产物间传播 | 缺陷链追溯 |
| 当前阶段产物无明显缺陷但 V/G 不通过 | 上游回溯 |
| 复杂场景 | 组合（先鱼骨图定位维度，再 5-Why 纵向追溯） |

---

## 3. R 产出质量标准

1. **根因必须可证伪**：每条根因须附「若根因消除，现象是否消失」的可验证假设。
2. **禁止现象当根因**：「代码写错了」是现象不是根因；「需求规格未规定 null 处理，编码默认不检查」才是根因。
3. **fixRecommendation 必须针对根因**：禁止「建议修复代码」泛化建议；须指明「修改 `<文件>:<行>` 的 `<具体内容>`，因为 `<根因>`」。
4. **prevention 必须可执行**：禁止「加强评审」泛化建议；须指明「在 `<phase-N>` 的 `<检查项>` 中增加 `<具体检查>`」。
5. **upstreamDefect 必须附证据**：标记上游缺陷须引用上游产物的具体段落/行号/节点 ID。

---

## 4. 多人格多角度分析机制

> **本机制的本质是「多角度」，不是「并行」。** 并行只是性能优化，串行同样合法。详见 spec §9.2。

### 4.1 核心原则

在强制多角度场景（Critical/Required 缺陷的 R 定位、根因报告 V 复审、maxReworkRounds 最后一轮）下，R-lead / V-lead **必须**加载 N 个不同 persona，从 N 个不同视角产出 N 份 PartialReport 并聚合——**不论这 N 个 persona 是同时分派（并行）还是依次分派（串行）**。

### 4.2 分派方式选择

| 宿主 Agent 能力 | 分派方式 | 说明 |
|---|---|---|
| 支持并行子代理 | **并行分派**（推荐） | N 个 R-persona 同时执行，R-lead 收齐 N 份后聚合 |
| 仅支持串行子代理 | **串行分派**（合法等价） | R-lead 依次分派 N 个 R-persona，每个产出后收集，N 份齐后聚合 |
| 单会话无子代理 | **单 R-lead 多轮切换 persona**（降级） | R-lead 自身多轮加载不同 persona |

**关键约束（三种方式均强制）**：
1. N 份 PartialReport 必须独立产出
2. 聚合规则不变（见 spec §9.6）
3. PartialReport 归档不变（`.w-model/rootcause/partial/<reportId>/<personaSlice>.json`）
4. run-log 记录不变（每份 PartialReport 各记一条 `rootcause` 动作）

### 4.3 persona 选择矩阵

详见 [subagent-persona-matrix.md](subagent-persona-matrix.md)。

### 4.4 R-lead 聚合规则

1. **根因收敛**：≥⌈N×0.6⌉ 个 persona 收敛到同一根因 → 采纳
2. **分歧仲裁**：根因分散时，R-lead 须记录分歧 + 选择主根因 + 标注 minority 视角
3. **证据合并**：合并所有 persona 的 evidence，去重
4. **fixRecommendation 合并**：按根因收敛度排序
5. **upstreamDefect 仲裁**：任一 persona 标记则 R-lead 须复核
6. **reality-check 硬约束**：testing-reality-checker confidence < 0.5 → 最终 `passed=false`

---

## 5. 与 systematic-debugging 技能的关系

本方法论吸收 `systematic-debugging` 技能的 `root-cause-tracing.md` 原则，但适配 W 模型：
- systematic-debugging 面向「运行时 bug 调试」
- 本方法论面向「W 模型阶段产物缺陷诊断」
- 两者共享「根因优先于症状」「可证伪假设」「缺陷链追溯」原则

---

## 6. 分派模板

详见 [subagent-delegation.md](subagent-delegation.md)「R 子代理分派模板」节与「R-lead 子代理分派模板（多角度变体）」节。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/root-cause-locator.md
git commit -m "docs(rootcause): 新增 R 方法论指南（4 种方法 + 质量标准 + 多角度节）"
```

---

### Task 10: 创建 subagent-persona-matrix.md（人格选择矩阵）

**Files:**
- Create: `w-model-dev/references/subagent-persona-matrix.md`

**对应 spec：** §9.3 R-persona 选择矩阵 + §9.4 V-persona 选择矩阵

- [ ] **Step 1: 创建 subagent-persona-matrix.md**

```markdown
# 人格选择矩阵（Subagent Persona Matrix）

> **定位**：R-lead / V-lead 在多角度分析时选择 persona 的参考矩阵。
> **关联 spec**：[2026-07-24-root-cause-locator-and-fixer-roles-design.md](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §9.3 + §9.4
> **人格库**：[w-model-dev/subagent/](../subagent/) 含 28 个人格文件，分 5 类。

---

## 1. 现有人格库盘点

| 类别 | 数量 | 人格 | R/V 适用性 |
|---|---|---|---|
| **engineering** | 13 | code-reviewer, senior-developer, software-architect, backend-architect, frontend-developer, ai-engineer, data-engineer, database-optimizer, autonomous-optimization-architect, incident-response-commander, threat-detection-engineer, technical-writer×2 | R + V |
| **testing** | 7 | api-tester, performance-benchmarker, reality-checker, evidence-collector, test-results-analyzer, tool-evaluator, workflow-optimizer | R + V |
| **design** | 3 | ui-designer, ux-architect, ux-researcher | V（阶段 2-3 设计评审） |
| **product** | 3 | product-manager, feedback-synthesizer, trend-researcher, behavioral-nudge-engine | V（阶段 1 需求评审） |
| **project** | 2 | project-manager-senior, experiment-tracker | V（阶段 1-2 流程评审） |

---

## 2. R-persona 选择矩阵（按 rootCause.category 与阶段）

> 分派方式：并行/串行均可（见 [root-cause-locator.md](root-cause-locator.md) §4.2）

| rootCause.category 候选 | 阶段 | 加载的 R-persona |
|---|---|---|
| `coding-error` | 5 | engineering-code-reviewer + engineering-senior-developer + testing-evidence-collector |
| `design-flaw` | 2-4 | engineering-software-architect + engineering-backend-architect（或 frontend-developer）+ testing-reality-checker |
| `requirement-gap` | 1-4 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| `test-gap` | 4-7 | testing-api-tester + testing-performance-benchmarker + testing-test-results-analyzer |
| `process-missing` | 全阶段 | project-manager-senior + testing-workflow-optimizer + engineering-incident-response-commander |
| `tool-gap` | 全阶段 | engineering-autonomous-optimization-architect + testing-tool-evaluator |
| `upstream-defect` | 全阶段 | engineering-incident-response-commander + testing-evidence-collector + engineering-technical-writer |
| 安全相关 Critical | 5-7 | engineering-threat-detection-engineer + engineering-code-reviewer + testing-reality-checker |
| 性能相关 Critical | 5-7 | engineering-database-optimizer + testing-performance-benchmarker + engineering-backend-architect |
| AI/LLM 相关 | 5 | engineering-ai-engineer + engineering-code-reviewer + testing-reality-checker |

---

## 3. V-persona 选择矩阵（评审多角度）

| 评审场景 | 阶段 | 加载的 V-persona |
|---|---|---|
| 需求规格评审 | 1 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| 系统设计评审 | 2 | engineering-software-architect + engineering-backend-architect + engineering-threat-detection-engineer + testing-reality-checker |
| 概要/详细设计评审 | 3-4 | engineering-software-architect + design-ux-architect + engineering-database-optimizer + testing-api-tester |
| 代码评审 | 5 | engineering-code-reviewer + engineering-senior-developer + engineering-threat-detection-engineer + testing-evidence-collector |
| 测试评审 | 6-7 | testing-api-tester + testing-performance-benchmarker + testing-reality-checker + testing-test-results-analyzer |
| 根因报告复审（targetKind=rootcause） | 全阶段 | testing-reality-checker + engineering-incident-response-commander + testing-evidence-collector |

---

## 4. 分派数量约束

| 场景 | 默认 persona 数 | 上限 | 约束 |
|---|---|---|---|
| R-persona | 3 | 5 | 防止 token 爆炸；incident-response-commander 必含（5-Why 主导） |
| V-persona（评审产物） | 3 | 5 | reality-checker 必含（防幻想通过） |
| V-persona（复审根因） | 2 | 3 | reality-checker + evidence-collector 必含 |

> persona 数量约束与分派方式（并行/串行）无关：串行分派 3 个 persona 与并行分派 3 个 persona 在数量约束上等价。
> 数量可在 `project.json` 的 `phaseConfig.<phase>.parallelPersonas` 覆盖（字段名保留向后兼容，实际含义为「每轮 persona 数」）。

---

## 5. 强制 vs 可选

> 本节的「强制」指**强制多角度**（必须加载 N 个 persona 并聚合），**不要求必须并行**。

| 场景 | 强制/可选 | 说明 |
|---|---|---|
| Critical/Required 缺陷的 R 定位 | **强制多角度** | 严重缺陷须多角度根因（并行或串行均可） |
| Optional/Nit/FYI 缺陷的 R 定位 | 可选多角度（默认单 R-lead） | 轻微缺陷可单 R-lead 产出 |
| 阶段门 V 评审（首次） | 可选多角度（默认单 V） | 首次评审可单 persona |
| 根因报告 V 复审 | **强制多角度** | 根因准确性须多角度保证 |
| maxReworkRounds 达上限前一轮 | **强制多角度** | 最后一轮须多角度穷尽 |
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/subagent-persona-matrix.md
git commit -m "docs(rootcause): 新增人格选择矩阵（R-persona/V-persona）"
```

---

## 层 4：references/ 层文档更新

### Task 11: 更新 anti-patterns.md（新增 #18/#19 + 扩展 #4/#10/#12）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

**对应 spec：** §7.1 新增反模式 + §7.2 现有反模式扩展 + §7.3 命中高发阶段扩展

- [ ] **Step 1: 在反模式清单表格末尾新增 #18、#19 两行**

定位现有表格 `| 17 | TLA+ 建模与需求/设计不符未回退 | ...` 行后，新增：

```markdown
| 18 | 跳过 R 直接分派 S 返工（V/G 不通过后直接 S-fix，未经 R 根因定位） | 修复针对症状不针对根因，同问题反复出现；缺陷链未追溯，上游缺陷被掩盖 | V/G 不通过 → 必须先分派 R 定位 → V 复审根因 → G 门禁 → S-fix 携 R 报告修复（见 [root-cause-locator.md](root-cause-locator.md)） |
| 19 | R 报告未经 V 复审直接交 S 修复 | 根因准确性无独立保证，S 基于错误根因修复，浪费一轮返工 | R 产出后必须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix |
```

- [ ] **Step 2: 扩展 #4 反模式（评审未通过悄悄小修后继续）**

定位 `| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评 |`，替换为：

```markdown
| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评。V/G 不通过后，未经 R 定位直接小修也命中 #4。修复路径必须经 R→V→G→S-fix |
```

- [ ] **Step 3: 扩展 #10 反模式（编排者越权实施）**

定位 `| 10 | 编排者越权实施（写代码 / 改文档 / 产出评审 JSON / 改 RTM 实体 / 生成测试用例） | ...`，在危害描述末尾新增信号 6/7 说明：

```markdown
| 10 | 编排者越权实施（写代码 / 改文档 / 产出评审 JSON / 改 RTM 实体 / 生成测试用例 / 越权做根因分析） | 编排者上下文污染、评审独立性丧失、状态机失真、违反「技能不内置 LLM」架构原则；编排者直接判定根因并分派 S-fix 会绕过 R 独立定位 | 编排者仅分派 S / V / G / R 子代理执行实施动作；自身只做路由 + 状态 + CHECKPOINT + 只读脚本（见 [subagent-delegation.md](subagent-delegation.md)）。检测信号 6：编排者会话出现 rootCauseChain / rootCause 等 RootCauseReport 字段；信号 7：编排者直接判定根因并分派 S-fix（无 R 报告路径作为 S-fix 输入） |
```

- [ ] **Step 4: 扩展 #12 反模式（A 自评收敛）**

定位 `| 12 | A 子代理自评收敛（用 LLM 输出判定收敛） | ...`，在正确做法末尾新增：

```markdown
| 12 | A 子代理自评收敛（用 LLM 输出判定收敛） | "LLM 估算质量门"在 ingestion 场景的变体，收敛判定漂移 | 收敛判定由 G 跑 `check-requirement-graph.ts` 退出码决定，A 的 `reworkHints` 仅作指引。A 子流程返工也须走 R 定位（图谱/TLA+ 返工同样适用 R 循环），禁止 A 自评根因 |
```

- [ ] **Step 5: 在「命中高发阶段」表中新增 #18/#19 两行**

定位现有 `| #17（TLA+ 与需求/设计不符未回退） | 阶段 1~4 | [tla-plus-guide.md](tla-plus-guide.md)「建模与需求/设计一致性」节 |` 行后，新增：

```markdown
| #18（跳过 R 直接 S 返工） | 全阶段 | [root-cause-locator.md](root-cause-locator.md) + 各 phase-N「返工路径」节 |
| #19（R 报告未 V 复审） | 全阶段 | [root-cause-locator.md](root-cause-locator.md)「R 产出质量标准」节 |
```

- [ ] **Step 6: 在「检测信号与回退命令」表中新增 #18/#19 检测信号**

定位表格末尾 `| #17 | ... |` 行后，新增：

```markdown
| #18 | V/G 不通过后编排者直接分派 S 返工（无 R 报告作为 S-fix 输入） | 回到 V/G 不通过节点，分派 R 定位 → V 复审 → G 门禁 → S-fix | `check-rootcause-report.ts` 退出码 0 + run-log R3 扩展（R+S-fix 一一对应） |
| #19 | R 报告产出后无 V 复审记录（targetKind=rootcause）直接分派 S-fix | 回到 R 产出节点，分派 V 复审 → G 门禁后才可 S-fix | `check-verifier-output.ts`（targetKind=rootcause）退出码 0 + run-log R3 扩展（V 复审数=R 数） |
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "docs(anti-patterns): 新增 #18/#19 + 扩展 #4/#10/#12 反模式"
```

---

### Task 12: 更新 subagent-delegation.md（R/V-rootcause/S-fix/R-lead 分派模板）

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

**对应 spec：** §5.1-§5.4 分派模板 + §9.12 R-lead 多角度分派模板

- [ ] **Step 1: 在角色表新增 R 行**

定位现有 O/S/V/G/A 角色表，新增 R 行（允许/禁止动作见 spec §1.1）。

- [ ] **Step 2: 新增「R 子代理分派模板」节**

完整复制 spec §5.1 的 R 子代理分派模板内容。

- [ ] **Step 3: 新增「V 复审根因报告分派模板（targetKind=rootcause）」节**

完整复制 spec §5.2 的 V-rootcause 复审分派模板内容。

- [ ] **Step 4: 新增「S 兼 F 修复分派模板（返工变体）」节**

完整复制 spec §5.3 的 S-fix 分派模板内容。

- [ ] **Step 5: 新增「R-lead 子代理分派模板（多角度变体，并行/串行均可）」节**

完整复制 spec §9.12 的 R-lead 多角度分派模板内容（含 dispatchMode 字段）。

- [ ] **Step 6: 在回填契约节新增 R/S-fix 返回格式**

完整复制 spec §5.4 的 R 子代理返回格式 JSON。

- [ ] **Step 7: 在强制约束节新增「跳过 R 命中 #18」**

```markdown
- **跳过 R 命中反模式 #18**：V/G 不通过后，编排者必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。直接分派 S 返工（无 R 报告作为输入）命中 #18。
```

- [ ] **Step 8: 在时序图节更新返工路径**

更新时序图为：V/G 不通过 → R → V → G → S-fix → V → G。

- [ ] **Step 9: 在失败模式表新增 R 相关场景**

新增：R 自评不通过、V 复审根因不通过、G 门禁（check-rootcause-report.ts）不通过、S-fix 修复后 V/G 仍不通过、阶段回退等场景。

- [ ] **Step 10: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs(subagent-delegation): 新增 R/V-rootcause/S-fix/R-lead 分派模板"
```

---

### Task 13: 更新 workflow.md（返工循环 + 回退路径映射）

**Files:**
- Modify: `w-model-dev/references/workflow.md`

**对应 spec：** §2.2 新循环 + §6.4 回退路径阶段编号映射

- [ ] **Step 1: 更新总体流程图返工路径**

定位现有 `V/G 不通过 → 分派 S 返工（带 reworkHints）→ 重走 V → G`，替换为 spec §2.2 的新循环流程图（V/G→R→V→G→S-fix→V→G）。

- [ ] **Step 2: 在回退路径阶段编号映射表新增 R 根因分类列**

完整复制 spec §6.4 的回退路径阶段编号映射表。

- [ ] **Step 3: 在阶段门评审节新增 R 介入说明**

```markdown
### R 介入说明

V/G 不通过（exitCode≠0 或 qualityLevel∈{C,D}）时，编排者必须分派 R 子代理定位根因，禁止直接分派 S 返工（命中反模式 #18）。R 产出后须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix 修复。详见 [root-cause-locator.md](root-cause-locator.md)。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/workflow.md
git commit -m "docs(workflow): 更新返工循环为 V/G→R→V→G→S-fix→V→G + 回退路径映射"
```

---

### Task 14: 更新 data-models.md（run-log schema + budget schema）

**Files:**
- Modify: `w-model-dev/references/data-models.md`

**对应 spec：** §5.5 run-log 新增动作 + §7.5 run-log schema 扩展 + §9.9 budget schema 扩展

- [ ] **Step 1: 在 run-log.jsonl action 枚举中新增 rootcause / fix**

定位现有 `现有：produce | review | gate | rework | checkpoint | ingest-chunk | ingest-cross | ingest-evolve | escalate`，扩展为：

```markdown
现有：produce | review | gate | rework | checkpoint | ingest-chunk | ingest-cross | ingest-evolve | escalate
新增：rootcause | fix
```

- [ ] **Step 2: 新增 rootcause 动作字段约束**

```markdown
- `rootcause`：须含 `reportId` / `rootCauseCategory` / `upstreamDefect` / `rollbackRecommended` 字段
```

- [ ] **Step 3: 新增 fix 动作字段约束**

```markdown
- `fix`：须含 `basedOnReport` / `artifacts` 字段
```

- [ ] **Step 4: 在 escalate 动作中新增 reportId 字段**

```markdown
- `escalate`：新增可选字段 `reportId`（仅 upstreamDefect 触发的升级）
```

- [ ] **Step 5: 在 budget.json schema 中新增 rootcauseParallelBudget 字段**

```markdown
### rootcauseParallelBudget（新增）

```json
{
  "rootcauseParallelBudget": {
    "maxPersonasPerRound": 5,
    "maxTokensPerPersona": 50000,
    "maxTotalTokensPerRound": 200000
  }
}
```

字段说明：多角度 R 的 token 预算配置（不论并行/串行均累计）。
```

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/references/data-models.md
git commit -m "docs(data-models): run-log 新增 rootcause/fix 动作 + budget 新增 rootcauseParallelBudget"
```

---

### Task 15: 更新 verifier-spec.md（targetKind=rootcause + 五轴映射）

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

**对应 spec：** §5.2 V 复审根因报告分派模板 + §8.2 verifier-spec.md 修改

- [ ] **Step 1: 在 §7 targetKind 枚举中新增 rootcause**

定位现有 targetKind 枚举，新增 `rootcause`。

- [ ] **Step 2: 在 §7.4A 五轴评审映射中新增 rootcause 子标准**

```markdown
### rootcause 子标准（V 复审根因报告时）

| 维度 | 说明 |
|---|---|
| correctness | 根因链是否逻辑自洽？证据是否支持？ |
| completeness | 是否触及根本原因而非停在现象？ |
| falsifiability | 可证伪假设是否可验证？ |
| actionability | fixRecommendation 是否针对根因且可执行？ |
| prevention | 预防措施是否可落实？ |
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(verifier-spec): targetKind 新增 rootcause + 五轴映射 rootcause 子标准"
```

---

### Task 16: 更新 agent-personas.md（与 R 关系 + 多角度分派说明）

**Files:**
- Modify: `w-model-dev/references/agent-personas.md`

**对应 spec：** §8.2 agent-personas.md 修改 + §9.10 兼容性

- [ ] **Step 1: 新增「与 root-cause-locator.md 的关系」节**

```markdown
## 与 root-cause-locator.md 的关系

- `agent-personas.md` 定义 V 子代理的评审角色视角（product-manager / code-reviewer 等）
- `root-cause-locator.md` 定义 R 子代理的诊断方法论（5-Why / 鱼骨图 / 缺陷链 / 上游回溯）
- 两者互补：R 不调用 Persona，Persona 不调用 R
- V 复审根因报告（targetKind=rootcause）时，V 子代理加载 persona（如 reality-checker / incident-response-commander / evidence-collector）从多角度复审
```

- [ ] **Step 2: 新增「与 subagent/ 人格库的关系」节**

```markdown
## 与 subagent/ 人格库的关系

`w-model-dev/subagent/` 含 28 个人格文件，供 R-lead / V-lead 在多角度分析时加载。详见 [subagent-persona-matrix.md](subagent-persona-matrix.md)。
```

- [ ] **Step 3: 新增「多角度分派说明（并行/串行均可）」节**

```markdown
## 多角度分派说明

多角度分析的本质是「多角度」，不是「并行」。并行只是性能优化，串行同样合法。详见 [root-cause-locator.md](root-cause-locator.md) §4.2 与 spec §9.2。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/agent-personas.md
git commit -m "docs(agent-personas): 新增与 R 关系 + 多角度分派说明"
```

---

### Task 17: 更新 operational-recovery.md（token 计量 + 场景 5 回退）

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

**对应 spec：** §8.2 operational-recovery.md 修改 + §6.5/§6.6 场景 5 阶段回退

- [ ] **Step 1: 在成本预算与运行日志节新增 rootcause/fix 动作的 token 计量**

```markdown
### rootcause / fix 动作 token 计量（新增）

- `rootcause` 动作：R 子代理（含 R-lead + N 个 R-persona）的 tokens 累计。串行分派时，每条 `rootcause` 动作各记 tokens，最终汇总校验 R4-A 预算。
- `fix` 动作：S-fix 子代理的 tokens。
- `escalate` 动作（upstreamDefect 触发）：记录 `reportId` 与升级原因。
```

- [ ] **Step 2: 在 CHECKPOINT 放行节新增场景 5 阶段回退说明**

```markdown
### 场景 5：阶段回退（新增）

触发条件（三者全部满足）：
1. round ≥ 2（多轮返工）
2. R 标记 upstreamDefect.present=true 且 rollbackRecommended=true
3. V 复审 R 报告 passed=true 且 upstreamDefect 字段复审通过

编排者强制 🔴 CHECKPOINT · 阶段回退决策，展示返工历史 + R 的 upstreamDefect 详情 + V 复审结论 + 建议回退阶段编号，由用户选择 A/B/C。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "docs(operational-recovery): 新增 rootcause/fix token 计量 + 场景 5 阶段回退"
```

---

## 层 5：顶层文档更新

### Task 18: 更新 SKILL.md（角色表 + 约束第 9 条 + 返工路径）

**Files:**
- Modify: `w-model-dev/SKILL.md`

**对应 spec：** §7.7 SKILL.md 集成

- [ ] **Step 1: 在角色表（O/S/V/G/A）中新增 R 行；F 标注为「S 兼任」**

定位现有角色表，新增 R 行（职责/允许动作/禁止动作见 spec §1.1），并在 S 行末尾标注「F（修复者）由 S 兼任」。

- [ ] **Step 2: 在「不可违反的约束」节新增第 9 条**

```markdown
9. **返工必经根因定位**：V/G 不通过后，必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。
```

- [ ] **Step 3: 在返工路径节更新为 R→V→G→S-fix 循环**

```markdown
### 返工路径（更新）

V/G 不通过 → O 分派 R 定位 → V 复审根因 → G 门禁（check-rootcause-report.ts）→ O 分派 S-fix 修复 → V 评审修复产物 → G 门禁 → 通过则阶段门放行 / 不通过则 round++ 重新 R 定位。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs(SKILL): 角色表新增 R + 约束第 9 条 + 返工路径更新"
```

---

### Task 19: 更新 SSoT §3.4/§6.4/§10/§4A

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

**对应 spec：** §7.8 SSoT §3.4 / §6.4 扩展 + §8.2 SSoT 修改

- [ ] **Step 1: 在 §3.4 编排者-子代理边界角色表新增 R 行**

- [ ] **Step 2: 在 §6.4 角色定义节新增 R 角色定义**

完整复制 spec §1.1 的 R 角色定义表。F 标注为 S 兼任。

- [ ] **Step 3: 在 §6.4.x 新增 root-cause-locator 方法论引用 + 多角度机制说明**

```markdown
### R 方法论与多角度机制

R 子代理的方法论详见 [root-cause-locator.md](../w-model-dev/references/root-cause-locator.md)。多角度分析机制（并行/串行均可）详见 spec §9.2 与 [subagent-persona-matrix.md](../w-model-dev/references/subagent-persona-matrix.md)。
```

- [ ] **Step 4: 在 §10.x 新增 check-rootcause-report.ts 校验项**

```markdown
### check-rootcause-report.ts（新增）

R 报告校验脚本，对应 spec §4 RootCauseReport Schema 与 R1-R10 校验规则。退出码 0=通过 / 1=校验失败 / 2=输入错误。
```

- [ ] **Step 5: 在 §4A 反模式清单新增 #18/#19**

完整复制 spec §7.1 的 #18/#19 反模式行。

- [ ] **Step 6: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(SSoT): §3.4/§6.4 新增 R 角色 + §10 新增 check-rootcause-report + §4A 新增 #18/#19"
```

---

### Task 20: 更新 AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**对应 spec：** §8.2 AGENTS.md 修改

- [ ] **Step 1: 在 §2 角色描述新增 R + subagent/ 目录描述更新**

- [ ] **Step 2: 在 §6 行动约束新增 R 相关**

```markdown
- V/G 不通过后必须分派 R 子代理定位根因，禁止直接分派 S 返工（命中反模式 #18）
- R 报告必须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix（命中反模式 #19）
```

- [ ] **Step 3: 在 §7 修复记录新增本次**

- [ ] **Step 4: 在 §8 脚本导航表新增 check-rootcause-report.ts**

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): 角色新增 R + 行动约束 + 脚本导航"
```

---

### Task 21: 更新 README.md

**Files:**
- Modify: `README.md`

**对应 spec：** §8.2 README.md 修改

- [ ] **Step 1: 在角色概览节新增 R**

- [ ] **Step 2: 更新返工流程图**

更新为 V/G→R→V→G→S-fix→V→G 循环。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(README): 角色概览新增 R + 返工流程图更新"
```

---

### Task 22: 更新 CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

**对应 spec：** §8.2 CHANGELOG.md 修改

- [ ] **Step 1: 新增本次变更条目**

```markdown
## [Unreleased] - 2026-07-24

### Added
- 新增根因定位者（R）角色与修复者（F，由 S 兼任）角色
- 新增返工循环 V/G→R→V→G→S-fix→V→G
- 新增 RootCauseReport Schema 与 check-rootcause-report.ts 校验脚本（R1-R10 规则）
- 新增 root-cause-locator.md（R 方法论指南）与 subagent-persona-matrix.md（人格选择矩阵）
- 新增多人格多角度分析机制（并行/串行均可）
- 新增反模式 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审）
- 新增 SKILL.md 约束第 9 条（返工必经根因定位）
- run-log 新增 rootcause / fix 动作类型
- budget 新增 rootcauseParallelBudget 字段与 R4-A 校验规则

### Changed
- anti-patterns.md #4/#10/#12 扩展（纳入 R 相关检测信号）
- workflow.md 返工路径更新为 R 循环
- data-models.md run-log schema 扩展
- verifier-spec.md targetKind 新增 rootcause
- self-test.ts 基线从 66 增至 77
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(CHANGELOG): 新增 R/F 角色变更条目"
```

---

## 层 6：全量验证

### Task 23: 全量验证（self-test + tsc + 现有 demo 回归）

**Files:** 无（仅运行验证命令）

- [ ] **Step 1: TypeScript strict 编译检查（0 errors）**

Run: `cd w-model-dev-demo && npx tsc --noEmit --strict`
Expected: 0 errors

- [ ] **Step 2: self-test 全量通过（77 条用例）**

Run: `npx tsx w-model-dev/scripts/self-test.ts`
Expected: `总计 77 条用例：77 通过，0 失败`，退出码 0

- [ ] **Step 3: vitest 单元测试全量通过**

Run: `cd w-model-dev-demo && npx vitest run`
Expected: 全部 PASS（含 root-cause-logic / run-log-logic / budget-logic 新增用例）

- [ ] **Step 4: 现有 demo 回归测试通过**

Run: `cd w-model-dev-demo && npm test`
Expected: 现有测试全部 PASS（无回归）

- [ ] **Step 5: 手动验证 check-rootcause-report.ts 退出码一致性**

Run:
```powershell
# valid 样本 → 退出码 0
$p1 = Start-Process -FilePath "npx" -ArgumentList "tsx","w-model-dev/scripts/check-rootcause-report.ts","w-model-dev/scripts/samples/rootcause/valid.json" -Wait -NoNewWindow -PassThru
# bad-r1 样本 → 退出码 1
$p2 = Start-Process -FilePath "npx" -ArgumentList "tsx","w-model-dev/scripts/check-rootcause-report.ts","w-model-dev/scripts/samples/rootcause/bad-r1-missing-fields.json" -Wait -NoNewWindow -PassThru
# 不存在文件 → 退出码 2
$p3 = Start-Process -FilePath "npx" -ArgumentList "tsx","w-model-dev/scripts/check-rootcause-report.ts","nonexistent.json" -Wait -NoNewWindow -PassThru
Write-Host "valid=$($p1.ExitCode) bad=$($p2.ExitCode) missing=$($p3.ExitCode)"
```
Expected: `valid=0 bad=1 missing=2`

- [ ] **Step 6: 验证反模式 #18/#19 在 anti-patterns.md 中可检索**

Run: `Select-String -Path "w-model-dev/references/anti-patterns.md" -Pattern "#18|#19"`
Expected: 命中 #18 与 #19 两行

- [ ] **Step 7: 验证 SKILL.md 约束第 9 条存在**

Run: `Select-String -Path "w-model-dev/SKILL.md" -Pattern "返工必经根因定位"`
Expected: 命中

- [ ] **Step 8: 最终提交（若有未提交的验证修复）**

```bash
git add -A
git commit -m "chore(rootcause): 全量验证通过（self-test 77/77 + tsc 0 errors + demo 回归）"
```

- [ ] **Step 9: 输出验证报告**

汇总以下指标：
- TypeScript strict: 0 errors
- self-test: 77/77 通过（基线 66→77，+11）
- vitest: 全部 PASS
- demo 回归: 无回归
- check-rootcause-report.ts 退出码: 0/1/2 一致
- 反模式 #18/#19: 已落地
- SKILL.md 约束第 9 条: 已落地

---

## 自检（Self-Review）

### Spec 覆盖核对

| Spec 节 | 对应 Task |
|---|---|
| §0 背景 | （无需实现，仅文档） |
| §1 角色定义 | Task 12（subagent-delegation 角色表）+ Task 18（SKILL 角色表）+ Task 19（SSoT §6.4） |
| §2 返工循环时序 | Task 12（时序图）+ Task 13（workflow 流程图）+ Task 18（SKILL 返工路径） |
| §3 R 方法论框架 | Task 9（root-cause-locator.md） |
| §4 RootCauseReport Schema | Task 1-5（样本 + logic + CLI） |
| §5 分派模板与回填契约 | Task 12（subagent-delegation 分派模板） |
| §6 触发与终止条件 + 升级路径 | Task 13（workflow 回退映射）+ Task 17（operational-recovery 场景 5） |
| §7 与现有约束兼容性 | Task 11（anti-patterns）+ Task 14（data-models）+ Task 18（SKILL 约束第 9 条） |
| §8 影响面清单 | 全部 Task 覆盖（5 新建 + 17 修改） |
| §9 多角度机制 | Task 9（root-cause-locator §4）+ Task 10（persona-matrix）+ Task 8（budget R4-A）+ Task 16（agent-personas） |
| §10 验收标准 | Task 23（全量验证） |
| §11 开放问题 | 开放问题 4 已在 spec 解决（并行/串行均可）；其余 4 项为实施阶段决策，不阻塞 |

### 占位符扫描

无 TBD / TODO / "fill in details" / "similar to Task N"。所有步骤含具体代码或具体动作。

### 类型一致性

- `RootCauseReportShape` 在 Task 4（root-cause-logic.ts）定义，在 Task 3（测试）、Task 5（CLI）、Task 6（self-test）引用，字段名一致
- `RootCauseCheckResult` 在 Task 4 定义，Task 3/5/6 引用 `result.passed` / `result.reasons`，一致
- `dispatchMode` 字段在 spec §9.12 与 Task 12（R-lead 分派模板）一致
- run-log `rootcause` / `fix` 动作字段在 Task 7（run-log-logic）与 Task 14（data-models）一致

---

## 执行交接

计划已完成并保存至 `docs/superpowers/plans/2026-07-24-root-cause-locator-and-fixer-roles.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** - 每个 Task 分派独立子代理执行，Task 间审查，快速迭代
2. **Inline Execution** - 在当前会话内执行，批量执行 + 检查点审查

**请选择执行方式。**
