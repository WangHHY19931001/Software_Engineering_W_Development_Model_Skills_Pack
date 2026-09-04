# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 41.0.0 之前的历史变更已归档至 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。
> 历史决策详情（轮次记录 / 关键决策 / 验证数据 / 吸收决策记录）归档于
> [`docs/changes/decision-log/`](./docs/changes/decision-log/README.md)（轮次 → 版本 → CHANGELOG 映射见其 README）。

## [42.2.1] - 2026-09-01

### 修复（42.2.0 后静态审计整改）

- **模板链接与门禁一致性**：修正 `templates/requirement-spec.md` 的 6 条子模板路径，并将模板漂移门禁及回归 fixture 同步到 `requirement-spec/` 子目录；聚焦 Vitest 52/52、全量 Vitest 1247/1247。
- **编排闭环与示例契约**：SKILL 恢复 `R3×3 → G(check-preventive-review) → V → G` 顺序和完整普通返工链；examples 总览、阶段 1、阶段 5 编码及阶段 6-8 测试执行示例补齐角色隔离、CHECKPOINT、codegraph/OpenSpec、BDD 必填参数、当前 GRAPH_JSON 字段、真实 `result=pass|fail` 回填及阶段 7 `--phase=7`。
- **L0/L1 与历史证据边界**：保留并明确分类 92 条 L1-only 脚本链接，quickstart 将 npm/doctor 验证限定为 L1，技术写作者模板改为消费项目贡献指南占位；41.9.0 real-run evidence 按历史快照锁定，`272/234/15` 不与 42.2.0 的 `282/244/15` 作趋势比较。
- **独立审查第 1 轮闭合**：补齐此前遗漏的 stage 5-8 独立示例、phase references、BDD 指南、workflow、DoD、分派模板和测试模板。普通 V/G 失败统一为 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3×3/预防审查/V/G/用户 CHECKPOINT；所有可复制 `/wm test` 含真实 `result`，所有项目阶段 BDD 调用按 phase 强制 TLA/graph/Cucumber 参数，stage 6/7 BDD_JSON 采用当前摘要形状。新增严格 L0/L1 审计与 8 条 TDD 回归，仅现存 `scripts/samples/tools` 可归 L1-only，其他断链/越界 fail-closed；当前测量为 645 条、L1-only 92、模板占位 36、意外断链 0。
- **独立审查第 2 轮闭合**：phase 5-8 references 的 `/wm test` 入口统一要求真实 `result=<pass|fail>`，诊断表降级为 R 定位线索，实际返工和跨阶段动作只能经 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3/preventive/V/G/用户 CHECKPOINT。旧需求/设计交互示例补普通失败分支。L0/L1 审计对缺失必需 L0 目录/`SKILL.md` 和包外 L0/L1 symlink fail-closed，新增相应 TDD 回归。
- **独立审查第 3/4 轮闭合**：phase 5 的票据化例外不再允许直接 `R→S-fix`，且新增全量 references/examples/templates 文件扫描契约，单一 bug/TLA+ 不变式违反仍走完整普通失败链；L0 审计对顶层及嵌套 L0 目录 symlink/junction、缺失必需 L0 资产和包外 L0/L1 真实路径 fail-closed。新增公开 `npm run audit:l0-links [-- --root=<skill-root>]` 入口，输出结构化 `L0_LINK_AUDIT_JSON` 与真实 exit 0/1/2，不改变 prepush 17 项或 cli 脚本计数。
- 历史/中间验证：初版分层链接检查为 641 条（后续文档链接新增导致当前严格审计为 647 条），L0 CLI 当前审计 `647/92/36/0`（历史测量；后经 workflow.md 新增 2 条合法引用链接更新为 649/92/36/0，见下——字段口径 relativeLinkCount/l1OnlyCount/templatePlaceholderCount/violations），eval 25/25，self-test 262/262，samples coverage 282 fixtures / 244 referenced files / 15 dirs，docs-consistency 静态/动态违规 0，doctor exit 0（0 阻断 / 3 可选提示）。版本同步后 Git Bash `bash -c "npm run prepush"` 真实 exit 0，17 项全绿；独立审查第 1 轮完整 Vitest 为 61 files / 1265 tests / 1265 passed，第 2 轮为 61 files / 1271 tests / 1271 passed，第 3 轮为 62 files / 1277 tests / 1277 passed，第 4 轮为 62 files / 1279 tests / 1279 passed；这些是历史/中间测量，不冒充当前最终 HEAD。
- **独立审查第 5 轮最终修复**：完整 phase references、templates、legacy examples 的普通失败指引均要求 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；`/wm test` 只接受真实 `result=pass|fail` 占位或运行器实际值 `result=pass`/`result=fail`，非法占位有边界断言。L0 审计以 lstat/realpath fail-closed 拒绝 L0/L1 文件与目录 symlink/junction、包外路径、未允许 broken link 和 malformed percent-encoding，并对未被引用的 L1 链接做不跟随目录扫描；CLI 默认 root、显式 `--root`、exit 0/1/2 和注册表均有契约测试。历史/中间 L0 CLI 测量为 `647/92/36/0`；版本保持 42.2.1。
- **第 5 轮后续收尾**：以 TDD 补齐 Windows drive-letter 正斜杠与反斜杠路径回归；显式识别 `C:/...` 与 `C:\\...`，不依赖 POSIX 上的 `path.isAbsolute`，两类路径均结构化 violation/exit 1。正常 `https:`、`mailto:` 与 fragment URI 继续位于相对链接审计范围之外，畸形 URI 保持 fail-closed。删除 `phase-5-coding.md:262` 尾随 ASCII 空格，并同步验收记录的第 1～5 轮范围与父链提交主题。后续定向测试为 4 files / 68 tests，完整 Vitest 为 62 files / 1303 tests / 1303 passed，串行 docs-consistency 为静态/动态违规 0、provenance 1303/1303；最终 Git Bash prepush 与最终 HEAD 由外部命令核验。

- **最终契约收口**：递归扫描全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作，明确禁止语境与 phase 1 ingestion A-chunk/A-cross→G 专用收敛例外；普通失败均要求完整 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 链，`/wm test` 值按边界断言。补充 L0 根目录 symlink/junction 与 CLI stderr `ERROR_JSON` 回归；README、toolbox、command-reference、subagent registry、dependency-boundaries/security 契约保持登记，版本 42.2.1 与 fast-uri 3.1.7 保持不变。
- **本轮定向验证**：4 files / 70 tests / exit 0（examples-contract 20/20、L0 logic 29/29、CLI 11/11、dependency-boundaries 10/10）；完整 Vitest 62/1307、串行 docs-consistency 重跑 0（1307/1307）、eval/self-test/doctor/samples/security/typecheck/npm audit 均已实测通过；Git Bash prepush 首次在第 13 项因 registry `ENOTFOUND` / audit endpoint 不可达 exit 1，格式化修复后及最终证据同步后均真实 exit 0、17 项全绿；网络失败作为瞬时 concern 留档，未冒充代码通过。
- **Task 8 最终修复轮（2026-09-03）**：`examples-contract.test.ts` 递归覆盖全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作与多行 `/wm test` 命令；普通失败统一走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，phase 1 ingestion 保持 A-chunk/A-cross→G 专用收敛。L0 审计既有 fail-closed 边界补内部非 Markdown 目录 symlink/junction 回归；版本 42.2.1、fast-uri 3.1.7、pre-push 17 项和 CLI 37 项统计均保持不变。
- **最终修复轮验证**：examples-contract 23/23、L0 logic 30/30、L0 CLI 11/11、全量 Vitest 62 files / 1311 tests / 1311 passed；L0 CLI 默认/显式 root 均为 `647/92/36/0`，eval 25/25，self-test 262/262，doctor 0 阻断/3 提示，samples 282/244/15，security 新增 0，typecheck、npm audit high、docs-consistency 均 exit 0。Git Bash `bash -c "npm run prepush"`：证据提交后首次因格式检查发现 1 个文件 exit 1；按 prepush 配置格式化后，在最终记录提交后真实 exit 0、17 项全绿。
- **扫描器收口修复轮（2026-09-03）**：`examples-contract.test.ts` 扫描器改为保留作用域的分析单元——表格行按整行分析（失败信号在「质量门未通过」单元、旁路动作在「回阶段 5 编码返工」单元时不再漏报），普通行按句/单元分析，fenced 代码块跳过；同一单元出现「完整普通失败链」字样或完整箭头链即视为满足，合法 R-first 描述（先分派 R → V 复审 → 才可分派 S-fix）与禁令复述不误报，C/D 仅在路由到动作时构成失败上下文，phase 1 ingestion A-chunk/A-cross→G 专用收敛例外保留。红灯实测定位 6 处真旁路后逐文件闭合：`bdd.md` §4.1 两条独立门禁回退（BDD/TLA+ 门禁失败先走完整普通失败链，S-fix 修复范围限于对应子流程资产、对侧不受影响）、`command-reference.md` `/wm review` 失败动作行（qualityLevel C/D 视为 V/G 失败 → 完整链，`reworkHints` 仅交 R 作定位线索）与 BDD 项目证据门 exit 1 行（扫掠发现同类旁路：先走完整链再按 R 结论由 S-fix 修复/补齐工件）、`hard-constraints.md` 门禁脚本退出码精确对应表 exit-1 两行（改为先走完整普通失败链再按 R 结论返工）。版本保持 42.2.1。

### 审查问题修复（gate-closure，2026-09-04，doc sync）

任务 1/3/4 引入的代码契约在本轮同步进 SSoT、references、活体文档、测试矩阵与验收记录（实现文件为事实源，文档编辑未改任何 `.ts` 校验逻辑；父链现已连续覆盖至合并前 tip 的父提交，完整身份见下表父链追加行——`689e51bd114831a209af92c99e82afea2e97f512` 起至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，逐 commit、40 字符完整 SHA、按时间顺序；本追加提交自身按规则不入链）：

- **ChangeScope + codegraph/opsx/archive strict 绑定**：SSoT §3.3.1 补 ChangeScope 段落（`change-scope.schema.json` / `codegraph-query.schema.json`、headRef=当前 HEAD、changedFiles 与实际 Git 变更集合精确一致、缺 scope exit 1 fail-closed）；SSoT §10.5 新增 §10.5.2（阶段 5-8 门禁顺序 codegraph/opsx strict → artifact gate 聚合 → opsx:archive → archive checker 后置门 → CHECKPOINT；GATE_JSON external summary；`scopeProvidedButFailed` 抑制误导文案；gate-logic externalChecks 透传已删除）；phase-5-coding「codegraph 修改前影响分析」节与 phase-6/7/8、hard-constraints #14/#38、command-reference「阶段 5-8 codegraph/opsx/archive 门禁 CLI」节、subagent-delegation G 模板与阶段 8 终检命令同步 `--scope=` 调用与 fail-closed 语义；examples（coding/stage5/stage8/test-execution/README）与 templates/coding.md 的阶段 5-8 门禁命令补齐 `--scope=.w-model/change-scope.json`。
- **artifact gate 聚合与 R3/run-log 语义**：SSoT 新增 §10D.8（R3 三种证明路径矩阵：standard 阶段级 role-dispatch+preventive-review / fix-emergency run-log identity window+preventive-review / opsx stage 9 份 R3+3 份 V；role-dispatch 空/全 invalid fail-closed、R3 只计 role=R+success 的 r3-* 三维度各 ≥1、r3Missing 明细、`--r3-enabled` no-op）；SSoT §10D.3 补 variant/blocker/fixedLocation/fixBasedOn 字段与坏行语义；data-models RunLogEntry 接口与动作字段表、subagent-delegation 检测脚本措辞（fix variant 可选向后兼容、emergency-fix 强制 variant+blocker、双 legacy 行经合并 legacy 谓词吸收为 LEGACY_VARIANT/LEGACY_UNSCOPED 非阻断）、hard-constraints #34 处置行、preventive-review `passed=false ⇒ findings ≥1` 同步至 schema 清单行与 #11 节。
- **pre-push 真实 push stdin 行为**：SSoT §8.2.4、README CI 策略、AGENTS 目录表、INSTALL §3.1、CONTRIBUTING 钩子节、troubleshooting 新增 1.7b 同步四字段 ref 行解析 / 多 ref 聚合 / 新分支 fork-point/merge-base 可证明基线 / delete-only 放行 / 空 stdin 回退 HEAD@{push} / 解析失败与基线不可建一律 fail-closed 全门禁；`docs/*.md` case 跨目录匹配按实测行为表述。
- **活体文档修正**：troubleshooting 1.7 重写为 docs-consistency 现逻辑（vitest 文件数/用例数是受控动态 facts + provenance 绑定实际提交，不再要求复制到 README/AGENTS/pre-push 文本）；CONTRIBUTING/user-guide/pre-push 注释的 self-test 样本数 260→262（实测 `npm run self-test` = 262/262）；新增测试文件登记进 `__tests__/README.md` 矩阵（artifact-gate-external / change-scope / check-codegraph-queries / check-openspec-archive / check-opsx-artifacts），docs-consistency/role-dispatch/run-log/schema-validation 行描述同步新契约；`l0-link-audit-logic.test.ts` 实包审计链接数 647→649（workflow.md 新增 2 条指向 command-reference/subagent-delegation 的引用链接，violations 仍为 0）。
- **本同步的完整普通失败链锚点**：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 在 8 份 phase references、5 份模板、全部 examples 与相关 references 中逐字保留（grep 核对无删除/改写），examples-contract 28/28 通过。
- 版本保持 42.2.1，不 bump；pre-push 17 项、CLI 37 项、schema 25 份统计口径不变。门禁实测与父链追加见下表及验收记录 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`。

### 审查 26 条处置索引（review-fixes，2026-09-03）

2026-09-03 对 `origin/main`（93f6f3a）→ `f0add11` 的 129 提交完成四独立只读审查，共 26 条发现（4 Important + 22 Minor），逐条处置、全部可追溯：4 Important 与 21 Minor 已修复；B7（`docs-consistency-logic.test.ts:2877-2931` 文本级契约测试脆性）裁定 wontfix——in-file 注释已声明为刻意防线（防 hook 语义漂移），保留现状、不归为缺陷。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-03-review-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 13 项处置索引（archival-fixes，2026-09-04）

2026-09-04 对 42.2.1 域 13 条留档项（最终独立审查 2 条 parked Minor P1/P2 + 账本 11 条延后 Minor D1-D11）逐条处置、全部可追溯：P1/P2 与 D1-D10 已修复；D11（台账收尾）即本段——父链追加行覆盖 `548e43a3553fc1109349e461458a288d0e48e383`..`09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` 全部 first-parent 提交（4 行，含战役前规格与计划提交）、前注与范围句刷新至合并前 tip 的父提交，本追加提交自身按规则不入链。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-04-archival-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 4 项处置索引（archival-fixes-2，2026-09-04）

2026-09-04 对 archival-fixes 最终审查留档的 4 条 Minor（A `ResolvedCliScope` violations 变体 `attemptedChangeId` 必填化 + 薄封装透传断言、B 归档日期前缀注释 0-99 精度、C 上节散文句如实覆盖表述、D L0 内联链接正则注释精度）逐条处置、全部可追溯：4 条全部修复；台账收尾即本段——父链追加行覆盖 `ccad270ca42706af54ab5911afef6e8c191368b8`..`7b52d4cd2559abac09abc1c3bb7a04619037ad29` 全部 first-parent 提交（3 行，含战役前计划提交），上文「审查问题修复（gate-closure）」与验收记录两处范围句终点顺延至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，本追加提交自身按规则不入链。处置计划见 `docs/superpowers/plans/2026-09-04-archival-fixes-2.md`；版本保持 42.2.1，不 bump。

### 本轮提交身份（最终 SHA 由外部命令核验）

以下为从 42.2.1 整改起点 `bc48824894ae076ff0e80d87cebd6c9de4437833` 至本次最终记录前已存在 HEAD 的完整父提交清单，来源为外部 Git 日志；历史/中间提交不冒充最终 HEAD，本 CHANGELOG 不自引用本次最终记录提交。

| 完整 SHA | 提交身份 |
|---|---|
| `bc48824894ae076ff0e80d87cebd6c9de4437833` | `release(42.2.1): audit remediation fixes` |
| `ea49736869e99d52efe4c66021f235ea621b800f` | `docs(changes): record 42.2.1 audit remediation acceptance` |
| `9c1801f9745c3aa95f7be55bd0bb109e173f47a3` | `docs(changes): record final prepush observation` |
| `5bb4dcc7938ec6dde91df503ff722bb013ff15ae` | `test(audit): add strict L0 link boundary coverage` |
| `0da7e05d88e735fb15481ba15cb51ceb336e3148` | `docs(examples): close independent stage rework chains` |
| `03f1b249044105f3f28165b4abd60d51943056a3` | `docs(bdd): require complete phase gate arguments` |
| `3c0cbb1644c5b5ea126f7a87498e1414b352e51c` | `docs(workflow): enforce complete rework checkpoints` |
| `f3bf1bbb8e4e6c8ae186540f313b0d48727cdb90` | `fix(audit): normalize L0 audit root paths` |
| `664b202936debb5a67e4611f79004c989048a811` | `test(boundaries): register L0 audit filesystem exception` |
| `4ea55b44a3f70e56ffae4579c0310fbb166d1317` | `docs(tests): document L0 audit I/O exception` |
| `ef14d03eb5d62a1d47029d35d07fca4305b191f9` | `docs(changes): record review round one remediation` |
| `4d79f04c5d38ba99681e352817b6317790aa6581` | `fix(security): document L0 audit filesystem paths` |
| `7502f6629bd96531d06f6dd430e8372e75f58cc2` | `docs(changes): finalize review round one acceptance` |
| `81aed005ae744f25b869e6b16744bd98e7a6560f` | `docs(changes): record review round one final gate` |
| `3fae86e127757027ed40c5e653ca0e0d47083444` | `docs(references): close phase failure routing` |
| `fa30fb982ad080c4ffc11685d9c9411592b20a32` | `fix(audit): fail closed on missing or escaped L0 paths` |
| `00f513e6343175fab2db5e3a5360c5b49afc4144` | `test(security): document escaped symlink fixtures` |
| `7319bb716851ceed085c0a13e355df22d8eb6dbb` | `docs(changes): record second review remediation` |
| `b1e364a81a1f877b3fab6e44dea5d46de0279160` | `docs(references): remove direct phase five fix bypass` |
| `46a2961937e58a24cc2dc6644dfc39573838c186` | `fix(audit): reject nested L0 directory links` |
| `778ec87fdd2892f1a8c7d68cf5055366c79175f2` | `feat(audit): expose L0 link boundary command` |
| `5ce123a5bd9e2dc2c7d355d7dc31a25a0758cd69` | `test(docs): scan all phase references for fix bypasses` |
| `b9958574bbd4be40da2c68da4f5b3beafb9a8ae0` | `fix(audit): reject top-level L0 directory links` |
| `43bd922d0db673c875b9fd72b1e407299742bd76` | `test(docs): include templates in bypass scan` |
| `e3396e5c47226c47e7257c3b0101d4f2a7c0789e` | `docs(changes): record review rounds three and four` |
| `2e3cee897c6ce883468b0d3e53fd1c6453f56c38` | `test(security): avoid unsafe bypass scan regex` |
| `b22191490b9c3d9d56bc47de2d9d33462fc308b5` | `docs(changes): record final audit verification scope` |
| `2e78319f8f9a0e25b327aae1509ec1004dcc8a9f` | `docs(changes): register prior audit commit identity` |
| `0eee1f48436b1643f14eb449452255e88f4b9418` | `docs(changes): record final audit gate` |
| `cc0a77e9f51771398f309e80754bc15d236b2b1d` | `docs(changes): register final gate commit identity` |
| `0974bc0c6b105d7c486fa30f79f2642a2c9ed7d1` | `docs(changes): register audit history before final gate` |
| `15762dde1b62e98d85fb1e5aa2b88ad893446d45` | `docs(changes): record final clean tree gate` |
| `e8f6a5b2c6108b1f31061284551492a79fbc62d1` | `docs(changes): finalize audit acceptance records` |
| `424b91fe57f2ca50dec4f373614c7f0430c2f5b6` | `test(docs): enforce complete ordinary failure routing` |
| `1aa684c7226ac1dafdd45b5f05e439e95fb24f1d` | `fix(audit): reject all L0 and L1 symlink boundaries` |
| `2a9930a37f91e12dcc3c09d18fb79bb5ab864f34` | `test(audit): close L0 CLI registration contract` |
| `08b80c10916178f8f83d8b5a520dfef290977d9d` | `docs(references): close phase failure fallback paths` |
| `88bd58374e17eb737493ae7f75074bd269c48c19` | `fix(audit): report unreadable L1 boundary entries` |
| `46db5fcfd702c3bb8837b0bbfab51ca51105ff4d` | `docs(references): route coding input failures through R` |
| `f8ffe0f7b88313af188cdb247586999d447af10f` | `fix(audit): classify L1 directory read failures` |
| `43e60df2fb6582ca8e533f1a7d1fa8781a7475c9` | `test(docs): close ordinary failure routing contract` |
| `75d211e8270c16cc8fcb76b4ada70910e6accc4b` | `fix(audit): validate complete link URI encoding` |
| `347f43e796fed39570164b9282e6534afdbd1e1b` | `docs(workflow): enforce complete ordinary failure routing` |
| `c6500ed47e36c8d87fc687875af9213ff95bd7ca` | `fix(audit): validate placeholder URI encoding` |
| `d4e0e6788ef362a07edd4be7751893ede0021f07` | `fix(docs): close ordinary failure routing contracts` |
| `b030f8087567355147391f4b10203e57d3f5384a` | `fix(audit): close L0 URI and dependency boundaries` |
| `b023dc798916169840d83b2e5411f028d4eb3192` | `fix(test): keep examples contract security-clean` |
| `5f3311f7a889e6a1dc4d3456adb73d0b591a510f` | `fix(deps): patch fast-uri audit vulnerability` |
| `4562e44b71b3544dfcfac4f7d19a966e8e15c810` | `docs(changes): finalize Task 8 acceptance evidence` |
| `60694d336a27c52926eec2d1dc2dcfbd3c6441ae` | `fix(audit): reject Windows drive-letter link paths` |
| `56b7d83d4f3d98497ea00d57902afc4533cbda9c` | `style(references): remove trailing whitespace` |
| `982d051d7804dab1ecc9ef13e7a65cbf37ce04a6` | `test(audit): preserve valid external URI scope` |
| `c74d38ecb4faea1efe20d0b1a47919c16d1c154d` | `test(audit): scan all guidance contracts` |
| `1963406c3ae56ed0e796ffc517f9555fc4b495c2` | `docs(contract): close all ordinary failure routes` |
| `41ebcb6485c7d5aea78745fe853735a6dd18c702` | `test(audit): verify l0 cli error routing` |
| `0e9f1ce3f21f84b73be40017321768a5e5232666` | `test(security): document controlled audit fixtures` |
| `bee1a634d62ac5fce7998cf17ff6c25daa3cc708` | `docs(changes): close task8 audit evidence` |
| `9567415cb861b0fa461540317a8df2b956360827` | `style(test): format workflow contract scanner` |
| `6c6ee22d4e36c93f0a8206449409faee42996f68` | `docs(changes): record final task8 gate` |
| `d997b586afe381c2f8ffcb8edcbcf9d9741fb644` | `docs(changes): finalize task8 evidence` |
| `0b2a62d3be2077b255be3d23204752bb78f1287e` | `docs(changes): record final prepush verification` |
| `a6c805ba51ca7cefc5806f0a779fdbd9b86f4281` | `fix(docs): close ordinary failure routing contract` |
| `751c1e0e172bd49b281e0d5c5919a139440c4e2d` | `test(docs): scan multiline test result tokens` |
| `6ac25be195d3c841360f6ea0ce0c3c7a1399c377` | `test(audit): cover internal non-markdown l0 links` |
| `d1c61732184af15ff563c0d923a316d65caa2397` | `test(docs): harden multiline test command extraction` |
| `ebcc2a678362775675972e65a030fa37ccefceec` | `docs(changes): record Task 8 final repair round` |
| `54cdf07e1d178062af02d7146661349231658a10` | `docs(changes): synchronize final parent evidence ledger` |
| `7c70e70c0e1f64f22ca6030844ebd7ce524da6ab` | `style(test): align guidance scanner with prepush format` |
| `e9062857043ce2e50e2d2ff99b31b0d585b0a397` | `docs(changes): update final verification ledger` |
| `f832febd5f41a831a4e4cce7e9562f1407b31722` | `docs(changes): finalize Task 8 verification evidence` |
| `1d148a8a296e159e72f662e2a3b8eaeaa32fa32f` | `docs(changes): record final prepush result` |
| `c24b2442150f65331e98f6ada1862e4d8bfdb968` | `docs(changes): refresh complete final parent ledger` |
| `6ddb1978ffc51d790479c25fa9ccb8b9dfb4e81d` | `test(audit): scan whole-row failure routes with chain markers` |
| `f63989d12bb7bfe7813b93a6706c3438f82fa69f` | `fix(docs): route BDD/TLA+ gate failures through the complete chain` |
| `07832d7b8596ecc93ef49b290ceb4415d2e4dbdf` | `fix(docs): close /wm review C/D and BDD-gate exit-1 routing bypasses` |
| `7f994e3d1191b671f371e713034ef26b22148b0a` | `fix(docs): route exit-code table rows 363/366 through the full chain` |
| `44c057a3e342234e9e9faa0cad4744b161659305` | `fix(docs): remove End Patch residue and restore UAT table row` |
| `afd99c611b15b5ceb6cb68dac650a7b7fe87cc64` | `docs(changes): record scanner closure round in 42.2.1 changelog` |
| `fbfd3363d6961b76dfa8029712e2fc36c5544c73` | `docs(changes): record scanner closure round acceptance` |
| `051c688ecb2ddd361ce19bce560664f456355da1` | `style(test): format whole-row failure scanner` |
| `c4e3359176a32e2c623f140c48a352349e8b635c` | `docs(changes): refresh complete final parent ledger` |
| `ac91849b7aa27bb605c3fb2f4ac235ac9645129b` | `docs(changelog): expand 2 short SHAs and append c4e3359 to 42.2.1 parent ledger` |
| `97b91badfc7fe945ab830b5ea4a594d3c25db877` | `docs(changes): expand short SHAs in acceptance records and append ac91849 to 42.2.1 parent ledger` |
| `965095e049bf0688e1b343c5adcdd70407642228` | `docs(changes): annotate verbatim subject citations in parent ledgers` |
| `689e51bd114831a209af92c99e82afea2e97f512` | `feat(gate): add change-scope and codegraph-query JSON Schemas with inventory sync` |
| `ac90a78b800e5c163944900d7473136d863136b5` | `feat(gate): bind codegraph/opsx/archive checkers to ChangeScope with strict coverage` |
| `a0f86bbb4c5001f56a3b04143b13834f800b0922` | `refactor(gate): drop dead externalChecks passthrough; aggregate strict codegraph/opsx into artifact gate` |
| `5197b21cb97002def958de0f33591ba2f1c73a73` | `fix(gate): suppress misleading no-scope reasons when ChangeScope binding fails` |
| `ed55ff5b80cc81775c82349648dca81cc17a96bf` | `fix(gate): count R3 by success r3-* dimensions and fail closed on empty role logs` |
| `ce72badd4373cf99ed236bea816ad3cef90076d6` | `fix(run-log): fail closed on empty and malformed input; block action-role mismatch; align fix variant and preventive schemas` |
| `36c66581b632571e9bb728edcf3f911776aec280` | `fix(run-log): absorb double-legacy emergency-fix rows via merged legacy predicates` |
| `6adc3215815cff0d355c13a15a6e00278e393812` | `fix(hooks): consume pre-push stdin refs per-line with fail-closed scope` |
| `13b942f1c36ae9e92c6d9f8ea22d4854340e117f` | `docs(sot): document ChangeScope gate binding and stage 5-8 aggregation` |
| `c691023e344864e7262b6776b974fec1f56cc4bc` | `docs(references): sync scope and run-log fail-closed semantics across guidance` |
| `3da9efa8a2ac4b889af8974029d902743eacc126` | `docs(changes): record gate-closure doc sync in 42.2.1 changelog and acceptance` |
| `0ee78ea23b21325d186fed0b38be2b554c3d1dfc` | `docs(superpowers): add audit-gate-closure fix plan` |
| `1a032bfab1ae0f224b903024dd3624dfdbfb9733` | `docs(references): state precise R3 dimension counting in summary tables` |
| `827ebceeb4497a69716a42dd540020b3ae8398c2` | `docs(references): reconcile fix-variant wording and template gate qualifier` |
| `1a0ed09c460bd42ad1cd964f6b11e35dc1725958` | `fix(gate): report R3 dimension gaps instead of missing R role records` |
| `25e5bf01a976e234e225bc2bb0397cf5071e2433` | `fix(gate): validate change id in thin scope wrapper` |
| `e425642d019d3b2d8d55a4471a867eb81d9661fe` | `refactor(gate): share scope-resolution helper across checkers` |
| `f2570709982f458beb2d9bfb4a8e1754d22deb2d` | `docs(schema): align run-log descriptions with enforced pairing` |
| `f828b2776a486d674f44d66726d1ab6fa770ed44` | `fix(hooks): skip transient audit network errors and baseline new branches remotely` |
| `f76dc43fc9571b85964cdefa68bd51df4ccd0e0c` | `docs(references): tighten fix-review wording in violation checks` |
| `d17594feb65c9b994a0e637d752355822e1abc84` | `docs(changes): make anchor-grep tally reproducible and date the 647 measurement` |
| `8a7b503fe6077e36b97d02b24f1a1b3e04130759` | `test(gate): sync direct-call manifest line after change-scope case addition` |
| `0644a0b740325a2e7eedf9860cfd700ede9b7a99` | `style(test): prettier formatting for hook test additions` |
| `f0add116c98b8f4ab109a01aa6f1543312e19bdc` | `fix(hooks): list merge diffs in remote-tracking enumeration with -m` |
| `6780e109010835df967159ca52796a40f8970730` | `docs(superpowers): add review-fixes design spec (26 findings, 5 slices)` |
| `a2cab37592f2e622f18eb4a824ea881eb9bd7304` | `docs(superpowers): add review-fixes implementation plan (6 tasks, SDD)` |
| `de7152224ff2eab6c7be81807b023f05b1692b50` | `fix(scripts): harden change-scope binding (quotePath, shell whitelist, changeId prefix, dot-segment, archive date, phase filenames, external summary)` |
| `7076692f9f9aaed021e1a67b8bd155a7658406cf` | `fix(hooks): reject leading-dash remote names in pre-push enumeration (fail-closed)` |
| `7cd5fcf8e2807db03383c366e010fb931e232afc` | `fix(scripts): parse reference-style links in L0 audit; consolidate pinned baselines; anchor hook failure-source assertion` |
| `ae73586407c344e1aa2736696414a8808b6f9658` | `docs: require --phase/--scope in gate command examples; document remote-tracking new-branch baseline path` |
| `dabbe6bc4f3fd5fa267c7f194121844712c20e57` | `docs: reconcile gate/opsx/run-log/NFR/audit/exit-2-count wording with implementations` |
| `548e43a3553fc1109349e461458a288d0e48e383` | `docs(changes): restore parent-chain continuity (insert 965095e0, append 16 rows through f0add11)` |
| `558075dacc76756ba9909263723950b0f9f70aeb` | `docs(superpowers): add archival-fixes design spec (13 filed items, 3 slices)` |
| `73b3f600f282bc76bb3a6142f12a844b661aeb86` | `docs(superpowers): add archival-fixes implementation plan (3 tasks, SDD)` |
| `1c861082066c710847dcd5fac0cd28e8d0f83eaa` | `fix(scripts): close archival items (summary shape, CLI exit-2 coverage, quotePath in docs-consistency, comment precision)` |
| `09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` | `docs: close archival docs items (GATE_JSON provided, l0 fixture form, AGENTS pretty-format, data-models scope note, run-log punctuation, user-guide audit wording, changelog typo)` |
| `ccad270ca42706af54ab5911afef6e8c191368b8` | `docs(superpowers): add archival-fixes-2 plan (4 filed minors, single task)` |
| `34aad9663f5e5cb5c99a8e315e000ad8edc5fbe6` | `fix(scripts): require attemptedChangeId on scope violations; sharpen two comments` |
| `7b52d4cd2559abac09abc1c3bb7a04619037ad29` | `docs(changes): correct archival index prose to actual ledger coverage` |

注：父链表第二格为提交 subject 逐字引用；subject 内形如短 SHA 的文本（如若干 docs 提交 subject 内嵌的先前提交 SHA）属 commit message 原文，非身份引用，不展开、不补全。

最终记录提交不在 CHANGELOG 的本表中自引用；最终 SHA 与最终 prepush 由外部 `git rev-parse HEAD` / `git status --short --branch` 和 Git Bash 命令核验，`e8f6a5b2c6108b1f31061284551492a79fbc62d1` 保留为历史中间最终记录。

## [42.2.0] - 2026-09-01

### 优化（易用性清债：过期重定向 stub 移除 + SKILL.md 收敛）

- **移除 19 个 42.0.0 wave 合并遗留重定向 stub**（原承诺 42.1.0 移除，因证据支撑树集成顺延至本版）：TLA+ 5 文件 → tla-plus.md、BDD 4 文件 → bdd.md、anti-patterns → hard-constraints.md、dispatch-matrix → subagent-delegation.md、subagent-persona-matrix → agent-personas.md、conventions 三件套 → conventions.md、coding-quality 三件套 → coding-quality.md、definition-of-done → quick-self-check.md。活体引用 13 处先行重链（tools/README ×2、examples ×3、schemas ×8）；references 59 → 40 个 .md，SKILL.md 与 README 资源计数同步。
- **SKILL.md 收敛 106 → 99 非空行**（批次 3 遗留目标 <100 达成）：快速自检节并入工作流尾注、执行工作流 12 步合并为 10 步、触发决策前两行合并、双 CHECKPOINT 引用合并、成熟度指针并入适配节——全部指针与 eval 断言锚点保留，`npm run eval` 25/25。
- 门禁闭合（真实退出码）：eval 25/25、self-test 262/262、docs-consistency、samples-coverage 282 fixtures / unregistered=0、prepush 17 项全绿。

## [42.1.1] - 2026-09-01

### 修复（42.1.0 deferred 项修正收口）

- **run-sync ↔ dependency-boundaries 全量并行竞态**：`collectTypeScriptFiles` 跳过 `.d2-` 瞬态 fixture（dependency-boundaries 并行测试写入的 `scripts/logic/.d2-boundary-fixture-<pid>.ts` 生命周期窗口曾触发 ENOENT），新增回归测试；run-sync × dependency-boundaries 组合 5 连跑全绿（`e20e579` + `0d03b4a`）。
- **security baseline v2 全量对账**：`--regenerate` 消除 49 提交累计卫生债——删除 116 条孤儿条目并修正 line 漂移，411 → 295 条（`7e97baa`）。
- **活体文档/风格微修**：samples/README graph 行 R1-R15、conventions §2.1 evidenceAnchor 复用说明、ingestion-chunk A-chunk L42 代码来源示例、SSoT §10A 4A.1b 表行对齐、subagent-delegation §3.1 触发表补 evidence-anchored-tree 行、graph-logic R15 块 `test()`→`it()` 风格统一（`93f6f3a`）。

## [42.1.0] - 2026-08-31

### 新增（证据支撑树方法论集成）

- **产出期证据锚点（evidenceAnchor）**：图谱节点可选声明结论事实锚点（由 A 子代理 ingestion 时声明、S 规格 §4.2 只读同步、V 评审可核验、G 门禁 R15 格式校验）；复用现有 EVIDENCE_PATTERN 格式，向后兼容存量 graph.json（未声明不阻断）。graph.schema.json / graph-logic.ts / conventions.md / requirement-spec.md 同步。
- **方法论参照文档**：新增 `references/evidence-anchored-tree.md`（证据支撑树 × W 模型映射 + 唯一增量 + 明确拒绝照搬点）。references 58→59。
- **自我纳入机制**：A 子代理 ingestion 指引（ingestion-chunk/cross）注明 evidenceAnchor 可选声明时机；SSoT §4A.1b / §7.7 / §10A 同步；self-test 基线 260→262。
- 设计/SSoT 变更草案与详细设计见 `docs/superpowers/specs/2026-08-31-evidence-anchored-tree-*.md`，实施计划见 `docs/superpowers/plans/2026-08-31-evidence-anchored-tree-integration.md`。

## [42.0.0] - 2026-08-30

### 优化（三维度优化批次 3：易用性大重构 + 终值评估）——版本 42.0.0 发布

三维度优化收官：批次 1（有效性，评估闭环重建）与批次 2（可靠性，红灯清零）后，本批次聚焦**易用性**——技能资产大重构（w-model-dev/），并以同一固定规格重新执行完整 8 阶段 e2e 终值评估对照基线。

**易用性重构（wave-1 + wave-2 合并重链）**

- **去重合并**：TLA+ 指南 5 文件 → `tla-plus.md` 单文件；BDD 指南 4 文件 → `bdd.md` 单文件；anti-patterns 48 条并入 `hard-constraints.md`；角色细则 4 文件 → 2 文件；`conventions.md`（术语表 + 格式 + 目录约定）+ `coding-quality.md` + `quick-self-check.md`（+ DoD）三合一。`references/` 收敛为 58 个 .md，重链 19 文件共 384+ 处交叉引用（跳转 stub 引导旧路径）。
- **SKILL.md 整文件重写**：由约 300 行收敛为 **106 非空行**——「三问」触发决策、14 条硬红线压缩表、编排者-子代理边界表、8 步执行工作流、命令速查、阶段路由表与新「门禁契约与资源清单」节（操作行为指针 / 资源计数 / 状态写锁协议 / 行为门禁 flag / 证据与审计 7 条款）。
- **新增 `references/quickstart.md`**：5 分钟上手（交付层 L0/L1、触发决策、首个任务路径）。
- 门禁契约与评估锚点同步：docs-consistency 13 项契约闭合（单提交内不留隔夜红灯）；`eval/mappings.json` 4 处锚点随文件改名更新（`npm run eval` 保持 25/25）。

**终值评估（Task 3.6，新 SKILL.md 引擎）**

- 同一 todo-rest-demo SPEC（与基线逐字共用）下完整 8 阶段从零重建：**8 阶段 Verifier 全 A**（0.9295 / 0.8770 / 0.886 / 0.894 / 0.8757 / 0.8942 / 0.9028 / 0.9057）；四级测试 **74/74**（UT 35 + IT 17 + ST 11 + UAT 11，coverage 97.56 / 98.00 / 95.45 / 97.67）。
- 易用性收益可量化：**分派 ≈52 vs 基线 ≈74（↓约 30%）**；返工 8 项（1 完整 R 循环 + 7 R3-Required S-fix；基线 R 循环 3）；CHECKPOINT 18（判据代行）。
- **解决基线常驻红灯 D9**：SSoT §10.5.1 阶段 5-8 Cucumber 执行证据 × CON-001 零依赖 × 成熟度 L2 的不可满足，由 S-coding 自建真实 cucumber 报告通道（`.w-model/bdd/generate-bdd-report.ts`，真实 HTTP 往返）消除——阶段 5-8 artifact-gate 全部零常驻红灯。
- 终结偏离登记：阶段 1 R 循环根因为新指南对 TLA↔BDD 同步契约只有「名称完全一致」而无工作示例（基线 D5① 同型未修，本报告登记为 skill-side upstreamDefect，收尾留档）；验收 UAT-002 设计对冻结规格过度收紧（仅空白 title，O 裁定冻结规格权威，D7 谱系）；超限体大客户端 ECONNRESET（R3 security Required 在最终验收门升格，`src/server.ts` 拒绝路径排空 + `Connection: close` 修复，≥1MB 用例防回潮）。
- 评估记录：`eval/w-model-dev-results.tsv` 新增 dry_run（25/25 baseline）与 e2e 终值共 2 行；终值记录 `eval/e2e/2026-08-28-final.md`；`eval/README.md` §4 更新为「评估已恢复（2026-08-28 起）」。

> 本版本累积批次 1（评估闭环：`npm run eval` 25/25 + e2e 基线）与批次 2（可靠性红灯清零：run-sync 清单补登 + 负载敏感探针加固）的变更；完整三维度优化设计与实施计划见 `docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md` 与 `docs/superpowers/plans/2026-08-28-w-model-dev-3dim-optimization.md`。

## [41.19.0] - 2026-08-19

### 修复（D8 run-log lifecycle checker）

- `check-run-log` phase 8 以 `(phase, round, reportId, targetKind, basedOnReport)` 建立 lifecycle segment，严格区分 rootcause V/G 与 implementation V/G，fix 只接受 exact `basedOnReport`，R3/R8 不再跨 report、targetKind 或 phase-wide 首索引误关联。
- 新增 `pending-pre-approval`、`open-approved-lifecycle` 与 `LEGACY_UNSCOPED`/deferred diagnostics；保留真实未完成 implementation lifecycle 的 exit 1，兼容缺身份历史行且不修改 raw JSONL。`--json` 与人类输出均携带 diagnostics，schema/SSoT/运行日志参考同步。
- D8 TDD 新增 8 项 identity、pending/open、R3/R8、legacy diagnostics 与 raw JSONL immutability 回归；focused run-log suite 实测 49/49 通过。

### 修复（R10 persona 契约）

- RootCauseReport R10 采用 canonical-first：接受规范 `testing-reality-checker`，为兼容已有合法归档保留 `reality-checker` legacy fallback；同 artifact 的 canonical+legacy 不虚增 persona 语义，跨 artifact 或异常重复/冲突 fail-closed。同步 rootcause schema、根因定位指南、Verifier 规范、SSoT 与命令参考；本条历史实现说明不把当时的 17 tests / 4 RED 记录表述为已覆盖两个专用 duplicate 分支。保持 R1-R9、退出码 0/1/2 及 `ROOTCAUSE_JSON` / `ERROR_JSON` 合同不变。
- R10 S-fix 补测：新增两个 canonical duplicate 与两个 legacy duplicate 的精确 reason/count 断言，并补充同 artifact canonical 高、legacy 低的优先级用例；当前 root-cause focused 为 20/20，真实全量 Vitest 为 55 files / 942 tests / 942 passed / 0 failed。I1 deterministic metrics probe（显式 projectDir + `--phase=0` + 固定 probe cwd）与 I2 七来源 source×clause mutation 门禁同步完成。
- R10 第二轮 S-fix 澄清：未改写上述历史 17/4、2/2 RED 或 20/20 GREEN 事实；新增语义关系 marker 的 fail-closed contract、Exit2ProbeResult 完整字段/rule 合同、metrics args/cwd identity 规范化及真实七来源 mutation 回归。当前工作区全量 Vitest 实测为 55 files / 954 tests / 954 passed / 0 failed，docs-consistency 的历史 run-log 中间态 exit 1 仍按生命周期事实保留。

### 修复（审计整改批次 B）

- **samples 覆盖门 JSON 退出码对齐**：`check-samples-coverage.ts --json` 复用同一 `exitCode` 输出 JSON 并设置 `process.exitCode`，违规时真实 shell status 与 JSON `exitCode` 均为 1，成功时均为 0；新增真实子进程回归断言。
- **BDD 项目行为证据显式门**：`check-bdd-model.ts` 新增 phase 1-4 的 `--require-tla-equivalence` 与 phase 5-8 的 `--require-cucumber-report`；所需工件缺失均作为 D4/D5 violation / exit 1，错误 phase 组合为 exit 2，未带 flag 保持 fixture 兼容跳过。第 1/5 轮审查修复将 CLI 收紧为参数 allowlist：`=true`、重复、近似拼写和未知 `--*` 统一 `ARG_INVALID` / exit 2，不得静默降级。required Cucumber 报告还必须是 `{ elements: [...] }` 且至少有非空 name scenario 的 `passed` step；failed 仅作诊断，skipped/pending/undefined/未知 status 与匿名 element 不构成执行证据且作为 D5 / exit 1 拒绝。SKILL/指南/命令参考与 pre-push 注释明确区分：pre-push 只直接运行技能包 BDD fixture 回归，TLA、TLA↔BDD 同步和真实项目工件由项目阶段门按成熟度执行。
- **同步子进程边界**：`runSync` 为 B4 受控调用提供 15 秒进程级 timeout、固定 `SIGKILL`、固定 UTF-8 编码和 64 MiB 输出缓冲；非有限/非正 timeout 或 maxBuffer 均回退默认值。artifact gate 的 TLA+/BDD 校验及 gate-report、metrics-report、wm-status 测试调用均迁移至 helper。全目录同步调用已通过 TypeScript AST 与集中清单审计：解析 `node:child_process` 的直接、别名、namespace、解构和静态属性绑定；每处调用均声明理由及现有 timeout 或后续整改状态，动态计算属性访问将阻断审计，未在 B4 范围内的无 timeout 调用不再被默默放过。

### 文档对齐（审计整改批次 C）

- **C3 第 2/5 轮 hooksPath 可执行恢复流程**：README、INSTALL、CONTRIBUTING 分别提供 Bash/PowerShell 的 `git config --local --get` 备份、退出码 1 的原先未设值分支、`git config --local --unset` 撤销和基于 `.git/hooksPath.previous` 的回写；备份文件只保存在本地 `.git/`、不提交，并提示权限与空值注意。文档测试提取统一契约 helper，使用旧 TL;DR、`.agent` 卸载、缺 Bash 边界和缺失 hooksPath 流程的真实文本 fixture 断言失败，同时要求当前文档通过。
- **C3 入口契约加固**：README TL;DR 改为两个独立锚点选择，不再混合 Skill 复制与仓库验证命令；README、INSTALL、CONTRIBUTING 补充 `core.hooksPath` 旧值保存、`git config --unset core.hooksPath` 撤销和按需回写命令；INSTALL 卸载命令统一使用 Agent-specific placeholder，并要求替换安装时目标后再执行破坏性删除；文档测试增加按路径的局部负例和标题顺序、TL;DR、恢复命令、卸载、Bash 边界语义断言。
- **仓库验证与 Skill 安装入口拆分**：README 首屏新增「验证仓库」与「安装 Skill」两个独立入口。仓库验证固定为 canonical GitHub URL、仓库根目录、Node.js ≥20、Git、npm registry/网络、`npm install` → `npm run self-test` → `npm run doctor`；PowerShell 5.1 使用逐行命令，`self-test` / `doctor` 不要求 Git Bash。Skill 安装改为复制 `w-model-dev/` 到 Agent-specific skills 目录，不将 `.agent` 作为通用路径，也不伪造无法验证的 Agent canonical URL。
- **平台与 Hook 边界披露**：文档明确 `postinstall` 运行 `scripts/setup-hooks.cjs` 并设置本地 `core.hooksPath=.githooks`，该副作用不是 Skill 激活必需；Bash 仅用于 `pre-push` 与平台依赖检查；`platform-deps:check` 只检查、`platform-deps:install` 当前 fail-closed 并指引人工 `npm install`；Windows/WSL 不混用同一 checkout 的 `node_modules`。
- **采用与贡献导航**：adoption Day 0 先验证仓库再安装 Skill；INSTALL、AGENTS、CONTRIBUTING 分别引用两个入口，并保留真实测试计数，不新增样本或改变实现逻辑。文档入口的语义由按路径契约测试逐项守护。
- **可执行 Persona Verifier 样例**：将四个 Persona 的失效内嵌 JSON 迁为 `samples/verifier/persona-*.json` 可执行 fixture；每个 fixture 使用当前 Schema 的 meta、子标准、方差与可追溯 evidence，并由 CLI、self-test、samples 覆盖门和 Vitest 逐项验证。`agent-personas.md` 保留字段约束、fixture 链接与校验命令，明确真实评审须基于目标证据重建输出，不能复制固定评分或证据。self-test 基线 256→260，Vitest 实测 52 files / 849→853 tests。
- **SSoT 外部 Agent 边界**：重画 §3.1 架构图，明确技能包仅交付 Markdown 资产、Schema 与确定性 gate scripts；宿主 Agent / 外部 LLM 负责推理、子代理调度和 LLM-as-Verifier；TLA+ TLC、CodeGraph、OpenSpec 为可选外部工具，不属于技能包交付物。同步三项 CLI JSDoc：默认和 `--json` 均先尝试写 gate log，写入失败以 `gateLogWriteError` 报告且不改变主 gate 结果，并由静态测试守护。

### 新增（审计整改批次 D）

- **D7A 可追溯证据包**：`wm-export-evidence` 默认要求 `.w-model/evidence-provenance.json` 证明已通过的运行，并将 run ID、40 位 commit SHA、artifact ID、三类源证据计数/哈希和导出文件清单 content hash 写入严格 manifest。`--verify` 除了路径、Schema 与文件哈希外，重新执行脱敏规范化，拒绝手工同步哈希后重新引入的绝对路径或敏感值。敏感字段识别扩展为 `authorization`、`credential`、`access_token`、`private_key`，忽略大小写及连字符/下划线差异，并覆盖 JSON、JSONL 与 Markdown；真实 CLI 回归覆盖 provenance 缺失/未验证拒绝、合格导出/验证及未脱敏包拒绝。
- **D1 Schema loader 文档路径对齐**：将 `data-models.md`、`docs/INSTALL.md` 与 `docs/user-guide.md` 的 Schema loader 引用统一指向 `w-model-dev/scripts/infrastructure/schema-loader.ts`，并新增文档回归断言防止迁移后的旧 `scripts/logic/` 路径回归；不改变生产逻辑、Schema、hook、package、baseline 或计划/spec。
- **D7C source-bound evidence verification 文档与动态计数**：本条目对应单提交 `d659e82^..d659e82`；仓库外受控 coverage/provenance artifact 绑定测量 HEAD `d659e8239f47c90499066f87ba64731a114cca1a`，相对 artifact ID `vitest/results.json`、SHA-256 `9b4cd0412e95dfc1ec74a19746ebc9c6b4de7955bac224ac9476fe4be0b03af6`、run ID `8f909dd7117df0ac`，实测 23 schemas / 36 CLI scripts / 35 exit-2 scripts / 55 test files / 910 tests / 910 passed / 0 failed / success=true；self-test 为 260/260，samples coverage 为 280 fixtures、242 个文件引用、15 个目录引用、0 未登记。登记 `evidence-provenance.schema.json`、`wm-verify-evidence-source.ts` 与 source-bound/package-only 边界，明确受控本机 provenance 不是密码学签名或第三方不可抵赖证明；D7C 文档与动态门测试保留旧计数负例。**该条目是 historical evidence：measurement commit=d659e8239f47c90499066f87ba64731a114cca1a，不是后续 reviewed/final HEAD 的验收证据。**
- **D8 C1/M1 final-head evidence boundary**：保留 D7C 的历史数值与 artifact/hash/runId 事实，不将其升级为当前验收；最终验证报告必须同时记录 `reviewedHead`、`measurementCommit`、artifact ID/SHA-256、runId 和 provenance，并仅在 `measurementCommit == reviewedHead` 时标记 final-head verification passed。若两者不同，状态只能是 `historical evidence — not final HEAD verification`。
- **D8 I2 natural-exit contract**：D2 约束收窄为 `logic/` 与 `lib/` 不直接退出、gate-report callers 设置 `process.exitCode` 后自然返回；`self-test`、`security-scan`、`wm-status`、`metrics-report`、`ensure-codegraph-opsx` 等 process-level runners 保留直接退出并登记理由，不作无关重构；新增 gate-report caller 或 direct exit 时须同步契约测试与命令参考。
- **D6 同步 D5A 后真实 Vitest 计数**：以当前 HEAD 受控 coverage/provenance artifact 实测的 54 test files / 895 tests / 895 passed / 0 failed / success=true 为唯一来源，同步活体文档、pre-push 第 12 项描述性计数与 docs-consistency fixture；不改变生产逻辑、门禁控制流或 evidence export。
- **D3 可验证运行时审计证据导出**：新增 `wm:export-evidence`，仅导出 `.w-model` 白名单目录与 run-log 的常规文本记录；JSON/JSONL 递归脱敏 `token`、`secret`、`password`、`apiKey` 字段，使用临时目录+原子 rename 发布严格 Schema 的 SHA-256 manifest。`--verify` 会重新执行 manifest Schema、路径安全、文件存在性与哈希校验；输出目录冲突、符号链接/路径逃逸、二进制或未知扩展均 fail-closed，CLI 保持真实 exit 0/1/2 与 `EVIDENCE_EXPORT_JSON` 摘要。
- **D4 动态元数据与本地证据治理**：docs-consistency 保持顶层 `violations` 兼容字段，并按 `staticViolations` / `dynamicViolations` 分组，输出真实 `dynamicMeasurements`。以 coverage JSON 的 `testResults.length` / `numTotalTests` 为事实源同步活体计数；登记 `evidence-manifest` Schema 与 `wm-export-evidence` CLI；README、Agent、安装、贡献、Skill 和命令参考明确 `coverage/` / `.zcode/` / `.w-model/` 是 Git 忽略的本地生成物，审计交付须显式导出脱敏 SHA-256 manifest 包，且与受控 `docs/changes/archive/` 区分。
- **D7B source-bound provenance**：新增 `evidence-provenance` Schema 与 `wm-verify-evidence-source` producer+verify CLI。命令校验真实 Git HEAD、run-log、passed gate-log、signature-chain、source file 清单与 source bundle SHA-256 后原子写入 `.w-model/evidence-provenance.json`；`wm-export-evidence --verify` 无 `--source-project` 明确返回 `package-only`，传入 source project 才返回 `source-bound` 并重验当前源。同步注册表、命令参考、数据模型、测试 fixture 与 55 files / 905 tests 的成功 artifact 计数。

### 修复（审计整改批次 A）

- **状态写并发协议**：`wm-write` 改为 `<target>.lock` 持久目录与可转移 owner 的跨进程锁；锁内执行 mtime、毫秒+UUID 备份、tmp+rename、回读与原子恢复。CLI 增加 `--lock-timeout` 与显式 `--recover-stale-lock`；默认对陈旧锁 fail-closed（`STALE_LOCK` / exit 1），同时保留直接 `writeStateJson` 调用的兼容性隐式恢复。显式恢复仅授权 TTL 已过且 owner/operator PID 已退出的锁或 transition，不能夺取活跃 writer；逻辑层 barrier 与真实 CLI 回归测试覆盖该排他性边界。
- **状态 Schema 写时校验**：`wm-write` 在锁临界区内通过唯一注册表验证 project/rtm/budget/maturity JSON 与 run-log JSONL；未注册 `.w-model` 目标默认以 `UNREGISTERED_TARGET` 拒绝，`--allow-untyped` 只允许该类目标且在 JSON 摘要标识 `untyped:true`，从不绕过注册目标的 `SCHEMA_INVALID` 拒绝。真实子进程回归覆盖两种 exit 1 协议、JSONL 安全行号与无备份/tmp 残留。
- **显式平台修复**：pre-push 不再自动 `npm install`，缺少 `node_modules` 即 exit 1；仅调用 `ensure-platform-deps.sh --check`，默认/`--check` 不下载、不执行 `npm pack`、不解包也不覆盖 `node_modules`。`npm run platform-deps:check` 与 `npm run platform-deps:install` 是显式入口，后者目前 fail-closed 并指引人工 `npm install`。
- **文档契约**：SSoT、skill、状态/命令参考、README、安装/贡献/Agent 指南和 docs-consistency 断言同步上述状态锁与平台依赖边界。
- **Vitest 真实计数同步**：以覆盖率启用的 Vitest JSON `testResults.length` / `numTotalTests` 实测为唯一来源，将活体文档与 pre-push 第 12 项描述性注释统一为 **52 test files / 849 tests**；docs-consistency CLI fixture 保留并断言这两个 JSON 字段，仍通过 `WM_VITEST_COUNT_FILE` 注入真实 CLI。
- **Vitest 计数证据 fail-closed**：无 `WM_VITEST_COUNT_FILE` 时强制采集；Vitest 启动、JSON 或文本解析失败均产生 `vitest-tests` 违规并 exit 1，保留 A8 JSON 注入快路径。SSoT 纳入内链扫描，并修复 CHANGELOG 与 decision-log 三处相对链接。
- **Schema 活体库存同步**：将实际 21 份 Schema 的声明同步至 SSoT、SKILL、anti-patterns 与 user-guide；docs-consistency 对这些权威声明逐一校验实测 Schema 数，缺失或漂移产生 `schema-list` 违规。
- **Prettier 格式阻断修复**：按仓库 `config/prettier.config.cjs` 格式化 `w-model-dev/scripts/logic/docs-consistency-logic.ts`，消除 pre-push 第 16 项格式检查阻断；仅调整尾随逗号与换行，不改变运行时逻辑。

### 修复（核查报告 2026-08-19 六项问题）

- **P1-1 文档数字漂移**：CONTRIBUTING 门禁表 vitest 计数 40/623 → 47/723（与同文件 :214 自相矛盾修复）；docs/INSTALL.md :83/:248 同类漂移一并修正（复核补充）；PR 模板「14 项」→「17 项」；docs-consistency 新增 `vitestExtraDocs` / `prTemplate` 可选输入（checkVitestTestCount 参数化 + checkPrTemplatePrePushCount），堵住 REQUIRED_PATHS 未覆盖 CONTRIBUTING/INSTALL/PR 模板的盲区；CONTRIBUTING 版本机制「五处」→「六处」同步
- **P1-2 typecheck 门禁**：package.json 新增 `typecheck` script；pre-push 第 17 项 `npx tsc -p config/tsconfig.json`（对齐 SSoT §10H.5 V1）——README 健康指标「tsc 0 错误」由手动验证升级为自动化门禁
- **P1-3 IDE 产物出库**：`.trae-html-share-packages/` 移出版本控制并加入 .gitignore（会话生成物，非仓库资产）
- **P1-4 依赖可复现**：package-lock.json 入库（.gitignore 移除忽略行），不同环境 install 结果与 npm audit 行为可复现
- **P2-1 纯 Windows 警告升级**：pre-push 无 bash 环境时黄色 ⚠ 升级为红色 ✗ + 「本次推送未执行 17 项门禁」明示 + 补跑指引（保留 exit 0 刻意妥协）
- **P2-2 PR 模板强化**：校验要点改可勾选清单 + 新增「门禁输出」节要求附 prepush 末尾摘要（远程 runner 仍受限，不加 GitHub Actions）

### 修订（发布后延后项处理）

- version-bump / version-consistency 纳入 package-lock.json 根 version（版本六处 → 七处；防 lock 漂移脏 diff 复发）
- version-bump 顺带刷新 skill-metadata.json updatedAt
- README 健康指标日期更新为 2026-08-19 实测
- docs-consistency CLI 消除 docs/INSTALL.md 重复读取
- pre-push 第 17 项注释括号平衡（纯注释）
- 计划文档残留 grep 验证排除表补 **tests**/logic/cli 源

## [41.18.0] - 2026-08-18

### 修复（审计 2026-08-16 十六项问题）

- **反模式 #48 新增**（子代理越界实施）：修正 SKILL.md 五处 #22 误引（#22 实为目标系统 RBAC 角色越权）；补 #18/#19 详细节；maxAntiPattern 47→48
- **run-log action 枚举同步**：data-models.md interface 15→27 值（补 emergency-fix/r3-_/codegraph_query/opsx__/ensure_deps/iceberg-*），docs-consistency 新增 interface↔enum 语义比对
- **TLA+ 门禁超时**：SANY 60s / TLC 300s（EXEC_LIMITS 集中），TLC 挂死不再阻塞 CHECKPOINT；Java 版本解析单源化（lib/java-version.ts），预检不再硬编码 11
- **wm-write 原子写**：tmpPath 追加 randomUUID（同进程并发安全）；回读失败自动回滚备份（rolledBack 字段）
- **错误出口统一**：HandledCliError + runMain，消除 readJsonOrExit process.exit 截断 ERROR_JSON 风险与 readJsonClassified 双打印
- **分层修复**：plan-chunks 拆分 logic（纯）/cli（入口）；schema-loader 去 process.exit、IO 下沉 lib/schema-fs.ts；bdd-logic 去 as any
- **样板抽取**：lib/parse-args.ts、lib/run-main.ts、lib/gate-log-writer.ts；budget/maturity 复用 readJsonlOptional；artifact-gate 瘦身
- **schema 自描述**：design-contract 补 $id；6 份 schema 补顶层 description
- **persona 统一**：product-manager 删 tools 字段；5 份 hex color 统一命名色
- **文档一致性**：subagent-delegation 六角色矛盾修正；verifier-spec §6/§8 引用修正；command-reference 补 A/R 与 CHECKPOINT 统一清单；INSTALL 目录树 exit-2 脚本计数 31→33 修正；glossary 增反模式/exit-2 口径条目；三个超大引用文件增 §0 分节导引；ensure-codegraph-opsx 吞错加 stderr 日志；gate-logic 首次获得专属单测

## [41.17.0] - 2026-08-15

### Added

- `wm-write` 状态写助手：`.bak` 备份 + mtime 乐观锁 + 原子替换 + 回读校验，状态文件统一经此写入（防手写漂移）
- `doctor` 环境自检：node/tsx/ajv/java/tla2tools/codegraph/openspec 逐项检查 + 修复指引（`--with-tla` 升级 TLA+ 项为阻断级）
- `check-artifact-gate --validate-templates` 模板漂移校验：按 PHASE_SPEC_LAYOUT 校验 templates/ 资产结构标记
- 图谱轮次上限校验（MAX_GRAPH_ROUNDS=5）：防收敛循环无限返工
- 编排质量指标（metrics-report orchestration 区）：R3 套数/findings 分布 + 冰山扫掠轮次分布 + reworkHints 统计
- 评估提示词 15→25 条（w-model-dev-test-prompts.json）
- `templates/README.md` 阶段 × 主模板 × 子模板映射索引

### Changed

- run-log R8 轨迹校验扩展：同阶段内 S 动作 < R3 < V < G < checkpoint 相对顺序约束
- 错误消息补「期望 + 修法」尾注（design-contract-logic / tla-logic 层次校验）
- safe-json BOM 剥离：Windows 下 BOM 导致的 JSON 解析问题修复
- check-docs-consistency 新增文档内链存在性门禁（C3）

### Docs

- 六份重型参考（anti-patterns/verifier-spec/tla-plus-guide/bdd-guide/agent-personas/data-models）分层速查摘要
- anti-patterns 阶段 N 必读反模式索引
- dispatch-matrix S 变体 × R3/V/G 触发矩阵消歧 + 按阶段分节加载导引 + 53 文件触发条件表补全
- subagent-delegation 加载导引（已存在，确认）
- toolbox.md 去孤岛（SKILL.md + dispatch-matrix 指针）

## [41.16.0] - 2026-08-14

### Changed

- 版本号 41.15.0 → 41.16.0（**首次由新脚本 `npm run version:bump` 一处改版、六文件同步**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例 / CHANGELOG.md 节头；`version-consistency` 检查扩展为六处比对）
- **P0-1 消除 vitest 双跑**：pre-push 第 12 项 vitest 落盘 JSON（`--reporter=json --outputFile`），第 14 项 `check-docs-consistency` 经 `WM_VITEST_COUNT_FILE` 复用用例数，不再二次全量 vitest；脚本未变更时跳过重采（软放行）。每次 push vitest 由两次 → 一次，纯文档 push 零次。
- **P0-2 SSoT 章节号归一 + ssot-headings 元门禁**：`3.3.x` → `3.3.1`；`16. 参考文献` → `13. 参考文献`（16.1~~16.3 → 13.1~~13.3，内部 §16.2 引用同步）；新增 `checkSsotHeadings`（顶层章节号 1..N 连续 + 字面 x 占位标题检测），堵住「章节删节未重排」盲点。
- **P1-4 导航表收敛**：`dispatch-matrix.md` §6.4 补全为 31/31 权威登记表（新增/改名门禁脚本只登记一处）；AGENTS.md §2 巨型脚本枚举（~5000 字符）压缩为指针（见 §8 + dispatch-matrix §6），消除唯一整表重复；新增 `script-registry` 检查（全部 cli 脚本名须登记于 dispatch-matrix + SKILL「N 个 .ts」计数一致）。
- **P1-5 eval 状态如实化**：`eval/README.md` 标注「评估暂停中」（v36.0.0~v41.16.0 未外部盲评）+ 待评估版本表 + 恢复评估指引，不再假装闭环在跑。
- **P1-6 硬编码税最小化**：`REQUIRED_PATHS` 补「新增活体文档契约」注释（26 项）+ exit-2 工具数具名常量；`CONTRIBUTING.md` 数字一致性条删陈旧 `EXPECTED.currentVersion` 引用、改指 version:bump。
- 测试增长：vitest 623 → **634 条**（新增 ssot-headings / script-registry / version-consistency CHANGELOG 用例）；同步 README/AGENTS/pre-push 计数表述。
- `check-docs-consistency.ts` REQUIRED_PATHS 增 `dispatch-matrix.md` 与 `CHANGELOG.md`。

## [41.15.0] - 2026-08-14

### Changed

- 版本号 41.14.0 → 41.15.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **README/AGENTS/INSTALL/SSoT 文档同步批次（目录结构等）**：
  - README 项目结构树补 docs/ 缺项（user-guide / troubleshooting / index.html + _sidebar.md / changes/decision-log/；docs/api 注明为 gitignored 生成物）+ 根级 config/、scripts/setup-hooks.cjs、.eslintsecurity-baseline.json；.githooks 行补「16 项」
  - SSoT 追溯表补 7.6A 行（self-as-verifier demo-only 例外：独立产物路径 + Persona 切换 + 反模式 #35 守护）
  - AGENTS §1 补 self-as-verifier 例外指针（SSoT §7.6A）；§2 docs/ 行补排障/用户指南与 docs/api 生成物说明
  - INSTALL 目录树补 skill-metadata.json 行
  - docs/api 本地产物重生成（`npm run docs:build`；docs/api 为 gitignored 生成物，不入库）

## [41.14.0] - 2026-08-14

### Changed

- 版本号 41.13.0 → 41.14.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **self-as-verifier 措辞加固（设计观察 #5）**：
  - SKILL.md self-as-verifier 节新增「偏置缓解」要点：V 评审须切换与 S 产出视角不同的 Persona 提示词 + VerifierOutput `summary` 注明所用 Persona；明确「不消除自我偏置，仅限 demo/教学」
  - verifier-spec §13 补 demo-only 边界复述（原仅 SKILL.md 一处）+ 第 4 条「评审视角独立（偏置缓解）」
  - command-reference `/wm review` 节补 `--self-as-verifier --s-output=<S产出路径>` 参数文档（此前命令参考无该 flag 说明）
  - check-verifier-output.ts 头注释「本脚本自评模式」→ 准确的路径独立性校验措辞（与实现语义一致）
  - **SSoT 补 §7.6A self-as-verifier 模式（demo-only 例外）**——修复 decision-log 声称「SSoT 已新增该节」但正文缺失的文档-实现缺口
- **复杂度收敛引导（设计观察 #6）**：SKILL.md 触发决策节新增「任务规模适配（轻量路径）」小节（极小任务 → L0 交付层 + self-as-verifier + maturity L0/L1；生产小项目 → L2；常规生产 → L3；红线：轻量 = 门禁降载而非跳过阶段）+ SSoT §11A.6 权威段落

## [41.13.0] - 2026-08-14

### Changed

- 版本号 41.12.0 → 41.13.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **format 幂等性修复 + 防复发门禁**：
  - 根因：prettier 版本无漂移（3.9.6 三处一致）；「npm run format 重排 100+ 文件」实为默认 endOfLine=lf 与 Windows CRLF 工作树的行尾归一化 churn，真实格式漂移仅 7 个文件（artifact-gate-assets / phase-doc-map / read-json-or-exit / uat-path-mapping / verifier-logic 五个测试 + check-bdd-model / check-samples-coverage 两个 CLI）
  - `config/prettier.config.cjs` 增加 `endOfLine: 'auto'`（Windows CRLF / WSL LF 双兼容，不改变检出行为）
  - 全量 `npm run format` 统一格式化 7 文件 + `security-scan --regenerate` 重生成 baseline v2（282 → 280 条目）
  - **pre-push 新增第 16 项「prettier --check」格式一致性门禁**：任何 .ts/.cjs 编辑未跑 format 即被阻断，从根上堵住格式漂移复发
  - **15→16 计数级联**：EXPECTED.prePushCount、docs-consistency 测试 fixture、README / AGENTS / CONTRIBUTING（门禁表 +16 行）/ troubleshooting / pre-push 注释全部同步

## [41.12.0] - 2026-08-14

### Changed

- 版本号 41.11.0 → 41.12.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档一致性门禁动态化（消除「文件系统 ↔ EXPECTED 常量 ↔ 文档」三方同步）**：
  - `checkVersionConsistency`：package.json 为版本唯一源，其余四处声明与之比对；删除 `EXPECTED.currentVersion`（版本提升不再需第 6 处代码同步）
  - `checkReferencesCount`：期望值改从 SKILL.md「（N 个 .md）」表述解析，与实测比对
  - `checkAssetCounts`：期望值改从 README「N 个人格文件」表述解析，与实测比对
  - `checkVitestFileCount`：期望值改从 README「N files」/ AGENTS「N 个 .test.ts」表述解析（实测须命中声明集）
  - `checkExit2ScriptCount`：期望值改从 AGENTS「N 个脚本」表述解析，与实测比对
  - 删除死代码 `EXPECTED.schemaCount`（schema 检查早已用动态 `schemaFiles`）
  - docs-consistency 测试：baseInput 补 persona token + package.json 漂移用例语义改写（源漂移 → 其余四处报违规）+ 4 个「文档方向」新用例（51 条）
- **README:116 退出码标注漂移**：check-code-tla-consistency.ts「退出码 0/1」→「0/1/2」（全仓唯一漂移点；docs-consistency 只查计数不查退出码标注的盲区）
- ****tests**/README pure/IO 边界与实现对齐**：gate-logic.ts 标注为唯一例外（nodeFsAdapter 依赖注入做 spec 目录 IO）；检测命令补 `from 'node:path'` 并排除 gate-logic.ts；coverage 矩阵「vitest 35」→「vitest 40」
- **计数级联**：vitest 619 → **623 条**（+4 个 docs-consistency「文档方向」新用例）；README/AGENTS/CONTRIBUTING/INSTALL/troubleshooting/pre-push 计数全部同步（动态门禁自动校验捕获，无需再同步 EXPECTED）

## [41.11.0] - 2026-08-13

### Changed

- 版本号 41.10.0 → 41.11.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **遗留五项收尾**（41.10.0「明确不做」清单）：
  - **technical-writer 占位符规范化**：4 个围栏交付物模板各加「占位符说明」注记；5 处坏 URL 占位（`[工具 X](链接)`、`(链接)` 等）改为合法示例 URL（example.com / docs.npmjs.com）；标准占位（your-package、RFC 2606 示例域、[目标成果] 等）保留
  - **--json 声明张力统一（26 个 check-\*.ts 实测，非 8 个）**：--json 参数说明改为「stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）」；实现不动（ERROR_JSON 前缀为权威约定）
  - **批量任务编号注释自解释化（96 处）**：`B4 --json`×50 去前缀；B5/B6/B8/B3 → 直接描述；`A2b 双轨过渡`×19 → 「结构化违规双轨」；Task A1/批次3 Task7/Task 5/Task 3 → 直接描述；借鉴点 2/3/4 ×12 → 直接描述（Schema 前置校验/内容敏感指纹 diff/版本号双写一致性）；规则 ID 与 spec 文件指针保留
  - **readJsonOptional 死导出删除**（零生产调用）：lib 函数 + 3 条测试移除；**tests**/README 矩阵行补登记 readJsonlOptional / readJsonClassified / loadAndValidate
  - **lib 层 4 模块专属测试**（constants / phase-doc-map / uat-path-mapping / artifact-gate-assets 各 1 个测试文件，41 条用例；runModelChecks 用 vi.mock('node:child_process') mock spawnSync，CLI 集成侧由 pre-push 第 3/7/8 项覆盖）
- **计数级联**：vitest 36 → **40 文件** / 581 → **619 条**（-3 死导出测试 + 41 新 lib 测试）；EXPECTED.vitestFileCount、docs-consistency 测试 fixture、README/AGENTS/INSTALL/CONTRIBUTING/troubleshooting/pre-push 计数全部同步；**tests**/README 矩阵 +4 行

## [41.10.0] - 2026-08-13

### Changed

- 版本号 41.9.0 → 41.10.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓校核修复批次**（4 路并行审计 8 高 / 23 中 / ~14 低，按「以实现为事实源」原则修复）：
  - **高**：dispatch-matrix 补 check-iceberg-sweep（§6.2 通用脚本表 + §7 #44 守护行 + §4 ICEBERG-A/B 说明）；`lib/read-json-or-exit.ts` 4 处 exit 路径统一经 `exitWithError` 输出 ERROR_JSON（14 个 CLI 头注释契约补全；read-json-or-exit.test.ts 同步断言；check-preventive-review/check-iceberg-sweep 绕行注释更新）；CONTRIBUTING 六处陈旧计数（571→576×3、252→254×3）；SSoT §10A 追溯表死节名指针 +「10 个 →12 个 /wm 命令」；user-guide/pre-push/dispatch-matrix 的 E1-E8→E1-E9 ×3；examples/stage1 C1~C9→C1-C10；operational-recovery 锚点死链改无锚点链接
  - **中**：SSoT 死指针/误指清零（verifier-spec §7.6→§1、§10E→§10.8 ×2、「17 条→47 条」演进叙事 ×2、§932/§2219 历史叙事注改现状陈述、「候选反模式检测信号」→「C1（候选）」节 + anti-patterns TOC 对齐）；tla-plus-modeling-design 4 处 `--skip-tlc` 对齐「已移除」；skill-design-document §14/§15 结构描述；troubleshooting 558→576；loop-engineering-design 计数快照（17→47 ×7、37→254）+ SSKILL 笔误；README 树移除 3 个已移出吸收文档 + L1~L4 残留 + 补 /wm hill-climbing；INSTALL lib 9→12 + exit-2 构成口径；references 9 处（SKILL.md 节名 ×2、S 变体 8→10、workflow 拆出节名 + 阶段 3/4 产物 ID 前缀 INTF/DD、real-run-evidence 41.5.0→41.9.0、subagent-delegation 锚点、9→10 脚本自检 ×2、dispatch-matrix #21 守护去「run-log R5」）；**signature-chain-logic 入口补 validateBySchema**（反模式 #28 对齐；schema sigId 模式补 P2-/序号变体；self-test/vitest 期望同步）；**新增 maturity-logic.test.ts**（R1-R5 + schema 前置，vitest 35→36 文件 / 576→581 条级联同步）；check-requirement-graph 头注释补 --rtm/--exemptions；bdd-logic exitCode:2 语义注释、check-preventive-review 头注释对齐实现、check-iceberg-sweep CLI「R3」改名
  - **仓库卫生**：git rm `samples/tla-e2e/states/` 4 个 TLC 残留 + .gitignore 补规则；samples/README 矩阵 3 行条数修正（GATE 20 / TLA 15 / BDD 11，合计 253）
  - **低**：AGENTS §2 补 2 个漏列脚本；dispatch-matrix §3 补 check-tla-bdd-sync（阶段 1-4 S-tla 行）/ check-design-contract-consistency（阶段 8）+ §5 ensure-codegraph-opsx 说明；归档目录补第 5 个（README 树 + AGENTS 表）；「§4 约束 N/SSoT 约束 N」前缀 → 硬约束 #N（SSoT ×4 + adoption-guide ×8）；persona 文件 `project-management-experiment-tracker.md` → `project-experiment-tracker.md`（对齐矩阵短名）；SKILL.md templates 行补 budget.template.json / run-log.template.jsonl 全名；脚本注释类 8 处（Round 24 残留、人类可读报告声明 ×2、violations→reasons ×3、bdd [D2] 标签 ×2、run-log-logic「不 import」旧文案、check-run-log 头注释补 R8 + usage 补 --json、parse-phase 13 口径）
  - **明确不做**（观察清单）：technical-writer 围栏内占位符（示例样板合理）；B4/A2b 等批量任务编号注释（内部批次标识可追溯）；--json 模式 exit 2 单行张力（8 脚本一致固有）；readJsonOptional 公开 API；lib 层 4 模块无专属测试

### Docs

- SSoT §4A.2b/#7.6/#12.4 演进叙事改写为当前事实陈述；troubleshooting/CONTRIBUTING/design-docs 计数与事实对齐

## [41.9.0] - 2026-08-13

### Changed

- 版本号 41.8.0 → 41.9.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档层 + 脚本层去历史化全量清扫**（历史只由 CHANGELOG 体系承载；41.7.0 已清 references/templates，本轮扩展至 scripts/** 与全部根文档）：
  - **脚本层**（logic 18 / lib 12 / cli 12 / **tests** 18，共 60 文件）：删除注释、usage 帮助文本、运行时展示文本、describe/it 名称中的「（第 N 轮）」「[x.y.z]」「第 N 轮新增/升级/移入」标注与演进叙事（如「第 N 轮调测发现 X」）；schema 3 份 description 字段同步（enum/required/type 等约束字段零改动，run-log action enum 27 值零改动）；规则 ID（R1-R10 / D1-D8 / C1-C10 / E1-E9 / P2.5 / R13 等）与「已废弃」「无条件强制」「no-op 向后兼容」等现状声明保留
  - **文档层**（SKILL / references 37 / templates 5 / examples / subagent / docs 6 / README / AGENTS / CONTRIBUTING / pre-push 共 54 文件）：删除残留轮次标注与「第 N 轮由 SKILL.md 移入」句；41.8.0 批次遗留的历史归档指针（「已归档至 legacy-sections.md」等）统一删除，导航由 CHANGELOG/decision-log README 承担；演进叙事（「与原计划的差异」等）改写为当前事实陈述；pre-push「与原 CI 一致」→「全部门禁共 15 项检查」
  - **收尾修正**：checkpoint-logic 运行时消息、docs-consistency 违规消息、docs-consistency 测试 fixture 中的版本/轮次残留清零；verifier-spec rootcause 枚举行「新增」→「—（无旧值映射）」；README 门禁增强历史导航句去轮次
  - **保留项（B 类设计事实/导航）**：规则 ID、反模式 #N、约束 #N、SSoT §X 指针、文件指针、hard-constraints「原约束 #XX 并入」注记、「已废弃/已移除」现状声明、ISO 时间戳、docs/changes/archive 目录名中的 roundN（归档目录名不可改）、examples/real-run-evidence 快照版本元数据
- **门禁必需字符串复核**：anti-patterns `| 47 |` / `#1~#47`、hard-constraints `## #1`~`## #14`、operation-behaviors 八条表、DoD 七维度标题、data-models Schema 清单 20 份、glossary action 枚举、SKILL「（53 个 .md）」、SSoT 4A.1 权威标题、README/AGENTS/pre-push vitest 计数等全部原样保留

## [41.8.0] - 2026-08-13

### Changed

- 版本号 41.7.0 → 41.8.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档-实现一致性全量修正批次**（三路 Explore 扫描 + 逐条核验，以脚本实现为事实源）：
  - **规则编号漂移修正**：run-log 文档 R1-R7 → R1-R8（R8 轨迹模板校验早已实现）；BDD 文档 D1-D7 → D1-D8（D8 SD Coverage；workflow/templates×4 同步）；豁免文档 E1-E8 → E1-E9（E9 时间戳时序；SKILL/hard-constraints/phase-1/operational-recovery/anti-patterns/user-guide/exemption-logic 头注释同步）
  - **iceberg 规则重编号 R1-R8 → R1-R5**：原 R5-R8（轮次边界/去重/可证伪/passed 一致性）重排为 R2-R5，消除 R2-R4 编号空缺；logic 注释 / schema 描述 / self-test 用例描述 / iceberg-logic.test.ts / SKILL/AGENTS/anti-patterns/samples 矩阵同步
  - **S-ingest R3 门禁变体补全**：check-preventive-review.ts 新增 `--variant=ingest`（路径前缀 `<phase>-ingest-{dim}.json`）；hard-constraints/subagent-delegation S 变体清单 8 种 → 10 种（补 S-ingest-tla / S-ingest-bdd）；dispatch-matrix §6.1 同步；preventive-review-logic.test.ts 补 ingest 用例
  - **rootcause targetKind 补全（消解三方矛盾）**：verifier-logic SUB_CRITERIA + verifier-output.schema.json enum 增第 5 种 `rootcause`（§7.5 子标准：correctness 0.25 / completeness 0.25 / falsifiability 0.20 / actionability 0.15 / prevention 0.15）；verifier-spec §2.2/§2.3 重写；anti-patterns #19 检测信号与 dispatch-matrix §4 得以成立；新增 valid/bad rootcause 样本 + verifier-logic.test.ts 4 用例
  - **死锚修正**：anti-patterns.md TOC 三个不存在节（L1~~L4/F1~~F10/O1~O6）改引真实位置（operation-behaviors.md / SSoT §4A.2a / decision-log/legacy-sections.md）；SSoT:599/604/634/640/1969 同步；operation-behaviors:21/36、definition-of-done:59、user-guide:76 同步；#43 两处死锚改指「敏感信息禁令（第三十一轮）」节
  - **SSoT 计数与 typo 修正**：「28 条流程反模式（#1-#19+…）」→「47 条（#1~#47）」×3；「守护反模式 #3/#8」→「#18/#19」×5
  - **闭环脚本 4 → 5 全线统一**：SKILL.md:214 / quick-self-check / workflow / operational-recovery:443 补 check-preventive-review（约束 #11 无条件）
  - **verifier-spec 修正**：variance 重算阈值 §3.2/§11.3 `1e-4` → `1e-6`（对齐 §3.2.1 规则 2 与 VARIANCE_EPSILON；compositeScore 的 1e-4 独立不受影响）；TOC 补 §13；§6 注释「≥3 项」→「==5 项」；§8.0 占位符枚举补 rootcause / 子节号 1-5
  - **过时机制清理**：subagent-persona-matrix §7 移除已废弃 emergencyFixReview 事后复核机制（改由前置 R3×3 + V 兜底）；:93 parallelPersonas 死引用删除
  - **dispatch-matrix 补齐**：阶段 1 补 check-requirement-coverage、阶段 1-4 补 check-tla-bdd-sync、阶段 8 补 check-design-contract-consistency；§3 阶段 4 S-doc 加载 design-patterns-catalog；O 通用加载补 estimation-guide / context-management-guide
  - **模板计数修正**：quality-standards / phase-8「12 个模板」→「13 个」；SKILL.md Bundled Resources 补 schemas/、tools/ 行 + system-test / bdd-manifest.template.json；「6 独立子模板」→「每阶段 6 独立子模板（跨阶段共 10 种）」（SKILL/AGENTS/README）
  - **交付层清单修正**：L1 增加 `tools/`（tla2tools.jar，TLA+ 门禁运行时依赖）——SKILL.md:19 + INSTALL.md §2 交付层表与目录树同步
  - **孤儿 references 补入口**：estimation-guide → phase-1「执行方法论」；context-management-guide → operational-recovery 自检清单；design-patterns-catalog → phase-4「类设计规则引用」
  - **DoD 格式修复**：definition-of-done.md 七维度表补第 7 行（签名链完整性）+ 空粗体「****」修复为「代签判定」
  - **陈旧注释修正**：docs-consistency-logic 注释「57」→「53」×2 + EXPECTED.currentVersion 41.8.0；check-docs-consistency「合计 30」→「31」；run-log-logic「R1-R7」→「R1-R8」；self-test.ts 头部样本目录清单补全为 26 组
  - **samples/vitest 基线增长**：self-test 252 → 254（verifier rootcause 样本 ×2）；vitest 用例 +5（iceberg 重编号无增、preventive ingest +1、verifier rootcause +4）
  - **测试矩阵补齐**：**tests**/README.md 补缺 2 行（docs-consistency-logic / iceberg-logic）+ run-log R8 / preventive ingest / verifier rootcause 描述同步
  - **杂项**：AGENTS.md §8 导航表补 wm-status/metrics-report/security-scan 3 行、移除 gate-enhancement.test.ts 行、`--r3-enabled` 语义修正（无条件 R≥3，flag 为 no-op）；删除 w-model-dev/docs/superpowers 空目录残壳
- **决策记录**：文档与实现矛盾一律「以脚本实现为事实源」回写文档（防漂移门禁已强制计数，本轮补齐编号语义）；L1~L4 教训按 41.7.0 归档决策继续指向 legacy-sections.md，不恢复正文

### Docs

- SSoT §4A 反模式计数与实现位置同步；verifier-spec §2.2/§2.3 rootcause 枚举补全

## [41.7.0] - 2026-08-13

### Changed

- 版本号 41.6.0 → 41.7.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓 md 文档去历史化（架构决策：文档只承载设计事实，历史统一由 CHANGELOG 体系承载）**：
  - **SSoT 纯净化**：删除 §3.4.7-47 全部轮次记录区（~890 行）、§10A 追溯表 37 行轮次行、§10B 参考实现调测史、§14/§15 tombstone；§3.4.1-6 当前定义区与主题章节去轮次标注（~30 处）；历史缺陷引言（§10E/10I/10J/10.10 等 7 处）删除保留规则句；新增「设计决策历史」索引节（指向 decision-log 与 CHANGELOG）；§1.4 参考实现注改指针
  - **新建 decision-log 归档**：`docs/changes/decision-log/`（README 轮次→版本映射 + rounds-09-39 + rounds-40-47 轮次记录原文 + absorptions 4 份吸收决策记录 + legacy-sections 历史段落），原文保留不篡改
  - **根文档去历史化**：AGENTS.md §7 修复记录整节删除（内容已由 CHANGELOG 体系承载）；README/AGENTS/INSTALL/adoption-guide 参考实现节去轮次/指标/修复记录（保留归档导航链接）；SKILL.md 8 处轮次标注去标注
  - **references/templates 批量去标注**：329 处「（第 N 轮）」「[x.y.z] 新增」等 C 类标注清除（规则本体保留，B 类导航指针保留）；A 类叙述（「第 N 轮调测发现 X」等 ~20 处）删除；anti-patterns「实现层经验教训」节与 hard-constraints「编号迁移表」归档；references 中 27 处「SSoT §3.4.7+」轮次指针清理（指向已删节，改指当前定义或删除）
  - **4 份吸收决策文档归档**：four-source / mythical-man-month / external-skills / clean-code-refactoring-agentic absorption 从 references/ 移入 decision-log/absorptions.md（references 57→53，referencesCount 门禁联动）
  - **数据漂移修复**：CONTRIBUTING（249→252 ×3、14→15 项 + 补第 15 行编号表、去「与原 CI 一致」）；user-guide（249→252）；troubleshooting（14→15 ×2）
- **决策逆转记录**：SSoT 按轮次记录设计的旧模式（曾于 41.6.0 以「不篡改演进史」原则保留轮次区）→ 全仓去历史化新模式（CHANGELOG 体系唯一历史承载，SSoT/README/AGENTS/references 只含设计事实）；轮次记录原文无损归档于 decision-log

### Docs

- SSoT 新增「设计决策历史」索引节；CHANGELOG 顶部补 decision-log 指针

## [41.6.0] - 2026-08-13

### Changed

- 版本号 41.5.0 → 41.6.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **SSoT 权威性审查修复**（三路 Explore 全面一致性扫描，41.4.0/41.5.0 两轮变更后核验）：
  - **修 SSoT 内部互斥**：§3.4.3 阶段门 / §3.4.6 P1.2 的 TLA+ 强制门槛（「无例外」绝对式）与 §3.4.44 P1-3 成熟度开关（L1 可选 / L2 / L3）对齐——当前章节补分级说明，P1.2 标题改「按成熟度分级（约束 #13）」
  - **修活体指针**：AGENTS.md 错误结构指针由 §3.4.30 补为「§3.4.30（全量归一化）+ §3.4.42（CliError rule/field，当前定义）」
  - **修 §10A 追溯表**：补缺 §3.4.42 行（CHANGELOG [41.2.0] 声称有而实际缺失）+ 修复 §3.4.36/37/38 三行残缺（2 列 → 完整 4 列，自轮次记录提取补全）
  - **修标题层级**：§3.4.40-46 标题 `###` → `####`（与 §3.4.7-39 轮次记录层级统一，消除 h3/h4 混排）
  - **双副本权威声明**：SSoT §4A.1（八条操作行为）/ §10.6（DoD 七维度）表头标注「权威源 = operation-behaviors.md / definition-of-done.md，本表为摘要副本」；§7 数据模型标注「结构权威 = data-models.md」
  - **历史决策逆转指针**：§3.4.44 关键决策④（C7 重申）追加「已于 41.5.0 §3.4.46 O1 逆转」标注，防误读为现行决策
  - **samples/README.md 基线同步**：头部「249 条回归基线」→「252 条」（41.5.0 轮遗漏，SSoT §3.4.46 已记录 249→252）
- **审查结论**：SSoT 核心职能仍成立（数字全部一致 / 当前状态声明零漂移 / 零死链），无需重写；本轮为止血修复，恢复「当前章节 = 最新决策」的权威一致性

### Docs

- SSoT 新增 §3.4.47 第 47 轮记录 + 追溯表行

## [41.5.0] - 2026-08-13

### Added

- **samples 覆盖矩阵门禁（T1）**：新增 `check-samples-coverage.ts`——自动核对 `samples/` 每个 fixture（文件/嵌套目录）被 `self-test.ts` 用例数组（file / sampleDir / manifestFile / featureFiles 字段）引用，且每个子目录在 `samples/README.md` 覆盖矩阵声明；堵住「新增 fixture 遗忘登记」（未登记 fixture 不参与任何检查，self-test 仍全绿）。新建成 `samples/README.md` 覆盖矩阵（26 子目录 × check 脚本 × 用例数组）；pre-push 第 14 项后新增第 15 项（prePushCount 14→15，docs-consistency EXPECTED 与 README/AGENTS 同步）
- **真实命令证据示例（T2）**：新建 `examples/real-run-evidence.md`——5 个真实门禁命令的 exit 0/1/2 三态输出实录（check-verifier-output / check-requirement-graph / check-samples-coverage）；4 份对话类示例（coding / requirement-analysis / system-design / test-execution）头部标注「伪示例，仅供 LLM 行为对齐」，虚构数字（95% 覆盖率 / 18-18 / 50-50）改为「以真实运行器为准」；coding.md 删除 `echo > .env` 反模式示例（改为环境变量注入两方式）；test-execution.md 质量门语义修正

### Changed

- 版本号 41.4.0 → 41.5.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **孤儿样本登记（check-samples-coverage 首跑发现）**：`samples/` 5 个全仓零引用 fixture——登记 3 个有效样本进 self-test.ts（gate/bad-phase5-codemodule-format → GATE_CASES phase5 codeModule 格式校验；tla/bad-coverage-uncovered-sd → TLA_CASES SD 覆盖完整性；bdd/bad-d8-uncovered-sd → BDD_CASES D8 SD 覆盖）；删除 2 个「名字与实际行为不符」伪样本（gate/valid-phase5-with-uat-path-mapping、gate/bad-phase5-missing-uat-path-mapping）；self-test 基线 249 → 252 条（README / AGENTS / INSTALL / pre-push 同步）；exit-2 脚本计数 30 → 31（新增 check-samples-coverage，AGENTS / SKILL.md / INSTALL / docs-consistency EXPECTED 同步）
- **Markdown 去重（A2 收敛版）**：AGENTS.md §6「编排者最小化」与 §1 同文件双份 → 精简为一句 + 指针；INSTALL.md 安装步骤引导段与 §1/FAQ 重复的角色描述 → 指针化；SKILL.md 内联 14 行硬约束摘要表**保留**（编排入口速查价值，评估结论记录于 SSoT §3.4.46）
- **CHANGELOG 批次拆分（A5）**：41.2.0 的 P0/P1/P2 工程化批次（27 项 Changed + 3 修复 + 文档同步，均不涉及版本语义）移入新建 `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md`；[41.2.0] 条目精简为版本语义 + 批次指针；清理 `docs/changes/` 空目录残留
- **移除 npm workspaces（O1）**：删除根 package.json `workspaces` 字段 + `w-model-dev/package.json`（C7 决策逆转——子包零依赖、全仓零包名引用、createRequire/tsconfig/vitest/pre-push 均不依赖 workspace，空包无实际作用）；INSTALL.md FAQ 改为单根包表述；SSoT §3.4.46 记录决策逆转理由

### Docs

- SSoT 新增 §3.4.46 第 46 轮记录 + 追溯表行

## [41.4.0] - 2026-08-13

### Changed

- 版本号 41.3.1 → 41.4.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **cli/ 分层修正（评审 N1）**：`cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`（check-artifact-gate 拆出的 IO 解析模块）移入 `lib/`；`check-artifact-gate.ts` import/re-export 同步；exit-2 脚本计数 30 不变，`check-docs-consistency` 与 `docs-consistency-logic` 注释修正（5 工具 = 4 工具 CLI + `logic/plan-chunks.ts`，self-test.ts 非 exit-2 不计入）；SKILL.md Bundled Resources `scripts/cli/` 表述改为「30 个 .ts：25 个 check-* 门禁 + 5 个工具 CLI」
- **references 计数修正 + 门禁（评审 D1）**：SKILL.md「references/（53 个 .md）」→「（57 个 .md）」（第 44 轮新建 4 篇未同步）；`check-docs-consistency` 新增 **references-count 检查项**（`EXPECTED.referencesCount=57` + 实测 .md 数 + SKILL.md 表述三重比对，镜像 personaCount 模式）
- **TLA 轨迹清理工具跨层修正（评审 N2）**：`cleanTraceFiles` / `isTlcStatesDir` 自 `cli/check-tla-model.ts` 移入新建 `lib/tla-clean-trace.ts`（IO 辅助归 lib/，logic/ 保持纯函数约定）；`tla-clean-trace.test.ts` import 同步
- `dispatch-matrix.md` 数据来源行移除过时版本号 35.0.0（评审 D2），改为「随版本演进，以当前 SKILL.md 为准」
- AGENTS.md 角色表述澄清（评审 A4）：六类角色 = O（编排者）+ 五类子代理（A/S/V/G/R；R 含 R-iceberg 变体）
- AGENTS.md `docs/` 行声明 `docs/superpowers/` 为内部规划目录（评审 O3），不参与门禁、非面向用户
- 新建 `w-model-dev/tools/README.md`（评审 A6）：tla2tools.jar 版本（TLC2 2.19 of 08 August 2024）/ 来源 / license / 同步策略，权威记录指向 `references/tla-plus-guide.md`

### Docs

- SSoT 新增 §3.4.45 第 45 轮记录 + 追溯表行

## [41.3.1] - 2026-08-13

### Changed

- 版本号 41.3.0 → 41.3.1（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例；41.3.0 发布时 README 未同步导致漂移，本轮补齐并加门禁防再漂）
- `check-docs-consistency` 新增 **version-consistency 检查项**：`EXPECTED.currentVersion` + 五处版本声明全量比对（package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例），任一漂移或不可解析即 exit 1；`REQUIRED_PATHS` 增补 package.json / skill-metadata.json / docs/INSTALL.md；CONTRIBUTING「数字一致性」表述由「三处」更新为「五处」
- `skill-metadata.test.ts` 新增第 5 个用例：README / INSTALL.md 版本与 package.json 一致（五处镜像断言）
- 模板占位符统一：7 份阶段模板 SSOT 头「文档版本」由 `v{{1.0}}`（字面+部分占位）统一为 `{{v1.0}}`（全段占位，与元数据区 9 处既有风格一致）；`format-conventions.md` 新增 §7「模板占位符语法」规范（全段占位约定 + 固定占位符表 + 检查）
- docsify 离线降级：`docs/index.html` 新增 `<noscript>` 提示 + CDN `onerror` 兜底文案（离线/断网白屏时给出解释与本地预览指引）
- **SKILL.md 减负 524 → 216 行**：硬约束完整版 → 新建 `references/hard-constraints.md`；八条操作行为 + F1-F10 → 新建 `references/operation-behaviors.md`；自检清单 → 新建 `references/quick-self-check.md`；顶部 5 段方法论 → 新建 `references/design-philosophy.md`；Bundled Resources 四表压缩为目录级索引；阶段门/质量门说明压缩。`check-docs-consistency` 联动：`checkOperatingBehaviors` 改指针模式（防内联回退），新增 `checkHardConstraints`（## #1-## #14 编号连续性 + SKILL.md 指针）
- **硬约束 21 → 14 条重排**（第 44 轮）：#9 TLA+ 与 #14 BDD 合并为「#13 行为门禁按成熟度分级」；#20 codegraph 与 #21 回归合并为「#14 代码改动前后门禁」；#15/#16/#17/#18/#19 分别并入 #10/#2/#11/#3/#8。全仓活体文件 326+ 处「约束 #N」/「约束 N」引用同步重编号（归档 docs/superpowers、docs/changes、eval 历史记录不动）；`hard-constraints.md` 附「编号迁移表」
- **TLA+/BDD 成熟度开关**（约束 #13 可执行化）：L1 教学/demo 可选 / L2 生产小项目 TLA+ L1 + BDD L1 必跑 / L3 全必跑；编排层开关（非脚本参数，`--skip-tlc` 禁令维持）；`operational-recovery.md` 新增「成熟度与行为门禁」节
- **L0/L1 双交付层**：SKILL.md 顶部「交付层」说明 + INSTALL.md §2「交付层选择」表（L0 纯 Markdown 零依赖拷贝即用 / L1 带门禁需 `npm install`）
- `w-model-dev/test-prompts.json` 删除（14 条孤儿文件，无任何文档/脚本引用；评估场景以 `eval/w-model-dev-test-prompts.json` 15 条为准）
- `CHANGELOG.md` 拆分：41.0.0 之前（含 40.x 及更早）历史条目移入新建 `CHANGELOG-archive.md`（2169 行 → 80 行）
- anti-patterns.md 新增「反模式-硬约束映射」表（14 条硬约束 × 47 条反模式双向定位 + 高频标注）
- vitest 计数 558 → 571（新增 13 条单测），README / AGENTS.md / INSTALL.md / CONTRIBUTING.md / pre-push 同步

### Docs

- SSoT 新增 §3.4.44 第 44 轮记录 + 追溯表行

## [41.3.0] - 2026-08-13

### Changed

- 移除 `.cursor/skills/` 技能包资产残留引用（目录已在 e74b886 中删除，12097 行）：`check-docs-consistency` 门禁解耦——`REQUIRED_PATHS` 移除 `.cursor/skills`（此前缺失直接 exit 2 阻断每次推送）、`EXPECTED` 移除 `cursorSkillCount=23`、`checkAssetCounts` 单参数化（仅 persona）、目录计数删除；`.githooks/pre-push` 变更过滤移除 `.cursor/skills/**` 分支与触发条件注释；AGENTS.md 导航表 / README.md 结构树与 pre-push 注释清理；references 5 处死链修复（phase-5-coding 删除空「相关资源」节、phase-4-detailed-design / anti-patterns / subagent-delegation×2 去链接保留文字、verifier-spec 重定向到技能包内 agent-personas.md）
- 版本号 41.2.0 → 41.3.0（三处一致：package.json / skill-metadata.json / SKILL.md frontmatter；INSTALL.md 示例同步）
- `.gitignore` 追加 `.cursor/`（与 `.claude/` 同款，防误跟踪）

### Docs

- SSoT 新增 §3.4.43 第 43 轮记录 + 追溯表行

## [41.2.0] - 2026-08-10

### Added

- 四源吸收 P2（10 项）：subagent-persona-matrix 证据加权共识、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing 爬山法哲学基础、tla-plus 不连续系统穷举「为什么」、operational-recovery 集成混沌预期 + 超标重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准、SKILL.md 受控的失控 + clockware/swarmware 选择法则

### Changed

- 版本号 41.1.0 → 41.2.0
- P0/P1/P2 工程化批次（2026-08-11 ~ 2026-08-12，不涉及版本语义）已拆分归档至 [`docs/changes/engineering-batches/2026-08-11-p0-p2-batches/`](./docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md)（scripts 四层重组 / check-artifact-gate 拆分 / violations 双轨结构化 / --json 可观测性 / config 集中 / vitest 覆盖率入 pre-push / npm Workspace 等 27 项 + 3 项修复 + 文档同步）

### Fixed

- （批次内修复见 engineering-batches 归档：A6 历史归档恢复 / 54 处旧脚本路径修正 / security baseline 重生成）

### Docs

- SSoT 新增 §3.4.42 第 42 轮 P0-P2 批次记录 + 追溯表行（批次详情见 engineering-batches 归档）

## [41.1.0] - 2026-08-10

### Added

- 四源吸收 P1（10 项）：design-patterns-catalog.md（GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture/Security 评审问题、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness、security-review 认证授权传输维度、phase-6 补偿/故障注入测试

### Changed

- code-smells-checklist 补子类爆炸/继承破坏封装/Getter-Setter 浅方法
- 版本号 41.0.0 → 41.1.0

## [41.0.0] - 2026-08-10

### Added

- 四源吸收 P0（11 项）：code-smells-checklist 组 X 复杂度症状 + 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）、quality-standards 类设计规则补充（深度优先/多类症/组合拆分四信号/通用专用分离）+ 设计投资节、format-conventions 接口注释必备清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 信息隐藏/下沉复杂性/异常策略三选项、verifier-spec 三信息来源 + 复杂三症状 + 设计三项检查、class-design 模板「方案权衡」必填列
- 候选反模式登记：四源-α 复杂性增量累积 / 四源-β 模式装饰性引用 / 四源-γ 过度 swarm 化 / 四源-δ 纸面理由替代真实门禁（候选区，不正式编号）
- 新 reference：four-source-absorption.md（吸收决策记录，挂 Bundled Resources）

### Changed

- 版本号 40.2.0 → 41.0.0
