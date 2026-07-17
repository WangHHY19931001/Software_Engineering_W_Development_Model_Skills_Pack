/**
 * SkillOptimizer —— SkillOpt ReflectTrainer 训练循环
 *
 * 对应 SSoT 第 14 章「技能演化机制」。
 *
 * 核心思想（来自微软 SkillOpt）：
 *   把技能文档（SKILL.md / references/ / MetaSkillConfig）视为可训练外部状态，
 *   通过 Rollout → Reflect → Edit → Gate 闭环优化，类似神经网络的训练循环：
 *     - 模型权重  ↔  技能文档（可训练状态）
 *     - forward   ↔  跑一次 /wm 全流程（Rollout）
 *     - loss      ↔  VerificationResult 分数 / 质量门失败原因
 *     - 梯度下降  ↔  optimizer LLM 产出 SkillEdit（add/delete/replace）
 *     - 学习率    ↔  editBudget（每轮最大字符编辑预算）
 *     - 验证集    ↔  留出 benchmark 项目集（heldOutTaskIds）
 *     - 动量      ↔  epoch 边界的纵向指导（写入 protected 区域之外）
 *
 * 关键约束（SkillsBench 实证）：
 *   模型自生成技能平均 -1.3pp，**必须**搭配验证门才能采纳候选。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  GateResult,
  LLMClient,
  MetaSkillConfig,
  RolloutEvidence,
  SkillEdit,
  SkillEvolutionConfig,
  VerificationResult,
} from '../types';
import type { VerifierConfig } from '../types';
import type { WModelVerifierEnhancer } from '../core/w-model-enhancer';
import {
  DEFAULT_META_SKILL_CONFIG,
  cloneMetaSkillConfig,
  validateMetaSkillConfig,
} from '../core/meta-skill-config';
// 技能验证门判定逻辑委托至技能包内脚本（单点事实源，与 CLI check-skill-gate.ts 共用）
import { checkSkillGate } from '../../w-model-dev/scripts/gate-logic.js';

/**
 * Rollout 执行器接口：跑一次 W 模型全流程并收集证据。
 *
 * 实现方可注入真实 dispatch 流程（src/commands/router.ts），
 * 也可注入 Mock 实现用于测试。
 */
export interface RolloutExecutor {
  /** 在指定任务上跑一次 /wm 全流程，返回证据 */
  run(taskId: string, metaSkill: MetaSkillConfig): Promise<RolloutEvidence>;
}

/**
 * Gate 评估器接口：在留出集上评估候选技能的 Skill Lift。
 * 由 src/eval/skill-lift.ts 实现。
 */
export interface GateEvaluator {
  /** 评估候选技能相对基线的 Skill Lift */
  evaluate(candidate: MetaSkillConfig, heldOutTaskIds: string[]): Promise<{
    skillLift: number;
    perTaskResults: Array<{ taskId: string; baselineMetric: number; candidateMetric: number }>;
  }>;
}

/** 训练日志条目 */
export interface TrainingLogEntry {
  epoch: number;
  phase: 'rollout' | 'reflect' | 'edit' | 'gate' | 'commit';
  timestamp: string;
  detail: string;
  metrics?: Record<string, number>;
}

/** 训练结果 */
export interface TrainingResult {
  /** 是否发生技能更新（至少一个候选通过 Gate） */
  updated: boolean;
  /** 最终采纳的配置（若 updated=false 则为初始配置） */
  finalConfig: MetaSkillConfig;
  /** 训练日志 */
  logs: TrainingLogEntry[];
  /** 各 epoch 的 Gate 结果 */
  gateResults: GateResult[];
}

export class SkillOptimizer {
  private config: SkillEvolutionConfig;
  private optimizerLLM: LLMClient;
  private rolloutExecutor: RolloutExecutor;
  private gateEvaluator: GateEvaluator;
  private logs: TrainingLogEntry[] = [];
  private evidenceBuffer: RolloutEvidence[] = [];

  constructor(opts: {
    config: SkillEvolutionConfig;
    optimizerLLM: LLMClient;
    rolloutExecutor: RolloutExecutor;
    gateEvaluator: GateEvaluator;
  }) {
    this.config = opts.config;
    this.optimizerLLM = opts.optimizerLLM;
    this.rolloutExecutor = opts.rolloutExecutor;
    this.gateEvaluator = opts.gateEvaluator;
  }

  /**
   * 执行完整训练循环。
   *
   * @param initialConfig 初始元技能配置（默认 DEFAULT_META_SKILL_CONFIG）
   */
  async train(initialConfig: MetaSkillConfig = DEFAULT_META_SKILL_CONFIG): Promise<TrainingResult> {
    let current = cloneMetaSkillConfig(initialConfig);
    const gateResults: GateResult[] = [];

    this.log(0, 'rollout', `开始训练，epochs=${this.config.epochs}，batchSize=${this.config.batchSize}`);

    for (let epoch = 1; epoch <= this.config.epochs; epoch++) {
      // ===== 1. Rollout：在训练集上跑 /wm 全流程 =====
      const trainTaskIds = await this.getTrainTaskIds(epoch);
      this.evidenceBuffer = [];
      for (const taskId of trainTaskIds) {
        const evidence = await this.rolloutExecutor.run(taskId, current);
        this.evidenceBuffer.push(evidence);
        this.log(epoch, 'rollout', `任务 ${taskId}：qualityGate=${evidence.qualityGatePassed}，覆盖率=${evidence.rtmCoverage}%，回退=${evidence.phaseRollbacks}`, {
          rtmCoverage: evidence.rtmCoverage,
          phaseRollbacks: evidence.phaseRollbacks,
        });
      }

      // ===== 2. Reflect：分离成功 / 失败 minibatch =====
      const failures = this.evidenceBuffer.filter(e => !e.qualityGatePassed || e.failedSubCriteria.length > 0);
      const successes = this.evidenceBuffer.filter(e => e.qualityGatePassed && e.failedSubCriteria.length === 0);

      this.log(epoch, 'reflect', `失败 ${failures.length} 条，成功 ${successes.length} 条`);

      if (failures.length === 0) {
        this.log(epoch, 'gate', '无失败样本，跳过本轮演化', { skillLift: 0 });
        continue;
      }

      // ===== 3. Edit：optimizer LLM 产出候选编辑 =====
      const candidate = await this.reflectAndEdit(current, failures, successes, epoch);

      // 校验候选配置合法性
      const validationErrors = validateMetaSkillConfig(candidate.config);
      if (validationErrors.length > 0) {
        this.log(epoch, 'edit', `候选配置校验失败：${validationErrors.join('; ')}`);
        continue;
      }

      // ===== 4. Gate：在留出集上测 Skill Lift =====
      const gateResult = await this.evaluateGate(candidate, epoch);
      gateResults.push(gateResult);

      // ===== 5. Commit：通过则更新当前配置 =====
      if (gateResult.accepted) {
        current = candidate.config;
        this.log(epoch, 'commit', `候选 ${candidate.id} 被采纳，skillLift=${gateResult.skillLift.toFixed(3)}`, {
          skillLift: gateResult.skillLift,
        });
      } else {
        this.log(epoch, 'gate', `候选 ${candidate.id} 被拒绝：${gateResult.rejectionReason}`, {
          skillLift: gateResult.skillLift,
        });
      }
    }

    const updated = gateResults.some(g => g.accepted);
    this.log(this.config.epochs, 'commit', `训练结束，updated=${updated}`);

    return {
      updated,
      finalConfig: current,
      logs: this.logs,
      gateResults,
    };
  }

  // ==================== Reflect & Edit ====================

  /**
   * Reflect：让 optimizer LLM 诊断失败 minibatch，产出 SkillEdit。
   * Edit：应用编辑到候选 MetaSkillConfig（受 editBudget 约束）。
   */
  private async reflectAndEdit(
    parent: MetaSkillConfig,
    failures: RolloutEvidence[],
    successes: RolloutEvidence[],
    epoch: number
  ): Promise<{ id: string; config: MetaSkillConfig; edits: SkillEdit[] }> {
    // 聚合失败子标准频率
    const failureFreq = new Map<string, number>();
    for (const f of failures) {
      for (const sc of f.failedSubCriteria) {
        failureFreq.set(sc, (failureFreq.get(sc) ?? 0) + 1);
      }
    }
    const topFailures = Array.from(failureFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => `${id}(×${count})`)
      .join(', ');

    // 构造 reflect prompt
    const reflectPrompt = this.buildReflectPrompt(parent, failures, successes, topFailures, epoch);
    const response = await this.optimizerLLM.generate(reflectPrompt, { temperature: 0.4, maxTokens: 2048 });

    // 解析 optimizer 输出为 SkillEdit 列表
    const edits = this.parseEdits(response.text, parent);

    // 应用编辑到候选配置（受 editBudget 约束）
    const candidate = cloneMetaSkillConfig(parent);
    let remainingBudget = this.config.editBudget;
    for (const edit of edits) {
      if (remainingBudget <= 0) break;
      if (edit.budgetCost > remainingBudget) continue;
      this.applyEdit(candidate, edit);
      remainingBudget -= edit.budgetCost;
    }

    return {
      id: `cand-epoch${epoch}-${crypto.randomBytes(4).toString('hex')}`,
      config: candidate,
      edits,
    };
  }

  /** 构造 reflect prompt：要求 optimizer 输出结构化编辑建议 */
  private buildReflectPrompt(
    parent: MetaSkillConfig,
    failures: RolloutEvidence[],
    successes: RolloutEvidence[],
    topFailures: string,
    epoch: number
  ): string {
    return `你是 W-Model AI Assistant Skill 的元技能优化器（SkillOpt ReflectTrainer）。

当前元技能配置（MetaSkillConfig v${parent.version}）：
${JSON.stringify(parent, null, 2)}

第 ${epoch} 轮训练的失败 minibatch（共 ${failures.length} 条）：
${JSON.stringify(failures.slice(0, 3).map(f => ({
  taskId: f.taskId,
  qualityGatePassed: f.qualityGatePassed,
  rtmCoverage: f.rtmCoverage,
  phaseRollbacks: f.phaseRollbacks,
  failedSubCriteria: f.failedSubCriteria,
})), null, 2)}

高频失败子标准：${topFailures || '无'}

成功 minibatch（共 ${successes.length} 条）可参考其特征。

任务：诊断失败原因，产出对 MetaSkillConfig 的编辑建议，以 JSON 数组返回：
[
  {
    "op": "replace",
    "targetFile": "src/core/meta-skill-config.ts",
    "anchor": "requirement.completeness.weight",
    "content": "0.30",
    "rationale": "完整性权重过低导致需求描述不充分",
    "budgetCost": 4
  }
]

约束：
1. 仅可编辑 MetaSkillConfig 的可训练字段（weight / repeatedTimes / varianceThreshold / scoringPrompt）
2. 不可编辑受保护区域：${this.config.protectedRegions.map(r => r.id).join(', ')}
3. 总 budgetCost 不超过 ${this.config.editBudget}
4. 输出纯 JSON 数组，不要其他解释文字`;
  }

  /** 解析 optimizer 输出为 SkillEdit 列表（容错：提取首个 JSON 数组） */
  private parseEdits(text: string, _parent: MetaSkillConfig): SkillEdit[] {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]) as SkillEdit[];
      // 过滤掉指向受保护区域的编辑
      return parsed.filter(edit => !this.isProtected(edit));
    } catch {
      return [];
    }
  }

  /** 检查编辑是否触碰受保护区域 */
  private isProtected(edit: SkillEdit): boolean {
    return this.config.protectedRegions.some(r => edit.targetFile.includes(r.id) || edit.anchor.includes(r.id));
  }

  /** 应用单条编辑到候选配置 */
  private applyEdit(config: MetaSkillConfig, edit: SkillEdit): void {
    // 仅支持对 MetaSkillConfig 的 weight / repeatedTimes / varianceThreshold / scoringPrompt 编辑
    // anchor 格式：<phase>.<subCriterionId>.<field> 或 <phase>.<field>
    const parts = edit.anchor.split('.');
    if (parts.length < 2) return;

    const phaseKey = parts[0] as keyof MetaSkillConfig['phases'];
    const phase = config.phases[phaseKey];
    if (!phase) return;

    // phase 级字段：repeatedTimes / varianceThreshold
    if (parts.length === 2) {
      const field = parts[1];
      const value = parseFloat(edit.content ?? '');
      if (Number.isNaN(value)) return;
      if (field === 'repeatedTimes') phase.repeatedTimes = Math.max(1, Math.round(value));
      else if (field === 'varianceThreshold') phase.varianceThreshold = Math.max(0, Math.min(1, value));
      return;
    }

    // subCriterion 级字段：<phase>.<subId>.<field>
    if (parts.length === 3) {
      const [, subId, field] = parts;
      const sc = phase.subCriteria.find(s => s.id === subId);
      if (!sc) return;
      if (field === 'weight') {
        const v = parseFloat(edit.content ?? '');
        if (!Number.isNaN(v) && v >= 0) sc.weight = v;
      } else if (field === 'scoringPrompt') {
        if (edit.content) sc.scoringPrompt = edit.content;
      }
    }
  }

  // ==================== Gate ====================

  private async evaluateGate(
    candidate: { id: string; config: MetaSkillConfig },
    _epoch: number
  ): Promise<GateResult> {
    if (!this.config.validationGateEnabled) {
      // 仅实验用：强制接受
      return {
        candidateId: candidate.id,
        skillLift: 0,
        accepted: true,
        perTaskResults: [],
      };
    }

    const evalResult = await this.gateEvaluator.evaluate(candidate.config, this.config.heldOutTaskIds);

    // 技能验证门判定委托至技能包内脚本 `w-model-dev/scripts/gate-logic.ts`
    // 的 `checkSkillGate()`，与 CLI `check-skill-gate.ts` 共用同一份事实源。
    const gate = checkSkillGate({ meanSkillLift: evalResult.skillLift });

    return {
      candidateId: candidate.id,
      skillLift: gate.skillLift,
      accepted: gate.accepted,
      // checkSkillGate 返回的 reason 形如 "拒绝：meanSkillLift=... 未严格大于 0"
      // 此处仅在被拒绝时透传原因，保持 GateResult.rejectionReason 的语义契约
      rejectionReason: gate.accepted ? undefined : gate.reason,
      perTaskResults: evalResult.perTaskResults,
    };
  }

  // ==================== 辅助 ====================

  /** 获取训练任务 ID（排除留出集） */
  private async getTrainTaskIds(epoch: number): Promise<string[]> {
    // 简化实现：调用方应在 RolloutExecutor 中维护任务池；这里返回占位
    // 真实场景从 benchmark 集合加载，且排除 heldOutTaskIds
    const placeholder = [`train-task-epoch${epoch}-1`, `train-task-epoch${epoch}-2`].slice(0, this.config.batchSize);
    return placeholder;
  }

  private log(epoch: number, phase: TrainingLogEntry['phase'], detail: string, metrics?: Record<string, number>): void {
    this.logs.push({ epoch, phase, timestamp: new Date().toISOString(), detail, metrics });
  }

  /** 将训练日志写回磁盘（供 SkillOpt-Sleep 模式人工审阅） */
  async persistLogs(dir: string): Promise<string> {
    const logFile = path.join(dir, 'skill-optimizer-logs.json');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(logFile, JSON.stringify(this.logs, null, 2), 'utf-8');
    return logFile;
  }
}

/**
 * 便捷工厂：基于 WModelVerifierEnhancer 构造一个 GateEvaluator。
 *
 * 评估方式：用候选配置构造一个新的 enhancer，在留出集上跑 rollout，
 * 计算与基线（DEFAULT_META_SKILL_CONFIG）的 Skill Lift。
 */
export function createMetaSkillGateEvaluator(
  _baselineEnhancer: WModelVerifierEnhancer,
  _verifierConfig: VerifierConfig,
  rolloutExecutor: RolloutExecutor
): GateEvaluator {
  return {
    async evaluate(candidate, heldOutTaskIds) {
      const baselineResults: Array<{ taskId: string; metric: number }> = [];
      const candidateResults: Array<{ taskId: string; metric: number }> = [];

      for (const taskId of heldOutTaskIds) {
        // baseline：使用默认配置
        const baseEvidence = await rolloutExecutor.run(taskId, DEFAULT_META_SKILL_CONFIG);
        const baseMetric = computeMetric(baseEvidence);
        baselineResults.push({ taskId, metric: baseMetric });

        // candidate：使用候选配置
        const candEvidence = await rolloutExecutor.run(taskId, candidate);
        const candMetric = computeMetric(candEvidence);
        candidateResults.push({ taskId, metric: candMetric });
      }

      const meanBaseline = mean(baselineResults.map(r => r.metric));
      const meanCandidate = mean(candidateResults.map(r => r.metric));
      const skillLift = meanCandidate - meanBaseline;

      return {
        skillLift,
        perTaskResults: baselineResults.map(b => ({
          taskId: b.taskId,
          baselineMetric: b.metric,
          candidateMetric: candidateResults.find(c => c.taskId === b.taskId)!.metric,
        })),
      };
    },
  };
}

/** 综合指标：质量门通过(+) + RTM覆盖率 - 阶段回退次数 */
function computeMetric(e: RolloutEvidence): number {
  return (e.qualityGatePassed ? 1 : 0) + e.rtmCoverage / 100 - e.phaseRollbacks * 0.1;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** 从 VerificationResult 提取失败子标准（供 RolloutExecutor 实现使用） */
export function extractFailedSubCriteria(result: VerificationResult): string[] {
  const failed: string[] = [];
  for (const [id, score] of Object.entries(result.subScores ?? {})) {
    // 低于 60% 满分视为失败
    if (score < 12) failed.push(id);
  }
  return failed;
}
