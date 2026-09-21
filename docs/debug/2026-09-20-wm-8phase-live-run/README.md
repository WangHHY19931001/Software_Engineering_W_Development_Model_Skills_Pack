# W-Model 技能包 8 阶段全流程真实调测报告（2026-09-20）

> 调测对象：本仓库 `w-model-dev/`（W-Model Development Skill v42.2.1，L1 交付层）。
> 调测性质：**只读调测**——未修改技能包任何资产；全部产物在 gitignored 瞬态工作区 `eval/e2e/demo/`。
> 执行形态：**真实技能执行**——O（编排者）由主会话担任，A/S/V/G/R 全部由真实子代理承担（handoff 协议交接），门禁全部真实执行（392 份 gate-logs），真实子代理消耗 580.5M tokens。与 2026-09-19 的装配器重放调测根本不同。
> 快照：main @ fefd56fc · node v25.8.1 · Java 17（真实 SANY/TLC）· Windows 10。

## 一、总结论（TL;DR）

**技能包 8 阶段在本轮真实执行中端到端有效**：counter-api 演示项目走完阶段 1→8，**终局 12 项门禁全绿**（run-log / checkpoint / signature-chain / budget / maturity / role-dispatch / preventive×2 / artifact-gate 终检 / archive-integrity / openspec-archive×2），状态经 wm-write 原子演化至「项目完成 8/8」，RTM 覆盖率 100%，四级测试 9/9 真实通过。

> **⚠️ 终局状态订正（2026-09-20 晚，修复分支复核时发现，原报告未如实反映）**
>
> 上句「终局 12 项门禁全绿」对应的是 **13:20Z 的终局电池快照**（`p8r2-*` 系列 gate-logs；其中 `p8r2-10-runlog.log` 记录 `exitCode: 0`、`r10.checked=13`、`r11.checkedGates=7`）。该电池**之后**本轮还执行了一次「归档时序 + 链环路径订正」的**放行后修复循环**：先写入阶段 8 的 checkpoint 放行记录（13:22:28Z），再追加 6 条记录（`p8-s-fix`/`p8-s-archive`/`p8-s-chainfix` 三条 fix 13:26–13:31Z、三条 13:34:03Z 的 R3(fix)、`p8-v-final` 13:42:53Z），**未再跑终局电池**。
>
> 因此**当前盘面**（321 条）的 `check-run-log.ts` 为 **exit 1**，两条原因：(1) 三条 R3(fix) 记录误用 `action:"r3-fix"`——schema 动作枚举无此值，正确形态应为 `r3-completeness`/`r3-reliability`/`r3-security` 之一 + `variant:"fix"`（同族记录在阶段 1-7 均已按此形态落盘）；(2) **R8**「阶段 8 checkpoint 非阶段最后记录」（放行后仍有 6 条动作）。
>
> 这是本轮调测的**簿记缺陷**（放行与修复的顺序写反 + 动作名笔误），不是门禁缺陷；原始数据保持原样未清洗，以便复核。修复分支 `fix/gate-contract-rework-chain` 的任务 10 将按披露口径复验并记录于 `gate-fix-replay.txt`。


| 维度 | 结论 | 关键证据 |
|---|---|---|
| 端到端 | 成立 | 321 条 run-log（A 11 / S 25 / R 77 / V 37 / G 162 / O 9）· 125 环签名链 · 392 份 gate-logs · 8/8 阶段门放行 |
| 真实执行 | 成立 | 真实 SANY/TLC（4 规格零违反 ×4 阶段）· 真实单测/集成/系统/验收（node:test + seam-http，9/9）· cucumber 18 场景 154 步真实执行 · 变异复验（上界/延迟注入均转红） |
| 门禁牙齿 | 成立 | **38 次真实拦截**（见 §三），全部经 R→V→G→修复→复门禁闭环；无一次「为过门禁而改门禁」 |
| 角色隔离 | 成立 | O 零越权（所有产物/评审/门禁由子代理产出）；V 两度判 passed=false 阻断放行；R 报告全部经 V 复审 + G 门禁后才分派修复 |
| 状态可追溯 | 成立 | 8 份 checkpoint-log（判据代行如实标注）· run-log R11 闭环五脚本机器核验全绿 · 签名链 R1-R10 全绿 |

## 二、执行轨迹（按阶段）

| 阶段 | 主要产物 | 门禁轮次 | V 终值 |
|---|---|---|---|
| 1 需求分析 | 需求规格/验收测试设计/风险评估/UAT 路径映射 + L1 TLA+/BDD + RTM | 8 轮（口径/新鲜度/格式/链） | A 0.9122 |
| 2 系统设计 | 系统设计/系统测试设计 + L2 TLA+/BDD + SD 标识 | 2 轮 | A 0.9188 |
| 3 概要设计 | 接口设计/集成测试设计 + L3 TLA+/BDD + 双向引用 | 2 轮 | A 0.892 |
| 4 详细设计 | 详细设计/单元测试设计 + L4 TLA+/BDD | **1 轮（首试全绿）** | A 0.8827 |
| 5 编码实现 | src/counter.ts + routes + 单测 3/3 + codegraph 13/13 + opsx + cucumber 154 步 | 2 轮 | A 0.902 |
| 6 集成测试 | IT-001/002 真实 HTTP 2/2 + 判别力增补 | 3 轮 | A 0.8965 |
| 7 系统测试 | ST-001/002 + P95 实测 17.4ms（n=216）+ 安全抽查 8/8 | 1 轮 | A 0.8849 |
| 8 验收测试 | UAT-001/002 真实 2/2 + 归档 142 文件 + opsx 4 变更归档 | 3 轮 | A 0.9320 / 终版 0.9296 |

## 三、门禁拦截记录（技能有效性的核心证据）

**38 次真实拦截**，按类别：

1. **产物语义类**（10 次）：RTM coverageStatus 口径（阶段 1）、L1/L2/L3/L4 TLA 覆盖标识缺 SD/DD 标识（阶段 2/3/4 同族三度复发，最后以「机读契约入产出判据」为预防主措）、BDD↔TLA 事件集合不同步（阶段 2）、feature 头 @child-features 未同步（阶段 3）、RTM lastUpdated 未随回填刷新（阶段 1）、断言判别力不足（阶段 6）。
2. **格式/文法类**（8 次）：VerifierOutput evidence O3 命中（阶段 1/2/8 三次，判别式 = `path:Lnn-mm=` 文法）、rawScores 完美等差被构造检测命中（阶段 2/6 两次）、reportId 不合模式、预防报告 schema 外字段、sigId 命名不合模式。
3. **轨迹/簿记类**（12 次）：run-log 身份字段缺失（LEGACY_UNSCOPED 与 check-checkpoint 严格口径分歧）、fix→R3→V 窗口不满足、checkpoint 非阶段末条、决策词不含 ID 模式/阶段主题。
4. **装载/环境类**（8 次）：check-code-tla-consistency 的 tlaPath 装载基准缺陷、check-state-machine-consistency 输入契约不存在、cucumber 报告缺失、change-scope schema 不合规、opsx 目录命名缺 `phaseN-` 前缀、归档时序互斥。

每次拦截均按普通 V/G 失败链（R→V→G→修复→R3(fix)→V→G）闭合，**无跳过 R 的返工、无伪绿门禁**。

## 四、调测发现（按严重度）

| # | 级别 | 发现 | 证据锚点 |
|---|---|---|---|
| D-1 | **高（设计缺陷）** | `check-signature-chain` 的 `FORBIDDEN_SOURCE_ROLES` 矩阵与返工链设计矛盾：S 禁消费 [V,G,R]、V 禁 [G,R]，而 S-fix 必须消费 R 报告（反模式 #18 守护）、V 复审 rootcause 必须消费 R 报告——**返工路径的签名 round 在矩阵下不可合规表达**。本轮 4 次将就（R3/R/fix 环改锚允许来源 + sourceSigIds 保留授权链）并登记 | `scripts/logic/signature-chain-logic.ts:83-91` vs `references/signature-chain-guide.md` §2 返工子流程 |
| D-2 | **高（设计缺陷）** | run-log 词表缺「V 执行的修复」表达：VerifierOutput/预防报告的缺陷只能由 V 修复，而 `ACTION_ROLE_PAIRING` 强制 fix→S 且 R3/R7 按 `basedOnReport` 精确配对——**V 修复无法闭合 R 报告配对**。阶段 1/3/5/6 四次实例（每次均以借道 S-fix 或登记收口） | `scripts/logic/run-log-logic.ts:482-493`（配对表）+ `:820-844`（R3 配对） |
| D-3 | **中（门禁缺陷）** | `check-code-tla-consistency.ts` 未按 `manifest.basePath` 解析 `tlaPath`（以 .w-model/ 为基准），致 tlaPath 按项目根约定书写时装载期 ENOENT exit 2；本轮以 `.w-model/tla` 目录联结（junction）绕过并登记 | `cli/check-code-tla-consistency.ts:159`（V-03 亲读定位）；规避物 `.w-model/tla → ../tla` |
| D-4 | **中（门禁语义）** | `check-budget` 的 killSwitch 触发只统计 `action='rework'`（run-log 0 命中），真实 5 次返工循环未触发连续返工护栏；真实 token 消耗 580M 亦远超预算门禁口径（门禁无用量-上限校验步） | `check-budget.ts` R5 触发检测；ICEBERG-B IF-1（V 裁定 REGISTER） |
| D-5 | **中（口径分歧）** | 同一条 run-log 记录，`check-run-log` 判 LEGACY_UNSCOPED 非阻断（deferred），`check-checkpoint` 同库严格 schema 判 blocking——两个消费者对同一份数据给出相反裁定 | 阶段 8 终检 #12 与 #10 实测对比（p8-r3c 等条目） |
| D-6 | 中（bootstrap） | 阶段 1 的 R11 闭环五脚本要求「check-checkpoint 成功记录早于放行」与该门自身「需要已存在 checkpoint 记录才能通过」构成首阶段自举死锁；本轮以「放行后复跑 + 时间戳重对齐」化解并披露 | `run-log-logic.ts:1360-1392`（R11）与 check-checkpoint 实测 |
| D-7 | 低（归档互斥） | 归档前聚合门（check-opsx-artifacts）与归档后置门（check-openspec-archive）对同一目录结构互斥：归档即前门红、不归档即后门红——须两次快照定序，无单一稳定态 | 阶段 8 两轮终检实测（p8r1-08 vs p8r2-05） |
| D-8 | 低（口径） | 设计级「主文档+6 子模板布局」仅在 `--spec-dir` 注入时校验（`gate-logic.ts:1088-1199`），默认调用整组跳过；本 demo 未演练该口径（登记为待办） | V-01 阶段 2 亲证（gate-logic.ts:L1444） |
| D-9 | 低（环境边界） | codegraph/openspec CLI、MCP、.codegraph/ 工作区在本机不可自动安装（ensure-codegraph-opsx 5 项 CHECKPOINT）；阶段 5-8 以制品级校验覆盖（change-scope + 查询记录 + opsx 目录），**真实符号级影响分析未演练** | `gate-logs/p5-ensure-deps.log` exit 1 |
| D-10 | 低（簿记） | 环境既有：`.w-model/tla` 联结为 gitignored 本地生成物；demo 源码/测试不在 git 上下文内（scope 24 文件全为技能包路径，demo 变更的 codegraph 覆盖义务为空集——已多轮登记） | 阶段 5-8 scope 复算记录 |

## 五、边界与声明

1. **CHECKPOINT 代行**：全部 🔴 CHECKPOINT 由预设判据代行（全门禁 exit 0 + V A 级 + 无 Mandatory + RTM 100% + ICEBERG 终止），8 份 checkpoint-log 逐份标注「e2e 判据代行，非用户本人确认」；**生产使用必须真人确认**。
2. **本轮伴随的 O 侧簿记修复（全部备份 + 披露）**：run-log 的若干次记录重排/时间戳重对齐/字段补全（含 2 次移除误录记录、1 次链环路径订正级联重算、签名链 2 次格式/来源修复）——均为编排者日志与格式层修复，未改任何阶段产物内容；所有修复备份在盘（`.w-model/*.bak.*`）。
3. **子代理自证与门禁的关系**：S/S-fix/R3 子代理的「先红后绿」自查不替代 G 的独立复跑；终局判定一律以 G 的真实退出码为准（本轮 G 电池共 14 轮，全部独立执行）。
4. **V 评审为真实 LLM 子代理**（非 self-as-verifier）；三次 passed=false（阶段 3/5/6）均真实阻断放行并驱动返工。
5. 本报告目录外的产物均为 gitignored 瞬态工作区，不随提交交付。

## 六、可复核入口

> **⚠️ 对应历史态**：本节命令与下方计数针对 **2026-09-20 当时**的 demo 工作区（旧 opsx 链路契约、
> 归档位 `archive/`）。该工作区已于 **2026-09-21** 由 `eval/e2e/demo-assets/build_workspace.py` 重建为
> **新契约**（`docs/plans/<cid>.plan.md` + `.superpowers/sdd/` + R3/V stage 词表 plan/execute/finalize；
> `check-opsx-artifacts.ts` 本体也已退役），因此直接照抄本节命令会得到与当时不同的结果；
> 需要当前态复现请从 [../2026-09-21-superpowers-replace-replay/replay.txt](../2026-09-21-superpowers-replace-replay/replay.txt) 进入。

```bash
cd eval/e2e/demo            # 瞬态工作区（gitignored）
npx tsx ../../w-model-dev/scripts/cli/wm-status.ts .            # 8/8 100%、四级 9/9、RTM 100%
npx tsx ../../w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=8 --scope=.w-model/change-scope.p8.json
npx tsx ../../w-model-dev/scripts/cli/check-signature-chain.ts .w-model/signature-chain.jsonl
npx tsx ../../w-model-dev/scripts/cli/check-run-log.ts .w-model/run-log.jsonl   # ⚠️ 现为 exit 1：见 §一 终局状态订正（放行后修复循环 6 条记录）
wc -l .w-model/run-log.jsonl .w-model/signature-chain.jsonl      # 321 / 125
ls .w-model/gate-logs | wc -l                                     # 392
```

> 路径提示：`eval/e2e/demo` 下引用技能包脚本需**三层** `../../../w-model-dev/...`（两层会解析到不存在的 `eval/w-model-dev/`）。
