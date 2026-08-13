# 快速自检（Quick Self-Check）

> 在任何推进或完成声明前核验的清单。第 44 轮由 `SKILL.md` 移入本文件按需加载；`SKILL.md` 保留指针。
> 编排者（O）在阶段门 / 发布放行前对照本清单逐项确认；与 [anti-patterns.md](anti-patterns.md) 反模式库互补（清单是检查点，反模式是负面知识库）。

- [ ] 触发边界已正确判断，歧义请求已经确认
- [ ] 上游产物与项目状态一致
- [ ] 当前阶段开发产物和对应测试设计均已完成
- [ ] RTM 已同步且没有估算值
- [ ] 真实测试/门禁证据可复核
- [ ] 当前 🔴 CHECKPOINT 已获得用户明确决定
- [ ] 未一次性加载无关参考文件
- [ ] **编排者未越权实施**：会话内无 `Write` / `Edit` 写阶段产物文件（含 .tla/.cfg/tla-manifest.json 实体）、无直接产出的 `VerifierOutput` JSON 内容、无生成的代码或测试用例；所有实施动作均由 S / V / G 子代理执行（反模式 #10）
- [ ] **图谱校验通过**：阶段 1–4 的 `check-requirement-graph.ts` 退出码 0；阶段 4 零违反硬约束达成才放行进编码
- [ ] 图谱信息流无黑洞/奇迹/死模块，且边界（EXT-IN/EXT-OUT）完整（`check-requirement-graph.ts` 退出码 0，`GRAPH_JSON.dataflowViolations` 全空）
- [ ] **TLA+ 行为门禁通过**（约束 #13，L2+ 必跑）：阶段 1–4 的 `check-tla-model.ts` 退出码 0（`TLA_JSON.passed=true`）；phase>=2 时强制 `--graph=<graph.json>`，manifest 须含 sdCoverage 且 `uncoveredSdNodes` 为空（由 S-ingest-tla 回填）；阶段 4 TLA+ 零违反（无死锁/不变式违反/状态爆炸/拆解决策合规）+ 图谱零违反才放行进编码；TLA+ 规格无占位/简化/错误实现（反模式 #16）；建模与需求/设计一致（反模式 #17）
- [ ] **BDD 行为门禁通过**（约束 #13，L2+ 必跑）：阶段 1–4 的 `check-bdd-model.ts --phase=N` 退出码 0（8 维度 D1-D8 全通过：D1 头标注 / D2 Gherkin 语法 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射 / D8 SD Coverage——phase>=2 强制，designCoverage.uncoveredSdNodes 须为空，由 S-ingest-bdd 回填）；BDD features 无占位/简化/错误实现；建模与需求/设计/TLA+ 一致（反模式 #29）
- [ ] **Phase 2 系统设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **Phase 3 概要设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **Phase 4 详细设计**：6 独立产物文件齐全、引用块成立、DoD 清单 ≥ 8 项
- [ ] **阶段5 codeModule 回填**：RTM.codeModule 列已回填（格式 SD-xxx:src/path，编码后强制）；缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1
- [ ] **阶段门放行已填理解证据**：run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行（见 [definition-of-done.md](definition-of-done.md) 第六维度）
- [ ] **预算与成熟度已检查**：阶段门放行前跑预算检查（超 `budget.json` 限制按 `onExceed` 处置）；CHECKPOINT 类型由 `maturity.json.level` 决定（L1+ 操作型自动放行仍记录 run-log）；见 [operational-recovery.md](operational-recovery.md)
- [ ] `check-budget.ts` 是否 exitCode=0
- [ ] `check-run-log.ts` 是否 exitCode=0
- [ ] `check-maturity.ts` 是否 exitCode=0
- [ ] `check-checkpoint.ts` 是否 exitCode=0
- [ ] **上下文窗口已清理**：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）
- [ ] **TLA+ 资料按需加载**：S-tla/V-tla 子代理按 [tla-plus-guide.md §13 加载矩阵](tla-plus-guide.md) 加载 4 份参考文件，禁止一次加载全部
- [ ] 反模式 #20（只规划不执行）：确认所有规划都有对应执行动作，未停留在规划阶段
- [ ] 反模式 #21（阶段级门禁跳过）：确认阶段 6/7/8 都跑了 `--phase=N` 门禁，未跳过阶段级校验
- [ ] **JSON 文件写入工具**（反模式 #25，第 16 轮 P4.2）：所有 JSON 文件写入用 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell `ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content`（BOM + 深度 + 中文乱码）。详见 [operational-recovery.md](operational-recovery.md)「JSON 文件写入工具选择」节
- [ ] **acknowledgedDecisions 关键词**：每条 `acknowledgedDecisions` 决策条目须命中 ID 模式（`REQ-\d+` / `SD-[\d.]+` / `INTF-[\d.]+` / `DD-[\d.]+` / `TC-\w+-\d+`）或 TECH_KEYWORDS（`REST` / `JWT` / `HTTP` / `状态机` / `不变式` / `接口` / `存储` 等 37 个中英关键词）；「同意」/「确认」/「OK」/「好的」视为空，触发 `check-checkpoint.ts` R2 名词违规。完整集合见 [phase-8-acceptance-test.md](phase-8-acceptance-test.md)「acknowledgedDecisions 决策条目须含关键词」节
- [ ] **调测者简化行为自检**（反模式 #27，第 17 轮 P5）：self-as-verifier 模式下每阶段须按 [operational-recovery.md](operational-recovery.md)「调测者简化行为预防」节自检清单逐条核验（硬约束复述 / reworkHints 非空 / 9 脚本全 exitCode=0 / §9 确认 / 长会话重读硬约束）。命中任一简化倾向（S1 上下文压缩丢细节 / S2 追求效率省步骤 / S3 未对照硬约束核验）回阶段起点
- [ ] **Bundled Resources 按需加载**：会话内已加载的文件清单与「Bundled Resources」表对照，未加载无关文件（约束 #6 可执行化）
