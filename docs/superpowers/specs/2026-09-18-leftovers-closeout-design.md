# 全部遗留事项收口设计（B / J1 / N / O + 推送）

> 日期：2026-09-18 · 状态：待用户审查
> 权威遗留来源：`docs/superpowers/plans/2026-09-17-skill-audit-remediation.md` §5「未修（如实记录）」与 §8 表格 B/N/O 行；J1 出处为 `w-model-dev/references/hard-constraints.md` #11 的「执行核验边界（2026-09-17 审查如实标注）」注。
> 已排除的伪遗留：`docs/superpowers/plans/2026-09-16-review-remediation.md`（8 任务）经核实已由先前会话全部实现（`safe-project-path.ts` 等产物在库、M07/R10 时间戳豁免分支已删除、1cc79f3e 收编计划文档），其复选框未回填属记录卫生问题，不在本轮范围。

## 1. 范围（用户已确认）

四个工作流 + 一个收尾动作：

| # | 工作流 | 一句话目标 |
|---|---|---|
| B | coverage 分母 | 「logic+lib 规则层」获得独立、可见、确定性的覆盖门；不再依赖 vitest `exclude`（其全量失效机制未查明，本轮绕开而非攻克） |
| J1 | 约束 #11 机器核验 | 「闭环 5 脚本每阶段门 exitCode=0」从文档承诺升级为 `check-run-log.ts` R11 阻断规则 |
| N | code-health 端到端 | 7 个 code-health CLI 在真实 git 工作区的全链路测试 + 逐 CLI 语义审计（对照 code-health-governance.md），偏差当场修 |
| O | logic 规则负载性 | 覆盖率最低的 5 个 logic 文件按仓内 GREEN/RED/STRIPPED 三态模式补变异级测试，发现死规则即修 |
| 收尾 | 全量门禁 + 推送 | `npm run prepush`（届时 19 项）全绿后，连同现存 4 个未推送提交一并推送 origin/main |

贯穿约束（用户既定要求）：**全部任务完成的最终审查必须跑全量**，快速车道（`test:affected`）只用于开发中迭代，不得作为验收依据。

## 2. 工作流 B：规则层独立覆盖门

**现状与根因（已实测，见 2026-09-17 整改记录 B 行）**：`config/vitest.config.ts` 的 `coverage.include` 已是 `logic/** + lib/**`，阈值基线（2026-08-12）也按该口径测得；但 v8 provider 对**被测试 import 的文件总是出报告**，实际分母 83 文件（含 cli 10 / infrastructure 3 / application 2 / __tests__ 1），statements 距 75 阈值仅 +1.83pp。两种 `exclude` 写法聚焦运行生效、全量运行均不生效，机制未查明。

**设计**：绕开 vitest 报告器行为，加一道自管确定性门：

1. `config/vitest.config.ts` 的 `coverage` 块增加 `reporter: ['text', 'json']`（保留人读输出；`coverage/` 已 gitignored）。`thresholds` 维持 75/65/85/75 作**全分母地板**，注释如实改写为「双口径」说明并指向新门。
2. 新 logic + CLI 对（遵循仓内 cli/logic 分层，logic 层供 O 复用）：
   - `w-model-dev/scripts/logic/coverage-scope-logic.ts`：输入 istanbul-lib-coverage 格式对象（v8 provider 的 `coverage-final.json`，键为绝对路径，值为 `s`/`b`/`f`/`statementMap`/`branchMap`/`fnMap`），仅对路径命中 `w-model-dev/scripts/logic/**` 与 `w-model-dev/scripts/lib/**` 的文件重算四指标（statements/branches/functions/lines，保留两位小数）并返回逐文件与合并值；
   - `w-model-dev/scripts/cli/check-coverage-scope.ts`：读 `coverage/coverage-final.json`，调 logic 层，输出单行 `COVERAGE_SCOPE_JSON`（含 fileCount 与四指标）；阈值经四个显式值 flag `--min-statements` / `--min-branches` / `--min-functions` / `--min-lines` 传入（pre-push 显式传值；未知/重复/非有限数值 flag 按 `ARG_INVALID` exit 2）；**阈值不达 → exit 1；JSON 文件缺失、格式不符、白名单零命中 → exit 2（输入错误，fail-closed）**，错误结构走 `lib/cli-error.ts`；
   - 阈值取值：实现第一步先实测窄口径四指标，按仓内惯例**向下取整到 5 的倍数**定阈值（预期高于全分母值），实测数与取整出处写入 config 注释与计划文档，禁止拍脑袋设目标值。
3. `.githooks/pre-push` 在第 12 项（vitest）之后新增第 13 项 `run_expect "规则层覆盖口径 (logic+lib) 达阈值" 0 npx tsx .../check-coverage-scope.ts ...`，后续项顺延，**项数 18→19**。

**登记面（机械同步清单，docs-consistency 会兜底）**：AGENTS §1「18 项」文案与 §8 表格新增行、SKILL.md 资源清单与 AGENTS §8 的脚本计数按实际新增同步（新增 1 logic + 1 CLI；exit-2 清单 +1）、`subagent-delegation.md` dispatch-matrix 登记、`NEGATIVE-COVERAGE.md` 新增该门的 exit-2 负向登记行（探针机制真实串行执行，须给 fixture 或 invocation 证据）、`check-docs-consistency` 中 pre-push 项数断言 18→19、`__tests__/README.md` 与 self-test 补该 CLI 三态用例。

## 2A. 负向登记证据寻址结构化（2026-09-18 追加，用户裁定）

**背景**：`NEGATIVE-COVERAGE.md` 的证据语法为 `文件:行号`。行号是位置耦合——上方任意加行使全部登记集体漂移（本会话实测两次 +1/+2 回填、46 锚迁移一次）。虽然校验器已断言被引行的内容（内容锚），假证据从未穿透过，但「文件中存在唯一特征内容」与「第 N 行含 X」防伪力等价而前者更强（现实现不要求内容唯一），后者却引入纯维护税。

**设计**：证据语法改为 `文件#锚`，锚 = 该文件内**恰好出现一次**的唯一子串（测试文件取 `it(...)` 标题片段或断言字面量，fixture 行取文件基名+关键参数）。校验 = 登记文件存在（仓内相对路径）+ 锚唯一命中（0 次或多次命中均 exit 1，各自具名违规消息；沿用 `negative-coverage-evidence-anchor` 违规码族）。**`:行号` 语法从登记册移除**：校验器遇旧形态行 → 具名违规要求迁移，不留双语法。四列严格语法、门禁/机制白名单、每门禁恰一行、真实串行 exit-2 探针执行全部不变。迁移面：46 条登记行 + `check-samples-coverage.ts` 校验函数与其测试 + AGENTS §8 该行描述 + 相关文档语法描述。验收：check-samples-coverage 全绿；假锚（0 命中/多命中/旧行号形态）负向测试齐备；探针机制照常。



## 3. 工作流 J1：run-log R11 闭环五脚本机器核验

**现状**：`hard-constraints.md` #11 明文：「门禁侧不校验这 5 个脚本是否真的跑过……若要机器核验需新增 run-log 规则（未实现）」。五脚本权威清单：`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` / `check-preventive-review.ts`。

**设计**：`run-log-logic.ts` 新增 **R11（阻断级）**，沿用既有匹配习惯（同文件已有 `entry.action === 'gate' && entry.script === 'check-rootcause-report.ts'` 先例）：

- **触发域**：对 run-log 中每个出现 `action=checkpoint && outcome=success` 的阶段 P（有放行即有阶段门，无放行不苛求——fix/emergency 变体 run 无 checkpoint 自然不触发）；
- **要求**：阶段 P 内存在 5 条 `action=gate && role=G && outcome=success && gateExitCode=0 && script ∈ 五脚本` 记录，且各自时间戳**不晚于**该次 checkpoint 记录（闭环在放行前完成）；任一缺失或晚于放行 → blocking，违规消息列出缺失脚本名；
- **不搞 legacy 吸收**（沿用 R10 删除时间戳豁免的先例）：既有 fixture/self-test 用例缺 5 条目的，逐用例**真实迁移**（补齐带 `script` 字段的 gate 记录），不设豁免开关、不按日期放行；
- `check-run-log.ts` 摘要行输出 R11 计数；与 R6（gate-logs 交叉校验）、R7（时序）不重复计数、不互相替代。

**文档与资产同步**：`hard-constraints.md` #11 删「未实现」注改为「由 check-run-log R11 强制（触发域=有 checkpoint 放行的阶段）」、SKILL.md 约束 #11 行加「R11 校验」、AGENTS §8 `check-run-log.ts` 行补 R11、`command-reference.md` 与 `data-models.md` 的 run-log 节、SSoT §10C/§10D、self-test 增 R11 正反向用例（正：五齐 + 放行；反：缺一 / 晚于放行 / 非 G 角色记录冒充）。

## 4. 工作流 N：code-health 真实 git 端到端 + 语义审计

**现状**：规则层由 self-test 43 条 `CODE_HEALTH_*_CASES` 覆盖，各 CLI 另有单测（phase1/gap/tests/duplicates/ledger/evidence/boundary/contract/task1-integration）；缺的是**真实 git/工作区链路**与**跨 CLI 消费契约**的验证——尤其 `code-health-apply.ts`（dry-run/patch/commit 三模式、`git apply -R` 回滚、scope 外拒改）与 `code-health-archive.ts`（produce/verify、`--verify` 无 `--source-project` 仅 package-only 的边界）。

**设计**两部分：

1. **语义审计**（先做，产出驱动测试重点）：7 个 CLI（phase1/gap/tests/duplicates/ledger/apply/archive）逐个对照 `references/code-health-governance.md` 的命令语义、角色权限、证据边界、CHECKPOINT 与失败链描述；发现的「文档说、脚本不做」或「脚本做、文档没说」偏差按严重度修复（代码错修代码、文档错修文档），逐条记录。
2. **端到端测试**：新文件 `__tests__/code-health-e2e.test.ts`，在临时 git 仓（参照 `pre-commit-hook.test.ts` 的隔离建仓模式）中按治理参考的链路走全流程断言退出码与产物状态：
   - happy 链：phase1（候选 `discovered`）→ gap → tests inventory → duplicates → ledger append（模拟人类 ApprovalDecision）→ apply dry-run → patch → commit（真实 git commit，验证 HEAD 绑定与 rollback 可执行：`git apply -R` 后 `git diff --exit-code` 为 0）→ archive produce → archive verify；
   - 边界链：archive `--verify` 不带 `--source-project` 对 source-bound 包必须拒绝（package-only 语义）；apply 对 scope 外文件变更必须 fail-closed；
   - 失败链：候选 `blocked` 后按 `gate-failure → blocked → R → V → G → S(rework) → evidenced` 的 CLI 层可见状态推进（治理参考声明为 CLI 状态机语义的部分）。
   - 该测试 spawn 子进程 → 必须登记 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES`（进 cli-serial 串行项目）+ `__tests__/README.md` 测试矩阵。

## 5. 工作流 O：覆盖率最低 5 个 logic 文件的三态负载性测试

**仓内先例**：`__tests__/l0-rule-loadbearing.test.ts`（S25）对 `l0-link-audit-logic.ts` 三条规则建 GREEN（合规零违规）/ RED（违规必报）/ STRIPPED（剥掉该规则块后同输入不再报 → 证明测试真实钳住该规则）三态；剥离实现为「唯一锚点定位 + 大括号配平整块删除 + 写 os.tmpdir() 副本 + 动态 import」，锚点不唯一或配平失败即抛错，绝不静默错删。

**设计**：

1. **选文件**：复用 `logic/coverage-scope-logic.ts`（工作流 B 产出）的逐文件指标，对全部 logic 文件按 statements 覆盖率升序排名，取**最低 5 个**（实测为准，禁止凭印象挑）；文件清单与覆盖率写入计划文档。
2. **通用剥离 helper**：新 `__tests__/helpers/strip-rule.ts`。与 l0 的差异：目标文件**有相对 import**（`../lib/...`），tmpdir 副本直接动态 import 会断链 → helper 把副本源码中的相对 import 说明符改写为绝对 `file://` URL（仅处理 `import ... from '../x'` 形态静态相对导入；改写后语法非法即抛错）。剥离定位/配平的 fail-loud 策略与 l0 相同。security 豁免沿用 l0 的具名先例（动态 import 指向测试自建副本）。
3. **三态测试**：每文件一个新测试文件（`<name>-rule-loadbearing.test.ts`），对该文件的关键规则建三态；**规则枚举单位 = 该模块公开 check 函数产出的可区分违规消息 / 规则编号**（实现计划第一步逐文件列规则清单，含每条的违规文案锚），用例来源直接复用该文件既有单测的输入 fixture（RED 态即单测已覆盖的违规样例）。发现 STRIPPED 态仍全绿的「死规则」→ 当场修（规则实现 bug 或补断言），逐条记录。
4. 测试文件无子进程 → 不进 SUBPROCESS 登记表；但均须登记 `__tests__/README.md` 矩阵。

## 6. 排序与依赖

**B → J1 → N → O → 收尾**。理由：

- B 第一：pre-push 项数变更（18→19）影响后续每一轮验收口径，且 O 的文件选取直接复用 B 的解析逻辑；
- J1 第二：fixture 迁移面独立于 N/O，尽早落定避免与后续改动互相踩；自测用例数变化须在同批收口；
- N 第三：语义审计可能产 CLI 修复，先于 O 完成，避免 O 的覆盖率实测被中途修复扰动排名；
- O 最后：依赖 B 的覆盖数据，且是研究性最强、可能发现意外死规则的一环；
- 收尾：全量 `npm run prepush`（19 项）≥ 一次全绿 → 提交（按工作流分 4 个 commit + CHANGELOG/计划文档收尾批注）→ 连同现存 4 个未推送提交一并 `git push`。

每个工作流内部仍按「先失败测试 → 最小实现 → 任务级定向测试」推进；工作流之间文件集基本不相交（B：config+新 CLI+钩子+登记文档；J1：run-log 逻辑+fixture+约束文档；N：code-health 测试+审计修复；O：新增测试文件+helper）。

## 7. 验收标准

1. `npm run prepush` **19/19 全绿**（含新增第 13 项规则层覆盖门），非快速车道；
2. self-test 全部样本匹配期望（含 R11 新增正反向用例与 code-health 迁移后样本）；
3. `check-coverage-scope.ts` 输出的窄口径四指标 ≥ 其阈值，且阈值溯源到实测值；
4. R11 生效证据：注入「缺一条五脚本记录」的 run-log 样本 exit 1（负向登记行可复现）；
5. `code-health-e2e.test.ts` 全绿，含 rollback 与 package-only 边界断言；
6. 5 个目标 logic 文件的 STRIPPED 用例全绿（或死规则修复后转绿），文件清单与覆盖率留档；
7. 审计发现的语义偏差逐条「修复/如实保留」双态记录，无悬空项；
8. 全部完成后 `git push` 成功，`main` 与 `origin/main` 同步；
9. 污染检查：`check-pollution` passed（coverage/.tmp、陈旧锁无残留）。

## 8. 风险与回退

| 风险 | 缓解 |
|---|---|
| coverage-final.json 格式随 vitest 版本漂移 | 新门对缺键/形态不符 fail-closed；格式断言在自测用例中固化 |
| vitest json reporter 改变现有 coverage 输出行为 | 仅新增 reporter 不改 include/thresholds；实现后先跑全量 vitest 对照 83 文件口径数值不回退 |
| R11 fixture 迁移面超预期 | 迁移以「补真实 gate 记录」为唯一合法手段；若用例数超过预算，如实缩范围并在计划文档记录，不做豁免开关 |
| N 审计发现大偏差（治理参考与实现系统性不符） | 偏差按「文档错修文档 / 实现错修实现」处置；超出本计划的记为新的挂起项，不静默吞掉 |
| O 剥离锚点随源码漂移 | fail-loud（抛错即测试失败），与 l0 同策略；helper 定位失败的消息含期望锚点 |
| prepush 运行中被杀产生孤儿 vitest 污染 coverage | 全程不中断 prepush；中断即清理 `coverage/` 后重跑（上轮教训） |

## 9. 明确不做

- 不追查 vitest `exclude` 全量失效的底层机制（B 旁路后不再 load-bearing；如未来 vitest 升级须重审）；
- 不对 5 个目标之外的其余 31 个 logic 文件做变异测试（延续挂起，证据驱动下次选址）；
- 不做 code-health Phase 5–8 迁移（另行立项，AGENTS §1 已声明未实现）；
- 不回填 2026-09-16 计划文档的复选框（历史记录卫生，另行处理）；
- 不引入新 devDep（istanbul JSON 解析手写计数，不引 `istanbul-lib-coverage`）。
