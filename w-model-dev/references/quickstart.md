# 快速上手（5 分钟）

## 1. 前置检查

- Node ≥20：`node -v`
- Git（Windows 需 Git for Windows；若 PATH 首位是 WSL bash，设置 `GIT_BASH` 指向 `C:\Program Files\Git\bin\bash.exe`）

## 2. 安装（L1 带门禁）

```powershell
git clone <本仓库> && cd <仓库目录>
npm install          # 同时装配 git hooks（core.hooksPath .githooks）
```

只要纯提示词/模板（L0）？把 `w-model-dev/` 下 `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/` 拷贝到宿主技能目录即可，无需 npm。

## 3. 验证安装

```powershell
npm run self-test    # 期望：260/260 通过
npx tsx w-model-dev/scripts/cli/doctor.ts   # 依赖体检（含 TLA 用 --with-tla）
```

## 4. 第一个命令：/wm analyze

对 Agent 说：

> /wm analyze 为在线书店开发用户注册与登录功能，要求邮箱验证、密码强度策略与连续失败锁定

Agent（编排者 O）会：确认技术栈 → 🔴 CHECKPOINT 项目初始化 → 分派 S 产出需求规格+验收测试设计+RTM → R3 预防性审查 → V 评审 → G 门禁 → 🔴 CHECKPOINT 阶段门放行。每个 🔴 处等你确认。

## 5. 下一步

- 全命令细节：`references/command-reference.md`
- 8 阶段全景与回退：`references/workflow.md`
- 硬红线与反模式：`references/hard-constraints.md`

## 常见问题

- **门禁脚本报依赖错误**：回 L1 安装；或按 `doctor.ts` 输出补依赖。
- **Windows 下 hook 退出码 127**：PATH 首位是 WSL bash，设 `GIT_BASH` 环境变量。
- **状态文件损坏**：按 `references/operational-recovery.md` 恢复（.w-model/*.bak）。
