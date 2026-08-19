# B4 执行报告：同步子进程 timeout 统一

- 日期：2026-08-19
- 分支：`fix/audit-remediation`
- 范围：严格遵循 `task-B4-brief.md`。

## 实施

- 新增 `w-model-dev/scripts/lib/run-sync.ts`：为同步 `spawnSync` 调用默认强制传入：
  - `timeout: 15_000`
  - `killSignal: 'SIGKILL'`
  - `encoding: 'utf-8'`
  - `maxBuffer: 64 * 1024 * 1024`
- 调用方仍可传入正数 `timeout` 以支持明确的长运行任务；零、缺失和无效 buffer/timeout 回退到有界默认值。
- `artifact-gate-assets.ts` 的 TLA+/BDD 子进程校验迁移至 helper，维持原有 CLI 参数、stdio 和 exit-code 处理。
- `gate-report.test.ts`、`metrics-report.test.ts` 和 `wm-status.test.ts` 的同步 CLI 冒烟调用迁移至 helper。
- 新增 `run-sync.test.ts`：
  - mock 验证 helper 将 timeout、killSignal、encoding、maxBuffer 实际传给 `spawnSync`；
  - 覆盖调用方显式 timeout 覆盖；
  - 以真实短时 child 验证 250 ms timeout 返回 `ETIMEDOUT` 且在 2 秒内结束；
  - 静态扫描 B4 受控同步调用点，拒绝直接 `spawnSync(...)`。
- `artifact-gate-assets.test.ts` 验证两项模型检查调用通过 helper 带齐全部进程级选项。
- 更新 `CHANGELOG.md` 的审计整改批次 B 条目。

## TDD 证据

先新增 `run-sync.test.ts` 和 artifact gate 的 options 断言，并在 helper 尚不存在、模型检查仍直接调用时运行：

```text
run-sync.test.ts: Cannot find module '../lib/run-sync.js'
artifact-gate-assets.test.ts: expected timeout/killSignal/maxBuffer but only received encoding/stdio
```

随后最小实现 helper 和迁移调用点；focused suite 变绿。

## 验证

通过：

```text
npx prettier --config config/prettier.config.cjs --check [B4 TS files]
npx vitest run --config config/vitest.config.ts run-sync/artifact-gate-assets/gate-report/metrics-report/wm-status tests
# 5 files, 60 tests passed
npm run typecheck
npm run lint:security
```

全量验证结果：

```text
npm test
# 50 files / 812 tests passed; 1 docs-consistency fixture failure
npm run prepush
# blocked at Vitest coverage step for the same docs-consistency fixture failure
```

阻断根因：新增 `run-sync.test.ts` 将实际 `.test.ts` 文件数从 50 增至 51；`docs-consistency-logic.test.ts` 的临时 fixture 仍硬编码 50 个测试文件，因而其 `runDocsConsistencyCli` 期望 exit 0 实际得到 1。B4 简报明确禁止改 docs/docs-consistency，因此未修改相关生产代码、fixture 或活体文档。该失败与 B4 的同步子进程行为无关。

## 约束核对

- 未修改 docs-consistency、hook、schema、state/wm-write、gate-log、package、baseline、计划或规格。
- 未改动 `coverage-logic.test.ts` 现有 15 秒 `execSync` timeout。
- codegraph 查询已尝试；目标仓库无 `.codegraph/` 索引，按简报采用无索引替代：完整 `rg` 调用点审计 + focused static test。
