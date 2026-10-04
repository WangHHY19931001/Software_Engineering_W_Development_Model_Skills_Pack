# 测试系统工程批次 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 兑现规格——测试类型学总登记 + 模块测试显式化（集成子层）+ 冒烟准入机制（零新脚本）+ 测试设计协同绑定（复用 42.11.0 多角色机制），以 42.12.0 收口。

**架构：** 纯文档批次——零脚本/schema/eval；全部交付物为 references/细则/模板/SSoT 文本 + 登记面；机器验收 = check:docs-consistency + prepush 19 项（含 test-case.md 消费点实查前置义务）。

**技术栈：** Markdown + 既有 npm 门禁。

**规格（唯一权威）：** [docs/superpowers/specs/2026-10-04-test-systems-engineering-design.md](../specs/2026-10-04-test-systems-engineering-design.md)（abf9fd11，D1-D6 采定）。冲突以规格为准。

**分支：** `feature/test-systems-engineering` 自 main 开启（任务 0）。合并推送由用户指示。

---

## 事实核查（实施者必读）

| # | 事实 | 锚点 |
|---|---|---|
| F1 | 左右 V 对应与阶段表：SKILL.md:16 与 :129-132；硬约束 #1 测试设计前置 | SKILL.md |
| F2 | 类型学权威表 = 规格 §2（11 行三维 + 三注），逐字抄录 | 规格 §2 |
| F3 | 四级门禁零改动的实证义务：本批次 `check-artifact-gate.ts` 与 `gate-logic.ts` diff 必须为空 | git diff 核验 |
| F4 | test-case.md 消费点实查前置：`grep -rn "test-case" w-model-dev/scripts/ w-model-dev/references/ --include="*.ts" --include="*.md" \| grep -v node_modules`——预期项目侧模板零结构消费；如有消费点→最小连带+登记 | 实查指令 |
| F5 | 冒烟准入节落点：phase-6/7/8 各节首部（对应右 V 测试执行提示块之后）；三节同构 | 细则文件 |
| F6 | 协同承接句落点：四阶段细则测试设计产出节（phase-1「同步验收测试设计」等）；矩阵权威=agent-personas §3A | 细则文件 |
| F7 | verifier-spec 参考项现文：:571（§7.1）/ :615（§7.2）——扩尾不加节 | verifier-spec |
| F8 | SSoT §10Q 插入点=§10P 节末 `---` 后、`## 10.10` 前；§10A 表 §10P 行后 | SSoT |
| F9 | 版本七处现值 42.11.0 → 42.12.0（package.json / skill-metadata / SKILL frontmatter / README / INSTALL / package-lock ×2）；CHANGELOG 头部插入 | 批次先例 |
| F10 | 术语口径：约束 #4/#9 约束口径、反模式 #10 反模式口径；知情声明话术=纯文档机制形态 | hard-constraints |
| F11 | **prettier 边界**：.md 禁 `prettier --write`；.ts 改动受门禁（本批预期零 .ts） | `.githooks/*` |
| F12 | BDD 术语对齐点：`bdd.md` 头部或概述节加「行为测试=BDD features」一句；机制零改动 | bdd.md |
| F13 | SKILL.md V 对应表（:129-132）是否宜加注：实查表结构后决定「表注」或「表后引用句」，二选一报告说明 | SKILL.md |
| F14 | AGENTS §1 索引句插入点：机制索引 bullet 区（上轮 §1:16 多角色 bullet 之后） | AGENTS.md |

## 文件结构

| 文件 | 动作 | 任务 |
|---|---|---|
| `w-model-dev/references/quality-standards.md` | 修改（类型学节 + 冒烟提及） | 1 |
| `w-model-dev/templates/test-case.md` | 修改（冒烟标记列；消费点实查前置） | 1 |
| `w-model-dev/references/bdd.md` | 修改（术语对齐一句） | 1 |
| `w-model-dev/references/phase-1/2/3/4-*.md` | 修改（协同承接句 ×4 + phase-3 模块维度句） | 2 |
| `w-model-dev/references/verifier-spec.md` | 修改（两参考句扩尾） | 2 |
| `w-model-dev/references/phase-6/7/8-*.md` | 修改（冒烟准入节 ×3） | 3 |
| `w-model-dev/SKILL.md` + `AGENTS.md` | 修改（登记） | 3 |
| `docs/skill-design-document_SSoT.md` | 修改（§10Q + §10A 行） | 4 |
| `CHANGELOG.md` + 版本七处 | 修改（42.12.0） | 4 |
| 本计划 | 修改（收尾记录） | 5 |

---

### 任务 0：开启实现分支

- [ ] `git checkout -b feature/test-systems-engineering`（自 main，工作树干净，BASE 实查记录）。

### 任务 1：类型学节 + test-case 冒烟列 + BDD 对齐

**文件：** quality-standards.md、templates/test-case.md、bdd.md。

- [ ] **步骤 1：消费点实查（F4）**——grep 指令照跑，结论登记报告（预期零结构消费；有则停 downstream 最小连带并报告）。
- [ ] **步骤 2：quality-standards.md 追加节**（插在「代码健康治理质量门」节之前）——「## 测试系统工程类型学（层级 × 方法 × 策略）」：节首引言（W 模型左右 V 骨架引用 + 本节是登记不改变任何既有门禁判定）+ **规格 §2 的 11 行表逐字抄录** + 三条表注（层级/方法/策略正交；模块测试=集成子层四级门禁不变 D2；冒烟=准入策略不改四级判定 D3）+ 冒烟准入一段（三阶段准入纪律 + 知情声明：准入为文档时序机制，靠 O/测试团队遵循——派单契约同款文档机制形态）。
- [ ] **步骤 3：templates/test-case.md 用例表加「冒烟」列**（列头「冒烟」，行值 ✓/空；表头说明行补一句：冒烟列=该用例属于阶段 6/7/8 冒烟子集）。先实读模板现状照结构改。
- [ ] **步骤 4：bdd.md 术语对齐一句**（概述节）：「本指南的 BDD features 即『行为测试』（测试系统工程类型学的方法维度登记，见 [quality-standards.md](quality-standards.md)『测试系统工程类型学』节）——机制零改动。」
- [ ] **步骤 5：验证 + Commit**——`npm run check:docs-consistency` exit 0；`git diff --stat` 核对恰 3 文件；`git commit -m "feat(test-se): 测试系统工程类型学（11 行三维登记）+ test-case 冒烟标记列 + 行为测试=BDD 术语对齐"`。

### 任务 2：测试设计协同绑定 + 模块维度

**文件：** phase-1/2/3/4 细则、verifier-spec.md。

- [ ] **步骤 1：四阶段测试设计节「协同承接」句**——规格 §4 给定句逐字（插入各阶段测试设计产出节末；先 grep 定位：phase-1「同步验收测试设计」产出段 / phase-2「系统测试设计」节 / phase-3「集成测试设计」节 / phase-4「单元测试设计」节）。句中「[agent-personas.md](../w-model-dev/references/agent-personas.md)」相对路径按各细则实际层级调整（phase-* 与 agent-personas 同目录→`agent-personas.md`）。
- [ ] **步骤 2：phase-3 集成测试设计节加模块维度句**：「集成测试设计含模块维度（GJB 语境模块测试=模块级集成测试，本类型学的层级登记，见 [quality-standards.md](quality-standards.md)『测试系统工程类型学』节）——按模块划分登记模块级用例，作为阶段 6 集成执行的前置子集组织。」
- [ ] **步骤 3：verifier-spec :571/:615 两参考句扩尾**：「……核验共识纪要 N 视角关注面在产出中的承接（缺任一关注面承接 → 对应子标准降分依据；非独立门禁）」→ 追加「；测试设计产物（验收/系统/集成/单元测试设计）的角色关注面承接核验同此口径」。
- [ ] **步骤 4：验证 + Commit**——`npm run check:docs-consistency` exit 0；`git commit -m "feat(test-se): 四阶段测试设计协同承接句 + phase-3 模块维度 + verifier-spec 测试设计核验扩尾"`。

### 任务 3：冒烟准入三细则节 + SKILL/AGENTS 登记

**文件：** phase-6/7/8 细则、SKILL.md、AGENTS.md。

- [ ] **步骤 1：三细则各加「冒烟准入」节**（插在节首右 V 提示块之后；三节同构，全文骨架）：

```markdown
## 冒烟准入（测试系统工程）

- **时序**：本阶段完整测试套件开跑前，先执行冒烟子集（[test-case.md](../templates/test-case.md) 冒烟列 ✓ 的用例）；冒烟子集存在失败 → 不开跑完整套件，走普通 V/G 失败链（[hard-constraints.md](hard-constraints.md)）；冒烟全过 → 开跑完整套件。结果一律经 `/wm test result=` 真实回填。
- **知情声明**：准入为文档时序机制（零新脚本），执行纪律靠 O 与测试团队遵循——与派单契约同款文档机制形态（不冒充机器门禁）。
- **权威**：类型学登记见 [quality-standards.md](quality-standards.md)「测试系统工程类型学」节。
```
（各节自引用相对路径按文件位置调整；phase-6 冒烟子集含模块级用例的提示句加在 phase-6 版本：冒烟子集宜含模块级用例——D2 子层的前置准入形态。）

- [ ] **步骤 2：SKILL.md 登记（F13 二选一）**——实查 :129-132 表结构：宜表注则表后加一句「模块测试=集成测试的模块级子层（阶段 3 设计/阶段 6 前置执行）；冒烟=阶段 6/7/8 的执行准入策略——见 quality-standards.md『测试系统工程类型学』节」；不宜表注则放 :16 W 模型段尾。
- [ ] **步骤 3：AGENTS.md §1 索引句**（上轮多角色 bullet 之后）：「**测试系统工程类型学**：层级（单元/模块[集成子层]/集成/系统/验收）× 方法（黑盒/白盒/行为[BDD]/边界/覆盖）× 策略（冒烟/边界/覆盖）三维登记，冒烟准入=阶段 6/7/8 执行前置；见 quality-standards『测试系统工程类型学』节与 SSoT §10Q。」
- [ ] **步骤 4：验证 + Commit**——`npm run check:docs-consistency` exit 0；`git commit -m "feat(test-se): 冒烟准入三细则节（零新脚本知情声明）+ SKILL/AGENTS 类型学登记"`。

### 任务 4：SSoT §10Q + CHANGELOG 42.12.0 + 版本七处

- [ ] **步骤 1：SSoT §10Q**（F8 插入点，四件套形态）：目标段（测试系统工程类型学登记 + 冒烟准入 + 模块显式化 + 协同绑定）+ 落点表（6 行：类型学节/冒烟三细则/test-case 冒烟列/协同承接四节/verifier 扩尾/BDD 对齐——实现位置实查后写）+ 能力分工不夸大（登记不改任何既有门禁判定；冒烟准入=文档时序机制非机器门禁；模块=集成子层四级不变；协同=复用 42.11.0 零新机制）+ 判据披露（D1-D3 为推荐采定、用户可推翻）+ 节末 `---`；§10A 表 §10P 行后加 §10Q 行。
- [ ] **步骤 2：CHANGELOG 头部插入条目**（全文）：

```markdown
## [42.12.0] - 2026-10-04

### 测试系统工程批次（用户规范模型吸收；独立立项）

- **测试系统工程类型学**（quality-standards 新节）：层级（单元/模块/集成/系统/验收）× 方法（黑盒/白盒/行为[BDD]/边界/覆盖）× 策略（冒烟/边界/覆盖）三维登记，逐维度映射 W 模型左右 V 阶段与四级门禁；登记不改变任何既有门禁判定。
- **模块测试显式化**：GJB 层级以「集成的子层」落位（阶段 3 集成测试设计模块维度 → 阶段 6 前置执行），四级门禁零改动。
- **冒烟准入机制**：阶段 6/7/8 完整套件开跑前先跑冒烟子集（test-case 冒烟标记列筛出），冒烟不过不开跑；零新脚本（文档时序机制 + 知情声明）。
- **测试设计协同绑定**：四阶段测试设计产物 = 多角色讨论共识纪要的承接产物（复用 42.11.0 机制，零新角色集）；verifier-spec 测试设计核验扩尾。
- **登记面**：BDD 术语对齐（行为测试=BDD features）+ SKILL/AGENTS/SSoT §10Q。
- prepush 19 项全绿（终值由收口任务回填）。
```
- [ ] **步骤 3：版本七处 42.11.0→42.12.0**（F9；grep 逐处实查手工同步）→ `npm run check:docs-consistency` exit 0。
- [ ] **步骤 4：Commit** `git commit -m "chore(release): 42.12.0——测试系统工程收口版本同步"`。

### 任务 5：prepush 收口 + DoD + 收尾记录

- [ ] **步骤 1：全量 prepush**（后台化 + 240s 轮询，产物文件**先清理旧件再起新跑**——避免陈旧 exit 误判）。预期 19/19；失败先修再重跑（.md 禁 prettier --write）；修复触及前序交付物→BLOCKED。
- [ ] **步骤 2：DoD 六条 grep 留证**（规格 §6）：类型学节 11 行；模块维度句；冒烟三节+标记列+零新脚本（48 不变）；承接句×4+verifier 扩尾；SSoT §10Q+七处 42.12.0。
- [ ] **步骤 3：终值回填**：CHANGELOG 占位句→实测；本计划收尾记录（提交清单/prepush 终值/DoD 结果）→ 提交 `git commit -m "docs(test-se): 收口终值回填——prepush 终值 + DoD 核验"`。
- [ ] **步骤 4：汇报待合并指示。**

---

## 收尾记录（任务 5 回填）

- **提交清单（本批次 6 提交，abf9fd11 起）**：
  - `abf9fd11` docs(spec)：测试系统工程批次设计规格——D1-D6 采定
  - `424dd89d` docs(plan)：本实现计划——5 任务，F1-F14 事实核查表
  - `caabbfde` feat(test-se)：测试系统工程类型学（11 行三维登记）+ test-case 冒烟标记列 + 行为测试=BDD 术语对齐（任务 1）
  - `ff9af824` feat(test-se)：四阶段测试设计协同承接句 + phase-3 模块维度 + verifier-spec 测试设计核验扩尾（任务 2）
  - `5afe6325` feat(test-se)：冒烟准入三细则节（零新脚本知情声明）+ SKILL/AGENTS 类型学登记（任务 3）
  - `26000005` chore(release)：42.12.0——测试系统工程收口版本同步（任务 4）
  - （本收口提交：`docs(test-se): 收口终值回填——prepush 终值 + DoD 核验`，见 git log）
- **prepush 终值（钩子自报口径）**：19/19 全绿，exit 0，总耗时 **1779s**（2026-10-04 05:33:11 → 06:02:52 +0800，对 26000005 实测；wall-clock 文件差 1781s）。关键项：self-test ✓ 18s / vitest 全量+coverage ✓ 1763s / security-scan ✓ 30s / samples 覆盖矩阵 ✓ 30s / prettier ✓ 27s / tsc ✓ 22s / docs-consistency ✓ 10s / eval ✓ 4s / 覆盖口径 ✓ 1s / npm audit ✓ 2s。
- **DoD 逐条核验（规格 §6 六条）**：
  1. ✅ 类型学节在场：`quality-standards.md:253`「测试系统工程类型学（层级 × 方法 × 策略）」，11 数据行（层级 5 + 方法 3 + 策略 3）+ 三条表注（①正交 ②模块=集成子层 D2 ③冒烟不改四级判定 D3）；黑盒/白盒/行为/边界/覆盖五方法策略均有登记位。
  2. ✅ 模块测试显式化：类型学「模块测试」行（显式化 D2）+ `phase-3-outline-design.md:201` 模块维度句；本批次（5799afb7..26000005）`check-artifact-gate.ts` 与 `gate-logic.ts` diff 为空——四级门禁零改动。
  3. ✅ 冒烟准入：phase-6/7/8 三细则「## 冒烟准入（测试系统工程）」节同构（各 :6）+ `templates/test-case.md:50/:52` 冒烟列（表头说明 + 用例表「冒烟」列）；消费点实查结论=零结构消费（任务 1 报告登记）；`ls w-model-dev/scripts/cli/*.ts | wc -l` = **48 不变**（零新脚本）。
  4. ✅ 协同绑定：承接句 ×4（`phase-1-requirements.md:258` / `phase-2-system-design.md:174` / `phase-3-outline-design.md:199` / `phase-4-detailed-design.md:107`）+ verifier-spec :571/:615 扩尾「测试设计产物（验收/系统/集成/单元测试设计）的角色关注面承接核验同此口径」；本批次 `agent-personas.md` 与 `subagent-delegation.md` 零触碰（多角色机制零改动，纯引用）。
  5. ✅ SSoT：`## 10Q` 权威节（SSoT:2445，四件套）+ §10A 表 §10Q 行（SSoT:2582）；SKILL:138 表注句 / AGENTS:17 索引句 / bdd.md:6 术语对齐句登记；CHANGELOG 42.12.0 + 版本七处同步（package.json / skill-metadata / SKILL frontmatter / README / INSTALL / package-lock ×2），六镜像文件 42.11.0 残留=0。
  6. ✅ `npm run prepush` 19 项全绿收口（终值见上）。
