# 批次 A：状态并发与供应链边界实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 使 `wm-write` 提供真实的跨进程排他写入，并从 pre-push 移除自动联网补装和配置路径绕过。

**架构：** 状态写入用原子 lock-file 实现临界区，锁内完成 mtime、Schema、备份、替换、回读与恢复；pre-push 仅检查平台依赖，显式安装脚本才可联网。所有 hook 相关路径变更都触发门禁。

**技术栈：** Node `fs/promises`、UUID、Vitest、Git Bash、npm lockfile v3。

---

## 文件结构

- 修改：`w-model-dev/scripts/logic/state-write-logic.ts` — 锁、事务写、原子恢复、唯一备份。
- 修改：`w-model-dev/scripts/cli/wm-write.ts` — 锁冲突/陈旧锁 CLI 契约。
- 修改：`w-model-dev/scripts/__tests__/state-write-logic.test.ts` — 协调式竞争、回滚、备份测试。
- 修改：`.githooks/ensure-platform-deps.sh` — 默认检查、显式 `--install`。
- 修改：`.githooks/pre-push` — 扩大路径触发，仅调用检查模式。
- 修改：`package.json` — 显式平台依赖补装脚本。
- 修改：`README.md`、`docs/INSTALL.md`、`AGENTS.md`、`CHANGELOG.md` — hook/锁语义同步。
- 测试：新增或扩展对应 Vitest/hook 静态测试。

### 任务 A1：锁保护的状态事务

**文件：**
- 修改：`w-model-dev/scripts/logic/state-write-logic.ts:21-188`
- 测试：`w-model-dev/scripts/__tests__/state-write-logic.test.ts`

- [ ] **步骤 1：写失败测试：竞争写不能双成功**

为 `StateWriteOptions` 增加测试专用 `hooks`（如 `afterLockAcquired`、`beforeCommit`），在两个 writer 都携带相同 `expectMtimeMs` 时用 barrier 协调。断言一个结果 `ok=true`，另一个结果 `reason='LOCK_TIMEOUT'` 或 `MTIME_CONFLICT`，最终文件仅等于成功 payload。

- [ ] **步骤 2：运行定向测试确认失败**

运行：
```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
```
预期：FAIL；当前实现允许两个 writer 均 `ok=true`。

- [ ] **步骤 3：定义锁类型和失败原因**

在 `state-write-logic.ts` 定义：
```ts
export interface StateLockMetadata { targetPath: string; pid: number; token: string; createdAt: string; }
export type StateWriteReason = 'INVALID_JSON' | 'MTIME_CONFLICT' | 'TARGET_MISSING_FOR_MTIME' | 'LOCK_TIMEOUT' | 'STALE_LOCK' | 'WRITE_VERIFY_FAILED';
```
扩展 `StateWriteOptions`：`lockTimeoutMs?`、`staleLockTtlMs?`、`recoverStaleLock?` 与仅测试 hooks。

- [ ] **步骤 4：实现排他锁和 token 释放**

实现 `acquireStateLock(absPath, options)`：以 `fs.writeFile(lockPath, content, { flag: 'wx' })` 原子创建 `<target>.lock`；锁冲突时读 JSON 元数据、按 timeout 轮询；仅 TTL 已过且 PID 不存在或 `recoverStaleLock=true` 时将旧锁 rename 为 `<lock>.stale-<timestamp>-<uuid>` 后重试。实现 `releaseStateLock(lockPath, token)`：读取锁内容，token 匹配才 unlink。

- [ ] **步骤 5：把整个状态写流程移入锁临界区**

`writeStateJson` 先 parse，再 acquire lock；在 `try/finally` 内完成 stat/mtime、唯一备份、tmp+rename、回读比较、恢复和 release。删除“读到其他合法 JSON 即本调用成功”的分支；不一致一律视为验证失败。恢复只能在仍持锁且目标内容仍等于本次 payload 时发生。

- [ ] **步骤 6：让备份和恢复保持原子性**

把 `backupPathFor` 改为含毫秒与 UUID，例如 `<abs>.bak.<ISO-sanitized>-<uuid>`。恢复使用 `restorePath.tmp-<uuid>` + `renameWithRetry`，不得直接 `copyFile(backup, target)`；写前不存在时的清理由 token/内容检查保护。

- [ ] **步骤 7：新增回归测试**

增加：同分钟连续备份路径不同；回读失败期间第二 writer 不被覆盖；token 不匹配不释放锁；陈旧锁重命名后恢复；未超时活锁只等待并最终 `LOCK_TIMEOUT`；无 tmp/lock 残留。

- [ ] **步骤 8：运行定向和全量测试**

运行：
```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
npm test
npm run typecheck
```
预期：全部通过。

- [ ] **步骤 9：提交**

```bash
git add w-model-dev/scripts/logic/state-write-logic.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts
git commit -m "fix(state): serialize wm-write transactions"
```

### 任务 A2：更新 wm-write CLI 契约

**文件：**
- 修改：`w-model-dev/scripts/cli/wm-write.ts:8-152`
- 测试：创建 `w-model-dev/scripts/__tests__/wm-write.test.ts` 或扩展现有 CLI 测试

- [ ] **步骤 1：写失败测试**

用两个 CLI 子进程/测试 hook 验证 `LOCK_TIMEOUT` 输出 `WMWRITE_JSON { ok:false, reason:'LOCK_TIMEOUT' }` 并退出 1；验证 `--recover-stale-lock` 缺少锁时不改变正常写入。

- [ ] **步骤 2：运行测试确认失败**

运行新测试文件，预期 FAIL：参数和 reason 尚不存在。

- [ ] **步骤 3：实现 CLI 参数和消息**

加入：
```text
--lock-timeout <ms>
--recover-stale-lock
```
严格校验非负整数；为 `LOCK_TIMEOUT`、`STALE_LOCK` 添加 `REASON_MESSAGES`。更新 usage、JSDoc 与 stdout summary，暴露 `backupPath`、`lockPath`（仅需要时）。

- [ ] **步骤 4：运行测试确认通过并提交**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/wm-write.test.ts
npm run typecheck
git add w-model-dev/scripts/cli/wm-write.ts w-model-dev/scripts/__tests__/wm-write.test.ts
git commit -m "feat(state): expose wm-write lock controls"
```

### 任务 A3：pre-push 只检查、不下载

**文件：**
- 修改：`.githooks/ensure-platform-deps.sh:1-127`
- 修改：`.githooks/pre-push:13-18,96-140`
- 修改：`package.json`
- 测试：创建 `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts` 或 shell fixture 测试

- [ ] **步骤 1：写失败的 shell/static 测试**

测试默认调用 `ensure-platform-deps.sh --check` 缺依赖时 exit 1，stdout 含 `npm run platform-deps:install`；断言 pre-push 对 `config/a.ts`、`scripts/a.cjs`、`package-lock.json` 的模拟 changed-files 进入 gate；断言 pre-push 源码不再调用 `npm install`、`npm pack` 或 `tar`。

- [ ] **步骤 2：运行测试确认失败**

运行对应测试，预期 FAIL：脚本当前会自动补装、路径过滤漏项。

- [ ] **步骤 3：实现检查与显式安装分离**

把参数解析改为：
```text
--check        默认；缺平台依赖 exit 1
--install      显式执行安装，禁止由 pre-push 调用
```
默认不下载。`pre-push` 只调用 `bash .../ensure-platform-deps.sh --check`；删除 node_modules 缺失时的 `npm install`，改为 exit 1 与明确命令提示。

- [ ] **步骤 4：实现显式安装的最小安全约束**

`--install` 必须使用 `npm pack --json` 获取文件名；从 `package-lock.json` 找到匹配 package/version 的 integrity 和 resolved host；拒绝非 allowlist registry；校验包 `package/package.json` 名称/版本。若 SRI 校验工具尚无已声明依赖，使用 Node `crypto.createHash` 实现 `sha512-<base64>` 比对，禁止新增未声明运行依赖。

- [ ] **步骤 5：扩大 needs_gate**

将 `config/*`、`scripts/*`、`package-lock.json` 加入 case。修正 skip 日志，不能再说“配置变更直接放行”。

- [ ] **步骤 6：添加 package script、运行测试和提交**

新增：
```json
"platform-deps:check": "bash .githooks/ensure-platform-deps.sh --check",
"platform-deps:install": "bash .githooks/ensure-platform-deps.sh --install"
```
运行：
```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts
npm run platform-deps:check
npm run prepush
```
提交：
```bash
git add .githooks/ensure-platform-deps.sh .githooks/pre-push package.json w-model-dev/scripts/__tests__/platform-deps-hook.test.ts
git commit -m "fix(hook): remove automatic platform dependency downloads"
```

### 任务 A4：同步状态与 hook 文档

**文件：**
- 修改：`w-model-dev/SKILL.md`、`w-model-dev/references/data-models.md`、`w-model-dev/references/command-reference.md`
- 修改：`README.md`、`docs/INSTALL.md`、`AGENTS.md`、`CHANGELOG.md`

- [ ] **步骤 1：先新增 docs-consistency/文本断言测试**

为关键文本建立断言：锁语义为“跨进程锁保护”、pre-push 不自动下载、补装需显式命令；禁止遗留“mtime 乐观锁即可并发安全”“自动补装”表述。

- [ ] **步骤 2：更新文档**

写明锁超时/陈旧锁恢复/成功语义；写明 `npm install` postinstall 的 hook 副作用；写明 Windows Bash 仅 pre-push 所需，默认 pre-push 不联网。

- [ ] **步骤 3：验证和提交**

```bash
npm run check:docs-consistency
npm test
npm run typecheck
npm run prepush
git add w-model-dev/SKILL.md w-model-dev/references README.md docs/INSTALL.md AGENTS.md CHANGELOG.md
git commit -m "docs: document locked state writes and explicit platform repair"
```
