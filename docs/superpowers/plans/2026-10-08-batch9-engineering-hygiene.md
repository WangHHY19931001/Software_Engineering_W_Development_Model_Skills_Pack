# 批次 9：工程化卫生（43.3.0）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 销账主规格 `2026-10-06-w-model-remediation-design.md` §8 全部十三项（D1-D8 工程化卫生 + A10/A16/A17/A18/A19 杂项修正）+ 批次 8 终审与非阻断候选 riders（5 条终审建议 + 账本 deferred 候选）。

**架构：** 机制级为主——CI 工作流新建、samples 期望减轨（双声明→同源）、checkRunLog 全拆分、project-root 统一、graph 性能四点位、CLI 分层例外下沉/登记、新自省检查；文档级为辅（版本 43.3.0 + CHANGELOG + decision-log 裁决登记 + 少数叙事 riders）。唯一涉及 persona 文件的改动是 Lighthouse 措辞定案（engineering-frontend-developer.md），**必须按批次 8 T18 教训跑 l0-link 审计或全量 vitest**。

**技术栈：** TypeScript + tsx、vitest 三 project、ajv draft-07、tla2tools（Java 17）、self-test、pre-push 19 项、GitHub Actions（ubuntu-latest / node 20）。

**规格：** 主规格 `2026-10-06-w-model-remediation-design.md` §8（十三项）+ 批次 8 终审建议 5 条（见下文 riders）+ 批次 8 账本 deferred 候选（含终审报告第三节逐条）。

**执行纪律（每任务适用）**：预期超 6 分钟的命令一律 run_in_background（全量 vitest ≈25 分钟）并轮询；前台只跑聚焦测试/self-test/typecheck/eval/grep/单次真机 TLC；不要跑 prepush（任务 17 除外）；每完成一个阶段往报告文件追加几行。**行号均为编写时点参考（HEAD=0ac83df9，37 个 SDD 工作区内核对），以内容定位为准。**

---

## 批次 8 → 批次 9 riders 来源（逐项注明）

| # | 来源 | 内容 | 落点任务 |
| --- | --- | --- | --- |
| R-B9-1 | 终审建议① | T2 Minor⑦ demo budget.json 无 `perPhase.maxSubagentSpawns`（R7 e2e 缺口）——补登记处置（接受或物化） | 16 |
| R-B9-2 | 终审建议② | CHANGELOG C17 措辞与 Lighthouse×2 候选并存张力——`engineering-frontend-developer.md:59/:161` 定案（改「性能得分」或正式判定领域术语保留） | 16 |
| R-B9-3 | 终审建议③ | deferred minors 显式化——decision-log 建立合并 registered-minor 清单（含去向列），防候选丢失 | 16 |
| R-B9-4 | 终审建议④ | 验证面教训固化——「改 subagent/references 散文须跑 l0-link 审计或全量 vitest」入 CONTRIBUTING（或 batch 计划模板） | 16 |
| R-B9-5 | 终审建议⑤ | 账本计数口径（main..HEAD 25 vs 42620669..HEAD 26）——并入 R-B9-3 清单说明 | 16 |
| R-B9-6 | 账本 | docs-consistency-logic 2 条 no-useless-escape + test 1 条 no-unused-vars 已被 baseline regenerate 吸收，属实义残留——顺手清实义 | 14 |
| R-B9-7 | 账本 | check-budget readJsonlOptional 微竞态（登记不修）——评估是否随 D4/D5 重构顺带收敛 | 6 |
| R-B9-8 | 账本 | SKILL.md 模型档位 20 处缺 / phase-1 表 6-7 措辞（T5 遗留）——本批叙事任务顺手清（若工作量爆则并入 R-B9-3 清单登记去向） | 16 |
| R-B9-9 | 账本 | CHANGELOG:58 测试计数快照陈旧（「需以当前命令输出为准」忌硬编码）——版本任务顺手核正 | 16 |
| R-B9-10 | 账本 | T15 探针矩阵 2 格未提交（TLA probe）——本批 D4 变更涉及 tla 面时顺手补或登记 | 6/16 |

---

## 文件结构（创建/修改的主要文件及职责）

| 文件 | 职责 | 任务 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | D1 CI 工作流（ubuntu-latest + node 20 + npm ci + prepush 可移植子集 + 不可移植项登记） | 2 |
| `.gitignore` | 补 `.tmp-*`（D2）；根目录 6 份报告 git mv 至 `.superpowers/sdd/` | 3 |
| `.superpowers/sdd/<根报告归属>/` | 6 份游离根报告（task-1-report.md / task-D8-*-report.md ×4 / progress.md）迁移落点（git mv 保历史） | 3 |
| `w-model-dev/scripts/samples/expectations/verifier.ts` (+测试) | D3 verifier 区共享期望表（self-test VERIFIER_CASES 与 vitest 同源消费） | 4 |
| `w-model-dev/scripts/samples/expectations/gate.ts` (+测试) | D3 gate 区共享期望表（GATE_CASES 与 vitest 同源消费） | 5 |
| `w-model-dev/scripts/cli/self-test.ts` | VERIFIER_CASES/GATE_CASES 改为消费共享期望表 | 4, 5 |
| `w-model-dev/scripts/__tests__/verifier-logic.test.ts`、`gate-logic.test.ts` 等 | vitest 侧改消费共享期望表（去双声明） | 4, 5 |
| `w-model-dev/scripts/logic/run-log-logic.ts` | D4 checkRunLog 按 R1/R2/R3/R4/R5/R9 六段拆函数（R6/7/8/10/11 已拆） | 6 |
| `w-model-dev/scripts/lib/project-root.ts` | D5 项目根解析统一（三调用点收敛，判据参数化） | 7 |
| `w-model-dev/scripts/cli/check-requirement-graph.ts`、`check-iceberg-sweep.ts`、`check-signature-chain.ts` | D5 三调用点改走 lib | 7 |
| `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts` | D6 CLI 分层例外登记（无现成登记机制则新增） | 8 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` + `logic/` | D6 gate-log 读取下沉 logic（经注入适配器，优先） | 8 |
| `w-model-dev/scripts/logic/graph-logic.ts` | A19 性能四点位（nodeMap precedes / DFS 迭代 / BFS 带头指针 / R15e 索引） | 9 |
| `w-model-dev/scripts/cli/code-health-phase1.ts` | A10 scopeHash 构造排序化（sortedJoin） | 10 |
| `w-model-dev/scripts/cli/wm-write.ts` + `logic/state-write-logic.ts` + SSoT | A16 `--expect-mtime` floor 比对口径挑明（错误信息提示传原始浮点 mtimeMs） | 11 |
| `w-model-dev/scripts/cli/check-run-log.ts` | A17 summary durationMs 移至非确定尾部字段（exitCode 后）+ D3 注释口径 | 12 |
| `w-model-dev/scripts/cli/check-docs-consistency.ts` | A18 shell:true 拼接引号转义（v2：含引号参数转义或去 shell 形态） | 13 |
| `.eslintsecurity-baseline.json` | D7 复审——测试侧 fs/object-injection 豁免能清则清，结论登记 decision-log | 14 |
| `w-model-dev/scripts/cli/check-docs-consistency.ts` + `logic/docs-consistency-logic.ts` | D8 新自省检查（含计数表述的活体文档须登记 REQUIRED_PATHS 或显式豁免表，漏登记即红） | 15 |
| `eval/README.md`、`w-model-dev/samples/README.md`、decision-log 等 | D8 扫描出的漏登记计数文档补登记 | 15 |
| 七处版本镜像（package.json / package-lock.json / skill-metadata.json / SKILL.md / README.md / INSTALL.md / CHANGELOG.md） | 版本 43.3.0 + CHANGELOG 节 + decision-log rounds-50 追加 + 叙事 riders | 16 |
| `CONTRIBUTING.md` | R-B9-4 验证面教训固化 | 16 |
| `w-model-dev/subagent/engineering-frontend-developer.md` | R-B9-2 Lighthouse×2 定案（**改后必跑 l0-link 审计或全量 vitest**） | 16 |

---

### 任务 1：基线验证

- [ ] **步骤 1**：在批次 8 合入后的 main（0ac83df9）上开分支：

```bash
cd "D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack" && git checkout main && git checkout -b fix/batch9-engineering-hygiene && git log --oneline -1
```

- [ ] **步骤 2**：`npm run --silent typecheck && npm run --silent self-test 2>&1 | tail -1 && npm run --silent eval && npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 预期全绿（typecheck 0 / 412 / 101 通过且覆盖矩阵通过 / 0 违规）。任一非绿停下修基线。
- [ ] **步骤 3**：初始化批 9 SDD 工作区 `.superpowers/sdd/2026-10-08-batch9-engineering-hygiene/`（progress.md + brief/report 落点）。

---

### 任务 2：D1——CI 工作流（.github/workflows/ci.yml）

**文件：** `.github/workflows/ci.yml`（新建）+ `.githooks/pre-push` 注释对照（不行政）。

- [ ] **步骤 1**：read `.githooks/pre-push` 19 项清单（行 38-70 Windows shell guard、541-543 cygpath、303 ensure-platform-deps --check 为不可移植/平台相关位点）。确认 `npm run prepush`（= `bash .githooks/pre-push --force`）在 Linux 上已含内部兼容层（guard 在纯 Windows 才生效、cygpath 在 Linux 天然 no-op）。
- [ ] **步骤 2**：建 `.github/workflows/ci.yml`：`on: [push, pull_request]`；job = ubuntu-latest + `actions/checkout@v4` + `actions/setup-node@v4`（node 20 + cache npm）；步骤 = `npm ci` → `npm run prepush`（作为 19 项门禁等价子集的主入口）→ 显式兜底 `npm run --silent self-test` + `npm run --silent eval`（prepush 已含，兜底冗余以利故障定位，注释写明）。
- [ ] **步骤 3**：workflow 注释 + 提交信息逐项登记不可移植项：① 纯 Windows shell guard（Linux 上自动 no-op 放行）；② cygpath 路径转换（Linux no-op）；③ Java/tla2tools（ubuntu-latest 预装，`java -version` 探针注释）；④ npm audit 网络依赖（CI 有网，正常）。每项给出「CI 侧替代或豁免理由」。
- [ ] **步骤 4**：本地验证（不可 push，见任务 17 处置）：YAML 语法校验（node `yaml` 或 python yaml 解析）→ `npm run prepush` 在本地已由任务 17 全量兜底；CI 首跑登记为「待用户推库触发的 parked 项」（R-B9-3 清单去向列）。
- [ ] **步骤 5**：`npm run --silent eval && npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → Commit `ci: 新建 GitHub Actions 工作流——prepush 可移植子集 + 不可移植项登记（D1，43.3.0）`

---

### 任务 3：D2——仓库卫生

**文件：** 根目录 6 份游离报告 + `.gitignore` + 两处 .tmp 残留。

- [ ] **步骤 1**：迁移 6 份根目录报告（`task-1-report.md`、`task-D8-r10-persona-review-sfix-report.md`、`task-D8-run-log-identity-sfix2-report.md`、`task-D8-run-log-identity3-sfix-report.md`、`task-D8-run-log-identity4-sfix-report.md`、`progress.md`）至 `.superpowers/sdd/<归属批>/`。先 read 各报告头部判断归属（可能属 42.13.x audit 收尾批）；无匹配既有工作区则新建 `.superpowers/sdd/2026-10-08-root-reports/` 并附 1 行 README 说明来源批。**用 `git mv` 保历史**；若目标目录已有同名文件先 `git mv` 加前缀（如 `task-1-root-report.md`）防覆盖。
- [ ] **步骤 2**：`.gitignore` 补 `.tmp-*`（注意顺序：在 `*.log` 之前、不破坏既有忽略覆盖）。
- [ ] **步骤 3**：删除 `.tmp-prepush-step1.log`（根目录，1829B）与 `.tmp-code-health-test-output/`（Oct 8 目录）；删前先确认无未归档内容（`ls -la` 目视，内容空或纯瞬态日志才删，否则改移入 `.w-model/` 并登记）。
- [ ] **步骤 4**：`git status --porcelain` 根目录应无杂项（除新分支产物外）；`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 绿 → Commit `chore: 仓库卫生——根报告入 SDD 工作区 + .gitignore 补 .tmp-*（D2，43.3.0）`

---

### 任务 4：D3 减轨 I——verifier 区期望单源化

**文件：** 新 `w-model-dev/scripts/samples/expectations/verifier.ts`（+ 单测）+ `cli/self-test.ts`（VERIFIER_CASES L186-385）+ `__tests__/verifier-logic.test.ts`（L87-100 复读 samples/verifier）+ 相关 vitest 负样本区。

- [ ] **步骤 1**：界定「期望数据」= 双声明重复对象（`{ file, expectedPassed, expectedReasonPatterns, description }` 清单 + verifier 侧 expectedReasonPatterns 正则表）。抽共享表模块：一个纯数据模块导出 `VERIFIER_EXPECTATIONS`（fixture 名 → 期望），self-test VERIFIER_CASES 由表派生（保留 per-case 附加的 CLI 专属字段），vitest 由同一表消费。
- [ ] **步骤 2**：先写测试（RED）：断言「共享表与当前 self-test CASES 一一对应」；再改 self-test 与 vitest 消费同源表。
- [ ] **步骤 3**：`check-samples-coverage.ts`（强制 fixture 均被 CASES 引用）保持绿；`samples/README.md` 覆盖矩阵（31 条）同步口径说明。
- [ ] **步骤 4**：聚焦测试 + self-test（后台+轮询）+ docs-consistency + eval → Commit `refactor(samples): verifier 期望表单源化——self-test 与 vitest 同源消费（D3-I，43.3.0）`

---

### 任务 5：D3 减轨 II——gate 区期望单源化

**文件：** 新 `w-model-dev/scripts/samples/expectations/gate.ts`（+ 单测）+ `cli/self-test.ts`（GATE_CASES L386-648）+ `__tests__/gate-logic.test.ts`（L15 起复读 samples/gate）+ `gate-report.test.ts`（L1039/1085/1149）+ `gate-test-evidence.test.ts`（L552/610）。

- [ ] **步骤 1**：同任务 4 模式抽 `GATE_EXPECTATIONS` 共享表（44 个 gate fixture + 组合目录形态）；注意 gate 区既有 `code-gate-parity.test.ts` 投影对账（gate↔code-tla），不得破坏。
- [ ] **步骤 2**：RED 先行（表↔CASES 对账断言）→ 改 self-test GATE_CASES 与 vitest 各消费点同源。
- [ ] **步骤 3**：`check-samples-coverage.ts` 绿（gate=30+16+8 覆盖矩阵口径同步说明）。
- [ ] **步骤 4**：聚焦测试 + self-test（后台+轮询）+ docs-consistency + eval → Commit `refactor(samples): gate 期望表单源化——self-test 与 vitest 同源消费（D3-II，43.3.0）`

---

### 任务 6：D4——checkRunLog 全拆分（R1/R2/R3/R4/R5/R9）

**文件：** `w-model-dev/scripts/logic/run-log-logic.ts`。

- [ ] **步骤 1**：read 现状——`checkRunLog` 主函数 927-1505，已拆出 R6/7/8/10/11（488-926，注释 L475-483「退化为编排器」）；剩余内联 R1 1012-1055 / R2 1057-1076 / R3 1078-~1339 / R4 1341-1350 / R5 1352-1383 / R9 ~1401-1436（跨轮次档差 REVIEW_LEVEL_SPREAD），外部段调用 1385-1442，return 1444-1504。
- [ ] **步骤 2**：按 R 规则族拆六段函数（命名对齐已拆函数风格：`check<Rule>…`）；**行为不变**——纯函数抽取 + IO 参数透传，禁止顺手改判据；R9 拆出时评估 R-B9-7（check-budget 微竞态）是否顺带收敛，不收敛则登记不回退。
- [ ] **步骤 3**：vitest 全量（后台+轮询，凭据=全量与拆分前逐位一致）+ self-test（后台）+ 聚焦。
- [ ] **步骤 4**：如需补单测（拆出函数直测），按既有权责补；docs-consistency + eval → Commit `refactor(run-log): checkRunLog 按 R1-R5/R9 规则族拆函数——行为不变（D4，43.3.0）`

---

### 任务 7：D5——项目根解析统一（lib/project-root.ts）

**文件：** 新 `w-model-dev/scripts/lib/project-root.ts` + `cli/check-requirement-graph.ts`（resolveAnchorBaseDir L96-112 + isProjectStateWModelDir L129-148）+ `cli/check-iceberg-sweep.ts`（resolveProjectRoot L149-160）+ `cli/check-signature-chain.ts`（findProjectRoot L121-138）。

- [ ] **步骤 1**：read 三处——判据互分叉：graph=8 层上溯 + `.git` 或 `.w-model/` 含≥1 常规文件（最严）；iceberg=8 层 + 裸 existsSync 二选一；signature-chain=5 层 + `.w-model/project.json` 唯一判据。
- [ ] **步骤 2**：抽 `lib/project-root.ts`：共享 8 层上溯 walk + **判据选项参数化**（`resolveProjectRoot(startDir, opts?: { requireProjectFile?: boolean; strictWModel?: boolean })`），三调用点以各自原判据等价映射（**行为保持**）；导出统一命名与 JSDoc 判据差异说明。
- [ ] **步骤 3**：裁决登记——三判据差异是否收敛为单判据（建议：默认收敛为 graph 最严判据 + signature-chain 保留 requireProjectFile，二者差分写入 decision-log R-B9 裁决段与 lib JSDoc）。
- [ ] **步骤 4**：改动调用点的聚焦测试 + dependency-boundaries 绿 + self-test（后台）+ docs-consistency + eval → Commit `refactor(lib): 项目根解析收敛 lib/project-root.ts（判据参数化，行为保持）（D5，43.3.0）`

---

### 任务 8：D6——CLI 分层例外下沉/登记

**文件：** `logic/`（新 gate-log 读取适配）+ `cli/check-artifact-gate.ts`（L326/351-355/384-387/502/538-539/574 I/O 位点）+ `__tests__/dependency-boundaries.test.ts`（ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS L47-70，强制测试 L301-330）。

- [ ] **步骤 1**：read dependency-boundaries 现状——现存表只覆盖 logic 直连 node:fs/path（10 条），**无 CLI 分层例外登记机制**（boundaryViolations L193-209 不查 cli 内嵌逻辑）。
- [ ] **步骤 2**：**优先**把 check-artifact-gate 的 gate-log（maturity.json / signature-chain.jsonl）读取下沉 logic——经注入 fs 适配器（L384-387 已注入适配器，沿此把 L326/351-355/502/538-539/574 读点迁入 logic 纯函数，CLI 只传路径 + 适配器）。
- [ ] **步骤 3**：其余 3 个 CLI 大文件（check-codegraph-queries.ts 694 行 / check-samples-coverage.ts 1110 行 / check-docs-consistency.ts 967 行）在例外登记表补登记（新增 CLI 例外登记节：文件 + 理由 + 期限），或对能低成本下沉的位点（check-docs-consistency.ts L604 的 runSync shell 调用若随 A18 顺带沉淀）一并登记。
- [ ] **步骤 4**：dependency-boundaries 聚焦测试 + 新增 caseness + self-test（后台）+ docs-consistency + eval → Commit `refactor(gate): check-artifact-gate gate-log 读取下沉 logic + CLI 例外登记（D6，43.3.0）`

---

### 任务 9：A19——graph 性能四点位

**文件：** `w-model-dev/scripts/logic/graph-logic.ts`（1349 行）。

- [ ] **步骤 1**：① nodeMap 复用——nodeMap 建 L556-557；`precedes` 分支 L957-958 用 `g.nodes.find((n) => n.id === e.from)`（O(P×V)）改 `nodeMap.get`。
- [ ] **步骤 2**：② 递归 DFS 改迭代栈——parent 环检测 dfs L218-231 与 detectCycle 内 dfs L833-847（显式栈）。
- [ ] **步骤 3**：③ BFS `queue.shift()` 改带头指针 index 队列——L529 连通分量、L643 可达集（O(n²)→O(n)）。
- [ ] **步骤 4**：④ R15e 签名链对账建索引——L384-392 `signatureChainEntries.some(...)` 逐节点全表扫描（O(N×M)）改预建 role=V/review 索引。
- [ ] **步骤 5**：行为不变（同输入同输出——添加等价性断言或回归用例：改造前/后对同一 graph fixture 输出一致）；vitest 全量（后台）+ 聚焦 + self-test（后台）→ Commit `perf(graph): nodeMap precedes + 迭代 DFS + BFS 头指针 + R15e 索引（A19，43.3.0）`

---

### 任务 10：A10——scopeHash 构造排序化

**文件：** `w-model-dev/scripts/cli/code-health-phase1.ts`（L218）+ `lib/code-health-evidence-store.ts`（L162-168 消费方）。

- [ ] **步骤 1**：现状 `sha256:${sha256Hex(`P1|${files.join(',')}|${symbols.join(',')}`)}`——两者 join 均未排序，同集合异序产生不同 hash → 假性 SCOPE_MISMATCH。
- [ ] **步骤 2**：引入 `sortedJoin`（join 前 `[...].sort()`）；消费方校验形态不变（`sha256:` 前缀）。
- [ ] **步骤 3**：补单测（同集合异序 → 同 hash）；code-health 相关聚焦测试 + self-test（后台）→ Commit `fix(code-health): scopeHash 构造 sortedJoin——同集合异序不再假性失配（A10，43.3.0）`

---

### 任务 11：A16——wm-write `--expect-mtime` 语义挑明

**文件：** `cli/wm-write.ts`（L101-114）+ `logic/state-write-logic.ts`（L579-589）+ `docs/skill-design-document_SSoT.md`（L1255）+ 相关引用文档。

- [ ] **步骤 1**：现状——解析 `Math.floor(parsed)`（L113）；比对 `Math.floor(stat.mtimeMs) !== Math.floor(opts.expectMtimeMs)` → MTIME_CONFLICT（L586）；SSoT 已写「接受有限非负数并向下取整」。不一致点=语义是 **floor 比对**，但错误信息/文档未提示调用方须传原始浮点 mtimeMs（传 `Math.round()` 整数必然 mismatch）。
- [ ] **步骤 2**：错误信息（MTIME_CONFLICT 的 message）补提示「须传 `stat.mtimeMs` 原始浮点值（勿 `Math.round`/截断），内部按 floor 比对」；SSoT L1255 与 command-reference 同步一句；wm-write `--help`/usage 文案同步。
- [ ] **步骤 3**：聚焦测试（floor 语义边界：浮点 123.9 vs 123 ◇ 断言比对口径）+ docs-consistency → Commit `fix(wm-write): --expect-mtime floor 比对口径挑明——提示传原始浮点 mtimeMs（A16，43.3.0）`

---

### 任务 12：A17——run-log 摘要 durationMs 移至非确定尾部字段

**文件：** `cli/check-run-log.ts`。

- [ ] **步骤 1**：现状——`durationMs = Date.now() - startTime`（L371）；summary 对象 L372-382 不含 durationMs；机器通道 `--json` 不携带 durationMs（L385-396 注释，D3 2026-09-18）；人类通道 L436-437 `printGateReport('RUN_LOG', { ...summary, durationMs }, exitCode)`——durationMs 在 `exitCode` **之前**。
- [ ] **步骤 2**：移至非确定**尾部**字段（`exitCode` 之后、`...summary` 展开后置尾），并在 D3 注释（L385-393）挑明口径：「durationMs 为非确定运行时字段，机器通道不携带；人类通道置于摘要尾部以保持确定字段序稳定」。
- [ ] **步骤 3**：run-log 聚焦测试（摘要形态断言）+ self-test（后台）→ Commit `fix(run-log): 人类摘要 durationMs 移至非确定尾部字段 + D3 注释口径（A17，43.3.0）`

---

### 任务 13：A18——shell:true 拼接引号转义

**文件：** `cli/check-docs-consistency.ts`（L596-607，L604 `shell: true`）。

- [ ] **步骤 1**：现状——`runSync(\`npx vitest ${vitestArgs.map((a) => (/[ "&=]/.test(a) ? '"' + a + '"' : a)).join(' ')}\`, [], {... shell: true})`：arg 含字面 `"` 时被 `"..."` 包裹但内层引号未转义。
- [ ] **步骤 2**：两案择一（优先 b）：(a) 对含引号参数做 `"` → `\"` 转义；(b) **去 shell 形态**——`process.execPath`（或 `npx` 解析后的 vitest bin 绝对路径）直接 spawn，参数数组透传（无拼接即无注入面）。选 (b) 时注意 vitest bin 定位（node_modules/.bin/vitest 或 vitest/package.json bin 解析）与 Windows 路径兼容。
- [ ] **步骤 3**：docs-consistency 聚焦测试（含引号参数用例）+ self-test（后台）+ docs-consistency 自检 → Commit `fix(docs-consistency): shell:true 拼接去 shell 化/引号转义（A18，43.3.0）`

---

### 任务 14：D7——security baseline 复审

**文件：** `.eslintsecurity-baseline.json`（294 条：detect-non-literal-fs-filename 159（生产 92/测试 67）、detect-object-injection 94（生产 77/测试 17）等）+ 对应源码。

- [ ] **步骤 1**：复审结论先登记——read baseline；对测试侧豁免（67 fs + 17 object-injection）逐条判定「能清则清」：能用 eslint-disable/局部 helper 消除的（如确定性 fixture 路径常量、注入路径安全的测试）实际清除；不能清的登记理由（避免批量无脑 disable）。
- [ ] **步骤 2**：生产侧按文件逐点复审重点区（state-write-logic.ts 22 条路径拼接豁免 L104-611、gate-logic、tla-logic、cli/*）——能收敛为常量/白名单路径的修复，否则保留并登记「复审通过理由」（动态路径有 schema/注入防护兜底）。
- [ ] **步骤 3**：清理 R-B9-6（docs-consistency-logic 2 条 no-useless-escape 实义残留 + test no-unused-vars 1 条）——顺手修实义后 `npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate` 重生成 baseline。
- [ ] **步骤 4**：`npm run lint:security` 绿（与重生成后 baseline 对齐）+ self-test（后台）+ 聚焦 → Commit `chore(security): baseline 复审——测试侧豁免可清则清 + no-useless-escape 实义清除（D7+R-B9-6，43.3.0）`

---

### 任务 15：D8——docs-consistency 计数文档自省

**文件：** `cli/check-docs-consistency.ts`（REQUIRED_PATHS L66-103，存在性检查 L664）+ `logic/docs-consistency-logic.ts`（GATE_COUNT_DOC_NAMES L2203-2207、EXPECTED 语义常量 L256+）+ 扫描出的漏登记文档。

- [ ] **步骤 1**：read 现状——REQUIRED_PATHS 只查「存在性」，无「含计数表述活体文档是否已登记」自省；GATE_COUNT_DOC_NAMES 仅 4 份（README/AGENTS/CONTRIBUTING/troubleshooting）；`eval/README.md`（计数滞后风险）、`w-model-dev/samples/README.md`（覆盖矩阵计数）、`docs/changes/decision-log/*` 等不在清单。
- [ ] **步骤 2**：新增自省检查——扫描全仓**被跟踪**活体 markdown（排除 docs/changes/archive、docs/superpowers 内部、CHANGELOG-archive、node_modules）中含计数表述的行（保守模式：`\b\d+\s*(项|条|个|处|类|份|款)\b` 或含「N/总数」形态），命中文档须在 REQUIRED_PATHS **或显式豁免表**（新增 `COUNT_CLAIM_EXEMPTIONS`：文档 + 豁免理由，仅限确认计数不漂移的文档）；漏登记即红（fail-closed），误报由豁免表精确消除。
- [ ] **步骤 3**：首跑扫描→把实际漏登记文档按「补入 REQUIRED_PATHS 或豁免表」处置；`eval/README.md` 计数句（60 vs 65 类滞后）与本批实际计数对齐。
- [ ] **步骤 4**：docs-consistency-logic 单测（自省新规则+豁免表）v + self-test（后台）+ docs-consistency → Commit `feat(docs-consistency): 计数表述活体文档登记自省——漏登记即红（D8，43.3.0）`

---

### 任务 16：版本 43.3.0 + CHANGELOG + decision-log + 叙事 riders

**文件：** 七处版本镜像 / `CHANGELOG.md`（新 43.3.0 节）/ `docs/changes/decision-log/rounds-50-*.md`（R-B9 追加 + registered-minor 清单）/ `CONTRIBUTING.md`（R-B9-4）/ `w-model-dev/subagent/engineering-frontend-developer.md`（R-B9-2）/ `w-model-dev/SKILL.md`（R-B9-8，若清）。

- [ ] **步骤 1**：`npm run version:bump 43.3.0`（`scripts/version-bump.cjs` 一处改版同步七处 + 插 CHANGELOG 节头）→ 核七处镜像 + 补充 CHANGELOG 43.3.0 节内容（Breaking/Changed/Fixed/验证记录占位——**按 R-B8-3：未测不写「全绿」，验证记录由任务 17 回填**）；CHANGELOG:58 测试计数快照顺手核正（R-B9-9）。
- [ ] **步骤 2**：decision-log rounds-50 追加 R-B9 裁决——D5 判据收敛裁决（任务 7 产出）、D7 baseline 复审结论（任务 14 产出）、A18 方案选择（任务 13 产出）、R-B9-1（demo R7 e2e 缺口处置：接受或物化）、R-B9-7（check-budget 微竞态）、R-B9-10（探针矩阵 2 格）；**deferred minors 合并清单建立（R-B9-3）**——从批次 8 账本 + 本批各任务 Minor 汇总成一张含去向列（修/登记不修/批 N 候选）的 tracked registered-minor 清单（去向列同时写入 R-B9-5 计数口径说明）。
- [ ] **步骤 3**：R-B9-4——CONTRIBUTING 增加验证面教训条目（「改 subagent/references 散文须跑 l0-link 审计或全量 vitest」，引用批次 8 T18 教训）。
- [ ] **步骤 4**：R-B9-2——`engineering-frontend-developer.md:59/:161` Lighthouse×2 定案：改「性能分数（Lighthouse）」等中性表述或正式判定领域术语保留（选一，裁决入 decision-log）；**改后必跑 `npm run audit:l0-links` 与 self-test 相关 R19 fixture hash 校验（T11 教训）**。
- [ ] **步骤 5**：R-B9-8——SKILL.md 模型档位 20 处缺失补全 + phase-1 表 6-7 措辞（工作量可控则清，超限则并入步骤 2 清单登记去向）。
- [ ] **步骤 6**：docs-consistency 绿 + eval 101/101 + self-test（后台）→ Commit `chore(release): 43.3.0——工程化卫生批次（D1-D8/A10/A16-A19 销账）`（验证记录待任务 17 回填）

---

### 任务 17：prepush + 专项复跑 + CI 首跑登记收口

- [ ] **步骤 1**：全量 prepush（`npm run prepush`，≈25-37 分钟，**run_in_background + 轮询**）。预期 19/19 绿。**先红后绿诚实性**：若某门禁失败，如实登记失败项与根因（不许只报终态），派 R 子代理根因定位 → V 复审 → S-fix，再全量复跑。
- [ ] **步骤 2**：专项复跑（任务相关）：`npm run audit:l0-links`（R-B9-2 改动面）、`npm run --silent eval`（101/101 + 覆盖矩阵）、`npm run --silent self-test`（412）、docs-consistency（0 违规）、D3 变异实验抽测（对共享期望表 1 条做个翻转突变 → self-test 对应用例必须转红 → 还原，输出 RED 证据，确认同源未削弱承重）、重复度抽区复测（verifier 区双声明归一后 grep 确认无第二份声明）。
- [ ] **步骤 3**：CI 首跑登记——不可 push（推库时机由用户决定），工作流已本地验证（语法 + 等价子集由 prepush 兜底）；在 CHANGELOG 验证记录与 rounds-50 登记「CI 首跑=待用户推库触发 GitHub Actions 的 parked 项（R-B9-3 清单去向列）」，不写「已首跑全绿」。
- [ ] **步骤 4**：CHANGELOG 43.3.0 验证记录回填（实测秒数 + 日期 + 单次）+ closeout 提交；账本销账 13/13 + riders 全处置；分支 tip 登记。

---

## 验收与销账

1. **主规格 §8 十三项**逐项 checklist：D1（CI 工作流 + 不可移植项登记）/ D2（根目录 git status 无杂项）/ D3（verifier 区双声明归一 + 变异抽测 RED 证据）/ D4（checkRunLog 全拆分，vitest 全绿凭据）/ D5（project-root 三调用点收敛 + 判据裁决登记）/ D6（gate-log 下沉 logic 或例外登记）/ A19（四点位，等价性凭据）/ A10（sortedJoin 单测）/ A16（口径挑明 + 边界测试）/ A17（尾部字段 + D3 注释）/ A18（去 shell 或转义）/ D7（复审结论登记 + 可清则清）/ D8（自省检查 + 漏登记补录）。
2. **prepush 19 项全绿**（任务 17 全量）；快速车道不得作为验收依据。
3. **CI 首跑**：登记为「待用户推库的 parked 项」（诚实口径，防静默遗留）。
4. **rider 全处置**：R-B9-1..10 逐条落位或入 registered-minor 清单（去向列）。
5. **版本 43.3.0** 七处镜像一致（docs-consistency version-consistency 强制）。
6. **无静默遗留**：所有发现 = 修复 / 登记不修（去向列）/ 明确 parked（含 CI 首跑）。

## 风险与回退

| 风险 | 缓解 |
| --- | --- |
| D3 共享期望表引入后测试意外放松 | 变异实验抽测（任务 17 步骤 2）复用既有变异点；check-samples-coverage 保持绿 |
| D4/D9 行为保持但重构引入回归 | vitest 全量（后台）为凭据；等价性断言（graph 改造前后 fixture 输出一致） |
| D5 三判据收敛改变运行期行为 | 判据参数化 + 行为保持；差异写入 decision-log 裁决 |
| D1 CI 无法在本地首跑 | 本地语法校验 + prepush 等价子集兜底 + 「待推库」parked 登记（诚实口径） |
| R-B9-2 改 persona 文件引发 R19 fixture hash / L0 链接漂移 | 必跑 l0-link 审计 + self-test R19 校验（批次 8 T11/T18 教训固化） |
| D8 自省扫描过噪 | 豁免表精确消除；保守模式起步，登记口径 |

---

> 执行入口：批 9 SDD 工作区 `.superpowers/sdd/2026-10-08-batch9-engineering-hygiene/`；每任务 brief 含 派单契约两段（前置条件=可自证命题；可验证终态=第三方可复核判据），返工走 R→V→G→S-fix 链。
