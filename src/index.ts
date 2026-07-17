/**
 * W-Model AI Assistant Skill - 实现入口
 *
 * 本技能遵循「技能包只包含提示词、参考、模板，脚本只做门禁」的架构原则：
 *   - 不内置 LLM 调用。LLM-as-a-Verifier 评审由外部 Agent 按提示词执行，
 *     详见 w-model-dev/references/verifier-spec.md；
 *     评审输出结构的防漂移校验由 w-model-dev/scripts/check-verifier-output.ts 完成。
 *   - 不内置技能演化与轨迹分析。技能自演化由外部工具完成：
 *       · SkillOpt（微软）  https://github.com/microsoft/SkillOpt
 *       · darwin-skill       https://github.com/alchaincyf/darwin-skill
 *
 * 提供两类公共 API：
 *   1. 项目状态与 RTM 管理（project-state / rtm-manager）—— 工件质量门数据来源
 *   2. /wm 命令路由（commands/router）—— 阶段推进与工件质量门判定
 *
 * 对应设计：
 *   - SSoT: docs/skill-design-document_SSoT.md
 *   - SKILL: w-model-dev/SKILL.md（编排逻辑）
 *   - Verifier 规范: w-model-dev/references/verifier-spec.md
 */

// ==================== 状态管理 ====================
export {
  ProjectStateManager,
  type ProjectStore,
} from './state/project-state';
export { RTMManager } from './state/rtm-manager';

// ==================== 命令路由 ====================
export {
  dispatch,
  registerCommand,
  getCommandNames,
} from './commands/router';

// ==================== 类型 ====================
export type * from './types';

// ==================== 工厂函数 ====================

import { ProjectStateManager } from './state/project-state';
import { RTMManager } from './state/rtm-manager';
import type { CommandContext } from './types';

/**
 * 创建默认命令上下文（用于即装即用的 CLI / Agent 接入）
 *
 * 本技能不内置 LLM 调用：
 *   - 阶段产物的 LLM-as-a-Verifier 评审由外部 Agent 按提示词执行
 *     （见 w-model-dev/references/verifier-spec.md），评审输出可由
 *     w-model-dev/scripts/check-verifier-output.ts 做结构化校验防漂移。
 *   - 技能自演化与轨迹分析不在技能内，由外部 skillopt / darwin-skill 完成。
 *
 * @param cwd 工作目录（项目根）
 */
export async function createCommandContext(
  cwd: string
): Promise<CommandContext> {
  const projectState = new ProjectStateManager(cwd);
  await projectState.load();
  const rtm = new RTMManager(cwd, projectState);

  return { projectState, rtm, cwd };
}
