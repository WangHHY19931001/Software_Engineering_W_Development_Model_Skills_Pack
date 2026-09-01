# w-model-dev 全面优化实施计划（收尾 + 清债 + 审计）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已批准设计（`docs/superpowers/specs/2026-09-01-w-model-dev-full-optimization-design.md`）完成三批次优化：42.1.1 收口 → 42.2.0 易用性清债（19 stub 移除 + SKILL.md <100 行）→ 全门禁体检 + 静态审计 + 修复。

**Architecture:** 三批次严格串行。批次 1 纯发布卫生（版本/CHANGELOG/验收记录，零代码变更）；批次 2 结构性清债（stub 移除 + 13 处活体引用重链 + SKILL.md 收敛，门禁同提交链闭合）；批次 3 全门禁真实执行 + 5 项静态审计 + P0-P2 修复。所有门禁以真实退出码为准，禁止估算（硬红线 #4/#9）。

**Tech Stack:** Node ≥20 + tsx + vitest（runner）、ajv、eslint-plugin-security、PowerShell 终端（pre-push 用 Git Bash）。

**关键事实（编写计划时实测）：**

- 当前版本 42.1.0（main HEAD `69410f7`，工作区干净）；42.1.1 修正 3 个 commit 已落库未收口：`e20e579`+`0d03b4a`（竞态修复）、`7e97baa`（baseline 对账，411→295 条）、`93f6f3a`（活体文档微修）。
- `npm run version:bump -- <ver>` 一条命令同步 7 文件（package.json / skill-metadata.json / SKILL.md / README.md / docs/INSTALL.md / package-lock.json / CHANGELOG 节头插入，正文自填）。
- **19 个 stub 的活体引用实测仅 13 处**（其余 1067 处匹配为模板子文件同名 / 历史文档 / 章节语义引用，不重链）：tools/README ×2、examples ×3、schemas ×8。eval/mappings.json 无 stub 锚点；scripts 中 `dispatch-matrix` 均指 subagent-delegation.md 内的**节名**（非 stub 文件），不改。
- 不改项：`references/coding-quality.md:3`（合并史实注记）、`references/quick-self-check.md:42`（外部 GitHub 出处）、phase/templates 全部 `glossary.md` 引用（模板子文件）、`docs/superpowers/`、`docs/changes/`、CHANGELOG 历史条目。
- 资源计数 2 处需同步：`w-model-dev/SKILL.md:132`（59→40）、`README.md:192`（59 份→40 份）。docs-consistency 的 references-count 检查读 SKILL.md 声明值与实测比对，改声明值即可。
- SKILL.md 当前 139 总行 / 106 非空行；收敛方案见任务 4（7 处精确剪辑，-7 非空行 → 99）。
- tla-plus.md 内含「§2.0 命名规范」「§2.1 路径解析基准」「checkRounds 字段语义」「工具链」节，schema 引用改指 tla-plus.md 后节号/节名直接成立。

**PowerShell 注意：** 所有命令在仓库根 `d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack` 执行；vitest/prepush 输出长，末尾核对 exit code 与汇总行即可。

---

## 文件结构

| 文件 | 职责 | 操作 |
|---|---|---|
| `package.json` 等 7 文件 | 版本单源同步 | version:bump 改写 |
| `CHANGELOG.md` | 42.1.1 / 42.2.0 /（视发现）42.2.1 条目 | 修改 |
| `w-model-dev/tools/README.md` | tla-plus-guide → tla-plus（2 处） | 修改 |
| `w-model-dev/examples/stage1-requirement-analysis.md`、`examples/README.md` | dispatch-matrix → subagent-delegation（3 处） | 修改 |
| `w-model-dev/schemas/tla-manifest.schema.json`（2 处）、`code-tla-manifest.schema.json`（3 处）、`hill-climbing-report.schema.json`（1 处）、`iceberg-sweep.schema.json`（2 处） | 旧文档名 → 合并目标（8 处） | 修改 |
| `w-model-dev/references/`（19 个 stub 文件） | 删除 | 删除 |
| `w-model-dev/SKILL.md` | 资源计数 59→40；收敛 7 处剪辑 | 修改 |
| `README.md` | references 计数 59→40 | 修改 |
| `docs/changes/`（3 份验收记录） | 批次验收 | 新建 |

---

### 任务 1（批次 1）：42.1.1 版本收口 + CHANGELOG + 验收记录

**Files:**
- Modify: `package.json`、`w-model-dev/skill-metadata.json`、`w-model-dev/SKILL.md`、`README.md`、`docs/INSTALL.md`、`package-lock.json`、`CHANGELOG.md`（由 version:bump 改写）
- Create: `docs/changes/2026-09-01-42.1.1-deferred-fixes-acceptance.md`

- [ ] **步骤 1：版本号升级（7 文件单源同步）**

运行：`npm run version:bump -- 42.1.1`
预期：exit 0，日志显示 7 处（package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ INSTALL 激活 YAML / package-lock 两处 / CHANGELOG 插入 `## [42.1.1] - <今日>` 节头）。

- [ ] **步骤 2：填写 CHANGELOG 42.1.1 条目正文**

将 version-bump 插入的占位行 `- （条目由本次应用到该版本的 commit 作者填写）` 替换为：

```markdown
### 修复（42.1.0 deferred 项修正收口）

- **run-sync ↔ dependency-boundaries 全量并行竞态**：`collectTypeScriptFiles` 跳过 `.d2-` 瞬态 fixture（dependency-boundaries 并行测试写入的 `scripts/logic/.d2-boundary-fixture-<pid>.ts` 生命周期窗口曾触发 ENOENT），新增回归测试；run-sync × dependency-boundaries 组合 5 连跑全绿（`e20e579` + `0d03b4a`）。
- **security baseline v2 全量对账**：`--regenerate` 消除 49 提交累计卫生债——删除 116 条孤儿条目并修正 line 漂移，411 → 295 条（`7e97baa`）。
- **活体文档/风格微修**：samples/README graph 行 R1-R15、conventions §2.1 evidenceAnchor 复用说明、ingestion-chunk A-chunk L42 代码来源示例、SSoT §10A 4A.1b 表行对齐、subagent-delegation §3.1 触发表补 evidence-anchored-tree 行、graph-logic R15 块 `test()`→`it()` 风格统一（`93f6f3a`）。
```

- [ ] **步骤 3：self-test 验证**

运行：`npm run self-test`
预期：exit 0，262/262。

- [ ] **步骤 4：竞态组合 5 连跑（42.1.1 核心证据）**

运行（PowerShell）：

```powershell
1..5 | ForEach-Object { npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts 2>$null | Select-Object -Last 3; if ($LASTEXITCODE -ne 0) { "RUN $_ FAILED" } else { "RUN $_ OK" } }
```

预期：5 行 `RUN N OK`，0 FAILED。

- [ ] **步骤 5：docs-consistency 验证**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（版本一致性检查比对 7 处应全过；若报动态 vitest 违规且隔离重跑变绿，按已知负载 flake 记录并重跑确认）。

- [ ] **步骤 6：写验收记录**

创建 `docs/changes/2026-09-01-42.1.1-deferred-fixes-acceptance.md`：

```markdown
# 42.1.1 deferred 项修正验收记录

> 收口范围：`e20e579`+`0d03b4a`（竞态修复）、`7e97baa`（baseline 对账）、`93f6f3a`（活体文档微修）3 个已落库 commit 的发布收口（版本/CHANGELOG/本记录）。设计见 docs/superpowers/specs/2026-09-01-w-model-dev-full-optimization-design.md §4。

## 门禁矩阵（真实退出码）

| 命令 | 结果 |
|---|---|
| `npm run version:bump -- 42.1.1` | exit 0，7 文件同步 |
| `npm run self-test` | exit 0，262/262 |
| run-sync × dependency-boundaries 组合 5 连跑 | 5/5 OK |
| `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` | exit 0 |

## baseline 对账终值

`.eslintsecurity-baseline.json` 411 → 295 条（删 116 孤儿；实测 `entries.length`）。

## 未执行命令不作通过声明

（按实况填写；无其他声明项。）
```

- [ ] **步骤 7：Commit**

```powershell
git add -A; git commit -m "release(42.1.1): close deferred-fixes release (version sync + changelog + acceptance record)"
```

---

### 任务 2（批次 2a）：19 个 stub 的 13 处活体引用重链

**Files:**
- Modify: `w-model-dev/tools/README.md:13,17`
- Modify: `w-model-dev/examples/stage1-requirement-analysis.md:46`
- Modify: `w-model-dev/examples/README.md:37,84`
- Modify: `w-model-dev/schemas/tla-manifest.schema.json:22,102`
- Modify: `w-model-dev/schemas/code-tla-manifest.schema.json:34,43,44`
- Modify: `w-model-dev/schemas/hill-climbing-report.schema.json:155`
- Modify: `w-model-dev/schemas/iceberg-sweep.schema.json:58,93`

- [ ] **步骤 1：tools/README.md 2 处（tla-plus-guide → tla-plus）**

L13：`**权威版本记录**：\`references/tla-plus-guide.md\`「工具链」节` → `**权威版本记录**：\`references/tla-plus.md\`「工具链」节`（行内其余文字逐字保留）。
L17：`（唯一外部依赖，见 tla-plus-guide.md「工具链」节）` → `（唯一外部依赖，见 tla-plus.md「工具链」节）`。

- [ ] **步骤 2：examples 3 处（dispatch-matrix.md → subagent-delegation.md）**

- `stage1-requirement-analysis.md:46`：`完整分派见 [dispatch-matrix.md](../references/dispatch-matrix.md)。` → `完整分派见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）。`
- `examples/README.md:37`：`完整分派矩阵见 [dispatch-matrix.md](../references/dispatch-matrix.md)。` → `完整分派矩阵见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）。`
- `examples/README.md:84`：`阶段 2/3/4 门禁命令详见 [dispatch-matrix.md](../references/dispatch-matrix.md) 与` → `阶段 2/3/4 门禁命令详见 [subagent-delegation.md](../references/subagent-delegation.md)（dispatch-matrix 节）与`（行内其余逐字保留）。

- [ ] **步骤 3：schemas 8 处（旧文档名 → 合并目标）**

| 文件:行 | 现文 | 改为 |
|---|---|---|
| tla-manifest.schema.json:22 | `（tla-plus-guide §2.1）` | `（tla-plus.md §2.1）` |
| tla-manifest.schema.json:102 | `语义见 tla-plus-guide「checkRounds 字段语义」` | `语义见 tla-plus.md「checkRounds 字段语义」` |
| code-tla-manifest.schema.json:34 | `须符合 tla-plus-guide §2.0 命名规范` | `须符合 tla-plus.md §2.0 命名规范` |
| code-tla-manifest.schema.json:43 | `见 tla-plus-guide §2.1` | `见 tla-plus.md §2.1` |
| code-tla-manifest.schema.json:44 | `见 tla-plus-guide §2.1` | `见 tla-plus.md §2.1` |
| hill-climbing-report.schema.json:155 | `（待人审后加入 anti-patterns.md）` | `（待人审后加入 hard-constraints.md 反模式节）` |
| iceberg-sweep.schema.json:58 | `遵循 format-conventions.md` | `遵循 conventions.md 格式约定` |
| iceberg-sweep.schema.json:93 | `（遵循 format-conventions.md 冒号分隔）` | `（遵循 conventions.md 格式约定冒号分隔）` |

（节号/节名已实测存在于合并目标：tla-plus.md 含 §2.0/§2.1/checkRounds 字段语义/工具链 节。）

- [ ] **步骤 4：全仓活体引用复核（确认无遗漏）**

运行（PowerShell）：

```powershell
git grep -n -E "(tla-plus-guide|tla-plus-syntax-reference|tla-plus-patterns-examples|tla-plus-review-checklist|tla-plus-tlc-configuration|bdd-guide|bdd-syntax-reference|bdd-patterns-examples|bdd-review-checklist)\.md|anti-patterns\.md|dispatch-matrix\.md|subagent-persona-matrix\.md|references/glossary\.md|references/format-conventions\.md|references/directory-conventions\.md|design-patterns-catalog\.md|refactoring-catalog\.md|code-smells-checklist\.md|definition-of-done\.md" -- 'w-model-dev' 'README.md' 'AGENTS.md' 'docs/INSTALL.md' 'docs/user-guide.md' 'docs/troubleshooting.md' 'docs/adoption-guide.md' 'docs/skill-design-document_SSoT.md' 'docs/_sidebar.md' 'eval'
```

预期：0 匹配（上述 13 处已全部重链；若出现新匹配，逐条判断——链接到 stub 文件的重链，历史注记/外部出处/章节语义保留并在提交说明登记）。

- [ ] **步骤 5：快速验证 schema 仍可被 loader 解析**

运行：`npm run self-test`
预期：exit 0，262/262（schema description 变更不影响校验逻辑，此步防手误破坏 JSON）。

- [ ] **步骤 6：Commit**

```powershell
git add -A; git commit -m "refactor(references): re-link 13 live stub references to merged targets (pre-stub-removal)"
```

---

### 任务 3（批次 2b）：删除 19 个 stub + 资源计数同步

**Files:**
- Delete: `w-model-dev/references/` 下 19 个 stub（见清单）
- Modify: `w-model-dev/SKILL.md:132`、`README.md:192`

- [ ] **步骤 1：删除 19 个 stub 文件**

删除清单（每个均为 2 行重定向文件，删除前逐个 `Get-Content` 确认是 stub 而非实质文件）：

```
w-model-dev/references/tla-plus-guide.md
w-model-dev/references/tla-plus-syntax-reference.md
w-model-dev/references/tla-plus-patterns-examples.md
w-model-dev/references/tla-plus-review-checklist.md
w-model-dev/references/tla-plus-tlc-configuration.md
w-model-dev/references/bdd-guide.md
w-model-dev/references/bdd-syntax-reference.md
w-model-dev/references/bdd-patterns-examples.md
w-model-dev/references/bdd-review-checklist.md
w-model-dev/references/anti-patterns.md
w-model-dev/references/dispatch-matrix.md
w-model-dev/references/subagent-persona-matrix.md
w-model-dev/references/glossary.md
w-model-dev/references/format-conventions.md
w-model-dev/references/directory-conventions.md
w-model-dev/references/design-patterns-catalog.md
w-model-dev/references/refactoring-catalog.md
w-model-dev/references/code-smells-checklist.md
w-model-dev/references/definition-of-done.md
```

- [ ] **步骤 2：资源计数同步**

- `w-model-dev/SKILL.md:132`：`- **资源计数**：\`references/\`（59 个 .md）、\`schemas/\`（23 份 JSON Schema draft-07，含 evidence-manifest / evidence-provenance）、门禁脚本 37 个 .ts。` → 将 `59 个 .md` 改为 `40 个 .md`（行内其余逐字保留）。
- `README.md:192`：`│   ├── references/               # 59 份阶段细则与规范（按需加载，禁止一次性全读）` → 将 `59 份` 改为 `40 份`。

- [ ] **步骤 3：实测计数核对**

运行（PowerShell）：`(Get-ChildItem w-model-dev/references -Filter *.md).Count`
预期：`40`。

- [ ] **步骤 4：docs-consistency 验证（references-count 契约）**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（SKILL.md 声明 40 与实测 40 一致；若其他契约因删除失败，同任务内修复后重跑）。

- [ ] **步骤 5：Commit**

```powershell
git add -A; git commit -m "refactor(references): remove 19 overdue redirect stubs (59 -> 40 md files)"
```

---

### 任务 4（批次 2c）：SKILL.md 收敛 106 → <100 非空行

**Files:**
- Modify: `w-model-dev/SKILL.md`（6 处剪辑共 -7 非空行，全部为行级合并/移动，无信息删除；执行工作流 12 步 → 10 步）

- [ ] **步骤 1：剪辑 A——「快速自检」节并入工作流尾注（-2 非空行）**

删除文件尾部整节：

```markdown
## 快速自检

推进或完成声明前按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验；交互样例按需读 [examples/](examples/)。
```

并将「执行工作流」节末行：

```markdown
完整阶段切换与回退流程见 [references/workflow.md](references/workflow.md)。
```

改为：

```markdown
完整阶段切换与回退流程见 [references/workflow.md](references/workflow.md)；推进或完成声明前按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验；交互样例按需读 [examples/](examples/)。
```

- [ ] **步骤 2：剪辑 B1——工作流步骤 2+3 合并（-1 非空行）**

将：

```markdown
2. **环境自检**（O）：首次启用或门禁报依赖错误时跑 `npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla]`。
3. **读取状态**（O）：读 `.w-model/project.json` 与 `rtm.json`；损坏先恢复（operational-recovery.md）。
```

改为：

```markdown
2. **读取状态与环境自检**（O）：读 `.w-model/project.json` 与 `rtm.json`（损坏先恢复，见 operational-recovery.md）；首次启用或门禁报依赖错误时跑 `npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla]`。
```

后续步骤编号顺延 -1（原 4→3 … 原 12→11）。

- [ ] **步骤 3：剪辑 B2——工作流步骤（合并后）4+5 合并（-1 非空行）**

将（编号已顺延）：

```markdown
3. **检查前置产物**（O）：缺上游产物拒绝跳阶段，指出应返回的命令。
4. **加载最小引用集**（O）：只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件。
```

改为：

```markdown
3. **前置产物与最小引用集**（O）：缺上游产物拒绝跳阶段并指出应返回的命令；只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件。
```

后续步骤编号再顺延 -1。

- [ ] **步骤 4：剪辑 D——触发决策表前两行合并（-1 非空行）**

将：

```markdown
| `/wm ...`、W-model、W 模型、W 开发模型 | 立即启用 |
| 明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
```

改为：

```markdown
| `/wm ...`、W-model、W 模型、W 开发模型，或明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
```

- [ ] **步骤 5：剪辑 K——双 CHECKPOINT 引用合并（-1 非空行）**

将：

```markdown
> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 的「质量等级 / 各子标准分 / reworkHints」，等待用户选择放行或返工。
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检跑 check-artifact-gate.ts，退出码 0 后展示 RTM 覆盖率、四级测试结果，等待用户选择发布或回退。
```

改为：

```markdown
> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 的「质量等级 / 各子标准分 / reworkHints」，等待用户选择放行或返工；阶段 8 终检跑 check-artifact-gate.ts，退出码 0 后展示 RTM 覆盖率与四级测试结果，等待用户选择发布或回退。
```

- [ ] **步骤 6：剪辑 M——成熟度指针并入适配节引言行（-1 非空行）**

删除「任务规模适配」节末行：

```markdown
成熟度分级细则见 [references/operational-recovery.md](references/operational-recovery.md)。
```

并将节首引言行末尾追加：`成熟度分级细则见 [references/operational-recovery.md](references/operational-recovery.md)。`（追加在 `（反模式 #10/#21）。` 之后，同一行。）

- [ ] **步骤 7：eval 断言锚点全保留核验**

运行：`npm run eval`
预期：exit 0，25/25（SKILL.md 断言锚点：`W 模型`/`CHECKPOINT · 项目初始化`/`/wm analyze`/`先询问`/`确认前不初始化`/`RTM`/`W-model`/`stage gates`/`不启用`/`前置产物`/`真实测试输出`/`CHECKPOINT · 阶段门放行`/`退出码`/`check-verifier-output.ts`/`R3`/`MAX_ROUNDS`/`opsx`/`codegraph`/`交叉校验`——上述剪辑均未删除这些子串；若 eval 失败，按失败断言定位并恢复对应文字后重跑）。

- [ ] **步骤 8：非空行数验收**

运行（PowerShell）：`((Get-Content w-model-dev/SKILL.md) | Where-Object { $_ -match '\S' }).Count`
预期：`< 100`（目标 99）。

- [ ] **步骤 9：docs-consistency 验证**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（「核心操作行为」「不可违反的约束」指针及 references-count 契约不受影响）。

- [ ] **步骤 10：Commit**

```powershell
git add -A; git commit -m "refactor(skill): compress SKILL.md 106 -> 99 non-empty lines (merge quick-check footer, workflow steps, trigger rows, checkpoint quotes)"
```

---

### 任务 5（批次 2d）：全门禁闭合 + 版本 42.2.0 + 验收记录

**Files:**
- Modify: 7 版本文件（version:bump）、`CHANGELOG.md`
- Create: `docs/changes/2026-09-01-42.2.0-usability-debt-acceptance.md`

- [ ] **步骤 1：全量门禁闭合（先跑门禁再改版本，避免半绿状态入 release commit）**

依次运行并记录真实退出码：

1. `npm run eval` → 预期 exit 0，25/25
2. `npm run self-test` → 预期 exit 0，262/262
3. `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → 预期 exit 0
4. `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` → 预期 exit 0，280 fixtures / unregistered=0
5. `npm run prepush`（Git Bash：`bash -c "npm run prepush"`；或 `bash .githooks/pre-push --force`）→ 预期 exit 0，17 项全绿

任何一项失败：定位 → 修复 → 重跑该项及其上游项；不得带红灯进入版本提交。

- [ ] **步骤 2：版本号升级**

运行：`npm run version:bump -- 42.2.0`
预期：exit 0，7 文件同步 + CHANGELOG 插入 `## [42.2.0] - <今日>` 节头。

- [ ] **步骤 3：填写 CHANGELOG 42.2.0 条目正文**

将占位行替换为（`<N>` 以步骤 4 实测为准填写）：

```markdown
### 优化（易用性清债：过期重定向 stub 移除 + SKILL.md 收敛）

- **移除 19 个 42.0.0 wave 合并遗留重定向 stub**（原承诺 42.1.0 移除，因证据支撑树集成顺延至本版）：TLA+ 5 文件 → tla-plus.md、BDD 4 文件 → bdd.md、anti-patterns → hard-constraints.md、dispatch-matrix → subagent-delegation.md、subagent-persona-matrix → agent-personas.md、conventions 三件套 → conventions.md、coding-quality 三件套 → coding-quality.md、definition-of-done → quick-self-check.md。活体引用 13 处先行重链（tools/README ×2、examples ×3、schemas ×8）；references 59 → 40 个 .md，SKILL.md 与 README 资源计数同步。
- **SKILL.md 收敛 106 → <N> 非空行**（批次 3 遗留目标 <100 达成）：快速自检节并入工作流尾注、执行工作流 12 步合并为 10 步、触发决策前两行合并、双 CHECKPOINT 引用合并、成熟度指针并入适配节——全部指针与 eval 断言锚点保留，`npm run eval` 25/25。
- 门禁闭合（真实退出码）：eval 25/25、self-test 262/262、docs-consistency、samples-coverage 280 fixtures、prepush 17 项全绿。
```

- [ ] **步骤 4：非空行终值复核**

运行：`((Get-Content w-model-dev/SKILL.md) | Where-Object { $_ -match '\S' }).Count`，将实测值回填步骤 3 的 `<N>`。

- [ ] **步骤 5：写验收记录**

创建 `docs/changes/2026-09-01-42.2.0-usability-debt-acceptance.md`：

```markdown
# 42.2.0 易用性清债验收记录

> 范围：19 个过期重定向 stub 移除 + 13 处活体引用重链 + SKILL.md 收敛 <100 非空行。设计见 docs/superpowers/specs/2026-09-01-w-model-dev-full-optimization-design.md §5。

## stub 承诺过期闭环说明

19 个 stub 的重定向注记写明「将于 42.1.0 移除」，42.1.0 版本号被证据支撑树集成（evidenceAnchor）使用，清债顺延至 42.2.0——本记录即该承诺的正式闭环。

## 变更清单

- 重链 13 处：tools/README ×2（tla-plus-guide→tla-plus）、examples ×3（dispatch-matrix→subagent-delegation）、schemas ×8（tla-manifest ×2 / code-tla-manifest ×3 / hill-climbing-report ×1 / iceberg-sweep ×2）。
- 删除 19 个 stub（2 行重定向文件，逐一确认后删除）；references 59 → 40。
- 不改项登记：coding-quality.md 合并史实注记、quick-self-check.md 外部出处、phase/templates 全部 glossary.md（模板子文件）、scripts 内 dispatch-matrix 节名引用（章节语义）、全部历史文档。
- SKILL.md 106 → <实测值> 非空行（7 处剪辑，见 commit）。

## 门禁矩阵（真实退出码）

| 命令 | 结果 |
|---|---|
| `npm run eval` | exit 0，25/25 |
| `npm run self-test` | exit 0，262/262 |
| `check-docs-consistency.ts` | exit 0 |
| `check-samples-coverage.ts` | exit 0，280 fixtures / unregistered=0 |
| `npm run prepush` | exit 0，17 项全绿 |

## commit 身份链

（按实际提交逐行登记：重链 commit / stub 删除 commit / SKILL.md 收敛 commit / release 42.2.0 commit。）
```

- [ ] **步骤 6：prepush 终验（含版本变更后的全量回归）**

运行：`npm run prepush`（Git Bash）
预期：exit 0，17 项全绿。

- [ ] **步骤 7：Commit**

```powershell
git add -A; git commit -m "release(42.2.0): usability debt cleanup (19 stubs removed, SKILL.md <100 lines, gates green)"
```

---

### 任务 6（批次 3a）：全门禁矩阵真实执行（体检）

**Files:**
- 无修改（只读体检，结果记入任务 8 验收记录）

- [ ] **步骤 1：执行门禁矩阵并记录**

依次运行，逐项记录真实退出码与关键汇总行：

| # | 命令 | 预期 |
|---|---|---|
| 1 | `npm run eval` | exit 0，25/25 |
| 2 | `npm run self-test` | exit 0，262/262 |
| 3 | `npm run doctor` | exit 0（依赖体检） |
| 4 | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | exit 0 |
| 5 | `npm run lint:security` | exit 0，新增发现 0 |
| 6 | `npx tsc -p config/tsconfig.json` | exit 0 |
| 7 | `npm run prepush`（Git Bash） | exit 0，17 项全绿 |

- [ ] **步骤 2：负载敏感 flake 观察点登记**

若步骤 1 任一项因 state-write-logic 锁测试 / R10 探针超时失败：隔离重跑该测试文件 3 次；隔离全绿 → 登记 P1 发现「负载敏感 flake 复现（环境容量）」+ 重跑证据；隔离仍红 → 按真实缺陷走修复流程。

---

### 任务 7（批次 3b）：静态审计（5 项新视角）

**Files:**
- 无修改（审计发现记入台账；修复在任务 8）

- [ ] **步骤 1：审计 A——L0 拷贝体验 + 全量死链检查**

```powershell
$tmp = Join-Path $env:TEMP "wm-l0-audit"; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item w-model-dev/SKILL.md, w-model-dev/skill-metadata.json -Destination $tmp
Copy-Item w-model-dev/references, w-model-dev/templates, w-model-dev/examples, w-model-dev/subagent, w-model-dev/schemas -Destination $tmp -Recurse
```

然后运行链接解析检查（临时脚本，不入库）：

```powershell
@'
const fs = require("fs"), path = require("path");
const root = process.argv[2];
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
})(root);
let n = 0; const bad = [];
for (const f of files) {
  const dir = path.dirname(f);
  const txt = fs.readFileSync(f, "utf8");
  for (const m of txt.matchAll(/\]\(([^)#\s]+?)(?:#[^)\s]*)?\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:)/.test(t)) continue;
    n++;
    if (!fs.existsSync(path.resolve(dir, t))) bad.push(f + " -> " + t);
  }
}
console.log("checked", n, "relative links in", files.length, "md files");
if (bad.length) { console.log("BROKEN:"); bad.forEach(b => console.log(" ", b)); process.exit(1); }
console.log("all resolve");
'@ | Set-Content -Encoding UTF8 "$env:TEMP\linkcheck.js"
node "$env:TEMP\linkcheck.js" $tmp
```

判据：`all resolve`（0 死链）。quickstart 路径人工走查：核对 quickstart.md 提及的命令/文件在 L0 拷贝中语义成立（L0 无 scripts/ 时步骤 2/3 的 npm 命令应仅适用 L1——核对 quickstart 已区分 L0/L1，未区分则登记 P2）。

- [ ] **步骤 2：审计 B——文档-脚本一致性**

```powershell
@'
const fs = require("fs"), path = require("path");
const cli = fs.readdirSync("w-model-dev/scripts/cli").filter(f => f.endsWith(".ts")).map(f => f.replace(/\.ts$/, ""));
const reg = fs.readFileSync("w-model-dev/references/subagent-delegation.md", "utf8");
const unregistered = cli.filter(c => !reg.includes(c));
console.log("cli scripts:", cli.length, "unregistered:", unregistered.length ? unregistered.join(",") : "none");
'@ | Set-Content -Encoding UTF8 "$env:TEMP\regcheck.js"
node "$env:TEMP\regcheck.js"
```

判据：`unregistered: none`。再人工比对 SKILL.md「命令速查」9 命令 vs command-reference.md 章节覆盖（每个 /wm 命令在 command-reference.md 有对应节）。

- [ ] **步骤 3：审计 C——示例新鲜度**

人工走查 `examples/`（README + stage1 + coding + test-execution + real-run-evidence）：核对角色名（O/S/V/G/R）、CHECKPOINT 形态、命令格式与 42.2.0 后 SKILL.md 一致；发现过时表述按 P2 登记。

- [ ] **步骤 4：审计 D——Schema 描述漂移**

```powershell
git grep -n -E "references/[a-z-]+\.md" -- w-model-dev/schemas
```

逐条核对引用的文件名在 `w-model-dev/references/` 存在（任务 2 已重链 8 处，此步兜底全量）。

- [ ] **步骤 5：审计 E——资源计数一致性**

```powershell
node -e "const fs=require('fs');const r=fs.readdirSync('w-model-dev/references').filter(f=>f.endsWith('.md')).length;const s=fs.readdirSync('w-model-dev/schemas').filter(f=>f.endsWith('.json')).length;const c=fs.readdirSync('w-model-dev/scripts/cli').filter(f=>f.endsWith('.ts')).length;console.log('references:',r,'schemas:',s,'cli:',c)"
```

核对 SKILL.md L132 声明值（40 个 .md / 23 份 schema / 37 个 .ts——cli 实测若为 37 则含全部；若 SKILL.md 声明与实测口径不同，按声明文字精确核对）与 README.md:192。

- [ ] **步骤 6：发现台账汇总**

按 P0（阻断使用/事实错误）/ P1（体验/可靠性降级）/ P2（打磨）/ P3（仅记录）分级登记全部发现（含定位/证据/建议处置），作为任务 8 输入。零发现时如实记录「审计 5 项零发现」。

---

### 任务 8（批次 3c）：发现修复 + 收尾

**Files:**
- 视发现而定
- Create: `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`（仅当有修复）

- [ ] **步骤 1：修复 P0-P2 发现**

逐项修复并重跑受影响门禁；每项修复独立 commit（`fix(...)`/`docs(...)` 按性质）。P3 项登记裁定理由留档，不修。

- [ ] **步骤 2：版本与 CHANGELOG（仅有修复时）**

有代码/资产修复 → `npm run version:bump -- 42.2.1` + 填写 CHANGELOG（修复清单 + 门禁终值）；仅登记无修复 → 跳过版本升级，审计报告并入 42.2.0 验收记录附录。

- [ ] **步骤 3：终验**

运行：`npm run prepush`（Git Bash）
预期：exit 0，17 项全绿。

- [ ] **步骤 4：验收记录**

创建 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`：门禁矩阵（任务 6 实测）、审计发现台账（任务 7 全量 + 分级 + 处置结果 + 修复 commit 身份）、终验结果。零发现时该记录改为「审计零发现报告」并入批次 2 记录附录，不新建文件。

- [ ] **步骤 5：Commit**

```powershell
git add -A; git commit -m "docs(changes): audit remediation acceptance record (or fold into 42.2.0 appendix if zero findings)"
```

---

## 自检记录（编写时执行）

- **规格覆盖度**：设计 §4（批次 1）→ 任务 1；§5.1 重链 → 任务 2 + 任务 3；§5.2 SKILL.md → 任务 4；§5.3/5.4 门禁闭合与版本 → 任务 5；§6.1 门禁矩阵 → 任务 6；§6.2 审计 5 项 → 任务 7 步骤 1-5；§6.3 分级处置 → 任务 7 步骤 6 + 任务 8；§6.5 flake 观察点 → 任务 6 步骤 2；§7 验证策略 → 各任务验证步骤；§8 YAGNI → 不改项登记于任务 2 步骤 4 与 42.2.0 验收记录。
- **占位符扫描**：所有编辑给出精确 before→after；CHANGELOG 的 `<N>` 与验收记录的 commit 身份链为「执行时以实测值回填」的显式动态字段（对应步骤已指定实测命令），非占位缺陷。
- **类型/锚点一致性**：eval 断言锚点清单在任务 4 步骤 7 逐一列出并核验保留；schema 重链的节号/节名（§2.0/§2.1/checkRounds/工具链/反模式节/格式约定）已实测存在于合并目标文件。
- **风险预判**：任务 3 删除前逐文件确认 2 行 stub（防误删实质文件）；任务 5 先门禁后版本（防半绿 release commit）；Windows prepush 一律 Git Bash。
