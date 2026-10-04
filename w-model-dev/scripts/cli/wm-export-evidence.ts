#!/usr/bin/env tsx
/**
 * Export or verify sanitized runtime evidence.
 *
 * Usage:
 *   npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts <project-dir> <output-dir>
 *   npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json [--source-project <project-dir>]
 */
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { exportEvidence, verifyEvidence } from '../logic/evidence-export-logic.js';

const USAGE =
  '用法: wm-export-evidence.ts <project-dir> <output-dir> | wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json [--source-project <project-dir>]';

function argumentError(message: string): never {
  exitWithError({
    category: 'ARG_INVALID',
    rule: 'P0-1',
    message,
    detail: USAGE,
    exitCode: 2,
  });
  throw new HandledCliError();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  let result;
  if (args[0] === '--verify') {
    const sourceFlag = args.indexOf('--source-project');
    const sourceProject = sourceFlag === -1 ? undefined : args[sourceFlag + 1];
    if (
      args.length !== (sourceProject ? 4 : 2) ||
      (sourceFlag !== -1 && sourceFlag !== 2) ||
      (sourceFlag !== -1 && !sourceProject)
    )
      argumentError(args.length < 2 ? '--verify 缺少 manifest 路径' : '--verify 参数非法');
    result = await verifyEvidence(path.resolve(args[1]!), sourceProject ? path.resolve(sourceProject) : undefined);
  } else {
    if (args.some((arg) => arg.startsWith('--'))) argumentError('存在未知选项');
    if (args.length !== 2)
      argumentError(args.length < 2 ? '导出模式需要 <project-dir> 与 <output-dir>' : '导出模式仅接受两个位置参数');
    result = await exportEvidence(path.resolve(args[0]!), path.resolve(args[1]!));
  }

  const safeResult = {
    ...result,
    ...(result.outputDir ? { outputDir: '<redacted-output>' } : {}),
    ...(result.manifestPath ? { manifestPath: '<redacted-output>/evidence-manifest.json' } : {}),
  };
  console.log('EVIDENCE_EXPORT_JSON ' + JSON.stringify({ script: 'wm-export-evidence.ts', ...safeResult }));
  if (!result.ok) {
    // 失败路径 exitCode ∈ {1,2}：0 仅由成功态（ok:true）产生；失败态只出自 EvidenceFailure(1|2)
    // 与 catch-all 兜底 1（evidence-export-logic.ts toResult），故断言收窄为 1|2（C19，零运行时变化）。
    exitWithError({
      category: result.exitCode === 2 ? 'FILE_NOT_FOUND' : 'STRUCTURE_INVALID',
      rule: result.reason,
      message: '证据导出或验证失败',
      exitCode: result.exitCode as 1 | 2,
    });
  }
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
