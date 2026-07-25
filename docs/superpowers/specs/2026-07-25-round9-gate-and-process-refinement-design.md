# 第 9 轮：门禁与流程细化修正设计 spec

> 2026-07-25 第 8 轮 W 模型 25 需求端到端调测归档后识别的 11 个问题修正设计。
> 采用方案 A 全量修正（P1×3 + P2×4 + P3×4）。
> 关联调测：[w-model-dev-demo 第 8 轮归档](../../w-model-dev-demo/.w-model/project.json) status=项目完成，currentPhase=9。
> 关联上一轮设计：[2026-07-25-gate-enhancement-and-ddd-rebuild-design.md](./2026-07-25-gate-enhancement-and-ddd-rebuild-design.md)（第七轮门禁增强）。

## 1. 问题清单与优先级

### P1 严重问题（3 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P1.1 | check-artifact-gate.ts 缺少阶段级中间校验 | 第 8 轮阶段 6 执行时 check-artifact-gate 退出码 1，日志显示"系统测试 64 个待执行 / 验收测试 56 个待执行 / NFR 字段缺失"，但阶段 6 只应校验集成测试层 | 阶段 6/7 的 G 门禁无法做阶段级工件校验，只能用 check-verifier-output |
| P1.2 | NFR/CON 横切字段延迟发现 | NFR-001~005 和 CON-001~003 的 designDoc/codeModule/unitTest/integrationTest 字段在阶段 1-5 一直为 null，直到阶段 8 终检才被 check-artifact-gate 发现 | 阶段 8 才发现返工，违反"早发现早修复"原则 |
| P1.3 | 子代理"只规划不执行"反模式 | 第 6 阶段第一次派遣子代理只返回 11 段规划摘要未创建任何文件，第二次必须明确"立即执行（不要只规划）"才工作 | 浪费 token + 轮次，subagent-delegation.md 未禁止此行为 |

### P2 改进问题（4 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P2.4 | verifier-output subCriteria 命名与权重不规范 | phase4: architecture-soundness/requirement-coverage/...; phase6/7: coverage/correctness/...; phase8: scenario-coverage/requirement-match/... 子代理自由命名 | 无统一标准，难以横向对比 |
| P2.5 | targetKind 枚举值不一致 | phase5: targetKind="code"; phase6/7: targetKind="testcase"; phase8: targetKind="test" | 同一概念出现 "test" 和 "testcase" 两种取值 |
| P2.6 | check-artifact-gate graph 资产未自动发现 | 阶段 8 终检日志显示 "graph 资产: ⚠ 未提供（跳过 SD→codeModule 校验）"，但 graph.json 在阶段 1-4 已产出并存在于 .w-model/ingestion/ | SD→codeModule 映射校验被跳过，降低门禁有效性 |
| P2.7 | 子代理修改 src/ 业务代码边界不明确 | 第 6 阶段子代理修复 4 个源码 bug（push.service/article.store/blogger.service/auth.service），任务指令说"不修改 src/（除非真实 bug 且最小修复）"但子代理修复范围较大 | S 子代理越权修改既有产物，与 R 根因定位角色职责混淆 |

### P3 优化问题（4 个）

| ID | 问题 | 证据 | 影响 |
|---|---|---|---|
| P3.8 | TLA+ states 目录残留未清理 | tla/states/ 目录下有 2000~2228 共 229 个状态文件残留 | 违反"TLA+ trace 和 state 文件必须删除 before validation"约束 |
| P3.9 | code-TLA+ Next 分支覆盖率校验不全 | 阶段 5 维度 3 只覆盖 2 项，因为只加载 L4 specs，17 个 TLA+ spec 应有更多 Next actions | 一致性校验覆盖不足 |
| P3.10 | verifier rawScores 方差固定为 0.00004 | 各阶段 rawScores 方差都是 0.00004（如 [0.96, 0.94, 0.95, 0.95, 0.95]），暗示未真实进行 5 次独立评分 | 5 次独立评分要求形同虚设 |
| P3.11 | coverage/.tmp 临时文件残留 | vitest coverage 运行后 coverage/.tmp/ 有 20 个临时 json 文件未清理 | 仓库污染 |

---

## 2. 修正设计

### P1.1 check-artifact-gate.ts 阶段级中间校验

**当前状态**：
- check-artifact-gate.ts 是终检门禁，无 `--phase=N` 参数
- gate-logic.ts 的 checkArtifactGate() 一次性校验所有四级测试汇总，要求全部 passed+pending=0

**修正方案**：
1. check-artifact-gate.ts 增加 `--phase=N`（简写 `-p N`）可选参数，N ∈ {1..8}
2. gate-logic.ts 增加 `phaseOption?: number` 参数到 checkArtifactGate() 签名
3. 按阶段只校验已执行层级的测试汇总：
   - phase 1-4：跳过测试汇总校验（设计阶段，测试为 pending 合理）
   - phase 5：校验 unitTest（passed+failed=total，pending=0）；integrationTest/systemTest/acceptanceTest 跳过（pending 合理）
   - phase 6：phase 5 全部 + integrationTest
   - phase 7：phase 6 全部 + systemTest
   - phase 8：全部 + acceptanceTest（即现有行为，向后兼容）
4. RTM 字段校验也按阶段分层：
   - phase 1-4：REQ 行校验 designDoc 字段
   - phase 5：+ codeModule + unitTest
   - phase 6：+ integrationTest
   - phase 7：+ systemTest
   - phase 8：+ acceptanceTest
   - NFR/CON 横切行：phase 5 起校验 codeModule（横切治理映射）
5. 未传 `--phase` 时默认 phase=8（终检，现有行为完全保留）

**测试**：
- fixture: bad-phase6-pending-system.json（phase=6，systemTest pending=64 应通过）
- fixture: bad-phase5-missing-codemodule.json（phase=5，REQ 缺 codeModule 应失败）
- fixture: valid-phase6.json（phase=6，unit+integration 通过，system+acceptance pending 应通过）

### P1.2 NFR/CON 横切字段早发现

**当前状态**：
- phase-1-requirements.md 未要求 NFR/CON 行的 designDoc 登记
- phase-5-coding.md 未要求 NFR/CON 行的 codeModule 回填
- check-artifact-gate.ts 终检才发现 NFR/CON 字段缺失

**修正方案**：
1. phase-1-requirements.md 增加「NFR/CON 横切治理字段登记」要求：
   - NFR-001~005 在阶段 1 须登记 designDoc（横切 SD 清单，如 "SD-001,SD-004,SD-007"）
   - CON-001~003 须登记 designDoc="横切"（无具体 SD 映射时填"横切"）
2. phase-5-coding.md 增加「NFR/CON codeModule 回填」要求：
   - NFR 行 codeModule 填写涉及的源码文件清单或"横切"标识
   - CON 行 codeModule 填写技术栈配置文件（如 "package.json,tsconfig.json"）或"横切"
3. 配合 P1.1 的阶段级校验：phase 1 校验 NFR/CON 的 designDoc，phase 5 校验 codeModule

### P1.3 子代理"只规划不执行"反模式

**当前状态**：
- subagent-delegation.md 无"禁止只规划不执行"条款
- 子代理 prompt 模板未要求必须调用执行工具

**修正方案**：
1. subagent-delegation.md 增加「禁止只规划不执行」反模式条目（编号 #20）：
   > **#20 只规划不执行**：子代理返回规划性内容（如"正在准备"、"将创建"、"步骤1：读取..."）而未调用任何执行工具（Write/Edit/RunCommand）。违反命中反模式，回子代理起点重派。
   > **正确做法**：子代理必须在响应中调用至少一个执行工具（Write/Edit/RunCommand/Read 等），禁止只返回纯文本规划。
2. subagent-persona-matrix.md 在 S 子代理 persona 模板增加约束：
   > "你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 Write/Edit/RunCommand 调用。"

### P2.4 verifier-output subCriteria 命名规范

**当前状态**：
- verifier-spec.md 未定义各阶段标准 subCriteria 名称
- 子代理自由命名（phase4: architecture-soundness; phase6: coverage; phase8: scenario-coverage）

**修正方案**：
1. verifier-spec.md 增加「各阶段 subCriteria 标准模板」表格：

| 阶段 | targetKind | subCriteria 标准名称（权重） |
|---|---|---|
| phase 1 | requirement | requirement-completeness(0.30) / stakeholder-coverage(0.20) / acceptance-criteria-clarity(0.20) / testability(0.15) / feasibility(0.15) |
| phase 2 | design | architecture-soundness(0.25) / requirement-coverage(0.25) / interface-consistency(0.20) / feasibility(0.15) / testability(0.15) |
| phase 3 | design | architecture-soundness(0.25) / interface-contract(0.25) / cross-module-design(0.20) / feasibility(0.15) / testability(0.15) |
| phase 4 | design | architecture-soundness(0.25) / requirement-coverage(0.25) / interface-consistency(0.20) / feasibility(0.15) / testability(0.15) |
| phase 5 | code | architecture-soundness(0.20) / requirement-coverage(0.20) / code-tla-consistency(0.20) / unit-test-quality(0.20) / code-quality(0.20) |
| phase 6 | test | test-coverage(0.30) / interface-contract(0.25) / cross-module-integration(0.25) / exception-handling(0.20) |
| phase 7 | test | e2e-coverage(0.25) / performance(0.25) / security(0.25) / reliability(0.15) / cross-module(0.10) |
| phase 8 | test | scenario-coverage(0.25) / requirement-match(0.25) / boundary-coverage(0.20) / nfr-validation(0.20) / document-completeness(0.10) |

2. verifier-logic.ts 增加校验：subCriteria 名称必须在对应阶段的标准名称集合内（或子集）

### P2.5 targetKind 枚举规范化

**当前状态**：targetKind 取值混乱（code / testcase / test）

**修正方案**：
1. verifier-spec.md 明确 targetKind 枚举：`requirement` | `design` | `code` | `test`
2. phase 6/7/8 统一为 `test`（不再用 "testcase"）
3. verifier-logic.ts 增加校验：targetKind ∈ {"requirement","design","code","test"}
4. 第八轮 demo 的 phase6/7 verifier-output.json 需修正 targetKind="testcase" → "test"

### P2.6 check-artifact-gate graph 资产自动发现

**当前状态**：
- check-artifact-gate.ts 只查找 `.w-model/ingestion/graph.json`
- 实际 graph 资产在 `.w-model/ingestion/consolidated-phase4.json`（阶段 1-4 逐步累积）

**修正方案**：
1. check-artifact-gate.ts 自动查找 graph 资产，按优先级：
   - `.w-model/ingestion/graph.json`（旧格式，保留兼容）
   - `.w-model/ingestion/consolidated-phase4.json`（新格式，阶段 4 累积图）
   - `.w-model/ingestion/consolidated-phase{N}.json`（按 N 降序查找最新）
2. 找到任一即加载，日志输出实际加载的文件名

### P2.7 S 子代理修改既有产物边界

**当前状态**：subagent-delegation.md 对 S 子代理修改既有产物的边界不明确

**修正方案**：
1. subagent-delegation.md 增加「S 子代理修改既有产物边界」条款：
   > **S 子代理修改既有产物的边界**：
   > - S 子代理负责**新增**产物（新文件、新测试用例、新文档章节）
   > - 发现既有产物有真实 bug 时，S 子代理**必须**先记录到 rootcause-report.jsonl（action=rootcause），再由独立 R 子代理修复
   > - 紧急修复（阻塞当前阶段推进）：S 子代理可最小修复，但必须在 run-log.jsonl 记录 fix 条目并标注"紧急修复"
   > - 非紧急修复：一律转 R 子代理，S 子代理不得越权
2. 配合 subagent-persona-matrix.md 的 R 子代理 persona 强化

### P3.8 TLA+ states 目录自动清理

**当前状态**：check-tla-model.ts 校验后未清理 states/ 目录

**修正方案**：
1. check-tla-model.ts 在 TLC 校验完成后自动清理 `<tla-dir>/states/` 目录
2. 增加 `--keep-states` 参数（调试场景保留 states）
3. package.json 增加 `clean:tla-states` 脚本：`rm -rf w-model-dev-demo/tla/states/`

### P3.9 code-TLA+ Next 分支覆盖扩展

**当前状态**：check-code-tla-consistency.ts 维度 3 只加载 L4 specs

**修正方案**：
1. code-tla-logic.ts 维度 3 扩展为遍历 tla-manifest.json 全部 specs 的 Next actions
2. 解析每个 .tla 文件的 Next == \/ Act1 \/ Act2 ... 结构，提取 action 名称
3. 按 PascalCase → camelCase 映射规则查找代码中对应函数名
4. 统计覆盖数/总数，输出未覆盖清单

### P3.10 verifier rawScores 方差合理性校验

**当前状态**：verifier-logic.ts 校验方差 ≤ 阈值，但未校验"方差是否自然分布"

**修正方案**：
1. verifier-logic.ts 增加校验：rawScores 不得全部相同（len(rawScores)>1 时 max-min 必须 > 0）
2. 增加校验：方差不得为固定模式 0.00004（暗示构造数据）—— 改为校验"rawScores 不得为等差数列且公差为 0.01"
3. 宽松校验：只要 rawScores 有自然波动（max-min ≥ 0.01）即通过，不强制要求特定分布

**注意**：0.00004 方差本身是合法的小方差值（如 [0.95, 0.95, 0.95, 0.95, 0.94] 方差=0.00004），不强制要求自然分布。只校验"全部相同"和"完美等差数列"两种构造模式。

### P3.11 coverage/.tmp 临时文件清理

**当前状态**：vitest coverage 运行后 coverage/.tmp/ 残留

**修正方案**：
1. w-model-dev-demo/.gitignore 增加 `coverage/.tmp/` 排除规则
2. w-model-dev-demo/package.json 的 test 脚本增加 `--coverage.clean=true`（vitest 配置项）
3. 或在 vitest.config.ts 增加 `coverage: { clean: true }`（如已有配置文件）

---

## 3. 影响范围

### 脚本改动（5 个）

| 脚本 | 改动 |
|---|---|
| check-artifact-gate.ts | P1.1 增加 --phase 参数 + P2.6 graph 自动发现 |
| gate-logic.ts | P1.1 增加 phaseOption 参数 + 阶段级校验逻辑 |
| verifier-logic.ts | P2.4 subCriteria 命名校验 + P2.5 targetKind 枚举校验 + P3.10 rawScores 合理性校验 |
| check-tla-model.ts | P3.8 states 自动清理 + --keep-states 参数 |
| check-code-tla-consistency.ts + code-tla-logic.ts | P3.9 维度 3 扩展为遍历全部 specs |

### 文档改动（7 个）

| 文档 | 改动 |
|---|---|
| phase-1-requirements.md | P1.2 NFR/CON 横切字段登记要求 |
| phase-5-coding.md | P1.2 NFR/CON codeModule 回填要求 |
| subagent-delegation.md | P1.3 反模式 #20 + P2.7 S 子代理修改边界 |
| subagent-persona-matrix.md | P1.3 S 子代理 persona 约束 + P2.7 R 子代理强化 |
| verifier-spec.md | P2.4 subCriteria 标准模板 + P2.5 targetKind 枚举 |
| tla-plus-guide.md | P3.8 states 清理约定 |
| SKILL.md | 阶段 5/6/7 门禁清单增加 --phase 参数说明 |

### 顶层文档（3 个）

| 文档 | 改动 |
|---|---|
| SSoT §3.4.6 | 增加第 9 轮门禁细化约束条款 |
| AGENTS.md §4 | 增加第 9 轮修正结论 |
| CHANGELOG.md | 增加第 9 轮版本条目 |

### Demo 修正（4 个 verifier-output）

| 文件 | 改动 |
|---|---|
| w-model-dev-demo/.w-model/verifier-output-phase6.json | P2.5 targetKind: "testcase" → "test" |
| w-model-dev-demo/.w-model/verifier-output-phase7.json | P2.5 targetKind: "testcase" → "test" |
| w-model-dev-demo/.w-model/verifier-output-phase6.json | P2.4 subCriteria 名称对齐标准模板 |
| w-model-dev-demo/.w-model/verifier-output-phase7.json | P2.4 subCriteria 名称对齐标准模板 |

### 新增 fixture（6 个）

| 文件 | 用途 |
|---|---|
| scripts/samples/gate/bad-phase6-pending-system.json | P1.1 phase=6 时 systemTest pending 应通过 |
| scripts/samples/gate/bad-phase5-missing-codemodule.json | P1.1 phase=5 时 REQ 缺 codeModule 应失败 |
| scripts/samples/gate/valid-phase6.json | P1.1 phase=6 合法场景 |
| scripts/samples/verifier/bad-targetkind.json | P2.5 targetKind 非法值 |
| scripts/samples/verifier/bad-subcriteria-name.json | P2.4 subCriteria 名称非法 |
| scripts/samples/verifier/bad-rawscores-constant.json | P3.10 rawScores 全相同 |

### 工程清理（2 个）

| 文件 | 改动 |
|---|---|
| w-model-dev-demo/.gitignore | P3.11 增加 coverage/.tmp/ |
| w-model-dev-demo/tla/states/ | P3.8 清理 229 个残留文件 |

---

## 4. 验证策略

### 4.1 单元测试

- gate-enhancement.test.ts 增加 6 个 fixture 对应的测试用例
- self-test.ts 基线从 82 增至 88（+6 新 fixture）

### 4.2 回归验证

- `npm run self-test` 全通过
- `npm run vitest` 全通过
- 第八轮 demo 的 phase6/7 verifier-output 修正后通过 check-verifier-output

### 4.3 端到端验证（可选）

- 不重跑第八轮 demo 全流程
- 只验证修正后的脚本在第八轮 demo 产物上工作正常：
  - `check-artifact-gate.ts --phase=6` 在第八轮 demo 上 exitCode=0
  - `check-artifact-gate.ts --phase=7` 在第八轮 demo 上 exitCode=0
  - `check-artifact-gate.ts`（默认 phase=8）在第八轮 demo 上 exitCode=0

---

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| P1.1 阶段级校验逻辑复杂，可能引入新 bug | 增加充足 fixture 覆盖各阶段边界；保留默认 phase=8 向后兼容 |
| P2.4 subCriteria 命名校验可能过严，拒绝合理变体 | 校验只检查名称集合，不检查权重；允许子集（如只评 3 项） |
| P3.10 rawScores 校验可能误报合法小方差 | 只校验"全相同"和"完美等差数列"，不强制自然分布 |
| P2.7 S 子代理修改边界过严，阻塞紧急修复 | 允许"紧急修复"通道，只需在 run-log 记录 |

---

## 6. 实施顺序

1. **Part A：脚本与 fixture**（P1.1 + P2.6 + P2.4 + P2.5 + P3.8 + P3.9 + P3.10 + P3.11）
   - 改 5 脚本 + 6 fixture + gate-enhancement.test.ts + self-test.ts
   - 验证：self-test + vitest 全通过
2. **Part B：reference 文档**（P1.2 + P1.3 + P2.7 + P2.4 + P2.5 + P3.8）
   - 改 7 个 reference 文档
3. **Part C：顶层文档与 demo 修正**
   - SSoT + AGENTS.md + CHANGELOG.md + SKILL.md
   - 修正第八轮 demo 的 4 个 verifier-output.json
   - 清理 tla/states/ 残留

---

## 7. 验收标准

- [ ] 11 个问题全部修正
- [ ] 5 脚本改动 TypeScript strict 0 错误
- [ ] self-test 基线 82→88 全通过
- [ ] gate-enhancement.test.ts 6 新 fixture 全通过
- [ ] 第八轮 demo 的 phase6/7 verifier-output 通过 check-verifier-output
- [ ] check-artifact-gate.ts --phase=6/7/8 在第八轮 demo 上 exitCode=0
- [ ] 7 reference 文档更新
- [ ] 3 顶层文档更新
- [ ] tla/states/ 清理
- [ ] coverage/.tmp/ 排除规则生效
