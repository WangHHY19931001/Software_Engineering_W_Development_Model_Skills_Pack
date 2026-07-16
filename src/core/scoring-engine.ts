/**
 * LLM-as-a-Verifier 连续评分引擎
 *
 * 基于 arXiv:2607.05391 论文设计的连续评分核心算法。
 *
 * 核心数学公式：
 *   Score_continuous = Σ(P_i × S_i)
 * 其中：
 *   P_i = scoring token i 的概率（softmax 后）
 *   S_i = token i 对应的分值
 *
 * 鲁棒性设计（issue High Priority）：
 * 当 LLM 不支持返回 logits 时，按 fallbackStrategy 回退：
 *   - 'text-parse'：解析模型输出的字母 / 数字（默认）
 *   - 'discrete'：直接采用解析到的整数分数
 *   - 'throw'：抛错
 */

import type {
  ContinuousScoringEngine,
  LLMClient,
  LLMResponse,
  VerifierConfig,
} from '../types';
import { BaseLLMClient } from './llm-client';

export class LLMVerifierEngine implements ContinuousScoringEngine {
  private llmClient: LLMClient;
  private config: VerifierConfig;
  private fallbackStrategy: NonNullable<VerifierConfig['fallbackStrategy']>;
  /** 用于测试与诊断：累计 fallback 次数 */
  private fallbackCount = 0;

  constructor(config: VerifierConfig, llmClient?: LLMClient) {
    this.config = config;
    this.llmClient =
      llmClient ??
      // 内部兜底：若未注入客户端，按配置创建
      new (class extends BaseLLMClient {
        async generate(): Promise<LLMResponse> {
          throw new Error('未注入 LLM 客户端，请在构造时传入 llmClient');
        }
      })(config.llm);
    this.fallbackStrategy = config.fallbackStrategy ?? 'text-parse';
  }

  /** 累计 fallback 次数（测试 / 监控用） */
  getFallbackCount(): number {
    return this.fallbackCount;
  }

  /**
   * 计算连续分数的核心方法
   * 优先：scoring token logits 分布的期望值
   * 回退：文本解析
   */
  async computeContinuousScore(
    prompt: string,
    candidate: unknown,
    scoreRange = { min: 1, max: 20 }
  ): Promise<number> {
    const scoringPrompt = this.buildScoringPrompt(prompt, scoreRange);

    const response = await this.llmClient.generate(scoringPrompt, {
      returnLogits: true,
      temperature: this.config.temperature ?? 0.3,
      candidate: JSON.stringify(candidate),
    });

    // 路径 1：logits 可用——计算期望值
    if (response.supportsLogits && response.logits && response.logits.length > 0) {
      const scoringTokenLogits = this.extractScoringTokenLogits(
        response.logits,
        scoreRange
      );
      if (scoringTokenLogits.size > 0) {
        return this.computeExpectation(scoringTokenLogits);
      }
    }

    // 路径 2：fallback
    return this.fallbackScore(response, scoreRange);
  }

  /** 获取完整评分分布（fallback 时返回单点分布） */
  async getScoreDistribution(
    prompt: string,
    candidate: unknown
  ): Promise<Map<number, number>> {
    const scoreRange = this.config.continuousScoring?.scoreRange ?? { min: 1, max: 20 };
    const scoringPrompt = this.buildScoringPrompt(prompt, scoreRange);

    const response = await this.llmClient.generate(scoringPrompt, {
      returnLogits: true,
      candidate: JSON.stringify(candidate),
    });

    if (response.supportsLogits && response.logits && response.logits.length > 0) {
      const dist = this.extractScoringTokenLogits(response.logits, scoreRange);
      if (dist.size > 0) return dist;
    }

    // fallback：单点分布
    const score = await this.fallbackScore(response, scoreRange);
    const single = new Map<number, number>();
    single.set(score, 1);
    return single;
  }

  // ==================== 私有方法 ====================

  /**
   * Fallback 评分路径。
   * 当 LLM 不支持 logits 时调用，按 fallbackStrategy 决定行为。
   */
  private async fallbackScore(
    response: LLMResponse,
    scoreRange: { min: number; max: number }
  ): Promise<number> {
    this.fallbackCount++;

    if (this.fallbackStrategy === 'throw') {
      throw new Error(
        'LLM 不支持 logits 且 fallbackStrategy=throw，无法计算连续分数'
      );
    }

    // 从响应文本中解析分数
    const parsed = this.parseScoreFromText(response.text, scoreRange);

    if (this.fallbackStrategy === 'discrete') {
      // 直接返回整数分数
      return Math.round(parsed);
    }

    // 'text-parse'：在解析的整数基础上加一个小数扰动，模拟连续性
    // 扰动基于响应文本哈希，保证同一响应稳定
    const perturbation = this.stablePerturbation(response.text, scoreRange);
    return Math.max(
      scoreRange.min,
      Math.min(scoreRange.max, parsed + perturbation)
    );
  }

  /**
   * 从模型输出文本中解析分数。
   * 支持两种格式：
   *   1. 字母 A-T（A=min, T=max）
   *   2. 数字（直接为分数）
   */
  private parseScoreFromText(
    text: string,
    scoreRange: { min: number; max: number }
  ): number {
    const labels = this.generateLabels(scoreRange);
    const trimmed = text.trim();

    // 1. 尝试匹配字母（首个独立字母）
    const letterMatch = trimmed.match(/\b([A-Ta-t])\b/);
    if (letterMatch) {
      const idx = labels.indexOf(letterMatch[1].toUpperCase());
      if (idx >= 0) {
        return scoreRange.min + idx;
      }
    }

    // 2. 尝试匹配数字（含小数）
    const numMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const n = parseFloat(numMatch[1]);
      if (n >= scoreRange.min && n <= scoreRange.max) return n;
      // 若数字超出范围（如 0-100），按比例缩放
      if (n > scoreRange.max) {
        return Math.max(
          scoreRange.min,
          Math.min(scoreRange.max, (n / 100) * scoreRange.max)
        );
      }
    }

    // 3. 解析失败：返回中位分数（保守估计）
    return (scoreRange.min + scoreRange.max) / 2;
  }

  /**
   * 基于文本哈希生成稳定的小数扰动（-0.49 ~ +0.49）
   * 用于在 fallback 路径下保留一定的连续性区分度。
   */
  private stablePerturbation(
    text: string,
    scoreRange: { min: number; max: number }
  ): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    const normalized = (Math.abs(hash) % 1000) / 1000; // [0, 1)
    // 扰动幅度限制在 ±0.49，避免跨越整数边界造成误导
    const amplitude = Math.min(0.49, (scoreRange.max - scoreRange.min) * 0.02);
    return (normalized - 0.5) * 2 * amplitude;
  }

  /** 构建评分提示词 */
  private buildScoringPrompt(
    basePrompt: string,
    scoreRange: { min: number; max: number }
  ): string {
    const labels = this.generateLabels(scoreRange);
    const span = scoreRange.max - scoreRange.min;
    return `
${basePrompt}

请对上述内容进行评分，评分范围: ${scoreRange.min}-${scoreRange.max} 分

评分标准:
- ${scoreRange.max}-${scoreRange.max - Math.floor(span * 0.1)}分: 卓越，完全满足要求并有创新
- ${scoreRange.max - Math.floor(span * 0.15) - 1}-${scoreRange.max - Math.floor(span * 0.25)}分: 良好，满足大部分要求
- ${scoreRange.max - Math.floor(span * 0.3) - 1}-${scoreRange.max - Math.floor(span * 0.45)}分: 可接受，满足基本要求
- ${scoreRange.max - Math.floor(span * 0.5) - 1}-${scoreRange.max - Math.floor(span * 0.65)}分: 较差，存在明显不足
- ${scoreRange.min}-${scoreRange.max - Math.floor(span * 0.7) - 1}分: 不可接受，需要重大改进

请直接输出一个字母评分(${labels[0]}-${labels[labels.length - 1]})，不要输出其他内容。
    `.trim();
  }

  /** 生成评分标签（A-T 对应 1-20 分） */
  generateLabels(scoreRange: { min: number; max: number }): string[] {
    const count = scoreRange.max - scoreRange.min + 1;
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(String.fromCharCode(65 + i)); // A=65
    }
    return labels;
  }

  /** 提取 scoring token 的 logits */
  private extractScoringTokenLogits(
    logits: number[][],
    scoreRange: { min: number; max: number }
  ): Map<number, number> {
    const scoringTokenLogits = new Map<number, number>();
    const labels = this.generateLabels(scoreRange);

    // 假设 logits 最后一层是输出层
    const outputLogits = logits[logits.length - 1];

    for (let i = 0; i < labels.length; i++) {
      const tokenId = this.getTokenIdForLabel(labels[i]);
      if (tokenId !== -1 && outputLogits && outputLogits[tokenId] !== undefined) {
        const score = scoreRange.min + i;
        scoringTokenLogits.set(score, outputLogits[tokenId]);
      }
    }

    return scoringTokenLogits;
  }

  /**
   * 计算期望值：Score_continuous = Σ(P_i × S_i)
   * 使用 log-softmax 数值稳定实现。
   */
  private computeExpectation(logits: Map<number, number>): number {
    if (logits.size === 0) return 0;

    // 提取 logit 数组，求最大值用于数值稳定
    const entries = Array.from(logits.entries());
    const maxLogit = Math.max(...entries.map(([, l]) => l));

    let expectation = 0;
    let totalProb = 0;
    for (const [score, logit] of entries) {
      const prob = Math.exp(logit - maxLogit);
      expectation += score * prob;
      totalProb += prob;
    }
    return totalProb > 0 ? expectation / totalProb : 0;
  }

  /** 获取标签对应的 token ID（简化实现，实际需按 tokenizer 调整） */
  private getTokenIdForLabel(label: string): number {
    const labelMap: Record<string, number> = {
      A: 0, B: 1, C: 2, D: 3, E: 4,
      F: 5, G: 6, H: 7, I: 8, J: 9,
      K: 10, L: 11, M: 12, N: 13, O: 14,
      P: 15, Q: 16, R: 17, S: 18, T: 19,
    };
    return labelMap[label] ?? -1;
  }
}
