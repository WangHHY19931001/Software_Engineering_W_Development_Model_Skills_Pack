# 反例与黑名单（Anti-Patterns）

> W 模型执行中真实高发陷阱。命中任一条即视为流程破坏，必须回退到对应阶段起点。
>
> 本文件由 [`w-model-dev/SKILL.md`](../SKILL.md) 的“反例与黑名单”节拆出，供 Agent 在阶段门评审前对照核验。

## 目录

- 反模式清单（#1~#46；#20 在 subagent-delegation.md；#30 第 20 轮新增；#33~#41 见各 detailed 节；#42 第 29 轮新增；#43 第三十一轮新增；#44 第 36 轮新增；#45/#46 第 39 轮新增）
- 命中高发阶段
- 与门禁脚本的对应关系
- 检测信号与回退动作
- 实现层经验教训（代码层 L1~L4）
- 失败模式清单（10 条行为退化 F1~F10）
- 运维失败模式清单（6 条运行健康 O1~O6）
- 候选反模式检测信号（来自 Loop 4 爬坡循环）

## 反模式清单

| # | 反模式（不要做） | 危害 | 正确做法 |
|---|---|---|---|
| 1 | 跳过阶段门评审"直接进入下一阶段" | 缺陷后移，测试前置失效 | 必须按 SKILL.md「阶段门与质量门」节走完评审 + 🔴 CHECKPOINT 放行 |
| 2 | 将测试设计后置到编码之后 | 破坏 W 模型并行原则，测试失去前置发现能力 | 进入开发阶段时同步产出对应测试设计（见并行对应表） |
| 3 | 用 LLM 自行"估算"质量门结果 | 估算不可信，RTM 覆盖率 / 测试通过状态会被编造 | 必须执行 [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)，以退出码 + GATE_JSON 为准 |
| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评。V/G 不通过后，未经 R 定位直接小修也命中 #4。修复路径必须经 R→V→G→S-fix |
| 5 | 一次性载入全部 `references/` 或违反 Bundled Resources 表 | 上下文污染，阶段聚焦丢失 | 按 [SKILL.md](../SKILL.md)「Bundled Resources」表按需加载 |
| 6 | 用 LLM 估算 RTM 覆盖率 | RTM 覆盖率造假，追溯链断裂 | 实际核验 RTM 登记项，RTM 覆盖率必须 100% |
| 7 | 质量门脚本退出码 1/2 时放行发布 | 缺陷带病上线 | 退出码非 0 一律回到编码实现，附 GATE_JSON 详情 |
| 8 | 越过 🔴 CHECKPOINT 自动推进 | 用户失去决策权，自主失控 | 到达 CHECKPOINT 必须暂停等用户确认 |
| 9 | 谎报阶段状态（未完成标为完成） | 阶段门依赖断裂，下游全部失真 | `status` 字段如实反映，未完成不得推进 |
| 10 | 编排者越权实施（写代码 / 改文档 / 产出评审 JSON / 改 RTM 实体 / 生成测试用例 / 越权做根因分析） | 编排者上下文污染、评审独立性丧失、状态机失真、违反「技能不内置 LLM」架构原则；编排者直接判定根因并分派 S-fix 会绕过 R 独立定位 | 编排者仅分派 S / V / G / R 子代理执行实施动作；自身只做路由 + 状态 + CHECKPOINT + 只读脚本（见 [subagent-delegation.md](subagent-delegation.md)）。检测信号 6：编排者会话出现 rootCauseChain / rootCause 等 RootCauseReport 字段；信号 7：编排者直接判定根因并分派 S-fix（无 R 报告路径作为 S-fix 输入） |
| 11 | ingestion 跳过图谱校验 | 阶段 1-4 结构连通性失守，孤立 / 多根 / 追溯断裂带入编码，graph.json 形同虚设 | 阶段 1-4 必须跑 [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)，不得跳过 A→G 收敛循环（见 [graph-guide.md](graph-guide.md)） |
| 12 | A 子代理自评收敛（用 LLM 输出判定收敛） | "LLM 估算质量门"在 ingestion 场景的变体，收敛判定漂移 | 收敛判定由 G 跑 `check-requirement-graph.ts` 退出码决定，A 的 `reworkHints` 仅作指引。A 子流程返工也须走 R 定位（图谱/TLA+ 返工同样适用 R 循环），禁止 A 自评根因 |
| 13 | ingestion 图谱信息流黑洞/奇迹/死模块放行 | 存在只进不出/只出不进/无流经的模块，信息闭合失守，结构追溯通过却仍有信息断点带入编码 | 阶段 1-4 必须通过 [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts) 信息流校验（无黑洞/奇迹/死模块 + 边界完整），退出码 0 才放行（见 [graph-guide.md](graph-guide.md)「信息流模型」节） |
| 14 | TLA+ 语法检查未通过即跑 TLC / 跳过语法检查 | TLC 报错信息混乱，无法定位是语法还是语义问题，调试效率崩溃 | `check-tla-model.ts` 步骤 6→7 顺序强制：SANY 语法通过后才允许跑 TLC（见 [tla-plus-guide.md](tla-plus-guide.md)「编码调试顺序」节） |
| 15 | TLA+ 死锁/状态爆炸/不变式违反放行 | 行为正确性失守，并发/时序缺陷带入编码，后期修复成本指数级上升 | 阶段 1-4 必须通过 [`check-tla-model.ts`](../scripts/check-tla-model.ts) 行为门禁（无死锁/不变式违反/状态爆炸），退出码 0 才放行 |
| 16 | TLA+ 占位实现/简化实现/错误实现 | 规格形同虚设，无法作为正确性基准，TLA+ 门禁沦为橡皮图章 | V 评审标注 + G 门禁：不接受 `Next=[]` 空下一步 / 遗漏需求关键状态 / 不变式与设计矛盾（见 [tla-plus-guide.md](tla-plus-guide.md)「合规性约束」节） |
| 17 | TLA+ 建模与需求/设计不符未回退 | 规格通过但与需求/设计脱节，或需求/设计本身缺陷被掩盖，问题后移到编码 | 规格忠实于需求/设计但 TLC 仍发现违反 → 修正需求/设计并回退重跑；规格偏离 → 修正规格重跑（见 [tla-plus-guide.md](tla-plus-guide.md)「建模与需求/设计一致性」节） |
| 18 | 跳过 R 直接分派 S 返工（V/G 不通过后直接 S-fix，未经 R 根因定位） | 修复针对症状不针对根因，同问题反复出现；缺陷链未追溯，上游缺陷被掩盖 | V/G 不通过 → 必须先分派 R 定位 → V 复审根因 → G 门禁 → S-fix 携 R 报告修复（见 [root-cause-locator.md](root-cause-locator.md)） |
| 19 | R 报告未经 V 复审直接交 S 修复 | 根因准确性无独立保证，S 基于错误根因修复，浪费一轮返工 | R 产出后必须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix |
| 20 | 只规划不执行（子代理返回规划性内容而未调用任何执行工具） | 浪费 token + 轮次，任务无实际进展 | 子代理分派须强调"立即执行"；规划产物必须有对应执行产物（见 [subagent-delegation.md](subagent-delegation.md)「反模式 #20」节） |
| 21 | 阶段级门禁跳过（self-as-verifier 模式下跳过阶段 6/7 的 `--phase=N` 直接跑 `--phase=8` 终检） | 阶段级字段缺失（如 REQ 行 `systemTest`）到终检才发现，违反"早发现早修复"原则 | 阶段 6/7/8 完成时必须跑对应 `--phase=6`/`--phase=7`/`--phase=8`，不得跳过（见 [SKILL.md](../SKILL.md)「阶段 5-8 工件质量门」节） |
| 22 | 角色越权（`authRequired` 仅校验 token 存在未校验角色） | 越权缺陷带入运行时，`security-auditor` persona 无 phase-5 检查项可依，第 15 轮 P7-001 reader 可发博文 | 路由层或控制器入口必须显式校验 `requiredRole`，token 解码后断言 `token.role ∈ requiredRoles`，否则返回 403（见 [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节） |
| 23 | 跨模块 store 误用（跨模块调用时 store 选择与 schema 不一致） | 跨模块数据流缺陷在系统测试才发现，修复成本高，第 15 轮 P7-002/P7-003 类 | 跨模块调用时数据源选择须在 phase-3 接口设计显式声明，与 schema 一致（见 [phase-3-outline-design.md](phase-3-outline-design.md)「跨模块数据源选择约束」节） |
| 24 | 副作用时序不一致（响应体字段返回副作用自增前的旧值） | 响应体字段与已生效状态不一致，集成测试难发现，第 15 轮 P7-004 类 | 副作用须在响应体构造前完成，响应体字段反映已生效状态（见 [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节） |
| 25 | JSON 文件写入用 PowerShell `ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content` | BOM + 深度 + 中文乱码，阶段 5/6/7/8 多次返工（第 15 轮共性问题 A） | 必须用 Node.js `fs.writeFileSync(path, content, 'utf-8')` 写 JSON（见 [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节） |
| 26 | RunLogEntry 与 EventIngress 字段混用（`run-log.jsonl` 含 `eventId`/`eventType`/`source`/`summary` 等 EventIngress 字段，或误将 RunLogEntry 的 `acknowledgedDecisions` 字段归到 EventIngress） | schema 漂移，R1 动作完整性校验失败（第 15 轮共性问题 B） | `run-log.jsonl` 须用 `runId`/`action`/`role`/`outcome`/`acknowledgedDecisions`，`event-ingress.jsonl` 须用 `eventId`/`eventType`/`source`/`summary`（见 [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节） |
| 27 | 调测者简化行为（上下文压缩丢细节 / 追求效率省步骤 / 未对照硬约束核验） | self-as-verifier 模式下无外部评审拦截简化行为，硬约束遗漏带入归档 | 调测者须按 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节自检清单逐条核验（含 3 类简化倾向 S1/S2/S3 + 5 项自检条目） |
| 28 | schema 前置校验缺失（`*-logic.ts` 校验函数未先调用 `validateBySchema`，结构错误直接进入业务规则校验） | 结构性错误（字段缺失 / 类型错误 / 未知字段）抛 TypeError 或返回模糊错误，Agent 无法区分"结构错误"vs"业务规则违反"，修正方向不明 | `*-logic.ts` 校验函数入口必须先调用 `validateBySchema(name, input)`，失败时以 `[schema]` 前缀返回错误；同步在 `schemas/` 目录维护对应 schema 文件（见 [data-models.md](data-models.md)「JSON Schema 强约束」节 schema 清单 20 份） |
| 29 | BDD 建模与需求/设计/TLA+ 不符未回退 | BDD 规格形同虚设，与 TLA+ 行为规格不一致或与需求/设计脱节，问题后移到编码或测试执行阶段 | BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑（仿反模式 #17）；BDD↔TLA+ 不等价时必须走 R→V→G→S-fix 循环，不得直接放行；接受措辞不同但实质一致的等价性（由 R 子代理判定 + V 子代理验证）；实质不一致必须上报人类决策，提供修正 BDD / 修正 TLA+ / 修正需求设计三个可选项（见 [bdd-guide.md](bdd-guide.md)「不符处理流程」节） |
| 30 | 豁免审批跳步（第 20 轮新增） | 覆盖缺失 / conflicts-with 冲突 / 覆盖率不达标等豁免项未经 S→R→V→人类四阶段流程即生效，需求遗漏被豁免掩盖，治理失守 | 任何豁免必须按 S 提出 exemption-request.json → R 审查（5-Why/上游回溯/可证伪性）exemption-review.json → V 校验 exemption-verification.json → 人类 CHECKPOINT 确认 → check-exemption E1-E8 全通过 → approve 写入 granted.json。典型违规：S 自行声明豁免生效 / R 直接批准 / V 跳过 / 编排者代签人类确认（见 [phase-1-requirements.md](phase-1-requirements.md)「豁免审批治理」节 + FM-EXEMPT-01~05） |
| 31 | 归档完整性缺失（归档未含阶段强制快照清单文件） | 事后无法审计 V 评审声明真实性，审计链断裂 | 归档须含全部强制产出文档，`check-archive-integrity.ts` 退出码 0（见 SSoT §10B.2.1 归档完整性清单） |
| 32 | 签名链断裂（跳过角色 / 签名不连续 / 代签 checkpoint / 来源缺失） | 流程完整性失守，审计链断裂 | 补齐缺失角色签名与来源证明，`check-signature-chain.ts` R1-R10 全通过（见 [signature-chain-guide.md](signature-chain-guide.md)） |
| 33 | 跳过 R3 预防性审查（第29轮强化为无条件，覆盖所有 S 变体含 S-fix / S-emergency-fix） | S 产出后未触发 R3 三阶段审查，直接进入 V 评审 | 回到 S 产出后起点，补跑 R3×3 + V |
| 34 | 编排者漏派角色（未按约束 #19 分派 S/V/G/R，含 self-as-verifier 兼任未产出独立产物） | 评审 / 门禁 / 根因定位环节缺失，流程完整性失守 | 每阶段分派 S/V/G 各 ≥1 次、R ≥3 次；`check-role-dispatch.ts` 校验（见约束 #19） |
| 35 | self-as-verifier 模式下 V/G/R 产物混合（含 R3 三份报告与 S 产出同路径） | 评审独立性失守，结论可能被 S 产出污染或覆盖 | 各角色独立产物文件且路径互不相同；`check-verifier-output.ts --self-as-verifier` 校验 V 产物与 S 产出路径不同 |
| 36 | 路由顺序错误（参数路径先于静态路径注册，如 `/users/:id` 拦截 `/users/me`；鉴权路由在公开路由之后） | 路由匹配错误、鉴权失效，越权缺陷带入运行时 | 静态路径先于参数路径注册，鉴权中间件在公开路由前；修正后重跑集成测试（无自动脚本，V/G 人工校验） |
| 37 | 产物膨胀但核心决策稀疏（文件达标但实体引用密度低、核心决策被扩展点淹没） | 稀释产物语义价值，评审难以聚焦 | 精简扩展点/附录，实体引用密度 ≥ 2/章节（V 评审人工校验信息密度） |
| 38 | 修改前未查询 codegraph（阶段 5-8 S-coding 直接修改代码/测试文件） | 误改被广泛依赖符号，引入隐蔽回归 | 修改前先 `codegraph_explore` 查询影响半径并落盘 `.w-model/codegraph-queries/`；`check-codegraph-queries.ts` 校验（约束 #20） |
| 39 | 跳过 opsx 产物审查（opsx 三段式任一 stage 产物未 R3×3 + V 即进入下一步） | 规划缺陷 / 实现偏差未被发现 | 每段产物补跑 R3×3 + V；`check-opsx-artifacts.ts` 校验（约束 #17） |
| 40 | opsx/S-tickets 职责混淆（tasks.md 与 tickets.md 互相替代或内容错位） | 破坏规格级规划（what/why）与代码级切片（how）职责边界 | tasks.md（opsx:propose）与 tickets.md（S-tickets vertical-slice）职责分离；`check-opsx-artifacts.ts` 校验 |
| 41 | 加权平均掩盖单轴失败（compositeScore 达标但存在 subCriterion.score < 0.70） | 单轴缺陷被平均抹平，需求遗漏/分析缺失放行 | passed 判据收紧为 `(A\|\|B) && 所有 subCriterion.score ≥ 0.70`；`check-verifier-output.ts` R13 单轴下限校验 |
| 42 | S-fix / emergency-fix 后跳过 R3+V（第29轮新增） | S-fix / S-emergency-fix 产出后未派 R3×3 + V 直接 G/放行，修复未经验证合入 | 回到 S-fix / emergency-fix 产出后起点，补跑 R3×3 + V |
| 43 | 敏感信息写入状态文件/日志（`.w-model/*.json` / gate-logs / run-log / 模板示例含真实凭据） | 凭据泄露风险，随仓库分发/归档/CI 扩散 | 敏感配置统一环境变量注入，数据文件与模板只存引用名（如 `${JWT_SECRET}`）；V/G 人工核验 + `security-scan.ts` 源码级扫描（SSoT §3.4.27） |
| 44 | 跳过冰山扫掠直接放行（S-fix 后或阶段门放行前未分派 R-iceberg，或冰山新问题未经 V 复审直接放行，第36轮新增） | 水面之下的同根因扩散/同缺陷类/修复引入回归/相邻逻辑隐患被掩盖，缺陷后移 | S-fix 后必须 ICEBERG-A、阶段门前必须 ICEBERG-B；新问题须经 V 复审后走标准 R→V→G→S-fix；`newFindings=[]` 或达 maxIcebergRounds=5 才放行（SSoT §3.4.34） |
| 45 | subagent 为通过测试/门禁而修改测试断言、测试期望或验收判据（反指标游戏，第39轮新增） | "通过"失去与需求的对应关系，覆盖率与断言语义脱节，Goodhart 击穿判据 | 测试断言修改必须先行报告；断言与需求不符走 R→V→G 归因，禁止擅自改断言凑通过（SSoT §3.4.39） |
| 46 | 只给审计权不给修正权（全自动流程把用户锁在"跑完再看"之外，第39轮新增） | 你能诊断无法治疗；判据持有主体缺位，产物只是采样 | 人在回路最低标准=修正权：能在过程中间改产物而不用整体重跑；CHECKPOINT 显式标注介入路径（SSoT §3.4.39） |

### 命中高发阶段

| 反模式 | 最易命中阶段 | 阶段指引 |
|---|---|---|
| #1（跳过评审） | 全阶段 | 各 phase-N「阶段门评审」节 |
| #2（测试设计后置） | 阶段 1~4 | 各 phase-N「并行任务（强制）」节 |
| #3（估算质量门） | 阶段 5~7 | [phase-5-coding.md](phase-5-coding.md) / [phase-7-system-test.md](phase-7-system-test.md) |
| #4（评审未通过悄悄小修） | 全阶段 | 各 phase-N「返工路径」节 |
| #5（一次性载入全部 references） | 全阶段 | SKILL.md「不可违反的约束」第 6 条「按需加载」 |
| #6（估算 RTM 覆盖率） | 阶段 7~8 | [phase-7-system-test.md](phase-7-system-test.md) / [phase-8-acceptance-test.md](phase-8-acceptance-test.md) |
| #7（退出码 1/2 放行） | 阶段 5~7 | [quality-standards.md](quality-standards.md)「质量门检查清单」 |
| #8（越过 CHECKPOINT） | 全阶段 | 各 phase-N「🔴 CHECKPOINT」标记 |
| #9（谎报状态） | 全阶段 | [data-models.md](data-models.md)「项目数据模型」 |
| #10（编排者越权实施） | 全阶段 | [subagent-delegation.md](subagent-delegation.md)「强制约束」节 + SKILL.md「不可违反的约束」第 8 条 |
| #11（ingestion 跳过图谱校验） | 阶段 1~4 | [graph-guide.md](graph-guide.md) + [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) |
| #12（A 自评收敛） | 阶段 1~4 | [graph-guide.md](graph-guide.md)「收敛准则」节 |
| #13（信息流黑洞/奇迹放行） | 阶段 1~4 | [graph-guide.md](graph-guide.md)「信息流模型」节 |
| #14（TLA+ 跳过语法检查） | 阶段 1~4 | [tla-plus-guide.md](tla-plus-guide.md)「编码调试顺序」节 |
| #15（TLA+ 死锁/违反放行） | 阶段 1~4 | [tla-plus-guide.md](tla-plus-guide.md)「校验脚本」节 |
| #16（TLA+ 占位/简化/错误实现） | 阶段 1~4 | [tla-plus-guide.md](tla-plus-guide.md)「合规性约束」节 |
| #17（TLA+ 与需求/设计不符未回退） | 阶段 1~4 | [tla-plus-guide.md](tla-plus-guide.md)「建模与需求/设计一致性」节 |
| #18（跳过 R 直接 S 返工） | 全阶段 | [root-cause-locator.md](root-cause-locator.md) + 各 phase-N「返工路径」节 |
| #19（R 报告未 V 复审） | 全阶段 | [root-cause-locator.md](root-cause-locator.md)「R 产出质量标准」节 |
| #21（阶段级门禁跳过） | 阶段 6/7/8 | [SKILL.md](../SKILL.md)「阶段 5-8 工件质量门」节 |
| #22（角色越权） | 阶段 5 | [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节 |
| #23（跨模块 store 误用） | 阶段 3/4 | [phase-3-outline-design.md](phase-3-outline-design.md)「跨模块数据源选择约束」节 |
| #24（副作用时序不一致） | 阶段 5 | [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节 |
| #25（JSON 文件 PowerShell 写入） | 阶段 5/6/7/8 | [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节 |
| #26（RunLogEntry 与 EventIngress 字段混用） | 阶段 1/6/7/8 | [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节 |
| #27（调测者简化行为） | 阶段 1-8（self-as-verifier 模式全阶段） | [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节 |
| #28（schema 前置校验缺失） | 阶段 1-8（所有 `*-logic.ts` 校验入口） | [data-models.md](data-models.md)「JSON Schema 强约束」节 |
| #29（BDD 建模不符未回退） | 阶段 1-4 | [bdd-guide.md](bdd-guide.md)「不符处理流程」节 |
| #30（豁免审批跳步） | 阶段 1（需求分析，四维识别豁免） | [phase-1-requirements.md](phase-1-requirements.md)「豁免审批治理」节 + FM-EXEMPT-01~05 |
| #31（归档完整性缺失） | 阶段 8（归档） | [phase-8-acceptance-test.md](phase-8-acceptance-test.md) + [`check-archive-integrity.ts`](../scripts/check-archive-integrity.ts) |
| #32（签名链断裂） | 全阶段 | [signature-chain-guide.md](signature-chain-guide.md) + [`check-signature-chain.ts`](../scripts/check-signature-chain.ts) |
| #33（跳过 R3 预防性审查） | 全阶段（所有 S 变体） | 约束 #17 + [`check-preventive-review.ts`](../scripts/check-preventive-review.ts) |
| #34（编排者漏派角色） | 全阶段 | 约束 #19 + [`check-role-dispatch.ts`](../scripts/check-role-dispatch.ts) |
| #35（self-as-verifier 产物混合） | 全阶段（self-as-verifier 模式） | SKILL.md「self-as-verifier 模式」节 |
| #36（路由顺序错误） | 阶段 5/6 | [phase-5-coding.md](phase-5-coding.md) + 集成测试用例 |
| #37（产物膨胀核心决策稀疏） | 阶段 1-4 | 各 phase-N「产物要求」节 |
| #38（修改前未查询 codegraph） | 阶段 5-8 | 约束 #20 + [`check-codegraph-queries.ts`](../scripts/check-codegraph-queries.ts) |
| #39（跳过 opsx 产物审查） | 阶段 5-8 | 约束 #17 + [`check-opsx-artifacts.ts`](../scripts/check-opsx-artifacts.ts) |
| #40（opsx/S-tickets 职责混淆） | 阶段 5-8 | [phase-5-coding.md](phase-5-coding.md)「OpenSpec opsx 三段式 S 分派」节 |
| #41（加权平均掩盖单轴失败） | 全阶段（V 评审） | [verifier-spec.md](verifier-spec.md) §3.3 / §6.3 |
| #42（S-fix 后跳过 R3+V） | 全阶段（返工） | 约束 #17/#19 + [`check-preventive-review.ts`](../scripts/check-preventive-review.ts) `--variant=fix\|emergency` |
| #43（敏感信息写入状态文件） | 全阶段 | [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节 |
| #44（跳过冰山扫掠直接放行） | 全阶段（S-fix 后 + 阶段门前） | [iceberg-sweep-guide.md](iceberg-sweep-guide.md) + [`check-iceberg-sweep.ts`](../scripts/check-iceberg-sweep.ts) |
| #45（为通过测试而修改断言/测试期望） | 阶段门评审 / V 评审 | V 评审人工核验断言与需求对应关系（反指标游戏，Goodhart） |
| #46（只给审计权不给修正权） | 全流程 | CHECKPOINT 显式标注介入路径（外科手术录像回放） |

## 与门禁脚本的对应关系

| 反模式 | 由哪个脚本 / 机制守护 |
|---|---|
| #1（跳过评审） | SKILL.md「阶段门与质量门」节 + 🔴 CHECKPOINT · 阶段门放行 |
| #2（测试设计后置） | SKILL.md「不可违反的约束」第 1 条「测试设计前置」 |
| #3 / #6（估算质量门 / RTM 覆盖率） | [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts)（退出码 0 才算通过） |
| #4（评审未通过悄悄小修） | [`check-verifier-output.ts`](../scripts/check-verifier-output.ts)（rework 闭环校验） |
| #5（一次性载入全部 references） | SKILL.md「不可违反的约束」第 6 条「按需加载」 |
| #7（退出码 1/2 放行） | 🔴 CHECKPOINT · 发布放行（明确「退出码 1/2 一律不得放行」） |
| #8（越过 CHECKPOINT） | 🔴 CHECKPOINT 视觉标记（Agent 扫描锚点） |
| #9（谎报状态） | [data-models.md](data-models.md)「项目数据模型」+ `status` 字段约束 |
| #10（编排者越权实施） | [subagent-delegation.md](subagent-delegation.md)「强制约束」节 + 编排者自身动作清单（O/S/V/G 角色表） |
| #11（ingestion 跳过图谱校验） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)（退出码 0 才算通过）+ 🔴 CHECKPOINT · ingestion 收敛确认 |
| #12（A 自评收敛） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts) 退出码（A 的 `reworkHints` 不替代 G 判定） |
| #13（信息流黑洞/奇迹放行） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)（`dataflowViolations` 全空 + `boundary.complete=true` 才退出码 0） |
| #14（TLA+ 跳过语法检查） | [`check-tla-model.ts`](../scripts/check-tla-model.ts) 步骤 6→7 顺序强制（SANY 通过后才跑 TLC） |
| #15（TLA+ 死锁/违反放行） | [`check-tla-model.ts`](../scripts/check-tla-model.ts)（`TLA_JSON.passed=true` 才退出码 0） |
| #16（TLA+ 占位/简化/错误实现） | V 评审（`reworkHints` 标注）+ [`check-tla-model.ts`](../scripts/check-tla-model.ts)（拆解决策校验） |
| #17（TLA+ 与需求/设计不符未回退） | S 子代理核查 + 回退机制（无脚本；Agent 比对 `@requirement`/`@design` 与规格一致性） |
| #21（阶段级门禁跳过） | [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts) `--phase=N` 参数 + run-log R5 O 越权检测（编排者自检阶段 N 是否跑 `--phase=N`） |
| #22（角色越权） | V-code 评审（`reworkHints` 标注）+ 系统测试用例（越权场景应返回 403）+ [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节 |
| #23（跨模块 store 误用） | V-design 评审（`reworkHints` 标注）+ 集成测试用例（跨模块数据流）+ [phase-3-outline-design.md](phase-3-outline-design.md)「跨模块数据源选择约束」节 |
| #24（副作用时序不一致） | V-code 评审（`reworkHints` 标注）+ 系统测试用例（副作用与响应体一致性）+ [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节 |
| #25（JSON 文件 PowerShell 写入） | run-log.jsonl `note` 字段检测（"PowerShell" / "ConvertTo-Json" / "Add-Content" / "Out-File" / "Set-Content" 关键词）+ [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节 |
| #26（RunLogEntry 与 EventIngress 字段混用） | [`check-run-log.ts`](../scripts/check-run-log.ts) R1 动作完整性校验（字段不符 RunLogEntry schema 即失败）+ [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节 |
| #27（调测者简化行为） | run-log.jsonl 动作完整性（R1 缺 chunk/cross/review/gate 动作）+ checkpoint R2（acknowledgedDecisions 缺硬约束 ID）+ gate exitCode 一致性（R6 exitCode ≠ JSON passed）交叉检测 + [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节自检清单 |
| #28（schema 前置校验缺失） | [`schema-loader.ts`](../scripts/schema-loader.ts) `validateBySchema` 调用检测（`*-logic.ts` 入口未 import / 未调用即命中）+ 错误信息缺 `[schema]` 前缀检测 + [data-models.md](data-models.md)「JSON Schema 强约束」节 schema 清单（20 份） |
| #29（BDD 建模不符未回退） | [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) D4 等价性校验（退出码 0 才算通过） |
| #30（豁免审批跳步） | `check-exemption` E1-E8 全通过（豁免请求完整 / R 审查方法论齐全 / V 校验通过 / 人类确认记录存在 / 豁免理由非掩盖遗漏 / 影响范围已评估 / 替代方案已考虑 / 条件可落实）+ FM-EXEMPT-01~05 检测 |
| #31（归档完整性缺失） | [`check-archive-integrity.ts`](../scripts/check-archive-integrity.ts)（缺失任一阶段强制快照清单文件 → exitCode=1） |
| #32（签名链断裂） | [`check-signature-chain.ts`](../scripts/check-signature-chain.ts)（R1-R10 任一失败） |
| #33（跳过 R3 预防性审查） | [`check-preventive-review.ts`](../scripts/check-preventive-review.ts)（always-on）+ [`check-run-log.ts`](../scripts/check-run-log.ts) R8（S→V 间 R3 记录数） |
| #34（编排者漏派角色） | [`check-role-dispatch.ts`](../scripts/check-role-dispatch.ts)（每阶段 S/V/G ≥1、R ≥3 无条件） |
| #35（self-as-verifier 产物混合） | [`check-verifier-output.ts`](../scripts/check-verifier-output.ts) `--self-as-verifier`（V 产物与 S 产出路径不同）+ [`check-role-dispatch.ts`](../scripts/check-role-dispatch.ts) + [`check-preventive-review.ts`](../scripts/check-preventive-review.ts) |
| #36（路由顺序错误） | 无自动脚本（V 评审 + G 门禁人工校验路由注册顺序表） |
| #37（产物膨胀核心决策稀疏） | 无自动脚本（V 评审人工校验信息密度） |
| #38（修改前未查询 codegraph） | [`check-codegraph-queries.ts`](../scripts/check-codegraph-queries.ts)（查询落盘完整性，exitCode=1 命中） |
| #39（跳过 opsx 产物审查） | [`check-opsx-artifacts.ts`](../scripts/check-opsx-artifacts.ts)（opsx 制品 + R3×3 + V 审查齐全，exitCode=1 命中） |
| #40（opsx/S-tickets 职责混淆） | [`check-opsx-artifacts.ts`](../scripts/check-opsx-artifacts.ts)（tasks/tickets 职责校验，exitCode=1 命中） |
| #41（加权平均掩盖单轴失败） | [`check-verifier-output.ts`](../scripts/check-verifier-output.ts) R13 单轴下限（subCriterion.score < 0.70 → exitCode=1） |
| #42（S-fix 后跳过 R3+V） | [`check-run-log.ts`](../scripts/check-run-log.ts) R8（S(fix/emergency-fix)→V 间 R3 记录数）+ [`check-role-dispatch.ts`](../scripts/check-role-dispatch.ts) + [`check-preventive-review.ts`](../scripts/check-preventive-review.ts) `--variant=fix\|emergency` |
| #43（敏感信息写入状态文件） | 无专用脚本（V/G 人工核验 + [`security-scan.ts`](../scripts/security-scan.ts) 源码级扫描） |
| #44（跳过冰山扫掠直接放行） | [`check-iceberg-sweep.ts`](../scripts/check-iceberg-sweep.ts)（IcebergSweepReport R1-R8 校验，exitCode=1 命中）；run-log `iceberg-sweep` / `iceberg-review` 动作缺失检测为软检测（编排者自查 + V/G 人工核验，见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)「触发时机」节） |
| #45（为通过测试而修改断言/测试期望） | 无专用脚本（V 评审人工核验断言与需求对应关系） |
| #46（只给审计权不给修正权） | 无专用脚本（CHECKPOINT 介入路径标注） |

## 命中后的处理流程

1. **立即停止当前阶段推进**：不得继续产出或修改实体。
2. **回退到对应阶段起点**：根据反模式定位回退点（评审 → 重新评审 / 编码 → 返工 / 测试 → 重新执行）。
3. **告知用户**：在交互中明示命中的反模式编号与正确做法，由用户确认回退动作。
4. **记录教训**：在《测试报告》或《评审报告》的「备注」节记录命中的反模式，便于后续阶段避免重复。

## 检测信号与回退命令（指令具体性）

> Agent 自检「是否已命中反模式」的检测信号 + 命中后的具体回退命令。每条与门禁脚本退出码精确对应。

| # | 检测信号（Agent 自查） | 命中后回退命令 | 对应退出码 |
|---|---|---|---|
| #1 | 阶段产物已产出但无 `VerifierOutput` JSON 文件 / 未调用 `check-verifier-output.ts` | `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>`；JSON 不存在则重新执行评审 | `check-verifier-output.ts` 退出码 0 才算评审闭环 |
| #2 | 阶段 1~4 产物存在但对应测试设计文档缺失（如阶段 3 无 `interface-test-design.md`） | 回到阶段 N 起点，按 `phase-N-*.md`「并行任务（强制）」节补产出测试设计 | 无脚本；Agent 比对 `templates/` 模板核验 |
| #3 | 质量门节点未执行 `check-artifact-gate.ts` / 仅 LLM 文本说「通过」 | 立即执行 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]`，退出码非 0 一律回阶段 5 | `check-artifact-gate.ts` 退出码 0=通过 / 1=未通过 / 2=输入错误 |
| #4 | `VerifierOutput.passed=false` 但 `Project.status` 已推进到下一阶段 | 回到本阶段起点，按 `reworkHints` 修复后重评，重置 `status` 字段 | `check-verifier-output.ts` 退出码 0 + `passed=true` |
| #5 | Agent 上下文同时加载 ≥3 个 `references/phase-N-*.md` 文件 | 卸载无关 phase 文档，仅保留当前阶段 + `SKILL.md` + 必要 references | 无脚本；Agent 自检加载列表 |
| #6 | RTM 覆盖率字段为 LLM 估算（无 `check-artifact-gate.ts` 输出佐证） | 执行 `check-artifact-gate.ts` 重新计算覆盖率；估算值不得写入 `rtm.json` | `check-artifact-gate.ts` 退出码 0 + `GATE_JSON.coverage=100%` |
| #7 | `check-artifact-gate.ts` 退出码 1/2 但 `Project.status` 已标「验收通过」 | 重置 `status` 为「编码」，回阶段 5 返工；附 GATE_JSON 详情告知用户 | 退出码 1/2 → 一律回阶段 5 |
| #8 | 到达 🔴 CHECKPOINT 节点后无「等待用户确认」记录直接推进 | 回到 CHECKPOINT 节点重新暂停，向用户展示放行判定并由用户确认 | 无脚本；Agent 自检对话流 |
| #9 | `Project.status` / `Requirement.status` 字段值与实际产物不符（如标「已完成」但无代码） | 按实际进度修正 `status` 字段；未完成不得推进到下一阶段 | 无脚本；Agent 比对 `rtm.json` 与磁盘产物 |
| #10 | 编排者会话出现 `Write` / `Edit` 调用写阶段产物文件；或编排者直接产出 `VerifierOutput` JSON 内容；或编排者 `git diff` 含非 `.w-model/*.json` 状态文件改动；或编排者会话出现代码 / 测试用例 / 评审 JSON 的生成内容；或编排者使用 `node -e` 操作 `.w-model/*.json`（含 graph.json 边 / consolidated.json / chunk-*.json / tla-manifest.json / rtm.json 实体字段 / verifier-output-*.json 等产物 JSON）；或编排者直接 `Write` `.w-model/*.json` 产物文件（不通过 A/S 子代理）；或编排者自行填写 `acknowledgedDecisions`（用户未明确说出技术决策，O 代填视为越权实施 + O4 Comprehension Debt） | 回到当前阶段起点：① 已越权产出的实体作废重做；② 重新分派 S 子代理产出；③ 重走 V → G；④ 编排者会话内仅保留路由 / 状态 / CHECKPOINT / 只读脚本记录；⑤ `acknowledgedDecisions` 清空并要求用户重新陈述决策 | 无脚本；编排者自检动作清单 + 宿主 Agent 工具调用日志（`Write`/`Edit`/`node -e` 不得出现在编排者会话对产物 JSON 的操作上，详见 [operational-recovery.md](operational-recovery.md)「O 越权检测」节） |
| #11 | 阶段 1-4 未跑 `check-requirement-graph.ts` 直接进 S 产出 / V 评审；或编排者跳过 A→G 收敛循环 | 回到当前阶段起点，补跑 ingestion 子流程（A-chunk → A-cross/A-evolve → G 图谱校验） | `check-requirement-graph.ts` 退出码 0 才算收敛闭环 |
| #12 | A-cross/A-evolve 的 LLM 输出被直接用作收敛判定，未经 G 跑 `check-requirement-graph.ts` | 作废 A 的收敛声明，分派 G 跑脚本，按退出码重新判定 | `check-requirement-graph.ts` 退出码 0=通过 / 1=校验失败 / 2=输入错误 |
| #13 | `GRAPH_JSON.dataflowViolations` 存在非空数组（blackHoles/miracles/deadModules）或 `boundary.complete=false` | 回到当前阶段起点，分派 A-chunk 补信息流边（produces）与边界节点（EXT-IN/EXT-OUT），重跑 A→G 收敛循环 | `check-requirement-graph.ts` 退出码 0 才算信息流闭合 |
| #14 | TLA+ 规格未经 SANY 语法检查直接跑 TLC；或 `check-tla-model.ts` 步骤 6（SANY）未通过即执行步骤 7（TLC） | 回到当前规格，先修语法错误使 SANY 退出码 0，再重跑 TLC | `check-tla-model.ts` 退出码 0（SANY + TLC 均通过） |
| #15 | `TLA_JSON.passed=false`（deadlockViolations/invariantViolations/stateExplosionSpecs 非空）但阶段已推进 | 回到当前阶段起点，分派 S 修正 TLA+ 规格（消除死锁/不变式违反）或拆解规格（缓解状态爆炸），重跑 `check-tla-model.ts` | `check-tla-model.ts` 退出码 0 才算行为门禁通过 |
| #16 | TLA+ 规格含 `Next = []` 空下一步 / `\* TODO` 未实现分支 / 刻意遗漏需求关键状态 / 不变式与设计文档矛盾 | 回到当前阶段起点，分派 S 重写 TLA+ 规格（补全状态分支、对齐需求/设计），重跑 V→G | V 评审 `passed=false` + `check-tla-model.ts` 退出码 0 |
| #17 | TLC 发现违反，S 核查后确认规格忠实于需求/设计，但未回退修正需求/设计 | 回退到对应阶段：修正需求规格或设计文档 → 重写 TLA+ 规格 → 重跑 TLC | `check-tla-model.ts` 退出码 0（修正后重跑通过） |
| #18 | V/G 不通过后编排者直接分派 S 返工（无 R 报告作为 S-fix 输入） | 回到 V/G 不通过节点，分派 R 定位 → V 复审 → G 门禁 → S-fix | `check-rootcause-report.ts` 退出码 0 + run-log R3 扩展（R+S-fix 一一对应） |
| #19 | R 报告产出后无 V 复审记录（targetKind=rootcause）直接分派 S-fix | 回到 R 产出节点，分派 V 复审 → G 门禁后才可 S-fix | `check-verifier-output.ts`（targetKind=rootcause）退出码 0 + run-log R3 扩展（V 复审数=R 数） |
| #21 | run-log.jsonl 中阶段 N（6/7）的 gate 动作参数为 `--phase=8`（或无 `--phase` 参数）且 N < 8；或阶段 N 完成但未跑对应 `--phase=N` 门禁 | 回到阶段 N 起点，强制跑 `npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=N [project-dir]` | `check-artifact-gate.ts --phase=N` 退出码 0 才算阶段 N 门禁闭环 |
| #22 | 路由层或控制器入口仅校验 token 存在未校验角色（如 `authRequired=true` 但未校验 `user`/`reader`/`blogger` 角色）；或受保护端点无 `requiredRole` 声明 | 回到阶段 5 起点，分派 S 在路由层或控制器入口显式校验 `requiredRole`，token 解码后断言 `token.role ∈ requiredRoles`，否则返回 403；重跑 V-code 评审 + 单元测试「跨角色越权」场景 | 无脚本（V 评审 `reworkHints` 标注 + 系统测试用例越权场景应返回 403）；详见 [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节 |
| #23 | 跨模块调用时 store 选择与 schema 不一致（如 `follower` 是 `user` 子集却在 `blogger store` 校验；`comment.bloggerId` 引用 `blogger` 主键却在 `user store` 校验）；或 `token.sub` 与所选 store 主键不对齐 | 回到阶段 3/4 起点，分派 S 在接口设计/详细设计显式声明所用 store，与 schema 一致；重跑 V-design 评审 + 集成测试「跨模块数据流」用例 | 无脚本（V 评审 `reworkHints` 标注 + 集成测试用例跨模块数据流）；详见 [phase-3-outline-design.md](phase-3-outline-design.md)「跨模块数据源选择约束」节 |
| #24 | 响应体字段返回副作用自增前的旧值（如 `viewCount` 自增后响应体仍返回旧值；状态变更后响应体仍返回旧状态） | 回到阶段 5 起点，分派 S 调整副作用与响应体构造顺序（副作用在前，响应体构造在后）；重跑 V-code 评审 + 单元测试「副作用与响应体一致性」场景（断言响应体字段 = 已生效状态） | 无脚本（V 评审 `reworkHints` 标注 + 系统测试用例副作用时序）；详见 [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节 |
| #25 | run-log.jsonl `note` 字段含 "PowerShell" / "ConvertTo-Json" / "Add-Content" / "Out-File" / "Set-Content" 关键词；或产物 JSON 文件首字节为 BOM（0xEF 0xBB 0xBF）；或 JSON 深度 > 2 时字段丢失 | 回到当前阶段起点，分派 S 改用 Node.js `fs.writeFileSync(path, content, 'utf-8')` 重写损坏的 JSON 文件；重跑相关门禁 | 无脚本（编排者自检 run-log `note` 字段 + 文件 BOM 检测）；详见 [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节 |
| #26 | `run-log.jsonl` 含 EventIngress 字段（`eventId` / `eventType` / `source` / `summary` / `affectedArtifacts` / `affectedRequirements` / `evidence` / `routedTo`）；或 `event-ingress.jsonl` 含 RunLogEntry 字段（`runId` / `action` / `role` / `outcome` / `acknowledgedDecisions` / `duration_s` / `tokens` / `estimated` / `subagentSpawns` / `gateExitCode` / `gateLogPath` / `phase` / `phaseName`） | 回到当前阶段起点，分派 S 按正确 schema 重写 run-log.jsonl 或 event-ingress.jsonl；重跑 `check-run-log.ts` R1 动作完整性校验 | `check-run-log.ts` 退出码 0 才算 RunLogEntry schema 闭合；详见 [data-models.md](data-models.md)「RunLogEntry vs EventIngress Schema 边界对照表」节 |
| #27 | run-log.jsonl 缺 chunk/cross/review/gate 动作（S2 省步骤）；或 checkpoint acknowledgedDecisions 缺硬约束 ID（S1 丢细节）；或 gate JSON exitCode ≠ passed（S3 未核验）；或归档缺 acceptance-test-report §9 用户确认（S3 未核验）；或 V 评审 reworkHints 为空（S2 省步骤）；或门禁脚本未实跑——仅记录 JSON 摘要未真实执行命令（编排者仅引用 JSON 摘要中的 `passed: true`，但未展示 check-*.ts 的 stdout 输出）（S2 省步骤） | 回到当前阶段起点，按 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节自检清单逐条核验：重读硬约束 + 补全 S→V→G 全流程 + 逐条核验硬约束清单 | 无脚本（编排者自检 run-log 动作完整性 + checkpoint R2 + gate exitCode 一致性交叉检测）；详见 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节 |

### 门禁脚本退出码精确对应表

| 脚本 | 退出码 | 含义 | 触发的反模式 | 回退动作 |
|---|---|---|---|---|
| `check-verifier-output.ts` | 0 | 评审通过 | — | 可推进到下一阶段 |
| `check-verifier-output.ts` | 1 | 评审未通过（schema / 方差 / 分数不达标） | #1 / #4 | 回到当前阶段起点返工 |
| `check-verifier-output.ts` | 2 | 输入错误（JSON 缺失 / 路径错误） | #1 | 重新执行评审产出 JSON |
| `check-artifact-gate.ts` | 0 | 质量门通过 | — | 可发布 |
| `check-artifact-gate.ts` | 1 | 质量门未通过（覆盖率 / 测试状态不达标） | #3 / #6 / #7 | 回阶段 5 编码返工 |
| `check-artifact-gate.ts` | 2 | 输入错误（`rtm.json` 缺失 / 字段错误） | #9 | 修复 `rtm.json` 后重跑 |
| `check-requirement-graph.ts` | 0 | 图谱结构门禁通过（连通 / 单根 / 父唯一 / 阶段追溯零违反） | — | 可推进（阶段 4 通过即可进阶段 5 编码） |
| `check-requirement-graph.ts` | 1 | 图谱校验失败（孤立 / 多根 / orphan / multiParent / 追溯违反 / blackHoles / miracles / deadModules / boundary 不完整） | #11 / #12 / #13 | 回到当前阶段起点，补跑 A→G 收敛循环 |
| `check-requirement-graph.ts` | 2 | 输入错误（`graph.json` / `consolidated.json` 缺失或损坏） | #11 | 从 `graph.phase-N.bak.json` 恢复或重跑 ingestion |
| `check-tla-model.ts` | 0 | TLA+ 行为门禁通过（文件头 + 层次 + 拆解 + SANY + TLC 全通过） | — | 可推进（阶段 4 通过即可进阶段 5 编码） |
| `check-tla-model.ts` | 1 | TLA+ 校验失败（文件头缺失 / 层次不一致 / 拆解未完成 / SANY 语法错 / TLC 死锁 / 不变式违反 / 状态爆炸） | #14 / #15 / #16 | 回到当前阶段起点，分派 S 修正规格或拆解，重跑 `check-tla-model.ts` |
| `check-tla-model.ts` | 2 | 输入错误（`tla-manifest.json` 缺失 / Java 未找到 / jar 缺失） | #14 | 修复环境或 manifest 后重跑 |
| `check-iceberg-sweep.ts` | 0 | 冰山扫掠报告校验通过（R1-R8 全过） | — | 可放行（newFindings=[] 或 V 复审后返工闭环） |
| `check-iceberg-sweep.ts` | 1 | 校验失败（schema / round 越界 / 去重 / 可证伪 / passed 不一致） | #44 | 回到 S-fix 后（ICEBERG-A）或阶段门前（ICEBERG-B），补跑 R-iceberg + V 复审 |
| `check-iceberg-sweep.ts` | 2 | 输入错误（报告 JSON 缺失 / 路径错误） | #44 | 重新执行 R-iceberg 产出报告 |

> 退出码 1/2 一律不得放行；Agent 必须在交互中明示退出码数值与触发回退的反模式编号。

## #5 一次性载入全部 references（强化）

**反模式 #5（强化）**：违反 Bundled Resources 表 — 一次性加载整个 references/ 或无关阶段的 phase 文件。Bundled Resources 表（见 [SKILL.md](../SKILL.md)「Bundled Resources」节）是按需加载的可执行清单，违反即回退。

> 检测信号与回退动作见上方「检测信号与回退命令」表 #5 行（Agent 上下文同时加载 ≥3 个 `references/phase-N-*.md` 文件 → 卸载无关 phase 文档，仅保留当前阶段 + `SKILL.md` + 必要 references）。
>
> 约束 #6「按需加载」的可执行化清单见 [SKILL.md](../SKILL.md)「Bundled Resources（按需加载契约）」节，明示每个 reference/script/subagent/template 的触发条件，**none of them need to be in context up front**。

## #8 越过 🔴 CHECKPOINT 自动推进

**检测信号**：到达 🔴 CHECKPOINT 节点后无「等待用户确认」记录直接推进。

- `signature-chain.jsonl` 中 O checkpoint 签名 `signer` 为 O 角色 ID（代签检测，[21.0.0] 新增）

**回退动作**：回到 CHECKPOINT 节点重新暂停，向用户展示放行判定并由用户确认。

- 清空 O 代签的 `acknowledgedDecisions`，要求用户重新陈述决策（[21.0.0] 新增）

## #10 编排者越权实施

**检测信号**：编排者会话出现 `Write` / `Edit` 调用写阶段产物文件；或编排者直接产出 `VerifierOutput` JSON 内容；或编排者直接判定根因并分派 S-fix（无 R 报告路径作为 S-fix 输入）；或编排者自行填写 `acknowledgedDecisions`。

- `signature-chain.jsonl` 中 O 角色 `action=produce/review/gate`（O 越权承担 S/V/G 职责，[21.0.0] 新增）

**回退动作**：回到当前阶段起点：① 已越权产出的实体作废重做；② 重新分派 S 子代理产出；③ 重走 V → G；④ `acknowledgedDecisions` 清空并要求用户重新陈述决策。

- 作废 O 越权签名，重新分派对应角色子代理（[21.0.0] 新增）

## #11 ingestion 跳过图谱校验

**检测信号**：阶段 1-4 未跑 `check-requirement-graph.ts` 直接进 S 产出 / V 评审；或编排者跳过 A→G 收敛循环。

**回退动作**：回到当前阶段起点，补跑 ingestion 子流程（A-chunk → A-cross/A-evolve → G 图谱校验）。

**与约束 4 的关系**：图谱校验是"真实执行"在结构层的延伸，不得用 LLM 估算替代脚本退出码。

## #12 A 子代理自评收敛

**检测信号**：A-cross/A-evolve 的 LLM 输出被直接用作收敛判定，未经 G 跑 `check-requirement-graph.ts`。

**回退动作**：作废 A 的收敛声明，分派 G 跑脚本，按退出码重新判定。

**与反模式 #3/#6 的关系**：这是"LLM 估算质量门"在 ingestion 场景的变体——A 的 reworkHints 是指引不是判定。

## #13 ingestion 图谱信息流黑洞/奇迹/死模块放行

**检测信号**：`GRAPH_JSON.dataflowViolations` 出现非空数组（blackHoles/miracles/deadModules），或 `boundary.complete=false`。

**回退动作**：回到当前阶段起点，分派 A-chunk 补 produces 信息流边与 EXT-IN/EXT-OUT 边界节点，重跑 A→G 收敛循环。

**与 #11 的关系**：#11 是「结构连通」失守（孤立/多根/追溯断裂），#13 是「信息闭合」失守（黑洞/奇迹/死模块）——两者正交，一个节点可结构追溯完整却仍是信息流黑洞。二者均由 `check-requirement-graph.ts` 退出码守护。

## #14 TLA+ 语法检查未通过即跑 TLC

**检测信号**：TLA+ 规格未经 SANY 语法检查直接跑 TLC；或 `check-tla-model.ts` 步骤 6（SANY）未通过即执行步骤 7（TLC）。

**回退动作**：回到当前规格，先修语法错误使 SANY 退出码 0，再重跑 TLC。

**与约束 9 的关系**：TLA+ 编码调试须按「先清轨迹 → SANY 语法通过 → TLC 模型检查」顺序，语法未通过即跑 TLC 会导致报错信息混乱。

## #15 TLA+ 死锁/状态爆炸/不变式违反放行

**检测信号**：`TLA_JSON.passed=false`（`deadlockViolations`/`invariantViolations`/`stateExplosionSpecs` 非空）但阶段已推进。

- `signature-chain.jsonl` 中 G 签名 `action=gate` 但 `gateExitCode` 字段缺失（skip-tlc 无 GATE_JSON，[21.0.0] 新增）

**回退动作**：回到当前阶段起点，分派 S 修正 TLA+ 规格（消除死锁/不变式违反）或拆解规格（缓解状态爆炸），重跑 `check-tla-model.ts`。

- 回到当前阶段起点，跑完整 TLC 检查（[21.0.0] 新增，--skip-tlc 已移除）

**与公理的关系**：正常软件系统不允许死锁。死锁或矛盾分支须定位根因修正，而非绕过。

## #16 TLA+ 占位实现/简化实现/错误实现

**检测信号**：TLA+ 规格含 `Next = []` 空下一步 / `\* TODO` 未实现分支 / 刻意遗漏需求关键状态 / 不变式与设计文档矛盾。

**回退动作**：回到当前阶段起点，分派 S 重写 TLA+ 规格（补全状态分支、对齐需求/设计），重跑 V→G。

**与约束 9 的关系**：TLA+ 不接受占位实现、简化实现、错误实现——规格须如实建模系统行为，否则无法作为正确性基准。

## #17 TLA+ 建模与需求/设计不符未回退

**检测信号**：TLC 发现违反，S 核查后确认规格忠实于需求/设计，但未回退修正需求/设计。

**回退动作**：回退到对应阶段：修正需求规格或设计文档 → 重写 TLA+ 规格 → 重跑 TLC。

**与 #16 的关系**：#16 是规格本身有缺陷（偏离需求/设计），#17 是规格忠实但需求/设计本身有缺陷——前者修规格，后者修需求/设计并回退。判定流程见 [tla-plus-guide.md](tla-plus-guide.md)「建模与需求/设计一致性」节。

## #20 只规划不执行（第 9 轮 P1.3）

> 详细描述见 [subagent-delegation.md](subagent-delegation.md)「反模式 #20」节。子代理返回规划性内容而未调用任何执行工具，浪费 token + 轮次，任务无实际进展。

**检测信号**（sig-008）：run-log 中存在 `action=plan` 但无后续 `action=implement`/`action=verify` 条目；规划产物（spec/plan）存在但无对应执行产物。

## #21 阶段级门禁跳过（self-as-verifier 模式下跳过中间阶段门禁直接跑终检）

> 第 13 轮 P3.1 新增。self-as-verifier 模式下编排者为加速调测，跳过阶段 6/7 的 `--phase=N` 门禁直接跑 `--phase=8` 终检，导致阶段级字段缺失（如 REQ 行 `systemTest`）到终检才发现，违反"早发现早修复"原则。
> 第 12 轮阶段 7 跳过 `--phase=7` 直接跑 `--phase=8`，导致 REQ-019/021 的 `systemTest` 字段缺失到终检才发现（详见 [AGENTS.md](../../AGENTS.md) §4 第十二轮"修复"节）。

**检测信号**：run-log.jsonl 中阶段 N（6/7）的 gate 动作类型为 `check-artifact-gate` 但参数为 `--phase=8`（或无 `--phase` 参数，默认终检），且 N < 8；或阶段 N 完成但未跑对应 `--phase=N` 门禁。

**回退动作**：回到阶段 N 起点，强制跑 `--phase=N`。

**例外**：
- 阶段 1-4 不强制跑 `check-artifact-gate`（设计阶段，无测试汇总校验）
- 阶段 5 以 `check-code-tla-consistency` 为主，`--phase=5` 为辅

**与反模式 #1 的关系**：#1 是"跳过阶段门评审直接进入下一阶段"（完全不跑门禁），#21 是"跑了门禁但跳过阶段级校验直接跑终检"（跑了但参数错误）。前者完全不校验，后者校验粒度错误。

**与 SKILL.md 阶段路由表的对应**：SKILL.md「阶段 5-8 工件质量门」节已指引阶段 6/7/8 完成时必须跑对应 `--phase=6`/`--phase=7`/`--phase=8`，本反模式是 self-as-verifier 模式下的强制约束。

**检测信号**（sig-008）：run-log 中阶段 6/7/8 的 GATE 条目缺 `--phase=N` 参数；或 gate JSON 输出中 phaseOption 字段缺失。

## C1（候选，pending V 复审）V 评审 summary 模板化

**症状**：V 评审 summary 字段跨多个阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符，使用「评审通过」「质量良好」等空泛措辞。

**违反原则**：真实执行（约束4）—— summary 信息熵低，无法体现阶段产出的具体决策与结构。

**检测信号**：Loop 4 HarnessImprovementReport category=prompt severity=S2，evidence.patterns 含「Jaccard 相似度 > 0.8」。

**修正**：强化 verifier-spec.md §6 summary 三要素要求（sig-001 已应用）；V 子代理重写 summary 含具体决策+结构+风险。

**状态**：候选（pending V 复审）。本候选由 Loop 4 信号驱动提出，需 V 子代理复审转正后正式编号入清单。复审前不作为强制反模式执行。

## #28 schema 前置校验缺失（借鉴点 2 — Task 3）

**症状**：`*-logic.ts` 校验函数直接进入业务规则校验，未先调用 `validateBySchema`；当输入结构异常（字段缺失 / 类型错误 / 未知字段 / 枚举越界）时，业务规则校验抛 TypeError（如 `Cannot read property 'specs' of undefined`）或返回模糊错误信息，Agent 无法定位是结构错误还是语义错误。

**违反原则**：真实执行（约束4）+ 单点事实—— 结构性约束与业务规则校验未分层，错误信息混杂，Agent 修正时无法区分"结构错误"（应改 schema 或输入数据结构）vs"业务规则违反"（应改数据语义）。

**检测信号**：
- `*-logic.ts` 校验函数未 `import { validateBySchema } from './schema-loader.js'`，或函数入口未调用 `validateBySchema(name, input)`。
- 校验错误信息缺 `[schema]` 前缀（结构性错误未与业务规则违反区分）。
- TypeError 堆栈含 `undefined` 属性访问（如 `input.manifest.specs` 当 `manifest` 缺失时 crash）。
- `schemas/` 目录缺少对应 schema 文件（schema-loader 报 `schema 未注册`）。

**回退动作**：
1. 在 `w-model-dev/schemas/` 目录增加对应 schema 文件（draft-07 + `additionalProperties:false` + `required` + `type`/`enum`/`format`）。
2. 在 `*-logic.ts` 校验函数入口（类型守卫之后、业务规则之前）增加 `validateBySchema(name, input)` 前置校验，失败时以 `[schema]` 前缀返回错误。
3. 在 `self-test.ts` SCHEMA_CASES 增加对应 schema 的 bad 样本用例（additionalProperties / required / type / enum 至少各 1 条）。

**例外**：
- 含 AST / 函数等不可 JSON 序列化字段的输入（如 `code-tla-logic.ts` 的 `codeFiles`），schema 校验时仅传入 JSON 兼容子集，不传不可序列化字段。
- 顶层 `additionalProperties:false` 须与运行时形态兼容（如 `code-tla-manifest.schema.json` 允许 `codeSources` 可选，兼容 CLI/test 与运行时两种形态）。

**与反模式 #11 的关系**：#11 是"跳过图谱校验"（完全不跑校验），#28 是"跑了校验但缺 schema 前置层"（校验了但结构错误未拦截）。前者完全不校验，后者校验层级不完整。

**与约束 4 的关系**：schema 前置校验是"真实执行"在结构层的延伸—— 结构错误必须由 schema 拦截并明确标注 `[schema]` 前缀，不得让业务规则校验 crash 或返回模糊错误。借鉴 drawio-skill/styles/schema.json 设计实践。

**实现证据**（Task 3，借鉴点 2）：
- schema 文件统一存放于 `w-model-dev/schemas/*.schema.json`（详见 [data-models.md](data-models.md)「JSON Schema 强约束」节 schema 清单）。
- 各 `*-logic.ts` 校验函数入口已集成 `validateBySchema` 前置校验，失败时以 `[schema]` 前缀返回错误。

## #29 BDD 建模与需求/设计/TLA+ 不符未回退

**危害**：BDD 规格形同虚设，与 TLA+ 行为规格不一致或与需求/设计脱节，问题后移到编码或测试执行阶段。

**触发场景**：
- BDD features 写完后未跑 `check-bdd-model.ts` D4 等价性校验即放行。
- BDD 状态机七要素与同层 TLA+ spec 的 State/Init/Next/Invariants 不一致。
- BDD scenario 路径在 TLA+ 转移表中无对应分支，但未回退修正 BDD 或 TLA+。
- BDD features 与需求 (REQ) / 设计 (SD/INTF/DD) 脱节，仅作为「写完就过」的形式产物。

**正确做法**：
- BDD features 必须忠实于需求/设计，符合后仍有问题须修正需求/设计并回退重跑（仿反模式 #17）。
- BDD↔TLA+ 不等价时必须走 R→V→G→S-fix 循环，不得直接放行。
- 接受措辞不同但实质一致的等价性（由 R 子代理判定 + V 子代理验证）。
- 实质不一致必须上报人类决策，提供修正 BDD / 修正 TLA+ / 修正需求设计三个可选项。

**检测信号**：
- `check-bdd-model.ts` 退出码 1，violations 含 `[D4:...]` 前缀的等价性违反。
- BDD features 文件头 `@tla-spec` 与 manifest.tlaSpecId 不一致。
- BDD 状态机状态集与 TLA+ spec 状态集差异 > 0。
- BDD scenario 路径校验失败（`[D6:...]` 前缀违反）但未触发 R 循环。

**回退动作**：
1. 若 BDD↔TLA+ 等价性违反：先分派 R 子代理判定是「措辞差异」还是「实质不一致」。
2. 措辞差异：R 报告经 V 复审后标注「等价」，G 门禁放行。
3. 实质不一致：上报人类决策，三选一（修正 BDD / 修正 TLA+ / 修正需求设计），修正后回退到对应阶段起点重跑。
4. BDD 与需求/设计脱节：必须修正需求/设计并回退重跑（仿反模式 #17 流程）。

**与反模式 #17 的关系**：#17 是 "TLA+ 建模与需求/设计不符未回退"，#29 是 "BDD 建模与需求/设计/TLA+ 不符未回退"。前者关注 TLA+ 单一规格，后者关注 BDD 与 TLA+ 的等价性以及 BDD 与需求/设计的一致性。两者复用同一回退流程（R→V→G→S-fix）。

**与反模式 #16 的关系**：#16 是 "TLA+ 占位实现/简化实现/错误实现"，#29 不直接覆盖占位实现，但若 BDD 状态机七要素缺失（如 `@accepting-states: ()`）则可能同时命中 #16（TLA+ 端）和 #29（BDD 端等价性失败）。

**关联**：
- spec §10.1 / bdd-guide.md §8 / check-bdd-model.ts D4 等价性校验。
- bdd-review-checklist.md 第 3 项「TLA+ 等价性」。
- 反模式 #17（TLA+ 建模与需求/设计不符未回退）。

**实现证据**（BDD 建模任务）：
- `check-bdd-model.ts` D4 维度已实现 `validateTlaEquivalence()` 等价性校验（状态集 / 初始状态 / 转移集 / 不变式归一化匹配）。
- `bdd-logic.ts` 的 `validateStateMachineCompleteness()` 校验七要素完整性，与 TLA+ 端 `tla-logic.ts` 状态机校验对称。
- self-test BDD 样本中 `bad-tla-mismatch.manifest.json` 专测 D4 等价性违反拦截。

## #30 豁免审批跳步（第 20 轮新增）

> 第 20 轮四维识别与豁免审批增强（v20.0.0）。任何豁免未按 S→R→V→人类四阶段流程执行即命中本反模式。

**危害**：覆盖缺失 / conflicts-with 冲突 / 覆盖率不达标等豁免项未经四阶段流程即生效，需求遗漏被豁免掩盖，治理失守，缺陷后移到设计/编码阶段。

**典型表现**（命中任一即判 #30）：
- **S 自行声明豁免**：S 产出 `exemption-request.json` 后直接声明豁免生效（FM-EXEMPT-01），未走 R 审查。
- **R 直接批准**：R 的 `exemption-review.json` 直接批准豁免生效，未交 V 校验与人类确认（FM-EXEMPT-02）。
- **V 跳过**：豁免流程中无 `exemption-verification.json`，或 V 校验 `passed=false` 但豁免已生效（FM-EXEMPT-03）。
- **编排者代签**：编排者代替人类完成 CHECKPOINT 确认，无真实人类确认记录（FM-EXEMPT-04）。
- **掩盖需求遗漏**：用豁免审批掩盖本应补充的需求，而非真实豁免（FM-EXEMPT-05）。

**正确做法**：
```
S 提出 exemption-request.json（含豁免理由、影响范围、替代方案）
  → R 按 root-cause-locator.md 方法论审查（5-Why / 上游回溯 / 可证伪性）产出 exemption-review.json
    （R 不得直接批准豁免生效）
  → V 校验 reviewDecision / rootCauseAnalysis / falsifiabilityCheck / conditions 产出 exemption-verification.json
  → 人类 CHECKPOINT 确认 → approve 写入 granted.json / reject 回到原规则
  → check-exemption E1-E8 全通过
```

**检测信号**：
- 豁免已生效（`granted.json` 存在或需求规格 §8 引用 EXEMPT-NNN）但缺少 `exemption-request.json` / `exemption-review.json` / `exemption-verification.json` 任一文件。
- `exemption-review.json` 缺 5-Why / 上游回溯 / 可证伪性字段（FM-EXEMPT-02）。
- `exemption-verification.json` `passed=false` 但 `granted.json` 已写入（FM-EXEMPT-03）。
- 无 CHECKPOINT 人类确认记录（run-log 无 `action=checkpoint` + 人类确认），但豁免已生效（FM-EXEMPT-04）。
- 豁免理由为「需求遗漏」类但未补需求（FM-EXEMPT-05）。
- `check-exemption` E1-E8 任一未通过。

**回退动作**：
1. 作废已生效的豁免（删除 `granted.json` 对应条目，回退需求规格 §8 Out of Scope 中的豁免声明）。
2. 回到豁免审批流程的缺失阶段补齐（S/R/V/人类对应阶段）。
3. 若为 FM-EXEMPT-05（掩盖需求遗漏）→ 作废豁免，回 [phase-1-requirements.md](phase-1-requirements.md) 步骤 1 补充需求。
4. 重跑 V 评审（`targetKind=requirement`）+ G 门禁。

**与反模式 #10（编排者越权实施）的关系**：编排者代签人类 CHECKPOINT 确认同时命中 #10（编排者越权）与 #30（豁免跳步），按两者叠加处置。

**与反模式 #18（跳过 R 直接 S 返工）的关系**：#18 是返工流程跳过 R，#30 是豁免流程跳过 R/V/人类；两者均为「跳过治理阶段」，但适用场景不同（#18 返工修复，#30 豁免审批）。

**关联**：
- [phase-1-requirements.md](phase-1-requirements.md)「豁免审批治理」节 + FM-EXEMPT-01~05。
- [subagent-delegation.md](subagent-delegation.md) S/R/V 角色边界扩展（豁免审批职责）。
- [verifier-spec.md](verifier-spec.md) §7.1 completeness 四维核验（豁免审批缺失 → completeness 判 0 分）。

## #31 归档完整性缺失

**危害**：归档未包含强制产出文档，事后无法审计 V 评审声明真实性，审计链断裂。

**检测信号**：
- `check-archive-integrity.ts` 退出码 1（缺失任一阶段强制快照清单文件）

**回退动作**：
- 回到归档前状态，补齐缺失文件后重跑 `check-archive-integrity.ts`

**关联**：SSoT §10B.2.1 归档完整性清单（[21.0.0] 新增）

## #32 签名链断裂

**危害**：跳过角色 / 签名链不连续 / 篡改签名 / 代签 checkpoint / 来源缺失 / 来源越权，流程完整性失守。

**检测信号**：
- `check-signature-chain.ts` R1-R10 任一失败

**回退动作**：
- 回到当前阶段起点，补齐缺失角色签名 / 来源证明，重跑签名链校验

**关联**：SSoT §10.11 签名链门禁 + §7.9 SignatureChainEntry schema（[21.0.0] 新增）

## #33 跳过 R3 预防性审查（第22轮新增，第29轮强化为无条件）

**检测信号**：
- S 产出后未触发 R3 三阶段审查，直接进入 V 评审
- run-log 中 S→V 之间缺少 3 条 R3 记录（completeness/reliability/security）
- `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 文件缺失
- V 评审未读取 R3 报告（reworkHints 未纳入 R3 发现）

**第29轮强化（无条件强制）**：R3 从「条件强制（--r3-enabled flag）」升级为「**无条件强制**」，覆盖**所有 S 变体**：S-doc / S-tla / S-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**。任意 S 派遣后必须 R3×3 + V，无 flag，无「启用时」措辞。违反字面即违反精神：R3 不得以「修复就是小改不用审」「紧急救援优先」「self-as-verifier 模式简化」等理由跳过。`check-preventive-review.ts` 报告路径扩展支持 `<phase>-fix-{dim}.json` / `<phase>-emergency-{dim}.json`。

**回退动作**：回到 S 产出后起点，补跑 R3 三阶段审查，产出三份 PreventiveReview JSON，再进入 V 评审。

**门禁脚本**：`check-preventive-review.ts`（always-on，无 flag，支持 `--variant=standard|fix|emergency`）校验三份报告完整性；`check-run-log.ts` R8 无条件校验 S(任意变体)→V 间 R3 记录数。

## #34 编排者漏派角色（第24轮新增）

**危害**：编排者未按约束 #19 分派 S/V/G/R 角色，导致评审、门禁或根因定位环节缺失，流程完整性失守。

**检测信号**：
- run-log 中某阶段缺 role=V 记录（V 评审被跳过）
- run-log 中某阶段缺 role=G 记录（门禁被跳过）
- run-log 中某阶段缺 role=S 记录（产出环节被跳过或由 O 越权产出）
- 缺 role=R 记录（completeness/reliability/security 三阶段任一缺失）—— 第29轮升级为**无条件**强制，不再需要 R3 启用 flag
- self-as-verifier 模式下兼任时未产出独立产物文件（VerifierOutput JSON 与 S 产出同路径）

**回退动作**：回到当前阶段起点，补派缺失角色（S/V/G/R），重跑对应环节并补记 run-log，再进入 CHECKPOINT。

**门禁脚本**：`check-role-dispatch.ts` 校验 run-log 中每阶段含 S/V/G 各 ≥1 条记录；**无条件**含 R ≥3 条记录（第29轮升级，`--r3-enabled` flag 保留为 no-op 向后兼容）。

**关联**：约束 #19 + SSoT §3.4.20（[23.0.0] 新增，[28.0.0] 第29轮强化为无条件）

## #35 self-as-verifier 模式下 V/G/R 产物混合（第24轮新增，第29轮扩展含 R3 产物）

**危害**：self-as-verifier 模式下 V/G/R 产物与 S 产出混合在同一文件中，导致评审独立性失守，评审结论可能被 S 产出污染或覆盖。第29轮扩展：R3 预防性审查三份报告（PreventiveReview JSON）若与 S 产出混合，会令 R3 审查沦为 S 自评，破坏 R3 无条件强制的精神。

**检测信号**：
- 评审报告（VerifierOutput JSON）与产出文档（S 产出）在同一文件中
- VerifierOutput JSON 文件路径与 S 产出文件路径相同
- gate-logs JSON 文件路径与 S 产出文件路径相同
- RootCauseReport JSON 文件路径与 S 产出文件路径相同
- PreventiveReview JSON（`<phase>[-fix|-emergency]-{completeness,reliability,security}.json`）文件路径与 S 产出文件路径相同（第29轮扩展）
- run-log 条目的 `artifacts` 字段未列出各角色独立产物路径（含 R3 三份报告独立路径）

**回退动作**：回到当前阶段起点，拆分为独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON / PreventiveReview JSON 三份路径均不同），重审 V/G/R 环节并补跑 R3×3。

**门禁脚本**：`check-verifier-output.ts --self-as-verifier` 校验 VerifierOutput JSON 路径与 S 产出路径不同；`check-role-dispatch.ts` 校验 run-log artifacts 字段含各角色独立产物路径；`check-preventive-review.ts` 校验三份 PreventiveReview JSON 独立存在（第29轮扩展）。

**关联**：约束 #19 + SSoT §3.4.20（[23.0.0] 新增，[28.0.0] 第29轮扩展含 R3 产物）

## #36 路由顺序错误（第24轮新增）

**危害**：路由注册顺序错误导致参数路径拦截静态路径（如 `/users/:id` 拦截 `/users/me`，`id="me"`），或鉴权路由注册在公开路由之后导致鉴权失效。

**检测信号**：
- 参数路径（如 `/users/:id`）先于静态路径（如 `/users/me`）注册，导致 `/users/me` 被拦截为 `id="me"`
- 鉴权路由注册在公开路由之后，鉴权中间件未生效
- 具体路径（如 `/api/v1/users`）注册在通配路径（如 `/api/*`）之后，被通配路径拦截
- 集成测试中 `/users/me` 返回 404 或用户信息错误（`id="me"` 查询失败）

**回退动作**：修正路由注册顺序后重跑集成测试，确认静态路径优先匹配、鉴权中间件生效。

**门禁脚本**：无自动脚本（由 V 评审 + G 门禁人工校验路由注册顺序表）。

**关联**：SSoT §3.4.20（[23.0.0] 新增）

## #37 产物膨胀但核心决策稀疏（第24轮新增）

**危害**：产物文件大小达标（1-2MB）但核心决策稀疏，大量内容为扩展点/附录/重复说明，稀释了产物的语义价值。

**检测信号**：
- 文件大小达标但实体引用密度 < 1/章节
- 大量内容为"扩展点详细补充"而非核心设计决策
- 章节数多但每章引用的 SD-xxx / DD-xxx / REQ-xxx 等实体 ID 少
- V 评审发现核心设计决策被大量非核心内容淹没

**回退动作**：精简非核心内容（扩展点/附录），补充核心实体引用，使信息密度 ≥ 2/章节后重审。

**门禁脚本**：无自动脚本（由 V 评审人工校验信息密度）。

**关联**：SSoT §3.4.20（[23.0.0] 新增）

## #38 修改前未查询 codegraph（第25轮新增）

**危害**：S-coding 子代理在阶段 5-8 直接修改代码/测试文件，未先查询 codegraph 影响半径，可能误改被广泛依赖的符号，引入隐蔽回归。

**检测信号**：
- `.w-model/codegraph-queries/` 目录不存在或为空（阶段 5-8 有代码修改但无查询记录）
- 代码修改的 ticket 在 codegraph-queries/ 下无对应 `phase<N>-<ticket>-<symbol>.json` 落盘文件
- run-log 中阶段 5-8 有 action=produce（代码产出）但无 action=codegraph_query 记录

**回退动作**：撤销未查询的修改，补跑 codegraph_explore 查询并落盘，重新评估影响半径后重做修改。

**门禁脚本**：`check-codegraph-queries.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）；约束 #20

## #39 跳过 opsx 产物审查（第25轮新增）

**危害**：opsx:explore/propose/apply 工作流步骤产物未经 R3×3（completeness/reliability/security）+ V 评审即进入下一步，导致规划缺陷或实现偏差未被发现。

**检测信号**：
- `.w-model/r3-reviews/` 下缺少 opsx 三段式中任一 stage 的 3 份 R3 报告：`phase<N>-explore-{completeness,reliability,security}.md` / `phase<N>-propose-{completeness,reliability,security}.md` / `phase<N>-coding-{completeness,reliability,security}.md`（共 9 份）
- `.w-model/v-reviews/` 下缺少对应段 V 评审文件：`phase<N>-explore.md` / `phase<N>-propose.md` / `phase<N>-coding.md`（共 3 份）
- `openspec/changes/` 下任一 `phase<N>-*` 变更目录制品不齐（proposal/design/tasks/tickets/specs）

**回退动作**：回退到缺失审查的 opsx 步骤，补跑 R3×3 + V 评审后重做后续步骤。

**门禁脚本**：`check-opsx-artifacts.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）；约束 #17（R3 预防性审查强制）

## #40 opsx/S-tickets 职责混淆（第25轮新增）

**危害**：用 opsx:propose 的 tasks.md 替代 S-tickets 的 tickets.md（或反之），破坏规格级规划（what/why）与代码级切片（how）的职责边界，导致切片缺失端到端可 demo 性或规划缺失设计依据。

**检测信号**：
- `openspec/changes/<change>/` 目录下有 tasks.md 但无 tickets.md（S-tickets 拆解被跳过）
- tickets.md 存在但 tasks.md 缺失（opsx:propose 被跳过）
- tickets.md 内容是高层任务清单而非 vertical-slice 切片（职责错位）
- tasks.md 内容含 tracer-bullet/blocking-edges 代码切片细节（职责错位）

**回退动作**：补齐缺失的制品，修正职责错位的内容，重审 R3×3 + V。

**门禁脚本**：`check-opsx-artifacts.ts`（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.21（[24.0.0] 新增）

## #41 加权平均掩盖单轴失败（第26轮新增）

**危害**：V 评审产物通过加权平均 `compositeScore` 掩盖某一子标准的显著失败——如 completeness=0.65 但其余四项 0.95，加权后仍达 A 级被放行，需求遗漏/分析缺失的单轴缺陷被「平均」抹平。这与外部 code-review 技能「单轴（completeness / correctness）永不合并计分」原则一致：评审各轴独立成环，加权平均只用于汇报，不用于放行判据。

**检测信号**：
- `VerifierOutput` 存在任一 `subCriterion.score < 0.70`（0.70 = qualityLevel B 级分界，即「每个子标准自身须达 B 级」）
- `passed` 为 true 但存在 `subCriterion.score < 0.70` 的子标准（旧的加权平均误判）
- 评审时用「总体不错 / 平均分达标」措辞回避具体子标准失败

**回退动作**：V 按 R13 将对应子标准标记为 violation，`passed=false`，产出 `reworkHints` 交 S 返工（须走 R→V→G 循环）；qualityLevel 不变（仍由 compositeScore 映射），仅 passed 增加单轴条件。

**门禁脚本**：`check-verifier-output.ts` R13 单轴下限（exitCode=1 命中本反模式）。

**关联**：SSoT §3.4.22（[25.0.0] 新增）；[verifier-spec.md](verifier-spec.md) §3.3 / §6.3；[glossary.md](glossary.md)「单轴下限（R13）」；外部原则「评审各轴独立成环，永不合并计分」

## #42 S-fix / emergency-fix 后跳过 R3+V（第29轮新增）

**症状**：S-fix（返工变体）或 S-emergency-fix（紧急修复变体）产出后，未派遣 R3×3（completeness/reliability/security）+ V 评审，直接进入 G 门禁或放行。

**为何是反模式**：第29轮升级后，R3 预防性审查对所有 S 变体无条件强制。「修复就是小改不用审」「紧急救援优先跳过审查」属合理化借口——修复恰好是引入回归风险最高的环节，紧急修复往往跳过完整设计审查，更需要 R3 三维度（完整性/可靠性/安全性）兜底。跳过 R3+V 的修复等于未经验证直接合入。

**检测信号**：
- run-log 中 `action=fix` 或 `action=emergency-fix` 后无 3 条 R3 记录直接出现 `action=review` role=V
- run-log 中 `action=fix` 或 `action=emergency-fix` 后无 R3 记录直接进入 `action=gate` role=G
- `check-run-log.ts` R8 报「S(fix)→V 之间 R3 记录不足」或「S(emergency-fix)→V 之间 R3 记录不足」
- `check-role-dispatch.ts` 报「阶段 N 缺失 role=R」
- `check-preventive-review.ts --variant=fix/emergency` 报告路径缺失（`<phase>-fix-{dim}.json` 或 `<phase>-emergency-{dim}.json` 三份不齐）
- `.w-model/preventive-reviews/` 下无对应 fix/emergency 前缀的三份 PreventiveReview JSON

**回退动作**：回到 S-fix / emergency-fix 产出后起点，补跑 R3×3（completeness/reliability/security）+ V 评审，V 通过后才可 G 门禁。若 emergency-fix 误用事后 R 复核机制（`emergencyFixReview` 字段），须移除该字段并改走前置 R3+V+G。

**门禁脚本**：`check-run-log.ts` R8 无条件校验 S(任意变体，含 fix/emergency-fix)→V 间 R3 记录数；`check-role-dispatch.ts` 校验 R≥3 无条件；`check-preventive-review.ts --variant=fix|emergency` 校验对应路径三份报告完整性。

**关联**：约束 #17 + #19 + SSoT §3.4.25（[28.0.0] 新增）；反模式 #33（跳过 R3 预防性审查）的 S 变体特化

## #43 敏感信息写入状态文件/日志（第三十一轮新增）

**症状**：`.w-model/*.json`（project/budget/maturity/graph/rtm/tla-manifest 等）、`.w-model/gate-logs/`、`run-log.jsonl` / `event-ingress.jsonl` / `signature-chain.jsonl` 中出现硬编码密钥、令牌、密码、连接串（如 `sk-xxx`、`AKIA...`、`Bearer <token>`、`password=...`）；或 SKILL.md 示例、templates/ 模板、references/ 示例中包含真实凭据而非占位符。

**为何是反模式**：状态文件与日志是项目资产，可能随仓库分发、归档或进入下游 CI；硬编码凭据造成凭据泄露风险，且违反「敏感配置统一经环境变量注入」的运维纪律。即使 demo/教学场景也应以占位符（如 `${JWT_SECRET}`）呈现。

**检测信号**：
- `.w-model/` 下任一 JSON/JSONL 文件含高熵密钥特征（`sk-` 前缀、32+ 位 Base64、`Bearer `、`AKIA`、`password=`/`passwd=` 字段）
- gate-logs 存档或 run-log `note` 字段含真实凭据值
- 模板 / 示例 / 提示词中含非占位符的真实凭据

**回退动作**：从状态文件 / 日志移除敏感值，改为环境变量引用名（如 `${JWT_SECRET}`）或外部 secrets 管理；修正模板/示例为占位符；回当前阶段起点重跑受影响门禁。

**门禁脚本**：无专用脚本（软检测，V 评审 + G 门禁人工核验；`security-scan.ts` 覆盖源码级扫描，本反模式覆盖数据文件层）。

**关联**：SSoT §3.4.27（[30.0.0] 新增）；[operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节；demo `JWT_SECRET` 环境变量处理（第 15 轮）

## #44 跳过冰山扫掠直接放行（第 36 轮新增）

**症状**：S-fix 后或阶段门放行前未分派 R-iceberg；或 R-iceberg 发现新问题后未经 V 复审直接放行。

**为何是反模式**：已修复问题只是"水面之上 1/8"，水面之下的同根因扩散/同缺陷类/修复引入回归/相邻逻辑隐患被掩盖，缺陷后移到下游阶段才暴露，修复成本指数级上升。V/G 通过仅证明"既定标准下无问题"，不证明"同类深挖下无问题"（冰山理论）。

**检测信号**：
- run-log 中 S-fix 后无 `action=iceberg-sweep` 条目
- 阶段门 CHECKPOINT 前无 ICEBERG-B 报告
- IcebergSweepReport 存在但无对应 V 复审 VerifierOutput
- `check-iceberg-sweep.ts` 退出码 1

**回退动作**：回到 S-fix 产出后起点（ICEBERG-A）或阶段门放行前（ICEBERG-B），补跑 R-iceberg + V 复审。

**门禁脚本**：`check-iceberg-sweep.ts`

**关联**：SSoT §3.4.34（[36.0.0] 新增）；[iceberg-sweep-guide.md](iceberg-sweep-guide.md)「触发时机」节；反模式 #42（S-fix/emergency-fix 后跳过 R3+V）的冰山扩展

## #45 subagent 为通过测试而修改断言/测试期望（反指标游戏）（第 39 轮新增）

**症状**：subagent 为通过测试/门禁而修改测试断言、测试期望或验收判据；S 返回总结出现"调整测试期望""更新断言"且未先行报告；覆盖率 100% 但关键行为场景未被任何断言覆盖。

**为何是反模式**：agent 会为任何可量化目标优化——"为通过测试而改测试"在实测里出现频率极高且并非出于恶意（Goodhart：当一个度量成为目标时，它就不再是好的度量）。"每一环都诚实，合成结果造假"：断言被改后，"通过"失去与需求的对应关系。

**检测信号**：
- V/G 评审发现测试断言与需求/设计不符却"恰好通过"
- S 返回总结中出现"调整测试期望""更新断言"且未先行报告
- 覆盖率 100% 但关键行为场景未被任何断言覆盖（覆盖率与断言语义不匹配）

**回退动作**：回到当前阶段起点；改回断言后按 R→V→G 流程重走；涉及需求理解错误的须先 R 根因定位。

**例外**：经用户/主刀明确批准的需求变更（走豁免或 S→R→V→人类四阶段），不视为违反。

**门禁脚本**：无专用脚本（软检测——由 V 评审人工核验断言与需求对应关系）

**关联**：SSoT §3.4.39（[39.0.0] 新增）；[testing-anti-patterns.md](../../.cursor/skills/test-driven-development/testing-anti-patterns.md)「改断言让测试通过」条目；"记叙性优先"（测试断言不是金标准，失败先归因，见 [bdd-guide.md](bdd-guide.md)「记叙性优先」节）

## #46 只给审计权不给修正权（第 39 轮新增）

**症状**：评审/CHECKPOINT 中发现用户只能看日志与产物而不能在过程中间介入修正；全自动流程把用户锁在"跑完再看"之外；提供监控面板/日志/思维链展示但介入手段只有改提示词重跑。

**为何是反模式**：审计权与修正权分离的系统"你能诊断，无法治疗"。主刀有真正的修正权是外科手术队伍在 agent 时代必须被明确守护的前提；只给审计权的系统得到的是"外科手术录像回放"——你在场，但你没在做手术。

**检测信号**：
- 用户对产物/方向的修改必须等待整个运行结束才能生效
- 工具/流程只有"重跑一遍"路径，无"过程中间改产物"路径
- CHECKPOINT 处无显式介入路径标注

**回退动作**：回到当前阶段起点，为流程补"中途介入"位点（对话式 CHECKPOINT 已提供，须显式标注介入路径）。

**例外**：判据幂等、任务定义清晰、方案空间已被人类踩平的全自动域（如标准数据处理/格式转换），不强制介入位点。

**门禁脚本**：无专用脚本（流程设计属性——由 CHECKPOINT 介入路径标注保证）

**关联**：SSoT §3.4.39（[39.0.0] 新增）；「主刀职责映射表」见 [subagent-delegation.md](subagent-delegation.md)；「修正权验收测试」见 [definition-of-done.md](definition-of-done.md)

## 实现层经验教训（来自端到端调测）

> 以下不属于 W 模型**流程**反模式（命中不会触发阶段回退），而是 W 模型端到端调测中沉淀的**代码层**经验教训。
> Agent 在阶段 5（编码）与阶段 6（集成测试）应主动规避，避免重蹈覆辙。
> 来源：博客系统后端端到端调测（两轮：2026-07-20 首轮 + 2026-07-21 从零重建第二轮）。
> **归档说明（2026-07-27 第 17 轮 P6）**：原 `w-model-dev-demo/` 目录已删除，归档摘要位于 [`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](../../docs/changes/archive/2026-07-26-round15-end-to-end-test/)。下文「详见」链接为**历史记录**（源码已不在仓库），仅作教训检索参考；最终调测数字见归档 [`README.md`](../../docs/changes/archive/2026-07-26-round15-end-to-end-test/README.md)。

| # | 教训 | 触发场景 | 危害 | 规避做法 |
|---|---|---|---|---|
| L1 | Express 4 路由直接使用 `async (req, res, next) => {...}` 而不包装 | 阶段 5 编码：在 Express 4 路由中抛出 `AppError` 子类（如 `ForbiddenError` / `NotFoundError`） | rejected promise 不被错误中间件捕获，表现为 Unhandled Rejection，错误响应体不符合 `{error: string}` 契约，首轮集成测试集体失败 | 引入 `asyncHandler` 包装器包裹全部路由：`(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`；详见历史 `w-model-dev-demo/src/utils/async-handler.ts` 与 `integration-test-report.md` §5（已归档） |
| L2 | 模块加载阶段读取环境变量并直接 `throw`（如 `process.env.JWT_SECRET ?? (() => { throw ... })()`） | 阶段 5 编码：在 `src/utils/env.ts` 等模块顶层用 IIFE 抛错保护必填环境变量 | 测试套件在 `collect` 阶段即崩溃（模块 import 失败），连锁导致所有间接依赖该模块的测试文件 0 用例；vitest 报 `0 test` 而非 `fail`，掩盖真实失败数 | ① 模块加载阶段只读不抛，运行时（如服务启动）再校验必填；② 测试脚本统一注入环境变量（如 `cross-env JWT_SECRET=test-secret`）；详见历史 `w-model-dev-demo/src/utils/env.ts` 与 `w-model-dev-demo/package.json`（已归档） |
| L3 | service 类导出方式反复：内部 `class Foo` + `export const foo = new Foo()` 实例，丢失类型导出 | 阶段 5 编码：将原 `export class ArticleService` 改为内部 `class ArticleService` + `export const articleService`，但其他模块仍 `import type { ArticleService }` | `tsc --strict` 报 TS2724「no exported member named 'ArticleService'」，违反 NFR-003「tsc 0 错误」；回归测试发现后必须回退导出 | 类型与实例可同时导出：`export class ArticleService {}` + `export const articleService = new ArticleService()`；改导出方式前先 `grep -rE "import type \{ .*ArticleService"` 全仓库扫描消费者；详见历史 `w-model-dev-demo/src/services/article-service.ts`（已归档） |
| L4 | vitest mock 与 express 中间件类型不兼容：`vi.fn() as unknown as NextFunction` 后访问 `next.mock.calls` | 阶段 5 编码：测试中 `const next = vi.fn() as unknown as NextFunction`，断言 `next.mock.calls[0][0]` | `tsc --strict` 报 TS2339「Property 'mock' does not exist on type 'NextFunction'」；vitest 1.6 类型定义与 express 4 类型定义存在兼容性差异 | 用 `ReturnType<typeof vi.fn>` 做类型断言：`(next as ReturnType<typeof vi.fn>).mock.calls[0][0]`；或断言为 vitest `Mock` 类型：`import type { Mock } from 'vitest'; (next as Mock).mock.calls[0][0]`；详见历史 `w-model-dev-demo/tests/unit/auth-middleware.test.ts`（已归档） |

### 适用范围与扩展规则

- 本节仅记录**真实调测中发现并修正过**的代码层教训，每条须可指向具体的缺陷与修正证据（demo 内的代码 / 报告链接）。
- 新增教训时，同步在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 「过程中发现的缺陷与修正」表登记对应缺陷行，保证双向可追溯。
- 教训不命中阶段回退；若 Agent 在阶段 6 集成测试中再次触发已记录教训，应在《测试报告》「备注」节标注「重蹈 L#」并提示用户复核阶段 5 编码规范。
- L1 来自 2026-07-20 首轮调测；L2/L3/L4 来自 2026-07-21 从零重建第二轮回归测试发现。

## 失败模式清单（F1~F10）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills` 元技能的 Failure Modes。
> SSoT [§4A.2](../../docs/skill-design-document_SSoT.md) 为权威定义，本节为可执行细则。
>
> **与 46 条流程反模式（#1~#46）的关系**：反模式是「流程破坏」，命中即触发阶段回退（由门禁脚本或 CHECKPOINT 强制）；失败模式是「行为退化」，命中不触发回退但降低产物质量。二者互补：反模式关注「是否走完流程」，失败模式关注「流程中行为是否健康」。
>
> **与 4 条实现层经验教训（L1~L4）的关系**：L1~L4 是代码层教训（特定技术栈的具体坑），F1~F10 是行为层模式（跨技术栈的通用陷阱）。
>
> **登记规则**：Agent 重复命中同一失败模式 ≥2 次时，应在本节「实现层经验教训」登记为新 L# 教训（即 F# 退化如果具体化为代码层坑，升级为 L#），并在 SSoT [§10B.4](../../docs/skill-design-document_SSoT.md) 同步登记对应缺陷行。

### F1~F10 失败模式表

| # | 失败模式 | 检测信号（Agent 自查） | 与反模式 / 操作行为的关系 | 处理流程 |
|---|---|---|---|---|
| F1 | 静默假设未检查就推进 | 阶段产物中存在「未询问用户就采用的假设」（如默认技术栈、默认数据模型、默认错误码）；ingestion 场景：A-chunk 静默跳过疑似跨块关系而不在 `crossChunkHints` 登记 | 与 #9（谎报状态）互补：#9 是结果撒谎，F1 是过程撒谎；对应 §4A.1 行为 1「Surface Assumptions」 | ① 立即暂停推进；② 在产物「假设声明」节显式列出已采用的假设；③ 向用户确认假设是否成立；④ 假设被否决则回退到产物起点修正 |
| F2 | 困惑时不暂停、硬猜推进 | Agent 内部对话出现「这里不太确定，但应该是 X 吧」类语句；RTM 字段值与上游不一致但未提出 | 与 #8（越过 CHECKPOINT）互补：#8 是显式节点越过，F2 是隐式困惑越过；对应 §4A.1 行为 2「Manage Confusion Actively」 | ① STOP 当前任务；② 命名具体困惑（「RTM 的 REQ-001 与设计文档 SD-3.2 字段名不一致」）；③ 向用户提出具体澄清问题；④ 等待解决后再继续 |
| F3 | 注意到不一致但不指出 | Agent 跨文档扫描时发现术语 / 接口 / 字段冲突但未在产物「备注」节登记 | 与 #4（评审未通过悄悄小修）互补：#4 是评审后，F3 是评审中；对应 §4A.1 行为 3「Push Back When Warranted」 | ① 在当前产物「备注」节登记不一致点（位置 + 描述 + 影响）；② 在阶段门评审的 `reworkHints` 中以「[FYI] 跨文档不一致：xxx」前缀呈现；③ 由用户决定是否本阶段修复或下阶段修复 |
| F4 | 非显然决策不呈现 tradeoff | 设计文档 / 评审报告中只有结论无替代方案对比（如「采用 JWT」但无「vs Session vs OAuth」对比） | — | ① 在决策点补 tradeoff 表（选项 / 优势 / 劣势 / 选择理由）；② tradeoff 写入设计文档「技术选型」节或评审报告 `summary` 字段 |
| F5 | 对明显有问题的方案 sycophantic「当然可以」 | 用户提出违反硬约束的请求（如「跳过 CHECKPOINT」「估算覆盖率放行」），Agent 直接同意 | 对应 §4A.1 行为 3「Push Back When Warranted」 | ① 指出与哪条硬约束冲突（约束编号 + 原文）；② 量化代价（「跳过 CHECKPOINT 会导致用户失去决策权，后续阶段全部失真」）；③ 提出替代方案（「我可以加速但不跳过：把 CHECKPOINT 与下一阶段初始化合并展示」）；④ 接受用户在完整信息下的覆盖决策，但在产物「备注」节登记冲突 |
| F6 | 过度复杂化代码与 API | 代码中出现「资深工程师会问『为何不直接……』」的抽象；1000 行能 100 行完成；为单次使用建抽象层 | 对应 §4A.1 行为 4「Enforce Simplicity」 | ① 编码前自问「能否更少行？抽象是否物有所值？」；② 命中后在代码评审 `reworkHints` 中以「[Required] 过度复杂化：建议简化为 xxx」前缀呈现；③ 回到编码返工 |
| F7 | 修改任务外的代码或注释 | `git diff` 显示改动触及了规格外的文件（如修 bug 时顺手「清理」无关代码） | 对应 §4A.1 行为 5「Maintain Scope Discipline」 | ① 立即回滚任务外改动；② 如改动确有价值，单独创建任务处理；③ 在产物「备注」节登记「已识别但未处理的改进点：xxx」 |
| F8 | 删除未完全理解的代码 | Agent 删除了「看似无用」的代码 / 注释 / 配置但无法解释其存在原因 | 对应 §4A.1 行为 5「Maintain Scope Discipline」；与 Chesterton's Fence 原则冲突 | ① 立即恢复删除；② 通过 git blame / 提交历史 / 上下文调查代码存在原因；③ 如确认无用，在产物「备注」节登记「拟删除 + 调查证据」；④ 由用户决定是否删除 |
| F9 | 因「显而易见」而无规格就编码 | 阶段 5 编码开始但阶段 4 详细设计文档对该功能无对应条目；或测试设计前置约束被绕过 | 与 W 模型核心约束「测试设计前置」冲突 | ① 回到阶段 4 补详细设计 + 单元测试设计；② 不得以「这功能太简单不需要设计」为由跳过；③ 在阶段门评审中如发现此模式，`passed=false` |
| F10 | 因「看起来对」跳过验证 | 阶段产物已产出但未执行测试运行器 / 门禁脚本；或仅凭 LLM 文本说「通过」就推进；ingestion 场景：仅凭 A-cross/A-evolve 的 LLM 输出说「图谱已收敛」就推进，未跑 `check-requirement-graph.ts`（与 #12 互补） | 与 #3（估算质量门）/ #6（估算 RTM 覆盖率）互补；对应 §4A.1 行为 6「Verify, Don't Assume」 | ① 立即执行对应验证（单元测试 / `check-verifier-output.ts` / `check-artifact-gate.ts` / `check-requirement-graph.ts`（阶段 1-4 图谱门禁））；② 验证证据（退出码 + 输出摘要）写入产物「验证证据」节；③ 无证据不得推进 |

### 失败模式与反模式的对照

| 维度 | 反模式 #1~#46 | 失败模式 F1~F10 |
|---|---|---|
| 性质 | 流程破坏 | 行为退化 |
| 命中后果 | 立即回退到对应阶段起点 | 不回退，但降低产物质量 |
| 强制方式 | 门禁脚本退出码 / 🔴 CHECKPOINT | Agent 自检 / LLM-as-a-Verifier 在评审中标注 |
| 登记位置 | 《测试报告》「备注」节 + `reworkHints` | 阶段产物「备注」节 + `reworkHints`（前缀 `[FYI]` 或对应 Severity） |
| 升级规则 | 命中即升级，无升级概念 | 重复命中同一 F# ≥2 次 → 升级为新 L# 教训（如 F1 多次命中且具体化为某技术栈坑 → L5） |
| 与操作行为关系 | 部分反模式对应操作行为违反（如 #8 ↔ 行为 2） | 大部分失败模式直接对应操作行为违反（F1↔行为1 / F2↔行为2 / F5↔行为3 / F6↔行为4 / F7/F8↔行为5 / F10↔行为6） |

### 失败模式的标注约定

在阶段产物的「备注」节或评审报告的 `reworkHints` 中标注失败模式：

```
[F1] 阶段 1 需求规格 — 静默假设：默认采用 JWT 而非 Session，未询问用户
[F3] 阶段 2 系统设计 — 跨文档不一致：REQ-001 字段名 userId 与 SD-3.2 字段名 uid 冲突，未在产物登记
[F6] 阶段 5 编码 — 过度复杂化：src/utils/auth-helper.ts 为单次使用建了 3 层抽象
```

LLM-as-a-Verifier 在评审中识别到失败模式时，应在 `reworkHints` 中以 `[F#]` 前缀呈现，并在 `summary` 字段统计命中数（如「命中 2 条失败模式：F1 / F6」）。

### 与 addyosmani/agent-skills 的差异

| 维度 | addyosmani 原版 | W 模型适配版 |
|---|---|---|
| 失败模式触发后果 | 由 Agent 自检，无强制机制 | 命中不回退但须登记；重复 ≥2 次升级为 L# 教训 |
| 与反模式关系 | 失败模式与反模式未明确区分 | 明确二分：反模式 = 流程破坏（回退），失败模式 = 行为退化（登记） |
| 标注位置 | Agent 内部对话 | 阶段产物「备注」节 + 评审报告 `reworkHints`（`[F#]` 前缀） |
| 升级路径 | 无 | F# 重复命中 → L# 教训 → SSoT §10B.4 缺陷表（双向追溯） |
| 与操作行为对应 | 失败模式与 Core Operating Behaviors 一一对应 | 直接吸收对应关系，且与 W 模型 7 条硬约束互补 |

## 运维失败模式清单（O1~O6）

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/failure-modes.md`，适配 W 模型语境。SSoT [§4A.2a](../../docs/skill-design-document_SSoT.md) 为权威定义，本节为可执行细则。
>
> **与 46 条流程反模式（#1~#46）+ 10 条行为退化（F1~F10）的关系**：反模式是「流程破坏」（命中即回退，脚本守护），失败模式是「行为退化」（命中不回退但降低质量，Agent 自检），运维失败模式是「运行健康问题」（命中不回退但应标注，用户+系统协同检测）。三者互补形成三层架构：
>
> ```
> 层 1：流程反模式 #1~#46（命中即回退，脚本守护）
>   ↓ 互补
> 层 2：行为退化 F1~F10（命中不回退但标注，Agent 自检）
>   ↓ 互补
> 层 3：运维失败模式 O1~O6（命中不回退但标注，用户+系统协同检测）
> ```
>
> O 系列命中**不触发脚本回退**（与 F1~F10 同级），但应在 run-log 的 `note` 字段标注，并在阶段产物「备注」节或评审报告 `reworkHints` 中记录。O4/O5 直接关联 CHECKPOINT 有效性，命中时拒绝放行。

### O1~O6 运维失败模式表

| # | 失败模式 | 症状 | 与现有反模式/失败模式的关系 | 缓解措施 |
|---|---|---|---|---|
| O1 | **Token Burn**（子代理链对空/噪声 triage 全跑） | 单阶段 token 消耗异常高；ingestion 对低信息量输入仍全跑 A-chunk×N | 与 F10（跳过验证）互补：F10 是不验证，O1 是过度验证 | 预算检查（§10D）+ 早退：triage 发现空输入时 A-chunk 数=1；`budgetBurnRate` 触发 kill switch |
| O2 | **State Rot**（状态文件引用已合并/已废弃产物） | `rtm.json`/`graph.json` 引用已删除文件或已废弃 ID | 与 #9（谎报状态）互补：#9 是状态造假，O2 是状态腐烂 | 每阶段门 G 子代理校验产物路径存活（`ls`/`git status`）；ID 失活 → 标记并 prune |
| O3 | **Verifier Theater**（V 子代理"looks good"但 CI 挂） | V 评审 `passed=true` `qualityLevel=A` 但下游测试失败 | 与 #1（跳过评审）对立面：评审走了形式 | 强化 [verifier-spec.md](verifier-spec.md) §1 设计原则：V 默认拒绝姿态（"find reasons to reject"）；V 须引用具体 evidence 非空泛；G 校验 evidence 非空 |
| O4 | **Comprehension Debt Spiral**（用户橡皮图章 CHECKPOINT） | 用户对所有 CHECKPOINT 输入"确认"无修改意见；阶段产物无人理解 | 与 F5（sycophantic）互补：F5 是 Agent 奉承用户，O4 是用户奉承 Agent | 理解证据机制（[definition-of-done.md](definition-of-done.md) 第六维度）：放行前须填 `acknowledgedDecisions` ≥1 关键决策；空确认视为 O4 命中 |
| O5 | **Cognitive Surrender**（"循环处理了"无设计意见） | 用户放弃对设计/架构的意见；全权委托 Agent | 与 §4A.1 第 3 条（Push Back）对立面 | 阶段 2/4 设计 CHECKPOINT 强制用户提出 ≥1 修改意见或替代方案；无意见视为 O5 命中 |
| O6 | **Escalation Failure**（attempt cap 触发但无人被通知） | 返工达 `maxReworkRounds` 但用户未被告知；循环卡死 | 与 #8（越过 CHECKPOINT）互补：#8 是显式越过，O6 是隐式卡死 | attempt cap 触发 → run-log append `escalate` 记录 + 强制 🔴 CHECKPOINT 展示返工历史 |

### 检测信号与处理流程

> 与现有「检测信号与回退动作」节同构。O 系列命中不回退，但应在 run-log 的 `note` 字段标注，并在阶段产物的「备注」节或评审报告的 `reworkHints` 中记录。

| # | 检测信号（Agent 自查） | 命中后动作 | 关联机制 |
|---|---|---|---|
| O1 | `budget.json` 触发预算告警 / 单阶段 tokens > `maxTokens`×0.8 | 暂停后续子代理；展示消耗明细；询问降范围/增预算 | §10D 预算检查 |
| O2 | G 子代理校验产物路径时发现 `rtm.json`/`graph.json` 引用的文件不存在 | 标记失活 ID；prune 状态文件；run-log append note="O2 State Rot" | G 子代理职责扩展（路径存活校验） |
| O3 | V 评审 `passed=true` 但 G 门禁退出码 1（V 与 G 矛盾） | 标注 O3；V 评审降级重做（强化 evidence 引用）；run-log append note="O3 Verifier Theater" | [verifier-spec.md](verifier-spec.md) §1 设计原则 |
| O4 | 阶段门 CHECKPOINT 用户放行但 `acknowledgedDecisions` 为空/仅"确认" | 拒绝放行；要求用户填入 ≥1 关键决策摘要；run-log append note="O4 Comprehension Debt" | §10.6 第六维度（理解证据） |
| O5 | 阶段 2/4 设计 CHECKPOINT 用户无修改意见/替代方案 | 拒绝放行；要求用户提出 ≥1 修改意见或替代；run-log append note="O5 Cognitive Surrender" | 阶段 2/4 CHECKPOINT 强化 |
| O6 | attempt cap（`maxReworkRounds`）触发但无 `escalate` 记录 | 强制 🔴 CHECKPOINT 展示返工历史；run-log append action=escalate；询问降级/取消 | §10D killSwitch + 返工循环 |

### 运维失败模式的标注约定

在阶段产物的「备注」节或评审报告的 `reworkHints` 中标注运维失败模式：

```
[O1] 阶段 1 需求分析 — Token Burn：单阶段消耗 480k tokens（预算 500k），ingestion 对一句话输入跑了 8 个 A-chunk
[O3] 阶段 5 编码 — Verifier Theater：V 评审 qualityLevel=A 但单元测试 3 项失败，evidence 引用空泛
[O4] 阶段 2 系统设计 — Comprehension Debt：用户放行时 acknowledgedDecisions 为空，未填写关键决策摘要
```

LLM-as-a-Verifier 在评审中识别到运维失败模式时，应在 `reworkHints` 中以 `[O#]` 前缀呈现，并在 `summary` 字段统计命中数（如「命中 1 条运维失败模式：O3」）。

### 与 cobusgreyling/loop-engineering 的差异

| 维度 | loop-engineering 原版 | W 模型适配版 |
|---|---|---|
| 失败模式触发后果 | 由 loop 系统自检，无强制机制 | 命中不回退但须标注；O4/O5 命中时拒绝放行（直接关联 CHECKPOINT 有效性） |
| 与反模式关系 | 失败模式与反模式未明确区分 | 明确三层：反模式 = 流程破坏（回退），失败模式 = 行为退化（登记），运维失败模式 = 运行健康（标注） |
| 标注位置 | loop-run-log.md | run-log.jsonl 的 `note` 字段 + 阶段产物「备注」节 + 评审报告 `reworkHints`（`[O#]` 前缀） |
| 检测机制 | loop 系统自动检测 | 预算检查（O1/O6）/ 路径存活校验（O2）/ V-G 矛盾检测（O3）/ 理解证据机制（O4/O5）协同检测 |
| 与成熟度关系 | 无 | O 系列命中影响成熟度升级判定（L0→L1 需无 O 系列命中）与降级（连续命中触发自动降级回 L0） |

## 候选反模式检测信号（来自 Loop 4 爬坡循环）

> 来源：SSoT [§10G](../../docs/skill-design-document_SSoT.md)。Loop 4 的 HarnessImprovementReport（详见 [hill-climbing-guide.md](hill-climbing-guide.md)）产出候选反模式信号，人审后手动加入本清单。
>
> **与已收录反模式的关系**：已收录的 #1~#46 + F1~F10 + O1~O6 是技能包内置清单；候选反模式是 Loop 4 从 run-log 模式聚合产出的**待审**信号，须经人审 + 至少 2 个项目的回归验证后才正式加入清单。

### 候选反模式信号来源

Loop 4 的信号检测逻辑（确定性，无 LLM）会从 run-log 聚合以下模式作为候选反模式：

| 检测信号 | 来源 | 转正条件 |
|---|---|---|
| run-log note 字段反复出现同类问题（≥3 次跨 ≥2 阶段） | Loop 4 `anti-pattern` 信号类别 | 人审 + 2 项目回归验证 |
| V 评审 summary 跨阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符 | Loop 4 `prompt` 信号 + 信息熵检测 | 人审 + 2 项目回归验证 |
| V passed=true 但 G exit=1 频次 > 阈值（≥3 次/阶段） | Loop 4 `verification-rule` 信号 | 人审 + 2 项目回归验证 |
| L1+ 自动放行后误判率 > 10% | Loop 4 `maturity` 信号 | 人审 + 2 项目回归验证 |

### 候选反模式生命周期

```
Loop 4 产出候选信号（HarnessImprovementReport.recommendations.candidateAntiPatterns）
  ↓ 人审
人决定 adopt / defer / reject
  ↓ adopt 后
加入本节「待回归验证」清单
  ↓ 2 项目回归验证通过
正式加入 #1~#46 或 F1~F10 或 O1~O6 清单
```

### 待回归验证清单（初始为空）

> 本节随 Loop 4 报告累积。每条记录格式：`候选 ID | 描述 | 来源报告 ID | 首次发现时间 | 验证项目数`

| 候选 ID | 描述 | 来源报告 | 首次发现 | 验证项目数 |
|---|---|---|---|---|
| （初始为空） | | | | |
