# 第 28 轮设计规格：need_fix.md + 全量脚本 code-review 修正

- 日期：2026-07-31
- 状态：已批准（2026-07-31）
- 版本：26.0.0 → 27.0.0
- 触发：用户提供 `need_fix.md`（plan-chunks.ts 两处 bug）+ 要求先对全部技能脚本做一轮 code-review 再制定修正计划

## 1. 背景与范围

`need_fix.md` 报告 `w-model-dev/scripts/plan-chunks.ts` 两处 bug（estimateTokens 字符数低估 CJK / splitMarkdownByHeaders 分段逻辑）。按用户要求，先对全部技能脚本执行深度 code-review（5 组并行子代理，全部带最小复现验证），共发现约 66 项缺陷（P1×15 / P2×25 / P3×26，其中部分为同一设计冲突的两种面向）。

**用户决策**：
- D1 本轮一次修完全部 ~66 项；
- D2 签名链采用**跨阶段连续链**模型；
- D3 run-log R1 按阶段分档动作要求；
- D4 opsx 审查产物由**操作侧补产 stage 级 .md 文件**（`.w-model/r3-reviews/phase<N>-{stage}-{dim}.md` ×9 + `.w-model/v-reviews/phase<N>-{stage}.md` ×3）。

执行方式（方案 A）：按脚本域分 6 组修正，域内即时回归，全量完成后编排者做全量回归 + 文档版本同步。执行遵循 W-model 纪律：编排者只读，实施由子代理执行。

## 2. 已验证事实（抽查确认）

| 发现 | 验证方式 | 结论 |
|---|---|---|
| need_fix Bug 1：estimateTokens 用 `text.length` | 源码确认 + 1566 字中文实测 392 vs 真实 ~1173 | 确认，CJK 低估约 4 倍 |
| need_fix Bug 2："2 倍"复现 | 2000 组随机用例对照 reference 实现 | **未复现**；真实内核为"单节超限不二次切分"+"循环索引隐含依赖 split 语义"+围栏代码块 `#` 误切 |
| security-scan baseline 跨机器失效 | 本机实跑 exit=1；baseline 内为 Windows 绝对路径 | 确认 |
| check-requirement-graph --rtm 违规不重算 passed | 源码顺序确认（R6 push 在 passed 计算后） | 确认，永不拦截 |
| check-requirement-graph 豁免重算硬编码 roots===1 | 源码确认 | 确认，多 group 豁免永不生效 |
| ensure-codegraph-opsx --symbol 探针错误 + 全局配置污染 | 实跑（agent 已恢复全局配置，已复核干净） | 确认 |

## 3. 修复清单

### G-A plan-chunks.ts（need_fix 本体 + review 扩展）

| # | 修复 |
|---|---|
| A1 | `estimateTokens` 改为 `Math.ceil(Buffer.byteLength(text, 'utf8') / 4)` |
| A2 | `splitMarkdownByHeaders` 重写：header+content 正确配对（显式两两遍历而非奇偶索引推进）、围栏代码块感知（三反引号状态机，块内 `#` 行不切分）、单节超限按行二次切分（每节独立递归切分到 ≤maxTokens） |
| A3 | 非 md 行切分按累计字节数分块（废弃 `maxTokens*4 字符 ≈ 行数` 公式）；步长 `Math.max(linesPerChunk - overlap, 1)` 防无限循环 |
| A4 | 目录递归进入子目录（按目录树收集叶子文件） |
| A5 | `--max-tokens` 正整数严格校验（>0 整数，非法 exit 2） |
| A6 | 新增 `plan-chunks.test.ts` 单测（当前零覆盖）：CJK 字节估算、标题配对不丢内容、围栏代码块不切分、单节二次切分、目录递归、`--max-tokens` 非法值 exit 2 |

### G-B gate/verifier/schema/security

| # | 位置 | 修复 |
|---|---|---|
| B1 | gate-logic.ts P1-1 | SD→codeModule 校验与 code-tla-logic.ts 对齐：`SD-` 拆段为空时退化用 `cm.includes(\`${id}:\`)` 前缀匹配；`SD-5.2.1` 类数字层级 id 不再误报 |
| B2 | gate-logic.ts P2-1/P2-2 | coverageStatus 一致性改为行级比较：只对"该行自身是否完整"检查，不再与矩阵全局 coveragePercent 比较；coveragePercent 计算与 missingItems 联动 |
| B3 | gate-logic.ts P3-1 | checkUatPathMappingBackfill 对缺 actualPath/mappingType 的行加 guard |
| B4 | check-artifact-gate.ts P2-3 | uat-path-mapping 解析严格化：格式不符行记录 violation 不静默跳过；空表（mappings=[]）报错 |
| B5 | check-artifact-gate.ts P2-4 | phase 8 终检（默认）补 uat-path-mapping 校验，对齐 phase-8-acceptance-test.md 声明 |
| B6 | check-artifact-gate.ts P2-5 | parsePhaseArg 严格整数校验（`5abc`/`3.7` → exit 2） |
| B7 | security-scan.ts P1-2 | 指纹用 `path.relative(仓库根, file)` 归一化后再哈希；重新生成 `.eslintsecurity-baseline.json`（Linux 相对路径） |
| B8 | security-scan.ts P3-6 | `JSON.parse(r.stdout)` 容错（非 JSON 输出走 exit 2 而非崩溃） |
| B9 | check-verifier-output.ts P3-2 | `--s-output` 用 `indexOf('=')+slice` 切分；空值报输入错误 |
| B10 | schema-loader.ts P3-3 | 全部 schema 注册成功后再赋值 ajv 单例（注册失败清理重试） |
| B11 | verifier-logic.ts P3-4 | passed 基于降级后 compositeScore 重算（含 evidence 扣分后）；P3-5 isIso8601 死代码清理；P3-8 R11 死代码清理 |
| B12 | self-test.ts P3-7 | 补带 graph 的 gate 样本（`SD-5.2.1` 应通过、数字层级映射验证） |

### G-C graph/coverage/exemption

| # | 位置 | 修复 |
|---|---|---|
| C1 | check-requirement-graph.ts P1-1 | --rtm R6 检查移到 `checkRequirementGraph` 结果 passed 计算**之前**，违规并入 violations 参与最终 passed |
| C2 | check-requirement-graph.ts P1-6 | 豁免重算 roots 条件与 graph-logic.ts:771 对齐（纯 REQ 图 `isPhase1PureReq ? roots.length >= 1 : roots.length === 1`），消除多 group 豁免永不生效 |
| C3 | check-requirement-graph.ts P2-4 | 豁免前缀匹配兼容组合前缀（`R1-R4 …` 命中 ruleId `R1`） |
| C4 | check-requirement-graph.ts P3-4 | --phase 严格整数校验 |
| C5 | graph.schema.json P1-5 | 边对象加回 `sourceArtifact` 可选字段（语义来源占比功能复活）；graph-logic 语义占比统计恢复有效性 |
| C6 | graph-logic.ts P2-1 | warnings（边数下限/语义占比）落盘 GRAPH_JSON 并 stdout 输出 |
| C7 | coverage-logic.ts P3-2 | `--out-of-scope` 文件结构不符 → 报错 exit 2，不静默降级为 warning |
| C8 | coverage-logic.ts P3-3 | C9 missingIds 取需求 ID（如 `NFR-001`）而非类别名（`NFR`） |
| C9 | exemption-logic.ts P3-1 | 四阶段时间戳时序校验（submittedAt < reviewedAt < verifiedAt < decidedAt） |

### G-D TLA/BDD/code 一致性

| # | 位置 | 修复 |
|---|---|---|
| D1 | tla-logic.ts F1 + code-tla-logic.ts | cfg↔TLA 不变式正则兼容 `Invariants ==` / `BusinessInvariant ==` 两种命名（与 demo 实际用法一致） |
| D2 | tla-logic.ts F2 | INVARIANT 格式错误分支修复（不可达死分支删除或改为可达校验） |
| D3 | tla-logic.ts F3 | `@phase` 严格整数校验 |
| D4 | check-bdd-model.ts F5 | extractStateVarName 兼容 `TypeOK ==`（demo 实际命名）；D4 缺 --tla-manifest 时提示而非静默跳过 |
| D5 | tla-bdd-sync-logic.ts F6 | extractBddStateMachine 读 Scenario 体内步骤 + `# @states:`/`# @transitions:` 注释声明 |
| D6 | tla-bdd-sync-logic.ts F7 | 转移抽取支持 `\E ... :` 量化项 |
| D7 | tla-bdd-sync-logic.ts F8 | Next 体边界终止条件鲁棒化；`VARIABLES` 多行形式捕获全部变量 |
| D8 | check-design-contract-consistency.ts F4 | 路由元数据按**路由**提取（res.status/params/responseFields 归属具体路由而非整文件首个） |
| D9 | design-contract-logic.ts F9 | 路由查找失败 → 报 violation 不静默 continue |

### G-E 状态/日志/签名/归档/预防性

| # | 位置 | 修复 |
|---|---|---|
| E1 | signature-chain-logic.ts P1-1（D2 连续链） | R2 改为跨阶段连续链语义：`--phase=N` 时首条 prevSigId 允许指向上一阶段最后一条 sigId（校验其存在）；archive 全链模式保持连续链校验 |
| E2 | signature-chain-logic.ts P1-2 | R7 sourceSigIds 悬空校验放宽为"本阶段 ∪ 前一阶段" |
| E3 | signature-chain-logic.ts P3-10 | 各规则收集全部违规点，不首个命中即 break |
| E4 | check-signature-chain.ts P3-11 | 链文件路径显式传参并从其位置推导项目根；产物路径按 `.w-model/` 前缀解析 |
| E5 | run-log-logic.ts P1-3（D3 分档） | R1 按阶段分档：阶段 1-4 要求 chunk/cross/gate/checkpoint；阶段 5-8 要求 produce/review/gate/checkpoint（test/opsx/codegraph 视阶段动作清单） |
| E6 | run-log-logic.ts P2-7 | R3 返工计数按 phase + TLA target 过滤后对比 |
| E7 | run-log-logic.ts P2-8 | R6 对 gateExitCode=null 且设 gateLogPath 的条目判失败（不静默跳过） |
| E8 | run-log-logic.ts P3-13 | R7 返工时序扫第一个 `targetKind==='rootcause'` 的 review |
| E9 | run-log-logic.ts P3-17 | R3 rootcause↔fix 按 reportId 关联去重后再计数，允许 1:N |
| E10 | check-run-log.ts P2-5 | extractExitCode 模式表补齐全部 gate 标记（或改通用解析）；对无标记脚本补标记 |
| E11 | check-run-log.ts P2-6 | loadGateLogs 加载 gate-logs/ 下全部文件（不限 .log） |
| E12 | check-budget.ts P2-4 | tla-rework 死代码 → 统计改为 `action='rework'` 且 target 含 `tla` 的记录（按 phase 限定），阈值比较用该口径；同时 data-models.md 动作枚举说明同步 |
| E13 | check-maturity.ts P3-12 | O_PATTERN 词边界 `\bO[1-6]\b` |
| E14 | check-checkpoint.ts P3-14 | 前导零 filename 匹配 parseInt 归一 |
| E15 | checkpoint-logic.ts P3-16 | 字符计数用 `[...decision].length` |
| E16 | root-cause-logic.ts P3-9 | R10 校验任一有效 partialReport 含 reality-checker 角色（不限 method） |
| E17 | archive-integrity-logic.ts P3-15 | 文件存在性按归档清单预期相对路径精确匹配 |

### G-F opsx/codegraph

| # | 位置 | 修复 |
|---|---|---|
| F1 | ensure-codegraph-opsx.ts P1 | 探针命令改为 `codegraph query <search>`（位置参数）；探针移到 L3 `codegraph init` 之后执行，避免"未初始化"假阴性 |
| F2 | ensure-codegraph-opsx.ts P2 | `--phase` 非数字用 Number.isNaN 校验（exit 2） |
| F3 | ensure-codegraph-opsx.ts P3 | getArg 支持 `--name=value` 与 `--name value` 两种形式 |
| F4 | check-codegraph-queries.ts P2 | blastRadius/queryTimestamp 字段形状校验；F7 位置参数误解析 → 用法错误 exit 2 |
| F5 | check-opsx-artifacts.ts P2 | 校验该阶段**所有**变更目录（readdirSync 排序后逐个校验，全过才通过）；F6 精确前缀匹配 `phase<N>-` |
| F6 | check-openspec-archive.ts P2 | 精确前缀匹配 + 全部归档目录校验；F9 归档清单与归档前 REQUIREd 清单统一（tickets.md 一致性） |
| F7 | 操作文档（D4 决策） | SKILL.md / subagent-delegation.md / anti-patterns #39 同步新增"阶段 5-8 操作侧补产 stage 级 R3/V .md"约束：`.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md` ×9 + `.w-model/v-reviews/phase<N>-{explore,propose,coding}.md` ×3 |

## 4. 测试与回归

| 项 | 内容 |
|---|---|
| 新增单测 | plan-chunks.test.ts + 各域 logic 层新样本的 vitest（预计 205 → ~235） |
| self-test 基线 | 新增/更新样本：SD-5.2.1 gate、uat-path-mapping 严格解析、豁免多 group、签名链连续链、run-log 分档、opsx stage 级产物、R6 rtm 纳入 passed 等（预计 192 → ~215） |
| security-scan | 指纹归一化后重新生成 `.eslintsecurity-baseline.json`，本机 `npm run lint:security` 转绿 |
| 全量回归 | `npm run self-test` + `npx vitest run scripts/__tests__/` + `npm run lint:security` + `npm run prepush` 全绿；TypeScript strict 0 错误 |
| 预检 | 修复前先跑一次现有全量基线（192/205 绿）作为回归对照 |

## 5. 文档与版本同步

| 文件 | 内容 |
|---|---|
| SSoT | §3.4.24 第 28 轮记录 + §10A 追溯表补行 |
| CHANGELOG.md | `[27.0.0]` 条目 |
| 版本号三处 | package.json + SKILL.md frontmatter + skill-metadata.json → 27.0.0 |
| AGENTS.md | §4 round28 记录 + §8 基线计数同步 |
| README/CONTRIBUTING/INSTALL | 基线计数、反模式总数、脚本表 |
| references | signature-chain-guide（连续链）、data-models（run-log 分档/tla-rework）、subagent-delegation（opsx 补产约束）、anti-patterns #39、phase-8-acceptance-test（uat-path-mapping 终检）、SKILL.md（D4 约束） |
| need_fix.md | 修复完成后删除 |

## 6. 执行顺序（方案 A，6 组域内回归 + 全量）

1. 预检现有全量基线
2. G-A plan-chunks → 域内回归
3. G-B gate/verifier/schema/security → 域内回归
4. G-C graph/coverage/exemption → 域内回归
5. G-D TLA/BDD/code → 域内回归
6. G-E 状态/日志/签名/归档/预防性 → 域内回归
7. G-F opsx/codegraph + 操作文档补产约束 → 域内回归
8. 全量回归 + security-scan baseline 重生成 + 文档版本同步 + commit

## 7. 风险与对策

- 范围大（~66 项）：按域分批，每域子代理独立上下文，域内回归即时隔离问题；
- 语义改动（签名链/run-log R1/opsx 产物）：均已有用户决策（D2/D3/D4），实施按决策执行；
- baseline 重生成：需在指纹归一化**之后**再生成，避免再次锁入绝对路径；
- 行为变化（uat-path-mapping 严格化、warnings 落盘）：可能暴露既有 demo 产物不合规，需在回归阶段确认样本与文档同步更新。
