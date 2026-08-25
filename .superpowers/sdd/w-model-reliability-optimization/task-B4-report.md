# Task B4 报告：强制项目阶段门的 TLA/BDD 证据

日期：2026-08-25
基线：`61679a0`
工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`

## 变更

### artifact-gate application/CLI

- `w-model-dev/scripts/application/artifact-gate-assets.ts`
  - 将 `readTlaManifest` 从布尔存在性快照改为结构化结果，区分文件缺失、读取失败、非法 JSON、真实 `tla-manifest` Schema 失败和 `specs` 空数组；所有情况均保留可追踪 violation，避免非法输入被当成“缺失/空快照”静默跳过。
  - `readBddManifest` 保留文件存在性和 manifest 有效性两条状态；非法 JSON、Schema 畸形、feature 文件缺失和状态机结构缺陷均 fail-closed。项目阶段 1–8 缺少 BDD manifest 都会产生 blocking violation。
  - 新增 `readCucumberReport`，严格要求合法 `{ elements: [...] }`，命名 scenario、steps、`result.status` 和至少一个 passed step；failed、skipped、pending、undefined、unknown/非 passed 状态、匿名/错误形状和零执行均产生 violation。
  - 扩展 `runModelChecks`：
    - phase 1 不再依赖 graph，调用 TLA model 与 BDD model；BDD 调用固定传递 `--require-tla-equivalence --tla-manifest=<path>`。
    - phase 2–4 在 model 调用中继续传递 graph，缺 graph 产生 blocking violation。
    - phase 5–8 调用 BDD model 时固定传递 `--require-cucumber-report --cucumber-report=<path>`。
    - 在 TLA/BDD manifest 同时有效且项目契约要求时，经 `runSync` 调用 `check-tla-bdd-sync.ts`；无配对、子进程非零、无结果或输入失败均 blocking。
    - 所有生产同步子进程继续经过集中式 `runSync`，没有引入裸 `spawnSync`/`execSync`。

- `w-model-dev/scripts/cli/check-artifact-gate.ts`
  - 对项目阶段 1–4 传递真实 TLA manifest 有效性到质量门，并构造 TLA spec ↔ BDD feature 配对。
  - 新增 `--cucumber-report=<path>`；phase 5–8 默认使用 `<project-dir>/.w-model/bdd/reports/report.json`，并将明确路径传入 required BDD model 检查。
  - 将 TLA/BDD/Cucumber/sync violations 合并到既有 `reasons`、JSON 报告和 exit 1 流程；保留既有 exit 0/1/2、`ERROR_JSON`/`GATE_JSON` 输出路径。
  - phase 5–8 不再把 TLA manifest 作为 TLA 资产质量门输入，改由 required Cucumber 证据承担该阶段行为证据。

### 测试与阶段门文档

- `w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts`
  - 增加 TLA manifest 合法、缺失、非法 JSON、Schema 畸形、空 specs fail-closed 测试。
  - 增加 phase 1 无 graph 的 model 调用和 required 参数断言。
  - 增加 phase 5 required Cucumber 参数断言。
  - 增加 Cucumber 缺失、非法 JSON、错误形状、零执行、skipped、unknown、failed 与合法 passed 证据测试。
  - 增加 TLA↔BDD mismatch 和同步子进程无返回结果阻断测试。
  - 保留并验证 `runSync` timeout/killSignal/encoding/maxBuffer 安全边界断言。
- `w-model-dev/references/command-reference.md`
  - 增加 Artifact Gate 项目阶段证据门说明、默认 Cucumber 报告路径、phase 1 无 graph 边界、phase 2–4 graph 叠加、TLA↔BDD sync 阻断规则和 pre-push fixture 分层说明。

未修改 `check-bdd-model.ts` 或 `check-tla-bdd-sync.ts` 的既有 CLI/logic 契约；它们已有 required 参数和同步逻辑，本次通过 artifact-gate 接驳并在 application 层补齐 fail-closed 资产读取。

## TDD 记录

1. 先修改测试，将 `readTlaManifest` 期望改为结构化有效性结果，并加入非法 JSON、Schema 畸形、空 specs；同时加入 phase 1 required 参数、phase 5 Cucumber 参数和同步阻断断言。
2. 红灯命令：

   ```text
   npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts
   ```

   真实结果：`18 tests | 5 failed`。失败集中在生产代码仍返回 boolean，以及非法/缺失 manifest 没有 `exists/valid/violations` 结果，符合预期的功能缺口。

3. 最小实现后逐步补充 BDD/Cucumber/sync 边界测试；最终定向绿灯结果见下方验证记录。

## CodeGraph / fallback

已尝试 CodeGraph 查询：

- 查询：`artifact-gate-assets.ts runModelChecks readTlaManifest check-artifact-gate.ts check-bdd-model.ts check-tla-bdd-sync.ts tla-bdd-sync-logic.ts`
- 结果：当前工作树向上没有 `.codegraph/` 索引，CodeGraph 返回 unavailable；没有伪造符号、caller/callee 或 blast-radius 结果。
- fallback 记录：`.w-model/codegraph-queries/2026-08-25-B4-fallback.md`
- fallback 方法：直接读取目标符号，并用 `rg` 扫描 import、call-site、schema、测试和 `runSync` 安全边界。记录确认 `check-artifact-gate.ts → readTlaManifest/readBddManifest/runModelChecks`、`runModelChecks → runSync(check-tla-model/check-bdd-model/check-tla-bdd-sync)` 以及 required BDD CLI 参数解析路径。

## 真实验证命令与结果

以下命令均在工作树根目录执行，未运行 TLC 或无界全量测试：

1. 定向 Vitest：

   ```text
   npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts w-model-dev/scripts/__tests__/bdd-cli.test.ts w-model-dev/scripts/__tests__/tla-bdd-sync-logic.test.ts
   ```

   结果：exit 0；`3 passed` test files，`61 passed` tests，0 failed。

2. TypeScript：

   ```text
   npm run typecheck
   ```

   结果：exit 0；`tsc -p config/tsconfig.json` 无错误。

3. 目标文件格式：

   ```text
   npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/application/artifact-gate-assets.ts w-model-dev/scripts/cli/check-artifact-gate.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts w-model-dev/references/command-reference.md
   ```

   结果：exit 0；`All matched files use Prettier code style!`。

4. diff 空白：

   ```text
   git diff --check
   ```

   结果：exit 0。工作树中已有的 `progress.md` 行尾转换 warning 未产生 diff-check violation，且该文件未纳入 B4 提交。

## Concerns / deferred

- `check-tla-model.ts` 的既有 SANY/TLC 执行机制没有改变；本次测试严格没有启动 Java/TLC，避免无界或重量级模型执行。生产项目阶段门仍按既有 `check-tla-model.ts` 契约执行。
- Artifact Gate 与 `check-bdd-model.ts` 对 Cucumber 证据做了两层确定性校验（application 层先校验，BDD CLI 再校验），这是为防止 malformed report 被“缺失快照”降级；代价是失败报告可能出现两条相关 violation，但不改变 exit 1 语义。
- 默认 Cucumber 报告路径为 `.w-model/bdd/reports/report.json`，可通过 artifact-gate 的 `--cucumber-report=<path>` 覆盖；已有 pre-push fixture 测试不调用 artifact-gate，也不启用项目 required flags。
- CodeGraph 索引缺失是环境现状；已按要求记录 fallback，没有声称完成真实 CodeGraph 影响分析。

## 提交范围

预期仅提交 B4 代码、测试、阶段门文档和本报告；不提交 `.superpowers/.../progress.md`，不提交 `.w-model` 运行时状态或 fallback 查询生成物。
