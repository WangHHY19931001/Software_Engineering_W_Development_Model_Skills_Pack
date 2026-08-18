# W-Model 技能包审计 16 项问题修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 2026-08-16 仓库审计发现的全部 16 项问题（文档漂移 / 门禁挂死 / 状态写损坏 / 分层违规 / 样板重复 / 计数口径），并把可回归的缺陷反哺为 check-docs-consistency 门禁。

**Architecture:** 按「代码修复 → 结构调整 → 内容修正 → 反回归门禁 → 全仓同步」推进。所有设计决策类改动遵循 SSoT 优先（AGENTS.md §6）：先 SSoT / 权威 references，再 w-model-dev 资产，最后 README / AGENTS / CHANGELOG。脚本改动保持自包含（仅 Node 标准库 + 已声明 devDeps），每任务收尾跑 self-test + vitest，最终统一跑 pre-push 16 项门禁。

**Tech Stack:** TypeScript (tsx runtime) / vitest / JSON Schema draft-07 / Node 标准库（node:fs / node:crypto / node:child_process）

**基线（2026-08-16 实测）**：self-test 256/256 ✅、vitest 42 files / 691 tests ✅、check-docs-consistency ✅、版本 41.17.0。

---

## 问题 → 任务映射

| # | 审计问题 | 严重度 | 处理任务 |
|---|---|---|---|
| P1 | SKILL.md 反模式 #22 编号冲突（子代理越界 vs RBAC 角色越权） | 高 | Task 7 |
| P2 | data-models.md action 枚举漂移（15 值 vs schema 27 值，三处口径不一） | 高 | Task 1 |
| P3 | check-tla-model.ts SANY/TLC 无超时（门禁可挂死） | 高 | Task 3 |
| P4 | wm-write 原子写缺陷（tmpPath 仅 pid + 回读失败不回滚） | 高 | Task 2 |
| P5 | logic 层分层违规（plan-chunks.ts / schema-loader.ts） | 中 | Task 5、Task 6 |
| P6 | 角色数量自相矛盾 + verifier-spec §7/§8 引用不精确 | 中 | Task 8 |
| P7 | 「33 个脚本」两种口径混用 + INSTALL.md 过期计数 31 | 中 | Task 6 |
| P8 | artifact-gate CLI 过厚 + Java 版本阈值双事实源 + bdd `as any` | 中 | Task 3（Java）、Task 9 |
| P9 | CLI 层 6 类重复样板未抽 lib | 中 | Task 4、Task 9 |
| P10 | readJsonOrExit `process.exit` 截断 ERROR_JSON 风险 | 低 | Task 4 |
| P11 | 反模式 #18/#19 无详细节 | 低 | Task 7 |
| P12 | design-contract 缺 `$id` + 6 份 schema 缺顶层 description | 低 | Task 10 |
| P13 | persona frontmatter 不统一（tools 字段 / color 混用） | 低 | Task 10 |
| P14 | command-reference 角色枚举缺 A/R + 反例/反模式术语混用 + CHECKPOINT 无清单 | 低 | Task 8、Task 11 |
| P15 | ensure-codegraph-opsx 静默吞错 + timeout/maxBuffer 魔法数字 + Java 解析重复 | 低 | Task 3、Task 9 |
| P16 | gate-logic.ts 无专属单测 + 3 个超大引用文件无分节导引 | 低 | Task 11 |

**执行顺序**：Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12。
Task 1/2/3 相互独立；Task 4 必须在 Task 9 之前（runMain 迁移依赖 HandledCliError）；Task 6（结构移动）必须在 Task 12（计数同步）之前完成；Task 7 依赖 Task 6 结束后的文件终态。

**全局约束（每个任务都必须遵守）**：
- 修改任何 `*-logic.ts` 后运行 `npm run self-test`（期望 exit 0）
- 新增/修改测试后运行 `npx vitest run --config config/vitest.config.ts`（期望全绿）
- 禁止引入新依赖（仅 Node 标准库 + 已有 devDeps）
- 不碰 `eval/`、`docs/superpowers/`（本计划文件自身除外）、`.trae-html-share-packages/`
- 提交信息用 conventional 风格（`fix:` / `refactor:` / `docs:` / `test:` / `chore:`）

---

### Task 1: 修复 run-log action 枚举漂移 + 门禁语义化强化

**Files:**
- Modify: `w-model-dev/references/data-models.md:391`（interface 联合类型）
- Modify: `w-model-dev/references/data-models.md:558`（RunLogEntry vs EventIngress 对照表「动作」行）
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`（checkRunLogAction 函数，约 345-365 行）
- Test: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **Step 1: 写失败测试**

在 `__tests__/docs-consistency-logic.test.ts` 末尾追加（若该文件的现有用例通过辅助函数构造输入，遵循其现有构造方式；下面给出独立完整的用例逻辑）：

```typescript
describe('run-log action 枚举语义同步（data-models.md interface vs schema enum）', () => {
  const schema27 = {
    properties: {
      action: {
        enum: ['chunk', 'cross', 'evolve', 'produce', 'review', 'gate', 'tla-gate', 'graph-gate',
          'test', 'checkpoint', 'rework', 'rollback', 'rootcause', 'fix', 'emergency-fix', 'escalate',
          'r3-completeness', 'r3-reliability', 'r3-security', 'codegraph_query',
          'opsx_explore', 'opsx_propose', 'opsx_apply', 'opsx_archive',
          'ensure_deps', 'iceberg-sweep', 'iceberg-review'],
      },
    },
  };

  it('interface 联合类型缺值时应报 run-log-action violation', () => {
    // dataModels 文本含「action 枚举（27 类）」字样但 interface 只有 15 值（复刻当前漂移）
    const drifted = [
      '## RunLogEntry',
      'action 枚举（27 类）',
      "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'escalate';",
    ].join('\n');
    const violations = checkRunLogAction(JSON.stringify(schema27), drifted);
    expect(violations.some((v) => v.check === 'run-log-action' && v.message.includes('漂移'))).toBe(true);
  });

  it('interface 与 enum 完全一致时无漂移 violation', () => {
    const synced = [
      '## RunLogEntry',
      'action 枚举（27 类）',
      "  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'emergency-fix' | 'escalate' | 'r3-completeness' | 'r3-reliability' | 'r3-security' | 'codegraph_query' | 'opsx_explore' | 'opsx_propose' | 'opsx_apply' | 'opsx_archive' | 'ensure_deps' | 'iceberg-sweep' | 'iceberg-review';",
    ].join('\n');
    const violations = checkRunLogAction(JSON.stringify(schema27), synced);
    expect(violations.some((v) => v.message.includes('漂移'))).toBe(false);
  });
});
```

注意：若 `checkRunLogAction` 当前不是导出函数或签名不是 `(schemaJson: string, dataModels: string)`，先读 `docs-consistency-logic.ts` 中该函数的真实签名与调用方式，按真实签名调整测试的调用方式（可经现有顶层 `runDocChecks`/同等入口构造输入），但断言语义不变：**缺值/多值必须产生含「漂移」的 violation**。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run --config config/vitest.config.ts __tests__/docs-consistency-logic.test.ts
```

期望：新用例 FAIL（当前实现只查「action 枚举（27 类）」文本，不比对 interface）。

- [ ] **Step 3: 修复 data-models.md:391**

将该行：

```typescript
  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'escalate';
```

替换为（与 `schemas/run-log.schema.json` enum 逐值一致、同序）：

```typescript
  action: 'chunk' | 'cross' | 'evolve' | 'produce' | 'review' | 'gate' | 'tla-gate' | 'graph-gate' | 'test' | 'checkpoint' | 'rework' | 'rollback' | 'rootcause' | 'fix' | 'emergency-fix' | 'escalate' | 'r3-completeness' | 'r3-reliability' | 'r3-security' | 'codegraph_query' | 'opsx_explore' | 'opsx_propose' | 'opsx_apply' | 'opsx_archive' | 'ensure_deps' | 'iceberg-sweep' | 'iceberg-review';
```

- [ ] **Step 4: 修复 data-models.md:558 对照表「动作」行**

将：

```markdown
| 动作 | `action`（chunk/cross/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback/rootcause/fix/escalate） | `eventType`（bug-report/requirement-change/...） | 不同枚举集，不可混用 |
```

替换为：

```markdown
| 动作 | `action`（27 值枚举，与 run-log.schema.json 完全一致：chunk/cross/evolve/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback/rootcause/fix/emergency-fix/escalate/r3-completeness/r3-reliability/r3-security/codegraph_query/opsx_explore/opsx_propose/opsx_apply/opsx_archive/ensure_deps/iceberg-sweep/iceberg-review） | `eventType`（bug-report/requirement-change/...） | 不同枚举集，不可混用 |
```

- [ ] **Step 5: 强化 docs-consistency-logic.ts 的 checkRunLogAction**

在现有检查（enum 长度 + 文本「action 枚举（27 类）」存在性）之后追加语义比对（变量名按现场实际调整，`schemaParsed` 为已 `JSON.parse` 的 schema 对象，`dataModels` 为 data-models.md 全文）：

```typescript
// 语义级同步：data-models.md RunLogEntry interface 的 action 联合类型须与 schema enum 完全一致
// （审计修复 P2：此前仅查计数文本，interface 漂移 12 值未被捕获）
const actionEnum: unknown = (schemaParsed as { properties?: { action?: { enum?: unknown[] } } })
  ?.properties?.action?.enum;
if (Array.isArray(actionEnum) && actionEnum.every((v) => typeof v === 'string')) {
  const unionMatch = dataModels.match(/action:\s*'[^']+'(\s*\|\s*'[^']+')*;/);
  if (unionMatch) {
    const unionVals = Array.from(unionMatch[0].matchAll(/'([^']+)'/g), (m) => m[1] as string);
    const missing = (actionEnum as string[]).filter((v) => !unionVals.includes(v));
    const extra = unionVals.filter((v) => !(actionEnum as string[]).includes(v));
    if (missing.length > 0 || extra.length > 0) {
      violations.push({
        check: 'run-log-action',
        message: `data-models.md RunLogEntry.action 联合类型与 run-log.schema.json enum 漂移（缺 ${missing.join(',')}；多 ${extra.join(',')}）`,
      });
    }
  } else {
    violations.push({
      check: 'run-log-action',
      message: 'data-models.md 未找到 RunLogEntry.action 联合类型声明（应为 action: ... | ... ; 形式）',
    });
  }
}
```

- [ ] **Step 6: 运行测试与自检**

```bash
npx vitest run --config config/vitest.config.ts __tests__/docs-consistency-logic.test.ts   # 期望全绿
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts                                  # 期望 passed:true（data-models.md 已同步）
npm run self-test                                                                          # 期望 256/256
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/references/data-models.md w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "fix: 同步 run-log action 枚举至 27 值并强化 docs-consistency 语义比对（P2）"
```

---

### Task 2: wm-write 原子写修复（tmpPath 唯一化 + 回读失败回滚）

**Files:**
- Modify: `w-model-dev/scripts/logic/state-write-logic.ts`
- Test: `w-model-dev/scripts/__tests__/state-write-logic.test.ts`

- [ ] **Step 1: 写失败测试**

在 `__tests__/state-write-logic.test.ts` 追加（沿用该文件现有的临时目录构造方式；若其用 `fs.mkdtemp` 则一致使用）：

```typescript
describe('审计修复 P4：tmpPath 唯一化与回读失败回滚', () => {
  it('同进程并发两次写同一目标：均成功且无异常，终态为二者之一', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-conc-'));
    const target = path.join(dir, 'state.json');
    await fs.writeFile(target, '{"v":0}', 'utf-8');
    const [a, b] = await Promise.all([
      writeStateJson(target, '{"v":1}'),
      writeStateJson(target, '{"v":2}'),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true); // 修复前：第二次 rename 抛 ENOENT
    const final = JSON.parse(await fs.readFile(target, 'utf-8')) as { v: number };
    expect([1, 2]).toContain(final.v);
    // 不残留 tmp 文件
    const leftovers = (await fs.readdir(dir)).filter((f) => f.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('回读校验失败时自动回滚备份并报告 rolledBack', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-rollback-'));
    const target = path.join(dir, 'state.json');
    await fs.writeFile(target, '{"v":"original"}', 'utf-8');
    const result = await writeStateJson(target, '{"v":"new"}', {
      readbackImpl: async () => '{"v":"corrupted"}', // 模拟回读不一致
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('WRITE_VERIFY_FAILED');
    expect(result.rolledBack).toBe(true);
    expect(await fs.readFile(target, 'utf-8')).toBe('{"v":"original"}'); // 已恢复
  });

  it('回读失败且无备份（目标原不存在）时删除损坏文件', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-nobak-'));
    const target = path.join(dir, 'state.json');
    const result = await writeStateJson(target, '{"v":"new"}', {
      readbackImpl: async () => 'garbage',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('WRITE_VERIFY_FAILED');
    await expect(fs.readFile(target, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run --config config/vitest.config.ts __tests__/state-write-logic.test.ts
```

期望：新用例 FAIL（`readbackImpl` 选项不存在 / 并发用例抛 ENOENT）。

- [ ] **Step 3: 实现修复**

`w-model-dev/scripts/logic/state-write-logic.ts`：

3a. 头部 import 增加：

```typescript
import { randomUUID } from 'node:crypto';
```

3b. `StateWriteOptions` 增加测试注入缝：

```typescript
export interface StateWriteOptions {
  /** 写前备份现有目标（默认 true） */
  backup?: boolean;
  /** 保留的备份份数，超出按时间戳从旧到新删除（默认 5） */
  keepBackups?: number;
  /** 乐观锁：期望的目标当前 mtimeMs；null/undefined 表示不校验（默认 null） */
  expectMtimeMs?: number | null;
  /** 测试注入：覆盖回读实现（默认 fs.readFile）。仅测试使用，生产不得传。 */
  readbackImpl?: (absPath: string) => Promise<string>;
}
```

3c. `StateWriteResult` 增加 `rolledBack`：

```typescript
export interface StateWriteResult {
  ok: boolean;
  /** 目标绝对路径（失败时也返回，便于错误消息定位） */
  writtenPath: string;
  /** 实际生成的备份路径（仅 ok=true 且发生备份时存在） */
  backupPath?: string;
  /** 失败原因：INVALID_JSON / MTIME_CONFLICT / TARGET_MISSING_FOR_MTIME / WRITE_VERIFY_FAILED */
  reason?: string;
  /** 回读校验失败后是否已自动恢复备份（WRITE_VERIFY_FAILED 时有意义） */
  rolledBack?: boolean;
}
```

3d. 第 4 步 tmpPath 改为真唯一（替换 124-127 行区域）：

```typescript
  // 4. 原子替换：tmp-<pid>-<uuid> 全局唯一命名，避免同进程并发写互踩（审计修复 P4：
  //    此前仅用 pid，同进程并发会复用同一 tmp 路径导致互踩 + rename ENOENT）
  const tmpPath = `${absPath}.tmp-${process.pid}-${randomUUID()}`;
  await fs.writeFile(tmpPath, jsonText, 'utf-8');
  await fs.rename(tmpPath, absPath);
```

3e. 第 5 步回读校验改为「失败即回滚」（替换 129-133 行区域）：

```typescript
  // 5. 回读校验：不一致 → 自动回滚（审计修复 P4：此前不回滚，目标停留在损坏内容）
  const readBack = await (opts.readbackImpl ?? ((p: string) => fs.readFile(p, 'utf-8')))(absPath);
  if (readBack !== jsonText) {
    let rolledBack = false;
    if (backupPath !== undefined) {
      try {
        await fs.copyFile(backupPath, absPath); // copy 而非 rename，保留备份供取证
        rolledBack = true;
      } catch {
        rolledBack = false; // 回滚失败（备份亦不可读），保持损坏现状并如实报告
      }
    } else {
      // 写前目标不存在（无备份）：删除损坏文件即恢复原状
      try {
        await fs.unlink(absPath);
        rolledBack = true;
      } catch {
        rolledBack = false;
      }
    }
    return { ok: false, writtenPath: absPath, reason: 'WRITE_VERIFY_FAILED', rolledBack };
  }
```

3f. 同步更新文件头注释（第 7-9 行流程描述）：`回读校验（不符→WRITE_VERIFY_FAILED）` → `回读校验（不符→WRITE_VERIFY_FAILED，自动回滚备份或删除新写文件）`。

- [ ] **Step 4: 运行测试与自检**

```bash
npx vitest run --config config/vitest.config.ts __tests__/state-write-logic.test.ts   # 期望全绿
npm run self-test                                                                      # 期望 256/256
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/logic/state-write-logic.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
git commit -m "fix: wm-write tmpPath 唯一化 + 回读失败自动回滚备份（P4）"
```

---

### Task 3: TLA+ 门禁超时 + 执行常量集中 + Java 版本单一事实源

**Files:**
- Modify: `w-model-dev/scripts/lib/constants.ts`
- Create: `w-model-dev/scripts/lib/java-version.ts`
- Modify: `w-model-dev/scripts/cli/check-tla-model.ts`
- Modify: `w-model-dev/scripts/logic/doctor-logic.ts`（若含本地 parseJavaMajor）
- Test: `w-model-dev/scripts/__tests__/java-version.test.ts`（新建）

- [ ] **Step 1: constants.ts 增加执行限额**

在 `MAX_GRAPH_ROUNDS` 之后追加：

```typescript
/**
 * 子进程执行限额（审计修复 P3/P15：SANY/TLC 无超时可致门禁永久挂死；限额集中单点定义）。
 * SANY 语法检查快速失败 60s；TLC 状态爆炸时 300s 防挂死（对齐 ensure-codegraph-opsx.ts 上限）。
 */
export const EXEC_LIMITS = {
  sanyTimeoutMs: 60_000,
  tlcTimeoutMs: 300_000,
  shortTimeoutMs: 15_000,
  maxBufferSmall: 16 * 1024 * 1024,
  maxBufferLarge: 64 * 1024 * 1024,
} as const;
```

- [ ] **Step 2: 新建 lib/java-version.ts（单一事实源）**

```typescript
/**
 * Java 主版本解析（lib/java-version.ts）
 *
 * 审计修复 P15：此前 check-tla-model.ts（CLI 层）与 doctor-logic.ts 各有一份解析实现，
 * 统一抽到 lib 单点维护。
 */

/**
 * 由 `java -version` 的输出（stdout+stderr 拼接）解析 Java 主版本号。
 * 兼容 Java 8（"1.8.0_xxx" → 8）与 Java 11+（"11.0.x" → 11）。
 */
export function parseJavaMajor(versionOutput: string): number | null {
  const m = versionOutput.match(/version\s+"([0-9._]+)"/i);
  if (!m || m[1] === undefined) return null;
  const parts = m[1].split(/[._]/);
  const firstStr = parts[0];
  if (firstStr === undefined) return null;
  const first = Number.parseInt(firstStr, 10);
  if (Number.isNaN(first)) return null;
  if (first === 1 && parts.length > 1) {
    const secondStr = parts[1];
    if (secondStr === undefined) return null;
    const second = Number.parseInt(secondStr, 10);
    return Number.isNaN(second) ? null : second;
  }
  return first;
}
```

- [ ] **Step 3: 新建测试 `__tests__/java-version.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { parseJavaMajor } from '../lib/java-version.js';

describe('parseJavaMajor（lib/java-version.ts 单一事实源）', () => {
  it('解析 Java 8 旧式版本号', () => {
    expect(parseJavaMajor('openjdk version "1.8.0_392"')).toBe(8);
  });
  it('解析 Java 11+ 新式版本号', () => {
    expect(parseJavaMajor('openjdk version "11.0.21" 2023-10-17')).toBe(11);
    expect(parseJavaMajor('openjdk version "17.0.9"')).toBe(17);
    expect(parseJavaMajor('openjdk version "21" 2023-09-19')).toBe(21);
  });
  it('无法解析时返回 null', () => {
    expect(parseJavaMajor('')).toBeNull();
    expect(parseJavaMajor('java version "abc"')).toBeNull();
  });
});
```

- [ ] **Step 4: check-tla-model.ts 接入超时与单源 Java 解析**

4a. import 区：删除本地 `parseJavaMajorVersion` 函数（103-118 行），改为：

```typescript
import { EXEC_LIMITS } from '../lib/constants.js';
import { parseJavaMajor } from '../lib/java-version.js';
```

（文件内原 `parseJavaMajorVersion(out)` 调用点改为 `parseJavaMajor(out)`。）

4b. `ToolRunResult` 接口（181-190 行）增加两个字段：

```typescript
interface ToolRunResult {
  syntaxOk: boolean;
  syntaxOutput: string;
  sanyTimedOut: boolean;   // 审计修复 P3：SANY 超时标记
  tlcRan: boolean;
  tlcOutput: string;
  tlcTimedOut: boolean;    // 审计修复 P3：TLC 超时标记
  deadlock: boolean;
  invariantViolated: boolean;
  stateExplosion: boolean;
  tlcNoError: boolean;
}
```

初始化对象（200-209 行）同步补 `sanyTimedOut: false, tlcTimedOut: false,`。

4c. SANY 调用（213-228 行）加 timeout 并识别超时：

```typescript
  try {
    const stdout = execFileSync('java', ['-cp', jarAbs, 'tla2sany.SANY', tlaAbs], {
      encoding: 'utf-8',
      cwd: tlaDir,
      maxBuffer: EXEC_LIMITS.maxBufferSmall,
      timeout: EXEC_LIMITS.sanyTimeoutMs, // 审计修复 P3：防 JVM 挂死
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    out.syntaxOk = true;
    out.syntaxOutput = stdout;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    out.syntaxOk = false;
    out.sanyTimedOut = e.killed === true;
    out.syntaxOutput = out.sanyTimedOut
      ? `SANY 执行超时（>${EXEC_LIMITS.sanyTimeoutMs / 1000}s），已终止。排查：模块规模过大或 JVM 异常`
      : `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim() || (e.message ?? 'SANY 执行失败');
    return out; // 语法未通过 → 不跑 TLC（反模式 #14 守护）
  }
```

4d. TLC 调用（235-251 行）同样处理：

```typescript
  try {
    const stdout = execFileSync(
      'java',
      ['-cp', jarAbs, 'tlc2.TLC', '-nowarning', '-cleanup', '-config', cfgAbs, moduleName],
      {
        encoding: 'utf-8',
        cwd: tlaDir,
        maxBuffer: EXEC_LIMITS.maxBufferLarge,
        timeout: EXEC_LIMITS.tlcTimeoutMs, // 审计修复 P3：TLC 状态爆炸防门禁挂死
        killSignal: 'SIGKILL',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    out.tlcOutput = stdout;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean };
    out.tlcTimedOut = e.killed === true;
    if (out.tlcTimedOut) {
      out.tlcOutput = `${e.stdout ?? ''}\n${e.stderr ?? ''}\nTLC 执行超时（>${EXEC_LIMITS.tlcTimeoutMs / 1000}s），已终止。排查：缩小状态空间 / 调整 .cfg 约束（references/tla-plus-tlc-configuration.md）`;
    } else {
      out.tlcOutput = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    }
  }
```

4e. 主流程消费超时标记（`runTools` 返回后，约 427-432 行 `run.syntaxOk` 判断附近）：

```typescript
      if (run.tlcTimedOut) {
        headerViolations.push(
          `规格 ${spec.id} TLC 模型检查超时（>${EXEC_LIMITS.tlcTimeoutMs / 1000}s）：需缩小状态空间或调整 TLC 配置后重跑`,
        );
      }
```

4f. Java 预检（290-308 行）去掉硬编码 11，只检「java 存在且可解析」（版本阈值唯一事实源 = manifest.tools.javaMinVersion，由 checkEnvironment 执行）：

```typescript
  {
    const res = spawnSync('java', ['-version'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: EXEC_LIMITS.shortTimeoutMs });
    const out = `${res.stderr ?? ''}${res.stdout ?? ''}`;
    const major = res.error ? null : parseJavaMajor(out);
    if (res.error || major === null) {
      exitWithError({
        category: 'UNEXPECTED',
        rule: 'P0-2',
        message: 'Java 环境缺失：未找到可用的 java 可执行文件（TLA+ 门禁需要 Java，最低版本以 manifest.tools.javaMinVersion 声明为准）',
        detail:
          '修法：安装 JDK/JRE 并确保 java 在 PATH 后重试；可先运行 npx tsx w-model-dev/scripts/cli/doctor.ts --with-tla 自检（详见 references/tla-plus-guide.md「环境准备」）',
        exitCode: 2,
      });
      return;
    }
  }
```

- [ ] **Step 5: doctor-logic.ts 切换到 lib 单源**

在 `logic/doctor-logic.ts` 中 grep `parseJavaMajor`：删除本地实现，改为 `import { parseJavaMajor } from '../lib/java-version.js';`；若 `__tests__` 中有直接从 doctor-logic 导入该函数的用例，同步改导入路径。（若 doctor-logic 实现与 lib 版本有行为差异，以 doctor-logic 现行为准合并进 lib 并让两侧测试都过。）

- [ ] **Step 6: 运行验证**

```bash
npx vitest run --config config/vitest.config.ts __tests__/java-version.test.ts __tests__/doctor-logic.test.ts __tests__/tla-logic.test.ts   # 期望全绿
npm run self-test    # 期望 256/256
npx tsx w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/samples/tla/valid.json --phase=1   # 环境 有 java 时期望 exit 0；无 java 时期望 exit 2 且 ERROR_JSON 完整
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/lib/constants.ts w-model-dev/scripts/lib/java-version.ts w-model-dev/scripts/cli/check-tla-model.ts w-model-dev/scripts/logic/doctor-logic.ts w-model-dev/scripts/__tests__/java-version.test.ts
git commit -m "fix: SANY/TLC 执行超时 + Java 版本解析单源化（P3/P15）"
```

---

### Task 4: 错误出口统一（HandledCliError + runMain + readJsonOrExit 哨兵化）

> 背景：`cli-error.ts:53` 注释明确「避免 process.exit() 截断 ERROR_JSON」，但 `readJsonOrExit/readJsonlOrExit` 在 `exitWithError` 后立即 `process.exit(2)`（P10）；`readJsonClassified` 抛普通 Error 会被各脚本 `main().catch` 二次捕获，重复输出 UNEXPECTED ERROR_JSON（潜在双打印）。本任务统一为：`exitWithError` 设退出码 → 抛 `HandledCliError` → `runMain` 识别并静默退出。

**Files:**
- Modify: `w-model-dev/scripts/lib/cli-error.ts`
- Create: `w-model-dev/scripts/lib/run-main.ts`
- Modify: `w-model-dev/scripts/lib/read-json-or-exit.ts`
- Modify: 全部 `w-model-dev/scripts/cli/*.ts`（catch 迁移，机械替换）
- Test: `w-model-dev/scripts/__tests__/run-main.test.ts`（新建）、`__tests__/read-json-or-exit.test.ts`、`__tests__/cli-error.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `__tests__/run-main.test.ts`：

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { HandledCliError, exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';

// runMain 返回 void（内部 main().catch），用一次宏任务 tick 等 catch 链完成
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runMain（审计修复 P10：错误出口统一）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('main 正常完成时不做任何事', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runMain(async () => undefined);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('main 抛 HandledCliError 时不重复输出（exitWithError 已处理）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runMain(async () => {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2 });
      throw new HandledCliError();
    });
    await flush();
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledTimes(1); // 仅 exitWithError 的一次
    expect(logSpy).toHaveBeenCalledTimes(1); // 仅一条 ERROR_JSON
  });

  it('main 抛普通异常时输出 UNEXPECTED + exitCode 2', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runMain(async () => {
      throw new Error('boom');
    });
    await flush();
    expect(process.exitCode).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"UNEXPECTED"'));
  });
});
```

在 `__tests__/read-json-or-exit.test.ts` 追加：

```typescript
it('readJsonOrExit 文件不存在：抛 HandledCliError 且 exitCode=2，不再 process.exit（P10）', async () => {
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  await expect(readJsonOrExit(path.join(os.tmpdir(), `nonexistent-${Date.now()}.json`)))
    .rejects.toBeInstanceOf(HandledCliError);
  expect(process.exitCode).toBe(2);
  expect(logSpy).toHaveBeenCalledTimes(1); // 仅一条 ERROR_JSON，无双打印
  errSpy.mockRestore(); logSpy.mockRestore(); process.exitCode = undefined;
});
```

（按该测试文件现有 import 风格补 `HandledCliError` 导入。）

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run --config config/vitest.config.ts __tests__/run-main.test.ts __tests__/read-json-or-exit.test.ts
```

期望：FAIL（run-main 模块不存在 / readJsonOrExit 走 process.exit）。

- [ ] **Step 3: 实现**

3a. `lib/cli-error.ts` 末尾追加：

```typescript
/**
 * 哨兵异常：exitWithError 已完成输出并设置退出码后抛出，用于中断调用链；
 * runMain（lib/run-main.ts）识别后静默退出，防止 main().catch 二次输出 UNEXPECTED（审计修复 P10）。
 */
export class HandledCliError extends Error {
  constructor() {
    super('已通过 exitWithError 输出错误并设置退出码');
    this.name = 'HandledCliError';
  }
}
```

3b. 新建 `lib/run-main.ts`：

```typescript
/**
 * CLI main 统一入口（lib/run-main.ts）
 *
 * 消除各 cli/*.ts 结尾重复的 main().catch(UNEXPECTED) 样板（审计修复 P9/P10）。
 * HandledCliError = exitWithError 已处理（输出 + exitCode 已设），静默返回交给 Node 自然退出。
 */

import { exitWithError, HandledCliError } from './cli-error.js';

export function runMain(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    if (err instanceof HandledCliError) return;
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
```

3c. `lib/read-json-or-exit.ts`：`readJsonOrExit` 与 `readJsonlOrExit` 的两处 `exitWithError({...}); process.exit(2);` 改为 `exitWithError({...}); throw new HandledCliError();`（需 import `HandledCliError`）；`readJsonClassified` 的两处 `throw new Error('readJsonClassified: 输入错误已通过 exitWithError 处理');` 改为 `throw new HandledCliError();`。同步更新文件头注释中的「process.exit(2)」描述为「抛 HandledCliError」。

- [ ] **Step 4: 全仓 CLI catch 迁移（机械替换）**

对 `w-model-dev/scripts/cli/` 下**所有** `.ts` 文件（`plan-chunks.ts` 在 Task 6 处理，跳过）：

把结尾形如

```typescript
main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
```

或 `main().catch((err) => { exitWithError({ category: 'UNEXPECTED', ... }); });` 的段落，统一替换为：

```typescript
runMain(main);
```

并在 import 区加 `import { runMain } from '../lib/run-main.js';`。若某文件 catch 段有额外逻辑（如 `process.exit(output.exitCode)` 在 main 内部而非 catch 内），保留 main 内部逻辑，仅替换 catch 段。用以下命令核对替换完整性：

```bash
# 期望输出为空（所有 catch 样板已迁移；check-tla-model.ts 等在 main 内的 exitWithError 不受影响）
grep -rn "category: 'UNEXPECTED'" w-model-dev/scripts/cli/ | grep -v "run-main"
```

（`lib/run-main.ts` 自身一处除外——上面命令已通过 `grep -v run-main` 排除路径含 run-main 的行；若仍有残留按文件逐个迁移。）

- [ ] **Step 5: 运行验证**

```bash
npx vitest run --config config/vitest.config.ts __tests__/run-main.test.ts __tests__/read-json-or-exit.test.ts __tests__/cli-error.test.ts   # 全绿
npm run self-test    # 256/256
# 抽查一个 CLI 错误路径（stdout 恰好一条 ERROR_JSON，退出码 2）：
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts /tmp/not-exist.json; echo "exit=$?"
# 期望：stderr 一行 ✗ [FILE_NOT_FOUND]，stdout 恰好一行 ERROR_JSON，exit=2
```

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/lib/cli-error.ts w-model-dev/scripts/lib/run-main.ts w-model-dev/scripts/lib/read-json-or-exit.ts w-model-dev/scripts/cli/ w-model-dev/scripts/__tests__/run-main.test.ts w-model-dev/scripts/__tests__/read-json-or-exit.test.ts
git commit -m "refactor: 错误出口统一 HandledCliError + runMain，消除 ERROR_JSON 截断/双打印风险（P9/P10）"
```

---

### Task 5: schema-loader 分层修复（去 process.exit / IO 下沉）

**Files:**
- Modify: `w-model-dev/scripts/logic/schema-loader.ts`
- Create: `w-model-dev/scripts/lib/schema-fs.ts`
- Modify: `w-model-dev/scripts/logic/gate-logic.ts`、`w-model-dev/scripts/lib/load-and-validate.ts`（调用点适配）
- Test: `w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **Step 1: 现场确认调用面**

通读 `logic/schema-loader.ts`（约 70 行）与 grep 其导出的使用点：

```bash
grep -rn "schema-loader" w-model-dev/scripts/ --include="*.ts" | grep -v __tests__
```

记录每个导出函数（如 `loadAjvDepsOrExit` / `loadSchemas` / `createValidator` 等，以现场为准）的调用方与用法。

- [ ] **Step 2: 写失败测试**

在 `__tests__/schema-validation.test.ts` 追加（断言 logic 层不再含 fs/exit，且新 lib 函数可读目录）：

```typescript
it('schema-loader 不再直接依赖 node:fs / process.exit（审计修复 P5）', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../logic/schema-loader.ts'),
    'utf-8',
  );
  expect(src).not.toMatch(/from 'node:fs'/);
  expect(src).not.toMatch(/process\.exit/);
  expect(src).not.toMatch(/ERROR_JSON/); // 手拼 ERROR_JSON 绕过 cli-error 的行为已移除
});

it('lib/schema-fs.ts 能读取 schemas 目录并返回 basename→schema 映射', async () => {
  const dir = path.resolve(__dirname, '../../schemas');
  const map = await readSchemasDir(dir);
  expect(Object.keys(map).length).toBe(20);
  expect(map['rtm.schema.json']).toBeDefined();
});
```

（`__dirname` 在 vitest ESM 下不可用，改用 `new URL('../logic/schema-loader.ts', import.meta.url)` 风格，与该文件现有用例保持一致。）

- [ ] **Step 3: 重构**

3a. 新建 `lib/schema-fs.ts`（IO 部分，唯一 fs 依赖点）：

```typescript
/**
 * Schema 文件系统读取（lib/schema-fs.ts）
 *
 * 审计修复 P5：schema 文件的磁盘 IO 从 logic/schema-loader.ts 下沉到 lib 层，
 * logic 层恢复纯函数（不做 fs / 不 process.exit）。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** 读取目录下全部 .json schema 文件，返回 { basename: parsedSchema }；目录不可读抛原始错误 */
export async function readSchemasDir(dir: string): Promise<Record<string, unknown>> {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const map: Record<string, unknown> = {};
  for (const f of files) {
    map[f] = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'));
  }
  return map;
}
```

3b. `logic/schema-loader.ts` 改造（保留原导出函数名不变以最小化调用方改动）：
- 删除 `import { readFileSync, readdirSync, existsSync } from 'node:fs'`
- 「按目录读 schema」的导出函数改为接收 `schemas: Record<string, unknown>`（由调用方先调 `readSchemasDir`）；若该函数原本被多个调用方以目录路径调用，则把它拆为 lib 侧薄封装（`lib/schema-fs.ts` 再加一个组合函数）并更新调用方 import
- `loadAjvDepsOrExit` 更名语义化为 `loadAjvDeps`（或保留原名但改行为）：ajv 缺失时不再 `console.error + ERROR_JSON + process.exit(2)`，改为 `throw new Error('缺少 devDependencies ajv/ajv-formats：请在仓库根 npm install 后重试')`；CLI 边界（runMain）统一转为 UNEXPECTED ERROR_JSON
- 手拼的 `ERROR_JSON {...}` 字符串输出全部删除
- 文件头注释补一行：`// IO 经 lib/schema-fs.ts；错误经抛异常上抛，由 CLI 层 runMain 统一格式化`

3c. 调用点适配：`gate-logic.ts`、`lib/load-and-validate.ts` 及 Step 1 grep 到的其余调用方——目录读取改走 `readSchemasDir`，`loadAjvDepsOrExit` 改为 try/catch `loadAjvDeps`（或直接透传异常给 CLI 边界）。`gate-logic.ts` 保持 `__tests__/README.md` 中已有的例外豁免不变。

- [ ] **Step 4: 运行验证**

```bash
npx vitest run --config config/vitest.config.ts __tests__/schema-validation.test.ts   # 全绿
npm run self-test    # 256/256（self-test 覆盖 gate-logic 的 schema 校验路径）
# 纯度 grep（应无输出，gate-logic.ts 例外除外）：
grep -nE "from 'node:fs'|process\.(exit|argv|env|stdout|stderr)" w-model-dev/scripts/logic/*-logic.ts w-model-dev/scripts/logic/schema-loader.ts | grep -v '^.*gate-logic\.ts'
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/lib/schema-fs.ts w-model-dev/scripts/logic/schema-loader.ts w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/lib/load-and-validate.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
git commit -m "refactor: schema-loader 去 exit/IO 下沉 lib，恢复 logic 层纯度（P5）"
```

---

### Task 6: plan-chunks 拆分（logic 纯化 + cli 入口）+ 脚本计数口径统一

**Files:**
- Create: `w-model-dev/scripts/logic/plan-chunks-logic.ts`（纯函数，自原文件迁入）
- Create: `w-model-dev/scripts/cli/plan-chunks.ts`（CLI 入口，自原文件迁入）
- Delete: `w-model-dev/scripts/logic/plan-chunks.ts`
- Modify: `w-model-dev/scripts/__tests__/plan-chunks.test.ts`
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`（计数口径与路径）
- Modify: `w-model-dev/scripts/cli/check-docs-consistency.ts`（注释口径）
- Modify: `w-model-dev/scripts/lib/parse-phase.ts`（注释）
- Modify: `w-model-dev/SKILL.md:165`（Bundled Resources 计数）
- Modify: `w-model-dev/references/toolbox.md:25`、`w-model-dev/references/ingestion-chunk.md`（grep `plan-chunks` 全量核对）
- Modify: `docs/INSTALL.md:80`（过期计数 31 → 33 修正）
- Modify: `docs/ingestion-graph-convergence-design.md:389`（路径）

- [ ] **Step 1: 确认纯/IO 分界**

通读 `logic/plan-chunks.ts`（293 行）。分界原则：`estimateTokens` / `splitMarkdownSections` / `splitByLines` 以及「给定内容产块」的核心规划逻辑 → logic；`process.argv` 解析、`fs.stat`/`fs.readFile`/目录遍历、`exitWithError`、`console.log`、`process.exit` → cli。若现有 `planFile(path, ...)` 内部混含「读文件 + 规划」，拆为 cli 侧 `readFileContent` + logic 侧 `planChunksFromContent(content: string, maxTokens: number, label: string): Chunk[]`。

- [ ] **Step 2: 迁移**

2a. 新建 `logic/plan-chunks-logic.ts`：文件头注释说明「分块规划纯逻辑（自 plan-chunks.ts 拆分，审计修复 P5）」；包含 `Chunk` / `PlanOutput` 接口与全部纯函数；**零 import node:fs、零 process/console**。`Chunk`/`PlanOutput` 从本文件 export。

2b. 新建 `cli/plan-chunks.ts`：保留原文件头（shebang `#!/usr/bin/env tsx` + 用法说明，用法行改为 `npx tsx w-model-dev/scripts/cli/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]`）；迁入 main 与全部 IO/参数/输出逻辑；结尾用 `runMain(main)`（Task 4 已建）；`process.exit(0)` 改为 `process.exitCode = 0` 后自然返回（对齐 P10 原则）。

2c. 删除 `logic/plan-chunks.ts`。

2d. `__tests__/plan-chunks.test.ts`：import 路径改 `../logic/plan-chunks-logic.js`；原经 `planFile`（传路径）的用例改为「临时目录写文件 → 读出内容 → `planChunksFromContent(content, ...)`」或直接对内容字符串断言，保持断言语义不变。

- [ ] **Step 3: 计数口径统一（33 = cli/ 下 26 check + 7 工具，self-test 除外）**

3a. `docs-consistency-logic.ts`：
- 第 22 行注释改为：`/** 实测可 exit 2 的 CLI 脚本数（26 个 check-*.ts + 7 个工具 CLI（含 cli/plan-chunks.ts）= 33，全数位于 cli/；self-test.ts 非 exit-2 不计入） */`
- 定位实际枚举 exit-2 脚本清单的代码（grep `plan-chunks`），把 `logic/plan-chunks.ts` 路径项改为 `cli/plan-chunks.ts`（清单总数不变仍 33）

3b. `check-docs-consistency.ts:289` 注释同步为与 3a 相同口径。

3c. `lib/parse-phase.ts:4` 注释：`12 个 cli/*.ts 脚本 + logic/plan-chunks.ts（非 cli/ 独立入口）共 13 个调用方` → `13 个 cli/*.ts 脚本（含 cli/plan-chunks.ts）的 --phase 解析/校验统一由本模块实现`。

3d. `SKILL.md:165` Bundled Resources 行：

旧：``scripts/cli/`（33 个 .ts：26 个 check-* 门禁 + 7 个工具 CLI）``
新：``scripts/cli/`（34 个 .ts：26 个 check-* 门禁 + 8 个工具 CLI；其中 33 个为 exit-2 脚本，self-test.ts 为回归基线非 exit-2）``

3e. `docs/INSTALL.md:80`：`exit-2 脚本口径 = 26 check + 4 工具 + logic/plan-chunks.ts = 31` → `exit-2 脚本口径 = 26 check + 7 工具 CLI（security-scan / wm-status / metrics-report / ensure-codegraph-opsx / wm-write / doctor / plan-chunks）= 33，self-test 非 exit-2`；目录树注释中 `plan-chunks` 若列于 logic/ 移到 cli/ 行。

3f. `w-model-dev/references/toolbox.md:25`：`npx tsx w-model-dev/scripts/logic/plan-chunks.ts` → `npx tsx w-model-dev/scripts/cli/plan-chunks.ts`。

3g. `docs/ingestion-graph-convergence-design.md:389`：`scripts/logic/plan-chunks.ts` → `scripts/cli/plan-chunks.ts`。

3h. 全量兜底核对（期望仅剩历史归档/决策日志命中，属历史记录不改）：

```bash
grep -rn "logic/plan-chunks" /workspace --include="*.md" --include="*.ts" | grep -v "changes/" | grep -v "superpowers/"
```

- [ ] **Step 4: 运行验证**

```bash
npx vitest run --config config/vitest.config.ts __tests__/plan-chunks.test.ts   # 全绿
npx tsx w-model-dev/scripts/cli/plan-chunks.ts w-model-dev/references/phase-1-requirements.md --phase=1 --node-type=REQ   # 期望 stdout JSON 分块计划，exit 0
npx tsx w-model-dev/scripts/cli/plan-chunks.ts /tmp/not-exist --phase=1 --node-type=REQ; echo exit=$?   # 期望 exit 2 + ERROR_JSON
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # passed:true（33 口径一致）
npm run self-test   # 256/256
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/logic/plan-chunks-logic.ts w-model-dev/scripts/cli/plan-chunks.ts w-model-dev/scripts/__tests__/plan-chunks.test.ts w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/lib/parse-phase.ts w-model-dev/SKILL.md w-model-dev/references/toolbox.md w-model-dev/references/ingestion-chunk.md docs/INSTALL.md docs/ingestion-graph-convergence-design.md
git rm w-model-dev/scripts/logic/plan-chunks.ts
git commit -m "refactor: plan-chunks 拆分 logic/cli 并统一 exit-2 脚本计数口径（P5/P7）"
```

---

### Task 7: 反模式 #48 新增 + #18/#19 详细节 + SKILL.md #22 引用修正 + 计数 47→48

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`（清单表 + 检测信号表 + 3 个新详细节 + `#1~#47` → `#1~#48`）
- Modify: `w-model-dev/SKILL.md:82-86`（5 处 #22 → #48）
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts:89`（maxAntiPattern 47→48）
- Modify: `w-model-dev/references/dispatch-matrix.md`（§7 映射表 + 计数）
- Modify: `README.md`、`AGENTS.md`（47 条 → 48 条；AGENTS §8 增补 plan-chunks 行已在 Task 6 处理，此处仅计数文案）

- [ ] **Step 1: anti-patterns.md 清单表追加 #48（127 行 #47 行之后）**

```markdown
| 48 | 子代理越界实施（S/V/G/A/R 执行角色边界外动作：S 跑门禁或改 status、G 改产物或产出评审 JSON、V 跑门禁或改产物、A 写正式阶段产物或改 status、R 实施修复或跑门禁或跨阶段定位） | 评审/门禁独立性失效，产物来源不可信（signature-chain 断链），CHECKPOINT 证据被污染 | 回到当前阶段起点，越权产物作废重做；`check-run-log.ts` R5 校验 role-action 配对，`check-signature-chain.ts` 校验消费链；与 #10（编排者越权实施）成对；**勿与 #22（目标系统 RBAC 角色越权）混淆** |
```

- [ ] **Step 2: 更新区间文本与门禁阈值**

- anti-patterns.md 内所有 `#1~#47` 字样 → `#1~#48`（docs-consistency 校验 `#1~#${EXPECTED.maxAntiPattern}` 存在）
- `docs-consistency-logic.ts:89`：`maxAntiPattern: 47,` → `maxAntiPattern: 48,`

- [ ] **Step 3: 追加 3 个详细节（放在最后一个 `## #N` 详细节之后）**

```markdown
## #18 跳过根因定位直接返工（V/G 不通过 → 未经 R 直接分派 S 返工）

**检测信号**：run-log 中 V/G `outcome=fail/rework` 之后紧接 `action=rework` 且无 `action=rootcause` 记录；reworkHints 未出现在任何 RootCauseReport 的输入引用中。

**回退动作**：撤销该轮 S 返工产物，回到 V/G 不通过现场，按顺序补走 R（产出 RootCauseReport）→ V 复审 → G 门禁（check-rootcause-report.ts exitCode=0）→ S-fix。

**与 #19 的边界**：#18 = 完全跳过 R；#19 = 有 R 报告但未 V 复审即派 S-fix。二者都是返工链断裂，修复路径详见 [root-cause-locator.md](root-cause-locator.md)。

## #19 R 报告未经 V 复审直接 S-fix

**检测信号**：run-log 中存在 `action=rootcause` 与 `action=fix`，但二者之间无针对 RootCauseReport 的 `action=review` 记录；或 `check-rootcause-report.ts` 无 exitCode=0 证据即出现 `action=fix`。

**回退动作**：S-fix 产物作废；对 RootCauseReport 补走 V 复审 + G 门禁（`check-rootcause-report.ts`），通过后携带报告重新分派 S-fix。

**完整返工循环**：V/G → R → V → G → S-fix → V → G（SKILL.md「执行工作流」步骤 9）。

## #48 子代理越界实施

**定义**：六角色中任一子代理执行其角色边界外的动作。边界见 [subagent-delegation.md](subagent-delegation.md)「强制约束」与 dispatch-matrix.md §1：S 只产出（含 RTM 回填与 inputProvenance 签名）；V 只评审（产出 VerifierOutput JSON）；G 只跑门禁与回填证据；A 只产出 ingestion 中间产物；R 只产出根因/预防性审查报告。

**典型越界**（与 SKILL.md 角色表逐条对应）：S 跑 check-*.ts / 改 project.status；G 修改阶段产物 / 产出评审 JSON；V 跑门禁脚本 / 改产物；A 写正式阶段产物 / 改 status；R 实施修复 / 跑门禁 / 跨阶段定位。

**检测信号**：run-log role-action 配对异常（如 role=G 且 action=produce）；signature-chain 消费链断裂（产物无对应产出者签名）；gate-logs 存档者与 run-log 记录者不一致。

**回退动作**：回到当前阶段起点，越权产物作废重做，重走 S→R3→V→G。

**与相邻条目的辨析**：#10 是编排者（O）越权实施；#48 是子代理越界（镜像条目）；#22 是**目标系统代码**的 RBAC 角色越权（阶段 5 编码缺陷），与流程角色无关。
```

- [ ] **Step 4: 检测信号表补 #48 行（「检测信号」表当前覆盖 #1-#27，在其后补一行）**

```markdown
| 48 | run-log role-action 配对异常；signature-chain 产物无产出者签名 | 回退当前阶段起点，越权产物作废重做 |
```

（列结构以该表现场三列/四列为准对齐。）

- [ ] **Step 5: SKILL.md 5 处 #22 → #48**

第 82-86 行角色表内，「反模式 #22」共 6 处（S/V/G/R 各 1，A 行 2 处），全部替换为「反模式 #48」。替换后 grep 确认：

```bash
grep -n "反模式 #22" w-model-dev/SKILL.md   # 期望无输出
```

- [ ] **Step 6: dispatch-matrix.md §7 反模式→check 映射表追加**

```markdown
| 48 子代理越界实施 | check-run-log.ts（R5 role-action 配对）/ check-signature-chain.ts |
```

并在 dispatch-matrix.md 中 grep `47`，将「47 条反模式」类计数文案更新为 48（仅计数文案，编号引用不动）。

- [ ] **Step 7: README / AGENTS 计数同步**

- `README.md`：所有「47 条流程反模式」→「48 条流程反模式」（约 3 处：核心能力、负面知识库、相关文档）
- `AGENTS.md`：§1「47 条流程反模式 #1-#47」→「48 条流程反模式 #1-#48」；§2 references 行同步

- [ ] **Step 8: 运行验证**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # passed:true（maxAntiPattern=48 且 anti-patterns.md 已含 #1~#48）
npm run self-test   # 256/256
grep -rn "47 条" /workspace/README.md /workspace/AGENTS.md /workspace/w-model-dev/SKILL.md /workspace/w-model-dev/references/*.md | grep -v "changes/"   # 期望无输出
```

- [ ] **Step 9: Commit**

```bash
git add w-model-dev/references/anti-patterns.md w-model-dev/SKILL.md w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/references/dispatch-matrix.md README.md AGENTS.md
git commit -m "fix: 新增反模式 #48（子代理越界实施）并修正 SKILL.md #22 误引（P1/P11）"
```

---

### Task 8: 角色矛盾与章节引用修正

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md:1171`、`:1187`
- Modify: `w-model-dev/references/command-reference.md:5`

- [ ] **Step 1: subagent-delegation.md:1171 角色数修正**

旧：「强制 O / S / V / G 四角色，编排者不得越权实施」
新：「强制 O / S / V / G / A / R 六角色协同：S/V/G 每阶段必派、R3 无条件 ≥3 条、A 阶段 1-4 必派（见本文件「角色分派完整性校验」节），编排者不得越权实施」

- [ ] **Step 2: verifier-spec 章节引用修正（2 处）**

- `subagent-delegation.md:1187`：`按 verifier-spec.md §8 产出 VerifierOutput JSON` → `按 verifier-spec.md §7（输出 Schema）+ §8（提示词模板）产出 VerifierOutput JSON`
- `SKILL.md:83`（V 行）：`按 ... verifier-spec.md §8 产出 VerifierOutput JSON` → `按 ... verifier-spec.md §7（输出 Schema）+ §8（提示词模板）产出 VerifierOutput JSON`

- [ ] **Step 3: command-reference.md:5 执行方枚举补全**

旧：「下表「执行方」列标注每个动作由哪个角色执行（O / S / V / G）」
新：「下表「执行方」列标注每个动作由哪个角色执行（O / S / V / G / A / R；A 阶段 1-4 ingestion 分派、R 返工/预防性审查分派）」

- [ ] **Step 4: 验证 + Commit**

```bash
grep -n "四角色" w-model-dev/references/*.md w-model-dev/SKILL.md   # 期望无输出
grep -n "§8 产出 VerifierOutput" w-model-dev/references/subagent-delegation.md w-model-dev/SKILL.md   # 期望无输出
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # passed:true
```

```bash
git add w-model-dev/references/subagent-delegation.md w-model-dev/references/command-reference.md w-model-dev/SKILL.md
git commit -m "docs: 修正角色数量矛盾与 verifier-spec 章节引用（P6/P14）"
```

---

### Task 9: CLI 样板抽取（parse-args / gate-log-writer / budget+maturity 降级复用 / artifact-gate 瘦身 / bdd as any）

**Files:**
- Create: `w-model-dev/scripts/lib/parse-args.ts`
- Create: `w-model-dev/scripts/lib/gate-log-writer.ts`
- Create: `w-model-dev/scripts/__tests__/parse-args.test.ts`、`__tests__/gate-log-writer.test.ts`
- Modify: `w-model-dev/scripts/cli/check-budget.ts`、`check-maturity.ts`（可选输入降级改用 readJsonlOptional）
- Modify: `w-model-dev/scripts/cli/check-artifact-gate.ts`（RTM 读取复用 lib + parsePhaseArg 收敛）
- Modify: `w-model-dev/scripts/logic/bdd-logic.ts:989`
- Modify: 具 `--key=value` 自解析与 gate-logs 手写样板的 CLI（见 Step 4 清单）

- [ ] **Step 1: 新建 lib/parse-args.ts + 测试**

```typescript
/**
 * CLI 通用参数解析（lib/parse-args.ts）
 *
 * 审计修复 P9：`--key=value` 解析与 `--flag` 检测此前在各 cli/*.ts 内复制十余份，统一抽取。
 */

/** 取 `--name=value` 形态的值；不存在返回 undefined（值可为空串） */
export function parseFlagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

/** 检测 `--name` 布尔旗标存在性 */
export function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(`--${name}`);
}
```

`__tests__/parse-args.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';

describe('parse-args（lib/parse-args.ts）', () => {
  const args = ['--phase=4', '--graph=.w-model/ingestion/graph.json', '--json', 'positional.json'];
  it('parseFlagValue 取值', () => {
    expect(parseFlagValue(args, 'phase')).toBe('4');
    expect(parseFlagValue(args, 'graph')).toBe('.w-model/ingestion/graph.json');
    expect(parseFlagValue(args, 'missing')).toBeUndefined();
  });
  it('hasFlag 检测', () => {
    expect(hasFlag(args, 'json')).toBe(true);
    expect(hasFlag(args, 'self-as-verifier')).toBe(false);
  });
});
```

- [ ] **Step 2: 新建 lib/gate-log-writer.ts + 测试**

（文件名格式严格对齐现场 `check-iceberg-sweep.ts:205-206`：`new Date().toISOString().replace(/[:.]/g, '-')` + `<timestamp>-<script>.json`。）

```typescript
/**
 * gate-logs 存档写入（lib/gate-log-writer.ts）
 *
 * 审计修复 P9：check-iceberg-sweep / check-preventive-review / check-bdd-model 三处复制样板统一。
 * 写入失败不阻塞门禁结果（与原行为一致）。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** 向 <projectDir>/.w-model/gate-logs/ 写 <ISO 时间戳>-<scriptName>.json；失败静默（不阻塞门禁） */
export async function writeGateLog(
  scriptName: string,
  payload: unknown,
  projectDir: string = '.',
): Promise<void> {
  try {
    const dir = path.resolve(projectDir, '.w-model', 'gate-logs');
    await fs.mkdir(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.resolve(dir, `${timestamp}-${scriptName}.json`), JSON.stringify(payload, null, 2));
  } catch {
    // gate-logs 写入失败不阻塞
  }
}
```

`__tests__/gate-log-writer.test.ts`：

```typescript
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeGateLog } from '../lib/gate-log-writer.js';

describe('writeGateLog（lib/gate-log-writer.ts）', () => {
  it('写入 gate-logs/<timestamp>-<script>.json 且内容为 pretty JSON', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gatelog-'));
    await writeGateLog('demo-check', { exitCode: 0, passed: true }, dir);
    const files = await fs.readdir(path.join(dir, '.w-model', 'gate-logs'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-demo-check\.json$/);
    const content = JSON.parse(
      await fs.readFile(path.join(dir, '.w-model', 'gate-logs', files[0]!), 'utf-8'),
    ) as { exitCode: number; passed: boolean };
    expect(content).toEqual({ exitCode: 0, passed: true });
  });
  it('目录不可写时不抛异常', async () => {
    await expect(writeGateLog('x', {}, '/proc/definitely-not-writable')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: 三处 gate-logs 样板替换**

`check-iceberg-sweep.ts:202-209`、`check-preventive-review.ts:266-276`、`check-bdd-model.ts:376-384` 的 `mkdir + writeFile` 段分别替换为：

```typescript
await writeGateLog('<scriptName>', output /* 或对应 payload */);
```

（`<scriptName>` 分别为 `iceberg-sweep` / `preventive-review` / `bdd-model`，与原文件名后缀一致；payload 用各现场原有对象。）

- [ ] **Step 4: `--key=value` 解析迁移（机械替换）**

对下列文件中「自写 `args.find(a => a.startsWith('--xxx='))` / `argv.includes('--json')`」逐个替换为 `parseFlagValue(args, 'xxx')` / `hasFlag(args, 'json')`（`--phase` 仍走 `lib/parse-phase.ts` 不动）：

清单（以 grep 现场核实为准，不限于）：`check-budget.ts`、`check-maturity.ts`、`check-run-log.ts`、`check-tla-model.ts`、`check-iceberg-sweep.ts`、`check-preventive-review.ts`、`check-verifier-output.ts`、`check-artifact-gate.ts`、`check-requirement-graph.ts`、`check-code-tla-consistency.ts`、`check-design-contract-consistency.ts`、`check-state-machine-consistency.ts`、`check-tla-bdd-sync.ts`、`check-codegraph-queries.ts`、`check-opsx-artifacts.ts`、`check-openspec-archive.ts`、`check-requirement-coverage.ts`、`check-exemption.ts`、`check-signature-chain.ts`、`check-checkpoint.ts`、`check-rootcause-report.ts`。

核对命令（替换后残留应显著减少，剩余仅各文件独有复杂解析）：

```bash
grep -rn "startsWith('--" w-model-dev/scripts/cli/ | grep -v parse-phase | wc -l
```

- [ ] **Step 5: budget / maturity 可选输入降级复用 readJsonlOptional**

`check-budget.ts:152-184` 与 `check-maturity.ts:132-168`：将「fs.access 预探测 + readJsonlOrExit + catch 警告降级」手写段替换为 `readJsonlOptional(file, 'run-log')`（ENOENT→[] 语义一致；保留原「文件存在但损坏→警告降级」的语义差异时，以现场行为为准：若原实现损坏时 exit 2 则仅替换 ENOENT 分支）。替换后必须保留原有 warning 输出文案（wm-status 同型模式对齐）。

- [ ] **Step 6: check-artifact-gate.ts 瘦身**

- 199-228 行手写「fs.readFile + parseJsonSafe + exitWithError」的 RTM 读取替换为 `readJsonClassified<unknown>(rtmPath)`（Task 4 后其哨兵由 runMain 兜底）
- `parsePhaseArg`（67-123 行）：保留 `-p` 短参兼容与「显式非法报错」行为，但核心 `--phase=` 提取改调 `parseFlagValue`，与 `lib/parse-phase.ts` 重叠的校验逻辑删除（先读 parse-phase.ts 确认其导出行为再删，确保 AGENTS.md §3 中 `--phase=99` 的报错样例输出不变）

- [ ] **Step 7: bdd-logic.ts:989 去 as any**

`designCoverage` 已在 `BddManifest` 接口第 72 行声明，直接改：

```typescript
const dc = input.manifest.designCoverage;
```

并 grep `as any` 确认 bdd-logic.ts 源文件（非测试）无其他残留：

```bash
grep -n "as any" w-model-dev/scripts/logic/bdd-logic.ts   # 期望无输出
```

（`__tests__/bdd-logic.test.ts` 的 8 处 `as any` 属测试构造便利，本任务不改。）

- [ ] **Step 8: 运行验证**

```bash
npx vitest run --config config/vitest.config.ts __tests__/parse-args.test.ts __tests__/gate-log-writer.test.ts __tests__/bdd-logic.test.ts __tests__/gate-enhancement.test.ts   # 全绿
npm run self-test    # 256/256
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts --phase=99 2>&1; echo exit=$?   # 期望与 README §ERROR_JSON 示例一致：✗ [ARG_INVALID] ... exit=2
```

- [ ] **Step 9: Commit**

```bash
git add w-model-dev/scripts/lib/parse-args.ts w-model-dev/scripts/lib/gate-log-writer.ts w-model-dev/scripts/__tests__/parse-args.test.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/cli/ w-model-dev/scripts/logic/bdd-logic.ts
git commit -m "refactor: 抽取 parse-args/gate-log-writer 样板，瘦身 artifact-gate，去 bdd as-any（P8/P9）"
```

---

### Task 10: schema 自描述补齐（$id + 顶层 description）

**Files:**
- Modify: `w-model-dev/schemas/design-contract.schema.json`
- Modify: `w-model-dev/schemas/budget.schema.json`、`coverage.schema.json`、`exemption.schema.json`、`maturity.schema.json`、`verifier-output.schema.json`

- [ ] **Step 1: 逐一补齐**

`design-contract.schema.json` 在 `"$schema"` 行后插入两行：

```json
  "$id": "https://w-model-dev/schemas/design-contract.schema.json",
  "description": "设计契约一致性（design-contract.json）结构 schema，对应 design-contract-logic.ts D1-D4 校验（路径/参数/状态码/响应字段）",
```

其余 5 份仅在 `$id` 行后插入 `description` 行（措辞与各 logic 的规则族一致，规则族编号以 AGENTS.md §8 为准）：

```json
  "description": "预算追踪（budget.json）结构 schema，对应 budget-logic.ts R1-R5 时效性/onExceed/killSwitch 校验",
```

```json
  "description": "需求覆盖分析（coverage.json）结构 schema，对应 coverage-logic.ts C1-C10 四矩阵完整性/100% 覆盖率校验",
```

```json
  "description": "豁免审批（exemption.json）结构 schema，对应 exemption-logic.ts E1-E9 强制 S→R→V→人类四阶段校验",
```

```json
  "description": "成熟度等级（maturity.json）结构 schema，对应 maturity-logic.ts R1-R5 schema/level/周期/history 校验",
```

```json
  "description": "LLM-as-a-Verifier 评审输出（VerifierOutput）结构 schema，字段定义见 references/verifier-spec.md §7，校验对应 verifier-logic.ts R1-R13",
```

- [ ] **Step 2: 验证全部 20 份 $id 与 description 齐备**

```bash
for f in w-model-dev/schemas/*.json; do node -e "const s=require('./$f'); if(!s.\$id||!s.description) console.log('MISSING:', '$f')"; done   # 期望无输出
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # passed:true（schema 数仍 20）
npm run self-test   # 256/256
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/schemas/
git commit -m "docs: 补齐 design-contract $id 与 6 份 schema 顶层 description（P12）"
```

---

### Task 11: persona 统一 + opsx 吞错日志 + gate-logic 单测 + 分节导引 + 术语与 CHECKPOINT 清单

**Files:**
- Modify: `w-model-dev/subagent/product-manager.md:6`（删 tools 行）
- Modify: 5 个 hex color persona 文件
- Modify: `w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`（6 处 catch 加 stderr 日志）
- Create: `w-model-dev/scripts/__tests__/gate-logic.test.ts`
- Modify: `w-model-dev/references/subagent-delegation.md`、`verifier-spec.md`、`data-models.md`（各加 §0 分节导引）
- Modify: `w-model-dev/references/glossary.md`（反模式术语 + 计数口径条目）
- Modify: `w-model-dev/references/dispatch-matrix.md:9`（反例→反模式）
- Modify: `w-model-dev/references/anti-patterns.md`（H1 标题）
- Modify: `w-model-dev/references/command-reference.md`（CHECKPOINT 统一清单节）

- [ ] **Step 1: persona frontmatter 统一**

- `product-manager.md:6` 删除整行 `tools: WebFetch, WebSearch, Read, Write, Edit`
- 5 处 color 统一为命名色（对齐 23 份多数派）：`engineering-autonomous-optimization-architect.md` `"#673AB7"`→`purple`；`engineering-incident-response-commander.md` `"#e63946"`→`red`；`engineering-threat-detection-engineer.md` `"#7b2d8e"`→`violet`；`testing-evidence-collector.md` `"#708090"`→`blue`；`product-behavioral-nudge-engine.md` `"#FF8A65"`→`orange`

核对：

```bash
grep -rn 'color: *"' w-model-dev/subagent/   # 期望无输出（无 hex 残留）
grep -rn '^tools:' w-model-dev/subagent/     # 期望无输出
```

- [ ] **Step 2: ensure-codegraph-opsx 吞错加日志**

6 处 `catch { return false; }`（44-116 行区域）改为：

```typescript
  } catch (err) {
    console.error(`⚠ [ensure-codegraph-opsx] ${'<本探测步骤的现场标签>'} 失败: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
```

（`<本探测步骤的现场标签>` 用各处原有的步骤语义命名，如 `codegraph CLI 探测` / `npm 安装 codegraph` / `openspec 探测` 等；stderr 输出不影响 stdout 的 JSON/结果消费。）

- [ ] **Step 3: 新建 gate-logic.test.ts**

先读 `logic/gate-logic.ts` 顶部 export（`checkArtifactGate` / `checkTemplatesStructure` / `checkPhaseSpecStructure` / `checkRequirementSpecStructure` 等）确认签名与入参形状，再按下面骨架写用例（fixtures 直接读 `samples/gate/`）：

```typescript
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkArtifactGate } from '../logic/gate-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samples = (f: string) => path.resolve(__dirname, '../samples/gate', f);
const load = async (f: string) => JSON.parse(await fs.readFile(samples(f), 'utf-8')) as unknown;

describe('gate-logic 核心路径单测（审计修复 P16：1400+ 行核心逻辑此前无专属单测）', () => {
  it('valid-rtm.json 通过终检', async () => {
    const out = checkArtifactGate(await load('valid-rtm.json'), { phase: 8 });
    expect(out.violations).toEqual([]); // 断言字段名按实际返回结构调整（violations / passed / exitCode）
  });
  it('bad-coverage.json 报覆盖率违反', async () => {
    const out = checkArtifactGate(await load('bad-coverage.json'), { phase: 8 });
    expect(out.violations.length).toBeGreaterThan(0);
  });
  it('bad-nfr-missing-dual-fields.json 报 NFR 双字段违反', async () => {
    const out = checkArtifactGate(await load('bad-nfr-missing-dual-fields.json'), { phase: 8 });
    expect(JSON.stringify(out.violations)).toMatch(/NFR/);
  });
  it('阶段级 --phase=5：bad-phase5-missing-codemodule.json 报 codeModule 缺失', async () => {
    const out = checkArtifactGate(await load('bad-phase5-missing-codemodule.json'), { phase: 5 });
    expect(JSON.stringify(out.violations)).toMatch(/codeModule/);
  });
  it('阶段级 --phase=5：REQ 行缺 codeModule 时后续测试层不否决（反模式 #21）', async () => {
    const out = checkArtifactGate(await load('valid-phase6.json'), { phase: 5 });
    expect(out.violations.filter((v: unknown) => JSON.stringify(v).includes('systemTest')).length).toBe(0);
  });
});
```

**注意**：第一个用例的 options 形状（`{ phase }` 还是多参数）与返回结构字段名以 gate-logic.ts 实际签名为准调整；fixtures 断言语义以 `self-test.ts` 中同名样本的期望退出码为准（读 self-test.ts 中 gate 段样本清单对照）。

- [ ] **Step 4: 3 个超大文件加分节导引**

在 `subagent-delegation.md`、`verifier-spec.md`、`data-models.md` 标题之后插入（各文件按实际章节名填第二列）：

```markdown
> **§0 按需分节加载导引**（约束 #6）：本文件较大，按下表只读所需节，禁止整文件载入上下文。
>
> | 触发场景 | 只读章节 |
> |---|---|
> | （分派子代理 → 角色边界/模板）| （对应节号） |
> | （…按各文件实际章节填全） | （…） |
```

- [ ] **Step 5: 术语与 CHECKPOINT 清单**

5a. `glossary.md` 追加两条：

```markdown
| 术语 | 定义 |
|---|---|
| 反模式（Anti-Pattern） | 流程级负面知识库条目（#1-#48），命中即回退到当前阶段起点。规范用词为「反模式」；「反例」为弃用别名（_Avoid_）。与「失败模式 F1-F10」（行为退化，登记不回退）、「运维失败模式 O1-O6」三库互补。 |
| exit-2 脚本口径 | `scripts/cli/` 下全部脚本除 `self-test.ts`（回归基线，exit 0/1）外均为 exit 2 结构化错误脚本：26 个 check-* + 7 个工具 CLI（含 plan-chunks.ts）= 33。计数变更须同步 docs-consistency-logic EXPECTED。 |
```

（并入 glossary 现有表格结构，不新起表。）

5b. `dispatch-matrix.md:9`：`反例 #5` → `反模式 #5`；grep `反例` 全 references，除 anti-patterns.md 标题外全部改「反模式」。

5c. `anti-patterns.md` H1：`# 反例与黑名单（Anti-Patterns）` → `# 流程反模式清单（Anti-Patterns）`；先 `grep -rn "anti-patterns.md#" /workspace --include="*.md" | grep -v changes/` 确认无锚点链接受影响（若有则一并修）。

5d. `command-reference.md` 末尾追加节：

```markdown
## CHECKPOINT 统一清单

| CHECKPOINT | 触发点 | 确认对象 |
|---|---|---|
| 项目初始化 | 首次进入阶段前（SKILL.md 执行工作流步骤 5） | 进入阶段 / 同步测试设计 / 预期产物清单 |
| ingestion 规划确认 | 阶段 1-4 plan-chunks 产出后（步骤 5.5） | 分块计划与 A-chunk 分派 |
| ingestion 收敛确认 | 收敛循环结束（MAX_ROUNDS=5 或通过） | 图谱收敛结果 |
| 阶段门放行 | G 门禁通过后（步骤 9） | 质量等级 / 子标准分 / reworkHints → 放行或返工 |
| 发布放行 | 阶段 8 终检 exitCode=0 后 | RTM 覆盖率 / 四级测试 / GATE_JSON → 发布或回退 |
| 重置确认 | /wm reset | 清空实体不可逆操作 |
| 导入覆盖确认 | /wm import 目标已有数据 | 覆盖现有数据 |
```

- [ ] **Step 6: 运行验证 + Commit**

```bash
npx vitest run --config config/vitest.config.ts __tests__/gate-logic.test.ts   # 全绿
npm run self-test    # 256/256
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # passed:true
```

```bash
git add w-model-dev/subagent/ w-model-dev/scripts/cli/ensure-codegraph-opsx.ts w-model-dev/scripts/__tests__/gate-logic.test.ts w-model-dev/references/subagent-delegation.md w-model-dev/references/verifier-spec.md w-model-dev/references/data-models.md w-model-dev/references/glossary.md w-model-dev/references/dispatch-matrix.md w-model-dev/references/anti-patterns.md w-model-dev/references/command-reference.md
git commit -m "test+docs: gate-logic 专属单测、persona 统一、opsx 吞错日志、分节导引与术语规范化（P13/P14/P15/P16）"
```

---

### Task 12: SSoT 同步、版本发布 41.18.0、全量验证

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（grep 命中处同步）
- Modify: `README.md`、`AGENTS.md`、`CONTRIBUTING.md`（计数 / 健康指标 / wm-write 描述）
- Modify: `w-model-dev/SKILL.md:3`、`w-model-dev/skill-metadata.json`（版本号）
- Modify: `CHANGELOG.md`（新版本条目）
- Modify: `w-model-dev/scripts/__tests__/README.md`（coverage 矩阵补新测试文件）

- [ ] **Step 1: SSoT 同步**

```bash
grep -nE "47 条|#1~#47|四角色|logic/plan-chunks|process\.exit\(2\)|33 个脚本|31" docs/skill-design-document_SSoT.md | head -40
```

对命中处逐个同步：反模式计数 48、角色六类、plan-chunks 位于 cli/、readJsonOrExit 哨兵化说明（若 SSoT 描述了 exit 机制）、wm-write「回读校验」描述追加「失败自动回滚」。**SSoT 若无命中则不改**（避免无中生有）。

- [ ] **Step 2: README / AGENTS / INSTALL 健康指标与描述同步**

- `README.md` 健康指标表：Vitest 行更新为新实测值（Task 11 后重跑取实际 file/test 数，预期 42→47 files 左右）；反模式 48；`wm-write.ts` 相关描述（§3 常用命令注释）追加「回读失败自动回滚」
- `AGENTS.md` §3 wm-write 行、§8 表补 `plan-chunks.ts` 行（`| plan-chunks.ts | ingestion 分块规划（O 只读 stdout） | 1-4 | 0=正常，2=输入错误 |`）、§1 反模式计数 48、测试计数更新
- `CONTRIBUTING.md`：grep `47|42 个|691` 同步计数
- `w-model-dev/scripts/__tests__/README.md`：coverage 矩阵补 `gate-logic.test.ts` / `java-version.test.ts` / `run-main.test.ts` / `parse-args.test.ts` / `gate-log-writer.test.ts` 行，更新文件数与用例总数为实测值

- [ ] **Step 3: 版本 bump + CHANGELOG**

- `SKILL.md:3`：`version: 41.17.0` → `version: 41.18.0`
- `skill-metadata.json`：`"version": "41.17.0"` → `"41.18.0"`（skill-metadata.test.ts 会校验双写一致）
- `CHANGELOG.md` 顶部追加（沿用现有条目格式）：

```markdown
## 41.18.0 - 2026-08-16

### 修复（审计 2026-08-16 十六项问题）
- **反模式 #48 新增**（子代理越界实施）：修正 SKILL.md 五处 #22 误引（#22 实为目标系统 RBAC 角色越权）；补 #18/#19 详细节；maxAntiPattern 47→48
- **run-log action 枚举同步**：data-models.md interface 15→27 值（补 emergency-fix/r3-*/codegraph_query/opsx_*/ensure_deps/iceberg-*），docs-consistency 新增 interface↔enum 语义比对
- **TLA+ 门禁超时**：SANY 60s / TLC 300s（EXEC_LIMITS 集中），TLC 挂死不再阻塞 CHECKPOINT；Java 版本解析单源化（lib/java-version.ts），预检不再硬编码 11
- **wm-write 原子写**：tmpPath 追加 randomUUID（同进程并发安全）；回读失败自动回滚备份（rolledBack 字段）
- **错误出口统一**：HandledCliError + runMain，消除 readJsonOrExit process.exit 截断 ERROR_JSON 风险与 readJsonClassified 双打印
- **分层修复**：plan-chunks 拆分 logic（纯）/cli（入口）；schema-loader 去 process.exit、IO 下沉 lib/schema-fs.ts；bdd-logic 去 as any
- **样板抽取**：lib/parse-args.ts、lib/run-main.ts、lib/gate-log-writer.ts；budget/maturity 复用 readJsonlOptional；artifact-gate 瘦身
- **schema 自描述**：design-contract 补 $id；6 份 schema 补顶层 description
- **persona 统一**：product-manager 删 tools 字段；5 份 hex color 统一命名色
- **文档一致性**：subagent-delegation 六角色矛盾修正；verifier-spec §7/§8 引用修正；command-reference 补 A/R 与 CHECKPOINT 统一清单；INSTALL 计数 31→33 修正；glossary 增反模式/exit-2 口径条目；三个超大引用文件增 §0 分节导引；ensure-codegraph-opsx 吞错加 stderr 日志；gate-logic 首次获得专属单测
```

- [ ] **Step 4: 格式化与全量验证**

```bash
npm run format      # prettier（scripts/**/*.ts + config/ + scripts/*.cjs）
npm run self-test   # 期望 256/256（若新增 docs-consistency 检查引入新样本则按实际数）
npx vitest run --config config/vitest.config.ts   # 期望全绿，记录最终 files/tests 数并回填 Step 2 的 README/AGENTS/__tests__ README
npm run prepush     # 16 项门禁全通过（含 docs-consistency 新口径 48/33、samples 覆盖矩阵、prettier、npm audit）
```

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md README.md AGENTS.md CONTRIBUTING.md CHANGELOG.md w-model-dev/SKILL.md w-model-dev/skill-metadata.json w-model-dev/scripts/__tests__/README.md
git commit -m "chore(release): 41.18.0 — 审计十六项修复全量同步（SSoT/README/AGENTS/CHANGELOG）"
```

---

## 风险与回退

| 风险 | 缓解 |
|---|---|
| Task 4 全仓 catch 迁移量大、易漏 | Step 4 的 grep 核对命令保证零残留；self-test + vitest 全量兜底 |
| Task 6 plan-chunks 拆分破坏 ingestion 流程 | Step 4 用真实 references 文件端到端验证 exit 0/2；tests 保持断言语义不变 |
| Task 7 计数 47→48 漏改 | docs-consistency `maxAntiPattern` 校验 + Step 8 grep 兜底 |
| Task 12 prepush npm audit 网络不可达 | 门禁自身已设计为网络不可达自动跳过，不阻塞 |
| 中间状态（Task 4 完成而 Task 9 未做）错误路径双打印 | 仅影响 stderr 观感与 stdout 重复行，退出码语义不变；Task 12 全量验证前不 push |
| gate-logic.test.ts 签名假设不匹配 | Task 11 Step 3 第一步强制先读 export 签名，断言语义对照 self-test 样本期望 |

## 完成定义（DoD）

1. `npm run self-test`、`npx vitest run`、`npm run prepush` 全绿
2. `grep -rn "反模式 #22" w-model-dev/SKILL.md` 无输出；`grep -rn "47 条" README.md AGENTS.md w-model-dev/` 无输出
3. `w-model-dev/scripts/logic/` 中 `plan-chunks.ts` 已删除、`schema-loader.ts` 无 `node:fs`/`process.exit`
4. 版本三处一致：SKILL.md frontmatter = skill-metadata.json = CHANGELOG 最新条目 = 41.18.0
5. 全部 16 项审计问题在上述任务中有对应落点且可验证
