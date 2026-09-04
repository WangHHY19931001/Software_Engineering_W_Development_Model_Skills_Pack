# 留档项全量处理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 关闭 13 条留档项（最终审查 2 条 parked + 账本 11 条延后 Minor），逐项处置、零残留，版本保持 42.2.1。

**架构：** 三个任务对应规格三切片：S1 代码/测试（P2、D1、D2、D3、D4，触碰 `.ts`，先 codegraph 落盘）、S2 文档（P1、D5、D6、D7、D8、D9、D10）、S3 台账收尾（D11，最后一提交）。全部在 `.worktrees/archival-fixes`（分支 `task/archival-fixes`）由全新实现子代理完成；每任务 TDD/对照 + 独立 commit + 切片审查。

**技术栈：** TypeScript（tsx runtime）、Vitest（`config/vitest.config.ts`）、JSON Schema draft-07（ajv）、Markdown/JSON 台账。

**规格：** [2026-09-04-archival-fixes-design.md](../specs/2026-09-04-archival-fixes-design.md)（13 项处置的唯一权威清单）

**全局纪律（每个任务适用）：**
- 工作目录 = worktree 根（`D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\.worktrees\archival-fixes`，下文相对路径以它为基准；Windows + Git Bash）；`npm install` 已完成。
- 版本保持 42.2.1；`.superpowers/` 不提交；commit 只 add 被改 tracked 文件，绝不 add `.w-model/`。
- 退出码约定 0=通过/1=校验失败/2=输入错误；exit 2 向 stdout 输出 ERROR_JSON。
- 已知负载敏感 flake（受控 vitest 瞬态）：首次失败先隔离重跑，如实记录，不改检查器。
- 任务 3 是战役最后一提交：父链追加行覆盖任务 1/2 的全部 commit（40 字符 SHA、subject 逐字、按时间序），本追加提交自身不入链。

---

## 文件结构（本计划创建/修改的全部文件）

| 文件 | 职责 | 任务 |
|---|---|---|
| `w-model-dev/scripts/cli/check-openspec-archive.ts:59` | P2 注释年范围修正 | 1 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts`（`aggregateExternalChecks`） | D1 分支形态 + JSDoc | 1 |
| `w-model-dev/scripts/__tests__/artifact-gate-external.test.ts` | D1 分支用例 + E2/E4 断言更新 | 1 |
| `w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts` | D2 CLI 子进程 exit-2 用例 | 1 |
| `w-model-dev/scripts/cli/check-docs-consistency.ts:117` | D3 quotePath 前插 | 1 |
| `w-model-dev/scripts/lib/run-sync.ts` | D3 行号移位时同步 manifest（如有） | 1 |
| `w-model-dev/scripts/logic/l0-link-audit-logic.ts:67-71` | D4 注释补充 | 1 |
| `docs/skill-design-document_SSoT.md:1339` | P1 external 字段清单补 `provided` | 2 |
| `w-model-dev/references/command-reference.md`（Artifact Gate 节） | P1 同上 | 2 |
| `w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts:183` | D5 shortcut 形态 | 2 |
| `AGENTS.md:51` | D6 补 `--pretty=format:` | 2 |
| `w-model-dev/references/data-models.md:258` | D7 scope 注 | 2 |
| `w-model-dev/schemas/run-log.schema.json` | D8 标点统一 | 2 |
| `docs/user-guide.md:120` | D9 audit 句改写 | 2 |
| `CHANGELOG.md:32` | D10 措辞修正 | 2 |
| `CHANGELOG.md`、`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md` | D11 追加行 + 前注刷新 + 处置索引段 | 3 |

---

### 任务 1（S1）：代码/测试留档项 —— P2、D1、D2、D3、D4

**文件：** 见文件结构表任务 1 行（8 个候选，实际以改到为准）。

- [ ] **步骤 1：codegraph 查询落盘**

对本任务将修改的每个 `.ts` 做影响分析并落盘 `.w-model/codegraph-queries/phase5-archivalfix1-<symbol>.json`：字段 querySymbol / callers / callees / blastRadius / queryTimestamp（真实 ISO 时间）/ changeId="phase5-archivalfix1" / targetFiles（覆盖全部将改 .ts 文件）/ note（如实注明 unindexed fallback，可参照上一战役记录形态——若 `.worktrees/review-fixes` 已删，按 `codegraph-query.schema.json` 字段定义写）。此目录是本地证据，禁止提交。

- [ ] **步骤 2：写失败测试（D1）**

在 `artifact-gate-external.test.ts` 新增用例（复用该文件既有直调 `aggregateExternalChecks` 的模式）：scope 已提供但 Git 绑定失败（`scopeProvidedButFailed:true`、attempted changeId 已知）时，断言返回的 external summary：
- `provided === true`
- `changeId === <attempted changeId>`
- `passed === false`
`violationCount` 与 reasons 前缀按既有 `[scope]` 语义断言。
同时把既有 E2/E4 中对旧形态（`provided:false`/`changeId:null` 于 scopeProvidedButFailed 分支）的引用更新为新形态断言（先核对哪些用例实际走到该分支，只更新真正命中的）。

- [ ] **步骤 3：跑红（D1）**

运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts`
预期：新用例 FAIL（当前实现产出 `provided:false`/`changeId:null`），其余用例 PASS（E2/E4 更新后的断言要么与现实现一致、要么一并红——如实记录每个失败及原因）。

- [ ] **步骤 4：实现 D1**

`check-artifact-gate.ts` 的 `aggregateExternalChecks` scopeProvidedButFailed 分支：产出 `{ provided: true, changeId: <attempted>, violationCount: <n>, passed: false }`；`provided`/`changeId` 字段 JSDoc 补「provided=true 含提供后被 Git 绑定拒绝；changeId 为尝试绑定的 change」。保持 `scopeProvidedButFailed` 抑制「未提供 --scope」误导文案的行为不变。

- [ ] **步骤 5：跑绿（D1）+ 写并跑 D2 用例**

1. 步骤 3 命令全绿。
2. `check-codegraph-queries.test.ts` 的 `runCli` 下新增用例：spawn 真实 `npx tsx check-codegraph-queries.ts <repoRoot> --phase=5 --change=reviewfix --base=<sha> --head=<sha>`（薄封装 changeId 无 `phaseN-` 前缀），断言 exit 2 且 stdout 含 `"category":"ARG_INVALID"` 的 ERROR_JSON；对照用例用合法 `phase5-reviewfix` 走正常路径按需断言。若该用例对现实现即为绿（共享管道已 exit 2），如实记录「无红阶段：覆盖性断言」；若意外红，修正实现使其绿。

- [ ] **步骤 6：实现 D3（读码确认后单行 + manifest 同步）**

1. 读 `check-docs-consistency.ts:117` 所在函数确认 `git diff --name-only HEAD` 的实际调用形式，在其 git args 前插 `-c core.quotePath=false`（与 `change-scope.ts` I-1 同款）。
2. 读 `run-sync.ts` `SYNC_PROCESS_EXCEPTIONS` 是否注册该 execSync；若注册且行号因插入移位，同步 manifest 行号。
3. 无新断言（ASCII 仓库行为等同），docs-consistency 回归兜底。

- [ ] **步骤 7：实现 P2 与 D4（注释级）**

1. `check-openspec-archive.ts:59` 注释：`年 1-9999` → `年 100-9999（Date.UTC 对 0-99 年按 1900+ 处理，回读校验使 1-99 实际判非法）`。
2. `l0-link-audit-logic.ts` `parseRelativeLinks` 正则处注释新增句：`目标遇 ) 或空白即终止；与行内链接同属已知近似`。

- [ ] **步骤 8：定向回归 + 自审 + Commit**

定向：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts` 全绿；`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0（受控 vitest 瞬态按全局纪律处理）；`npm run self-test` 通过（262 基线）。
自审完整性（5 项全覆盖）/质量/纪律后：

```bash
git add w-model-dev/scripts
git commit -m "fix(scripts): close archival items (summary shape, CLI exit-2 coverage, quotePath in docs-consistency, comment precision)"
```

注意：**不提交 `.w-model/`**（gitignored 本地证据；请勿 `git add -f`）。

---

### 任务 2（S2）：文档留档项 —— P1、D5、D6、D7、D8、D9、D10

**文件：** 见文件结构表任务 2 行。

- [ ] **步骤 1：P1 补字段**：SSoT:1339（§10.5.2 GATE_JSON external 字段清单）与 command-reference.md（Artifact Gate 节同清单）各补 `provided: boolean`（若清单以代码块形式列出所有字段，同时核对 `changeId` 是否已含 `string | null` 联合；漏则一并补）。

- [ ] **步骤 2：D5**：`l0-link-audit-logic.test.ts:183` 附近 fixture 的用法行 `[empty][docs]` 改为 `[docs][]`（若注释说明该形态的意义，同步修正注释）；确认不改变断言语义（仅定义被采集、计数 1）。改后跑 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts` 全绿。若该测试文件含有注册于 run-sync 的 execSync 且单行替换不改变行数则无需动 manifest；若行数变化则同步。

- [ ] **步骤 3：D6**：`AGENTS.md:51` 的 remote 枚举命令补 `--pretty=format:`，与 README/CONTRIBUTING/INSTALL/troubleshooting/SSoT 五处逐字一致：`git log -m --name-only --pretty=format: <local_sha> --not --remotes=<remote>`（按 AGENTS.md 表格单元紧凑风格保留其余不变）。

- [ ] **步骤 4：D7**：`data-models.md:258` 已带 `--phase=<N>` 的迁移命令后补句：`阶段 5-8 另须 --scope=<change-scope.json>`。

- [ ] **步骤 5：D8**：`run-log.schema.json` 中 variant 与 blocker 两条追加说明句的结尾统一为全角「。」；改后以既有 schema 校验测试回归（跑 `w-model-dev/scripts/__tests__/schema-validation.test.ts` 全绿，确认 JSON 合法性不被破坏）。

- [ ] **步骤 6：D9**：`docs/user-guide.md:120` 旧 audit 句改写为与 README/AGENTS/CONTRIBUTING 三处同款句式：「网络瞬态错误（DNS 解析失败、连接被重置/拒绝、超时、HTTP 429/5xx、socket hang up 等）或 registry 不支持 audit endpoint 时自动跳过；漏洞报告、JSON 解析与权限错误仍然阻断」——按 user-guide 语气微调、语义逐字对齐 `.githooks/pre-push` 的实现。

- [ ] **步骤 7：D10**：`CHANGELOG.md:32` 「父链表现连续覆盖」→「父链表现已连续覆盖」。

- [ ] **步骤 8：验证 + Commit**

`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0；`npm run audit:l0-links` exit 0（649/92/36 不变）；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/schema-validation.test.ts` 与 l0 测试全绿；`grep -rn "网络不可达或 registry" docs/user-guide.md` 无残留旧句（docs/ 仅 user-guide 一处目标，README/AGENTS/CONTRIBUTING 已在上一战役改过——不要改回）。

```bash
git add -A w-model-dev docs AGENTS.md CHANGELOG.md   # 只含上述修改
git commit -m "docs: close archival docs items (GATE_JSON provided, l0 fixture form, AGENTS pretty-format, data-models scope note, run-log punctuation, user-guide audit wording, changelog typo)"
```

---

### 任务 3（S3）：台账收尾 —— D11（战役最后一提交）

**文件：** `CHANGELOG.md`、`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`。

- [ ] **步骤 1：追加任务 1/2 提交行**：`git log --first-parent --reverse --format='%H %s' 548e43a..HEAD`（应为任务 1/2 的 2 个提交 + 本任务将成的第 3 个不可预知——只追加**已存在**的祖先提交：任务 1、任务 2 的提交行）追加到两份台账父链表末尾，行式与既有完全一致：`| \`<40位小写SHA>\` | \`<subject 逐字>\` |`。

- [ ] **步骤 2：刷新前注与范围句**：两份台账「本轮提交身份」表前注与范围限定句按「父链现已连续覆盖至合并前 tip 的父提交（本追加提交自身按规则不入链）」的既成模板刷新（可参照上一战役 `docs(changes): restore parent-chain continuity...` 提交中的同款句）。

- [ ] **步骤 3：处置索引段**：在 CHANGELOG.md 42.2.1 域内补「### 留档项 13 项处置索引（archival-fixes，2026-09-04）」节：P1/P2/D1-D9/D10 已修复、D11 即本段，指向规格 `docs/superpowers/specs/2026-09-04-archival-fixes-design.md`（注意 CHANGELOG 位于仓库根，相对链接为 `docs/superpowers/specs/...`）。

- [ ] **步骤 4：链条校验**：脚本化逐对校验两份台账 SHA 序列满足「前一行 = 后一行 first-parent 父提交」、覆盖 `548e43a..HEAD-1` 全部 first-parent 提交、无 tip 自引用（本提交 SHA 不出现在台账）、subject 逐字与 `git log --format='%s'` 一致；输出留存到报告。

- [ ] **步骤 5：Commit**

```bash
git add CHANGELOG.md docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md
git commit -m "docs(changes): append archival-fixes ledger rows and refresh coverage note (close 13 filed items)"
```

---

## 收尾（任务 3 之后，控制者执行，非实现子代理）

1. 全量回归：vitest 全量、self-test、eval、typecheck、lint:security、docs-consistency、samples-coverage、audit:l0-links、doctor、`npm audit --audit-level=high`。
2. `npm run prepush`（Git Bash）17 项全绿；flake 只隔离 3× 重跑。
3. 独立审查（范围 `548e43a..task/archival-fixes tip`）：0 Critical / 0 Important；13 项处置逐条可追溯（D11 台账逐对校验）。审查 clean 后本地 fast-forward 合并 main、清理 worktree 与分支；不推送。
