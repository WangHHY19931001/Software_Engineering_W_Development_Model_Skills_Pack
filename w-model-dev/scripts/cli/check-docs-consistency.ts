#!/usr/bin/env tsx
/**
 * 文档一致性门禁（Doc Consistency Checker）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts [repo-root]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 退出码：
 *   0  全部一致
 *   1  存在不一致（violations 列出）
 *   2  输入错误（repo-root 缺必需文件）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport } from '../lib/gate-report.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { runDocConsistencyChecks, type DocConsistencyInput } from '../logic/docs-consistency-logic.js';

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
  'w-model-dev/subagent', // 目录（persona 计数）
  '.cursor/skills', // 目录（cursor skill 计数）
  'docs/llm-verifier-integration-design.md',
  'docs/loop-engineering-adoption-design.md',
  'docs/information-flow-validation-design.md',
  'docs/ingestion-graph-convergence-design.md',
  'docs/skill-design-document.md',
  'docs/tla-plus-modeling-design.md',
  'w-model-dev/scripts/__tests__', // 目录（vitest 测试文件数）
];

/** docs/ 根 6 份设计文档（活体引用，README 导航引用；docs/superpowers/ 与 docs/changes/ 归档不动） */
const DESIGN_DOC_NAMES = [
  'llm-verifier-integration-design.md',
  'loop-engineering-adoption-design.md',
  'information-flow-validation-design.md',
  'ingestion-graph-convergence-design.md',
  'skill-design-document.md',
  'tla-plus-modeling-design.md',
];

/**
 * 判定 w-model-dev/scripts 目录下 .ts 文件是否有变更（spec §3 B3 baseline 同步检查的触发条件）。
 * 合并两路 git 输出，覆盖 staged / unstaged / 未跟踪新文件：
 *   - git diff --name-only HEAD：工作树 + 暂存区相对 HEAD 的变更
 *   - git status --porcelain：含未跟踪（??）新文件，兜底 diff 未覆盖的部分
 * git 不可用（非 git 仓库 / 命令失败）时保守返回 false —— 无法判定变更时不阻断门禁。
 */
function detectScriptsChanges(root: string): boolean {
  const paths: string[] = [];
  const diff = spawnSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf-8' });
  if (diff.error === undefined && diff.status === 0) {
    paths.push(...String(diff.stdout).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0));
  }
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf-8' });
  if (status.error === undefined && status.status === 0) {
    for (const line of String(status.stdout).split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      paths.push(t.slice(3)); // porcelain 每行 "XY path" / "?? path" → 去掉状态前缀
    }
  }
  return paths.some((p) => /^w-model-dev\/scripts\/.*\.ts$/.test(p));
}

/**
 * 读取根目录 .eslintsecurity-baseline.json 的指纹条目数。
 * 返回：-1 = 缺失或不可解析；0 = 存在但 entries 为空；>0 = 正常指纹条目数。
 */
function readSecurityBaselineEntryCount(root: string): number {
  const baselinePath = join(root, '.eslintsecurity-baseline.json');
  if (!existsSync(baselinePath)) return -1;
  try {
    const parsed = parseJsonSafe(readFileSync(baselinePath, 'utf-8')) as { entries?: unknown } | null;
    return parsed !== null && Array.isArray(parsed.entries) ? parsed.entries.length : -1;
  } catch {
    return -1;
  }
}

function main(): void {
  const root = pathResolve(process.argv[2] ?? '.');
  const missing = REQUIRED_PATHS.filter((p) => !existsSync(join(root, p)));
  if (missing.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
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
  const checkScriptCount = readdirSync(join(root, 'w-model-dev/scripts/cli')).filter((f) => /^check-.*\.ts$/.test(f)).length; // 含 check-docs-consistency 自身 = 25（cli/ 层）
  const exit2ScriptCount = checkScriptCount + 5; // + 5 工具：ensure-codegraph-opsx + wm-status + metrics-report + security-scan + plan-chunks（合计 30）
  const designDocs = DESIGN_DOC_NAMES.map((name) => ({ name, content: read(join('docs', name)) }));
  const testFileCount = readdirSync(join(root, 'w-model-dev/scripts/__tests__')).filter((f) => f.endsWith('.test.ts')).length;

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
    designDocs,
    testFileCount,
    scriptsChanged: detectScriptsChanges(root),
    securityBaselineEntryCount: readSecurityBaselineEntryCount(root),
  };

  const violations = runDocConsistencyChecks(input);

  console.log('═'.repeat(60));
  console.log('文档一致性检查（Doc Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`repo-root     : ${root}`);
  console.log(`schema 文件   : ${schemaFiles.length}`);
  console.log(`exit-2 脚本   : ${exit2ScriptCount}`);
  console.log(`persona / cur : ${personaCount} / ${cursorSkillCount}`);
  console.log(`test 文件    : ${testFileCount}`);
  console.log(`检查结果      : ${violations.length === 0 ? '✓ 全部一致' : `✗ ${violations.length} 项不一致`}`);

  if (violations.length > 0) {
    console.log('─'.repeat(60));
    for (const v of violations) {
      console.log(`  - [${v.check}] ${v.message}`);
    }
  }

  printGateReport('DOCS_CONSISTENCY', { passed: violations.length === 0, violationCount: violations.length }, violations.length === 0 ? 0 : 1);
}

// Windows 兼容的 main 模块判断：
//   - import.meta.url 是 file:///D:/... URL 格式
//   - process.argv[1] 是 Windows 路径 D:\... 或 POSIX 路径
//   用 fileURLToPath + pathResolve 归一化两端再比较，避免斜杠方向 / 盘符大小写差异。
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === pathResolve(entryArg);
if (isMain) {
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
}
