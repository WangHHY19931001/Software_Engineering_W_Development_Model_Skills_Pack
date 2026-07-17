#!/usr/bin/env tsx
/**
 * 技能验证门校验脚本（Skill Validation Gate Checker）
 *
 * 对应 SSoT §14.5「验证门」+ §15「技能评估标准」。供 SkillOptimizer 演化循环
 * 在 Gate 阶段调用，或供人工审阅候选技能是否可采纳。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-skill-gate.ts <report.json>
 *
 * 参数：
 *   report.json  SkillEvalReport JSON 文件路径
 *                （由 SkillLiftEvaluator.evaluateBatch() 产出）
 *
 * 判定规则：
 *   留出集 meanSkillLift > 0（严格正提升）才通过。
 *   SkillsBench 实证：自生成技能平均 -1.3pp，必须搭配验证门。
 *
 * 退出码：
 *   0  验证门通过（候选技能可采纳）
 *   1  验证门拒绝（候选技能不可采纳，保留当前配置）
 *   2  输入错误（报告缺失 / 格式非法）
 */

import { promises as fs } from 'node:fs';
import {
  checkSkillGate,
  type SkillEvalReportShape,
} from './gate-logic.js';

async function main(): Promise<void> {
  const reportFile = process.argv[2];
  if (!reportFile) {
    console.error('用法: npx tsx w-model-dev/scripts/check-skill-gate.ts <report.json>');
    console.error('  report.json 由 SkillLiftEvaluator.evaluateBatch() 产出（含 meanSkillLift 字段）');
    process.exit(2);
  }

  let raw: string;
  try {
    raw = await fs.readFile(reportFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 评估报告文件不存在: ${reportFile}`);
      process.exit(2);
    }
    throw err;
  }

  let report: SkillEvalReportShape;
  try {
    report = JSON.parse(raw) as SkillEvalReportShape;
  } catch {
    console.error(`✗ 评估报告解析失败（非合法 JSON）: ${reportFile}`);
    process.exit(2);
  }

  if (typeof report.meanSkillLift !== 'number') {
    console.error(`✗ 评估报告缺少必要字段 meanSkillLift（number）: ${reportFile}`);
    process.exit(2);
  }

  const result = checkSkillGate(report);

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('技能验证门校验（Skill Validation Gate）');
  console.log('═'.repeat(60));
  console.log(`评估报告    : ${reportFile}`);
  console.log(`任务数      : ${report.taskCount}`);
  console.log(`正向 lift 率 : ${(report.positiveLiftRate * 100).toFixed(1)}%`);
  console.log(`meanSkillLift: ${result.skillLift.toFixed(3)}`);
  console.log(`校验结果    : ${result.accepted ? '✓ 通过（可采纳）' : '✗ 拒绝'}`);
  console.log('─'.repeat(60));
  console.log(result.reason);

  // 末尾 JSON 摘要（供 Agent 程序化解析）
  console.log('─'.repeat(60));
  console.log('GATE_JSON ' + JSON.stringify({
    type: 'skill',
    accepted: result.accepted,
    skillLift: result.skillLift,
    reason: result.reason,
  }));

  process.exit(result.accepted ? 0 : 1);
}

main().catch((err) => {
  console.error('门禁校验脚本异常:', err);
  process.exit(2);
});
