# 约定（Conventions）

> 42.0.0 合并 glossary（术语表）+ format-conventions（格式约定）+ directory-conventions（目录约定）三个参考文件。
> **术语表**：W-Model skill 包核心术语的**单一权威定义**——各参考文档定义与本节冲突时以本节为准（SSoT 例外：SSoT §7 数据模型 schema 为结构权威，本节为语义权威）。
> **格式约定**：所有 W 模型元数据字段格式的唯一事实来源（SSoT）——verifier-spec、模板、门禁脚本均须引用本节，不得自定义格式。
> **目录约定**：所有 W 模型产物路径的唯一事实来源（SSoT）——phase 文档、模板、门禁脚本均须引用本节，不得自定义路径。

## 术语表

> **权威定义入口**：本文件为 W-Model skill 包核心术语的**单一权威定义**。
> 各参考文档定义与本节冲突时，以本节为准（SSoT 例外——SSoT §7 数据模型 schema 为结构权威，本节为语义权威）。
> 每条含「规范定义 + `_Avoid_` 指令」（禁用别名 / 易混词），防止术语同义异写。
>
> 来源：外部 domain-modeling/CONTEXT-FORMAT.md 的 GLOSSARY + `_Avoid_` 治理实践。

### 1. 评审相关

### qualityLevel

- **规范定义**：综合评分质量等级，由 `compositeScore` 加权平均映射（verifier-spec §6.1）：`≥0.85 → A` / `≥0.70 → B` / `≥0.50 → C` / `<0.50 → D`。
- **_Avoid_**：等级/评级/grade/level（仅 V 评审产物使用「qualityLevel」字段名，不得写作「level」「grade」）。

### compositeScore

- **规范定义**：V 评审综合分数 = Σ(子标准 score × weight)，保留 4 位小数，必须与各子标准加权和一致（误差 ≤ 1e-4）。
- **_Avoid_**：总分/平均分/综合分/overallScore/score（「score」专指子标准得分，不得混用）。

### passed

- **规范定义**：阶段门通过判定布尔值。`passed = (qualityLevel === 'A' || 'B') && 所有 subCriterion.score >= 0.70`。
- **_Avoid_**：是否通过/通过与否/approved/accepted（产物字段名必须为「passed」）。

### 单轴下限（R13）

- **规范定义**：任一子标准得分 `< 0.70`（B 级分界）即 `passed=false`，即使加权平均达标也不放行。防止加权平均掩盖单轴失败（反模式 #41）。
- **_Avoid_**：下限阈值/单维门槛/floor（脚本 violation 消息格式固定为「子标准 <name> 得分 <score> < 0.70（单轴下限）」）。

### targetKind

- **规范定义**：V 评审目标类型枚举，仅 4 值：`requirement`（阶段 1）/ `design`（阶段 2-4）/ `code`（阶段 5）/ `test`（阶段 6-8）。
- **_Avoid_**：`testcase`（已废弃，用 `test`）、`file`（已废弃，用 `code`）、type/target（「target」是评审对象描述字段，不同概念）。

### mappingType

- **规范定义**：SD（概要设计）→ codeModule（代码模块）映射关系类型，仅 3 值：`直接`（同名/直映射）/ `等价`（行为等价）/ `替代`（SD 产物被代码模块承载）。
- **_Avoid_**：映射类型/mapType/relation/对应关系（文档与脚本统一使用「mappingType」字段名）。

### 2. 数据模型相关

### runId vs eventId

- **规范定义**：`runId` = RunLogEntry 的运行标识（Run-log / 运行日志）；`eventId` = EventIngress 事件标识（Loop 3 事件接驳）。**两个 schema 不可混用**（反模式 #26）。
- **_Avoid_**：互用/等价（RunLogEntry 用 `runId`+`action`+`role`+`outcome`，EventIngress 用 `eventId`+`eventType`）。

### action（RunLogEntry）

- **规范定义**：run-log 动作类型枚举（共 27 值，以 `run-log.schema.json` 为准）：`chunk` / `cross` / `evolve` / `produce` / `review`（V 评审）/ `gate` / `tla-gate` / `graph-gate` / `test` / `checkpoint` / `rework` / `rollback` / `rootcause` / `fix` / `emergency-fix` / `escalate` / `r3-completeness` / `r3-reliability` / `r3-security` / `codegraph_query` / `opsx_explore` / `opsx_propose` / `opsx_apply` / `opsx_archive` / `ensure_deps` / `iceberg-sweep` / `iceberg-review`。
- **_Avoid_**：operation/op/行为/事件（「action」字段名固定；EventIngress 的同类字段是 `eventType`）。

### checkRounds

- **规范定义**：tla-manifest.json 中 **spec 级** 返工记录（每次 TLA+ spec 因门禁失败返工的记录项），非 phase 级摘要；无返工时为空数组。
- **_Avoid_**：phase 级摘要/轮次记录/检查轮数。

### coverageStatus

- **规范定义**：RTM 行覆盖状态（`covered` / `partial` / `not-covered`），与 `coveragePercent` 数值须一致。
- **_Avoid_**：状态/status（「status」字段在 project.json 等其它上下文使用，RTM 行必须用「coverageStatus」）。

### acknowledgedDecisions

- **规范定义**：CHECKPOINT 用户确认的决策数组，须含 ID 模式（REQ-NNN / INTF-NNN）或技术关键词（接口/状态机/不变式等），「同意」「确认」视为空（check-checkpoint R2）。
- **_Avoid_**：decisions/确认项/决策列表（字段名必须为「acknowledgedDecisions」）。

### 3. 工程资产相关

### codeModule

- **规范定义**：代码模块映射标识，格式 `SD-xxx:src/path.ts`（SD 概要设计 ID + 冒号 + 相对项目根的代码路径）。check-artifact-gate 强制格式校验。
- **_Avoid_**：codeFile/module/路径（「codeFile」是 code-TLA+ 输入里的代码文件对象，不同结构）。

### signatureHash

- **规范定义**：签名链条目哈希，`sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`，首环 prevSigHash="0"（SSoT §7.9）。
- **_Avoid_**：hash/签名/摘要（字段名固定「signatureHash」；「签名」在自然语言中泛指该机制）。

### inputProvenance

- **规范定义**：签名链条目输入来源证明（上游产物路径 + 角色），S 子代理产出时强制回填（反模式 #32 守护）。
- **_Avoid_**：来源/inputSource/provenance（字段名固定「inputProvenance」）。

### tickets.md vs tasks.md

- **规范定义**：`tickets.md` = S-tickets 的代码垂直切片（how，tracer-bullet + blocking edges DAG）；`tasks.md` = opsx:propose 的高层任务清单（what/why）。职责不同，不可互替（反模式 #40）。
- **_Avoid_**：互替/混用（二者在阶段 5 共存，S-propose 分派时先后产出）。

### R3 预防性审查

- **规范定义**：S 产出后强制触发的三阶段审查（completeness / reliability / security），产物落盘 `.w-model/preventive-reviews/<phase>-<dimension>.json`（约束 #11，反模式 #33）。
- **_Avoid_**：预防性检查/预防审查/R3 评审（固定称呼「R3 预防性审查」，三份报告维度名固定为 completeness / reliability / security）。

### evidenceAnchor

- **规范定义**：图谱节点（graph.json nodes[]）结论的事实锚点，由 **A 子代理 ingestion 时**声明"该节点结论依据什么事实"（A-chunk 提取 REQ 节点时对来源声明，A-cross 合并保留），
  格式遵循本文件「格式约定」§2.1（`path:§section=statement` / `path:L42=statement`）；未声明时省略该字段（可选，R15 不强制）。
  S 子代理产出需求规格 §4.2 时**只读 graph.json 同步呈现**，不改图谱节点（S 改图谱命中反模式 #11）。
  与 VerifierOutput.subCriteria[].evidence 的区别：evidence 是**评审者**证明"我核验过"的证据；
  evidenceAnchor 是**产出者（A）**声明"我依据这个"的前提，二者互补不互相替代。
- **_Avoid_**：证据锚点/sourceRef/proof（字段名固定「evidenceAnchor」；「证据」在 VerifierOutput 语境指评审证据）

### 反模式（Anti-Pattern）

- **规范定义**：流程级负面知识库条目（#1-#48），命中即回退到当前阶段起点。规范用词为「反模式」；「反例」为弃用别名（_Avoid_）。与「失败模式 F1-F10」（行为退化，登记不回退）、「运维失败模式 O1-O6」三库互补。
- **_Avoid_**：反例（仅用于 TLA+ 反例轨迹 / 正例反例对照等字面「反例」含义；指代编号反模式条目时一律用「反模式」）。

### exit-2 脚本口径

- **规范定义**：`scripts/cli/` 下全部脚本除 `self-test.ts`（回归基线，exit 0/1）外均为 exit 2 结构化错误脚本：= 43（26 个 check-* + 17 个工具 CLI（含 7 个 code-health 门禁 CLI），不含 self-test；含 wm-export-evidence.ts / wm-verify-evidence-source.ts）；计数由 docs-consistency 的真实输入错误契约探针得出（AGENTS.md「43 个脚本」与本句由 checkConventionsExit2Count 双向兜底），不维护固定补数。
- **_Avoid_**：称 self-test 为 exit-2 脚本 / “31 个脚本”之类过期计数（见 [docs-consistency-logic.ts](../scripts/logic/docs-consistency-logic.ts) 的 EXPECTED）。

### 普通 V/G 失败链

- **规范定义**：V/G 任一门禁不通过后的返工链（V/G 失败 → R 根因定位 → V 复审 RootCauseReport → G 根因报告门禁 → S-fix → R3×3 预防性审查 → V/G 复验 → CHECKPOINT），权威全句定义见 [hard-constraints.md](hard-constraints.md)「普通 V/G 失败链」节：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`。全包其余文档以短名引用本节：正文用 `普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）`，表格用 `普通 V/G 失败链（hard-constraints）`，不再内联全句（examples/ 教学示例除外）。
- **_Avoid_**：完整失败链/标准返工链/失败处理链/完整普通失败链/普通失败链/普通失败返工链/普通失败完整链/完整返工链/普通返工链（非规范叫法；统一短名「普通 V/G 失败链」并指向 hard-constraints 权威节）。

---

> **维护规则**：新增 `.w-model/*.json` 字段或脚本 violation 消息前，先在本表登记术语，再改 schema / 文档（反模式 #28 schema 前置校验缺失同类纪律）。首版 12+ 条。

## 格式约定

### 1. 路径定位分隔符

统一使用**冒号** `:` 分隔文件路径与定位信息：

```
path:§section       （章节定位）
path:L42-58         （行号定位）
path:§3.2,L42       （章节+行号混合）
```

### 禁止格式

| 格式               | 说明       | 旧用法位置                      |
| ------------------ | ---------- | ------------------------------- |
| `path#§section`    | 井号分隔   | tla-spec-template.md（已废弃）  |
| `path.field=value` | 点号分隔   | verifier-spec.md §6.2（已废弃） |
| 纯文件名无定位     | 无定位信息 | —                               |

### 2. 各字段格式规范

### 2.1 VerifierOutput evidence

> 本格式同时是 `graph.json` 节点可选字段 `evidenceAnchor`（产出期证据锚点）的格式权威（见术语表 evidenceAnchor 条目）。

格式：`path:§section=statement` 或 `path:L42=statement`

```
合法示例：
  docs/phase1-requirements/requirement-spec.md:§1.1=32 需求齐全
  docs/phase2-design/blog-system-system-design.md:§3.2=模块划分 16 个
  src/auth.ts:L42-58=JWT 签发逻辑

非法示例：
  coverage.json.matrices.stakeholder.coverage=100%  （点号格式，已废弃）
  C1-C10 全通过                                       （空泛声明）
  system-design.md                                    （无定位）
```

### 2.2 TLA+ spec 头部 @design

格式：`path:§section`

```
合法示例：
  @design docs/phase2-design/blog-system-system-design.md:§3.2

非法示例：
  @design docs/system-design.md#§3.2  （井号，已废弃）
```

### 2.3 BDD feature 头部 @design

格式：同 2.2

### 2.4 RTM designDoc

格式：`path:§anchor`

```
合法示例：
  docs/phase2-design/blog-system-system-design.md:§M-001
```

### 2.5 TLA+/BDD 头部 @designIds

格式：逗号分隔的 SD 节点 ID 列表

```
@designIds     SD-001,SD-002,SD-005
```

### 3. evidence 正则

`verifier-logic.ts` 的 EVIDENCE_PATTERN 须匹配以下两种格式：

```
/^[\w/.-]+:§[\w.-]+=.+$/       （章节定位）
/^[\w/.-]+:L\d+(?:-\d+)?=.+$/  （行号定位）
```

### 4. 引用关系

本文件被以下文件引用：

- `references/verifier-spec.md` §6.2（evidence 格式）
- `templates/tla-spec-template.md`（@design 格式）
- `templates/feature.template`（@design 格式）
- `scripts/logic/verifier-logic.ts`（EVIDENCE_PATTERN）
- `references/conventions.md`「目录约定」§6（路径引用规则）

### 5. 注释与提示词目的规范

> 吸收自《agent 时代的人月神话》第 15 章：注释写 why 不写 what；提示词/注释能表达要求但不能表达要求的分量。

- **注释写 why 不写 what**：凡只翻译代码的注释视为废注释（代码本身已表达 what）。
- **目的注释**：记录"这段代码为什么存在 / 服务于什么目的"，给未来 agent 与人的判断依据。
- **提示词的边界**：提示词/注释能表达要求，但不能表达要求的分量——分量靠结构（门禁 / 校验 / 权限）承载。

### 接口注释必备清单

> 吸收自《软件设计哲学》ch13：接口注释 = 抽象定义（接口非形式化部分只能靠注释承载）。

- **接口注释必备内容**：行为（做什么）/ 参数（含含义与约束）/ 返回 / 副作用 / 异常 / 前置条件。
- **接口注释与实现注释分离**：接口注释描述抽象契约，实现细节归实现注释；实现文档污染接口 = 坏注释（code-smells 组 C）。
- **先写注释（ch15）**：新类先写类接口注释 → 公有方法签名 + 接口注释 → 再填实现；"难以描述" = 抽象有问题的金丝雀，回到设计而非硬写。

### 坏注释黑名单

> 吸收自《代码整洁之道》ch4：以下 6 类注释应删除或改写（对应 coding-quality「代码坏味道清单」组 C）。

| #   | 坏注释类型   | 检测信号                            | 处理                     |
| --- | ------------ | ----------------------------------- | ------------------------ |
| 1   | 喃喃自语     | 无信息量、自我解释的废话注释        | 删除                     |
| 2   | 冗余注释     | 复述代码本身（what）                | 删除（重构让代码自解释） |
| 3   | 误导性注释   | 注释与代码现状不符/过期             | 删除或修正               |
| 4   | 日志式注释   | 逐条记录修改历史（应归版本控制）    | 删除                     |
| 5   | 注释掉的代码 | 被注释的代码块                      | 删除（版本控制可恢复）   |
| 6   | 循规式注释   | 为遵守格式而写的空泛 Javadoc/头注释 | 删除或补充实质内容       |

### 6. 命名约定

> 吸收自《代码整洁之道》ch2。命名是代码可读性的第一来源；机械规则由语言静态工具 + 团队规范承载，本节为语义级约定。

- **名副其实**：名称直接表达意图（`elapsedTimeInDays` 而非 `d`）；若需注释解释名称含义，名称不合格。
- **有意义区分**：`a1/a2`、`data/data2`、`get/getInfo` 类无语义区分是废名。
- **可搜索**：名称长度随作用域增长；短名（`i`）只用于局部小循环；魔法数用命名常量（坏味道清单 G25）。
- **避免思维映射**：不用领域外隐喻（单字母/自造缩写让读者做心智翻译）。
- **一词一义**：同一概念统一用词（`fetch/get/retrieve` 不混用）；一词一义的反面（同词多义）也避免。
- **解决方案 vs 问题领域**：技术性名称（`Queue`/`Decorator`）用解决方案域词汇；业务语义用问题域词汇。
- **不加多余语境**：`GSD_` 类前缀、类名中重复的模块前缀是噪音。
- **类/对象命名**：名词短语；函数命名：动词/动词短语（`save`/`isActive`）；布尔函数用 `is/has/can` 前缀。
- **与坏味道清单的关系**：命名违规对应 [coding-quality.md](coding-quality.md)「代码坏味道清单」组 N（N1-N7）与神秘命名味道。
- **命名一致性三要求**（APoSD ch14.4）：① 给定目的固定用名；② 该名不得他用（一词一义强化）；③ 目的足够窄（名称歧义 → 语义混杂）。
- **难取名警报**（APoSD ch14.3）：想不出精确直观的名字 → 该实体可能同时承担多个语义，回到设计拆分，而非硬凑名字。
- **坏名称直接造成缺陷**：名称是读者脑中"画面"的来源——孤立看到名称应能猜出指什么（block 逻辑/物理块号混用案例）。

### 7. 模板占位符语法

> 模板套用规则：`w-model-dev/templates/*.md` 用 `{{...}}` 占位符，套用时全文替换；`feature.template` / `tla-spec-template.md` 用 `<...>` 占位符（TLA+/BDD 域独立风格，各自内部统一，不互相混用）。

### 7.1 全段占位符约定

`{{}}` 内必须包含**完整可变值**（含字面前缀），禁止「字面 + 部分占位」混写：

```
合法：  - 文档版本：{{v1.0}}        （"v1.0" 整段为占位值）
        > **文档版本**：{{v1.0}}（{{YYYY-MM-DD}} 首版）
非法：  - 文档版本：v{{1.0}}        （"v" 字面 + "1.0" 占位，两种写法并存导致替换只命中一种）
```

### 7.2 固定占位符

| 占位符                        | 含义                                              |
| ----------------------------- | ------------------------------------------------- |
| `{{v1.0}}`                    | 文档版本（首版 v1.0，升版时替换为 v1.1 / v2.0 …） |
| `{{YYYY-MM-DD}}`              | 日期（ISO 8601）                                  |
| `{{项目名称}}` / `{{module}}` | 项目 / 模块名                                     |
| `{{}}`                        | 留空待填（仅用于无默认值的字段）                  |

### 7.3 检查

- 任一模板文件内不得同时出现 `{{v1.0}}` 与 `v{{1.0}}` 两种写法。
- `{{}}` 空占位符不参与版本/日期字段（版本/日期必须整段占位）。

## 目录约定

### 1. 阶段子目录模式

所有阶段产物统一存放于 `docs/phaseN-{name}/` 子目录下，禁止平铺于 `docs/` 根目录。

| 阶段       | 目录                            | 文件命名                                                       | 模板                                                      |
| ---------- | ------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1 需求分析 | `docs/phase1-requirements/`     | `requirement-spec.md`, `acceptance-test-design.md`             | `templates/requirement-spec.md`                           |
| 2 系统设计 | `docs/phase2-design/`           | `{module}-system-design.md`, `{module}-system-test.md`         | `templates/system-design.md`, `templates/test-case.md`    |
| 3 概要设计 | `docs/phase3-outline/`          | `{module}-interface-design.md`, `{module}-integration-test.md` | `templates/interface-design.md`, `templates/test-case.md` |
| 4 详细设计 | `docs/phase4-detailed/`         | `{module}-detailed-design.md`, `{module}-unit-test.md`         | `templates/detailed-design.md`, `templates/test-case.md`  |
| 5 编码     | `src/`                          | 按技术栈约定                                                   | —                                                         |
| 6 集成测试 | `docs/phase6-integration-test/` | `integration-test.md`                                          | `templates/test-case.md`                                  |
| 7 系统测试 | `docs/phase7-system-test/`      | `system-test.md`                                               | `templates/test-case.md`                                  |
| 8 验收测试 | `docs/phase8-acceptance-test/`  | `acceptance-test.md`                                           | `templates/test-case.md`                                  |

### 2. 横切文档

| 产物         | 目录        | 命名                    | 强制阶段                         |
| ------------ | ----------- | ----------------------- | -------------------------------- |
| UAT 路径映射 | `docs/`     | `uat-path-mapping.md`   | 阶段 1 产出，阶段 5/终检校验回填 |
| RTM          | `.w-model/` | `rtm.json`              | 阶段 1 起持续维护                |
| 项目状态     | `.w-model/` | `project.json`          | 全阶段                           |
| 编排状态     | `.w-model/` | `orchestrator-state.md` | 全阶段                           |

### 3. TLA+ 规格目录

| 层级  | 目录                  | 文件命名                                                     |
| ----- | --------------------- | ------------------------------------------------------------ |
| L1    | `tla/specs/level1/`   | `L1_{System}.tla`, `L1_{System}.cfg`                         |
| L2    | `tla/specs/level2/`   | `L2_{System}_{Subsystem}.tla`, `L2_{System}_{Subsystem}.cfg` |
| L3    | `tla/specs/level3/`   | `L3_{System}_{Subsystem}_{Atom}.tla`, 同名 `.cfg`            |
| L4-L6 | `tla/specs/level{N}/` | `L{N}_{System}_..._{Atom}.tla`                               |

### 4. BDD features 目录

| 层级 | 目录           | 文件命名                                              |
| ---- | -------------- | ----------------------------------------------------- |
| L1   | `features/L1/` | `L1_{system}-001.feature`                             |
| L2   | `features/L2/` | `L2_{system}_{subsystem}-001.feature`                 |
| L3   | `features/L3/` | `L3_{system}_{subsystem}_{atom}-001.feature`          |
| L4   | `features/L4/` | `L4_{system}_{subsystem}_{atom}_{method}-001.feature` |

### 5. .w-model 目录结构

```
.w-model/
├── project.json              # 项目元数据
├── orchestrator-state.md     # 编排状态
├── rtm.json                  # 需求追踪矩阵
├── tla-manifest.json         # TLA+ 规格清单
├── bdd-manifest.json         # BDD features 清单
├── ingestion/                # 图谱导入产物
│   ├── graph.json            # 合并后的需求/设计图谱
│   └── consolidated-phaseN.json
├── verifier-outputs/         # V 子代理产出
├── gate-logs/                # 门禁日志
└── run-log.jsonl             # 运行日志
```

### 6. 路径引用规则

所有跨文件路径引用须遵循 [格式约定](#格式约定) 的分隔符约定。

### 7. 门禁脚本路径解析

`check-artifact-gate.ts` 内置 `resolvePhaseDoc(phase, type)` 函数从本约定解析文档路径，禁止硬编码。
