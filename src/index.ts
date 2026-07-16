/**
 * W-Model AI Assistant Skill - 实现入口
 *
 * 提供三类公共 API：
 *   1. LLM-as-a-Verifier 核心引擎（scoring-engine / verification-framework / ppt-ranker / w-model-enhancer）
 *   2. 项目状态与 RTM 管理（project-state / rtm-manager）
 *   3. /wm 命令路由（commands/router）
 *
 * 对应设计：
 *   - SSoT: skill-design-document_SSoT.md
 *   - SKILL: w-model-dev/SKILL.md
 *   - 集成设计: llm-verifier-integration-design.md
 */

// ==================== 核心引擎 ====================
export { LLMVerifierEngine } from './core/scoring-engine';
export { VerificationFramework, determineQualityLevel } from './core/verification-framework';
export { PPTRanker } from './core/ppt-ranker';
export { WModelVerifierEnhancer } from './core/w-model-enhancer';
export {
  BaseLLMClient,
  MockLLMClient,
  HttpLLMClient,
  createLLMClient,
} from './core/llm-client';

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
import { WModelVerifierEnhancer } from './core/w-model-enhancer';
import { MockLLMClient } from './core/llm-client';
import type { CommandContext, VerifierConfig } from './types';

/**
 * 创建默认命令上下文（用于即装即用的 CLI / Agent 接入）
 *
 * @param cwd 工作目录（项目根）
 * @param verifierConfig 可选的 Verifier 配置；不传则使用 Mock LLM（开箱即用，无需 API key）
 */
export async function createCommandContext(
  cwd: string,
  verifierConfig?: VerifierConfig
): Promise<CommandContext> {
  const projectState = new ProjectStateManager(cwd);
  await projectState.load();
  const rtm = new RTMManager(cwd, projectState);

  let verifier: WModelVerifierEnhancer | undefined;
  if (verifierConfig) {
    verifier = new WModelVerifierEnhancer(verifierConfig, new MockLLMClient(verifierConfig.llm));
  }

  return { projectState, rtm, verifier, cwd };
}
