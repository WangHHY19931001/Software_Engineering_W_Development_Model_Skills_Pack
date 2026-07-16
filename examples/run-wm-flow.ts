/**
 * W-Model 全流程示例
 *
 * 演示如何使用 /wm 命令走完 W 模型 8 个阶段（需求 → 系统/概要/详细设计 → 编码 → 集成/系统/验收测试），
 * 期间自动维护 RTM、运行 LLM-as-a-Verifier 评分、并在验收阶段触发质量门检查。
 *
 * 运行方式：
 *   npm run example:run
 *
 * 本示例使用 MockLLMClient（无需 API key），开箱即用。
 * 生产环境可在 createCommandContext 时注入真实 LLM 客户端（如 HttpLLMClient）。
 */

import { createCommandContext, dispatch } from '../src/index.js';
import type { VerifierConfig } from '../src/types/index.js';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';

async function main(): Promise<void> {
  // 1. 准备临时工作目录（实际使用时换成项目根目录）
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-demo-'));
  console.log(`\n工作目录: ${cwd}\n`);

  // 2. 构造命令上下文（Mock LLM，开箱即用）
  const verifierConfig: VerifierConfig = {
    llm: { model: 'mock' },
    fallbackStrategy: 'text-parse',
    temperature: 0.3,
    pptRanking: { enabled: true, defaultPivotCount: 3 },
  };
  const ctx = await createCommandContext(cwd, verifierConfig);

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

  // 阶段 5：编码实现（同步执行单元测试）
  await step('/wm code 用户登录服务 userService.ts');

  // 阶段 6：集成测试（执行集成测试用例）
  await step('/wm test type=集成');

  // 阶段 7：系统测试（执行系统测试用例）
  await step('/wm test type=系统');

  // 阶段 8：验收测试（执行验收测试用例 + 质量门检查）
  await step('/wm test type=验收');

  // ==================== 评审 / 状态 / 导出 ====================

  // 对需求做 LLM-as-a-Verifier 评审
  await step('/wm review REQ-001');

  // 查看最终状态
  await step('/wm status');

  // 导出项目 JSON + RTM Markdown
  const exportDir = path.join(cwd, 'exports');
  await step(`/wm export ${exportDir}`);

  console.log('\n✅ W 模型全流程演示完成。');
  console.log(`   导出文件位于: ${exportDir}`);
  console.log(`   状态文件: ${path.join(cwd, '.w-model', 'project.json')}`);

  // 清理（可选；保留以便检查产出）
  // await fs.rm(cwd, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('示例运行失败:', err);
  process.exitCode = 1;
});
