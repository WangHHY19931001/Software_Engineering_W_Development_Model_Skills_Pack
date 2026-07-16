# W开发模型AI辅助技能设计文档（指针）

> **本文件已废弃独立维护。** W-Model AI Assistant Skill 的设计文档统一以
> [`skill-design-document_SSoT.md`](./skill-design-document_SSoT.md) 为单一事实来源（SSoT）。
>
> 本文件仅保留为历史入口与导航，避免链接断裂。所有内容请到 SSoT 查阅。

## 为什么需要 SSoT？

在 issue #5 的代码审查中指出了一个问题：`skill-design-document.md` 与 `skill-design-document_SSoT.md`
内容大量重复，且两份文档不同步，容易产生"哪份才是最新的"的歧义。

为消除重复、保证一致性，现统一约定：

| 用途 | 文件 |
|---|---|
| 设计决策 / 数据模型 / RTM 结构 / 验收标准 / 工作流 | [skill-design-document_SSoT.md](./skill-design-document_SSoT.md) |
| Skill 定义（AI 助理触发命令、阶段流） | [w-model-dev/SKILL.md](../w-model-dev/SKILL.md) |
| LLM Verifier 集成设计 | [llm-verifier-integration-design.md](./llm-verifier-integration-design.md) |
| 实现入口（TypeScript） | [src/index.ts](../src/index.ts) |

## 如何贡献设计变更

1. 直接修改 `skill-design-document_SSoT.md`
2. 同步更新受影响的实现代码（`src/`）与测试（`tests/`）
3. 在 `CHANGELOG.md` 中记录变更
4. 详见 [CONTRIBUTING.md](../CONTRIBUTING.md)

## 历史版本的差异

`skill-design-document.md` 的旧版本（570 行）与 SSoT 的主要差异：

- 旧版缺少第 7 章「数据模型」与第 9 章「RTM 需求跟踪矩阵」的完整定义
- 旧版缺少 LLM-as-a-Verifier 集成规范（SSoT 现分布在 §7.6 数据模型 + §8 技术实现方案；项目内详细方案见 `llm-verifier-integration-design.md`）
- 旧版缺少验收标准与质量门的具体阈值
- 旧版缺少第 14 章「技能演化机制」与第 15 章「技能评估标准」（SkillOpt / ACES / SkillsBench / SkillLearnBench）

这些差异已在 SSoT 中补齐，旧版本不再维护。SSoT 章节编号：§1-§12 主体 + §14 演化 + §15 评估 + §16 参考文献（§13 已合并入 §16）。
