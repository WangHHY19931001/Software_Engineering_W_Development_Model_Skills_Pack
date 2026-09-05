# audit-fixes 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复核查战役 `verify-campaign-2026-09-05` 经复核确认的全部发现——6 Important + 49 Moderate，64 条说明级逐条处置（修复或登记 defer），2 条已裁定不改。版本保持 42.2.1，不 push。

**架构：** 10 个任务（T0 准备 + T1-T9 垂直切片）在隔离 worktree `task/audit-fixes` 中由子代理逐任务执行；每任务独立 commit、定向回归真实退出码登记；T1-T8 顺序执行（T8 依赖 T1 的扫描器新语义）；T9 台账收口 + 全量回归 + prepush。发现权威目录：`docs/superpowers/specs/2026-09-06-audit-fixes-findings-catalog.md`（本计划中引用为 F-G*-** / S*）。

**技术栈：** TypeScript（tsx runtime，vitest 测试）、JSON Schema draft-07（ajv）、bash hook（GNU/BSD grep 兼容）、Markdown 活体文档 + docs-consistency 门禁。

---

## 全局纪律（每个任务适用，违反即返工）

1. **只动本任务列出的文件**；发现超纲缺陷登记到任务报告，不顺手修。
2. **codegraph 纪律（约束 #14）**：编辑 `w-model-dev/scripts/**` 前先做影响半径查询并落盘 `.w-model/codegraph-queries/`；本仓库无 codegraph index 时，在任务报告记录「查询不可用」并停在该检查点请示编排者，不伪造查询。
3. **每个编辑 scripts 的任务**：先写失败测试（RED）→ 实现 → 转绿（GREEN），定向测试命令与真实退出码写入任务报告。
4. **V/G 失败禁止直接返工**：走完整 R 链（V/G → R → V 复审 → G(check-rootcause-report) → S-fix → R3×3 → G → V → G → CHECKPOINT）。
5. **台账**：T1 起每个实现 commit 追加前一 commit 的父链行（40 字符 SHA + subject 逐字）；格式 `| \`<sha40>\` | \`<subject>\` |`，追加到 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`「独立提交与版本同步」表末尾。
6. **版本 42.2.1 不 bump**；不 push；`.superpowers/` 不提交；主工作树 tracked 文件只读（一切编辑都在本 worktree）。
7. 全程在 `/d/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/audit-fixes` 下执行（下文相对路径均以此为其根）。

## 说明级（S1-S64）处置映射

随任务顺带修复：S2/S3/S4（T1 模板替换与扫描器同步）、S18（T5 checkpoint 文案）、S19（T3 文档对齐）、S20（T3 runMain）、S22（T3 未知 flag）、S25（T4 注释）、S49（T6 措辞）、S56/S57/S64（T8）、S46（T5 artifact-gate --json external）、S10（T5 gate-log 降级）。其余说明级在 T9 于目录「处置」列登记 `defer`（默认）或 `fix`（若实现时零成本顺带）。F-G6-03 维持「已裁定不改」。

---

### 任务 0：worktree 准备与依赖预检

**文件：** 无仓库文件变更（仅本地环境）。

- [ ] **步骤 0.1**：worktree 已存在（`git worktree list` 含 `.worktrees/audit-fixes`，分支 `task/audit-fixes` @ `19e83fa`）。确认：`git -C .worktrees/audit-fixes status --short` 为空。
- [ ] **步骤 0.2**：在 worktree 内 `npm install`（上一战役实测 worktree 缺 `@esbuild/win32-x64` 可选依赖，全量 vitest 会挂环境探针）。运行：`cd .worktrees/audit-fixes && npm install 2>&1 | tail -3`。预期：安装成功；`node_modules/esbuild` 就位。
- [ ] **步骤 0.3**：基线核验（修复前真实值，供终审对照）：`npx vitest run --config config/vitest.config.ts 2>&1 | tail -4`（预期 1509/1509）、`npm run self-test 2>&1 | tail -1`（预期 262/262）、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts --json > /tmp/dc-before.json; echo $?`（预期 0）、`npm run audit:l0-links 2>&1 | tail -2`（预期 passed=true, relativeLinkCount=650）。把四个数字写入任务报告。
- [ ] **步骤 0.4**：codegraph 可用性检查：`npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --help >/dev/null 2>&1; echo $?` 并尝试 `codegraph_explore` 探测；结果（可用/不可用）写入任务报告，后续任务按全局纪律 #2 执行。

---

### 任务 1：D1 术语收口 + 扫描器收紧 + l0 解析修复（I-1、F-G1-01…08、F-G8-02/03 部分、S2/S3/S4）

**文件：**
- 修改：`w-model-dev/references/conventions.md:124-125`、`w-model-dev/references/hard-constraints.md:85`、references 10 文件、`templates/review-report.md`、`templates/acceptance-test.md`、`templates/coding.md`、examples 3 文件、`references/verifier-spec.md:102`、`references/data-models.md:267,290,528`、`scripts/__tests__/README.md:10`
- 修改：`w-model-dev/scripts/__tests__/examples-contract.test.ts:146-147,189-194,504-535,574,584,602`
- 修改：`w-model-dev/scripts/logic/l0-link-audit-logic.ts:56,59` + 提取点
- 测试：`w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts`

- [ ] **步骤 1.1（l0 RED）**：在 `l0-link-audit-logic.test.ts` 追加两个用例（复用文件内现有 md-fixture 构造模式）：

```ts
it('reference definition target 不得吞并后续行', () => {
  const md = '[b]:./y.md\n[c]:\n  ./z.md\n[d](./w.md)\n';
  // 期望仅采集 [b]→./y.md、[c]→./z.md、[d]→./w.md 三条相对链接；target 不含换行
  const result = auditL0(md); // 用文件内既有入口；断言 violations 为空且计数=3（w.md 需在 fixture 树中存在）
});
it('平衡括号 bare destination 归一', () => {
  const md = '[f]: (./x2.md)\n';
  // 期望 target 归一为 ./x2.md（x2.md 存在 → 无 violation）
});
```

- [ ] **步骤 1.2**：运行 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts 2>&1 | tail -3`。预期：新 2 用例 FAIL（target 含换行 / 前导括号）。
- [ ] **步骤 1.3（l0 GREEN）**：`l0-link-audit-logic.ts:56` 与 `:59` 的 target 字符类 `[^)> \t]+` / `[^)> \t]*` 改为 `[^)\r\n> \t]+` / `[^)\r\n> \t]*`；在引用定义 target 提取点（grep `REFERENCE_DEFINITION` 的使用处）加归一：

```ts
function normalizeRefDefTarget(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('(') && t.endsWith(')') && !t.slice(1, -1).includes('(')) return t.slice(1, -1);
  return t;
}
```

- [ ] **步骤 1.4**：重跑步骤 1.2 命令。预期：全文件 PASS；`npm run audit:l0-links` 的 `relativeLinkCount` 仍为 650（仓库无引用定义行）；若漂移，按 `helpers/l0-baseline.ts:6-7` 流程以实测更新并登记。
- [ ] **步骤 1.5（语料机械替换）**：两式字面量——正文式 `普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）`、表格式 `普通 V/G 失败链（hard-constraints）`。先枚举：`grep -rn "完整普通失败链\|普通失败返工链\|普通失败完整链\|普通返工链" w-model-dev --include='*.md' --include='*.ts' | grep -v docs/changes`。替换规则：叙述句用正文式、表格单元格用表格式、**同句已有锚点引用的只删非规范名**。特例逐条处理：

| 位置 | 处理 |
|---|---|
| `phase-5-coding.md:193` | 「不得**绕过**普通失败链；仍走 普通 V/G 失败链（…节）」→「不得绕过 普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）」（删冗余短名，保留既有锚点） |
| `templates/acceptance-test.md:72` | 「并按下方普通失败链执行」→「并按下方普通 V/G 失败链执行」 |
| `templates/acceptance-test.md:76`、`templates/coding.md:91` | 标题「普通失败返工链」→「普通 V/G 失败链」 |
| `hard-constraints.md:342` | 「普通失败完整链为普通 V/G 失败链（见…节）」→「完整链为普通 V/G 失败链（见…节）」 |
| `data-models.md:528` | 「普通返工链」→ 表格式短名 |
| `verifier-spec.md:102` | 「（普通 V/G 失败链，hard-constraints）」→「普通 V/G 失败链（hard-constraints）」 |
| `examples/stage7-system-test.md:77` | 长名替换为「普通 V/G 失败链」，**箭头链全句保留** |
| `examples/stage6:71`、`stage7:72`、`test-execution:99` | 「完整普通失败链」→「普通 V/G 失败链」 |

同时顺带修复 S2（`templates/review-report.md:43` 与 `:54` 并存矛盾——:43 按本表替换后即一致）。验证：`grep -rn "完整普通失败链\|普通失败返工链\|普通失败完整链\|普通返工链\|完整返工链" w-model-dev --include='*.md' --include='*.ts' | grep -v 'docs/changes' | wc -l` 预期 **0**。

- [ ] **步骤 1.6（权威定义收口）**：`conventions.md:124` 定义句「V/G 任一门禁不通过后的标准返工链」改「V/G 任一门禁不通过后的返工链」（删禁用词，其余不动）；`:125` 改为：

```markdown
- **_Avoid_**：完整失败链/标准返工链/失败处理链/完整普通失败链/普通失败链/普通失败返工链/普通失败完整链/完整返工链/普通返工链（非规范叫法；统一短名「普通 V/G 失败链」并指向 hard-constraints 权威节）。
```

`hard-constraints.md:85` 标题 `## 普通 V/G 失败链（标准返工链）` 改 `## 普通 V/G 失败链`（`:91` 短名引用形态句不动）。

- [ ] **步骤 1.7（扫描器收紧，先 RED）**：`examples-contract.test.ts` 追加负例：

```ts
it('非规范名不再是合规 marker（r1 因果闭环样本）', () => {
  const line = '质量门不通过；先走完整普通失败链，再回阶段 3 由 S-fix 返工';
  expect(failureRoutingReason(line)).not.toBe(undefined); // 必须被判违规
});
it('否定/提及式引用不算 marker（F-G8-02）', () => {
  expect(failureRoutingReason('质量门不通过；详见普通 V/G 失败链，此处不展开')).not.toBe(undefined);
  expect(failureRoutingReason('质量门不通过；先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）')).toBe(undefined);
});
```

（提及式两用例均带失败信号词「质量门不通过」，确保进入路由分析；后一行即替换后语料的合规形态。）

运行确认 FAIL（当前 marker 命中即合规）。
- [ ] **步骤 1.8（扫描器 GREEN）**：`:189-194` `hasChainMarker` 删除 `includes('完整普通失败链')` 分支并加提及守卫：

```ts
const CHAIN_MARKER_MENTION = /(无需|不必|无须|详见|参见|另见)[^。；;]{0,12}普通 V\/G 失败链/;
function hasChainMarker(normalized: string): boolean {
  if (!normalized.includes('普通 V/G 失败链')) return false;
  return !CHAIN_MARKER_MENTION.test(normalized);
}
```

`:516-522` skip 子句删除 `完整普通失败链` 项（`下方完整链` 子句若替换后语料零命中一并删）；`:146-147` 注释改「canonical marker = 规范短名（非提及式）或完整箭头链」；fixtures `:574/:584/:602` 期望字符串改为步骤 1.5 替换后语料（grep 语料取真实行）。全文件跑 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts 2>&1 | tail -3` 预期 PASS；若语料行仍含未替换变体导致红，回步骤 1.5 补替换（扫描器是审计，不许放宽）。
- [ ] **步骤 1.9**：`scripts/__tests__/README.md:10` 描述同步（「完整普通失败链」→「普通 V/G 失败链」措辞）。
- [ ] **步骤 1.10**：回归：`npm run audit:l0-links`、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts --json >/dev/null; echo $?`（预期 0）、`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts w-model-dev/scripts/__tests__/l0-link-audit-cli.test.ts 2>&1 | tail -3`、`npx prettier --check w-model-dev/scripts/logic/l0-link-audit-logic.ts w-model-dev/scripts/__tests__/examples-contract.test.ts`。全部真实退出码入报告。
- [ ] **步骤 1.11**：Commit：

```bash
git add -A w-model-dev/ && git commit -m "fix(terms): anchor failure-chain to canonical short name, tighten scanner, fix l0 ref-def parsing"
```

（commit 前把规格+目录提交 `19e83fa` 与计划提交 `1579f90`（amend 后以 `git rev-parse` 实取）两行父链先追加进 acceptance 父链表；commit 后本任务报告登记 SHA，其父链行由任务 2 commit 追加。）

---

### 任务 2：D2 requirement-coverage 空矩阵 fail-closed（I-2 / F-G2-01）

**文件：**
- 修改：`w-model-dev/scripts/logic/coverage-logic.ts:152`（C7 块）+ 结果类型
- 修改：`w-model-dev/scripts/cli/check-requirement-coverage.ts`（JSON 透传）
- 修改：`w-model-dev/scripts/samples/coverage/valid-out-of-scope-declared.json`（crossCuts 补 1 条）
- 测试：`w-model-dev/scripts/__tests__/coverage-logic.test.ts`
- 文档：`w-model-dev/references/command-reference.md`（check-requirement-coverage 节）

- [ ] **步骤 2.1（RED）**：`coverage-logic.test.ts` 追加（fixture 用临时对象，不进 samples/）：

```ts
it('C7b：crossCuts 为空且未提供 --graph → blocking', () => {
  const r = checkRequirementCoverage({ ...minimalCoverage, crossCuts: [] }, {}); // 无 graphCrossCuts
  expect(r.violations.some((v) => v.startsWith('C7b'))).toBe(true);
  expect(r.passed).toBe(false);
});
it('crossCuts 非空且无 --graph → warning + skippedRules 标记，不 blocking', () => {
  const r = checkRequirementCoverage({ ...minimalCoverage, crossCuts: [{ from: 'NFR-001', to: 'REQ-001' }] }, {});
  expect(r.violations).toEqual([]);
  expect(r.skippedRules).toContain('C7');
});
```

（`minimalCoverage`/入口函数名以文件内既有用例为准；`crossCuts` 条目形状对照 `samples/coverage/valid-cross-cuts-consistent.json` 既有条目。）运行确认 2 用例 FAIL。
- [ ] **步骤 2.2（GREEN）**：`coverage-logic.ts:152` C7 守卫改造：

```ts
if (!exempt.has('C7')) {
  if (options.graphCrossCuts) {
    /* 既有双向比对不动 */
  } else {
    const cuts = coverage.crossCuts ?? [];
    if (cuts.length === 0) {
      violations.push('C7b crossCuts 为空且未提供 --graph，无法证明横切一致性（fail-closed）');
    } else {
      warnings.push('C7 未校验：未提供 --graph');
      skippedRules.push('C7');
    }
  }
}
```

结果类型增 `skippedRules?: string[]`（warnings 已有则复用；没有则一并增），CLI `--json` 输出透传两字段。
- [ ] **步骤 2.3**：重跑步骤 2.1 命令预期 PASS；跑既有 coverage 用例确认无回归（`recalcRate` 空集=100 行为保留，仅 C7b 拦空矩阵）。
- [ ] **步骤 2.4**：`samples/coverage/valid-out-of-scope-declared.json` 的 `"crossCuts": []` 改为 1 条合法边（形状照抄 `valid-cross-cuts-consistent.json` 条目）。验证 `npm run self-test 2>&1 | tail -1` 仍 **262/262**（该样本对应用例预期不变；总数不得变化——负例走 vitest 不进 self-test）。
- [ ] **步骤 2.5**：`command-reference.md` 该脚本节补一句：「不传 `--graph` 时：crossCuts 空 → C7b blocking；非空 → C7 降级 warning 并在 JSON `skippedRules` 标记」。
- [ ] **步骤 2.6**：`npx prettier --check w-model-dev/scripts/logic/coverage-logic.ts w-model-dev/scripts/cli/check-requirement-coverage.ts`；Commit：`git add -A w-model-dev/ && git commit -m "fix(gates): fail closed on empty crossCuts without graph (C7b) and surface skipped C7"`。**commit 前把任务 1 的 commit SHA 父链行追加进 acceptance 父链表。**

---

### 任务 3：D3 CLI 参数统一 + 结构门（I-3/I-4/I-5、F-G3-01…05、S19/S20/S22）

**文件：**
- 修改：`lib/parse-phase.ts`、`cli/check-budget.ts:64,118-130`、`cli/check-signature-chain.ts:66`、`cli/check-tla-model.ts:73,313-320`、`cli/metrics-report.ts:55-58,182`、`cli/check-code-tla-consistency.ts:79-81`、`cli/ensure-codegraph-opsx.ts:302-308`、`cli/plan-chunks.ts:45-53,95,105`、`cli/wm-write.ts:70-122`、`cli/check-bdd-model.ts:114`、`cli/check-preventive-review.ts:91,97`、`cli/check-requirement-graph.ts:92-96`、`cli/check-state-machine-consistency.ts:66-68`、`cli/check-codegraph-queries.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts`（--scope 消息）、`cli/check-samples-coverage.ts:255`、`cli/check-docs-consistency.ts:655`
- 测试：对应 `__tests__/*.test.ts`（parse-phase、metrics-report、plan-chunks、state-machine、tla-model、budget 空格形态、docs-consistency）
- 文档：`references/command-reference.md:358,393,408`

- [ ] **步骤 3.1（parse-phase RED）**：`parse-phase` 测试追加：

```ts
it('重复 --phase（任意形态）→ DuplicateFlagError', () => {
  expect(() => parsePhaseArg(['--phase=1', '--phase', '2'])).toThrow(DuplicateFlagError);
});
it('phaseFlagPresent 识别两形态', () => {
  expect(phaseFlagPresent(['--phase 3'])).toBe(true);
  expect(phaseFlagPresent(['--phase=3'])).toBe(true);
  expect(phaseFlagPresent(['--phoenix'])).toBe(false);
});
```

运行确认 FAIL。
- [ ] **步骤 3.2（parse-phase GREEN）**：`parse-phase.ts` 增：

```ts
export function phaseFlagPresent(argv: readonly string[]): boolean {
  return argv.some((a) => a === '--phase' || a.startsWith('--phase='));
}
```

`parsePhaseArg` 入口增重复检测（`--phase` 与 `--phase=` 合并计数，>1 抛 `DuplicateFlagError('phase')`，从 `lib/parse-args.ts` import）；头注释 `:4-16` 改为准确契约：13 个 importer、两形态、重复即错、非法值 ARG_INVALID。
- [ ] **步骤 3.3（静默组接入）**：4 处 `parseFlagValue(args,'phase')` 门控（`check-budget.ts:64`、`check-signature-chain.ts:66`、`check-tla-model.ts:73`、`metrics-report.ts:57` 及 `:182` ARG_INVALID 门）替换为 `phaseFlagPresent(args)` 门 + `parsePhaseArg(argv)` 取值；`check-requirement-graph.ts:92-96` 同改（非法空格值经 parsePhaseArg 校验报错）。RED：先加测试「`check-budget <f> --phase 99`（空格）→ exit 2 且 stderr 含 `--phase`」确认现状 FAIL 再改。`check-bdd-model.ts:114`、`check-preventive-review.ts:97` 保持仅等号：裸 `--phase`（`a === '--phase'`）→ ARG_INVALID「--phase 仅支持等号形态 --phase=N」。
- [ ] **步骤 3.4（8 入口重复检测接入）**：逐入口——`check-code-tla-consistency.ts:79-81` 内联 `find` 改 `parseFlagValue(args, key)`；`metrics-report.ts:55-58` 四个 find 同改；`ensure-codegraph-opsx.ts:302-308` `getArg` 改 `parseFlagValue` + `--phase` 走 `parsePhaseArg`；`plan-chunks.ts:45-53` 内联循环改 `parseFlagValue`（node-type/max-tokens）+ `:95` 已走 parsePhaseArg（重复检测自动生效），`:105` 生效值统一取 `parsePhaseArg` 结果、报错 detail 同源（修复「报错值与生效值不一致」）；`check-codegraph-queries.ts:363`、`check-openspec-archive.ts:220`、`check-opsx-artifacts.ts:220` 随 parsePhaseArg 自动获得重复检测；`wm-write.ts:70-122` switch 循环对单值 flag（`--from/--expect-mtime/--lock-timeout/--stdin 等`）计次，>1 抛 `DuplicateFlagError`，外层 catch 转 `exitWithError({category:'ARG_INVALID', ...})`。RED：先加测试「`metrics-report --phase=1 --phase=99` → exit 2 ARG_INVALID」与「`wm-write` 重复 `--expect-mtime` → exit 2」（wm-write 用临时文件、只读参数组合构造）。
- [ ] **步骤 3.5（state-machine 结构门，I-5）**：`check-state-machine-consistency.ts` 在 `readJsonOrExit` 后加：

```ts
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
  exitWithError({ category: 'STRUCTURE_INVALID', message: '输入必须是对象（含 designStates/designTransitions/codeStates/codeTransitions 四数组字段）', exitCode: 2 });
}
for (const k of ['designStates', 'designTransitions', 'codeStates', 'codeTransitions'] as const) {
  if (!Array.isArray((parsed as Record<string, unknown>)[k])) {
    exitWithError({ category: 'STRUCTURE_INVALID', message: `字段 ${k} 必须为数组`, exitCode: 2 });
  }
}
```

测试：顶层数组 fixture → exit 2；`eval/w-model-dev-test-prompts.json` 复跑确认 exit 2（原 exit 0 反例翻转）。
- [ ] **步骤 3.6（tla-model 分类对齐，F-G3-04）**：`check-tla-model.ts:313-320` 顶层非对象分支从 ARG_INVALID 改 STRUCTURE_INVALID（消息保持「顶层必须为对象」语义；`:339-347` 不动）；测试同步。
- [ ] **步骤 3.7（samples-coverage 挂 runMain，S20）**：`check-samples-coverage.ts:255` 的 `main()` 调用改 `runMain(main)`（对照 `cli/check-budget.ts` 尾部既有模式），删自定义顶层 catch。
- [ ] **步骤 3.8（docs-consistency 未知 flag，S22）**：`:655` 改为已知集合校验：

```ts
const knownFlags = new Set(['--json']);
const unknown = args.filter((a) => a.startsWith('--') && !knownFlags.has(a.split('=')[0]!));
if (unknown.length > 0) exitWithError({ category: 'ARG_INVALID', message: `未知参数：${unknown.join(' ')}`, exitCode: 2 });
```

- [ ] **步骤 3.9（--scope 形态提示，F-G3-05）**：`check-codegraph-queries.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts` 的「未提供 --scope」violation 消息尾部追加「（仅支持 --scope=<file> 等号形态）」。测试断言消息含该提示。
- [ ] **步骤 3.10（S19）**：`command-reference.md:408` STRUCTURE_INVALID 定义句与实现对齐（补「顶层非对象/字段形状不符」）；`:358` 补 --scope 形态提示；`:393` 改「重复值 flag 全 CLI 生效（--phase 由 parse-phase 统一检测）」。
- [ ] **步骤 3.11**：定向回归：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/parse-phase.test.ts w-model-dev/scripts/__tests__/parse-args.test.ts w-model-dev/scripts/__tests__/metrics-report.test.ts w-model-dev/scripts/__tests__/plan-chunks.test.ts w-model-dev/scripts/__tests__/state-machine-logic.test.ts w-model-dev/scripts/__tests__/budget-logic.test.ts 2>&1 | tail -3`（文件名以 `__tests__/` 实际为准）+ `npm run self-test 2>&1 | tail -1`（262/262）+ `npx prettier --check` 触及文件。真实退出码入报告。
- [ ] **步骤 3.12**：Commit：`git add -A w-model-dev/ && git commit -m "fix(cli): enforce duplicate-flag detection everywhere, unify --phase forms, add state-machine structure gate"`（commit 前追加任务 2 的父链行）。

---

### 任务 4：D4 run-log reworkHints 强制（I-6 / F-G4-01/02、S25）

**文件：**
- 修改：`w-model-dev/schemas/run-log.schema.json`（allOf 块 `:22-126` 内、`:292` description）、`w-model-dev/scripts/logic/run-log-logic.ts`
- 修改：`w-model-dev/scripts/samples/run-log/`（+2 fixture）、`references/data-models.md`、`references/command-reference.md`
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`

- [ ] **步骤 4.1（RED）**：`run-log-logic.test.ts` 追加三用例（行构造复用文件内既有合法 review 行工厂）：

```ts
it('cutoff 后 review passed=false 无 reworkHints → blocking', () => { /* timestamp=2026-09-02，期望 violations 含 reworkHints */ });
it('cutoff 前 review passed=false 无 reworkHints → LEGACY_REWORK_HINTS 诊断放行', () => { /* timestamp=2026-08-01 */ });
it('passed=false 且 reworkHints 非空 → 正常', () => { /* 期望无该规则违规 */ });
```

运行确认 FAIL。
- [ ] **步骤 4.2（schema）**：allOf 数组（`:22-126`）追加（action 枚举值先 `grep -n '"review"' schemas/run-log.schema.json` 核对 `:150` 附近实际拼写，含 iceberg 评审 action 名）：

```json
{
  "if": { "properties": { "action": { "enum": ["review", "iceberg-review"] }, "passed": { "const": false } }, "required": ["action", "passed"] },
  "then": { "properties": { "reworkHints": { "minItems": 1 } }, "required": ["reworkHints"] }
}
```

`:292` passed description 补「passed=false 时 reworkHints 须非空（schema 强制 + logic 按 cutoff 分界）」。
- [ ] **步骤 4.3（logic）**：`run-log-logic.ts` 新增（放在 variant 吸收逻辑旁，复用 `:23` 常量与 `:380-388` 同型判定）：

```ts
function isLegacyMissingReworkHints(raw: RunLogEntry): boolean {
  const ts = Date.parse(raw.timestamp ?? '');
  return Number.isFinite(ts) && ts < Date.parse(LEGACY_VARIANT_CUTOFF);
}
// 校验循环内：action 为 review 族 && passed === false && (!reworkHints || reworkHints.length === 0)
//   → isLegacyMissingReworkHints ? diagnostics.push('LEGACY_REWORK_HINTS: …（variant 规则同窗前的旧记录）; deferred')
//                                : violations.push(`[rework-hints] 条目 ${i} ${action} passed=false 须带非空 reworkHints`);
```

S25 顺带：`:348-349` 注释旧函数名 `isLegacyIdentitySchemaFailure` 改 `isLegacySchemaFailure`。
- [ ] **步骤 4.4（fixtures）**：`samples/run-log/` 增 `review-false-with-hints.jsonl`（正例）与 `review-false-no-hints-post-cutoff.jsonl`（负例），接入 self-test 对应用例数组（**总数 262 保持**：一对新 fixture 对应新增 1 条 self-test 用例时须等量合并既有用例或说明——优先只加负例并复用既有断言结构，若总数必须变化，如实登记 262→263 并同步 `samples/README.md`、`README.md:27`、`AGENTS.md:77`、`docs/INSTALL.md:220,305`、`docs/user-guide.md:110` 九处口径，不许静默）。
- [ ] **步骤 4.5**：`data-models.md` run-log 字段表 reworkHints 行、`command-reference.md` check-run-log 节补 cutoff 分界语义。F-G4-02 顺带：`run-log.schema.json:52` emergency-fix description 补「以 `LEGACY_VARIANT_CUTOFF='2026-09-01T00:00:00Z'`（run-log-logic.ts）为吸收/阻断分界」。
- [ ] **步骤 4.6**：定向回归 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts 2>&1 | tail -3` + `npm run self-test`；prettier 触及文件。Commit：`fix(run-log): require non-empty reworkHints for failed reviews with legacy cutoff absorption`（commit 前追加任务 3 父链行）。

---

### 任务 5：D5 门禁口径与语义（F-G2-02/03/04/05/06、F-G4-04/05/06/07、F-G6-01/02、S10/S18/S46）

**文件：**
- 修改：`cli/check-role-dispatch.ts:88-99`、`logic/iceberg-sweep-logic.ts:81-91`、`cli/check-iceberg-sweep.ts:192-196`、`logic/budget-logic.ts:88-95,102-104,112-114`、`logic/maturity-logic.ts:98-100,107-118`、`cli/check-checkpoint.ts`、`lib/change-scope.ts:79-90,177,186-187`、`schemas/change-scope.schema.json:42`、`schemas/codegraph-query.schema.json:33`、`cli/check-codegraph-queries.ts:217-223,241-246,315-318`、`cli/check-artifact-gate.ts`、`lib/cli-error.ts:35,46-51`
- 测试：role-dispatch / iceberg-sweep-logic / budget-logic / maturity-logic / change-scope / codegraph-queries / artifact-gate-external 对应 test 文件
- 文档：`references/command-reference.md`（ERROR_JSON detail 字段、--scope 提示）

- [ ] **步骤 5.1（role-dispatch 口径，F-G2-03）**：坏行不再 `exitWithError(FILE_PARSE)`——改为收集 `parseErrors` 并入 blocking violations（文案对齐 run-log：`PARSE_INCOMPLETE: line N …; blocking`），`:91-93` 旧注释删除。RED：测试「同坏行输入 role-dispatch exit 1 且 reasons 含 PARSE_INCOMPLETE」。实跑对照：`check-run-log` 与 `check-role-dispatch` 同 fixture 同 exit 1。
- [ ] **步骤 5.2（iceberg 内部去重，F-G2-02）**：`iceberg-sweep-logic.ts:81-91` R3 改：

```ts
const prevSet = new Set(report.线索来源.previousFindings);
const seen = new Set<string>();
for (const f of report.newFindings) {
  if (seen.has(f.findingId)) violations.push(`findingId 重复：${f.findingId} 在 newFindings 内部重复`);
  seen.add(f.findingId);
  if (prevSet.has(f.findingId)) violations.push(`findingId 重复：${f.findingId} 已在上一轮发现`);
}
```

RED：复用 r2 的 `ice-internal-dup` 形态（两条同名 findingId → exit 1）。`check-iceberg-sweep.ts:192-196`（S10）：gate-log 写入前置校验失败时降级 stderr 诊断（`warn`），不再产出 `GATE_LOG_SCHEMA_INVALID` 噪音。
- [ ] **步骤 5.3（budget/maturity 可见性 + 死分支，F-G2-04/05）**：两 logic 在「context 缺失跳过 R1/R3」分支 push `warnings.push('R1 未校验：未提供 --project')`（maturity 同理 R3）；CLI `--json` 增 `warnings: []` 透传。删除不可达死分支：`budget-logic.ts:102-104,112-114`（R2/R4）、`maturity-logic.ts:98-100`（R1）——schema 已前置拦截，删除后跑全 budget/maturity 测试确认无行为变化；若保留则改为注释说明并以 schema 前置测试钉死（择一，报告登记）。
- [ ] **步骤 5.4（budget 逐规则单测，F-G2-06）**：`budget-logic.test.ts` 补 R1（updatedAt 停滞 + `--project`）、R2（超 budgetedTokens）、R3（killSwitch 触发）、R5（onExceed=halt 行为）四组正反例（fixture 形状照抄 `samples/budget/` 既有文件；R1 用例传 `--project` context）。
- [ ] **步骤 5.5（checkpoint 文案，S18）**：空目录/无匹配分支 reason 改「checkpoint-log 无 phase-N 匹配记录（目录已提供）」。
- [ ] **步骤 5.6（change-scope 四件，F-G4-04/06/07 + codegraph `.` 段 F-G4-05）**：
  - `lib/change-scope.ts:79-90` `isIsoDateTimeString` 落实并改 JSDoc：接受 `YYYY-MM-DDTHH:MM:SS(.fff)?(Z|±HH:MM)`；**拒绝小写 `t`/`z`**（正则用字面 `T`/`Z`）；JSDoc 列明精确接受/拒绝清单。`validateChangeScope` 对 `scopeCreatedAt` 补同一校验（RED：小写 `t` fixture → exit 2）。
  - `:177,:186-187` 注释改「`.githooks/` 前缀全部文件按 code 处理」。
  - `schemas/codegraph-query.schema.json:33` targetFiles pattern 补 `.` 段排除（与 `change-scope.schema.json:51` 同构：`(?!.*(?:^|/)\.(?:/|$))`，按现有 pattern 结构嵌入）；RED：`src/./test.ts` schema 层拒绝。
- [ ] **步骤 5.7（docs-only 解阻断，F-G6-01）**：`check-codegraph-queries.ts:217-223,241-246`：strict 入口先按 scope 计算_required code/test 文件数_，`required === 0` 时直接 `passed`（跳过目录存在性/查询文件数检查，附注记「scope 无 code/test 变更，codegraph 不适用」）；存在性检查仅 `required > 0` 时执行。RED：docs-only scope fixture（无 code/test 文件）→ exit 0。`change-scope.ts:396-398` 配套：`requiredCodeTestFiles` 计数暴露给 checker。
- [ ] **步骤 5.8（STRUCTURE_INVALID detail，F-G6-02）**：`lib/cli-error.ts:46-51` `printErrorJson` 增可选 `detail` 字段输出；`:35` `formatCliError` stderr 行追加 detail（有则附）。评估影响面：全 CLI ERROR_JSON 消费方 grep 确认无严格 shape 断言（有则同步）；`command-reference.md` ERROR_JSON 字段表补 `detail?`。测试：change-scope schema 违规时 ERROR_JSON 含 pattern 定位。
- [ ] **步骤 5.9（artifact-gate --json external，S46）**：`check-artifact-gate.ts:475-488` JSON 输出补 `external` 字段（与 GATE_JSON `:545` 同构：`{codegraph:{passed,violationCount,provided,changeId},opsx:{…}}`）。测试：`--json` 断言 external 存在。
- [ ] **步骤 5.10**：定向回归（上列全部 test 文件）+ `npm run self-test` + prettier。Commit：`fix(gates): align exit semantics, dedupe iceberg findings, enforce scopeCreatedAt strictness, unblock docs-only changes`（commit 前追加任务 4 父链行）。

---

### 任务 6：D6 文档契约与计数（F-G4-08…14、F-G7-01…08、S49/S50 登记 defer）

**文件：**
- 修改：`cli/check-budget.ts:151-160`、`cli/check-maturity.ts:132-147`、`wm-status.ts:65`、`schemas/evidence-provenance.schema.json`、`evidence-manifest.schema.json`、`gate-log.schema.json`、`rtm.schema.json`、`verifier-output.schema.json:22`、`code-tla-manifest.schema.json`、`tla-manifest.schema.json`、`logic/docs-consistency-logic.ts`、`cli/check-samples-coverage.ts:120-163`、`references/conventions.md:58,119`、`references/subagent-delegation.md:279,281`、`AGENTS.md:43,164`、`references/data-models.md:964,977,981,989`、`docs/troubleshooting.md:90`
- 测试：`docs-consistency-logic.test.ts`、`check-samples-coverage.test.ts`
- 文档：`references/command-reference.md`（project 读取口径）

- [ ] **步骤 6.1（project 读取校验，F-G4-14）**：三处读取统一改 `loadAndValidate(file, 'project')`（`lib/load-and-validate.ts` 既有出口；失败 → STRUCTURE_INVALID exit 2）：`check-budget.ts:151-160`、`check-maturity.ts:132-147`、`wm-status.ts:65`。RED：缺必填字段的 project.json → 三入口各 exit 2。`command-reference.md` 补口径句。注意：既有 warn-and-skip 的用例（budget R1 跳过路径）改为「合法 project + 缺 updatedAt 字段场景已不可能」——同步翻转受影响测试预期。
- [ ] **步骤 6.2（description 补全 + 门禁化，F-G4-08）**：`evidence-provenance.schema.json` 17 处、`evidence-manifest.schema.json` 7 处、`gate-log.schema.json` 6 处补 `description`（内容一句话说明字段语义，参考 data-models.md 对应节）。`docs-consistency-logic.ts` 新增检查：

```ts
export function checkSchemaFieldDescriptions(schemas: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const visit = (node: unknown, path: string, file: string) => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Record<string, unknown>;
    if (n.properties && n.description === undefined) violations.push(`${file}: ${path} 缺 description`);
    for (const [k, v] of Object.entries(n.properties ?? {})) visit(v, `${path}/${k}`, file);
    for (const [k, v] of Object.entries((n.definitions ?? n.$defs) as object ?? {})) visit(v, `${path}/definitions/${k}`, file);
    if (Array.isArray(n.items)) n.items.forEach((v, i) => visit(v, `${path}/items/${i}`, file)); else visit(n.items, `${path}/items`, file);
  };
  for (const [file, schema] of Object.entries(schemas)) visit(schema, '#', file);
  return violations;
}
```

接入 `EXPECTED` 检查组与 CLI；负例测试（篡改删一个 description → violation）。
- [ ] **步骤 6.3（schema 修正）**：`rtm.schema.json` `$defs`→`definitions`（含 `#/$defs/` 引用改 `#/definitions/`）；`verifier-output.schema.json:22` `minimum` 1→3（与描述「>=3」一致；同步翻转接受 2 的既有测试预期）；`code-tla-manifest.schema.json:13,21,65,73,86,100,108` 与 `tla-manifest.schema.json:106` 的嵌套 `additionalProperties:true` 改 `false`（`checkRounds` 一并补自述）——若某处确有开集语义，改 data-models.md:964/:989 措辞为「该层允许扩展字段」并在任务报告登记取舍。
- [ ] **步骤 6.4（data-models 幽灵字段，F-G4-10/12）**：`:981` `actorRole` 改实际字段（`role`/`sourceRole`，对照 schema）；`:977` coverage 行删「coveragePercent [0,100]」或改「metrics.* 数值以消费方 `===100` 判定为准」。
- [ ] **步骤 6.5（计数与弱校验，F-G7-04/05/08）**：`conventions.md:119`「= 35」改「= 36（26 个 check-* + 10 个工具 CLI，不含 self-test）」；`docs-consistency-logic.ts` 新增该行计数检查（读 conventions.md 提取数字 == `EXPECTED.exit2ScriptCount`）；`:58` action 27 值列表增「glossary 列表 == run-log.schema action enum」逐值断言（实现挂 `checkGlossaryAction` 旁）；`:1358-1374` `checkPrePushCount` 重写：

```ts
export function checkPrePushCount(hookText: string): string[] {
  const violations: string[] = [];
  const ids = Array.from(hookText.matchAll(/^# (\d+)\./gm), (m) => Number(m[1]!));
  const expected = Array.from({ length: EXPECTED.prePushCount }, (_, i) => i + 1);
  if (ids.length !== expected.length || !ids.every((n, i) => n === expected[i])) {
    violations.push(`pre-push 检查块须连续 #1..#${EXPECTED.prePushCount} 且恰 ${EXPECTED.prePushCount} 块，实测 ${ids.length} 块 [${ids.join(',')}]`);
  }
  if (!hookText.includes(`${EXPECTED.prePushCount} 项检查`)) violations.push('pre-push 缺「17 项检查」声明文本');
  return violations;
}
```

RED：复用复核反例（3 块伪造 + 文本）→ 必须违规。
- [ ] **步骤 6.6（samples 门禁双向化，F-G7-06/07）**：`check-samples-coverage.ts:120-152` 增反向校验：self-test 引用的 fixture 路径必须存在于盘（dangling → exit 1，违规文案 `reference-dangling`）；`:155-163` matrix-undeclared 改为解析 README 矩阵表行（`| <dir> |` 行首列）而非全文反引号。RED：临时 README 缺行 / dangling 引用各一（负例走测试内临时目录，不动仓库 samples）。
- [ ] **步骤 6.7（文档算术与转义，F-G7-01/02/03）**：`subagent-delegation.md:279` 改「26 个 check-* + 11 个工具 CLI」（并核对 §6.4 表补 plan-chunks 行或加「plan-chunks 见 §2」注）；`:281` 改「登记点为本表 + SKILL.md/AGENTS.md 计数句（由 checkScriptRegistry 与计数检查双向兜底）」；`AGENTS.md:164` 3 个管道符转义 `\|`。
- [ ] **步骤 6.8（S49）**：`docs/troubleshooting.md:90`「1300+ 用例」改「用例数以当前命令输出为准」。
- [ ] **步骤 6.9**：定向回归 `docs-consistency-logic.test.ts` + `check-samples-coverage.test.ts` + 全量 `check-docs-consistency`/`check-samples-coverage` 实跑 exit 0 + self-test 262 + prettier。Commit：`fix(contracts): enforce project schema on reads, harden count gates, backfill schema descriptions`（commit 前追加任务 5 父链行）。

---

### 任务 7：D7 pre-push 健壮性（F-G5-01…05）

**文件：**
- 修改：`.githooks/pre-push:38,378-380,394`
- 测试：`w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`

- [ ] **步骤 7.1（blocking 语料，F-G5-01）**：`:378` blocking 正则中 `vulnerabilit(y|ies)` 改 `vulnerab[a-z]*`；测试 audit skip boundary 表驱动增 2 行：`npm warn vulnerable packages found` → 期望 **block**；既有 vulnerability 行期望不变。
- [ ] **步骤 7.2（POSIX 边界，F-G5-02）**：`:394` 状态词分支两处 `\b(X|Y|Z)\b` 改 `(^|[^[:alnum:]_])(X|Y|Z)([^[:alnum:]_]|$)`（X/Y/Z = `Bad Gateway|Service Unavailable|Gateway Time-?out|Internal Server Error`；保持同行 network/registry/request 锚定语义不变）。`:38` 注释补一句「本脚本 grep 正则仅用 POSIX ERE，无 GNU `\b` 等专有语法」。验证：`bash -n .githooks/pre-push`；用临时脚本抽取 `audit_can_skip` 对 r2/复核既有的 8 组样本重跑（network 前缀/E404 上下文/裸 E404/状态词有无锚定/npm7/vulnerable）全部判定与改前一致。
- [ ] **步骤 7.3（路径过滤测试，F-G5-03/04）**：`platform-deps-hook.test.ts` 增 it.each 组：命中——`docs/changes/2026-09-06.md`、`docs/superpowers/deep/sub.md`、`.githooks/pre-push`、`w-model-dev/scripts/a/b/c.ts`、`README.md`、`package.json`；跳过——`eval/x.json`、`docs/notes.txt`。断言走既有 run() harness（stdin 或 fallback 模式，参照 `:490/:531` 既有用例）。
- [ ] **步骤 7.4（quotePath 源级断言，F-G5-05）**：

```ts
it('quotePath=false 覆盖全部 4 处 git diff/log 调用', () => {
  const src = readFileSync(new URL('../../../../.githooks/pre-push', import.meta.url), 'utf8');
  expect(src.match(/-c core\.quotePath=false git (diff|log)/g)).toHaveLength(4);
});
```

（相对路径按测试文件实际层级调整。）
- [ ] **步骤 7.5**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts 2>&1 | tail -3`（全绿）+ `bash -n .githooks/pre-push`。Commit：`fix(hooks): broaden audit blocking corpus, POSIX word boundaries, pin path-filter contract in tests`（commit 前追加任务 6 父链行）。

---

### 任务 8：D8 测试套件质量（F-G8-01/04/05/06/07、S56/S57/S64）——必须在任务 1 之后

**文件：**
- 修改：`w-model-dev/scripts/__tests__/examples-contract.test.ts:8-9,80-81,146-147,174,180,525-528,558-578`、`wm-write.test.ts:319-344`、`run-sync.test.ts:441`、`cli/self-test.ts:17,3457-3490`

- [ ] **步骤 8.1（wm-write flake，F-G8-05）**：`:319-344` 双子进程并发改受控交错：启动写者 A → 轮询等待 `<target>.lock` 目录出现（上限 5s）→ 启动写者 B → 等两者退出；断言 A exit 0 成功、B exit 1 且 summary 含 `MTIME_CONFLICT` 或 lock 占用错误（两种可判定终态显式枚举）。删除对「两进程自由竞争恰一成功」的断言。连跑 5 次验证稳定：`for i in 1 2 3 4 5; do npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-write.test.ts 2>&1 | tail -1; done`。
- [ ] **步骤 8.2（run-sync 墙钟，F-G8-06）**：`:441` 改相对窗口：

```ts
expect(elapsedMs).toBeGreaterThanOrEqual(timeoutMs - 20); // timeout:250 → 下限 230
expect(elapsedMs).toBeLessThan(timeoutMs + 2000);
expect(errorCode).toBe('ETIMEDOUT');
```

（`timeoutMs`/`errorCode` 取 `:437-440` 既有变量实际名。）
- [ ] **步骤 8.3（链常量分离，F-G8-01）**：`:80-81` `ORDINARY_FAILURE_CHAIN` 重定义为 `'普通 V/G 失败链'`（T1 后的规范短名语义），`FAILURE_CHAIN` 保持全句；新增守卫 `expect(FAILURE_CHAIN).not.toBe(ORDINARY_FAILURE_CHAIN);`。引用点逐一核对语义（`grep -n ORDINARY_FAILURE_CHAIN`），凡需要全句处不得改用短名。
- [ ] **步骤 8.4（正则单源，S56）**：`:174/:180` 与 `:525-528` 的禁词判定统一引用 `LINE_PROHIBITION`（`:525-528` 的第三份拷贝删除，循环改用共享常量，必要时去 `g` 标志差异改 `new RegExp(LINE_PROHIBITION.source, 'g')`）。
- [ ] **步骤 8.5（注释-语料同步，F-G8-03/04、S64）**：`:146-147`（T1 已改则核对）、`:558-578` 测试 provenance 注释改为「构造样本，非语料引用」（grep 确认所指旧文本确已不存在）；`self-test.ts:17` 注释改「26 个样本子目录（33+1 个用例数组）」。
- [ ] **步骤 8.6（self-test 分项闭合，F-G8-07）**：`self-test.ts:3457-3490` 头部打印区在合适位置补：

```ts
console.log(`DesignContract 用例 : ${DESIGN_CONTRACT_CASES.length} 条`);
```

验证：`npm run self-test 2>&1 | grep -c "用例 : "` 后各分项求和 = 262（shell 算术核对），尾部总计不变。
- [ ] **步骤 8.7**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/examples-contract.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts 2>&1 | tail -3` 全绿。Commit：`test: de-flake wm-write concurrency, bound run-sync wall clock, separate chain constants`（commit 前追加任务 7 父链行）。

---

### 任务 9：D9 台账收口 + 全量回归 + prepush

**文件：**
- 修改：`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`（父链表 + 新验证记录节）、`CHANGELOG.md`（42.2.1 节散文段）、`docs/superpowers/specs/2026-09-06-audit-fixes-findings-catalog.md`（处置列回填）

- [ ] **步骤 9.1（父链补链与追加）**：父链表按时间顺序追加——上一战役两个未链收口提交 `98bfda09cb9daaac0ea0f1f1a651b946556f514c`、`2fa27d637a7bf35831d2cdb02d57783d3b5d2796`，本战役 `19e83fa`（规格+目录）、计划 commit、T1-T8 全部 commit（40 字符完整 SHA + subject 逐字引用；逐 commit 用 `git rev-parse <ref>` 取全 SHA）。校验连续性：`git log --format=%H 2fa27d6..HEAD | tac` 与表行逐行比对一致。
- [ ] **步骤 9.2（目录处置回填）**：`findings-catalog.md` 主表「处置建议」列逐条落定：49 M 全部 `fix`（登记实现 commit）；64 说明级按「说明级处置映射」落 `fix`（13 条）或 `defer`；F-G6-03 维持「已裁定不改」。
- [ ] **步骤 9.3（验证记录节）**：acceptance 文档新增「## 核查发现修复（audit-fixes）验证记录（2026-09-06）」——逐任务定向回归真实退出码表 + 全量结果 + 已知 flake 如实记录（有则隔离重跑记录，不放宽）。范围句：「父链表追加 `98bfda0…` 起至 `<T8 sha>` 共 N 行；本收口提交自身按规则不入链」。
- [ ] **步骤 9.4（CHANGELOG）**：42.2.1 节追加散文段（对照 review2-fixes 段式：6I + 49M 处置概述、行为变更清单、规格/计划/目录指针、版本保持声明、父链范围句）。
- [ ] **步骤 9.5（全量回归）**：依次执行并记录真实退出码——`npx vitest run --config config/vitest.config.ts`（全量，用例数与任务 0 基线对照，变化如实登记）、`npm run self-test`、`npm run eval`、`npm run typecheck`、`npm run lint:security`、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`、`npm run audit:l0-links`、`npm run doctor`、`npm audit --audit-level=high`。任何失败：定位→修复→重跑，不放宽 gate；负载敏感 flake 隔离重跑并如实记录。
- [ ] **步骤 9.6（prepush）**：`npm run prepush` 17 项全绿（真实输出尾行入报告）。
- [ ] **步骤 9.7（终审交接）**：向编排者报告 BASE（`2fa27d6`）..tip 提交清单，请求独立终审；终审 0C/0I 且用户同意后方 ff-merge 到 main；**不 push**。台账收口提交自身不入链（由下一轮链接）。

---

## 自检记录（计划完成时已执行）

1. **规格覆盖度**：D1→T1、D2→T2、D3→T3、D4→T4、D5→T5、D6→T6、D7→T7、D8→T8、D9→T9；目录 49M 逐条归属——G1(7)→T1、G2(5)→T2/T5、G3(2)→T3、G4(13)→T4/T5/T6、G5(5)→T7、G6(2)→T5、G7(8)→T6、G7 计数类→T6、G8(7)→T1/T8；无遗漏条目。
2. **占位符扫描**：全文零未完成标记命中（本句为扫描记录，不含被禁词面）；所有代码步骤含代码块；fixture/action 枚举等 3 处「以文件内实际为准」均为带定位的核验指令（`schemas/run-log.schema.json:150`、`samples/coverage/valid-cross-cuts-consistent.json`、测试文件名以 `__tests__/` 实际为准），非占位符。
3. **类型/命名一致性**：`C7b`、`skippedRules`、`warnings`、`LEGACY_REWORK_HINTS`、`reference-dangling`、`phaseFlagPresent` 各任务引用一致；`DuplicateFlagError` 复用 `lib/parse-args.ts` 既有导出；`loadAndValidate` 为 `lib/load-and-validate.ts` 既有出口。
