#!/usr/bin/env tsx
/** Produce and validate source-bound local evidence provenance. */
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { produceSourceProvenance } from '../logic/evidence-provenance-logic.js';

const USAGE = '用法: wm-verify-evidence-source.ts <project-dir>';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0]!.startsWith('-')) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '需要唯一 <project-dir> 参数',
      detail: USAGE,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
  const result = await produceSourceProvenance(path.resolve(args[0]!));
  console.log('EVIDENCE_SOURCE_JSON ' + JSON.stringify({ script: 'wm-verify-evidence-source.ts', ...result }));
  if (!result.ok) {
    exitWithError({
      category: result.exitCode === 2 ? 'FILE_NOT_FOUND' : 'STRUCTURE_INVALID',
      rule: result.reason,
      message: 'source provenance 验证失败',
      exitCode: result.exitCode,
    });
  }
}

runMain(main);
