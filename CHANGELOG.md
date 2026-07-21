# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 吸收 addyosmani/agent-skills 设计模式（P1 + P2）

> 将 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 中的 `using-agent-skills` 元技能（6 条核心操作行为 + 10 条失败模式）、`code-review-and-quality`（五轴评审 + Severity 标签 + Structural Remedies）、`references/definition-of-done.md`（项目级 DoD）、`agents/`（Agent Personas）、`docs/adoption-guide.md`（Greenfield vs Brownfield 采用路径）等设计模式吸收到本技能包。
>
> 吸收遵循「SSoT 优先 + 不内置 LLM 调用 + CHECKPOINT 不可绕过」三项硬约束：Persona 定义为「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown，不调用任何 LLM；失败模式与 9 条流程反模式二分（反模式=流程破坏回退，失败模式=行为退化登记）。

#### 新增

- `docs/skill-design-document_SSoT.md` §4A「核心操作行为与失败模式」：6 条核心操作行为（Surface Assumptions / Manage Confusion Actively / Push Back When Warranted / 等）+ 10 条失败模式 F1~F10
- `docs/skill-design-document_SSoT.md` §6.4「Agent Personas（评审角色提示词）」：三层架构（Skill / Persona / Command）+ 4 个 W 模型适配 Persona + 与 §7.6 LLM-as-a-Verifier 的路由关系
- `docs/skill-design-document_SSoT.md` §7.6「五轴评审」：Correctness / Readability / Architecture / Security / Performance 五轴 + Severity 标签（Critical / Required / Optional / Nit / FYI）+ Structural Remedies
- `docs/skill-design-document_SSoT.md` §10.6「项目级 Definition of Done」：5 维度 DoD（功能 / 质量 / 测试 / 文档 / 部署）
- `docs/skill-design-document_SSoT.md` §11A「采用路径（Greenfield vs Brownfield）」：路径选择信号表 + Day 0 全流程 + 增量验证优先 + 收敛表
- `w-model-dev/references/agent-personas.md`：4 个评审角色提示词（code-reviewer / test-engineer / security-auditor / performance-auditor），含 JSON 输出格式、评审规则、组合节、与 addyosmani 差异表；performance-auditor 直接吸收 Metric-Honesty Rule
- `w-model-dev/references/definition-of-done.md`：项目级 DoD（5 维度），SSoT §10.6 为权威定义
- `w-model-dev/references/verifier-spec.md` §7.4A：五轴评审 + Severity 标签 + Structural Remedies（与 SSoT §7.6 双向追溯）
- `docs/adoption-guide.md`：人类可读采用指南（Greenfield Day 0 全流程 + Brownfield 增量验证优先 + 收敛表 + 与 addyosmani 差异表），SSoT §11A 为权威定义

#### 变更

- `w-model-dev/SKILL.md`：新增「核心操作行为」节（6 条）+ 「失败模式 F1~F10」节；YAML frontmatter `description` 同步
- `w-model-dev/references/anti-patterns.md`：新增「失败模式清单 F1~F10」节（10 条行为退化 + 与反模式对照表 + 标注约定 + 与 addyosmani 差异表）；目录同步更新；F# 重复命中 ≥2 次升级为 L# 教训
- `README.md`：项目结构树补 `agent-personas.md` / `definition-of-done.md` / `docs/adoption-guide.md`；`anti-patterns.md` 描述更新为「9 条流程反模式 + L1~L4 教训 + 失败模式 F1~F10」；`verifier-spec.md` 描述补「五轴评审 §7.4A」
- `AGENTS.md`：§1 仓库定位补 Agent Personas 行；§2 关键目录速查表 `w-model-dev/references/` 行补 agent-personas / definition-of-done / 失败模式 F1~F10 / command-reference / operational-recovery；§5 必读文档列表补 `docs/adoption-guide.md`

#### 与 addyosmani/agent-skills 的差异

- **不内置 LLM 调用**：addyosmani 的 Persona 可直接调用 LLM；本技能包 Persona 是「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown
- **Persona 不互相调用**：吸收 addyosmani 规则——组合由命令或用户完成；`code-reviewer` 发现安全问题时在 `reworkHints` 中以「[建议 security-auditor 深审] xxx」前缀呈现，不自动调用
- **失败模式与反模式二分**：反模式=流程破坏（命中即回退），失败模式=行为退化（命中不回退但登记）；F# 重复命中 ≥2 次升级为 L# 教训，并在 SSoT §10B.4 同步登记
- **performance-auditor 适配 W 模型后端场景**：借鉴 addyosmani `web-performance-auditor` 但扩展为前端+后端双场景；Quick 模式（无工具工件）退化为源代码结构反模式扫描；直接吸收 Metric-Honesty Rule（永不编造指标，无工具数据时标 `not measured`）
- **Persona 产出与 §7.6 Schema 对齐**：Persona 产出的 JSON 必须满足 `verifier-spec.md` §7 Schema，Severity 标签作为 `reworkHints` 字符串前缀，不新增 Schema 字段
- **采用路径适配 W 模型 8 阶段**：Greenfield 路径按 8 阶段顺序执行；Brownfield 路径分 4 Phase（上下文与只读 / 先测试后改动 / 新工作跑全流程 / 偿还债务废弃观测）

#### 验证

- `npm run self-test` → 17/17 用例通过，退出码 0（10 Verifier + 7 Gate 样本回归基线未受影响）
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/agent-personas.md` / `definition-of-done.md` / `anti-patterns.md` / `verifier-spec.md` / `docs/adoption-guide.md` 均已同步至 addyosmani/agent-skills 吸收后状态
- SSoT §6.4 ↔ `agent-personas.md` 双向链接校验通过
- SSoT §11A ↔ `docs/adoption-guide.md` 双向链接校验通过
- SSoT §4A ↔ `anti-patterns.md`「失败模式清单 F1~F10」双向链接校验通过
- SSoT §7.6 ↔ `verifier-spec.md` §7.4A 双向链接校验通过
- SSoT §10.6 ↔ `definition-of-done.md` 双向链接校验通过

### 端到端调测第二轮：从零重建 + k6 性能基线 + 文档全面同步

> 通过完全清空 [`w-model-dev-demo/`](./w-model-dev-demo) 后按 W 模型 8 阶段从零重建，
> 验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可重复执行；
> 并通过回归测试发现 3 项工程配置缺陷（JWT_SECRET 缺失 / ArticleService 类型导出 / vitest mock 类型），
> 修复后纳入 [`w-model-dev/references/anti-patterns.md`](./w-model-dev/references/anti-patterns.md)「实现层经验教训」L2~L4。

#### 新增

- `w-model-dev-demo/tests/perf/k6-load-test.js`：k6 性能基线脚本（100 VUs × 30s，P95 < 200ms，覆盖文章列表 / 详情 / 登录）
- `w-model-dev-demo/tests/perf/README.md`：k6 安装 / 运行 / 解读说明（k6 是独立二进制，不纳入 npm 自动化链路）
- `w-model-dev-demo/tests/unit/validate.test.ts`：validate 中间件单元测试 13 用例（UT-031~043），行覆盖率 0% → 100%
- `w-model-dev-demo/tests/unit/jwt.utils.test.ts`：补充 5 边界用例（UT-031B~035B），branches 覆盖率 57.14% → 100%
- `w-model-dev-demo/tests/unit/password.utils.test.ts`：补充 3 边界用例（UT-024B~026B），branches 覆盖率 60% → 100%
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L2（模块加载阶段抛错）+ L3（service 类导出方式反复）+ L4（vitest mock 与 express 类型不兼容）三条教训，与 SSoT §10B.4 双向追溯

#### 变更

- `w-model-dev-demo/` 完全清空后从零重建：4 份设计文档（1021 行）+ 工程配置 + src/ 全部源码 + 9 单元测试文件
- `w-model-dev-demo/package.json`：所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入，修复 L2 缺陷
- `w-model-dev-demo/src/services/article-service.ts`：恢复 `export class ArticleService`，与 `export const articleService` 共存，修复 L3 缺陷
- `w-model-dev-demo/tests/unit/auth-middleware.test.ts` + `tests/unit/error-handler.test.ts`：用 `ReturnType<typeof vi.fn>` / `Mock` 类型断言访问 mock.calls，修复 L4 缺陷
- `w-model-dev-demo/.w-model/rtm.json`：RTM 终检状态更新，8 行需求 × 7 字段全部非空，coverage.rtmCoverage=100 / unitTestCoverage=99
- `w-model-dev-demo/.w-model/project.json`：`status` 改为「已完成」，新增 `completedAt` 与 `acceptance` 字段（用户 `confirm` 归档）
- `w-model-dev-demo/docs/acceptance-test-report.md` §9：用户确认区填入 `confirm`（2026-07-21）
- `w-model-dev-demo/docs/system-test-report.md` §5 + §9.3：k6 脚本引用更新为 `tests/perf/k6-load-test.js`
- `w-model-dev-demo/docs/system-test-cases.md` ST-003：增加「工具」字段，注明 k6 设计原意 + vitest CI 近似验证
- `README.md`：参考实现节调测数据从 2026-07-20 baseline 更新到 2026-07-21 第二轮（65 单元 + 12 集成 + 6 系统 + 15 验收 = 98 测试，覆盖率 98.96%）；项目结构树补 `tests/perf/` 与 `.w-model/`
- `AGENTS.md` §4：参考实现调测数据同步更新；新增 4 项缺陷修正记录
- `docs/skill-design-document_SSoT.md` §1.4 + §10B 1-6 小节：全面重写，新增调测轮次 / 用户确认 / 4 项缺陷 / k6 边界声明
- `docs/INSTALL.md` §8 FAQ：调测数据同步更新，补 4 项缺陷与 L1~L4 指针

#### 端到端调测结论（2026-07-21 第二轮）

| 指标 | 目标 | 实测 | 与 baseline（2026-07-20）对比 |
|---|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 65/65 通过，98.96% lines / 93.23% branches / 100% functions | 用例数 +43，覆盖率 lines -0.04pp（仍远超阈值） |
| 集成测试 | 100% 通过 | 12/12 通过 | 用例数 +6 |
| 系统测试 | 100% 通过 | 6/6 通过 + k6 脚本就绪 | 持平 + 新增 k6 |
| 验收测试 | 100% 通过 | 15/15 通过 + 用户 `confirm` 归档 | 持平 + 归档 |
| RTM 需求覆盖率 | 100% | 4/4（100%） | 持平 |
| 工件质量门 | 退出码 0 | 通过（退出码 0） | 持平 |
| TypeScript 严格编译 | 0 错误 | 退出码 0 | 持平 |
| 性能基线 | P95 ≤ 200ms | k6 脚本就绪，vitest 近似采样 P95=3ms | 新增 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 98 用例全过（65 unit + 12 integration + 6 system + 15 acceptance）
- `w-model-dev-demo/` 内 `npm run coverage` → 总覆盖率 98.96% lines / 93.23% branches / 100% functions
- `w-model-dev-demo/` 内 `npx tsc --noEmit` → 退出码 0
- `w-model-dev-demo/` 内 `npx tsx ../w-model-dev/scripts/check-artifact-gate.ts .` → 退出码 0
- `tests/perf/k6-load-test.js` 通过 `node --check` 语法校验
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `w-model-dev/references/anti-patterns.md` 均已同步至 2026-07-21 第二轮数据
- SSoT §10B.4 与 anti-patterns.md「实现层经验教训」节 L1~L4 双向链接校验通过

### 端到端调测：交付博客系统参考实现 + 文档同步

> 通过 [`w-model-dev-demo/`](./w-model-dev-demo) 完整跑通 W 模型 8 阶段端到端调测，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用，并把调测结论与缺陷修正经验同步到全仓库文档。

#### 新增

- `w-model-dev-demo/`：博客系统后端参考实现（Express 4 + TypeScript 5 + 内存存储）
  - 8 阶段产出文档：`docs/`（需求规格 / 系统设计 / 概要设计 / 详细设计 + 四级测试用例与报告）
  - 可运行代码：`src/`（控制器 / 服务 / 存储 / 中间件，含 `utils/async-handler.ts` 缺陷修正产物）
  - 四级测试：`tests/`（unit 22 / integration 6 / system 6 / acceptance 15）
  - 独立 `package.json` / `tsconfig.json` / `vitest.config.ts`，与仓库根工具链解耦
- `AGENTS.md`：仓库根级 AI Agent 导航（与 README 互补，聚焦 Agent 行动所需最小事实集）
- `docs/skill-design-document_SSoT.md` §10B「参考实现（端到端调测验证）」：6 个子节，含项目概况 / 8 阶段产出对应 / 调测结论摘要 / 缺陷与修正 / 与 SSoT 章节映射 / 边界声明
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L1（Express 4 async handler 不自动 catch）+ 扩展规则（与 SSoT §10B.4 双向追溯）

#### 变更

- `README.md`：新增「参考实现：`w-model-dev-demo/`」节（含调测结论表 + 缺陷修正指针）；项目结构补 `w-model-dev-demo/` / `.githooks/pre-push` / `AGENTS.md`；相关文档列表补 AGENTS.md 与参考实现两项
- `docs/skill-design-document_SSoT.md` §1.4：增加参考实现指针
- `docs/INSTALL.md` §7 目录速查：补「参考实现」与「Agent 仓库导航」两行；§8 FAQ 新增「哪里可以看到 W 模型 8 阶段的完整端到端产出样本？」
- `CONTRIBUTING.md`「项目结构约定」：补 `w-model-dev-demo/` 条目与边界声明；「SSoT 原则」同步链路补 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`

#### 端到端调测结论（2026-07-20）

| 指标 | 目标 | 实测 |
|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 22/22 通过，覆盖率 98% |
| 集成测试 | 100% 通过 | 6/6 通过（含 L1 缺陷修正） |
| 系统测试 | 100% 通过 | 6/6 通过 |
| 验收测试 | 100% 通过 | 15/15 通过 |
| RTM 需求覆盖率 | 100% | 4/4 需求 100% |
| 工件质量门 | 退出码 0 | 通过 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 全部四级测试通过
- 文档一致性：`grep -rE "w-model-dev-demo"` 在 `README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `w-model-dev/references/anti-patterns.md` 均有正确指针；无断链
- SSoT §10B 与 anti-patterns.md「实现层经验教训」节双向链接校验通过

### CI 改为本地推送前门禁

> 远程 GitHub Actions runner 始终无法分配（多次运行卡在 Queued，与代码无关），
> 改为本地 git `pre-push` hook 承载门禁职责，等价覆盖原 CI 的 5 项检查。

- 删除 `.github/workflows/ci.yml`，关闭远程 CI
- 新增 `.githooks/pre-push`：在 `git push` 时自动跑 self-test + 4 项 CLI 退出码冒烟，任一不符预期即中止推送
- 仅当本次推送触及 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 时才跑门禁，纯文档改动直接放行
- `package.json` 新增 `setup:hooks`（一次性启用 hook）与 `prepush`（手动跑全部门禁）快捷脚本
- `CONTRIBUTING.md` 同步说明启用与临时跳过（`git push --no-verify`）方式

### 大规模 Review 优化（P0-P3 共 18 项）

> 基于全项目 Review 报告，按优先级 P0×3 / P1×4 / P2×6 / P3×5 修复一致性、健壮性与可维护性问题。

#### P0 关键正确性

- 修复 `verifier-spec.md` §4.1/§4.2 字母语义与 §6.1 冲突：统一为 `A=完全达成 / D=完全未达成`，公式改为 `1.00*p_A + 0.67*p_B + 0.33*p_C + 0.00*p_D`
- 修复 `verifier-logic.ts` ranking.k/rounds 整数性校验缺失：增加 `Number.isInteger()` + 数值边界（k ∈ [2,1000]、temperature ≤ 100、rounds ≥ 1）
- 修复 `gate-logic.ts` RTM JSON 结构校验缺失：缺 `executionSummary` 时不再抛 TypeError，改为返回结构化 reasons；新增 `rows` / `executionSummary.<type>` / 行对象分层校验

#### P1 一致性

- 统一覆盖率表述：85 处「覆盖率」歧义区分为「单元测试代码覆盖率 ≥ 80%」与「RTM 需求覆盖率 100%」两个独立指标（涉及 SKILL.md / SSoT / phase-5/7/8 / verifier-spec / rtm-guide / quality-standards / templates / examples / scripts）
- 统一测试用例 ID 命名规则：阶段 6/7/8 执行用例从 `TC-INT/SYS/UAT-*` 改为 `IT/ST/UAT-*` 与 RTM 短形式一致；在 `rtm-guide.md` 增加命名规则章节说明两套 ID 体系（运行时 vs 阶段产物验证）
- SSoT §6.1 核心命令表列名「返回值」→「产出」
- `verifier-logic.ts` ranking.k/temperature 增加上界校验（防滥用：MAX_RANKING_K=1000、MAX_TEMPERATURE=100）

#### P2 健壮性与可维护性

- 去重验收检查清单：`SKILL.md` 项目级清单从 12 项压缩为核心 4 项 + 指针，避免与 `phase-8-acceptance-test.md` 重复
- 处理 `.claude/skills/darwin-skill/` 评估产物：迁移至 `eval/`，`.claude/` 加入 `.gitignore`
- 增加校验脚本样本测试：新增 `w-model-dev/scripts/samples/`（verifier 7 条 + gate 4 条共 11 条端到端样本）+ `self-test.ts` 自动跑通所有样本作为回归基线
- 统一 `verifier-spec.md` §8 占位符列表
- 拆分 `phase-1-requirements.md`「可选：需求形式化」节到独立文件
- `verifier-logic.ts` `varianceThreshold` 缺失时改为判失败而非警告

#### 验证

- `npx tsx w-model-dev/scripts/self-test.ts` → 11/11 通过
- `npx tsx w-model-dev/scripts/check-verifier-output.ts <sample.json>` 通过 / 失败路径均符合预期

### 一致性补全：命令执行规则与示例覆盖

> 全面扫描后发现 SKILL.md（Agent 实际读取的入口）在若干命令执行规则上与 SSoT / README / verifier-spec.md 不一致或不完整，本次补全使 10 个 `/wm` 命令均有可执行规则，并消除文档间不一致。

#### 新增

- `w-model-dev/SKILL.md` §5「`/wm test` 结果回填机制」：明确 `result=pass|fail` 必填、真实回填约束、与工件质量门的有效性关联（之前只在 README / SSoT / 脚本注释中说明，SKILL.md 自身缺失）
- `w-model-dev/SKILL.md` §6「辅助命令执行规则」：补全 `/wm review` / `/wm status` / `/wm help` / `/wm reset` / `/wm export` / `/wm import` 六个命令的详细执行步骤与 CHECKPOINT
- `w-model-dev/SKILL.md` §4「数据与状态管理」：补充 `.w-model/` 持久化目录结构与文件用途
- `w-model-dev/examples/test-execution.md`：新增测试执行阶段示例（phase 6 集成 / phase 7 系统 + 质量门 / phase 8 验收 + 项目交付），覆盖 `result=pass|fail` 回填、根因分析、CHECKPOINT 放行全流程

#### 变更

- `w-model-dev/SKILL.md` 命令接口表：
  - `/wm test` 参数补充 `result: pass / fail（必填，真实回填）`，产出列补充「RTM 状态更新」
  - `/wm review` 的 `target` 前缀由 `REQ-/SD-/AT-/文件路径` 修正为 `REQ- / DESIGN- / UAT- / ST- / IT- / UT- / 文件路径`，与 `references/verifier-spec.md` §2 权威定义一致
  - `/wm status` 产出列补充「RTM 覆盖率」
- `w-model-dev/SKILL.md` YAML frontmatter `description`：命令列表由 6 个（analyze/design/code/test/review/status）补全为 10 个（增加 help/reset/export/import），影响 Agent 自动激活触发判断
- `docs/skill-design-document_SSoT.md` §6.1 核心命令表：
  - `/wm design` 的 `type` 由 `(架构/详细)` 修正为 `(架构/概要/详细)`，与 SKILL.md / README 一致
  - `/wm test` 的 `type` 由 `(单元/集成/系统)` 修正为 `(单元/集成/系统/验收)`，并补充 `result` 参数
  - `/wm status` 返回值补充「RTM 覆盖率」
- `docs/skill-design-document_SSoT.md` §10A 追溯表：`6 命令接口` 行的实现位置补充「指令（执行规则）§5 `/wm test` 回填机制 + §6 辅助命令执行规则」
- `docs/skill-design-document_SSoT.md` 附录 A 命令速查：补全遗漏的 3 个命令（`/wm reset` / `/wm export` / `/wm import`），并修正 `/wm design` / `/wm test` 的参数格式
- `CONTRIBUTING.md`「添加新命令」节：删除旧架构残留的 `helpHandler` 引用，改为指向 SKILL.md「指令（执行规则）§1/§2/§3/§6」与 SSoT §6.1 / §6.2 / 附录 A 的同步更新流程

#### 验证

- `grep -E "helpHandler|REQ-/SD-/AT-|设计类型\(架构/详细\)|测试类型\(单元/集成/系统\)"` 在保留文件中无残留
- `npx tsx w-model-dev/scripts/check-verifier-output.ts` 退出码 2（输入错误，符合预期，未传文件）
- `npx tsx w-model-dev/scripts/check-artifact-gate.ts` 退出码 2（输入错误，符合预期，无 .w-model/rtm.json）
- 校验脚本未受影响：`verifier-logic.ts` `SUB_CRITERIA` 与 `verifier-spec.md` §7 完全一致（20/20 子标准）；`determineQualityLevel` 与 §6.1 完全一致
- 所有内部 Markdown 链接目标文件均存在，无断链

### 架构纯化：移除全部编程式接入

> 把本仓库确定为「单纯的编排 + 校验脚本技能」，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。
> 技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> 此变更撤销了此前 [Unreleased] 阶段规划的「内置 `src/` TypeScript 引擎 + `tests/` 测试套件 + `package.json` 工具链」方向，回归纯技能包形态。

#### 删除（编程式引擎与 Node 工具链）

- `src/` 整块移除：`index.ts`、`commands/router.ts`、`state/{project-state,rtm-manager}.ts`、`types/index.ts`（`/wm` 命令路由、状态持久化、RTM 维护改由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态持久化到项目内 `.w-model/*.json`）
- `tests/` 整块移除：`command-router.test.ts`、`project-state.test.ts`、`rtm-manager.test.ts`、`verifier-logic.test.ts`
- `examples/run-wm-flow.ts` 移除（编程式示例，与新架构不符）
- Node 工程化文件移除：`package.json`、`package-lock.json`、`tsconfig.json`、`jest.config.js`、`.eslintrc.cjs`
- `docs/IMPLEMENTATION-PLAN.md` 移除（内置引擎路线图，已不适用）

#### 保留（自包含校验脚本）

- `w-model-dev/scripts/gate-logic.ts`：工件质量门纯逻辑（自包含，仅依赖本目录内文件）
- `w-model-dev/scripts/verifier-logic.ts`：Verifier 输出校验纯逻辑（自包含）
- `w-model-dev/scripts/check-artifact-gate.ts`：工件质量门 CLI（读 `.w-model/rtm.json`，退出码 0/1/2）
- `w-model-dev/scripts/check-verifier-output.ts`：Verifier 输出校验 CLI（防外部 Agent 输出漂移）
- 校验脚本运行依赖仅为 `tsx`（用户通过 `npx tsx` 或全局安装调用），无需 `npm install`

#### 变更（文档同步至纯技能架构）

- `w-model-dev/SKILL.md`：移除「实现位置 / 快速验证 / 编程式接入」尾部章节；文件清单注释中去除 `src/` 引用
- `README.md`：架构边界表「W 模型阶段编排」实现位置改为 `w-model-dev/SKILL.md` + `references/*`；快速上手改为「AI Agent 安装（零依赖）」+「运行门禁校验脚本」；移除「编程式接入」章节与 `src/` / `tests/` / `examples/run-wm-flow.ts` 结构条目
- `docs/INSTALL.md`：重写为单一安装路径（移除模式 B 程序化模式 / 模式 A+B 混合使用 / `npm install` / `createCommandContext` 示例）；新增「为什么没有 npm install / package.json」FAQ
- `docs/skill-design-document_SSoT.md`：§1.4 架构重构说明、§3.3 边界表、§6.3 时序图、§8.1 技术栈表、§10.5 / §10A 追溯表、§11 部署集成方案全面改为纯技能架构描述
- `docs/skill-design-document.md`：用途表「实现入口（TypeScript）| src/index.ts」改为「AI Agent 安装指南 | INSTALL.md」
- `docs/llm-verifier-integration-design.md`：移除「命令路由实现 | ../src/commands/router.ts」引用
- `CONTRIBUTING.md`：移除 `npm test` / `npm run lint` / `npm run typecheck` 工作流与覆盖率阈值；改为 `npx tsx` 端到端校验；新增「脚本不得 import `src/`」自包含规则
- `.gitignore`：移除 `node_modules/` / `dist/` / `build/` / `*.tsbuildinfo` / `coverage/` 等不再相关的条目

#### 验证

- `grep -rE "src/|createCommandContext|dispatch\(|程序化|编程式|模式 ?B|混合使用|npm (run|test|install)|npx (jest|tsc|eslint)"` 在保留文件中无残留编程式接入引用（仅保留明确否定句「不包含编程式接入」与历史 tombstone 说明）
- `w-model-dev/scripts/*.ts` 校验脚本自包含性确认（仅 `import ./gate-logic.js` / `./verifier-logic.js` 与 Node 标准库）

### 已撤销的方向（历史记录）

> 以下为此前 [Unreleased] 阶段规划的「内置 `src/` 引擎」方向，已被上方「架构纯化」整体撤销，所列文件均已删除，保留仅作历史记录。

- 内置 `src/core/*` LLM 评分 / 验证 / 排序 / 增强器 / 客户端 / 元技能配置
- 内置 `src/evolution/skill-optimizer.ts` SkillOpt ReflectTrainer 训练循环
- 内置 `src/eval/skill-lift.ts` ACES Skill Lift 评估
- `w-model-dev/scripts/check-skill-gate.ts` 技能验证门
- `w-model-dev/META-SKILL.md` 可演化元技能配置
- `tests/verifier-logic.test.ts` 等 11 个测试套件、163 个测试
- `examples/run-wm-flow.ts` 编程式全流程示例
- `npx tsc --noEmit` / `npx jest` / `npx eslint` / `npm run example:run` 验证链
- `docs/INSTALL.md` 模式 A / 模式 B 双路径与混合使用说明

## [0.1.0] - 2026-07-16

基于 [issue #5](https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack/issues/5)
的代码审查报告（评分 8.2/10）进行的项目扩大化优化首版。

### 新增

#### 核心引擎实现（issue Critical #1）
- 将 `llm-verifier-implementation-template.ts`（691 行模板）重构为模块化 `src/` 结构
- 实现 `LLMVerifierEngine`：基于 logits 期望值的连续评分，使用 log-softmax 保证数值稳定
- 实现 `VerificationFramework`：三维度验证（评分粒度 + 重复评估 + 标准分解）
- 实现 `PPTRanker`：O(N×k) 概率枢轴锦标赛排序算法
- 实现 `WModelVerifierEnhancer`：需求 / 设计 / 测试用例三阶段验证增强器

#### LLM Verifier 鲁棒性（issue High Priority #2）
- 新增 `fallbackStrategy` 配置：`text-parse` / `discrete` / `throw`
- 当 LLM 不支持 logits 时自动回退，解析字母（A-T）或数字并加稳定扰动
- `MockLLMClient` 支持模拟 logits / scoreLabel，便于离线测试
- `HttpLLMClient` 骨架，支持自部署推理服务（vLLM / TGI）

#### 状态持久化（issue Critical #2）
- 新增 `ProjectStateManager`：JSON 文件持久化（`.w-model/project.json`）
- 支持项目 / 需求 / 设计 / 测试用例 CRUD，自动 ID 生成
- W 模型阶段合法性校验（禁止跨阶段推进，允许回退返工）
- `exportJSON` / `importJSON` 支持项目迁移

#### RTM 自动化（issue Critical #2 + Medium #1）
- 新增 `RTMManager`：从 `ProjectStore` 自动重建需求跟踪矩阵
- 双向追溯：需求 ↔ 设计 ↔ 代码 ↔ 四级测试用例
- 覆盖率自动统计与缺失列告警
- 质量门检查：覆盖率 100% + 所有测试通过
- Markdown 导出（套用 `templates/rtm.md` 格式）
- 变更日志记录

#### /wm 命令路由（issue Critical #2）
- 新增 `commands/router.ts`：10 个命令（analyze / design / code / test / review / status / help / reset / export / import）
- 阶段校验：确保命令在合法阶段执行
- 实体登记：自动关联需求 ↔ 设计 ↔ 测试用例，保证 RTM 双向追溯
- 验证触发：analyze / design / review 时自动调用 LLM Verifier
- 质量门：验收测试阶段自动检查

#### 测试与覆盖率（issue 验收标准）
- 119 个单元测试，覆盖所有核心模块
- 全局分支覆盖率 83.58%（目标 ≥ 70%）
- 核心模块分支覆盖率 91.89%（目标 ≥ 85%）
- TypeScript 严格模式，`tsc --noEmit` 通过

#### 示例与文档
- 新增 `examples/run-wm-flow.ts`：W 模型 8 阶段全流程示例
- 新增 `README.md`：项目导航与快速上手
- 新增 `CONTRIBUTING.md`：贡献指南
- 新增 `IMPLEMENTATION-PLAN.md`：实现路线图
- 新增 `CHANGELOG.md`：本文件

### 变更

#### 文档同步（issue High Priority #1）
- `skill-design-document.md` 精简为指向 SSoT 的指针文档（570 行 → 37 行）
- 统一以 `skill-design-document_SSoT.md` 为单一事实来源

### 工程化
- 新增 `package.json`：ESM 模块，TypeScript 5.4，Jest + ts-jest
- 新增 `tsconfig.json`：ES2020 target，Bundler resolution，strict mode
- 新增 `jest.config.js`：覆盖率阈值配置（全局 70%，核心 85%）
- 新增 `.eslintrc.cjs`、`.gitignore`
