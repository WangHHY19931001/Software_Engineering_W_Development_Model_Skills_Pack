#!/usr/bin/env tsx
/**
 * Verifier 输出校验脚本（Verifier Output Checker）
 *
 * 对应 w-model-dev/references/verifier-spec.md §6 输出 Schema。
 * 供外部 AI Agent 完成 LLM-as-a-Verifier 评审并写出 JSON 后立即调用，
 * 防止 LLM 输出漂移导致下游消费方拿到不合规结构。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <output.json>
 *
 * 参数：
 *   output.json  外部 Agent 产出的 VerifierOutput JSON 文件路径
 *   --self-as-verifier  本脚本自评模式：使用脚本内建 VerifierOutput 生成逻辑，配合 --s-output=
 *   --s-output=<path>   自评模式产物写出路径
 *   --json       机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  校验通过（输出符合 §6 Schema 与各数值约束）
 *   1  校验失败（reasons 列出具体原因，Agent 必须按原因重评）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 VERIFIER_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--self-as-verifier、--s-output=
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * 注意：本脚本只做结构化校验，不调用任何 LLM。技能演化由外部工具完成：
 *   - skillopt（微软 SkillOpt）  https://github.com/microsoft/SkillOpt
 *   - https://github.com/alchaincyf/darwin-skill
 *
 * @module
 */

import * as path from 'node:path';
import { checkVerifierOutput, type VerifierOutputShape } from '../logic/verifier-logic.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const selfAsVerifier = args.includes('--self-as-verifier');
  const sOutputArg = args.find((a) => a.startsWith('--s-output='));

  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <output.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <output.json> [--self-as-verifier --s-output=<path>]',
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(file);
  const parsed = await readJsonOrExit(file);

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
        exitWithError({
          category: 'ARG_INVALID',
          rule: 'P0-1',
          message: '参数非法 --s-output=',
          detail: '值不能为空',
          exitCode: 2,
        });
        return;
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
  const exitCode = passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'verifier-output',
        passed,
        reasons: allReasons,
        violations: buildViolationDistribution(allReasons.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

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
  printGateReport(
    'VERIFIER',
    {
      type: 'verifier-output',
      passed,
      selfAsVerifier,
      compositeScore: result.compositeScore,
      expectedCompositeScore: result.expectedCompositeScore,
      qualityLevel: result.qualityLevel,
      reasons: allReasons,
    },
    exitCode,
  );
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
