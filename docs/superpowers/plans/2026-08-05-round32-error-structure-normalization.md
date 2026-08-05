# 第 32 轮实施计划：错误结构全量归一化 + run-log R6 契约迁移

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一全仓 29 个脚本的 exit 2 错误输出为结构化格式（`lib/cli-error.ts`：人类消息走 stderr、`ERROR_JSON` 走 stdout），并把 run-log R6 的 `extractExitCode` / gateLogPath 索引规则迁入 `run-log-logic.ts`，版本升至 32.0.0。

**Architecture:** 新增纯逻辑 `lib/cli-error.ts`（6 类错误码 + `CliError` + `formatCliError/printError/printErrorJson/exitWithError`），全仓 exit 2 路径统一接入（人类消息 stderr `✗ [CATEGORY] ...`、机器摘要 stdout `ERROR_JSON {...}`，遵循 SSoT §10E E.1「JSON 摘要含 exitCode 输出 stdout」）；R6 的提取/索引规则迁入 `run-log-logic.ts`（纯字符串实现，遵守 *-logic.ts 不 import node:path 的 pure 边界）。设计 spec：[`docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md`](../../docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md)。

**Tech Stack:** TypeScript strict + tsx + vitest；cli-error.ts 仅 node:process；run-log-logic.ts 保持零 import。

**环境注意（Windows + 本仓库惯例）：**
- git commit 需 `--no-gpg-sign`（仓库 `commit.gpgsign=true`）。
- PowerShell 不支持 heredoc：commit message 用单行。
- 跑 vitest 单文件：`npx vitest run w-model-dev/scripts/__tests__/<file>.test.ts`。
- vitest 基线：345 → **358**（+13：cli-error 7 + run-log-logic 扩展 6）；回归后按实测更新文档。
- `*-logic.ts` 纯逻辑层**不得** import node:fs / node:child_process / node:path（coverage 矩阵 pure 边界）——`buildGateLogKeys` 用纯字符串实现。

## 任务总览（8 任务）

| 任务 | 内容 | 产物 |
|---|---|---|
| 1 | lib/cli-error.ts 纯逻辑 + 单测（TDD） | `cli-error.ts` + `cli-error.test.ts` |
| 2 | R6 契约迁移：extractExitCode/buildGateLogKeys 迁入 run-log-logic.ts + 单测；check-run-log.ts 改造 | run-log-logic.ts / check-run-log.ts / 测试扩展 |
| 3 | read-json-or-exit.ts 消息统一 | lib/read-json-or-exit.ts |
| 4 | check-*.ts 归一化批 A（11 个） | 11 个 check 脚本 |
| 5 | check-*.ts 归一化批 B（12 个） | 12 个 check 脚本 |
| 6 | 工具脚本归一化（5 个） | plan-chunks / ensure-codegraph-opsx / security-scan / wm-status / metrics-report |
| 7 | 文档同步（SSoT/CHANGELOG/command-reference/AGENTS/README/INSTALL/coverage/版本号） | 8 个文件 |
| 8 | 全量回归 + lint baseline + 提交 | 回归证据 |

---

## Task 1: lib/cli-error.ts 纯逻辑层（TDD）

**Files:**
- Create: `w-model-dev/scripts/lib/cli-error.ts`
- Create: `w-model-dev/scripts/__tests__/cli-error.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `w-model-dev/scripts/__tests__/cli-error.test.ts`：

```ts
/**
 * lib/cli-error.ts 单元测试
 *
 * 覆盖：formatCliError 三类模板（file / detail / 均无）/ printError 走 stderr /
 *       printErrorJson 走 stdout 且含 exitCode / exitWithError 调 process.exit(2)。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCliError,
  printError,
  printErrorJson,
  exitWithError,
  type CliError,
} from '../lib/cli-error.js';

const NOT_FOUND: CliError = {
  category: 'FILE_NOT_FOUND',
  message: '文件不存在',
  exitCode: 2,
  file: 'C:\\proj\\.w-model\\project.json',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatCliError', () => {
  it('带 file → `✗ [CATEGORY] message: file`', () => {
    expect(formatCliError(NOT_FOUND)).toBe(
      '✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json',
    );
  });

  it('带 detail 无 file → `✗ [CATEGORY] message: detail`', () => {
    const e: CliError = {
      category: 'ARG_INVALID',
      message: '参数非法 --phase=99',
      exitCode: 2,
      detail: '须为 1-8 整数',
    };
    expect(formatCliError(e)).toBe('✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数');
  });

  it('无 file/detail → 省略冒号段', () => {
    const e: CliError = { category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 };
    expect(formatCliError(e)).toBe('✗ [UNEXPECTED] 脚本异常');
  });
});

describe('printError / printErrorJson', () => {
  it('printError 输出人类消息到 stderr（console.error）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printError(NOT_FOUND);
    expect(spy).toHaveBeenCalledWith('✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json');
  });

  it('printErrorJson 输出 ERROR_JSON 到 stdout（console.log）且含 exitCode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printErrorJson(NOT_FOUND);
    const out = spy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as {
      category: string;
      message: string;
      exitCode: number;
    };
    expect(parsed).toMatchObject({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2 });
  });
});

describe('exitWithError', () => {
  it('调用 process.exit(2)（消息与 JSON 均已输出）', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => exitWithError(NOT_FOUND)).toThrow('exit:2');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/cli-error.test.ts`
Expected: FAIL（`Cannot find module '../lib/cli-error.js'`）

- [ ] **Step 3: 实现纯逻辑层**

创建 `w-model-dev/scripts/lib/cli-error.ts`：

```ts
/**
 * CLI 脚本错误结构工具（lib/cli-error.ts）
 *
 * 统一全仓脚本 exit 2 输入错误的输出：
 *   - 人类可读消息 → stderr（`✗ [CATEGORY] <message>: <file|detail>`）
 *   - 机器可读摘要 → stdout（`ERROR_JSON {category,message,exitCode,file}`）
 * 遵循 SSoT §10E E.1「JSON 摘要含 exitCode 字段且输出到 stdout」约定。
 * 设计：docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md §3.1
 */

/** 错误类别（exit 1 校验失败走 violations + XXX_JSON，不使用本表） */
export type ErrorCategory =
  | 'ARG_INVALID'
  | 'FILE_NOT_FOUND'
  | 'FILE_PARSE'
  | 'FILE_READ'
  | 'STRUCTURE_INVALID'
  | 'UNEXPECTED';

export interface CliError {
  category: ErrorCategory;
  /** 人类可读描述（不含 ✗ 前缀与路径后缀；由 formatCliError 组装） */
  message: string;
  /** 退出码：当前均为 2（输入错误） */
  exitCode: 0 | 1 | 2;
  /** 相关文件绝对路径（可选） */
  file?: string;
  /** 补充详情（如收到的参数值 / 底层错误码） */
  detail?: string;
}

/** 组装人类可读消息：`✗ [CATEGORY] <message>: <file|detail>`（file 优先，其次 detail，均无则省略冒号段） */
export function formatCliError(e: CliError): string {
  const head = `✗ [${e.category}] ${e.message}`;
  const tail = e.file ?? e.detail;
  return tail ? `${head}: ${tail}` : head;
}

/** stderr 输出人类可读错误消息 */
export function printError(e: CliError): void {
  console.error(formatCliError(e));
}

/** stdout 输出结构化错误摘要（ERROR_JSON 前缀 + JSON，遵循 §10E E.1） */
export function printErrorJson(e: CliError): void {
  const json = { category: e.category, message: e.message, exitCode: e.exitCode, file: e.file };
  console.log(`ERROR_JSON ${JSON.stringify(json)}`);
}

/** printError + printErrorJson + process.exit(exitCode) */
export function exitWithError(e: CliError): never {
  printError(e);
  printErrorJson(e);
  process.exit(e.exitCode);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/cli-error.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/scripts/lib/cli-error.ts w-model-dev/scripts/__tests__/cli-error.test.ts
git commit --no-gpg-sign -m "feat(cli-error): 结构化错误对象（6 类错误码 + ERROR_JSON stdout + 人类消息 stderr，TDD 7 用例）"
```

---

## Task 2: run-log R6 契约迁移（迁入 logic 层）

**Files:**
- Modify: `w-model-dev/scripts/run-log-logic.ts`（新增导出）
- Modify: `w-model-dev/scripts/check-run-log.ts`（loadGateLogs 改造 + 删除本地 extractExitCode）
- Test: `w-model-dev/scripts/__tests__/run-log-logic.test.ts`（扩展 6 用例）

- [ ] **Step 1: 在 run-log-logic.test.ts 追加失败测试**

在 `w-model-dev/scripts/__tests__/run-log-logic.test.ts` 末尾追加（import 补 `extractExitCode, buildGateLogKeys`）：

```ts
describe('R6 契约迁移：extractExitCode / buildGateLogKeys', () => {
  it('extractExitCode 从 GATE_JSON 摘要行提取 exitCode', () => {
    const content = 'some log\nGATE_JSON {"passed":true,"exitCode":0}\nend';
    expect(extractExitCode(content)).toBe(0);
  });

  it('extractExitCode 从 VERIFIER_JSON 摘要行提取 exitCode（多标记扫描）', () => {
    const content = 'VERIFIER_JSON {"passed":false,"exitCode":1}';
    expect(extractExitCode(content)).toBe(1);
  });

  it('extractExitCode 无匹配 → undefined', () => {
    expect(extractExitCode('no json here')).toBeUndefined();
  });

  it('buildGateLogKeys 返回 basename / 绝对路径 / 相对 cwd / 正斜杠归一化 4 类 key', () => {
    const fileAbs = 'C:/proj/.w-model/gate-logs/phase5-check-a.log';
    const keys = buildGateLogKeys(fileAbs, 'C:/proj');
    expect(keys).toContain('phase5-check-a.log');
    expect(keys).toContain(fileAbs);
    expect(keys).toContain('.w-model/gate-logs/phase5-check-a.log');
    expect(keys).toContain('C:\\proj\\.w-model\\gate-logs\\phase5-check-a.log');
  });

  it('buildGateLogKeys 含反斜杠路径输入（Windows 兼容归一化）', () => {
    const fileAbs = 'C:\\proj\\.w-model\\gate-logs\\phase1-check-tla.log';
    const keys = buildGateLogKeys(fileAbs, 'C:\\proj');
    expect(keys).toContain('phase1-check-tla.log');
    expect(keys).toContain('C:/proj/.w-model/gate-logs/phase1-check-tla.log');
    expect(keys).toContain('.w-model/gate-logs/phase1-check-tla.log');
  });

  it('buildGateLogKeys cwd 为空 → 退化为 basename + 绝对路径（无相对 key）', () => {
    const keys = buildGateLogKeys('C:/proj/a.log', '');
    expect(keys).toContain('a.log');
    expect(keys).toContain('C:/proj/a.log');
    expect(keys).not.toContain('proj/a.log');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: FAIL（`extractExitCode` / `buildGateLogKeys` 未导出）

- [ ] **Step 3: run-log-logic.ts 新增导出（文件末尾追加）**

```ts
// ==================== R6 契约：gate-log exitCode 提取与路径索引（自 check-run-log.ts 迁入） ====================

/** 各门禁脚本 stdout 摘要标记（与 check-run-log.ts 现状一致的 23 个 XXX_JSON 前缀） */
const GATE_JSON_PATTERNS: RegExp[] = [
  /SCRIPT_JSON\s+(\{.*\})/,
  /GRAPH_JSON\s+(\{.*\})/,
  /VERIFIER_JSON\s+(\{.*\})/,
  /TLA_JSON\s+(\{.*\})/,
  /BUDGET_JSON\s+(\{.*\})/,
  /RUN_LOG_JSON\s+(\{.*\})/,
  /MATURITY_JSON\s+(\{.*\})/,
  /CHECKPOINT_JSON\s+(\{.*\})/,
  /GATE_JSON\s+(\{.*\})/,
  /SIGNATURE_CHAIN_JSON\s+(\{.*\})/,
  /ARCHIVE_INTEGRITY_JSON\s+(\{.*\})/,
  /ROLE_DISPATCH_JSON\s+(\{.*\})/,
  /CODE_TLA_JSON\s+(\{.*\})/,
  /COVERAGE_JSON\s+(\{.*\})/,
  /EXEMPTION_JSON\s+(\{.*\})/,
  /CONTRACT_JSON[:\s]+(\{.*\})/,
  /OPSX_ARTIFACTS_JSON\s+(\{.*\})/,
  /OPENSPEC_ARCHIVE_JSON\s+(\{.*\})/,
  /CODEGRAPH_QUERIES_JSON\s+(\{.*\})/,
  /BDD_JSON\s+(\{.*\})/,
  /PREVENTIVE_REVIEW_JSON\s+(\{.*\})/,
  /ROOTCAUSE_JSON\s+(\{.*\})/,
  /TLA_BDD_SYNC_JSON\s+(\{.*\})/,
  /STATUS_JSON\s+(\{.*\})/,
  /METRICS_JSON\s+(\{.*\})/,
];

/**
 * 从 gate-log 内容提取 exitCode（gate-log 是脚本 stdout 存档，含一行 `XXX_JSON {...}` 摘要）。
 * 纯函数、无 IO。自 check-run-log.ts 迁入（契约不变）。
 */
export function extractExitCode(content: string): number | undefined {
  for (const pattern of GATE_JSON_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      try {
        const json = JSON.parse(match[1]) as { exitCode?: unknown };
        if (typeof json.exitCode === 'number') return json.exitCode;
      } catch {
        /* 忽略解析失败 */
      }
    }
  }
  return undefined;
}

/**
 * 构建 gateLogPath 多索引 key 集：basename / 绝对路径 / 相对 cwd 路径 / 各路径正斜杠归一化。
 * 纯字符串实现（不 import node:path，遵守 *-logic.ts pure 边界）；兼容 Windows 反斜杠。
 * 自 check-run-log.ts loadGateLogs 迁入（契约不变：与 path.relative 语义一致的前缀裁剪）。
 */
export function buildGateLogKeys(fileAbs: string, cwd: string): string[] {
  const basename = fileAbs.split(/[\\/]/).filter(Boolean).pop() ?? fileAbs;
  const keys = new Set<string>([basename, fileAbs]);
  if (cwd) {
    const sep = cwd.includes('\\') ? '\\' : '/';
    const prefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;
    if (fileAbs.startsWith(prefix)) {
      keys.add(fileAbs.slice(prefix.length));
    }
  }
  for (const k of [...keys]) {
    keys.add(k.replace(/\\/g, '/'));
  }
  return [...keys];
}
```

> 注：GATE_JSON_PATTERNS 在原 check-run-log.ts 的 23 个基础上追加 STATUS_JSON / METRICS_JSON（第 31 轮新增脚本的摘要标记，纳入交叉校验范围）。

- [ ] **Step 4: check-run-log.ts 改造**

a. 删除文件内本地 `extractExitCode`（原 L54-96 的 patterns + 函数体）。
b. import 行改为：
```ts
import { checkRunLog, extractExitCode, buildGateLogKeys } from './run-log-logic.js';
```
c. `loadGateLogs` 内（原 L129-142 附近），将「读取文件 → extractExitCode(content) → 多索引构建」改为：
```ts
      const content = await fs.readFile(fileAbs, 'utf-8');
      const exitCode = extractExitCode(content);
      const data = { exitCode, content };
      const keys = buildGateLogKeys(fileAbs, process.cwd());
      for (const k of keys) {
        map.set(k, data);
      }
```
d. 删除原「多索引：basename + 绝对路径 + 相对 cwd 路径（含正斜杠归一化）」注释块与手写循环。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run w-model-dev/scripts/__tests__/run-log-logic.test.ts`
Expected: 原有 + 6 新增用例全部 PASS（注意原 R5/R6 用例仍通过——契约不变）

- [ ] **Step 6: tsc + 冒烟**

```bash
npx tsc --noEmit
```
构造 gate-logs 夹具冒烟：`check-run-log.ts <run-log.jsonl> --gate-logs=<dir>` → R5/R6 行为与改造前一致（有效 gate-log exitCode=0 不报 violation）。

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/scripts/run-log-logic.ts w-model-dev/scripts/check-run-log.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts
git commit --no-gpg-sign -m "refactor(run-log): R6 契约迁移 extractExitCode/buildGateLogKeys 迁入 logic 层（TDD +6 用例，含 STATUS/METRICS_JSON 标记）"
```

---

## Task 3: read-json-or-exit.ts 消息统一

**Files:**
- Modify: `w-model-dev/scripts/lib/read-json-or-exit.ts`

- [ ] **Step 1: 统一消息格式（行为不变）**

`read-json-or-exit.ts` 内三处 `console.error` 消息改为统一类别格式（**保持 exit(2) 行为与坏行 warn+skip 行为不变**——v29 已确认工具契约）：
- `✗ 文件不存在: ${abs}` → `✗ [FILE_NOT_FOUND] 文件不存在: ${abs}`
- `✗ 文件解析失败（非合法 JSON）: ${abs}` → `✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: ${abs}`
- `⚠ ${label} 第 ${i + 1} 行非合法 JSON，已跳过: ${abs}` → `⚠ [FILE_PARSE] ${label} 第 ${i + 1} 行非合法 JSON，已跳过: ${abs}`（警告不走 exitWithError，保留 console.error）

> 说明：本工具是 CLI 层样板库，不引入 exitWithError（保持函数签名与调用方契约）；仅消息加类别前缀。

- [ ] **Step 2: 验证既有测试**

Run: `npx vitest run w-model-dev/scripts/__tests__/read-json-or-exit.test.ts`
Expected: 全通过（既有断言 `expect.stringContaining('✗ 文件不存在')` 与 `✗ [FILE_NOT_FOUND] 文件不存在` 兼容）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/lib/read-json-or-exit.ts
git commit --no-gpg-sign -m "refactor(cli): read-json-or-exit 错误消息加类别前缀（行为不变）"
```

---

## Task 4: check-*.ts 归一化批 A（11 个）

**Files:**
- Modify: `w-model-dev/scripts/check-artifact-gate.ts` / `check-verifier-output.ts` / `check-requirement-graph.ts` / `check-requirement-coverage.ts` / `check-exemption.ts` / `check-tla-model.ts` / `check-tla-bdd-sync.ts` / `check-bdd-model.ts` / `check-code-tla-consistency.ts` / `check-design-contract-consistency.ts` / `check-rootcause-report.ts`

- [ ] **Step 1: 通用改造模式（应用于本批每个脚本）**

对每个脚本执行以下 4 项改造：

**a. 引入 exitWithError**（文件顶部 import 区）：
```ts
import { exitWithError, type CliError } from './lib/cli-error.js';
```

**b. 错误路径替换**：将每处 `console.error(\`✗ ...\`) + process.exit(2)` 对替换为 `exitWithError({...})`，类别按下表判定：

| 场景 | 类别 | message | file/detail |
|---|---|---|---|
| 参数值非法（phase/variant/mode/node-type/max-tokens 等） | `ARG_INVALID` | `参数非法 <name>=<value>` | detail=`须为 <约束>` |
| 文件/目录不存在（ENOENT） | `FILE_NOT_FOUND` | `文件不存在` | file=绝对路径 |
| JSON.parse 失败（含 JSONL 坏行） | `FILE_PARSE` | `文件解析失败（非合法 JSON）` | file=绝对路径 |
| 读取异常非 ENOENT | `FILE_READ` | `文件读取失败` | file=绝对路径，detail=`<errno>` |
| 合法 JSON 形状不符（顶层非对象/缺数组/缺字段/类型错） | `STRUCTURE_INVALID` | `<文件> 结构不符` | file=绝对路径，detail=描述 |
| 原有消息含「（转 operational-recovery，不猜测状态）」 | 保持该后缀 | 追加到 message 或 detail | 保留 |

替换后统一输出形态：stderr `✗ [CATEGORY] message: file|detail`；stdout `ERROR_JSON {category,message,exitCode,file}`（exitWithError 内部完成）。

**c. main().catch 兜底**：`console.error('...异常:', err); process.exit(2);` 替换为：
```ts
main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
```

**d. 保留项**：exit 1 的 violations 列表 + `XXX_JSON` 摘要（含 exitCode）**不动**；人类可读成功输出（`═` 分隔线、标签行）**不动**。

**本批各脚本的既有错误路径要点（核对清单，全部按上述模式替换）**：
- check-artifact-gate：`--phase` 非法 ×2（ARG_INVALID）、RTM 文件不存在（FILE_NOT_FOUND）、RTM 解析失败（FILE_PARSE）、其他 `process.exit(2)`（按场景归类）
- check-verifier-output：无参数用法（ARG_INVALID）、文件不存在/解析失败（FILE_NOT_FOUND/FILE_PARSE）
- check-requirement-graph：`--phase` 校验 ×2（ARG_INVALID）、`--rtm`/`--exemptions` 读取失败（FILE_READ）、无法确定 phase（ARG_INVALID）
- check-requirement-coverage：`--graph` 读取失败（FILE_READ）、`--out-of-scope` 读取/结构（FILE_READ/STRUCTURE_INVALID）、`--exemptions` 读取失败（FILE_READ）
- check-exemption：文件不存在/解析失败/结构（FILE_NOT_FOUND/FILE_PARSE/STRUCTURE_INVALID）
- check-tla-model：manifest/graph 读取与解析、`--phase` 校验
- check-tla-bdd-sync：manifest/feature 读取与解析
- check-bdd-model：manifest 缺失/解析、`--phase` 校验
- check-code-tla-consistency：manifest/graph/rtm 读取与解析
- check-design-contract-consistency：路由/契约文件读取与解析
- check-rootcause-report：文件不存在/解析失败

> 改造原则：**每处 exit 2 必须走 exitWithError，不留裸 `console.error + process.exit(2)`**（grep `process.exit(2)` 应只剩 exitWithError 内部一处）。

- [ ] **Step 2: 验证（tsc + 冒烟 + 回归）**

```bash
npx tsc --noEmit
npx vitest run
npm run self-test
```
冒烟（任选 2 个本批脚本）：
- `npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=99 x` → stderr 含 `✗ [ARG_INVALID]`、stdout 含 `ERROR_JSON {"category":"ARG_INVALID"`、exit 2
- `npx tsx w-model-dev/scripts/check-requirement-graph.ts`（无参）→ stderr 含 `✗ [ARG_INVALID]`、exit 2

Expected: tsc 0 错误；vitest 全通过（既有断言兼容）；self-test 213/213（仅断言退出码）。

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/check-artifact-gate.ts w-model-dev/scripts/check-verifier-output.ts w-model-dev/scripts/check-requirement-graph.ts w-model-dev/scripts/check-requirement-coverage.ts w-model-dev/scripts/check-exemption.ts w-model-dev/scripts/check-tla-model.ts w-model-dev/scripts/check-tla-bdd-sync.ts w-model-dev/scripts/check-bdd-model.ts w-model-dev/scripts/check-code-tla-consistency.ts w-model-dev/scripts/check-design-contract-consistency.ts w-model-dev/scripts/check-rootcause-report.ts
git commit --no-gpg-sign -m "refactor(round32): 11 个 check 脚本 exit 2 归一化（exitWithError + ERROR_JSON，消息类别前缀）"
```

---

## Task 5: check-*.ts 归一化批 B（12 个）

**Files:**
- Modify: `w-model-dev/scripts/check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-signature-chain.ts` / `check-role-dispatch.ts` / `check-preventive-review.ts` / `check-archive-integrity.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts` / `check-codegraph-queries.ts` / `check-state-machine-consistency.ts`

- [ ] **Step 1: 应用 Task 4 Step 1 的通用改造模式（本批 12 个脚本）**

要点清单：
- check-budget：`--phase` 校验（ARG_INVALID）、budget.json 读取/解析
- check-run-log：无参数用法（ARG_INVALID）、run-log 缺失/解析（由 readJsonlOrExit 承载）；**注意本脚本 R6 改造已完成（Task 2），此任务仅归一化错误输出**
- check-maturity：无参数用法（ARG_INVALID）、maturity.json 读取/解析
- check-checkpoint：参数校验、checkpoint-log 读取
- check-signature-chain：链文件/目录不存在、解析失败
- check-role-dispatch：无参数用法（ARG_INVALID）、run-log 缺失（FILE_NOT_FOUND）、坏行（FILE_PARSE，**保留坏行 exit 2 行为**——第 29 轮决策不重构行为，仅消息加类别）
- check-preventive-review：`--variant` 非法（ARG_INVALID）、run-log 缺失、无法推断阶段（ARG_INVALID）
- check-archive-integrity：目录不存在（FILE_NOT_FOUND）、归档清单解析
- check-opsx-artifacts：`--phase` 校验（ARG_INVALID）、目录不存在
- check-openspec-archive：`--phase` 校验（ARG_INVALID）、归档目录不存在
- check-codegraph-queries：`--phase` 校验（ARG_INVALID）、项目根不存在（FILE_NOT_FOUND）
- check-state-machine-consistency：文件读取/解析

- [ ] **Step 2: 验证（同 Task 4 Step 2）**

冒烟：`check-preventive-review.ts --variant=bogus` → `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2；`check-codegraph-queries.ts --phase=99` → 同。

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/check-budget.ts w-model-dev/scripts/check-run-log.ts w-model-dev/scripts/check-maturity.ts w-model-dev/scripts/check-checkpoint.ts w-model-dev/scripts/check-signature-chain.ts w-model-dev/scripts/check-role-dispatch.ts w-model-dev/scripts/check-preventive-review.ts w-model-dev/scripts/check-archive-integrity.ts w-model-dev/scripts/check-opsx-artifacts.ts w-model-dev/scripts/check-openspec-archive.ts w-model-dev/scripts/check-codegraph-queries.ts w-model-dev/scripts/check-state-machine-consistency.ts
git commit --no-gpg-sign -m "refactor(round32): 12 个 check 脚本 exit 2 归一化（exitWithError + ERROR_JSON，含 role-dispatch 坏行行为保留）"
```

---

## Task 6: 工具脚本归一化（5 个）

**Files:**
- Modify: `w-model-dev/scripts/plan-chunks.ts` / `ensure-codegraph-opsx.ts` / `security-scan.ts` / `wm-status.ts` / `metrics-report.ts`

- [ ] **Step 1: 应用 Task 4 Step 1 的通用改造模式（5 个脚本）**

要点清单：
- plan-chunks：`--phase` / `--node-type` / `--max-tokens` 校验（ARG_INVALID ×3）、路径不存在（FILE_NOT_FOUND）、解析失败（FILE_PARSE）、main catch（UNEXPECTED）
- ensure-codegraph-opsx：`--phase` / `--mode` 校验（ARG_INVALID ×2）、项目根不存在（FILE_NOT_FOUND）、main catch（UNEXPECTED）
- security-scan：baseline 文件不存在（FILE_NOT_FOUND）、eslint 输出解析失败（FILE_PARSE）、baseline version 不支持（STRUCTURE_INVALID，detail=「请运行 --regenerate 重生成」）、eslint 执行失败（FILE_READ）、main catch（UNEXPECTED）；**注意 --regenerate 模式正常输出保留**
- wm-status：project 非法 JSON / 非对象 / rtm 解析失败 → `exitWithError`（FILE_PARSE / STRUCTURE_INVALID，保留「转 operational-recovery，不猜测状态」后缀）；**未初始化分支保留 console.error + exit 0（查询语义，非错误，不输出 ERROR_JSON）**；main catch（UNEXPECTED）
- metrics-report：`--phase` 非法（ARG_INVALID）、run-log 缺失/解析（readJsonlOrExit 承载）、budget 解析失败（FILE_PARSE）、main catch（UNEXPECTED）

> 说明：security-scan / wm-status / metrics-report 已含 `✗ 文件解析失败（非合法 JSON）` 等统一措辞，本轮仅加类别前缀与 ERROR_JSON 输出（经 exitWithError 统一）。

- [ ] **Step 2: 验证（tsc + 冒烟 + 回归）**

```bash
npx tsc --noEmit
npx vitest run
npm run self-test
```
冒烟：
- `npx tsx w-model-dev/scripts/plan-chunks.ts --phase=9 x` → `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2
- `npx tsx w-model-dev/scripts/metrics-report.ts --phase=abc`（有 run-log 夹具）→ `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2
- `npx tsx w-model-dev/scripts/wm-status.ts <空目录>` → 未初始化 exit 0（**无 ERROR_JSON**）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/scripts/plan-chunks.ts w-model-dev/scripts/ensure-codegraph-opsx.ts w-model-dev/scripts/security-scan.ts w-model-dev/scripts/wm-status.ts w-model-dev/scripts/metrics-report.ts
git commit --no-gpg-sign -m "refactor(round32): 5 个工具脚本 exit 2 归一化（wm-status 未初始化保持 exit 0 查询语义）"
```

---

## Task 7: 文档同步 + 版本号（8 文件）

**Files:**
- Modify: `w-model-dev/SKILL.md`、`w-model-dev/references/command-reference.md`、`w-model-dev/scripts/__tests__/README.md`、`AGENTS.md`、`README.md`、`docs/skill-design-document_SSoT.md`、`docs/INSTALL.md`、`CHANGELOG.md`、`package.json`、`w-model-dev/skill-metadata.json`

- [ ] **Step 1: 版本号三处 + coverage 矩阵**

- `package.json`：version `31.0.0` → `32.0.0`
- `w-model-dev/skill-metadata.json`：version → `32.0.0`
- `w-model-dev/SKILL.md` frontmatter：version → `32.0.0`
- `w-model-dev/scripts/__tests__/README.md` coverage 矩阵新增 1 行：
  `| cli-error.test.ts | CliError | formatCliError 三类模板 / printError 走 stderr / printErrorJson 走 stdout 含 exitCode / exitWithError exit(2) |`

- [ ] **Step 2: command-reference.md 新增「错误码与 ERROR_JSON 约定」节**

置于文件末尾（或 `## /wm help` 之前），内容：

```md
## 错误码与 ERROR_JSON 约定（第 32 轮统一）

所有 check-*.ts 与工具脚本的 **输入错误（exit 2）** 输出统一结构：

- **stderr**（人类可读）：`✗ [CATEGORY] <message>: <file|detail>`（类别见下表）
- **stdout**（机器可读，遵循 SSoT §10E E.1）：`ERROR_JSON {"category","message","exitCode","file"}`，`exitCode` 与 `process.exit()` 实参强一致

| 类别 | 场景 | 示例 |
|---|---|---|
| `ARG_INVALID` | 参数值非法（phase/variant/mode/node-type/max-tokens 等） | `✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数` |
| `FILE_NOT_FOUND` | 文件/目录不存在（ENOENT） | `✗ [FILE_NOT_FOUND] 文件不存在: C:\...\project.json` |
| `FILE_PARSE` | JSON 解析失败（含 JSONL 坏行） | `✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: C:\...\rtm.json` |
| `FILE_READ` | 读取异常非 ENOENT | `✗ [FILE_READ] 文件读取失败: C:\...\x.json（EACCES）` |
| `STRUCTURE_INVALID` | 合法 JSON 形状不符（顶层非对象/缺字段/类型错） | `✗ [STRUCTURE_INVALID] 结构不符: C:\...\x.json（缺 rows 数组）` |
| `UNEXPECTED` | 未预期异常（main().catch 兜底） | `✗ [UNEXPECTED] 脚本异常: <message>` |

- exit 1（校验失败）结构不变：violations 列表 + 既有 `XXX_JSON` 摘要（含 exitCode=1），不输出 ERROR_JSON。
- 异常不变量：`ERROR_JSON.exitCode` 恒等于脚本 `process.exit()` 实参（§10E E.1 防伪三层机制）。
```

- [ ] **Step 3: SSoT**

- §3.4 新增 `#### 3.4.30 第 32 轮：错误结构全量归一化 + run-log R6 契约迁移（2026-08-05，[32.0.0]）`（仿 §3.4.29 表格：触发=外部评审 #3 + R6 契约归位；新增=lib/cli-error.ts + 29 脚本 exit 2 归一化 + extractExitCode/buildGateLogKeys 迁入 run-log-logic；package.json 版本 31.0.0→32.0.0；vitest 行留待 Task 8 实测）
- §10A 追溯表 +1 行（§3.4.30）
- §10E E.1 末尾追加一句：「ERROR_JSON（exit 2 输入错误的结构化摘要）同属 stdout JSON 摘要家族，遵循本条约定的 exitCode 强一致」（第 32 轮明确化）

- [ ] **Step 4: AGENTS.md / README.md / INSTALL.md**

- AGENTS.md：§2 scripts 描述 + `lib/cli-error.ts`；§8 self-test 行 vitest 计数更新（Task 8 实测后）
- README.md：`lib/` 结构 + cli-error.ts；版本号/计数引用更新
- INSTALL.md：版本号/目录速查 + cli-error.ts

- [ ] **Step 5: CHANGELOG.md 新增 [32.0.0] 条目**

置于文件顶部（[31.0.0] 之前）：

```md
## [32.0.0] - 2026-08-05

### 第三十三轮 错误结构全量归一化 + run-log R6 契约迁移

吸收外部评审建议高风险批（设计文档 `docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md`）：统一全仓 29 个脚本的 exit 2 错误输出为结构化格式；run-log R6 提取/索引规则迁入纯逻辑层。详见 SSoT §3.4.30。

#### Added
- 新建 `scripts/lib/cli-error.ts`：6 类错误码（ARG_INVALID/FILE_NOT_FOUND/FILE_PARSE/FILE_READ/STRUCTURE_INVALID/UNEXPECTED）+ `CliError` + `formatCliError/printError/printErrorJson/exitWithError`；人类消息 stderr、`ERROR_JSON` 摘要 stdout（遵循 §10E E.1 exitCode 强一致）
- 新建 `scripts/__tests__/cli-error.test.ts`（7 用例）

#### Changed
- 29 个脚本（23 check-*.ts + 5 工具 + read-json-or-exit）exit 2 路径统一走 `exitWithError`：参数校验 `[ARG_INVALID]`、文件缺失 `[FILE_NOT_FOUND]`、解析失败 `[FILE_PARSE]`、读取异常 `[FILE_READ]`、结构不符 `[STRUCTURE_INVALID]`、异常兜底 `[UNEXPECTED]`；各脚本 main().catch 统一 UNEXPECTED
- `run-log-logic.ts`：R6 契约迁移——`extractExitCode` + `buildGateLogKeys`（纯字符串，遵守 *-logic.ts 不 import node:path）自 check-run-log.ts 迁入；GATE_JSON_PATTERNS 追加 STATUS_JSON/METRICS_JSON；run-log-logic.test.ts +6 用例
- `check-run-log.ts`：loadGateLogs 删除本地提取/索引实现，改调 logic 层（契约不变）
- wm-status 未初始化保持 exit 0 查询语义（不输出 ERROR_JSON）；check-role-dispatch 坏行 exit 2 行为保留（第 29 轮决策），消息加类别
- command-reference.md 新增「错误码与 ERROR_JSON 约定」节；SSoT §3.4.30 + §10A + §10E 补充
- 版本号三处同步为 32.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest <实测总数>/<实测总数>（<实际文件数> 文件）全通过（新增 cli-error 7 + run-log-logic 6 用例）
- self-test 213/213 不变全通过（仅断言退出码，消息改动零回归）
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增）
- 冒烟：check-artifact-gate --phase=99 / plan-chunks --phase=9 / metrics-report --phase=abc → `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2；wm-status 空目录 → 未初始化 exit 0
```

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/SKILL.md w-model-dev/references/command-reference.md w-model-dev/scripts/__tests__/README.md AGENTS.md README.md docs/skill-design-document_SSoT.md docs/INSTALL.md CHANGELOG.md package.json w-model-dev/skill-metadata.json
git commit --no-gpg-sign -m "release(32.0.0): SSoT §3.4.30 + command-reference 错误码节 + CHANGELOG + 版本号三处 32.0.0"
```

---

## Task 8: 全量回归 + 收尾提交

**Files:**
- 验证（无新文件）；按实测修正文档数字

- [ ] **Step 1: 全量验证**

Run（仓库根）：
```bash
npx tsc --noEmit
npm run self-test
npx vitest run
npm run lint:security
```
Expected:
- tsc: 0 错误
- self-test: 213/213
- vitest: 全部通过（应为 345 + 13 = 358；以实测为准）
- lint:security: 首跑可能 exit 1（cli-error.ts 与批量改动触发误报）→ 按仓库惯例 `npx tsx w-model-dev/scripts/security-scan.ts --regenerate` 后复跑 exit 0

- [ ] **Step 2: 按实测修正文档数字**

- `CHANGELOG.md` [32.0.0] 验证节：`<实测总数>/<实测总数>（<实际文件数> 文件）` → 实测（如 `358/358（29 文件）`）
- `docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md` §4 基线与 §6 验收：`345 → **358**（+13）` 按实测更新
- `docs/skill-design-document_SSoT.md` §3.4.30 vitest 行 + §10A 追溯行：`待回归验证` → 实测
- `README.md` / `AGENTS.md` / `INSTALL.md` 中 vitest 计数（27 个 .test.ts / 345 条 → 29 / 358）更新

- [ ] **Step 3: 收尾提交**

```bash
git add CHANGELOG.md docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md docs/skill-design-document_SSoT.md README.md AGENTS.md docs/INSTALL.md .eslintsecurity-baseline.json
git commit --no-gpg-sign -m "docs(round32): 按实测同步 vitest 计数与验证记录（358 条 / 29 文件）"
```

- [ ] **Step 4: prepush 全量门禁（推送前）**

Run（Git Bash）：`& 'C:\Program Files\Git\bin\bash.exe' -c 'PREPUSH_FORCE=1 bash .githooks/pre-push'`
Expected: 12 项全通过（self-test / check 退出码样本 / security-scan / npm audit）。

---

## 计划自审记录

- **Spec 覆盖**：spec §3.1（cli-error.ts）→ Task 1；§3.2（29 脚本归一化）→ Task 3/4/5/6；§3.3（R6 迁移）→ Task 2；§3.4（版本号）→ Task 7；§4（测试 13 用例）→ Task 1+2；§5（文档清单）→ Task 7；§6（验收）→ Task 8。
- **类型一致性**：`ErrorCategory` / `CliError` / `formatCliError` / `printError` / `printErrorJson` / `exitWithError` 命名在 spec、Task 1 实现、Task 4-6 引用间一致；`extractExitCode(content): number | undefined` 与 `buildGateLogKeys(fileAbs, cwd): string[]` 签名在 Task 2 定义、测试、check-run-log 改造间一致。
- **无占位符**：Task 1/2 含完整代码；Task 4-6 含通用改造模式 + 每脚本要点清单（机械替换有明确类别判定表与消息模板）；Task 7/8 含精确插入内容与命令。
- **pure 边界**：`buildGateLogKeys` 纯字符串实现（不 import node:path），符合 coverage 矩阵 *-logic.ts 纯函数约束。
- **行为保留**：read-json-or-exit 契约（exit 2 / 坏行 warn+skip）、check-role-dispatch 坏行 exit 2、wm-status 未初始化 exit 0、exit 1 violations + XXX_JSON 结构——均不改变，仅消息/输出结构归一。
- **版本约定**：31.0.0 → 32.0.0 三处同步。
- **执行方式**：Subagent-Driven（每任务独立子代理 + 规范审查 + 质量审查）或 Inline，由用户选择。
