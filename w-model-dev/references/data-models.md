# 数据模型（Data Models）

> 来源：SSoT 第 7 章。项目状态、需求、设计、测试用例的数据结构定义。
> 技能执行时按需读取，用于在项目存储中维护结构化记录。

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
