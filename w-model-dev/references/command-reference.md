# `/wm` 命令参考

> 仅在执行 `/wm` 命令时读取。本文件定义输入、输出、失败动作和状态更新；阶段内容仍以对应 `phase-N-*.md` 为准。
>
> **编排者-子代理边界**：所有实施动作（产出 / 评审 / 门禁）由子代理执行，编排者（O）只路由 + CHECKPOINT + 状态持久化 + 只读脚本。详见 [subagent-delegation.md](subagent-delegation.md)。下表「执行方」列标注每个动作由哪个角色执行（O / S / V / G / A / R；A 阶段 1-4 ingestion 分派、R 返工/预防性审查分派）。

## 目录

- 通用命令规则
- `/wm analyze`、`design`、`code`、`test`
- `/wm review`、`status`、`metrics`、`hill-climbing`、`help`
- `/wm reset`、`export`、`import`

## 通用命令规则

1. 编排者（O）先读取 `.w-model/project.json` 与 `.w-model/rtm.json`；首次 `/wm analyze` 可初始化。**编排者只可读取/更新状态文件，不得修改 RTM 实体字段**（实体字段由 S 子代理更新）。
2. 编排者（O）检查命令所需上游阶段产物；缺失时拒绝执行并给出返回命令。
3. 编排者（O）只加载 `SKILL.md` + 当前阶段 `phase-N-*.md` 摘要 + `rtm-guide.md`；阶段细则由 S 子代理按需加载。
4. 编排者（O）所有状态写操作完成后同步 `updatedAt`；只有阶段放行后才更新 `status`。
5. 编排者（O）所有 `.w-model/*.json` 写入统一经 `wm-write.ts`：`<target>.lock` 持久目录与可转移 owner 对象在跨进程锁内保护 mtime 校验、毫秒+UUID 备份、tmp+rename、回读与原子恢复；`mtime` 乐观锁只在该锁内做版本冲突检测，**不足以**单独保证并发安全、竞争写处理或并发处理。`--expect-mtime` 接受有限非负数并向下取整；`--lock-timeout <ms>` 必须为安全非负整数；CLI 检出陈旧锁时，未显式传 `--recover-stale-lock` 即以 `STALE_LOCK` / exit 1 拒绝写入。直接调用 `writeStateJson` 为兼容既有调用仍允许隐式 stale recovery。
6. **docs-consistency 的明确句式契约边界**：门禁仅拒绝集中维护、逐条测试的禁止句式（限 pre-push / 平台检查的自动安装主张，以及已列明的 mtime 错误安全主张），不声称理解所有自然语言；清单外的复杂语义矛盾由 V review 评审。默认/`platform-deps:check` 始终只读；`platform-deps:install` 仅由用户显式调用，在 Windows x64 / Linux x64 的 caller-owned 私有 staging 内校验并安装缺失包。归档 bytes/路径/PAX/GNU/link metadata 不可信，完整 canonical preflight 必须先于 extraction write；同 UID/同访问令牌进程主动 rename 或篡改 staging/repo/lockfile/tarball/`node_modules` 属于受信运行主体之外的边界，不提供原子 namespace 保证。
7. **实施动作分派**：产出由 S 子代理执行；评审由 V 子代理执行；门禁由 G 子代理执行。编排者越权实施命中反模式 #10（见 [hard-constraints.md](hard-constraints.md) #10）。

> **本地生成物与审计证据**：`coverage/`、`.zcode/` 与 `.w-model/` 是 **Git 忽略** 的本地生成物，不应强制提交；`.w-model/` 可含运行期状态与审计证据，默认不随 Git 交付。需要交付时先运行 `npm run wm:verify-evidence-source -- <project-dir>` 由 producer 重建并写入 source-bound provenance，再运行 `npm run wm:export-evidence -- <project-dir> <output-dir>` 生成脱敏、带 SHA-256 manifest 的证据包；`wm-export-evidence --verify` 默认仅做 package-only 校验，传 `--source-project` 才做 source-bound 重验；导出后仍须按项目安全策略审阅，且不会自动提交或发布。受控且被跟踪的历史归档是 `docs/changes/archive/`，与本地 `.w-model/` 不同。

### D2 自然退出契约边界

D2 的可执行范围分三层：`logic/`、`lib/` 与生产 CLI 入口均不直接调用 `process.exit()`；调用 `gate-report` 的 `check-*.ts` 以及 metrics/security/status/ensure/self-test 等 runner 只输出报告或诊断，由调用方设置 `process.exitCode` 后自然返回，保留 exit `0/1/2` 与 stdout/`ERROR_JSON` 协议。参数/输入错误仍通过 `exitWithError(...)` 设置 exit `2` 并输出结构化 `ERROR_JSON`，不通过直接退出截断输出。

以下生产 CLI 均受自然退出契约约束：

| 脚本                       | 适用结果状态 | 退出实现                                                                |
| -------------------------- | ------------ | ----------------------------------------------------------------------- |
| `ensure-codegraph-opsx.ts` | 0 / 1 / 2    | 外部依赖检测结束后设置 `process.exitCode`，自然返回                     |
| `metrics-report.ts`        | 0 / 2        | 报告输出完成后设置 `process.exitCode=0`，自然返回                       |
| `security-scan.ts`         | 0 / 1 / 2    | 扫描/重生成结果设置 `process.exitCode`，自然返回                        |
| `self-test.ts`             | 0 / 1        | 汇总或未预期异常设置 `process.exitCode`，自然返回                       |
| `wm-status.ts`             | 0 / 2        | 状态输出或未初始化提示设置 `process.exitCode=0`，自然返回               |
| `check-pollution.ts`       | 0 / 1 / 2    | 扫描与单行 `POLLUTION_JSON` 输出完成后设置 `process.exitCode`，自然返回 |

生产 CLI 的 exit `1` 仅适用于具有校验失败/检查点结果的 runner；metrics-report 与 wm-status 没有 exit 1 结果分支，输入错误统一为 exit 2。测试工具、fixtures 与 `exitWithError` 的结构化错误处理不属于生产 CLI 直接退出静态检查范围。新增生产 CLI 或结果分支时，须更新自然退出契约测试。

### L0/L1 链接边界审计

- **权威定义**：分层语义与审计边界的权威定义见仓库 `docs/skill-design-document_SSoT.md` §3.5；本节为实现与用法说明。
- **速查行**：`npm run audit:l0-links [-- --root=<skill-root>]`
- **执行方**：仓库维护者只读执行；不写入 skill 包、项目状态或证据目录。
- **参数**：`--root=<skill-root>` 可选，默认 `w-model-dev`；仅接受该参数，未知/重复/空值为 `ARG_INVALID` / exit 2。
- **通过语义**：仅现存 `scripts/`、`samples/`、`tools/` 目标可归类为 L1-only；仅 `templates/` 源文件中的 `{{module}}` 链接可归类为模板占位；必需 L0 根/目录缺失、包外真实路径或 symlink/junction、其他断链和分发边界均为 violation / exit 1。
- **输出**：exit 0/1 的 stdout 为单行 `L0_LINK_AUDIT_JSON {type,passed,skillRoot,relativeLinkCount,l1OnlyCount,templatePlaceholderCount,violations,exitCode}`；exit 2 同时在 stderr 输出人类消息、stdout 输出带 `category`/`message`/`exitCode` 的 `ERROR_JSON` 单行摘要。
- **可执行示例**：默认当前 `w-model-dev` 使用 `npm run audit:l0-links`；显式 skill 根使用 `npm run audit:l0-links -- --root=<skill-root>`。缺少 `SKILL.md` 或任一 L0 根目录、任何 L0/L1 symlink/junction、包外 realpath、非法 URI 编码和未允许 broken link 均为 exit 1；未知参数为结构化 `ERROR_JSON` / exit 2。
- **已知近似**：URL 内含 `)` 的行内链接与 `%23`/`%2F` 转义不解码；reference-style 定义已采集（含冒号后无空白与下一行目标两种形态，下一行目标仅接受 / ./ ../ < 起始）。
- **guide 链接**：[toolbox.md](toolbox.md)（审计入口）与 [quickstart.md](quickstart.md)（L0/L1 分层语义）。

> 每个命令统一为「四件套」：**速查行**（一行用法）→ **参数表**（参数/必填/取值/默认/说明）→ **失败动作**（失败时的处理）→ **guide 链接**（相关 references/*.md 指南）。

### 证据 provenance 与导出验证

- **producer+verify**：`npm run wm:verify-evidence-source -- <project-dir>` 不是只读查询；它重建并校验当前 HEAD、run-log、passed gate-log、signature-chain 与 source bundle，成功后原子写入 `.w-model/evidence-provenance.json`。缺少或失败的真实运行证据时拒绝写入 `verificationStatus=passed`。
- **package-only**：`npm run wm:export-evidence -- --verify <manifest>` 只验证包内 schema、文件清单、hash、路径和脱敏内容，返回 `verificationLevel=package-only`，不证明源项目仍匹配。
- **source-bound**：追加 `--source-project <project-dir>` 后，verify 会重建 source provenance，并比较当前 HEAD、run/artifact 身份、五类 measurements（含 codegraph-queries）、source bundle hash 与 producer 版本，返回 `verificationLevel=source-bound`。

### `check-run-log.ts` lifecycle diagnostics

`npx tsx w-model-dev/scripts/cli/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>] [--json]` 保持 exit `0=通过`、`1=真实生命周期/门禁违规`、`2=输入错误`。phase 8 的 lifecycle reducer 以完整 `(phase, round, reportId, targetKind, basedOnReport, implementationTarget)` 关联记录：rootcause V/G 仅匹配同 reportId/round/targetKind，fix 与 implementation V/G/R3 只接受 exact target/artifacts 关系，rootcause review 不计 implementation V。R3 completeness/reliability/security 仅在同身份 `S-fix → R3×3 → implementation V` 窗口计数，R8 在 segment 内校验，禁止 phase/round bucket 或 phase-wide 首索引误关联。

**输入 fail-closed 与坏行语义（2026-09-04 audit-gate-closure）**：run-log 为空、空白、malformed-only 或 valid+malformed → exit 1——parseErrors 从纯 diagnostics 并入 **blocking violations**（消息保留 `PARSE_INCOMPLETE` 前缀：`PARSE_INCOMPLETE: line N ...; blocking（坏行使 run-log 输入不完整，fail-closed）`）；`checkRunLog([])` 直接返回 `passed=false` + `NOT_CLOSED_NOT_PROVEN`。动作-角色配对（`r3-*`→R、`fix`/`emergency-fix`/`produce`→S、`review`→V、`gate`/`tla-gate`/`graph-gate`→G）blocking 强制；`action=emergency-fix` 强制 `variant=emergency-fix` + `blocker` 非空（schema），`action=fix` 的 `variant` 可选（出现必须为 `"fix"`）。缺 identity 字段的历史行（含双 legacy 缺 identity+variant 的旧 emergency-fix 行）经合并 legacy 谓词吸收为 **LEGACY_VARIANT / LEGACY_UNSCOPED** 非阻断 diagnostic（`--json` 与默认 `RUN_LOG_JSON` 均展示合并的 deferred diagnostics）；legacy 证据只作诊断，不进入 R3/V/R8 credit。历史兼容：未声明 variant 的历史 emergency-fix 记录由 check-run-log 以 LEGACY_VARIANT 非阻断 diagnostic 吸收（exit 0 + NOT_CLOSED_NOT_PROVEN）；新记录必须声明 variant 且 emergency-fix 须附 blocker。`fix` 与 `emergency-fix` 都要求 `basedOnReport` 和非空 `artifacts`。**reworkHints 强制（2026-09-06 audit-fixes）**：`action ∈ {review, iceberg-review}` 且 `passed=false` ⇒ `reworkHints` 非空（schema allOf 强制；缺失或空数组均拦截），与 variant 规则同窗复用 `LEGACY_VARIANT_CUTOFF='2026-09-01T00:00:00Z'` 分界——cutoff 前失败 review 旧行以 `LEGACY_REWORK_HINTS` 非阻断 diagnostic 吸收，cutoff 后 blocking `[rework-hints] 条目 N <action> passed=false 须带非空 reworkHints`。**revertEvidence 回滚证伪强制（P2-B / S27 / AC-8）**：`action ∈ {fix, emergency-fix}` ⇒ 须携带合法 `revertEvidence.command`（非空字符串；S-fix 复现测试的回滚证伪声明——执行 command 使复现测试回到失败态；schema 层 optional 只登记形态，逻辑层 R10 强制）。分界常量 `LEGACY_REVERT_EVIDENCE_CUTOFF='2026-09-15T00:00:00Z'`（`run-log-logic.ts`，P2-B 计划合并日）：cutoff 前写入的旧 fix 行缺合法声明以 `LEGACY_REVERT_EVIDENCE` 非阻断 diagnostic 吸收（exit 0 + NOT_CLOSED_NOT_PROVEN），cutoff 后缺失/非法 → blocking `R10: <action> 动作 <runId> 须携带合法 revertEvidence.command…`；timestamp 缺失/非法时视为 cutoff 后（保守不吸收）。摘要 JSON（`--json` 与 `RUN_LOG_JSON` 一致）带 `r10` 计数字段：`{checked, missing, legacy}`（checked=校验的 fix/emergency-fix 条数，missing=缺合法声明条数，legacy=按 cutoff 吸收条数）。生命周期状态统一为 `CLOSED_UNDER_CURRENT_RULES` 或 `NOT_CLOSED_NOT_PROVEN`；exit 0 仍可能是 `NOT_CLOSED_NOT_PROVEN`，不能单独证明 lifecycle closed。checker 只读 raw append-only JSONL，不追加、删除、重排或编辑历史行。

### Source-bound provenance 边界

`evidence-provenance.schema.json` 登记受控本机的 source provenance；`npm run wm:verify-evidence-source -- <project-dir>`（`wm-verify-evidence-source.ts`）是 producer+verify 命令，会生产并验证 source provenance。`wm-export-evidence --verify` 在没有 `--source-project` 时只能是 package-only；只有传入 `--source-project <project-dir>` 才能执行 source-bound verify。受控本机 provenance 通过当前 HEAD、source hash、run 身份和 gate measurements 提供流程完整性；它不是密码学签名，也不是第三方不可抵赖证明。package-only 不能表述为 verified source 证据。

## `/wm analyze <需求>`

- **速查行**：`/wm analyze <需求>`
- **参数表**：

| 参数     | 必填 | 取值         | 默认 | 说明                                   |
| -------- | ---- | ------------ | ---- | -------------------------------------- |
| `<需求>` | 是   | 需求描述文本 | —    | 需求描述、业务背景；首次进入还需技术栈 |

- **失败动作**：信息不足时列出缺失项并暂停，不得猜测关键业务规则；普通评审失败必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），不得直接分派 S。
- **guide 链接**：[phase-1-requirements.md](phase-1-requirements.md)（阶段 1 需求分析）、[rtm-guide.md](rtm-guide.md)（RTM 映射）、[ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md)（ingestion 子流程）。

- **路由**：阶段 1 需求分析。
- **执行方**：O 路由 + CHECKPOINT → **S 产出** → **V 评审** → **G 门禁** → O 持久化。
- **输入**：需求描述、业务背景；首次进入还需技术栈。
- **读取**（S 子代理）：`phase-1-requirements.md`、`rtm-guide.md`、需求与测试模板。
- **产出**（S 子代理）：需求规格、验收测试设计、风险清单、RTM 初始映射。
- **评审**（V 子代理）：按 `targetKind=requirement` 路由 Persona，产出 `VerifierOutput` JSON。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts`，回填 `{exitCode, qualityLevel, passed, reworkHints}`。
- **ingestion**：触发 A 角色 ingestion 子流程（`plan-chunks` → A-chunk → A-cross → G 图谱校验 → 收敛循环），产出 `graph.json`（REQ 节点）；A→S 路径——先由 A 收敛图谱（连通 + 单根），再分派 S 读 `graph.json` 产出需求规格。详见 [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md)。
- **状态**（O）：初始化为“需求分析”；阶段门与用户均放行后才更新为“系统设计”。

## `/wm design type=<架构|概要|详细>`

- **速查行**：`/wm design type=<架构|概要|详细>`
- **参数表**：

| 参数   | 必填 | 取值                       | 默认 | 说明                                                  |
| ------ | ---- | -------------------------- | ---- | ----------------------------------------------------- |
| `type` | 是   | `架构` \| `概要` \| `详细` | —    | 设计类型；`架构`→阶段 2、`概要`→阶段 3、`详细`→阶段 4 |

- **失败动作**：`type` 缺失/非法返回合法值；上游产物缺失则拒绝跳阶段；普通评审失败必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），不得直接分派 S。
- **guide 链接**：[phase-2-system-design.md](phase-2-system-design.md) / [phase-3-outline-design.md](phase-3-outline-design.md) / [phase-4-detailed-design.md](phase-4-detailed-design.md)（对应设计阶段）、[graph-guide.md](graph-guide.md)（图谱演进）。

| `type` | 路由            | 必需上游产物   | 同步测试设计 |
| ------ | --------------- | -------------- | ------------ |
| `架构` | 阶段 2 系统设计 | 已放行需求规格 | 系统测试     |
| `概要` | 阶段 3 概要设计 | 已放行系统设计 | 集成测试     |
| `详细` | 阶段 4 详细设计 | 已放行概要设计 | 单元测试     |

- **执行方**：O 路由 + CHECKPOINT → **S 产出** → **V 评审** → **G 门禁** → O 持久化。
- **产出**（S 子代理）：对应设计文档 + 同步测试设计 + RTM 设计/接口/详细列。
- **评审**（V 子代理）：按 `targetKind=design` 路由 Persona（系统设计可选 security-auditor 架构评审）。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts` 回填证据。
- **ingestion**：触发 A 角色 ingestion 子流程（S→A 路径——S 先产出正式设计文档，再 A-chunk 分块 → A-evolve 图谱演进 → G 跑 `check-requirement-graph.ts` → 收敛循环）；按 `type` 追加对应节点到 `graph.json`：`架构`→SD 节点（implements 校验）、`概要`→INTF 节点（defines 校验）、`详细`→DD 节点（realizes 校验，零违反硬约束才放行进编码）。详见 [graph-guide.md](graph-guide.md)。
- **状态**（O）：对应阶段门与用户放行后才切换到下一阶段。

## `/wm code <功能>`

- **速查行**：`/wm code <功能>`
- **参数表**：

| 参数     | 必填 | 取值         | 默认 | 说明             |
| -------- | ---- | ------------ | ---- | ---------------- |
| `<功能>` | 是   | 功能描述文本 | —    | 待编码实现的功能 |

- **失败动作**：没有详细设计时拒绝编码并引导 `/wm design type=详细`；测试/编译/lint 失败作为 R 定位线索，普通 V/G 失败必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），不得直接分派 S 或回编码。
- **guide 链接**：[phase-5-coding.md](phase-5-coding.md)（阶段 5 编码实现）、[rtm-guide.md](rtm-guide.md)（RTM 代码列）、[quality-standards.md](quality-standards.md)（质量检查）。

- **路由**：阶段 5 编码实现。
- **执行方**：O 路由 + CHECKPOINT → **S 产出代码 + 单测 + 跑测试运行器 + RTM 代码列** → **V 代码审查** → **G 门禁** → O 持久化。
- **前置**：存在已放行详细设计和单元测试设计。
- **读取**（S 子代理）：`phase-5-coding.md`、`rtm-guide.md`；质量检查时追加 `quality-standards.md`。
- **产出**（S 子代理）：实现代码、单元测试、测试与覆盖率输出、代码检查结果、RTM 代码映射。
- **评审**（V 子代理）：按 `targetKind=code` 路由 `code-reviewer` Persona（五轴评审）。
- **门禁**（G 子代理）：跑 `check-verifier-output.ts` 回填证据。
- **状态**（O）：代码评审、单元测试和覆盖率门槛均满足且用户放行后才能进入“集成测试”。

## `/wm test type=<类型> result=<pass|fail>`

- **速查行**：`/wm test type=<类型> result=<pass|fail>`
- **参数表**：

| 参数     | 必填 | 取值                                 | 默认 | 说明                         |
| -------- | ---- | ------------------------------------ | ---- | ---------------------------- |
| `type`   | 是   | `单元` \| `集成` \| `系统` \| `验收` | —    | 测试类型                     |
| `result` | 是   | `pass` \| `fail`                     | —    | 测试结果，必须与测试输出一致 |

- **失败动作**：`result` 缺省或与测试输出冲突时拒绝回填；未执行即标通过、LLM 估算结果、把 pending 当 passed、**编排者越权回填 RTM 实体**（反模式 #10）均禁止。
- **guide 链接**：[phase-6-integration-test.md](phase-6-integration-test.md) / [phase-7-system-test.md](phase-7-system-test.md) / [phase-8-acceptance-test.md](phase-8-acceptance-test.md)（对应测试阶段）、[rtm-guide.md](rtm-guide.md)（RTM 执行结果回填）。

- **执行方**：O 路由 + CHECKPOINT → **S 执行测试运行器 + 回填 RTM 执行结果** → **V 评审测试报告** → **G 门禁**（阶段 5~8 跑 `check-artifact-gate.ts --phase=N`）→ O 持久化。
- **必要证据**（S 子代理产出）：测试命令、退出码、`passed/failed/pending`；单元测试还需覆盖率。
- **真实回填**（S 子代理）：`result` 必须与测试输出一致；缺证据或冲突时拒绝回填。**编排者不得直接回填 RTM 执行结果**。
- **测试执行证据**（S 子代理，M07 起）：更新某层 `executionSummary.<type>Test` 时须同时登记 `evidence`——`command`（非空，禁 `;` `&` `|` `<` `>` 与换行）、`exitCode`（非负整数）、`observedAt`（UTC ISO-8601 毫秒）；可选 `rawOutputPath`（项目根相对路径）与 `rawOutputSha256`（64 位小写十六进制）**须成对登记**。输出文件与哈希是**可选**的，不登记即不触发哈希核验；字段形态与规则见 `rtm-guide.md`「测试执行证据（M07）」节。
- **证据校验**（G 子代理，M07 起）：`check-artifact-gate.ts --phase=N`（阶段 5~8）校验四条规则——E1 配对、E2 哈希核验（相对项目根解析、文件须存在、SHA-256 须相符）、E3 结果一致性（`failed=0 && pending=0` ⇒ `exitCode=0`；`failed>0` ⇒ `exitCode≥1`；`failed=0 && pending>0` 不约束）、E4 存在性（`lastUpdated` 不早于 cutoff 时，当前阶段层只要 `total>0` 就必须带 `evidence`）。任一违规 → 退出码 1。
- **旧项目 cutoff 吸收**（G 子代理）：`rtm.json.lastUpdated` 早于 `2026-09-15T00:00:00Z`（M07/D-2 生效日）的 RTM 缺 `evidence` 时输出 `LEGACY_TEST_EVIDENCE` 非阻断诊断（不改变退出码）；`lastUpdated` **缺失或不可解析**按 cutoff 后处理（**保守不吸收**），仍须携带证据。
- **`pass`**（S 子代理）：仅将实际通过用例标为通过，并更新 `executionSummary.<type>Test`。
- **`fail`**（S 子代理）：记录失败用例、根因和关联模块，更新 RTM，按阶段参考回退。
- **评审**（V 子代理）：按 `targetKind=test` 路由 `test-engineer` Persona。
- **门禁**（G 子代理）：阶段 1~7 跑 `check-verifier-output.ts`；阶段 5~8 另跑 `check-artifact-gate.ts --phase=N`（M07 起含测试证据 E1~E4 校验，`GATE_JSON.testEvidence` 为 8 键计数对象——完整形状与「`testEvidence.legacy`（数值）vs 顶层 `legacy`（非阻断诊断数组）」的区别见 `rtm-guide.md`「测试执行证据（M07）」节；给定 `--tickets` 时另含 `GATE_JSON.tickets:{checked,criticalMissing,buildabilityMissing}`，见下「Artifact Gate 项目阶段证据门」节）。
- **产出**（S 子代理）：使用 `templates/test-report.md` 生成测试报告。

## `/wm review <target>`

- **速查行**：`/wm review <target>`
- **参数表**：

| 参数       | 必填 | 取值                                                 | 默认 | 说明                     |
| ---------- | ---- | ---------------------------------------------------- | ---- | ------------------------ |
| `<target>` | 是   | `REQ-*` \| `DESIGN-*` \| `UAT-/ST-/IT-/UT-*` \| code | —    | 评审目标；按前缀识别类型 |

- **失败动作**：编排者不得自评（反模式 #10）——评审必须分派 V 子代理执行；qualityLevel C/D 视为 V/G 失败 → 走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），`reworkHints` 仅交 R 作定位线索，S-fix 按 R 报告执行修复，不得直接分派 S。
- **guide 链接**：[verifier-spec.md](verifier-spec.md)（子标准与提示词占位符）、[subagent-delegation.md](subagent-delegation.md)（V 分派边界）。

返回评审指引，不由命令本身调用 LLM。**编排者不得自评**——评审必须分派 V 子代理执行（反模式 #10）：

1. 编排者（O）按前缀识别目标：`REQ-` → requirement；`DESIGN-` → design；`UAT-/ST-/IT-/UT-` → test；否则为 code。
2. 编排者（O）读取 `verifier-spec.md` 对应子标准与提示词占位符。
3. 编排者（O）输出 `targetKind`、目标、子标准、提示词占位符和以下命令：

```bash
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<output.json>"
```

4. 编排者（O）分派 V 子代理按 Persona 产出 `VerifierOutput` JSON，再分派 G 子代理跑上述命令。
5. 编排者（O）说明 A/B 且 `passed=true` 才能进入用户放行检查点；C/D 仅作为 R 定位线索，普通失败必须执行普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），不得直接分派 S。

**self-as-verifier 模式**（仅限 demo / 非生产 / 教学演示项目，生产项目禁止；前置：`project.status` 标记 `selfAsVerifier: true`，V 评审须切换 Persona 视角并在 `summary` 注明，详见 SKILL.md「self-as-verifier 模式」节与 verifier-spec §13）：单 Agent 兼任 S/V 时，V 评审后用 `--self-as-verifier --s-output=<S产出路径>` 校验 VerifierOutput 路径与 S 产出路径不同（反模式 #35）：

```bash
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<output.json>" --self-as-verifier --s-output="<S产出路径>"
```

### RootCauseReport R10 persona 合同

G 子代理在 V 复审根因报告后运行确定性根因报告门禁：

```bash
npx tsx w-model-dev/scripts/cli/check-rootcause-report.ts "<rootcause-report.json>"
```

R10 以 `testing-reality-checker` 为 canonical persona，要求其 `confidence >= 0.5`；已有合法归档中的 `reality-checker` 仅在 canonical 缺失时作 legacy fallback。canonical 与 legacy 同时出现时，canonical 优先；若两者指向同一 artifact，不重复计算 persona 语义；跨 artifact 或异常重复/冲突 fail-closed。该命令保持 `0=通过 / 1=校验失败 / 2=输入错误` 及既有 `ROOTCAUSE_JSON` / `ERROR_JSON` 输出合同。只有 G 返回 exit 0，且 R 报告已由 V 复审通过，才允许分派 S-fix；run-log 的中间态 exit 1 不得伪造为通过。

<r10-contract id="canonical-name" relation='{"canonicalPersona":"testing-reality-checker"}'>canonical persona is testing-reality-checker</r10-contract>
<r10-contract id="threshold" relation='{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}'>testing-reality-checker confidence >= 0.5</r10-contract>
<r10-contract id="legacy-fallback" relation='{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}'>legacy reality-checker is fallback only when canonical is absent</r10-contract>
<r10-contract id="same-artifact-dedupe" relation='{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}'>same artifact canonical-first and not counted twice</r10-contract>
<r10-contract id="cross-artifact-conflict" relation='{"artifactRelation":"different","conflict":"fail-closed"}'>different artifact conflict is fail-closed</r10-contract>
<r10-contract id="canonical-duplicate" relation='{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>canonical > 1 duplicate is fail-closed</r10-contract>
<r10-contract id="legacy-duplicate" relation='{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>legacy > 1 duplicate is fail-closed</r10-contract>

## `/wm status`

- **速查行**：`/wm status [--json]`
- **参数表**：

| 参数     | 必填 | 取值 | 默认 | 说明                                                 |
| -------- | ---- | ---- | ---- | ---------------------------------------------------- |
| `--json` | 否   | 标志 | 关闭 | 输出单行 `StatusReport` JSON（供展示证据或机器消费） |

- **失败动作**：退出码 2 = project/rtm JSON 损坏或 project.json 不符 `project.schema.json`（转 [operational-recovery.md](operational-recovery.md)，不得猜测状态）。
- **guide 链接**：[operational-recovery.md](operational-recovery.md)（JSON 损坏恢复）。

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/wm-status.ts <project-dir> [--json]`（project-dir 默认 cwd）：
  - 只读 `.w-model/project.json`（必读）、`.w-model/rtm.json` 与 `.w-model/run-log.jsonl`（缺失降级），输出：
    1. 当前阶段与 `updatedAt`；
    2. 已完成阶段数 / 8 与进度；
    3. RTM 已覆盖需求数 / 总需求数（coverageStatus=100% 计数）；
    4. 四级测试 `total/passed/failed/pending`；
    5. 最近 3 条动作；
    6. 确定性下一步建议。
- 退出码：0 = 正常（含未初始化提示「项目未初始化」）；2 = project/rtm JSON 损坏或 project.json 不符 `project.schema.json`（转 `operational-recovery.md`，不得猜测状态）。

> **project.json 读取口径（F-G4-14）**：全部读取侧（本命令 + 阶段门 `check-budget.ts --project=` / `check-maturity.ts --project=`）统一经 `project.schema.json` 校验（`loadAndValidate(file, 'project')`）——文件缺失（wm-status 的 ENOENT 视为「未初始化」exit 0 除外）、非法 JSON 或缺必填字段 / 枚举越界 / 多未知字段（`additionalProperties:false`）一律 `STRUCTURE_INVALID` / exit 2，不再 warn-and-skip；「合法 project 缺 updatedAt」场景已被 schema required 前置排除。

## `/wm metrics`

- **速查行**：`/wm metrics [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]`
- **参数表**：

| 参数      | 必填 | 取值     | 默认 | 说明              |
| --------- | ---- | -------- | ---- | ----------------- |
| `--from`  | 否   | ISO 时间 | —    | 起始时间窗口      |
| `--to`    | 否   | ISO 时间 | —    | 结束时间窗口      |
| `--phase` | 否   | 1-8 整数 | —    | 阶段过滤          |
| `--json`  | 否   | 标志     | 关闭 | 输出完整报告 JSON |
| `--out`   | 否   | 文件路径 | —    | 报告写入路径      |

- **输入错误处理**：退出码 2 = run-log 缺失 / `--phase` 非法 / JSON 损坏；先修正输入后重跑本命令。该纯报告无门禁语义，预算超限/返工超阈仅预警，拦截仍由 `check-budget.ts` 与门禁流程承担（反模式 #3/#6）。
- **guide 链接**：[hill-climbing-guide.md](hill-climbing-guide.md)（run-log 分析伴侣，指标映射注记）。

- **执行方**：O 只读，不分派子代理。
- 运行 `npx tsx w-model-dev/scripts/cli/metrics-report.ts <project-dir> [--from=ISO] [--to=ISO] [--phase=N] [--json] [--out=<path>]`：
  - 必读 `.w-model/run-log.jsonl`，可选读 `.w-model/budget.json`（缺失时预算区为 null）；
  - 输出 9 节流程度量摘要：总体（tokens/耗时/分派/返工）、阶段汇总、动作分布、角色分布、结果分布、门禁通过率、返工连续段、预算 burn rate 与 killSwitch 预警、预警列表；
  - `--json` 输出完整报告 JSON；`--out <path>` 写入文件；`--phase`/`--from`/`--to` 过滤。
- 退出码：0 = 生成成功（预警不改退出码）；2 = run-log 缺失 / `--phase` 非法 / JSON 损坏。

## `/wm hill-climbing`

- **速查行**：`/wm hill-climbing [--from=ISO] [--to=ISO] [--phase=N]`
- **参数表**：

| 参数      | 必填 | 取值     | 默认 | 说明         |
| --------- | ---- | -------- | ---- | ------------ |
| `--from`  | 否   | ISO 时间 | —    | 起始时间窗口 |
| `--to`    | 否   | ISO 时间 | —    | 结束时间窗口 |
| `--phase` | 否   | 1-8 整数 | —    | 阶段过滤     |

- **失败动作**：只产出改进信号，**不自动改 prompt/工具/验证规则**（反模式 #10）；外部 SkillOpt/darwin-skill 消费信号做演化，人审后手动应用。
- **guide 链接**：[hill-climbing-guide.md](hill-climbing-guide.md)（信号产出与消费）。

- **执行方**：O 确定性分析 run-log，不分派子代理；**无 LLM 调用**（约束 4：基于实际记录，不 LLM 估算）。
- **适用**：L2+ 项目（maturity.level ≥ L2）。
- 分析 `.w-model/run-log.jsonl`（可选 `--from=ISO` / `--to=ISO` 时间窗口、`--phase=N` 阶段过滤），产出 `HarnessImprovementReport`：
  1. 信号（signal）：类别 `prompt` / `tool` / `verification-rule` / `anti-pattern` / `maturity` / `budget`，严重度 S1-S3，含 run-log 证据引用与量化指标（occurrences/trend）；
  2. 元分析（metaAnalysis）：Top 失败模式、返工热点阶段、V-G 矛盾次数、预算消耗趋势、O 失败模式命中频次、acknowledgedDecisions 信息质量；
  3. 改进建议（recommendations）：promptTweaks / toolImprovements / verificationRuleTightening / candidateAntiPatterns / maturityAdjustments；
  4. 应用状态（applicationStatus）：人审后由用户填写 reviewedBy / appliedSignals / deferredSignals / rejectedSignals。
- 产出存 `.w-model/hill-climbing/<timestamp>-report.json`（符合 `hill-climbing-report.schema.json`）。

## `/wm help`

- **速查行**：`/wm help`
- **参数表**：

| 参数   | 必填 | 取值 | 默认 | 说明   |
| ------ | ---- | ---- | ---- | ------ |
| （无） | —    | —    | —    | 无参数 |

- **失败动作**：纯只读输出，不读取项目状态，无失败动作。
- **guide 链接**：[hard-constraints.md](hard-constraints.md)（反模式 #10 越权实施）、[subagent-delegation.md](subagent-delegation.md)（编排者-子代理边界）。

- **执行方**：O 只读，不分派子代理。
- 输出命令速查、阶段与测试对应关系，以及以下五条：测试设计前置、阶段门不可跳过、测试结果必须真实、退出码 1/2 不得放行、**编排者不得越权实施（反模式 #10）**。不读取项目状态。

## `/wm reset`

- **速查行**：`/wm reset`
- **参数表**：

| 参数   | 必填 | 取值 | 默认 | 说明   |
| ------ | ---- | ---- | ---- | ------ |
| （无） | —    | —    | —    | 无参数 |

- **失败动作**：用户拒绝时不修改文件，也不重复施压；执行前必须获得 CHECKPOINT 重置确认。
- **guide 链接**：[data-models.md](data-models.md)（保留/清空字段定义）。

- **执行方**：O 执行（仅状态文件操作，非阶段产物，不构成越权实施）。

> 🔴 **CHECKPOINT · 重置确认**：执行前展示将删除的实体和将保留的项目元信息，必须获得确认。

- **保留**：`id/name/description/techStack/createdAt`。
- **清空**：需求、设计、测试用例、RTM 实体与执行结果。
- **重置**：`status=需求分析`，刷新 `updatedAt`。

## `/wm export [输出目录]`

- **速查行**：`/wm export [输出目录]`
- **参数表**：

| 参数         | 必填 | 取值     | 默认                | 说明     |
| ------------ | ---- | -------- | ------------------- | -------- |
| `[输出目录]` | 否   | 目录路径 | `./w-model-export/` | 导出目录 |

- **失败动作**：校验聚合文件与独立文件实体数不一致时导出失败并列出差异；路径含空格时命令参数加双引号。
- **guide 链接**：[data-models.md](data-models.md)（导出文件 schema）。

- **执行方**：O 只读导出，不分派子代理。
- 默认目录 `./w-model-export/`。
- 生成 `project.json`、`rtm.md`、`requirements.json`、`designs.json`、`testcases.json`。
- 校验聚合文件与独立文件实体数一致；不一致时导出失败并列出差异。
- 输出路径、文件大小和实体数；路径含空格时命令参数加双引号。

## `/wm import <project.json>`

- **速查行**：`/wm import <project.json>`
- **参数表**：

| 参数             | 必填 | 取值     | 默认 | 说明                  |
| ---------------- | ---- | -------- | ---- | --------------------- |
| `<project.json>` | 是   | 文件路径 | —    | 待导入的 project.json |

- **失败动作**：校验失败列出字段路径和原因，退出码语义为 2，不写任何文件；`.w-model/` 已有数据时触发覆盖确认检查点，拒绝则不写入。
- **guide 链接**：[data-models.md](data-models.md)（必填字段/阶段枚举/实体枚举/ID 唯一性校验）。

- **执行方**：O 执行（仅状态文件操作）。

1. 编排者（O）按 `data-models.md` 校验必填字段、阶段枚举、实体枚举和 ID 唯一性。
2. 校验失败列出字段路径和原因，退出码语义为 2，不写任何文件。
3. `.w-model/` 已有数据时触发覆盖确认检查点；拒绝则不写入。
4. 确认后编排者（O）原子写入 `project.json` 与 `rtm.json`，刷新 `updatedAt`。
5. 输出项目名、阶段、需求数、测试用例数和 RTM 覆盖率。

## `/wm code-health <phase>`

- **速查行**：`/wm code-health <P1|P2|P3|P4>`
- **范围**：已实现并验收 Phase 1–4，以及 campaign 归档（真实 producer/consumer/verifier）。Phase 5–8 迁移**未实现**，不得据此执行迁移。`--verify` 不带 `--source-project` 只能是 package-only，须显式传 `--source-project` 才做 source-bound 重验（package-only 不得表述为 verified source）。`logic/code-health-phase-boundaries.ts` 占位模块已删除。
- **命令与退出语义**：

| 阶段            | CLI                         | 必填 / 关键参数                                                                                                                                                                                    | 退出码                                                                               |
| --------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P1 只读发现     | `code-health-phase1.ts`     | `--root <dir> --output <file> --scenario <file>`（`--platform` / `--shell` 可选）                                                                                                                  | 0 全部候选通过校验 / 1 候选校验失败或 revision 不可用 / 2 输入错误                   |
| P2 gap matrix   | `code-health-gap.ts`        | `--matrix <file> [--validate]`                                                                                                                                                                     | 0 通过 / 1 校验失败 / 2 输入错误                                                     |
| P3 受保护测试   | `code-health-tests.ts`      | `--inventory <file> [--ledger] [--project] [--candidate] --validate`；`--guard <file> --project <dir> --ledger <file>`                                                                             | 0 通过 / 1 校验或 guard 失败 / 2 输入错误                                            |
| P4 重复簇与抽象 | `code-health-duplicates.ts` | `--matrix <file> [--ledger <file>] [--root <dir>] [--validate]`                                                                                                                                    | 0 `under-review`/`deferred` / 1 `rejected` 或 guard 违规 / 2 输入错误                |
| ledger          | `code-health-ledger.ts`     | `init --ledger --campaign-id --baseline`；`append --ledger --candidate --event [--approval]`；`validate --ledger`                                                                                  | 0 通过 / 1 校验或拒绝 / 2 输入错误                                                   |
| 应用            | `code-health-apply.ts`      | `--candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run\|patch\|commit]`（`commit` 需人类 approval）                                                                                | 0 提案/应用成功 / 1 fail-closed / 2 输入错误                                         |
| 归档            | `code-health-archive.ts`    | `produce --campaign <dir> --output <dir> [--verification-level package-only\|source-bound] [--source-project <dir>]`；`verify --verify <package-dir> [--source-project <dir>] [--manifest <file>]` | 0 产出/验证成功 / 1 fail-closed（含 package-only 不得升级 source-bound）/ 2 输入错误 |

- **失败动作**：exit 1 走 code-health 失败链 `gate-failure → blocked → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework) → evidenced`（顺序不可跳过，见 [code-health-governance.md](code-health-governance.md) §6）；失败的删除/抽象必须回滚（`git apply -R` + `git diff --exit-code`=0）。exit 2 修正参数后重跑，不写任何文件。
- **CHECKPOINT**：候选进入实现前必须 🔴 CHECKPOINT 由 human 批准（精确 candidate ID / action / files / symbols / scopeHash）；工具或 LLM 输出不能授权。
- **边界**：Phase 1–4 只读（P1 仅写外部 report + `.w-model/` 独占 raw output；`--guard` 删除仅经 `code-health-apply.ts`）；code-health CLI 不纳入 `.githooks/pre-push`，19 项检查不变。
- **guide 链接**：[code-health-governance.md](code-health-governance.md)（Phase 1–4 操作参考）与 SSoT §10K（`docs/skill-design-document_SSoT.md`，权威定义）。

## Artifact Gate 项目阶段证据门

- **速查行**：`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] [--phase=N] [--cucumber-report=<path>] [--tickets=<path>] [--scope=<change-scope.json>|--change=<id> --base=<ref> --head=<ref>] [--json]`
- **S18 票据内容门禁（`--tickets=<path>`）**：对票据文件（`.w-model/tickets.md` 或 `docs/tickets.md`）做**符号级**内容校验——六条黑名单（① 占位短语 `TBD`/`TODO`/`implement later`/`fill in details` 等 / ② 无具体动作的祈使 / ③ 要求写测试但未给出测试符号或用例名 / ④ 以「类似任务 N」指代而无符号级重复说明 / ⑤ 只说要做什么不说怎么做 / ⑥ 引用任何任务中都未定义的 type/function/method）+ Buildability 三条负面判据（缺接口签名且缺验收标准 / 验收标准引用未定义符号 / 只给路径不给符号）。票据须点名**接口签名 / 类型约束 / 状态转移**或具体动作与产出物，**不要求文件路径或内联代码块**（与「票据内容 durability」一致；该改写是本仓库对源文的适配，非源文原义）。**判据口径（修复轮 1）**：① 票据块按模板形态 `# <NN> — <标题>` 或关键词形态 `# 票据 N` / `# Ticket N` / `# 任务 N` 识别，分节标题（如 `### 1. 步骤一`）**不计入** `checked`；② ⑥ 的「已定义」为**结构性**判定——span 自身带契约标注（`: T` / `→ b` / `-> T`）任意行成立；**声明式邻接**（专指契约标记词 `接口签名`/`类型约束`/`状态转移`/`符号契约`/`契约`/`定义`/`入参`/`出参` **紧邻** span 之前，中间仅允许空白/冒号/顿号/引号/括号等间隔符，形如「接口签名 + A.b(x)」「本票契约：+ A.b(x)」）上**裸符号与调用式一律算定义**（含空括号，声明式形态已明确是签名）；**`What to build` 字段行**（无声明式邻接）上**裸符号与带参调用式**（`A.b(x)`）算定义，**空括号调用式**（`A.b()`）不算；通用散文词（`返回`/`参数`/`签名`/`signature`/`returns`）**不参与**判定，且标记词出现在**否定/旁述**位置（如「无接口签名要求，调用 …」「沿用现有契约，调用 …」「…，不定义新类型」）**不算**声明 ⇒「只会调用从未声明」的符号仍被 ⑥ 拦下；③ ⑤ 命中时 Buildability① 缺签名**不重复计数**（同一根因，§0.1.5 不重复断言，理由文案内互指）。**参数契约**：`--tickets` **缺省时不触发票据校验**（既有调用方零影响，`GATE_JSON.tickets` 为 `null`）；仅适用 `--phase=5..8`（`--phase<5` 给定 → **exit 2 ARG_INVALID**，不静默忽略）；只接受等号形态 `--tickets=<path>`（空格形态 / 空值 → exit 2 ARG_INVALID），路径相对 project-dir 解析；文件不存在 → **exit 2 FILE_NOT_FOUND**；存在但校验失败 → **exit 1**（不新增 exit 码），违反以 `票据内容校验失败：…` 并入 reasons。`GATE_JSON`/`--json` 增 `tickets:{checked,criticalMissing,buildabilityMissing}`（结构照 M07 `testEvidence` 先例：`checked`=票据块数、`criticalMissing`=六条黑名单命中数、`buildabilityMissing`=Buildability 命中数；缺省不触发时为 `null`，键恒存在）
  - **S18 精确符号语义**：未定义判定使用 canonical symbol head。反引号 span 只提取 owner/member 调用头（也支持无 owner 函数名），规范化点号/调用空格并忽略嵌套泛型、参数和返回类型；定义 `Foo.run(job): Result` 只登记 `Foo.run`，因此 `Other.call(job)` 不会因共享参数 `job` 放行，而 `Foo.run(task)` 会匹配。不同 owner 的同名 method、无 owner 调用和重复定义均按完整 head 精确比较，错误信息保留完整未定义 span。契约标记词必须与 span 声明式邻接，否定/旁述不算声明；`What to build` 行允许裸符号与带参调用式定义，空括号调用式仍须被拦截。
  - **已知边界（确定性脚本固有，V 复核兜底）**：What-to-build 行的**裸符号**（无括号）、带返回标注的一级判定（`` `X(): void` ``）、**否定语素紧贴标记词**（「无接口签名：`X()`」）三类仍可能放行——V 评审 S-tickets 产出时按 `verifier-spec.md` §4.2.1 第 11 条核对兜底。
- phase 1-4 对项目 TLA/BDD 资产做 fail-closed 检查：`tla-manifest.json` 必须通过真实 schema 校验且 `specs` 非空；`bdd-manifest.json` 必须存在并通过 schema。调用 `check-bdd-model.ts` 时固定传递 `--require-tla-equivalence --tla-manifest=<项目路径>`。phase 1 不要求 graph，phase 2-4 在 TLA/BDD 证据基础上要求 graph。
- phase 5-8 固定传递 `--require-cucumber-report --cucumber-report=<路径>`；默认路径为 `<project-dir>/.w-model/bdd/reports/report.json`，也可用 `--cucumber-report=<path>` 覆盖。报告必须为合法 `{ elements: [...] }`，至少有命名 scenario 的 passed step，skipped/pending/undefined/unknown/failed 或畸形报告均阻断。
- **phase 5-8 变更上下文绑定（2026-09-04 audit-gate-closure）**：`--scope=<file>`（`schemas/change-scope.schema.json`）或薄封装 `--change/--base/--head` 必选——缺失 → **exit 1**（fail-closed，无变更上下文的相关查询/制品不放行）；仅支持 `--scope=<file>` 等号形态，空格形态按未提供处理（fail-closed exit 1）。scope 文件不存在/非 JSON/schema 违反 → exit 2；scope 已提供但 Git 绑定失败（headRef 不等于当前 HEAD、changedFiles 与实际变更集合不符、git 不可用）→ exit 1（以 `[scope]` 前缀并入 reasons，**不输出「未提供 --scope」误导文案**）。scope 通过后先跑 codegraph/opsx strict 校验，violations 并入 reasons/exitCode（不被 RTM 通过掩盖），`GATE_JSON` 含 `external` summary（codegraph `passed/violationCount/provided/changeId/requiredFileCount/coveredFileCount` + opsx `passed/violationCount/provided/changeId/changesNames`）。`--scope` 与 `--change/--base/--head` 互斥，同给 → ARG_INVALID / exit 2；薄封装须三者同时给出。archive（`check-openspec-archive.ts`）是 phase 8 `opsx:archive` 后置门，不在本 pre-archive gate 内强制（G 在归档后单独跑，见下节）。
- phase 1-4 的项目阶段门同时有两条不同证据路径：BDD D4 required equivalence 固定传 `--require-tla-equivalence --tla-manifest=<项目路径>`；独立文件级 pair sync 则仅在本阶段契约生效、TLA/BDD manifest 均通过真实 schema/资产校验、且 manifest 配对集合满足 TLA→BDD 与 BDD→TLA 双向覆盖时，按 pair 调用 `check-tla-bdd-sync.ts`。D4 不是 pair sync 的替代品，pair sync 也不是 D4 的替代品。
- 缺失/非法 JSON/schema 畸形/空资产/关联 `.tla`、`.cfg` 或 `.feature` 文件缺失均由各自 evidence gate 产生 blocking violation；不得把缺资产转化为 sync skip。配对孤儿、路径映射不完整、无完整 pair、转移/状态/不变式不一致或 sync 子进程失败同样阻断。phase 5-8 不启用该 TLA↔BDD 文件同步，改用 required Cucumber 执行证据。
- 该项目阶段门与本地 pre-push fixture 回归分层：pre-push 不调用本 CLI，不启用上述 project-only required flags，也不运行项目 TLA、TLA↔BDD pair sync 或 Cucumber 证据。

### §8 拒绝登记结构校验（M08，phase 1）

- **命令**：`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts <project-dir> --phase=1 --spec-dir=<dir>`。判据纯函数 = `w-model-dev/scripts/logic/gate-logic.ts` 的 `checkOutOfScopeRegister`，经 `checkPhaseSpecStructure` 在 phase=1 时并入 `RequirementSpecStructureViolations.outOfScope` 桶。**增强既有脚本：不新增 CLI、不新增参数、不新增 Schema。**
- **输入**：`--spec-dir=<dir>` 指向阶段 1 规格目录（含 `requirement-spec.md` 与 `discipline-dod.md`）。**未传 `--spec-dir` 时本项不生效**（既有调用方零影响）；非 phase 1（phase≥2 主文档的 §8 不是拒绝登记）时**不施加**该组判定。
- **判定**（与既有 `refs`（6 引用块）/ `ssot`（§0 四项）/ `dod`（DoD ≥ 8）三桶并列，既有三组判据逐字未改）：
  - (a) **§8 节缺失** → 违规（「无」也必须显式声明该节）；
  - (b) **§8 无固定列表格** → 违规。旧散文形态（节内含 `- {{`）的消息带迁移指引（「须表化：conceptKey / 拒绝理由 / Prior requests / 状态 / 来源」）；无表格的自由散文同样 fail-closed（自由散文无法承载结构校验）；
  - (c) **§8 有表格** → 校验表头**五列齐**（`conceptKey` / `拒绝理由` / `Prior requests` / `状态` / `来源`）、`conceptKey` **非空且唯一**、`状态` ∈ {`rejected`,`reconsidered`}、`Prior requests` 单元格**非空**（显式 `-` 合法）；另校验**至少 1 行数据行**（「无」也须保留一行 `-` 哨兵行，哨兵行豁免状态与回链校验）。缺列时该列的派生校验整体跳过（保证「恰好报该违规」）。
- **退出码语义**：任一 (a)(b)(c) 违规 → **exit 1**（并入既有 exit 1 语义，**不新增退出码**；输入/参数错误仍为 exit 2，不静默跳过）。
- **如何读证据（审查者裁定，必读）**：以 **`GATE_JSON.reasons` 中 §8 桶的计数 = 0** 判定合规——即 `reasons` 中以 `structure: §8` 开头的条目数为 0。**不得以整体退出码为据**：`check-artifact-gate.ts` 是**聚合门**，退出码是三态聚合结果，会被**无关缺件**（如 tla/bdd/uat 资产缺失、RTM 覆盖率不足）掩盖——「exit 0」不证明 §8 合规，「exit 1」也不证明 §8 违规（可能是别的原因）。使用 `--json` 时同样按同一字段与同一前缀定位。
- **判据强化披露（AC-11 义务）**：本项**不新增命令、不新增放行路径**，但**改变了「什么样的 phase-1 规格能过门」**——phase-1 规格从此**须含合规 §8 表格**，旧散文形态的 §8 不再放行；这属既有门禁的**判据强化（数据要求收紧）**，不是「门禁未变」。**不引入 legacy 时间豁免**：本仓零 `requirement-spec.md` 存量夹具、无迁移对象，而时间豁免会给「忘了写表格」开永久后门。
- **边界（不得夸大）**：门禁**只校验登记结构**；**「概念相似度」由需求入口读取动作的语义匹配承担**（A-chunk，见 `w-model-dev/references/ingestion-chunk.md`「需求入口读取动作（拒绝登记去重，M08）」节），确定性脚本**不校验语义**。门禁通过**不等于**去重已发生——两者是**结构门禁 + 语义读取**的分工（AC-10 措辞不得被夸大）。
- **失败处置**：exit 1 属普通 V/G 失败 → 先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再按 R 结论由 S-fix 补齐/表化 §8 后重跑门禁。登记规则权威细则见 `w-model-dev/references/phase-1-requirements.md`「拒绝登记规则（§8 Out of Scope，M08）」节。

## BDD 项目行为证据门

- **速查行**：`npx tsx w-model-dev/scripts/cli/check-bdd-model.ts <bdd-manifest.json> --phase=N [--require-tla-equivalence --tla-manifest=<path>] [--require-cucumber-report --cucumber-report=<path>] [--graph=<path>]`
- **参数表**：

| 参数                        | 必填           | 适用 phase | 缺失/错误行为                                                                         |
| --------------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------- |
| `--require-tla-equivalence` | 项目阶段门必填 | 1-4        | 缺少 `--tla-manifest` → D4 violation / exit 1；phase 5-8 使用 → exit 2                |
| `--require-cucumber-report` | 项目阶段门必填 | 5-8        | 缺少、非法形状或零执行 Cucumber 证据 → D5 violation / exit 1；phase 1-4 使用 → exit 2 |
| `--graph=<path>`            | phase>=2 必填  | 2-8        | 缺少 → exit 2（D8 数据源）                                                            |

- **参数完整性**：仅接受此速查行中的精确选项；require flags 必须是无赋值的裸 flag。`--require-…=true`、重复、拼写近似和未知 `--*` 均为 `ARG_INVALID` / exit 2，绝不降级为兼容 skip。
- **失败动作**：exit 1 视为普通 V/G 失败 → 先走普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节），再按 R 结论由 S-fix 修复/补齐项目工件后重跑门禁；required Cucumber 报告必须为 `{ elements: [...] }`，且至少一个非空 `name` 的 scenario element 含 `result.status="passed"`。`failed` 只作失败诊断，`skipped` / `pending` / `undefined` / 未知 status 和匿名 element 都不能满足证据并产生 D5 violation；manifest 有 features 时不能是零已执行 scenario。exit 2 时修正 CLI 参数组合后重跑。未传 require flag 时 D4/D5 保持兼容跳过并输出原因，只限技能包 fixture 回归或未启用阶段强制的调用。
- **边界**：本地 pre-push 直接运行的是技能包 `check-bdd-model` fixture 回归；它不直接运行 TLA、TLA↔BDD 同步或任何项目工件阶段门。项目阶段门才按成熟度传入上述 require flags 和真实工件。
- **guide 链接**：[bdd.md](bdd.md)（BDD 门禁调用）与 [tla-plus.md](tla-plus.md)（TLA+ / BDD 协作）。

## 需求覆盖分析门禁 CLI（check-requirement-coverage）

- **速查行**：`npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts <coverage.json> [--graph=<graph.json>] [--out-of-scope=<outOfScope.json>] [--exemptions=<granted.json>] [--json]`
- **C7 降级语义**：不传 `--graph` 时：crossCuts 空 → C7b blocking；非空 → C7 降级 warning 并在 JSON `skippedRules` 标记。

## 规则层覆盖口径门禁 CLI（check-coverage-scope）

- **速查行**：`npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts --report <coverage-final.json> --min-statements <n> --min-branches <n> --min-functions <n> --min-lines <n>`（五个值 flag 全部必需；`--flag=v` 与 `--flag v` 两形态等价；未知 / 重复 / 缺值 / 非负有限数值以外的阈值 → `ARG_INVALID` / exit 2）
- **用途**：规则层覆盖口径门禁（B，2026-09-17 审计）——vitest v8 provider 对被 import 文件总是出报告，全量运行分母混入 cli/application/infrastructure 层；本门禁绕开报告器行为，对 istanbul-lib-coverage 格式的 `coverage/coverage-final.json` 按 logic+lib 白名单前缀（`/w-model-dev/scripts/logic/`、`/w-model-dev/scripts/lib/`）重算 statements/branches/functions/lines（计数口径与合并规则见 `logic/coverage-scope-logic.ts` 头注）并强制阈值，独立于 vitest 全分母阈值（pre-push 覆盖率项）。
- **COVERAGE_SCOPE_JSON 字段**：`{fileCount, totals:{statements,branches,functions,lines}, files:[{file, statements|branches|functions|lines:{covered,total,pct}}], failures:[], passed, thresholds}`；`file` 为 `w-model-dev/scripts/` 之后的显示后缀（正斜杠），`files` 按 localeCompare 升序保证逐字节可复现；`totals` 为各文件 covered/total 求和后的加权 pct（两位小数，非百分比平均）。
- **退出码**：0=达标（stdout 单行 `COVERAGE_SCOPE_JSON`）/ 1=阈值不达（`passed=false` 且 `failures` 逐指标列出 `实际 < 阈值`）/ 2=输入错误（报告不存在或不可读 `FILE_NOT_FOUND`、非法 JSON `FILE_PARSE`、报告畸形 `STRUCTURE_INVALID`、**白名单零命中**（`fileCount===0`，include 前缀失配或报告为空）`STRUCTURE_INVALID` → ERROR_JSON）。

## 阶段 5-8 codegraph/opsx/archive 门禁 CLI（ChangeScope 绑定）

三个 checker 均接受同一套变更上下文参数（对应约束 #14 / 反模式 #38/#39/#40 与归档后置门）：

- **速查行**（阶段 5-8 均必选 scope，缺失 → exit 1；文件/JSON/schema/参数冲突 → exit 2；`--scope` 仅支持等号形态 `--scope=<file>`，空格形态按未提供处理）：
  - `npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts <project-root> --phase <5|6|7|8> --scope=<change-scope.json> [--json]`
  - `npx tsx w-model-dev/scripts/cli/check-opsx-artifacts.ts <project-root> --phase <5|6|7|8> --scope=<change-scope.json> [--json]`
  - `npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts <project-root> --phase <5|6|7|8> --scope=<change-scope.json> [--json]`
  - 薄封装：`--change=<changeId> --base=<ref> --head=<ref>`（须三者同时给出，与 `--scope` 互斥）以实际 Git 变更集合生成等价 scope，免维护 manifest。
- **codegraph checker**：校验 `.w-model/codegraph-queries/` 下 phase 前缀 = scope.phase 的查询记录（`codegraph-query.schema.json` 结构前置校验）——`changeId` 精确等于 scope.changeId（同 changeId 异 phase 前缀文件违规）、`targetFiles` 全部属于 scope.changedFiles 且非空、`queryTimestamp` 合法 ISO date-time 且不晚于 `scopeCreatedAt`；scope 中每个须覆盖的 code/test 变更文件至少被一个合法查询覆盖（未覆盖逐文件 violation）。缺 changeId/targetFiles 的既有查询逐文件 violation（不允许 silent skip）。
- **opsx checker**：strict 只校验 `openspec/changes/<changeId>/` 一个变更目录（制品 proposal/design/tasks/tickets + specs/）+ `.w-model/r3-reviews/phase<N>-<stage>-<dim>.md` ×9 + `.w-model/v-reviews/phase<N>-<stage>.md` ×3（stage ∈ explore/propose/coding）；`changeId` 不匹配任何 active 候选 → violation；存在多候选时按 `scope.changeId` 精确选择其一（不再任取第一项）；changeId 须含 `phase<phase>-` 前缀。strict 模式只校验 scope 选定的变更目录；同阶段其它半成品兄弟目录不在本 gate 扫描范围，每个 change 须各自执行 gate（与 SSoT §10.5.2 取舍一致）。
- **archive checker**：`openspec/changes/archive/` 下精确匹配 `<changeId>` 或 `<日期>-<changeId>`（日期前缀锚定 `<YYYY-MM-DD>-`，不再用未锚定正则），多匹配 → violation；制品 `proposal.md`/`design.md`/`tasks.md`/`tickets.md` + `specs/` 齐全；changeId 须含阶段前缀。archive 为阶段 8 `opsx:archive` 后置门（在归档完成后由 G 单独跑，不在 `check-artifact-gate.ts` pre-archive gate 内强制）。
- **GATE_JSON / 摘要**：codegraph 收尾 `CODEGRAPH_QUERIES_JSON`、opsx 收尾 `OPSX_ARTIFACTS_JSON`、archive 收尾 `OPENSPEC_ARCHIVE_JSON`（均含 passed/violations/exitCode，phase 5-8 strict 模式下额外含 changeId 与覆盖/制品计数）。
- **legacy 兼容层**：三脚本保留无 scope 的 legacy 纯逻辑入口（`checkCodegraphQueries` / `checkOpsxArtifacts` / `checkOpenspecArchive`，仅做目录/字段完整性或全扫描 entries[0] 判定），供 self-test 与 fixture 回归；CLI 阶段 5-8 一律走 strict（resolveCliScope → strict 函数）。
- **退出码判别**：CLI 参数互斥矛盾（如 `--change` 前缀与 `--phase` 不符）为 `ARG_INVALID`/exit 2；scope 文件内容与 Git 实际/CLI flag 冲突为校验失败 exit 1。重复值 flag（如 `--scope` 两次）为 `ARG_INVALID`/exit 2（值 flag 只允许出现一次，旧「取第一个/最后一个」语义已废除）；该语义 2026-09-06（D3/I-3）起全 CLI 生效——`--phase` 的重复与两形态（`--phase=N` / `--phase N`）校验由 `lib/parse-phase.ts` 统一检测，重复即错、非法值 ARG_INVALID，`check-bdd-model` / `check-preventive-review` 仍仅接受等号形态（裸 `--phase` → ARG_INVALID 并提示「--phase 仅支持等号形态 --phase=N」）。

## 污染源定位 CLI（check-pollution，S24）

- **速查行**：`npx tsx w-model-dev/scripts/cli/check-pollution.ts [--project=<dir>]`（`--project` 仅等号形态，缺省 cwd）
- **按需工具声明**：S24 **只作按需工具，不得当门禁**（规格 :187/:305）——不进 pre-push 19 项（`prePushCount: 19` 不变）、不进任何阶段门；exit 1 仅供人工二分定位参考。
- **检查对象**（规格 :206）：`.w-model/` 残留（`*.lock` 陈旧锁目录/文件）、`*.lock` 锁文件、`coverage/` 残留（含 `coverage/.tmp`）、vitest 语义污染形态（`--outputFile` JSON 残留等，项目根深度 1 名称白名单）；扫描剪除 `node_modules/` 与 `.git/`。判据纯函数在 `logic/pollution-logic.ts`。
- **「吞掉测试失败只看产物」语义**：逐文件定位「存在测试失败痕迹（锁残留 / 覆盖率产物 / vitest 输出 JSON）但工作区产物却被判通过」的污染形态——失败信号被吞掉、只留下产物；本 CLI 把这些痕迹逐项列出，供污染源二分定位使用。
- **退出码**：0=干净（stdout 单行 `POLLUTION_JSON {type,passed,project,findings,findingCount,exitCode}`）/ 1=发现污染源（逐项 `✗ [kind] path — reason` 列表 + `POLLUTION_JSON`）/ 2=输入错误（未知/重复 flag、`--project` 空值或不存在、多余位置参数 → `ARG_INVALID`/`FILE_NOT_FOUND`，在任何扫描前拒绝、零副作用）。

## Verifier 校准（**可选，非门禁**）

- **速查行**：无固定 CLI——校准由外部 Agent 按 [samples/verifier-calibration/README.md](../scripts/samples/verifier-calibration/README.md) 的步骤直接调用逻辑层函数（`checkVerifierOutput` / `checkRunLog`）跑锚定样本，比对 V 判定与人工 `expectedVerdict`。
- **明确非门禁**：校准集不产生 `exitCode`，不参与阶段门放行，**未接入 CI / pre-push / self-test**。理由：锚定正解由人标注，且校准需真实跑 LLM（外部 Agent 执行）——两者都不符合「确定性门禁」定义。把它说成门禁即为过度声明（verifier-spec.md §14.4）。
- **不得**把 `samples/verifier-calibration/` 的样本登记进 `self-test.ts`：登记即等于把它变成门禁；`check-samples-coverage.ts` 对该目录的豁免仅指「不要求 self-test 引用」，矩阵声明仍强制。
- **漂移面**：标注本身会过时（产物形态变化 / 标准修订）。校准报告能暴露漂移但不阻断流程——维护责任见该目录 README「已知漂移面」节。

## 错误码与 ERROR_JSON 约定

所有 check-*.ts 与工具脚本的 **输入错误（exit 2）** 输出统一结构：

- **stderr**（人类可读）：`✗ [CATEGORY] <message>: <file|detail>`（类别见下表；file 与 detail 同有则 detail 附于括号 `（detail）`，如 `✗ [STRUCTURE_INVALID] ...: C:\...\scope.json（/changedFiles/0: must match pattern [pattern]）`）
- **stdout**（机器可读，遵循 SSoT §10E E.1）：`ERROR_JSON {"category","message","exitCode","file?","rule?","field?","detail?"}`，`exitCode` 与 `process.exit()` 实参强一致；`file`/`rule`/`field`/`detail` 为可选字段，仅有值时输出（F-G6-02：detail——如 schema pattern 违规定位 `/changedFiles/0: must match pattern`——同时进入 stderr 与 ERROR_JSON，不再被 file 吞并）

| 类别                | 场景                                                                                                                                   | 示例                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `ARG_INVALID`       | 参数值非法（phase/variant/mode/node-type/max-tokens 等）                                                                               | `✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数`            |
| `FILE_NOT_FOUND`    | 文件/目录不存在（ENOENT）                                                                                                              | `✗ [FILE_NOT_FOUND] 文件不存在: C:\...\project.json`            |
| `FILE_PARSE`        | JSON 解析失败（含 JSONL 坏行）                                                                                                         | `✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: C:\...\rtm.json`   |
| `FILE_READ`         | 读取异常非 ENOENT                                                                                                                      | `✗ [FILE_READ] 文件读取失败: C:\...\x.json（EACCES）`           |
| `STRUCTURE_INVALID` | 合法 JSON 形状不符（顶层非对象/字段形状不符/类型错；如 state-machine 输入顶层必须为对象且四数组字段齐全、tla-manifest 顶层必须为对象） | `✗ [STRUCTURE_INVALID] 结构不符: C:\...\x.json（缺 rows 数组）` |
| `UNEXPECTED`        | 未预期异常（main().catch 兜底）                                                                                                        | `✗ [UNEXPECTED] 脚本异常: <message>`                            |

- exit 1（校验失败）结构不变：violations 列表 + 既有 `XXX_JSON` 摘要（含 exitCode=1），不输出 ERROR_JSON。
- 异常不变量：`ERROR_JSON.exitCode` 恒等于脚本 `process.exit()` 实参（§10E E.1 防伪三层机制）。
- 流分离：stderr 承载人类诊断（`✗ [CATEGORY] ...`），stdout 仅承载机器可读 `ERROR_JSON` 行——`ERROR_JSON` 同属 stdout JSON 摘要家族（§10E E.1），可被 gate-logs 存档后由 `check-run-log.ts` R6 交叉校验（`run-log-logic.ts` `extractExitCode` 26 个标记含 ERROR_JSON）。

## CHECKPOINT 统一清单

| CHECKPOINT           | 触发点                                      | 确认对象                                                                      |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| 项目初始化           | 首次进入阶段前（SKILL.md 执行工作流步骤 5） | 进入阶段 / 同步测试设计 / 预期产物清单                                        |
| ingestion 规划确认   | 阶段 1-4 plan-chunks 产出后（步骤 5.5）     | 分块计划与 A-chunk 分派                                                       |
| ingestion 收敛确认   | 收敛循环结束（MAX_ROUNDS=5 或通过）         | 图谱收敛结果                                                                  |
| 阶段门放行           | G 门禁通过后（步骤 9）                      | 质量等级 / 子标准分 / reworkHints → 放行或返工                                |
| 发布放行             | 阶段 8 终检 exitCode=0 后                   | RTM 覆盖率 / 四级测试 / GATE_JSON → 发布或回退                                |
| 重置确认             | /wm reset                                   | 清空实体不可逆操作                                                            |
| 导入覆盖确认         | /wm import 目标已有数据                     | 覆盖现有数据                                                                  |
| code-health 候选放行 | /wm code-health 候选进入实现前（human）     | candidate ID / action / 精确 files·symbols / scopeHash → approve·reject·defer |

### 提问与呈现规范（M04+S17）

**划界**：本节管「**怎么问、怎么呈现**」（提问写法与消息呈现格式）；紧随其后的 `### 裁决记录（Ruling）与穷尽上缴` 管「**裁决怎么记录**」（三段式留痕与穷尽上缴）。两者互补、不重叠——本节决定问题的形态与消息的形态，Ruling 节决定裁决的留痕。

#### M04 提问与呈现十条

1. **grill-the-send**：只问**用户能答**的问题。**可查的事实归 agent**——凡能自行查证的事实（读文件 / 跑脚本 / 查图谱）不得拿去问用户，先查完再问；问题里只留用户独有的信息（意图 / 优先级 / 价值 / 授权）。
2. **每题一想法，绝不复合**：一条消息只承载一个决策点；多个问题不得捆成一题（复合题会让用户只答一半，另一半被静默取默认）。
3. **答案 stub**：每题给出答案骨架 / 占位，用户只需填空或点选，不必从零组织措辞。
4. **按需一行 `_Why this matters_`**：问题影响不显然时，用一行斜体说明它为何影响决策；显然时省略，不是每题都写。
5. **明确鼓励 "I don't know"**：把「不知道 / 无偏好」写成**合法且被期待**的答案（显式列入选项），不得让用户因怕显得不知而勉强作答。
6. **每步自带 Done 判据**：每个问题自带「怎样算答完」的判据（答到什么颗粒度即可推进）；不含 Done 判据的问题不得发出。
7. **frontier**：
   - **frontier = 前提已解的问题集**：先解前提，再问依赖该前提的问题；前提未解的问题不进本轮。
   - **每题必给推荐答案**：必须给出编排者建议**并附理由**，不只给选项（只给选项等于把分析工作退回用户）。
   - **一轮一 frontier**：一轮只推进一个 frontier，不并行铺开多个前提未解的问题。
8. **找事实派子代理且不阻塞**：需要事实时派子代理去找，**当前用户决策不因此阻塞**——问题照常发出，事实回来后再作为后续输入补上。
9. **Push right**：问题可**重排到更靠后的位置**（等前提成熟再问），**绝不删除 CHECKPOINT**——完整口径见下「Push right（只重排位置，绝不删除 CHECKPOINT）」。
10. **Brief 三段式**：`what / why / link` 三段，**绝不抛原始输出**——完整口径见下「Brief 三段式」。

#### S17 呈现内核四条

1. **逐问判定「看见比读到更清楚吗」**：每一问单独判定呈现形态（表格 / 对比 / 示例 / 纯文本），形态由该问内容决定，不套统一模板。
2. **2-4 选项**：每题给 2-4 个可选项（少于 2 不构成决策，多于 4 超出一轮决策的承载量）。
3. **后撤屏**：推进到下一问时**显式作废上一问的呈现物**（明写「上一问已作废 / 以下取代之上」），不得让两轮呈现物并列，使用户对着过期选项作答。
4. **提议独占一条消息**：编排者的提议（推荐答案 + 理由）**独占一条消息**，不与多个问题或其他议题混排，避免推荐被淹没或被读成既有结论。

#### Push right（只重排位置，绝不删除 CHECKPOINT）

- **硬约束相容声明**：Push right **只重排位置，绝不删除 CHECKPOINT**。重排**不改变**「该问用户的事仍必须由用户裁决」，也**不得**让任何**只能由用户决定的事项**（阶段放行 / 发布回退 / 范围与预算变更 / 价值取舍）因重排而消失或降级为编排者自决。本规范与硬约束「CHECKPOINT 不可绕过」**显式相容**；借重排让上述事项不经用户即推进，命中反模式 #8（越过 CHECKPOINT 自动推进）与反模式 #10（编排者越权）。
- **台账冲突处置**：台账 S17「分节逐节批准」与 M04 Push right 冲突，裁定 **M04 胜**——**保留** Push right，**不采纳**分节逐节批准。

#### Brief 三段式

**Brief**（向用户呈现任何产出 / 状态时）：`what`（是什么）/ `why`（为什么）/ `link`（去哪看）三段，**绝不抛原始输出**——不把原始日志、diff、JSON dump 直接倒给用户；原始输出只作为 `link` 指向的落盘物，用户需要时自行调阅。

### 裁决记录（Ruling）与穷尽上缴

**裁决不因提问而停摆**：冲突、歧义、计划缺陷、计划/流程内部的**软**上限（「本应申请提额」的那类；硬预算门禁除外，见下）——由编排者就地裁决并继续推进（规格是约束性权威、计划是其论据，两者都未回答之处由裁决落定）。但每条裁决都必须写全**三段，缺一不可**：

```
Ruling: <决定了什么> — <为什么> — <若错代价>
```

- **第一段（决定了什么 / what）**：这条裁决定下了什么。
- **第二段（为什么 / why）**：裁决依据（引用规格 / 计划 / 上游证据的哪一处）。
- **第三段（若错代价 / cost if wrong）**：如果这条裁决是错的，代价是什么（返工范围 / 影响的下游产物 / 不可逆动作）。

三段缺一即为记录不完整；**不得**只写结论、只写「已裁决」或省略若错代价。裁决写入进度台账（编排者状态日志；见 `subagent-delegation.md`「编排者状态日志」节），每条一行、按作出顺序追加。

- **收尾穷尽上缴**：收尾/清理前，把台账中**每一条**含 `Ruling:` 的行（预检裁决、挂起发现、熔断裁定，全部算）按作出顺序收集为「**我做的裁决**」清单，每条带若错代价。该清单是**穷尽**的：台账里有裁决，清单里就必须有——**写不进最终消息的裁决等于秘密决策**。用户读这份清单并返工其中判错的部分；裁决随工作区一起消失，即等于瞒着用户做了决定。
- **CHECKPOINT 未决事项穷尽上报用户**：🔴 CHECKPOINT 是用户裁决点。只能由用户决定的事项（阶段放行 / 发布回退 / 范围与预算变更 / 价值取舍）一律**穷尽列入上报清单**交用户裁决，**不得**由编排者自行裁决后继续推进（自行裁决后推进命中反模式 #8「越过 CHECKPOINT 自动推进」与反模式 #10「编排者越权」）。
- **裁决与预算（仓库适配说明，非台账原文）**：S10 的裁决权**不覆盖硬预算门禁**——`budget.json` 超限仍按其 `onExceed` 处置（默认 `pause` → 🔴 CHECKPOINT · 预算告警），`maxReworkRounds` 与 4-5 轮修复升级上限同样不因裁决而放宽（既有机制见 `operational-recovery.md` 预算告警场景表 :208-211）。上台账的「本应申请提额的上限」仅指计划/流程内部的软上限。
