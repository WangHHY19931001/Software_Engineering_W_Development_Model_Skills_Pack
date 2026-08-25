# W-Model Reliability Optimization 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按已批准的 A-D 方案，补齐 W-Model 技能包在状态写入、运行时门禁、文档契约和长期维护方面的可靠性保证，同时保持既有退出码、JSON 输出协议和 W-Model 编排边界稳定。

**架构：** 交付分为四个有依赖关系的批次。批次 A 先把状态写入收敛为跨进程锁保护的事务，并明确 CLI 锁控制；批次 B 在此基础上为 gate log 与状态目标建立 Schema/原子写入边界，并让文档计数和同步子进程失败时 fail-closed；批次 C 修正 SSoT 架构边界和可执行 Verifier Persona 样本；批次 D 建立脚本层单向依赖、自然退出、可验证证据导出和动态计数分层。每个任务采用红—绿—重构的 TDD 循环，定向测试通过后再进入下一任务。

**技术栈：** Node.js 20+、TypeScript ESM、Vitest、Ajv draft-07、Node `fs/promises`/`crypto`/`child_process`、JSON/JSONL、Git Bash、TLA+/BDD 既有门禁脚本、SHA-256 manifest。

---

## 输入规格与执行边界

- 已批准设计：`docs/superpowers/specs/2026-08-19-all-findings-remediation-design.md`
- 已批准批次计划：`docs/superpowers/plans/2026-08-19-remediation-batch-a-state-and-supply-chain.md`、`2026-08-19-remediation-batch-b-gates-and-evidence.md`、`2026-08-19-remediation-batch-c-docs-and-examples.md`、`2026-08-19-remediation-batch-d-architecture-and-maintenance.md`
- 本计划只覆盖批准方案的 A1-A2、B1-B4、C1-C2、D1-D4。A3-A4、B5、C3-C4、D5 不属于本计划交付面。
- 执行前必须处于隔离 worktree；每项代码/测试修改前，若项目已提供 `.codegraph/` 索引，先查询受影响符号并将结果落盘 `.w-model/codegraph-queries/`。当前工作树没有 `.codegraph/` 索引，实施者应记录等价的 import/调用图分析结果后再改代码。
- 每个任务独立提交；不得把状态写、门禁、文档和架构重构混入同一提交。
- 编排者只负责调度、状态记录和读取测试结果；实现、测试、调试和修复由受分派的实现子代理完成。

## 文件清单与职责

### 批次 A：状态写入

- 修改：`w-model-dev/scripts/logic/state-write-logic.ts`，提供跨进程锁、锁内 mtime 校验、原子写入、回读验证、备份和恢复。
- 修改：`w-model-dev/scripts/cli/wm-write.ts`，暴露锁超时与陈旧锁恢复参数，保持 `WMWRITE_JSON` 协议。
- 修改/创建：`w-model-dev/scripts/__tests__/state-write-logic.test.ts`、`w-model-dev/scripts/__tests__/wm-write.test.ts`，覆盖竞争、锁释放、回滚和 CLI 退出语义。

### 批次 B：门禁与运行时证据

- 创建：`w-model-dev/schemas/gate-log.schema.json`，定义 gate log draft-07 契约。
- 创建：`w-model-dev/scripts/lib/state-schema-registry.ts`，集中声明状态目标到 Schema 的映射。
- 修改：`w-model-dev/scripts/lib/gate-log-writer.ts`，执行 Schema 校验和 append-only 原子写入。
- 修改：`w-model-dev/scripts/logic/state-write-logic.ts`、`w-model-dev/scripts/cli/wm-write.ts`，接入注册表、JSONL 行校验和未注册目标拒绝。
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`w-model-dev/scripts/cli/check-docs-consistency.ts`，使动态计数和 SSoT 链接检查 fail-closed。
- 创建：`w-model-dev/scripts/lib/run-sync.ts`，集中同步子进程 timeout、编码、缓冲和 kill signal。
- 修改：`w-model-dev/scripts/lib/artifact-gate-assets.ts` 及其调用方和测试，统一使用同步执行 helper。
- 修改/创建：`w-model-dev/scripts/__tests__/gate-log-writer.test.ts`、`schema-validation.test.ts`、`docs-consistency-logic.test.ts`、`state-write-logic.test.ts`、`wm-write.test.ts`、`gate-report.test.ts`、`metrics-report.test.ts`、`wm-status.test.ts`、`artifact-gate-assets.test.ts`。

### 批次 C：文档与可执行示例

- 修改：`docs/skill-design-document_SSoT.md`，修复三条内链并重画技能包/宿主 Agent/外部工具边界。
- 修改：`w-model-dev/references/agent-personas.md`，以 fixture 链接和字段说明取代失效的完整 JSON 内嵌样例。
- 创建：`w-model-dev/scripts/samples/verifier/persona-code-reviewer.json`、`persona-test-engineer.json`、`persona-security-auditor.json`、`persona-performance-auditor.json`，提供真实可通过的四类 Verifier 输出。
- 修改：`w-model-dev/scripts/self-test.ts`、`w-model-dev/scripts/samples/README.md`，注册并声明四个样本。
- 修改/创建：`w-model-dev/scripts/__tests__/verifier-logic.test.ts`、`docs-consistency-logic.test.ts`，回归验证 fixture 和文档契约。

### 批次 D：架构与维护

- 创建/迁移：`w-model-dev/scripts/infrastructure/schema-loader.ts`、`w-model-dev/scripts/infrastructure/schema-fs.ts`，承载 Schema 与文件系统基础设施。
- 创建：`w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`，检查层级依赖和循环。
- 修改：`w-model-dev/scripts/lib/load-and-validate.ts`、`artifact-gate-assets.ts`、`uat-path-mapping.ts` 及所有原 `logic/schema-loader` 导入点，建立单向依赖。
- 修改：`w-model-dev/scripts/lib/gate-report.ts`、21 个使用默认 gate report 输出的 CLI 及相关测试，去除报告 helper 的直接进程终止。
- 创建：`w-model-dev/schemas/evidence-manifest.schema.json`、`w-model-dev/scripts/logic/evidence-export-logic.ts`、`w-model-dev/scripts/cli/wm-export-evidence.ts`、`w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`，实现脱敏、哈希和验证。
- 修改：`package.json`、`w-model-dev/scripts/self-test.ts`、`w-model-dev/scripts/samples/README.md`，登记证据导出命令和样本。
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`w-model-dev/scripts/cli/check-docs-consistency.ts`、`README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md`、`w-model-dev/SKILL.md`、`w-model-dev/references/command-reference.md`，分离静态违规与动态测量并说明本地生成物。

---

## 实施顺序

1. A1 建立锁保护状态事务。
2. A2 在 CLI 层暴露并验证锁控制。
3. B1 建立 gate log Schema 与原子 append-only 写入。
4. B2 将状态目标注册表接入锁内 Schema 校验。
5. B3 让 docs-consistency 的证据缺失 fail-closed，并注入 SSoT 链接输入。
6. B4 统一同步子进程 timeout。
7. C1 修复 SSoT 链接和三边界架构叙述。
8. C2 建立四个真实 Verifier Persona fixture 并替换文档内嵌样例。
9. D1 建立脚本层单向依赖。
10. D2 统一 gate CLI 的自然退出。
11. D3 增加可验证的脱敏证据导出。
12. D4 收敛动态计数报告并补充本地生成物说明。

## 任务 A1：锁保护的状态事务

**目标：** 使 `writeStateJson` 在跨进程锁内完成从当前 mtime 检查到临时文件替换、回读和失败恢复的完整事务，杜绝两个 writer 同时成功或回滚覆盖其他 writer 的结果。

**文件：**
- 修改：`w-model-dev/scripts/logic/state-write-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/state-write-logic.test.ts`

- [ ] **步骤 1：编写失败测试。** 为两个 writer 使用相同 `expectMtimeMs` 和协调 barrier；断言只有一个返回 `ok=true`，另一个返回 `LOCK_TIMEOUT` 或 `MTIME_CONFLICT`，最终目标文件等于成功 payload。增加同毫秒备份名不冲突、token 不匹配不能释放锁、回读失败期间第二 writer 不被覆盖的用例。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
  ```
  预期：竞争写测试失败，因为当前 mtime 乐观检查没有跨进程排他临界区。
- [ ] **步骤 3：定义锁与失败原因。** 在 `state-write-logic.ts` 增加 `StateLockMetadata`、`StateWriteReason`，包含 `LOCK_TIMEOUT`、`STALE_LOCK`、`WRITE_VERIFY_FAILED`；在 `StateWriteOptions` 中加入 `lockTimeoutMs`、`staleLockTtlMs`、`recoverStaleLock` 和测试 hooks，并保持既有调用方默认值兼容。
- [ ] **步骤 4：实现原子创建和 token 释放。** 用 `fs.writeFile(lockPath, metadata, { flag: 'wx' })` 创建 `<target>.lock`；冲突时读取 PID/token/创建时间并按 timeout 轮询；仅满足陈旧锁策略时将旧锁 rename 为带时间和 UUID 的 stale 名后重试；释放前读取并比较 token，token 不匹配时保留锁。
- [ ] **步骤 5：将整个写流程置于锁内。** 在 `try/finally` 中依次执行 stat/mtime、Schema 前置校验、唯一备份、tmp+rename、回读比较和恢复；删除“读到其他合法 JSON 即视为本次成功”的分支。恢复只允许在仍持有 token 且目标内容仍是本次 payload 时执行。
- [ ] **步骤 6：实现唯一备份和原子恢复。** 将备份名改为毫秒时间戳加 UUID；恢复先写 `restorePath.tmp-<uuid>`，再通过 `renameWithRetry` 替换目标；无目标文件时的清理必须同时受锁 token 和内容检查保护。
- [ ] **步骤 7：运行定向测试确认通过。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
  ```
  预期：竞争、陈旧锁、锁超时、唯一备份、原子恢复和残留清理用例全部通过。
- [ ] **步骤 8：运行回归测试。**
  ```bash
  npm test
  npm run typecheck
  ```
  预期：既有状态写入、Schema 和 TypeScript 检查全部通过。
- [ ] **步骤 9：提交任务。**
  ```bash
  git add w-model-dev/scripts/logic/state-write-logic.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
  git commit -m "fix(state): serialize wm-write transactions"
  ```

## 任务 A2：更新 wm-write CLI 契约

**目标：** 将锁超时和陈旧锁恢复能力安全暴露给 CLI，确保锁失败有稳定的结构化输出和退出码。

**文件：**
- 修改：`w-model-dev/scripts/cli/wm-write.ts`
- 测试：`w-model-dev/scripts/__tests__/wm-write.test.ts`

- [ ] **步骤 1：编写失败测试。** 以两个 CLI 子进程或测试 hooks 制造锁竞争，断言 stdout 含 `WMWRITE_JSON {"ok":false,"reason":"LOCK_TIMEOUT"}` 且进程退出码为 1；另测 `--recover-stale-lock` 在没有锁时不改变正常写入结果。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-write.test.ts
  ```
  预期：参数解析和 `LOCK_TIMEOUT` JSON 契约测试失败。
- [ ] **步骤 3：实现参数和错误消息。** 增加 `--lock-timeout <ms>`、`--recover-stale-lock`，严格接受安全的非负整数；为 `LOCK_TIMEOUT`、`STALE_LOCK` 增加稳定人类消息；更新 usage、JSDoc 和 stdout summary，并仅在有值时暴露 `backupPath`、`lockPath`。
- [ ] **步骤 4：验证边界输入。** 定向测试负数、小数、非数字、超出安全整数的参数均退出 2 并输出输入错误；正常写入、锁超时和陈旧锁恢复分别保持 0、1、1 的退出约定。
- [ ] **步骤 5：运行定向测试确认通过并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-write.test.ts
  npm run typecheck
  git add w-model-dev/scripts/cli/wm-write.ts w-model-dev/scripts/__tests__/wm-write.test.ts
  git commit -m "feat(state): expose wm-write lock controls"
  ```

## 任务 B1：gate log Schema 与原子追加

**目标：** 让每条 gate log 在写入前通过严格 Schema，并以 append-only 的原子文件替换落盘；所有 I/O 失败都必须可见。

**文件：**
- 创建：`w-model-dev/schemas/gate-log.schema.json`
- 修改：`w-model-dev/scripts/lib/gate-log-writer.ts`
- 测试：`w-model-dev/scripts/__tests__/gate-log-writer.test.ts`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **步骤 1：编写失败测试。** 覆盖合法 payload、缺少 `script`、非法 `exitCode`、不可写目录、同毫秒双写文件名唯一和写后无 tmp 残留；断言失败返回结构化 `{ ok:false, error }`，不返回 `undefined` 或静默成功。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
  ```
  预期：当前 writer 无 gate-log Schema 且吞掉写异常，因此新增用例失败。
- [ ] **步骤 3：定义 Schema。** 创建 draft-07 Schema，设置 `additionalProperties:false`，定义非空 `script`、`exitCode` 仅为 0/1/2、`passed` 布尔值、`reasons` 字符串数组和 `reportSummary` 对象；三个现有调用方所需可选字段逐一声明并写 description。
- [ ] **步骤 4：实现原子 writer。** 将返回类型固定为 `GateLogWriteResult = { ok:true; path:string } | { ok:false; error:string }`；先调用 `validateBySchema('gate-log', payload)`，再用 timestamp+`randomUUID()` 命名临时文件并 rename 到最终文件；更新 BDD、iceberg、preventive 调用方，把写失败写入报告摘要供 G/O 追踪。
- [ ] **步骤 5：运行定向和回归测试并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
  npm test
  npm run typecheck
  git add w-model-dev/schemas/gate-log.schema.json w-model-dev/scripts/lib/gate-log-writer.ts w-model-dev/scripts/__tests__/gate-log-writer.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
  git commit -m "feat(gate): validate and atomically persist gate logs"
  ```

## 任务 B2：状态目标 Schema 注册与写时校验

**目标：** 将 `.w-model` 状态目标映射到唯一 Schema 注册表，确保合法 JSON 不等于合法状态，且未注册目标不会绕过校验。

**文件：**
- 创建：`w-model-dev/scripts/lib/state-schema-registry.ts`
- 修改：`w-model-dev/scripts/logic/state-write-logic.ts`、`w-model-dev/scripts/cli/wm-write.ts`
- 测试：`w-model-dev/scripts/__tests__/state-write-logic.test.ts`、`w-model-dev/scripts/__tests__/wm-write.test.ts`、`w-model-dev/scripts/__tests__/schema-validation.test.ts`

- [ ] **步骤 1：编写失败测试。** 对 `project.json` 增加非法字段并断言 `SCHEMA_INVALID`；合法 project fixture 通过；未注册 `.w-model/custom.json` 返回 `UNREGISTERED_TARGET`；`--allow-untyped` 产生显式允许标记；JSONL `run-log.jsonl` 中任一非法行报告准确行号。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
  ```
  预期：当前实现只检查 JSON 可解析性，Schema、注册表和 JSONL 行号断言失败。
- [ ] **步骤 3：实现注册表接口。** 在 `state-schema-registry.ts` 导出 `RegisteredStateFormat`、`RegisteredStateSchema`、`resolveStateSchema(absPath, projectRoot)`；注册 `project.json`、`rtm.json`、`budget.json`、`maturity.json`、`run-log.jsonl` 及当前存在运行契约的状态文件，区分 JSON 与 JSONL。
- [ ] **步骤 4：接入锁内校验。** 在 A1 的锁临界区调用注册表和 `validateBySchema`，加入 `SCHEMA_INVALID`、`UNREGISTERED_TARGET`；JSONL 按行解析、按行 Schema 校验并把行号放入错误；`--allow-untyped` 只允许明确的非生产临时目标并输出记录。
- [ ] **步骤 5：处置无运行时消费者的 Schema。** 对 `checkpoint-log`、`event-ingress`、`hill-climbing-report`、`project` 逐一确认 CLI 读写入口；有入口的接入注册表，无入口的移除未消费 Schema、同步 Schema 清单和样本，保持门禁与实际运行契约一致。
- [ ] **步骤 6：运行定向测试、回归测试并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts
  npm test
  npm run typecheck
  git add w-model-dev/scripts/lib/state-schema-registry.ts w-model-dev/scripts/logic/state-write-logic.ts w-model-dev/scripts/cli/wm-write.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/schemas
  git commit -m "feat(state): validate registered state payloads before commit"
  ```

## 任务 B3：docs-consistency 计数 fail-closed 与 SSoT 链接输入

**目标：** 当 Vitest 计数无法采集或 SSoT 内链断裂时让 docs-consistency 明确失败，禁止未知证据以默认通过表示。

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`
- 修改：`w-model-dev/scripts/cli/check-docs-consistency.ts`
- 测试：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 1：编写失败测试。** 断言 `vitestTestCount=-1` 生成 `[vitest-tests]` violation；向 `linkDocs` 注入 SSoT fixture 后，三条断链生成 `[internal-link]` violation；有效实测值 725 且链接完整时没有对应 violation。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  ```
  预期：当前负数计数被跳过，且 CLI 未将 SSoT 传入 `linkDocs`，新增断言失败。
- [ ] **步骤 3：实现 fail-closed 计数。** 将 `DocConsistencyInput.vitestTestCount` 约束为非负实测值；`checkVitestTestCount` 对负数生成 violation；保留 `WM_VITEST_COUNT_FILE` 快速路径，但普通运行的 spawn 失败必须返回 exit 1，并在报告中说明采集失败。
- [ ] **步骤 4：注入 SSoT 链接输入。** 在 CLI 的 `linkDocs` 加入 `{ name:'docs/skill-design-document_SSoT.md', baseDir:'docs' }`，保持现有相对路径解析规则，让 C1 负责修复实际三条链接。
- [ ] **步骤 5：运行定向测试确认通过。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  ```
  预期：逻辑测试通过；在 C1 完成前，真实仓库命令允许因已知 SSoT 断链 exit 1，实施者必须记录该跨任务依赖而不能伪造放行。
- [ ] **步骤 6：提交任务。**
  ```bash
  git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-docs-consistency.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  git commit -m "fix(gate): fail closed when document test evidence is unavailable"
  ```

## 任务 B4：同步子进程 timeout 帮助器

**目标：** 为报告、状态、指标和工件门调用的同步子进程设置统一的进程级 timeout，防止门禁永久等待。

**文件：**
- 创建：`w-model-dev/scripts/lib/run-sync.ts`
- 修改：`w-model-dev/scripts/lib/artifact-gate-assets.ts` 及所有直接使用 `spawnSync` 的报告/状态调用方
- 测试：`w-model-dev/scripts/__tests__/gate-report.test.ts`、`metrics-report.test.ts`、`wm-status.test.ts`、`artifact-gate-assets.test.ts`

- [ ] **步骤 1：编写失败测试。** spy `spawnSync`，断言调用传递 `timeout`、`killSignal:'SIGKILL'`、`encoding:'utf-8'` 和足够的 `maxBuffer`；逐个调用点断言使用 helper 或传递等价安全选项。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/__tests__/metrics-report.test.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts
  ```
  预期：helper 不存在或已有调用点缺少 timeout，断言失败。
- [ ] **步骤 3：实现 helper。** 导出 `DEFAULT_SYNC_TIMEOUT_MS = 15_000` 和 `runSync(command, args, options = {})`；默认合并 timeout、kill signal、编码和 maxBuffer，允许 TLA 调用显式覆盖更长 timeout；超时、非零退出和 signal 保留在返回对象中供上层报告。
- [ ] **步骤 4：迁移并验证调用点。** 替换真实报告、状态、指标、artifact-gate 的同步子进程调用；不改变已有 stdout/stderr 解析或退出码映射。
- [ ] **步骤 5：运行定向、全量测试和类型检查。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/__tests__/metrics-report.test.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts
  npm test
  npm run typecheck
  git add w-model-dev/scripts/lib/run-sync.ts w-model-dev/scripts/lib/artifact-gate-assets.ts w-model-dev/scripts/__tests__/gate-report.test.ts w-model-dev/scripts/__tests__/metrics-report.test.ts w-model-dev/scripts/__tests__/wm-status.test.ts w-model-dev/scripts/__tests__/artifact-gate-assets.test.ts
  git commit -m "fix(test): bound synchronous child process execution"
  ```

## 任务 C1：修复 SSoT 内链并重画架构边界

**目标：** 使 SSoT 的三条内部链接可解析，并明确技能包、宿主 Agent/外部 LLM 能力和可选外部工具的边界。

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`
- 测试：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 1：编写失败测试。** 使用 B3 已注入的 SSoT linkDocs，构造真实仓库链接检查；断言 `../CHANGELOG.md`、`../CHANGELOG-archive.md`、`./changes/decision-log/README.md` 均存在且无 `internal-link` violation。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  npm run check:docs-consistency
  ```
  预期：现有 SSoT 的三个 `../../` 路径解析失败。
- [ ] **步骤 3：修正内链。** 在 SSoT 以 `docs/` 为 baseDir 的章节将三个目标改为 `../CHANGELOG.md`、`../CHANGELOG-archive.md`、`./changes/decision-log/README.md`；不移动根文档，不创建冗余副本。
- [ ] **步骤 4：更新架构图和叙述。** 使用 Mermaid 三边界图表达 `SkillPackage`、`HostAgent`、`ExternalTools`；明确技能包不含 LLM SDK、模型调用、业务 `src/` 或编程式 AI 引擎，Verifier 是宿主 Agent 能力，TLA+/CodeGraph/OpenSpec 是外部工具。
- [ ] **步骤 5：运行定向和文档门禁并提交。**
  ```bash
  npm run check:docs-consistency
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  git add docs/skill-design-document_SSoT.md w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  git commit -m "fix(docs): align SSoT links and external agent boundary"
  ```

## 任务 C2：用真实 Verifier fixture 替换 Persona JSON 样例

**目标：** 为四个 Persona 提供符合当前 `verifier-output.schema.json` 和 `check-verifier-output` 规则的可执行样本，并让文档指向这些样本。

**文件：**
- 创建：`w-model-dev/scripts/samples/verifier/persona-code-reviewer.json`
- 创建：`w-model-dev/scripts/samples/verifier/persona-test-engineer.json`
- 创建：`w-model-dev/scripts/samples/verifier/persona-security-auditor.json`
- 创建：`w-model-dev/scripts/samples/verifier/persona-performance-auditor.json`
- 修改：`w-model-dev/references/agent-personas.md`、`w-model-dev/scripts/self-test.ts`、`w-model-dev/scripts/samples/README.md`
- 测试：`w-model-dev/scripts/__tests__/verifier-logic.test.ts`

- [ ] **步骤 1：编写失败测试。** 测试按四个固定路径读取文件并执行 `checkVerifierOutput`；在 fixture 不存在时断言失败，并记录当前文档内嵌 JSON 不能作为独立可验证输入的迁移动机。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
  ```
  预期：四个固定路径不存在，测试失败。
- [ ] **步骤 3：创建四个最小完整 fixture。** 每个 JSON 使用 `schemaVersion`、完整 `meta`、合法 subCriterion 权重和分数、三项 rawScores、实际 variance、`path:Lline` 或 `path:§section` evidence、满足公式的 composite score、至少 50 字符且包含关键决策/结构/遗留风险的 summary。`targetKind` 使用单一合法值；`passed=true` 时 `reworkHints` 为空或不含阻断性提示；performance 的 mode/scorecard 作为文档叙述，不写入 VerifierOutput 根对象。
- [ ] **步骤 4：替换 Markdown 内嵌样例。** 四个 Persona 章节保留字段和使用说明，改为链接到对应 fixture，并说明该样本由 `check-verifier-output` 回归验证；移除完整 JSON 片段，避免文档样例与 Schema 漂移。
- [ ] **步骤 5：注册样本和测试。** 在 `self-test.ts` 注册四个有效样本，在 `samples/README.md` 的覆盖矩阵声明四个路径；测试逐个断言 `passed=true`、`reasons=[]`。
- [ ] **步骤 6：运行 CLI、定向和全量测试并提交。**
  ```bash
  for f in w-model-dev/scripts/samples/verifier/persona-*.json; do
    npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "$f" --json || exit 1
  done
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
  npm run self-test
  npm test
  npm run check:samples-coverage
  git add w-model-dev/references/agent-personas.md w-model-dev/scripts/samples/verifier w-model-dev/scripts/samples/README.md w-model-dev/scripts/self-test.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts
  git commit -m "fix(persona): replace stale verifier JSON examples"
  ```

## 任务 D1：建立单向脚本层依赖

**目标：** 将 Schema/文件系统基础设施从领域逻辑层分离，消除 `lib → logic` 运行时反向依赖和循环风险。

**文件：**
- 创建：`w-model-dev/scripts/infrastructure/schema-loader.ts`、`w-model-dev/scripts/infrastructure/schema-fs.ts`
- 修改：`w-model-dev/scripts/lib/load-and-validate.ts`、`artifact-gate-assets.ts`、`uat-path-mapping.ts`、所有原 `logic/schema-loader` 导入点及 TypeDoc 入口
- 测试：`w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`

- [ ] **步骤 1：编写失败测试。** 递归读取 `scripts/{lib,logic,infrastructure,cli}` 的相对 import，构建边表；断言不存在 `lib → logic` 运行时边、不存在循环，且 `logic` 不直接导入 `node:fs`/`node:child_process`。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts
  ```
  预期：当前 `lib → logic/schema-loader`、`lib → logic/gate-logic` 或 `lib → logic/design-contract-logic` 导致失败。
- [ ] **步骤 3：迁移基础设施。** 将 `schema-loader.ts`、`schema-fs.ts` 移入 `infrastructure`；更新 ESM `.js` import，保留一个短期兼容 re-export 仅用于迁移阶段，并在本任务完成前删除该 re-export。
- [ ] **步骤 4：收敛领域依赖。** 将 `artifact-gate-assets`、`uat-path-mapping` 中的领域计算移入 `logic` 或明确的 application service，使 lib 只依赖基础设施和纯数据接口；同步 CLI、测试、自测和 `package.json` 的 docs 入口。
- [ ] **步骤 5：运行定向、全量、类型和文档构建并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts
  npm test
  npm run typecheck
  npm run docs:build
  git add w-model-dev/scripts package.json
  git commit -m "refactor(scripts): enforce one-way infrastructure dependencies"
  ```

## 任务 D2：统一 CLI 自然退出

**目标：** 让 gate report helper 只负责输出，所有 CLI 显式设置 `process.exitCode`，保持现有 0/1/2 和 JSON 前缀协议。

**文件：**
- 修改：`w-model-dev/scripts/lib/gate-report.ts`
- 修改：调用默认 gate report 输出的 21 个 `w-model-dev/scripts/cli/*.ts`
- 测试：`w-model-dev/scripts/__tests__/gate-report.test.ts` 及受影响 CLI 测试

- [ ] **步骤 1：编写失败测试。** 为 `printGateReport` 注入 exit spy，断言函数不调用 `process.exit` 而返回 summary；以 CLI 子进程分别执行默认模式和 `--json` 模式，断言已有 `*_JSON` 前缀、字段和 shell 观察到的退出码 0/1/2 不变。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts
  ```
  预期：当前 helper 直接调用 `process.exit(exitCode)`，exit spy 断言失败。
- [ ] **步骤 3：实现纯报告函数。** 让 `printGateReport` 只写 stdout/stderr 并返回 summary；每个 CLI 在调用后显式设置 `process.exitCode = exitCode` 并自然 return；保留 `exitWithError` 和 `runMain` 的输入错误策略，不改变 JSON 字段、前缀和退出码。
- [ ] **步骤 4：迁移 21 个调用点。** 使用清单逐个替换成功、校验失败和输入错误路径；测试一个通过、一个违规、一个参数错误和一个 JSON 输出场景，确认没有遗漏直接 `process.exit`。
- [ ] **步骤 5：运行定向、全量和类型测试并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-report.test.ts
  npm test
  npm run typecheck
  git add w-model-dev/scripts/lib/gate-report.ts w-model-dev/scripts/cli w-model-dev/scripts/__tests__
  git commit -m "refactor(cli): use natural process exit for gate reports"
  ```

## 任务 D3：显式导出可验证审计证据

**目标：** 从 `.w-model` 白名单目录导出脱敏证据，生成带 SHA-256 的 manifest，并提供篡改可检测的 verify 模式。

**文件：**
- 创建：`w-model-dev/schemas/evidence-manifest.schema.json`
- 创建：`w-model-dev/scripts/logic/evidence-export-logic.ts`
- 创建：`w-model-dev/scripts/cli/wm-export-evidence.ts`
- 测试：`w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`
- 修改：`package.json`、`w-model-dev/scripts/self-test.ts`、`w-model-dev/scripts/samples/README.md`

- [ ] **步骤 1：编写失败测试。** 创建临时项目 `.w-model`，放入 gate log、Verifier 输出、run-log 和带绝对路径/敏感键的 JSON；断言导出 manifest、每项 SHA-256、相对化路径、默认移除 `token`/`secret`/`password`/`apiKey`，篡改导出文件后 verify 失败。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
  ```
  预期：导出逻辑、Schema 和 CLI 尚不存在，测试失败。
- [ ] **步骤 3：定义 manifest Schema。** 创建 draft-07 Schema，要求 `schemaVersion`、ISO `exportedAt`、脱敏或相对化 `sourceProject` 和 `files`；每项要求 `path`、64 位小写 `sha256` 和受控 `kind`，禁止额外字段。
- [ ] **步骤 4：实现白名单导出和安全边界。** 只允许 `gate-logs`、`verifier-outputs`、`signature-chains`、`codegraph-queries`、`run-log`；JSON 递归脱敏，非 JSON 仅复制白名单文本；拒绝源路径逃逸、输出目录位于源 `.w-model` 内和符号链接逃逸；写临时文件后原子 rename。
- [ ] **步骤 5：实现 CLI 与 verify。** 提供 `npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts <project-dir> <output-dir>` 和 `--verify <manifest>`；输出 `EVIDENCE_EXPORT_JSON`，遵守 0/1/2 退出码，并注册 `wm:export-evidence` package script。
- [ ] **步骤 6：运行定向、回归、类型测试并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
  npm test
  npm run typecheck
  git add w-model-dev/schemas/evidence-manifest.schema.json w-model-dev/scripts/logic/evidence-export-logic.ts w-model-dev/scripts/cli/wm-export-evidence.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts package.json w-model-dev/scripts/self-test.ts w-model-dev/scripts/samples/README.md
  git commit -m "feat(evidence): export sanitized verifiable runtime records"
  ```

## 任务 D4：收敛动态计数与本地生成物说明

**目标：** 将 docs-consistency 的静态违规和动态测量分层输出，并让用户文档清楚区分本地忽略生成物、受控归档和证据导出责任。

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`w-model-dev/scripts/cli/check-docs-consistency.ts`
- 修改：`README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`docs/INSTALL.md`、`w-model-dev/SKILL.md`、`w-model-dev/references/command-reference.md`
- 测试：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **步骤 1：编写失败测试。** 断言报告将静态规范和动态统计分为 `staticViolations` 与 `dynamicMeasurements`；断言 README/AGENTS 明确 `.w-model`、`.zcode`、`coverage` 是本地忽略生成物，`docs/changes/archive` 是受控跟踪归档。
- [ ] **步骤 2：运行定向测试确认失败。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  ```
  预期：当前报告未分层，权威文档没有完整的本地生成物和证据导出说明。
- [ ] **步骤 3：实现分层报告。** 保留兼容总报告，同时增加：
  ```json
  {
    "staticViolations": [],
    "dynamicMeasurements": {
      "schemaCount": 0,
      "testFileCount": 0,
      "vitestTestCount": 0
    }
  }
  ```
  动态值必须来自单一采集结果；静态违规不能因动态采集失败而被默认为通过。
- [ ] **步骤 4：收敛文档数字和本地生成物说明。** 仅在权威文档保留门禁需要的动态数字，删除无消费者的重复计数；保留被门禁解析的声明并让 gate 从单一来源读取；说明 `.w-model` 默认不跟踪，交付证据时运行 `wm:export-evidence`，并说明脱敏复核责任、`coverage`/`.zcode` 的本地性以及 `docs/changes/archive` 的受控归档属性。
- [ ] **步骤 5：运行定向、全量和最终门禁并提交。**
  ```bash
  npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
  npm test
  npm run typecheck
  npm run check:docs-consistency
  npm run check:gate -- --validate-templates
  npm run prepush
  git add w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/cli/check-docs-consistency.ts README.md AGENTS.md CONTRIBUTING.md docs/INSTALL.md w-model-dev/SKILL.md w-model-dev/references/command-reference.md
  git commit -m "docs: document local artifacts and evidence export"
  ```

---

## 最终验收

计划执行完成后，在实现 worktree 的依赖和工具环境已准备好的前提下，按以下顺序运行：

1. 定向核心回归：
   ```bash
   npx vitest run --config config/vitest.config.ts \
     w-model-dev/scripts/__tests__/state-write-logic.test.ts \
     w-model-dev/scripts/__tests__/wm-write.test.ts \
     w-model-dev/scripts/__tests__/gate-log-writer.test.ts \
     w-model-dev/scripts/__tests__/schema-validation.test.ts \
     w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts \
     w-model-dev/scripts/__tests__/verifier-logic.test.ts \
     w-model-dev/scripts/__tests__/dependency-boundaries.test.ts \
     w-model-dev/scripts/__tests__/gate-report.test.ts \
     w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
   ```
2. 样本和仓库回归：
   ```bash
   npm run self-test
   npm test
   npm run typecheck
   npm run check:samples-coverage
   npm run check:docs-consistency
   npm run check:gate -- --validate-templates
   npm run docs:build
   npm run prepush
   ```
3. 直接行为验收：
   - 两个相同 mtime 的并发 writer 只有一个成功，失败方返回 `LOCK_TIMEOUT` 或 `MTIME_CONFLICT`，目标内容和备份均可追溯，目录无 tmp/lock 残留。
   - gate log、状态 JSON 和 JSONL 均按注册 Schema 校验；非法 payload、未注册目标、缺失 Vitest 计数和断链均 fail-closed。
   - 同步子进程具备默认 timeout、kill signal、编码和缓冲上限；gate CLI 默认与 JSON 模式的输出协议和 0/1/2 退出码保持兼容。
   - SSoT 三条链接解析成功，架构图不再把外部 Agent/LLM 画作技能包内置引擎；四个 Persona fixture 均由 Verifier CLI 通过。
   - 依赖边界测试无 `lib → logic` 运行时边和循环；证据导出只处理白名单、默认脱敏、manifest 哈希可验证，篡改后 verify 失败。
   - docs-consistency 将静态违规与动态测量分开，文档明确 `.w-model`、`.zcode`、`coverage` 和 `docs/changes/archive` 的交付边界。
4. 每个任务完成后确认 `git status --short` 只包含当前任务文件；最终确认实现提交完成后工作树干净，且本计划和进度账本之外没有额外文件变更。

本计划文件本身只记录实施步骤，不在当前计划准备阶段运行上述测试、依赖安装、配置修改或生产代码变更命令。
