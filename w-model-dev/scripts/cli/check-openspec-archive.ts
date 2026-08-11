#!/usr/bin/env tsx
/**
 * OpenSpec 归档完整性校验脚本（Openspec Archive Checker）
 *
 * 对应 SSoT §3.4.21：阶段门 V/G 全通过后须执行 opsx:archive 归档变更。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts <project-root> --phase <5|6|7|8> [--json]
 *
 * 参数：
 *   project-root   项目根目录
 *   --phase        校验阶段 5|6|7|8（支持 --phase N 与 --phase=N）
 *   --json         机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  归档完整
 *   1  未归档或归档不完整
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 OPENSPEC_ARCHIVE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * @param argv 命令行参数；支持 --json（机器可读输出）、--phase 5|6|7|8
 * @returns exitCode 0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 */

import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

interface CheckResult {
  passed: boolean;
  violations: string[];
  archivedChange: string | null;
  artifactsFound: string[];
}

const REQUIRED_ARCHIVED_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'tickets.md'] as const;

/**
 * 校验 opsx 归档完整性纯逻辑（可被 self-test import）
 */
export function checkOpenspecArchive(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];

  const archiveDir = path.join(projectRoot, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) {
    violations.push(`openspec/changes/archive/ 目录不存在（阶段 ${phase} 须归档 opsx 变更）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  // 找该阶段的归档目录（名称精确前缀匹配 phase<N>-）
  const prefixRegex = new RegExp(`phase${phase}-`);
  const entries = readdirSync(archiveDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && prefixRegex.test(e.name));

  if (entries.length === 0) {
    violations.push(`阶段 ${phase}：archive/ 下无含 phase${phase}- 前缀的归档目录（opsx:archive 未执行）`);
    return { passed: false, violations, archivedChange: null, artifactsFound };
  }

  const archivedDir = path.join(archiveDir, entries[0]!.name);
  const archivedChange = entries[0]!.name;

  for (const art of REQUIRED_ARCHIVED_ARTIFACTS) {
    const artPath = path.join(archivedDir, art);
    if (existsSync(artPath)) {
      artifactsFound.push(art);
    } else {
      violations.push(`${archivedChange}/${art} 缺失（归档不完整）`);
    }
  }

  // specs/ 目录
  const specsDir = path.join(archivedDir, 'specs');
  if (existsSync(specsDir)) {
    artifactsFound.push('specs/');
  } else {
    violations.push(`${archivedChange}/specs/ 目录缺失`);
  }

  return {
    passed: violations.length === 0,
    violations,
    archivedChange,
    artifactsFound,
  };
}

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  // 统一 --phase 校验（lib/parse-phase.ts，5-8；支持 --phase N 与 --phase=N）
  const hasPhaseFlag = process.argv.includes('--phase') || process.argv.some(a => a.startsWith('--phase='));
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });

  if (!file || !hasPhaseFlag) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  if (phaseParsed === undefined) {
    // 复刻原分支语义：空格形态数字越界 → '参数非法 --phase=N'；非数字 / 缺值 / 等号形态 → '参数缺失'
    const phaseIdx = args.indexOf('--phase');
    const phaseRaw = phaseIdx >= 0 ? args[phaseIdx + 1] : undefined;
    if (phaseRaw !== undefined && /^\d+$/.test(phaseRaw)) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --phase=${phaseRaw}`,
        detail: '须为 5-8 的整数',
        exitCode: 2,
      });
      return;
    }
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);
  const result = checkOpenspecArchive(abs, phase);
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport({
      type: 'openspec-archive',
      passed: result.passed,
      reasons: result.violations,
      violations: buildViolationDistribution(result.violations.length),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('opsx 归档完整性校验（Openspec Archive Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`归档目录      : ${result.archivedChange ?? '（未找到）'}`);
  console.log(`归档制品      : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport('OPENSPEC_ARCHIVE', {
    type: 'openspec-archive',
    passed: result.passed,
    phase,
    archivedChange: result.archivedChange,
    artifactsFound: result.artifactsFound,
    violations: result.violations,
  }, exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
