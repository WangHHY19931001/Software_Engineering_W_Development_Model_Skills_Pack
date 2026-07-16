# W-Model AI Assistant Skill

> 基于 AI 辅助编码与 LLM-as-a-Verifier 的 W 开发模型闭环工作技能。
>
> 将软件工程 W 模型（需求 → 设计 → 编码 → 测试）的 8 个阶段编排为可执行的 `/wm` 命令，
> 自动维护需求跟踪矩阵（RTM）、运行连续评分验证、在验收阶段触发质量门检查。

## 核心能力

- **W 模型 8 阶段编排**：需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码 → 集成测试 → 系统测试 → 验收测试
- **LLM-as-a-Verifier**：基于 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 的连续评分（1-20 分）+ 置信度，替代粗糙的二值判断
- **三维度验证框架**：评分粒度 + 重复评估 + 标准分解
- **RTM 自动维护**：从项目状态自动重建需求跟踪矩阵，双向追溯需求 ↔ 设计 ↔ 代码 ↔ 四级测试
- **状态持久化**：JSON 文件存储，跨多轮交互保持上下文
- **质量门检查**：覆盖率 100% + 所有测试通过才允许交付
- **PPT 排序算法**：O(N×k) 复杂度的概率枢轴锦标赛，用于测试用例优先级排序

## 快速上手

本技能提供两种使用方式：**AI Agent 模式**（直接读取 Skill 资产，零依赖）与**程序化模式**（TypeScript 引擎）。

### 方式一：AI Agent 安装（推荐，零依赖）

将 [`w-model-dev/`](./w-model-dev) 目录拷贝到你的 AI Agent（Trae / Claude Code 等）的 skills 目录即可。Skill 资产自包含：`SKILL.md` 定义触发条件与编排，`references/` / `templates/` / `examples/` 按需加载，无需 Node.js 或 npm。

```bash
# 拷贝 skill 目录到 agent 的 skills 位置（路径以你的 agent 为准）
cp -r w-model-dev /path/to/agent/skills/w-model-dev
```

安装后，agent 在用户提及 W 模型或 `/wm` 命令时自动激活本技能。详细步骤与验证方法见 [docs/INSTALL.md](./docs/INSTALL.md)。

### 方式二：程序化安装（TypeScript 引擎）

#### 环境要求

- Node.js ≥ 18.0.0

#### 安装依赖

```bash
npm install
```

#### 运行全流程示例

```bash
npm run example:run
```

该示例使用 Mock LLM（无需 API key），走完 W 模型 8 个阶段并导出 RTM。

#### 运行测试

```bash
npm test
```

覆盖率目标：全局 ≥ 70%，核心模块 ≥ 85%。

## 命令一览

| 命令 | 说明 |
|---|---|
| `/wm analyze <需求描述>` | 需求分析，同步产出验收测试设计 |
| `/wm design type=<架构\|概要\|详细>` | 设计阶段，同步产出对应测试设计 |
| `/wm code <功能描述>` | 编码实现，同步执行单元测试 |
| `/wm test type=<单元\|集成\|系统\|验收>` | 执行指定类型测试 |
| `/wm review <目标ID或文件路径>` | LLM-as-a-Verifier 验证（连续评分+置信度） |
| `/wm status` | 查看当前阶段、进度、RTM 覆盖率 |
| `/wm help` | 显示帮助 |
| `/wm reset` | 重置项目（保留元信息，清空实体） |
| `/wm export [输出目录]` | 导出项目 JSON + RTM Markdown |
| `/wm import <文件路径>` | 从 JSON 导入项目 |

## 项目结构

```
.
├── src/                          # TypeScript 实现（技能的可选运行时引擎）
│   ├── core/                     # 核心引擎
│   │   ├── llm-client.ts         # LLM 客户端抽象（Mock / Http）
│   │   ├── scoring-engine.ts     # LLMVerifierEngine - 连续评分核心
│   │   ├── verification-framework.ts  # 三维度验证框架
│   │   ├── ppt-ranker.ts         # PPT 排序算法
│   │   └── w-model-enhancer.ts   # W 模型验证增强器
│   ├── state/                    # 状态管理
│   │   ├── project-state.ts      # 项目状态持久化
│   │   └── rtm-manager.ts        # RTM 自动更新
│   ├── commands/
│   │   └── router.ts             # /wm 命令路由
│   ├── types/
│   │   └── index.ts              # 共享类型定义
│   └── index.ts                  # 公共 API 入口
├── tests/                        # 单元测试（119 个，覆盖率 ≥ 85%）
├── examples/
│   └── run-wm-flow.ts            # W 模型全流程示例
├── w-model-dev/                  # Skill 资产（标准 skill 结构，自包含）
│   ├── SKILL.md                  # Skill 定义（YAML frontmatter + 编排）
│   ├── META-SKILL.md             # 元技能可演化配置
│   ├── references/               # 各阶段参考文档（按需加载）
│   ├── templates/                # 文档模板
│   └── examples/                 # 交互示例
├── docs/                         # 设计文档（统一存放）
│   ├── skill-design-document_SSoT.md           # 设计文档（单一事实来源）
│   ├── skill-design-document.md                # 设计文档指针（已废弃独立维护）
│   ├── llm-verifier-integration-design.md      # LLM Verifier 集成设计
│   ├── llm-verifier-implementation-template.ts # 原始模板（已被 src/ 替代）
│   ├── IMPLEMENTATION-PLAN.md                  # 实现路线图
│   └── INSTALL.md                              # AI Agent 安装指南
├── CHANGELOG.md                  # 变更日志
├── CONTRIBUTING.md               # 贡献指南
└── README.md                     # 项目导航
```

## 编程式接入

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

// 1. 创建命令上下文（默认使用 MockLLMClient，开箱即用）
const ctx = await createCommandContext('./my-project', {
  llm: { model: 'gpt-4' },
  fallbackStrategy: 'text-parse',
});

// 2. 走 W 模型流程
await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
await dispatch('/wm design type=概要', ctx);
await dispatch('/wm design type=详细', ctx);
await dispatch('/wm code 登录服务 authService.ts', ctx);
await dispatch('/wm test type=集成', ctx);
await dispatch('/wm test type=系统', ctx);
const result = await dispatch('/wm test type=验收', ctx);

if (result.success) {
  console.log('✅ 质量门通过，项目可交付');
}
```

## LLM Verifier 的 Logits Fallback

并非所有 LLM API 都返回 logits。当不支持时，按 `fallbackStrategy` 回退：

| 策略 | 行为 |
|---|---|
| `text-parse`（默认） | 解析模型输出的字母（A-T）或数字，加稳定扰动模拟连续性 |
| `discrete` | 直接采用解析到的整数分数 |
| `throw` | 抛错（要求严格 logits 支持的场景） |

## 相关文档

- [设计文档（SSoT）](./docs/skill-design-document_SSoT.md) - 单一事实来源
- [Skill 定义](./w-model-dev/SKILL.md) - AI 助理触发命令与阶段流
- [LLM Verifier 集成设计](./docs/llm-verifier-integration-design.md)
- [实现路线图](./docs/IMPLEMENTATION-PLAN.md)
- [AI Agent 安装指南](./docs/INSTALL.md)
- [变更日志](./CHANGELOG.md)
- [贡献指南](./CONTRIBUTING.md)

## License

MIT
