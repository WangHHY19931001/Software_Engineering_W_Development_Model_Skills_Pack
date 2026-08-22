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
 *   --json   机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
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
/* eslint-disable security/detect-non-literal-fs-filename -- Vitest artifacts are admitted only after controlled-root, sibling, provenance, current-HEAD, hash, and measurement checks. */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve as pathResolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { printGateReport, printJsonReport } from '../lib/gate-report.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import {
  buildDocConsistencyReport,
  countValidExit2Scripts,
  type DocConsistencyInput,
} from '../logic/docs-consistency-logic.js';

/**
 * 本门禁所需「活体文档」路径白名单（REQUIRED_PATHS）。
 * 契约：新增 schema / 脚本 / 设计文档等资产时，若其计数或枚举被任一检查消费，须在此登记路径
 * 并在 docs-consistency-logic.ts 增加对应输入字段与检查规则；只登记「被读取的活体文档」，
 * 目录类（schemas/、subagent/、__tests__/）由 readdir 动态发现，不进本表。
 */
const REQUIRED_PATHS = [
  'package.json',
  'w-model-dev/skill-metadata.json',
  'w-model-dev/references/data-models.md',
  'w-model-dev/references/verifier-spec.md',
  'w-model-dev/references/command-reference.md',
  'w-model-dev/references/agent-personas.md',
  'w-model-dev/references/definition-of-done.md',
  'w-model-dev/references/anti-patterns.md',
  'w-model-dev/references/glossary.md',
  'w-model-dev/schemas/run-log.schema.json',
  'w-model-dev/SKILL.md',
  'w-model-dev/references/operation-behaviors.md',
  'w-model-dev/references/hard-constraints.md',
  'w-model-dev/references/dispatch-matrix.md',
  'w-model-dev/references/operational-recovery.md',
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/skill-design-document_SSoT.md',
  'docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md',
  'w-model-dev/schemas/rootcause-report.schema.json',
  'w-model-dev/scripts/logic/root-cause-logic.ts',
  'w-model-dev/references/root-cause-locator.md',
  'docs/INSTALL.md',
  'docs/user-guide.md',
  'docs/troubleshooting.md',
  'CHANGELOG.md',
  '.githooks/pre-push',
  'w-model-dev/subagent', // 目录（persona 计数）
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
 * 判定 w-model-dev/scripts 目录下 .ts 文件是否有变更（baseline 同步检查的触发条件）。
 * 合并两路 git 输出，覆盖 staged / unstaged / 未跟踪新文件：
 *   - git diff --name-only HEAD：工作树 + 暂存区相对 HEAD 的变更
 *   - git status --porcelain：含未跟踪（??）新文件，兜底 diff 未覆盖的部分
 * git 不可用（非 git 仓库 / 命令失败）时保守返回 false —— 无法判定变更时不阻断门禁。
 */
function detectScriptsChanges(root: string): boolean {
  const paths: string[] = [];
  const diff = spawnSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf-8' });
  if (diff.error === undefined && diff.status === 0) {
    paths.push(
      ...String(diff.stdout)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );
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
interface Exit2Probe {
  script: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  outputPath?: string;
}

interface Exit2ProbeResult {
  probeId: string;
  script: string;
  args: string[];
  cwd: string;
  status: number;
  errorExitCode: number | null;
  category: string | null;
  rule: string | null;
  outputPath?: string;
  outputExistsAfter?: boolean;
  emittedEvidenceExport?: boolean;
}

const execFileAsync = promisify(execFile);

/**
 * 唯一 exit-2 事实源：每个候选 CLI 的无副作用非法调用。登记只定义如何探测，
 * 最终计数仅来自真实子进程 status=2 且 ERROR_JSON.exitCode=2 的结果。
 */
function normalizeProbePath(value: string, probeRoot: string): string {
  const absoluteValue = pathResolve(value);
  const absoluteRoot = pathResolve(probeRoot);
  const rel = relative(absoluteRoot, absoluteValue).split(sep).join('/');
  if (rel === '') return '<probeRoot>';
  if (!rel.startsWith('../') && rel !== '..' && !isAbsolute(rel)) return `<probeRoot>/${rel}`;
  return value;
}

async function collectExit2ScriptResults(root: string, cliScriptFiles: string[]): Promise<Exit2ProbeResult[]> {
  const probeRoot = join(tmpdir(), `w-model-exit2-probe-${process.pid}`);
  const invalidStatusProject = join(probeRoot, 'invalid-status-project');
  const metricsProbeProject = join(probeRoot, 'probe-project');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path
  mkdirSync(join(invalidStatusProject, '.w-model'), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path
  writeFileSync(join(invalidStatusProject, '.w-model', 'project.json'), '{', 'utf-8');

  const require = createRequire(import.meta.url);
  let tsxCli: string;
  try {
    tsxCli = require.resolve('tsx/cli');
  } catch {
    return [];
  }
  const probes = new Map<string, Exit2Probe>();
  for (const file of cliScriptFiles) {
    if (
      file === 'self-test.ts' ||
      file === 'security-scan.ts' ||
      file === 'wm-export-evidence.ts' ||
      file === 'wm-status.ts' ||
      file === 'metrics-report.ts'
    )
      continue;
    const probeId = `${file}#invalid-argument`;
    probes.set(probeId, { script: file, args: ['--d4-invalid-argument'] });
  }
  probes.set('security-scan.ts#missing-path', {
    script: 'security-scan.ts',
    args: [],
    env: { ...process.env, PATH: '', Path: '' },
  });
  probes.set('metrics-report.ts#invalid-phase', {
    script: 'metrics-report.ts',
    args: [metricsProbeProject, '--phase=0', '--json'],
    cwd: probeRoot,
  });
  const exportProbeRoot = join(probeRoot, 'export-probes');
  const exportProject = join(exportProbeRoot, 'project');
  const exportOutput = join(exportProbeRoot, 'output');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path
  mkdirSync(join(exportProject, '.w-model'), { recursive: true });
  probes.set('wm-export-evidence.ts#no-args', {
    script: 'wm-export-evidence.ts',
    args: [],
    outputPath: exportOutput,
  });
  probes.set('wm-export-evidence.ts#unknown-option', {
    script: 'wm-export-evidence.ts',
    args: ['--d4-invalid-argument'],
    outputPath: exportOutput,
  });
  probes.set('wm-export-evidence.ts#verify-missing-path', {
    script: 'wm-export-evidence.ts',
    args: ['--verify'],
    outputPath: exportOutput,
  });
  probes.set('wm-status.ts#invalid-project', { script: 'wm-status.ts', args: [invalidStatusProject] });
  try {
    const results = await Promise.all(
      [...probes.entries()].map(async ([probeId, probe]): Promise<Exit2ProbeResult> => {
        const scriptPath = join(root, 'w-model-dev', 'scripts', 'cli', probe.script);
        let stdout = '';
        let status = 0;
        try {
          const result = await execFileAsync(process.execPath, [tsxCli, scriptPath, ...probe.args], {
            cwd: probe.cwd ?? root,
            env: probe.env,
            encoding: 'utf8',
            timeout: 30_000,
            maxBuffer: 64 * 1024 * 1024,
          });
          stdout = String(result.stdout ?? '');
        } catch (error) {
          const childError = error as NodeJS.ErrnoException & { stdout?: string; code?: number | string };
          stdout = String(childError.stdout ?? '');
          status = typeof childError.code === 'number' ? childError.code : -1;
        }
        const jsonLine = stdout.split(/\r?\n/).find((line) => line.startsWith('ERROR_JSON '));
        let errorExitCode: number | null = null;
        let category: string | null = null;
        let rule: string | null = null;
        if (jsonLine !== undefined) {
          const parsed = parseJsonSafe(jsonLine.slice('ERROR_JSON '.length)) as {
            exitCode?: unknown;
            category?: unknown;
            rule?: unknown;
          } | null;
          errorExitCode = typeof parsed?.exitCode === 'number' ? parsed.exitCode : null;
          category = typeof parsed?.category === 'string' ? parsed.category : null;
          rule = typeof parsed?.rule === 'string' ? parsed.rule : null;
        }
        return {
          probeId,
          script: probe.script,
          args: probe.args.map((arg) => (isAbsolute(arg) ? normalizeProbePath(arg, probeRoot) : arg)),
          cwd: probe.cwd === undefined ? '<repoRoot>' : normalizeProbePath(probe.cwd, probeRoot),
          status,
          errorExitCode,
          category,
          rule,
          ...(probe.outputPath === undefined
            ? {}
            : {
                outputPath: 'probe-output',
                // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe output path
                outputExistsAfter: existsSync(probe.outputPath),
                emittedEvidenceExport: stdout.includes('EVIDENCE_EXPORT_JSON '),
              }),
        };
      }),
    );
    return results;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

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
 * 采集技能包（w-model-dev/）内全部 .md 文档，供出站链接检查（skill-outbound-links）。
 * name = 相对 repo-root 的 POSIX 路径；baseDir = 相对技能包根 w-model-dev/ 的所在目录
 * （包根文件为 '.'，与 logic 层 checkSkillOutboundLinks 的解析语义一致）。
 */
function collectSkillPkgDocs(root: string): Array<{ name: string; content: string; baseDir: string }> {
  const pkgRoot = join(root, 'w-model-dev');
  const docs: Array<{ name: string; content: string; baseDir: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relToRoot = relative(root, p).split(sep).join('/');
        const pkgPrefix = 'w-model-dev/';
        const inPkg = relToRoot.startsWith(pkgPrefix) ? relToRoot.slice(pkgPrefix.length) : relToRoot;
        const baseDir = inPkg.includes('/') ? inPkg.slice(0, inPkg.lastIndexOf('/')) : '.';
        docs.push({ name: relToRoot, content: readFileSync(p, 'utf-8'), baseDir });
      }
    }
  };
  walk(pkgRoot);
  return docs;
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

interface VitestProvenance {
  format: 'w-model-vitest-provenance';
  version: 1;
  commitSha: string;
  runId: string;
  artifactRelativePath: string;
  artifactSha256: string;
  measurements: {
    testResults: unknown[];
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    success: boolean;
  };
}

interface VitestMeasurements {
  testFileCount: number;
  vitestTestCount: number;
  numPassedTests: number;
  numFailedTests: number;
  success: boolean;
  valid: boolean;
  reason?: string;
  runId: string;
  artifactId: string;
  artifactSha256: string;
  commitSha?: string;
}

function invalidVitestMeasurements(reason: string): VitestMeasurements {
  return {
    testFileCount: -1,
    vitestTestCount: -1,
    numPassedTests: -1,
    numFailedTests: -1,
    success: false,
    valid: false,
    reason,
    runId: '',
    artifactId: '',
    artifactSha256: '',
    commitSha: undefined,
  };
}

/** 同一 JSON 是动态文件数、测试数和执行成功状态的不可分割事实包。 */
function parseVitestMeasurements(
  value: unknown,
  metadata: { runId: string; artifactId: string; artifactSha256: string; commitSha?: string },
): VitestMeasurements {
  if (value === null || typeof value !== 'object')
    return { ...invalidVitestMeasurements('JSON 根必须为对象'), ...metadata };
  const record = value as Record<string, unknown>;
  const { testResults, numTotalTests, numPassedTests, numFailedTests, success } = record;
  const counts = [numTotalTests, numPassedTests, numFailedTests];
  if (!Array.isArray(testResults)) return invalidVitestMeasurements('testResults 必须为数组');
  if (
    !counts.every(
      (count) => typeof count === 'number' && Number.isFinite(count) && Number.isInteger(count) && count >= 0,
    )
  ) {
    return invalidVitestMeasurements('测试计数字段必须为有限非负整数');
  }
  if (typeof success !== 'boolean') return invalidVitestMeasurements('success 必须为布尔值');
  const measurements = {
    testFileCount: testResults.length,
    vitestTestCount: numTotalTests as number,
    numPassedTests: numPassedTests as number,
    numFailedTests: numFailedTests as number,
    success,
  };
  if (
    measurements.success !== true ||
    measurements.numFailedTests !== 0 ||
    measurements.numPassedTests !== measurements.vitestTestCount
  ) {
    return {
      ...measurements,
      valid: false,
      reason: 'success 必须为 true、失败数为 0 且 passed 必须等于 total',
      runId: metadata.runId,
      artifactId: metadata.artifactId,
      artifactSha256: metadata.artifactSha256,
      commitSha: metadata.commitSha,
    };
  }
  return {
    ...measurements,
    valid: true,
    runId: metadata.runId,
    artifactId: metadata.artifactId,
    artifactSha256: metadata.artifactSha256,
    commitSha: metadata.commitSha,
  };
}

/**
 * 从 Vitest JSON outputFile 提取完整实测事实包（不 spawn）。来源：pre-push 第 12 项已全量跑过 vitest 并 `--reporter=json --outputFile=...`，
 * 通过环境变量 WM_VITEST_COUNT_FILE 传入本脚本，直接复用同一次成功运行的所有字段。
 */
function currentCommitSha(root: string | undefined): string | undefined {
  if (root === undefined) return undefined;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8', timeout: 15_000 });
  const sha = String(result.stdout ?? '').trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : undefined;
}

function isPathWithin(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function isSafeArtifactRelativePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !isAbsolute(value) &&
    !value.includes('\\\\') &&
    !value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  );
}

function readVitestArtifact(
  filePath: string,
  artifactId: string,
  root?: string,
  provenanceOverride?: string,
): VitestMeasurements {
  try {
    const provenanceFile = provenanceOverride ?? process.env.WM_VITEST_PROVENANCE_FILE;
    if (provenanceFile === undefined || provenanceFile === '')
      return invalidVitestMeasurements('缺少受控 provenance 文件');
    const provenancePath = pathResolve(provenanceFile);
    const artifactAbsolute = pathResolve(filePath);
    const controlledRoot =
      provenanceOverride === undefined ? process.env.WM_VITEST_PROVENANCE_ROOT : dirname(provenancePath);
    if (controlledRoot === undefined || controlledRoot === '')
      return invalidVitestMeasurements('缺少受控 artifact 目录');
    const controlledAbsolute = pathResolve(controlledRoot!);
    if (
      !isPathWithin(controlledAbsolute, provenancePath) ||
      !isPathWithin(controlledAbsolute, artifactAbsolute) ||
      pathResolve(dirname(provenancePath)) !== pathResolve(dirname(artifactAbsolute))
    )
      return invalidVitestMeasurements('artifact 不在 provenance 受控目录');
    const provenanceStat = lstatSync(provenancePath);
    const artifactStat = lstatSync(artifactAbsolute);
    if (!provenanceStat.isFile() || !artifactStat.isFile())
      return invalidVitestMeasurements('artifact/provenance 必须为普通文件');
    const provenance = parseJsonSafe(readFileSync(provenancePath, 'utf-8')) as Partial<VitestProvenance> | null;
    const currentSha = currentCommitSha(root);
    const provenanceValid =
      provenance?.format === 'w-model-vitest-provenance' &&
      provenance.version === 1 &&
      isSafeArtifactRelativePath(provenance.artifactRelativePath) &&
      pathResolve(dirname(provenancePath), provenance.artifactRelativePath) === artifactAbsolute &&
      pathResolve(dirname(provenancePath)) === pathResolve(dirname(artifactAbsolute)) &&
      typeof provenance.commitSha === 'string' &&
      /^[0-9a-f]{40}$/i.test(provenance.commitSha) &&
      provenance.commitSha.toLowerCase() === currentSha?.toLowerCase() &&
      typeof provenance.runId === 'string' &&
      /^[0-9a-f]{16}$/i.test(provenance.runId) &&
      typeof provenance.artifactSha256 === 'string' &&
      /^[0-9a-f]{64}$/i.test(provenance.artifactSha256);
    if (!provenanceValid) {
      return invalidVitestMeasurements('Vitest artifact provenance 不可信');
    }
    const content = readFileSync(artifactAbsolute, 'utf-8');
    const artifactSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
    if (artifactSha256 !== provenance.artifactSha256)
      return invalidVitestMeasurements('Vitest artifact hash 与 provenance 不一致');
    const parsed = parseJsonSafe(content);
    const record = parsed as Record<string, unknown> | null;
    const measurements = provenance.measurements;
    if (
      measurements === null ||
      typeof measurements !== 'object' ||
      JSON.stringify(record) !== JSON.stringify(measurements)
    )
      return invalidVitestMeasurements('Vitest coverage measurements 与 provenance 不一致');
    const runId = provenance.runId;
    const commitSha = provenance.commitSha;
    if (typeof runId !== 'string' || typeof commitSha !== 'string')
      return invalidVitestMeasurements('Vitest artifact provenance 缺少身份字段');
    return parseVitestMeasurements(parsed, {
      runId,
      artifactId,
      artifactSha256,
      commitSha,
    });
  } catch {
    return invalidVitestMeasurements('无法读取或解析受控 Vitest JSON/provenance');
  }
}

function readVitestCountFile(root: string): VitestMeasurements | null {
  const envFile = process.env.WM_VITEST_COUNT_FILE;
  if (envFile === undefined || envFile === '') return null;
  const filePath = isAbsolute(envFile) || /^[a-zA-Z]:[\\/]/.test(envFile) ? pathResolve(envFile) : null;
  if (filePath === null || !existsSync(filePath)) return null;
  return readVitestArtifact(filePath, 'vitest/results.json', root);
}

/**
 * 采集 Vitest 完整运行事实包（堵住只查文件数或用例总数的盲区）。
 * 优先级（快路径优先，避免重复全量 vitest）：
 *   1. 环境变量 WM_VITEST_COUNT_FILE 指向的 vitest JSON outputFile（pre-push 第 12 项复用）→ 直接读取，不 spawn；
 *   2. 未提供可用 JSON 时，一律显式 spawn Vitest 采集（不以 scriptsChanged 跳过）。
 * 主路径用 process.execPath 直接执行 node_modules/vitest 入口（Windows 下 .cmd 无法被
 * spawnSync 直接执行且 npx.cmd 需 shell，绕开该坑）；vitest 未安装时回退 `npx ...`（shell）；
 * 落盘/解析失败回退 stdout 文本解析「Tests  N passed」；全部失败返回 -1，由逻辑层生成
 * `vitest-tests` 违规并 fail-closed。
 * 注：maxBuffer 必须放宽——vitest 全量进度输出可达数 MB，默认 1MB 会触发
 * ERR_CHILD_PROCESS_STDIO_MAXBUFFER（此时 spawn 报 error 但 JSON 文件已落盘，仍需继续读文件）。
 * 注：必须显式 --config 限定扫描范围（config/vitest.config.ts 的 include 仅
 * w-model-dev/scripts/__tests__）——vitest.config.ts 迁入 config/ 后 cwd 无默认配置，
 * 默认 include 会扫全树，嵌套 git worktree（.worktrees/**）下的测试文件将被重复计数
 * （实测根仓库 + worktree 双份 554 → 1108），导致 vitest-tests 门禁误报。
 */
function collectVitestMeasurements(root: string): VitestMeasurements {
  const fromFile = readVitestCountFile(root);
  if (fromFile !== null) return fromFile;
  const outFile = join(tmpdir(), `w-model-vitest-count-${process.pid}.json`);
  const vitestArgs = ['run', '--config', 'config/vitest.config.ts', '--reporter=json', `--outputFile=${outFile}`];
  const vitestBin = findVitestBin(root);
  if (vitestBin !== null) {
    spawnSync(process.execPath, [vitestBin, ...vitestArgs], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 180_000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } else {
    spawnSync(`npx vitest ${vitestArgs.map((a) => (/[ "&=]/.test(a) ? `"${a}"` : a)).join(' ')}`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 180_000,
      maxBuffer: 64 * 1024 * 1024,
      shell: true,
    });
  }
  // 无论 spawn 是否报错（含 maxBuffer 超限 / vitest 失败），先尝试读 JSON 落盘文件。
  // 自采集路径在本次读取前生成同目录 provenance，避免外部环境变量伪造 passing artifact。
  const selfProvenance = `${outFile}.provenance.json`;
  try {
    if (existsSync(outFile)) {
      const raw = readFileSync(outFile, 'utf-8');
      const parsed = parseJsonSafe(raw) as Record<string, unknown>;
      const commitSha = currentCommitSha(root);
      const runId = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
      const selfProvenanceValue = {
        format: 'w-model-vitest-provenance',
        version: 1,
        commitSha,
        runId,
        artifactRelativePath: basename(outFile),
        artifactSha256: createHash('sha256').update(raw, 'utf8').digest('hex'),
        measurements: parsed,
      };
      writeFileSync(selfProvenance, JSON.stringify(selfProvenanceValue), 'utf-8');
      return readVitestArtifact(outFile, 'vitest/generated-results.json', root, selfProvenance);
    }
    return invalidVitestMeasurements('Vitest JSON 未生成或不可解析');
  } catch {
    return invalidVitestMeasurements('Vitest JSON 未生成或不可解析');
  } finally {
    try {
      rmSync(outFile, { force: true });
      rmSync(selfProvenance, { force: true });
    } catch {
      // 临时文件清理失败不影响结果
    }
  }
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const args = process.argv.slice(2).filter((a) => a !== '--json');
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

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- REQUIRED_PATHS and document inventories are repository-controlled
  const read = (p: string): string => readFileSync(join(root, p), 'utf-8');
  const schemaFiles = readdirSync(join(root, 'w-model-dev/schemas'))
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
  const personaCount = readdirSync(join(root, 'w-model-dev/subagent')).filter((f) => f.endsWith('.md')).length;
  const referencesCount = readdirSync(join(root, 'w-model-dev/references')).filter((f) => f.endsWith('.md')).length;
  const cliScriptFiles = readdirSync(join(root, 'w-model-dev/scripts/cli'))
    .filter((f) => f.endsWith('.ts'))
    .sort();
  const exit2ProbeResults = await collectExit2ScriptResults(root, cliScriptFiles);
  const exit2ScriptCount = countValidExit2Scripts(exit2ProbeResults);
  const designDocs = DESIGN_DOC_NAMES.map((name) => ({ name, content: read(join('docs', name)) }));
  // 目录枚举仅用于 inventory 诊断；活体 Vitest 文件/用例计数必须来自同一份 JSON 事实包。
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository-controlled test inventory path
  const testDirectoryInventoryCount = readdirSync(join(root, 'w-model-dev/scripts/__tests__')).filter((f) =>
    f.endsWith('.test.ts'),
  ).length;
  const vitestMeasurements = collectVitestMeasurements(root);
  const testFileCount = vitestMeasurements.testFileCount;
  const vitestTestCount = vitestMeasurements.vitestTestCount;
  const scriptsChanged = detectScriptsChanges(root);

  // C3 内链存在性数据源：SKILL.md + references/*.md + README.md + AGENTS.md + SSoT（核心导航文档集）
  const referenceFiles = readdirSync(join(root, 'w-model-dev/references'))
    .filter((f) => f.endsWith('.md'))
    .sort();
  const linkDocs = [
    { name: 'SKILL.md', content: read('w-model-dev/SKILL.md'), baseDir: 'w-model-dev' },
    ...referenceFiles.map((f) => ({
      name: `references/${f}`,
      content: read(join('w-model-dev/references', f)),
      baseDir: 'w-model-dev/references',
    })),
    { name: 'README.md', content: read('README.md'), baseDir: '.' },
    { name: 'AGENTS.md', content: read('AGENTS.md'), baseDir: '.' },
    {
      name: 'docs/skill-design-document_SSoT.md',
      content: read('docs/skill-design-document_SSoT.md'),
      baseDir: 'docs',
    },
  ];

  // docs/INSTALL.md 被 installDoc 与 vitestExtraDocs 各消费一次——先读取复用到两处，避免重复 IO
  const installDocText = read('docs/INSTALL.md');

  const input: DocConsistencyInput = {
    schemaFiles,
    personaCount,
    referencesCount,
    exit2ScriptCount,
    dataModels: read('w-model-dev/references/data-models.md'),
    schemaInventoryDocs: [
      { name: 'README.md', content: read('README.md') },
      { name: 'AGENTS.md', content: read('AGENTS.md') },
      { name: 'CONTRIBUTING.md', content: read('CONTRIBUTING.md') },
      { name: 'docs/INSTALL.md', content: installDocText },
      { name: 'SSoT', content: read('docs/skill-design-document_SSoT.md') },
      { name: 'SKILL.md', content: read('w-model-dev/SKILL.md') },
      { name: 'anti-patterns.md #28', content: read('w-model-dev/references/anti-patterns.md') },
      { name: 'docs/user-guide.md', content: read('docs/user-guide.md') },
    ],
    verifierSpec: read('w-model-dev/references/verifier-spec.md'),
    commandReference: read('w-model-dev/references/command-reference.md'),
    agentPersonas: read('w-model-dev/references/agent-personas.md'),
    definitionOfDone: read('w-model-dev/references/definition-of-done.md'),
    antiPatterns: read('w-model-dev/references/anti-patterns.md'),
    glossary: read('w-model-dev/references/glossary.md'),
    runLogSchema: read('w-model-dev/schemas/run-log.schema.json'),
    skill: read('w-model-dev/SKILL.md'),
    operationBehaviors: read('w-model-dev/references/operation-behaviors.md'),
    hardConstraints: read('w-model-dev/references/hard-constraints.md'),
    dispatchMatrix: read('w-model-dev/references/dispatch-matrix.md'),
    readme: read('README.md'),
    agents: read('AGENTS.md'),
    ssot: read('docs/skill-design-document_SSoT.md'),
    rootCauseAuthoritySpec: read('w-model-dev/references/subagent-persona-matrix.md'),
    rootCauseSchema: read('w-model-dev/schemas/rootcause-report.schema.json'),
    rootCauseCheckerSource: read('w-model-dev/scripts/logic/root-cause-logic.ts'),
    rootCauseSsot: read('docs/skill-design-document_SSoT.md'),
    rootCauseLocator: read('w-model-dev/references/root-cause-locator.md'),
    rootCauseVerifierSpec: read('w-model-dev/references/verifier-spec.md'),
    rootCauseCommandReference: read('w-model-dev/references/command-reference.md'),
    prePush: read('.githooks/pre-push'),
    vitestExtraDocs: [
      { name: 'CONTRIBUTING.md', content: read('CONTRIBUTING.md') },
      { name: 'docs/INSTALL.md', content: installDocText },
    ],
    prTemplate: read('.github/PULL_REQUEST_TEMPLATE.md'),
    changelog: read('CHANGELOG.md'),
    pkgJson: read('package.json'),
    metaJson: read('w-model-dev/skill-metadata.json'),
    installDoc: installDocText,
    lockJson: read('package-lock.json'),
    designDocs,
    testFileCount,
    vitestTestCount,
    vitestMeasurementsValid: vitestMeasurements.valid,
    vitestMeasurementsReason: vitestMeasurements.reason,
    vitestPassedCount: vitestMeasurements.numPassedTests,
    vitestFailedCount: vitestMeasurements.numFailedTests,
    vitestSuccess: vitestMeasurements.success,
    vitestRunId: vitestMeasurements.runId,
    vitestArtifactId: vitestMeasurements.artifactId,
    vitestArtifactSha256: vitestMeasurements.artifactSha256,
    vitestCommitSha: vitestMeasurements.commitSha,
    testDirectoryInventoryCount,
    exit2ProbeResults,
    a4Docs: {
      ssot: read('docs/skill-design-document_SSoT.md'),
      skill: read('w-model-dev/SKILL.md'),
      dispatchMatrix: read('w-model-dev/references/dispatch-matrix.md'),
      operationalRecovery: read('w-model-dev/references/operational-recovery.md'),
      dataModels: read('w-model-dev/references/data-models.md'),
      commandReference: read('w-model-dev/references/command-reference.md'),
      readme: read('README.md'),
      install: installDocText,
      agents: read('AGENTS.md'),
      contributing: read('CONTRIBUTING.md'),
      troubleshooting: read('docs/troubleshooting.md'),
      changelog: read('CHANGELOG.md'),
    },
    scriptsChanged,
    cliScriptFiles,
    securityBaselineEntryCount: readSecurityBaselineEntryCount(root),
    linkDocs,
    linkExists: (relPath: string) => existsSync(join(root, relPath)),
    skillPkgDocs: collectSkillPkgDocs(root),
    localEvidenceDocs: [
      { name: 'README.md', content: read('README.md') },
      { name: 'AGENTS.md', content: read('AGENTS.md') },
      { name: 'CONTRIBUTING.md', content: read('CONTRIBUTING.md') },
      { name: 'docs/INSTALL.md', content: installDocText },
      { name: 'SKILL.md', content: read('w-model-dev/SKILL.md') },
      { name: 'command-reference.md', content: read('w-model-dev/references/command-reference.md') },
    ],
  };

  const report = buildDocConsistencyReport(input);
  const { violations } = report;
  const exitCode = violations.length === 0 ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    // violations 分布按检查项聚合（与人类可读 `[${v.check}] ${v.message}` 对齐）
    const byCheck = new Map<string, number>();
    for (const v of violations) byCheck.set(v.check, (byCheck.get(v.check) ?? 0) + 1);
    printJsonReport(
      {
        type: 'docs-consistency',
        passed: violations.length === 0,
        reasons: violations.map((v) => `[${v.check}] ${v.message}`),
        violations: [...byCheck.entries()].map(([rule, count]) => ({ rule, count })),
        staticViolations: report.staticViolations,
        dynamicViolations: report.dynamicViolations,
        dynamicMeasurements: report.dynamicMeasurements,
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('文档一致性检查（Doc Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`repo-root     : ${root}`);
  console.log(`schema 文件   : ${schemaFiles.length}`);
  console.log(`exit-2 脚本   : ${exit2ScriptCount}`);
  console.log(`persona 文件   : ${personaCount}`);
  console.log(`test 文件    : ${testFileCount}`);
  console.log(`vitest 用例  : ${vitestTestCount < 0 ? '无法采集（不一致）' : vitestTestCount}`);
  console.log(`静态违规      : ${report.staticViolations.length}`);
  console.log(`动态违规      : ${report.dynamicViolations.length}`);
  console.log(`检查结果      : ${violations.length === 0 ? '✓ 全部一致' : `✗ ${violations.length} 项不一致`}`);

  if (violations.length > 0) {
    console.log('─'.repeat(60));
    for (const v of violations) {
      console.log(`  - [${v.check}] ${v.message}`);
    }
  }

  printGateReport(
    'DOCS_CONSISTENCY',
    {
      passed: violations.length === 0,
      violationCount: violations.length,
      staticViolationCount: report.staticViolations.length,
      dynamicViolationCount: report.dynamicViolations.length,
      dynamicMeasurements: report.dynamicMeasurements,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// Windows 兼容的 main 模块判断：
//   - import.meta.url 是 file:///D:/... URL 格式
//   - process.argv[1] 是 Windows 路径 D:\... 或 POSIX 路径
//   用 fileURLToPath + pathResolve 归一化两端再比较，避免斜杠方向 / 盘符大小写差异。
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === pathResolve(entryArg);
if (isMain) {
  runMain(main);
}
