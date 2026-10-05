#!/usr/bin/env tsx
/** Produce and validate source-bound local evidence provenance. */
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { produceSourceProvenance } from '../logic/evidence-provenance-logic.js';

const USAGE = '用法: wm-verify-evidence-source.ts <project-dir> [--no-git-ok]';
const NO_GIT_OK_FLAG = '--no-git-ok';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // `--no-git-ok` 是唯一的显式降级开关：无 `.git` 工作区默认仍是 MISSING_GIT_HEAD exit 1。
  const noGitOk = args.filter((arg) => arg === NO_GIT_OK_FLAG).length === 1;
  const positional = args.filter((arg) => arg !== NO_GIT_OK_FLAG);
  if (positional.length !== 1 || positional[0]!.startsWith('-') || args.length - positional.length > 1) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '需要唯一 <project-dir> 参数（可选 --no-git-ok）',
      detail: USAGE,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
  const result = await produceSourceProvenance(path.resolve(positional[0]!), { noGitOk });
  console.log('EVIDENCE_SOURCE_JSON ' + JSON.stringify({ script: 'wm-verify-evidence-source.ts', ...result }));
  if (!result.ok) {
    // 失败路径 exitCode ∈ {1,2}：0 仅由成功态（ok:true）产生；失败态只出自 ProvenanceFailure(1|2)
    // 与 catch-all 兜底 1（evidence-provenance-logic.ts fail()），故断言收窄为 1|2（C19，零运行时变化）。
    exitWithError({
      category: result.exitCode === 2 ? 'FILE_NOT_FOUND' : 'STRUCTURE_INVALID',
      rule: result.reason,
      message: 'source provenance 验证失败',
      exitCode: result.exitCode as 1 | 2,
    });
  }
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
