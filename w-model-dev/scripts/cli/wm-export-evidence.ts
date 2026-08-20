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

  console.log('EVIDENCE_EXPORT_JSON ' + JSON.stringify({ script: 'wm-export-evidence.ts', ...result }));
  if (!result.ok) {
    exitWithError({
      category: result.exitCode === 2 ? 'FILE_NOT_FOUND' : 'STRUCTURE_INVALID',
      rule: result.reason,
      message: '证据导出或验证失败',
      exitCode: result.exitCode,
    });
  }
}

runMain(main);
