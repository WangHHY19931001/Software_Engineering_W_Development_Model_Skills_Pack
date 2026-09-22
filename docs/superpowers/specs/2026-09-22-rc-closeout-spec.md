# R 三项采纳 + 打磨项清扫 实施规格 v1.1（经头脑风暴复核修订）

> 状态：**待批准**（批准后立计划、子代理执行）
> 依据：用户裁定「R 三项全部按推荐进行，打磨项也做」（2026-09-22）；三份根因报告：
> - RC-1 `docs/debug/2026-09-22-rc1-coding-plan-fs-debt/README.md`
> - RC-2 `docs/debug/2026-09-22-rc2-demo-rebuild-loss/README.md`
> - RC-3 `docs/debug/2026-09-22-rc3-eval-baseline/README.md`
> 打磨项来源：`.superpowers/sdd/2026-09-21-superpowers-replace-opsx/progress.md` 各任务 deferred 记录 + 最终全分支评审 Minor 清单。
> 基线：main @ 9c3cd32b。计数基线：cli .ts 46 / exit-2 45（check-* 27 + 工具 18）/ self-test 357 / references 44 / 反模式 48。
> **v1.1 复核修订记录**：① WS-A 注入形态改为「第 4 参必选 + 适配器外置 lib/coding-plan-fs.ts + 3 调用点传参」（原 options.fs=defaultFs 形态会使例外无法摘除，与目标矛盾）；② 补 RC-2 推荐②（证据清单地图，可选低优先）；③ 补 WS-B 机制细节（常规运行同管 / `--accept-state-loss` / `eval/e2e/demo-snapshots/<ts>/` + .gitignore 一行 / 不新增反模式编号）；④ 补 WS-C 成文要点含退役门禁映射举例；⑤ WS-D 补 5 项漏译打磨（C7 头注 / 变异锚重落地 / #40 tickets 门禁注 / schema-loader「调用链」措辞 / self-test 计数去数字）；⑥ 全局验收增补 CRLF 回归锚。

## WS-A：RC-1 实施——coding-plan fs 注入 + logic 层 IO 约定成文

1. **fs 注入（核心，按 R 报告 §7 草图逐条）**：
   - `logic/coding-plan-logic.ts` 定义最小端口接口（结构化，不引 Node 类型依赖）：`export interface CodingPlanFs { existsSync(p: string): boolean; readFileSync(p: string): string; statSync(p: string): { isFile(): boolean; size: number }; readdirSync(p: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }> }`。
   - `checkCodingPlan(projectRoot, phase, changeId, fs: CodingPlanFs)` **第 4 参必选**（logic 层零默认 IO）；`resolvePlanLocation / archivePlanDirs / listArchiveDirNames / validateStageReviews / validateLedgerAndArtifacts` 穿参；**删除 `node:fs` 导入，保留 `node:path`**（toRel 已是 `/` 拼接展示路径；绝对路径拼接留 path.join，不做 Windows 分隔符冒险）。
2. **真实适配器外置（一处，防三抄）**：新增 `lib/coding-plan-fs.ts`（lib 层 fs 导入合法；边界只判 logic 层）导出 `nodeCodingPlanFs`；3 个调用点各传实参——`cli/check-coding-plan.ts`、`cli/check-artifact-gate.ts`（聚合）、`cli/self-test.ts`（CODING_PLAN_CASES runner）。`extractCompletedTaskNumbers` 纯函数零触碰，archive-integrity 链零波及。
3. **测试**：`coding-plan-logic.test.ts` 既有 35 用例（含 CRLF 4 例——内容级，注入后仍有效）改内存 stub（仿 `gate-enhancement.test.ts` mkFs 同款）；另留 2-3 个**真适配器集成用例**直打 `samples/coding-plan/` 三 fixture（真盘只读），保住端到端真盘语义；`check-coding-plan.test.ts`（CLI 子进程）不动——天然覆盖真实适配器路径。**新增注入负例**：stub 缺失 plan/ledger → R1/R3 负例（不落盘即可测 IO 分支，注入收益实证）。
4. **`dependency-boundaries.test.ts`**：Map 与钉住数组删除 `coding-plan-logic.ts:node:fs` 条目（**同一导入的 2 条登记，计 −1 个例外类型**）；`node:path` 条目理由改写为永久口径（「normalizes coding plan artifact and archive snapshot paths」）保留。
5. **`CHANGELOG.md` 未解清单⑤销项**：改为「已裁定并实施：fs 例外摘除（−1 个导入 / −2 条登记）；node:path 依 gate-logic 等 6 文件先例转永久登记；原『各 −2』口径按先例现实修正」。**SSoT §10M 若有对应句一并订正**（SSoT 优先）。
6. **头注订正**：`coding-plan-logic.ts` 头注的「gate-logic 同型先例」改为准确表述（gate-logic 为「注入 + 模块内默认适配器」形态；本文件改造后为「注入必选参 + 适配器外置 lib」形态；`l0-link-audit-logic.ts` 为直连形态）。
7. **logic 层 IO 约定成文（堵再发轴，优先级与注入化相同）**：`references/asset-authoring.md`（资产编写杠杆节）或 `subagent-delegation.md` S 角色职责处补成文约定：「新增 `logic/` 模块默认零 `node:fs` 导入——文件图门禁采注入接缝形（fs 参数 + CLI/lib 默认适配器）或内容注入形；直连须在分派 brief 里显式申请例外」。两处择一为主、另一处交叉引用。

验收：39+ 用例零回归（注入默认路径）+ 注入负例 + 真适配器集成用例 + `dependency-boundaries` 绿（node:fs 摘除）+ 三处文档一致。

## WS-B：RC-2 实施——销毁前证据保全规则 + 装配器非基准态检测

1. **规则成文（主，根因位）**：`AGENTS.md` §1「本地生成物与审计证据」节 + `eval/e2e/demo-assets/README.md`（「已实测的坑」节前新增一小节）成文「销毁前证据保全」：凡对 gitignored 工作区执行破坏性重建/清理（含 `build_workspace.py --reset` **与常规运行**——两者都会删 `.w-model`），若该态可能是唯一证据载体（存在真实调测/运行的 `.w-model` 态），必须**先**完成证据分级裁定并保全（快照入库 `docs/debug/` 或走导出链——同时注明导出链对无 `.git` 工作区不可用的边界），再销毁。**不新增反模式编号**（会牵动 48 条计数四方同步，成本收益不匹配——R 报告明示）。
2. **装配器非基准态检测/快照（辅，机制位，30-60 行）**：`build_workspace.py` 删除 `.w-model` 前（`--reset` **与常规路径同管**）检测非装配器基准态信号（run-log 行数 ≠ 装配器基准 / 存在 `*.bak.*` / 存在 checkpoint 放行记录），命中即 **exit 并要求显式 `--accept-state-loss`**，或先自动快照——把 run-log / signature-chain / checkpoint-log / gate-logs 清单拷入 gitignored 的 `eval/e2e/demo-snapshots/<ts>/`（`.gitignore` 加一行）；与装配器既有护栏（哨兵判据、目录名判据）同风格。README 同步。
3. **② 证据清单地图（可选、低优先——按推荐纳入为可选项）**：`demo-assets/README.md` 补一段 live-run 幸存摘录的「证据清单地图」，**明确标注「摘录为残存全貌，非制品」**（禁止伪造重建已丢失制品）。若不做则在本规格 WS-F 记录降级裁定。
4. **导出链两项登记待裁（不实施）**：`evidence-provenance-logic.ts` source-bound 强制 git HEAD 对无 `.git` 工作区结构性不可用；导出白名单缺根级 `signature-chain.jsonl`。两项在 CHANGELOG 未解清单追加登记（⑥），注明「需独立规格裁定」，本规格不实施。

验收：规则两处成文一致；装配器对注入的非基准态样本 fail-closed（负例）+ `--accept-state-loss`/快照路径（正例）有测试（Python 侧自检或单测，报告给证据）；`.gitignore` 行；CHANGELOG ⑥ 登记。

## WS-C：RC-3 实施——eval 基线约定成文

1. `eval/README.md` §4 成文三点：①`e2e/*.md` 基线/终值是**按日冻结的测量记录**：不随技能演化改写测量内容；②记录中出现的门禁/脚本名以**记录时点**为准，退役名不作回改，遇到时以后继门语义为准（举例：`check-openspec-archive` → `check-archive-integrity` 的 `codingPlanSnapshot`）；③退役/残留清理战役对 eval 历史记录的处置 = **注记或指引，不改写**，处置结论须落在 tracked 面（本文件或 CHANGELOG）。
2. `eval/e2e/2026-08-28-baseline.md` 头部补**带日期注记**（blockquote）：「2026-09-21 起 `check-opsx-artifacts.ts`/`check-openspec-archive.ts` 已退役（见 CHANGELOG 42.2.1），本文件为按日快照、不随之改写」。
3. `eval/mappings.json` 补一条 archive-integrity 锚点断言（闭合 T8 遗留的「语料点名 `codingPlanSnapshot`/`check-archive-integrity.ts` 而 mappings 无对应」半截缺口）。

验收：`npm run --silent eval` 60/60（或按 3 新计数）+ baseline 头注在场 + tracked 成文在场。

## WS-D：打磨项清扫（各任务 deferred Minor 全量处置）

**代码/测试面：**
1. `coding-plan-logic.ts`：`VERIFY_PREFIXES` 第 4 项改为全角冒号真变体（'Verify：'）或删除并改注释；R3 账本首行身份改**严格第一行**（非首个非空行）；目标节判据排除「非目标/不是目标」前缀；`maxTokens=0` 时 R6/R5-b 文案除零防护；`tokensUsed` 非有限非负时 logic 层防御（跳过 + warning，不静默）；`check-budget.ts` 读取失败警告文案「跳过 R5 触发检测」→「跳过 R5/R6/R5-b」；补 `total === maxTokensTotal` 边界与 `budgetBurnRate` 缺失不触发两用例。（WS-A 注入不改内容归一化，CRLF 语义保持。）
   > 注（终审）：tokensUsed 判据实现较本条原文收窄为「仅非有限静默视同未提供」，裁定记录见 CHANGELOG 2026-09-22 批次小节。
2. `check-archive-integrity.ts` / `coding-plan-logic.ts`：归档零匹配/非法日期文案信息量核对（I-2 已加 invalid-date 态，确认排障信息量）；`BOOTSTRAP_VALIDATION` 诊断文案点名 phase-1（E-2 遗留）。
3. `cli/check-budget.ts`：Σ=0「R6 未生效」与 data-models 措辞一致核对（「文件存在 + Σ=0」条件）。
4. `cli/check-artifact-gate.ts`：注释面退役脚本残留 grep 复核归零（任务 7 已改——复核）。
5. **templates 新增**：`templates/coding-plan.md` 最小编码计划模板（目标节 + 任务节 + 验证命令行文法示例）+ 账本/三件套文法说明；核对 `check-artifact-gate --validate-templates` 的 C9 布局校验是否需登记该模板（读码裁定，报告说明）。
6. `docs-consistency-logic.test.ts` 变异锚重落地：退役后失效的 `.replace` 锚改为对新锚文本（或删除并留注释），杜绝永久 no-op。
7. `cli/check-coding-plan.test.ts` 头注 C7 订正：「C7 …→ exit 1（R1）」→ 实际 exit 2（scope 装载即拒）。

**文档面：**
8. `hard-constraints.md`（约束 #14 附近）ensure 表述补全：「ensure-codegraph 只依赖 codegraph CLI 与项目 `.codegraph/`（MCP 仅 best-effort 探测），另做 superpowers 三层检测」。
9. `conventions.md`（约 :95）产出者口径：「S-plan（plan 任务节 + tickets）与 S-coding（账本 `Task N: complete`）先后产出」。
10. `run-log.schema.json` 的 `plan_review` 与 `review` 族 description：明说 `plan_review` **不在** reworkHints 强制族（配对非强制）。
11. 「pre-push 路径上」→「由 pre-push 的 self-test / vitest 间接覆盖」（`README.md:148`、`AGENTS.md:174`、`SSoT:1388`、`CHANGELOG` 同类句——grep 实搜为准）。
12. `superpowers-adoption.md`：§5 加一句「`.superpowers/sdd/` 同时承载方法论账本与新契约账本，以 plan 路径区分，勿混用」；§2 作用域与 `:129` 括注核对。
13. `w-model-dev/scripts/infrastructure/schema-loader.ts`/`schema-fs.ts` 的「check 脚本调用链」措辞核对（退役后数字与「调用链」字面是否仍准确，不准确则改为「check-\*.ts 文件数」口径）。
14. self-test 样本数硬编码 **8 处去数字**（`AGENTS.md` §8 self-test 行、`README.md:27`、`CONTRIBUTING.md` 两处、`.githooks/pre-push:320`、`scripts/test-affected.cjs:80`、`subagent-delegation.md`、`samples/README.md` 尾注——grep 实搜为准）：统一改为「用例数以运行输出为准」类措辞（本规格裁定：不做 docs-consistency 挂钩——解析 self-test 源码计数脆弱）。

## WS-E：isMain 仓库级加固

新 `lib/is-main.ts`（`realpathSync` 双侧归一化比较，封装 try/catch——argv[1] 不存在/解析失败时保守返回 false）+ 全仓约 17 处 CLI 守卫迁移（`check-budget.ts`、`check-coding-plan.ts`、`check-artifact-gate.ts` 等，grep `isMain` 实搜为准）+ 既有 `cli-natural-exit` / `exit2-failure-atomicity` 探针回归 + 迁移处注释统一指向加固理由（symlink/盘符大小写/8.3 短名 fail-open 的既有缺陷）。CHANGELOG 未解清单相应项销项或改写为「已加固」。

## WS-F：明确不做（裁定记录）

- 纯装饰性：测试用例编号顺序、`checkpoint-logic.ts` 禁语文案位置等不影响审计的项。
- `plan_review` 纳入 reworkHints 强制族：**不做**（保持非强制 + description 注明，见 WS-D.10）；未来真实投产后再议。
- RC-2 导出链两项实施：登记待裁（WS-B.4）。
- RC-1 选项 B（弱注入形）/选项 C（永久登记）：被选项 A 支配，不采。
- 历史档案（`docs/changes/**`、`docs/superpowers/plans|specs/**`（除本规格与 e2/amendment）、`CHANGELOG` 历史条目、`docs/debug/**` 已入库证据）不改。
- self-test 样本数「挂钩 docs-consistency」方案：**不做**（解析 self-test 源码计数脆弱），采用「去数字 + 以运行输出为准」（WS-D.14）。

## 全局验收

1. 全量 `npm run prepush` exit 0（收尾必跑；本规格含代码改动：WS-A/WS-B/WS-D/WS-E）。
2. `npm run --silent eval` 60/60（或按 WS-C.3 新计数）。
3. `grep "退役随批次\|check-opsx-artifacts\|check-openspec-archive\|ensure-codegraph-opsx"` 活体面零命中（历史档案除外）。
4. 计数句口径全仓一致（cli/exit-2/check-*/references/lib/logic），以 docs-consistency-logic 实测为准；self-test 样本数硬编码 8 处已去数字。
5. **CRLF 回归锚**：在现行 autocrlf=true 工作树上，此前红的 2 例 coding-plan self-test 用例保持绿。
6. 每工作流独立子代理实现 + 任务评审 + 定向复审；收尾做一次全分支宽范围评审。

## 执行顺序建议

WS-C（最小）→ WS-B（规则+脚本）→ WS-D（打磨，可分组）→ WS-A（注入改造，触面最大）→ WS-E（isMain 迁移）→ 全量验收。全程在单一分支 `feat/rc-closeout`（自 main 切出）进行，每工作流独立提交。实施本身按约束 #14 走 codegraph 修改前查询与回归钩子（流程约束）。
