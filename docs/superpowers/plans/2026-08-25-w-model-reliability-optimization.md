# W-Model Reliability Optimization 实现计划（对账版）

> 本文件是 `docs/superpowers/plans/2026-08-25-w-model-reliability-optimization.md` 的对账版，
> 取代 2026-08-19 四个批次整改计划在本仓库的执行入口，内容与用户批准的「完整实施 A-D（推荐）」
> 一致。执行方式：`subagent-driven-development`（推荐）。步骤以任务节为单位，每任务一个实现子代理
> + 任务审查 + 定向复审。
>
> 上一版（2026-08-25 初稿）对 **已核实已落地** 的能力仍写了「创建/迁移」类步骤（如
> `gate-log.schema.json`、`state-schema-registry.ts`、`run-sync.ts`、证据导出、infrastructure 分层、
> SSoT 三边界、persona fixture），与当前 HEAD 事实冲突。本版按只读子代理核对结论（fact-finding）重写：
> 已有能力只补验证与协议断点，不重复重写。

# w-model-dev 全面可靠性、易用性与有效性优化实施计划

## 目标与边界

在不改变 W 模型 8 阶段、RTM、CHECKPOINT、O/V/G/R 角色边界和「技能包不调用 LLM」的前提下，闭合当前 HEAD 已核实的剩余缺口。已有能力（锁内 mtime、状态 Schema 注册、pre-push 触发范围、gate-log 基础 Schema、docs-consistency fail-closed、主要依赖分层、证据导出、README 双入口）只补验证和协议断点，不重复重写。

非范围：引入 LLM/SDK/业务代码或外部状态服务；改变 TLA+/BDD 领域规则；把纯 Windows 无 Bash 的既有放行策略改成另一套平台策略；修改已证伪的历史报告结论。

## 执行纪律

1. 在当前 `main` 之外创建隔离 worktree；每个批次/任务单独提交，避免状态、hook、文档和架构变化混在一个提交中。
2. 任何 TypeScript 文件编辑前，先记录目标符号、调用者/被调用者和影响半径。当前仓库无 `.codegraph/` 索引时，记录 `codegraph unavailable`、实际 import 图扫描命令和结果到 `.w-model/codegraph-queries/`，不伪造 codegraph 输出。
3. 每个任务遵循 TDD：先添加能稳定复现问题的失败测试，确认失败，再实现最小修复，运行定向测试；生产代码改动后必须跑回归测试。
4. 编排者只负责分派、状态和证据；代码/测试/文档实施由 S 子代理执行，V 子代理独立评审，G 子代理执行门禁。失败后先 R 根因定位，再 V 复审、G 门禁、S-fix。

## 批次 A：状态事务与平台依赖供应链

### A1. 完善 `wm-write` 失败原子性

涉及 `state-write-logic.ts`、`wm-write.ts` 及状态写入测试。

- 在提交前捕获原目标的内容与「目标不存在」状态；`--no-backup` 不再被解释为「失败时可以删除原目标」。
- 读回不一致时，在仍持有当前 token 的锁内，以唯一临时文件 + rename 原子恢复旧内容；原目标原本不存在时，原子移除本次新内容并恢复「不存在」。恢复失败返回 `WRITE_VERIFY_FAILED`，不得谎报 `rolledBack=true`，不得遗留 tmp。
- 保留默认备份、`--expect-mtime` 向下取整、`WMWRITE_JSON` 字段、exit 0/1/2、`--lock-timeout 0` 和显式 `--recover-stale-lock` 兼容性。
- 对空 owner、损坏 metadata、owner 创建后 metadata 写入前崩溃增加明确契约：未知 owner 不自动删除；未满足「TTL 到期且 PID 不存在」或未显式恢复时返回 `LOCK_TIMEOUT/STALE_LOCK`，恢复动作先重命名为审计 stale 文件。
- 增加真实独立子进程竞争测试：相同旧 mtime 的两个 writer 只能一个成功；增加 no-backup 回滚、目标不存在回滚、token 不匹配、损坏 metadata 和 stale lock 测试。补齐 CLI 子进程 timeout。

### A2. 显式安全平台修复

涉及 `.githooks/ensure-platform-deps.sh`、新增无外部运行依赖的 Node 辅助脚本（或等价实现）、`.githooks/pre-push`、package scripts 和 hook 测试。

- `--check` 默认只读检查；pre-push 只能调用 `--check`，不得调用 `npm install`、`npm pack`、tar 解包或覆盖现有 `node_modules`。
- `--install` 只允许用户显式调用，读取 npm lockfile v3 中目标 native 包的 name/version/resolved/integrity，并限制 registry host allowlist。
- 使用 `npm pack --json` 获取确定 tarball；用 Node `crypto` 校验 lockfile `sha512-<base64>` SRI；在隔离暂存目录检查归档条目，拒绝绝对路径、`..` 路径、异常符号链接/目录逃逸；校验 `package/package.json` 的包名和版本。
- 通过暂存目录的运行时模块加载验证后，再以受控方式安装缺失的目标包；失败不污染现有 `node_modules`。保持当前仅支持 `win32-x64`/`linux-x64` 的明确 fail-closed 提示，除非 lockfile 和测试矩阵同时扩展平台。
- 增加 lockfile integrity/registry/version、篡改 tarball、路径穿越、符号链接和安装后加载测试。复核 `npm audit` 的网络/registry 跳过正则只覆盖明确网络错误，其他非零结果一律阻断。

## 批次 B：门禁、证据与行为边界

### B1. 修复 gate-log 与 run-log 协议闭环

涉及 `gate-log-writer.ts`、`gate-log.schema.json`、`run-log-logic.ts`、`check-run-log.ts`、三个 gate-log 调用方及测试。

- 保持 gate-log 独立 Schema、append-only、唯一文件名和显式写入错误。
- `extractExitCode` 先解析整个 gate-log 根 JSON 的 `exitCode`/`passed`，再兼容旧的 `*_JSON` stdout 摘要；拒绝或报告根字段与 `reportSummary/stdoutSummary` 不一致。
- `check-run-log --gate-logs` 读取 gate-log 时按 Schema 校验；指定 gate-log 目录不可读、文件损坏或无法提取 exitCode 时产生可追踪 violation，而不是 warning 后静默跳过。保留可选参数兼容性，但一旦传入就 fail-closed。
- 增加 writer 产物直接供 `check-run-log` 读取的集成测试、根 JSON/旧摘要兼容测试、篡改和不可读测试。

### B2. 收紧状态目标契约

涉及状态 Schema 注册表、`wm-write`、状态文档和 Schema 测试。

- 逐一审计 `checkpoint-log`、`event-ingress`、`hill-climbing-report` 等 Schema：有实际运行时写入口的接入注册表和逐行校验；没有运行时消费者的明确标注为 fixture-only，并从「可写运行时状态」文档清单中移除。
- 未注册 `.w-model` 目标继续默认拒绝，仅 `--allow-untyped` 显式绕过并输出机器可读警告；JSONL 继续报告准确行号。
- 修正 fail-closed 注释和测试，确保 Schema 加载/解析异常不会回落为「合法」。

### B3. 统一同步子进程边界

涉及 `run-sync.ts`、`artifact-gate-assets.ts`、`check-docs-consistency.ts`、`check-tla-model.ts`、`security-scan.ts`、相关 CLI/测试。

- 所有生产同步子进程统一走 `runSync` 或显式等价 options，固定 `timeout`、`killSignal`、`encoding`、`maxBuffer`；TLA/SANY/TLC 使用集中定义的较长 timeout，不能被 15 秒默认值提前截断。
- 清理当前 `missing-followup` 调用点，新增静态测试阻止生产目录重新直接使用未配置 timeout 的 `spawnSync/execSync`。
- 为 timeout、非零退出、超大 stdout/stderr 和 Windows 路径增加定向测试。

### B4. 强制项目阶段门的 TLA/BDD 证据

涉及 `artifact-gate-assets.ts`、`check-artifact-gate.ts`、`check-bdd-model.ts`、BDD/TLA Schema、TLA↔BDD sync CLI、测试和命令文档。

- 阶段 1–4：项目阶段门调用 BDD 时必须传 `--require-tla-equivalence --tla-manifest=<path>`；对 `--tla-manifest` 做真实 `tla-manifest` Schema 校验，存在但畸形的 manifest 不能被当作「缺失/空快照」。
- 阶段 5–8：增加明确的 `--cucumber-report=<path>` 阶段门输入；调用 BDD 时必须传 `--require-cucumber-report --cucumber-report=<path>`，缺失、畸形、无执行 scenario/step、skipped/unknown 状态均为 violation。
- 明确 phase 1 是否需要 graph 的既有兼容边界：TLA/BDD 证据门不能因为 `phase>=2 && graphPath` 条件而被整体跳过；阶段 1 使用自身 manifest 证据，阶段 2–4 再叠加 graph。
- 当项目同时提供 TLA/BDD 资产且阶段契约要求同步时，阶段门调用 `check-tla-bdd-sync` 或等价纯逻辑校验；任一转移集、状态集或不变式不一致均阻断。
- 增加 artifact-gate 参数断言、malformed TLA/Cucumber report、缺证据和 sync mismatch 的 CLI/集成测试；pre-push fixture 回归继续不启用项目级 required flags，文档明确两层边界。

## 批次 C：有效性与采用体验

### C1. Persona 真实 CLI 回归

涉及 `verifier-logic.test.ts`、四个 persona fixture、samples 覆盖矩阵、`agent-personas.md`。

- 保留现有逻辑级校验，并为四个 fixture 逐一通过 `check-verifier-output.ts --json` 的真实子进程测试，断言 exit 0、`passed=true`、`reasons=[]`。
- 含阻断性 rework hint 的负样本增加对应 `passed/qualityLevel/exitCode` 语义测试，防止文档示例再次漂移。

### C2. 文档入口与 SSoT 收尾

涉及 README、INSTALL、adoption、AGENTS、CONTRIBUTING、SSoT、references 和 docs-consistency。

- 保持并验证 README 的「验证仓库」和「安装 Skill」双入口、Node/Git/网络要求、PowerShell 5.1 两行命令、Git Bash 边界、postinstall `core.hooksPath` 副作用和 Agent-specific 路径说明。
- 让 SSoT 内链扫描和三边界架构图契约继续作为 docs-consistency 输入；不再把历史/本地生成物当作当前 HEAD 验收证据。
- 产出当前 reviewed HEAD 的批次验收记录：链接、Persona CLI、样本覆盖、全量测试、typecheck、pre-push 和对应 commit/provenance 身份。

## 批次 D：维护性与长期可操作性

### D1. 统一 CLI 自然退出

涉及 `w-model-dev/scripts/cli/*.ts`、`gate-report.ts`、测试和命令文档。

- 将剩余生产 CLI 的成功/校验失败路径从直接 `process.exit()` 改为设置 `process.exitCode` 后自然返回；保留参数错误 `exitWithError` 的结构化 exit 2 语义。
- 覆盖 `metrics-report.ts`、`security-scan.ts`、`wm-status.ts`、`ensure-codegraph-opsx.ts`、`self-test.ts` 等当前残余点，逐一增加真实子进程 exit 0/1/2 断言。
- 增加静态依赖/退出策略测试，禁止新门禁 CLI重新引入直接退出或吞掉 stdout/ERROR_JSON。

### D2. 明确脚本分层边界

涉及 `scripts/{cli,application,infrastructure,logic,lib}` 及 dependency-boundaries 测试。

- 保留当前已落地的 infrastructure/application 分层，不做无关目录重排；补充规则：生产 `lib` 不反向依赖 `logic`，无循环，logic 不直接启动子进程，所有 I/O 例外必须在 allowlist 有说明。
- 明确 `application` 为内部编排层，不纳入公开 TypeDoc；或若现有发布契约要求公开，则同步 docs entry。该选择在实现前以现有 `docs:build` 结果和文档边界测试固定下来。
- 增加 import 图和层序回归测试，保证后续新增脚本不会重新引入反向边。

### D3. 保留并验证证据导出

涉及 evidence export/provenance 的现有实现、Schema、测试和文档。

- 不重写已落地算法；补充最终验收：白名单目录、路径脱敏、敏感字段清理、SHA-256 manifest、篡改拒绝、package-only 与 `--source-project` source-bound 验证级别分离。
- 文档明确 `.w-model`、`.zcode`、`coverage` 是本地生成物，`docs/changes/archive` 是受控归档；导出不会自动提交或发布。

### D4. 消除动态计数高 churn

涉及 docs-consistency 逻辑/CLI、README、AGENTS、CONTRIBUTING、INSTALL、SKILL、command-reference 和对应测试。

- 保留 `check-docs-consistency --json` 的真实 `dynamicMeasurements` 输出和 fail-closed 采集；移除活体文档中重复的 `55 files / 1002 tests` 等硬编码计数要求，改为稳定语义和「以命令输出为准」。
- 静态规范违规与动态测量违规继续分组输出；动态测量只由真实 Vitest/provenance 输入产生，不能由文档文本反推。
- 增加文档回归测试：新增测试文件不会要求同步多份数字；缺失/损坏 Vitest 事实包仍 exit 1。

## 验收顺序

每批完成后按范围执行：

1. 批次 A：状态写入、wm-write CLI、平台 hook/安装器、pre-push 静态和供应链测试。
2. 批次 B：gate-log/run-log、Schema 注册、runSync、artifact-gate、BDD/TLA sync 定向测试。
3. 批次 C：四 Persona 真实 CLI、SSoT 内链、README/INSTALL 文档契约、samples coverage。
4. 批次 D：退出策略、依赖边界、证据导出、动态计数定向测试。
5. 最终同一 reviewed HEAD 执行：
   - `npm run self-test`
   - `npm test`
   - `npm run typecheck`
   - `npm run lint:security`
   - `npm run check:docs-consistency`
   - `npm run check:gate -- --validate-templates`
   - `npm run check:samples-coverage`
   - `npm run prepush`
   - 四个 Persona 的真实 CLI smoke tests
   - 状态竞争、gate-log/run-log 交叉读取、required TLA/BDD 证据、证据导出篡改验证

## 完成标准

- 任何 `--no-backup` 读回失败都不会丢失原目标或改变原本不存在状态。
- 两个独立 writer 使用同一旧 mtime 时不能双成功；锁 token/陈旧锁恢复不会误删新 owner。
- pre-push 不会联网安装、打包、解包或覆盖 `node_modules`；配置、根脚本和 lockfile 变更都会触发门禁；显式安装可验证 lockfile integrity、包路径和模块加载。
- writer 产生的 gate log 能被 Schema 校验并被 `check-run-log` 正确提取 exitCode；损坏/不可读证据不会静默放行。
- 项目阶段门真实传递并强制 TLA/BDD 证据和 TLA↔BDD 同步；pre-push fixture 仍保持轻量回归边界。
- 所有生产 CLI 的默认/JSON 输出和 exit 0/1/2 协议保持兼容且自然退出；生产同步子进程有明确 timeout。
- 四个 Persona fixture 真实 CLI 全部通过；SSoT 内链无断链；动态计数不再复制到多份活体文档。
- 全量测试、类型、安全、文档、模板、样本和 pre-push 门禁在同一 reviewed HEAD 上通过，并有可复核证据。
