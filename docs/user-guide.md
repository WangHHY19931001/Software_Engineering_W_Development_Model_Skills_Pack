# W-Model 技能包用户指南（User Guide）

> 面向对象：G 门禁子代理、手工跑校验脚本的开发者 / 使用者。
> 快速上手与命令清单见 [README](../README.md)；`/wm` 命令与错误码约定见 [`command-reference.md`](../w-model-dev/references/command-reference.md)；故障与 FAQ 见 [troubleshooting.md](./troubleshooting.md)。

## 1. 本文档的阅读路径

| 场景 | 直接看 |
|---|---|
| 门禁脚本退出码 1（校验失败） | 第 3.2 节 + 第 4 节规则依据 + 第 5 节修复建议 |
| 门禁脚本退出码 2（输入错误） | 第 3.3 节 + `command-reference.md`「错误码与 ERROR_JSON 约定」节 |
| 想查某条违规对应哪条规则 | 第 4 节规则链速查表 |
| 升级依赖 / 做依赖巡检 | 第 6 节（人工 `npm audit` + `npm outdated` 流程） |

## 2. 校验脚本总览

全部门禁脚本位于 `w-model-dev/scripts/cli/`（`check-*.ts`），由外部 Agent 或手工以 `npx tsx` 直接执行，**不调用任何 LLM**，仅做结构化门禁判定。各阶段应跑哪些脚本见 README「W 模型 8 阶段 × 门禁对应」表与 [`dispatch-matrix.md`](../w-model-dev/references/dispatch-matrix.md)。

所有脚本统一三态退出码与输出通道（SSoT §10E）：

- **stdout**：人类可读结构化报告 + 收尾 `GATE_JSON` / `XXX_JSON` 摘要（机器可读）
- **stderr**：exit 2 场景的人类诊断（`✗ [CATEGORY] ...`）
- 违规规则链（如 `P0-1` / `R1` / `D7`）在 JSON 摘要的 `rule` / `field` 字段或 violations 文本前缀中给出

## 3. 退出码语义与排查思路

退出码语义全表统一为 **0 = 通过 / 1 = 校验失败 / 2 = 输入错误（ERROR_JSON）**。

### 3.1 退出码 0 —— 通过

输出为结构化报告 + 末尾摘要（`exitCode: 0`、`passed: true`）。直接放行进入下一环节（阶段门还需 🔴 CHECKPOINT 人工确认）。

### 3.2 退出码 1 —— 校验失败（violations）

排查步骤：

1. **读 violations 列表**：每条违规含规则链前缀，如 `[D7:feature-001] req "REQ-001" not in RTM`、`R1: 阶段 4 缺 gate 类动作`。先按前缀在 第 4 节速查表定位规则归属。
2. **对照规则依据**：反模式编号 `#N` → 查 [`anti-patterns.md`](../w-model-dev/references/anti-patterns.md) 对应行的「正确做法」列；维度编号（R1-R5 / D1-D8 / C1-C10 / E1-E9）→ 查 第 5 节指向的 reference 细则。
3. **走标准返工路径**：V/G 不通过后**不得悄悄小修后继续**（反模式 #4），必须先分派 R 根因定位 → V 复审 → G 门禁 → S-fix 携报告修复（反模式 #18/#19）。
4. **重跑门禁**直到 exit 0；退出码 1/2 一律不得放行（反模式 #7）。

### 3.3 退出码 2 —— 输入错误（ERROR_JSON）

输出形态：stderr 单行 `✗ [CATEGORY] <message> [rule=...]: <file|detail>` + stdout 单行 `ERROR_JSON {...}`。

6 类错误类别与排查方向：

| 类别 | 含义 | 排查方向 |
|---|---|---|
| `ARG_INVALID` | 命令行参数非法（如 `--phase=99`） | 核对参数取值与脚本用法（`--help` 或 `command-reference.md`） |
| `FILE_NOT_FOUND` | 指定文件不存在 | 核对路径大小写 / 相对路径起点（默认 cwd） |
| `FILE_PARSE` | JSON 解析失败 | 用 Node `JSON.parse` 校验文件格式（避免 PowerShell `ConvertTo-Json` 写入，见反模式 #25） |
| `FILE_READ` | 文件读取失败（权限 / 编码） | 检查文件权限与编码（UTF-8 无 BOM） |
| `STRUCTURE_INVALID` | 通过解析但不符合 JSON Schema | 对照 `w-model-dev/schemas/` 下对应 schema（20 份清单见 [`data-models.md`](../w-model-dev/references/data-models.md)） |
| `UNEXPECTED` | 脚本内部异常 | 按错误详情上报 / 查看 stderr detail |

`ERROR_JSON` 字段：`category` / `message` / `exitCode` / `file` / `rule` / `field`（后三个仅在有值时输出）。**不变量：`ERROR_JSON.exitCode` 恒等于进程实际退出码**（防伪三层机制，SSoT §10E E.1），可被 `check-run-log.ts` R6 交叉校验存档。

### 3.4 排查速查

| 现象 | 最可能原因 | 处置 |
|---|---|---|
| `ARG_INVALID` | 阶段参数越界 / 缺少必需参数 | 核对脚本用法，重跑 |
| `FILE_NOT_FOUND` | 路径写错 / 工件未产出 | 先确认上一环节是否完成（如 graph.json 未产出） |
| `FILE_PARSE` / `STRUCTURE_INVALID` | JSON 手工编辑出错 / 字段缺失 | 对照 schema 修正（见 [第 5 节](#5-常见校验失败与修复建议)） |
| violations 含 `[D7]` | BDD feature 未在 RTM 登记 | 回填 RTM 映射后重跑 |
| violations 含 `R1:` 缺动作 | run-log 漏记某类动作 | 补记真实动作，勿伪造 |

## 4. 规则依据

### 4.1 负面知识库（anti-patterns.md）

规则依据的权威清单在 [`anti-patterns.md`](../w-model-dev/references/anti-patterns.md)：

- **47 条流程反模式** `#1~#47`（命中即视为流程破坏、必须回退）
- **失败模式** `F1~F10`（行为退化，命中不回退但登记，见 [`operation-behaviors.md`](../w-model-dev/references/operation-behaviors.md)）、**运维失败模式** `O1~O6`（见 SSoT §4A.2a）

### 4.2 规则链编号速查表

violations / `rule` 字段中的编号前缀按门禁归属：

| 前缀 | 门禁脚本 | 含义（示例） |
|---|---|---|
| `P0-1` / `P0-2` | 各 check-*.ts | 输入错误规则链（参数非法 / 文件缺失） |
| `R1`-`R8` | [`check-run-log.ts`](../w-model-dev/scripts/cli/check-run-log.ts) | R1 阶段动作完整性 / R2 tokens 非负 / R3 返工记录一致 / R4 acknowledgedDecisions 非空 / R5 O 越权检测 / R6 gate-exitCode 交叉校验 / R7 append-only 时间戳 + rootcause 后置 review/fix / R8 理想轨迹模板 |
| `R1`-`R10` | [`check-signature-chain.ts`](../w-model-dev/scripts/cli/check-signature-chain.ts) | 签名链完整性（角色 / 连续 / 来源） |
| `R13` | [`check-verifier-output.ts`](../w-model-dev/scripts/cli/check-verifier-output.ts) | 单轴下限：所有 subCriterion.score ≥ 0.70（防加权平均掩盖，反模式 #41） |
| `D1`、`D3`-`D8` | [`check-bdd-model.ts`](../w-model-dev/scripts/cli/check-bdd-model.ts) | D1 头标注 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径合法性 / D7 RTM 映射 / D8 SD coverage |
| `C1`-`C10` | [`check-requirement-coverage.ts`](../w-model-dev/scripts/cli/check-requirement-coverage.ts) | 阶段 1 需求覆盖分析 |
| `E1`-`E9` | [`check-exemption.ts`](../w-model-dev/scripts/cli/check-exemption.ts) | 豁免审批（S→R→V→人类四阶段） |
| `R3×3` | [`check-preventive-review.ts`](../w-model-dev/scripts/cli/check-preventive-review.ts) | 预防性审查（覆盖所有 S 变体，反模式 #33/#42） |

> 注：`rule` / `field` 字段仅在已知规则 ID 的场景输出；无明确规则 ID 的违规以 violations 文本为准，不强行套编号。

## 5. 常见校验失败与修复建议

| 门禁 | 常见失败信号 | 规则依据 | 修复建议 |
|---|---|---|---|
| 图谱门禁 `check-requirement-graph.ts` | 连通性 / 多根 / 父唯一 / 信息流黑洞·奇迹·死模块 | 反模式 #11/#12/#13 | 修正 ingestion 分块或合并结果后重跑；信息流校验详见 [`information-flow-validation-design.md`](./information-flow-validation-design.md) |
| TLA+ 门禁 `check-tla-model.ts` | SANY 语法失败 / TLC 死锁 / 不变式违反 | 反模式 #14/#15/#16/#17 | 先修语法再跑 TLC（顺序强制）；规格与需求/设计不符须回退修正；详见 [`tla-plus-guide.md`](../w-model-dev/references/tla-plus-guide.md) |
| BDD 门禁 `check-bdd-model.ts` | D1 头标注不一致 / D4 不等价 / D7 RTM 无映射 | 反模式 #29 | feature 忠实需求/设计；D4 不等价须走 R→V→G→S-fix，实质不一致上报人类；详见 [`bdd-guide.md`](../w-model-dev/references/bdd-guide.md)「不符处理流程」节 |
| Verifier 输出 `check-verifier-output.ts` | R13 单轴 score < 0.70 | 反模式 #41 | 补强该维度评审，不得以总分掩盖；详见 [`verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §3.3 / §6.3 |
| 工件质量门 `check-artifact-gate.ts` | RTM 覆盖率 < 100% / `designDoc` 未回填 | 反模式 #3/#6/#7 | 实际核验 RTM 登记项并回填真实结果；详见 [`quality-standards.md`](../w-model-dev/references/quality-standards.md)「质量门检查清单」 |
| run-log 门禁 `check-run-log.ts` | R1 缺动作 / R5 O 越权 / R6 exitCode 不一致 | 反模式 #10/#25/#26/#27 | 补记真实动作（勿伪造）；字段按 [`data-models.md`](../w-model-dev/references/data-models.md) 对照表修正 |
| 签名链 `check-signature-chain.ts` | R1-R10 任一断裂 | 反模式 #32 | 补齐缺失角色签名与来源证明；详见 [`signature-chain-guide.md`](../w-model-dev/references/signature-chain-guide.md) |
| 豁免门禁 `check-exemption.ts` | E1-E9 任一失败（跳步） | 反模式 #30 | 按 S→R→V→人类四阶段补流程；详见 [`phase-1-requirements.md`](../w-model-dev/references/phase-1-requirements.md)「豁免审批治理」节 |
| 归档完整性 `check-archive-integrity.ts` | 强制快照清单缺文件 | 反模式 #31 | 补齐归档强制产出文档后重跑 |
| 预防性审查 `check-preventive-review.ts` | R3×3 缺失 | 反模式 #33/#42 | 回 S 产出后起点补跑 R3×3 + V |

> 修改 `*-logic.ts` 校验逻辑后必须跑 `npm run self-test`（256 条样本回归基线）与 `npm run prepush`，并同步样本（见 [`__tests__/README.md`](../w-model-dev/scripts/__tests__/README.md) coverage 矩阵）。

## 6. 依赖巡检流程（人工 npm audit + npm outdated）

**背景**：仓库不集成云端 CI（GitHub Actions / GitLab CI），且 **Dependabot 已剔除**——无 CI 时其自动依赖更新 PR 价值有限（决策记录见 [`2026-08-11-p0-p2-fixes-design.md`](./superpowers/specs/2026-08-11-p0-p2-fixes-design.md) §6）。依赖安全与版本巡检改为**人工定期执行**，本流程为唯一固化渠道。

### 6.1 巡检命令与使用场景

| 命令 | 场景 |
|---|---|
| `npm audit --audit-level=high` | **安全漏洞巡检**：检出 high 以上漏洞（含修复建议）。pre-push 第 13 项已把同一命令升级为**阻断项**（推送前自动跑，high 以上阻断；网络不可达或 registry 不支持 audit endpoint 时自动跳过不阻断）。人工巡检用于 pre-push 之外的时机（如升级依赖后、周期性巡检） |
| `npm outdated` | **版本滞后巡检**：列出落后于最新版的依赖。无安全告警但版本过老时用于规划升级，不阻断 |

### 6.2 处理流程

```bash
# 1. 安全巡检（检出 high 以上漏洞）
npm audit --audit-level=high

# 2. 版本滞后巡检（规划升级）
npm outdated

# 3. 升级受影响依赖（按 audit 建议或手动指定版本）
npm install <pkg>@<version> --save-dev   # 或 npm update <pkg>

# 4. 全量回归：依赖变化可能影响校验逻辑，必须重跑门禁
npm run self-test
npx vitest run --config config/vitest.config.ts
npm run prepush
```

要点：

- **先修漏洞再豁免**：audit 检出的漏洞应升级依赖修复，而非在 baseline 中豁免。
- **回归优先**：升级依赖后 lockfile / node_modules 变化，任何门禁失败都必须回到当批起点修正，不得用 `--no-verify` 绕过（契约见 [troubleshooting.md](./troubleshooting.md) FAQ 与 README「CI 策略」节）。
- **巡检频率建议**：依赖变更后立即执行；无变更时按团队节奏周期性执行（如每月一次）。

## 7. 相关文档

- [排障手册（FAQ + 环境问题矩阵）](./troubleshooting.md)
- [README（快速上手 / 门禁对应 / CI 策略）](../README.md)
- [command-reference.md（/wm 命令 + 错误码与 ERROR_JSON 约定）](../w-model-dev/references/command-reference.md)
- [anti-patterns.md（规则依据权威清单）](../w-model-dev/references/anti-patterns.md)
- [安装指南](./INSTALL.md) / [采用路径指南](./adoption-guide.md)
