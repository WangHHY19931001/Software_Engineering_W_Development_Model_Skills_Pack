# 观察项处理（pre-push 触发扩展 + 设计文档清理 + vitest 检查）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 处理上轮遗留的 3 个观察项：pre-push 触发过滤扩展至文档路径、docs/ 根历史设计文档清理、check-docs-consistency 新增 design-docs 与 vitest-files 两项检查。

**Architecture:** 门禁检查项 10→12（新增 design-docs、vitest-files），pre-push 项数不变（仍 14）；设计文档清理 8 处（2 份文件）；vitest 用例数 515→521 级联 11 处文档；版本 38.4.0 → 38.5.0。

**Tech Stack:** TypeScript strict（tsx runtime）、vitest、bash（pre-push）、Markdown。

**设计文档（SSoT）:** `docs/superpowers/specs/2026-08-10-observation-items-design.md`

---

## 文件结构

**Task 1**：`.githooks/pre-push`（触发过滤 + 跳过提示）
**Task 2**：`docs/llm-verifier-integration-design.md`、`docs/loop-engineering-adoption-design.md`（清理 8 处）
**Task 3-4**：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（+6 用例 + baseInput 更新）、`w-model-dev/scripts/docs-consistency-logic.ts`（checkDesignDocs + checkVitestFileCount + EXPECTED + 接口 + wiring）
**Task 5**：`w-model-dev/scripts/check-docs-consistency.ts`（读 6 设计文档 + 数测试文件 + REQUIRED_PATHS）
**Task 6**：级联 — README.md / AGENTS.md / CONTRIBUTING.md / .githooks/pre-push / docs/INSTALL.md / package.json / w-model-dev/skill-metadata.json / w-model-dev/SKILL.md / docs/skill-design-document_SSoT.md / CHANGELOG.md
**Task 7**：全量验证

---

### Task 1: pre-push 触发过滤扩展

**Files:**
- Modify: `.githooks/pre-push`（L95-99 过滤 case + L105 跳过提示）

- [ ] **Step 1: 扩展过滤 case**

将（约 L95-99）：
```bash
    case "$f" in
      w-model-dev/scripts/*) needs_gate=1; break ;;
      package.json)         needs_gate=1; break ;;
      .githooks/pre-push)   needs_gate=1; break ;;
    esac
```
替换为：
```bash
    case "$f" in
      w-model-dev/*)                             needs_gate=1; break ;;
      README.md|AGENTS.md|CONTRIBUTING.md|.gitignore|.eslintsecurity-baseline.json|package.json) needs_gate=1; break ;;
      .githooks/*)                               needs_gate=1; break ;;
      docs/*.md)                                 needs_gate=1; break ;;
      .cursor/skills/*)                          needs_gate=1; break ;;
    esac
```

- [ ] **Step 2: 更新跳过提示文案**

将（约 L105）：`ok "本次推送未触及 scripts/ / package.json / .githooks，跳过门禁"` 替换为：`ok "本次推送未触及门禁相关文件（scripts/ 文档 / schema / 配置），跳过门禁"`

- [ ] **Step 3: 验证 + Commit**

验证：`bash .githooks/pre-push --force` 仍 14 项全通过（bash 可用时）；语法检查 `bash -n .githooks/pre-push` 无错误。
```bash
git add .githooks/pre-push
git commit -m "feat(hooks): extend pre-push trigger filter to doc/schema/config paths"
```

### Task 2: 设计文档清理（8 处）

**Files:**
- Modify: `docs/llm-verifier-integration-design.md`
- Modify: `docs/loop-engineering-adoption-design.md`

- [ ] **Step 1: llm-verifier-integration-design.md L55**

`- **\`/wm review\` 不调用 LLM**：命令仅根据目标 ID 识别 \`targetKind\`（\`requirement\` / \`design\` / \`testcase\` / \`file\`），提示对应的子标准集合，并指引外部 Agent 加载 \`verifier-spec.md\` §8 提示词模板、再调用校验脚本。`
→ 同句将 `\`testcase\` / \`file\`` 改为 `\`code\` / \`test\``（其余不变）

- [ ] **Step 2: loop-engineering-adoption-design.md 7 处**

1. L517：`> 在 definition-of-done.md「五维度标准」表新增第六维度「理解证据」，与现有测试/行为/文档/RTM/状态并列。` → `> 在 definition-of-done.md「七维度标准」表新增第六维度「理解证据」，与现有测试/行为/文档/RTM/状态并列。`（仅「五维度标准」→「七维度标准」）
2. L520：`## 六维度标准（更新）` → `## 七维度标准（更新）`
3. L529（理解证据表行之后）追加第 7 行：`| **签名链完整性** | 每阶段每角色动作完成后写入 \`signature-chain.jsonl\`；G 跑门禁前校验 R1-R10 全通过 | \`check-signature-chain.ts\` R1-R10 | 补齐缺失角色签名与来源证明 |`
4. L549：`- SSoT §10.6「项目级 Definition of Done」：五维度扩展为六维度，新增「理解证据」。` → `- SSoT §10.6「项目级 Definition of Done」：五维度扩展为七维度，新增「理解证据」「签名链完整性」。`
5. L551：`- definition-of-done.md：五维度 → 六维度 + 自检清单新增条目。` → `- definition-of-done.md：五维度 → 七维度 + 自检清单新增条目。`
6. L587：`§10.6 六维度；` → `§10.6 七维度；`（该长行内唯一替换）
7. L591：`| \`w-model-dev/references/definition-of-done.md\` | 五维度 → 六维度 + 自检清单新增 | 优化4 |` → `| \`w-model-dev/references/definition-of-done.md\` | 五维度 → 七维度 + 自检清单新增 | 优化4 |`
8. L613：`- [ ] SSoT §10.6 六维度，definition-of-done.md 一致` → `- [ ] SSoT §10.6 七维度，definition-of-done.md 一致`

- [ ] **Step 3: 验证 + Commit**

Grep 两个文件：`五维度`、`六维度`、`\`testcase\``、`\`file\`` → 0 命中（注意：llm-verifier 中若还有其它 `file` 的一般性用法需人工确认非 targetKind 语义）。
```bash
git add docs/llm-verifier-integration-design.md docs/loop-engineering-adoption-design.md
git commit -m "docs: clean stale targetKind enum and DoD dimension refs in design docs"
```

### Task 3: TDD red — 新增 6 个失败测试

**Files:**
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **Step 1: 更新 baseInput 默认值**

将 baseInput 中：
```typescript
    readme: '7 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）',
    agents: '30 个脚本',
```
替换为：
```typescript
    readme: '7 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）\n35 files / 515 tests',
    agents: '30 个脚本\n35 个 .test.ts / 515 条',
```
并在 baseInput 对象中（`prePush:` 行之前）新增两字段：
```typescript
    designDocs: [],
    testFileCount: 35,
```

- [ ] **Step 2: 在 describe 末尾追加 6 个用例**

```typescript
  it('design-docs 含废弃 targetKind → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'llm-verifier', content: 'targetKind=file 路由' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('llm-verifier'))).toBe(true);
  });

  it('design-docs 含五维度 → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'loop-engineering', content: '五维度标准' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('五维度'))).toBe(true);
  });

  it('design-docs 含旧反模式区间 → 违规', () => {
    const input = baseInput({ designDocs: [{ name: 'round9', content: '反模式 #1~#29' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs' && x.message.includes('#1~#29'))).toBe(true);
  });

  it('design-docs 干净时零违规', () => {
    const input = baseInput({ designDocs: [{ name: 'x', content: 'requirement / design / code / test' }] });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'design-docs')).toBe(false);
  });

  it('vitest 文件数非 35 → 违规', () => {
    const input = baseInput({ testFileCount: 36 });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-files' && x.message.includes('35'))).toBe(true);
  });

  it('README/AGENTS 缺 vitest 文件数表述 → 违规', () => {
    const input = baseInput({ readme: '7 条核心操作行为\n7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）', agents: '30 个脚本' });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-files');
    expect(v.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 6 个新用例失败（`checkDesignDocs` / `checkVitestFileCount` 未实现 → 不产生违规 → 断言失败）；同时「全部一致时零违规」用例可能因 baseInput 默认含 designDocs 字段而……不，baseInput 已含新字段，逻辑层尚未校验它们，故除 6 个新用例外其余应仍通过。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "test: add failing design-docs and vitest-files check tests (TDD red)"
```

### Task 4: 实现 checkDesignDocs + checkVitestFileCount

**Files:**
- Modify: `w-model-dev/scripts/docs-consistency-logic.ts`

- [ ] **Step 1: 扩展接口与常量**

`DocConsistencyInput` 新增两字段（`prePush` 字段之后）：
```typescript
  /** docs/ 根 6 份设计文档（活体引用） */
  designDocs: Array<{ name: string; content: string }>;
  /** w-model-dev/scripts/__tests__/ 下 *.test.ts 文件数（期望 35） */
  testFileCount: number;
```
`EXPECTED` 新增：`vitestFileCount: 35,`（置于 `cursorSkillCount` 之后）
文件常量区新增（`STALE_RANGES` 附近）：

```typescript
/**
 * 过时 DoD 维度表述（用于 design-docs 检查）。
 * 注意：不用字面「五维度」——设计文档保留历史演变描述（如「五维度扩展为七维度」
 * 「新增第六维度」），仅当表述把当前标准说成五/六维度时才视为过时。
 */
const STALE_DOD_DIMENSIONS = [
  '五维度标准',       // 表名（当前为七维度标准）
  '六维度标准',       // 标题/表名（当前为七维度标准）
  '五维度 → 六维度',  // 演变终点停在六维度
  '五维度扩展为六维度',
  '六维度（更新）',   // 章节标题
  '§10.6 六维度',     // 过时 SSoT 引用
  '§10.6 五维度',     // 过时 SSoT 引用
];
```

- [ ] **Step 2: wiring**

`runDocConsistencyChecks` 末尾（`checkAssetCounts` 之后）追加：
```typescript
  violations.push(...checkDesignDocs(input.designDocs));
  violations.push(...checkVitestFileCount(input.testFileCount, input.readme, input.agents));
```

- [ ] **Step 3: 新增两个检查函数**

```typescript
function checkDesignDocs(designDocs: Array<{ name: string; content: string }>): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const doc of designDocs) {
    for (const token of FORBIDDEN_TARGETKIND) {
      if (doc.content.includes(token)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 检测到废弃 targetKind 标记「${token}」（应为 code/test）` });
      }
    }
    for (const stale of STALE_DOD_DIMENSIONS) {
      if (doc.content.includes(stale)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 仍含过时 DoD 维度表述「${stale}」（当前七维度）` });
      }
    }
    for (const stale of STALE_RANGES) {
      if (doc.content.includes(stale)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 仍含过时反模式区间「${stale}」` });
      }
    }
  }
  return violations;
}

function checkVitestFileCount(testFileCount: number, readme: string, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (testFileCount !== EXPECTED.vitestFileCount) {
    violations.push({ check: 'vitest-files', message: `实测 vitest 测试文件数应为 ${EXPECTED.vitestFileCount}，实际 ${testFileCount}（新增测试文件须同步文档与 EXPECTED）` });
  }
  if (!readme.includes(`${EXPECTED.vitestFileCount} files`)) {
    violations.push({ check: 'vitest-files', message: `README 应含「${EXPECTED.vitestFileCount} files」vitest 表述` });
  }
  if (!agents.includes(`${EXPECTED.vitestFileCount} 个 .test.ts`)) {
    violations.push({ check: 'vitest-files', message: `AGENTS.md 应含「${EXPECTED.vitestFileCount} 个 .test.ts」vitest 表述` });
  }
  return violations;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 23 用例全部通过（17 旧 + 6 新）。
Run: `npx tsc --noEmit` — 0 错误。

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/docs-consistency-logic.ts
git commit -m "feat: add design-docs and vitest-files checks to docs-consistency-logic (TDD green)"
```

### Task 5: CLI 更新

**Files:**
- Modify: `w-model-dev/scripts/check-docs-consistency.ts`

- [ ] **Step 1: REQUIRED_PATHS 追加**

在 `REQUIRED_PATHS` 数组末尾追加：
```typescript
  'docs/llm-verifier-integration-design.md',
  'docs/loop-engineering-adoption-design.md',
  'docs/information-flow-validation-design.md',
  'docs/ingestion-graph-convergence-design.md',
  'docs/skill-design-document.md',
  'docs/tla-plus-modeling-design.md',
  'w-model-dev/scripts/__tests__', // 目录（vitest 测试文件数）
```

- [ ] **Step 2: 新增常量与采集**

文件顶部（`REQUIRED_PATHS` 之后）新增：
```typescript
const DESIGN_DOC_PATHS = [
  'docs/llm-verifier-integration-design.md',
  'docs/loop-engineering-adoption-design.md',
  'docs/information-flow-validation-design.md',
  'docs/ingestion-graph-convergence-design.md',
  'docs/skill-design-document.md',
  'docs/tla-plus-modeling-design.md',
];
```
`main()` 中 `exit2ScriptCount` 计算之后新增：
```typescript
  const testFileCount = readdirSync(join(root, 'w-model-dev/scripts/__tests__')).filter((f) => f.endsWith('.test.ts')).length;
  const designDocs = DESIGN_DOC_PATHS.map((p) => ({ name: p.split('/').pop() ?? p, content: read(p) }));
```
`input` 对象新增两字段（`prePush` 之后）：
```typescript
    designDocs,
    testFileCount,
```

- [ ] **Step 3: 输出行更新**

`main()` 的人类可读输出在 `persona / cur` 行后新增：
```typescript
  console.log(`test 文件    : ${testFileCount}`);
```

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts .` — 期望 exit 0「✓ 全部一致」（12 项检查，含 design-docs / vitest-files）。
Run: `npx tsc --noEmit` — 0 错误。
```bash
git add w-model-dev/scripts/check-docs-consistency.ts
git commit -m "feat: wire design-docs and vitest-files checks into CLI"
```

### Task 6: 级联更新（用例数 515→521 + AGENTS 12 项 + 版本 38.5.0 + CHANGELOG）

**Files:**
- Modify: `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.githooks/pre-push` / `docs/INSTALL.md` / `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `docs/skill-design-document_SSoT.md` / `CHANGELOG.md`

- [ ] **Step 1: vitest 用例数 515 → 521（11 处）**

逐处把「515 条 / 515 tests」改为「521 条 / 521 tests」，文件与行（先 Read 确认当前文本）：
1. `CONTRIBUTING.md` L55：`35 个 test 文件 / 515 条` → `/ 521 条`
2. `CONTRIBUTING.md` L91：`35 files / 515 tests` → `35 files / 521 tests`
3. `CONTRIBUTING.md` L186：`35 个 .test.ts / 515 条` → `/ 521 条`
4. `AGENTS.md` L33（长行）：`35 个 .test.ts / 515 条` → `/ 521 条`
5. `AGENTS.md` L47：`35 个 .test.ts / 515 条` → `/ 521 条`
6. `AGENTS.md` L162：`vitest 515 条（35 test files）` → `vitest 521 条（35 test files）`
7. `README.md` L19：`35 files / 515 tests` → `35 files / 521 tests`
8. `README.md` L200：`35 个 .test.ts / 515 条` → `/ 521 条`
9. `.githooks/pre-push` L201：`35 test files / 515 tests` → `35 test files / 521 tests`
10. `docs/INSTALL.md` L74：`35 个 .test.ts / 515 条` → `/ 521 条`
11. `docs/INSTALL.md` L233：`35 个 test 文件 / 515 条` → `/ 521 条`

- [ ] **Step 2: AGENTS §8 行检查项 10 → 12**

`| check-docs-consistency.ts | 活体文档一致性门禁（schema 清单 / run-log action 枚举 / targetKind / DoD 维度 / 操作行为 / 反模式 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数） | - | 0=通过，1=不一致，2=输入错误 |`
→ `| check-docs-consistency.ts | 活体文档一致性门禁（schema 清单 / run-log action 枚举 / targetKind / DoD 维度 / 操作行为 / 反模式 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数 / design-docs / vitest-files） | - | 0=通过，1=不一致，2=输入错误 |`

- [ ] **Step 3: 版本 38.4.0 → 38.5.0（7 处）**

1. `package.json`：`"version": "38.4.0"` → `"version": "38.5.0"`
2. `w-model-dev/skill-metadata.json`：`"version": "38.4.0"` → `"version": "38.5.0"`（updatedAt 保持 2026-08-10）
3. `w-model-dev/SKILL.md` frontmatter：`version: 38.4.0` → `version: 38.5.0`
4. `README.md` L12：`**当前版本**：\`38.4.0\`` → `\`38.5.0\``
5. `docs/INSTALL.md` L141：`version: 38.4.0` → `version: 38.5.0`
6. `docs/skill-design-document_SSoT.md` L1092：`| 版本号 | 38.4.0（三处一致） |` → `| 版本号 | 38.5.0（三处一致） |`
7. `CONTRIBUTING.md` L231：`（如 \`v38.4.0\`）` → `（如 \`v38.5.0\`）`

- [ ] **Step 4: CHANGELOG 顶部新增 [38.5.0]（插在 `## [38.4.0]` 之前）**

```markdown
## [38.5.0] - 2026-08-10

### Added
- check-docs-consistency 新增 2 项检查（10 → 12 项）：design-docs（扫描 docs/ 根 6 份设计文档的废弃 targetKind / 五维度 / 旧反模式区间）、vitest-files（测试文件数 glob 校验，期望 35）
- pre-push 变更过滤扩展：w-model-dev/**、根级活体文档、.githooks/*、docs/*.md、.cursor/skills/*（文档推送自动触发门禁）

### Changed
- 设计文档清理：llm-verifier-integration-design.md targetKind 枚举 → code/test；loop-engineering-adoption-design.md DoD 维度 5 → 7（8 处）
- vitest 用例数 515 → 521（+6，design-docs + vitest-files 检查测试）；11 处文档同步
- AGENTS §8 check-docs-consistency 行「10 项」→「12 项确定性检查」
- 版本号 38.4.0 → 38.5.0（三处同步）
```

- [ ] **Step 5: 验证 + Commit**

Run: `npx tsx w-model-dev/scripts/check-docs-consistency.ts .` — exit 0。
Grep：活体文档 `515` → 0 命中；`38\.4\.0` → 0 命中（CHANGELOG 历史与 docs/superpowers/ 允许保留）。
```bash
git add README.md AGENTS.md CONTRIBUTING.md .githooks/pre-push docs/INSTALL.md package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md docs/skill-design-document_SSoT.md CHANGELOG.md
git commit -m "chore: cascade vitest 515->521, AGENTS 12 items, bump 38.5.0, changelog"
```

### Task 7: 全量验证

- [ ] **Step 1: 回归**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files / 521 tests 全过
npx tsc --noEmit             # 0 错误
npm run check:docs-consistency  # exit 0「✓ 全部一致」（12 项）
```

- [ ] **Step 2: 破坏样本**

1. 临时把 `w-model-dev/scripts/__tests__/budget-logic.test.ts` 改名（如加 `.bak` 后缀）→ `npm run check:docs-consistency` 期望 exit 1（vitest-files：实测 34 ≠ 35）→ 还原。
2. 临时改 `docs/llm-verifier-integration-design.md` 的 targetKind 枚举为 `\`testcase\` / \`file\`` → 期望 exit 1（design-docs 违规）→ 还原。
3. 还原后 `git status --short` 干净；`check:docs-consistency` exit 0。

- [ ] **Step 3: 零残留 grep**

`515`、`38\.4\.0`、`五维度`（6 份设计文档内）→ 活体文档 0 命中。

- [ ] **Step 4: pre-push + 触发验证**

```bash
bash .githooks/pre-push --force   # 14 项全通过
```
并验证过滤生效：`git diff --name-only` 模拟只改 README.md 的推送场景（可临时 `git stash` 后仅 touch README 再触发，或直接 push 观察门禁是否启动——推荐直接 push 到 origin main 验证，pre-push 应对文档改动触发门禁并全绿）。

- [ ] **Step 5: 记录结果** — 全部退出码 0 后完成。

---

## 自审记录（Self-Review）

- **Spec 覆盖**：S1（Task 1）、S2 清理（Task 2）+ design-docs 检查（Task 3-5）、S3（Task 3-5 vitest-files + Task 6 级联 515→521）、S4（Task 6 版本 + CHANGELOG）、S5（Task 7 验证）。全覆盖。
- **占位符扫描**：所有替换给出精确 old→new；代码完整；无 TBD/TODO。
- **类型一致性**：`DocConsistencyInput.designDocs` / `.testFileCount` 在 test（baseInput）、logic（接口）、CLI（input 构造）三处一致；`EXPECTED.vitestFileCount` 单点定义；`checkDesignDocs` / `checkVitestFileCount` 签名一致。
- **已捕获的坑**：baseInput 的 readme/agents 默认值须含 `35 files` / `35 个 .test.ts` 否则「全部一致零违规」用例失败（Task 3 Step 1 已处理）；vitest 用例数 515→521（6 新用例）；文件数仍 35（不加新测试文件）。
- **Task 2 执行期修正（checkDesignDocs 精确模式）**：Task 2 清理后 loop-engineering-adoption-design.md 仍保留 4 处历史演变描述（`五维度扩展为七维度` / `五维度 → 七维度` / `新增第六维度`，spec §4.1 明确要求保留）。若 checkDesignDocs 字面扫 `五维度` 将误报违规。故引入 `STALE_DOD_DIMENSIONS` 模式集（仅匹配把当前标准说成五/六维度的表述：`五维度标准` / `六维度标准` / `五维度 → 六维度` / `五维度扩展为六维度` / `六维度（更新）` / `§10.6 五维度` / `§10.6 六维度`），历史演变描述不触发。
- **Task 7 验证期修正（design-docs 括号枚举盲区 + baseline 重生成）**：(1) 破坏样本发现 FORBIDDEN_TARGETKIND 8 token 均为赋值/JSON 形式，不匹配 Task 2 清理的 `` `targetKind`（…`testcase` / `file`）`` 括号枚举形式 → checkDesignDocs 追加 `TARGETKIND_ENUM_PATTERN` 正则检测（`` `targetKind`\s*（[^）]*） `` 括号内含 testcase/file 即违规），测试「含废弃 targetKind」用例 content 改为同时含两种形式；(2) `check-docs-consistency.ts:79` 新增 readdirSync 触发 security-scan `detect-non-literal-fs-filename` → `--regenerate` 重生成 baseline（237→238，指纹 8d41acdf 计入）。
