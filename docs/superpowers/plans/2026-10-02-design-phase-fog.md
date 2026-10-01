# 批次 2（设计期未决问题：A3 设计期迷雾登记册 + A4 可选能力≠运行时边）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把阶段 1 迷雾登记册机制延展到设计期（阶段 2-4，文档机制 + 新门禁脚本 check-design-fog.ts），并在图模型/模板层落「可选能力≠运行时边」边界（图内无可选语义，A4 方案 A）。

**架构：** 新增自包含门禁脚本（logic 纯函数 `checkDesignFog` + CLI，照 check-coverage-scope.ts 样板）；三主模板 + discipline-dod×3 + phase-2/3/4 细则 + graph-guide/SSoT/AGENTS 文档面；全套新增脚本登记义务（计数 46→47、dispatch-matrix、samples 矩阵、NEGATIVE-COVERAGE、self-test 用例区）。

**技术栈：** TypeScript + tsx + vitest（config/vitest.config.ts）；无新依赖。

**规格：** [2026-10-02-design-phase-fog-and-optional-capability-design.md](../specs/2026-10-02-design-phase-fog-and-optional-capability-design.md)（D1-D5 已裁定）；跨批次契约：[批次总纲 §4](../specs/2026-09-30-absorption-batches-master-outline.md)。

> **⚠️ 行号口径**：本文行号采集于 main @ 9b2a2125（2026-10-02）。文档编辑任务（5-8）以内容定位为主、行号为辅。

---

## 与规格的实施事实澄清（采集实证，实施前必读）

1. **探针零登记**：`lib/exit2-probe-registry.ts:83-86` 对全部 `cli/*.ts`（除 self-test）自动注册 `#invalid-argument` 探针（args `['--d4-invalid-argument']`）——新脚本**不手动注册探针**，但必须做到：未知 flag → ARG_INVALID exit 2（探针断言零漂移）。
2. **计数 46→47 的同步点（8 处 / 5 文档 + SKILL.md，全受 docs-consistency 解析比对）**：AGENTS.md:22（§1「全仓 46 个脚本」）、AGENTS.md:45（§2「46 清单见 §8」）、SKILL.md:121 与 :144（「门禁脚本 47 个 .ts」= 46 exit-2 + self-test → **48 个 .ts**）、conventions.md:156（「= 46（27 个 check-* + 19 个工具 CLI…）」→ **= 47（28 个 check-* + 19 个工具 CLI…）**，算式自洽受 checkConventionsExit2Count 校验）、subagent-delegation.md:377 与 :379（46→47）、NEGATIVE-COVERAGE.md:4 与 :39（46→47）。SSoT:1430 的 46 是历史零面承诺表述，**不动**。
3. **NEGATIVE-COVERAGE 每门禁恰一行**（fixture 机制行须为该门禁真实失败案例且被 self-test 覆盖恰一处）——本批次登记 1 行（bad-unresolved-fog.md，R4 机制）；其余 bad fixture 不占行。
4. **samples/README.md 先加行再建目录**（:61 明文）；self-test 未引用的 fixture 会被 check-samples-coverage 报「fixture 未被引用」。
5. **discipline-dod DoD 门禁尾注**（system-design/discipline-dod.md:28）校验 `- [ ]` 项 ≥ 8 条——新增 1 条后为 9 条，仍满足；phase-4:245「DoD ≥ 8 项」同不受扰。
6. **checkScriptRegistry**（docs-consistency-logic.ts:1302-1325）：每个 cli 基名必须出现在 subagent-delegation.md dispatch-matrix 节——任务 4 的 dispatch-matrix 追加是**硬性**（否则 docs-consistency exit 1）。
7. **package.json 无 check:coverage-scope / check:pollution alias**——alias 是可选面；本批次照 check:verifier 先例加 `check:fog`（规格 §2.3 已承诺）。
8. **check-design-fog 的 logic 违规消息前缀**：`R1:`-`R6:`（规格 §2.3 六规则）；self-test 负例断言用这些前缀。

## 文件结构（改动面锁定）

| 文件 | 动作 | 职责 |
|---|---|---|
| `w-model-dev/scripts/logic/design-fog-logic.ts` | **新增** | 纯函数 checkDesignFog（R1-R6），不触 IO/process |
| `w-model-dev/scripts/cli/check-design-fog.ts` | **新增** | CLI：--doc/--phase 单值、FOG_JSON、exit 0/1/2 |
| `w-model-dev/scripts/__tests__/design-fog-logic.test.ts` | **新增** | R1-R6 逐规则单测 |
| `w-model-dev/scripts/__tests__/design-fog-cli.test.ts` | **新增** | exit 三态 + JSON 形状 + 参数错误 |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 | DESIGN_FOG_CASES 区（接口+数组+runner+汇总行） |
| `w-model-dev/scripts/samples/design-fog/`（5 fixtures） | **新增** | valid×2 + bad×3（markdown 主文档片段） |
| `w-model-dev/scripts/samples/README.md` + `NEGATIVE-COVERAGE.md` | 修改 | 矩阵行 + 负向登记行 |
| `package.json` | 修改 | check:fog alias + version 42.8.0 |
| `AGENTS.md` / `SKILL.md` / `conventions.md` / `subagent-delegation.md` | 修改 | 计数同步 + §8 表行 + 机制索引 + dispatch-matrix |
| `templates/system-design.md` / `interface-design.md` / `detailed-design.md` + 三份 `discipline-dod.md` + `system-design/system-architecture.md` | 修改 | 迷雾节 + 占位词白名单 + DoD 项 + 可选能力注记位 |
| `w-model-dev/references/phase-2-system-design.md` / `phase-3-outline-design.md` / `phase-4-detailed-design.md` | 修改 | 机制节 + CHECKPOINT/验收接线 + FM + 禁止行为 |
| `w-model-dev/references/graph-guide.md` / `ingestion-cross.md` | 修改 | A4 边界节 / :113 修订 + A-evolve 步骤 |
| `docs/skill-design-document_SSoT.md` | 修改 | 10M 摘要节 + A4 边界句 + :1058 对齐 |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md` | 修改 | §5 表修复 + 批次 1/2/3 状态登记 |
| `CHANGELOG.md` | 修改 | 42.8.0 |

**不新增**：references 文件、pre-push 项、schema 改动、graph-logic 改动、新反模式。

---

### 任务 1：logic 层 checkDesignFog（R1-R6，TDD）

**文件：** 新增 `w-model-dev/scripts/logic/design-fog-logic.ts`；测试 `w-model-dev/scripts/__tests__/design-fog-logic.test.ts`

- [ ] **步骤 1：编写失败测试**（vitest，覆盖六规则 + 通过态 + fogStats）：

```typescript
import { describe, expect, it } from 'vitest';
import { checkDesignFog } from '../logic/design-fog-logic';

const SECTION = (rows: string[], marker = false) => `# 系统设计文档

## 10. 设计边界与非目标

- 非目标 1

### 迷雾登记册

> 登记设计期未决项。

${
  marker
    ? '本阶段无未终结迷雾项'
    : `| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似归属（SD 候选） | 毕业方向（设计项 / 非目标 / 需求级回退） | 毕业处置结果 |
|---|---|---|---|---|---|
${rows.join('\n')}`
}
`;

const ROW = (id: string, result: string, owner = 'SD-001', direction = '设计项') =>
  `| ${id} | 描述 | 依赖未定 | ${owner} | ${direction} | ${result} |`;

describe('checkDesignFog（批次2 设计期迷雾登记册）', () => {
  it('全终结表 + 通过态与 fogStats', () => {
    const md = SECTION([ROW('FOG-P2-01', '已毕业→SD-001'), ROW('FOG-P2-02', '判入非目标→§10', 'SD-002', '非目标')]);
    const r = checkDesignFog({ markdown: md, phase: 2 });
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.fogStats).toEqual({ total: 2, terminal: 2, unresolved: 0 });
  });
  it('R1：缺节 fail-closed', () => {
    const r = checkDesignFog({ markdown: '# 文档\n\n无迷雾内容\n', phase: 2 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R1'))).toBe(true);
  });
  it('R2：节内无表且无标记 → 违规', () => {
    const md = '# 文档\n\n## 迷雾登记册\n\n（空空如也）\n';
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R2'))).toBe(true);
  });
  it('合法无雾标记路径通过', () => {
    const r = checkDesignFog({ markdown: SECTION([], true), phase: 2 });
    expect(r.passed).toBe(true);
    expect(r.fogStats).toEqual({ total: 0, terminal: 0, unresolved: 0 });
  });
  it('R3：fogId 阶段前缀不匹配 → 违规', () => {
    const md = SECTION([ROW('FOG-P3-01', '已毕业→SD-001')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R3'))).toBe(true);
  });
  it('R3：fogId 位数不足 → 违规', () => {
    const md = SECTION([ROW('FOG-P2-1', '已毕业→SD-001')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R3'))).toBe(true);
  });
  it('R4：处置结果空 / 含待定 → 违规且计入 unresolved', () => {
    const md = SECTION([ROW('FOG-P2-01', ''), ROW('FOG-P2-02', '待定')]);
    const r = checkDesignFog({ markdown: md, phase: 2 });
    expect(r.violations.filter((v) => v.startsWith('R4')).length).toBe(2);
    expect(r.fogStats).toEqual({ total: 2, terminal: 0, unresolved: 2 });
  });
  it('R5：标记与数据行互斥（两侧各一违规态）', () => {
    const both = checkDesignFog({ markdown: SECTION([ROW('FOG-P2-01', '已毕业→SD-001')], true), phase: 2 });
    expect(both.violations.some((v) => v.startsWith('R5'))).toBe(true);
  });
  it('R6：毕业方向=设计项 但疑似归属空 → 违规', () => {
    const md = SECTION([ROW('FOG-P2-01', '已毕业', '', '设计项')]);
    expect(checkDesignFog({ markdown: md, phase: 2 }).violations.some((v) => v.startsWith('R6'))).toBe(true);
  });
  it('阶段 3/4 前缀正常判定', () => {
    expect(checkDesignFog({ markdown: SECTION([ROW('FOG-P4-01', '已毕业→DD-001')]), phase: 4 }).passed).toBe(true);
    expect(checkDesignFog({ markdown: SECTION([ROW('FOG-P2-01', '已毕业')]), phase: 3 }).violations.some((v) => v.startsWith('R3'))).toBe(true);
  });
});
```

- [ ] **步骤 2**：`npx vitest run w-model-dev/scripts/__tests__/design-fog-logic.test.ts --config config/vitest.config.ts` → FAIL（模块不存在）
- [ ] **步骤 3：实现** `logic/design-fog-logic.ts`：

```typescript
/**
 * 设计期迷雾登记册校验纯逻辑层（Design Fog Logic，批次 2 A3）
 *
 * 校验设计主文档（阶段 2-4）「迷雾登记册」节的结构与终结态，
 * 供 check-design-fog.ts（CLI）调用。纯函数层约束：不 import Node 内置 IO 模块，
 * 不触碰 process（见 __tests__/README.md「pure/IO 函数边界」）。
 */

export interface DesignFogStats {
  total: number;
  terminal: number;
  unresolved: number;
}

export interface DesignFogCheckResult {
  passed: boolean;
  violations: string[];
  fogStats: DesignFogStats;
}

const FOG_HEADING = /(^#{1,6}\s).*迷雾登记册/;
const MARKER = '本阶段无未终结迷雾项';
const TABLE_COLUMNS = ['迷雾项 ID', '模糊描述', '疑点', '疑似归属', '毕业方向', '毕业处置结果'];
const FOG_ID = (phase: number) => new RegExp(`^FOG-P${phase}-\\d{2,}$`);

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function checkDesignFog(input: { markdown: string; phase: number }): DesignFogCheckResult {
  const violations: string[] = [];
  const lines = input.markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((l) => FOG_HEADING.test(l.trim()));

  if (headingIndex < 0) {
    return {
      passed: false,
      violations: ['R1: 设计主文档缺少「迷雾登记册」节（fail-closed：无法区分「无雾」与「被删」；模板已含该节，正常态节必在）'],
      fogStats: { total: 0, terminal: 0, unresolved: 0 },
    };
  }

  const headingLevel = (lines[headingIndex]!.trim().match(/^#+/) ?? ['#'])[0]!.length;
  const sectionLines: string[] = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const m = lines[i]!.trim().match(/^(#+)\s/);
    if (m && m[1]!.length <= headingLevel) break;
    sectionLines.push(lines[i]!);
  }

  const hasMarker = sectionLines.some((l) => l.includes(MARKER));
  const headerIndex = sectionLines.findIndex((l) => l.trim().startsWith('|') && TABLE_COLUMNS.every((c) => l.includes(c)));
  const dataRows: string[][] = [];
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < sectionLines.length; i++) {
      const line = sectionLines[i]!.trim();
      if (!line.startsWith('|')) continue;
      if (/^\|[\s:|-]+\|?$/.test(line)) continue; // 分隔行
      dataRows.push(splitRow(line));
    }
  }

  if (headerIndex < 0 && !hasMarker) {
    violations.push('R2: 「迷雾登记册」节内既无六列登记表（迷雾项 ID/模糊描述/疑点/疑似归属/毕业方向/毕业处置结果）也无「本阶段无未终结迷雾项」标记');
  }
  if (hasMarker && dataRows.length > 0) {
    violations.push(`R5: 「本阶段无未终结迷雾项」标记与 ${dataRows.length} 行数据并存（互斥）`);
  }

  let terminal = 0;
  dataRows.forEach((cells, i) => {
    const id = cells[0] ?? '';
    if (!FOG_ID(input.phase).test(id)) {
      violations.push(`R3: 第 ${i + 1} 行迷雾项 ID「${id}」不符合 FOG-P${input.phase}-NN 格式（两位起数字）`);
    }
    const result = (cells[5] ?? '').trim();
    if (result === '' || result.includes('待定')) {
      violations.push(`R4: 第 ${i + 1} 行（${id}）毕业处置结果未终结（空或含「待定」；CHECKPOINT 前每项须有三选一处置）`);
    } else {
      terminal++;
    }
    const direction = (cells[4] ?? '').trim();
    const owner = (cells[3] ?? '').trim();
    if (direction.includes('设计项') && owner === '') {
      violations.push(`R6: 第 ${i + 1} 行（${id}）毕业方向为「设计项」但疑似归属为空（应填 SD/INTF/DD 候选 id）`);
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    fogStats: { total: dataRows.length, terminal, unresolved: dataRows.length - terminal },
  };
}
```

- [ ] **步骤 4**：聚焦 vitest → 全过；`npm run --silent typecheck` exit 0
- [ ] **步骤 5**：Commit：`feat(fog-logic): checkDesignFog 纯函数（R1 节存在 fail-closed/R2 表或标记/R3 fogId 前缀/R4 终结性/R5 标记互斥/R6 归属一致性）（批次2 任务1）`

### 任务 2：CLI check-design-fog.ts（TDD）

**文件：** 新增 `w-model-dev/scripts/cli/check-design-fog.ts`；测试 `w-model-dev/scripts/__tests__/design-fog-cli.test.ts`；修改 `package.json`（alias）

- [ ] **步骤 1：编写失败测试**（子进程三态 + JSON 形状，照 `check-coverage-scope.test.ts` 既有形态）：

```typescript
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(__dirname, '..', 'cli', 'check-design-fog.ts');
const GOOD = `# 文档\n\n## 10. 设计边界与非目标\n\n### 迷雾登记册\n\n本阶段无未终结迷雾项\n`;
const BAD = `# 文档\n\n## 迷雾登记册\n\n| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似归属（SD 候选） | 毕业方向（设计项 / 非目标 / 需求级回退） | 毕业处置结果 |\n|---|---|---|---|---|---|\n| FOG-P2-01 | 描述 | 依赖未定 | SD-001 | 设计项 |  |\n`;

function run(args: string[], doc?: string, content?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'design-fog-'));
  if (doc && content !== undefined) writeFileSync(join(dir, doc), content, 'utf8');
  const res = spawnSync('npx', ['tsx', CLI, ...args.map((a, i) => (a === '__DOC__' ? join(dir, doc!) : a))], {
    encoding: 'utf8',
    cwd: join(__dirname, '..', '..', '..', '..'),
  });
  const jsonLine = (res.stdout + '').split(/\r?\n/).find((l) => l.startsWith('FOG_JSON ') || l.startsWith('ERROR_JSON '));
  return { res, jsonLine, dir };
}

describe('check-design-fog CLI', () => {
  it('exit 0：全部终结（--doc=x --phase=2）且 FOG_JSON 形状正确', () => {
    const { res, jsonLine, dir } = run(['--doc=__DOC__', '--phase=2'], 'design.md', GOOD);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(jsonLine!.replace(/^FOG_JSON /, ''));
    expect(parsed).toMatchObject({ type: 'design-fog', passed: true, fogStats: { total: 0, terminal: 0, unresolved: 0 }, phase: 2 });
    rmSync(dir, { recursive: true, force: true });
  });
  it('exit 1：未终结项 → FOG_JSON violations 含 R4', () => {
    const { res, jsonLine, dir } = run(['--doc=__DOC__', '--phase=2'], 'design.md', BAD);
    expect(res.status).toBe(1);
    const parsed = JSON.parse(jsonLine!.replace(/^FOG_JSON /, ''));
    expect(parsed.passed).toBe(false);
    expect(parsed.violations).toEqual([{ rule: 'R4', count: 1 }]);
    rmSync(dir, { recursive: true, force: true });
  });
  it('exit 2：缺参 / 坏 phase / 文件不存在 / 未知 flag / 重复值 flag → ARG_INVALID|FILE_NOT_FOUND 且 ERROR_JSON + ✗[', () => {
    for (const args of [['--phase=2'], ['--doc=__DOC__'], ['--doc=__DOC__', '--phase=9'], ['--d4-invalid-argument']]) {
      const { res, jsonLine, dir } = run(args, 'design.md', GOOD);
      expect(res.status).toBe(2, args.join(' '));
      expect(jsonLine).toMatch(/^ERROR_JSON /);
      expect(res.stderr).toContain('✗ [');
      rmSync(dir, { recursive: true, force: true });
    }
    const missing = run(['--doc=__DOC__', '--phase=2'], 'nope.md', undefined);
    expect(missing.res.status).toBe(2);
    expect(missing.jsonLine).toContain('FILE_NOT_FOUND');
    const dup = run(['--doc=__DOC__', '--doc=__DOC__', '--phase=2'], 'design.md', GOOD);
    expect(dup.res.status).toBe(2);
    expect(dup.jsonLine).toContain('ARG_INVALID');
  });
});
```

（若项目已有 CLI 测试 helper/形态差异——如 spawnSync 参数或 cwd——照既有 `check-coverage-scope.test.ts` 形态适配，断言语义保持。）

- [ ] **步骤 2**：聚焦 vitest → FAIL（CLI 不存在）
- [ ] **步骤 3：实现** `cli/check-design-fog.ts`（照 check-coverage-scope.ts 样板）：

```typescript
#!/usr/bin/env node
/**
 * 设计期迷雾登记册门禁（批次 2 A3，check-design-fog）
 *
 * 校验阶段 2-4 设计主文档「迷雾登记册」节结构与终结态（R1-R6，见 design-fog-logic）。
 * 退出码：0=通过（全部终结或合法无雾标记）/ 1=校验失败 / 2=输入错误。
 */
import { readFileSync, existsSync } from 'node:fs';
import { checkDesignFog } from '../logic/design-fog-logic';
import { exitWithError, HandledCliError } from '../lib/cli-error';
import { runMain } from '../lib/run-main';
import { parseFlagValue, hasFlag } from '../lib/parse-args';

const VALUE_FLAGS = ['doc', 'phase'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const out: Partial<Record<ValueFlag, string>> = {};

  if (hasFlag(args, 'json')) {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: 'check-design-fog 暂无 --json 模式（摘要恒走 FOG_JSON）', exitCode: 2 });
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const name = arg.startsWith('--') && arg.includes('=') ? arg.slice(2, arg.indexOf('=')) : arg.slice(2);
      if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
        exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: `未知 flag --${name}（支持：${VALUE_FLAGS.map((f) => `--${f}`).join(' ')}）`, exitCode: 2 });
      }
    }
  }
  for (const f of VALUE_FLAGS) {
    const value = parseFlagValue(args, f);
    if (value === undefined) {
      exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: `缺少必需 flag --${f}`, exitCode: 2 });
    }
    out[f] = value;
  }
  const phase = Number(out.phase);
  if (!Number.isInteger(phase) || phase < 2 || phase > 4) {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: `--phase 必须为 2|3|4（实际 ${out.phase}）`, exitCode: 2 });
  }
  const docPath = out.doc!;
  if (!existsSync(docPath)) {
    exitWithError({ category: 'FILE_NOT_FOUND', rule: 'P0-2', message: `设计主文档不存在: ${docPath}`, file: docPath, exitCode: 2 });
  }
  let markdown: string;
  try {
    markdown = readFileSync(docPath, 'utf8');
  } catch (err) {
    exitWithError({ category: 'FILE_READ', rule: 'P0-2', message: `设计主文档不可读: ${docPath}`, file: docPath, detail: err instanceof Error ? err.message : String(err), exitCode: 2 });
    throw new HandledCliError();
  }

  const result = checkDesignFog({ markdown, phase });
  const violations = Object.entries(
    result.violations.reduce<Record<string, number>>((acc, v) => {
      const rule = v.slice(0, v.indexOf(':'));
      acc[rule] = (acc[rule] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([rule, count]) => ({ rule, count }));

  console.log(
    `FOG_JSON ${JSON.stringify({ type: 'design-fog', passed: result.passed, doc: docPath, phase, reasons: result.passed ? [] : result.violations, violations, fogStats: result.fogStats, exitCode: result.passed ? 0 : 1 })}`,
  );
  if (!result.passed) process.exitCode = 1;
}

runMain(main);
```

（细节以仓内样板为准：`parseFlagValue` 对重复值 flag 抛 `DuplicateFlagError` → runMain 转 ARG_INVALID；若 lib/parse-args 实际形态与此有出入，照实适配，语义保持：重复值/未知/缺参/坏 phase 均 exit 2 + `✗ [ARG_INVALID]` stderr + ERROR_JSON stdout。）

- [ ] **步骤 4**：聚焦 vitest → 全过；typecheck exit 0
- [ ] **步骤 5**：`package.json` scripts 校验类块（"check:docs-consistency" 行后）加：`"check:fog": "tsx w-model-dev/scripts/cli/check-design-fog.ts",`
- [ ] **步骤 6**：Commit：`feat(fog): check-design-fog CLI（--doc/--phase 单值、FOG_JSON、exit 0/1/2 结构化错误）+ check:fog alias（批次2 任务2）`

### 任务 3：样本 + self-test 用例区 + 负向登记

**文件：** 新增 `samples/design-fog/` 5 fixtures；修改 `self-test.ts`、`samples/README.md`、`NEGATIVE-COVERAGE.md`

- [ ] **步骤 1**：`samples/README.md` 矩阵先加行（表尾，coverage-scope 行形态仿写）：

```markdown
| `design-fog`           | check-design-fog | DESIGN_FOG_CASES（5） | 设计期迷雾登记册（A3）：阶段 2-4 主文档迷雾节结构与终结态 | 平铺 Markdown（设计主文档片段形态） | 放宽 R4 终结性将让未毕业迷雾项静默进入阶段门，迷雾逃逸覆盖与设计义务 |
```

- [ ] **步骤 2**：建 5 个 fixture（真实 Markdown 主文档片段，均含 `# {{module}} 系统设计文档` 头 + `## 10. 设计边界与非目标` 节 + `### 迷雾登记册` 子节，六列表头与任务 1 SECTION 一致）：
  - `valid-all-terminal.md`：2 行，FOG-P2-01 已毕业→SD-001、FOG-P2-02 判入非目标→§10（毕业方向=非目标、疑似归属可空）
  - `valid-no-fog-marker.md`：无数据行 + 标记行「本阶段无未终结迷雾项」
  - `bad-unresolved-fog.md`：2 行，FOG-P2-01 处置结果空、FOG-P2-02 处置结果「待定」→ R4×2
  - `bad-missing-section.md`：只有 `## 10. 设计边界与非目标` 与非目标列表，**无**迷雾登记册节 → R1
  - `bad-marker-conflict.md`：标记行 + 1 行已毕业数据行 → R5
- [ ] **步骤 3**：`self-test.ts` 新增用例区（照 COVERAGE_SCOPE_CASES 形态：接口 + 数组 + runner + 汇总行；runner 内 spawn `check-design-fog.ts` 断言 exit code + FOG_JSON violat violations 规则集）：

```typescript
interface DesignFogCase {
  file: string;
  phase: number;
  expectedPassed: boolean;
  expectedRulesFailed?: string[];
  description: string;
}
const DESIGN_FOG_CASES: DesignFogCase[] = [
  { file: 'valid-all-terminal.md', phase: 2, expectedPassed: true, description: '全终结迷雾册：exit 0' },
  { file: 'valid-no-fog-marker.md', phase: 2, expectedPassed: true, description: '合法无雾标记：exit 0' },
  { file: 'bad-unresolved-fog.md', phase: 2, expectedPassed: false, expectedRulesFailed: ['R4'], description: '未终结迷雾项（空/待定）：R4' },
  { file: 'bad-missing-section.md', phase: 2, expectedPassed: false, expectedRulesFailed: ['R1'], description: '缺迷雾登记册节：R1 fail-closed' },
  { file: 'bad-marker-conflict.md', phase: 2, expectedPassed: false, expectedRulesFailed: ['R5'], description: '标记与数据行并存：R5' },
];
```

汇总行：`console.log(\`DesignFog 用例 : ${DESIGN_FOG_CASES.length}\`)`（插在其他汇总行邻域）。
- [ ] **步骤 4**：`NEGATIVE-COVERAGE.md` 表一（fixture 机制节）追加 1 行（28 行→29 行注释同步）：

```markdown
| check-design-fog                  | `samples/design-fog/bad-unresolved-fog.md` | fixture | 放宽 R4 终结性（处置结果空/待定放行）将让未毕业迷雾项静默通过阶段门，迷雾逃逸设计义务且绕过三选一毕业处置 |
```

并把 :4「全表 46 行」→ 47 行、:39「46 个脚本」→ 47 个脚本（此两处与任务 4 计数同属 46→47 同步面，也可在任务 4 一并做——**实施者任选一处统一改，报告说明**）。
- [ ] **步骤 5**：验证：`npm run self-test`（即 npx tsx self-test.ts）exit 0 且输出含「DesignFog 用例 : 5」→ `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` exit 0（探针零漂移——check-design-fog 的 `#invalid-argument` 探针此时应已被自动注册并通过）
- [ ] **步骤 6**：Commit：`test(fog): design-fog 样本 5 fixtures + self-test DESIGN_FOG_CASES + NEGATIVE-COVERAGE 登记（批次2 任务3）`

### 任务 4：计数同步 + 登记面（docs-consistency 闭合）

**文件：** 修改 `AGENTS.md`、`SKILL.md`、`conventions.md`、`subagent-delegation.md`

- [ ] **步骤 1**：AGENTS.md——:22「全仓 46 个脚本」→ 47；:45「完整 exit-2 脚本 46 清单」→ 47；§8 表在 check-verifier-output.ts 行后插入：

```markdown
| check-design-fog.ts                  | 设计期迷雾登记册门禁（批次 2 A3；R1 节存在 fail-closed/R2 六列表或无雾标记/R3 fogId 阶段前缀/R4 处置终结性/R5 标记互斥/R6 设计项归属一致性；`--doc=<主文档.md> --phase=2\|3\|4`，stdout 单行 FOG_JSON） | 2-4                        | 0=通过，1=校验失败，2=输入错误                       |
```

- [ ] **步骤 2**：SKILL.md :121 与 :144「门禁脚本 47 个 .ts」→ 48（= 47 exit-2 + self-test；两处上下文句照原文仅换数字）
- [ ] **步骤 3**：conventions.md :156：「= 46（27 个 check-* + 19 个工具 CLI（含 7 个 code-health 门禁 CLI），不含 self-test」→「= 47（28 个 check-* + 19 个工具 CLI（含 7 个 code-health 门禁 CLI），不含 self-test」（句尾「含 review-package.ts / …」清单按需追加 check-design-fog.ts，保持该句枚举语义）
- [ ] **步骤 4**：subagent-delegation.md——:377「其中 46 个为 exit-2 脚本」→ 47、:379「核对全部 46 个 cli 脚本名」→ 47；dispatch-matrix：§6.1 阶段总表与 §6.3 阶段专属脚本表的**阶段 2/3/4 行**的 check 脚本列各追加 `check-design-fog(--phase=N)`（N=2/3/4 对应）
- [ ] **步骤 5**：验证：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0（checkExit2ScriptCount 46→47 实测比对 + checkScriptRegistry 基名登记 + SKILL.md .ts 计数三检查全过）
- [ ] **步骤 6**：Commit：`chore(register): check-design-fog 登记面——计数 46→47（AGENTS/SKILL/conventions/delegation 八处）+ §8 表行 + dispatch-matrix 阶段 2-4（批次2 任务4）`

### 任务 5：三主模板迷雾节 + 占位词白名单 + DoD 项

**文件：** 修改 `templates/system-design.md`、`interface-design.md`、`detailed-design.md`、三份 `discipline-dod.md`

- [ ] **步骤 1**：三主模板「禁止占位词」行（system-design.md:25 / interface-design.md:24 / detailed-design.md:23）统一改：`待定` 仅允许出现在 §10(§8) 非目标显式标注中 → **「`待定` 仅允许出现在非目标显式标注与迷雾登记册节中。」**
- [ ] **步骤 2**：三主模板的非目标节（system-design §10 :98-102 后、interface-design §8 :113-117 后、detailed-design §8 :109-113 后、附录 A 之前）插入子节（标题层级用 `###`，字面含「迷雾登记册」；`FOG-P2`/`FOG-P3`/`FOG-P4` 与 `SD`/`INTF`/`DD` 按模板替换；phase 细则链接按 2/3/4 换）：

```markdown
### 迷雾登记册（设计期，批次 2 A3）

> 登记本阶段 in-scope、方向已见但尚无法精确陈述「该设计决策的问题」的设计事项（S 子代理产出设计时经锐利性测试入册；判据与阶段 1 同构——判「能否精确陈述问题」，非「能否给出答案」；机制权威见 [phase-2-system-design.md](../../w-model-dev/references/phase-2-system-design.md)「设计期迷雾登记册」节）。
> **强制项**：阶段末（CHECKPOINT 前）每项须有毕业处置结果（①毕业成设计项 / ②判入非目标 / ③需求级回退）；全部终结后可标注「本阶段无未终结迷雾项」。
> **区分**：本节 = 设计方向已见但说不清（in-scope 未成形）；非目标 = 明确不做；ADR/decisions = 已能陈述且已选（phase-2 :110/:132 通道）。
> **门禁**：`check-design-fog.ts --doc=<本主文档> --phase=N`（R1-R6，exit 0 才可过阶段门）。

| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似归属（SD 候选） | 毕业方向（设计项 / 非目标 / 需求级回退） | 毕业处置结果 |
|---|---|---|---|---|---|
| FOG-P2-01 | {{描述}} | {{依赖未定 / 技术不成立 / 边界未定 / 容量未知 / 需求级可疑}} | {{SD-xxx 或 空}} | {{方向}} | {{处置结果 + 对应 SD / §10 / 变更引用}} |

（无迷雾项时填一行：「本阶段无未终结迷雾项」）
```

（三模板的引用块相对路径与 SD/INTF/DD、FOG-P2/P3/P4、phase 链接逐模板替换；system-design.md 插在 §10 列表与 `## 附录 A` 之间；interface-design/detailed-design 插在 §8 列表与 `## 附录 A`/文件尾之间。）
- [ ] **步骤 3**：三份 discipline-dod.md 各加 1 条勾选项（插在「记录与审计」项前）：`- [ ] 设计期迷雾清空：迷雾登记册每项有终结处置结果（或标注「本阶段无未终结迷雾项」）；check-design-fog.ts --phase=N 退出码 0`
- [ ] **步骤 4**：验证：`npx tsx w-model-dev/scripts/cli/check-design-fog.ts --doc=w-model-dev/templates/system-design.md --phase=2` exit 0（模板自身即合法形态——迷雾节在、标记行在、无数据行）；typecheck 不涉；prettier --check 三模板 + 三 DoD
- [ ] **步骤 5**：Commit：`docs(templates): 三主模板迷雾登记册节（六列表+无雾标记+门禁引用）+ 占位词白名单扩 + discipline-dod 迷雾清空项（批次2 任务5）`

### 任务 6：phase-2/3/4 机制节 + CHECKPOINT 接线 + 判罚

**文件：** 修改 `references/phase-2-system-design.md`、`phase-3-outline-design.md`、`phase-4-detailed-design.md`

- [ ] **步骤 1**：三文档各插入 `## 设计期迷雾登记册（A3，批次 2）` 节（统一放 ingestion 子流程节之后、验收标准之前；phase-2 在 :215 之后）。节内容（三份同文，按表替换）：

```markdown
## 设计期迷雾登记册（A3，批次 2）

### 定义与锐利性测试

- **设计期迷雾项**：in-scope、方向已见、但**当前无法精确陈述该设计决策的问题**的设计事项。锐利性测试判据与阶段 1 同构：判「**能否精确陈述问题**」，不判「能否给出答案」——能精确陈述 → 走 ADR 三问（:110）或 `decisions/` 记录（:132）正常决策；不能 → 入主模板「迷雾登记册」节。
- **疑点轴（fogBlocker）**：`依赖未定` / `技术不成立` / `边界未定` / `容量未知` / `需求级可疑`（毕业时优先分流到需求级回退）。

### 毕业三选一（CHECKPOINT 前强制清空）

1. **毕业成设计项**：补全为正式设计内容并建图节点（{TYPE} 按阶段），全部图谱不变量适用（implements/信息流/锚点）；
2. **判入非目标**：写入主模板非目标节（持久拒绝登记，永不自动复活；复活=正式变更）；
3. **需求级回退**：判定为需求级未知 → 走需求规格书 §11.5 迷雾毕业变更流程（用户 🔴 CHECKPOINT 确认，可能触发范围重画）。

### 通道划界（四者互斥，V 评审按此核验）

已能陈述且已选 → ADR/`decisions/`；不能精确陈述 → 迷雾登记册；明确不做（设计层）→ 非目标；明确不做（需求层）→ 阶段 1 §8 Out of Scope。豁免审批为阶段 1 专属，设计期暂缓一律走非目标 + 显式披露。探索期取证复用阶段 1 受控低仪式探索通道口径（question-first + 捕获纪律 + 默认零持久化，探索物不入册不建图）。

### 门禁与判罚

- **门禁**：G 在阶段门前跑 `check-design-fog.ts --doc=<主文档> --phase={N}`（R1-R6）；exit 1（存在未终结项）→ 一律返工，不得放行。
- **失败模式（本地）**：FM-{XX}-08 迷雾滥用（设计期）——检测信号 A：S 把本应正式的设计决策塞入迷雾册逃避设计义务（R/V 发现迷雾项实为可精确陈述）；检测信号 B：CHECKPOINT 前迷雾册存在未终结项。处置：均按普通 V/G 失败链（hard-constraints）完成后补毕业处置或补全设计。

（{N}=2/3/4；{TYPE}=SD/INTF/DD；{XX}=SD/OD/DD 对应各阶段失败模式编号前缀）
```

- [ ] **步骤 2**：三文档 CHECKPOINT 行（phase-2:228 / phase-3:254 / phase-4:247）两处编辑（以 phase-2 原文为 old_string 基准，逐字替换）：
  - 展示清单插入：「…系统测试用例（含端到端 + 性能基线 + 安全基线）**/ 设计期迷雾清空披露** / RTM 补登」（phase-3：集成测试用例后；phase-4：单元测试用例后）
  - 尾句追加：「架构图缺失或系统测试用例未含性能/安全基线 → 一律返工。**迷雾登记册存在未终结项（check-design-fog exit 1）→ 一律返工。**」（phase-3/4 尾句按各自原文追加同款）
- [ ] **步骤 3**：三文档验收标准清单各加 1 条 `- [ ]`（「RTM 已补登…」条后）：`- [ ] 设计期迷雾登记册已清空（check-design-fog.ts --doc=<主文档> --phase={N} 退出码 0）`
- [ ] **步骤 4**：三文档失败模式矩阵各追加 FM-{XX}-08 行（表尾，格式照 FM-SD-01 四列）；禁止行为表各追加两行（编号顺延现有最大号；phase-2 现至 8 → 加 9/10；phase-3 同；phase-4 现至 9 → 加 10/11）：

```markdown
| {n} | 可选能力建图节点/边（A4） | 设计提及但非本次承诺的能力（未来扩展/可选集成/降级路径）出现在 graph.json | 可选能力登记于迷雾登记册/非目标；进图=承诺运行时事实（graph-guide「可选能力边界」节），转正须走正式变更 |
| {n+1} | 把非目标/迷雾项写进模块划分（§3） | 非目标或迷雾项对应物出现在 §3 模块划分/规范性子系统清单 | 模块划分只承载本次承诺的运行时结构；未决项留迷雾册、不做项留非目标 |
```

- [ ] **步骤 5**：验证：check-docs-consistency exit 0（活体文档一致性）；grep 三文档各含「设计期迷雾登记册」「check-design-fog」≥1 处
- [ ] **步骤 6**：Commit：`docs(phases): 阶段 2-4 设计期迷雾登记册机制节（锐利性判据/三选一/通道划界/FM-{XX}-08）+ CHECKPOINT 接线 + A4 禁止行为（批次2 任务6）`

### 任务 7：A4 文档面（graph-guide + system-architecture + SSoT 边界句）

**文件：** 修改 `references/graph-guide.md`、`templates/system-design/system-architecture.md`、`docs/skill-design-document_SSoT.md`

- [ ] **步骤 1**：graph-guide.md 在「多层图谱（7 层）」节末（:118 之后、「## 校验脚本」:120 之前）插入：

```markdown
## 可选能力边界（批次 2 A4）

1. **进入图 = 承诺为运行时事实**：节点/边只承载本次交付承诺的运行时结构；全部不变量（implements/defines/realizes/信息流/锚点）无一豁免。
2. 设计提及但非本次承诺的**可选能力**（未来扩展/可选集成/降级路径）**不建图节点、不建边**：未决的登记于设计主文档「迷雾登记册」，明确不做/已决策暂缓的登记于「非目标」（附决策引用）。
3. **P2（可以）≠ 可选能力**：priority 是需求排序语义（MoSCoW），范围内 P2 需求照常建 REQ/SD 图节点并承担全部不变量；两套「可选」以此划界，不得混用。
4. 可选能力后续转正 = 正式变更（走迷雾毕业①或需求变更流程），转正时按当时阶段建节点并补全全部不变量。方案 A 下不设任何豁免标记——批次 1 的 SDMAP/codeModule 对账面天然不受影响（可选能力不产生 SD 节点，即无对账义务）。
```

- [ ] **步骤 2**：system-architecture.md——§2 表格后「强制」引用块后追加一行：`> 可选能力不进本清单：进入本清单 = 承诺为运行时子系统（与主模板 §3 一一对应，R9 校验）；设计提及但非本次承诺的能力登记于 §7「可选能力」与迷雾登记册/非目标（graph-guide「可选能力边界」节）。`；§7 末追加一条 bullet：`- 可选能力（不进图）：{{设计提及但非本次承诺的能力清单}}——仅登记于此与迷雾登记册/非目标，不建图节点/边、不承担图谱不变量、不产生 codeModule 对账义务`
- [ ] **步骤 3**：SSoT §10.7 开头引用块（:1494 触发方行后）追加一行：`> 图内无可选语义（批次 2 A4，方案 A）：节点/边只承载本次交付承诺的运行时事实；可选能力不建图节点/边，登记于设计文档迷雾登记册/非目标——权威节见 §10M。`
- [ ] **步骤 4**：SSoT:1058 evidenceAnchor 滞后表述对齐（old_string 为该 bullet 原文，new_string）：`- **evidenceAnchor（必填）**：节点结论的前提事实锚点（产出期声明，A 子代理 ingestion 时写、S 规格 §4.2 只读同步、G 门禁 R15 格式校验）；graph.schema.json 已列为 required——历史「可选、未声明不阻断」口径已被升级取代（批量迁移是升级动作，不是可选清理，见 :2259 同族口径）。`（:2259 为行号引用，实际写「见本文『批量迁移』同族口径」避免行号漂移）
- [ ] **步骤 5**：验证：check-docs-consistency exit 0；grep graph-guide 含「进入图 = 承诺为运行时事实」
- [ ] **步骤 6**：Commit：`docs(a4): graph-guide 可选能力边界（进图=承诺/P2 划界/无豁免标记）+ system-architecture 表达位 + SSoT 边界句与 :1058 对齐（批次2 任务7）`

### 任务 8：ingestion-cross 修订 + AGENTS 机制索引 + SSoT 10M 摘要节

**文件：** 修改 `references/ingestion-cross.md`、`AGENTS.md`、`docs/skill-design-document_SSoT.md`

- [ ] **步骤 1**：ingestion-cross.md A-evolve 算法（:27-33）追加步骤 6：`6. 设计变更引入的新未决项（依赖未定/技术不成立/边界未定/容量未知）经锐利性测试登记入对应阶段主模板「迷雾登记册」节（CHECKPOINT 前强制清空；见各阶段细则「设计期迷雾登记册」节）`
- [ ] **步骤 2**：ingestion-cross.md :113 整句替换：`> §4-§7 是阶段1 专用增强（阶段2-4 的 A-evolve 不产出 §4-§7，因 REQ 层级树在阶段1 已固化；需求层迷雾登记册亦于阶段 1 固化——设计层未决项由阶段 2-4 维护（批次 2 A3）：A-evolve 步骤 6 登记入对应阶段主模板迷雾登记册节）。`
- [ ] **步骤 3**：AGENTS.md:18 机制索引行整行替换（措辞最小扩写）：

```markdown
- **阶段 1-4 迷雾登记册（Fog of War）**：需求层（阶段 1）——REQ 入学锐利性测试（`references/ingestion-chunk.md`，判据 = 能否精确陈述需求的问题，非能否回答）/ A-cross 报告 §7 迷雾汇总 / 毕业机制三选一（毕业成 REQ / 判 Out of Scope / 豁免审批，CHECKPOINT 前强制清空，`references/phase-1-requirements.md`「迷雾登记册（Fog of War）」节）；设计层（阶段 2-4，批次 2 A3）——设计期锐利性测试（判据 = 能否精确陈述设计决策的问题）/ 毕业三选一（设计项 / 非目标 / 需求级回退）/ 门禁 `check-design-fog.ts`（`references/phase-2-system-design.md` 等三阶段「设计期迷雾登记册」节）。迷雾册为文本节不建图节点；可选能力不进图（A4，`references/graph-guide.md`「可选能力边界」节）。
```

- [ ] **步骤 4**：SSoT 在 10L.8 段末与 `## 10.10` 之间（:2355/:2361 空档）插入新字母节 `## 10M 设计期迷雾登记册与可选能力边界（批次 2，2026-10-02）`（仿 §10.5.3 四件套形态：**目标** 段 + **落点表**（机制权威=phase-2/3/4 细则节；登记载体=三主模板迷雾登记册子节；门禁=check-design-fog.ts（logic/design-fog-logic.ts）；入口动作=ingestion-cross.md A-evolve 步骤 6；A4 边界=graph-guide「可选能力边界」节）+ **能力分工不夸大** bullet（脚本只判结构与终结态，不判语义真伪——「迷雾项是否本可精确陈述」仍由 R/V 人工核验）+ **判据披露** bullet（锐利性测试设计期判据；四通道划界））。
- [ ] **步骤 5**：验证：check-docs-consistency exit 0（design-docs/孤儿 references/节编号检查不破）；typecheck 不涉
- [ ] **步骤 6**：Commit：`docs(a3-index): ingestion-cross 固化句修订 + A-evolve 步骤 6 + AGENTS 机制索引阶段 1-4 扩写 + SSoT §10M 摘要节（批次2 任务8）`

### 任务 9：总纲 §5 表修复 + CHANGELOG 42.8.0 + 全链收口

**文件：** 修改 `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md`、`CHANGELOG.md`、`package.json`

- [ ] **步骤 1**：总纲 §5 表修复——把 :97-100 孤行（| 2 |~| 5 |）移回 :72 批次 1 行之后使表连续，并更新三行状态：

```markdown
| 1 | 2026-09-30-design-code-consistency-anchors-design.md（commit 31730600） | 2026-09-30-design-code-consistency-anchors.md（fa05d196） | **已实现并合入 main**（16 提交 fa05d196..d0a180a9；合并提交 6a2029df；合并结果全量测试 1900/1900；版本 42.6.0） |
| 2 | 2026-10-02-design-phase-fog-and-optional-capability-design.md（commit dea72625） | 2026-10-02-design-phase-fog.md | **实现中**（D1-D5 已裁定：A4 方案 A / A3 文档+脚本 / 三选一+回退 / 复用四字段） |
| 3 | 2026-10-01-gate-engineering-design.md（commit 00778532） | 2026-10-01-gate-engineering.md（ef59d54a） | **已实现并合入 main**（13 提交 6a2029df..73cab34d；合并提交 9b2a2125；合并结果全量测试 1942/1942；版本 42.7.0） |
| 4 | — | — | 未立项 |
| 5 | — | — | 未立项（条件见 §3） |
```

（§5.1 散文块保持在表后原位。）
- [ ] **步骤 2**：`package.json` version 42.7.0 → **42.8.0**；CHANGELOG.md 顶部新增 `## [42.8.0] - 2026-10-02` 条目（照 42.7.0 条目格式：来源 blockquote + 主题节；内容 = A3 机制+脚本 / A4 边界 / 登记面计数 47 / 样本 5 / 版本级联），同步 `w-model-dev/SKILL.md` frontmatter version 与 `w-model-dev/skill-metadata.json`（version + updatedAt 2026-10-02）
- [ ] **步骤 3**：全链验证（逐项留输出）：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0 → `npm run self-test` exit 0 → `npm run --silent typecheck` exit 0 → `npm run eval` exit 0（预期零影响）→ `npm run prepush`（**后台运行** `npm run prepush > /tmp/prepush-batch2.log 2>&1`，约 25 分钟，轮询日志至 19 项汇总与 exit code；失败读日志修复后重跑整条）
- [ ] **步骤 4**：Commit：`chore(release): 42.8.0 批次2 收口——设计期未决问题（A3 迷雾登记册+check-design-fog/A4 可选能力边界；计数 47；总纲 §5 修复；prepush 19 项全绿）`

---

## 自检记录（计划编写者已执行）

1. **规格覆盖度**：§2.1 机制定义→任务 6（细则节）；§2.2 模板落点→任务 5；§2.3 脚本→任务 1/2/3/4（R1-R6→任务 1，CLI/FOG_JSON/alias→任务 2，样本/self-test/NEGATIVE-COVERAGE→任务 3，登记义务→任务 4）；§2.4 流程接线与判罚→任务 6；§2.5 文档对齐→任务 4（dispatch-matrix）+任务 8（AGENTS 索引/SSoT）；§3 A4 四条→任务 7（graph-guide）+任务 6（禁止行为）+任务 8（SSoT 10M）+任务 7（:1058 对齐）；§4 范围表逐行→任务 1-9 无遗漏；§5 DoD 六条→任务 3（①②）/6（③）/7+8（④⑤）/9（⑥）。
2. **占位符**：无「待定/TODO」；{N}/{TYPE}/{XX}/{n} 为显式替换表参数（各任务给出替换值）；测试与实现代码块完整。
3. **类型一致性**：`checkDesignFog({markdown, phase})`（任务 1 定义、任务 2 消费）；`FOG_JSON` 键序 type/passed/doc/phase/reasons/violations/fogStats/exitCode（任务 2 定义、任务 3 runner 断言）；`DesignFogCase` 字段与 runner（任务 3 内闭环）；R 前缀 R1-R6（任务 1 定义、3/5/6 引用）——签名一致。
