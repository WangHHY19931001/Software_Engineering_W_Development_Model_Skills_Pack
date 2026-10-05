#!/usr/bin/env tsx
/**
 * 设计期迷雾登记册门禁（批次 2 A3，check-design-fog）
 *
 * 校验阶段 2-4 设计主文档「迷雾登记册」节结构与终结态（R1-R6，判据见
 * logic/design-fog-logic.ts；机制权威见 references/phase-2/3/4 细则「设计期迷雾登记册」节）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-design-fog.ts --doc=<设计主文档.md> --phase=2|3|4
 *
 * 退出码：0=通过（全部终结或合法无雾标记）/ 1=校验失败（存在未终结迷雾项或结构违规，
 * stdout 单行 FOG_JSON）/ 2=输入错误（未知/重复/缺参 flag、坏 phase、文档不存在或不可读
 * → ERROR_JSON + stderr ✗ 行，零副作用）。
 *
 * 输出：stdout 单行 `FOG_JSON {type,passed,doc,phase,reasons,violations,fogStats,exitCode}`；
 * violations 为规则计数分布（[{rule,count}]），reasons 为完整违规消息（通过时为空数组）。
 */
import { existsSync, readFileSync } from 'node:fs';

import { exitWithError } from '../lib/cli-error.js';
import { parseFlagValue, hasFlag } from '../lib/parse-args.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { checkDesignFog } from '../logic/design-fog-logic.js';

const VALUE_FLAGS = ['doc', 'phase'] as const;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (hasFlag(args, 'json')) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'check-design-fog 暂无 --json 模式（摘要恒走 FOG_JSON）',
      exitCode: 2,
    });
    return;
  }

  // 未知 flag 先拒绝（含 exit-2 探针 --d4-invalid-argument；等号前缀与裸 flag 同判）
  const unknownFlags = args.filter((a) => {
    if (!a.startsWith('--')) return false;
    const name = a.includes('=') ? a.slice(2, a.indexOf('=')) : a.slice(2);
    return !(VALUE_FLAGS as readonly string[]).includes(name);
  });
  if (unknownFlags.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `未知 flag ${unknownFlags.join(' ')}（支持：${VALUE_FLAGS.map((f) => `--${f}`).join(' ')}）`,
      exitCode: 2,
    });
    return;
  }

  // 值 flag 统一 parseFlagValue（等号形态；重复 → DuplicateFlagError → runMain ARG_INVALID）
  const docPath = parseFlagValue(args, 'doc');
  const phaseStr = parseFlagValue(args, 'phase');
  if (docPath === undefined || phaseStr === undefined) {
    const missing = [docPath === undefined ? '--doc' : null, phaseStr === undefined ? '--phase' : null].filter(
      (f): f is string => f !== null,
    );
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `缺少必需 flag ${missing.join(' ')}`,
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-design-fog.ts --doc=<设计主文档.md> --phase=2|3|4',
      exitCode: 2,
    });
    return;
  }

  const phase = Number(phaseStr);
  if (!Number.isInteger(phase) || phase < 2 || phase > 4) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `--phase 必须为 2|3|4（实际 ${phaseStr}）`,
      exitCode: 2,
    });
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- docPath 为调用方显式传入的 --doc 值，仅作存在性探测
  if (!existsSync(docPath)) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '设计主文档不存在',
      file: docPath,
      exitCode: 2,
    });
    return;
  }
  let markdown: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- docPath 为调用方显式传入的 --doc 值，只读打开
    markdown = readFileSync(docPath, 'utf8');
  } catch (err) {
    exitWithError({
      category: 'FILE_READ',
      rule: 'P0-2',
      message: '设计主文档不可读',
      file: docPath,
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
    return;
  }

  const result = checkDesignFog({ markdown, phase });

  // violations 规则计数分布：按 `R<N>:` 前缀聚合（logic 层六规则前缀恒在）
  const byRule: Record<string, number> = {};
  for (const v of result.violations) {
    const rule = v.slice(0, v.indexOf(':'));
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
  const violations = Object.entries(byRule).map(([rule, count]) => ({ rule, count }));

  console.log(
    `FOG_JSON ${JSON.stringify({
      type: 'design-fog',
      passed: result.passed,
      doc: docPath,
      phase,
      reasons: result.passed ? [] : result.violations,
      violations,
      fogStats: result.fogStats,
      exitCode: result.passed ? 0 : 1,
    })}`,
  );
  if (!result.passed) process.exitCode = 1;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
