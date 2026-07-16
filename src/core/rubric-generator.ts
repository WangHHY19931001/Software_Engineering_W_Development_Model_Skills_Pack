/**
 * 自适应 Rubric 生成器
 *
 * 输入 (type, taskDescription)，调用 LLM 生成 N 个正交维度 + 5 级评分标准 + 权重 + minThreshold。
 * 失败时回退到与 w-model-enhancer.ts 硬编码一致的 subCriteria。
 *
 * 参考：AdaRubric (arXiv:2603.21362) 任务自适应 rubric。
 */

import type { LLMClient, SubCriterion } from '../types';

export type RubricType = 'requirement' | 'design' | 'testcase';

export interface RubricGeneratorConfig {
  llm: LLMClient;
  dimensions: number;
  minThresholdDefault: number;
  cache: boolean;
}

export interface GenerateResult {
  subCriteria: SubCriterion[];
  fallback: boolean;
}

export class RubricGenerator {
  private cache = new Map<string, GenerateResult>();

  constructor(private readonly config: RubricGeneratorConfig) {}

  async generate(type: RubricType, taskDescription: string): Promise<GenerateResult> {
    const key = `${type}:${hash(taskDescription)}`;
    if (this.config.cache) {
      const cached = this.cache.get(key);
      if (cached) return cached;
    }

    try {
      const subCriteria = await this.generateFromLLM(type, taskDescription);
      const result: GenerateResult = { subCriteria, fallback: false };
      if (this.config.cache) this.cache.set(key, result);
      return result;
    } catch {
      // 回退硬编码
      const result: GenerateResult = { subCriteria: hardcodedRubric(type), fallback: true };
      if (this.config.cache) this.cache.set(key, result);
      return result;
    }
  }

  private async generateFromLLM(type: RubricType, taskDescription: string): Promise<SubCriterion[]> {
    const prompt = this.buildPrompt(type, taskDescription, this.config.dimensions);
    const response = await this.config.llm.generate(prompt);
    const parsed = JSON.parse(response.text);
    if (!parsed || !Array.isArray(parsed.dimensions)) {
      throw new Error('Invalid rubric JSON: missing dimensions array');
    }

    const raw = parsed.dimensions.slice(0, this.config.dimensions);
    if (raw.length === 0) throw new Error('No dimensions returned');

    // 归一化权重
    const totalWeight = raw.reduce((s: number, d: any) => s + (Number(d.weight) || 0), 0);
    const normFactor = totalWeight > 0 ? 1 / totalWeight : 1 / raw.length;

    return raw.map((d: any) => ({
      id: String(d.id ?? `dim-${Math.random().toString(36).slice(2, 8)}`),
      description: String(d.description ?? ''),
      scoringPrompt: String(d.scoringPrompt ?? d.description ?? ''),
      weight: (Number(d.weight) || 0) * normFactor,
      minThreshold: Number(d.minThreshold) || this.config.minThresholdDefault,
      levelDescriptors: Array.isArray(d.levelDescriptors) ? d.levelDescriptors.map(String) : undefined,
      taskAdaptive: true,
    }));
  }

  private buildPrompt(type: RubricType, taskDescription: string, n: number): string {
    const typeLabel = type === 'requirement' ? '需求规格说明书' : type === 'design' ? '设计文档' : '测试用例';
    return `你是验证 rubric 生成器。为以下${typeLabel}生成 ${n} 个正交的评估维度。

任务描述：${taskDescription}

要求：
- 维度之间正交，不重叠
- 每个维度含 id（英文 kebab-case）、description、scoringPrompt（含1-20分评分指引）、weight（0-1，总和为1）、minThreshold（1-20等价分数，低于此值视为该维度失败）、levelDescriptors（5级描述）
- 输出严格 JSON，不要 markdown 代码块

输出格式：
{"dimensions":[{"id":"...","description":"...","scoringPrompt":"...","weight":0.2,"minThreshold":10,"levelDescriptors":["差","较差","一般","良好","优秀"]}]}`
      .trim();
  }
}

/** 硬编码 rubric，与 w-model-enhancer.ts 保持一致（作为 fallback） */
function hardcodedRubric(type: RubricType): SubCriterion[] {
  switch (type) {
    case 'requirement':
      return [
        { id: 'completeness', description: '需求描述完整性', scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)', weight: 0.25 },
        { id: 'clarity', description: '验收标准清晰度', scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)', weight: 0.20 },
        { id: 'consistency', description: '需求内部一致性', scoringPrompt: '评估需求内部是否存在冲突或矛盾(1-20分)', weight: 0.20 },
        { id: 'traceability', description: '需求可追溯性', scoringPrompt: '评估需求的可追溯性和可追踪性(1-20分)', weight: 0.20 },
        { id: 'feasibility', description: '技术可行性', scoringPrompt: '评估需求的技术实现可行性(1-20分)', weight: 0.15 },
      ];
    case 'design':
      return [
        { id: 'arch-clarity', description: '架构设计清晰度', scoringPrompt: '评估架构设计的清晰度、模块划分合理性、技术选型依据充分性(1-20分)', weight: 0.20 },
        { id: 'interface-completeness', description: '接口定义完整性', scoringPrompt: '评估接口定义的完整性、参数明确性、异常处理覆盖度(1-20分)', weight: 0.20 },
        { id: 'scalability', description: '可扩展性设计', scoringPrompt: '评估设计的可扩展性、扩展点预留、耦合度合理性(1-20分)', weight: 0.15 },
        { id: 'performance', description: '性能考虑', scoringPrompt: '评估性能瓶颈识别、优化方案、数据库设计、缓存策略(1-20分)', weight: 0.15 },
        { id: 'security', description: '安全性设计', scoringPrompt: '评估安全风险识别、防护措施、数据加密、权限控制(1-20分)', weight: 0.15 },
        { id: 'testability', description: '可测试性', scoringPrompt: '评估单元测试便利性、mock支持、数据隔离、测试环境设计(1-20分)', weight: 0.15 },
      ];
    case 'testcase':
      return [
        { id: 'coverage', description: '覆盖完整性', scoringPrompt: '评估测试场景覆盖的完整性和全面性(1-20分)', weight: 0.25 },
        { id: 'boundary-handling', description: '边界条件处理', scoringPrompt: '评估边界条件和极端场景的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'exception-handling', description: '异常场景覆盖', scoringPrompt: '评估异常场景和错误处理的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'clarity', description: '测试步骤清晰度', scoringPrompt: '评估测试步骤描述的清晰度和可操作性(1-20分)', weight: 0.15 },
        { id: 'maintainability', description: '可维护性', scoringPrompt: '评估测试用例的可维护性和易修改性(1-20分)', weight: 0.20 },
      ];
  }
}

/** 稳定哈希（FNV-1a 简化版），用于缓存 key */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
