# drawio-skill 设计借鉴吸收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 吸收 drawio-skill 仓库 7 项设计实践（Bundled Resources 表 / JSON Schema 强约束 / 安全扫描基线 / 版本号双写 / pure-IO 分离审计 / 测试 coverage 矩阵 / toolbox 决策表），提升 w-model-dev 技能包的资源加载契约、配置强约束、安全基线、版本治理与测试可观测性。

**Architecture:**
- **借鉴点 1/4/5/7/9** 为纯文档/低风险变更（SKILL.md / AGENTS.md / references/ / __tests__/README.md）
- **借鉴点 2** 引入 ajv (draft-07) devDep + 新建 `w-model-dev/schemas/*.schema.json`（13 份）+ `schema-loader.ts` 共享校验工具 + 在 9 个 `*-logic.ts` 顶部前置 schema 校验
- **借鉴点 3** 引入 eslint-plugin-security devDeps + `.eslintrc.cjs` + `.eslintsecurity-baseline.json` 指纹豁免 + `security-scan.ts` 集成脚本 + 在 `.githooks/pre-push` 增加扫描步骤
- 全程保持 TypeScript strict 0 错误 + self-test 基线推进 + vitest 全通过 + 不破坏向后兼容

**Tech Stack:** TypeScript 5 (strict) + Node 20+ + ajv 8 + ajv-formats 3 + eslint 8 + @typescript-eslint 7 + eslint-plugin-security 3 + vitest 1 + tsx 4

---

## 文件结构

### 新建文件（Create）

| 路径 | 责任 |
|---|---|
| `w-model-dev/schemas/verifier-output.schema.json` | VerifierOutput JSON Schema (draft-07) |
| `w-model-dev/schemas/rtm.schema.json` | RTM 矩阵 schema |
| `w-model-dev/schemas/project.schema.json` | project.json schema |
| `w-model-dev/schemas/budget.schema.json` | budget.json schema |
| `w-model-dev/schemas/run-log.schema.json` | run-log.jsonl 单条记录 schema |
| `w-model-dev/schemas/maturity.schema.json` | maturity.json schema |
| `w-model-dev/schemas/checkpoint-log.schema.json` | checkpoint-log.jsonl schema |
| `w-model-dev/schemas/tla-manifest.schema.json` | tla-manifest.json schema |
| `w-model-dev/schemas/graph.schema.json` | graph.json schema |
| `w-model-dev/schemas/rootcause-report.schema.json` | RootCauseReport schema |
| `w-model-dev/schemas/hill-climbing-report.schema.json` | HarnessImprovementReport schema |
| `w-model-dev/schemas/event-ingress.schema.json` | EventIngress 单条记录 schema |
| `w-model-dev/schemas/code-tla-manifest.schema.json` | 代码-TLA+ 一致性 manifest schema |
| `w-model-dev/scripts/schema-loader.ts` | ajv 实例 + schema 加载 + 校验工具（compile once, reuse） |
| `w-model-dev/scripts/security-scan.ts` | 跑 eslint + 比对 baseline，退出码 0/1 |
| `w-model-dev/skill-metadata.json` | 版本号镜像（frontmatter 双写） |
| `w-model-dev/scripts/samples/schema/bad-additional-props.json` | 验证 additionalProperties:false 拒绝 |
| `w-model-dev/scripts/samples/schema/bad-missing-required.json` | 验证必填字段缺失拒绝 |
| `w-model-dev/scripts/samples/schema/bad-wrong-type.json` | 验证类型错误拒绝 |
| `w-model-dev/scripts/__tests__/schema-validation.test.ts` | schema 加载与拒绝用例单元测试 |
| `w-model-dev/scripts/__tests__/security-scan.test.ts` | security-scan 纯函数单元测试 |
| `w-model-dev/scripts/__tests__/skill-metadata.test.ts` | 版本号双写一致性回归测试 |
| `w-model-dev/scripts/__tests__/README.md` | 测试 coverage 矩阵（Area \| What's locked in） |
| `w-model-dev/references/toolbox.md` | 「I have X, I want Y → use Z」决策表 |
| `.eslintrc.cjs` | eslint 配置（聚焦安全规则） |
| `.eslintsecurity-baseline.json` | 已知风险指纹豁免（sha256） |
| `.eslintignore` | 排除 node_modules / dist / docs |

### 修改文件（Modify）

| 路径 | 修改内容 |
|---|---|
| `package.json` | 加 devDeps: ajv, ajv-formats, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, eslint-plugin-security, vitest；加 scripts: lint:security, schema:check |
| `tsconfig.json` | include 增 `w-model-dev/schemas/**/*`（JSON Schema 文件，仍按 json 解析） |
| `w-model-dev/scripts/verifier-logic.ts` | 顶部 import schema-loader，先 schema 校验再业务规则 |
| `w-model-dev/scripts/gate-logic.ts` | 同上（rtm.schema.json + project.schema.json） |
| `w-model-dev/scripts/graph-logic.ts` | 同上（graph.schema.json） |
| `w-model-dev/scripts/tla-logic.ts` | 同上（tla-manifest.schema.json） |
| `w-model-dev/scripts/code-tla-logic.ts` | 同上（code-tla-manifest.schema.json） |
| `w-model-dev/scripts/budget-logic.ts` | 同上（budget.schema.json） |
| `w-model-dev/scripts/run-log-logic.ts` | 同上（run-log.schema.json） |
| `w-model-dev/scripts/maturity-logic.ts` | 同上（maturity.schema.json） |
| `w-model-dev/scripts/checkpoint-logic.ts` | 同上（checkpoint-log.schema.json + run-log.schema.json） |
| `w-model-dev/scripts/root-cause-logic.ts` | 同上（rootcause-report.schema.json） |
| `w-model-dev/scripts/self-test.ts` | 加 3 条 schema 用例 + 1 条 metadata 一致性检查 |
| `w-model-dev/SKILL.md` | frontmatter 加 version / 加 Bundled Resources 章节 / 加 toolbox 链接 / 加 schema 校验约束 |
| `w-model-dev/references/data-models.md` | 增加「JSON Schema 强约束」节，列出 schemas/ 清单 |
| `w-model-dev/references/anti-patterns.md` | 新增反模式 #28：JSON 文件未通过 schema 校验放行 |
| `AGENTS.md` | §2 目录速查表加 schemas/ 行 / §3 常用命令加 lint:security + schema:check |
| `docs/skill-design-document_SSoT.md` | §3.4 同步 schemas/ 目录 + 安全基线 + 版本号双写 |
| `CHANGELOG.md` | [18.0.0] 记录本次吸收 |
| `README.md` | badges 加 schema 校验 + 安全扫描 |
| `.githooks/pre-push` | 加 security-scan 步骤 + paths 过滤（已存在，仅需在第 5 步后追加） |

---

## Task 1: 借鉴点 4 — 版本号双写 + 元数据回归

> 优先做版本号双写，后续所有改动可纳入 [18.0.0] 范畴；同时此任务最简单，作为「最小可验证切片」打通元数据回归基础。

**Files:**
- Modify: `w-model-dev/SKILL.md:1-8`（frontmatter）
- Create: `w-model-dev/skill-metadata.json`
- Create: `w-model-dev/scripts/__tests__/skill-metadata.test.ts`
- Modify: `w-model-dev/scripts/self-test.ts`（追加 1 条）

- [ ] **Step 1.1: 在 SKILL.md frontmatter 增加 version 字段**

把 `w-model-dev/SKILL.md:1-8` 的 frontmatter 改为：

```yaml
---
name: w-model-dev
version: 18.0.0
description: >-
  Use when the user explicitly invokes /wm, mentions W-model, W 模型 or W 开发模型,
  requests requirements traceability (RTM), stage gates, quality gates, or development
  and testing in parallel. When the user only asks for an end-to-end or complete
  development process without these signals, ask whether to use the W-model first.
---
```

- [ ] **Step 1.2: 新建 w-model-dev/skill-metadata.json 镜像文件**

```json
{
  "name": "w-model-dev",
  "version": "18.0.0",
  "schemaVersion": "1.0",
  "source": "w-model-dev/SKILL.md",
  "description": "W 模型开发技能版本号镜像，由 __tests__/skill-metadata.test.ts 校验与 SKILL.md frontmatter 一致",
  "updatedAt": "2026-07-27"
}
```

- [ ] **Step 1.3: 新建 __tests__/skill-metadata.test.ts 回归测试**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('frontmatter not found');
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

describe('skill-metadata 双写一致性', () => {
  it('SKILL.md frontmatter version 与 skill-metadata.json version 一致', () => {
    const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf-8');
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(parseFrontmatter(skill).version).toBe(meta.version);
  });

  it('skill-metadata.json name 与 SKILL.md frontmatter name 一致', () => {
    const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf-8');
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(parseFrontmatter(skill).name).toBe(meta.name);
  });

  it('skill-metadata.json schemaVersion 存在且为 1.0', () => {
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(meta.schemaVersion).toBe('1.0');
  });
});
```

- [ ] **Step 1.4: 在 self-test.ts 增加 metadata 一致性检查**

在 `self-test.ts` 末尾的 SAMPLES 表前增加：

```typescript
// ==================== 元数据一致性（借鉴点 4） ====================
{
  group: 'metadata',
  cases: [{
    name: 'SKILL.md frontmatter version 与 skill-metadata.json 一致',
    run: () => {
      const skill = readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf-8');
      const meta = JSON.parse(readFileSync(join(__dirname, '..', 'skill-metadata.json'), 'utf-8'));
      const m = skill.match(/^version:\s*(.+)$/m);
      if (!m) throw new Error('SKILL.md frontmatter 缺 version 字段');
      if (m[1].trim() !== meta.version) {
        throw new Error(`版本不一致: SKILL.md=${m[1].trim()}, metadata=${meta.version}`);
      }
    },
  }],
},
```

- [ ] **Step 1.5: 跑测试验证**

```bash
cd w-model-dev && npx vitest run scripts/__tests__/skill-metadata.test.ts && npm run self-test
```

预期：3 tests passed + self-test 基线 95→96 全通过。

- [ ] **Step 1.6: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json w-model-dev/scripts/__tests__/skill-metadata.test.ts w-model-dev/scripts/self-test.ts
git commit -m "feat(skill): 借鉴点4 — 版本号双写 + 元数据回归测试 (借鉴 drawio-skill)"
```

---

## Task 2: 借鉴点 2 — JSON Schema 强约束（基础设施 + VerifierOutput 试点）

> 仅先打通一条 schema（VerifierOutput），验证模式可行后再批量推 12 份。

**Files:**
- Modify: `package.json`（加 ajv / ajv-formats devDep）
- Create: `w-model-dev/schemas/verifier-output.schema.json`
- Create: `w-model-dev/scripts/schema-loader.ts`
- Modify: `w-model-dev/scripts/verifier-logic.ts`（顶部加 schema 前置校验）
- Create: `w-model-dev/scripts/samples/schema/bad-additional-props.json`、`bad-missing-required.json`、`bad-wrong-type.json`
- Create: `w-model-dev/scripts/__tests__/schema-validation.test.ts`
- Modify: `w-model-dev/scripts/self-test.ts`（加 3 条 schema 拒绝用例）

- [ ] **Step 2.1: 安装 ajv + ajv-formats**

```bash
npm install --save-dev ajv@^8.17.1 ajv-formats@^3.0.1
```

预期：`package.json` devDependencies 增加 2 项。

- [ ] **Step 2.2: 新建 w-model-dev/schemas/verifier-output.schema.json**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/verifier-output.schema.json",
  "title": "VerifierOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "meta", "subCriteria", "compositeScore", "qualityLevel", "summary", "passed"],
  "properties": {
    "schemaVersion": { "type": "string", "pattern": "^\\d+\\.\\d+$" },
    "meta": {
      "type": "object",
      "additionalProperties": false,
      "required": ["targetKind", "target", "reviewedAt", "agent", "scoringMethod", "repeatTimes", "varianceThreshold"],
      "properties": {
        "targetKind": { "enum": ["requirement", "design", "code", "test"] },
        "target": { "type": "string", "minLength": 1 },
        "reviewedAt": { "type": "string", "format": "date-time" },
        "agent": { "type": "string", "minLength": 1 },
        "scoringMethod": { "enum": ["logits", "text-parse"] },
        "repeatTimes": { "type": "integer", "minimum": 1 },
        "varianceThreshold": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "subCriteria": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "weight", "score", "rawScores", "variance", "evidence"],
        "properties": {
          "name": { "type": "string", "pattern": "^[a-z][a-z-]*$" },
          "description": { "type": "string" },
          "weight": { "type": "number", "minimum": 0, "maximum": 1 },
          "score": { "type": "number", "minimum": 0, "maximum": 1 },
          "rawScores": { "type": "array", "minItems": 1, "items": { "type": "number" } },
          "variance": { "type": "number", "minimum": 0 },
          "evidence": { "type": "string", "minLength": 1 }
        }
      }
    },
    "compositeScore": { "type": "number", "minimum": 0, "maximum": 1 },
    "qualityLevel": { "enum": ["A", "B", "C", "D"] },
    "summary": { "type": "string", "minLength": 50 },
    "passed": { "type": "boolean" },
    "reworkHints": { "type": "array", "items": { "type": "string" } },
    "ranking": {
      "type": "object",
      "additionalProperties": false,
      "required": ["algorithm", "k", "temperature", "rounds", "ordered"],
      "properties": {
        "algorithm": { "const": "PPT" },
        "k": { "type": "integer", "minimum": 1 },
        "temperature": { "type": "number", "minimum": 0 },
        "rounds": { "type": "integer", "minimum": 1 },
        "ordered": { "type": "array", "minItems": 1, "items": { "type": "string" } }
      }
    }
  }
}
```

- [ ] **Step 2.3: 新建 w-model-dev/scripts/schema-loader.ts**

```typescript
/**
 * JSON Schema 校验工具（Schema Loader）
 *
 * 借鉴 drawio-skill/styles/schema.json 设计：所有 .w-model/*.json 必须先过 schema 校验，
 * 才进入业务规则校验。schema 用 draft-07 + additionalProperties:false 防字段漂移。
 *
 * 设计：
 *   - 单例 Ajv 实例（lazy init），编译后缓存
 *   - schemas/ 目录下 *.schema.json 自动加载，按 $id 或文件名注册
 *   - 校验失败返回结构化 errors（含关键字段路径），便于 Agent 修正
 *
 * 不引入运行时依赖到分发产物：本模块 import 'ajv'，但 ajv 仅作为 devDependency，
 * 因为 scripts/ 不打入 bundle，由 tsx 直接执行；技能包分发不含 node_modules。
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMAS_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'schemas');

let ajv: Ajv | null = null;

function getAjv(): Ajv {
  if (ajv) return ajv;
  ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const f of readdirSync(SCHEMAS_DIR)) {
    if (!f.endsWith('.schema.json')) continue;
    const name = basename(f, '.schema.json');
    const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, f), 'utf-8'));
    ajv.addSchema(schema, name);
  }
  return ajv;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
  errorMessages: string[];
}

export function validateBySchema(name: string, data: unknown): SchemaValidationResult {
  const v = getAjv();
  const validate = v.getSchema(name);
  if (!validate) {
    return {
      valid: false,
      errors: null,
      errorMessages: [`schema 未注册: ${name}`],
    };
  }
  const valid = validate(data) as boolean;
  return {
    valid,
    errors: validate.errors,
    errorMessages: valid ? [] : (validate.errors ?? []).map(
      (e) => `${e.instancePath || '/'}: ${e.message ?? ''}`
    ),
  };
}
```

- [ ] **Step 2.4: 在 verifier-logic.ts 顶部增加 schema 前置校验**

修改 `verifier-logic.ts`，在 `checkVerifierOutput` 函数开头增加：

```typescript
import { validateBySchema } from './schema-loader.js';

export function checkVerifierOutput(input: unknown): {
  passed: boolean;
  // ... 既有字段保留
} {
  // === Schema 前置校验（借鉴点 2） ===
  const schemaResult = validateBySchema('verifier-output', input);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      compositeScore: 0,
      expectedCompositeScore: 0,
      // ... 既有字段填默认值
    };
  }
  // === 既有业务规则校验保持不变 ===
  // ... 原有逻辑
}
```

- [ ] **Step 2.5: 新建 3 个 schema 拒绝样本**

`w-model-dev/scripts/samples/schema/bad-additional-props.json`:
```json
{
  "schemaVersion": "1.0",
  "meta": { "targetKind": "requirement", "target": "REQ-001", "reviewedAt": "2026-07-19T00:00:00Z", "agent": "x", "scoringMethod": "logits", "repeatTimes": 3, "varianceThreshold": 0.10 },
  "subCriteria": [],
  "compositeScore": 0.9,
  "qualityLevel": "A",
  "summary": "test test test test test test test test test test test test test test",
  "passed": true,
  "unknownExtraField": "should-be-rejected"
}
```

`w-model-dev/scripts/samples/schema/bad-missing-required.json`:
```json
{
  "schemaVersion": "1.0",
  "meta": { "targetKind": "requirement" },
  "subCriteria": [],
  "compositeScore": 0.9,
  "qualityLevel": "A",
  "summary": "missing passed field test test test test test test test test test test"
}
```

`w-model-dev/scripts/samples/schema/bad-wrong-type.json`:
```json
{
  "schemaVersion": "1.0",
  "meta": { "targetKind": "requirement", "target": "REQ-001", "reviewedAt": "2026-07-19T00:00:00Z", "agent": "x", "scoringMethod": "logits", "repeatTimes": 3, "varianceThreshold": 0.10 },
  "subCriteria": [],
  "compositeScore": "0.9",
  "qualityLevel": "A",
  "summary": "test test test test test test test test test test test test test test",
  "passed": true
}
```

- [ ] **Step 2.6: 新建 __tests__/schema-validation.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBySchema } from '../schema-loader.js';

const SAMPLES = join(import.meta.dirname, '..', 'samples');

describe('JSON Schema 强约束（借鉴点 2）', () => {
  it('verifier-output.schema 拒绝 additionalProperties', () => {
    const data = JSON.parse(readFileSync(join(SAMPLES, 'schema', 'bad-additional-props.json'), 'utf-8'));
    const r = validateBySchema('verifier-output', data);
    expect(r.valid).toBe(false);
    expect(r.errorMessages.some((m) => m.includes('additional'))).toBe(true);
  });

  it('verifier-output.schema 拒绝 missing required', () => {
    const data = JSON.parse(readFileSync(join(SAMPLES, 'schema', 'bad-missing-required.json'), 'utf-8'));
    const r = validateBySchema('verifier-output', data);
    expect(r.valid).toBe(false);
    expect(r.errorMessages.some((m) => m.includes('required'))).toBe(true);
  });

  it('verifier-output.schema 拒绝 wrong type', () => {
    const data = JSON.parse(readFileSync(join(SAMPLES, 'schema', 'bad-wrong-type.json'), 'utf-8'));
    const r = validateBySchema('verifier-output', data);
    expect(r.valid).toBe(false);
    expect(r.errorMessages.some((m) => m.includes('type'))).toBe(true);
  });

  it('verifier-output.schema 接受合法 valid.json', () => {
    const data = JSON.parse(readFileSync(join(SAMPLES, 'verifier', 'valid.json'), 'utf-8'));
    const r = validateBySchema('verifier-output', data);
    expect(r.valid).toBe(true);
  });
});
```

- [ ] **Step 2.7: 在 self-test.ts 增加 3 条 schema 用例**

```typescript
// ==================== Schema 校验（借鉴点 2） ====================
{
  group: 'schema',
  cases: [
    {
      name: 'verifier-output.schema 拒绝 additionalProperties',
      file: 'schema/bad-additional-props.json',
      run: () => {
        const data = JSON.parse(readFileSync(join(SAMPLES_DIR, 'schema', 'bad-additional-props.json'), 'utf-8'));
        const r = validateBySchema('verifier-output', data);
        if (r.valid) throw new Error('应拒绝 additionalProperties');
      },
    },
    {
      name: 'verifier-output.schema 拒绝 missing required',
      file: 'schema/bad-missing-required.json',
      run: () => {
        const data = JSON.parse(readFileSync(join(SAMPLES_DIR, 'schema', 'bad-missing-required.json'), 'utf-8'));
        const r = validateBySchema('verifier-output', data);
        if (r.valid) throw new Error('应拒绝 missing required');
      },
    },
    {
      name: 'verifier-output.schema 拒绝 wrong type',
      file: 'schema/bad-wrong-type.json',
      run: () => {
        const data = JSON.parse(readFileSync(join(SAMPLES_DIR, 'schema', 'bad-wrong-type.json'), 'utf-8'));
        const r = validateBySchema('verifier-output', data);
        if (r.valid) throw new Error('应拒绝 wrong type');
      },
    },
  ],
},
```

- [ ] **Step 2.8: 跑全量回归验证**

```bash
cd w-model-dev && npx vitest run scripts/__tests__/schema-validation.test.ts
cd .. && npx tsc --noEmit -p tsconfig.json
npm run self-test
```

预期：4 schema tests passed + tsc 0 错误 + self-test 基线 96→99 全通过。

- [ ] **Step 2.9: Commit**

```bash
git add package.json package-lock.json w-model-dev/schemas/verifier-output.schema.json w-model-dev/scripts/schema-loader.ts w-model-dev/scripts/verifier-logic.ts w-model-dev/scripts/samples/schema/ w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/scripts/self-test.ts
git commit -m "feat(schema): 借鉴点2 — 引入 ajv + VerifierOutput schema 强约束 (借鉴 drawio-skill)"
```

---

## Task 3: 借鉴点 2 — 批量补齐剩余 12 份 schema

> 模式已在 Task 2 验证，本任务批量复制。每份 schema 应对齐对应 `*-logic.ts` 中已有的类型形状（不必扩字段），用 `additionalProperties:false` 防漂移。

**Files:**
- Create: 12 份 schema 文件（见下）
- Modify: 8 个 `*-logic.ts` 增加前置 schema 校验（同 Task 2.4 模式）
- Modify: `self-test.ts` 增加 12 条用例

- [ ] **Step 3.1: 编写 12 份 schema**

参考 `data-models.md` 与各 logic.ts 中的 TypeScript interface，逐份编写。文件清单：

1. `w-model-dev/schemas/rtm.schema.json` — 对齐 `gate-logic.ts` RTM 形状（REQ/NFR/CON 行 + 单元/集成/系统/验收测试字段）
2. `w-model-dev/schemas/project.schema.json` — 对齐 `gate-logic.ts` project.json 形状（currentPhase / status / 时间戳）
3. `w-model-dev/schemas/budget.schema.json` — 对齐 `budget-logic.ts` BudgetShape
4. `w-model-dev/schemas/run-log.schema.json` — 对齐 `run-log-logic.ts` RunLogEntry 形状
5. `w-model-dev/schemas/maturity.schema.json` — 对齐 `maturity-logic.ts` MaturityShape
6. `w-model-dev/schemas/checkpoint-log.schema.json` — 对齐 `checkpoint-logic.ts` 形状
7. `w-model-dev/schemas/tla-manifest.schema.json` — 对齐 `tla-logic.ts` TlaManifest 形状
8. `w-model-dev/schemas/graph.schema.json` — 对齐 `graph-logic.ts` GraphShape
9. `w-model-dev/schemas/rootcause-report.schema.json` — 对齐 `root-cause-logic.ts` RootCauseReport 形状
10. `w-model-dev/schemas/hill-climbing-report.schema.json` — 对齐 `hill-climbing-guide.md` HarnessImprovementReport
11. `w-model-dev/schemas/event-ingress.schema.json` — 对齐 `event-ingress-guide.md` EventIngress
12. `w-model-dev/schemas/code-tla-manifest.schema.json` — 对齐 `code-tla-logic.ts` CodeTlaConsistencyInput

每份 schema 必须含：
- `$schema: draft-07`
- `$id`
- `additionalProperties: false`
- 所有必填字段
- 类型枚举（如 `qualityLevel: enum [A,B,C,D]`）
- ID 格式正则（如 `pattern: "^REQ-\\d+$"`）

- [ ] **Step 3.2: 在 8 个 logic.ts 增加前置 schema 校验**

对每个文件按 Task 2.4 模式增加：

```typescript
import { validateBySchema } from './schema-loader.js';

export function checkXxx(input: unknown): XxxResult {
  const schemaResult = validateBySchema('<schema-name>', input);
  if (!schemaResult.valid) {
    return { passed: false, reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`), /* 默认值 */ };
  }
  // ... 既有业务规则
}
```

涉及文件：
- `gate-logic.ts` → 校验 `rtm` + `project` 两个 schema
- `graph-logic.ts` → `graph`
- `tla-logic.ts` → `tla-manifest`
- `code-tla-logic.ts` → `code-tla-manifest`
- `budget-logic.ts` → `budget`
- `run-log-logic.ts` → `run-log`（每行记录单独校验）
- `maturity-logic.ts` → `maturity`
- `checkpoint-logic.ts` → `checkpoint-log` + `run-log`
- `root-cause-logic.ts` → `rootcause-report`

- [ ] **Step 3.3: 跑回归验证**

```bash
cd .. && npx tsc --noEmit -p tsconfig.json
cd w-model-dev && npx vitest run
cd .. && npm run self-test
```

预期：tsc 0 错误 + vitest 全通过 + self-test 基线 99→111（+12）。

- [ ] **Step 3.4: 在 data-models.md 增加「JSON Schema 强约束」节**

在 `w-model-dev/references/data-models.md` 末尾追加：

```markdown
## JSON Schema 强约束（借鉴点 2）

所有 `.w-model/*.json` 文件在业务规则校验前必须先通过 JSON Schema (draft-07) 校验。schema 文件位于 `w-model-dev/schemas/*.schema.json`，由 `scripts/schema-loader.ts` 自动加载。

| Schema 文件 | 对应数据 | 强约束规则 |
|---|---|---|
| verifier-output.schema.json | V 子代理产出 | additionalProperties:false + 4 targetKind 枚举 + summary ≥ 50 字符 |
| rtm.schema.json | .w-model/rtm.json | REQ/NFR/CON 行字段必填 + ID 正则 |
| ... |

违反 schema 的 JSON 输入将被各 `check-*.ts` 在 logic 层前置拒绝，退出码 1，reasons 含 `[schema]` 前缀。
```

- [ ] **Step 3.5: 在 anti-patterns.md 新增反模式 #28**

```markdown
### #28 JSON 文件未通过 schema 校验放行

**症状**：JSON 输入未先过 schema 校验直接进入业务规则层，导致字段漂移（多余字段未拒绝）或类型错误（字符串数字混用）未拦截。

**检测信号**：check-*.ts reasons 不含 `[schema]` 前缀却放行；schema-loader 报错被吞。

**回退动作**：回到当前阶段起点，强制先跑 schema 校验。

**防御措施**：所有 `*-logic.ts` 顶部必须 `import { validateBySchema }` 并前置校验；新增 schema 文件后必须在 self-test.ts 增加对应拒绝用例。
```

- [ ] **Step 3.6: Commit**

```bash
git add w-model-dev/schemas/ w-model-dev/scripts/*.ts w-model-dev/references/data-models.md w-model-dev/references/anti-patterns.md w-model-dev/scripts/self-test.ts
git commit -m "feat(schema): 借鉴点2 — 补齐 12 份 schema + 反模式 #28 (借鉴 drawio-skill)"
```

---

## Task 4: 借鉴点 3 — skillspector-baseline 安全扫描基线

**Files:**
- Modify: `package.json`（加 4 个 eslint devDeps）
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`
- Create: `.eslintsecurity-baseline.json`
- Create: `w-model-dev/scripts/security-scan.ts`
- Create: `w-model-dev/scripts/__tests__/security-scan.test.ts`
- Modify: `.githooks/pre-push`（在最后追加 security-scan 步骤）

- [ ] **Step 4.1: 安装 eslint + 插件**

```bash
npm install --save-dev \
  eslint@^8.57.0 \
  @typescript-eslint/parser@^7.18.0 \
  @typescript-eslint/eslint-plugin@^7.18.0 \
  eslint-plugin-security@^3.0.1
```

- [ ] **Step 4.2: 新建 .eslintrc.cjs**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
  ],
  rules: {
    // 安全规则强化
    'security/detect-object-injection': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    // TypeScript 严格性补充
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', 'w-model-dev-demo/', 'docs/'],
};
```

- [ ] **Step 4.3: 新建 .eslintignore**

```
node_modules/
dist/
coverage/
w-model-dev-demo/
docs/
*.md
package-lock.json
```

- [ ] **Step 4.4: 跑 eslint 生成初始发现，写入 baseline**

```bash
npx eslint w-model-dev/scripts/ --format json > .eslintsecurity-report.json
```

写一个一次性 Node 脚本（不入库）生成 baseline：

```javascript
// scripts/gen-baseline.mjs（一次性运行后删除）
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const r = JSON.parse(readFileSync('.eslintsecurity-report.json', 'utf-8'));
const baseline = [];
for (const f of r) {
  for (const m of f.messages) {
    const fp = `${f.filePath}:${m.line}:${m.column}:${m.ruleId}`;
    const hash = createHash('sha256').update(fp).digest('hex');
    baseline.push({ hash, rule_id: m.ruleId, file: f.filePath, line: m.line, reason: 'Accepted finding (auto-generated baseline)' });
  }
}
writeFileSync('.eslintsecurity-baseline.json', JSON.stringify(baseline, null, 2));
```

```bash
node scripts/gen-baseline.mjs && rm scripts/gen-baseline.mjs .eslintsecurity-report.json
```

- [ ] **Step 4.5: 新建 w-model-dev/scripts/security-scan.ts**

```typescript
#!/usr/bin/env tsx
/**
 * 安全扫描集成脚本（Security Scan）
 *
 * 借鉴 drawio-skill/.skillspector-baseline.json 设计：
 *   - 跑 eslint + eslint-plugin-security 扫描 w-model-dev/scripts/
 *   - 已知风险用 .eslintsecurity-baseline.json sha256 指纹豁免
 *   - 新增同规则不同位置的发现才失败
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/security-scan.ts
 *
 * 退出码：
 *   0  无新增风险（baseline 覆盖全部发现）
 *   1  有新增风险（需更新 baseline 或修复代码）
 *   2  输入错误（eslint 不可用 / baseline 文件损坏）
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';

interface EslintMessage {
  line: number;
  column: number;
  ruleId: string | null;
  message: string;
}
interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

interface BaselineEntry {
  hash: string;
  rule_id: string;
  file: string;
  line: number;
  reason: string;
}

const BASELINE_PATH = path.resolve(process.cwd(), '.eslintsecurity-baseline.json');

function fingerprint(file: string, line: number, column: number, ruleId: string): string {
  return createHash('sha256').update(`${file}:${line}:${column}:${ruleId}`).digest('hex');
}

export function diffFindings(
  findings: EslintResult[],
  baseline: BaselineEntry[]
): { newFindings: BaselineEntry[]; baselineHits: number } {
  const baselineHashes = new Set(baseline.map((b) => b.hash));
  const newFindings: BaselineEntry[] = [];
  let hits = 0;
  for (const f of findings) {
    for (const m of f.messages) {
      if (!m.ruleId) continue;
      const h = fingerprint(f.filePath, m.line, m.column, m.ruleId);
      if (baselineHashes.has(h)) {
        hits++;
      } else {
        newFindings.push({
          hash: h,
          rule_id: m.ruleId,
          file: f.filePath,
          line: m.line,
          reason: 'New finding not in baseline',
        });
      }
    }
  }
  return { newFindings, baselineHits };
}

async function main(): Promise<void> {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`✗ baseline 文件不存在: ${BASELINE_PATH}`);
    process.exit(2);
  }
  const baseline: BaselineEntry[] = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));

  const r = spawnSync('npx', ['eslint', 'w-model-dev/scripts/', '--format', 'json'], {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0 && !r.stdout) {
    console.error(`✗ eslint 执行失败: ${r.stderr}`);
    process.exit(2);
  }
  const findings: EslintResult[] = JSON.parse(r.stdout || '[]');
  const { newFindings, baselineHits } = diffFindings(findings, baseline);

  console.log('═'.repeat(60));
  console.log('Security Scan（借鉴 drawio-skill skillspector-baseline）');
  console.log('═'.repeat(60));
  console.log(`baseline 指纹数 : ${baseline.length}`);
  console.log(`已豁免发现数   : ${baselineHits}`);
  console.log(`新增发现数     : ${newFindings.length}`);
  if (newFindings.length > 0) {
    console.log('\n新增风险详情：');
    for (const n of newFindings) {
      console.log(`  [${n.rule_id}] ${n.file}:${n.line} (${n.hash.slice(0, 8)})`);
    }
    console.log('\n修复方案：');
    console.log('  1. 修复代码消除风险');
    console.log('  2. 或把新发现指纹追加到 .eslintsecurity-baseline.json 豁免');
    process.exit(1);
  }
  console.log('\n✓ 无新增安全风险');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
```

- [ ] **Step 4.6: 新建 __tests__/security-scan.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { diffFindings } from '../security-scan.js';
import type { EslintResult, BaselineEntry } from '../security-scan.js';

describe('security-scan diffFindings（借鉴点 3）', () => {
  it('baseline 内的发现被豁免', () => {
    const findings: EslintResult[] = [{
      filePath: 'w-model-dev/scripts/x.ts',
      messages: [{ line: 10, column: 5, ruleId: 'security/detect-eval-with-expression', message: 'eval' }],
    }];
    const baseline: BaselineEntry[] = [{
      hash: 'mock-hash', rule_id: 'security/detect-eval-with-expression',
      file: 'w-model-dev/scripts/x.ts', line: 10, reason: 'Accepted',
    }];
    // 用真实 fingerprint
    const { createHash } = require('node:crypto');
    baseline[0].hash = createHash('sha256').update('w-model-dev/scripts/x.ts:10:5:security/detect-eval-with-expression').digest('hex');
    const r = diffFindings(findings, baseline);
    expect(r.newFindings).toHaveLength(0);
    expect(r.baselineHits).toBe(1);
  });

  it('baseline 外的新发现被识别', () => {
    const findings: EslintResult[] = [{
      filePath: 'w-model-dev/scripts/y.ts',
      messages: [{ line: 20, column: 3, ruleId: 'security/detect-non-literal-regexp', message: 'regex' }],
    }];
    const baseline: BaselineEntry[] = [];
    const r = diffFindings(findings, baseline);
    expect(r.newFindings).toHaveLength(1);
    expect(r.newFindings[0].rule_id).toBe('security/detect-non-literal-regexp');
  });
});
```

- [ ] **Step 4.7: 在 .githooks/pre-push 增加第 6 项检查**

在 `pre-push` 文件的 `# 5. check:verifier 对无效样本应退出 1` 块后追加：

```bash
# 6. security-scan：跑 eslint-plugin-security + baseline 比对，必须 exit 0
run_expect "security-scan 无新增风险" 0 \
  npx tsx w-model-dev/scripts/security-scan.ts || exit 1
```

- [ ] **Step 4.8: 在 package.json 增加 scripts**

```json
"scripts": {
  "lint:security": "tsx w-model-dev/scripts/security-scan.ts",
  ...
}
```

- [ ] **Step 4.9: 跑全量回归**

```bash
npx tsc --noEmit -p tsconfig.json
cd w-model-dev && npx vitest run scripts/__tests__/security-scan.test.ts
cd .. && npm run self-test
npm run lint:security
npm run prepush
```

预期：tsc 0 错误 + 2 security tests passed + self-test 全通过 + security-scan exit 0 + prepush 6 项全过。

- [ ] **Step 4.10: Commit**

```bash
git add package.json package-lock.json .eslintrc.cjs .eslintignore .eslintsecurity-baseline.json w-model-dev/scripts/security-scan.ts w-model-dev/scripts/__tests__/security-scan.test.ts .githooks/pre-push
git commit -m "feat(security): 借鉴点3 — 引入 eslint-plugin-security + baseline 指纹豁免 (借鉴 drawio-skill)"
```

---

## Task 5: 借鉴点 5 — pure/IO 函数分离审计

**Files:**
- Modify: `w-model-dev/scripts/__tests__/README.md`（也含本借鉴点的边界声明）
- Modify: 任意 `*-logic.ts` 若发现 IO 混入则抽取到对应 `check-*.ts`

- [ ] **Step 5.1: 审计所有 *-logic.ts 的 IO 调用**

```bash
cd w-model-dev/scripts && grep -nE "from 'node:fs'|from 'node:child_process'|from 'node:path'|process\.(exit|argv|env|stdout|stderr)" *-logic.ts
```

预期：纯 logic 文件应**无任何输出**。如果有命中，记录到审计清单。

- [ ] **Step 5.2: 抽取命中的 IO 到对应 check-*.ts**

对每个命中的 logic.ts，把 IO 调用改为参数传入（`fs.readFile` → 接受 `string` 内容；`process.exit` → `throw`）。在 `check-*.ts` 入口做 IO 后传给 logic。

参考 drawio-skill `prdiff.py` 的 `render_markdown` vs `build_entry` 分离模式。

- [ ] **Step 5.3: 跑全量回归验证抽取未破坏**

```bash
npx tsc --noEmit -p tsconfig.json
cd w-model-dev && npx vitest run
cd .. && npm run self-test
```

预期：tsc 0 错误 + vitest 全通过 + self-test 全通过。

- [ ] **Step 5.4: 在 __tests__/README.md（Task 7 创建）增加 pure/IO 边界声明**

在 coverage 矩阵末尾增加：

```markdown
## pure/IO 函数边界（借鉴点 5）

所有 `*-logic.ts` 必须保持纯函数：
- 不 import `node:fs` / `node:child_process` / `node:path`
- 不调用 `process.exit` / `process.argv` / `process.env` / `process.stdout` / `process.stderr`
- 不修改外部状态

IO 调用必须在 `check-*.ts` 入口层完成，传纯数据给 logic 层。

违反检测：`grep -nE "from 'node:fs'|from 'node:child_process'|process\.(exit|argv|env|stdout|stderr)" *-logic.ts` 应无输出。
```

- [ ] **Step 5.5: Commit**

```bash
git add w-model-dev/scripts/ w-model-dev/scripts/__tests__/README.md
git commit -m "refactor(scripts): 借鉴点5 — pure/IO 函数分离审计与抽取 (借鉴 drawio-skill)"
```

---

## Task 6: 借鉴点 1 — Bundled Resources 触发条件总表

**Files:**
- Modify: `w-model-dev/SKILL.md`（在「阶段路由」后增加「Bundled Resources」章节）
- Modify: `AGENTS.md`（§2 目录速查加链接）
- Modify: `w-model-dev/references/anti-patterns.md`（#5 强化）

- [ ] **Step 6.1: 在 SKILL.md 增加 Bundled Resources 章节**

在 SKILL.md「阶段路由」表后（约第 158 行后）插入：

```markdown
## Bundled Resources（按需加载契约）

> 借鉴 drawio-skill/skills/drawio-skill/SKILL.md 的 Bundled Resources 设计：明示每个 reference/script/subagent/template 的触发条件，**none of them need to be in context up front**。约束 #6「按需加载」的可执行清单。

### references/（按需读取）

| File | Read it when |
|---|---|
| phase-1-requirements.md | 用户进入阶段 1（需求分析） |
| phase-2-system-design.md | 阶段 2 系统设计 |
| phase-3-outline-design.md | 阶段 3 概要设计 |
| phase-4-detailed-design.md | 阶段 4 详细设计 |
| phase-5-coding.md | 阶段 5 编码 |
| phase-6-integration-test.md | 阶段 6 集成测试 |
| phase-7-system-test.md | 阶段 7 系统测试 |
| phase-8-acceptance-test.md | 阶段 8 验收测试 |
| rtm-guide.md | 任何阶段更新 RTM 时 |
| verifier-spec.md | V 子代理产出 VerifierOutput 前 |
| agent-personas.md | V 子代理选用 Persona 时 |
| subagent-delegation.md | O 分派 S/V/G/R 子代理前 |
| subagent-persona-matrix.md | R-lead / V-lead 多角度分析时 |
| root-cause-locator.md | V/G 不通过后分派 R 子代理时 |
| definition-of-done.md | 阶段门放行判定时 |
| data-models.md | 读写 .w-model/*.json 或 schema 校验失败时 |
| anti-patterns.md | 怀疑命中反模式或新增反模式登记时 |
| command-reference.md | /wm 命令参数细节 |
| workflow.md | 阶段切换 / 失败回退 / 质量门流程 |
| quality-standards.md | 编码后质量检查 |
| operational-recovery.md | 异常 / 跨平台 / 技术栈切换 / 大项目 / 简化行为自检 |
| tla-plus-guide.md | 阶段 1–4 产出 TLA+ 规格时 |
| tla-plus-patterns-examples.md | TLA+ 模式参考 |
| tla-plus-review-checklist.md | TLA+ 规格自审 |
| tla-plus-syntax-reference.md | TLA+ 语法查询 |
| tla-plus-tlc-configuration.md | TLC 配置 |
| graph-guide.md | 图谱门禁与收敛 |
| ingestion-chunk.md | A 子代理分块分析 |
| ingestion-cross.md | A 子代理交叉合并 |
| event-ingress-guide.md | L2+ 项目事件接驳 |
| hill-climbing-guide.md | L2+ 项目爬坡循环 |
| skillopt-adoption.md | SkillOpt 方法论吸收 |
| external-skills-absorption.md | 第 10 轮外部技能吸收 |
| toolbox.md | 「I have X, I want Y → use Z」决策表 |

### scripts/（按需读取，仅供 G 子代理执行）

| File | Read it when |
|---|---|
| check-verifier-output.ts | V 产出 JSON 后 G 校验 |
| check-artifact-gate.ts | 阶段 8 终检 / 阶段 5/6/7 阶段级校验 |
| check-requirement-graph.ts | 阶段 1–4 图谱门禁 |
| check-tla-model.ts | 阶段 1–4 TLA+ 行为门禁 |
| check-code-tla-consistency.ts | 阶段 5 代码-TLA+ 一致性回归 |
| check-budget.ts | 阶段门放行前 |
| check-run-log.ts | 阶段门放行前 |
| check-maturity.ts | 阶段门放行前 |
| check-checkpoint.ts | 阶段门放行前 |
| check-rootcause-report.ts | R 子代理产出后 |
| schema-loader.ts | logic 层 schema 校验（被自动 import） |
| security-scan.ts | pre-push / 手动安全扫描 |
| self-test.ts | 回归基线（非阶段流程） |
| plan-chunks.ts | ingestion 子流程分块（O 只读） |

### subagent/（按需读取，仅供 V-lead / R-lead 多角度分析）

| File | Read it when |
|---|---|
| engineering-code-reviewer.md | V 评审 code 阶段 |
| engineering-backend-architect.md | V 评审 design 阶段（后端） |
| engineering-software-architect.md | V 评审 system design |
| testing-api-tester.md | V 评审 test 阶段（API） |
| testing-reality-checker.md | V reality check |
| ... | 完整清单见 [references/subagent-persona-matrix.md](references/subagent-persona-matrix.md) |

### templates/（产出时按需读取）

| File | Read it when |
|---|---|
| requirement-spec.md | 阶段 1 产出需求规格 |
| system-design.md | 阶段 2 产出系统设计 |
| detailed-design.md | 阶段 4 产出详细设计 |
| interface-design.md | 阶段 4 产出接口设计 |
| test-case.md | 任何阶段产出测试用例 |
| test-report.md | 阶段 6/7/8 产出测试报告 |
| rtm.md | RTM 维护 |
| review-report.md | V 产出评审报告 |
| tla-spec-template.md | 阶段 1–4 产出 TLA+ 规格 |
```

- [ ] **Step 6.2: 在快速自检清单增加一条**

在 SKILL.md「快速自检」末尾增加：

```markdown
- [ ] **Bundled Resources 按需加载**（第 18 轮 P1，借鉴 drawio-skill）：会话内已加载的文件清单与「Bundled Resources」表对照，未加载无关文件（约束 #6 可执行化）
```

- [ ] **Step 6.3: 在 anti-patterns.md #5 强化描述**

把 #5「按需加载」改为：

```markdown
**反模式 #5（强化）**：违反 Bundled Resources 表 — 一次性加载整个 references/ 或无关阶段的 phase 文件。Bundled Resources 表（见 SKILL.md）是按需加载的可执行清单，违反即回退。
```

- [ ] **Step 6.4: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/anti-patterns.md
git commit -m "docs(skill): 借鉴点1 — Bundled Resources 触发条件总表 (借鉴 drawio-skill)"
```

---

## Task 7: 借鉴点 9 — 「I have X, I want Y → use Z」决策表

**Files:**
- Create: `w-model-dev/references/toolbox.md`

- [ ] **Step 7.1: 新建 w-model-dev/references/toolbox.md**

```markdown
# Toolbox 决策表（借鉴 drawio-skill/references/toolbox.md）

> 「I have X, I want Y → use Z」决策表，覆盖 w-model-dev/scripts/ 与 subagent/ 的路由。
> 与 SKILL.md「阶段路由」互补：阶段路由按开发阶段组织，本表按用户意图组织。

## scripts 决策表

| I have | I want | Use |
|---|---|---|
| V 子代理产出 VerifierOutput JSON | 校验防漂移 | `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>` |
| RTM + project.json | 阶段 8 终检工件门 | `npx tsx w-model-dev/scripts/check-artifact-gate.ts <project-dir>` |
| RTM | 阶段 5/6/7 阶段级校验 | `check-artifact-gate.ts --phase=5\|6\|7 <project-dir>` |
| graph.json（阶段 1–4 ingestion） | 图谱结构 + 信息流门禁 | `npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=N]` |
| tla-manifest.json | TLA+ 行为门禁（SANY + TLC） | `npx tsx w-model-dev/scripts/check-tla-model.ts <manifest.json> [--phase=N]` |
| tla-manifest + graph + rtm + src/ | 阶段 5 代码-TLA+ 一致性回归 | `npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=... --graph=... --rtm=... --src=...` |
| budget.json | 预算超限检查 | `npx tsx w-model-dev/scripts/check-budget.ts <budget.json> [--project=] [--run-log=] [--phase=N]` |
| run-log.jsonl | 运行日志完整性检查 | `npx tsx w-model-dev/scripts/check-run-log.ts <run-log.jsonl> [--gate-logs=] [--tla-manifest=]` |
| maturity.json | 成熟度等级检查 | `npx tsx w-model-dev/scripts/check-maturity.ts <maturity.json> [--project=] [--run-log=]` |
| run-log.jsonl（含 CHECKPOINT） | 决策内容具体性检查 | `npx tsx w-model-dev/scripts/check-checkpoint.ts <run-log.jsonl> [--checkpoint-log=]` |
| RootCauseReport.json | 根因报告 schema 校验 | `npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>` |
| 任意 .w-model/*.json | schema 强约束校验（被 logic 层自动调用，无需手动） | `schema-loader.ts` 内置 |
| scripts 改动 | 推送前安全扫描 | `npm run lint:security` 或 `npx tsx w-model-dev/scripts/security-scan.ts` |
| scripts 改动 | 回归基线 | `npm run self-test` |
| ingestion 阶段 | 分块计划 | `npx tsx w-model-dev/scripts/plan-chunks.ts`（O 只读 stdout） |

## subagent 决策表

完整 persona 矩阵见 [subagent-persona-matrix.md](subagent-persona-matrix.md)，下表为常用入口：

| I have | I want | Use persona |
|---|---|---|
| 阶段 5 代码评审 | code 视角多角度 | engineering-code-reviewer + engineering-backend-architect |
| 阶段 2 系统设计评审 | 架构视角 | engineering-software-architect + engineering-backend-architect |
| 阶段 6/7 测试评审 | 测试视角 | testing-api-tester + testing-test-results-analyzer |
| 性能验证 | 性能视角 | testing-performance-benchmarker |
| 安全验证 | 安全视角 | engineering-threat-detection-engineer |
| V/G 不通过 | 根因定位 | R-lead 按 subagent-persona-matrix 选用 |
| 评审结果需要质疑 | reality check | testing-reality-checker |
| 工具选型评估 | 工具视角 | testing-tool-evaluator |

## 命令速查（与 SKILL.md 互补）

详见 [command-reference.md](command-reference.md)。
```

- [ ] **Step 7.2: 在 SKILL.md Bundled Resources 章节链接 toolbox.md**

已在 Task 6.1 的 references 表中包含 `toolbox.md` 行。

- [ ] **Step 7.3: Commit**

```bash
git add w-model-dev/references/toolbox.md
git commit -m "docs(ref): 借鉴点9 — toolbox 决策表 (借鉴 drawio-skill)"
```

---

## Task 8: 借鉴点 7 — 文档 coverage 矩阵

**Files:**
- Create: `w-model-dev/scripts/__tests__/README.md`

- [ ] **Step 8.1: 新建 __tests__/README.md**

```markdown
# 测试 Coverage 矩阵

> 借鉴 drawio-skill/tests/README.md 的「Area | What's locked in」表设计：明示每个 test 文件覆盖的 R 规则，便于回归与新增校验项时定位。

## 测试文件清单

| File | Area | What's locked in |
|---|---|---|
| verifier-logic.test.ts | Verifier | subCriteria 权重 / rawScores 方差 / compositeScore 重算 / targetKind 枚举 |
| budget-logic.test.ts | Budget | R1 时效性 / R2 schema / R3 onExceed / R4 killSwitch / R5 触发检测 |
| code-tla-logic.test.ts | Code-TLA+ | SD→codeModule 映射 / 状态转移 / Next 分支 / 不变式覆盖 |
| gate-enhancement.test.ts | Gate | basePath 强制 / SD 覆盖率 / passed↔qualityLevel / phase 三段语义 |
| root-cause-logic.test.ts | RootCause | R1 schema / R2 链长 / R3 可证伪 / R4 修复建议 / R5 预防 / R6 上游 / R7 质量 / R8 报告 ID / R9 多角度 / R10 reality |
| run-log-logic.test.ts | RunLog | R1 完整性 / R2 tokens / R3 返工 / R4 决策 / R5 O越权 / R6 exitCode / R7 时序 |
| tla-logic.test.ts | TLA+ | 文件头 / 层次 / 拆解 / SANY / TLC / R13 checkRounds schema |
| schema-validation.test.ts | Schema | additionalProperties 拒绝 / missing required 拒绝 / wrong type 拒绝 / 合法样本接受 |
| security-scan.test.ts | Security | baseline 命中豁免 / 新增发现识别 / sha256 指纹稳定性 |
| skill-metadata.test.ts | Metadata | frontmatter version 与 metadata.json 一致 / name 一致 / schemaVersion 存在 |

## pure/IO 函数边界（借鉴点 5）

所有 `*-logic.ts` 必须保持纯函数：
- 不 import `node:fs` / `node:child_process` / `node:path`
- 不调用 `process.exit` / `process.argv` / `process.env` / `process.stdout` / `process.stderr`
- 不修改外部状态

IO 调用必须在 `check-*.ts` 入口层完成，传纯数据给 logic 层。

违反检测：

\`\`\`bash
cd w-model-dev/scripts && grep -nE "from 'node:fs'|from 'node:child_process'|process\.(exit|argv|env|stdout|stderr)" *-logic.ts
\`\`\`

应无输出。

## 新增测试时

1. 在本表追加 `File | Area | What's locked in` 行
2. 在 `self-test.ts` 同步追加样本用例（若涉及 logic 层）
3. 必要时在 `samples/<area>/` 增加 `bad-*.json` 反例
```

- [ ] **Step 8.2: Commit**

```bash
git add w-model-dev/scripts/__tests__/README.md
git commit -m "docs(test): 借鉴点7 — 测试 coverage 矩阵 + pure/IO 边界声明 (借鉴 drawio-skill)"
```

---

## Task 9: 顶层文档同步 + 全量回归

**Files:**
- Modify: `AGENTS.md`（§2/§3）
- Modify: `docs/skill-design-document_SSoT.md`（§3.4）
- Modify: `CHANGELOG.md`（[18.0.0]）
- Modify: `README.md`（badges）

- [ ] **Step 9.1: 在 AGENTS.md §2 目录速查表加 schemas/ 行**

```markdown
| `w-model-dev/schemas/` | JSON Schema (draft-07) 文件（13 份） | logic 层 schema 校验时自动加载；新增 .w-model/*.json 字段必先改 schema |
```

- [ ] **Step 9.2: 在 AGENTS.md §3 常用命令增加 lint:security + schema:check**

```bash
npm run lint:security              # 跑 eslint-plugin-security + baseline 比对，退出码 0/1
# schema 校验由 logic 层自动调用，无需独立命令
```

- [ ] **Step 9.3: 在 SSoT §3.4 同步**

在 SSoT §3.4 适当位置增加 §3.4.13：

```markdown
### §3.4.13 drawio-skill 设计吸收（第 18 轮）

吸收 drawio-skill (https://github.com/Agents365-ai/drawio-skill) 7 项设计实践：

1. **Bundled Resources 触发条件总表**：SKILL.md 新增章节，明示 references/scripts/subagent/templates 每文件的触发条件（约束 #6 可执行化）
2. **JSON Schema 强约束**：引入 ajv (draft-07) + 13 份 schemas/*.schema.json，所有 .w-model/*.json 在 logic 层前置 schema 校验，反模式 #28
3. **skillspector-baseline 安全扫描**：引入 eslint-plugin-security + .eslintsecurity-baseline.json sha256 指纹豁免，pre-push 强制
4. **版本号双写**：SKILL.md frontmatter `version` + skill-metadata.json 镜像，__tests__/skill-metadata.test.ts 回归
5. **pure/IO 函数分离**：*-logic.ts 纯函数审计，IO 抽到 check-*.ts
7. **测试 coverage 矩阵**：__tests__/README.md 用 Area | What's locked in 表
9. **toolbox 决策表**：references/toolbox.md「I have X, I want Y → use Z」
```

- [ ] **Step 9.4: 在 CHANGELOG.md 增加 [18.0.0]**

```markdown
## [18.0.0] - 2026-07-27

### Added
- 借鉴 drawio-skill 7 项设计实践（详见 SSoT §3.4.13）
- 引入 ajv (draft-07) + 13 份 JSON Schema 强约束 .w-model/*.json
- 引入 eslint-plugin-security + .eslintsecurity-baseline.json 安全扫描基线
- 新增 w-model-dev/schemas/ 目录
- 新增 w-model-dev/scripts/schema-loader.ts / security-scan.ts
- 新增 w-model-dev/skill-metadata.json 版本号镜像
- 新增 w-model-dev/references/toolbox.md 决策表
- 新增 w-model-dev/scripts/__tests__/README.md coverage 矩阵
- 新增反模式 #28：JSON 文件未通过 schema 校验放行

### Changed
- SKILL.md frontmatter 加 version 字段 + 新增 Bundled Resources 章节
- 9 个 *-logic.ts 顶部增加 schema 前置校验
- .githooks/pre-push 增加 security-scan 步骤（6 项门禁）
- self-test 基线 95→111+（+3 schema + 1 metadata + 12 schema 推广）

### Tests
- vitest +4 文件（schema-validation / security-scan / skill-metadata + pure/IO 审计）
- tsc strict 0 错误
```

- [ ] **Step 9.5: 在 README.md 增加 badges**

```markdown
[![JSON Schema](https://img.shields.io/badge/JSON%20Schema-draft--07-blue)](w-model-dev/schemas/)
[![Security Scan](https://img.shields.io/badge/Security-eslint--plugin--security-green)](.eslintrc.cjs)
```

- [ ] **Step 9.6: 全量回归验证**

```bash
npx tsc --noEmit -p tsconfig.json
cd w-model-dev && npx vitest run
cd .. && npm run self-test
npm run lint:security
npm run prepush
```

预期：
- tsc 0 错误
- vitest 全通过（新增 schema-validation / security-scan / skill-metadata 3 个文件）
- self-test 全通过（基线 95→111+）
- security-scan exit 0
- prepush 6 项全过

- [ ] **Step 9.7: 最终 Commit**

```bash
git add AGENTS.md docs/skill-design-document_SSoT.md CHANGELOG.md README.md
git commit -m "docs: 第18轮 drawio-skill 吸收 — SSoT/AGENTS/CHANGELOG/README 同步 [18.0.0]"
```

---

## Self-Review

### Spec coverage
- 借鉴点 1（Bundled Resources）→ Task 6 ✓
- 借鉴点 2（JSON Schema）→ Task 2 + Task 3 ✓
- 借鉴点 3（security baseline）→ Task 4 ✓
- 借鉴点 4（version 双写）→ Task 1 ✓
- 借鉴点 5（pure/IO）→ Task 5 ✓
- 借鉴点 7（coverage 矩阵）→ Task 8 ✓
- 借鉴点 9（toolbox）→ Task 7 ✓
- 顶层同步 → Task 9 ✓

### Placeholder scan
- Task 3 的 12 份 schema 用「对齐 *-logic.ts 类型形状」描述而非完整代码 — 这是合理的（每份 schema 需 100+ 行，全文会超出 plan 可读性，执行者按 Task 2 已建立的模板复制即可）
- Task 5 的「抽取命中的 IO」未列具体代码 — 这是审计型任务，依赖审计结果决定抽取内容
- 其余步骤均含完整代码块

### Type consistency
- `SchemaValidationResult` 在 schema-loader.ts 与所有引用点一致
- `BaselineEntry` 在 security-scan.ts 与测试一致
- `validateBySchema(name, data)` 签名一致

### 风险与缓解
1. **ajv 引入 devDep 后**：tsx 执行时需 node_modules，分发时需提醒（已在 schema-loader.ts 注释说明）
2. **eslint baseline 生成**：需运行一次生成初始 baseline，可能含若干 security 警告（如 detect-object-injection），全部进 baseline 豁免
3. **Task 3 schema 推广**：12 份 schema 推广后可能暴露现有 samples 的 schema 不一致（如 samples/tla/valid.json 字段），需逐一修复
4. **Task 5 pure/IO 审计**：可能发现 logic 层有 IO，抽取时需小心保持测试通过

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-27-drawio-skill-absorption.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
