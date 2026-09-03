# 审查问题修复计划（audit-gate-closure，保持 42.2.1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `origin/main..HEAD` 全范围独立审查发现的全部问题（Critical 1 + Important 4 + Minor 1），并处理审查过程中确认的配套契约冲突：malformed-only run-log 仍 exit 0、`fix/emergency-fix` 文档字段被 run-log schema 拒绝、R3 报告 `passed=false` 与 findings 约束漂移、hook 文档与实现不一致。版本保持 `42.2.1`。

**Architecture:** 五个垂直切片（A 严格变更上下文与三个 strict checker / B artifact gate 聚合 / C role-dispatch + run-log + schema / D pre-push / E 文档样本同步），每切片 TDD + 独立审查后提交；最终全量验证 + 独立全范围 review，仅在用户同意后本地集成（不 push）。

**不可变约束（逐字执行）：**
- 保持版本 42.2.1，不运行 version:bump。
- `.superpowers/` 报告不得提交；主工作树 tracked 文件不得修改（唯一例外：主树 `.superpowers/` 报告文件，不提交）。
- 普通 V/G 失败必须走完整链：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；不得有直接返工 bypass；不得放宽 gate；不得伪造测试结果。
- 阶段 5–8 任何代码/测试文件 `Edit`/`Write` 前，S 须先 codegraph 查询目标符号影响半径并落盘 `.w-model/codegraph-queries/`（隔离树已建 `.codegraph/` 索引；无索引不得编辑并停在检查点）。
- 任何 agent 改动代码后必须跑回归测试；不推送；review clean 且用户同意前不集成、不标记完成。

**关键事实（编写计划时实测）：**
- 审查边界：Base `93f6f3af860fdfd745848387e6e32782240cf74b`（origin/main）→ Head `965095e049bf0688e1b343c5adcdd70407642228`，105 commits。
- 问题清单：Critical：codegraph 查询门可用无关查询伪通过（check-codegraph-queries.ts 仅校验目录/文件前缀/JSON 字段，不绑定实际变更）。Important：artifact gate externalChecks 三布尔仅回显不参与 passed（gate-logic.ts:662-664；check-artifact-gate.ts 从不传 externalChecks）；role-dispatch 只按 role=R 计数、rootcause×3/重复同维度可充数（role-dispatch-logic.ts:41-83；测试锁定错误宽松语义 role-dispatch-logic.test.ts:80-92）；空 run-log `checkRunLog([])` passed=true + CLOSED（run-log-logic.ts:349,1095-1100；CLI exit 0）；空 role-dispatch `checkRoleDispatch([])` passed=true。Minor：pre-push 真实 push 路径不读 stdin、`-n 20` 截断、删除 ref 未处理、fallback 失败仍可能放行（.githooks/pre-push:78-107）。配套冲突：坏行 parseErrors 只进 diagnostics 仍 exit 0（check-run-log.ts:246-249）；run-log.schema additionalProperties:false 无 variant/blocker/fixedLocation/fixBasedOn，文档 subagent-delegation.md:1389-1400 却要求（schema 会拒绝）；preventive-review passed=false 无 findings 约束（schema:14-28 无 conditional）；docs/troubleshooting.md:84-90 旧"N files/N tests 必须同步"表述与 docs-consistency 现逻辑矛盾；docs/*.md 在 Bash glob 下匹配子目录与"根级文档"注释不一致。
- 三个 checker 无专属 Vitest（仅 self-test.ts 1497-1597/3015-3109/3483-3558 引用）；pre-push 测试 run()（platform-deps-hook.test.ts:22-43）无 stdin 通道；platform-deps-hook.test.ts 未覆盖 stdin/多 ref/新分支/删除 ref。
- 真实 Git 变更集合最直接来源是 `git diff --name-only remote local`（pre-push 已在用）；check-docs-consistency detectScriptsChanges 仅返回 boolean 不可复用为严格证明；run-log artifacts/rtmDiff 是声明性交叉证据，不能替代实际 diff；project.schema 只有 status，不得塞入 change identity；event-ingress 是棕地事件输入，不可冒充标准当前变更事实。
- metrics-report/wm-status 明确允许空/缺失 run-log 查询降级（exit 0），不得通过改共享 reader 收紧。
- 变更必须从隔离 worktree `.worktrees/audit-gate-closure`（分支 `task/audit-gate-closure`，HEAD 965095e）完成；主树不动。

---

## 文件结构

| 文件 | 职责 | 操作 |
|---|---|---|
| `w-model-dev/scripts/lib/change-scope.ts`（新） | ChangeScope 解析/校验/实际变更集合重算/文件分类 | 新建 |
| `w-model-dev/schemas/codegraph-query.schema.json`（新） | codegraph 查询记录正式 schema（含 changeId/targetFiles） | 新建 |
| `w-model-dev/schemas/change-scope.schema.json`（新，采用 manifest 时） | 变更上下文 manifest schema | 新建 |
| `w-model-dev/scripts/cli/check-codegraph-queries.ts` | 结构校验 + 严格变更覆盖校验 | 修改 |
| `w-model-dev/scripts/cli/check-opsx-artifacts.ts` | 按 changeId 精确选择 active change | 修改 |
| `w-model-dev/scripts/cli/check-openspec-archive.ts` | 精确 changeId 归档选择、锚定匹配、多匹配失败 | 修改 |
| `w-model-dev/scripts/logic/gate-logic.ts` | 删除 externalChecks 死字段 | 修改 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | phase 5-8 聚合 codegraph/opsx 结果，GATE_JSON external summary | 修改 |
| `w-model-dev/scripts/logic/role-dispatch-logic.ts` | R3 三维度精确计数 + 空输入 fail-closed | 修改 |
| `w-model-dev/scripts/cli/check-role-dispatch.ts` | 报告缺失维度 | 修改 |
| `w-model-dev/scripts/logic/run-log-logic.ts` | 空数组 fail-closed | 修改 |
| `w-model-dev/scripts/cli/check-run-log.ts` | parseErrors 并入 blocking | 修改 |
| `w-model-dev/schemas/run-log.schema.json` | variant/blocker/fixedLocation/fixBasedOn + fix/emergency-fix 条件约束 + action-role 配对 | 修改 |
| `w-model-dev/schemas/preventive-review.schema.json` | passed=false ⇒ findings ≥1 | 修改 |
| `.githooks/pre-push` | stdin 严格解析、多 ref 聚合、删除 ref 处理、fail-closed | 修改 |
| `docs/skill-design-document_SSoT.md` | ChangeScope/实际 diff 证明/阶段门顺序/archive 后置/R3 矩阵 | 修改 |
| `w-model-dev/references/`（command-reference/phase-5~8/subagent-delegation/hard-constraints/data-models/workflow） | 同步新契约 | 修改 |
| `README.md`/`AGENTS.md`/`docs/INSTALL.md`/`CONTRIBUTING.md`/`docs/troubleshooting.md` | pre-push 行为同步 | 修改 |
| `w-model-dev/scripts/__tests__/`、`samples/`、`self-test.ts` | 新增/更新测试与样本 | 修改 |
| `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`、`CHANGELOG.md` | 修复记录与父链追加 | 修改 |

---

### 任务 1（Slice A）：ChangeScope + codegraph/opsx/archive 严格绑定

**Files:**
- Create: `w-model-dev/scripts/lib/change-scope.ts`、`w-model-dev/schemas/codegraph-query.schema.json`、`w-model-dev/schemas/change-scope.schema.json`（如采用 manifest）
- Modify: `w-model-dev/scripts/cli/check-codegraph-queries.ts`、`check-opsx-artifacts.ts`、`check-openspec-archive.ts`、`check-artifact-gate.ts`（聚合调用，B 前置）、`gate-logic.ts`（externalChecks 清理，B 前置）
- Create tests: `check-codegraph-queries.test.ts`、`check-opsx-artifacts.test.ts`、`check-openspec-archive.test.ts`、`change-scope.test.ts`

- [ ] 步骤 1：TDD 红灯——先写 change-scope.test.ts 与三个 checker 的 strict 负例测试并确认失败
- [ ] 步骤 2：实现 change-scope.ts（解析/校验/ref 解析/路径规范化/分类纯函数/与 Git 实际变更集合比对）
- [ ] 步骤 3：实现 codegraph strict 覆盖校验（changeId 精确匹配、targetFiles 覆盖全部 code/test changed files、queryTimestamp 合法且不晚于 scope、路径越界/绝对/`..` 失败）
- [ ] 步骤 4：opsx strict（精确 changeId 目录；多 active 候选失败）+ archive strict（锚定、排序、多匹配失败、支持 `<date>-<changeId>`）
- [ ] 步骤 5：CLI `--scope=`（可选 `--change/--base/--head` 薄封装）接入三个 checker；阶段 5–8 无 scope fail-closed
- [ ] 步骤 6：绿灯 + 全量回归；切片审查通过后独立 commit
- [ ] 步骤 7：codegraph 查询落盘（每文件修改前）与真实测试结果登记

### 任务 2（Slice B）：artifact gate 聚合与死字段清理

**Files:** `gate-logic.ts`、`check-artifact-gate.ts`、gate-logic/gate-enhancement/gate-report 测试

- [ ] 步骤 1：TDD——external false/undefined 行为测试 + CLI 聚合 exit/GATE_JSON 测试
- [ ] 步骤 2：删除 externalChecks 字段；check-artifact-gate phase 5-8 先调两个 strict checker 再调 checkArtifactGate，violations 合并进最终 reasons/exitCode；GATE_JSON 增加 external summary（不把 openspecArchived 当 pre-archive prerequisite）
- [ ] 步骤 3：回归 + 切片审查 + 独立 commit

### 任务 3（Slice C）：role-dispatch + run-log + schema 对齐

**Files:** `role-dispatch-logic.ts`、`check-role-dispatch.ts`、`run-log-logic.ts`、`check-run-log.ts`、`run-log.schema.json`、`preventive-review.schema.json`、相应测试/样本

- [ ] 步骤 1：TDD 红灯——[]/全 invalid/rootcause×3/重复维度/failed R/空 run-log/malformed-only/valid+malformed/schema variant 冲突/passed=false 无 findings 负例
- [ ] 步骤 2：role-dispatch：entries 空或 phaseMap 空 blocking；R3 只计 role=R+outcome=success+R3 action 且三维度至少各一；reasons 指出缺失维度
- [ ] 步骤 3：run-log-logic 空数组 fail-closed（NOT_CLOSED_NOT_PROVEN）；check-run-log parseErrors 并入 blocking（不动 readJsonlOrExit*，保持 metrics/wm-status 查询语义）
- [ ] 步骤 4：run-log schema 增加 variant/blocker/fixedLocation/fixBasedOn 与 fix/emergency-fix conditional；action-role 配对 blocking（R3/fix/review/gate）
- [ ] 步骤 5：preventive-review schema `if passed=false then findings.minItems=1`；结构 checker 行为不变并补测试
- [ ] 步骤 6：修正既有错误测试预期（role-dispatch-logic.test.ts:80-92）+ self-test/samples 同步
- [ ] 步骤 7：回归 + 切片审查 + 独立 commit

### 任务 4（Slice D）：pre-push stdin 与 fail-closed

**Files:** `.githooks/pre-push`、`platform-deps-hook.test.ts`、`docs-consistency-logic.test.ts`（hook 契约）

- [ ] 步骤 1：TDD 红灯——扩展 run() 支持 stdin；多 ref/新分支>20/删除 ref/删除+更新/坏行/非法 SHA/空 stdin fallback/force 对比测试
- [ ] 步骤 2：重构过滤段：先读 stdin 严格四字段；多 ref 聚合；new branch merge-base/fork-point 或 fail-closed；删除 ref 跳过本地 diff 但继续其他 ref；fallback 失败 fail-closed；`--force` 不改变 ref 语义；docs 根级匹配修正
- [ ] 步骤 3：回归（Git Bash）+ 切片审查 + 独立 commit

### 任务 5（Slice E）：SSoT/活体文档/样本/测试同步

**Files:** SSoT → references（command-reference/phase-5~8/subagent-delegation/hard-constraints/data-models/workflow）→ README/AGENTS/INSTALL/CONTRIBUTING/troubleshooting → `__tests__/README.md`、`samples/README.md`、docs-consistency/examples-contract 测试 → CHANGELOG/验收记录

- [ ] 步骤 1：SSoT 先改（ChangeScope/diff 证明/顺序/archive 后置/R3 矩阵/fix-emergency 字段）
- [ ] 步骤 2：references 同步（全部新 CLI 参数、strict/fail-closed、三种 R3 证明路径、失败链逐字不变）
- [ ] 步骤 3：活体文档同步 + troubleshooting 过期表述修正
- [ ] 步骤 4：测试/样本/脚本登记/README 矩阵同步；docs-consistency 与 examples-contract 断言更新
- [ ] 步骤 5：回归 + 切片审查 + 独立 commit；CHANGELOG 42.2.1 条目与验收记录追加（父链 40 字符、无 self-reference）

### 任务 6：全量验证与验收矩阵

- [ ] 步骤 1：定向负例逐项运行（真实退出码）
- [ ] 步骤 2：vitest 全量 / self-test / eval / typecheck / lint:security / docs-consistency / samples-coverage / audit:l0-links / doctor / npm audit
- [ ] 步骤 3：`npm run prepush`（Git Bash）17 项全绿；flake 只隔离重跑并如实记录
- [ ] 步骤 4：结果回填 CHANGELOG/验收记录；独立切片级门禁退出码为准

### 任务 7：最终独立审查与本地集成

- [ ] 步骤 1：origin/main..HEAD 全范围只读 review（独立子代理，最强模型）
- [ ] 步骤 2：修复轮（唤回/换新按 R≤3/R≥4）；review clean（Critical/Important 为零）
- [ ] 步骤 3：用户明确同意后才 ff-merge 到 main（本地，不 push）；清理 worktree 与分支
- [ ] 步骤 4：仅本地集成完成状态：main = 新 tip、worktree clean、未 push、版本 42.2.1

---

## 自检记录（编写时执行）

- 版本不变 42.2.1；.superpowers/ 不提交；主树不动。
- 每切片前 codegraph 查询落盘；无查询不编辑（约束 #14/反模式 #38）。
- 失败链文本（`V/G 失败 → R → V 复审 → G → S-fix → R3×3 → G → V → G → CHECKPOINT`）在 references/examples/templates 中逐字保留，不得出现 direct-rework bypass。
- 验收记录/CHANGELOG 身份引用用完整 40 字符 SHA；record 不 self-reference 自身 tip；每个最终 HEAD 变更追加父链行。
- 空输入收紧只发生在 role-dispatch 与 run-log gate 语义；metrics-report/wm-status 查询降级保持。
