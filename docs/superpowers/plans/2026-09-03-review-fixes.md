# 129 提交审查全量修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复审查（93f6f3a→f0add11，129 提交）发现的全部 26 条问题（4 Important + 22 Minor），每条处置可追溯。

**架构：** 六个任务对应规格五切片（S1 拆为行为内聚的一个任务）；全部改动在 `.worktrees/review-fixes`（分支 `task/review-fixes`）由全新实现子代理完成；每任务 TDD + 独立 commit + 切片审查；任务 6（父链台账）为战役最后一个 commit。

**技术栈：** TypeScript（tsx runtime）、Vitest（`config/vitest.config.ts`）、POSIX shell（.githooks/pre-push）、JSON Schema draft-07（ajv）。

**规格：** [2026-09-03-review-fixes-design.md](../specs/2026-09-03-review-fixes-design.md)（26 条处置的唯一权威清单）

**全局纪律（每个任务适用）：**
- 版本保持 42.2.1；`.superpowers/` 不提交；工作目录 = worktree 根（下文相对路径均以其为基准）。
- 任务 1、2 触碰 `w-model-dev/scripts/**/*.ts` 与 `.githooks/pre-push`：编辑前先 codegraph 查询目标符号（可用 `mcp__codegraph__codegraph_explore`，projectPath 传主仓根 `D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack`——编辑前两棵树内容一致），并把查询记录（querySymbol/callers/callees/blastRadius/queryTimestamp，真实时间戳、changeId 用 `phase5-reviewfix3`）落盘到 worktree 的 `.w-model/codegraph-queries/phase5-reviewfix3-<symbol>.json`；`targetFiles` 必须覆盖该任务全部 code/test 变更文件（`.ts` 与——任务 1 生效后——`.sh`）。任务 1 完成后，任务 2 的 pre-push（.sh）查询义务由 A1 新规则产生，同样落盘。
- TDD：每条代码修复先写失败测试，跑红，再实现，跑绿。
- 定向回归命令：`npx vitest run --config config/vitest.config.ts <相关测试文件>`（在 worktree 根）。任务收尾另跑 `npm run self-test`（262 基线需同步时以实际输出为准更新）。
- commit 信息用 `fix(scope): ...` / `docs(scope): ...` 惯例；每任务可多个 commit，但一次 commit 不跨任务。

---

## 文件结构（本计划创建/修改的全部文件）

| 文件 | 职责 | 任务 |
|---|---|---|
| `w-model-dev/scripts/lib/change-scope.ts` | quotePath 修复、白名单扩展、changeId 前缀强制、`.` 段拒绝 | 1 |
| `w-model-dev/scripts/cli/check-openspec-archive.ts` | 归档日期真实日历日校验 | 1 |
| `w-model-dev/scripts/cli/check-codegraph-queries.ts` | 查询文件名 `^phase([5-8])-` 严格匹配 | 1 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | external summary `provided/changeId:null` 形态 | 1 |
| `w-model-dev/schemas/change-scope.schema.json` | 路径 pattern 拒绝单 `.` 段 | 1 |
| `w-model-dev/scripts/__tests__/change-scope.test.ts` | 上述行为的红-绿测试 | 1 |
| `w-model-dev/scripts/__tests__/check-openspec-archive.test.ts` | A5 测试 | 1 |
| `w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts` | A8 测试 | 1 |
| `w-model-dev/scripts/__tests__/artifact-gate-external.test.ts` | A7 测试 | 1 |
| `.githooks/pre-push` | remote 名拒绝前导 `-` | 2 |
| `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts` | D4 测试 | 2、3（B5） |
| `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | pre-push 源码契约断言同步 | 2、5（D3 计数） |
| `w-model-dev/scripts/logic/l0-link-audit-logic.ts` | reference-style 链接定义解析 | 3 |
| `w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` | 基线数单一来源（新建） | 3 |
| `w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts` / `l0-link-audit-cli.test.ts` | 改用共享基线 + 新解析断言 | 3 |
| `w-model-dev/scripts/__tests__/README.md` | B6 行同步 | 3 |
| `w-model-dev/references/quality-standards.md` | I-2 命令、C1 NFR 措辞 | 4、5 |
| `w-model-dev/references/hard-constraints.md` | I-2 #3 行、C3 :912 全链 | 4、5 |
| `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `docs/INSTALL.md` / `docs/troubleshooting.md` / `docs/skill-design-document_SSoT.md` | I-3 六处基线路径、D2 audit 措辞、D3 计数与 §8 行 | 4、5 |
| `w-model-dev/references/command-reference.md` | A3、A4、B2、C2、A6-注 | 5 |
| `w-model-dev/schemas/run-log.schema.json` | B2 描述披露 | 5 |
| `w-model-dev/templates/system-test.md` | C1 NFR 措辞 | 5 |
| `CHANGELOG.md`、`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md` | I-4 父链补插 + 追加 16 行 | 6 |

---

### 任务 1（S1）：ChangeScope/codegraph 行为修复 —— I-1、A1、A2、A5、A7、A8、B1

**文件：** 见文件结构表任务 1 行。

- [ ] **步骤 1：codegraph 查询落盘**

对 `change-scope.ts`（`computeGitChangedFiles`、`validateChangeScope`、`changedFilePathViolation`、`isCodeOrTestFile`）、`check-openspec-archive.ts`、`check-codegraph-queries.ts`、`check-artifact-gate.ts`（`aggregateExternalChecks`）各做一次 explore，落盘 `.w-model/codegraph-queries/phase5-reviewfix3-<symbol>.json`（真实时间戳）。

- [ ] **步骤 2：写失败测试（7 组，全部进现有测试文件，复用其临时仓库/CLI 子进程 harness）**

1. **I-1 quotePath**（change-scope.test.ts）：临时仓库构造 changed file `docs/设计文档.md`，走薄封装 `--change/--base/--head` 与 strict `--scope` 两条路径各一次；断言 exact-set 绑定通过、报错输出（若有）含字面 UTF-8 文件名而非八进制转义。修复前该用例红（双违规）。
2. **A1 白名单**（change-scope.test.ts）：`isCodeOrTestFile` 断言 `hooks/pre-push.sh`、`scripts/x.ps1`、`a.bat`、`a.cmd` → true；`a.tla`、`a.feature`、`a.sql`、`a.md` → false（后四者注释写明理由）。
3. **A2 changeId 前缀**（change-scope.test.ts）：phase=5 的合法 scope，`changeId:'reviewfix'` → violation（消息含「phase5-」前缀要求）；`changeId:'phase5-reviewfix'` → 通过；`changeId:'phase6-reviewfix'` → violation。薄封装 `--change=reviewfix` → exit 2。
4. **A5 归档日期**（check-openspec-archive.test.ts）：归档目录 `2026-13-45-<changeId>` → violation；`2026-09-03-<changeId>`（真实日期）→ 匹配通过；无日期前缀 `<changeId>` → 仍通过。
5. **A7 external summary**（artifact-gate-external.test.ts）：scope 缺失路径断言 `external.provided === false && external.changeId === null && external.passed === false`；更新既有对 `changeId:''` 的旧断言。
6. **A8 文件名前缀**（check-codegraph-queries.test.ts）：`phase05-a.json` 不计入 phase 5 查询（漏覆盖文件 → violation）；`phase5-a.json` 正常计入。
7. **B1 `.` 段**（change-scope.test.ts）：`changedFiles:['./x.ts']` 与 `['.']` → schema 校验 invalid 且 `changedFilePathViolation` 返回 violation；坏例集（:168 区域）补这两个输入。

- [ ] **步骤 3：跑红**

`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/change-scope.test.ts w-model-dev/scripts/__tests__/check-openspec-archive.test.ts w-model-dev/scripts/__tests__/check-codegraph-queries.test.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts`
预期：新增用例 FAIL（I-1 双违规、A1/A2/A5/A7/A8/B1 断言失败），既有用例仍 PASS。

- [ ] **步骤 4：实现**

1. `change-scope.ts`：git 文件清单命令的 args 统一前插 `['-c', 'core.quotePath=false']`（`computeGitChangedFiles` 与薄封装收集路径的所有调用点，逐点核对不遗漏）。
2. `isCodeOrTestFile` 扩展集合 `.sh/.ps1/.bat/.cmd`，注释注明 `.sql/.tla/.feature` 由 BDD/TLA+ 门禁兜底故不纳入。
3. `validateChangeScope` 增加：`changeId` 必须匹配 `` ^`phase${scope.phase}`- ``，violation 消息给出期望前缀。
4. `changedFilePathViolation` 增加 path 段 `=== '.'` 拒绝；`change-scope.schema.json` 的 pattern 在既有 `..` 负向断言旁并列加 `.` 段负向断言。
5. `check-openspec-archive.ts`：`<date>-<changeId>` 锚定匹配成功后，解析 date 段并做真实日历日校验（年 1-9999、月 1-12、日不超过当月天数；用 `new Date(Date.UTC(...))` 回读年月日核对），非法 → violation。
6. `check-codegraph-queries.ts` `phaseQueryFiles`：文件名前缀匹配收紧为精确单数字 `` ^`phase${phase}-` ``（`phase05-a.json` 因 `0` 不在 `[5-8]` 且整体非单数字前缀而天然不匹配，`phase55-` 同理不匹配）。
7. `check-artifact-gate.ts` `aggregateExternalChecks`：scope 缺失分支产出 `{provided:false, changeId:null, violationCount:0, passed:false}`；GATE_JSON 序列化保持字段稳定。

- [ ] **步骤 5：跑绿 + 回归**

同步骤 3 命令全绿；再跑 `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__`（目录级）确认无连带破坏；`npm run self-test` 通过（若 262 基线因消息文案变化需更新，以真实输出为准同步并在 commit 说明）。

- [ ] **步骤 6：Commit**

```bash
git add -A w-model-dev/scripts w-model-dev/schemas .w-model/codegraph-queries
git commit -m "fix(scripts): harden change-scope binding (quotePath, shell whitelist, changeId prefix, dot-segment, archive date, phase filenames, external summary)"
```

---

### 任务 2（S2）：pre-push remote 名拒绝前导 `-` —— D4

**文件：** `.githooks/pre-push:136-141`、`platform-deps-hook.test.ts`、`docs-consistency-logic.test.ts`（pre-push 源码契约断言，如有涉及）。

- [ ] **步骤 1：codegraph 查询落盘**（A1 生效后 `.sh` 属覆盖义务）：对 pre-push 的 `remote_enum_new_branch_files` 做一次 explore 并落盘。

- [ ] **步骤 2：写失败测试**（platform-deps-hook.test.ts）：新增用例——新分支 stdin 行 + mock git 环境，remote 名 `--push`；断言：hook 不再对 `--push` 执行枚举放行（`git log -m --name-only` mock 绊线不被触发为“跳过”路径），而是走 fail-closed 全量门禁（与既有“无法求基线”用例同一期望形态）。

- [ ] **步骤 3：跑红**（定向运行该测试文件）。

- [ ] **步骤 4：实现**：`.githooks/pre-push` case 改为 `''|-*|*[!A-Za-z0-9._-]*)  return 1 ;;`，注释补一行“前导 - 防选项注入面”。同步 docs-consistency-logic.test.ts 中断言该 case 模式的源码契约（若存在）。

- [ ] **步骤 5：跑绿 + 回归**（该测试文件 + docs-consistency 定向；Git Bash 下跑 `npm run prepush` 前置自测非必需，任务 6 后统一跑）。

- [ ] **步骤 6：Commit** `git add -A .githooks w-model-dev/scripts/__tests__ .w-model/codegraph-queries && git commit -m "fix(hooks): reject leading-dash remote names in pre-push enumeration (fail-closed)"`

---

### 任务 3（S3）：l0 解析器与测试健壮性 —— A6、B3、B4、B5、B6

**文件：** `l0-link-audit-logic.ts`、新建 `__tests__/helpers/l0-baseline.ts`、`l0-link-audit-logic.test.ts`、`l0-link-audit-cli.test.ts`、`platform-deps-hook.test.ts`、`change-scope.test.ts`、`__tests__/README.md`。

- [ ] **步骤 1：写失败测试**
1. **A6**（l0-link-audit-logic.test.ts）：markdown fixture 含 reference-style 定义 `[docs]: ./guide.md` 与用法 `[text][docs]`、`[docs][]`；断言 `./guide.md` 被采集（目标不存在时计入 violations，存在时计入 relativeLinkCount）。修复前红。
2. **B3**（change-scope.test.ts）：断言改名为「CLI 运行环境自检（非端到端）」——先改测试名与其内注释（此为重命名步骤，无红绿）。
3. **B5**（platform-deps-hook.test.ts:1065 区域）：在既有 `code === 1` 断言旁增加失败来源锚定：先手动运行一次该 fixture 观察 `run_expect` 失败行的实际日志格式，再断言输出含该行对 prettier 的标识（以观察到的真实格式写正则，不得臆测）。
- [ ] **步骤 2：跑红**（定向两文件）。
- [ ] **步骤 3：实现**
1. `parseRelativeLinks` 增加行首定义式采集：`/^ {0,3}\[([^\]]+)\]:[ \t]+<?([^)> \t]+)>?/`，目标为相对路径的计入采集集（绝对 URL/锚点沿用既有过滤）；`decodeURI` 行为保持不变（已知近似，注释标注）。
2. **B4**：实测更新后基线——先实现 A6，跑 `npm run audit:l0-links` 取真实三数，写入新建 `__tests__/helpers/l0-baseline.ts`（`export const L0_BASELINE = { relativeLinkCount: <实测>, l1Only: <实测>, placeholders: <实测> } as const;`），两个 l0 测试文件改 import 该常量（删除各自字面量），再次运行确认双绿。
3. **B6**：`__tests__/README.md:57` skill-metadata 行补「含 doctor script 断言」。
- [ ] **步骤 4：跑绿 + 回归**（l0 两文件 + platform-deps-hook + `npm run audit:l0-links` 退出码 0）。
- [ ] **步骤 5：Commit** `git commit -m "fix(scripts): parse reference-style links in L0 audit; consolidate pinned baselines; anchor hook failure-source assertion"`（含 B3 重命名一并入此 commit）。

---

### 任务 4（S4a）：两处 Important 文档修复 —— I-2、I-3

**文件：** `quality-standards.md:184 区域`、`hard-constraints.md`（#3 行）、六处根文档（README.md:238、AGENTS.md:51、CONTRIBUTING.md:92、docs/INSTALL.md:174、docs/troubleshooting.md:92 1.7b、SSoT:1198 §8.2.4）。

- [ ] **步骤 1：I-2 替换**：两处裸命令改为 `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>`，紧随补注「阶段 5-8 另须 `--scope=<change-scope.json>`；scope 缺失或与 Git 实际变更不符即 exit 1（fail-closed 设计）」。随后 `grep -rn "check-artifact-gate.ts \[project-dir\]" --include="*.md" w-model-dev docs README.md AGENTS.md CONTRIBUTING.md` 清扫其余裸调用，按所在阶段的语境补 `--phase=<N>`（阶段 1-4）/`--scope=`（阶段 5-8）。
- [ ] **步骤 2：I-3 六处补写**：在每处「新分支基线不可证明 → fail-closed」表述前插入第三条路径，标准句式（按各文档语气微调，SSoT 最详）：

  > 新分支基线按序解析：fork-point → merge-base → remote-tracking 排除集枚举（remote 名经白名单与 `git remote get-url` 验证后执行 `git log -m --name-only --pretty=format: <local_sha> --not --remotes=<remote>`，`-m` 确保合并提交按父逐个列出避免空 diff 漏检）；三级全部失败时才 fail-closed 运行全量门禁。

  以 `.githooks/pre-push:132-152,196-234` 实现逐句核对（顺序、`-m`、白名单、get-url、枚举失败回落全量门禁）。
- [ ] **步骤 3：验证**：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 退出码 0；六处 grep 复核无残留旧表述（`grep -rn "基线为空\|退化为推送尖" README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md docs/troubleshooting.md docs/skill-design-document_SSoT.md` 应仅命中已补全的新句式或无命中）。
- [ ] **步骤 4：Commit** `git commit -m "docs: require --phase/--scope in gate command examples; document remote-tracking new-branch baseline path"`

---

### 任务 5（S4b）：七条文档 Minor —— A3、A4、B2、C1、C2、C3、D2、D3、A6-注

**文件：** `command-reference.md`、`run-log.schema.json`、`templates/system-test.md:59`、`quality-standards.md:39`、`hard-constraints.md:912`、README/AGENTS/CONTRIBUTING（audit 措辞）、AGENTS.md §8、`docs-consistency-logic.test.ts`（如 D3 计数期望需同步）。

- [ ] **步骤 1：command-reference 四处**（A3/A4/C2/A6-注）：
  - A3 opsx 节追加：「strict 模式只校验 scope 选定的变更目录；同阶段其它半成品兄弟目录不在本 gate 扫描范围，每个 change 须各自执行 gate（与 SSoT §1338 取舍一致）。」
  - A4 scope 用法处加：「仅支持 `--scope=<file>` 等号形态；空格形态按未提供处理（fail-closed exit 1）。」
  - C2 opsx 条改写为：「`changeId` 不匹配任何 active 候选 → violation；存在多候选时按 `scope.changeId` 精确选择其一（不再任取第一项）。」
  - A6-注 l0 节加：「已知近似：URL 内含 `)` 的行内链接与 `%23`/`%2F` 转义不解码；reference-style 定义已采集。」
- [ ] **步骤 2：B2**：`run-log.schema.json` 的 emergency-fix allOf `description` 与 `variant`/`blocker` 字段 description 末尾追加：「历史兼容：未声明 variant 的历史 emergency-fix 记录由 check-run-log 以 LEGACY_VARIANT 非阻断 diagnostic 吸收（exit 0 + NOT_CLOSED_NOT_PROVEN）；新记录必须声明 variant 且 emergency-fix 须附 blocker。」command-reference run-log 节补同句。
- [ ] **步骤 3：C1**：先读 `w-model-dev/scripts/logic/gate-logic.ts` NFR 段（约 :583-598）确认精确语义（预期：`targetValue` 与 `testThreshold` 双字段均缺失 → reasons → exit 1；单缺其一 → 警告不阻断；以代码为准），再把 `templates/system-test.md:59` 与 `quality-standards.md:39` 的「警告级，不 fail」改为与代码一致的表述。
- [ ] **步骤 4：C3**：`hard-constraints.md:912` 的「完整返工循环：V/G → R → V → G → S-fix → V → G（SKILL.md「执行工作流」步骤 9）」替换为与同文件其余 17 处逐字一致的全链 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，并修正括号内的步骤指向（参照相邻 #4 行的写法）。
- [ ] **步骤 5：D2**：README.md:236、AGENTS.md:51、CONTRIBUTING.md:108 的 audit 措辞统一为「网络瞬态错误（DNS 解析失败、连接被重置/拒绝、超时、HTTP 429/5xx、socket hang up 等）或 registry 不支持 audit endpoint 时自动跳过；漏洞报告、JSON 解析与权限错误仍然阻断」（与 `.githooks/pre-push:372-404` 实现核对）。
- [ ] **步骤 6：D3**：`ls w-model-dev/scripts/cli/*.ts | wc -l` 与 exit-2 实数核实（读各脚本 exit 2 路径）；AGENTS.md scripts 行 "35"→实数；§8 表按现有列式补 `wm-export-evidence.ts`、`platform-deps-install.ts` 两行（用途/阶段/退出码以脚本实际为准）；读 `check-docs-consistency.ts` 的 exit-2 计数逻辑，若其期望值为硬编码则三方对齐并同步 `docs-consistency-logic.test.ts` 对应断言。
- [ ] **步骤 7：验证 + Commit**：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 退出码 0、`npm run audit:l0-links` 退出码 0；`git commit -m "docs: reconcile gate/opsx/run-log/NFR/audit/exit-2-count wording with implementations"`

---

### 任务 6（S5）：父链台账补全 —— I-4（战役最后一个 commit）

**文件：** `CHANGELOG.md`、`docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`。

- [ ] **步骤 1：补插断链行**：在两份台账中 97b91bad 行与 689e51bd 行之间按时间序插入 `| \`965095e049bf0688e1b343c5adcdd70407642228\` | \`docs(changes): annotate verbatim subject citations in parent ledgers\` |`（行式与相邻行完全一致）。
- [ ] **步骤 2：追加 16 行**：`git log --first-parent --reverse --format='%H %s' 6adc3215815cff0d355c13a15a6e00278e393812..HEAD` 逐行生成（SHA 全小写 40 位、subject 逐字），追加到两份台账父链表末尾。
- [ ] **步骤 3：改写范围限定句**：CHANGELOG.md:32 区域与验收记录:365 的「本节只记录任务 1/3/4 代码提交…」改为全量覆盖表述（父链现已连续覆盖至当时 tip 的父提交；本追加提交自身按规则不入链）。
- [ ] **步骤 3b：补 B7 处置记录**：在 CHANGELOG.md 本轮条目（42.2.1 域内）追加一段「2026-09-03 审查 26 条处置」索引说明：4 Important + 21 Minor 已修复、B7（文本契约测试脆性）wontfix，理由 = in-file 注释已声明为刻意防线（防 hook 语义漂移），详见规格 `docs/superpowers/specs/2026-09-03-review-fixes-design.md`。
- [ ] **步骤 4：链条校验**：脚本化逐对校验两份台账的 SHA 序列满足“前一行 = 后一行 first-parent 父提交”且覆盖 97b91bad→HEAD-1 全部 first-parent 提交、无 tip 自引用；输出留存。
- [ ] **步骤 5：Commit** `git commit -m "docs(changes): restore parent-chain continuity (insert 965095e0, append 16 rows through f0add11)"`

---

## 收尾（任务 6 之后，控制者执行，非实现子代理）

1. 全量回归：vitest 全量、self-test、eval、typecheck、lint:security、docs-consistency、samples-coverage、audit:l0-links、doctor、`npm audit --audit-level=high`。
2. `npm run prepush`（Git Bash）17 项全绿；flake 只隔离 3× 重跑并记录。
3. 独立审查（范围 `f0add11..task/review-fixes tip`）：0 Critical / 0 Important；26 条处置逐条可追溯。审查 clean 后本地 fast-forward 合并 main、清理 worktree 与分支；不推送。
