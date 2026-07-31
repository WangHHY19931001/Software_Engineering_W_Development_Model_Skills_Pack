#!/usr/bin/env tsx
/**
 * Verifier 输出校验脚本（Verifier Output Checker）
 *
 * 对应 w-model-dev/references/verifier-spec.md §6 输出 Schema。
 * 供外部 AI Agent 完成 LLM-as-a-Verifier 评审并写出 JSON 后立即调用，
 * 防止 LLM 输出漂移导致下游消费方拿到不合规结构。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
 *
 * 参数：
 *   output.json  外部 Agent 产出的 VerifierOutput JSON 文件路径
 *
 * 退出码：
 *   0  校验通过（输出符合 §6 Schema 与各数值约束）
 *   1  校验失败（reasons 列出具体原因，Agent 必须按原因重评）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 *
 * 注意：本脚本只做结构化校验，不调用任何 LLM。技能演化由外部工具完成：
 *   - skillopt（微软 SkillOpt）  https://github.com/microsoft/SkillOpt
 *   - https://github.com/alchaincyf/darwin-skill
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkVerifierOutput,
  type VerifierOutputShape,
} from './verifier-logic.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const selfAsVerifier = args.includes('--self-as-verifier');
  const sOutputArg = args.find(a => a.startsWith('--s-output='));

  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json> [--self-as-verifier --s-output=<path>]');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkVerifierOutput(parsed);
  const meta = (parsed as VerifierOutputShape)?.meta;

  // self-as-verifier 模式：校验 VerifierOutput JSON 路径与 S 产出路径不同（反模式 #35）
  const selfAsVerifierViolations: string[] = [];
  if (selfAsVerifier) {
    if (!sOutputArg) {
      selfAsVerifierViolations.push('--self-as-verifier 模式须同时提供 --s-output=<S产出路径>');
    } else {
      const sOutputValue = sOutputArg.slice(sOutputArg.indexOf('=') + 1);
      if (sOutputValue === '') {
        console.error('✗ --s-output= 值不能为空');
        process.exit(2);
      }
      const sOutputPath = path.resolve(sOutputValue);
      if (abs === sOutputPath) {
        selfAsVerifierViolations.push(
          `反模式 #35：self-as-verifier 模式下 VerifierOutput JSON 路径(${abs})与 S 产出路径(${sOutputPath})相同，须拆分为独立产物文件`,
        );
      }
    }
  }

  const allReasons = [...result.reasons, ...selfAsVerifierViolations];
  const passed = result.passed && selfAsVerifierViolations.length === 0;

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('Verifier 输出校验（LLM-as-a-Verifier Output Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  if (meta) {
    console.log(`目标类型      : ${meta.targetKind}`);
    console.log(`目标          : ${meta.target}`);
    console.log(`评审 Agent    : ${meta.agent}`);
    console.log(`评分方法      : ${meta.scoringMethod}`);
    console.log(`重复次数      : ${meta.repeatTimes}`);
    console.log(`方差阈值      : ${meta.varianceThreshold}`);
  }
  console.log(`self-as-verifier: ${selfAsVerifier ? '是' : '否'}`);
  console.log(`综合分数      : ${result.compositeScore}`);
  console.log(`期望综合分数  : ${result.expectedCompositeScore}`);
  console.log(`质量等级      : ${result.qualityLevel}`);
  console.log(`校验结果      : ${passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (passed) {
    console.log('输出结构符合 verifier-spec.md §6 Schema 与各数值约束。');
  } else {
    console.log('未通过原因：');
    for (const r of allReasons) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('外部 Agent 必须按上述原因重新执行评审，详见：');
    console.log('  w-model-dev/references/verifier-spec.md');
  }

  // 末尾 JSON 摘要（供 Agent 程序解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('VERIFIER_JSON ' + JSON.stringify({
    type: 'verifier-output',
    passed,
    exitCode,
    selfAsVerifier,
    compositeScore: result.compositeScore,
    expectedCompositeScore: result.expectedCompositeScore,
    qualityLevel: result.qualityLevel,
    reasons: allReasons,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Verifier 校验脚本异常:', err);
  process.exit(2);
});
