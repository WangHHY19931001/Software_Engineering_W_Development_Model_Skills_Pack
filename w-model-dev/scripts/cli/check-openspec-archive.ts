#!/usr/bin/env tsx
/**
 * OpenSpec 归档完整性校验脚本（Openspec Archive Checker）
 *
 * 对应 SSoT §3.4.21：阶段门 V/G 全通过后须执行 opsx:archive 归档变更。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-openspec-archive.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  归档完整
 *   1  未归档或归档不完整
 *   2  输入错误
 */

import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport } from '../lib/gate-report.js';
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
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  // 统一 --phase 校验（lib/parse-phase.ts，5-8；支持 --phase N 与 --phase=N）
  const hasPhaseFlag = process.argv.includes('--phase') || process.argv.some(a => a.startsWith('--phase='));
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });

  if (!file || !hasPhaseFlag) {
    exitWithError({
      category: 'ARG_INVALID',
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
        message: `参数非法 --phase=${phaseRaw}`,
        detail: '须为 5-8 的整数',
        exitCode: 2,
      });
      return;
    }
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-openspec-archive.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);
  const result = checkOpenspecArchive(abs, phase);

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
  }, result.passed ? 0 : 1);
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
