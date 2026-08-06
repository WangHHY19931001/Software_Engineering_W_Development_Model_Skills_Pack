# 第 33 轮 · 批次 4 设计：流程与体验

> 触发：全仓库深入分析识别流程配置与体验类改进，共 10 项（4 项 P2 + 6 项 P3）。总框架 spec 见 [2026-08-05-optimization-overview-design.md](./2026-08-05-optimization-overview-design.md) §3.4。
>
> 当前版本：`32.0.0`（版本号在全部批次完成后统一升级 33.0.0，本批不升版本号）。
>
> 依赖：批次 2（部分文档交叉，如 __tests__/README.md 覆盖矩阵）。
>
> 工作流：总框架头脑风暴 → 本批次 spec → 本批次 plan → 实施 → 回归 → 提交。

## 1. 背景与缺口（探索实测，2026-08-05）

| # | 级别 | 现状（只读探索证据） | 代价 / 风险 |
|---|---|---|---|
| 4.1 | P3 | 根 `.gitignore` 缺 `coverage/`、`*.tsbuildinfo`、`.eslintcache`；demo `.gitignore` 仅覆盖 `.w-model/tla/states/` 与 `.w-model/gate-logs/*.log` 两个子路径，无完整 `.w-model/` 规则 | 测试覆盖率/tsbuildinfo/eslint 缓存可能误提交；demo 的 `.w-model/` 其它产物（tickets.md、codegraph-queries/）可能误提交 |
| 4.2 | P3 | `tsconfig.json:33` 显式 `exclude` 了 `w-model-dev/scripts/__tests__` | `__tests__` 未纳入 tsc 类型检查，测试代码类型错误无法被静态捕获 |
| 4.3 | P2 | `.githooks/pre-push` 仅 `set -u`（无 `-e`/`-o pipefail`）；L109 注释硬编码"149"（应为 213）；无 Windows 兼容入口（依赖 bash） | 门禁脚本中途失败不中断；注释与实际样本数漂移；Windows 下 prepush 不可用 |
| 4.4 | P2 | demo 目录 11 个 `build-*.cjs` + 5 个 `integration-*.txt`（16 文件）均未被 package.json scripts 或测试引用；产物文档已提交（docs/phase3-design/） | 历史生成工具与临时产物冗余，约瘦身 15-20% |
| 4.5 | P3 | `docs/changes/2026-07-28-round20-phase1-4dim-identification/` 仅 design.md，无配套，不在 archive/；被 2 个 plan 引用 | 孤悬变更目录，结构不一致 |
| 4.6 | P2 | 技能双轨（w-model-dev references 与 .cursor/skills）之间完全无交叉引用：writing-plans ↔ phase-5-coding、code-reviewer ↔ verifier-spec 均未互引 | 双轨契约漂移：同一概念两处定义无关联 |
| 4.7 | P2 | `__tests__/README.md` 覆盖矩阵 18 行 vs 实际 33 个 test 文件，缺 15 行（含批次 3 新增的 state-machine-logic.test.ts） | 覆盖矩阵不完整，回归定位困难 |
| 4.8 | P3 | `brainstorming/scripts/start-server.sh` 无 `set -euo pipefail`；L147 `kill "$old_pid"` 无 PID 归属校验 | 脚本中途失败不中断；误杀同 PID 复用进程风险 |
| 4.9 | P3 | `brainstorming/SKILL.md:169` 引用 `skills/brainstorming/visual-companion.md`（缺 `.cursor/` 前缀） | 路径前缀错误，链接失效 |
| 4.10 | P3 | `.cursor/skills/systematic-debugging/` 下 4 个孤立测试产物（test-academic.md + test-pressure-1/2/3.md）无任何引用；无 archive 目录 | 孤立产物冗余 |

### 1.1 不涉及范围

- 不改任何脚本的 stdout / stderr / exit code 语义（行为等价硬门槛）。
- 不新增运行时依赖。
- 版本号不升（批次 5 收尾统一 33.0.0）。
- 4.4 删除前须确认产物文档完整（docs/phase3-design/ 下 integration-test.md、interface-design.md 等已提交）。
- 4.5 孤悬 design.md 被 2 个 plan 引用，不能直接删除——归档或补配套。

## 2. 方案（10 项）

| # | 方案 | 说明 | 结论 |
|---|---|---|---|
| 4.1 | 根 .gitignore 补 `coverage/`、`*.tsbuildinfo`、`.eslintcache`；demo .gitignore 补完整 `.w-model/` | 防误提交 | 采纳 |
| 4.2 | tsconfig 从 exclude 移除 `__tests__`，纳入 tsc 检查 | 静态捕获测试类型错误 | 采纳（需 tsc 验证） |
| 4.3 | pre-push 改 `set -euo pipefail`；L109 注释 149→213；加 Windows 兼容入口 | 门禁健壮性 + 跨平台 | 采纳 |
| 4.4 | 删 demo 11 个 build-*.cjs + 5 个 integration-*.txt | 瘦身 15-20% | 采纳（先确认产物完整） |
| 4.5 | 孤悬 design.md 移入 archive/（补配套或归档） | 结构一致 | 采纳 |
| 4.6 | 补 4 处交叉引用：writing-plans↔phase-5-coding、code-reviewer↔verifier-spec | 双轨契约对齐 | 采纳 |
| 4.7 | __tests__/README.md 覆盖矩阵补 15 行 | 矩阵完整 | 采纳 |
| 4.8 | start-server.sh 加 `set -euo pipefail` + kill 前 PID 归属校验 | 脚本健壮性 | 采纳 |
| 4.9 | brainstorming SKILL.md:169 路径前缀 `skills/`→`.cursor/skills/` | 链接修复 | 采纳 |
| 4.10 | systematic-debugging 4 个孤立测试产物归档或删除 | 清理冗余 | 采纳 |

### 2.1 关键决策

1. **4.2 纳入 __tests__ 后 tsc 必须 0 错误**：若纳入后个别 test 文件报错（noUnusedLocals 等），须修复测试代码（不降低 tsconfig 严格度），以 tsc 0 错误为验收门槛。
2. **4.3 Windows 兼容入口**：pre-push 依赖 bash，Windows 下 prepush 不可用。方案：在 pre-push 顶部加 OS 检测，Windows 下提示用 Git Bash 或提供 .cmd 包装；或 package.json prepush 脚本改为跨平台调用。以最小改动 + 不破坏现有 Linux/macOS 行为为原则。
3. **4.4 删除授权**：总框架 D4 已授权删除 demo 冗余 build 脚本与 txt；删除前确认产物文档完整。
4. **4.5 归档方式**：孤悬 design.md 被 2 个 plan 引用——归档到 archive/ 时保留引用可达（更新 plan 引用路径或归档目录内保留 design.md）。以"归档 + 更新引用"为优先，不删除。
5. **4.6 交叉引用**：补引用时保持文档风格一致（markdown 相对链接），不改变内容语义。
6. **4.10 归档 vs 删除**：4 个孤立测试产物无引用——优先归档到 systematic-debugging/archive/（保留历史），若 archive 目录不存在则新建。

## 3. 详细设计

### 3.1 .gitignore 补充（4.1）

根 `.gitignore` 追加（放在合适分组）：
```
# 测试与构建缓存
coverage/
*.tsbuildinfo
.eslintcache
```
demo `.gitignore` 追加完整 `.w-model/` 规则（替换/补充现有子路径规则）：
```
# W-Model 运行时状态（完整忽略，含 tickets.md / codegraph-queries/ 等）
.w-model/
```
（保留 demo 现有的 coverage/、dist/、node_modules/ 等规则）

### 3.2 tsconfig 纳入 __tests__（4.2）

`tsconfig.json:33` 的 exclude 数组移除 `"w-model-dev/scripts/__tests__"`。跑 `npx tsc --noEmit` 验证 0 错误；若报错，修复对应 test 文件（不降严格度）。

### 3.3 pre-push 加固（4.3）

`.githooks/pre-push`：
- L19 `set -u` → `set -euo pipefail`；
- L109 注释 `149 条样本回归基线` → `213 条样本回归基线`（核对 self-test 实际样本数）；
- Windows 兼容入口：顶部加 OS 检测，Windows 下提示使用 Git Bash 或调用 .cmd 包装（以最小改动为原则，不破坏 Linux/macOS 行为）。

### 3.4 demo 清理（4.4）

删除 `w-model-dev-demo/` 下 11 个 `build-*.cjs` + 5 个 `integration-*.txt`。删除前确认 `docs/phase3-design/` 下产物文档完整（integration-test.md、interface-design.md 等已提交）。

### 3.5 孤悬 design.md 归档（4.5）

`docs/changes/2026-07-28-round20-phase1-4dim-identification/design.md` 移入 `docs/changes/archive/`（新建对应归档目录或并入现有 round20 归档）。更新 2 个 plan 的引用路径（`2026-07-28-phase1-4dim-identification.md` 与 `-phase-D-G.md`）。

### 3.6 技能双轨交叉引用（4.6）

补 4 处交叉引用（保持文档风格，markdown 相对链接）：
- `.cursor/skills/writing-plans/SKILL.md`：补引用 `w-model-dev/references/phase-5-coding.md`（编码阶段计划）；
- `w-model-dev/references/phase-5-coding.md`：补引用 writing-plans 技能；
- `.cursor/skills/requesting-code-review/code-reviewer.md`：补引用 `w-model-dev/references/verifier-spec.md`（评审规范）；
- `w-model-dev/references/verifier-spec.md`：补引用 code-reviewer 技能。

### 3.7 __tests__/README.md 覆盖矩阵（4.7）

补 15 行缺失 test 文件（含批次 3 新增的 state-machine-logic.test.ts）：archive-integrity-logic / checkpoint-logic / coverage-logic / design-contract-logic / exemption-logic / graph-logic / plan-chunks / preventive-review-logic / role-dispatch-logic / safe-json / signature-chain-logic / state-machine-logic / tla-bdd-sync-logic / tla-clean-trace / verifier-logic。每行按 `File | Area | What's locked in` 格式，Area 与 What's locked in 从各 test 文件实际覆盖内容提炼。

### 3.8 start-server.sh 加固（4.8）

`.cursor/skills/brainstorming/scripts/start-server.sh`：
- 顶部加 `set -euo pipefail`；
- L147 `kill "$old_pid"` 前加 PID 归属校验：确认该 PID 属于本脚本启动的 server.cjs 进程（如检查进程命令行含 server.cjs，或记录启动 PID 后校验），不匹配则跳过 kill。

### 3.9 brainstorming SKILL.md 路径前缀（4.9）

`.cursor/skills/brainstorming/SKILL.md:169`：`skills/brainstorming/visual-companion.md` → `.cursor/skills/brainstorming/visual-companion.md`。

### 3.10 systematic-debugging 孤立产物归档（4.10）

`.cursor/skills/systematic-debugging/` 下 4 个孤立测试产物（test-academic.md + test-pressure-1/2/3.md）移入新建的 `archive/` 子目录（保留历史）。

## 4. 验证策略（批次 4 验收标准）

1. **全局基线**：`npm run self-test` 213 条全通过；`npx vitest run` 全通过；`npx tsc --noEmit` 0 错误（含 4.2 纳入 __tests__ 后）；`npm run lint:security` baseline 通过。
2. **4.2 特例**：tsconfig 纳入 __tests__ 后 tsc 0 错误（若报错须修复测试代码，不降严格度）。
3. **4.3 特例**：`npm run prepush` 在 Linux/macOS 下 12 项全过；Windows 下给出兼容提示或可运行。
4. **4.4 特例**：demo 瘦身后测试套件不受影响（demo 的 test 脚本仍可运行）；产物文档完整。
5. **4.5 特例**：归档后 2 个 plan 引用可达（无 404）。
6. **4.6 特例**：4 处交叉引用目标文件存在（无 404）。
7. **4.7 特例**：覆盖矩阵 33 行 = 实际 33 个 test 文件。
8. **4.8 特例**：start-server.sh 语法正确（`bash -n`）；kill 前归属校验逻辑正确。
9. **4.9 特例**：`skills/` 前缀全仓 0 命中（brainstorming SKILL.md）。

## 5. 影响文件清单

| 类别 | 文件 | 动作 |
|---|---|---|
| 修改 | 根 `.gitignore`、`w-model-dev-demo/.gitignore` | 修改（4.1） |
| 修改 | `tsconfig.json` | 修改（4.2） |
| 修改 | `.githooks/pre-push` | 修改（4.3） |
| 删除 | `w-model-dev-demo/` 11 个 build-*.cjs + 5 个 integration-*.txt | 删除（4.4） |
| 移动 | `docs/changes/2026-07-28-round20-phase1-4dim-identification/design.md` → archive/ | 移动（4.5） |
| 修改 | 2 个 plan 引用路径 | 修改（4.5） |
| 修改 | `.cursor/skills/writing-plans/SKILL.md`、`w-model-dev/references/phase-5-coding.md`、`.cursor/skills/requesting-code-review/code-reviewer.md`、`w-model-dev/references/verifier-spec.md` | 修改（4.6） |
| 修改 | `w-model-dev/scripts/__tests__/README.md` | 修改（4.7） |
| 修改 | `.cursor/skills/brainstorming/scripts/start-server.sh` | 修改（4.8） |
| 修改 | `.cursor/skills/brainstorming/SKILL.md` | 修改（4.9） |
| 移动 | `.cursor/skills/systematic-debugging/` 4 个孤立产物 → archive/ | 移动（4.10） |

提交粒度（子任务级）：4.1 gitignore → 4.2 tsconfig → 4.3 pre-push → 4.4 demo 清理 → 4.5 归档 → 4.6 交叉引用 → 4.7 覆盖矩阵 → 4.8 start-server → 4.9 路径前缀 → 4.10 孤立产物归档。
