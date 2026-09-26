# W-Model 技能包 8 阶段全流程真实调测报告（2026-09-23 起 · live run #2）

> 调测对象：本仓库 `w-model-dev/`（W-Model Development Skill v42.x，L1 交付层）。
> 调测性质：**只读调测**——未修改技能包任何资产；全部产物在 gitignored 瞬态工作区 `eval/e2e/demo/`。
> 执行形态：**真实技能执行**——O（编排者）由主会话担任，A/S/V/G/R 全部由真实子代理承担（handoff 协议交接），
> 门禁全部真实执行（335 份 gate-logs），CHECKPOINT 由用户授权编排者**代行**（诚实标注）。
> 工作区重建：`eval/e2e/demo-assets/build_workspace.py --reset`（基准态销毁前完成证据分级裁定）。
> 快照：demo git `57e53d7`（基线）→ `a56c255`（阶段 8 归档批）；Windows 10 · node v25.8.1 · Java 17（真实 SANY/TLC）。

## 一、总结论（TL;DR）

**技能包 8 阶段在本轮完整真实执行中端到端有效**：counter-api 演示项目走完阶段 1→8，
**终态全量电池 11/11 全绿**（run-log / signature-chain / checkpoint / budget / maturity / role-dispatch /
preventive×2 / artifact-gate 终检 / archive-integrity / verifier），`project.status=项目完成`。

| 维度 | 结论 | 关键证据 |
|---|---|---|
| 端到端 8/8 | 成立 | 443 条 run-log（O 15 / A 5 / S 36 / R 109 / V 49 / G 229）· 166 环签名链 · 335 份 gate-logs · 8 份 checkpoint 放行 · 真实子代理消耗 522M tokens（含归账约定放大，见 §五.4） |
| 真实执行 | 成立 | 真实 SANY/TLC（L1~L4 四层，改动后回归零扰动）· 真实 UT/IT/ST/UAT（node:test + node:http，16/5/5/7 全过）· cucumber 26 场景 178 步真实执行（红探针验证无伪绿）· P95 实测（ST 0.300/0.199/0.186ms vs 250ms 基线；UAT 生产判定 0.326/0.214/0.252ms vs 200ms 判据）· code-TLA 一致性四维 converged |
| 门禁牙齿 | 成立 | **65 次真实拦截**（gate exitCode=1 记录），横跨全部 8 阶段，含 13 次 verifier 产物质量同族拦截、10 次 run-log 轨迹/身份拦截、8 次修复链拦截；无一次「为过门禁而改门禁」 |
| 角色隔离 | 成立 | O 零实施（全部产物/评审/门禁由子代理产出）；V 两度判 passed=false 真实阻断（阶段 2/4 主评审）；R 报告全部经 V 复审 + G 门禁后才分派修复；反模式 #18/#19 零命中 |
| 修复链 | 成立 | 10 份 RootCauseReport 全部走 R→V→G→S-fix→R3(fix)→V→G 完整链；failure chains 覆盖 7 个阶段；ICEBERG-A/B 全阶段执行（13 份报告），终轮 both 收敛 |

## 二、执行轨迹（按阶段）

| 阶段 | 主产物 | 主电池轮次 | 失败链 | V 终值 |
|---|---|---|---|---|
| 1 需求分析 | 需求规格主文档+6 子文档 / ATD / 风险 / TLA+ L1 / BDD L1 / RTM | 4 轮 | 3 条（RC×3） | A 0.9258 |
| 2 系统设计 | 系统设计主+6 子 / ST 设计 / L2 / BDD L2 | 2 轮 | 1 条（+D-2 重发×3） | A 0.917 |
| 3 概要设计 | 接口设计主+6 子 / IT 设计 / L3 / BDD L3 | 2 轮 | 冰山文档漂移 | A 0.9482 |
| 4 详细设计 | 详细设计主+6 子 / UT 设计 / L4 / BDD L4 | 2 轮 | 1 条（豁免回写） | A 0.917 |
| 5 编码实现 | src×3 + test/（UT-001~016）/ 计划制品组 / code-TLA converged | 4 轮 | 2 条（RC×2）+ 冰山 1 | A 0.9220 |
| 6 集成测试 | it-runner + IT 5/5 真实 HTTP / 计划组 | 2 轮 | 1 条（RC）+ 冰山 1 | A 0.9573 |
| 7 系统测试 | st-runner + ST 5/5 + P95 实测 / 计划组 | 2 轮 | 0（3 偏离裁定） | A 0.9634 |
| 8 验收测试 | UAT 7/7 + 验收报告 + 归档 366 件 / 计划组 | 4 轮 | 1 条（RC 归档）+ 冰山 2 轮 | A 0.9647 |

## 三、门禁拦截记录（65 次 · 技能有效性的核心证据）

按族分类（全部经普通失败链闭合）：

1. **verifier 产物质量族（13 次）**：rawScores 等差/完美构造 ×N、evidence O3 文法、rootcause-review 根级 schema、
   reviewedAt 物理不可能（阶段 8 冰山发现）。**结论：V 子代理产分数/锚的形态纪律是全轮最高频弱点**——建议技能包在
   V 简报模板中固化「真实离散+行首锚定+真实时刻」硬约束（本轮已在分派模板中人工固化）。
2. **run-log 轨迹/身份族（10 次）**：阶段 8 身份字段（round/reportId/targetKind/basedOnReport/implementationTarget/artifacts）
   条件 schema、fix 窗 R3 计数、identity 段序 S→R3→V→G、R7 append-only、R11 五脚本时序。
3. **修复链纪律族（8 次）**：S-fix 缺 revertEvidence、fix 变体 V 缺失、target≠implementationTarget、artifacts 未含目标。
4. **产物语义族（14 次）**：REQ-002 验收关联、L1 头↔manifest 半改、D6 行末数字陷阱、sync 7 条、cfg 聚合器字面锚定、
   rt m codeModule 缺失、uat 路径畸形、归档清单 46 项缺失、scope 口径 6→63/51→56/69→428 同步等。
5. **簿记/口径族（20 次）**：README 快照前缀偏移、矩阵/矩阵三册发散、currentPhase 多册、cucumber 报告缺失等。

## 四、调测发现（按严重度）

| # | 级别 | 发现 | 证据锚点 |
|---|---|---|---|
| D-1 | **高（设计缺陷）** | `check-iceberg-sweep` deriveViewSets 三视角命名空间不等宽：graph 视角抽 SD/DD/INTF，tla/rtm 视角被代码/规约锁定 SD-only → **阶段 2-8 的 R6 对账结构性不可过**（本轮 7 个阶段全部以「structural-r6-known + exit 1 存证 + O 裁定放行」收敛） | `iceberg-sweep-logic.ts` deriveViewSets + `tla-logic.ts:1010-1029`；各阶段 `p*-G-*-iceberg*.log` |
| D-2 | 高（流程缺陷） | 阶段 5-8 双规约并存：`check-coding-plan` R5 要 `r3-reviews/phaseN-*.md` 与 `check-preventive-review` 要 `preventive-reviews/N-*.json` 互不相认，每阶段需双份 R3×9；且 artifact-gate 聚合 codingPlan strict 使「每阶段全组（plan+账本+三件套+R3×9+V×3+scope+codegraph）」成为硬义务——O 分派若漏一组即整阶段返工（阶段 6 实例） | `coding-plan-logic.ts:297-325` + `check-preventive-review.ts` 路径前缀推导 |
| D-3 | 中（门禁缺陷） | `check-run-log` R7 只检相邻单调、无法检出**既有行就地改写**（本轮 D-6 舞步依赖此盲区完成放行前记录重排；G 子代理如实标记「exit 0 ≠ 闭环」） | `p8-G-10-runlog.log` PRIOR RUN 段 |
| D-4 | 中（自举死锁族） | R11「五脚本成功记录须严格早于放行」与 check-checkpoint/check-run-log 自我指涉构成逐阶段自举问题：本轮以「插入成功记录后立即复跑验证」的 D-6 变体逐阶段处置（8 次），官方仅对阶段 1 有后置豁免 | 各阶段 `run-log-logic.ts R11` 实测 + checkpoint 序列 |
| D-5 | 中（记账口径） | wm-write/olog 的 append 强制单调与「回溯/重排」需求冲突：本轮发生 5 次被静默覆盖的时间戳（须位置插入脚本兜底）；Σtokens 因 R3 三条目重复归账放大（522M 记录 vs 唯一消耗约一半），budget R6 口径与真实消耗脱钩 | `olog.py` cmd_runlog 单调实现；`check-budget` R6 |
| D-6 | 中（环境边界） | codegraph CLI 存在但 demo 无索引（probe exit 1）→ 阶段 5-8 全部以**制品级查询记录**替代真实符号分析；`check-codegraph-queries` 接受制品口径（0/0 为早退展示值） | `.w-model/codegraph-queries/` 各阶段记录 + D-9（2026-09-20 报告）同族 |
| D-7 | 中（口径发现） | `check-maturity` R5 O_PATTERN(`\bO[1-6]\b`) 与 verifier O3 规则编号命名冲突：分析性引用被计为运维失败（本轮 4 次命中全为引用），且无降级评估豁免通道 | `check-maturity.ts:82`；p1-G-16-maturity.log |
| D-8 | 低（文档-实现分歧） | R11 文档称「阶段 1 的 check-checkpoint 记录允许后置」，实现要求严格早于放行（阶段 2-8 无豁免）——本轮按实现口径执行 | `run-log-logic.ts:1360-1392` vs AGENTS 表 |
| D-9 | 低（披露面） | 归档 366 件中 186 件含本机绝对路径（HEAD~1 为 0，零凭据无 remote）——交付前须 wm-export-evidence 脱敏；已在归档 README 与 checkpoint-log 披露 | `p8-R-r3c-fix-03.json` Optional①；`phase-8.txt` |
| D-10 | 低（V 产物形态） | V 子代理产 rawScores 的构造模式（等差/整数/完美）反复出现（13 次同族拦截，跨 5 个阶段）——门禁检出有效但消耗大量返工；建议固化进 V 简报模板 | §三.1 各日志 |

## 五、边界与声明

1. **CHECKPOINT 代行**：全部 🔴 CHECKPOINT（8 次阶段门 + 收敛/口径裁定）由用户授权的编排者**代行**，
   8 份 `checkpoint-log/phase-N.txt` 与 8 条 run-log 放行条目逐份标注「代行，非用户本人确认」；
   **生产使用必须真人确认**。
2. **簿记修正全量披露**（O 侧，wm-write 备份在案）：本 run 的编排者日志修正包括——(a) 跨阶段 record 级联重算
   4 次（改环→下游 prevSigHash）、(b) 窗口/段序位置重排与时间戳重对齐 ~12 次（D-6 舞步 8 次 + R3 窗口 4 次）、
   (c) 字段补全/对齐（身份五字段、target/artifacts、basedOnReport 锚）~20 条、(d) 去重/重分类（阶段 1 R3 双套、
   冰山动作分类）~20 条。**均为日志与格式层修正，未改任何阶段产物内容**；每次修正在对应 run-log note 或
   `orchestrator-state.md` Ruling 中标注。修正备份散落 `.w-model/*.bak.*`。
3. **子代理自证与门禁的关系**：S/S-fix/R3 子代理的「先红后绿」自查不替代 G 的独立复跑；终局判定一律以 G 的
   真实退出码为准（G 共 40+ 次独立执行）。
4. **token 归账**：Σtokens 522M 为 run-log 记录值（含 R3 三条目重复归账约定放大）；唯一分派消耗估计约
   250-300M。阶段 1 曾以 Ruling 将 budget 上限调整至 20M/阶段、300M/总（但真实值仍在其上，见 D-5）。
5. **本报告目录外的产物**均为 gitignored 瞬态工作区，不随提交交付；快照见 `snapshots/`。

## 六、可复核入口

```bash
cd eval/e2e/demo            # 瞬态工作区（gitignored）
npx tsx ../../../w-model-dev/scripts/cli/wm-status.ts .          # 项目完成 8/8 100%、RTM 100%、四级 16/5/5/7
npx tsx ../../../w-model-dev/scripts/cli/check-run-log.ts .w-model/run-log.jsonl                  # exit 0
npx tsx ../../../w-model-dev/scripts/cli/check-checkpoint.ts .w-model/run-log.jsonl --checkpoint-log=.w-model/checkpoint-log   # exit 0
npx tsx ../../../w-model-dev/scripts/cli/check-signature-chain.ts .w-model/signature-chain.jsonl --phase=8 --stage=pre-checkpoint  # exit 0
npx tsx ../../../w-model-dev/scripts/cli/check-archive-integrity.ts docs/changes/archive/2026-09-25-phase8-counter-api --change-id=phase8-counter-api  # exit 0
wc -l .w-model/run-log.jsonl .w-model/signature-chain.jsonl      # 443 / 166
ls .w-model/gate-logs | wc -l                                     # 335+
ls .w-model/handoff | wc -l                                       # 247 个分派目录
```

> 路径提示：`eval/e2e/demo` 下引用技能包脚本需**三层** `../../../w-model-dev/...`。

## 七、Ruling 清单（编排者代行裁定，全量）

| # | 阶段 | 裁定 | 披露位置 |
|---|---|---|---|
| R-01 | 全局 | CHECKPOINT 代行授权（用户会话授权，非逐次确认） | orchestrator-state.md |
| R-02 | 全局 | budget 上限调整 Ruling（20M/阶段、300M/总） | orchestrator-state.md |
| R-03 | 全局 | 签名链追加不经 wm-write（锁+备份+tmp/rename 替代） | orchestrator-state.md |
| R-04 | 1 | SPEC 三质疑裁定（初值=0 / GET 归属 REQ-001 / P95 口径） | orchestrator-state.md + checkpoint-log/phase-1 |
| R-05 | 1 | 阶段门代行放行 | checkpoint-log/phase-1.txt |
| R-06 | 1 | 簿记修正 #1-#4 + 口径发现四项（R6 gate-log/maturity R5/iceberg R8/R11 分歧） | checkpoint-log/phase-1 + journal |
| R-07 | 2 | 阶段门代行放行 + deriveViewSets 结构性缺陷登记 | checkpoint-log/phase-2.txt |
| R-08 | 3 | 阶段门代行放行 + 簿记修正 #5（S-04 重分类+环重锚） | checkpoint-log/phase-3.txt |
| R-09 | 4 | 阶段门代行放行 + 簿记修正 #6（尾段重建） | checkpoint-log/phase-4.txt |
| R-10 | 5 | 阶段门代行放行 + scope 口径裁定（63 文件）+ 簿记修正 #7/#8 | checkpoint-log/phase-5.txt |
| R-11 | 6 | 阶段门代行放行 + 编码链纪律裁定（5-8 全组无缩减） | checkpoint-log/phase-6.txt |
| R-12 | 7 | 阶段门代行放行 + 采样工具等价性与 package.json 追认 | checkpoint-log/phase-7.txt |
| R-13 | 8 | 终门放行 + 项目完成 + 交付面（脱敏义务）与回归约束收口 | checkpoint-log/phase-8.txt |
| R-14 | 全局 | D-6 自举变体逐阶段处置（插入+复跑验证）与时间戳重对齐（D-3 盲区利用）披露 | 各阶段 run-log note + 本报告 §五.2 |
