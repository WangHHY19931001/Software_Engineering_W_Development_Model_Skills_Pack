# 批次 B：门禁与运行时证据闭环实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让运行时状态、gate log、文档一致性、同步子进程与 TLA/BDD 门禁拥有明确且 fail-closed 的验证边界。

**架构：** 使用目标路径到 Schema 的注册表驱动状态写校验；gate log 采用专用 Schema 与 append-only 原子写；动态测试数量采集失败成为违规；同步子进程使用集中 timeout；文档清晰区分项目阶段门和仓库回归门。

**技术栈：** TypeScript、Ajv draft-07、Vitest、Node child_process、JSON/JSONL。

---

## 文件结构

- 创建：`w-model-dev/schemas/gate-log.schema.json` — gate log 的 draft-07 Schema。
- 创建：`w-model-dev/scripts/lib/state-schema-registry.ts` — 路径到 Schema 的唯一注册表。
- 修改：`w-model-dev/scripts/lib/gate-log-writer.ts` — Schema 校验、原子 append-only 写与显式错误。
- 修改：`w-model-dev/scripts/logic/state-write-logic.ts` — 使用批次 A 建立的锁内 Schema 校验。
- 修改：`w-model-dev/scripts/cli/wm-write.ts` — 未注册目标和 JSONL 输入的 CLI 行为。
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`cli/check-docs-consistency.ts` — Vitest 采集失败 fail-closed、SSoT 链接输入。
- 创建：`w-model-dev/scripts/lib/run-sync.ts` — 同步子进程统一选项。
- 修改：`artifact-gate-assets.ts`、相关测试 CLI 测试文件。
- 修改：`SKILL.md`、`references/bdd-guide.md`、`references/tla-plus-guide.md`、`references/command-reference.md`、`AGENTS.md`。

### 任务 B1：gate log Schema 与原子追加

**文件：**
- 创建：`w-model-dev/schemas/gate-log.schema.json`
- 修改：`w-model-dev/scripts/lib/gate-log-writer.ts`
- 修改：`w-model-dev/scripts/__tests__/gate-log-writer.test.ts`
- 修改：`w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **步骤 1：写失败测试**

新增测试：合法 payload 产生可验证 gate log；缺 `script`/非法 `exitCode` 被拒绝；不可写目录返回结构化失败而非 `undefined`；同毫秒两次写产生不同文件名；目标目录无 `.tmp` 残留。

- [ ] **步骤 2：运行测试确认失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
```
预期：FAIL；目前 writer 吞异常且无 Schema。

- [ ] **步骤 3：定义 gate-log Schema**

Schema 使用 `$schema` draft-07、`additionalProperties:false`，规定 `script` 非空字符串、`exitCode` 为 0/1/2、`passed` 布尔值、`reasons` 字符串数组、`reportSummary` 对象。允许由现有三个调用方所需的可选上下文字段，但必须逐字段定义 description。

- [ ] **步骤 4：实现 append-only 原子 writer**

把 `writeGateLog` 返回类型改为：
```ts
export type GateLogWriteResult = { ok: true; path: string } | { ok: false; error: string };
```
先 `validateBySchema('gate-log', payload)`；使用 `timestamp + randomUUID()` 文件名、`tmp + rename`；失败返回 `ok:false`，不得 catch 后静默成功。更新 BDD/iceberg/preventive 调用方，把写错误放入其报告摘要并让 G/O 可追踪。

- [ ] **步骤 5：运行测试和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
npm test
npm run typecheck
git add w-model-dev/schemas/gate-log.schema.json w-model-dev/scripts/lib/gate-log-writer.ts w-model-dev/scripts/__tests__
git commit -m "feat(gate): validate and atomically persist gate logs"
```

### 任务 B2：状态目标 Schema 注册与写时校验

**文件：**
- 创建：`w-model-dev/scripts/lib/state-schema-registry.ts`
- 修改：`state-write-logic.ts`、`wm-write.ts`
- 测试：`state-write-logic.test.ts`、`wm-write.test.ts`

- [ ] **步骤 1：写失败测试**

测试 `project.json` 写入额外字段时返回 `SCHEMA_INVALID`；合法 project fixture 通过；未注册 `.w-model/custom.json` 默认拒绝 `UNREGISTERED_TARGET`；带 `--allow-untyped` 时允许并输出显式标记；JSONL `run-log.jsonl` 中任一不合法行被拒绝并报告行号。

- [ ] **步骤 2：运行测试确认失败**

运行 state write/CLI 定向测试，预期 FAIL：当前只做 parseJsonSafe。

- [ ] **步骤 3：实现注册表和校验接口**

`state-schema-registry.ts` 导出：
```ts
export type RegisteredStateFormat = 'json' | 'jsonl';
export interface RegisteredStateSchema { relativePath: string; schemaName: string; format: RegisteredStateFormat; }
export function resolveStateSchema(absPath: string, projectRoot: string): RegisteredStateSchema | null;
```
注册 `project.json`、`rtm.json`、`budget.json`、`maturity.json`、`run-log.jsonl` 及实际有运行契约的其他状态。`writeStateJson` 在批次 A 锁内调用该注册表和 `validateBySchema`；新增 reason `SCHEMA_INVALID`、`UNREGISTERED_TARGET`。

- [ ] **步骤 4：接入或处置未消费 Schema**

对 `checkpoint-log`、`event-ingress`、`hill-climbing-report`、`project`：为有 CLI 的对象建立读写入口并接入校验；若没有任何运行时输入，删除 Schema、更新 schema 列表及样本，而不是保留“仅 self-test”资产。

- [ ] **步骤 5：运行测试和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
npm test
npm run typecheck
git add w-model-dev/scripts/lib/state-schema-registry.ts w-model-dev/scripts/logic/state-write-logic.ts w-model-dev/scripts/cli/wm-write.ts w-model-dev/scripts/__tests__ w-model-dev/schemas
git commit -m "feat(state): validate registered state payloads before commit"
```

### 任务 B3：docs-consistency 计数 fail-closed 与 SSoT 链接输入

**文件：**
- 修改：`docs-consistency-logic.ts:64-188`
- 修改：`cli/check-docs-consistency.ts:205-359`
- 修改：`docs-consistency-logic.test.ts`

- [ ] **步骤 1：写失败测试**

新增断言：`vitestTestCount=-1` 时产生 `[vitest-tests]` violation；linkDocs 中的 SSoT 断链产生 `[internal-link]` violation；传入有效 725 值时无 violation。

- [ ] **步骤 2：运行定向测试确认失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
```
预期：FAIL；当前 `-1` 被跳过、SSoT 未注入 linkDocs。

- [ ] **步骤 3：实现 fail-closed 和输入覆盖**

将 `DocConsistencyInput.vitestTestCount` 注释改为“不允许 -1”；`checkVitestTestCount` 在负数时产生 violation。保留 pre-push 的 `WM_VITEST_COUNT_FILE` 快路径，但普通运行必须 spawn 成功，否则 exit 1。将 `{ name:'docs/skill-design-document_SSoT.md', baseDir:'docs' }` 加入 `linkDocs`。

- [ ] **步骤 4：运行 CLI 回归**

```bash
npm run check:docs-consistency
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
```
预期：在批次 C 修复断链前，当前仓库应因 SSoT 三个断链 exit 1；将此结果记录为预期跨批次红灯，不要绕过。

- [ ] **步骤 5：提交**

```bash
git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "fix(gate): fail closed when document test evidence is unavailable"
```

### 任务 B4：同步子进程 timeout 帮助器

**文件：**
- 创建：`w-model-dev/scripts/lib/run-sync.ts`
- 修改：`artifact-gate-assets.ts`
- 修改：`__tests__/gate-report.test.ts`、`metrics-report.test.ts`、`wm-status.test.ts`、`artifact-gate-assets.test.ts`

- [ ] **步骤 1：写失败测试**

测试 helper 将 `timeout`、`killSignal:'SIGKILL'`、`encoding:'utf-8'`、`maxBuffer` 传给 spawnSync；测试每个上述调用点使用 helper 或显式同等 options。

- [ ] **步骤 2：运行确认失败**

运行相关测试，预期 FAIL：helper 尚不存在，调用点无 timeout。

- [ ] **步骤 3：实现 helper 并迁移调用点**

导出：
```ts
export const DEFAULT_SYNC_TIMEOUT_MS = 15_000;
export function runSync(command: string, args: string[], options: SpawnSyncOptions = {}): SpawnSyncReturns<string>;
```
强制默认 timeout、maxBuffer、encoding，允许 TLA 调用明确覆盖更长 timeout。迁移真实子进程和测试 helper。

- [ ] **步骤 4：验证和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/__tests__/metrics-report.test.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts
npm test
npm run typecheck
git add w-model-dev/scripts/lib/run-sync.ts w-model-dev/scripts/lib/artifact-gate-assets.ts w-model-dev/scripts/__tests__
git commit -m "fix(test): bound synchronous child process execution"
```

### 任务 B5：明确 TLA/BDD 项目阶段门边界

**文件：**
- 修改：`w-model-dev/SKILL.md:205-227`
- 修改：`references/tla-plus-guide.md`、`references/bdd-guide.md`、`references/command-reference.md`
- 修改：`.githooks/pre-push`
- 测试：BDD/TLA CLI 测试和 docs-consistency 测试

- [ ] **步骤 1：写失败测试/文档断言**

断言 hook 注释不宣称自身直接执行 TLA/TLA-BDD；断言阶段 1-4 的 required maturity 输入缺 `--tla-manifest` 时 BDD D4 产生 violation；阶段 5-8 要求 cucumber 时缺报告产生 violation。

- [ ] **步骤 2：运行确认失败**

运行 BDD/TLA 定向测试，预期现有可选跳过路径导致 FAIL。

- [ ] **步骤 3：实现显式模式参数**

为 `check-bdd-model` 增加明确 `--require-tla-equivalence` 与 `--require-cucumber-report`；阶段门调用这些参数，pre-push fixture 不启用项目强制模式。更新 SKILL、指南和 hook 注释说明双层边界。

- [ ] **步骤 4：验证批次 B**

```bash
npm test
npm run typecheck
npm run check:docs-consistency
npm run check:gate -- --validate-templates
npm run prepush
```
在批次 C 未修 SSoT 前，docs-consistency 的断链失败必须作为已知依赖记录；批次 B 不以伪造放行结束。

- [ ] **步骤 5：提交**

```bash
git add w-model-dev/SKILL.md w-model-dev/references .githooks/pre-push w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/__tests__
git commit -m "docs(gate): distinguish project behavior gates from pre-push regression"
```
