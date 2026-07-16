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
- `src/core/` 分支覆盖率 ≥ 85%
- `src/state/` 分支覆盖率 ≥ 80%

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
feat(core): 添加 logits fallback 的 discrete 策略
fix(rtm): 修复覆盖率统计未考虑待执行用例的问题
docs(ssot): 同步 RTM 数据模型定义
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
src/            # TypeScript 实现（技能的可选运行时引擎）
├── core/       # 核心引擎（LLM Verifier 相关）
├── state/      # 状态管理（项目状态 + RTM）
├── commands/   # /wm 命令路由
├── types/      # 共享类型定义
└── index.ts    # 公共 API 入口

tests/          # 单元测试，文件名与 src/ 对应
examples/       # 可运行示例（程序化调用）
w-model-dev/    # Skill 资产（标准 skill 结构：SKILL.md、META-SKILL.md、references/、templates/、examples/）
docs/           # 设计文档统一存放（SSoT、集成设计、实现路线图、安装指南等）
```

### 添加新命令

1. 在 `src/commands/router.ts` 中 `registerCommand('xxx', handler)`
2. 在 `src/types/index.ts` 中补充必要的类型
3. 在 `tests/command-router.test.ts` 中添加测试
4. 更新 `README.md` 命令一览表
5. 更新 `src/commands/router.ts` 的 `helpHandler` 帮助文本

### 添加新验证维度

1. 在 `src/core/verification-framework.ts` 中扩展 `VerificationDimension` 类型
2. 在 `src/core/w-model-enhancer.ts` 中添加 `verifyXxx` 方法
3. 在 `src/types/index.ts` 中补充子标准类型
4. 在 `tests/w-model-enhancer.test.ts` 中添加测试

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
