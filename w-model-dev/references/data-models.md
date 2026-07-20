# 数据模型（Data Models）

> 来源：SSoT 第 7 章。项目状态、需求、设计、测试用例的数据结构定义。
> 技能执行时按需读取，用于在项目存储中维护结构化记录。

## 目录

- 项目、需求、设计与测试用例模型
- 实体关系与持久化
- RTM 字段映射
- 状态迁移、JSON 恢复与并发写入

## 项目数据模型

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status: '需求分析' | '系统设计' | '概要设计' | '详细设计' | '编码' | '集成测试' | '系统测试' | '验收测试';
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    others: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## 需求数据模型

```typescript
interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: '功能需求' | '非功能需求' | '约束需求';
  priority: '高' | '中' | '低';
  acceptanceCriteria: string[];
  testCases: TestCase[];
  status: '待开发' | '开发中' | '已完成' | '已验证';
}
```

## 设计数据模型

```typescript
interface Design {
  id: string;
  projectId: string;
  type: '系统设计' | '概要设计' | '详细设计';
  content: string;
  diagrams: Diagram[];
  testCases: TestCase[];
  createdAt: Date;
}
```

## 测试用例数据模型

```typescript
interface TestCase {
  id: string;
  projectId: string;
  type: '验收测试' | '系统测试' | '集成测试' | '单元测试';
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: '待执行' | '通过' | '失败';
  priority: '高' | '中' | '低';
}
```

## 实体关系

```
PROJECT 1──* REQUIREMENT
PROJECT 1──* DESIGN
PROJECT 1──* TEST_CASE
REQUIREMENT 1──* TEST_CASE   (需求生成验收测试)
DESIGN 1──* TEST_CASE        (设计生成系统/集成/单元测试)
```

## 与 RTM 的映射

RTM 的每一列对应一个数据模型的 `id` 字段（见 [rtm-guide.md](rtm-guide.md)）：

| RTM 列 | 数据模型 | ID 格式 | 登记阶段 |
|---|---|---|---|
| 需求 ID | `Requirement` | `REQ-NNN` | 阶段 1 |
| 设计文档 | `Design` | `SD-N.N.N` | 阶段 2/3/4 |
| 代码模块 | —（文件路径） | `<filename>.ts` | 阶段 5 |
| 单元测试 | `TestCase` (type=单元测试) | `UT-NNN` | 阶段 4（设计）/ 阶段 5（执行） |
| 集成测试 | `TestCase` (type=集成测试) | `IT-NNN` | 阶段 3（设计）/ 阶段 6（执行） |
| 系统测试 | `TestCase` (type=系统测试) | `ST-NNN` | 阶段 2（设计）/ 阶段 7（执行） |
| 验收测试 | `TestCase` (type=验收测试) | `UAT-NNN` | 阶段 1（设计）/ 阶段 8（执行） |

## 使用约定

- `id` 使用 `REQ-<序号>` / `SD-<节号>` / `TC-<类型>-<序号>` 等可读编码。
- `status` 随阶段推进更新；阶段切换时同步 `Project.updatedAt`。
- 测试用例 `type` 与设计来源阶段一一对应（见 SKILL.md 阶段对应表）。
- 数据可持久化为 JSON 文件或 SQLite，本技能不强制存储介质。

## 数据迁移与异常处理（边界条件）

> 项目演进中常见的数据层边界场景：枚举变更 / techStack 增删 / JSON 损坏 / 并发写入。Agent 须按以下策略处理，**禁止直接丢弃历史数据**。

### 1. status 枚举变更迁移

当 `Project.status` / `Requirement.status` / `TestCase.status` 枚举集合扩展或重命名时：

| 场景 | 迁移策略 | 校验 |
|---|---|---|
| 枚举值新增（如 `Project.status` 增加「灰度发布」） | 旧数据无需改动；新值仅在用户显式选择后写入 | 读取旧记录时新枚举值不存在 → 视为旧值集合内的值 |
| 枚举值重命名（如 `待开发` → `待实现`） | 一次性脚本扫描 JSON 中所有 `status` 字段做字符串替换；替换前后保留 `.bak` 备份 | 替换后必须通过 `check-artifact-gate.ts` 校验，退出码 0 |
| 枚举值废弃（如 `已废弃` 移除） | 已废弃状态记录须先迁移到「已归档」或「待开发」等保留值，再删除枚举项 | 不得保留无对应枚举的 status 值；退出码 0 才算迁移完成 |

迁移步骤：备份 `cp .w-model/rtm.json .w-model/rtm.json.bak.<ts>` → 执行迁移逐条更新 status → 跑 `check-artifact-gate.ts [project-dir]` 退出码 0 才算成功；失败则回滚 `.bak.<ts>`。

### 2. techStack 增删迁移

`Project.techStack` 字段增删技术栈时：

| 场景 | 迁移策略 | 风险 |
|---|---|---|
| 新增技术栈（如 `frontend` 加入 `Vue 3`） | 直接 append 到数组；不触发回滚 | 无 |
| 删除技术栈（如 `backend` 移除 `Express`） | 须先核验代码模块列无引用该栈的文件；若有引用须先回编码迁移代码 | 删除后代码仍引用 → `check-artifact-gate.ts` 退出码 1 |
| 重命名技术栈 | 须同步更新 `techStack` 数组与所有引用文档；保留 `.bak` 备份 | 文档与 `rtm.json` 不一致 → 退出码 1 |

### 3. JSON 文件损坏恢复

`rtm.json` / 其他 JSON 产物损坏（解析失败 / 字段缺失）时：

1. **检测**：`JSON.parse` 抛异常或 `check-artifact-gate.ts` 退出码 2 → 判定损坏。
2. **定位备份**：按时间倒序查找 `.w-model/*.json.bak.*`，取最近一个能 `JSON.parse` 成功的备份。
3. **恢复**：`cp .w-model/rtm.json.bak.<timestamp> .w-model/rtm.json`，重跑 `check-artifact-gate.ts`。
4. **无备份兜底**：若无可用备份，从 `templates/rtm.md` 重建空 RTM，按阶段产物（需求规格 / 设计文档 / 代码文件 / 测试报告）反向回填，回填后跑校验脚本。
5. **告知用户**：明示损坏范围与恢复策略，由用户确认恢复结果。

### 4. 并发写入冲突处理

多 Agent / 多会话同时写 `rtm.json` 时：

| 冲突类型 | 检测信号 | 处理 |
|---|---|---|
| 文件 mtime 与读取时不一致 | 读取后写回前先 `stat` 比较 mtime；不一致即冲突 | 拒绝覆盖；重新读取最新版本合并后再写 |
| 同一字段被多次修改 | 写入前对比读取时的 `updatedAt` 与当前 `updatedAt` | 后写者基于最新版本重做修改；冲突字段需用户裁决 |
| 测试状态被并发翻转 | `TestCase.status` 在两次读取间从「通过」翻转为「失败」 | 以「失败」为优先（保守原则），回阶段 5 返工 |

并发写入约定：写入前必须 `stat` 校验 mtime，不一致即重读合并；同一字段冲突时测试状态取「失败」优先（保守），其他字段取「最新 mtime」优先；同一记录 ≥3 次并发修改须暂停并向用户报告。

> 并发写入冲突处理不改变数据模型 schema，仅约定写入时的并发控制策略。
