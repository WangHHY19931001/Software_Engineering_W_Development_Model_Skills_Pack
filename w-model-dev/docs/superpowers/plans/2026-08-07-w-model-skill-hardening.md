# W 模型技能强化实施计划：目录约定 / 格式统一 / 覆盖率校验架构升级

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决调测中发现的三个问题——目录约定不一致、产出格式不一致、TLA+/BDD 多级精细化覆盖率盲区——通过建立 SSoT 文档、统一格式、引入 S-ingest 独立回填机制与全链路强制校验，使技能包在多子系统场景下不再出现"只做一个子系统"的漏检。

**Architecture:** 三层加固——① SSoT 层（directory-conventions.md + format-conventions.md）集中路径与格式约定；② Schema + 逻辑层（manifest schema 强制 sdCoverage/designCoverage 字段 + 纯逻辑校验 uncoveredSdNodes）；③ CLI + 分派层（check-tla-model/check-bdd-model --graph 强制 + 终检调用 + G 模板强制 + S-ingest 独立回填）。允许不兼容历史数据，重新产生 demo。

**Tech Stack:** TypeScript 5 (tsx 运行时), JSON Schema draft-07, Vitest, Markdown 模板/文档。

**Spec:** [2026-08-07-w-model-skill-hardening-design.md](../specs/2026-08-07-w-model-skill-hardening-design.md)

---

## 文件结构总览

| 改动类型 | 文件 | 职责 |
|----------|------|------|
| 新建 SSoT | `references/directory-conventions.md` | 所有路径约定的唯一事实来源 |
| 新建 SSoT | `references/format-conventions.md` | 所有元数据字段格式的唯一事实来源 |
| Schema 变更 | `schemas/tla-manifest.schema.json` | 新增 sdCoverage 必填字段（phase≥2） |
| Schema 变更 | `schemas/bdd-manifest.schema.json` | 新增 designCoverage 必填字段（phase≥2） |
| 纯逻辑升级 | `scripts/tla-logic.ts` | checkCoverage 升级为返回 sdCoverage 结构 + 校验 uncoveredSdNodes |
| 纯逻辑升级 | `scripts/bdd-logic.ts` | 新增 D8 SD Coverage 维度 + designCoverage 校验 |
| CLI 升级 | `scripts/check-tla-model.ts` | --graph phase≥2 强制 + sdCoverage 校验 |
| CLI 升级 | `scripts/check-bdd-model.ts` | 新增 --graph 参数 + D8 校验 |
| CLI 升级 | `scripts/check-artifact-gate.ts` | 终检调用 check-tla-model + check-bdd-model 并传 --graph |
| CLI 升级 | `scripts/verifier-logic.ts` | EVIDENCE_PATTERN 更新为支持冒号格式 |
| 模板升级 | `templates/tla-spec-template.md` | @designIds 头部 + :§ 格式 |
| 模板升级 | `templates/feature.template` | @designIds 头部 |
| 文档更新 | `references/phase-2-system-design.md` | 路径改为阶段子目录 |
| 文档更新 | `references/phase-3-outline-design.md` | 路径改为阶段子目录 |
| 文档更新 | `references/phase-4-detailed-design.md` | 路径改为阶段子目录 |
| 文档更新 | `references/verifier-spec.md` | §6.2 格式统一为冒号 + 引用 format-conventions.md |
| 文档更新 | `references/tla-plus-guide.md` | --graph phase≥2 强制 + @designIds |
| 文档更新 | `references/bdd-guide.md` | D8 SD Coverage 维度 + @designIds |
| 分派模板 | `references/subagent-delegation.md` | S-ingest-tla/S-ingest-bdd 新增 + S-tla/S-bdd @designIds + G 模板强化 |
| 测试 | `scripts/__tests__/tla-logic.test.ts` | sdCoverage 校验测试 |
| 测试 | `scripts/__tests__/bdd-logic.test.ts` | D8 维度测试 |
| 测试样本 | `scripts/samples/tla/bad-coverage-uncovered-sd.json` | sdCoverage uncovered 非空样本 |
| 测试样本 | `scripts/samples/bdd/bad-d8-uncovered-sd.json` | D8 uncovered 非空样本 |
| Demo 重产 | `w-model-dev-demo/` | 全量重新产生（允许不兼容） |

---

## Phase A：SSoT 基础文档

### Task 1：新建 directory-conventions.md

**Files:**
- Create: `w-model-dev/references/directory-conventions.md`

- [ ] **Step 1：编写 SSoT 文档**

创建 `w-model-dev/references/directory-conventions.md`，内容如下：

```markdown
# 目录约定（Directory Conventions）

> 本文件是所有 W 模型产物路径的唯一事实来源（SSoT）。phase 文档、模板、门禁脚本、verifier-spec 均须引用本文件，不得自定义路径。
> 日期：2026-08-07
> 状态：生效中

## 1. 阶段子目录模式

所有阶段产物统一存放于 `docs/phaseN-{name}/` 子目录下，禁止平铺于 `docs/` 根目录。

| 阶段 | 目录 | 文件命名 | 模板 |
|------|------|----------|------|
| 1 需求分析 | `docs/phase1-requirements/` | `requirement-spec.md`, `acceptance-test-design.md` | `templates/requirement-spec.md` |
| 2 系统设计 | `docs/phase2-design/` | `{module}-system-design.md`, `{module}-system-test.md` | `templates/system-design.md`, `templates/test-case.md` |
| 3 概要设计 | `docs/phase3-outline/` | `{module}-outline-design.md`, `{module}-integration-test.md` | `templates/detailed-design.md`, `templates/test-case.md` |
| 4 详细设计 | `docs/phase4-detailed/` | `{module}-detailed-design.md`, `{module}-interface-design.md` | `templates/detailed-design.md`, `templates/interface-design.md` |
| 5 编码 | `src/` | 按技术栈约定 | — |
| 6 集成测试 | `docs/phase6-integration-test/` | `integration-test.md` | `templates/test-case.md` |
| 7 系统测试 | `docs/phase7-system-test/` | `system-test.md` | `templates/test-case.md` |
| 8 验收测试 | `docs/phase8-acceptance-test/` | `acceptance-test.md` | `templates/test-case.md` |

## 2. 横切文档

| 产物 | 目录 | 命名 | 强制阶段 |
|------|------|------|----------|
| UAT 路径映射 | `docs/` | `uat-path-mapping.md` | 阶段 1 产出，阶段 5/终检校验回填 |
| RTM | `.w-model/` | `rtm.json` | 阶段 1 起持续维护 |
| 项目状态 | `.w-model/` | `project.json` | 全阶段 |
| 编排状态 | `.w-model/` | `orchestrator-state.md` | 全阶段 |

## 3. TLA+ 规格目录

| 层级 | 目录 | 文件命名 |
|------|------|----------|
| L1 | `tla/specs/level1/` | `L1_{System}.tla`, `L1_{System}.cfg` |
| L2 | `tla/specs/level2/` | `L2_{System}_{Subsystem}.tla`, `L2_{System}_{Subsystem}.cfg` |
| L3 | `tla/specs/level3/` | `L3_{System}_{Subsystem}_{Atom}.tla`, 同名 `.cfg` |
| L4-L6 | `tla/specs/level{N}/` | `L{N}_{System}_..._{Atom}.tla` |

## 4. BDD features 目录

| 层级 | 目录 | 文件命名 |
|------|------|----------|
| L1 | `features/L1/` | `L1_{system}-001.feature` |
| L2 | `features/L2/` | `L2_{system}_{subsystem}-001.feature` |
| L3 | `features/L3/` | `L3_{system}_{subsystem}_{atom}-001.feature` |
| L4 | `features/L4/` | `L4_{system}_{subsystem}_{atom}_{method}-001.feature` |

## 5. .w-model 目录结构

```
.w-model/
├── project.json              # 项目元数据
├── orchestrator-state.md     # 编排状态
├── rtm.json                  # 需求追踪矩阵
├── tla-manifest.json         # TLA+ 规格清单
├── bdd-manifest.json         # BDD features 清单
├── ingestion/                # 图谱导入产物
│   ├── graph.json            # 合并后的需求/设计图谱
│   └── consolidated-phaseN.json
├── verifier-outputs/         # V 子代理产出
├── gate-logs/                # 门禁日志
└── run-log.jsonl             # 运行日志
```

## 6. 路径引用规则

所有跨文件路径引用须遵循 [format-conventions.md](format-conventions.md) 的分隔符约定。

## 7. 门禁脚本路径解析

`check-artifact-gate.ts` 内置 `resolvePhaseDoc(phase, type)` 函数从本约定解析文档路径，禁止硬编码。
```

- [ ] **Step 2：验证文件存在且内容完整**

Run: `ls -la w-model-dev/references/directory-conventions.md`
Expected: 文件存在

- [ ] **Step 3：Commit**

```bash
git add w-model-dev/references/directory-conventions.md
git commit -m "feat: 新建 directory-conventions.md 作为路径约定 SSoT"
```

---

### Task 2：新建 format-conventions.md

**Files:**
- Create: `w-model-dev/references/format-conventions.md`

- [ ] **Step 1：编写 SSoT 文档**

创建 `w-model-dev/references/format-conventions.md`，内容如下：

```markdown
# 格式约定（Format Conventions）

> 本文件是所有 W 模型元数据字段格式的唯一事实来源（SSoT）。verifier-spec、模板、门禁脚本均须引用本文件，不得自定义格式。
> 日期：2026-08-07
> 状态：生效中

## 1. 路径定位分隔符

统一使用**冒号** `:` 分隔文件路径与定位信息：

```
path:§section       （章节定位）
path:L42-58         （行号定位）
path:§3.2,L42       （章节+行号混合）
```

### 禁止格式

| 格式 | 说明 | 旧用法位置 |
|------|------|------------|
| `path#§section` | 井号分隔 | tla-spec-template.md（已废弃） |
| `path.field=value` | 点号分隔 | verifier-spec.md §6.2（已废弃） |
| 纯文件名无定位 | 无定位信息 | — |

## 2. 各字段格式规范

### 2.1 VerifierOutput evidence

格式：`path:§section=statement` 或 `path:L42=statement`

```
合法示例：
  docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全
  docs/phase2-design/blog-system-system-design.md:§3.2=模块划分 16 个
  src/auth.ts:L42-58=JWT 签发逻辑

非法示例：
  coverage.json.matrices.stakeholder.coverage=100%  （点号格式，已废弃）
  C1-C10 全通过                                       （空泛声明）
  system-design.md                                    （无定位）
```

### 2.2 TLA+ spec 头部 @design

格式：`path:§section`

```
合法示例：
  @design docs/phase2-design/blog-system-system-design.md:§3.2

非法示例：
  @design docs/system-design.md#§3.2  （井号，已废弃）
```

### 2.3 BDD feature 头部 @design

格式：同 2.2

### 2.4 RTM designDoc

格式：`path:§anchor`

```
合法示例：
  docs/phase2-design/blog-system-system-design.md:§M-001
```

### 2.5 TLA+/BDD 头部 @designIds

格式：逗号分隔的 SD 节点 ID 列表

```
@designIds     SD-001,SD-002,SD-005
```

## 3. evidence 正则

`verifier-logic.ts` 的 EVIDENCE_PATTERN 须匹配以下两种格式：

```
/^[\w/.-]+:§[\w.-]+=.+$/       （章节定位）
/^[\w/.-]+:L\d+(?:-\d+)?=.+$/  （行号定位）
```

## 4. 引用关系

本文件被以下文件引用：
- `references/verifier-spec.md` §6.2（evidence 格式）
- `templates/tla-spec-template.md`（@design 格式）
- `templates/feature.template`（@design 格式）
- `scripts/verifier-logic.ts`（EVIDENCE_PATTERN）
- `references/directory-conventions.md` §6（路径引用规则）
```

- [ ] **Step 2：验证文件存在**

Run: `ls -la w-model-dev/references/format-conventions.md`
Expected: 文件存在

- [ ] **Step 3：Commit**

```bash
git add w-model-dev/references/format-conventions.md
git commit -m "feat: 新建 format-conventions.md 作为格式约定 SSoT"
```

---

## Phase B：Schema 升级

### Task 3：tla-manifest.schema.json 新增 sdCoverage 字段

**Files:**
- Modify: `w-model-dev/schemas/tla-manifest.schema.json`
- Test: `w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **Step 1：编写失败测试**

在 `w-model-dev/scripts/__tests__/schema-validation.test.ts` 末尾追加测试：

```typescript
describe('tla-manifest sdCoverage (phase>=2)', () => {
  it('phase>=2 时 sdCoverage 缺失应校验失败', () => {
    const manifest = {
      version: 1,
      project: 'test',
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['REQ-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/sdCoverage/);
  });

  it('phase>=2 时 sdCoverage.uncoveredSdNodes 非空应校验失败', () => {
    const manifest = {
      version: 1, project: 'test', currentPhase: 2, basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['REQ-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
      sdCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: ['SD-003'],
        coverageRate: 0.667,
      },
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2：运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts -t "sdCoverage"`
Expected: FAIL（sdCoverage 字段不存在，schema 校验通过）

- [ ] **Step 3：修改 schema**

在 `w-model-dev/schemas/tla-manifest.schema.json` 的 `properties` 中（`graphSdNodes` 之后、`checkRounds` 之前）新增：

```json
    "sdCoverage": {
      "description": "SD 覆盖率数据（phase>=2 强制必填，由 S-ingest-tla 从 .tla @designIds + graph.json 比对后回填）",
      "type": "object",
      "additionalProperties": false,
      "required": ["totalSdNodes", "coveredSdNodes", "uncoveredSdNodes", "coverageRate"],
      "properties": {
        "totalSdNodes": { "description": "graph.json 中 type=SD 节点总数", "type": "integer", "minimum": 0 },
        "coveredSdNodes": { "description": "已被 TLA+ spec 覆盖的 SD 节点 ID 列表", "type": "array", "items": { "type": "string" } },
        "uncoveredSdNodes": { "description": "未被任何 TLA+ spec 覆盖的 SD 节点 ID 列表（phase>=2 须为空数组）", "type": "array", "items": { "type": "string" }, "maxItems": 0 },
        "coverageRate": { "description": "覆盖率 = coveredSdNodes.length / totalSdNodes", "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
```

同时在顶层 `required` 中追加 `"sdCoverage"`（但须支持 phase=1 时可选——通过 `if/then` 条件实现）。

将顶层 `required` 改为条件 schema：

```json
  "allOf": [
    {
      "if": { "properties": { "currentPhase": { "minimum": 2 } }, "required": ["currentPhase"] },
      "then": { "required": ["version", "currentPhase", "tools", "specs", "sdCoverage"] }
    },
    {
      "if": { "properties": { "currentPhase": { "maximum": 1 } }, "required": ["currentPhase"] },
      "then": { "required": ["version", "currentPhase", "tools", "specs"] }
    }
  ],
```

- [ ] **Step 4：运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts -t "sdCoverage"`
Expected: PASS

- [ ] **Step 5：运行全部 schema 测试确保无回归**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts`
Expected: 全部 PASS

- [ ] **Step 6：Commit**

```bash
git add w-model-dev/schemas/tla-manifest.schema.json w-model-dev/scripts/__tests__/schema-validation.test.ts
git commit -m "feat: tla-manifest schema 新增 sdCoverage 强制字段（phase>=2）"
```

---

### Task 4：bdd-manifest.schema.json 新增 designCoverage 字段

**Files:**
- Modify: `w-model-dev/schemas/bdd-manifest.schema.json`
- Test: `w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **Step 1：编写失败测试**

在 `w-model-dev/scripts/__tests__/schema-validation.test.ts` 末尾追加：

```typescript
describe('bdd-manifest designCoverage (phase>=2)', () => {
  it('phase>=2 时 designCoverage 缺失应校验失败', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/designCoverage/);
  });

  it('phase>=2 时 designCoverage.uncoveredSdNodes 非空应校验失败', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
      designCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2：运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts -t "designCoverage"`
Expected: FAIL

- [ ] **Step 3：修改 schema**

在 `w-model-dev/schemas/bdd-manifest.schema.json` 的 `properties` 中（`stateMachines` 之后、`checkRounds` 之前）新增：

```json
    "designCoverage": {
      "description": "SD 覆盖率数据（phase>=2 强制必填，由 S-ingest-bdd 从 .feature @designIds + graph.json 比对后回填）",
      "type": "object",
      "additionalProperties": false,
      "required": ["totalSdNodes", "coveredSdNodes", "uncoveredSdNodes", "coverageRate"],
      "properties": {
        "totalSdNodes": { "description": "graph.json 中 type=SD 节点总数", "type": "integer", "minimum": 0 },
        "coveredSdNodes": { "description": "已被 BDD feature 覆盖的 SD 节点 ID 列表", "type": "array", "items": { "type": "string" } },
        "uncoveredSdNodes": { "description": "未被任何 BDD feature 覆盖的 SD 节点 ID 列表（phase>=2 须为空数组）", "type": "array", "items": { "type": "string" }, "maxItems": 0 },
        "coverageRate": { "description": "覆盖率 = coveredSdNodes.length / totalSdNodes", "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
```

将顶层 `required` 改为条件 schema（同 Task 3 模式）：

```json
  "allOf": [
    {
      "if": { "properties": { "currentPhase": { "minimum": 2 } }, "required": ["currentPhase"] },
      "then": { "required": ["schemaVersion", "projectId", "basePath", "currentPhase", "features", "stateMachines", "designCoverage"] }
    },
    {
      "if": { "properties": { "currentPhase": { "maximum": 1 } }, "required": ["currentPhase"] },
      "then": { "required": ["schemaVersion", "projectId", "basePath", "currentPhase", "features", "stateMachines"] }
    }
  ],
```

- [ ] **Step 4：运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts -t "designCoverage"`
Expected: PASS

- [ ] **Step 5：运行全部 schema 测试确保无回归**

Run: `npx vitest run w-model-dev/scripts/__tests__/schema-validation.test.ts`
Expected: 全部 PASS

- [ ] **Step 6：Commit**

```bash
git add w-model-dev/schemas/bdd-manifest.schema.json w-model-dev/scripts/__tests__/schema-validation.test.ts
git commit -m "feat: bdd-manifest schema 新增 designCoverage 强制字段（phase>=2）"
```

---

## Phase C：纯逻辑升级

### Task 5：tla-logic.ts 升级 checkCoverage + sdCoverage 校验

**Files:**
- Modify: `w-model-dev/scripts/tla-logic.ts`
- Test: `w-model-dev/scripts/__tests__/tla-logic.test.ts`
- Create: `w-model-dev/scripts/samples/tla/bad-coverage-uncovered-sd.json`

- [ ] **Step 1：编写失败测试**

在 `w-model-dev/scripts/__tests__/tla-logic.test.ts` 末尾追加：

```typescript
describe('checkCoverage sdCoverage 回填', () => {
  it('sdCoverage.uncoveredSdNodes 非空时应产生 coverageViolations', () => {
    const manifest = {
      version: 1, currentPhase: 2, basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['SD-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
      graphSdNodes: ['SD-001', 'SD-002', 'SD-003'],
      sdCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations.length).toBeGreaterThan(0);
    expect(result.coverageViolations.join(' ')).toMatch(/SD-002|SD-003/);
    expect(result.passed).toBe(false);
  });

  it('sdCoverage 缺失但 graphSdNodes 非空（phase>=2）应产生 coverageViolations', () => {
    const manifest = {
      version: 1, currentPhase: 2, basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['SD-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
      graphSdNodes: ['SD-001', 'SD-002'],
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations.length).toBeGreaterThan(0);
    expect(result.coverageViolations.join(' ')).toMatch(/sdCoverage.*缺失|sdCoverage.*missing/);
  });

  it('sdCoverage 全覆盖时 coverageViolations 为空', () => {
    const manifest = {
      version: 1, currentPhase: 2, basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['SD-001', 'SD-002'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
      graphSdNodes: ['SD-001', 'SD-002'],
      sdCoverage: {
        totalSdNodes: 2,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: [],
        coverageRate: 1.0,
      },
    } as any;
    const result = checkTlaModel(manifest, 2);
    expect(result.coverageViolations).toEqual([]);
  });
});
```

- [ ] **Step 2：运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/tla-logic.test.ts -t "sdCoverage"`
Expected: FAIL（当前 checkCoverage 不校验 sdCoverage 字段）

- [ ] **Step 3：升级 TlaManifest 类型**

在 `w-model-dev/scripts/tla-logic.ts` 的 `TlaManifest` 接口中（`graphSdNodes` 之后）新增：

```typescript
  /**
   * SD 覆盖率数据（phase>=2 强制必填，由 S-ingest-tla 从 .tla @designIds + graph.json 比对后回填）。
   * checkTlaModel 校验 uncoveredSdNodes 须为空。
   */
  sdCoverage?: {
    totalSdNodes: number;
    coveredSdNodes: string[];
    uncoveredSdNodes: string[];
    coverageRate: number;
  };
```

- [ ] **Step 4：升级 checkCoverage 函数**

在 `w-model-dev/scripts/tla-logic.ts` 中找到 `checkCoverage` 函数（约 line 550），在函数末尾（`return { passed, violations }` 之前）追加 sdCoverage 字段校验：

```typescript
  // sdCoverage 字段校验（phase>=2 强制）：uncoveredSdNodes 非空 → 违反
  // 注意：sdCoverage 由 S-ingest-tla 回填，此处仅校验已回填数据的正确性
  // 该校验在 checkTlaModel 中调用（传入 manifest.sdCoverage）
```

在 `checkTlaModel` 函数中（约 line 975-977），将现有的 `if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0)` 块替换为：

```typescript
  // 6. SD 覆盖率校验（§10）：phase>=2 时强制执行
  if (phase >= 2) {
    if (!m.sdCoverage) {
      result.coverageViolations.push(
        'sdCoverage 字段缺失（phase>=2 强制必填，须由 S-ingest-tla 从 .tla @designIds + graph.json 比对后回填）',
      );
    } else {
      // 校验 sdCoverage 字段结构
      const cov = m.sdCoverage;
      if (typeof cov.totalSdNodes !== 'number' || typeof cov.coverageRate !== 'number') {
        result.coverageViolations.push('sdCoverage.totalSdNodes / coverageRate 须为数字');
      } else if (!Array.isArray(cov.coveredSdNodes) || !Array.isArray(cov.uncoveredSdNodes)) {
        result.coverageViolations.push('sdCoverage.coveredSdNodes / uncoveredSdNodes 须为数组');
      } else if (cov.uncoveredSdNodes.length > 0) {
        result.coverageViolations.push(
          `以下 SD 节点未被任何 TLA+ spec 覆盖: ${cov.uncoveredSdNodes.join(', ')}`,
        );
      }
      // 交叉校验：sdCoverage.coveredSdNodes 须与 graphSdNodes 比对一致
      if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
        const expectedCovered = m.graphSdNodes.filter(sd => !cov.uncoveredSdNodes?.includes(sd));
        const expectedUncovered = m.graphSdNodes.filter(sd => !cov.coveredSdNodes?.includes(sd));
        if (expectedUncovered.length !== cov.uncoveredSdNodes.length) {
          result.coverageViolations.push(
            'sdCoverage 与 graphSdNodes 比对不一致（covered/uncovered 集合不匹配）',
          );
        }
      }
    }
    // 保留原有 graphSdNodes 覆盖率校验（作为交叉验证）
    if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
      const coverage = checkCoverage(checkedSpecs, m.graphSdNodes);
      result.coverageViolations.push(...coverage.violations);
    }
  } else {
    // phase < 2 时保留原有可选行为
    if (Array.isArray(m.graphSdNodes) && m.graphSdNodes.length > 0) {
      const coverage = checkCoverage(checkedSpecs, m.graphSdNodes);
      result.coverageViolations.push(...coverage.violations);
    }
  }
```

- [ ] **Step 5：运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/tla-logic.test.ts -t "sdCoverage"`
Expected: PASS

- [ ] **Step 6：运行全部 tla-logic 测试确保无回归**

Run: `npx vitest run w-model-dev/scripts/__tests__/tla-logic.test.ts`
Expected: 全部 PASS（如有现有测试因 sdCoverage 缺失失败，须在测试 manifest 中补 `sdCoverage` 字段或设 `currentPhase: 1`）

- [ ] **Step 7：创建测试样本**

创建 `w-model-dev/scripts/samples/tla/bad-coverage-uncovered-sd.json`：

```json
{
  "version": 1,
  "project": "test-uncovered",
  "currentPhase": 2,
  "basePath": ".",
  "tools": { "jarPath": "tla2tools.jar", "javaMinVersion": 11 },
  "specs": [
    {
      "id": "L1_Test", "level": "L1", "phase": 1, "system": "test",
      "requirementIds": ["SD-001"],
      "designRef": "docs/phase1-requirements/requirement-spec.md:§1",
      "tlaPath": "L1_Test.tla", "cfgPath": "L1_Test.cfg",
      "parent": null, "siblings": [], "children": [],
      "variableCombination": 100, "decompositionDecision": "kept-below-threshold",
      "syntaxChecked": true, "tlcChecked": true, "deadlockFree": true,
      "invariantsHold": true, "stateExplosion": false
    }
  ],
  "graphSdNodes": ["SD-001", "SD-002", "SD-003"],
  "sdCoverage": {
    "totalSdNodes": 3,
    "coveredSdNodes": ["SD-001"],
    "uncoveredSdNodes": ["SD-002", "SD-003"],
    "coverageRate": 0.333
  },
  "checkRounds": []
}
```

- [ ] **Step 8：Commit**

```bash
git add w-model-dev/scripts/tla-logic.ts w-model-dev/scripts/__tests__/tla-logic.test.ts w-model-dev/scripts/samples/tla/bad-coverage-uncovered-sd.json
git commit -m "feat: tla-logic checkCoverage 升级为校验 sdCoverage 字段（phase>=2 强制）"
```

---

### Task 6：bdd-logic.ts 新增 D8 SD Coverage 维度

**Files:**
- Modify: `w-model-dev/scripts/bdd-logic.ts`
- Test: `w-model-dev/scripts/__tests__/bdd-logic.test.ts`
- Create: `w-model-dev/scripts/samples/bdd/bad-d8-uncovered-sd.json`

- [ ] **Step 1：编写失败测试**

在 `w-model-dev/scripts/__tests__/bdd-logic.test.ts` 末尾追加：

```typescript
describe('D8 SD Coverage', () => {
  it('designCoverage.uncoveredSdNodes 非空时应产生 D8 violations', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
      designCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    } as any;
    const result = checkBddModel({ manifest, phase: 2, parsedFeatures: [] });
    expect(result.dimensions.sdCoverage.length).toBeGreaterThan(0);
    expect(result.dimensions.sdCoverage.join(' ')).toMatch(/SD-002|SD-003/);
    expect(result.passed).toBe(false);
  });

  it('designCoverage 缺失（phase>=2）应产生 D8 violations', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
    } as any;
    // 注入 graphSdNodes 模拟 --graph 传入
    const result = checkBddModel({
      manifest, phase: 2, parsedFeatures: [],
      graphSdNodes: ['SD-001', 'SD-002'],
    } as any);
    expect(result.dimensions.sdCoverage.length).toBeGreaterThan(0);
    expect(result.dimensions.sdCoverage.join(' ')).toMatch(/designCoverage.*缺失|designCoverage.*missing/);
  });

  it('designCoverage 全覆盖时 D8 violations 为空', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001', 'SD-002'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
      designCoverage: {
        totalSdNodes: 2,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: [],
        coverageRate: 1.0,
      },
    } as any;
    const result = checkBddModel({ manifest, phase: 2, parsedFeatures: [] });
    expect(result.dimensions.sdCoverage).toEqual([]);
  });
});
```

- [ ] **Step 2：运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/bdd-logic.test.ts -t "D8 SD Coverage"`
Expected: FAIL（`result.dimensions.sdCoverage` 不存在）

- [ ] **Step 3：升级 BddCheckInput 接口**

在 `w-model-dev/scripts/bdd-logic.ts` 的 `BddCheckInput` 接口中（`cucumberReport` 之后）新增：

```typescript
  /** 由 CLI 通过 --graph 提取的 SD 节点 ID 列表（phase>=2 时用于 D8 交叉校验） */
  graphSdNodes?: string[];
```

- [ ] **Step 4：升级 BddCheckResult.dimensions**

在 `w-model-dev/scripts/bdd-logic.ts` 的 `BddCheckResult.dimensions` 中（`rtmMapping` 之后）新增：

```typescript
    sdCoverage: string[];
```

- [ ] **Step 5：升级 BddManifest 类型**

在 `BddManifest` 接口（或其类型定义处）新增 `designCoverage` 字段：

```typescript
  /** SD 覆盖率数据（phase>=2 强制，由 S-ingest-bdd 回填） */
  designCoverage?: {
    totalSdNodes: number;
    coveredSdNodes: string[];
    uncoveredSdNodes: string[];
    coverageRate: number;
  };
```

- [ ] **Step 6：初始化 sdCoverage 维度**

在 `checkBddModel` 函数中（约 line 770），`dims` 初始化处追加：

```typescript
    sdCoverage: [] as string[],
```

- [ ] **Step 7：实现 D8 校验逻辑**

在 `checkBddModel` 函数中，D7 RTM 映射校验之后、`allViolations` 合并之前，新增 D8 校验：

```typescript
  // D8: SD Coverage 校验（phase>=2 强制）
  if (phase >= 2) {
    const dc = (input.manifest as any).designCoverage;
    if (!dc) {
      dims.sdCoverage.push(
        '[D8] designCoverage 字段缺失（phase>=2 强制必填，须由 S-ingest-bdd 从 .feature @designIds + graph.json 比对后回填）',
      );
    } else {
      if (typeof dc.totalSdNodes !== 'number' || typeof dc.coverageRate !== 'number') {
        dims.sdCoverage.push('[D8] designCoverage.totalSdNodes / coverageRate 须为数字');
      } else if (!Array.isArray(dc.coveredSdNodes) || !Array.isArray(dc.uncoveredSdNodes)) {
        dims.sdCoverage.push('[D8] designCoverage.coveredSdNodes / uncoveredSdNodes 须为数组');
      } else if (dc.uncoveredSdNodes.length > 0) {
        dims.sdCoverage.push(
          `[D8] 以下 SD 节点未被任何 BDD feature 覆盖: ${dc.uncoveredSdNodes.join(', ')}`,
        );
      }
      // 交叉校验：与 graphSdNodes 比对
      if (input.graphSdNodes && input.graphSdNodes.length > 0) {
        const manifestCovered = new Set<string>();
        for (const f of input.manifest.features) {
          for (const did of f.designIds ?? []) manifestCovered.add(did);
        }
        const graphUncovered = input.graphSdNodes.filter(sd => !manifestCovered.has(sd));
        if (graphUncovered.length > 0 && dc.uncoveredSdNodes.length === 0) {
          dims.sdCoverage.push(
            `[D8] designCoverage.uncoveredSdNodes 为空但 graphSdNodes 比对发现未覆盖: ${graphUncovered.join(', ')}`,
          );
        }
      }
    }
  }
```

- [ ] **Step 8：将 sdCoverage 加入 allViolations**

在 `allViolations` 合并处（约 line 866-873）追加：

```typescript
    ...dims.sdCoverage,
```

- [ ] **Step 9：修复 schema 失败时的 dimensions 返回**

在 `checkBddModel` 函数中 schema 校验失败的 early return 处（约 line 752-767），`dimensions` 对象中追加 `sdCoverage: []`。

- [ ] **Step 10：运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/bdd-logic.test.ts -t "D8 SD Coverage"`
Expected: PASS

- [ ] **Step 11：运行全部 bdd-logic 测试确保无回归**

Run: `npx vitest run w-model-dev/scripts/__tests__/bdd-logic.test.ts`
Expected: 全部 PASS

- [ ] **Step 12：创建测试样本**

创建 `w-model-dev/scripts/samples/bdd/bad-d8-uncovered-sd.json`：

```json
{
  "schemaVersion": "1.0",
  "projectId": "test-d8",
  "basePath": "features/",
  "currentPhase": 2,
  "features": [
    {
      "id": "L1_test-001", "level": 1, "filePath": "L1/L1_test-001.feature",
      "scenarioCount": 1, "stateMachineId": "SM-L1-test", "tlaSpecId": "L1_test",
      "reqIds": ["REQ-001"], "designIds": ["SD-001"],
      "parentFeatureIds": [], "siblingFeatureIds": [], "childFeatureIds": []
    }
  ],
  "stateMachines": [
    {
      "id": "SM-L1-test", "level": 1, "states": ["S1", "S2"],
      "initialState": "S1", "terminalStates": [], "acceptingStates": ["S2"],
      "rejectingStates": [], "transitions": [{ "from": "S1", "event": "e", "to": "S2" }],
      "invariants": ["S2 => true"]
    }
  ],
  "designCoverage": {
    "totalSdNodes": 3,
    "coveredSdNodes": ["SD-001"],
    "uncoveredSdNodes": ["SD-002", "SD-003"],
    "coverageRate": 0.333
  },
  "checkRounds": []
}
```

- [ ] **Step 13：Commit**

```bash
git add w-model-dev/scripts/bdd-logic.ts w-model-dev/scripts/__tests__/bdd-logic.test.ts w-model-dev/scripts/samples/bdd/bad-d8-uncovered-sd.json
git commit -m "feat: bdd-logic 新增 D8 SD Coverage 维度（phase>=2 强制）"
```

---

## Phase D：CLI 脚本升级

### Task 7：check-tla-model.ts --graph phase>=2 强制

**Files:**
- Modify: `w-model-dev/scripts/check-tla-model.ts`

- [ ] **Step 1：修改参数解析——--graph phase>=2 强制**

在 `w-model-dev/scripts/check-tla-model.ts` 的 `main` 函数中，phase 确定后（约 line 373 之后）新增 --graph 强制校验：

```typescript
  // --graph phase>=2 强制（设计文档 §3.3.6）
  if (phase >= 2 && !graphFile) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 --graph=<graph.json>（phase>=2 强制）',
      detail: '用法: npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> --phase=N --graph=.w-model/ingestion/graph.json',
      exitCode: 2,
    });
    return;
  }
```

- [ ] **Step 2：修改注释——用法说明更新**

将文件头注释（约 line 11-18）中 `--graph` 的说明从"可选"改为"phase>=2 强制"：

```typescript
 *   --graph=<graph.json> 提供图谱文件，提取 type=SD 节点 ID 供 SD 覆盖率校验（§10）
 *                        phase>=2 时强制必填，缺失 → exitCode=2 ARG_INVALID
```

- [ ] **Step 3：验证——跑现有样本确保 phase=1 不受影响**

Run: `npx tsx w-model-dev/scripts/check-tla-model.ts w-model-dev/scripts/samples/tla/valid.json --phase=1`
Expected: 正常执行（不要求 --graph）

- [ ] **Step 4：验证——phase=2 缺 --graph 应 exitCode=2**

Run: `npx tsx w-model-dev/scripts/check-tla-model.ts w-model-dev/scripts/samples/tla/valid.json --phase=2`
Expected: exitCode=2，输出含"参数缺失 --graph"

- [ ] **Step 5：Commit**

```bash
git add w-model-dev/scripts/check-tla-model.ts
git commit -m "feat: check-tla-model --graph 参数 phase>=2 时强制必填"
```

---

### Task 8：check-bdd-model.ts 新增 --graph 参数 + D8 校验

**Files:**
- Modify: `w-model-dev/scripts/check-bdd-model.ts`

- [ ] **Step 1：修改 ParsedArgs 接口**

在 `w-model-dev/scripts/check-bdd-model.ts` 的 `ParsedArgs` 接口中新增 `graphFile`：

```typescript
interface ParsedArgs {
  manifestFile: string | undefined;
  phase: number | undefined;
  phaseStr: string | undefined;
  tlaManifestFile: string | undefined;
  rtmFile: string | undefined;
  cucumberReportFile: string | undefined;
  graphFile: string | undefined;
}
```

- [ ] **Step 2：修改 parseArgs 函数**

在 `parseArgs` 函数中新增 `--graph` 解析：

```typescript
  const graphArg = args.find(a => a.startsWith('--graph='));
  // ... 在 return 之前 ...
  const graphFile = graphArg ? graphArg.split('=')[1] : undefined;
  return { manifestFile, phase, phaseStr, tlaManifestFile, rtmFile, cucumberReportFile, graphFile };
```

- [ ] **Step 3：修改 main 函数——--graph phase>=2 强制**

在 `main` 函数中，phase 确定后（约 line 179 之后）新增：

```typescript
  // --graph phase>=2 强制（设计文档 §3.3.7）
  if (phase >= 2 && !args.graphFile) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 --graph=<graph.json>（phase>=2 强制）',
      detail: '用法: check-bdd-model.ts <bdd-manifest.json> --phase=N --graph=.w-model/ingestion/graph.json',
      exitCode: 2,
    });
    return 2;
  }
```

- [ ] **Step 4：提取 graphSdNodes 并注入 checkBddModel**

在 `main` 函数中，调用 `checkBddModel` 之前（约 line 268 之前）新增 graphSdNodes 提取：

```typescript
  // 提取 graph SD 节点（供 D8 SD Coverage 交叉校验）
  let graphSdNodes: string[] | undefined;
  if (args.graphFile) {
    try {
      const g = await readJson<{ nodes?: Array<{ id: string; type: string }> }>(args.graphFile);
      if (Array.isArray(g.nodes)) {
        graphSdNodes = g.nodes.filter(n => n.type === 'SD').map(n => n.id);
      }
    } catch (e) {
      console.error(`[D8] 无法读取 graph 文件: ${(e as Error).message}`);
    }
  }
```

- [ ] **Step 5：修改 checkBddModel 调用——传入 graphSdNodes**

将 `checkBddModel` 调用（约 line 269-276）修改为传入 `graphSdNodes`：

```typescript
  const result = checkBddModel({
    manifest,
    phase,
    parsedFeatures,
    tlaSnapshots,
    rtmRows,
    cucumberReport,
    graphSdNodes,
  });
```

- [ ] **Step 6：修改输出报告——新增 D8 维度**

在输出报告部分（约 line 293-294 之后）新增 D8 输出：

```typescript
  console.log(`\n--- D8 SD Coverage: ${result.dimensions.sdCoverage.length} violations`);
  for (const v of result.dimensions.sdCoverage) console.log(`  - ${v}`);
```

- [ ] **Step 7：修改用法注释**

将文件头注释（约 line 11-13）更新为：

```typescript
 *   npx tsx w-model-dev/scripts/check-bdd-model.ts <bdd-manifest.json>
 *     [--phase=N] [--tla-manifest=<path>] [--rtm=<path>] [--cucumber-report=<path>] [--graph=<graph.json>]
 *   --graph=<graph.json>  phase>=2 时强制必填，提取 type=SD 节点供 D8 SD Coverage 校验
```

- [ ] **Step 8：验证——phase=2 缺 --graph 应 exitCode=2**

Run: `npx tsx w-model-dev/scripts/check-bdd-model.ts w-model-dev/scripts/samples/bdd/valid-manifest.json --phase=2`
Expected: exitCode=2，输出含"参数缺失 --graph"

- [ ] **Step 9：验证——D8 uncovered 样本应 exitCode=1**

Run: `npx tsx w-model-dev/scripts/check-bdd-model.ts w-model-dev/scripts/samples/bdd/bad-d8-uncovered-sd.json --phase=2 --graph=w-model-dev/scripts/samples/graph/valid-cross-logic.json`
Expected: exitCode=1，输出含 "D8 SD Coverage" violations

- [ ] **Step 10：Commit**

```bash
git add w-model-dev/scripts/check-bdd-model.ts
git commit -m "feat: check-bdd-model 新增 --graph 参数 + D8 SD Coverage 校验"
```

---

### Task 9：check-artifact-gate.ts 终检调用 model 校验

**Files:**
- Modify: `w-model-dev/scripts/check-artifact-gate.ts`

- [ ] **Step 1：新增 spawnTlaModelCheck / spawnBddModelCheck 函数**

在 `w-model-dev/scripts/check-artifact-gate.ts` 中，TLA+/BDD 资产读取之后（约 line 303 之后），新增调用 model 校验的逻辑：

```typescript
  // ==================== 终检调用 TLA+/BDD model 校验（设计文档 §3.3.8） ====================
  // phase>=2 时，终检调用 check-tla-model.ts + check-bdd-model.ts，传递 --graph + --phase
  const modelCheckViolations: string[] = [];
  const graphPath = graphSource ? path.join(ingestionDir, graphSource) : '';

  if (manifestExists && effectivePhase >= 2 && graphPath) {
    // 调用 check-tla-model.ts
    const tlaModelResult = spawnSync(
      process.execPath,
      [
        '--import', 'tsx',
        path.resolve(__dirname, 'check-tla-model.ts'),
        manifestFile,
        `--phase=${effectivePhase}`,
        `--graph=${graphPath}`,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    if (tlaModelResult.status !== 0) {
      modelCheckViolations.push(
        `[artifact:tla-model] check-tla-model 退出码 ${tlaModelResult.status}：${(tlaModelResult.stdout ?? '').split('\n').slice(-5).join(' | ')}`,
      );
    }

    // 调用 check-bdd-model.ts
    if (bddManifestExists) {
      const bddModelResult = spawnSync(
        process.execPath,
        [
          '--import', 'tsx',
          path.resolve(__dirname, 'check-bdd-model.ts'),
          bddManifestFile,
          `--phase=${effectivePhase}`,
          `--graph=${graphPath}`,
        ],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      if (bddModelResult.status !== 0) {
        modelCheckViolations.push(
          `[artifact:bdd-model] check-bdd-model 退出码 ${bddModelResult.status}：${(bddModelResult.stdout ?? '').split('\n').slice(-5).join(' | ')}`,
        );
      }
    }
  }
```

- [ ] **Step 2：将 modelCheckViolations 合并到终检结果**

将 `allReasons` 和 `overallPassed` 修改为包含 modelCheckViolations：

```typescript
  const allReasons = [...result.reasons, ...uatMappingViolations, ...bddViolations, ...modelCheckViolations];
  const overallPassed =
    result.passed && uatMappingViolations.length === 0 && bddViolations.length === 0 && modelCheckViolations.length === 0;
```

- [ ] **Step 3：修改报告输出——新增 model 校验状态**

在报告输出部分（约 line 347 之后）新增：

```typescript
  console.log(`Model 校验    : ${modelCheckViolations.length === 0 ? '✓ TLA+/BDD model 校验通过' : `✗ ${modelCheckViolations.length} 条违反`}`);
```

- [ ] **Step 4：引入 spawnSync**

在文件顶部 import 区追加（如尚未引入）：

```typescript
import { spawnSync } from 'node:child_process';
```

- [ ] **Step 5：新增 resolvePhaseDoc 函数消除硬编码路径（spec §3.1.2）**

在 `w-model-dev/scripts/check-artifact-gate.ts` 中，文件顶部常量区（约 line 44-46 之后）新增 `resolvePhaseDoc` 函数与内置映射表：

```typescript
/**
 * 阶段文档路径解析（directory-conventions.md §7 SSoT）。
 * 禁止在门禁脚本中硬编码 docs/uat-path-mapping.md 等路径，统一走本函数。
 *
 * @param phase 阶段号 1-8
 * @param type  文档类型：'requirement-spec' | 'acceptance-test-design' | 'uat-path-mapping'
 *              | 'system-design' | 'system-test' | 'outline-design' | 'integration-test'
 *              | 'detailed-design' | 'interface-design' | 'integration-test-phase6'
 *              | 'system-test-phase7' | 'acceptance-test-phase8'
 * @returns 相对项目根的路径（如 'docs/phase1-requirements/requirement-spec.md'）
 */
const PHASE_DOC_MAP: Record<number, Record<string, string>> = {
  1: {
    'requirement-spec': 'docs/phase1-requirements/requirement-spec.md',
    'acceptance-test-design': 'docs/phase1-requirements/acceptance-test-design.md',
    'uat-path-mapping': 'docs/uat-path-mapping.md',
  },
  2: {
    'system-design': 'docs/phase2-design/{module}-system-design.md',
    'system-test': 'docs/phase2-design/{module}-system-test.md',
  },
  3: {
    'outline-design': 'docs/phase3-outline/{module}-outline-design.md',
    'integration-test': 'docs/phase3-outline/{module}-integration-test.md',
  },
  4: {
    'detailed-design': 'docs/phase4-detailed/{module}-detailed-design.md',
    'interface-design': 'docs/phase4-detailed/{module}-interface-design.md',
  },
  6: { 'integration-test-phase6': 'docs/phase6-integration-test/integration-test.md' },
  7: { 'system-test-phase7': 'docs/phase7-system-test/system-test.md' },
  8: { 'acceptance-test-phase8': 'docs/phase8-acceptance-test/acceptance-test.md' },
};

export function resolvePhaseDoc(phase: number, type: string): string {
  const phaseMap = PHASE_DOC_MAP[phase];
  if (!phaseMap) {
    throw new Error(`resolvePhaseDoc: 未支持的 phase=${phase}（directory-conventions.md §1）`);
  }
  const docPath = phaseMap[type];
  if (!docPath) {
    throw new Error(`resolvePhaseDoc: phase=${phase} 无 type="${type}" 映射（directory-conventions.md §1）`);
  }
  return docPath;
}
```

然后将文件中所有硬编码路径引用改为调用 `resolvePhaseDoc`：

- line 311-317: `docs/uat-path-mapping.md` → `resolvePhaseDoc(1, 'uat-path-mapping')`
- line 328: 同上

将 P0-1 校验中的硬编码字符串替换：

```typescript
  // P0-1: phase=1 校验 uat-path-mapping 存在性（路径由 resolvePhaseDoc 解析，禁止硬编码）
  const uatMappingPath = resolvePhaseDoc(1, 'uat-path-mapping');
  const uatMappingFull = path.join(projectDir, uatMappingPath);
  // ... 后续校验使用 uatMappingFull 替代原硬编码路径
```

- [ ] **Step 6：验证——终检应调用 model 校验**

Run: `npx tsx w-model-dev/scripts/check-artifact-gate.ts w-model-dev-demo --phase=2`
Expected: 输出含 "Model 校验" 行

- [ ] **Step 7：验证——resolvePhaseDoc 无残留硬编码**

Run: `grep -n "docs/uat-path-mapping\|docs/system-design\|docs/requirement-spec\|docs/detailed-design" w-model-dev/scripts/check-artifact-gate.ts`
Expected: 无输出（所有路径已通过 resolvePhaseDoc 解析；字符串常量仅存在于 PHASE_DOC_MAP）

- [ ] **Step 8：Commit**

```bash
git add w-model-dev/scripts/check-artifact-gate.ts
git commit -m "feat: check-artifact-gate 终检调用 model 校验 + resolvePhaseDoc 消除硬编码路径"
```

---

### Task 10：verifier-logic.ts EVIDENCE_PATTERN 更新

**Files:**
- Modify: `w-model-dev/scripts/verifier-logic.ts`
- Test: `w-model-dev/scripts/__tests__/verifier-logic.test.ts`

- [ ] **Step 1：编写失败测试**

在 `w-model-dev/scripts/__tests__/verifier-logic.test.ts` 中找到 evidence 格式相关测试，追加：

```typescript
describe('EVIDENCE_PATTERN 冒号格式', () => {
  it('应接受 path:§section=statement 格式', () => {
    const evidence = 'docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全';
    // 使用与 verifier-logic 相同的校验逻辑
    expect(/^[\w/.-]+:§[\w.-]+=.+$/.test(evidence)).toBe(true);
  });

  it('应接受 path:L42=statement 格式', () => {
    const evidence = 'src/auth.ts:L42-58=JWT 签发逻辑';
    expect(/^[\w/.-]+:L\d+(?:-\d+)?=.+$/.test(evidence)).toBe(true);
  });

  it('应拒绝 path.field=value 点号格式', () => {
    const evidence = 'coverage.json.matrices.stakeholder.coverage=100%';
    expect(/^[\w/.-]+:§[\w.-]+=.+$/.test(evidence)).toBe(false);
    expect(/^[\w/.-]+:L\d+(?:-\d+)?=.+$/.test(evidence)).toBe(false);
  });
});
```

- [ ] **Step 2：运行测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/verifier-logic.test.ts -t "冒号格式"`
Expected: 部分FAIL（当前 EVIDENCE_PATTERN 匹配点号格式）

- [ ] **Step 3：修改 EVIDENCE_PATTERN**

在 `w-model-dev/scripts/verifier-logic.ts` 中找到 `EVIDENCE_PATTERN`（约 line 227），替换为：

```typescript
/**
 * evidence 格式正则（format-conventions.md §2.1）：
 *   合法格式：path:§section=statement 或 path:L42=statement 或 path:L42-58=statement
 *   非法格式：path.field=value（点号，已废弃）/ 纯文件名无定位 / 空泛声明
 */
const EVIDENCE_PATTERN = /^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/;
```

- [ ] **Step 4：运行测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/verifier-logic.test.ts -t "冒号格式"`
Expected: PASS

- [ ] **Step 5：运行全部 verifier-logic 测试确保无回归**

Run: `npx vitest run w-model-dev/scripts/__tests__/verifier-logic.test.ts`
Expected: 全部 PASS（如现有测试用旧点号格式 evidence，须更新为冒号格式）

- [ ] **Step 6：更新现有测试中的旧格式 evidence**

搜索 `w-model-dev/scripts/__tests__/verifier-logic.test.ts` 和 `w-model-dev/scripts/samples/verifier/` 中使用点号格式 evidence 的地方，更新为冒号格式。

- [ ] **Step 7：Commit**

```bash
git add w-model-dev/scripts/verifier-logic.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/samples/verifier/
git commit -m "feat: verifier-logic EVIDENCE_PATTERN 更新为冒号格式（format-conventions.md）"
```

---

## Phase E：模板升级

### Task 11：tla-spec-template.md @designIds + :§ 格式

**Files:**
- Modify: `w-model-dev/templates/tla-spec-template.md`

- [ ] **Step 1：修改 @design 格式——井号改冒号**

在 `w-model-dev/templates/tla-spec-template.md` 中，将所有 `#§` 替换为 `:§`：

- line 15: `@design        <关联设计文档相对路径，如 docs/system-design.md#§3.2>` → `@design        <关联设计文档相对路径，如 docs/phase2-design/blog-system-system-design.md:§3.2>`
- line 113: `可带锚点 #§` → `可带锚点 :§`
- line 128: `@design        docs/requirement-spec.md#§3` → `@design        docs/phase1-requirements/requirement-spec.md:§3`
- line 144: `@design        docs/system-design.md#§3.2` → `@design        docs/phase2-design/blog-system-system-design.md:§3.2`
- line 160: `@design        docs/detailed-design.md#§4.1.2` → `@design        docs/phase4-detailed/blog-system-detailed-design.md:§4.1.2`

- [ ] **Step 2：新增 @designIds 头部字段**

在 .tla 文件模板的头部字段区（约 line 12-21），`@design` 之后新增：

```tla
  @designIds     <关联 SD 节点 ID，逗号分隔，如 SD-001,SD-002,SD-005>
```

- [ ] **Step 3：更新文件头字段说明表**

在"文件头字段说明"表格（约 line 109-118）中，`@design` 行之后新增：

```markdown
| `@designIds` | 是 | 关联 SD 节点 ID（逗号分隔），须与 graph.json 中 type=SD 节点 ID 一致；S-ingest-tla 据此回填 manifest sdCoverage |
```

- [ ] **Step 4：更新示例——所有层级示例加 @designIds**

在 L1/L2/L3 示例（约 line 124-167）中，每个示例的 `@design` 行之后新增 `@designIds` 行：

```tla
  @design        docs/phase1-requirements/requirement-spec.md:§3
  @designIds     SD-001,SD-002,SD-003
```

- [ ] **Step 5：新增引用说明**

在文件末尾新增引用说明：

```markdown
## 引用约定

- 路径约定见 [directory-conventions.md](../references/directory-conventions.md)
- 格式约定见 [format-conventions.md](../references/format-conventions.md)
- @designIds 字段须列出本规格覆盖的所有 SD 节点 ID，S-ingest-tla 据此回填 manifest sdCoverage
```

- [ ] **Step 6：验证——无残留 #§**

Run: `grep -n "#§" w-model-dev/templates/tla-spec-template.md`
Expected: 无输出（所有 #§ 已替换为 :§）

- [ ] **Step 7：Commit**

```bash
git add w-model-dev/templates/tla-spec-template.md
git commit -m "feat: tla-spec-template 新增 @designIds 头部 + :§ 格式统一"
```

---

### Task 12：feature.template @designIds 头部

**Files:**
- Modify: `w-model-dev/templates/feature.template`

- [ ] **Step 1：新增 @designIds 头部字段**

在 `w-model-dev/templates/feature.template` 中，`# @design:` 行（约 line 19）之后新增：

```
# @designIds: <SD-001,SD-002,SD-005>
```

- [ ] **Step 2：更新头标注说明**

修改头标注说明（约 line 13）：

```
# 头标注 10 个字段全部必填（见 bdd-guide.md §2.2）；L1 @parent-features 填 (none)；L4 @child-features 填 (none)
```

将"9 个"改为"10 个"。

- [ ] **Step 3：新增引用说明**

在文件末尾新增：

```
# 引用约定：
#   路径约定见 references/directory-conventions.md
#   格式约定见 references/format-conventions.md
#   @designIds 须列出本 feature 覆盖的所有 SD 节点 ID，S-ingest-bdd 据此回填 manifest designCoverage
```

- [ ] **Step 4：Commit**

```bash
git add w-model-dev/templates/feature.template
git commit -m "feat: feature.template 新增 @designIds 头部字段"
```

---

## Phase F：文档更新

### Task 13：phase-2/3/4 文档路径更新

**Files:**
- Modify: `w-model-dev/references/phase-2-system-design.md`
- Modify: `w-model-dev/references/phase-3-outline-design.md`
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1：phase-2-system-design.md 路径更新**

在 `w-model-dev/references/phase-2-system-design.md` 中：

- line 36: `| 系统设计文档 | ... | \`<模块>-system-design.md\` |` → `| 系统设计文档 | ... | \`docs/phase2-design/{module}-system-design.md\` |`
- line 37: `| 系统测试用例 | ... | \`<模块>-system-test.md\` |` → `| 系统测试用例 | ... | \`docs/phase2-design/{module}-system-test.md\` |`
- line 38: `内嵌于 \`<模块>-system-design.md\`` → `内嵌于 \`docs/phase2-design/{module}-system-design.md\``

在文件开头"输出"节新增引用说明：

```markdown
> 路径约定见 [directory-conventions.md](directory-conventions.md)。
```

- [ ] **Step 2：phase-3-outline-design.md 路径更新**

在 `w-model-dev/references/phase-3-outline-design.md` 中，搜索所有 `<模块>-outline-design.md` 和路径引用，更新为 `docs/phase3-outline/{module}-outline-design.md` 模式。新增引用说明。

- [ ] **Step 3：phase-4-detailed-design.md 路径更新**

在 `w-model-dev/references/phase-4-detailed-design.md` 中，搜索所有 `<模块>-detailed-design.md` 和路径引用，更新为 `docs/phase4-detailed/{module}-detailed-design.md` 模式。新增引用说明。

- [ ] **Step 4：验证——无残留旧路径模式**

Run: `grep -n "<模块>-.*-design\.md" w-model-dev/references/phase-2-system-design.md w-model-dev/references/phase-3-outline-design.md w-model-dev/references/phase-4-detailed-design.md`
Expected: 无输出

- [ ] **Step 5：Commit**

```bash
git add w-model-dev/references/phase-2-system-design.md w-model-dev/references/phase-3-outline-design.md w-model-dev/references/phase-4-detailed-design.md
git commit -m "feat: phase-2/3/4 文档路径更新为阶段子目录模式（directory-conventions.md）"
```

---

### Task 14：verifier-spec.md 格式统一

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1：§6.2 evidence 格式统一为冒号**

在 `w-model-dev/references/verifier-spec.md` 中，找到 §6.2 evidence 格式规范（约 line 447-450），将点号格式替换为冒号格式：

```markdown
**evidence 格式规范**（[21.0.0] 新增，[22.0.0] 统一为冒号分隔）：evidence 字段每条须含 `<文件路径>:<定位>=<值>` 格式，定位为 `§section` 或 `L行号`。
- 合法示例：`docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全` / `src/auth.ts:L42-58=JWT 签发逻辑`
- 非法示例：`coverage.json.matrices.stakeholder.coverage=100%`（点号格式，已废弃）/ `C1-C10 全通过` / `质量良好` / `评审通过`
- 空泛声明视为 O3（Verifier Theater）命中，V 评审降级重做
- 格式约定见 [format-conventions.md](format-conventions.md) §2.1
```

- [ ] **Step 2：§6.2.1 引用 format-conventions.md**

在 §6.2.1 末尾（约 line 461 之后）新增引用：

```markdown
5. **格式标准**：路径定位分隔符统一为冒号（`path:§section` / `path:L42`），禁止点号 / 井号格式。详见 [format-conventions.md](format-conventions.md)。
```

- [ ] **Step 3：搜索并替换所有旧格式 evidence 示例**

搜索 `w-model-dev/references/verifier-spec.md` 中所有 `coverage.json.` 点号格式 evidence 示例，更新为冒号格式。

- [ ] **Step 4：验证——无残留点号格式 evidence**

Run: `grep -n "\.json\.[a-z]" w-model-dev/references/verifier-spec.md | grep -v "http"`
Expected: 无输出或仅剩合法引用

- [ ] **Step 5：Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat: verifier-spec §6.2 evidence 格式统一为冒号（format-conventions.md）"
```

---

### Task 15：tla-plus-guide.md --graph 强制 + @designIds

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 1：搜索 --graph 相关内容**

Run: `grep -n "\-\-graph" w-model-dev/references/tla-plus-guide.md`

- [ ] **Step 2：修改 --graph 为 phase>=2 强制**

找到 §10 SD 覆盖率相关内容，将 --graph 从"可选"改为"phase>=2 强制"：

```markdown
## §10 SD 覆盖率校验（phase>=2 强制）

`check-tla-model.ts` 在 phase>=2 时强制要求 `--graph=<graph.json>` 参数，缺失 → exitCode=2 ARG_INVALID。

校验流程：
1. 从 graph.json 提取所有 type=SD 节点 ID
2. 校验 manifest.sdCoverage 字段存在且 uncoveredSdNodes 为空
3. 交叉校验 sdCoverage 与 graphSdNodes 比对一致

sdCoverage 字段由 S-ingest-tla 子代理从 .tla 文件头部 @designIds 提取后回填 manifest。
```

- [ ] **Step 3：新增 @designIds 字段说明**

在 tla-plus-guide.md 的文件头字段说明节新增：

```markdown
### @designIds 字段（必填）

`.tla` 文件头部须含 `@designIds` 字段，列出本规格覆盖的所有 SD 节点 ID（逗号分隔）。

```
@designIds     SD-001,SD-002,SD-005
```

S-ingest-tla 子代理据此字段与 graph.json 比对后回填 manifest sdCoverage。
```

- [ ] **Step 4：新增 S-ingest-tla 分派说明**

在 tla-plus-guide.md 末尾新增 S-ingest-tla 分派说明节：

```markdown
## S-ingest-tla 子代理

TLA+ 覆盖率数据由独立的 S-ingest-tla 子代理回填，非 S-tla 自填。

分派时序：
1. S-tla 产出 .tla/.cfg/manifest 基础字段 + @designIds 头部
2. S-ingest-tla 从 .tla 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest sdCoverage
3. R3 → V → G(check-tla-model --graph 校验)
```

- [ ] **Step 5：Commit**

```bash
git add w-model-dev/references/tla-plus-guide.md
git commit -m "feat: tla-plus-guide --graph phase>=2 强制 + @designIds 字段 + S-ingest-tla 说明"
```

---

### Task 16：bdd-guide.md D8 维度 + @designIds

**Files:**
- Modify: `w-model-dev/references/bdd-guide.md`

- [ ] **Step 1：搜索 D7 维度相关内容**

Run: `grep -n "D7\|D8\|SD 覆盖" w-model-dev/references/bdd-guide.md`

- [ ] **Step 2：新增 D8 SD Coverage 维度说明**

在 bdd-guide.md 的校验维度说明节（D7 之后）新增：

```markdown
## D8 SD Coverage（phase>=2 强制）

`check-bdd-model.ts` 在 phase>=2 时新增 D8 SD Coverage 校验维度：

1. 校验 manifest.designCoverage 字段存在且 uncoveredSdNodes 为空
2. 从 .feature 头部 @designIds 提取覆盖的 SD 节点 ID
3. 与 graph.json 中所有 type=SD 节点比对
4. uncoveredSdNodes 非空 → D8 violation，exitCode=1

designCoverage 字段由 S-ingest-bdd 子代理从 .feature 文件头部 @designIds 提取后回填 manifest。
```

- [ ] **Step 3：新增 @designIds 字段说明**

在 bdd-guide.md 的头标注说明节新增：

```markdown
### @designIds 头标注（必填，第 10 个字段）

`.feature` 文件头部须含 `@designIds` 字段，列出本 feature 覆盖的所有 SD 节点 ID（逗号分隔）。

```
# @designIds: SD-001,SD-002,SD-005
```

S-ingest-bdd 子代理据此字段与 graph.json 比对后回填 manifest designCoverage。
```

- [ ] **Step 4：新增 S-ingest-bdd 分派说明**

在 bdd-guide.md 末尾新增：

```markdown
## S-ingest-bdd 子代理

BDD 覆盖率数据由独立的 S-ingest-bdd 子代理回填，非 S-bdd 自填。

分派时序：
1. S-bdd 产出 .feature/manifest 基础字段 + @designIds 头部
2. S-ingest-bdd 从 .feature 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest designCoverage
3. R3 → V → G(check-bdd-model --graph 校验)
```

- [ ] **Step 5：Commit**

```bash
git add w-model-dev/references/bdd-guide.md
git commit -m "feat: bdd-guide 新增 D8 SD Coverage 维度 + @designIds 字段 + S-ingest-bdd 说明"
```

---

## Phase G：分派模板升级

### Task 17：subagent-delegation.md S-ingest + S-tla/S-bdd + G 模板强化

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1：新增 S-ingest-tla/S-ingest-bdd 分派模板**

在 `w-model-dev/references/subagent-delegation.md` 的 S-bdd 子代理分派模板之后（约 line 385 之后）新增：

```markdown
#### S-ingest-tla 子代理分派模板（第 35 轮新增）

```
角色：产出子代理-TLA+ 图谱导入变体（S-ingest-tla）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage
依据：references/directory-conventions.md + references/format-conventions.md + references/tla-plus-guide.md §10
输入：
  - .tla 文件路径列表（S-tla 已产出）
  - tla-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. tla-manifest.json 的 sdCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, sdCoverage 摘要, uncovered 列表}
不产出：
  - .tla / .cfg 文件（由 S-tla 负责，S-ingest 只读不写 .tla）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .tla 文件，不修改
  - @designIds 提取须与 .tla 文件头部一致
  - sdCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```

#### S-ingest-bdd 子代理分派模板（第 35 轮新增）

```
角色：产出子代理-BDD 图谱导入变体（S-ingest-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage
依据：references/directory-conventions.md + references/format-conventions.md + references/bdd-guide.md D8
输入：
  - .feature 文件路径列表（S-bdd 已产出）
  - bdd-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. bdd-manifest.json 的 designCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, designCoverage 摘要, uncovered 列表}
不产出：
  - .feature 文件（由 S-bdd 负责，S-ingest 只读不写 .feature）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .feature 文件，不修改
  - @designIds 提取须与 .feature 文件头部一致
  - designCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```
```

- [ ] **Step 2：修改 S 拆分机制——新增 S-ingest 时序**

在"### S 拆分机制"节（约 line 319-327）中，修改分派时序：

```markdown
- **S-ingest-tla**：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage；**依赖 S-tla 已产出的 .tla 文件** + A-evolve 已产出的 graph.json。
- **S-ingest-bdd**：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage；**依赖 S-bdd 已产出的 .feature 文件** + A-evolve 已产出的 graph.json。
- **分派时序**：S-doc → A-evolve(SD 节点入图谱) → S-tla(产出 .tla/.cfg/manifest 基础字段 + @designIds 头部) → S-ingest-tla(回填 manifest sdCoverage) → S-bdd(产出 .feature/manifest 基础字段 + @designIds 头部) → S-ingest-bdd(回填 manifest designCoverage) → R3 → V → G(check-tla-model + check-bdd-model --graph 校验)。
```

- [ ] **Step 3：修改 S-tla 模板——新增 @designIds 要求**

在 S-tla 子代理分派模板（约 line 347-363）的"产出"节追加：

```markdown
  1. .tla（按 phase-N 层级：L1/L2/L3/L4）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. .cfg（TLC 模型检查配置）
  3. tla-manifest.json 实体更新（基础字段，不含 sdCoverage——由 S-ingest-tla 回填）
  4. 返回：{.tla 路径, .cfg 路径, manifest diff, selfCheck}
```

在"不产出"节追加：

```markdown
  - tla-manifest.json 的 sdCoverage 字段（由 S-ingest-tla 回填）
```

- [ ] **Step 4：修改 S-bdd 模板——新增 @designIds 要求**

在 S-bdd 子代理分派模板（约 line 365-385）的"产出"节追加：

```markdown
  1. .feature（按 phase-N 层级：L1/L2/L3/L4，每个 REQ/SD/INTF/DD ≥1 个 .feature 文件）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. bdd-manifest.json 实体更新（features + stateMachines + tlaSpecId 关联，不含 designCoverage——由 S-ingest-bdd 回填）
  3. RTM 测试列追加 BDD 引用（`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`）
  4. 返回：{.feature 路径, manifest diff, RTM diff, selfCheck}
```

在"约束"节追加：

```markdown
  - .feature 文件头部须含 @designIds 字段（逗号分隔的 SD 节点 ID），读取 .w-model/ingestion/graph.json 提取 SD 节点列表作为覆盖范围依据
```

在"不产出"节追加：

```markdown
  - bdd-manifest.json 的 designCoverage 字段（由 S-ingest-bdd 回填）
```

- [ ] **Step 5：修改 G 模板——强制跑 model 校验**

在 G 子代理分派模板（约 line 249-270）的"执行"节替换为：

```markdown
执行：
  - 阶段 1~7 门：
    1. npx tsx w-model-dev/scripts/check-verifier-output.ts "<verifier-output.json>"
    2. npx tsx w-model-dev/scripts/check-tla-model.ts "<tla-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json
    3. npx tsx w-model-dev/scripts/check-bdd-model.ts "<bdd-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json
    4. npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir] --phase=<N>
    5. 其余闭环脚本（按 phase-N 定义）
  - 阶段 8 终检：npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]（内部已调用 check-tla-model + check-bdd-model 并传 --graph）
```

- [ ] **Step 6：修改产出契约——G 返回 model 校验证据**

在 G 模板的"产出契约"节追加：

```markdown
  2. 证据摘要：
     - 阶段门：{exitCode, qualityLevel, passed, reworkHints, tlaModelExitCode, bddModelExitCode}
     - 终检：{exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果 / Model 校验结果）}
```

- [ ] **Step 7：修改分派矩阵——新增 S-ingest 行**

在"标准 S / S-doc / S-tla / S-bdd"分派矩阵（约 line 471）追加：

```markdown
| S-ingest-tla / S-ingest-bdd | `produce` | `<phase>-ingest.json` |
```

- [ ] **Step 8：Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "feat: subagent-delegation 新增 S-ingest-tla/S-ingest-bdd + S-tla/S-bdd @designIds + G 模板强制 model 校验"
```

---

## Phase H：Demo 重产 + 端到端验证

### Task 18：重新产生 w-model-dev-demo

**Files:**
- Modify: `w-model-dev-demo/` 下全部产物

> 本任务由编排者在所有技能变更完成后，按新的技能定义重新走 W 模型 8 阶段端到端流程产生 demo。允许不兼容历史数据。

- [ ] **Step 1：清理旧 demo 产物**

```bash
# 保留 .w-model/ 目录结构，删除产物文件
rm -rf w-model-dev-demo/docs/
rm -rf w-model-dev-demo/tla/
rm -rf w-model-dev-demo/features/
rm -rf w-model-dev-demo/src/
rm -f w-model-dev-demo/.w-model/tla-manifest.json
rm -f w-model-dev-demo/.w-model/bdd-manifest.json
rm -f w-model-dev-demo/.w-model/rtm.json
rm -f w-model-dev-demo/.w-model/ingestion/graph.json
rm -rf w-model-dev-demo/.w-model/verifier-outputs/
rm -rf w-model-dev-demo/.w-model/gate-logs/
```

- [ ] **Step 2：重新产生阶段 1 产物**

按新技能定义走阶段 1（需求分析）：
- S-doc 产出 `docs/phase1-requirements/requirement-spec.md` + `docs/phase1-requirements/acceptance-test-design.md` + `docs/uat-path-mapping.md`
- A-cross 产出 `.w-model/ingestion/graph.json`（含 SD 节点）
- S-tla 产出 `tla/specs/level1/L1_*.tla` + `.w-model/tla-manifest.json`（含 @designIds 头部）
- S-ingest-tla 回填 `tla-manifest.json` 的 sdCoverage 字段
- S-bdd 产出 `features/L1/*.feature` + `.w-model/bdd-manifest.json`（含 @designIds 头部）
- S-ingest-bdd 回填 `bdd-manifest.json` 的 designCoverage 字段
- R3 → V → G（跑 check-tla-model + check-bdd-model --graph）

- [ ] **Step 3：重新产生阶段 2 产物**

按新技能定义走阶段 2（系统设计）：
- S-doc 产出 `docs/phase2-design/{module}-system-design.md` + `docs/phase2-design/{module}-system-test.md`
- A-evolve 追加 SD 节点到 graph.json
- S-tla 产出 L2 TLA+ 规格（含 @designIds）
- S-ingest-tla 回填 sdCoverage
- S-bdd 产出 L2 BDD features（含 @designIds）
- S-ingest-bdd 回填 designCoverage
- R3 → V → G

- [ ] **Step 4：后续阶段（3-8）按需产出**

按调测需要走后续阶段，验证多子系统场景下的覆盖率校验。

- [ ] **Step 5：Commit**

```bash
git add w-model-dev-demo/
git commit -m "feat: 重新产生 w-model-dev-demo（适配目录/格式/覆盖率校验新约定）"
```

---

### Task 19：端到端全门禁验证

**Files:**
- Test: 全部门禁脚本

- [ ] **Step 1：运行全部单元测试**

Run: `npx vitest run w-model-dev/scripts/__tests__/`
Expected: 全部 PASS

- [ ] **Step 2：验证 TLA+ model 校验——demo 通过**

Run: `npx tsx w-model-dev/scripts/check-tla-model.ts w-model-dev-demo/.w-model/tla-manifest.json --phase=2 --graph=w-model-dev-demo/.w-model/ingestion/graph.json`
Expected: exitCode=0

- [ ] **Step 3：验证 BDD model 校验——demo 通过**

Run: `npx tsx w-model-dev/scripts/check-bdd-model.ts w-model-dev-demo/.w-model/bdd-manifest.json --phase=2 --graph=w-model-dev-demo/.w-model/ingestion/graph.json`
Expected: exitCode=0

- [ ] **Step 4：验证终检——demo 通过**

Run: `npx tsx w-model-dev/scripts/check-artifact-gate.ts w-model-dev-demo --phase=2`
Expected: exitCode=0，输出含 "Model 校验: ✓"

- [ ] **Step 5：验证多子系统场景——故意遗漏一个子系统的 TLA+ 规格应被检出**

修改 demo 的 tla-manifest.json，删除一个子系统的 spec + 对应 sdCoverage 条目，运行 check-tla-model：

Run: `npx tsx w-model-dev/scripts/check-tla-model.ts w-model-dev-demo/.w-model/tla-manifest.json --phase=2 --graph=w-model-dev-demo/.w-model/ingestion/graph.json`
Expected: exitCode=1，输出含 "未覆盖: SD-xxx"

- [ ] **Step 6：验证 BDD 多子系统场景——故意遗漏一个子系统的 feature 应被检出**

修改 demo 的 bdd-manifest.json，删除一个子系统的 feature + 对应 designCoverage 条目，运行 check-bdd-model：

Run: `npx tsx w-model-dev/scripts/check-bdd-model.ts w-model-dev-demo/.w-model/bdd-manifest.json --phase=2 --graph=w-model-dev-demo/.w-model/ingestion/graph.json`
Expected: exitCode=1，输出含 "D8 SD Coverage" violations

- [ ] **Step 7：恢复 demo 产物**

```bash
git checkout w-model-dev-demo/
```

- [ ] **Step 8：验证目录约定——所有路径使用阶段子目录**

Run: `grep -rn "docs/system-design\.md\|docs/requirement-spec\.md\|docs/detailed-design\.md" w-model-dev-demo/docs/ w-model-dev-demo/.w-model/ w-model-dev-demo/tla/ w-model-dev-demo/features/`
Expected: 无输出（所有路径已使用阶段子目录模式）

- [ ] **Step 9：验证格式约定——所有 @design 使用冒号**

Run: `grep -rn "@design.*#" w-model-dev-demo/tla/ w-model-dev-demo/features/`
Expected: 无输出（所有 @design 已使用 :§ 冒号格式）

- [ ] **Step 10：Commit 验证记录**

```bash
git add -A
git commit -m "test: 端到端验证全部门禁通过（目录/格式/覆盖率校验）"
```

---

## 验收标准对照

| spec 验收标准 | 对应 Task |
|---------------|-----------|
| directory-conventions.md 存在且被引用 | Task 1, 13, 15, 16 |
| format-conventions.md 存在且被引用 | Task 2, 14, 15, 16 |
| 所有路径使用阶段子目录模式 | Task 13, 18 |
| 所有路径定位使用冒号分隔 | Task 11, 14, 18 |
| check-artifact-gate.ts resolvePhaseDoc 消除硬编码路径（spec §3.1.2） | Task 9 Step 5-7 |
| TLA+ manifest sdCoverage 字段 phase>=2 必填 | Task 3, 5 |
| BDD manifest designCoverage 字段 phase>=2 必填 | Task 4, 6 |
| check-tla-model.ts --graph phase>=2 强制 | Task 7 |
| check-bdd-model.ts D8 SD Coverage 维度实现 | Task 8 |
| check-artifact-gate.ts 终检调用 check-tla-model + check-bdd-model | Task 9 |
| G 标准模板强制跑 check-tla-model + check-bdd-model | Task 17 |
| S-tla/S-bdd 模板要求 @designIds 头部字段 | Task 11, 12, 17 |
| demo 重新产出并通过全部门禁 | Task 18, 19 |

---

## 执行注意事项

1. **串行执行**：Phase A-G 须按顺序执行（后置 Phase 依赖前置 Phase 的字段/类型定义）。Phase H 依赖所有前置 Phase 完成。
2. **文档修改禁止并行**：同一文件不得被多个 Task 并行修改。每个 Task 完成后须 commit 再进入下一个 Task。
3. **测试先行**：所有代码类 Task（Task 3-10）须遵循 TDD——先写失败测试，再实现，再验证通过。
4. **回归检查**：每个 Task 完成后须运行相关测试文件的全部测试，确保无回归。
5. **Demo 重产**：Task 18 由编排者按新技能定义走 W 模型流程产生，不由本计划直接编写产物文件。
