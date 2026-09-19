# 调测报告订正 + 门禁诊断修复 + 可重放资产交付 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `docs/debug/2026-09-19-wm-8phase-full-debug` 审计暴露的 9 项报告缺陷（P1–P9）与 3 类技能包缺陷（S1/S2/F-1–F-4）全部修掉，并把 e2e 装配器/驱动/负向探针交付为受跟踪的 `eval/e2e/demo-assets/`，使 119/119 轨迹可在干净检出上重放。

**架构：** 技能包侧只做三处最小改动——①`artifact-gate` 给三个子进程显式预算 + 超时诊断；②`checkHierarchy` 区分「被 phase 过滤掉的 child」的措辞；③把 `gate-logic` 里内联的 RTM 行级完整性规则抽成导出纯函数，让 `wm-status` 与聚合门同源。资产侧把 `eval/e2e/demo/`（gitignored）里的三个脚本迁到 `eval/e2e/demo-assets/`（受跟踪）并去掉绝对路径与硬编码 SHA。报告侧只改未跟踪的 `docs/debug/` 文本与新增探针日志，不进提交。

**技术栈：** TypeScript（tsx runtime）+ vitest + Node 22/25 + Python 3（装配器/探针变异）+ Bash（轨迹与探针驱动）+ 真实 Java SANY/TLC（`w-model-dev/tools/tla2tools.jar`）。

**权威规格：** [docs/superpowers/specs/2026-09-19-debug-report-corrections-design.md](../specs/2026-09-19-debug-report-corrections-design.md)（含用户裁定与 §5.3 修订 r1）。

---

## 文件结构

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `w-model-dev/scripts/lib/constants.ts` | 修改 | `EXEC_LIMITS` 新增 `modelCheckChildTimeoutMs`（模型检查子进程预算单点定义） |
| `w-model-dev/scripts/application/artifact-gate-assets.ts` | 修改 | 三处 `runSync` 显式预算；`appendProcessViolation` 报出信号/超时原因 |
| `w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts` | 修改 | 红→绿：预算传递 + 信号诊断（用例内联，不新增文件） |
| `w-model-dev/scripts/logic/tla-logic.ts` | 修改 | `checkHierarchy(specs, options?)` 区分「后续阶段 child」措辞；调用方传入被过滤集合 |
| `w-model-dev/scripts/__tests__/tla-logic.test.ts` | 修改 | 红→绿：两条层次措辞用例（内联 fixture） |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改 | 抽出并导出 `computeRtmTraceCoverage(rows, phase)`（单一事实来源，判定不变） |
| `w-model-dev/scripts/logic/wm-status-logic.ts` | 修改 | 改用 `computeRtmTraceCoverage`，删掉 `=== '100%'` 字面量 |
| `w-model-dev/scripts/cli/wm-status.ts` | 修改 | 输出标签「RTM 覆盖率（按追溯字段重算）」 |
| `w-model-dev/scripts/__tests__/wm-status-logic.test.ts`（若不存在则加在既有 wm-status 用例文件） | 修改 | 红→绿：4 行齐全 → 100%；缺 `codeModule` → 75% |
| `docs/skill-design-document_SSoT.md` | 修改 | §10.5（子进程预算与诊断）、§10.8 item 5（层次措辞）、RTM 覆盖率口径 |
| `w-model-dev/references/tla-plus.md` | 修改 | 层次校验措辞同步（第 389 行附近） |
| `w-model-dev/references/command-reference.md` | 修改 | wm-status 覆盖率口径（第 359 行） |
| `w-model-dev/references/data-models.md` | 修改 | `coverageStatus` 仅展示 + 同源函数（第 242 行附近） |
| `w-model-dev/schemas/bdd-manifest.schema.json` | 修改 | `basePath` description 补解析基准差异 |
| `w-model-dev/references/bdd.md` | 修改 | F-2 解析基准注记 + F-3 `SM-` 前缀约定 + F-4 When 行 token 约定 |
| `eval/e2e/demo-assets/README.md` | 创建 | 前置条件、重建/重放步骤、已知坑、断言 |
| `eval/e2e/demo-assets/build_workspace.py` | 创建 | 由 `eval/e2e/demo/build_workspace.py` 迁移 + 运行时 SHA/`--reset` 改造 |
| `eval/e2e/demo-assets/run_trajectory.sh` | 创建 | 由 `eval/e2e/demo/run_trajectory.sh` 迁移 + 去绝对路径 + 计数自断言 |
| `eval/e2e/demo-assets/run_negative_probes.sh` | 创建 | 9 项篡改探针（含 P1 的两项 TLA 探针） |
| `eval/e2e/2026-09-19-8phase-debug-replay.md` | 创建 | 重放记录（受跟踪，沿用 `eval/e2e/*.md` 先例） |
| `docs/debug/2026-09-19-wm-8phase-full-debug/{README.md,EVIDENCE_GRAPH.md,logs/e2e/negative-probes.log}` | 修改 | 报告订正 P1–P9（未跟踪，不提交） |
| `CHANGELOG.md` | 修改 | 42.2.1 段落新增本轮收口子节（含来源声明） |

**测试面约定**：全部新用例加在既有测试文件内，**不新增 `*.test.ts`、不新增 samples 夹具**——避免触发 `self-test` 样本计数（358）、fixture 计数（376）、`testFileCount` 等活体文档计数面。

---

## 任务 1：S1 —— artifact-gate 子进程显式预算与超时诊断

**文件：**
- 修改：`w-model-dev/scripts/lib/constants.ts:48`
- 修改：`w-model-dev/scripts/application/artifact-gate-assets.ts`（imports、三处 `runSync`、`appendProcessViolation`）
- 测试：`w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts`
- 修改：`docs/skill-design-document_SSoT.md`（§10.5，第 1330 行起）

- [ ] **步骤 1：改 SSoT（SSoT-first 纪律）**

在 `docs/skill-design-document_SSoT.md` 的 `### 10.5 工件质量门（Artifact Gate）` 节末尾追加：

```markdown
> **子进程预算与诊断（2026-09-19）**：本门禁以子进程方式调用 `check-tla-model` / `check-bdd-model` / `check-tla-bdd-sync` 做终检，三个子进程必须携带显式预算 `EXEC_LIMITS.modelCheckChildTimeoutMs`（= SANY 60s + TLC 300s + 余量），不得落回 `runSync` 的 15s 默认值；子进程被信号终止时，违例消息须报出信号名与超时语义，避免退化为无法诊断的「退出码 unknown」。
```

- [ ] **步骤 2：写失败的测试（红）**

在 `w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts` 顶部 import 区补 `EXEC_LIMITS`（若尚未导入）：

```ts
import { EXEC_LIMITS } from '../lib/constants.js';
```

在 `describe('runModelChecks …')`（或该文件内 `runModelChecks` 用例相邻处）追加两条用例：

```ts
it('passes the model-check child budget to the TLA child process', () => {
  spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
  runModelChecks({
    manifestExists: true,
    manifestValid: true,
    effectivePhase: 1,
    graphPath: '',
    manifestFile: 'm.json',
    bddManifestExists: false,
    bddManifestValid: false,
    bddManifestFile: 'b.json',
  });
  const call = spawnSyncMock.mock.calls.find((c) => {
    const args = (c[1] ?? []) as string[];
    return args.some((a) => typeof a === 'string' && a.endsWith('check-tla-model.ts'));
  });
  expect(call?.[2]).toMatchObject({ timeout: EXEC_LIMITS.modelCheckChildTimeoutMs });
});

it('reports signal termination with a timeout hint', () => {
  spawnSyncMock
    .mockReturnValueOnce({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })
    .mockReturnValue({ status: 0, stdout: '' });
  const violations = runModelChecks({
    manifestExists: true,
    manifestValid: true,
    effectivePhase: 1,
    graphPath: '',
    manifestFile: 'm.json',
    bddManifestExists: false,
    bddManifestValid: false,
    bddManifestFile: 'b.json',
  });
  const tla = violations.find((v) => v.includes('[artifact:tla-model]'));
  expect(tla).toBeDefined();
  expect(tla).toContain('SIGKILL');
  expect(tla).toContain('超时');
});
```

- [ ] **步骤 3：运行测试确认失败**

运行：`npx vitest run --config config/vitest.config.ts artifact-gate-assets`
预期：FAIL——首条报 `expected … to match object { timeout: 360000 }`（实际 `undefined`）；次条报 `tla` 不含 `SIGKILL`。

- [ ] **步骤 4：加常量**

`w-model-dev/scripts/lib/constants.ts` 的 `EXEC_LIMITS` 改为：

```ts
/**
 * 子进程执行限额（审计修复 P3/P15：SANY/TLC 无超时可致门禁永久挂死；限额集中单点定义）。
 * SANY 语法检查快速失败 60s；TLC 状态爆炸时 300s 防挂死（对齐 ensure-codegraph-opsx.ts 上限）。
 * modelCheckChildTimeoutMs：聚合门以子进程调用模型检查时的预算，须 ≥ 其内部 SANY+TLC 限额之和。
 */
export const EXEC_LIMITS = {
  sanyTimeoutMs: 60_000,
  tlcTimeoutMs: 300_000,
  shortTimeoutMs: 15_000,
  modelCheckChildTimeoutMs: 360_000,
  maxBufferSmall: 16 * 1024 * 1024,
  maxBufferLarge: 64 * 1024 * 1024,
} as const;
```

- [ ] **步骤 5：接线三处子进程调用**

在 `w-model-dev/scripts/application/artifact-gate-assets.ts` 的 import 区追加：

```ts
import { EXEC_LIMITS } from '../lib/constants.js';
```

把三处 `runSync(..., { stdio: ['ignore', 'pipe', 'pipe'] })` 改为（TLA 子进程，约 539 行）：

```ts
      runSync(process.execPath, tlaArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_LIMITS.modelCheckChildTimeoutMs,
      }),
```

BDD 子进程（约 561 行）与 TLA↔BDD sync 子进程（约 574 行）同款加 `timeout: EXEC_LIMITS.modelCheckChildTimeoutMs`。

- [ ] **步骤 6：改 `appendProcessViolation` 诊断**

把该函数体替换为（保留原文案前缀，避免破坏既有前缀断言）：

```ts
function appendProcessViolation(
  violations: string[],
  label: string,
  script: string,
  result: { status: number | null; signal?: NodeJS.Signals | null; stdout?: string | null; stderr?: string | null } | undefined,
): void {
  if (!result || result.status !== 0) {
    const cause = result?.signal
      ? `被信号 ${result.signal} 终止（很可能是执行超时：子进程预算 ${EXEC_LIMITS.modelCheckChildTimeoutMs}ms，SIGKILL 由 runSync 发出）`
      : '';
    const output = result
      ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-5).join(' | ')
      : '未返回进程结果';
    const detail = [cause, output].filter((s) => s !== '').join('：');
    violations.push(`[artifact:${label}] ${script} 退出码 ${result?.status ?? 'unknown'}：${detail}`);
  }
}
```

- [ ] **步骤 7：运行测试确认通过**

运行：`npx vitest run --config config/vitest.config.ts artifact-gate-assets`
预期：PASS（含既有 `退出码 unknown` 前缀断言——`stringContaining` 只匹配前缀，应保持绿；若该用例因消息结构变化而失败，按其新措辞更新该条断言并在 commit message 说明）。

- [ ] **步骤 8：跑相邻测试面**

运行：`npx vitest run --config config/vitest.config.ts artifact-gate run-sync java-version`
预期：全绿（证明常量扩展未破坏 `SYNC_PROCESS_EXCEPTIONS` 登记表与常量单源）。

- [ ] **步骤 9：Commit**

```bash
git add w-model-dev/scripts/lib/constants.ts w-model-dev/scripts/application/artifact-gate-assets.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts docs/skill-design-document_SSoT.md
git commit -m "fix(artifact-gate): 模型检查子进程显式预算 + 超时/信号诊断（S1）"
```

---

## 任务 2：S2 —— `checkHierarchy` 区分「属后续阶段」的 child

**文件：**
- 修改：`w-model-dev/scripts/logic/tla-logic.ts`（`checkHierarchy` 约 403–470 行；调用方约 943 行）
- 修改：`w-model-dev/references/tla-plus.md:389` 附近
- 修改：`docs/skill-design-document_SSoT.md:1502`（§10.8 item 5）
- 测试：`w-model-dev/scripts/__tests__/tla-logic.test.ts`

- [ ] **步骤 1：改 SSoT**

`docs/skill-design-document_SSoT.md` §10.8「层次一致性校验」条（第 1502 行）末尾追加：

```markdown
   **措辞约定（2026-09-19）**：`children`/`parent`/`siblings` 指向的路径若存在于 manifest 但被当前 `--phase` 过滤掉（`spec.phase > phase`），违反消息须报「属后续阶段（phase=N），当前校验 phase=M 不包含它」，不得报成「不在 manifest 中」——后者会把「校验范围收窄」误报为「manifest 未登记」。
```

- [ ] **步骤 2：写失败的测试（红）**

在 `w-model-dev/scripts/__tests__/tla-logic.test.ts` 追加（该文件已有构造 spec 对象的 helper，可复用其字段风格；下面为自包含写法）：

```ts
import { checkHierarchy } from '../logic/tla-logic.js';

it('reports children filtered out by phase as later-phase specs, not as unregistered paths', () => {
  const l1 = {
    id: 'L1_counter',
    level: 'L1',
    phase: 1,
    tlaPath: 'tla/L1_counter.tla',
    cfgPath: 'tla/L1_counter.cfg',
    parent: null,
    children: ['tla/L2_counter_service.tla'],
    siblings: [],
  } as never;
  const violations = checkHierarchy([l1], {
    filteredOutPaths: new Set(['tla/L2_counter_service.tla']),
    fullPhaseByPath: new Map([['tla/L2_counter_service.tla', 2]]),
    phase: 1,
  });
  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain('属后续阶段');
  expect(violations[0]).toContain('phase=2');
  expect(violations[0]).not.toContain('不在 manifest 中');
});

it('still reports genuinely unregistered children as missing from the manifest', () => {
  const l1 = {
    id: 'L1_counter',
    level: 'L1',
    phase: 1,
    tlaPath: 'tla/L1_counter.tla',
    cfgPath: 'tla/L1_counter.cfg',
    parent: null,
    children: ['tla/L9_ghost.tla'],
    siblings: [],
  } as never;
  const violations = checkHierarchy([l1], {
    filteredOutPaths: new Set<string>(),
    fullPhaseByPath: new Map<string, number>(),
    phase: 1,
  });
  expect(violations[0]).toContain('不在 manifest 中');
});
```

- [ ] **步骤 3：运行测试确认失败**

运行：`npx vitest run --config config/vitest.config.ts tla-logic`
预期：FAIL——`checkHierarchy` 第二参数不存在（TS 报参数数量错误）或首条断言收到「不在 manifest 中」。

- [ ] **步骤 4：实现可选入参与措辞分支**

`w-model-dev/scripts/logic/tla-logic.ts` 的 `checkHierarchy` 改为：

```ts
export interface HierarchyOptions {
  /** 存在于 manifest 但被当前 phase 过滤掉的 tlaPath 集合（由调用方用「全量 ∖ 已校验」构造） */
  filteredOutPaths?: ReadonlySet<string>;
  /** 被过滤路径 → 其 manifest 声明 phase，用于措辞 */
  fullPhaseByPath?: ReadonlyMap<string, number>;
  /** 本次校验的 phase，用于措辞 */
  phase?: number;
}

export function checkHierarchy(specs: TlaSpec[], options: HierarchyOptions = {}): string[] {
  const filteredOut = options.filteredOutPaths ?? new Set<string>();
  const phaseByPath = options.fullPhaseByPath ?? new Map<string, number>();
  const currentPhase = options.phase;
  const laterPhaseHint = (p: string): string => {
    const declared = phaseByPath.get(p);
    const declaredText = declared === undefined ? '后续阶段' : `phase=${declared}`;
    const currentText = currentPhase === undefined ? '当前 phase' : `当前校验 phase=${currentPhase}`;
    return `属${declaredText}（${currentText} 不包含它）`;
  };
  // …原有实现不变；三处「不在 manifest 中」分支改为：
  //   const child = byPath.get(childPath);
  //   if (!child) {
  //     if (filteredOut.has(childPath)) {
  //       violations.push(`层次校验失败：规格 ${s.id} 的 child="${childPath}" ${laterPhaseHint(childPath)}，不算 manifest 缺失`);
  //     } else {
  //       violations.push(`层次校验失败：规格 ${s.id} 的 child="${childPath}" 不在 manifest 中（应填 manifest 中已登记规格的 tlaPath，或删除该失效 child 引用）`);
  //     }
  //   } else if (…)
  // parent 与 sibling 两处同款：命中 filteredOut 时报「属…阶段」，未命中保持原文案。
```

- [ ] **步骤 5：调用方传入过滤集合**

`tla-logic.ts` 约 943 行改为：

```ts
  const checkedPaths = new Set(checkedSpecs.map((s) => s.tlaPath));
  const filteredOutPaths = new Set(
    m.specs.map((s) => (s as TlaSpec).tlaPath).filter((p) => typeof p === 'string' && !checkedPaths.has(p)),
  );
  const fullPhaseByPath = new Map(
    m.specs
      .filter((s) => typeof (s as TlaSpec).tlaPath === 'string' && filteredOutPaths.has((s as TlaSpec).tlaPath))
      .map((s) => [(s as TlaSpec).tlaPath, (s as TlaSpec).phase] as const),
  );
  result.hierarchyViolations = checkHierarchy(checkedSpecs, { filteredOutPaths, fullPhaseByPath, phase });
```

- [ ] **步骤 6：运行测试确认通过**

运行：`npx vitest run --config config/vitest.config.ts tla-logic`
预期：PASS（含既有全部层次用例——缺省 `options` 时行为与文案不变）。

- [ ] **步骤 7：同步 `references/tla-plus.md`**

第 389 行「**层次一致性**：parent/child/sibling 双向、单 L1 根、层级单调。」句末补：

```markdown
   `children` 指向后续阶段规格（`spec.phase > --phase`）时，报错措辞为「属后续阶段（phase=N），当前校验 phase=M 不包含它」——这是校验范围收窄，不是 manifest 缺失。
```

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/logic/tla-logic.ts w-model-dev/scripts/__tests__/tla-logic.test.ts w-model-dev/references/tla-plus.md docs/skill-design-document_SSoT.md
git commit -m "fix(tla-logic): 层次校验区分后续阶段 child，措辞不再误报 manifest 缺失（S2）"
```

---

## 任务 3：F-1 —— RTM 覆盖率单一事实来源（规格 §5.3 修订 r1）

**文件：**
- 修改：`w-model-dev/scripts/logic/gate-logic.ts`（约 1329、1391–1420 行）
- 修改：`w-model-dev/scripts/logic/wm-status-logic.ts:128-135`
- 修改：`w-model-dev/scripts/cli/wm-status.ts:143`
- 修改：`w-model-dev/references/command-reference.md:359`、`w-model-dev/references/data-models.md:242`
- 修改：`docs/skill-design-document_SSoT.md`（RTM 口径）
- 测试：`w-model-dev/scripts/__tests__/wm-status-logic.test.ts`

- [ ] **步骤 1：写失败的测试（红）**

在 wm-status 的测试文件内追加（`buildStatusReport` 为既有导出，参数顺序以文件内既有用例为准）：

```ts
it('computes RTM coverage from trace fields, not from the display-only coverageStatus', () => {
  const rows = ['REQ-001', 'REQ-002', 'NFR-001', 'CON-001'].map((requirementId) => ({
    requirementId,
    description: 'd',
    designDoc: 'docs/x.md#1',
    codeModule: 'SD-001:src/counter.ts',
    unitTest: 'TC-UNIT-001',
    integrationTest: 'TC-INT-001',
    systemTest: 'TC-SYS-001',
    acceptanceTest: 'docs/y.md#UAT-001',
    coverageStatus: '完整',
  }));
  const report = buildStatusReport({ status: '项目完成' }, { rows }, null);
  expect(report.rtmCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
});

it('counts rows missing a trace field as uncovered', () => {
  const base = {
    description: 'd',
    designDoc: 'docs/x.md#1',
    unitTest: 'TC-UNIT-001',
    integrationTest: 'TC-INT-001',
    systemTest: 'TC-SYS-001',
    acceptanceTest: 'docs/y.md#UAT-001',
    coverageStatus: '完整',
  } as Record<string, string>;
  const rows = [
    { requirementId: 'REQ-001', codeModule: 'SD-001:src/counter.ts', ...base },
    { requirementId: 'REQ-002', codeModule: '', ...base },
    { requirementId: 'REQ-003', codeModule: 'SD-002:src/x.ts', ...base },
    { requirementId: 'REQ-004', codeModule: 'SD-003:src/y.ts', ...base },
  ];
  const report = buildStatusReport({ status: '项目完成' }, { rows }, null);
  expect(report.rtmCoverage).toEqual({ covered: 3, total: 4, percent: 75 });
});
```

（`status: '项目完成'` → `phase = 8`；第 1 条用例改前实际得到 `{covered: 0, total: 4, percent: 0}`。）

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run --config config/vitest.config.ts wm-status`
预期：FAIL——首条 `expected { covered: 0, … } to equal { covered: 4, … }`。

- [ ] **步骤 3：抽出并导出纯函数**

`w-model-dev/scripts/logic/gate-logic.ts` 追加导出函数（规则与现有内联实现逐字一致）：

```ts
/**
 * RTM 行级完整性 + 覆盖率计算（单一事实来源，2026-09-19）：check-artifact-gate 与 wm-status 共用。
 * 规则：REQ 行按当前阶段字段集（PHASE_TRACE_FIELDS[phase]）；NFR/CON 行按 description(+designDoc,+codeModule)；
 * coveragePercent = 完整行 / 总行（存在缺失时封顶 99）。coverageStatus 为展示字段，不参与计算。
 */
export function computeRtmTraceCoverage(
  rows: ReadonlyArray<unknown>,
  phase: number,
): { rowReasons: string[]; missingItems: Array<{ requirementId: string; fields: string[] }>; coveragePercent: number } {
  const phaseFields = PHASE_TRACE_FIELDS[phase] ?? REQUIRED_TRACE_FIELDS;
  const rowReasons: string[] = [];
  const missingItems: Array<{ requirementId: string; fields: string[] }> = [];
  const ids = new Set<string>();
  const list = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < list.length; index++) {
    const row = list[index] as Record<string, unknown> | null | undefined;
    if (!row || typeof row !== 'object') {
      rowReasons.push(`RTM 结构错误：rows[${index}] 非对象`);
      continue;
    }
    if (typeof row.requirementId !== 'string' || row.requirementId.trim() === '') {
      rowReasons.push(`RTM 结构错误：rows[${index}].requirementId 必须为非空字符串`);
      continue;
    }
    const requirementId = row.requirementId;
    if (ids.has(requirementId)) rowReasons.push(`RTM 结构错误：需求 ID 重复（${requirementId}）`);
    ids.add(requirementId);
    const isCrossCutting = requirementId.startsWith('NFR') || requirementId.startsWith('CON');
    const fieldsToCheck = isCrossCutting
      ? phase >= 5
        ? (['description', 'designDoc', 'codeModule'] as const)
        : (['description', 'designDoc'] as const)
      : phaseFields;
    const missing = fieldsToCheck.filter(
      (field) => typeof row[field] !== 'string' || (row[field] as string).trim() === '',
    );
    if (missing.length > 0) missingItems.push({ requirementId, fields: missing });
  }
  const totalRows = list.length;
  const coveredRows = totalRows - missingItems.length;
  let coveragePercent = totalRows > 0 ? Math.round((coveredRows / totalRows) * 100) : 0;
  if (missingItems.length > 0 && coveragePercent >= 100) coveragePercent = 99;
  return { rowReasons, missingItems, coveragePercent };
}
```

- [ ] **步骤 4：聚合门改为调用该函数（判定与 reasons 顺序不变）**

把约 1391–1420 行的内联循环与覆盖率计算替换为：

```ts
  const {
    rowReasons,
    missingItems,
    coveragePercent: computedCoveragePercent,
  } = computeRtmTraceCoverage(matrix.rows, phase);
  reasons.push(...rowReasons);

  for (const item of missingItems) {
    reasons.push(`RTM 追溯不完整：${item.requirementId} 缺少 ${item.fields.join('、')}`);
  }

  let coveragePercent = computedCoveragePercent;
  if (coveragePercent < 100) reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  if (matrix.rows.length === 0) reasons.push('RTM 无需求行');
```

删除原第 1329 行 `const phaseFields = …`（若无其他引用；`tsc` 的未使用局部变量会报错，据此确认）。

- [ ] **步骤 5：wm-status 改用同一函数**

`w-model-dev/scripts/logic/wm-status-logic.ts` 的覆盖率段改为：

```ts
  let rtmCoverage: StatusReport['rtmCoverage'] = null;
  if (rtm && Array.isArray(rtm.rows)) {
    const total = rtm.rows.length;
    const { missingItems, coveragePercent } = computeRtmTraceCoverage(rtm.rows, phase);
    rtmCoverage = { covered: total - missingItems.length, total, percent: coveragePercent };
  }
```

并加 import：`import { computeRtmTraceCoverage } from './gate-logic.js';`

- [ ] **步骤 6：改输出标签**

`w-model-dev/scripts/cli/wm-status.ts:143`：

```ts
      `RTM 覆盖率（按追溯字段重算）: ${report.rtmCoverage.covered}/${report.rtmCoverage.total}（${report.rtmCoverage.percent}%）`,
```

- [ ] **步骤 7：运行测试确认通过**

运行：`npx vitest run --config config/vitest.config.ts wm-status gate-logic artifact-gate`
预期：全绿（`gate-logic` / `artifact-gate` 全绿即证明抽取零行为变化）。

- [ ] **步骤 8：文档口径同步**

- `w-model-dev/references/command-reference.md:359`：「5. 输出项目名、阶段、需求数、测试用例数和 RTM 覆盖率。」句末补：**「RTM 覆盖率与 `check-artifact-gate.ts` 同源（`computeRtmTraceCoverage`，按追溯字段重算）；`coverageStatus` 仅为展示字段，不参与计算。」**
- `w-model-dev/references/data-models.md:242`：在既有「`coverageStatus` 仅用于展示…」句末补：**「`wm-status.ts` 与 `check-artifact-gate.ts` 共用 `logic/gate-logic.ts` 的 `computeRtmTraceCoverage(rows, phase)`，两者数值必然一致。」**
- `docs/skill-design-document_SSoT.md`：在 RTM/§10.5 相关条目补同款一句（grep `coverageStatus` 定位）。

- [ ] **步骤 9：Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/logic/wm-status-logic.ts w-model-dev/scripts/cli/wm-status.ts w-model-dev/scripts/__tests__/ w-model-dev/references/command-reference.md w-model-dev/references/data-models.md docs/skill-design-document_SSoT.md
git commit -m "fix(wm-status): RTM 覆盖率与聚合门同源（computeRtmTraceCoverage），不再按展示字段统计（F-1）"
```

---

## 任务 4：F-2 / F-3 / F-4 —— BDD 约定与解析基准文档化

**文件：**
- 修改：`w-model-dev/schemas/bdd-manifest.schema.json:28`
- 修改：`w-model-dev/references/bdd.md`（163 行附近、269–294 行附近）

- [ ] **步骤 1：schema description**

把 `basePath` 的 `description` 改为：

```json
"description": "本 manifest 内相对路径的解析基准（相对本文件所在目录）。注意两处消费方基准不同：check-bdd-model.ts 采用多路径回退（含 manifest 目录基准），check-artifact-gate.ts 仅按 resolve(projectDir, basePath) 解析；basePath='..' 在两处语义不一致，跨工具复用时须以两处门禁实测为准。"
```

- [ ] **步骤 2：`bdd.md` 三处补充**

在 `w-model-dev/references/bdd.md` 第 163 行表格下方补 F-3：

```markdown
> **D4 配对命名约定（2026-09-19）**：`@state-machine` 的值与 TLA+ `spec.id` 的配对是隐式约定「`SM-` 前缀之后的字符串 == `spec.id`」——`SM-L2_counter_service` ↔ `L2_counter_service`。前缀不一致（如 `SM_L2_…`）会导致 D4 报「no TLA+ snapshot」。
```

在第 294 行「When 事件 e1 …」示例后补 F-4：

```markdown
> **D6 事件提取约定（2026-09-19）**：D6 取 When 行**行末 ASCII 词**为事件名（正则 `.+?\b(\w+)\s*\)?\s*$`）。单 token 行（如 `When Inc`）会静默取不到事件，进而报成 end-state mismatch 而非「无事件」。When 行请写成「事件 + 目标」两段以上（如 `When Inc 计数器自增`）。
```

在第 269 行表格下方补 F-2：

```markdown
> **`basePath` 解析基准（2026-09-19）**：`check-bdd-model.ts` 采用多路径回退（含 manifest 目录基准），`check-artifact-gate.ts` 仅按 `resolve(projectDir, basePath)` 解析；`basePath: '..'` 在两处语义不同，跨工具复用 feature 路径时以两处门禁实测为准。
```

- [ ] **步骤 3：验证 schema 可解析且活体文档仍一致**

运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：exit 0（schema 变更不破坏 fixture 校验）。

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/schemas/bdd-manifest.schema.json w-model-dev/references/bdd.md
git commit -m "docs(bdd): basePath 解析基准差异 + SM 前缀配对与 When 行 token 约定（F-2/F-3/F-4）"
```

---

## 任务 5：可重放资产迁入 `eval/e2e/demo-assets/`

**文件：**
- 创建：`eval/e2e/demo-assets/build_workspace.py`、`run_trajectory.sh`、`run_negative_probes.sh`、`README.md`

- [ ] **步骤 1：确认 `.gitignore` 不误伤**

运行：`git check-ignore -v eval/e2e/demo-assets/README.md; echo "EXIT=$?"`
预期：无输出、`EXIT=1`（未忽略）。若被忽略，在 `.gitignore` 的 `eval/e2e/demo/` 规则后补 `!eval/e2e/demo-assets/`。

- [ ] **步骤 2：迁移装配器 + 运行时 SHA + `--reset`**

```bash
mkdir -p eval/e2e/demo-assets
cp eval/e2e/demo/build_workspace.py eval/e2e/demo-assets/build_workspace.py
cp eval/e2e/demo/run_trajectory.sh eval/e2e/demo-assets/run_trajectory.sh
```

改 `eval/e2e/demo-assets/build_workspace.py`：

1. 顶部参数区（替换第 670–671 行硬编码）：

```python
import argparse
_RP = subprocess.run(['git', '-C', ROOT, 'rev-parse', '--show-toplevel'],
                     capture_output=True, text=True, check=True).stdout.strip()
def _rev(ref):
    return subprocess.run(['git', '-C', _RP, 'rev-parse', ref],
                          capture_output=True, text=True, check=True).stdout.strip()
BASE_SHA = _rev(os.environ.get('REPLAY_BASE', 'HEAD~1'))
HEAD_SHA = _rev(os.environ.get('REPLAY_HEAD', 'HEAD'))
_SCOPE_DIFF = subprocess.run(['git', '-C', _RP, 'diff', '--name-only', f'{BASE_SHA}..{HEAD_SHA}'],
                             capture_output=True, text=True, check=True).stdout.split()
assert _SCOPE_DIFF, 'REPLAY_BASE..REPLAY_HEAD 差异为空：change-scope 需要非空 changedFiles'
```

2. `PHASE_FILES`（第 675 行）改为由真实差异派生：

```python
PHASE_FILES = {p: list(_SCOPE_DIFF) for p in (5, 6, 7, 8)}
```

3. 顶部加 `--reset` 前置门（破坏性路径唯一入口）：

```python
parser = argparse.ArgumentParser(description='重建 e2e 调测工作区')
parser.add_argument('--reset', action='store_true', help='先清空工作区（唯一破坏性路径）')
args = parser.parse_args()
if os.path.exists(os.path.join(ROOT, '.git')) and not args.reset:
    sys.exit('✗ 工作区根存在 .git：它会让 --scope 的 headRef 绑到 demo 自身 HEAD 而使 p5–p8 门禁过期。'
             '请先移走/删除该目录，或显式传 --reset 清空重建。')
```

- [ ] **步骤 3：改轨迹驱动（去绝对路径 + 参数化日志 + 计数自断言）**

`eval/e2e/demo-assets/run_trajectory.sh` 头部改为：

```bash
#!/usr/bin/env bash
# W-Model 8 阶段全流程调测轨迹驱动（O 角色模拟：状态经 wm-write 演化；门禁真实执行）
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
CLI="$REPO_ROOT/w-model-dev/scripts/cli"
WS="${WORKSPACE:-$REPO_ROOT/eval/e2e/demo}"
LOG="${LOG:-$WS/.replay/trajectory.log}"
mkdir -p "$(dirname "$LOG")"
cd "$WS"
```

`R()` 保持原样（只写 `$LOG`）。中间文件改为落在日志同目录（多工作区并发时不互相覆盖）：

- 头部 `mkdir -p "$(dirname "$LOG")"` 下一行加 `TMPD="$(dirname "$LOG")"`；
- 三处中间文件逐个替换：`/tmp/graph-stage.json` → `"$TMPD/graph-stage.json"`（第 20、21 行）、`/tmp/project-stage.json` → `"$TMPD/project-stage.json"`（第 31、37 行）、`/tmp/project-final.json` → `"$TMPD/project-final.json"`（第 120、126 行）。

结尾断言改为：

```bash
echo "" >> "$LOG"; echo "### 轨迹执行完毕 $(date -Iseconds) ###" >> "$LOG"
TOTAL=$(grep -cE "EXIT_CODE=" "$LOG")
NONZERO=$(grep -cE "EXIT_CODE=[^0]" "$LOG")
echo "TOTAL_GATE_RUNS=$TOTAL" >> "$LOG"
echo "NONZERO_EXIT_COUNT=$NONZERO" >> "$LOG"
[ "$TOTAL" -eq 119 ] || { echo "✗ 期望 119 条执行，实测 $TOTAL"; exit 1; }
[ "$NONZERO" -eq 0 ] || { echo "✗ 存在 $NONZERO 条非零退出（见 $LOG）"; exit 1; }
echo "✓ 119/119 exit 0（日志：$LOG）"
```

同时把脚本内三处 `/tmp/*.json` 中间文件改为 `"$(dirname "$LOG")/$(basename "$f")"` 形态，避免多工作区并发时互相覆盖。

- [ ] **步骤 4：新增 9 项负向探针脚本**

创建 `eval/e2e/demo-assets/run_negative_probes.sh`（完整内容，直接落地）：

```bash
#!/usr/bin/env bash
# 负向篡改探针：在绿色终态上做最小突变 → 断言被真实拦截 → 恢复 → 复验绿
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
CLI="$REPO_ROOT/w-model-dev/scripts/cli"
WS="${WORKSPACE:-$REPO_ROOT/eval/e2e/demo}"
LOG="${LOG:-$WS/.replay/negative-probes.log}"
mkdir -p "$(dirname "$LOG")"
cd "$WS"
FAILED=0
BACKUPS=()

backup() { cp "$1" "$1.probe-orig"; BACKUPS+=("$1"); }
restore_all() {
  [ "${#BACKUPS[@]}" -eq 0 ] && return 0
  for f in "${BACKUPS[@]}"; do [ -f "$f.probe-orig" ] && mv "$f.probe-orig" "$f"; done
  BACKUPS=()
}
trap restore_all EXIT

# JSON 变异：mutate <file> <python 语句，作用域内有 d（已解析对象）>
mutate() {
  local f="$1"; local code="$2"
  backup "$f"
  python - "$f" "$code" <<'PY'
import json, sys
p, code = sys.argv[1], sys.argv[2]
d = json.load(open(p, encoding='utf-8'))
exec(code)
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY
}

# JSONL 变异：mutate_jsonl <file> <python 语句，作用域内有 recs（记录列表）>
mutate_jsonl() {
  local f="$1"; local code="$2"
  backup "$f"
  python - "$f" "$code" <<'PY'
import json, sys
p, code = sys.argv[1], sys.argv[2]
recs = [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
exec(code)
open(p, 'w', encoding='utf-8').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in recs) + '\n')
PY
}

probe() { # probe <id> <cmd...>；断言 exit 1 且输出命中 $EXPECT
  local id="$1"; shift
  echo "[NP:$id] \$ $*" >> "$LOG"
  local out; out=$("$@" 2>&1); local c=$?
  printf '%s\n' "$out" | tail -4 >> "$LOG"
  echo "[NP:$id] EXIT_CODE=$c（期望 1；命中期望词「$EXPECT」）" >> "$LOG"
  if [ "$c" -ne 1 ]; then echo "✗ [$id] exit=$c 期望 1"; FAILED=1; return 1; fi
  printf '%s' "$out" | grep -q "$EXPECT" || { echo "✗ [$id] 未命中期望原因：$EXPECT"; FAILED=1; return 1; }
  echo "✓ [$id] 被拦截（命中「$EXPECT」）"
  return 0
}

: > "$LOG"
echo "### 负向篡改探针（9 项；绿色终态上最小突变，验后恢复）###" >> "$LOG"

# ---------- 1 签名链第 6 条 sigHash 置零 → R6 篡改检测 ----------
EXPECT='R6'
mutate_jsonl .w-model/signature-chain.jsonl "recs[5]['sigHash'] = 'sha256:' + '0' * 64"
probe sigchain-tamper npx tsx "$CLI/check-signature-chain.ts" .w-model/signature-chain.jsonl
restore_all

# ---------- 2 删除阶段 1 的 budget 闭环记录 → run-log R11 ----------
EXPECT='R11'
mutate_jsonl .w-model/run-log.jsonl "recs = [r for r in recs if r.get('runId') != 'p1-c-b']"
probe runlog-missing-closure npx tsx "$CLI/check-run-log.ts" .w-model/run-log.jsonl
restore_all

# ---------- 3 TLA 不变式真实违反 + manifest 自报全 true → 真实 TLC 拒绝 ----------
EXPECT='不变式违反'
backup tla/L2_counter_service.tla
python - <<'PY'
p = 'tla/L2_counter_service.tla'
src = open(p, encoding='utf-8').read()
needle = 'Inc == state = "zeroed"'
assert needle in src, '未找到 Inc 动作定义（工作区形态与预期不符）'
open(p, 'w', encoding='utf-8').write(
    src.replace('state\' = "counting"', 'state\' = "broken"', 1)
)
PY
mutate .w-model/tla-manifest.json "
for s in d['specs']:
    if s['id'] == 'L2_counter_service':
        s['syntaxChecked'] = True
        s['tlcChecked'] = True
        s['deadlockFree'] = True
        s['invariantsHold'] = True
"
probe tla-invariant-tlc npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=4 --graph=.w-model/ingestion/graph.json
restore_all

# ---------- 4 phase 形态错配（后期 manifest 做前期校验）→ 层次校验，措辞须指后续阶段 ----------
EXPECT='属后续阶段'
probe tla-phase-mismatch npx tsx "$CLI/check-tla-model.ts" .w-model/tla-manifest.json --phase=1
restore_all

# ---------- 5 删除 DD-001 → EXT-OUT 信息流边 → 黑洞 ----------
EXPECT='黑洞'
mutate .w-model/ingestion/graph.json "
d['edges'] = [e for e in d['edges'] if not (e.get('from') == 'DD-001' and e.get('to') == 'EXT-OUT')]
"
probe graph-blackhole npx tsx "$CLI/check-requirement-graph.ts" .w-model/ingestion/graph.json --phase=4
restore_all

# ---------- 6 Verifier 单轴 0.93 → 0.5 → R13 单轴下限 ----------
EXPECT='单轴下限'
mutate .w-model/verifier-outputs/phase-5.json "d['subCriteria'][0]['score'] = 0.5"
probe verifier-floor npx tsx "$CLI/check-verifier-output.ts" .w-model/verifier-outputs/phase-5.json
restore_all

# ---------- 7 REQ-001 的 codeModule 置空 → RTM 追溯 ----------
EXPECT='codeModule'
mutate .w-model/rtm.json "
for r in d['rows']:
    if r.get('requirementId') == 'REQ-001':
        r['codeModule'] = ''
"
probe rtm-codemodule npx tsx "$CLI/check-artifact-gate.ts" . --phase=5 --scope=.w-model/change-scope.p5.json
restore_all

# ---------- 8 CHECKPOINT 决策改泛化短句 → R2/R4 ----------
EXPECT='R2'
mutate_jsonl .w-model/run-log.jsonl "
for r in recs:
    if r.get('runId') == 'p3-cp':
        r['acknowledgedDecisions'] = ['好']
"
probe checkpoint-vague npx tsx "$CLI/check-checkpoint.ts" .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log
restore_all

# ---------- 9 cucumber 步骤改 failed → BDD D5 执行证据 ----------
EXPECT='D5'
mutate .w-model/bdd/reports/report.json "d['elements'][0]['steps'][0]['result']['status'] = 'failed'"
probe cucumber-failed npx tsx "$CLI/check-bdd-model.ts" .w-model/bdd-manifest.json --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=.w-model/bdd/reports/report.json
restore_all

# ---------- 恢复后回归复验 ----------
echo "" >> "$LOG"; echo "### 探针恢复后回归复验 ###" >> "$LOG"
for pair in "check-signature-chain.ts:.w-model/signature-chain.jsonl" "check-run-log.ts:.w-model/run-log.jsonl"; do
  s="${pair%%:*}"; a="${pair#*:}"
  out=$(npx tsx "$CLI/$s" "$a" 2>&1); c=$?
  echo "restore-check $s EXIT=$c" >> "$LOG"
  [ "$c" -eq 0 ] || { echo "✗ 恢复后 $s 未复绿（exit=$c）"; FAILED=1; }
done

if [ "$FAILED" -eq 0 ]; then
  echo "✓ 9/9 探针被拦截 + 恢复复绿（日志：$LOG）"
else
  echo "✗ 探针失败（日志：$LOG）"; exit 1
fi
```

> 断言契约：**exit 1 + 命中期望原因词**双条件，不接受「只要 exit 1 就算过」——这正是本轮审计发现的归因错误的根源。第 4 条探针期望词 `属后续阶段` 依赖任务 2（S2）已合入。

- [ ] **步骤 5：README**

创建 `eval/e2e/demo-assets/README.md`：

````markdown
# e2e 调测资产（counter-api 8 阶段轨迹）

> 来源：2026-09-19 全流程调测（报告留在未跟踪目录 `docs/debug/2026-09-19-wm-8phase-full-debug/`）。
> 本目录是**受跟踪**的可重放资产；工作区本身 `eval/e2e/demo/` 仍为 gitignored 瞬态目录。

## 前置条件

- Node ≥ 20 + 仓库根 `npm install`（tsx runtime）
- Python 3（装配器与探针的 JSON 变异）
- Java 17 + `w-model-dev/tools/tla2tools.jar`（真实 SANY/TLC）
- Git Bash / WSL（Windows）或任意 bash

## 重建 + 重放

```bash
cd eval/e2e/demo-assets
python build_workspace.py --reset        # 重建工作区（唯一破坏性路径）
bash run_trajectory.sh                   # 期望末行：✓ 119/119 exit 0
bash run_negative_probes.sh              # 期望末行：✓ 9/9 探针被拦截 + 恢复复绿
```

`change-scope` 的 `baseRef/headRef` 取运行时 `HEAD~1..HEAD`（可用 `REPLAY_BASE` / `REPLAY_HEAD` 覆盖），`changedFiles` 取该区间真实差异；`codegraph-queries` 与 `openspec/changes/` 按同一文件列表生成，故 scope 校验恒成立。

## 已实测的坑（务必遵守）

1. **工作区里不能有 `.git`**：残留 `eval/e2e/demo/.git` 会让 `--scope` 的 `headRef` 绑到 demo 自身 HEAD，p5–p8 的 artifact-gate 全部报「headRef 过期」（实测只剩 114/119）。脚本会在这种情形 fail-closed 退出，只有 `--reset` 能清空重建。
2. **禁止并发写者**：重放期间不要跑其他 vitest / `npm run prepush`，也不要往 `docs/debug/` 写文件——`exit2-failure-atomicity` 对并发写盘敏感，会产生伪失败并争用 `coverage/`。
3. **超时预算**：聚合门以子进程调用 TLA 模型检查（真实 TLC），子进程预算为 `EXEC_LIMITS.modelCheckChildTimeoutMs`（360s）；机器负载高时可重跑，不要把它误判为门禁缺陷。
4. **九项探针的期望命中词**写死在 `run_negative_probes.sh` 的 `EXPECT`；改动门禁消息文案时必须同步更新，否则探针会以「未命中期望原因」失败。
````

- [ ] **步骤 6：冒烟（不重建，仅参数校验）**

运行：`bash eval/e2e/demo-assets/run_trajectory.sh --help 2>/dev/null; bash -n eval/e2e/demo-assets/run_trajectory.sh && bash -n eval/e2e/demo-assets/run_negative_probes.sh && python -m py_compile eval/e2e/demo-assets/build_workspace.py && echo "SYNTAX_OK"`
预期：`SYNTAX_OK`（语法自检通过；真实重放放在任务 6）。

- [ ] **步骤 7：Commit**

```bash
git add eval/e2e/demo-assets/
git commit -m "feat(eval): 交付 e2e 可重放资产（装配器/轨迹驱动/9 项负向探针 + README）"
```

---

## 任务 6：用交付资产重放取证

**文件：**
- 创建：`eval/e2e/2026-09-19-8phase-debug-replay.md`

- [ ] **步骤 1：确认当前无并发写者**

运行：`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'vitest|prepush' } | Select-Object ProcessId"`
预期：空（无其他测试进程）。

- [ ] **步骤 2：重建 + 重放**

```bash
cd eval/e2e/demo-assets
python build_workspace.py --reset
bash run_trajectory.sh
```

预期末行：`✓ 119/119 exit 0`（日志 `eval/e2e/demo/.replay/trajectory.log`）。
若工作区残留在上一次状态导致 `--scope` 过期：`--reset` 会重建；若仍失败，按 README「已实测的坑」第 1 条检查 `eval/e2e/demo/.git`。

- [ ] **步骤 3：跑负向探针**

```bash
bash run_negative_probes.sh
```

预期末行：`✓ 9/9 探针被拦截 + 恢复复绿`。
若某条探针报「未命中期望原因」，按 README 第 4 条核对 `EXPECT` 与门禁实际文案（文案改动即断言改动），不要放宽为「只要 exit 1 就算过」。

- [ ] **步骤 4：写重放记录**

创建 `eval/e2e/2026-09-19-8phase-debug-replay.md`，填入本次实测数字（下面是模板 + 已核验的期望值；实测值以脚本输出为准）：

```markdown
# 8 阶段 e2e 重放记录（2026-09-19）

> 资产：`eval/e2e/demo-assets/`（受跟踪）· 工作区：`eval/e2e/demo/`（gitignored，`--reset` 重建）
> 归档对照：`docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/trajectory.log`（未跟踪审计产物）

## 环境
- 日期 / 主机 / node / Java / HEAD：`date -Iseconds` · `uname -srm`（或 `ver`）· `node --version` · `java -version 2>&1 | head -1` · `git rev-parse HEAD`
- 实测值：<上方五条命令的输出逐条填入>

## 结果
| 项 | 期望 | 实测 |
| --- | --- | --- |
| 轨迹执行条数 `TOTAL_GATE_RUNS` | 119 | 119 |
| 非零退出 `NONZERO_EXIT_COUNT` | 0 | 0 |
| 其中门禁脚本 / wm-write / wm-status | 89 / 29 / 1 | 89 / 29 / 1 |
| 负向探针 | 9/9 被拦截 + 恢复复绿 | 9/9 |
| `wm-status` RTM 覆盖率 | 4/4（100%，按追溯字段重算） | 4/4（100%） |

## 与归档的差异（如实列出）
1. 门禁消息措辞随 S2 修复变化：`--phase=1` 校验后期 manifest 时报「属后续阶段（phase=2）…」而非「不在 manifest 中」——归档日志保留旧文案（历史快照），资产重放为新文案。
2. `wm-status` 的 RTM 覆盖率由 0/4 变为 4/4（F-1 修复：不再按展示字段统计）。
3. 归档日志的 8 项探针含一条归因错误（`NP:tla-invariant-falsify` 实际为 phase 形态错配），本轮拆分为第 3、4 两条探针。
```

- [ ] **步骤 5：Commit**

```bash
git add eval/e2e/2026-09-19-8phase-debug-replay.md
git commit -m "docs(eval): 8 阶段 e2e 重放记录（119/119 + 9/9 探针）"
```

---

## 任务 7：报告订正 P1–P9（`docs/debug/`，不提交）

**文件：**
- 修改：`docs/debug/2026-09-19-wm-8phase-full-debug/README.md`
- 修改：`docs/debug/2026-09-19-wm-8phase-full-debug/EVIDENCE_GRAPH.md`
- 追加：`docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/negative-probes-rerun.log`（复制自 `eval/e2e/demo/.replay/negative-probes.log`）

- [ ] **步骤 1：P1（TLA 探针归因）**

README §2.4 表格第 3 行改为两行：

```markdown
| 后期 manifest 做前期校验（`--phase=1` + p4 形态 manifest） | check-tla-model 层次校验（child 属后续阶段，TLC 未参与） |
| TLA 不变式真实违反 + manifest 自报字段伪造为 true | check-tla-model 真实 TLC 复核（`invariantViolations` 非空） |
```

`EVIDENCE_GRAPH.md` L2.6 的「伪报不变式」改为「真实 TLC 复核拒绝伪造自报（原探针实为 phase 形态错配，已拆分并新增真探针）」，并把探针计数 `8` 改为 `9`。

- [ ] **步骤 2：P2（执行条数口径）**

`README.md` 第 15、16、54、89、102、140 行与 `EVIDENCE_GRAPH.md:54`：把「119 次门禁执行」「119 步 8 阶段轨迹」统一改为「119 次命令执行（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status），全部 exit 0」。

- [ ] **步骤 3：P4/P5（计数）**

- `README.md:90` 与 `EVIDENCE_GRAPH.md:55`：「32 次」改为「29 次（`.bak` 按 `keepBackups=5` 每目标轮转，盘上现存 19 个）」。
- `README.md:46`：「48 条签名链」改为「49 条签名链」。

- [ ] **步骤 4：P6（探针可追溯）**

`EVIDENCE_GRAPH.md:66`（L5.3）改为：「负向样本选择可追溯：突变与期望写死在 `eval/e2e/demo-assets/run_negative_probes.sh`（本轮交付，受跟踪），非自造夹具冒充」。

- [ ] **步骤 5：P7/P8/P9（措辞）**

- `README.md:38`：「阶段 1（图谱/覆盖/BDD/Verifier）」改为「阶段 1（图谱/覆盖/BDD；Verifier 见阶段 5 与 6-8 两节）」，并补「装配迭代史仅阶段 1 的 5 条命令留档于 `logs/e2e/phase-1.log`」。
- `EVIDENCE_GRAPH.md:64`：「8 个日志文件」改为「12 个日志文件（logs/ 7 + logs/e2e/ 5）」。
- `README.md:117`（F-7）：「工作区无残留」改为「工作树无残留；误提交对象 `a5ed70eb` 仍可经 reflog 到达（内容为报告 4 个文件），未推送」。

- [ ] **步骤 6：P3（可重放指引）**

`README.md` §五「可复核指南」的重放段改为：

```bash
# e2e 轨迹重放（资产受跟踪；工作区为 gitignored 瞬态目录）：
cd eval/e2e/demo-assets && python build_workspace.py --reset && bash run_trajectory.sh   # 期望 119/119
bash run_negative_probes.sh                                                              # 期望 9/9
```

并在该节补一句「`eval/e2e/demo-assets/README.md` 记录了两个实测坑：工作区不得残留 `.git`、重放期间禁止并发写者」。

- [ ] **步骤 7：归档新探针日志 + 自检**

```bash
mkdir -p docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e
cp eval/e2e/demo/.replay/negative-probes.log docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/negative-probes-rerun.log
grep -n "119 次门禁\|32 次\|48 条签名链\|8 个日志文件" docs/debug/2026-09-19-wm-8phase-full-debug/README.md docs/debug/2026-09-19-wm-8phase-full-debug/EVIDENCE_GRAPH.md
```

预期：`grep` 无输出（旧措辞已清零）。

- [ ] **步骤 8：不做提交**

`docs/debug/` 保持未跟踪（先例：`CHANGELOG.md:21` 与 `docs/superpowers/plans/2026-09-18-leftovers-closeout.md:1450` 均声明该目录不随提交交付）。运行 `git status --short` 确认仅 `?? docs/debug/`。

---

## 任务 8：CHANGELOG + 终局验收 + push

**文件：**
- 修改：`CHANGELOG.md`

- [ ] **步骤 1：CHANGELOG 子节**

在 `CHANGELOG.md` 的 `## [42.2.1] - 2026-09-01` 段内、`### 全部遗留事项收口（…）` 之前插入：

```markdown
### 调测报告订正与技能包诊断修复（2026-09-19，来源：`docs/debug/2026-09-19-wm-8phase-full-debug/`）

> 该目录为**未跟踪审计产物，不随本次提交交付**（同 2026-09-18 外部调测先例）。规格与计划见 `docs/superpowers/specs/2026-09-19-debug-report-corrections-design.md` 与 `docs/superpowers/plans/2026-09-19-debug-report-corrections.md`。版本保持 42.2.1，**不 bump**。
> 验收依据：`npm run prepush` **19 项全量** + 交付资产重放 `119/119 exit 0` + 负向探针 `9/9` 被拦截（记录见 `eval/e2e/2026-09-19-8phase-debug-replay.md`）。

- **S1（聚合门子进程预算与诊断）**：`EXEC_LIMITS` 新增 `modelCheckChildTimeoutMs`（360s = SANY 60 + TLC 300 + 余量），`artifact-gate-assets.ts` 三处 `runSync` 显式传入——原实现落回 15s 默认值，负载下真实 TLC 子进程被杀只报「退出码 unknown：」（复核会话实测复现）；`appendProcessViolation` 现报出信号名与超时语义。
- **S2（层次校验措辞）**：`checkHierarchy` 增可选 `filteredOutPaths/fullPhaseByPath/phase`，被 `--phase` 过滤掉的 child 报「属后续阶段（phase=N），当前校验 phase=M 不包含它」，不再误报「不在 manifest 中」——该误报是审计报告把「phase 形态错配」当成「不变式伪造被 TLC 拒绝」的成因。判定结果不变（仍拦截）。
- **F-1（RTM 覆盖率单一事实来源）**：`gate-logic.ts` 抽出并导出 `computeRtmTraceCoverage(rows, phase)`，`wm-status` 与 `check-artifact-gate` 共用；原 `wm-status` 按展示字段字面量 `'100%'` 统计，导致全行 `coverageStatus='完整'` 的矩阵显示 0/4（artifact-gate 判 100%）——现同源，实测 4/4（100%）。
- **F-2/F-3/F-4（BDD 约定文档化）**：`bdd-manifest.schema.json` 的 `basePath` description 写明 `check-bdd-model` 与 `check-artifact-gate` 的解析基准差异；`references/bdd.md` 补 D4 的 `SM-` 前缀配对约定、D6 的 When 行行末 token 提取约定、`basePath` 注记。
- **可重放资产交付**：`eval/e2e/demo-assets/`（装配器 + 轨迹驱动 + 9 项负向探针 + README）受跟踪；装配器改为运行时取 `REPLAY_BASE..REPLAY_HEAD` 真实差异、轨迹驱动去绝对路径并内置 `119/0` 计数自断言、工作区残留 `.git` 时 fail-closed（实测该残留会让 p5–p8 的 `--scope` 过期、只剩 114/119）。
- **报告订正（未跟踪目录内）**：9 项（P1–P9）——探针归因拆分为「phase 错配」与「真实 TLC 拒绝伪造自报」两条、执行条数口径改为 89 门禁 + 29 wm-write + 1 wm-status、签名链 48→49、写入 32→29、日志文件 8→12、阶段 1 无 Verifier、F-7 残留措辞。
```

- [ ] **步骤 2：全量验收（无并发写者，按序执行）**

```bash
npm run self-test                                  # 期望 358/358
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts   # 期望 exit 0（48 探针 0 失败）
npx tsx w-model-dev/scripts/cli/check-pollution.ts --project=.   # 期望 exit 0（clean）
git status --short                                  # 期望仅 ?? docs/debug/
npm run prepush                                     # 唯一验收依据：19/19 全绿，末行「全部门禁通过，允许推送 ✓」
```

预期：`npm run prepush` 19 项全绿（耗时经验值约 30 分钟；第 12 项 vitest 全量 + coverage、第 13 项规则层口径、第 14 项 npm audit、第 15 项 docs-consistency 同次受控运行）。
若 `docs-consistency` 报 `[vitest-tests] … 无法采集`：先确认没有第二个写者，再重跑 prepush（该项走 env 快路径，不触发自采集）。

- [ ] **步骤 3：提交 CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 2026-09-19 调测收口（S1/S2/F-1~F-4 + 可重放资产 + 报告订正）"
```

- [ ] **步骤 4：核对待推送面**

```bash
git log --oneline origin/main..HEAD
```

预期：22 个提交 = 既有 15 个未推 + 本轮 7 个（任务 1、2、3、4、5、6、8 各一个）。逐条核对下面 7 个 message：

```
fix(artifact-gate): 模型检查子进程显式预算 + 超时/信号诊断（S1）
fix(tla-logic): 层次校验区分后续阶段 child，措辞不再误报 manifest 缺失（S2）
fix(wm-status): RTM 覆盖率与聚合门同源（computeRtmTraceCoverage），不再按展示字段统计（F-1）
docs(bdd): basePath 解析基准差异 + SM 前缀配对与 When 行 token 约定（F-2/F-3/F-4）
feat(eval): 交付 e2e 可重放资产（装配器/轨迹驱动/9 项负向探针 + README）
docs(eval): 8 阶段 e2e 重放记录（119/119 + 9/9 探针）
docs(changelog): 2026-09-19 调测收口（S1/S2/F-1~F-4 + 可重放资产 + 报告订正）
```

- [ ] **步骤 5：push**

```bash
git push origin main
```

预期：推送成功，`git status -sb` 显示 `## main...origin/main`（无 ahead/behind）。
若被 Mimosa git 门禁拦截：停止并回报用户（不绕过）。

- [ ] **步骤 6：收尾自检**

```bash
git status --short          # 期望仅 ?? docs/debug/
npx tsx w-model-dev/scripts/cli/check-pollution.ts --project=.   # 期望 exit 0
```

---

## 自检记录（写计划者按规格逐条核对）

| 规格条目 | 对应任务 |
| --- | --- |
| §3.1 P1 探针拆分 + 真探针 | 任务 5 步骤 4（探针 3/4）、任务 6 步骤 3、任务 7 步骤 1 |
| §3.2 P2/P4/P5/P6/P7/P8/P9 | 任务 7 步骤 2–5 |
| §3.2 P3 重放指引 | 任务 6、任务 7 步骤 6 |
| §4 资产交付（改造点 1–5） | 任务 5（`--reset` fail-closed、运行时 SHA、参数化日志、内置断言、README 坑） |
| §4 记录文件 | 任务 6 步骤 4 |
| §5.1 S1 | 任务 1 |
| §5.2 S2 | 任务 2 |
| §5.3 F-1（修订 r1） | 任务 3 |
| §5.4 F-2 | 任务 4 步骤 1、2 |
| §5.5 F-3/F-4 | 任务 4 步骤 2 |
| §1 AC3 红→绿、不新增测试文件 | 任务 1/2/3 用例均写在既有文件内 |
| §6 步骤 0（提交通路） | 已在规格提交时验证通过（`e5e1412b`） |
| §6 提交拆分 4 个 | 任务 1、2、3+4、5+6、8（实际 7 个主题提交，粒度更细，不合并） |
| §6 终局验收 | 任务 8 步骤 2 |
| §2 Out of scope（F-5 不改 / logs 原样 / docs/debug 不入库） | 任务 7 步骤 8 + 自检 grep |
