#!/usr/bin/env tsx
/**
 * 文档一致性门禁（Doc Consistency Checker）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts [repo-root] [--json]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 参数：
 *   --json   机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  全部一致
 *   1  存在不一致（violations 列出）
 *   2  输入错误（repo-root 缺必需文件）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 DOCS_CONSISTENCY_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、[repo-root]
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport } from '../lib/gate-report.js';
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

/**
 * 定位根 node_modules 下 vitest 包的可执行入口（package.json `bin.vitest`）。
 * 返回绝对路径；vitest 未安装 / package.json 不可解析时返回 null（触发 npx 回退）。
 */
function findVitestBin(root: string): string | null {
  try {
    const pkgPath = join(root, 'node_modules', 'vitest', 'package.json');
    if (!existsSync(pkgPath)) return null;
    const pkg = parseJsonSafe(readFileSync(pkgPath, 'utf-8')) as { bin?: { vitest?: unknown } } | null;
    const bin = pkg?.bin?.vitest;
    return typeof bin === 'string' ? join(root, 'node_modules', 'vitest', bin) : null;
  } catch {
    return null;
  }
}

/**
 * 采集 vitest 实际运行输出的用例总数（堵住只查文件数不查用例总数的盲区）。
 * 优先 `vitest run --reporter=json --outputFile=<tmp>`：JSON reporter 输出结构稳定
 * （numTotalTests 为 vitest 2/3/4 官方字段），vitest 存在失败用例时 JSON 仍会落盘，故不依赖 exit code；
 * 主路径用 process.execPath 直接执行 node_modules/vitest 入口（Windows 下 .cmd 无法被
 * spawnSync 直接执行且 npx.cmd 需 shell，绕开该坑）；vitest 未安装时回退 `npx ...`（shell）；
 * 落盘/解析失败回退 stdout 文本解析「Tests  N passed」；全部失败返回 -1（保守放行，不阻断门禁，
 * 与 git 不可用时 detectScriptsChanges 返回 false 的既有策略一致）。
 * 注：maxBuffer 必须放宽——vitest 全量进度输出可达数 MB，默认 1MB 会触发
 * ERR_CHILD_PROCESS_STDIO_MAXBUFFER（此时 spawn 报 error 但 JSON 文件已落盘，仍需继续读文件）。
 * 注：必须显式 --config 限定扫描范围（config/vitest.config.ts 的 include 仅
 * w-model-dev/scripts/__tests__）——vitest.config.ts 迁入 config/ 后 cwd 无默认配置，
 * 默认 include 会扫全树，嵌套 git worktree（.worktrees/**）下的测试文件将被重复计数
 * （实测根仓库 + worktree 双份 554 → 1108），导致 vitest-tests 门禁误报。
 */
function collectVitestTestCount(root: string): number {
  const outFile = join(tmpdir(), `w-model-vitest-count-${process.pid}.json`);
  const vitestArgs = ['run', '--config', 'config/vitest.config.ts', '--reporter=json', `--outputFile=${outFile}`];
  const vitestBin = findVitestBin(root);
  const r = vitestBin !== null
    ? spawnSync(process.execPath, [vitestBin, ...vitestArgs], { cwd: root, encoding: 'utf-8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 })
    : spawnSync(`npx vitest ${vitestArgs.map((a) => (/[ "&=]/.test(a) ? `"${a}"` : a)).join(' ')}`, {
        cwd: root,
        encoding: 'utf-8',
        timeout: 180_000,
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      });
  // 无论 spawn 是否报错（含 maxBuffer 超限 / vitest 失败），先尝试读 JSON 落盘文件
  try {
    const parsed = parseJsonSafe(readFileSync(outFile, 'utf-8')) as { numTotalTests?: unknown } | null;
    if (parsed !== null && typeof parsed.numTotalTests === 'number' && Number.isFinite(parsed.numTotalTests)) {
      return parsed.numTotalTests;
    }
  } catch {
    // 落盘失败（vitest 未启动 / 超时被杀 / 文件不完整）→ 回退 stdout 文本解析
  } finally {
    try {
      rmSync(outFile, { force: true });
    } catch {
      // 临时文件清理失败不影响结果
    }
  }
  const textMatch = `${r.stdout ?? ''}${r.stderr ?? ''}`.match(/Tests\s+(\d+)\s+passed/);
  return textMatch ? Number(textMatch[1]) : -1;
}

function main(): void {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const args = process.argv.slice(2).filter(a => a !== '--json');
  const jsonMode = args.length !== process.argv.slice(2).length;
  const startTime = Date.now();
  const root = pathResolve(args[0] ?? '.');
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
  const vitestTestCount = collectVitestTestCount(root);

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
    vitestTestCount,
    scriptsChanged: detectScriptsChanges(root),
    securityBaselineEntryCount: readSecurityBaselineEntryCount(root),
  };

  const violations = runDocConsistencyChecks(input);
  const exitCode = violations.length === 0 ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    // violations 分布按检查项聚合（与人类可读 `[${v.check}] ${v.message}` 对齐）
    const byCheck = new Map<string, number>();
    for (const v of violations) byCheck.set(v.check, (byCheck.get(v.check) ?? 0) + 1);
    printJsonReport({
      type: 'docs-consistency',
      passed: violations.length === 0,
      reasons: violations.map(v => `[${v.check}] ${v.message}`),
      violations: [...byCheck.entries()].map(([rule, count]) => ({ rule, count })),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('文档一致性检查（Doc Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`repo-root     : ${root}`);
  console.log(`schema 文件   : ${schemaFiles.length}`);
  console.log(`exit-2 脚本   : ${exit2ScriptCount}`);
  console.log(`persona / cur : ${personaCount} / ${cursorSkillCount}`);
  console.log(`test 文件    : ${testFileCount}`);
  console.log(`vitest 用例  : ${vitestTestCount < 0 ? '无法采集（放行）' : vitestTestCount}`);
  console.log(`检查结果      : ${violations.length === 0 ? '✓ 全部一致' : `✗ ${violations.length} 项不一致`}`);

  if (violations.length > 0) {
    console.log('─'.repeat(60));
    for (const v of violations) {
      console.log(`  - [${v.check}] ${v.message}`);
    }
  }

  printGateReport('DOCS_CONSISTENCY', { passed: violations.length === 0, violationCount: violations.length }, exitCode);
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
