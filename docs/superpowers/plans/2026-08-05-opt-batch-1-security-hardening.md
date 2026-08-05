# 批次 1 实施计划：安全加固（isMain / cleanTraceFiles / server.cjs / safe-json）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 4 项安全缺陷——① state-machine isMain 守卫 Windows 路径静默放行（P1）；② cleanTraceFiles 误删面白名单化（P2）；③ server.cjs 命令注入面 execFile 化（P2）；④ 全仓 JSON.parse 原型污染防御（P3）。本批不改版本号（批次 5 收尾统一升 33.0.0）。

**Architecture:** 4 项独立修复，互不依赖：① isMain 用 `fileURLToPath`（对齐其余 8 个脚本成熟写法）；② `cleanTraceFiles` 增加两层守卫（目录含 `.tla` 才清理 + `states/` 须含 TLC 产物特征），新增 `isTlcStatesDir` 纯函数导出供单测；③ `BRAINSTORM_OPEN_CMD` 拆分为 bin+args 走 `execFile`（无 shell）；④ 新增 `lib/safe-json.ts`（`parseJsonSafe` + reviver 丢 `__proto__`），接入 read-json-or-exit 与全部 CLI parse 入口。设计 spec：[`docs/superpowers/specs/2026-08-05-opt-batch-1-security-hardening-design.md`](../../docs/superpowers/specs/2026-08-05-opt-batch-1-security-hardening-design.md)。

**Tech Stack:** TypeScript strict + tsx + vitest；safe-json.ts 仅 node 内置；check-tla-model.ts 的 fs 操作留在 CLI 层（纯逻辑层 *-logic.ts 不 import node:fs 边界不变）。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 跑 vitest 单文件：`npx vitest run w-model-dev/scripts/__tests__/<file>.test.ts`。
- vitest 基线 363 / 28 files、self-test 213 条：本批预期 **+4**（safe-json 单测 3-4 条 + isTlcStatesDir/cleanTraceFiles 单测 3-4 条），回归后按实测更新。
- `*-logic.ts` 纯逻辑层不得 import node:fs / node:child_process（pure 边界）；本批 fs 操作仅存在于 check-*.ts CLI 层。

## 任务总览（6 任务）

| 任务 | 内容 | 产物 | commit |
|---|---|---|---|
| 1 | isMain 守卫修复 | check-state-machine-consistency.ts | `fix(state-machine): isMain 守卫 fileURLToPath` |
| 2 | cleanTraceFiles TLC 白名单 + 单测（TDD） | check-tla-model.ts + `__tests__/tla-clean-trace.test.ts` | `fix(tla): cleanTraceFiles TLC 产物白名单` |
| 3 | server.cjs execFile 化 | `.cursor/skills/brainstorming/scripts/server.cjs` | `fix(brainstorm): BRAINSTORM_OPEN_CMD execFile 化` |
| 4 | safe-json 工具 + 单测（TDD）+ read-json-or-exit 接入 | `lib/safe-json.ts` + `__tests__/safe-json.test.ts` + read-json-or-exit.ts | `feat(lib): safe-json 原型污染防御` |
| 5 | CLI 脚本 parse 入口批量接入 | 14 个 CLI/工具脚本 + self-test.ts + schema-loader.ts + run-log-logic.ts | `refactor(scripts): parse 入口统一 parseJsonSafe` |
| 6 | 全量回归 + 行为验证 + 提交 | 回归证据 | —（任务 1-5 已逐个 commit） |

---

## Task 1: isMain 守卫修复

**Files:**
- Modify: `w-model-dev/scripts/check-state-machine-consistency.ts:22`（加 import）、`:159-165`（isMain 守卫）

- [ ] **Step 1: 增加 `fileURLToPath` import**

在 `check-state-machine-consistency.ts` 顶部（现有 `import * as path from 'node:path';` 之后）加：

```ts
import { fileURLToPath } from 'node:url';
```

- [ ] **Step 2: 替换 isMain 守卫实现**

将第 159-165 行：

```ts
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.url.replace('file:///', ''));
  } catch {
    return false;
  }
})();
```

替换为：

```ts
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
```

- [ ] **Step 3: 类型检查 + 行为验证**

Run: `npx tsc --noEmit`
Expected: 0 错误。

Run: `npx tsx w-model-dev/scripts/check-state-machine-consistency.ts w-model-dev/scripts/samples/state-machine/valid-consistent.json`
Expected: 输出状态机一致性校验报告，`STATE_MACHINE_JSON ... "passed":true`，退出码 0（确认 isMain=true、main 正常执行）。

Run: 在含空格/中文的临时路径下复制脚本与样本复验：
```powershell
$tmp = Join-Path $env:TEMP "state machine 测试";
New-Item -ItemType Directory -Force -Path $tmp | Out-Null;
Copy-Item w-model-dev/scripts/check-state-machine-consistency.ts $tmp;
Copy-Item w-model-dev/scripts/samples/state-machine/valid-consistent.json $tmp;
Copy-Item -Recurse w-model-dev/scripts/lib $tmp;
npx tsx "$tmp/check-state-machine-consistency.ts" "$tmp/valid-consistent.json"
```
Expected: 正常输出校验报告（修复前此处 isMain=false 会静默退出码 0 且无输出）。

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/scripts/check-state-machine-consistency.ts
git commit --no-gpg-sign -m "fix(state-machine): isMain 守卫 fileURLToPath 修复 Windows 路径静默放行"
```

---

## Task 2: cleanTraceFiles TLC 白名单加固（TDD）

**Files:**
- Modify: `w-model-dev/scripts/check-tla-model.ts:165-204`（cleanTraceFiles + 新增 isTlcStatesDir）
- Create: `w-model-dev/scripts/__tests__/tla-clean-trace.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `w-model-dev/scripts/__tests__/tla-clean-trace.test.ts`：

```ts
/**
 * check-tla-model.ts cleanTraceFiles / isTlcStatesDir 单元测试
 *
 * 覆盖（批次 1 安全加固 §3.2）：
 *  - 守卫 1：目录无 .tla 文件 → 不删除任何内容
 *  - 守卫 2：states/ 含 TLC 时间戳子目录 → 递归删除
 *  - 守卫 2：states/ 含 .st/.fp 指纹文件 → 递归删除
 *  - 守卫 2：states/ 无 TLC 特征（空或无关文件）→ 跳过不删
 *  - *.dump / *.out 文件仅在有 .tla 的目录删除
 */

import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cleanTraceFiles, isTlcStatesDir } from '../check-tla-model.js';

const tmpRoots: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-clean-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map(d => fs.rm(d, { recursive: true, force: true })));
});

describe('isTlcStatesDir', () => {
  it('含 TLC 时间戳子目录 → true', async () => {
    const dir = await makeTmpDir();
    await fs.mkdir(path.join(dir, '2026-08-05-10-30-00'));
    expect(await isTlcStatesDir(dir)).toBe(true);
  });

  it('含 .st 指纹文件 → true', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.st'), 'x');
    expect(await isTlcStatesDir(dir)).toBe(true);
  });

  it('空目录 → false', async () => {
    const dir = await makeTmpDir();
    expect(await isTlcStatesDir(dir)).toBe(false);
  });

  it('含无关文件（非 TLC 产物）→ false', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'README.md'), 'not tlc');
    expect(await isTlcStatesDir(dir)).toBe(false);
  });

  it('目录不存在 → false', async () => {
    expect(await isTlcStatesDir(path.join(os.tmpdir(), 'no-such-tlc-dir-xyz'))).toBe(false);
  });
});

describe('cleanTraceFiles', () => {
  it('目录无 .tla 文件 → 不删除任何内容（守卫 1）', async () => {
    const dir = await makeTmpDir();
    await fs.mkdir(path.join(dir, 'states'));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'keep');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted).toEqual([]);
    expect((await fs.readdir(dir)).sort()).toEqual(['notes.txt', 'states']);
  });

  it('含 .tla + states/ 为 TLC 时间戳产物 → 删除 states 与 *.dump/*.out', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
    await fs.mkdir(path.join(dir, 'states', '2026-08-05-10-30-00'), { recursive: true });
    await fs.writeFile(path.join(dir, 'states', '2026-08-05-10-30-00', 'L2-AuthService.st'), 'x');
    await fs.writeFile(path.join(dir, 'trace.dump'), 'x');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted.sort()).toEqual([
      path.join(dir, 'states'),
      path.join(dir, 'trace.dump'),
    ].sort());
    expect(await fs.readdir(dir)).toEqual(['L2-AuthService.tla']);
  });

  it('含 .tla + states/ 无 TLC 特征 → 跳过 states 不删，仅删 *.out（守卫 2）', async () => {
    const dir = await makeTmpDir();
    await fs.writeFile(path.join(dir, 'L2-AuthService.tla'), 'MODULE L2-AuthService');
    await fs.mkdir(path.join(dir, 'states'));
    await fs.writeFile(path.join(dir, 'states', 'business-data.txt'), 'keep');
    await fs.writeFile(path.join(dir, 'trace.out'), 'x');
    const deleted = await cleanTraceFiles(dir);
    expect(deleted).toEqual([path.join(dir, 'trace.out')]);
    expect(await fs.readdir(path.join(dir, 'states'))).toEqual(['business-data.txt']);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/tla-clean-trace.test.ts`
Expected: FAIL——`cleanTraceFiles` / `isTlcStatesDir` 未从 `check-tla-model.js` 导出。

- [ ] **Step 3: 实现白名单加固**

在 `check-tla-model.ts` 中：

1) 在文件顶部常量区（`cleanTraceFiles` 定义之前）加：

```ts
/** TLC 时间戳子目录模式：states/YYYY-MM-DD-HH-MM-SS/ */
const TLC_TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;
```

2) 将 `async function cleanTraceFiles(dir: string): Promise<string[]> {` 改为 `export async function cleanTraceFiles(...)`，并将整个函数体（第 176-204 行）替换为：

```ts
export async function cleanTraceFiles(dir: string): Promise<string[]> {
  const deleted: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return deleted;
  }
  // 守卫 1：TLC 产物只产生于含 .tla 规格文件的目录；无 .tla 则跳过整个清理
  if (!entries.some(name => name.endsWith('.tla'))) {
    return deleted;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (name.endsWith('.dump') || name.endsWith('.out')) {
      try {
        await fs.rm(full, { force: true });
        deleted.push(full);
      } catch {
        /* 忽略单个文件清理失败 */
      }
    }
    if (name === 'states') {
      // 守卫 2：states/ 必须是 TLC 产物（时间戳子目录或含 .st/.fp 指纹），否则跳过
      if (await isTlcStatesDir(full)) {
        try {
          await fs.rm(full, { recursive: true, force: true });
          deleted.push(full);
        } catch {
          /* 忽略 states 目录清理失败 */
        }
      }
    }
  }
  return deleted;
}

/**
 * 判定目录是否为 TLC 产物目录：含时间戳子目录，或直接含 .st/.fp/.dump/.out 文件。
 * 批次 1 安全加固：防误删与 .tla 同级的同名业务 states/ 目录。
 */
export async function isTlcStatesDir(dir: string): Promise<boolean> {
  let children: string[];
  try {
    children = await fs.readdir(dir);
  } catch {
    return false;
  }
  for (const c of children) {
    if (TLC_TIMESTAMP_DIR.test(c)) return true;
    if (c.endsWith('.st') || c.endsWith('.fp') || c.endsWith('.dump') || c.endsWith('.out')) return true;
  }
  return false;
}
```

- [ ] **Step 4: 跑测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/tla-clean-trace.test.ts`
Expected: 9 条全部 PASS。

- [ ] **Step 5: 全量 vitest + self-test 回归**

Run: `npx vitest run`
Expected: 363+9=372 条全通过（含新增 9 条）。

Run: `npm run self-test`
Expected: 213 条全通过（cleanTraceFiles 行为对既有样本无影响）。

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/scripts/check-tla-model.ts w-model-dev/scripts/__tests__/tla-clean-trace.test.ts
git commit --no-gpg-sign -m "fix(tla): cleanTraceFiles TLC 产物白名单（防误删同名 states 目录）"
```

---

## Task 3: server.cjs execFile 化

**Files:**
- Modify: `.cursor/skills/brainstorming/scripts/server.cjs:537-548`（maybeOpenBrowser 内 BRAINSTORM_OPEN_CMD 分支）

- [ ] **Step 1: 替换 BRAINSTORM_OPEN_CMD 分支**

将 `maybeOpenBrowser()` 内第 537-542 行：

```js
  const cp = require('child_process');
  // Operator-provided launcher: run as given (this env var is trusted operator input).
  if (process.env.BRAINSTORM_OPEN_CMD) {
    try { cp.exec(process.env.BRAINSTORM_OPEN_CMD + ' ' + JSON.stringify(url), () => {}); } catch (e) { /* best effort */ }
    return;
  }
```

替换为：

```js
  const cp = require('child_process');
  // Operator-provided launcher: split on the first run of whitespace into bin + args,
  // pass the URL as an argv element via execFile (no shell) so shell metacharacters
  // in the command or URL can't inject a command. Note: paths containing spaces must
  // be quoted by the operator via a wrapper (e.g. BRAINSTORM_OPEN_CMD="cmd /c start \"\" ...").
  if (process.env.BRAINSTORM_OPEN_CMD) {
    const [bin, ...args] = process.env.BRAINSTORM_OPEN_CMD.trim().split(/\s+/);
    if (bin) {
      try { cp.execFile(bin, [...args, url], () => {}); } catch (e) { /* best effort */ }
    }
    return;
  }
```

- [ ] **Step 2: 语法校验**

Run: `node --check .cursor/skills/brainstorming/scripts/server.cjs`
Expected: 无输出，退出码 0（语法正确）。

- [ ] **Step 3: 行为验证（argv 传递）**

Run:
```powershell
$env:BRAINSTORM_OPEN = '1';
$env:BRAINSTORM_OPEN_CMD = 'node -e "console.log(process.argv.slice(1).join(\"|\"))"';
node .cursor/skills/brainstorming/scripts/server.cjs
```
Expected: 服务器启动；`maybeOpenBrowser` 触发后（浏览器未连、loopback、BRAINSTORM_OPEN=1 时）stdout 出现形如 `http://127.0.0.1:<port>/?key=<token>` 的 URL 输出（`-e` 的 argv 数组收到 url 独立元素）。验证后清理：
```powershell
Remove-Item Env:BRAINSTORM_OPEN, Env:BRAINSTORM_OPEN_CMD
```

> 注：若 `maybeOpenBrowser` 的触发条件（`clients.size > 0` 等）未满足，本验证可能不触发浏览器打开——属预期，重点验证 `node --check` 语法 + 分支替换正确性；注入面消除本身由代码审查确认。

- [ ] **Step 4: 提交**

```bash
git add .cursor/skills/brainstorming/scripts/server.cjs
git commit --no-gpg-sign -m "fix(brainstorm): BRAINSTORM_OPEN_CMD 改 execFile 数组传参消除 shell 注入面"
```

---

## Task 4: safe-json 工具 + read-json-or-exit 接入（TDD）

**Files:**
- Create: `w-model-dev/scripts/lib/safe-json.ts`
- Create: `w-model-dev/scripts/__tests__/safe-json.test.ts`
- Modify: `w-model-dev/scripts/lib/read-json-or-exit.ts:39`、`:79`

- [ ] **Step 1: 写失败测试**

创建 `w-model-dev/scripts/__tests__/safe-json.test.ts`：

```ts
/**
 * lib/safe-json.ts 单元测试（批次 1 安全加固 §3.4）
 *
 * 覆盖：__proto__ 键被丢弃 / 普通键与嵌套对象保留 / 数组 / 标量 / null /
 *       行为与 JSON.parse 一致（含非法 JSON 抛错）。
 */

import { describe, it, expect } from 'vitest';
import { parseJsonSafe, safeJsonReviver } from '../lib/safe-json.js';

describe('parseJsonSafe', () => {
  it('顶层 __proto__ 键被丢弃', () => {
    const obj = parseJsonSafe<Record<string, unknown>>('{"__proto__":{"polluted":true},"a":1}');
    expect(Object.prototype.hasOwnProperty.call(obj, '__proto__')).toBe(false);
    expect(obj.a).toBe(1);
  });

  it('嵌套对象中的 __proto__ 键被丢弃', () => {
    const obj = parseJsonSafe<{ nested: Record<string, unknown> }>('{"nested":{"__proto__":{"x":1},"keep":2}}');
    expect(Object.prototype.hasOwnProperty.call(obj.nested, '__proto__')).toBe(false);
    expect(obj.nested.keep).toBe(2);
  });

  it('普通键与数组行为与原 JSON.parse 一致', () => {
    const obj = parseJsonSafe<{ list: number[]; s: string; b: boolean; n: null }>(
      '{"list":[1,2,3],"s":"x","b":true,"n":null}',
    );
    expect(obj).toEqual({ list: [1, 2, 3], s: 'x', b: true, n: null });
  });

  it('顶层数组 / 标量 / null 行为一致', () => {
    expect(parseJsonSafe<number[]>('[1,2]')).toEqual([1, 2]);
    expect(parseJsonSafe<number>('42')).toBe(42);
    expect(parseJsonSafe<string>('"str"')).toBe('str');
    expect(parseJsonSafe<null>('null')).toBeNull();
  });

  it('非法 JSON 抛 SyntaxError（与原行为一致）', () => {
    expect(() => parseJsonSafe('{not json')).toThrow(SyntaxError);
  });
});

describe('safeJsonReviver', () => {
  it('key=__proto__ 返回 undefined（删除键），其余原样返回', () => {
    expect(safeJsonReviver('__proto__', { polluted: true })).toBeUndefined();
    expect(safeJsonReviver('a', 1)).toBe(1);
    expect(safeJsonReviver('constructor', { c: 1 })).toEqual({ c: 1 }); // constructor 不处理
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/safe-json.test.ts`
Expected: FAIL——`../lib/safe-json.js` 模块不存在。

- [ ] **Step 3: 实现 safe-json.ts**

创建 `w-model-dev/scripts/lib/safe-json.ts`：

```ts
/**
 * 安全 JSON 解析工具（原型污染防御）
 *
 * 背景：JSON.parse 将 `__proto__` 创建为对象自有属性（不污染原型），但对象后续
 * 经 Object.assign / spread 复制时会触发原型污染。对不受信输入统一丢弃 `__proto__` 键。
 *
 * 决策（批次 1 spec §2.1）：仅丢弃 `__proto__`；`constructor`/`prototype` 在 JSON.parse
 * 语义下无污染风险，不做处理（避免破坏合法字段）。
 *
 * 仅 node 内置，无新依赖。接入点见 2026-08-05-opt-batch-1-security-hardening-design.md §3.4。
 */
export function safeJsonReviver(key: string, value: unknown): unknown {
  return key === '__proto__' ? undefined : value;
}

export function parseJsonSafe<T = unknown>(text: string): T {
  return JSON.parse(text, safeJsonReviver) as T;
}
```

- [ ] **Step 4: 跑测试验证通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/safe-json.test.ts`
Expected: 6 条全部 PASS。

- [ ] **Step 5: read-json-or-exit 接入**

修改 `w-model-dev/scripts/lib/read-json-or-exit.ts`：

1) 顶部 import 区（`import * as path from 'node:path';` 之后）加：

```ts
import { parseJsonSafe } from './safe-json.js';
```

2) 第 39 行 `return JSON.parse(raw) as T;` → `return parseJsonSafe<T>(raw);`

3) 第 79 行 `entries.push(JSON.parse(trimmed));` → `entries.push(parseJsonSafe(trimmed));`

- [ ] **Step 6: 跑测试验证 read-json-or-exit 回归**

Run: `npx vitest run`
Expected: 全量通过（read-json-or-exit 相关既有测试无回归）。

Run: `npm run self-test`
Expected: 213 条全通过（samples/ 有效样本经 read-json-or-exit 解析结果不变）。

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/scripts/lib/safe-json.ts w-model-dev/scripts/__tests__/safe-json.test.ts w-model-dev/scripts/lib/read-json-or-exit.ts
git commit --no-gpg-sign -m "feat(lib): safe-json 原型污染防御 + read-json-or-exit 接入"
```

---

## Task 5: CLI 脚本 parse 入口批量接入

**Files（每个文件做两件事：加 `import { parseJsonSafe } from './lib/safe-json.js'`（或相对路径），并把目标 `JSON.parse(...)` 替换为 `parseJsonSafe(...)`,保持其余不变）：**
- Modify: `w-model-dev/scripts/check-artifact-gate.ts:196/:222/:241/:263`
- Modify: `w-model-dev/scripts/check-bdd-model.ts:79`
- Modify: `w-model-dev/scripts/check-budget.ts:87/:146`
- Modify: `w-model-dev/scripts/check-maturity.ts:87/:130`
- Modify: `w-model-dev/scripts/check-preventive-review.ts:92/:162`
- Modify: `w-model-dev/scripts/check-requirement-coverage.ts:57/:94/:138`
- Modify: `w-model-dev/scripts/check-requirement-graph.ts:83/:122`
- Modify: `w-model-dev/scripts/check-role-dispatch.ts:70`
- Modify: `w-model-dev/scripts/check-run-log.ts:116`
- Modify: `w-model-dev/scripts/check-codegraph-queries.ts:81`
- Modify: `w-model-dev/scripts/metrics-report.ts:129`
- Modify: `w-model-dev/scripts/wm-status.ts:66/:90`
- Modify: `w-model-dev/scripts/security-scan.ts:166/:194`
- Modify: `w-model-dev/scripts/schema-loader.ts:37`
- Modify: `w-model-dev/scripts/run-log-logic.ts:469`
- Modify: `w-model-dev/scripts/self-test.ts`（内部 ~25 处 `JSON.parse(` → `parseJsonSafe(`）

> 机械替换规则（每处）：
> 1. 调用点所在文件顶部 import 区加 `import { parseJsonSafe } from '<相对路径>/lib/safe-json.js';`（`w-model-dev/scripts/` 下的脚本用 `./lib/safe-json.js`；`lib/` 内的已由 Task 4 接入）。
> 2. 目标处 `JSON.parse(X)` → `parseJsonSafe(X)`，**保留原有的类型断言**（如 `as T`、`as unknown`、`as { ... }`），仅替换函数名。
> 3. 例外：`run-log-logic.ts:469` 位于纯逻辑层（*-logic.ts 不得 import node:fs 等，但可 import 本目录纯函数）——safe-json.ts 无副作用且只依赖 node 内置，满足 pure 边界，可 import；若审查认为违反，则改为在 `check-run-log.ts` 预解析后传入。
> 4. `schema-loader.ts:37` 读取受信任 schema 文件，接入仅为统一，无行为影响。
> 5. `self-test.ts` 为测试内部 parse，机械替换不改变断言。

- [ ] **Step 1: 替换 check-artifact-gate.ts / check-bdd-model.ts / check-run-log.ts / schema-loader.ts（4 个核心入口）**

按上述规则完成 4 个文件共 7 处替换（check-artifact-gate 4 处、check-bdd-model 1 处、check-run-log 1 处、schema-loader 1 处）。

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 2: 替换其余 10 个 CLI/工具脚本**

按上述规则完成：check-budget（2）、check-maturity（2）、check-preventive-review（2）、check-requirement-coverage（3）、check-requirement-graph（2）、check-role-dispatch（1）、check-codegraph-queries（1）、metrics-report（1）、wm-status（2）、security-scan（2）、run-log-logic（1）。

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 3: 替换 self-test.ts 内部 parse**

`self-test.ts` 内全部 `JSON.parse(`（约 25 处，含 `.map(l => JSON.parse(l))` 形式）机械替换为 `parseJsonSafe(`，顶部 import 区加对应 import。

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 4: 全量回归**

Run: `npm run self-test`
Expected: 213 条全通过。

Run: `npx vitest run`
Expected: 全量通过（含 Task 2/4 新增的 15 条）。

Run: `npm run lint:security`
Expected: baseline 比对通过（新增代码不引入新安全违规）。

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts
git commit --no-gpg-sign -m "refactor(scripts): parse 入口统一 parseJsonSafe（原型污染防御）"
```

---

## Task 6: 全量回归与收尾验证

**Files:** 无代码改动（仅验证与证据）。

- [ ] **Step 1: 全量验证**

Run: `npm run self-test`
Expected: 213 条全通过。

Run: `npx vitest run`
Expected: 全量通过（363 + 新增 15 = 378 条预期，按实测记录）。

Run: `npx tsc --noEmit`
Expected: 0 错误。

Run: `npm run lint:security`
Expected: baseline 比对通过。

- [ ] **Step 2: 行为验证复核（对照 spec §4）**

1. 含空格/中文路径下 `check-state-machine-consistency.ts` 正常校验（Task 1 Step 3 已验）。
2. `cleanTraceFiles` 三态：无 .tla 不删 / 标准 TLC 产物删 / 非 TLC 特征 states 跳过（Task 2 单测已覆盖）。
3. `BRAINSTORM_OPEN_CMD` execFile 数组传参（Task 3 已验）。
4. `__proto__` 过滤（Task 4 单测已覆盖）。

- [ ] **Step 3: 核对 vitest 基线计数并按实测更新文档（批次 2 承接计数同步，本步仅记录）**

记录实测 vitest 总数与 test files 数，供批次 2 的 AGENTS/README 计数同步使用（本批不直接改文档计数）。

- [ ] **Step 4: 确认工作区干净**

Run: `git status --short`
Expected: 空输出（6 个任务全部 commit 完毕）。

Run: `git log --oneline -6`
Expected: 最近 6 个 commit 为批次 1 的 5 个提交（Task 1-5）+ 批次 1 spec 提交（343f9f1）。

---

## 自审记录（writing-plans self-review）

- **Spec 覆盖**：spec §3.1→Task 1；§3.2→Task 2；§3.3→Task 3；§3.4→Task 4+5；spec §4 验收→Task 6。无缺口。
- **占位符扫描**：无 TBD/TODO；所有代码步骤给出完整代码；Task 5 为同构机械替换，给出了替换规则 + 精确行号清单（同构步骤按规则执行，非占位）。
- **类型一致性**：`cleanTraceFiles`/`isTlcStatesDir` 签名在 Task 2 测试与实现一致；`parseJsonSafe<T>`/`safeJsonReviver` 在 Task 4 测试与实现一致；Task 5 仅替换函数名、保留类型断言，无签名漂移。
- **行为等价**：所有替换均为纯等价变换（reviver 仅删 `__proto__` 键，对既有合法样本无影响），self-test 213 条为等价性回归基线。
