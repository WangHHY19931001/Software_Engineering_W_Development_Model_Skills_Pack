计划路径：`docs/superpowers/plans/2026-08-25-w-model-reliability-optimization.md`

# W-Model Reliability Optimization 初始任务账本

- 账本状态：未开始
- 工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- 范围：A1-A2、B1-B4、C1-C2、D1-D4
- 初始化时间：2026-08-25
- 当前阶段：计划准备完成，等待实施
- 测试状态：未运行；本次仅准备计划文档与账本
- 依赖状态：未安装、未修改；未执行会改变依赖或配置的命令
- 提交状态：待提交

## 任务状态

| 任务 | 内容 | 状态 | 定向测试 | 提交 |
|---|---|---|---|---|
| A1 | 锁保护的状态事务 | 未开始 | 未运行 | 未提交 |
| A2 | `wm-write` CLI 锁控制契约 | 未开始 | 未运行 | 未提交 |
| B1 | gate log Schema 与原子追加 | 未开始 | 未运行 | 未提交 |
| B2 | 状态目标 Schema 注册与写时校验 | 未开始 | 未运行 | 未提交 |
| B3 | docs-consistency 计数 fail-closed 与 SSoT 链接输入 | 未开始 | 未运行 | 未提交 |
| B4 | 同步子进程 timeout 帮助器 | 未开始 | 未运行 | 未提交 |
| C1 | SSoT 内链与架构边界 | 未开始 | 未运行 | 未提交 |
| C2 | Verifier Persona 可执行 fixture | 未开始 | 未运行 | 未提交 |
| D1 | 脚本层单向依赖 | 未开始 | 未运行 | 未提交 |
| D2 | CLI 自然退出 | 未开始 | 未运行 | 未提交 |
| D3 | 可验证审计证据导出 | 未开始 | 未运行 | 未提交 |
| D4 | 动态计数与本地生成物说明 | 未开始 | 未运行 | 未提交 |

## 执行纪律

1. 每项代码或测试修改前，在可用时执行 codegraph 影响分析；当前工作树没有 `.codegraph/` 索引，实施者需记录等价 import/调用图分析结果。
2. 每项任务遵循 TDD：先失败测试，再最小实现，再定向测试，再回归测试。
3. 每项任务独立提交；实现期间只修改该任务文件。
4. W-Model 编排者只做路由、状态记录和门禁读取，实施动作由子代理完成。
5. 任何测试、门禁或生产代码失败均需按计划记录结果，不得用估算替代真实退出码。
