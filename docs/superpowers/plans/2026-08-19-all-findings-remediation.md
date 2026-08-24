# 全部已证实审查发现修正实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变 W 模型核心流程的前提下，修复已证实的状态并发、pre-push 供应链、运行时证据、门禁 fail-open、文档/样本漂移和维护性问题。

**架构：** 工作按四批交付。批次 A 先建立安全的跨进程状态写入与无网络 pre-push；批次 B 补齐运行时 Schema、证据和门禁失败语义；批次 C 同步 SSoT、Persona 和采用文档；批次 D 收敛分层、CLI 退出和审计导出。每个批次均先写失败测试、再最小实现、最后执行全量门禁。

**技术栈：** Node.js 20+、TypeScript ESM、Vitest、Ajv draft-07、Git Bash、npm、JSON Schema、TLA+/BDD 门禁脚本。

---

## 输入规格

- 已批准设计：`docs/superpowers/specs/2026-08-19-all-findings-remediation-design.md`
- 审查证据：本会话两轮只读复现及最终本地验证。

## 工作树与执行纪律

1. 实施前创建隔离 worktree；不要在当前 `main` 工作树直接实现。
2. 每个任务开始前，如将编辑 TypeScript 文件，先执行并落盘 codegraph 影响分析；本仓库无 `.codegraph/` 索引时，记录 `codegraph unavailable`、实际 import 图命令和结果到 `.w-model/codegraph-queries/`。
3. 每个任务均遵循红—绿：先增加失败测试，运行确认失败，再实现最小修复，运行定向测试。
4. 每个任务单独提交；不要混合状态写、hook、文档与重构。
5. 不修改已证伪项：版本七处同步、`docs/api` 忽略、无 Bash 时的实际 exit 127、当前环境 stdout 截断。

## 批次与任务映射

| 批次 | 计划文件 | 任务 | 已证实问题 |
|---|---|---|---|
| A | `2026-08-19-remediation-batch-a-state-and-supply-chain.md` | A1-A4 | mtime TOCTOU、回滚覆盖、备份冲突、pre-push 自动下载、触发范围绕过 |
| B | `2026-08-19-remediation-batch-b-gates-and-evidence.md` | B1-B5 | gate log 无 Schema、写时无 Schema、Vitest 软放行、同步子进程无超时、TLA/BDD 边界 |
| C | `2026-08-19-remediation-batch-c-docs-and-examples.md` | C1-C4 | SSoT 断链/架构图、Persona 示例失效、新手路径混合 |
| D | `2026-08-19-remediation-batch-d-architecture-and-maintenance.md` | D1-D4 | lib→logic 反向依赖、退出模式不一、证据无导出、动态计数高 churn |

## 执行顺序

```text
A1 锁与状态事务
  → A2 状态 Schema 注册
  → A3 pre-push 触发与显式补装
  → A4 批次 A 验收
  → B1 gate log Schema
  → B2 docs-consistency fail-closed
  → B3 timeout 统一
  → B4 TLA/BDD 边界
  → B5 批次 B 验收
  → C1 SSoT 与链接门禁
  → C2 Persona fixture
  → C3 入门路径
  → C4 批次 C 验收
  → D1 基础设施分层
  → D2 CLI 自然退出
  → D3 证据导出
  → D4 动态计数减负与批次 D 验收
```

## 全局验收命令

每批结束执行：

```bash
npm test
npm run typecheck
npm run check:docs-consistency
npm run check:gate -- --validate-templates
npm run prepush
```

若当前批次修改了 TLA、BDD 或状态写入，再额外运行批次计划中列出的定向门禁与单测。任何命令失败均先保留失败输出、完成根因分析，再进行下一步。

## 提交建议

```text
test(state): cover cross-process state write locking
fix(state): make wm-write lock-protected and schema-aware
fix(hook): block unchecked config and script changes
fix(hook): make platform dependency repair explicit
feat(gate): validate gate logs and fail closed on test count collection
fix(test): bound synchronous child processes
fix(docs): align SSoT links and external-agent boundary
fix(persona): replace stale verifier JSON examples with validated fixtures
refactor(scripts): enforce one-way infrastructure layering
refactor(cli): use natural process exit consistently
feat(evidence): add sanitized runtime evidence export
```

## 完成定义

全部批次完成后，除全局命令外，必须证明：

- 两个带相同 `--expect-mtime` 的竞争写者不能同时成功。
- pre-push 永不执行 `npm pack`、`tar` 或 `npm install`。
- 任一 `config/**` 或根 `scripts/**` 变更触发门禁。
- Persona 样本均能通过真实 `check-verifier-output`。
- SSoT 不存在内部相对链接断链。
- docs-consistency 无法取得 Vitest 总数时失败，而不是放行。
- 运行时 gate log 有 Schema、不可静默丢失，并能被显式导出和验证。
