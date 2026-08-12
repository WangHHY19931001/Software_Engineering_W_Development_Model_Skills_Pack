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
- `scripts/logic/verifier-logic.ts`（EVIDENCE_PATTERN）
- `references/directory-conventions.md` §6（路径引用规则）

## 5. 注释与提示词目的规范（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 15 章：注释写 why 不写 what；提示词/注释能表达要求但不能表达要求的分量。

- **注释写 why 不写 what**：凡只翻译代码的注释视为废注释（代码本身已表达 what）。
- **目的注释**：记录"这段代码为什么存在 / 服务于什么目的"，给未来 agent 与人的判断依据。
- **提示词的边界**：提示词/注释能表达要求，但不能表达要求的分量——分量靠结构（门禁 / 校验 / 权限）承载。

### 接口注释必备清单（第 41 轮四源吸收，APoSD ch13.5）

> 吸收自《软件设计哲学》ch13：接口注释 = 抽象定义（接口非形式化部分只能靠注释承载）。

- **接口注释必备内容**：行为（做什么）/ 参数（含含义与约束）/ 返回 / 副作用 / 异常 / 前置条件。
- **接口注释与实现注释分离**：接口注释描述抽象契约，实现细节归实现注释；实现文档污染接口 = 坏注释（code-smells 组 C）。
- **先写注释（ch15）**：新类先写类接口注释 → 公有方法签名 + 接口注释 → 再填实现；"难以描述" = 抽象有问题的金丝雀，回到设计而非硬写。

### 坏注释黑名单（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch4：以下 6 类注释应删除或改写（对应 code-smells-checklist 组 C）。

| # | 坏注释类型 | 检测信号 | 处理 |
|---|---|---|---|
| 1 | 喃喃自语 | 无信息量、自我解释的废话注释 | 删除 |
| 2 | 冗余注释 | 复述代码本身（what） | 删除（重构让代码自解释） |
| 3 | 误导性注释 | 注释与代码现状不符/过期 | 删除或修正 |
| 4 | 日志式注释 | 逐条记录修改历史（应归版本控制） | 删除 |
| 5 | 注释掉的代码 | 被注释的代码块 | 删除（版本控制可恢复） |
| 6 | 循规式注释 | 为遵守格式而写的空泛 Javadoc/头注释 | 删除或补充实质内容 |

## 6. 命名约定（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch2。命名是代码可读性的第一来源；机械规则由语言静态工具 + 团队规范承载，本节为语义级约定。

- **名副其实**：名称直接表达意图（`elapsedTimeInDays` 而非 `d`）；若需注释解释名称含义，名称不合格。
- **有意义区分**：`a1/a2`、`data/data2`、`get/getInfo` 类无语义区分是废名。
- **可搜索**：名称长度随作用域增长；短名（`i`）只用于局部小循环；魔法数用命名常量（坏味道清单 G25）。
- **避免思维映射**：不用领域外隐喻（单字母/自造缩写让读者做心智翻译）。
- **一词一义**：同一概念统一用词（`fetch/get/retrieve` 不混用）；一词一义的反面（同词多义）也避免。
- **解决方案 vs 问题领域**：技术性名称（`Queue`/`Decorator`）用解决方案域词汇；业务语义用问题域词汇。
- **不加多余语境**：`GSD_` 类前缀、类名中重复的模块前缀是噪音。
- **类/对象命名**：名词短语；函数命名：动词/动词短语（`save`/`isActive`）；布尔函数用 `is/has/can` 前缀。
- **与坏味道清单的关系**：命名违规对应 [code-smells-checklist.md](code-smells-checklist.md) 组 N（N1-N7）与神秘命名味道。
- **命名一致性三要求**（APoSD ch14.4）：① 给定目的固定用名；② 该名不得他用（一词一义强化）；③ 目的足够窄（名称歧义 → 语义混杂）。
- **难取名警报**（APoSD ch14.3）：想不出精确直观的名字 → 该实体可能同时承担多个语义，回到设计拆分，而非硬凑名字。
- **坏名称直接造成缺陷**：名称是读者脑中"画面"的来源——孤立看到名称应能猜出指什么（block 逻辑/物理块号混用案例）。
