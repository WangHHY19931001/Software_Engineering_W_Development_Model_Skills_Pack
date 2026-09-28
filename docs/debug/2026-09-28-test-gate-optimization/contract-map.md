# Wave 1 契约依赖地图（test-gate-optimization）

> **用途**：Wave 2（改 SUBPROCESS 清单/测试文件）、Wave 4（重组 prepush 执行结构）、Wave 5（coverage 单口径化、audit 收敛）都会动到「有别的门禁/文档在断言的契约」。本地图登记四类契约的全部断言落点，让后续改动知道**谁在看着这些契约**——改动前先查本表，同步全部活体落点。
>
> **基线**：worktree `.worktrees/test-gate-optimization`，分支 `feat/test-gate-optimization`，HEAD `73ee2b23`（2026-09-28）。
> **扫描工具**：ripgrep（rg）等价扫描（PowerShell 环境，经 Grep 工具执行，语义与简报 Step 1 命令一致）。

## 0. 扫描命令（与简报 Step 1/Step 2 一致）

```powershell
# ① prepush 结构断言
rg -n "19 项|首错|prepush|pre-push" AGENTS.md README.md CONTRIBUTING.md CHANGELOG.md docs/INSTALL.md w-model-dev/references/ w-model-dev/scripts/__tests__/README.md docs/troubleshooting.md
# ② 用例数断言
rg -n "2617|2615|用例数|vitestTestCount" <同上文件清单>
# ③ SUBPROCESS 清单引用
rg -n "SUBPROCESS_TEST_FILES" -g "!node_modules" -g "!*.log"
# ④ coverage 阈值断言
rg -n "75/65/85/75|stmts 75|thresholds|覆盖.*阈值|coverage 阈值" AGENTS.md README.md CONTRIBUTING.md docs/INSTALL.md w-model-dev/references/ config/ .githooks/
# Step 2 npx 残留终核
rg -n "npx tsx" w-model-dev/scripts/__tests__/
```

> 执行说明：①②④ 对同一文件采用合并 pattern 一次扫描、按行内容分类登记（结果与分别扫描等价）；③ 全仓扫描（node_modules / *.log 依 .gitignore 与排除项天然排除）；对 `.githooks/` 补跑了 ①②③④ 合并 pattern（简报 ④ 范围含 `.githooks/`，且「已知必含」要求登记 pre-push 头注与各项注释）。

## 判定标准：活体契约 vs 历史证据

- **活体契约**：该断言今后会被维护并被门禁/人核对——AGENTS.md、README.md、CONTRIBUTING.md、docs/INSTALL.md、docs/troubleshooting.md、`w-model-dev/references/`、`w-model-dev/scripts/__tests__/README.md`、`config/`、`.githooks/`、测试文件本体。
- **不动（历史条目）**：CHANGELOG.md 历史版本条目（含提交哈希表），写定即不再改。
- **不动（历史证据）**：`docs/debug/`、`docs/changes/`、`docs/superpowers/` 下的历史规格/计划/发现记录——不是活体契约。
- **不动（字面误命中）**：正则字面匹配但语义不构成该契约断言的行（如「用例数」匹配「测试用例**数据**模型」），登记以避免后续 Wave 误判。

**涉及 Wave 对照**：① → Wave 4；② → Wave 2/3；③ → Wave 2；④ → Wave 5（T1 coverage 单口径化）。

---

## 1. ① prepush 结构断言（19 项清单 / 顺序 / 首错即停）

### 1.1 契约本体与活体断言（改动时必须同步）

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ① prepush 结构 | `.githooks/pre-push:2`（标题注释「本地推送前门禁」） | Wave 4 | 改注释（本体） |
| ① prepush 结构 | `.githooks/pre-push:13-19`（触发条件头注：`w-model-dev/**`、根活体文档、`config/**`、`scripts/**`、`.githooks/**`、`eval/**` 第 19 项、`docs/*.md` 跨层级——含 :17 eval 触发边界）【已知必含·头注】 | Wave 4 | 改注释（本体；路径过滤语义变更时首改此处） |
| ① prepush 结构 | `.githooks/pre-push:25`（手动验证入口 `bash .githooks/pre-push --force` / `npm run prepush`） | Wave 4 | 改注释 |
| ① prepush 结构 | `.githooks/pre-push:36`（pre-push 依赖 bash，`package.json` prepush 用 `bash .githooks/pre-push`） | Wave 4 | 改注释 |
| ① prepush 结构 | `.githooks/pre-push:62-65`（纯 Windows shell 检测提示；:63/:64 明示「19 项门禁未执行」「等 19 项」） | Wave 4 | 改文案+代码（提示语随项数联动） |
| ① prepush 结构 | `.githooks/pre-push:73-76`（log/ok/fail/warn 工具函数，`[pre-push]` 输出前缀） | Wave 4 | 改代码（重组输出结构时涉及） |
| ① prepush 结构 | `.githooks/pre-push:82`（`--force`/`PREPUSH_FORCE` 语义注释） | Wave 4 | 改注释 |
| ① prepush 结构 | `.githooks/pre-push:88`（stdin ref 先读解析策略注释） | Wave 4 | 改注释 |
| ① prepush 结构 | `.githooks/pre-push:238`（stdin ref 解析失败 → fail-closed 全门禁） | Wave 4 | 改代码 |
| ① prepush 结构 | `.githooks/pre-push:296`（**核心总数断言**「全部门禁共 19 项检查（第 14 项 npm audit 为阻断项），退出码必须全部符合预期才放行」） | Wave 4 | 改断言（增删/合并门禁项时必须同步） |
| ① prepush 结构 | `.githooks/pre-push:328-458`（19 项逐项注释 + `run_expect` 调用结构：:325 第 1 项 self-test、:342 第 6 项 security-scan、:346/:350 第 7/8 项 bdd、:362 第 11 项签名链、:366-371 第 12 项 vitest、:381-386 第 13 项规则层覆盖、:388-430 第 14 项 npm audit、:432-439 第 15 项 docs-consistency、:441-444 第 16 项 samples 矩阵、:446-449 第 17 项 prettier、:451-454 第 18 项 tsc、:456-458 第 19 项 eval、:460 收尾行）【已知必含·各项注释】 | Wave 4 | 改注释+改结构（Wave 4 重组执行结构的主战场；:325/:442 亦为②命中，:366-368/:370/:381/:384 亦为④命中） |
| ① prepush 结构 | `AGENTS.md:56`（§2 目录表 `.githooks/pre-push` 行：「自动跑 19 项门禁（self-test + 门禁脚本退出码 + vitest 全量 + 规则层覆盖口径 + security-scan + npm audit + samples 覆盖矩阵 + prettier + tsc + eval 语料断言）」） | Wave 4 | 改文案（结构/项数变化时同步） |
| ① prepush 结构 | `AGENTS.md:72`（§3「Bash 只用于 pre-push 和平台依赖检查」） | Wave 4 | 改文案 |
| ① prepush 结构 | `AGENTS.md:92-93`（§3 命令块「手动跑推送前门禁…19 项门禁检查」+ `npm run prepush`） | Wave 4 | 改文案 |
| ① prepush 结构（兼④） | `AGENTS.md:139`（§6「验收必须全量：`npm run prepush`（19 项，含全量 vitest + 覆盖率阈值）」） | Wave 4 / Wave 5 | 改文案 |
| ① prepush 结构 | `AGENTS.md:189`（§8 check-docs-consistency 行「pre-push 项数…受控 Vitest facts/provenance 完整性（prepush 态）」——docs-consistency 门禁锁 pre-push 项数的活体证据） | Wave 4 | 改文案（项数契约变化时同步） |
| ① prepush 结构 | `AGENTS.md:191`（§8 check-pollution 行「不进 pre-push 19 项」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:31`（健康指标表「推送前门禁（本地 CI，19 项）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:51`（「Git Bash 仅在运行 pre-push 或平台依赖检查时需要」） | Wave 4 | 改文案 |
| ① prepush 结构（兼④） | `README.md:60`（「验收必须全量…`npm run prepush`（19 项门禁，含全量 vitest + 覆盖率阈值）…也不保证覆盖跨文件的注册表类断言」） | Wave 4 / Wave 5 | 改文案 |
| ① prepush 结构 | `README.md:148`（阶段门表注「旧链路 check-opsx-artifacts.ts 已退役…由 pre-push 的 self-test / vitest 间接覆盖」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:217`（项目结构树「.githooks/pre-push # 本地 CI：19 项门禁（含 eval 语料断言）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:244`（CI 策略「本地 git pre-push hook 是唯一门禁：git push 时自动跑 self-test + 各门禁脚本 + vitest 全量 + 安全扫描 + npm audit…」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:247`（「git push --no-verify 视为破坏契约…pre-push 头部有显式警告」） | Wave 4 | 改文案 |
| ① prepush 结构 | `README.md:249`（「pre-push 不会自动安装 node_modules：缺依赖时 exit 1」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:17`（「不需要运行贡献者的 pre-push 门禁」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:83-84`（「仓库内置一个 git pre-push hook，在 git push 时自动跑 19 项检查；任一退出码不符预期即中止推送」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:86`（迭代/验收车道规则：「验收必须跑全量 npm run prepush（19 项）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:156`（手动触发 `npm run prepush`） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:161`（依赖与平台边界「pre-push 缺 node_modules 时 exit 1…绝不自动安装」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:174`（Windows 注意「pre-push 依赖 Bash…请仅在 Git Bash 中运行 npm run prepush」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:197`（提交规范 type 表「ci: 门禁/钩子相关（.githooks/、prepush）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:213`（提交流程「本地验证：npm run prepush（19 项本地门禁，替代云端 CI）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `CONTRIBUTING.md:231`（「本仓库无云端 CI：…由本地 npm run prepush（19 项门禁）验证」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/INSTALL.md:23`（「Bash 只用于 pre-push 和平台依赖检查」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/INSTALL.md:126`（「§3.1 本地 pre-push 与平台依赖」节标题） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/INSTALL.md:162`（「pre-push 本身不自动执行 npm install…以 exit 1 拒绝推送」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/INSTALL.md:164`（推送触发范围：stdin ref 四字段解析 / fork-point / fail-closed / 路径命中清单——与 pre-push :86-:120 行为一一对应） | Wave 4 | 改文案（范围判定语义变更时同步） |
| ① prepush 结构 | `docs/INSTALL.md:166`（「pre-push 仅运行 bash .githooks/ensure-platform-deps.sh --check」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/INSTALL.md:176`（「pre-push 与上述平台依赖命令需要 Bash」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:12-15`（§1.1 现象/原因：pre-push bash 依赖） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:19,22,26,28`（§1.1 处置/声明/正确姿势：「补跑 npm run prepush，确认 19 项门禁全部通过」「--no-verify 视为破坏契约」） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:32,36`（§1.2 node_modules 缺失时 pre-push exit 1） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:59,74`（§1.3 钩子未启用 / pre-push 平台检查边界） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:86,88`（§1.7 docs-consistency T3 语义：prepush 第 15 项受控工件态） | Wave 4 | 改文案 |
| ① prepush 结构（兼②） | `docs/troubleshooting.md:92`（§1.7 处置「npm run prepush 会先跑 vitest 再以同次 JSON + provenance 调 docs-consistency…（用例数以当前命令输出为准）」） | Wave 4 / Wave 2-3 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:94,98`（§1.7a 第 12 项 vitest 抖动——:98 兼含「coverage 阈值」字样） | Wave 4 / Wave 5 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:112,114,118,122`（§1.7b stdin ref 判定 / `--force` 补跑） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:147-154`（§3 环境矩阵表：Git Bash 正常执行 19 项 / npm audit 第 14 项 / node_modules 缺失 exit 1） | Wave 4 | 改文案 |
| ① prepush 结构 | `docs/troubleshooting.md:161,163,166`（§4 速查表：push 无 [pre-push] 输出 / bash 报错 / docs-consistency prepush 态） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/code-health-governance.md:83`（「19 项 pre-push 不变：code-health CLI 不纳入 .githooks/pre-push」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:21`（docs-consistency 句式契约边界：限 pre-push / 平台检查的自动安装主张） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:392`（「code-health CLI 不纳入 .githooks/pre-push，19 项检查不变」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:409`（「该项目阶段门与本地 pre-push fixture 回归分层：pre-push 不调用本 CLI」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:438`（「本地 pre-push 直接运行的是技能包 check-bdd-model fixture 回归」） | Wave 4 | 改文案 |
| ① prepush 结构（兼④） | `w-model-dev/references/command-reference.md:450`（check-coverage-scope 用途行「…强制阈值，独立于 vitest 全分母阈值（pre-push 覆盖率项）」） | Wave 4 / Wave 5 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:458-461`（docs-consistency 三态：pre-push 第 15 项注入 WM_VITEST_COUNT_FILE / 无 prepush 场景 / 终局验收一律 npm run prepush） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:489`（「不进 pre-push 19 项（prePushCount: 19 不变）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/command-reference.md:497`（校准集「未接入 CI / pre-push / self-test」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/bdd.md:676`（「项目门与 pre-push fixture 分层：pre-push 不传 required flags」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:368`（旧 opsx 门「不再在 pre-push 执行路径上」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:379`（dispatch-matrix 表头注「漏登记即门禁失败，pre-push 第 15 项拦截」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:383-384`（dispatch-matrix：check-docs-consistency 第 15 项 / check-samples-coverage 第 16 项） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:396`（dispatch-matrix：security-scan「仓库维护（pre-push 第 6 项）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:402`（dispatch-matrix：check-pollution「不进 pre-push 19 项」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:640`（「prepush 级门禁（19 项，≈35-45 分钟）由控制者后台执行」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/subagent-delegation.md:711`（阶段 5-8 门禁顺序注「check-opsx-artifacts.ts 已退役（不在 pre-push 路径上）」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/tla-plus.md:535`（「该项目工件门不同于本地 pre-push 的技能包 fixture 回归」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/references/phase-5-coding.md:79`（codegraph 覆盖义务「.githooks/ 下无扩展名脚本（如 pre-push）按 code 文件计」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/scripts/__tests__/README.md:13`（bdd-cli.test.ts 矩阵行「pre-push fixture 与项目阶段门文档边界」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/scripts/__tests__/README.md:50`（docs-consistency-logic.test.ts 矩阵行「**pre-push hook 源契约**（stdin 四字段先读·fallback 只作空 stdin 回退·全零 sha 双分支·--置于两 sha 之后·fail-closed·无 -n 截断）」——**测试直接锁定 pre-push 行为**） | Wave 4 | 改断言（pre-push 范围判定语义变更时此测试须同步） |
| ① prepush 结构 | `w-model-dev/scripts/__tests__/README.md:78`（platform-deps-hook.test.ts 矩阵行「pre-push 依赖边界与触发路径」） | Wave 4 | 改文案 |
| ① prepush 结构 | `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`（矩阵 :78 所指测试本体，锁 pre-push 触发路径与依赖边界） | Wave 4 | 改断言 |

### 1.2 历史（不动）

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ① prepush 结构 | `CHANGELOG.md:12,26,33,34,39,45,74,120,123,137,184,185,189,199,203,223,233,234,244,245,252,253,259,275,298,313,318,332,334,340,345,354,361,443,444,450,452,455,473,482,483,485,488,489,490,499,502,522,532,543,553,558,569,627,634,637,658,678,700,707,715,774,782,794,803,805,808,813,816,817,825,880,917,918,935,947,948,956,973,976,1055,1058,1097,1107,1124`（共 83 行：`[42.4.1]`/`[42.4.0]` 及以下各版本条目中的 prepush 19 项结构、prepush 验收记录；:569/:627/:634/:637/:658/:678/:700 为提交哈希表中含 prepush/pre-push 的 commit message） | — | 不动（历史条目） |

> 注：CHANGELOG 中另有 5 行同时命中 ①②（:12, :39, :500, :875, :1049——`[42.4.1]`/`[42.4.0]` 条目头与 P0-1/测试增长记录，兼含 prepush 结构与用例数计数），已并入下表 ② 历史节登记；:340 兼 ①②③ 一并在 ② 历史节登记。

---

## 2. ② 用例数断言（2617/2615/「用例数」/vitestTestCount）

### 2.1 活体断言

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ② 用例数（vitest 口径「以当前命令输出为准」） | `AGENTS.md:45`（§2 scripts 目录行「__tests__/（vitest 单元测试，文件数与用例数以当前命令输出为准 + README.md coverage 矩阵）」） | Wave 2/3 | 改文案 |
| ② 用例数 | `AGENTS.md:60`（「门禁脚本单元测试（vitest，文件数与用例数以当前命令输出为准）」） | Wave 2/3 | 改文案 |
| ② 用例数（self-test 口径） | `AGENTS.md:185`（§8 self-test.ts 行「回归基线（样本用例，用例数以运行输出为准）」） | Wave 2/3 | 改文案 |
| ② 用例数 | `README.md:27`（健康指标表「Self-test（样本回归基线，用例数以运行输出为准）」；:28「vitest 以当前命令输出为准」为同口径表述） | Wave 2/3 | 改文案 |
| ② 用例数 | `CONTRIBUTING.md:59`（§3.1「单元测试（vitest，文件数与用例数以当前命令输出为准…）」） | Wave 2/3 | 改文案 |
| ② 用例数 | `CONTRIBUTING.md:62`（§3.2「self-test 运行用例，用例数以运行输出为准」） | Wave 2/3 | 改文案 |
| ② 用例数 | `CONTRIBUTING.md:92`（门禁表第 1 项「npm run self-test（样本回归基线，用例数以运行输出为准）」） | Wave 2/3 | 改文案 |
| ② 用例数（兼④） | `CONTRIBUTING.md:103`（门禁表第 12 项「npx vitest run --coverage…文件数/用例数以同次受控 JSON facts 与 provenance 为准」） | Wave 2/3 / Wave 5 | 改文案 |
| ② 用例数（动态 facts 契约） | `CONTRIBUTING.md:240`（文档维护规则「Vitest 文件数/用例数属于动态 facts，只能来自同次受控 JSON 与 provenance，以当前命令输出为准，不从活体文档文本反推」——**口径权威句**） | Wave 2/3 | 改文案（若 Wave 2/3 改变计数口径须先改此处） |
| ② 用例数 | `CONTRIBUTING.md:262`（结构树 self-test.ts 行） | Wave 2/3 | 改文案 |
| ② 用例数 | `CONTRIBUTING.md:263`（结构树 __tests__/ 行） | Wave 2/3 | 改文案 |
| ② 用例数 | `docs/INSTALL.md:115`（结构树「__tests__/ # vitest 单元测试（文件数与用例数以当前命令输出为准 + README.md coverage 矩阵）」） | Wave 2/3 | 改文案 |
| ② 用例数 | `docs/INSTALL.md:300`（依赖表「回归基线脚本（用例数以运行输出为准）」） | Wave 2/3 | 改文案 |
| ② 用例数 | `docs/INSTALL.md:350`（devDep 说明「vitest + @vitest/coverage-v8（…文件数与用例数以当前命令输出为准）」） | Wave 2/3 / Wave 5 | 改文案 |
| ② 用例数（受控动态 facts） | `docs/troubleshooting.md:90`（§1.7 原因「docs-consistency 的 vitest 文件数与用例数是受控动态 facts…README / AGENTS 对 vitest 的表述为『以当前命令输出为准』」） | Wave 2/3 | 改文案 |
| ② 用例数（self-test 输出语义） | `w-model-dev/references/command-reference.md:372`（wm-status「输出项目名、阶段、需求数、测试用例数和 RTM 覆盖率」——字面命中；语义为 wm-status 的项目测试用例计数，非 vitest 门禁用例数断言） | — | 不动（字面命中，语义区分：非 vitest 用例数契约） |
| ② 用例数 | `w-model-dev/references/subagent-delegation.md:397`（dispatch-matrix self-test 行「样本回归基线，用例数以运行输出为准（pre-push 第 1 项）」） | Wave 2/3 / Wave 4 | 改文案 |
| ② 用例数 | `.githooks/pre-push:325`（第 1 项注释「self-test：样本回归基线，用例数以运行输出为准…必须 exit 0」） | Wave 2/3 / Wave 4 | 改注释 |
| ② 用例数（兼④） | `.githooks/pre-push:366,369`（第 12 项注释「文件数/用例数以同次 JSON facts 与 provenance 为准 + coverage 阈值门禁…--reporter=json --outputFile 落盘实测用例总数，供第 15 项复用」） | Wave 2/3 / Wave 5 / Wave 4 | 改注释 |
| ② 用例数 | `.githooks/pre-push:432`（第 15 项注释「复用第 12 项 vitest JSON 用例数，不二次全量 vitest」） | Wave 2/3 / Wave 4 | 改注释 |
| ② 用例数（字面） | `.githooks/pre-push:442`（第 16 项注释「核对每个 fixture 被 self-test.ts 用例数组引用」——「用例数组」字面前缀命中，语义为 samples 矩阵引用检查） | — | 不动（字面命中，语义区分） |
| ② 用例数（字面误命中） | `w-model-dev/references/data-models.md:7,25,44,116`（「项目/需求/设计/测试用例数据模型」——「用例数」匹配「用例数据」；语义为数据模型节名，非用例数断言） | — | 不动（字面误命中） |

### 2.2 历史（不动）

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ② 用例数 | `CHANGELOG.md:12`（**[42.4.1] 条目头**：「vitest 用例数 2615 → 2617…prepush 19…均不变」——兼①）【已知必含·[42.4.1] 历史计数】 | — | 不动（历史条目） |
| ② 用例数 | `CHANGELOG.md:20`（[42.4.1] L5 条「用例数不变」） | — | 不动（历史条目） |
| ② 用例数 | `CHANGELOG.md:31`（[42.4.1] 计数与验收「vitest 用例数：2615 → 2617（+2…testFileCount 106 不变）」）【已知必含·[42.4.1] 历史计数】 | — | 不动（历史条目） |
| ② 用例数 | `CHANGELOG.md:39`（[42.4.0] 条目头「vitest 用例数自度量下降 2674 → 2615」——兼①） | — | 不动（历史条目） |
| ② 用例数 | `CHANGELOG.md:117,118,139`（[42.4.0] 计数节：self-test 381→381 / 门禁强制计数契约不变 / docs-consistency 计数——:139 兼③ 提及） | — | 不动（历史条目） |
| ② 用例数 | `CHANGELOG.md:454`（[41.x] vitest 串行化条「vitestTestCount: -1」校准记录） | — | 不动（历史条目） |
| ② 用例数（兼①） | `CHANGELOG.md:500`（「pre-push 17 项、CLI 37 项、schema 25 份统计口径不变」） | — | 不动（历史条目） |
| ② 用例数（兼①） | `CHANGELOG.md:875`（P0-1 消除 vitest 双跑「第 14 项 check-docs-consistency 经 WM_VITEST_COUNT_FILE 复用用例数」） | — | 不动（历史条目） |
| ② 用例数（兼①） | `CHANGELOG.md:1049`（测试增长计数记录） | — | 不动（历史条目） |

---

## 3. ③ SUBPROCESS_TEST_FILES 清单引用

### 3.1 活体断言（清单本体 + 守护测试 + 消费者）

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ③ SUBPROCESS 清单 | `config/vitest.config.ts:35-81`（**清单本体**：`export const SUBPROCESS_TEST_FILES` 45 个成员文件名，cli-serial 成员名单 + unit-parallel 排除名单的单一事实源）【已知必含】 | Wave 2 | 改断言（Wave 2 增删/转换测试文件时改此清单；vitest-project-split.test.ts 双向守护强制同步） |
| ③ SUBPROCESS 清单 | `config/vitest.config.ts:8-25`（头注：拆分背景与登记约定；:10 历史计数「2026-09-18 收口实测 40 个…2026-09-25 新增后为 41 个」、:17-19「新增会真实 spawn 子进程的测试文件必须登记进 SUBPROCESS_TEST_FILES…反向地，不再 spawn 的文件也应从清单移除（该测试双向校验）」、:23-25 已知盲点 run-sync.test.ts） | Wave 2 | 改注释（清单成员变化时历史计数句按 T4 口径改自描述；Wave 2 计划已含此项） |
| ③ SUBPROCESS 清单 | `config/vitest.config.ts:83`（`subprocessGlobs = SUBPROCESS_TEST_FILES.map(...)`——两 project 的 glob 由常量派生，防手写绕过） | Wave 2 | 改断言（vitest-project-split.test.ts:122-128 锁定此派生关系） |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:2,4,8`（头注：双 project 拆分守护说明） | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:36`（`import { SUBPROCESS_TEST_FILES } from '../../../config/vitest.config.js'`——运行时消费清单） | Wave 2 | 改断言（import 路径/形态变更时同步） |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:57`（describe「vitest project 拆分：SUBPROCESS_TEST_FILES 双向守护」） | Wave 2 | 改断言 |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:81`（unit-parallel exclude = SUBPROCESS_TEST_FILES 派生 glob 断言） | Wave 2 | 改断言 |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:91`（exclude 长度 = 清单长度 + 1 断言——**清单条目数直接进断言**） | Wave 2 | 改断言 |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:94-101`（清单成员文件存在 + spawn 证据逐文件断言） | Wave 2 | 改断言 |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:103-120`（**双向校验**：有 spawn 证据未登记 → missing 红灯；登记无证据 → stale 红灯） | Wave 2 | 改断言（Wave 2 改清单/转测试文件时的强制守护） |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/vitest-project-split.test.ts:122-128`（配置源码必须从常量派生 project、不得手写 glob / 不得 fileParallelism: true） | Wave 2 / Wave 4 | 改断言 |
| ③ SUBPROCESS 清单 | `docs/troubleshooting.md:96`（§1.7a 状态注「2026-09-18 收口实测 SUBPROCESS_TEST_FILES 为 40 个；『30』是拆分当时的条目数，不是设计常量」） | Wave 2 | 改文案（历史口径句，清单变化不追新；Wave 2 若改自描述措辞则同步） |
| ③ SUBPROCESS 清单 | `docs/troubleshooting.md:105`（§1.7a 处置 2「新增会真实启动子进程的测试文件必须登记进配置里的 SUBPROCESS_TEST_FILES——vitest-project-split.test.ts 双向守护该清单…判定口径…run-sync.test.ts 已知盲点」） | Wave 2 | 改文案（登记约定权威表述处之一） |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/README.md:110`（vitest-project-split.test.ts 矩阵行「cli-serial（SUBPROCESS_TEST_FILES，fileParallelism:false）双向校验——spawn 证据与清单精确相等，漏登记/残留/文件不存在均红灯；配置必须从常量派生 glob」）【已知必含·测试矩阵】 | Wave 2 | 改文案（矩阵行随守护测试语义变化同步） |
| ③ SUBPROCESS 清单 | `w-model-dev/scripts/__tests__/README.md:112`（wm-append-runlog-cli.test.ts 矩阵行末尾「登记 config/vitest.config.ts SUBPROCESS_TEST_FILES（子进程类串行）」） | Wave 2 | 改文案 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/asset-budget.test.ts:17`（「无需登记…（vitest-project-split 双向守护）」） | Wave 2 | 改注释（该文件 spawn 状态翻转时同步） |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/budget-cli-wiring.test.ts:20`（「已登记…SUBPROCESS_TEST_FILES」） | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts:20`（「…（cli-serial 项目串行执行）」） | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/check-coverage-scope.test.ts:12` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/check-pollution-cli.test.ts:15` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/checkpoint-logic-rule-loadbearing.test.ts:16`（「不 spawn 子进程 → 无需登记」） | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/checkpoint-r0-bootstrap-cli.test.ts:20` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/code-health-contract-rule-loadbearing.test.ts:20` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts:18` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/l0-rule-loadbearing.test.ts:18` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（已登记声明） | `w-model-dev/scripts/__tests__/review-package-cli.test.ts:17` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/root-cause-logic-rule-loadbearing.test.ts:18` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/tla-logic-rule-loadbearing.test.ts:23` | Wave 2 | 改注释 |
| ③ SUBPROCESS 清单（未登记声明） | `w-model-dev/scripts/__tests__/verifier-logic-rule-loadbearing.test.ts:21` | Wave 2 | 改注释 |

> **Wave 2 操作提示**：清单成员的增删会同时触发——vitest-project-split.test.ts:91（长度断言）与 :94-120（双向校验）红灯；上述 14 个测试文件的「已登记/无需登记」头注一致性；`__tests__/README.md` 矩阵行；troubleshooting §1.7a 的历史口径句不追新。run-sync.test.ts 为已知盲点（vitest.config.ts:23-25、troubleshooting:105 已登记，修正需单独立项）。

### 3.2 历史（不动）

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ③ SUBPROCESS 清单 | `CHANGELOG.md:216,242,340,453`（历史版本条目中 SUBPROCESS_TEST_FILES 计数/追加记录；:340 兼①②） | — | 不动（历史条目） |
| ③ SUBPROCESS 清单 | `docs/changes/vitest-parallel-flakiness-finding.md:52`（vitest 并行抖动发现记录——拆分背景的历史证据） | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/specs/2026-09-18-leftovers-closeout-design.md:68`（历史规格：spawn 文件须登记清单 + 矩阵） | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md:57,96`（本计划设计文档：T4 清单注释计数改自描述） | — | 不动（历史证据——但 :96 即 Wave 2 的执行依据，实施时以活体文件为准） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-14-p2a-gate-negative-coverage-and-atomicity.md:66,164,187,195` | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-15-p2b-rule-loadbearing-and-completeness.md:69,91,104` | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-18-leftovers-closeout.md:38,290,464,821,1038,1263,1333,1354,1355,1356`（含 :1333「SUBPROCESS_TEST_FILES.length = 40（运行时 import 实测）」历史实测） | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-21-superpowers-replace-opsx.md:29,43,68` | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md:444` | — | 不动（历史证据） |
| ③ SUBPROCESS 清单 | `docs/superpowers/plans/2026-09-28-test-gate-optimization.md:118,424,461,559,574,585,614,631,685`（本计划自身的扫描命令与 Wave 2 步骤引用） | — | 不动（历史证据——Wave 2 实施蓝图，非活体契约） |

---

## 4. ④ coverage 阈值断言（75/65/85/75 / thresholds / 覆盖阈值）

### 4.1 活体断言

| 契约 | 断言落点（file:line） | 涉及 Wave | 改动面 |
| --- | --- | --- | --- |
| ④ coverage 阈值（全分母口径） | `config/vitest.config.ts:122-131`（**coverage 块本体**：provider v8 + include logic/lib + reporter text/json + thresholds `{ statements: 75, branches: 65, functions: 85, lines: 75 }`；:121/:125/:126 注释（第 13 项独立口径 + json reporter 供 pre-push 消费）、:128 基线注释「2026-08-12 实测 stmts 75.32 / branch 66.57 / funcs 85.5 / lines 76.62 取整到 5 的倍数」、:130 阈值常量）【已知必含】 | Wave 5（T1 单口径化主对象） | 改断言（阈值/口径变更时改常量与注释） |
| ④ coverage 阈值（全分母口径） | `.githooks/pre-push:366-368`（第 12 项注释「logic/ + lib/ 阈值 stmts 75 / branch 65 / funcs 85 / lines 75，阈值不达标 vitest 会 exit 1 阻断推送；基线见 config/vitest.config.ts coverage.thresholds 注释」） | Wave 5 / Wave 4 | 改注释（与 vitest.config.ts 阈值同步） |
| ④ coverage 阈值 | `.githooks/pre-push:370`（第 12 项 run_expect「vitest 单元测试 + coverage 阈值通过」） | Wave 5 / Wave 4 | 改文案 |
| ④ coverage 阈值（规则层口径） | `.githooks/pre-push:381-383`（第 13 项注释「check-coverage-scope…阈值 = 2026-09-18 实测（logic+lib）：stmts 84.25 / branch 77.87 / funcs 93.68 / lines 87.01，向下取整到 5 的倍数」） | Wave 5（T1 单口径化第二对象） | 改断言/改注释 |
| ④ coverage 阈值（规则层口径） | `.githooks/pre-push:384-386`（第 13 项 run_expect + CLI 参数 `--min-statements=80 --min-branches=75 --min-functions=90 --min-lines=85`——**阈值常量的活体执行点**） | Wave 5 | 改断言（单口径化时此参数与 config/vitest.config.ts thresholds 二选一收敛） |
| ④ coverage 阈值（规则层口径） | `CONTRIBUTING.md:104`（门禁表第 13 项「阈值 80/75/90/85 = 2026-09-18 实测…向下取整到 5 的倍数，不达 exit 1」） | Wave 5 | 改文案 |
| ④ coverage 阈值（规则层口径） | `AGENTS.md:165`（§8 check-coverage-scope.ts 行「对 coverage/coverage-final.json 按 logic+lib 白名单分母重算…强制阈值（独立于 vitest 全分母阈值）」） | Wave 5 | 改文案 |
| ④ coverage 阈值（规则层口径） | `w-model-dev/references/command-reference.md:451`（COVERAGE_SCOPE_JSON 字段定义行，含 `thresholds` 字段名） | Wave 5 | 改文案 |
| ④ coverage 阈值（规则层口径） | `w-model-dev/references/subagent-delegation.md:385`（dispatch-matrix check-coverage-scope 行「按 logic+lib 白名单分母重算…强制阈值（独立于 vitest 全分母阈值）」） | Wave 5 | 改文案 |
| ④ coverage 阈值（规则层口径） | `docs/troubleshooting.md:98,106`（§1.7a 第 12 项「vitest 单元测试 + coverage 阈值通过」/「**不得**改写 coverage 阈值」——:98 为①节已登记的兼类行；:106 为撰写本图时的补充发现，不在简报 ④ 文件清单内但同为活体阈值断言，一并登记） | Wave 5 | 改文案 |
| ④ coverage 阈值（方法论口径，非仓库门禁） | `w-model-dev/references/quality-standards.md:24`（质量标准表「单元测试代码覆盖率 ≥ 80%（分支 + 行）…禁止调低阈值放行」） | —（与 Wave 5 不同口径） | 不动（方法论指导阈值，非 config 门禁；Wave 5 收敛时注意区分口径避免误改） |
| ④ coverage 阈值（方法论口径） | `w-model-dev/references/quality-standards.md:272-273`（降级方案「覆盖率阈值同主工具（≥80% 分支+行）」/「粗略覆盖率不得作为放行依据」） | — | 不动（方法论口径） |
| ④ coverage 阈值（方法论口径） | `w-model-dev/references/phase-4-detailed-design.md:269,282`（评审清单「覆盖率评估无阈值 → 必须给出分支覆盖 ≥ 80% 目标」） | — | 不动（方法论口径） |
| ④ coverage 阈值（方法论口径） | `w-model-dev/references/phase-5-coding.md:420,515`（反模式表「调低阈值放行 / 阈值固定 ≥ 80%」） | — | 不动（方法论口径） |
| ④ coverage 阈值（方法论口径） | `w-model-dev/references/workflow.md:88`（「覆盖率 ≥ 80%、P95 < 2s、高危漏洞数 = 0」硬阈值） | — | 不动（方法论口径） |

> **Wave 5 口径澄清**：仓库门禁侧双口径 = 全分母（config/vitest.config.ts:130，75/65/85/75）+ 规则层 logic+lib（pre-push:386 CLI 参数，80/75/90/85）；references 中 ≥80% 均为 W-Model 方法论对**用户项目**的质量指导，与仓库门禁阈值不同源，Wave 5 单口径化不涉及。

---

## 5. Step 2：npx 残留终核（`rg -n "npx tsx" w-model-dev/scripts/__tests__/`）

**实测恰好 8 行命中（7 处代码 + 1 处注释），与简报预期一致，无新增残留需要并入登记。**

| # | 断言落点（file:line） | 类型 | 内容 |
| --- | --- | --- | --- |
| 1 | `check-archive-integrity-cli.test.ts:6` | 注释 | 「覆盖（真实 npx tsx check-archive-integrity.ts 子进程，非纯逻辑直调）」 |
| 2 | `check-coding-plan.test.ts:155` | 代码 | `execSync(\`npx tsx "${CLI}" ${cmdArgs.join(' ')}\`, …)` |
| 3 | `check-codegraph-queries.test.ts:485` | 代码 | `execSync(\`npx tsx "${CLI}" ${args.join(' ')}\`, …)` |
| 4 | `coverage-logic.test.ts:397` | 代码 | `execSync(\`npx tsx ${scriptPath} …\`, …)` |
| 5 | `coverage-logic.test.ts:415` | 代码 | 同上 |
| 6 | `coverage-logic.test.ts:433` | 代码 | 同上 |
| 7 | `eval-runner.test.ts:12` | 代码 | `execSync(\`npx tsx "${join(repoRoot, 'eval', 'runner.ts')}" --self-check\`, …)` |
| 8 | `eval-runner.test.ts:21` | 代码 | 同上 |

> 另：`config/vitest.config.ts:4` 头注提及「部分测试用 execSync 启动 npx tsx <script> 子进程」（testTimeout 说明），不在 `__tests__/` 扫描范围内，非残留代码，仅此备注。

---

## 6. 已知必含六项核对

| # | 简报要求 | 本表登记位置 | 状态 |
| --- | --- | --- | --- |
| 1 | `config/vitest.config.ts:35-81`（SUBPROCESS 清单，Wave 2） | §3.1 第 1 行（含 :8-25 头注、:83 派生行） | ✅ |
| 2 | `__tests__/README.md`（测试矩阵，Wave 2/3） | §3.1 :110/:112 行 + §1.1 :13/:50/:78 行（矩阵整体为 Wave 2/3 改测试文件时的同步面） | ✅ |
| 3 | pre-push 头注 :13-19（Wave 4） | §1.1「.githooks/pre-push:13-19」行 | ✅ |
| 4 | pre-push 各项注释（Wave 4） | §1.1「.githooks/pre-push:328-458」行（19 项逐项注释+run_expect 结构） | ✅ |
| 5 | `config/vitest.config.ts:122-131` coverage 块（Wave 5 T1） | §4.1 第 1 行 | ✅ |
| 6 | CHANGELOG `[42.4.1]` 历史计数（不动） | §2.2 CHANGELOG.md:12/:31 行（标【已知必含·[42.4.1] 历史计数】） | ✅ |

## 7. 统计摘要

| 类别 | 活体条目 | 历史（不动） | 合计 |
| --- | --- | --- | --- |
| ① prepush 结构断言 | 73 条（覆盖 102 个命中行） | 1 条（CHANGELOG 88 行，含并入②节的 5 行交叉） | — |
| ② 用例数断言 | 22 条（覆盖 26 个命中行，其中 4 行字面/语义区分、4 行误命中） | 9 条（CHANGELOG 11 行，含 5 行与①交叉） | — |
| ③ SUBPROCESS 清单引用 | 29 条（覆盖 35 个命中行） | 10 条（CHANGELOG 4 行 + docs/superpowers·changes 历史 34 行） | — |
| ④ coverage 阈值断言 | 15 条（覆盖 26 个命中行 + 1 行补充发现，其中 6 行方法论口径标注不动） | 0 | — |
| ③ 全仓命中总数 | — | — | 73 行 ✅（与 rg 输出一致） |
| Step 2 npx 残留 | — | — | 恰好 8 行 ✅（7 代码 + 1 注释） |

**四类扫描命中行总数**：① 190 行（活体 102 + CHANGELOG 88）、② 37 行（活体 26 + CHANGELOG 11）、③ 73 行（活体 35 + 历史 38）、④ 26 行（全活体）；交叉命中行（①+②、①+④、②+④、①②③）在对应条目标注「兼」。

## 8. 给后续 Wave 的三条硬提醒

1. **Wave 2 改 SUBPROCESS 清单**：红灯强制面 = `vitest-project-split.test.ts:91/:94-128`；文案同步面 = `vitest.config.ts:8-25` 头注（含 :10 历史计数句改自描述）、14 个测试文件头注、`__tests__/README.md` 矩阵行；troubleshooting:96 历史口径句不追新。
2. **Wave 4 重组 prepush**：项数断言强制面 = `pre-push:296` + `check-docs-consistency`（pre-push 项数检查，见 AGENTS:189）+ `docs-consistency-logic.test.ts`（pre-push hook 源契约，见 __tests__/README:50）；结构文案同步面 = AGENTS:56、README:31/:217/:244、CONTRIBUTING:83-84/:90-110 门禁表、INSTALL:126/:164、troubleshooting §1/§3/§4、references dispatch-matrix（subagent-delegation:379-402）。
3. **Wave 5 coverage 单口径化**：双阈值落点 = `config/vitest.config.ts:130`（75/65/85/75）与 `pre-push:384-386` CLI 参数（80/75/90/85），同步注释面 = vitest.config.ts:121/:125/:128、pre-push:366-368/:381-383、CONTRIBUTING:103-104、AGENTS:165、command-reference:449-451、subagent-delegation:385；references 中的 ≥80% 为方法论口径，**不在**收敛范围。
