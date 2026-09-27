# 门禁/测试瘦身 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
> 规格：`docs/superpowers/specs/2026-09-27-gate-thinning-design.md`（本计划是它的逐任务展开；冲突时以规格为准并回来改计划）。
> 账本（gitignored）：`.superpowers/sdd/2026-09-27-gate-thinning/progress.md`（首行身份 + 逐任务 `Task N: complete`）；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`。
> **2026-09-28 追加（规格 §9，用户裁定「禁止为了 hash 而 hash」）**：新增**任务 9（WS-T7 去 hash 化）**，须在**任务 8 收口之前**完成；任务 8 的 CHANGELOG 须追加 T7 小节后重跑全量 prepush。
> 回归纪律（约束 #14）：任何 `.ts` 文件 `Edit`/`Write` 前先经 codegraph CLI 查询目标符号影响半径并落 `.w-model/codegraph-queries/`；每组结束跑定向 vitest，任务 8 跑全量 `npm run prepush`。
> 行号说明：文中 `:N` 为编写计划时的实测锚，实现时以符号/短语搜索为准；漂移不构成偏差。

**目标：** 对校验机制做外科手术：删手写登记抄本（T1）、去计数常量（T2）、独立运行提速（T3）、8 簇 pointer 化（T4）、注释计数清扫（T5）、流程约定（T6）——留牙齿、砍记账；终局全量 prepush 全绿。

**架构：** 先做三项机制瘦身（T1-T3，行为面），再做文档 pointer 化（T4，三域分批），最后清扫与约定（T5/T6）与收口。每处删除在 CHANGELOG 登记「原牙齿 → 替代承载」（规格 §5）；删除测试逐条列「仍被覆盖 / 有意退休」。

**技术栈：** TypeScript（tsx runtime）、vitest、纯 Markdown 编辑。

---

## 文件结构（分解锁定）

| 文件 | 动作 | 任务 |
| --- | --- | --- |
| `w-model-dev/scripts/cli/check-samples-coverage.ts` | 修改（删锚机制、派生锚、收紧规则 4） | 1 |
| `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md` | 重写为 4 列 | 1 |
| `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts` | 修改（删锚测试、加派生/收紧断言） | 1 |
| `w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` | 删除 | 2 |
| `w-model-dev/scripts/__tests__/l0-link-audit-{cli,logic}.test.ts` | 修改（删计数断言） | 2 |
| `w-model-dev/scripts/cli/check-docs-consistency.ts` | 修改（默认不自 spawn + `--spawn-vitest`） | 3 |
| `w-model-dev/references/command-reference.md` | 修改（T3 条目 + T4 多簇权威/指针） | 3,4,5,6 |
| `w-model-dev/references/{operational-recovery,data-models,subagent-delegation,hard-constraints,phase-5-coding,conventions}.md` | 修改（T4 指针化 + T6 约定） | 4,5,6,7 |
| `w-model-dev/SKILL.md`、`w-model-dev/templates/coding-plan.md`、`w-model-dev/scripts/samples/README.md` | 修改（T4 指针化） | 5 |
| `AGENTS.md`、`docs/INSTALL.md`、`README.md`、`docs/skill-design-document_SSoT.md` | 修改（T4 指针化；token 契约保持） | 4,5,6 |
| `w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`、`docs/INSTALL.md`、`w-model-dev/scripts/__tests__/README.md` | 修改（T5 注释计数） | 7 |
| `w-model-dev/references/subagent-delegation.md` | 修改（T6 新短节） | 7 |
| `CHANGELOG.md` + 版本六镜像 | 修改（42.4.0） | 8 |

---

## 任务 0：开工准备

- [ ] **步骤 1：分支与账本**

分支 `feat/gate-thinning` 已存在（规格提交 `960abf06` 在其上，main 已复位干净）。账本首行：`plan=2026-09-27-gate-thinning phase=repo-maintenance`。

- [ ] **步骤 2：基线取证**

`npm run self-test 2>&1 | tail -1`（记录用例数）、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts 2>&1 | tail -1`（记录 fixture/rows/probes）、`git log --oneline -1`，写入账本。

---

## 任务 1：T1 登记册自动探针化

**文件：**
- 修改：`w-model-dev/scripts/cli/check-samples-coverage.ts`（锚机制段 :555-900 一带，以符号搜索为准）
- 重写：`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（46 行 → 4 列）
- 测试：`w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`

- [ ] **步骤 1：逐行审计（先产出表，再动手改）**

读 `NEGATIVE-COVERAGE.md` 全文 + `check-samples-coverage.ts` 的 `parseNegativeCoverage`/`validateEntries`，产出 46+ 行**逐行处置表**（写进任务报告）：每行给出 `门禁 | fixture | 机制 | 所防回归`（4 列新形态）与判定——① 该 fixture 在 self-test.ts 中是否为**期望失败**用例（`expectedPassed:false` / expectedReasonPatterns 命中；由 `collectCaseEntries` 条目读取）；② 非失败样本行（如 check-budget 的 `bad-duplicate-groups.jsonl` 诊断型 exit 0）→ **移行**（换真实失败 fixture）或**删行**（其门禁已有失败证据）；③ `invocation`/`mutated-copy` 机制的行的 fixture 字段语义逐行确认。此表是后续步骤的实现清单。

- [ ] **步骤 2：改门禁——删锚机制、加派生锚、收紧规则 4**

`check-samples-coverage.ts`：
1. 删除：`ANCHOR_SEPARATOR`、`ANCHOR_CITATION_PATTERN`、`LEGACY_LINE_CITATION_PATTERN`、`firstAnchorCitation`、`hasAnchorCitation`、`isPureCitationSegment`、`fixturePathInSegment`、`extractAnchorRefs`、`validateAnchorEvidence`、`validateCitation`（及仅被它们使用的类型 `AnchorRef` 等）；
2. `parseNegativeCoverage`：行解析改为 4 列（`门禁 | fixture | 机制 | 所防回归`）；列数 ≠4 或 fixture 列不含 `samples/` 路径 → 该行 malformed（沿用现 fail-closed 口径）；
3. `validateEntries`：保留 fixture 在盘 / self-test 覆盖（rule 1-3）/ 机制枚举；**新增**：每行 fixture 对应的 self-test 条目必须是期望失败（规则 4 收紧，非失败样本占行 → violation `negative-coverage-not-failing`）；fixture 被 self-test 覆盖**恰一处**（多义 → violation `negative-coverage-ambiguous-coverage`）；
4. **派生锚输出**：每行输出 `self-test.ts#<覆盖条目标识>`（由 `collectCaseEntries`/`entryCoversFixture` 计算，格式如 `self-test.ts#file: 'x.json'`）——进人类可读输出与 `SAMPLES_COVERAGE_JSON` 新键 `derivedAnchors`（数组，顺序 = 登记行序）。

- [ ] **步骤 3：改写登记册为 4 列**

按步骤 1 的审计表重写 `NEGATIVE-COVERAGE.md`：头部语法说明段同步（删锚引用/多锚语法描述，改为 4 列定义与派生锚说明）；46+ 行逐行改写；「所防回归」列文案保留（可能随移行微调）。

- [ ] **步骤 4：改测试**

`check-samples-coverage.test.ts`：删除多锚 6 例（G2-8）与锚校验相关既有例；新增：① 4 列解析 malformed 三态（列数/空 fixture/非 samples 路径）；② 非失败样本占行 → `negative-coverage-not-failing` exit 1；③ fixture 被两处 case 覆盖 → `negative-coverage-ambiguous-coverage`；④ `derivedAnchors` 输出与登记行序对齐（正例）。**删除清单逐条在报告写明**「仍被覆盖（指向）/ 有意退休（理由）」。

- [ ] **步骤 5：运行验证**

```bash
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts          # exit 0，48 探针零失败，输出含 derivedAnchors
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts
npm run self-test 2>&1 | tail -1                                    # 全绿（用例数较基线下降，记录差值）
```

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md w-model-dev/scripts/__tests__/check-samples-coverage.test.ts
git commit -m "refactor(gates): NEGATIVE-COVERAGE 手写锚机制整体移除，改派生锚+失败样本收紧（T1）"
```

## 任务 2：T2 · L0 计数去常量

**文件：**
- 删除：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts`
- 修改：`w-model-dev/scripts/__tests__/l0-link-audit-cli.test.ts`、`w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts`
- 审计：`grep -rn "l0-baseline\|L0_BASELINE" w-model-dev docs eval` 其余引用同步

- [ ] **步骤 1：审计引用面**

grep 全仓 `L0_BASELINE|l0-baseline`，列出全部消费者（预期：两个测试文件 + 可能注释）。逐条处置在报告登记。

- [ ] **步骤 2：改两测试文件**

删除 `import { L0_BASELINE }` 与全部计数断言（`expect(result.relativeLinkCount).toBe(...)` / `toHaveLength(L0_BASELINE.*)`）；**保留** `violations` 相关断言与全部负例（悬空链接、L1 隔离、占位符形态）。若断言块前有「基线三数单一事实来源见 helpers/l0-baseline.ts」注释 → 删除。

- [ ] **步骤 3：删除 helper 并跑定向**

```bash
git rm w-model-dev/scripts/__tests__/helpers/l0-baseline.ts
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-cli.test.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts
npm run audit:l0-links    # 计数仍在输出（可观测），violations 0
```

- [ ] **步骤 4：Commit**

```bash
git add -A w-model-dev/scripts/__tests__/
git commit -m "refactor(tests): L0 链接计数基线整体移除，保留 violations 牙齿（T2）"
```

## 任务 3：T3 · docs-consistency 独立运行提速

**文件：**
- 修改：`w-model-dev/scripts/cli/check-docs-consistency.ts`（自采集路径 :537-620 一带）
- 修改：`w-model-dev/references/command-reference.md`（docs-consistency 条目）
- 测试：覆盖自采集回退的用例（grep `spawn|自采集|WM_VITEST` 于 `__tests__/`）

- [ ] **步骤 1：改 CLI 回退语义**

`check-docs-consistency.ts`：参数解析新增 `--spawn-vitest`（布尔）。动态 facts 组装处（现 :560-600 一带）三态改为：
1. `WM_VITEST_COUNT_FILE` 在场 → 受控工件快路径（**一字不变**，fail-closed）；
2. 不在场且 `--spawn-vitest` → 现有自采集路径（**一字不变**）；
3. 不在场且无 flag → **不再 spawn**：向 `diagnostics` 推入
   `○ 动态 facts 未校验：未提供受控 vitest 工件（WM_VITEST_COUNT_FILE / WM_VITEST_PROVENANCE_FILE）；终局验收经 npm run prepush 覆盖（fail-closed）。如需自采集请显式加 --spawn-vitest（约 30 分钟）。`
   动态通道跳过：`dynamicMeasurements` 置 **`null`**（JSON 键保持在场、形状稳定，消费者无需改）；静态检查全跑，退出码仅由静态违规决定。
4. 头注 :545-567 的自采集说明段落同步改写（三态表）。

- [ ] **步骤 2：同步测试与文档**

更新覆盖回退行为的测试：单测只覆盖「无 env 无 flag → 诊断 + exit 0（不 spawn）」与「有 env → 受控工件路径（既有用例不变）」；`--spawn-vitest` 只做参数解析断言（真采集由本任务验收步骤手工抽查一次，到工件生成为止，不必跑完）；`command-reference.md` 条目补「独立运行默认跳过动态 facts（诊断可见）；prepush 内 fail-closed；`--spawn-vitest` 逃生口」。

- [ ] **步骤 3：验证（含实测定时）**

```bash
time npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts           # 预期秒级 + 诊断行 + exit 0
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
```

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/references/command-reference.md w-model-dev/scripts/__tests__
git commit -m "refactor(gates): docs-consistency 独立运行默认跳过动态 facts（诊断可见），--spawn-vitest 显式逃生口（T3）"
```

## 任务 4：T4-A · 运行日志域 pointer 化（簇 ①③④⑤）

**文件（成员落点，先审计再动）：** `AGENTS.md`（§6 :133 / §8 :197）、`docs/skill-design-document_SSoT.md`（§10D.7 两处）、`w-model-dev/references/{data-models,operational-recovery,subagent-delegation,toolbox}.md`、`w-model-dev/scripts/cli/wm-append-runlog.ts` 与 `logic/run-log-append-logic.ts` 头注、`w-model-dev/scripts/cli/check-budget.ts` 注释、`w-model-dev/scripts/{cli/check-archive-integrity.ts,lib/types.ts,logic/archive-integrity-logic.ts}` 文案、`w-model-dev/references/command-reference.md`（部分簇的权威处）。

- [ ] **步骤 1：审计表（before→after）**

对四簇逐落点产出表（写进任务报告）：簇 ① 时间戳三态（枚举权威 = `command-reference.md` wm-append-runlog 条目）；③ parentDispatchId 键句与上界口径（权威 = `data-models.md` 用量实效校验（R6）段）；④ 记录边界前缀三态（权威 = `command-reference.md` check-archive-integrity 条目）；⑤ 预算接线口径（权威 = `data-models.md` R6 段）。每落点给出：保留摘要句（≤1 句，含义务）+ 指针句（`command-reference.md`「wm-append-runlog」/ `data-models.md`「用量实效校验（R6）」等锚串）+ 删除段范围。**例外不动**：代码注释降为「实现视角短描述 + 指针」但不得复制枚举；AGENTS 一级红线单句保留。

- [ ] **步骤 2：按表改指针落点**

按审计表执行（逐文件 grep 短语定位）。摘要句模板示例（时间戳三态）：「追加器对新增记录强制时间戳三态（②与③不得合并叙述；完整口径与逃生口语义见 `command-reference.md` 的 `wm-append-runlog` 条目）——① 显式 ≤ 末条拒绝；② 无显式且时钟真倒退拒绝；③ 无显式且同毫秒良性步进。」（保留 ①②③ 一句话级摘要，删去逃生口细节枚举/痕迹格式详表——详表归权威。）

- [ ] **步骤 3：grep 校验（权威外枚举命中 == 0）**

```bash
# 指纹示例（各簇逐一执行并记录于报告）
grep -rn "clock-injected:" --include="*.md" AGENTS.md docs/skill-design-document_SSoT.md w-model-dev/references | grep -v "command-reference.md"   # 预期仅摘要句/指针（0 详表段）
grep -rn "同 parentDispatchId 且键全同仍计组" --include="*.md" docs w-model-dev/references | grep -v "data-models.md"   # 预期 0（该细化口径只在权威）
```

- [ ] **步骤 4：验证与 Commit**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # 秒级（T3 后）；exit 0
npm run audit:l0-links                                      # exit 0
git add AGENTS.md docs/skill-design-document_SSoT.md w-model-dev/references w-model-dev/scripts
git commit -m "docs(pointer): 运行日志域四簇 pointer 化——时间戳三态/键句/记录边界前缀/预算接线（T4-A）"
```

## 任务 5：T4-B · 编码链与流程域 pointer 化（簇 ②⑥）

**文件：** `w-model-dev/references/{hard-constraints,subagent-delegation,phase-5-coding,command-reference,operational-recovery,data-models}.md`、`w-model-dev/SKILL.md`、`w-model-dev/templates/coding-plan.md`、`w-model-dev/scripts/samples/README.md`、`docs/skill-design-document_SSoT.md`。

- [ ] **步骤 1：审计表**

簇 ② 非空本质判定族（`isFile()` 且 `size > 0`；枚举权威 = `command-reference.md` check-coding-plan 条目）；簇 ⑥ 五门闭环与放行三步顺序（枚举权威 = `SKILL.md` 阶段门工作流）。逐落点表同任务 4 格式。

- [ ] **步骤 2：按表执行 + 例外**

注意：AGENTS 一级红线句（如「CHECKPOINT 不可绕过」）保留全文；`templates/coding-plan.md` 与 `samples/README.md` 属操作摘要面，改为「非空且为普通文件（`isFile()` 且 `size > 0`）——判定细则见 `command-reference.md` check-coding-plan 条目」。

- [ ] **步骤 3：grep 校验**

```bash
grep -rn "isFile() 且 \`size > 0\`" --include="*.md" w-model-dev/references w-model-dev/templates w-model-dev/scripts/samples AGENTS.md docs/skill-design-document_SSoT.md | grep -v command-reference.md   # 预期：仅 ≤1 句摘要处
grep -rn "严格晚于" --include="*.md" w-model-dev/references AGENTS.md docs/skill-design-document_SSoT.md | grep -v "SKILL.md"   # 预期仅摘要句
```

- [ ] **步骤 4：验证与 Commit**

同任务 4 步骤 4；commit message：`docs(pointer): 编码链与流程域两簇 pointer 化——非空判定族/五门闭环顺序（T4-B）`。

## 任务 6：T4-C · 证据与 codegraph 域 pointer 化（簇 ⑦⑧）

**文件：** `AGENTS.md`（§1 两节）、`docs/INSTALL.md`、`README.md`、`docs/skill-design-document_SSoT.md`（§7.10 与 :283）、`w-model-dev/references/{command-reference,phase-5-coding,hard-constraints,data-models}.md`。

- [ ] **步骤 1：审计表**

簇 ⑦ 导出白名单与 provenance 形态（枚举权威 = `command-reference.md` 导出条目；SSoT §7.10 只留设计决策与指针）；簇 ⑧ codegraph 降级契约（设计决策 = SSoT :283 段；操作枚举 = `command-reference.md` check-codegraph-queries 条目）。

- [ ] **步骤 2：按表执行 + token 契约保护（关键约束）**

**必须保持** `docs-consistency` 的 `localEvidenceDocs` token 子串不变：`本地生成物` / `默认不交付` / `npm run wm:export-evidence -- <project-dir> <output-dir>` / `脱敏` / `SHA-256` / `安全策略审阅` / `不会自动提交或发布` / `归档边界`。摘要句在保留这些 token 的前提下删枚举详表。

- [ ] **步骤 3：grep 校验 + token 速查**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # exit 0（token 契约未被破坏）
grep -rn "signature-chain.jsonl" AGENTS.md docs/INSTALL.md README.md | grep -v command-reference.md   # 预期：仅摘要句含白名单要点 + 指针
```

- [ ] **步骤 4：验证与 Commit**

同任务 4 步骤 4；commit message：`docs(pointer): 证据与 codegraph 域两簇 pointer 化——导出白名单/降级契约（T4-C）`。

## 任务 7：T5 + T6 · 注释计数清扫与流程约定

**文件：** `w-model-dev/scripts/cli/self-test.ts`（:17 注释）、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（头注耗时句）、`docs/INSTALL.md`（lib 计数句）、`w-model-dev/scripts/__tests__/README.md`（计数/耗时句）、`w-model-dev/references/subagent-delegation.md`（T6 新短节）。

- [ ] **步骤 1：清扫审计**

grep 模式 `\d+\s*(个|条|行|份|分钟)` 于注释/文档（`w-model-dev/scripts/**/*.ts` 注释、`docs/INSTALL.md`、`w-model-dev/scripts/__tests__/README.md`、`NEGATIVE-COVERAGE.md` 头注），排除：机器断言、门禁强制的计数契约（AGENTS 脚本数等）、CHANGELOG/docs/debug 历史。已知落点逐条处置：改自描述（「以运行输出为准」/公式）或删除。

- [ ] **步骤 2：T6 流程约定成文**

`subagent-delegation.md` 新增短节「任务合并与审查面」：① 纯文档任务（零 `.ts`/`.json`/schema/`.py`）合并为一个任务、单审查面；② 审查 minor 措辞类发现批量入账本、不进逐轮修复；③ 计划头部注明文档组可合并分派条件。

- [ ] **步骤 3：验证与 Commit**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # exit 0
npm run self-test 2>&1 | tail -1                             # 全绿（self-test 仅动注释）
git add -A w-model-dev docs/INSTALL.md
git commit -m "docs(hygiene): 无门禁强制的易漂计数清扫 + 任务合并/审查面流程约定（T5/T6）"
```

## 任务 8：收口（CHANGELOG、版本、全量验收）

**文件：** `CHANGELOG.md`、版本六镜像（`package.json` / `package-lock.json` / `w-model-dev/SKILL.md` / `w-model-dev/skill-metadata.json` / `docs/INSTALL.md` / `README.md`）。

- [ ] **步骤 1：CHANGELOG 登记**

新增 `## [42.4.0] - 2026-09-27` 节（行为可见的门禁变更 → minor bump）：「门禁/测试瘦身」小节，逐 WS 登记：T1（原牙齿 = 手写锚校验 → 替代 = 派生锚 + 恰一处覆盖 + 失败样本收紧；**批间关系声明**：移除清收批 G2-8 多锚机制并注明理由）；T2（原牙齿 = 计数检测 → 替代 = violations 检测；rebaseline 协议退役）；T3（语义降级登记：独立运行弱校验 + 诊断，前提「终局一律 prepush」，`--spawn-vitest` 逃生口）；T4（8 簇 pointer 化 + 权威表 + 例外清单）；T5/T6。附「删除测试处置清单」摘要（完整清单指向账本任务报告）。

- [ ] **步骤 2：版本六镜像 bump 42.3.0 → 42.4.0**

`npm version 42.4.0 --no-git-tag-version` + SKILL.md frontmatter + skill-metadata.json + INSTALL.md 镜像 + README「当前版本」——**六处全部**（先例教训：漏一处即被 version-consistency 两门拦截）。

- [ ] **步骤 3：终局全量验收**

```bash
npm run prepush                                             # 19 项 exit 0
time npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # 秒级 + exit 0（独立运行新语义实测）
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts   # exit 0
```

任一红 → 修复后重跑全量；不得只重跑单项。

- [ ] **步骤 4：账本收尾**

`.superpowers/sdd/2026-09-27-gate-thinning/progress.md` 逐任务 `Task N: complete` + 删除清单/计数差值（vitest 用例数变化）登记；三件套齐备核对。

- [ ] **步骤 5：Commit**

```bash
git add CHANGELOG.md package.json package-lock.json w-model-dev/SKILL.md w-model-dev/skill-metadata.json docs/INSTALL.md README.md
git commit -m "docs(changelog): 门禁/测试瘦身登记（牙齿替代对照 + 42.4.0 版本六镜像）"
```

---

## 任务 9：WS-T7 · 去 hash 化（run-log 记录级哈希链与放行锚移除）

> 依据：规格 §9（2026-09-28 用户裁定「禁止为了 hash 而 hash」+ §9 全仓 hash 机制审计表）。**本任务在任务 8 收口之前执行**；任务 8 的 CHANGELOG 追加 T7 小节后重跑全量 prepush。

**文件：**
- 修改：`w-model-dev/schemas/run-log.schema.json`（删 `prevRecordHash` / `recordHash` / `runLogAnchor` 三字段及描述分支；`schema 34` 不变）
- 修改：`w-model-dev/scripts/logic/run-log-append-logic.ts`（链/锚计算与 scan）、`w-model-dev/scripts/logic/run-log-logic.ts`（R7 链复算段与放行锚校验段）
- 修改：`w-model-dev/scripts/cli/wm-append-runlog.ts`、`w-model-dev/scripts/cli/check-run-log.ts`、`w-model-dev/scripts/lib/run-log-append-fs.ts`（`digestOf` 按消费者审计：无消费者则移除）
- 修改（文档）：`w-model-dev/references/{data-models,command-reference,operational-recovery,hard-constraints,signature-chain-guide}.md`、`AGENTS.md`、`w-model-dev/SKILL.md`、`docs/skill-design-document_SSoT.md`
- 测试/fixture：`w-model-dev/scripts/__tests__/{run-log-append-logic,wm-append-runlog-cli,run-log-logic}.test.ts`、`w-model-dev/scripts/__tests__/README.md`、`w-model-dev/scripts/samples/run-log/**`、`w-model-dev/scripts/cli/self-test.ts` 相关用例

- [ ] **步骤 1：审计表（先出表，写进报告）**

逐落点 before→after：`recordHash`/`prevRecordHash`/`runLogAnchor` 三字段的全部载体（schema / 代码 / 文档 / 测试 / fixture / self-test 用例），每处给「删除」或「保留（理由）」。grep 指纹：`recordHash`、`prevRecordHash`、`runLogAnchor`、`哈希链`、`放行锚`、`D-3a`、`D-3b`、`digestOf`。

- [ ] **步骤 2：代码与 schema 移除**

删除链/锚的**全部**计算、写入、校验与 violation 文案；**保留**：时间戳三态语义与 `--allow-clock-adjust` 逃生口、R7 追加序（相邻时间戳单调）、R8-R11 全部判据、`RUN_LOG_JSON` 其余键、append-only 纪律文本（「禁止回溯改写历史行或重排时间戳」保留，但不得再声称行级哈希保证）。

- [ ] **步骤 3：文档同步**

按 T4 规则（单一权威 + ≤1 句摘要 + 指针）删除两节（data-models「记录哈希链」「checkpoint 放行锚」）与字段注、command-reference 的对应条目/「放行锚必填 cutoff」、其余文档的哈希链表述；`grep -rn "recordHash\|runLogAnchor\|哈希链\|放行锚"` 全仓活体面**零残留**（历史面 `docs/changes`、`docs/debug`、`docs/superpowers`、`CHANGELOG` 不动）。

- [ ] **步骤 4：测试与 fixture 处置**

删除的用例/断言逐条登记「仍被保留测试覆盖（指向）/ 有意退休（理由）」；fixture 若含该三字段则同步清理（并确认 `check-samples-coverage` 仍 exit 0、探针数不变）。

- [ ] **步骤 5：验证**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts     # exit 0
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-append-logic.test.ts w-model-dev/scripts/__tests__/wm-append-runlog-cli.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts
npm run self-test 2>&1 | tail -1                              # 全绿（记录用例数变化）
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts     # exit 0
npm run audit:l0-links                                        # exit 0
```

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/schemas/run-log.schema.json w-model-dev/scripts w-model-dev/references AGENTS.md w-model-dev/SKILL.md docs/skill-design-document_SSoT.md
git commit -m "refactor(run-log): 移除记录级哈希链与放行锚（去 hash 化，WS-T7）"
```

---

## 验收总表（与规格 §6 对应）

| 规格条 | 验收动作 | 期望 |
| --- | --- | --- |
| T1 | samples-coverage 新形态 + 删除清单处置表 | 4 列解析、派生锚输出、失败样本收紧 exit 1、48 探针零失败 |
| T2 | 两测试文件 + audit:l0-links | 计数断言清零、violations 负例全绿 |
| T3 | 独立运行计时 + prepush 快路径 | 秒级 + 诊断；prepush 内 fail-closed 一字不变 |
| T4 | 每簇 grep 校验 + docs-consistency | 权威外枚举命中 == 0（摘要句除外）；token 契约未破 |
| T5 | grep 清扫清单 | 无门禁强制的易漂计数清零 |
| T6 | subagent-delegation 新短节 | 成文 |
| §5 | CHANGELOG 牙齿对照 | 6 条替代承载逐项登记；删除测试无静默消失 |
| 终局 | `npm run prepush` | 19 项 exit 0 |
