# 冰山扫掠深度分析机制设计：发现一个问题→深挖更多问题→修复→再分析循环

> 日期：2026-08-08
> 状态：已批准（待写实施计划）
> 决策方案：方案 B（专用机制：新 schema + 新脚本 + 新反模式）
> 理论基础：冰山理论（Iceberg Theory）——水面之上已发现的问题仅占 1/8，水面之下隐藏的同类/同根因问题占 7/8
> 兼容性：与现有 R3/V/R 机制正交，不修改既有 schema/脚本行为

## 1. 问题根因

### 1.1 当前返工循环的盲区

当前 W 模型的返工循环机制为：

```
V/G 不通过 → R(根因定位) → V(复审R报告) → G(门禁) → S-fix(修复) → V(复审修复) → G(门禁)
```

V/G 通过后即进入阶段门 CHECKPOINT → 下一阶段。

**盲区**：V/G 通过仅证明"**既定标准下无问题**"，不证明"**同类深挖下无问题**"。具体表现为：

| 盲区类型 | 说明 | 现有机制为何无法覆盖 |
|---|---|---|
| 同根因扩散 | 一个缺陷的根因可能扩散到其他产物（如 SD 缺状态定义→DD/INTF 也缺） | R 只定位当前问题的根因，不横向扩散检查 |
| 同缺陷类 | 同类缺陷可能出现在其他位置（如文件A缺null检查→文件B也缺） | V 按既定标准评审，不主动枚举同类缺陷 |
| 修复引入回归 | S-fix 修复可能引入新缺陷（如改了状态转移→破坏不变式） | V 评审修复产物但不做回归式深挖 |
| 相邻逻辑隐患 | 修复了某路径，相邻路径可能有同类隐患 | V 评审聚焦被修复点，不扩散到相邻逻辑 |
| 覆盖缺口 | RTM 标记100%但某异常路径未覆盖 | check-artifact-gate 只看声明覆盖率 |
| 跨产物不一致 | TLA+ 修复后与 BDD/设计文档/RTM/graph 不一致 | 各 check 脚本各自为政，无跨产物语义校验 |

### 1.2 与冰山理论的映射

冰山理论（Iceberg Theory）指出：水面之上可见的部分仅占冰山的 1/8，水面之下不可见的部分占 7/8。映射到 W 模型：

| 冰山理论概念 | W 模型映射 |
|---|---|
| 水面之上（1/8，已发现的问题） | V/G 标准评审命中的 reworkHint，或 S-fix 刚修复的缺陷 |
| 水面之下（7/8，未发现的隐藏问题） | 同根因扩散到其他产物 / 同缺陷类出现在其他位置 / 修复引入的回归 / 相邻逻辑的同类隐患 |
| 深度分析→修复→再分析循环 | R-iceberg 扫掠 → V 复审 → 标准 R→V→G→S-fix → 再次 R-iceberg 扫掠 |
| 直到不能发现问题 | 一轮扫掠 `newFindings=[]` 即终止 |

## 2. 设计决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 方案 | 方案 B（专用机制：新 schema + 新脚本 + 新反模式） | 与项目既有架构模式一致（R3/rootcause/signature-chain 均独立 schema+脚本）；语义准确（IcebergSweepReport ≠ PreventiveReview ≠ RootCauseReport）；可独立校验 |
| 触发时机 | 双重触发：ICEBERG-A（S-fix 后）+ ICEBERG-B（阶段门前） | 既防修复引入新缺陷，又做阶段级全局扫掠 |
| 终止判据 | 一轮深挖 `newFindings=[]` 即终止；maxIcebergRounds=5 兜底；killStack 最终兜底 | 由产出结果驱动，轮次上限防预算耗尽 |
| 执行者 | 新增 R-iceberg 子代理变体 | 与 R（被动定位）职责正交，专责主动深挖 |
| 下游流程 | IcebergSweepReport → V 复审 → 每个有效发现走标准 R→V→G→S-fix | 复用现有返工机制，仅加报告层 |
| 深挖范围 | 全阶段产物重扫，三维度（completeness/reliability/security）×六类别 | 全面覆盖，以已发现问题为线索聚焦 |
| 兼容性 | 与现有 R3/V/R 机制正交，不修改既有 schema/脚本行为 | 增量扩展，零回归风险 |

## 3. 设计详述

### 3.1 与现有机制的正交关系

| 机制 | 触发时机 | 目的 | 语义 |
|---|---|---|---|
| R3（预防性审查） | S 产出后、V 评审**前** | 按清单预防性检查 | 维度检查清单（completeness/reliability/security） |
| V（标准评审） | R3 后 | 按既定标准评审 | targetKind 对应的评审标准 |
| R（根因定位） | V/G **不通过后** | 定位已暴露问题的根因 | 单一问题的根因链追溯 |
| **R-iceberg（冰山扫掠）** | **S-fix 后 + V/G 通过后** | 以已发现/已修复问题为线索主动深挖隐藏问题 | 多视角全产物扫掠，找"水面之下" |

**关键区别**：
- R3 是"评审前的 checklist 式预防审查"——按固定清单检查
- V 是"按既定标准评审"——对照标准判断通过/不通过
- R 是"被动定位已暴露问题的根因"——单一问题的根因链
- R-iceberg 是"主动深挖未暴露的隐藏问题"——以已发现问题为线索横向扩散

四者不互相替代，正交组合覆盖"预防→评审→定位→深挖"全链路。

### 3.2 触发机制（双重触发）

#### 3.2.1 ICEBERG-A：S-fix 后深挖

防修复引入新缺陷 + 同根因扩散。

```
S-fix 修复 → R3×3(fix 变体) → V 评审修复 → G 门禁
  → [G 通过] → 分派 R-iceberg（输入：本轮 reworkHints + 修复点 + 全阶段产物）
    → IcebergSweepReport
      ├─ newFindings 非空 → V 复审报告 → 每个有效发现走标准 R→V→G→S-fix → 回到 ICEBERG-A
      └─ newFindings=[] → 继续返工循环的下一步（若仍在返工中）或进入 ICEBERG-B
```

#### 3.2.2 ICEBERG-B：V/G 通过后、阶段门放行前全局扫掠

阶段级冰山扫掠，是阶段门放行的最后把关。

```
标准 V/G 通过（非返工的首次通过，或返工循环结束后最终通过）
  → 分派 R-iceberg（输入：本阶段全部 reworkHints 历史 + fixedPoints + 全阶段产物 + RTM + graph.json）
    → IcebergSweepReport
      ├─ newFindings 非空 → V 复审 → 每个有效发现走标准 R→V→G→S-fix → 回到 ICEBERG-A（S-fix 后深挖）
      └─ newFindings=[] → 🔴 CHECKPOINT · 阶段门放行
```

**首次通过无返工时的线索处理**：若本阶段首次 V/G 即通过（无返工、无 S-fix、无 reworkHints），ICEBERG-B 仍须触发，但线索来源为空数组。此时 R-iceberg 退化为"全产物三维度×六类别终检式扫掠"——以产物本身为扫描对象（而非以修复点为线索），目的在于捕获 V/G 标准评审未覆盖的盲区。这与 R3 预防性审查的区别在于：R3 在 S 产出后立即触发（评审前 checklist），ICEBERG-B 在 V/G 通过后触发（评审后终检），两者时机不同、目的不同。

#### 3.2.3 触发边界

- ICEBERG-A 仅在 S-fix（返工修复）后触发，标准 S 首次产出不触发（首次产出走 R3→V→G，无"已修复问题"可作线索）
- ICEBERG-B 仅在阶段门放行前触发一次（非每次 V/G 通过都触发）
- 紧急修复（S-emergency-fix）同样触发 ICEBERG-A（与 R3 升级一致，一视同仁）

### 3.3 终止判据

```
终止条件（满足任一）：
  ① R-iceberg 产出 IcebergSweepReport.newFindings = [] → 正常终止
  ② 冰山轮次达到 maxIcebergRounds（5）→ 🔴 CHECKPOINT 升级（展示已发现+已修复+剩余项，由用户裁定）
  ③ Budget killSwitch 触发 → 强制终止（按既有 killSwitch 流程）
```

**maxIcebergRounds 语义**：ICEBERG-A 和 ICEBERG-B 共享一个计数器（每阶段独立）。**每次 R-iceberg 扫掠（无论 A 还是 B）递增 icebergRound**（即 icebergRound = 本阶段累计扫掠次数）。计数器在阶段进入时重置为 0，首次扫掠时 icebergRound=1。修复操作不单独占轮次。

**计数示例**：
- ICEBERG-A 扫掠（round=1）→ 发现问题 → V 复审 → S-fix 修复 → ICEBERG-A 扫掠（round=2）→ 无发现 → ICEBERG-B 扫掠（round=3）→ 无发现 → 终止（共 3 次扫掠）
- 首次 V/G 通过无返工 → ICEBERG-B 扫掠（round=1）→ 无发现 → 终止（共 1 次扫掠）

**CHECKPOINT 升级展示内容**：
- 已发现的冰山问题总数 + 已修复数 + 剩余未修复数
- 各问题 category 分布（同根因扩散/同缺陷类/修复引入回归/相邻逻辑/覆盖缺口/跨产物不一致）
- R-iceberg 报告路径列表
- 用户选项：A. 继续深挖（重置计数器为 0，需说明理由）/ B. 接受剩余项并放行（须产出豁免审批）/ C. 阶段回退

### 3.4 R-iceberg 角色定义

| 属性 | 内容 |
|---|---|
| 简称 | R-iceberg |
| 职责 | 以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 IcebergSweepReport |
| 允许动作 | ① 读全阶段产物（需求/设计/代码/测试/TLA+/BDD/graph.json/RTM）；② 读本轮 reworkHints 历史 + 修复点；③ 读上一轮 IcebergSweepReport（避免重复发现）；④ 运用冰山扫掠方法（见 3.6）；⑤ 产出 IcebergSweepReport JSON + .md |
| 禁止动作 | ① 改任何产物文件（由 S-fix 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 project.status；⑤ 跨阶段定位（仅当前阶段产物）；⑥ 评审其他角色产出；⑦ 跳过 V 复审直接触发 S-fix |

**R-iceberg 与 R（根因定位）的区别**：R 是"被动定位已暴露问题的根因"，R-iceberg 是"主动深挖未暴露的隐藏问题"。R 产出单问题根因链，R-iceberg 产出多发现扫掠报告。两者不互相替代。

### 3.5 IcebergSweepReport Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/iceberg-sweep.schema.json",
  "title": "IcebergSweepReport",
  "description": "冰山扫掠报告形状（R-iceberg 子代理产出；触发于 S-fix 后或阶段门放行前；以已发现/已修复问题为线索主动深挖隐藏问题）",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "reportId", "phase", "triggerType", "icebergRound",
    "sweptAt", "sweptBy", "线索来源",
    "newFindings", "sweepCoverage", "summary", "passed"
  ],
  "properties": {
    "reportId": {
      "type": "string",
      "pattern": "^IS-phase[1-8]-[1-5]-[0-9]+$",
      "description": "冰山扫掠报告 ID，格式 IS-phase<N>-<round>-<seq>，如 IS-phase3-2-01"
    },
    "phase": {
      "type": "string",
      "description": "当前阶段标识，如 phase3-outline"
    },
    "triggerType": {
      "type": "string",
      "enum": ["ICEBERG-A", "ICEBERG-B"],
      "description": "触发类型：ICEBERG-A=S-fix后深挖（防修复引入新缺陷+同根因扩散），ICEBERG-B=阶段门前全局扫掠"
    },
    "icebergRound": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "description": "冰山轮次（1-5，maxIcebergRounds=5），ICEBERG-A 和 ICEBERG-B 共享计数器，每阶段独立计数，阶段进入时重置为 0"
    },
    "sweptAt": {
      "type": "string",
      "format": "date-time",
      "description": "扫掠时间戳，ISO 8601 字符串"
    },
    "sweptBy": {
      "type": "string",
      "minLength": 1,
      "description": "扫掠者标识（R-iceberg 子代理），非空字符串"
    },
    "线索来源": {
      "type": "object",
      "description": "深挖线索：本轮已发现的问题历史 + 已修复点 + 上一轮冰山发现（去重依据）",
      "additionalProperties": false,
      "required": ["reworkHintsHistory", "fixedPoints", "previousFindings"],
      "properties": {
        "reworkHintsHistory": {
          "type": "array",
          "items": { "type": "string" },
          "description": "本阶段所有 V/G reworkHints 历史数组"
        },
        "fixedPoints": {
          "type": "array",
          "items": { "type": "string" },
          "description": "已修复的缺陷位置列表（文件:行号/节点ID，遵循 format-conventions.md）"
        },
        "previousFindings": {
          "type": "array",
          "items": { "type": "string" },
          "description": "上一轮 IcebergSweepReport 的 findingId 列表（去重依据，本轮不得重复发现）"
        }
      }
    },
    "newFindings": {
      "type": "array",
      "description": "新发现的隐藏问题列表，空数组=无新问题=终止条件①满足",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["findingId", "severity", "category", "location", "description", "evidence", "hypothesis", "relatedFixedPoint"],
        "properties": {
          "findingId": {
            "type": "string",
            "pattern": "^IF-phase[1-8]-[1-5]-[0-9]+$",
            "description": "冰山发现 ID，格式 IF-phase<N>-<round>-<seq>，如 IF-phase3-2-01"
          },
          "severity": {
            "type": "string",
            "enum": ["Critical", "Required", "Optional"],
            "description": "严重等级：Critical=阻断级（须修复后才能放行）/ Required=必须修复 / Optional=可选优化（与 V 的 Severity 对齐，但不含 Nit/FYI 因冰山发现默认须走返工）"
          },
          "category": {
            "type": "string",
            "enum": ["same-root-cause-spread", "same-defect-class", "fix-induced-regression", "adjacent-logic", "coverage-gap", "cross-artifact-inconsistency"],
            "description": "发现类别：same-root-cause-spread=同根因扩散 / same-defect-class=同缺陷类 / fix-induced-regression=修复引入回归 / adjacent-logic=相邻逻辑 / coverage-gap=覆盖缺口 / cross-artifact-inconsistency=跨产物不一致"
          },
          "location": {
            "type": "string",
            "minLength": 1,
            "description": "缺陷位置，格式 path:§section 或 path:L42（遵循 format-conventions.md 冒号分隔）"
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "description": "缺陷描述（非空字符串，具体指出缺陷内容与影响）"
          },
          "evidence": {
            "type": "string",
            "minLength": 1,
            "description": "证据引用（具体产物字段/行号/节点ID），禁止空泛（check-iceberg-sweep.ts R7 校验）"
          },
          "hypothesis": {
            "type": "string",
            "minLength": 1,
            "description": "可证伪假设：若此发现消除，关联现象是否消失（check-iceberg-sweep.ts R7 校验）"
          },
          "relatedFixedPoint": {
            "type": "string",
            "minLength": 1,
            "description": "关联的已修复点（说明为何这是冰山扩散发现，与 fixedPoints 中某项关联）"
          }
        }
      }
    },
    "sweepCoverage": {
      "type": "object",
      "description": "扫掠覆盖范围记录",
      "additionalProperties": false,
      "required": ["sweptArtifacts", "sweptDimensions"],
      "properties": {
        "sweptArtifacts": {
          "type": "array",
          "items": { "type": "string" },
          "description": "扫掠的产物路径列表"
        },
        "sweptDimensions": {
          "type": "array",
          "items": { "type": "string", "enum": ["completeness", "reliability", "security"] },
          "description": "扫掠维度（三维度须全覆盖）",
          "minItems": 3,
          "maxItems": 3
        }
      }
    },
    "summary": {
      "type": "string",
      "minLength": 50,
      "description": "扫掠一句话结论（至少50字符，含发现数+维度覆盖+终止判定）"
    },
    "passed": {
      "type": "boolean",
      "description": "true=newFindings为空（可终止/放行），false=有新发现（须走返工）。check-iceberg-sweep.ts R8 校验 passed 与 newFindings 一致性"
    }
  }
}
```

### 3.6 冰山扫掠方法（R-iceberg 提示词核心）

R-iceberg 采用**线索驱动 + 三维度 + 六类别**扫掠法。

#### 3.6.1 三维度（与 R3 对齐，但目的不同）

- **completeness**：全产物完整性（是否有遗漏字段/未覆盖场景/未定义状态）
- **reliability**：可靠性（TLA+/BDD 等价性是否真等价 / 状态机是否真一致 / 接口契约是否真对齐）
- **security**：安全基线（输入校验/鉴权/越权/敏感信息是否在相邻逻辑也缺失）

#### 3.6.2 六类别深挖（以线索为起点）

| 类别 | 深挖方向 | 示例 |
|---|---|---|
| same-root-cause-spread | 同根因是否扩散到其他产物 | 阶段2 SD 缺状态定义→阶段3 DD 是否也缺、阶段4 INTF 是否也缺 |
| same-defect-class | 同类缺陷是否出现在其他位置 | 文件A缺null检查→同模块其他文件是否也缺 |
| fix-induced-regression | 修复是否引入新缺陷 | S-fix 改了状态转移→是否破坏不变式 / 是否影响 BDD 等价 |
| adjacent-logic | 相邻逻辑是否有同类隐患 | 修复了create路径→update/delete路径是否也有 |
| coverage-gap | 覆盖是否有缺口 | RTM 标记100%但某 REQ 的异常路径未覆盖 |
| cross-artifact-inconsistency | 跨产物是否不一致 | TLA+ states 与 BDD Background states 不一致 |

#### 3.6.3 六类别在 TLA+ 状态机一致性检查中的应用示例

> 场景假设：阶段 3 概要设计，V/G 发现 L2_BlogSystem.tla 的 `PublishArticle` 转移缺少 `archived` 状态的守卫条件（`archived` 状态下不应允许 Publish），S-fix 已修复该转移。R-iceberg 以此修复点为线索深挖。

**类别 1：same-root-cause-spread（同根因扩散）**

根因：`PublishArticle` 转移缺 `archived` 守卫 → 根因是"状态守卫条件不完整"。

深挖方向：同根因是否扩散到其他 TLA+ spec / 其他转移 / 其他层级。

```
线索：L2_BlogSystem.tla PublishArticle 修复了 archived 守卫缺失
深挖：
  ├─ 同 spec 其他转移：DeleteArticle / ArchiveArticle / RestoreArticle 是否也缺 archived 守卫？
  │   → 发现：RestoreArticle 转移未校验 source 状态 ∈ {archived}，可从任意状态 restore（同类缺陷）
  ├─ 同层级其他 spec：L2_CommentSystem.tla 的 AddComment 转移是否校验 article 状态 ∈ {published}？
  │   → 发现：AddComment 未校验 article 状态，archived 文章仍可评论（同根因扩散到评论子系统）
  └─ 跨层级：L3_ArticleLifecycle.tla（L2 的细化）是否继承了 L2 的守卫缺失？
      → 发现：L3 的 PublishArticle.next 未同步修复（根因扩散到下层）
```

对应 check 脚本盲区：`check-tla-model.ts` 校验转移集语法 + TLC 模型检查，但不校验"守卫条件语义完整性"（需业务逻辑判断）。

**类别 2：same-defect-class（同缺陷类）**

缺陷类：转移的 source 状态集未枚举完整。

深挖方向：同类缺陷是否出现在其他状态机的其他转移。

```
线索：PublishArticle 转移 source 状态集不完整
深挖：
  ├─ L2_BlogSystem.tla 所有转移的 source 状态集枚举：
  │   PublishArticle: 修复后 = {draft} ✓
  │   ArchiveArticle: source = {published} —— 但 archived 状态可达，是否漏了 archived→archived 的自环或守卫？
  │   DeleteArticle: source = {draft, published} —— archived 状态下不能删除？业务语义待核验
  ├─ L2_UserSystem.tla 状态机：
  │   BanUser 转移 source = {active} —— 但 {banned} 状态下是否应禁止再次 Ban？source 集是否完整？
  └─ L2_CommentSystem.tla 状态机：
      DeleteComment 转移 source = {visible} —— {hidden} 状态下能否删除？source 集不完整（同类缺陷）
```

对应 check 脚本盲区：`check-tla-bdd-sync.ts` 校验 TLA+ 与 BDD 转移集等价，但若 BDD 也漏了同一转移，等价性校验仍通过（共因失效）。

**类别 3：fix-induced-regression（修复引入回归）**

修复点：S-fix 给 `PublishArticle` 加了 `state = draft /\ ¬archived` 守卫。

深挖方向：修复是否破坏不变式 / 状态可达性 / BDD 等价性 / 代码一致性。

```
线索：PublishArticle 新增 archived 守卫
深挖：
  ├─ 不变式回归：
  │   TypeInvariant 仍成立？✓（TLC 已验证）
  │   但业务不变式 `∀ a ∈ Article: published(a) ⇒ ∃ t. created(a) < t < published(a)` 是否仍满足？
  │   → 发现：新增守卫后，draft→published 的时序约束未在不变式中体现（修复暴露了不变式不完整）
  ├─ 状态可达性回归：
  │   archived 状态是否仍可达？修复后 PublishArticle 不再从 archived 触发，但 ArchiveArticle 仍可达 archived ✓
  │   → 但 RestoreArticle 若也修了守卫，archived 是否变成死状态？（可达性回归）
  ├─ BDD 等价性回归：
  │   L2_blog_system-002.feature 的 Background states 是否同步更新？
  │   → 发现：BDD states 仍为 {draft, published, archived}，但 transitions 表未加 archived 守卫（修复引入 TLA+/BDD 不一致）
  └─ 代码一致性回归：
      src/services/article-service.ts 的 publish 方法是否同步加 archived 校验？
      → 发现：代码未同步修复（fix-induced 的 code-TLA+ 不一致，check-code-tla-consistency 会命中但须先深挖发现）
```

对应 check 脚本盲区：`check-code-tla-consistency.ts` 是阶段 5 才跑，阶段 3 无法发现代码回归；`check-tla-bdd-sync.ts` 能发现 BDD 不一致但须 BDD 先更新。

**类别 4：adjacent-logic（相邻逻辑）**

修复点：`PublishArticle` 转移。

深挖方向：相邻转移（共享状态/变量）是否有同类隐患。

```
线索：PublishArticle 涉及状态 draft→published
深挖相邻转移（共享 draft 或 published 状态的转移）：
  ├─ 共享 draft 状态：EditArticle（draft→draft）、SubmitArticle（draft→submitted 若有）
  │   → EditArticle 是否校验 ¬archived？发现：EditArticle 未校验，archived 文章可编辑（相邻逻辑同类隐患）
  ├─ 共享 published 状态：ArchiveArticle（published→archived）、UnpublishArticle（published→draft）
  │   → UnpublishArticle 是否校验 ¬archived？已修复 PublishArticle 但 Unpublish 反向转移未校验
  └─ 共享 article 变量的跨 spec 转移：
      L2_CommentSystem.AddComment 依赖 article.published —— 但修复后 archived≠published，
      AddComment 的前置条件 `article.state = published` 是否需更新为 `article.state = published /\ ¬archived`？
```

对应 check 脚本盲区：`check-tla-model.ts` 的层次一致性校验只看头注解 `@child/@sibling` 结构，不校验跨 spec 变量依赖的语义一致性。

**类别 5：coverage-gap（覆盖缺口）**

深挖方向：TLA+ 规格是否覆盖所有 SD 节点 / 所有状态 / 所有转移。

```
线索：PublishArticle 修复后涉及 archived 状态
深挖：
  ├─ @designIds 覆盖：
  │   L2_BlogSystem.tla @designIds = SD-001,SD-003,SD-005
  │   graph.json 中 type=SD 节点全集 = SD-001..SD-008
  │   → 发现：SD-007（文章归档子系统）未在 @designIds 中（覆盖缺口）
  ├─ 状态覆盖：
  │   状态集 = {draft, published, archived}
  │   但 SD-007 描述了 "soft-deleted" 状态 —— TLA+ 未建模该状态（规格覆盖缺口）
  └─ 转移覆盖：
      SD-005 描述了 "批量归档" 转移 —— TLA+ Next 中无 BatchArchive 转移（转移覆盖缺口）
```

对应 check 脚本盲区：`check-tla-model.ts --graph` 能校验 `sdCoverage.uncoveredSdNodes`，但只看 ID 是否声明，不校验 SD 节点描述的状态/转移是否真在 TLA+ 中建模（语义覆盖缺口）。

**类别 6：cross-artifact-inconsistency（跨产物不一致）**

深挖方向：TLA+ 状态机与设计文档 / BDD / RTM / graph.json 的跨产物一致性。

```
线索：PublishArticle 转移修复（新增 archived 守卫）
深挖跨产物：
  ├─ TLA+ ↔ 设计文档：
  │   docs/phase3-outline/blog-system-outline-design.md §3.2 状态机图是否包含 archived 状态？
  │   → 发现：设计文档状态机图只有 {draft, published}，无 archived（TLA+ 修复后与设计文档不一致）
  ├─ TLA+ ↔ BDD：
  │   L2_blog_system-002.feature Background acceptingStates 是否包含 archived？
  │   → 发现：BDD acceptingStates = {published}，但 TLA+ archived 是终态应纳入 acceptingStates（跨产物不一致）
  ├─ TLA+ ↔ RTM：
  │   RTM 中 SD-003 关联的 TLA+ spec ID = L2_BlogSystem，但 archived 状态相关用例 UAT-015 未关联该 spec？
  │   → 发现：RTM 测试列遗漏 archived 状态的验收用例关联
  └─ TLA+ ↔ graph.json：
      graph.json 中 SD-003 节点的 edges 是否包含 archived 相关转移？
      → 发现：graph.json 缺 SD-003 → archived 状态节点的边（图谱与 TLA+ 不一致）
```

对应 check 脚本盲区：`check-tla-bdd-sync.ts` 校验 TLA+↔BDD 等价但仅看转移集/状态集/不变式，不看 acceptingStates 语义；`check-requirement-graph.ts` 校验图谱结构但不校验与 TLA+ 的语义一致性；RTM 关联一致性靠 `check-artifact-gate.ts` 但阶段 3 不跑终检。

#### 3.6.4 六类别与 check 脚本盲区对照总结

| 类别 | 典型 check 脚本盲区 | R-iceberg 补位价值 |
|---|---|---|
| same-root-cause-spread | check-tla-model 不校验守卫语义完整性 | 横向扩散到同/跨 spec 的同根因 |
| same-defect-class | check-tla-bdd-sync 不防共因失效（两边都漏） | 纵向枚举所有同类缺陷位置 |
| fix-induced-regression | check-code-tla-consistency 阶段5才跑；BDD 须先更新才能发现不一致 | 修复后立即回归扫掠，不等下游 |
| adjacent-logic | check-tla-model 层次一致性只看结构不看语义 | 共享状态/变量的相邻转移深挖 |
| coverage-gap | check-tla-model --graph 只看 ID 声明不看语义建模 | SD 描述的状态/转移是否真建模 |
| cross-artifact-inconsistency | 各 check 脚本各自为政，无跨产物语义一致性校验 | TLA+↔设计文档/BDD/RTM/graph 全链路扫掠 |

#### 3.6.5 扫掠流程

```
1. 加载线索（reworkHints 历史 + fixedPoints + previousFindings）
2. 提取每个 fixedPoint 的根因类别（从关联的 RootCauseReport）
3. 对全阶段产物按三维度×六类别扫掠
4. 去重（与 previousFindings 比对）
5. 产出 IcebergSweepReport
```

### 3.7 R-iceberg 分派模板

```
角色：根因定位子代理-冰山扫掠变体（R-iceberg）
当前 W 模型阶段：<阶段 N - 名称>
冰山轮次：<icebergRound，1-5>
触发类型：<ICEBERG-A | ICEBERG-B>

任务：以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 IcebergSweepReport

上下文：
  - 线索来源：
    - reworkHints 历史：<本阶段所有 V/G reworkHints 数组>
    - fixedPoints：<已修复的缺陷位置列表>
    - 关联 RootCauseReport 路径：<列表，用于提取根因类别>
    - 上一轮 IcebergSweepReport 路径：<若 icebergRound>1，用于去重>
  - 全阶段产物路径：<列出本阶段所有产物文件路径>
  - 上游产物路径（用于跨产物一致性检查）：<列出>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径>

必读：
  - references/iceberg-sweep-guide.md（冰山扫掠方法论）
  - references/format-conventions.md（location 格式）
  - references/anti-patterns.md（避免误判流程问题为产物问题）

扫掠方法：
  - 三维度：completeness / reliability / security
  - 六类别：same-root-cause-spread / same-defect-class / fix-induced-regression / adjacent-logic / coverage-gap / cross-artifact-inconsistency
  - 流程：加载线索 → 提取根因类别 → 三维度×六类别扫掠全产物 → 去重 → 产出报告

产出契约：
  1. IcebergSweepReport JSON：.w-model/iceberg/<reportId>.json
  2. 人类可读报告：.w-model/iceberg/<reportId>.md
  3. 必须满足 IcebergSweepReport Schema
  4. newFindings 每项须含可证伪 hypothesis + 具体 evidence
  5. 返回编排者：{role:"R", variant:"iceberg", reportId, reportPath, newFindingsCount, passed, summary}

禁止：
  - 改任何产物文件（由 S-fix 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 跨阶段定位
  - 跳过 V 复审直接触发 S-fix
  - 产出空泛发现（须可证伪 + 具体证据）
```

### 3.8 check-iceberg-sweep.ts（新校验脚本）

遵循项目既有 `logic.ts` + `check-*.ts` 双层模式（纯逻辑 + CLI 层）。

**CLI 接口**：
```bash
# 单报告校验
npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts <report.json>

# auto-trigger 模式（从 run-log 推断）
npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts <project-dir> --phase=<N> --auto-trigger --run-log=<run-log.jsonl>
```

**校验规则（R1-R8）**：

| 规则 | 校验内容 | 失败退出码 |
|---|---|---|
| R1 schema | IcebergSweepReport 须通过 `iceberg-sweep.schema.json` 校验（`validateBySchema` 前置，反模式 #28） | 1 |
| R2 reportId 格式 | `reportId` 须匹配 `^IS-phase[1-8]-[1-5]-[0-9]+$` | 1 |
| R3 phase 一致 | `report.phase` 须与期望阶段一致（auto-trigger 模式校验） | 1 |
| R4 triggerType 合法 | `triggerType ∈ {ICEBERG-A, ICEBERG-B}` | 1 |
| R5 icebergRound 边界 | `1 ≤ icebergRound ≤ 5`（maxIcebergRounds=5） | 1 |
| R6 newFindings 去重 | 每个 finding 的 `findingId` 不得与 `线索来源.previousFindings` 重复 | 1 |
| R7 newFindings 可证伪 | 每个 finding 须含非空 `hypothesis` + `evidence`（禁止空泛） | 1 |
| R8 passed 一致性 | `passed=true` 当且仅当 `newFindings=[]` | 1 |

**退出码**：`0=通过 / 1=校验失败 / 2=输入错误`（遵循 §10E E.1 exitCode 强一致）

**GATE_JSON 输出结构**（与既有脚本一致）：
```json
{
  "script": "check-iceberg-sweep.ts",
  "exitCode": 0,
  "passed": true,
  "reasons": [],
  "reportSummary": {
    "reportId": "IS-phase3-2-01",
    "triggerType": "ICEBERG-A",
    "icebergRound": 2,
    "newFindingsCount": 0,
    "passed": true
  }
}
```

**--auto-trigger 模式**（仿 check-preventive-review.ts）：从 run-log 读取当前阶段 + 推断最近一次 R-iceberg 分派，自动定位报告路径。

### 3.9 iceberg-sweep-logic.ts（纯逻辑层）

```typescript
import { validateBySchema } from './schema-loader.js';

export interface IcebergFinding {
  findingId: string;
  severity: 'Critical' | 'Required' | 'Optional';
  category: 'same-root-cause-spread' | 'same-defect-class' | 'fix-induced-regression'
           | 'adjacent-logic' | 'coverage-gap' | 'cross-artifact-inconsistency';
  location: string;
  description: string;
  evidence: string;
  hypothesis: string;
  relatedFixedPoint: string;
}

export interface IcebergSweepReport {
  reportId: string;
  phase: string;
  triggerType: 'ICEBERG-A' | 'ICEBERG-B';
  icebergRound: number;
  sweptAt: string;
  sweptBy: string;
  线索来源: {
    reworkHintsHistory: string[];
    fixedPoints: string[];
    previousFindings: string[];
  };
  newFindings: IcebergFinding[];
  sweepCoverage: {
    sweptArtifacts: string[];
    sweptDimensions: ('completeness' | 'reliability' | 'security')[];
  };
  summary: string;
  passed: boolean;
}

export interface IcebergSweepCheckResult {
  passed: boolean;
  reasons: string[];
  reportSummary: {
    reportId: string;
    triggerType: string;
    icebergRound: number;
    newFindingsCount: number;
    passed: boolean;
  };
}

const MAX_ICEBERG_ROUNDS = 5;

export function checkIcebergSweep(report: IcebergSweepReport): IcebergSweepCheckResult {
  const reasons: string[] = [];
  // R1: schema 前置校验（反模式 #28）
  const schemaResult = validateBySchema('iceberg-sweep', report);
  if (!schemaResult.valid) {
    for (const msg of schemaResult.errorMessages) {
      reasons.push(`[schema] ${msg}`);
    }
  }
  // R5: icebergRound 边界
  if (report.icebergRound < 1 || report.icebergRound > MAX_ICEBERG_ROUNDS) {
    reasons.push(`icebergRound 越界：${report.icebergRound}，须 1-${MAX_ICEBERG_ROUNDS}`);
  }
  // R6: newFindings 去重
  const prevSet = new Set(report.线索来源.previousFindings);
  for (const f of report.newFindings) {
    if (prevSet.has(f.findingId)) {
      reasons.push(`findingId 重复：${f.findingId} 已在上一轮发现`);
    }
    // R7: 可证伪 + 证据非空
    if (!f.hypothesis || !f.evidence) {
      reasons.push(`finding ${f.findingId} 缺 hypothesis 或 evidence（禁止空泛）`);
    }
  }
  // R8: passed 一致性
  const expectedPassed = report.newFindings.length === 0;
  if (report.passed !== expectedPassed) {
    reasons.push(`passed 不一致：newFindings=${report.newFindings.length} 但 passed=${report.passed}`);
  }
  return {
    passed: reasons.length === 0,
    reasons,
    reportSummary: {
      reportId: report.reportId,
      triggerType: report.triggerType,
      icebergRound: report.icebergRound,
      newFindingsCount: report.newFindings.length,
      passed: report.passed,
    },
  };
}
```

### 3.10 反模式 #44：跳过冰山扫掠直接放行

新增反模式，编号 #44（接续 #43）。

| 属性 | 内容 |
|---|---|
| **#** | 44 |
| **反模式** | 跳过冰山扫掠直接放行（S-fix 后或阶段门放行前未分派 R-iceberg，或 R-iceberg 发现新问题后未经 V 复审直接放行） |
| **危害** | 已修复问题只是"水面之上 1/8"，水面之下的同根因扩散/同缺陷类/修复引入回归/相邻逻辑隐患被掩盖，缺陷后移到下游阶段才暴露，修复成本指数级上升 |
| **正确做法** | ① S-fix 后必须分派 R-iceberg（ICEBERG-A）；② 阶段门放行前必须分派 R-iceberg（ICEBERG-B）；③ R-iceberg 发现新问题必须经 V 复审后走标准 R→V→G→S-fix 返工；④ R-iceberg `newFindings=[]` 或达 maxIcebergRounds=5（CHECKPOINT 升级）才可放行 |
| **检测信号** | 信号1：run-log 中 S-fix 后无 `action=iceberg-sweep` 条目；信号2：阶段门 CHECKPOINT 前无 ICEBERG-B 报告；信号3：IcebergSweepReport 存在但无对应 V 复审 VerifierOutput；信号4：`check-iceberg-sweep.ts` 退出码 1 |
| **回退动作** | 回到 S-fix 产出后起点（ICEBERG-A）或阶段门放行前（ICEBERG-B），补跑 R-iceberg + V 复审 |

**命中高发阶段**：全阶段（S-fix 存在的阶段 1-8 均适用）。

### 3.11 run-log.jsonl 扩展

`run-log.schema.json` 的 `action` 枚举追加：
- `iceberg-sweep`：R-iceberg 分派（字段含 `triggerType` / `icebergRound` / `reportPath` / `newFindingsCount` / `passed`）
- `iceberg-review`：V 复审冰山报告（字段含 `reportId` / `passed` / `validFindings` / `reworkHints`）

### 3.12 编排者分派时序（完整返工循环含冰山扫掠）

```
标准阶段流程：
  O: 分派 S → R3×3 → V → G
    ├─ G 不通过 → R(根因) → V(复审R) → G → S-fix → R3×3(fix) → V → G
    │   ├─ G 通过 → ★ ICEBERG-A：分派 R-iceberg
    │   │   ├─ newFindings 非空 → V 复审报告 → 每个有效发现走 R→V→G→S-fix → 回到 ★
    │   │   └─ newFindings=[] → 若在返工循环中：继续返工收尾；若返工已结束：进入 ICEBERG-B
    │   └─ G 不通过 → round++ → 重新 R
    └─ G 通过（首次或返工最终通过）→ ★★ ICEBERG-B：分派 R-iceberg（全局扫掠）
        ├─ newFindings 非空 → V 复审 → 每个有效发现走 R→V→G→S-fix → 回到 ★（ICEBERG-A）
        └─ newFindings=[] → 🔴 CHECKPOINT · 阶段门放行

ICEBERG 轮次计数：
  - ICEBERG-A 和 ICEBERG-B 共享 icebergRound 计数器
  - 每阶段独立计数，阶段进入时重置为 0
  - icebergRound 达 5 → 🔴 CHECKPOINT 升级（展示已发现+已修复+剩余项，由用户裁定）
```

## 4. 影响范围

| 改动类型 | 文件 | 数量 |
|---|---|---|
| 新增 schema | `schemas/iceberg-sweep.schema.json` | 1 |
| 新增脚本 | `scripts/check-iceberg-sweep.ts` + `scripts/iceberg-sweep-logic.ts` | 2 |
| 新增样本 | `scripts/__tests__/samples/iceberg/` 下 valid + bad 样本（R1-R8 各覆盖） | ~8 |
| 新增单测 | `scripts/__tests__/iceberg-logic.test.ts`（R1-R8） | 1 |
| 新增 reference | `references/iceberg-sweep-guide.md`（冰山扫掠方法论 + 六类别深挖指南 + TLA+ 应用示例） | 1 |
| 文档更新 | `references/anti-patterns.md`（#44）+ `references/subagent-delegation.md`（R-iceberg 分派模板 + 编排时序）+ `references/root-cause-locator.md`（R 与 R-iceberg 边界节）+ `w-model-dev/SKILL.md`（约束 + 编排时序） | ~4 |
| schema 变更 | `run-log.schema.json`（action 枚举 +2） | 1 |
| self-test 扩展 | `scripts/self-test.ts`（基线 +N 冰山样本）+ `scripts/__tests__/samples/` 新增 iceberg 子目录 | 2 |
| 顶层文档 | `docs/skill-design-document_SSoT.md`（§3.4.X 新增节 + §10A 追溯表）+ `AGENTS.md`（§4 新增行 + §8 脚本导航表）+ `CHANGELOG.md` + `README.md`（反模式总数 43→44） | 4 |
| 版本号 | package.json + skill-metadata.json + SKILL.md frontmatter 三处同步 | 3 |

## 5. 验收标准

- [ ] `iceberg-sweep.schema.json` 存在且全字段 description 自描述
- [ ] `check-iceberg-sweep.ts` + `iceberg-sweep-logic.ts` 存在，R1-R8 全实现
- [ ] `iceberg-logic.test.ts` 覆盖 R1-R8，vitest 全通过
- [ ] `iceberg-sweep-guide.md` 存在，含六类别深挖 + TLA+ 应用示例
- [ ] 反模式 #44 在 `anti-patterns.md` 登记，README 反模式总数 43→44
- [ ] `subagent-delegation.md` 含 R-iceberg 分派模板 + 编排时序含 ICEBERG-A/B
- [ ] `run-log.schema.json` action 枚举含 `iceberg-sweep` / `iceberg-review`
- [ ] `SKILL.md` 编排时序含冰山扫掠节点
- [ ] SSoT §3.4.X 新增节 + §10A 追溯表新增行
- [ ] AGENTS.md §4 新增行 + §8 脚本导航表新增 `check-iceberg-sweep.ts` 行
- [ ] `self-test.ts` 基线扩展，`npm run self-test` 退出码 0
- [ ] 版本号三处一致
- [ ] TypeScript strict 0 错误

## 6. 与现有约束的兼容性

- **约束 #17（R3 预防性审查强制）**：R-iceberg 与 R3 正交，R3 在 S 产出后立即触发（评审前 checklist），R-iceberg 在 S-fix 后 / V/G 通过后触发（深挖扫掠）。不冲突。
- **约束 #20（codegraph 修改前查询）**：R-iceberg 只读不写，不触发 codegraph 查询。不冲突。
- **反模式 #18（跳过 R 直接 S 返工）**：R-iceberg 发现的新问题仍走标准 R→V→G→S-fix，不跳过 R。不冲突。
- **反模式 #28（schema 前置校验缺失）**：`iceberg-sweep-logic.ts` 入口调用 `validateBySchema`，遵循反模式 #28。不冲突。
- **反模式 #42（S-fix/emergency-fix 后跳过 R3+V）**：R-iceberg 在 R3+V+G 通过后才触发，不替代 R3+V。不冲突。
- **Budget killSwitch**：冰山轮次消耗预算，killStack 触发时强制终止（终止条件③）。不冲突。
- **self-as-verifier 模式**：R-iceberg 须产出独立 IcebergSweepReport 文件（与 R3 独立产物文件要求一致）。不冲突。

## 7. 理论依据

### 7.1 冰山理论（Iceberg Theory）

冰山理论是一个隐喻，最初由心理学家弗洛伊德和作家海明威在各自领域提出。核心观点：冰山只有 1/8 露出水面，7/8 隐藏在水面之下。

应用到缺陷管理：发现一个问题意味着存在更多隐藏问题。因此需要在修复后继续深度分析→修复→再分析循环，直到不能发现问题。

**与 W 模型的契合点**：
- W 模型的 V 型阶段门 + 返工循环天然支持"深挖→修复→再分析"迭代
- 现有 R（根因定位）机制已提供单问题根因分析能力，R-iceberg 在其上增加"横向扩散深挖"能力
- 三维度（completeness/reliability/security）与 R3 对齐，六类别是 W 模型特有的深挖方向

### 7.2 与其他方法论的关系

| 方法论 | 关系 |
|---|---|
| 5-Why（R 方法 1） | 纵向根因追溯，R-iceberg 的 same-root-cause-spread 类别是横向扩散 |
| 鱼骨图（R 方法 2） | 多因素分析，R-iceberg 的六类别是维度扩展 |
| 缺陷链追溯（R 方法 3） | 跨产物传播追踪，R-iceberg 的 cross-artifact-inconsistency 类别与其互补 |
| 上游回溯（R 方法 4） | 跨阶段根因，R-iceberg 仅当前阶段（不跨阶段），与上游回溯正交 |
