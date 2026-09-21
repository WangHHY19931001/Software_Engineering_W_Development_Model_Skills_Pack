# 交互示例：编码阶段

> 对应 W 模型阶段 5（编码 + 单元测试执行）。命令：`/wm code <功能>` + `/wm test type=单元 result=<pass|fail>` + `/wm review`。
>
> **伪示例（仅供 LLM 行为对齐）**：本文件中的路径、产物和数字均为示意，不代表真实执行结果。真实命令输出见 [real-run-evidence.md](./real-run-evidence.md)；测试结果和门禁结论必须来自真实进程退出码，禁止由对话预设。

## 角色与阶段时序

1. O 读取阶段 4 已放行产物，运行 `ensure-codegraph.ts` 检查阶段 5 依赖（codegraph CLI 必需 + superpowers 三层检测），展示范围、同步单元测试和预期产物。
2. O 在 🔴 CHECKPOINT 等待用户确认进入阶段 5；未确认不得分派实施。
3. S-plan 执行 superpowers `writing-plans` 产出编码计划，并用 codegraph CLI（`codegraph query <符号>`；宿主 MCP 工具为可选加速）查询目标符号的 callers/callees/blast radius，落盘 `.w-model/codegraph-queries/` 证据。
4. 编码链每段都执行 `R3×3 → G(check-preventive-review, exit 0) → V → G`。plan 段通过后，S-plan 在任务内兼任 S-tickets，产出 `tickets.md`；随后 S-coding 按 plan 任务节逐任务执行。
5. execute 段中，S-coding 按 plan 任务节逐任务执行（`subagent-driven-development`）+ TDD 红-绿-重构。任何代码或测试文件修改前都重新做符号级 codegraph 查询并落盘；先运行新增单元测试观察预期失败，再实现代码并运行真实回归；任务完成写账本 `Task N: complete` + 三件套 + `review-*.diff`。
6. S 只按真实测试运行器结果执行 `/wm test type=单元 result=<pass|fail>` 回填 RTM，不得预填 `pass`。execute 段产物完成后再走 R3/G/V/G 和阶段 5 专属门禁。
7. O 展示评审、门禁、RTM 和测试证据，在 🔴 CHECKPOINT 等待用户放行；用户确认后才进入阶段 6。

## 示例对话

```text
用户: /wm code 用户注册功能

O: 已确认阶段 4 详细设计与单元测试设计处于已放行状态。
   依赖检测将检查 codegraph CLI、superpowers 三层检测（宿主技能目录 / 技能包资产 / 项目 docs/superpowers/）和项目目录；这里只报告真实检测结果，不自动假设 ready。

O: 🔴 CHECKPOINT · 进入阶段 5
   预期分派：S-plan → S-coding（任务内兼任 S-tickets）→ S-finalize；每段均有 R3×3、G、V、G。
   预期回填：RTM codeModule、真实单元测试 result、codegraph 与编码计划（plan / 账本 / 三件套）证据。
   请确认是否进入阶段 5。

用户: 确认

S-plan: 执行 superpowers writing-plans，并查询 UserService.register 的 callers/callees/blast radius。
        查询结果写入 .w-model/codegraph-queries/phase5-ticket-01-register.json。
        产出 docs/plans/phase5-user-register.plan.md（目标节 + 任务节，逐任务带「验证：」命令行），不修改代码。

R/G/V/G: R 完成 completeness/reliability/security 三份报告；
         G 运行 check-preventive-review.ts 并以真实 exitCode 判定；
         exit 0 后 V 评审 plan 产物，再由 G 校验评审与编码计划制品（check-coding-plan.ts）。

S-plan: 在任务内兼任 S-tickets，产出 tickets.md，按端到端行为拆分实现与单元测试。

R/G/V/G: 对 plan 段重复 R3×3 → G(preventive) → V → G。

S-coding: 按 plan 任务节逐任务执行（subagent-driven-development）。每个任务/切片修改代码/测试前重新查询目标符号并落盘。
          先运行新增单元测试观察预期失败，再实现 UserService.register；
          运行项目真实测试、覆盖率、lint 和编译命令，保留退出码与输出。
          任务完成写账本 .superpowers/sdd/<plan-基名>/progress.md 的「Task N: complete」+ 任务三件套 + review-*.diff。

S-coding: 真实运行器结束后，按输出二选一执行合法命令：
          /wm test type=单元 result=pass
          /wm test type=单元 result=fail
          只能执行与当次输出一致的一条，再据此回填 .w-model/rtm.json 的 unitTest 与 codeModule；
          不把未执行、失败或 pending 的用例写成通过。

R/G/V/G: 对 execute 段产物执行 R3×3 → G(preventive) → V → G，随后 S-finalize 收口：G 运行阶段 5 专属门禁（check-coding-plan.ts R1-R6）。

O: 展示真实测试摘要、V 结论、G 退出码、RTM 覆盖和 reworkHints。
O: 🔴 CHECKPOINT · 阶段 5 放行
   请确认放行到阶段 6，或选择返工。
```

## 阶段 5 专属门禁

以下命令为最小示例，路径必须替换为目标项目的真实产物；不得把示例文本当成已执行结果。

```bash
npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts . --phase=5 --scope=.w-model/change-scope.json
npx tsx w-model-dev/scripts/cli/check-coding-plan.ts . --phase=5 --scope=.w-model/change-scope.json
npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src/
npx tsx w-model-dev/scripts/cli/check-design-contract-consistency.ts .
npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts .w-model/state-machine-consistency.json
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=5 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/unit.json
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=5 --scope=.w-model/change-scope.json
```

阶段门还须包含 `check-preventive-review.ts`、`check-verifier-output.ts`、闭环 5 脚本、`check-role-dispatch.ts` 和 `check-signature-chain.ts`。任一普通 V/G、评审或真实测试失败时，必须走完整链：

```text
V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT
```

R 的报告未通过 V 复审和 G 根因门禁前不得 S-fix；S-fix 后未通过 R3×3 与预防审查门禁前不得重新 V/G。
完成返工不等于自动放行，O 仍须展示最新证据并等待 🔴 CHECKPOINT。

## 依赖变更审查

环境变量优先由宿主进程临时注入，不把 `.env` 或密钥写入仓库：

```powershell
$env:JWT_SECRET="test-secret-blog-demo"
npx vitest run
```

```bash
JWT_SECRET=test-secret-blog-demo npx vitest run
```

若**目标项目**确实需要 `dotenv`，不得直接把 `npm install dotenv` 当作无条件步骤。S-plan 先在编码计划（plan 任务节 + 设计依据）与 tickets 切片中说明用途、替代方案、版本兼容、许可证与安全影响；V 审查依赖必要性，用户在适用 CHECKPOINT 确认后，S-coding 才在目标项目根执行安装，并审阅 `package.json` / lockfile 差异、运行安全扫描与回归测试：

```bash
# 仅在已批准的目标项目根执行；版本按已审查的兼容范围确定
npm install dotenv
```

```typescript
// 仅当已批准采用 dotenv 时使用
import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');
```

上述命令是否通过必须以当次真实输出为准；示例不声明任何未执行结果。
