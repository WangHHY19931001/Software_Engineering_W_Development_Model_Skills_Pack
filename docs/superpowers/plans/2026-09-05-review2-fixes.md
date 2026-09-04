# review2-fixes 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 2026-09-05 五域全范围审查的全部 27 条发现（2 Important + 25 Minor），含 8 项收紧方向行为变更与失败链全量锚点化。

**架构：** 单一 SDD 战役 6 任务（见规格 `docs/superpowers/specs/2026-09-05-review2-fixes-design.md` 处置表）：T1 纯文档 Important；T2 l0 解析器 + 变更分类；T3 CLI 参数/legacy 分界/等价重构；T4 测试质量；T5 pre-push 收紧；T6 失败链锚点化 + 措辞 + 台账收口。

**技术栈：** TypeScript（tsx runtime）+ vitest + bash（pre-push）+ Markdown 活体文档。

---

## 全局约束（每个任务的简报须逐字携带）

- 工作目录（worktree）：`D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\.worktrees\review2-fixes`（分支 `task/review2-fixes`）。禁止改动主工作树。
- 版本保持 `42.2.1`，不 bump；不 push；不提交 `.superpowers/`。
- 退出码 0/1/2；exit 2 走 `exitWithError`（stderr `✗ [CATEGORY]` + stdout `ERROR_JSON`）。
- 任何 `.ts` / `.sh` 编辑前先做 codegraph 查询并落盘 `.w-model/codegraph-queries/phase5-review2fix<任务号>-<符号>.json`（当前 checkout 无 codegraph index，写 unindexed-fallback 记录：字段 `querySymbol` / `callers: []` / `callees: []` / `blastRadius: "unindexed-fallback"` / `queryTimestamp`（真实 ISO 时间）/ `changeId: "phase5-review2fixes"` / `targetFiles`（本次实际编辑的代码/测试文件）/ `note: "unindexed fallback: no .codegraph index in checkout"`）。该目录 gitignored，不入 commit。
- 行为变更只允许收紧方向；不得放宽任何既有门禁；不得伪造测试结果。
- 提交信息用中文/仓库惯例 conventional 风格（参照 `git log --oneline -20`）。
- 每任务完成 = 定向测试绿 + 单 commit（任务内多文件一次提交）；台账统一由任务 6 收口，中间任务不改 CHANGELOG。

---

### 任务 1：模板 `--scope` 补齐 + SSoT L0/L1 链接边界落点（I1、I2）

**文件：**
- 修改：`w-model-dev/templates/integration-test.md:19,55`
- 修改：`w-model-dev/templates/system-test.md:57`
- 修改：`w-model-dev/templates/acceptance-test.md:21,83`
- 修改：`w-model-dev/templates/coding.md:20`
- 修改：`docs/skill-design-document_SSoT.md`（§3.4 之后、`## 4. 技能工作流程`（约 426 行）之前插入 §3.5）
- 修改：`docs/INSTALL.md`（§2 交付层选择，约 88-90 行 bullet 之后）
- 修改：`w-model-dev/SKILL.md:19`、`w-model-dev/references/command-reference.md`（L0/L1 审计节首）、`w-model-dev/references/quickstart.md:15`
- 本任务只改 Markdown，无代码编辑，无需 codegraph 查询。

- [ ] **步骤 1：I1 —— 6 处模板调用补 `--scope`**

逐处把 `check-artifact-gate.ts` 调用补成与 `templates/coding.md:79` 一致的形态（占位符 `<change-scope.json>`，不加新路径约定）：

| 文件:行 | 改前片段 | 改后片段 |
| --- | --- | --- |
| integration-test.md:19 | `check-artifact-gate.ts --phase=6` 校验集成测试列回填与门禁放行 | `check-artifact-gate.ts --phase=6 --scope=<change-scope.json>` 校验集成测试列回填与门禁放行 |
| integration-test.md:55 | `` `check-artifact-gate.ts --phase=6`：集成测试列回填校验，退出码 0 `` | `` `check-artifact-gate.ts --phase=6 --scope=<change-scope.json>`：集成测试列回填校验，退出码 0 `` |
| system-test.md:57 | `` `check-artifact-gate.ts --phase=7`：系统测试列回填 `` | `` `check-artifact-gate.ts --phase=7 --scope=<change-scope.json>`：系统测试列回填 `` |
| acceptance-test.md:21 | `check-artifact-gate.ts` 终检（RTM 100%… | `check-artifact-gate.ts --scope=<change-scope.json>` 终检（RTM 100%… |
| acceptance-test.md:83 | `` `check-artifact-gate.ts`（终检）：退出码 0 `` | `` `check-artifact-gate.ts --scope=<change-scope.json>`（终检）：退出码 0 `` |
| coding.md:20 | `check-artifact-gate.ts --phase=5` 校验 NFR/CON codeModule 回填 | `check-artifact-gate.ts --phase=5 --scope=<change-scope.json>` 校验 NFR/CON codeModule 回填 |

`templates/requirement-spec.md:295`（`--phase=1`）不动。

- [ ] **步骤 2：I2 —— SSoT 新增 §3.5 权威小节**

在 SSoT `### 3.4 编排者-子代理边界` 内容结束、`## 4. 技能工作流程` 之前插入：

```markdown
### 3.5 L0/L1 链接边界（交付分层导航规则）

L0 文档（`SKILL.md` / `references/` / `templates/` / `examples/` / `subagent/` / `schemas/`）中指向 `scripts/`、`samples/`、`tools/` 的相对链接统一为 **L1-only 导航**：L0 副本预期不含这些目标，链接检查必须将其分类为分层边界，不得据此报告「L0 全链接通过」；取得 L1 交付（L0 + `scripts/` + `samples/` + `tools/`）后才校验这些目标。仓库侧审计入口为 `npm run audit:l0-links [-- --root=<skill-root>]`（`w-model-dev/scripts/application/audit-l0-links.ts`，只读，exit 0/1/2；实现与已知近似见 `w-model-dev/references/command-reference.md`「L0/L1 链接边界审计」节）。本节是该边界的权威定义；INSTALL §2 与 w-model-dev 侧描述均以本节为准。
```

- [ ] **步骤 3：I2 —— INSTALL §2 同步一句**

在 INSTALL「交付层选择」小节的 `- **L1 用户**：…` bullet（约 89 行）之后新增一行 bullet：

```markdown
- **L0/L1 链接边界**：L0 文档中指向 `scripts/`、`samples/`、`tools/` 的链接是 L1-only 导航，L0 副本预期不含目标、不得宣称 L0 全链接通过（权威定义见 `docs/skill-design-document_SSoT.md` §3.5；仓库侧审计 `npm run audit:l0-links`）。
```

- [ ] **步骤 4：I2 —— w-model-dev 三处改为引用 SSoT**

- `w-model-dev/SKILL.md:19`：在「统一为 **L1-only 导航**」的句末分号前插入「（权威定义：`docs/skill-design-document_SSoT.md` §3.5）」。即把 `统一为 **L1-only 导航**：` 改为 `统一为 **L1-only 导航**（权威定义：SSoT §3.5）：`。
- `w-model-dev/references/command-reference.md`「L0/L1 链接边界审计」节：在 `- **速查行**` 之前新增一行：
  `- **权威定义**：分层语义与审计边界的权威定义见仓库 \`docs/skill-design-document_SSoT.md\` §3.5；本节为实现与用法说明。`
- `w-model-dev/references/quickstart.md:15`：把 `其中指向 \`scripts/\`、\`samples/\`、\`tools/\` 的链接是 L1-only 导航，` 中「L1-only 导航」后追加 `（权威定义见仓库 SSoT §3.5）`。

- [ ] **步骤 5：验证**

```bash
grep -rn "check-artifact-gate" w-model-dev/templates/*.md   # 6 处均带 --scope；requirement-spec.md:295 为 --phase=1 不带
grep -c "L1-only" docs/skill-design-document_SSoT.md docs/INSTALL.md   # 两文件各 ≥1
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts   # 模板契约不受影响
npm run audit:l0-links   # exit 0
```

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/templates/ docs/skill-design-document_SSoT.md docs/INSTALL.md w-model-dev/SKILL.md w-model-dev/references/command-reference.md w-model-dev/references/quickstart.md
git commit -m "docs: close review2 Importants (template --scope, SSoT L0/L1 boundary anchor)"
```

---

### 任务 2：l0 解析器边缘形态 + `.githooks/` 判 code（A1、A2、A3）

**文件：**
- 修改：`w-model-dev/scripts/logic/l0-link-audit-logic.ts:56`（REFERENCE_DEFINITION）、`parseRelativeLinks`（约 60-72 行）、`hasUriScheme`（约 81-83 行）
- 修改：`w-model-dev/scripts/lib/change-scope.ts:140-185`（isCodeOrTestFile 及其文档注释）
- 测试：`w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts`、`w-model-dev/scripts/__tests__/change-scope.test.ts`
- 修改（基线随动）：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts`
- 文档：`w-model-dev/references/command-reference.md`（「已知近似」行）、`w-model-dev/references/phase-5-coding.md`（覆盖义务段）

- [ ] **步骤 1：codegraph 查询落盘**

对 `parseRelativeLinks` / `hasUriScheme` / `isCodeOrTestFile` 三个符号各写一条 unindexed-fallback 记录（按全局约束模板，targetFiles 含本任务两个实现文件与两个测试文件）。

- [ ] **步骤 2：编写失败的测试（l0 解析器三形态）**

在 `l0-link-audit-logic.test.ts` 的纯函数 describe 中新增（沿用该文件既有构造 audit 的辅助函数与命名风格）：

```ts
it('parses inline angle-bracket target with title without trailing ">"', () => {
  const links = parseRelativeLinksForTest('[a](<./x.md> "title")'); // 经由该文件既有的纯函数导出测试通道；若 parseRelativeLinks 未导出，则经由 auditTempSkill() 在临时 skill 根写 SKILL.md 后断言 l1Only/relativeLinkCount
  expect(links).toContain('./x.md');
});

it('parses reference definitions without whitespace after colon', () => {
  // 输入含一行 `[a]:./x.md`
  // 断言 ./x.md 被采集为相对链接
});

it('parses reference definitions with destination on the next line', () => {
  // 输入两行：`[a]:` 换行 `  ./x.md`
  // 断言 ./x.md 被采集
});

it('classifies single-letter scheme (C:temp) as package-relative, not URI', () => {
  // 输入含 `[a](C:temp)`：断言产生 violation（相对路径目标不存在于包内），而不是被当外部 URI 放行
});
```

注：`parseRelativeLinks` 当前未导出——优先走该文件既有的「临时 skill 根 + audit」集成通道（先 `grep -n "l1Only\|relativeLinkCount\|auditTemp\|makeSkill" w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts` 找到既有同类用例，复制其构造模式：临时根写 `SKILL.md` 与目标文件，跑 audit 后断言结果）；仅当集成通道无法表达时才最小导出该纯函数并在导出注释说明「测试专用导出」。

- [ ] **步骤 3：运行验证失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts
```

预期：4 个新用例 FAIL（`>` 残留 / 无空白定义不采集 / 换行定义不采集 / `C:temp` 被放行）。

- [ ] **步骤 4：实现解析器修正**

`l0-link-audit-logic.ts`：

```ts
// 内联链接：先按 title 切分、再对剩余 target 整对剥离尖括号（修复 `<./x.md> "t"` 的 `>` 残留）
const raw = match[1]!
  .trim()
  .split(/\s+["']/)[0]!
  .replace(/^<(.*)>$/, '$1');
```

```ts
const REFERENCE_DEFINITION = /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^)> \t]+)>?/gm;
// CommonMark 允许冒号后无空白（[a]:./x.md）与目标位于下一行；下一行形态仅接受
// 以 `<`、`/`、`./`、`../` 起始的目标（保守近似：避免把普通散文行误当目标）
const REFERENCE_DEFINITION_CONTINUATION = /^ {0,3}\[([^\]]+)\]:[ \t]*\r?\n[ \t]+(<?(?:\.{0,2}\/)[^)> \t]*>?)/gm;
```

`parseRelativeLinks` 内 reference 循环后追加第二趟 `matchAll(REFERENCE_DEFINITION_CONTINUATION)`，取组 1 同样 `replace(/^<|>$/g,'')` 后 push。`hasUriScheme` 正则由 `/^[a-z][a-z0-9+.-]*:/i` 收紧为：

```ts
function hasUriScheme(target: string): boolean {
  // scheme 至少 2 字符：单字母「scheme」（如 C:temp）不是 URI，按包内相对路径处理
  return !isWindowsDrivePath(target) && /^[a-z][a-z0-9+.-]+:/i.test(target);
}
```

同步更新文件头与「已知近似」注释（`%23`/`%2F` 不解码近似保留）。

- [ ] **步骤 5：运行 l0 测试验证通过**（命令同步骤 3，预期全绿）

- [ ] **步骤 6：编写失败的测试（`.githooks/` 分类）**

`change-scope.test.ts` 的 isCodeOrTestFile describe 新增：

```ts
it('classifies extensionless executable scripts under .githooks/ as code', () => {
  expect(isCodeOrTestFile('.githooks/pre-push')).toBe(true);
});
it('keeps dotfile roots excluded and md non-code', () => {
  expect(isCodeOrTestFile('.gitignore')).toBe(false);
  expect(isCodeOrTestFile('docs/x.md')).toBe(false);
});
```

运行验证失败（`.githooks/pre-push` 当前为 false）。

- [ ] **步骤 7：实现分类规则**

`change-scope.ts` `isCodeOrTestFile` 在 `EXCLUDED_ROOT_SEGMENTS` 判断之后、dotfile 判断之前插入：

```ts
  // .githooks/ 下的无扩展名 shell（pre-push 等）是可执行工程文件，改动须 codegraph 覆盖
  if (relPath.startsWith('.githooks/')) return true;
```

并更新函数头注释规则清单（新增规则 1.5）。运行步骤 6 测试验证通过。

- [ ] **步骤 8：实包基线重测**

```bash
npx tsx w-model-dev/scripts/application/audit-l0-links.ts
```

新解析可能使 real 包 `relativeLinkCount` 变化：把新终值写入 `helpers/l0-baseline.ts`（该 helper 是两个测试文件的单一事实来源），并在提交说明记录旧→新计数。若出现**新 violation**：逐条核对是真实形态还是解析误报——误报则收紧对应正则（回到步骤 4 调整），不得为通过而放宽或删除断言。

- [ ] **步骤 9：文档同步**

- `command-reference.md`「已知近似」行改为：`URL 内含 ) 的行内链接与 %23/%2F 转义不解码；reference-style 定义已采集（含冒号后无空白与下一行目标两种形态，下一行目标仅接受 / ./ ../ < 起始）。`
- `phase-5-coding.md`「codegraph 修改前影响分析」覆盖义务段补一句：`.githooks/` 下无扩展名脚本（如 pre-push）按 code 文件计，改动须被查询覆盖。`

- [ ] **步骤 10：定向回归 + Commit**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts w-model-dev/scripts/__tests__/change-scope.test.ts w-model-dev/scripts/__tests__/audit-l0-links-cli.test.ts
npm run audit:l0-links   # exit 0
git add -A w-model-dev/scripts w-model-dev/references/command-reference.md w-model-dev/references/phase-5-coding.md
git commit -m "fix(scripts): close l0 parser edge forms and classify .githooks as code"
```

（l0 CLI 测试文件名以实际为准：`ls w-model-dev/scripts/__tests__/ | grep -i l0`。）

---

### 任务 3：parse-args 重复 flag + LEGACY_VARIANT 分界 + loadCliScope 重构 + 口径注释（A4、A5、A6、A7、A8）

**文件：**
- 修改：`w-model-dev/scripts/lib/parse-args.ts`、`w-model-dev/scripts/lib/run-main.ts`
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`（约 340-455 区域）
- 修改：`w-model-dev/scripts/lib/load-cli-scope.ts`、`w-model-dev/scripts/cli/check-artifact-gate.ts:427-455`
- 修改：`w-model-dev/scripts/lib/change-scope.ts:80-96`（注释）、`:396` 与 `:411-421`（注释）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`、既有 parse-args/cli 用例翻转
- 文档：`w-model-dev/references/command-reference.md`、`w-model-dev/references/data-models.md`

- [ ] **步骤 1：codegraph 查询落盘**（符号：`parseFlagValue`、`runMain`、`isLegacySchemaFailure`、`loadCliScope`；targetFiles 含上述实现文件）。

- [ ] **步骤 2：编写失败的测试（重复 flag）**

在 parse-args 或 CLI 集成测试文件（沿用既有 `runCli` 辅助；放 `check-codegraph-queries.test.ts` 的 CLI describe）新增：

```ts
it('rejects duplicated --scope flags with ARG_INVALID exit 2', () => {
  const { root } = makeScopedProject({});
  const r = runCli([`"${root}"`, '--phase', '5', '--scope=.w-model/scope.json', '--scope=.w-model/other.json']);
  expect(r.status).toBe(2);
  expect(r.stdout).toMatch(/ERROR_JSON/);
  expect(r.stdout + r.stderr).toMatch(/重复的命令行参数 --scope/);
});
```

运行验证失败（当前静默取第一个 → status 为 0 或 1，非 2）。

- [ ] **步骤 3：实现重复 flag 拒绝**

`parse-args.ts`：

```ts
/** 重复值 flag 输入错误（runMain 统一转 ARG_INVALID / exit 2） */
export class DuplicateFlagError extends Error {
  constructor(public readonly flag: string) {
    super(`重复的命令行参数 --${flag}（值 flag 只允许出现一次；旧「取第一个」语义已废除）`);
  }
}

export function parseFlagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hits = args.filter((a) => a.startsWith(prefix));
  if (hits.length > 1) throw new DuplicateFlagError(name);
  return hits.length === 0 ? undefined : hits[0]!.slice(prefix.length);
}
```

`run-main.ts` 在 `HandledCliError` 判断之后、通用分支之前加：

```ts
    if (err instanceof DuplicateFlagError) {
      exitWithError({ category: 'ARG_INVALID', message: err.message, exitCode: 2 });
      return;
    }
```

（import 自 `./parse-args.js`。）然后全仓扫描依赖旧行为的用例并翻转：`grep -rn "\-\-scope=.*\-\-scope=\|\-\-root=.*\-\-root=" w-model-dev/scripts/__tests__/` 与 `grep -rn "取第一个\|first.*wins" w-model-dev/scripts/__tests__/`；跑受影响 CLI 定向测试确认无回归。运行步骤 2 测试验证通过。

- [ ] **步骤 4：编写失败的测试（LEGACY_VARIANT 分界）**

`run-log-logic.test.ts` 新增 describe（沿用该文件既有 emergency-fix fixture 构造）：

```ts
it('blocks post-cutoff emergency-fix missing variant instead of absorbing as LEGACY_VARIANT', () => {
  // 构造一条 action=emergency-fix、无 variant/blocker、timestamp='2026-09-02T00:00:00.000Z' 的行
  // 断言 result.passed=false 且 violations 含 [schema]（不再出现 LEGACY_VARIANT diagnostic）
});
it('still absorbs pre-cutoff undeclared-variant emergency-fix as LEGACY_VARIANT', () => {
  // 同形记录但 timestamp='2026-08-31T00:00:00.000Z'
  // 断言 diagnostics 含 LEGACY_VARIANT、该行吸收为有效记录（既有行为不变）
});
```

运行验证失败（两条当前都走吸收）。

- [ ] **步骤 5：实现分界**

`run-log-logic.ts` 顶部（常量区）新增：

```ts
/** variant 规则引入时刻（42.2.1 发布日）：此后写入的 emergency-fix 缺 variant 不再按 legacy 吸收 */
export const LEGACY_VARIANT_CUTOFF = '2026-09-01T00:00:00Z';
```

在 `isUndeclaredVariantEmergencyFix` 旁新增纯函数：

```ts
function isPostCutoffUndeclaredVariantEmergencyFix(raw: unknown): boolean {
  if (!isUndeclaredVariantEmergencyFix(raw)) return false;
  const ts = (raw as { timestamp?: unknown }).timestamp;
  return typeof ts === 'string' && !Number.isNaN(Date.parse(ts)) && Date.parse(ts) >= Date.parse(LEGACY_VARIANT_CUTOFF);
}
```

主循环吸收入口（约 431 行）由 `if (isLegacySchemaFailure(raw, schemaResult.errorMessages)) {` 改为：

```ts
      if (isLegacySchemaFailure(raw, schemaResult.errorMessages) && !isPostCutoffUndeclaredVariantEmergencyFix(raw)) {
```

（被排除的记录自然落入下方 `// schema 拒绝` blocking 分支，复用既有 `[schema]` violation 文案。）运行步骤 4 测试验证通过；同时跑 `run-log-logic.test.ts` 全文件确认既有 LEGACY 用例（fixture 时间戳均早于截止日）不回归。

- [ ] **步骤 6：loadCliScope 重构（行为等价）**

- `load-cli-scope.ts`：`LoadedCliScope` violations 变体改为 `{ kind: 'violations'; violations: string[]; attemptedChangeId: string | null }`，返回处改为 `return { kind: 'violations', violations: resolved.violations, attemptedChangeId: resolved.attemptedChangeId ?? null };`；文件头注释三态说明同步。
- `check-artifact-gate.ts`：删除约 427-455 行内联 `resolveCliScope` + 三态处理块，改为：

```ts
    const loaded = loadCliScope(process.argv, projectDir, externalPhase);
    if (loaded.kind === 'missing') {
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, { scope: null, scopeViolations: [] });
    } else if (loaded.kind === 'violations') {
      // scope 已提供但绑定失败：不输出"未提供 --scope"误导文案，真实原因以 [scope] 前缀进 reasons；
      // summary 标注 provided=true + 尝试绑定的 changeId（D1：区分「未提供」与「已提供但被拒」）
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, {
        scope: null,
        scopeViolations: loaded.violations,
        scopeProvidedButFailed: true,
        attemptedChangeId: loaded.attemptedChangeId,
      });
    } else {
      externalAggregate = aggregateExternalChecks(projectDir, externalPhase, { scope: loaded.scope, scopeViolations: [] });
    }
```

import `loadCliScope`；删除因此不再使用的 import（`resolveCliScope` / `parseFlagValue` / `gitRunnerFor` 若无其他使用点，以 typecheck 通过为准）。

守护：`artifact-gate-external.test.ts` E2/E3（scopeProvidedButFailed 输出）必须逐字段不变：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts w-model-dev/scripts/__tests__/change-scope.test.ts
```

- [ ] **步骤 7：A7/A8 口径注释与文档**

- `change-scope.ts` 两个分支各加一行注释（manifest 模式 phase 不符处与薄封装前缀不符处）：`// 退出码口径：CLI 参数互斥矛盾（--change 与 --phase 同行不一致）= ARG_INVALID/exit 2；scope 文件内容与 Git/flag 冲突 = violations/exit 1（判别规则见 command-reference「阶段 5-8 …门禁 CLI」节）`（两处按所在分支裁剪措辞）。
- `isIsoDateTimeString`（:83）上方注释补：`// 较 ajv-formats date-time 更严：拒绝小写 t/z 与无毫秒/时区形态；同一字段族以本 TS 层为准（schema 层为宽松前置）`。
- `command-reference.md`「阶段 5-8 codegraph/opsx/archive 门禁 CLI」节补判别规则句：`退出码判别：CLI 参数互斥矛盾（如 --change 前缀与 --phase 不符）为 ARG_INVALID/exit 2；scope 文件内容与 Git 实际/CLI flag 冲突为校验失败 exit 1。重复值 flag（如 --scope 两次）为 ARG_INVALID/exit 2。`
- `w-model-dev/schemas/codegraph-query.schema.json` 与 `change-scope.schema.json` 中 `queryTimestamp` / `scopeCreatedAt` 字段的 description 各补一句：`TS 层（isIsoDateTimeString）较 ajv-formats date-time 更严（拒小写 t/z），以 TS 层为准。`
- `data-models.md` RunLogEntry variant 字段描述补：`2026-09-01（LEGACY_VARIANT_CUTOFF）起写入的 emergency-fix 缺 variant 属 blocking，不再按 LEGACY_VARIANT 吸收。`

- [ ] **步骤 8：定向回归 + Commit**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts
npm run typecheck
git add -A w-model-dev/scripts w-model-dev/references/command-reference.md w-model-dev/references/data-models.md
git commit -m "fix(scripts): reject duplicate flags, bound legacy variant absorption, unify scope loading"
```

---

### 任务 4：测试质量组（T1、T2、T3、T4、T5、T6）

**文件：**
- 修改：`w-model-dev/scripts/__tests__/change-scope.test.ts:623-632`
- 修改：`w-model-dev/scripts/lib/run-sync.ts`（SYNC_PROCESS_EXCEPTIONS 对应条目，约 296-308）
- 修改：`w-model-dev/scripts/__tests__/artifact-gate-external.test.ts:244-269`
- 修改：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts:2877`（describe 注释）
- 修改：`w-model-dev/scripts/__tests__/examples-contract.test.ts`（259-273 / 433-445 重复循环、486-491 恒真、共享文件清单常量化）
- 修改：`w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts:345/357/375/387`
- 修改（若用例名变化）：`w-model-dev/scripts/__tests__/README.md` 矩阵行描述

- [ ] **步骤 1：codegraph 查询落盘**（符号：`SYNC_PROCESS_EXCEPTIONS`、`hasValidResult`；targetFiles 含本任务改动的测试文件与 run-sync.ts）。

- [ ] **步骤 2：T1 —— 改造无效环境自检为真断言**

`change-scope.test.ts` 用例 `CLI 运行环境自检（非端到端）：验证 execSync 能跑 git` 整体替换为（放在同一 describe 末尾，删除原死准备）：

```ts
  it('resolveCliScope fail-closes when project root is not a Git repository', async () => {
    const nonGitRoot = mkdtempSync(join(tmpdir(), 'review2fix-nongit-'));
    writeFileSync(join(nonGitRoot, 'scope.json'), VALID_SCOPE_JSON());
    const r = resolveCliScope({
      projectRoot: nonGitRoot,
      phase: 5,
      scopePath: join(nonGitRoot, 'scope.json'),
      git: gitRunnerFor(nonGitRoot),
    });
    expect(r.kind).toBe('violations');
    if (r.kind === 'violations') {
      expect(r.violations.join('\n')).toMatch(/HEAD|Git/i);
      expect(r.attemptedChangeId ?? null).not.toBeNull();
    }
  });
```

（`mkdtempSync` / `tmpdir` 若未 import 则补 import；若该文件不存在 `VALID_SCOPE_JSON()` helper，则内联构造 scope JSON 字面量：`changeId: "phase5-nongit-demo"`、`phase: 5`、`baseRef`/`headRef` 用固定假 40 位十六进制、`scopeCreatedAt` 用 ISO 字面量、`changedFiles: ["src/main.ts"]`——本用例断言的是 Git 不可用时 fail-closed，不依赖绑定成功。若 manifest 模式在 HEAD 不可读时的实际返回与预期细节不符，以实际行为为准把断言收敛为「kind 不为 ok 且 violations 必含 fail-closed 语义（/HEAD|Git/i）」。）

同步 `run-sync.ts`：删除 `__tests__/change-scope.test.ts` / line 629 的 execSync 条目（新用例无 execSync；`reason` 字段的历史沿革说明并入删除理由不可行——直接删条目并在 `__tests__/README.md` 或无需说明）。运行 `npx vitest run ... run-sync.test.ts` 验证 manifest 一致性测试绿。

- [ ] **步骤 3：T2 —— E5b 真传历史形状**

`artifact-gate-external.test.ts` E5b 的 options 行改为：

```ts
    const options = {
      phaseOption: 5 as const,
      externalChecks: { codegraphQueriesValid: true, opsxArtifactsValid: true, openspecArchived: true },
    } as unknown as Parameters<typeof checkArtifactGate>[1];
```

断言保持 `expect(result.passed).toBe(true);` 并追加：

```ts
    for (const dead of ['codegraphQueriesValid', 'opsxArtifactsValid', 'openspecArchived']) {
      expect(Object.prototype.hasOwnProperty.call(result, dead), dead).toBe(false);
    }
```

- [ ] **步骤 4：T3 —— pre-push 源契约定位注释**

`docs-consistency-logic.test.ts` 对应 describe（约 2877 行）顶部插入注释：

```ts
  // 定位说明：pre-push 行为级覆盖位于 platform-deps-hook.test.ts（stdin 多 ref / 基线 /
  // fail-closed 真实断言）；本组是对 hook 源码的文本级补充防线——变量重命名即红属预期，
  // 用于防语义漂移的第二道闸，不承担行为验证职责。
```

- [ ] **步骤 5：T4 —— examples-contract 去重**

1. 把重复出现的文件清单收敛为模块级常量（两种顺序各一份，均含 references/examples/templates 三目录展开）：

```ts
const GUIDANCE_CORPUS_FILES = [
  ...markdownFiles('w-model-dev/references'),
  ...markdownFiles('w-model-dev/examples'),
  ...markdownFiles('w-model-dev/templates'),
];
```

`requires a real result for every copyable /wm test command`（259）与 `requires every copyable test command to use a bounded real result or explicit placeholder`（433）两个逐字重复的 `it` 合并为一个（保留后者名称，删除前者），循环引用 `GUIDANCE_CORPUS_FILES`；其余 4 处展开（313/435/479/504 一带）同样替换为该常量。
2. `directBypass`（约 486-491）删除恒真条件 `normalized.includes('r') &&`，逻辑等价（`r→s-fix` 必含 'r'）。
3. 三套失败路由扫描（段落级 317-378、行级 502-530、corpusFailureUnits 606）中**逐字相同**的 failure/bypass 正则与 prohibition 提升为模块级共享常量（如 `LINE_FAILURE_SIGNALS`）；**语义不同的扫描逻辑保持各自独立，不强行合并**。

断言语义与覆盖文件集不变；合并后运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts
```

vitest 用例总数变化（-1，来自合并）如实记入任务报告。

- [ ] **步骤 6：T6 —— 固定时间戳**

`check-codegraph-queries.test.ts` describe 顶部新增：

```ts
const QUERY_TS = '2026-09-05T00:00:01.000Z';
const SCOPE_TS = '2026-09-05T00:00:02.000Z'; // queryTimestamp ≤ scopeCreatedAt 方向保持
```

C10b/C10c 中 4 处 `new Date().toISOString()` 分别替换为 `QUERY_TS` / `SCOPE_TS`（查询文件用 QUERY_TS，scope 用 SCOPE_TS）。运行该文件测试验证通过。

- [ ] **步骤 7：定向回归 + Commit**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/change-scope.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts w-model-dev/scripts/__tests__/examples-contract.test.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git add -A w-model-dev/scripts
git commit -m "test: close quality minors (dead probe, E5b shape, dedupe scanners, fixed timestamps)"
```

---

### 任务 5：pre-push quotePath + audit skip 边界 + CONTRIBUTING 口径（H1、H2、H3、H4、H5、P1）

**文件：**
- 修改：`.githooks/pre-push:147,211,220,251`（quotePath）与 `:379-390`（audit_can_skip 正则）
- 测试：`w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`（新增 `pre-push audit skip boundary` 表驱动组）
- 修改：`CONTRIBUTING.md:68`、`CONTRIBUTING.md:161`

- [ ] **步骤 1：codegraph 查询落盘**（符号：`audit_can_skip`、`audit_has_blocking_signal`、`enumerate_new_branch_commits`；targetFiles 含 `.githooks/pre-push` 与其测试文件——`.sh` 编辑同样触发查询义务）。

- [ ] **步骤 2：编写失败的测试（audit skip 边界表驱动）**

`platform-deps-hook.test.ts` 沿用该文件既有的 audit 判定测试通道（grep `audit` 定位既有用例的调用方式：若为 source 函数或提取 `audit_can_skip` 对临时文件判定，则按下表逐行；若只能端到端，则按既有模式 mock npm 输出）。新增 describe `pre-push audit skip boundary`，表驱动样例（每行 = 一段假想 npm 输出 + 期望 can_skip）：

| 输入摘要 | 期望 |
| --- | --- |
| `found 0 vulnerabilities` | blocking（skip=false） |
| `3 vulnerabilities (1 high 2 moderate)` | blocking |
| `npm error code ENOTFOUND` + `network` 行 | skip |
| `npm error code ETIMEDOUT` | skip |
| `npm error errno ECONNRESET` | skip |
| `socket hang up`（`npm error` 前缀行内） | skip |
| `npm error code E429` | skip |
| `npm error network request failed` | skip |
| `npm warn audit network request failed`（npm7 形态） | skip（新行为 H4） |
| `npm error 404 Not Found - GET https://registry.npmjs.org/-/npm/v1/security/advisories` | skip（新行为 H2） |
| `npm error code E404`（无 registry/advisories 上下文） | blocking（H2 保守面） |
| `503 Service Unavailable`（`npm error` 行内、无 network/registry/request 词） | blocking（新行为 H3） |
| `npm error request failed: 503 Service Unavailable` | skip（H3 锚定后仍跳） |
| `npm error registry request failed: 502 Bad Gateway` | skip |
| 漏洞 + 5xx 混合（`found 2 vulnerabilities` 与 `503` 同输出） | blocking（blocking 优先不变量） |
| `npm error code EACCES` | blocking |
| `npm error code EJSONPARSE` | blocking |
| `permission denied` | blocking |

运行验证失败（H2/H3/H4 三类新行为当前判定相反）。

- [ ] **步骤 3：实现 quotePath + 正则收紧**

`.githooks/pre-push` 5 个调用点（4 行）统一前插 `-c core.quotePath=false`：

```bash
# 147 行
if ! out="$(git -c core.quotePath=false log -m --name-only --pretty=format: "$local_sha" --not "--remotes=$remote_name" 2>/dev/null)"; then
# 211 行
if ! line_diff="$(git -c core.quotePath=false diff --name-only "$base" "$local_sha" -- 2>/dev/null)"; then
# 220 行
if ! line_diff="$(git -c core.quotePath=false diff --name-only "$remote_sha" "$local_sha" -- 2>/dev/null)"; then
# 251 行（fallback，两个 diff 都补）
if changed_files="$(git -c core.quotePath=false diff --name-only HEAD@{push} HEAD 2>/dev/null || git -c core.quotePath=false diff --name-only origin/HEAD HEAD 2>/dev/null)"; then
```

`audit_can_skip` 的 grep 正则做三处修改（保持单条 grep -qiE）：

1. `network([[:space:]:]|$)` → `(audit[[:space:]]+)?network([[:space:]:]|$)`（H4：允许 `npm warn audit network`）。
2. 错误码列表追加 E404 场景的上下文锚定形態（H2）：在 alternation 中新增
   `404[[:space:]]+Not[[:space:]]+Found[[:space:]]+-[[:space:]]+GET[[:space:]]+[^[:space:]]*(registry|advisories)`
   （不把裸 `code E404` 加入错误码列表）。
3. 裸状态词分支（H3）：把末尾 `(Bad Gateway|Service Unavailable|Gateway Time-?out|Internal Server Error)` 改为
   `((network|registry|request).*\b(Bad Gateway|Service Unavailable|Gateway Time-?out|Internal Server Error)\b|\b(Bad Gateway|Service Unavailable|Gateway Time-?out|Internal Server Error)\b.*(network|registry|request))`
   （已带 `(429|5xx)` 码前缀的分支不动）。

同步 368-372 行注释块：说明 E404 仅在 registry/advisories 上下文跳过、状态词需同行 network/registry/request 锚定、npm7 `audit network` 形态。

运行 `bash -n .githooks/pre-push` 与步骤 2 测试验证通过。

- [ ] **步骤 4：H5 + P1 —— CONTRIBUTING 两处口径**

- `:68`：`# 3.2 自检基线（samples/ 目录下 262 条样本，覆盖全部 check 脚本的通过 / 失败路径）` 改为 `# 3.2 自检基线（262 条 self-test 运行用例，覆盖全部 check 脚本的通过 / 失败路径；samples/ 为 fixture 载体）`。
- `:161`：句末 `纯归档/规划目录改动才直接放行。` 改为 `` 未命中上述模式才直接放行；`docs/*.md` 的 `*` 在 shell case 中跨 `/` 匹配，`docs/changes/`、`docs/superpowers/` 等 .md 变更同样触发门禁（过包含方向，安全优先）。``

- [ ] **步骤 5：定向回归 + Commit**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git add .githooks/pre-push CONTRIBUTING.md w-model-dev/scripts/__tests__/platform-deps-hook.test.ts
git commit -m "fix(hooks): quotePath in pre-push git calls and bound audit skip to anchored transient signals"
```

---

### 任务 6：失败链锚点化 + 措辞收尾 + 台账（D1、D2、D3、D4、P2、台账）

**文件：**
- 修改：`w-model-dev/references/hard-constraints.md`（新增锚点小节 + 自身内联收敛）、`w-model-dev/references/conventions.md`（术语表词条）
- 批量修改：`w-model-dev/references/**`、`w-model-dev/templates/**`、`w-model-dev/SKILL.md` 中失败链全句（约 200 处；**`w-model-dev/examples/**` 有意保留全句**）
- 修改：`w-model-dev/scripts/__tests__/examples-contract.test.ts`（扫描器接受锚点短名）
- 修改：`w-model-dev/references/phase-2-system-design.md:201`、`phase-3-outline-design.md:229`、`phase-4-detailed-design.md:169`（D1）；`phase-1-requirements.md:383,391`（D3）；`command-reference.md:40,50`（D4）
- 修改：`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`（P2 注记 + 父链追加）、`CHANGELOG.md`（新战役节 + 父链追加）

- [ ] **步骤 1：codegraph 查询落盘**（符号：`hasCompleteOrdinaryFailureChain`、`hasChainMarker`；targetFiles 含 examples-contract.test.ts）。

- [ ] **步骤 2：盘点与锚点定义**

```bash
grep -rn "V/G 失败 → R" w-model-dev/references w-model-dev/templates w-model-dev/SKILL.md | wc -l   # 记录基线数
grep -rho "V/G 失败 → R[^。｜|]*" w-model-dev/references w-model-dev/templates w-model-dev/SKILL.md | sort -u   # 变体清单
```

在 `hard-constraints.md` 的 `## #14` 节之后、`## 反模式（48 条）`（87 行）之前插入：

```markdown
## 普通 V/G 失败链（标准返工链）

**完整链（权威定义，全包唯一全句落点）**：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`

环节含义：V/G 任一门禁不通过后，编排者分派 R 子代理产出 RootCauseReport（5-Why / 鱼骨图 / 缺陷链追溯）；报告经 V 复审 + `check-rootcause-report.ts` exit 0 后，S 携 R 报告执行 S-fix；S-fix 后跑 R3 三维度预防性审查（completeness / reliability / security，`check-preventive-review.ts` exit 0），再经 V → G 复验，最终 🔴 CHECKPOINT 等待用户确认。跳过 R 直接 S 返工命中反模式 #18；R 报告未复审直接 S-fix 命中 #19。全包其余文档以短名引用本节，不再内联全句（examples/ 教学示例除外）。

短名引用形态（两式）：正文 `普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）`；表格 `普通 V/G 失败链（hard-constraints）`；本文件内部 `普通 V/G 失败链（见「普通 V/G 失败链」节）`。
```

`conventions.md` 术语表：`grep -n "RootCauseReport\|reworkHints" w-model-dev/references/conventions.md` 定位所在分组，在该组末尾按既有词条格式（`### 普通 V/G 失败链` + **规范定义** + **_Avoid_**）新增词条，规范定义指向 hard-constraints 节并给全句，_Avoid_ 列 `完整失败链/标准返工链/失败处理链` 等非规范叫法。

- [ ] **步骤 3：先改扫描器（红灯前置）**

`examples-contract.test.ts`：

1. `hasCompleteOrdinaryFailureChain` 开头（variants 判断前）加：

```ts
  if (normalized.includes('普通 V/G 失败链')) return true;
```

2. `hasChainMarker` 加同样接受：`if (normalized.includes('普通 V/G 失败链')) return true;`
3. 行级扫描（约 520 行）的豁免行改为：
   `if (line.includes(FAILURE_CHAIN) || line.includes('下方完整链') || line.includes('完整普通失败链') || line.includes('普通 V/G 失败链')) continue;`
4. `requires every ordinary failure guidance document to publish the complete rework chain`（380）：references 与 templates 条目的断言改为 `expect(containsFailureChain(content) || content.includes('普通 V/G 失败链'), relativePath).toBe(true);`（examples 条目保持全句要求），测试名改为 `requires every ordinary failure guidance document to publish the chain or its anchor`。
5. 约phase 311 行 `expect(content, `phase ${phase} failure flow`).toContain(FAILURE_CHAIN)` 改为 `toContain('普通 V/G 失败链')`。
6. 约phase 459 行 phase-5-coding 的 `expect(content).toContain(FAILURE_CHAIN)` 改为 `toContain('普通 V/G 失败链')`。

（本步骤先落地扫描器改造，为文档扫荡提供绿灯条件。）

- [ ] **步骤 4：文档扫荡（references/templates/SKILL.md）**

对步骤 2 盘点出的每个变体字面量执行精确替换（推荐逐文件 Python/perl 单行替换 + 人工抽查，**不用**宽泛正则）：

- 全句变体（含 `→ R 定位 →`、`→ S-fix 修复 →`、`→ S-fix 携 R 报告执行修复 →`、`preventive 门禁` 替换形、反引号包裹形）：链子串整体替换为短名形态；行内是表格行用表格式，否则正文式；后缀（如 `` `，不得直接分派 S``、`` ` 循环修正``）原样保留。
- `hard-constraints.md` 自身：仅新锚点节保留全句；其余内联（含 #13 节 76 行带（反模式 #29）后缀处）替换为本文件内部式。
- `conventions.md` 词条内保留全句（权威落点之二）。
- `phase-1-requirements.md:383,391` 的豁免 reject 场景（D3）不套短名，直接改为朴素表述：`人类 CHECKPOINT 确认 → approve 写入 granted.json / reject 回到对应豁免审批阶段（重新补覆盖或按 FM-EXEMPT 流程处置）`（两处按所在句式裁剪，删除「按完整普通失败链…完成后回到原规则」字样）。
- FM-EXEMPT-05 及其它豁免跳步条目中同类套用（`grep -n "完整普通失败链" w-model-dev/references/phase-1-requirements.md` 逐条判断：reject/跳步场景改朴素表述，真实 V/G 失败场景换短名）。

验收 grep（必须为 0，examples 除外）：

```bash
grep -rn "V/G 失败 → R" w-model-dev/references w-model-dev/templates w-model-dev/SKILL.md | grep -v "hard-constraints.md" | grep -v "conventions.md" | wc -l   # 期望 0
grep -rn "完整普通失败链" w-model-dev/references/phase-1-requirements.md | wc -l   # 期望 0（reject 场景已朴素化）
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts   # 全绿
```

- [ ] **步骤 5：D1 + D4 措辞修正**

- phase-2:201 / phase-3:229 / phase-4:169 三处 `phase>=2 的 graph 缺失为 D8 输入错误` 改为 `phase>=2 缺 --graph 为 ARG_INVALID/exit 2（进入 D1-D8 前即拒绝；graph 为 D8 的数据源）`。
- `command-reference.md`：50 行末尾句 `新增生产 CLI 或结果分支时，须更新自然退出契约测试。` 从「guide 链接」行删除，追加到 40 行生产 CLI 段落（`…不属于生产 CLI 直接退出静态检查范围。` 之后）。

- [ ] **步骤 6：P2 + 台账收口**

- acceptance 文档「本轮独立提交」子表（约 311 行）上方加一行注记：`> 注：本表为上方父链表的子集（轮次视角），机器审计请以父链表为准，勿按「每 SHA 恰出现一次」对本表计数。`
- 台账追加（两个文件同步、逐字节一致，格式 `| \`<40位SHA>\` | \`<逐字 subject>\` |`）：
  1. 先补上一战役三个收口提交：`11944cd`、`e6de501`、`f7f0bba`（`git log --format='%H %s' 7b52d4c..f7f0bba` 取全 SHA 与逐字 subject）。
  2. 再追加本战役 BASE（f7f0bba）..本次台账提交之前的全部提交（`git log --format='%H %s' f7f0bba..HEAD`，注意排除正在提交的台账提交自身）。
- CHANGELOG 在「### 留档项 4 项处置索引（archival-fixes-2，2026-09-04）」之后、「### 本轮提交身份」之前新增本战役节 `### 审查 27 条处置索引（review2-fixes，2026-09-05）`：一段散文（27 条全部修复、8 项行为变更为收紧方向、失败链锚点化计数旧→新、l0 基线计数变化、版本保持 42.2.1 不 bump、规格与计划文件路径、父链覆盖范围句），并注明本台账提交自身按规则不入链。
- acceptance 文档同步追加本战役验证记录段（真实命令结果）。

- [ ] **步骤 7：全量验证 + 两次 Commit（扫荡入链 / 台账收口不入链）**

```bash
npx prettier --check "w-model-dev/**/*.md" 2>/dev/null || npx prettier --write "w-model-dev/**/*.md"   # 优先 check，需要时才 write
npm run audit:l0-links
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
# 第一次 commit：锚点化 + 措辞（该提交入链）
git add w-model-dev/ && git commit -m "docs: anchor ordinary failure chain and close wording minors (review2-fixes)"
# 台账一致性（本次台账提交尚未创建，HEAD 即其父）：两文件提取的父链行与 Git 区间一致
git log --reverse --format='%H %s' bc48824..HEAD > "$TEMP/review2fix-ledger-expected.txt"
# 第二次 commit：台账收口（本提交自身按规则不入链，由下一轮活动链接）
git add CHANGELOG.md docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md && git commit -m "docs(changes): append review2-fixes ledger rows (close 27 findings)"
```

（`$TEMP` 在 Git Bash 下指 Windows 临时目录；比对方式与上一战役一致：从两文件提取 `| \`SHA\` | \`subject\` |` 行后与 expected 文件 diff 为空。）

---

## 收尾验收（控制器执行，不派实现子代理）

1. 全量回归（真实退出码逐条记录）：`npx vitest run --config config/vitest.config.ts`（预期全绿，用例数相对 1483 的变化如实登记）、`npm run self-test`（262/262）、`npm run eval`（25/25）、`npm run typecheck`、`npm run lint:security`、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`、`npm run audit:l0-links`、`npm run doctor`、`npm audit --audit-level=high`、`npm run prepush`（17 项全绿；已知负载敏感 flake 只隔离重跑并如实记录）。
2. 独立终审：范围 `f7f0bba..新 tip` 全部提交；0 Critical / 0 Important 且 Minor 有处置。
3. 终审 clean 且用户同意后：主工作树 `git merge --ff-only task/review2-fixes`；不 push（push 须用户明示）。
