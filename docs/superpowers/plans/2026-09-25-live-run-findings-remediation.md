# 8 阶段 live run 调测发现全量修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
> 规格：`docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md`（本计划是它的逐任务展开；规格与计划冲突时以规格为准，并回来改计划）。
> 账本（gitignored）：`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md`（首行身份 + 逐任务 `Task N: complete`）；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`。
> 回归纪律（约束 #14）：任何 `.ts` 文件 `Edit`/`Write` 前先经 codegraph CLI 查询目标符号影响半径并把记录落 `.w-model/codegraph-queries/`；每任务结束跑定向 vitest，每波结束跑全量 `npm run prepush`。

**目标：** 把 8 阶段真实调测的 10 条发现（D-1..D-10）+ CHANGELOG 未解清单 ③④⑥ + 核验新增 7 条（N-1..N-7）全部修掉，且不放松任何既有门禁语义。

**架构：** 按三波推进——Wave A 修门禁语义与牙齿（iceberg 视角命名空间、coding-plan R3 契约、codegraph 真实性与降级、maturity R5 口径）；Wave B 修完整性与纪律（run-log 追加器 + 哈希链 + 锚 + 归档前缀性、自举顺序纪律成文、预算接线）；Wave C 修披露面与产物形态并销项遗留（归档披露规则、V 模板硬约束、装配器两处 fixture、导出链两项）。所有新增字段一律**可选**（历史 fixture 零改动即绿），所有新语义**并入既有规则编号**（不新增 R 编号）。

**技术栈：** TypeScript（`tsx` runtime）、Node 标准库、ajv（schema 校验）、vitest（单测/子进程测试）、Python（`eval/e2e/demo-assets/build_workspace.py` 装配器）、真实 SANY/TLC（TLA+ 门禁）。

---

## 文件结构（先锁定分解，再排任务）

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `w-model-dev/scripts/logic/iceberg-sweep-logic.ts` | 修改 | 视角命名空间声明 + R6 分池比对 + R8 收敛集限定设计 ID 视角 |
| `w-model-dev/scripts/logic/coding-plan-logic.ts` | 修改 | R5 内容下限（非空为阻断；行级证据锚为非阻断诊断）+ 新增 `preflightCodingPlan` 纯函数 |
| `w-model-dev/scripts/cli/check-coding-plan.ts` | 修改 | 新增只读 `--preflight` 参数与 `CODING_PLAN_PREFLIGHT_JSON` 输出 |
| `w-model-dev/scripts/cli/check-codegraph-queries.ts` | 修改 | 索引探测 + `evidenceKind` 三态判据（cli 强制 / artifact 须带降级证据 / 未声明即违规） |
| `w-model-dev/scripts/cli/check-maturity.ts` | 修改 | R5 真值通道改读 `operationalFailureModes`；词法与未接线改为非阻断诊断 |
| `w-model-dev/scripts/logic/maturity-logic.ts` | 修改 | R5 计数入参语义扩展 + diagnostics/warnings 通道 |
| `w-model-dev/scripts/logic/run-log-append-logic.ts` | 创建 | 纯函数：单调时间戳裁决、链计算、更正记录构造（零 `node:fs`） |
| `w-model-dev/scripts/lib/run-log-append-fs.ts` | 创建 | 真实适配器：读/写 run-log、调用 state-write 原子写（lib 层 fs 合法） |
| `w-model-dev/scripts/cli/wm-append-runlog.ts` | 创建 | O 侧唯一 run-log 追加入口（exit 0/1/2，stdout `RUNLOG_APPEND_JSON`） |
| `w-model-dev/scripts/logic/run-log-logic.ts` | 修改 | R7 扩展：①时间戳单调 ②哈希链连续 ③checkpoint 锚自洽 |
| `w-model-dev/scripts/logic/archive-integrity-logic.ts` | 修改 | 新增 `liveRunLogPrefixOk` 判据（归档快照须为 live 字节前缀） |
| `w-model-dev/scripts/cli/check-archive-integrity.ts` | 修改 | 新增可选 `--live-run-log=<path>` 与诊断输出 |
| `w-model-dev/scripts/cli/check-budget.ts` | 修改 | 未接线诊断 + 疑似重复归账诊断（不改 exit 语义） |
| `w-model-dev/scripts/logic/verifier-logic.ts` | 修改 | 等差文案加改进指引；O3 文案区分「格式不符」与「空泛声明」 |
| `w-model-dev/scripts/logic/evidence-provenance-logic.ts` | 修改 | `provenanceKind` 分支 + 根级 `signature-chain.jsonl` 采集 |
| `w-model-dev/scripts/logic/evidence-export-logic.ts` | 修改 | 白名单增根级 `signature-chain.jsonl`（与复数目录并存即 fail-closed） |
| `w-model-dev/schemas/run-log.schema.json` | 修改 | +可选 `recordHash`/`prevRecordHash`/`runLogAnchor`/`operationalFailureModes` |
| `w-model-dev/schemas/codegraph-query.schema.json` | 修改 | +可选 `evidenceKind`/`degradationReason`/`alternativeEvidence` |
| `w-model-dev/schemas/evidence-provenance.schema.json` | 修改 | +可选 `provenanceKind`/`workspaceDigest`，`commitSha` 改条件必填 |
| `w-model-dev/schemas/evidence-manifest.schema.json` | 修改 | provenance 块跟随 `provenanceKind` |
| `w-model-dev/SKILL.md` | 修改 | 增「闭环五门 → 放行记录」显式顺序步骤 |
| `w-model-dev/references/*.md` | 修改 | operational-recovery（自然时序/调用表/禁令）、hard-constraints（约束 #11 两句）、data-models（字段表/口径）、command-reference（例外登记）、toolbox、iceberg-sweep-guide、phase-5-coding、phase-8-acceptance-test、subagent-delegation、agent-personas、verifier-spec |
| `w-model-dev/templates/coding-plan.md` | 修改 | R3/V 12 份清单与分工 |
| `w-model-dev/scripts/samples/**` | 修改/新增 | 各门正负样本（iceberg / coding-plan / codegraph-queries / run-log / verifier / archive-integrity） |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | 各 CASES 新增用例与计数 |
| `eval/e2e/demo-assets/build_workspace.py` | 修改 | 归档根补 plan/progress/三件套；`src/counter.ts` 补断言；注释订正 |
| `docs/skill-design-document_SSoT.md` | 修改 | §10L.3、§4A.2a、§10D/§10E、§10.6、导出边界节 |
| `AGENTS.md` / `README.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `docs/INSTALL.md` | 修改 | 计数、登记、销项、订正 |

---

## 任务 0：开工准备

**文件：**
- 创建：`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md`、`.w-model/codegraph-queries/`（如不存在）

- [ ] **步骤 1：建分支**（当前在 main，禁止直接改 main）

```bash
git checkout -b feat/live-run-findings-remediation
```

- [ ] **步骤 2：初始化账本**

`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md` 首行写身份：`plan=2026-09-25-live-run-findings-remediation phase=repo-maintenance`，随后逐任务追加 `Task N: complete`（任务全部完成前的状态写 `Task N: in-progress`）。

- [ ] **步骤 3：基线取证**（记录开工前的计数与绿态）

运行：`npm run self-test 2>&1 | tail -5` → 记录用例总数；`npx tsx w-model-dev/scripts/cli/self-test.ts` 计数、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` 退出码，写入账本。

- [ ] **步骤 4：Commit**

```bash
git add docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md
git commit -m "docs(plan): live run 调测发现全量修复规格与计划（三波 11 WS）"
```

---

# Wave A · 门禁语义与牙齿

## 任务 1：iceberg 三视角命名空间分池（D-1 + N-1）

**文件：**
- 修改：`w-model-dev/scripts/logic/iceberg-sweep-logic.ts`（`:63-66` 视角表、`:116` 设计 ID 正则、`:138-189` deriveViewSets、`:261-267` R6、`:300-310` R8）
- 测试：`w-model-dev/scripts/__tests__/iceberg-logic.test.ts`
- 样本：`w-model-dev/scripts/samples/iceberg/`（新增 2 个负例目录 + 1 个阶段 ≥2 正例）
- 修改：`w-model-dev/scripts/cli/self-test.ts`（ICEBERG_CASES，约 `:1729-1756`）
- 文档：`w-model-dev/references/iceberg-sweep-guide.md:197-206`、`docs/skill-design-document_SSoT.md:2267-2271`、`AGENTS.md:20,170`

- [ ] **步骤 1：写失败的测试**（在 `iceberg-logic.test.ts` 末尾追加；沿用该文件既有的 `mk()` fixture 构造风格）

```ts
// 本任务在 iceberg-logic.test.ts 本地新增 helper（沿用该文件既有的最小合规报告构造风格）：
const mkReport = (): IcebergSweepReport => ({ phase: 5, newFindings: [], converged: true } as IcebergSweepReport);

describe('R6 命名空间分池', () => {
  it('graph 与 rtm 在设计 ID 全宽上精确相等（含 DD/INTF）→ 通过', () => {
    const sets = { graph: ['SD-001', 'INTF-002', 'DD-003'], rtm: ['SD-001', 'INTF-002', 'DD-003'], tla: ['SD-001'] };
    expect(checkIcebergSweep(mkReport(), { viewSets: sets }).violations.filter((v) => v.includes('R6'))).toEqual([]);
  });
  it('graph 与 rtm 的 DD 漂移仍被检出 → 违规', () => {
    const sets = { graph: ['SD-001', 'DD-003'], rtm: ['SD-001'], tla: ['SD-001'] };
    const v = checkIcebergSweep(mkReport(), { viewSets: sets }).violations;
    expect(v.some((x) => x.includes('R6') && x.includes('graph↔rtm') && x.includes('DD-003'))).toBe(true);
  });
  it('tla 落在 SD 子集内 → 通过（宽视角含 INTF/DD 不构成差异）', () => {
    const sets = { graph: ['SD-001', 'INTF-002'], rtm: ['SD-001', 'INTF-002'], tla: ['SD-001'] };
    expect(checkIcebergSweep(mkReport(), { viewSets: sets }).violations.filter((v) => v.includes('R6'))).toEqual([]);
  });
  it('tla 含 graph 之外的 SD → 违规（子集方向仍有牙）', () => {
    const sets = { graph: ['SD-001'], rtm: ['SD-001'], tla: ['SD-001', 'SD-009'] };
    const v = checkIcebergSweep(mkReport(), { viewSets: sets }).violations;
    expect(v.some((x) => x.includes('R6') && x.includes('SD-009'))).toBe(true);
  });
  it('scope（文件路径命名空间）不参与 R6 与 R8 收敛集', () => {
    const sets = { graph: ['SD-001'], rtm: ['SD-001'], tla: ['SD-001'], scope: ['src/counter.ts'] };
    const r = checkIcebergSweep(mkReport(), { viewSets: sets, activeViews: ['graph', 'rtm', 'tla', 'scope'] });
    expect(r.violations.filter((v) => v.includes('R6') || v.includes('R8'))).toEqual([]);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts -t "命名空间分池"`
预期：FAIL——「tla 落在 SD 子集内」与「scope 不参与 R6」两条红（现判据对全体视角做两两精确比对）。

- [ ] **步骤 3：实现分池**

在 `iceberg-sweep-logic.ts` 增加视角命名空间常量与分池判据：

```ts
// 视角命名空间：design-wide 走精确相等；design-sd 与宽视角的 SD 切片双向相等（见控制者裁定 R-1）；
// path 命名空间（scope 的文件路径）不参与 R6/R8 收敛集的集合比对。
const VIEW_NAMESPACE: Record<string, 'design-wide' | 'design-sd' | 'path'> = {
  graph: 'design-wide', rtm: 'design-wide', tla: 'design-sd', scope: 'path',
};
```

R6 段（`:261-267` 起）改为：

```ts
const designViews = activeViews.filter((v) => VIEW_NAMESPACE[v] !== 'path');
const wide = designViews.filter((v) => VIEW_NAMESPACE[v] === 'design-wide');
for (let i = 0; i < wide.length; i++) {
  for (let j = i + 1; j < wide.length; j++) {
    const [vi, vj] = [wide[i]!, wide[j]!];
    const diff = symmetricDiff(viewSets[vi]!, viewSets[vj]!);
    if (diff.length > 0) reasons.push(`R6[design-wide] ${vi}↔${vj} 差异项：${diff.join(', ')}`);
  }
}
// 控制者裁定 R-1：窄池与宽视角的 SD 切片双向相等（超出/漏项都报）——
// 反向由 check-tla-model 的 uncoveredSdNodes 在阶段 1-4 承担，阶段 5-8 该门不复检，故 R6 一并守护。
const wideUnion = new Set(wide.flatMap((v) => viewSets[v]!));
const isSd = (id: string) => /^SD-/.test(id);
const wideSdUnion = new Set([...wideUnion].filter(isSd));
for (const v of designViews.filter((x) => VIEW_NAMESPACE[x] === 'design-sd')) {
  const narrowSet = new Set(viewSets[v]!);
  const extra = [...narrowSet].filter((id) => !wideUnion.has(id));
  if (extra.length > 0) reasons.push(`R6[design-sd] ${v} 超出宽视角设计 ID 集：${extra.join(', ')}`);
  const missing = [...wideSdUnion].filter((id) => !narrowSet.has(id));
  if (missing.length > 0) reasons.push(`R6[design-sd] 宽视角 SD 项未进入 ${v}：${missing.join(', ')}`);
}
```

R8 收敛集（`:302`）改用 `designViews.flatMap(...)`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts`
预期：PASS；`iceberg-logic.test.ts:297-307` 的宽抽取断言若红，改期望为**分池后的实际输出**（graph 仍抽 SD/DD/INTF 全量——宽视角保留，故该断言预计不变；若变则按新判据更新并在任务报告说明）。

- [ ] **步骤 5：补样本与 self-test 用例**

在 `w-model-dev/scripts/samples/iceberg/` 新增 `bad-r6-wide-dd-drift/`（graph↔rtm 的 DD 漂移 → exit 1）与 `valid-phase5-scope-present/`（scope 在盘且与 ID 不一致 → exit 0），登记 `self-test.ts` ICEBERG_CASES、`samples/README.md:29` 矩阵、`samples/NEGATIVE-COVERAGE.md:81` 四列语法行（证据锚 `文件#唯一子串锚`）。

- [ ] **步骤 6：文档同步（SSoT 优先）**

`docs/skill-design-document_SSoT.md:2267-2271`：改正自相矛盾句（现同时写「最窄公共命名空间 SD/DD/INTF」与「tla 取 `sdCoverage.coveredSdNodes`」），改为「**分池口径**：graph↔rtm 精确相等；tla ⊆ 宽视角集；scope 不参与集合比对」；`iceberg-sweep-guide.md` §8.1 表 / §8.3 / §8.4 同步；`AGENTS.md:20,170` 一句话同步。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/iceberg-sweep-logic.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples docs/skill-design-document_SSoT.md w-model-dev/references/iceberg-sweep-guide.md AGENTS.md
git commit -m "fix(iceberg): R6 三视角改命名空间分池，修结构性不可过（D-1/N-1）"
```

## 任务 2：coding-plan R5 内容下限 + preflight + 契约成文（D-2 + N-2）

**文件：**
- 修改：`w-model-dev/scripts/logic/coding-plan-logic.ts`（`:297-325` validateStageReviews；新增 `preflightCodingPlan`）
- 修改：`w-model-dev/scripts/cli/check-coding-plan.ts`（参数 allowlist + `--preflight` 分支）
- 测试：`w-model-dev/scripts/__tests__/coding-plan-logic.test.ts:421-445`、`check-coding-plan.test.ts`
- 样本：`w-model-dev/scripts/samples/coding-plan/*`
- 文档：`w-model-dev/templates/coding-plan.md:54`、`references/subagent-delegation.md:316,1069`、`references/phase-5-coding.md:105`、`references/hard-constraints.md:57,794`、`SSoT:1947`

- [ ] **步骤 1：写失败的测试**

```ts
// 复用该文件既有 helper：writeValidTree（:86-110，写 ~19 个文件的合规树）。
// 新增可选项 blankR3 = 指定某份 R3 文件写空。
const { checkCodingPlan, preflightCodingPlan } = await import('../logic/coding-plan-logic.js');
const mkFs = () => nodeCodingPlanFs; // 适配器来自 lib/coding-plan-fs.ts（真盘；树由 writeValidTree 落临时目录）

it('R5：R3 审查文件为空 → 违规（内容下限，阻断）', () => {
  const tree = writeValidTree({ blankR3: 'phase5-plan-completeness' });
  const r = checkCodingPlan(tree, 5, 'phase5-demo', mkFs());
  expect(r.violations.some((v) => v.includes('phase5-plan-completeness.md') && v.includes('空'))).toBe(true);
});
it('R5：无行级证据锚但非空 → 不违规（诊断项，见 CLI 侧）', () => {
  const tree = writeValidTree({ r3NoAnchor: 'phase5-plan-security' });
  const r = checkCodingPlan(tree, 5, 'phase5-demo', mkFs());
  expect(r.violations.some((v) => v.includes('phase5-plan-security.md'))).toBe(false);
});
it('preflight 列出固定必需产物与缺失项', () => {
  const r = preflightCodingPlan(writeValidTree({ omit: 'phase5-finalize-reliability' }), 5, 'phase5-demo', mkFs());
  expect(r.required).toHaveLength(14); // 固定项 = 12 份审查（9 R3 + 3 V）+ plan + 账本；三件套为变长项，单列 artifacts
  expect(r.missing).toContain('.w-model/r3-reviews/phase5-finalize-reliability.md');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts -t "内容下限"`
预期：FAIL——`preflightCodingPlan is not a function`；空文件用例失败（现判据仅 `existsSync`）；「无锚但非空」用例当前也红（现判据无此维度，会通过吗？不会——它断言的是**不该有**该违规，现行代码同样不报，故该例在实现前即绿，属回归锁定用例）。

- [ ] **步骤 3：实现内容下限与 preflight**

`validateStageReviews` 内，对 `r3File`/`vFile` 的存在性分支后追加（**只有非空是阻断判据**）：

```ts
const size = fs.statSync(file).size;
if (size === 0) violations.push(`${rel} 为空文件（R5：stage 审查产物须含实质内容）`);
```

行级证据锚改为**非阻断诊断**（不进 `result`，不改 `GATE_JSON`）：`validateStageReviews` 收集缺失锚的相对路径，经 CLI 侧 `cli/check-coding-plan.ts` 在 stderr 打印一行提示，例如
`○ R5 诊断：3 份审查产物未含行级证据锚（建议 path:Lnn=… 或 path:§sec=…）：<rel 列表>`。
锚判据正则：`/(?:^|\n)\s*[\w/.-]+:(?:§[\w.-]+|L\d+(?:-\d+)?)=/`。**理由（控制者裁定 O-4）**：实测 demo 15 份既有 review 产物锚命中为 0，阻断化会打红历史项目与既有证据——规格 §3 WS-2 已据此改写，§6 登记为后续可升级项。

新增导出纯函数（同文件，复用既有 `resolvePlanLocation` 等）：

```ts
export interface PreflightResult { required: string[]; missing: string[]; invalid: string[]; artifacts: string[] }
export function preflightCodingPlan(projectRoot: string, phase: number, changeId: string, fs: CodingPlanFs): PreflightResult;
```

`required` = **固定 14 项**（9 份 `r3-reviews/phase<N>-<stage>-<dim>.md` + 3 份 `v-reviews/phase<N>-<stage>.md` + `docs/plans/<changeId>.plan.md` + `.superpowers/sdd/<changeId>.plan/progress.md`）；`artifacts` = 变长的任务三件套（`task-N-{brief,report}.md` + `review-*.diff`），只列出不计数——这是控制者裁定（原计划写 `toHaveLength(16)` 把变长项塞进计数，语义不成立）。

`cli/check-coding-plan.ts`：`--preflight` 进 allowlist；命中则只打印 `CODING_PLAN_PREFLIGHT_JSON {required, missing, invalid, artifacts}` 并以 `missing.length + invalid.length === 0 ? 0 : 1` 退出（**不改**既有非 preflight 路径的任何判据与文案）；非 preflight 路径在扫描到缺失锚时向 stderr 打一行非阻断诊断。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts w-model-dev/scripts/__tests__/check-coding-plan.test.ts`
预期：PASS（含既有 35 例零回归）。

- [ ] **步骤 5：样本与文案**

三个既有样本目录的 12 份 MD 补真实内容（**非空即可**；带锚更好，但不登记为判据）；新增负样本 `bad-review-empty`（空文件 → exit 1）并登记 `NEGATIVE-COVERAGE.md` 的 check-coding-plan 行（锚 `文件#唯一子串锚`）。**不要**新增 `bad-review-no-anchor`（锚为非阻断诊断，不构成负例）。

- [ ] **步骤 6：文档同步（SSoT 优先）**

`SSoT:1947` → `hard-constraints.md:57,794` → `templates/coding-plan.md:54` → `phase-5-coding.md:105` → `subagent-delegation.md:316,1069`：把「**每阶段 12 份 MD（9 `r3-reviews/phase<N>-<stage>-<dim>.md` + 3 `v-reviews/phase<N>-<stage>.md`，**非空**为阻断下限，行级证据锚为建议项/诊断）+ 3 份 `preventive-reviews/<N>-<dim>.json`（phase 级，schema 校验）** 的分工」写成清单化约定，并注明两门互不替代。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts docs/skill-design-document_SSoT.md w-model-dev/references w-model-dev/templates/coding-plan.md
git commit -m "feat(coding-plan): R5 内容下限 + --preflight 自检 + R3×9/V×3 契约成文（D-2/N-2）"
```

## 任务 3：codegraph 显式降级与运行纪律（D-6）

**文件：**
- 修改：`w-model-dev/schemas/codegraph-query.schema.json`
- 修改：`w-model-dev/scripts/cli/check-codegraph-queries.ts`（`:215-365` 判据段）
- 测试：`w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts`、`self-test.ts:1850-1879`
- 样本：`w-model-dev/scripts/samples/codegraph-queries/*`
- 文档：`w-model-dev/references/phase-5-coding.md:67-83`、`references/hard-constraints.md:79`、`SSoT:2206`

- [ ] **步骤 1：写失败的测试**

```ts
// 本任务在 check-codegraph-queries.test.ts 本地新增子进程 helper（沿用该文件已有的 execFileSync 风格）：
// runChecker = ({ projectDir, phase, scope }) => { const p = execFileSync('npx', ['tsx', CLI, projectDir, `--phase=${phase}`, `--scope=${scope}`], { encoding: 'utf8' }); return { stdout: p, stderr: '' }; }
// runCheckerExpectFail 捕获非零退出码后返回 { exitCode, stdout, stderr }——三态断言必须能看到 exitCode。
it('无 .codegraph/ 索引且未声明降级 → 违规', () => {
  const r = runCheckerExpectFail({ projectDir: fixtureNoIndex, phase: 5, scope: 'change-scope.p5.json' });
  expect(r.exitCode).toBe(1);
  expect(r.stdout + r.stderr).toMatch(/降级|degraded|evidenceKind/);
});
it('无索引 + artifact 声明 + 替代证据 → 通过', () => {
  const r = runChecker({ projectDir: fixtureNoIndexWithDegradedRecord, phase: 5, scope: 'change-scope.p5.json' });
  expect(r.stdout).toMatch(/"passed":true/);
});
it('存在 .codegraph/ 索引却声明 artifact → 违规', () => {
  const r = runCheckerExpectFail({ projectDir: fixtureWithIndex, phase: 5, scope: 'change-scope.p5.json' });
  expect(r.exitCode).toBe(1);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts -t "降级"`
预期：FAIL——三个用例全红（现判据不读这两个维度）。

- [ ] **步骤 3：schema 与判据**

`codegraph-query.schema.json` 增可选字段（**每字段必带 description**，`checkSchemaFieldDescriptions` 强制）：`evidenceKind: enum ['cli','artifact']`、`degradationReason: string`、`alternativeEvidence: array<{command, evidencePath}>`（minItems 1）。

`check-codegraph-queries.ts` 判据段追加：

```ts
const indexPresent = fs.existsSync(path.join(projectDir, '.codegraph'));
// 逐记录：
if (indexPresent && rec.evidenceKind !== 'cli')
  violations.push(`R?：项目存在 .codegraph/ 索引，查询记录 ${file} 未声明 evidenceKind: 'cli'（禁止降级）`);
if (!indexPresent) {
  if (rec.evidenceKind !== 'artifact' || !rec.degradationReason?.trim() || !(rec.alternativeEvidence?.length >= 1))
    violations.push(`R?：无 .codegraph/ 索引时须显式降级（evidenceKind:'artifact' + degradationReason + ≥1 条 alternativeEvidence）`);
}
```

（违规前缀沿用该门现用文案风格，不新增规则编号。）

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts`
预期：PASS（既有 C1/C8/C9/C10b 等用例需按新必填声明补字段——属**预期变更**，逐条在任务报告登记）。

- [ ] **步骤 5：样本、self-test、文档**

样本三件补 `evidenceKind`；新增 `bad-degraded-without-evidence`、`bad-cli-kind-without-index` 并登记 `NEGATIVE-COVERAGE.md:84`、`samples/README.md:42`；`eval/mappings.json` #22 锚点复核。文档：`phase-5-coding.md` 增「无索引降级路径 + `codegraph sync`（索引陈旧同步）」小节；`hard-constraints.md:79` 措辞区分「合法降级声明」与「伪造查询记录」；`SSoT:2206` 同步。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/schemas/codegraph-query.schema.json w-model-dev/scripts w-model-dev/references eval/mappings.json
git commit -m "feat(codegraph): 查询记录显式降级契约与索引探测，堵制品口径隐形通过（D-6）"
```

## 任务 4：maturity R5 真值通道与诊断（D-7）

**文件：**
- 修改：`w-model-dev/schemas/run-log.schema.json`（可选 `operationalFailureModes`）
- 修改：`w-model-dev/scripts/cli/check-maturity.ts:82-99`、`w-model-dev/scripts/logic/maturity-logic.ts:142-152`
- 测试：`w-model-dev/scripts/__tests__/maturity-logic.test.ts`
- 样本：`w-model-dev/scripts/samples/run-log/`（新增 2 份）
- 文档：`w-model-dev/references/data-models.md:520`、`SSoT:669,674`、`references/conventions.md`

- [ ] **步骤 1：写失败的测试**

```ts
// 本任务在 maturity-logic.test.ts 本地新增 helper，并把 countOperationalFailures 从 check-maturity.ts 导出：
// const mkEntry = (patch: Record<string, unknown>) => ({ phase: 1, action: 'gate', role: 'G', outcome: 'success', timestamp: '2026-09-25T10:00:00.000Z', ...patch });
// const mkMaturity = (streak: number) => ({ level: 'L2', downgradeTriggers: { operationalFailureStreak: streak } });
it('R5 只统计 operationalFailureModes 字段，词法命中不改判', () => {
  const rows = [mkEntry({ note: '拦截 #9：R5 O_PATTERN 与 VerifierOutput O3 命名冲突' })];
  expect(checkMaturity(mkMaturity(3), { operationalFailureCount: countOperationalFailures(rows) }).passed).toBe(true);
});
it('operationalFailureModes 标注 3 次 → R5 违规', () => {
  const rows = [1, 2, 3].map(() => mkEntry({ operationalFailureModes: ['O3'] }));
  const r = checkMaturity(mkMaturity(3), { operationalFailureCount: countOperationalFailures(rows) });
  expect(r.passed).toBe(false);
  expect(r.violations.join()).toMatch(/R5: O 系列失败模式命中 3 次/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/maturity-logic.test.ts -t "operationalFailureModes"`
预期：FAIL——`countOperationalFailures` 不存在。

- [ ] **步骤 3：实现真值通道 + 诊断**

`check-maturity.ts`：把 `O_PATTERN` 计数改为

```ts
function countOperationalFailures(entries: unknown[]): number { /* 累加 e.operationalFailureModes?.length ?? 0 */ }
function collectLexicalMentions(entries: unknown[]): string[] { /* 现 O_PATTERN 逻辑，返回命中的 runId 列表 */ }
```

`--run-log` 未提供时输出诊断 `R5 未生效：未提供 --run-log（O 系列失败模式未校验）`；词法命中非空时输出诊断 `疑似引用 N 处（含规则编号引用）；若确为运维失败请在记录中以 operationalFailureModes 标注：<runId 列表>`。两者**均为非阻断**，退出码语义不变。

`maturity-logic.ts`：`options.diagnostics?: string[]` 通道（与既有 warnings 并存，逐字进 stdout 摘要）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/maturity-logic.test.ts`
预期：PASS。

- [ ] **步骤 5：样本与文档**

新增 `samples/run-log/valid-o3-mention-only.jsonl`（仅引用 → exit 0 + 诊断）与 `bad-operational-modes-3x.jsonl`（字段 3 次 → exit 1），登记 `samples/README.md` 与 `NEGATIVE-COVERAGE.md`。文档：`data-models.md:520` 写明「O 系列失败模式的机器可读标注为 `operationalFailureModes`；note 中的 O1..O6 字样视为引用，不计入」；`SSoT:669,674`（§4A.2a）与 `conventions.md` 同步。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/scripts w-model-dev/references docs/skill-design-document_SSoT.md
git commit -m "fix(maturity): R5 改真值通道 + 词法降级为诊断 + 未接线可见化（D-7）"
```

## 任务 5：Wave A 验收

- [ ] **步骤 1：目标门禁回归（只读，对 demo 既有证据）**

```bash
cd eval/e2e/demo
npx tsx ../../../w-model-dev/scripts/cli/check-maturity.ts .w-model/maturity.json --project=.w-model/project.json --run-log=.w-model/run-log.jsonl --json
# 预期 exit 0 + 词法引用诊断（O 系列命中不再计为运维失败）
for p in 2 3 4 5 6 7 8; do
  rep=$(ls .w-model/iceberg-reports/ | grep -E "^phase${p}-" | head -1)
  npx tsx ../../../w-model-dev/scripts/cli/check-iceberg-sweep.ts ".w-model/iceberg-reports/${rep}" --auto-trigger --run-log=.w-model/run-log.jsonl --json | tail -3
done
# 预期：R6 不再有差异项（若某报告声明的 viewSets/差异与新口径冲突而仍红，改用 samples 正例并在证据中说明原因）
```

- [ ] **步骤 2：定向 + 全量**

运行：`npm run test:affected` → 然后 `npm run prepush`（19 项）预期 exit 0。

- [ ] **步骤 3：证据落盘**

新建 `docs/debug/2026-09-25-wave-a-gate-semantics/README.md`：逐门命令、退出码、原始输出尾部、与规格 WS-1..WS-4 的对应表。

- [ ] **步骤 4：CHANGELOG 登记**

`CHANGELOG.md` 新增小节「Wave A（2026-09-25）：iceberg R6 分池 / coding-plan R5 内容下限 + preflight / codegraph 显式降级 / maturity R5 真值通道」，逐条给规格锚与证据路径。

- [ ] **步骤 5：Commit**

```bash
git add docs/debug/2026-09-25-wave-a-gate-semantics CHANGELOG.md
git commit -m "test(acceptance): Wave A 门禁语义验收证据 + 登记"
```

---

# Wave B · 完整性与纪律

## 任务 6：run-log 追加器（D-5① + N-5）

**文件：**
- 创建：`w-model-dev/scripts/logic/run-log-append-logic.ts`（纯函数）、`w-model-dev/scripts/lib/run-log-append-fs.ts`（适配器）、`w-model-dev/scripts/cli/wm-append-runlog.ts`
- 测试：`w-model-dev/scripts/__tests__/run-log-append-logic.test.ts`、`w-model-dev/scripts/__tests__/wm-append-runlog-cli.test.ts`（子进程，登记 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES` 与 `__tests__/README.md` 矩阵）
- 登记连锁：`AGENTS.md` §1/§8、`references/conventions.md:119`、`references/subagent-delegation.md:375`+§6、`samples/NEGATIVE-COVERAGE.md`、`samples/README.md`

- [ ] **步骤 1：写失败的测试**

```ts
it('追加记录写入严格递增时间戳，拒绝倒退', () => {
  const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
  const r = planAppend(existing, [mkEntry({ runId: 'b', timestamp: '2026-09-25T09:59:00.000Z' })], { now: '2026-09-25T09:59:30.000Z' });
  expect(r.accepted).toBe(false);
  expect(r.violations.join()).toMatch(/时间戳不递增/);
});
it('未显式注入时使用 now 且严格递增', () => {
  const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
  const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T10:00:00.000Z' });
  expect(r.accepted).toBe(true);
  expect(Date.parse(r.entries[1]!.timestamp)).toBeGreaterThan(Date.parse(existing[0]!.timestamp));
});
it('--correct 生成更正记录且不触碰历史行', () => {
  const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', note: '错值 4' })];
  const r = planCorrection(existing, 'a', { note: '更正为 5' }, { now: '2026-09-25T10:01:00.000Z' });
  expect(r.entries).toHaveLength(2);
  expect(r.entries[0]).toEqual(existing[0]);
  expect(r.entries[1]!.note).toMatch(/correction-of:a/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-append-logic.test.ts`
预期：FAIL——模块不存在。

- [ ] **步骤 3：实现**

`run-log-append-logic.ts`（纯，零 `node:fs`）：导出 `planAppend(existing, incoming, { now, timestamp?, allowClockAdjust? })` 与 `planCorrection(existing, runId, patch, opts)`；规则：schema 字段的必填由 CLI 侧逐行校验；时间戳严格递增（同毫秒即调整到末条 +1ms，**并在返回的 `diagnostics` 明示「时钟调整 +Nms」**，不再静默）；`--timestamp=<iso>` 与 `--allow-clock-adjust=<reason>` 均在记录 `note` 追加 `clock-injected:` / `clock-adjust:<reason>`。

`lib/run-log-append-fs.ts`：读现有 JSONL → 调 `planAppend` → 经 `logic/state-write-logic.ts` 的锁 + 备份 + tmp/rename + 回读写回（复用 `wm-write` 同款机制，不另造）。

`cli/wm-append-runlog.ts`：`<run-log.jsonl> [--from=<json|jsonl>|--stdin] [--correct=<runId>] [--timestamp=<iso>] [--allow-clock-adjust=<reason>] [--lock-timeout=] [--json]`；错误结构遵 `lib/cli-error.ts`（exit 2 = 输入错误，exit 1 = 写入拒绝）；成功 stdout 单行 `RUNLOG_APPEND_JSON {lines, appended, digest}`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-append-logic.test.ts w-model-dev/scripts/__tests__/wm-append-runlog-cli.test.ts`
预期：PASS。

- [ ] **步骤 5：登记连锁（机械但必须全中）**

新 CLI 使 exit-2 脚本族 45 → 46：`conventions.md:119`、`AGENTS.md` §1 脚本计数与 §8 表新行、`subagent-delegation.md:375` 与 §6 dispatch-matrix、`check-docs-consistency` 的 exit2 计数与「AGENTS §8 cli 基名登记」核对点、`samples/NEGATIVE-COVERAGE.md` 新增一行（负向探针：重复 flag → exit 2 `ARG_INVALID`）、`samples/README.md` 矩阵、`self-test.ts` 新增用例。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts docs AGENTS.md
git commit -m "feat(run-log): 新增 O 侧 append 器（严格单调 + 原子写 + 更正记录），exit-2 族 45→46（D-5①/N-5）"
```

## 任务 7：记录哈希链与 R7 扩展（D-3a）

**文件：**
- 修改：`w-model-dev/schemas/run-log.schema.json`（可选 `recordHash`/`prevRecordHash`）
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts:1100-1111`（R7 扩展）
- 修改：`w-model-dev/scripts/logic/run-log-append-logic.ts`（写入链）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`

- [ ] **步骤 1：写失败的测试**

```ts
// 本任务在 run-log-logic.test.ts 本地新增 helper（哈希实现由 run-log-logic.ts 导出，测试与 writer 共用同一实现，禁两处各写一份）：
// const withChain = (rows: Array<Record<string, unknown>>) => { let prev = ''; return rows.map((r) => { const h = computeRecordHash(r, prev); const out = { ...r, prevRecordHash: prev, recordHash: h }; prev = h; return out; }); };
it('R7：链断（改中段记录）→ 违规', () => {
  const rows = withChain([mkEntry({ runId: 'a' }), mkEntry({ runId: 'b' }), mkEntry({ runId: 'c' })]);
  rows[1]!.note = '被就地改写';
  const r = checkRunLog(rows);
  expect(r.violations.some((v) => v.includes('R7') && v.includes('哈希链'))).toBe(true);
});
it('R7：历史无哈希段为 LEGACY 诊断，不违规', () => {
  const rows = [mkEntry({ runId: 'old1' }), mkEntry({ runId: 'old2' }), ...withChain([mkEntry({ runId: 'n1' })])];
  expect(checkRunLog(rows).violations.filter((v) => v.includes('哈希链'))).toEqual([]);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts -t "哈希链"`
预期：FAIL。

- [ ] **步骤 3：实现**

哈希定义（写入 `data-models.md` 与 schema description，第三方可复核）：

```
recordHash = sha256(prevRecordHash + "\n" + canonicalJson(record 去掉 recordHash 字段))
canonicalJson = 对象键按 Unicode 码点升序、无空白、UTF-8、数组保序
```

`run-log-logic.ts` 新导出共享实现（writer 与 checker 共用，DRY）：

```ts
export function canonicalJson(value: unknown): string;                      // 键按码点升序、无空白
export function computeRecordHash(record: Record<string, unknown>, prevRecordHash: string): string;
```

`run-log-logic.ts` R7 段在时间单调检查之后追加：从**最后一条带 `recordHash` 的记录**开始向前逐条验证（`prevRecordHash` 必须等于前一条的 `recordHash`；首条带哈希记录的 `prevRecordHash` 为 `""`）；断链 → blocking `R7: …哈希链断裂（记录 runId）`；遇到第一条无 `recordHash` 的记录即停止并记非阻断 diagnostic `R7: 历史段 N 条无哈希（LEGACY，未参与链校验）`。

`run-log-append-logic.ts` 在计算新记录的 `recordHash` 时，`prevRecordHash` 取文件内最后一条带哈希记录的 `recordHash`（无则 `""`），并**直接 import** `computeRecordHash`（logic → logic 同层，允许）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
预期：PASS（既有 2890 行测试零回归——新字段可选）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/scripts w-model-dev/references/data-models.md
git commit -m "feat(run-log): R7 增记录哈希链校验，LEGACY 段非阻断（D-3）"
```

## 任务 8：checkpoint 锚与归档前缀性（D-3b）

**文件：**
- 修改：`w-model-dev/schemas/run-log.schema.json`（可选 `runLogAnchor: {lines, sha256}`）
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`（R7 第三段：锚自洽）
- 修改：`w-model-dev/scripts/logic/archive-integrity-logic.ts`、`w-model-dev/scripts/cli/check-archive-integrity.ts`（L4）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`、`archive-integrity-logic.test.ts`

- [ ] **步骤 1：写失败的测试**

```ts
// 判据签名扩展为第 4 个可选参（文本注入，遵 logic 层零 fs 约定）：
//   checkArchiveIntegrity(archiveDirContents, phasesToCheck, manifest?, options?: { liveRunLogText?: string })
it('R7：checkpoint 锚与该放行时刻之前的记录前缀不符 → 违规', () => {
  const rows = [mkEntry({ runId: 'a' }), mkEntry({ runId: 'cp', action: 'checkpoint', outcome: 'success', runLogAnchor: { lines: 9, sha256: 'deadbeef' } })];
  expect(checkRunLog(rows).violations.some((v) => v.includes('放行锚') || v.includes('runLogAnchor'))).toBe(true);
});
it('归档快照非 live 前缀 → 违规', () => {
  const r = checkArchiveIntegrity(new Set(['run-log.jsonl']), ['1'], undefined, {
    liveRunLogText: 'A\nB\nC\n', archivedRunLogText: 'A\nX\n',
  });
  expect(r.missingFiles.some((m) => m.includes('[runLogPrefix]'))).toBe(true);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/scripts/__tests__/archive-integrity-logic.test.ts -t "锚|前缀"`
预期：FAIL。

- [ ] **步骤 3：实现**

L3（锚）：定义 `runLogAnchor.sha256 = sha256(按文件序、timestamp ≤ 放行时间戳 的记录行的**原始字节**拼接)`，`lines` 为该前缀行数；`check-run-log` 逐条校验（不符 → blocking `R7: 放行记录 runId 的 runLogAnchor 与当前历史前缀不符（放行后被改写）`）；缺字段不违规（历史记录 LEGACY）。

L4（归档前缀）：`check-archive-integrity.ts` 增可选 `--live-run-log=<path>`；提供时读两侧文本，断言 `liveText.startsWith(archiveText)`，否则并入 `missingFiles`（前缀 `[runLogPrefix]`）；未提供则 stdout 输出非阻断诊断。logic 侧经注入参数收文本（遵 zero-fs 约定，仿 `progressMdContent` 先例）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/scripts/__tests__/archive-integrity-logic.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts w-model-dev/schemas/run-log.schema.json
git commit -m "feat(run-log): checkpoint 放行锚 + 归档前缀性校验（D-3）"
```

## 任务 9：禁令与替代动作成文

**文件：** `w-model-dev/references/data-models.md:517` 附近、`references/operational-recovery.md:462`、`references/hard-constraints.md:55`、`AGENTS.md`（约束段）

- [ ] **步骤 1：成文**

在 `hard-constraints.md` 约束 #11 补一句（**不新增反模式编号**）：「run-log 的时间戳必须为写入时刻真值；**禁止回溯改写历史行或重排时间戳**（反伪造）；记录修正只允许经 `wm-append-runlog --correct` 追加更正记录。」同句在 `data-models.md:517`（append-only 段）与 `operational-recovery.md` 复述，并给出工具用法示例。

- [ ] **步骤 2：验证**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → 预期 exit 0。

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/references AGENTS.md
git commit -m "docs(hard-constraints): run-log 禁止回溯改写 + 更正记录替代动作成文"
```

## 任务 10：自举顺序纪律与文档例外登记（D-4 + D-8 + N-3）

**文件：** `w-model-dev/SKILL.md:69,88,92-101`、`references/operational-recovery.md:445-484`、`references/hard-constraints.md:55`、`docs/skill-design-document_SSoT.md:1937`、`references/data-models.md:574`、`references/command-reference.md:69`、`AGENTS.md:160`

- [ ] **步骤 1：SKILL.md 增显式顺序**

在阶段门工作流（`:92-101`）插入三步：① `checkpoint-log/phase-N` 用户确认落盘（阶段 1 由 R0 自举形态消费）；② 闭环五门串行（`check-budget`/`check-run-log`/`check-maturity`/`check-checkpoint`/`check-preventive-review`，均带 `--run-log`）；③ **放行记录（`action=checkpoint`、`outcome=success`）为阶段末条且严格晚于五条 gate 记录**（同秒不算早于）。

- [ ] **步骤 2：四处例外登记 + 一处悬空引用**

`hard-constraints.md:55`、`SSoT:1937`、`data-models.md:574`、`command-reference.md:69` 各补「phase-1 × `check-checkpoint.ts` 后置窗口为**历史日志兼容例外**」；`AGENTS.md:160` 把「见 check-checkpoint.ts 行」改为实锚 `logic/checkpoint-logic.ts:241-250`。

- [ ] **步骤 3：N-3 核查**

运行：`npx tsx w-model-dev/scripts/cli/check-checkpoint.ts w-model-dev/scripts/samples/run-log/valid.jsonl --checkpoint-log=w-model-dev/scripts/samples/checkpoint --json`
若报 R4（阶段主题词），改该 fixture 的 `decisions` 文本使其满足 `PHASE_KEYWORDS[1]`（并确认 `self-test.ts:1314,1485` 引用面不受影响）；若不报，在任务报告记录「复核无误」即可。

- [ ] **步骤 4：三态回归锚**

用临时目录（系统 temp）构造三份最小 run-log：自然时序（五门在前 + 放行末条）→ `check-run-log` 与 `check-checkpoint` 均 exit 0；「先写放行后补门」（阶段 ≥2）→ exit 1 且含 R11/R8 文案。把命令与输出贴进 Wave B 证据。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/references docs/skill-design-document_SSoT.md AGENTS.md
git commit -m "docs(gates): 闭环五门→放行记录顺序成文 + 后置窗口例外登记补齐（D-4/D-8）"
```

## 任务 11：预算接线与口径成文（D-5② + N-6）

**文件：** `references/operational-recovery.md:449-455`、`references/subagent-delegation.md:337`、`references/toolbox.md:17`、`w-model-dev/scripts/cli/check-budget.ts`、`references/data-models.md:399`
**测试：** `w-model-dev/scripts/__tests__/budget-cli-wiring.test.ts`

- [ ] **步骤 1：写失败的测试**

```ts
it('未提供 --run-log → exit 0 且输出未接线诊断', () => {
  const r = runCli(['budget.json', '--project=project.json', '--phase=8']);
  expect(r.exitCode).toBe(0);
  expect(r.stdout + r.stderr).toMatch(/R6\/R5-b 未生效（未提供 run-log）/);
});
it('疑似重复归账（同 timestamp+tokens+duration）→ 诊断不改退出码', () => {
  const r = runCli(['budget.json', '--project=project.json', '--phase=1', `--run-log=${fixture}`]);
  expect(r.stdout + r.stderr).toMatch(/疑似重复归账/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget-cli-wiring.test.ts`
预期：FAIL（诊断文案不存在；**既有「未提供 run-log 行为一字不变」的兼容硬线用例必须保持绿**——只加诊断，不改判据）。

- [ ] **步骤 3：实现 + 文档**

`check-budget.ts` 在 `usage === undefined` 分支打印诊断；在 `sumTokens` 结果旁统计「同 `(timestamp, tokens, duration_s)` 出现 >1 次」的组数并打印上界口径提示。文档：三处调用表补 `--run-log=.w-model/run-log.jsonl --phase=N`（**必带**）；`data-models.md:399` 写明「Σtokens 为**上界**口径；同一分派的多条归账会重复累计」+ R3 三条目归账约定。

- [ ] **步骤 4：运行测试验证通过并做牙齿取证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget-cli-wiring.test.ts
npx tsx w-model-dev/scripts/cli/check-budget.ts eval/e2e/demo/.w-model/budget.json --project=eval/e2e/demo/.w-model/project.json --phase=8 --run-log=eval/e2e/demo/.w-model/run-log.jsonl
# 预期 exit 1 且含 R6 文案（522M > 300M）——存档为「接线的牙齿」证据
```

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts w-model-dev/references
git commit -m "fix(budget): 权威调用表强制接线 + 未接线/重复归账诊断 + 上界口径成文（D-5②/N-6）"
```

## 任务 12：Wave B 验收（反伪造探针）

- [ ] **步骤 1：五类突变探针**（仓库外副本上操作，不得改仓库内快照）

```bash
SNAP=docs/debug/2026-09-23-wm-8phase-live-run/snapshots/run-log.jsonl
cp "$SNAP" "$TMP/run-log.jsonl"     # 改 note / 改历史时间戳 / 删行 / 插行 / 正确追加 五种形态
npx tsx w-model-dev/scripts/cli/check-run-log.ts "$TMP/run-log.jsonl" --json
# 预期：前四种 exit 1（含哈希链或锚文案），第五种 exit 0
```

- [ ] **步骤 2：历史零回归**

运行：`npx tsx w-model-dev/scripts/cli/check-run-log.ts "$SNAP" --json` → 预期 exit 0（历史无哈希段 = LEGACY 诊断）。

- [ ] **步骤 3：全量**

运行：`npm run test:affected` → `npm run prepush` → 预期 exit 0。

- [ ] **步骤 4：证据 + CHANGELOG**

`docs/debug/2026-09-25-wave-b-integrity/README.md`：探针矩阵（五类 × 退出码 + 原始输出）+ `check-budget --run-log` 的 R6 牙齿证据 + 三态时序回归输出；`CHANGELOG.md` 登记 Wave B。

- [ ] **步骤 5：Commit**

```bash
git add docs/debug/2026-09-25-wave-b-integrity CHANGELOG.md
git commit -m "test(acceptance): Wave B 反伪造探针 5/5 + 预算接线牙齿证据 + 登记"
```

---

# Wave C · 披露面、产物形态与遗留销项

## 任务 13：归档披露面规则澄清（D-9）

**文件：** `w-model-dev/references/phase-8-acceptance-test.md:270-285`、`AGENTS.md:25,31-33`、`docs/INSTALL.md:15,35`

- [ ] **步骤 1：改写规则与义务**

`:284` 现行「archive 产物禁止具体文件路径」改为可执行口径：**归档允许保留执行证据原貌**（gate-log 头部 `cwd`/输入文件路径属「本机真实执行」证据）；**禁止的是设计文档与归档 README 中的具体文件路径**。新增一句：「**交付/外发前必须经 `wm-export-evidence` 生成脱敏包；禁止直接外发归档目录**」。`AGENTS.md:25`（本地生成物与审计证据节）与 `:31-33`（Source-bound 边界节）、`docs/INSTALL.md:15,35` 复述该义务（**保持既有 localEvidenceDocs token 子串不变**：`本地生成物` / `默认不交付` / `npm run wm:export-evidence -- <project-dir> <output-dir>` / `脱敏` / `SHA-256` / `安全策略审阅` / `不会自动提交或发布` / `归档边界`）。

- [ ] **步骤 2：验证**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → 预期 exit 0（token 契约未破）。

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/references/phase-8-acceptance-test.md AGENTS.md docs/INSTALL.md
git commit -m "docs(phase-8): 归档披露规则澄清 + 交付前脱敏义务成文（D-9）"
```

## 任务 14：V 产物形态固化（D-10）

**文件：** `references/subagent-delegation.md:743-752,1190-1194`、`references/verifier-spec.md:314-317,530-540`、`references/agent-personas.md`、`w-model-dev/scripts/logic/verifier-logic.ts:317-322,533-555,610-624`、`samples/verifier/*`

- [ ] **步骤 1：写失败的测试**（样本驱动的负例先红）

```ts
it('完美等差数列 rawScores → 失败且文案含改进指引', () => {
  const r = runVerifier('samples/verifier/bad-arithmetic-sequence.json');
  expect(r.exitCode).toBe(1);
  expect(r.stdout + r.stderr).toMatch(/真实离散/);
});
it('双 L evidence 形态 → 文案点明格式不符（非空泛声明）', () => {
  const r = runVerifier('samples/verifier/bad-evidence-double-l.json');
  expect(r.exitCode).toBe(1);
  expect(r.stdout + r.stderr).toMatch(/格式不符|须 path:Lnn=stmt/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts -t "改进指引|格式不符"`
预期：FAIL（样本文件尚不存在）。

- [ ] **步骤 3：实现文案区分 + 新增三负样本**

`verifier-logic.ts`：`:551` 等差文案追加「请改用真实离散值（相邻打分差值不得恒等、不得为 0.01 完美等差）」；`:317-322` 的 evidence 失败拆两路——正则不匹配 → `evidence 格式不符（须 path:Lnn=stmt 或 path:§sec=stmt，单 L 形态）：…`；匹配但命中 `VAGUE_EVIDENCE_PATTERNS` → 保留「空泛声明，O3 命中」。同步 `verifier-logic-rule-loadbearing.test.ts:149-151` 的 anchor 字符串。

新增样本 `samples/verifier/bad-arithmetic-sequence.json`（`[0.97,0.96,0.98]`）、`bad-resolution-floor.json`、`bad-evidence-double-l.json`（evidence 形如 `docs/x.md:L51-L53=…`）；登记 `self-test.ts` VERIFIER_CASES、`samples/README.md:13` 计数、`NEGATIVE-COVERAGE.md:69`。

- [ ] **步骤 4：模板固化（三条硬约束 + 自检清单）**

`subagent-delegation.md:743-752` 与 `:1190-1194` 追加：① rawScores 真实离散（禁全同/禁 0.01 完美等差/`text-parse` 下 `max-min ∈ [0.01,0.10]`）；② evidence 每条 `path:§sec=陈述` 或 `path:Lnn=陈述`（禁双 L）；③ `reviewedAt` 为评审完成真实时刻且不早于被评审产物。`verifier-spec.md:314-317` 自检清单 +2 条、`:530-540` 补双 L 反例；`agent-personas.md` 各 Persona「评审规则」节各补 1 行。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/__tests__/verifier-logic-rule-loadbearing.test.ts`
预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts w-model-dev/references docs
git commit -m "fix(verifier): 等差/O3 文案区分 + V 简报三硬约束固化 + 3 负样本（D-10）"
```

## 任务 15：装配器归档快照激活（遗留③）

**文件：** `eval/e2e/demo-assets/build_workspace.py:834-845`

- [ ] **步骤 1：装配器补归档清单**

在 `arch_files` 中补 `<changeId>.plan.md`、`progress.md`、`task-1-{brief,report}.md`（形态对齐 `samples/archive-integrity/valid-coding-plan-snapshot/`），`archive-manifest.json` 相应登记；驱动 `run_trajectory.sh:121` **保持不传** `--change-id`（覆盖「自动派生恰一」分支）。

- [ ] **步骤 2：验证（重建后）**

```bash
python eval/e2e/demo-assets/build_workspace.py --reset
cd eval/e2e/demo && npx tsx ../../../w-model-dev/scripts/cli/check-archive-integrity.ts archive/2026-09-19-counter-api
# 预期：快照判定依据 = 自动派生（归档根恰一 *.plan.md）；exit 0
```

- [ ] **步骤 3：CHANGELOG 销项**

未解清单 ③ 改为「已激活（装配器归档根含 plan/progress/三件套；自动派生分支由 e2e 覆盖）」。

- [ ] **步骤 4：Commit**

```bash
git add eval/e2e/demo-assets/build_workspace.py CHANGELOG.md
git commit -m "fix(demo-assets): 归档根补编码计划快照，激活 codingPlanSnapshot 自动派生（未解③）"
```

## 任务 16：装配器补 counter.ts 不变式断言（遗留④）

**文件：** `eval/e2e/demo-assets/build_workspace.py:211-218,957-959`

- [ ] **步骤 1：补断言**

`src/counter.ts` 模板加 `import assert from 'node:assert/strict';`，在 `inc()` 与 `reset()` 各加 ≥1 条 `assert.ok(this.value >= 0 && this.value <= 10, 'invariant: 0 <= value <= 10');`（D4 判据只要求全 src ≥1 条）；`:957-959` 注释由「D4 断言覆盖在 demo 源码上为红」改为事实陈述。

- [ ] **步骤 2：验证**

```bash
python eval/e2e/demo-assets/build_workspace.py --reset
cd eval/e2e/demo && npx tsx ../../../w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src
# 预期 exit 0，维度4 断言覆盖不变式 ✓
```

- [ ] **步骤 3：CHANGELOG 销项**

未解清单 ④ 改为「已补（装配器 counter.ts 含不变式断言；门禁未放宽）」。

- [ ] **步骤 4：Commit**

```bash
git add eval/e2e/demo-assets/build_workspace.py CHANGELOG.md
git commit -m "fix(demo-assets): counter.ts 补不变式断言，闭合 D4 fixture 缺口（未解④）"
```

## 任务 17：无 git provenance 形态（遗留⑥a）

**文件：** `w-model-dev/scripts/logic/evidence-provenance-logic.ts:186-225,382,659-673`、`w-model-dev/schemas/evidence-provenance.schema.json`、`w-model-dev/schemas/evidence-manifest.schema.json`、`w-model-dev/scripts/cli/wm-verify-evidence-source.ts`、`AGENTS.md:31-33`、`docs/INSTALL.md:15,35`、`w-model-dev/references/command-reference.md`
**测试：** `w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts:128-135,196-202`

- [ ] **步骤 1：写失败的测试**

```ts
it('无 .git 工作区：产出 provenanceKind=no-git 且校验拒绝 source-bound', async () => {
  const p = await produceSourceProvenance(noGitFixture);
  expect(p.record.provenanceKind).toBe('no-git');
  expect(p.record.workspaceDigest).toMatch(/^[0-9a-f]{64}$/);
  const v = await verifySourceProvenance(p.record, { sourceProject: noGitFixture });
  expect(v.ok).toBe(false);
  expect(v.reason).toBe('NOT_SOURCE_BOUND_NO_GIT');
});
it('有 .git 工作区：provenanceKind=git 且行为与现状一致', async () => { /* 保留原断言路径 */ });
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts -t "no-git"`
预期：FAIL（现行为是 `MISSING_GIT_HEAD` exit 1）。

- [ ] **步骤 3：实现 + 护栏**

`gitHead()` 抛 `MISSING_GIT_HEAD` 时：若 `--no-git-ok`（CLI 新 flag）在场则改走 no-git 分支——`provenanceKind: 'no-git'`、`workspaceDigest = sha256(导出源文件相对路径 + 各自 sha256 的规范化清单)`、保留 `runId`/`user`/`host` 身份字段、`commitSha` 置空（schema 改条件必填）。`verifySourceProvenance` 遇 `provenanceKind: 'no-git'` 且请求 source-bound 复核 → 一律拒绝（`NOT_SOURCE_BOUND_NO_GIT`，exit 1）。schema description 与 `AGENTS.md:31-33`、`INSTALL.md` 明写「no-git 包**永久只能 package-only**，不得表述为 verified source」。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`
预期：PASS（`MISSING_GIT_HEAD` 断言保留给「无 git 且未传 `--no-git-ok`」路径）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts w-model-dev/schemas AGENTS.md docs/INSTALL.md
git commit -m "feat(evidence): 无 git 工作区 no-git provenance（永久 package-only 护栏）（未解⑥a）"
```

## 任务 18：导出白名单与 producer 口径统一（遗留⑥b + N-7）

**文件：** `w-model-dev/scripts/logic/evidence-export-logic.ts:109-114,185-188,285-300`、`w-model-dev/scripts/logic/evidence-provenance-logic.ts:385,433`、`AGENTS.md:25`、`docs/INSTALL.md:15`、`references/command-reference.md`
**测试：** `w-model-dev/scripts/__tests__/evidence-export-logic.test.ts:222-231,473`、`evidence-provenance-logic.test.ts:48,51`

- [ ] **步骤 1：写失败的测试**

```ts
it('根级 signature-chain.jsonl 进入导出白名单与测量清单', async () => {
  const r = await collectExportSources(stateDirWithRootChain);
  expect(r.files.some((f) => f.relativePath === 'signature-chain.jsonl')).toBe(true);
});
it('根级文件与 legacy 目录并存 → fail-closed', async () => {
  await expect(collectExportSources(stateDirWithBoth)).rejects.toThrow(/SIGNATURE_CHAIN_AMBIGUOUS/);
});
it('producer 接受根级链（不再 MISSING_SIGNATURE_CHAIN）', async () => {
  const p = await produceSourceProvenance(gitFixtureWithRootChain);
  expect(p.ok).toBe(true);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts -t "signature-chain"`
预期：FAIL。

- [ ] **步骤 3：实现**

`evidence-export-logic.ts`：`expectedEvidenceKind` 增根级 `signature-chain.jsonl` → `'signature-chain'`；`collectExportSources` 增文件探测；两侧（导出与 verify）共用同一白名单函数，保持双向对称；并存歧义 → `ProvenanceFailure(1, 'SIGNATURE_CHAIN_AMBIGUOUS')`。`evidence-provenance-logic.ts:385` 采集面与 `:433` 非空校验同步接受根级文件（`signature-chains/` 保留为 legacy 兼容）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts`
预期：PASS。

- [ ] **步骤 5：文档同步**

`AGENTS.md:25`、`docs/INSTALL.md:15`、`references/command-reference.md` 的导出白名单复述补根级 `signature-chain.jsonl`（保持 localEvidenceDocs token 子串不变）。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts AGENTS.md docs/INSTALL.md
git commit -m "fix(evidence): 白名单/生产者统一接受根级 signature-chain.jsonl，修导出链不可用（未解⑥b/N-7）"
```

## 任务 19：demo 重建重放（Wave C 收尾）

- [ ] **步骤 1：先提交再重建**（`--scope` 绑定 `HEAD~1..HEAD`，未提交即全红）

```bash
git status --porcelain   # 必须为空（或仅剩本次任务自身的改动）
git log --oneline -1
```

- [ ] **步骤 2：证据保全确认**

确认 `docs/debug/2026-09-23-wm-8phase-live-run/snapshots/`（run-log / signature-chain / project.json / orchestrator-state / 11 份终局电池日志）在盘——重建会销毁 live-run 瞬态态。

- [ ] **步骤 3：重建 + 重放**

```bash
python eval/e2e/demo-assets/build_workspace.py --reset
cd eval/e2e/demo-assets && bash run_trajectory.sh          # 预期 TOTAL_GATE_RUNS=119 / NONZERO_EXIT_COUNT=0
bash run_negative_probes.sh                                 # 预期 9/9 探针被拦截 + 恢复复绿
```

- [ ] **步骤 4：证据落盘**

`docs/debug/2026-09-25-wave-c-replay/replay.txt`（含命令全文与尾部输出、EXIT_CODE 行）+ `negative-probes.txt`。

- [ ] **步骤 5：Commit**

```bash
git add docs/debug/2026-09-25-wave-c-replay
git commit -m "test(acceptance): demo 重建重放 119/119 + 负向探针 9/9（Wave C）"
```

## 任务 20：收口（计数、CHANGELOG、全量验收）

- [ ] **步骤 1：计数与登记核对**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts        # schema 34 / references 44 / action 30 / 反模式 48 / pre-push 19 / exit-2 46 全中
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts        # 矩阵 + NEGATIVE-COVERAGE 探针闭环
npm run audit:l0-links
```

- [ ] **步骤 2：CHANGELOG 终稿**

新增版本节（建议 `42.3.0`）逐 WS 登记 D-1..D-10 / N-1..N-7 / ③④⑥ 的处置与证据路径；未解清单 ③④⑥ **全部销项**；D-9 订正句（「归档 README 已披露」不成立）；显式不修项（规格 §6 七条）与理由；`docs/debug/2026-09-23-wm-8phase-live-run/README.md` 的报告口径订正（D-2 计数、D-4 已消解、D-5 归因、D-8 方向、D-10 标签）以「跟踪面订正」形式落 CHANGELOG（debug 报告本体不改写）。

- [ ] **步骤 3：全量验收**

```bash
npm run prepush      # 19 项 exit 0（全量 vitest + 覆盖率阈值 + 规则层覆盖口径 + security-scan + samples 覆盖 + prettier + tsc + eval 语料）
```

- [ ] **步骤 4：账本收尾**

`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md` 逐任务写 `Task N: complete`；补 `task-N-{brief,report}.md` 与 `review-*.diff` 齐备性核对。

- [ ] **步骤 5：Commit**

```bash
git add CHANGELOG.md docs .superpowers 2>/dev/null || git add CHANGELOG.md docs
git commit -m "docs(changelog): live run 调测发现全量修复登记 + 未解清单③④⑥销项 + 报告口径订正"
```

---

## 验收总表（与规格 §7 对应）

| 规格条 | 验收动作 | 期望 |
| --- | --- | --- |
| WS-1 | samples 3 例 + demo 阶段 2-8 复跑 | R6 分池正例 exit 0；DD 漂移负例 exit 1；scope 在盘不违规 |
| WS-2 | 新样本 1 例 + `--preflight` | 空文件 → exit 1；无锚但非空 → exit 0 + stderr 诊断；preflight 打印固定 14 项清单；既有 35 例零回归 |
| WS-3 | 新样本 2 例 | 未声明降级 → exit 1；无索引 + 降级 + 替代证据 → exit 0；有索引 + artifact → exit 1 |
| WS-4 | 新样本 2 例 + demo 复跑 | 引用性 O3 → exit 0 + 诊断；字段 3 次 → exit 1 |
| WS-5 | 五类突变探针 + 归档前缀探针 | 前四类 exit 1、正确追加 exit 0；归档非前缀 → exit 1 |
| WS-6 | 三态时序 fixture | 自然时序双门 exit 0；先放行后补门 exit 1 |
| WS-7 | demo `--run-log` 复跑 + 静态口径 | 前者 exit 1（R6 文案）；后者 exit 0 + 诊断 |
| WS-8 | `check-docs-consistency` | exit 0（token 契约未破） |
| WS-9 | verifier 定向测试 | 3 负样本 exit 1；load-bearing 锚同步 |
| WS-10 | 重放 + 导出链用例 | 119/119、9/9、根级链进白名单、no-git 拒绝 source-bound |
| WS-0 | `npm run prepush` | 19 项 exit 0 |
