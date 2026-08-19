# W-Model 技能包核查报告六项修复实施计划（2026-08-19）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复外部核查报告六项实锤问题（P1×4 + P2×2），反哺两项防复发门禁（pre-push 第 17 项 tsc + docs-consistency 覆盖扩展），发布 41.19.0。

**Architecture:** 按依赖序 5 批推进（仓库卫生 → typecheck 门禁 → 门禁扩展与计数同步 → 警告/PR 模板强化 → 发布收尾），每批 1 个 commit 共 5 个，批内先代码后文档，全部完成后统一跑 prepush 17 项终验，不自动 push。规格见 [2026-08-19-audit-six-fixes-design.md](../specs/2026-08-19-audit-six-fixes-design.md)。

**Tech Stack:** bash（.githooks/pre-push）、TypeScript + tsx（w-model-dev/scripts/{cli,logic}）、vitest（__tests__）、npm（package-lock / audit / version-bump.cjs）。

**计划制定时已预验证的事实（执行者无需重查，直接采信）：**

- `npx tsc -p config/tsconfig.json` 当前 **exit 0（0 错误）**——批2 步骤 0 前置检查预期直接通过（R1 已排雷）
- self-test 256/256、vitest 47 files / 717 tests 当前全绿（2026-08-19 实跑确认）
- vitest 6 个新增用例后用例总数 N 预期 = **723**（执行时以 vitest 实测输出为准）
- **复核补充发现**：`docs/INSTALL.md` :83/:248 亦存在 P1-1 同类漂移（「40 个 .test.ts / 623 条」/「40 个 test 文件 / 623 条」）——Task 7 已增同步步骤；`checkVitestTestCount` 现 docs 数组不含 INSTALL，参数化（Task 4）后经 `vitestExtraDocs` 注入一并检查
- `config/.eslintrc.cjs` 启用 `security/detect-non-literal-regexp: 'error'`：Task 4 采用**参数化方案**（不新增 `new RegExp`，复用既有 pattern 行），`npm run lint:security` 预期保持 exit 0、**免 baseline 再生**（Task 6 Step 3 已按此重写；若意外出现新发现仍按该步兜底流程再生）
- 测试 `docs-consistency-logic.test.ts:327` 断言 `includes('16')`，EXPECTED 改 17 后须同步改（Task 2 Step 6）

---

## Task 1: 批1 仓库卫生——IDE 产物出库 + package-lock 入库（P1-3 + P1-4）

**Files:**
- Modify: `.gitignore`
- git 操作: `git rm --cached -r .trae-html-share-packages` / `git add package-lock.json`

- [ ] **Step 1: .gitignore 追加 IDE 分享产物忽略条目**

`.gitignore` 的 IDE 节（`*.swo` 行之后）追加：

```
# IDE
.vscode/
.idea/
*.swp
*.swo

# Trae IDE HTML 分享产物（会话生成，非仓库资产）
.trae-html-share-packages/
```

（即把原 IDE 节 4 行替换为上面 7 行。）

- [ ] **Step 2: IDE 产物移出版本控制（保留本地文件）**

```bash
git rm --cached -r .trae-html-share-packages
```

Expected: 输出 `rm '.trae-html-share-packages/docs/index.html.zip'`；本地文件仍在磁盘。

- [ ] **Step 3: .gitignore 移除 package-lock.json 忽略行**

`.gitignore` 原 44-47 行：

```
# npm 安装产物
package-lock.json
npm-debug.log*
yarn-error.log*
```

替换为：

```
# npm 运行产物（package-lock.json 已入库：依赖树与 npm audit 可复现）
npm-debug.log*
yarn-error.log*
```

- [ ] **Step 4: 刷新并暂存 lock 文件**

```bash
npm install --package-lock-only
git add package-lock.json .gitignore
```

Expected: lock 刷新成功（node_modules 不变）；`git status --short` 显示 `D  .trae-html-share-packages/docs/index.html.zip`、`A  package-lock.json`、`M  .gitignore`。

- [ ] **Step 5: npm audit 预检（R2）**

```bash
npm audit --audit-level=high
```

Expected: exit 0（无 high 以上漏洞）。**非 0 → 停止执行，向用户汇报漏洞清单**（按规格 §7 R2：升级 devDeps 并回归 vitest 后再继续，须先获批）。

- [ ] **Step 6: Commit（批1）**

```bash
git commit -m "chore(repo): IDE 分享产物出库 + package-lock 入库（依赖可复现）"
```

---

## Task 2: 批2 typecheck 门禁接入——代码与钩子（P1-2）

**Files:**
- Modify: `package.json:24`（scripts //3 工具类组）
- Modify: `.githooks/pre-push:142`（注释）与 `:248` 后（追加第 17 项）
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts:90`（EXPECTED）
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts:126`（fixture）与 `:322-328`（负向用例）

- [ ] **Step 1: 步骤 0 前置检查——tsc 实跑（R1）**

```bash
npx tsc -p config/tsconfig.json
```

Expected: 无输出、退出码 0（计划制定时已预验证通过）。**非 0 → 停止执行**，按规格 §4 批2 步骤 0 处置：清点错误 → 分诊 → 向用户汇报获批后才修。

- [ ] **Step 2: package.json 加 typecheck script**

在 `"lint:security"` 行后追加一行：

```json
    "lint:security": "tsx w-model-dev/scripts/cli/security-scan.ts",
    "typecheck": "tsc -p config/tsconfig.json",
```

- [ ] **Step 3: pre-push 追加第 17 项 + 项数注释**

原 245-250 行：

```bash
# 16. prettier --check：格式一致性门禁（config/prettier.config.cjs，endOfLine=auto 双平台行尾兼容）
#     堵住「npm run format 非幂等」回归——任何 .ts/.cjs 编辑未跑 format 即被阻断
run_expect "prettier 格式一致性（--check）" 0 \
  npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs" || exit 1

log "全部门禁通过，允许推送 ✓"
```

替换为（**保留 prettier 两行注释结构**，仅在其后追加第 17 项块，不压缩注释信息）：

```bash
# 16. prettier --check：格式一致性门禁（config/prettier.config.cjs，endOfLine=auto 双平台行尾兼容）
#     堵住「npm run format 非幂等」回归——任何 .ts/.cjs 编辑未跑 format 即被阻断
run_expect "prettier 格式一致性（--check）" 0 \
  npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs" || exit 1

# 17. tsc 类型检查：TypeScript strict 0 错误（对齐 SSoT §10H.5 V1 验证门；
#     README 健康指标「tsc 0 错误」由手动验证升级为自动化门禁）
run_expect "tsc 类型检查 0 错误" 0 \
  npx tsc -p config/tsconfig.json || exit 1

log "全部门禁通过，允许推送 ✓"
```

另将 `:142` 行：

```bash
# 全部门禁共 16 项检查（第 13 项 npm audit 为阻断项），退出码必须全部符合预期才放行。
```

改为：

```bash
# 全部门禁共 17 项检查（第 13 项 npm audit 为阻断项），退出码必须全部符合预期才放行。
```

- [ ] **Step 4: docs-consistency-logic.ts EXPECTED 16→17**

`EXPECTED` 常量中：

```ts
  prePushCount: 16,
```

改为：

```ts
  prePushCount: 17,
```

- [ ] **Step 5: 测试 fixture :126 同步 17**

```ts
    prePush: '# 16. prettier-check\n# 与原 CI 一致：16 项检查\n# vitest 全量（530 tests）',
```

改为：

```ts
    prePush: '# 17. typecheck\n# 与原 CI 一致：17 项检查\n# vitest 全量（530 tests）',
```

- [ ] **Step 6: 负向用例 :322-328 断言同步（含测试名）**

原：

```ts
  it('pre-push 编号最大值非 16 → 违规', () => {
    const input = baseInput({
      prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('16'))).toBe(true);
  });
```

改为：

```ts
  it('pre-push 编号最大值非 17 → 违规', () => {
    const input = baseInput({
      prePush: '# 13. npm audit\n# 与原 CI 一致：13 项检查',
    });
    const v = runDocConsistencyChecks(input);
    expect(v.some((x) => x.check === 'pre-push' && x.message.includes('17'))).toBe(true);
  });
```

（:484 的 15 项负向用例断言 `includes('530')`，与项数无关，**不动**。）

- [ ] **Step 7: 语法与格式校验**

```bash
bash -n .githooks/pre-push
npm run format
```

Expected: 两者均无错误（format 可能输出无改动或仅本批 .ts 文件被格式化）。

- [ ] **Step 8: vitest 回归（本批不增用例，总数不变）**

```bash
npx vitest run --config config/vitest.config.ts
```

Expected: `47 files` / `717 tests` 全部通过。任何失败 → 回查 Step 4-6 改动。

---

## Task 3: 批2 活体文档 16→17 同步 + 提交（P1-2 文档面）

**Files:**
- Modify: `README.md`（:23 / :153 / :159 / :343）
- Modify: `AGENTS.md`（:45 / :71）
- Modify: `CONTRIBUTING.md`（:81 / 门禁表 / :165 / :182）
- Modify: `docs/troubleshooting.md`（:28 / :99）

- [ ] **Step 1: README.md 四处 16→17**

- `:23`：`| Pre-push 门禁（本地 CI） | ✅ 16 项全通过（Git Bash 与 WSL 双平台实测） |` → `✅ 17 项全通过（…）`
- `:153`：`**步骤 4：跑本地 pre-push 门禁（16 项）**` → `（17 项）`
- `:159`：`强制跑 16 项门禁：self-test 回归、…、samples 覆盖矩阵（check-samples-coverage）、prettier 格式一致性。任一失败即中止。` → `强制跑 17 项门禁：…、prettier 格式一致性、tsc 类型检查。任一失败即中止。`（枚举末尾追加「tsc 类型检查」）
- `:343`：`├── .githooks/pre-push            # 本地推送前门禁（16 项，替代远程 CI；…` → `（17 项，…）`

- [ ] **Step 2: AGENTS.md 两处 16→17（:45 补 tsc 枚举）**

- `:45`：`自动跑 16 项门禁（self-test + … + samples 覆盖矩阵 + prettier 格式一致性）` → `自动跑 17 项门禁（… + samples 覆盖矩阵 + prettier 格式一致性 + tsc 类型检查）`
- `:71`：`# 手动跑推送前门禁（不实际推送，16 项门禁检查；…）` → `17 项门禁检查`

- [ ] **Step 3: CONTRIBUTING.md 三处 16→17 + 门禁表加第 17 行**

- `:81`：`在 \`git push\` 时自动跑 16 项检查；` → `自动跑 17 项检查；`
- 门禁表 `:100`（第 16 行 prettier 行）后追加：

```markdown
| 17 | `npx tsc -p config/tsconfig.json`（TypeScript strict 类型检查 0 错误，对齐 SSoT §10H.5） | 0 |
```

- `:165`：`（16 项本地门禁，替代云端 CI；…）` → `（17 项本地门禁，…）`
- `:182`：`由本地 \`npm run prepush\`（16 项门禁）验证` → `（17 项门禁）`

- [ ] **Step 4: troubleshooting.md 两处 16→17**

- `:28`：`确认 16 项门禁全部通过后再合入` → `确认 17 项门禁全部通过后再合入`
- `:99`：`| Windows + Git Bash | … | 正常执行 16 项门禁 | — |` → `正常执行 17 项门禁`

- [ ] **Step 5: 残留 grep 验证**

```bash
git grep -n "16 项" -- ':!CHANGELOG.md' ':!CHANGELOG-archive.md' ':!docs/changes' ':!docs/superpowers'
```

Expected: **零输出**（CHANGELOG 历史条目与 superpowers 归档不计）。有输出 → 补改后重跑。

- [ ] **Step 6: 批2 收尾验证（self-test + typecheck + docs-consistency）**

```bash
npm run self-test
npm run typecheck
npm run check:docs-consistency
```

Expected: 256/256；tsc 0 错误；docs-consistency exit 0（此时 CONTRIBUTING/PR 模板新检查尚未挂载，717 计数未变，全绿）。

- [ ] **Step 7: Commit（批2，含 Task 2 全部改动）**

```bash
git add package.json .githooks/pre-push w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts README.md AGENTS.md CONTRIBUTING.md docs/troubleshooting.md
git commit -m "feat(gate): pre-push 新增第 17 项 tsc 类型检查门禁（对齐 SSoT §10H.5 V1）"
```

---

## Task 4: 批3 logic 层扩展——checkVitestTestCount 参数化 + PR 模板项数检查（P1-1）

**Files:**
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`（input 接口 / checkVitestTestCount 参数化 / 新函数 / 挂载）

- [ ] **Step 1: DocConsistencyInput 加两个可选字段**

`prePush: string;` 行（:39）后追加：

```ts
  /** vitest 计数检查的额外文档原文（可选——缺省跳过；CLI 层注入 CONTRIBUTING.md 与 docs/INSTALL.md，与 linkDocs 注入策略一致） */
  vitestExtraDocs?: Array<{ name: string; content: string }>;
  /** .github/PULL_REQUEST_TEMPLATE.md 原文（可选——缺省时跳过 PR 模板门禁项数检查） */
  prTemplate?: string;
```

- [ ] **Step 2: checkVitestTestCount 参数化——docs 数组拼接 extraVitestDocs（复用既有存在性 + 两套 stale 正则，不新增 `new RegExp`）**

函数签名追加可选参数，docs 数组构造改为拼接（`pattern` 行与其余循环逻辑**原样保留**）：

```ts
function checkVitestTestCount(
  vitestTestCount: number,
  testFileCount: number,
  readme: string,
  agents: string,
  prePush: string,
  extraVitestDocs?: Array<{ name: string; content: string }>,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (vitestTestCount < 0) return violations;
  const pattern = new RegExp(`\\b${vitestTestCount}\\s*(?:tests?\\b|条)`);
  const docs: Array<[string, string]> = [
    ['README.md', readme],
    ['AGENTS.md', agents],
    ['.githooks/pre-push', prePush],
    ...(extraVitestDocs?.map((d) => [d.name, d.content] as [string, string]) ?? []),
  ];
  // ……（既有存在性检查 + 两套 stale 正则循环逻辑完全不变）
```

> 说明：`installDoc`（必填字段，version-consistency 数据源）**不作为** vitest 检查触发条件——baseInput fixture 的 installDoc 是版本号文本、不含计数，以它为条件会打破存量正向用例。INSTALL.md 的 vitest 计数经 CLI 层注入的 `vitestExtraDocs` 检查；fixture 缺省不注入即跳过，存量 78 条单测零破坏。

- [ ] **Step 3: 新增 checkPrTemplatePrePushCount**

在 `checkVitestTestCount` 函数结束（:769 `}` 后）与 `checkBaselineSync` 注释之间插入：

```ts
/**
 * PR 模板 pre-push 项数同步检查（P1-1 反哺）：模板内全部「N 项」表述须与
 * EXPECTED.prePushCount 一致。历史盲区：PR 模板曾长期停留「14 项通过」。
 * prTemplate 未注入（缺省）时跳过。字面量正则 → 不触发 detect-non-literal-regexp。
 */
function checkPrTemplatePrePushCount(prTemplate: string | undefined): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (prTemplate === undefined) return violations;
  const re = /(\d+)\s*项/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prTemplate)) !== null) {
    if (Number(m[1]) !== EXPECTED.prePushCount) {
      violations.push({
        check: 'pre-push',
        message: `.github/PULL_REQUEST_TEMPLATE.md 存在过期门禁项数「${m[0]}」（当前 ${EXPECTED.prePushCount} 项），须同步`,
      });
    }
  }
  return violations;
}
```

- [ ] **Step 4: runDocConsistencyChecks 挂载更新**

原 151-153 三行替换为：

```ts
  violations.push(
    ...checkVitestTestCount(
      input.vitestTestCount,
      input.testFileCount,
      input.readme,
      input.agents,
      input.prePush,
      input.vitestExtraDocs,
    ),
  );
  violations.push(...checkPrTemplatePrePushCount(input.prTemplate));
```

---

## Task 5: 批3 CLI 层接入——REQUIRED_PATHS + read 注入（P1-1）

**Files:**
- Modify: `w-model-dev/scripts/cli/check-docs-consistency.ts`（REQUIRED_PATHS :66 后 / input 组装 :335 后）

- [ ] **Step 1: REQUIRED_PATHS 追加两路径**

`'AGENTS.md',` 行后追加两行：

```ts
  'AGENTS.md',
  'CONTRIBUTING.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
```

- [ ] **Step 2: input 组装注入两字段**

`prePush: read('.githooks/pre-push'),` 行后追加：

```ts
    prePush: read('.githooks/pre-push'),
    vitestExtraDocs: [
      { name: 'CONTRIBUTING.md', content: read('CONTRIBUTING.md') },
      { name: 'docs/INSTALL.md', content: read('docs/INSTALL.md') },
    ],
    prTemplate: read('.github/PULL_REQUEST_TEMPLATE.md'),
```

---

## Task 6: 批3 新增单测 + security 预检（P1-1）

**Files:**
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（vitest-tests 用例块后追加 6 用例）
- Modify（再生）: `.eslintsecurity-baseline.json`

- [ ] **Step 1: 追加 6 个新用例**

在 `AGENTS 含过期 .test.ts 计数（文件数不符）→ vitest-tests 违规` 用例结束后追加（vitestExtraDocs 注入 CONTRIBUTING / INSTALL，prTemplate 注入 PR 模板）：

```ts
  it('CONTRIBUTING 含过期 vitest 计数（40 files / 623 tests）→ vitest-tests 违规', () => {
    const input = baseInput({
      vitestExtraDocs: [{ name: 'CONTRIBUTING.md', content: '| 12 | vitest 全量（40 files / 623 tests） | 0 |' }],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(
      v.some((x) => x.message.includes('CONTRIBUTING.md') && x.message.includes('40 files / 623 tests')),
    ).toBe(true);
  });

  it('CONTRIBUTING 计数与实测一致 → 零 vitest-tests 违规', () => {
    const input = baseInput({
      vitestExtraDocs: [
        { name: 'CONTRIBUTING.md', content: '单元测试全量（40 files / 530 tests）。\n（40 个 .test.ts / 530 条）' },
      ],
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'vitest-tests')).toBe(false);
  });

  it('INSTALL 含过期 vitest 计数（40 个 .test.ts / 623 条）→ vitest-tests 违规（P1-1 复核补充）', () => {
    const input = baseInput({
      vitestExtraDocs: [{ name: 'docs/INSTALL.md', content: '# vitest 单元测试（40 个 .test.ts / 623 条）' }],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'vitest-tests');
    expect(
      v.some((x) => x.message.includes('docs/INSTALL.md') && x.message.includes('40 个 .test.ts / 623 条')),
    ).toBe(true);
  });

  it('PR 模板含过期门禁项数（14 项）→ pre-push 违规', () => {
    const input = baseInput({
      prTemplate: '- [ ] `npm run prepush` 14 项通过',
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'pre-push');
    expect(
      v.some((x) => x.message.includes('PULL_REQUEST_TEMPLATE') && x.message.includes('14 项')),
    ).toBe(true);
  });

  it('PR 模板项数与 EXPECTED 一致 → 零 pre-push 违规', () => {
    const input = baseInput({
      prTemplate: '- [ ] `npm run prepush` 17 项通过',
    });
    expect(runDocConsistencyChecks(input).some((x) => x.check === 'pre-push')).toBe(false);
  });

  it('vitestExtraDocs / prTemplate 缺省注入 → 跳过检查不产生违规', () => {
    expect(
      runDocConsistencyChecks(baseInput()).some(
        (x) => x.message.includes('CONTRIBUTING.md') || x.message.includes('PULL_REQUEST_TEMPLATE'),
      ),
    ).toBe(false);
  });
```

- [ ] **Step 2: 格式化 + 全量 vitest，记录实测用例总数 N**

```bash
npm run format
npx vitest run --config config/vitest.config.ts
```

Expected: `47 files` / **N = 723**（717 + 6）全部通过。**将实测 N 记下来，Task 7 全程使用**；若 N ≠ 723（如 prettier 改行导致用例数不变或运行器差异），以实测值为准。

- [ ] **Step 3: security-scan 预检（参数化方案预期免再生）**

```bash
npm run lint:security
```

Expected: **exit 0**——Task 4 参数化不新增 `new RegExp`（`pattern` 行原样保留；`checkPrTemplatePrePushCount` 用字面量正则），无新发现、**免 baseline 再生**。

**兜底**：若意外 exit 1（如 prettier 对既有 `pattern` 行重排导致 baseline 指纹变化），执行再生并汇报：

```bash
npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate
npm run lint:security
```

Expected: 再生后第二次运行 exit 0。若第一次就 exit 0 则跳过再生。

---

## Task 7: 批3 活体文档计数同步（717/623/14 项 → N/17 项）+ 提交（P1-1）

**Files:**
- Modify: `README.md`（:19 / :159 / :318）、`AGENTS.md`（:34 / :48 / :153）、`CONTRIBUTING.md`（:57 / :96 / :214 / :258 / :262）、`docs/INSTALL.md`（:83 / :248）、`.githooks/pre-push:206`、`.github/PULL_REQUEST_TEMPLATE.md:13`

以下 N 均替换为 **Task 6 Step 2 实测值（预期 723）**。

- [ ] **Step 1: README.md 三处 717→N**

- `:19`：`| Vitest（门禁脚本单元测试） | ✅ 47 files / 717 tests |` → `47 files / N tests`
- `:159`：`vitest 全量（47 files / 717 tests）` → `（47 files / N tests）`
- `:318`：`│   │   └── __tests__/            # vitest 单元测试（47 个 .test.ts / 717 tests）` → `（47 个 .test.ts / N tests）`

- [ ] **Step 2: AGENTS.md 三处 717→N**

- `:34`：`__tests__/（vitest 单元测试，47 个 .test.ts / 717 条 + README.md coverage 矩阵）` → `47 个 .test.ts / N 条`
- `:48`：`（vitest，47 个 .test.ts / 717 条）` → `47 个 .test.ts / N 条`
- `:153`：`| self-test.ts | 回归基线（256 条样本）；vitest 717 条（47 test files） | - | 0=通过，1=失败 |` → `vitest N 条（47 test files）`

- [ ] **Step 3: CONTRIBUTING.md 五处（:96 为 623 漂移修正；:258/:262 为版本机制「五处」→「六处」复核补充）**

- `:57`：`# 3.1 单元测试（vitest，47 个 test 文件 / 717 条，…）` → `47 个 test 文件 / N 条`
- `:96`（门禁表第 12 行）：`…阈值不达标 vitest exit 1；40 files / 623 tests） | 0 |` → `…；47 files / N tests） | 0 |`
- `:214`：`│   ├── __tests__/                 # vitest 单元测试（47 个 .test.ts / 717 条 + README.md coverage 矩阵）` → `47 个 .test.ts / N 条`
- `:258`：`2. 同步版本号五处：…` → `2. 同步版本号六处：…`（补 `CHANGELOG.md`；`version-bump.cjs` 实际同步六文件，与 `checkVersionConsistency` 六参比对一致；修正同文件 :191「六处一致性」自相矛盾）
- `:262`：`> 本仓库版本号以 git tag + 五处一致为准（门禁校验五处…` → `六处一致为准（门禁校验六处…`

- [ ] **Step 4: docs/INSTALL.md 两处 40/623 → 47 files / N（复核补充：INSTALL 亦存在 P1-1 同类漂移，Task 4 vitestExtraDocs 已纳入检查）**

- `:83`：`│   └── __tests__/      # vitest 单元测试（40 个 .test.ts / 623 条 + README.md coverage 矩阵）` → `（47 个 .test.ts / N 条 + …）`
- `:248`：`…（`w-model-dev/scripts/__tests__/` 单元测试，40 个 test 文件 / 623 条）` → `…单元测试，47 个 test 文件 / N 条）`

- [ ] **Step 5: pre-push :206 注释同步**

`# 12. vitest 单元测试全量通过（47 test files / 717 tests）+ coverage 阈值门禁…` → `（47 test files / N tests）`

- [ ] **Step 6: PR 模板 :13 项数修正**

`- [ ] \`npm run prepush\` 14 项通过` → `- [ ] \`npm run prepush\` 17 项通过`

- [ ] **Step 7: 残留 grep 验证**

```bash
git grep -nE "717|623" -- ':!CHANGELOG.md' ':!CHANGELOG-archive.md' ':!docs/changes' ':!docs/superpowers' ':!.eslintsecurity-baseline.json' ':!w-model-dev/scripts/samples'
git grep -n "14 项" -- ':!CHANGELOG.md' ':!CHANGELOG-archive.md' ':!docs/changes' ':!docs/superpowers'
git grep -nE "版本号五处|门禁校验五处" -- CONTRIBUTING.md
```

Expected: 前两条零输出（baseline 哈希与 samples fixture 内容中的 717 子串已排除）；第三条零输出（CONTRIBUTING 版本机制已改六处）。

- [ ] **Step 8: 三重验证**

```bash
npm run self-test
npx vitest run --config config/vitest.config.ts
npm run check:docs-consistency
```

Expected: 256/256；47 files / N 全绿；docs-consistency exit 0（新挂载的 CONTRIBUTING/INSTALL/PR 模板检查在文档同步后通过）。

- [ ] **Step 9: Commit（批3，含 Task 4-6 全部改动）**

```bash
git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md .githooks/pre-push .github/PULL_REQUEST_TEMPLATE.md
git commit -m "feat(gate): docs-consistency 扩展 CONTRIBUTING/INSTALL/PR 模板计数校验（审计 P1-1 反哺）"
```

---

## Task 8: 批4 pre-push 纯 Windows 警告升级 + troubleshooting 同步（P2-1）

**Files:**
- Modify: `.githooks/pre-push:56-61`
- Modify: `docs/troubleshooting.md:13`（FAQ 1.1 现象）

- [ ] **Step 1: 纯 Windows 分支警告升级（保留 exit 0）**

原 56-61 行：

```bash
if is_pure_windows_shell; then
  printf '[pre-push] \033[33m⚠\033[0m 检测到纯 Windows cmd/PowerShell 环境（无 bash 解释器）\n' 2>/dev/null || true
  printf '[pre-push] \033[33m⚠\033[0m 请安装 Git for Windows 并使用 Git Bash 运行：npm run prepush\n' 2>/dev/null || true
  printf '[pre-push] \033[33m⚠\033[0m 本次推送门禁已跳过（exit 0）\n' 2>/dev/null || true
  exit 0
fi
```

替换为：

```bash
if is_pure_windows_shell; then
  printf '[pre-push] \033[31m✗\033[0m 检测到纯 Windows cmd/PowerShell 环境（无 bash 解释器）\n' 2>/dev/null || true
  printf '[pre-push] \033[31m✗\033[0m 本次推送未执行 17 项门禁（exit 0 放行）——推送未经任何校验\n' 2>/dev/null || true
  printf '[pre-push] \033[31m✗\033[0m 关键门禁：self-test / vitest 全量 / docs-consistency / tsc 类型检查 等 17 项\n' 2>/dev/null || true
  printf '[pre-push] \033[31m✗\033[0m 请安装 Git for Windows 并在 Git Bash 补跑：npm run prepush（全绿后再合入）\n' 2>/dev/null || true
  exit 0
fi
```

- [ ] **Step 2: bash 语法校验**

```bash
bash -n .githooks/pre-push
```

Expected: 无输出（语法正确）。

- [ ] **Step 3: troubleshooting FAQ 1.1 现象同步**

`:13` 行：

```markdown
- `git push` 时终端出现 `[pre-push] ⚠ 检测到纯 Windows cmd/PowerShell 环境（无 bash 解释器）` 提示。
```

改为：

```markdown
- `git push` 时终端出现红色 `[pre-push] ✗ 检测到纯 Windows cmd/PowerShell 环境` 与「本次推送未执行 17 项门禁（exit 0 放行）」提示。
```

（FAQ 1.1 其余内容与 :22「注意」节已描述 exit 0 放行语义，不动。）

---

## Task 9: 批4 PR 模板可勾选清单重构 + 提交（P2-2）

**Files:**
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`（整体重构）

- [ ] **Step 1: PR 模板重构为可勾选清单 + 门禁输出要求**

全文替换为：

```markdown
## 关联 Issue

closes #N

## 变更类型

- [ ] feat / fix / refactor / docs / test / chore / ci

## 校验要点

> 本仓库无云端 CI，以下为本地门禁（`.githooks/pre-push`，Git Bash 下执行）。

- [ ] `npm run prepush` 17 项通过（输出摘要附下方「门禁输出」节）
- [ ] 未新增 `.test.ts`（如新增，已同步 vitest 计数与 `w-model-dev/scripts/__tests__/README.md`）
- [ ] 涉及规则：（列出的反模式 / 阶段约束，如 R1-R5 / D7）

## 门禁输出

（附 `npm run prepush` 运行输出末尾摘要：各门禁项 ✓ 行 + 「全部门禁通过，允许推送 ✓」）

## 覆盖规则

（列出本 PR 影响的校验规则 ID）
```

- [ ] **Step 2: 批4 收尾验证（self-test + vitest + docs-consistency）**

```bash
npm run self-test
npx vitest run --config config/vitest.config.ts
npm run check:docs-consistency
```

Expected: 256/256；47 files / N 全绿（N = Task 6 实测值）；docs-consistency exit 0（模板内「17 项」与新检查一致）。

- [ ] **Step 3: Commit（批4，含 Task 8 全部改动）**

```bash
git add .githooks/pre-push docs/troubleshooting.md .github/PULL_REQUEST_TEMPLATE.md
git commit -m "feat(hook): 纯 Windows 警告升级为红色未跑清单 + PR 模板可勾选清单与门禁输出要求"
```

---

## Task 10: 批5 发布收尾——41.19.0（version bump + CHANGELOG + prepush 终验）

**Files:**
- Modify: 六处版本文件（version-bump 自动）+ `CHANGELOG.md`（正文）

- [ ] **Step 1: 版本六处同步 + CHANGELOG 节头**

```bash
npm run version:bump -- 41.19.0
```

Expected: package.json / SKILL.md frontmatter / skill-metadata.json / README「当前版本」/ docs/INSTALL.md / CHANGELOG.md 六处变更为 41.19.0，CHANGELOG 顶部插入空节头。

- [ ] **Step 2: 填 CHANGELOG 正文（N 用实测值替换）**

在 `## [41.19.0] - <日期>` 节头下填入：

```markdown
### 修复（核查报告 2026-08-19 六项问题）

- **P1-1 文档数字漂移**：CONTRIBUTING 门禁表 vitest 计数 40/623 → 47/N（与同文件 :214 自相矛盾修复）；docs/INSTALL.md :83/:248 同类漂移一并修正（复核补充）；PR 模板「14 项」→「17 项」；docs-consistency 新增 `vitestExtraDocs` / `prTemplate` 可选输入（checkVitestTestCount 参数化 + checkPrTemplatePrePushCount），堵住 REQUIRED_PATHS 未覆盖 CONTRIBUTING/INSTALL/PR 模板的盲区；CONTRIBUTING 版本机制「五处」→「六处」同步
- **P1-2 typecheck 门禁**：package.json 新增 `typecheck` script；pre-push 第 17 项 `npx tsc -p config/tsconfig.json`（对齐 SSoT §10H.5 V1）——README 健康指标「tsc 0 错误」由手动验证升级为自动化门禁
- **P1-3 IDE 产物出库**：`.trae-html-share-packages/` 移出版本控制并加入 .gitignore（会话生成物，非仓库资产）
- **P1-4 依赖可复现**：package-lock.json 入库（.gitignore 移除忽略行），不同环境 install 结果与 npm audit 行为可复现
- **P2-1 纯 Windows 警告升级**：pre-push 无 bash 环境时黄色 ⚠ 升级为红色 ✗ + 「本次推送未执行 17 项门禁」明示 + 补跑指引（保留 exit 0 刻意妥协）
- **P2-2 PR 模板强化**：校验要点改可勾选清单 + 新增「门禁输出」节要求附 prepush 末尾摘要（远程 runner 仍受限，不加 GitHub Actions）
```

- [ ] **Step 3: prepush 17 项终验**

```bash
npm run prepush
```

Expected: 17 项全绿，末尾「全部门禁通过，允许推送 ✓」（Windows 下经 Git Bash 执行；npm audit 网络不可达时该项按既有策略 warn 跳过，不算失败）。任何一项失败 → 修复后重跑，不得跳过。

- [ ] **Step 4: Commit（批5）**

```bash
git add -A
git commit -m "chore(release): 41.19.0 — 核查报告六项修复全量同步"
```

- [ ] **Step 5: 汇报（不 push）**

向用户汇报：5 个 commit 清单、prepush 17 项结果、实测 N、DoD 8 条逐项核对结果。**由用户决定是否推送。**

---

## 验证总表

| 批次 | Commit | 收尾验证 |
|---|---|---|
| 批1 | `chore(repo)` | git status 复核 + npm audit 预检 |
| 批2 | `feat(gate)` | bash -n + format + vitest 717 + grep 零残留 + docs-consistency |
| 批3 | `feat(gate)` | format + vitest N=723 + lint:security（exit 0 免再生，意外才再生）+ self-test 256 + docs-consistency + grep 零残留 |
| 批4 | `feat(hook)` | bash -n + docs-consistency |
| 批5 | `chore(release)` | **npm run prepush 17 项全绿** |

## 中止条件（遇任一即停下向用户汇报）

1. Task 2 Step 1 tsc 非 0（按规格批2 步骤 0 的清点→分诊→汇报流程）
2. Task 1 Step 5 npm audit 报 high 漏洞（R2：升级 devDeps 须先获批）
3. Task 6 Step 2 vitest 出现非预期失败（新增用例自身缺陷 → 修用例而非删检查）
4. Task 10 Step 3 prepush 任一项失败（修复后重跑，禁止 --no-verify）
