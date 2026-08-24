# 全部已证实审查发现修正设计

- 日期：2026-08-19
- 状态：已批准设计，待实施计划
- 范围：本仓库的确定性门禁脚本、运行时状态、pre-push、文档、样本、安装体验和维护性资产
- 非范围：已证伪的版本漂移、`docs/api` 被错误入库、当前环境的 stdout 截断、无 Bash 时 hook 内部 `exit 0` 放行；不引入 LLM 调用、业务 SDK 或外部状态服务。

## 1. 背景与目标

本次只读复现审查确认：仓库当前回归健康，但部分设计承诺与实际实现不一致。已实测：Vitest 47 个测试文件、725 条用例通过；TypeScript 类型检查、模板门禁和 17 项 pre-push 门禁通过。

修正目标不是改变 W 模型的流程语义，而是：

1. 让状态写入的并发、安全和回滚契约真实可实现。
2. 移除 pre-push 路径中的隐式网络下载与 node_modules 覆盖。
3. 让门禁、Schema、运行时证据、样本和文档形成可验证闭环。
4. 让示例、SSoT 和新手路径反映当前实际能力边界。
5. 降低长期维护时的动态计数漂移、层级耦合和输出行为差异。

## 2. 已证实问题清单

| ID | 问题 | 优先级 | 修正批次 |
|---|---|---:|---|
| A1 | `wm-write` 的 mtime 检查不是跨进程 CAS，竞争写会丢写 | P0 | A |
| A2 | 状态回滚可能覆盖并发合法写；备份名分钟粒度冲突 | P0 | A |
| A3 | pre-push 对 `config/**` 和根 `scripts/**` 单独变更跳过所有门禁 | P0 | A |
| A4 | pre-push 自动 `npm pack`、解包并覆盖 `node_modules`，无独立 SRI 校验 | P0 | A |
| B1 | gate log 绕过安全写入和 Schema，且写错误被吞掉 | P1 | B |
| B2 | `wm-write` 仅检查 JSON 可解析性，未按目标状态类型校验 Schema | P1 | B |
| B3 | docs-consistency 无法采集 Vitest 用例数时仍放行 | P1 | B |
| B4 | 部分同步子进程没有进程级 timeout | P1 | B |
| B5 | pre-push 与项目阶段门的 TLA/BDD 强制范围未明确区分 | P1 | B |
| C1 | SSoT 有三条相对链接断链 | P1 | C |
| C2 | SSoT 将外部 Agent/LLM 能力画成技能包内置 AI 引擎 | P1 | C |
| C3 | 四个 Persona 的 Verifier JSON 示例都不能通过当前 Schema/门禁 | P1 | C |
| C4 | README 混合“验证仓库”和“安装 Skill”两种新手路径 | P2 | C |
| D1 | `lib → logic` 存在反向依赖，虽无循环但层级语义不清 | P2 | D |
| D2 | CLI 同时采用 `process.exitCode`、直接 `process.exit` 和混合模式 | P2 | D |
| D3 | `.w-model` 审计证据被忽略但无显式可校验导出机制 | P2 | D |
| D4 | 动态计数在多处文档复制，docs-consistency 成为高 churn 政策层 | P2 | D |

## 3. 批次 A：数据正确性与供应链安全

### 3.1 锁保护的事务式状态写入

`wm-write` 的成功语义改为：当前调用持有目标文件排他锁；在锁内通过可选 mtime 校验和 Schema 校验；当前 payload 已原子替换目标；回读仍与当前 payload 一致；最后安全释放锁。

#### 锁文件协议

目标文件使用同目录锁文件，例如：

```text
.w-model/rtm.json.lock
```

锁文件采用排他创建，记录：

```json
{
  "targetPath": ".w-model/rtm.json",
  "pid": 12345,
  "token": "uuid",
  "createdAt": "2026-08-19T00:00:00.000Z",
  "operation": "wm-write"
}
```

写入顺序：

```text
获取锁
  → 读取当前目标与 mtime
  → 在锁内验证 --expect-mtime
  → 由目标类型注册表执行 Schema 校验
  → 创建带毫秒与 UUID 的私有备份
  → 写唯一 tmp 文件并原子 rename
  → 回读并比较当前 payload
  → 若失败，仅在仍持有当前锁且目标仍为本次内容时原子恢复备份
  → 验证 token 后释放锁
```

#### 竞争与陈旧锁

- 正常竞争采用短暂轮询，并有可配置 timeout；超时返回校验失败及锁元数据。
- 锁 token 是释放和恢复的身份条件，旧写者不能删除新写者的锁。
- 陈旧锁仅在 TTL 到期且 PID 不存在，或用户明确传 `--recover-stale-lock` 时恢复。
- 恢复不直接删除旧锁：先重命名为带时间戳的审计锁文件。
- 回滚使用 tmp + rename，不得使用原地 `copyFile` 或无条件 `unlink`。

#### 测试

新增协调式跨进程/可注入障碍测试，覆盖：

1. 两写者用相同旧 mtime 时，仅一方成功，另一方冲突失败。
2. 回读失败期间，第二写者等待，不会被回滚覆盖。
3. 同一分钟多次写入的备份路径仍唯一。
4. PID 不存在且 TTL 到期的陈旧锁可受控恢复。
5. token 不匹配时不得释放锁。
6. 回滚期间读者只能看见完整旧值或完整新值。

### 3.2 pre-push 禁止自动下载平台依赖

pre-push 只允许检查、验证和失败提示；不得在推送路径运行 `npm pack`、`tar` 或覆盖 `node_modules`。

`ensure-platform-deps.sh` 分为两个显式模式：

| 模式 | 行为 |
|---|---|
| 默认或 `--check` | 检查当前平台依赖；缺失时 exit 1 并打印修复命令。 |
| `--install` | 仅用户显式调用的补装流程；不得由 pre-push 调用。 |

显式安装模式必须：

1. 从 lockfile 读取预期包名、版本、`resolved` 和 SRI `integrity`。
2. 校验 registry 是否在 allowlist 中。
3. 使用 `npm pack --json` 获取确定 tarball 文件名。
4. 对下载 tarball 执行 SRI 校验。
5. 解包后校验 package 名称和版本。
6. 拒绝异常路径、绝对路径、`..` 路径和意外符号链接。
7. 写入后执行运行时模块验证。

### 3.3 扩大 pre-push 触发范围

`needs_gate` 必须把以下路径纳入触发条件：

```text
config/**
scripts/**
package.json
package-lock.json
```

因此 TypeScript、Vitest、Prettier、版本工具、安装 hook 和锁文件变更都会触发完整门禁。

## 4. 批次 B：门禁与运行时证据闭环

### 4.1 gate log Schema 与不可静默失败的写入

新增 `gate-log.schema.json`，描述 gate log 公共字段：

```json
{
  "script": "check-example.ts",
  "exitCode": 0,
  "passed": true,
  "reasons": [],
  "reportSummary": {}
}
```

约束：

- gate log 与阶段报告使用不同 Schema；不得用冰山报告 Schema 替代 gate log Schema。
- 写前必须通过 gate log Schema 校验。
- gate log 是 append-only 唯一文件，不覆盖历史文件，不复用状态替换锁。
- gate log 写入失败不得被吞掉；主门禁结果保持可读，但报告必须包含可机器读取的 `gateLogWriteError`，并使上游 run-log 可追踪。

### 4.2 目标类型驱动的 Schema 校验

建立 `.w-model` 状态目标到 Schema 的显式注册表，例如：

```text
project.json       → project
rtm.json           → rtm
budget.json        → budget
maturity.json      → maturity
run-log.jsonl      → run-log
```

规则：

- 注册 JSON 目标：写时必经对应 Schema。
- 注册 JSONL 目标：逐行经对应 Schema。
- 未注册目标默认拒绝；仅显式 `--allow-untyped` 可绕过，并输出警告。
- `checkpoint-log`、`event-ingress`、`hill-climbing-report`、`project` 等 Schema 必须接入真实读写路径；若没有实际运行时契约，应删除或明确标为 fixture-only。

### 4.3 docs-consistency fail-closed

Vitest 用例数采集失败应成为 violation 并 exit 1，不能再显示“无法采集（放行）”。测试覆盖：命令不可用、JSON 报告无法解析、报告结构变化及实际数量漂移。

### 4.4 同步子进程的统一 timeout

新增共享同步执行帮助器或统一选项，所有 `execSync` / `spawnSync` 明确传递：

```ts
timeout
killSignal
encoding
maxBuffer
```

优先处理：

- `gate-report.test.ts`
- `metrics-report.test.ts`
- `wm-status.test.ts`
- `artifact-gate-assets.ts`

TLA/TLC 继续使用集中定义的较长限制；测试使用较短但稳定的上限。

### 4.5 TLA/BDD 双层门禁边界

文档、命令输出和 hook 注释明确区分：

| 层级 | 目标 | 强制内容 |
|---|---|---|
| pre-push 回归门禁 | 验证技能脚本 | self-test、fixture、BDD 基线、类型/格式/安全检查 |
| 项目阶段门 | 验证某项目工件 | TLA、BDD、TLA↔BDD 同步、图谱、阶段资产 |

阶段 1-4 在项目成熟度要求 TLA/BDD 时，必需 manifest、同步证据缺失即失败；阶段 5-8 若规定 Cucumber 绑定，报告缺失不能仅记录“跳过”。哪些成熟度允许降载必须在 SSoT、SKILL 和门禁输入契约中一致表达。

## 5. 批次 C：文档、示例与可执行契约

### 5.1 SSoT 链接和架构边界

- 修复 SSoT 第 397-399 行的三条相对链接。
- 将“核心 AI 引擎”图改为“外部 Agent / 宿主 LLM 能力层”。
- 图中明确三条边界：
  - 技能包：Markdown、模板、Schema、确定性脚本；
  - 宿主 Agent：推理、分派、LLM-as-Verifier；
  - 外部工具：TLA+、CodeGraph、OpenSpec。
- 将 SSoT 纳入 docs-consistency 的相对链接扫描。

### 5.2 Persona 示例改为受门禁验证的 fixture

不再在 `agent-personas.md` 手写四组容易过时的完整 JSON。改为：

1. 在 `scripts/samples/verifier/` 创建四个完整 Persona fixture。
2. 每个 fixture 都必须实际通过 `check-verifier-output`。
3. 文档只保留字段说明、Persona 选择说明和 fixture 链接。
4. docs-consistency 验证这些链接和样本存在。
5. 测试直接执行四个 fixture 并断言 exit 0。
6. 带 High/Critical 返工信息的示例必须让 `passed`、quality level 和 rework hints 符合门禁语义。

### 5.3 新手入口拆分

README 首屏分为：

```text
A. 验证仓库
   clone → npm install → npm run self-test → npm run doctor

B. 安装 Skill
   选择 Agent → 复制 w-model-dev → 激活或重启 Agent
```

文档补充：

- Node.js ≥20、Git、网络/npm registry、仓库根目录要求；
- Windows PowerShell 5.1 兼容的两行 clone 命令；
- 仅 pre-push/hook 操作需要 Git Bash 或相应 Bash 环境；
- `npm install` 的 postinstall 会设置仓库本地 `core.hooksPath`，并给出禁用/恢复方式；
- canonical clone URL；
- Windows 与 WSL 不要在同一 checkout 混用 node_modules。

## 6. 批次 D：结构与长期维护

### 6.1 单向分层

目标结构：

```text
cli → application/services → domain logic → shared infrastructure
```

措施：

- `lib/` 仅保留无领域依赖的通用工具。
- 将 Schema 加载、Schema 文件读取、资产路径映射等基础设施移到明确的 infrastructure/services 层。
- `logic/` 保留领域校验和可测试规则。
- 清除现有 `lib → logic` 运行时反向边。
- 新增静态依赖图测试，保证无循环且各层只能向下依赖。

这是一项重构，不改变门禁结果语义。

### 6.2 统一 CLI 自然退出

成功和校验失败路径采用：

```ts
process.exitCode = exitCode;
return;
```

报告函数只输出，不调用 `process.exit()`。保留现有 stdout 协议和 `*_JSON.exitCode`，测试默认/`--json` 输出兼容及子进程退出码一致。

### 6.3 `.w-model` 显式证据导出

`.w-model` 继续是本地忽略目录，新增显式导出能力，例如：

```bash
npm run wm:export-evidence -- <project-dir> <output-dir>
```

导出：

- 选定 gate logs、Verifier 输出、签名链、codegraph 查询和 run-log；
- manifest（源路径、SHA-256、导出时间、Schema 版本）；
- 可选路径清理和敏感字段删除；
- 独立验证命令，校验 manifest、哈希和 Schema。

README 与 AGENTS 明确：`coverage/`、`.zcode/`、`.w-model/` 是本地生成物；`docs/changes/archive/` 是受控且跟踪的归档。

### 6.4 降低动态计数高 churn

- 动态计数由工具读取并输出，不在多份文档手写复制。
- 文档保留稳定语义，集中一处保存必须展示的动态计数。
- docs-consistency 将静态规范检查与动态统计检查拆分，分别测试。
- 保持 SSoT 优先，但降低一次脚本变更需要同步的无关文本数量。

## 7. 全局验收标准

每个批次必须：

1. 先加入失败测试或稳定最小复现。
2. 修正后通过定向测试。
3. 通过 `npm test` 与 `npm run typecheck`。
4. 对涉及资产运行对应 `check-*`。
5. 批次结束运行 `npm run prepush`。
6. 同步 SSoT、SKILL、references、Schema、样本、README、INSTALL、CONTRIBUTING、AGENTS 和 CHANGELOG 中受影响的事实。
7. 不引入 LLM 调用、业务 SDK、隐式网络下载或未声明依赖。
8. 对审计导出功能验证 hash、manifest 与 Schema。

## 8. 实施顺序与提交边界

按 A → B → C → D 顺序实施。每批应拆成小的、可审查和可回滚的提交：先测试/Schema，再实现，再文档和一致性更新；不得把状态写入、hook 供应链和文档重构混在同一提交中。
