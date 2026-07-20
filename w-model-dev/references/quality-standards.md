# 质量保障体系

> 来源：SSoT 第 10 章。代码 / 文档 / 测试三类质量标准与质量门流程。
> 本文件为人类可读的质量标准；可执行判定以 [scripts/check-artifact-gate.ts](../scripts/check-artifact-gate.ts) 为准（读取 `.w-model/rtm.json`，退出码 0=通过 / 1=未通过 / 2=输入错误）。

## 代码质量标准

| 标准项 | 工具 / 命令 | 通过阈值 | 不通过 → 动作 |
|---|---|---|---|
| 单元测试代码覆盖率 | `npx vitest --coverage`（或等价运行器） | ≥ 80%（分支 + 行） | 回到编码补测试，禁止调低阈值放行 |
| 代码规范检查 | `npx eslint . --max-warnings=0` / `npx prettier --check .` | 0 error，0 warning | 回到编码修复违规，禁止 `// eslint-disable` 绕过 |
| 安全漏洞扫描 | `npm audit --audit-level=high` + ESLint security plugin | 高危漏洞数 = 0 | 回到编码修复，禁止降级为"已知风险"放行 |
| 性能指标监控 | k6 / JMeter 负载脚本 | P95 响应 < 2s，高负载无崩溃 | 回到编码定位瓶颈，禁止仅跑 happy path 判定通过 |

## 文档质量标准

| 标准项 | 检查方法 | 通过阈值 | 不通过 → 动作 |
|---|---|---|---|
| 文档完整性 | 对照 [templates/](../templates/) 8 个模板逐一核验 | 需求 / 设计 / 测试 / RTM 四类文档齐全 | 补齐缺失文档，禁止用 README 替代规格文档 |
| 文档一致性 | 术语 / 接口 / 字段跨文档交叉比对 | 0 不一致（接口签名、字段名、错误码全匹配） | 回到对应阶段修正，禁止"以代码为准"忽略文档 |
| 版本控制管理 | `git status` 工作树干净 + 产物已提交 | 无未提交的产物文件 | 提交后再放行，禁止带未提交改动进质量门 |

## 测试质量标准

| 标准项 | 检查方法 | 通过阈值 | 不通过 → 动作 |
|---|---|---|---|
| 测试用例评审 | 按 [verifier-spec.md](verifier-spec.md) 子标准评审 | 质量等级 A/B（`passed=true`） | 按 reworkHints 返工，禁止 C/D 等级放行 |
| 测试覆盖率分析 | 四级测试用例状态统计 | 单元 / 集成 / 系统 / 验收全部 `passed` | 补跑失败类型测试，禁止跳过任一级 |
| 缺陷追踪管理 | `.w-model/rtm.json` 的 `executionSummary` | `failed=0` 且 `pending=0` | 定位根因回编码，禁止 `pending` 状态进质量门 |

## 质量保障流程（质量门）

```
代码提交
   │
   ▼
自动化代码审查 ──不通过──► 回到编码
   │通过
   ▼
单元测试 ──不通过──► 回到编码
   │通过
   ▼
集成测试 ──不通过──► 回到编码
   │通过
   ▼
系统测试 ──不通过──► 回到编码
   │通过
   ▼
质量门检查 ──不通过──► 回到编码
   │通过
   ▼
发布
```

> 🔴 **CHECKPOINT · 质量门放行**：到达"质量门检查"节点时，Agent 必须执行 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]` 获取确定性判定（不得用 LLM 估算）。退出码 0 → 暂停向用户展示「RTM 覆盖率 / 四级测试结果 / GATE_JSON 摘要」由用户确认发布；退出码 1/2 → 一律回到编码，禁止放行。详见 [SKILL.md](../SKILL.md) §3 与 [anti-patterns.md](anti-patterns.md) #3/#6/#7。

## 质量门检查清单（放行条件）

- [ ] 自动化代码审查通过（ESLint / Prettier 退出码 0）
- [ ] 单元测试代码覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 系统测试全部通过
- [ ] 安全检测无高危漏洞（`npm audit --audit-level=high` 退出码 0）
- [ ] 性能指标达标（P95 响应 < 2s，高负载无崩溃）
- [ ] RTM 需求覆盖率 100%（按 `.w-model/rtm.json` 的 7 个追溯字段重算，`check-artifact-gate.ts` 退出码 0）
- [ ] 单元测试汇总计数守恒（`passed + failed + pending = total`）且代码覆盖率 ≥ 80%
- [ ] 交付文档齐全且一致（对照 templates/ 8 个模板）

任一条件不满足，回到编码实现返工。

## 工具缺失与降级处理（边界条件）

> 当质量门检查清单中引用的工具未安装或运行失败时，按以下降级路径处理，**禁止因工具缺失而跳过检查或放行**。

| 标准项 | 主工具缺失判定 | 降级工具 | 降级有效性约束 |
|---|---|---|---|
| 代码规范检查 | `npx eslint --version` 退出码 ≠ 0（未安装 / 无配置） | `npx tsc --noEmit`（TypeScript 项目）/ `node --check <file>`（JS 文件） | 仅校验语法与类型错误，不覆盖风格规则；降级时必须在《测试报告》备注「eslint 缺失，仅做 tsc 语法兜底」 |
| 单元测试运行 | `npx vitest --version` 退出码 ≠ 0 | `npx jest --coverage`（须有 jest 配置） | 覆盖率阈值同主工具（≥80% 分支+行）；jest 也缺失则停止推进，提示用户安装测试运行器 |
| 覆盖率统计失败 | 运行器退出码 0 但未生成 coverage 报告（JSON 解析失败 / 字段缺失） | 改用 `npx c8 --reporter=json <test-runner>` 包裹运行器；仍失败则统计「通过用例数 / 总用例数」作粗略覆盖率 | 粗略覆盖率仅作临时判定，**不得作为放行依据**；须在 24h 内修复运行器并重跑 |
| 安全漏洞扫描 | `npm audit` stderr 含 `command not found` / npm 不可用 | `npx audit-ci --moderate` 或对 `package-lock.json` 调用 OSV API（`https://api.osv.dev/v1/query`）批量查询 | 降级结果须标注数据源；高危漏洞判定与主工具一致（高危数 = 0 才放行） |
| ESLint security plugin 缺失 | `npx eslint --print-config .` 输出不含 `eslint-plugin-security` | `npx eslint . --rule '{"no-eval":"error","no-implied-eval":"error","no-new-func":"error"}'` 跑核心安全规则补位 | 仅覆盖基础安全规则，缺漏项必须在备注列出，不得视为等价于 security plugin |

### 降级流程

1. **检测**：质量门前执行一次 `--version` / `--print-config` 探测，识别主工具是否可用。
2. **降级**：按上表选择降级工具；降级工具同样不可用时，**不得放行**，回编码并提示用户补装工具链。
3. **标注**：在《测试报告》「备注」节注明「降级路径 + 降级原因 + 降级覆盖差距」。
4. **重跑**：用户补装主工具后必须重跑主工具校验，覆盖降级口径的缺漏项。

> 降级路径仅是兜底，**不改变**质量门通过判定标准（覆盖率 ≥ 80%、高危漏洞数 = 0、退出码 0）。

## 禁止行为（反例黑名单）

> 与 [anti-patterns.md](anti-patterns.md) 互引：以下为质量门层面的高发陷阱，命中即回编码。

| # | 禁止行为 | 对应反例 | 正确做法 |
|---|---|---|---|
| 1 | 用 LLM 估算覆盖率 / 测试结果 | anti-patterns #3 / #6 | 必须跑真实测试运行器 + `check-artifact-gate.ts` |
| 2 | 把退出码 1/2 当警告忽略 | anti-patterns #7 | 退出码 1/2 一律回到编码，不得放行 |
| 3 | 用 `// eslint-disable` 绕过规范检查 | — | 修复违规源，禁止整文件 disable |
| 4 | 把安全高危降级为"已知风险"放行 | — | 高危必须修复后重扫，不得降级 |
| 5 | 仅跑 happy path 判定性能通过 | — | 必须按负载模型（ramp-up → sustain → ramp-down）压测 |
| 6 | 带 `pending` 测试进质量门 | anti-patterns #9 | 所有用例必须 `passed` 或显式 `failed` 并返工 |
| 7 | 用 README 替代规格文档判完整 | — | 必须对照 templates/ 8 个模板逐一核验 |
