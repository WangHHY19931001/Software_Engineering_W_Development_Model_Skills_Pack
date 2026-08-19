#!/usr/bin/env tsx
/**
 * Export or verify sanitized runtime evidence.
 *
 * Usage:
 *   npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts <project-dir> <output-dir>
 *   npx tsx w-model-dev/scripts/cli/wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json
 */
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { exportEvidence, verifyEvidence } from '../logic/evidence-export-logic.js';

const USAGE =
  '用法: wm-export-evidence.ts <project-dir> <output-dir> | wm-export-evidence.ts --verify <output-dir>/evidence-manifest.json';

function argumentError(message: string): never {
  exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message, detail: USAGE, exitCode: 2 });
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
    if (args.length !== 2)
      argumentError(args.length < 2 ? '--verify 缺少 manifest 路径' : '--verify 只接受一个 manifest 路径');
    result = await verifyEvidence(path.resolve(args[1]!));
  } else {
    if (args.some((arg) => arg.startsWith('--')))
      argumentError(`未知选项: ${args.find((arg) => arg.startsWith('--'))}`);
    if (args.length !== 2)
      argumentError(args.length < 2 ? '导出模式需要 <project-dir> 与 <output-dir>' : '导出模式仅接受两个位置参数');
    result = await exportEvidence(path.resolve(args[0]!), path.resolve(args[1]!));
  }

  console.log('EVIDENCE_EXPORT_JSON ' + JSON.stringify({ script: 'wm-export-evidence.ts', ...result }));
  if (!result.ok) {
    console.error(`✗ [EVIDENCE_${result.mode.toUpperCase()}_FAILED] ${result.reason ?? 'evidence operation failed'}`);
    process.exitCode = result.exitCode;
  }
}

runMain(main);
