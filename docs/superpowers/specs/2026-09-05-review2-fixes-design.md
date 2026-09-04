# 2026-09-05 全范围审查修复设计（review2-fixes）

> 状态：已获用户批准的设计（方案 A：单一 SDD 战役，6 任务）。
> 审查来源：2026-09-05 五域独立审查 `origin/main (93f6f3a)..HEAD (f7f0bba)`，148 提交，净 diff 137 文件 +10114/−1188。
> 发现总量：0 Critical / 2 Important / 25 Minor。
> 用户决策记录：①行为变更类 Minor 全部纳入（2026-09-05 AskUserQuestion）；②失败链 200 处内联重复全量锚点化（同日 AskUserQuestion）；③设计整体批准（同日）。

## 0. 不变量（沿用既有约束，逐字有效）

- 版本保持 `42.2.1`，不 bump。
- 全部实现动作在隔离 worktree（`.worktrees/review2-fixes`，分支 `task/review2-fixes`）由 S 子代理完成；主工作树 tracked 文件零改动。
- 不合并、不推送、不标记 complete，直到独立 review clean 且用户同意；`git push` 属外部操作必须征得用户同意。
- 普通 V/G 失败必须遵循完整 R 链；不得放宽 gate；不得伪造测试结果；`.superpowers/` 报告不得提交。
- 阶段 5-8 任何代码/测试/shell（`.ts` / `.sh` / `.ps1` / `.bat` / `.cmd`）编辑前先做 codegraph 查询并落盘；当前 checkout 无 codegraph index，沿用 unindexed-fallback 记录（`.w-model/codegraph-queries/phase5-review2fix<N>-<symbol>.json`，gitignored）。
- 台账父链零豁免延续：`CHANGELOG.md` 与 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md` 同步维护 40 位 SHA + 逐字 subject，无 self-reference。

## 1. 发现处置表（27 条 → 任务映射）

编号：I*（Important）；A*（脚本实现域 Minor）；T*（测试域 Minor）；D*（技能文档域 Minor）；P*（流程产物域 Minor）；H*（pre-push 域 Minor）。

| # | 发现（文件:行） | 处置 | 任务 |
| --- | --- | --- | --- |
| I1 | templates 6 处 phase 5-8 `check-artifact-gate.ts` 调用缺 `--scope`：integration-test.md:19,55；system-test.md:57；acceptance-test.md:21,83；coding.md:20 | 补 `--scope=<change-scope.json>`（requirement-spec.md:295 为 `--phase=1` 不动） | 1 |
| I2 | L0/L1 链接边界新语义无权威落点：SSoT 与 INSTALL grep 0 命中 | SSoT 新增权威小节 + INSTALL §2 同步 + w-model-dev 侧改引用 | 1 |
| A1 | l0 内联链接 `<target> "title"` 形态 title 切分顺序错误致 `>` 残留（l0-link-audit-logic.ts:62-66） | 先按 title 切分、再 `^<(.*)>$` 整对剥离；补正反例 | 2 |
| A2 | reference 定义漏 `[a]:./x.md`（冒号后无空白）与目标换行两形态；单字母 scheme（`C:temp`）逃过包含性检查（:56, 23-25, 81-83） | 补两形态解析；单字母 scheme 不按 URI 放行 | 2 |
| A3 | `isCodeOrTestFile` 漏无扩展名可执行脚本（change-scope.ts:140-179） | `.githooks/` 路径前缀判 code；补测试 | 2 |
| A4 | parse-args 重复 flag 静默取第一个（parse-args.ts:8-12） | 重复 flag → `ARG_INVALID`/exit 2，消息含 flag 名；翻转旧预期用例 | 3 |
| A5 | LEGACY_VARIANT 吸收无新旧分界（run-log-logic.ts:348-366,442-448） | 截止常量 `2026-09-01T00:00:00Z`；≥ 截止且缺 variant 的 emergency-fix → blocking | 3 |
| A6 | check-artifact-gate.ts:431-468 逐字复刻 load-cli-scope invalid 分支；根因 `LoadedCliScope` 缺 `attemptedChangeId`（load-cli-scope.ts:26） | helper 补字段，四调用方统一走 `loadCliScope`；输出等价（E2/E3 守护） | 3 |
| A7 | changeId/phase 归属不符：manifest 模式 exit 1 vs 薄封装 exit 2（change-scope.ts:396 vs 411-421） | 行为不变，文档化判别规则（CLI 参数互斥矛盾=2；scope 文件内容冲突=1），代码注释 + command-reference | 3 |
| A8 | `isIsoDateTimeString` 比 ajv-formats 更严（change-scope.ts:42-49） | 行为不变，注释 + 相关 schema description 声明「以 TS 层为准」 | 3 |
| T1 | change-scope.test.ts:624-632 无效环境自检（死准备 + 仅断言 `git --version`） | 改造为真断言（非 Git 目录 fail-closed）；若不可行则删除并同步 run-sync manifest | 4 |
| T2 | artifact-gate-external.test.ts:244-269 E5b 名不副实（未真传 externalChecks） | options 真传历史形状 `externalChecks: {...} as never` | 4 |
| T3 | docs-consistency-logic.test.ts:2877-2932 pre-push 源契约纯文本断言脆弱 | describe 加定位注释（行为级覆盖在 platform-deps-hook.test.ts，此处为文本级补充防线） | 4 |
| T4 | examples-contract.test.ts 261-273/433-445 重复循环、311/502/606 三套扫描器、483-489 恒真 `includes('r')` | 合并循环、扫描器参数化收敛、删恒真；断言语义不变 | 4 |
| T5 | run-sync.ts:295-328 新增 4 条测试内 execSync 行号级登记 | 随 T1 改造消解或同步行号 | 4 |
| T6 | check-codegraph-queries.test.ts:345/357/375/387 C10b/C10c 用 `new Date()` 墙钟 | 固定时间戳（scopeCreatedAt 与 queryTimestamp 用常量锚定先后） | 4 |
| D1 | graph 缺失归因为 D8 不准（phase-2-system-design.md:201、phase-3-outline-design.md:229、phase-4-detailed-design.md:169） | 改为「phase≥2 缺 `--graph` → ARG_INVALID/exit 2（D8 的数据源）」 | 6 |
| D2 | 失败链全句在 20+ 文件内联约 200 次 | 全量锚点化（见 §7） | 6 |
| D3 | 失败链套用到豁免 reject 等非 V/G 失败场景（phase-1-requirements.md 两三处） | 改回「reject → 回到对应审批阶段/原规则」朴素表述 | 6 |
| D4 | command-reference.md:50「须更新自然退出契约测试」误挂 L0/L1 审计节末尾 | 移回 :40 生产 CLI exit 1 段落 | 6 |
| P1 | CONTRIBUTING.md:68「samples/ 目录下 262 条样本」口径歧义 | 改「262 条 self-test 运行用例（samples/ 为 fixture 载体）」 | 5 |
| P2 | acceptance 记录 9 个 SHA 双表登记（父链表 + 轮次子表 311-321）无注记 | 轮次子表加「父链表子集（轮次视角）」注记 | 6 |
| H1 | pre-push 4 处 git 命令缺 `-c core.quotePath=false`（147/211/220/251 行） | 补齐 4 处 | 5 |
| H2 | E404 未纳入 audit 瞬态 skip（387 行） | `code E404` 且输出含 registry/advisories 上下文才 skip；纯 E404 不 skip | 5 |
| H3 | skip 正则状态词分支（Bad Gateway 等）无同行锚定（387 行） | 补 `network|registry|request` 同行上下文锚定 | 5 |
| H4 | npm 7 形态 `npm warn audit network ...` 不命中 skip | 前缀后允许 `audit ` 再 `network` | 5 |
| H5 | CONTRIBUTING.md:161「纯归档/规划目录改动才直接放行」与实现及三处活体文档矛盾 | 改为过包含口径（`docs/*.md` 的 `*` 跨 `/`，归档/规划目录 .md 实际触发） | 5 |

## 2. 任务 1：Important 修复（纯文档）

- **I1**：6 处调用补 `--scope=<change-scope.json>`，占位符写法与 `templates/coding.md:79`、examples 阶段示例一致；不引入新的路径约定。
- **I2**：SSoT 在交付边界相关章节新增「L0/L1 链接边界」小节：定义 L0（面向用户的 references/templates/SKILL 等 Markdown）中指向 `scripts/`、`samples/`、`tools/` 的链接为 L1-only 导航、不得计入 L0 全链接通过；登记 `npm run audit:l0-links [-- --root=]` 审计入口与退出码语义。`docs/INSTALL.md` §2 交付层定义处同步一句。`SKILL.md:19`、`command-reference.md:40-50`、`quickstart.md:15,19` 既有表述追加/改为链接引用 SSoT 权威落点（不改语义）。

## 3. 任务 2：l0 解析器 + 变更分类（行为变更，收紧方向）

- **A1**：内联链接解析顺序修正——先按 title（`"..."` / `'...'`）切分，再对 target 整对应用 `^<(.*)>$` 剥离尖括号；`[a](<./x.md> "t")` 必须解析出 `./x.md`。正反例进单测。
- **A2**：reference 定义补两形态——冒号后空白可选（`[a]:./x.md`）与目标位于下一行（定义行只有 label+冒号，取后续非空行首个 token 为目标）；单字母「scheme」（如 `C:temp`）不再按 URI 放行，改走包内相对路径包含性检查。已有「已知近似」注释同步更新（`%23`/`%2F` 不解码近似保留）。
- **A3**：`isCodeOrTestFile` 增加路径规则：`.githooks/` 前缀 → code（覆盖 `pre-push` 等无扩展名 shell）；不引入通用无扩展名猜测（YAGNI，仓库现无 `.github/workflows`）。补正反例（`.githooks/pre-push` 改动须被 codegraph 查询覆盖；`.gitignore` 不须）。
- 同步 `l0-link-audit-logic.test.ts`、`change-scope.test.ts`、`audit:l0-links` 相关 CLI 测试与 samples README 覆盖矩阵（若新增 fixture）。

## 4. 任务 3：parse-args / LEGACY_VARIANT / 等价重构（行为变更 + 重构 + 口径文档）

- **A4**：`parseCliArgs` 对同一 flag 二次出现返回 `ARG_INVALID`（exit 2），错误消息含重复 flag 名与 `ERROR_JSON`；全 CLI 生效。先全仓扫描依赖「重复取第一个」的既有用例并翻转预期；`load-cli-scope` 的 scope 装载路径受益（`--scope=a --scope=b` 不再静默取 a）。
- **A5**：`run-log-logic.ts` 引入导出常量 `LEGACY_VARIANT_CUTOFF = '2026-09-01T00:00:00Z'`（42.2.1 发布日）；`action=emergency-fix` 且无 `variant` 且 `timestamp >= cutoff` → blocking violation（沿用现有 violation 文案风格）；`< cutoff` 维持 `LEGACY_VARIANT` diagnostic 吸收。正反例各一进 `run-log-logic.test.ts`；`data-models.md` 与 `command-reference.md` 相应句同步。
- **A6**：`LoadedCliScope` 增加 `attemptedChangeId: string | null`；`check-artifact-gate.ts:431-468` 复刻分支删除，统一走 `loadCliScope`；四个调用方（artifact-gate / codegraph / opsx / archive）逐一对齐。行为等价判据：现有 E2/E3（scopeProvidedButFailed）与各 CLI exit-2 用例输出逐字段不变。
- **A7**：不改行为。`change-scope.ts` 两处分支加注释 + `command-reference.md` 增补判别规则：「CLI 参数互相矛盾（如 `--change` 前缀与 `--phase` 不符）= ARG_INVALID/exit 2；scope 文件内容与 Git/flag 冲突 = violations/exit 1」。
- **A8**：不改行为。`isIsoDateTimeString` 上方注释声明「较 ajv-formats date-time 更严：拒小写 t/z；同一字段族以 TS 层为准」；`codegraph-query.schema.json` / `change-scope.schema.json` 的相关字段 description 同步一句。

## 5. 任务 4：测试质量组（不改产品行为）

- **T1**：`change-scope.test.ts:624` 用例改造为真断言——在临时非 Git 目录构造 scope 装载，断言 fail-closed 违规（复用既有 makeGitProject 反向场景）；若实现不可行则删除该用例并同步删除 run-sync manifest 对应行（T5 随动）。禁止保留只断言 `git --version` 的空壳。
- **T2**：E5b 的 `options` 真传 `{ phaseOption: 5, externalChecks: { codegraphQueriesValid: true } } as never`，断言不被读取。
- **T3**：pre-push 源契约 describe 顶部加注释：行为级覆盖位于 `platform-deps-hook.test.ts`，本组为文本级补充防线，变量重命名即红属预期。
- **T4**：`examples-contract.test.ts` 合并 261-273 与 433-445 两个相同循环为一个参数化用例；三套失败链扫描器（311/502/606）收敛为带参数的单实现；删除 `directBypass` 中恒真 `normalized.includes('r')`。合并后断言语义与覆盖文件集不变（逐断言对照）。
- **T6**：C10b/C10c 的 `queryTimestamp`/`scopeCreatedAt` 改为固定常量（保证 queryTimestamp ≤ scopeCreatedAt 的既有方向），消除墙钟回退 flake。
- vitest 用例总数如变化，如实登记于任务报告与台账（不影响 self-test 262 口径）。

## 6. 任务 5：pre-push 收紧 + CONTRIBUTING 口径

- **H1**：`git diff --name-only` / `git log --name-only` 共 4 处（147/211/220/251 行）统一前插 `-c core.quotePath=false`。
- **H2**：audit skip 判据加 E404：仅当输出同时含 registry/advisories 上下文（如 `npm error code E404` + `404 Not Found - GET https://registry.../-/audit` 形态）才跳过；纯 E404（无上下文）不跳过（保守阻断）。
- **H3**：状态词分支（`Bad Gateway|Service Unavailable|Gateway Time-?out|Internal Server Error`）要求同行含 `network|registry|request` 之一才判瞬态。
- **H4**：skip 前缀匹配允许 `npm (error|warn|err!) ` 后跟 `audit ` 再 `network`（npm 7 形态）。
- **测试**：把终审实测的 23 组 audit 样例（`found 0 vulnerabilities`、真实漏洞+5xx 混合、E404 有/无上下文、`npm warn audit network`、blocking 优先不变量等）沉淀为 `pre-push audit skip boundary` 表驱动组，加入 `platform-deps-hook.test.ts`。
- **H5+P1**：`CONTRIBUTING.md:161` 改过包含口径（`docs/*.md` 的 `*` 跨 `/`，`docs/changes`、`docs/superpowers` 的 .md 实际触发门禁）；`:68` 改「262 条 self-test 运行用例」。

## 7. 任务 6：失败链锚点化 + 措辞收尾 + 台账

- **D2 锚点化**：
  - 权威定义落 `w-model-dev/references/hard-constraints.md`：新增小节「普通 V/G 失败链（标准返工链）」，给全句与逐环节含义（对应反模式 #10/#18/#19/#44 的约束语境）；`conventions.md` 术语表加「普通 V/G 失败链」词条指向该锚点。
  - 短引用形态：正文用「走普通 V/G 失败链（hard-constraints.md §普通 V/G 失败链）」；表格内用「普通 V/G 失败链（hard-constraints）」。计划阶段定死两个形态的字面量，替换按字面量机械执行。
  - 替换范围：references/templates/SKILL.md 中与全句逐字等价（含全句作为子串的行）约 200 处；**examples/ 保留全句**（教学自包含，且 `examples-contract.test.ts` 的失败链扫描器契约不受影响）。
  - 前置探测：先 grep `docs-consistency-logic` / `examples-contract` 测试与 `check-docs-consistency.ts` 是否断言 references 中的失败链全句；有则同步断言为短引用形态。
  - 回归：prettier + `audit:l0-links`（新增大量内部链接）+ `check-docs-consistency` + 全量。
- **D1**：3 处 graph 归因措辞修正。
- **D3**：phase-1 两三处豁免 reject 场景改朴素表述（「reject → 回到对应审批阶段/原规则」），不套完整链。
- **D4**：`command-reference.md:50` 句子移回 :40 段落末尾。
- **P2**：acceptance 轮次子表（311-321）上方加一句「本表为父链表子集（轮次视角），机器审计请以父链表为准」。
- **台账**：CHANGELOG 42.2.1 节 + acceptance 父链表补 `11944cd`/`e6de501`/`f7f0bba` 三行（上一战役收口提交），随后按提交逐行追加本战役全部提交；零豁免延续；本战役自身的台账收口提交按约定由下一轮活动链接。

## 8. 验收矩阵

1. 定向负例（新增测试全绿）：l0 内联 title 形态、`[a]:./x.md`、目标换行、`C:temp`、`.githooks/pre-push` 须覆盖、重复 flag ARG_INVALID、cutoff 前后 emergency-fix、E404 有/无上下文、状态词无锚定不跳过、npm7 形态跳过、非 Git 目录 fail-closed、E5b 真传形状。
2. 全量回归：`npx vitest run --config config/vitest.config.ts`、`npm run self-test`（262）、`npm run eval`（25）、`npm run typecheck`、`npm run lint:security`、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`、`npm run audit:l0-links`、`npm run doctor`、`npm audit --audit-level=high`、最终 `npm run prepush` 17 项全绿；已知负载敏感 flake 只隔离重跑并如实记录，不放宽 gate。
3. 独立终审：范围 = 本战役 BASE（f7f0bba）..新 tip 的全部提交；0 Critical / 0 Important 且 Minor 有明确处置后，经用户同意本地 ff-merge；不 push。

## 9. 交付边界（不包含）

- 版本 bump 与依赖变更（package-lock 仅随既有状态，不主动升级）。
- 推送远端。
- 范围外观察项：根目录 `.superpowers/` 27 个历史已跟踪文件的清理（独立动作，本轮不动）。
- examples/ 失败链全句的锚点化（有意保留全句）。
- metrics-report / wm-status 空日志查询语义、legacy 开关等未列入发现表的行为。
