# Final Sync Manifest Coverage Report

日期：2026-08-26
工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
起始 HEAD：`c751d0f69d8724262222c245c6f11a9586a21f48`

## 根因

`run-sync.test.ts` 的 AST 扫描器没有误报，也没有发现新的未登记生产调用。扫描 `w-model-dev/scripts/**/*.ts` 后，排除 `lib/run-sync.ts` 自身用于实现包装器的那一条 `spawnSync`，得到 **21** 条需要保留审计的直接同步调用；`SYNC_PROCESS_EXCEPTIONS` 中同样有 **21** 条非 `migratedToRunSync` 条目。

唯一差异是 provenance 行号漂移：

- 实际调用：`w-model-dev/scripts/__tests__/wm-write.test.ts:36`，API `spawnSync`，符号 `runArgs`
- 原清单：`w-model-dev/scripts/lib/run-sync.ts` 中仍登记为 `line: 35`
- 该行号变化来自前一提交 `c751d0f` 在 `wm-write.test.ts` 增加 `holderClosePromises` 后的源码行移动；调用本身仍是原有 `runArgs` 真实 CLI 边界测试调用。

其余扫描结果与清单按 `(api, file, line)` 精确匹配，AST alias/namespace/static element access 语义测试也通过。没有修改动态断言、没有删除审计、没有改为动态期望数量。

## TDD 红灯 / 绿灯

### 红灯

修复前运行：

```text
npx vitest run w-model-dev/scripts/__tests__/run-sync.test.ts --reporter=verbose
```

结果：退出码 `1`；17 passed、1 failed。失败为：

```text
FAIL ... audits every direct synchronous child-process call against the centralized exception manifest
AssertionError: expected 35 to be 36
at w-model-dev/scripts/__tests__/run-sync.test.ts:385:31
```

诊断 AST 输出确认：`auditedCount=21`、`manifestCount=21`，唯一 mismatch 为：

```json
{
  "call": {
    "api": "spawnSync",
    "file": "__tests__/wm-write.test.ts",
    "line": 36
  },
  "entry": {
    "api": "spawnSync",
    "file": "__tests__/wm-write.test.ts",
    "line": 35,
    "symbol": "runArgs",
    "reason": "B4 excludes state/wm-write; real CLI helper uses an explicit 15-second timeout.",
    "timeout": { "required": true, "status": "present" }
  }
}
```

该现有精确 provenance 断言（`run-sync.test.ts:385`）就是能证明缺失/漂移原因的失败测试；未新增无效的数量测试。

### 绿灯

最小修复仅将 `SYNC_PROCESS_EXCEPTIONS` 中 `__tests__/wm-write.test.ts` / `runArgs` 的 `line` 从 `35` 更新为 `36`。API、文件、符号、原因和 timeout provenance 均保留不变。

定向绿灯命令：

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts --reporter=dot
```

结果：退出码 `0`；`1 passed`、`18 passed`。

相关回归命令：

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts --reporter=dot
```

结果：退出码 `0`；`3 passed`、`81 passed`。

曾有一次将三个相关文件并行执行的结果为 `2 passed / 1 failed / 81 tests`，失败是 `wm-write.test.ts` 的跨进程 mtime 并发测试收到 `0` 个 `MTIME_CONFLICT`；随后单独运行 `wm-write.test.ts`（`25/25`）和串行再次运行上述三个文件（`3/3`、`81/81`）均通过。该瞬态并发结果不属于本次 manifest 修复，未改动既有 stale-lock 修复。

## 完整命令输出

### 完整测试

```text
npm test -- --reporter=dot
```

退出码：`0`

```text
Test Files  58 passed (58)
Tests       1222 passed (1222)
Start       18:37:22
Duration    247.45s
```

### 类型检查

```text
npm run typecheck
```

退出码：`0`

```text
> w-model-dev-skill@41.19.0 typecheck
> tsc -p config/tsconfig.json
```

### 目标 Prettier

```text
npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/lib/run-sync.ts
```

退出码：`0`

```text
Checking formatting...
All matched files use Prettier code style!
```

### Diff 空白检查

```text
git diff --check
```

退出码：`0`，无输出。

## 变更文件

仅修改：

- `w-model-dev/scripts/lib/run-sync.ts`：`wm-write.test.ts` 的 `runArgs` provenance 行号 `35 -> 36`
- 本报告：`.superpowers/sdd/w-model-reliability-optimization/task-final-sync-manifest-report.md`

未修改 `progress.md`、`.w-model` 或既有任务报告。

## 未解决疑虑

- 相关测试首次合并执行时出现一次跨进程 mtime 测试瞬态失败；单独及串行复跑均通过，完整 `npm test` 也以 `58/58`、`1222/1222` 通过。若后续 CI 仍复现该独立并发时序问题，应另开任务调查，不应回退或扩大本次清单修复。
- npm 每次命令提示 `Unknown user config "home"` warning；不影响退出码或测试结果，未在本任务范围内处理。
