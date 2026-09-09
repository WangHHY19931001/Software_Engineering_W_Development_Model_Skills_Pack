# Code Health Task 1 五段串行拆分实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 严格按 1A → 1B → 1C → 1D → 1E 五段串行实现已批准的 Code Health Task 1：先冻结唯一 canonical contract，再实现注入式证据验证，再实现 candidate-scoped append-only reducer，再冻结但不实现归档边界，最后在真实隔离 Git 项目中验收正向链路与负向矩阵。

**架构：** `code-health-contract.ts` 是跨任务 TypeScript contract 的唯一导出来源；九个 JSON Schema 是同一 contract 的落盘表示，由 Schema/runtime parity 测试约束。文件安全、raw output、Git revision 和 source bundle 由注入式 `FileVerifier`、`EvidenceStore`、`RevisionProvider` 组成，生命周期只消费已验证的 typed evidence，不直接访问全局文件系统或当前工作目录。Task 1D 仅返回 typed `NOT_IMPLEMENTED`，真实 archive producer/consumer/verifier 和 package-only/source-bound 验证由另行批准的 Task 8 承接。

**技术栈：** TypeScript strict + Node.js 20 标准库；JSON Schema draft-07 + Ajv/`validateBySchema`；Vitest + `config/vitest.config.ts`；Git CLI 仅通过参数数组和注入式 revision provider；现有 `code-health-redaction.ts`、`wm-write`、Schema registry、security scan、self-test、samples coverage、docs-consistency 和 `.githooks/pre-push`。

---

## 状态、授权和不可越界事项

- **计划状态：** 已批准规格 `docs/superpowers/specs/2026-09-07-code-health-task1-resplit-design.md`（commit `78d7a45`）的实现计划；实现尚未开始。
- **唯一目标：** 实现 Task 1 的 1A、1B、1C、1D、1E 五段串行拆分。任何一段未通过时停止，不进入下一段。
- **明确不授权：** 本计划不授权 Task 8 归档实现。不得在 Task 1 写真实 archive package、archive readback、package-only verifier、source-bound verifier、source-bound consumer、归档文件或 `archived` 状态。
- **Task 1D 的唯一归档结果：** producer、consumer、verifier 入口均返回 `errorCode: 'NOT_IMPLEMENTED'` 的 typed fail-closed 结果；`manifest === null`、`applied === false`、无文件、无 ledger 变化、无工作树变化。
- **当前执行者边界：** O 只编排和记录真实结果；A 提供影响面和迁移清单；S 只在当前子任务 approved scope 内改代码和测试；V 独立审查；G 执行确定性命令并记录真实退出码；R 只做根因定位；人类只批准明确 candidate、action 和 exact scope。
- **证据状态边界：** `observed` 表示进程实际退出并带真实 exit code；`not_run`、`unavailable`、`unverified` 都是阻塞或未完成事实，不得转换为 pass。报告 checker pass、coverage 数值、测试数量和 LLM 判断都不能单独证明 Task 1 pass。
- **仓库边界：** 实现阶段不得修改未列入本计划的源码、测试、规格、活体文档或 `.w-model`。运行时审查证据必须写入受控临时项目或明确忽略的临时路径；禁止提交 `.w-model/`、`coverage/`、`.zcode/`。

## 文件结构与职责锁定

以下是执行本计划时允许创建或修改的全部文件。除下表外不得创建或修改其他文件。运行期临时 Git 项目位于操作系统临时目录，不属于当前仓库文件；其清理由 1E 测试的 `finally` 保证。

### 创建文件

| 文件 | 职责 |
| --- | --- |
| `w-model-dev/scripts/logic/code-health-contract.ts` | 唯一 canonical TypeScript contract：类型、枚举、`ErrorCode`、`CodeHealthError`、`CandidateSelector`、`EvidenceBinding`、`RollbackEvidence`、`GateFailureEvidence`、`ArchiveManifest`、Archive boundary 类型、Phase 1–4 消费者类型和所有跨任务函数签名。 |
| `w-model-dev/scripts/logic/code-health-phase-boundaries.ts` | Phase 1–4 的 compile-only / fail-closed 边界；只导入 canonical 类型，不定义第二套字段、枚举或错误码。Phase 1–4 真正发现、gap、TDD、测试删除、duplicate 和 abstraction 均不在 Task 1 实现。 |
| `w-model-dev/scripts/lib/code-health-file-verifier.ts` | 注入式 `FileVerifier` 的真实文件实现：root 边界、regular file、non-symlink、父目录链、字节 SHA-256 和 fail-closed 结果。 |
| `w-model-dev/scripts/lib/code-health-evidence-store.ts` | 注入式 `EvidenceStore` 的真实文件实现：受控 raw-output 目录、独占创建、candidate/scope 绑定、hash 回读和 evidence verify。 |
| `w-model-dev/scripts/lib/code-health-revision-provider.ts` | 注入式 `RevisionProvider` 的真实 Git 实现：commit SHA、tree SHA、source bundle SHA-256 和 stale revision 检查。 |
| `w-model-dev/scripts/lib/code-health-archive-boundary.ts` | Task 1D 的 `ArchiveProducer`、`ArchiveConsumer`、`ArchiveVerifier` 接口和 `NOT_IMPLEMENTED` 实现；不得读写 archive。 |
| `w-model-dev/scripts/__tests__/code-health-temp-project.ts` | 供 1B/1E 测试复用的真实临时 Git 项目 helper：创建、提交、读取 status、建立 symlink（能力可用时）和 finally 清理；不得写当前仓库。 |
| `w-model-dev/scripts/__tests__/code-health-contract.test.ts` | 1A 的 TypeScript contract、Schema/runtime parity、错误枚举、绑定对象和 Phase 1–4 compile-only consumer 测试。 |
| `w-model-dev/scripts/__tests__/code-health-contract.compile.ts` | 仅由 `tsc` 编译的正向/反向类型样例；不由 Vitest 执行，不触碰文件、Git、子进程或 archive。 |
| `w-model-dev/scripts/__tests__/code-health-evidence.test.ts` | 1B 的真实隔离 temp project 文件安全、raw output 独占写、hash、revision/tree/source bundle、candidate/scope 和 command/redaction 测试。 |
| `w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts` | 1D 的 manifest contract、verification level 语义和 producer/consumer/verifier `NOT_IMPLEMENTED` 无副作用测试。 |
| `w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts` | 1E 的真实隔离临时 Git 项目、正向 candidate 生命周期、完整负向矩阵、clean worktree、根目录不污染和 Task 8 boundary 验收。 |

### 修改文件

| 文件 | 修改职责与边界 |
| --- | --- |
| `w-model-dev/scripts/logic/code-health-ledger-logic.ts` | 收窄为 candidate reducer、严格 `GapRow`、approval scope、`recordGateFailure`、`nextRequiredRoles` 和 Task 1 `applyApproved` facade；所有类型/错误/Schema 语义从 canonical contract 导入，禁止继续堆叠 Phase 1–4 或 archive 半实现。 |
| `w-model-dev/scripts/lib/code-health-command.ts` | 保留并结构化迁移 `39d1671` 的 shell、cwd、环境、UTF-8、redaction、raw-output 安全事实；改为接收显式 repository root、`EvidenceStore`、`RevisionProvider` 和 `EvidenceBinding`，不再依赖隐式 `process.cwd()`。 |
| `w-model-dev/scripts/lib/code-health-redaction.ts` | 仅在 1B parity 测试需要时补充现有 redaction 的 typed 返回字段；不得放宽 secret、token、authorization、private key、绝对路径、NUL 或非法 UTF-8 规则。 |
| `w-model-dev/schemas/code-health-campaign.schema.json` | 与 canonical `CodeHealthLedger`/campaign contract 对齐，封闭嵌套对象、revision、环境 observation、append-only 和 redaction。 |
| `w-model-dev/schemas/code-health-candidate.schema.json` | 与 canonical `CodeHealthCandidate`、`CandidateSelector`、`EvidenceBinding`、rollback、review、signature 和 archive state 对齐。 |
| `w-model-dev/schemas/code-health-evidence.schema.json` | 与 canonical evidence、command observation、raw-output binding、revision/source bundle、impact、risk 和 redaction 对齐。 |
| `w-model-dev/schemas/code-health-approval.schema.json` | 增加 canonical approval revision、exact action/files/symbols/scope hash、human actor、时间和签名约束。 |
| `w-model-dev/schemas/code-health-ledger-event.schema.json` | 与 canonical `LedgerEvent`、event kind、candidate scope、revision、evidence refs、gate failure、rollback 和 append-only 约束对齐。 |
| `w-model-dev/schemas/code-health-gap.schema.json` | 与严格 `GapRow`、完整 `RiskProfile`、candidate identity、coverage signal-only、状态和 additional properties 约束对齐。 |
| `w-model-dev/schemas/code-health-archive.schema.json` | 仅冻结 `ArchiveManifest`/archive result 的 package-only、source-bound 和 `NOT_IMPLEMENTED` 语义；不包含 Task 1 的真实 archive 输出文件。 |
| `w-model-dev/schemas/code-health-test-inventory.schema.json` | 保持 Phase 3 compile-only contract 的精确字段和封闭结构，供后续消费者编译；Task 1 不实现测试 inventory。 |
| `w-model-dev/schemas/code-health-duplicate-cluster.schema.json` | 保持 Phase 4 compile-only contract 的精确字段和封闭结构，供后续消费者编译；Task 1 不实现 duplicate/abstraction。 |
| `w-model-dev/scripts/lib/state-schema-registry.ts` | 只确认九个已批准 code-health runtime targets 绑定到九个 Schema；不新增 fixture-only 或 archive 写目标。若现有登记已正确，仅添加 parity 断言，不改无关登记。 |
| `w-model-dev/scripts/__tests__/schema-validation.test.ts` | 增加九个 canonical Schema 的字段描述、valid/invalid、unknown nested field、enum、verification level 和 runtime parity 测试。 |
| `w-model-dev/scripts/__tests__/code-health-ledger.test.ts` | 将旧半实现测试迁移到 canonical imports；增加 1C reducer、role/order、append-only、GapRow、approval 和 `applyApproved` boundary 测试；删除对真实 archive 成功的断言。 |
| `w-model-dev/scripts/cli/self-test.ts` | 登记本任务新增的 canonical、evidence、reducer、archive boundary fixture；每个负例记录预期失败类别和真实 exit 语义，不把 `NOT_IMPLEMENTED` 记为通过。 |
| `w-model-dev/scripts/samples/README.md` | 登记新增/更新 code-health fixture 与 Schema 覆盖关系；不登记临时 Git 项目路径。 |
| `w-model-dev/scripts/samples/code-health/valid-campaign.json` | canonical campaign valid fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-candidate.json` | canonical candidate、scope、revision、evidence binding valid fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-evidence.json` | canonical evidence、observed/non-zero/unknown observation 字段 fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-approval.json` | exact human approval scope/revision fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-ledger-event.json` | event kind、role、revision、evidence refs 和唯一性 fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-gap.json` | 完整严格 `GapRow` fixture。 |
| `w-model-dev/scripts/samples/code-health/valid-archive.json` | 仅 manifest contract fixture，验证 level 明确，不能表示已归档。 |
| `w-model-dev/scripts/samples/code-health/bad-missing-candidate-id.json` | 缺 candidate identity 的 Schema fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-candidate-conclusion.json` | discovered candidate 伪装结论的 fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-no-command-hash.json` | 缺 command/raw-output hash 的 evidence fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-stale-revision.json` | stale commit/tree/source bundle 的 revision fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-approval-scope-mismatch.json` | approval exact scope 不匹配的 fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-protected-omission.json` | protected facts 缺失的 fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-missing-archive-redaction.json` | archive redaction 缺失/阻断的 fail-closed fixture。 |
| `w-model-dev/scripts/samples/code-health/bad-unavailable-environment-pass.json` | unavailable environment 被伪装成 pass 的 fail-closed fixture。 |

### 本地忽略审计材料（不属于 tracked 交付文件）

- `.superpowers/sdd/2026-09-07-code-health-governance/task-1a-report.md` 至 `task-1e-report.md`：分别记录每段 RED/GREEN、V/G、真实 exit code、revision、scope、raw-output hash、`not_run/unavailable/unverified` 和失败闭环。
- `.superpowers/sdd/2026-09-07-code-health-governance/progress.md`：只记录真实串行状态和 checkpoint，不写预测通过。
- `.superpowers/sdd/2026-09-07-code-health-governance/root-cause-report.json` 及其人类摘要：只在失败时创建/更新；JSON 必须通过 `check-rootcause-report.ts`，Markdown 不能直接作为 checker 输入。

这些材料可以在受控忽略路径生成，但不得由任何任务 `git add`、写入发布包或当作功能通过证明。

### 只读参考与不允许修改的输入

实现者必须阅读并遵循 `docs/superpowers/specs/2026-09-07-code-health-task1-resplit-design.md`、`w-model-dev/scripts/infrastructure/schema-loader.ts`、`w-model-dev/scripts/infrastructure/schema-fs.ts`、`w-model-dev/scripts/lib/state-schema-registry.ts`、`w-model-dev/scripts/lib/code-health-redaction.ts`、`w-model-dev/scripts/lib/code-health-command.ts`、`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/scripts/__tests__/code-health-ledger.test.ts` 和 `w-model-dev/scripts/__tests__/schema-validation.test.ts`。这些文件只有在上表明确列为修改文件时才可修改；规格文件、SSoT、README、AGENTS、CHANGELOG 和其他活体文档不在本计划 scope。

## 串行依赖和统一执行纪律

```text
1A canonical contract / Schema / ErrorCode / compile-only consumers
  ↓
1B EvidenceStore / FileVerifier / RevisionProvider / command-redaction binding
  ↓
1C candidate-scoped append-only reducer / roles / failure order / GapRow / approval
  ↓
1D ArchiveManifest boundary / package-only-source-bound semantics / NOT_IMPLEMENTED
  ↓
1E isolated real Git integration acceptance
  ↓
Task 8：真实 archive producer + consumer + package-only/source-bound verification
```

- 每一段开始前，S 先确认前段 V/G 产物和 commit SHA；缺少前段真实 exit code、raw output hash、V 审查或 G 门禁时停止。
- 每个步骤只做一个 2–5 分钟操作：写测试、运行 RED、写最小实现、运行 GREEN、执行 V、执行 G、记录失败、独立 commit，不把多个未知动作合成一个步骤。
- 每段暂停条件统一为：发现 approved file scope 之外的变更；Schema/runtime 不一致；安全负例被接受；`not_run`/`unavailable`/`unverified` 被当 pass；codegraph 依赖不可用而有人试图伪造查询；或发现 Task 8/Phase 1–4 真实实现被带入当前段。
- 每段完成定义统一为：本段文件与 diff 仅在批准 scope；RED 因目标缺陷失败且记录实际 exit；GREEN、V、G 均有真实命令/版本/时间/exit code/raw-output hash；本段负例 fail-closed；工作树和 ledger 无部分写入；独立 commit 已创建；下一段只消费本段公开 canonical contract。
- V 审查不替代 G；G 的脚本通过不替代 V；`check-rootcause-report.ts` 通过只证明 RootCauseReport 结构合格，不能把 Task 1 标为通过。
- 任一 V 或 G 失败必须立即停止并执行：`R` 根据 diff、失败 raw output、revision 和上游 contract 产出 RootCauseReport；`V` 复审根因和 scope；`G` 运行 `check-rootcause-report.ts` 并记录真实 exit；只有该门通过后 `S` 才能按报告返工；返工重新执行当前段 RED/GREEN、V、G。不得直接重跑 S、跳段或改写失败结论。
- 阶段 5–8 的任何代码/测试 Edit/Write 前，必须先调用 `mcp__codegraph__codegraph_explore` 查询目标符号的 callers/callees/blast radius，并把查询落盘到目标项目 `.w-model/codegraph-queries/`，再运行 `check-codegraph-queries.ts`。本仓库当前没有 `.codegraph/` 索引；若查询不可用，必须记录 `unavailable` 并阻塞，不得伪造查询 JSON。任何代码改动后必须跑回归测试。
- 保持无 LLM runtime/SDK/网络调用、L0/L1 边界、redaction、现有 18 项 pre-push 顺序和真实 exit 语义不变；不新增 hook 绕过或“测试专用关闭安全”的分支。

## bab618a / 39d1671 的实际迁移顺序

实现者必须按以下顺序迁移，不能先删旧 helper 再猜测其语义：

1. **1A canonical 对齐：** 从 `bab618a`、`39d1671` 和现有 `code-health-ledger.test.ts` 建立字段对照表；先把 candidate、command、rollback、archive evidence、revision、scope 和 redaction 字段映射到 `code-health-contract.ts` 与九个 Schema。未完成字段对照前不删除旧字段、不改变旧字段含义。
2. **1B 安全边界抽离：** 将 `39d1671` 的受控 cwd/raw-output root、父目录与目标 non-symlink、regular file、exclusive create、`shell:false`、audited environment、UTF-8、redaction 和真实 exit code 迁入 `FileVerifier`/`EvidenceStore`/`RevisionProvider`；旧 command helper 只能作为显式依赖适配层，不能继续拥有另一套 path/hash/redaction 校验。
3. **1C 生命周期归一：** 将 `bab618a` 的 rollback patch/raw-output/source revision binding 和现有直接 status 更新改成 append-only `LedgerEvent` 与纯 reducer；删除任何绕过 event history 的直接 status 写法。失败必须先形成 candidate-scoped blocked event，再按 R→V→G→S 顺序推进。
4. **1D 归档拆边界：** 把现有 archive 组装、readback、source-bound 判断和真实文件写入标记为 Task 8 migration items；Task 1 分支只保留 canonical `ArchiveManifest`、package-only/source-bound 标签、接口和 typed `NOT_IMPLEMENTED`。不得保留“看似可用”的 archive 半实现。
5. **1E 真实验收：** 在新的 `mkdtemp` Git 项目中重演上述安全事实和生命周期链路；无法由真实文件、真实 SHA-256、真实 commit/tree/source bundle、真实 exit code 或真实 clean status 证明的旧行为保持 blocking，不得用兼容分支静默放行。

---

## 任务 1A：Canonical contract 冻结

**目的：** 建立唯一可导入的 canonical TypeScript contract 和九个 Schema 的 parity，消除 `code-health-ledger-logic.ts` 中类型、Schema、错误语义和 Phase 1–4 半实现之间的第二套 contract。

**依赖：** 基线 commit `bab618a`/`39d1671` 的现有字段和安全事实；前置 approved spec commit `78d7a45`。1A 不读取或实现 Task 8 archive。

**文件：**

- 创建：`w-model-dev/scripts/logic/code-health-contract.ts`、`w-model-dev/scripts/logic/code-health-phase-boundaries.ts`、`w-model-dev/scripts/__tests__/code-health-contract.test.ts`、`w-model-dev/scripts/__tests__/code-health-contract.compile.ts`。
- 修改：`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/schemas/code-health-campaign.schema.json`、`w-model-dev/schemas/code-health-candidate.schema.json`、`w-model-dev/schemas/code-health-evidence.schema.json`、`w-model-dev/schemas/code-health-approval.schema.json`、`w-model-dev/schemas/code-health-ledger-event.schema.json`、`w-model-dev/schemas/code-health-gap.schema.json`、`w-model-dev/schemas/code-health-archive.schema.json`、`w-model-dev/schemas/code-health-test-inventory.schema.json`、`w-model-dev/schemas/code-health-duplicate-cluster.schema.json`、`w-model-dev/scripts/lib/state-schema-registry.ts`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`、`w-model-dev/scripts/__tests__/code-health-ledger.test.ts`、`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/samples/README.md`、`w-model-dev/scripts/samples/code-health/valid-campaign.json`、`w-model-dev/scripts/samples/code-health/valid-candidate.json`、`w-model-dev/scripts/samples/code-health/valid-evidence.json`、`w-model-dev/scripts/samples/code-health/valid-approval.json`、`w-model-dev/scripts/samples/code-health/valid-ledger-event.json`、`w-model-dev/scripts/samples/code-health/valid-gap.json`、`w-model-dev/scripts/samples/code-health/valid-archive.json`、`w-model-dev/scripts/samples/code-health/valid-test-inventory.json`、`w-model-dev/scripts/samples/code-health/valid-duplicate-cluster.json`、`w-model-dev/scripts/samples/code-health/bad-approval-scope-mismatch.json`、`w-model-dev/scripts/samples/code-health/bad-candidate-conclusion.json`、`w-model-dev/scripts/samples/code-health/bad-missing-archive-redaction.json`、`w-model-dev/scripts/samples/code-health/bad-missing-candidate-id.json`、`w-model-dev/scripts/samples/code-health/bad-no-command-hash.json`、`w-model-dev/scripts/samples/code-health/bad-protected-omission.json`、`w-model-dev/scripts/samples/code-health/bad-stale-revision.json`、`w-model-dev/scripts/samples/code-health/bad-unavailable-environment-pass.json`。

### 1A 步骤

- [ ] **步骤 1：冻结基线事实并登记 22 项 focused ledger 结果。**

运行：

```bash
git show --no-ext-diff --stat bab618a
git show --no-ext-diff --stat 39d1671
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts
```

预期基线事实：focused ledger **22 total / 16 passed / 6 failed**。该数字已由 2026-09-07 在当前基线运行得到；若执行者重新运行后总数、通过数或失败数不同，立即暂停，记录 `unverified`，不得修改测试来凑数。六个 blocking failure 必须按真实测试名称固定追踪为：`requires complete archive guard for verified to archived and binds rollback metadata`（`legacy-archive-evidence`）、`uses structured gate-failure evidence and does not infer evidence from reference names`（`gate-evidence-file-binding`）、`exports every planned cross-task API with fail-closed behavior instead of false success`（`cross-task-boundary`）、`gate failure evidence cannot be recorded from a missing raw-output file`（`gate-raw-output-existence`）、`gap validator rejects invalid identity, priority, status, risk, and coverage signal`（`gap-strict-validation`）、`archiveCampaign and verifyArchive fail closed instead of trusting reference names or partial manifests`（`archive-half-implementation`）。每个真实失败项必须在 1A–1E 的审查索引中保留原测试名称、blocking ID、失败 raw output、RootCauseReport、V 复审、G 门禁、S 返工和重新验证结果；不得用抽象计数替代六项闭环。

- [ ] **步骤 2：先写 canonical contract 的 RED 测试。**

在 `code-health-contract.test.ts` 加入以下真实测试名称和断言：

```ts
it('canonical contract 暴露稳定 ErrorCode、CandidateSelector 和 EvidenceBinding', () => {
  const selector: CandidateSelector = {
    candidateId: 'CHG-P1-20260907-101',
    phase: 'P1',
    action: 'delete-code',
    files: ['src/candidate.ts'],
    symbols: ['candidate'],
    scopeHash: `sha256:${'a'.repeat(64)}`,
  };
  const binding: EvidenceBinding = {
    candidate: selector,
    revision: revision,
    rawOutputPath: 'evidence/raw.log',
    rawOutputSha256: 'b'.repeat(64),
  };
  expect(binding.candidate.scopeHash).toBe(selector.scopeHash);
  expect(new Set<ErrorCode>([
    'ARG_INVALID', 'STRUCTURE_INVALID', 'EVIDENCE_INVALID', 'SCOPE_MISMATCH',
    'REVISION_MISMATCH', 'SECURITY_BLOCKED', 'ROLE_FORBIDDEN', 'TRANSITION_INVALID',
    'NOT_IMPLEMENTED',
  ]).size).toBe(9);
});

it('Schema 与 runtime contract 同时拒绝未知嵌套字段、错误枚举和 coverage 授权', () => {
  const valid = loadFixture('valid-candidate.json');
  expect(validateBySchema('code-health-candidate', valid).valid).toBe(true);
  expect(validateCodeHealthCandidate(valid)).toEqual([]);
  expect(validateBySchema('code-health-candidate', {
    ...valid,
    review: { ...valid.review, unknownNested: true },
  }).valid).toBe(false);
  expect(validateCodeHealthCandidate({
    ...valid,
    rtmImpact: { ...valid.rtmImpact, coverageIsSignalOnly: false },
  })).toEqual(expect.arrayContaining([expect.stringMatching(/coverageIsSignalOnly/)]));
});

it('Phase 1-4 compile-only consumers 只接受 canonical 类型且不执行 IO', () => {
  expect(consumePhase1Candidate).toBeTypeOf('function');
  expect(consumePhase2Gap).toBeTypeOf('function');
  expect(consumePhase3Test).toBeTypeOf('function');
  expect(consumePhase4Cluster).toBeTypeOf('function');
});
```

在 `code-health-contract.compile.ts` 加入以下仅编译样例；反向样例必须由 `@ts-expect-error` 锁定为预期类型错误。该文件从 `code-health-contract.ts` 导入所有类型，并定义 `validImpact` 为完整的 `ImpactRecord` 正向 fixture：

```ts
const validImpact: ImpactRecord = {
  rtmBefore: ['REQ-1'],
  rtmAfter: ['REQ-1'],
  coverageBefore: { statements: 1, branches: 1, functions: 1, lines: 1 },
  coverageAfter: { statements: 1, branches: 1, functions: 1, lines: 1 },
  testLevels: ['unit'],
  unmappedScenarios: [],
  coverageIsSignalOnly: true,
};

export const phase1ConsumerInput = {
  candidateId: 'CHG-P1-20260907-101',
  classification: 'unknown',
  files: ['src/candidate.ts'],
  symbols: ['candidate'],
  staticReferences: [],
  dynamicScenarios: [],
  guardViolations: ['dynamic import not exercised'],
  status: 'blocked',
} satisfies Phase1CandidateLead;

// @ts-expect-error ErrorCode 不允许自然语言或未知枚举。
export const invalidErrorCode: ErrorCode = 'PASS';
// @ts-expect-error coverageIsSignalOnly 只能是字面量 true。
export const invalidImpact: ImpactRecord = { ...validImpact, coverageIsSignalOnly: false };
// @ts-expect-error source-bound/package-only 只能使用冻结枚举。
export const invalidManifestLevel: ArchiveManifest['verificationLevel'] = 'source-verified';
```

- [ ] **步骤 3：运行 1A RED 并确认是目标缺陷。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts
npx tsc -p config/tsconfig.json --noEmit
```

预期：Vitest exit **1**，原因是 canonical module、消费者或 parity 断言尚未存在；`tsc` exit **2**，原因是缺少导出或旧类型不匹配。若 RED 因环境依赖缺失而非目标 contract 缺失，记录 `unavailable` 并暂停，不进入实现。

- [ ] **步骤 4：写入唯一 canonical 类型、错误和边界签名。**

1A 裁定：为保持 1A/1B 文件所有权边界，`CommandEvidence` 在 1A 只表示旧 command runner 产生的进程事实；candidate/scope 绑定由强制的 `EvidenceBinding` 承载。1A 不修改 `code-health-command.ts`，1B 才将 binding 接入 runner 和 evidence store。任何生命周期调用都必须拒绝缺 binding 的 evidence；不得将 binding 字段改成可选或使用 legacy 第二套类型。

在 `code-health-contract.ts` 定义且只定义一次以下类型。`CommandEvidence` 保持进程事实字段，不包含 candidateId/scopeHash；`EvidenceBinding` 必须是进入 candidate/lifecycle 的强制外层绑定。

```ts
export type CodeHealthPhase = 'P1' | 'P2' | 'P3' | 'P4';
export type CodeHealthAction = 'delete-code' | 'add-test' | 'delete-test' | 'abstract';
export type CodeHealthStatus =
  | 'discovered' | 'evidenced' | 'under-review' | 'approved' | 'implemented'
  | 'verified' | 'archived' | 'rejected' | 'deferred' | 'blocked' | 'rolled-back';
export type EvidenceObservationStatus = 'observed' | 'not_run' | 'unavailable' | 'unverified';
export type ErrorCode =
  | 'ARG_INVALID' | 'STRUCTURE_INVALID' | 'EVIDENCE_INVALID' | 'SCOPE_MISMATCH'
  | 'REVISION_MISMATCH' | 'SECURITY_BLOCKED' | 'ROLE_FORBIDDEN' | 'TRANSITION_INVALID'
  | 'NOT_IMPLEMENTED';

export interface ArchiveTransitionEvidence {
  manifestRef: string;
  manifestSha256: string;
  verificationLevel: 'package-only' | 'source-bound';
  sourceRevision: RevisionIdentity;
  redactionStatus: 'clean';
}

export interface ApplyApprovedInput {
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  mode: 'dry-run' | 'patch' | 'commit';
  repositoryRoot: string;
  currentRevision: RevisionIdentity;
}

export interface CandidateSelector {
  candidateId: string;
  phase: CodeHealthPhase;
  action: CodeHealthAction;
  files: string[];
  symbols: string[];
  scopeHash: string;
}

export interface RevisionIdentity {
  commitSha: string;
  treeSha: string;
  sourceBundleSha256: string;
  analyzedAt: string;
}

export interface EvidenceBinding {
  candidate: CandidateSelector;
  revision: RevisionIdentity;
  rawOutputPath: string;
  rawOutputSha256: string;
}

export interface RollbackEvidence {
  command: CommandEvidence;
  preChangeRevision: string;
  patchPath: string;
  patchSha256: string;
  owner: string;
  patchExists: true;
  rawOutputExists: true;
  sourceRevision: RevisionIdentity;
}

export interface GateFailureEvidence extends CommandEvidence {
  candidateId: string;
  scopeHash: string;
  failureKind: 'test' | 'gate' | 'command';
}

export interface ArchiveManifest {
  archiveId: string;
  candidateId: string;
  scope: CandidateSelector;
  contentHash: string;
  files: Array<{ path: string; kind: 'ledger' | 'candidate' | 'evidence' | 'approval' | 'review' | 'gate' | 'rollback'; sha256: string }>;
  sourceRevision: RevisionIdentity;
  approvalRef: string;
  reviewRefs: string[];
  gateRefs: string[];
  humanSignatureRef: string;
  redaction: { status: 'clean' | 'blocked'; reasons: string[] };
  verificationLevel: 'package-only' | 'source-bound';
  rollbackRef: string;
  producerMetadata: { producerId: string; producerVersion: string };
  createdAt: string;
}

export class CodeHealthError extends Error {
  readonly code: ErrorCode;
  readonly safePath?: string;
  readonly candidateId?: string;
  readonly scopeHash?: string;
  readonly expectedRevision?: RevisionIdentity;
  readonly actualRevision?: RevisionIdentity;
  constructor(code: ErrorCode, reason: string, context?: {
    safePath?: string;
    candidateId?: string;
    scopeHash?: string;
    expectedRevision?: RevisionIdentity;
    actualRevision?: RevisionIdentity;
  });
}
```

在同一文件定义 `CommandEvidence` 为 required `candidateId`、`scopeHash`、真实 `exitCode: number | null`、`observation`、raw output path/hash；定义 `CodeHealthCandidate`、`CodeHealthLedger`、完整 `RiskProfile`、`GapRow`、`TestRecord`、`DuplicateCluster` 以及 Phase 1–4 的 `StaticInventoryReport`、`DynamicTraceReport`、`Phase1CandidateLead`、`GapDiscoveryInput`、`TddHarnessInput`、`TestRemovalProofInput`、`DuplicateInput`。定义 `ArchiveTransitionEvidence` 为仅供 Task 8 archive event 引用的 source-bound evidence 摘要，并定义 `ApplyApprovedInput`（candidate、approval、mode、repositoryRoot 和当前 revision）及 1D 的 `ArchiveProduceInput`、`ArchiveConsumeInput`、`ArchiveVerifyInput`。`LedgerEvent` 必须使用以下唯一结构，不能由 reducer 自行增加字段：

```ts
export type LedgerEventKind =
  | 'discovery' | 'evidence' | 'review' | 'approval' | 'implementation'
  | 'verification' | 'gate-failure' | 'root-cause' | 'root-cause-review'
  | 'root-cause-gate' | 'rework' | 'rollback' | 'archive';

export interface LedgerEvent {
  eventId: string;
  eventKind: LedgerEventKind;
  candidateId: string;
  from: CodeHealthStatus | null;
  to: CodeHealthStatus;
  actorRole: 'O' | 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  at: string;
  previousRevision?: RevisionIdentity;
  revision: RevisionIdentity;
  scopeHash: string;
  evidenceRefs: string[];
  signatureRef: string;
  gateFailureEvidence?: GateFailureEvidence;
  rollbackEvidence?: RollbackEvidence;
  archiveEvidence?: ArchiveTransitionEvidence;
}
```

`ApprovalDecision` 必须包含 `revision: RevisionIdentity`，并且 human exact approval 的 `revision` 与 candidate 当前 revision 相等。`eventKind='implementation'` 是唯一允许 revision 前进的事件：它必须携带 `previousRevision`，其值等于 candidate 当前 revision，`revision` 必须是 S 提交 exact scope 后由 `RevisionProvider.current(root)` 实测得到的新 commit/tree/source bundle；reducer 原子地把 candidate revision 更新为该新 revision。其他 event 的 `revision` 必须与当前 candidate revision 相等。字段直接对应 approved spec §5，不在 `code-health-ledger-logic.ts` 复制。

- [ ] **步骤 5：创建 Phase 1–4 compile-only consumers。**

在 `code-health-phase-boundaries.ts` 只消费 canonical 类型，导出以下精确函数；它们不访问 `fs`、Git、子进程或 archive：

```ts
export function consumePhase1Candidate(input: Phase1CandidateLead): Pick<Phase1CandidateLead, 'candidateId' | 'status'>;
export function consumePhase2Gap(input: GapRow): Pick<GapRow, 'gapId' | 'candidateId' | 'coverageIsSignalOnly'>;
export function consumePhase3Test(input: TestRecord): Pick<TestRecord, 'testId' | 'level' | 'rtmIds'>;
export function consumePhase4Cluster(input: DuplicateCluster): Pick<DuplicateCluster, 'clusterId' | 'status'>;
export function findGaps(input: GapDiscoveryInput): never;
export function runTddHarness(input: TddHarnessInput): Promise<never>;
export function proveTestRemoval(input: TestRemovalProofInput): string[];
export function clusterDuplicates(input: DuplicateInput): never;
```

`findGaps`、`runTddHarness`、`clusterDuplicates` 必须抛出 `CodeHealthError('NOT_IMPLEMENTED', ...)`，而非返回空结果；`proveTestRemoval` 在 Task 1 只做类型可调用性检查并返回明确的 `NOT_IMPLEMENTED` violation，不执行测试删除；Phase 1–4 compile-only 类型消费者不代表 Phase 1–4 已实现。

- [ ] **步骤 6：让九个 JSON Schema 与 canonical contract parity。**

修改九个 Schema，执行以下固定规则：所有有 `properties` 的对象写 `description` 和 `additionalProperties: false`；只有 `environment`、`toolVersions` 这类明确开集 map 使用字符串 `additionalProperties`；revision 四字段必填；candidate selector 的 files/symbols/scope hash 精确绑定；`coverageIsSignalOnly` 使用 `const: true`；observation 与 exitCode 的组合拒绝 `not_run`/`unavailable`/`unverified` 伪造 pass；archive verification level 只接受 `package-only`/`source-bound`；未知顶层和嵌套字段均拒绝。

- [ ] **步骤 7：收窄旧 ledger 文件并移走第二套 contract。**

`code-health-ledger-logic.ts` 删除重复的 interface/type、枚举、正则、ErrorCode 和 archive manifest 类型；保留 reducer 相关导出并从 `code-health-contract.ts` 导入。Phase 1–4 的 fail-closed 边界函数从 `code-health-phase-boundaries.ts` 导入或转发；旧导出名若为现有测试所需，只能是无逻辑 compatibility re-export，不能定义新字段或第二套校验。移除旧 `archiveCampaign`/`verifyArchive` 的真实 manifest 组装、readback 和 hash 推断逻辑，暂由 1D boundary facade 承接。

- [ ] **步骤 8：运行 1A GREEN。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts -t "code-health"
npx tsc -p config/tsconfig.json --noEmit
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/logic/code-health-phase-boundaries.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts w-model-dev/scripts/__tests__/code-health-contract.compile.ts w-model-dev/schemas/code-health-*.schema.json
```

预期：Vitest exit **0**，`tsc` exit **0**，Prettier exit **0**；反向 `@ts-expect-error` 被编译器消费，Schema 和 runtime 对同一 valid/invalid fixture 给出一致结果。任何 parity mismatch、未知字段被接受或类型编译未报错均为 1A blocking failure。

- [ ] **步骤 9：准备 V 的任务级审查输入。**

提交给 V：1A diff、canonical 导出清单、九个 Schema 清单、`code-health-contract.compile.ts` 编译输出、RED/GREEN 命令和真实 exit code、16/22 既有通过项与 6 个 failure ID 映射、旧 monolith 删除/转发清单。V 必须逐项确认没有第二套 contract、没有把 Schema-only 通过当 runtime 通过、没有将 `NOT_IMPLEMENTED` 当 pass、没有修改 1B–1E 实现。

- [ ] **步骤 10：执行 G 确定性门禁。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
npx tsc -p config/tsconfig.json --noEmit
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
```

预期：三个命令 exit **0**。G 还必须检查 `git diff --name-only` 只包含 1A 文件；Schema 未注册、字段描述缺失、runtime parity 不一致、Phase consumer 执行 IO 或 6 个 failure 未闭环都返回 blocking。`check-rootcause-report.ts` 若被调用，只能作为 R 报告门禁，不得作为 Task 1 pass。

- [ ] **步骤 11：完成 1A 独立 commit。**

V/G 均通过且人类确认 1A scope 后，只暂存 1A 所有权表中实际修改的文件；不得使用整个 `samples/code-health` 目录级暂存，以免带入未批准的既有或运行期文件。

```bash
git add w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/logic/code-health-phase-boundaries.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts w-model-dev/scripts/__tests__/code-health-contract.compile.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/scripts/lib/state-schema-registry.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples/README.md w-model-dev/scripts/samples/code-health/valid-campaign.json w-model-dev/scripts/samples/code-health/valid-candidate.json w-model-dev/scripts/samples/code-health/valid-evidence.json w-model-dev/scripts/samples/code-health/valid-approval.json w-model-dev/scripts/samples/code-health/valid-ledger-event.json w-model-dev/scripts/samples/code-health/valid-gap.json w-model-dev/scripts/samples/code-health/valid-archive.json w-model-dev/scripts/samples/code-health/valid-test-inventory.json w-model-dev/scripts/samples/code-health/valid-duplicate-cluster.json w-model-dev/scripts/samples/code-health/bad-approval-scope-mismatch.json w-model-dev/scripts/samples/code-health/bad-candidate-conclusion.json w-model-dev/scripts/samples/code-health/bad-missing-archive-redaction.json w-model-dev/scripts/samples/code-health/bad-missing-candidate-id.json w-model-dev/scripts/samples/code-health/bad-no-command-hash.json w-model-dev/scripts/samples/code-health/bad-protected-omission.json w-model-dev/scripts/samples/code-health/bad-stale-revision.json w-model-dev/scripts/samples/code-health/bad-unavailable-environment-pass.json w-model-dev/schemas/code-health-campaign.schema.json w-model-dev/schemas/code-health-candidate.schema.json w-model-dev/schemas/code-health-evidence.schema.json w-model-dev/schemas/code-health-approval.schema.json w-model-dev/schemas/code-health-ledger-event.schema.json w-model-dev/schemas/code-health-gap.schema.json w-model-dev/schemas/code-health-archive.schema.json w-model-dev/schemas/code-health-test-inventory.schema.json w-model-dev/schemas/code-health-duplicate-cluster.schema.json
git commit --no-gpg-sign -m "feat(code-health): freeze task1 canonical contract"
```

暂停/完成：任何 R→V→G→S 未闭环、Schema/runtime mismatch、旧 helper 继续作为校验第二来源或 focused 6 failure 未保持 blocking 时暂停；1A 完成只表示 contract 冻结，不表示 evidence、reducer、archive 或 Task 1 完成。

---

## 任务 1B：注入式 EvidenceStore、FileVerifier 和 RevisionProvider

**目的：** 把文件安全、raw output、SHA-256、Git commit/tree/source bundle、candidate/scope binding 和 command/redaction 从 lifecycle reducer 中抽出，使每条 evidence 能被真实回读且 fail-closed。

**文件：**

- 创建：`w-model-dev/scripts/lib/code-health-file-verifier.ts`、`w-model-dev/scripts/lib/code-health-evidence-store.ts`、`w-model-dev/scripts/lib/code-health-revision-provider.ts`、`w-model-dev/scripts/__tests__/code-health-evidence.test.ts`。
- 修改：`w-model-dev/scripts/logic/code-health-contract.ts`（只补充 1A 已批准的 evidence result 类型）、`w-model-dev/scripts/lib/code-health-command.ts`、`w-model-dev/scripts/lib/code-health-redaction.ts`（只做 parity 所需的 typed 适配）、`w-model-dev/scripts/__tests__/code-health-ledger.test.ts`（改为真实 binding 调用）。

### 1B 步骤

- [ ] **步骤 1：写 FileVerifier RED 测试。**

在 `code-health-evidence.test.ts` 使用 `fs.mkdtemp(path.join(tmpdir(), 'code-health-1b-'))` 创建隔离 root 和 root 外目录，加入真实测试：

```ts
it('接受 root 下 regular non-symlink 文件并精确校验字节 SHA-256', async () => {
  await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
  const bytes = Buffer.from('evidence-bytes', 'utf8');
  await fs.writeFile(path.join(root, 'evidence', 'raw.log'), bytes);
  const result = await verifier.verifyRegularNonSymlinkFile({
    root,
    relativePath: 'evidence/raw.log',
    expectedSha256: createHash('sha256').update(bytes).digest('hex'),
  });
  expect(result).toMatchObject({ ok: true, code: null, relativePath: 'evidence/raw.log' });
});

it.each([
  ['../outside.log', 'STRUCTURE_INVALID'],
  [path.resolve(root, 'outside.log'), 'STRUCTURE_INVALID'],
  ['evidence/missing.log', 'EVIDENCE_INVALID'],
])('拒绝路径越界或缺失文件：%s', async (relativePath, code) => {
  const result = await verifier.verifyRegularNonSymlinkFile({ root, relativePath, expectedSha256: '0'.repeat(64) });
  expect(result.ok).toBe(false);
  expect(result.code).toBe(code);
});

it('拒绝目录、文件 symlink 和父目录 symlink，且不读取 link 指向内容', async () => {
  // 建立 directory、file symlink 和 parent directory symlink 后逐项断言 ok=false。
  expect(directoryResult.code).toBe('EVIDENCE_INVALID');
  expect(fileLinkResult.code).toBe('SECURITY_BLOCKED');
  expect(parentLinkResult.code).toBe('SECURITY_BLOCKED');
});
```

- [ ] **步骤 2：写 EvidenceStore 和 RevisionProvider RED 测试。**

加入以下真实断言：

```ts
it('raw output 使用 exclusive create，既有文件和 symlink 均不能覆盖', async () => {
  const first = await store.putRawOutput({
    candidateId: selector.candidateId,
    scopeHash: selector.scopeHash,
    relativePath: 'evidence/raw-001.log',
    bytes: Buffer.from('first'),
  });
  await expect(store.putRawOutput({
    candidateId: selector.candidateId,
    scopeHash: selector.scopeHash,
    relativePath: first.relativePath,
    bytes: Buffer.from('overwrite'),
  })).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
  expect(await fs.readFile(path.join(root, first.relativePath), 'utf8')).toBe('first');
});

it('verify 拒绝 candidate mismatch、scope mismatch、raw hash mismatch 和 stale revision', async () => {
  await expect(store.verify(ref, { ...binding, candidate: { ...selector, candidateId: 'CHG-P1-20260907-999' } }))
    .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
  await expect(store.verify(ref, { ...binding, candidate: { ...selector, scopeHash: `sha256:${'f'.repeat(64)}` } }))
    .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
  await expect(store.verify({ ...ref, sha256: '0'.repeat(64) }, binding))
    .rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
  await expect(revisionProvider.verify(root, { ...revision, treeSha: 'f'.repeat(40) }))
    .resolves.toMatchObject({ ok: false, code: 'REVISION_MISMATCH' });
});

it('真实 Git revision 同时绑定 commit、tree 和 source bundle，不能只接受 HEAD 名称', async () => {
  const actual = await gitRevisionProvider.current(root);
  expect(actual?.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(actual?.treeSha).toMatch(/^[0-9a-f]{40}$/);
  expect(actual?.sourceBundleSha256).toMatch(/^[0-9a-f]{64}$/);
});
```

- [ ] **步骤 3：运行 1B RED 并确认失败可归因。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts
```

预期：Vitest exit **1**，原因是三个注入式实现尚未存在或旧 command runner 仍使用隐式 root；不能接受“没有权限建立 symlink”作为通过。若当前平台不能建立测试所需 symlink，测试结果必须记为 `unavailable`，G 阻塞 1B，不可把该负例改成 skipped pass。

- [ ] **步骤 4：实现精确注入接口并消除全局 root 依赖。**

在 canonical contract 保留以下接口签名：

```ts
export interface FileVerificationResult {
  ok: boolean;
  code: ErrorCode | null;
  relativePath: string;
  expectedSha256: string;
  actualSha256?: string;
  reason?: string;
}

export interface FileVerifier {
  verifyRegularNonSymlinkFile(input: {
    root: string;
    relativePath: string;
    expectedSha256: string;
  }): Promise<FileVerificationResult>;
}

export interface StoredEvidenceRef {
  evidenceId: string;
  candidateId: string;
  scopeHash: string;
  relativePath: string;
  sha256: string;
}

export interface EvidenceRef extends StoredEvidenceRef {
  revision: RevisionIdentity;
  observation: EvidenceObservationStatus;
}

export interface EvidenceVerificationResult {
  ok: boolean;
  code: ErrorCode | null;
  binding: EvidenceBinding;
  reason?: string;
}

export interface EvidenceStore {
  putRawOutput(input: {
    candidateId: string;
    scopeHash: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<StoredEvidenceRef>;
  verify(ref: EvidenceRef, binding: EvidenceBinding): Promise<EvidenceVerificationResult>;
}

export interface RevisionVerificationResult {
  ok: boolean;
  code: 'REVISION_MISMATCH' | null;
  expected: RevisionIdentity;
  actual: RevisionIdentity | null;
  reason?: string;
}

export interface RevisionProvider {
  current(root: string): Promise<RevisionIdentity | null>;
  verify(root: string, expected: RevisionIdentity): Promise<RevisionVerificationResult>;
}
```

- [ ] **步骤 5：实现 FileVerifier 的真实路径和哈希边界。**

`code-health-file-verifier.ts` 只接受 repository-relative POSIX 形式路径：拒绝空字符串、绝对 POSIX/Windows 路径、反斜杠、NUL、空 path component、`..` 和解析到 root 外的路径。逐级 `lstat` root 到目标父目录，拒绝任何 symlink 和非目录；目标必须 `lstat().isFile()` 且不是 symlink；使用字节 buffer 计算 SHA-256；在读取前后再次确认目标 realpath 与受控路径一致。所有失败返回 `FileVerificationResult` 的 typed code，不返回 partial success，不把绝对路径放进 reason。

- [ ] **步骤 6：实现 EvidenceStore 的独占 raw-output 和 binding。**

`code-health-evidence-store.ts` 配置显式 `repositoryRoot` 和 `rawOutputRoot`，验证目录链全部 non-symlink 且在 root 内；使用 `fs.open(target, 'wx')` 或等价不可覆盖语义写入；写完立即 `lstat`/hash 回读；既有文件、symlink、目录、越界路径、candidate ID 空值、scope hash 非 64 位 SHA-256 均阻断。`verify` 必须同时比较 candidate ID、scope hash、relative path、raw hash、revision commit/tree/source bundle 和 observation；旧 candidate evidence 不得被新 scope 复用。

- [ ] **步骤 7：实现 RevisionProvider 和真实 source bundle。**

`code-health-revision-provider.ts` 通过参数数组调用 Git：`git rev-parse HEAD`、`git rev-parse HEAD^{tree}` 和 `git archive --format=tar <commitSha>`；以字节 hash 得到 source bundle SHA-256；所有命令都使用显式 root、`shell: false`、超时和真实 exit code。`current` 在非 Git root、缺 commit、tree 或 archive 失败时返回 `null`；`verify` 逐项比较 commit/tree/source bundle，任一 mismatch 返回 `REVISION_MISMATCH`，不依赖 branch 名、短 SHA 或 `HEAD` 字符串。

- [ ] **步骤 8：迁移 `39d1671` command/redaction 安全事实。**

修改 `CodeHealthCommandRunnerOptions` 为显式 `repositoryRoot`、`rawOutputDir`、`evidenceStore`、`revisionProvider`、可注入 `now` 和 audited environment keys；`run` 的 options 增加 `binding: EvidenceBinding`。保留 `spawn(command, args, { shell: false })`、cwd/root 校验、raw-output 目录和所有父目录 non-symlink、`open('wx')`、audited environment、NUL/secret/token/authorization/private-key 拦截、安全 redaction、stdout/stderr 字节收集、fatal UTF-8 解码和真实 exit code。`observed` 只在 close 事件取得真实 code 时使用；non-zero 原值保留；不可执行为 `unavailable`，超时为 `not_run`，均不能 pass。不得把 stderr 丢弃、把 null 变成 0/1、关闭 redaction 或把绝对路径放入错误。

- [ ] **步骤 9：运行 1B GREEN。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts -t "evidence|command|rollback"
npx tsc -p config/tsconfig.json --noEmit
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/lib/code-health-file-verifier.ts w-model-dev/scripts/lib/code-health-evidence-store.ts w-model-dev/scripts/lib/code-health-revision-provider.ts w-model-dev/scripts/lib/code-health-command.ts w-model-dev/scripts/lib/code-health-redaction.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts
```

预期：三条命令 exit **0**；测试真实观察 regular file、目录、file symlink、父目录 symlink、越界、缺失、错误 SHA-256、stale commit/tree/source bundle、candidate/scope mismatch、非法 UTF-8、未审计环境、敏感输出、真实 exit 3/7、`not_run` 和 `unavailable`。任一 negative matrix 被接受、raw output 可覆盖或当前仓库出现 `.w-model`/coverage 写入即阻塞。

- [ ] **步骤 10：准备 V、执行 G 和 R 失败闭环。**

V 输入：接口 diff、39d1671 安全事实逐条对照表、bab618a rollback/source-bound 字段迁移表、每个临时项目 case 的 binding/revision/hash、RED/GREEN 原始输出和实际 exit code。G 运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts
npx tsc -p config/tsconfig.json --noEmit
npm run lint:security
```

三个命令预期 exit **0**；`npm run lint:security` 只能报告 0 新增发现。V 或 G 任一失败，严格执行 R→V→G→S，RootCauseReport checker pass 只放行返工，不改变 1B failure 状态。

- [ ] **步骤 11：完成 1B 独立 commit。**

```bash
git add w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/lib/code-health-file-verifier.ts w-model-dev/scripts/lib/code-health-evidence-store.ts w-model-dev/scripts/lib/code-health-revision-provider.ts w-model-dev/scripts/lib/code-health-command.ts w-model-dev/scripts/lib/code-health-redaction.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts
git commit --no-gpg-sign -m "feat(code-health): inject evidence and revision verification"
```

暂停/完成：任何真实文件安全负例、scope/revision binding、redaction 或 raw-output exclusive write 无法证明时暂停；1B 不实现 reducer、apply、archive 或 Phase 1–4 业务逻辑。

---

## 任务 1C：Candidate-scoped append-only reducer、GapRow 和 approval boundary

**目的：** 让 candidate 生命周期成为可重放、角色受限、失败顺序严格、失败原子不写入的 reducer；让 GapRow 和 approval scope fail-closed；`applyApproved` 在 Task 1 只返回 typed `NOT_IMPLEMENTED`。

**文件：**

- 修改：`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/scripts/logic/code-health-contract.ts`、`w-model-dev/schemas/code-health-candidate.schema.json`、`w-model-dev/schemas/code-health-ledger-event.schema.json`、`w-model-dev/schemas/code-health-gap.schema.json`、`w-model-dev/schemas/code-health-approval.schema.json`、`w-model-dev/scripts/__tests__/code-health-ledger.test.ts`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`。
- 复用：1B 的 `EvidenceStore`、`FileVerifier`、`RevisionProvider`；不得在 reducer 内重新实现文件校验。

### 1C 步骤

- [ ] **步骤 1：写 reducer RED 测试。**

在 `code-health-ledger.test.ts` 使用 1B 真实 evidence ref，加入以下测试：

```ts
it('reducer 只更新目标 candidate，events append-only 且可重放', () => {
  const ledger = ledgerWithTwoCandidates();
  const next = transitionCandidate(ledger, firstId, evidencedEvent(firstId));
  expect(next.candidates.find((c) => c.candidateId === secondId)?.status).toBe('discovered');
  expect(next.events).toHaveLength(1);
  expect(replayCandidate(next, firstId).status).toBe('evidenced');
  expect(() => transitionCandidate(next, firstId, { ...evidencedEvent(firstId), eventId: next.events[0]!.eventId }))
    .toThrowError(expect.objectContaining({ code: 'STRUCTURE_INVALID' }));
});

it('状态、角色、candidate identity、revision、scope 和事件时间不匹配均拒绝且 ledger 深相等不变', () => {
  const before = structuredClone(ledger);
  expect(() => transitionCandidate(ledger, firstId, eventWithRole('approved', 'A'))).toThrow(/human|role/i);
  expect(() => transitionCandidate(ledger, secondId, eventFor(firstId))).toThrow(/candidate|scope/i);
  expect(() => transitionCandidate(ledger, firstId, eventWithOlderTimestamp())).toThrow(/timestamp|monotonic/i);
  expect(ledger).toEqual(before);
});

it('gate failure 必须是已验证 observed non-zero evidence，并把 nextRequiredRoles 固定为 R→V→G→S', () => {
  const blocked = recordGateFailure(ledger, firstId, realGateFailureEvidence);
  expect(blocked.candidates.find((c) => c.candidateId === firstId)?.status).toBe('blocked');
  expect(nextRequiredRoles(blocked, firstId)).toEqual(['R', 'V', 'G', 'S']);
  expect(() => recordGateFailure(ledger, firstId, { ...realGateFailureEvidence, exitCode: 0 }))
    .toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
  expect(() => recordGateFailure(ledger, firstId, { ...realGateFailureEvidence, observation: 'not_run', exitCode: null }))
    .toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
});
```

- [ ] **步骤 2：写失败顺序、GapRow、approval 和 apply RED 测试。**

```ts
it('没有完整 R→V→G 就不能由 S 返工，成功事件不能覆盖 blocked', () => {
  const blocked = recordGateFailure(ledger, firstId, realGateFailureEvidence);
  expect(() => appendReworkEvent(blocked, firstId, sReworkEvent)).toThrow(/R|root|review|gate/i);
  const afterR = appendRootCauseEvent(blocked, firstId, validRootCauseEvent);
  expect(nextRequiredRoles(afterR, firstId)).toEqual(['V', 'G', 'S']);
  expect(() => appendReworkEvent(afterR, firstId, sReworkEvent)).toThrow(/V|G/i);
});

it('GapRow 严格拒绝未知枚举、缺 risk、错误 candidate、空 evidence、coverage 非 signal-only 和未知字段', () => {
  const errors = validateGapMatrix({ rows: [{ ...validGap, kind: 'bogus', priority: 'urgent', status: 'verified', unknown: true, risk: null, coverageIsSignalOnly: false }] }, ledger);
  expect(errors).toEqual(expect.arrayContaining([
    expect.stringMatching(/kind|priority|status|risk|coverage|unknown|candidate/i),
  ]));
  expect(validateGapMatrix({ rows: [validGap, validGap] }, ledger)).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate|gapId/i)]));
});

it('approval 只能匹配 human exact scope/revision，applyApproved 返回 NOT_IMPLEMENTED 且不写工作树', async () => {
  const before = await gitStatus(tempRoot);
  const result = await applyApproved({ candidate, approval: validApproval, mode: 'dry-run' });
  expect(result).toMatchObject({ applied: false, errorCode: 'NOT_IMPLEMENTED', patchPath: null });
  expect(await gitStatus(tempRoot)).toEqual(before);
  await expect(applyApproved({ candidate, approval: { ...validApproval, actor: 'S-agent' }, mode: 'patch' }))
    .rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
  await expect(applyApproved({ candidate, approval: { ...validApproval, approvedFiles: ['src/outside.ts'] }, mode: 'commit' }))
    .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
});
```

- [ ] **步骤 3：运行 1C RED。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts -t "reducer|role|GapRow|approval|applyApproved|gate failure"
```

预期：Vitest exit **1**，原因是旧 reducer 使用普通 `Error`、全局最后事件时间、非 candidate-scoped gate failure 或会返回 archive/apply 半成功。确认失败原因属于 1C；若测试直接因 1B evidence fixture 无法生成，记录上游 1B blocker，不进入 1C 实现。

- [ ] **步骤 4：实现 append-only、candidate-scoped reducer。**

在 `code-health-ledger-logic.ts` 将 `transitionCandidate` 变成纯函数：先通过 canonical candidate/schema、candidate ID、event ID 全局唯一、event `from` 与当前状态、event revision 与 candidate revision、event scope 与 candidate selector、evidence refs 与已验证 evidence 的 binding；再按状态图和 event kind 检查角色。事件只能追加；不得删除、重排、覆盖、合并或重写历史。`replayCandidate(ledger, candidateId)` 从该 candidate 的 events 重算 status；嵌入 candidate status 与重放不一致即抛 `STRUCTURE_INVALID`。

状态图固定为：

```text
discovered → evidenced → under-review → approved → implemented → verified → archived
under-review → rejected | deferred | blocked
任何允许失败的活动状态 → blocked
blocked --完整 R→V→G 后 S rework--> evidenced
blocked --真实 rollback evidence--> rolled-back
```

同一 candidate 的 event 时间严格递增；event ID 在整个 ledger 唯一。正常状态事件角色固定为：A/S evidence、V review、human approval/reject/defer、S implemented、V/G verified、G/human archive（Task 1D 不实际产生 archive）、G/V/R/human blocked；R 不得修复或代签。

- [ ] **步骤 5：实现 `recordGateFailure`、`nextRequiredRoles` 和完整失败链。**

使用精确签名：

```ts
export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: GateFailureEvidence,
): CodeHealthLedger;
export function nextRequiredRoles(
  ledger: CodeHealthLedger,
  candidateId: string,
): Array<'R' | 'V' | 'G' | 'S'>;
export function appendRootCauseEvent(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
): CodeHealthLedger;
export function appendReworkEvent(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
): CodeHealthLedger;
```

`recordGateFailure` 只接受已由 1B verify 的 candidate/scope/revision/raw-output binding、`observation:'observed'`、整数真实 non-zero exit code 和 failure kind；失败调用在任何检查失败时返回 typed error，原 ledger、candidate status、其他 candidate 和 events 完全不变。`nextRequiredRoles` 按 candidate event history 返回尚缺角色：初始 blocked 为 `['R','V','G','S']`，完成每一顺序节点后去掉该角色；S 之前缺任一节点均阻塞。RootCauseReport 的结构 checker 不是该顺序的替代物。

- [ ] **步骤 6：实现严格 GapRow 和 approval scope。**

定义：

```ts
export function validateGapRow(
  row: unknown,
  ledger: CodeHealthLedger,
  seenGapIds: ReadonlySet<string>,
): string[];
export function validateGapMatrix(
  matrix: unknown,
  ledger: CodeHealthLedger,
): string[];
export function validateApprovalScope(
  candidate: CodeHealthCandidate,
  approval: ApprovalDecision,
): string[];
```

Gap validator 必须确认 candidate 在 ledger 中、gapId 合法且唯一、`kind`/`testLevels`/`priority`/`status` 是冻结枚举、所有数组类型正确且 evidence/RTM 不为空、missingScenario/owner 非空且不是无边界占位语义、RiskProfile 八字段齐全且枚举合法、coverage record 结构正确且 `coverageIsSignalOnly === true`、status 与 candidate lifecycle 一致、source revision 存在且绑定；unknown nested field 和跨 candidate 引用整行拒绝。Approval 必须精确比较 candidateId、action、files、symbols、scope hash、revision、human actor、decision、时间和 signature ref；S/V/G/O/Agent actor 不能产生 human approval。

- [ ] **步骤 7：实现 Task 1 `applyApproved` boundary。**

使用精确结果类型：

```ts
export interface ApplyResultNotImplemented {
  applied: false;
  errorCode: 'NOT_IMPLEMENTED';
  patchPath: null;
  appliedFiles: [];
  unrelatedFiles: [];
  rollback: null;
}
export type ApplyResult = ApplyResultNotImplemented;
export function applyApproved(input: ApplyApprovedInput): Promise<ApplyResult>;
```

函数先完整校验 candidate、approval、human exact scope、revision、mode 和 signature；非法输入抛 `CodeHealthError`（`SCOPE_MISMATCH`、`REVISION_MISMATCH` 或 `EVIDENCE_INVALID`），合法输入只返回上述 `NOT_IMPLEMENTED` 结果，不调用 `fs`、Git、patch、commit 或 ledger 写入。即使 `mode:'dry-run'` 也不能省略验证。不得返回空 patch、复制旧 patch、修改工作树或把 `applied:false` 改成 pass。

- [ ] **步骤 8：运行 1C GREEN。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts -t "reducer|role|GapRow|approval|applyApproved|gate failure"
npx tsc -p config/tsconfig.json --noEmit
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/schemas/code-health-candidate.schema.json w-model-dev/schemas/code-health-ledger-event.schema.json w-model-dev/schemas/code-health-gap.schema.json w-model-dev/schemas/code-health-approval.schema.json
```

预期：Vitest、tsc、Prettier 均 exit **0**；每个失败调用 ledger 深相等不变；valid event 可重放；`nextRequiredRoles` 顺序不可绕过；GapRow unknown/risk/coverage/candidate/duplicate 全拒绝；`applyApproved` 结果 `applied:false,errorCode:'NOT_IMPLEMENTED'`。

- [ ] **步骤 9：准备 V、执行 G 和独立 commit。**

V 输入：状态图、角色矩阵、event kind/schema parity、replay 前后 ledger、所有负例的 typed code、approval scope 和 apply worktree status。V 必须确认没有把 blocked 成功覆盖、没有从 V/G 直接跳 S、没有用报告 checker pass 代替 R→V→G、没有用 coverage 授权。

G 运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts -t "code-health"
npx tsc -p config/tsconfig.json --noEmit
npm run lint:security
```

预期三个命令 exit **0**。任一 V/G failure 立即走 R→V→G→S，不得直接改 reducer 后重跑。通过后提交：

```bash
git add w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/schemas/code-health-candidate.schema.json w-model-dev/schemas/code-health-ledger-event.schema.json w-model-dev/schemas/code-health-gap.schema.json w-model-dev/schemas/code-health-approval.schema.json w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
git commit --no-gpg-sign -m "feat(code-health): enforce candidate lifecycle reducer"
```

暂停/完成：1C 不得写 archive、执行真实 apply 或修改源码候选；任何状态重放不一致、角色越权、GapRow 漏字段、失败顺序缺节点、成功 gate failure 或 worktree 变化都阻塞。

---

## 任务 1D：ArchiveManifest boundary 冻结与 Task 8 承接

**目的：** 只冻结 Task 8 可以稳定消费的 `ArchiveManifest`、producer/consumer/verifier 接口、package-only/source-bound 语义和 `NOT_IMPLEMENTED` 错误结果；严禁在 Task 1 写 archive、readback 或 source-bound producer/consumer。

**文件：**

- 创建：`w-model-dev/scripts/lib/code-health-archive-boundary.ts`、`w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts`。
- 修改：`w-model-dev/scripts/logic/code-health-contract.ts`、`w-model-dev/scripts/logic/code-health-ledger-logic.ts`、`w-model-dev/schemas/code-health-archive.schema.json`、`w-model-dev/schemas/code-health-ledger-event.schema.json`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`、`w-model-dev/scripts/samples/code-health/valid-archive.json`。

### 1D 步骤

- [ ] **步骤 1：写 manifest 和 NOT_IMPLEMENTED RED 测试。**

```ts
it('ArchiveManifest 冻结 scope、files kind/hash、revision、签名、redaction 和 verificationLevel', () => {
  const manifest: ArchiveManifest = validManifest('package-only');
  expect(validateBySchema('code-health-archive', manifest).valid).toBe(true);
  expect(validateBySchema('code-health-archive', { ...manifest, verificationLevel: 'source-verified' }).valid).toBe(false);
  expect(validateBySchema('code-health-archive', { ...manifest, scope: { ...manifest.scope, unknown: true } }).valid).toBe(false);
});

it('Task 1D producer/consumer/verifier 全部返回 typed NOT_IMPLEMENTED 且没有文件或 ledger 副作用', async () => {
  const before = await snapshotTreeAndLedger(tempRoot);
  const boundary = createTask1ArchiveBoundary();
  await expect(boundary.producer.produce(producerInput)).resolves.toMatchObject({
    ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null,
  });
  await expect(boundary.consumer.consume(consumerInput)).resolves.toMatchObject({
    ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null,
  });
  await expect(boundary.verifier.verify(verifierInput)).resolves.toMatchObject({
    ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null,
  });
  expect(await snapshotTreeAndLedger(tempRoot)).toEqual(before);
});
```

- [ ] **步骤 2：运行 1D RED。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts
```

预期：Vitest exit **1**，原因是旧 `archiveCampaign` 能构造内存 manifest 或 `verifyArchive` 会读文件，尚无单独 boundary。任何在 RED 阶段得到 exit 0 的 archive producer/consumer 都是越界实现，应立即暂停并回退到 1D 起点。

- [ ] **步骤 3：实现 ArchiveManifest 和 boundary 接口。**

在 `code-health-archive-boundary.ts` 导出以下精确类型和工厂：

```ts
export interface ArchiveProduceInput {
  candidate: CodeHealthCandidate;
  ledger: CodeHealthLedger;
  approval: ApprovalDecision;
  verificationLevel: 'package-only' | 'source-bound';
}
export interface ArchiveConsumeInput {
  manifestPath: string;
  packageRoot: string;
  verificationLevel: 'package-only' | 'source-bound';
  sourceProject?: string;
}
export interface ArchiveVerifyInput extends ArchiveConsumeInput {
  expectedRevision?: RevisionIdentity;
}
export interface ArchiveBoundaryResult {
  ok: false;
  errorCode: 'NOT_IMPLEMENTED';
  manifest: null;
  verificationLevel: 'package-only' | 'source-bound';
  createdPaths: [];
  reason: string;
}
export interface ArchiveProducer { produce(input: ArchiveProduceInput): Promise<ArchiveBoundaryResult>; }
export interface ArchiveConsumer { consume(input: ArchiveConsumeInput): Promise<ArchiveBoundaryResult>; }
export interface ArchiveVerifier { verify(input: ArchiveVerifyInput): Promise<ArchiveBoundaryResult>; }
export function createTask1ArchiveBoundary(): {
  producer: ArchiveProducer;
  consumer: ArchiveConsumer;
  verifier: ArchiveVerifier;
};
```

所有三个方法先检查参数类型，合法和不合法的“真实 archive”调用均返回可识别的 `NOT_IMPLEMENTED` boundary 结果；不读取 `manifestPath`、不计算文件 hash、不调用 `sourceProject`、不创建目录/文件、不写 ledger。`package-only` 仅是输入/结果标签，不能被升级为 `source-bound`；没有 source project 的 source-bound 输入也不能被接受为 verified。

- [ ] **步骤 4：移除旧 archive 半实现。**

从 `code-health-ledger-logic.ts` 删除 manifest 拼装、`archiveFilesHash` 的 archive producer 用法、`fs.readFile` readback、`sourceProject` 猜测和 `archived` 状态写入。若已有调用方依赖 `archiveCampaign`/`verifyArchive` 名称，只保留无 IO 的 compatibility facade，将调用转给 `createTask1ArchiveBoundary()` 并返回同一 typed `NOT_IMPLEMENTED` 结果；不得保留第二套 `CodeHealthArchiveManifest` 或旧 `ArchiveResult` 字段。

- [ ] **步骤 5：运行 1D GREEN、V、G。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts -t "archive|NOT_IMPLEMENTED"
npx tsc -p config/tsconfig.json --noEmit
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/lib/code-health-archive-boundary.ts w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts w-model-dev/schemas/code-health-archive.schema.json
```

预期：三条命令 exit **0**；boundary tests 观察到 `ok:false`、`errorCode:'NOT_IMPLEMENTED'`、`manifest:null`、输入 verification level 原样保留、`createdPaths:[]`、ledger/tree 不变。V 输入包括旧 archive diff、manifest Schema、Task 8 禁止项和无副作用快照；G 不得运行或宣称 Task 8 archive 验证通过。

- [ ] **步骤 6：处理失败并提交 1D。**

任何 archive 文件、readback、source-bound hash、`archived` ledger event 或 exit 0 的 producer/consumer/verifier 都是 1D blocking failure，执行 R→V→G→S。通过后运行：

```bash
git add w-model-dev/scripts/lib/code-health-archive-boundary.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts w-model-dev/scripts/logic/code-health-contract.ts w-model-dev/scripts/logic/code-health-ledger-logic.ts w-model-dev/schemas/code-health-archive.schema.json w-model-dev/schemas/code-health-ledger-event.schema.json w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/scripts/samples/code-health/valid-archive.json
git commit --no-gpg-sign -m "feat(code-health): freeze task1 archive boundary"
```

### Task 8 明确承接验收项目

这些项目只登记为 Task 8 的入口条件，不得在 Task 1 实现或模拟：

1. 真实 producer 从已通过 lifecycle 的 candidate、evidence、V/G、human approval、rollback 生成确定性 manifest 和 package。
2. 真实 consumer 读取 package、重算 manifest/files/content hash、验证 signature refs、scope、redaction 和 retention。
3. 无 source project 时执行 package-only，结果必须明确标注 `package-only`，不能表述为 source verified。
4. 显式提供 source project 时执行 source-bound，验证 commit/tree/source bundle、列出文件、scope、工作树和当前 source identity。
5. 缺文件、symlink、错误 hash、stale revision、scope mismatch、敏感内容、非法 manifest、错误 verification level 和不满足 clean 条件都必须 fail-closed。
6. Task 8 不得放宽 1A–1D 的类型、ErrorCode、evidence binding、redaction 或 append-only contract。

---

## 任务 1E：真实隔离 Git 项目集成验收

**目的：** 在操作系统临时目录创建独立真实 Git 项目，验证 1A–1D 的真实正向链路、完整负向矩阵、`NOT_IMPLEMENTED` boundary、ledger 原子性、临时项目 clean 和当前仓库根目录不污染；1E 不是 Task 8 archive 验收。

**文件：**

- 创建：`w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts`。
- 修改：无新增业务源码；若前四段需要修复，只回到对应子任务并遵守该段独立 commit，不在 1E 直接补 patch。

### 1E 步骤

- [ ] **步骤 1：写临时 Git project helper 和 clean 基线测试。**

在测试文件中用 `fs.mkdtemp(path.join(tmpdir(), 'code-health-task1-integration-'))` 创建 root；所有 `git init`、user config、文件写入、commit、读取和清理都在该 root。建立：`src/candidate.ts`、`tests/candidate.test.ts`、`.w-model/code-health/raw/`、`evidence/`、一个 root 外目录、一个 file symlink 和一个 parent directory symlink。测试开始记录 `git status --porcelain`，并记录当前仓库 `git status --short` 的初始快照；禁止使用仓库根目录、已有 worktree、`.w-model` 或 fixture 名称替代真实临时项目。

- [ ] **步骤 2：写真实正向链路测试。**

测试名称和关键断言固定为：

```ts
it('真实 Git command→raw evidence→FileVerifier→candidate→V→human→S implemented→G/V verified 链路通过', async () => {
  const initialRevision = await revisionProvider.current(tempRoot);
  expect(initialRevision).not.toBeNull();
  const selector = makeSelector('CHG-P1-20260907-201', ['src/candidate.ts']);
  const binding = makeBinding(selector, initialRevision!);
  const command = await runner.run(process.execPath, ['-e', 'process.stdout.write("raw-evidence")'], {
    cwd: tempRoot,
    env: { NODE_ENV: 'test' },
    timeoutMs: 5000,
    binding,
  });
  expect(command.observation).toBe('observed');
  expect(command.exitCode).toBe(0);
  const evidence = await evidenceStore.verify(toEvidenceRef(command, initialRevision!), binding);
  expect(evidence).toMatchObject({ ok: true, code: null });
  const evidenced = transitionCandidate(ledger, selector.candidateId, evidenceEvent(command));
  const reviewed = transitionCandidate(evidenced, selector.candidateId, vReviewEvent(command));
  const approved = transitionCandidate(reviewed, selector.candidateId, humanApprovalEvent(validApproval));

  // 在隔离 temp project 中只改 approved exact file，模拟 S 的真实实现，绝不调用 Task 1 applyApproved。
  await fs.writeFile(path.join(tempRoot, 'src/candidate.ts'), 'export const candidate = 2;\n');
  expect(await gitDiffNames(tempRoot)).toEqual(['src/candidate.ts']);
  await gitCommit(tempRoot, 'apply approved exact scope');
  const implementedRevision = await revisionProvider.current(tempRoot);
  expect(implementedRevision).not.toBeNull();
  const implemented = transitionCandidate(
    approved,
    selector.candidateId,
    sImplementedEvent(command, implementedRevision!),
  );
  const gate = await runRealGateCommand(tempRoot, selector, implementedRevision!);
  const verified = transitionCandidate(implemented, selector.candidateId, gVerifiedEvent(gate));
  expect(verified.candidates.find((c) => c.candidateId === selector.candidateId)?.status).toBe('verified');

  const archive = await createTask1ArchiveBoundary().producer.produce({
    candidate: verified.candidates[0]!, ledger: verified, approval: validApproval, verificationLevel: 'package-only',
  });
  expect(archive).toMatchObject({ ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null });
  expect(await fs.stat(path.join(tempRoot, 'archive')).catch(() => null)).toBeNull();
});
```

正向链路中的 V、人类和 G 每个事件都要有独立 evidence ref、candidate/scope/revision binding；human actor 必须是明确人类身份；S 只能改 exact approved file；G/V 不能由同一角色或同一 evidence ref 代替。`applyApproved` 的真实调用在单独 boundary case 中必须返回 NOT_IMPLEMENTED，因此正向测试不能把它伪装成实际应用器。

- [ ] **步骤 3：写真实负向矩阵测试。**

使用每个 case 独立的 `mkdtemp` root 和全新 ledger，逐项断言 typed error code、ledger 深相等、candidate scope 不扩大、无 archive 文件、临时项目最终可检查。矩阵必须覆盖：

| Case ID | 真实操作 | 期望 typed 结果 |
| --- | --- | --- |
| `path-absolute` | `FileVerifier` 输入 Windows/POSIX absolute path | `STRUCTURE_INVALID` 或 `SECURITY_BLOCKED` |
| `path-parent` | `../outside` 和 root 外解析路径 | `STRUCTURE_INVALID` |
| `file-directory` | 以目录代替 regular file | `EVIDENCE_INVALID` |
| `file-symlink` | file symlink 指向 root 外 | `SECURITY_BLOCKED` |
| `file-parent-symlink` | 父目录 symlink 指向 root 外 | `SECURITY_BLOCKED` |
| `file-missing` | 缺失 raw/patch | `EVIDENCE_INVALID` |
| `hash-tamper` | 写后修改内容但保留旧 hash | `EVIDENCE_INVALID` |
| `utf8-invalid` | 子进程输出 `Buffer.from([0xff])` | `SECURITY_BLOCKED` |
| `revision-commit` | stale commit SHA | `REVISION_MISMATCH` |
| `revision-tree` | 错误 tree SHA | `REVISION_MISMATCH` |
| `revision-bundle` | 错误 source bundle SHA-256 | `REVISION_MISMATCH` |
| `candidate-mismatch` | evidence candidate ID 与当前 candidate 不同 | `SCOPE_MISMATCH` |
| `scope-mismatch` | evidence scope hash 与当前 selector 不同 | `SCOPE_MISMATCH` |
| `cross-candidate` | candidate A raw output 被 candidate B verify | `SCOPE_MISMATCH` |
| `env-unaudited` | 传入未审计环境键 | `SECURITY_BLOCKED` |
| `command-sensitive` | argv/output 含 secret/token/authorization/private key | `SECURITY_BLOCKED` |
| `command-shell` | 传入 shell pipeline 字符串 | `SECURITY_BLOCKED` 或 `ARG_INVALID` |
| `command-nonzero` | 子进程真实 exit 7 | `observed` 且 exitCode 7；不可记录 pass |
| `command-not-run` | timeout 后 exitCode null | `not_run`；不可记录 pass |
| `command-unavailable` | 不存在 executable | `unavailable`；不可记录 pass |
| `role-bypass` | A 批准、S 验证、V 代替 G 或 O 写 event | `STRUCTURE_INVALID` 或 `EVIDENCE_INVALID` |
| `duplicate-event` | 重复 eventId | `STRUCTURE_INVALID` |
| `event-gap` | 时间倒退、跳过状态或跳过 R/V/G | `STRUCTURE_INVALID` |
| `gap-invalid` | unknown kind/priority/status、缺 risk、未知字段、coverage false | `STRUCTURE_INVALID` |
| `approval-scope` | 非 human、scope 扩大、candidate 不一致 | `SCOPE_MISMATCH` 或 `EVIDENCE_INVALID` |
| `apply-not-implemented` | Task 1 调用 applyApproved | resolved `NOT_IMPLEMENTED`, `applied:false` |
| `archive-not-implemented` | Task 1 调用 producer/consumer/verifier | resolved `NOT_IMPLEMENTED`, `manifest:null` |
| `worktree-clean` | 正向完成后检查 root 和仓库根目录 status | 1E 必须 exit 0 且两个 status 为空 |

每个 negative case 还必须断言失败前后 `ledger.events.length` 不增加（合法 `recordGateFailure` 除外）、其他 candidate 不改变、`archive` 状态不是 `archived`、未创建 archive 目录或 manifest、错误中没有临时绝对路径/secret/token。

- [ ] **步骤 4：写 apply 和 archive boundary 无副作用测试。**

```ts
it('applyApproved 和所有 archive boundary 结果为 NOT_IMPLEMENTED，并保持 clean worktree', async () => {
  const before = await snapshotTempProject(tempRoot);
  const apply = await applyApproved({ candidate, approval, mode: 'patch' });
  expect(apply).toEqual({ applied: false, errorCode: 'NOT_IMPLEMENTED', patchPath: null, appliedFiles: [], unrelatedFiles: [], rollback: null });
  const boundary = createTask1ArchiveBoundary();
  for (const result of [
    await boundary.producer.produce(producerInput),
    await boundary.consumer.consume(consumerInput),
    await boundary.verifier.verify(verifierInput),
  ]) {
    expect(result.errorCode).toBe('NOT_IMPLEMENTED');
    expect(result.manifest).toBeNull();
  }
  expect(await snapshotTempProject(tempRoot)).toEqual(before);
});
```

- [ ] **步骤 5：运行 1E RED。**

运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts
```

预期：在 1A–1D 尚未全部实现时 Vitest exit **1**；失败必须能归因到缺 canonical/evidence/reducer/boundary，而不是用 fake 或复制历史输出让测试通过。若 Git、symlink 或平台命令不可用，测试记录 `unavailable` 并整体阻塞，不改写为 pass。

- [ ] **步骤 6：实现并运行 1E GREEN。**

1E 只编排 1A–1D 的公开接口，不在测试中复制校验逻辑，不使用仓库根目录，不写当前 `.w-model`。运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts
npx tsc -p config/tsconfig.json --noEmit
npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts
```

预期三条命令 exit **0**；正向链路真实观察 Git revision、raw output、FileVerifier hash、V/human/S/G 事件和 verified 状态；archive/apply 明确是 NOT_IMPLEMENTED；全部负向 case fail-closed；临时 root `git status --porcelain` 为空；当前仓库 status 与测试开始快照相同。

- [ ] **步骤 7：准备 V、执行 G 和失败闭环。**

V 输入：临时项目创建日志、初始/最终 `git status --porcelain`、commit/tree/source bundle hashes、每条 command raw-output hash、candidate/scope binding、正向 event history、全部负向 case 的 error code 和无副作用快照。V 必须确认 1E 证明的是 Task 1 contract/lifecycle integration，而不是 archive 完成；不得把 `NOT_IMPLEMENTED`、report checker、coverage 或 22 项数量当作 archive pass。

G 运行：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts
npx tsc -p config/tsconfig.json --noEmit
npm run lint:security
```

三个命令预期 exit **0**。G 额外执行并记录：

```bash
git status --short
git diff --name-only
```

预期当前仓库只出现本计划及前四段已批准变更，不出现 `.w-model/`、`coverage/`、`.zcode/` 或临时项目路径。若当前仓库本来有用户变更，G 必须与开始快照比较，不得清理或覆盖。

- [ ] **步骤 8：完成 1E 独立 commit。**

V/G 通过且人类确认 1E scope 后运行：

```bash
git add w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts
git commit --no-gpg-sign -m "test(code-health): accept task1 in isolated git project"
```

暂停/完成：任何临时项目泄漏到仓库、正向链路使用 fake revision/raw output、负向 case 未 fail-closed、clean status 非空、apply/archive 产生副作用、或把 1E 结论写成 Task 8 archive pass，均阻塞并走 R→V→G→S。1E 通过只表示 Task 1 contract/evidence/lifecycle/boundary integration 通过。

---

## Task 1 最终验证矩阵

只有 1A、1B、1C、1D、1E 五个独立 commit 均有 V/G 通过证据后，才能运行并填写以下矩阵。每行必须记录命令版本、开始/结束 UTC、真实 stdout/stderr raw-output hash、exit code、candidate/scope/revision binding 和状态；不能用估算或复制上一轮结果。

| 检查 | 命令 | 通过条件 | `not_run` / `unavailable` / `unverified` 处理 |
| --- | --- | --- | --- |
| focused 22 项 | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts` | 真实结果 22 total / 22 passed / 0 failed；原 6 failure 各有 R→V→G→S 闭环 | 任一未运行为 `not_run`；总数变化或 revision 未绑定为 `unverified`，均不通过 |
| 1A contract tests | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-contract.test.ts` | exit 0，canonical exports、compile-only consumer、Schema/runtime parity 全通过 | 缺 Ajv/模块为 `unavailable`，不能改成 pass |
| 1B evidence tests | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-evidence.test.ts` | exit 0，真实 regular/non-symlink/父目录 symlink/越界/hash/revision/scope/redaction 全覆盖 | symlink/Git 权限失败为 `unavailable` 并阻塞；raw evidence 无 source binding 为 `unverified` |
| 1C reducer tests | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts -t "reducer|role|GapRow|approval|applyApproved|gate failure"` | exit 0，replay、唯一性、时间、R→V→G→S、GapRow、approval、NOT_IMPLEMENTED 全通过 | 未运行是 `not_run`；仅 checker 通过是 `unverified` |
| 1D boundary tests | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-archive-boundary.test.ts` | exit 0，manifest contract parity 和三入口 NOT_IMPLEMENTED 无副作用 | 任何 archive read/write 未执行不叫 pass；结果缺 source identity 为 `unverified` |
| 1E integration | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-task1-integration.test.ts` | exit 0，真实临时 Git 正向链路、完整 negative matrix、apply/archive boundary 和 clean worktree | Git/symlink/平台不可用为 `unavailable`，不允许弱化测试 |
| Schema | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/schema-validation.test.ts` | 九个 Schema 注册、description、required、enum、additionalProperties、fixtures 和 runtime parity 通过 | Schema loader 不可用为 `unavailable` |
| TypeScript | `npx tsc -p config/tsconfig.json --noEmit` | exit 0，无 implicit any、unused、contract consumer 漂移 | 未运行是 `not_run` |
| Prettier | `npx prettier --check --config config/prettier.config.cjs w-model-dev/scripts/**/*.ts w-model-dev/schemas/code-health-*.schema.json` | exit 0，无格式漂移 | 未运行是 `not_run` |
| Security | `npm run lint:security` | exit 0，0 新增发现，39d1671 redaction/path facts 保留 | 工具不可用为 `unavailable` |
| self-test | `npm run self-test` | exit 0，所有新增 valid/bad fixture 真实登记且 expected outcome 正确 | 未运行是 `not_run`，不得把 fixture 存在当 pass |
| samples coverage | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | exit 0，每个 fixture 被 self-test 引用、每个子目录在 README 矩阵声明 | 未运行是 `not_run` |
| docs-consistency | `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` | exit 0，Schema descriptions、registries、action/target、既有 18 项 pre-push 和 live facts 一致 | 未运行是 `not_run`；不准手改计数绕过 |
| 全量 npm test | `npm test` | exit 0，除 focused 外全部 Vitest 回归通过 | 长测试未执行必须标 `not_run`，不能写通过 |
| pre-push | `npm run prepush` | exit 0，既有 18 项顺序/退出语义、安全扫描和依赖预检不变 | 长测试未执行标 `not_run`；平台依赖缺失标 `unavailable`；不允许跳项 |
| codegraph（阶段 5–8 规则） | 目标项目上 `mcp__codegraph__codegraph_explore` + `npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts --scope=...` | 只有实际阶段 5–8 改代码/测试时才要求 query coverage；本仓库无索引时真实记录 unavailable | unavailable 必须阻塞对应阶段，不能伪造 `.w-model/codegraph-queries` |
| root cause checker | `npx tsx w-model-dev/scripts/cli/check-rootcause-report.ts <report>` | 只证明 RootCauseReport schema/完整性；不是 Task 1 功能 pass | 失败必须回到 R→V→G→S |
| NOT_IMPLEMENTED boundary | 1D/1E tests + tree/ledger snapshots | apply、producer、consumer、verifier 均 typed NOT_IMPLEMENTED；`applied:false`、`manifest:null`、无 archive、无 `archived`、worktree clean | 未观察到真实结果为 `unverified`，不能宣称 Task 1 pass |

最终矩阵还必须核对：

1. focused ledger 22 项中 16 项历史通过不能抵销 6 项失败；六项必须逐一有 failure raw output、RootCauseReport、V review、G report 和 S rework 后重新验证的闭环。
2. `bab618a` 的 rollback patch/sha/raw-output/source revision 和 archive evidence binding 只能被拆到 1B/1C/1D 的接口与校验；真实 archive 行为仍未实现。
3. `39d1671` 的 shell false、audited env、UTF-8、redaction、regular/non-symlink、exclusive raw output、真实 exit code 和不泄露绝对路径事实逐项保留。
4. 任何 `observed` non-zero、`not_run`、`unavailable`、`unverified` 不能进入成功状态；coverage 只能是 signal，不能授权 candidate。
5. 当前仓库最终 `git status --short` 只能显示本计划和实际批准实现 commit 的预期文件；不得出现 `.w-model/`、`coverage/`、`.zcode/`、临时 Git root 或 archive package。

## 计划完成前的规格覆盖度、占位符和类型一致性自检

执行者在开始实现前必须逐条对照 approved spec §1–§14；本计划已将 §5 映射至 1A、§6 至 1B、§7 至 1C、§8 至 1D、§9 至 1E、§10 至 1A/1B/1D、§11 至每段统一纪律、§12–§14 至最终矩阵和授权边界。计划自检命令如下：

```bash
rg -n "Task 1|1A|1B|1C|1D|1E|Task 8|CandidateSelector|EvidenceBinding|RollbackEvidence|GateFailureEvidence|ArchiveManifest|ErrorCode|Schema|runtime|regular|symlink|source bundle|NOT_IMPLEMENTED|R→V→G→S|22 total|16 passed|6 failed|codegraph|pre-push|L0|L1|redaction|no LLM" docs/superpowers/plans/2026-09-07-code-health-task1-resplit.md
rg -n 'T[O][D][O]|待[定]|适当[处]理|类似[任]务|placeh?older|T[B]D' docs/superpowers/plans/2026-09-07-code-health-task1-resplit.md
```

第一条必须覆盖所有规格主题；第二条必须 **0 命中**。随后人工检查所有跨任务名字：`CandidateSelector`、`EvidenceBinding`、`RevisionIdentity`、`CommandEvidence`、`GateFailureEvidence`、`RollbackEvidence`、`ArchiveManifest`、`CodeHealthError`、`FileVerifier`、`EvidenceStore`、`RevisionProvider`、`ApplyResult`、`ArchiveBoundaryResult`、`validateGapRow`、`validateGapMatrix`、`recordGateFailure`、`nextRequiredRoles`、`appendRootCauseEvent`、`appendReworkEvent` 和四个 compile-only consumer 均只在 1A 定义一次，后续任务只导入同一名字和签名。发现字段名、错误码、返回值或 verification level 不一致时，在实现前修正计划，不以兼容别名掩盖冲突。

本计划的交付只新增本文件；计划执行阶段的每个实现子任务另有独立 commit，不能把任何 Task 8 代码、archive 文件、`.w-model`、coverage 或 `.zcode` 放入 Task 1。
