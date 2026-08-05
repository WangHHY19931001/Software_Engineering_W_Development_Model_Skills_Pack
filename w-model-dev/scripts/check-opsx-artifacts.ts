#!/usr/bin/env tsx
/**
 * OpenSpec opsx 制品与审查产物校验脚本（Opsx Artifacts Checker）
 *
 * 对应反模式 #39（跳过 opsx 产物审查）+ #40（opsx/S-tickets 职责混淆）。
 * 校验每阶段 opsx 变更目录制品齐全（proposal/specs/design/tasks + tickets）
 * + R3×3 + V 审查产物齐全。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  制品与审查产物齐全
 *   1  缺失制品或审查（命中 #39/#40）
 *   2  输入错误
 */

import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exitWithError } from './lib/cli-error.js';
import { printGateReport } from './lib/gate-report.js';
import { parsePhaseArg } from './lib/parse-phase.js';

interface CheckResult {
  passed: boolean;
  violations: string[];
  changesNames: string[];
  artifactsFound: string[];
  reviewsFound: string[];
}

const REQUIRED_OPSX_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md', 'tickets.md'] as const;
const REQUIRED_R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;
const REQUIRED_STAGES = ['explore', 'propose', 'coding'] as const;

/**
 * 校验 opsx 制品与审查产物纯逻辑（可被 self-test import）
 */
export function checkOpsxArtifacts(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const artifactsFound: string[] = [];
  const reviewsFound: string[] = [];

  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!existsSync(changesDir)) {
    violations.push(`openspec/changes/ 目录不存在（阶段 ${phase} 须有 opsx 变更）`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }

  // 找该阶段所有变更目录 phase<N>-*（精确前缀匹配，排除 archive）
  const prefixRegex = new RegExp(`^phase${phase}-`);
  const entries = readdirSync(changesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && prefixRegex.test(e.name) && e.name !== 'archive');

  if (entries.length === 0) {
    violations.push(`阶段 ${phase}：openspec/changes/ 下无 phase${phase}-* 变更目录`);
    return { passed: false, violations, changesNames: [], artifactsFound, reviewsFound };
  }

  // 按名称排序后逐个校验所有变更目录
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
  const changesNames = sorted.map(e => e.name);

  for (const entry of sorted) {
    const changeDir = path.join(changesDir, entry.name);
    const changeName = entry.name;

    // 校验 opsx 制品 + tickets（反模式 #40）
    for (const art of REQUIRED_OPSX_ARTIFACTS) {
      const artPath = path.join(changeDir, art);
      if (existsSync(artPath)) {
        artifactsFound.push(`${changeName}/${art}`);
      } else {
        violations.push(`${changeName}/${art} 缺失（反模式 #40：opsx/S-tickets 职责混淆）`);
      }
    }

    // 校验 specs/ 目录存在
    const specsDir = path.join(changeDir, 'specs');
    if (!existsSync(specsDir)) {
      violations.push(`${changeName}/specs/ 目录缺失`);
    } else {
      artifactsFound.push(`${changeName}/specs/`);
    }
  }

  // 校验 R3×3 + V 审查产物（反模式 #39）—— 项目级 stage 审查
  const r3Dir = path.join(projectRoot, '.w-model', 'r3-reviews');
  const vDir = path.join(projectRoot, '.w-model', 'v-reviews');

  for (const stage of REQUIRED_STAGES) {
    for (const dim of REQUIRED_R3_DIMENSIONS) {
      const r3File = path.join(r3Dir, `phase${phase}-${stage}-${dim}.md`);
      if (existsSync(r3File)) {
        reviewsFound.push(`${stage}-${dim}`);
      } else {
        violations.push(`.w-model/r3-reviews/phase${phase}-${stage}-${dim}.md 缺失（反模式 #39：跳过 opsx 产物审查）`);
      }
    }
    const vFile = path.join(vDir, `phase${phase}-${stage}.md`);
    if (existsSync(vFile)) {
      reviewsFound.push(`${stage}-V`);
    } else {
      violations.push(`.w-model/v-reviews/phase${phase}-${stage}.md 缺失（反模式 #39）`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    changesNames,
    artifactsFound,
    reviewsFound,
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
      detail: '用法: npx tsx check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>',
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
      detail: '用法: npx tsx check-opsx-artifacts.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);
  const result = checkOpsxArtifacts(abs, phase);

  console.log('═'.repeat(60));
  console.log('opsx 制品与审查产物校验（Opsx Artifacts Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更目录      : ${result.changesNames.join(', ') || '（未找到）'}`);
  console.log(`制品          : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`审查产物      : ${result.reviewsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport('OPSX_ARTIFACTS', {
    type: 'opsx-artifacts',
    passed: result.passed,
    phase,
    changesNames: result.changesNames,
    artifactsFound: result.artifactsFound,
    reviewsFound: result.reviewsFound,
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
