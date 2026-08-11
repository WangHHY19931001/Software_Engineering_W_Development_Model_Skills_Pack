# P0-P2 全量修正设计（2026-08-11）

> 依据：仓库分析报告《Software_Engineering_W_Development_Model_Skills_Pack》修正版。
> 本设计为单一事实来源（SSoT 补充文档），对应实施计划见 `docs/superpowers/plans/2026-08-11-p0-p2-fixes-*.md`。

## 1. 背景与目标

仓库分析报告指出 25 项 P0/P1/P2 级修正项。本设计在以下已确认约束下全量落实：

- **CI/CD 不集成**：不新增 GitHub Actions / GitLab CI；本地 `pre-push` hook 门禁维持为唯一技术强制屏障。
- **hook 绕过缓解**：`git push --no-verify` 绕过问题暂不处理（维持现状+文档声明）。
- **CI 依赖工具剔除**：Dependabot、semantic-release 全部剔除；依赖巡检改为人工 `npm audit` + `npm outdated` 流程（写入手册）。
- **协作模板新增**：ISSUE_TEMPLATE / PR_TEMPLATE 新增，并固化 Conventional Commits 规范到 CONTRIBUTING.md。

### 1.1 事实修正（相对原始报告）

| 原始报告论断 | 实际情况 | 处理 |
|---|---|---|
| P1「补充 `.eslintsecurity-baseline.json`」 | 文件已存在，security-scan 已实现 baseline v2 | 改为「维持+回归检查」（B3） |
| P2「补充 `templates/` 目录」 | `w-model-dev/templates/` 已存在 **37 份**模板（12 顶层 + 25 子目录，含 requirement-spec/system-design/interface-design/detailed-design 四阶段全套 + rtm/test-case/test-report/review-report/system-test + tla-spec/feature/bdd-manifest） | 改为「扩充」（C6，缺口仅 coding/integration-test/acceptance-test 3 份 Markdown + budget/run-log 等 JSON 模板） |
| P2「examples 添加完整样例」 | `w-model-dev/examples/` 已存在 4 份 | 改为「扩充至 8 阶段」（C8） |
| `check-artifact-gate.ts` 超 500 行 | 实际 486 行 | 表述修正为"接近 500 行" |
| 错误处理「直接抛原生 Error」 | cli-error.ts 已统一 6 类错误码 + ERROR_JSON | 改为「补齐三要素」（A2） |

### 1.2 执行策略

- 一个 spec + 一个 plan，按 **Batch P0 → P1 → P2** 三批执行。
- 每批结束跑**全量回归门禁**：`npm run self-test`（样本数以执行时实际输出为准，spec 撰写时约 250）+ `npx vitest run`（test files / tests 数以执行时实际输出为准，pre-push 注释自述 35 files / 530 tests）+ `npm run check:docs-consistency` + `npx tsc --noEmit` + `npm run lint:security`。
- 遵循仓库治理：改设计先改 SSoT → 资产（SKILL.md/references/scripts/templates）→ 顶层文档（README/AGENTS/CONTRIBUTING/CHANGELOG）。
- **vitest 测试文件数联动（防 docs-consistency 失效）**：docs-consistency 强制 `EXPECTED.vitestFileCount=35` + README 含「35 files」+ AGENTS 含「35 个 .test.ts」+ `__tests__/README.md` 覆盖矩阵。**任何批次若新增 .test.ts 文件**，必须同步这 4 处（EXPECTED 常量、README、AGENTS、__tests__/README.md 覆盖矩阵），否则 docs-consistency 报错。本 spec 各批次默认**只扩展已有测试文件、不新增测试文件**，若确需新增须走此联动。
- 每批完成后同步 CHANGELOG.md，按 Conventional Commits 提交。

## 2. Batch P0（阻断性，6 项：A1/A2a/A3/A4/A5/A6）

### A6  scripts 四层重组（先行）

**目标目录结构**（`w-model-dev/scripts/` 下）：

```
scripts/
├── cli/            # 全部 CLI 入口：check-*.ts + wm-status.ts + metrics-report.ts
│                   # + security-scan.ts + self-test.ts + ensure-codegraph-opsx.ts
├── logic/          # 全部纯逻辑：*-logic.ts + schema-loader.ts + plan-chunks.ts
├── lib/            # 通用工具：cli-error.ts / gate-report.ts / parse-phase.ts
│                   # / read-json-or-exit.ts / safe-json.ts（现有 5 工具保留）
├── samples/        # 端到端样本（已有，位置不变）
└── __tests__/      # vitest 单元测试（已有，位置不变）
```

**必改引用点**（全部同步，缺一不可）：

1. **跨文件 import 相对路径**：`check-*.ts` 与 `*-logic.ts` 之间的 `./xxx.js` → `../logic/xxx.js` / `../cli/xxx.js`；logic 层 import lib → `../lib/xxx.js`。
2. **`.githooks/pre-push`**：14 项门禁中的 `w-model-dev/scripts/check-*.ts`、`security-scan.ts`、`samples/` 路径全部改为 `w-model-dev/scripts/cli/...` 与 `w-model-dev/scripts/samples/...`。
   - **spawn 路径说明**：唯一子进程 spawn 发生在 [check-artifact-gate.ts:368-372](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/check-artifact-gate.ts#L368-L372)（终检调 `check-tla-model.ts` / `check-bdd-model.ts`，用 `path.resolve(__dirname, 'check-tla-model.ts')` 相对脚本自身位置）；因 check-artifact-gate 与这两个脚本**同迁至 `cli/`**，`__dirname` 指向 cli/，spawn 相对路径**保持不变**，无需修改。
3. **`check-docs-consistency.ts`**：`readdirSync(join(root,'w-model-dev/scripts'))` 的 `/^check-.*\.ts$/` 统计路径改为 `w-model-dev/scripts/cli`；**数量不变**（25 个 check-*.ts 含自身 + 5 工具 = 30），故 `EXPECTED.exit2ScriptCount=30` 常量、AGENTS.md「30 个脚本」文本均**不动**，仅更新 [check-docs-consistency.ts:76-77](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/check-docs-consistency.ts#L76-L77) 注释中的路径描述。注意：plan-chunks.ts 虽迁入 `logic/`，仍计入「5 工具」统计口径，勿改变 +5 逻辑。
4. **`self-test.ts`**（迁移到 `cli/`，相对原位置多一层目录）：
   - ① 样本路径：`path.join(here, 'samples')` → `path.join(here, '..', 'samples')`
   - ② **skillRoot 修正**：`path.join(here, '..')` → `path.join(here, '..', '..')`（原 `scripts/` 退一层到 `w-model-dev/`，现 `scripts/cli/` 需退两层）；否则 SKILL.md / skill-metadata.json 读取失败，版本三地方程式校验（C9）立即报错
   - ③ **内部约 30 个 import 路径**：`./xxx-logic.js` → `../logic/xxx-logic.js`；`./lib/safe-json.js` → `../lib/safe-json.js`；自身同目录的 check-* 仍用 `./`（如 `./check-artifact-gate.js` 不变，因 self-test 与 check-artifact-gate 同迁至 cli/）
   - ④ **self-test 无 spawn**：self-test 对全部用例直接 import 调用（runGateCases 直接调 `checkArtifactGate`、runGraphCases 直接调 `checkRequirementGraph` 等），不存在子进程 spawn，无需路径同步。
5. **`package.json`**：scripts 中 `w-model-dev/scripts/xxx.ts` → `w-model-dev/scripts/cli/xxx.ts`。
6. **文档引用**（README.md / AGENTS.md / SKILL.md / references/*.md / docs/INSTALL.md / docs/*.md / CONTRIBUTING.md / CHANGELOG.md，约 100+ 处）：`w-model-dev/scripts/xxx.ts` 全部改为新路径。
7. **`.cursor/skills/*`**：执行时 grep 扫描 `.cursor/skills/` 下文件是否引用 `w-model-dev/scripts/` 路径；有则按新路径修正，无则跳过（不强制存在）。
8. **`__tests__/*.test.ts` 内 import 路径**（29 处 / 跨 23 个测试文件）：`../xxx-logic.js` → `../logic/xxx-logic.js`；`../check-xxx.js` → `../cli/check-xxx.js`；`../lib/xxx.js` → `../lib/xxx.js`（不变，lib 位置未动）。重点文件：`gate-enhancement.test.ts`（6 处）、`schema-validation.test.ts`（2 处）、其余 21 个文件各 1 处。**遗漏任一处都会导致 vitest 全挂**。

**风险控制**：重组与逻辑拆分解耦——先纯搬迁（不改逻辑），跑通全量回归，再做 A1 逻辑拆分。搬迁采用 `git mv` 保留历史。

### A1  拆分 check-artifact-gate.ts（486 行）

拆分为以下模块（目标：主文件 <250 行）：

| 新模块 | 职责 |
|---|---|
| `lib/phase-doc-map.ts` | PHASE_DOC_MAP 常量 + resolvePhaseDoc（从主文件迁出） |
| `cli/artifact-gate-assets.ts` | graph 资产发现（ingestion 目录扫描）、tla-manifest 读取、bdd-manifest 读取+features/SM 校验（从主文件迁出） |
| `cli/uat-path-mapping.ts` | parseUatPathMappingFromContent / checkUatPathMappingContent（从主文件迁出，供 phase1/5/终检共用） |
| `cli/check-artifact-gate.ts` | 仅保留参数解析 + 资产装配 + gate-logic 调用 + 结果合并 + 输出 |

**兼容性约束**（关键，避免改错文件）：

- `gate-enhancement.test.ts:17` import 的是 `checkUatPathMappingBackfill`（来自 `gate-logic.js`，**不是** `checkUatPathMappingContent`）——重组后改为 `../logic/gate-logic.js`，**不涉及** uat-path-mapping.ts。
- `self-test.ts:78` import 的是 `checkUatPathMappingContent`（来自 `./check-artifact-gate.js`）——若将该函数实现迁出到 `cli/uat-path-mapping.ts`，**check-artifact-gate.ts 必须 re-export**（`export { checkUatPathMappingContent } from './uat-path-mapping.js'`），使 self-test 的 import 路径不变（同为 cli/ 目录，相对路径 `./check-artifact-gate.js` 仍有效）。
- 拆分出的新模块（`lib/phase-doc-map.ts`、`cli/artifact-gate-assets.ts`、`cli/uat-path-mapping.ts`）的导出签名必须与原 check-artifact-gate.ts 内部调用保持一致，主文件改为 import 这些模块即可，**不改变对外 CLI 行为**。

### A2  统一错误处理（三要素补齐，拆为 A2a + A2b）

**背景**：仓库有**两个独立错误通道**，spec 原 A2 混淆了二者：

| 通道 | 退出码 | 结构 | 用途 | 现状 |
|---|---|---|---|---|
| CliError | exit 2 | 对象（category/message/file...） | 输入错误（ARG_INVALID/FILE_NOT_FOUND 等 6 类） | cli-error.ts 已统一 |
| violations | exit 1 | `string[]` | 校验失败（规则违反） | 各 *-logic.ts 返回，格式不统一 |

#### A2a（P0，向后兼容）：CliError 新增 rule / field 字段

扩展 `lib/cli-error.ts` 的 `CliError` 接口（仅影响 exit 2 场景，向后兼容）：

```ts
export interface CliError {
  category: ErrorCategory;
  message: string;
  exitCode: 0 | 1 | 2;
  file?: string;        // 关联工件路径（已有）
  rule?: string;        // 违规规则链，如 'P0-1' / 'R1-R5' / 'D7'（新增）
  field?: string;       // 具体字段位置，如 'requirements[3].id'（新增）
  detail?: string;      // 补充详情（已有）
}
```

- `ERROR_JSON` 输出同步扩展 `rule` / `field` 字段（缺失时省略，向后兼容）。
- `formatCliError` 人类可读消息可选附加 `[rule=...]` 段。
- 全仓 check-*.ts 的 `exitWithError({...})` 调用补齐 `rule` / `field`：仅在已知规则 ID 的场景补齐（如 ARG_INVALID 对应 `P0-1`、FILE_NOT_FOUND 对应 `P0-2`、SCHEMA_INVALID 对应 `P0-3`），无明确规则 ID 的场景留空不强行编造。
- **扩展 `__tests__/cli-error.test.ts`**（文件已存在，勿新建）：补充 rule / field 字段的用例，覆盖「有 rule/field 时 ERROR_JSON 包含」「缺失时省略」「formatCliError 附加 [rule=...] 段」三场景。

> violations 结构化（A2b）见 Batch P1。

### A3  重构 README.md

- **新增 Mermaid 架构图**（仓库首处 mermaid，GitHub 可渲染）：技能包结构、编排者-子代理六角色、校验脚本与 W 模型 8 阶段的对应关系。
- **W 模型 8 阶段 × 门禁对应表**：每阶段的产出、check 脚本、退出码语义。
- **快速入门完整教程**：从克隆 → `npm install` → `npm run setup:hooks` → 跑通一个阶段门禁的逐步示例（含输入工件格式、命令行、输出解读）。
- **典型场景示例**：阶段 4 门禁校验完整演示。
- 保留健康指标表、CI 策略声明、相关文档导航。

### A4  文档单事实源治理

- 梳理 SKILL.md / toolbox.md / dispatch-matrix.md 交叉冗余：SKILL.md 保留核心编排逻辑 + 命令接口 + 角色分工，细则性内容迁移至 references/ 对应文档并交叉引用。
- **废弃文档标记（前置引用核查，避免误删被引用文档）**：
  1. 对每个待废弃文档（`docs/skill-design-document.md`、`docs/llm-verifier-integration-design.md` 等）执行全仓 grep 引用扫描（搜索文件名 + 相对路径片段）。
  2. 若存在活跃引用（如 `cli-error.ts:8` 注释引用 `docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md` 作为设计依据），**不得加废弃标记**，改为在文档头部标注「活跃-设计依据」并保留。
  3. 仅对无活跃引用的文档加废弃声明（废弃时间 2026-08-11 + 最新文档路径）。
  4. `docs/superpowers/specs/` 下的设计文档默认为活跃归档，不纳入废弃范围。
  5. **docs-consistency 强依赖约束（阻断）**：[check-docs-consistency.ts:36-44](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/check-docs-consistency.ts#L36-L44) 的 REQUIRED_PATHS 强制要求 6 份 docs/ 设计文档存在（skill-design-document.md / llm-verifier-integration-design.md / loop-engineering-adoption-design.md / information-flow-validation-design.md / ingestion-graph-convergence-design.md / tla-plus-modeling-design.md），且 DESIGN_DOC_NAMES 检查其内容（[checkDesignDocs](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/docs-consistency-logic.ts#L270-L294)：不得含废弃 targetKind 标记、过时 DoD 维度、过时反模式区间）。**这 6 份文档是活体，不得删除/重命名/迁移**；A4 仅可加头部「废弃声明」（若适用），且声明内容不得引入 FORBIDDEN_TARGETKIND 等被检查的词。
- 新增/更新的文档交叉引用一律用相对链接。

### A5  根目录与 docs 规整

- `eval/` 边界：README.md + AGENTS.md 显式标注「评估产物，不属技能包，不参与 /wm 编排」，保持目录位置（不迁移，避免破坏引用）。
- 检查 CHANGELOG.md / CONTRIBUTING.md / LICENSE：保留根目录（社区约定），不在本次迁移。
- 检查 docs/ 下无归属文件：确保全部 .md 可导航（README「相关文档」全覆盖）。

## 3. Batch P1（重要，11 项：A2b/B1/B2/B3/B4/B5/B6/B7/B8/B9/B10）

### A2b  violations 结构化过渡（从 P0 降级）

校验失败的 `violations: string[]` 结构化需谨慎评估影响面（涉及所有 `*-logic.ts` 返回类型 + self-test 期望模式匹配 + check-*.ts 输出格式），属破坏性变更。采用**双轨过渡**方案：

- 各 `*-logic.ts` 返回类型保留 `violations: string[]`（兼容现有 self-test 的 `expectedReasonPatterns: RegExp[]` 匹配）
- **新增可选字段** `structuredViolations?: Array<{rule: string; field?: string; message: string}>`
- check-*.ts 在输出人类可读消息时优先读 `structuredViolations`（含 rule/field），降级读 `violations`
- `--json` 输出（见 B4）优先输出 `structuredViolations`
- 各 logic 层在新增违规时按双轨写：`violations.push(msg)` + `structuredViolations.push({rule, field, message: msg})`

**A2b 范围**：仅对本次新增/修改的违规点采用双轨；历史违规点维持 `violations: string[]` 不动，避免回归风险。完整迁移留待后续轮次。

### B1  复杂逻辑注释

- `logic/code-tla-logic.ts`：SD→codeModule 映射一致性四维度判定规则补块注释（设计依据、参考规则、边界处理）。
- `logic/tla-bdd-sync-logic.ts`：TLA+ 与 BDD 状态机同步逻辑补块注释。
- 校验规则常量加注释标明反模式编号 / 阶段约束。

### B2  全局常量与复用类型

- 新增 `w-model-dev/scripts/lib/constants.ts`：RTM 追溯字段、phase 阶段枚举、门禁退出码、工件相对路径，消除多文件重复定义。
- 新增 `w-model-dev/scripts/lib/types.ts`：校验输入输出类型定义全仓复用。
- **落地位置**：`scripts/lib/` 下（保持技能包自包含分发，不新增仓库外 `src/` 目录）。

### B3  安全 baseline 维持

- `.eslintsecurity-baseline.json` 已存在。新增回归检查：`docs-consistency-logic.ts` 增加「scripts/** 变更时 baseline 必须同步」的检查项（或 security-scan 输出比对纳入 pre-push）。
- 新增安全风险检测规则接入 security-scan。

### B4  可观测性 --json

- 各 check-*.ts 增加 `--json` 选项：输出机器可读结构化报告（类型、passed、reasons、违规类型分布、耗时 ms）。
- 复用 `lib/gate-report.ts` 扩展 JSON 字段；不改变默认人类可读输出。

### B5  npm audit 阻断升级

- `.githooks/pre-push` 第 13 项：`npm audit --audit-level=high` 由 warn-only 升级为阻断（exit 1），网络不可达时保留跳过（文档注明）。

### B6  API 文档

- 配置 TypeDoc：`docs/api/` 输出；`npm run docs:build`。
- 各 check-*.ts 头注释补全输入参数 / 输出结构 / 退出码 / 错误字段说明（JSDoc）。
- 退出码与 ERROR_JSON 字段含义在文档中显式列出（A2 扩展字段同步）。

### B7  归档 INDEX.md

- `docs/changes/archive/INDEX.md`：实际 **5 个归档目录**（round15 / round19 / round20-phase1-4dim / round20-w8 / round23，注意 round20 有两个独立目录）。
- **各轮目录已有自己的 README.md** 记录验证点与快照（checkpoint-summary / verifier-summary / tla-summary / bdd-summary / rtm-snapshot / test-report-snapshot），INDEX.md 提供**顶层导航 + 每轮一行摘要**（时间、验证点、修复问题、样本基线），并链接各轮 README.md，**不重复搬运内容**。

### B8  配置集中 config/

- ESLint / TSConfig / Prettier 配置文件迁入 `config/`；package.json 引用更新（eslint --config、tsc -p、prettier config）。
- **security-scan 联动（阻断）**：`.eslintrc.cjs` 迁入 `config/` 后，[security-scan.ts:152](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/security-scan.ts#L152) 的 `npx eslint w-model-dev/scripts/` 依赖 cwd 向上自动发现根 `.eslintrc.cjs` 的机制**失效**，必须改为 `npx eslint --config config/.eslintrc.cjs w-model-dev/scripts/`；`BASELINE_PATH = path.resolve(cwd, '.eslintsecurity-baseline.json')`（[security-scan.ts:50](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/security-scan.ts#L50)）**相对 cwd**，故 `.eslintsecurity-baseline.json` **保持根目录不迁移**，BASELINE_PATH 不动。
- `package.json` scripts 按「校验类 / 测试类 / 工具类」分组 + 注释。
- **vitest.config.ts 与 .eslintignore 处理**：默认迁入 `config/`；若迁移后 vitest 测试因路径解析失败无法运行，则回退至根目录并在 B8 记录回退原因。

### B9  Git 钩子体验（不引入 Husky，优化现有方案）

**技术决策**：Husky v9 默认使用 `.husky/` 目录并通过 `git config core.hooksPath .husky`（在 `husky install` 时设置），与现有 `git config core.hooksPath .githooks` **直接冲突**，二者只能选一。现有 [pre-push:36-62](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.githooks/pre-push) 已实现纯 Windows shell 检测（MSYSTEM/OSTYPE/uname 兜底三层判定）+ Git Bash/MSYS/MINGW/CYGWIN 自动放行，Husky 无增量价值。**选 B：不引入 Husky**。

优化方向：

- 保留 `.githooks/pre-push` + `ensure-platform-deps.sh` 不动。
- `npm run setup:hooks`（`git config core.hooksPath .githooks`）改为在 `package.json` 的 `scripts` 中增加 `postinstall` 钩子：开发者执行 `npm install` 后自动配置 `core.hooksPath`（仅当 `.githooks/` 存在时），免去手动 `npm run setup:hooks`。
- `postinstall` 脚本需跨平台（Node.js 实现，检测 `.githooks/` 存在性 + 执行 `git config core.hooksPath .githooks`，失败时仅 warn 不阻断 install）。
- 在 README/CONTRIBUTING 中文档化「克隆后首次 `npm install` 自动启用钩子；如需手动重置执行 `npm run setup:hooks`」。
- 不引入新依赖（husky），保持技能包分发体积最小。

### B10  协作模板

- `.github/ISSUE_TEMPLATE/bug-report.md` + `feature-request.md`：环境信息、复现步骤、预期/实际结果。
- `.github/PULL_REQUEST_TEMPLATE.md`：关联 Issue、变更类型、校验要点、覆盖规则。
- `CONTRIBUTING.md` 增补 Conventional Commits 规范节（type/scope 列表 + PR 标题格式 + 提交流程）。

## 4. Batch P2（优化，9 项）

### C1  运行时校验统一封装（沿用 AJV，不新增 zod）

- 在 `lib/read-json-or-exit.ts` / `schema-loader.ts` 之上封装统一「读取 → JSON 解析 → schema 校验」复用方法。
- **决策**：沿用 AJV（已用于 20 份 JSON Schema 校验），不新增 zod 依赖（最小改动原则，避免依赖膨胀）。
- 封装方法签名：`loadAndValidate<T>(filePath: string, schemaKey: string): T`，统一错误信息格式（含文件路径 + 字段位置 + 规则 ID）。

### C2  格式统一

- ESLint `import/order` 规则；Prettier 统一格式；新增 `.editorconfig`（缩进/换行/字符集）。
- 一次性全仓格式化后全量回归。

### C3  覆盖率入 pre-push

- vitest coverage 阈值（statements/branches/functions）配置；pre-push 第 12 项升级为 `vitest run --coverage` 并检查阈值。

### C4  用户文档

- `docs/user-guide.md`：常见校验失败排查思路、规则依据、修复建议。
- `docs/troubleshooting.md`：FAQ + 环境问题（Windows/bash/依赖）。

### C5  文档站点

- Docsify：`docs/` + `w-model-dev/references/` 渲染为 HTML 站点；侧边栏按 W 模型阶段 / 角色 / 门禁类型分类。
- **纳入 package.json scripts**：新增 `docs:site: "docsify serve docs"` 命令，本地预览。

### C6  templates 扩充

现状：已存在 **37 份模板**（12 顶层 + 25 子目录），缺口分析：

- **JSON 工件模板缺口**：budget / run-log / maturity / checkpoint / rootcause-report / signature-chain / event-ingress 等（现有仅 bdd-manifest.template.json 一份 JSON 模板）。
- **Markdown 模板缺口（阶段 5-8）**：仅缺 **coding / integration-test / acceptance-test** 3 份（system-test.md、test-case.md、test-report.md、review-report.md 均已存在，勿重复创建）。

### C7  npm Workspace

- 仓库根 + `w-model-dev/` 双 workspace；分离开发依赖与技能包运行时依赖。
- **`w-model-dev/package.json` 不存在，需新建**。**版本机制冲突（阻断）**：skill-metadata.test.ts 的三地方程式 = **仓库根** package.json + `w-model-dev/SKILL.md` frontmatter + `w-model-dev/skill-metadata.json`（[skill-metadata.test.ts:36-42](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/__tests__/skill-metadata.test.ts#L36-L42) 用 `join(ROOT, '..', 'package.json')` 定位根包）。新建的 `w-model-dev/package.json` **不得声明 version 字段**（npm workspace 允许省略 version），避免引入第四处 version 破坏三地方程式；若 npm 强制要求 version，则须扩展 skill-metadata.test.ts 为四地校验（联动 EXPECTED 与 docs-consistency 计数）。
- 验证 `npm install`、`npm run self-test` 在 workspace 模式下全通。
- **额外验证点**：self-test.ts 的 `createRequire(import.meta.url)('typescript')` 依赖 node_modules 解析 typescript；workspace 化后 node_modules 结构可能变化（提升至根或保留子目录），需确认 `createRequire` 仍能解析到 typescript。若解析失败，改为显式 require 路径或在 w-model-dev/ 子包 devDependencies 中声明 typescript。

### C8  examples 扩充

- `w-model-dev/examples/` 增加覆盖 8 阶段完整编排流程的示例（需求分析 → 验收测试），含可复用命令行脚本。

### C9  版本机制维持

- 现有人工三地方程式（package.json + SKILL.md frontmatter + skill-metadata.json）已有 `skill-metadata.test.ts` 单测覆盖，本次**不改造**，标记为「维持」。

## 5. 验证与回归策略

| 门禁 | 命令 | 期望 |
|---|---|---|
| 样本回归 | `npm run self-test` | exit 0，样本数以执行时实际输出为准（spec 撰写时约 250，含 VERIFIER 19 + GATE 19 + GRAPH 16 + TLA 14 + BUDGET 5 + RUN_LOG 12 + MATURITY 3 + CHECKPOINT 2 + CODE_TLA 4 + ROOTCAUSE 12 + PREVENTIVE_REVIEW 2 + ICEBERG 4 + TLA_BDD_SYNC 2 + ROLE_DISPATCH 3 + STATE_MACHINE 3 + CODEGRAPH 4 + OPSX 3 + OPENSPEC 3 + UAT_PATH_MAPPING 5 + BDD 10 + COVERAGE 10 + EXEMPTION 7 + DESIGN_CONTRACT 5 + SIGNATURE_CHAIN 15 + ARCHIVE_INTEGRITY 4 + SCHEMA 17 + SPEC_ENHANCE 4 + SPEC_STRUCTURE 4 + DESIGN_ENHANCE 4 + PHASE2_STRUCTURE 4 + OUTLINE_ENHANCE 4 + PHASE3_STRUCTURE 3 + DETAILED_ENHANCE 4 + PHASE4_STRUCTURE 3 + METADATA 1） |
| 单元测试 | `npx vitest run` | exit 0，test files / tests 数以执行时实际输出为准（pre-push 注释自述 35 files / 530 tests） |
| 类型检查 | `npx tsc --noEmit` | 0 错误 |
| 文档一致性 | `npm run check:docs-consistency` | exit 0 |
| 安全扫描 | `npm run lint:security` | baseline 一致 |
| 推送门禁 | `npm run prepush` | 14 项全通过 |

**执行前基线核实**：每批开始前先跑一次 `npm run self-test` + `npx vitest run` 取实际样本数 / 用例数填入本表，作为本批回归对照基线。

每批完成后执行上述全量回归；任一失败即回到当批起点修正。

## 6. 已剔除 / 暂缓项（决策记录）

| 项 | 决策 | 依据 |
|---|---|---|
| GitHub Actions CI / GitLab CI | 剔除 | 用户硬约束「CI/CD 不集成」 |
| Dependabot | 剔除 | 无 CI 时价值有限；改人工 npm audit + outdated 巡检（C4 用户文档中固化流程） |
| semantic-release | 剔除 | 强依赖 CI 触发 |
| Husky | 剔除 | 与现有 `.githooks/` + `core.hooksPath .githooks` 冲突；现有 Windows 适配已完善，无增量价值（见 B9） |
| zod | 不引入 | 沿用 AJV 已满足 20 份 Schema 校验需求，避免依赖膨胀（见 C1） |
| hook 绕过缓解（--no-verify） | 暂缓 | 用户决策「暂不处理」，README/CONTRIBUTING 声明契约 |
| ISSUE/PR 模板 | 新增（B10） | 用户决策「新增并固化到 CONTRIBUTING」 |

## 7. 交付物清单

- 设计文档：本文件
- 实施计划：`docs/superpowers/plans/2026-08-11-p0-p2-fixes-batch-p0.md` / `-batch-p1.md` / `-batch-p2.md`
- 变更记录：CHANGELOG.md 每批追加
- 最终回归：三批全部完成后跑全量门禁并记录结果

## 8. 审查修正记录（2026-08-11）

### 首轮审查（10 项）

| # | 严重度 | 项 | 修正内容 |
|---|---|---|---|
| R1 | P0 | A6 遗漏 `__tests__/` 29 处 import | A6 必改引用点新增第 8 项，列出 23 个测试文件的 import 修改 |
| R2 | P0 | A6 遗漏 self-test skillRoot 修正 | A6 第 4 点 ② 补充 `path.join(here, '..', '..')` 修正 |
| R3 | P0 | A6 遗漏 self-test 内部 30 个 import | A6 第 4 点 ③ 重写为 4 个子项（样本路径/skillRoot/import/spawn） |
| R4 | P0 | A1 兼容性描述错误 | A1 兼容性段落重写，区分 `checkUatPathMappingBackfill`（gate-logic）与 `checkUatPathMappingContent`（check-artifact-gate），明确 re-export 策略 |
| R5 | P0 | A2 混淆 CliError 与 violations 两通道 | A2 拆为 A2a（P0，CliError 新增 rule/field）+ A2b（降级 P1，violations 双轨过渡） |
| R6 | P1 | B9 Husky 与 .githooks 冲突 | B9 选 B（不引入 Husky），改为 postinstall 自动配置 core.hooksPath |
| R7 | P1 | B2 位置矛盾 | B2 第 1 句直接写明 `scripts/lib/constants.ts` 与 `types.ts` |
| R8 | P1 | A4 废弃文档未核查引用 | A4 增加前置引用核查步骤（4 子项） |
| R9 | P2 | 回归用例数未核实 | 第 5 节表格改为「以执行时实际输出为准」+ 增加执行前基线核实步骤 |
| R10 | P2 | C7 workspace 对 self-test 影响 | C7 增加 `createRequire('typescript')` 解析验证点 |

### 二次自审（4 项）

| # | 严重度 | 项 | 修正内容 |
|---|---|---|---|
| S1 | P0 | 1.2 节执行策略仍写 249/530 | 同步改为「以执行时实际输出为准」+ 标注 spec 撰写时基线 |
| S2 | P0 | A2 拆分后 P0/P1 项数与章节标题不一致 | 第 2 节标题改为「6 项：A1/A2a/A3/A4/A5/A6」；第 3 节标题改为「11 项：A2b/B1-B10」；A2b 段落从 P0 章节迁至 P1 章节首 |
| S3 | P1 | 已剔除表缺 Husky/zod；C1 标题误导 | 已剔除表补 Husky + zod 记录；C1 标题改为「运行时校验统一封装（沿用 AJV，不新增 zod）」 |
| S4 | P1 | A6 第 7 点 / B8 / C5 / A2a 模糊表述 | A6 第 7 点明确「grep 扫描，无则跳过」；B8 明确「默认迁移，失败回退」；C5 明确「纳入 package.json scripts」；A2a 明确「仅在已知规则 ID 场景补齐」 |

### 三轮审查（9 项，代码事实核验）

| # | 严重度 | 项 | 修正内容 |
|---|---|---|---|
| T1 | P0 | 1.1 事实修正表「templates/ 已存在 11 份」错误 | 实测 37 份（12 顶层 + 25 子目录）；C6 缺口分析改为「仅缺 coding/integration-test/acceptance-test 3 份 Markdown + budget/run-log 等 JSON 模板」 |
| T2 | P0 | A2a「新增 cli-error.test.ts 用例」措辞错误 | 文件已存在，改为「扩展 cli-error.test.ts（勿新建）」，明确三场景用例 |
| T3 | P0 | vitestFileCount 联动遗漏 | 1.2 执行策略新增联动规则：新增 .test.ts 必须同步 EXPECTED.vitestFileCount=35 + README「35 files」+ AGENTS「35 个 .test.ts」+ __tests__/README.md；各批次默认只扩展不新增 |
| T4 | P1 | security-scan 与 B8 联动遗漏 | B8 新增阻断说明：.eslintrc.cjs 迁 config/ 后 security-scan 须改 `--config config/.eslintrc.cjs`；baseline 文件保持根目录不迁移（BASELINE_PATH 相对 cwd） |
| T5 | P1 | C7 workspace 与 C9 版本机制冲突 | C7 新增：w-model-dev/package.json 不存在需新建，且不得声明 version（防第四处 version 破坏三地方程式）；若 npm 强制则扩展四地校验 |
| T6 | P1 | A4 与 docs-consistency 强依赖未明确 | A4 新增第 5 点：6 份 docs/ 设计文档为活体（REQUIRED_PATHS + DESIGN_DOC_NAMES 强制），不得删除/重命名/迁移，废弃声明不得含 FORBIDDEN_TARGETKIND 词 |
| T7 | P1 | B7 归档目录数错误 | 实际 5 个归档目录（round20 有两个）；各轮已有 README.md，INDEX.md 只做顶层导航 + 链接，不重复搬运 |
| T8 | P2 | A6 第 4 点④ spawn 归属错误 | spawn 实际发生在 check-artifact-gate.ts（`path.resolve(__dirname, ...)`），self-test 全部直接 import；④ 改为「self-test 无 spawn」，spawn 说明移至 A6 第 2 点 |
| T9 | P2 | exit2ScriptCount 口径需精确化 | A6 第 3 点明确：数量不变（30），EXPECTED/AGENTS 文本不动，仅改 readdir 路径 + 更新注释；plan-chunks 虽迁 logic/ 仍计入 5 工具 |
