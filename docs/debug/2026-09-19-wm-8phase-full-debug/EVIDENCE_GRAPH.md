# Evidence Graph — W-Model 技能包 8 阶段全流程调测（2026-09-19）

- 计划版本：v1.0-final（快照标识：git HEAD `67728b300673afb9364cb20726e8bbd375bbf4b2`，main）
- 图谱状态：已归档（全部叶子收敛，决策日志见 §4）
- 执行者：ZCode 调测会话（O 角色；S/G 动作经隔离工作区与真实脚本执行模拟）
- 方法论：证据支撑树（evidence-anchored-decision-tree）— 根→枝→叶，每叶挂证据锚点（命令 + 退出码 + 日志文件），三色状态 🟢 Confirmed / 🟡 Pending（边界登记） / 🔴 Invalid
- 复核方式：本目录 `logs/` 保存全部原始命令输出；重放步骤见 [README.md](./README.md) §五

## 1. 根节点

- R1: W-Model 技能包（v42.2.1，L1 交付层）8 阶段全流程编排 + 门禁体系在本次调测中**有效**（门禁按设计判定正/负样本：self-test 358 夹具 + samples-coverage 48 探针 + 负向篡改探针 9 项 + 真实 TLC 3 负例，应拒全拒、应过全过）且**可靠**（重复运行确定性、退出码契约零例外、状态原子写入零失败）| 状态: 🟢（B1-B5 全枝收敛）

## 2. 枝干与叶子

> 锚点格式：`logs/<文件>` + 命令 + 退出码。所有命令自仓库根执行（另有注明除外）。

### B1 环境就绪性（R1 前置枝）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L1.1 | B1 | Node ≥ 20（v25.8.1） | `node --version` 会话记录 | 🟢 |
| L1.2 | B1 | doctor 0 阻断（java17/tla2tools/ajv 就绪） | `npm run doctor` | 🟢 |
| L1.3 | B1 | 依赖完整（node_modules + tsx） | doctor + 46 脚本可执行 | 🟢 |
| L1.4 | B1 | 边界：codegraph/openspec 未安装（可选项，2 提示）；阶段 5-8 符号级影响分析以制品级校验覆盖 | doctor 输出 + README §七.3 | 🟡（环境边界，非缺陷） |

### B2 有效性（门禁按设计判定）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L2.1 | B2 | self-test 358/358 通过 ×2 | logs/self-test-run{1,2}.txt，EXIT=0 | 🟢 |
| L2.2 | B2 | pre-push 19 项全绿（含全量 vitest + 规则层覆盖 + security-scan + samples 矩阵 + prettier + tsc + eval） | logs/prepush.txt，PREPUSH_EXIT=0 | 🟢 |
| L2.3 | B2 | 真实 SANY/TLC：正例 exit 0 ×2；死锁/不变式违反/语法错误 3 负例 exit 1 | logs/tla-e2e.log | 🟢 |
| L2.4 | B2 | 免装配阶段轨迹：README 阶段×门禁表内夹具全部 exit 0；错配夹具被真实拦截（phase1 图谱@phase2 → exit 1 死模块+边界缺失；BDD 缺 --graph → exit 2 ARG_INVALID） | logs/phase-trajectory.log | 🟢 |
| L2.5 | B2 | 48 个 exit-2 门禁负向探针串行真实执行 0 失败（两轮） | logs/determinism.log（SAMPLES_COVERAGE_JSON negativeCoverageProbes:48 / ProbeFailures:0） | 🟢 |
| L2.6 | B2 | 9 项篡改探针全部 exit 1（签名链篡改/闭环缺失/图谱黑洞/单轴下限/RTM 缺失/泛化决策/cucumber 失败步骤 + phase 形态错配 + TLA 不变式真实违反），恢复后回归复绿；其中首轮「伪报不变式」一项经复核实为 phase 形态错配，已拆分并新增真探针（真实 TLC 复核拒绝伪造自报） | logs/e2e/negative-probes.log + logs/e2e/negative-probes-rerun.log + logs/determinism.log 修正复验 | 🟢 |
| L2.7 | B2 | 跨产物一致性五类约束（TLA 头↔manifest、cfg↔BusinessInvariant、BDD SM↔TLA 动作、追溯边方向、R15e↔签名链 V 环）在装配迭代中均真实拦截 ≥1 次 | logs/e2e/phase-1.log + trajectory.log 迭代史（README §2.3） | 🟢 |

### B3 可靠性（重复运行确定性）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L3.1 | B3 | self-test ×2 用例行 diff 为空 | diff 命令输出 DIFF_EMPTY | 🟢 |
| L3.2 | B3 | review-package 同输入两份产物 sha256 全等（d5fd8e75…） | logs/determinism.log | 🟢 |
| L3.3 | B3 | doctor --json 两份 sha256 全等（ded43763…） | logs/determinism.log | 🟢 |
| L3.4 | B3 | samples-coverage 两轮稳定（含 48 探针重放） | logs/determinism.log SAMPLES_COVERAGE_STABLE=yes | 🟢 |
| L3.5 | B3 | TLC 连跑 2 次零违反；四级 node:test 真实执行稳定 | logs/tla-e2e.log + logs/e2e/real-tests.log | 🟢 |
| L3.6 | B3 | 退出码契约 0/1/2 全程零例外；exit 2 均带结构化 ERROR_JSON | 全部日志 EXIT_CODE 行 | 🟢 |

### B4 8 阶段端到端技能使用测试（scaled e2e）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L4.1 | B4 | counter-api 隔离工作区（gitignored，自建 git edc0216）：SPEC 冻结 + 全套产物装配 | eval/e2e/demo-assets/build_workspace.py（装配器，受跟踪；瞬态工作区 `eval/e2e/demo/` 已 gitignored） | 🟢 |
| L4.2 | B4 | 阶段 1→8 轨迹 119 次命令执行全部 exit 0（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status；图谱/TLA 真实 TLC/BDD 含等价/Verifier/artifact-gate/闭环五/role-dispatch/signature-chain/archive-integrity） | logs/e2e/trajectory.log（末行 `TOTAL_GATE_RUNS=119`；`grep -c 'EXIT_CODE=0'` = 119） | 🟢 |
| L4.3 | B4 | 状态经 wm-write 原子演化（29 次写入零失败；`.bak` 按 `keepBackups=5` 每目标轮转，盘上现存 19 个，见 `logic/state-write-logic.ts:502`）+ wm-status 终态「项目完成 8/8，四级测试 9/9」 | logs/e2e/wm-status-final.txt | 🟢 |
| L4.4 | B4 | CHECKPOINT 由预设判据代行（仓库 e2e 既有裁定，非用户本人确认） | README §七.1 声明 | 🟢（声明性节点，如实登记） |
| L4.5 | B4 | 四级测试为真实 node:test 执行（UT3/IT2/ST2/UAT2 全 exit 0），RTM 记录真实命令+退出码 | logs/e2e/real-tests.log | 🟢 |
| L4.6 | B4 | 边界：change-scope 绑定仓库真实 git 差异（.gitignore 一项）；demo 文件 gitignored 不入 scope，覆盖义务空集 | README §七.4 | 🟡（边界登记） |

### B5 可复核性（报告可独立复核）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L5.1 | B5 | 全部命令 + 输出尾部 + 退出码落盘 logs/（13 个日志文件：logs/ 7 + logs/e2e/ 6，无仅口头结论） | logs/ 目录清单 README §八 | 🟢 |
| L5.2 | B5 | 快照锚定（HEAD sha + node/Java/平台）+ 重放步骤成文 | README 头部 + §五 | 🟢 |
| L5.3 | B5 | 负向样本选择可追溯：突变与期望写死在 `eval/e2e/demo-assets/run_negative_probes.sh`（本轮交付，受跟踪），非自造夹具冒充 | logs/e2e/negative-probes-rerun.log（9 项真实运行：命令 + 退出码 + 命中期望词） | 🟢 |

### B6 防伪（额外枝：证据溯源链 fail-closed）— 🟢

| 节点 | 父节点 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|---|
| L6.1 | B6 | 无 git 上下文 → MISSING_GIT_HEAD（exit 1） | logs/determinism.log §导出链 | 🟢 |
| L6.2 | B6 | 合成绿色状态（自建 git）→ GATE_NOT_PASSED（exit 1）：须 gate-logs 真实测量 + run-log gateLogPath 交叉对账 | logs/determinism.log §导出链 | 🟢 |
| L6.3 | B6 | 边界：正向导出链未演练（需真实会话逐 gate 测量文件） | README §六 F-6 | 🟡 |

## 3. 依赖与影响

- R1 依赖 B2+B3+B4+B6（结论）与 B5（可复核性）；B2/B3/B4 依赖 B1。
- L1.4 影响 B4 的阶段 5-8 附加门禁覆盖方式（制品级替代符号级），不影响 R1 主结论。
- L4.6 / L6.3 为登记性边界，不构成任何枝干前提失效。

## 4. 状态变更与决策日志

| 时间 | 节点 | 旧状态 → 新状态 | 触发证据 | 上行路径 | 决策与影响 |
|---|---|---|---|---|---|
| 03:41 | R1..L5.3 | — → 🟡 | 图谱建立（HEAD 67728b30） | — | v1.0 骨架落盘 |
| 03:4x | L1.1-L1.3 | 🟡 → 🟢 | node/doctor/依赖检查通过 | — | 环境枝收敛 |
| 03:5x | L2.1/L3.1 | 🟡 → 🟢 | self-test run1/run2 358/358 且 diff 空 | — | 基线枝收敛 |
| 04:0x | L2.3/L3.5 | 🟡 → 🟢 | tla-e2e 真实 SANY/TLC 正例×2 + 3 负例 | — | 工具链枝收敛 |
| 04:1x | L2.4 | 🟡 → 🟢 | 免装配轨迹 + 2 项真实拦截 | — | 夹具级有效性收敛 |
| 04:2x-05:3x | L4.1/L4.2 | 🟡 → 🟢（经 9 轮装配迭代） | trajectory.log 30/107 → 119/119 | 失败均定位为 demo 产物不合规格，非技能缺陷 | e2e 主枝收敛；中间轮失败保留于迭代史 |
| 05:3x | L2.5/L3.4 | 🟡 → 🟢 | samples-coverage 两轮 + 48 探针 0 失败 | — | 批量负向有效性收敛 |
| 05:4x | L2.6 | 🟡 → 🟢 | 9 项篡改探针全 exit 1 + 恢复复绿 | — | 门禁牙齿验证收敛 |
| 05:4x | L6.1/L6.2 | 🟡 → 🟢 | 导出链两级 fail-closed 复现 | — | 防伪枝收敛（新增 B6，超出原计划范围的正向发现） |
| ~05:4x | R1/B2-B6 | 🟢（终态） | 全枝收敛；L1.4/L4.6/L6.3 保持 🟡 边界登记 | — | 报告定稿 |
| 05:4x | （流程） | 事故：误在仓库根 git commit（a5ed70eb） | git log 复核 | — | 即时 `git reset --soft HEAD~1` + unstage，HEAD 复位 67728b30；登记 F-7，工作树无残留（误提交对象 `a5ed70eb` 仍可经 reflog 到达，未推送） |
| 09-19 复核 | L2.6 / B5 | 🟢（订正） | 交付脚本重跑 9 项探针（logs/e2e/negative-probes-rerun.log）；原「伪报不变式」探针实为 phase 形态错配，已拆分并新增真实 TLC 不变式探针 | — | 独立复核订正 P1；F-2/F-4 表述同步订正（README §6.1） |

## 5. 快速自检（方法论收口）

- [x] 目标/范围/成功标准已拆根→枝→叶，每叶有可复核锚点
- [x] 三色状态准确：🟡 仅用于 3 项登记性边界（L1.4/L4.6/L6.3），无 🟢 伪装
- [x] 全部结论可由 logs/ + 重放步骤独立复核
- [x] 调测过程中的失败、事故与边界如实保留（未事后美化）
