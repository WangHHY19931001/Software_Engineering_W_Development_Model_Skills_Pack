# Batch P2 实施计划：运行时校验 / 格式统一 / 覆盖率 / 用户文档 / 文档站点 / 模板扩充 / Workspace / 示例扩充 / 版本维持

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 P2 级 9 项修正（C1 运行时校验统一封装 / C2 格式统一 / C3 覆盖率入 pre-push / C4 用户文档 / C5 文档站点 / C6 templates 扩充 / C7 npm Workspace / C8 examples 扩充 / C9 版本机制维持）。

**Architecture:** 前置依赖 Batch P0+P1 完成。本批为优化层，全部为增量改动，不涉及 scripts 重组。遵循 spec（`docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md` §4）。

**Tech Stack:** TypeScript (strict, ESM)、AJV（沿用不新增 zod）、prettier + eslint import/order、vitest coverage、docsify、npm workspaces、Node 20。

---

## Task 1: C1 运行时校验统一封装（沿用 AJV）

**Files:**
- Create: `w-model-dev/scripts/lib/load-and-validate.ts`
- Modify: `w-model-dev/scripts/lib/read-json-or-exit.ts`（可选复用）

- [ ] **Step 1: 封装 loadAndValidate**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { exitWithError } from './cli-error.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '..', 'schemas'); // scripts/lib/ → w-model-dev/schemas/

/** 统一「读取 → JSON 解析 → schema 校验」；失败抛 CliError（含 file/rule/field） */
export function loadAndValidate<T>(filePath: string, schemaKey: string): T {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    exitWithError({ category: 'FILE_NOT_FOUND', message: `无法读取工件`, file: filePath, rule: 'P0-2', exitCode: 2 });
    return undefined as never;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    exitWithError({ category: 'FILE_PARSE', message: `JSON 解析失败`, file: filePath, field: schemaKey, exitCode: 2 });
    return undefined as never;
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${schemaKey}.schema.json`), 'utf-8'));
  const validate = ajv.compile(schema);
  if (!validate(parsed)) {
    const first = validate.errors?.[0];
    exitWithError({
      category: 'STRUCTURE_INVALID',
      message: `schema 校验失败: ${first?.message ?? 'unknown'}`,
      file: filePath,
      field: first?.instancePath ?? schemaKey,
      exitCode: 2,
    });
    return undefined as never;
  }
  return parsed as T;
}
```
注：`SCHEMA_DIR` 用 `scripts/lib/` 相对 `w-model-dev/schemas/`（重组后 lib 深度为 `w-model-dev/scripts/lib/`，`../..` 到 `w-model-dev/`）。

- [ ] **Step 2: 迁移试点调用点**

选择 2-3 个 check-*.ts 中「readFileSync + JSON.parse + AJV 校验」样板替换为 `loadAndValidate`（如 check-budget、check-run-log）。**仅替换样板，不改变行为**。

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit; npx vitest run; npx tsx w-model-dev/scripts/cli/self-test.ts`
```bash
git add w-model-dev/scripts/lib w-model-dev/scripts/cli
git commit -m "refactor(io): unify read+parse+schema-validate into loadAndValidate (AJV)"
```

## Task 2: C2 格式统一（import/order + Prettier + .editorconfig）

**Files:**
- Modify: `config/.eslintrc.cjs`（加 import/order）
- Create: `config/prettier.config.cjs`
- Create: `.editorconfig`
- Modify: `package.json`（prettier devDep + script）

- [ ] **Step 1: ESLint 增加 import/order**

`config/.eslintrc.cjs` 增加：
```js
plugins: ['@typescript-eslint', 'security', 'import'],
extends: [ 'eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:security/recommended' ],
rules: {
  ...existing,
  'import/order': ['warn', { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'newlines-between': 'always' }],
},
```
Run: `npm install -D eslint-plugin-import prettier`

- [ ] **Step 2: Prettier 配置**

`config/prettier.config.cjs`：
```js
module.exports = { semi: true, singleQuote: true, printWidth: 120, trailingComma: 'all' };
```
package.json 新增 `"format": "prettier --config config/prettier.config.cjs --write \"w-model-dev/scripts/**/*.ts\""`。

- [ ] **Step 3: .editorconfig**

根目录创建 `.editorconfig`：
```ini
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 4: 全仓格式化 + 回归**

Run: `npm run format; npx tsc --noEmit; npx vitest run; npx tsx w-model-dev/scripts/cli/self-test.ts`
Expected: 格式化后全部通过（若格式化改变了 self-test 样本匹配文本导致失败，回退对应文件并记录）。

- [ ] **Step 5: Commit**

```bash
git add config .editorconfig package.json package-lock.json w-model-dev/scripts
git commit -m "style: enforce import order, prettier formatting and editorconfig"
```

## Task 3: C3 覆盖率阈值入 pre-push

**Files:**
- Modify: `config/vitest.config.ts`（coverage 阈值）
- Modify: `.githooks/pre-push`（第 12 项升级）

- [ ] **Step 1: vitest coverage 阈值**

`config/vitest.config.ts`：
```ts
export default {
  test: {
    include: ['../w-model-dev/scripts/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['../w-model-dev/scripts/logic/**', '../w-model-dev/scripts/lib/**'],
      thresholds: { statements: 80, branches: 75, functions: 85, lines: 80 },
    },
  },
};
```
（阈值以执行时基线为参考，若现有覆盖率不足则先记录实际值再设定不低于实际值的阈值。）

- [ ] **Step 2: pre-push 第 12 项升级**

将 pre-push 的 vitest 检查从 `vitest run` 升级为 `vitest run --coverage --config config/vitest.config.ts`，失败即阻断。

- [ ] **Step 3: 验证 + Commit**

Run: `npx vitest run --coverage --config config/vitest.config.ts; npm run prepush`
```bash
git add config/vitest.config.ts .githooks/pre-push
git commit -m "ci(pre-push): enforce vitest coverage thresholds"
```

## Task 4: C4 用户文档（user-guide + troubleshooting）

**Files:**
- Create: `docs/user-guide.md`
- Create: `docs/troubleshooting.md`

- [ ] **Step 1: user-guide.md**

内容：常见校验失败排查思路（按退出码分类：0/1/2）、规则依据（链接 references/anti-patterns.md）、修复建议、依赖巡检流程（人工 `npm audit` + `npm outdated`，替代 Dependabot——spec 决策记录）。

- [ ] **Step 2: troubleshooting.md**

内容：FAQ（Windows 非 Git Bash 执行钩子报错 → 用 Git Bash / WSL；`--no-verify` 契约声明；node_modules 缺失；eslint baseline 指纹失效重生成）、环境问题矩阵。

- [ ] **Step 3: README「相关文档」补链接 + Commit**

```bash
git add docs README.md
git commit -m "docs(user): add user-guide and troubleshooting reference docs"
```

## Task 5: C5 文档站点（Docsify）

**Files:**
- Create: `docs/index.html`、`docs/_sidebar.md`
- Modify: `package.json`（`docs:site` script）

- [ ] **Step 1: Docsify 入口**

`docs/index.html`：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>W-Model Skills</title>
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css">
</head>
<body><div id="app"></div>
<script src="//cdn.jsdelivr.net/npm/docsify@4/lib/docsify.min.js"></script>
</body></html>
```

- [ ] **Step 2: 侧边栏**

`docs/_sidebar.md`：
```markdown
- [首页](README.md)
- [用户指南](user-guide.md)
- [排障手册](troubleshooting.md)
- [归档索引](changes/archive/INDEX.md)
```

- [ ] **Step 3: package.json 加 docs:site**

```json
"docs:site": "docsify serve docs"
```
Run: `npx docsify-cli serve docs`（本地预览验证；docsify-cli 为 devDep）

- [ ] **Step 4: Commit**

```bash
git add docs package.json package-lock.json
git commit -m "docs(site): add docsify entry and sidebar for browsable docs"
```

## Task 6: C6 templates 扩充（缺口补齐）

**Files:** Create（仅缺口文件，spec T1）：
- `w-model-dev/templates/coding.md`
- `w-model-dev/templates/integration-test.md`
- `w-model-dev/templates/acceptance-test.md`
- JSON 模板：`w-model-dev/templates/budget.template.json`、`w-model-dev/templates/run-log.template.jsonl`（示例）

- [ ] **Step 1: 3 份 Markdown 模板**

参照现有 `system-test.md` 结构编写 coding.md / integration-test.md / acceptance-test.md（含标题、DoD 引用、SSoT 头部示例）。**勿重复创建已存在的 system-test.md 等**（spec T1）。

- [ ] **Step 2: JSON 模板示例**

`budget.template.json` / `run-log.template.jsonl`：按 `w-model-dev/schemas/budget.schema.json` / `run-log.schema.json` 字段编写最小合法示例，头部注释标注 schema 路径。

- [ ] **Step 3: SKILL.md 增加模板使用说明 + Commit**

SKILL.md 引用 templates/ 目录并说明各模板用途。
```bash
git add w-model-dev/templates w-model-dev/SKILL.md
git commit -m "feat(templates): add phase 5-8 markdown and JSON artifact templates"
```

## Task 7: C7 npm Workspace（含版本机制冲突处理）

**Files:**
- Create: `w-model-dev/package.json`
- Modify: `package.json`（根，加 workspaces）

- [ ] **Step 1: 新建 w-model-dev/package.json（不含 version）**

```json
{
  "name": "w-model-dev",
  "private": true,
  "type": "module",
  "description": "W-Model skill assets (scripts/logic/schemas/references) — workspace child"
}
```
**不得声明 version 字段**（spec T5：避免第四处 version 破坏 skill-metadata.test.ts 三地方程式）。

- [ ] **Step 2: 根 package.json 加 workspaces**

```json
"workspaces": ["w-model-dev"]
```

- [ ] **Step 3: 重新生成 lockfile 并验证**

Run:
```bash
npm install   # 重写 package-lock.json
npm run self-test; npm run prepush
```
Expected: 全部通过。**额外验证（spec R10/T5）**：确认 `createRequire(import.meta.url)('typescript')` 在 workspace 提升后仍可解析；若失败，在 w-model-dev/package.json devDependencies 显式声明 typescript。
**版本三地方程式验证**：`npx vitest run w-model-dev/scripts/__tests__/skill-metadata.test.ts` 必须通过（若 npm 强制 w-model-dev/package.json 含 version，则扩展 skill-metadata.test.ts 为四地校验并联动 docs-consistency 计数）。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/package.json package.json package-lock.json
git commit -m "chore(workspace): convert repo to npm workspaces with w-model-dev child"
```

## Task 8: C8 examples 扩充（8 阶段完整流程）

**Files:** Create（增量，勿改现有 4 份）：
- `w-model-dev/examples/stage1-requirement-analysis.md`
- `w-model-dev/examples/stage5-coding.md`
- `w-model-dev/examples/stage6-integration-test.md`
- `w-model-dev/examples/stage7-system-test.md`
- `w-model-dev/examples/stage8-acceptance-test.md`

- [ ] **Step 1: 编写阶段示例**

参照现有 `requirement-analysis.md` / `coding.md` / `system-design.md` / `test-execution.md` 的格式，为缺失阶段补充示例：每份含阶段目标、输入工件清单、调用的 check 脚本、命令行、预期输出。

- [ ] **Step 2: 编排流程总览示例**

新增 `w-model-dev/examples/README.md`：8 阶段编排流程导览，说明各阶段示例如何串联执行。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/examples
git commit -m "docs(examples): add stage 1/5/6/7/8 orchestration examples"
```

## Task 9: C9 版本机制维持（验证）

**Files:** 无改动（验证 + 记录）

- [ ] **Step 1: 验证三地方程式**

Run: `npx vitest run w-model-dev/scripts/__tests__/skill-metadata.test.ts`
Expected: 3+1 用例全过（根 package.json / SKILL.md frontmatter / skill-metadata.json 一致）。

- [ ] **Step 2: 记录「维持」结论**

在 CHANGELOG P2 批次条目中注明：版本机制维持现有人工三地方程式，未引入自动化版本发布（semantic-release 已剔除，spec 决策记录）。

## Task 10: Batch P2 收尾回归

- [ ] **Step 1: 全量门禁 + CHANGELOG**

Run: `npm run prepush`
Expected: 14 项全过。
CHANGELOG.md 追加 P2 批次条目（C1-C9）。

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record batch P2 fixes"
```

- [ ] **Step 2: 三批终检**

对照 [spec](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md) 第 5 节回归表逐项确认：self-test 全过（样本数 ≥ 基线）、vitest 35 files 全过、tsc 0 错误、docs-consistency exit 0、security-scan baseline 一致、prepush 14 项通过。**记录最终回归结果到 spec 第 7 节交付物。**
