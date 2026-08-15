# w-model-dev 可靠性/易用性/有效性审计修复设计（2026-08-15）

> 三维度主动审计（3 个并行审计子代理 + 主线程实测复核）产出 24 项发现，
> 用户确认修复范围：**P0×3 + P1×8 + P2×10 = 21 项**（P3×3 列后续可选）。
> 约束：**严格性不降**——所有修复只降摩擦/补证据/补索引，不削弱任何门禁。
> 本文件为决策记录；实施计划见 `docs/superpowers/plans/2026-08-15-skill-opt-audit-21fixes.md`。

## 审计基线

- 版本：41.16.0（健康指标全绿：self-test 254/254、vitest 40 files/634 tests、pre-push 16 项）
- 实测数据：SKILL.md 17,821 chars/233 行；必读链（SKILL+hard-constraints+dispatch-matrix+subagent-delegation）84,375 chars；subagent-delegation.md 46,131 chars/1,205 行；anti-patterns.md 48,185 chars/770 行；references/ 恰 53 份 .md（Glob 清点）
- 错误信息实测：`--phase=99` / 不存在文件均正确输出 exit 2 + ERROR_JSON（该机制工作正常）

## P0 修复设计

### A1 状态写助手 wm-write.ts（文档承诺落地）

问题：operational-recovery.md L42-51 承诺 `.bak.YYYYMMDD-HHMM` 备份 / mtime 并发守卫 / 临时文件→原子 rename，scripts/ 全目录 grep 零实现（主线程复核确认）。

设计（用户选定方案甲）：
- 新增 `scripts/logic/state-write-logic.ts`（纯逻辑，可 vitest）：
  - `backupExisting(absPath)`: 存在则复制为 `<name>.bak.YYYYMMDD-HHMM`（同目录，保留最近 5 份，超出删除最旧）
  - `atomicWriteJson(absPath, jsonText)`: 解析校验 → 写 `<abs>.tmp-<pid>` → fs.rename 原子替换 → 回读校验
  - `mtimeGuard(absPath, expectedMtimeMs)`: 期望非空且与当前不符 → 返回冲突（exit 1 语义：校验失败），提示重新读取合并
- 新增 `scripts/cli/wm-write.ts`：`wm-write.ts <target.json> [--stdin | --from <src.json>] [--expect-mtime <ms>] [--no-backup]`
  - 退出码：0=写入成功 / 1=mtime 冲突或校验失败 / 2=输入错误（ERROR_JSON）
  - 用法（SKILL.md 步骤 10 持久化协议指向）：O/S 更新 `.w-model/*.json` 一律经 wm-write，禁止直接覆盖写
- 配套：vitest `state-write-logic.test.ts`（备份轮换/原子性/mtime 冲突/BOM 容错）+ samples 1 组 + self-test 挂载 + operational-recovery.md 更新为实现说明
- registry：dispatch-matrix §6 登记一行（script-registry 门禁要求）

### A2 评估缺口如实化 + e2e 列后续行动

- eval/README.md「当前状态」节新增后续行动清单：① e2e 重跑（8 阶段生产规模，非 self-as-verifier）② darwin-skill 盲评补跑（按既有待评估版本表）
- 不在本轮伪造证据；如实记录缺口现状（README 已声明，补行动项与负责人占位）

### A3 评估提示词扩充（15 → 25 条）

新增 10 条（id 16-25），覆盖新机制（均含 prompt + expected 断言）：
R3 缺失拦截 / 冰山 ICEBERG-B 未触发放行 / TLA+ L2 项目跳过 TLC / BDD 头标注缺失 / ingestion 第 6 轮未收敛处置 / opsx 三段跳步 / codegraph 修改前未查询 / self-as-verifier 产物路径同路径 / 编排者越权实施（#10）/ gate-logs 交叉校验 exitCode 伪造。
同步 eval/README §2 分类表与计数。

## P1 修复设计

### B1 依赖预检 doctor.ts + schema-loader 单点守卫

- `scripts/cli/doctor.ts`：统一预检 node ≥18 / tsx 可用 / ajv+ajv-formats 可解析 /（按需）java ≥11 + tools/tla2tools.jar /（可选 L3）codegraph+openspec。逐项输出 ✅/❌ + 修复指引；退出码 0=必需项全过 / 1=必需项缺失 / 2=输入错误。`--json` 支持
- schema-loader.ts：ajv/ajv-formats 改为顶层 `await import(...)` try/catch 守卫，失败输出 ERROR_JSON（UNEXPECTED + 「在仓库根执行 npm install」指引）exit 2——单点覆盖全部 26 个 check 脚本
- SKILL.md 工作流步骤 2 读取状态前插入「步骤 1.5 环境预检：首次启用或门禁报依赖错误时跑 doctor.ts」；INSTALL.md 安装步骤同步

### B2 check-tla-model 环境检查前置 + 语义修正

Java/jar 缺失从「manifest 读取后收集 errors → exit 1」改为「入口参数解析后立即检查 → exitWithError(UNEXPECTED, exit 2) + 安装指引」。校验逻辑本身不变（有 Java 时行为完全一致）。

### B3 subagent-delegation.md 分段加载导引

顶部新增「加载导引」节：首次分派只读 §角色划分 + §每阶段分派时序 + §强制约束；§S 拆分机制（阶段 1-4 首次 S 分派时）/ §R-lead / §豁免审批 / §S-emergency-fix（按场景触发）。不拆文件、不删内容。

### B4 六份重型参考分层摘要

anti-patterns / verifier-spec / tla-plus-guide / bdd-guide / agent-personas / data-models 顶部各加「速查摘要」节：一页速查表（关键规则/维度/锚点）+「按场景只读 §X」导引。内容从现有章节提炼，不改任何规则语义。

### B5 anti-patterns.md 阶段索引

顶部新增「阶段 N 必读反模式清单」表（8 阶段 × 该阶段高发反模式编号 + 一句话检测信号），数据取自既有「命中高发阶段」表（L90-141）反向重排。

### B6 dispatch-matrix「S 变体 × R3/V/G 触发矩阵」消歧

事实基准（check-preventive-review.ts 已确认）：R3 变体按**工作类型** 4 种（standard/fix/emergency/ingest），**不按 S 角色拆分**（S-doc/S-tla/S-bdd 共享一套 standard R3×3）。矩阵明确：每阶段每变体一套 R3×3 + V×1 + G×1；阶段 5-8 opsx 按段（explore/propose/apply）各一套。消除 18→30 分派漂移歧义。

### B7 run-log R8 轨迹校验扩展

run-log-logic.ts R8 新增相对顺序约束（存在才校验顺序，存在性仍归各专项规则）：同阶段内 produce/fix 类 S 动作 < preventive(R3) < review(V) < gate 类 G < checkpoint。兼容存量 valid 样本（新约束只拒绝「V 早于 S」类真实违规）；新增 bad 样本 + self-test 用例 + vitest 用例。

### B8 错误消息补「期望 + 修法」尾注

design-contract-logic.ts（5 处：L224/251/287/312 等）与 tla-logic.ts 层次校验（L425-458 段）消息补修复指引，风格对齐 verifier-logic（`（应…，示例…）`）。同步更新受影响 vitest 断言与 self-test 样本期望文本。

## P2 修复设计

- C1 BOM 剥离：safe-json.ts `parseJsonSafe` 入口 `replace(/^\uFEFF/, '')` + read-json-or-exit JSONL 路径同样处理；vitest 用例（含 BOM JSON / BOM JSONL 首行不丢数据）
- C2 check-iceberg-sweep.ts readReport 复用 readJsonOrExit，删除 `null as unknown as` 双轨
- C3 check-docs-consistency 新增「文档内链存在性」：提取 SKILL.md/references/*.md/README.md/AGENTS.md 的 Markdown 相对链接（跳过 http/纯锚点/代码块外），resolve 后 existsSync，缺失即 violation；vitest 用例
- C4 toolbox.md 去孤岛：SKILL.md「Bundled Resources」references 行 + dispatch-matrix 顶部加指针
- C5 command-reference.md 12 命令统一四件套（速查行/参数表/失败动作/guide 链接）
- C6 新增 templates/README.md：阶段 × 主模板 × 子模板映射表（对齐 gate-logic.ts PHASE_SPEC_LAYOUT）+ 每模板一行用途
- C7 dispatch-matrix：顶部「按阶段分节加载导引」+ 补全 53 文件触发条件表（补 15 个仅 2 跳可达文件）
- C8 metrics-report-logic 扩展编排质量指标（只读不加门禁）：r3Stats（套数/findings 分布）/ icebergStats（轮次分布/newFindings 计数）/ reworkHints 统计；数据源 run-log + `.w-model/preventive-reviews/` + `.w-model/iceberg/`（存在才统计）；vitest 用例；hill-climbing-guide.md 指标映射注记
- C9 check-artifact-gate 新增 `--validate-templates` 模式：按 PHASE_SPEC_LAYOUT 校验 templates/ 资产含必需结构标记（SSOT 头/引用块/DoD 节），模板漂移可检出；vitest 用例
- C10 check-requirement-graph 新增轮次上限校验：graph.json 校验记录 `round` 字段（schema 已必填）> MAX_ROUNDS=5 → violation（exit 1）；常量入 lib/constants.ts

## 元同步与版本

- 顺序遵循 AGENTS.md §6：SSoT → w-model-dev 资产 → README/AGENTS/CONTRIBUTING/CHANGELOG
- SSoT 插入点：§8（wm-write/doctor 脚本）、§10D（R8 扩展 + metrics 指标）、§10 系列（--validate-templates、轮次上限）
- SKILL.md：步骤 1.5 doctor、步骤 10 wm-write 协议、Bundled Resources 更新（toolbox 指针 + 脚本计数 31→33）
- AGENTS.md §8 脚本导航表 +2 行（doctor/wm-write）；计数同步；README 健康指标日期/计数刷新
- CHANGELOG 新版本 41.17.0（minor：新增 2 脚本 + 门禁增强 + 文档导航优化）；版本用 scripts/version-bump.cjs 单源 bump
- 回归：`npm run self-test` → `npx vitest run --config config/vitest.config.ts` → `npm run lint:security`（新文件如触发 baseline 需 --regenerate）→ `npm run check:docs`（docs-consistency 计数同步后须过）→ `npm run prepush`（16 项；Windows 下经 bash 执行）

## 明确不做（本轮）

- P3×3（pre-push 提示强化 / selfCheckCompleted 遥测 / hill-climbing 校验脚本）——列后续
- e2e 重跑与 darwin-skill 盲评——外部行动，仅登记
- 任何门禁削弱、文件拆分、规则删减
