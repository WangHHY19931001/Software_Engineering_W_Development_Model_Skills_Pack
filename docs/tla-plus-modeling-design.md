# 设计：TLA+ 层次化状态机建模与门禁增强

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包阶段 1–8 全流程的状态机建模与门禁
> **创建日期**：2026-07-23
> **依赖**：[skill-design-document_SSoT.md](./skill-design-document_SSoT.md) §3.4 / §4 / §10；[information-flow-validation-design.md](./information-flow-validation-design.md)；[graph-guide.md](../w-model-dev/references/graph-guide.md)
>
> **与 SSoT 的关系**：本文件为设计输入文档，定义 TLA+ 层次化建模层与状态机检查门禁。实现阶段须先把这些设计合并入 SSoT §3.4（角色边界）/ §7.8（tla-manifest.json schema）/ §10.8（TLA+ 门禁），再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。

## 0. 背景与目标

### 0.1 设计公理

> **正常软件系统不允许死锁。任何死锁或矛盾分支必须定位根因并修正，而非绕过。**

形式化方法（TLA+）为 W 模型提供**与结构连通门禁、信息流门禁正交的第三维度**——行为正确性门禁：通过状态机建模与 TLC 模型检查，验证系统的并发/时序/不变式性质在所有可达状态下成立。

| 维度 | 校验什么 | 工具 | 失败信号 |
|---|---|---|---|
| 结构连通（现有） | 节点归属单根树、追溯完整 | `check-requirement-graph.ts` | 孤立 / 多根 / orphan / 追溯缺失 |
| 信息流闭合（现有） | 节点既是生产者又是消费者 | `check-requirement-graph.ts` | 黑洞 / 奇迹 / 死模块 / 边界缺失 |
| **行为正确性（新增）** | **系统状态机无死锁、不变式成立、实现无矛盾** | **`check-tla-model.ts` + tla2tools.jar** | **死锁 / 状态爆炸 / 不变式违反 / 实现错误** |

### 0.2 为什么选择 TLA+

TLA+ 的运行时依赖极简：**Java 11 + 单个 `tla2tools.jar`**。该 jar 包含 SANY 语法解析器、TLC 模型检查器、PlusCal 翻译器，无需安装额外工具链、无需网络、无外部服务依赖。因此本设计**直接内置 jar 包**到技能资产 `w-model-dev/tools/tla2tools.jar`，与现有「技能包自包含、无运行时依赖」原则一致。

| 依赖 | 版本 | 归属 | 说明 |
|---|---|---|---|
| Java runtime | ≥ 11 | 外部（宿主环境预装） | 唯一外部依赖；Java 11 为 LTS 基线 |
| `tla2tools.jar` | TLC2 2.19 of 08 August 2024 | 技能内置 `w-model-dev/tools/tla2tools.jar` | 含 SANY + TLC + PlusCal，单文件分发；2026-07-23 实测确认版本号 |

### 0.3 不在范围内

- **定理证明**（TLAPS）：本设计只用 TLC 显式模型检查（finite state），不引入 TLAPS 证明器。
- **代码自动生成**：TLA+ 规格作为正确性基准（oracle），不自动生成代码；代码由阶段 5 S 子代理按详细设计产出。
- **内容级数据建模**：TLA+ 建模系统行为状态机，不建模具体字段流转（那是信息流层与 RTM 层的职责）。
- **LLM 调用**：技能包不引入 LLM 调用；TLA+ 规格由 S 子代理按提示词产出，校验由确定性脚本 + jar 完成。

## 1. 层次化 TLA+ 建模

### 1.1 三级基础层次（可推广至 N 级）

> **拆解判定方法**：先写 TLA+，分析变量组合数（所有变量取值域的笛卡尔积）。组合数 **>1k 考虑拆**，**>1w 必须拆**。每个下级子系统可视为独立系统继续拆解，推广至 4/5/6 级或更多。

| 层级 | 抽象内容 | 对应 W 模型阶段 | 典型节点 |
|---|---|---|---|
| **L1 系统内外交互** | EXT-IN ↔ System ↔ EXT-OUT 的端到端状态机 | 阶段 1 需求分析 | 顶层系统、外部输入源、外部输出汇 |
| **L2 子系统内部行为 + 同级交互** | 子系统内部状态转移 + 兄弟子系统间协作 | 阶段 2 系统设计 / 阶段 3 概要设计 | 子系统模块、子系统间接口 |
| **L3 原子化子系统行为** | 不可再分的原子行为状态机 | 阶段 4 详细设计 | 类/方法级原子单元 |
| **L4+ 进一步拆解** | 视下级为独立系统递归拆解 | 阶段 4 详细设计（按需） | 原子单元内更细粒度 |

**拆解原则**：
- 每个 TLA+ 规格的变量组合数须 ≤ 1w（10000）；>1w 必须拆解为下级规格。
- 1k < 组合数 ≤ 1w 时，S 子代理须在规格「拆解决策」节声明「已评估，保留」并给出理由。
- 拆解后，下级规格的 `EXTENDS` / `INSTANCE` 关系须与文件头的「下级 TLA 文件相对路径」一致。

### 1.2 TLA+ 文件头规范（强制）

每个 `.tla` 文件**必须**以结构化注释头开始，标注五类元信息。缺失任一字段，`check-tla-model.ts` 退出码 1（反模式 #16）。

```tla
(*
  @system        所属系统名称（如 blog-system / blog-system::auth-subsystem）
  @requirement   关联需求 ID（如 REQ-001, REQ-003）
  @design        关联设计文档相对路径（如 docs/system-design.md#§3.2）
  @parent        上级 TLA 文件相对路径（L1 无父级填 null）
  @sibling       同级 TLA 文件相对路径列表（逗号分隔，无同级填 null）
  @child         下级 TLA 文件相对路径列表（逗号分隔，叶子节点填 null）
  @level         层级（L1 / L2 / L3 / L4 ...）
  @phase         产出阶段（1-8）
*)
```

**字段约束**：
- `@parent` / `@sibling` / `@child` 路径须为相对该 `.tla` 文件的路径，`check-tla-model.ts` 校验目标文件存在且 `@system` 一致。
- L1 规格 `@parent=null`；叶子规格 `@child=null`。
- `@sibling` 与 `@child` 的双向一致性：若 A 声明 B 为 sibling，则 B 须声明 A 为 sibling；若 A 声明 C 为 child，则 C 须声明 A 为 parent。

### 1.3 与 graph.json 的分工

| 文件 | 管什么 | G 跑什么 |
|---|---|---|
| `graph.json` | 结构拓扑 + 信息流拓扑（静态） | `check-requirement-graph.ts` |
| `tla-manifest.json` | TLA+ 层次结构 + 校验状态（动态行为） | `check-tla-model.ts` |
| `rtm.json` | 需求-设计-代码-测试追溯矩阵 | `check-artifact-gate.ts`（阶段 8） |

三者并存，各自独立校验，互不替代。`tla-manifest.json` 是行为层，`graph.json` 是结构层，`rtm.json` 是追溯层。

## 2. tla-manifest.json schema

### 2.1 顶层结构

```json
{
  "version": 1,
  "project": "<project-id>",
  "currentPhase": 1,
  "tools": {
    "jarPath": "w-model-dev/tools/tla2tools.jar",
    "javaMinVersion": 11
  },
  "specs": [<Spec>],
  "checkRounds": [
    {
      "phase": 2,
      "round": 1,
      "timestamp": "2026-07-23T10:00:00Z",
      "specId": "L1-blog-system",
      "syntaxCheck": "pass",
      "tlcCheck": "pass",
      "violations": [],
      "converged": true
    }
  ]
}
```

### 2.2 Spec schema

```json
{
  "id": "L1-blog-system",
  "level": "L1",
  "phase": 1,
  "system": "blog-system",
  "requirementIds": ["REQ-001", "REQ-003"],
  "designRef": "docs/requirement-spec.md#§3",
  "tlaPath": "tla/L1-blog-system.tla",
  "cfgPath": "tla/L1-blog-system.cfg",
  "parent": null,
  "siblings": [],
  "children": ["tla/L2-auth-subsystem.tla", "tla/L2-article-subsystem.tla"],
  "variableCombination": 240,
  "decompositionDecision": "kept-below-threshold",
  "syntaxChecked": true,
  "tlcChecked": true,
  "deadlockFree": true,
  "invariantsHold": true,
  "stateExplosion": false,
  "lastCheckTimestamp": "2026-07-23T10:00:00Z"
}
```

### 2.3 字段语义

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 全局唯一，格式 `L<level>-<system-name>` |
| `level` | string | `L1` / `L2` / `L3` / `L4` ... |
| `phase` | number | 产出该规格的 W 模型阶段 |
| `variableCombination` | number | 变量取值域笛卡尔积（估算值），>1w 必须拆解 |
| `decompositionDecision` | string | `must-split` (>1w) / `consider-split` (>1k) / `kept-below-threshold` (≤1k) / `split-done` (已拆解) |
| `syntaxChecked` | boolean | SANY 语法检查通过 |
| `tlcChecked` | boolean | TLC 模型检查执行完成（不论是否发现违反） |
| `deadlockFree` | boolean | TLC 未发现死锁 |
| `invariantsHold` | boolean | TLC 未发现不变式违反 |
| `stateExplosion` | boolean | TLC 是否因状态空间过大未完成 |

## 3. 校验算法（`check-tla-model.ts` + `tla-logic.ts`）

### 3.1 算法（确定性，无 LLM）

```
输入: tla-manifest.json, [--phase=N], [--spec=<id>], [--skip-tlc]
（步骤 1）环境检查:
   java -version ≥ 11 否则 fail("Java ≥ 11 未找到")
   jar 文件存在（w-model-dev/tools/tla2tools.jar）否则 fail("tla2tools.jar 缺失")
（步骤 2）文件头校验（每个 spec）:
   解析 .tla 文件头部 @system/@requirement/@design/@parent/@sibling/@child/@level/@phase
   任一字段缺失 → headerViolation++
（步骤 3）层次一致性校验:
   parent/child/sibling 双向引用一致
   L1 有且仅有一个 @parent=null 的根规格
   层级单调：child.level = parent.level + 1
   target 文件存在且 @system 一致
（步骤 4）拆解决策校验:
   variableCombination > 10000 ∧ decompositionDecision ≠ "split-done" → mustSplitViolation++
   variableCombination > 1000 ∧ decompositionDecision = "kept-below-threshold" → considerSplitWarning++
（步骤 5）清理轨迹:
   删除 .tla 同目录下的 trace/states 文件（*.dump, *.out, states/）
   实测 TLC 2.19 产物落在 states/<YY-MM-DD-HH-MM-SS>/ 下：
     <Module>.st / <Module>-0.st（状态文件）+ <Module>_0.fp / <Module>_1.fp（指纹文件）
   默认不产生 .dump/.out（特定 flag 才产生），保留清理作为预防
（步骤 6）SANY 语法检查（若 --skip-tlc 则止于此；cwd 置为 .tla 所在目录）:
   java -cp <jar> tla2sany.SANY <tlaPath>
   实测退出码：0=成功 / 11=语法错误；输出走 stdout（含错误消息）
   退出码 ≠ 0 → syntaxError++，记录 stdout
（步骤 7）TLC 模型检查（cwd 置为 .tla 所在目录）:
   java -cp <jar> tlc2.TLC -nowarning -cleanup -config <cfgPath> <moduleName>
   -nowarning：抑制 GC 建议警告
   -cleanup：运行前自动清理 states/ 目录（与步骤 5 互补，双保险）
   实测退出码：0=成功 / 11=死锁 / 12=不变式违反
   解析输出:
     - "Deadlock reached" → deadlockViolation++
     - "Invariant ... violated" → invariantViolation++
     - "out of memory" / "states ... exceeds ... exceeded" / "too many" → stateExplosion=true
     - "Model checking completed. No error has been found." → pass
（步骤 8）汇总:
   passed = (headerViolations=0)
            ∧ (hierarchyConsistent=true)
            ∧ (mustSplitViolations=0)
            ∧ (syntaxErrors=0)
            ∧ (deadlockViolations=0)
            ∧ (invariantViolations=0)
            ∧ (stateExplosion=false)
```

### 3.2 CLI 接口

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误；stdout 输出 JSON 证据摘要
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--skip-tlc]
```

**参数说明**：
- `--phase=N`：只校验 `phase ≤ N` 的规格（与 `check-requirement-graph.ts` 语义一致）。
- `--spec=<id>`：只校验单个规格（调试用）。
- `--skip-tlc`：只跑文件头 + 层次一致性 + SANY 语法检查，跳过 TLC（快速反馈用；阶段门放行前不可跳过 TLC）。

### 3.3 收敛准则

- `passed=true`（零违反）即收敛。
- TLC 运行超时 / 状态爆炸：分派 S 子代理拆解规格（降低 `variableCombination`）后重跑，而非加轮。
- `checkRounds` 跨轮违反数应单调递减；不降反升则分派 S 返工。
- `MAX_ROUNDS=5` 未收敛 → 🔴 CHECKPOINT 介入（展示 violations + reworkHints）。

### 3.4 轨迹文件清理

每次 TLC 运行前，`check-tla-model.ts` 自动删除该规格同目录下的：
- `*.dump`（状态转储）
- `*.out`（TLC 输出重定向）
- `states/` 目录（状态快照）

> 实测 TLC 2.19 产物（2026-07-23）：`states/<YY-MM-DD-HH-MM-SS>/` 子目录下含 `<Module>.st` / `<Module>-0.st`（状态文件）+ `<Module>_0.fp` / `<Module>_1.fp`（指纹文件）。默认不产生 `.dump` / `.out`（特定 flag 才产生），但保留清理作为预防。
>
> 此外 TLC 命令行加 `-cleanup` 标志，由 TLC 自身在运行前清理 `states/` 目录（与脚本侧清理互补，双保险）。
>
> 这是硬约束：**TLA+ 的轨迹文件、状态文件应先删除**，避免历史轨迹干扰本轮校验结果。

## 4. 阶段集成（逐级精细化门禁）

### 4.1 阶段 1–4 的 TLA+ 产出与门禁

TLA+ 建模与现有 ingestion 子流程**叠加**（非替代）：S 产出设计文档后，S 同步产出对应层级的 TLA+ 规格 + `.cfg`，更新 `tla-manifest.json`；G 跑 `check-tla-model.ts` 做行为门禁。

| 阶段 | 开发产物 | TLA+ 产出 | 层级 | 门禁 |
|---|---|---|---|---|
| 1 需求分析 | 需求规格 + 验收测试设计 | L1 系统内外交互状态机 | L1 | `check-tla-model.ts --phase=1`：L1 语法 + TLC 通过 |
| 2 系统设计 | 系统设计 + 系统测试设计 | L1 细化 + L2 子系统拆解 | L1, L2 | `--phase=2`：L1+L2 通过，L2 拆解决策合规 |
| 3 概要设计 | 概要设计 + 集成测试设计 | L2 细化 + L3 原子行为 | L2, L3 | `--phase=3`：L1+L2+L3 通过 |
| 4 详细设计 | 详细设计 + 单元测试设计 | L3+ 按需 L4，变量组合分析 | L3, L4? | `--phase=4`：全层级零违反（硬约束，才放行进编码） |

**阶段 4 硬约束**：`--phase=4` TLA+ 零违反（无死锁 / 无不变式违反 / 无状态爆炸 / 拆解决策合规）+ 图谱零违反，才放行进阶段 5 编码。

### 4.2 阶段 5–8 的 TLA+ 角色

阶段 5–8 不新增 TLA+ 规格（`tla-manifest.json` 冻结为只读），TLA+ 不变量作为**测试 oracle**：

| 阶段 | TLA+ 角色 |
|---|---|
| 5 编码 | TLA+ 不变量作为代码断言依据；单元测试须覆盖 TLA+ 规格中的每个不变式 |
| 6 集成测试 | 集成测试用例须覆盖 L2 子系统间交互状态转移 |
| 7 系统测试 | 系统测试用例须覆盖 L1 端到端状态机路径 |
| 8 验收测试 | 验收测试用例须覆盖 L1 状态机的所有终态 |

### 4.3 编码调试顺序（硬约束）

TLA+ 规格编码调试必须按以下顺序，违反命中反模式 #14：

1. **先清理轨迹文件**（`check-tla-model.ts` 自动执行 + TLC `-cleanup` 标志双保险）。
2. **SANY 语法检查通过**：`java -cp <jar> tla2sany.SANY <module>.tla`（cwd 置为 `.tla` 所在目录）。实测退出码 **0=成功 / 11=语法错误**；输出走 stdout。
3. **TLC 模型检查**：语法检查通过后才允许跑 TLC。语法未通过即跑 TLC → 反模式 #14。
   - 命令：`java -cp <jar> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>`（cwd 置为 `.tla` 所在目录）。
   - 实测退出码：**0=成功 / 11=死锁 / 12=不变式违反**。

## 5. TLA+ 建模合规性约束

### 5.1 不允许的实现（反模式 #16）

TLA+ 规格不接受以下任何一种实现：

| 类型 | 表现 | 检测 |
|---|---|---|
| 占位实现 | `\* TODO` 未实现的状态分支；`Next = []` 空下一步 | G 评审 + V 评审标注 |
| 简化实现 | 刻意减少变量以降低组合数而遗漏需求中的关键状态 | V 评审比对 `@requirement` 覆盖 |
| 错误实现 | 不变式与需求/设计矛盾；状态转移与设计文档不符 | TLC 不变式违反 + V 评审 |

### 5.2 建模与需求/设计的一致性（反模式 #17）

TLA+ 建模必须符合需求和设计。对于**符合需求和设计仍然有问题**的情况（TLC 发现死锁/不变式违反，但规格忠实于需求/设计），须**修正需求或对应级别设计并回退重跑**：

```
TLC 发现违反
  ↓
S 子代理核查：规格是否忠实于需求/设计？
  ├─ 是（规格如实建模了需求/设计）→ 需求或设计本身有缺陷
  │   ↓
  │   回退到对应阶段：修正需求规格或设计文档 → 重写 TLA+ → 重跑 TLC
  └─ 否（规格偏离了需求/设计）→ 规格缺陷
      ↓
      修正 TLA+ 规格 → 重跑 TLC（不回退上游）
```

> 这是关键约束：**TLA+ 建模必须符合需求和设计，对于符合需求和设计仍然有问题的需要修正需求或对应级别设计并回退重跑。**

### 5.3 SD 覆盖要求（与 graph 系统层级树同构）

TLA+ 层次树须与 graph 系统层级树（SSoT §10.10.1）同构覆盖——每个 SD（子系统根）节点须有对应的 TLA+ 行为规格，不得出现「结构层有 SD、行为层无规格」的覆盖缺口（缺陷 D10：11 个子系统但仅 3 个 spec 即本规则要治的覆盖不足）。

| graph 系统层级树节点 | TLA+ 层次 | 规格职责 |
|---|---|---|
| REQ（系统根） | L1 | 系统内外交互状态机 |
| SD（子系统根） | L2 | 子系统内部行为 + 同级交互 |
| INTF（接口根） | L3 | 原子化接口行为 |

**覆盖要求**：
- 每个 SD 须有 TLA+ 覆盖——L2 子系统规格或 L3 接口行为规格（任一即可）。
- 覆盖判定：`tla-manifest.json.specs[]` 中存在某 spec 的 `requirementIds` 含该 SD 关联的 REQ，或 `designRef` 引用该 SD 对应设计文档。
- 强制校验：`check-tla-model.ts --graph=<graph.json>` 提取 SD 节点做覆盖率校验，未覆盖 SD 列表 → `sdCoverageViolation`，exitCode=1。可执行细则见 [tla-plus-guide.md](../w-model-dev/references/tla-plus-guide.md) §10。

**横切设计承载**：
- 横切设计（如 S08 治理子系统）可建独立 L2 规格，其 `@sibling` 指向被治理的子系统规格（而非通过 `@parent`/`@child` 依附）。
- 横切 L2 规格不破坏层级单调性——它仍是 L2，与被治理子系统规格平级，通过 `@sibling` 表达治理关系，对应 graph 的 `governs` 边（SSoT §10.10.2 治理层）。

## 6. 与现有架构的兼容性

### 6.1 编排者-子代理边界

TLA+ 产出与校验遵循现有 O/A/S/V/G 边界：

| 角色 | TLA+ 相关职责 | 禁止 |
|---|---|---|
| O | 路由、跑 `check-tla-model.ts` 看退出码（只读）、CHECKPOINT | 写 .tla / 改 manifest 实体 / 跳过 S→V→G |
| S | 产出 .tla + .cfg + 更新 tla-manifest.json 实体 | 跑 check-tla-model.ts / 越阶段产出 |
| V | 按 verifier-spec 评审 TLA+ 规格的合规性（占位/简化/错误实现） | 跑门禁脚本 / 改 .tla |
| G | 跑 check-tla-model.ts + 回填证据摘要 | 改 .tla / 改 manifest 实体 |

### 6.2 与「技能不内置 LLM」原则

TLA+ 工具链（Java + jar）是**确定性工具**，不含 LLM 调用。规格由 S 子代理用宿主 LLM 产出，校验由 jar + 脚本完成。与现有 `check-artifact-gate.ts` / `check-requirement-graph.ts` 同构。

### 6.3 与 ingestion 子流程的关系

TLA+ 门禁与 ingestion 图谱门禁**正交叠加**：

```
阶段 N（1-4）:
  O 路由 → ingestion 子流程（A→G 图谱校验）→ S 产出设计文档 + TLA+ 规格 → V 评审 → G 跑 check-verifier-output.ts + check-tla-model.ts → CHECKPOINT
```

两条门禁均须通过才放行。图谱门禁管静态结构，TLA+ 门禁管动态行为。

## 7. 新增反模式（#14–#17）

详见 [w-model-dev/references/anti-patterns.md](../w-model-dev/references/anti-patterns.md)。

| # | 反模式 | 危害 | 守护 |
|---|---|---|---|
| 14 | TLA+ 语法检查未通过即跑 TLC / 跳过语法检查 | TLC 报错信息混乱，无法定位是语法还是语义问题 | `check-tla-model.ts` 步骤 6→7 顺序强制 |
| 15 | TLA+ 死锁/状态爆炸/不变式违反放行 | 行为正确性失守，缺陷带入编码 | `check-tla-model.ts` 退出码 1 |
| 16 | TLA+ 占位实现/简化实现/错误实现 | 规格形同虚设，无法作为正确性基准 | V 评审 + G 门禁 |
| 17 | TLA+ 建模与需求/设计不符未回退 | 规格通过但与需求/设计脱节，或需求/设计缺陷被掩盖 | S 核查 + 回退机制（§5.2） |

## 8. 实现清单

| 产物 | 路径 | 说明 |
|---|---|---|
| 设计文档 | `docs/tla-plus-modeling-design.md` | 本文件 |
| 参考指南 | `w-model-dev/references/tla-plus-guide.md` | A/S/V/G 子代理可执行细则 |
| 纯逻辑 | `w-model-dev/scripts/tla-logic.ts` | 校验纯逻辑（单点事实源） |
| CLI 脚本 | `w-model-dev/scripts/check-tla-model.ts` | G 子代理调用入口 |
| 模板 | `w-model-dev/templates/tla-spec-template.md` | .tla 文件头模板 |
| 内置工具 | `w-model-dev/tools/tla2tools.jar` | TLA+ 工具链（TLC2 2.19，2026-07-23 已下载置入） |
| 自检样本（纯逻辑） | `w-model-dev/scripts/samples/tla/*.json` | 8 条 manifest 样本（valid + 7 bad-*），驱动 `checkTlaModel` 纯逻辑，无 Java 依赖，纳入 `npm run self-test` 回归基线 |
| 端到端 fixture | `w-model-dev/scripts/samples/tla-e2e/` | 4 场景（Counter 通过 / DeadlockDemo 死锁 / InvViolation 不变式违反 / SyntaxError 语法错误）的 `.tla` + `.cfg` + manifest，需 Java + tla2tools.jar，手动 `npx tsx check-tla-model.ts <manifest>` 驱动（详见该目录 README.md） |
| SSoT 更新 | `docs/skill-design-document_SSoT.md` | 新增 §7.8 / §10.8 / §3.4.2 更新 |
| SKILL 更新 | `w-model-dev/SKILL.md` | 工作流 + 自检清单 |
| 反模式更新 | `w-model-dev/references/anti-patterns.md` | 新增 #14–#17 |
