# 代码健康治理（Code Health Governance）操作参考

> 权威定义：`docs/skill-design-document_SSoT.md` §10K。本文件是 `/wm code-health` 的可执行参考，说明已实现的 Phase 1–4 命令、角色边界、退出语义与失败路径。
> 交付层：全部资产属 L1（`w-model-dev/scripts/**`），不在 L0 纯 skill 副本内；判定为纯函数 + 确定性 CLI，不调用 LLM。
> **实现边界**：本仓库实现并验收 Phase 1–4，以及 campaign 归档（真实 producer/consumer/verifier）。Phase 5–8 迁移能力仍**未实现**，不得据本文或计划文本执行迁移。归档的验证分两级：`--verify` 不带 `--source-project` 只能是 **package-only**（与 `wm-export-evidence --verify` 语义一致），只有显式传 `--source-project` 才做 source-bound 重验（当前 HEAD / source hash / run 身份 / gate measurements）；package-only **不得**表述为 verified source。旧的 `logic/code-health-phase-boundaries.ts` 占位模块已删除。

## 1. 何时使用

当用户要求「找出并删除死代码」「补缺失测试」「删除冗余/重复测试」「合并重复实现」且可接受**先发现、后人工授权**的受控流程时使用。禁止在无人类批准的情况下删除任何代码或测试。

## 2. 角色权限（O / A / S / V / G / R / human）

| 角色        | 允许                                                                                                                                    | 禁止                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| O 编排者    | 路由、读 ledger/状态、跑**只读** CLI（`code-health-phase1` / `code-health-gap` / `code-health-duplicates`）、在 CHECKPOINT 暂停、持久化 | 写/改代码与测试、产出候选结论、代人类批准 |
| A 分析      | Phase 1 静态 inventory + 动态 trace、Phase 2 gap 生成（只产出发现，不产出结论）                                                         | 删除任何文件、跑 apply                    |
| S 产出/修复 | 在人类批准 scope 内执行最小可逆改动（经 `code-health-apply`）；失败链中兼任修复                                                         | 越 scope 改动、绕过 apply 直接 `git rm`   |
| V 评审      | 独立复核分类、等价证明、scope、回滚与未决问题（material ambiguity fail-closed）                                                         | 跑门禁脚本、改产物                        |
| G 门禁      | 跑 code-health CLI 并回填真实退出码证据                                                                                                 | 修改产物                                  |
| R 根因      | `blocked` 候选的根因定位（RootCauseReport）                                                                                             | 实施修复                                  |
| human       | 唯一授权者：批准候选 ID / action / 精确 files/symbols/call sites / scopeHash                                                            | —                                         |

## 3. 候选生命周期与状态

- 状态：`discovered` / `evidenced` / `under-review` / `approved` / `implemented` / `verified` / `archived` / `rejected` / `deferred` / `blocked` / `rolled-back`。
- 动作：`delete-code` / `add-test` / `delete-test` / `abstract`；阶段：`P1` / `P2` / `P3` / `P4`。
- **发现 ≠ 结论**：Phase 1/2 只登记 `discovered`；coverage 只是信号（`coverageIsSignalOnly: true`），不授权删除或跳过维度。
- ledger append-only：`init` 拒绝已存在文件；`append` 经纯 reducer 拒绝非法转移、非单调时间戳、复用 id、缺哈希与已带结论的候选；`validate` 重放历史 fail-closed。

## 4. 命令与退出语义

```bash
# Phase 1：只读发现（report 通常写仓库外；raw output 独占写 .w-model/code-health/phase1/raw）
npx tsx w-model-dev/scripts/cli/code-health-phase1.ts --root <dir> --output <file> --scenario <file>

# ledger：init / append / validate（append-only）
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts init --ledger <file> --campaign-id <id> --baseline <revision.json>
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts append --ledger <file> --candidate <candidate.json> --event <event.json> [--approval <approval.json>]
npx tsx w-model-dev/scripts/cli/code-health-ledger.ts validate --ledger <file>

# Phase 2：gap matrix（只读）
npx tsx w-model-dev/scripts/cli/code-health-gap.ts --matrix <file> [--validate]

# Phase 3：受保护测试 inventory；--guard 是唯一可删除测试的路径
npx tsx w-model-dev/scripts/cli/code-health-tests.ts --inventory <file> [--ledger <file>] [--project <dir>] [--candidate <file>] --validate
npx tsx w-model-dev/scripts/cli/code-health-tests.ts --guard <file> --project <dir> --ledger <file>

# Phase 4：重复簇与 abstraction guard（只读）
npx tsx w-model-dev/scripts/cli/code-health-duplicates.ts --matrix <file> [--ledger <file>] [--root <dir>] [--validate]

# 应用：dry-run / patch / commit（commit 需人类 approval）
npx tsx w-model-dev/scripts/cli/code-health-apply.ts --candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run|patch|commit]

# 归档：produce（campaign → 受控 package）/ verify（两级验证）
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --campaign <dir> --output <dir> [--verification-level package-only|source-bound] [--source-project <dir>]
npx tsx w-model-dev/scripts/cli/code-health-archive.ts --verify <package-dir> [--source-project <dir>] [--manifest <file>]
```

**归档权威规则**：`ledger.json` / `candidate.json` / `approval.json` 齐备且经 V/G 复审、G 门禁、observed passing 命令证据、可执行 rollback、clean redaction、revision 匹配的 verified 候选才能 `archivedAsPassed=true`；`deferred` / `rejected` / `blocked` / `rolled-back` 只可作为终态**非成功**证据归档，绝不报告为 passed。每个声明工件经共享 FileVerifier 重验（regular / non-symlink / canonical containment）并按真实内容哈希复制；package 原子写入（staging + rename + readback），不覆盖已存在的非空 package。归档仍需人类 approval，ARCHIVE 不代替 CHECKPOINT。

退出码统一为 `0 = 通过/正常`、`1 = 校验或 guard 失败（fail-closed）`、`2 = 输入错误`（`ERROR_JSON`，含 `ARG_INVALID`）。未知 flag / 重复值 flag / 缺值 / 缺必需参数一律 exit 2，且不写任何文件。

## 5. 证据与权威（删除/抽象缺一不可）

1. `CommandEvidence`：真实 `command` / `cwd` / `environment` / `platform` / `toolVersions` / `startedAt` / `endedAt` / `exitCode`（数字；`null` 不算 observed）/ `observation` / `rawOutputPath` / `rawOutputSha256`。
2. `RevisionIdentity` + `EvidenceBinding`：candidate / scope / path / hash / revision 绑定；`lib/code-health-evidence-store.ts` 验证存在与哈希，`lib/code-health-file-verifier.ts` 重算 canonical 文件，`lib/code-health-revision-provider.ts` 提供受控 revision。
3. HEAD-tracked 事实源：ledger、`.code-health-governance.json`、suite argv 清单的**工作区字节必须等于 HEAD blob**；声明计数与仓库期望冲突且无 `explained:<artifact>` 即拒。
4. 默认拒绝：无法正向证明「非保护」的候选一律按受保护处理；`test-only` / 生成代码 / 死副本 / 一次性实验 / 平台/lifecycle/安全/并发差异 / 「少几行 diff」都不授权删除或抽象。

## 6. CHECKPOINT 与失败链

- **🔴 CHECKPOINT · 候选放行**：实现前 O 展示候选 ID / action / 精确 scope / scopeHash，等待人类 approve / reject / defer；工具或 LLM 输出不能授权。
- **失败链**（`blocked` 后顺序固定）：`gate-failure → blocked → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework) → evidenced`。错序或缺角色被 `appendRootCauseEvent` / `nextRequiredRoles` 拒绝。
- **回滚**：任何失败的应用必须回滚到 pre-change revision——记录受控 patch 并 `git apply -R`，随后 `git diff --exit-code` 为 0；无法回滚即显式失败。

## 7. 脱敏与边界

- 脱敏：`lib/code-health-redaction.ts` 输出 `status`（`not_reviewed` / `clean` / `blocked`）/ `rules` / `blockedReasons`；`blocked` 产物不得导出。
- 18 项 pre-push 不变：code-health CLI 不纳入 `.githooks/pre-push`。
- codegraph：进入阶段 5–8 代码修改前须做 codegraph 影响分析（约束 #14）；本仓库 checkout 无 `.codegraph/` 索引，Phase 1–4 不消费 codegraph，也不得伪造查询记录。
- 参见：[command-reference.md](command-reference.md)（命令总览）、[subagent-delegation.md](subagent-delegation.md)（dispatch-matrix 登记）、[hard-constraints.md](hard-constraints.md)（反模式）。
