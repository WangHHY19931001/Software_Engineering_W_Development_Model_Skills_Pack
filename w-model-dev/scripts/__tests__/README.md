# 测试 Coverage 矩阵

> 借鉴 drawio-skill/tests/README.md 的「Area | What's locked in」表设计：明示每个 test 文件覆盖的 R 规则，便于回归与新增校验项时定位。

## 测试文件清单

| File | Area | What's locked in |
|---|---|---|
| archive-integrity-logic.test.ts | Archive | valid-full 通过 / bad-missing-phase1-docs 失败 / bad-missing-signature-chain 失败 / bad-missing-gate-logs 失败 / ARCHIVE_INTEGRITY_CHECKLIST 完整性 / 非归档根同名文件不满足 verifier-output- 前缀匹配 |
| bdd-logic.test.ts | BDD | parseFeatureHeader 头标注解析 / parseBackgroundStateMachine 七要素解析 / validateStateMachineCompleteness 状态机完整性 / validateScenarioPath 路径合法性 / validateTlaEquivalence BDD↔TLA+ 等价性 / checkBddModel schema 失败 exitCode=2 |
| budget-logic.test.ts | Budget | R1 时效性 / R2 schema / R3 onExceed / R4 killSwitch / R5 触发检测 |
| checkpoint-logic.test.ts | Checkpoint | R3 强制用户确认 / 未提供 checkpointLog 报 R3 / 真实用户确认通过 / 对应 phase 缺确认报疑似代签 |
| cli-error.test.ts | CliError | formatCliError 三类模板（file/detail/均无）/ printError 走 stderr / printErrorJson 走 stdout 含 exitCode / exitWithError 设置 exitCode(2) 且 stdout 先 flush |
| code-tla-logic.test.ts | Code-TLA+ | SD→codeModule 映射 / 状态转移 / Next 分支 / 不变式覆盖 |
| coverage-logic.test.ts | Coverage | C1 stakeholders 非空 / C3 scenarios 非空 / C4 happy·error·boundary / C5 REQ·NFR·CON / C7 crossCuts↔graphCrossCuts 双向一致 / C8 metrics 4 项=100% / C9 missing 须 Out of Scope 声明 / C10 metrics 重算一致 / exemptions 跳过 / OOS 形状 CLI exit 2 |
| design-contract-logic.test.ts | DesignContract | D8 多路由不同状态码无交叉污染 / D9 路由未找到报 D2/D3/D4 / D9 路径归一化（尾部斜杠·query）/ null·undefined 输入失败 |
| exemption-logic.test.ts | Exemption | E1 schema / E2 justification≥20 / E3 evidence 非空 / E4 review 完整 / E5 reviewDecision=approve / E6 rootCauseAnalysis≥30 / E7 verified=true / E8 humanDecision=approve / E9 时间戳时序 / 四阶段全通过 stage=complete |
| gate-enhancement.test.ts | Gate | basePath 强制 / SD 覆盖率 / passed↔qualityLevel / phase 三段语义 |
| gate-report.test.ts | CLI IO | printGateReport 分隔线 + `<LABEL>_JSON ` 行首标记 / exitCode 追加 JSON 末尾 / exit 码 0/1/2 透传 / summary 自带 exitCode 被参数覆盖 |
| graph-logic.test.ts | Graph | R1-R4 REQ 层级树（level·orphan·multiParent·单调·REQ-group）/ R5 depends-on·precedes 无环 / R6 交叉边对称性与源/目标类型 / R11 level 正整数 / recalculatePassed 重算 / reqHierarchy·crossLogic 填充 |
| metrics-report.test.ts | Metrics CLI | 子进程：run-log 缺失 exit 2 / --phase 非法值系列 exit 2 / budget 缺失(null)·非法 exit 2 / --json·--out 组合 stdout 纯净 / 空 run-log 预警 / 坏行跳过 / --phase 过滤 / 人类可读 9 节 |
| metrics-report-logic.test.ts | Metrics | 总体汇总 / 阶段分组 / 动作·角色·结果分布 / 返工率与连续段 / gate 通过率（0/非0/null 归类）/ 预算 burn rate 与 killSwitch 两路径 / 窗口与 phase 过滤 / 空 run-log |
| parse-phase.test.ts | PhaseArg | parsePhaseArg --phase=N / --phase N / 位置参数三形态 / 非法值（abc·0·9·-1·空串·无值）→ undefined / min·max 自定义 / 无 --phase → undefined |
| plan-chunks.test.ts | PlanChunks | estimateTokens（ASCII/4·CJK 字节/4）/ splitMarkdownSections header+content 配对·围栏代码块内 # 不切分 / splitByLines 二次切分·overlap / planFile 目录递归·单文件超限 |
| preventive-review-logic.test.ts | PreventiveReview | 三份报告（completeness·reliability·security）齐全合规通过 / 缺失 completeness 失败 / phase 不一致失败 / variant fix·emergency·standard 通过 / 缺 security 仍失败 |
| read-json-or-exit.test.ts | CLI IO | readJsonOrExit 正常/ENOENT/非法 JSON/相对路径 / readJsonlOrExit 正常/空行/坏行 warn/ENOENT/CRLF/label 默认值 |
| role-dispatch-logic.test.ts | RoleDispatch | R≥3 无条件（无需 r3Enabled）/ S·V·G 各≥1 强制 / 多阶段只报缺阶段 / 非法条目跳过 / phaseSummary 结构 |
| root-cause-logic.test.ts | RootCause | R1 schema / R2 链长 / R3 可证伪 / R4 修复建议 / R5 预防 / R6 上游 / R7 质量 / R8 报告 ID / R9 多角度 / R10 reality |
| run-log-logic.test.ts | RunLog | R1 完整性 / R2 tokens / R3 返工 / R4 决策 / R5 O越权 / R6 exitCode / R7 时序 |
| safe-json.test.ts | SafeJson | __proto__ 键丢弃（顶层·嵌套）/ 普通键·数组·标量·null 与 JSON.parse 一致 / 非法 JSON 抛 SyntaxError / safeJsonReviver |
| schema-validation.test.ts | Schema | additionalProperties 拒绝 / missing required 拒绝 / wrong type 拒绝 / 合法样本接受 |
| security-scan.test.ts | Security | baseline 命中豁免 / 新增发现识别 / sha256 指纹稳定性 |
| signature-chain-logic.test.ts | SignatureChain | R1-R10 签名链规则 / computeSigHash 一致性 / E1 跨阶段连续链 / E2 跨阶段来源并集 / E3 全违规聚合 |
| skill-metadata.test.ts | Metadata | frontmatter version 与 metadata.json 一致 / name 一致 / schemaVersion 存在 |
| state-machine-logic.test.ts | StateMachine | 设计↔代码状态机一致性 / 缺转移·多转移·多状态检测 / transitionKey 格式 / 缺省字段容错 / 返回结构完整性 |
| tla-bdd-sync-logic.test.ts | TLA-BDD | TLA+↔BDD 同步 / \E 量化·多行 VARIABLES 解析 / Scenario 体 Given·When·Then / @states·@transitions 注释 |
| tla-clean-trace.test.ts | TLA-Clean | isTlcStatesDir 识别（时间戳子目录·.st 指纹·空·无关·不存在）/ cleanTraceFiles 守卫1 无 .tla 不删 / 守卫2 states 递归删除·无 TLC 特征跳过 / *.dump·*.out 仅在有 .tla 目录删 |
| tla-logic.test.ts | TLA+ | 文件头 / 层次 / 拆解 / SANY / TLC / R13 checkRounds schema |
| verifier-logic.test.ts | Verifier | evidence 格式校验（key=value 通过·空泛声明 O3）/ R13 单轴下限（≥0.70·<0.70·边界 0.70·非数组）/ evidence 扣分后 passed 重算 |
| wm-status.test.ts | WmStatus CLI | 子进程：未初始化 exit 0 / project 非法·非对象·数组 exit 2 / rtm 非法 exit 2 / rtm·run-log 缺失降级 / run-log 坏行跳过 / status 非字符串归一化 / --json 结构 / 人类可读 6 项 |
| wm-status-logic.test.ts | WmStatus | 9 态 → phase 映射 / completedPhases 与 progress / RTM 覆盖计数 / 四级测试透传 / recentActions 尾部 3 条精简字段 / rtm·runLog 缺失降级 / nextSteps 确定性 |

## pure/IO 函数边界（借鉴点 5）

所有 `*-logic.ts` 必须保持纯函数：
- 不 import `node:fs` / `node:child_process` / `node:path`
- 不调用 `process.exit` / `process.argv` / `process.env` / `process.stdout` / `process.stderr`
- 不修改外部状态

IO 调用必须在 `check-*.ts` 入口层完成，传纯数据给 logic 层。

违反检测：

```bash
cd w-model-dev/scripts/logic && grep -nE "from 'node:fs'|from 'node:child_process'|process\.(exit|argv|env|stdout|stderr)" *-logic.ts
```

应无输出。

## 新增测试时

1. 在本表追加 `File | Area | What's locked in` 行
2. 在 `self-test.ts` 同步追加样本用例（若涉及 logic 层）
3. 必要时在 `samples/<area>/` 增加 `bad-*.json` 反例
