# 42.1.1 Deferred 项修正实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修正 42.1.0 证据支撑树集成过程中登记的全部 deferred 项——1 个真实测试竞态 bug、security baseline 卫生债、以及 6 处活体文档/风格微修。

**架构：** 三个独立任务（可独立评审）：
- 任务 1：修复 `run-sync.test.ts ↔ dependency-boundaries.test.ts` 全量并行竞态（TDD：先写失败测试，再实现跳过瞬态 fixture，再并行稳定性验证）。
- 任务 2：security baseline 全量对账（`--regenerate`，删除 116 条孤儿条目、更新 line 字段），消除 49 提交累计的卫生债。
- 任务 3：活体文档/风格微修批次（R15 用途列、§2.1 复用说明、A-chunk L42 示例、§10A 表行对齐、§3.1 触发表补行、`test()`→`it()` 统一）。

**明确不做（YAGNI，已在台账裁定，不列入任务）**：
- R15 正则字符类不含反斜杠——仓库 path 定位约定统一正斜杠（`conventions.md` 目录约定），与 `verifier-logic.ts` EVIDENCE_PATTERN 同款一致，不构成问题。
- 历史计划文档（`docs/superpowers/`）中的数字残留（如 GRAPH_CASES 28→30 应为 29→31）——内部规划目录，不参与门禁、非面向用户，保留历史原样。
- `docs-consistency` probe 中 `security-scan#missing-path` 的 FILE_READ——pre-existing 行为，合法。
- Task 1 简报残留 `graph-logic.test.ts` 引用——内部简报文档，非活体资产。

**技术栈：** vitest（runner）、tsx（CLI）、Node 标准库、eslint-plugin-security（baseline v2 content-line 指纹）。

---

## 文件结构

| 文件 | 职责 | 操作 |
|---|---|---|
| `w-model-dev/scripts/__tests__/run-sync.test.ts` | 竞态修复：`collectTypeScriptFiles` 跳过 `.d2-` 瞬态 fixture + 新增回归测试 | 修改 |
| `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts` | 保持不变（它需要读自己的 `.d2-` fixture，跳过逻辑只加在 run-sync 侧） | 只读参照 |
| `.eslintsecurity-baseline.json` | baseline 全量对账（`--regenerate`） | 重生成 |
| `w-model-dev/scripts/samples/README.md` | graph 行用途列 R1-R14 → R1-R15 | 修改 |
| `w-model-dev/references/conventions.md` | §2.1 补 evidenceAnchor 复用说明行 | 修改 |
| `w-model-dev/references/ingestion-chunk.md` | A-chunk 小节补 L42 行号形式示例 | 修改 |
| `docs/skill-design-document_SSoT.md` | §10A 表行对齐（4A.1b 行） | 修改 |
| `w-model-dev/references/subagent-delegation.md` | §3.1 触发条件表补 evidence-anchored-tree 行 | 修改 |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | R15 块 4 个 `test()` → `it()` 统一风格；从 import 移除 `test` | 修改 |

---

### 任务 1：修复 run-sync ↔ dependency-boundaries 全量并行竞态

**文件：**
- 修改：`w-model-dev/scripts/__tests__/run-sync.test.ts:26-37`（`collectTypeScriptFiles`）+ 文件内新增 1 条测试
- 参照（不改）：`w-model-dev/scripts/__tests__/dependency-boundaries.test.ts:227-241`

**根因（已锁定）**：`dependency-boundaries.test.ts` 在 `scripts/logic/` 下创建瞬态 `.d2-boundary-fixture-${pid}.ts`（L227），`run-sync.test.ts` 的 `collectTypeScriptFiles` 全量遍历 `scripts/**/*.ts` 并对每个文件 readFile（L39-46）。vitest 全量并行运行时，run-sync 可能恰好读到该瞬态文件的生命周期窗口（已创建未删除），触发 ENOENT。修复 = 在 run-sync 侧跳过 `.d2-` 前缀文件；dependency-boundaries 自己的 `findTypeScriptFiles` 不跳过（它需要读取自己的 fixture 测违规），两文件从此互不交叉。

- [ ] **步骤 1：编写失败的测试**

在 `run-sync.test.ts` 的 `findDirectSyncCalls` 定义之后（`describe('runSync', ...)` 之前）新增：

```typescript
it('skips dot-prefixed transient fixtures created by parallel tests', async () => {
  const transient = path.join(SCRIPT_ROOT, 'logic', `.d2-boundary-fixture-${process.pid}-probe.ts`);
  await fs.writeFile(transient, "import 'fs';\n");
  try {
    const files = await collectTypeScriptFiles(SCRIPT_ROOT);
    expect(files.some((file) => file === transient)).toBe(false);
  } finally {
    await fs.rm(transient, { force: true });
  }
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts`
预期：该新测试 FAIL（当前 `collectTypeScriptFiles` 不跳过 `.d2-` 前缀）。

- [ ] **步骤 3：实现修复**

将 `collectTypeScriptFiles` 改为跳过 `.d2-` 前缀条目：

```typescript
async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test starts from repository-controlled scripts root
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      // Skip transient fixtures written by parallel tests (e.g. dependency-boundaries'
      // .d2-boundary-fixture-<pid>.ts) to avoid racing their write/remove lifecycle.
      if (entry.name.startsWith('.d2-')) return [];
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    }),
  );
  return files.flat();
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts`
预期：全部 PASS（含新测试）。

- [ ] **步骤 5：并行稳定性验证（竞态修复的核心证据）**

连跑 5 次组合（原竞态最易复现的组合）：
`for i in 1 2 3 4 5; do npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts || echo "RUN $i FAILED"; done`
预期：5 次全部通过。修复前该组合偶发失败（历史记录：组合即复现 ENOENT）。

- [ ] **步骤 6：全量 vitest 回归**

运行：`npx vitest run --config config/vitest.config.ts`
预期：59 文件全绿，1245+1（新测试）= 1246 条通过，0 失败。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/__tests__/run-sync.test.ts
git commit -m "fix(test): skip .d2- transient fixtures in run-sync scan (parallel race with dependency-boundaries)"
```

---

### 任务 2：security baseline 全量对账（卫生债清理）

**文件：**
- 重生成：`.eslintsecurity-baseline.json`

**背景（已锁定）**：baseline 自 commit 7ff965c（2026-08-27）最后一次更新后，历经 49 提交、29 个 `w-model-dev/scripts/` 文件变更未对账——现存 116 条孤儿条目（对应已删除/改写的代码，v2 内容指纹永不匹配、永不失败，是纯卫生债）+ 129 条 line 字段漂移。42.1.0 集成期间因避免污染发布提交，裁定「外科式 +1」（410→411）并在台账登记「另行立项」——本任务即该立项的正式执行。`--regenerate` 是 `security-scan.ts` 文档化的标准维护命令（AGENTS.md §3 / security-scan.ts L15）。

- [ ] **步骤 1：备份当前 baseline**

运行：`cp .eslintsecurity-baseline.json /tmp/baseline-before-regen.json`
记录备份的条目数（预期 411）。

- [ ] **步骤 2：记录对账前基线**

运行：`npx tsx w-model-dev/scripts/cli/security-scan.ts`
预期：exit 0，`baseline 指纹数：411 / 已豁免：411 / 新增发现：0`（对账前状态确认）。

- [ ] **步骤 3：全量重生成**

运行：`npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate`
预期：exit 0；生成新 baseline（条目数应约为 295，覆盖当前全部真实发现，删除 116 孤儿）。

- [ ] **步骤 4：验证对账产物自洽**

运行：`npx tsx w-model-dev/scripts/cli/security-scan.ts`
预期：exit 0，`新增发现：0`（新 baseline 恰好覆盖当前发现集）。

- [ ] **步骤 5：diff 审查（人为检查点）**

运行：`git diff .eslintsecurity-baseline.json | head -80`
人工确认：删除的是孤儿条目（file/rule 对应已不存在的风险点）、无「删除一个仍被当前代码触发的发现」的误删。若误删→中止并回滚备份，报告编排者。

- [ ] **步骤 6：docs-consistency + 全量 vitest 回归**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（预期 exit 0；baseline-sync 检查只要求「scripts 变更时 baseline 存在且非空」，条目数变化不触发失败）
运行：`npx vitest run --config config/vitest.config.ts`（预期全绿）

- [ ] **步骤 7：Commit**

```bash
git add .eslintsecurity-baseline.json
git commit -m "chore(security): regenerate baseline v2 (reconcile 49-commit drift, drop 116 orphan entries)"
```

---

### 任务 3：活体文档/风格微修批次

**文件：**
- 修改：`w-model-dev/scripts/samples/README.md:14`
- 修改：`w-model-dev/references/conventions.md`（§2.1，约 L149-164）
- 修改：`w-model-dev/references/ingestion-chunk.md`（A-chunk 小节，约 L75-79）
- 修改：`docs/skill-design-document_SSoT.md:2109`（§10A 4A.1b 行）
- 修改：`w-model-dev/references/subagent-delegation.md`（§3.1，约 L131-189）
- 修改：`w-model-dev/scripts/__tests__/graph-logic.test.ts`（L13 import + L1177/1186/1192/1198）

- [ ] **步骤 1：samples/README.md graph 行用途列 R1-R14 → R1-R15**

当前：`| \`graph\` | check-requirement-graph | GRAPH_CASES（31）+ ENHANCE×4（16） | 图谱 R1-R14 + 规格/大纲/详细设计增强 | 平铺 JSON |`
改为：`| \`graph\` | check-requirement-graph | GRAPH_CASES（31）+ ENHANCE×4（16） | 图谱 R1-R15 + 规格/大纲/详细设计增强 | 平铺 JSON |`

- [ ] **步骤 2：conventions.md §2.1 补 evidenceAnchor 复用说明**

在 §2.1「VerifierOutput evidence」标题行之后、格式说明之前，新增一行：

```markdown
> 本格式同时是 `graph.json` 节点可选字段 `evidenceAnchor`（产出期证据锚点）的格式权威（见术语表 evidenceAnchor 条目）。
```

- [ ] **步骤 3：ingestion-chunk.md A-chunk 小节补 L42 行号形式示例**

在现有 §section 示例行（`- 示例：\`"evidenceAnchor": "docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）"\``）之后新增一行：

```markdown
- 代码来源示例：`"evidenceAnchor": "src/auth.ts:L42-58=JWT 签发逻辑"`
```

- [ ] **步骤 4：SSoT §10A 4A.1b 表行对齐**

将 4A.1b 行各单元格补空格对齐到与邻行（4A 行 / 6 命令接口行）视觉等宽的列宽。保留单元格文本逐字不变，仅调整内联空格使其表格对齐（Markdown 渲染不受影响，纯源码美观一致性）。对齐后运行 `git diff docs/skill-design-document_SSoT.md | head -40` 人工确认单元格文本未变。

- [ ] **步骤 5：subagent-delegation.md §3.1 触发条件表补 evidence-anchored-tree 行**

在表中合适位置（建议按字母序邻近 `design-philosophy` / `estimation-guide` 区域，或 `graph-guide` 后新增；以现表观感最自然为准）新增：

```markdown
| evidence-anchored-tree | 路径不确定 / 需求模糊项目的方法论参照（证据支撑树 × W 模型映射，42.1.0 新增） | 1 跳 |
```

同时检查表尾「2 跳文件共 11 个」清单与「其余 27 个文件」统计是否需要同步更新（新增行若为 1 跳，27 → 28）。**注意**：该统计为表内自述，须与实际行数一致（实现者现场清点，报告中给出核对结果）。

- [ ] **步骤 6：graph-logic.test.ts R15 块 `test()` → `it()` 风格统一**

- L13 import：`import { describe, it, expect, test } from 'vitest';` → `import { describe, it, expect } from 'vitest';`（移除不再使用的 `test`）
- L1177 / L1186 / L1192 / L1198：`test('...', () => {` → `it('...', () => {`（4 处，字符串参数逐字保留）

- [ ] **步骤 7：验证**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/graph-logic.test.ts`（预期全绿，R15 4 用例转 it 后仍通过）
运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（预期 exit 0；纯活体文档微修，静态/动态 0 违规——若遇 `[vitest-results]` 偶发 fail-closed 属已知 run-sync 竞态，重跑确认）
运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（预期 exit 0）

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/samples/README.md w-model-dev/references/conventions.md w-model-dev/references/ingestion-chunk.md docs/skill-design-document_SSoT.md w-model-dev/references/subagent-delegation.md w-model-dev/scripts/__tests__/graph-logic.test.ts
git commit -m "docs(evidence-tree): polish deferred doc/style residue (R15 label, 2.1 reuse note, L42 example, 10A align, 3.1 table row, test→it)"
```

---

## 自检记录（编写时执行）

- **规格覆盖度**：
  - 台账 deferred 竞态（run-sync ↔ dependency-boundaries）→ 任务 1（修复+回归+并行稳定性 5 连跑）。
  - 台账 baseline 卫生债（116 孤儿 + line 漂移，另行立项）→ 任务 2（全量对账 + 误删检查点）。
  - 台账 I1 samples/README 用途列 R1-R14 → 任务 3 步骤 1。
  - 台账 I1 conventions §2.1 复用说明 → 任务 3 步骤 2。
  - 台账 I2 A-chunk L42 示例 → 任务 3 步骤 3。
  - 台账 I1 SSoT §10A 表行对齐 → 任务 3 步骤 4。
  - 终审 deferred subagent-delegation §3.1 补行 → 任务 3 步骤 5。
  - 台账 test() vs it() → 任务 3 步骤 6。
  - YAGNI 不修项（正则反斜杠 / 历史计划文本 / probe 行为 / 简报残留）→「明确不做」段，已登记不列任务。
- **占位符扫描**：所有代码块为完整可粘贴内容；无 TODO/待定/后续实现；任务 3 步骤 5 的统计核对为现场动作（实现者核对并报告数值），属「必须实际执行并报告数值」而非占位。
- **类型一致性**：`collectTypeScriptFiles` 签名与返回类型不变（`(directory: string) => Promise<string[]>`）；`.d2-` 前缀判定与 dependency-boundaries 的 `.d2-boundary-fixture-${pid}.ts` 命名逐字对应；`it()` 与现网 43 处风格一致；步骤 4 对齐仅改空格不改单元格文本。

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-09-01-deferred-items-fix.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
