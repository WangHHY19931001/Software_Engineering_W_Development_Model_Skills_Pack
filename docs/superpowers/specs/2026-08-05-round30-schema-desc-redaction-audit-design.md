# 第 30 轮设计：Schema 字段描述增强 + 敏感信息脱敏条款 + npm audit 门禁（低风险批）

> 触发：外部评审者就技能包给出 14 条建议，用户经头脑风暴选定 3 轮分组实施。本轮为第 1 轮（低风险批）：#13 Schema 字段级 description、#8 敏感信息脱敏条款、#7 npm audit 加入 pre-push。
>
> 当前版本：`29.0.0`；目标版本：`30.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步）。
>
> 工作流：头脑风暴 → 设计（本文）→ 计划 → 同步 SSoT → 实施 → 回归 → 同步 SSoT/README/AGENTS/INSTALL/CHANGELOG。
>
> 后续轮次：第 31 轮（#10 /wm status 脚本+文档 + #14 metrics-report.ts）、第 32 轮（#3 错误结构全量归一化 + run-log R6 契约迁移），均独立设计文档与计划。

## 1. 背景与缺口

### 1.1 现状

| 建议 | 现状 | 缺口 |
|---|---|---|
| #13 Schema 自我描述 | [schemas/](../../w-model-dev/schemas) 已有 19 份 draft-07 schema，顶层有 `description`，但字段级 `description` 稀疏（如 `rtm.schema.json` 仅 3 处字段 description） | AI Agent 理解字段用途与期望值依赖人读文档，schema 自身自描述不足，易产生理解偏差 |
| #8 敏感信息脱敏 | 技能包脚本无硬编码密钥；demo 的 JWT_SECRET 已用 cross-env 注入（第 15 轮）；但无跨阶段「状态文件/日志不得写入密钥」的显式条款 | 编排者/子代理在 `.w-model/*.json`、gate-logs、run-log 中写入密钥或令牌时无反模式拦截 |
| #7 依赖漏洞扫描 | [security-scan.ts](../../w-model-dev/scripts/security-scan.ts) 为 eslint-plugin-security **源码级**静态扫描 + baseline 指纹豁免；pre-push 已有 11 项门禁 | 无 `npm audit` 依赖级漏洞扫描；pre-push 的 `npm install` 已显式 `--no-audit`，依赖漏洞无感知 |

### 1.2 缺口清单

| 缺口 | 现状 | 本轮动作 |
|---|---|---|
| G1 | 字段级 description 稀疏 | 为 19 份 schema 的**必填字段 + 语义关键字段**补 `description`（用途 + 期望值） |
| G2 | 无敏感信息写入状态文件的条款 | 新增反模式 #43 + operational-recovery.md 补禁令 |
| G3 | 无依赖漏洞扫描 | pre-push 新增 npm audit（warn-only + 离线容错） |

### 1.3 不涉及范围

- **不改变任何校验行为**：schema 只加 `description` 关键字（ajv draft-07 忽略），不增删字段、不改 type/enum/minimum/required。
- **不新增 SKILL.md 约束号**（避免约束膨胀），脱敏条款由反模式承载。
- **不引入新依赖**：npm audit 为 npm 内建命令，无 package.json devDep 变更。
- **不改动样本与测试预期**：self-test 213 条 / vitest 297 条应全部保持通过。
- 第 31 / 32 轮内容（/wm status、metrics-report、错误结构归一）**不在本轮**实施。

## 2. 方案详述

### 2.1 #13 Schema 字段级 description（19 份）

**范围**：[schemas/](../../w-model-dev/schemas) 全部 19 份：

`bdd-manifest` / `budget` / `checkpoint-log` / `code-tla-manifest` / `coverage` / `design-contract` / `event-ingress` / `exemption` / `graph` / `hill-climbing-report` / `maturity` / `preventive-review` / `project` / `rootcause-report` / `rtm` / `run-log` / `signature-chain` / `tla-manifest` / `verifier-output`

**做法**（用户决策：**全量字段**，约 430 个）：
- 为 19 份 schema 的**全部字段定义**（含嵌套对象属性、$defs 引用内字段）补充 `description`，不留遗漏。
- description 内容：字段用途 + 期望值（含合法取值 / 单位 / 一致性约束引用），与 `data-models.md` / `*-logic.ts` 校验语义一致，避免与既有文档口径冲突。
- 结构上保持 `properties` 键顺序不变，仅插入 `description` 行。
- 执行方式：可拆 3-4 个子代理并行（按 schema 分组，组间无依赖），完成后统一 JSON.parse 验证。

**字段覆盖基线**：修改前 19 份 schema 中 17 份字段级 description 为 0；仅 `rtm` 有 2 处（targetValue/testThreshold）、`run-log` 有 1 处（role）。验收标准为全部字段（含既有 3 处）均带 description。

**风险与回归**：
- 唯一风险为 JSON 语法错误：每文件修改后以 `JSON.parse` 验证。
- `validateBySchema` 校验行为不变：self-test SCHEMA_CASES（16 条）+ vitest `schema-validation.test.ts` 应无变化通过。

### 2.2 #8 敏感信息脱敏条款

**2.2.1 anti-patterns.md 新增反模式 #43**

```
#43 敏感信息写入状态文件/日志
- 检测信号：.w-model/*.json / .w-model/gate-logs/ / run-log.jsonl 中出现硬编码密钥、
  令牌、密码、连接串（sk-xxx / AKIA / Bearer / password= 等特征）；或 SKILL.md 示例、
  模板中包含真实凭据而非占位符。
- 回退动作：从状态文件移除敏感值，改为环境变量引用或外部 secrets 管理；
  修正示例/模板为占位符；回当前阶段起点重跑受影响门禁。
- 正确做法：敏感配置统一经环境变量注入；状态文件只存引用名（如 ${JWT_SECRET}），
  不存值。
```

**2.2.2 operational-recovery.md 补强**

「JSON 文件写入工具选择」节末尾追加禁令：禁止将密钥/令牌/密码写入任何状态文件或日志；敏感配置统一走环境变量（与 demo `JWT_SECRET` 处理一致），状态文件只存引用名。

**2.2.3 同步计数**

README.md 反模式计数 42 → 43；AGENTS.md §4 对应轮次记录。

### 2.3 #7 npm audit 加入 pre-push（warn-only）

**[.githooks/pre-push](../../.githooks/pre-push)** 在现有 11 项检查后追加检查 #12：

```bash
# 12. npm audit：依赖漏洞扫描（warn-only，不阻断；离线/网络失败自动跳过）
log "npm audit 依赖漏洞扫描（warn-only）..."
if npm audit --audit-level=high >"$tmp_log" 2>&1; then
  ok "npm audit 未发现 high 以上漏洞"
else
  warn "npm audit 发现漏洞或网络不可达（详情见上），warn-only 不阻断 push"
fi
```

- **warn-only**：发现漏洞仅警告，不阻断 push（漏洞修复不属 push 门禁职责）。
- **离线容错**：`npm audit` 网络失败返回非 0，同样走 warn 分支不阻断。
- **触发条件**：复用现有路径过滤（`package.json` / `package-lock.json` / `.githooks/pre-push` 变更时触发；纯文档改动仍跳过）。
- 文件头注释 11 项 → 12 项。
- `pre-push` 脚本需新增 `warn()` 工具函数（黄色输出，语义区别于 `ok`/`fail`）。

## 3. 回归策略

1. `npm run self-test` —— 213 条样本，全部通过。
2. `npx vitest run`（w-model-dev 下，21 个 test 文件）—— 全部通过。
3. `npm run prepush`（PREPUSH_FORCE=1）—— 12 项，npm audit 走 warn 分支不阻断。
4. TypeScript strict —— 0 错误（`npx tsc --noEmit`）。
5. schema JSON 语法：对 19 份 schema 逐一 `JSON.parse` 验证。

## 4. 文档同步清单

| 文件 | 变更 |
|---|---|
| `w-model-dev/schemas/*.schema.json`（19 份） | 字段级 description 补充 |
| `w-model-dev/references/anti-patterns.md` | 新增反模式 #43 |
| `w-model-dev/references/operational-recovery.md` | 「JSON 文件写入工具选择」节补密钥禁令 |
| `.githooks/pre-push` | 新增检查 #12 npm audit（warn-only）+ warn() 函数 + 注释更新 |
| `package.json` / `w-model-dev/SKILL.md` frontmatter / `w-model-dev/skill-metadata.json` | 版本号三处 29.0.0 → 30.0.0 |
| `docs/skill-design-document_SSoT.md` | §3.4.27 轮次记录 + §10A 追溯表 |
| `CHANGELOG.md` | [30.0.0] 条目 |
| `AGENTS.md` | §4 轮次记录 + §2 目录速查（如涉及 pre-push 描述） |
| `README.md` | 反模式计数 42 → 43 + 版本号 |
| `CONTRIBUTING.md` / `docs/INSTALL.md` | 如有 self-test 基线 / 版本号引用则同步 |

## 5. 验收标准

1. 19 份 schema 全部字段级 description 就绪且 JSON 语法合法；self-test / vitest 全绿。
2. anti-patterns.md 含 #43，README 反模式计数一致（43）。
3. operational-recovery.md 含密钥禁令条款。
4. `npm run prepush` 12 项通过（audit warn-only 不阻断）。
5. 版本号三处一致 30.0.0。
6. 无样本 / 测试预期改动（self-test 213 条、vitest 297 条基线不变）。
