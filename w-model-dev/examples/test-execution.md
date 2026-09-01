# 交互示例：测试执行阶段（集成 / 系统 / 验收）

> 对应 W 模型阶段 6 / 7 / 8（右 V 测试执行）。命令：`/wm test type=<集成|系统|验收> result=<pass|fail>`。
> `result` 必须由 S 在真实测试运行器结束后按输出回填；命令缺少 `result`、预设 `pass` 或由 LLM 估算均非法。
>
> **伪示例（仅供 LLM 行为对齐）**：本文件中的用例、路径和结果为流程示意，不代表真实执行。真实门禁输出见 [real-run-evidence.md](./real-run-evidence.md)，每次运行仍须以当次退出码为准。

## 共用角色闭环

阶段 6-8 均先由 O 检查上游放行状态和 codegraph/OpenSpec 依赖，再在 🔴 CHECKPOINT 等待用户确认进入阶段。需要新增或修改测试代码时，按以下顺序分派：

```text
S-explore(OpenSpec explore + codegraph 查询)
→ R3×3 → G(check-preventive-review, exit 0) → V → G
→ S-propose(OpenSpec propose + tickets)
→ R3×3 → G(check-preventive-review, exit 0) → V → G
→ S-coding(OpenSpec apply；改测试前 codegraph 查询；真实运行器执行)
→ 按真实输出回填 result=pass 或 result=fail
→ R3×3 → G(check-preventive-review, exit 0) → V → G(阶段专属门禁)
→ O 展示证据 → 🔴 CHECKPOINT
```

测试失败或普通 V/G 失败不得直接回编码。完整返工链为：

```text
V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix
→ R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT
→ 真实测试运行器重跑 → 按新输出回填 result
```

返工闭环完成后，O 仍须展示最新证据并等待用户在阶段门 CHECKPOINT 放行。

## 阶段 6：集成测试

```text
O: 已确认阶段 5 经用户放行。
O: 🔴 CHECKPOINT · 进入阶段 6
   展示阶段 3 设计的 IT 用例、测试环境和预期产物，等待用户确认。

S-coding: 运行真实集成测试套件。示例：IT-001、IT-003~005 通过，IT-002 失败；
          原始输出与退出码存档，不把本段示意数字当作真实结果。

S-coding: 因当次真实运行器存在失败，执行：
          /wm test type=集成 result=fail
          回填 RTM integrationTest 与 executionSummary，保留失败用例证据。

O: 分派 R 定位根因；R 报告经 V 复审和 G 的 check-rootcause-report exit 0 后，
   才分派 S-fix。S-fix 后完成 R3/G/V/G，并重新运行真实集成测试。

S-coding: 重跑结束后只能按新输出二选一：
          /wm test type=集成 result=pass
          /wm test type=集成 result=fail
          不得因“已经修复”自动选择 pass。

O: 展示真实测试、R3、V、G 与 RTM 证据。
O: 🔴 CHECKPOINT · 阶段 6 放行
   等待用户选择进入阶段 7 或继续返工。
```

## 阶段 7：系统测试与中间质量门

```text
O: 已确认阶段 6 经用户放行。
O: 🔴 CHECKPOINT · 进入阶段 7
   展示 ST 用例、性能/安全/兼容性阈值和测试环境，等待用户确认。

S-coding: 运行真实系统测试、性能测试、安全扫描、兼容性与可靠性测试；
          尚未获得运行器输出前不生成结果回填命令，不写通过数，不更新 RTM 为 pass。

S-coding: 真实运行结束后只能按输出二选一：
          /wm test type=系统 result=pass
          /wm test type=系统 result=fail

G: 在 R3 预防审查门禁和 V 评审通过后，运行阶段 7 中间质量门：
   npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=7

O: 仅展示该命令当次真实 stdout、GATE_JSON 和退出码。
   `--phase=7` 只检查到系统测试层；不得使用默认 phase 8，也不得宣称尚未执行的验收测试通过。
O: 🔴 CHECKPOINT · 阶段 7 放行
   只有真实系统测试 result=pass、V/G 通过且用户确认，才进入阶段 8。
```

阶段 7 的 BDD 执行门禁同样使用真实 Cucumber 报告：

```bash
npx tsx w-model-dev/scripts/cli/check-bdd-model.ts .w-model/bdd-manifest.json --phase=7 --graph=.w-model/ingestion/graph.json --require-cucumber-report --cucumber-report=reports/cucumber/system.json
```

## 阶段 8：验收测试与项目放行

```text
O: 已确认阶段 7 经用户放行。
O: 🔴 CHECKPOINT-A · 验收执行前
   展示阶段 1 设计的 UAT、环境差异、执行人与前置数据；等待用户确认开始。

S-coding: 分批运行真实验收测试。每批只展示实际通过/失败/阻塞清单；
          到达批次同步点时进入 🟡 CHECKPOINT-B，由用户决定继续或暂停排查；
          失败率触发强制暂停时先走根因返工链，不继续假设后续用例通过。

S-coding: 全部真实运行结束后只能按输出二选一：
          /wm test type=验收 result=pass
          /wm test type=验收 result=fail

G: 运行 BDD 验收门禁、阶段 8 终检与归档门禁。终检命令为：
   npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts .
   该命令无 `--phase`，只有真实 exit 0 才能作为四级测试与 RTM 终检证据。

O: 🔴 CHECKPOINT-C · 项目级放行
   逐条展示真实 UAT、RTM、四级测试、V/G 和归档证据；
   由真实用户在验收报告记录 confirm / confirm-with-comments / reject，O 不得代签。
```

## 要点

- 每条 `/wm test` 执行命令都必须含 `result=pass|fail`，值与当次真实运行器输出一致。
- `result=fail` 先回填失败事实，再走完整 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；修复不自动把结果改为 pass。
- 阶段 7 显式使用 `check-artifact-gate.ts . --phase=7`；阶段 8 终检才使用无 `--phase` 的默认终检。
- G exit 0、V 通过和真实测试 pass 都只是必要条件；跨阶段或项目完成仍须用户 CHECKPOINT 确认。
- RTM 由 S 在每次真实测试执行后更新对应列与 `executionSummary`，O/V/G 不代填测试结果。
