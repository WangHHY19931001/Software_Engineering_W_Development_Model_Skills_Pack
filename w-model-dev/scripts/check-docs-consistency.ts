#!/usr/bin/env tsx
/**
 * 文档一致性门禁（Doc Consistency Checker）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-docs-consistency.ts [repo-root]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 退出码：
 *   0  全部一致
 *   1  存在不一致（violations 列出）
 *   2  输入错误（repo-root 缺必需文件）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exitWithError } from './lib/cli-error.js';
import { printGateReport } from './lib/gate-report.js';
import { runDocConsistencyChecks, type DocConsistencyInput } from './docs-consistency-logic.js';

const REQUIRED_PATHS = [
  'w-model-dev/references/data-models.md',
  'w-model-dev/references/verifier-spec.md',
  'w-model-dev/references/command-reference.md',
  'w-model-dev/references/agent-personas.md',
  'w-model-dev/references/definition-of-done.md',
  'w-model-dev/references/anti-patterns.md',
  'w-model-dev/references/glossary.md',
  'w-model-dev/schemas/run-log.schema.json',
  'w-model-dev/SKILL.md',
  'README.md',
  'AGENTS.md',
  'docs/skill-design-document_SSoT.md',
  '.githooks/pre-push',
];

function main(): void {
  const root = resolve(process.argv[2] ?? '.');
  const missing = REQUIRED_PATHS.filter((p) => !existsSync(join(root, p)));
  if (missing.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      message: 'repo-root 缺少必需文件',
      detail: `[${missing.join(', ')}]（用法: check-docs-consistency.ts [repo-root]）`,
      exitCode: 2,
    });
    return;
  }

  const read = (p: string): string => readFileSync(join(root, p), 'utf-8');
  const schemaFiles = readdirSync(join(root, 'w-model-dev/schemas')).filter((f) => f.endsWith('.schema.json')).sort();
  const personaCount = readdirSync(join(root, 'w-model-dev/subagent')).filter((f) => f.endsWith('.md')).length;
  const cursorSkillCount = readdirSync(join(root, '.cursor/skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  const checkScriptCount = readdirSync(join(root, 'w-model-dev/scripts')).filter((f) => /^check-.*\.ts$/.test(f)).length;
  const exit2ScriptCount = checkScriptCount + 5; // + 5 工具：ensure-codegraph-opsx + wm-status + metrics-report + security-scan + plan-chunks

  const input: DocConsistencyInput = {
    schemaFiles,
    personaCount,
    cursorSkillCount,
    exit2ScriptCount,
    dataModels: read('w-model-dev/references/data-models.md'),
    verifierSpec: read('w-model-dev/references/verifier-spec.md'),
    commandReference: read('w-model-dev/references/command-reference.md'),
    agentPersonas: read('w-model-dev/references/agent-personas.md'),
    definitionOfDone: read('w-model-dev/references/definition-of-done.md'),
    antiPatterns: read('w-model-dev/references/anti-patterns.md'),
    glossary: read('w-model-dev/references/glossary.md'),
    runLogSchema: read('w-model-dev/schemas/run-log.schema.json'),
    skill: read('w-model-dev/SKILL.md'),
    readme: read('README.md'),
    agents: read('AGENTS.md'),
    ssot: read('docs/skill-design-document_SSoT.md'),
    prePush: read('.githooks/pre-push'),
  };

  const violations = runDocConsistencyChecks(input);

  console.log('═'.repeat(60));
  console.log('文档一致性检查（Doc Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`repo-root     : ${root}`);
  console.log(`schema 文件   : ${schemaFiles.length}`);
  console.log(`exit-2 脚本   : ${exit2ScriptCount}`);
  console.log(`persona / cur : ${personaCount} / ${cursorSkillCount}`);
  console.log(`检查结果      : ${violations.length === 0 ? '✓ 全部一致' : `✗ ${violations.length} 项不一致`}`);

  if (violations.length > 0) {
    console.log('─'.repeat(60));
    for (const v of violations) {
      console.log(`  - [${v.check}] ${v.message}`);
    }
  }

  printGateReport('DOCS_CONSISTENCY', { passed: violations.length === 0, violationCount: violations.length }, violations.length === 0 ? 0 : 1);
}

try {
  main();
} catch (err) {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
}
