# Task 2A report — safe project path boundary

## Status

`DONE_WITH_CONCERNS` — 2A 的路径边界、M07 E2 接线和 `--tickets` 输入校验已实现并完成聚焦验证；typecheck 通过。聚焦 M07 文件仍有 3 个严格时间戳/空 command 失败，均属于明确排除的任务 2B 范围。票据内容文件另有 1 个实现前即存在的无关失败。

## 修改文件

- `w-model-dev/scripts/lib/safe-project-path.ts`（新增）：`SafeProjectPathError` 及项目内普通文件解析；逐段 `lstat`、拒绝 symlink/junction、最终 `realpath`/canonical containment 复核。
- `w-model-dev/scripts/logic/gate-logic.ts`：E2 的 `resolveTestEvidenceOutputPath` 复用 helper，保留 `{ ok, absPath/reason }` 结构；missing 仍映射到原有 E2 “不存在或不可读”信息。
- `w-model-dev/scripts/cli/check-artifact-gate.ts`：`--tickets` 在任何读取之前复用 helper；missing 保持 `FILE_NOT_FOUND`，其它安全边界失败映射 `ARG_INVALID`。
- `w-model-dev/scripts/__tests__/safe-project-path.test.ts`：任务 1 已提交的 helper 契约测试（本任务未改动）。
- `w-model-dev/scripts/__tests__/gate-test-evidence.test.ts`：根内成功断言创建真实普通文件，以符合新的 regular-file 契约。
- `w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`：现有 CLI 正向用例改用项目相对路径，新增绝对/穿越/反斜杠/盘符/UNC/link/目录拒绝回归。

## TDD evidence

先运行任务 1 helper 契约，生产模块不存在时得到预期 RED：

```text
> npm test -- w-model-dev/scripts/__tests__/safe-project-path.test.ts

 RUN  v4.1.11 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation

 FAIL  |unit-parallel| w-model-dev/scripts/__tests__/safe-project-path.test.ts
Error: Cannot find module '../lib/safe-project-path.js' imported from D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation/w-model-dev/scripts/__tests__/safe-project-path.test.ts
Test Files  1 failed (1)
Tests  no tests
```

新增的 tickets 边界测试在实现前也按预期 RED：项目内绝对路径当时被读入，最终 exit 1，而非 `ARG_INVALID`/exit 2。

```text
> npm test -- w-model-dev/scripts/__tests__/gate-ticket-content.test.ts

 FAIL  ... 绝对、穿越、反斜杠、盘符、UNC、NUL、链接和目录 --tickets 均在读取前以 ARG_INVALID 拒绝
AssertionError: C:\Users\wangh\AppData\Local\Temp\wm-tickets-o045tE\tickets.md: expected 1 to be 2
Test Files  1 failed (1)
Tests  2 failed | 32 passed (34)
```

## 实际验证命令和完整输出

### `npm test -- w-model-dev/scripts/__tests__/safe-project-path.test.ts`

```text
npm warn Unknown user config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> w-model-dev-skill@42.2.1 test
> vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/safe-project-path.test.ts

 RUN  v4.1.11 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  20:15:50
   Duration  219ms (transform 29ms, setup 0ms, import 47ms, tests 16ms, environment 0ms)
```

### `npm test -- w-model-dev/scripts/__tests__/gate-test-evidence.test.ts`

```text
npm warn Unknown user config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> w-model-dev-skill@42.2.1 test
> vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts

 RUN  v4.1.11 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation

 ❯ |unit-parallel| w-model-dev/scripts/__tests__/gate-test-evidence.test.ts (21 tests | 3 failed) 142ms
     × E4: lastUpdated 早于旧 cutoff 仍须阻断，时间戳不得作为 legacy 放行 6ms
     × E4: evidence.command 仅空白时须阻断，不能以对象存在替代可执行命令 1ms
     × 计数：GATE_JSON e-rule 计数（e1/e2/e3/e4 + legacy/missing/checked） 1ms

 FAIL  ... E4: lastUpdated 早于旧 cutoff 仍须阻断，时间戳不得作为 legacy 放行
AssertionError: expected true to be false
 FAIL  ... E4: evidence.command 仅空白时须阻断，不能以对象存在替代可执行命令
AssertionError: expected true to be false
 FAIL  ... 计数：GATE_JSON e-rule 计数（e1/e2/e3/e4 + legacy/missing/checked）
AssertionError: expected 2 to be +0

 Test Files  1 failed (1)
      Tests  3 failed | 18 passed (21)
   Start at  20:17:31
   Duration  483ms (transform 103ms, setup 0ms, import 142ms, tests 142ms, environment 0ms)
```

### `npm test -- w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`

```text
npm warn Unknown user config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> w-model-dev-skill@42.2.1 test
> vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts

 RUN  v4.1.11 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation

 ❯ |cli-serial| w-model-dev/scripts/__tests__/gate-ticket-content.test.ts (34 tests | 1 failed) 25001ms
     × 黑名单第 6 条：跨票据仅参数名重叠不构成符号契约 → undefined-symbol 7ms

 FAIL  ... 黑名单第 6 条：跨票据仅参数名重叠不构成符号契约 → undefined-symbol
AssertionError: expected true to be false

 Test Files  1 failed (1)
      Tests  1 failed | 33 passed (34)
   Start at  20:16:31
   Duration  25.57s (transform 152ms, setup 0ms, import 373ms, tests 25.00s, environment 0ms)
```

### `npm run typecheck`

```text
npm warn Unknown user config "home". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> w-model-dev-skill@42.2.1 typecheck
> tsc -p config/tsconfig.json
```

No full `npm test` run was performed.

## Platform junction result

Windows junction creation succeeded. The junction case was not skipped: the helper suite reports 9 passed tests, including `项目外 junction 以 link 拒绝`; it observed `SafeProjectPathError.reason === 'link'`.

## Concerns

1. M07 E4 strict timestamp/empty-command behavior is task 2B scope and intentionally remains unchanged; three corresponding tests fail at current HEAD.
2. `gate-ticket-content.test.ts` has one pre-existing unrelated `checkTicketContent` failure (`跨票据仅参数名重叠...`). It failed in the initial RED run before this path implementation and still fails afterward.
3. A literal NUL cannot be delivered through Node `spawnSync` argv (Node rejects it before the CLI starts), so the CLI table omits that impossible transport case. The task 1 helper suite directly exercises `nul\u0000path` and passes with `reason === 'invalid-segment'`.
4. npm emits a pre-existing local configuration warning: `Unknown user config "home"`.

## Commit SHA

Pending commit at report creation time; updated after commit below.
