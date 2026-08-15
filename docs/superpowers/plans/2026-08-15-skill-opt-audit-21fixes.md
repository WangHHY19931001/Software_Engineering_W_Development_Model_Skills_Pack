# w-model-dev 审计修复 21 项实施计划（2026-08-15）

> **For agentic workers:** 本计划由主会话串行执行（用户约束：文档修改禁止并行）。
> 步骤用 checkbox 跟踪。设计依据：`docs/superpowers/specs/2026-08-15-skill-opt-audit-21fixes-design.md`。

**Goal:** 修复审计发现的 P0×3 + P1×8 + P2×10，严格性不降，全量回归通过，版本升至 41.17.0。

**Architecture:** 波次执行——Wave1 代码修复（可靠性/有效性脚本，9 项）→ Wave2 参考文档修复（易用性导航，8 项）→ Wave3 评估资产（A2/A3）→ Wave4 元同步（SSoT/SKILL/README/AGENTS/CHANGELOG/版本）+ 全量回归。每波结束跑对应局部回归。

**Tech Stack:** TypeScript (tsx ESM) / vitest / JSON Schema draft-07 / Markdown。

**执行总约束:**
- 每个代码任务：先读目标文件相关段 → 写/改 vitest 用例 → 跑失败 → 实现 → 跑通过（TDD）
- 新增校验项必须同步 samples + self-test 挂载 + samples/README 矩阵（check-samples-coverage 门禁）
- 脚本新增/改名只登记 dispatch-matrix §6 一处（script-registry 门禁兜底）
- 文档计数（脚本数/vitest 数/test 数/references 数）在 Wave4 统一以实测刷新

---

## Wave 1：代码修复（串行）

### Task 1（C1）：safe-json BOM 剥离

**Files:** Modify `w-model-dev/scripts/lib/safe-json.ts`；Test `w-model-dev/scripts/__tests__/safe-json.test.ts`

- [ ] 读 safe-json.ts 全文（<100 行）
- [ ] vitest 新增用例：`parseJsonSafe('\uFEFF{"a":1}')` 返回对象；BOM+非 JSON 抛错
- [ ] `npx vitest run safe-json --config config/vitest.config.ts` 确认失败
- [ ] parseJsonSafe 入口加 `text = text.replace(/^\uFEFF/, '')`
- [ ] 跑通过；`npm run self-test` 不回归

### Task 2（C1b）：read-json-or-exit JSONL 路径 BOM

**Files:** Modify `w-model-dev/scripts/lib/read-json-or-exit.ts:54-90`（readJsonlLines/相关）

- [ ] JSONL 读取后 `raw = raw.replace(/^\uFEFF/, '')`（首行 BOM 不再静默丢行）
- [ ] vitest：BOM JSONL 首行可解析（tmp 目录 fixture）

### Task 3（A1）：state-write-logic.ts + wm-write.ts

**Files:** Create `w-model-dev/scripts/logic/state-write-logic.ts`、`w-model-dev/scripts/cli/wm-write.ts`；Test Create `w-model-dev/scripts/__tests__/state-write-logic.test.ts`

核心 API（logic 层纯函数，IO 经注入便于测试）：

```ts
export interface StateWriteOptions { backup?: boolean; keepBackups?: number; expectMtimeMs?: number | null }
export interface StateWriteResult { ok: boolean; writtenPath: string; backupPath?: string; reason?: string }
export function backupPathFor(absPath: string, now?: Date): string  // <name>.bak.YYYYMMDD-HHMM
export async function writeStateJson(absPath: string, jsonText: string, opts: StateWriteOptions): Promise<StateWriteResult>
// 流程：parse 校验(经 parseJsonSafe) → mtime 守卫(不符→{ok:false,reason:'MTIME_CONFLICT'}) → backupExisting(复制+轮换 keepBackups=5)
//      → 写 <abs>.tmp-<pid> → fs.rename → 回读校验 → {ok:true}
```

CLI：`wm-write.ts <target.json> [--stdin|--from <src>] [--expect-mtime <ms>] [--no-backup]`
退出码 0/1(mtime 冲突或校验失败)/2(输入错误 ERROR_JSON)。

- [ ] vitest：备份生成与轮换 / 原子替换后内容正确 / mtime 冲突返回 MTIME_CONFLICT / 非法 JSON 拒绝 / 目标不存在直接写
- [ ] 实现 logic + cli（cli 复用 lib/cli-error.ts、read-json-or-exit 风格）
- [ ] `npx tsx w-model-dev/scripts/cli/wm-write.ts --help` 冒烟（PowerShell echo 管道 --stdin）
- [ ] operational-recovery.md L42-51 段更新为「已实现：经 wm-write.ts 写入」+ 用法一行（Wave 2 一并做也可）
- [ ] dispatch-matrix §6 登记 wm-write 行

### Task 4（B1a）：schema-loader 依赖守卫

**Files:** Modify `w-model-dev/scripts/logic/schema-loader.ts:12-30`

- [ ] 读现文件，确认 ajv 使用点（模块级 new Ajv）
- [ ] 改为：`let ajvMod; try { ajvMod = await import('ajv'); } catch { console.error(...UNEXPECTED 提示 npm install...); console.log('ERROR_JSON {...}'); process.exit(2); }`（顶层 await，tsx ESM 支持）；formats 同理
- [ ] `npm run check:verifier -- w-model-dev/scripts/samples/verifier/valid.json` 回归通过
- [ ] `npm run self-test` 回归

### Task 5（B1b）：doctor.ts

**Files:** Create `w-model-dev/scripts/cli/doctor.ts`；Test Create `w-model-dev/scripts/__tests__/doctor-logic.test.ts`（若 logic 抽出）；samples 可选（doctor 无 fixture 校验语义，vitest 覆盖即可，不进 self-test）

检查项（每项 ✅/❌+指引，--json 输出）：node>=18 / tsx / ajv+ajv-formats / java>=11（--with-tla 时必需，默认提示级）/ tools/tla2tools.jar / codegraph+openspec（可选提示）。退出码 0/1/2。
execFile 调 java/node -v（安全编码，避免 security-scan 新增发现；如触发按流程 --regenerate baseline）。

- [ ] vitest：各检查项函数级用例（mock execFile）
- [ ] `npx tsx w-model-dev/scripts/cli/doctor.ts` 实跑冒烟
- [ ] dispatch-matrix §6 登记 doctor 行

### Task 6（B2）：check-tla-model 环境前置

**Files:** Modify `w-model-dev/scripts/cli/check-tla-model.ts`（现 L97/127/321/340 环境检查段）

- [ ] 读 main 流程；将 Java/jar 检查提至参数解析后、manifest 读取前；缺失 → exitWithError(UNEXPECTED,'Java 环境缺失…安装指引',exit 2)
- [ ] 检查 __tests__ 与 samples 是否有依赖旧行为（exit 1 + env errors）的断言，同步更新
- [ ] `npx vitest run tla --config config/vitest.config.ts` + self-test 回归

### Task 7（C2）：check-iceberg-sweep readReport 复用

**Files:** Modify `w-model-dev/scripts/cli/check-iceberg-sweep.ts:60-105`

- [ ] readReport 三分支（ENOENT/非对象/解析失败）替换为 readJsonOrExit 调用，删除 `null as unknown as`
- [ ] iceberg 相关 vitest + self-test 回归

### Task 8（B7）：R8 轨迹顺序扩展

**Files:** Modify `w-model-dev/scripts/logic/run-log-logic.ts:410-465`；Test `__tests__/run-log-logic.test.ts`；samples 增 bad 用例

新约束（存在才校验顺序，不新增存在性要求）：同 phase 段内
`S(produce|fix|emergency-fix) index < preventive(R3) index < review(V) index < gate 类 G index < checkpoint index`。
违规消息含反模式引用与修法（对齐现有风格）。

- [ ] vitest：V 先于 S → violation；标准轨迹 → 通过；存量 valid 样本 → 通过
- [ ] samples：run-log/ 增加 bad-ordering.jsonl + self-test 挂载 + samples/README 矩阵行
- [ ] `npm run self-test` + vitest 回归

### Task 9（B8）：错误消息补修法

**Files:** Modify `w-model-dev/scripts/logic/design-contract-logic.ts`（L224/251/287/312 等）、`w-model-dev/scripts/logic/tla-logic.ts`（L425-458 层次校验段）

- [ ] 逐条补「（应…；示例…）」尾注（读上下文确认期望值来源后书写）
- [ ] 全文 grep vitest/samples 中旧消息断言并同步
- [ ] vitest + self-test 回归

### Task 10（C8）：metrics 编排质量指标

**Files:** Modify `w-model-dev/scripts/logic/metrics-report-logic.ts`；Test 对应 test.ts

新增只读统计（输入存在才输出）：`orchestrationQuality: { r3: {sets, byDimensionFindings}, iceberg: {reports, roundsHistogram, newFindingsTotal}, reworkHints: {total, bySource} }`
数据源：run-log entries + 项目目录 `.w-model/preventive-reviews/`、`.w-model/iceberg/`（可选参数传入）。

- [ ] vitest：含 R3/iceberg 产物的 fixture 目录 → 指标正确；空目录 → 字段缺省
- [ ] `npm run wm:metrics -- <samples 目录>` 冒烟（如 fixture 允许）

### Task 11（C9）：check-artifact-gate --validate-templates

**Files:** Modify `w-model-dev/scripts/logic/gate-logic.ts`（新增 validateTemplates(templatesDir)）+ `w-model-dev/scripts/cli/check-artifact-gate.ts`（新 flag）

- [ ] 读 gate-logic.ts PHASE_SPEC_LAYOUT（L300-324 附近）确认结构期望
- [ ] 实现：按布局校验模板文件存在 + 必需节标记（SSOT 头/引用块/DoD）存在
- [ ] vitest：templates 实目录 → 通过；临时删一标记 → violation
- [ ] flag 登记 command-reference / AGENTS §8 描述更新（Wave 4 统一）

### Task 12（C10）：check-requirement-graph 轮次上限

**Files:** Modify `w-model-dev/scripts/logic/graph-logic.ts`、`w-model-dev/scripts/lib/constants.ts`（MAX_INGESTION_ROUNDS=5）

- [ ] 读 graph.schema.json L62-68 确认 round 字段位置（校验记录对象）
- [ ] graph-logic：校验记录中 round > 5 → violation（exit 1 消息含「达 maxIcebergRounds 同义上限，应 CHECKPOINT 升级」）
- [ ] samples：graph bad 样本（round=6）+ self-test 挂载 + README 矩阵
- [ ] vitest + self-test 回归

### Task 13（C3）：docs-consistency 内链存在性

**Files:** Modify `w-model-dev/scripts/logic/docs-consistency-logic.ts`；Test 对应 test.ts

- [ ] 实现 extractMdLinks(md, baseDir)：Markdown `[..](path)` 相对链接，跳过 http(s)/#/mailto/图片外链；resolve 后 existsSync
- [ ] 覆盖文件：SKILL.md、references/*.md、README.md、AGENTS.md、docs/INSTALL.md
- [ ] 白名单常量（已知合法的不存在目标，如 future 文档）——先实测跑一遍收集误报再定
- [ ] vitest：fixture 字符串用例；实跑 `npm run check:docs` 须通过（若暴露存量断链，如实修复或登记）

**Wave 1 收口：** `npm run self-test && npx vitest run --config config/vitest.config.ts && npm run lint:security && npm run check:docs`

---

## Wave 2：参考文档修复（串行，禁止并行修改）

### Task 14（B3）：subagent-delegation.md 顶部加载导引
- [ ] 读文件目录结构（grep '^#'）；标题后插「加载导引」节（首次只读 §角色划分/§分派时序/§强制约束；其余按场景触发清单）

### Task 15（B4）：六份重型参考分层摘要
对 anti-patterns（并入 Task 16）/ verifier-spec / tla-plus-guide / bdd-guide / agent-personas / data-models：
- [ ] grep '^#' 取各文件节结构 → 每份标题后插「速查摘要」节（速查表 + 按场景只读 §X 导引），内容从既有节提炼不改语义

### Task 16（B5）：anti-patterns.md 阶段索引
- [ ] 读 L90-141 高发阶段表 → 顶部插「阶段 N 必读反模式」8 行表（编号+一句话信号）

### Task 17（B6）：dispatch-matrix「S 变体 × R3/V/G 触发矩阵」
- [ ] 读 dispatch-matrix §2/§5 + hard-constraints #11 + check-preventive-review variant 语义（已确认：按工作类型 4 变体，不按 S 角色拆分）
- [ ] §2 后插矩阵表；阶段 5-8 opsx 按段说明对齐 §5 实际

### Task 18（C4/C7）：dispatch-matrix 分节导引 + 53 文件触发表 + toolbox 指针
- [ ] 顶部插「按阶段分节加载导引」；§3 后补「全 references 触发表」（53 行，含 15 个 2 跳文件）；顶部加 toolbox.md 指针
- [ ] SKILL.md Bundled Resources references 行补 toolbox（与 Wave 4 SKILL 编辑合并执行，注意串行同文件）

### Task 19（C5）：command-reference.md 12 命令四件套统一
- [ ] 逐命令统一：速查行/参数表(参数|必填|取值|默认|说明)/失败动作/guide 链接；新增 doctor 与 wm-write 工具脚本节

### Task 20（C6）：templates/README.md 索引
- [ ] 读 gate-logic PHASE_SPEC_LAYOUT → 新建 README.md：阶段×主模板×子模板映射 + 每模板一行用途 + 与 --validate-templates 关联说明

**Wave 2 收口：** `npm run check:docs`（含 Task 13 新内链校验，新增文档自身链接必须有效）

---

## Wave 3：评估资产

### Task 21（A3）：test-prompts 扩充 15→25
**Files:** Modify `eval/w-model-dev-test-prompts.json`、`eval/README.md`
- [ ] 新增 id 16-25（R3 缺失/冰山未触发/TLA+ 跳 TLC/BDD 头标注/ingestion 第 6 轮/opsx 跳步/codegraph 未查询/self-as-verifier 同路径/O 越权/exitCode 伪造），每条 scenario+prompt+expected
- [ ] README §2 分类表补「新机制覆盖」类与计数 15→25

### Task 22（A2）：eval/README 后续行动清单
- [ ] 「当前状态」节追加行动项：e2e 重跑（生产规模）/ darwin-skill 盲评补跑，含前置条件（本轮 41.17.0 合入后）

---

## Wave 4：元同步 + 版本 + 全量回归

### Task 23：SSoT 更新
- [ ] §8 技术实现方案：wm-write/doctor 两脚本条目；§10D：R8 扩展规则 + metrics orchestrationQuality 指标；§10 系列：--validate-templates、graph 轮次上限（插至对应小节，先读插入点上下文）

### Task 24：SKILL.md 更新（同文件串行一次完成）
- [ ] 步骤 1.5 doctor（首次启用/依赖报错时）；步骤 10 持久化改「经 wm-write.ts 写入」；Bundled Resources：toolbox 指针 + scripts 计数 31→33（26 check + 7 工具）
- [ ] 阶段门节补 `--validate-templates` 一句；command 速查表后补两工具脚本行

### Task 25：README/AGENTS/INSTALL 同步
- [ ] README：健康指标日期/计数刷新（以实测为准）、常用命令补 doctor、项目结构注释更新
- [ ] AGENTS.md：§8 表 +2 行（doctor/wm-write，含退出码）、§2/§3 计数与命令、§6 行动约束补「状态写入经 wm-write」
- [ ] INSTALL.md：安装步骤补 doctor 验证一步

### Task 26：CHANGELOG + 版本 bump
- [ ] CHANGELOG.md 新增 41.17.0 条目（Added：wm-write/doctor/--validate-templates/轮次上限/编排质量指标/评估提示词 25 条/templates 索引；Changed：R8 扩展/错误消息修法/BOM/内链门禁；Docs：分层摘要/阶段索引/触发矩阵/加载导引）
- [ ] `node scripts/version-bump.cjs 41.17.0`（确认五处单源同步机制）；skill-metadata.test 校验通过

### Task 27：全量回归
- [ ] `npm run self-test`（254+新样本）
- [ ] `npx vitest run --config config/vitest.config.ts`（634+新用例）
- [ ] `npm run lint:security`（新文件若触发 → 按流程 --regenerate 并核查 diff 仅含新文件指纹）
- [ ] `npm run check:docs` + `npm run check:samples`（如存在该 script）
- [ ] `npm run prepush`（16 项；PowerShell 下经 bash 执行，失败则逐项手跑等价命令并记录）
- [ ] 计数刷新复核：README 健康表/vitest 数/样本数与实测一致

---

## 验收定义（全部满足）

1. 21 项修复全部落地且与 spec 一致；严格性零削弱（新增校验只增不减）
2. 全量回归绿：self-test / vitest / lint:security / check:docs / prepush
3. 版本 41.17.0 五处单源一致；CHANGELOG/SSoT/资产三层同步
4. 审计修复追踪表（含每项状态）回填至本文件末尾

---

## 修复追踪表（回填）

| 项 | 优先级 | 修复内容 | 状态 | 验证 |
|---|---|---|---|---|
| A1 | P0 | wm-write 状态写助手（.bak/mtime/原子替换/回读校验） | ✅ 完成 | state-write-logic.test.ts + self-test 挂载 |
| A2 | P0 | eval 缺口如实化 + e2e 后续行动清单 | ✅ 完成 | eval/README.md 后续行动清单 |
| A3 | P0 | 评估提示词 15→25 条 | ✅ 完成 | w-model-dev-test-prompts.json id 16-25 + eval/README 分类表 |
| B1 | P1 | doctor.ts 环境自检 + schema-loader 守卫 | ✅ 完成 | doctor-logic.test.ts + tla 环境前置 |
| B2 | P1 | check-tla-model 环境检查前置 | ✅ 完成 | 环境错误 exit 2 |
| B3 | P1 | subagent-delegation 加载导引 | ✅ 完成 | 已存在，确认 |
| B4 | P1 | 六份重型参考分层摘要 | ✅ 完成 | 6 文档速查摘要 |
| B5 | P1 | anti-patterns 阶段索引 | ✅ 完成 | 阶段 N 必读表 |
| B6 | P1 | dispatch-matrix 触发矩阵消歧 | ✅ 完成 | S 变体 × R3/V/G 矩阵 |
| B7 | P1 | run-log R8 轨迹顺序扩展 | ✅ 完成 | run-log-logic.test.ts + bad-ordering 样本 |
| B8 | P1 | 错误消息补「期望+修法」 | ✅ 完成 | 断言同步 |
| C1 | P2 | safe-json BOM 剥离 | ✅ 完成 | safe-json.test.ts |
| C2 | P2 | iceberg readReport 双轨消除 | ✅ 完成 | 退出码一致 |
| C3 | P2 | check-docs-consistency 内链门禁 | ✅ 完成 | docs-consistency-logic.test.ts |
| C4 | P2 | toolbox 去孤岛 | ✅ 完成 | SKILL.md + dispatch-matrix 指针 |
| C5 | P2 | command-reference 四件套 | ✅ 完成 | 12 命令统一 |
| C6 | P2 | templates/README.md 映射表 | ✅ 完成 | 新建文件 |
| C7 | P2 | dispatch-matrix 加载导引 + 53 文件表 | ✅ 完成 | §0 + §3.1 |
| C8 | P2 | metrics 编排质量指标 | ✅ 完成 | metrics-report-logic.test.ts |
| C9 | P2 | --validate-templates 模板漂移校验 | ✅ 完成 | gate-enhancement.test.ts + 真实资产回归 |
| C10 | P2 | 图谱轮次上限校验 | ✅ 完成 | graph-logic.test.ts |

**全量回归结果（41.17.0）：**

| 门禁 | 结果 |
|---|---|
| self-test | ✅ 256/256 |
| vitest | ✅ 42 files / 686 tests |
| lint:security | ✅ baseline 324，无新增风险 |
| check:docs | ✅ 0 违规（版本六处一致 + 内链检查） |
| check:samples | ✅ 276 fixture 全引用 |
| tsc strict | ✅ 0 错误 |

**版本同步：** 41.17.0 五处单源一致（package.json / skill-metadata.json / SKILL.md / README / INSTALL）+ CHANGELOG 节头；SSoT/资产三层同步完成。
