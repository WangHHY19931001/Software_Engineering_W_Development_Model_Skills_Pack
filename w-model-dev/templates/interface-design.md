# 接口设计文档

> **模板版本**：v2.0（第 38 轮设计级别增强：§0 SSOT 头 + 6 独立产物文件引用块）
> 套用本模板时，引用块指向同目录独立文件，独立文件套用
> `templates/interface-design/` 下对应子模板。产出物见
> `references/phase-3-outline-design.md` §执行方法论。

## 文档信息

- 项目名称：{{项目名称}}
- 文档版本：{{v1.0}}
- 编制日期：{{YYYY-MM-DD}}
- 关联系统设计文档：{{system-design 路径}}

## 0. 文档定位与 SSOT 头

> **文档版本**：{{v1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本接口设计文档为阶段 3（概要设计）的唯一设计事实来源。设计变更须经
>   阶段门评审 / 上游系统设计变更回流，不得无痕修改。
> **自身校验**：本文档以结构完整性为准——引用块指向的独立文件存在、
>   {{module}}-interface-contract.md 接口契约与 §2 接口定义一一对应、
>   {{module}}-traceability-matrix.md 字段与 §2 接口定义一致、
>   {{module}}-uml-modeling.md mermaid 块配平。
> **禁止占位词**：TBD/TODO/undefined/待补建/待定 不得进入正式交付；`待定` 仅允许出现在 §8 非目标显式标注中。
> **与系统设计关系**：本文档承接阶段 2《系统设计文档》（模块划分/子系统清单），模块接口契约由本文档承载；
>   类/方法级设计事实由阶段 4 产出的详细设计文档承载，不在本文档描述。
> **行为规格承接**：L3 行为规格由独立 `.feature` 文件承载（bdd-guide.md §2 头规范管），
>   本文档 §6 引用块指向的 behavior-spec.md 定义引用关系，不内联 feature 块。

## 1. 模块调用关系

```mermaid
graph LR
    {{模块调用关系}}
```

> 每个模块间调用须标注接口名 + 数据流向；存在循环依赖时必须重新划分模块边界（FM-OD-03）。

## 2. 接口定义

### 2.1 {{InterfaceName}}

- 提供方模块：{{M-001}}
- 消费方模块：{{M-002}}
- 协议：{{HTTP / gRPC / 函数调用}}

#### 接口 1：{{接口名 / 路径}}

- 方法：{{GET/POST/函数签名}}
- 描述：{{接口描述}}

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 校验规则 | 说明 |
|---|---|---|---|---|---|
| {{param}} | body/query | {{string}} | 是 | {{}} | {{}} |

**返回值**

| 字段 | 类型 | 说明 |
|---|---|---|
| {{code}} | {{number}} | {{状态码}} |
| {{data}} | {{object}} | {{业务数据}} |

**错误码**

| 错误码 | 含义 | 触发条件 |
|---|---|---|
| 400 | 参数错误 | {{}} |
| 200 | 成功 | {{}} |

**示例**

```json
// 请求
{{request example}}
// 响应
{{response example}}
```

> 接口契约细节（含错误码分层 4xx/5xx/业务三段位 + 接口契约 Schema 10 字段）详见
> [{{module}}-interface-contract.md](./{{module}}-interface-contract.md)。

## 3. 集成测试用例索引

> 详细用例见对应测试用例文档。

| 用例 ID | 关联接口 | 场景 | 优先级 |
|---|---|---|---|
| IT-001 | {{InterfaceName}} | {{合法调用}} | 高 |
| IT-002 | {{InterfaceName}} | {{非法参数}} | 高 |

## 4. 核心概念与术语

> 术语表详见 [{{module}}-glossary.md](./{{module}}-glossary.md)
> （接口域术语子集，引用 references/glossary.md 权威表）。

## 5. 概要设计追踪矩阵

> 追踪矩阵详见 [{{module}}-traceability-matrix.md](./{{module}}-traceability-matrix.md)
> （INTF×SD 8 字段表 + 测试层级承接矩阵，仅集成/验收列填实）。

## 6. 行为规格模型（L3）

> 行为规格模型详见 [{{module}}-behavior-spec.md](./{{module}}-behavior-spec.md)
> （引用 L3 .feature 文件关系，不内联 feature 块）。

## 7. Phase 3 工程纪律与 DoD

> Phase 3 工程纪律与 DoD 详见 [{{module}}-discipline-dod.md](./{{module}}-discipline-dod.md)
> （§1 阶段纪律 + §2 DoD 可勾选清单）。

## 8. 设计边界与非目标

- {{非目标 1}}（例：本设计不覆盖类/方法级实现细节，详细设计由阶段 4 承载）
- {{非目标 2}}
- …

## 附录 A. UML 模块级建模

> UML 模块级建模详见 [{{module}}-uml-modeling.md](./{{module}}-uml-modeling.md)
> （包图 / 序列图 / 通信图，mermaid）。

## 路由注册顺序约束

> 对应 Round 24 P2 问题 5。路由注册顺序错误会导致参数路径拦截静态路径、鉴权失效等问题。

### 注册顺序规则

1. **静态路径先于参数路径**：`/users/me` 须先于 `/users/:id` 注册，否则 `/users/me` 会被 `/users/:id` 拦截（`id="me"`）
2. **鉴权路由先于公开路由**：须鉴权的路由须先注册鉴权中间件，再注册公开路由
3. **具体路径先于通配路径**：`/api/v1/users` 须先于 `/api/*` 注册

### 路由注册顺序表模板

| 注册顺序 | HTTP 方法 | 路径 | 鉴权 | 中间件 | 说明 |
|---|---|---|---|---|---|
| 1 | GET | /health | 否 | - | 健康检查（公开） |
| 2 | POST | /auth/login | 否 | rateLimit | 登录（限流） |
| 3 | GET | /users/me | 是 | auth, rateLimit | 当前用户信息（须鉴权） |
| 4 | GET | /users/:id | 是 | auth | 用户详情（参数路径，须在 /me 之后） |
| 5 | GET | /api/* | 是 | auth | API 通配（须在具体路径之后） |

### 校验

路由注册顺序由 V 评审与 G 门禁人工校验（无自动脚本）。违反命中反模式 #36。
