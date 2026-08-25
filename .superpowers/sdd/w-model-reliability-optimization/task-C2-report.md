# Task C2 报告：文档入口与 SSoT 收尾

## 结论

C2 已完成最小范围文档一致性收尾：指定入口文档审计显示双入口及平台/安装边界契约已存在，无需重写；SSoT §3.1 三边界架构图和边界说明已存在，补充了 docs-consistency 对该区段的确定性校验与回归测试。

## 变更

- `w-model-dev/scripts/logic/docs-consistency-logic.ts`
  - 增加 `checkSsotArchitectureBoundaries`。
  - 仅以 SSoT `### 3.1 整体架构` 到 `### 3.2` 区段为事实源，校验 SkillPackage / Host / Tools、Host→SkillPackage、Host→Tools 关系及交付边界说明。
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
  - 新增缺失三边界 token 的失败回归。
  - 增强真实 SSoT 三边界断言，确保图和边界说明在同一 §3.1 区段。
- `docs/changes/2026-08-25-c2-documentation-acceptance.md`
  - 新增当前 reviewed HEAD 的受控验收记录。
- `.w-model/codegraph-queries/2026-08-25-C2-docs.md`
  - CodeGraph 不可用（无 `.codegraph/` 索引）时的真实 fallback 影响分析；该路径为 Git ignored 运行期证据，不提交。

没有修改 README、INSTALL、adoption、AGENTS、CONTRIBUTING 或 SSoT 正文，因为审计确认入口/边界/SSoT 图已满足简报契约；没有修改 progress.md 或 `.w-model/`。

## 验证证据

Implementation reviewed HEAD:

- `feee9f01ed0ae7ddc46ecb00e5c7a4ceb23e6a6f`
- `docs(validation): close documentation acceptance loop`
- 本节列出的全部 C2 测试与门禁证据，均针对该 implementation reviewed HEAD。

Parent baseline:

- `f7c13896305c6ea97731e9b1f2cfeb8d1b6690c8`
- `test(verifier): isolate original failure regression`

真实命令结果：

- 红灯回归（修复前）：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t 'SSoT 三边界架构契约缺失'` 失败。
- 绿灯回归（修复后）：同测试通过，1 passed。
- 定向 C2：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t 'C3 文档入口契约|三边界'` 通过，3 passed。
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` 通过：fixtureCount 280、referencedFiles 242、referencedDirs 15、unregistered 0、undeclaredDirs 0、exitCode 0。
- `npm run typecheck` 通过，tsc exit 0。
- 目标 Prettier check 通过。
- `git diff --check` 通过；只出现预存在的 progress.md 行尾转换提示。
- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts --reporter=dot` 未通过：159 tests，152 passed，7 failed。失败为既有动态 fixture 的 script-registry / `platform-deps-install.ts` exit-2 probe 漂移，不是三边界定向回归失败。
- `npm run check:docs-consistency` 未通过，真实输出报告约 23 项：动态 Vitest 事实包因失败测试不可采信；并报告活体文档 55/1002 与当前 57/约1203、SKILL/dispatch-matrix 脚本登记、`platform-deps-install.ts` probe 等既有漂移。

未执行并明确不作通过声明：Persona 真实 CLI smoke tests、`npm run self-test`、全量 `npm test`、`npm run lint:security`、`npm run prepush`、证据导出及 source provenance producer/verify。

## Provenance 级别

- Implementation reviewed HEAD: `feee9f01ed0ae7ddc46ecb00e5c7a4ceb23e6a6f`；全部 C2 测试与门禁证据均针对该提交。
- Parent baseline: `f7c13896305c6ea97731e9b1f2cfeb8d1b6690c8`。
- package-only provenance：未生成/未验证。
- source-bound provenance：未生成/未验证；没有 `--source-project` 证据。
- 历史归档、`.w-model/`、`.zcode/`、coverage 未作为当前 HEAD 验收证据。

## Concerns

1. docs-consistency 当前动态门禁仍被真实测试失败、活体计数漂移、脚本登记漂移及 `platform-deps-install.ts` probe 契约阻断；C2 未跨范围刷新这些既有事实源。
2. C2 提交不得包含 `.superpowers/.../progress.md` 或 `.w-model/`。
3. 受控验收记录位于 `docs/changes/2026-08-25-c2-documentation-acceptance.md`；上述 implementation reviewed HEAD 是此前已验证的实现提交，不随本次记录更新提交改变。

## 修复轮 1：受控验收身份链修复

### 审查发现

受控验收记录此前仅把 parent baseline 写成 reviewed HEAD，并保留按提交后再确认 SHA 的自引用表述，无法明确表述 C2 测试与门禁证据实际针对的实现提交，也无法区分父基线与本次记录更新提交。

### 修复内容

- 在 `docs/changes/2026-08-25-c2-documentation-acceptance.md` 顶部和 provenance 节补充明确的 `Implementation reviewed HEAD: feee9f01ed0ae7ddc46ecb00e5c7a4ceb23e6a6f`，并声明全部 C2 测试与门禁证据均针对该提交。
- 补充 `Parent baseline: f7c13896305c6ea97731e9b1f2cfeb8d1b6690c8`。
- 将本次提交单独标为 `record update commit`，明确它只修复身份记录，不冒充此前已验证的 implementation reviewed HEAD；移除延后确认 SHA 的占位表述。
- 同步本报告的身份链与证据范围；未修改 `progress.md`、`.w-model/` 或生产代码。

### 真实 diff-check 与内容自检

- `git diff --check`：通过；仅保留预存在的 `progress.md` 行尾转换提示。
- 内容自检：通过；验收记录包含且仅包含明确的 implementation reviewed HEAD、parent baseline、record update commit 三类身份说明；报告和验收记录均不含延后确认提交身份的占位表述。
- 范围自检：通过；本次记录更新 diff 仅包含 `docs/changes/2026-08-25-c2-documentation-acceptance.md` 与 `.superpowers/sdd/w-model-reliability-optimization/task-C2-report.md`，预存在的 `progress.md` 未纳入。
