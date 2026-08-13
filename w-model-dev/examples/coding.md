# 交互示例：编码阶段

> 对应 W 模型阶段 5（编码 + 单元测试执行）。命令：`/wm code` + `/wm test type=单元` + `/wm review`。

> **⚠️ 伪示例（仅供 LLM 行为对齐）**：本文件为「示例对话」风格的编排演示，对话中的产物字段、数字
> 与输出均为示意，不代表真实校验结果。**真实命令输出以 [real-run-evidence.md](./real-run-evidence.md) 为准**；
> 任何门禁结论必须以脚本退出码为准（反模式 #6/#7/#12），不得用对话内容替代。

## 示例对话

```
用户: 请实现用户注册功能

AI: 正在执行【编码实现】阶段，将同步生成并执行单元测试...

AI: 已生成以下文件：
    - src/controllers/userController.ts
    - src/services/userService.ts
    - src/models/User.ts
    - src/routes/userRoutes.ts

AI: 已生成单元测试用例（类型=单元测试）：
    - userService.test.ts: 注册成功、重复用户、密码强度校验、邮箱格式
    - userController.test.ts: 请求参数校验、错误响应

AI: 执行单元测试中...（以真实测试运行器结果为准，经 /wm test result=pass 回填）
    ✅ 测试通过（实际通过数 / 失败数以真实运行器输出为准，覆盖率 ≥ 80% 才放行）

AI: 代码审查（/wm review）：
    - 安全性 ✅（密码已 bcrypt 加盐）
    - 规范 ✅（ESLint / Prettier 通过）
    - 建议 OPT-001：userService.register 可抽出参数校验为独立中间件（可选）

AI: RTM 已补登：代码模块列 userController.ts/userService.ts/User.ts。

阶段完成摘要：
  产出清单：4 个代码文件、单元测试、测试覆盖率报告、代码审查报告
  质量门：单元测试代码覆盖率达标 ✅、规范通过 ✅（数值以真实运行器输出为准）
  下一步：进入【集成测试】（/wm test type=集成），验证模块间接口
```

## 要点

- 编码后立即生成并执行单元测试，单元测试代码覆盖率不达标（< 80%）回到编码返工。
- 代码审查通过后方可进入集成测试。
- 体现质量门：自动化审查 → 单元测试 → （后续）集成 → 系统 → 质量门 → 发布。
- RTM 补登代码模块列，形成需求 → 设计 → 代码的追溯链。

## 环境变量注入（替代 `.env` 直写）

> **不推荐** `echo X=... > .env` 的 PowerShell 直写方式（重定向语义在 cmd/PowerShell 下不可移植，
> 且 `.env` 落入仓库有泄露风险，参见反模式 #25 的敏感信息处理约定）。推荐两种方式：

### 方式 1：本地临时环境变量

```powershell
$env:JWT_SECRET="test-secret-blog-demo"
npx vitest run
```

```bash
# Git Bash / WSL
JWT_SECRET=test-secret-blog-demo npx vitest run
```

### 方式 2：dotenv 从宿主配置加载（不入库）

```bash
# 本地手工创建 .env（加入 .gitignore，不入库）
npm install dotenv
```

```typescript
// src/app.ts 首行
import 'dotenv/config';

// process.env.JWT_SECRET 自动可用
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');
```
