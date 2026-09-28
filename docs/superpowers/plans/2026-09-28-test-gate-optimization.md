# 测试/门禁优化 实现计划（2026-09-28）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依规格 `docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md` 五波推进：prepush 35-45 min → ≤15 min、vitest 2617 → ≤2100 例、漂移盲点清零、牙齿重审 T1-T6 有裁定归宿。

**Architecture:** 测量先行（Wave 1 产出时长分解/逐文件榜/契约依赖地图）→ spawn 削减（npx 清理 + CLI 进程内调用层 + 冒烟集中化）→ 同质用例循环内聚合（降计数形态）→ prepush 三车道并行（19 项语义不变）→ 牙齿单口径化/收敛/销账。每波末全量 prepush，波间数据依赖。

**Tech Stack:** bash（Git Bash/MSYS 兼容）、vitest 4（projects/fileParallelism）、tsx、Node 20、PowerShell（执行环境）。

**关键事实（已实测）：**
- prepush 19 项 `.githooks/pre-push`；`run_expect` 在 :304-318；vitest 项 :365-366；audit 函数 :386-405；L3 复用导出 :426-428；门禁区起于 :294。
- 测试子进程调用形态：`const tsxCli = require.resolve('tsx/cli'); runSync(process.execPath, [tsxCli, SCRIPT, ...args], {...})`（如 `__tests__/bdd-cli.test.ts:13,30`）。
- npx tsx 残留 7 处：`check-coding-plan.test.ts:155`、`check-codegraph-queries.test.ts:485`、`coverage-logic.test.ts:397,415,433`、`eval-runner.test.ts:12,21`。
- CLI 收尾模式：`runMain(main)`（`lib/run-main.ts:12`）；`exitWithError` 设 `process.exitCode` 不调 `process.exit`（`lib/cli-error.ts:59-62`）→ 进程内调用只需守卫 + exitCode 保存恢复 + console 捕获。
- 台账守护已自动化：`run-sync.test.ts:420-473` 校验锚命中 1:1、timeout 状态。
- **用例计数口径**：vitest 计数含 `it.each` 行展开——**降计数必须用「循环内多断言」形态**（`it.each` 不降计数）。

---

### Task 0: 建分支

**Files:** 无（git 操作）

- [ ] **Step 1: 从当前 main HEAD 建分支**

```powershell
git checkout -b feat/test-gate-optimization
```

Expected: `Switched to a new branch 'feat/test-gate-optimization'`（基线含规格提交 `fdff622`）

---

## Wave 1 · 测量先行

### Task 1: prepush 计时仪表 + vitest JSON 保留开关

**Files:**
- Modify: `.githooks/pre-push`（工具函数区 :73-76、门禁区开头 :297-301、vitest 项后 :366、结尾 :449）

- [ ] **Step 1: 工具函数区追加 now_ms（node 取毫秒，跨平台）**

在 `fail()` 定义（:75-76）之后追加：

```bash
now_ms() { node -e 'console.log(Date.now())' 2>/dev/null || printf '%s000' "$(date +%s)"; }
```

- [ ] **Step 2: run_expect 增加耗时输出（退出码契约零变化）**

将 :304-318 的 `run_expect` 整体替换为：

```bash
# run_expect <描述> <期望退出码> <命令...>（Wave 1 计时：耗时随行输出，判定逻辑逐字节不变）
run_expect() {
  local desc="$1"; shift
  local expect="$1"; shift
  local t0 t1
  t0="$(now_ms)"
  set +e
  "$@" >"$tmp_log" 2>&1
  local code=$?
  set -e
  t1="$(now_ms)"
  if [ "$code" -ne "$expect" ]; then
    fail "$desc（期望 exit $expect，实际 $code，耗时 $(( (t1 - t0) / 1000 ))s）"
    cat "$tmp_log"
    return 1
  fi
  ok "$desc（exit $code，耗时 $(( (t1 - t0) / 1000 ))s）"
  return 0
}
```

- [ ] **Step 3: 总耗时 + JSON 保留开关**

门禁区开头（`tmp_log="$(mktemp)"` 行前）插入 `PREPUSH_T0="$(now_ms)"`；vitest 项（`run_expect "vitest 单元测试 + coverage 阈值通过" ...` 行）之后插入：

```bash
# Wave 1 基线采集：指定 PREPUSH_KEEP_VITEST_JSON（正斜杠 Windows 路径）时保留逐文件 JSON
if [ -n "${PREPUSH_KEEP_VITEST_JSON:-}" ]; then
  cp "$tmp_vitest_json" "$PREPUSH_KEEP_VITEST_JSON" 2>/dev/null || true
fi
```

结尾 `log "全部门禁通过，允许推送 ✓"` 改为：

```bash
log "全部门禁通过，允许推送 ✓（总耗时 $(( ($(now_ms) - PREPUSH_T0) / 1000 ))s）"
```

- [ ] **Step 4: 语法校验**

Run: `bash -n .githooks/pre-push`
Expected: 无输出（exit 0）

- [ ] **Step 5: Commit**

```powershell
git add .githooks/pre-push
git commit -m "feat(hook): prepush 逐项计时仪表 + PREPUSH_KEEP_VITEST_JSON 保留开关（Wave 1；退出码契约零变化）"
```

### Task 2: 契约依赖地图 + npx 残留确认

**Files:**
- Create: `docs/debug/2026-09-28-test-gate-optimization/contract-map.md`

- [ ] **Step 1: 四类契约 grep 扫描（PowerShell，rg 可用则用 rg）**

```powershell
# ① prepush 结构断言（19 项清单/顺序/首错即停）
rg -n "19 项|首错|prepush|pre-push" AGENTS.md README.md CONTRIBUTING.md CHANGELOG.md docs/INSTALL.md w-model-dev/references/ w-model-dev/scripts/__tests__/README.md docs/troubleshooting.md 2>$null
# ② 用例数断言
rg -n "2617|2615|用例数|vitestTestCount" AGENTS.md README.md CONTRIBUTING.md CHANGELOG.md docs/INSTALL.md w-model-dev/references/ w-model-dev/scripts/__tests__/README.md 2>$null
# ③ SUBPROCESS 清单引用
rg -n "SUBPROCESS_TEST_FILES" -g "!node_modules" -g "!*.log"
# ④ coverage 阈值断言
rg -n "75/65/85/75|stmts 75|thresholds|覆盖.*阈值|coverage 阈值" AGENTS.md README.md CONTRIBUTING.md docs/INSTALL.md w-model-dev/references/ config/ .githooks/ 2>$null
```

- [ ] **Step 2: npx 残留终核**

```powershell
rg -n "npx tsx" w-model-dev/scripts/__tests__/
```

Expected: 恰好 8 行命中（7 处代码 + `check-archive-integrity-cli.test.ts:6` 注释 1 处）。若多于 8 行，把新发现处并入 Task 4 清单。

- [ ] **Step 3: 写 contract-map.md**

表格四列：`契约 | 断言落点（file:line） | 涉及 Wave | 改动面（改文案/改断言/销账）`。逐条登记上述 ①-④ 全部命中。已知必含：`config/vitest.config.ts:35-81`（SUBPROCESS 清单，Wave 2）、`__tests__/README.md`（测试矩阵，Wave 2/3）、pre-push 头注 :13-19 与各项注释（Wave 4）、`config/vitest.config.ts:122-131` coverage 块（Wave 5 T1）、CHANGELOG `[42.4.1]` 历史计数（**不动**，历史条目）。

- [ ] **Step 4: Commit**

```powershell
git add docs/debug/2026-09-28-test-gate-optimization/contract-map.md
git commit -m "docs(debug): Wave 1 契约依赖地图（prepush 结构/用例数/SUBPROCESS/coverage 阈值四类断言落点）"
```

### Task 3: 全量基线运行 + 基线报告（Wave 1 收口）

**Files:**
- Create: `docs/debug/2026-09-28-test-gate-optimization/baseline.md`
- Create: `docs/debug/2026-09-28-test-gate-optimization/prepush-baseline.log`（运行产物）

- [ ] **Step 1: 带保留开关跑全量（约 35-45 min，后台执行）**

```powershell
New-Item -ItemType Directory -Force docs/debug/2026-09-28-test-gate-optimization | Out-Null
$env:PREPUSH_KEEP_VITEST_JSON = 'D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/debug/2026-09-28-test-gate-optimization/baseline-vitest.json'
npm run prepush 2>&1 | Tee-Object docs/debug/2026-09-28-test-gate-optimization/prepush-baseline.log
```

Expected: 末行 `全部门禁通过，允许推送 ✓（总耗时 NNNNNs）`，19 项各带耗时。若任一项失败：先修复环境/记录失败再重跑（基线必须全绿才有意义）。

- [ ] **Step 2: 提取逐文件耗时榜（perfStats 主径 + duration 兜底）**

```powershell
node -e "const d=require('./docs/debug/2026-09-28-test-gate-optimization/baseline-vitest.json'); const rows=d.testResults.map(t=>({file:t.name.replace(/^.*__tests__\//,''),ms:t.perfStats?t.perfStats.runtime:t.assertionResults.reduce((s,a)=>s+(a.duration||0),0),tests:t.assertionResults.length})).sort((a,b)=>b.ms-a.ms); console.log('files='+rows.length); rows.slice(0,30).forEach(r=>console.log(String(Math.round(r.ms)).padStart(8)+'ms '+String(r.tests).padStart(4)+'t '+r.file))"
```

Expected: 30 行耗时榜（cli-serial 文件应占前排）。

- [ ] **Step 3: spawn 密度榜**

```powershell
Get-ChildItem w-model-dev/scripts/__tests__/*.test.ts | ForEach-Object { [pscustomobject]@{ file=$_.Name; spawns=(Select-String -Path $_.FullName -Pattern 'runSync\(|spawnSync\(|execSync\(|execFileSync\(' -AllMatches).Count } } | Sort-Object spawns -Descending | Select-Object -First 20 | Format-Table -AutoSize
```

- [ ] **Step 4: 写 baseline.md 四节**

① `prepush 逐项耗时表`（从 Step 1 log 逐行摘取）；② `vitest 逐文件 top30`（Step 2 输出原样）；③ `spawn 密度 top20`（Step 3 输出原样）；④ `Wave 2/3 选择清单`——Wave 2 转换候选 = ②③ 交集且排除「CLI 自身 spawn/依赖 stdin/依赖 cwd」的文件（排除判定：读该测试文件的 spawn 调用目标与 helper 用法）；Wave 3 候选 = ② 中前 15 文件的逐 `it(` 名称分组。写明 vitest 全量墙钟（总耗时 − 其余项和）。

- [ ] **Step 5: Commit（Wave 1 收口）**

```powershell
git add docs/debug/2026-09-28-test-gate-optimization/
git commit -m "docs(debug): Wave 1 基线报告（时长分解/逐文件榜/spawn 密度/Wave 2-3 选择清单）"
```

---

## Wave 2 · spawn 成本削减

### Task 4: npx 残留清理（7 处）

**Files:**
- Modify: `w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts:483-497`
- Modify: `w-model-dev/scripts/__tests__/check-coding-plan.test.ts:155`
- Modify: `w-model-dev/scripts/__tests__/coverage-logic.test.ts:397,415,433`
- Modify: `w-model-dev/scripts/__tests__/eval-runner.test.ts:12,21`
- Modify: `w-model-dev/scripts/lib/run-sync.ts`（SYNC_PROCESS_EXCEPTIONS 台账 7 条目锚点）

- [ ] **Step 1: 逐站点读取上下文**

对上列 7 处各读前后 10 行，确认：超时值（台账口径 codegraph/coding-plan 90s、coverage-logic 15s、eval-runner 15s）、cwd、是否有 try/catch 依赖 execSync 非零退出抛错语义。

- [ ] **Step 2: 应用统一转换（示例：check-codegraph-queries.test.ts:483-497 真实代码）**

替换前（现状）：

```ts
  function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execSync(`npx tsx "${CLI}" ${args.join(' ')}`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 90_000,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { status: 0, stdout, stderr: '' };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string; message: string };
      return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
    }
  }
```

替换后：

```ts
  function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = runSync(process.execPath, [tsxCli, CLI, ...args], {
      cwd: REPO_ROOT,
      timeout: 90_000,
      windowsHide: true,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }
```

文件头若无则补：`import { runSync } from '../lib/run-sync.js';` 与 `const tsxCli = require.resolve('tsx/cli');`（该文件 :457 已有 runSync git 调用，仅需确认 import 在场；`require` 需 `createRequire`——参 `wm-status.test.ts:21-22` 同款）。

- [ ] **Step 3: 其余 6 处同型转换**

字符串模板参数 → 数组形：`execSync(\`npx tsx ${scriptPath} ${coveragePath} --out-of-scope=${oosPath}\`, {...})` → `runSync(process.execPath, [tsxCli, scriptPath, coveragePath, \`--out-of-scope=${oosPath}\`], { timeout: 15_000, windowsHide: true })`，返回值 `.stdout` 即原 stdout（encoding 已由 runSync 强制 utf-8）。若原站点在 try/catch 中以「抛错」表达失败：改为判 `r.status !== 0` 分支（保留原 catch 内的断言语义）。eval-runner 两处目标脚本是 `eval/runner.ts`（跨目录，数组直传绝对路径即可）。

- [ ] **Step 4: 台账 7 条目更新**

`lib/run-sync.ts` SYNC_PROCESS_EXCEPTIONS 中上述 7 条（api: execSync，file: `__tests__/coverage-logic.test.ts` 等）：anchor 改为新调用起始行文本（如 `const r = runSync(process.execPath, [tsxCli, CLI, ...args], {`），追加 `migratedToRunSync: true`，reason 追加一句 `2026-09-28 Wave 2.1 npx 清理：execSync 字符串模板迁移 runSync 数组形，超时/cwd 语义保留。`（原 reason 保留；**行号史句不动**——Task 18 统一处理）。

- [ ] **Step 5: 定向回归**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts w-model-dev/scripts/__tests__/check-coding-plan.test.ts w-model-dev/scripts/__tests__/coverage-logic.test.ts w-model-dev/scripts/__tests__/eval-runner.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts
```

Expected: 全绿（run-sync.test.ts 的锚 1:1 校验通过即台账更新正确）。

- [ ] **Step 6: Commit**

```powershell
git add w-model-dev/scripts/__tests__/ w-model-dev/scripts/lib/run-sync.ts
git commit -m "perf(test): npx tsx 直调残留 7 处迁移 runSync 数组形（Wave 2.1；砍 npx 解析开销，超时/退出码语义保留，台账锚点同步）"
```

### Task 5: runMain VITEST 守卫（TDD）

**Files:**
- Test: `w-model-dev/scripts/__tests__/run-main.test.ts`（若不存在则新建）
- Modify: `w-model-dev/scripts/lib/run-main.ts:12-26`

- [ ] **Step 1: 写失败测试**

```ts
/**
 * run-main VITEST 守卫（Wave 2 进程内调用层前提）
 *
 * vitest 进程内动态 import CLI 模块时，模块底部的 runMain(main) 不得自执行——
 * 否则 import 即触发真实 CLI 运行。守卫条件 process.env.VITEST 仅在 vitest
 * worker 内为真；真实子进程（tsx 直跑）永不设置。
 */
import { describe, it, expect, vi } from 'vitest';

import { runMain } from '../lib/run-main.js';

describe('runMain VITEST 守卫', () => {
  it('vitest 环境下不自执行 main（进程内调用层前提）', () => {
    const main = vi.fn().mockResolvedValue(undefined);
    runMain(main);
    expect(main).not.toHaveBeenCalled();
  });

  it('非 vitest 环境自执行 main（临时删除 VITEST 后恢复）', async () => {
    const prev = process.env.VITEST;
    delete process.env.VITEST;
    try {
      const main = vi.fn().mockResolvedValue(undefined);
      runMain(main);
      await vi.waitFor(() => expect(main).toHaveBeenCalledTimes(1));
    } finally {
      if (prev !== undefined) process.env.VITEST = prev;
    }
  });
});
```

- [ ] **Step 2: 运行确认第 1 例失败**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-main.test.ts
```

Expected: FAIL——「vitest 环境下不自执行 main」被调用了 1 次。

- [ ] **Step 3: 最小实现**

`lib/run-main.ts` 的 `runMain` 函数体首行插入守卫：

```ts
export function runMain(main: () => Promise<void>): void {
  // Wave 2 进程内调用层：vitest worker 内 import 时不自执行（helpers/cli-invoker.ts
  // 显式调用 main(argv)）；真实子进程（tsx 直跑）永不设置 VITEST。
  if (process.env.VITEST) return;
  main().catch((err: unknown) => {
    // ……原 catch 逻辑逐字节不变
  });
}
```

- [ ] **Step 4: 运行确认全绿 + 全量冒烟**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-main.test.ts
```

Expected: PASS ×2。再抽查一个真实子进程 CLI 测试确认不受影响：

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-status.test.ts
```

Expected: PASS（tsx 子进程内 VITEST 未设置，runMain 正常自执行）。

- [ ] **Step 5: Commit**

```powershell
git add w-model-dev/scripts/lib/run-main.ts w-model-dev/scripts/__tests__/run-main.test.ts
git commit -m "feat(lib): runMain 增加 VITEST 自执行守卫（Wave 2 进程内调用层前提；真实子进程路径零变化）"
```

### Task 6: cli-invoker helper + wm-status 试点转换 + 冒烟文件 + 保真对照

**Files:**
- Create: `w-model-dev/scripts/__tests__/helpers/cli-invoker.ts`
- Create: `w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts`
- Modify: `w-model-dev/scripts/__tests__/wm-status.test.ts`（全量转换）
- Modify: `w-model-dev/scripts/cli/wm-status.ts:47`（main 签名化）
- Modify: `config/vitest.config.ts:35-81`（冒烟文件登记 SUBPROCESS）

- [ ] **Step 1: 写 cli-invoker.ts**

```ts
/**
 * CLI 进程内调用层（Wave 2 试点起用）
 *
 * 前提：lib/run-main.ts 的 VITEST 守卫阻止 import 时自执行；CLI 均以
 * process.exitCode 赋值收尾（lib/cli-error.ts exitWithError 同款），不调
 * process.exit——本 helper 仅保存/恢复 exitCode 并捕获 console 输出。
 * 真实子进程保真面由 __tests__/cli-subprocess-smoke.test.ts（每 CLI 一条）
 * 与 48 条 exit-2 探针独立承载，不因进程内化归零。
 * 不适用面：CLI 自身再 spawn 子进程 / 依赖真实 stdin / 依赖进程 cwd 的用例
 * ——留在子进程形态（规格 §4.2）。
 */
import { format } from 'node:util';

import { vi } from 'vitest';

export interface InvokeCliResult {
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

export async function invokeCli(cliModule: string, argv: string[]): Promise<InvokeCliResult> {
  const prevExitCode = process.exitCode;
  const out: string[] = [];
  const err: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    out.push(format(...a) + '\n');
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    err.push(format(...a) + '\n');
  });
  try {
    process.exitCode = undefined;
    vi.resetModules();
    const mod = (await import(cliModule)) as { main(argv: string[]): Promise<void> };
    await mod.main(argv);
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = prevExitCode;
  return { exitCode, stdout: out.join(''), stderr: err.join('') };
}
```

- [ ] **Step 2: wm-status.ts main 签名化（默认参 = 零调用点变化）**

`w-model-dev/scripts/cli/wm-status.ts:47`：

```ts
// 替换前
async function main(): Promise<void> {
// 替换后
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
```

函数体内所有 `process.argv.slice(2)` / `process.argv` 读取改用 `argv`（底部 `runMain(main);` 不动——无参调用走默认参）。

- [ ] **Step 3: 建冒烟文件（每 CLI 一条真实子进程；wm-status 首行）**

```ts
/**
 * CLI 真实子进程冒烟（Wave 2：进程内化后唯一保留的真实 spawn 面，集中单文件）
 *
 * 每个 CLI 一条：最小有效夹具 → 期望退出码 + 关键 stdout 标记。
 * 全量三态/负例由进程内用例（helpers/cli-invoker.ts）与 48 条 exit-2 探针承载。
 * 本文件在 SUBPROCESS_TEST_FILES 登记（真实 spawn，串行项目）。
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_JSON =
  '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';

describe('wm-status 真实子进程冒烟', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-smoke-'));
    await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.w-model', 'project.json'), PROJECT_JSON, 'utf-8');
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  it('最小夹具 exit 0 + STATUS_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/wm-status.ts'), tmpDir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('STATUS_JSON ');
  });
});
```

`config/vitest.config.ts` SUBPROCESS_TEST_FILES 追加 `'cli-subprocess-smoke.test.ts'`。

- [ ] **Step 4: wm-status.test.ts 全量转换**

头注 :7-8 过时声明（「main() 顶层执行并调用 process.exit，无法直接 import 测试」）改写为：

```ts
 * 进程内说明：经 helpers/cli-invoker.ts 调用导出的 main(argv)（runMain 的 VITEST 守卫
 * 阻止 import 自执行）；真实子进程保真由 cli-subprocess-smoke.test.ts 承载。
```

`run()` helper（:52-55）替换为：

```ts
/** 进程内调用 wm-status（argv[0] = 项目根，CLI 不依赖 cwd） */
async function run(...args: string[]): Promise<{ code: number | undefined; stdout: string; stderr: string }> {
  return invokeCli('../cli/wm-status.js', [tmpDir, ...args]);
}
```

顶部加 `import { invokeCli } from './helpers/cli-invoker.js';`，删除 `tsxCli`/`SCRIPT` 两行（:22,23；**`runSync` import（:19）与 `createRequire`（:21）保留**——下方保真对照用例仍需真实子进程，Task 9 移交冒烟后随对照用例一并删除）。全部用例 `const r = run();` → `const r = await run();`。**追加保真对照用例**（试点专属，验证逐字节一致）：

```ts
  it('保真对照（试点）：进程内输出与真实子进程逐字节一致', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const inproc = await run();
    const real = runSync(process.execPath, [require.resolve('tsx/cli'), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/wm-status.ts'), tmpDir]);
    expect(inproc.exitCode).toBe(real.status);
    expect(inproc.stdout).toBe(real.stdout);
  });
```

（该用例使本文件仍含 1 处真实 spawn——试点期保留；Task 9 推广时对照职责移交冒烟文件后删除。）

- [ ] **Step 5: 定向回归**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts
```

Expected: 全绿（vitest-project-split 双向守护确认冒烟文件已登记）。

- [ ] **Step 6: Commit**

```powershell
git add w-model-dev/scripts/__tests__/helpers/cli-invoker.ts w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/cli/wm-status.ts config/vitest.config.ts
git commit -m "perf(test): cli-invoker 进程内调用层 + wm-status 试点转换（Wave 2.2；含逐字节保真对照，冒烟集中文件建立）"
```

### Task 7: verifier-logic 试点转换（check-verifier-output）

**Files:**
- Modify: `w-model-dev/scripts/__tests__/verifier-logic.test.ts`
- Modify: `w-model-dev/scripts/cli/check-verifier-output.ts:49-53`
- Modify: `w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts`（追加冒烟行）
- Modify: `config/vitest.config.ts`（若 verifier-logic 全零 spawn 则移出 SUBPROCESS）

- [ ] **Step 1: check-verifier-output.ts main 签名化**

`w-model-dev/scripts/cli/check-verifier-output.ts:49`：

```ts
// 替换前
async function main(): Promise<void> {
// 替换后
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
```

:51-53 的 `process.argv.slice(2)` 读取改用 `argv`；底部 `runMain(main);` 不动。

- [ ] **Step 2: 读 verifier-logic.test.ts，识别 spawn helper 与用例族**

:35 `VERIFIER_SCRIPT = resolve(TEST_DIR, '../cli/check-verifier-output.ts')`；找到全部 `runSync(process.execPath, [tsxCli, VERIFIER_SCRIPT, ...])` 调用点与夹具构造（verifier 样本多在 `scripts/samples/verifier/`，入参为文件路径——进程内直传同一路径）。

- [ ] **Step 3: 转换（Task 6 同款三步）**

helper → `invokeCli('../cli/check-verifier-output.js', [samplePath, ...args])`；`const r = run(...)` → `await`；追加一条保真对照（同输入，进程内 vs `runSync` 真实子进程，exitCode/stdout 逐字节断言）。

- [ ] **Step 4: 冒烟文件追加一条**

```ts
describe('check-verifier-output 真实子进程冒烟', () => {
  it('有效样本 exit 0 + 报告头标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/check-verifier-output.ts'), path.resolve(TEST_DIR, '../samples/verifier/valid.json')]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Verifier 输出校验');
  });
});
```

- [ ] **Step 5: 定向回归 + 清单双向核对**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts
```

Expected: 全绿。若转换后该文件**零真实 spawn**：从 SUBPROCESS_TEST_FILES 移除 `verifier-logic.test.ts`（vitest-project-split 红灯会强制）；保真对照用例保留 1 处 spawn 则暂留清单，Task 9 统一移交。

- [ ] **Step 6: Commit**

```powershell
git add w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts config/vitest.config.ts
git commit -m "perf(test): check-verifier-output 试点进程内化（Wave 2.2 试点 2；exitWithError 路径保真验证 + 冒烟行）"
```

### Task 8: run-sync.test.ts 盲点登记（规格 T5 并入）

**Files:**
- Modify: `config/vitest.config.ts:35-81`（清单 + 头注销账）
- Modify: `w-model-dev/scripts/__tests__/run-sync.test.ts`（无需改测试本体，登记即可）

- [ ] **Step 1: 登记进 SUBPROCESS_TEST_FILES**

清单追加 `'run-sync.test.ts'`（:475-489 的 `vi.doUnmock` 后真实 spawn `runRealSync` —— 文件级 mock 判定的既知盲点，如实登记优于逐调用点 AST 判定的复杂度）。

- [ ] **Step 2: 头注销账**

`config/vitest.config.ts:23-25`「已知盲点（HEAD 既存…）」段替换为：

```ts
//   已清（2026-09-28 Wave 2/T5）：run-sync.test.ts 顶部 vi.mock 使文件级判定为
//   非 spawn，但其「terminates a real slow child」用例经 vi.doUnmock 真实 spawn——
//   已如实登记进 SUBPROCESS_TEST_FILES（登记口径优先于判定口径，宁串行勿漏判）。
```

- [ ] **Step 3: 定向回归**

```powershell
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts
```

Expected: 全绿。

- [ ] **Step 4: Commit**

```powershell
git add config/vitest.config.ts
git commit -m "fix(config): run-sync.test.ts 真实 spawn 盲点登记（spec T5；宁串行勿漏判，头注销账）"
```

### Task 9: 推广转换（按 Task 3 榜单）+ SUBPROCESS 收缩

**Files:**
- Modify: 按 `docs/debug/2026-09-28-test-gate-optimization/baseline.md` §Wave 2 选择清单（预计 8-15 个测试文件 + 对应 cli/*.ts + 冒烟文件 + config/vitest.config.ts）

- [ ] **Step 1: 逐文件执行转换配方（每文件）**

1. 读文件：识别 spawn helper、用例数、夹具来源；
2. CLI main 签名化（Task 6 Step 2 同款，仅当该 CLI 尚未导出）；
3. 用例转换（Task 6 Step 4 同款；试点期保真对照用例删除——对照职责已由冒烟承载）；
4. 冒烟文件追加该 CLI 一条（最小夹具 → 期望退出码 + 关键标记）；
5. 该文件零真实 spawn → 从 SUBPROCESS_TEST_FILES 移除；仍有留守 spawn → 留在清单并记录原因；
6. 定向：`npx vitest run --config config/vitest.config.ts <该文件> w-model-dev/scripts/__tests__/vitest-project-split.test.ts w-model-dev/scripts/__tests__/cli-subprocess-smoke.test.ts`。

**排除面（不转，登记原因）**：CLI 自身再 spawn（如 docs-consistency 自采集路径）、依赖真实 stdin、依赖进程 cwd 且 CLI 无路径参数、`platform-deps-*`/`pre-commit-hook`（测的是 bash/git 外部进程本身）。

- [ ] **Step 2: 每 3-5 文件一组提交**

```powershell
git add <本组文件>
git commit -m "perf(test): 进程内化第 N 组（<文件名清单>；冒烟行追加，SUBPROCESS 收缩）"
```

- [ ] **Step 3: 注释计数自描述（规格 T4 部分）**

`config/vitest.config.ts:10-12` 计数句（「2026-09-18 收口实测 40 个…为 41 个」）改为：

```ts
//   成员名单 = 下方 SUBPROCESS_TEST_FILES 常量；清单长度以常量为准，
//   由 vitest-project-split.test.ts 双向守护（源码证据 ↔ 登记一一对应）。
```

- [ ] **Step 4: Wave 2 收口全量 prepush（含判定 §4.3 启用与否）**

```powershell
$env:PREPUSH_KEEP_VITEST_JSON = 'D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/debug/2026-09-28-test-gate-optimization/wave2-vitest.json'
npm run prepush 2>&1 | Tee-Object docs/debug/2026-09-28-test-gate-optimization/wave2-prepush.log
```

Expected: 19 项全绿 + 总耗时显著下降。**记录 vitest 全量墙钟**：≤12 min → Task 10 标记「不做」；>12 min → 执行 Task 10。

- [ ] **Step 5: Commit 收口**

```powershell
git add docs/debug/2026-09-28-test-gate-optimization/ config/vitest.config.ts
git commit -m "docs(debug): Wave 2 收口记录（进程内化清单/留守原因/墙钟实测）"
```

### Task 10（条件）: serial 池分组并行

> 启用判据：Task 9 Step 4 实测 vitest 全量墙钟 >12 min。≤12 min 则本任务整体标记「不做（判据未触发）」并在收口记录登记。

**Files:**
- Modify: `config/vitest.config.ts:88-111`

- [ ] **Step 1: cli-serial 拆两组（组内串行、组间并行）**

把 `cli-serial` project 替换为两个 project（成员按 Task 9 收口后清单对半分——冒烟/平台类归 a 组，其余归 b 组）：

```ts
      {
        test: {
          name: 'cli-serial-a',
          include: [...subprocessGlobsA],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'cli-serial-b',
          include: [...subprocessGlobsB],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          fileParallelism: false,
        },
      },
```

（`subprocessGlobsA/B` 由 SUBPROCESS_TEST_FILES 按索引奇偶派生：`SUBPROCESS_TEST_FILES.filter((_, i) => i % 2 === 0)` 等——单一事实源不裂变。）

- [ ] **Step 2: flaky 门槛——连跑 3 次全量**

```powershell
1..3 | ForEach-Object { npm test 2>&1 | Select-Object -Last 5 | Tee-Object -Variable out; if ($LASTEXITCODE -ne 0) { Write-Host "RUN $_ FAILED"; break } else { Write-Host "RUN $_ OK" } }
```

Expected: `RUN 1 OK / RUN 2 OK / RUN 3 OK`。任一失败 → **整组回退**（恢复单一 cli-serial project）并在收口记录登记「B6 同型复现，回退」。

- [ ] **Step 3: Commit**

```powershell
git add config/vitest.config.ts
git commit -m "perf(test): cli-serial 拆两组组间并行（Wave 2.3；3 连跑零 flaky 门槛通过）"
```

---

## Wave 3 · 同质用例合并

### Task 11: 同质用例扫描表

**Files:**
- Create: `docs/debug/2026-09-28-test-gate-optimization/merge-candidates.md`

- [ ] **Step 1: 候选扫描（对 Wave 2 收口后耗时前 15 文件）**

```powershell
# 逐文件列 it( 名称，按「名称前缀（至 ：或（ 前）」分组找同族
Get-ChildItem w-model-dev/scripts/__tests__/*.test.ts | ForEach-Object { $f=$_.Name; Select-String -Path $_.FullName -Pattern "^\s*it\('([^']+)'" | ForEach-Object { "$f|$($_.Matches[0].Groups[1].Value)" } } | Out-File -Encoding utf8 docs/debug/2026-09-28-test-gate-optimization/it-names.txt
```

人工（或子代理）审阅 `it-names.txt`：同文件内**结构同构、仅数据/输入不同**的相邻 it 族 = 候选。

- [ ] **Step 2: 写 merge-candidates.md**

表格：`文件 | 族（it 名称区间） | 现例数 | 聚合后例数 | 断言信息保全方式（消息参数指名条目） | 风险`。**种子候选（已核实）**：`schema-validation.test.ts:625-647`「additionalProperties/required/type 错误以 [schema] 前缀返回」3 例 → 1 例。目标合计减量 ≥517（2617→≤2100）；不足则 §Step 3 启用 self-test/eval 面。

- [ ] **Step 3: Commit**

```powershell
git add docs/debug/2026-09-28-test-gate-optimization/merge-candidates.md
git commit -m "docs(debug): Wave 3 同质用例扫描表（before→after 逐族登记）"
```

### Task 12: 执行合并（循环内聚合形态）

**Files:**
- Modify: merge-candidates.md 登记的各测试文件

- [ ] **Step 1: 种子候选先行（schema-validation.test.ts:625-647 真实代码）**

替换前（3 例）：

```ts
  it('additionalProperties 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-additional-props.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /additionalProperties/.test(r))).toBe(true);
  });

  it('required 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-missing-required.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /required/.test(r))).toBe(true);
  });

  it('type 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-wrong-type.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /type/.test(r))).toBe(true);
  });
```

替换后（1 例，**循环内多断言形态——it.each 不降计数，禁用**）：

```ts
  it('schema 错误族以 [schema] 前缀返回（additionalProperties / required / type 三态）', async () => {
    for (const [sample, pattern] of [
      ['bad-additional-props.json', /additionalProperties/],
      ['bad-missing-required.json', /required/],
      ['bad-wrong-type.json', /type/],
    ] as const) {
      const data = await loadJson(schemaSamplesDir, sample);
      const result = checkVerifierOutput(data);
      expect(result.passed, `${sample} passed`).toBe(false);
      expect(result.reasons.some((r) => /\[schema\]/.test(r)), `${sample} 前缀`).toBe(true);
      expect(result.reasons.some((r) => pattern.test(r)), `${sample} 关键词`).toBe(true);
    }
  });
```

- [ ] **Step 2: 按表逐族执行（同款形态），每文件后定向回归**

```powershell
npx vitest run --config config/vitest.config.ts <该文件>
```

每族在 merge-candidates.md 勾选完成 + 登记「仍被覆盖（指向聚合用例）/ 有意退休（理由）」。

- [ ] **Step 3: 计数达标检查**

```powershell
npx vitest run --config config/vitest.config.ts --reporter=json --outputFile=.tmp-wave3-count.json | Out-Null
node -e "const d=require('./.tmp-wave3-count.json'); const n=d.numTotalTests; console.log('cases='+n); if(n>2100){console.error('EXCEEDS 2100'); process.exit(1)}"
```

Expected: `cases=NNNN`（≤2100）exit 0。若 >2100：启用 Task 13 的补充删减面后复测。

- [ ] **Step 4: Wave 3 收口全量 prepush**

```powershell
npm run prepush 2>&1 | Tee-Object docs/debug/2026-09-28-test-gate-optimization/wave3-prepush.log
```

Expected: 19 项全绿。

- [ ] **Step 5: Commit（按文件分组 + 收口）**

```powershell
git add w-model-dev/scripts/__tests__/ docs/debug/2026-09-28-test-gate-optimization/
git commit -m "test: 同质用例循环内聚合（Wave 3；逐族登记仍被覆盖/有意退休，计数 ≤2100）"
```

### Task 13: self-test / eval 重审（条件补充删减面）

**Files:**
- Create: `docs/debug/2026-09-28-test-gate-optimization/self-test-eval-review.md`

- [ ] **Step 1: 同质样本对扫描**

```powershell
# self-test 用例条目按目标脚本分组，找「同脚本、同三态、输入仅微差」的对
rg -n "const \w+_CASES" w-model-dev/scripts/cli/self-test.ts
# eval 语料：同 trigger 边界的重复条目
Get-ChildItem eval/corpus -Recurse -File | Group-Object { $_.Directory.Name } | Where-Object Count -gt 8 | Format-Table Name, Count
```

- [ ] **Step 2: 写重审表**

`面 | 条目 | 同质对象 | 裁定（保留理由 / 可合并 / 可退休）`。**默认保留**（self-test 是进程内非瓶颈、eval 是交付资产）；仅当 Task 12 Step 3 计数 >2100 时，把「可合并/可退休」行转为执行清单（删减同样登记「仍被覆盖指向」），否则本任务产物仅为登记表（诚实呈现，不硬凑）。

- [ ] **Step 3: Commit**

```powershell
git add docs/debug/2026-09-28-test-gate-optimization/self-test-eval-review.md
git commit -m "docs(debug): self-test/eval 重审登记表（Wave 3；默认保留，条件删减面未触发/已触发如实记录）"
```

---

## Wave 4 · prepush 分层重组

### Task 14: 三车道并行重组（19 项语义清单不变）

**Files:**
- Modify: `.githooks/pre-push:294-449`（门禁区整体重写；前置区 :1-293 与依赖检查区不动）
- 同步面：按 contract-map.md（pre-push 头注执行说明、command-reference prepush 条目、`__tests__/README.md` 执行顺序表述）

- [ ] **Step 1: 门禁区替换**

将 `# ---------- 门禁用例 ----------`（:294）至 `exit 0`（:450）整体替换为：

```bash
# ---------- 门禁用例（Wave 4 三车道重组；19 项语义清单不变）----------
# L1 并行车道：静态项 + 独立项，与 L2 同时发起；L2 主车道：vitest 全量 + coverage；
# L3 尾车道：依赖 L2 产物（provenance 封装 → coverage-scope / docs-consistency）。
# 退出语义：任一项退出码不符预期 → 整体 exit 1（与重组前一致）。
# 执行形态差异（如实登记）：重组前首错即停；重组后跑完全部车道再汇总——
# 全部 19 项通过才 exit 0 的契约不变，换取完整失败画像与并行墙钟。
# 输出容错：后台 job 内 printf 一律 2>/dev/null || true（沿用 fd 兼容模式）。

tmp_log="$(mktemp)"
tmp_vitest_dir="$(mktemp -d)"
tmp_vitest_json="$tmp_vitest_dir/results.json"
tmp_vitest_provenance="$tmp_vitest_dir/provenance.json"
lane_dir="$(mktemp -d)"
trap 'rm -f "$tmp_log"; rm -rf "$tmp_vitest_dir" "$lane_dir"' EXIT

PREPUSH_T0="$(now_ms)"

# par_expect <序号> <描述> <期望退出码> <命令...>：后台执行；退出码/起止毫秒落盘
par_expect() {
  local idx="$1"; shift
  local desc="$1"; shift
  local expect="$1"; shift
  printf '%s' "$(now_ms)" >"$lane_dir/$idx.start"
  (
    set +e
    "$@" >"$lane_dir/$idx.log" 2>&1
    printf '%s' "$?" >"$lane_dir/$idx.code"
    printf '%s' "$(now_ms)" >"$lane_dir/$idx.end"
  ) &
  printf '%s|%s|%s|%s\n' "$idx" "$!" "$expect" "$desc" >>"$lane_dir/order.txt"
}

# 第 14 项 npm audit 的自定义期望封装（0 通过；255/1 + 网络信号 = 0 语义跳过）
item14_audit() {
  tmp_log="$lane_dir/14.log"
  set +e
  npm audit --audit-level=high >"$tmp_log" 2>&1
  local audit_code=$?
  set -e
  if [ "$audit_code" -eq 0 ]; then return 0; fi
  if { [ "$audit_code" -eq 255 ] || [ "$audit_code" -eq 1 ]; } && audit_can_skip; then
    printf '[pre-push] ⚠ npm audit 网络不可达或 registry 不支持 audit endpoint，跳过（不阻断）\n' >>"$tmp_log" 2>&1 || true
    return 0
  fi
  return 1
}

# ---- L1 + L2 同时发起（序号 = 原 19 项编号，语义逐项对应）----
par_expect 1  "self-test 全部样本匹配期望" 0 npm run self-test
par_expect 2  "check:verifier 无参数退出 2" 2 npm run check:verifier
par_expect 3  "check:gate 不存在目录退出 2" 2 npm run check:gate -- /tmp/nonexistent
par_expect 4  "check:verifier 有效样本退出 0" 0 npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid.json
par_expect 5  "check:verifier 无效样本退出 1" 1 npm run check:verifier -- w-model-dev/scripts/samples/verifier/bad-ranking-k.json
par_expect 6  "security-scan 无新增风险" 0 npx tsx w-model-dev/scripts/cli/security-scan.ts
par_expect 7  "check-bdd-model 有效 BDD 样本退出 0" 0 npx tsx w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/samples/bdd/valid-manifest.json --phase=1
par_expect 8  "check-bdd-model schema 不合规 BDD 样本退出 2" 2 npx tsx w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/samples/bdd/bad-schema.manifest.json --phase=1
par_expect 9  "check:coverage 有效覆盖样本退出 0" 0 npm run check:coverage -- w-model-dev/scripts/samples/coverage/valid-minimal-coverage.json
par_expect 10 "check:exemption 有效豁免样本退出 0" 0 npm run check:exemption -- w-model-dev/scripts/samples/exemption/valid-full-approval.json
par_expect 11 "check-signature-chain 有效签名链样本退出 0" 0 npx tsx w-model-dev/scripts/cli/check-signature-chain.ts w-model-dev/scripts/samples/signature-chain/valid-all-roles.jsonl --phase=1
par_expect 12 "vitest 单元测试全量 + coverage 采集" 0 npx vitest run --coverage --reporter=json --outputFile="$tmp_vitest_json" --config config/vitest.config.ts
par_expect 14 "npm audit 依赖漏洞扫描（high 以上阻断）" 0 item14_audit
par_expect 16 "samples 覆盖矩阵一致（无未登记 fixture）" 0 npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
par_expect 17 "prettier 格式一致性（--check）" 0 npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"
par_expect 18 "tsc 类型检查 0 错误" 0 npx tsc -p config/tsconfig.json
par_expect 19 "eval 语料断言与覆盖矩阵全绿" 0 npx tsx eval/runner.ts

if [ -n "${PREPUSH_KEEP_VITEST_JSON:-}" ]; then
  cp "$tmp_vitest_json" "$PREPUSH_KEEP_VITEST_JSON" 2>/dev/null || true
fi

# ---- 汇总 L1+L2（按发起顺序等待并判定）----
fail_count=0
while IFS='|' read -r idx pid expect desc; do
  wait "$pid"
  code="$(cat "$lane_dir/$idx.code" 2>/dev/null || printf '1')"
  ms=$(( $(cat "$lane_dir/$idx.end" 2>/dev/null || printf '%s' "$(now_ms)") - $(cat "$lane_dir/$idx.start") ))
  if [ "$code" -ne "$expect" ]; then
    fail "$desc（期望 exit $expect，实际 $code，耗时 $((ms / 1000))s）"
    cat "$lane_dir/$idx.log" 2>/dev/null || true
    fail_count=$((fail_count + 1))
  else
    ok "$desc（exit $code，耗时 $((ms / 1000))s）"
  fi
done <"$lane_dir/order.txt"
if [ "$fail_count" -ne 0 ]; then
  fail "并行车道 $fail_count 项不符预期，中止"
  exit 1
fi

# ---- L3 尾车道（依赖第 12 项产物，顺序执行）----
node -e 'const fs=require("fs"),crypto=require("crypto"),cp=require("child_process"),path=require("path"); const artifact=process.argv[1], provenance=process.argv[2], root=process.cwd(); const raw=fs.readFileSync(artifact,"utf8"), d=JSON.parse(raw), sha=crypto.createHash("sha256").update(raw,"utf8").digest("hex"), head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(), runId=crypto.randomBytes(8).toString("hex"); fs.writeFileSync(provenance, JSON.stringify({format:"w-model-vitest-provenance",version:1,commitSha:head,runId,artifactRelativePath:path.basename(artifact),artifactSha256:sha,measurements:d},null,2)+"\n");' "$tmp_vitest_json" "$tmp_vitest_provenance"
export WM_VITEST_COUNT_FILE="$(cygpath -w "$tmp_vitest_json" 2>/dev/null || printf '%s' "$tmp_vitest_json")"
export WM_VITEST_PROVENANCE_FILE="$(cygpath -w "$tmp_vitest_provenance" 2>/dev/null || printf '%s' "$tmp_vitest_provenance")"
export WM_VITEST_PROVENANCE_ROOT="$(cygpath -w "$tmp_vitest_dir" 2>/dev/null || printf '%s' "$tmp_vitest_dir")"

run_expect "规则层覆盖口径 (logic+lib) 达阈值" 0 \
  npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json \
  --min-statements=80 --min-branches=75 --min-functions=90 --min-lines=85 || exit 1

run_expect "docs-consistency 活体文档一致" 0 npm run check:docs-consistency || exit 1

log "全部门禁通过，允许推送 ✓（总耗时 $(( ($(now_ms) - PREPUSH_T0) / 1000 ))s）"
exit 0
```

注：`audit_has_blocking_signal` / `audit_can_skip` 函数定义（原 :386-405）**原样保留**在门禁区之前（item14_audit 引用）；第 13/15 项注释随行迁移；第 12 项注释改写（阈值描述在 Task 16 移除，此处先保留原文案——**本任务不碰阈值**）。

- [ ] **Step 2: 语法校验**

```powershell
bash -n .githooks/pre-push
```

Expected: 无输出（exit 0）。

- [ ] **Step 3: Commit**

```powershell
git add .githooks/pre-push
git commit -m "feat(hook): prepush 三车道并行重组（Wave 4；19 项语义/退出码契约不变，L3 复用 L2 产物，首错即停→全量汇总如实登记）"
```

### Task 15: 重组验证 ×3 + 文档同步（Wave 4 收口）

**Files:**
- Modify: 按 contract-map.md 的 Wave 4 行（预计：pre-push 头注 :13-19、`w-model-dev/references/command-reference.md` prepush 条目、`__tests__/README.md` 执行顺序句、`AGENTS.md` §6 若断言顺序）

- [ ] **Step 1: 连跑 3 次取中位**

```powershell
1..3 | ForEach-Object { npm run prepush 2>&1 | Select-Object -Last 1 | Tee-Object -Variable last; Write-Host "RUN $_ : $last" }
```

Expected: 3 次末行均 `全部门禁通过…（总耗时 NNNNNs）`；中位 ≤15 min（Wave 2 已削 vitest 墙钟的前提下应显著低于此）。任何一次失败 → 回查车道日志（`$lane_dir` 已清理，靠末次失败输出定位）修复后重跑 3 次。

- [ ] **Step 2: 文档逐点同步（按 contract-map）**

- pre-push 头注 :13-19：触发条件不变，追加一句「执行为三车道并行（Wave 4），19 项清单与退出码契约不变」；
- command-reference prepush 条目：执行结构描述同步；
- `__tests__/README.md` / AGENTS：凡断言「顺序执行/首错即停」的句子改为「并行执行、全量汇总、任一不符即 exit 1」。

- [ ] **Step 3: 旧形态零残留校验**

```powershell
rg -n "首错即停|顺序执行 19" AGENTS.md README.md CONTRIBUTING.md w-model-dev/references/ w-model-dev/scripts/__tests__/README.md .githooks/pre-push
```

Expected: 仅历史条目（CHANGELOG / docs/debug / docs/changes/archive）命中；活体文档零命中。

- [ ] **Step 4: Commit（Wave 4 收口）**

```powershell
git add .githooks/pre-push AGENTS.md README.md CONTRIBUTING.md w-model-dev/references/ w-model-dev/scripts/__tests__/README.md
git commit -m "docs: Wave 4 重组同步面（头注/command-reference/README/AGENTS 执行结构表述；3 连跑中位实测登记）"
```

---

## Wave 5 · 牙齿重审落地

### Task 16: T1 coverage 单口径化

**Files:**
- Modify: `config/vitest.config.ts:113-131`（coverage 块）
- Modify: `.githooks/pre-push` 第 12 项注释（阈值句移除）
- 同步面：contract-map.md ④ 行落点（AGENTS/README 若复述双阈值）

- [ ] **Step 1: vitest.config.ts coverage 块改写**

```ts
  // 覆盖率门禁（2026-09-28 Wave 5/T1 单口径化）：唯一强制口径 = pre-push 第 13 项
  // check-coverage-scope（logic+lib 白名单分母重算，阈值见 pre-push 注释）。
  // 历史注记：全分母阈值（stmts 75/branch 65/funcs 85/lines 75，基线 2026-08-12）已撤销——
  // v8 provider「被 import 文件必入报告」使全分母混入 cli/ 层（2026-09-17 实测全分母
  // stmts 76.83 距阈值仅 1.8pp，「新增低覆盖 CLI import 即假红」与产品回归无关）。
  // instrumentation（provider/include/reporter）保留：coverage-final.json 供第 13 项消费。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    reporter: ['text', 'json'],
  },
```

（原 :113-121 注释段与 :128-130 thresholds 行整体替换；include 保留——聚焦运行时生效且第 13 项白名单独立重算，全量运行的 v8 行为如实保留在注记中，规格 T6 销账。）

- [ ] **Step 2: pre-push 第 12 项注释同步**

第 12 项 par_expect 行的行内注释改为「vitest 全量 + coverage 采集（instrumentation 供第 13 项 scope 口径消费；阈值强制在第 13 项——2026-09-28 T1 单口径化）」。

- [ ] **Step 3: 回归**

```powershell
npx vitest run --coverage --reporter=json --outputFile=.tmp-t16.json --config config/vitest.config.ts
npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report=coverage/coverage-final.json --min-statements=80 --min-branches=75 --min-functions=90 --min-lines=85
```

Expected: vitest exit 0（无阈值阻断）+ `check-coverage-scope` exit 0（scope 口径牙齿仍在）。`npm run coverage` 语义变化（不再全分母阻断）在 CHANGELOG 登记。

- [ ] **Step 4: 文档同步（按 contract-map ④）+ Commit**

```powershell
git add config/vitest.config.ts .githooks/pre-push
git commit -m "refactor(coverage): 双口径单口径化（spec T1；scope 口径为唯一牙齿，全分母假红面撤销并如实登记）"
```

### Task 17: T2 npm audit 容错收敛

**Files:**
- Modify: `.githooks/pre-push:386-405`（audit_can_skip 简化；audit_has_blocking_signal 原样保留）

- [ ] **Step 1: audit_can_skip 收敛为枚举短表**

替换 `audit_can_skip`（:392-405）为：

```bash
# 2026-09-28 Wave 5/T2 收敛：仅识别 npm 自身前缀行上的明确网络层信号（错误码枚举 /
# network 词面 / socket hang up / audit endpoint 不支持 / registry 连通性说明）。
# 原复合正则的「状态词须同行锚定」「registry 上下文 404」等分支撤销——收敛只缩小
# 可跳过面（未识别一律 fail-closed 阻断），不放宽任何放行；撤销分支所防的
# 「HTML 错误页正文误放行」由「必须 npm error/warn/err! 前缀行首」这一前提独立覆盖。
audit_can_skip() {
  if audit_has_blocking_signal; then
    return 1
  fi
  grep -qiE \
    '^npm (error|warn|err!)[[:space:]]+((code|errno)[[:space:]]+(ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ENOTSUP|ENOAUDIT|E429)|(audit[[:space:]]+)?network([[:space:]:]|$)|problem related to network|NOT_IMPLEMENTED|does not support audit endpoint|.*socket hang up)' \
    "$tmp_log"
}
```

- [ ] **Step 2: 判定单元验证（echo 样本）**

```powershell
bash -c "printf 'npm error code ECONNREFUSED\n' | grep -qiE '^npm (error|warn|err!)[[:space:]]+((code|errno)[[:space:]]+(ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ENOTSUP|ENOAUDIT|E429)|(audit[[:space:]]+)?network([[:space:]:]|$)|problem related to network|NOT_IMPLEMENTED|does not support audit endpoint|.*socket hang up)' && echo MATCH"
bash -c "printf 'Bad Gateway via some proxy html page\n' | grep -qiE '^npm (error|warn|err!)[[:space:]]+((code|errno)[[:space:]]+(ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNRESET|ENOTSUP|ENOAUDIT|E429)|(audit[[:space:]]+)?network([[:space:]:]|$)|problem related to network|NOT_IMPLEMENTED|does not support audit endpoint|.*socket hang up)' || echo NO-MATCH"
```

Expected: `MATCH` / `NO-MATCH`。

- [ ] **Step 3: bash -n + Commit**

```powershell
bash -n .githooks/pre-push
git add .githooks/pre-push
git commit -m "refactor(hook): npm audit 容错判定收敛为枚举短表（spec T2；只缩小可跳过面，fail-closed 默认不变）"
```

### Task 18: T3 评估 + reason 行号史清理 + T4 收尾 + T6 销账

**Files:**
- Modify: `w-model-dev/scripts/lib/run-sync.ts`（SYNC_PROCESS_EXCEPTIONS 各条 reason）
- Modify: `config/vitest.config.ts`（T4 注释若 Task 9 未竟）
- Create: `docs/debug/2026-09-28-test-gate-optimization/teeth-adjudication.md`（裁定表终稿）

- [ ] **Step 1: T3 评估登记**

`run-sync.test.ts:420-473` 已自动校验：锚命中行 ↔ 真实调用行 1:1、timeout 状态、migrated 条目齐全。裁定：**台账结构字段已脚本守护，无需新增派生机制**；剩余手工面 = reason 中的行号漂移史注释。在 teeth-adjudication.md 登记 T3 行：`防什么 | 触发证据 | 替代承载（既有守护 :420-473）| 裁定（结构字段已自动化；行号史清理见 Step 2）`。

- [ ] **Step 2: reason 行号史清理（机械编辑）**

对 SYNC_PROCESS_EXCEPTIONS 每条 reason：删除「（行号 2026-09-XX …上移/下移 N 行…）」括号段（**保留**其余事实：迁移记录、豁免理由、超时说明）。示例：

```ts
// 替换前
    reason:
      'B3 migrated git status probe through runSync; retained as audit provenance with a 15-second timeout.（行号 2026-09-04 archival-fixes 随 diff 调用多行化下移 3 行）',
// 替换后
    reason:
      'B3 migrated git status probe through runSync; retained as audit provenance with a 15-second timeout.',
```

锚（anchor）字段不动——它是内容寻址、由守护校验。清理后 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts` 全绿。

- [ ] **Step 3: T4/T6 收尾 + 裁定表终稿**

- T4：确认 `config/vitest.config.ts` 计数句已自描述（Task 9 Step 3），SUBPROCESS 清单长度为收口实测值；
- T6：确认 Task 16 注记已含「全量运行 exclude 不生效如实保留」销账句；
- teeth-adjudication.md 写全 T1-T6 六行（防什么/触发证据/替代承载/裁定）+ 签收列。

- [ ] **Step 4: Commit**

```powershell
git add w-model-dev/scripts/lib/run-sync.ts config/vitest.config.ts docs/debug/2026-09-28-test-gate-optimization/teeth-adjudication.md
git commit -m "refactor(lib): 台账 reason 行号史清理 + T1-T6 裁定表终稿（Wave 5；锚/结构字段守护不动）"
```

---

### Task 19: 终局验收 + 版本 42.5.0 + CHANGELOG + 规格实测结果

**Files:**
- Modify: `CHANGELOG.md`（新 `[42.5.0]` 条目）
- Modify: `docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md`（追加「实测结果」节）
- 版本六镜像：`node scripts/version-bump.cjs`（自带同步）

- [ ] **Step 1: 终局 3 连跑（与 Task 15 独立，终态含 Wave 5 改动）**

```powershell
1..3 | ForEach-Object { npm run prepush 2>&1 | Select-Object -Last 1 | Tee-Object -Variable last; Write-Host "RUN $_ : $last" }
```

Expected: 3 次全绿；**中位 ≤15 min**（硬指标下限）。记录三次总耗时。

- [ ] **Step 2: 用例数终核（复用 Step 1 末次运行的 JSON）**

Step 1 运行前先设保留开关（三次连跑均生效，末次 JSON 即终态）：

```powershell
$env:PREPUSH_KEEP_VITEST_JSON='D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/debug/2026-09-28-test-gate-optimization/final-vitest.json'
```

Step 1 完成后执行：

```powershell
node -e "const d=require('./docs/debug/2026-09-28-test-gate-optimization/final-vitest.json'); const n=d.numTotalTests; console.log('final cases='+n); if(n>2100) process.exit(1)"
```

Expected: `final cases=NNNN` ≤2100，exit 0。

- [ ] **Step 3: 版本六镜像**

```powershell
Get-Content scripts/version-bump.cjs -TotalCount 30   # 读用法（参数形态以脚本头为准）
node scripts/version-bump.cjs 42.5.0                  # 按脚本实际用法执行
rg -n "42\.5\.0" package.json README.md AGENTS.md CHANGELOG.md docs/INSTALL.md w-model-dev/SKILL.md
```

Expected: 六镜像处 `42.5.0` 零残留旧版本（镜像集合以 version-bump 脚本声明为准，rg 输出恰为脚本声明的落点数）。

- [ ] **Step 4: CHANGELOG `[42.5.0]` 条目**

按既有条目格式登记，骨架（每处含「原牙齿 → 替代承载」）：

```markdown
## [42.5.0] - 2026-09-28

### 测试/门禁优化（五波；规格 docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md）

- **提速**：prepush 三车道并行重组（19 项语义/退出码契约不变；首错即停→全量汇总如实登记）；CLI 测试进程内化（cli-invoker + runMain VITEST 守卫；真实子进程保真集中 cli-subprocess-smoke.test.ts，48 条 exit-2 探针不动）；npx tsx 直调 7 处迁移 runSync。prepush 实测 NNNN→NNNN s（中位）。
- **瘦身**：同质用例循环内聚合，vitest 2617→NNNN 例（逐族登记「仍被覆盖/有意退休」，merge-candidates.md）。
- **降维护**：SUBPROCESS 注释计数自描述；run-sync.test.ts spawn 盲点登记（宁串行勿漏判）；台账 reason 行号史清理。
- **牙齿重审（teeth-adjudication.md T1-T6）**：coverage 双口径→单口径（scope 为唯一牙齿；全分母假红面撤销）；npm audit 容错收敛（只缩小可跳过面）；台账守护确认既有自动化；coverage exclude 不生效销账。
```

- [ ] **Step 5: 规格追加「实测结果」节**

在规格文档末尾追加：`## 11. 实测结果（2026-09-28 收口）`——五波各一小节（关键数字 + 产物指针：baseline.md / merge-candidates.md / teeth-adjudication.md / wave*-prepush.log），硬指标对照表（时长中位 / 用例数 / 盲点清零 / flaky 零）。

- [ ] **Step 6: 终局 Commit + 收口报告**

```powershell
git add CHANGELOG.md docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md docs/debug/2026-09-28-test-gate-optimization/ package.json
git commit -m "chore(release): 42.5.0 测试/门禁优化收口（五波全绿；prepush 中位 NNNNs、vitest NNNN 例、牙齿裁定 T1-T6 归宿，六镜像同步）"
```

---

## 计划自审记录

1. **规格覆盖**：§3 Wave 1→Task 1-3；§4.1→Task 4；§4.2→Task 5-7（试点）+Task 9（推广）+T5→Task 8；§4.3→Task 10（条件）；§5→Task 11-13；§6→Task 14-15；§7 T1→Task 16、T2→Task 17、T3/T4/T6→Task 18；§8 纪律→各波收口步 + Task 19；§2 硬指标→Task 19 Step 1-2。规格 §4.2「每 CLI 保留 ≥1 条真实子进程冒烟」细化为「集中单冒烟文件」（否则每文件 1 条 spawn 使文件永留串行项目、并行收益归零——同牙更优结构，已在冒烟文件头注与 Task 6 说明）。
2. **占位扫描**：数据依赖步骤（Task 3 榜单、Task 11 扫描表）均为「产物驱动 + 明确判定规则 + 已核实种子示例」，沿用本仓审计表惯例，无 TBD。
3. **类型/形态一致性**：`invokeCli(cliModule, argv)` 签名在 Task 6 定义、Task 7/9 复用同参；`main(argv: string[] = process.argv.slice(2))` 默认参形态三处一致；par_expect 的 `idx|pid|expect|desc` 落盘格式与汇总解析 IFS 一致；用例计数降量统一「循环内多断言」形态（it.each 不降计数，规格 §5 提及的 it.each 形态经实测口径否定，统一为循环形——已在 Task 12 Step 1 标注禁用理由）。
