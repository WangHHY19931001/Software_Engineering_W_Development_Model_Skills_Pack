# D3 实施报告：显式审计证据导出与可验证 Manifest

- 日期：2026-08-19
- 工作树：`D:\w_skill_opt\wmodel-audit-remediation`
- 分支：`fix/audit-remediation`
- 任务：D3

## 实施内容

- 新增严格 draft-07 `evidence-manifest` Schema（`additionalProperties: false`），manifest 记录稳定排序的输出相对路径、allowlist kind 与小写 SHA-256。
- 新增 `wm-export-evidence` CLI 与 `wm:export-evidence` package 脚本：
  - 导出：`npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts <project-dir> <output-dir>`
  - 验证：`npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json`
  - 真实 `EVIDENCE_EXPORT_JSON` 摘要和 exit 0/1/2 协议。
- 仅导出 `.w-model` 下 allowlist 的 `gate-logs/`、`verifier-outputs/`、`signature-chains/`、`codegraph-queries/`、`run-log.jsonl`。
- JSON/JSONL 对 `token`、`secret`、`password`、`apiKey`（大小写不敏感）递归脱敏；拒绝无效 JSON/JSONL、二进制、未知扩展、符号链接和路径逃逸。
- 导出使用临时目录后 atomic rename 发布；拒绝 output 位于 source `.w-model`、symlink output、非空 output，避免混合证据。
- verify 重做 Schema、重复/逃逸路径、存在性、symlink 和 SHA-256 检查。
- 新增逻辑/真实 CLI 子进程测试；依赖边界与同步子进程例外清单已同步。

## TDD 证据

先创建 `evidence-export-logic.test.ts` 并运行，因 `../logic/evidence-export-logic.js` 缺失而红灯；随后以最小实现转绿。测试覆盖 manifest/排序/hash、递归脱敏、verify、篡改、source/output 路径边界、symlink、二进制、非空输出、严格 manifest Schema，以及实际 CLI exit 0/1/2。

## 验证结果

通过：

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
6 tests passed

npm run self-test
exit 0

npm run typecheck
exit 0

npm run lint:security
exit 0 (0 新增风险)

npx prettier --config config/prettier.config.cjs --check <D3 TypeScript files>
exit 0
```

完整 `npm test` 与 `npm run prepush` 已执行但退出 1，唯一阻断为简报指定留给 D4 同步的活体文档计数/登记：新增 Schema、CLI、测试使 docs-consistency 报 schema 清单、test 文件数、`dispatch-matrix.md` 和 `SKILL.md` 脚本计数漂移。未修改用户禁止的 docs-consistency、hook、baseline、文档计划/规格，也未绕过门禁。
