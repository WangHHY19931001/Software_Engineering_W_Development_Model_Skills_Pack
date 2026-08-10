# 观察项处理设计：pre-push 触发扩展 + 设计文档清理 + vitest 计数检查

- 日期：2026-08-10
- 状态：已批准
- 版本目标：38.4.0 → 38.5.0

## 1. 背景

上一轮「文档一致性修正」交付后留下 3 个观察项，本轮全部处理：

1. **pre-push 触发过滤未含文档路径**：`.githooks/pre-push` 的变更过滤仅含 `w-model-dev/scripts/*`、`package.json`、`.githooks/pre-push`，纯文档推送不会自动触发门禁，漂移只能靠人工兜底。
2. **历史设计文档残留**：docs/ 根下设计文档仍有过时内容（`llm-verifier-integration-design.md:55` 的废弃 targetKind 枚举；`loop-engineering-adoption-design.md` 7 处「五维度/六维度」DoD 表述）。
3. **vitest 计数未纳入检查项**：上一轮把 vitest 计数 34/498 → 35/515 全量级联，但 check-docs-consistency 的 10 项检查不覆盖 vitest 文件数，新增测试文件仍会静默漂移。

## 2. 原则

- 门禁检查项从 10 项增至 12 项（新增 design-docs、vitest-files），仍在同一 `check-docs-consistency.ts` 内，pre-push 项数不变（仍 14）。
- 设计文档（docs/ 根 6 份）属「活体引用」文档（README 导航引用），按「移除 changelog 外任何文档中的历史信息」原则清理并纳入门禁防护；docs/superpowers/ 与 docs/changes/ 归档仍不动。
- vitest 只验测试文件数（确定性 glob），不验用例条数（需运行 vitest，脆断）；用例条数漂移由本轮级联 + 人工兜底。

## 3. S1：pre-push 触发过滤扩展（Item 1）

`.githooks/pre-push` 变更过滤 case（约 L95-99）从 3 项扩展为：

```bash
case "$f" in
  w-model-dev/*)                             needs_gate=1; break ;;
  README.md|AGENTS.md|CONTRIBUTING.md|.gitignore|.eslintsecurity-baseline.json|package.json) needs_gate=1; break ;;
  .githooks/*)                               needs_gate=1; break ;;
  docs/*.md)                                 needs_gate=1; break ;;
  .cursor/skills/*)                          needs_gate=1; break ;;
esac
```

说明：
- `w-model-dev/*` 覆盖 scripts/、references/、schemas/、templates/、subagent/、examples/、SKILL.md、skill-metadata.json。
- `docs/*.md` 仅匹配 docs/ 根级 .md（SSoT / INSTALL / adoption-guide / 6 份设计文档）；`docs/superpowers/**`、`docs/changes/**` 归档不触发。
- `.githooks/*` 覆盖 pre-push 与 ensure-platform-deps.sh。
- `.eslintsecurity-baseline.json` 纳入（security-scan #6 依赖）。
- 跳过提示文案同步更新：`本次推送未触及门禁相关文件（scripts/文档/schema/配置），跳过门禁`。

## 4. S2：设计文档清理 + design-docs 门禁（Item 2）

### 4.1 清理（2 份文件，8 处）

**llm-verifier-integration-design.md:55**：
`\`targetKind\`（\`requirement\` / \`design\` / \`testcase\` / \`file\`）` → `\`targetKind\`（\`requirement\` / \`design\` / \`code\` / \`test\`）`

**loop-engineering-adoption-design.md**（7 处，DoD 维度表述对齐当前七维度）：
- :517 `「五维度标准」表` → `「七维度标准」表`（整句保留）
- :520 `## 六维度标准（更新）` → `## 七维度标准（更新）`
- :529 理解证据行后补第 7 行：`| **签名链完整性** | 每阶段每角色动作完成后写入 \`signature-chain.jsonl\`；G 跑门禁前校验 R1-R10 全通过 | \`check-signature-chain.ts\` R1-R10 | 补齐缺失角色签名与来源证明 |`
- :549 `五维度扩展为六维度，新增「理解证据」` → `五维度扩展为七维度，新增「理解证据」「签名链完整性」`
- :551 `五维度 → 六维度 + 自检清单新增条目` → `五维度 → 七维度 + 自检清单新增条目`
- :587 `§10.6 六维度` → `§10.6 七维度`
- :591 `五维度 → 六维度 + 自检清单新增` → `五维度 → 七维度 + 自检清单新增`
- :613 `SSoT §10.6 六维度，definition-of-done.md 一致` → `SSoT §10.6 七维度，definition-of-done.md 一致`

### 4.2 design-docs 门禁检查（新检查 #11）

- `docs-consistency-logic.ts` 新增 `checkDesignDocs(designDocs)`：
  - 输入 `designDocs: Array<{ name: string; content: string }>`（6 份设计文档）
  - 扫描内容：废弃 targetKind 标记（复用 `FORBIDDEN_TARGETKIND` 8 token）+ 过时 DoD 维度表述（`STALE_DOD_DIMENSIONS` 精确模式集：五维度标准 / 六维度标准 / 五维度 → 六维度 / 五维度扩展为六维度 / 六维度（更新） / §10.6 五维度 / §10.6 六维度；设计文档保留的历史演变描述如「五维度扩展为七维度」不触发）+ `STALE_RANGES`（#1~#29 / #1~#19 / 全角变体）
  - 违规消息带文档名（仿 checkTargetKindLiveDocs 的 `docName 检测到…` 风格）
- `DocConsistencyInput` 新增 `designDocs` 字段；CLI 读取 6 份文件：`llm-verifier-integration-design.md` / `loop-engineering-adoption-design.md` / `information-flow-validation-design.md` / `ingestion-graph-convergence-design.md` / `skill-design-document.md` / `tla-plus-modeling-design.md`

## 5. S3：vitest-files 检查（Item 3）

### 5.1 检查设计（新检查 #12）

- `EXPECTED.vitestFileCount = 35`（当前 `w-model-dev/scripts/__tests__/*.test.ts` 实测 35 个文件）
- `checkVitestFileCount(testFileCount, readme, agents)`：
  - `testFileCount !== EXPECTED.vitestFileCount` → 违规（消息含实际/期望值）
  - README 不含 `35 files`、AGENTS 不含 `35 个 .test.ts` → 违规
- CLI：`readdirSync('w-model-dev/scripts/__tests__').filter(f => f.endsWith('.test.ts')).length`；`DocConsistencyInput` 新增 `testFileCount` 字段

### 5.2 级联

- 新检查的 vitest 用例**追加到既有** `docs-consistency-logic.test.ts`（文件数保持 35 ✓）
- 用例数 515 → **521**（design-docs ≈4 + vitest-files ≈2），同步更新 11 处活体文档的「515 条」→「521 条」
- AGENTS §8 check-docs-consistency 行描述「10 项确定性检查」→「12 项确定性检查」
- CHANGELOG [38.5.0] 条目注明 12 项检查

## 6. S4：版本与记录

- 38.4.0 → 38.5.0：package.json / skill-metadata.json（updatedAt 2026-08-10）/ SKILL.md frontmatter / README:12 / INSTALL:141 / SSoT:1092 / CONTRIBUTING:231
- CHANGELOG 顶部新增 [38.5.0] 条目（Added：design-docs + vitest-files 两项检查、pre-push 触发扩展；Changed：设计文档清理、vitest 515→521 级联、版本同步）
- pre-push 项数不变（14）

## 7. S5：验证

- `npm run self-test`：249 通过不变
- `npx vitest run`：35 文件 / **521** 用例全过
- `npx tsc --noEmit`：0 错误
- `npm run check:docs-consistency`：exit 0「✓ 全部一致」（12 项）
- 破坏样本：
  - 临时删除（改名）一个 `.test.ts` 文件 → exit 1（vitest-files 违规）→ 还原
  - 临时改 `llm-verifier-integration-design.md` 的 targetKind 为 `testcase` → exit 1（design-docs 违规）→ 还原
- `bash .githooks/pre-push --force`：14 项全通过
- 文档改动推送触发验证：`git push --dry-run` 或直接 push 后确认门禁运行（pre-push 过滤已含 docs/*.md）

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| `docs/*.md` 误匹配归档 | 归档在子目录（docs/superpowers、docs/changes），`docs/*.md` 不匹配子目录路径 |
| 设计文档清理改写历史记录 | 只更新维度/枚举引用到当前事实，不改轮次事实；设计文档属活体引用文档 |
| vitest 用例数 515→521 级联遗漏 | 计划中显式列出 11 处文档位置 |
| 新检查使 gate 变慢 | 仅 glob + 读 6 个 md，开销毫秒级 |
