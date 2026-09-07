# 门禁项数 STALE 扫描实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 新增 docs-consistency 内部检查 `gate-count-docs`，将 README.md / AGENTS.md / CONTRIBUTING.md / docs/troubleshooting.md 四份活体文档的门禁项数引用绑定 `EXPECTED.prePushCount`，使未来门禁项数 N→N+1 后的活体文档漏改被 `npm run prepush` / `npm run check:docs-consistency` 自动拦截（F1 反哺），并顺带修复两处遗留 minor（:1366 注释历史失真 + 测试 fixture 硬编码派生）。

**架构：** 镜像既有 `checkPrTemplatePrePushCount`（docs-consistency-logic.ts:1724）先例：`checkGateCountLiveDocs` 按行扫描白名单文档，行含「门禁/检查」标记时校验全部「N 项」计数引用 == `EXPECTED.prePushCount`；白名单在函数内按 `GATE_COUNT_DOC_NAMES` 过滤（SSoT 用下标形式、CHANGELOG*/docs/changes 历史不可改，均不入白名单）;`DocConsistencyInput.gateCountDocs` 为可选字段（缺省跳过，fixture 兼容）;CLI 注入四份文档文本。

**技术栈：** Node + TypeScript 门禁脚本（`tsx` runtime），vitest（`config/vitest.config.ts`），零新增 devDeps。

**全局约束：**
- **SSoT 优先**：设计已由 `docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md`（已批准）承载；本计划按「代码 → 治理同步」执行，SSoT 句子在 Task 4 落（沿用 trigger-boundary 先例）。
- **脚本自包含**：仅 Node 标准库 + 已声明 devDeps；不引入 LLM 调用。
- **退出码约定**：0=通过 / 1=校验失败 / 2=输入错误；以脚本退出码为准。
- **直接 on main**（仓库既定约定，用户已批准）：不建 worktree / 分支。
- **commit 风格**：Conventional Commits（`feat(gate): …` / `docs: …` / `test: …`），每任务独立 commit。
- **版本保持 42.2.1，不 bump**（沿用快追先例）。
- **prePushCount 保持 18**：本 campaign 不改 pre-push 编号块 / 声明文本 / PR 模板 / 既有 18 相关断言；docs-consistency 内部检查数不被外部强制，无需级联。

---

## 文件结构

| 文件 | 职责 | 改动 |
| --- | --- | --- |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts` | 门禁项数扫描逻辑 + 白名单常量 + 输入字段 + 报告接线 | 修改（Task 1、Task 3） |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 单元测试（vitest） | 修改（Task 1、Task 3） |
| `w-model-dev/scripts/cli/check-docs-consistency.ts` | CLI 注入 `gateCountDocs` | 修改（Task 2） |
| `docs/skill-design-document_SSoT.md` | 治理同步一句 | 修改（Task 4） |
| `CHANGELOG.md` | campaign 小节 | 修改（Task 4） |
| `eval/w-model-dev-results.tsv` | 记录一行 | 修改（Task 4） |
| `w-model-dev/scripts/lib/run-sync.ts` | 直接同步调用审计异常清单（必要终验修复） | 修改（Task 4 终验修复，经用户批准） |

---

### 任务 1：逻辑检查 `checkGateCountLiveDocs` + 单元测试

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`（新增 `GATE_COUNT_DOC_NAMES` 常量 + `checkGateCountLiveDocs` 函数 + `DocConsistencyInput.gateCountDocs` 字段 + `buildDocConsistencyReport` 接线）
- 测试：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `docs-consistency-logic.test.ts` 中（放在既有 P2/gate 相关 describe 附近，或文件末尾新增 describe）追加以下 describe 块（沿用 baseInput 模式）：

```ts
describe('gate-count-docs（活体文档门禁项数引用扫描，F1 反哺）', () => {
  it('clean：四份白名单文档全 18 项 → 0 违规', () => {
    const input = baseInput({
      gateCountDocs: [
        { name: 'README.md', content: '本地 CI：18 项门禁（含 eval 语料断言）' },
        { name: 'AGENTS.md', content: '手动跑推送前门禁（不实际推送，18 项门禁检查；' },
        { name: 'CONTRIBUTING.md', content: '在 `git push` 时自动跑 18 项检查；' },
        { name: 'docs/troubleshooting.md', content: '未执行 18 项门禁（exit 0 放行）' },
      ],
    });
    expect(runDocConsistencyChecks(input).filter((v) => v.check === 'gate-count-docs')).toEqual([]);
  });

  it('stale：任一文档「17 项门禁」→ 违规，消息含文件名与行号', () => {
    const input = baseInput({
      gateCountDocs: [{ name: 'docs/troubleshooting.md', content: '未执行 17 项门禁（exit 0 放行）' }],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs');
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain('docs/troubleshooting.md:1');
    expect(v[0]!.message).toContain('17 项');
  });

  it('index-exclusion：行含门禁标记的「第 13 项」下标引用不误报', () => {
    const input = baseInput({
      gateCountDocs: [
        { name: 'CONTRIBUTING.md', content: 'pre-push 第 13 项 npm audit warn 并跳过（门禁不阻断）' },
      ],
    });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
  });

  it('marker-gate：无「门禁/检查」标记的行（5 项闭环脚本）不误报', () => {
    const input = baseInput({
      gateCountDocs: [
        {
          name: 'README.md',
          content: 'G 还须跑 5 项闭环脚本（check-budget.ts / check-run-log.ts / check-maturity.ts）',
        },
      ],
    });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
  });

  it('bare-form：行内含 `门禁` 标记的裸「N 项」（README:31 形态）→ 违规', () => {
    const input = baseInput({
      gateCountDocs: [{ name: 'README.md', content: '| 推送前门禁（本地 CI，17 项） |' }],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs');
    expect(v).toHaveLength(1);
    expect(v[0]!.message).toContain('17 项');
  });

  it('非白名单文档名（CHANGELOG.md）传入 → 不扫描（白名单函数内过滤）', () => {
    const input = baseInput({
      gateCountDocs: [{ name: 'CHANGELOG.md', content: '本次推送未执行 17 项门禁（历史记录，不可改）' }],
    });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
  });

  it('undefined 注入 → 跳过（fixture 兼容）', () => {
    const input = baseInput({ gateCountDocs: undefined });
    expect(runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs')).toEqual([]);
  });

  it('多文档多违规聚合', () => {
    const input = baseInput({
      gateCountDocs: [
        { name: 'AGENTS.md', content: '自动跑 17 项门禁' },
        { name: 'CONTRIBUTING.md', content: '自动跑 16 项检查' },
      ],
    });
    const v = runDocConsistencyChecks(input).filter((x) => x.check === 'gate-count-docs');
    expect(v).toHaveLength(2);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

预期：RED —— 新增用例中 `stale` / `bare-form` / `多文档多违规聚合` 等断言违反（`check === 'gate-count-docs'` 尚无来源，违规数组为 0）。`clean` / `index-exclusion` / `marker-gate` / `非白名单` / `undefined` 用例此时可能恰好通过（无断言来源时过滤为空），属预期；以 `stale` 用例失败为准确认 RED。

- [ ] **步骤 3：实现最少代码**

在 `docs-consistency-logic.ts` 中：

(a) 在 `EXPECTED` 定义（:217）附近或 `checkPrTemplatePrePushCount`（:1724）之前新增白名单常量与检查函数：

```ts
/** pre-push 门禁项数引用的活体文档白名单（gate-count-docs，F1 反哺）：
 * 仅扫承载「N 项门禁/检查」计数引用的四份活体文档。SSoT 用「第 N 项门禁」下标形式且含日期
 * 陈述（下标不随总数必变），CHANGELOG.md / CHANGELOG-archive.md / docs/changes/**（历史不可改）
 * 与 docs/superpowers/**（内部规划）不入白名单——靠白名单而非全仓扫描规避假阳性。 */
const GATE_COUNT_DOC_NAMES = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/troubleshooting.md',
];

/**
 * 活体文档门禁项数引用扫描（gate-count-docs）：泛化自 checkPrTemplatePrePushCount（先例 :1724）。
 * 行含「门禁/检查」标记时，全部「N 项」计数引用须 == EXPECTED.prePushCount，防止门禁项数
 * N→N+1 后未测试 docs 文件（如 docs/troubleshooting.md）漏改。逐行 fresh 正则（无共享 lastIndex）：
 * 可选 `(第\s*)?` 前缀捕获 → 匹配「第 N 项」序数引用（带/不带空格均覆盖，如「第 13 项 npm audit」）
 * 时跳过（m[1] 非 undefined）；`(?!目)` 排除「N 项目」误匹配；仅 ASCII 数字（中文数字如「五项校验」
 * 天然不命中）。gateCountDocs 未注入（缺省）时跳过。
 */
export function checkGateCountLiveDocs(
  docs: Array<{ name: string; content: string }> | undefined,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (docs === undefined) return violations;
  for (const doc of docs) {
    if (!GATE_COUNT_DOC_NAMES.includes(doc.name)) continue;
    const lines = doc.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.includes('门禁') && !line.includes('检查')) continue;
      for (const m of line.matchAll(/(第\s*)?(\d+)\s*项(?!目)/g)) {
        if (m[1] !== undefined) continue; // 「第 N 项」序数引用，跳过
        if (Number(m[2]!) !== EXPECTED.prePushCount) {
          violations.push({
            check: 'gate-count-docs',
            message: `${doc.name}:${i + 1} 存在过期门禁项数「${m[0]}」（当前 ${EXPECTED.prePushCount} 项），须同步`,
          });
        }
      }
    }
  }
  return violations;
}
```

> **计划修正记录（2026-09-07，控制者裁定，账本 Task 1 裁决行）：** 原计划正则 `(?<!第)(\d+)\s*项(?!目)` 对「第 13 项」（带空格）失效——`(?<!第)` 只看紧邻前一字符，空格通过；「第13项」无空格时更会在数字中间匹配出「3项」误报。修订为 `(第\s*)?` 前缀捕获（m[1] 非 undefined 即序数，跳过），m[2] 为计数。stale 测试断言 `toContain('17 项门禁')` 改为 `toContain('17 项')`（消息为「17 项」（当前 18 项））。

(b) 在 `DocConsistencyInput` 接口中、`prTemplate` 字段（:117-118）之后新增：

```ts
  /** 门禁项数引用的活体文档白名单（name + 原文）；缺省时跳过 gate-count-docs 检查（fixture 兼容）。 */
  gateCountDocs?: Array<{ name: string; content: string }>;
```

(c) 在 `buildDocConsistencyReport`（:749）中、`violations.push(...checkPrTemplatePrePushCount(input.prTemplate));`（:783）之后新增：

```ts
  violations.push(...checkGateCountLiveDocs(input.gateCountDocs));
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

预期：GREEN —— 全部 8 个新用例通过，既有用例无回归。

- [ ] **步骤 5：安全扫描与格式化**

运行：`npx tsx w-model-dev/scripts/cli/security-scan.ts`（期望 0 新增发现；本函数为字面量正则 + 与文件内既有 `m[1]`/`m[0]` 访问同型，应无 baseline 变化）；`npx prettier --write w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "feat(gate): add gate-count-docs stale gate-count scan for living docs"
```

---

### 任务 2：CLI 接线 + 负向验证

**文件：**
- 修改：`w-model-dev/scripts/cli/check-docs-consistency.ts`

- [ ] **步骤 1：在 input 注入 gateCountDocs**

在 `check-docs-consistency.ts` 的 `const input: DocConsistencyInput = { ... }` 对象字面量中，`prePush: read('.githooks/pre-push'),`（:805）之后新增：

```ts
    gateCountDocs: [
      { name: 'README.md', content: read('README.md') },
      { name: 'AGENTS.md', content: read('AGENTS.md') },
      { name: 'CONTRIBUTING.md', content: read('CONTRIBUTING.md') },
      { name: 'docs/troubleshooting.md', content: read('docs/troubleshooting.md') },
    ],
```

- [ ] **步骤 2：正向验证**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（仓库根目录）

预期：exit 0，输出 `✓ 全部一致`（当前语料四文档全为 18 项引用，规格 §3.2 已验证 11/11 零违规）。

- [ ] **步骤 3：负向验证（临时伪造过期项数 → 拦截 → 还原）**

```bash
sed -i 's/本次推送未执行 18 项门禁/本次推送未执行 17 项门禁/' docs/troubleshooting.md
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts; echo "exit=$?"
git checkout -- docs/troubleshooting.md
git status --short
```

预期：`check-docs-consistency` 输出含 `gate-count-docs` 违规（消息含 `docs/troubleshooting.md:13`），exit=1（fail-closed）；`git checkout` 后 `git status --short` 干净。

- [ ] **步骤 4：格式化与 Commit**

```bash
npx prettier --write w-model-dev/scripts/cli/check-docs-consistency.ts
git add w-model-dev/scripts/cli/check-docs-consistency.ts
git commit -m "feat(cli): inject gateCountDocs living docs into docs-consistency input"
```

---

### 任务 3：遗留 minor 两项（注释写实 + fixture 派生）

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts:1366-1368`（JSDoc 注释）
- 修改：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts:11-23`（import）与 `:60-64`（VALID_PRE_PUSH）

- [ ] **步骤 1：修复 :1366 注释历史失真**

`docs-consistency-logic.ts` 中 `checkPrePushCount` JSDoc（:1365-1368）原文：

```
 * #1..#18 且恰 18 块——旧实现仅取「最大编号」+「18 项检查」文本，伪造 3 块检查的
```

将「旧实现仅取『最大编号』+『18 项检查』文本」改为 count 无关写法：

```
 * #1..#18 且恰 18 块——旧实现仅取「最大编号」+「N 项检查」声明文本（N 为当时 prePushCount），伪造 3 块检查的
```

（其余行不动；旧实现（audit-fixes T6 时代）校验的是当时 prePushCount=17，fast-follow 把注释内数字同步到 18 属历史失真，改为 N 避免再次过期。）

- [ ] **步骤 2：VALID_PRE_PUSH fixture 派生**

(a) `docs-consistency-logic.test.ts` 的 import 块（:11-23）加入 `EXPECTED`：

```ts
import {
  EXPECTED,
  ...
} from '../logic/docs-consistency-logic.js';
```

(b) `VALID_PRE_PUSH`（:60-64）将硬编码 `length: 18` 改为派生：

```ts
/** 合法 pre-push 文本（连续 #1..#N 检查块 + 「N 项检查」声明，F-G7-08 强校验基线；N 派生自 EXPECTED.prePushCount） */
const VALID_PRE_PUSH = [
  ...Array.from({ length: EXPECTED.prePushCount }, (_, i) => `# ${i + 1}. 第 ${i + 1} 项门禁检查`),
  `# 全部门禁共 ${EXPECTED.prePushCount} 项检查`,
].join('\n');
```

注意：第三行声明文本同步改为模板串（原为字面量 `'# 全部门禁共 18 项检查'`），保证 fixture 内部一致；`EXPECTED.prePushCount` 当前为 18，产出与旧 fixture 逐字符相同。

- [ ] **步骤 3：运行测试确认无回归**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

预期：GREEN —— 全部用例通过（含 F-G7-08 强校验相关用例，fixture 产出不变）。

- [ ] **步骤 4：格式化与 Commit**

```bash
npx prettier --write w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "test(docs-consistency): make F-G7-08 comment count-agnostic and derive fixture from EXPECTED"
```

---

### 任务 4：治理收口与终验

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`
- 修改：`CHANGELOG.md`
- 修改：`eval/w-model-dev-results.tsv`

- [ ] **步骤 1：SSoT 追加机制说明一句**

在 `docs/skill-design-document_SSoT.md` 的本地 pre-push 边界段（:1217「本地 pre-push 平台依赖与显式安装安全边界」或 :1219 推送范围判定段之后就近位置）追加一句（保持 SSoT 行文风格，独立段落或紧跟相关段落）：

> docs-consistency 对 README.md / AGENTS.md / CONTRIBUTING.md / docs/troubleshooting.md 四份活体文档执行门禁项数引用扫描（`gate-count-docs`）：行含「门禁/检查」标记时，全部「N 项」计数引用须 == `EXPECTED.prePushCount`；「第 N 项」下标（如「第 13 项 npm audit」）与历史目录（CHANGELOG* / docs/changes / docs/superpowers）不在扫描范围（gate-count-stale-scan，2026-09-07）。

- [ ] **步骤 2：CHANGELOG 追加 campaign 小节**

在 `CHANGELOG.md` 顶部（最近版本节之下、trigger-boundary 快追小节附近）新增小节，沿用 trigger-boundary 先例风格：

```markdown
## 门禁项数 STALE 扫描（gate-count-stale-scan，2026-09-07）

- **docs-consistency 新增 `gate-count-docs` 白名单扫描**：README/AGENTS/CONTRIBUTING/troubleshooting 四份活体文档的门禁项数引用绑定 `EXPECTED.prePushCount`（行含「门禁/检查」标记时全部「N 项」须一致），防门禁项数 N→N+1 后未测试 docs 文件漏改（trigger-boundary-fastfollow 终审 F1 的结构性 follow-up）。
- 源码位置：`docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md` + `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md`；SSoT 门禁项数扫描一句见 §pre-push 边界。
- 版本保持 42.2.1，不 bump。
```

- [ ] **步骤 3：TSV 追加一行**

先用 `git add CHANGELOG.md docs/skill-design-document_SSoT.md` 并 commit（记录本步骤 SHA 供 TSV 引用）：

```bash
git add CHANGELOG.md docs/skill-design-document_SSoT.md
git commit -m "docs: record gate-count stale scan governance (SSoT + CHANGELOG)"
SHORT_SHA=$(git rev-parse --short HEAD)
```

然后给 `eval/w-model-dev-results.tsv` 追加一行（9 列 tab 分隔，格式与既有记录一致，参照最近两行）：

```
$(date +%Y-%m-%dT%H:%M)	${SHORT_SHA}	w-model-dev	-	-	keep	门禁项数STALE扫描	docs-consistency 新增 gate-count-docs 白名单扫描（绑定 prePushCount=18），防 N→N+1 活体文档漏改；版本保持 42.2.1	dry_run
```

然后 commit：

```bash
git add eval/w-model-dev-results.tsv
git commit -m "docs(eval): record gate-count stale scan round in results tsv"
```

- [ ] **步骤 4：修复终验暴露的审计清单行号漂移（用户已批准的必要范围扩展）**

Task 3 在 `docs-consistency-logic.test.ts` 顶部新增 `EXPECTED` import，使该文件中 8 个直接同步调用整体下移 1 行；`SYNC_PROCESS_EXCEPTIONS` 的集中审计清单仍登记旧行号，导致 pre-push Vitest 失败（`expected 2487 to be 2488`）。这是清单与真实源码的契约漂移，必须在继续终验前同步，不能伪造或跳过失败。

在 `w-model-dev/scripts/lib/run-sync.ts` 的 `SYNC_PROCESS_EXCEPTIONS` 中，仅更新 `file: '__tests__/docs-consistency-logic.test.ts'` 的 8 个 `line` 值（当前登记 2487/2490/2496/2499/2506/2507/2559/2582）为真实源码对应值 2488/2491/2497/2500/2507/2508/2560/2583；不要改 `api`、`symbol`、`reason` 或其他文件的登记。修改前先阅读目标清单与测试调用，确认每个登记点逐一对应。

采用 TDD 验证：先运行聚焦审计测试确认当前 RED：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts -t "audits every direct synchronous child-process call against the centralized exception manifest"
```

预期：失败，报告 `expected 2487 to be 2488`（以及后续同类行号漂移）。然后只更新上述 8 个 `line` 值，重跑同一聚焦测试，预期该测试通过；再由步骤 5 的全量 prepush 验证全部调用点。

- [ ] **步骤 5：终验（全量门禁）**

从 Git Bash（仓库既定执行环境）运行：

```bash
npm run format
npm run prepush
npx tsx eval/runner.ts
```

预期：
- `npm run prepush` 全 18 项检查通过（含 vitest 全量、docs-consistency、security-scan、prettier、tsc、npm audit）；
- `npx tsx eval/runner.ts` 输出 `eval: 60/60 通过`（本 campaign 未改动 eval/ 逻辑，确认无回归）；
- `git status --short` 干净（Task 2 负向验证的临时改动已在彼处还原）。

---

## 验收标准（对照规格 §6）

1. vitest 全绿，新增 `gate-count-docs` 用例 8 个（Task 1）。
2. `npm run check:docs-consistency` exit 0；临时「17 项门禁」→ exit 1 并报 `gate-count-docs`（Task 2 负向验证）。
3. `npm run prepush` 18 项全绿（Task 4）。
4. `npx tsx eval/runner.ts` 60/60 不受影响（Task 4）。
5. 三处遗留全部处理：扫描机制 / :1366 注释 / fixture 派生（Task 1-3）。
6. SSoT 一句 + CHANGELOG 小节 + TSV 一行治理同步（Task 4）。
