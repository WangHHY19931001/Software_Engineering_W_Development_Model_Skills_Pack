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

## 审查返工（第 1/5 轮）

已处理 `task-B4-review.md` 的 I1 与 I2。

### I1：helper 有界契约

- `RunSyncOptions` 收窄为 `Omit<SpawnSyncOptions, 'encoding' | 'killSignal'>`，返回值字符串类型不再可由公开 options 破坏。
- `timeout` 与 `maxBuffer` 只接受 `Number.isFinite(value) && value > 0`；`0`、`NaN`、`Infinity` 与缺失值均回退默认边界。
- `killSignal` 固定为 `SIGKILL`，`encoding` 固定为 `utf-8`；即使不安全类型断言传入弱信号或非字符串编码，实际传给 `spawnSync` 的仍为固定值。
- 新增测试覆盖上述 0/NaN/Infinity/弱 killSignal/encoding override 路径。

### I2：全目录盘点与例外

- `SYNC_PROCESS_EXCEPTIONS` 是 `w-model-dev/scripts` 的集中、显式同步 API 清单。每项记录 API、文件、准确行号、符号、理由及 timeout 状态。
- `run-sync.test.ts` 递归扫描整个 `w-model-dev/scripts/**/*.ts` 的 `spawnSync`、`execSync` 和 `execFileSync` 直接调用；helper 本身的唯一底层 `spawnSync` 除外。每个扫描结果必须与清单一一对应、具有理由并声明 timeout 已存在或需后续整改。
- 已审计的范围外无 timeout 例外：`check-tla-model.ts` 的 `checkEnvironment` Java 探针、`check-docs-consistency.ts` 的两项 git 探针、`security-scan.ts` eslint 调用、`docs-consistency-logic.test.ts` 和 `wm-write.test.ts` 的真实 CLI helpers。它们均标为 `missing-followup`，未宣称由 B4 修复；按照任务限制没有修改这些实现。
- 已审计的既有明确 timeout 例外：check-tla-model SANY/TLC/预检、docs-consistency Vitest、ensure-codegraph-opsx 操作及 coverage-logic 15 秒 CLI 测试。

### 返工验证

通过：

```text
focused Vitest: 5 files / 67 tests
npm run typecheck
npm run lint:security
Prettier --check
```

全量 `npm test` 仍仅有既有 docs-consistency fixture 失败：新增 `run-sync.test.ts` 后实际测试文件为 51，fixture/活体计数仍为 50；结果为 50 files / 819 tests passed，1 fixture failure。该文件与 docs 变更受 B4 范围禁止，未修改。`npm run prepush` 已实际运行：通过平台依赖、self-test、门禁样本和安全扫描，在全量 Vitest/coverage 的同一 docs-count 漂移处阻断。
