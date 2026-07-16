/**
 * /wm 命令处理器与路由
 *
 * 解决 issue Critical #2：`/wm` 命令路由未实现。
 *
 * 命令列表（对应 SKILL.md 命令接口）：
 *   核心命令：
 *     /wm analyze <需求描述>           需求分析（同步验收测试设计）
 *     /wm design type=<架构|概要|详细>  设计（同步对应测试设计）
 *     /wm code <功能描述>              编码（同步单元测试执行）
 *     /wm test type=<单元|集成|系统|验收> 测试执行
 *     /wm review <目标>                代码 / 文档审查（LLM-as-a-Verifier）
 *     /wm status                       项目状态与进度
 *   辅助命令：
 *     /wm help                         帮助
 *     /wm reset                        重置项目
 *     /wm export [文件路径]            导出项目 JSON + RTM Markdown
 *     /wm import <文件路径>            导入项目
 *
 * 注意：本处理器专注于「状态机驱动的命令编排」，
 * 实际的文档生成 / 代码生成由上游 AI 在调用此处理器前后完成。
 * 此处的命令处理器负责：状态校验、实体登记、RTM 同步、阶段推进、验证触发。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  CommandContext,
  CommandHandler,
  CommandResult,
  DesignType,
  ProjectPhase,
  TestCaseType,
  VerificationResult,
} from '../types';

// ==================== 命令注册表 ====================

const handlers: Record<string, CommandHandler> = {};

export function registerCommand(name: string, handler: CommandHandler): void {
  handlers[name] = handler;
}

export function getCommandNames(): string[] {
  return Object.keys(handlers);
}

// ==================== 路由入口 ====================

/**
 * 解析并执行 `/wm <命令> [args...]` 字符串
 */
export async function dispatch(
  input: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return helpHandler([], ctx);
  }

  // 去除 /wm 前缀（若存在）
  const cleaned = trimmed.replace(/^\/wm\s*/i, '');
  const tokens = cleaned.split(/\s+/);
  const command = tokens[0]?.toLowerCase();
  const args = tokens.slice(1);

  const handler = handlers[command];
  if (!handler) {
    return {
      success: false,
      message: `未知命令: ${command}。输入 /wm help 查看可用命令。`,
    };
  }

  try {
    return await handler(args, ctx);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `命令执行失败: ${msg}` };
  }
}

// ==================== 各命令实现 ====================

// ---- /wm help ----
const helpHandler: CommandHandler = async () => {
  const text = `
W-Model AI Assistant Skill - 命令帮助
======================================

核心命令：
  /wm analyze <需求描述>              需求分析，同步产出验收测试设计
  /wm design type=<架构|概要|详细>     设计阶段，同步产出对应测试设计
  /wm code <功能描述>                  编码实现，同步产出单元测试用例（不自动标记通过）
  /wm test type=<单元|集成|系统|验收> [result=pass|fail]
                                      查询测试状态或回填真实执行结果
  /wm review <目标ID或文件路径>        LLM-as-a-Verifier 验证（连续评分+置信度）
  /wm status                           查看当前阶段、进度、RTM 覆盖率

辅助命令：
  /wm help                             显示本帮助
  /wm reset                            重置项目状态（保留项目元信息，清空实体）
  /wm export [输出目录]                导出项目 JSON 与 RTM Markdown
  /wm import <文件路径>                从 JSON 导入项目

阶段对应表（W 模型并行原则）：
  需求分析 → 验收测试设计
  系统设计 → 系统测试设计
  概要设计 → 集成测试设计
  详细设计 → 单元测试设计
  编码实现 → 单元测试执行
  集成测试 → 集成测试执行
  系统测试 → 系统测试执行
  验收测试 → 验收测试执行
`.trim();
  return { success: true, message: text };
};
registerCommand('help', helpHandler);

// ---- /wm analyze ----
registerCommand('analyze', async (args, ctx) => {
  await ensureProject(ctx);
  const description = args.join(' ').trim();
  if (!description) {
    return { success: false, message: '用法: /wm analyze <需求描述>' };
  }

  const phase = ctx.projectState.getProject().status;
  if (phase !== '需求分析') {
    return {
      success: false,
      message: `当前阶段为「${phase}」，无法执行需求分析。如需重新分析，请先 /wm reset。`,
    };
  }

  // 登记需求
  const title = description.slice(0, 40) + (description.length > 40 ? '...' : '');
  const requirement = await ctx.projectState.addRequirement({
    title,
    description,
    type: '功能需求',
    priority: '中',
    acceptanceCriteria: [], // 由上游 AI 解析后填充
    testCases: [],
  });

  // 同步生成验收测试用例占位（W 模型并行原则）
  const acceptanceTest = await ctx.projectState.addTestCase({
    type: '验收测试',
    title: `${requirement.id} 验收测试`,
    description: `针对需求 ${requirement.id} 的验收测试场景`,
    steps: [],
    expectedResult: '系统行为符合需求规格说明书',
    priority: requirement.priority,
    requirementId: requirement.id,
  });

  // 关联需求与测试用例
  await ctx.projectState.updateRequirement(requirement.id, {
    testCases: [acceptanceTest.id],
  });

  // 重建 RTM
  await ctx.rtm.rebuild();
  await ctx.rtm.logChange(`新增需求 ${requirement.id}`, [requirement.id]);

  // 可选：调用 verifier 验证需求质量
  let verification: VerificationResult | undefined;
  if (ctx.verifier) {
    verification = await ctx.verifier.verifyRequirement(requirement);
  }

  const verifyMsg = verification
    ? `\n需求质量验证: ${verification.finalScore.toFixed(1)}/20 (${verification.qualityLevel}, 置信度 ${(verification.confidence * 100).toFixed(0)}%)`
    : '';

  return {
    success: true,
    message:
      `【需求分析】阶段完成\n` +
      `  需求 ID: ${requirement.id}\n` +
      `  标题: ${title}\n` +
      `  同步产出验收测试: ${acceptanceTest.id}\n` +
      `  RTM 已登记（覆盖率: ${ctx.rtm.getCoveragePercent()}%）${verifyMsg}\n` +
      `  下一步: /wm design type=架构`,
    artifacts: [],
    data: { requirement, acceptanceTest, verification },
  };
});

// ---- /wm design ----
registerCommand('design', async (args, ctx) => {
  await ensureProject(ctx);
  const typeArg = args.find(a => a.startsWith('type='));
  const typeRaw = typeArg ? typeArg.split('=')[1] : '架构';

  // 映射 type 到 W 模型阶段与同步测试类型
  const mapping: Record<string, { phase: ProjectPhase; designType: DesignType; testType: TestCaseType }> = {
    '架构': { phase: '系统设计', designType: '系统设计', testType: '系统测试' },
    '系统': { phase: '系统设计', designType: '系统设计', testType: '系统测试' },
    '概要': { phase: '概要设计', designType: '概要设计', testType: '集成测试' },
    '详细': { phase: '详细设计', designType: '详细设计', testType: '单元测试' },
  };
  const m = mapping[typeRaw];
  if (!m) {
    return { success: false, message: `无效 type: ${typeRaw}。可选: 架构 / 概要 / 详细` };
  }

  const currentPhase = ctx.projectState.getProject().status;
  if (currentPhase !== m.phase) {
    // 自动推进阶段（仅当前一阶段匹配时）
    const phaseOrder: ProjectPhase[] = ['需求分析', '系统设计', '概要设计', '详细设计', '编码'];
    const currentIdx = phaseOrder.indexOf(currentPhase);
    const targetIdx = phaseOrder.indexOf(m.phase);
    if (targetIdx !== currentIdx + 1) {
      return {
        success: false,
        message: `当前阶段为「${currentPhase}」，无法直接进入「${m.phase}」。`,
      };
    }
    await ctx.projectState.advanceTo(m.phase);
  }

  // 登记设计文档
  const design = await ctx.projectState.addDesign({
    type: m.designType,
    content: `# ${m.designType}文档\n\n（由上游 AI 填充）`,
    diagrams: [],
    testCases: [],
  });

  // 关联已有需求（取第一个，保证 RTM 双向追溯）
  const reqs = ctx.projectState.getRequirements();
  const linkedReqId = reqs.length > 0 ? reqs[0].id : undefined;

  // 同步生成对应测试用例（W 模型并行原则）
  const testCase = await ctx.projectState.addTestCase({
    type: m.testType,
    title: `${design.id} ${m.testType}用例`,
    description: `针对 ${m.designType} 的${m.testType}场景`,
    steps: [],
    expectedResult: `${m.testType}通过`,
    priority: '中',
    designId: design.id,
    requirementId: linkedReqId,
  });

  await ctx.projectState.updateDesign(design.id, { testCases: [testCase.id] });
  await ctx.rtm.rebuild();
  await ctx.rtm.logChange(`新增${m.designType}: ${design.id}`, linkedReqId ? [linkedReqId] : []);

  let verification: VerificationResult | undefined;
  if (ctx.verifier) {
    verification = await ctx.verifier.verifyDesign(design);
  }

  const verifyMsg = verification
    ? `\n设计质量验证: ${verification.finalScore.toFixed(1)}/20 (${verification.qualityLevel}, 置信度 ${(verification.confidence * 100).toFixed(0)}%)`
    : '';

  return {
    success: true,
    message:
      `【${m.phase}】阶段完成\n` +
      `  设计 ID: ${design.id}\n` +
      `  同步产出${m.testType}用例: ${testCase.id}${verifyMsg}\n` +
      `  RTM 已更新（覆盖率: ${ctx.rtm.getCoveragePercent()}%）\n` +
      `  下一步: ${m.designType === '系统设计' ? '/wm design type=概要' : m.designType === '概要设计' ? '/wm design type=详细' : '/wm code <功能>'}`,
    data: { design, testCase, verification },
  };
});

// ---- /wm code ----
registerCommand('code', async (args, ctx) => {
  await ensureProject(ctx);
  const feature = args.join(' ').trim();
  if (!feature) {
    return { success: false, message: '用法: /wm code <功能描述>' };
  }

  const phase = ctx.projectState.getProject().status;
  if (phase !== '详细设计' && phase !== '编码') {
    return {
      success: false,
      message: `当前阶段为「${phase}」，需先完成详细设计。`,
    };
  }
  if (phase === '详细设计') {
    await ctx.projectState.advanceTo('编码');
  }

  // 登记代码模块（从 feature 中提取文件名样式的模块名）
  const moduleName = extractModuleName(feature);

  // 关联已有需求 / 设计（保证 RTM 双向追溯）
  const reqs = ctx.projectState.getRequirements();
  const linkedReqId = reqs.length > 0 ? reqs[0].id : undefined;
  const designs = ctx.projectState.getDesigns('详细设计');
  const linkedDesignId = designs.length > 0 ? designs[0].id : undefined;

  // 同步生成单元测试用例（W 模型并行原则：详细设计产出用例 → 编码阶段执行）
  // 注意：不自动标记为通过——真实测试结果须由上游 AI 执行真实测试后通过
  //       /wm test type=单元 result=pass|fail 回填，否则质量门保持未通过。
  const unitTest = await ctx.projectState.addTestCase({
    type: '单元测试',
    title: `${moduleName} 单元测试`,
    description: `针对 ${moduleName}.ts 的单元测试，覆盖 ${feature}`,
    steps: [],
    expectedResult: '所有断言通过',
    priority: '高',
    requirementId: linkedReqId,
    designId: linkedDesignId,
  });

  await ctx.rtm.rebuild();
  await ctx.rtm.logChange(`新增代码模块: ${moduleName}`, linkedReqId ? [linkedReqId] : []);

  const unitCases = ctx.projectState.getTestCases('单元测试');
  const unitPassed = unitCases.filter(t => t.status === '通过').length;
  const unitPending = unitCases.filter(t => t.status === '待执行').length;

  return {
    success: true,
    message:
      `【编码实现】完成\n` +
      `  功能: ${feature}\n` +
      `  代码模块: ${moduleName}\n` +
      `  单元测试: ${unitPassed}/${unitCases.length} 通过，${unitPending} 个待执行\n` +
      `  ⚠️ 单元测试需上游 AI 真实执行后回填结果: /wm test type=单元 result=pass|fail\n` +
      `  RTM 已更新（覆盖率: ${ctx.rtm.getCoveragePercent()}%）\n` +
      `  下一步: /wm test type=单元 result=pass（回填后）/wm test type=集成`,
    data: { moduleName, unitTest },
  };
});

// ---- /wm test ----
// 行为说明（修正占位实现）：
//   - 不再批量将测试用例自动标记为「通过」。
//   - 上游 AI / 测试运行器真实执行测试后，通过 result=pass|fail 回填结果。
//   - 未提供 result 时，仅推进阶段并报告当前执行状态（待执行的用例将阻塞质量门）。
registerCommand('test', async (args, ctx) => {
  await ensureProject(ctx);
  const typeArg = args.find(a => a.startsWith('type='));
  const typeRaw = typeArg ? typeArg.split('=')[1] : '';
  const resultArg = args.find(a => a.startsWith('result='));
  const resultRaw = resultArg ? resultArg.split('=')[1]?.toLowerCase() : undefined;

  const typeMap: Record<string, { phase: ProjectPhase; testType: TestCaseType }> = {
    '单元': { phase: '编码', testType: '单元测试' },
    '集成': { phase: '集成测试', testType: '集成测试' },
    '系统': { phase: '系统测试', testType: '系统测试' },
    '验收': { phase: '验收测试', testType: '验收测试' },
  };
  const m = typeMap[typeRaw];
  if (!m) {
    return { success: false, message: `无效 type: ${typeRaw}。可选: 单元 / 集成 / 系统 / 验收` };
  }

  // 校验 result 参数
  if (resultRaw !== undefined && resultRaw !== 'pass' && resultRaw !== 'fail') {
    return { success: false, message: `无效 result: ${resultRaw}。可选: pass / fail（省略则仅查询状态）` };
  }

  const phase = ctx.projectState.getProject().status;
  // 集成 / 系统 / 验收测试需要先推进阶段
  if (m.phase !== '编码' && phase !== m.phase) {
    const phaseOrder: ProjectPhase[] = ['需求分析', '系统设计', '概要设计', '详细设计', '编码', '集成测试', '系统测试', '验收测试'];
    const currentIdx = phaseOrder.indexOf(phase);
    const targetIdx = phaseOrder.indexOf(m.phase);
    if (targetIdx === currentIdx + 1) {
      await ctx.projectState.advanceTo(m.phase);
    } else {
      return {
        success: false,
        message: `当前阶段为「${phase}」，无法执行${m.testType}。`,
      };
    }
  }

  const cases = ctx.projectState.getTestCases(m.testType);
  if (cases.length === 0) {
    return {
      success: false,
      message: `没有${m.testType}用例可执行。请先通过 /wm design 或 /wm code 生成测试用例。`,
    };
  }

  // 仅在显式提供 result 时回填真实执行结果；否则保持「待执行」状态。
  if (resultRaw === 'pass') {
    for (const tc of cases) {
      if (tc.status === '待执行') {
        await ctx.projectState.updateTestCaseStatus(tc.id, '通过');
      }
    }
  } else if (resultRaw === 'fail') {
    for (const tc of cases) {
      if (tc.status === '待执行') {
        await ctx.projectState.updateTestCaseStatus(tc.id, '失败');
      }
    }
  }

  await ctx.rtm.rebuild();

  const summary = ctx.rtm.getMatrix().executionSummary[
    m.testType === '单元测试' ? 'unitTest'
    : m.testType === '集成测试' ? 'integrationTest'
    : m.testType === '系统测试' ? 'systemTest'
    : 'acceptanceTest'
  ];

  const pendingNote = summary.pending > 0
    ? `\n  ⚠️ ${summary.pending} 个用例待执行，将阻塞质量门。回填结果: /wm test type=${typeRaw} result=pass|fail`
    : '';

  // 质量门检查（仅验收阶段）
  if (m.phase === '验收测试') {
    const gate = ctx.rtm.isQualityGatePassed();
    if (gate.passed) {
      return {
        success: true,
        message:
          `【验收测试】执行完成\n` +
          `  通过 ${summary.passed}/${cases.length}\n` +
          `  ✅ 质量门通过！项目可交付。\n` +
          `  RTM 覆盖率: ${ctx.rtm.getCoveragePercent()}%`,
        data: { summary, qualityGate: gate },
      };
    } else {
      return {
        success: false,
        message:
          `【验收测试】执行完成但质量门未通过\n` +
          `  通过 ${summary.passed}/${cases.length}\n` +
          `  ❌ 原因:\n    - ${gate.reasons.join('\n    - ')}\n` +
          `  请返工后重新执行。`,
        data: { summary, qualityGate: gate },
      };
    }
  }

  return {
    success: true,
    message:
      `【${m.testType}】${resultRaw ? '结果已回填' : '状态查询'}\n` +
      `  通过 ${summary.passed}/${cases.length}，失败 ${summary.failed}，待执行 ${summary.pending}（覆盖率 ${summary.coverage}%）${pendingNote}\n` +
      `  下一步: ${m.testType === '单元测试' ? '/wm test type=集成' : m.testType === '集成测试' ? '/wm test type=系统' : '/wm test type=验收'}`,
    data: { summary },
  };
});

// ---- /wm review ----
registerCommand('review', async (args, ctx) => {
  await ensureProject(ctx);
  const target = args.join(' ').trim();
  if (!target) {
    return { success: false, message: '用法: /wm review <需求ID|设计ID|测试用例ID|文件路径>' };
  }

  if (!ctx.verifier) {
    return { success: false, message: '未配置 LLM Verifier，无法执行审查。' };
  }

  // 尝试匹配实体
  const req = ctx.projectState.getRequirement(target);
  if (req) {
    const result = await ctx.verifier.verifyRequirement(req);
    return formatReviewResult('需求', target, result);
  }

  const designs = ctx.projectState.getDesigns();
  const design = designs.find(d => d.id === target);
  if (design) {
    const result = await ctx.verifier.verifyDesign(design);
    return formatReviewResult('设计', target, result);
  }

  const testCases = ctx.projectState.getTestCases();
  const tc = testCases.find(t => t.id === target);
  if (tc) {
    const result = await ctx.verifier.verifyTestCaseQuality(tc);
    return formatReviewResult('测试用例', target, result);
  }

  // 退化：当作文件路径，调用通用 score
  try {
    const content = await fs.readFile(target, 'utf-8');
    const score = await ctx.verifier.score({ content, path: target }, '评估文件内容质量');
    const { WModelVerifierEnhancer } = await import('../core/w-model-enhancer');
    return formatReviewResult('文件', target, {
      finalScore: score,
      subScores: {},
      confidence: 0,
      qualityLevel: WModelVerifierEnhancer.determineQualityLevel(score),
    });
  } catch {
    return { success: false, message: `未找到目标: ${target}` };
  }
});

// ---- /wm status ----
registerCommand('status', async (_args, ctx) => {
  const store = await ctx.projectState.load();
  if (!store) {
    return {
      success: true,
      message: '尚未初始化项目。请使用 /wm analyze <需求描述> 开始需求分析。',
    };
  }

  const progress = ctx.projectState.getProgress();
  const rtm = await ctx.rtm.load();
  const rtmCoverage = rtm ? ctx.rtm.getCoveragePercent() : 0;
  const gate = rtm ? ctx.rtm.isQualityGatePassed() : { passed: false, reasons: ['RTM 未初始化'] };

  const summary = rtm ? rtm.executionSummary : null;

  const lines: string[] = [];
  lines.push('=== 项目状态 ===');
  lines.push(`项目: ${store.project.name} (${store.project.id})`);
  lines.push(`当前阶段: ${progress.phase} (${progress.index + 1}/${progress.total}, ${progress.percent}%)`);
  lines.push(`需求: ${store.requirements.length}  设计: ${store.designs.length}  测试用例: ${store.testCases.length}`);
  lines.push(`RTM 覆盖率: ${rtmCoverage}%`);
  if (summary) {
    lines.push(`测试汇总:`);
    lines.push(`  单元: ${summary.unitTest.passed}/${summary.unitTest.total}  集成: ${summary.integrationTest.passed}/${summary.integrationTest.total}`);
    lines.push(`  系统: ${summary.systemTest.passed}/${summary.systemTest.total}  验收: ${summary.acceptanceTest.passed}/${summary.acceptanceTest.total}`);
  }
  lines.push(`质量门: ${gate.passed ? '✅ 通过' : '❌ 未通过'}`);
  if (!gate.passed) {
    lines.push(`  原因:`);
    for (const r of gate.reasons) lines.push(`    - ${r}`);
  }
  lines.push(`最后更新: ${store.project.updatedAt.slice(0, 19).replace('T', ' ')}`);

  return { success: true, message: lines.join('\n') };
});

// ---- /wm reset ----
registerCommand('reset', async (_args, ctx) => {
  const store = await ctx.projectState.load();
  if (!store) {
    return { success: false, message: '尚无项目可重置。' };
  }
  await ctx.projectState.reset();
  await ctx.rtm.rebuild();
  return {
    success: true,
    message: `项目已重置。需求 / 设计 / 测试用例已清空，阶段回到「需求分析」。`,
  };
});

// ---- /wm export ----
registerCommand('export', async (args, ctx) => {
  const store = await ctx.projectState.load();
  if (!store) {
    return { success: false, message: '尚无项目可导出。' };
  }
  const outDir = args[0] ?? path.join(ctx.cwd, '.w-model', 'exports');
  await fs.mkdir(outDir, { recursive: true });

  const projectFile = path.join(outDir, `project-${store.project.id}.json`);
  const rtmFile = path.join(outDir, `rtm-${store.project.id}.md`);

  await fs.writeFile(projectFile, ctx.projectState.exportJSON(), 'utf-8');
  await ctx.rtm.exportMarkdown(rtmFile);

  return {
    success: true,
    message: `已导出:\n  项目 JSON: ${projectFile}\n  RTM Markdown: ${rtmFile}`,
    artifacts: [projectFile, rtmFile],
  };
});

// ---- /wm import ----
registerCommand('import', async (args, ctx) => {
  const file = args[0];
  if (!file) {
    return { success: false, message: '用法: /wm import <文件路径>' };
  }
  const raw = await fs.readFile(file, 'utf-8');
  const store = await ctx.projectState.importJSON(raw);
  await ctx.rtm.rebuild();
  const reqIds = store.requirements.slice(0, 3).map(r => r.id).join(', ');
  return {
    success: true,
    message:
      `已导入项目: ${store.project.name} (${store.project.id})\n` +
      `  当前阶段: ${store.project.status}\n` +
      `  需求 ${store.requirements.length} / 设计 ${store.designs.length} / 测试 ${store.testCases.length}` +
      (reqIds ? `\n  需求 ID: ${reqIds}` : ''),
  };
});

// ==================== 辅助函数 ====================

/**
 * 从 feature 描述中提取代码模块名。
 * 优先匹配文件路径样式（如 userService.ts），其次取首个纯 ASCII 单词，最后兜底 module。
 */
function extractModuleName(feature: string): string {
  // 1. 匹配文件名样式：xxx.ts / xxx.js / xxx.py / xxx.go / xxx.java
  const fileMatch = feature.match(/([\w-]+\.(?:ts|js|py|go|java))/);
  if (fileMatch) return fileMatch[1];
  // 2. 取首个纯 ASCII 单词（去除中文等非 ASCII 字符）
  const asciiWord = feature.split(/\s+/).find(w => /^[\w-]+$/.test(w));
  if (asciiWord) return asciiWord;
  // 3. 兜底
  return 'module';
}

async function ensureProject(ctx: CommandContext): Promise<void> {
  const store = await ctx.projectState.load();
  if (!store) {
    // 自动初始化空项目
    await ctx.projectState.init(
      '未命名项目',
      '由 /wm 命令自动创建',
      { frontend: [], backend: [], database: [], others: [] }
    );
  }
}

function formatReviewResult(kind: string, target: string, result: VerificationResult): CommandResult {
  const lines: string[] = [];
  lines.push(`=== ${kind}审查报告: ${target} ===`);
  lines.push(`综合分数: ${result.finalScore.toFixed(2)} / 20`);
  lines.push(`质量等级: ${result.qualityLevel}`);
  lines.push(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
  if (result.fallbackUsed) {
    lines.push(`⚠️ LLM 不支持 logits，已使用 fallback 路径评分`);
  }
  if (Object.keys(result.subScores).length > 0) {
    lines.push(`子标准评分:`);
    for (const [k, v] of Object.entries(result.subScores)) {
      lines.push(`  ${k}: ${v.toFixed(2)}`);
    }
  }
  return { success: true, message: lines.join('\n'), data: result };
}
