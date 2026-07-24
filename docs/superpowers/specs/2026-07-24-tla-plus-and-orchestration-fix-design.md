# TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归 设计文档

- **日期**：2026-07-24
- **状态**：待批准
- **作者**：编排者（superpowers brainstorming 流程）
- **影响范围**：w-model-dev 技能包指南/模板/脚本 + SSoT + AGENTS.md
- **触发原因**：第五轮全量重跑暴露三个问题（TLA+ 多次返工 / 编排者越权 / TLA+ 未回归编码）

---

## 1. 问题陈述与根因

### 1.1 问题1：TLA+ 多次返工（指南缺陷）

**证据**：第五轮重跑中 TLA+ 发生 6 次返工，全部源于指南未写明的规则：

| 返工点 | 根因 |
|---|---|
| 模块名 `L1-blog-system` → `L1_blog_system` | 指南未约束 TLA+ 标识符规则（MODULE 名禁止连字符） |
| jarPath/tlaPath/cfgPath 三次路径修正 | 指南未定义 manifest 路径解析基准 |
| cfg-tla 一致性违反（TypeInvariant 未列入 BusinessInvariant） | 模板未示范 BusinessInvariant 聚合定义 |
| checkRounds 字段误填 | checkRounds 语义仅在 tla-plus-modeling-design.md L226 一句话，操作文档无 |
| L2 @child=null 与 manifest L3 child 不一致 | 头部注解填写规则（填 ID 还是路径）模糊 |
| states/ 残留导致校验失败 | states 清理混在 G 步骤内，未作为 S 产出前的前置步骤 |

**归属**：指南缺陷，非 TLA+ 本身问题。子代理每次都在猜指南没写明的规则。

### 1.2 问题2：编排者越权 + 任务设计过重

**证据**：

| 越权动作 | 应由谁做 | 严重度 |
|---|---|---|
| 阶段1：直接 Edit tla-manifest.json 修 jarPath | S 子代理 | 严重（反模式 #10） |
| 阶段1：直接 Move-Item 重命名 TLA+ 文件 | S 子代理 | 严重 |
| 阶段1：在主上下文跑 7 个 gate 脚本并解析输出 | G 子代理 | 严重 |
| 阶段4：直接 Edit tla-manifest.json 修 tlaPath | S 子代理 | 严重 |

**任务设计过重证据**：
- 每个子代理 prompt 1000+ 字，塞 S+V+G 三角色全流程
- 阶段1子代理只完成 S 部分，V/G 全漏
- 阶段4子代理只完成 unit-test-cases.md，TLA+/ingestion/gates 全漏
- 单 S 子代理承担文档+测试设计+RTM+TLA+ 四类产出

**归属**：编排缺陷。编排者遇到产物缺陷时应派 S 返工，而非自己 Edit 修。

### 1.3 问题3：TLA+ 未回归编码产物（设计缺陷，最严重）

**现状**：TLA+ 生命周期断裂
```
阶段1-4：产出 TLA+ 规格 → check-tla-model.ts 校验 → 零违反放行进编码
阶段5-8：TLA+ 资产从此沉默，不再被任何门禁读取
```

**SSoT L1202 已有原则**："阶段5-8：tla-manifest.json 冻结只读；TLA+ 不变式作为测试 oracle（编码与测试须与不变式一致）"——但**无任何机制强制执行**。

**具体缺口**：
- check-tla-model.ts 无代码-TLA+ 一致性校验逻辑
- check-artifact-gate.ts 不检查 TLA+ 资产存在/冻结
- 不校验"SD 子系统都有对应代码模块"

**归属**：SSoT 设计漏洞。原则有，机制无。

---

## 2. 设计目标

1. **消除 TLA+ 返工**：子代理按指南可一次产出合规的 .tla/.cfg/manifest
2. **杜绝编排者越权**：编排者会话内不出现 Write/Edit 写阶段产物（含 TLA+ 产物）
3. **TLA+ 贯穿全周期**：阶段5 编码后，TLA+ 资产作为代码回归验证器，不再沉默
4. **保持架构对称**：新脚本与现有 tla-logic.ts/check-tla-model.ts 对称
5. **不破坏现有门禁**：现有 8 个 check-*.ts 脚本逻辑不变，仅追加新校验

---

## 3. 架构设计

### 3.1 三层修复总览

```
层1：TLA+ 指南与模板修复（问题1）
├── tla-plus-guide.md 新增三节
├── tla-spec-template.md 修正非法写法 + 补示例 + 反例
└── data-models.md 补 tla-manifest schema

层2：编排纪律强化（问题2）
├── subagent-delegation.md 强化信号 + S拆分模板
└── SKILL.md 角色表/自检清单

层3：TLA+ 回归编码（问题3 完整版）
├── code-tla-logic.ts（新建，纯逻辑层）
├── check-code-tla-consistency.ts（新建，CLI入口）
├── gate-logic.ts 终检新增 TLA+ 校验
├── check-artifact-gate.ts 调用新校验
└── SSoT §10.8 新增校验项
```

### 3.2 层1：TLA+ 指南与模板修复

#### 3.2.1 tla-plus-guide.md 新增三节

**新增 §2.0 命名规范**（插入在"公理与门禁维度表"之后）
- TLA+ 标识符规则：`[A-Za-z][A-Za-z0-9_]*`，禁止连字符 `-`、中文、特殊符号
- MODULE 名：`L<level>_<system>[_<subsystem>]`，如 `L1_blog_system`、`L2_auth_subsystem`
- 文件名与 MODULE 名一致：`L1_blog_system.tla`
- 反例：`L1-blog-system`（连字符非法）、`1blog`（数字开头非法）

**新增 §2.1 路径解析基准**
- manifest 中 `jarPath`：相对 cwd（脚本执行目录）解析
- manifest 中 `tlaPath`/`cfgPath`：相对 manifest 文件所在目录解析
- .tla 头部 `@parent`/`@sibling`/`@child`：相对该 .tla 文件所在目录解析
- 示例：demo 项目中 manifest 在 `.w-model/tla-manifest.json`，tlaPath 填 `../tla/L1_blog_system.tla`

**新增 §2.2 前置清单**
- S 子代理产出 .tla 前必做：
  1. 确认 MODULE 名符合命名规范（无连字符）
  2. 确认 BusinessInvariant 聚合所有子不变式
  3. 确认 .cfg INVARIANTS 列表与 BusinessInvariant 展开集合一致
- G 子代理跑校验前必做：
  1. 删除 `tla/states/` 目录和所有 `.st`/`.fp` 文件
  2. 确认 manifest 路径解析基准正确
  3. 先跑 SANY 语法检查，通过后再跑 TLC

**补 checkRounds 字段语义**（在 manifest schema 节）
- `checkRounds`：记录每次 TLA+ 校验轮次的结果数组
- 每轮校验后由 G 子代理追加一条记录
- 字段：`{phase, round, timestamp, specId, syntaxCheck, tlcCheck, violations, converged}`
- 规则：跨轮违反数应单调递减；不降反升则分派 S 返工
- 与 run-log R3 交叉校验：checkRounds 数组长度须与 run-log 中 rework 记录数一致

#### 3.2.2 tla-spec-template.md 修正

**修正 .cfg 模板**（当前 L70-74 非法写法）
- 当前（非法）：`INVARIANT` 后跟多行多名
- 修正为：`INVARIANTS` 关键字 + 列表（合法 TLC 语法）

**补 BusinessInvariant 聚合示例**
```tla
BusinessInvariant ==
    /\ TypeInvariant
    /\ SessionUserRegistered
    /\ ArticlePublishedRequiresRegisteredUser
    /\ CommentRequiresArticleExists
```
对应 .cfg：
```
INVARIANTS
    BusinessInvariant
```
（注：也可列全部子不变式，但聚合写法更推荐）

**新增反例节**
- 反例1：.cfg 混入 `---- MODULE ----`（.cfg 不得含 MODULE 声明）
- 反例2：INVARIANTS 漏列 TypeInvariant
- 反例3：BusinessInvariant 缺少 TypeInvariant 子项
- 反例4：MODULE 名含连字符 `L1-blog-system`

#### 3.2.3 data-models.md 补 tla-manifest schema

新增 `### tla-manifest.json` 节，含完整字段表（与 tla-plus-guide.md 双向追溯）。

### 3.3 层2：编排纪律强化

#### 3.3.1 subagent-delegation.md 强化

**检测信号追加**（L297 清单）
- 信号5：编排者会话出现 Write/Edit 写 `.tla`/`.cfg`/`tla-manifest.json` 实体

**新增 S 子代理任务拆分机制**
- 阶段1-4 允许将 S 拆为两次分派：
  - **S-doc**：产出开发文档 + 同步测试设计 + 更新 RTM 实体
  - **S-tla**：产出 .tla + .cfg + tla-manifest.json 实体
- 分派时序：S-doc → S-tla → V → G（S-tla 依赖 S-doc 的设计文档）
- 新增 S-doc/S-tla 分派模板（在现有 S 模板之后）

#### 3.3.2 SKILL.md 强化

- 角色表"关键禁止"补 `.tla`/`.cfg`/`tla-manifest.json` 实体
- 阶段1-4 分派说明补"可拆 S-doc/S-tla 两次分派"指引
- 自检清单补"无 .tla/.cfg/tla-manifest.json 实体改动"

### 3.4 层3：TLA+ 回归编码（完整版）

#### 3.4.1 新建脚本架构

与现有架构对称：
```
现有：tla-logic.ts（纯逻辑） ← check-tla-model.ts（CLI入口）
新增：code-tla-logic.ts（纯逻辑） ← check-code-tla-consistency.ts（CLI入口）
```

#### 3.4.2 code-tla-logic.ts 纯逻辑层

**接口定义**：
```typescript
interface CodeTlaConsistencyInput {
  manifest: TlaManifest;        // tla-manifest.json 解析结果
  graph: Graph;                 // graph.json 解析结果
  rtm: Rtm;                     // rtm.json 解析结果
  codeFiles: CodeFile[];        // src/ 下所有 .ts 文件解析结果
}

interface CodeFile {
  path: string;
  ast: ts.SourceFile;           // TypeScript Compiler API 解析
  assignments: Assignment[];    // 抽取的赋值语句（状态转移）
  conditionals: Conditional[];  // 抽取的条件分支（状态守卫）
  assertions: Assertion[];      // 抽取的 assert/invariant 调用
}

interface ConsistencyResult {
  passed: boolean;
  dimensions: {
    sdToCodeModule: DimensionResult;      // 维度1
    codeStateTransfer: DimensionResult;   // 维度2
    nextBranchCoverage: DimensionResult;  // 维度3
    invariantCoverage: DimensionResult;   // 维度4
  };
  violations: Violation[];
}
```

**四维度校验逻辑**：

**维度1：SD→codeModule 映射完整性**
- 读 graph.json 提取所有 type=SD 的节点
- 读 rtm.json 每行的 codeModule 字段
- 校验：每个 SD 节点须有至少一个 codeModule 映射
- 违反示例：`SD-REVIEW 无对应 codeModule`

**维度2：代码状态转移抽取**
- 用 TypeScript Compiler API（`ts.createSourceFile`）解析 src/ 下所有 .ts 文件
- 抽取三类节点：
  - 赋值语句（`expressionStatement` 中的 `BinaryExpression`，operator=`=`）
  - 条件分支（`IfStatement`、`SwitchStatement`）
  - 状态变更（调用 `.set()`/`.delete()`/`Map` 操作）
- 输出 CodeFile.assignments / conditionals

**维度3：Next 分支对应**
- 解析每个 L2/L3 spec 的 .tla 文件，抽取 `Next ==` 定义的所有分支（`\/` 分隔的动作）
- 通过 manifest 的 requirementIds 反查 SD 节点 → codeModule → 代码文件
- 校验：每个 Next 分支须有对应代码实现
- 对应策略：
  - TLA+ 动作 `Register(u)` → 代码中存在 `register` 方法/函数
  - TLA+ 动作 `Login(u)` → 代码中存在 `login` 方法/函数
  - 名称相似度匹配（驼峰转换 + 包含匹配）

**维度4：断言覆盖不变式**
- 抽取代码中的 `assert` 调用和自定义 invariant 检查
- 解析 TLA+ BusinessInvariant 的子不变式列表
- 校验：每个 TLA+ 不变式须有对应代码断言或测试用例覆盖
- 宽松策略：不要求 1:1 对应，但要求"覆盖"（测试用例也可作为覆盖证据）

#### 3.4.3 check-code-tla-consistency.ts CLI 入口

**用法**：
```bash
npx tsx check-code-tla-consistency.ts \
  --manifest=.w-model/tla-manifest.json \
  --graph=.w-model/ingestion/graph.json \
  --rtm=.w-model/rtm.json \
  --src=src/
```

**输出**：`CODE_TLA_JSON {passed, dimensions, violations, exitCode}`

**退出码**：0=通过，1=失败

**阶段归属**：阶段5 编码后由 G 子代理跑（与 check-verifier-output 等并列）

#### 3.4.4 gate-logic.ts / check-artifact-gate.ts 终检强化

**gate-logic.ts checkArtifactGate 新增两项校验**：
1. **TLA+ 资产存在性**：`.w-model/tla-manifest.json` 存在且 specs 非空
2. **SD→codeModule 映射**：读 graph.json SD 节点，核验 RTM codeModule 覆盖

（注：代码-TLA+ 一致性的维度2/3/4 由 check-code-tla-consistency.ts 在阶段5执行，终检只验证维度1的 SD→codeModule 映射 + TLA+ 资产存在）

**关于"冻结只读"**：终检不验证 TLA+ 资产内容冻结（无法低成本实现）。"冻结"由编排纪律保证——S-tla 子代理只在阶段1-4 分派，阶段5-8 编排者不应分派 S-tla。若阶段5-8 发现 tla-manifest.json 被修改，由编排者自检清单（§3.3.2）捕获。

#### 3.4.5 SSoT §10.8 修正

- L1202 阶段5-8 行从"只读"升级为"冻结只读 + 须通过代码-TLA+ 一致性回归"
- L1214-1218 追加校验项清单新增：
  - "代码状态转移须与 TLA+ Next 分支对应"
  - "代码断言须覆盖 TLA+ 不变式"
  - "每个 SD 子系统须有对应 codeModule"
- L1168 统一 `--phase` 取值口径（与脚本一致）

---

## 4. 数据流

### 4.1 修复后 TLA+ 全周期数据流

```
阶段1-4（设计验证）：
  S-tla 产出 .tla/.cfg/manifest
    → G 跑 check-tla-model.ts（SANY + TLC + cfg-tla 一致性）
    → 零违反放行进编码

阶段5（代码-TLA+ 回归）：
  S-doc 产出 src/ 代码
    → G 跑 check-code-tla-consistency.ts（四维度校验）
    ↓
    1. graph.json SD 节点 ←→ rtm.json codeModule 字段
    2. TypeScript AST 抽取 ←→ manifest Next 分支
    3. L2/L3 Next 分支 ←→ 代码实现覆盖
    4. 代码断言 ←→ TLA+ BusinessInvariant

阶段8（终检）：
  check-artifact-gate.ts
    → TLA+ 资产存在 + 冻结
    → SD→codeModule 映射完整
    → 四级测试全通过
    → RTM 100%
```

### 4.2 编排者-子代理时序（修复后）

```
阶段1-4：O → S-doc → S-tla → V → G(check-tla-model) → CHECKPOINT
阶段5：  O → S-doc(代码) → V → G(check-code-tla-consistency + 其他) → CHECKPOINT
阶段8：  O → G(check-artifact-gate 终检)
```

---

## 5. 组件清单

| 组件 | 类型 | 职责 |
|---|---|---|
| `references/tla-plus-guide.md` | 修改 | 新增3节 + 修正示例 + 补 checkRounds 语义 |
| `templates/tla-spec-template.md` | 修改 | 修正.cfg + 补聚合示例 + 反例 |
| `references/data-models.md` | 修改 | 补 tla-manifest schema |
| `references/subagent-delegation.md` | 修改 | 强化信号 + S拆分模板 |
| `SKILL.md` | 修改 | 角色表/自检清单/阶段5门禁 |
| `scripts/code-tla-logic.ts` | **新建** | 纯逻辑层（四维度校验） |
| `scripts/check-code-tla-consistency.ts` | **新建** | CLI入口 |
| `scripts/gate-logic.ts` | 修改 | 终检新增 TLA+ 校验 |
| `scripts/check-artifact-gate.ts` | 修改 | 调用新校验 |
| `scripts/self-test.ts` | 修改 | 新增测试样本 |
| `docs/skill-design-document_SSoT.md` | 修改 | §10.8 + §7.8 |
| `AGENTS.md` | 修改 | 同步导航 |

---

## 6. 错误处理与降级

### 6.1 代码-TLA+ 一致性校验的宽松策略

**问题**：TypeScript AST 抽取的"状态转移"与 TLA+ Next 分支的对应是近似匹配，可能误报。

**策略**：
- 维度3（Next 分支对应）采用"名称相似度匹配"（驼峰转换 + 包含匹配），不要求精确 1:1
- 维度4（断言覆盖不变式）允许测试用例作为覆盖证据，不强制代码内 assert
- 校验失败时输出 `violations` 详情，供 S 子代理定位

### 6.2 向后兼容

- 现有 8 个 check-*.ts 脚本逻辑不变
- check-artifact-gate.ts 新增校验项以"追加"方式实现，不修改现有 RTM 覆盖率/四级测试逻辑
- SSoT 修正以"追加校验项"方式，不删除现有 §10.8 内容

---

## 7. 测试策略

### 7.1 self-test.ts 新增样本

- 合规样本：MODULE 名合法、路径正确、BusinessInvariant 聚合、cfg 一致
- 违规样本：MODULE 名含连字符、路径错误、cfg 漏列不变式、checkRounds 误填
- 代码-TLA+ 一致性样本：SD→codeModule 完整 / 缺失、Next 分支覆盖 / 未覆盖

### 7.2 端到端验证

修复完成后，在 w-model-dev-demo 项目跑第六轮全量重跑，验证：
1. TLA+ 零返工（子代理按指南一次产出合规规格）
2. 编排者零越权（无 Write/Edit 写产物）
3. 阶段5 check-code-tla-consistency.ts 退出码 0

---

## 8. 范围外（YAGNI）

- 不引入 TLA+ IDE 集成
- 不实现"自动从代码生成 TLA+"（反向工程）
- 不修改现有 TLA+ 规格的语义内容（只改指南/模板/脚本）
- 不重构现有 check-tla-model.ts（保持纯 TLA+ 校验职责）
