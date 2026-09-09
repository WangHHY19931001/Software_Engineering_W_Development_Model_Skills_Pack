# Code Health Task 1 五段串行拆分设计

> **文档状态：已批准拆分设计；实现尚未授权。**
>
> **日期：** 2026-09-07
> **适用范围：** Code Health Campaign Task 1 及其后续 Task 8 的接口承接
> **基线：** `bab618a`（`fix(code-health): bind archive evidence to source`）

## 1. 决策摘要

本设计将已批准的 Code Health Task 1 拆分为五个严格串行、各自可审查和可门禁的子任务：

1. **1A Contract freeze：** 冻结 canonical types、Schema、错误语义及 compile-only contract。
2. **1B Evidence verifier：** 引入注入式 `EvidenceStore` / `FileVerifier`，冻结证据文件、哈希、版本、候选和 scope 绑定，以及 command/redaction 边界。
3. **1C Lifecycle/role reducer：** 实现 candidate-scoped、append-only 的生命周期 reducer，冻结状态、角色、失败顺序、`GapRow` 严格校验，以及 `applyApproved` / `recordGateFailure` 边界。
4. **1D Archive boundary：** 只冻结 `ArchiveManifest` 与 package-only/source-bound/`NOT_IMPLEMENTED` 语义；不实现真实归档 producer、consumer 或验证器。
5. **1E Integration acceptance：** 在隔离的临时 Git 项目中验收前四段的真实正向链路、负向矩阵和工作树 clean；归档行为仍以未实现为预期结果。

**Task 8 承担真实 archive producer/consumer，以及 package-only/source-bound 验证。** Task 1D 不得提前实现这些能力，也不得用内存对象、引用文件名、报告 checker 通过或模拟输出冒充归档成功。

串行依赖固定为：

```text
1A Contract freeze
  ↓
1B Evidence verifier
  ↓
1C Lifecycle/role reducer
  ↓
1D Archive boundary（仅接口；未实现时 fail-closed）
  ↓
1E Integration acceptance
  ↓
Task 8：真实 archive producer/consumer + package-only/source-bound 验证
```

任何子任务的 V 审查或 G 验证失败，都必须停止当前串行链路，先走 R → V → G → S 返工纪律；不得跳到后一个子任务，不得把失败项改写成非阻塞，也不得以测试数量或报告数量抵销失败。

## 2. 背景与阻塞事实

### 2.1 当前基线

- `bab618a` 是本次拆分的代码基线。该提交已经把归档相关证据进一步绑定到真实文件、文件哈希和 source revision，但这不等于整个 Task 1 已完成。
- `39d1671`（`fix(code-health): harden command evidence safety`）已经收紧 command evidence 的工作目录、raw-output 目录、非符号链接文件、UTF-8 输出、审计环境变量和 redaction 边界。这些安全事实必须在拆分后保留，不能因重构而退化。
- `bab618a` 和 `39d1671` 都是迁移输入，不是新的 Task 1 通过证明。迁移必须保留其已验证的安全不变量，并把职责移到本设计规定的边界。

### 2.2 Focused ledger 的阻塞事实

本次拆分以 focused ledger 的真实结果为阻塞事实：**22 total / 16 passed / 6 failed**。其含义是：

- 22 个聚焦检查项中有 6 项失败，Task 1 不能标记为通过，也不能进入整体完成状态。
- 16 项通过只说明这些检查项各自通过，不能抵销另外 6 项失败。
- 报告 checker 通过，只能证明对应报告的结构、字段或格式满足 checker 规则；它不能证明 Task 1 的 contract、证据完整性、生命周期顺序、归档边界或集成链路已经通过。
- **禁止把「报告 checker 通过」写成「Task 1 通过」。** Task 1 的通过必须由 1A–1E 的逐段 V/G 证据、真实退出码、失败项闭环和 1E 集成验收共同证明。
- 任何尚未定位根因的失败项都保持 blocking；不得用 `deferred`、`not_applicable` 或“后续 Task 8 会处理”掩盖本来属于 1A–1E 的失败。

### 2.3 当前阻塞的设计原因

现有实现把几类不同职责放在同一组逻辑中，导致以下风险：

1. 类型和 Schema 尚未作为独立的上游 contract 冻结，调用方容易依赖未稳定的运行时细节。
2. 文件存在性、regular-file、non-symlink、SHA-256、source revision 和 scope 绑定混在生命周期判断中，无法独立注入和测试。
3. candidate 状态 reducer、角色授权、失败记录、gap 校验和实际变更执行的边界不够清晰。
4. 归档函数同时包含 producer、manifest 组装、验证级别选择和 source-bound 判断，容易把“能生成一个对象”误判为“归档已完成”。
5. 集成验收缺少隔离的临时 Git 项目，无法证明真实 patch、revision、tree、source bundle 和工作树 clean 的全链路关系。

本拆分只解决职责和验收边界，不扩大 Code Health Campaign 的业务范围。

## 3. 目标与非目标

### 3.1 目标

- 以 1A–1E 的串行方式冻结 Task 1 的最小可实现 contract。
- 让证据校验可注入、可独立测试，并且对真实 regular file、non-symlink 文件、内容哈希和 source identity 做 fail-closed 校验。
- 让生命周期更新成为 candidate-scoped、append-only、角色受限且顺序确定的 reducer。
- 让 gap 行输入拒绝未知字段、错误枚举、错误候选身份、错误 coverage 语义和不完整风险记录。
- 明确 Task 1 可以验证什么、不能实现什么，防止 Task 1 越界实现 archive producer/consumer。
- 用隔离临时 Git 项目验证真实正向链路、关键负向路径和工作树 clean。
- 为 Task 8 留下稳定、可独立消费的 `ArchiveManifest`、验证级别和错误语义。

### 3.2 非目标

- 不实现 Code Health Phase 1–4 的完整发现、静态分析、动态分析、TDD harness、测试补齐、死代码删除或抽象迁移。
- 不实现真实 archive producer、archive consumer、package-only verifier 或 source-bound verifier；这些属于 Task 8。
- 不修改当前 pre-push gate 顺序、版本、L0/L1 边界、W-Model 编排边界或 no-runtime-LLM 约束。
- 不修改现有源码、测试、计划、活体文档、`.w-model` 或其他文件作为本设计交付的一部分；本次交付只新增本规格文件。
- 不把 coverage 数值、报告数量、checker 通过、静态搜索无命中或 LLM 判断当作 Task 1 的独立通过依据。
- 不在 Task 1 中引入网络访问、LLM SDK、外部服务、隐藏的全局文件系统状态或隐式的当前工作目录依赖。
- 不把 Task 8 的后续实现假设写成 Task 1 当前已实现事实。

## 4. 角色、依赖和串行边界

### 4.1 角色责任

| 角色 | 本拆分中的责任 | 权限边界 |
| --- | --- | --- |
| O | 路由 1A–1E、记录 checkpoint、传递产物和状态 | 不实现、不解释测试结果、不代替 V/G、不修改产物 |
| A | 为每段提供影响面、已有 contract 和迁移清单 | 不批准、不改实现、不把发现当结论 |
| S | 按当前子任务实现和测试 | 只能修改批准 scope；发现超纲缺陷立即停止 |
| V | 独立检查 contract、实现、证据、范围和失败处理 | 不替 S 修复，不以自己的判断替代 G 或人类决定 |
| G | 执行确定性验证并记录真实退出码、版本和 raw output | 不使用估算、复制结果或模拟结果放行 |
| R | 对 V/G 失败做根因分析，产出 RootCauseReport | 不直接修复，不跳过 V 复审和 G 门禁 |
| 人类决策者 | 在需要时确认范围、批准后续实现或处理材料歧义 | 只能批准明确的候选和 scope，不批准模糊的整体目标 |

### 4.2 依赖图

```text
1A：canonical types / Schema / errors / compile-only contract
  │  输出：稳定类型、Schema、错误分类、编译契约
  ▼
1B：EvidenceStore / FileVerifier
  │  输入：1A 类型和错误；输出：可注入的证据验证边界
  ▼
1C：candidate-scoped append-only reducer
  │  输入：1A 类型 + 1B evidence；输出：状态、角色、失败和 gap 规则
  ▼
1D：ArchiveManifest boundary
  │  输入：1A–1C 的对象和验证结果；输出：接口与 NOT_IMPLEMENTED 语义
  │                         └── Task 8 后续实现真实 producer/consumer/verifier
  ▼
1E：isolated integration acceptance
      输入：1A–1D；验收真实链路、负向矩阵、clean worktree
```

依赖规则：

- 每段只能消费前段已通过的公开 contract，不得读取后段未冻结的内部实现。
- 1B 不依赖真实 archive；1C 不直接写归档；1D 不创建真实归档文件；1E 不把 `NOT_IMPLEMENTED` 失败改成成功。
- Task 8 可以依赖 1D 的接口，但不能反向要求 1D 在 Task 1 中实现 Task 8 的 producer/consumer。
- 任何 scope 扩展都必须重新计算依赖图，并重新经过 V、G 和人类 checkpoint。

## 5. 1A：Contract freeze

### 5.1 Canonical types

1A 冻结以下 canonical types，名称和语义不得由后续子任务私自改写。具体序列化可使用现有 TypeScript 类型和 JSON Schema，但两者必须保持同一事实来源：

- `RevisionIdentity`：`commitSha`、`treeSha`、`sourceBundleSha256`、`analyzedAt`。四项均必填；`commitSha` 和 `treeSha` 必须是合法 Git 对象身份，`sourceBundleSha256` 必须是 64 位小写 SHA-256，`analyzedAt` 必须是严格 UTC 时间。
- `CommandEvidence`：command、repository-relative `cwd`、显式审计后的 environment、platform、toolVersions、startedAt、endedAt、真实 `exitCode`、`observation`、raw output 相对路径和 `rawOutputSha256`。`exitCode = null` 只能表示没有进程结果，不能表示通过。
- `CodeHealthCandidate`：candidate identity、phase/action、status、files/symbols/tests、revision、scope、risk、RTM/coverage 影响、rollback、review、signatures 和 archive 状态。
- `GapRow`：见 § 7.4，严格要求 candidate identity、kind、test levels、missing scenario、evidence sources、risk、priority、owner、RTM、coverage signal 和 status。
- `LedgerEvent`：唯一 event identity、candidate identity、`from` / `to`、actor role、时间、revision、evidence refs、signature ref 以及按目标状态要求的 gate failure、rollback 或 archive evidence。
- `ApprovalDecision`：candidate identity、action、approved files/symbols、scope hash、decision、rationale、human actor、时间和 signature ref。
- `ArchiveManifest`：见 § 8；Task 1 只冻结结构和结果语义，不实现 producer/consumer。
- `ErrorCode` / typed errors：至少区分 `ARG_INVALID`、`STRUCTURE_INVALID`、`EVIDENCE_INVALID`、`SCOPE_MISMATCH`、`REVISION_MISMATCH`、`SECURITY_BLOCKED` 和 `NOT_IMPLEMENTED`。错误类别必须可由调用方稳定判断，不能依赖自然语言 substring。

### 5.2 Schema contract

- 所有落盘或跨边界传输的 canonical object 必须有对应 JSON Schema；必填字段、枚举、格式、`additionalProperties` 和字段描述必须明确。
- Schema 失败是结构错误或证据错误，不得降级为 warning 后继续生命周期推进。
- Schema 校验必须拒绝未知顶层字段和未知嵌套字段，除非 contract 明确声明该对象是开集 map；开集字段必须逐字段说明理由。
- `coverageIsSignalOnly` 固定为 `true`；coverage 只能作为定位和影响信号，不能单独授权 candidate 通过。
- `observation` 的 `not_run`、`unavailable`、`unverified` 都不是通过状态；未知不得归一为 `pass`。
- archive manifest 的 `verificationLevel` 只能是 `package-only` 或 `source-bound`，且二者含义不可互换。

### 5.3 Error contract

每个 public contract 必须：

1. 对输入结构、身份、范围、revision、文件安全性和生命周期语义分别给出稳定错误类别。
2. 在错误对象中保留安全的 repository-relative path、candidate ID、scope hash、expected/actual revision（如可安全提供）和可行动 reason。
3. 不把绝对路径、secret、token、原始敏感命令参数或未脱敏环境变量放入错误信息。
4. 在无法确认安全性时返回 blocking error；不得返回部分成功对象供上游猜测。
5. 把 `NOT_IMPLEMENTED` 与“输入非法”“证据无效”“验证失败”区分开，防止调用方把未实现误认为业务失败或成功。

### 5.4 Compile-only contract

1A 的测试只验证 contract 可被正确导入、赋值、序列化类型检查和 Schema 编译；不得以运行时实现代替 compile-only contract。至少包含：

- 合法 candidate、event、evidence、gap、approval 和 manifest 可以通过类型检查和 Schema 编译。
- 缺少必填字段、错误枚举、错误 `coverageIsSignalOnly`、错误 verification level 和未知字段会在 compile/Schema 层被拒绝。
- 1A 测试不得要求真实 Git、真实文件、真实 archive、子进程或完整全量测试。
- 1A 结束条件是 V 确认类型/Schema/error 互相一致，G 以确定性 compile/schema 命令给出真实 exit code；不代表 1B–1E 已通过。

## 6. 1B：Evidence verifier

### 6.1 注入式边界

1B 定义两个可注入接口，生命周期和业务 reducer 不得直接依赖全局 `fs` 或隐式 `process.cwd()`：

```ts
interface FileVerifier {
  verifyRegularNonSymlinkFile(input: {
    root: string;
    relativePath: string;
    expectedSha256: string;
  }): Promise<FileVerificationResult>;
}

interface EvidenceStore {
  putRawOutput(input: {
    candidateId: string;
    scopeHash: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<StoredEvidenceRef>;

  verify(ref: EvidenceRef, binding: EvidenceBinding): Promise<EvidenceVerificationResult>;
}
```

接口名和语义为冻结目标；具体泛型、模块路径和实现方式由后续实现计划决定，但不得删除以下安全不变量。

- `FileVerifier` 只接受受控 root 下的 repository-relative path；绝对路径、`..` 越界、空路径和路径解析到 root 外都必须拒绝。
- 文件必须是 regular file，且路径本身及其父目录链不得包含 symlink；`lstat`、realpath 和最终文件检查必须共同防止替换竞态造成的越界读取。
- 内容必须按字节计算 SHA-256，并与 expected hash 精确匹配；缺文件、读取错误、类型错误、哈希不匹配都 fail-closed。
- `EvidenceStore` 写入 raw output 必须使用受控目录、独占创建或等价的不可覆盖语义，不能把既有文件或符号链接当作新证据。
- 返回值必须区分 `observed`、`not_run`、`unavailable`、`unverified`；存储成功不等于命令通过。

### 6.2 Revision、tree 和 source-bundle 绑定

每一份可用于 lifecycle 决策的 `CommandEvidence` 必须能追溯到一个 candidate revision：

- `commitSha` 绑定被分析或测试的 Git commit；无 Git commit 或 commit 无法确认时为 `unverified`，不得通过。
- `treeSha` 绑定该 commit 的 tree；不能只记录 HEAD 名称、分支名或短 SHA。
- `sourceBundleSha256` 绑定实际用于分析/验证的 source bundle；source bundle 缺失、哈希不匹配或与 candidate revision 不一致时阻断。
- `analyzedAt` 只记录事实时间，不能替代 revision identity。
- candidate、command、raw output、rollback patch 和 lifecycle event 的 source revision 必须按 contract 互相一致；任何 stale 或 cross-candidate revision 都返回 `REVISION_MISMATCH`。
- 在 Task 1 范围内，source-bound 只表示“证据声明了并验证了 source identity”；它不表示已完成 Task 8 的 archive source-bound consumer 验证。

### 6.3 Candidate 和 scope 绑定

- 每份 `CommandEvidence` 必须带 candidate ID 和 scope hash，或由 1A 明确的不可绕过 binding object 携带；不能只靠文件名或调用方上下文推断。
- evidence ref 的 candidate ID、scope hash、revision、raw output path 和 raw output hash 必须与当前 candidate 完全匹配。
- command 结果不能被另一个 candidate 复用；同一 candidate 的 scope 变更会产生新 scope hash，并使旧 evidence 失效。
- `recordGateFailure`、rollback evidence 和后续 approval 只能引用已通过 1B 验证的 evidence；引用不存在、路径不安全、hash 不匹配或 candidate 不一致的 evidence 都必须阻断。

### 6.4 Command / redaction 边界

沿用并结构化迁移 `39d1671` 的安全事实：

- command 使用 `shell: false`；command、args、cwd、environment 和 output 都必须经过安全边界处理。
- cwd 必须位于受控 repository root 下，输出目录必须位于仓库内受控目录下，目录链不得含 symlink。
- environment 只允许显式审计的键；未审计键、secret、token、authorization、private key 和敏感 payload 必须拒绝或安全脱敏，不能静默传递。
- stdout/stderr 必须按字节收集并严格 UTF-8 解码；非法 UTF-8、不可安全 redaction 或 redaction 后仍含敏感内容时返回 `SECURITY_BLOCKED`。
- raw output 只保存脱敏后的内容和其 SHA-256；错误信息不泄露绝对路径和敏感环境值。
- `observation = observed` 仅表示进程确实退出并记录了真实 exit code；只有 contract 指定的零退出码才可作为 command pass。
- Task 1 不得新增“为方便测试而关闭 redaction”“复用未验证 raw output”“把 stderr 丢弃”或“把 null exit code 归一为 1/0”的旁路。

### 6.5 1B 验收

1B 必须至少有独立 RED/GREEN 用例覆盖：regular file、目录、symlink、父目录 symlink、越界路径、缺文件、错误 SHA-256、stale commit/tree/source bundle、candidate mismatch、scope mismatch、非法 UTF-8、未审计环境键、敏感输出和真实 non-zero exit code。

1B 通过条件：V 确认注入边界没有隐式全局依赖且安全不变量未退化；G 运行确定性验证并记录真实结果；任何一项 evidence 安全负例未被拒绝，均为阻塞。

## 7. 1C：Lifecycle / role reducer

### 7.1 Candidate-scoped、append-only reducer

1C 将生命周期更新定义为纯粹、candidate-scoped 的 reducer：

```text
(previous ledger, candidateId, event, validated evidence, optional approval)
  → next ledger 或 typed blocking error
```

硬约束：

- reducer 只能更新指定 candidate；event 的 candidate ID、previous status、revision、scope hash 和 evidence refs 必须逐项匹配。
- `events` 只能追加，不能删除、重排、覆盖、合并或通过重新生成整个 ledger 隐藏历史；event ID 必须唯一，时间必须单调。
- candidate 当前状态必须由 append-only event history 可重放得到；内嵌 status 与重放结果不一致时 fail-closed。
- 任何无 evidence、未知 observation、stale revision、scope 扩大、角色不匹配或非法转移都返回 typed error，且不产生部分写入。
- reducer 不负责实际修改源码、应用 patch、写真实 archive 或运行命令；这些行为由明确的后续边界承接。

### 7.2 状态集合与角色约束

状态集合固定为：

```text
discovered → evidenced → under-review → approved → implemented → verified → archived
```

另外允许明确的终止或阻塞状态：`rejected`、`deferred`、`blocked`、`rolled-back`。具体可达边必须由 Schema 和 reducer 双重约束；禁止任意跳转、回写成功状态或从未知状态恢复为通过。

最小角色约束：

- `A` 负责 discovery/evidence；不得批准或自行验证自己的结论。
- `V` 负责独立 review；不得充当 G，也不得把 review 通过当作 gate 通过。
- `human` 才能产生 `approved` 的正式批准事件，且批准 action/files/symbols/scope hash 必须精确匹配。
- `S` 负责 approved scope 内的实现；不得扩大 scope，不得自行声明 verified。
- `V` / `G` 才能分别提供 review / gate 的验证事件；两者必须有独立 evidence。
- `G` 记录失败时只能进入 `blocked`，不得用成功状态覆盖失败。
- `R` 只能在 V/G 失败后定位根因；R 不执行修复、不代签通过。
- `human` 可作明确的拒绝、延期、回滚决定，但不能把缺失 evidence 改写为 verified。

### 7.3 失败顺序与返工顺序

失败处理固定为：

```text
V/G 失败
  → R 根因报告
  → V 复审 RootCauseReport
  → G 校验 RootCauseReport
  → S 按报告返工
  → 重新执行当前子任务的 V/G
```

- `recordGateFailure` 必须先验证 gate failure evidence，再追加 candidate-scoped `blocked` event；失败 evidence 必须包含 candidate ID、scope hash、revision、真实 non-zero exit code、raw output path/hash 和 failure kind。
- 普通失败不能直接从 V/G 跳到 S；没有 R、R 报告没有 V 复审或没有 G 验证，均不得返工。
- 失败顺序本身必须可由 ledger 重放和测试断言；后写的成功 event 不能掩盖先前 blocking event。
- 失败的 `recordGateFailure` 调用必须原子失败，不得追加半个 event、修改 candidate status 或污染其他 candidate。

### 7.4 `GapRow` 严格校验

`GapRow` 是 1C 的输入 contract，不是对 coverage 数值的包装。校验器必须：

- 要求合法且唯一的 `gapId`，并要求 `candidateId` 指向当前 ledger 中存在的 candidate。
- 拒绝未知 `kind`、`testLevels`、`priority`、`status` 和风险枚举；不接受 `urgent`、`bogus` 等近似值。
- 要求 `testLevels`、`existingTestIds`、`evidenceSources`、`rtmIds` 为数组；路径、ID 和字符串必须满足各自的非空及 repository-relative contract。
- 要求 `missingScenario`、`owner` 非空且可审计；不能使用“待补”“以后处理”等无边界占位语义。
- 要求完整 `RiskProfile`，包括 severity、behavior、security、concurrency、platform、lifecycle、governance 和 rationale；不能以 null 或缺字段表示未知。
- 要求 `coverageSignal` 结构有效且 `coverageIsSignalOnly === true`；coverage 不能成为批准、实现或归档的充分条件。
- 要求 status 与 candidate 当前生命周期一致；不可把 gap 标记为 `verified` 而 candidate 仍未实现或未验证。
- 拒绝额外字段、重复 gap ID、跨 candidate 引用、空 evidence source 和未绑定 source revision。

### 7.5 `applyApproved` 边界

`applyApproved` 的职责仅是校验并把一个已经由 human 明确批准的 exact scope 交给后续实现边界；在 Task 1 中它不得执行真实源码修改。规则如下：

- 必须验证 candidate、approval、action、files、symbols、scope hash、human actor、时间、signature ref 和当前状态。
- 任何 scope 扩展、approval candidate mismatch、非 human actor、缺 signature 或 stale revision 都返回 blocking error。
- `mode = dry-run` 也必须验证完整 scope，不得用 dry-run 绕过 evidence 或 approval。
- 若 Task 1 尚未提供被批准的真实应用器，必须返回明确的 `NOT_IMPLEMENTED` / fail-closed 结果，`applied` 必须为 `false`，不得产生 patch、commit 或工作树修改。
- 不得以返回一个空 patch、复制现有 patch、修改测试断言或重写 ledger 来伪造“已应用”。
- Task 1 的 1E 只能验证上述边界；真实 change application 属于另行批准的实现范围。

### 7.6 1C 验收

1C 必须以 TDD 覆盖合法状态转移、非法转移、角色越权、candidate mismatch、scope mismatch、revision mismatch、append-only 重放、重复 event、非单调时间、gate failure 顺序、GapRow 严格拒绝、approval scope 和 `applyApproved` 未实现边界。

V 必须检查状态和角色规则是否与 1A Schema 一致；G 必须验证 reducer 输出可重放且失败不写入。任何成功状态覆盖 blocking 状态、任何未知 gap 枚举被接受、任何未批准 scope 被应用，均阻塞 1C。

## 8. 1D：Archive boundary

### 8.1 `ArchiveManifest` 接口冻结

1D 只冻结 Task 8 将消费的 manifest contract，至少包含：

- `archiveId`、`candidateId`、`scope` 和 `contentHash`；
- manifest files 的 repository-relative path、kind 和 SHA-256；
- candidate/ledger/event 的 source revision，包括 commit、tree、source bundle hash；
- approval、V/G/human signature references；
- redaction 状态和 blocking reasons；
- `verificationLevel: 'package-only' | 'source-bound'`；
- rollback reference、producer metadata 和创建时间。

Manifest 必须是 evidence-preserving 的声明，不是“文件名清单”。文件列表排序、content hash 计算、source revision 绑定、scope binding、redaction 状态和验证级别都必须具有确定性。

### 8.2 两种验证级别语义

- **package-only：** 只验证输入 package 内的 manifest、列出的文件和内容 hash 自洽；不声称这些文件与当前 source project 的 HEAD/tree/source bundle 相同。package-only 结果不能写成“已验证源代码”或“source verified”。
- **source-bound：** 在 package-only 基础上，使用 Task 8 的真实 consumer 和显式 `sourceProject` 验证当前 source project 的 commit、tree、source bundle、scope 和列出文件的一致性。缺 source project、无法取得 revision、source hash 不匹配或工作树/范围不满足约束，都必须失败。
- 两种级别都必须区分 manifest 结构有效、文件 hash 有效、source identity 有效和生命周期允许归档这几个事实；一个事实通过不得推出其他事实通过。

### 8.3 Task 1D 的 `NOT_IMPLEMENTED` 语义

- Task 1D **不实现** archive producer、archive consumer、package-only verifier 或 source-bound verifier。
- 调用 Task 1D 的 producer/consumer/verify 入口时，必须返回可识别的 `NOT_IMPLEMENTED` typed error 或等价的 fail-closed 结果；不得返回 `exitCode = 0`、不得生成看似完整的 manifest、不得创建 archive 文件、不得修改 ledger 为 `archived`。
- `NOT_IMPLEMENTED` 是“此能力明确属于 Task 8，当前未授权实现”，不是“证据通过”，也不是“待验证但可继续”。调用方必须阻止后续归档动作。
- 1D 可以提供纯类型、Schema、manifest builder 的 compile-only contract，但不能以 builder 输出一个内存 manifest 宣称 archive producer 已存在。
- 1E 必须对 `NOT_IMPLEMENTED` 做正向的边界断言：调用被拒绝、错误类别正确、没有文件/ledger/worktree 副作用。

### 8.4 Task 8 承接规则

Task 8 必须在另行批准的设计和计划中承担：

1. 真实 archive producer：从已通过 lifecycle 的 candidate、evidence、review、gate、approval 和 rollback 生成 manifest 与归档 package。
2. 真实 archive consumer：读取、解析、重新计算 manifest 和文件 hash，并验证签名引用、scope、redaction 和 retention contract。
3. package-only verification：在无 source project 的情况下只验证 package 自洽性，并准确标注 package-only。
4. source-bound verification：显式接收 source project，验证 commit/tree/source bundle、文件内容、scope 和当前源状态。
5. archive 失败路径：缺失文件、symlink、错误 hash、stale revision、scope mismatch、敏感内容、非法 manifest、错误 verification level 和工作树不符合要求都 fail-closed。

Task 8 不得为了实现 producer/consumer 而放宽 1A–1D 已冻结的类型、错误、证据、scope 或 redaction contract。

## 9. 1E：Integration acceptance

### 9.1 隔离临时 Git 项目

1E 必须由 G 在临时目录创建一个真实、独立、可销毁的 Git 项目；不能用仓库根目录、现有 worktree、`.w-model`、fixture 名称或内存 fake 替代。临时项目至少包含：

- 一个初始 commit 和可计算的 tree SHA；
- 一个候选 source file、一个测试/证据文件和一个受控 raw-output 目录；
- 可生成真实 patch 的变更前后 commit；
- 可验证的 source bundle；
- 一个故意的 symlink/越界/错误 hash 负例资源（不得被正向链路误收录）。

所有创建、修改、commit、读取和清理均必须在临时项目内完成。验收开始和结束都必须记录 `git status --porcelain`；最终必须为空。临时项目的路径不得泄露到提交的 evidence、错误消息或 manifest；仅保留安全的相对路径和 hash。

### 9.2 真实正向链路

1E 的正向链路必须是真实执行，不得复制历史结果：

```text
创建 candidate
  → 记录 source revision / scope
  → 由注入式 EvidenceStore 保存真实 raw output
  → FileVerifier 验证 regular-file、non-symlink、SHA-256
  → 追加 evidence event
  → V review 证据与 scope
  → human approval exact scope
  → reducer 接受 approved / implemented / verified 所允许的事件
  → 调用 1D archive boundary，得到明确 NOT_IMPLEMENTED
  → 断言未生成归档、未进入 archived、worktree clean
```

这条链路证明的是 Task 1 的 contract、证据校验、生命周期和归档边界；它不证明真实 archive 已完成，也不证明 Task 8 已通过。

### 9.3 必须覆盖的负向矩阵

| 类别 | 负向场景 | 期望结果 |
| --- | --- | --- |
| 路径 | 绝对路径、`..` 越界、root 外路径 | blocking / `STRUCTURE_INVALID` 或 `SECURITY_BLOCKED` |
| 文件类型 | 目录、symlink、父目录 symlink、被替换的目标 | blocking；不得读取或写入目标 |
| 内容 | 缺文件、错误 SHA-256、非法 UTF-8 | `EVIDENCE_INVALID` 或 `SECURITY_BLOCKED` |
| revision | stale commit、错误 tree、错误 source bundle | `REVISION_MISMATCH` |
| 身份 | candidate ID mismatch、scope hash mismatch、跨 candidate 复用 evidence | `SCOPE_MISMATCH` |
| command | 未审计 environment、敏感参数/输出、shell 注入形态 | `SECURITY_BLOCKED` |
| lifecycle | 非法状态跳转、角色越权、重复 event、时间倒退 | typed blocking error；ledger 不变 |
| gate | `exitCode = 0` 伪造 failure、null exit code、raw output 未验证 | 不得记录为 gate failure 或通过 |
| gap | 未知 kind/priority/status、缺 risk、coverageIsSignalOnly 非 true、未知字段 | `STRUCTURE_INVALID`；拒绝整行 |
| approval | 非 human、scope 扩大、approval candidate 不一致 | `SCOPE_MISMATCH` 或 `EVIDENCE_INVALID` |
| application | 未批准 scope、Task 1 调用真实 apply | `NOT_IMPLEMENTED` 或 blocking；不改工作树 |
| archive | 调用 Task 1D producer/consumer/verifier | `NOT_IMPLEMENTED`；不产生 manifest/archive |
| verification level | 把 package-only 写成 source-bound，或无 source project 做 source-bound | blocking；不得升级验证级别 |
| 清理 | 正向链路留下临时文件、未跟踪文件或 staged 变化 | 1E 失败；不能以清理后再检查掩盖泄漏 |

负向矩阵中每一项都必须断言：错误类别正确、没有部分 ledger 写入、没有 scope 扩大、没有 archive 副作用，并且临时项目最终保持可检查的 clean 状态。

### 9.4 1E 通过条件

- 正向链路使用真实 Git revision、真实 raw output、真实 SHA-256 和真实 reducer 输出。
- 负向矩阵全部 fail-closed，且失败不污染后续 candidate 或 ledger。
- Task 1D 的 `NOT_IMPLEMENTED` 语义被准确观察，不被测试 harness 吞掉或改写成 pass。
- 临时项目最终 `git status --porcelain` 为空；仓库根目录没有新增、修改、删除或忽略生成物泄漏。
- V 审查实际运行结果和实际工作树状态；G 记录命令、退出码、时间、版本和 raw-output hash。
- 1E 通过仍只代表 Task 1 contract/lifecycle 集成通过，不代表 archive 已完成。

## 10. `bab618a` / `39d1671` 迁移规则

### 10.1 从 `39d1671` 迁移

以下安全事实必须无损迁移到 1B 的注入式实现：

1. cwd 和 raw-output 目录必须位于受控 repository root 内。
2. 目录链和最终输出目标必须为 non-symlink；输出文件必须是 regular file。
3. raw output 使用安全创建语义，防止既有文件覆盖和路径替换。
4. child process 使用 `shell: false`，不把未经审计的完整 `process.env` 传给命令。
5. environment 只允许明确审计的键；敏感字段、authorization、token、private key 和敏感 payload 必须阻断或脱敏。
6. stdout/stderr 按字节收集，非法 UTF-8 fail-closed；raw output 只保存可安全 redaction 的内容。
7. command、args、cwd、output 和 error 均不得泄露不必要的绝对路径或敏感信息。

迁移时不得通过保留旧 helper 的名字而绕过新接口；旧调用方必须改为依赖 `EvidenceStore` / `FileVerifier` 的显式结果。若旧行为与上述安全事实冲突，以本设计和安全事实为准，并将冲突列为 blocking migration item。

### 10.2 从 `bab618a` 迁移

以下 source-bound 事实必须在 1B、1C 和 1D 的边界中保留，但职责要拆开：

1. rollback patch 必须有真实 patch 文件、64 位 SHA-256、raw output 文件和 source revision；不存在或 hash 不匹配即失败。
2. rollback raw output 必须绑定 event evidence refs 和 candidate revision，不能只记录一个路径字符串。
3. archive evidence 的 manifest files、content hash、redaction status、verification level、rollback、signatures 和 source revision 必须分别可验证。
4. source revision 必须同时匹配 candidate、ledger baseline、event revision 和实际 source project；不能只比较 candidate 名称或引用名。
5. `package-only` 和 `source-bound` 不得互换；没有 source project 时不能声称 source-bound。
6. 真实归档 producer/consumer 和两种验证器移交 Task 8；Task 1D 仅保留接口和 `NOT_IMPLEMENTED` fail-closed 行为。

### 10.3 迁移顺序

- 先在 1A 对已有字段、Schema 和错误语义做 canonical 对齐；未对齐前不得删除旧字段或改变其含义。
- 再在 1B 把文件安全和证据校验从生命周期逻辑中抽出，旧逻辑只能作为适配层，不能形成第二套校验规则。
- 再在 1C 把状态转移、角色和 gate failure 归一到 append-only reducer；任何旧的直接改 status 写法都必须被禁止或转为明确错误。
- 再在 1D 将现有 archive 函数中的真实写入、读取和 source-bound 验证标记为 Task 8 迁移项；Task 1 分支不得继续保留“看似可用”的半实现。
- 最后由 1E 在隔离 Git 项目中证明迁移后的安全事实和失败语义；无法证明的旧行为保持 blocking，不允许用兼容分支静默放行。

## 11. 各子任务统一的 TDD、V、G 和返工纪律

### 11.1 TDD RED/GREEN

每个子任务都必须先写最小、可归因的 RED，再写最小实现得到 GREEN：

- **RED：** 测试必须因目标 contract 尚未实现而失败，且失败原因要与本子任务一致；不能用“测试文件存在”作为 RED 证据。
- **GREEN：** 只实现使该 RED 通过所需的最小行为，不放宽断言、不跳过负例、不吞掉错误、不伪造文件或退出码。
- **REFACTOR：** 仅在 GREEN 后做 approved scope 内的结构整理；不能顺手实现下一段或 Task 8。
- RED/GREEN 的命令、版本、时间、exit code、raw output hash 和 candidate/scope binding 必须进入审查材料。

子任务映射：

| 子任务 | RED/GREEN 最小重点 |
| --- | --- |
| 1A | 错误字段、Schema 枚举、未知字段、compile-only 导入与编译边界 |
| 1B | regular-file/non-symlink/hash/revision/scope/redaction 的正负例 |
| 1C | 状态、角色、append-only 重放、失败顺序、GapRow、approval/application 边界 |
| 1D | manifest 类型与 verification level；调用未实现能力必须得到 `NOT_IMPLEMENTED`，不得 GREEN 成 archive |
| 1E | 临时 Git 项目的真实正向链路、负向矩阵和 clean worktree |

### 11.2 V 审查

每段 GREEN 后，V 必须独立审查：

- 实际 diff 是否只在本段 approved scope；
- contract、Schema、错误和实现是否一致；
- RED 是否因预期原因失败，GREEN 是否真实运行；
- 负向用例是否真正 fail-closed；
- 是否保留 `bab618a` / `39d1671` 的安全事实；
- 是否误用报告 checker、coverage 或模拟结果；
- 是否越界实现下一段、Task 8 或其他业务功能；
- evidence 是否绑定 candidate、scope、revision 和 raw output。

V 不能因为 G 通过而省略语义审查，也不能因为报告 checker 通过而把 Task 1 标为通过。

### 11.3 G 验证

G 必须执行确定性命令并记录真实退出码；至少验证 Schema/类型、定向单测、负向矩阵、redaction、安全文件验证、ledger 重放和工作树状态。G 不得：

- 复制上一轮输出；
- 以“预期会通过”替代真实运行；
- 以 checker 的结构通过替代功能通过；
- 把 unavailable/not_run/unverified 改为 pass；
- 为了让数量看起来正确而跳过失败项；
- 在 Task 1 中运行或宣称 Task 8 真实 archive 验证已通过。

### 11.4 R → V → G → S 返工纪律

任一 V 或 G 失败后，流程固定为：

1. **R：** 根据实际 diff、失败产物、命令 raw output 和上游 contract 产出 RootCauseReport，说明直接原因、根因链、影响范围、可证伪预测和最小修复建议。
2. **V：** 独立复审 RootCauseReport，确认根因不是把症状改名，且修复建议不扩大 scope。
3. **G：** 对 RootCauseReport 执行确定性 schema/完整性门禁；报告没有通过不得返工。
4. **S：** 只按已通过的根因报告修复当前子任务，重新执行 RED/GREEN，再次走 V/G。

没有完整的 R → V → G → S 链时，不得直接让 S 重跑、不准跳到下一段、不准直接改写验收记录。修复引入的新失败继续从当前段起点走完整链路。

## 12. 最终完成门槛

Task 1 只有在以下全部条件满足后，才可以对外宣称“Task 1 通过”：

1. 1A、1B、1C、1D、1E 按固定顺序分别通过；每段都有独立的 V 审查、G 真实退出码和完整 evidence。
2. focused ledger 的 22 项全部有真实结果，6 个失败项均已通过 R → V → G → S 返工并重新验证；不能只引用 16 项 passed。
3. 所有 report checker 结果与功能、证据、生命周期和集成结果一致；不得用 report checker 通过替代 Task 1 通过。
4. 1B 的文件安全、SHA-256、revision/tree/source-bundle、candidate/scope 和 command/redaction 边界全部保留并覆盖正负例。
5. 1C 的 append-only reducer 可重放，角色和失败顺序严格，`GapRow`、`applyApproved`、`recordGateFailure` 边界全部 fail-closed。
6. 1D 只提供接口；Task 1 中 archive producer/consumer/verifier 调用均明确返回 `NOT_IMPLEMENTED`，没有伪造 manifest、归档文件或 `archived` 状态。
7. 1E 在隔离临时 Git 项目中完成真实正向链路、负向矩阵和工作树 clean，且没有把 Task 8 行为混入 Task 1 结论。
8. 没有修改未批准的源码、测试、计划、活体文档、`.w-model` 或其他文件；本规格交付本身只新增本文件。
9. 所有可交付 evidence 都经过适用的 redaction，且不包含 secret、个人数据、绝对路径或不可验证的结果。

## 13. 明确不宣称内容

在 Task 1 完成前以及仅凭本设计文件，**不得宣称**：

- Code Health Campaign 的四个 Phase 已实现或已完成；
- 任何 candidate 已被真实删除、添加测试、删除测试或抽象迁移；
- Task 1 已经通过；特别是不得把“报告 checker 通过”写成“Task 1 通过”；
- archive producer、archive consumer、package-only verifier 或 source-bound verifier 已实现；
- package-only 证据已经 source-bound，或 package-only 已证明当前 source project；
- source-bound 验证已由 Task 1 完成；真实 producer/consumer 和两种验证由 Task 8 承担；
- 任意 `NOT_IMPLEMENTED` 结果是通过、可归档或已验证；
- focused ledger 的 16/22 通过可以抵销 6/22 失败；
- 任意未运行、不可用、未绑定 revision 或无法安全脱敏的命令结果是 pass；
- 1E 的临时项目验收等同于当前仓库的全量回归或最终发布验收。

## 14. 本规格交付边界

本次只新增：

```text
docs/superpowers/specs/2026-09-07-code-health-task1-resplit-design.md
```

本规格的提交只记录已批准的拆分设计，不授权实现 Task 1，也不授权实现 Task 8。任何后续实现必须有单独批准的实现计划，并按本规格的五段串行边界、TDD、V/G、R → V → G → S 和最终不宣称规则执行。
