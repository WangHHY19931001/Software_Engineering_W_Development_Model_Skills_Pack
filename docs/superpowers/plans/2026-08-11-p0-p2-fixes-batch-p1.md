# Batch P1 实施计划：violations 结构化 / 注释 / 常量 / baseline / --json / audit / API 文档 / 归档索引 / 配置迁移 / 钩子 / 协作模板

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 P1 级 11 项修正（A2b structuredViolations 双轨 / B1 注释 / B2 常量与类型 / B3 baseline 维持 / B4 --json / B5 audit 阻断 / B6 API 文档 / B7 归档索引 / B8 配置迁移 / B9 钩子体验 / B10 协作模板）。

**Architecture:** 前置依赖 Batch P0 完成（scripts 已重组为 cli/logic/lib）。所有 *-logic.ts 现位于 `w-model-dev/scripts/logic/`、check-*.ts 位于 `w-model-dev/scripts/cli/`、工具位于 `w-model-dev/scripts/lib/`。本批全部遵循 spec（`docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md` §3）。

**Tech Stack:** TypeScript (strict, ESM)、tsx、vitest、eslint 8 (.eslintrc.cjs)、typedoc（devDep）、Node 20。

---

## Task 1: A2b structuredViolations 双轨过渡

**Files:**
- Modify: `w-model-dev/scripts/logic/*-logic.ts`（新增违规点）
- Modify: `w-model-dev/scripts/cli/check-*.ts`（输出优先读 structuredViolations）

- [ ] **Step 1: 定义双轨结构类型（依赖 Task 2 的 types.ts）**

本任务依赖 Task 2（B2）Step 2 建立的 `lib/types.ts`。**执行顺序：先做 Task 2 的 Step 2 建立 types.ts，再回到本任务 Step 2 落地双轨写违规。** 类型定义（Task 2 中落地，此处为引用确认）：

```ts
/** 结构化违规项：rule 为规则链（如 'P0-1' / 'R1-R5' / 'D7'），field 为字段位置 */
export interface StructuredViolation {
  rule: string;
  field?: string;
  message: string;
}
```

- [ ] **Step 2: logic 层双轨写违规**

对本次涉及修改的 logic 函数（B1 涉及的两个文件为试点），返回类型使用 `lib/types.ts` 的 `GateCheckResult`，在新增/修改违规时：

```ts
import type { GateCheckResult } from '../lib/types.js';
// 构造结果时（新增违规）：
result.violations.push(msg);
result.structuredViolations!.push({ rule: 'R1-R5', field: 'entry.detail[0]', message: msg });
```
**范围约束（spec A2b）**：仅对本次修改的违规点采用双轨；历史违规点 `violations: string[]` 保持不动，避免 self-test 的 `expectedReasonPatterns` 匹配回归。

- [ ] **Step 3: check-*.ts 输出优先读 structuredViolations**

```ts
const outReasons = r.structuredViolations?.map((v) => v.message) ?? r.violations;
```
（人类可读输出与 `--json` 输出（B4）均使用 outReasons。）

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit; npx vitest run; npx tsx w-model-dev/scripts/cli/self-test.ts`
```bash
git add w-model-dev/scripts
git commit -m "feat(violations): add structuredViolations dual-track with backward-compatible string[]"
```

## Task 2: B2 全局常量与复用类型

**Files:**
- Create: `w-model-dev/scripts/lib/constants.ts`
- Create: `w-model-dev/scripts/lib/types.ts`

- [ ] **Step 1: 建立 constants.ts**

从各 logic/check 文件收集重复定义，收敛为：

```ts
/** RTM 追溯字段（SSoT：references/data-models.md） */
export const RTM_FIELDS = ['id', 'reqId', 'description', 'artifactRefs', 'status'] as const;

/** 阶段枚举（SSoT：SKILL.md 8 阶段） */
export const PHASES = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type Phase = (typeof PHASES)[number];

/** 门禁退出码语义 */
export const EXIT_OK = 0;
export const EXIT_VIOLATION = 1;
export const EXIT_INPUT_ERROR = 2;

/** 工件相对路径（.w-model 下） */
export const ARTIFACT_PATHS = {
  rtm: '.w-model/rtm.json',
  tlaManifest: '.w-model/tla-manifest.json',
  bddManifest: '.w-model/bdd-manifest.json',
} as const;
```
注：若某常量已存在于 `lib/phase-doc-map.ts`（A1 产物），改为 re-export 而非重复定义。

- [ ] **Step 2: 建立 types.ts**

```ts
import type { Phase } from './constants.js';
export interface StructuredViolation { rule: string; field?: string; message: string; }
export interface GateCheckResult { passed: boolean; violations: string[]; structuredViolations?: StructuredViolation[]; }
export interface JsonReport { type: string; passed: boolean; reasons: string[]; violations: { rule: string; count: number }[]; durationMs: number; }
```

- [ ] **Step 3: 迁移调用点**

将各 check-*.ts / *-logic.ts 中已识别为重复定义的常量改为 `import { ... } from '../lib/constants.js'`（或 `./constants.js`，logic 层用 `../lib/constants.js`）。**保守原则**：仅替换语义完全一致的常量，不做名称重构。

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit; npx vitest run; npm run check:docs-consistency`
```bash
git add w-model-dev/scripts/lib
git commit -m "refactor(constants): centralize shared constants and types in lib/"
```

## Task 3: B1 复杂逻辑注释

**Files:**
- Modify: `w-model-dev/scripts/logic/code-tla-logic.ts`
- Modify: `w-model-dev/scripts/logic/tla-bdd-sync-logic.ts`

- [ ] **Step 1: code-tla-logic.ts 四维度判定块注释**

在 SD→codeModule 映射一致性判定函数上方添加块注释，说明：设计依据（SSoT references/verifier-spec.md 相关节）、四个维度（module 存在 / assignment / assertion / next 覆盖）、边界处理（无 codeModule 时视为违规而非跳过）。

- [ ] **Step 2: tla-bdd-sync-logic.ts 状态机同步注释**

在 TLA+ 与 BDD 状态机同步函数上方添加块注释：状态集合提取规则、transition 对齐判定、边界（BDD feature 缺失 transition 时以 TLA+ 为基准）。

- [ ] **Step 3: 规则常量注释**

为函数内魔数 / 枚举常量补充行注释，标明对应反模式编号（如 `// 对应反模式 D8：SD 未覆盖 UAT 路径`）。

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit; npx vitest run`
```bash
git add w-model-dev/scripts/logic
git commit -m "docs(logic): document code-tla and tla-bdd-sync design rationale"
```

## Task 4: B3 安全 baseline 维持回归检查

**Files:**
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`
- Modify: `w-model-dev/scripts/cli/security-scan.ts`（若需补充新规则）

- [ ] **Step 1: docs-consistency 增加 baseline 同步检查**

在 docs-consistency-logic.ts 增加检查：`scripts/**` 下 `.ts` 文件变更时（以 git diff 判断），`.eslintsecurity-baseline.json` 必须存在且非空（sha256 指纹文件）。实现为新增 DocCheckViolation 项 `baseline-sync`。

- [ ] **Step 2: 验证 baseline 可重生成**

Run: `npx tsx w-model-dev/scripts/cli/security-scan.ts`
Expected: exit 0（baseline 匹配）。若报「指纹格式需重生成」，按脚本提示执行重生成并确认 baseline diff 合理。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts
git commit -m "feat(docs-consistency): enforce security baseline sync on scripts changes"
```

## Task 5: B4 可观测性 --json 输出

**Files:**
- Modify: `w-model-dev/scripts/lib/gate-report.ts`
- Modify: 各 `w-model-dev/scripts/cli/check-*.ts`（加 `--json` 选项）

- [ ] **Step 1: gate-report.ts 支持 JSON 报告**

新增函数（不破坏现有 `printGateReport` 签名）：

```ts
import type { JsonReport } from './types.js';

/** 输出机器可读 JSON 报告（--json 选项用），不打印分隔线，exitCode 由调用方处理 */
export function printJsonReport(report: JsonReport, exitCode: number): void {
  console.log(JSON.stringify({ ...report, exitCode }));
}
```

- [ ] **Step 2: check-*.ts 支持 --json 参数**

在每个 check-*.ts 的参数解析中识别 `--json`，置 `jsonMode = true`；汇总结果时构造 `JsonReport`（type/passed/reasons/violations 分布/durationMs），用 `printJsonReport` 输出；默认路径仍走 `printGateReport` 人类可读输出。

- [ ] **Step 3: 验证**

Run:
```bash
npx tsx w-model-dev/scripts/cli/check-run-log.ts --json .w-model/run-log.jsonl 2>&1 | Out-String
```
Expected: 输出 JSON 对象（含 type/passed/reasons/violations/durationMs/exitCode），无分隔线。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts
git commit -m "feat(observability): add --json machine-readable report option to check scripts"
```

## Task 6: B5 npm audit 阻断升级

**Files:** `.githooks/pre-push`

- [ ] **Step 1: 第 13 项 audit 由 warn-only 升级为阻断**

修改 pre-push 第 13 项（约 L208-217）：`local_audit_code != 0` 时从 warn 改为 **fail**（追加到 violations，最终退出码非 0）。保留网络不可达的跳过逻辑：

```bash
# 13. npm audit：依赖漏洞扫描（high 以上阻断；网络不可达自动跳过）
log "npm audit 依赖漏洞扫描（high 以上阻断）..."
npm audit --audit-level=high >"$tmp_log" 2>&1
local_audit_code=$?
if [ "$local_audit_code" -eq 0 ]; then
  ok "npm audit 未发现 high 以上漏洞"
elif [ "$local_audit_code" -eq 255 ] || [ "$local_audit_code" -eq 1 ] && grep -qiE "ENOTFOUND|ETIMEDOUT|network" "$tmp_log"; then
  warn "npm audit 网络不可达，跳过（不阻断）"
else
  fail "npm audit 发现 high 以上漏洞或执行失败（返回码 $local_audit_code）"
fi
```

- [ ] **Step 2: 验证**

Run: `npm run prepush`
Expected: audit 项通过（若本地网络可用且无 high 漏洞）；README「CI 策略」同步说明 audit 已升级为阻断。

- [ ] **Step 3: Commit**

```bash
git add .githooks/pre-push README.md
git commit -m "ci(pre-push): block on npm audit high severity (network-unreachable skip)"
```

## Task 7: B6 API 文档（TypeDoc）

**Files:**
- Modify: `package.json`（新增 devDep `typedoc`、script `docs:build`）
- Modify: 各 `w-model-dev/scripts/cli/check-*.ts`（头部 JSDoc 补全）

- [ ] **Step 1: 安装 TypeDoc**

Run: `npm install -D typedoc`

- [ ] **Step 2: package.json 新增 docs:build**

```json
"docs:build": "typedoc --out docs/api w-model-dev/scripts/cli w-model-dev/scripts/logic --entryPointStrategy expand --excludeNotDocumented"
```
在 scripts 中按「工具类」分组放置。

- [ ] **Step 3: 头部 JSDoc 补全**

为每个 check-*.ts 头部注释补全：输入参数（含 --json）、输出结构（含 ERROR_JSON / XXX_JSON）、退出码 0/1/2 含义、错误字段（file/rule/field/detail）。示例：

```ts
/**
 * @param argv 命令行参数；支持 --json（机器可读输出）、--phase N
 * @returns exitCode 0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 */
```

- [ ] **Step 4: 生成并验证**

Run: `npm run docs:build`
Expected: `docs/api/` 生成；无 TypeDoc 报错。将 `docs/api/` 加入 `.gitignore`（生成物不入库）或提交（若仓库惯例要求，以 CHANGELOG 惯例为准）。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json w-model-dev/scripts
git commit -m "docs(api): generate TypeDoc API docs for check scripts"
```

## Task 8: B7 归档 INDEX.md

**Files:** Create: `docs/changes/archive/INDEX.md`

- [ ] **Step 1: 盘点 5 个归档目录**

Run: `Get-ChildItem docs/changes/archive -Directory | Select-Object Name`
Expected: round15 / round19 / round20-phase1-4dim / round20-w8 / round23（注意 round20 两个目录，spec T7）。

- [ ] **Step 2: 编写 INDEX.md**

```markdown
# Archive 调测产物索引

> 顶层导航：各轮完整记录见对应目录 README.md。本索引仅提供一行摘要 + 链接。

| 轮次 | 目录 | 时间 | 验证点 | 修复问题 | 样本基线 | 链接 |
|---|---|---|---|---|---|---|
| round15 | 2026-07-26-round15-end-to-end-test | 2026-07-26 | 端到端 | ... | ... | [README](./2026-07-26-round15-end-to-end-test/README.md) |
| ... |（从各轮 README.md 摘录填充） | | | | | |
```
（每行从对应目录 README.md / summary 文件提取，不重复搬运内容。）

- [ ] **Step 3: Commit**

```bash
git add docs/changes/archive/INDEX.md
git commit -m "docs(archive): add top-level INDEX for e2e validation rounds"
```

## Task 9: B8 配置集中 config/（含 security-scan 联动）

**Files:**
- Move: `.eslintrc.cjs` → `config/.eslintrc.cjs`
- Move: `tsconfig.json` → `config/tsconfig.json`
- Create: `config/prettier.config.cjs`（若新增 prettier）
- Modify: `package.json`、`w-model-dev/scripts/cli/security-scan.ts`

- [ ] **Step 1: 迁移 ESLint 配置并修复 security-scan 联动**

Run (PowerShell)：
```powershell
New-Item -ItemType Directory -Force config
git mv .eslintrc.cjs config/.eslintrc.cjs
```
修改 [security-scan.ts:152](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/cli/security-scan.ts#L152)（spec T4）：
```ts
const r = spawnSync('npx', ['eslint', '--config', 'config/.eslintrc.cjs', 'w-model-dev/scripts/', '--format', 'json'], {
```
**`.eslintsecurity-baseline.json` 保持根目录不迁移**（BASELINE_PATH 相对 cwd）。

- [ ] **Step 2: 迁移 tsconfig 并修正 include 基准**

Run: `git mv tsconfig.json config/tsconfig.json`
`config/tsconfig.json` 的 include 相对配置文件位置，需改为：
```json
"include": ["../w-model-dev/scripts/**/*"]
```
package.json 类型检查命令改为 `tsc -p config/tsconfig.json`。

- [ ] **Step 3: vitest.config.ts 处理（默认迁移，失败回退）**

Run: `git mv vitest.config.ts config/vitest.config.ts`
package.json 测试命令改为 `vitest run --config config/vitest.config.ts`。**若迁移后测试路径解析失败**，回退至根目录并在本任务记录回退原因（spec B8）。

- [ ] **Step 4: package.json scripts 按组分类**

将 scripts 重组为三组（校验类 / 测试类 / 工具类）+ 注释：
```json
"scripts": {
  "//1 校验类": "阶段与资产门禁",
  "check:verifier": "tsx w-model-dev/scripts/cli/check-verifier-output.ts",
  "check:gate": "tsx w-model-dev/scripts/cli/check-artifact-gate.ts",
  "...": "...",
  "//2 测试类": "单元测试与回归",
  "test": "vitest run --config config/vitest.config.ts",
  "self-test": "tsx w-model-dev/scripts/cli/self-test.ts",
  "coverage": "vitest run --coverage --config config/vitest.config.ts",
  "//3 工具类": "工程工具",
  "setup:hooks": "git config core.hooksPath .githooks",
  "lint:security": "tsx w-model-dev/scripts/cli/security-scan.ts",
  "docs:build": "typedoc --out docs/api w-model-dev/scripts/cli w-model-dev/scripts/logic --entryPointStrategy expand --excludeNotDocumented"
}
```

- [ ] **Step 5: 全量验证 + Commit**

Run: `npx tsc -p config/tsconfig.json; npx vitest run --config config/vitest.config.ts; npm run prepush`
```bash
git add config package.json w-model-dev/scripts/cli/security-scan.ts
git commit -m "chore(config): centralize eslint/tsconfig/vitest configs under config/ with security-scan linkage"
```

## Task 10: B9 postinstall 自动启用 Git 钩子

**Files:**
- Create: `scripts/setup-hooks.cjs`（或复用 `w-model-dev/scripts/cli/` 之外的新文件）
- Modify: `package.json`

- [ ] **Step 1: 编写跨平台 postinstall 脚本**

创建 `scripts/setup-hooks.cjs`：
```js
// 自动配置 core.hooksPath = .githooks（Windows 兼容；失败仅 warn 不阻断 install）
const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
try {
  if (existsSync('.githooks')) {
    execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
    console.log('[setup-hooks] core.hooksPath=.githooks 已配置');
  }
} catch (e) {
  console.warn('[setup-hooks] 配置 hooksPath 失败（非阻断）:', e.message);
}
```

- [ ] **Step 2: package.json 挂 postinstall**

```json
"postinstall": "node scripts/setup-hooks.cjs"
```

- [ ] **Step 3: 文档更新 + Commit**

README/CONTRIBUTING 增加「克隆后首次 `npm install` 自动启用钩子；手动重置执行 `npm run setup:hooks`」。
Run: `npm install`（验证 postinstall 执行且不报错）
```bash
git add scripts package.json README.md CONTRIBUTING.md
git commit -m "feat(hooks): auto-configure core.hooksPath via postinstall (cross-platform)"
```

## Task 11: B10 协作模板 + Conventional Commits 规范

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug-report.md`
- Create: `.github/ISSUE_TEMPLATE/feature-request.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: 缺陷报告模板**

`.github/ISSUE_TEMPLATE/bug-report.md`：
```markdown
---
name: 缺陷报告
about: 报告校验脚本或技能包缺陷
title: "[bug] "
labels: bug
---
**环境**：Node 版本 / OS / Git Bash 是否可用
**复现步骤**：1. ... 2. ...
**预期结果**：
**实际结果**：（附命令输出 / 退出码）
**相关规则**：（如 R1-R5 / D7，若已知）
```

- [ ] **Step 2: 功能建议模板**

`.github/ISSUE_TEMPLATE/feature-request.md`：标题 `[feat] `，含「目标 / 场景 / 验收标准 / 涉及阶段门禁」。

- [ ] **Step 3: PR 模板**

`.github/PULL_REQUEST_TEMPLATE.md`：
```markdown
## 关联 Issue
closes #N
## 变更类型
- [ ] feat / fix / refactor / docs / test / chore
## 校验要点
- [ ] `npm run prepush` 14 项通过
- [ ] 未新增 .test.ts（如新增已同步 vitest 计数与 __tests__/README.md）
- [ ] 涉及规则：（列出的反模式 / 阶段约束）
## 覆盖规则
（列出本 PR 影响的校验规则 ID）
```

- [ ] **Step 4: CONTRIBUTING.md 增补 Conventional Commits 节**

新增节：type 列表（feat/fix/refactor/docs/test/chore）、scope 示例（scripts/docs/gate/error...）、PR 标题格式（`<type>(<scope>): <summary>`）、提交流程（分支 → prepush → PR 模板）。

- [ ] **Step 5: Commit**

```bash
git add .github CONTRIBUTING.md
git commit -m "docs(contributing): add issue/PR templates and conventional commits convention"
```

## Task 12: Batch P1 收尾回归

- [ ] **Step 1: 全量门禁 + CHANGELOG**

Run: `npm run prepush`
Expected: 14 项全过（含升级后的 audit 阻断项）。
CHANGELOG.md 追加 P1 批次条目（A2b/B1-B10）。

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record batch P1 fixes"
```

- [ ] **Step 2: 对照 spec 检查**

对照 [spec §3 Batch P1](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md) 逐项确认 11 项均已落实且回归通过。确认后进入 Batch P2。
