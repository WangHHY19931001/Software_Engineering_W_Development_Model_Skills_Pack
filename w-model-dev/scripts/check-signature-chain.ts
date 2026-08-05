#!/usr/bin/env tsx
/**
 * 签名链校验脚本（Signature Chain Checker）
 *
 * 对应 SSoT §7.9 SignatureChainEntry schema + §10.11 签名链门禁。
 * 供 G 子代理跑每个 gate 脚本前 + O 子代理 checkpoint 前 + 归档时调用，
 * 校验 signature-chain.jsonl 的：R1-R10 + 跨阶段消费者校验。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-signature-chain.ts <signature-chain.jsonl> [--phase=N] [--stage=pre-gate|pre-checkpoint|archive]
 *   npx tsx w-model-dev/scripts/check-signature-chain.ts --chain=<signature-chain.jsonl> [--phase=N] [--stage=pre-gate|pre-checkpoint|archive]
 *
 * 参数：
 *   signature-chain.jsonl   签名链文件路径（位置参数或通过 --chain 指定）
 *   --chain=<path>          显式签名链文件路径（与位置参数二选一，项目根由链文件位置向上推导 .w-model/ 目录）
 *   --phase=N               只校验 phase=N 的签名（1-8）
 *   --stage=...             校验阶段：pre-gate（G 跑 gate 前）/ pre-checkpoint（O checkpoint 前）/ archive（归档时全阶段）
 *
 * R8 说明：仅当从链文件位置向上能解析到含 .w-model/project.json 的真实项目根时启用（产物存在性校验）；
 *   独立链文件 / 逻辑夹具（无真实项目）场景自动跳过 R8，与 signature-chain-logic 契约一致。
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import { accessSync } from 'node:fs';
import * as path from 'node:path';
import { checkSignatureChain, type SignatureChainEntry } from './signature-chain-logic.js';
import { readJsonlOrExit } from './lib/read-json-or-exit.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  chainFile: string | undefined;
  phase: number | undefined;
  stage: 'pre-gate' | 'pre-checkpoint' | 'archive' | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const chainFlag = args.find(a => a.startsWith('--chain='));
  const chainFromFlag = chainFlag ? chainFlag.split('=').slice(1).join('=') : undefined;
  const chainFromPos = args.find(a => !a.startsWith('--'));
  const chainFile = chainFromFlag ?? chainFromPos;
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const stageArg = args.find(a => a.startsWith('--stage='));
  let phase: number | undefined;
  if (phaseArg) {
    const phaseStr = phaseArg.split('=')[1];
    phase = phaseStr !== undefined ? Number.parseInt(phaseStr, 10) : undefined;
  }
  let stage: ParsedArgs['stage'];
  if (stageArg) {
    const stageStr = stageArg.split('=')[1];
    if (stageStr === 'pre-gate' || stageStr === 'pre-checkpoint' || stageStr === 'archive') {
      stage = stageStr;
    }
  }
  return { chainFile, phase, stage };
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  const { chainFile, phase, stage } = parseArgs(process.argv);

  if (!chainFile) {
    console.error('用法: npx tsx w-model-dev/scripts/check-signature-chain.ts <signature-chain.jsonl> [--chain=<path>] [--phase=N] [--stage=pre-gate|pre-checkpoint|archive]');
    process.exit(2);
  }

  const chainAbs = path.resolve(chainFile);

  const entries = await readJsonlOrExit(chainFile, 'signature-chain');

  // 构建 existingPaths（R8 校验用，基于 artifacts + sourceArtifacts 路径）
  // 项目根由链文件位置向上推导：从链文件所在目录开始，向上找到含 .w-model/project.json 的真实项目根。
  // 真实项目必有 project.json（/wm analyze 初始化创建）；仅含 gate-logs 等测试残留的 .w-model/ 不视为项目根。
  // 找不到时返回 null → R8 跳过（与 signature-chain-logic 契约一致：existingPaths 未提供即跳过 R8；
  // 真实项目链文件必位于 <project>/.w-model/ 下，向上必能找到）。
  function findProjectRoot(chainDir: string): string | null {
    let dir = chainDir;
    for (let i = 0; i < 5; i++) {
      try {
        accessSync(path.join(dir, '.w-model', 'project.json'));
        return dir;
      } catch { /* continue */ }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null; // 未找到真实项目根（无 .w-model/project.json），跳过 R8
  }
  const projectRoot = findProjectRoot(path.dirname(chainAbs));
  let existingPaths: Set<string> | undefined;
  if (projectRoot) {
    existingPaths = new Set<string>();
    for (const entry of entries as SignatureChainEntry[]) {
      for (const artifact of entry.artifacts ?? []) {
        try {
          await fs.access(path.resolve(projectRoot, artifact));
          existingPaths.add(artifact);
        } catch {
          // 路径不存在，不加
        }
      }
      for (const srcArtifact of entry.inputProvenance?.sourceArtifacts ?? []) {
        try {
          await fs.access(path.resolve(projectRoot, srcArtifact.path));
          existingPaths.add(srcArtifact.path);
        } catch {
          // 路径不存在，不加
        }
      }
    }
  }

  const result = checkSignatureChain(entries, { phase, stage, existingPaths });

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('签名链校验（Signature Chain Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件          : ${chainAbs}`);
  console.log(`条目数            : ${entries.length}`);
  console.log(`--phase           : ${phase ?? '全部'}`);
  console.log(`--stage           : ${stage ?? '未指定'}`);
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log(`签名链符合规范：R1-R10 全通过${stage === 'archive' ? ' + 跨阶段消费者校验通过' : ''}。`);
    console.log(`通过规则：${result.rulesPassed.join(', ')}`);
  } else {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
    console.log('');
    console.log(`失败规则：${result.rulesFailed.join(', ')}`);
    console.log(`通过规则：${result.rulesPassed.join(', ')}`);
    console.log('');
    console.log('G/O 子代理须按上述原因处置（补签名 / 补来源 / 修链 / 用户确认），详见：');
    console.log('  w-model-dev/references/signature-chain-guide.md');
    console.log('  w-model-dev/references/anti-patterns.md #32');
  }

  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log(
    'SIGNATURE_CHAIN_JSON ' +
      JSON.stringify({
        type: 'signature-chain',
        passed: result.passed,
        exitCode,
        violations: result.violations,
        rulesPassed: result.rulesPassed,
        rulesFailed: result.rulesFailed,
      }),
  );

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('签名链校验脚本异常:', err);
  process.exit(2);
});
