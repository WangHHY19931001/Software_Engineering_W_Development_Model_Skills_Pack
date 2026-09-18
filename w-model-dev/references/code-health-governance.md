# 代码健康治理（Code Health Governance）操作参考

> 权威定义：`docs/skill-design-document_SSoT.md` §10K。本文件是 `/wm code-health` 的可执行参考，说明已实现的 Phase 1–4 命令、角色边界、退出语义与失败路径。
> 交付层：全部资产属 L1（`w-model-dev/scripts/**`），不在 L0 纯 skill 副本内；判定为纯函数 + 确定性 CLI，不调用 LLM。
> **实现边界**：本仓库实现并验收 Phase 1–4，以及 campaign 归档（真实 producer/consumer/verifier）。Phase 5–8 迁移能力仍**未实现**，不得据本文或计划文本执行迁移。归档的验证分两级：`--verify` 不带 `--source-project` 只能是 **package-only**（与 `wm-export-evidence --verify` 语义一致），只有显式传 `--source-project` 才做 source-bound 重验（当前 HEAD / source hash / run 身份 / gate measurements）；package-only **不得**表述为 verified source。旧的 `logic/code-health-phase-boundaries.ts` 占位模块已删除。

## 1. 何时使用

当用户要求「找出并删除死代码」「补缺失测试」「删除冗余/重复测试」「合并重复实现」且可接受**先发现、后人工授权**的受控流程时使用。禁止在无人类批准的情况下删除任何代码或测试。

## 2. 角色权限（O / A / S / V / G / R / human）

| 角色        | 允许                                                                                                                                    | 禁止                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| O 编排者    | 路由、读 ledger/状态、跑**只读** CLI（`code-health-phase1` / `code-health-gap` / `code-health-duplicates`；发现类 CLI 由 O（只读）/G 执行，A 只解读并登记发现）、在 CHECKPOINT 暂停、持久化 | 写/改代码与测试、产出候选结论、代人类批准 |
| A 分析      | 解读 O（只读）/G 执行的 CLI 输出并登记 Phase 1 静态 inventory + 动态 trace、Phase 2 gap 发现（只产出发现，不产出结论）                    | 删除任何文件、跑 apply                    |
| S 产出/修复 | 在人类批准 scope 内执行最小可逆改动（经 `code-health-apply`）；失败链中兼任修复                                                         | 越 scope 改动、绕过 apply 直接 `git rm`   |
| V 评审      | 独立复核分类、等价证明、scope、回滚与未决问题（material ambiguity fail-closed）                                                         | 跑门禁脚本、改产物                        |
| G 门禁      | 跑 code-health CLI 并回填真实退出码证据                                                                                                 | 修改产物                                  |
| R 根因      | `blocked` 候选的根因定位（RootCauseReport）                                                                                             | 实施修复                                  |
| human       | 唯一授权者：批准候选 ID / action / 精确 files/symbols/call sites / scopeHash                                                            | —                                         |

## 3. 候选生命周期与状态

- 状态：`discovered` / `evidenced` / `under-review` / `approved` / `implemented` / `verified` / `archived` / `rejected` / `deferred` / `blocked` / `rolled-back`。
- 动作：`delete-code` / `add-test` / `delete-test` / `abstract`；阶段：`P1` / `P2` / `P3` / `P4`。
- **发现 ≠ 结论**：Phase 1/2 只登记 `discovered`；Phase 1 在必需环境不可用或分析目标不可读时登记 `blocked`（`blocked` 同样是发现，不是结论），候选状态**不可能是** `under-review` 及之后的状态。coverage 只是信号（`coverageIsSignalOnly: true`），不授权删除或跳过维度。Phase 1 的 `changedFiles` 是**分析目标列表**的前后 worktree 差分（未列入目标的其他文件变动不归因，含并发兄弟任务残留），**非空即只读违规**并令该次运行 exit 1。
- ledger append-only：`init` 拒绝已存在文件；`append` 经纯 reducer 拒绝非法转移、非单调时间戳、复用 id、缺哈希与已带结论的候选；`validate` 重放历史 fail-closed。

## 4. 命令与退出语义

```bash
# Phase 1：只读发现（report 通常写仓库外；raw output 独占写 .w-model/code-health/phase1/raw；候选只 discovered/blocked）
npx tsx w-model-dev/scripts/cli/code-health-phase1.ts --root <dir> --output <file> --scenario <file>

# ledger：init / append / validate（append-only）
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts init --ledger <file> --campaign-id <id> --baseline <revision.json>
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts append --ledger <file> --candidate <candidate.json> --event <event.json> [--approval <approval.json>]
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts validate --ledger <file>

# Phase 2：gap matrix（只读）
npx tsx w-model-dev/scripts/cli/code-health-gap.ts --matrix <file> [--validate]

# Phase 3：受保护测试 inventory；--guard 是唯一可删除测试的路径（--inventory 只做结构/默认拒绝/等价证明校验，从不删除；--guard 也只经 code-health-apply.ts 删除）
npx tsx w-model-dev/scripts/cli/code-health-tests.ts --inventory <file> [--ledger <file>] [--project <dir>] [--candidate <file>] --validate
npx tsx w-model-dev/scripts/cli/code-health-tests.ts --guard <file> --project <dir> --ledger <file>

# Phase 4：重复簇与 abstraction guard（只读）；under-review / deferred 都不是批准（输出 authorized:true 只表示抽象授权事实已具备），权威只能来自 HEAD-tracked ledger
npx tsx w-model-dev/scripts/cli/code-health-duplicates.ts --matrix <file> [--ledger <file>] [--root <dir>] [--validate]

# 应用：dry-run / patch / commit（commit 需人类 approval；scope 文件 untracked 或已跟踪但被本地修改时 exact-scope 回读 fail-closed 拒绝并回滚，见 §6）
npx tsx w-model-dev/scripts/cli/code-health-apply.ts --candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run|patch|commit]

# 归档：produce（campaign → 受控 package）/ verify（两级验证）
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --campaign <dir> --output <dir> [--verification-level package-only|source-bound] [--source-project <dir>]
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --verify <package-dir> [--source-project <dir>] [--manifest <file>]
```

**`--mode commit` 不做 git 提交**：该模式只把删除落在**工作区**——`git status` 出现**未暂存**的 `D`、HEAD 不前移、不创建提交对象；提交由人类在审阅工作区后显式执行（与 §6 的回滚语义一致：回滚的对象是工作区改动，不是提交）。

**归档权威规则**：`ledger.json` / `candidate.json` / `approval.json` 从 **caller 通过 `--campaign` 指定的目录**读取，生产者校验三者**内部一致性**（candidate/ledger/approval 相互一致、revision 匹配、签名角色、脱敏），但**不**锚定 HEAD 或任何 tracked 记录——**campaign 目录本身的真实性由 caller / 人类负责**（与 Phase 3/4 的 HEAD-tracked ledger 权威不同；对照 §5 第 3 条）。`ledger.json` / `candidate.json` / `approval.json` 齐备且经 V/G 复审、G 门禁、observed + `exitCode=0` + 安全仓库相对 `rawOutputPath` + 64 位十六进制 `rawOutputSha256` 的命令证据、可执行 rollback、clean redaction、revision 匹配的 verified 候选才能 `archivedAsPassed=true`；该边界**不读取 raw 输出文件、不重算摘要**，raw 内容按字节验证属上游 `EvidenceStore` 职责；`deferred` / `rejected` / `blocked` / `rolled-back` 只可作为终态**非成功**证据归档，绝不报告为 passed。每个声明工件经共享 FileVerifier 重验（regular / non-symlink / canonical containment）并按真实内容哈希复制；package 原子写入（staging + rename + readback），不覆盖已存在的非空 package；manifest 摘要是**无密钥完整性校验和，不是签名**。归档仍需人类 approval，ARCHIVE 不代替 CHECKPOINT。`--verification-level` 可省略，缺省即 `package-only`。

退出码统一为 `0 = 通过/正常`、`1 = 校验或 guard 失败（fail-closed）`、`2 = 输入错误`（`ERROR_JSON`，含 `ARG_INVALID`）。未知 flag / 重复值 flag / 缺值 / 缺必需参数一律 exit 2，且不写任何文件。

## 5. 证据与权威（删除/抽象缺一不可）

1. `CommandEvidence`：真实 `command` / `cwd` / `environment` / `platform` / `toolVersions` / `startedAt` / `endedAt` / `exitCode`（数字；`null` 不算 observed）/ `observation` / `rawOutputPath` / `rawOutputSha256`。
2. `RevisionIdentity` + `EvidenceBinding`：candidate / scope / path / hash / revision 绑定；`lib/code-health-evidence-store.ts` 验证存在与哈希，`lib/code-health-file-verifier.ts` 重算 canonical 文件，`lib/code-health-revision-provider.ts` 提供受控 revision。
3. HEAD-tracked 事实源：ledger、`.code-health-governance.json`、suite argv 清单的**工作区字节必须等于 HEAD blob**；声明计数与仓库期望冲突且无 `explained:<artifact>` 即拒。
4. 默认拒绝：无法正向证明「非保护」的候选一律按受保护处理；`test-only` / 生成代码 / 死副本 / 一次性实验 / 平台/lifecycle/安全/并发差异 / 「少几行 diff」都不授权删除或抽象。

## 6. CHECKPOINT 与失败链

- **🔴 CHECKPOINT · 候选放行**：实现前 O 展示候选 ID / action / 精确 scope / scopeHash，等待人类 approve / reject / defer；工具或 LLM 输出不能授权。
- **失败链**（`blocked` 后顺序固定）：`gate-failure → blocked → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework) → evidenced`。错序或缺角色被 `appendRootCauseEvent` / `nextRequiredRoles` 拒绝。
- **回滚**：任何失败的应用必须回滚到 pre-change revision——记录受控 patch 并 `git apply -R` 反向应用，随后以真实 `git status` 回读证明工作树回到 pre-change 快照（工作树原本干净时**不弱于** `git diff --exit-code` 为 0：状态快照还覆盖 untracked / staged 项；原本有本地改动时按各自快照比对，不误报）；反向应用失败或仍有残留即**显式失败**——`code-health-apply.ts` 在被拒绝的 commit 结果中同时给出受控 patch、回滚计划（含 `patchSha256`）与回滚校验结论，绝不静默声称工作树干净。P3 `--guard` 在最终证明失败时回滚已应用的删除并证明工作树已还原，无法还原同样显式失败。
- **回滚证的精度（不是内容级证明）**：`verifyRollbackRestored` 比对的是 `git status --porcelain` 的**路径集合**（XY 状态字母被丢弃），因此对「运行前已存在、运行后内容变化但状态字母不变」的**非 scope** 路径没有内容级证明。scope 文件不受此限：受控 patch 内嵌运行前的完整字节，`git apply -R` 成功即字节级还原，失败即显式违规。
- **exact-scope 回读的前置条件（否则 fail-closed 拒绝，而不是照删不误）**：commit 的 exact-scope 判定统计「运行后**新增**的 status 路径条目」。若被批准的 scope 文件在运行前已出现在 status 中——**untracked（未入 index）**，或**已跟踪但工作区被本地修改**——删除它不产生新增条目，`appliedFiles` 必然少于 scope 大小 → `SCOPE_MISMATCH` fail-closed 并回滚还原（两类情形实测均逐字节还原，2026-09-18 临时仓探针）。clean 工作树（scope 文件已跟踪且无本地改动）才是正常删除路径。

## 7. 脱敏与边界

- 脱敏：`lib/code-health-redaction.ts` 输出 `status`（`not_reviewed` / `clean` / `blocked`）/ `rules` / `blockedReasons`；`blocked` 产物不得导出。
- 19 项 pre-push 不变：code-health CLI 不纳入 `.githooks/pre-push`。
- codegraph：进入阶段 5–8 代码修改前须做 codegraph 影响分析（约束 #14）；本仓库 checkout 无 `.codegraph/` 索引，Phase 1–4 不消费 codegraph，也不得伪造查询记录。
- **Phase 1 前置条件**：分析目标仓应忽略 `.w-model/`——phase1 的 raw output 独占写 `<root>/.w-model/code-health/phase1/raw/<ts>-<uuid>.log`，而只读不变式只覆盖分析目标，目标仓未忽略该目录时会以 untracked 残留留在目标仓（不报违规，属预期行为）。
- 参见：[command-reference.md](command-reference.md)（命令总览）、[subagent-delegation.md](subagent-delegation.md)（dispatch-matrix 登记）、[hard-constraints.md](hard-constraints.md)（反模式）。
