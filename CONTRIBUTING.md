# 贡献指南

感谢你对 W-Model AI Assistant Skill 项目的关注！本文档说明如何参与贡献。

## 行为准则

请保持尊重与专业。任何形式的骚扰或不友善行为均不被接受。

## 开发环境准备

```bash
# 1. 克隆仓库
git clone <repo-url>
cd Software_Engineering_W_Development_Model_Skills_Pack

# 2. 安装依赖
npm install

# 3. 验证环境
npm run typecheck   # TypeScript 类型检查
npm test            # 运行测试 + 覆盖率
npm run lint        # ESLint 检查
```

## 开发工作流

### 1. 创建分支

```bash
git checkout -b feature/your-feature
# 或
git checkout -b fix/issue-xxx
```

### 2. 编写代码

遵循以下原则：

- **单一职责**：每个模块 / 函数只做一件事
- **类型安全**：启用 TypeScript 严格模式，避免 `any`
- **测试驱动**：新增功能先写测试，再写实现
- **中文注释**：代码注释使用中文（与现有代码风格一致），标识符用英文
- **避免过度工程**：只实现必要的功能，不为假设的未来需求设计

### 3. 运行检查

提交前必须通过以下检查：

```bash
npm run typecheck   # 必须无错误
npm test            # 所有测试通过，覆盖率达标
npm run lint        # 无警告
```

覆盖率要求：
- 全局分支覆盖率 ≥ 70%
- `src/state/` 分支覆盖率 ≥ 80%
- `src/commands/` 分支覆盖率 ≥ 80%
- `w-model-dev/scripts/verifier-logic.ts` 分支覆盖率 ≥ 85%（校验逻辑需严格覆盖）

> Phase 2.6 架构重构后，`src/core/` / `src/evolution/` / `src/eval/` 已删除，
> 不再有「核心模块覆盖率」口径。LLM 评审逻辑改由 `w-model-dev/scripts/verifier-logic.ts` 承载。

### 4. 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `refactor`: 重构（不改变功能）
- `test`: 测试相关
- `chore`: 构建 / 工具变更

示例：
```
feat(verifier): 在 verifier-logic.ts 增加对 ranking.temperature 上界的校验
fix(rtm): 修复覆盖率统计未考虑待执行用例的问题
docs(ssot): 同步 §3.3 架构原则与外部工具边界
refactor(skill): /wm review 改为返回结构化评审指引，不内置 LLM
```

### 5. 提交 Pull Request

- PR 标题遵循 Conventional Commits 格式
- PR 描述说明：改了什么、为什么改、如何验证
- 关联相关 issue（如 `Closes #5`）
- 确保 CI 全绿

## 文档维护规则

### SSoT 原则

- **设计决策**统一记录在 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md)
- `docs/skill-design-document.md` 仅作为指针，不再独立维护内容
- 修改设计 → 先改 SSoT → 再改实现 → 最后改测试

### 变更日志

- 每次用户可见的变更都记录在 [`CHANGELOG.md`](./CHANGELOG.md) 的 `[Unreleased]` 段
- 遵循 Keep a Changelog 规范

## 项目结构约定

```
src/                    # TypeScript 实现（技能的可选运行时引擎）
├── state/              # 状态管理（项目状态 + RTM）
├── commands/           # /wm 命令路由
├── types/              # 共享类型定义（CommandContext 仅 projectState/rtm/cwd）
└── index.ts            # 公共 API 入口（createCommandContext(cwd) 单参）

tests/                  # 单元测试，文件名与 src/ 或 w-model-dev/scripts/ 对应
examples/               # 可运行示例（程序化调用）
w-model-dev/            # Skill 资产（标准 skill 结构：SKILL.md、references/、scripts/、templates/、examples/）
├── references/
│   └── verifier-spec.md    # LLM-as-a-Verifier 评审规范（提示词 + Schema + 子标准）
└── scripts/                # 只做门禁 / 校验，不调用 LLM
    ├── gate-logic.ts           # 工件质量门（仅 checkArtifactGate）
    ├── verifier-logic.ts       # VerifierOutput 校验纯逻辑（SUB_CRITERIA + checkVerifierOutput）
    └── check-verifier-output.ts  # Verifier 输出校验 CLI
docs/                   # 设计文档统一存放（SSoT、集成设计、实现路线图、安装指南等）
```

> Phase 2.6 架构重构后，`src/core/` / `src/evolution/` / `src/eval/` 已删除。
> `w-model-dev/META-SKILL.md` 与 `w-model-dev/scripts/check-skill-gate.ts` 已删除。
> 技能演化由外部工具完成，不在本仓库内贡献。

### 添加新命令

1. 在 `src/commands/router.ts` 中 `registerCommand('xxx', handler)`
2. 在 `src/types/index.ts` 中补充必要的类型
3. 在 `tests/command-router.test.ts` 中添加测试
4. 更新 `README.md` 命令一览表
5. 更新 `src/commands/router.ts` 的 `helpHandler` 帮助文本

### 修改 LLM-as-a-Verifier 评审规范

LLM 评审逻辑不在 `src/` 内，而是由 `w-model-dev/` 下的提示词 + 校验脚本承载：

1. **修改提示词 / Schema / 子标准**：先改 [`w-model-dev/references/verifier-spec.md`](./w-model-dev/references/verifier-spec.md)（权威来源）
2. **同步校验逻辑**：修改 [`w-model-dev/scripts/verifier-logic.ts`](./w-model-dev/scripts/verifier-logic.ts) 的 `SUB_CRITERIA` 常量与 `checkVerifierOutput` 校验项
3. **添加测试**：在 [`tests/verifier-logic.test.ts`](./tests/verifier-logic.test.ts) 中添加用例
4. **同步 SSoT**：更新 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md) §7.6 与 §16.2
5. **同步集成设计**：更新 [`docs/llm-verifier-integration-design.md`](./docs/llm-verifier-integration-design.md)

### 技能演化与评估（外部工具边界）

技能自演化（Rollout / Reflect / Edit / Skill Lift 评估 / 轨迹分析）**不在本仓库内贡献**。
相关能力由外部工具实现，本仓库只产出供其消费的 `VerifierOutput` JSON：

- [SkillOpt](https://github.com/microsoft/SkillOpt)（微软）
- [darwin-skill](https://github.com/alchaincyf/darwin-skill)

如需调整 `VerifierOutput` Schema 以更好支持外部演化工具的消费，按上一节「修改 LLM-as-a-Verifier 评审规范」流程进行；演化算法本身的改进请在对应外部工具仓库贡献。

## 发布流程

1. 更新 `CHANGELOG.md`，将 `[Unreleased]` 改为版本号 + 日期
2. 更新 `package.json` 的 `version` 字段
3. 创建 git tag：`git tag v0.x.0`
4. 推送 tag：`git push origin v0.x.0`

## 问题反馈

- Bug 报告：通过 GitHub Issues，使用 Bug 模板
- 功能建议：通过 GitHub Issues，使用 Feature Request 模板
- 安全问题：请勿公开报告，私信维护者

## License

贡献的代码遵循项目的 [MIT License](./LICENSE)。
