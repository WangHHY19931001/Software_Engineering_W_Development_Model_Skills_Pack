# 第 30 轮实施计划：Schema 字段描述增强 + 敏感信息脱敏条款 + npm audit 门禁

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成第 30 轮低风险批三项：#13 为 19 份 schema 全量字段补 description、#8 新增反模式 #43 敏感信息脱敏条款、#7 pre-push 新增 npm audit（warn-only），版本号三处同步 30.0.0。

**Architecture:** 纯文档 + 门禁脚本增量。schema 只加 `description` 关键字（ajv draft-07 忽略，校验行为不变）；anti-patterns.md 追加 #43；pre-push 追加 warn-only 的 npm audit 检查。回归基线（self-test 213 条 / vitest 297 条）必须全部保持通过。

**Tech Stack:** TypeScript（tsx runtime）、JSON Schema draft-07、ajv、bash（pre-push hook）。

**设计文档:** `docs/superpowers/specs/2026-08-05-round30-schema-desc-redaction-audit-design.md`（commit 53fdfce）

**版本基线（当前）:** package.json `29.0.0` / skill-metadata.json `29.0.0` / SKILL.md frontmatter `29.0.0` / CHANGELOG 最新 `[29.0.0] - 2026-08-05` / anti-patterns 最新 #42 / pre-push 11 项。

---

## 关键约定（所有 schema 任务共同遵守）

1. **只加 `description`**：不增删任何字段、不改 `type` / `enum` / `pattern` / `minimum` / `maximum` / `required` / `additionalProperties` / `$ref`。插入位置为每个 property 定义的首行（保持键顺序不变）。
2. **描述口径来源**：字段语义以 `w-model-dev/references/data-models.md`、对应 `*-logic.ts` 校验逻辑、`docs/skill-design-document_SSoT.md` §7 数据模型为权威；描述须与其一致，不得臆造。
3. **描述内容格式**：`用途 + 期望值`。期望值含合法取值 / 单位 / 一致性约束引用（如「0-1 小数」「对应 rtm.rows[].requirementId」）。中文书写。
4. **JSON 语法**：每个 schema 修改后用 `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"` 验证。
5. **不做版本号/文档同步**：Task 4 统一处理。

---

### Task 1: Group A 核心 6 份 schema 字段 description（rtm / run-log / verifier-output / graph / tla-manifest / budget）

**Files:**
- Modify: `w-model-dev/schemas/rtm.schema.json`
- Modify: `w-model-dev/schemas/run-log.schema.json`
- Modify: `w-model-dev/schemas/verifier-output.schema.json`
- Modify: `w-model-dev/schemas/graph.schema.json`
- Modify: `w-model-dev/schemas/tla-manifest.schema.json`
- Modify: `w-model-dev/schemas/budget.schema.json`

- [ ] **Step 1: 为 rtm.schema.json 全字段补 description**

按「关键约定」为以下字段补 `description`（含已存在的 targetValue/testThreshold 保持不动）：
- 顶层：`schemaVersion, projectId, currentPhase, lastUpdated, rows, executionSummary`
- `rows[].{requirementId, description, designDoc, codeModule, unitTest, integrationTest, systemTest, acceptanceTest, coverageStatus}`（coverageStatus 描述须注明：`"100%"` 时 coveragePercent 须=100，`"部分"` 时须<100，`"待覆盖"` 违反约束 #18；targetValue/testThreshold 已有 description 不动）
- `executionSummary.{unitTest, integrationTest, systemTest, acceptanceTest}`（注明：四级测试汇总，对应门禁四级测试校验）
- `$defs.testSummary.{total, passed, failed, pending, coverage}`（注明：passed+failed+pending 必须等于 total，违反被 count-invariant 拦截；coverage 为百分比 0-100）

语义参考：`gate-logic.ts` `RTMMatrixShape` / `checkArtifactGate`；`data-models.md` RTM 节。

- [ ] **Step 2: 为 run-log.schema.json 全字段补 description**

顶层：`runId, timestamp, phase, phaseName, action, duration_s, tokens, estimated, subagentSpawns, gateExitCode, gateLogPath, outcome, acknowledgedDecisions, note, artifacts, reportId, rootCauseCategory, upstreamDefect, rollbackRecommended, basedOnReport, rtmDiff, targetKind, target, qualityLevel, passed, reworkHints, round, script`（`role` 已有 description 不动）。
- `action` 描述须列出全部枚举值含义（chunk/cross/evolve/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback/rootcause/fix/emergency-fix/escalate/r3-*/codegraph_query/opsx_*/ensure_deps），并注明 action 与 role 配对约束（如 gate 由 G 执行）。
- `rtmDiff` 描述注明：S 产出后 RTM 增量回填差异记录（约束 #18）。

语义参考：`run-log-logic.ts` R1-R8 校验；`data-models.md` RunLogEntry 节；SKILL.md 约束 #19。

- [ ] **Step 3: 为 verifier-output.schema.json 全字段补 description**

顶层：`schemaVersion, meta, subCriteria, compositeScore, qualityLevel, summary, passed, reworkHints, ranking`；
- `meta.{targetKind, target, reviewedAt, agent, scoringMethod, repeatTimes, varianceThreshold}`（targetKind 枚举含义：requirement/design/code/test；varianceThreshold 注明防漂移校验阈值 [0,0.1]）
- `subCriteria[].{name, description, weight, score, rawScores, variance, evidence}`（score 与 weight 一致性：compositeScore = Σ(score×weight) 防漂移；rawScores 用于方差重算）
- `ranking.{algorithm, k, temperature, rounds, ordered}`（algorithm 固定 PPT；ordered 不得含重复候选项）

语义参考：`verifier-logic.ts` 防漂移校验（P3.10）；`references/verifier-spec.md` §7 Schema。

- [ ] **Step 4: 为 graph.schema.json 全字段补 description**

顶层：`version, project, currentPhase, rootId, nodes, edges, analysisRounds`；
- `nodes[].{id, type, phase, title, summary, sourceChunk, sourceArtifact, attributes, governance, derivationProduct, level, priority, reqGroup}`（type 枚举含义：REQ/SD/INTF/DD/EXT-IN/EXT-OUT；level 注明 REQ 层级 1-4 强制必填，约束 #15；governance 注明 governs 边源须为治理类）
- `edges[].{from, to, type, sourceArtifact}`（type 枚举含义 12 种：parent/depends-on/implements/defines/realizes/produces/governs/collaborates-with/derives/precedes/conflicts-with/cross-cuts；from/to 引用 nodes[].id）
- `analysisRounds[].{phase, round, timestamp, violations, converged}`

语义参考：`graph-logic.ts` R1-R6 / 信息流校验；`references/graph-guide.md`。

- [ ] **Step 5: 为 tla-manifest.schema.json 全字段补 description**

顶层：`version, project, currentPhase, basePath, tools, specs, graphSdNodes, checkRounds`；
- `tools.{jarPath, javaMinVersion}`（注明 SANY/TLC 依赖 Java + tla2tools.jar）
- `specs[].{id, level, phase, system, requirementIds, designRef, tlaPath, cfgPath, parent, siblings, children, variableCombination, decompositionDecision, syntaxChecked, tlcChecked, deadlockFree, invariantsHold, stateExplosion, lastCheckTimestamp, tlaContent, cfgContent}`（level 枚举 L1-L6；decompositionDecision 注明 variableCombination>10000 须 split-done；各布尔标志为真实 SANY/TLC 结果，禁止占位，反模式 #16）
- `checkRounds[].{phase, round, timestamp, specId, syntaxCheck, tlcCheck, violations, converged}`

语义参考：`tla-logic.ts`；`references/tla-plus-guide.md`。

- [ ] **Step 6: 为 budget.schema.json 全字段补 description**

顶层：`schemaVersion, projectId, createdAt, updatedAt, perPhase, project, onExceed, killSwitch`；
- `perPhase.{maxTokens, maxSubagentSpawns, maxReworkRounds}`
- `project.{maxTokensTotal, maxTokensPerSession}`
- `onExceed`（枚举 pause/notify/halt 含义）
- `killSwitch.{consecutiveReworks, budgetBurnRate, tlaReworks}`（budgetBurnRate 注明 [0,1]，超出被 schema maximum 拦截）
- `rootcauseParallelBudget.{maxPersonasPerRound, maxTokensPerPersona, maxTotalTokensPerRound}`
- `rootcauseRounds[].{round, personas, totalTokens}` 及 `personas[].{personaSlice, tokens}`

语义参考：`budget-logic.ts` R1-R5 / R4-A；`references/operational-recovery.md`「成本预算与运行日志」节。

- [ ] **Step 7: JSON 语法验证 6 份**

Run（在仓库根目录，PowerShell）:
```powershell
node -e "['rtm','run-log','verifier-output','graph','tla-manifest','budget'].forEach(n=>{const p='w-model-dev/schemas/'+n+'.schema.json';JSON.parse(require('fs').readFileSync(p,'utf8'));console.log('OK',p)})"
```
Expected: 6 行 `OK ...` 无异常。

- [ ] **Step 8: 提交**

```bash
git add w-model-dev/schemas/rtm.schema.json w-model-dev/schemas/run-log.schema.json w-model-dev/schemas/verifier-output.schema.json w-model-dev/schemas/graph.schema.json w-model-dev/schemas/tla-manifest.schema.json w-model-dev/schemas/budget.schema.json
git commit -m "docs(schemas): Group A 6 份 schema 全字段 description（rtm/run-log/verifier-output/graph/tla-manifest/budget）"
```

---

### Task 2: Group B 5 份 schema 字段 description（bdd-manifest / coverage / exemption / rootcause-report / signature-chain）

**Files:**
- Modify: `w-model-dev/schemas/bdd-manifest.schema.json`
- Modify: `w-model-dev/schemas/coverage.schema.json`
- Modify: `w-model-dev/schemas/exemption.schema.json`
- Modify: `w-model-dev/schemas/rootcause-report.schema.json`
- Modify: `w-model-dev/schemas/signature-chain.schema.json`

- [ ] **Step 1: 为 bdd-manifest.schema.json 全字段补 description**

顶层：`schemaVersion, projectId, basePath, currentPhase, features, stateMachines, checkRounds`；
- `features[].{id, level, filePath, scenarioCount, stateMachineId, tlaSpecId, reqIds, designIds, parentFeatureIds, siblingFeatureIds, childFeatureIds}`（level 1-4 与 TLA+ 层次对齐；tlaSpecId 指向 tla-manifest specs[].id，D4 等价性校验用）
- `stateMachines[].{id, level, states, initialState, terminalStates, acceptingStates, rejectingStates, transitions, invariants}`（七要素，D3 完整性校验）
- `transitions[].{from, event, to, guard, action}`（D6 路径合法性校验用）
- `checkRounds[].{phase, round, timestamp, violations, converged}`

语义参考：`bdd-logic.ts` D1-D7；`references/bdd-guide.md`。

- [ ] **Step 2: 为 coverage.schema.json 全字段补 description**

顶层：`stakeholders, scenarios, requirementTypes, crossCuts, metrics`；
- `stakeholders[].{id, role, relatedReqs, status, gapDescription}`（status 枚举 covered/partial/missing；partial/missing 须 gapDescription，C1-C8 校验）
- `scenarios[].{id, description, steps, relatedReqs, status, scenarioType, gapDescription}`（scenarioType happy/error/boundary，C4 校验须三类齐）
- `requirementTypes[].{type, reqIds, status, gapDescription}`（type REQ/NFR/CON）
- `crossCuts[].{nfrConId, governedReqs, status, gapDescription}`（C7 与 graph cross-cuts 双向一致）
- `metrics.{stakeholder, scenario, requirementType, crossCut}`（0-1 小数，C10 重算一致性）

语义参考：`coverage-logic.ts` C1-C10；`references/phase-1-requirements.md` 覆盖分析节。

- [ ] **Step 3: 为 exemption.schema.json 全字段补 description**

顶层：`id, type, target, ruleId, justification, evidence, proposedAlternative, submittedAt`；
- `type` 枚举 5 类豁免含义（small-project-hierarchy / stakeholder-not-applicable / scenario-type-not-applicable / coverage-missing-declared / nfr-subtype-not-applicable）
- `review.{reviewDecision, rootCauseAnalysis, falsifiabilityCheck, riskAssessment, conditions, reviewedAt}`（E4/E5/E6 校验：reviewDecision=approve、rootCauseAnalysis≥30 字符）
- `verification.{verified, reworkHints, verifiedAt}`（E7）
- `humanDecision.{decision, decidedAt, decidedBy}`（E8 人类确认）

语义参考：`exemption-logic.ts` E1-E8；`references/phase-1-requirements.md` 豁免审批节。

- [ ] **Step 4: 为 rootcause-report.schema.json 全字段补 description**

顶层：`schemaVersion, meta, input, phenomenon, rootCauseChain, rootCause, upstreamDefect, fixRecommendation, prevention, qualityLevel, passed, summary, reviewNotes, partialReports`；
- `meta.{reportId, targetKind, targetArtifact, targetPhase, reworkRound, reworkSource, persona, method, analysisTimestamp}`（targetKind 固定 "rootcause"；method 枚举 5-why/fishbone/defect-chain/upstream-trace/combined）
- `input.{reworkHints, verifierOutputPath, gateJsonPath}`
- `phenomenon.{summary, severity, affectedArtifacts}`
- `rootCauseChain[].{step, why, answer, evidence}`（R2 minItems 2）
- `rootCause.{category, description, evidence, falsifiabilityCheck}`（category 枚举 7 类；R3 可证伪句式）
- `upstreamDefect.{present, upstreamPhase, upstreamArtifactId, defectDescription, rollbackRecommended}`（R6 present=true 须 upstreamPhase）
- `fixRecommendation[].{target, location, action, rationale}`（R4）
- `prevention[].{scope, measure, owner}`（R5）
- `partialReports[].{personaSlice, path, confidence}`（R9/R10 reality-checker）

语义参考：`root-cause-logic.ts` R1-R10；`references/root-cause-locator.md`。

- [ ] **Step 5: 为 signature-chain.schema.json 全字段补 description**

顶层：`sigId, phase, phaseName, role, action, runId, artifacts, prevSigId, prevSigHash, sigHash, signedAt, signer, gateExitCode, gateLogPath, inputProvenance`；
- `sigId`（格式 `wm\d+-r\d+-[OSAVGR]` 或 `genesis`，R4 校验）
- `prevSigId / prevSigHash / sigHash`（R2 链式连续性 / R6 篡改检测）
- `inputProvenance.{sourceSigIds, sourceArtifacts, transformDescription}`（产出来源正确性，R7/R9 消费者校验）
- `sourceArtifacts[].{path, sourceSigId, sourceRole}`（R8 产物存在性）

语义参考：`signature-chain-logic.ts` R1-R10；`references/signature-chain-guide.md`；SSoT §7.9。

- [ ] **Step 6: JSON 语法验证 5 份**

Run:
```powershell
node -e "['bdd-manifest','coverage','exemption','rootcause-report','signature-chain'].forEach(n=>{const p='w-model-dev/schemas/'+n+'.schema.json';JSON.parse(require('fs').readFileSync(p,'utf8'));console.log('OK',p)})"
```
Expected: 5 行 `OK ...`。

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/schemas/bdd-manifest.schema.json w-model-dev/schemas/coverage.schema.json w-model-dev/schemas/exemption.schema.json w-model-dev/schemas/rootcause-report.schema.json w-model-dev/schemas/signature-chain.schema.json
git commit -m "docs(schemas): Group B 5 份 schema 全字段 description（bdd-manifest/coverage/exemption/rootcause-report/signature-chain）"
```

---

### Task 3: Group C 5 份 schema 字段 description（code-tla-manifest / design-contract / event-ingress / hill-climbing-report / maturity）

**Files:**
- Modify: `w-model-dev/schemas/code-tla-manifest.schema.json`
- Modify: `w-model-dev/schemas/design-contract.schema.json`
- Modify: `w-model-dev/schemas/event-ingress.schema.json`
- Modify: `w-model-dev/schemas/hill-climbing-report.schema.json`
- Modify: `w-model-dev/schemas/maturity.schema.json`

- [ ] **Step 1: 为 code-tla-manifest.schema.json 全字段补 description**

顶层：`manifest, graph, rtm, codeSources`（注明：函数运行时接收 codeFiles 含 AST，本 schema 兼容 codeSources 形态；manifest/graph/rtm 允许额外字段）；
- `manifest.specs[].{id, level, phase, system, requirementIds, tlaPath, cfgPath, parent, children, siblings, tlaContent}`
- `graph.nodes[].{id, type}`、`graph.edges[].{from, to, type}`
- `rtm.rows[].{requirementId, codeModule}`（维度 1 SD→codeModule 映射）
- `codeSources[].{path, content}`

语义参考：`code-tla-logic.ts` 四维度校验；`references/tla-plus-guide.md`「代码-TLA+ 一致性」节。

- [ ] **Step 2: 为 design-contract.schema.json 全字段补 description**

- `uatPathMappings[].{uatId, designPath, actualPath, mappingType}`（mappingType 直接/等价/替代；D1 路径一致性）
- `routeDefinitions[].{method, path, params, successStatus, responseFields}`（D2/D3 参数与状态码）
- `acceptanceAssertions[].{uatId, method, path, params, expectedStatus, assertedFields}`（D4 响应字段）

语义参考：`design-contract-logic.ts` D1-D4；SSoT §10I。

- [ ] **Step 3: 为 event-ingress.schema.json 全字段补 description**

顶层：`eventId, timestamp, source, eventType, summary, affectedArtifacts, affectedRequirements, evidence, routedTo`；
- `source` 枚举 6 类来源含义（webhook/cron/user-report/ci/external-agent/manual）
- `eventType` 枚举 9 类事件含义（bug-report/feature-request/requirement-change/scheduled-review/test-failure/gate-failure/rework-request/escalation/user-checkpoint）
- `routedTo.{phase, phaseName, routedAt, highRiskGate}`

语义参考：`references/event-ingress-guide.md` 路由表；`data-models.md` EventIngress 节。

- [ ] **Step 4: 为 hill-climbing-report.schema.json 全字段补 description**

顶层：`reportId, generatedAt, analysisWindow, signals, metaAnalysis, recommendations`；
- `analysisWindow.{from, to, runLogEntries, phasesCovered}`
- `signals[].{signalId, category, severity, evidence, suggestion, affectedAssets, priority}`（priority 1-5）
- `evidence.{runLogRefs, patterns, metrics}`、`metrics.{occurrences, trend}`（trend stable/increasing/decreasing）
- `metaAnalysis.{topFailurePatterns, reworkHotspots, verifierDisagreements, budgetBurnTrend, operationalFailureHits, comprehensionQuality}`、`comprehensionQuality.{emptyOrTrivialRate, uniqueDecisionRate}`
- `recommendations.{promptTweaks, toolImprovements, verificationRuleTightening, candidateAntiPatterns, maturityAdjustments}`

语义参考：`references/hill-climbing-guide.md`；SSoT §10G。

- [ ] **Step 5: 为 maturity.schema.json 全字段补 description**

顶层：`schemaVersion, projectId, level, leveledUpAt, unlockConditions, history, downgradeTriggers`；
- `level`（L0-L3，R2 enum 校验）
- `unlockConditions.{stableDays, completedCycles, attemptCapRate, misjudgeRate, operationalFailures}`（R3 周期语义：completedPhases/8）
- `history[].{from, to, at, reason}`
- `downgradeTriggers.{operationalFailureStreak, budgetBurnRateExceeded, checkpointRejectionStreak, userRequested}`

语义参考：`maturity-logic.ts` R1-R5；`references/operational-recovery.md`「成熟度与 CHECKPOINT 放行」节。

- [ ] **Step 6: JSON 语法验证 5 份**

Run:
```powershell
node -e "['code-tla-manifest','design-contract','event-ingress','hill-climbing-report','maturity'].forEach(n=>{const p='w-model-dev/schemas/'+n+'.schema.json';JSON.parse(require('fs').readFileSync(p,'utf8'));console.log('OK',p)})"
```
Expected: 5 行 `OK ...`。

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/schemas/code-tla-manifest.schema.json w-model-dev/schemas/design-contract.schema.json w-model-dev/schemas/event-ingress.schema.json w-model-dev/schemas/hill-climbing-report.schema.json w-model-dev/schemas/maturity.schema.json
git commit -m "docs(schemas): Group C 5 份 schema 全字段 description（code-tla-manifest/design-contract/event-ingress/hill-climbing-report/maturity）"
```

---

### Task 4: Group D 3 份 schema + 全量语法验证（checkpoint-log / preventive-review / project）

**Files:**
- Modify: `w-model-dev/schemas/checkpoint-log.schema.json`
- Modify: `w-model-dev/schemas/preventive-review.schema.json`
- Modify: `w-model-dev/schemas/project.schema.json`

- [ ] **Step 1: 为 checkpoint-log.schema.json 全字段补 description**

顶层：`runId, timestamp, phase, phaseName, action, role, duration_s, tokens, estimated, subagentSpawns, gateExitCode, gateLogPath, outcome, acknowledgedDecisions, note, artifacts`；
- `action` 枚举含义（chunk/cross/evolve/produce/review/gate/tla-gate/graph-gate/test/checkpoint/rework/rollback），注明 checkpoint-log 无 rootcause/fix/escalate 动作、无 R 角色
- `acknowledgedDecisions` 注明：须含 ID 模式或技术关键词（REQ-NNN/INTF-NNN/接口/状态机/不变式），"同意"/"确认"视为空，R2 校验

语义参考：`checkpoint-logic.ts` R1-R5；`references/data-models.md`。

- [ ] **Step 2: 为 preventive-review.schema.json 全字段补 description**

顶层：`reviewedAt, reviewer, phase, dimension, findings, passed`；
- `dimension` 枚举 completeness/reliability/security（R3 三维度，约束 #17）
- `findings[].{severity, description, evidence}`（severity Critical/Required/Optional/Nit/FYI；evidence 须具体引用，反模式 #33 兜底）

语义参考：`preventive-review-logic.ts`；`references/subagent-delegation.md` R3 节。

- [ ] **Step 3: 为 project.schema.json 全字段补 description**

顶层：`id, name, description, status, techStack, createdAt, updatedAt`；
- `status` 枚举 9 态含义（需求分析/系统设计/概要设计/详细设计/编码/集成测试/系统测试/验收测试/项目完成），注明与 currentPhase 的对应
- `techStack.{frontend, backend, database, others}`

语义参考：`data-models.md` Project 节；`references/operational-recovery.md`。

- [ ] **Step 4: 19 份 schema 全量 JSON 语法验证**

Run（仓库根目录）:
```powershell
node -e "const fs=require('fs');const dir='w-model-dev/schemas';fs.readdirSync(dir).filter(f=>f.endsWith('.schema.json')).forEach(f=>{JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'));console.log('OK',f)})"
```
Expected: 19 行 `OK ...`，无异常。

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/schemas/checkpoint-log.schema.json w-model-dev/schemas/preventive-review.schema.json w-model-dev/schemas/project.schema.json
git commit -m "docs(schemas): Group D 3 份 schema 全字段 description（checkpoint-log/preventive-review/project）"
```

---

### Task 5: 反模式 #43 + operational-recovery 脱敏条款（#8）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`
- Modify: `w-model-dev/references/operational-recovery.md`
- Modify: `README.md`

- [ ] **Step 1: anti-patterns.md 新增反模式 #43**

定位：`## #42 S-fix / emergency-fix 后跳过 R3+V（第29轮新增）` 节末尾（`**关联**：约束 #17 + #19 + SSoT §3.4.25（[28.0.0] 新增）...` 行之后、`## 实现层经验教训` 节之前）插入：

```markdown
## #43 敏感信息写入状态文件/日志（第30轮新增）

**症状**：`.w-model/*.json`（project/budget/maturity/graph/rtm/tla-manifest 等）、`.w-model/gate-logs/`、`run-log.jsonl` / `event-ingress.jsonl` / `signature-chain.jsonl` 中出现硬编码密钥、令牌、密码、连接串（如 `sk-xxx`、`AKIA...`、`Bearer <token>`、`password=...`）；或 SKILL.md 示例、templates/ 模板、references/ 示例中包含真实凭据而非占位符。

**为何是反模式**：状态文件与日志是项目资产，可能随仓库分发、归档或进入下游 CI；硬编码凭据造成凭据泄露风险，且违反「敏感配置统一经环境变量注入」的运维纪律。即使 demo/教学场景也应以占位符（如 `${JWT_SECRET}`）呈现。

**检测信号**：
- `.w-model/` 下任一 JSON/JSONL 文件含高熵密钥特征（`sk-` 前缀、32+ 位 Base64、`Bearer `、`AKIA`、`password=`/`passwd=` 字段）
- gate-logs 存档或 run-log `note` 字段含真实凭据值
- 模板 / 示例 / 提示词中含非占位符的真实凭据

**回退动作**：从状态文件 / 日志移除敏感值，改为环境变量引用名（如 `${JWT_SECRET}`）或外部 secrets 管理；修正模板/示例为占位符；回当前阶段起点重跑受影响门禁。

**门禁脚本**：无专用脚本（软检测，V 评审 + G 门禁人工核验；`security-scan.ts` 覆盖源码级扫描，本反模式覆盖数据文件层）。

**关联**：SSoT §3.4.27（[30.0.0] 新增）；[operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节；demo `JWT_SECRET` 环境变量处理（第 15 轮）
```

- [ ] **Step 2: operational-recovery.md 补密钥禁令**

定位：`## JSON 文件写入工具选择` 节末尾（`### JSONL 文件追加（run-log.jsonl / event-ingress.jsonl）` 小节最后一行「- 不得用 PowerShell `Add-Content` 追加（同上 BOM + 乱码问题）」之后、`## 调测者简化行为预防` 之前）追加：

```markdown
### 敏感信息禁令（第 30 轮）

- **禁止**将密钥、令牌、密码、连接串写入任何状态文件（`.w-model/*.json`）或日志（gate-logs / run-log / event-ingress / signature-chain）。
- 敏感配置统一经环境变量注入（与 demo `JWT_SECRET` 处理一致，见 [第 15 轮归档](../../docs/changes/archive/2026-07-26-round15-end-to-end-test/README.md)）；状态文件只存引用名（如 `${JWT_SECRET}`），不存值。
- 命中反模式 #43：从状态文件移除敏感值 → 改环境变量引用 → 回当前阶段起点重跑受影响门禁。
```

- [ ] **Step 3: README.md 反模式计数 42 → 43**

定位：README.md 中含「反模式 4? 条」的计数处（`grep -n "反模式" README.md` 定位，当前应含 41/42 计数）。将计数更新为 43，若含「#1~#42」类范围描述一并更新为 #1~#43。

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/references/anti-patterns.md w-model-dev/references/operational-recovery.md README.md
git commit -m "docs: 反模式 #43 敏感信息脱敏 + operational-recovery 密钥禁令 + README 计数 42→43"
```

---

### Task 6: pre-push 新增 npm audit（#7，warn-only）

**Files:**
- Modify: `.githooks/pre-push`

- [ ] **Step 1: 新增 warn() 工具函数**

定位：`ok()` 函数之后、`fail()` 函数之前（当前第 24-25 行区域）。在 `fail()` 行后追加：

```bash
warn() { printf '[pre-push] \033[33m⚠\033[0m %s\n' "$*"; }
```

- [ ] **Step 2: 文件头注释 11 项 → 12 项**

定位：`# 与原 CI 一致：11 项检查，退出码必须全部符合预期才放行。`（第 86 行）。改为：

```bash
# 与原 CI 一致：12 项检查（第 12 项 npm audit 为 warn-only），退出码必须全部符合预期才放行。
```

- [ ] **Step 3: 追加检查 #12 npm audit（warn-only）**

定位：现有最后一项（`# 11. [21.0.0] check-signature-chain ...` 的 `run_expect ... || exit 1` 行）之后、`log "全部门禁通过，允许推送 ✓"` 之前插入：

```bash
# 12. npm audit：依赖漏洞扫描（warn-only，不阻断；离线/网络失败自动跳过）
log "npm audit 依赖漏洞扫描（warn-only）..."
set +e
npm audit --audit-level=high >"$tmp_log" 2>&1
local_audit_code=$?
set -e
if [ "$local_audit_code" -eq 0 ]; then
  ok "npm audit 未发现 high 以上漏洞"
else
  warn "npm audit 返回码 $local_audit_code（发现 high 以上漏洞或网络不可达），warn-only 不阻断 push"
  cat "$tmp_log" >&2
fi
```

- [ ] **Step 4: 语法验证 + 手动运行 prepush**

Run（仓库根目录，PowerShell）:
```powershell
bash -n .githooks/pre-push
```
Expected: 无输出（语法 OK）。

Run:
```powershell
npm run prepush
```
Expected: 12 项检查输出，npm audit 走 ok 或 warn 分支；其余 11 项全部 `✓`；最终 `全部门禁通过，允许推送 ✓`。

- [ ] **Step 5: 提交**

```bash
git add .githooks/pre-push
git commit -m "chore(pre-push): 新增 npm audit 依赖漏洞扫描（warn-only + 离线容错）"
```

---

### Task 7: 版本号三处同步 + SSoT/CHANGELOG/AGENTS 文档同步

**Files:**
- Modify: `package.json`
- Modify: `w-model-dev/skill-metadata.json`
- Modify: `w-model-dev/SKILL.md`（frontmatter）
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `README.md`（版本号引用）
- Modify: `CONTRIBUTING.md` / `docs/INSTALL.md`（如含版本号/基线引用）

- [ ] **Step 1: 版本号三处 29.0.0 → 30.0.0**

- `package.json` 第 3 行：`"version": "29.0.0"` → `"version": "30.0.0"`
- `w-model-dev/skill-metadata.json` 第 3 行：`"version": "29.0.0"` → `"version": "30.0.0"`；第 7 行 `"updatedAt": "2026-08-05"` 保持
- `w-model-dev/SKILL.md` frontmatter 第 3 行：`version: 29.0.0` → `version: 30.0.0`

- [ ] **Step 2: CHANGELOG.md 新增 [30.0.0] 条目**

定位：文件头 `## [29.0.0] - 2026-08-05` 之前插入：

```markdown
## [30.0.0] - 2026-08-05

### 第三十一轮 Schema 字段描述增强 + 敏感信息脱敏 + npm audit 门禁

吸收外部评审建议低风险批三项（设计文档 `docs/superpowers/specs/2026-08-05-round30-schema-desc-redaction-audit-design.md`）。详见 SSoT §3.4.27。

#### Added
- 反模式 #43（敏感信息写入状态文件/日志）—— 状态文件/日志不得含硬编码凭据，敏感配置统一环境变量注入

#### Changed
- `schemas/*.schema.json`（19 份）：全量字段补充 `description`（用途 + 期望值），仅注释性关键字，校验行为不变
- `references/operational-recovery.md`：「JSON 文件写入工具选择」节新增敏感信息禁令
- `.githooks/pre-push`：新增检查 #12 npm audit（warn-only + 离线容错），11 项 → 12 项

#### 验证
- self-test 213/213 不变全通过
- vitest 297/297 不变全通过
- prepush 12 项通过（npm audit warn-only）
- TypeScript strict 0 错误
```

- [ ] **Step 3: SSoT §3.4.27 轮次记录 + §10A 追溯表**

- 定位 SSoT 最后轮次节（现有 `#### 3.4.26 第三十轮：CLI 样板抽取 + 分派总览矩阵（[29.0.0]）`，在其后新增 3.4.27），按既有格式新增：

```markdown
#### 3.4.27 第三十一轮：Schema 字段描述增强 + 敏感信息脱敏 + npm audit 门禁（2026-08-05，[30.0.0]）

| 维度 | 内容 |
|---|---|
| 触发 | 外部评审 14 条建议，用户经头脑风暴选 3 轮分组，本轮为低风险批（#13 + #8 + #7） |
| 新增 | 反模式 #43（敏感信息写入状态文件/日志）+ operational-recovery 敏感信息禁令 |
| 脚本改动 | `.githooks/pre-push` 新增检查 #12 npm audit（warn-only + 离线容错） |
| schema 改动 | 19 份 schemas/*.schema.json 全量字段补充 description（仅注释性关键字，校验行为不变） |
| 顶层文档 | SSoT §3.4.27 + §10A 追溯表 + AGENTS.md §4 + CHANGELOG.md [30.0.0] + README.md 反模式计数 42→43 |
| package.json | version `29.0.0` → `30.0.0`（与 SKILL.md frontmatter + skill-metadata.json 三处一致） |
| self-test | 基线 213 不变全通过 |
| vitest | 基线 269 不变全通过 |
| pre-push | 11 → 12 项（新增 npm audit warn-only） |
| TypeScript strict | 0 错误 |
```

- §10A 追溯表：在最后一行之后按既有格式新增 `§3.4.27` 行（内容：本轮变更摘要 + 相关文件）。

- [ ] **Step 4: AGENTS.md 更新**

- §1 仓库定位：在「第 28 轮」bullet 之后（若有第 29 轮 bullet 则在其后）新增：

```markdown
- **第 30 轮 Schema 自描述 + 脱敏 + audit**：19 份 schema 全量字段补 description（仅注释性关键字，校验行为不变）/ 反模式 #43（状态文件/日志不得写入敏感凭据，敏感配置统一环境变量注入）/ pre-push 新增 npm audit warn-only（第 12 项）。详见 SSoT §3.4.27。
```

- §3 常用命令：`npm run prepush  # 手动跑推送前门禁（不实际推送，11 项门禁检查）` → 12 项门禁检查。
- §2 目录速查 `w-model-dev/schemas/` 行：`JSON Schema (draft-07) 文件（19 份）` → `JSON Schema (draft-07) 文件（19 份，全字段 description 自描述）`。

- [ ] **Step 5: README.md / CONTRIBUTING.md / INSTALL.md 版本引用**

- README.md：版本号引用处（若有 `29.0.0`）更新为 `30.0.0`；反模式计数已在 Task 5 更新。
- CONTRIBUTING.md / docs/INSTALL.md：`grep -n "29.0.0\|213 条\|self-test"` 检查，如有版本号或基线引用则同步更新（213 条基线不变，仅版本号）。

- [ ] **Step 6: 提交**

```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md docs/skill-design-document_SSoT.md CHANGELOG.md AGENTS.md README.md CONTRIBUTING.md docs/INSTALL.md
git commit -m "docs: 版本号三处 30.0.0 + SSoT §3.4.27 + CHANGELOG [30.0.0] + AGENTS/README/INSTALL 同步"
```

---

### Task 8: 全量回归验证

**Files:** 无改动，仅验证。

- [ ] **Step 1: self-test**

Run（仓库根目录）:
```powershell
npm run self-test
```
Expected: 输出含「总计 213 条用例：213 通过，0 失败」，退出码 0。

- [ ] **Step 2: vitest**

Run:
```powershell
cd w-model-dev; npx vitest run scripts/__tests__/; cd ..
```
Expected: 全部 test 文件通过，0 失败。

- [ ] **Step 3: TypeScript strict**

Run:
```powershell
npx tsc --noEmit
```
Expected: 0 错误。

- [ ] **Step 4: prepush（PREPUSH_FORCE=1）**

Run:
```powershell
npm run prepush
```
Expected: 12 项检查输出；self-test ✓ / security-scan ✓ / 其余 10 项 ✓；npm audit 走 ok 或 warn；最终 `全部门禁通过，允许推送 ✓`，退出码 0。

- [ ] **Step 5: 设计文档验收标准核对**

对照设计文档 §5 验收标准逐条核对：
1. 19 份 schema 全字段 description + JSON 语法合法（Task 4 Step 4 已验）
2. anti-patterns.md 含 #43，README 计数 43（Task 5）
3. operational-recovery.md 含密钥禁令（Task 5）
4. prepush 12 项通过，audit warn-only 不阻断（Task 6 + Step 4）
5. 版本号三处一致 30.0.0（Task 7，`grep -rn "29.0.0" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md` 应无残留）
6. 无样本/测试预期改动（Step 1/2 基线不变）

- [ ] **Step 6: 收尾提交（如有回归修正）**

若回归发现缺陷，修正后提交；无则跳过。最终 `git status` 应干净。

---

## 自检清单（计划编写者已核）

1. **Spec 覆盖**：#13 → Task 1-4；#8 → Task 5；#7 → Task 6；版本号/文档同步 → Task 7；回归 → Task 8；验收标准全部映射。
2. **占位符扫描**：无 TBD/TODO；每步含具体文件路径、字段清单、命令与期望输出。
3. **类型一致性**：版本号三处、pre-push 12 项、反模式 #43、§3.4.27 编号在全部任务间一致。
