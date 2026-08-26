# Task D3 报告：证据导出与 provenance 验证

## 修复轮 1 交付

- 原始交付 commit：`14f0a97 test(evidence): verify export provenance boundaries`
- 修复轮 1 commit：`fix(evidence): close redaction metadata gaps`（最终提交哈希以 Git 提交记录为准）
- CodeGraph：已尝试查询；该工作树及其祖先没有 `.codegraph/` 索引，因此未伪造图谱结果。fallback 影响分析已更新并落盘：
  - `D:\\w_skill_opt\\Software_Engineering_W_Development_Model_Skills_Pack\\.worktrees\\w-model-reliability\\.w-model\\codegraph-queries\\2026-08-25-D3-evidence.md`
- 本报告、fallback 分析和源代码之外，未提交真实临时证据包、`.w-model/` 运行状态或 progress 文件。

## 修复内容

1. Markdown 脱敏复用 JSON/JSONL 的归一化 key 规则，覆盖 `api key`、`api_key`、`api-key`、`access token`、`private key` 以及 `authorization`、`password`、`token` 等形式；敏感键值优先脱敏，即使值是 `https://...`、`./...` 或其他相对样式也不会绕过。保留普通 URL 和普通相对路径。
2. manifest 输入元数据增加安全约束：恶意 `runId`、`artifactId` 和 allowlisted 文件名中的 `token=...`、`authorization=...` 等敏感赋值会 fail-closed，不写入 manifest；合法 allowlisted 路径、稳定排序和 hash 自洽规则保持不变。
3. 新增真实临时项目和真实 CLI 回归 fixture，覆盖 JSONL/Markdown 绕过、恶意 runId/artifactId/文件名，并保留原有 package-only/source-bound、篡改、脱敏与路径测试。
4. 对 `sanitizeSensitiveAssignment` 的正则捕获组解构增加显式 `undefined` guard，修复 `noUncheckedIndexedAccess` 下 `match[2]` 可能未定义的类型安全问题；不改变 sanitizer 的匹配或脱敏逻辑。

## TDD 证据

新增 fixture 先运行：

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts -t "spaced sensitive keys|malicious runId-derived"
```

结果：红灯，2 failed（Markdown/JSONL fixture 未能成功导出，恶意 runId 未被拒绝）。随后最小实现修复，重复同命令：2 passed。

## 修复轮 1 真实验证

### 定向 Vitest

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts
```

结果：通过，2 test files / 55 tests passed。

覆盖的真实 package-only/source-bound CLI 证据包括：

- package-only 成功和未传 `--source-project` 不宣称 source-bound。
- `--source-project` source-bound 成功。
- 导出内容、manifest、source provenance 篡改拒绝。
- JSON/JSONL/Markdown 中 token、password、authorization、api key、access token、private key 及绝对路径不泄漏。
- URL/`./` 敏感值不会绕过 Markdown 脱敏；普通 URL/相对路径保留。
- 恶意 runId、artifactId 和文件名不会进入 manifest，且失败输出不泄漏原始 secret。
- 项目源码、`.zcode`、`coverage`、历史归档和未白名单运行时文件不导出。

### 其他定向门禁

- `npm run typecheck`：通过，0 TypeScript 错误；本轮对正则捕获组显式收窄后，未再出现 `evidence-export-logic.ts:339` 的 `match[2]` 可能为 `undefined` 错误。
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/logic/evidence-export-logic.ts w-model-dev/scripts/cli/wm-export-evidence.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/schemas/evidence-manifest.schema.json`：通过，所有目标文件符合格式。
- `git diff --check`：通过，无输出。

### Docs consistency 实测批次

按复审要求只运行一次：

```text
npm run check:docs-consistency
```

结果：exit 1，23 项不一致。该批次的真实动态计数为：`vitestTestCount=1228`、`numFailedTests=10`、`numPassedTests=1218`，`testFileCount=58`，`success=false`。失败项主要是仓库既有 README/AGENTS/CONTRIBUTING/INSTALL Vitest 计数过期、既有 dispatch-matrix 脚本登记缺口、SKILL TypeScript 文件计数和既有 platform-deps probe；该命令生成结果还因完整 Vitest 结果含 10 个失败而 fail-closed。D3 定向的两个 evidence 测试文件本身全部通过。该数字绑定到本修复轮实际运行批次，不使用原始报告中的 9/1219 旧数字。

## 未执行项

- 未运行无界全量 `npm test` / 全量 Vitest。
- 未运行 pre-push、security scan、npm audit、TLA+ 或平台依赖检查；不属于本修复轮定向范围。
- 未进行真实公开发布；导出和 producer+verify 代码无自动 Git 提交或发布路径。

## 边界与 concerns

`manifestSha256`、`provenanceSha256` 和 SHA-256 manifest 是完整性检测/来源绑定记录，不是密码学签名、第三方不可抵赖证明或发布授权。若攻击者可同时重写 manifest 与其 hash，仍需要外部可信存档/签名系统。当前 CLI 只返回 package-only 或 source-bound 明确等级，未传 `--source-project` 不会宣称 source verified。
