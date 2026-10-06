# 轮次决策记录：第 48 批（批次 6 信任链修复，43.0.0）

> 41.7.0 起 SSoT 只承载当前设计事实，本文件登记批次 6（43.0.0）实施前的关键裁定，
> 对应 [43.0.0]（CHANGELOG.md 条目随批次 6 发布回填）。裁定来源：用户三项决策与
> 修复规格 [2026-10-06-w-model-remediation-design.md](../../superpowers/specs/2026-10-06-w-model-remediation-design.md)
> （§2 约束、§5 批次 6）；SSoT 权威摘要见其 §10R。原文保留，不篡改。

#### 第 48 批：信任链关键修复 + legacy 全清除（43.0.0，2026-10-06）

**目的**：堵死三类实测穿透面（签名链 targetKind 洗白 / 伪造 VerifierOutput / 伪造 run-log），收紧 maturity/budget 门禁钥匙，修复 TLA+/BDD 已确证 bug 与脱敏变体漏网，注入三条款与 L0 契约入包；全量清除 legacy 兼容机制。

**裁定 1：targetKind 入哈希（sigHash 收敛单一 v3 公式）**

- **背景**：红队实测穿透——`targetKind`/`gateExitCode`/`gateLogPath` 不入 sigHash，已签条目单字段改写 `targetKind` 即可洗白 R9 违规链（规格 §0.1 / §4 A1）。
- **裁定**：sigHash 公式直接改为纳入 targetKind + gateExitCode + gateLogPath；`sigHashAlgo` 枚举收敛为单值 `v3`，删除 v1/v2 分流重算逻辑（R11 v2 校验随之简化为单公式重算）；R9 三例外表述随新公式更新（改 targetKind 必挂 R6 重算，洗白路径关闭）。
- **不采用的替代方案**：兼容分流（保留 v1/v2 分流、存量条目按旧公式校验）与迁移代码——被用户裁定否决（毁弃存量数据，不兼容）；受影响 signature-chain fixtures 机械重写为新形态。

**裁定 2：legacy 全清除与毁弃存量数据**

- **背景**：存量 legacy 兼容机制（LEGACY_VARIANT / LEGACY_UNSCOPED / LEGACY_REWORK_HINTS 吸收谓词、`isLegacyAbsorbableEntry` 共享谓词、R11 D-6 历史兼容后置窗口）与 action enum 15 个零样本死词 + `opsx_*` 四值长期双轨并存，扩大伪造面与维护成本（规格 §2 legacy 行 / §4 A15 / §6.3）。
- **裁定**：全部 legacy 机制一并清除（用户裁定）；action enum 32→18（删 15 死词与 `opsx_*`，增 `event-route`）；保留 R0 首阶段自举（首次运行语义，非 legacy）、时间戳三态、`--correct` 追加更正、毫秒严格时序；历史文档只作历史保留、不改写。
- **不采用的替代方案**：兼容分流/迁移代码（渐进废弃、双轨过渡、旧值映射）——被用户裁定否决（毁弃存量数据，不兼容：直接改判据/公式/枚举，fixtures 重写为新形态）。

**裁定 3：R6 交叉校验默认化（gate-logs 目录约定）**

- **背景**：红队实测从零伪造 12 条自洽 run-log 通过 R1-R11——R5/R6 交叉校验依赖可选 `--gate-logs`，未提供即跳过（规格 §0.1 / §4 A3）。
- **裁定**：R6 默认化——CLI 从 run-log 同目录约定路径 `gate-logs/` 自动加载（`--gate-logs` 降级为覆盖参数）；凡 gate 记录带 `gateLogPath`，文件必须存在且 exitCode 与记录一致（blocking，移除「仅当提供时执行」的可选语义）。
- **不采用的替代方案**：维持可选参数 + 文档加强提示——被用户裁定否决（可选语义即穿透面）；亦不引入密码学行级完整性（能力分工见 SSoT §10R：将伪造成本提升到「须持有产物文件并重算哈希」，不提供密码学认证）。

**裁定 4：maturity level 变更须 role=human 审批链**

- **背景**：审计确认 maturity 是唯一「钥匙交给被门禁者」的子系统——level 的机器侧唯一消费点是 check-artifact-gate 的 TLA+/BDD 豁免，O 自写 `L0` 即关门禁；history 无链校验（demo 首条即 L1→L2 照过）（规格 §0.3 / §4 A4）。
- **裁定**：level 变更（升级/降级）须有签名链审批条目（role=human、绑 v3 哈希公式）；check-artifact-gate 消费 level 前校验审批链存在且指向当前 level，无链即不豁免（fail-closed）；history 链校验（`from == 上一条.to` / `to > from` / 末条 `to == 当前 level`）；删除三预留死字段（`budgetBurnRateExceeded` / `checkpointRejectionStreak` / `unlockConditions`）。
- **不采用的替代方案**：对存量无链 history 补默认审批条目或写迁移脚本——被用户裁定否决（毁弃存量数据，不兼容）；审批链复用签名链 v3 公式，不另建新机制。

**裁定 5：budget estimated=true 违规化（约束 #4）**

- **背景**：budget 三死字段（`perPhase.maxSubagentSpawns` / `perPhase.maxReworkRounds` / `project.maxTokensPerSession`）零消费；`estimated=true` 的 run-log 记录 tokens 仅「照常计入」未违规化；R1 只查相等不查序（规格 §4 A5）。
- **裁定**：删除三个零消费死字段；`estimated=true` 的 run-log 记录 tokens 改为违规（约束 #4 真实执行的直接推论）；R1 时效性改顺序比较（`budget.updatedAt < project.updatedAt` 违规）；R5 无复位通道维持现状，operational-recovery.md 挑明「唯一出口 = 用户上调阈值或阶段归档换日志」。
- **不采用的替代方案**：estimated 记录保留「照常计入」语义或加白名单过渡——被用户裁定否决（毁弃存量数据，不兼容）；不加新复位机制（YAGNI）。

| 维度 | 内容 |
|---|---|
| self-test | 基线 398 不变（本批文档先行，纯 markdown 提交） |
| 版本号 | 43.0.0（批次 6 目标版本，breaking；本提交为发布前置文档登记，代码落点随批次 6 任务 3-17 落地） |
