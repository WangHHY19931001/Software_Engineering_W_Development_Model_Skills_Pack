# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 41.0.0 之前的历史变更已归档至 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。
> 历史决策详情（轮次记录 / 关键决策 / 验证数据 / 吸收决策记录）归档于
> [`docs/changes/decision-log/`](./docs/changes/decision-log/README.md)（轮次 → 版本 → CHANGELOG 映射见其 README）。

## [41.19.0] - 2026-08-19

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
- 计划文档残留 grep 验证排除表补 __tests__/logic/cli 源

## [41.18.0] - 2026-08-18

### 修复（审计 2026-08-16 十六项问题）
- **反模式 #48 新增**（子代理越界实施）：修正 SKILL.md 五处 #22 误引（#22 实为目标系统 RBAC 角色越权）；补 #18/#19 详细节；maxAntiPattern 47→48
- **run-log action 枚举同步**：data-models.md interface 15→27 值（补 emergency-fix/r3-*/codegraph_query/opsx_*/ensure_deps/iceberg-*），docs-consistency 新增 interface↔enum 语义比对
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
- **P0-2 SSoT 章节号归一 + ssot-headings 元门禁**：`3.3.x` → `3.3.1`；`16. 参考文献` → `13. 参考文献`（16.1~16.3 → 13.1~13.3，内部 §16.2 引用同步）；新增 `checkSsotHeadings`（顶层章节号 1..N 连续 + 字面 x 占位标题检测），堵住「章节删节未重排」盲点。
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
- **__tests__/README pure/IO 边界与实现对齐**：gate-logic.ts 标注为唯一例外（nodeFsAdapter 依赖注入做 spec 目录 IO）；检测命令补 `from 'node:path'` 并排除 gate-logic.ts；coverage 矩阵「vitest 35」→「vitest 40」
- **计数级联**：vitest 619 → **623 条**（+4 个 docs-consistency「文档方向」新用例）；README/AGENTS/CONTRIBUTING/INSTALL/troubleshooting/pre-push 计数全部同步（动态门禁自动校验捕获，无需再同步 EXPECTED）

## [41.11.0] - 2026-08-13

### Changed
- 版本号 41.10.0 → 41.11.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **遗留五项收尾**（41.10.0「明确不做」清单）：
  - **technical-writer 占位符规范化**：4 个围栏交付物模板各加「占位符说明」注记；5 处坏 URL 占位（`[工具 X](链接)`、`(链接)` 等）改为合法示例 URL（example.com / docs.npmjs.com）；标准占位（your-package、RFC 2606 示例域、[目标成果] 等）保留
  - **--json 声明张力统一（26 个 check-\*.ts 实测，非 8 个）**：--json 参数说明改为「stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）」；实现不动（ERROR_JSON 前缀为权威约定）
  - **批量任务编号注释自解释化（96 处）**：`B4 --json`×50 去前缀；B5/B6/B8/B3 → 直接描述；`A2b 双轨过渡`×19 → 「结构化违规双轨」；Task A1/批次3 Task7/Task 5/Task 3 → 直接描述；借鉴点 2/3/4 ×12 → 直接描述（Schema 前置校验/内容敏感指纹 diff/版本号双写一致性）；规则 ID 与 spec 文件指针保留
  - **readJsonOptional 死导出删除**（零生产调用）：lib 函数 + 3 条测试移除；__tests__/README 矩阵行补登记 readJsonlOptional / readJsonClassified / loadAndValidate
  - **lib 层 4 模块专属测试**（constants / phase-doc-map / uat-path-mapping / artifact-gate-assets 各 1 个测试文件，41 条用例；runModelChecks 用 vi.mock('node:child_process') mock spawnSync，CLI 集成侧由 pre-push 第 3/7/8 项覆盖）
- **计数级联**：vitest 36 → **40 文件** / 581 → **619 条**（-3 死导出测试 + 41 新 lib 测试）；EXPECTED.vitestFileCount、docs-consistency 测试 fixture、README/AGENTS/INSTALL/CONTRIBUTING/troubleshooting/pre-push 计数全部同步；__tests__/README 矩阵 +4 行

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
  - **脚本层**（logic 18 / lib 12 / cli 12 / __tests__ 18，共 60 文件）：删除注释、usage 帮助文本、运行时展示文本、describe/it 名称中的「（第 N 轮）」「[x.y.z]」「第 N 轮新增/升级/移入」标注与演进叙事（如「第 N 轮调测发现 X」）；schema 3 份 description 字段同步（enum/required/type 等约束字段零改动，run-log action enum 27 值零改动）；规则 ID（R1-R10 / D1-D8 / C1-C10 / E1-E9 / P2.5 / R13 等）与「已废弃」「无条件强制」「no-op 向后兼容」等现状声明保留
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
  - **死锚修正**：anti-patterns.md TOC 三个不存在节（L1~L4/F1~F10/O1~O6）改引真实位置（operation-behaviors.md / SSoT §4A.2a / decision-log/legacy-sections.md）；SSoT:599/604/634/640/1969 同步；operation-behaviors:21/36、definition-of-done:59、user-guide:76 同步；#43 两处死锚改指「敏感信息禁令（第三十一轮）」节
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
  - **测试矩阵补齐**：__tests__/README.md 补缺 2 行（docs-consistency-logic / iceberg-logic）+ run-log R8 / preventive ingest / verifier rootcause 描述同步
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

