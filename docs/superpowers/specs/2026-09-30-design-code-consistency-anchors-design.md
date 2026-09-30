# 批次 1：设计↔代码一致性证据化对账（A1 档三 + A2 诊断增强 + B6）设计规格

> **日期**：2026-09-30
> **状态**：设计已获批（四节分节展示均经用户裁定），待编写实现计划
> **来源**：13 个外部来源吸收分析（DHH/37signals、Anthropic AI-native SDLC 两篇、Amplitude 3x、Stripe Minions、Spotify Honk 三部曲、archify 深度克隆分析）→ 三轮仓内对比复核（原文逐行验证）→ 五批次划分 → 批次 1 头脑风暴
> **关联**：批次 2（设计期未决问题 A3+A4）、批次 3（门禁工程 B1+B2+B3-scope）、批次 4（派单与流程 B4+B5）、批次 5（治理与叙事 C1+C2+C4）另行立项，本规格不覆盖

---

## 1. 背景与动机

外部来源吸收分析 + 仓内复核确认两个事实：

1. **SD→codeModule 终检是子串匹配**（`w-model-dev/scripts/logic/gate-logic.ts:205-243`）：SD id 去 `SD-` 前缀按 `[-_.]` 拆段（长度 ≥2）后任一段包含于 codeModule 字符串即算映射成立，且不校验 src 路径在磁盘存在、无行号粒度。词形 id 存在误映射空间（如 `SD-USER` 的段 `user` 可命中 `src/user_service.ts`），幽灵路径（codeModule 指向不存在的文件）不可检出。
2. **设计产物无组件级源证据**：SD/DD 模板的追溯表「设计落点§」指向设计文档内部锚点（模块 ID / 类设计节），代码坐标仅存在于阶段 5 RTM `codeModule`（文件级、无行号）；评审层的 path+line 证据门禁（`evidence-anchored-tree.md` R15f、`verifier-spec.md` §6.1/§6.2.1）不作用于设计↔代码映射层。

archify 的核心借鉴（见 §10 证据锚点）：**组件级源证据 + 完成判据「每断言有源证据、无数量目标」+ Delta 变更分类 + 无共享 ID 即 fail-closed**。本批次把这四条纪律移植到 W 模型的设计↔代码一致性域。

顺带修复复核发现的悬空引用（B6，`operational-recovery.md:188`）。

## 2. 范围与边界

**本批次做**：A1（档三：锚点语法 + 双向精确对账 + 存在性/行号校验）、A2（诊断增强：变更分类词汇 + 零交集 fail-closed 守卫）、B6（悬空引用修复）。

**本批次不做**（防止越界）：B1 的 `StructuredViolation` subject/fixHints 扩展（批次 3）；GATE_JSON 与签名链的**字节绑定**（被验工件哈希清单，批次 3；本批 GATE_JSON 仅增可选分类字段，见 §5.2）；`fixRecommendation` scope 字段（批次 3）；批次 2/4/5 全部内容；不新增门禁脚本；不改 pre-push 项数；不动签名链与 run-log 结构；不动 iceberg 脚本输出结构。

## 3. 已裁定决策（用户裁定记录）

| # | 决策 | 裁定 | 理由摘要 |
|---|---|---|---|
| D1 | 批次划分 | 五批次（一致性主线/设计期未决/门禁工程/派单流程/治理叙事），本规格仅批次 1 | 13 项横跨六个改动面，单规格无法覆盖 |
| D2 | A1 校验强度 | **档三**（最严：声明式对账 + 存在性 + 组件级锚点 + 双向对账） | 用户裁定最大严格度优先 |
| D3 | 存量迁移 | **硬切全量**，不设迁移通道；存量红即倒逼补锚点（含本仓 samples/eval 语料 36 处/19 文件） | 用户裁定接受 Brownfield 首过成本 |
| D4 | A2 形态 | **诊断增强型**：分类仅供 R 定位与 reworkHints 消费，阻断性不变（任何真实差异仍违规）；不采阻断分级 | 与 D2/D3 严格化立场自洽；仓内「跳过≠通过」强立场 |

## 4. A1 详细设计（档三）

### 4.1 锚点语法：升级 `codeModule` 值语法，不加新列

沿用现有单格多值实践（`templates/coding.md:72`「多个用逗号分隔」），把每个条目从文件级升级为行号锚点级：

```
REQ 行 codeModule   := 条目 ("," 条目)*            # 逗号分隔，条目两侧允许空白
条目（REQ 行）      := "SD-" <SD节点id> ":" <src路径> ":L" <start> ("-" <end>)?
条目（NFR/CON 行）  := <src路径> ":L" <start> ("-" <end>)?
NFR/CON 整格特例    := "横切"                        # 横切无单一落点，免锚点
<src路径>           := 以 "src/" 开头的仓库相对路径（沿用现有 ^src/.+ 约束）

前缀解析规则：<SD节点id> 以其后的首个 ":" 终止（SD 节点 id 本身不含冒号），解析取首个 ":" 前的完整 `SD-...` 串与图节点 id 做全等比较。
行号约束：start ≥ 1；若有 end 则 end ≥ start；end ≤ 注入表中该文件总行数（注入面存在时）
```

示例：`SD-2.1:src/middleware/rateLimit.ts:L42-58, SD-2.1:src/middleware/rateLimit.ts:L120`。

`checkCodeModuleFormat`（`gate-logic.ts:251-277`）正则同步升级为**逐条目**校验（现正则对逗号串整体放行属侥幸，一并修正）：REQ 条目 `^SD-[^:]+:src/.+:L\d+(-\d+)?$`，NFR/CON 条目 `^src/.+:L\d+(-\d+)?$`，`横切` 特例整格放行。

### 4.2 双向精确对账：`checkSdToCodeModuleMapping` 重写

废除拆段子串逻辑与数字 id `${id}:` 特判（`gate-logic.ts:220-235`），统一为前缀解析精确对账：

- **第一向（图→RTM）**：每个 SD 图节点须有 ≥1 条 REQ 条目，其 `SD-<id>:` 前缀**精确等于**该节点 id。
- **第二向（RTM→图）**：每条 REQ 条目的 SD 前缀须 ∈ 图 SD 节点集合（防幽灵 SD 引用）。
- **存在性 + 行号校验**：纯函数层不读盘——CLI（`check-artifact-gate.ts`，生产路径恒传 projectRoot）读盘构建 `path → 总行数` 表经注入面传入。条目 src 路径 ∉ 注入表 → SDMAP-3；行号违反 4.1 约束 → SDMAP-4。**注入面缺失时该两子项记 `skipped` 计数（不冒充 `passed`），不判违规**——R15f 注入面先例同构（`evidence-anchored-tree.md:63`），纯单测上下文不误红，CLI 生产路径恒注入故实际不触发。
- 现存两种 id 形态（`SD-001` 词形数字、`SD-2.1` 数字层级，见 samples 实例）均天然兼容前缀精确对账，无迁移语义。

### 4.3 SDMAP 规则定义（5 条稳定规则名，进 GATE_JSON violations 分布与 structuredViolations）

| 规则 | 含义 | classification（A2 联动，见 §5.1） |
|---|---|---|
| SDMAP-1 | 图→RTM 缺映射：SD 节点无任何前缀精确等于其 id 的 REQ 条目 | semantic |
| SDMAP-2 | RTM→图 幽灵 SD：REQ 条目 SD 前缀 ∉ 图 SD 节点集 | semantic |
| SDMAP-3 | 路径不存在：条目 src 路径 ∉ 注入表（仅注入面存在时判） | evidence-only |
| SDMAP-4 | 锚点行号非法：start<1 / end<start / end>总行数（仅注入面存在时判） | evidence-only |
| SDMAP-5 | 条目格式不符：不匹配 4.1 语法（替换 `checkCodeModuleFormat` 现有报错，逐条目报） | semantic |

structuredViolations 沿用现有形态 `StructuredViolation{rule, field, message}`（`lib/types.ts:11-15`），classification 以可选字段附加（见 §5.2）。

### 4.4 模板与指引同步

- `templates/rtm.md:15` 示例行改锚点形态——顺带统一既有不一致（rtm.md 示例 `{{userController.ts}}` 文件级 vs coding.md:72 `SD-xxx:src/...` 格式说明）。
- `templates/coding.md:72-73` DoD 行更新为锚点语法说明。
- `references/rtm-guide.md` 补回填完成判据原文：「每个 codeModule 断言有源证据锚点；**无数量目标**——不设锚点数/行数凑数指标」（archify 借鉴核心，与其「完成=每断言有源证据」判据同构）。
- `references/phase-5-coding.md` 回填指引同步（S 子代理 RTM 回填职责表述处）。

### 4.5 硬切范围（D3）

本仓存量 36 处 codeModule 值 / 19 个文件（`scripts/samples/` + `scripts/__tests__/` fixtures）全量补锚点；`NEGATIVE-COVERAGE.md` 登记 5 条新规则的负向案例（fixture + 机制 + 所防回归 + 派生锚），过 `check-samples-coverage` 的真实 exit-2 探针（零漂移）。eval 语料核查：实现时确认 `eval/mappings.json` 是否有断言绑定 check-artifact-gate 输出形态，有则同步维护（TSV 随轮更新）。

## 5. A2 详细设计（诊断增强型）

### 5.1 ChangeClassification 词汇表（三值；cosmetic 不引入——archify 的 geometry 类比在流程一致性域无对应物）

| 分类 | 定义 | 批次 1 的产出点 |
|---|---|---|
| `topology` | 集合成员差异（状态/转移/分支的缺余） | state-machine 全部差异；code-tla 维度 2（状态转移）、维度 3（Next 分支） |
| `semantic` | 语义/映射/不变式内容差异 | code-tla 维度 1（SD→codeModule 映射）、维度 4（不变式覆盖）；SDMAP-1/2/5 |
| `evidence-only` | 断言本身未变、仅证据位置失效（路径不存在/锚点行号非法） | SDMAP-3/4；冰山 R6 锚点类差异项（词汇层） |

阻断性不变：任何差异仍违规；分类仅供 R 根因定位与 reworkHints 排序消费（semantic/topology 优先于 evidence-only 排序的指引写入 root-cause-locator 的消费说明）。

### 5.2 输出结构扩展（向后兼容可选字段）

- `state-machine-logic.ts` 的 `StateMachineConsistencyResult` 四个差异数组（:31-34）条目、`code-tla-logic.ts` 的 `DimensionResult.violations`/`structuredViolations`（:121-127）条目、SDMAP 的 structuredViolations：均增可选 `classification` 字段（值域 §5.1）。
- GATE_JSON 的 violations 分布口径不变（分类不改变计数）。

### 5.3 无共享 ID fail-closed（cannot prove same system）

现有零证据守卫（`state-machine-logic.ts:48-51`：四数组全空→违规）的扩展，两者分开报：

- **state-machine**：两侧输入均非空，但状态集交集与转移键交集**均为空** → 新守卫条目 `passed=false`，报文「无共享状态与转移（cannot prove same system），不判一致」。状态集有交集而转移无交集（或反之）→ 正常走差异报告，不触发守卫。
- **code-tla**：比对键零交集同构——图 SD 节点集与 manifest 引用的 SD 集、双侧转移键，均非空且零交集 → cannot-prove 违规，`passed=false`（实现计划中按各维度比对键精确化）。

### 5.4 iceberg 词汇对齐（仅文档层，不动脚本）

词汇表写入 `references/iceberg-sweep-guide.md` §8 作 R 分析词汇；iceberg reasons 已带池前缀（`R6[design-wide]`，§8.3 原文），其输出结构不改。

## 6. B6 悬空引用修复

`references/operational-recovery.md:188` 删除「见 hard-constraints.md『错误聚集与超标丢弃』」括注（该锚点在 hard-constraints.md 中不存在，复核 grep 确认），改为指向本文「超标模块重写」节自身；实现时核对反模式 #47（大规模重构式改动）语义匹配度，匹配则加关联注记，不匹则仅删括注。

## 7. 实施顺序与同步面（按仓规 SSoT 优先）

1. **SSoT 先行**：`docs/skill-design-document_SSoT.md` 中承载「SD→codeModule 终检」语义的节（`gate-logic.ts:200` 注释指向 spec §3.4.4，实现时定位精确节号）改写为双向对账 + 锚点语法；一致性分类词汇入 SSoT 对应节。
2. 资产层：`gate-logic.ts`（对账重写 + 格式升级 + 注入面）、`state-machine-logic.ts` / `code-tla-logic.ts`（分类 + 守卫）、`check-artifact-gate.ts`（注入面接线 + GATE_JSON 扩展）。
3. 模板与指引：rtm.md / coding.md / rtm-guide.md / phase-5-coding.md / iceberg-sweep-guide.md / root-cause-locator.md（消费说明）/ operational-recovery.md（B6）。
4. 周边同步：`command-reference.md` check-artifact-gate 条目（SDMAP 规则枚举与 skipped 语义）；`conventions.md` 术语表登记（代码锚点 / ChangeClassification）；CHANGELOG + minor bump。
5. samples / NEGATIVE-COVERAGE /（如需）eval 语料。
6. 测试与收口（§8）。

## 8. 测试与验收判据（批次 1 DoD）

1. logic 单测全绿：前缀对账（两向 × 两种 id 形态）、锚点正则（逐条目/逗号多值/横切特例/非法区间）、分类映射、零交集守卫（全空/零交集/部分交集三态分报）。
2. CLI 注入面集成测试：projectRoot 注入存在性 + 行数校验 + 注入缺失记 skipped。
3. samples：36 处补锚点后 self-test 全绿；`check-samples-coverage` 通过（含 exit-2 探针零漂移）。
4. `check-docs-consistency` 通过（command-reference/术语表/SSoT 同步后）。
5. 收口全量：`npm run prepush` 19 项通过。
6. 兼容性：GATE_JSON 新增字段均为可选，既有消费者零破坏。

## 9. 风险与已知代价（用户已裁定接受）

- **硬切**：Brownfield 采用方 phase≥5 首过即须全量补锚点；仓外用户已有非锚点 codeModule 升级后判红——D3 裁定接受。
- 逗号多值逐条目校验严格化会暴露此前侥幸放行的混合串（属预期修正）。
- rtm.md 模板示例统一产生模板 diff；历史归档不受影响（归档不参与门禁）。

## 10. 仓内证据锚点（复核判定书引用，实施时按此定位）

- `w-model-dev/scripts/logic/gate-logic.ts:205-243`（子串匹配现状）、`:251-277`（格式正则）、`:155-164`（PHASE_TRACE_FIELDS，codeModule 自 phase 5）、`:1161-1171`（注入 fs 先例）
- `w-model-dev/references/evidence-anchored-tree.md:59/63/65`（R15f 判据、注入面缺失即跳过语义、只判行号不判内容）
- `w-model-dev/templates/coding.md:72-73`（逗号多值实践 + DoD）、`w-model-dev/templates/rtm.md:13-15`（表头与示例）
- `w-model-dev/scripts/logic/state-machine-logic.ts:24-51`（结果结构 + 零证据守卫）、`code-tla-logic.ts:121-127`（DimensionResult 双轨）
- `w-model-dev/references/iceberg-sweep-guide.md:222-229`（§8.3 分池对账原文）
- `w-model-dev/references/operational-recovery.md:184-190`（B6 悬空引用）
- `w-model-dev/scripts/lib/types.ts:11-15`（StructuredViolation）
- 存量：36 处 codeModule 值 / 19 文件（`scripts/samples/` + `scripts/__tests__/`，2026-09-30 实测）
