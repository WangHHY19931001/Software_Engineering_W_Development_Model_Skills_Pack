# 第22轮 P0-P3 技能问题修正设计

> 日期：2026-07-29
> 范围：W 模型开发技能包（w-model-dev）SSoT + scripts + references + schemas + samples
> 触发：第21轮 8 阶段完整调测发现的 10 个技能层面问题（P0×2 + P1×3 + P2×3 + P3×2）
> 方案：方案 A 轻量增量（复用现有 R 机制 + 预防性审查模式标记 + SSoT 与 scripts 双层保障）

## 1. 背景与问题清单

### 1.1 问题来源

第21轮在 blog-system-demo 上完成 W 模型 8 阶段完整调测，发现 10 个技能层面问题（非 demo 代码 bug），按严重度分类：

| 优先级 | 编号 | 问题简述 |
|---|---|---|
| P0 | P0-1 | 验收测试设计路径与实现映射缺失强制校验（uat-path-mapping.md 回填无门禁） |
| P0 | P0-2 | RTM.codeModule 格式规范定义不明确（无正则约束，导致 code-tla-consistency 维度1失败） |
| P1 | P1-3 | 验收测试设计未校验 demo 范围边界（39% UAT 是 N/A skip） |
| P1 | P1-4 | Follow 类型字段命名与业务语义不一致（userId/bloggerId vs followerId/followeeId） |
| P1 | P1-5 | 限流中间件装配与测试策略矛盾（设计项未装配到中间件链） |
| P2 | P2-6 | check-bdd-model.ts 路径解析对目录结构假设过严 |
| P2 | P2-7 | verifier-output schema 约束与 Agent 产出认知差距 |
| P2 | P2-8 | check-design-contract-consistency.ts 默认路径错误 + 缺失提示不友好 |
| P3 | P3-9 | cross-env 在 Windows PowerShell 下失效 |
| P3 | P3-10 | TLA+/BDD 等价性维护成本高，缺乏自动化同步 |

### 1.2 设计决策（用户确认）

1. **范围策略**：全量修正 P0-P3，按优先级分阶段实施
2. **SSoT 先行**：先修正 SSoT 文档，再依据更新后的 SSoT 修正 scripts
3. **核心架构变更**：所有阶段 S 产出后启用三阶段 R 预防性审查（完整性/可靠性/安全性），作为 V 评审前置
4. **R3 与 V 的关系**：R 作为 V 前置（S→R3→V→G），R 产出三份审查报告供 V 参考
5. **codeModule 格式**：schema + gate 双重校验
6. **demo 范围**：不新增 project.json.demoScope 字段，通过 R3 完整性维度覆盖
7. **方案选择**：方案 A 轻量增量（复用现有 R 机制 + 预防性审查模式标记）

## 2. 核心架构变更：S→R3→V→G 流程

### 2.1 变更前

```
O 路由 → CHECKPOINT → S 产出 → V 评审 → G 门禁 → CHECKPOINT 放行
```

### 2.2 变更后

```
O 路由 → CHECKPOINT → S 产出 → R3 预防性审查 → V 评审 → G 门禁 → CHECKPOINT 放行
```

### 2.3 R3 三阶段审查维度

| 阶段 | 审查维度 | 检查项 | 产出文件 |
|---|---|---|---|
| R-完整性 | 产物完整性 | 字段齐全/模板套用/RTM 登记/demo 范围边界/N/A 标记/uat-path-mapping 回填 | `.w-model/preventive-reviews/<phase>-completeness.json` |
| R-可靠性 | 逻辑可靠性 | TLA+/BDD 等价性/状态机一致性/接口契约/字段命名业务语义对齐/设计项装配点与测试 seam 一致性 | `.w-model/preventive-reviews/<phase>-reliability.json` |
| R-安全性 | 安全风险 | 输入校验/鉴权/越权/敏感信息/限流装配/密码哈希 | `.w-model/preventive-reviews/<phase>-security.json` |

### 2.4 与返工 R 的区别

| 属性 | 返工 R（现有） | 预防 R3（新增） |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S 产出后主动触发 |
| 目的 | 定位根因 | 预防性审查 |
| 产出 | `RootCauseReport` | `PreventiveReview` 三份报告 |
| 方法论 | `root-cause-locator.md`（5-Why / 鱼骨图 / 上游回溯）定位根因 | 借鉴 `root-cause-locator.md` 分析工具，但目的不同：预防性审查用「完整性清单 + 可靠性核验 + 安全基线」三维度检查产物，不定位根因 |
| schema | `rootcause-report.schema.json` | `preventive-review.schema.json` |

### 2.5 V 评审参考方式

V 子代理在评审时须读取 R3 三份报告，将 R3 发现的问题纳入 `reworkHints`。V 不得跳过 R3 报告直接评审（命中反模式 #31）。

### 2.6 适用阶段

阶段 1-8 所有 S 产出后均启用 R3：
- 阶段 1 需求后：R-完整性 重点审查 demo 范围边界、uat-path-mapping.md 产出
- 阶段 5 编码后：R-安全性 重点审查输入校验/鉴权/限流装配
- 阶段 8 验收后：R-完整性 重点审查 N/A 用例与 Out of Scope 一致性

## 3. P0 修正：流程断层

### 3.1 P0-1：uat-path-mapping.md 回填校验

**SSoT 修改**：
- `phase-1-requirements.md` §输出：明确 `docs/uat-path-mapping.md` 为阶段1强制产出
- `phase-8-acceptance-test.md` §UAT 路径映射表：补充强制校验说明

**scripts 修改**：
- `check-artifact-gate.ts` 在 `--phase=1` 新增校验：`docs/uat-path-mapping.md` 文件存在性
- `check-artifact-gate.ts` 在 `--phase=5` 新增校验：
  - 读取 `docs/uat-path-mapping.md`
  - 解析 Markdown 表格行（复用 `check-design-contract-consistency.ts` 的 `parseUatPathMapping` 逻辑）
  - 校验：每条 UAT-NNN 的「实际路径」列非 `_待阶段5回填_`，且 `mappingType` ∈ `["直接","等价","替代"]`
  - 缺失文件或未回填项 → 退出码 1，reasons 列出具体 UAT ID

**samples 新增**：
- `samples/gate/bad-phase5-missing-uat-path-mapping.json`
- `samples/gate/valid-phase5-with-uat-path-mapping.json`

### 3.2 P0-2：codeModule 格式规范

**SSoT 修改**：
- `rtm-guide.md` §各阶段登记职责：补充 codeModule 格式规范
  - REQ 行：`^SD-[\d.]+:src/.+\.(ts|js|py|java)$`（带 SD 前缀 + 源码路径）
  - NFR/CON 行：`^(src/.+\.(ts|js|py|java)|横切)$`（不带 SD 前缀，或填"横切"）
- `phase-5-coding.md` §NFR/CON codeModule 回填：补充强制格式说明

**schemas 修改**：
- `rtm.schema.json` 的 `codeModule` 字段**不添加 pattern**（因 REQ/NFR 格式不同，单一 pattern 无法覆盖）；改为在 `check-artifact-gate.ts` 中按行类型分支校验

**scripts 修改**：
- `check-artifact-gate.ts` 在 `--phase=5` 新增 codeModule 格式校验：
  - REQ 行（`requirementId` 以 `REQ-` 开头）：校验 `codeModule` 匹配 `^SD-[\d.]+:src/.+`
  - NFR 行（`requirementId` 以 `NFR-` 开头）：校验 `codeModule` 匹配 `^src/.+` 或 `=== "横切"`
  - CON 行（`requirementId` 以 `CON-` 开头）：同 NFR

**samples 新增**：
- `samples/gate/bad-phase5-codemodule-format.json`（3 个 bad 样本：REQ 缺 SD 前缀 / NFR 带非法前缀 / 空值）

## 4. P1 修正：规范与实现认知差距

### 4.1 P1-3：demo 范围边界审查（通过 R3 完整性维度覆盖）

**SSoT 修改**：
- `phase-1-requirements.md` §并行任务：新增「demo 范围声明」要求
  - S-doc 产出需求规格时，须在 `Out of Scope` 节显式声明 demo 范围外子系统
  - 验收测试设计须对照 Out of Scope 标记 N/A 用例（附注释说明缺失端点名）

**R3 完整性维度**：R-完整性 审查时核验：
- 验收测试设计的 N/A 用例是否与 Out of Scope 声明一致
- N/A 用例是否附注释说明缺失端点名和原因
- 不一致或注释缺失 → R3 报告标注 `finding`，V 评审纳入 `reworkHints`

**不新增 project.json.demoScope 字段**（按用户决策）

### 4.2 P1-4：Follow 类型字段命名与业务语义对齐

**SSoT 修改**：
- `phase-3-outline-design.md` 新增「字段命名业务语义对齐」检查项（R3 可靠性审查项，非硬性门禁）：
  - 设计文档字段命名须与业务语义对齐（如「关注关系」用 `followerId/followeeId` 而非 `userId/bloggerId`）
  - 若因技术约束无法对齐，须在设计文档「Implementation Decisions」节说明字段映射
- `phase-4-detailed-design.md` 同步新增

**R3 可靠性维度**：R-可靠性 审查时核验字段命名与业务语义一致性，不一致且无 Implementation Decisions 说明 → 标注 `finding`（severity=Required），V 评审纳入 reworkHints

### 4.3 P1-5：限流中间件装配与测试策略一致性

**SSoT 修改**：
- `phase-4-detailed-design.md` 新增「设计项→装配点→测试 seam 三者一致性」校验要求：
  - 每个设计项（如 DD-026 RateLimitMiddleware）须声明：装配点（中间件链位置）+ 测试 seam（HTTP 层/独立实例/白盒）
  - 若装配点为空但测试 seam 为 HTTP 层 → R3 可靠性审查标注 `finding`

**R3 可靠性维度**：核验设计项的装配点与测试 seam 一致性

## 5. P2 修正：门禁脚本健壮性

### 5.1 P2-6：check-bdd-model.ts 路径解析多路径查找

**scripts 修改**：
- `check-bdd-model.ts` L192-201 修改路径解析逻辑：
  - 当前：`manifestDir = path.dirname(manifestFile)` → `basePath = projectDir + manifest.basePath`
  - 修改后：先尝试 `basePath`，失败后回退查找 `.w-model/` 根目录、`.w-model/bdd/` 子目录
  - 新增函数 `resolveFeatureFile(basePath, filePath)`：返回第一个存在的路径

**samples 新增**：
- `samples/bdd/valid-manifest-root.json`（manifest 在根目录的场景）

### 5.2 P2-7：verifier-output schema 约束补充常见违规示例

**SSoT 修改**：
- `verifier-spec.md` §2.3 subCriteria 标准模板 后新增「常见违规示例」节：
  - 违规示例 1：`mappingType` 使用 `"NFR"` / `"CON"` 不在枚举内 → 正确：`"直接"`
  - 违规示例 2：`subCriteria.name` 使用 `"性能"` / `"安全"` 不匹配 `^[a-z][a-z-]*$` → 正确：`"correctness"` / `"security"`
  - 违规示例 3：额外字段 `customField` 违反 `additionalProperties: false` → 正确：仅使用 schema 定义字段
  - 推荐 subCriteria 名称清单：直接引用 §2.3 表格的 20 个标准名称

**不修改 schema 本身**（schema 已正确定义），仅补充 Agent 认知文档

### 5.3 P2-8：check-design-contract-consistency.ts 默认路径与缺失提示

**scripts 修改**：
- `check-design-contract-consistency.ts` 修改：
  - `project-dir` 未传时从 `process.cwd()` 推断（已是现状，保持）
  - `docs/uat-path-mapping.md` 不存在时，输出明确提示：`✗ uat-path-mapping.md 不存在，请在阶段1产出该文件（见 phase-1-requirements.md §输出）`
  - 退出码保持 2（输入错误），但错误消息可操作

## 6. P3 修正：跨平台与工具链

### 6.1 P3-9：cross-env 在 Windows PowerShell 下失效

**SSoT 修改**：
- `phase-5-coding.md` 新增「跨平台环境变量设置」节：
  - 推荐方案：使用 `dotenv` 包，在项目根创建 `.env` 文件，`import 'dotenv/config'` 自动加载
  - 备选方案：`package.json` scripts 使用 `cross-env`（需安装为 devDependency）
  - Windows PowerShell 适配说明：`cross-env` 在 PowerShell 下可能失效，建议用 `$env:VAR="value"` 临时设置或 `dotenv`

**不修改 scripts**（脚本是 tsx 执行，不涉及 npm script 环境变量）

**samples 修改**：
- `examples/coding.md` 补充跨平台 `.env` 示例

### 6.2 P3-10：TLA+/BDD 等价性自动化同步

**scripts 新增**：
- `check-tla-bdd-sync.ts` 脚本：
  - 从 TLA+ 文件抽取转移名（`Next == \/ Act1 \/ Act2`）、状态名、不变式名
  - 从 BDD feature 文件 Background 节抽取状态机七要素
  - diff 比对两者差异，输出 `violations` 清单
  - 退出码 0=一致 / 1=有差异 / 2=输入错误

**SSoT 修改**：
- `tla-plus-guide.md` 新增「TLA+/BDD 自动化同步校验」节，引用新脚本
- `bdd-guide.md` 同步新增

**samples 新增**：
- `samples/tla-bdd-sync/valid.json`
- `samples/tla-bdd-sync/bad-transition-mismatch.json`

**集成**：`check-bdd-model.ts` D4 等价性校验可调用新脚本（可选，不强制）

## 7. 新增反模式与 R3 校验机制

### 7.1 新增反模式 #31：跳过 R3 预防性审查

**SSoT 修改**：
- `anti-patterns.md` 新增 #31：
  - 检测信号：S 产出后未触发 R3 三阶段审查，直接进入 V 评审
  - 回退动作：回到 S 产出后起点，补跑 R3

### 7.2 新增 check-preventive-review.ts 脚本

**功能**：校验 R3 三份报告完整性
- 读取 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`
- 校验每份报告含 `reviewedAt` / `reviewer` / `phase` / `dimension` / `findings[]` / `passed` 字段
- `findings[]` 每条含 `severity` / `description` / `evidence` 字段
- 三份报告须全部 `passed=true` 才放行（或 `passed=false` 但 V 已纳入 reworkHints）

### 7.3 新增 preventive-review.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/preventive-review.schema.json",
  "title": "PreventiveReview",
  "type": "object",
  "additionalProperties": false,
  "required": ["reviewedAt", "reviewer", "phase", "dimension", "findings", "passed"],
  "properties": {
    "reviewedAt": { "type": "string", "format": "date-time" },
    "reviewer": { "type": "string", "minLength": 1 },
    "phase": { "type": "integer", "minimum": 1, "maximum": 8 },
    "dimension": { "enum": ["completeness", "reliability", "security"] },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["severity", "description", "evidence"],
        "properties": {
          "severity": { "enum": ["Critical", "Required", "Optional", "Nit", "FYI"] },
          "description": { "type": "string", "minLength": 1 },
          "evidence": { "type": "string", "minLength": 1 }
        }
      }
    },
    "passed": { "type": "boolean" }
  }
}
```

### 7.4 check-run-log.ts R3 记录校验

**scripts 修改**：
- `check-run-log.ts` 新增校验：run-log 中 S→V 之间须有 3 条 R3 记录（completeness/reliability/security），缺失即违规

## 8. SSoT 文档修改清单

| # | 文件 | 修改内容 | 对应问题 |
|---|---|---|---|
| 1 | `references/workflow.md` | 新增 R3 流程描述（S→R3→V→G） | §2 |
| 2 | `references/subagent-delegation.md` | R 子代理新增「预防性审查模式」；R3 三阶段审查维度 | §2 |
| 3 | `references/phase-1-requirements.md` | §并行任务 新增 demo 范围声明要求；§输出 新增 uat-path-mapping.md 强制产出 | P0-1, P1-3 |
| 4 | `references/phase-3-outline-design.md` | 新增字段命名业务语义对齐检查项 | P1-4 |
| 5 | `references/phase-4-detailed-design.md` | 新增设计项→装配点→测试 seam 三者一致性校验；字段命名对齐 | P1-4, P1-5 |
| 6 | `references/phase-5-coding.md` | codeModule 格式规范强制；新增跨平台环境变量设置节 | P0-2, P3-9 |
| 7 | `references/phase-8-acceptance-test.md` | §UAT 路径映射表 强制校验说明；demo 范围 N/A 标记要求 | P0-1, P1-3 |
| 8 | `references/rtm-guide.md` | codeModule 格式规范（REQ: `SD-xxx:src/path` / NFR/CON: `src/path` 或"横切"） | P0-2 |
| 9 | `references/verifier-spec.md` | §2.3 新增常见违规示例节；推荐 subCriteria 名称清单 | P2-7 |
| 10 | `references/anti-patterns.md` | 新增 #31 跳过 R3 预防性审查 | §7 |
| 11 | `references/tla-plus-guide.md` | 新增 TLA+/BDD 自动化同步校验节 | P3-10 |
| 12 | `references/bdd-guide.md` | 新增 TLA+/BDD 自动化同步校验节 | P3-10 |
| 13 | `examples/coding.md` | 跨平台 .env 示例 | P3-9 |
| 14 | `SKILL.md` | 约束 #17 R3 预防性审查强制；版本号升级 | §2 |

## 9. Scripts 修改清单

| # | 文件 | 修改内容 | 对应问题 |
|---|---|---|---|
| 1 | `check-artifact-gate.ts` | phase=1 新增 uat-path-mapping.md 存在性校验；phase=5 新增 uat-path-mapping 回填校验 + codeModule 格式校验 | P0-1, P0-2 |
| 2 | `check-bdd-model.ts` | 多路径查找（根目录/子目录回退） | P2-6 |
| 3 | `check-design-contract-consistency.ts` | uat-path-mapping.md 缺失时明确提示 | P2-8 |
| 4 | `check-run-log.ts` | 新增 R3 记录校验（S→V 间须有 3 条 R3 记录） | §7 |
| 5 | `check-preventive-review.ts` | **新增**：校验 R3 三份报告完整性 | §7 |
| 6 | `check-tla-bdd-sync.ts` | **新增**：TLA+/BDD 转移/状态/不变式 diff 比对 | P3-10 |
| 7 | `gate-logic.ts` | 新增 codeModule 格式校验逻辑 + uat-path-mapping 回填校验逻辑 | P0-1, P0-2 |

## 10. Samples 新增清单

| # | 路径 | 用途 |
|---|---|---|
| 1 | `samples/gate/bad-phase5-missing-uat-path-mapping.json` | P0-1 缺失文件 |
| 2 | `samples/gate/valid-phase5-with-uat-path-mapping.json` | P0-1 合规 |
| 3 | `samples/gate/bad-phase5-codemodule-format.json` | P0-2 格式错误（3 个 bad） |
| 4 | `samples/bdd/valid-manifest-root.json` | P2-6 根目录 manifest |
| 5 | `samples/preventive-review/valid-completeness.json` | R3 完整性合规 |
| 6 | `samples/preventive-review/bad-missing-evidence.json` | R3 缺失 evidence |
| 7 | `samples/tla-bdd-sync/valid.json` | TLA+/BDD 一致 |
| 8 | `samples/tla-bdd-sync/bad-transition-mismatch.json` | TLA+/BDD 转移不一致 |

## 11. 实施顺序

按 SSoT 先行原则：

1. **SSoT 层**（14 项）：先修正所有 references + SKILL.md + examples
2. **schemas 层**（1 项）：新增 `preventive-review.schema.json`
3. **scripts 层**（7 项）：依据更新后的 SSoT 修正 scripts + 新增脚本
4. **samples 层**（8 项）：为每个修改的脚本补充对应 sample
5. **测试层**：新增 `check-preventive-review.ts` 和 `check-tla-bdd-sync.ts` 的单元测试；更新 `gate-enhancement.test.ts` 覆盖新校验逻辑
6. **自测**：运行 `npx tsx scripts/self-test.ts` 确保所有测试通过

## 12. 验收标准

- [ ] SSoT 14 项文档修改完成
- [ ] `preventive-review.schema.json` 新增完成
- [ ] 7 项 scripts 修改/新增完成
- [ ] 8 项 samples 新增完成
- [ ] 单元测试新增/更新完成
- [ ] `npx tsx scripts/self-test.ts` 全部通过
- [ ] `npx tsc --noEmit` 0 错误
- [ ] 第22轮 spec/plan/archive 文档产出
