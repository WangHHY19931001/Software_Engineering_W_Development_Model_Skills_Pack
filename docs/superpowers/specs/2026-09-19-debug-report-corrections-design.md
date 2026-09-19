# 调测报告订正 + 门禁诊断修复 + 可重放资产交付（设计）

> 日期：2026-09-19 · 状态：**待用户审查**
> 来源审计：[docs/debug/2026-09-19-wm-8phase-full-debug/](../../debug/2026-09-19-wm-8phase-full-debug/)（未跟踪审计产物，与先例一致：`docs/debug/` 不随提交交付）
> 复核会话：对同一工作区做了独立重放（重建后 119/119 exit 0 复现；未重建、现场残留 `eval/e2e/demo/.git` 时 114/119）

## 0. 用户既定裁定（2026-09-19）

| 项 | 裁定 |
| --- | --- |
| 范围 | **全量收口**：报告订正（P1–P9）+ 可重放资产入仓 + 技能包修复（S1/S2/F-1–F-4） |
| 交付 | 脚本入受跟踪位置 `eval/e2e/demo-assets/`；`docs/debug/` **不入库**（沿用先例）；完成后 commit 并 `push origin/main`（含既有 15 个未推提交） |
| 修法力度 | 逐项最低风险：S1/S2 改行为（诊断类）；F-1 改输出标签 + 文档语义注记；F-2 记入 schema description + `bdd.md`；F-3/F-4 补文档 |
| 执行顺序 | 方案 A：技能包修复 → 文档/schema → 资产交付 → 用交付资产重放 → 报告订正 → 全量验收 → 提交 + push |
| 三个默认值 | 新增第 9 个真探针（是）；`modelCheckChildTimeoutMs = 360_000`（是）；`logs/` 历史日志原样保留，只改断言文字（是） |

## 1. 成功标准（可验证）

- **AC1 报告可核对**：订正后报告内每处计数与归因，都能由仓库内一条可执行命令复核；P1 的「真实 TLC 拒绝」断言必须有新的原始日志锚点（不能再引用语义不符的探针）。
- **AC2 可重放**：`eval/e2e/demo-assets/` 在干净检出（只需 node / java / python）上可重建工作区并重放，得到与记录文件一致的计数；README 写明前置条件与已实测的坑。
- **AC3 红→绿**：S1/S2 的行为修改各带「改前失败、改后通过」的测试证据；测试文件数不增（用例内联，不新增 samples 夹具）。
- **AC4 活体文档不漂移**：`check-docs-consistency` 静态 0 违规（用 prepush 的第 15 项路径，不用自采集路径）。
- **AC5 终局验收**：`self-test` + `check-samples-coverage` + `check-pollution` + **全量 19 项 `npm run prepush`** 全绿（运行期间无并发写者），且 `coverage/` 无残留。
- **AC6 交付完成**：分主题提交（4 个提交）并 `push origin/main`。

## 2. 范围

**In scope**

1. 报告订正 P1–P9（`docs/debug/.../README.md` 与 `EVIDENCE_GRAPH.md`，文件仍为未跟踪，不进提交）。
2. 可重放资产：`eval/e2e/demo-assets/`（装配器 + 驱动 + 探针 + README）+ 记录文件 `eval/e2e/2026-09-19-8phase-debug-replay.md`（受跟踪）。
3. 技能包修复：S1（子进程超时与违例诊断）、S2（层次校验措辞区分 phase 过滤）、F-1（wm-status RTM 覆盖率标签与文档语义）、F-2（bdd `basePath` 解析基准文档化）、F-3/F-4（`bdd.md` 约定补齐）。
4. 活体文档同步：`docs/skill-design-document_SSoT.md`（§10.8 条目）、`w-model-dev/references/{tla-plus,bdd,command-reference,data-models}.md`、`w-model-dev/schemas/bdd-manifest.schema.json`、`CHANGELOG.md`。

**Out of scope（明确不做）**

- F-5「样本库无阶段 2-4 图谱正例」：经复核**该断言准确**（`self-test.ts` 的 11 个 `valid-*` 图谱正例全部 `phase: 1`），不改。
- `logs/` 下历史日志的任何内容（历史快照，只被引用不被改写）。
- `docs/debug/` 的入库。
- `EXEC_LIMITS` 既有 `sanyTimeoutMs` / `tlcTimeoutMs` 取值本身（只新增子进程级预算，不改工具级限额）。
- Mimosa 插件 317 项既有高危的对账（另立事项，沿用 2026-09-18 裁定）。

## 3. 报告订正设计（P1–P9）

### 3.1 P1：TLA 探针归因（重要）

**事实**：`logs/e2e/negative-probes.log` 中 `NP:tla-invariant-falsify` 的真实拦截原因是**层次校验**（`TLA_JSON.hierarchyViolations` 非空、`invariantViolations` 为空、`checkedSpecs=1`），TLC 未参与判定。根因：终态 `.w-model/tla-manifest.json` 是 p4 形态（L1 的 `children` 指向 L2），`checkTlaManifest` 按 `spec.phase <= phase` 过滤后只剩 L1，`children` 悬空即报「不在 manifest 中」（`w-model-dev/scripts/logic/tla-logic.ts:452`）。复核会话在**未做任何突变**的同一工作区上复现了同一报错，证明该拦截与「不变式伪造」无关。

**改法**（保留证据、补齐真证据）：

1. 原探针更名 `NP:tla-phase-mismatch`，如实标注：「拦截来自 phase 形态错配（后期 manifest 做前期校验，children 悬空），TLC 未参与」。
2. **新增** `NP:tla-invariant-tlc`（真 TLC 拒绝 + 自报伪造），变异与断言如下：
   - 前置：工作区处于 p4 TLA 形态（`.w-model/tla-manifest.json` 含 L1/L2，规格头与 `children` 双向一致，`tla/L1_counter.cfg` 与 `L2_counter_service.cfg` 均为 `INVARIANT TypeInvariant`）。
   - 变异 1（规格）：把 `tla/L2_counter_service.tla` 的 `Inc` 改为 `Inc == state = "zeroed" /\ state' = "broken"`（单字段变异，动作名 `Inc/Reset` 与 `Next` 结构不变，头/manifest/cfg 不受影响）。
   - 变异 2（自报伪造）：把 `.w-model/tla-manifest.json` 中 L2 spec 的 `syntaxChecked` / `tlcChecked` / `deadlockFree` / `invariantsHold` 全部置 `true`。
   - 期望：`npx tsx .../check-tla-model.ts .w-model/tla-manifest.json --phase=4` **exit 1**，且 `TLA_JSON.invariantViolations` 非空。
   - 依据（机制）：`w-model-dev/scripts/cli/check-tla-model.ts:442,449-451` 用真实 SANY/TLC 结果**覆写** manifest 的自报字段，纯逻辑（`tla-logic.ts` 步 3）再据此判定 → 声明式自报无法铸造绿灯。
   - 收尾：恢复两处文件并复验 `check-tla-model --phase=4` exit 0（回归复绿）。
3. 计数同步：探针 8 → **9**，`README.md` §一、§2.4 表（表头与新增行）、§四.1、`EVIDENCE_GRAPH.md` L2.6 与决策日志同步。

### 3.2 P2–P9：计数与措辞订正

| 项 | 位置 | 现状 | 改为（依据） |
| --- | --- | --- | --- |
| P2 | `README.md:15,16,54,89,102,140`；`EVIDENCE_GRAPH.md:54` | 「119 次门禁执行」「119 步…轨迹」 | 「119 次命令执行、全部 exit 0，其中 **89 次门禁脚本** + 29 次 wm-write + 1 次 wm-status」（依据：`grep -oE 'tsx [^ ]*/([A-Za-z0-9._-]+\.ts)' logs/e2e/trajectory.log \| sort \| uniq -c`） |
| P4 | `README.md:90`；`EVIDENCE_GRAPH.md:55` | 「32 次状态演化 / 32 次写入」 | 「29 次 wm-write 写入零失败」（依据：同上分类计数）；并补一句「`.bak` 按 `keepBackups=5` 每目标轮转，盘上现存 19 个」（依据：`lib/state-write-logic.ts:502` + `find` 计数） |
| P5 | `README.md:46` | 「48 条签名链」 | 「49 条签名链」（依据：`grep -c '"sigId"' .w-model/signature-chain.jsonl`） |
| P6 | `EVIDENCE_GRAPH.md:66`（L5.3） | 「突变定义写在探针脚本内」 | 改为「突变与期望由 `eval/e2e/demo-assets/run_negative_probes.sh` 定义（本轮交付）」——交付后该断言成立 |
| P7 | `README.md:38` | 「阶段 1（图谱/覆盖/BDD/Verifier）」 | 「阶段 1（图谱/覆盖/BDD）」+ 单独列出阶段 5 与 6-8 的 Verifier（依据：`logs/phase-trajectory.log` 阶段 1 仅 3 条命令）；同句「9 轮迭代」保留，但补注「迭代史仅阶段 1 的 5 条命令留档于 `logs/e2e/phase-1.log`」 |
| P8 | `EVIDENCE_GRAPH.md:64`（L5.1） | 「8 个日志文件」 | 「12 个日志文件（logs/ 7 + logs/e2e/ 5）」（依据：`ls logs logs/e2e`） |
| P9 | `README.md:117`（F-7） | 「工作区无残留」 | 「工作树无残留；该次误提交对象 `a5ed70eb` 仍可经 reflog 到达（内容为报告 4 个文件），未推送」（依据：`git reflog` + `git show --stat a5ed70eb`） |
| P3 | `README.md:15,92-103`（§五）；`EVIDENCE_GRAPH.md:53,64`（L4.1/L5.1） | 「可重放」🟢，重放步骤引用 gitignored 的脚本 | 重放步骤改指 `eval/e2e/demo-assets/README.md`（受跟踪）；B5 的可重放节点在资产入仓后维持 🟢，并写明已实测前置（另见 §4） |

> 说明：P3 与 P6 的「改为」以 §4 的资产交付为前提；两者在同一次变更里落地，避免出现「引用尚未存在的文件」的中间态。

## 4. 可重放资产交付设计（P3）

**目录**（受跟踪，新增）：

```
eval/e2e/demo-assets/
├── README.md                  # 前置条件、重建与重放步骤、已知坑、断言
├── build_workspace.py         # 由 eval/e2e/demo/build_workspace.py 迁移并改造
├── run_trajectory.sh          # 由 eval/e2e/demo/run_trajectory.sh 迁移并改造
└── run_negative_probes.sh     # 新增：9 项篡改探针（含 §3.1 的两项 TLA 探针）
```

**改造点**（迁移时必须完成，否则在新 clone 上不可用）：

1. 去绝对路径：`CLI` 与日志根改为 `REPO_ROOT="$(git rev-parse --show-toplevel)"`；日志路径参数化 `--log <path>`（缺省写入 `eval/e2e/demo/.replay/trajectory.log`，该目录在 gitignored 的 `eval/e2e/demo/` 内）。
2. `build_workspace.py` 的 `BASE_SHA`/`HEAD_SHA` 改为运行时取（`git -C "$REPO_ROOT" rev-parse`），不再硬编码 `67728b30`。
3. 工作区定位与 fail-closed：默认在 `eval/e2e/demo/` 重建；若该目录已存在 `git` 版本库则**直接以非零退出并打印处置指引**（提示该残留会让 p5–p8 的 `--scope` headRef 过期，实测只剩 114/119），不自动删除任何目录；仅当显式传 `--reset` 时才清空并重建（脚本内唯一的破坏性路径，需在 README 与 `--help` 两处声明）。
4. 断言内置：轨迹结束打印 `TOTAL_GATE_RUNS` 与 `NONZERO_EXIT_COUNT`，脚本内断言 `119` 与 `0`；探针脚本断言 9/9 期望拦截成立且恢复后复绿。
5. README 写明：Python 3（`build_workspace.py`）、Node + `npm install`、Java 17 + `w-model-dev/tools/tla2tools.jar`；重放耗时经验值；**禁止与其他 vitest / prepush 并发**（依据 closeout 账本 R-1：并发写者会触发 `exit2-failure-atomicity` 伪失败并争用 `coverage/`）。

**记录文件** `eval/e2e/2026-09-19-8phase-debug-replay.md`（受跟踪，沿用 `eval/e2e/*.md` 先例）：环境、命令、计数终值（含 9/9 探针）、与归档 `docs/debug/.../logs/e2e/trajectory.log` 的逐项对照、已知差异（`docs/debug` 为未跟踪目录，仅本机可读）。

`.gitignore` 无需改动：`eval/e2e/demo/` 是精确前缀规则，不匹配 `eval/e2e/demo-assets/`（实现时以 `git check-ignore -v eval/e2e/demo-assets/README.md` 为空证明）。

## 5. 技能包修复设计（S1/S2/F-1–F-4）

### 5.1 S1：artifact-gate 子进程超时与违例诊断

- **现状**：`w-model-dev/scripts/application/artifact-gate-assets.ts:539,561,574` 三处 `runSync(process.execPath, …, { stdio })` 未传 `timeout` → 落回 `DEFAULT_SYNC_TIMEOUT_MS = 15_000`（`lib/run-sync.ts`）。TLA 子进程要跑 Java SANY+TLC，负载下会超时被杀（`status=null`），违例消息退化为「退出码 unknown：」（复核会话实测）。
- **改法**：
  1. `lib/constants.ts` 的 `EXEC_LIMITS` 新增 `modelCheckChildTimeoutMs: 360_000`（= SANY 60s + TLC 300s + 余量），注释写明「子进程预算必须 ≥ 其内部工具级限额之和」。
  2. 三处 `runSync` 显式传 `timeout: EXEC_LIMITS.modelCheckChildTimeoutMs`。
  3. `appendProcessViolation` 的消息补足原因：`result.signal` 存在时输出「被信号 ${signal} 终止（很可能是执行超时）」，并保留退出码 `unknown` 之外的原始信息；`result` 缺失时保留「未返回进程结果」。
- **测试**（`w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts`，不新增文件）：沿用该文件既有的注入方式——文件头 `vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }))`（第 19 行），`runSync` 经 `spawnSync` 被拦截，用例直接调用 `runModelChecks`。红→绿对：
  1. **超时传递**：断言 TLA 子进程调用收到 `expect.objectContaining({ timeout: EXEC_LIMITS.modelCheckChildTimeoutMs })`——改动前该处为 `undefined`，用例必然失败（红），接线后通过（绿）。
  2. **超时诊断**：`spawnSyncMock.mockReturnValueOnce({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })` → 断言消息含 `SIGKILL` 与「超时」字样。
  3. 现有 `artifact-gate-assets.test.ts:676` 的 `退出码 unknown` 断言按新措辞更新（**预期变更**，提交信息中说明）。
- **同批定向测试**：`run-sync`（`__tests__/run-sync.test.ts` 断言同步子进程调用登记表，本次只给既有 `runSync` 调用点加 `timeout`，不新增直接调用，登记表应无需改动）与 `java-version`（`EXEC_LIMITS` 单源）一并跑，确认常量扩展无副作用。
- **SSoT-first**：`docs/skill-design-document_SSoT.md` §10.5 聚合门条目补一句「子进程预算与诊断要求」，再改资产。

### 5.2 S2：`checkHierarchy` 区分「被 phase 过滤掉的 child」

- **现状**：`logic/tla-logic.ts:452` 在 child 不在（已按 phase 过滤的）`specs` 中时报「不在 manifest 中」，把「该 child 属于后续阶段」误报为「manifest 未登记」。这正是 P1 误判的成因。
- **改法**（仅诊断措辞，不改判定结果）：
  1. `checkHierarchy(specs, options?)` 扩展可选入参 `filteredOutPaths: Set<string>`（由调用方 `checkTlaManifest` 用「全量 specs ∖ 已校验 specs」的 `tlaPath` 集合构造；现有调用方唯一——`logic/tla-logic.ts:943`——且缺省空集，既有调用零影响）。
  2. child/parent/sibling 三处「不在 manifest 中」分支，先判断是否命中 `filteredOutPaths`：命中则输出「属后续阶段（phase=N），当前校验 phase=M 不包含它」；未命中维持原文案。
  3. 判定结果（是否计入 `hierarchyViolations`）**保持不变**——仍是拦截，只让原因可读。
- **SSoT-first**：`docs/skill-design-document_SSoT.md:1502`（§10.8 层次一致性校验条目）补措辞约定；`w-model-dev/references/tla-plus.md` 同步。
- **测试**（`w-model-dev/scripts/__tests__/tla-logic.test.ts`，内联 fixture）：① 全量 manifest（L1 `children:[L2]`）+ `phase=1` → 报告含「属后续阶段」，不含「不在 manifest 中」；② 同名 child 指向真正未登记路径 → 仍报原文案。

### 5.3 F-1：wm-status 的 RTM 覆盖率口径（修订 r1：由「只改标签」升为「共用同一纯函数」）

**新增证据（2026-09-19 复核）**：`wm-status-logic.ts:131` 用 `r?.coverageStatus === '100%'` 计数；而 `rtm-guide.md:175` 明确「`coverageStatus` 仅用于展示，门禁脚本会从原始字段重算，不信任手工填写的状态」，`rtm.schema.json:80` 也只把 `coverageStatus` 描述为展示状态；权威行级规则在 `gate-logic.ts:1329`（`phaseFields = PHASE_TRACE_FIELDS[phase] ?? REQUIRED_TRACE_FIELDS`）与 `:1399-1420`（REQ 行按阶段字段、NFR/CON 行按 `description`(+`designDoc`,`codeModule`) 判定，`coveragePercent = 完整行/总行`）。实测后果：demo 的 4 行 `coverageStatus` 均为 `"完整"`（历史兼容值，`gate-logic.ts:1425` 注释确认该值不参与门禁一致性判定），wm-status 因字面量不匹配显示 **0/4（0%）**，而 artifact-gate 报 **100%**——显示的是**错数字**，不是两套合法口径。

**改法（修订后）**：

1. 从 `logic/gate-logic.ts` 抽取纯函数并导出：
   ```ts
   export function computeRtmTraceCoverage(
     rows: ReadonlyArray<Record<string, unknown>>,
     phase: number,
   ): { rowReasons: string[]; missingItems: Array<{ requirementId: string; fields: string[] }>; coveragePercent: number }
   ```
   规则**逐字保留**现有实现（行结构错误 reason、`isCrossCutting` 分支、`phaseFields`、`coveragePercent` 取整与 99 封顶），`checkArtifactGate` 改为调用它并按现有顺序 push `rowReasons` → `missingItems` 原因 → 覆盖率原因，**判定与 reasons 顺序不变**（既有 `artifact-gate-*.test.ts` + self-test 的 GATE_CASES 为安全网）。
2. `wm-status-logic.ts` 改调同一函数（`phase` 取 `STATUS_TO_PHASE[status]`），删除 `=== '100%'` 字面量比较；输出标签改为「RTM 覆盖率（按追溯字段重算）」（`cli/wm-status.ts:143`）。
3. 文档口径统一：`references/command-reference.md:234`（`/wm status` 输出规格，另注明 `percent` 与聚合门同源后为整数百分比）与 `:359`（`/wm init` 输出说明）、`references/data-models.md:242` 注明「wm-status 与 check-artifact-gate 同源（`computeRtmTraceCoverage`），`coverageStatus` 仅展示、不参与计算」——四处口径即本清单 `command-reference.md:234` / `:359` / `data-models.md:242` / SSoT §10.5 RTM 覆盖率口径注记。
4. 红→绿：`wm-status-logic` 测试新增两条用例——① 4 行齐全（含 `coverageStatus: '完整'`）→ `covered=4/percent=100`（改前为 0/0，红）；② `REQ` 行缺 `codeModule` → `covered=3/percent=75`；`gate-logic` 既有 RTM 用例必须全绿（证明抽取零行为变化）。
5. 不改 `rtmCoverage` JSON 字段名与结构。

> 偏离说明：用户裁定原文为「F-1 只改 wm-status 输出标签 + 文档写明两套语义（不动计算）」；本条修订把「标注两套语义」换成「消除第二套语义」。理由是新增证据显示差异源于 wm-status 信任展示字段，若只改标签则会把错数字保留下来。artifact-gate 判定不受影响。若用户不同意，回退方案为：仅改标签「（按 coverageStatus 展示字段统计）」+ 文档写明差异，不动计算。

### 5.4 F-2：bdd-manifest `basePath` 解析基准（修订 r2：由「基准不同」订正为「基准相同、兜底候选集不同」）

- **改法**：`w-model-dev/schemas/bdd-manifest.schema.json:28` 的 `basePath` description 增补两处消费方的解析差异；`w-model-dev/references/bdd.md` 增同款注记。
- **修订 r2（代码事实订正）**：本节初版（及计划任务 4 的初版文案）写「两处解析基准不同，`basePath: '..'` 两处语义不一致」——**该表述错误**。代码事实是：
  - 两处对 `basePath` 本身的锚点相同，均为 `resolve(projectDir, basePath)`：`w-model-dev/scripts/cli/check-bdd-model.ts:293-294`（`projectDir = resolve(manifestDir, '..')`，再 `resolve(projectDir, manifest.basePath)`）与 `w-model-dev/scripts/application/artifact-gate-assets.ts:327`（`bddBasePath = path.resolve(projectDir, typedManifest.basePath)`）。
  - 真正的差异在**首个候选 `<basePath>/<filePath>` 不存在时的兜底候选集**：`check-bdd-model.ts:165-170`（`resolveFeatureFile`）还依次尝试 `.w-model/<filePath>`、`.w-model/bdd/<filePath>`、`<projectDir>/<filePath>`；聚合门无兜底，`<basePath>/<filePath>` 不存在即报 `[artifact:bdd] feature file missing`（`artifact-gate-assets.ts:329-333`）。
  - 已落地的下游文档按此事实撰写：`w-model-dev/schemas/bdd-manifest.schema.json` 的 `basePath` description（「两处消费方对 basePath 本身的锚点相同…差异在兜底候选集」）与 `w-model-dev/references/bdd.md` 的 `basePath` 解析基准注记。
- 不改解析行为。

### 5.5 F-3 / F-4：`bdd.md` 约定补齐

- F-3：在 `w-model-dev/references/bdd.md:163` 附近补「D4 的 SM↔TLA spec 配对依赖隐式约定：`SM id 去掉 'SM-' 前缀 == spec.id`（如 `SM-L2_counter_service` ↔ `L2_counter_service`）」。
- F-4：在 `w-model-dev/references/bdd.md:269-294` 附近补「D6 事件提取取 When 行行末 ASCII 词，单 token 行（如 `When Inc`）静默不匹配并报成 end-state mismatch；When 行应写全 `事件 + 目标`」。
- 不改 D4/D6 实现。

## 6. 验收与交付

**步骤 0（前置门）**：`git commit --dry-run` 验证提交通路（Mimosa 插件曾强制拦截 commit）。若仍被拦：**停止并回报用户**，不绕过（沿用 2026-09-18 裁定）。

**执行序**（严格单写者，任一时刻只有本程序在跑测试）：

1. SSoT → 技能包资产 → 测试（红→绿）→ 定向 `npx vitest run --config config/vitest.config.ts artifact-gate-assets tla-logic`。
2. F-1–F-4 文档/schema 改动。
3. 资产迁移到 `eval/e2e/demo-assets/` + 新增探针脚本。
4. 用交付资产重建 + 重放：期望 `TOTAL_GATE_RUNS=119`、非零退出 0 条、探针 9/9；产出 `eval/e2e/2026-09-19-8phase-debug-replay.md`。
5. 报告订正 P1–P9（未跟踪，不提交）。
6. 终局验收：`npm run self-test`、`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`、`npx tsx w-model-dev/scripts/cli/check-pollution.ts`、**`npm run prepush`（19 项，唯一验收依据）**。
7. 提交拆分（4 个）：
   - `fix(artifact-gate): 子进程显式超时与超时诊断`（S1 + 测试）
   - `fix(tla-logic): 层次校验区分后续阶段 child`（S2 + 测试 + SSoT/references）
   - `docs(schema): bdd basePath 与 RTM 覆盖率口径注记`（F-1/F-2/F-3/F-4）
   - `feat(eval): e2e 可重放资产与重放记录 + CHANGELOG`（资产 + 记录 + CHANGELOG 条目，注明来源为未跟踪审计目录）
8. `git push origin main`（含既有 15 个提交）。

## 7. 风险与对策

| # | 风险 | 对策 |
| --- | --- | --- |
| R1 | 并发写者污染（伪失败 / `coverage/` 争用） | 单写者串行；prepush 前确认无外部测试运行；`check-pollution` 收尾 |
| R2 | Mimosa 提交门拦截 | 步骤 0 先验；被拦即停并回报 |
| R3 | S1 放宽子进程超时使门禁变慢或掩盖挂死 | 预算 360s 有限且 < 工具限额之和 + 余量；TLC/SANY 自身限额不变；消息显式标注超时 |
| R4 | 改措辞导致既有测试/文档漂移 | 全仓 grep 旧措辞（`退出码 unknown`、`不在 manifest 中`）；`docs-consistency` + 全量 vitest 兜底 |
| R5 | push 不可逆 | 已获用户裁定；推送前最后一次全量 prepush 必须绿 |

## 8. 决策记录（本轮新增）

| 决策 | 理由 |
| --- | --- |
| 报告订正走「保留原探针 + 新增真探针」而非删除 | 审计的价值在于如实分层证据；删掉错配证据会丢失「phase 形态错配本身就是拦截」这一事实 |
| F-1/F-2 只做标签与文档，不改行为 | 两者都是语义歧义而非判定错误；改行为会波及既有项目与消费者 |
| 资产放 `eval/e2e/demo-assets/` 而非 `docs/debug/` | 沿用「`docs/debug/` 不随提交交付」先例；`eval/` 已是评估资产与基线记录的受跟踪归属地 |
| S2 扩展 `checkHierarchy` 可选入参 | 缺省空集 → 既有调用方行为与测试零影响，符合「最低风险」 |
