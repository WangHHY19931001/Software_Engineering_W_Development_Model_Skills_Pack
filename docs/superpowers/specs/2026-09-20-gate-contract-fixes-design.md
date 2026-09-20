# 门禁-返工链契约修复设计（2026-09-20）

- 计划版本：v1.0
- 状态：待用户评审
- 来源：`docs/debug/2026-09-20-wm-8phase-live-run/README.md` 发现 D-1~D-10（真实 8 阶段调测，38 次门禁拦截实录）
- 范围：方案 A「语义增补」——恢复返工链的门禁表达力，保留反模式 #18/#19 守护

## §0 证据基线与约束

| 叶子 | 结论 | 证据锚点 | 状态 |
|---|---|---|---|
| L1 | 签名链矩阵禁返工来源（S 禁 [V,G,R]、V 禁 [G,R]、R 禁 [S]），与返工链设计矛盾 | `w-model-dev/scripts/logic/signature-chain-logic.ts:83-91`；`references/signature-chain-guide.md` §2/§3 | 🟢 |
| L2 | run-log 配对强制 fix→S；R3/R7 按 `basedOnReport` 精确配对，V 执行的修复无合法表达 | `logic/run-log-logic.ts:482-493`（`ACTION_ROLE_PAIRING`）、`:820-844`（R3 配对） | 🟢 |
| L3 | code-tla 装载 `path.resolve(manifestDir, spec.tlaPath)` 未用 `basePath`，与 check-tla-model 基准不一 | `cli/check-code-tla-consistency.ts:156` | 🟢 |
| L4 | killSwitch 触发口径 = `action==='rework'` 计数（真实返工记 fix → 恒 0）；无 Σtokens 实效校验 | `cli/check-budget.ts:81-93`；`logic/budget-logic.ts:116-123` | 🟢 |
| L5 | 同条 run-log 记录：check-run-log 有 legacy 吸收（非阻断），check-checkpoint 直接 `[schema]` blocking | `logic/checkpoint-logic.ts:185-189` vs `logic/run-log-logic.ts:521-584` | 🟢 |
| L6 | R11 要求 check-checkpoint 成功记录早于放行；该门需已存在 checkpoint 记录才通过 → 阶段 1 结构性死锁 | `logic/run-log-logic.ts:55-58,1360-1392`；`checkpoint-logic` | 🟢 |
| L7 | `check-opsx-artifacts`（预归档）与 `check-openspec-archive`（后置）对同一树结构互斥 | 调测实测 `gate-logs/p8r1-08-opsx.log` vs `p8r2-05-openspec-archive.log` | 🟢 |
| L8 | 回归面：`__tests__/` 30+ 文件、`samples/` 421 json、self-test 358 样本、samples 覆盖矩阵 + NEGATIVE-COVERAGE 登记 | `w-model-dev/scripts/{__tests__,samples}/` | 🟢 |
| L9 | 纪律：AGENTS §6 SSoT 先行；改动须过 `npm run prepush` 19 项 | `AGENTS.md` §6、`.githooks/pre-push` | 🟢 |
| L10 | D-9/D-10 为环境边界（codegraph/openspec 不可装；demo 源码不在 git 上下文），非缺陷 | `gate-logs/p5-ensure-deps.log`；scope 复算 | 🟢 |
| L11 | 布局校验仅在 `--spec-dir` 注入时激活（默认整组跳过） | `logic/gate-logic.ts:1088-1199,1444` | 🟢 |

**依赖**：L1/L2 同族（返工链表达力）；L5/L6 同族（跨 checker 口径）；L4/L7 同族（护栏语义与真实用法）。任何代码改动受 L8 回归面与 L9 纪律约束。

**非目标（YAGNI）**：不新增 action 枚举；不重写 run-log/signature schema 结构；不改 D-9/D-10 环境面；不加"为通过某次运行"的样本特例。

## §1 D-1 签名链返工来源例外（最小显式化）

**契约**：签名链条目新增**可选字段 `targetKind`**（枚举：`rootcause | preventive | iceberg | standard`，缺省视同 `standard`）。来源矩阵由「按 role 一律禁止」改为「role × action × targetKind 三元判定」：

| 角色 | 禁止来源（不变） | 增补例外（精确条件） |
|---|---|---|
| S | V, G, R | `action ∈ {fix, emergency-fix}` 时允许消费 **R** |
| V | G, R | `targetKind = 'rootcause'` 时允许消费 **R** |
| R | S | `targetKind = 'preventive'` 时允许消费 **S** |

不变量：#18 守护（S 的 `produce` 路径仍禁 R；R 的 `rootcause` 定位仍禁 S）；O 行不变。

**同步面**：`schemas/signature-chain.schema.json`（可选字段，向后兼容）；`logic/signature-chain-logic.ts`（矩阵函数化）；`references/signature-chain-guide.md` §2 返工子流程 + §3 矩阵表；SSoT §7.9。
**测试**：S+produce+消费R → 仍拒；S+fix+消费R → 放行；V+review+targetKind=rootcause+消费R → 放行；V+review+standard+消费R → 拒；R+locate+preventive+消费S → 放行；R+locate+rootcause+消费S → 拒。

## §2 D-2 run-log 修复配对接受 V 重发

**契约**：rootcause 报告的「修复证据」谓词（R3 配对 + R7 顺序）扩为二者之一：
1. `action ∈ {fix, emergency-fix}` ∧ `role='S'` ∧ `basedOnReport == rid`（现行，不变）；
2. `action='review'` ∧ `role='V'` ∧ `basedOnReport == rid` ∧ `artifacts` 全部落在 V 自有前缀（`verifier-outputs/`、`v-reviews/`、`preventive-reviews/`）。

不新增 action 枚举。`review` 已可携带 `basedOnReport`（schema 条件必填已含之）。
**回填契约**：subagent-delegation 增补「V 重发被修报告时必须携带 `basedOnReport=被修复报告 ID` 与 V 自有产物 artifacts」。
**同步面**：`logic/run-log-logic.ts`；`references/subagent-delegation.md`（V 返回契约）；`references/data-models.md`（run-log 节说明）；SSoT §10D。
**测试**：谓词 (2) 正例；`review` 无 `basedOnReport` → 不充数；`review` artifacts 指向非 V 前缀 → 不充数。

## §3 D-3 code-tla 装载基准对齐

**契约**：`loadTlaContents` 改为 `path.resolve(manifestDir, manifest.basePath ?? '.', spec.tlaPath)`（与 check-tla-model 同口径）；`tlaContent` 内联优先与 ENOENT fail-closed 语义不变；其余维度判定不变。
**同步面**：`cli/check-code-tla-consistency.ts`；`references/tla-plus.md` §10（解析基准说明）。
**测试**：`basePath='..'` + 相对 tlaPath 正例（新增样本，非内联）；缺文件 → 仍 fail-closed。

## §4 D-4 budget 护栏实效化

**契约（两处）**：
1. **killSwitch 触发口径对齐事实**：`reworkCount` := 满足 `action ∈ {fix, emergency-fix}` 或 `outcome ∈ {fail, rework}` 的**记录条数**（每条计一次，不做二次去重；按 phase 过滤同现行为）；`tlaReworkCount` 同理加 TLA 上下文过滤。
2. **新增用量实效校验**（提供 `--run-log` 时）：
   - `Σtokens(phase) > perPhase.maxTokens` 或 `Σtokens(all) > project.maxTokensTotal` → **blocking violation**（文案含实耗/上限/比例）；
   - `Σtokens(phase) ≥ budgetBurnRate × maxTokens` → killSwitch 级 violation（触发检测不再空转）。
**同步面**：`cli/check-budget.ts`、`logic/budget-logic.ts`、`references/data-models.md`（budget 节）、SSoT §10D。
**测试**：超限正例（构造 Σtokens>max）；未超限反例；legacy 样本（无 tokens 字段）不回归；killSwitch 触发正例（fix×N ≥ 阈值）。

## §5 D-5 两消费者口径统一

**契约**：run-log 的 legacy 吸收谓词（身份/variant/reworkHints 三族，现 `run-log-logic.ts:521-584`）抽为共享导出，`check-checkpoint` 在同级位置复用：先吸收再判 blocking。判据一致性不变量：同一条记录，两门对「blocking vs 非阻断」的裁定必须相同。
**同步面**：`logic/run-log-logic.ts`（export 谓词）、`logic/checkpoint-logic.ts`（复用）、`references/data-models.md`（run-log 节注明两消费者同谓词）。
**测试**：legacy 条目 → 两门同判非阻断；真实 schema 错误（非法类型）→ 两门同判 blocking。

## §6 D-6 阶段 1 R11 自举豁免

**契约**：R11 对 `phase===1` 的放行，`check-checkpoint.ts` 的成功记录允许**晚于放行时间戳**，但须**早于下一阶段放行的时间戳**（若不存在下一阶段放行，则须存在于 run-log 中且在门禁评估时点之前）；其余四脚本（check-budget / check-run-log / check-maturity / check-preventive-review）仍严格要求早于放行。phase≥2 行为完全不变。
**同步面**：`logic/run-log-logic.ts`（R11）；`references/operational-recovery.md`（闭环调用约定补首阶段语义）。
**测试**：phase=1 + check-checkpoint 后置记录 → 放行；缺失该记录 → 阻断；phase=2 后置记录 → 仍阻断（回归）。

## §7 D-7 归档态兼容（两门同时稳定）

**契约**：`check-opsx-artifacts` 在活动目录不存在时，若 `openspec/changes/archive/**/<changeId>` **恰一**目录存在，则按归档位目录校验同一制品/审查契约；多匹配或零匹配仍失败（fail-closed 语义不变）。`check-openspec-archive` 保持归档位严格锚定不变。
**状态语义**（文档化）：未归档态 = 预归档门绿 / 后置门红；已归档态 = 预归档门绿（经归档位）/ 后置门绿。两态各自稳定，调用方无需"两次快照"绕行。
**同步面**：`cli/check-opsx-artifacts.ts`；`references/command-reference.md`（两门调用时序与两态期望）。
**测试**：未归档态样本；已归档态样本（活动缺失 + archive 恰一）；双目录多匹配 → 失败。

## §8 D-8 / D-9 / D-10

- **D-8（文档）**：SSoT §10.7 与 command-reference 补注：设计级「主文档 + 子模板」布局校验**仅在 `--spec-dir` 注入时激活**，默认调用该组跳过（`specStructure='skipped'`）；需强校验时必须显式传参与理由。
- **D-9 / D-10**：保持 2026-09-20 调测报告环境边界登记，不改代码。

## §9 验收标准

1. **单元/样本层**：每条修复的正反例单测入 `scripts/__tests__/`；受影响门禁的负向案例在 `samples/NEGATIVE-COVERAGE.md` 登记且证据锚可解析；`self-test` 358 样本与 `check-samples-coverage` 全绿。
2. **端到端复验（用本轮真实产物）**：对 `eval/e2e/demo` 重跑受影响门禁全绿，且**不依赖本轮绕过物**——
   - 删除 `.w-model/tla` junction 后 `check-code-tla-consistency` 仍绿（验 D-3）；
   - 签名链中含 `targetKind` 的返工环不再需要"改锚将就"即可自洽（验 D-1；以新样本重放一条返工子链为准）；
   - run-log 以谓词 (2) 直接配对 V 重发，不必借道 S-fix（验 D-2）；
   - budget 门对 demo run-log 的 580M 实耗给出真实判定（验 D-4）。
3. **仓库层**：`npm run prepush` 19 项全绿（含 tsc / prettier / 全量 vitest / security-scan / check-docs-consistency 计数与注册表同步）。
4. **文档同步**（AGENTS §6 顺序）：SSoT → `w-model-dev/{references,schemas,scripts}` → README/AGENTS/CHANGELOG。

## §10 风险与回退

| 风险 | 缓解 |
|---|---|
| 放宽矩阵被误用为"删守护" | 例外全部条件化（action/targetKind），并配套"仍拒"负例测试（§1 测试项） |
| budget 新增 blocking 造成既有项目突然红 | 仅当 `--run-log` 提供且字段存在时校验；legacy（无 tokens）不回归；文案给比例便于判读 |
| R11 豁免扩大到 phase≥2 | 测试含 phase=2 回归项 |
| 归档位兼容被绕（多匹配） | 恰一目录约束 + 多匹配失败测试 |
| 文档/计数未同步触发 docs-consistency | 按 §9.4 顺序执行，prepush 兜底 |

## §11 变更清单（供 writing-plans 分解）

**代码（6 个脚本 + 共享谓词导出）**：`logic/signature-chain-logic.ts`、`schemas/signature-chain.schema.json`、`logic/run-log-logic.ts`、`logic/checkpoint-logic.ts`、`cli/check-budget.ts`＋`logic/budget-logic.ts`、`cli/check-code-tla-consistency.ts`、`cli/check-opsx-artifacts.ts`。
**测试/样本**：`__tests__/` 对应 5 组正反例；`samples/` 新增 basePath 形态与两态 opsx 样本；NEGATIVE-COVERAGE 登记。
**文档（4 份）**：`references/signature-chain-guide.md`、`references/subagent-delegation.md`、`references/operational-recovery.md`、`references/data-models.md`、`references/tla-plus.md`、`references/command-reference.md`、`docs/skill-design-document_SSoT.md`、`CHANGELOG.md`。
