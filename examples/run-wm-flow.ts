/**
 * W-Model 全流程示例
 *
 * 演示如何使用 /wm 命令走完 W 模型 8 个阶段（需求 → 系统/概要/详细设计 → 编码 → 集成/系统/验收测试），
 * 期间自动维护 RTM，并在验收阶段触发工件质量门检查。
 *
 * 运行方式：
 *   npm run example:run
 *
 * 架构说明：
 *   - 本技能不内置 LLM 调用。阶段产物的 LLM-as-a-Verifier 评审由外部 Agent 按提示词执行，
 *     详见 w-model-dev/references/verifier-spec.md；评审输出由
 *     w-model-dev/scripts/check-verifier-output.ts 校验防漂移。
 *   - 本示例因此不再调用 /wm review（该命令仅返回评审指引，实际评审需外部 Agent 完成）。
 *   - 技能自演化由外部工具完成（SkillOpt / darwin-skill），不在本示例范围。
 */

import { createCommandContext, dispatch } from '../src/index.js';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';

async function main(): Promise<void> {
  // 1. 准备临时工作目录（实际使用时换成项目根目录）
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-demo-'));
  console.log(`\n工作目录: ${cwd}\n`);

  // 2. 构造命令上下文（本技能不再注入 verifier）
  const ctx = await createCommandContext(cwd);

  const step = async (cmd: string): Promise<void> => {
    console.log(`\n$ ${cmd}`);
    const r = await dispatch(cmd, ctx);
    console.log(r.message);
    if (!r.success) {
      console.error(`\n❌ 命令失败，流程中止: ${cmd}`);
      process.exitCode = 1;
    }
  };

  // ==================== W 模型 8 阶段 ====================

  // 阶段 1：需求分析（同步产出验收测试设计）
  await step('/wm analyze 用户登录功能：支持账号密码、邮箱验证码登录，登录成功后返回 JWT 令牌');

  // 阶段 2：系统设计（同步产出系统测试设计）
  await step('/wm design type=架构');

  // 阶段 3：概要设计（同步产出集成测试设计）
  await step('/wm design type=概要');

  // 阶段 4：详细设计（同步产出单元测试设计）
  await step('/wm design type=详细');

  // 阶段 5：编码实现（同步产出单元测试用例，但不自动标记通过）
  await step('/wm code 用户登录服务 userService.ts');

  // 阶段 5.1：回填单元测试真实执行结果（上游 AI / 测试运行器执行后回填）
  await step('/wm test type=单元 result=pass');

  // 阶段 6：集成测试（回填真实执行结果）
  await step('/wm test type=集成 result=pass');

  // 阶段 7：系统测试（回填真实执行结果）
  await step('/wm test type=系统 result=pass');

  // 阶段 8：验收测试（回填真实执行结果 + 质量门检查）
  await step('/wm test type=验收 result=pass');

  // ==================== 状态 / 导出 ====================

  // 查看最终状态
  await step('/wm status');

  // 导出项目 JSON + RTM Markdown
  const exportDir = path.join(cwd, 'exports');
  await step(`/wm export ${exportDir}`);

  console.log('\n✅ W 模型全流程演示完成。');
  console.log(`   导出文件位于: ${exportDir}`);
  console.log(`   状态文件: ${path.join(cwd, '.w-model', 'project.json')}`);

  // ==================== 阶段门评审（由外部 Agent 执行，不在本示例内） ====================
  //
  // 如需对阶段产物做 LLM-as-a-Verifier 评审：
  //   1. 执行 /wm review <target>，技能返回评审指引（不内置 LLM）
  //   2. 外部 Agent 按 w-model-dev/references/verifier-spec.md §8 提示词模板执行评审
  //   3. 评审输出 JSON 后立即调用 w-model-dev/scripts/check-verifier-output.ts 校验防漂移
  //
  // 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具完成：
  //   - SkillOpt（微软）  https://github.com/microsoft/SkillOpt
  //   - darwin-skill       https://github.com/alchaincyf/darwin-skill

  // 清理（可选；保留以便检查产出）
  // await fs.rm(cwd, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('示例运行失败:', err);
  process.exitCode = 1;
});
