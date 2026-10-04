# 深度审计问题全量修复设计规格（2026-10-04）

> 状态：已获用户批准的设计（头脑风暴流程产出）。本文为 WHAT/WHY 规格；任务级 HOW 由后续实现计划承载（`docs/superpowers/plans/`）。
> 来源：2026-10-04 两轮深度分析（全量盘点 + 四层下钻：实现质量 / 信任模型 / 可执行性 / 证据与演化）。文中行号以当日 HEAD（2d94e1b5）审计为准，实现时如有偏移以问题内容定位。

## 0. 背景与目标

深度审计发现：3 处高危代码缺陷、约 18 处中低危代码问题、16 处文档矛盾/缺口、4 处「叙事与实现脱节」。本修复项目一次性收口全部发现，目标是：

1. 消除 fail-closed 链上的真实漏点（含一个全局旁路）；
2. 消灭文档互斥/死路/悬空引用，使活体文档语义自洽；
3. 使「叙事宣称」与「机器现实」一致（改文档，不加新机制）；
4. 全程遵守仓库自身治理（SSoT 先行、CHANGELOG、版本 bump、docs-consistency 计数面、收口全量 prepush）。

## 1. 范围

**In**：问题登记表（§3）全部 41 项——代码 C1-C21、文档 D1-D16、叙事对齐 N1-N4。

**Out（用户裁定）**：

- **信任模型加固不做**：不引入外部锚（签名密钥 / git 证据镜像 / 外部时间戳）。N 系列只做「文档对齐实现」，不推翻仓库「三不承诺」（agent-threat-model.md）。
- **run-log 重建工具化不做**：D1 只定义法定程序（文档），工具化沿用仓库候选区惯例登记（与反模式候选 C1/C2 同区，不新设编号），不在本项目实施。
- **注释考古化整体重写不做**：沿革注释是仓库刻意的决策考古保留，仅修正其中与事实不符的处（C13）。

## 2. 既定决策记录（用户裁定，实现不得推翻）

| #     | 决策     | 内容                                                                                                                                                                                                                                                 |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-1 | 修复范围 | 全量修复（代码 + 文档 + 叙事对齐），不含信任加固                                                                                                                                                                                                     |
| DEC-2 | 组织方式 | 逐问题细粒度：问题登记表驱动，每问题独立 commit + 定向验证；全部完成后**一次**全量 prepush 收口（27+ 次全量验收约 18 小时且与仓库两车道约定冲突，故收口采用仓库「迭代定向 / 验收全量」惯例）                                                         |
| DEC-3 | R11 口径 | **文档对齐实现**：保持毫秒精度比较；文档宣称改为「严格毫秒早于；同毫秒（含无毫秒部分的秒级时间戳）不算早于」。理由：官方追加器写毫秒精度且强制递增（同毫秒 +1ms 步进），毫秒序是真实信息；秒粒度丢弃真序、对合法快速流程产生假阳性，防伪增益趋近于零 |
| DEC-4 | 六节设计 | 已全部批准（组织流程 / 高危详案 / 其余代码策略 / 文档对齐策略 / 测试验收 / 版本收口）                                                                                                                                                                |

## 3. 问题登记表（41 项）

处置类型：**修码** = 代码 + 测试；**修文** = 文档修订；**澄清** = 注释/文档说明补齐、不改行为；**消解** = 由他项修复连带解决；**不修** = 保持现状 + 理由。

### 3.1 代码（C1-C21）

| ID  | 级别 | 位置                                                                  | 问题                                                                                                 | 处置                                                                                                                                                                                                                                 |
| --- | ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | 高   | `lib/run-main.ts:18`                                                  | `process.env.VITEST` 使全部门禁静默 exit 0，fail-closed 链唯一全局旁路                               | 修码：全部使用裸 `runMain(main)` 的 `cli/*.ts`（清单以实现时 grep 为准，审计口径 46/18 与总数 48 存在出入、以实测登记）迁移到 `isDirectInvocation` 守卫后**删除**该判断；守卫测试 + 子进程反证测试（`VITEST=1` 下 CLI 必须正常输出） |
| C2  | 高   | `logic/run-log-logic.ts:1499-1507`（注释 L53-56/L1461-1470）          | R11 毫秒精度比较使「同秒不算早于」宣称落空                                                           | 修文（DEC-3）：实现不动；代码注释三处 + SKILL.md:88/99 + AGENTS.md + operational-recovery + hard-constraints #11 + SSoT §10C 统一改口径；审计 fixtures 是否有依赖旧口径的同秒样本（预期无，有则修正）                                |
| C3  | 高   | `logic/state-write-logic.ts:288-297`                                  | `mkdir(ownerDir)`→`writeFile(metadata)` 竞争窗口使并发写者被误判 `STALE_LOCK`；metadata 截断写非原子 | 修码：metadata 改 tmp+rename 原子落位；`staleOwnerState` 三态化（busy=目录龄<10s 重试 / recoverable=孤儿回收 / stale=metadata 可读且 PID 死 + TTL 超限）；双写者并发测试                                                             |
| C4  | 中   | `logic/run-log-logic.ts:589-1532`                                     | `checkRunLog` 单函数 944 行                                                                          | 修码：原位拆分 R6/R7/R8/R10/R11 规则函数 + 编排器；公开 API 与 violation 顺序不变，现有测试为安全网                                                                                                                                  |
| C5  | 中   | `logic/run-log-logic.ts:542` vs `:1231`                               | `GATE_ACTIONS` 双重定义互相 shadow                                                                   | 修码：删局部声明，统一用模块级（与 C4 同 commit）                                                                                                                                                                                    |
| C6  | 中   | `logic/run-log-logic.ts:517-530` vs `:629-651`                        | D-5 共享谓词内部过滤逻辑两份逐字拷贝                                                                 | 修码：提取共享排除常量，两处消费（与 C4 同 commit）                                                                                                                                                                                  |
| C7  | 中   | `lib/is-main.ts` 注释 vs 实际                                         | 入口守卫双机制漂移（宣称统一 `isDirectInvocation`，实际 46 裸 `runMain`）                            | 消解：C1 迁移完成后，is-main.ts 头注改为与事实一致并声明唯一守卫形态                                                                                                                                                                 |
| C8  | 中   | `logic/state-write-logic.ts:128-135/185-186/223-224`                  | 锁单主机假设未声明；PID 复用期孤儿锁不可回收                                                         | 修文+澄清：wm-write.ts 头注、command-reference 条目、data-models 注记声明「单主机语义，`.w-model` 不得置于网络文件系统」；PID 复用 TTL 双条件保持现状 + 注释说明                                                                     |
| C9  | 中   | `logic/run-log-logic.ts:1130-1131`                                    | R7 用 `new Date()` 而非自家 `recordTimestampMs`，Invalid Date 恒 false 静默跳过时序检查              | 修码：统一走宽容解析工具；不可解析记 blocking violation（防御纵深，schema format 之外兜底）；NaN 用例测试                                                                                                                            |
| C10 | 低   | `logic/checkpoint-logic.ts:24-53`                                     | 自包含 `RunLogEntry.action` 联合是 schema 枚举子集，类型撒谎                                         | 修码：导出 `RUN_LOG_ACTION_VALUES` 常量（as const）与 schema 枚举同源，类型由常量派生；新增 set 相等测试（测试内读 schema）                                                                                                          |
| C11 | 低   | `logic/verifier-logic.ts:401`（R12 `:247`）                           | evidence/R12 路径正则不含反斜杠，Windows 路径假阳性                                                  | 修码：字符集补 `\\` 与盘符前缀 `([A-Za-z]:)?`；fixtures 增补 `src\a.ts:L12=`、`D:\x.ts:L1-L5=` 正例                                                                                                                                  |
| C12 | 低   | `cli/wm-write.ts:99-119`                                              | `--expect-mtime` 与 `--lock-timeout` 数值校验宽严不一                                                | 澄清：不改行为（float ms 来自 `stat.mtimeMs` 合法，floor 语义正确）；两解析处补注释 + command-reference 条目说明差异理由                                                                                                             |
| C13 | 低   | `logic/run-log-logic.ts:1127`；`logic/checkpoint-logic.ts:186`        | 注释与实现不符（「单调递增」实为非递减；「缺失字段跳过」实为记 violation）                           | 修文：修正两处注释与行为一致                                                                                                                                                                                                         |
| C14 | 低   | `cli/check-checkpoint.ts:91-106`                                      | `parseInt`+`isNaN` 死代码、`if (phase)` 恒真、同名 phase 多文件由 readdir 顺序决定胜出               | 修码：清理死代码；多文件歧义 fail-closed（exit 1 列出冲突路径）；与 D3 同 commit                                                                                                                                                     |
| C15 | 低   | `logic/run-log-logic.ts:1075-1080`                                    | R5 O 越权检测仅 4 条正则，`appendFileSync`/`fs.promises.writeFile`/`--eval=`/`python -c` 绕过        | 修码：补 4 类形态；保持启发式定位并注明「检测信号，非安全边界」                                                                                                                                                                      |
| C16 | 低   | `logic/run-log-logic.ts:439-452`；`logic/verifier-logic.ts:178-182`   | Ajv 文案正则耦合（升级即失效）                                                                       | 修码：优先 `instancePath`/`params.missingProperty` 结构化字段，正则保留回退；合成 error 对象单测                                                                                                                                     |
| C17 | 低   | `logic/verifier-logic.ts:601-607/755-774`                             | subCriteria 长度不符仍按下标对齐叠加误报                                                             | 修码：长度不符时报单条清晰 violation 并跳过逐项比对（方向仍 fail-closed）                                                                                                                                                            |
| C18 | 低   | `cli/check-preventive-review.ts` + `logic/preventive-review-logic.ts` | 「报告没写」与「写了读不了」同归一类 violation                                                       | 修码：CLI 读文件层区分两种前缀（missing / unreadable），logic 判据不变                                                                                                                                                               |
| C19 | 低   | `lib/cli-error.ts:58`                                                 | `exitCode: 0\|1\|2` 类型比注释宣称（均为 2）宽                                                       | 修码：核全调用点后收窄为字面量 `2`（若有 0/1 调用点则改注释）                                                                                                                                                                        |
| C20 | 低   | `logic/iceberg-sweep-logic.ts:368-378`                                | R8 有 disagreements 时整体跳过收敛集检查、缺理由注释                                                 | 澄清：核实语义（R6 已红则覆盖检查冗余）后补注释；若核实发现是遗漏，升级为修码并记录                                                                                                                                                  |
| C21 | 低   | `lib/parse-phase.ts:67`                                               | 死代码 `if (arg === undefined) continue;`；`--phase --json` 值吞噬契约仅头注                         | 修码：删死代码；新增契约测试锁定「解析器静默吞值、`phaseFlagPresent` 由调用方 gate」语义                                                                                                                                             |

### 3.2 文档（D1-D16）

| ID  | 位置                                                                                                                  | 问题                                                                                                                        | 处置                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `operational-recovery.md:226` vs `command-reference.md:70`                                                            | run-log 坏行「跳过继续」与「exit 1 blocking」互斥，且禁改历史行使坏行无法合法消除（死路）                                   | 修文：定义法定重建程序——🔴 CHECKPOINT 用户批准 → 坏行快照至 `run-log.jsonl.corrupt-<ts>` → 仅剔除坏行重写（保留行逐字节不变、顺序不变）→ 追加 note 记录引用快照 → 复跑 check-run-log；operational-recovery:226 改指向该程序；工具化登候选区                                                                                                                         |
| D2  | `operational-recovery.md:256` vs SKILL.md 硬约束 #2                                                                   | 成熟度表「阶段门放行 ⚡自动放行」与「用户确认先落盘」互斥                                                                   | 修文（裁决：硬约束胜出）：成熟度表该行改为「始终用户确认（HOTL 固定）；L1/L2/L3 差异仅在文档仪式与 TLA+/BDD 强度」；SSoT §10B 同步                                                                                                                                                                                                                                  |
| D3  | `data-models.md:1014` 等                                                                                              | `checkpoint-log/phase-N` 落盘形态（文件/目录/位置/格式）全文未定义；schema「未集成」注记                                    | 修文+修码：canonical 形态定为 `.w-model/checkpoint-log/phase-<N>.md`（UTF-8、用户确认原文 + 时间与对象要素）；loader 接受集收窄为仅 canonical 形态，现状若另接受 `phase-N.txt`/`N.txt` 等形态则移除并在 fixtures 登记，同名歧义 fail-closed（与 C14 同 commit）；data-models 写 canonical 节，schema 注记改「结构参考，机器校验走 check-checkpoint R1-R5 文本判据」 |
| D4  | `command-reference.md:206`；`subagent-delegation.md:1987`                                                             | 「SKILL.md『self-as-verifier 模式』节」悬空（双向互指、两处皆无）                                                           | 修文：两处改指 `subagent-delegation.md`（核实该文件确有承载节；若无则在该文件补节标题），SKILL.md 指向保持                                                                                                                                                                                                                                                          |
| D5  | `subagent-delegation.md:359`（§6.3）vs `phase-1-requirements.md:330/455` vs SKILL.md:99 vs `command-reference.md:404` | 阶段 1 门禁电池三口径不一致（§6.3 缺 `check-artifact-gate --phase=1 --spec-dir`）                                           | 修文：§6.3 为唯一权威清单，补入该门；phase-1 与 command-reference 改为指向 §6.3；SKILL.md:99 补「完整清单以 §6.3 为准」；实现时对 §6.3 阶段 2-8 清单做同类一致性核查                                                                                                                                                                                                |
| D6  | `operational-recovery.md:134-142`                                                                                     | `appendFileSync` 手搓片段教违规做法（wm-append-runlog 才是唯一合法入口）                                                    | 修文：片段替换为 `wm-append-runlog` 命令示例 + 禁止手搓指向                                                                                                                                                                                                                                                                                                         |
| D7  | `command-reference.md:544-545`                                                                                        | 步骤编号错位（初始化在步骤 4 非步骤 5；「步骤 5.5」不存在于 SKILL.md 十步）                                                 | 修文：改「步骤 4」；「步骤 5.5」改「步骤 5 内 ingestion 规划确认（子步骤）」                                                                                                                                                                                                                                                                                        |
| D8  | `phase-1-requirements.md:232-234`                                                                                     | 产物命名双轨（`<模块>-` 前缀 vs `--spec-dir` 契约的固定名）                                                                 | 修文：执行方法论表统一为固定名 `requirement-spec.md`（与门禁契约一致）                                                                                                                                                                                                                                                                                              |
| D9  | SKILL.md:88/99；`operational-recovery.md:447`；command-reference 各门条目                                             | 五门传参文档失真（漏 `check-preventive-review.ts` 位置参数 `<project-dir>`；check-maturity 缺 `--run-log` 时的行为未说明）  | 修文：三处调用串补位置参数；command-reference maturity 条目补「缺 `--run-log` 时仅出非阻断诊断仍 exit 0（与 check-budget 同式）——阶段门场景流程上必须提供」                                                                                                                                                                                                         |
| D10 | `operational-recovery.md:166`；SKILL.md:146 vs `subagent-delegation.md:377`                                           | 「10 脚本」无清单；「48 个 .ts」与「47 exit-2 + self-test」表述漂移                                                         | 修文：operational-recovery 列出明确清单或指向 §6.3；计数统一表述「48 个 CLI = 47 exit-2 + self-test」，与 AGENTS.md §8 权威表对齐                                                                                                                                                                                                                                   |
| D11 | `phase-1-requirements.md:361`                                                                                         | ingestion 收敛 MAX_ROUNDS=5 耗尽后出口未定义                                                                                | 修文：补「第 5 轮未收敛 → 🔴 CHECKPOINT（用户裁定：回退重分块 / 显式加轮 / 终止）」，与多角色讨论 5 轮安全阀同构；SSoT 对应节同步                                                                                                                                                                                                                                   |
| D12 | `phase-1-requirements.md:20`                                                                                          | `uat-path-mapping.md` 格式定义前向依赖 phase-8 文档                                                                         | 修文：格式权威移至 phase-1（该文件是阶段 1 强制产物），phase-8 改引用                                                                                                                                                                                                                                                                                               |
| D13 | `references/hard-constraints.md` #11                                                                                  | 单条 ~3000 字（R11 时序/自举/历史兼容/双轨契约全部塞入），违背渐进披露                                                      | 修文：拆为 #11 主条（语义 + 指向）+ 细则子节（R11 时序细则 / 自举语义 / 历史兼容窗口 / 调用参数）；编号与锚点不变；eval 锚点受影响处同步 mappings.json                                                                                                                                                                                                              |
| D14 | `subagent/` 3 个文件                                                                                                  | `engineering-algorithm-expert`、`product-requirements-analyst`、`testing-test-manager` 缺 emoji/color（全套唯一格式不一致） | 修文：按现有格式补两字段                                                                                                                                                                                                                                                                                                                                            |
| D15 | `references/quick-self-check.md`                                                                                      | `references/definition-of-done.md` 外部来源引用易误判为仓内断链                                                             | 修文：改为显式外部来源标注格式（外部仓库路径，非本仓文件）                                                                                                                                                                                                                                                                                                          |
| D16 | `subagent-delegation.md:66-82`（§2）vs `:701-704`                                                                     | 两份「每阶段分派时序」不一致：§2 图缺 A-lead 多角色讨论与 ICEBERG-B 冰山扫掠，按 §0 导引加载会漏环节                        | 修文：§2 标准时序图补齐两环节（或注记指向全版图），两份图口径一致                                                                                                                                                                                                                                                                                                   |

### 3.3 叙事对齐（N1-N4，原则：改文档使其与机器现实一致，不加新机制）

| ID  | 位置                                                                 | 脱节                                                                                             | 处置                                                                                            |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| N1  | `references/signature-chain-guide.md:14/147`                         | 「链根 hash 写入 run-log checkpoint 条目」——run-log schema `additionalProperties:false` 无此字段 | 修文：改为「链在 signature-chain.jsonl 内自包含闭环；run-log 不承载链根」；SSoT §10K 对应句同步 |
| N2  | `schemas/checkpoint-log.schema.json:80-83`                           | gateLogPath「供交叉校验退出码防伪造」——check-checkpoint.ts 无该消费逻辑                          | 修文：描述改「定位线索（供人工/外部审计），当前无脚本消费者」                                   |
| N3  | `schemas/gate-log.schema.json` verifiedArtifacts + command-reference | sha256 四处生产、零处消费                                                                        | 修文：两处描述补「取证留存字段，供人工/外部复验，当前无仓内自动消费者」                         |
| N4  | `references/agent-threat-model.md` T2/T3                             | 「阻断」评级高估：时间戳三态仅在「Agent 自愿使用官方追加器」前提下成立，绕过工具不可检测         | 修文：覆盖强度降为「检测（工具内阻断 / 绕过不可检测）」并注明限定；SSoT §10O 同步               |

## 4. 高危修复详案（C1 / C2 / C3）

### C1 VITEST 全局旁路

- **主路径**：已在用 `isDirectInvocation` 守卫的 CLI 保持不变；其余全部裸 `runMain(main)` 的 `cli/*.ts` 改为 `if (isDirectInvocation(import.meta.url)) runMain(main)` 尾部守卫（该形态已有生产路径验证）；迁移清单以实现时 grep 登记进 commit；随后删除 `run-main.ts` 的 `if (process.env.VITEST) return;`。
- **兜底**（仅当个别调用路径下 `isDirectInvocation` 判定不可靠时）：不删 env 判断，反转为测试专用显式变量 `WM_CLI_SKIP_MAIN`（由 `helpers/cli-invoker.ts` 显式设置，无标准环境名可被外部劫持）。
- **测试**：(a) 守卫测试——`lib/` 禁止出现 `process.env.VITEST` 判断；每个 `cli/*.ts` 必须使用 `isDirectInvocation`（grep 型测试，参照 dependency-boundaries 形态）；(b) 反证测试——子进程设 `VITEST=1` 运行轻量 CLI（如 `wm-status`），断言正常输出与正常退出码（非静默 0）。
- **连带**：C7 消解；`helpers/cli-invoker.ts` 不再依赖环境变量副作用（按主路径成立时）。

### C2 R11 口径对齐（DEC-3）

- 实现不动；修订文本为：「gate 记录时间戳**严格毫秒早于**放行记录才算充数；同毫秒（含无毫秒部分的秒级时间戳，Date.parse 后相等）不算早于」。官方追加器强制毫秒递增（同毫秒 +1ms 步进），毫秒序为真实信息。
- **同步面**：`run-log-logic.ts` 注释三处（L53-56 / L1461-1470 / 相关段）、SKILL.md:88/99、AGENTS.md（run-log 条目「同秒不算」句）、operational-recovery.md、hard-constraints.md #11、SSoT §10C、command-reference（wm-append-runlog「时间戳三态」条目措辞核对）。
- **fixture 审计**：全量搜索 run-log fixtures/测试中「同秒不同毫秒」的 gate/release 样本；若存在依赖「同秒不算」的用例，按新口径修正并记录于 commit。

### C3 锁竞争窗口

- **(a) metadata 原子化**：写 `${ownerDir}/metadata.json.tmp-<uuid>` 后 `fs.rename` 至 `metadata.json`；新目录无目标冲突，遇 `EEXIST` 按竞争处理（sleep 重试）。
- **(b) staleOwnerState 三态**：owner 目录在但 metadata 缺失且无 transition 时——目录 mtime 龄 < `metadataGraceMs`（新常量，默认 10s）→ 返回 `busy`（调用方 sleep+continue）；≥ 宽限期 → `recoverable`（孤儿回收路径）；metadata 可读且 PID 死亡 + TTL 超限 → 维持 `stale`（`STALE_LOCK` 语义与 CLI 契约不变）。
- **(c) 测试**：双写者同目标并发 `acquireLock` → 串行成功、零误判 `STALE_LOCK`；模拟「无 metadata 的年轻/年老公主目录」分别走 busy/recoverable；既有 state-write 测试全绿。
- **(d) 声明**（承载 C8）：wm-write.ts 头注 + command-reference 条目 + data-models 注记：「锁为单主机语义；`.w-model` 不得置于网络文件系统共享」。

## 5. 其余代码修复策略（C4-C21）

- **run-log-logic 一揽子（C4/C5/C6/C9/C15 同 commit；C2 注释修订随同）**：原位拆分为规则函数，公开 API 与 violation 顺序不变；`GATE_ACTIONS` 单源化；D-5 排除常量提取；R7 统一宽容解析 + 不可解析 blocking；R5 补正则形态。现有 run-log 测试群即重构安全网，另补 C9/C15 新用例。
- **verifier 域（C11/C16/C17）**：正则 Windows 化 + 长度不符降噪 + Ajv 结构化优先；fixtures 增补 Windows 路径正反例。
- **checkpoint 域（C10/C14 与 D3 联动）**：action 常量同源化 + set 相等测试；loader 死代码清理与歧义 fail-closed；canonical 形态定稿。
- **独立小项**：C12/C13/C18/C19/C20/C21 各自独立 commit（C12/C20 为澄清类，仅注释/文档）。

## 6. 文档对齐策略与权威裁决规则

裁决规则（冲突时适用）：

1. **硬约束 > 成熟度便利**（D2：SKILL.md 硬约束 #2 的用户确认不可被成熟度表自动放行覆盖）。
2. **机器现实 > 叙事宣称**（N1-N4：无实现支撑的宣称改文；不在本项目中补实现）。
3. **唯一权威清单**（D5/D10/D12：门禁电池以 subagent-delegation §6.3 为权威、计数以 AGENTS.md §8 为权威、uat-path-mapping 格式以 phase-1 为权威，他处只指向不复述——与仓库「单一权威文案」原则一致）。

SSoT 先行分流：设计决策类修订（DEC-3 口径、D2 放行语义、D3 形态、D11 出口、N 系列涉及 SSoT 各节）先改 `docs/skill-design-document_SSoT.md` 对应节，再改 `w-model-dev/` 资产，最后根活体文档；纯 bug 修复先代码后 CHANGELOG。

## 7. 测试与验收

- 每个修码项配回归测试（详见登记表「处置」列）；fixtures 增补：Windows evidence 路径、锁并发、R11 口径、checkpoint 歧义。
- 每个 commit 定向验证：`npm run test:affected`（触及注册表层路径自动退全量）+ 该问题对应 check 脚本正反例；文档 commit 跑 docs-consistency + `npm run eval`（D13 等 eval 锚点受影响项同步 `eval/mappings.json` 后必须全绿）。
- **收口验收（一次）**：`npm test` 全绿 + self-test + eval + `npm run prepush` 19 项全部通过；prepush 实测耗时记入 CHANGELOG（仓库惯例）。
- 计数面核对：预期零新增 CLI / 零新增 schema / references 数不变；若实现中偏离，须在 CHANGELOG 登记并同步活体计数。

## 8. 版本与收口

- 版本 `42.13.0`（`npm run version:bump` 七文件同步）。
- CHANGELOG 条目含：问题登记表摘要（41 项逐条「修/澄清/消解/不修+理由」）、DEC-1~DEC-4 决策记录、计数影响、prepush 实测耗时。
- 交付物：修复后的 `w-model-dev/` 资产 + 更新的根活体文档 + 本规格 + 实现计划与执行账本（`docs/superpowers/plans/`）。

## 9. 风险与回退

| 风险                                                                                | 缓解                                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| C1 迁移后个别 CLI 在某调用路径（self-test / cli-probe / prepush 子进程）不执行 main | 迁移后跑 self-test 全量（覆盖全部 CLI 三态）即覆盖；兜底方案见 §4-C1                     |
| C4 拆分引入行为漂移                                                                 | 公开 API 与 violation 顺序冻结；现有测试群 + self-test 样本回归                          |
| C3 锁改动引入新死锁                                                                 | 宽限期上限受 `lockTimeoutMs` 约束（deadline 循环不变）；并发测试 + 既有 state-write 测试 |
| D13 拆节破坏 eval 锚点                                                              | mappings.json 同步 + `npm run eval` 强制全绿；锚点内容保持原文迁移                       |
| R11 口径修订影响历史 run-log 判定                                                   | 毫秒比较逻辑不变，仅文档/注释措辞变更，历史判定结果零变化；fixture 审计兜底              |
