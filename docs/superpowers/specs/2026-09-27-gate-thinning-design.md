# 门禁/测试瘦身 设计规格（2026-09-27）

> 动机：清收批（deferred-closeout）复盘——用户裁定「不能为了校验而校验，为了测试而测试」。本批对**校验机制本身**做外科手术：留牙齿、砍记账。
> 决策记录：范围 = 全含 + D 激进版（pointer 化）；关键取舍已批准——A 移除清收批刚建的多锚机制（根因去除后无对象）；C 把独立运行降为弱校验 + 诊断（验收纪律「终局一律 prepush」为其前提）。
> 执行分支：`feat/gate-thinning`（Task 0 建分支）。

## 1. 动机证据（近两批会话实测，非推测）

| 证据 | 数值/事实 |
| --- | --- |
| 清收批总消耗 | 子代理约 200M tokens / 8 任务，多数为文档措辞与登记行（含 3 次环境停滞恢复） |
| docs-consistency 独立运行 | 4 次 × 35-45 分钟（自 spawn 全量 vitest）；prepush 内同项仅 1-2 分钟（有受控工件） |
| L0 计数基线 | Task 2 加一条文档链接 → 699→700 → 2 用例红 → 进修复轮；两批内 rebaseline ≥3 次 |
| NEGATIVE-COVERAGE 登记册 | 本批为补锚发明多锚语法（+335 行）；G4-1/2「行替换丢登记」、carry-forward「次锚非失败证据」——维护成本持续产生，而 48 条探针本就机器执行 |
| 注释/文档易漂计数 | self-test.ts:17「45 个」实测已错（实为 46）；INSTALL lib 计数、探针耗时句同族 |
| 跨文件措辞同步 | 时间戳三态 8 处 / 非空族 ~10 处 / 键句 4 处 / 记录边界前缀 7 处等——全为本批逐处同步的对象 |

## 2. 范围内六项（WS-T1..T6）

| WS | 名称 | 一句话 |
| --- | --- | --- |
| T1 | NEGATIVE-COVERAGE 自动探针化（A） | 删手写「证据位置/锚」列——它是 self-test 覆盖信息的抄本；门禁改为派生锚 + 逐行真实探针 |
| T2 | L0 计数去常量（B） | 删精确计数断言与 baseline 模块；保留 violations（悬空/隔离）牙齿 |
| T3 | docs-consistency 独立运行提速（C） | 默认不自 spawn（秒级）；动态 facts 走非阻断诊断；`--spawn-vitest` 显式逃生口；prepush 路径 fail-closed 不变 |
| T4 | pointer 化（D 激进版） | 同规则跨 3+ 处全枚举 → 单一枚举权威 + ≤1 句摘要 + 指针；本批转换 8 簇 |
| T5 | 注释计数清扫（E） | 清扫**无门禁强制**的易漂计数（改为自描述或删除）；门禁强制的计数契约不动 |
| T6 | 流程约定（F） | 纯文档任务合并为单任务单审查面；同族 minor 批量处理（写入 subagent-delegation） |

## 3. 全局约束

1. **牙齿清单（本批不得触碰，作为每处删除的替代承载核对项）**：exit-code 契约与 48 条 exit-2 串行探针、scope/Git 绑定、证据防伪链（provenance/哈希链/签名链）、版本六镜像一致性、schema 字段 description 门禁、assets/exit2/action 等**有门禁强制的计数契约**、四类负例探针（篡改/replay 等）。
2. **零新增门禁**：本批只做删除与降级，不引入新检查项。
3. **不改机器可读契约**：schema、exit code、`GATE_JSON` 键、prepush 19 项清单均不变（T3 只改独立运行回退行为）。
4. **如实登记**：每处删除在 CHANGELOG 登记「原牙齿 → 替代承载」；两处批间关系（A 移除清收批 G2-8 机制）显式写明理由。
5. 历史不改写：CHANGELOG 历史条目、docs/debug 证据原貌不动。
6. 回归纪律：`.ts` 改动前 codegraph 查询落盘；每组定向 vitest；终局全量 prepush 19 项。

## 4. 逐项设计

### T1 · NEGATIVE-COVERAGE 自动探针化

**登记行新形态（4 列）**：`| 门禁 | fixture | 机制 | 所防回归 |`——删除「证据位置（锚引用）」列及其全部语法。
**门禁行为**（`check-samples-coverage.ts`）：
- 48 条真实串行探针**原样保留**（含隔离探针根、零漂移断言）；
- 每行校验：fixture 在盘；该 fixture 被 self-test.ts 引用**恰一处**（`collectCaseEntries`/`entryCoversFixture` 计算，多义覆盖 → violation）；`机制 ∈ {fixture, invocation, mutated-copy}`；
- **派生锚**：输出中为每行打印 self-test 覆盖位置，格式与既有引用风格一致（如 `self-test.ts#file: 'x.json'`），由 `collectCaseEntries`/`entryCoversFixture` 计算得出、永远新鲜——人类可读性不降；
- 既有四规则（fixture 均被引用 / 无悬空 / 子目录均在 README 矩阵 / exit-2 门禁均有会失败的负向案例）**全部保留**；其中第 4 条收紧为「每行 fixture 必须是该门禁的真实失败案例（探针退出码匹配预期失败码）；非失败样本（如诊断型 exit 0 样本）不得占行」——审计任务逐行裁定去留/换件。
**删除清单**：`ANCHOR_SEPARATOR`、`ANCHOR_CITATION_PATTERN`、`LEGACY_LINE_CITATION_PATTERN`、`firstAnchorCitation`、`hasAnchorCitation`、`isPureCitationSegment`、`fixturePathInSegment`、`extractAnchorRefs`、`validateAnchorEvidence`、`validateCitation` 及对应测试（含清收批 G2-8 多锚 6 例与既有锚校验例）。`validateEntries` 其余职责保留。
**迁移**：NEGATIVE-COVERAGE.md 全表逐行改写为 4 列（审计任务产出 before→after 全表；46 行含 check-budget 的「次锚非失败证据」行——按第 4 条收紧规则裁定）。

### T2 · L0 计数去常量

删除 `w-model-dev/scripts/__tests__/helpers/l0-baseline.ts`（三常量 + 全部 rebaseline provenance 注释协议）；`l0-link-audit-cli.test.ts` 与 `l0-link-audit-logic.test.ts` 移除精确计数断言（`relativeLinkCount`/`l1Only`/`placeholders`），**保留** `violations` 断言与全部负例（悬空、隔离、占位符形态）；`audit-l0-links` CLI 输出计数保留（可观测，非断言）。其余引用（若有）审计后同步。

### T3 · docs-consistency 独立运行提速

- **prepush 路径（有 `WM_VITEST_COUNT_FILE`/`WM_VITEST_PROVENANCE_FILE`）**：语义与实现**一字不变**（fail-closed 受控工件校验）。
- **独立运行（无环境变量）**：默认**不再 self-spawn**；动态 facts 通道输出非阻断诊断并跳过，退出码由静态检查决定（原静态违规语义不变）。诊断文案：
  `○ 动态 facts 未校验：未提供受控 vitest 工件（WM_VITEST_COUNT_FILE / WM_VITEST_PROVENANCE_FILE）；终局验收经 npm run prepush 覆盖（fail-closed）。如需自采集请显式加 --spawn-vitest（约 30 分钟）。`
- **新增 `--spawn-vitest` 显式逃生口**：行为等同现有自采集路径（生成同目录 provenance + 严格校验），供无 prepush 场景。
- 同步面：CLI 头注（:545-567 一带的自采集说明改写）、`command-reference.md` 对应条目、`docs/troubleshooting.md`（若有自采集描述）、覆盖该回退行为的测试（审计后同步）。

### T4 · pointer 化（8 簇）

**规则**：同一规则的**枚举/清单/流程步骤**只允许出现在「枚举权威」一处；其余落点改为 **≤1 句义务摘要 + 指针**（指针须含：权威文件名 + 小节号或唯一短语锚——该锚串必须可在权威文件中 grep 命中）。设计决策句可另存 SSoT，但**不得复制枚举**。

| 簇 | 枚举权威（判定） | 其余落点（改指针 + 摘要） |
| --- | --- | --- |
| ① 时间戳三态（①②③ + 两个逃生口） | `command-reference.md`（wm-append-runlog 条目） | AGENTS §6/§8、SSoT、data-models、operational-recovery、subagent-delegation、CLI 头注（实现短式 + 指针） |
| ② 非空本质判定族（`isFile()` && `size > 0`） | `command-reference.md`（check-coding-plan 条目） | hard-constraints、subagent-delegation、phase-5-coding、SSoT、templates/coding-plan、samples/README |
| ③ parentDispatchId 键句与上界口径 | `data-models.md`（用量实效校验（R6）段） | SSoT §10D.7、operational-recovery、CLI 注释（短式）、schema description（字段语义短式保留） |
| ④ 记录边界前缀三态 | `command-reference.md`（check-archive-integrity 条目） | archive-integrity logic/CLI 文案（短式）、data-models、AGENTS |
| ⑤ 预算接线口径（未接线诊断/必带/上界） | `data-models.md`（用量实效校验（R6）段） | SSoT §10D.7、operational-recovery 调用表、toolbox、subagent-delegation |
| ⑥ 五门闭环与放行三步顺序 | `SKILL.md`（阶段门工作流） | operational-recovery、SSoT §10D.4/§10D.7、data-models R11 条、hard-constraints、command-reference |
| ⑦ 导出白名单与 provenance 形态 | 枚举→`command-reference.md`（导出条目）；设计决策→SSoT §7.10（只写决策与指针） | AGENTS 两节、INSTALL、README、data-models（结构行保留字段语义短式） |
| ⑧ codegraph 降级契约 | 设计决策→SSoT:283 段；操作枚举→`command-reference.md`（check-codegraph-queries 条目） | phase-5-coding、hard-constraints、data-models、AGENTS §1 |

**例外（保留全文复述）**：AGENTS.md 的一级红线单句（导航可读性）；代码注释的实现视角描述（不得复制枚举）；版本六镜像（交付契约）；schema/enum/exit-code 等机器契约。

**流程**：首个任务产出**逐落点 before→after 审计表**（权威锚句、保留摘要句、删除段），实现按表执行；每簇改完 grep 校验「枚举短语在权威外的命中数 == 0（摘要句除外）」。

### T5 · 注释计数清扫

**清扫对象**：注释/文档中**无门禁强制**的易漂计数——含「N 个用例」「N 个文件」「N 行」「N 分钟」等。处置二选一：改自描述（「以运行输出为准」/公式）或删除。**已知落点**（审计任务补全）：`self-test.ts:17`、`samples/NEGATIVE-COVERAGE.md` 头注耗时句、`docs/INSTALL.md` lib 计数句、`__tests__/README.md` 耗时/计数句。
**非目标（不动）**：测试断言里的计数（机器事实）；有门禁强制的计数契约（AGENTS 脚本数 46 等，由 exit2 计数门禁强制）；CHANGELOG 历史条目与 docs/debug 证据。

### T6 · 流程约定

写入 `w-model-dev/references/subagent-delegation.md`（新短节「任务合并与审查面」）：① 纯文档任务（零 `.ts`/`.json`/schema/`.py` 改动）**合并为一个任务、单审查面**；② 审查出的 minor 措辞类发现批量入账本、不进逐轮修复（现状已如此，明文化）；③ 计划头部注明可合并分派条件。不改脚本、不改门禁。

## 5. 牙齿替代对照（每处删除 → 替代承载；计划任务逐项验证）

| 删除 | 原牙齿 | 替代承载 |
| --- | --- | --- |
| 手写锚证据与多锚语法（T1） | 「证据位置」指向 self-test 引用 | 门禁**派生**锚（同信息、更准）+ 既有 rule 1 覆盖强制 + 快照「恰一处」新断言 |
| 非失败样本占行（T1 收紧） | 无（本就无牙） | 探针退出码必须匹配预期失败码——比原登记更严 |
| L0 精确计数断言（T2） | 检测链接增删 | violations（悬空/隔离/占位符形态）——检测的是「错」不是「变」 |
| 独立运行动态 facts（T3） | 无工件时自采集成强校验 | prepush 第 15 项 fail-closed 不变 + 独立运行显式诊断（+ `--spawn-vitest` 逃生口） |
| 跨文件枚举复述（T4） | 靠门禁/审查在 N 处同步 | 单一权威 + 指针；枚举短语「权威外命中 == 0」可 grep 校验 |
| 易漂注释计数（T5） | 无牙（纯漂移债） | 自描述表述（无数字可漂） |

**删除测试的处置纪律**：每个被删测试的场景在任务报告里逐条列「仍被保留测试覆盖（指向）」或「有意退休（理由）」——不允许静默消失。

## 6. 验收策略

1. 每组定向 vitest + `check-samples-coverage`（新形态）+ `audit:l0-links`；
2. T3 后独立运行 `check-docs-consistency.ts` 计时（预期从 ~40 分钟降至秒级）并确认诊断输出；`--spawn-vitest` 抽查一次（可只到「工件生成成功」即止）；
3. T1/T2 后跑全部相关负例并确认探针 48 条真实执行；
4. 终局：`npm run prepush` 19 项 exit 0（含 docs-consistency 快路径）+ 全量 vitest 零回归（既有用例除**删除清单**外不得变红）；
5. CHANGELOG 登记：六项各自「原牙齿 → 替代承载」+ 批间关系声明（A ↔ 清收批 G2-8）。

## 7. 显式不修与风险登记

| 项 | 登记 |
| --- | --- |
| C 独立运行弱校验 | 语义降级，已批准；前提「终局验收一律 prepush」已成文（AGENTS §6）；`--spawn-vitest` 为逃生口 |
| A 移除清收批 G2-8 多锚机制 | 批间关系声明：G2-8 解决「手写锚如何完整」，本批从根上去掉手写锚；非反复 |
| 指针腐烂（T4） | 缓解：审计表 + 既有一致性面（l0-links / orphan references）；不新增门禁（YAGNI） |
| 测试总数下降 | 自度量（无外部常量断言）；删除清单逐条可核 |

## 8. 计数连锁预测（供审计核对）

- `vitestTestCount` 下降（锚校验/计数断言/多锚用例删除，预估 −20~30 例）；`testFileCount` 不变（l0-baseline 为 helper 非 `*.test.ts`）；
- `schema 34` / `exit2ScriptCount 46` / `prePushCount 19` / CLI 47 **均不变**；NEGATIVE-COVERAGE 行数可能微调（非失败样本行处置）；
- docs-consistency 检查项数不变（未增删检查）。
