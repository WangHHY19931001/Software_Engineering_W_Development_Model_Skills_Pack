# 交互示例：编码阶段

> 对应 W 模型阶段 5（编码 + 单元测试执行）。命令：`/wm code` + `/wm test type=单元` + `/wm review`。

## 示例对话

```
用户: 请实现用户注册功能

AI: 正在执行【编码实现】阶段，将同步生成并执行单元测试...

AI: 已生成以下文件：
    - src/controllers/userController.ts
    - src/services/userService.ts
    - src/models/User.ts
    - src/routes/userRoutes.ts

AI: 已生成单元测试用例（类型=单元测试），覆盖率 95%：
    - userService.test.ts: 注册成功、重复用户、密码强度校验、邮箱格式
    - userController.test.ts: 请求参数校验、错误响应

AI: 执行单元测试中...
    ✅ 18 通过 / 0 失败 / 覆盖率 95%（目标 ≥ 80%）

AI: 代码审查（/wm review）：
    - 安全性 ✅（密码已 bcrypt 加盐）
    - 规范 ✅（ESLint / Prettier 通过）
    - 建议 OPT-001：userService.register 可抽出参数校验为独立中间件（可选）

AI: RTM 已补登：代码模块列 userController.ts/userService.ts/User.ts。

阶段完成摘要：
  产出清单：4 个代码文件、单元测试、测试覆盖率报告、代码审查报告
  质量门：覆盖率 95% ≥ 80% ✅、规范通过 ✅
  下一步：进入【集成测试】（/wm test type=集成），验证模块间接口
```

## 要点

- 编码后立即生成并执行单元测试，覆盖率不达标（< 80%）回到编码返工。
- 代码审查通过后方可进入集成测试。
- 体现质量门：自动化审查 → 单元测试 → （后续）集成 → 系统 → 质量门 → 发布。
- RTM 补登代码模块列，形成需求 → 设计 → 代码的追溯链。
