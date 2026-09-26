# Orchestrator State

updated: 2026-09-22T00:00:00Z（实时更新）
phase: 1 - 需求分析

## CURRENT

- 已代行 🔴 CHECKPOINT · 项目初始化，分派 A-chunk（phase1-A-01）

Ruling: 代行项目初始化确认，进入阶段 1（需求分析 + 验收测试设计） — 用户 2026-09-22 会话指令明确授权「人在回路由编排者代理，其他依照技能约束工作」，故初始化/阶段门/发布三类 CHECKPOINT 由编排者代行并如实标注 — 若错（用户本会否决），代价为该阶段返工重跑（各产物均在 demo 瞬态工作区，可整阶段回退）。

## DONE

- [prep] 基准态裁定：104/49/0bak/cp-runIds⊆基准集 → 非唯一证据载体，销毁合法（历史态已由 demo-snapshots×7 + tracked CHANGELOG 保全）
- [prep] .w-model 初始化（project=需求分析 / budget 默认 / maturity L2 / rtm 空行集）+ demo git baseline 57e53d7
- [prep] plan-chunks：SPEC.md 单块（chunk-001, 151 tokens, strategy=single）
- [phase1-O-00] O(chunk) 环已签

## NEXT

- [phase1-A-01] A-chunk 读 SPEC.md → .w-model/ingestion/chunk-001.{md,json}
- [phase1-A-02] A-cross 合并建图 → consolidated.json + graph.json
- G check-requirement-graph --phase=1 收敛循环

Ruling: 预算按真实运行量级调整（perPhase 20M / total 300M） — 约束 4 要求记录宿主报告实耗（首分派即 2.9M tokens），预算门禁 R6 现已实效强制，维持装配器默认 500k 会使首个阶段门即触发预算阻断；用户授权编排者代行预算裁定，量级参照 2026-09-20 live-run 实耗（580M 全程） — 若错（真实消耗超 300M），代价为预算告警 CHECKPOINT 暂停并再次提额。

- [phase1-A-01] A-chunk → DONE：4 REQ 节点 + 3 边 + 迷雾零条目 | beacon: handoff/phase1-A-01/status.json

Ruling: signature-chain.jsonl 追加不经 wm-write（改用同语义的锁+备份+tmp/rename 原子追加） — wm-write 对未注册目标仅接受单 JSON 文档（实测 INVALID_JSON），多行 JSONL 结构性不可写；run-log.jsonl 为注册目标仍走 wm-write — 若错（链文件并发损坏），代价为链断裂可由备份恢复（.bak 每次追加留存）。

- [phase1-G-01] G graph-gate → exit 0 收敛达成 | beacon: handoff/phase1-G-01/status.json

Ruling: 代行 🔴 CHECKPOINT · ingestion 收敛确认，图谱收敛接受（exit 0、violations 空、边数警告为 small-project 非阻断口径） — 收敛判据以 G 门禁退出码为准（约束：CHECKPOINT 以脚本退出码为准） — 若错（边数不足实为结构缺陷），代价为阶段 2 图谱演进时暴露并回退阶段 1 补边。

- [phase1-O-01] 收敛确认（代行）；NEXT: S-doc → S-test/risk → S-tla → S-bdd → R3×3 → G(preventive) → V → G(主门禁+闭环) → iceberg-B → 放行

- [phase1-S-01] S-doc → DONE：spec-dir 主规格+6子文档 + RTM 4 行 | beacon: handoff/phase1-S-01/status.json

Ruling: SPEC 三质疑代行裁定——(1) 计数器初始值=0（「Reset 归零」+环形 [0,10] 域语义；阶段 5 实现 zeroed 初始态） (2) GET /counter 只读查询归属 REQ-001 域（取值范围需求的观察接口，不产生状态转移） (3) NFR-001 P95 口径=单次操作端到端响应时延的 P95，生产目标 200ms、测试环境基线 250ms（阶段 7 以进程内计时为代理证据） — 质疑均属规格空白而非矛盾，按最小语义补全并如实登记 — 若错（用户对初始值/P95 口径有异义），代价为验收测试用例断言调整（阶段 8 前可改，不可逆动作无）。


- [phase1-S-02] S-doc → DONE：UAT-001~007 + 风险 6 + UAT 映射 + coverage 四矩阵 | beacon: handoff/phase1-S-02/status.json
- [phase1-S-02b] 产出期精化（非 fix 变体）：spec 400ms→250ms 对齐裁定（RISK-006）
- [phase1-S-02b] S → DONE：400ms→250ms 全量对齐（7 处 + 5 处限定语订正）
- [phase1-S-03] S-tla → DONE（真实 SANY/TLC 自验）
- [phase1-S-04] S-bdd → DONE（11 态/22 转移/5 场景）；两项移交（RTM↔feature 对齐、behavior-spec 文件名）由 S-04b 承接

- [phase1-R-01] R3 → completeness passed=false（Required×2）/ reliability / security passed=true
- [phase1-G-02] G preventive-gate → **exit 1**（真实拦截 #1：R3 Required findings 阻断）→ 触发普通 V/G 失败链（R→V→G→S-fix→R3(fix)→V→G）

- [phase1-R-02] R → RC-phase1-1-01（process-missing，rollback=false）
- [phase1-V-01] V 复审 → A/0.888 通过
- [phase1-G-03] G → rootcause-report=0 / verifier-output=**1**（拦截 #2：rawScores 等差构造）→ V 重发自有产物（D-2 规则，无 S-fix）

- [phase1-R-03] R3(fix)+standard → 全 passed=true
- [phase1-G-04] G preventive 双变体 → 0/0
- [phase1-V-02] V 主评审 → **B/0.8493 passed=false**（拦截 #3：traceability-matrix REQ-002 漏 UAT-002/003）→ 失败链 round 2

## 阶段 1 收口（2026-09-23，第 115-120 条）

- [phase1-CLOSED] 阶段 1 需求分析放行：checkpoint release p1-O-checkpoint-01（run-log 第 116→重排后末条）· project.status=系统设计
- 终验绿：G-21 check-checkpoint=0 + check-run-log=0（R11 checkedGates=1/missing=0）；G-17 闭环五门禁 0；G-18 signature-chain pre-checkpoint=0（43 环 R1-R10）；G-15/15b 主电池 6/6
- 失败链总计：6 次产品/评审拦截（#1 R3 Required、#2/#5a/#7 rawScores 构造×3、#3 REQ-002 验收关联、#4b/c D6+sync7、#5b cfg 聚合器、#6 V 复审输出构造、#7 O3 叙述 evidence）+ 冰山 1 Required（IF-phase1-1-01）+ 闭环拦截 #8-#14（簿记族）——全部 R→V→G→S-fix 闭环，无跳 R 返工
- 终态：run-log 120 条（checkpoint 末条）· 签名链 43 环 · V 终态 A/0.9258 · R3 双变体零 Required · ICEBERG-B 收敛（newFindings=[]）

Ruling: 簿记修正 #1-#4（operational-recovery §5.2，wm-write 备份在案，全量披露）——#1 run-log 去重（15 条 R3 标准刷新条目移除：同分派双套记录致「恰一条」违例）+ #1b 冰山条目重分类 action=rootcause→iceberg-sweep（2 条）+ #1c V 复审条目补 target 字段（7 条）+ #2 r043 环 sourceArtifacts 路径基准修正（R8 项目根解析）+ #3 放行条目决策 #4/#5 补阶段主题词/ID + estimated=true + #4 D-6 自举重排（G-19/G-20 四条 gate 记录重对齐至放行前窗口，checkpoint 末条不变量）——若错（簿记掩盖真实缺陷），代价为审计复核时对照 gate-logs 与 handoff 全量原始证据可还原。

Ruling: 阶段 1 🔴 CHECKPOINT 代行放行（用户授权编排者代行，非本人确认）——判据=主电池终轮全绿 + V A 级无 Mandatory + R3 双变体零 Required + ICEBERG-B 收敛 + RTM 100%；非阻断遗留全量登记（checkpoint-log/phase-1.txt）。若错（放行过早），代价为阶段 2 图谱演进时暴露并回退阶段 1。

Ruling: 三个门禁口径发现（登记技能包反馈与调测报告，非本轮修复）——(1) check-run-log R6 --gate-logs 对账要求 gateLogPath 指向 JSON 而本轮语义 .log 惯例（含 exit=N 文本）不被解析，闭环以无 --gate-logs 口径出记录 (2) check-maturity R5 O_PATTERN(\bO[1-6]\b) 与 check-verifier-output 的 O3 证据文法规则编号命名冲突（4 次命中全为规则引用），且 R5 无评估记录豁免通道，闭环以无 --run-log 口径出记录 (3) check-iceberg-sweep R8「零发现但收敛集合为空」在阶段 1 结构性拦截（设计 ID 命名空间 SD/DD/INTF 自阶段 2 起才有），exit 1 存证放行 (4) R11 的 check-checkpoint「允许后置」文档口径与实现「须早于放行」分歧，D-6 自举重排按实现口径执行。

Ruling: Σtokens 预算超支如实登记——157M >> perPhase 20M（R6 若带 --run-log 即 blocking）：成因=逐条目重复归账惯例（R3 三条目各计全分派 tokens）放大 ~2x + 4 条失败链 × 全子代理分派的真实消耗；纠偏=阶段 2 起分派 tokens 只记一条（维度条目记 0），预算上限阶段 2 开始时按真实口径经 logged Ruling 重定。budget 闭环记录以静态口径（无 --run-log）出。

### 阶段 2-8 操作要点（接续必读）

- 每阶段链（2-4）：O(chunk 登记阶段分派) → A(evolve 图谱，消费 chunk 环) → S-doc/S-tla/S-bdd 产出 → R3×3(standard) → G preventive → V 主评审 → G 主电池(graph --phase=N --spec-dir + tla + bdd + verifier + coverage + artifact-gate) → 闭环七门禁 → checkpoint（同阶段 1 的 D-6 定序口径）
- 阶段 2 产物：docs/spec/phase2/{system-design.md 主 + traceability-matrix + uml-modeling 等 6 子文档，带 phase2 前缀？——R7/R8 spec-dir 匹配 *-system-design.md/*-traceability-matrix.md/*-uml-modeling.md}；S-doc 分派时给 S 读 templates + phase-1 终态产物 + SPEC.md
- TLA+ L2（tla/L2_counter_service.tla + .w-model/tla-manifest.json 追加 spec + sdCoverage）；BDD L2（features/L2/ + bdd-manifest 追加；注意 bdd-logic D6 事件抽取行末 ASCII 陷阱与 tla-logic :639 聚合器字面锚定 BusinessInvariant——不变式命名沿用权威名）
- run-log 记账新规：每分派 tokens/duration 只记首条目，companion 条目记 0（estimated=true）；outcome 枚举 fail（非 failure）；R3 每修窗口恰 3 条（fix 变体带 basedOnReport）；checkpoint release 前 gate 记录全部先于放行、放行后禁追加（G 终验记录只落 gate-logs）
- 签名链环照 r001-r043 形态（olog.py chain direct 模式）；环 prev 指向前环、sourceSigIds 指向被消费产物的环、路径一律 .w-model/ 或项目根相对
- 阶段 5-8 另加：codegraph 查询落盘（.w-model/codegraph-queries/）+ change-scope 绑定 demo git + superpowers 编码链（S-plan/S-coding/S-finalize ×3 stage + R3×9/V×3）+ code-TLA 一致性 + 真实 node:test 四级测试 + docs/changes/archive 归档
- 收尾：全量门禁电池复跑 + docs/debug/2026-09-23 报告（含全部 Ruling 与发现清单）+ demo-snapshots 证据保全

## 阶段 2 收口（2026-09-23）

- [phase2-CLOSED] 系统设计放行：p2-O-checkpoint-01（run-log 末条 166 条）· project.status=概要设计
- 终验绿：p2-G-05 主电池 6/6 首轮全绿；p2-G-06/07 闭环（budget updatedAt 刷新后 0；sigchain 64 环 0）；p2-G-09/10 checkpoint=0 + runlog=0（D-6 定序舞步第二次执行）
- 失败链 round 1：G-02 R3 Required（L1 头 @requirement 与 manifest 半改不一致）→ RC-phase2-1-01（简报措辞缺口为根因）→ V-01 拦截（JSON 缺 falsifiabilityCheck）→ R-02b 转写 → V-02 通过 → G-03b 暴露语义 5 条（schema 短路遮蔽）→ V-02c 消因 → G-03c 绿 → S-04 一行修复 → R3(fix) → G-04 双绿
- ICEBERG-B：IF-phase2-1-01 结构性发现（graph view 含 INTF vs tla/rtm 锁定 SD-only，checker deriveViewSets 设计缺陷，O 亲验代码锚属实）——登记技能包反馈，exit 1 存证放行
- 新口径发现：check-checkpoint R2 具体名词=R2 ID 模式判定（决策须含 SD-001 类 ID）；阶段 2 无 check-checkpoint 后置豁免（仅阶段 1 有），D-6 舞步每阶段都要跳

### 阶段 3 要点（概要设计）
- spec-dir 布局：{module}-interface-design.md 主 + interface-contract/glossary/traceability-matrix/behavior-spec/discipline-dod/uml-modeling（counter-api- 前缀，引用块文法同前）
- TLA+ L3（接口层）+ BDD L3；sdCoverage 仍锁 SD-only；rtm designDoc 增 INTF 引用（DoD 口径内）
- docs/integration-test-design.md（IT 用例承接 INTF 契约）
- A-evolve：graph 增 DD 节点？——阶段 3 图谱口径按 gate-logic phase-3 判据（INTF 为主，DD 属阶段 4）
- 收口后 project.status=详细设计

## 阶段 3 收口（2026-09-23）

- [phase3-CLOSED] 概要设计放行：p3-O-checkpoint-01（run-log 末条 203 条）· project.status=详细设计
- 主电池 5/6 首轮（verifier O3 第 5 次同族拦截→V-02 D-2 消因→复跑绿）；闭环经三次簿记级拦截收敛：#21 R10 fix 缺 revertEvidence（S-05 补建真实回滚证据）、#22 R2 级联断裂（改环后下游 prevSigHash 未重算——**教训：任何环内容修正必须级联重算至链尾**）、#23 R10 O 环须消费 G 环（尾段重建补 4 主电池 G 环 wm1-r078~081-G + r082-O）
- ICEBERG-B r1 Optional×1（behavior-spec:16 漂移）→ S-04 fix（重分类 produce→fix + R3(fix) + V-03 scoped 0.9482/A）→ r2 收敛 newFindings=[]（structural-r6-known 维持）
- 终验：p3-G-09b checkpoint=0 + p3-G-10 runlog=0（D-6 舞步第三次）

### 阶段 4 要点（详细设计）
- spec-dir 布局：{module}-detailed-design.md 主 + class-design/data-model/glossary/traceability-matrix/behavior-spec/discipline-dod（**无 uml-modeling**，PHASE_SPEC_LAYOUT[4]）
- TLA+ L4（单元级）+ BDD L4；rtm 增 unitTest 列口径（按 gate 判据）；docs/unit-test-design.md（UT 用例）
- A-evolve：graph 增 DD 节点（类/数据结构）——注意 viewSets 的 DD 命名空间（SD/DD/INTF）：DD 加入后 graph view 扩 DD，tla sdCoverage 锁 SD-only——**结构性 R6 会再现且扩 DD**，沿用 O 预裁定口径（structural-known 不计入 newFindings）
- 链环修正纪律：任何已入链条目内容修正→级联重算该环至链尾全部 prevSigHash+sigHash
- 收口后 project.status=编码实现

## 阶段 4 收口（2026-09-23）

- [phase4-CLOSED] 详细设计放行：p4-O-checkpoint-01（run-log 末条 243 条）· project.status=编码实现
- 主电池 5/6 首轮（verifier O3 第 7 次→V-04 消因→复跑绿）；失败链 round 1 闭合：V-01 Required（DD-002/003 L4 BDD 规格缺位）→ RC-phase4-1-01（O 组装层缺口，路径 b 豁免回写）→ V-02 通过 → S-04 豁免回写（红 7/7→绿 16/16）→ R3(fix) → V-03 终态 0.917/A
- checkpoint 拦截 2×R2（决策 #2/#4 缺 ID）修正后绿；D-6 舞步第四次；终验 checkpoint=0 + runlog=0（243 条）
- wm-write 超时一次（120s 不够）：run-log 重写类操作 timeout 须 ≥240s

### 阶段 5 要点（编码实现）——形态与前四阶段不同
- 链：O(chunk) → S-plan（编码计划 docs/plans/<changeId>.plan.md + .superpowers/sdd/<plan>/progress.md 账本 + 任务三件套，R1-R6 判据 check-coding-plan.ts）→ S-coding（按 plan 任务节实施 src/counter.ts + routes；**写码前 codegraph 查询落盘 .w-model/codegraph-queries/**——codegraph CLI 若不可用则以制品级查询记录替代并登记）→ S-finalize（R3×9/V×3 stage 词表 plan/execute/finalize）→ G
- 主电池：check-verifier-output + check-code-tla-consistency --manifest --graph --rtm --src + check-artifact-gate --phase=5 --scope=.w-model/change-scope.p5.json（scope 绑定 demo git BASE..HEAD 实际差异；缺 scope → exit 1）
- 真实测试：UT-001~016 按 unit-test-design 用 node:test 真实执行（node --test），证据（command/exitCode/observedAt）回填 rtm/plan
- demo git：src/ test/ 需 git add 提交（BASE..HEAD 才有差异；git 基线 57e53d7）
- check-state-machine-consistency + check-design-contract-consistency（阶段 5 判据）按需跑
- 冰山/闭环/checkpoint 同前；收口后 project.status=集成测试

## 阶段 5 收口（2026-09-24）

- [phase5-CLOSED] 编码实现放行：p5-O-checkpoint-01（run-log 末条 325 条）· project.status=集成测试
- 主电池终轮 5/5（p5-G-10/p5-G-12）：coding-plan R1-R6、codegraph 5 查询 6/6、code-TLA 四维 converged（S-06 扩代码 815bbf4：L2/L3 Next 分支 10/10 命名覆盖+7 断言）、verifier 0.93368/A、artifact-gate --scope coverage 100%
- 失败链两轮 + 冰山一轮：G-01 五红（RC-5-1-01 四成因蓝图：scope 63 文件口径/查询 schema/回填面/cucumber 真实报告）→ G-07 g3 九违规（RC-5-2-01 design-flaw→扩代码）→ ICEBERG Required（IF-5-1-01 终态评审未覆盖新 HEAD→S-07 重跑+V-06 重出）
- 拦截总计 #27-#39（13 次）+ verifier 等差/O3 同族第 8/9 次；R9 双环重锚+级联重算、D-6 舞步第五次、R3 窗口九条报告补录（olog 单调覆盖教训：**回溯时间戳必须用位置插入脚本，olog append 会强制单调**）
- 终验：p5-G-17b checkpoint=0 + p5-G-18 runlog=0（325 条，R11 五脚本齐）

### 阶段 6 要点（集成测试执行）
- 真实 HTTP IT：IT-001~005（docs/integration-test-design.md）对 src/server.ts 真实起服（port 0）+ HTTP 客户端执行；产物 .w-model/it/（结果 JSON：command/exitCode/observedAt/断言明细）
- change-scope.p6.json：changeId=phase6-counter-api、BASE=815bbf4（当前 HEAD）、changedFiles=test/it 或 src 增量（IT 执行不改 src——若仅增测试/执行器，scope=新增文件；git add+commit）
- G 电池：check-verifier-output（phase-6 终态评审）+ check-artifact-gate --phase=6 --scope + check-bdd-model（cucumber 报告——阶段 6 强制 D5）+ check-requirement-coverage
- 冰山/闭环/checkpoint 同前；收口后 project.status=系统测试
- rtm.json integrationTest 列已有 IT-001~005（S-03 补登）——执行后回填 observed 结果

## 阶段 6 收口（2026-09-25）

- [phase6-CLOSED] 集成测试放行：p6-O-checkpoint-01（run-log 末条 368 条）· project.status=系统测试
- 主电池终轮 4/4（p6-G-04/p6-G-06）：verifier 0.9573/A、bdd-model D1-D8 全零（cucumber D5 强制 26/26/178/178）、coverage 100%、artifact-gate --phase=6 --scope 全 ✓
- 失败链 round 1：G-01 四红（bdd 参数误[O 简报]/rtm 越界键/查询缺/coding-plan 缺——RC-6-1-01 裁定 5-8 每阶段全 R3×9+V×3 无缩减）→ S-02 蓝图批 → 冰山 Required（IF-6-1-01 reviewedAt 物理不可能→V-03 真实时刻重发）→ verifier O3 第 11 次 → r2 收敛
- 闭环三次簿记收敛：R8 首条 R3 晚于首条 V（trio 重排披露）、R9 r140-V 消费 R（重锚 S 产物+级联）、R11 preventive 缺成功记录（G-14 补录 1ms 窗）
- **教训沉淀**：(1) olog append 强制单调——回溯/重排一律用位置插入脚本 (2) checkpoint 决策每条须含 ID_PATTERNS（REQ-/SD-/INTF-/DD-/TC-）或 TECH_KEYWORDS——分派模板预置 (3) 5-8 每阶段预置编码链全组（plan+R3×9+V×3+scope+codegraph） (4) V 产分数禁等差/禁完美/禁回填时间戳——V 简报模板加入"真实时刻+离散分数"硬约束
- 终验：p6-G-10b checkpoint=0 + p6-G-11 runlog=0（368 条）

### 阶段 7 要点（系统测试执行）
- 真实 ST：ST-001~005（docs/system-test-design.md）真实执行 + P95 实测（NFR-001：1000 次/端点、串行、P95 ≤250ms 测试基线口径）——进程内计时
- 产物：test/system/st-runner.mjs + .w-model/st/results.json + evidence log + change-scope.p7.json（changeId=phase7-counter-api）+ rtm systemTest observed 回填
- **预置编码链全组**（plan 制品组+R3×9+V×3）+ scope + codegraph 查询（一次 S 分派产出，避免阶段 6 的失败链重演）
- G 电池：verifier + bdd（cucumber D5）+ coverage + artifact-gate --phase=7 --scope；闭环 + checkpoint（决策每条带 ID）+ D-6 舞步；收口后 project.status=验收测试

## 阶段 7 收口（2026-09-25）

- [phase7-CLOSED] 系统测试放行：p7-O-checkpoint-01（run-log 末条 403 条）· project.status=验收测试
- 主电池 3/4 首轮 + verifier 两轮消因复跑绿（p7-G-03）：verifier 0.9634/A、bdd-model D1-D8 全零（cucumber 26/26）、coverage 100%、artifact-gate --phase=7 --scope 全 ✓
- 拦截 #45-#48（4 次）：verifier schema/等差+O3 同族第 12 次、R8 九条 R3 报告补录、R1 时序；checkpoint 决策预置 ID 首轮绿
- 冰山首轮收敛（IS-phase7-1-01 newFindings=[]）；P95 实测 0.300/0.199/0.186ms ≪250ms 基线；V 三项偏离裁定成立（hrtime 等价/package.json 追认/执行器迭代追认；UAT-006 回归约束移交阶段 8）
- R11 自指最终形态：check-run-log 自身成功记录须先于放行——插入后复跑验证（D-6 自举变体，gate-logs/p7-G-07/08 双录）
- 终验：p7-G-05 checkpoint=0（首轮）+ p7-G-07 runlog=0（403 条）

### 阶段 8 要点（验收测试 + 归档 + 终检）——最后阶段
- 链：O chunk → S 产出（UAT-001~007 真实执行 + UAT 路径映射核对 + 归档 docs/changes/archive/<date>-phase8-*/ + opsx 变更记录）→ V → G（artifact-gate --phase=8 --scope + archive-integrity + bdd cucumber）→ 闭环 → 终 checkpoint（project.status=项目完成）
- UAT-006 注意：V-01 裁定 UAT-006 须回归冻结工具口径（autocannon 原判据）——若 autocannon 不可用（零 npm），按 V 裁定的等价口径执行并在 UAT 记录中披露裁定链
- UAT-007：锁文件确认（package.json dependencies={} + npm ls 0 包）
- 归档：docs/changes/archive/2026-09-25-phase8-counter-api-validation/（7 文件：README/summary/run-log 快照/signature-chain 快照/gate-logs 清单/rtm 快照/结论）→ check-archive-integrity
- artifact-gate --phase=8 --scope=.w-model/change-scope.p8.json + archive-integrity 双门
- coding-plan phase8 全组（plan+R3×9+V×3）+ scope.p8 + codegraph phase8 查询——预置全组一次产出
- 终 checkpoint：project.status=项目完成；随后收尾（全量电池复跑+调测报告+证据保全）
