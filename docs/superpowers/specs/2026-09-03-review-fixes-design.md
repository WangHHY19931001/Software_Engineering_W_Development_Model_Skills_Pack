# 129 提交审查全量修复设计（保持 42.2.1）

- 日期：2026-09-03
- 状态：已经用户批准（五节设计逐节展示后批准）
- 审查基线：`origin/main`（93f6f3a）→ `f0add11`，129 提交 / 129 文件 / +9056−1166
- 审查来源：四个独立只读审查切片（脚本逻辑 / 测试与 schema / 技能文档 / 仓库级与 hook），全部发现经主会话抽查证实
- 后续实现计划：`docs/superpowers/plans/2026-09-03-review-fixes.md`（由 writing-plans 产出）

## 1. 范围与不可变约束

修复范围 = 本轮审查全部 26 条发现：4 Important + 22 Minor，逐条处置、不留未处置项（处置方式为代码修复、文档修复或记录性处置三选一，全部可追溯）。

不可变约束（沿用前两轮战役，全程有效）：

- 版本保持 **42.2.1**，不 bump。
- `.superpowers/` 报告（账本 / 简报 / 审查报告）不提交。
- 所有 tracked 文件修改在独立 worktree（`.worktrees/review-fixes`，分支 `task/review-fixes`）内由实现子代理完成；主工作树只读。
- 普通 V/G 失败必须走完整失败链 `V/G → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，禁止直接返工 bypass。
- 已知负载敏感 flake（state-write-logic / wm-write 锁竞争）只做隔离 3× 重跑并如实记录，不放宽 gate。
- 完成后独立审查 clean（0 Critical / 0 Important）才本地 fast-forward 合并；**不推送**（push 须用户另行明确要求）。
- 阶段 5-8 纪律：编辑 `w-model-dev/scripts/**` 的 .ts 与 `.githooks/pre-push` 前，先 codegraph 查询影响半径并落盘 `.w-model/codegraph-queries/`（S1 生效后 `.sh/.ps1/.bat/.cmd` 也在覆盖义务内）；scope manifest 先于查询创建（`queryTimestamp ≤ scopeCreatedAt`，`targetFiles` 覆盖全部 code/test 变更文件）。

## 2. Important 修复设计（4 条）

### I-1 Git 非 ASCII 文件名误报（change-scope.ts:221-224）

`computeGitChangedFiles` 的全部 git 文件清单命令统一追加 `-c core.quotePath=false`。不引入 `-z` NUL 解析（保持行解析简单性；`core.quotePath=false` 已足够，且仓库内路径不含换行符的前提由 scope 路径校验兜底）。

测试：临时仓库 fixture 含中文文件名（如 `docs/设计文档.md`）——修复前 exact-set 双向比对产生双违规（先红），修复后绑定通过（后绿）。

### I-2 缺 `--scope` 的可执行命令示例（quality-standards.md:184、hard-constraints.md:332 #3）

两处改为 `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>`，并注明阶段 5-8 另须 `--scope=<change-scope.json>`（缺失即 exit 1）。全仓 grep `check-artifact-gate.ts \[project-dir\]` 清扫其他裸调用残留，逐处同步。

### I-3 六处根文档补第三条新分支基线路径

`README.md:238`、`AGENTS.md:51`、`CONTRIBUTING.md:92`、`docs/INSTALL.md:174`、`docs/troubleshooting.md:92`（1.7b）、`docs/skill-design-document_SSoT.md:1198`（§8.2.4）统一补齐基线解析顺序描述：fork-point → merge-base → remote-tracking 排除集枚举（remote 名白名单 + `git remote get-url` 验证 + `git log -m --name-only --pretty=format: <local> --not --remotes=<remote>`，`-m` 防 merge commit 空 diff 漏检）→ 全部失败才 fail-closed 运行全量门禁。以 `.githooks/pre-push` 实现为准，六处措辞一致。

### I-4 父链台账补全（CHANGELOG.md:137、验收记录 :154）

- 在 97b91bad 与 689e51bd 之间按时间序补插 `965095e049bf0688e1b343c5adcdd70407642228` 行（两份台账同位）。
- 末尾追加 `6adc321` 之后全部 16 个 first-parent 提交行（13b942f → c691023 → 3da9efa → 0ee78ea → 1a032bf → 827ebce → 1a0ed09 → 25e5bf0 → e425642 → f257070 → f828b27 → f76dc43 → d17594f → 8a7b503 → 0644a0b → f0add11），40 字符完整 SHA、无 tip 自引用。
- 本切片是战役最后一个 commit；改写台账中"本节只记录任务 1/3/4 代码提交"的范围限定句为全量覆盖表述。
- 验收：逐对 parent-lookup 校验链条连续，末行 = 合并前分支 tip 的父提交。

## 3. Minor 处置清单（22 条）

### 代码修复（14 条）

| # | 位置 | 修复 |
|---|---|---|
| A1 | change-scope.ts `isCodeOrTestFile` | 白名单纳入 `.sh` / `.ps1` / `.bat` / `.cmd`（用户已确认）；`.sql/.tla/.feature` 不纳入（各有 BDD/TLA+ 门禁兜底），注释与文档写明。新增对应正反例测试 |
| A2 | change-scope.ts `validateChangeScope` | 统一强制 `changeId` 匹配 `^phase<scope.phase>-`（三个 strict CLI 与薄封装一次对齐，与 opsx/archive 既有强制一致）；补负例 |
| A5 | check-openspec-archive.ts:63 | `<date>-<changeId>` 形式加真实日历日校验（`2026-13-45-` 负例 exit 1）；`<changeId>` 直配形式不受影响 |
| A6 | l0-link-audit-logic.ts:56-66 | `parseRelativeLinks` 支持 reference-style 链接定义（行首 `[label]: path`）；URL 含 `)` 与 `%23/%2F` 保持已知近似，inline 注释 + 命令参考文档说明。基线数随之更新并经 B4 共享模块同步 |
| A7 | check-artifact-gate.ts `aggregateExternalChecks` | scope 缺失时 external summary 改为 `{provided:false, changeId:null, violationCount:0, passed:false}`，消除 `changeId:'' + violationCount:0` 的误读；GATE_JSON 消费方与测试同步 |
| A8 | check-codegraph-queries.ts `phaseQueryFiles` | 文件名严格 `^phase([5-8])-` 整数匹配，拒绝 `phase05-x.json`；补正反例 |
| B1 | change-scope.schema.json:44 + change-scope.ts `changedFilePathViolation` | 路径规则拒绝单 `.` 段（`./x.ts`、`.`）；schema pattern 与 TS 校验同步收紧；`change-scope.test.ts` 坏例集补两类负例 |
| B3 | change-scope.test.ts:517-524 | 用例改名「CLI 运行环境自检（非端到端）」，注释明示真实 CLI 端到端覆盖位于 C10a-d 与两个 CLI 测试文件 |
| B4 | l0 两个测试文件 | 三个基线数收敛到 `__tests__/helpers/l0-baseline.ts` 单一来源，两测试文件 import 同源；helpers 目录不匹配 vitest 测试文件 glob |
| B5 | platform-deps-hook.test.ts:1065 | 补「失败来源 = prettier 步骤」锚定断言（输出含对应 gate 标识），防止失败步骤漂移仍绿 |
| B6 | `__tests__/README.md:57` | skill-metadata 行补 doctor script 断言描述 |
| C1 | templates/system-test.md:59、quality-standards.md:39 | 以 `gate-logic.ts` NFR 段实测行为为准改写（实现时先读 ：583-598 确认精确语义：双字段均缺 → exit 1；单缺其一 → 警告；文档措辞与代码逐字对齐） |
| D3 | AGENTS.md §8 + check-docs-consistency | exit-2 脚本数以实测为准统一口径：AGENTS.md scripts 行 "35"→实测值；§8 表补 `wm-export-evidence.ts`、`platform-deps-install.ts` 两行；核对 check-docs-consistency 的计数期望逻辑并三方（文档/表/检查器）对齐 |
| D4 | .githooks/pre-push:136-139 | remote 名 case 补 `-*` → return 1（拒绝前导 `-`）；新增 hook 测试：伪造 remote 名 `--push` 时走 fail-closed 全量门禁；同步受影响的源码契约断言 |

### 文档修复（7 条）

| # | 位置 | 修复 |
|---|---|---|
| A3 | command-reference.md opsx 节 | 补后果说明：strict 只校验 scope 选定目录，同阶段兄弟半成品目录不在本 gate 扫描范围，每个 change 须各自跑 gate（与 SSoT §1338 既有取舍呼应） |
| A4 | command-reference.md scope 用法 | 注明仅支持 `--scope=<file>` 等号形态，空格形态按未提供处理（fail-closed） |
| B2 | run-log.schema.json | emergency-fix 条件与字段 description 披露 LEGACY_VARIANT 吸收语义：未声明 variant 的历史记录被非阻断 diagnostic 吸收，新记录必须声明 variant+blocker；command-reference run-log 节补同句 |
| C2 | command-reference.md opsx 条 | 改为「changeId 不匹配任何 active 候选 → violation；存在多候选时按 scope.changeId 精确选择其一」，与实现一致 |
| C3 | hard-constraints.md:912 | 反模式 #19 节末旧短链替换为逐字全链（与同文件其余 17 处一致），修正 SKILL.md 步骤指向 |
| D2 | README.md:236、AGENTS.md:51、CONTRIBUTING.md:108 | audit 瞬态跳过措辞补扩展信号：HTTP 429/5xx、socket hang up、ENETUNREACH、errno 形态网络码（与 pre-push:378-389 实现一致） |
| A6-注 | command-reference.md | l0 解析已知近似（URL 含 `)`、`%23/%2F` 不解码）写入文档说明 |

### 记录性处置（1 条）

| # | 位置 | 处置 |
|---|---|---|
| B7 | docs-consistency-logic.test.ts:2877-2931 | wontfix：文本级契约测试对无行为重构会误红是固有脆性，in-file 注释已声明为刻意防线（防 hook 语义漂移）。保持现状，本规格与 CHANGELOG 记录处置理由 |

## 4. 切片划分与执行顺序（SDD）

| 切片 | 内容 | 主要触点 |
|---|---|---|
| S1 scope/codegraph 行为 | I-1、A1、A2、A5、A7、A8、B1 | change-scope.ts、check-codegraph-queries / check-openspec-archive / check-artifact-gate、change-scope.schema.json、对应测试 |
| S2 pre-push | D4 | .githooks/pre-push、platform-deps-hook.test.ts、docs-consistency-logic 源码契约断言 |
| S3 测试与 l0 审计 | A6、B3、B4、B5、B6 | l0-link-audit-logic.ts、l0 两个测试文件 + 共享基线模块、platform-deps-hook.test.ts、__tests__/README.md |
| S4 文档一致性 | I-2、I-3、A3、A4、B2、C1、C2、C3、D2、D3、A6-注 | references / templates / 根文档 / SSoT / run-log.schema.json 描述 |
| S5 台账收尾 | I-4（战役最后一个 commit） | CHANGELOG.md、验收记录 |

每切片流程：全新实现子代理（先 codegraph explore 落盘，再 TDD 编辑，再定向回归）→ 切片独立审查 → 修复轮（resume 原实现者 1-3 轮，第 4-5 轮换更强实现者，上限 5）→ 定向复审。实现者的查询落盘、scope manifest、回归输出记入 `.superpowers/sdd/review-fixes/`（不提交）。

## 5. 验收矩阵

按顺序执行并留存真实退出码：

1. **定向负例/正例**：每条代码修复至少一个先红后绿测试；文档修复有逐处对照断言（grep 或契约测试）。
2. **全量回归**：`npx vitest run --config config/vitest.config.ts` 全绿；`npm run self-test` 262/262；`npm run eval` 25/25。
3. **静态与契约**：`npm run typecheck`、`npm run lint:security`、`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`、`npm run audit:l0-links`（基线更新后与共享模块一致）、`npm run doctor`。
4. **pre-push 门禁**：`npm run prepush` 17 项全绿（Git Bash）；flake 只隔离 3× 重跑。
5. **最终独立审查**：范围 = `f0add11..task/review-fixes tip` 全部提交；0 Critical / 0 Important；26 条处置逐条可追溯。
6. **集成**：本地 fast-forward 合并 main；父链末行连续且指向合并前 tip 父提交；清理 worktree 与分支；**不推送**。

## 6. 范围外（本轮不做）

版本 bump、依赖升级、push 远端、B7 之外的测试框架级改造、`-z` NUL 解析重构、`.sql/.tla/.feature` 纳入 codegraph 义务、metrics-report/wm-status 查询语义变更、`.superpowers/` 入库。
