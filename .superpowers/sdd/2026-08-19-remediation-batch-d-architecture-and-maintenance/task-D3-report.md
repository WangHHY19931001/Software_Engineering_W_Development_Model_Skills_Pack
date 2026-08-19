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

## 第 1/5 轮审查整改（2026-08-19）

- **C1**：输出路径安全检查改为逐祖先 `lstat` 拒绝既有 symlink；以最近存在的真实祖先加不存在尾部验证不落入 `sourceReal`；创建 staging 和 publish rename 前均复检。真实 CLI 回归覆盖「父级 symlink → source `.w-model`」并断言 exit 1、无 source 污染。
- **C2**：logic 失败改为稳定分类枚举（如 `INVALID_JSON_EVIDENCE`、`UNSAFE_OUTPUT_PATH`、`EVIDENCE_EXPORT_FAILED`），不返回路径、文件名、原始内容或 fs 错误。CLI 的运行期失败统一调用 `exitWithError`，同时保留安全 `EVIDENCE_EXPORT_JSON`；真实 CLI 测试断言 `ERROR_JSON`、exit 1，且 `token=actual-secret`、项目绝对路径均不泄露。
- **I1/I2**：排序替换为代码单元比较器；递归目录和每个读取路径在 I/O 前后均以 `lstat`/`realpath`/inode/size/mtime 快照复检，遇 symlink、根外 realpath 或变化即拒绝。该检测策略降低开放期间的 TOCTOU；平台无可移植原子 no-follow 读取时 fail-closed 检出检查后替换。注入 `readFile` hook 的测试覆盖文件在快照后被替换为 symlink。
- **I3/M2**：真实 CLI 测试覆盖 output-parent symlink、无效 JSON、二进制、非空 output、verify traversal/duplicate/symlink/tamper/额外文件；注入 publish rename 失败并断言 staging 无残留。verify 递归枚举输出目录，除 manifest 和 manifest entries 外任何文件/未知项/symlink 均失败。
- **M1**：Schema 的 `files[].path` 增加安全 POSIX 相对路径正则（禁止绝对、反斜杠、`.`/`..` 段与空段）；重复仍由 verify 语义校验。

### 整改验证

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts
28 tests passed

npm run self-test
exit 0
npm run typecheck
exit 0
npm run lint:security
exit 0 (0 新增风险)
Prettier check
exit 0
```

最终全量 `npm test`（53 files / 872 passed；仅 `docs-consistency-logic` 的 D4 文档/登记计数 fixture 失败）和 `npm run prepush` 均执行；prepush 先通过 self-test、输入退出码、security、BDD、coverage、exemption 与 signature-chain，再在同一 docs-consistency 漂移处阻断。未修改 `.gitignore`、状态写、gate-log、docs-consistency、hook、baseline、docs、plan 或 spec。
