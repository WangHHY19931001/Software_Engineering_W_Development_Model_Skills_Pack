# 门禁-返工链契约修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 2026-09-20 真实 8 阶段调测发现的 D-1~D-8，使「返工链 ↔ 门禁契约」自洽——恢复返工路径的门禁表达力，同时保持反模式 #18/#19 守护不放宽。

**架构：** 按「语义增补」取向：签名链加可选 `targetKind` 并做 role×action×targetKind 三元判定；run-log 配对谓词接受 V 所属产物的重发记录；code-tla 装载与 check-tla-model 对齐 `basePath`；budget 护栏改按真实返工事件与 Σtokens 实效；legacy 谓词抽为共享导出供两消费者复用；R11 给阶段 1 自举豁免；opsx 预归档门兼容归档位。全部改动遵 AGENTS §6（SSoT 先行）并以单测正反例 + demo 端到端复验 + prepush 19 项为验收。

**技术栈：** TypeScript（ESM，`.js` 后缀导入）、tsx runtime、vitest、ajv/ajv-formats、JSON Schema draft-07。仓库测试命令：`npx vitest run --config config/vitest.config.ts <path>`；推送前门禁：`npm run prepush`；回归基线：`npm run self-test`。

**依据规格：** `docs/superpowers/specs/2026-09-20-gate-contract-fixes-design.md`（v1.0，已批准）。

---

## 文件结构

| 文件 | 职责 | 本计划动作 |
|---|---|---|
| `w-model-dev/schemas/signature-chain.schema.json` | 签名链条目 schema | 加可选 `targetKind`（D-1） |
| `w-model-dev/scripts/logic/signature-chain-logic.ts` | 链校验（含 R9 矩阵） | 矩阵函数化 + 返工例外（D-1） |
| `w-model-dev/scripts/logic/run-log-logic.ts` | run-log 校验（R1-R11） | 导出 legacy 谓词（D-5）；R3/R7 配对接受 V 重发（D-2）；R11 阶段 1 豁免（D-6） |
| `w-model-dev/scripts/logic/checkpoint-logic.ts` | checkpoint 校验 | 复用共享 legacy 谓词（D-5） |
| `w-model-dev/scripts/logic/budget-logic.ts` | 预算纯逻辑 | killSwitch 口径 + 新增用量上限规则（D-4a/b） |
| `w-model-dev/scripts/cli/check-budget.ts` | 预算 CLI | 统计改写 + 传入 tokensUsed（D-4a/b） |
| `w-model-dev/scripts/cli/check-code-tla-consistency.ts` | 代码-TLA 一致性 | 装载用 basePath；导出 `loadTlaContents` 供测试（D-3） |
| `w-model-dev/scripts/cli/check-opsx-artifacts.ts` | opsx 制品门 | strict 目录解析兼容归档位（D-7） |
| `w-model-dev/scripts/__tests__/{budget-logic,checkpoint-logic,signature-chain-logic,run-log-logic,check-code-tla-consistency}.test.ts` | 单测 | 新增/扩展正反例 |
| `w-model-dev/scripts/samples/`（对应子目录 + `NEGATIVE-COVERAGE.md`） | 负向样本与登记 | 新增样本与登记项 |
| `docs/skill-design-document_SSoT.md`、`w-model-dev/references/{signature-chain-guide,subagent-delegation,operational-recovery,data-models,tla-plus,command-reference}.md`、`CHANGELOG.md` | 契约文档 | 同步更新（D-1~D-8） |

**既有模式遵循**：logic 层纯函数 + `CheckResult{passed,violations}`；测试用 vitest + `samples/` 夹具（见 `__tests__/budget-logic.test.ts` 头注风格）；CLI 错误统一 `exitWithError`（`lib/cli-error.ts`）。

---

## 任务 1：D-3 code-tla 装载基准对齐

**文件：**
- 修改：`w-model-dev/scripts/cli/check-code-tla-consistency.ts:150-170`（`loadTlaContents`）
- 测试：`w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts`（新建）
- 文档：`w-model-dev/references/tla-plus.md` §10（解析基准一句）

- [ ] **步骤 1：编写失败的测试**

```ts
// check-code-tla-consistency.test.ts（节选）
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTlaContents } from '../cli/check-code-tla-consistency.js';

describe('loadTlaContents 解析基准（D-3）', () => {
  it('basePath 存在时按 manifestDir + basePath + tlaPath 解析', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
    await fs.mkdir(path.join(root, 'tla'), { recursive: true });
    await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
    await fs.writeFile(path.join(root, 'tla', 'L2_x.tla'), '---- MODULE L2_x ----\n====\n');
    const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
    const manifest: any = { basePath: '..', specs: [{ id: 'L2_x', level: 'L2', tlaPath: 'tla/L2_x.tla' }] };
    await loadTlaContents(manifest, manifestPath);
    expect(manifest.specs[0].tlaContent).toContain('MODULE L2_x');
  });

  it('文件缺失仍 fail-closed（process.exit(2) 由 CLI 层承担，纯函数抛错）', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tla-bp-'));
    await fs.mkdir(path.join(root, '.w-model'), { recursive: true });
    const manifestPath = path.join(root, '.w-model', 'tla-manifest.json');
    const manifest: any = { basePath: '..', specs: [{ id: 'L2_missing', level: 'L2', tlaPath: 'tla/none.tla' }] };
    await expect(loadTlaContents(manifest, manifestPath)).rejects.toThrow(/ENOENT|不可读/);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts`
预期：FAIL——`loadTlaContents` 未导出（ImportError）且未用 basePath。

- [ ] **步骤 3：最小实现**

`check-code-tla-consistency.ts`：

```ts
export async function loadTlaContents(manifest: TlaManifest, manifestFile: string): Promise<void> {
  const manifestDir = path.dirname(path.resolve(manifestFile));
  const basePath = typeof manifest.basePath === 'string' && manifest.basePath.trim() !== '' ? manifest.basePath : '.';
  if (!Array.isArray(manifest.specs)) return;
  for (const spec of manifest.specs as TlaSpec[]) {
    if (!spec || (spec.level !== 'L2' && spec.level !== 'L3')) continue;
    if (typeof spec.tlaPath !== 'string' || spec.tlaPath.trim() === '') continue;
    const tlaAbs = path.resolve(manifestDir, basePath, spec.tlaPath);   // ← 与 check-tla-model 同口径
    // …以下（inlineContent 优先 / ENOENT fail-closed）保持原样不动
```

实现要点：仅替换 `tlaAbs` 的计算与 `export`；把原 `catch` 内的 `exitWithError` 改为「返回拒绝」以便纯函数测试——CLI 入口处 `await loadTlaContents(...).catch(exitWithError)`（保持 CLI exit 2 契约不变）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts`
预期：PASS（2/2）。

- [ ] **步骤 5：端到端抽查（demo）**

运行：`cd eval/e2e/demo && npx tsx ../../w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src`
预期：exit 0，且**先删除 `.w-model/tla` 目录联结**仍 exit 0（这才是 D-3 修复的判据）：
`cmd //c "rmdir .w-model\tla"`（移除 junction，若存在）

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/cli/check-code-tla-consistency.ts w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts w-model-dev/references/tla-plus.md
git commit -m "fix(gates): check-code-tla 装载按 manifest.basePath 解析（D-3）

- tlaAbs = resolve(manifestDir, basePath ?? '.', tlaPath)，与 check-tla-model 对齐
- loadTlaContents 导出并改为拒绝式错误传播，CLI 入口维持 exit 2 fail-closed
- tla-plus.md §10 注明解析基准"
```

---

## 任务 2：D-5 legacy 谓词共享（两消费者口径统一）

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`（导出谓词，约 L521-584）
- 修改：`w-model-dev/scripts/logic/checkpoint-logic.ts:184-192`（复用）
- 测试：`w-model-dev/scripts/__tests__/checkpoint-logic.test.ts`（扩展）

- [ ] **步骤 1：编写失败的测试**

```ts
// checkpoint-logic.test.ts 追加
import { checkCheckpoint } from '../logic/checkpoint-logic.js';
import { isLegacyAbsorbableEntry } from '../logic/run-log-logic.js';

it('legacy 条目（缺 identity 字段）在 checkpoint 门与 run-log 门一致判非阻断（D-5）', () => {
  const legacy = {
    runId: 'pX-cp', timestamp: '2026-01-01T00:00:00Z', phase: 1, phaseName: '需求分析',
    action: 'checkpoint', role: 'O', duration_s: 1, tokens: 1, estimated: false,
    subagentSpawns: 0, gateExitCode: 0, outcome: 'success',
    acknowledgedDecisions: ['需求规格（requirement-spec）冻结 REQ-001 环形计数器 [0,10]'],
  };
  expect(isLegacyAbsorbableEntry(legacy, [])).toBe(true);           // run-log 侧同谓词
  const r = checkCheckpoint([legacy], { checkpointLogDir: undefined, policy: ... });
  expect(r.passed).toBe(true);                                      // 不再报 [schema]
});

it('真实类型错误仍 blocking（回归）', () => {
  const broken = { runId: 1, timestamp: 'x', phase: '一', action: 'checkpoint', role: 'O', outcome: 'success' };
  const r = checkCheckpoint([broken as any], { /* 同上传参 */ });
  expect(r.passed).toBe(false);
  expect(r.violations.some((v) => v.includes('[schema]'))).toBe(true);
});
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/checkpoint-logic.test.ts`
预期：FAIL——`isLegacyAbsorbableEntry` 未导出；checkpoint 门对 legacy 条目报 `[schema]`。

- [ ] **步骤 3：最小实现**

`run-log-logic.ts`：把现有 legacy 吸收判断（`isLegacySchemaFailure` L397 + `isPostCutoffUndeclaredVariantEmergencyFix` L429 + `isLegacyMissingReworkHints` L456，消费点在 L534-578）组合为单一导出。**净语义必须与 `checkRunLog` 现有两处吸收分支等价**（先 reworkHints 分支、再 identity/variant 分支）：

```ts
/**
 * 共享谓词（D-5）：该条目的 schema 失败是否属可吸收的 legacy 形态。
 * 与 checkRunLog 的两条吸收分支等价（reworkHints 族 + identity/variant 族），
 * 供 checkpoint 门复用，消除「同一记录两门裁定不一致」。
 */
export function isLegacyAbsorbableEntry(raw: unknown, errorMessages: string[]): boolean {
  if (isFailedReviewMissingReworkHints(raw)) {
    const otherMessages = errorMessages.filter(
      (message) =>
        !message.includes('reworkHints') &&
        !message.includes('must match "then" schema') &&
        !message.includes('must match "if" schema'),
    );
    if (otherMessages.length === 0 || isLegacySchemaFailure(raw, otherMessages)) {
      return isLegacyMissingReworkHints(raw as RunLogEntry);
    }
  }
  return isLegacySchemaFailure(raw, errorMessages) && !isPostCutoffUndeclaredVariantEmergencyFix(raw);
}
```

`checkRunLog` 内两处判断随之改为调用该导出（`L541` 的 `otherMessages.length === 0 || isLegacySchemaFailure(raw, otherMessages)` 与 `L558` 的组合条件），**分支内承接动作（字段裁剪 + LEGACY_VARIANT / LEGACY_REWORK_HINTS diagnostic）保持不变**，确保 358 样本基线零漂移。

`checkpoint-logic.ts` L186-192 改为：

```ts
const schemaResult = validateBySchema('run-log', raw);
if (!schemaResult.valid) {
  if (isLegacyAbsorbableEntry(raw, schemaResult.errorMessages)) continue;   // ← 与 run-log-logic 同谓词
  for (const m of schemaResult.errorMessages) violations.push(`条目 ${i + 1} [schema] ${m}`);
  continue;
}
```

（`checkpoint-logic` 从同一 logic 目录 import，不新增依赖。）

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/checkpoint-logic.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
预期：PASS（含既有用例不回归）。

- [ ] **步骤 5：demo 抽查**

运行：`cd eval/e2e/demo && npx tsx ../../w-model-dev/scripts/cli/check-checkpoint.ts .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log`
预期：exit 0。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/logic/checkpoint-logic.ts w-model-dev/scripts/__tests__/checkpoint-logic.test.ts
git commit -m "fix(gates): checkpoint 门复用 run-log legacy 谓词（D-5）
- 导出 isLegacyAbsorbableEntry，两消费者对同条记录裁定一致
- 真实 schema 错误仍 blocking（含回归用例）"
```

---

## 任务 3：D-6 R11 阶段 1 自举豁免

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts:1360-1392`（R11）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`（扩展）
- 文档：`w-model-dev/references/operational-recovery.md`（闭环调用约定节）

- [ ] **步骤 1：编写失败的测试**

```ts
it('阶段 1：check-checkpoint 成功记录晚于放行、早于下一放行 → 通过（D-6）', () => {
  const entries = [
    ...closureGateRecords(1, 'check-budget.ts', '2026-01-01T00:00:01Z'),
    ...closureGateRecords(1, 'check-run-log.ts',  '2026-01-01T00:00:02Z'),
    ...closureGateRecords(1, 'check-maturity.ts', '2026-01-01T00:00:03Z'),
    ...closureGateRecords(1, 'check-preventive-review.ts', '2026-01-01T00:00:04Z'),
    cpRecord(1, '2026-01-01T00:00:05Z'),
    ...closureGateRecords(1, 'check-checkpoint.ts', '2026-01-01T00:00:06Z'),   // 后置
    cpRecord(2, '2026-01-01T00:10:00Z'),                                      // 下一放行
  ];
  expect(checkRunLog(entries).violations.filter((v) => v.startsWith('R11:')).length).toBe(0);
});

it('阶段 1：完全缺失 check-checkpoint 成功记录 → 阻断', () => { /* 同上但删掉那三条 */ expect(...).toContain(...); });
it('阶段 2 回归：后置 check-checkpoint 记录 → 仍阻断', () => { /* 把后置场景挪到 phase=2 */ expect(...).toMatch(/R11.*check-checkpoint/); });
```

（`closureGateRecords(phase, script, ts)` / `cpRecord(phase, ts)` 为测试内小工具：构造 `{action:'gate', role:'G', outcome:'success', gateExitCode:0, script, timestamp, phase}` 与带 `acknowledgedDecisions` 的 checkpoint 记录。）

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
预期：FAIL——首个用例报 `R11: 阶段 1 的 checkpoint 放行缺少闭环脚本 check-checkpoint.ts`。

- [ ] **步骤 3：最小实现**

R11 计数循环（L1376-1381）改为：`check-checkpoint.ts` 在 `phase===1` 时使用「后置窗口」判据——先算该释放之后的下一次 checkpoint 记录时间（任意 phase），窗口 = `(releaseAt, nextReleaseAt)`；无下一放行则窗口下界为 `+∞`（仅要求存在）：

```ts
const releaseTimes = valid.filter((e) => e.action === 'checkpoint' && e.outcome === 'success')
  .map((e) => Date.parse(e.timestamp)).sort((a, b) => a - b);
// …在 proven.add 判定处：
if (g.script === 'check-checkpoint.ts' && e.phase === 1) {
  const next = releaseTimes.find((t) => t > releaseAt);
  const gt = Date.parse(g.timestamp);
  if (gt > releaseAt && (next === undefined || gt < next)) proven.add(g.script);
  continue;
}
```

只影响 `phase===1`；其余逻辑与四脚本判据不变。

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
预期：PASS（含三条新用例与既有 R11 用例）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/references/operational-recovery.md
git commit -m "fix(gates): R11 阶段 1 自举豁免（D-6）
- phase===1 的 check-checkpoint 成功记录允许后置，须早于下一放行
- phase>=2 行为不变（含回归用例）"
```

---

## 任务 4：D-7 opsx 预归档门兼容归档位

**文件：**
- 修改：`w-model-dev/scripts/cli/check-opsx-artifacts.ts:162-200`（strict 目录解析）
- 测试：`w-model-dev/scripts/__tests__/check-opsx-artifacts.test.ts`（扩展）
- 文档：`w-model-dev/references/command-reference.md`（「Artifact Gate 项目阶段证据门」节补两态语义）

- [ ] **步骤 1：编写失败的测试**

```ts
it('已归档态：活动目录缺失、archive 恰一匹配 → 按归档位校验且通过（D-7）', () => {
  // fixture：tmp/openspec/changes/archive/2026-01-01-phase7-x/ 含完整制品与 r3-reviews/v-reviews
  const r = checkOpsxArtifactsStrict(tmpRoot, 7, 'phase7-x');
  expect(r.passed).toBe(true);
});

it('archive 多匹配 → 失败（fail-closed）', () => { /* 放两个 *-phase7-x 目录 */ expect(r.passed).toBe(false); });
it('活动目录存在时优先活动位（回归）', () => { /* 同时存在活动+归档 */ expect(r.passed).toBe(true); });
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-opsx-artifacts.test.ts`
预期：FAIL——归档态用例报「活动目录不存在」。

- [ ] **步骤 3：最小实现**

**注意落点**（`checkOpsxArtifactsStrict` L172-200 有三处早退，其中 `candidates.length === 0` 在归档态必然触发）：归档回退必须**替换候选判定这一段**，而非仅在末尾替换路径——否则归档态在 `L184-187` 就 return 了。

现有结构：`L183 candidates = activeChangeDirs(...)` → `L184-187 空候选早退` → `L189-196 !matched 早退` → `L200 validateChangeDirArtifacts(changesDir, changeId, ...)`。

改法（保持活动位优先、fail-closed 方向不变）：

```ts
const candidates = activeChangeDirs(changesDir, phase);
let changeName = changeId;          // 传给 validateChangeDirArtifacts 的「相对 changesDir 的名字」
if (!candidates.includes(changeId)) {
  // L184-187 的空候选早退改为：先找归档位，恰一匹配才继续
  const archiveDir = path.join(changesDir, 'archive');
  const matches = existsSync(archiveDir)
    ? readdirSync(archiveDir, { withFileTypes: true })
        .filter((dir) => dir.isDirectory() && (dir.name === changeId || dir.name.endsWith(`-${changeId}`)))
        .map((dir) => dir.name)
    : [];
  if (matches.length === 1) {
    changeName = path.join('archive', matches[0]!);   // validateChangeDirArtifacts 内部 path.join(changesDir, changeName)
  } else if (matches.length > 1) {
    violations.push(`${changeId} 归档位多匹配（${matches.length}）：${matches.join(', ')} —— fail-closed`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  } else {
    // 原两条早退文案保持（空候选 / 不在 active 候选内）
    violations.push(/* L185 或 L191-194 的原文案 */);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }
}
const changesNames = [changeName];
validateChangeDirArtifacts(changesDir, changeName, violations, artifactsFound);   // 原 L200
```

（`validateChangeDirArtifacts` 签名与内部实现**不改**——它已按 `path.join(changesDir, changeName)` 解析，传 `archive/<name>` 即可；`validateStageReviews(projectRoot, phase, ...)` 与 changeId 无关，保持原样。）

- [ ] **步骤 4：运行验证通过 + demo 抽查**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-opsx-artifacts.test.ts`
预期：PASS。
demo（已归档态）：`cd eval/e2e/demo && npx tsx ../../w-model-dev/scripts/cli/check-opsx-artifacts.ts . --phase=8 --scope=.w-model/change-scope.p8.json` → exit 0，且 `check-openspec-archive.ts` 同参 → exit 0（两门同时绿）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-opsx-artifacts.ts w-model-dev/scripts/__tests__/check-opsx-artifacts.test.ts w-model-dev/references/command-reference.md
git commit -m "fix(gates): opsx 预归档门兼容归档位（D-7）
- 活动缺失且 archive 恰一匹配 → 按归档位同契约校验；多匹配 fail-closed
- command-reference 注明未归档/已归档两态的双门期望"
```

---

## 任务 5：D-4a killSwitch 触发口径对齐事实

**文件：**
- 修改：`w-model-dev/scripts/cli/check-budget.ts:75-102`（`countReworks`）
- 测试：`w-model-dev/scripts/__tests__/budget-logic.test.ts`（扩展 CLI 级统计导出）

- [ ] **步骤 1：编写失败的测试**

```ts
import { countReworks } from '../cli/check-budget.js';

it('返工计数按真实事件（fix/outcome=fail|rework），不再只认 action=rework（D-4a）', () => {
  const entries = [
    { runId: 'a', phase: 3, action: 'fix', role: 'S', outcome: 'success' },
    { runId: 'b', phase: 3, action: 'gate', role: 'G', outcome: 'fail' },
    { runId: 'c', phase: 3, action: 'checkpoint', role: 'O', outcome: 'rework' },
    { runId: 'd', phase: 4, action: 'fix', role: 'S', outcome: 'success' },
  ];
  const s = countReworks(entries, 3);
  expect(s.reworkCount).toBe(3);   // a+b+c（phase=3）
});
```

- [ ] **步骤 2：运行验证失败**

预期：FAIL——`countReworks` 未导出且现行只认 `action==='rework'`（得 0）。

- [ ] **步骤 3：最小实现**

```ts
export function countReworks(entries: unknown[], phase: number | undefined): ReworkStats {
  let reworkCount = 0;
  let tlaReworkCount = 0;
  for (const entry of entries) {
    const e = entry as { action?: string; phase?: number; note?: string; target?: string; outcome?: string };
    if (phase !== undefined && e.phase !== phase) continue;
    const isRework = e.action === 'rework'
      || e.action === 'fix' || e.action === 'emergency-fix'
      || e.outcome === 'fail' || e.outcome === 'rework';
    if (!isRework) continue;
    reworkCount++;
    if ((typeof e.note === 'string' && /TLA/i.test(e.note)) || (typeof e.target === 'string' && /TLA/i.test(e.target))) tlaReworkCount++;
  }
  return { reworkCount, tlaReworkCount };
}
```

同步更新该函数与文件头的注释（口径说明）。

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget-logic.test.ts`
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-budget.ts w-model-dev/scripts/__tests__/budget-logic.test.ts
git commit -m "fix(gates): killSwitch 返工计数对齐真实事件（D-4a）
- reworkCount = action∈{rework,fix,emergency-fix} 或 outcome∈{fail,rework} 的条数
- countReworks 导出以供测试"
```

---

## 任务 6：D-4b Σtokens 用量实效校验

**文件：**
- 修改：`w-model-dev/scripts/logic/budget-logic.ts`（新增 R6；扩展 options）
- 修改：`w-model-dev/scripts/cli/check-budget.ts`（统计 tokens 并传入）
- 测试：`w-model-dev/scripts/__tests__/budget-logic.test.ts`（扩展）
- 文档：`w-model-dev/references/data-models.md`（budget 节）

- [ ] **步骤 1：编写失败的测试**

```ts
it('R6：阶段 tokens 超 perPhase.maxTokens → blocking', () => {
  const b = { schemaVersion: '1.0', projectId: 'x', createdAt: T, updatedAt: T,
    perPhase: { maxTokens: 100, maxSubagentSpawns: 10, maxReworkRounds: 3 },
    project: { maxTokensTotal: 1000, maxTokensPerSession: 1000 },
    onExceed: 'pause', killSwitch: { consecutiveReworks: 3, budgetBurnRate: 0.9, tlaReworks: 3 } } as BudgetConfig;
  const r = checkBudget(b, { phase: 1, tokensUsed: { phase: 150, total: 150 } });
  expect(r.passed).toBe(false);
  expect(r.violations.some((v) => /R6.*阶段 tokens 150.*maxTokens 100/.test(v))).toBe(true);
});

it('R6：总量超 project.maxTokensTotal → blocking', () => { /* total 1200 vs 1000 */ });
it('R5-b：阶段消耗 ≥ budgetBurnRate × maxTokens → killSwitch 告警', () => { /* phase 95 vs 0.9×100 */ });
it('未提供 tokensUsed → 不触发 R6/R5-b（向后兼容）', () => { expect(checkBudget(b).passed).toBe(true); });
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget-logic.test.ts`
预期：FAIL——`tokensUsed` 未被识别。

- [ ] **步骤 3：最小实现**

`budget-logic.ts` — options 增 `tokensUsed?: { phase: number; total: number }`；在 R5 之后加入：

```ts
const usage = options?.tokensUsed;
if (usage) {
  const perPhaseMax = b.perPhase?.maxTokens;
  const totalMax = b.project?.maxTokensTotal;
  if (typeof perPhaseMax === 'number' && usage.phase > perPhaseMax) {
    violations.push(`R6：阶段 tokens ${usage.phase} > perPhase.maxTokens ${perPhaseMax}（${(usage.phase / perPhaseMax * 100).toFixed(1)}%）`);
  }
  if (typeof totalMax === 'number' && usage.total > totalMax) {
    violations.push(`R6：总 tokens ${usage.total} > project.maxTokensTotal ${totalMax}（${(usage.total / totalMax * 100).toFixed(1)}%）`);
  }
  if (typeof perPhaseMax === 'number' && typeof ks?.budgetBurnRate === 'number'
      && usage.phase >= ks.budgetBurnRate * perPhaseMax) {
    violations.push(`R5：killSwitch 应触发（阶段消耗占比 ${(usage.phase / perPhaseMax).toFixed(2)} >= budgetBurnRate ${ks.budgetBurnRate}）`);
  }
}
```

`check-budget.ts` — 在既有 `countReworks` 同循环旁新增 `sumTokens(entries, phase)`（`tokens` 为有限非负数才累计），调用 `checkBudget(b, { phase, reworkCount, tlaReworkCount, tokensUsed })`。

- [ ] **步骤 4：运行验证通过 + demo 实测**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/budget-logic.test.ts`
预期：PASS。
demo 实测（应如实报超限，这正是修复目的）：`cd eval/e2e/demo && npx tsx ../../w-model-dev/scripts/cli/check-budget.ts .w-model/budget.json --project=.w-model/project.json --run-log=.w-model/run-log.jsonl --phase=8` → **exit 1** 且输出 R6 超限文案（580M 实耗 vs 当前上限）。记录该输出作为证据。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/budget-logic.ts w-model-dev/scripts/cli/check-budget.ts w-model-dev/scripts/__tests__/budget-logic.test.ts w-model-dev/references/data-models.md
git commit -m "feat(gates): budget 用量实效校验 R6 + burnRate 告警（D-4b）
- Σtokens(phase)/(total) 超上限 → blocking；≥burnRate×max → killSwitch 告警
- 未提供 tokensUsed 时行为不变（向后兼容）"
```

---

## 任务 7：D-1 签名链 targetKind 与返工来源例外

**文件：**
- 修改：`w-model-dev/schemas/signature-chain.schema.json`（加可选 `targetKind`；**先确认 `additionalProperties` 取值**，若为 `false` 则必须加入 `properties` 才不被拒）
- 修改：`w-model-dev/scripts/logic/signature-chain-logic.ts:83-91,339-352`
- 测试：`w-model-dev/scripts/__tests__/signature-chain-logic.test.ts`（扩展）
- 文档：`w-model-dev/references/signature-chain-guide.md` §2/§3

- [ ] **步骤 1：编写失败的测试**

```ts
function entry(over: Partial<ChainEntry>): ChainEntry { /* 构造带正确 sigHash 的单环（可复用既有测试助手） */ }

it('S + fix + 消费 R → 放行（D-1 例外）', () => {
  const r = checkSignatureChain([entry({ role: 'S', action: 'fix', sourceRoles: ['R'] })]);
  expect(r.violations.filter((v) => v.startsWith('R9'))).toEqual([]);
});
it('S + produce + 消费 R → 仍拒（#18 守护）', () => {
  expect(checkSignatureChain([entry({ role: 'S', action: 'produce', sourceRoles: ['R'] })]).violations)
    .toEqual(expect.arrayContaining([expect.stringMatching(/R9.*S.*不得消费 R/)]));
});
it('V + review + targetKind=rootcause + 消费 R → 放行', () => { /* targetKind: 'rootcause' */ });
it('V + review + standard + 消费 R → 仍拒', () => { });
it('R + locate + targetKind=preventive + 消费 S → 放行', () => { });
it('R + locate + rootcause + 消费 S → 仍拒', () => { });
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/signature-chain-logic.test.ts`
预期：FAIL——现行矩阵一律禁；且 `targetKind` 可能被 schema 拒（视 `additionalProperties` 取值）。

- [ ] **步骤 3：最小实现**

schema（`properties` 增）：

```json
"targetKind": {
  "description": "返工链语义分类（D-1）：rootcause=复审 R 报告；preventive=预防性审查（R3）；iceberg=冰山扫掠；standard=默认。用于来源矩阵的例外判定。",
  "enum": ["rootcause", "preventive", "iceberg", "standard"]
}
```

logic（矩阵函数化）：

```ts
function isAllowedSource(role: Role, entry: SignatureChainEntry, srcRole: Role): boolean {
  const forbidden = FORBIDDEN_SOURCE_ROLES[role] ?? [];
  if (!forbidden.includes(srcRole)) return true;
  const tk = entry.targetKind ?? 'standard';
  if (role === 'S' && srcRole === 'R') return entry.action === 'fix' || entry.action === 'emergency-fix';
  if (role === 'V' && srcRole === 'R') return tk === 'rootcause';
  if (role === 'R' && srcRole === 'S') return tk === 'preventive';
  return false;
}
```

R9 循环改为 `if (!isAllowedSource(role, entry, srcRole)) violations.push(...)`；`SignatureChainEntry` 类型加 `targetKind?: string`。

- [ ] **步骤 4：运行验证通过 + demo 回归**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/signature-chain-logic.test.ts`
预期：PASS（6 条新用例 + 既有不回归）。
demo 回归：`cd eval/e2e/demo && npx tsx .../check-signature-chain.ts .w-model/signature-chain.jsonl` → exit 0（既有链无 targetKind，走 standard 路径，行为不变）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/schemas/signature-chain.schema.json w-model-dev/scripts/logic/signature-chain-logic.ts w-model-dev/scripts/__tests__/signature-chain-logic.test.ts w-model-dev/references/signature-chain-guide.md
git commit -m "fix(gates): 签名链返工来源例外（D-1）
- 新增可选 targetKind；矩阵改 role×action×targetKind 三元判定
- 例外：S@fix→R、V@rootcause→R、R@preventive→S；其余仍拒（含负例测试）
- guide §2/§3 同步"
```

---

## 任务 8：D-2 run-log 配对接受 V 重发

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`（`isSuccessfulFix` L284-286；R3 coveredReportIds 扫描 ≈L828-836；R7 `successfulFix` ≈L1124）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`（扩展）
- 文档：`w-model-dev/references/subagent-delegation.md`（V 返回契约）+ `data-models.md`

- [ ] **步骤 1：编写失败的测试**

```ts
it('R3/R7：V 重发记录（review + basedOnReport + V 自有 artifacts）闭合 rootcause 配对（D-2）', () => {
  const entries = [
    rootcauseRecord({ reportId: 'RC-p3-1', phase: 3, round: 1 }),
    reviewRecord({ role: 'V', targetKind: 'rootcause', target: 'RC-p3-1', phase: 3, round: 1 }),   // 复审
    reviewRecord({ role: 'V', phase: 3, round: 1, basedOnReport: 'RC-p3-1',
                   artifacts: ['.w-model/verifier-outputs/phase-3.json'] }),                        // V 重发=修复证据
    gateRecord({ script: 'check-rootcause-report.ts', phase: 3 }),
  ];
  const r = checkRunLog(entries);
  expect(r.violations.filter((v) => /R3: rootcause 报告 RC-p3-1|R7: rootcause 记录 .*successful fix/.test(v))).toEqual([]);
});

it('V 重发缺 basedOnReport → 不充数（负例）', () => { /* 同上删 basedOnReport */ expect(有违规).toBe(true); });
it('V 重发 artifacts 指向非 V 前缀 → 不充数（负例）', () => { /* artifacts: ['src/counter.ts'] */ });
```

- [ ] **步骤 2：运行验证失败**

预期：FAIL——`isSuccessfulFix` 仅认 role=S。

- [ ] **步骤 3：最小实现**

```ts
const V_OWNED_PREFIXES = ['.w-model/verifier-outputs/', '.w-model/v-reviews/', '.w-model/preventive-reviews/'];

/** D-2：V 以其自有产物重发被修报告，等价于一次修复记录。 */
function isVRepairRecord(entry: RunLogEntry): boolean {
  if (entry.action !== 'review' || entry.role !== 'V' || entry.outcome !== 'success') return false;
  if (!isNonEmptyString(entry.basedOnReport)) return false;
  const arts = entry.artifacts;
  return Array.isArray(arts) && arts.length > 0
    && arts.every((a) => typeof a === 'string' && V_OWNED_PREFIXES.some((p) => a.startsWith(p)));
}

function isSuccessfulRepair(entry: RunLogEntry): boolean {
  return isSuccessfulFix(entry) || isVRepairRecord(entry);
}
```

- R3 `coveredReportIds` 扫描的 `fixActions` 循环改扫 `valid.filter(isSuccessfulRepair)`（保留原 phase/`basedOnReport` 拆分逻辑）；
- R7 的 `const successfulFix = valid.slice(j + 1).find(isSuccessfulFix)` → `find(isSuccessfulRepair)`；
- 严格分支（phase 8 的 exact 谓词）**不改**（保持严格身份语义）。

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
预期：PASS（3 条新用例 + 既有不回归）。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/references/subagent-delegation.md w-model-dev/references/data-models.md
git commit -m "fix(gates): R3/R7 配对接受 V 重发记录（D-2）
- review+role=V+basedOnReport+V 自有 artifacts 视为修复证据
- 负例：缺 basedOnReport 或 artifacts 非 V 前缀不充数"
```

---

## 任务 9：文档与登记同步批（D-8 + 全部修复的文档面）

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`（§7.9 签名链、§10D run-log/budget、§10.7 布局校验说明）
- 修改：`w-model-dev/references/command-reference.md`（D-8：`--spec-dir` 说明 + 两态门期望已在任务 4）
- 修改：`CHANGELOG.md`（新增条目，遵循既有格式）
- 修改：`AGENTS.md`（若计数句受影响：脚本数/反模式数不变则仅确认）

- [ ] **步骤 1：SSoT 三处更新**（§7.9 加 targetKind 与例外表；§10D 加 R6/配对谓词；§10.7 加 `--spec-dir` 激活条件一句）
- [ ] **步骤 2：command-reference 补 `--spec-dir` 语义**（引用 `gate-logic.ts:1444` 激活条件）

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（若报计数不符，按提示同步 AGENTS/README/SKILL 计数句）

- [ ] **步骤 3：CHANGELOG 条目**（格式对齐既有 `fix(gates): …` 段落，列出 D-1~D-8 与验证）

- [ ] **步骤 4：Commit**

```bash
git add docs/skill-design-document_SSoT.md w-model-dev/references/command-reference.md CHANGELOG.md AGENTS.md
git commit -m "docs: SSoT/command-reference/CHANGELOG 同步门禁修复（D-1~D-8）"
```

---

## 任务 10：端到端验收（移除绕过物 + 全量门禁）

**文件：** 无新文件；对 `eval/e2e/demo` 与仓库执行验收。

- [ ] **步骤 1：移除 demo 绕过物**

```bash
cd eval/e2e/demo
cmd //c "if exist .w-model\tla rmdir .w-model\tla"     # D-3 的 junction 绕过物
```

- [ ] **步骤 2：重跑受影响门禁（全绿判据）**

```bash
CLI=../../w-model-dev/scripts/cli
npx tsx $CLI/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src   # D-3：junction 已删仍 exit 0
npx tsx $CLI/check-run-log.ts .w-model/run-log.jsonl            # D-2/D-5/D-6：exit 0
npx tsx $CLI/check-checkpoint.ts .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log   # D-5：exit 0
npx tsx $CLI/check-signature-chain.ts .w-model/signature-chain.jsonl   # D-1：exit 0（standard 路径回归）
npx tsx $CLI/check-opsx-artifacts.ts . --phase=8 --scope=.w-model/change-scope.p8.json && npx tsx $CLI/check-openspec-archive.ts . --phase=8 --scope=.w-model/change-scope.p8.json   # D-7：两门同时 exit 0
npx tsx $CLI/check-artifact-gate.ts . --phase=8 --scope=.w-model/change-scope.p8.json   # 终检回归 exit 0
```

预期：全部 exit 0。D-4b 的 demo 预期红（580M 实耗如实报超限）已在任务 6 记录为**预期行为**，不计入本步骤失败。

- [ ] **步骤 3：签名链新形态重放（D-1 端到端）**

在 demo 复制一份 `signature-chain.jsonl` 片段，为一条 S:fix 环加 `targetKind`（若适用）与 R 来源，跑 `check-signature-chain.ts` 预期 exit 0；将步骤 2/3 的逐命令输出（含命令、退出码）汇入 `docs/debug/2026-09-20-wm-8phase-live-run/gate-fix-replay.txt`。

> **必须用 `.txt` 而非 `.log`**：`.gitignore` 有全局 `*.log` 规则，`.log` 会被静默忽略（`git add` 直接拒绝），证据无法入库。

- [ ] **步骤 4：仓库全量验收**

```bash
npm run self-test        # 358 样本基线
npm run prepush          # 19 项（含全量 vitest / 覆盖率 / security-scan / docs-consistency / samples 矩阵）
```

预期：两者 exit 0。

- [ ] **步骤 5：Commit（验收记录）**

```bash
git add docs/debug/2026-09-20-wm-8phase-live-run/gate-fix-replay.txt
git commit -m "test(acceptance): 门禁修复端到端复验记录（移除绕过物后全绿）"
```

---

## 自检记录（编写者执行）

**1. 规格覆盖度：** §1→任务 7；§2→任务 8；§3→任务 1；§4→任务 5+6；§5→任务 2；§6→任务 3；§7→任务 4；§8→任务 9；§9 验收→任务 1/2/3/4/6/7/8 各自步骤 + 任务 10。无遗漏。
**2. 占位符扫描：** 无"待定/TODO"；所有代码步骤含可粘贴代码；测试步骤含具体用例与期望。
**3. 类型一致性：** `loadTlaContents`/`isLegacyAbsorbableEntry`/`countReworks`/`isAllowedSource`/`isSuccessfulRepair`/`V_OWNED_PREFIXES` 在定义任务与使用任务中同名同签名；`checkBudget` 的 `tokensUsed` 形状在任务 5/6 间一致。
