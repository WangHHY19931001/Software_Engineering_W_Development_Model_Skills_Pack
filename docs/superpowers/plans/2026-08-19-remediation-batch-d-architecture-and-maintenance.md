# 批次 D：架构与长期维护收尾实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 清理脚本层反向依赖、统一 CLI 退出行为、提供可校验的审计证据导出，并降低动态计数带来的文档高 churn。

**架构：** 将 Schema/文件类共享能力归入明确基础设施层，使 `logic` 保持领域规则；报告函数只输出而不终止进程；证据导出生成经过清理的 manifest + SHA-256；动态统计从多处手写文本迁移到单点工具输出。

**技术栈：** TypeScript ESM、Vitest、Node crypto/fs/path、JSON Schema、Git Bash。

---

## 文件结构

- 创建：`w-model-dev/scripts/infrastructure/schema-loader.ts`、`schema-fs.ts`（或在现有路径采用等价明确层名）。
- 创建：`w-model-dev/scripts/logic/dependency-boundaries.ts` 或测试辅助依赖图解析器。
- 修改：所有导入 `logic/schema-loader` 的 lib/CLI 文件。
- 修改：`w-model-dev/scripts/lib/gate-report.ts` 与默认模式调用方。
- 创建：`w-model-dev/scripts/logic/evidence-export-logic.ts`、`cli/wm-export-evidence.ts`。
- 创建：`w-model-dev/schemas/evidence-manifest.schema.json`。
- 修改：`package.json`、`docs-consistency-logic.ts`、README/AGENTS/INSTALL/SKILL/command-reference/CHANGELOG。

### 任务 D1：建立单向脚本层依赖

**文件：**
- 创建：`w-model-dev/scripts/infrastructure/schema-loader.ts`
- 创建或迁移：`w-model-dev/scripts/infrastructure/schema-fs.ts`
- 修改：`lib/load-and-validate.ts`、`lib/artifact-gate-assets.ts`、`lib/uat-path-mapping.ts`
- 修改：所有原 `logic/schema-loader` import 的 logic/CLI 文件
- 测试：创建 `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`

- [ ] **步骤 1：写失败的依赖边界测试**

测试递归读取 `scripts/{lib,logic,infrastructure,cli}` 的相对 import，构建边表。断言：无 `lib → logic` 运行时边；无循环；`logic` 不直接 import `node:fs`/`node:child_process`；基础设施可依赖 Node/Ajv。

- [ ] **步骤 2：运行测试确认失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts
```
预期：FAIL；当前存在 `lib → logic/schema-loader`、`lib → logic/gate-logic`、`lib → logic/design-contract-logic`。

- [ ] **步骤 3：确定迁移边界**

迁移 `schema-loader.ts` 与 `schema-fs.ts` 到 infrastructure；将 `artifact-gate-assets` / `uat-path-mapping` 中的领域计算抽到 `logic` 或 application service，避免 lib 依赖领域逻辑。保留兼容 re-export 仅限一个短期提交；在同一批次结束前删除 re-export，防止新 import 继续进入旧路径。

- [ ] **步骤 4：更新所有 import 与 TypeDoc 入口**

用 ESM `.js` 路径更新 imports；同步 `package.json docs:build` entry path。不得只移动文件而遗漏 CLI、tests、self-test 或 docs API 生成入口。

- [ ] **步骤 5：运行测试和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts
npm test
npm run typecheck
npm run docs:build
git add w-model-dev/scripts package.json
git commit -m "refactor(scripts): enforce one-way infrastructure dependencies"
```

### 任务 D2：统一 CLI 自然退出

**文件：**
- 修改：`w-model-dev/scripts/lib/gate-report.ts`
- 修改：默认输出路径调用该 helper 的 21 个 check CLI
- 修改：`gate-report.test.ts` 与受影响 CLI 测试

- [ ] **步骤 1：写失败测试**

给 `printGateReport` 增加可注入 exit spy 或改为纯输出函数，断言它不调用 `process.exit`；CLI 子进程测试断言默认模式和 `--json` 模式仍输出现有 `*_JSON` 协议，且 shell 观察到的退出码为 0/1/2。

- [ ] **步骤 2：运行确认失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts
```
预期：FAIL；当前 helper 直接 `process.exit(exitCode)`。

- [ ] **步骤 3：实现纯报告函数**

让 `printGateReport` 只输出并返回 summary；每个 CLI 在调用后显式设置：

```ts
process.exitCode = exitCode;
return;
```

保留 `exitWithError` 和 `runMain` 的自然退出策略。移除成功/校验失败路径的直接 `process.exit`；不更改 CLI 的 JSON 字段、前缀或退出码约定。

- [ ] **步骤 4：验证和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts
npm test
npm run typecheck
git add w-model-dev/scripts/lib/gate-report.ts w-model-dev/scripts/cli w-model-dev/scripts/__tests__
git commit -m "refactor(cli): use natural process exit for gate reports"
```

### 任务 D3：显式导出可验证审计证据

**文件：**
- 创建：`w-model-dev/schemas/evidence-manifest.schema.json`
- 创建：`w-model-dev/scripts/logic/evidence-export-logic.ts`
- 创建：`w-model-dev/scripts/cli/wm-export-evidence.ts`
- 创建：`w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`
- 修改：`package.json`、`scripts/self-test.ts`、`samples/README.md`

- [ ] **步骤 1：写失败测试**

构造临时项目 `.w-model`，含 gate log、Verifier 输出、run-log 和包含绝对路径/敏感键的 JSON。断言导出产生 manifest；每项 SHA-256 正确；路径被相对化；默认脱敏移除 `token`、`secret`、`password`、`apiKey` 字段；篡改导出文件后 verify 返回失败。

- [ ] **步骤 2：运行确认失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
```
预期：FAIL；功能尚不存在。

- [ ] **步骤 3：定义 manifest Schema 与导出逻辑**

manifest 至少含：

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "ISO-8601",
  "sourceProject": "relative-or-redacted",
  "files": [{ "path": "...", "sha256": "...", "kind": "gate-log" }]
}
```

导出只允许白名单目录：`gate-logs`、`verifier-outputs`、`signature-chains`、`codegraph-queries`、`run-log`。默认递归脱敏 JSON；非 JSON 只复制白名单文本。拒绝源路径逃逸、输出目录位于源 `.w-model` 内、符号链接逃逸。

- [ ] **步骤 4：实现 CLI 与验证模式**

命令：

```bash
npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts <project-dir> <output-dir>
npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json
```

输出 `EVIDENCE_EXPORT_JSON`，采用 0/1/2 退出语义。加入 `package.json` script `wm:export-evidence`。

- [ ] **步骤 5：运行测试和提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
npm test
npm run typecheck
git add w-model-dev/schemas/evidence-manifest.schema.json w-model-dev/scripts/logic/evidence-export-logic.ts w-model-dev/scripts/cli/wm-export-evidence.ts w-model-dev/scripts/__tests__ package.json
git commit -m "feat(evidence): export sanitized verifiable runtime records"
```

### 任务 D4：收敛动态计数与本地生成物说明

**文件：**
- 修改：`docs-consistency-logic.ts`、`check-docs-consistency.ts`
- 修改：`README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md`
- 修改：`w-model-dev/SKILL.md`、`references/command-reference.md`
- 测试：`docs-consistency-logic.test.ts`

- [ ] **步骤 1：写失败测试**

测试 docs-consistency 将“静态规范”与“动态统计”报告为不同类型；测试 README/AGENTS 明确声明 `.w-model`、`.zcode`、`coverage` 是本地忽略生成物，`docs/changes/archive` 是受控跟踪归档。

- [ ] **步骤 2：运行确认失败**

运行 docs consistency 测试，预期 FAIL：当前报告未分层，coverage/.zcode 无导航声明。

- [ ] **步骤 3：拆分动态统计报告**

保持现有兼容总报告，但追加：

```json
{
  "staticViolations": [],
  "dynamicMeasurements": {
    "schemaCount": 0,
    "testFileCount": 0,
    "vitestTestCount": 0
  }
}
```

只在权威文档保留必要动态数字；删除或改写其他文档中无消费者的重复计数。不要删除 AGENTS/README 中被 gate 明确解析的计数，先修改 gate 以从单一声明来源读取。

- [ ] **步骤 4：更新文档和导出说明**

README/AGENTS 说明 `.w-model` 默认不跟踪、要交付证据时运行 `wm:export-evidence`；说明 coverage/.zcode 本地性及其不应强制提交。INSTALL/CONTRIBUTING 写明导出证据的审阅与脱敏责任。

- [ ] **步骤 5：全量验收和提交**

```bash
npm run check:docs-consistency
npm test
npm run typecheck
npm run check:gate -- --validate-templates
npm run prepush
git add w-model-dev/scripts README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md w-model-dev/SKILL.md w-model-dev/references CHANGELOG.md
git commit -m "docs: document local artifacts and evidence export"
```

### 任务 D5：批次 D 与项目最终验收

- [ ] **步骤 1：运行依赖边界和证据导出直接验证**

```bash
npx vitest run --config config/vitest.config.ts \
  w-model-dev/scripts/__tests__/dependency-boundaries.test.ts \
  w-model-dev/scripts/__tests__/evidence-export-logic.test.ts \
  w-model-dev/scripts/__tests__/gate-report.test.ts
```

- [ ] **步骤 2：运行所有全局命令**

```bash
npm run self-test
npm test
npm run typecheck
npm run check:docs-consistency
npm run check:gate -- --validate-templates
npm run prepush
git status --short
```

预期：所有命令成功；工作树仅含本计划范围内未提交变更，最终提交后为空。

- [ ] **步骤 3：验证已证实问题的最终证据**

执行并保存：竞争写锁测试、`ensure-platform-deps --check` 缺依赖失败模拟、pre-push config/scripts 路径触发模拟、四 Persona fixture CLI、SSoT 链接扫描、docs-consistency 无 Vitest 计数失败场景、证据导出与篡改验证。

- [ ] **步骤 4：完成提交**

```bash
git add CHANGELOG.md docs/superpowers/specs/2026-08-19-all-findings-remediation-design.md docs/superpowers/plans
git commit -m "chore: complete audit remediation plan"
```
