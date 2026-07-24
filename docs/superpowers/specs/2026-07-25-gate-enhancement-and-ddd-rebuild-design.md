# 门禁增强与 DDD 重构设计（Gate Enhancement & DDD Rebuild Design）

| 项 | 内容 |
|---|---|
| 日期 | 2026-07-25 |
| 状态 | Draft → 待用户审查 |
| 实现状态评估（2026-07-25） | P1.3/P2.8 已实现；P1.1/P1.2/P1.4/P2.5/P2.6/P2.7 未实现 |
| 起源 | 第6轮 W 模型端到端调测完成后识别的 8 个技能问题 |
| 关联 | docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md（上一轮修复） |
| 影响范围 | w-model-dev/scripts/、w-model-dev/references/、w-model-dev-demo/（从零重写）、顶层文档（SSoT/AGENTS.md/README.md/CHANGELOG.md） |
| 实施策略 | 三部分顺序：Part A 门禁增强 → Part B demo 重构 → Part C 文档更新 |

---

## 1. 背景与问题陈述

第6轮 W 模型 8 阶段端到端调测完成（354/354 测试通过、RTM 100%、13 TLA+ 规格全绿），过程中暴露 8 个技能层面问题，分两类：

### P1（影响门禁正确性，4 项）

| ID | 问题 | 暴露点 | 根因 |
|---|---|---|---|
| P1.1 | TLA+ manifest 路径基准未强制 | wm6-r022：jarPath 写成 `w-model-dev/tools/tla2tools.jar` 失败 | manifest schema 无 `basePath` 字段，路径按 cwd 解析导致跨项目试错 |
| P1.2 | TLA+ SD 覆盖率校验未强制 | wm6-r022：L2/L3 规格 `requirementIds` 缺 SD-xxx 标识 | check-tla-model.ts 未校验"每个 spec 须有 SD 覆盖"与"每个 SD 须被覆盖" |
| P1.3 | Verifier passed↔qualityLevel 不一致 | wm6-r015：compositeScore=0.824 (B级) 但 passed=false | verifier-spec §6 规定 `passed = (qualityLevel === 'A' \|\| 'B')`，但 check-verifier-output.ts 只读取 `result.passed`，不校验一致性 |
| P1.4 | RTM codeModule 回填时机未明确 | wm6-r046：维度1 SD→codeModule 映射失败 | SKILL.md 阶段5未明确"编码后必须回填 codeModule"，导致一致性检查失败 |

### P2（改进体验，4 项）

| ID | 问题 | 暴露点 | 根因 |
|---|---|---|---|
| P2.5 | UAT 设计路径与实际 API 路径映射规则缺失 | 阶段8：设计 POST /api/users/register vs 实际 POST /api/auth/register | phase-8-acceptance-test.md 未说明路径映射处理方式 |
| P2.6 | TLA+ 不变式业务语义校验缺失 | wm6-r014：CategoryTreeNoCycle 2-循环 / AdPlacementOnActive 插槽语义 | V 评审只检查语法/模型检查通过，未校验不变式是否真实反映设计文档业务约束 |
| P2.7 | phase-8 三段暂停点语义在自驱模式下模糊 | 阶段8：self-as-verifier 模式如何处理 B 段（每30%暂停）未明确 | phase-8-acceptance-test.md 未区分"自驱模式 vs 交互模式" |
| P2.8 | TLA+ Next 分支命名映射规则缺失 | 阶段5：AnnouncementScheduler 的 PublishAnnouncement ↔ publishAnnouncement | code-tla-logic.ts 维度3 未规范 PascalCase↔camelCase 映射 |

---

## 2. 设计决策汇总

| 决策点 | 选择 | 理由 |
|---|---|---|
| 范围 | P1+P2 全部 8 个 | 一次到位 |
| 兼容性 | 严格向后兼容（更新 demo 满足新门禁） | 不降低新门禁严格度 |
| 执行策略 | 三部分顺序：门禁增强 → demo 重构 → 文档更新 | 每部分检查点验证 |
| 回归保障 | fixture 化集成测试 | 保护门禁脚本本身 |
| demo 力度 | 从零重写（需求保留，架构重新设计） | 参考实现模板化 |
| 技术栈 | Express + TypeScript 5 (strict) + DDD 四层分层 | 领域纯净 + 依赖倒置 |
| 架构方案 | 方案 A（集中式修正，不新增独立脚本） | YAGNI，与现有风格一致 |
| basePath | **强制必填**（非可选） | 用户明确要求 |
| SD 覆盖率 | **全规格强制，无例外**（L1 也要求） | 用户明确要求 |
| passed↔qualityLevel | **严格一致，无例外** | 用户明确要求 |

---

## 3. §1 整体架构与工作分解

### 3.1 整体架构（方案 A：集中式修正）

```
w-model-dev/
├── scripts/                          ← 门禁脚本增强
│   ├── check-tla-model.ts            ← P1.1 basePath + P1.2 SD 覆盖率
│   ├── check-verifier-output.ts       ← P1.3 passed↔qualityLevel
│   ├── check-code-tla-consistency.ts ← P1.4 codeModule 时机 + P2.8 Next 命名
│   ├── check-artifact-gate.ts         ← 调用上述新校验
│   ├── tla-logic.ts                  ← basePath 解析 + SD 覆盖率
│   ├── verifier-logic.ts             ← passed↔qualityLevel 校验
│   ├── code-tla-logic.ts             ← Next 分支命名映射
│   └── tests/                         ← 新增 fixture 化回归测试
│       ├── fixtures/
│       │   ├── minimal-graph.json
│       │   ├── minimal-rtm.json
│       │   ├── minimal-manifest.json
│       │   ├── minimal-verifier.json
│       │   └── minimal-tla/
│       ├── check-tla-model.test.ts
│       ├── check-verifier-output.test.ts
│       └── check-code-tla-consistency.test.ts
├── references/                        ← 文档约束增强
│   ├── tla-plus-guide.md             ← §2.2 basePath + §2.4 Next 命名 + §4 不变式语义
│   ├── verifier-spec.md               ← §6 passed↔qualityLevel 硬约束 + §8 不变式业务语义
│   ├── phase-8-acceptance-test.md     ← UAT 路径映射表 + 三段语义
│   └── phase-5-coding.md             ← codeModule 回填时机
└── w-model-dev-demo/                  ← 从零重写（Part B）
    ├── src/                           ← DDD 四层分层
    ├── tests/
    ├── docs/
    └── .w-model/                      ← manifest 含 basePath
```

### 3.2 三部分顺序执行

| Part | 内容 | 验证标准 |
|---|---|---|
| A | 门禁脚本与文档增强（8 个问题修正） | fixture 测试全通过 |
| B | demo 从零重写（参考实现模板化） | 354+ 测试全通过 + 所有新门禁 exit 0 |
| C | 顶层文档更新（SSoT/AGENTS.md/README.md/CHANGELOG.md） | 文档审查无遗漏 |

### 3.3 关键设计原则

- **向后兼容**：新门禁字段（basePath）强制必填，旧 manifest 须补齐才能通过门禁；demo 主动填入作为模板
- **fixture 最小集**：5 节点 graph + 1 L1 + 1 L2 spec + 3 REQ RTM，mock demo 子集
- **DDD 分层**：domain（实体/值对象）→ application（用例/端口）→ infrastructure（适配器）→ interfaces（路由/控制器）

---

## 4. §2 Part A 门禁脚本与文档增强

### 4.1 P1 修正（收紧版）

#### P1.1 TLA+ manifest basePath 强制

**修改文件**：`tla-logic.ts`、`check-tla-model.ts`、`tla-plus-guide.md §2.1`

**manifest schema 变更**：
```json
{
  "basePath": ".",              // 必填，相对 manifest 文件所在目录
  "tools": {
    "jarPath": "tools/tla2tools.jar"   // 相对 basePath 解析
  },
  "specs": [
    {
      "tlaPath": "tla/L1_system.tla",  // 相对 basePath 解析
      "cfgPath": "tla/L1_system.cfg"
    }
  ]
}
```

**校验逻辑**（`tla-logic.ts`）：
- 读取 `manifest.basePath`，缺失 → violation "manifest.basePath 缺失（强制字段）"
- jarPath/tlaPath/cfgPath 全部 `path.resolve(manifestDir, basePath, relativePath)` 解析
- 解析后文件不存在 → violation "路径解析失败：<resolvedPath>"

**guide 更新**（`tla-plus-guide.md §2.1`）：
- basePath 标注为**强制必填字段**
- 删除"相对 cwd"的旧解析基准
- 增加示例：demo 项目布局下 basePath="." 的填写

#### P1.2 TLA+ SD 覆盖率全规格强制（无例外）

**修改文件**：`check-tla-model.ts`、`tla-plus-guide.md §3`

**校验逻辑**（`check-tla-model.ts` 新增第 11 项校验）：
- 读取 `--graph=<graph.json>` 提取所有 type=SD 节点 ID 集合 `allSdIds`
- 对 manifest 中**所有 spec**（L1/L2/L3/L4 无例外）：
  - 读取 `spec.requirementIds`
  - 缺失或为空 → violation "spec `<id>` 缺 requirementIds（SD 覆盖强制）"
  - requirementIds 中无 SD-xxx → violation "spec `<id>` requirementIds 无 SD 标识"
- 对每个 `sdId ∈ allSdIds`：
  - 检查是否被至少一个 spec 的 requirementIds 包含
  - 未被覆盖 → violation "SD `<sdId>` 无 spec 覆盖"
- 任一 violation → 退出码 1

**guide 更新**（`tla-plus-guide.md §3`）：
- 增加"SD 覆盖率校验"章节
- 明确"全规格强制，无例外"（L1 也要求）
- L1 须标注其对应的顶层 SD（如 SD-000 系统根）

#### P1.3 Verifier passed↔qualityLevel 严格一致（无例外）

**修改文件**：`verifier-logic.ts`、`check-verifier-output.ts`、`verifier-spec.md §6`

**校验逻辑**（`verifier-logic.ts` 新增校验）：
- 重算 `expectedPassed = (qualityLevel === 'A' || qualityLevel === 'B')`
- 若 `result.passed !== expectedPassed` → violation "passed 与 qualityLevel 不一致：passed=<actual>, 期望=<expected>"
- **无例外**：禁止通过 summary 或任何字段降级
- 不一致 → 退出码 1

**spec 更新**（`verifier-spec.md §6`）：
- 第 315 行条款标注为**硬约束**
- 增加"无例外条款"：P0 未解决时 qualityLevel 须实际降为 C/D，不得保持 B 级同时 passed=false

#### P1.4 RTM codeModule 回填时机校验

**修改文件**：`check-code-tla-consistency.ts`、`phase-5-coding.md`、`SKILL.md`

**校验逻辑**（`check-code-tla-consistency.ts` 维度1错误信息优化）：
- REQ 缺 codeModule → violation "REQ-<id> 缺 codeModule 列（阶段5编码后必须回填）"
- 错误信息明确指出回填时机

**文档更新**：
- `phase-5-coding.md` §"RTM 登记"增加强制条款：
  > **编码完成后、code-TLA 一致性检查前，必须回填 RTM.codeModule 列**
- `SKILL.md` 阶段5门禁清单增加"codeModule 回填检查"项

### 4.2 P2 修正

#### P2.5 UAT 路径映射表

**修改文件**：`phase-8-acceptance-test.md`、`phase-1-requirement-analysis.md`

**新增产物**：`docs/uat-path-mapping.md`

**表格结构**：
| UAT ID | 设计路径（阶段1） | 实际路径（阶段5回填） | 映射类型 | 说明 |
|---|---|---|---|---|
| UAT-009 | POST /api/users/register | POST /api/auth/register | 等价 | 路由分组调整 |

**映射类型**：`直接`（路径完全一致）/ `等价`（路径不同但语义等价）/ `替代`（因技术约束替代）

**流程**：
- 阶段1设计 UAT 时产出初始表（设计路径列）
- 阶段5编码后回填实际路径列 + 映射类型
- 阶段8验收测试编写时按此表映射

#### P2.6 TLA+ 不变式业务语义校验

**修改文件**：`verifier-spec.md`、`tla-plus-guide.md §4`

**verifier-spec 更新**（V 评审 subCriteria 新增第 8 项）：
- 名称：**不变式业务语义对齐**
- 校验：TLA+ 每个不变式是否真实反映设计文档的业务约束
- 评审者须为每个不变式提供"设计文档引用 + 业务语义解释"
- 评分权重：纳入 compositeScore 计算

**tla-plus-guide.md §4 增加**：
- 不变式业务语义对齐要求
- 每个 `Invariant` 须有对应的设计文档章节引用
- 示例：`CategoryTreeNoCycle` ↔ design.md §X.X 分类树无环约束

#### P2.7 phase-8 三段语义明确

**修改文件**：`phase-8-acceptance-test.md`

**新增章节**：§自驱模式 vs 交互模式

| 段 | 交互模式 | 自驱模式（self-as-verifier） |
|---|---|---|
| A 段（用例执行） | 每用例后暂停 | 连续执行不暂停 |
| B 段（每 30% 暂停） | 每 30% 暂停 | 合并为单次中点检查（50% 时） |
| C 段（最终用户确认） | 强制暂停 | 强制暂停（不变） |

#### P2.8 TLA+ Next 分支命名约定

**修改文件**：`tla-plus-guide.md §2.4`、`code-tla-logic.ts`

**命名约定**：
- TLA+ Action 名：PascalCase（如 `PublishAnnouncement`）
- 代码方法名：camelCase（如 `publishAnnouncement`）
- 映射规则：首字母大写 → 首字母小写

**校验逻辑**（`code-tla-logic.ts` 维度3增强）：
- TLA+ Action `PublishAnnouncement` → 期望代码方法 `publishAnnouncement`（首字母小写）
- 自动转换：`actionName[0].toLowerCase() + actionName.slice(1)`
- 匹配成功 → 通过
- 匹配失败 → violation "Next 分支 `<action>` 无对应代码方法（期望 `<expected>`）"

---

## 5. §3 Part B demo 从零重写

### 5.1 需求保留

21 条需求（13 REQ + 5 NFR + 3 CON）不变，设计文档基本保留（仅按新门禁补齐字段）。

### 5.2 技术栈

- Express 4 + TypeScript 5 (strict) + 内存存储(Map) + vitest
- 新增 DDD 四层分层

### 5.3 DDD 分层架构

```
src/
├── domain/                       ← 领域层（纯业务规则，无框架依赖）
│   ├── entities/                 ← 实体（article/user/blogger/comment/...）
│   ├── value-objects/            ← 值对象（article-status/email/password/...）
│   ├── events/                   ← 领域事件
│   └── services/                 ← 领域服务（跨实体规则）
│
├── application/                   ← 应用层（用例编排，无框架依赖）
│   ├── use-cases/                ← 用例（按需求域分组）
│   │   ├── identity/
│   │   ├── content/
│   │   ├── interaction/
│   │   └── operation/
│   ├── ports/                    ← 端口接口（依赖倒置）
│   │   ├── repositories/         ← Repository 端口
│   │   ├── services/             ← 服务端口（wal/hash/jwt）
│   │   └── event-bus.port.ts
│   └── dto/                      ← 输入输出 DTO
│
├── infrastructure/                ← 基础设施层（技术实现）
│   ├── persistence/
│   │   ├── stores/               ← 内存存储实现
│   │   └── repositories/         ← Repository 适配器（实现端口）
│   ├── messaging/
│   │   ├── in-memory-event-bus.adapter.ts
│   │   └── wal-writer.adapter.ts
│   ├── security/
│   │   ├── bcrypt-hash.adapter.ts
│   │   └── jsonwebtoken-jwt.adapter.ts
│   └── config/
│
├── interfaces/                    ← 接口层（HTTP 路由/控制器）
│   ├── http/
│   │   ├── routes/               ← 路由（与 interface-design.md 严格一致）
│   │   ├── controllers/
│   │   └── middleware/           ← auth/rbac/error-handler/rate-limiter/validate
│   └── dto/
│
├── app.ts                         ← Express 应用装配
├── container.ts                   ← 依赖注入容器
└── server.ts                      ← 启动入口
```

### 5.4 关键设计原则

- **依赖倒置**：application 层定义端口（interface），infrastructure 层实现适配器
- **领域纯净**：domain 层不依赖 Express/数据库/任何框架
- **单向依赖**：interfaces → application → domain ← infrastructure
- **状态机内聚**：文章 6 状态机定义在 `domain/value-objects/article-status.vo.ts`

### 5.5 与设计文档对齐策略

- 路由命名与 interface-design.md 严格一致（如 POST /api/auth/register）
- 服务命名与 SD-xxx 节点对应
- TLA+ Next 分支与 usecase 方法名 PascalCase↔camelCase 映射
- manifest 含 basePath 字段（模板示例）

### 5.6 W 模型调测验证

demo 重写后须跑完整 W 模型 8 阶段调测：
- 阶段1-4：需求/设计/TLA+ 全部通过新门禁
- 阶段5：编码 + codeModule 回填 + code-TLA 一致性
- 阶段6-8：集成/系统/验收测试全通过
- 最终：354+ 测试 + 所有新门禁 exit 0

---

## 6. §4 Part C 顶层文档更新 + fixture 化回归测试

### 6.1 顶层文档更新

#### SSoT (docs/skill-design-document_SSoT.md)
- §3.4 增加 TLA+ manifest basePath 强制条款
- §3.4 增加 SD 覆盖率全规格强制条款（无例外）
- §3.5 增加 Verifier passed↔qualityLevel 严格一致硬约束（无例外）
- §3.6 增加 codeModule 回填时机约束（阶段5强制）
- §5 增加 DDD 分层架构规范（作为推荐架构）
- §6 增加 UAT 路径映射表、不变式业务语义对齐、phase-8 三段语义、Next 分支命名约定

#### AGENTS.md
- §4 增加第7轮调测结论（demo 从零重写 + 新门禁增强）
- §2 增加"门禁脚本测试"章节说明 fixture 化回归

#### README.md
- "快速开始"章节增加新门禁字段说明（basePath 等）
- "门禁脚本"章节增加新校验项说明
- 增加"参考实现"指向 w-model-dev-demo

#### CHANGELOG.md
- 新增版本条目（日期版本 2026-07-25）
- 分类：Added（8 项新校验）/ Changed（demo 重构）/ Fixed（门禁漏洞）/ Docs（文档更新）

### 6.2 Fixture 化回归测试

**位置**：`w-model-dev/scripts/tests/`

#### Fixture 设计（最小可复现集）

```
scripts/tests/
├── fixtures/
│   ├── minimal-graph.json        ← 5 节点：REQ-000 根 + SD-001 + SD-002 + EXT-IN + EXT-OUT
│   ├── minimal-rtm.json          ← 3 REQ：含 codeModule/designDoc/unitTest 完整映射
│   ├── minimal-manifest.json     ← 1 L1 + 1 L2 spec，含 basePath 字段
│   ├── minimal-verifier.json     ← 1 评审输出：A 级 passed=true + B 级 passed=true
│   └── minimal-tla/
│       ├── L1_system.tla         ← 最小 L1 spec（含 SD 覆盖）
│       └── L1_system.cfg
└── *.test.ts                     ← 测试文件
```

#### 测试文件（3 个，对应 3 个增强脚本）

1. **`check-tla-model.test.ts`**
   - ✓ 合规 manifest（basePath 存在 + SD 覆盖完整）→ 退出码 0
   - ✗ 缺 basePath → 退出码 1
   - ✗ spec 缺 requirementIds → 退出码 1
   - ✗ SD-002 无 spec 覆盖 → 退出码 1

2. **`check-verifier-output.test.ts`**
   - ✓ A 级 passed=true → 退出码 0
   - ✓ B 级 passed=true → 退出码 0
   - ✗ B 级 passed=false → 退出码 1（不一致）
   - ✗ A 级 passed=false → 退出码 1（不一致）

3. **`check-code-tla-consistency.test.ts`**
   - ✓ RTM codeModule 完整 → 退出码 0
   - ✗ REQ 缺 codeModule → 退出码 1
   - ✓ Next 分支 PascalCase↔camelCase 映射通过 → 退出码 0
   - ✗ Next 分支无法映射 → 退出码 1

#### 运行方式

`npx vitest run scripts/tests/`

#### 关键设计

- fixture 是静态 JSON 文件，不依赖 demo 项目
- 每个测试用例 spawn 子进程执行脚本，校验退出码和 stdout JSON
- 覆盖正常路径 + 每个新增校验的失败路径
- 与 demo 的端到端测试互补（fixture 测门禁脚本本身，demo 测完整流程）

---

## 7. 验收标准

### 7.1 Part A 验收

- [ ] `check-tla-model.ts` basePath 强制校验生效（缺 basePath → exit 1）
- [ ] `check-tla-model.ts` SD 覆盖率全规格强制（缺 SD 覆盖 → exit 1）
- [ ] `check-verifier-output.ts` passed↔qualityLevel 一致性校验生效（不一致 → exit 1）
- [ ] `check-code-tla-consistency.ts` codeModule 时机错误信息明确
- [ ] `check-code-tla-consistency.ts` Next 分支命名映射生效
- [ ] `tla-plus-guide.md` §2.1/§2.4/§3/§4 更新
- [ ] `verifier-spec.md` §6/§8 更新
- [ ] `phase-8-acceptance-test.md` UAT 路径映射表 + 三段语义
- [ ] `phase-5-coding.md` codeModule 回填时机
- [ ] fixture 测试全通过（`npx vitest run scripts/tests/`）

### 7.2 Part B 验收

- [ ] demo DDD 四层分层完整（domain/application/infrastructure/interfaces）
- [ ] demo manifest 含 basePath 字段
- [ ] demo 所有 spec 含 requirementIds（SD 覆盖）
- [ ] demo 路由与 interface-design.md 严格一致
- [ ] demo W 模型 8 阶段调测全通过
- [ ] demo 354+ 测试全通过
- [ ] demo 所有新门禁 exit 0

### 7.3 Part C 验收

- [ ] SSoT 新增 6 项约束条款
- [ ] AGENTS.md §4 第7轮调测结论
- [ ] README.md 新门禁说明 + 参考实现指向
- [ ] CHANGELOG.md 版本条目（Added/Changed/Fixed/Docs 分类）

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| basePath 强制导致历史项目门禁失败 | 已归档第6轮项目须更新 manifest | Part B demo 重构时同步更新，作为模板示例 |
| DDD 分层增加 demo 复杂度 | 测试数量可能下降 | 保持需求不变，重构仅架构层面，测试逻辑等价迁移 |
| fixture 测试维护成本 | 新增校验须同步 fixture | 每个新校验对应一个 fixture 测试用例，强约束 |
| passed↔qualityLevel 无例外可能误判 | P0 未解决时无法降级 | P0 未解决时 qualityLevel 须实际降为 C/D，而非保持 B 级 |
| SD 覆盖率全规格无例外 | L1 须标注 SD-000 | guide 增加 L1 标注示例 |

---

## 9. 实施顺序

```
Part A：门禁脚本与文档增强
  ├─ A.1 修改 tla-logic.ts + check-tla-model.ts（P1.1+1.2）
  ├─ A.2 修改 verifier-logic.ts + check-verifier-output.ts（P1.3）
  ├─ A.3 修改 code-tla-logic.ts + check-code-tla-consistency.ts（P1.4+P2.8）
  ├─ A.4 更新 references/*.md（P2.5+2.6+2.7）
  ├─ A.5 新增 scripts/tests/ fixture 化测试
  └─ A.6 验证：fixture 测试全通过
      ↓ 检查点
Part B：demo 从零重写
  ├─ B.1 设计 DDD 分层架构与路由
  ├─ B.2 实现 domain + application + infrastructure + interfaces
  ├─ B.3 编写测试（单元+集成+系统+验收）
  ├─ B.4 跑 W 模型 8 阶段调测
  └─ B.5 验证：354+ 测试 + 所有新门禁 exit 0
      ↓ 检查点
Part C：顶层文档更新
  ├─ C.1 更新 SSoT
  ├─ C.2 更新 AGENTS.md
  ├─ C.3 更新 README.md
  ├─ C.4 更新 CHANGELOG.md
  └─ C.5 验证：文档审查无遗漏
```

---

## 10. 不在本次范围

- 不修改 W 模型 8 阶段流程本身（阶段定义不变）
- 不引入新依赖（ajv/json-schema 等不引入）
- 不重构 TLA+ 工具链（tla2tools.jar 版本不变）
- 不修改第6轮已归档项目的产物（仅作为历史记录保留）
- 不处理与本设计无关的其他技能问题

---

## 11. 后续工作

本设计完成后，按 brainstorming 流程进入 writing-plans 技能创建详细实现计划，然后执行。
