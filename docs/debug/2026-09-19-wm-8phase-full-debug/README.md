# W-Model 技能包 8 阶段全流程调测报告（2026-09-19）

> 调测对象：本仓库 `w-model-dev/`（W-Model Development Skill v42.2.1，L1 交付层）。
> 调测性质：**只读调测**——未修改技能包任何资产；调测产物为本报告目录 `docs/debug/2026-09-19-wm-8phase-full-debug/`（未跟踪，不随提交交付）与随仓交付的可重放资产 `eval/e2e/demo-assets/`（受跟踪）。
> 方法论：证据支撑树（evidence-anchored-decision-tree），证据树见 [EVIDENCE_GRAPH.md](./EVIDENCE_GRAPH.md)；每条结论均挂「命令 + 退出码 + 原始日志」锚点，可独立复核。
> 快照：会话快照 `67728b300673afb9364cb20726e8bbd375bbf4b2`（main，本轮日志产出点）/ 可重放基线 `952b6b0a29fbceb2cba2e30e1aeaa1267f519acb`（资产交付提交，含 `eval/e2e/demo-assets/`）· node v25.8.1 · Java 17 · Windows 10 (win32)。

## 一、总结论（TL;DR）

**技能包 8 阶段全流程在本轮调测中有效且可靠**：

| 维度 | 结论 | 关键证据 |
|---|---|---|
| 有效性 | 成立 | self-test 358/358 ×2；pre-push 19 项全绿（exit 0）；真实 SANY/TLC 工具链 1 正例 ×2 + 3 负例全部按设计判定；9 项篡改探针全部 exit 1（探针脚本 `eval/e2e/demo-assets/run_negative_probes.sh` 随仓交付） |
| 可靠性 | 成立 | 同输入重复运行退出码与输出逐字节一致（review-package / doctor --json / self-test / samples-coverage）；**119 次命令执行**（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status）的 8 阶段轨迹终态全绿且可重放 |
| 端到端 | 成立（scaled） | counter-api 最小项目（2 REQ + 1 NFR + 1 CON + 2 TLA+ + 2 BDD + 4 级 9 测试）走完阶段 1→8 全门禁链，**119 次命令执行（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status）全部 exit 0**，状态经 wm-write 原子演化至「项目完成 8/8」 |
| 防伪 | 成立（额外发现） | 证据溯源链两级 fail-closed（无 git 上下文 → `MISSING_GIT_HEAD`；合成绿色状态 → `GATE_NOT_PASSED`）——手工拼装的绿色 run-log 无法铸造 source provenance |

调测发现 7 项（无阻断级；2 项低危观察 + 4 项文档/易用性建议 + 1 项调测事故登记），见 §六。

## 二、调测范围与执行轨迹

### 2.1 静态基线（仓库级）

| # | 项目 | 命令 | 退出码 | 日志 |
|---|---|---|---|---|
| 1 | 环境自检 | `npm run doctor` | 0（0 阻断 / 2 提示） | 会话记录（codegraph/openspec 可选项缺失，登记为边界 B-L1.4） |
| 2 | 回归基线 第 1 轮 | `npm run self-test` | 0（358/358） | logs/self-test-run1.txt |
| 3 | 回归基线 第 2 轮 | `npm run self-test` | 0（358/358，用例行与第 1 轮 diff 为空） | logs/self-test-run2.txt |
| 4 | 19 项本地 CI | `npm run prepush` | 0（19/19：self-test、门禁退出码、全量 vitest、规则层覆盖、security-scan、样本矩阵、prettier、tsc、eval 断言等） | logs/prepush.txt |
| 5 | 样本覆盖矩阵 ×2 | `npx tsx …/check-samples-coverage.ts` | 0 ×2，输出稳定；**48 个 exit-2 负向探针串行真实执行，0 失败** | logs/determinism.log |
| 6 | 真实 SANY/TLC | `check-tla-model.ts`（tla-e2e 夹具） | 正例 exit 0 ×2（连跑稳定）；死锁 / 不变式违反 / 语法错误 3 负例全部 exit 1 | logs/tla-e2e.log |
| 7 | 确定性 | `review-package.ts` 同输入 ×2 → sha256 全等 `d5fd8e75…`；`doctor.ts --json` ×2 → sha256 全等 `ded43763…` | — | logs/determinism.log |

### 2.2 免装配阶段轨迹（夹具驱动）

按 README「W 模型 8 阶段 × 门禁对应」表以有效夹具直接执行 CLI（logs/phase-trajectory.log）：
阶段 1（图谱/覆盖/BDD；Verifier 见阶段 5 与 6-8 两节）、阶段 5（Verifier/状态机一致性）、阶段 6-8（Verifier 门）全部 exit 0；装配迭代史仅阶段 1 的 6 条命令（4 个脚本，`grep -cE '^\$ ' logs/e2e/phase-1.log`=6）留档于 `logs/e2e/phase-1.log`。
**过程中产生的真实拦截**（同为有效性证据）：以阶段 1 形态图谱跑 `--phase=2` → exit 1（死模块 ×6 + 缺 EXT-IN/EXT-OUT + 边数/语义占比警告）；`--phase=2` 的 BDD 缺 `--graph` → exit 2（ARG_INVALID，P0-1）。
五闭环脚本 + 签名链在样本上基线：budget / run-log / maturity / signature-chain exit 0；checkpoint 与 role-dispatch 在逻辑层夹具上 exit 1（R4 阶段主题词、约束 #8 的 V/R3 缺失被强制）——见 logs/closure-baseline.log。

### 2.3 端到端技能使用测试（scaled e2e，核心轨迹）

工作区：`eval/e2e/demo/`（gitignored 瞬态区，自建 git edc0216）· 项目 counter-api · 成熟度 L2（TLA+ L1/L2 + BDD L1/L2 必跑形态）。

**产物**（装配器 `build_workspace.py` 生成，S 角色动作模拟）：冻结 SPEC（2 REQ + 1 NFR + 1 CON）、逐阶段演化图谱（p1 纯 REQ 多 group → p4 全图 9 节点 19 边）、TLA+ L1/L2（真实可执行，`Inc/Reset` 命名动作 + `BusinessInvariant`）、BDD L1/L2 features（与 TLA 命名动作同步）、真实四级测试（node:test，UT 3 + IT 2 + ST 2 + UAT 2，**真实运行全部 exit 0**，logs/e2e/real-tests.log）、RTM（真实命令+退出码+时间戳证据）、104 行 run-log（每阶段 S/V/G + R3×3 + 闭环五脚本 + CHECKPOINT，阶段 8 含身份五字段）、49 条签名链（sha256 逐条重算通过）、8×3 预防性审查、8 份 V 评审输出、cucumber 执行证据、阶段 5-8 变更上下文（change-scope + codegraph 查询 + opsx 制品 ×4）。

**轨迹**（驱动脚本 `run_trajectory.sh`，O 角色动作模拟；状态一律经 `wm-write` 锁+备份+原子写）：

- 每阶段：换装该阶段图谱/TLA/BDD 形态 → wm-write project 状态 → 阶段门禁（图谱 / TLA 真实 SANY+TLC / BDD 含 TLA 等价 / Verifier / artifact-gate）→ 闭环五脚本 + role-dispatch + signature-chain；
- 阶段 8：artifact-gate 终检（--phase=8 --scope=…）+ archive-integrity；
- 收尾：wm-write「项目完成」+ `wm-status` 快照（8/8 100%，四级测试 9/9，logs/e2e/wm-status-final.txt）。

**终态：119 次命令执行（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status），全部 exit 0**（logs/e2e/trajectory.log，含每条命令全文与尾部输出）。

**装配调测史（如实记录）**：从首跑 30/107 绿到 119/119 绿共 9 轮迭代，每轮拦截均为真实规则生效（schema 闭包、R15e 签名链对账、TLA 文件头↔manifest 双向一致、cfg↔BusinessInvariant 展开、D4/D6/sync 三方事件形态、scope↔git 实际差异精确绑定等），修复仅改 demo 产物、不改技能包。

### 2.4 负向篡改探针（门禁牙齿验证）

在绿色终态上做最小突变、验证后恢复（首轮 logs/e2e/negative-probes.log，8/8 全部 exit 1；本轮交付脚本重跑 logs/e2e/negative-probes-rerun.log，9/9 全部 exit 1，其后恢复复验 signature-chain / run-log exit 0）。探针已交付为 `eval/e2e/demo-assets/run_negative_probes.sh`（受跟踪，突变与期望命中词写死在脚本内）：

| 突变 | 被拦截于 | 证据（日志） |
|---|---|---|
| 签名链第 6 条 sigHash 置零 | check-signature-chain R6 篡改检测 | logs/e2e/negative-probes.log |
| 删除阶段 1 闭环 budget 记录 | check-run-log R11 闭环五脚本 | logs/e2e/negative-probes.log |
| 后期 manifest 做前期校验（`--phase=1` + p4 形态 manifest） | check-tla-model 层次校验（child 属后续阶段，TLC 未参与） | logs/e2e/negative-probes.log（首轮 `tla-invariant-falsify` 探针实为此形态） |
| TLA 不变式真实违反 + manifest 自报字段伪造为 true | check-tla-model 真实 TLC 复核（`invariantViolations` 非空） | logs/e2e/negative-probes-rerun.log |
| 删除 DD-001→EXT-OUT 信息流 | check-requirement-graph 黑洞 | logs/e2e/negative-probes.log |
| Verifier 单轴 0.93→0.5 | check-verifier-output R13 单轴下限 | logs/e2e/negative-probes.log |
| REQ-001 codeModule 置空 | check-artifact-gate RTM 追溯 | logs/e2e/negative-probes.log |
| CHECKPOINT 决策改泛化短句 | check-checkpoint R2 具体名词 | logs/e2e/negative-probes.log |
| cucumber 步骤改 failed | check-bdd-model D5 执行证据 | logs/e2e/negative-probes.log |

恢复后回归：signature-chain / run-log / artifact-gate 终检均复绿 exit 0（logs/determinism.log「修正复验」；本轮重跑的恢复复验 signature-chain / run-log exit 0 见 logs/e2e/negative-probes-rerun.log）。

### 2.5 证据溯源链（导出边界验证）

`wm-verify-evidence-source` 在 demo 上两级 fail-closed：无 git 上下文 → `MISSING_GIT_HEAD`；自建 git + 合成绿色状态 → `GATE_NOT_PASSED`（要求 gate-logs 真实测量文件与 run-log gateLogPath 交叉对账）。**正向导出不在 scaled e2e 范围**（需真实会话逐 gate 产出的测量文件），登记为边界——防伪属性本身得到验证。

## 三、有效性分析（B2 证据树）

1. **判定正确性**：358 条正/负夹具（self-test）+ 48 个 exit-2 串行探针（samples-coverage）+ 9 项篡改探针 + 真实 TLC 3 负例——所有设计为「应拒绝」的输入都被拒绝（exit 1/2），所有「应通过」的输入都通过（exit 0）。
2. **判定独立性**：artifact-gate 终检聚合 codegraph/opsx strict（`--scope` fail-closed）；scope 与 git 实际差异**精确相等**才放行（demo 曾因 changedFiles 与 git diff 不一致被拒，修正后放行）——门禁不接受声明式自报。
3. **跨产物一致性**：TLA 文件头 ↔ manifest、cfg ↔ BusinessInvariant 展开、BDD SM ↔ TLA 命名动作、图谱 SD/INTF/DD 追溯边方向、R15e confirmed ↔ 签名链 V 环——五类跨文件一致性约束全部在装配迭代中真实拦截过至少一次。

## 四、可靠性分析（B3 证据树）

1. **重复运行确定性**：self-test ×2 用例行 diff 为空；review-package 同输入两份产物 sha256 相等；doctor --json 两份 sha256 相等；samples-coverage 两轮输出稳定。
2. **真实工具链稳定性**：TLC 模型检查连跑 2 次零违反；四级 node:test 真实执行稳定通过。
3. **退出码契约**：`0=通过 / 1=校验失败 / 2=输入错误` 在全部 119（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status）+ 48 + 9 + 19 次执行中无一例外；exit 2 均携带结构化 `ERROR_JSON`（category/exitCode/rule）。
4. **状态写入可靠性**：wm-write 的锁 + 毫秒+UUID 备份 + 原子写在 29 次阶段状态演化中零失败（`.bak` 按 `keepBackups=5` 每目标轮转，盘上现存 19 个；`logic/state-write-logic.ts:502`）。

## 五、可复核指南（B5）

重放需 HEAD ≥ `952b6b0a`（资产交付提交）；头部快照 `67728b30` 尚无 `eval/e2e/demo-assets/`（该提交下 `eval/e2e/` 仅两份 2026-08-28 记录）。从仓库根：

```bash
npm install && npm run doctor && npm run self-test && npm run prepush   # §2.1 静态基线重放
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts               # 48 负向探针串行重放
( cd w-model-dev/scripts/samples/tla-e2e && npx tsx ../../cli/check-tla-model.ts tla-manifest-counter-pass.json )   # 真实 TLC
# e2e 轨迹重放（资产受跟踪；工作区为 gitignored 瞬态目录）：
( cd eval/e2e/demo-assets && python build_workspace.py --reset && bash run_trajectory.sh )   # 期望 119/119
bash eval/e2e/demo-assets/run_negative_probes.sh                                             # 期望 9/9（须在上一步重建的工作区上跑）
# 计数复算（本报告 logs/ 与重放后的工作区）：
grep -oE 'cli/[a-z0-9-]+\.ts' docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/trajectory.log | sort | uniq -c
#   → 89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status = 119
wc -l eval/e2e/demo/.w-model/signature-chain.jsonl                                       # 49 条签名链
find eval/e2e/demo/.w-model -name '*.bak.*' | wc -l                                      # 19 个 .bak（keepBackups=5 每目标轮转）
grep -cE '^\$ ' docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/phase-1.log          # 6 条阶段 1 迭代命令
```

`eval/e2e/demo-assets/README.md` 记录了两个实测坑：工作区不得残留 `.git`（会让 `--scope` 的 headRef 绑到 demo 自身 HEAD，实测只剩 114/119）、重放期间禁止并发写者（`exit2-failure-atomicity` 对并发写盘敏感，会争用 `coverage/` 产生伪失败）。

原始日志索引：`logs/`（静态基线 + 确定性）、`logs/e2e/`（轨迹 + 探针 + 状态快照）。每条日志含命令行、输出尾部与 `EXIT_CODE=` 行。

## 六、调测发现（按严重度）

| # | 级别 | 发现 | 证据 | 建议 |
|---|---|---|---|---|
| F-1 | 低（观察） | `wm-status` 的 rtmCoverage（按 coverageStatus 字段，显示 0%）与 `check-artifact-gate` 的 coveragePercent（按行列完整性，判 100%）口径不一致 | logs/e2e/wm-status-final.txt vs trajectory.log p8 终检 | 统一口径或在两处输出注明语义 |
| F-2 | 低（观察） | bdd-manifest `basePath` 两处锚点**相同**（均为 `resolve(projectDir, basePath)`：`cli/check-bdd-model.ts:294` vs `application/artifact-gate-assets.ts:242,327`），差异在**兜底候选集**——check-bdd-model 首个候选不存在时还会依次尝试 `.w-model/<filePath>`、`.w-model/bdd/<filePath>`、`<projectDir>/<filePath>`（`cli/check-bdd-model.ts:165-178`），check-artifact-gate 无兜底（直接报 `[artifact:bdd] feature file missing`，`application/artifact-gate-assets.ts:333`）；故同一 `basePath='..'` 一处能回退命中、一处不能 | 代码锚点见左列（`grep -n basePath w-model-dev/scripts/cli/check-bdd-model.ts` 可复核）；装配迭代第 5 轮 `[artifact:bdd] feature file missing`（会话记录，未随 logs/ 归档） | 已在 `bdd-manifest.schema.json` 的 `basePath` description 与 `references/bdd.md` 注明（2026-09-19） |
| F-3 | 文档 | D4 的 SM↔TLA spec 配对依赖隐式约定 `SM id 去 'SM-' 前缀 == spec.id`（`SM-L2_counter_service` ↔ `L2_counter_service`） | 装配迭代第 8 轮 `[D4] no TLA+ snapshot`（会话记录，未随 logs/ 归档；本轮未复现） | 在 bdd.md 语法速查注明命名约定 |
| F-4 | 文档 | D6 事件名必须落在 `When`/`And` 行**行末**且为 ASCII 词（可带 `)`），完整式 `^\s*(?:When\|And)\s+.+?\b(\w+)\s*\)?\s*$`（`logic/bdd-logic.ts:358`）：行末为 CJK 的 `When Inc 计数器自增`、单 token `When Inc` 都静默取不到事件，报成 end-state mismatch 而非「无事件」 | 装配迭代第 7 轮；`node -e` 正则自证：`When 计数器自增 (Inc)` → `Inc`，`When Inc 计数器自增` → 无匹配（命令见 §6.1） | 已在 `references/bdd.md` 注明（2026-09-19），可用示例 `When 计数器自增 (Inc)`；可选：D6 对零事件 scenario 报显式原因 |
| F-5 | 边界登记 | 样本库无阶段 2-4 图谱**正例**（仅负例）；正例验证依赖真实装配项目 | §2.2 | 可选：补 3 份阶段形态正例夹具 |
| F-6 | 边界登记 | 证据导出正向链需真实会话逐 gate 测量文件（gate-logs + run-log gateLogPath 对账），scaled 合成状态被正确拒绝（防伪属性 ✅，正向路径未演练 ⚠️） | logs/determinism.log §导出链 | 后续用真实 /wm 会话补一次正向导出演练 |
| F-7 | 事故登记 | 调测中误在**仓库根**执行 `git init/add/commit`（a5ed70eb，触发仓库 pre-commit 快检），已即时 `git reset` 撤销，HEAD 复位 67728b30；工作树无残留，误提交对象 `a5ed70eb` 仍可经 reflog 到达（内容为报告 4 个文件），未推送 | `git reflog --all`（`a5ed70eb refs/heads/main@{15}`）+ `git show --stat a5ed70eb`（报告 4 个文件 / 937 insertions） | 嵌套工作区操作前先 `pwd` 核验；该事故同时印证 pre-commit 钩子在嵌套 init 场景被外层仓库接管 |

### 6.1 订正记录（2026-09-19 复核）

本轮独立复核发现本报告**自身**两处表述失准，均已按代码事实订正：(1) **F-2** 把「兜底候选集不同」误述为「解析基准不同」——两处对 `basePath` 本身的锚点相同（`resolve(projectDir, basePath)`），差异只在首个候选落空后的回退列表；(2) **F-4** 原给出的补救示例 `When Inc 计数器自增` 经真实正则实测**同样取不到事件**（行末为 CJK 词），已改为例 `When 计数器自增 (Inc)`。两条订正分别以 `cli/check-bdd-model.ts:165-178,294` / `application/artifact-gate-assets.ts:242,327` 与 `logic/bdd-logic.ts:358` 的代码为据；正则自证命令（与 `logic/bdd-logic.ts:358` 同式）：

```bash
node -e 'const re=/^\s*(?:When|And)\s+.+?\b(\w+)\s*\)?\s*$/; for (const c of ["  When 计数器自增 (Inc)","  When Inc 计数器自增"]) { const m=c.match(re); console.log(JSON.stringify(c),"=>",m?JSON.stringify(m[1]):"NO MATCH"); }'
#   → "  When 计数器自增 (Inc)" => "Inc"；"  When Inc 计数器自增" => NO MATCH
```

## 七、边界与声明

1. **CHECKPOINT 代行**：e2e 中全部 🔴 CHECKPOINT 由预设判据代行（全门禁 exit 0 + V A 级 + 无 Mandatory），沿用仓库 e2e 记录既有裁定（eval/e2e/2026-08-28-final.md）；**非用户本人确认**，生产使用时必须真人确认。
2. **V 评审**：demo 的 VerifierOutput 为合成产物（形态经 check-verifier-output 全规则校验）；真实 LLM 评审质量不在确定性门禁范围（技能设计如此——LLM-as-a-Verifier 由外部 Agent 执行）。
3. **codegraph / openspec**：本机未安装（doctor 2 提示）；阶段 5-8 的 codegraph/opsx 门禁以制品级校验覆盖（change-scope + 查询记录 + opsx 目录），真实符号级影响分析未演练。
4. **demo 的 git 上下文**：change-scope 绑定仓库真实 BASE..HEAD 差异（当前仅 `.gitignore` 一项）；demo 源码/测试被 gitignore 不在 git 上下文内，codegraph 覆盖义务对 scope 内 code/test 文件为空集——已在装配器注释与本报告如实登记。

## 八、产物清单

```
docs/debug/2026-09-19-wm-8phase-full-debug/
├── README.md                （本报告）
├── EVIDENCE_GRAPH.md        （证据树：根/枝/叶 + 状态 + 决策日志）
└── logs/
    ├── self-test-run1.txt / self-test-run2.txt     358/358 ×2
    ├── prepush.txt                                 19 项 CI 全绿
    ├── tla-e2e.log                                 真实 SANY/TLC 正负例
    ├── phase-trajectory.log                        免装配阶段轨迹（含真实拦截）
    ├── closure-baseline.log                        五闭环脚本样本基线
    ├── determinism.log                             确定性 + 恢复回归 + 导出链结论
    └── e2e/
        ├── trajectory.log                          119 次命令执行（89 门禁脚本 + 29 wm-write + 1 wm-status）全 exit 0
        ├── negative-probes.log                     首轮 8 项篡改探针（含 1 项后经复核为 phase 形态错配）
        ├── negative-probes-rerun.log               本轮交付脚本重跑 9 项探针（9/9 exit 1 + 恢复复验）
        ├── real-tests.log                          四级真实测试
        ├── phase-1.log                             阶段 1 装配迭代史（6 条命令）
        └── wm-status-final.txt                     终态快照
```

瞬态工作区：`eval/e2e/demo/`（gitignored）；装配器与驱动/探针脚本已随仓交付于 `eval/e2e/demo-assets/`（受跟踪，可重建重放）。
