# 未解/延后全量清收 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
> 规格：`docs/superpowers/specs/2026-09-27-deferred-closeout-design.md`（计划是它的逐任务展开；冲突时以规格为准并回来改计划）。
> 账本（gitignored）：`.superpowers/sdd/2026-09-27-deferred-closeout/progress.md`（首行身份 + 逐任务 `Task N: complete`）；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`。
> 回归纪律（约束 #14）：任何 `.ts` 文件 `Edit`/`Write` 前先经 codegraph CLI 查询目标符号影响半径并落 `.w-model/codegraph-queries/`；每组结束跑定向 vitest，任务 10 跑全量 `npm run prepush`。
> 行号说明：文中 `:N` 为编写计划时的实测锚，实现时以符号名搜索为准，漂移不构成偏差。

**目标：** 把 live-run-findings-remediation 批次的全部延后 minor（账本行合并口径 62 项）处置完毕——修 51 / 销 8（CHANGELOG 登记理由）/ 显式不修 3——终局全量 prepush 19 项全绿。

**架构：** 四组任务推进：G1 文档措辞（3 任务）→ G2 测试补强（2 任务）→ G3 代码小额（3 任务，含 2 处行为增量）→ G4 登记与夹具（1 任务）→ 收口（1 任务）。文档组先行（零风险面），行为增量集中在任务 8 单独评审。所有新字段可选、不改判据编号、历史 fixture 零改动即绿。

**技术栈：** TypeScript（tsx runtime）、vitest、ajv（schema）、纯文档与登记册编辑。

---

## 文件结构（分解锁定）

| 文件 | 动作 | 涉及任务 |
| --- | --- | --- |
| `w-model-dev/references/{data-models,operational-recovery,command-reference,subagent-delegation,hard-constraints,conventions,verifier-spec,phase-5-coding}.md` | 修改 | 1,2,3 |
| `w-model-dev/SKILL.md` | 修改 | 2 |
| `docs/skill-design-document_SSoT.md` | 修改 | 1,3,9 |
| `docs/INSTALL.md` / `README.md` / `CHANGELOG.md` | 修改 | 2,10 |
| `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` | 修改 | 3 |
| `docs/debug/2026-09-25-wave-b-integrity/README.md` | 修改 | 3 |
| `w-model-dev/scripts/__tests__/{maturity-logic,iceberg-logic,check-coding-plan,check-codegraph-queries,check-budget*}.test.ts`、`__tests__/README.md` | 修改 | 4,5,6,7,8 |
| `w-model-dev/scripts/cli/check-codegraph-queries.ts` | 修改 | 6 |
| `w-model-dev/scripts/logic/evidence-provenance-logic.ts` / `logic/evidence-export-logic.ts` | 修改 | 6,7 |
| `w-model-dev/scripts/logic/iceberg-sweep-logic.ts` | 修改 | 6 |
| `w-model-dev/scripts/cli/check-coding-plan.ts` / `logic/coding-plan-logic.ts` | 修改 | 6,7 |
| `w-model-dev/scripts/cli/check-budget.ts` | 修改 | 7,8 |
| `w-model-dev/scripts/cli/check-archive-integrity.ts` / `logic/archive-integrity-logic.ts` | 修改 | 7,8 |
| `w-model-dev/scripts/lib/run-sync.ts`、`docs/troubleshooting.md`、`.eslintsecurity-baseline.json` | 修改 | 7 |
| `w-model-dev/schemas/run-log.schema.json` | 修改 | 8 |
| `w-model-dev/scripts/samples/**`、`samples/NEGATIVE-COVERAGE.md`、`samples/README.md` | 修改/新增 | 5,8,9 |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | 8,9 |
| `.superpowers/sdd/2026-09-27-deferred-closeout/` | 创建 | 0-10 |

---

## 任务 0：开工准备

**文件：** 创建 `.superpowers/sdd/2026-09-27-deferred-closeout/progress.md`（gitignored）

- [ ] **步骤 1：分支与账本**

分支 `feat/deferred-closeout` 已建（规格提交 `804d63b5` 在其上）。账本首行写：`plan=2026-09-27-deferred-closeout phase=repo-maintenance`。

- [ ] **步骤 2：基线取证**

`npm run self-test 2>&1 | tail -1`（预期 376/376）、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts 2>&1 | tail -1`（预期 exit 0，记录 fixture/探针计数）、`git log --oneline -1`，写入账本。

---

# G1 · 文档措辞面

## 任务 1：时间戳三态与追加器文档族（G1-5/9/13/14/15/16 + 销6 复述）

**文件（逐项锚，均先 grep 符号/短语定位再改）：**
- `w-model-dev/references/data-models.md`（R7/R11 条目段，约 :527、:530、:565）
- `w-model-dev/references/operational-recovery.md`（约 :456、:487）
- `w-model-dev/references/subagent-delegation.md`（约 :403）
- `w-model-dev/SKILL.md`（约 :88）
- `docs/skill-design-document_SSoT.md`（约 :1923）
- `w-model-dev/scripts/lib/run-log-append-logic.ts`（头注注释，约 :22-28）
- `w-model-dev/scripts/cli/wm-append-runlog.ts`（头注，约 :10-11）

- [ ] **步骤 1：统一时间戳三态编号**

权威编号以 `run-log-logic`/`wm-append-runlog` 实现注释为准（① 显式时间戳 ≤ 末条 → exit 1；② 无显式且时钟真倒退 → exit 1 仅 `--allow-clock-adjust` 放行；③ 无显式且同毫秒/批内冲突 → 良性 +1ms 步进）。逐文件核对：凡写「①早于/②同毫秒/③批内」错位序的（run-log-append-logic.ts 自编号、data-models:530、SSoT:1923 一带），改为权威序；凡缺 ③ 的 `auto+<N>ms` 形态表述的四处（G1-15：SSoT:1923 / data-models:530 / subagent-delegation:403 / operational-recovery:487）补「（同毫秒良性步进形态 `clock-adjust:auto+<N>ms`）」半句。CLI 头注与两 markdown 若仍有非逐字差异，以最完整版本逐字统一（G1-14）。

- [ ] **步骤 2：补口径缺句**

G1-9：data-models.md R7 段（约 :565）补一句「LEGACY 分支命中时输出一条非阻断诊断（历史段 N 条无哈希），非静默跳过」。G1-13：data-models:527 附近的时间戳形态描述与新增登记对齐（补 ②③ 两态短语）。G1-16：operational-recovery 的 `--timestamp` 逃生口句补「须晚于末条，且与载荷自带 `timestamp` 互斥（同给 exit 2）」。G1-12：operational-recovery:456 表内「不在本表」自指措辞改为直述所指脚本名。

- [ ] **步骤 3：验证**

`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 静态段无违规即可（完整门禁任务 10 跑）；`grep -rn "①早于\|②同毫秒" w-model-dev/references docs/skill-design-document_SSoT.md` 确认错位序清零。

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/references w-model-dev/SKILL.md w-model-dev/scripts/lib/run-log-append-logic.ts w-model-dev/scripts/cli/wm-append-runlog.ts docs/skill-design-document_SSoT.md
git commit -m "docs(runlog): 时间戳三态编号统一 + ③形态/LEGACY诊断/互斥口径补句（G1-5/9/12/13/14/15/16）"
```

## 任务 2：门禁口径与 usage/计数族（G1-6/10/11/17/18/19/20/21 + G3-11 usage 文案）

**文件：**
- `w-model-dev/references/command-reference.md`（约 :69、:76）
- `w-model-dev/SKILL.md`（约 :88 五门表述）
- `w-model-dev/references/operational-recovery.md`（调用时机表，约 :449-455）+ `data-models.md`（约 :399）
- `CHANGELOG.md`（`[42.3.0]` Wave B 小节）
- `w-model-dev/scripts/cli/check-budget.ts`（:16 usage）
- `docs/INSTALL.md`（:111 附近）、`w-model-dev/scripts/cli/self-test.ts`（:17 注释）、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（头注）

- [ ] **步骤 1：command-reference 补全（G1-10）**

wm-append-runlog 条目的拒绝原因枚举补 `TARGET_MISSING_FOR_MTIME` / `INVALID_JSON`；`--json` 输出键清单补 `ok` / `legacyInvalidLines`（以 CLI 实际输出为准核对）。

- [ ] **步骤 2：五门表述对齐（G1-11）与调用表接线句（G1-17/18）**

SKILL.md:88 五门表述与 operational-recovery:447 口径对齐（五门名实一致：budget/run-log/maturity/checkpoint/preventive-review）。operational-recovery 调用表与 data-models:399 各补一句「提供了 `--run-log` 但读取失败时不出『未接线』诊断（此时走该门自身的失败路径）」；三处调用表占位风格统一为 `--run-log=.w-model/run-log.jsonl --phase=N`。

- [ ] **步骤 3：CHANGELOG 三处措辞（G1-19/20/21）与计数漂移（G1-6）**

`[42.3.0]` Wave B：「四处例外」句后补四个实锚（hard-constraints 约束 #11 节 / SSoT §10.6 强制校验脚本条 / data-models R11 条 / command-reference R11 条的搜索短语）；「非静默假通过」改精确表述「诊断可见但不阻断」；引用 `.superpowers/sdd/...` 账本的句子补「（gitignored 账本，路径为引用非交付物）」。G1-6：INSTALL.md:111 lib 计数、self-test.ts:17 注释计数、NEGATIVE-COVERAGE 头注探针耗时句，按 `ls w-model-dev/scripts/lib/*.ts | wc -l` 等实测订正。

- [ ] **步骤 4：check-budget usage 接线限定（G3-11）**

`:16` usage 文案由 `[--run-log=<run-log.jsonl>]` 改为 `[--run-log=<run-log.jsonl> --phase=<N>]（阶段门调用必带：R6/R5-b 用量校验的接线判据）`——纯 usage 字符串，不改参数解析。

- [ ] **步骤 5：验证与 Commit**

`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-budget` 相关文件（usage 若被断言须同步——先 grep 断言）。Commit：

```bash
git add w-model-dev/references w-model-dev/SKILL.md w-model-dev/scripts/cli/check-budget.ts docs/INSTALL.md w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md CHANGELOG.md
git commit -m "docs(gates): command-reference 枚举补全 + 五门对齐 + 接线口径成文 + 计数订正（G1-6/10/11/17-21, G3-11）"
```

## 任务 3：verifier/规格判据/证据 README 族（G1-1/2/3/4/7/8/22/23/24/25）

**文件：**
- `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md`（§3 WS-1）
- `w-model-dev/references/{subagent-delegation,hard-constraints,conventions,verifier-spec,phase-5-coding}.md`
- `docs/skill-design-document_SSoT.md`（§10L.3 与 §10C）
- `docs/debug/2026-09-25-wave-b-integrity/README.md`（四处）

- [ ] **步骤 1：规格判据句改写（G1-1）**

WS-1 判据句 `(graph ∩ rtm)` 改为与实现一致的宽并集口径：「宽池两两**精确相等**（等价于对宽视角并集的集合相等——分池实现按池内两两比对，差异项逐一报告）」。

- [ ] **步骤 2：「非空(size>0)」族统一（G1-2/25）与「禁双 L」登记（G1-23）**

grep `非空(size>0)` / `size > 0` 于 subagent-delegation / hard-constraints：统一为「非空且为普通文件（`isFile()` 且 `size > 0`；非普通文件同违规）」。conventions.md §2.1 评审规则表述处补「evidence 禁双 L 形态（`path:Lnn-Lmm=`），单 L 或 §sec 形态合法」。

- [ ] **步骤 3：降级范例与 SSoT 交叉引用（G1-3/4）**

phase-5-coding / command-reference 的降级范例 `alternativeEvidence.evidencePath` 由指向记录自身改为真实替代制品形态（如 `docs/plans/phase5-demo.plan.md#任务3`）；SSoT:1751,1758（§10C）两处补「（R5 真值通道 = `operationalFailureModes` 字段，§4A.2a）」。G1-7：grep「向前逐条验证」——若 Task 8 后仍存在，改「自首条带哈希记录向后逐条扫描」；G1-8：data-models canonicalJson 定义处补「（与 `JSON.stringify` 键序无关：显式按 Unicode 码点升序序列化）」。

- [ ] **步骤 4：wave-b 证据 README 四处（G1-22）**

`docs/debug/2026-09-25-wave-b-integrity/README.md`：:310 附近 #3 行的运行时间窗改为 #3 实际窗口（~19:49→20:15 后按文中 #2/#3 实载核对）；§3.0 子标题使突变矩阵表重新归属正确小节（调整标题层级或位置）；:416 `clock-injected` 括注与实盘输出核对订正；§7.2 标签「末30行」改与实际行数一致。verifier-spec.md:328（G1-24）自检引文更新为改后文案。

- [ ] **步骤 5：验证与 Commit**

`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（本轮只求静态零违规）；grep 确认 `非空(size>0)` 清零。Commit：

```bash
git add docs/superpowers/specs w-model-dev/references docs/skill-design-document_SSoT.md docs/debug/2026-09-25-wave-b-integrity
git commit -m "docs(verifier,spec): WS-1 判据口径改写 + 非空表述统一 + 禁双L登记 + 证据README四处订正（G1-1/2/3/4/7/8/22/23/24/25）"
```

---

# G2 · 测试补强面

## 任务 4：门禁测试补强（G2-1/2/3/4/6）

**文件：**
- `w-model-dev/scripts/__tests__/maturity-logic.test.ts`
- `w-model-dev/scripts/__tests__/check-budget*.test.ts`（按现有 budget 测试文件名）
- `w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts`
- `w-model-dev/scripts/__tests__/check-coding-plan.test.ts`
- `w-model-dev/scripts/__tests__/iceberg-logic.test.ts`

- [ ] **步骤 1：maturity 三断言（G2-1）**

在 maturity-logic.test.ts 既有 R5 用例块后追加：

```ts
it('R5 诊断经 --json 输出透传（diagnostics 通道）', () => {
  const r = checkMaturity(mkMaturity(3), { operationalFailureCount: 0, diagnostics: ['R5 未生效：未提供 --run-log'] });
  expect(r.diagnostics).toContain('R5 未生效：未提供 --run-log');
});
it('R5 operationalFailureModes 空数组 → 不计次', () => {
  const rows = [mkEntry({ operationalFailureModes: [] })];
  expect(countOperationalFailures(rows)).toBe(0);
});
it('R5 operationalFailureModes 重复值只计一次（每项至多一次口径）', () => {
  const rows = [mkEntry({ operationalFailureModes: ['O3', 'O3'] })];
  expect(countOperationalFailures(rows)).toBe(1);
});
```

（`checkMaturity` 签名以 logic 现状为准；若 diagnostics 通道名不同按实现适配，断言语义不变。）

- [ ] **步骤 2：countSuspectedDuplicateGroups 直测（G2-2，联动 G3-7 前置现状）**

新增直测块：同 `(timestamp, tokens, duration_s)` 两条 → 1 组；`tokens: 0` 不计组（G3-7 实施后转绿——本任务先写现状红/绿判断，若守卫未实现此用例先按现状断言并在任务 8 翻转）。

- [ ] **步骤 3：codegraph 两子分支用例（G2-3）**

check-codegraph-queries.test.ts 增两条子进程/纯函数用例：`degradationReason: '   '`（全空白）→ violation；`alternativeEvidence: [{ command: '', evidencePath: '' }]`（空字段）→ violation（以 schema `minItems` 与判据 `?.trim()` 现状为准——若 schema 已拒空字段则该例为 exit 2 形态断言）。

- [ ] **步骤 4：artifacts CLI 断言（G2-4）、窄池退化用例（G2-6）与追加器边界用例（G2-5）**

check-coding-plan.test.ts：在合规树上删除 `task-2-report.md` → 期望 exit 1 且 `artifacts` 报缺（若现行为 exit 0，本用例红，修复归任务 6 的 G3-12 邻近实现——在本任务登记依赖）。iceberg-logic.test.ts 增：

```ts
it('宽视角全缺 + tla 在盘 → 窄池跳过比对 + 诊断（无基准无从比对）', () => {
  const sets = { graph: [], rtm: [], tla: ['SD-001'], scope: [] };
  const r = checkIcebergSweep(mkReport(), { viewSets: sets, activeViews: ['graph', 'rtm', 'tla', 'scope'] });
  expect(r.violations.filter((v) => v.includes('R6'))).toEqual([]);
});
```

（该用例在 G3-3 实施前红——先写红，任务 6 步骤 3 翻绿。）

G2-5：run-log-append 测试补边界三态——CRLF 行尾 / BOM 头 / 无换行结尾的历史文件追加各 1 例（期望：解析吸收或明确拒绝，与实现一致，断言目标文件历史行逐字节不变）；`--lock-timeout=abc`、`--lock-timeout=-1`、`--lock-timeout=1e3` 各 1 例（期望 exit 2 `ARG_INVALID`，错误信息点名非法值）。

- [ ] **步骤 5：运行记录 + Commit**

运行四个测试文件，记录红/绿清单进账本（跨任务依赖：G2-4、G2-6 两条红待任务 6 翻转）。Commit：

```bash
git add w-model-dev/scripts/__tests__
git commit -m "test(closeout): maturity/codegraph/coding-plan/iceberg/append 边界补强用例（G2-1/2/3/4/5/6，含两条待任务6翻转的红）"
```

## 任务 5：登记机制多锚 + fixture 文案（G2-7/8/9 + G4-5 前半）

**文件：**
- `w-model-dev/scripts/cli/check-samples-coverage.ts`（锚校验段）
- `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（语法说明 + 受影响行）
- `w-model-dev/scripts/samples/coding-plan/bad-review-empty/**`（fixture 注释）
- `w-model-dev/scripts/__tests__/README.md`（矩阵描述补哈希链行，G2-7）

- [ ] **步骤 1：多锚语法（G2-8，向后兼容）**

NEGATIVE-COVERAGE 行的锚列支持 `文件#锚1；文件#锚2`（全角分号分隔），checker 逐锚机器校验；既有单锚行零行为变化（无 `；` 走原路径）。checker 改动处补 2 条单测（第二锚命中/第二锚失配）。

- [ ] **步骤 2：fixture 文案对齐（G2-9 与 G4-5 前半）**

bad-review-empty 的 11 份非空审查文件加同一行注释 `<!-- 占位内容：本 fixture 唯一失败点 = plan-completeness 为空文件 -->`；G4-5 涉及的其余负向 fixture 决策文本按同式对齐（grep `期望`/`应失败` 逐个核对措辞一致）。__tests__/README.md 矩阵补哈希链用例行（G2-7）。

- [ ] **步骤 3：验证与 Commit**

`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0（含新多锚行真实探针）；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`。Commit：

```bash
git add w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/samples w-model-dev/scripts/__tests__/README.md
git commit -m "feat(samples): NEGATIVE-COVERAGE 多锚机器校验（向后兼容）+ fixture 文案对齐（G2-7/8/9, G4-5）"
```

---

# G3 · 代码小额面

## 任务 6：判别与守卫（G3-1/2/3/4/5）

**文件：**
- `w-model-dev/scripts/cli/check-codegraph-queries.ts`（`codegraphIndexPresent` :138）
- `w-model-dev/scripts/logic/evidence-provenance-logic.ts`（`collectRootFile` :409）
- `w-model-dev/scripts/logic/iceberg-sweep-logic.ts`（窄池段 :300-323）
- `w-model-dev/scripts/cli/check-coding-plan.ts`（锚诊断段与 `--preflight` 段）
- 测试：任务 4 已备的两条红用例 + 各文件既有用例

- [ ] **步骤 1：codegraphIndexPresent stat 判别（G3-1 修半）**

```ts
export function codegraphIndexPresent(projectRoot: string): boolean {
  // 目录（标准形态）与单文件索引均算「在盘」；悬挂符号链接/普通意外条目不算，
  // 并由调用方输出一行非阻断诊断（探测到非目录/文件形态）。
  try {
    const st = fs.statSync(path.join(projectRoot, '.codegraph'));
    return st.isDirectory() || st.isFile();
  } catch {
    return false;
  }
}
```

（「探测基准改 git 顶层」半项**销**——规格 §5 已登记理由：无 git 工作区形态本无 git 顶层，projectRoot 基准与 e2e/降级形态自洽。）

- [ ] **步骤 2：collectRootFile 补 isFile（G3-2）**

`collectRootFile` 在读取前补 `if (!fs.statSync(absPath).isFile()) return [];`（保持 logic 层 fs 注入面：经既有 `evidenceFs` 适配器调用，不新增裸 import）。补一条单测：rootFile 为目录 → 不产出 SourceFile。

- [ ] **步骤 3：窄池空宽池守卫（G3-3，翻任务 4 的红）**

> **实现期订正（任务 4 审查发现，2026-09-27）**：守卫条件不是 `wide.length === 0`——`{graph:[],rtm:[],tla:[...],scope:[]}` 形态下四视角全部「在场」（`ICEBERG_VIEW_PRESENCE[5]` × `Array.isArray` 派生），`wide.length === 2` 字面守卫命中不到；真正的命中条件是**宽视角基线集为空** `wideUnion.size === 0`。另：`IcebergSweepCheckResult` 现为 `{passed, reasons, reportSummary}`，**无** diagnostics/warnings 通道——按 `CheckpointCheckResult.diagnostics` 先例给返回类型加可选 `diagnostics?: string[]`（非破坏），CLI 侧有则打印一行；不进 `reasons`（那是阻断面）。

窄池循环前加：

```ts
const wideUnion = new Set(wide.flatMap((v) => viewSets[v]!)); // 既有变量，位置前移
if (wideUnion.size === 0) {
  // 宽视角基线集为空（视角可在场但集合为空）：无基准集合，窄池既谈不上「超出」也谈不上「漏」——
  // 跳过比对并记非阻断诊断（宽池无基准，窄池对账跳过）；R7 视角缺席仍按既有判据报。
  diagnostics.push('R6[design-sd] 宽视角设计 ID 集为空，窄池对账跳过（无基准）');
} else {
  // …既有窄池双向判据原样…
}
```

（任务 4 步骤 4 的退化用例翻绿，且其断言只锁 `reasons` 中 R6 文案为空——与诊断通道解耦。）

- [ ] **步骤 4：锚诊断时点 + preflight 守卫（G3-4/5）**

check-coding-plan.ts：锚缺失诊断的打印移到 scope 解析成功之后（`resolveCliScope` 成功分支内）；`--preflight` 路径的 `statSync`/`readdirSync` 包 try/catch + `isFile()`/`isDirectory()` 守卫，异常按 `FILE_NOT_FOUND` 结构化报错而非裸栈。

> **实现期订正（任务 4 审查发现，2026-09-27）**：原「任务 4 步骤 4 的 artifacts 断言翻绿（G3-12 完成后）」**作废**——artifacts 断言（C12 门禁计数形态）实测**已经 exit 1 且绿**；原始发现的「仍 exit 0」属 `--preflight` 只列不计数语义（已由 C12b 覆盖）。G3-12 照常执行（单源化），但**不以任何测试翻绿为完成判据**。

- [ ] **步骤 5：验证与 Commit**

任务 4 的全部红用例翻绿；四文件既有用例零回归。Commit：

```bash
git add w-model-dev/scripts/cli/check-codegraph-queries.ts w-model-dev/scripts/logic/evidence-provenance-logic.ts w-model-dev/scripts/logic/iceberg-sweep-logic.ts w-model-dev/scripts/cli/check-coding-plan.ts w-model-dev/scripts/__tests__
git commit -m "fix(closeout): 索引探测stat判别 + collectRootFile isFile + 窄池空基准守卫 + 锚诊断时点/preflight竞态守卫（G3-1/2/3/4/5）"
```

## 任务 7：单源与文案（G3-6/8/9/10/12/16；G3-13 已由任务 1 步骤 1 收口，G3-11 已并入任务 2）

**文件：**
- `w-model-dev/scripts/logic/evidence-provenance-logic.ts`（:419-424 注释与常量）+ `logic/evidence-export-logic.ts`（:122-130）
- `w-model-dev/scripts/logic/coding-plan-logic.ts` + `cli/check-coding-plan.ts`（TASK_ARTIFACT_RE/REVIEW_DIFF_RE/R4 内联正则/账本路径）
- `w-model-dev/scripts/cli/check-archive-integrity.ts`（:27）+ `logic/archive-integrity-logic.ts`（:189）+ 另两处「字节前缀」
- `w-model-dev/scripts/lib/run-sync.ts`（:74,84）+ `docs/troubleshooting.md`（:105）
- `.eslintsecurity-baseline.json`（iceberg-sweep-logic orphan 行）

- [ ] **步骤 1：白名单单源（G3-16）与注释（G3-6）**

evidence-export-logic.ts 导出 `SIGNATURE_CHAIN_FILE = 'signature-chain.jsonl'`（:130 已有），evidence-provenance-logic.ts:424 改 import 复用（同层 logic 互 import 合法）；删除 provenance 侧重复字面量。`resolveProvenanceIdentity` 注释改为与实现一致的实际行为描述（读代码后改写，不臆测）。

- [ ] **步骤 2：编码链正则单源（G3-12）**

coding-plan-logic.ts 导出 `TASK_ARTIFACT_RE` / `REVIEW_DIFF_RE`（若现名不同以现名为准导出），R4 内联正则与 check-coding-plan.ts 处改 import；账本路径 `.superpowers/sdd/<plan>/progress.md` 的第三处 hardcode 改引同一常量 `PROGRESS_REL = (planId: string) => ...`。

- [ ] **步骤 3：「字节前缀」文案四处（G3-9）与超时注释（G3-10）**

grep `字节前缀` 于 `w-model-dev/scripts/`：四处（含 check-archive-integrity.ts:27 与 archive-integrity-logic.ts:189 用户可见文案）改「记录边界前缀」——**判定逻辑一字不动**（Task 8 已收紧为记录边界判据，纯措辞滞后）。run-sync.ts:74,84 与 troubleshooting.md:105 的 `1800s` 改当前实测口径（与 docs-consistency-logic.test 现行断言一致——先看该测试锚再定文本）。

- [ ] **步骤 4：orphan baseline 清理（G3-8）**

`npx tsx w-model-dev/scripts/cli/security-scan.ts` 记录当前输出；从 `.eslintsecurity-baseline.json` 删除 iceberg-sweep-logic 的 5 条 orphan 行（规则指纹不再命中的行）；复跑 security-scan 须 exit 0 且「新增 0」。若误删仍命中的行会报新增——回补该行。

- [ ] **步骤 5：验证与 Commit**

`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts w-model-dev/scripts/__tests__/security-scan.test.ts` + `npm run lint:security`。Commit：

```bash
git add w-model-dev/scripts .eslintsecurity-baseline.json docs/troubleshooting.md
git commit -m "refactor(closeout): 白名单/正则/账本路径单源化 + 字节前缀文案四处 + 超时注释统一 + baseline orphan清理（G3-6/8/9/10/12/16）"
```

## 任务 8：行为增量（G3-7/14/15/18）——本批唯一触碰运行语义的任务

**文件：**
- `w-model-dev/schemas/run-log.schema.json`（可选 `parentDispatchId`）
- `w-model-dev/scripts/cli/check-budget.ts`（:192 `countSuspectedDuplicateGroups` + :288 调用处）
- `w-model-dev/scripts/cli/check-archive-integrity.ts` + `logic/archive-integrity-logic.ts`（绝对路径诊断）
- `w-model-dev/scripts/samples/run-log/valid-parent-dispatch.jsonl`（新增样本）+ NEGATIVE/README 登记
- 测试：budget 直测（任务 4 步骤 2）翻转 + archive-integrity 诊断用例

- [ ] **步骤 1：schema 可选字段（G3-15 前半）**

`run-log.schema.json` 增可选字段（description 必带，checkSchemaFieldDescriptions 强制）：

```json
"parentDispatchId": {
  "description": "可选。多归账分派的主记录 ID：R3 三维度等同一分派多条归账时，附属条目以该字段指向主条目 runId。仅用于 check-budget 疑似重复归账判定的精确化（在场时同 parentDispatchId 的条目不互计重复组）；legacy 记录缺字段维持现判定。Σtokens 上界口径不变——字段不参与任何去重扣减。",
  "type": "string",
  "minLength": 1
}
```

- [ ] **步骤 2：疑似重复归账精确化（G3-15 后半 + G3-7 键守卫）**

`countSuspectedDuplicateGroups`：键守卫——`tokens` 非有限正数或 `duration_s` 缺失的条目不入组（噪声键排除）；同 `parentDispatchId`（在场且非空）的条目互不计组。判定伪码：

```ts
const keyOf = (e: any) =>
  Number.isFinite(e.tokens) && e.tokens > 0 && typeof e.duration_s === 'number'
    ? `${e.parentDispatchId ?? ''}|${e.timestamp}|${e.tokens}|${e.duration_s}`
    : null; // null = 噪声键，不入组
// 分组计数后：>1 的组数即疑似重复组（parentDispatchId 在场条目各自只与「同 parent + 同键」比——
// 同 parentDispatchId 的多条本身是约定内归账，除非键也全同才计组）
```

（实现时以既有函数形态为准，保持导出签名不变；任务 4 的直测翻转：`tokens: 0` 不计组断言转绿。）

- [ ] **步骤 3：R5 读路径守卫（G3-18，任务 4 审查增补）**

> 来源：上批延后项「R5 计数不校验 enum/uniqueItems（schema 声明与读取路径不同门）」在本批首版规格中漏排（任务 4 审查者点名，Important）。归入本任务（行为增量集中地）。**语义边界（不得越界）**：schema 的 `uniqueItems` 与「存在即累加数组长度」口径**不变**（不得改为去重计数——那会推翻 schema description 与任务 4 已绿用例）；本守卫只处理**读取路径的非 enum 值**：`countOperationalFailures` 累加前过滤 `O1..O6` 之外的值（如 `'O9'`、拼写错误），并在过滤命中时经诊断通道输出一条「N 项非 O1~O6 取值已忽略（schema 应拒绝；读取路径防御）」；无命中零输出。

`cli/check-maturity.ts` 的 `countOperationalFailures`：

```ts
const O_PATTERN_VALUES = new Set(['O1', 'O2', 'O3', 'O4', 'O5', 'O6']);
// …累加改为：entries.flatMap(e => e.operationalFailureModes ?? []).filter(v => O_PATTERN_VALUES.has(v)).length
//   同时收集 ignored = 非 enum 值计数（>0 时并入 diagnostics 通道，非阻断）
```

测试（maturity-logic.test.ts 追加，与任务 4 的既有三例同风格）：`['O9']` → 计数 0 + 诊断行含「非 O1~O6」；`['O3','O3']` → 计数 2（不变，锁定 schema 语义不被本守卫改变）。

- [ ] **步骤 4：绝对路径诊断（G3-14）**

archive-integrity-logic.ts 判据段追加（纯诊断，不进 violations）：归档清单文件条目（gate-log 等 `files[]`）中 `path` 含 `\\` 或匹配 `/^([A-Za-z]:|\/)/` 的计数 >0 时，输出诊断「归档清单含 N 条疑似本机绝对路径条目——交付前须经 wm-export-evidence 脱敏导出（归档仅受控留档）」。CLI `--json` 输出透传该诊断键；未提供清单或 0 命中不打。logic 层经注入参数收清单文本（zero-fs 约定，仿 `liveRunLogText` 先例）。

- [ ] **步骤 5：样本与登记**

新增 `samples/run-log/valid-parent-dispatch.jsonl`（主条目 + 2 条带同 `parentDispatchId` 的 R3 归账 → check-budget 疑似组数 0）与 `samples/run-log/bad-duplicate-groups.jsonl`（同键 3 条无 parent → 组数 ≥1 诊断）；登记 samples/README 矩阵与 self-test 用例；`eval/mappings.json` 若锚受影响一并核。

- [ ] **步骤 6：验证与 Commit**

budget 直测全绿（含翻转）、archive-integrity 新诊断用例正反两态、maturity 新守卫两例（`['O9']`→0+诊断 / `['O3','O3']`→2 不变）、schema 校验通过；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget* w-model-dev/scripts/__tests__/archive-integrity* w-model-dev/scripts/__tests__/maturity*`。Commit：

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/scripts w-model-dev/scripts/samples
git commit -m "feat(closeout): parentDispatchId可选字段+重复归账精确化+键守卫 / 归档绝对路径非阻断诊断 / R5读路径enum守卫（G3-7/14/15/18，本批唯一行为增量）"
```

---

# G4 · 登记与夹具面

## 任务 9：登记补齐与正例夹具（G4-1/2/3/4；G4-5 已由任务 5 步骤 2 全量收口）

**文件：**
- `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（:84、:85 两处）
- `w-model-dev/scripts/samples/graph/`（新增 p2/p3/p4 正例 3 份）
- `w-model-dev/scripts/cli/self-test.ts`（GRAPH_CASES）
- `w-model-dev/scripts/samples/README.md`（矩阵）
- `docs/skill-design-document_SSoT.md`（§10L.3 在场表段）

- [ ] **步骤 1：NEGATIVE-COVERAGE 两处补登记（G4-1/2）**

:85 行（Task 2 行替换）补回 `bad-missing-ledger` 的登记行（锚：文件 + 唯一子串）；:84 行（Task 3 行替换）补回 `bad-empty` 登记并新增 `bad-cli-kind-without-index` 行——用任务 5 的多锚语法补第二锚。跑 `check-samples-coverage` 确认探针闭环（登记行必须真实 exit 1 命中）。

- [ ] **步骤 2：阶段 2-4 图谱正例 3 份（G4-4/F-5）**

以 `samples/graph/valid-phase1.json`（或现有正例命名）为范式新增 `valid-phase2.json` / `valid-phase3.json` / `valid-phase4.json`：分别满足 R7-R14 各阶段形态（p2 死模块清零 + EXT-IN/OUT、p3 接口层、p4 详细设计层——节点/边数按 `check-requirement-graph.ts` 各阶段下限构造）；self-test.ts GRAPH_CASES 增 3 例（`[p2]`/`[p3]`/`[p4]` 形态标注）+ samples/README.md 矩阵行（正例无 NEGATIVE 登记义务）。

- [ ] **步骤 3：SSoT 在场表定值（G4-3）**

SSoT §10L.3「取值待端到端调测核定」句改为代码事实：`ICEBERG_VIEW_PRESENCE` 以 `iceberg-sweep-logic.ts` 常量为权威，各阶段在场视角 = graph（1-8）/ rtm（1-8）/ tla（1-4 及 5-8 有 TLA 资产时）/ scope（5-8）——与 live-run 各阶段 `viewSets` 实测一致，删「待核定」。

- [ ] **步骤 4：验证与 Commit**

`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0、`npx tsx w-model-dev/scripts/cli/self-test.ts`（GRAPH_CASES 新 3 例绿）、`npm run self-test`。Commit：

```bash
git add w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts docs/skill-design-document_SSoT.md
git commit -m "test(samples): NEGATIVE登记补齐两处 + 阶段2-4图谱正例3份 + SSoT在场表定值（G4-1/2/3/4/5, F-5）"
```

---

## 任务 10：收口（销账登记、CHANGELOG、全量验收）

**文件：** `CHANGELOG.md`、账本、`.w-model/codegraph-queries/`

- [ ] **步骤 1：CHANGELOG 清收小节**

`[42.3.0]` 节内新增「未解/延后清收（2026-09-27）」：处置统计（62 = 修 51 + 销 8 + 不修 3）、§5 销账 8 项理由全文、显式不修 3 项（F-6/R5 观察期/Phase 5-8）、证据=本计划账本与各任务提交号。

- [ ] **步骤 2：终局全量验收**

```bash
npm run prepush          # 19 项 exit 0
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # exit 0
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts   # exit 0
```

任一红 → 修复后重跑全量（不得只重跑单项）。

- [ ] **步骤 3：账本收尾**

`.superpowers/sdd/2026-09-27-deferred-closeout/progress.md` 逐任务 `Task N: complete`；三件套齐备核对；同时回写 2026-09-25 批次账本：deferred 项逐条标注「已处置（修=任务号 / 销=销N / 不修）」——**账本延后清单清零**。

- [ ] **步骤 4：Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 未解/延后清收登记 + 销账8项理由 + 显式不修3项（62 项全处置）"
```

---

## 验收总表（与规格 §4 对应）

| 规格条 | 验收动作 | 期望 |
| --- | --- | --- |
| G1 全部 | docs-consistency + grep 抽查 | 错位序/旧短语清零，exit 0 |
| G2 全部 | 任务 4/5 新用例全绿 + 探针闭环 | 多锚语法向后兼容，既有 2615 用例零回归 |
| G3 修 | 任务 6/7/8 定向测试 | 守卫/单源/诊断/字段正反态全绿 |
| G3-14/15 | 正负样本 + schema 校验 | 诊断可见不阻断；字段可选、legacy 缺场零变化 |
| 销 8 项 | CHANGELOG §5 全文登记 | 无代码改动、有登记 |
| 显式不修 3 | CHANGELOG 登记 | 无代码改动、有登记 |
| 终局 | `npm run prepush` 19 项 | exit 0 |
