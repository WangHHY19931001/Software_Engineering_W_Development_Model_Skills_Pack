# 远端到本地审查问题修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `origin/main...HEAD` 审查中确认的证据伪造、路径逃逸、CLI 不确定性、提交钩子 staged 语义、负向门禁假绿以及测试/文档覆盖缺口，并在 Windows、Git Bash/WSL 环境下完成全量回归。

**架构：** 先以失败测试固定安全边界，再建立一个只接受项目内普通文件的路径解析单元；M07/R10 不再根据可变时间戳自动吸收历史记录，历史数据通过真实运行证据和现有 source-provenance producer 迁移。CLI 输出采用完整 SHA、确定性序列化、预校验和同目录原子写；提交钩子对 staged snapshot 做检查，测试/文档门禁改为精确集合和真实负向执行。

**技术栈：** TypeScript、tsx、Vitest、Ajv JSON Schema、Node `fs`/`path`/`crypto`、Git CLI、Bash/Git Bash/WSL。

---

## 0. 已确认基线与固定决策

### 0.1 审查范围

- 基线：`origin/main@7f0a28e62535b21e96ccb84d82a9c83bb2e78ac1`。
- 本地节点：`HEAD@6ba77ed7b222b3c362420d58dd7c7e2ab2b90120`。
- 提交关系：本地线性领先远端 102 个提交。
- 变更规模：120 个文件，新增 12,787 行，删除 283 行。
- 工作区：计划创建前保持干净；本计划只覆盖这段变更，不修改远端或历史提交。

### 0.2 方案 1 的兼容性裁定

1. 删除 M07 的 `M07_TEST_EVIDENCE_CUTOFF` 自动吸收路径。阶段 5–8 中，当前阶段 `total > 0` 且缺少合法 `executionSummary.<layer>.evidence` 始终是阻断错误；`lastUpdated` 只保留为 RTM 元数据，不参与信任判定。
2. 删除 R10 的 `LEGACY_REVERT_EVIDENCE_CUTOFF` 自动吸收路径。`fix`/`emergency-fix` 缺少合法 `revertEvidence.command` 始终阻断；`timestamp` 只作日志元数据，不参与信任判定。
3. 历史 fixture 与受控项目数据不通过“回填旧时间”迁移。迁移者必须重新执行真实命令、保存原始输出及 SHA-256，并运行现有 `wm-verify-evidence-source` producer+verify 记录当前 HEAD、source bundle 和运行身份。迁移完成前，旧数据按新规则失败。
4. 为避免无必要的消费者破坏，`GATE_JSON.testEvidence.legacy` 与 `RUN_LOG_JSON.r10.legacy` 保留报告字段，但严格模式下不再产生 legacy 放行诊断，字段值固定为 0；文档明确“0 表示没有时间戳豁免”，而不是历史记录已被证明有效。
5. `rawOutputPath`、`--tickets` 和 review-package 输出路径均拒绝 symlink/junction；这是安全策略变更，现有依赖链接文件的样例必须改为普通文件。
6. 默认 review-package 文件名可继续使用短 SHA 以保持调用兼容，但 Git `log`/`diff` 范围和正文只使用完整 SHA；正文的提交列表使用固定格式，不受 `core.abbrev` 影响。

### 0.3 当前回归事实

- 已通过：`typecheck`、`self-test`、`lint:security`、核心受影响定向测试、`git diff --check`。
- 已观察到：全量 Vitest 的两个失败集中在 Windows Bash hook probe 的 `exit127` 与临时目录 `EBUSY`；修复计划将其作为测试基础设施问题处理，不用跳过测试掩盖。
- 当前 `w-model-dev/scripts/__tests__/README.md` 记录 81 个测试文件，磁盘实际为 88 个；缺少 7 个新增测试文件的登记。

## 1. 文件清单与职责

### 1.1 创建

- `w-model-dev/scripts/lib/safe-project-path.ts`：统一执行项目根相对路径的词法检查、`lstat`/`realpath` containment、普通文件检查和结构化错误映射。
- `w-model-dev/scripts/__tests__/safe-project-path.test.ts`：覆盖绝对路径、盘符、UNC、`..`、反斜杠、NUL、symlink/junction、外部目标、普通文件和目录。
- `w-model-dev/scripts/__tests__/pre-commit-hook.test.ts`：在隔离 Git 仓库中验证 staged-only 与跨平台路径行为。

### 1.2 修改：门禁与数据契约

- `w-model-dev/scripts/logic/gate-logic.ts`：严格 M07、普通文件证据、空白命令、精确票据符号。
- `w-model-dev/scripts/logic/run-log-logic.ts`：严格 R10，不再按 timestamp 吸收缺失回滚证据。
- `w-model-dev/scripts/lib/types.ts`：同步报告字段和证据类型说明。
- `w-model-dev/schemas/rtm.schema.json`：拒绝空白 command，更新证据描述与严格语义。
- `w-model-dev/schemas/run-log.schema.json`：登记 R10 始终由逻辑层强制的契约说明；保持 `revertEvidence.command` 非空形态。
- `w-model-dev/scripts/cli/check-artifact-gate.ts`：使用安全 tickets 路径解析，在任何读取前拒绝逃逸路径。
- `w-model-dev/scripts/cli/check-run-log.ts`：同步严格 R10 的摘要和错误说明。

### 1.3 修改：review-package 与提交钩子

- `w-model-dev/scripts/cli/review-package.ts`：参数严格解析、完整 SHA、确定性输出、`--out` 预校验、原子写入。
- `w-model-dev/scripts/__tests__/review-package-cli.test.ts`：补充短 SHA 冲突、参数、预校验、写入失败和 symlink 目标场景。
- `.githooks/pre-commit`：按 staged snapshot 检查格式和类型，并修正路径/临时状态清理。
- `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`：修正 Bash 调用和临时目录清理的 Windows/Git Bash 适配。
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`：修正 pre-push probe 的 Bash runner，并新增 AGENTS 精确表格测试。
- `config/vitest.config.ts`：动态描述或准确维护 subprocess serial project，不再保留“30 个测试文件”陈旧事实。
- `w-model-dev/scripts/__tests__/vitest-project-split.test.ts`：断言配置事实，不断言陈旧硬编码数字。

### 1.4 修改：覆盖门禁、污染排序与文档

- `w-model-dev/scripts/cli/check-samples-coverage.ts`：严格解析负向清单、校验一一对应、证据位置和受控执行结果。
- `w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`：覆盖未知、重复、缺失、假路径、无效行号和真实 exit-2 probe。
- `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`：补全并规范 45 个 exit-2 门禁登记。
- `w-model-dev/scripts/logic/docs-consistency-logic.ts`：将 AGENTS 导航校验改为 §8 表格精确匹配；增加测试矩阵集合校验。
- `w-model-dev/scripts/__tests__/gate-test-evidence.test.ts`：增加 CLI/Schema/GATE_JSON 三态链路测试。
- `w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`：增加精确符号匹配回归。
- `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts`：把快照范围扩展到完整隔离仓库。
- `w-model-dev/scripts/__tests__/README.md`：补齐 7 个漏登文件，并由门禁自动检查集合等价。
- `w-model-dev/scripts/cli/check-pollution.ts`：改为 locale 无关稳定排序。
- `w-model-dev/scripts/__tests__/check-pollution-cli.test.ts`：增加非 ASCII 路径和不同 locale 环境回归。
- `AGENTS.md`、`w-model-dev/references/data-models.md`、`w-model-dev/references/command-reference.md`、`w-model-dev/references/rtm-guide.md`、`w-model-dev/templates/rtm.md`、`w-model-dev/scripts/samples/README.md`：同步严格证据、路径和测试矩阵语义。

### 1.5 明确不修改

- 不改 `origin/main`、历史提交、`CHANGELOG-archive.md`、`docs/changes/**` 及历史计划/规格中的当时事实。
- 不把 `.w-model/`、`coverage/` 或测试运行时输出强制加入 Git；迁移所需 source provenance 仍由现有 producer 在受控项目内生成。

## 2. 任务分解

### 任务 1：建立失败测试与迁移清单

**文件：**
- 修改：`w-model-dev/scripts/__tests__/gate-test-evidence.test.ts`、`run-log-logic.test.ts`、`gate-ticket-content.test.ts`、`review-package-cli.test.ts`、`check-samples-coverage.test.ts`、`docs-consistency-logic.test.ts`
- 创建：`w-model-dev/scripts/__tests__/safe-project-path.test.ts`、`pre-commit-hook.test.ts`

- [ ] **步骤 1：登记严格 M07/R10 的失败断言**

  在现有测试 builder 上分别构造“其他字段合法、只把 `lastUpdated`/`timestamp` 改成 cutoff 之前、证据缺失”的输入，断言 `checkArtifactGate(...).passed` 和 `checkRunLog(...).passed` 都为 `false`，且原因包含 E4/R10，而不是 legacy diagnostic。

- [ ] **步骤 2：登记空白 command 和符号重叠的失败断言**

  使用现有 `checkTicketContent` 和 M07 builder 增加以下回归：

  ```ts
  expect(checkTicketContent([
    '# 01 — define',
    'What to build: `Foo.run(job): Result`',
    '# 02 — use',
    '调用 `Other.call(job)`',
  ].join('\n')).passed).toBe(false);

  const evidence = makeEvidence({ command: '   ' });
  const matrix = makeMatrix({ unitTest: makeSummary({ evidence }) });
  expect(checkArtifactGate(matrix, { phaseOption: 8 }).passed).toBe(false);
  ```

  测试必须断言具体规则编号，避免仅断言“有任意错误”。

- [ ] **步骤 3：加入安全路径的失败测试**

  测试 `resolveProjectRelativeRegularFile` 对 `C:\outside.txt`、`\\server\share\x`、`/tmp/x`、`../outside`、`a\\b`、包含 NUL 的字符串、目录、普通文件指向项目外的 symlink 均抛出 `SafeProjectPathError`；普通项目内文件返回规范绝对路径。

- [ ] **步骤 4：加入 review-package 和 staged-only 反向测试**

  在临时 Git 仓库内先提交合法内容，再分别制造：短 SHA 冲突、空 `--repo`、未知位置参数、非法输出目录、输出目标 symlink、暂存合法但工作树非法、暂存非法但工作树合法。每个场景都断言退出码、stdout/stderr 分类和 index/worktree 未被修改。

- [ ] **步骤 5：运行测试确认当前实现失败**

  运行：

  ```text
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/safe-project-path.test.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts w-model-dev/scripts/__tests__/review-package-cli.test.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts
  ```

  预期：新增断言失败，且失败原因对应上述已复现缺陷；不得因测试 helper 自身异常而通过。

- [ ] **步骤 6：Commit**

  ```text
  git add w-model-dev/scripts/__tests__
  git commit -m "test: pin review remediation regression contracts"
  ```

### 任务 2：实现安全项目路径解析与严格证据策略

> **执行拆分：** 为保持每轮实现与审查边界清晰，本任务拆为 2A（安全项目路径 helper、M07 E2 与 `--tickets` 接入）和 2B（M07/R10 去除时间戳 legacy 放行、Schema/fixture 迁移）。2A 先完成并通过任务级审查后，2B 再开始；两者不共享生产文件写集。

**文件：**
- 创建：`w-model-dev/scripts/lib/safe-project-path.ts`
- 修改：`w-model-dev/scripts/logic/gate-logic.ts`、`run-log-logic.ts`、`check-artifact-gate.ts`、`check-run-log.ts`、`lib/types.ts`、`schemas/rtm.schema.json`、`schemas/run-log.schema.json`
- 测试：`safe-project-path.test.ts`、`gate-test-evidence.test.ts`、`run-log-logic.test.ts`

- [ ] **步骤 1：定义安全路径 API 和错误语义**

  在新 helper 中定义并导出：

  ```ts
  export class SafeProjectPathError extends Error {
    readonly reason: 'absolute' | 'invalid-segment' | 'outside-root' | 'link' | 'not-file' | 'missing';
  }

  export function resolveProjectRelativeRegularFile(
    projectRoot: string,
    relativePath: string,
  ): string;
  ```

  先拒绝 POSIX/Windows 绝对路径、盘符、UNC、反斜杠、NUL、空段和 `..`；再对项目根和目标路径执行 `realpath`，要求规范目标位于规范项目根内；逐段 `lstat`，发现 symlink/junction 即拒绝；最终要求 `stat.isFile()` 为真。

- [ ] **步骤 2：将 M07 输出核验接入 helper**

  让 `resolveTestEvidenceOutputPath` 委托新 helper。保留“缺 `projectRoot` 时携带 raw output 不能放行”的 fail-closed 行为；将安全路径错误映射为现有 E2 结构化违规，不泄露绝对路径以外的敏感内容。

- [ ] **步骤 3：让 `--tickets` 在读取前完成校验**

  `check-artifact-gate.ts` 解析参数后立即对 `ticketsArg` 调用 helper；只有成功得到普通项目内文件后才 `readFileSync`。绝对路径、`..`、反斜杠、盘符、UNC、NUL、symlink 和目录均返回 `ARG_INVALID`/exit 2，且不写 gate log。

- [ ] **步骤 4：删除时间戳 legacy 分支**

  在 `gate-logic.ts` 删除 `M07_TEST_EVIDENCE_CUTOFF` 判断和 `LEGACY_TEST_EVIDENCE` 放行分支；在 `run-log-logic.ts` 删除 `LEGACY_REVERT_EVIDENCE_CUTOFF` 判断和 `LEGACY_REVERT_EVIDENCE` 放行分支。保留报告计数键并在严格路径设置为 0；缺证据始终加入阻断 reasons/violations。

- [ ] **步骤 5：收紧 Schema 与命令形态**

  将 `rtm.schema.json` 的 `evidence.command` pattern 改为同时禁止危险 shell 字符和全空白值，例如使用 `(?=.*\\S)` 与现有禁字符约束的组合；同步 `data-models.md` 的字段描述。`run-log.schema.json` 保留 `revertEvidence.command` 的非空字符串形态，逻辑层不再按日期豁免。

- [ ] **步骤 6：执行严格证据迁移**

  将 `valid-test-evidence-legacy.json` 改为真实合法 evidence 样例，新增一个“旧日期但缺证据”的负向样例；为 `rootcause-valid.jsonl` 等受影响 fixture 保留合法 `revertEvidence`。在受控项目上执行：

  ```text
  npm run --silent wm:verify-evidence-source -- <project-dir>
  npm run --silent check-artifact-gate -- <project-dir> --phase=8
  npm run --silent check-run-log -- <project-dir>
  ```

  迁移记录必须能由 provenance 的 `commitSha`、`sourceBundleSha256`、`runId` 和 `provenanceSha256` 复核；不得通过修改 `lastUpdated` 或 `timestamp` 代替真实运行。

- [ ] **步骤 7：运行任务测试确认通过**

  运行：

  ```text
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/safe-project-path.test.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts
  npm run --silent typecheck
  ```

  预期：严格旧日期样例失败，合法 evidence 样例通过，所有路径攻击样例 exit 2/阻断，类型检查通过。

- [ ] **步骤 8：Commit**

  ```text
  git add w-model-dev/scripts/lib/safe-project-path.ts w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/cli/check-artifact-gate.ts w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/lib/types.ts w-model-dev/schemas w-model-dev/scripts/samples w-model-dev/scripts/__tests__
  git commit -m "fix: make evidence and project paths fail closed"
  ```

### 任务 3：修复 S18 精确符号判定

**文件：**
- 修改：`w-model-dev/scripts/logic/gate-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`
- 文档：`w-model-dev/references/command-reference.md`、`w-model-dev/references/data-models.md`、`w-model-dev/scripts/samples/gate/tickets-valid.md`

- [ ] **步骤 1：把失败样例固定为最小反例**

  断言定义 `Foo.run(job): Result`、引用 `Other.call(job)` 时返回 S18 blocking；同时断言定义和引用都为 `Foo.run`、仅参数名改变时通过。

- [ ] **步骤 2：实现符号头规范化**

  将定义与使用表达式分别规范化为 owner/member 调用头；定义参数名、返回类型和普通共享 token 不进入 `definedSymbols`。匹配使用精确字符串或等价 canonical key，不再使用任意 token 交集。

- [ ] **步骤 3：补充边界测试**

  覆盖嵌套泛型、空格、反引号、同名参数、不同 owner 同名 method、重复定义和无 owner 调用。断言错误信息包含未定义的完整符号头，而不是共享参数名。

- [ ] **步骤 4：运行与提交**

  运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`。

  ```text
  git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts w-model-dev/references/command-reference.md w-model-dev/references/data-models.md w-model-dev/scripts/samples/gate/tickets-valid.md
  git commit -m "fix: match ticket symbols exactly"
  ```

### 任务 4：修复 review-package 的输入、确定性与原子写入

**文件：**
- 修改：`w-model-dev/scripts/cli/review-package.ts`
- 测试：`w-model-dev/scripts/__tests__/review-package-cli.test.ts`

- [ ] **步骤 1：收紧参数解析**

  拒绝未知位置参数、空 flag 值、`--repo=`、空白 `--repo` 和无值选项；显式 `--repo` 必须解析为存在的 Git 仓库。错误统一走 `ARG_INVALID`/exit 2，不能回退到当前工作目录。

- [ ] **步骤 2：预校验输出目标**

  在 `resolveRev`/`git log` 前校验 `--out` 的父目录存在且为目录、目标不是目录或 symlink，并拒绝无法规范化的目标。测试通过 mock Git 或临时 wrapper 证明非法 `--out` 不会执行 Git 采集。

- [ ] **步骤 3：改用完整 SHA 和固定日志格式**

  Git 范围改为 `${baseSha}..${headSha}`；提交列表改为 `git log --format=%H\ %s --no-decorate` 等固定格式，禁止依赖 `--oneline` 的本地 abbrev 设置。header 可继续展示短文件名，但正文和摘要使用完整 SHA。

- [ ] **步骤 4：实现安全原子写入**

  在输出目录创建唯一临时文件，以 UTF-8 写入并关闭后使用同目录 rename 替换目标；写入异常时删除临时文件并保留既有目标。目标为 symlink、目录或 rename 失败时返回结构化文件错误，不执行“先删除旧文件再重命名”的非原子降级。

- [ ] **步骤 5：运行 review-package 回归**

  运行：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/review-package-cli.test.ts`。

  预期：短 SHA 冲突仍采集正确提交/差异；`core.abbrev=4` 和 `core.abbrev=12` 产生相同正文；所有非法输入 exit 2；写入失败不会破坏 sentinel 文件。

- [ ] **步骤 6：Commit**

  ```text
  git add w-model-dev/scripts/cli/review-package.ts w-model-dev/scripts/__tests__/review-package-cli.test.ts
  git commit -m "fix: make review packages deterministic and atomic"
  ```

### 任务 5：修复 pre-commit staged-only 与跨平台执行

**文件：**
- 修改：`.githooks/pre-commit`、`w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`、`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
- 创建：`w-model-dev/scripts/__tests__/pre-commit-hook.test.ts`
- 相关配置：`config/vitest.config.ts`

- [ ] **步骤 1：固定 staged snapshot 行为**

  设计受控临时 index 或 staged 文件快照：对每个暂存路径使用 `git show :path` 作为输入；不能直接读取工作树内容。全项目 TypeScript 检查使用临时快照作为工作目录，或明确把类型检查范围限制为由 index 生成的临时树。

- [ ] **步骤 2：实现清理和失败恢复**

  在 Bash 中记录原始 `GIT_INDEX_FILE`、临时目录和退出码；通过 `trap` 清理临时 index/snapshot，退出时恢复环境变量，不调用 `git add`、`git reset` 或覆盖用户工作树。

- [ ] **步骤 3：修复 Windows/Git Bash 路径传递**

  对传给 Node/tsx 的路径统一使用绝对路径和当前 Bash 可识别的格式；路径含空格、中文、括号时使用数组参数，不拼接未经引用的命令字符串。Git Bash、MSYS、MINGW、WSL 分别跑同一行为测试。

- [ ] **步骤 4：修复 hook 测试 runner**

  将嵌套 `bash` 调用改为显式 `bash -c` 参数传递，保证 stdin EOF，移除对空脚本路径的隐式依赖；临时目录删除前等待子进程句柄释放，并在 Windows 使用有限次数的重试，不吞掉真实断言错误。

- [ ] **步骤 5：运行反向场景**

  运行：

  ```text
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  ```

  预期：暂存合法/工作树非法通过；暂存非法/工作树合法失败；index、工作树和临时目录快照一致；Windows 不再出现 `exit127` 或 `EBUSY`。

- [ ] **步骤 6：Commit**

  ```text
  git add .githooks/pre-commit config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  git commit -m "fix: validate staged content across hook platforms"
  ```

### 任务 6：让负向覆盖门禁真实、完整、可审计

**文件：**
- 修改：`w-model-dev/scripts/cli/check-samples-coverage.ts`、`w-model-dev/scripts/__tests__/check-samples-coverage.test.ts`、`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`
- 相关：`w-model-dev/scripts/cli/self-test.ts`、`w-model-dev/scripts/cli/check-docs-consistency.ts`

- [ ] **步骤 1：定义严格负向登记语法**

  解析每个表格行，要求门禁名、机制、证据三列都存在；门禁名必须属于实时 exit-2 registry；每个门禁恰好一行；未知门禁、重复门禁、未知机制、空证据均产生 blocking violation。

- [ ] **步骤 2：校验证据位置**

  `fixture` 必须指向项目内真实普通文件；`invocation`/`mutated-copy` 必须解析为真实测试文件和正整数行号，行号不得超过文件总行数；拒绝正文中只有文字提及的伪证据。

- [ ] **步骤 3：加入受控 exit-2 probe**

  由清单解析出命令和输入，复制到临时项目根执行，断言 exit code 为 2、stdout 有 `ERROR_JSON`、stderr 有人类错误、临时项目没有新增非白名单文件。probe 串行执行，完成后删除临时根并报告每个门禁的实际结果。

- [ ] **步骤 4：同步 45 条登记并保留可读证据**

  为所有当前 exit-2 CLI 生成一条唯一登记；每条证据指向具体 fixture 或测试文件/行号。删除“存在但不执行”的虚假 invocation 行。

- [ ] **步骤 5：验证**

  运行：

  ```text
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts
  npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts . --json
  ```

  预期：仓库登记全部通过；向临时清单注入未知/重复/假行号后 exit 1；任一 probe 返回 0、1 或异常均使 coverage 门禁失败。

- [ ] **步骤 6：Commit**

  ```text
  git add w-model-dev/scripts/cli/check-samples-coverage.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md
  git commit -m "fix: execute and validate negative gate coverage"
  ```

### 任务 7：补齐文档一致性、测试矩阵和确定性缺口

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`、`w-model-dev/scripts/__tests__/README.md`、`w-model-dev/scripts/cli/check-pollution.ts`、`w-model-dev/scripts/__tests__/check-pollution-cli.test.ts`、`w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts`、`w-model-dev/scripts/__tests__/gate-test-evidence.test.ts`、`config/vitest.config.ts`、`w-model-dev/scripts/__tests__/vitest-project-split.test.ts`
- 文档：`AGENTS.md`、`w-model-dev/references/data-models.md`、`w-model-dev/references/command-reference.md`、`w-model-dev/references/rtm-guide.md`、`w-model-dev/templates/rtm.md`、`w-model-dev/scripts/samples/README.md`

- [ ] **步骤 1：修正 AGENTS 导航匹配**

  只读取 AGENTS §8 的 Markdown 表格行和脚本名单元格；正文、代码块、相似前缀不能算覆盖。增加“正文出现 `check-foo.ts` 但表格没有该行”必须失败，以及表格精确行通过的测试。

- [ ] **步骤 2：补齐 README 测试集合**

  将实际 `scripts/__tests__/*.test.ts` 文件集合与 README 表格首列解析集合做双向差集；补齐 `asset-budget.test.ts`、`check-pollution-cli.test.ts`、`exit2-failure-atomicity.test.ts`、`gate-test-evidence.test.ts`、`gate-ticket-content.test.ts`、`l0-rule-loadbearing.test.ts`、`review-package-cli.test.ts`，并拒绝重复/孤儿行。

- [ ] **步骤 3：扩大 exit-2 原子性快照**

  快照完整临时仓库和探针根，而不只快照 `samples/coverage/.w-model`；对 45 个门禁逐个比较相对路径、文件类型、内容 SHA 和 Git 状态，允许列表仅包含测试显式声明的临时产物。

- [ ] **步骤 4：补全 gate-test-evidence CLI wiring**

  增加三态测试：合法 RTM 返回 `GATE_JSON`/exit 0；业务违规返回 exit 1 且含 E1–E4 计数；Schema/输入错误返回 exit 2 且含 `ERROR_JSON`。测试使用真实 `check-artifact-gate.ts` 子进程，不只直接调用纯函数。

- [ ] **步骤 5：固定 pollution 排序**

  将 findings 按 locale 无关的 UTF-16/code-point 或 UTF-8 byte comparator 排序，不调用默认 `localeCompare`；使用带中文、德文变音符号和瑞典字符的路径，在多个 `LANG/LC_ALL` 设置下比较完全相同的 JSON 字节。

- [ ] **步骤 6：同步活体文档**

  更新 active docs 中的 cutoff、legacy 吸收、路径允许范围、负向执行、测试计数说明；历史计划、规格和归档文件保持原文。所有新增 Schema 字段描述满足 docs-consistency 的全字段描述门禁。

- [ ] **步骤 7：运行并提交**

  运行：

  ```text
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts w-model-dev/scripts/__tests__/check-pollution-cli.test.ts w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/vitest-project-split.test.ts
  ```

  ```text
  git add AGENTS.md config/vitest.config.ts w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-pollution.ts w-model-dev/scripts/__tests__ w-model-dev/references w-model-dev/templates/rtm.md w-model-dev/scripts/samples/README.md
  git commit -m "test: close coverage and documentation drift"
  ```

### 任务 8：全量验证、门禁收口与审查交付

**文件：** 不新增业务文件；必要时只更新本计划的执行结果。

- [ ] **步骤 1：运行快速验证**

  ```text
  npm run --silent typecheck
  npm run --silent self-test
  npm run --silent lint:security
  npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts . --json
  git diff --check
  ```

  预期：类型检查、自测、安全扫描、samples coverage 全部退出 0；security scan 的新增发现为 0。

- [ ] **步骤 2：运行完整 Vitest**

  在可用的 Git Bash 或 WSL 中独占运行：`npm test`。在 Windows 原生环境额外运行受影响 hook 测试；记录测试文件总数、用例总数、失败文件和 shell 环境，不把平台不可用误报为通过。

- [ ] **步骤 3：运行推送前 18 项门禁**

  在 Git Bash/WSL 中独占运行：`npm run prepush`。预期 18/18 通过、末行允许推送、退出码 0；确认 `check-pollution.ts` 仍是按需工具，不被错误加入 pre-push。

- [ ] **步骤 4：检查仓库状态和计划范围**

  运行：`git status --short --branch`、`git diff --stat origin/main...HEAD`、`git diff --name-only origin/main...HEAD`。确认没有 `.w-model`、`coverage`、临时 probe、依赖 lockfile 或历史归档被意外加入。

- [ ] **步骤 5：执行 V/G 复审**

  V 子代理按 security-auditor、test-engineer、code-reviewer 三个视角检查证据不可伪造、负向门禁真实执行和跨平台行为；G 子代理重新运行相关 gate。若任一失败，O 分派 R 子代理产出 RootCauseReport，经 V 复审和 G 门禁后再由 S-fix 返工，不直接跳过失败。

- [ ] **步骤 6：回填计划收尾记录**

  在本计划末尾记录实际提交、每个验证命令的真实结果、迁移过的 fixture、平台环境和剩余 blocker。只有所有必需命令成功且 V/G 通过后，才将状态写为完成。

## 3. 验收矩阵

| 风险 | 必须观察到的结果 | 主要验证 |
| --- | --- | --- |
| 短 SHA/abbrev 不确定 | Git 范围正确，正文跨配置字节一致 | review-package CLI 测试 |
| M07 时间戳伪造 | 回填旧 `lastUpdated` 不能放行缺 evidence | gate-test-evidence + CLI |
| R10 时间戳伪造 | 回填旧 `timestamp` 不能放行缺 revertEvidence | run-log-logic + CLI |
| 空白 command | Schema/逻辑均阻断 | Schema + gate test |
| rawOutput symlink | 外部/内部 link 均拒绝 | safe path + M07 test |
| tickets 路径逃逸 | exit 2，且读取前失败 | check-artifact-gate CLI |
| S18 token overlap | 未定义 owner/member 必须失败 | gate-ticket-content |
| review-package 写入 | 原子替换，失败保留旧文件 | review-package CLI |
| pre-commit staged 语义 | 只以 index 内容判定 | pre-commit hook test |
| 负向 coverage 假绿 | 45 个门禁一一登记并真实 exit 2 | samples coverage |
| AGENTS substring 漏检 | 只有 §8 精确表格行算覆盖 | docs-consistency |
| 测试 README 漏登 | 磁盘测试集合与表格集合相等 | docs-consistency |
| pollution locale 漂移 | 非 ASCII 排序跨 locale 一致 | pollution CLI test |
| Windows hook 失败 | 无 `exit127`/`EBUSY`，不允许 skip | platform/docs tests |

## 4. 计划自检

1. **覆盖度：** 任务 1 固定全部回归契约；任务 2–3 覆盖证据、路径和 S18；任务 4 覆盖 review-package；任务 5 覆盖 staged hook 与 Windows；任务 6–7 覆盖负向门禁、文档、测试矩阵和排序；任务 8 覆盖全量收口、V/G 复审和执行记录。
2. **安全边界：** 所有外部路径先做词法检查，再做 `lstat`/`realpath`/containment；所有输出写入先预校验，再同目录原子替换；所有历史兼容不再由 mutable timestamp 推断。
3. **测试边界：** 每个任务先写失败测试，再实现最小修复，再运行任务级测试；完整 Vitest 和 pre-push 只在收口阶段独占运行。
4. **历史边界：** 不改历史 changelog、归档、历史计划和规格；活体契约、fixture、测试矩阵和用户指南必须与严格新行为一致。
5. **执行边界：** O 只编排、读写状态和运行只读门禁；实现、调试、修复和验证由子代理承担，失败链严格经过 R→V→G→S-fix。
