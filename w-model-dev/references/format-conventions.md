# 格式约定（Format Conventions）

> 本文件是所有 W 模型元数据字段格式的唯一事实来源（SSoT）。verifier-spec、模板、门禁脚本均须引用本文件，不得自定义格式。
> 日期：2026-08-07
> 状态：生效中

## 1. 路径定位分隔符

统一使用**冒号** `:` 分隔文件路径与定位信息：

```
path:§section       （章节定位）
path:L42-58         （行号定位）
path:§3.2,L42       （章节+行号混合）
```

### 禁止格式

| 格式 | 说明 | 旧用法位置 |
|------|------|------------|
| `path#§section` | 井号分隔 | tla-spec-template.md（已废弃） |
| `path.field=value` | 点号分隔 | verifier-spec.md §6.2（已废弃） |
| 纯文件名无定位 | 无定位信息 | — |

## 2. 各字段格式规范

### 2.1 VerifierOutput evidence

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

## 3. evidence 正则

`verifier-logic.ts` 的 EVIDENCE_PATTERN 须匹配以下两种格式：

```
/^[\w/.-]+:§[\w.-]+=.+$/       （章节定位）
/^[\w/.-]+:L\d+(?:-\d+)?=.+$/  （行号定位）
```

## 4. 引用关系

本文件被以下文件引用：
- `references/verifier-spec.md` §6.2（evidence 格式）
- `templates/tla-spec-template.md`（@design 格式）
- `templates/feature.template`（@design 格式）
- `scripts/verifier-logic.ts`（EVIDENCE_PATTERN）
- `references/directory-conventions.md` §6（路径引用规则）

## 5. 注释与提示词目的规范（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 15 章：注释写 why 不写 what；提示词/注释能表达要求但不能表达要求的分量。

- **注释写 why 不写 what**：凡只翻译代码的注释视为废注释（代码本身已表达 what）。
- **目的注释**：记录"这段代码为什么存在 / 服务于什么目的"，给未来 agent 与人的判断依据。
- **提示词的边界**：提示词/注释能表达要求，但不能表达要求的分量——分量靠结构（门禁 / 校验 / 权限）承载。
