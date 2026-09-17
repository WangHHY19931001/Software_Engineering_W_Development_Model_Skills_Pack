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
    if (String(g.timestamp) <= String(e.timestamp)) have.add(String(g.script));
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

（字段访问须对齐文件内既有 `valid` 数组元素类型与 `e.script` 的类型守卫写法；`timestamp` 比较用与 R7 相同的字符串 ISO 比较惯例。）`RunLogCheckResult` 增 `closure?: { checkedGates: number; missing: number }`（checkedGates=closureOk 键数，missing=violations 中 R11 条数）。

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

把 `code-health-cli.test.ts` 中的 `tempRoot` / `createTempGitRepository` / `loadApplyFixture` / `bindRevision` / `writeJson` / `runCli` / `gitStatus` / `gitHead` / `APPLY_SAMPLES` 常量原样搬到 `helpers/code-health-fixtures.ts` 并 `export`（含各自的 eslint 豁免注释一起搬）；原文件改为 `import { ... } from './helpers/code-health-fixtures.js'`。运行 `npx vitest run --config config/vitest.config.ts code-health-cli` 确认全绿（行为不变的纯重构）。

- [ ] **步骤 2：编写 e2e 测试（先写，跑出失败/缺失再补）**

```ts
// w-model-dev/scripts/__tests__/code-health-e2e.test.ts
// 真实 git 工作区全链路（N）：规则层单测不覆盖的跨 CLI 消费契约与真实 git 触点。
// 链路：ledger init → append(discovered) → append(approved) → apply dry-run → patch → commit
//       → patch 模式回滚证伪 → archive produce → verify(package-only) → verify(source-bound)
//       → 篡改源后 source-bound 必须失败 → phase1 真实仓只读发现。
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createTempGitRepository, runCli, tempRoot, writeJson,
} from './helpers/code-health-fixtures.js';

it('apply 全链路：dry-run 不落盘 → patch 落盘 → commit 前移 HEAD，rollback 证伪可执行', async () => {
  const root = await createTempGitRepository();
  const dir = await tempRoot('code-health-e2e-');
  const ledger = path.join(dir, 'campaign.json');
  const baseline = await writeJson(dir, 'baseline.json', { /* 与 code-health-cli.test.ts 的 revision 形态一致：由 revisionProvider.current(root) 取得后写入 */ });
  expect(runCli('code-health-ledger.ts', ['init', '--ledger', ledger, '--campaign-id', 'CH-E2E', '--baseline', baseline]).code).toBe(0);
  // candidate/event/approval：以 samples/code-health/valid-candidate.json / valid-ledger-event.json / valid-approval.json
  // 经 bindRevision 绑定当前 revision 后写盘（与 code-health-cli.test.ts 同法）。
  // 断言序列：
  // 1) apply --mode dry-run → code 0，stdout 含 proposal JSON，gitStatus(root) 与前置相同；
  // 2) apply --mode patch → code 0，gitStatus(root) 显示目标文件已改；
  // 3) git apply -R <patch> 后 git diff --exit-code → 空输出（回滚证伪，治理参考的可回滚承诺）；
  // 4) 重新 patch 后 apply --mode commit → code 0，gitHead(root) 前移且工作树干净；
  // 5) scope 外文件被篡改进 candidate（scope-mismatch fixture）→ apply code 1 且工作树不变。
});

it('archive 链路：produce → package-only verify → source-bound verify → 篡改源后失败', async () => {
  // campaign 目录：ledger.json + candidate.json + approval.json（produce 的读取契约，见 code-health-archive.ts:202-204）。
  // 1) code-health-archive.ts --campaign <dir> --output <pkg> → code 0，pkg 内含 SHA-256 manifest；
  // 2) code-health-archive.ts --verify --manifest <pkg>/manifest.json（无 --source-project）→ code 0
  //    且输出 verdict 为 package-only（不得声称 source-bound）；
  // 3) 同上加 --source-project <root> → code 0；
  // 4) 篡改 <root> 内被登记的源文件 → code 1（source-bound 重验 fail-closed）。
});

it('phase1 真实仓只读发现：候选全 discovered、changedFiles 为空、报告落盘', async () => {
  // code-health-phase1.ts --root <tmp git repo> --output <repo 外 report.json>
  //   --scenario <{"scenarios":[{"id":"smoke","environment":"win32-git-bash","reached":false,"observation":"unavailable"}]}>
  // → code 0；report.candidates.every(c => c.status === 'discovered')；report.changedFiles 为空/undefined。
});
```

实现注意（写代码时落实，不是留白）：每条 `runCli([...])` 的完整参数数组必须写全（第一个元素是脚本名如 `'code-health-ledger.ts'`，子命令与 flag 参照任务 6 审计表记录的真实用法与 `code-health-cli.test.ts` 现有调用）；`baseline` 的形态来自 `code-health-cli.test.ts` 顶部 `revision` 的构造方式（同文件可见）；phase1 的 scenario JSON 形态取自 `code-health-phase1.test.ts:267` 一带的 `scenarios` 数组元素。三个 it 全部落在 `cli-serial` 项目（SUBPROCESS 登记后自动路由），无并行竞争。

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
