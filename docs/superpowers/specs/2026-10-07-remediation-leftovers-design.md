# W-Model 技能包遗留收口规格（43.0.1 热修 + 批次 7/8/9 增量）

- 日期：2026-10-07
- 状态：已批准（用户逐项定案 7 项决策后编写）
- 关系：本规格是**增量规格**——批次 7/8/9 的主体设计依据仍是已批的 `2026-10-06-w-model-remediation-design.md` §6-§8（下称「主规格」），本文件只承载：①批次 6 合并期新增发现的设计，②用户 7 项新决策的设计，③51 项总清单与批次归属。
- 下游：43.0.1 热修与批次 7 各一份实现计划（`docs/superpowers/plans/`），批次 8/9 计划在前一批合入后编写。

## 0. 决策记录（2026-10-07，用户逐项定案）

| #   | 决策                  | 结果                                                                                                                 |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | autocrlf×R19 哈希失配 | **两者都做**：.gitattributes 修环境 + 归一化哈希修机制                                                               |
| 2   | 降级授权              | **除非 human 明确授权否则不允许降级**（降级与升级对称走签名链审批）                                                  |
| 3   | R6 首条 history 起点  | **加首条 from==L0**（第四判定；存量资产迁移）                                                                        |
| 4   | `*_token` 盲区        | **彻底消除 + 防复生守卫**（词段命中即脱敏 + NEGATIVE fixtures 锁定）                                                 |
| 5   | subagentSpawns        | **升级为真门禁**（check-budget 消费 maxSubagentSpawns；estimated 不计入）                                            |
| 6   | 产出形态              | **增量规格**（本文件；主规格 §6-§8 不重写、继续有效）                                                                |
| 7   | 执行节奏              | **连续推进**：43.0.1 → 批次 7 → 批次 8 → 批次 9；每批独立 prepush 全绿 + 终审宽范围审查后合入 main，随后自动开下一批 |

## 1. 热修 43.0.1：autocrlf×R19 双修（环境侧）

**背景**：批次 6 合并期实测——全局 `core.autocrlf=true` 下，合并 checkout 把文件重写为 CRLF 落盘，R19 登记的 LF 内容 SHA-256 全量失配，self-test verifier 区 7 败。合并现场已用仓库级 `autocrlf=false` + 重物化临时修复，但**新 clone 不继承仓库级配置**，首次 self-test 必假红。

**环境侧修复（本热修）**：

1. 前置盘点：`git ls-files --eol` 统计仓内 blob 的 CRLF 存量与二进制文件。若存量 blob 为 CRLF，renormalize 将产生大 diff——此时停下向用户回报规模再动。
2. 新增 `.gitattributes`：`* text=auto eol=lf`，显式豁免二进制（`*.jar binary`）。
3. `git add --renormalize .` + 单独提交。
4. 验证：renormalize 后 `self-test 403/403`（登记哈希=LF 哈希应全部回配）+ **fresh-clone 实证**（`git clone` 本仓到临时目录，跑 self-test verifier 区，预期全绿——这是「新 clone 假红」的直接关闭证据）。

**机制侧修复（归一化哈希，归入批次 7，与 R19 主题相邻）**：`lib/reviewed-artifacts.ts` 读盘后做 CRLF→LF 归一化再计算 SHA-256；全部 verifier fixture 登记哈希按归一化口径重算。此后任何 checkout 配置下哈希恒稳定。规格措辞同步：`reviewedArtifacts.sha256` 语义改为「归一化内容（CRLF→LF）的 SHA-256」（verifier-output.schema.json description + verifier-spec §6.2）。`SENSITIVE_METADATA_PATTERN` 行内模式不受影响。

## 2. 批次 7（43.1.0）：主规格 §6 + 五项新增

主体 = 主规格 §6 全部（B1-B10 形式化加固、A11-A14 图谱/RTM 收严、C16）。新增/取代项：

1. **降级须 human 授权（决策 2）**：check-maturity 新增规则——当 `level < history 末条 to`（降级形态，R6 现行判定允许）时，必须存在通过 `verifyMaturityApproval` 校验的 human 审批链（复用批次 6 的 helper；check-maturity CLI 仿 check-artifact-gate 装载签名链，logic 保持纯函数注入）。无授权的降级 → blocking（降级无法过闭环五门 = 「不允许降级」的机器化）。operational-recovery 降级流程同步改写：「降级须用户确认 + O 落 role=human/targetKind=maturity 审批条目」。e2e/demo 资产无降级形态，零迁移。
2. **R6 第四判定（决策 3）**：history 首条 `from == 'L0'`；违者 blocking。存量迁移：`build_workspace.py` 的 maturity.json history 补 `L0→L1` 首条；全 fixtures 检查。
3. **`*_token` 盲区消除 + 防复生（决策 4）**：`isSensitiveKey` 词段分支**取消长度守卫**——键的任意分隔词段命中已知敏感词干（token/password/key/secret/credential 等）即脱敏（词段边界本身即强信号；`refresh_token`/`session_token`/`jwt_token` 全覆盖）。显式声明保守代价：`token_count` 类计数键会被脱敏。后缀（endsWith）分支维持 ≥6 守卫（防 `mytoken` 式后缀误伤）。防复生：`refresh_token`/`session_token`/`jwt_token` 三变体 + `token_count` 保守脱敏声明全部进 NEGATIVE-COVERAGE/测试锁定。
4. **归一化哈希机制侧（决策 1 后半）**：见 §1。
5. **批次 6 跟进测试两项（终审甄别的合并后跟进项，提前并入）**：①默认路径损坏 gate-log fail-closed 两用例（非 JSON / 顶层 exitCode 非 number，CLI 级）；②D-1 收窄负例（S 消费 R 且 action 非 fix → R9 拒）。

批次 7 完成定义 = 主规格 §6 验收 + 上述 5 项各自验收；prepush 全绿后终审、合入。

## 3. 批次 8（43.2.0）：主规格 §7 + 三项新增

主体 = 主规格 §7 全部（C3/C5 剩余/C6-C13/C17-C20）。新增/取代项：

1. **subagentSpawns 门禁化（决策 5）**：先在 data-models.md 定义口径（「run-log 记录自报的本记录触发的子代理分派数；estimated=true 记录不计入」），然后：budget.schema 回填 `perPhase.maxSubagentSpawns`（批次 6 A5 删除的是「零消费死字段」；本决策使约束成真，字段回归有据——CHANGELOG 须写明这一来龙去脉）；check-budget 新增规则 Σ(记录.subagentSpawns，按阶段) > 阈值 → blocking；恢复批次 6 被删的对应测试并补新规则用例。fixtures 回填。
2. **C19 语料扩充纳入三类易残留锚点**：signature-chain-guide D-1 行、superpowers-adoption 词表行、loop-engineering-adoption-design 退役注记行——批次 6 终审实证「非锚点行的级联残留逃过全部既有门禁」，语料锚点化是结构性封堵。
3. **ai-native-sdlc-adoption.md:134** 划界表行头「sigHash v2 vs evidence provenance」→ 中性命名（如「签名链哈希 vs 证据 provenance」）。

## 4. 批次 9（43.3.0）：主规格 §8 原样

D1-D8 + A10/A16-A19，无增量。主规格 §8 的「风险与回退」继续适用。

## 5. 总清单与批次归属（51 项）

| 批次             | 项数 | 明细                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43.0.1 热修      | 1    | autocrlf 环境侧（.gitattributes + renormalize + fresh-clone 实证）                                                                                                                                                                                                                                          |
| 批次 7（43.1.0） | 21   | 主规格 §6 的 B1-B10（10）+ A11-A14（4）+ C16（1）= 15，加六项新增：归一化哈希机制侧（1）+ 降级 human 授权（1）+ R6 首条 from==L0（1）+ `*_token` 盲区消除与防复生（1）+ gate-log 损坏两用例（1）+ D-1 收窄负例（1）。注：B10 一项已含「五类退化解 NEGATIVE fixtures」与「tla-plus/bdd §0 分节导引」两个子项 |
| 批次 8（43.2.0） | 16   | 主规格 §7 的 14 项 + subagentSpawns 门禁化（1）+ ai-native-sdlc:134（1）；C19 扩语料含三类易残留锚点与 subagentSpawns 新锚点（并入 C19 不单列）                                                                                                                                                             |
| 批次 9（43.3.0） | 13   | 主规格 §8 的 D1-D8（8）+ A10/A16-A19（5）                                                                                                                                                                                                                                                                   |

完成定义：51 项全部「已销账」或「经用户裁定的 parked」，不允许静默遗留。

## 6. 验证与销账机制

沿用批次 6 惯例：每批规格内 checklist 逐项销账；prepush 19 项单次全绿（快速车道不可替代收口）；专项复跑（批次 7 = 红队实验 1/2/3 + 恒真不变式/空转 Next 探针 + fresh-clone self-test；批次 8 = eval 全绿 + docs-consistency；批次 9 = CI 首跑 + 变异实验抽测）；CHANGELOG 每版一节 + decision-log 裁定登记；终审宽范围审查逐批执行。

## 7. 风险与回退

| 风险                                               | 缓解                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| .gitattributes renormalize 大 diff                 | 前置盘点，规模异常即回报用户再动                                                                                                      |
| 归一化哈希改变语义引既有消费方混淆                 | schema description + verifier-spec + CHANGELOG 三处声明；「归一化内容 SHA-256」成为唯一口径                                           |
| 降级须授权与运维应急处置冲突（故障时来不及走审批） | 折衷已内置：审批链是 O 落盘的既有人类确认记录，用户确认本身即「明确授权」；文档写明应急处置路径（用户在 CHECKPOINT 确认即产生链条目） |
| maxSubagentSpawns 字段「删了又回」造成认知混乱     | CHANGELOG 显式写来龙去脉（A5 删零消费死字段 → 本版使约束成真）；data-models 定义口径                                                  |
| R6 首条判定迁移漏存量资产                          | 实施时全 fixtures grep `history` 逐个核对；e2e 生成器同步                                                                             |
