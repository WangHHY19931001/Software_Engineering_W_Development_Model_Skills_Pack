#!/usr/bin/env tsx
/**
 * L0/L1 链接边界审计入口。
 *
 * 默认审计 w-model-dev/；可用 --root=<skill-root> 审计显式 skill 包根目录。
 * stdout 成功或校验失败时仅输出 L0_LINK_AUDIT_JSON，参数错误时输出 ERROR_JSON。
 */

import * as path from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { auditL0RelativeLinks } from '../logic/l0-link-audit-logic.js';

function parseRoot(args: string[]): string | undefined {
  const rootArgs = args.filter((arg) => arg.startsWith('--root='));
  const invalid = args.filter((arg) => !arg.startsWith('--root='));
  if (invalid.length > 0 || rootArgs.length > 1 || rootArgs.some((arg) => arg.length === '--root='.length)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数仅支持可选 --root=<skill-root>',
      detail: '用法: npm run audit:l0-links [-- --root=<skill-root>]',
      exitCode: 2,
    });
    return undefined;
  }
  return rootArgs[0]?.slice('--root='.length);
}

async function main(): Promise<void> {
  const root = parseRoot(process.argv.slice(2));
  if (process.exitCode === 2) return;
  const skillRoot = path.resolve(root ?? 'w-model-dev');
  const result = await auditL0RelativeLinks(skillRoot);
  const exitCode = result.violations.length === 0 ? 0 : 1;

  console.log(
    `L0_LINK_AUDIT_JSON ${JSON.stringify({
      type: 'l0-link-audit',
      passed: exitCode === 0,
      skillRoot: path.relative(process.cwd(), skillRoot).replaceAll(path.sep, '/') || '.',
      relativeLinkCount: result.relativeLinkCount,
      l1OnlyCount: result.l1Only.length,
      templatePlaceholderCount: result.templatePlaceholders.length,
      violations: result.violations,
      exitCode,
    })}`,
  );
  process.exitCode = exitCode;
}

runMain(main);
