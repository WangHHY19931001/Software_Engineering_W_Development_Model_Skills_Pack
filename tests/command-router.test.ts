/**
 * /wm 命令路由器单元测试
 *
 * 覆盖：
 *   - help / status / reset / export / import 等辅助命令
 *   - analyze → design → code → test 完整 W 模型流程
 *   - 阶段校验（不允许跨阶段）
 *   - 未知命令处理
 *   - /wm review 仅返回评审指引（不内置 LLM，由外部 Agent 按提示词执行）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';
import { ProjectStateManager } from '../src/state/project-state.js';
import { RTMManager } from '../src/state/rtm-manager.js';
import { dispatch } from '../src/commands/router.js';
import type { CommandContext } from '../src/types/index.js';

let tmpDir: string;
let ctx: CommandContext;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-cmd-'));
  const state = new ProjectStateManager(tmpDir);
  await state.load();
  const rtm = new RTMManager(tmpDir, state);
  // 本技能不再注入 verifier；CommandContext 只有 projectState / rtm / cwd
  ctx = { projectState: state, rtm, cwd: tmpDir };
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('命令路由 - 基础', () => {
  it('help 命令输出帮助文本', async () => {
    const r = await dispatch('/wm help', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('命令帮助');
    expect(r.message).toContain('/wm analyze');
  });

  it('未知命令返回失败', async () => {
    const r = await dispatch('/wm unknown', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('未知命令');
  });

  it('空输入显示 help', async () => {
    const r = await dispatch('', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('命令帮助');
  });

  it('不带 /wm 前缀也可识别', async () => {
    const r = await dispatch('help', ctx);
    expect(r.success).toBe(true);
  });
});

describe('命令路由 - 项目未初始化', () => {
  it('status 显示未初始化提示', async () => {
    const r = await dispatch('/wm status', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('尚未初始化');
  });
});

describe('命令路由 - 完整 W 模型流程', () => {
  it('analyze → design → code → test → status 闭环', async () => {
    // 1. 需求分析
    const r1 = await dispatch('/wm analyze 用户登录功能，支持账号密码与邮箱验证', ctx);
    expect(r1.success).toBe(true);
    expect(r1.message).toContain('需求分析');
    expect(r1.message).toContain('REQ-001');
    expect(r1.message).toContain('验收测试');

    // 2. 系统设计
    const r2 = await dispatch('/wm design type=架构', ctx);
    expect(r2.success).toBe(true);
    expect(r2.message).toContain('系统设计');
    expect(r2.message).toContain('系统测试用例');

    // 3. 概要设计
    const r3 = await dispatch('/wm design type=概要', ctx);
    expect(r3.success).toBe(true);
    expect(r3.message).toContain('概要设计');

    // 4. 详细设计
    const r4 = await dispatch('/wm design type=详细', ctx);
    expect(r4.success).toBe(true);
    expect(r4.message).toContain('详细设计');

    // 5. 编码（产出单元测试用例，但不自动标记通过）
    const r5 = await dispatch('/wm code 用户注册服务', ctx);
    expect(r5.success).toBe(true);
    expect(r5.message).toContain('编码实现');
    expect(r5.message).toContain('待执行'); // 单元测试保持待执行

    // 5.1 回填单元测试真实执行结果
    const r5b = await dispatch('/wm test type=单元 result=pass', ctx);
    expect(r5b.success).toBe(true);

    // 6. 集成测试（回填真实执行结果）
    const r6 = await dispatch('/wm test type=集成 result=pass', ctx);
    expect(r6.success).toBe(true);

    // 7. 系统测试（回填真实执行结果）
    const r7 = await dispatch('/wm test type=系统 result=pass', ctx);
    expect(r7.success).toBe(true);

    // 8. 验收测试（回填真实执行结果 + 质量门检查）
    const r8 = await dispatch('/wm test type=验收 result=pass', ctx);
    expect(r8.success).toBe(true);

    // status
    const rs = await dispatch('/wm status', ctx);
    expect(rs.success).toBe(true);
    expect(rs.message).toContain('验收测试');
  });

  it('analyze 缺少参数 → 失败', async () => {
    const r = await dispatch('/wm analyze', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('用法');
  });

  it('design 无效 type → 失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const r = await dispatch('/wm design type=无效', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('无效 type');
  });

  it('不允许跨越阶段推进', async () => {
    await dispatch('/wm analyze 需求', ctx);
    // 直接跳到编码（需先经过 系统设计 / 概要 / 详细）
    const r = await dispatch('/wm code 功能', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('当前阶段');
  });
});

describe('命令路由 - review（仅返回评审指引，不内置 LLM）', () => {
  it('review 需求返回评审指引（指向 verifier-spec.md + check-verifier-output.ts）', async () => {
    await dispatch('/wm analyze 登录功能', ctx);
    const r = await dispatch('/wm review REQ-001', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('LLM-as-a-Verifier 评审指引');
    expect(r.message).toContain('verifier-spec.md');
    expect(r.message).toContain('check-verifier-output.ts');
    expect(r.message).toContain('requirement');
    // 不应包含 LLM 实际评分（本技能不内置 LLM）
    expect(r.message).not.toContain('综合分数');
  });

  it('review 设计文档返回设计子标准集合', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    // 取实际生成的设计 ID（addDesign 自动分配）
    const designs = ctx.projectState.getDesigns();
    expect(designs.length).toBeGreaterThan(0);
    const r = await dispatch(`/wm review ${designs[0].id}`, ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('目标类型: 设计');
    expect(r.message).toContain('design');
    expect(r.message).toContain('architecture-soundness');
  });

  it('review 测试用例返回测试用例子标准集合', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const testCases = ctx.projectState.getTestCases();
    expect(testCases.length).toBeGreaterThan(0);
    const r = await dispatch(`/wm review ${testCases[0].id}`, ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('目标类型: 测试用例');
    expect(r.message).toContain('testcase');
    expect(r.message).toContain('coverage');
  });

  it('review 不存在的目标 → 失败', async () => {
    await dispatch('/wm analyze 登录功能', ctx);
    const r = await dispatch('/wm review REQ-999', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('未找到目标');
  });

  it('review 缺少参数时失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const r = await dispatch('/wm review', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('用法');
  });

  it('review 文件路径返回文件子标准集合', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const filePath = path.join(tmpDir, 'sample.txt');
    await fs.writeFile(filePath, '示例文件内容', 'utf-8');
    const r = await dispatch(`/wm review ${filePath}`, ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('目标类型: 文件');
    expect(r.message).toContain('file');
  });

  it('review 指引中标注外部演化工具', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const r = await dispatch('/wm review REQ-001', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('skillopt');
    expect(r.message).toContain('darwin-skill');
  });
});

describe('命令路由 - export / import', () => {
  it('export 导出 JSON 与 Markdown', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const outDir = path.join(tmpDir, 'exports');
    const r = await dispatch(`/wm export ${outDir}`, ctx);
    expect(r.success).toBe(true);
    expect(r.artifacts).toBeDefined();
    expect(r.artifacts!.length).toBe(2);
    for (const f of r.artifacts!) {
      const stat = await fs.stat(f);
      expect(stat.isFile()).toBe(true);
    }
  });

  it('import 导入后状态一致', async () => {
    await dispatch('/wm analyze 原始需求', ctx);
    const outDir = path.join(tmpDir, 'exports');
    await dispatch(`/wm export ${outDir}`, ctx);

    // 列出导出文件
    const files = await fs.readdir(outDir);
    const jsonFile = files.find(f => f.endsWith('.json'));
    expect(jsonFile).toBeDefined();

    // 在新目录 import
    const newDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-import-'));
    try {
      const newState = new ProjectStateManager(newDir);
      const newRtm = new RTMManager(newDir, newState);
      const newCtx: CommandContext = { projectState: newState, rtm: newRtm, cwd: newDir };
      const r = await dispatch(`/wm import ${path.join(outDir, jsonFile!)}`, newCtx);
      expect(r.success).toBe(true);
      expect(r.message).toContain('已导入项目');
      expect(r.message).toContain('REQ-001');
    } finally {
      await fs.rm(newDir, { recursive: true, force: true });
    }
  });
});

describe('命令路由 - reset', () => {
  it('reset 清空项目', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const r = await dispatch('/wm reset', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('已重置');

    const status = await dispatch('/wm status', ctx);
    expect(status.message).toContain('需求分析');
  });

  it('reset 未初始化项目时返回失败', async () => {
    const r = await dispatch('/wm reset', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('尚无项目');
  });
});

describe('命令路由 - 边界与错误路径', () => {
  it('getCommandNames 返回已注册命令', async () => {
    const { getCommandNames } = await import('../src/commands/router.js');
    const names = getCommandNames();
    expect(names).toContain('help');
    expect(names).toContain('analyze');
    expect(names).toContain('design');
    expect(names).toContain('code');
    expect(names).toContain('test');
    expect(names).toContain('review');
    expect(names).toContain('status');
    expect(names).toContain('reset');
    expect(names).toContain('export');
    expect(names).toContain('import');
  });

  it('handler 抛错时 dispatch 捕获并返回失败', async () => {
    const { registerCommand, dispatch: d } = await import('../src/commands/router.js');
    registerCommand('throw-test', async () => {
      throw new Error('boom');
    });
    const r = await d('/wm throw-test', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('命令执行失败');
    expect(r.message).toContain('boom');
  });

  it('analyze 阶段非需求分析时失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    // 当前处于系统设计，再次 analyze 应失败
    const r = await dispatch('/wm analyze 另一需求', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('当前阶段');
  });

  it('design 跨阶段进入失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    // 直接跳到详细设计（需先经过系统设计 / 概要设计）
    const r = await dispatch('/wm design type=详细', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('无法直接进入');
  });

  it('code 阶段不匹配时失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    // 当前处于需求分析，code 应失败
    const r = await dispatch('/wm code 功能', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('需先完成详细设计');
  });

  it('code 缺少参数时失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    const r = await dispatch('/wm code', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('用法');
  });

  it('test 无效 type 失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    const r = await dispatch('/wm test type=未知', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('无效 type');
  });

  it('test 跨阶段执行失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    // 当前处于需求分析，直接执行集成测试应失败
    const r = await dispatch('/wm test type=集成', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('无法执行');
  });

  it('test 验收测试质量门未通过时返回失败', async () => {
    // 构造一个不完整的项目：只有需求，没有设计/代码
    await dispatch('/wm analyze 需求', ctx);
    // 手动推进到验收测试阶段（绕过正常流程）
    await ctx.projectState.advanceTo('系统设计');
    await ctx.projectState.advanceTo('概要设计');
    await ctx.projectState.advanceTo('详细设计');
    await ctx.projectState.advanceTo('编码');
    await ctx.projectState.advanceTo('集成测试');
    await ctx.projectState.advanceTo('系统测试');
    await ctx.projectState.advanceTo('验收测试');
    const r = await dispatch('/wm test type=验收', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('质量门未通过');
  });

  it('export 未初始化项目失败', async () => {
    const r = await dispatch('/wm export', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('尚无项目');
  });

  it('import 缺少参数失败', async () => {
    const r = await dispatch('/wm import', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('用法');
  });

  it('test type=单元 在编码阶段可执行', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);
    const r = await dispatch('/wm test type=单元', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('单元测试');
  });
});

describe('命令路由 - result 参数（修正占位实现）', () => {
  it('code 命令不自动标记单元测试通过', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);

    // 编码后单元测试应保持「待执行」
    const unitCases = ctx.projectState.getTestCases('单元测试');
    expect(unitCases.length).toBeGreaterThan(0);
    expect(unitCases.every(t => t.status === '待执行')).toBe(true);
  });

  it('test 不带 result 时保持待执行状态', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);

    const r = await dispatch('/wm test type=单元', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('待执行');

    // 状态未变
    const unitCases = ctx.projectState.getTestCases('单元测试');
    expect(unitCases.every(t => t.status === '待执行')).toBe(true);
  });

  it('test result=pass 回填通过状态', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);

    const r = await dispatch('/wm test type=单元 result=pass', ctx);
    expect(r.success).toBe(true);
    expect(r.message).toContain('通过');

    const unitCases = ctx.projectState.getTestCases('单元测试');
    expect(unitCases.every(t => t.status === '通过')).toBe(true);
  });

  it('test result=fail 回填失败状态', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);

    const r = await dispatch('/wm test type=单元 result=fail', ctx);
    expect(r.success).toBe(true);

    const unitCases = ctx.projectState.getTestCases('单元测试');
    expect(unitCases.every(t => t.status === '失败')).toBe(true);
  });

  it('test result=无效值 失败', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);

    const r = await dispatch('/wm test type=单元 result=invalid', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('无效 result');
  });

  it('验收测试无 result 时质量门未通过（待执行阻塞）', async () => {
    await dispatch('/wm analyze 需求', ctx);
    await dispatch('/wm design type=架构', ctx);
    await dispatch('/wm design type=概要', ctx);
    await dispatch('/wm design type=详细', ctx);
    await dispatch('/wm code 功能', ctx);
    await dispatch('/wm test type=集成 result=pass', ctx);
    await dispatch('/wm test type=系统 result=pass', ctx);

    // 验收测试不带 result：UAT 待执行 → 质量门失败
    const r = await dispatch('/wm test type=验收', ctx);
    expect(r.success).toBe(false);
    expect(r.message).toContain('质量门未通过');
  });
});
