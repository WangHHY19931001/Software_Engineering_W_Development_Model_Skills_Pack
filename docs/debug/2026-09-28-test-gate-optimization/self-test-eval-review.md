# self-test / eval 重审登记表（Task 13 · Wave 3 收尾）

- 日期：2026-09-29；分支：`feat/test-gate-optimization`（Task 12 批 E 之后、收口 prepush 前）
- **触发条件判定**：Task 12 五批（A–E）累计实测净减 743（238+169+175+119+42），投影终态 2631−743=1888 ≤ 2100 硬线（计划 Task 12 Step 3 口径）→ **条件补充删减面未触发**。本表按计划 Task 13 定位仅为**诚实登记**（不硬凑）：每行给出保留理由或「可合并 / 可退休」潜在性判断，不构成执行清单；唯当未来计数突破 2100 时，才把「可合并 / 可退休」行转为执行清单（届时删减同样须登记「仍被覆盖指向」）。
- **扫描口径**：
  - self-test：`w-model-dev/scripts/cli/self-test.ts` 以 `const *_CASES` 清点得 **46 张常量表、静态 380 条**；运行时口径 381 = 380 + Metadata 用例 1（`self-test.ts` 汇总段 `Metadata 用例 : 1`，程序化单例，无常量表），与 CHANGELOG [42.4.0] `self-test 381→381` 一致，无登记缺口。
  - eval：`eval/w-model-dev-test-prompts.json` **60 条**（route=enable 12 / ask 8 / skip 22 / 无 route 字段 18——后者为流程防护、异常恢复、跨平台、工具边界、新机制场景）+ `eval/mappings.json` **60 条**（layer L1=20 / L1N=22 / L2=18；`matrix.routeTotals` 与语料 route 计数自洽、`minPerCategory=2`）。`eval/e2e/*`、`results.json`、`w-model-dev-results.tsv` 为基线/记录资产，不在重审面。
  - 判据：同目标脚本、同三态（0/1/2 或 true/false）、输入仅微差；语料同 route 分组计数 >8 的组（skip=22、无 route=18）优先看。
- **结论先行**：**不存在大面积同质对**。self-test 侧最大的同构簇是「阶段结构/增强校验」8 表 × 4 条（32 条同形态），但每表锚定各自阶段的模板契约与规则对（R7/R8…R13/R14），属参数化设计并行的有意形态；eval 侧的「成对」条目由 `matrix.minPerCategory=2` 按设计强制（每类别 ≥2 条边界样本），精确重复文本为 0。

## 重审表

| 面 | 条目 | 同质对象 | 裁定（保留理由 / 可合并 / 可退休） |
| --- | --- | --- | --- |
| self-test | VERIFIER_CASES#2–#5（persona-*.json 四连正例） | 同目标 check-verifier-output、同 expectedPassed=true，输入仅 persona 名微差 | 保留：四份样本各自锚定一个 persona 的 Schema 可执行样例（subCriteria 标准集合按 persona 互异，非纯复制）；可合并潜在性低 |
| self-test | SCHEMA_CASES 全表 17 条（additionalProperties ×5 / required ×7 / wrong-type ×4 / enum ×1） | 同三态（schema 级 `[schema]` 拦截）、同关键词族跨行重复 | 保留：逐 `.w-model` schema 文件至少一条负向 schema 级探针，行与行锚定**不同 schema 文件**（per-file 覆盖即目的）；同关键词跨文件不共享 fixture，可合并潜在性低 |
| self-test | SPEC_STRUCTURE / PHASE2/3/4_SPEC_STRUCTURE / SPEC/DESIGN/OUTLINE/DETAILED_ENHANCE 八表 × 4 条（valid + 2 反例 + missing-section，共 32 条同形态） | 八表同构三态序列；结构四表 runner 已按 phase 参数化（`checkPhaseSpecStructure(N,…)`） | 保留：每表锚定各自阶段的模板契约（引用块集合 / SSOT 头 / DoD 项数）与专属规则对（R7/R8、R9/R10、R11/R12、R13/R14），输入非微差而是按阶段独立 fixture。可合并潜在性中：若未来触发删减面，结构四表可先并「共享表 × phase 参数」形态（enhance 四表规则对互异，不建议并）；当前非瓶颈不动 |
| self-test | GRAPH_CASES#3/#4/#5 与 #21/#22（orphan / multi-root / multi-parent 两轮出现） | 表面同形的孤立节点 / 多父负例 | 保留：前者走通用连通性 / 单根 / 父唯一判据，后者走四维维度 1 的 R2 专用规则集，规则路径与 fixture 均不同；非同质（登记以免未来误判重复） |
| self-test | GRAPH_CASES#26/#27（depends-on 环 vs precedes 环） | 同目标、同 exit 1、仅边类型微差 | 保留：R5 两条无环子规则各自防一条回归；可合并潜在性低 |
| self-test | TLA_CASES#9（bad-coverage-missing-sd，2/11 覆盖）与 #15（bad-coverage-uncovered-sd，SD-002/003 未覆盖） | 同覆盖规则双 fixture，reason pattern 互为超集（`/未被任何 TLA\+ spec 覆盖/` ⊂ `/SD 节点未被任何…/`） | 可合并潜在性中-高（本表最接近真同质对的一行）：#15 已登记为 check-samples-coverage 孤儿样本引用（NEGATIVE-COVERAGE 闭环锚），退休须先迁锚；删减面未触发，保留 |
| self-test | RUN_LOG_CASES#2 与 #10（阶段 1 缺 chunk vs 阶段 5 缺 produce） | 同 R1 完整性规则、同 exit 1 | 保留：R1 阶段分档两档（1–4 要求 chunk/cross；5 要求 produce）各档一负例 |
| self-test | UAT_PATH_MAPPING_CASES#3/#4（行畸形：单元格 <4 vs 空单元格） | 同「记录 violation 不静默跳行」语义、输入微差 | 保留：两条解析子分支、violation 文案互异（`/行畸形/` vs `/含空单元格/`）；可合并潜在性低 |
| self-test | CODE_HEALTH_PHASE4_CASES#3–#7（test-only / platform / error / security / lifecycle 不授权）与 #9–#11（generated / one-off / deadcopy 三排除标记） | #9–#11 同形：仅 tracked record marker 值微差，同「排除、绝不授权」裁定 | 保留：11 维逐项等价证明每维一负例，删任一维即失去该维回归。#9–#11 可合并潜在性中（marker 参数化循环可替），但 self-test 为手写常量表非 vitest it.each，改造成本 > 收益 |
| self-test | STATE_MACHINE_CASES#1/#2（缺转移 vs 多转移） | 同规则互补方向对 | 保留：集合相等判定双向各一，删任一侧即失去方向性回归 |
| self-test | CODE_TLA_CASES#2–#5；CODEGRAPH_QUERY_CASES#2–#4 | 逐维度 / 逐必填字段渐次缺失（callers+callees → blastRadius） | 保留：每维度 / 每必填字段一负例，字段独立必填；#3/#4 可合并潜在性低 |
| self-test | EXEMPTION_CASES#5（bad-r-template-review） | E6 规则与 schema minLength:30 前置拦截冗余 | 保留：行描述已自注冗余，属**有意纵深防御**登记（schema 层 + 规则层独立拦截各自可回归）；可退休潜在性无 |
| self-test | VERIFIER_CASES#27/#28（valid-rootcause / bad-rootcause-subcriteria） | targetKind=rootcause 合法 / 误用 test 集合一对 | 保留：§7.5 子标准集合校验正反两侧 |
| self-test | COVERAGE_SCOPE_CASES#1/#2（同 fixture valid.json 双阈值） | 同输入不同 thresholds 配置 | 保留：同输入走 passed 两分支（阈值口径两侧 + functions 不低于阈值不计入细则）；配置维度差异非同质 |
| self-test | GATE_CASES#10/#11（同 fixture bad-phase5-missing-codemodule 跨 phase=5/8） | 同输入不同 `--phase` 档位 | 保留：SD→codeModule 终检跨档复用回归；配置维度差异非同质 |
| self-test | ROLE_DISPATCH_CASES#1–#3；SIGNATURE_CHAIN_CASES#10/#11（S 消费 G vs R 消费 S） | 同完整性 / R9 规则的互补角色分支 | 保留：角色分派三分支（V/G/R3）与 R9 双向越权各一负例；可合并潜在性低 |
| self-test | RUN_LOG_APPEND_CASES#1/#4/#5（时间戳步进三形态） | 同追加器时间戳语义近邻 | 保留：三态口径各一（③良性步进 / --allow-clock-adjust 显式放行 / 批内严格递增），正对应 command-reference「时间戳三态」枚举的②③分叙事 |
| self-test | PREVENTIVE_REVIEW_CASES#1–#3（全 expectedPassed=false 三连） | 同目标同三态三 fixture | 保留：分别锚定「单维度合规但整体不通过」「schema 缺 evidence」「checker 必须读取 passed 字段」三条不同断言 |
| eval | 语料 route=skip 组 22 条（N1–N10 十类反误触发，每类 2–3 条） | 同 trigger 边界（skip）最大分组（>8 优先看） | 保留：`matrix.minPerCategory=2` 按设计强制每类别 ≥2 条边界样本；同类两条覆盖**不同任务型边界**（如 N2=样式调整 vs 错别字），精确重复文本 0；交付资产（60 条提示词随仓交付），可合并 / 可退休均不适用 |
| eval | 语料无 route 组 18 条（id 8–25：流程防护 / 异常恢复 / 跨平台 / 工具边界 / 新机制） | 同「流程内」触发面的大组（>8 优先看） | 保留：18 条各锚定一个互异机制或反模式（伪造测试通过、ICEBERG-B、self-as-verifier 同路径、编排者越权 #10、gate-logs exitCode 伪造……），零重复；交付资产 |
| eval | 语料 id 5 vs id 55（英文触发对，唯一共享 12 字符前缀 "Use the W-mo"） | 全语料唯一一对前缀相近条目 | 保留：断言焦点互异（id5=触发词同义词 W-model/RTM/stage gates；id55=并行测试设计 + 追溯变体），enable 路由英文变体由矩阵覆盖；已逐条核实非重复 |
| eval | mappings.json 60 条（L1=20 / L1N=22 / L2=18） | 与语料 60↔60 一一对应，无重复锚 | 保留：每条含 layer+route+assertions+evidence 四元组，`matrix.routeTotals` 与语料计数自洽（eval 断言引擎消费，属运行资产而非纯文档） |

## 附注

- self-test 为**进程内非瓶颈**（380 常量表条目 + 1 Metadata 用例，随 prepush 一次性运行），vitest 侧同质聚合（Wave 3 净减 743）不构成对 self-test 常量表删减的理由；两套样本体系相互独立（self-test 走 `samples/` fixture + logic 层函数直调）。
- 本表登记的「可合并潜在性」行（结构八表、TLA 覆盖对、Phase4 marker 三连）若未来被启用为删减清单，须逐行先落实「仍被覆盖指向」（如 #15 的 check-samples-coverage 孤儿样本锚迁移）再动手。
- 扫描方式：`grep -n "const [A-Za-z_]*_CASES"` 46 表定位 + 逐表静态清点（脚本口径 `^  \{` 条目计数）+ 逐条目 outcome/description 提取比对；eval 侧 `find eval -type f` 分组 + JSON 结构化比对（精确重复 0、前缀相近 1 对并逐条核实）。
