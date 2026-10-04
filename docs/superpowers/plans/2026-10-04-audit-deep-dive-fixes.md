# 深度审计问题全量修复实现计划（2026-10-04）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复规格 [2026-10-04-audit-deep-dive-fixes-design.md](../specs/2026-10-04-audit-deep-dive-fixes-design.md) 登记的全部 41 项问题（C1-C21 / D1-D16 / N1-N4），逐问题 commit + 定向验证，一次全量 prepush 收口，版本 42.13.0。

**架构：** 三阶段代码修复（高危 → 域聚类 → 独立小项）→ 文档对齐（SSoT 先行分流）→ 收口（版本/CHANGELOG/全量验证）。零新增 CLI、零新增 schema、零新增 devDeps；公开 API 与 violation 顺序冻结（C4 重构安全网）。

**技术栈：** TypeScript（ES2022 strict + noUncheckedIndexedAccess）、tsx runtime、vitest ^4.1（配置在 `config/vitest.config.ts`，子进程类测试文件须登记 `SUBPROCESS_TEST_FILES`）、Node ≥20；prepush 用 Git Bash 执行。

**执行环境注意：**

- 所有命令在仓库根 `D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack` 执行（Git Bash）。
- 文中「搜索锚」= 在指定文件中 grep 的唯一匹配串；行号来自 2026-10-04 HEAD=2d94e1b5 的审计，若有偏移以搜索锚定位。
- 每个任务以 commit 结束；commit message 模板中 `(<ID>)` 引用规格登记表 ID。
- 与规格的**已批准偏差**（1 处）：C21 的 `if (arg === undefined)` 在 noUncheckedIndexedAccess 下类型承重，处置由「删死代码」调整为「保留守卫 + 注释说明类型承重 + 契约测试锁定值吞噬语义」（理由：删除需引入非空断言或改循环结构，收益为负）。

---

## 文件结构

**修改的代码文件（10）：**

| 文件                                                                                                               | 职责                                        | 任务           |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | -------------- |
| `w-model-dev/scripts/lib/run-main.ts`                                                                              | CLI 统一入口（删 VITEST 旁路）              | 任务 1         |
| `w-model-dev/scripts/cli/*.ts`（~28 个裸守卫文件）                                                                 | 尾部守卫统一为 isDirectInvocation           | 任务 1         |
| `w-model-dev/scripts/lib/is-main.ts`                                                                               | 头注与事实对齐                              | 任务 1         |
| `w-model-dev/scripts/logic/state-write-logic.ts`                                                                   | 锁 metadata 原子化 + stale 三态             | 任务 2         |
| `w-model-dev/scripts/logic/run-log-logic.ts`                                                                       | 944 行拆分 + C5/C6/C9/C15 + C2 注释         | 任务 3         |
| `w-model-dev/scripts/logic/verifier-logic.ts`                                                                      | Windows 路径正则 + Ajv 结构化 + 长度降噪    | 任务 4         |
| `w-model-dev/scripts/logic/checkpoint-logic.ts`                                                                    | action 常量同源                             | 任务 5         |
| `w-model-dev/scripts/cli/check-checkpoint.ts`                                                                      | 死代码清理 + 歧义 fail-closed + loader 收窄 | 任务 5         |
| `w-model-dev/scripts/cli/check-preventive-review.ts`                                                               | missing/unreadable 区分                     | 任务 8         |
| `w-model-dev/scripts/lib/parse-phase.ts` / `lib/cli-error.ts` / `cli/wm-write.ts` / `logic/iceberg-sweep-logic.ts` | 小项（C21/C19/C12/C20）                     | 任务 6/7/10/11 |

**新增测试（并入既有测试文件，原则上不新建文件；新建子进程类测试文件须同步登记 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES`）：** `__tests__/run-log-logic.test.ts`、`state-write-logic.test.ts`、`verifier-logic.test.ts`、`checkpoint-logic.test.ts`、`parse-phase.test.ts`、`cli-error.test.ts`；新建 `__tests__/cli-entry-guard.test.ts`（纯源码断言，无子进程，不登记）。

**修改的文档（~18）+ schemas（2）+ fixtures：** 见各任务；SSoT 分流任务先改 `docs/skill-design-document_SSoT.md`。

---

## 阶段 0：准备

### 任务 0：创建集成分支

- [ ] **步骤 1：从 main 创建分支**

```bash
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b fix/audit-deep-dive-findings
git log --oneline -1   # 预期：8c90dfdc docs(spec): ...（或其后代）
```

---

## 阶段 1：高危代码

### 任务 1（C1+C7）：消除 VITEST 全局旁路，统一入口守卫

**文件：**

- 修改：`w-model-dev/scripts/lib/run-main.ts`（删 L13-18 注释与 `if (process.env.VITEST) return;`）
- 修改：`w-model-dev/scripts/cli/` 下全部「含 `runMain(main)` 但不含 `isDirectInvocation`」的文件（~28 个，以 grep 实测为准）
- 修改：`w-model-dev/scripts/lib/is-main.ts`（头注）
- 创建：`w-model-dev/scripts/__tests__/cli-entry-guard.test.ts`
- 测试：并入既有子进程测试（见步骤 5）

- [ ] **步骤 1：生成迁移清单（计入 commit message）**

```bash
cd w-model-dev/scripts
grep -rln "runMain(main)" cli/ | xargs grep -L "isDirectInvocation" | tee /tmp/bare-runmain.txt | wc -l
```

预期：约 28 个文件（46 个含 `runMain(main)` 减 18 个已带守卫）。

- [ ] **步骤 2：逐文件迁移尾部守卫**

对清单中每个 `cli/<name>.ts`：查看任一已带守卫文件的写法作模板——

```bash
grep -n -B2 -A2 "isDirectInvocation" cli/check-bdd-model.ts   # 取一个实际守卫文件作模板（若该文件无守卫则从 grep -rln isDirectInvocation cli/ 任选）
```

统一改为（import 路径与模板文件一致，通常 `../lib/is-main.js`）：

```ts
import { isDirectInvocation } from "../lib/is-main.js";
// ... 文件尾：
if (isDirectInvocation(import.meta.url)) runMain(main);
```

删除原裸 `runMain(main);` 行。

- [ ] **步骤 3：删除 run-main.ts 的 VITEST 判断**

删除 `lib/run-main.ts` 中 L13-18（注释块「Wave 2 进程内调用层…既定权衡」四行 + `if (process.env.VITEST) return;`），`runMain` 主体只保留 `main().catch(...)`。

- [ ] **步骤 4：新建守卫测试（纯源码断言，无子进程）**

创建 `__tests__/cli-entry-guard.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS = join(__dirname, "..");

describe("CLI 入口守卫（C1/C7）", () => {
  it("lib 层禁止 process.env.VITEST 判断（防环境旁路）", () => {
    const runMain = readFileSync(join(SCRIPTS, "lib/run-main.ts"), "utf-8");
    expect(runMain).not.toContain("process.env.VITEST");
  });

  it("每个调用 runMain(main) 的 cli 文件必须带 isDirectInvocation 守卫", () => {
    const cliDir = join(SCRIPTS, "cli");
    const offenders: string[] = [];
    for (const f of readdirSync(cliDir)) {
      if (!f.endsWith(".ts")) continue;
      const src = readFileSync(join(cliDir, f), "utf-8");
      if (src.includes("runMain(main)") && !src.includes("isDirectInvocation"))
        offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **步骤 5：子进程反证测试（VITEST=1 不旁路）**

先查子进程测试登记表：`grep -n "SUBPROCESS_TEST_FILES" -A 50 ../../../config/vitest.config.ts | head -60`。向其中**任一已登记**的子进程测试文件（优先 `checkpoint-r0-bootstrap-cli.test.ts`，它已会 spawn CLI）追加用例（沿用该文件既有的 spawn helper 形态）：

```ts
it("VITEST=1 环境下 CLI 必须正常执行而非静默 exit 0（C1 反证）", async () => {
  // 沿用本文件既有 spawnCLI/runner helper；对任意轻量 CLI（如 wm-status.ts 的 --help 或 doctor.ts）
  // 以 env: { ...process.env, VITEST: '1' } 启动子进程
  // 断言：stdout 非空 或 退出码 ≠ 0（即 main 真实执行了）；严禁断言「exit 0 且无输出」
});
```

（helper 名称以该测试文件实际为准；断言目标是「有输出/有行为」，杜绝静默通过。）

- [ ] **步骤 6：定向验证**

```bash
cd <仓库根>
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/cli-entry-guard.test.ts
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/is-main.test.ts
npm run self-test --silent 2>&1 | tail -5   # self-test 覆盖全部 CLI 三态，验证迁移未破坏子进程执行
```

预期：全绿；self-test 用例计数与运行前一致。

- [ ] **步骤 7：is-main.ts 头注对齐（C7）**

搜索锚 `统一写法`：将头注中「各 cli/_.ts 尾部守卫统一写法…」改为反映现状：「全部调用 `runMain(main)` 的 cli/_.ts 尾部守卫统一为 `if (isDirectInvocation(import.meta.url)) runMain(main)`（由 `__tests__/cli-entry-guard.test.ts` 强制）；无环境变量旁路。」

- [ ] **步骤 8：Commit**

```bash
git add -A && git commit -m "fix(cli): 消除 VITEST 环境旁路，48 个 CLI 入口守卫统一 isDirectInvocation（C1/C7，迁移 N=28 以 grep 实录）"
```

### 任务 2（C3+C8）：锁竞争窗口修复 + 单主机声明

**文件：**

- 修改：`w-model-dev/scripts/logic/state-write-logic.ts`
- 修改：`w-model-dev/scripts/cli/wm-write.ts`（头注）
- 测试：`w-model-dev/scripts/__tests__/state-write-logic.test.ts`（沿用其既有目录构造/清理 helper）

- [ ] **步骤 1：读现状定锚**

```bash
grep -n "staleOwnerState\|metadataPathFor\|ownerPathFor\|METADATA\|lockTimeoutMs" w-model-dev/scripts/logic/state-write-logic.ts | head -20
```

- [ ] **步骤 2：编写失败测试（三个新用例，追加到 state-write-logic.test.ts，沿用既有 helper 命名）**

```ts
describe("C3 锁竞争窗口", () => {
  it("并发双写者：零误判 STALE_LOCK，串行成功", async () => {
    // temp 目标文件；两次 stateWrite/acquireLock 并发 Promise.all
    // 断言：两次最终均成功（先后完成），无 'STALE_LOCK' 返回/抛出
  });
  it("owner 目录在但 metadata 缺失且新鲜（<10s）：走 busy 重试而非 stale", async () => {
    // 按 ownerPathFor/metadataPathFor 派生路径，手工 mkdir ownerDir 不写 metadata
    // 立即 acquireLock：断言结果 ≠ 'STALE_LOCK'（等待重试路径）
  });
  it("owner 目录在、metadata 缺失且目录 mtime 超 10s：走孤儿回收（recoverable）", async () => {
    // 手工 mkdir ownerDir 后 utimes 把目录 mtime 设为 11s 前
    // 断言：acquireLock 回收该目录并成功获得锁
  });
});
```

（断言目标固定；helper/函数名以该测试文件与 logic 导出面实测为准，不新造 API。）

- [ ] **步骤 3：运行验证失败**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
```

预期：新用例 FAIL（现状返回 STALE_LOCK / 死等）。

- [ ] **步骤 4：实现**

1. 常量 `const METADATA_GRACE_MS = 10_000;`（模块级，注释：mkdir 与 metadata 落位间的竞争宽限）。
2. `acquireLock` 中 `await fs.mkdir(ownerDir)` 成功后：metadata 改写 `${ownerDir}/metadata.json.tmp-${randomUUID()}` 再 `fs.rename` 至 `metadataPathFor(ownerDir)`；rename 遇 `EEXIST`（异常竞争）→ 视为竞争，sleep(10) 后 `continue` 外层 while。
3. `staleOwnerState` 增加 `'busy'` 返回态：owner 目录存在、metadata 不可读、且无 transition 时——`Date.now() - stat(ownerDir).mtimeMs < METADATA_GRACE_MS` → `'busy'`；否则维持既有孤儿回收 `'recoverable'` 路径；metadata 可读且 PID 死亡 + TTL 超限 → 既有 `'stale'`。
4. `acquireLock` 的 EEXIST 分支与 `recoverOrphanTransitions` 消费处：`'busy'` → `sleep(10); continue;`（不返回 STALE_LOCK）。
5. `isPidRunning` 上方补注释：「单主机语义：`process.kill(pid,0)` 仅在本机有效；`.w-model` 不得置于网络文件系统（见 wm-write.ts 头注）」。

- [ ] **步骤 5：运行验证通过**（同步骤 3 命令，预期全绿）

- [ ] **步骤 6：单主机声明（C8 文档面）**

- `cli/wm-write.ts` 头注加一行：「锁为**单主机**语义：跨进程（本机）安全；`.w-model` 置于网络盘/共享卷时 PID 判定失效，禁止此部署形态。」
- `w-model-dev/references/command-reference.md`：搜索锚 `wm-write.ts` 条目（「状态写锁协议」相关节），补同一句。
- `w-model-dev/references/data-models.md`：搜索锚 `run-log` 或状态文件节的目录约定处，补「`.w-model` 必须位于本机文件系统」。

- [ ] **步骤 7：Commit**

```bash
git add -A && git commit -m "fix(state-write): 锁 metadata 原子化+stale 三态化，消除并发误判 STALE_LOCK；声明单主机语义（C3/C8）"
```

### 任务 3（C4/C5/C6/C9/C15 + C2 代码注释）：run-log-logic 拆分与治理

**文件：**

- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`（仅本文件 + 测试；violation 顺序与公开 API 冻结）
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`（沿用既有 entry 构造形态）

- [ ] **步骤 1：编写失败测试（两个新用例）**

```ts
describe("C9 R7 时间戳不可解析 fail-closed", () => {
  it("相邻行 timestamp 非法（Date.parse NaN）→ blocking violation，而非静默跳过", () => {
    // 构造两条相邻记录，后一条 timestamp: "not-a-date"
    // 断言：violations 中出现 R7 前缀的 blocking 项（含不可解析说明）
  });
});
describe("C15 R5 越权检测形态补全", () => {
  it.each([
    "node -e \"require('fs').appendFileSync('.w-model/rtm.json','x')\"",
    "fs.promises.writeFile('.w-model/rtm.json', 'x')",
    "node --eval=...",
  ])("检测 %s 形态", (cmd) => {
    // 构造含该 command 的记录 → 断言命中 R5 越权 violation
  });
});
```

- [ ] **步骤 2：运行验证失败**（`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`；预期新用例 FAIL）

- [ ] **步骤 3：原位拆分（C4，纯机械移动，公开 API/顺序不变）**

在 `run-log-logic.ts` 内将 `checkRunLog` 的规则段提取为同模块函数（签名中 `Violation[]` 以模块实际 violation 元素类型为准）：

```ts
function checkGateLogCrossReference(
  valid: RunLogEntry[],
  options: CheckRunLogOptions,
): Violation[]; // R6 段整体
function checkTimestampOrdering(valid: RunLogEntry[]): Violation[]; // R7 段整体
function checkTrajectoryTemplate(valid: RunLogEntry[]): Violation[]; // R8 段整体
function checkRevertEvidence(valid: RunLogEntry[]): Violation[]; // R10 段整体
function checkClosureReleases(valid: RunLogEntry[]): Violation[]; // R11 段整体（返回 closureReleases/missing 计数所需结构，见下）
```

`checkRunLog` 变为编排器：按原执行顺序依次调用并展平 violations；R11 因依赖 `releaseTimes` 预计算，函数内自算。**提取时逐段搬移原代码，不改任何判定与 push 顺序。**

- [ ] **步骤 4：C5/C6/C9/C15 实现**

1. C5：删除 `checkRunLog` 内 L1231 附近的局部 `const GATE_ACTIONS`（搜索锚：函数内第二个 `GATE_ACTIONS`），全文件统一用模块级 L542 那份。
2. C6：把 `isLegacyAbsorbableEntry`（L517-530）内部的排除条件提取为模块级常量（如 `const LEGACY_ABSORB_EXCLUSIONS = [...]`），`otherMessages` 过滤段（L629-651）改为消费同一常量；两处判定输出不变。
3. C9：`checkTimestampOrdering` 内两侧时间戳统一经 `recordTimestampMs` 解析；任一侧 NaN → push blocking violation（措辞：`R7: 记录 <runId> 时间戳不可解析（<raw>），时序校验 fail-closed`），不比较。
4. C15：R5 检测正则数组（L1075-1080）追加四类形态：`appendFileSync`、`fs.promises.writeFile` / `fsPromises.writeFile`、`--eval=`、`python -c`；数组上方注释保持「启发式检测信号，非安全边界」。

- [ ] **步骤 5：C2 代码注释口径修订（实现不动）**

三处注释（L53-56 摘要区、L1461-1470 R11 段头、以及 `RUN_LOG_CLOSURE_SCRIPTS` 附近相关句）将「同秒内先后不可判定，故同秒不算『早于放行』」改为：「比较为毫秒精度：gate 时间戳须**严格毫秒早于**放行记录才充数；同毫秒（含无毫秒部分的秒级时间戳）不算早于。官方追加器强制毫秒递增，毫秒序为真实信息（DEC-3）。」同步 L1127 注释「单调递增」→「非递减（允许相等）」（C13 的 run-log 侧，随本 commit）。

- [ ] **步骤 6：运行验证通过 + fixture 审计**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts
grep -rn "same-second\|同秒" w-model-dev/scripts/samples/run-log/ w-model-dev/scripts/__tests__/run-log-logic.test.ts | head
```

预期：测试全绿；若 fixtures 存在「同秒不同毫秒且依赖不算数」的样本（预期无），按毫秒口径修正并记录。

- [ ] **步骤 7：Commit**

```bash
git add -A && git commit -m "refactor(run-log): checkRunLog 944 行拆分五规则函数；GATE_ACTIONS 单源；D-5 拷贝合一；R7 不可解析 fail-closed；R5 形态补全；R11 口径注释对齐毫秒（C2/C4/C5/C6/C9/C13部分/C15）"
```

---

## 阶段 2：其余代码

### 任务 4（C11/C16/C17）：verifier 域（同文件聚类 commit）

**文件：**

- 修改：`w-model-dev/scripts/logic/verifier-logic.ts`
- fixtures：`w-model-dev/scripts/samples/verifier/`（增补 Windows 路径正例）
- 测试：`w-model-dev/scripts/__tests__/verifier-logic.test.ts`

- [ ] **步骤 1：失败测试**

```ts
describe("C11 Windows 路径 evidence", () => {
  it.each(["src\\utils\\a.ts:L12=...", "D:\\proj\\x.ts:L1-L5=..."])(
    "%s 应通过 evidence 格式校验",
    (ev) => {
      // 构造含该 evidence 的 VerifierOutput 走 R12/evidence 格式判据 → 断言无格式 violation
    },
  );
});
describe("C16 Ajv 结构化字段优先", () => {
  it("instancePath/params.missingProperty 可用时不再依赖文案正则", () => {
    // 以合成 ajv 错误对象（含 instancePath:'/gateExitCode'、params.missingProperty）驱动
    // 断言提取结果来自结构化字段；无结构化字段时回退旧正则
  });
});
describe("C17 长度不符降噪", () => {
  it("subCriteria 长度不符时只报一条长度 violation，不叠加错位比对", () => {
    // expected 3 条、实际 2 条 → 断言 violations 恰含 1 条长度不符项，无逐项错位项
  });
});
```

- [ ] **步骤 2：运行验证失败**

- [ ] **步骤 3：实现**

1. C11：`EVIDENCE_PATTERN`（L401）路径段字符集 `[\w/.-]` 扩为 `[\w/.\-\\]`，并允许盘符前缀（`(?:[A-Za-z]:)?` 形态并入路径首）；R12 的 L247 分支做同构扩展。核对正则不引入回溯灾难（路径段无嵌套量词）。
2. C16：新增 helper `ajvErrorSubject(err: {instancePath?: string; params?: {missingProperty?: string}}): string | undefined`；`isLegacySchemaFailure`（run-log-logic L439-452——本项仅 verifier 侧的 `schemaErrorSubject` L178-182；run-log 侧同名问题已在任务 3 C6 上下文中不动，若判定需同步则在 commit message 注明）与 `schemaErrorSubject` 优先消费结构化字段，undefined 再走现有正则。
3. C17：`expected` 与 `subCriteria` 长度不等时：push 单条 `subCriteria 数量不符（expected N, got M）` 后 `return`，不再进入按下标比对循环。

- [ ] **步骤 4：fixtures 增补**：`samples/verifier/` 内任一 valid JSON 的 evidence 字段追加一个 Windows 形态样本文件（复制最近 valid-* 文件改 evidence 为 `src\mod\a.ts:L3=...`；命名 `valid-windows-evidence.json`）。

- [ ] **步骤 5：运行验证通过 + 样本门禁**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid-windows-evidence.json   # 预期 exit 0
```

注意：`samples/` 覆盖矩阵要求新 fixture 被引用——检查 `self-test.ts` 用例数组是否须登记（搜索锚 `valid-` 在 `cli/self-test.ts` 的 verifier 段），需要则登记。

- [ ] **步骤 6：Commit**

```bash
git add -A && git commit -m "fix(verifier): evidence/R12 路径正则支持 Windows 盘符与反斜杠；Ajv 错误结构化字段优先；长度不符单条降噪（C11/C16/C17）"
```

### 任务 5（C10/C14/D3）：checkpoint 域 + canonical 形态

**文件：**

- 修改：`w-model-dev/scripts/logic/checkpoint-logic.ts`、`w-model-dev/scripts/cli/check-checkpoint.ts`
- 修改：`w-model-dev/references/data-models.md`、`w-model-dev/schemas/checkpoint-log.schema.json`（仅 description）
- 测试：`w-model-dev/scripts/__tests__/checkpoint-logic.test.ts`、`checkpoint-r0-bootstrap-cli.test.ts`

- [ ] **步骤 1：失败测试**

```ts
describe("C10 action 枚举同源", () => {
  it("RUN_LOG_ACTION_VALUES 与 run-log.schema.json 的 action 枚举 set 相等", async () => {
    const schema = JSON.parse(
      readFileSync(join(SCRIPTS, "../schemas/run-log.schema.json"), "utf-8"),
    );
    const schemaEnum: string[] = schema.properties.action.enum;
    expect(new Set(RUN_LOG_ACTION_VALUES)).toEqual(new Set(schemaEnum));
  });
});
```

（`RUN_LOG_ACTION_VALUES` 为 checkpoint-logic 新导出；测试内 import 它。）另在 CLI 侧子进程测试加「同 phase 双文件歧义 → exit 1 且 stderr 列出两路径」用例。

- [ ] **步骤 2：实现**

1. C10：checkpoint-logic.ts 顶部将自包含 `RunLogEntry['action']` 联合改为 `export const RUN_LOG_ACTION_VALUES = ['gate','checkpoint','note','rootcause','fix','emergency-fix','ingest','opsx_deploy', /* …以 run-log.schema.json enum 实测全集为准 */] as const;`，`action: (typeof RUN_LOG_ACTION_VALUES)[number]`；注释「与 run-log.schema.json action 枚举保持同步（set 相等测试强制）」。
2. C14：`cli/check-checkpoint.ts` L91-106：删除 `parseInt`+`isNaN` 死代码与恒真 `if (phase)`；loader 收窄为仅接受 `phase-<N>.md`（现状若接受 `phase-N.txt`/`N.txt` 一并移除）；同 phase 出现多个候选文件 → `exitWithError({category:'ARG_INVALID'→改为校验失败语义, exitCode:1})` 输出两冲突路径（fail-closed）；`parseInt(phaseStr)` 死分支删除后以正则 `/^phase-(\d+)\.md$/` 提取 N。
3. D3 文档：`data-models.md` 搜索锚 `checkpoint-log`（L1014 附近）「暂未集成到 logic.ts validateBySchema」注记改为：「checkpoint-log 为 `.w-model/checkpoint-log/phase-<N>.md` 纯文本（UTF-8，用户确认原文 + 时间与放行对象要素）；schema 为结构参考，机器校验走 check-checkpoint R1-R5 文本判据（canonical 形态与歧义 fail-closed 自 42.13.0 起）」；`schemas/checkpoint-log.schema.json` 中 `gateLogPath` 的 description（N2 在任务 29 处理，此处不动 description，只加一行形态说明到 `$id` 邻近 description 若有）。

- [ ] **步骤 3：fixtures**：`samples/checkpoint-log/`（若存在；否则在 samples/run-log/ 相邻域）按 loader 现有 fixture 位置补 `valid-phase-1.md`（含具体技术决策确认原文）与 `bad-ambiguous-phase-1/`（`phase-1.md`+`phase-1.txt` 双文件）样本，并按覆盖矩阵登记 `self-test.ts`。

- [ ] **步骤 4：定向验证**（checkpoint 两个测试文件 + `npx tsx cli/check-checkpoint.ts <run-log样本> --checkpoint-log=<dir>` 正反例各一次）

- [ ] **步骤 5：Commit**

```bash
git add -A && git commit -m "fix(checkpoint): action 枚举与 schema 同源（set 相等测试）；loader canonical 化+歧义 fail-closed；data-models 定稿 phase-N.md 形态（C10/C14/D3）"
```

### 任务 6（C21）：parse-phase 类型承重注释 + 值吞噬契约测试

**文件：** `w-model-dev/scripts/lib/parse-phase.ts`、`__tests__/parse-phase.test.ts`

- [ ] **步骤 1：失败测试**（追加到 parse-phase.test.ts）

```ts
describe("C21 --phase 值吞噬契约", () => {
  it("--phase 后跟 flag 形态时解析结果为 undefined 且不抛错（phaseFlagPresent 由调用方 gate）", () => {
    expect(parsePhaseArgs(["--phase", "--json"])).toMatchObject({
      phaseFlagPresent: true,
      phase: undefined,
    });
  });
  it("--phase=4 正常解析", () => {
    expect(parsePhaseArgs(["--phase=4"]).phase).toBe(4);
  });
});
```

（导出函数名以 parse-phase.ts 实际导出面为准；若 `phaseFlagPresent` 不在返回值，测「返回 undefined 且不抛」。）

- [ ] **步骤 2：实现**：`if (arg === undefined) continue;` 上方补注释：「noUncheckedIndexedAccess 下 argv[i] 类型为 string|undefined，本守卫为类型承重（运行时 argv 元素非 undefined）；值吞噬契约见下方 --phase 分支与 parse-phase.test.ts C21 用例。」**不删守卫**（已批准偏差）。

- [ ] **步骤 3：验证 + Commit**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/parse-phase.test.ts` 全绿后 `git commit -m "test(parse-phase): 锁定 --phase 值吞噬契约；注明 undefined 守卫类型承重（C21，与规格偏差已批准）"`

### 任务 7（C19）：cli-error exitCode 类型收窄

**文件：** `w-model-dev/scripts/lib/cli-error.ts`、`__tests__/cli-error.test.ts`

- [ ] **步骤 1：核实**：`grep -rn "exitWithError(" w-model-dev/scripts --include="*.ts" | grep -v "exitCode: 2"` → 预期空（已实测 16 处全为 2）。
- [ ] **步骤 2：实现**：`exitCode: 0 | 1 | 2` → `exitCode: 2`；`ExitCodeJson` 等 Record 类型处联动；注释「当前所有调用均为 exit 2（ARG_INVALID/UNEXPECTED）」保持。
- [ ] **步骤 3：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/cli-error.test.ts` + `npm run --silent typecheck` 全绿。
- [ ] **步骤 4：Commit**：`fix(cli-error): exitCode 类型收窄为字面量 2（C19）`

### 任务 8（C18）：preventive-review missing/unreadable 区分

**文件：** `w-model-dev/scripts/cli/check-preventive-review.ts`

- [ ] **步骤 1：读现状**：定位读取三份报告 JSON 的段落（`readFileSync`/JSON.parse 包裹处）。
- [ ] **步骤 2：实现**：读文件异常分类——`ENOENT` → violation 前缀 `R3_MISSING`（报告未产出）；解析失败/其他读错 → 前缀 `R3_UNREADABLE`（已产出但不可读，附 err.message）；logic 层判据不动。
- [ ] **步骤 3：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/preventive-review-logic.test.ts`；手动 `npx tsx cli/check-preventive-review.ts samples/preventive-review/bad-missing-completeness.json 类样本`（以实际样本路径）看前缀区分。
- [ ] **步骤 4：Commit**：`fix(preventive-review): 区分报告缺失与不可读两类 violation 前缀（C18）`

### 任务 9（C20）：iceberg R8 跳过段核实与注释

**文件：** `w-model-dev/scripts/logic/iceberg-sweep-logic.ts`（L368-378 附近）

- [ ] **步骤 1：核实**：读该段，确认「`disagreements.length > 0` 时跳过收敛集检查」语义——若因 R6 已红而冗余（预判如此）：仅补注释「R6 未对账差异已 blocking，此处跳过收敛集检查避免二次误报叠加；R6 清零后本检查生效」；若核实为逻辑遗漏（跳过导致漏检）：改为继续执行覆盖检查并在 commit message 标注升级理由。
- [ ] **步骤 2：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/iceberg-logic.test.ts` 全绿。
- [ ] **步骤 3：Commit**：`docs(iceberg): R8 跳过段语义注释（C20）`（或 `fix(...)` 若升级）

### 任务 10（C12）：wm-write 数值 flag 宽严差异澄清

**文件：** `w-model-dev/scripts/cli/wm-write.ts`、`w-model-dev/references/command-reference.md`

- [ ] **步骤 1：注释**：`--expect-mtime` 解析处（L99-111）补：「有意宽于 --lock-timeout：调用方常直接字符串化 `stat.mtimeMs`（浮点毫秒），有限非负 + floor 语义正确；--lock-timeout 为纯整数语义故严格 `/^\d+$/`。」
- [ ] **步骤 2：文档**：command-reference 的 `wm-write.ts` 条目补同一说明一句。
- [ ] **步骤 3：验证 + Commit**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts` 全绿后 `docs(wm-write): 数值 flag 宽严差异理由说明（C12）`

### 任务 11（C13）：两处注释与行为对齐

**文件：** `w-model-dev/scripts/logic/checkpoint-logic.ts`（L186 附近）

- [ ] **步骤 1：实现**：搜索锚 `缺失必需字段则跳过`（checkpoint-logic L186 注释）改为「缺失必需字段则记 violation 并继续（非跳过）」；run-log 侧 L1127 已随任务 3 处理（本任务核对无遗漏）。
- [ ] **步骤 2：验证 + Commit**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/checkpoint-logic.test.ts` 全绿后 `docs(checkpoint): L186 注释与行为对齐（C13，run-log 侧已在任务 3 完成）`

---

## 阶段 3：文档对齐（C2 文档面 + D 系列 + N 系列）

> SSoT 先行分流：任务 12/13/22/28/31（涉 SSoT §10C/§10B/ingestion 节/§10K/§10O）先改 SSoT 对应节，同 commit 内再改 `w-model-dev/` 资产与根文档。每任务后跑 `npm run eval` 与 docs-consistency 相关 vitest（`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`）。

### 任务 12（C2 文档面）：R11 口径全量同步

**文件（7）：** `docs/skill-design-document_SSoT.md`（§10C，搜索锚 `同秒`）、`w-model-dev/SKILL.md`（L88/L99 两处「同秒不算」）、`AGENTS.md`（run-log 条目「同秒不算早于」）、`w-model-dev/references/operational-recovery.md`、`w-model-dev/references/hard-constraints.md`（#11 表述）、`w-model-dev/references/command-reference.md`（wm-append-runlog「时间戳三态」条目核对，仅措辞对齐毫秒口径）

- [ ] **步骤 1：SSoT §10C 先行**：将「同秒不算」类表述统一为「严格毫秒早于；同毫秒（含秒级时间戳）不算早于（DEC-3）」。
- [ ] **步骤 2：其余 6 文件同锚替换**：`grep -rn "同秒" docs/ w-model-dev/ AGENTS.md README.md CHANGELOG.md --include="*.md" | grep -v archive | grep -v superpowers`——逐处评估：R11 语义处替换为毫秒口径；与 R11 无关的「同秒」（如时钟阶跃描述）不动并在 commit message 说明剩余处。
- [ ] **步骤 3：验证**：`npm run eval`（锚点若因行文变化失败 → 同步 `eval/mappings.json` 对应条目的断言文本）+ `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`。
- [ ] **步骤 4：Commit**：`docs(r11): 「同秒不算」口径全量对齐为毫秒精度（C2 文档面，DEC-3；代码注释已在任务 3）`

### 任务 13（D2）：阶段门放行语义统一（硬约束胜出）

**文件：** `docs/skill-design-document_SSoT.md`（§10B）、`w-model-dev/references/operational-recovery.md`（L256 成熟度表）

- [ ] **步骤 1：SSoT §10B 先行**：该表中「阶段门放行 …⚡ 自动放行」改为「阶段门放行｜**始终用户确认（HOTL 固定，硬约束 #2）**；L1/L2/L3 差异仅体现在文档仪式与 TLA+/BDD 强度」。
- [ ] **步骤 2：operational-recovery.md L256 同句替换**；搜索 `⚡ 自动放行` 全文核对无残留第二处（grep 锚 `自动放行`）。
- [ ] **步骤 3：验证 + Commit**：eval + docs-consistency 绿后 `docs(recovery): 阶段门放行统一为始终用户确认，消除与硬约束 #2 互斥（D2）`

### 任务 14（D1）：run-log 坏行法定重建程序

**文件：** `w-model-dev/references/operational-recovery.md`（L226 附近）、`w-model-dev/references/command-reference.md`（L70 附近）

- [ ] **步骤 1：operational-recovery**：搜索锚 `跳过损坏行`——「解析失败→跳过损坏行…不停止流程」段替换为法定程序五步：

```markdown
run-log 出现坏行（非法 JSON）时的法定重建程序（唯一合法出口，跳过/继续均违规）：

1. 停止流程，🔴 CHECKPOINT 向用户呈示坏行内容与数量，获得重建批准；
2. 快照原文件为 `run-log.jsonl.corrupt-<YYYYMMDD-HHmmss>`（证据保全，事后不得删除）；
3. 重写 run-log：**仅剔除坏行**，合法行逐字节不变、顺序不变；
4. 经 `wm-append-runlog --stdin` 追加一条 note 记录（note 含 `rebuild-of:<快照名>` 与坏行数）；
5. 复跑 `check-run-log.ts` 至 exit 0 后方可继续。
   工具化（专用重建 CLI）登记为候选区条目，不在当前版本实施。
```

- [ ] **步骤 2：command-reference.md L70**：`check-run-log` 条目「malformed→exit 1 fail-closed」表述后补「坏行的唯一处置见 operational-recovery『run-log 坏行法定重建程序』；check-run-log 不提供跳过态」。
- [ ] **步骤 3：验证 + Commit**：eval + docs-consistency 绿后 `docs(run-log): 坏行法定重建程序（D1，消除跳过/fail-closed 互斥死路）`

### 任务 15（D5）：阶段门禁电池清单权威合一

**文件：** `w-model-dev/references/subagent-delegation.md`（§6.3，L359 附近）、`w-model-dev/references/phase-1-requirements.md`（L330/L455）、`w-model-dev/references/command-reference.md`（L404-430）、`w-model-dev/SKILL.md`（L99）

- [ ] **步骤 1：§6.3 阶段 1 必跑清单补入** `check-artifact-gate.ts <project-dir> --phase=1 --spec-dir=<dir>`，并在 §6.3 节头加一句「各阶段门禁电池以本表为唯一权威清单，他处只指向不复述」。
- [ ] **步骤 2：一致性核查（阶段 2-8）**：逐阶段比对 §6.3 清单与 command-reference 对应节及各 phase-N 文件的必跑提及，差异处一律以 §6.3 为准修正（发现的每一处差异计入 commit message）。
- [ ] **步骤 3：SKILL.md L99** 步骤 8 末尾补「完整清单以 subagent-delegation.md §6.3 为准」。
- [ ] **步骤 4：验证 + Commit**：eval + docs-consistency 绿后 `docs(dispatch): 门禁电池清单 §6.3 唯一权威化，补入 phase-1 artifact-gate（D5）`

### 任务 16（D16）：两份分派时序图一致

**文件：** `w-model-dev/references/subagent-delegation.md`（§2 L66-82 vs L701-704）

- [ ] **步骤 1**：§2 标准时序图补两个环节：S 产出前的「多角色讨论分析（阶段 1-4，A-lead，见 agent-personas.md 阶段角色集矩阵）」与放行前的「ICEBERG-B 冰山扫掠（iceberg-sweep-guide.md）」；或（若 §2 刻意精简）在图下加注「精简图省略 A-lead 讨论与 ICEBERG-B，全量时序以 §<全版图节> 为准」——二选一，选定后在 commit message 说明。
- [ ] **步骤 2：验证 + Commit**：`docs(dispatch): §2 时序图与全版图口径一致（D16）`

### 任务 17（D6）：手搓追加片段替换

**文件：** `w-model-dev/references/operational-recovery.md`（L134-142）

- [ ] **步骤 1**：删除 `appendFileSync(path, JSON.stringify(entry)+'\n')` 代码片段，替换为：

```markdown
run-log 追加**唯一合法入口**是 `wm-append-runlog.ts`（时间戳三态 + 反伪造在工具内强制）：

npx tsx w-model-dev/scripts/cli/wm-append-runlog.ts .w-model/run-log.jsonl --stdin

手搓追加脚本（appendFileSync/fs.writeFile 直写）绕过时间戳纪律，属违规操作（command-reference「wm-append-runlog.ts」条目）。
```

- [ ] **步骤 2：验证 + Commit**：`docs(recovery): run-log 追加片段改为官方工具入口（D6）`

### 任务 18（D7）：CHECKPOINT 清单步骤编号修正

**文件：** `w-model-dev/references/command-reference.md`（L544-545）

- [ ] **步骤 1**：搜索锚 `步骤 5`（该两行内）——「SKILL.md 执行工作流步骤 5」→「步骤 4」；「步骤 5.5（ingestion 规划确认）」→「步骤 5 内 ingestion 规划确认（子步骤，见 phase-1-requirements.md ingestion 节）」。
- [ ] **步骤 2：验证 + Commit**：`docs(cmdref): CHECKPOINT 清单步骤编号对齐 SKILL.md 十步（D7）`

### 任务 19（D8）：阶段 1 产物命名统一

**文件：** `w-model-dev/references/phase-1-requirements.md`（L232-234）

- [ ] **步骤 1**：执行方法论表中 `<模块>-requirement-spec.md` / `<模块>-acceptance-test.md` 改为固定名 `requirement-spec.md`（与 `--spec-dir` 契约一致）并加注「`--spec-dir` 契约要求固定文件名，模块区分由目录承载」；验收测试用例文件名保持模板既有约定（若同为前缀式，一并在 commit message 说明取舍）。
- [ ] **步骤 2：验证 + Commit**：`docs(phase-1): 产物命名统一为 --spec-dir 固定名（D8）`

### 任务 20（D9）：五门传参与 maturity 行为说明修正

**文件：** `w-model-dev/SKILL.md`（L88/L99）、`w-model-dev/references/operational-recovery.md`（L447）、`w-model-dev/references/command-reference.md`（check-preventive-review / check-maturity 条目）

- [ ] **步骤 1**：三处五门调用串中 `check-preventive-review.ts` 补位置参数：`check-preventive-review.ts <project-dir> --auto-trigger --run-log=<path>`。
- [ ] **步骤 2**：command-reference 的 `check-maturity.ts` 条目补：「缺 `--run-log` 时仅出非阻断诊断且仍 exit 0（与 check-budget 同式）——阶段门场景流程上必须提供（SKILL.md 步骤 8）。」
- [ ] **步骤 3：验证 + Commit**：eval + docs-consistency 绿后 `docs(gates): 五门传参补 preventive-review 位置参数；maturity 缺 run-log 行为说明（D9）`

### 任务 21（D10）：计数表述统一

**文件：** `w-model-dev/references/operational-recovery.md`（L166）、`w-model-dev/references/subagent-delegation.md`（L377）、`w-model-dev/SKILL.md`（L146）

- [ ] **步骤 1**：operational-recovery L166「确认 10 脚本全 exitCode=0」→「确认本阶段门禁电池全部 exitCode=0（清单以 subagent-delegation.md §6.3 为准）」；subagent-delegation L377 与 SKILL.md L146 统一为「门禁脚本 48 个 .ts（47 个 exit-2 门禁 + self-test）」。
- [ ] **步骤 2：验证 + Commit**：`npm run eval` + `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 绿后 `docs(counts): 脚本计数统一为 48=47+1 表述，清单指向 §6.3（D10）`

### 任务 22（D11）：ingestion 收敛安全阀出口

**文件：** `docs/skill-design-document_SSoT.md`（ingestion 对应节，搜索锚 `MAX_ROUNDS`）、`w-model-dev/references/phase-1-requirements.md`（L361）

- [ ] **步骤 1：SSoT 先行** + phase-1 L361 补：「第 `MAX_ROUNDS=5` 轮仍不收敛 → 🔴 CHECKPOINT 由用户三选一裁定：回退重分块（调整 chunk 粒度重跑 plan-chunks）/ 显式加轮（记录加轮理由，上限再 5 轮）/ 终止阶段 1 并登记迷雾项；与多角色讨论 5 轮安全阀同构。」
- [ ] **步骤 2：验证 + Commit**：`docs(ingestion): 收敛安全阀三选一出口（D11）`

### 任务 23（D12）：uat-path-mapping 格式权威移位

**文件：** `w-model-dev/references/phase-1-requirements.md`（L20 附近）、`w-model-dev/references/phase-8-acceptance-test.md`

- [ ] **步骤 1**：将 uat-path-mapping.md 的格式规范段（现居 phase-8 §UAT）迁移至 phase-1（作为权威定义，置于产出清单处），phase-8 原位置改为「格式见 phase-1-requirements.md『uat-path-mapping』节」。
- [ ] **步骤 2：验证 + Commit**：`docs(phase-1): uat-path-mapping 格式权威移位至阶段 1（D12）`

### 任务 24（D13）：hard-constraints #11 拆节

**文件：** `w-model-dev/references/hard-constraints.md`（#11 节）、`eval/mappings.json`（锚点同步）

- [ ] **步骤 1**：#11 拆为：主条（约束语义 + 速查表行，~10 行）+ 四个子节 `### 约束 #11-a R11 时序细则` / `#11-b 自举语义（R0/E-2）` / `#11-c 历史兼容窗口（D-6）` / `#11-d 闭环五门调用参数`——正文**逐字迁移**不改判据；#11 主条加指向四子节的一行。
- [ ] **步骤 2：锚点同步**：`npm run eval`；失败的条目在 `eval/mappings.json` 中把锚点文本改指迁移后位置（断言文本保持原文），直至全绿。
- [ ] **步骤 3：验证 + Commit**：eval + docs-consistency 绿后 `docs(constraints): #11 拆主条+四细则子节，锚点原文迁移（D13）`

### 任务 25（D4）：self-as-verifier 悬空引用

**文件：** `w-model-dev/references/command-reference.md`（L206）、`w-model-dev/references/subagent-delegation.md`（L1987）

- [ ] **步骤 1**：核实 subagent-delegation.md 内承载该模式的实际节标题（`grep -n "self-as-verifier" w-model-dev/references/subagent-delegation.md`）；两处「SKILL.md『self-as-verifier 模式』节」改为指向该实际节；若该模式无独立节标题，则在 subagent-delegation 既有相关段补节标题 `### self-as-verifier 模式（demo/教学例外）` 后再改引用。
- [ ] **步骤 2：验证 + Commit**：`docs(refs): self-as-verifier 双向互指收敛到唯一承载节（D4）`

### 任务 26（D14）：persona emoji/color 补齐

**文件：** `w-model-dev/subagent/engineering-algorithm-expert.md`、`product-requirements-analyst.md`、`testing-test-manager.md`

- [ ] **步骤 1**：参照任一已含两字段的 persona（如 `engineering-code-reviewer.md`）的 frontmatter 形态，为三文件补 `emoji` 与 `color`（取值与人格语义相称即可，格式与既有文件一致）。
- [ ] **步骤 2：验证 + Commit**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（persona 检查）绿后 `docs(persona): 三文件补 emoji/color 对齐全套格式（D14）`

### 任务 27（D15）：DoD 外部引用标注

**文件：** `w-model-dev/references/quick-self-check.md`

- [ ] **步骤 1**：搜索锚 `definition-of-done`——`references/definition-of-done.md` 字样改为「来源：addyosmani/agent-skills 的 definition-of-done（外部仓库路径，非本仓文件；DoD 内容内嵌于本文件『完成定义（DoD）』节）」。
- [ ] **步骤 2：验证 + Commit**：`docs(selfcheck): DoD 引用改为显式外部来源标注（D15）`

### 任务 28（N1）：签名链链根声明对齐

**文件：** `docs/skill-design-document_SSoT.md`（§10K 对应句）、`w-model-dev/references/signature-chain-guide.md`（L14/L147）

- [ ] **步骤 1：SSoT 先行** + guide 两处「链根 hash 写入 run-log checkpoint 条目」改为「签名链在 `signature-chain.jsonl` 内自包含闭环（genesis/首条锚定）；run-log **不**承载链根字段（run-log.schema.json additionalProperties:false）」。
- [ ] **步骤 2：验证 + Commit**：`docs(sigchain): 链根声明对齐实现（N1）`

### 任务 29（N2）：checkpoint-log schema gateLogPath 描述对齐

**文件：** `w-model-dev/schemas/checkpoint-log.schema.json`（L80-83）

- [ ] **步骤 1**：`gateLogPath` 的 description 由「供交叉校验退出码防伪造（SSoT §10E）」改为「定位线索（供人工/外部审计复核）；当前无脚本消费者」。
- [ ] **步骤 2：验证 + Commit**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（schema 描述检查）绿后 `docs(schema): checkpoint-log gateLogPath 描述对齐现实（N2）`

### 任务 30（N3）：verifiedArtifacts 取证留存说明

**文件：** `w-model-dev/schemas/gate-log.schema.json`（verifiedArtifacts description）、`w-model-dev/references/command-reference.md`（相关条目）

- [ ] **步骤 1**：两处补「取证留存字段：sha256 供人工/外部审计复验，当前无仓内自动消费者」。
- [ ] **步骤 2：验证 + Commit**：`docs(gate-log): verifiedArtifacts 定位为取证留存（N3）`

### 任务 31（N4）：威胁模型 T2/T3 评级订正

**文件：** `docs/skill-design-document_SSoT.md`（§10O）、`w-model-dev/references/agent-threat-model.md`（T2/T3 行）

- [ ] **步骤 1：SSoT 先行** + T2/T3 覆盖强度由「阻断」改「检测」并附限定：「时间戳三态在**官方追加器内**阻断；绕过工具直写文件不可检测（无行级完整性，WS-T7 裁定），故整体为检测级」；覆盖强度图例与汇总表同步。
- [ ] **步骤 2：验证 + Commit**：`docs(threat): T2/T3 评级阻断→检测并注明限定（N4）`

---

## 阶段 4：收口

### 任务 32：eval 全量核对与 mappings 终检

- [ ] **步骤 1**：`npm run eval`（全绿；任何残余锚点失败回到对应任务修复）。
- [ ] **步骤 2**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` + `npm run --silent typecheck`。

### 任务 33：版本 bump + CHANGELOG + 全量 prepush

- [ ] **步骤 1：版本 bump**

```bash
npm run version:bump   # 若脚本需参数，先 grep '"version:bump"' package.json 确认调用形态；bump 至 42.13.0
```

（七文件同步由脚本承担；核对 `git diff --stat` 恰为预期的版本文件集。）

- [ ] **步骤 2：CHANGELOG 条目**

在 `CHANGELOG.md` 顶部按 Keep a Changelog 惯例新增 `## [42.13.0] - 2026-10-04`，正文含：41 项登记表摘要（C21+D16+N4 逐条一行：修/澄清/消解/不修+理由）、DEC-1~DEC-4 决策记录、已批准偏差 1 处（C21）、计数影响（零新增 CLI/schema；references 数不变）、prepush 实测耗时（步骤 4 后回填）。

- [ ] **步骤 3：全量回归**

```bash
npm test 2>&1 | tail -5          # 全量 vitest 预期全绿
npm run self-test 2>&1 | tail -3
```

- [ ] **步骤 4：全量 prepush（Git Bash）**

```bash
time npm run prepush             # 19 项全绿；将耗时回填 CHANGELOG 后 amend 或补 commit
```

- [ ] **步骤 5：收尾 commit**

```bash
git add -A && git commit -m "chore(release): 42.13.0——深度审计 41 项问题全量修复收口（C21+D16+N4，规格见 docs/superpowers/specs/2026-10-04-audit-deep-dive-fixes-design.md）"
```

- [ ] **步骤 6：合并**：`git checkout main && git merge --no-ff fix/audit-deep-dive-findings -m "Merge branch 'fix/audit-deep-dive-findings'（深度审计 41 项全量修复，42.13.0）"`（推送前须用户确认——本项目不自动 push）。

---

## 自检记录（编写时执行）

1. **规格覆盖度**：C1→任务1；C2→任务3(注释)+12(文档)；C3→任务2；C4/C5/C6/C9/C15→任务3；C7→任务1；C8→任务2；C10/C14→任务5；C11/C16/C17→任务4；C12→任务10；C13→任务3+11；C18→任务8；C19→任务7；C20→任务9；C21→任务6；D1→14；D2→13；D3→5；D4→25；D5→15；D6→17；D7→18；D8→19；D9→20；D10→21；D11→22；D12→23；D13→24；D14→26；D15→27；D16→16；N1→28；N2→29；N3→30；N4→31；收口→32/33。**无遗漏。**
2. **占位符扫描**：无「待定/TODO/后续实现」；测试用例均给出断言目标，唯 helper 名以实测为准处均已显式标注「以该文件既有形态为准」+ 定位命令，属可执行步骤而非占位。
3. **类型/命名一致性**：`isDirectInvocation(importMetaUrl: string)`（is-main.ts:23 实测）；`RUN_LOG_ACTION_VALUES`（任务5 定义、任务5 测试消费）；`METADATA_GRACE_MS`（任务2 定义并唯一使用）；五规则函数名任务3 内自洽。
4. **规格偏差**：仅 C21 一处，已在头部「已批准偏差」声明理由。
