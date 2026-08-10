# 四源吸收批次 A（P0，41.0.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地四源吸收 P0 设计质量层 11 项：code-smells-checklist 补复杂度症状组/设计判据条目、quality-standards 类设计规则强化、format-conventions 注释/命名强化、phase-3/4 备选方案对比+设计自检、verifier-spec 评审提问、class-design 模板方案权衡列、候选反模式登记、吸收决策记录挂接，版本 40.2.0 → 41.0.0。

**Architecture:** 纯文档为主（11 项全部）；无脚本改动（候选反模式只入候选区不正式编号，不触发 docs-consistency 联动）。设计判据采用"语言静态工具 + LLM 语义评审"双轨（延续第 40 轮三源吸收先例），class-design 模板字段为提示级不触发 check 脚本。

**Tech Stack:** Markdown、TypeScript（仅验证命令用 tsx/vitest/tsc）。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-four-source-absorption-design.md`

**版本级联:** 40.2.0 → 41.0.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `w-model-dev/references/code-smells-checklist.md` | 新增「组 X：复杂度症状」+ 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）；「中间人」升级 |
| `w-model-dev/references/quality-standards.md` | 「类设计规则」追加深度优先/多类症/组合拆分四信号/通用专用分离；「设计投资」节 |
| `w-model-dev/references/format-conventions.md` | §5 注释规范追加接口注释清单/分离规则/先写注释；§6 命名追加一致性三要求/难取名警报 |
| `w-model-dev/references/phase-4-detailed-design.md` | 类设计节补信息隐藏检查/下沉复杂性检查/异常策略三选项/备选方案对比 |
| `w-model-dev/references/phase-3-outline-design.md` | 接口契约节补备选方案对比/问题驱动格式/接口交集并集自检 |
| `w-model-dev/references/verifier-spec.md` | readability 轴补三信息来源检查；design 评审补备选对比/复杂性下沉/概念完整性；code 评审补复杂三症状提问 |
| `w-model-dev/templates/detailed-design/class-design.md` | 方法级定义表补「方案权衡」必填列；异常列补审查提示 |
| `w-model-dev/references/anti-patterns.md` | 候选反模式登记（APoSD-α / GoF-α / 失控-α / 失控-β 入「候选反模式检测信号」节） |
| `w-model-dev/references/four-source-absorption.md` | **已存在**（本 spec 阶段产出）；本批补充 P0 落点明细 |
| `docs/skill-design-document_SSoT.md` | 新增 §3.4.41 + §10A 追溯表补行 |
| `w-model-dev/SKILL.md` | Bundled Resources 挂 four-source-absorption.md |
| `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `skill-metadata.json` | 级联（新 reference 挂接、版本号） |

---

### Task 1: code-smells-checklist.md 新增「组 X：复杂度症状」+ 设计判据条目

**Files:**
- Modify: `w-model-dev/references/code-smells-checklist.md`

- [ ] **Step 1: 在文件头部「用法」节后追加「组 X：复杂度症状」**

在 `## 组 C：注释` 之前插入：

```markdown
## 组 X：复杂度症状（APoSD ch2，第 41 轮四源吸收）

> 吸收自《软件设计哲学》ch2：复杂性 = 难以理解和修改，三个可观察症状。V-code/design 评审顶层提问："这份代码/设计的复杂性来自哪个症状？"

| 条目 | 检测信号 | 分级 | 关联条目 |
|---|---|---|---|
| X1 变更放大 | 单个需求的改动散落 N 处（一次小改要动多处） | 必须修复 | 霰弹式修改（ch3.19） |
| X2 认知负荷 | 完成任务需记住过多信息；用接口需先读 N 个不相关概念 | 建议修改 | 数据泥团 / 过长参数列表 |
| X3 未知的未知 | 调用方无法从声明/文档判断副作用与依赖；不知道要改哪里 | 必须修复 | 隐藏副作用于构造函数 |

> 复杂度公式 C = Σcp×tp（按触碰频率加权）：很少触碰的复杂部分几乎不贡献整体复杂性——隔离复杂性约等于消除复杂性。
```

- [ ] **Step 2: 在「补充：Refactoring ch3 独有坏味道」表尾追加设计判据条目**

在 `| 夸夸其谈通用性 | ...` 行之后追加：

```markdown
| 信息泄露（后门型） | 同一设计决策反映在多个模块（后门泄露比接口泄露更隐蔽） | 必须修复 | 合并类 / 提取新类封装该知识（APoSD ch5） |
| 时间分解 | 按操作执行顺序切模块导致信息泄露（HTTP 读取/解析两例） | 建议修改 | 重新按职责切分（APoSD ch5.4） |
| 过度专用方法 | 专用方法仅单点调用且可被通用方法覆盖（backspace/delete 专用群） | 建议修改 | 通用化合并（APoSD ch6） |
| 特殊情况爆炸 | if 链可用统一表示消除（空选择用 start==end 表示） | 必须修复 | 统一规则覆盖边界情况（APoSD ch6.5） |
| 透传变量 | 中间方法被迫感知无关参数 | 必须修复 | 共享对象/上下文对象（APoSD ch7.5，见 context-management-guide） |
| 实现文档污染接口 | 接口注释包含实现细节（非抽象定义） | 必须修复 | 接口/实现注释分离（APoSD ch13.5） |
| 难以描述 | 注释必须很长才能讲清抽象；"难以描述"= 抽象缺陷金丝雀 | 建议修改 | 回设计修抽象（APoSD ch15） |
| 难以取名 | 想不出精确直观的名字 → 实体可能语义混杂 | 建议修改 | 回设计拆分语义（APoSD ch14.3） |
| 通用容器滥用 | Pair/Tuple 承载多语义返回值（getKey/getValue 无语义） | 建议修改 | 命名结构体替代（APoSD ch18.4） |
| 隐藏副作用于构造函数/回调 | 构造函数起线程/事件回调须记录何时被谁调用 | 必须修复 | 接口注释说明副作用（APoSD ch18.5） |
| 为拆而拆（浅方法群） | 拆分后需在父子间来回跳读才理解 = 连体方法 | 建议修改 | 内联合并（APoSD ch9.8，先验深度再验长度） |
```

- [ ] **Step 3: 「中间人」分级升级 + 组 F 补平衡判据**

将 `| 中间人 | 对象大量转发调用 | 仅供参考 | 移除中间人/内联函数 |` 改为 `| 中间人 | 对象大量转发调用 / 透传方法（只转发不增值） | 建议修改 | 移除中间人/内联函数（APoSD ch7.1 升级） |`。

在 `## 组 F：函数` 表的 F4 行之后追加：

```markdown
| F5 为拆而拆 | 拆分理由仅是"太长"，拆分后需来回跳读理解（连体方法） | 建议修改 | 内联合并（APoSD ch9.8）——先验深度再验长度 |

> 两源平衡：Clean-Code「函数只做一件事」（G30）防混职责；APoSD「深方法优先于长度」防为拆而拆。判定顺序：先问"接口是否比实现简单"（深度），再问"是否该拆"（长度）。
```

- [ ] **Step 4: 更新参考节**

在「参考」节追加：

```markdown
- 设计判据来源见《软件设计哲学》危险信号总清单（第 41 轮四源吸收，详见 four-source-absorption.md）
```

- [ ] **Step 5: 验证 + Commit**

Grep 确认无 `仅供参考 | 移除中间人` 旧行残留；`组 X` 存在。
```bash
git add w-model-dev/references/code-smells-checklist.md
git commit -m "feat(code-smells): add APoSD complexity-symptom group and design-judgement entries (41.0.0 P0)"
```

### Task 2: quality-standards.md 类设计规则强化 + 设计投资节

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`

- [ ] **Step 1: 「类设计规则」节追加 APoSD 判据**

在 `### 类设计规则（第 40 轮三源吸收）` 节的 `- **私有方法服务面窄 = 拆分信号**` 行之后追加：

```markdown

### 类设计规则补充（第 41 轮四源吸收，APoSD ch4/ch6/ch9）

> 与第 40 轮「类设计规则」（Clean-Code SRP 系）互补：前者防"职责不清"，本节防"过度拆分"。

- **深度优先于大小**：先问"类的接口是否比实现简单"（深模块），再问"是否该拆"；接口需要描述实现才能讲清 = 浅模块信号。
- **多类症警报**：拆分产生大量只被单一调用点使用、接口≈实现的方法/类 → 过度拆分信号，回合并。
- **组合 vs 拆分四信号**（ch9）：满足任一 → 应在一起：① 共享信息；② 总是一起被使用（须双向）；③ 概念上有更高层类别涵盖；④ 不看一段难理解另一段。
- **通用-专用分离**（ch6.6/ch9.4）：专用代码上移（应用层）或下移（驱动层），不渗透通用核心。
- **Getter/Setter 是浅方法**（ch19.6）：公开实例变量违反信息隐藏；避免为公开而公开。

### 设计投资（第 41 轮四源吸收，APoSD ch3）

> 吸收自《软件设计哲学》ch3：战略式编程 vs 战术式编程。10%-20% 为作者参考性表述，**不作硬阈值**。

- **战略式编程**：每次编码任务附带设计改进（"让系统更像一开始就设计成这样"），战术式编程（只让功能尽快跑）是复杂性累积源头。
- **DoD 条目**：每次变更自检——"本次改动是否使系统比改动前更接近整洁设计；若非，说明理由"。
- **与反模式 #47 的关系**：战略式 = 小步持续改进（#47 的正面表述）；禁止"大规模重构式改动"与"每次小改塞一点复杂性"两个极端。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/quality-standards.md
git commit -m "feat(quality-standards): add APoSD depth-first class rules, combination signals, design-investment section"
```

### Task 3: format-conventions.md 注释/命名强化

**Files:**
- Modify: `w-model-dev/references/format-conventions.md`

- [ ] **Step 1: §5 注释规范追加「接口注释必备清单 + 分离规则 + 先写注释」**

在 §5 的 `### 坏注释黑名单` 之前追加：

```markdown
### 接口注释必备清单（第 41 轮四源吸收，APoSD ch13.5）

> 吸收自《软件设计哲学》ch13：接口注释 = 抽象定义（接口非形式化部分只能靠注释承载）。

- **接口注释必备内容**：行为（做什么）/ 参数（含含义与约束）/ 返回 / 副作用 / 异常 / 前置条件。
- **接口注释与实现注释分离**：接口注释描述抽象契约，实现细节归实现注释；实现文档污染接口 = 坏注释（code-smells 组 C）。
- **先写注释（ch15）**：新类先写类接口注释 → 公有方法签名 + 接口注释 → 再填实现；"难以描述" = 抽象有问题的金丝雀，回到设计而非硬写。
```

- [ ] **Step 2: §6 命名约定追加「一致性三要求 + 难取名警报」**

在 §6 的 `- **与坏味道清单的关系**` 行之后追加：

```markdown
- **命名一致性三要求**（APoSD ch14.4）：① 给定目的固定用名；② 该名不得他用（一词一义强化）；③ 目的足够窄（名称歧义 → 语义混杂）。
- **难取名警报**（APoSD ch14.3）：想不出精确直观的名字 → 该实体可能同时承担多个语义，回到设计拆分，而非硬凑名字。
- **坏名称直接造成缺陷**：名称是读者脑中"画面"的来源——孤立看到名称应能猜出指什么（block 逻辑/物理块号混用案例）。
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/format-conventions.md
git commit -m "feat(format-conventions): add APoSD interface-comment checklist, separation rule, naming consistency three-requirements"
```

### Task 4: phase-4-detailed-design.md 设计自检四节

**Files:**
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: 「类设计规则引用」节追加信息隐藏检查 + 下沉复杂性检查**

在 `详细设计阶段的类划分须遵循 ... 类设计不满足时回改设计再进入编码。` 之后追加：

```markdown
### 信息隐藏检查（第 41 轮四源吸收，APoSD ch5）

每个类设计时回答两个问题，答案记录在 class-design.md 类定义「职责」列旁：
1. **本类封装了什么知识（设计决策）？**
2. **该知识还出现在哪些其他类？** —— 同一设计决策散落多模块 = 信息泄露（最重要的类划分危险信号），后门泄露（多方共享但不在接口）比接口泄露更隐蔽。

修复：合并受影响类，或提取新类封装该知识。

### 下沉复杂性检查（第 41 轮四源吸收，APoSD ch8）

每个暴露的配置参数/异常回答："用户能比我们确定更好的值吗？"
- 不能 → 自动计算 + 合理默认值，不暴露参数（"把难题推给用户 = 偷懒"）。
- 必须暴露 → 提供自动计算默认值，并下沉实现复杂性（接口简单比实现简单更重要）。
```

- [ ] **Step 2: 追加「异常策略三选项」节**

在 `### 下沉复杂性检查` 之后追加：

```markdown
### 异常策略三选项（第 41 轮四源吸收，APoSD ch10）

每个方法定义的「异常」列先过此审查（对应 class-design 模板「异常」列提示）：
1. **规避**（首选）：能否通过语义重定义消除异常？（unset→确保变量不存在、substring 越界→截断）；异常是接口一部分，异常多 = 接口浅。
2. **屏蔽**：底层错误由子系统处理（TCP 重传类比），不向上传播。
3. **聚合**：多个底层异常聚合成顶层单处理器（请求级单处理器）。

崩溃是最后手段：仅内存不足等场景，须人工判定、默认不采用（W 模型强调错误处理完备性）。
```

- [ ] **Step 3: 「详细设计算法」步骤 1 类设计补「备选方案对比」**

将步骤 1 的：

```
  1. 类设计
     ├─ 基于概要设计接口契约，产出 docs/phase4-detailed/{module}-class-design.md（类图 + 类定义 + 方法级定义 + 类状态机）
```

改为：

```
  1. 类设计
     ├─ **备选方案对比（第 41 轮吸收，APoSD ch11）**：每个关键类/接口先产出 ≥2 个差异较大的备选签名草案 + 一行优缺点，写入 class-design.md「方案权衡」列；"聪明人一次做对"是幻觉
     ├─ 基于概要设计接口契约，产出 docs/phase4-detailed/{module}-class-design.md（类图 + 类定义 + 方法级定义 + 类状态机 + 方案权衡）
```

- [ ] **Step 4: 验证 + Commit**

```bash
git add w-model-dev/references/phase-4-detailed-design.md
git commit -m "feat(phase-4): add info-hiding check, complexity-sinking check, exception strategy options, design-twice step"
```

### Task 5: phase-3-outline-design.md 备选方案对比 + 接口自检

**Files:**
- Modify: `w-model-dev/references/phase-3-outline-design.md`

- [ ] **Step 1: 「概要设计算法」步骤 1 接口识别前置「备选方案对比」**

将步骤 1 的：

```
  1. 接口识别与契约定义
     ├─ 基于系统设计模块划分，产出 docs/phase3-outline/{module}-interface-contract.md（接口清单 + Schema 10 字段 + 错误码分层）
```

改为：

```
  1. 接口识别与契约定义
     ├─ **备选方案对比（第 41 轮吸收，APoSD ch11）**：每个关键接口先产出 ≥2 个差异较大的备选签名草案 + 一行优缺点（写入 interface-contract.md「备选方案」节）；考虑"什么应可变"（GoF 表 1.2 思想）
     ├─ **接口交集 vs 并集自检（第 41 轮吸收，GoF ch2）**：抽象接口取"所有实现的功能交集"则只强如最弱实现，取"并集"则庞大——明确取舍并记录理由
     ├─ 基于系统设计模块划分，产出 docs/phase3-outline/{module}-interface-contract.md（接口清单 + Schema 10 字段 + 错误码分层 + 备选方案）
```

- [ ] **Step 2: 追加「问题驱动叙述格式」节**

在 `## 接口契约 Schema 模板` 之前追加：

```markdown
## 问题驱动叙述格式（第 41 轮四源吸收，GoF ch2 案例方法）

每个关键接口契约按「目标 + 约束 → 方案 → 权衡」叙述（对应 interface-contract.md「Implementation Decisions」节）：
1. **目标**：本接口要满足什么设计目标（如"统一访问多个存储实现"）。
2. **约束**：不可违背的约束（如"不得引入跨模块共享可变状态"）。
3. **方案**：选定接口签名 + 模式引用（引用设计模式命名，如"本接口用 Strategy 封装 X 算法"）。
4. **权衡**：方案的优点 + 代价（GoF Consequences 写法，缺一即返工 FM-OD-02）。
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/phase-3-outline-design.md
git commit -m "feat(phase-3): add design-twice step, interface intersection/union self-check, problem-driven narrative format"
```

### Task 6: verifier-spec.md 评审提问强化

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: code 评审 readability 轴补「三信息来源检查」**

在 §7.4 code 的 `readability` 子标准描述处追加：

```markdown
- **三信息来源检查（第 41 轮四源吸收，APoSD ch18.3）**：评审时对目标代码依次问：① 抽象是否减少信息量（深接口掩盖实现细节）？② 是否复用约定/已有知识（相似事物相似处理）？③ 好名称/注释是否补充信息（而非复述）？三来源皆弱 → readability 降分。
- **复杂三症状提问（APoSD ch2）**：评审顶层提问"这份代码的复杂性来自哪个症状"——变更放大 / 认知负荷 / 未知的未知（对照 code-smells-checklist 组 X）。
```

- [ ] **Step 2: design 评审补三项检查**

在 design targetKind 的评审说明处追加：

```markdown
- **备选方案对比检查（第 41 轮四源吸收，APoSD ch11）**：设计文档是否含关键接口/类的 ≥2 个备选方案对比？无对比的"一次做对"设计 → feasibility 降分。
- **复杂性下沉提问（APoSD ch8）**：暴露的配置参数/异常是否"用户能比我们确定更好的值"？把决策负担推给用户 = 降分。
- **概念完整性提问（APoSD ch21）**：最重要的概念是否被突出/中心化（决定周围结构）？"认为太多重要"= 浅类之源，"漏认重要"= 未知的未知之源。
```

- [ ] **Step 3: 验证 + Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add three-info-source check, complexity-symptom questions, design alternatives/complexity-sinking/conceptual-integrity checks"
```

### Task 7: class-design 模板「方案权衡」必填列

**Files:**
- Modify: `w-model-dev/templates/detailed-design/class-design.md`

- [ ] **Step 1: 方法级定义表补「方案权衡」列**

将：

```markdown
## 3. 方法级定义

| 方法 | 签名 | 职责 | 前置条件 | 后置条件 | 异常 |
|---|---|---|---|---|---|
| {{create}} | {{(input): Result}} | {{创建}} | {{}} | {{}} | {{}} |

> 强制：每个方法须定义前置条件 + 后置条件 + 异常（缺则 FM-DD-02）。
```

改为：

```markdown
## 3. 方法级定义

| 方法 | 签名 | 职责 | 前置条件 | 后置条件 | 异常 | 方案权衡 |
|---|---|---|---|---|---|---|
| {{create}} | {{(input): Result}} | {{创建}} | {{}} | {{}} | {{}} | 优点：{{}}；代价：{{}} |

> 强制：每个方法须定义前置条件 + 后置条件 + 异常 + 方案权衡（缺则 FM-DD-02；方案权衡 = 1 条优点 + 1 条代价，GoF Consequences 写法，第 41 轮四源吸收）。
> 异常审查提示（第 41 轮）：每个异常先问"能否通过语义重定义规避？"（APoSD ch10.3）；若必须保留，是否采用屏蔽/聚合策略？
> 接口注释提示（第 41 轮）：接口注释 = 抽象定义（行为/参数/返回/副作用/异常/前置条件），实现细节不得污染接口注释（见 format-conventions §5）。
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/templates/detailed-design/class-design.md
git commit -m "feat(templates): add tradeoff column and exception/interface-comment review hints to class-design"
```

### Task 8: anti-patterns.md 候选反模式登记

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 「候选反模式检测信号」节追加四源候选**

在 `## 候选反模式检测信号（来自 Loop 4 爬坡循环）` 节的候选清单表（`### 候选反模式信号来源` 附近）追加 4 行（**不改最大编号期望**，候选区不计入 #1~#47）：

```markdown
| 候选 | 来源 | 检测信号 | 建议处置 |
|---|---|---|---|
| 四源-α 复杂性增量累积（第 41 轮候选） | APoSD ch02.4/ch03 | 每个小改都塞一点复杂性，累积后不可控；与 #47 反向呼应 | 战略式编程（quality-standards「设计投资」节）；转正须人审 + ≥2 项目回归 |
| 四源-β 模式装饰性引用（第 41 轮候选） | GoF ch1.8/ch6 | 设计引用模式名但无参与者/意图/权衡支撑（橡皮图章，类比 #16 占位） | V 评审按「方案权衡」必填列降分；转正须人审 + ≥2 项目回归 |
| 四源-γ 过度 swarm 化（第 41 轮候选） | 失控 ch2 | 无门禁的多代理自由发挥，缺确定性收口（clockware/swarmware 失衡） | 门禁收口（约束 4/10）；转正须人审 + ≥2 项目回归 |
| 四源-δ 纸面理由替代真实门禁（第 41 轮候选） | 失控 ch2/ch11 | 以评审意见/纸面推演替代 exitCode 真实执行 | 强化约束 4/10；转正须人审 + ≥2 项目回归 |
```

- [ ] **Step 2: 验证 + Commit**

Grep 确认反模式最大编号仍为 #47（`docs-consistency` 期望 47 不变）；候选区新增 4 行存在。
```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(anti-patterns): register four-source candidate anti-patterns (α/β/γ/δ) in candidate section"
```

### Task 9: four-source-absorption.md 补 P0 落点明细

**Files:**
- Modify: `w-model-dev/references/four-source-absorption.md`

- [ ] **Step 1: 追加「批次 A 落点明细」节**

在文件末尾追加：

```markdown
## 9. 批次 A（P0，41.0.0）落点明细

| # | 吸收点 | 落地文件 | 落地内容 |
|---|---|---|---|
| 1 | 复杂三症状（APoSD P1） | code-smells-checklist.md | 组 X（X1-X3）+ verifier-spec readability 三信息来源 |
| 2 | 深/浅模块 + 多类症（P3） | quality-standards.md | 深度优先于大小 / 多类症警报 |
| 3 | 信息隐藏/泄露/时间分解（P4） | phase-4 + code-smells | 信息隐藏检查 / 信息泄露（后门型）/ 时间分解条目 |
| 4 | 通用模块更深/消特殊情况（P5） | code-smells + phase-4 | 过度专用 / 特殊情况爆炸条目 |
| 5 | 透传方法/变量（P6） | code-smells | 中间人升级 / 透传变量条目 |
| 6 | 下沉复杂性（P7） | phase-4 | 下沉复杂性检查 |
| 7 | 组合 vs 拆分四信号（P8） | quality-standards | 四信号 |
| 8 | 深方法优先于长度（P9） | code-smells 组 F | F5 + 两源平衡注 |
| 9 | 通过定义规避错误（P10） | phase-4 + class-design | 异常策略三选项 / 异常列审查提示 |
| 10 | 设计两次（P11） | phase-3 + phase-4 + verifier-spec | 备选方案对比步骤 + 评审检查项 |
| 11 | 注释哲学（P12） | format-conventions + code-smells | 接口注释清单 / 分离规则 / 先写注释 / 实现文档污染接口 |
| 12 | 命名三原则（P13） | format-conventions | 一致性三要求 / 难取名警报 |
| 13 | 方案必附权衡（GoF G3） | class-design 模板 | 「方案权衡」必填列 |
| 14 | 候选反模式登记 | anti-patterns.md | 四源-α/β/γ/δ 入候选区 |
```

- [ ] **Step 2: 验证 + Commit**

```bash
git add w-model-dev/references/four-source-absorption.md
git commit -m "docs: add batch-A landing details to four-source-absorption record"
```

### Task 10: SSoT §3.4.41 + SKILL.md 挂接 + 顶层级联 + 版本

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `w-model-dev/SKILL.md`
- Modify: `README.md` / `AGENTS.md` / `docs/INSTALL.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `package.json` / `w-model-dev/skill-metadata.json`

- [ ] **Step 1: SSoT 新增 §3.4.41**

在 SSoT §3.4.40（第 40 轮三源吸收）节后新增：

```markdown
### 3.4.41 第 41 轮：四源吸收（软件设计哲学 / 凤凰架构 / GoF 设计模式 / 失控）

**目的**：补四类空白——设计质量判据（深/浅模块、信息泄露、复杂三症状）、方案词汇表（设计模式目录）、架构决策框架（CAP/微服务粒度/容错/安全）、机制说理层（蜂群共识/元控制/约束创造）。

**P0（41.0.0，11 项）**：code-smells-checklist 组 X + 设计判据条目、quality-standards 类设计规则补充 + 设计投资、format-conventions 接口注释清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 设计自检、verifier-spec 评审提问、class-design 模板「方案权衡」列、候选反模式登记（四源-α/β/γ/δ）。

**P1（41.1.0，10 项）**：design-patterns-catalog（新 reference）、refactoring-catalog 目标结构列、phase-2 CAP/粒度决策矩阵、quality-standards 容错/日志、verifier-spec Architecture/Security 评审、tla-plus-guide 断路器/TCC-SAGA 场景、security-review 认证授权维度、phase-6 补偿/故障注入测试。

**P2（41.2.0，10 项）**：subagent-persona-matrix 证据加权共识、verifier-spec 编辑者/调节器说理、anti-patterns 候选转正评审、hill-climbing 爬山法、tla-plus 不连续系统穷举、operational-recovery 混沌预期/超标重写、quality-standards 约束创造/满意化、phase-7 可观测性验收、SKILL.md 受控失控/clockware-swarmware。

**关键决策**：设计判据双轨（静态工具 + LLM 语义评审）；「方案权衡」为模板提示级不触发脚本；候选反模式不正式编号；说理层并入既有文档不新增哲学参考；吸收决策记录见 references/four-source-absorption.md。
```

并在 SSoT §10A 追溯表补一行（新增 §3.4.41 ↔ 实现文件映射）。

- [ ] **Step 2: SKILL.md Bundled Resources 挂 four-source-absorption.md**

在 Bundled Resources 表 `refactoring-catalog.md | 编码/重构时查重构手法或坏味道→手法映射` 行之后追加：

```
| four-source-absorption.md | 第 41 轮四源吸收（软件设计哲学 / 凤凰架构 / GoF / 失控）决策记录查询 |
```

- [ ] **Step 3: 顶层级联（新 reference 挂接 + 版本号 41.0.0）**

1. `AGENTS.md`：references 行补 `four-source-absorption`（与 external-skills-absorption 等并列）。
2. `README.md`：版本号 → 41.0.0。
3. `docs/INSTALL.md`：版本号 → 41.0.0。
4. `CONTRIBUTING.md`：版本号示例 → 41.0.0。
5. `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` frontmatter：version 40.2.0 → 41.0.0。
6. `CHANGELOG.md` 顶部新增：

```markdown
## [41.0.0] - 2026-08-10

### Added
- 四源吸收 P0（11 项）：code-smells-checklist 组 X 复杂度症状 + 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）、quality-standards 类设计规则补充（深度优先/多类症/组合拆分四信号/通用专用分离）+ 设计投资节、format-conventions 接口注释必备清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 信息隐藏/下沉复杂性/异常策略三选项、verifier-spec 三信息来源 + 复杂三症状 + 设计三项检查、class-design 模板「方案权衡」必填列
- 候选反模式登记：四源-α 复杂性增量累积 / 四源-β 模式装饰性引用 / 四源-γ 过度 swarm 化 / 四源-δ 纸面理由替代真实门禁（候选区，不正式编号）
- 新 reference：four-source-absorption.md（吸收决策记录，挂 Bundled Resources）

### Changed
- 版本号 40.2.0 → 41.0.0
```

- [ ] **Step 4: 全量验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files 全过
npx tsc --noEmit             # 0 错误
npm run check:docs-consistency  # exit 0「✓ 全部一致」（12 项，反模式期望仍 47）
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md w-model-dev/SKILL.md README.md AGENTS.md docs/INSTALL.md CHANGELOG.md CONTRIBUTING.md package.json w-model-dev/skill-metadata.json
git commit -m "feat: P0 four-source absorption (41.0.0) — design-quality layer, tradeoff column, candidate anti-patterns"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 A 11 项全部映射：spec §3.1 #1（Task 1）、#2（Task 2）、#3（Task 3）、#4（Task 4）、#5（Task 5）、#6（Task 6）、#7（Task 7）、#8（Task 8）、#9（Task 9）、#10（Task 10）、#11（Task 10）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown；无 TBD/TODO。
- **类型一致性**：候选反模式命名（四源-α/β/γ/δ）在 Task 8 登记与 spec §4.3 一致；「方案权衡」列在 Task 4（phase-4 引用）与 Task 7（模板）一致；组 X 条目号（X1-X3）在 Task 1 定义与 verifier-spec 引用一致。
- **无脚本改动确认**：本批 11 项全部纯文档/模板；候选反模式入候选区不触发 docs-consistency 期望值联动（期望保持 47）；self-test/vitest 基线不变。
