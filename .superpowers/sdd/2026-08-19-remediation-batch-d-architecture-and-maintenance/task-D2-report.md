# Task D2 Report

## Result

Implemented `refactor(cli): use natural process exit for gate reports`.

- `printGateReport` now only writes the separator and `<LABEL>_JSON` summary, returning `void` without calling `process.exit`.
- All 22 default-output `printGateReport` callers set `process.exitCode` and return after reporting.
- Migrated direct success/validation-failure exits in `check-iceberg-sweep.ts`, `check-preventive-review.ts`, `check-rootcause-report.ts`, `check-tla-bdd-sync.ts`, and the BDD CLI wrapper to natural exit handling.
- Preserved human-readable output, JSON prefixes/field order, JSON `exitCode`, and 0/1/2 semantics.
- Added/updated real child-process coverage in `gate-report.test.ts` for default and `--json` success/failure paths.

## Verification

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts`: PASS, 15/15.
- Real child-process assertions: PASS, including default/JSON stdout, shell exit 0/1, JSON `exitCode`, and gate-log write failure preservation.
- `npm run typecheck`: PASS.
- `npm run lint:security`: PASS, 0 new findings.
- `git diff --check`: PASS.
- `npm test`: 855 passed, 1 failed in the pre-existing documentation-count fixture. The failure reports the repository has 53 test files while the fixture/docs expect 52; docs were explicitly out of scope and were not changed.
- `npm run prepush`: blocked at the Vitest coverage gate for the same documentation-count baseline drift; all preceding pre-push checks passed, including self-test, exit 0/1/2 CLI checks, BDD checks, coverage, exemption, signature-chain, and security scan.

## Scope

No business logic, schemas, hooks, package files, security baseline, plans, or specs were changed.

## 第 1/5 轮复审修复

- 修复 `check-samples-coverage.ts --json`：计算单一 `exitCode`，`printJsonReport` 后设置 `process.exitCode` 并自然返回。
- `gate-report.test.ts` 新增真实子进程成功/违规断言：shell status 与 JSON `exitCode` 分别为 0/1。
- 定向测试：17/17 通过。
- 后续验证：typecheck、安全扫描通过；全量测试/prepush 的已知 docs/test-file 计数漂移按要求记录。
- 最终验证：定向 `gate-report.test.ts` 17/17 通过；`npm run typecheck` 与 `npm run lint:security` 通过。`npm test` 为 857 passed / 1 failed，且 `npm run prepush` 在同一既有 53-vs-52 文档计数漂移的 Vitest 覆盖门停止；prepush 之前的所有门禁通过。
