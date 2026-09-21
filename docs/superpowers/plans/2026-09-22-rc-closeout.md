# R 三项采纳 + 打磨项清扫 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 落地三份根因报告的全部推荐（RC-1 fs 注入、RC-2 销毁前保全、RC-3 eval 基线成文）+ 全量打磨项清扫 + isMain 仓库级加固，使 `feat/rc-closeout` 分支通过 prepush 19 项全量验收。

**架构：** 按「最小工作流先行」顺序执行五个工作流：WS-C（eval 成文）→ WS-B（保全规则 + 装配器护栏）→ WS-D（打磨，分代码/文档/templates 三组）→ WS-A（coding-plan fs 注入，触面最大）→ WS-E（isMain 统一加固）→ 任务 11 全量验收。全部改动在单一分支 `feat/rc-closeout`（基线 cf866d0e，含规格），每任务独立提交，收尾做全分支宽范围评审。

**技术栈：** TypeScript（ESM，`.js` 后缀导入）、tsx runtime、vitest（`config/vitest.config.ts`）、Python 3（demo 装配器）、ajv/ajv-formats。仓库测试命令：`npx vitest run --config config/vitest.config.ts <path>`（仓库根目录运行）；全量门禁：`npm run prepush`；回归基线：`npx tsx w-model-dev/scripts/cli/self-test.ts`（当前 357 条）。

**全局纪律（每个任务都适用）：**
1. **防超时**：禁止单独跑 `check-docs-consistency.ts` CLI（内部全量 vitest，等价验证用 `docs-consistency-logic.test.ts`）；禁跑 prepush（任务 11 专属）；长命令后台+日志+轮询。
2. **计数句同提交**：凡脚本/样本/用例增删，同提交同步全部计数句（grep 实搜：AGENTS、README、CONTRIBUTING、SKILL、INSTALL、conventions、subagent-delegation、samples/README、NEGATIVE-COVERAGE、pre-push 注释、test-affected.cjs、user-guide、docs-consistency 夹具）。
3. **提交只 add 显式列出的文件**，禁 `git add -A`（工作树有 `.superpowers/sdd/`、`docs/debug/2026-09-19-*` 等既存未跟踪物）。
4. **提交前**：`npx prettier --config config/prettier.config.cjs --write <改动的 .ts>` + `npm run --silent typecheck` + `npm run --silent lint:security`（新增 0）。
5. **实施按约束 #14 走 codegraph 修改前查询**（流程约束；对 `.ts` 修改前先查询目标符号）。

---

## 文件结构

| 文件 | 职责 | 本计划动作 |
|---|---|---|
| `eval/README.md` | eval 资产导航 | §4 追加基线约定（WS-C） |
| `eval/e2e/2026-08-28-baseline.md` | 按日基线记录 | 头部补记注（WS-C） |
| `eval/mappings.json` | 提示词→断言映射 | #21 补 archive-integrity 锚点（WS-C） |
| `AGENTS.md` | 仓库导航 | §1 保全规则 + §8 self-test 行去数字（WS-B/D） |
| `eval/e2e/demo-assets/README.md` | demo 资产说明 | 保全规则节 + 清单地图（WS-B） |
| `eval/e2e/demo-assets/build_workspace.py` | demo 装配器 | 非基准态检测/快照（WS-B） |
| `.gitignore` | 忽略规则 | 加 `eval/e2e/demo-snapshots/`（WS-B） |
| `w-model-dev/scripts/logic/coding-plan-logic.ts` | 编码计划门纯逻辑 | 打磨（任务 4）+ fs 注入（任务 8） |
| `w-model-dev/scripts/logic/budget-logic.ts` | 预算纯逻辑 | 除零防护/防御/用例（任务 4） |
| `w-model-dev/scripts/cli/check-budget.ts` | 预算 CLI | 警告文案（任务 4） |
| `w-model-dev/scripts/logic/checkpoint-logic.ts` | checkpoint 纯逻辑 | 诊断文案点名 phase-1（任务 5） |
| `w-model-dev/scripts/__tests__/check-coding-plan.test.ts` | CLI 测试 | 头注 C7 订正（任务 5） |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 一致性测试 | 变异锚重落地（任务 5） |
| `w-model-dev/references/*.md`（hard-constraints/conventions/operational-recovery 等） | 阶段细则 | 文档面打磨（任务 6） |
| `w-model-dev/run-log.schema.json` → `w-model-dev/schemas/run-log.schema.json` | run-log schema | plan_review 非强制注明（任务 6） |
| `w-model-dev/templates/coding-plan.md` | 编码计划模板 | 新增（任务 7） |
| `w-model-dev/scripts/lib/coding-plan-fs.ts` | fs 适配器 | 新增（任务 8） |
| `w-model-dev/scripts/lib/is-main.ts` | 入口守卫 | 新增（任务 10） |
| `w-model-dev/scripts/cli/*.ts`（约 17 处） | CLI 入口 | isMain 迁移（任务 10） |
| `docs/superpowers/specs/2026-09-22-rc-closeout-spec.md` | 本规格 | 已入库（cf866d0e） |

---

### 任务 1：WS-C——eval 基线约定成文 + 补记注 + 归档快照锚点

**文件：**
- 修改：`eval/README.md`（§4 e2e 记录清单后）
- 修改：`eval/e2e/2026-08-28-baseline.md`（头部）
- 修改：`eval/mappings.json`（mapping #21 assertions）

- [ ] **步骤 1：eval/README.md §4 追加小节**（约 4-6 行，三点成文）：①`e2e/*.md` 基线/终值是**按日冻结的测量记录**，不随技能演化改写测量内容；②记录中的门禁/脚本名以**记录时点**为准，退役名不作回改，遇到时以后继门语义为准（举例：`check-openspec-archive` → `check-archive-integrity` 的 `codingPlanSnapshot`）；③退役/残留清理战役对 eval 历史记录的处置 = 注记或指引不改写，处置结论须落 tracked 面（本文件或 CHANGELOG）。

- [ ] **步骤 2：baseline 头部补记注**：在 `eval/e2e/2026-08-28-baseline.md` 标题后追加 blockquote：`> **注（2026-09-22）**：2026-09-21 起 `check-opsx-artifacts.ts`/`check-openspec-archive.ts` 已退役（见 CHANGELOG 42.2.1），本文件为按日快照、不随之改写。`

- [ ] **步骤 3：mappings #21 补锚**：在 #21 的 assertions 数组追加第 4 条 `{ "type": "contains", "target": "w-model-dev/scripts/logic/archive-integrity-logic.ts", "substring": "codingPlanSnapshot" }`（先 `grep -n "codingPlanSnapshot" w-model-dev/scripts/logic/archive-integrity-logic.ts` 确认命中）。

- [ ] **步骤 4：验证**：`npm run --silent eval`（60/60）；`git grep -c "按日冻结" eval/README.md`。

- [ ] **步骤 5：Commit**：`git add eval/README.md eval/e2e/2026-08-28-baseline.md eval/mappings.json && git commit -m "docs(eval): 基线不可变约定成文 + 退役补记注 + 归档快照锚点（WS-C）"`

---

### 任务 2：WS-B 规则面——销毁前证据保全规则成文

**文件：**
- 修改：`AGENTS.md`（§1「本地生成物与审计证据」节内）
- 修改：`eval/e2e/demo-assets/README.md`（「已实测的坑」节前新增小节）
- 修改：`CHANGELOG.md`（未解清单追加 ⑥）

- [ ] **步骤 1：AGENTS.md §1 成文**（追加到该节末尾，约 4 行）：「**销毁前证据保全**：凡对 gitignored 工作区执行破坏性重建/清理（含 `build_workspace.py --reset` 与常规运行——两者都会删 `.w-model`），若该态可能是唯一证据载体（存在真实调测/运行的 `.w-model` 态），必须先完成证据分级裁定并保全（快照入库 `docs/debug/` 或走导出链；注意导出链 source-bound 对无 `.git` 工作区不可用），再销毁。」

- [ ] **步骤 2：demo-assets/README.md 新增小节**（「已实测的坑」前）：同语义展开（证据类别 × 粒度 × 保全手段：结论层=入库文档、制品层=快照/导出），并注明「不新增反模式编号」（成本收益裁定，R 报告明示）。

- [ ] **步骤 3：CHANGELOG 未解清单追加 ⑥**：「导出链两项待独立规格裁定——`evidence-provenance` source-bound 强制 git HEAD 对无 `.git` 工作区结构性不可用；导出白名单缺根级 `signature-chain.jsonl`（RC-2 报告 §建议）」。

- [ ] **步骤 4：验证**：`grep -n "销毁前证据保全" AGENTS.md eval/e2e/demo-assets/README.md`（两处命中）；docs-consistency-logic 聚焦测试绿（AGENTS 改动不触计数句）。

- [ ] **步骤 5：Commit**：`git add AGENTS.md eval/e2e/demo-assets/README.md CHANGELOG.md && git commit -m "docs(rules): 销毁前证据保全规则成文 + 导出链缺口登记（WS-B 规则面）"`

---

### 任务 3：WS-B 机制面——装配器非基准态检测/快照

**文件：**
- 修改：`eval/e2e/demo-assets/build_workspace.py`（删除 `.w-model` 的路径上，`--reset` 与常规路径同管）
- 修改：`.gitignore`（追加 `eval/e2e/demo-snapshots/`）
- 修改：`eval/e2e/demo-assets/README.md`（机制说明同步）

- [ ] **步骤 1：实现检测/快照**（读 `build_workspace.py` 现有护栏风格后落码）：
  - 删除 `.w-model` 前调用 `detect_non_baseline_state(wm_dir)`：命中任一信号即非基准态——(a) `run-log.jsonl` 存在且行数 ≠ 装配器基准行数（装配器写完后自测行数并缓存为基准常量）；(b) `.w-model/` 存在 `*.bak.*`；(c) run-log 内容含 `"action": "checkpoint"` + `"outcome": "success"`。
  - 命中非基准态：先把 `run-log.jsonl`、`signature-chain.jsonl`、`checkpoint-log/`、`gate-logs/` 拷入 `eval/e2e/demo-snapshots/<UTC时间戳>/`（`shutil.copytree`/`copy2`，目录存在则复用），然后 `print` 指引并 `sys.exit(1)`，除非传了 `--accept-state-loss`（新增 argparse 参数）——该参数下快照仍执行、重建继续。
  - 基准态（未命中）→ 静默继续（零行为变化路径）。
- [ ] **步骤 2：`.gitignore` 追加一行** `eval/e2e/demo-snapshots/`。
- [ ] **步骤 3：验证**（脚本实跑，证据进报告）：① 注入非基准态（向 `.w-model/run-log.jsonl` 追加一行）→ 装配器 exit 1 + `demo-snapshots/<ts>/` 含 run-log 拷贝；② 同态加 `--accept-state-loss` → 重建完成 + 快照在；③ 干净基准态 → 无提示直接重建。
- [ ] **步骤 4：Commit**：`git add eval/e2e/demo-assets/build_workspace.py .gitignore eval/e2e/demo-assets/README.md && git commit -m "feat(e2e): 装配器非基准态 fail-closed 检测与证据快照（WS-B 机制位）"`

---

### 任务 4：WS-D 代码面 1——budget / coding-plan 逻辑打磨

**文件：**
- 修改：`w-model-dev/scripts/logic/coding-plan-logic.ts`（VERIFY_PREFIXES / R3 首行 / 目标节判据）
- 修改：`w-model-dev/scripts/logic/budget-logic.ts`（maxTokens=0 除零 / tokensUsed 防御）
- 修改：`w-model-dev/scripts/cli/check-budget.ts`（警告文案）
- 测试：`w-model-dev/scripts/__tests__/coding-plan-logic.test.ts`、`w-model-dev/scripts/__tests__/budget-logic.test.ts`

- [ ] **步骤 1：编写失败测试**（coding-plan-logic.test.ts 追加 3 例）：① `VERIFY：npm test`（全角冒号）被识别为验证行；② ledger 首行为空行、身份行在第二行 → R3 报「首行身份不符」；③ plan 仅有 `## 非目标` 节 → 仍报「缺目标节」。budget-logic.test.ts 追加 4 例：④ `perPhase.maxTokens=0` 时 R6 文案不含 `NaN`/`Infinity`；⑤ `tokensUsed={phase:NaN,total:NaN}` → 不触发 R6/R5-b 且不抛错；⑥ `total === maxTokensTotal`（恰等）→ R6 不触发；⑦ `killSwitch.budgetBurnRate` 缺失 → R5-b 不触发。
- [ ] **步骤 2：跑测试确认失败**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts w-model-dev/scripts/__tests__/budget-logic.test.ts`，预期 7 例中新增例 FAIL。
- [ ] **步骤 3：最小实现**：① `VERIFY_PREFIXES` 第 4 项改 `'Verify：'`（全角冒号；第 3 项 'Verify:' 为 ASCII 已存在）；② R3 首行改 `lines[0]`（删 `.find(非空)` 回退）；③ 目标节判据 `title.includes('目标') && !/非目标|不是目标/.test(title)`；④ R6 百分比计算前 `perPhaseMax > 0` 守卫（为 0 时文案省略百分比段）；⑤ `if (usage)` 块入口加 `Number.isFinite(usage.phase) && Number.isFinite(usage.total)` 守卫（不合法视同未提供）；⑥ `check-budget.ts` 两处「跳过 R5 触发检测」→「跳过 R5/R6/R5-b 触发检测」。
- [ ] **步骤 4：跑测试确认通过**（同步骤 2 命令，PASS；既有用例零回归）。
- [ ] **步骤 5：Commit**：`fix(gates): budget/coding-plan 逻辑打磨——除零与非法输入防御、判据精度（WS-D.1）`

---

### 任务 5：WS-D 代码面 2——诊断点名 / Σ=0 措辞 / 注释复核 / C7 头注 / 变异锚

**文件：**
- 修改：`w-model-dev/scripts/logic/checkpoint-logic.ts`（诊断文案）
- 修改：`w-model-dev/references/data-models.md`（Σ=0 条件措辞）
- 核对（可能零改动）：`w-model-dev/scripts/cli/check-artifact-gate.ts`（:26/:235/:585 注释）
- 修改：`w-model-dev/scripts/__tests__/check-coding-plan.test.ts`（头注 C7）
- 修改：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（变异锚重落地）

- [ ] **步骤 1**：`checkpoint-logic.ts` 的 `BOOTSTRAP_VALIDATION` 文案「以 checkpoint-log 用户确认为初级证据」→「以 checkpoint-log 的 phase-1 用户确认为初级证据」，同步对应测试断言。
- [ ] **步骤 2**：`data-models.md` 的 Σ=0 条件措辞改为与代码一致（「`--run-log` 文件存在且 Σtokens=0」）。
- [ ] **步骤 3**：`grep -n "check-openspec-archive" w-model-dev/scripts/cli/check-artifact-gate.ts`——应零命中（任务 7 已改）；有残留则订正。
- [ ] **步骤 4**：`check-coding-plan.test.ts` 头注「C7 …→ exit 1（R1）」改为「…→ exit 2（scope 装载即拒）」（与用例实际断言一致）。
- [ ] **步骤 5**：`docs-consistency-logic.test.ts` 中失效的 `.replace(...)` 变异锚——以当前活体文本重锚（若锚文本已被后续任务再改写，按当时实况重推导；若确无对应锚则删除并留注释说明）。
- [ ] **步骤 6：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/checkpoint-logic.test.ts w-model-dev/scripts/__tests__/check-coding-plan.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（全绿）。
- [ ] **步骤 7：Commit**：`fix(gates): 诊断点名 phase-1 与打磨收口（WS-D.2/3/6/7）`

---

### 任务 6：WS-D 文档面——表述与计数清扫

**文件：** `references/hard-constraints.md`、`references/conventions.md`、`schemas/run-log.schema.json`、`README.md`、`AGENTS.md`、`docs/skill-design-document_SSoT.md`、`CHANGELOG.md`、`references/superpowers-adoption.md`、`scripts/infrastructure/schema-loader.ts`、`scripts/infrastructure/schema-fs.ts`、`.githooks/pre-push`、`scripts/test-affected.cjs`、`CONTRIBUTING.md`、`samples/README.md`

- [ ] **步骤 1**：`hard-constraints.md`（约束 #14 附近）ensure 表述补全：「ensure-codegraph 只依赖 codegraph CLI 与项目 `.codegraph/`（MCP 仅 best-effort 探测，不影响就绪判定），另做 superpowers 三层检测」。
- [ ] **步骤 2**：`conventions.md`（约 :95）产出者口径改「S-plan（plan 任务节 + tickets）与 S-coding（账本 `Task N: complete`）先后产出」。
- [ ] **步骤 3**：`run-log.schema.json` 在 `plan_review` 枚举值 description 与 `review` 族 reworkHints allOf 附近注明「`plan_review` 不在 reworkHints 强制族（配对非强制，约束 #8 审计面）」。
- [ ] **步骤 4**：「pre-push 路径上」表述 4 处（`README.md:148`、`AGENTS.md:174`、`SSoT:1388`、`CHANGELOG` 同类句）改「由 pre-push 的 self-test / vitest 间接覆盖」。
- [ ] **步骤 5**：`superpowers-adoption.md` §5 加「`.superpowers/sdd/` 同时承载方法论账本（plan 指向 `docs/superpowers/plans/**`）与新契约账本（plan 指向 `docs/plans/**`），以 plan 路径区分，勿混用」。
- [ ] **步骤 6**：`schema-loader.ts`/`schema-fs.ts` 的「check 脚本调用链」措辞改「`check-*.ts` 文件数」口径。
- [ ] **步骤 7：self-test 计数去数字 8 处**（grep `357` 实搜为准）：`AGENTS.md` §8 self-test 行、`README.md:27`、`CONTRIBUTING.md:92/:262`、`.githooks/pre-push:320`、`scripts/test-affected.cjs:80`、`subagent-delegation.md`、`samples/README.md` 尾注 → 统一「用例数以运行输出为准」。
- [ ] **步骤 8：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（绿）+ `git grep -n "357 条\|360 条"` 活体面零残留 + `npx tsx w-model-dev/scripts/cli/self-test.ts`（确认去数字未破坏样本运行——357 通过）。
- [ ] **步骤 9：Commit**：`docs: 打磨文档面清扫——表述、计数去数字、schema 注明（WS-D 文档面）`

---

### 任务 7：WS-D templates——编码计划模板

**文件：**
- 创建：`w-model-dev/templates/coding-plan.md`
- 核对/修改：`w-model-dev/scripts/cli/check-artifact-gate.ts`（`--validate-templates` 的模板枚举面，读码裁定）

- [ ] **步骤 1**：先读 `check-artifact-gate.ts` 的 `--validate-templates` 实现，裁定新增模板是否需登记（报告说明）。
- [ ] **步骤 2**：编写模板（最小可满足 R1-R6 文法的示范）：`# <changeId> 编码计划` + `## 目标` + `## Task 1: <任务名>`（含 `验证：<命令>` 行）×N + 账本/三件套文法说明（`.superpowers/sdd/<changeId>.plan/progress.md` 首行身份、`Task N: complete`、`task-N-{brief,report}.md`、`review-*.diff`）+ 归档快照清单（`docs/changes/archive/<日期>-<changeId>/`）。
- [ ] **步骤 3：验证**：模板内容跑 `parsePlanStructure` 等价文法自检（临时 tsx 脚本或人工对照 R2 判据）+ 相关模板测试（`grep -rn "validate-templates\|templates/" w-model-dev/scripts/__tests__/ | head` 找到消费测试并跑绿）。
- [ ] **步骤 4：Commit**：`feat(templates): 编码计划模板（WS-D.5）`

---

### 任务 8：WS-A 核心——coding-plan fs 注入改造

**文件：**
- 修改：`w-model-dev/scripts/logic/coding-plan-logic.ts`（接口 + 签名 + 穿参 + 删 node:fs）
- 创建：`w-model-dev/scripts/lib/coding-plan-fs.ts`
- 修改：`w-model-dev/scripts/cli/check-coding-plan.ts`、`w-model-dev/scripts/cli/check-artifact-gate.ts`、`w-model-dev/scripts/cli/self-test.ts`（3 调用点）
- 修改：`w-model-dev/scripts/__tests__/coding-plan-logic.test.ts`（stub 化 + 注入负例 + 真适配器集成例）

- [ ] **步骤 1：定义端口接口**（coding-plan-logic.ts 导出，结构化不引 Node 类型）：`export interface CodingPlanFs { existsSync(p: string): boolean; readFileSync(p: string): string; statSync(p: string): { isFile(): boolean; size: number }; readdirSync(p: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }> }`。
- [ ] **步骤 2：签名改造**：`checkCodingPlan(projectRoot, phase, changeId, fs: CodingPlanFs)` 第 4 参**必选**；`resolvePlanLocation / archivePlanDirs / listArchiveDirNames / validateStageReviews / validateLedgerAndArtifacts` 增穿 `fs` 参；**删除 `import * as fs from 'node:fs'`**（保留 `node:path`）。
- [ ] **步骤 3：适配器外置**：新建 `lib/coding-plan-fs.ts` 导出 `nodeCodingPlanFs: CodingPlanFs`（包装 node:fs 的四个方法；`security/detect-non-literal-fs-filename` 的 disable + 理由随迁）。
- [ ] **步骤 4：3 调用点传参**：`cli/check-coding-plan.ts`、`cli/check-artifact-gate.ts`（聚合处）、`cli/self-test.ts`（CODING_PLAN_CASES runner）各 `import { nodeCodingPlanFs } from '../lib/coding-plan-fs.js'` 并传入。
- [ ] **步骤 5：测试 stub 化**：`coding-plan-logic.test.ts` 写 `mkFs(overrides)` 内存工厂（仿 `gate-enhancement.test.ts`）；既有 35 例改 stub；新增：① stub 缺 plan → R1；② stub 缺 ledger → R3；③ 2-3 例真适配器集成（直打 `samples/coding-plan/` 三 fixture，只读）；④ CRLF 4 例保持内容级（stub 内容含 `\r\n`）。
- [ ] **步骤 6：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts w-model-dev/scripts/__tests__/check-coding-plan.test.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts`（全绿；dependency-boundaries 此刻仍含 node:fs 例外——任务 9 才摘）+ `grep -n "node:fs" w-model-dev/scripts/logic/coding-plan-logic.ts`（零命中）+ `npx tsx w-model-dev/scripts/cli/self-test.ts`（357 通过）+ typecheck + lint:security（新增 0）。
- [ ] **步骤 7：Commit**：`refactor(gates): coding-plan fs 注入改造——logic 层零 node:fs（WS-A 核心）`

---

### 任务 9：WS-A 收尾——例外摘除 + CHANGELOG ⑤ 修正 + IO 约定成文

**文件：**
- 修改：`w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`（摘 node:fs 条目 ×2；node:path 理由改永久口径）
- 修改：`CHANGELOG.md`（未解清单⑤销项）
- 核对/修改：`docs/skill-design-document_SSoT.md`（§10M 对应句，若存在）
- 修改：`w-model-dev/scripts/logic/coding-plan-logic.ts`（头注措辞订正）
- 修改：`w-model-dev/references/asset-authoring.md` + `w-model-dev/references/subagent-delegation.md`（IO 约定成文）

- [ ] **步骤 1**：`dependency-boundaries.test.ts` Map（约 :62-65）与钉住数组（约 :326-328）删除 `coding-plan-logic.ts:node:fs`；`node:path` 条目理由改永久口径。
- [ ] **步骤 2**：CHANGELOG ⑤ 销项：「已裁定并实施：fs 例外摘除（−1 个导入 / −2 条登记）；node:path 依 gate-logic 等 6 文件先例转永久登记；原『各 −2』口径按先例现实修正」。
- [ ] **步骤 3**：`grep -n "10M" docs/skill-design-document_SSoT.md` 核对；有对应句则订正。
- [ ] **步骤 4**：头注措辞订正（注入必选参 + 适配器外置 lib 形态；l0-link-audit-logic 为直连形态）。
- [ ] **步骤 5**：IO 约定成文（asset-authoring.md 资产编写杠杆节为主，subagent-delegation.md S 角色职责处交叉引用）：「新增 `logic/` 模块默认零 `node:fs` 导入——注入接缝形（fs 参数 + CLI/lib 默认适配器）或内容注入形；直连须在分派 brief 显式申请例外」。
- [ ] **步骤 6：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（全绿）+ `grep -c "node:fs" w-model-dev/scripts/logic/coding-plan-logic.ts`（0）。
- [ ] **步骤 7：Commit**：`refactor(gates): node:fs 例外摘除与 logic 层 IO 约定成文（WS-A 收尾）`

---

### 任务 10：WS-E——isMain 仓库级加固

**文件：**
- 创建：`w-model-dev/scripts/lib/is-main.ts`
- 修改：约 17 处 CLI（`grep -rln "isMain" w-model-dev/scripts/cli/` 实搜为准）
- 修改/创建：`w-model-dev/scripts/__tests__/is-main.test.ts`（新）+ `lib/run-sync.ts` 台账登记（realpathSync 为同步 fs 调用）

- [ ] **步骤 1**：实现 `lib/is-main.ts`：`export function isDirectInvocation(importMetaUrl: string): boolean`——`process.argv[1]` 缺失 → false；`realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(path.resolve(entryArg))`（try/catch 包裹，任一侧解析失败 → false 保守）。
- [ ] **步骤 2**：全量迁移：各 CLI 尾部守卫改为 `if (isDirectInvocation(import.meta.url)) { runMain(main); }`（删各自 `entryArg/isMain` 局部定义与 `fileURLToPath`/`path.resolve` 临时导入）；**迁移前后行为等价性**由既有 `cli-natural-exit.test.ts` + `exit2-failure-atomicity.test.ts` 探针网兜底。
- [ ] **步骤 3**：`run-sync.ts` 台账登记 `lib/is-main.ts` 的 `realpathSync`（symbol/reason：入口守卫，双侧 realpath 防 symlink/盘符大小写/8.3 短名 fail-open）；`is-main.test.ts` 覆盖：直跑相等 true、不存在路径 false、temp 目录真实文件对 true。
- [ ] **步骤 4：验证**：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/is-main.test.ts w-model-dev/scripts/__tests__/cli-natural-exit.test.ts w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts`（全绿）+ `grep -rn "entryArg" w-model-dev/scripts/cli/ | grep -v is-main`（残留 0）+ typecheck + lint:security（新增 0）。
- [ ] **步骤 5：Commit**：`refactor(gates): isMain 守卫统一 realpath 加固（WS-E）`

---

### 任务 11：全量验收与收尾

**文件：**
- 可能修改：验收暴露的本分支改动直接相关项（修复须与本分支改动相关，无关既有失败如实报告）
- 可能创建：`docs/debug/2026-09-22-rc-closeout-acceptance/acceptance.txt`

- [ ] **步骤 1：prepush**：`nohup npm run prepush > .rc-prepush.log 2>&1 &` 后台 + 每 5-9 分钟轮询（20-35 分钟），直至「全部门禁通过，允许推送 ✓」。失败项若与本分支改动直接相关 → 修复并重跑；网络瞬态按 pre-push 既有自动跳过语义处理；无关失败如实报告。
- [ ] **步骤 2：grep 活体面**：`grep -rn "退役随批次\|check-opsx-artifacts\|check-openspec-archive\|ensure-codegraph-opsx"`（排除 `docs/changes/**`、`docs/superpowers/plans|specs/**`、`CHANGELOG*`、`docs/debug/**`）→ 零活性命中。
- [ ] **步骤 3：CRLF 回归锚**：`npx tsx w-model-dev/scripts/cli/self-test.ts` → 357/357（含 coding-plan 2 例）。
- [ ] **步骤 4**：证据（prepush 末段 + grep 输出）入库 `docs/debug/2026-09-22-rc-closeout-acceptance/acceptance.txt`（.txt 非 .log）。
- [ ] **步骤 5：Commit**：`test(acceptance): rc-closeout 全量验收记录（prepush 19 项全绿）`（只 add 证据文件与验收期修复的文件）

---

## 自检记录（编写者执行）

**1. 规格覆盖度**：WS-C→任务 1；WS-B 规则→任务 2、机制→任务 3；WS-D 代码面→任务 4/5、文档面→任务 6、templates→任务 7；WS-A→任务 8/9；WS-E→任务 10；全局验收→任务 11 + 各任务内嵌验证。规格 §WS-F 不做清单对应任务内「不要」项。无遗漏。
**2. 占位符扫描**：无「待定/TODO」；读码裁定类步骤（任务 7 步骤 1、任务 5 步骤 3/5）均给出裁定规则与证据要求。
**3. 类型一致性**：`CodingPlanFs`/`nodeCodingPlanFs`（任务 8 定义、任务 8 调用点、任务 9 例外摘除同名）；`isDirectInvocation(importMetaUrl)`（任务 10 单点）；`BOOTSTRAP_VALIDATION` 文案改动与 E-2 既有测试断言同步（任务 5 步骤 1）。`--accept-state-loss` 与 `.gitignore` 条目（任务 3 内一致）。
