# 全部遗留事项收口（B/J1/N/O + 推送）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 关闭 2026-09-17 审计挂起的三项（B coverage 分母 / N code-health 端到端 / O logic 负载性）并实现 J1（约束 #11 闭环五脚本机器核验），最终以 19 项 prepush 全绿收口并推送 main。

**架构：** B 用「自管确定性门」绕开 vitest exclude 之谜——新 logic+CLI 对直接解析 `coverage-final.json`（istanbul 格式）按 logic+lib 白名单分母重算四指标，pre-push 增第 13 项（18→19）。J1 在 `checkRunLog` 内新增阻断级 R11（有 checkpoint 放行的阶段须有五条闭环 gate 记录且早于放行），既有 fixture 逐条真实迁移、不设豁免。N 先做 7 个 CLI 语义审计再补真实 git 端到端测试（ledger→apply 三模式→回滚→archive produce/verify 边界 + phase1 真实仓）。O 以 `l0-rule-loadbearing` 的 GREEN/RED/STRIPPED 三态为模板，新增通用剥离 helper（相对 import 重写为绝对 file URL），对实测覆盖率最低的 5 个 logic 文件建三态测试。

**技术栈：** TypeScript + tsx、vitest（v8 coverage + json reporter）、istanbul-lib-coverage JSON 格式（手写计数，不引新 devDep）、Node `fs`/`path`、Git CLI、`.githooks/pre-push`（bash）。

**规格：** [docs/superpowers/specs/2026-09-18-leftovers-closeout-design.md](../specs/2026-09-18-leftovers-closeout-design.md)（已批准）。

**贯穿纪律：** 每任务收口跑该任务触及的定向测试；全部任务完成后的最终审查必须跑全量 `npm run prepush`（届时 19 项），不得以 `test:affected` 快速车道作为验收依据。全程不得中断运行中的 prepush（孤儿 vitest 会污染 `coverage/`；若中断，先 `rm -rf coverage` 再重跑）。

---

## 0. 文件清单与职责

**创建：**

| 文件 | 职责 |
| --- | --- |
| `w-model-dev/scripts/logic/coverage-scope-logic.ts` | istanbul-lib-coverage JSON → logic+lib 白名单分母四指标（纯函数，供 CLI 与 O 选文件复用） |
| `w-model-dev/scripts/cli/check-coverage-scope.ts` | 读 `coverage/coverage-final.json`，输出 `COVERAGE_SCOPE_JSON`，阈值 flag 不达 exit 1，输入错误 exit 2 |
| `w-model-dev/scripts/samples/coverage-scope/valid.json` | 2 文件（logic+lib 各一）的最小 istanbul 格式样本 |
| `w-model-dev/scripts/__tests__/check-coverage-scope.test.ts` | 新 CLI 子进程三态测试（exit 0/1/2 + 重复/未知 flag） |
| `w-model-dev/scripts/samples/run-log/bad-r11-missing-closure.jsonl` | R11 负向：缺一条闭环脚本记录 |
| `w-model-dev/scripts/samples/run-log/bad-r11-late-closure.jsonl` | R11 负向：闭环记录晚于 checkpoint 放行 |
| `w-model-dev/scripts/__tests__/code-health-e2e.test.ts` | 真实 git 工作区全链路（ledger→apply dry-run/patch/commit→回滚→archive produce/verify→phase1） |
| `w-model-dev/scripts/__tests__/helpers/code-health-fixtures.ts` | 从 code-health-cli.test.ts 抽出的共享 helper（tempRoot/createTempGitRepository/loadApplyFixture/bindRevision/writeJson/runCli/gitStatus/gitHead） |
| `w-model-dev/scripts/__tests__/helpers/strip-rule.ts` | 通用「唯一锚点定位 + 大括号配平整块删除 + 相对 import 重写绝对 file URL + tmpdir 副本」剥离器 |
| `w-model-dev/scripts/__tests__/<file>-rule-loadbearing.test.ts` × 5 | 每个目标 logic 文件一个三态测试文件（文件名在任务 9 实测后定） |

**修改：**

| 文件 | 变更 |
| --- | --- |
| `config/vitest.config.ts` | coverage 加 `reporter: ['text', 'json']`；SUBPROCESS_TEST_FILES 加 2 个新子进程测试文件；coverage 注释改写为双口径说明 |
| `.githooks/pre-push` | 第 12 项后插入第 13 项（check-coverage-scope），后续注释编号顺延至 19；item 1 注释样本数按最终 self-test 计数更新 |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts:248` | `prePushCount: 18` → `19`（连带 1643-1646 注释文字） |
| `w-model-dev/scripts/logic/run-log-logic.ts` | `RUN_LOG_CLOSURE_SCRIPTS` 常量 + R11 校验 + `RunLogCheckResult.closure` 计数 |
| `w-model-dev/scripts/cli/check-run-log.ts` | RUN_LOG_JSON 摘要增 `r11` 键（仿 `r10` 的条件展开） |
| `w-model-dev/scripts/cli/self-test.ts` | RUN_LOG_CASES 更新与新增；COVERAGE_SCOPE 逻辑层新用例节 |
| `w-model-dev/scripts/samples/run-log/*.jsonl`（11 个含 checkpoint 的既有 fixture） | 每个含 checkpoint 放行的阶段补 5 条闭环 gate 记录 |
| `w-model-dev/scripts/__tests__/code-health-cli.test.ts` | 改用共享 helper（行为不变） |
| `w-model-dev/scripts/__tests__/README.md` | 登记全部新增测试文件（docs-consistency 双向差集强制） |
| `w-model-dev/scripts/samples/README.md` | 矩阵声明 `coverage-scope/` 子目录 |
| `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md` | check-coverage-scope 的 exit-2 负向登记行 |
| 文档：`AGENTS.md`（§1「18 项」/§8 两行/「45 个 exit-2」等计数）、`README.md`（31/60/217 三处「18 项」）、`CONTRIBUTING.md`（84/86/212/230）、`SKILL.md`（资源计数、约束 #11 行）、`hard-constraints.md`（#11 边界注替换）、`command-reference.md`、`data-models.md`、`subagent-delegation.md`（dispatch-matrix 登记）、SSoT（§10C/§10D） | 计数与语义同步（以 `check-docs-consistency` 的违规输出为完备性 oracle） |

**明确不改：** `origin/main` 与历史提交、`coverage.thresholds`（75/65/85/75 全分母地板保留）、vitest `include`（维持现状，本轮不与 exclude 机制纠缠）、`docs/changes/archive/**`。

---

## 任务 1：B-logic 层 coverage-scope-logic.ts

**文件：**
- 创建：`w-model-dev/scripts/logic/coverage-scope-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/coverage-scope-logic.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// w-model-dev/scripts/__tests__/coverage-scope-logic.test.ts
import { describe, expect, it } from 'vitest';
import {
  computeCoverageScope,
  CoverageScopeFormatError,
  type CoverageScopeThresholds,
} from '../logic/coverage-scope-logic.js';

const ZERO: CoverageScopeThresholds = { statements: 0, branches: 0, functions: 0, lines: 0 };

function entry(partial: {
  s: number[]; f: number[]; b: number[][]; stmtLines: Array<[number, number]>;
}): unknown {
  const statementMap = Object.fromEntries(
    partial.stmtLines.map(([line], i) => [String(i), { start: { line }, end: { line } }]),
  );
  return {
    s: Object.fromEntries(partial.s.map((v, i) => [String(i), v])),
    f: Object.fromEntries(partial.f.map((v, i) => [String(i), v])),
    b: Object.fromEntries(partial.b.map((arr, i) => [String(i), arr])),
    statementMap,
    branchMap: {}, fnMap: {},
  };
}

describe('computeCoverageScope', () => {
  it('只统计 logic/lib 路径，cli 与 application 层忽略；指标按 istanbul s/b/f 与 statementMap 行集合计算', () => {
    const report = {
      'D:\\repo\\w-model-dev\\scripts\\logic\\foo-logic.ts': entry({ s: [1, 0], f: [1], b: [[1, 0]], stmtLines: [[10, 10], [11, 11]] }),
      'D:\\repo\\w-model-dev\\scripts\\lib\\cli-error.ts': entry({ s: [1], f: [0], b: [], stmtLines: [[5, 5]] }),
      'D:\\repo\\w-model-dev\\scripts\\cli\\wm-status.ts': entry({ s: [0], f: [0], b: [], stmtLines: [[1, 1]] }),
    };
    const r = computeCoverageScope(report, ZERO);
    expect(r.fileCount).toBe(2);
    expect(r.files.map((f) => f.file)).toEqual(['logic/foo-logic.ts', 'lib/cli-error.ts']);
    // logic 文件：stmts 1/2=50.00；funcs 1/1=100.00；branches 1/2=50.00；lines 1/2=50.00
    expect(r.files[0]).toMatchObject({
      statements: { covered: 1, total: 2, pct: 50 },
      functions: { covered: 1, total: 1, pct: 100 },
      branches: { covered: 1, total: 2, pct: 50 },
      lines: { covered: 1, total: 2, pct: 50 },
    });
    // 合并：stmts 2/3、funcs 1/2、branches 1/2、lines 2/3
    expect(r.totals).toEqual({ statements: 66.67, branches: 50, functions: 50, lines: 66.67 });
  });

  it('阈值不达时 passed=false 且 failures 逐指标列出实际值与阈值', () => {
    const report = {
      'D:/repo/w-model-dev/scripts/logic/foo.ts': entry({ s: [1, 0], f: [1], b: [[1]], stmtLines: [[1, 1], [2, 2]] }),
    };
    const r = computeCoverageScope(report, { statements: 75, branches: 65, functions: 85, lines: 75 });
    expect(r.passed).toBe(false);
    expect(r.failures.some((m) => m.includes('statements') && m.includes('50') && m.includes('75'))).toBe(true);
  });

  it('缺 s/b/f/statementMap 键或行号非数字 → CoverageScopeFormatError（fail-loud）', () => {
    expect(() => computeCoverageScope({ 'D:/x/w-model-dev/scripts/logic/a.ts': { s: {} } }, ZERO))
      .toThrow(CoverageScopeFormatError);
    expect(() => computeCoverageScope('not-an-object', ZERO)).toThrow(CoverageScopeFormatError);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts coverage-scope-logic`
预期：FAIL，报错「Cannot find module '../logic/coverage-scope-logic.js'」。

- [ ] **步骤 3：编写实现**

```ts
// w-model-dev/scripts/logic/coverage-scope-logic.ts
/**
 * 规则层覆盖口径计算（coverage-final.json → logic+lib 白名单分母）。
 *
 * 背景（2026-09-17 审计 B 项）：vitest v8 provider 对被 import 的文件总是出报告，
 * `coverage.include` 只影响未触及文件，导致全量运行分母混入 cli/application/infrastructure 层；
 * 两种 `exclude` 写法全量运行均不生效（机制未查明）。本模块绕开报告器行为：
 * 直接对 istanbul-lib-coverage 格式（v8 provider 的 coverage/coverage-final.json）
 * 按白名单前缀重算四指标，供 check-coverage-scope.ts 门禁与 O 选文件复用。
 *
 * 计数口径（istanbul 惯例）：
 *   statements = s 值 > 0 的键数 / s 键总数；
 *   functions  = f 值 > 0 的键数 / f 键总数；
 *   branches   = b 值数组中 > 0 的元素数 / 数组元素总数；
 *   lines      = statementMap 中出现过的行集合为分母，其上有任一 s>0 语句的行集合为分子。
 * 合并值 = 各文件 covered/total 求和后再算百分比（加权，不是百分比平均）。
 */

export class CoverageScopeFormatError extends Error {
  constructor(detail: string) {
    super(`coverage-final.json 格式不符（istanbul-lib-coverage 期待 s/b/f/statementMap）: ${detail}`);
    this.name = 'CoverageScopeFormatError';
  }
}

export interface CoverageScopeThresholds { statements: number; branches: number; functions: number; lines: number }
export interface CoverageScopeMetrics { covered: number; total: number; pct: number }
export interface CoverageScopeFileReport {
  /** 仓库相对显示路径（正斜杠，小写盘符差异消除后取 w-model-dev 起的后缀） */
  file: string;
  statements: CoverageScopeMetrics; branches: CoverageScopeMetrics; functions: CoverageScopeMetrics; lines: CoverageScopeMetrics;
}
export interface CoverageScopeReport {
  fileCount: number;
  totals: CoverageScopeThresholds;
  files: CoverageScopeFileReport[];
  failures: string[];
  passed: boolean;
}

function isIncluded(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, '/').toLowerCase();
  return norm.includes('/w-model-dev/scripts/logic/') || norm.includes('/w-model-dev/scripts/lib/');
}

function toDisplayFile(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/');
  const idx = norm.toLowerCase().indexOf('/w-model-dev/scripts/');
  return idx < 0 ? norm : norm.slice(idx + 1);
}

function pct(covered: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((covered * 100) / total * 100) / 100;
}

function asRecord(v: unknown, what: string, file: string): Record<string, unknown> {
  if (v === undefined || v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new CoverageScopeFormatError(`${file} 缺 ${what}`);
  }
  return v as Record<string, unknown>;
}

function metrics(covered: number, total: number): CoverageScopeMetrics {
  return { covered, total, pct: pct(covered, total) };
}

function fileMetrics(file: string, raw: unknown): CoverageScopeFileReport {
  const cv = asRecord(raw, '条目对象', file);
  const s = asRecord(cv.s, 's', file);
  const f = asRecord(cv.f, 'f', file);
  const b = asRecord(cv.b, 'b', file);
  const statementMap = asRecord(cv.statementMap, 'statementMap', file);

  let sCov = 0; let sTot = 0; let fCov = 0; let fTot = 0; let bCov = 0; let bTot = 0;
  for (const v of Object.values(s)) {
    if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} s 值非数字`);
    sTot += 1; if (v > 0) sCov += 1;
  }
  for (const v of Object.values(f)) {
    if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} f 值非数字`);
    fTot += 1; if (v > 0) fCov += 1;
  }
  for (const arr of Object.values(b)) {
    if (!Array.isArray(arr)) throw new CoverageScopeFormatError(`${file} b 值非数组`);
    for (const v of arr) {
      if (typeof v !== 'number') throw new CoverageScopeFormatError(`${file} b 元素非数字`);
      bTot += 1; if (v > 0) bCov += 1;
    }
  }
  const lineTotal = new Set<number>(); const lineCovered = new Set<number>();
  for (const [id, loc] of Object.entries(statementMap)) {
    const line = (loc as { start?: { line?: unknown } } | undefined)?.start?.line;
    if (typeof line !== 'number') throw new CoverageScopeFormatError(`${file} statementMap[${id}] 无 start.line`);
    lineTotal.add(line);
    const hit = s[id];
    if (typeof hit === 'number' && hit > 0) lineCovered.add(line);
  }
  return {
    file,
    statements: metrics(sCov, sTot), functions: metrics(fCov, fTot),
    branches: metrics(bCov, bTot), lines: metrics(lineCovered.size, lineTotal.size),
  };
}

function mergeTotals(files: CoverageScopeFileReport[]): CoverageScopeThresholds {
  const sum = (pick: (f: CoverageScopeFileReport) => CoverageScopeMetrics) =>
    files.reduce((acc, f) => { const m = pick(f); acc.c += m.covered; acc.t += m.total; return acc; }, { c: 0, t: 0 });
  const st = sum((f) => f.statements); const br = sum((f) => f.branches);
  const fu = sum((f) => f.functions); const li = sum((f) => f.lines);
  return { statements: pct(st.c, st.t), branches: pct(br.c, br.t), functions: pct(fu.c, fu.t), lines: pct(li.c, li.t) };
}

export function computeCoverageScope(report: unknown, thresholds: CoverageScopeThresholds): CoverageScopeReport {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new CoverageScopeFormatError('根对象不是 object');
  }
  const files: CoverageScopeFileReport[] = [];
  for (const [absPath, raw] of Object.entries(report as Record<string, unknown>)) {
    if (!isIncluded(absPath)) continue;
    files.push(fileMetrics(toDisplayFile(absPath), raw));
  }
  files.sort((a, b2) => a.file.localeCompare(b2.file));
  const totals = mergeTotals(files);
  const label: Record<keyof CoverageScopeThresholds, string> = {
    statements: 'statements', branches: 'branches', functions: 'functions', lines: 'lines',
  };
  const failures: string[] = [];
  for (const key of Object.keys(label) as Array<keyof CoverageScopeThresholds>) {
    if (totals[key] < thresholds[key]) {
      failures.push(`${key} ${totals[key]} < 阈值 ${thresholds[key]}`);
    }
  }
  return { fileCount: files.length, totals, files, failures, passed: files.length > 0 && failures.length === 0 };
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts coverage-scope-logic`
预期：PASS（3 用例）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/coverage-scope-logic.ts w-model-dev/scripts/__tests__/coverage-scope-logic.test.ts
git commit -m "feat(coverage): add rule-layer scope metrics over istanbul reports (B)"
```

---

## 任务 2：B-CLI check-coverage-scope.ts + 样本 + self-test + CLI 测试

**文件：**
- 创建：`w-model-dev/scripts/cli/check-coverage-scope.ts`、`w-model-dev/scripts/samples/coverage-scope/valid.json`、`w-model-dev/scripts/__tests__/check-coverage-scope.test.ts`
- 修改：`w-model-dev/scripts/cli/self-test.ts`（新用例节）、`w-model-dev/scripts/__tests__/README.md`、`w-model-dev/scripts/samples/README.md`、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`、`config/vitest.config.ts`（仅 SUBPROCESS_TEST_FILES）、`AGENTS.md`（§8 新行）、`w-model-dev/references/subagent-delegation.md`（dispatch-matrix 新行）、`w-model-dev/references/command-reference.md`（新命令节）

- [ ] **步骤 1：创建最小样本 `samples/coverage-scope/valid.json`**

2 文件（logic+lib 各一、小写盘符与正斜杠形态也各一）的最小 istanbul 对象，形如任务 1 测试里的 `entry()` 产物；两个文件合计 stmts 3/4、funcs 2/2、branches 1/2、lines 3/4（写死这些值供断言）。手工构造，不用脚本生成。

- [ ] **步骤 2：编写失败的 CLI 测试**

```ts
// w-model-dev/scripts/__tests__/check-coverage-scope.test.ts
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runSync } from '../lib/run-sync.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(REPO_ROOT, 'w-model-dev/scripts/cli/check-coverage-scope.ts');
const SAMPLE = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/coverage-scope/valid.json');
const tsxCli = require.resolve('tsx/cli');

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = runSync(process.execPath, [tsxCli, CLI, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
const FLAGS = ['--min-statements', '0', '--min-branches', '0', '--min-functions', '0', '--min-lines', '0'];

describe('check-coverage-scope CLI 三态', () => {
  it('exit 0：样本达标，stdout 单行 COVERAGE_SCOPE_JSON 含 fileCount=2', () => {
    const r = runCli(['--report', SAMPLE, ...FLAGS]);
    expect(r.code).toBe(0);
    const line = r.stdout.split('\n').find((l) => l.startsWith('COVERAGE_SCOPE_JSON '));
    expect(line).toBeDefined();
    const payload = JSON.parse(line!.slice('COVERAGE_SCOPE_JSON '.length)) as Record<string, unknown>;
    expect(payload.fileCount).toBe(2);
    expect(payload.passed).toBe(true);
  });

  it('exit 1：阈值抬到 100 后不达标，COVERAGE_SCOPE_JSON.passed=false 且 failures 非空', () => {
    const r = runCli(['--report', SAMPLE, '--min-statements', '100', '--min-branches', '100', '--min-functions', '100', '--min-lines', '100']);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('"passed":false');
    expect(r.stdout).toContain('failures');
  });

  it('exit 2：报告文件不存在 / 非法 JSON / 未知 flag / 重复值 flag / 缺值 / 非数值阈值', () => {
    expect(runCli(['--report', path.join(REPO_ROOT, 'no-such.json'), ...FLAGS]).code).toBe(2);
    const bad = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/coverage-scope/.tmp-bad.json');
    writeFileSync(bad, '{oops', 'utf8');
    try {
      expect(runCli(['--report', bad, ...FLAGS]).code).toBe(2);
    } finally { rmSync(bad); }
    expect(runCli(['--nope', 'x', ...FLAGS]).code).toBe(2);
    expect(runCli(['--report', SAMPLE, '--min-statements', '0', '--min-statements=1', ...FLAGS.slice(2)]).code).toBe(2);
    expect(runCli(['--min-statements', ...FLAGS]).code).toBe(2);
    expect(runCli(['--report', SAMPLE, '--min-statements', 'abc', '--min-branches', '0', '--min-functions', '0', '--min-lines', '0']).code).toBe(2);
    for (const r of [runCli(['--nope', 'x'])]) {
      expect(r.stdout).toContain('ERROR_JSON');
      expect(r.stderr).toContain('✗ [');
    }
  });
});
```

注意：文件顶部需按仓内惯例补 `import { rmSync, writeFileSync } from 'node:fs';` 与 `security/detect-child-process` 的具名 eslint 豁免注释（对照 `review-package-cli.test.ts` 的既有写法逐条对齐——该文件同为「tsx 子进程 + 仓内 CLI」模式，是本测试的格式参照）。

- [ ] **步骤 3：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts check-coverage-scope`
预期：FAIL，模块不存在。

- [ ] **步骤 4：实现 CLI**

```ts
// w-model-dev/scripts/cli/check-coverage-scope.ts
#!/usr/bin/env tsx
/**
 * 规则层覆盖口径门禁（B）：对 coverage/coverage-final.json 按 logic+lib 白名单分母重算
 * statements/branches/functions/lines 并强制阈值。独立于 vitest 全分母阈值（第 12 项）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts \
 *     --report <coverage-final.json> --min-statements <n> --min-branches <n> \
 *     --min-functions <n> --min-lines <n>
 *
 * 退出码：0 = 达标（stdout 单行 COVERAGE_SCOPE_JSON）；1 = 阈值不达（COVERAGE_SCOPE_JSON.passed=false）；
 * 2 = 输入错误（未知/重复/缺值/非有限数值 flag、报告缺失/非法 JSON/白名单零命中 → ERROR_JSON）。
 */
import { readFileSync } from 'node:fs';
import { computeCoverageScope, CoverageScopeFormatError, type CoverageScopeThresholds } from '../logic/coverage-scope-logic.js';
import { exitWithError, HandledCliError } from '../lib/cli-error.js';

const VALUE_FLAGS = ['report', 'min-statements', 'min-branches', 'min-functions', 'min-lines'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

function argInvalid(message: string, detail?: string): never {
  exitWithError({ category: 'ARG_INVALID', message, exitCode: 2, detail });
  throw new HandledCliError();
}

function parseArgs(argv: readonly string[]): Record<ValueFlag, string> {
  const out = {} as Record<ValueFlag, string>;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    const eq = token.indexOf('=');
    const name = eq > 0 ? token.slice(2, eq) : token.startsWith('--') ? token.slice(2) : undefined;
    if (name === undefined || !((VALUE_FLAGS as readonly string[]).includes(name))) {
      argInvalid('未知 flag', token);
    }
    const value = eq > 0 ? token.slice(eq + 1) : argv[++i];
    if (value === undefined || value.startsWith('--')) argInvalid(`flag --${name} 缺值`);
    if (out[name as ValueFlag] !== undefined) argInvalid('重复的值 flag', `--${name}`);
    out[name as ValueFlag] = value;
  }
  for (const f of VALUE_FLAGS) {
    if (out[f] === undefined) argInvalid('缺少必需 flag', `--${f}`);
  }
  return out;
}

function toThresholds(args: Record<ValueFlag, string>): CoverageScopeThresholds {
  const num = (flag: ValueFlag): number => {
    const n = Number(args[flag]);
    if (!Number.isFinite(n) || n < 0) argInvalid('阈值必须为非负有限数值', `--${flag} ${args[flag]}`);
    return n;
  };
  return { statements: num('min-statements'), branches: num('min-branches'), functions: num('min-functions'), lines: num('min-lines') };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const thresholds = toThresholds(args);
  let raw: string;
  try {
    raw = readFileSync(args.report, 'utf8');
  } catch {
    exitWithError({ category: 'FILE_NOT_FOUND', message: 'coverage 报告不存在或不可读', exitCode: 2, file: args.report, detail: '先跑 npx vitest run --coverage --config config/vitest.config.ts 生成 coverage/coverage-final.json' });
    throw new HandledCliError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    exitWithError({ category: 'FILE_PARSE', message: 'coverage 报告不是合法 JSON', exitCode: 2, file: args.report });
    throw new HandledCliError();
  }
  let report;
  try {
    report = computeCoverageScope(parsed, thresholds);
  } catch (e) {
    if (e instanceof CoverageScopeFormatError) {
      exitWithError({ category: 'STRUCTURE_INVALID', message: e.message, exitCode: 2, file: args.report });
      throw new HandledCliError();
    }
    throw e;
  }
  if (report.fileCount === 0) {
    exitWithError({ category: 'STRUCTURE_INVALID', message: '白名单零命中：报告中没有任何 logic/lib 文件（include 前缀失配或报告为空）', exitCode: 2, file: args.report });
    throw new HandledCliError();
  }
  console.log(`COVERAGE_SCOPE_JSON ${JSON.stringify({ ...report, thresholds })}`);
  if (!report.passed) process.exitCode = 1;
}

main();
```

- [ ] **步骤 5：运行 CLI 测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts check-coverage-scope`
预期：PASS（3 用例）。

- [ ] **步骤 6：self-test 逻辑层用例 + 登记面**

1. `self-test.ts` 新增用例节（紧跟现有某 logic 级用例节之后，仿 `runCoverageCases` 形态——直接 import `computeCoverageScope`，不 spawn）：读 `samples/coverage-scope/valid.json`，断言 thresholds 全 0 时 `passed===true && fileCount===2 && totals.statements===75 && totals.branches===50 && totals.functions===100 && totals.lines===75`（按步骤 1 写死的值），以及 thresholds 全 100 时 `passed===false && failures.length===4`。样本数 +1 节的用例数计入 self-test 总样本（收口时同步计数文案）。
2. `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES` 追加 `'check-coverage-scope.test.ts'`（保持字母序）。
3. `__tests__/README.md` 追加两行：`coverage-scope-logic.test.ts` 与 `check-coverage-scope.test.ts`（对照现有行格式：文件名/主题/一句职责）。
4. `samples/README.md` 矩阵声明 `coverage-scope/` 子目录与 `valid.json`（被 self-test 引用）。
5. `NEGATIVE-COVERAGE.md` 追加行：门禁 `check-coverage-scope.ts`，机制 `invocation`，证据 `check-coverage-scope.test.ts:<未知-flag 用例所在行号>`（行号写真实值——登记册逐行解析且会真实串行执行 exit-2 探针；基础探针 `--d4-invalid-argument` 由 `lib/exit2-probe-registry.ts` 自动派生，无需改注册表，但新 CLI 必须像所有 CLI 一样对未知 flag 返回 ARG_INVALID/exit 2——步骤 4 已满足）。
6. `AGENTS.md` §8 表格新行（用途=规则层覆盖口径门禁，阶段=`-`，退出码=`0=达标，1=阈值不达，2=输入错误`）；`subagent-delegation.md` dispatch-matrix 登记同名；`command-reference.md` 增命令节（用法/退出码/COVERAGE_SCOPE_JSON 字段）。

- [ ] **步骤 7：登记面回归**

运行：`npx vitest run --config config/vitest.config.ts vitest-project-split docs-consistency-logic check-samples-coverage && npm run --silent self-test && npm run --silent check:docs-consistency && npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`
预期：全 exit 0（若 docs-consistency 对「AGENTS §8 / exit-2 计数」报违规，按其消息补齐遗漏的登记文本——该门禁是登记完备性的 oracle）。

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/cli/check-coverage-scope.ts w-model-dev/scripts/samples/coverage-scope w-model-dev/scripts/__tests__/check-coverage-scope.test.ts w-model-dev/scripts/__tests__/coverage-scope-logic.test.ts w-model-dev/scripts/__tests__/README.md w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md config/vitest.config.ts AGENTS.md w-model-dev/references/subagent-delegation.md w-model-dev/references/command-reference.md
git commit -m "feat(coverage): check-coverage-scope gate CLI with samples, self-test and registrations (B)"
```

---

## 任务 3：B-接线（vitest reporter + pre-push 第 13 项 + 计数与文档）

**文件：**
- 修改：`config/vitest.config.ts`（coverage reporter + 注释）、`.githooks/pre-push`、`w-model-dev/scripts/logic/docs-consistency-logic.ts:248`、`README.md`、`CONTRIBUTING.md`、`AGENTS.md`

- [ ] **步骤 1：vitest coverage 加 json reporter**

`config/vitest.config.ts` coverage 块（现 107-113 行）在 `include` 行后插入：

```ts
    // json reporter 产出 coverage/coverage-final.json，供 pre-push 第 13 项 check-coverage-scope
    // 按 logic+lib 白名单分母重算口径（B 项设计：绕开 v8 provider「被 import 文件必入报告」行为）。
    reporter: ['text', 'json'],
```

并把 104-106 行三行注释改写为双口径结论：「全量 vitest 阈值（本块）按全分母地板执行；规则层（logic+lib）口径由第 13 项独立强制，阈值见 pre-push 注释」。

- [ ] **步骤 2：实测窄口径并定阈值**

独占运行（不与其他任务并行）：`npx vitest run --coverage --config config/vitest.config.ts`，随后：

```bash
npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json --min-statements=0 --min-branches=0 --min-functions=0 --min-lines=0
```

从 `COVERAGE_SCOPE_JSON` 读出 `totals` 四值（记入本计划收尾记录），按仓内惯例**向下取整到 5 的倍数**得到 `<STMT>/<BR>/<FN>/<LN>`。预期窄口径 ≥ 全分母实测 76.83/71.64/87.86/78.88；若反而更低，停下来核查（说明白名单或计数口径有错），不得硬编阈值。

- [ ] **步骤 3：插入 pre-push 第 13 项并顺延编号**

在 `.githooks/pre-push` 中「将第 12 项同次 JSON 封装为受控 provenance」的 `node -e` 块之后、`# 13. npm audit` 注释之前插入：

```bash
# 13. check-coverage-scope：规则层覆盖口径门禁（logic+lib 白名单分母重算，独立于第 12 项全分母阈值）
#     阈值 = <实测日期> 实测（logic+lib）：stmts <实测> / branch <实测> / funcs <实测> / lines <实测>，
#     向下取整到 5 的倍数；出处：config/vitest.config.ts coverage 注释 + 本计划收尾记录
run_expect "规则层覆盖口径 (logic+lib) 达阈值" 0 \
  npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json \
  --min-statements=<STMT> --min-branches=<BR> --min-functions=<FN> --min-lines=<LN> || exit 1
```

将原 `# 13.`～`# 18.` 注释编号顺延为 `# 14.`～`# 19.`（npm audit、docs-consistency、samples-coverage、prettier、tsc、eval 六块，只改注释数字，不动命令）。

- [ ] **步骤 4：计数与文档同步**

1. `docs-consistency-logic.ts:248` `prePushCount: 18` → `19`；1643-1646 注释中的 `#18` 文字同步。
2. 「18 项」→「19 项」：`CONTRIBUTING.md`（84、86、212、230）、`README.md`（31、60、217）、`AGENTS.md`（52、88、134）。
3. 运行 `npm run --silent check:docs-consistency`，若仍报 pre-push 块数/声明文本违规，按违规消息补齐（门禁是 oracle；已知它断言 `#1..#N 连续 + 恰 N 块 + 「N 项检查」声明文本`）。

- [ ] **步骤 5：端到端验证第 13 项**

```bash
npx vitest run --coverage --config config/vitest.config.ts && npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json --min-statements=<STMT> --min-branches=<BR> --min-functions=<FN> --min-lines=<LN>; echo "EXIT=$?"
```

预期 `EXIT=0`。再临时把 `--min-statements` 抬到 100 手动跑一次，确认 `EXIT=1` 且 `COVERAGE_SCOPE_JSON.passed=false`（验完还原）。

- [ ] **步骤 6：Commit**

```bash
git add config/vitest.config.ts .githooks/pre-push w-model-dev/scripts/logic/docs-consistency-logic.ts README.md CONTRIBUTING.md AGENTS.md
git commit -m "feat(prepush): add rule-layer coverage gate as item 13, count 18->19 (B)"
```

---

## 任务 3.5：负向登记证据寻址结构化（行号 → 唯一子串锚，用户裁定追加）

**背景**：现行证据语法 `文件:行号` 是位置耦合——上方加行即全体漂移（本会话实测三次回填）。校验器已断言被引行内容，行号不提供额外防伪力。改为 `文件#锚`（锚=文件内恰好出现一次的唯一子串），四列语法与真实探针执行不动。

**全仓同类扫描结论（2026-09-18，用户要求一并修）**——同问题共 3 处：
1. `samples/NEGATIVE-COVERAGE.md` 46 行证据列（本任务主体）；
2. `lib/run-sync.ts` `SYNC_PROCESS_EXCEPTIONS`：10 条 `line: N` 指向测试文件，`run-sync.test.ts:342` 以 `split('\n')[line-1]` 断言（即上会话 +2 漂移的当事者）→ `line` 字段改 `anchor`（唯一子串），测试改为「文件含唯一锚且锚行含 runSync」；
3. 活体散文位置引用：`__tests__/README.md:114` 的 `gate-logic.ts:240-248`（改为符号引用：`checkRequirementSpecStructure` 的 `nodeFsAdapter` 注入点）、`references/data-models.md:563` 的 `run-log-logic.ts:23`（去行号，保留常量名 `LEGACY_VARIANT_CUTOFF` 引用）。

**合法保留（扫描判定，不属本任务）**：自产 fixture 的行号（如 run-sync.test.ts 的 `fixtures/aliases.ts` line 3/4/5——测试自写自校，位置即契约）；reworkHints/票据示例中的 `src/....ts:42`（verifier-spec/phase-5-coding——领域数据示例，教如何引用缺陷位置）；聚合计数基线（L0 链接 675、exit-2 脚本数、self-test 样本数、pre-push 项数——数量不变量非寻址）；eval/mappings.json（无行号字段，干净）。

**文件：**
- 修改：`w-model-dev/scripts/cli/check-samples-coverage.ts`（证据校验函数）、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（46 行证据列迁移）、`w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`、`w-model-dev/scripts/lib/run-sync.ts`（manifest `line`→`anchor`）+ `w-model-dev/scripts/__tests__/run-sync.test.ts`（断言改锚）、`w-model-dev/scripts/__tests__/README.md`（:114 符号化）、`w-model-dev/references/data-models.md`（:563 去行号）、`AGENTS.md`（§8 check-samples-coverage 行的语法描述）、`w-model-dev/references/command-reference.md` 与 `w-model-dev/scripts/samples/README.md`（如提及行号语法处）

- [ ] **步骤 1：失败测试（追加到 check-samples-coverage.test.ts）**

构造临时登记册（既有测试已具备 tmp 登记册构造 helper，沿用），新增四类断言：
1. 新语法 `invocation-evidence.test.ts#exit 2 且 ERROR_JSON for gate-X`（锚唯一命中）→ 通过；
2. 旧行号形态 `invocation-evidence.test.ts:12` → exit 1，违规消息具名（要求迁移到锚语法，不留双语法兼容）；
3. 锚 0 次命中（`文件#不存在的子串`）→ exit 1 `negative-coverage-evidence-anchor`（0 命中语义）；
4. 锚多次命中（同一子串在文件出现两处）→ exit 1，具名「锚不唯一」消息。
fixture 机制行（`fixture` 证据）同步改锚语法：`#` 后为 fixture 相对路径基名+参数特征（保持「被引文件内唯一」同一语义）。

- [ ] **步骤 2：运行验证失败 → 实现校验函数**

改 `validateFixtureCitationAnchor` 一带的证据解析：拆 `文件#锚`（`#` 分隔，文件部分须为仓内真实普通文件），读全文断言锚出现次数恰为 1；`:数字` 形态直接判违规（消息含「行号语法已移除，改用 文件#唯一子串锚」）。违规码沿用 `negative-coverage-evidence-anchor`（0 命中/多命中/旧行号在消息文本中区分）。先跑步骤 1 测试确认新断言红、旧测试按预期调整，再实现转绿。

- [ ] **步骤 3：迁移 46 行登记 + run-sync manifest**

对 `NEGATIVE-COVERAGE.md` 每行：按当前行号取出被引行的内容，截取**该文件内唯一**的特征子串作锚（fixture 行基名本就唯一；self-test.ts 行取该用例的 `file: '<样本名>'` 字面量或用例 description 片段；测试文件行取 `it('...')` 标题片段）。迁移后逐行自查唯一性（脚本辅助：对每锚 `grep -F -c` 恰 1）。

`lib/run-sync.ts` 的 `SYNC_PROCESS_EXCEPTIONS`：每条 `line: N` 改为 `anchor: '<被指行特征子串>'`（取该行含 `runSync` 的调用片段，全文件唯一，迁移时 `grep -F -c` 自查）；`run-sync.test.ts` 的 line-accurate provenance 用例改为：读 `entry.file` 全文断言 `anchor` 恰出现一次、且锚所在行 `includes('runSync')`、`timeout.status === 'present'`。自产 fixture 用例（`fixtures/aliases.ts` 的 line 3/4/5）**不动**。

- [ ] **步骤 4：文档语法描述同步 + 散文位置引用符号化 + oracle**

`AGENTS.md` §8 该行的「证据 `文件:行号` 可解析（假路径/越界行号各自具名 exit 1）」改为「证据 `文件#唯一子串锚` 可解析（假路径/零命中/多命中各自具名 exit 1）」；command-reference / samples README 如有行号语法提及一并改。`__tests__/README.md:114` 的 `gate-logic.ts:240-248` 改为符号引用（`checkRequirementSpecStructure` 的 `nodeFsAdapter` 注入点）；`references/data-models.md:563` 的 `（run-log-logic.ts:23）` 去行号保留常量名。跑 `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（真实探针仍须全过）+ `npx vitest run --config config/vitest.config.ts check-samples-coverage run-sync` + `npm run --silent check:docs-consistency`，全绿收口。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md w-model-dev/scripts/__tests__/check-samples-coverage.test.ts w-model-dev/scripts/lib/run-sync.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/README.md w-model-dev/references/data-models.md AGENTS.md w-model-dev/references/command-reference.md w-model-dev/scripts/samples/README.md
git commit -m "refactor: replace positional line anchors with unique-substring anchors (register + run-sync manifest + prose)"
```

## 任务 4：J1-logic run-log R11 闭环五脚本

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`、`w-model-dev/scripts/cli/check-run-log.ts`、`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/run-log/`（11 个 fixture 迁移 + 2 个新负向）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`

- [ ] **步骤 1：编写失败的测试（追加到 run-log-logic.test.ts）**

```ts
describe('R11 闭环五脚本（约束 #11 机器核验）', () => {
  const base = { runId: 'g1', phase: 1, phaseName: 'P1', role: 'G', duration_s: 1, tokens: 1, estimated: false, subagentSpawns: 0 };
  const closure = (script: string, ts: string, runId: string) => ({
    ...base, runId, timestamp: ts, action: 'gate', gateExitCode: 0, outcome: 'success', script,
  });
  const checkpoint = { ...base, runId: 'c1', role: 'O', timestamp: '2026-09-18T05:00:00Z', action: 'checkpoint', gateExitCode: null, outcome: 'success', acknowledgedDecisions: ['放行'] };
  const five = ['check-budget.ts', 'check-run-log.ts', 'check-maturity.ts', 'check-checkpoint.ts', 'check-preventive-review.ts'].map((s, i) =>
    closure(s, `2026-09-18T0${i + 1}:00:00Z`, `g${i}`));

  it('五条闭环齐且早于放行 → 通过', () => {
    const r = checkRunLog([/* 前置 chunk/cross 等按 R1 需要补齐 */, ...five, checkpoint /*, 其余阶段按需 */]);
    expect(r.violations.some((v) => v.startsWith('R11'))).toBe(false);
  });

  it('缺 check-maturity.ts 一条 → R11 blocking，消息含缺失脚本名', () => {
    const r = checkRunLog([/* 同上但去掉 maturity 那条 */, checkpoint /*...*/]);
    expect(r.violations.some((v) => v.startsWith('R11') && v.includes('check-maturity.ts'))).toBe(true);
  });

  it('闭环记录晚于 checkpoint 放行 → R11 blocking', () => {
    const late = closure('check-budget.ts', '2026-09-18T06:00:00Z', 'g-late');
    const r = checkRunLog([/*...*/, late, checkpoint /*...*/]);
    expect(r.violations.some((v) => v.startsWith('R11') && v.includes('check-budget.ts'))).toBe(true);
  });

  it('无 checkpoint 放行的 run-log（如 fix 变体）不触发 R11', () => {
    const r = checkRunLog([closure('check-budget.ts', '2026-09-18T01:00:00Z', 'g0') /* 仅此一条 + schema 允许 */]);
    expect(r.violations.some((v) => v.startsWith('R11'))).toBe(false);
  });

  it('非 G 角色或 gateExitCode≠0 的同名脚本记录不充数', () => {
    const fake = { ...closure('check-budget.ts', '2026-09-18T01:00:00Z', 'g0'), role: 'S' };
    const r = checkRunLog([fake, checkpoint /*...*/]);
    expect(r.violations.some((v) => v.startsWith('R11') && v.includes('check-budget.ts'))).toBe(true);
  });
});
```

注意：注释 `/*...*/` 处在实现时必须补齐满足既有 R1（阶段动作完整性）/R6/R7 的最小前置记录——以该测试文件现有 builder 为基础拼装，不得删除既有断言；上述五例是**新增** describe，不修改旧用例。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts run-log-logic`
预期：新增 5 例中「缺脚本」「晚于放行」「不充数」三例 FAIL（无 R11 违规产出）。

- [ ] **步骤 3：实现 R11**

`run-log-logic.ts` 常量区（`checkRunLog` 之前）：

```ts
/** 约束 #11 闭环五脚本（SSoT §10C）：每阶段门 exitCode=0 才可放行；R11 做机器核验（2026-09-18）。 */
export const RUN_LOG_CLOSURE_SCRIPTS: readonly string[] = [
  'check-budget.ts',
  'check-run-log.ts',
  'check-maturity.ts',
  'check-checkpoint.ts',
  'check-preventive-review.ts',
] as const;
```

`checkRunLog` 内（在 R10 块之后追加，风格对齐既有 R 块）：

```ts
// R11：闭环五脚本机器核验（约束 #11；触发域=出现 checkpoint 放行的阶段；缺失或晚于放行均 blocking）。
const closureOk = new Map<string, Set<string>>(); // phase -> 已满足的脚本集合
for (const e of valid) {
  if (e.action !== 'checkpoint' || e.outcome !== 'success' || e.phase === null) continue;
  const phase = e.phase;
  const have = new Set<string>();
  for (const g of valid) {
    if (g.phase !== phase || g.action !== 'gate' || g.role !== 'G' || g.outcome !== 'success') continue;
    if (g.gateExitCode !== 0) continue;
    if (!RUN_LOG_CLOSURE_SCRIPTS.includes(g.script as string)) continue;
    if (String(g.timestamp) < String(e.timestamp)) have.add(String(g.script)); // 严格早于：同秒不算「早于放行」
  }
  closureOk.set(`${phase}@${String(e.timestamp)}`, have);
}
for (const [key, have] of closureOk) {
  const phase = key.split('@')[0];
  for (const script of RUN_LOG_CLOSURE_SCRIPTS) {
    if (!have.has(script)) {
      violations.push(
        `R11: 阶段 ${phase} 的 checkpoint 放行缺少闭环脚本 ${script} 的成功 gate 记录（role=G、gateExitCode=0 且早于放行；约束 #11：5 脚本每阶段门 exitCode=0）`,
      );
    }
  }
}
```

（字段访问须对齐文件内既有 `valid` 数组元素类型与 `e.script` 的类型守卫写法；`timestamp` 比较与 R7 一致采用 `Date.parse()` 数值比较。）

> **上列骨架为草稿，实现以三处修正为准（2026-09-18，控制者裁定 + 任务 4 审查结论）**：
> 1. **时间戳比较为严格早于 `Date.parse(g.timestamp) < releaseAt`**，不是骨架里的 `String(...) <= String(...)`——同秒不算「早于放行」（`run-log.schema.json` 的 `timestamp` 为 RFC3339 date-time，同秒内先后不可判定）。骨架原写法被实现者采用后由审查发现与同段「早于放行」的消息模板矛盾，经控制者裁定回改严格 `<`，并补同秒边界用例钉住语义。
> 2. **不得用 `phase@timestamp` 字符串作 map 键**：同一阶段同一秒的多次放行会被合并而少计缺失。实现改为逐条放行独立核验。
> 3. `RunLogCheckResult` 增 `closure?: { checkedGates: number; missing: number }`（checkedGates=已核验的放行次数，missing=violations 中 R11 条数）；CLI 的 `RUN_LOG_JSON` 以 `r11` 键**条件展开**（无 `closure` 时不出现该键），人类可读通过语在无放行时打印「闭环五脚本：不适用（无 checkpoint 放行）」。

- [ ] **步骤 4：CLI 摘要 r11**

`check-run-log.ts` 第 282 行 `...(result.revertEvidence ? { r10: result.revertEvidence } : {})` 之后仿写 `...(result.closure ? { r11: result.closure } : {})`，文件头注释「R1-R10」→「R1-R11」。

- [ ] **步骤 5：fixture 迁移（真实迁移，不做豁免）**

对以下 11 个含 checkpoint success 的 fixture，逐个处理：对每个含 `action=checkpoint && outcome=success` 的阶段，在该阶段**第一条** checkpoint 行之前插入 5 条闭环记录（时间戳依次排在阶段内既有记录之后、checkpoint 之前；`runId` 全文件唯一；字段模板）：

```json
{"runId":"c-b","timestamp":"<checkpoint 前 1 分钟>","phase":<P>,"phaseName":"<同阶段>","action":"gate","role":"G","duration_s":30,"tokens":1000,"estimated":false,"subagentSpawns":0,"gateExitCode":0,"outcome":"success","script":"check-budget.ts"}
```

五个脚本分别为 `check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`（runId 后缀 `-b/-rl/-m/-c/-pr`）。

11 个文件：`valid.jsonl`、`bad-incomplete.jsonl`、`bad-missing-G-role.jsonl`、`bad-missing-R-role.jsonl`、`bad-missing-V-role.jsonl`、`bad-gateExitCode-null.jsonl`、`bad-o-overreach.jsonl`、`bad-ordering.jsonl`、`bad-review-level-drift.jsonl`、`phase5-missing-produce.jsonl`、`phase5-valid.jsonl`。

- [ ] **步骤 6：新负向 fixture + self-test 用例**

以迁移后的 `valid.jsonl` 为底复制两份：
- `bad-r11-missing-closure.jsonl`：删去阶段 1 的 `check-maturity.ts` 那条；
- `bad-r11-late-closure.jsonl`：把阶段 1 的 `check-budget.ts` 那条时间戳改到其 checkpoint 之后。

`RUN_LOG_CASES` 追加两条：

```ts
{
  file: 'bad-r11-missing-closure.jsonl',
  expectedPassed: false,
  expectedReasonPatterns: [/R11.*check-maturity\.ts/],
  description: 'R11：阶段 1 缺 check-maturity.ts 闭环记录应被拦截（约束 #11 机器核验）',
},
{
  file: 'bad-r11-late-closure.jsonl',
  expectedPassed: false,
  expectedReasonPatterns: [/R11.*check-budget\.ts/],
  description: 'R11：闭环脚本记录晚于 checkpoint 放行应被拦截',
},
```

并把 `valid.jsonl` 用例 description 更新为「3 阶段各含 chunk/cross/gate/checkpoint + 每阶段闭环五脚本，append-only 且 checkpoint tokens>0」。

- [ ] **步骤 7：运行验证**

```bash
npx vitest run --config config/vitest.config.ts run-log-logic
npm run --silent self-test
npm run --silent typecheck
```

预期：定向测试全 PASS（既有用例不得因迁移翻红——若翻红，说明该用例断言编码了旧的 fail-open 语义，逐条核对后带注释更新）；self-test 全部样本匹配期望（新增负向 2 例 + valid 描述更新）；类型 0 错误。

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/run-log w-model-dev/scripts/__tests__/run-log-logic.test.ts
git commit -m "feat(run-log): R11 closure five-scripts machine verification (J1)"
```

---

## 任务 5：J1-文档同步（约束 #11 从「未实现」到「R11 强制」）

**文件：**
- 修改：`w-model-dev/references/hard-constraints.md`（#11 节，~55 行）、`w-model-dev/SKILL.md`（约束 #11 行）、`AGENTS.md`（§8 `check-run-log.ts` 行）、`w-model-dev/references/command-reference.md`、`w-model-dev/references/data-models.md`、`docs/skill-design-document_SSoT.md`（§10C/§10D 闭环节）

- [ ] **步骤 1：hard-constraints.md #11 替换边界注**

将 55 行「**执行核验边界（2026-09-17 审查如实标注）**：门禁侧**不校验**这 5 个脚本是否真的跑过……（未实现）。」整句替换为：

```markdown
**机器核验（2026-09-18 起由 `check-run-log.ts` R11 强制）**：凡 run-log 中出现 `checkpoint` 放行记录的阶段，放行前必须已有本节 5 个脚本各自的 `role=G`、`outcome=success`、`gateExitCode=0` gate 记录；缺失任一或晚于放行即 blocking（违规消息列出缺失脚本名）。无 checkpoint 放行的 run（如 fix/emergency 变体）不触发 R11。
```

- [ ] **步骤 2：SKILL.md / AGENTS / command-reference / data-models / SSoT 同步**

1. `SKILL.md` 约束表 #11 一句话语义改为「5 脚本每阶段门 exitCode=0（check-run-log R11 校验）」。
2. `AGENTS.md` §8 `check-run-log.ts` 行：规则清单「R1-R10」→「R1-R11」，补「R11 闭环五脚本（有 checkpoint 放行的阶段须有五条 G/success/exit 0 记录且早于放行）」。
3. `command-reference.md` check-run-log 节补 r11 摘要字段与 R11 语义；`data-models.md` run-log 节同。
4. SSoT §10C/§10D 中「闭环五脚本」处补一句「由 check-run-log R11 机器核验（2026-09-18）」，并保持其余表述不动。

- [ ] **步骤 3：验证 + Commit**

```bash
npm run --silent check:docs-consistency && npx vitest run --config config/vitest.config.ts docs-consistency-logic
git add w-model-dev/references/hard-constraints.md w-model-dev/SKILL.md AGENTS.md w-model-dev/references/command-reference.md w-model-dev/references/data-models.md docs/skill-design-document_SSoT.md
git commit -m "docs(J1): constraint #11 now enforced by run-log R11"
```

---

## 任务 6：N-语义审计（7 个 CLI 对照治理参考）

**文件：**
- 审计对象：`code-health-phase1/gap/tests/duplicates/ledger/apply/archive.ts` + `w-model-dev/references/code-health-governance.md`
- 产出：本任务在计划文档末尾追加「N 审计表」；发现偏差当场修（代码错修代码、文档错修文档）

- [ ] **步骤 1：建审计表**

对 7 个 CLI 各建一行：`治理参考条款（节名+要点） | CLI 实际行为（读代码+跑一次确认） | 既有测试证据（test 文件:行） | 判定（一致 / 文档错 / 实现错 / 无测试覆盖）`。重点核对治理参考声明过、但端到端从未验证的条款：apply 的三模式语义与「scope 外变更即拒」「rollback 可执行（git apply -R + diff --exit-code=0）」；archive 的「权威取自 caller 指定 --campaign 目录」「命令证据仅结构性校验」「--verify 无 --source-project 只能 package-only」；phase1 的「候选只 discovered/blocked、changedFiles 非空即只读违规」；tests 的「--guard 为唯一删除测试路径」；duplicates 的「under-review 不是批准」；ledger 的 append-only 与非法转移拒绝。

- [ ] **步骤 2：逐条验证并记录**

每个「实现行为」格必须有一次真实 CLI 运行或一段已存在测试的引用支撑，不得凭代码阅读推断为「一致」。运行形态用任务 7 的 `runCli` helper 逐条手工跑（临时目录内）。

- [ ] **步骤 3：处置偏差**

「文档错」→ 改 governance/reference 对应句子；「实现错」→ 先写失败测试再修实现（该修复连同测试归入本任务 commit）；「无测试覆盖」→ 登记到任务 7 的 e2e 断言清单（把它变成端到端断言）。所有判定（含「一致」）写入审计表，不留悬空项。

- [ ] **步骤 4：Commit**

```bash
git add docs/superpowers/plans/2026-09-18-leftovers-closeout.md w-model-dev/references/code-health-governance.md w-model-dev/scripts
git commit -m "docs(code-health): semantics audit of 7 CLIs against governance reference (N)"
```

（若步骤 3 无任何代码改动，`w-model-dev/scripts` 不入暂存。）

---

## 任务 7：N-真实 git 端到端测试

**文件：**
- 创建：`w-model-dev/scripts/__tests__/helpers/code-health-fixtures.ts`、`w-model-dev/scripts/__tests__/code-health-e2e.test.ts`
- 修改：`code-health-cli.test.ts`（改 import 共享 helper，行为不变）、`config/vitest.config.ts`（SUBPROCESS_TEST_FILES 追加 `'code-health-e2e.test.ts'`）、`__tests__/README.md`

- [ ] **步骤 1：抽取共享 helper**

把 `code-health-cli.test.ts` 中的 9 个命名标识符 `tempRoot` / `createTempGitRepository` / `loadApplyFixture` / `bindRevision` / `writeJson` / `runCli` / `gitStatus` / `gitHead` / `APPLY_SAMPLES` 原样搬到 `helpers/code-health-fixtures.ts` 并 `export`（含各自的 eslint 豁免注释一起搬）；原文件改为 `import { ... } from './helpers/code-health-fixtures.js'`。

**迁移清单必须补全（修复轮 5 实测核对：只列 9 个标识符无法落地——「原样搬」不是字面可执行的）**，按当前工作区行号给出全部传递依赖：

| 角色 | 必须一并搬到 helper 并 `export` | 依据 |
| --- | --- | --- |
| 被搬的 9 个函数/常量 | `tempRoot`(:107) / `createTempGitRepository`(:113) / `loadApplyFixture`(:131) / `bindRevision`(:142) / `writeJson`(:135) / `runCli`(:75) / `gitStatus`(:99) / `gitHead`(:103) / `APPLY_SAMPLES`(:40) | 题面清单 |
| 类型 | `CliResult`(:69-73)、`ApplyFixture`(:124-129) | `runCli`/`git` 返回值、`loadApplyFixture`/`bindRevision` 签名 |
| 模块级常量 | `tsxCli`(:36)、`CLI_DIR`(:39)、`GIT_ENV`(:44-62) | `runCli`(:76/:79)、`git`(:95) |
| 路径常量 | `REPO_ROOT`(:38)、`APPLY_SAMPLES`(:40) | `runCli` 默认 `cwd`、`bindRevision` 无关但 `CLI_DIR`/`APPLY_SAMPLES` 由它派生；**且原测试文件自身的 it() 体仍在用 `REPO_ROOT`**（:652/:675/:684/:693/:904/:909/:956/:962）→ 必须 export 后两文件共用 |
| 可变状态 + 清理钩子 | `createdRoots`(:63) 与 `afterEach` 清理(:65-67) | `tempRoot` 在 helper 内 push(:109)，**原测试文件也在 push**（archive describe :968/:982）→ 数组必须共享；清理钩子随之要么放 helper 并导出 `cleanupTempRoots()`（两文件各自 `afterEach(cleanupTempRoots)`），要么导出 `createdRoots` 由两文件各自注册 |
| 纯函数（题面清单漏列） | `jsonLine`(:84) | `runCli` 的消费者，两文件共 10 处使用；不搬则 e2e 文件要重复实现 |
| 需要的 provider | `revisionProvider`(:42) | **不是这 9 个 helper 的传递依赖**（9 个函数体逐一核对：无一引用它）；它是 it() 体（:208-579）与 e2e it() 体的依赖 → 要么在 helper 里一并 export，要么 e2e 文件自行 `createCodeHealthGitRevisionProvider()`。原文件的 `codeHealthApplyCli` / `createHash` / `applyApproved` / `executeRollback` **不搬**（只被原文件的 it() 体使用） |

**路径深度变更（必改，否则 `runCli` 会指向不存在的 CLI）：** `REPO_ROOT = path.resolve(here, '../../..')`（:38，`here` 为 `__tests__/`）→ 移入 `__tests__/helpers/` 后 `here` 深一层，**必须改为 `path.resolve(here, '../../../..')`**。`CLI_DIR`(:39) 与 `APPLY_SAMPLES`(:40) 由 `REPO_ROOT` 派生，改 `REPO_ROOT` 即自动修正（题面「`APPLY_SAMPLES` 同理」指的就是这一条派生链）。

**落点合法性（修复轮 5 实测）：** `helpers/code-health-fixtures.ts` 不叫 `*.test.ts` → ① vitest `include` 为 `` `${TEST_DIR}/**/*.test.ts` ``（`config/vitest.config.ts:79`），不会被当测试套件收集；② docs-consistency 的 tests-matrix 用 `readdirSync(__tests__)` **非递归** + `.endsWith('.test.ts')` 过滤（`w-model-dev/scripts/cli/check-docs-consistency.ts:692-694`）→ helper 既不入册也不要求登记 README 覆盖矩阵；③ `__tests__/helpers/` 目录已存在先例（`l0-baseline.ts`）。

运行 `npx vitest run --config config/vitest.config.ts code-health-cli` 确认全绿（行为不变的纯重构）。

- [ ] **步骤 2：编写 e2e 测试（先写，跑出失败/缺失再补）**

```ts
// w-model-dev/scripts/__tests__/code-health-e2e.test.ts
// 真实 git 工作区全链路（N）：规则层单测不覆盖的跨 CLI 消费契约与真实 git 触点。
// 四个 it 各自独立、不共享仓与 package。链路按 it 分三条（**archive 是两条互相独立的 verify 链**，
// 不是一条单链——两语义不能在同一条 verify 上同时成立，理由见下方各 it）：
//   链 A · apply（第 1 个 it）：ledger init → append(discovered) → apply dry-run → patch → commit
//          → `git apply -R` 回滚证伪 → 运行前 dirty 的 scope 文件触发 SCOPE_MISMATCH → scope 篡改拒绝；
//   链 B · archive（第 2 个 it = 链 1 package-only；第 3 个 it = 链 2 source-bound）：
//          链 1：produce 默认级别 → `--verify`（package-only）→ 加 `--source-project` 也不升级；
//          链 2：produce `--verification-level source-bound` → 带 `--source-project` 通过 →
//                不带即 exit 1 → 提交级篡改源后 REVISION_MISMATCH；
//   链 C · phase1（第 4 个 it）：真实仓只读发现。
// 注（修复轮 5 校正）：本注释**不含** `append(approved)` 这一步——`approved` 只能自 `under-review` 由 `human`
// 角色进入（NORMAL_TRANSITIONS code-health-ledger-logic.ts:131-143；TRANSITION_ROLES :146-150），
// `append` 会以 TRANSITION_INVALID 拒绝（ledger-logic.ts:511-512 → cli/code-health-ledger.ts:214-216 fail-closed），
// 故 ledger 侧只用 init + append(discovered)；且 apply 链本身**不读 ledger**
// （cli/code-health-apply.ts:558 仅在传 `--ledger`/测试删除候选时才读）。
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createTempGitRepository, runCli, tempRoot, writeJson,
} from './helpers/code-health-fixtures.js';

it('apply 全链路：dry-run 不落盘 → patch 只写受控 .patch → commit 真实删除工作区文件（HEAD 不前移），rollback 证伪可执行', async () => {
  const root = await createTempGitRepository();
  const dir = await tempRoot('code-health-e2e-');
  const ledger = path.join(dir, 'campaign.json');
  const baseline = await writeJson(dir, 'baseline.json', { /* 与 code-health-cli.test.ts 的 revision 形态一致：由 revisionProvider.current(root) 取得后写入 */ });
  expect(runCli('code-health-ledger.ts', ['init', '--ledger', ledger, '--campaign-id', 'CH-E2E', '--baseline', baseline]).code).toBe(0);
  // candidate/event/approval：以 samples/code-health/valid-candidate.json / valid-ledger-event.json / valid-approval.json
  // 经 bindRevision 绑定当前 revision 后写盘（与 code-health-cli.test.ts 同法）。
  // 断言序列：
  // 1) apply --mode dry-run → code 0，stdout 含 proposal JSON（APPLY_JSON.applied:false）；
  //    什么都不写（.w-model/ 目录不存在），gitStatus(root) 与 gitHead(root) 与前置相同；
  // 2) apply --mode patch → code 0，APPLY_JSON.applied:false、appliedFiles:[]；
  //    **只落盘受控 .patch**（.w-model/code-health/apply/<candidateId>.patch，内容为完整删除 patch 文本），
  //    **目标文件未被改动**：工作区文件仍在、git diff --exit-code 为 0、git diff HEAD --stat 为空，
  //    gitStatus(root) 与前置相同（空——createTempGitRepository 的 .gitignore 忽略 .w-model/；若该 .gitignore 缺失则为 ?? .w-model/），
  //    gitHead(root) 不前移（修复轮 3 实测：patch 模式只写 patch，从不应用 patch）；
  // 3) apply --mode commit → code 0，APPLY_JSON.applied:true、appliedFiles 与 changeScope.files 等集合、unrelatedFiles:[]；
  //    删除只发生在**工作区**：目标文件从工作区消失（fs.stat 拒绝），gitStatus(root) === 'D src/unused.ts'
  //    （helper 的 .trim() 吃掉 porcelain 前导空格；未暂存，git diff --cached --exit-code 为 0），
  //    **gitHead(root) 不前移且工作树不干净**——commit 模式从不调用 `git commit`
  //    （CLI 内 git argv 仅 `apply --check` / `apply` / `status` / `apply -R`；实测 HEAD、git log、reflog 均不变）；
  //    修复轮 3 定案：不得断言 gitHead 前移或工作树干净，误写应红；
  // 4) git apply -R <步骤 3 落盘的 patch> 后 git diff --exit-code → 空输出（回滚证伪，治理参考的可回滚承诺）；
  //    gitStatus(root) 回到前置；**本步必须排在步骤 3 之后**（patch 模式不应用 patch，反向应用只能跟在真实前向应用之后）；
  // 5) scope 文件在运行前 dirty/untracked（例：**仅** git rm --cached src/unused.ts，工作区仍保留该文件；
  //    **不要**再 git commit——提交会让 HEAD 前移，而 applyApproved 末段拿真实 currentRevision 与
  //    candidate.revision 比对（code-health-ledger-logic.ts:1653-1657，消息在 :1655），未重绑 revision 的 fixture
  //    会先失败为 REVISION_MISMATCH（修复轮 5 实测 `{code:1, errorCode:"REVISION_MISMATCH", patchPath:null,
  //    rollback:null, reason:"approved application current revision does not match the candidate"}`）——
  //    该失败发生在任何前向 git apply / 回滚之前（cli/code-health-apply.ts:591→:604-606 return，早于 :627/:637），
  //    故本条的 errorCode、patchPath、rollback.patchSha256、「拒绝文本含 rollback restored…」全部不成立；
  //    「回读 == HEAD blob」则是**所指消失**（修复轮 5 实测提交后 `git cat-file blob HEAD:src/unused.ts` 报
  //    `fatal: path 'src/unused.ts' exists on disk, but not in 'HEAD'`）；只剩「工作区字节未变」仍为真，
  //    但它已**退化为空洞断言**（前向应用与回滚都未发生，不再证明任何回滚行为）。
  //    若确实要保留提交形态，必须在提交后重新 bindRevision 绑定新 revision，并放弃「== HEAD blob」）
  //    → apply --mode commit code 1 SCOPE_MISMATCH（前向 git apply 已真实发生、exact-scope 回读判定失败）；
  //    stdout 保留受控 patch 与 rollback 方案（patchPath 非 null、rollback.patchSha256 为 64 位 hex）；
  //    拒绝文本含成功语 `rollback restored the pre-change worktree`（**允许**——这是可达路径上的正确行为，
  //    **不要**改成「必须列出残留路径 / 不得声称工作树干净」）；
  //    scope 内文件被逐字节还原（回读 == 运行前工作区字节；该 fixture 下同时 == HEAD blob），
  //    且 git status --porcelain 与运行前一致。
  //    理由（修复轮 2 实测）：判定基准是本次运行自取的 before/after **路径集合**快照（parseStatus 丢弃 XY 字母），
  //    **运行前**注入的 scope 外改动落在快照内 → 既不计入 unrelatedFiles、也不构成残留（实测 exit 0 applied:true），
  //    故「注入持续存在的 scope 外改动 → SCOPE_MISMATCH」不是可达断言；
  //    `the worktree may be left modified` 只可能由运行期并发写入或反向应用失败触发，串行 e2e **不可达** →
  //    该分支由 code-health-cli.test.ts:577-636 的单元三态用例覆盖（反向失败 :601-603、干净还原 :605-618、
  //    残留 :620-635），**不作为 e2e 断言**。
  // 6) candidate 或 approval 的 scope 绑定被篡改（scope-mismatch fixture；approval 文件集 expand 或 shrink 均拒）
  //    → apply --mode commit code 1、stdout 含 HUMAN_APPROVAL_REQUIRED（APPLY_JSON errorCode 为 SCOPE_MISMATCH）；
  //    **工作树不变**：git status 与运行前一致；**本次运行不新增、也不改写 `.w-model/` 条目**——
  //    **不要**写「`.w-model/` 未被创建」：步骤 2 的 `--mode patch` 已在同一仓落了受控 patch
  //    （cli/code-health-apply.ts:636-637；修复轮 5 实测 `--mode patch` 后 `{code:0, wmodelExists:true,
  //    patchExists:true}`），该目录在本 it 内必然已存在，原措辞不可达；
  //    正确形态是 `.w-model/` **逐文件快照的运行前后比对**（added/removed/bytesChanged/mtimeChanged 四项全空）——
  //    修复轮 5 在同 it 复现形态上实测：第 6 步拒绝 `{code:1, errorCode:"SCOPE_MISMATCH", snapshotDiff 四项全空,
  //    gitStatusUnchanged:true, headUnchanged:true}`；
  //    **不要把该断言挪到第 5 条**：第 5 条的 SCOPE_MISMATCH 路径会重写受控 patch（实测 patch 字节不变
  //    （sha256 与 APPLY_JSON.rollback.patchSha256 一致）但 mtimeMs 前移），快照比对在那里必然非空。
  //    理由：scope 绑定篡改由 applyApproved 抛出（code-health-ledger-logic.ts:1640-1647），
  //    早于 buildPatchBytes/writePatch（cli/code-health-apply.ts:627/:637）→ 该次调用零写入；
  //    修复轮 1 误删的骨架原第 5 条语义，修复轮 2 恢复。
  //    取舍记录：另一种形态是把该断言放到**新的** createTempGitRepository() 仓上单独断言 `.w-model/` 不存在
  //    （修复轮 5 实测：按 helper 同法落盘的仓（git init → src/unused.ts → .gitignore → add → commit）在运行前
  //    该目录确为 false）；本计划选快照比对——不新增第三个仓，且保留「拒绝早于任何写入」语义。
  //    另注（修复轮 5 实测）：**缺 approval 制品**（approval-required fixture）走的是 `ROLE_FORBIDDEN`
  //    （stdout 同样含 HUMAN_APPROVAL_REQUIRED），不要把它当 SCOPE_MISMATCH 分支断言。
});

it('archive 链 1（package-only）：produce 默认级别 → --verify <pkg> 恒 package-only，加 --source-project 也不升级', async () => {
  // campaign 目录：ledger.json + candidate.json + approval.json（produce 的读取契约，见
  //   code-health-archive.ts:201-203；readJsonOrExit 只做 JSON 解析、**不做 schema 校验**，lib/read-json-or-exit.ts:30-49）
  //   + evidence/ reviews/ gate-logs/ rollback/（候选签名与回滚计划的 provenanceRef / rollback.patchPath 指向的受控制品）；
  //   candidate.status='verified'、candidate.revision 与 approval.revision 必须经 revisionProvider.current(root)
  //   真实绑定后写入（与 code-health-cli.test.ts 的 bindRevision 同法），否则 produce refuse。
  //
  // **ledger.json 的内部一致性是本步骤 exit 0 / archivedAsPassed:true 的硬前置**（修复轮 5 逐条按源码列出，勿让实现者去猜）：
  //   ⚠ 不只是「archivedAsPassed 变 false」——produce 把 readiness 理由与注入的 canArchiveCandidate 理由取并集，
  //     **非空即 exit 1** `refuse('EVIDENCE_INVALID', …, 'archive not authorized: …', 1)`
  //     （code-health-archive-boundary.ts:726-731），故下列每条都是 code 0 的必要条件：
  //   (a) ledger.candidates 必须含同一 candidateId 的**完整候选条目**（`candidates: CodeHealthCandidate[]`，
  //       code-health-contract.ts:251-262），且 status / action 全等、changeScope.files / symbols 排序后全等、
  //       changeScope.scopeHash 全等（code-health-ledger-logic.ts:738-750；boundary:278-287 有同源第二遍校验）；
  //   (b) ledger.baseline 必须等于 candidate.revision（sameRevision 只比 commitSha/treeSha/sourceBundleSha256，
  //       ledger-logic.ts:195-201 与 :752；boundary:302-304 对 verified 再校一次）；
  //       且 ledgerCandidate.revision 必须等于 ledger.baseline（boundary:290-292）
  //       → **最省事的写法：把同一份绑定后的候选对象同时写进 candidate.json 与 ledger.candidates[0]**；
  //   (c) ledger.environmentMatrix 中每个 `supported:true` 的条目必须 `observed:'observed'`（ledger-logic.ts:787-789）；
  //   (d) ledger.events 中**不得**有 candidateId 相同且 `to==='blocked'` 的事件（ledger-logic.ts:790-791）；
  //   (e) 同一 reasons 集合里的其余硬闸门（逐条对齐 fixture 才可能过）：status==='verified'(:753) /
  //       candidate.archive.redactionStatus 与 ledger.redaction.status **双 clean**(:754-756) / rollback.executable
  //       且 patchPath 为安全相对路径(:757-758)、command 不含 `;&|<>` 与换行(:760-761) / review.decision 与
  //       review.humanDecision **双 approve**(:763-764) / approval 存在(:766) 且 validateApprovalScope 全清
  //       (:767 → :676-716：candidateId/action/files/symbols/scopeHash/revision 全等、decision 合法、
  //       rationale ≥20 字符、actor 为人类) / 每条 commands 的 observation==='observed' 且 exitCode===0、
  //       rawOutputPath 为安全相对路径(:769-772) / signatures 含 V、G、human 三角色(:774-777) /
  //       human 签名的 scopeHash 等于 approval.scopeHash(:778-786)。
  //   **fileCount:7 的来源**：fileCount = manifest.files.length（cli/code-health-archive.ts:95），sources 由
  //   campaignSources(candidate, approval) 派生（cli:126-148）= 固定 3（ledger.json/candidate.json/approval.json）
  //   + candidate.evidenceRef（relative 时）+ candidate.rollback.patchPath（relative 时）+ V 签名 provenanceRef
  //   (kind=review) + G 签名 provenanceRef(kind=gate)，按 `kind\0path` 去重
  //   → 要得 7，这 4 个相对引用必须**互不相同**（V/G 共用同一 provenanceRef 会被去重成 6）。
  //   可复用度：approval 形态见 samples/code-health/valid-approval.json（人类 actor、rationale ≥20 字符）、
  //   evidence/ledger 形态见 valid-evidence.json / valid-campaign.json；但**都不能直接照抄**——valid-campaign 的候选是
  //   status='discovered' 的 valid-candidate.json（不满足 (e) 的 verified 闸门），且现有 code-health 样本的 candidate
  //   只带 A 角色签名（`signatures` 无 V/G，见 valid-candidate.json），V/G 签名与其 provenanceRef 指向的受控制品须在 fixture 中新写。
  // 1) runCli('code-health-archive.ts', ['--campaign', campaign, '--output', pkg]) → code 0，
  //    ARCHIVE_JSON.verificationLevel === 'package-only'、archivedAsPassed:true、fileCount:7，
  //    且 <pkg>/manifest.json 落盘（SHA-256 manifest）；
  // 2) runCli('code-health-archive.ts', ['--verify', pkg]) → code 0，
  //    verificationLevel === 'package-only'、reason === 'package-only archive package verified'；
  // 3) runCli('code-health-archive.ts', ['--verify', pkg, '--source-project', root]) → **仍 code 0 且仍
  //    package-only**：verifyPackage 只在 manifest.verificationLevel === 'source-bound' 时才看 sourceProject，
  //    package-only manifest 一律短路（code-health-archive-boundary.ts:617-645）→ 本步骤钉住的是
  //    「package-only 不会被静默升级为 verified source」，**不是**「传了 --source-project 就 source-bound」。
  //    形态警告：不要写 '--manifest', '<pkg>/manifest.json'——manifestPath 必须是**包根相对 POSIX 路径**
  //    （boundary:554-556，按包根解析读取 :568）；绝对路径实测 exit 1 STRUCTURE_INVALID，带包名的相对路径
  //    实测 exit 1 EVIDENCE_INVALID。正确形态是**省略 --manifest**（默认 manifest.json：boundary:106、cli:255）。
});

it('archive 链 2（source-bound）：produce 声明 source-bound → --verify 带 --source-project 通过 → 篡改源后 fail-closed', async () => {
  // 与链 1 **相互独立**：不共享 package、不共享临时仓（两个 archive it 各自 createTempGitRepository()），
  // 也不试图让同一条 --verify 同时覆盖两种级别——source-bound 声明
  // 必须显式配 --source-project 才能升级（无 --source-project 的 source-bound 声明在 produce 即 refuse
  // exit 1，boundary:744-752），而这样的 package 在 --verify 不带 --source-project 时必然 exit 1
  // （boundary:617-620）；两个语义不能在同一条 verify 上同时成立。
  // 1) runCli('code-health-archive.ts', ['--campaign', campaign, '--output', pkgSourceBound,
  //    '--verification-level', 'source-bound', '--source-project', root]) → code 0，
  //    ARCHIVE_JSON.verificationLevel === 'source-bound'（真实级别只在显式 sourceProject 存在时成立，
  //    boundary:717-718）；
  // 2) runCli('code-health-archive.ts', ['--verify', pkgSourceBound, '--source-project', root]) → code 0，
  //    verificationLevel === 'source-bound'、reason === 'source-bound archive package verified'；
  // 3) runCli('code-health-archive.ts', ['--verify', pkgSourceBound]) → code 1，
  //    ARCHIVE_JSON.errorCode === 'EVIDENCE_INVALID'、reason 含
  //    'source-bound package verification requires an explicit source project'（boundary:617-620）；
  // 4) 篡改 <root> 内被登记的源文件**并提交**（writeFile + git add / git commit，使
  //    gitHead(root) !== 归档时绑定的 revision.commitSha）→ runCli('code-health-archive.ts',
  //    ['--verify', pkgSourceBound, '--source-project', root]) → code 1、errorCode === 'REVISION_MISMATCH'
  //    （source-bound 重验 fail-closed，boundary:621-630）。
  //    **必须提交**：只改工作区不提交时 rev-parse HEAD / git archive 不变 → 实测仍 exit 0；
  //    revision 是 commit/tree/source-bundle 级，本链不检测未提交的工作区改动。
});

it('phase1 真实仓只读发现：候选非空且全 discovered、stdout PHASE1_JSON.changedFiles 为空、报告落盘', async () => {
  // 本 it 自建 createTempGitRepository() 仓（**不复用** apply 链的仓：那条链的 commit 步骤会删除 src/unused.ts）。
  // 场景文件（Phase1Scenario，w-model-dev/scripts/logic/code-health-phase1-logic.ts:60-73）：
  //   {"scenarios":[{"id":"smoke","environment":"win32-git-bash","shell":"git-bash","supported":true,
  //     "command":"node","args":["--version"],"cwd":".","timeoutMs":15000,"targets":["src/unused.ts"]}]}
  //   —— id / environment / command 三字段是 CLI 强制（cli/code-health-phase1.ts:567-573，缺 command
  //   直接 exit 2 ARG_INVALID，见 cli:609-617）；reached / observation **不是** Phase1Scenario 的字段，
  //   它们是 DynamicTraceInputScenario 的字段（logic:40-48），由 runner 的真实结果派生。
  // 1) runCli('code-health-phase1.ts', ['--root', root, '--output', reportPath, '--scenario', scenarioPath])
  //    → code 0；stdout PHASE1_JSON.changedFiles 为 []（该键**只在 stdout 摘要**里：cli:636-645；
  //    落盘 report 的 Phase1ReportFile（cli:84-100）不含 changedFiles）；
  // 2) 读落盘 report：report.candidates.length >= 1 **且** report.candidates.every(c => c.status === 'discovered')
  //    —— targets 必须是真实存在、可读、且**没有被任何被分析文件 import** 的代码文件（candidateFiles 过滤掉
  //    inboundTargets 与 test-helper，logic:524-532）；实测三种形态：唯一 target 是非代码文件 → candidates=[] 且 `every()` **空真**（未被证明）；
  //    被 import 的文件本身被排除但 import 方仍成候选（targets=[src/unused.ts, src/other.ts] 且 other 导入 unused → candidates=1、files=["src/other.ts"]，须**全部** target 都被过滤才为空）；target 不可读 → status 'blocked'（candidates 非空但 every(discovered)=false）；
  // 3) report.commands.length === 1 且 report.unexercisedScenarios 为 []（真实执行 node --version、观察到
  //    exit 0 → scenarioExercised 成立，logic:497-506）；
  // 4) 报告落在 root 之外，且该次运行未改动被分析目标（changedFiles 为空的同源证据：report.validationViolations
  //    不含 'read-only invariant violated'）。
});
```

实现注意（写代码时落实，不是留白）：每条 `runCli([...])` 的完整参数数组必须写全（第一个元素是脚本名如 `'code-health-ledger.ts'`，子命令与 flag 参照任务 6 审计表记录的真实用法与 `code-health-cli.test.ts` 现有调用）；`baseline` 的形态来自 `code-health-cli.test.ts` 顶部 `revision` 的构造方式（同文件可见）；phase1 的 **`--scenario` 输入**形态取自 `Phase1Scenario`（`w-model-dev/scripts/logic/code-health-phase1-logic.ts:60-73`，`id`/`environment`/`command` 必填）——**不要**照抄 `code-health-phase1.test.ts:267` 一带的 `scenarios:` 数组，那是进程内 `mergeDynamicTrace` 的 `DynamicTraceInput`（`DynamicTraceInputScenario`，logic:40-48，含 `reached`/`observation` 而无 `command`），把它当 CLI 输入会缺 `command` 直接 exit 2。四个 it 全部落在 `cli-serial` 项目（SUBPROCESS 登记后自动路由），无并行竞争。

- [ ] **步骤 3：登记 + 运行**

1. `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES` 追加 `'code-health-e2e.test.ts'`（字母序）。
2. `__tests__/README.md` 追加 `code-health-e2e.test.ts` 行。
3. 运行：`npx vitest run --config config/vitest.config.ts code-health-e2e code-health-cli vitest-project-split`
预期：全 PASS。

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/scripts/__tests__/helpers/code-health-fixtures.ts w-model-dev/scripts/__tests__/code-health-e2e.test.ts w-model-dev/scripts/__tests__/code-health-cli.test.ts config/vitest.config.ts w-model-dev/scripts/__tests__/README.md
git commit -m "test(code-health): real-git end-to-end chain across ledger/apply/archive/phase1 (N)"
```

---

## 任务 8：O-通用剥离 helper strip-rule.ts

**文件：**
- 创建：`w-model-dev/scripts/__tests__/helpers/strip-rule.ts`
- 测试：剥离能力由任务 9 的三态测试本身验证；本任务先用一个最小冒烟用例验证「相对 import 重写」可用

- [ ] **步骤 1：实现 helper**

```ts
// w-model-dev/scripts/__tests__/helpers/strip-rule.ts
/**
 * 通用规则剥离器（O）：对 w-model-dev/scripts/logic/<rel> 的源码文本，
 * 按「唯一锚点 → 语句块整块删除（大括号配平扫描）」产出剥离副本到 os.tmpdir()，
 * 并把副本的静态相对 import 说明符重写为指向原目录的绝对 file:// URL（tmpdir 副本否则断链；
 * 说明符以 .js 结尾时优先解析为同名 .ts——仓内 NodeNext 惯例）。
 * 锚点不唯一、块结构漂移、大括号不配平一律抛错，绝不静默错删（与 l0-rule-loadbearing 同纪律）。
 * 剥离函数内的字符串字面量若含大括号导致配平误判 → 抛错而不是产出坏副本（调用方应改用
 * 更精确的锚点；这是 fail-loud 设计，不是缺陷）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOGIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logic');

function requireUniqueAnchor(source: string, anchor: string): number {
  const first = source.indexOf(anchor);
  if (first < 0) throw new Error(`strip 定位失败：锚点未命中 → ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + 1) >= 0) throw new Error(`strip 定位失败：锚点不唯一 → ${JSON.stringify(anchor)}`);
  return first;
}

/** 从锚点行起做配平扫描：遇到第一个 '{' 开始计深，深浅归零处为块尾；扫到 EOF 未归零即抛错。 */
function blockEndIndex(source: string, anchorStart: number): number {
  const open = source.indexOf('{', anchorStart);
  if (open < 0) throw new Error('strip 失败：锚点后未找到块起始 {');
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error('strip 失败：大括号不配平（块扫描到 EOF）');
}

function rewriteRelativeImports(source: string, originalFile: string): string {
  const fromRe = /^(\s*(?:import|export)\b[^'"]*?from\s*['"])([^'"]+)(['"])/gm;
  const sideEffectRe = /^(\s*import\s*['"])([^'"]+)(['"])/gm;
  const rewrite = (whole: string, head: string, spec: string, tail: string): string => {
    if (!spec.startsWith('.')) return whole;
    const abs = path.resolve(path.dirname(originalFile), spec);
    const asTs = abs.endsWith('.js') ? abs.slice(0, -3) + '.ts' : abs;
    let target = abs;
    try {
      readFileSync(asTs); // 仅探测存在性
      target = asTs;
    } catch { /* 保留 .js 解析 */ }
    return head + pathToFileURL(target).href + tail;
  };
  return source.replace(fromRe, rewrite).replace(sideEffectRe, rewrite);
}

/** 返回剥离副本的 file:// URL（供动态 import）；副本随 os.tmpdir() 生命周期清理。 */
export function stripRuleToCopyUrl(relLogicPath: string, anchor: string): string {
  const originalFile = path.join(LOGIC_DIR, relLogicPath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径由本 helper 自身位置拼装，指向本技能包 logic 源
  const source = readFileSync(originalFile, 'utf8');
  const anchorStart = requireUniqueAnchor(source, anchor);
  const end = blockEndIndex(source, anchorStart);
  const stripped = (source.slice(0, anchorStart) + source.slice(end)).trimStart();
  const rewritten = rewriteRelativeImports(stripped, originalFile);
  const copy = path.join(os.tmpdir(), `stripped-${path.basename(relLogicPath, '.ts')}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);
  writeFileSync(copy, rewritten, 'utf8');
  return pathToFileURL(copy).href;
}
```

（`fromRe` 中的字符类按实际文件写 `[^'\"]`——注意 heredoc/Python 回写会吞反斜杠，一律用 Edit/Write 工具直接写文件，禁止经 shell 转写；写入后用 `node -e "console.log(JSON.stringify(require('fs').readFileSync(...,'utf8').match(...)))"` 抽查正则字节完好。）

- [ ] **步骤 2：冒烟验证（本步骤不落新测试文件，验证动作写进执行记录）**

临时用 `npx tsx -e` 动态 import 一个由 `stripRuleToCopyUrl` 产出的、**有相对 import** 的 logic 副本（如剥掉 `budget-logic.ts` 任一条规则的副本），确认模块加载成功且导出函数可调用。若 vite/tsx 拒绝绝对 `.ts` file URL import，启用备选方案：副本写入 `w-model-dev/scripts/logic/__strip_tmp__/` 子目录（gitignored 临时名 + afterEach 删除 + 相对 import 深度重写 +1），并在本计划收尾记录中如实注明采用了备选。确认后删除临时验证代码。

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/scripts/__tests__/helpers/strip-rule.ts
git commit -m "test(helpers): generic rule stripper with relative-import rewriting (O)"
```

---

## 任务 9：O-实测选 5 文件 + 三态测试 + 死规则修复

**文件：**
- 创建：`w-model-dev/scripts/__tests__/<name>-rule-loadbearing.test.ts` × 5（name 在步骤 1 实测后定）
- 可能修改：`w-model-dev/scripts/logic/*`（仅当发现死规则）、`__tests__/README.md`

- [ ] **步骤 1：实测选文件（数据驱动，禁止凭印象）**

用任务 3 已产出的 `coverage/coverage-final.json`（若过期先重跑 `npx vitest run --coverage --config config/vitest.config.ts`）：

```bash
npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json --min-statements=0 --min-branches=0 --min-functions=0 --min-lines=0 | python -c "import sys,json; d=json.loads(sys.stdin.read().split('COVERAGE_SCOPE_JSON ',1)[1]); [print(f['statements']['pct'], f['file']) for f in sorted(d['files'], key=lambda x: x['statements']['pct'])]"
```

取 statements 升序前 5，**排除已有负载性测试的 `logic/l0-link-audit-logic.ts`**（顺延取第 6 名，排除原因写入记录）。5 个文件名与各自 pct 写入本计划收尾记录。

- [ ] **步骤 2：逐文件枚举规则锚**

对每个选中文件，枚举其公开 check 函数产出的**可区分违规消息/规则编号**（来源：文件内 violations push 的字面量前缀，如 `'R4-A: '`），每条规则登记：`规则标识 | 违规文案锚（源码内唯一子串） | 既有单测中的 RED 输入（test 文件:行）`。此表写入计划收尾记录。锚必须先跑唯一性（`grep -c` 恰 1）再进测试。

- [ ] **步骤 3：编写三态测试（每文件一份，模板如下）**

```ts
// w-model-dev/scripts/__tests__/<name>-rule-loadbearing.test.ts
import { describe, expect, it } from 'vitest';
import { stripRuleToCopyUrl } from './helpers/strip-rule.js';
import * as logic from '../logic/<name>.js';

// 规则清单（锚 = 源码违规文案的唯一子串；RED 输入 = 既有单测同款违规样例）
const RULES = [
  { id: '<规则标识>', anchor: '<违规文案唯一子串>' },
  // ... 步骤 2 枚举的全部规则
] as const;

describe('<name> 规则负载性（GREEN/RED/STRIPPED）', () => {
  for (const rule of RULES) {
    it(`${rule.id}：剥离后同输入不再报该规则，且合规输入不受影响`, async () => {
      const red = /* 该规则的最小违规输入（从该文件既有单测复制） */;
      // RED（本体）：先确认本体报出目标规则，证明锚与输入匹配
      expect(JSON.stringify(violationsOf(logic, red))).toContain(rule.id);
      // STRIPPED（副本）：剥掉规则块后，同输入不再报该规则
      const copyUrl = stripRuleToCopyUrl('<name>.ts', rule.anchor);
      const stripped = (await import(copyUrl)) as typeof logic;
      expect(JSON.stringify(violationsOf(stripped, red))).not.toContain(rule.id);
      // GREEN 对照（副本）：合规输入在副本上仍零违规（防「剥坏整个函数」的假阳性）
      expect(violationsOf(stripped, /* 合规输入 */)).toEqual([]);
    });
  }
});

// violationsOf：按 <name> 模块公开 check 函数的实际签名调用并取 violations/违规串数组。
// 每个文件的该 helper 是 2-4 行的适配函数（模块签名不同），在文件头定义。
```

每个文件落地时把模板中的占位换成真实锚、真实输入与真实调用（这是本任务的主要工作量；锚与输入在步骤 2 已登记，不许临场编造）。

- [ ] **步骤 4：运行 + 死规则处置**

```bash
npx vitest run --config config/vitest.config.ts rule-loadbearing
```

- 若全部 PASS：目标规则全部被测试钳住，记录之。
- 若某规则 STRIPPED 后**仍报**该违规：锚定位到了错误块（锚不精确）→ 修锚重跑。
- 若某规则 RED 态本体就不报（死规则：无测试且无输入能触达）：先写一个该规则的最小 RED 单测（补进该 logic 的既有测试文件），再走三态；若实现本身有 bug（规则永不可满足或永不触发），修实现并记录。
- 处置逐条写入计划收尾记录。

- [ ] **步骤 5：登记 + Commit**

`__tests__/README.md` 登记全部新测试文件；运行 `npm run --silent check:docs-consistency` 确认测试集合双向差集为空。

```bash
git add w-model-dev/scripts/__tests__ w-model-dev/scripts/logic
git commit -m "test(logic): GREEN/RED/STRIPPED load-bearing suites for 5 lowest-coverage logic files (O)"
```

（无死规则时 `scripts/logic` 不入暂存。）

---

## 任务 10：收口——计数文案、CHANGELOG、全量 prepush、推送

**文件：**
- 修改：`CHANGELOG.md`、本计划文档（收尾记录）、`AGENTS.md`/`.githooks/pre-push`（self-test 样本数文案）、可能涉及的残余计数文本

- [ ] **步骤 1：计数文案终值同步**

统计 self-test 实际样本总数（跑 `npm run --silent self-test` 读输出），更新：`.githooks/pre-push` 第 1 项注释「354 条样本」、`AGENTS.md` §8 `self-test.ts` 行「354 条样本」。以 `npm run --silent check:docs-consistency` 为 oracle 兜底（它校验活体文档与脚本计数一致），有违规按消息修到绿。

- [ ] **步骤 2：CHANGELOG + 计划收尾记录**

CHANGELOG 增收口小节（B/J1/N/O 四条，含：窄口径实测值与阈值、R11 规则摘要、审计表结论计数、5 文件清单与死规则处置）；计划文档末尾追加「收尾记录」：任务 3 的窄口径实测四值、步骤 1 样本总数终值、N 审计表全文、O 的 5 文件清单/规则数/死规则处置、备选方案使用情况（任务 8 步骤 2 若走了备选）、每条验证命令的真实结果。

- [ ] **步骤 3：污染检查 + 全量验收（唯一验收依据）**

```bash
npx tsx w-model-dev/scripts/cli/check-pollution.ts
npm run prepush; echo "PREPUSH_EXIT=$?"
```

预期：`check-pollution` passed；`PREPUSH_EXIT=0`、**19/19 项全绿**、末行「全部门禁通过，允许推送 ✓」。随后清理 `coverage/` 与 prepush 临时日志（保持工作树只剩待提交的计划文档修改）。

- [ ] **步骤 4：提交 + 推送**

```bash
git add CHANGELOG.md docs/superpowers/plans/2026-09-18-leftovers-closeout.md AGENTS.md .githooks/pre-push
git commit -m "docs(closeout): record leftovers programme results and sync counts"
git push origin main
git status --short --branch
```

预期：推送成功（连同此前已在本地的 4 个未推送提交一并上行），`main` 与 `origin/main` 同步。若 prepush 非 0，按失败项修复后**重跑全量**，不得带病推送。

---

## 计划自检

1. **规格覆盖度**：§2 B（任务 1-3）、§3 J1（任务 4-5）、§4 N（任务 6-7）、§5 O（任务 8-9）、§6 排序（任务编号即序）、§7 验收标准 9 条（任务 10 步骤 3 + 各任务步骤）、§8 风险（各任务步骤内的对应缓解）、§9 不做（未引入任何越界任务）——全覆盖。验收标准第 6 条「覆盖率留档」在任务 9 步骤 1 与任务 10 步骤 2。
2. **占位符扫描**：任务 7/9 的 `<...>` 占位均为「实现时以已登记的实测/审计数据填充」的性质，且每处都指明了数据来源步骤与格式模板；除此以外无 TODO/待定。任务 1/2/4/8 的代码块为完整可落地代码。
3. **类型一致性**：`CoverageScopeReport.totals` 类型复用 `CoverageScopeThresholds`（任务 1 定义、任务 2 CLI 消费一致）；`RunLogCheckResult.closure`（任务 4）与 CLI `r11` 键（同任务步骤 4）命名一致；`stripRuleToCopyUrl` 签名在任务 8 定义、任务 9 消费一致；SUBPROCESS_TEST_FILES 三个新登记名与实际测试文件名一致（`check-coverage-scope.test.ts`、`code-health-e2e.test.ts`；`coverage-scope-logic.test.ts` 无子进程不入册）。

---

## 任务 6 · N 审计表（7 个 code-health CLI × 治理参考）

**审计方法（证据纪律）：** 每个「实际行为」格都由**一次真实 CLI 运行**支撑，运行全部在系统临时目录的隔离工作区
（`%TEMP%/wm-t6-audit`，自建 5 个真实 git 仓 `repo-a`…`repo-e`）内完成，**从未指向本仓库**；命令形态为
`node <repo>/node_modules/tsx/dist/cli.mjs w-model-dev/scripts/cli/<cli>.ts <flags>`。所有 git 回读都用 CLI 自身的
pinned 环境（`GIT_CONFIG_NOSYSTEM=1` / `GIT_CONFIG_GLOBAL=NUL`）——本机系统 gitconfig 设了 `core.autocrlf=true`，CLI 刻意屏蔽它，
未屏蔽的临时读回会产生 CRLF 假差异（本审计首轮踩到并已纠正）。完整命令与关键输出见
`.superpowers/sdd/2026-09-18-leftovers-closeout/task-6-report.md`。判定四值：**一致 / 文档错 / 实现错 / 无测试覆盖**。

**行号基准与漂移（2026-09-18 修复轮 1 补注；修复轮 4 校正）：** 「既有测试证据」列的 `code-health-cli.test.ts` 行号为**该次审计当时工作区**（941 行）行号，
与审计证据一一对应、不随后续编辑改写。该工作区**不是**修复前的 `git show HEAD:` 版本（HEAD 822 行；同一批锚点为 `:559`(init)/`:592`(append)/`:674`(validate)/`:745`(archive describe)/`:477`(scope 扩张)）：
它比 HEAD 多 119 行 = `:19-21` 的 3 行 import + 当时已在工作区的 116 行新 describe 块。故换算分两段——**新用例块之前 = 当前行号**（如 R1 `:340`/`:377`/`:419`、R2 `:206`/`:419`、R15 `:174-199`），**块之后 = 当前行号 − 66**。
据此的 5 个映射例子（左列审计时、右列当前工作区，均已在当前文件核对落点）：`:864-941` → `:930-1007`（archive describe，末行 `});`）；`:678`(init) → `:744`；`:711`(append) → `:777`；`:793`(validate) → `:859`；`:596`(scope 扩张) → `:662`。
**变更描述校正（修复轮 4 实测）：** 修复轮 1 最终写入的是 **1 个 describe + 3 个 it**（describe 当前 `:457`，3 个 it 当前 `:458`/`:514`/`:577`），插入块 `+182` 行（当前 `:457-638`）另加 `:19-21` 的 `+3` 行，**净 +185 行**（`git diff --numstat` = `185  0`；822 → 1007 行）；
旧注「`:511` 插入 1 个新用例（+66 行）」只对应扩写前的中间状态（941 行）与该轮第三个 it，不代表最终形态。
**基准例外（按当前行号书写，勿按上表换算）：** 本表 **R3 行**（其「既有测试证据」列写 `**CLI 级本轮前为空**，本任务补 code-health-cli.test.ts:458`）引用的 `code-health-cli.test.ts:458`、`:577-636`（含 `:601-603`/`:605-618`/`:620-635`）指向修复轮 1/2 新增用例本身，为**当前**行号；R5/R7b 的 `:864-941` 与 R13 的 `:678`/`:711`/`:793`/`:813` 仍为审计时行号（现分别为 `:930-1007` 与 `:744`/`:777`/`:859`/`:879`）。
R5/R7b 原引用 `:864-931` 止于最后一个负向用例中途，已更正为 `:864-941`（审计时 describe 末行 `});` 的真实位置）。

| # | 治理参考条款（节名 + 要点） | CLI 实际行为（真实运行证据） | 既有测试证据（test 文件:行） | 判定 | 处置 / 转为任务 7 断言 |
| --- | --- | --- | --- | --- | --- |
| R1 | §4「`dry-run` 不写 / `patch` 写受控 `.patch` / `commit` 以 argv 执行 `git apply` 并回读真实状态」（同 SSoT §10K.2） | 三次真实运行：`dry-run`（缺 approval）与 `dry-run`（有 approval）后 `repo-a2/.w-model` **完全不存在**（exit 1 / 0）；`patch` 后仅出现 `.w-model/code-health/apply/CHG-P1-20260907-301.patch` 一个文件、`applied:false`、`git status` 空；`commit` exit 0 `applied:true, appliedFiles:["src/unused.ts"], unrelatedFiles:[]`。**（修复轮 3 定案，2026-09-18）**`commit` 分支**从不调用 `git commit`**（CLI 内 git argv 仅 `apply --check` / `apply` / `status` / `apply -R`）：tracked+clean 隔离仓实测 exit 0、`applied:true`、`appliedFiles:["src/unused.ts"]`、`unrelatedFiles:[]`，工作区文件被真实删除、`git status` 为 ` D src/unused.ts`（未暂存，`git diff --cached --exit-code` 为 0），**HEAD / `git log` / reflog 均不前移**（删除停留在工作区，靠记录的 `.patch` 反向应用回滚）；`patch` 模式实测**不改目标文件**（`git diff --exit-code` 为 0、工作区文件仍在），`git status` 空仅因 `.w-model/` 被 `.gitignore` 忽略（该忽略缺失时会是 `?? .w-model/`）。治理参考 §4/§6 从未承诺 HEAD 前移或工作树干净，**实现与治理参考一致，本行判定维持「一致」** | code-health-cli.test.ts:340（patch 不写工作树）、:377（commit exact scope）、:419（dry-run 不写） | 一致 | 任务 7 骨架的 `it()` 标题与断言 2/3/4 已于修复轮 3 按上列实测改写（commit = 真实工作区删除且 HEAD 不前移、patch = 只写 `.patch` 不动目标文件、回滚证伪排在 commit 之后） |
| R2 | §4 / SSoT §10K.1「`patch`/`commit` 需人类 `ApprovalDecision`，缺失或 scope/revision 不一致在写入前 exit 1 `HUMAN_APPROVAL_REQUIRED`」 | `--mode dry-run` 无 approval → exit 1 `ROLE_FORBIDDEN` + stdout `HUMAN_APPROVAL_REQUIRED`，工作树与 `.w-model` 均无变化；`--mode apply`（commit 别名）在 exact approval 下 exit 0 | code-health-cli.test.ts:206（缺失/scope 不一致）、:419（缺 approval 的 dry-run）、:596（scope 扩张/非人类/过期 revision） | 一致 | — |
| R3 | §4 / SSoT §10K.2「任一 scope 外路径变化即拒绝」 | `repo-b`（scope 文件未入 index）真实 `commit`：前向 `git apply` 后真实 exact-scope 回读判定失败 → exit 1 `errorCode:"SCOPE_MISMATCH"`、`applied:false`，scope 文件已还原且内容不变（2026-09-18 修复轮 2 在隔离临时仓用 dirty 与 untracked 两种前置各实测一次，均 exit 1 + 逐字节还原）。**（修复轮 2 可达性补注）**判定基准是本次运行自取的 before/after **路径集合**快照（`parseStatus` 丢弃 XY 字母）：**运行前**已存在的 scope 外改动落在快照内，既不计入 `unrelatedFiles` 也不构成残留——实测「注入持续存在的 scope 外改动 + 干净 scope 文件」→ exit 0 `applied:true`；可达的拒绝形态是 **scope 文件自身在运行前 dirty/untracked**（删除后路径集合不变）。**原注**：单进程内无法注入"scope 外路径被并发改动"，该输入走同一 `exactScope` 判定 | 逻辑层：code-health-task1-integration.test.ts:1442-1504、:1936-1958；code-health-ledger.test.ts:1734；**CLI 级本轮前为空**，本任务补 code-health-cli.test.ts:458 | 一致 | 任务 7 断言 **T7-1**（2026-09-18 修复轮 2 按可达性重写）：**运行前**令 scope 文件 dirty/untracked（例：**仅** `git rm --cached src/unused.ts`，工作区仍保留该文件；**不要提交**——提交会让 HEAD 前移，未重绑 revision 的 fixture 会先失败为 `REVISION_MISMATCH`，理由与实测见骨架正文 :894-905）→ `apply --mode commit` exit 1 `errorCode:"SCOPE_MISMATCH"`、`applied:false`；输出保留受控 patch 与 rollback 方案（`patchPath` 非 null、`rollback.patchSha256` 为 64 位 hex）；拒绝文本含成功语 `rollback restored the pre-change worktree`（**允许**——这正是可达路径上的正确行为）；scope 内文件被逐字节还原（回读 == 运行前字节），`git status --porcelain` 与运行前一致。**已删除**旧措辞「列出残留路径 / 不得声称干净」：`the worktree may be left modified` 只可能由运行期并发写入或反向应用失败触发，串行 e2e **不可达** → 由单元三态用例 `code-health-cli.test.ts:577-636`（反向失败 :601-603 / 干净还原 :605-618 / 残留 :620-635）覆盖，**不作为 e2e 断言**。**T7-6**（恢复修复轮 1 误删的骨架原第 5 条语义）：candidate 或 approval 的 scope 绑定被篡改（scope-mismatch fixture）→ exit 1 `HUMAN_APPROVAL_REQUIRED`（`errorCode:"SCOPE_MISMATCH"`），`git status` 不变且 `.w-model/` **逐文件快照运行前后四项全空**（added / removed / bytesChanged / mtimeChanged；**不写「`.w-model/` 未被创建」**——步骤 2 的 `--mode patch` 已在同一仓落过受控 patch，该目录在本 it 内必然已存在，见骨架第 6 条） |
| R4 | §6 回滚「记录受控 patch 并 `git apply -R`，随后 `git diff --exit-code` 为 0；无法回滚即显式失败」（同 SSoT §10K.4） | 正常路径 OK：`git apply -R <记录的 patch>` exit 0 → `git diff --exit-code` exit 0 → 文件 hash 与 `HEAD:src/unused.ts` blob **一致**（字节级还原）。**偏差**：`SCOPE_MISMATCH` 分支原实现只调用 `git apply -R`（忽略退出码）且不校验还原、`APPLY_JSON` 的 `patchPath`/`rollback` 均为 `null`，回滚是否成功不可知 → 与「随后 `git diff --exit-code` 为 0；无法回滚时显式失败（不静默）」不符 | code-health-cli.test.ts:377-414（测试侧执行 `git apply -R` + `git diff --exit-code`）、code-health-duplicates.test.ts:832-873（同）；SCOPE_MISMATCH 分支无覆盖 | **实现错**（已修） | TDD：先写失败测试（新 2 例，红：`patchPath` 为 `null` + `verifyRollbackRestored is not a function`）→ 修 `cli/code-health-apply.ts`（导出 `verifyRollbackRestored`：真实反向应用 + `git status` 快照残差回读；拒绝时在输出中保留受控 patch / 回滚计划 / 回滚结论，失败文本含 `the worktree may be left modified`）→ 绿；`repo-b` 复跑 reason 带 `rollback restored the pre-change worktree`。治理参考 §6 措辞同步为「按 pre-change 快照回读（原本干净时**不弱于** `git diff --exit-code` 为 0）」 |
| R5 | §4 归档权威规则「`ledger.json`/`candidate.json`/`approval.json` 从 caller 的 `--campaign` 目录读取；不锚定 HEAD/tracked，campaign 真实性由 caller 负责」 | `campaign/` 位于**任何 git 仓之外**（`git rev-parse --show-toplevel` exit 128）仍 `produce` exit 0：`ok:true, archivedAsPassed:true, verificationLevel:"package-only", fileCount:7`；`approval.actor` 改为 `S-agent` → exit 1 `approval actor is not a human decision maker` 且不写 package | code-health-cli.test.ts:864-941（CLI 负向：--help / 缺参 / 未知 level / 不存在 campaign / 缺 V/G/approval 均不写 package）；code-health-archive-boundary.test.ts:360-570（边界） | 一致 | — |
| R6 | §4 / SSoT §10K.6「命令证据仅结构性校验：该边界**不读 raw 输出文件、不重算摘要**，raw 按字节验证属上游 `EvidenceStore`」 | 同一 campaign 的 `commands[0].rawOutputPath`（`raw-outputs/affected-regression.txt`）**文件不存在**，`produce` 仍 exit 0 → 未 stat/未重算；把同一候选 `rawOutputSha256` 改成 `zz-not-a-hash` → exit 1 `STRUCTURE_INVALID: commands[0].rawOutputSha256 is invalid` → 结构校验仍在生效（证明上一条不是"跳过了校验"） | code-health-archive-boundary.test.ts:395-570 | 一致 | — |
| R7 | §4 实现边界 / SSoT §10K.6「`--verify` 不带 `--source-project` 只能是 **package-only**，不得表述为 verified source；只有显式传参才 source-bound 重验」 | `--verify <pkg>` → exit 0 `verificationLevel:"package-only"`, reason `package-only archive package verified`；再加一个**伪** `--source-project`（非 git 目录）→ 仍 exit 0 且 level 仍 `package-only`（package-only manifest 不会被升级）；`--verify` 与 `--campaign/--output` 混用 → exit 2 | code-health-cli.test.ts:900-911（缺 manifest 时只报 package-only）；code-health-archive-boundary.test.ts:381-462、:661+（source-bound 需显式 source project 且 revision 匹配） | 一致 | — |
| R7b | 同上（CLI 级成功路径的**测试覆盖**本身） | `produce` → `--verify` 成功链本轮已真实跑通（见 R5/R7），但**没有任何测试**驱动 CLI 的成功路径：code-health-cli.test.ts 的 archive 用例全为负向（`--help`/缺参/不存在 campaign/缺 manifest） | code-health-cli.test.ts:864-941（仅负向，含末行 `});`） | **无测试覆盖** | 任务 7 断言 **T7-2**：CLI `produce` → `--verify`(package-only) → `--verify --source-project`(source-bound) → 篡改源文件后必须失败（任务 7 骨架的 archive **两条链**已含——链 1：produce 默认级别 / `--verify` / 加 `--source-project` 不升级；链 2：`--verification-level source-bound` 生产 / 带 `--source-project` 通过 / 不带即 exit 1 / 提交级篡改源即 `REVISION_MISMATCH`；本表确认其为**唯一** CLI 级覆盖来源） |
| R8 | §3 / §4 / SSoT §10K.2「Phase 1 候选只 `discovered` / `blocked`（发现 ≠ 结论），跳过的环境不伪造 evidence」 | `--scenario`（1 个可执行场景）→ exit 0，`statuses:["discovered"]`，`changedFiles:[]`，raw 独占写 `<root>/.w-model/code-health/phase1/raw/<ts>-<uuid>.log`；`--scenario`（可执行场景 + `platform:linux, required:true`）→ exit 0，`statuses:["blocked"]`，`unexercisedScenarios:["required-linux"]`、环境矩阵 `observed:"unavailable"`；只给不可用场景时 0 候选（不伪造） | **CLI 级仅本轮手工运行**（见报告日志 P1/P3b/P3，无自动化 CLI 断言）；下列为**进程级（logic）**断言，`code-health-phase1.test.ts:303`（changedFiles 空 + discovered）、`:506-534`，**非 CLI 级** → 补登记 **T7-5** | **文档错**（漏述 `blocked`）→ 已修 | 治理参考 §3 与 §4 P1 行补「候选只 `discovered`/`blocked`（必需环境不可用或目标不可读即 `blocked`）」 |
| R9 | §3 / SSoT §10K.2「`changedFiles` 为前后 worktree 差分（限分析目标），**非空即只读违规**」 | 让场景命令改写被分析目标 `src/service.ts` → exit 1，`PHASE1_JSON.changedFiles:["src/service.ts"]`，`validationViolations:["read-only invariant violated: phase 1 changed src/service.ts"]`；正常场景 `changedFiles:[]` | **CLI 级仅本轮手工运行**（见报告日志 P2，无自动化 CLI 断言）；下列为**进程级（logic）**断言，`code-health-phase1.test.ts:480`（预存改动不误报）、`:506`（工具改动即失败）、`:535`（usage detail），**非 CLI 级** → 补登记 **T7-5** | **文档错**（漏述语义）→ 已修 | 治理参考 §3 补 `changedFiles` 的"限分析目标 / 非空即违规"语义 |
| R10 | §4「Phase 3 `--guard` 是**唯一**可删除测试的路径；`--inventory` 只做结构/默认拒绝/等价证明校验」 | `--inventory <removal-proof> --project <repo-e> --validate`（无 `--guard`）→ exit 1（`embedded inventory ledger is not an accepted authority` + 缺 `--ledger`/`--candidate`），`tests/sample.test.ts` 仍在、worktree 干净；结构型 inventory → exit 0 且无删除；`--guard` 缺 `--project`/`--ledger` → 在任何 suite 运行前 exit 1 | code-health-tests.test.ts:657-687（负向 inventory 断言无 `APPLY_JSON`/`deletedFiles`）、:1041-1170、:1139（FIX-B 失败即回滚） | 一致 | 任务 7 断言 **T7-3**（新增登记）：`--guard` 全链路 e2e（真实 pre/post suite + 经 `code-health-apply.ts` 删除 + 最终证明失败时回滚），任务 7 骨架未含 → **2026-09-18 修复轮 1 已完成**（`code-health-e2e.test.ts` `it('guard 全链路（T7-3）…')`，原 4 个 it 之后新增，第 5 个 it 当前 `:960`） |
| R11 | SSoT §10K.2「P4 `under-review` **不是批准**；权威只能来自 HEAD-tracked ledger」（治理参考 §4 P4 行未述） | 无 `--ledger`：exit 0 `status:"deferred", authorized:false, authoritySource:"unavailable"`；有 tracked ledger：exit 0 `status:"under-review", authorized:true`，**只读**（运行后 worktree 干净、无 patch/无写入）；`ledger.json` 工作区字节 ≠ HEAD blob → exit 2「must be tracked at HEAD with working bytes equal to the HEAD blob」；伪造实现文件路径 → exit 1 | code-health-duplicates.test.ts:543-596、:640-676、:800-830（apply 侧仍需人类批准 + `--matrix/--ledger`） | **文档错**（漏述 `under-review`/`authorized` 语义）→ 已修 | 治理参考 §4 P4 行补「`under-review`/`deferred` 都不是批准（`authorized:true` 仅表示抽象授权事实已具备），权威只能来自 HEAD-tracked ledger」；任务 7 断言 **T7-4**：运行 duplicates 后目标仓 `git status` 不变且输出不含 `APPLY_JSON` → **2026-09-18 修复轮 1 已完成**（`code-health-e2e.test.ts` `it('duplicates 只读（T7-4）…')`，第 6 个 it 当前 `:1109`） |
| R12 | §4 归档/§3 之外：`--root` 与 `--ledger` 的 tracked 权威（工作区字节 = HEAD blob） | 见 R11 的 D4 运行（exit 2）与 code-health-tests 的 `readTrackedJson` 拒绝路径 | code-health-deletion-authority 相关：code-health-tests.test.ts:1041+、code-health-duplicates.test.ts:569-640 | 一致 | — |
| R13 | §3 / §4 / SSoT §10K.1「ledger append-only：`init` 拒绝已存在；`append` 拒绝复用 id / 非法转移 / 缺哈希；`validate` 重放 fail-closed」 | `init` → exit 0；二次 `init` → exit 1 `refusing to overwrite an existing ledger`；`append`(discovery) → exit 0，`validate` → exit 0；重复 event id → exit 1 且 `events` 仍 `["EV-1"]`；`discovered → verified` → exit 1 `TRANSITION_INVALID`；缺 `scopeHash` → exit 1；手改 `status:"archived"` 后 `validate` → exit 1（回放历史不一致） | code-health-cli.test.ts:678（init 幂等拒绝）、:711（复用 id / 非法转移 / 缺 hash）、:793（重放 fail-closed）、:813（未知子命令/未知 flag exit 2） | 一致 | — |
| R14 | §3 / SSoT §10K.1「coverage 只作信号（`coverageIsSignalOnly:true`），100% 不授权跳维度；P2 只读」 | 七维输入 → exit 0 `coverageAuthorization:false, coverageIsSignalOnly:true, rowCount:7`；缺 security → exit 1「coverage is signal-only and cannot substitute a dimension」；仅 coverage（高覆盖）→ exit 1（缺 error/concurrency）；未知 flag → exit 2；matrix 只写 stdout（无写入工作树） | code-health-gap.test.ts:181-184 | 一致 | — |
| R15 | §4 退出码约定「`0/1/2`；未知 flag / 重复值 flag / 缺值 / 缺必需参数一律 exit 2 且不写任何文件」 | 跨 7 个 CLI 真实触发：apply 未知 mode/重复 `--mode` → exit 2 `ERROR_JSON`；archive 未知 level / `--verify`+`--campaign` → exit 2；ledger 未知子命令/未知 flag → exit 2；gap 未知 flag → exit 2；phase1 破坏性 flag 被拒 exit 2；均无文件写入（apply 两次 exit 2 后 `git status` 为空） | code-health-cli.test.ts:174-199（apply 参数错误）、:678-830（ledger）、:873-897（archive）；code-health-gap.test.ts 同类 | 一致 | — |

**判定分布（16 行）：** 一致 × 11（R1/R2/R3/R5/R6/R7/R10/R12/R13/R14/R15）、文档错 × 3（R8/R9/R11，均已改治理参考）、
实现错 × 1（R4，已 TDD 修复 + 新测试）、无测试覆盖 × 1（R7b，登记任务 7）。无悬空项。

**任务 7 e2e 断言登记（本任务产出）：** T7-1 apply 拒绝分支：**运行前 dirty/untracked** 的 scope 文件（delete 后路径集合不变）→ `SCOPE_MISMATCH`，输出保留受控 patch 与 rollback 方案，拒绝文本含成功语 `rollback restored the pre-change worktree`，scope 文件逐字节还原（R3，**2026-09-18 修复轮 2 按可达性重写**骨架第 5 条，措辞见上；「列出残留路径 / 不得声称干净」已删除并改由单元三态用例承重）；
T7-2 archive CLI `produce → verify(package-only) → verify(source-bound) → 篡改源失败`（R7b，骨架的 archive 两条链已含——**修复轮 4 拆成两条独立链**：链 1 断言 package-only 且加 `--source-project` 不升级，链 2 以 `--verification-level source-bound` 生产并断言「带 `--source-project` 通过 / 不带即 exit 1 / 提交级篡改源即 `REVISION_MISMATCH`」；本表确认为唯一覆盖来源）；
T7-3 `--guard` 全链路真删 + 失败回滚（R10，骨架未含，新增 → **2026-09-18 修复轮 1 已完成**：`code-health-e2e.test.ts` `it('guard 全链路（T7-3）…')`，第 5 个 it 当前 `:960`，成功链断言 `applied:true/rolledBack:false/preTestCount:2/postTestCount:1/violations:[]` + victim 消失 + `git status` 为 `D tests/legacy/old.test.mjs` + 受控 patch 落盘，回滚链断言 `applied:false/rolledBack:true` + 违规文本 `coverage artifact was not produced by the controlled run` + victim 复原 + `git diff --exit-code` 为 0）；T7-4 duplicates 只读断言（R11，骨架未含，新增 → **2026-09-18 修复轮 1 已完成**：`it('duplicates 只读（T7-4）…')`，第 6 个 it 当前 `:1109`，断言 `authoritySource:'tracked-ledger'`/`status:'under-review'`/`authorized:true`/`stableProductionCallSites` 双站点 + `git status` 与 HEAD 不变 + stdout 不含 `APPLY_JSON` 且 `.w-model/` 未创建）；
T7-5 phase1 CLI `--scenario` 进程级断言（R8/R9：`statuses` 只 `discovered`/`blocked`、`changedFiles` 非空即 exit 1、raw 落点；
**骨架未含，新增 → 2026-09-18 修复轮 1 已完成**（`it('phase1 CLI（T7-5）…')`，第 7 个 it 当前 `:1160`）——骨架第 4 条（phase1）断言「候选非空且 `candidates.every(status==='discovered')`」「stdout `PHASE1_JSON.changedFiles` 为空」，以及（修复轮 5 已写入骨架的）`report.commands.length === 1`、`report.unexercisedScenarios === []`、`report.validationViolations` 不含只读违规；修复轮 1 补齐的三项为：`blocked` 形态（必需环境不可用 → 候选只 `blocked`、环境矩阵 `unavailable`、exit 0）、`changedFiles` 非空即 exit 1 的**真实 git 差分**负向路径（场景命令真实改写被分析目标，CLI 默认 `readWorktreeChanges` 读出 `['src/unused.ts']`）、raw 落点（`commands[0].rawOutputPath` 位于受控 `.w-model/code-health/phase1/raw/` 且文件真实存在）；上述三项此前**既不在骨架、也无 CLI 级覆盖**——既有 `code-health-phase1.test.ts` 断言全为进程内函数调用（`changedFiles` 非空那条还注入了 fake `readChangedFiles`，见 `:510-532`），不 spawn CLI、不走真实 git 差分）；
T7-6 candidate 或 approval 的 scope 绑定被篡改即拒（scope-mismatch fixture → exit 1 `HUMAN_APPROVAL_REQUIRED` / `errorCode:"SCOPE_MISMATCH"`）+ `git status` 不变、`.w-model/` **逐文件快照运行前后四项全空**（added / removed / bytesChanged / mtimeChanged；**不写「未被创建」**——步骤 2 的 `--mode patch` 已在同一仓落过受控 patch，该目录必然已存在，正确形态见骨架第 6 条）（R3，**恢复修复轮 1 误删的骨架原第 5 条语义**，登记为骨架第 6 条）。

**超出本任务写权限的遗留（交控制者裁定）：** SSoT §10K.4 回滚句写的是 `code-health-apply.ts` 反向应用后
「`git diff --exit-code` 必须为 0」；本任务已把实现对齐为**更严格且对脏工作树无假报**的「按 pre-change 快照做 `git status` 残差回读」
（干净工作树下与 `git diff --exit-code` **不弱于**，即状态快照还覆盖 untracked/staged 项），但 SSoT 属本轮任务不可写文件，
其字面措辞待控制者决定是否同步。**2026-09-18 控制者裁定：该 SSoT 措辞缺口已改派任务 7 收口，本任务不修改 SSoT。**

---

## 收尾记录（任务 10，2026-09-18）

> 本节由任务 10 建立：把分散在各任务报告里的**实测终值**固化到计划内（此前计划没有该节，数据散落在
> `.superpowers/sdd/2026-09-18-leftovers-closeout/task-*-report.md`）。所有数字均为脚本/命令的真实输出；
> 凡与子报告不符者以本节实测为准并注明勘误。

### 1 计数与文案终值同步（任务 10 步骤 1）

**实测口径**（2026-09-18 收口，全部为真实命令输出）：

- `npm run --silent self-test` → 末行「总计 **358** 条用例：358 通过，0 失败」，exit 0。
- 各 `*_CASES` 数组元素数（TS AST 实测，44 个数组）**实加合计 357** + 1 条元数据用例（metadata/version-consistency）= **358**（闭合）。
- `SUBPROCESS_TEST_FILES.length` = **40**（`config/vitest.config.ts`，运行时 import 实测）。
- `w-model-dev/scripts/__tests__/*.test.ts` = **98** 个文件。

**逐处改动（改前 → 改后）**：

| 位置 | 改前 | 改后 | 来源 |
| --- | --- | --- | --- |
| `.code-health-governance.json` `selfTestSamples` | 354 | **358** | `npm run --silent self-test` 总计行 |
| `README.md` 健康指标表 Self-test 行 | `352 条样本` / `✅ 352/352` | **358 / 358/358** | 同上（该表为「当前基线状态」表——表头写「全部门禁实测通过」，同行其它行写「以当前命令输出为准」，非某次运行的历史记录，故按当前实测更新） |
| `CONTRIBUTING.md` §3.2 注释 | 354 条 | **358 条** | 同上 |
| `CONTRIBUTING.md` pre-push 表第 1 项 | 354 条样本 | **358 条样本** | 同上 |
| `CONTRIBUTING.md` 目录树 `self-test.ts` 行 | 354 条样本 | **358 条样本** | 同上 |
| `.githooks/pre-push` 第 1 项注释 | 354 条样本 | **358 条样本** | 同上（只改数字，`# 1.` 前缀与「19 项」未动） |
| `AGENTS.md` §8 `self-test.ts` 行 | 356 条样本 | **358 条样本** | 同上 |
| `docs/user-guide.md:110` | 354 条 | **358 条** | 同上 |
| `docs/INSTALL.md` 脚本清单表 | 352 条样本 | **358 条样本** | 同上 |
| `scripts/test-affected.cjs` `GATES_NOT_COVERED[0]` | 352 条样本 | **358 条样本** | 同上 |
| `w-model-dev/references/subagent-delegation.md` dispatch-matrix `self-test` 行 | 356 条 | **358 条** | 同上 |
| `w-model-dev/scripts/samples/README.md` 首段 | 356 条 | **358 条** | 同上 |
| `w-model-dev/scripts/samples/README.md` 矩阵 `run-log` 行 | `RUN_LOG_CASES（17）` | **`RUN_LOG_CASES（19）`** | AST 实测 `RUN_LOG_CASES` = 19（任务 4 新增 R11 缺失/晚放行两例） |
| `w-model-dev/scripts/samples/README.md` 表下合计段 | 实加 355 / 总计 356 | **实加 357 / 总计 358** | AST 实测 44 个数组实加 357 + 元数据 1 |
| `docs/troubleshooting.md` §1.7a 处置句 | `cli-serial（30 个真实启动子进程的测试文件）` | **去掉固定数字**，改为「清单条目数随新增子进程类测试增长——2026-09-18 收口实测 `SUBPROCESS_TEST_FILES` 为 40 个；『30』是拆分当时的条目数，不是设计常量」 | 运行时 `SUBPROCESS_TEST_FILES.length` = 40 |
| `config/vitest.config.ts` 头注 | 「仓库里 30 个测试文件会真实 execSync/…」 | 「…的测试文件（成员名单 = 下方 `SUBPROCESS_TEST_FILES` 常量；2026-09-18 收口实测 40 个，拆分当时为 30 个）」 | 同上 |
| `w-model-dev/scripts/__tests__/vitest-project-split.test.ts` 头注 | 「仓库 30 个测试文件会真实启动 CLI 子进程」 | 「…（成员名单 = 配置里的 `SUBPROCESS_TEST_FILES` 常量；2026-09-18 收口实测 40 个，拆分当时为 30 个）」 | 同上（**只改注释，未动 `spawnEvidence` 判定与断言**） |

**「30」为什么不写 98**：该数字指的是**真实 spawn 子进程**的测试文件数（cli-serial project 成员，实测 40），
不是目录内 `*.test.ts` 总数（98）。§1.7a / `vitest.config.ts` 的原句是把「30」当成设计常量写的，实际它是可增删的清单长度——
故本次不再写死数字，改为「清单长度 + 实测值/当时值」的形态。

**样式说明（如实登记）**：`CONTRIBUTING.md` / `.githooks/pre-push` / `AGENTS.md` 等处只替换数字，未改任何断言强度与门禁判据（本轮 R5：只许改计数）。

**同时修掉两处不实文案（内容性错误，非计数）**：

1. `w-model-dev/scripts/samples/README.md` 矩阵 `run-log` 行把 R10 写成「`LEGACY_REVERT_EVIDENCE` cutoff 分界」——
   该吸收路径**已删除**（`references/data-models.md` 明写「已删除」，`logic/run-log-logic.ts` 摘要 `r10.legacy` 恒为 0）→
   改为「**严格语义、无时间戳豁免**——`LEGACY_REVERT_EVIDENCE` 吸收路径已删除，摘要 `r10.legacy` 恒为 0」。
2. `docs/superpowers/plans/2026-09-18-leftovers-closeout.md` 自身 T7-6 登记段（§任务 6 审计表 R3 行与下方 T7-6 段）
   仍写「`.w-model/` 未被创建（拒绝早于任何写入）」，与同文件骨架第 6 条（「**不要**写『未被创建』」）及交付实现
   （逐文件快照 added/removed/bytesChanged/mtimeChanged 四项全空）冲突 → 两处均改平为快照形态并注明原因。

### 2 L0 链接审计 rebaseline（任务 10 步骤 2）

**权威实测**（`npm run --silent audit:l0-links`，exit 0）：

```text
L0_LINK_AUDIT_JSON {"type":"l0-link-audit","passed":true,"skillRoot":"w-model-dev",
"relativeLinkCount":676,"l1OnlyCount":95,"templatePlaceholderCount":36,"violations":[],"exitCode":0}
```

**改动**：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` 的 `relativeLinkCount` **675 → 676**（`l1Only` 95 与 `placeholders` 36 **未变**），
并按该文件既有注释链格式补一条 rebaseline 记录（`676 = 675 + 1`）。

**成因（已用 `git diff` 独立复核，非采信）**：`w-model-dev/references/operational-recovery.md` 全文只有 **1 行改动**
（`1 insertion(+), 1 deletion(-)`），即 §门禁顺序表 `check-run-log.ts` 行为补 R9/R10/R11 摘要时新增 1 条同目录链接
`[verifier-spec.md](verifier-spec.md)`——**净 +1 条相对链接**，与 676 = 675 + 1 精确对应（任务 5 修复轮的正当产物，**未回退该链接**）。

**两测试转绿**（`npx vitest run --config config/vitest.config.ts l0-link-audit`）：`l0-link-audit-logic.test.ts`（38 用例）+
`l0-link-audit-cli.test.ts`（11 用例）= **2 files / 49 tests passed**，exit 0。

### 3 任务 3（B）窄口径覆盖实测与阈值出处

`check-coverage-scope.ts --report=coverage/coverage-final.json --min-*=0` 实测（快照 mtime 2026-09-18 11:38，`fileCount=68`，logic 38 个）：

| 口径（logic+lib 白名单分母） | 实测 | 阈值（pre-push 第 13 项） | 取整规则 |
| --- | --- | --- | --- |
| statements | **84.26**（任务 3 首次绿跑 84.25） | **80** | 实测向下取整到 5 的倍数 |
| branches | **77.88**（首次 77.87） | **75** | 同上 |
| functions | **93.68** | **90** | 同上 |
| lines | **87.01** | **85** | 同上 |

- 阈值**出处（两处一致）**：`.githooks/pre-push` 第 13 项注释（「阈值 = 2026-09-18 实测（logic+lib）：stmts 84.25 / branch 77.87 / funcs 93.68 / lines 87.01，向下取整到 5 的倍数」）
  与该行 `run_expect … --min-statements=80 --min-branches=75 --min-functions=90 --min-lines=85`；口径说明见 `config/vitest.config.ts` 的 `coverage` 块注释
  （全分母地板仍为既有 thresholds 75/65/85/75，本次未动）。
- 两次实测四值偏差 ≤ +0.01pp，**远在 ±0.5pp 带内 → 注释值与阈值均未改**。
- 负向自证（任务 3 实跑）：把 `--min-statements` 抬到 100 → `passed:false` + `failures:["statements 84.26 < 阈值 100"]`、exit 1。

### 4 任务 6（N）审计表落点

7 个 code-health CLI × 治理参考的逐行审计表**已在计划内**，见上文「## 任务 6 · N 审计表（7 个 code-health CLI × 治理参考）」
（16 行判定分布：一致 × 11 / 文档错 × 3 / 实现错 × 1 / 无测试覆盖 × 1；行号基准与漂移换算、任务 7 e2e 断言登记 T7-1…T7-6 同节）。本节不重复。

### 5 任务 9（O）实测选文件、规则普查与死规则处置

**coverage 升序前 5（statements%，快照 mtime 2026-09-18 11:38；本节数字为收口时重新读取该快照实测）**：

| 排名 | 文件 | statements% | 三态测试文件 |
| --- | --- | --- | --- |
| 1 | `logic/tla-logic.ts` | **61.22** | `tla-logic-rule-loadbearing.test.ts` |
| 2 | `logic/verifier-logic.ts` | **69.31** | `verifier-logic-rule-loadbearing.test.ts` |
| 3 | `logic/checkpoint-logic.ts` | **69.47** | `checkpoint-logic-rule-loadbearing.test.ts` |
| 4 | `logic/code-health-contract.ts` | **69.83** | `code-health-contract-rule-loadbearing.test.ts` |
| 5 | `logic/root-cause-logic.ts` | **72.63** | `root-cause-logic-rule-loadbearing.test.ts` |
| （6） | `logic/preventive-review-logic.ts` | **78.26** | 未动用（第 6 名） |

- **勘误（对 task-9-report.md §3）**：该报告把第 6 名 pct 写作 `79.17`，**收口实测为 78.26**（前 5 名逐位吻合；本次按 38 个 logic 文件重排，第 7 名 `code-health-gap-logic.ts` 80.00）。本节以 **78.26** 为准。
- **排除项的实测澄清**：计划步骤 1 要求「排除已有负载性测试的 `logic/l0-link-audit-logic.ts`（顺延取第 6 名）」。实测该文件
  statements **83.71、在 38 个 logic 文件中排第 12**，**并不在升序前 5 之内**——即该排除规则**未改变选取结果**（前 5 名与原始升序前 5 名完全相同）。
- **规则负载性三态（GREEN / RED / STRIPPED）普查结果**：5 个文件共建 **43 条规则**（前人 16 + 本次 27），
  RED✓ / STRIPPED✓ / GREEN✓ 三条全过；`npx vitest run --config config/vitest.config.ts rule-loadbearing` 实测 **6 文件 57/57 通过**（含既有 `l0-rule-loadbearing.test.ts` 9 用例）。
- **不可剥离规则清单与原因（如实登记，不硬凑）**：①「无块体单语句 if」（`if (…) reasons.push(…);`）——剥离助手按契约要求锚点后跟块体 `{`，此类形态排除
  （`code-health-contract` 的 `validateRevision` 四字段规则、`verifier-logic` 的 meta/… 等大多数规则属此类）；②`} else {` / `} else if` 形态
  （`tla-logic` 的 `checkHierarchy` 全家、sdCoverage 缺失分支；`root-cause-logic` 的 R1/R3/R6/R10/S13；`checkpoint-logic` 的 R3 未提供 checkpointLog 分支）；
  ③schema 前置拦截的分层防御（`tla-logic` basePath 空串/非串、verifier 的 scoringMethod 枚举 / repeatTimes≥3 / targetKind 枚举 / summary minLength 50）——
  主入口不可达但**非死规则**，保留不改；④可剥但语义不可三态（`tla-logic` R13 非数组分支剥离后对非数组输入抛 TypeError，副本须「不报且不崩」）→ 不建；
  ⑤可剥未建的覆盖面取舍已在 task-9-report §4.1/§4.2/§4.3 逐条登记。
- **死规则**：**未发现**（所有已建三态的 RED 本体均可达）→ **零 `logic/` 实现改动**（本轮 O 只新增测试与 `helpers/strip-rule.ts`，未改任何规则代码）。
- **`strip-rule.ts` 头注更正**（只改注释、未改逻辑）：新增「锚点须从 `//` 行注释起始或代码字符起始、一律单行」前置条件段；
  规则 4 的能力边界收敛为「只拦括号失衡形态」，两类平衡但语义错割的形态（`}`/`else` 分行、多声明符 `as const,`）实测 `logic/` 内 0 例并如实登记。

### 6 任务 8 备选方案使用情况

**未采用备选方案。** 任务 8 的备选是「把剥离副本落到 `logic/__strip_tmp__/`」；实测结论是**主方案可用**——
vitest 下把副本写到 `os.tmpdir()`（文件名含时间戳+随机后缀）再 `await import(绝对路径 .ts fileURL)` 可以真实执行，
18 个 STRIPPED 态全部真实走该路径（import 失败必红）。故 `logic/` 下**没有任何临时副本目录**。

### 7 任务 11（D1 / D2 / D3）修复摘要

来源：外部第三方 8 阶段全流程调测报告 `docs/debug/2026-09-18-wm-8phase-full-trace/REPORT.md` §5.1–§5.3（该目录为未跟踪的第三方审计产物，**不随本次提交交付**）。

| 项 | 缺陷 | 修法 | 回归证据 |
| --- | --- | --- | --- |
| **D1**（中危·误报） | `cli/doctor.ts` 的 `TOOLS_DIR = join(fileURLToPath(import.meta.url), …)` 把**文件**当目录段 → `tla2tools.jar` 在盘仍恒报缺失；`--with-tla` 时升为阻断级 → **jar 在盘也 exit 1**（ok 分支为死代码） | 补 `dirname(...)` | `doctor.ts --json` 由 `warn` → `"status":"ok"`；`--with-tla` 由 exit 1 → **exit 0**；`doctor-logic.test.ts` 新增真实路径回归（1 failed → 12 passed） |
| **D2**（中危·可靠性） | `cli/check-requirement-graph.ts` 的 `resolveAnchorBaseDir()` 用「向上第一个含 `.w-model/` 或 `.git/` 的目录」作项目根 → 被技能自身产出的 **gitignored `.w-model/gate-logs/` 残留**截断 → R15c 误报 exit 1，**同一样本随盘面 1↔0 翻转**（干净 checkout 下 exit 0） | 就近判定 + 仅把「含常规文件的 `.w-model/`」计为项目状态目录（**未采纳**「全局优先 `.git/`」：实测会把嵌套在外部 git 仓内的真实项目误判到外层仓根） | 真仓（残留**在场**）下 fix 前 exit 1 → fix 后 **exit 0**；`graph-logic.test.ts` 三条回归（真实目录树 + 真实 CLI）（3 failed → 59 passed） |
| **D3**（低危·可复现性） | `cli/check-run-log.ts` 的 `--json` 输出携带非确定性 `durationMs`（同输入三轮 169/213/221ms，哈希互异）→ 破坏「同输入同字节」 | 机器通道剔除 `durationMs`、**人类通道 `RUN_LOG_JSON` 按规格保留**；`lib/types.ts` 的 `JsonReport.durationMs` 改可选并在文档写明契约边界；消费者同批更新（断言强度不变 + 新增字节复现断言） | 2 failed → 51 passed；修复轮 2 实跑复核键序（`durationMs` 在 `exitCode` **之前**） |

### 8 外部审计其余发现的登记（**只登记，本轮不修复**）

| 编号 | 内容 | 处置 |
| --- | --- | --- |
| **G1** | `check-tla-model` 无 CLI 级正样本（CLI 需 `.tla` 文件 + 按 manifest 目录可解析的 jar 路径） | 登记，留待后续立项（manifest 级校验由 self-test 15 条覆盖） |
| **G2** | `GRAPH_CASES` 的 phase 2–4 无正向 base 图样本（各仅 1 条负向） | 同上（正向由 ENHANCE 数组在 logic 层覆盖） |
| **G3** | `GATE_CASES` 无 phase 7/8 专属正向样本（终检正向需完整 `.w-model/` 项目树） | 同上 |
| **G4** | `ROLE_DISPATCH_CASES` 3 条全负向（正样本借用 `run-log/phase5-valid.jsonl`） | 同上 |
| **G5** | self-test 实测 358 vs `samples/README.md` 声明「总计 356」的活体文档计数漂移（docs-consistency 静态项未拦截此项） | **本轮已修**（见 §1） |
| **R-1** | `exit2-failure-atomicity` 的「仓库状态逐字节不变」断言对**并发写盘**敏感（审计期间向 `docs/debug/` 写日志即触发伪失败）→ 建议把快照范围收窄到门禁自身产物路径（`gate-logs/` 等） | 登记，未改（本轮 prepush 期间同样需保证无并发写者，故全程串行） |
| **W1** | 工作区 L0 基线 675 vs 实测 676 导致 2 用例确定性失败 | **本轮已解**（见 §2） |
| **W2** | prepush 第 6 项 security-scan exit 1（15 项新增发现未入 baseline） | **本轮已解**（各任务按仓库惯例就地消除风险或补具名 `eslint-disable` 注明理由，**baseline 未重生成、未放宽**；以 prepush 第 6 项实测为准，见 §9） |

### 9 验证命令的真实结果（含 prepush 终值）

**收口前置**：跑全量前确认**无并发写者**（外部第三方会话已于 19:51 落盘收工；进程表无 vitest/tsx 测试进程），
并先 `rm -rf coverage`（陈旧快照）——`npx tsx w-model-dev/scripts/cli/check-pollution.ts` 实测
`POLLUTION_JSON {"passed":true,"findings":[],"findingCount":0,"exitCode":0}`、exit 0。

**全量验收**：`npm run prepush`（= `bash .githooks/pre-push --force`，**19 项**）逐项结果（真实 stdout）：

| # | 门禁项（原样文案） | 退出码 |
| --- | --- | --- |
| 1 | `self-test 全部样本匹配期望` | 0 |
| 2 | `check:verifier 无参数退出 2` | 2（期望） |
| 3 | `check:gate 不存在目录退出 2` | 2（期望） |
| 4 | `check:verifier 有效样本退出 0` | 0 |
| 5 | `check:verifier 无效样本退出 1` | 1（期望） |
| 6 | `security-scan 无新增风险` | 0 |
| 7 | `check-bdd-model 有效 BDD 样本退出 0` | 0 |
| 8 | `check-bdd-model schema 不合规 BDD 样本退出 2` | 2（期望） |
| 9 | `check:coverage 有效覆盖样本退出 0` | 0 |
| 10 | `check:exemption 有效豁免样本退出 0` | 0 |
| 11 | `check-signature-chain 有效签名链样本退出 0` | 0 |
| 12 | `vitest 单元测试 + coverage 阈值通过` | 0 |
| 13 | `规则层覆盖口径 (logic+lib) 达阈值` | 0 |
| 14 | `npm audit 未发现 high 以上漏洞` | 0 |
| 15 | `docs-consistency 活体文档一致` | 0 |
| 16 | `samples 覆盖矩阵一致（无未登记 fixture）` | 0 |
| 17 | `prettier 格式一致性（--check）` | 0 |
| 18 | `tsc 类型检查 0 错误` | 0 |
| 19 | `eval 语料断言与覆盖矩阵全绿` | 0 |

末行：`[pre-push] 全部门禁通过，允许推送 ✓`；`PREPUSH_EXIT=0`（**19/19 全绿**）。
（另有前置 `[ensure-deps] ✓ 平台依赖齐备（win32-x64）`，不计入 19 项。）

**第 13 项在最终全量运行上的复测**（`check-coverage-scope.ts --report=coverage/coverage-final.json --min-statements=80 --min-branches=75 --min-functions=90 --min-lines=85`，报告由同次 vitest 生成、mtime 2026-09-19 02:52）：

```text
COVERAGE_SCOPE_JSON {"fileCount":68,"totals":{"statements":84.84,"branches":78.77,"functions":93.97,"lines":87.6},
"failures":[],"passed":true,…}
```

四值较阈值标定时的 84.25/77.87/93.68/87.01 **只升不降**（O 项新增 5 份三态测试的直接效果），向下取整仍为 **80/75/90/85**——阈值在最终态下同样成立，
故**阈值与其注释值均未改动**（R5：本轮只许改计数，不改断言强度）。

**第 6 项 security-scan 转绿 = W2 解**：本次未 `--regenerate` baseline、未放宽任何规则（各任务就地消除风险或补具名 `eslint-disable` 注明理由），实测「无新增风险」exit 0。

**第 15 项 docs-consistency 转绿**：该项消费同次受控 vitest 运行的 facts/provenance（绑定当前 HEAD），静态项 0 违规——
即本轮全部计数/文案改动与活体文档声明**自洽**（含 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `references/**` 与本次新增的 CHANGELOG 小节）。

**第 1 项 self-test 转绿**：`358/358`（终值，与 §1 一致）。

**第 12 项 vitest 转绿** = W1 解：`l0-link-audit` 两文件在全量套件内通过（另有 §2 的隔离复跑 49/49 为直接证据）。

**未阻断但如实登记**：prepush 的 vitest 以 `--reporter=json --outputFile=<mktemp>` 落盘，其**用例/文件数未打印到 stdout**（该 JSON 由第 12 → 15 项内部消费、运行后随临时目录清理），
故本节不列 vitest 用例总数；如需该数字须单独跑一次全量（本轮不做，避免二次 29 分钟运行与 `coverage/` 二次污染）。

**收尾清理**：prepush 后 `coverage/` 由本次全量运行重新生成，按计划步骤 3 清理（保持工作树只剩待提交改动）。

