# 批次 3 易用性优化验收记录（3dim 优化）

> **Implementation reviewed HEAD:** `32fe35b`（`32fe35b2c6eb241be5f7a0df685d400dbb20a27b`，batch3-3dim worktree `.worktrees/b3-3dim`）
> 本记录主体针对的验收 HEAD 是包含全部批次 3 提交链与收尾 S-fix 的最终 HEAD；commit 身份链与门禁矩阵证据均针对此 HEAD 实测。
> **Parent baseline:** `cc7d6ba`（`docs(agents): close batch-2 handoff, prep batch-3 ...`，main，批次 2 收尾交接）；另主仓 main HEAD=386759b（batch-3 handoff 已在 main 开放，合并时带入）。
> 本记录只收录本批次实际执行的命令与结果；未执行的命令不作通过声明。

## 变更范围（Task 3.0–3.6 + 收尾）

- **wave-1 合并（44b8bee）**：TLA+ 5 文件 → `tla-plus.md`；BDD 4 文件 → `bdd.md`；anti-patterns 48 条并入 `hard-constraints.md`；角色细则 4→2（dispatch-matrix 并入 subagent-delegation、persona 矩阵并入 agent-personas）。
- **wave-2 合并（962931e）**：conventions（术语表 + 格式 + 目录约定）、coding-quality（设计模式 + 重构 + 坏味道）、quick-self-check（+DoD）三合一。
- **SKILL.md 整文件重写（9dc9757）** → 139 总行 / 106 非空行（见下「SKILL.md 非空行数实测」；计划验收线 <100，实测 106，如实登记为偏差）。
- **新增 `references/quickstart.md`**。
- **门禁契约与 eval 锚点同步（6a2d6bd）**：docs-consistency 13 项契约闭合、eval/mappings.json 4 处锚点随 rename 更新。
- **e2e 终值（Task 3.6）+ 版本 42.0.0（148193e）+ 收尾 S-fix（32fe35b）**。
- 未改：`.w-model/` 证据协议、`package.json` 门禁脚本清单之外的脚本行为（收尾 S-fix 仅改 docs-consistency-logic 锚定匹配与 R10 探针预算，见 Deferred 4/1）。

## references 实测（验收线 ≤40 实质文件）

- `w-model-dev/references/` 共 **58 个** `.md` 文件。
- **实质内容文件（>2 行）39 个**：≤40 验收线通过；「>2 行排除重定向 stub」的口径与计划 Task 3.4 触发判据一致。
- **19 个重定向 stub**（wave-1 12 + wave-2 7；计划预估「10」为低估，实际以上为准）→ 42.1.0 清理待办（Deferred 3）。每个 stub 均为 2 行：HTML 注释「42.0.0 重构：本文件已合并至 X；本重定向指针将于 42.1.0 移除」+ 一行指向链接。逐条 redirect 目标：

| 重定向 stub（19） | 目标文件 |
|---|---|
| tla-plus-guide / tla-plus-syntax-reference / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-tlc-configuration（5） | `tla-plus.md` |
| bdd-guide / bdd-syntax-reference / bdd-patterns-examples / bdd-review-checklist（4） | `bdd.md` |
| anti-patterns（1） | `hard-constraints.md` |
| dispatch-matrix（1） | `subagent-delegation.md` |
| subagent-persona-matrix（1） | `agent-personas.md` |
| glossary / format-conventions / directory-conventions（3，wave-2） | `conventions.md` |
| design-patterns-catalog / refactoring-catalog / code-smells-checklist（3，wave-2） | `coding-quality.md` |
| definition-of-done（1，wave-2） | `quick-self-check.md` |

## SKILL.md 非空行数实测

- `w-model-dev/SKILL.md`：139 总行 / **106 非空行**（`grep -cv '^[[:space:]]*$'`；139 - 33 空行 = 106 非空行）。
- frontmatter `version: 42.0.0`。
- **偏差登记**：设计 §4.1 目标「173 → <100」非空行，实际交付 106（较原 173 非空行仍 ↓39%）；批次内已验收，口径与差距在本记录如实声明（Deferred 2）。

## eval 终值 vs 基线对比

`eval/w-model-dev-results.tsv` 两行真实数据：

| 时间 | commit | 模式 | score | note |
|---|---|---|---|---|
| 2026-08-28T18:26:08+08:00 | `28da1d1` | baseline（批次 1） | 100.0 | npm run eval 25 提示词映射 |
| 2026-08-30T10:30:00+08:00 | `6a2d6bd` | baseline（批次 3） | 100.0 | wave 合并重链 + SKILL.md 重写后评估锚点同步，25/25 |
| 2026-08-30T10:30:00+08:00 | `6a2d6bd` | e2e_rebuild（终值） | — | 8 阶段从零重建第 4 轮终值（todo-rest-demo L2，仓内 eval/e2e/demo-final）；真实执行 74/74（UT35+IT17+ST11+UAT11，coverage 97.56/98.00/95.45/97.67）；8 阶段 verifier 全 A（0.9295/0.8770/0.886/0.894/0.8757/0.8942/0.9028/0.9057）；门禁全绿零常驻红灯（基线 D9 cucumber 红灯由真实报告通道消除）；返工 8 项（1 R 循环 tla-bdd-sync + 7 R3-Required S-fix）；偏差 UAT-002 过度收紧裁定（D7 谱系）+ 超限体 ECONNRESET src 修复；新 SKILL.md（106 行）易用性收益：分派 ≈52 vs 基线 ≈74、CHECKPOINT 18；记录 eval/e2e/2026-08-28-final.md |

## e2e 两次指标对比

基线（批次 1 `eval/e2e/2026-08-28-baseline.md`，a9808ea）vs 终值（批次 3 `eval/e2e/2026-08-28-final.md`，6a2d6bd，同一 SPEC 对照基线）

| 指标 | 基线（批次 1，a9808ea） | 终值（批次 3，6a2d6bd） |
|---|---|---|
| 8 阶段 verifier | 全 A：0.8675/0.9002/0.9044/0.9108/0.9255/0.925/0.928/0.916 | 全 A：0.9295/0.8770/0.886/0.894/0.8757/0.8942/0.9028/0.9057 |
| 四级测试 | 74/74（UT35+IT17+ST11+UAT11，cov unit 98.22） | 74/74（coverage 97.56/98.00/95.45/97.67） |
| 返工 | R 循环 3（RC-phase2/5/6） | 返工 8 项（1 完整 R 循环 tla-bdd-sync + 7 R3-Required S-fix） |
| 分派（易用性核心指标） | ≈74 | **≈52（↓约 30%）** |
| CHECKPOINT | 未单列 | 18（判据代行） |
| 常驻红灯 | D9=cucumber 证据不可满足（已知红灯） | **D9 消除（真实报告通道，零常驻红灯）** |
| 偏差 | D1-D11 | UAT-002 过度收紧裁定（D7 谱系）+ 超限体 ECONNRESET src 修复 |

## 门禁矩阵真实执行记录

在最终 HEAD `32fe35b` 实测，全部真实退出码：

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm run eval` | exit 0，25/25 | 评估锚点与重命名布局一致 |
| `npm run self-test` | exit 0，260/260 | |
| `npm run typecheck` | exit 0 | `tsc -p config/tsconfig.json` |
| `npm run lint:security` | exit 0，新增发现 0 | 批次 3 自引入 2 条 detect-non-literal-regexp 经收尾 S-fix 清零（见 Deferred 4） |
| `npm run check:docs-consistency` | exit 0，静态 0 / 动态 0 | 1241 vitest 全过；过程中 2 次因负载 flake 报动态违规 1（state-write-logic 锁测试 + R10 探针超时），隔离均绿，最终干净运行 exit 0（见 Deferred 1） |
| `npm run check:gate -- --validate-templates` | exit 0，`GATE_JSON {"passed":true}` | |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | exit 0，280 fixtures / unregistered=0 | |
| `npm run prepush` | exit 0，17 项门禁全绿 | 含 vitest+coverage 1241、npm audit、prettier、tsc；首两轮因同批负载 flake 中断，S-fix + prettier 后全绿 |

## commit 身份链（worktree batch3-3dim，基于 main cc7d6ba）

| commit | 说明 |
|---|---|
| `44b8bee` | `refactor(references): wave-1 merge`（TLA+ 5→1 / BDD 4→1 / anti-patterns→hard-constraints / 角色 4→2） |
| `9dc9757` | `refactor(skill): rewrite SKILL.md + quickstart` |
| `962931e` | `refactor(references): wave-2 merge`（conventions / coding-quality / quick-self-check+DoD） |
| `6a2d6bd` | `refactor(gates): sync docs-consistency contract, eval anchors` |
| `855457a` | `docs(agents): sync AGENTS.md §0`（batch-3 in-flight handoff） |
| `148193e` | `release: 42.0.0 - 3dim optimization`（final eval + version bump + CHANGELOG） |
| `32fe35b` | `fix(scripts): zero batch-3 security findings + harden load-sensitive R10 probe + prettier` |
| （本记录提交） | `docs(changes): batch-3 usability acceptance record`（all gates green） |

## 证据与 provenance 级别

- Implementation reviewed HEAD `32fe35b`；门禁矩阵、prepush 与 eval 均在该 HEAD 实测（e2e 终值在 `6a2d6bd`，属提交链内上游）。
- package-only provenance / source-bound provenance：未生成、未验证（本批次不改 `.w-model/` 证据协议，与 b2 对齐）。
- `.githooks/pre-push --force` 以控制台方式执行并通过，未实际 `git push`。

## 合并后 main 收尾（merge 2b8743e + ffd5164）

批次 3 全部提交链（44b8bee..32fe35b + 本验收记录 67e2d6d）合并回 main 后，main 上追加两个 commit 方达最终全绿状态：

| commit | 说明 |
|---|---|
| `2b8743e` | `merge(batch3): merge 3dim batch-3 (usability rewrite + final eval + v42.0.0) into main`（--no-ff；AGENTS.md §0 删除与 main 的 batch-3 handoff §0 冲突，按批次 3 最终版解决——§0 删除、§1/§2 eval 终值引用保留） |
| `ffd5164` | `fix(scripts): exclude .worktrees from docs-consistency fixture copy`——**合并后在 main（而非 worktree）终值验证首次暴露的测试基础设施缺陷**：`withDocsConsistencyFixture` 的 `cpSync` 深度复制仓库根，filter 未排除 `.worktrees/**`，而 main 根含 b1-3dim/b3-3dim 两个完整观望 checkout（含 node_modules），导致 docs-consistency CLI 真实探针测试在主仓根下 30s 超时（隔离 37s+ vs worktree 内 14s）。S-fix 排除 `.worktrees` 后探针降回 13-15s，单文件 152/152 全绿。终值 main prepush 17 项全绿。 |

最终 main 验收：`npm run eval` 25/25、`npm run self-test` 260/260、`npm run prepush` 17 项全绿（含 vitest+coverage 1241、npm audit、prettier、tsc、docs-consistency）。

## Deferred concerns

1. **残余负载敏感 flake（环境容量问题）**：state-write-logic 锁并发测试与 docs-consistency R10 真实执行探针在全量 16 worker + coverage 插桩极限负载下偶发单条超时（本批次验收中出现 4+ 次失败运行，失败测试随机不固定、隔离全绿、末轮经 per-test 90s 预算加固后 prepush 全绿）。延续批次 2 Deferred 1，非技能代码缺陷；R10 探针已加 per-test budget 显著降频，暴露原因是批次 3 wave 合并使真实源文件变大。此处如实记录，不作「零偶发」声明。
2. **SKILL.md 106 非空行 vs 计划 <100**：实际交付超出验收线（较原 173 行仍降 39%），批次内已验收，记录中如实声明；后续如有硬性 <100 要求可再收敛。
3. **19 个重定向 stub（计划预估 10）待 42.1.0 清理**：已在 CHANGELOG 42.0.0 登记，跳转指针保留以引导旧路径。
4. **lint:security 批次 3 自引入 2 条清零方式**：docs-consistency-logic `checkHardConstraints` 从 `includes` 改 `new RegExp` 锚定匹配被 detect-non-literal-regexp 捕获 2 条；按修代码先例（不重生成 baseline）清零，feature 校验语义等价。
5. **UAT-002 过度收紧裁定（D7 谱系）**：验收测试 UAT-002 仅断言空白 title 被过度收紧，经 O 裁定冻结规格权威修正为 201 断言；与超限体 ECONNRESET src 修复同批次登记，均为生产化前升级项。
