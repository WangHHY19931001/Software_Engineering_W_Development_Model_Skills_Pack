#!/usr/bin/env tsx
/**
 * Phase 1 read-only discovery entry point (static inventory + real dynamic trace).
 *
 * Flags:
 *   --root <dir>        explicit repository root (required)
 *   --output <file>     report path; normally outside the repository (required)
 *   --scenario <file>   JSON `{ "scenarios": [...] }` (required)
 *   --platform <name>   overrides the current host platform for scenario applicability
 *   --shell <name>      default shell label recorded in the environment matrix
 *
 * Unknown flags (including `--delete` / `--apply`) are input errors: exit 2 with the existing
 * structured `ERROR_JSON` contract. Phase 1 is read-only over source: it writes only the external
 * report and exclusive raw outputs beneath the gitignored `.w-model/` evidence root. `changedFiles`
 * is the honest before/after `git status` delta **limited to the analyzed target list** (the caller's
 * `--scenario`-derived targets): a change to an analyzed target is a loud read-only violation, while
 * unrelated files (including concurrent sibling-test transients) are deliberately not attributed.
 *
 * Exit codes:
 *   0  every candidate passed `validateCodeHealthCandidate`
 *   1  at least one candidate failed validation, or the repository revision is unavailable
 *   2  input error (unknown/duplicate flag, missing flag, unreadable scenario file)
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type {
  CandidateSelector,
  CodeHealthCandidate,
  CommandEvidence,
  EnvironmentObservation,
  FalsePositiveContext,
  Phase1RunResult,
  RevisionIdentity,
  StaticReference,
} from '../logic/code-health-contract.js';
import { validateCodeHealthCandidate } from '../logic/code-health-contract.js';
import {
  buildStaticInventory,
  checkFalsePositiveGuards,
  classifyScenario,
  deriveFalsePositiveContext,
  environmentRow,
  mergeDynamicTrace,
  sha256Hex,
  type DynamicTraceInputScenario,
  type Phase1Scenario,
} from '../logic/code-health-phase1-logic.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { resolveControlledRelativePath } from '../lib/code-health-file-verifier.js';
import { exitWithError } from '../lib/cli-error.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

const DEFAULT_RAW_OUTPUT_ROOT = '.w-model/code-health/phase1/raw';
const GIT_STATUS_TIMEOUT_MS = 30_000;
const GIT_STATUS_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const execFileAsync = promisify(execFile);

export interface Phase1RunInput {
  root: string;
  output: string;
  scenarios: Phase1Scenario[];
  platform?: string;
  shell?: string;
  rawOutputDir?: string;
  now?: () => Date;
  /**
   * Injected read-only worktree comparison scoped to the analyzed target paths (default:
   * `git status --porcelain -z -- <targets>`). Returns the changed/untracked repository-relative
   * paths, or `null` when the worktree cannot be verified.
   */
  readChangedFiles?: (root: string, paths: readonly string[]) => Promise<string[] | null>;
}

/** The full read-only report that Phase 1 persists; the pure contract result is a projection of it. */
export interface Phase1ReportFile {
  schemaVersion: '1.0';
  reportId: string;
  generatedAt: string;
  revision: RevisionIdentity;
  repositoryRoot: string;
  environmentMatrix: EnvironmentObservation[];
  files: string[];
  references: StaticReference[];
  categories: string[];
  unknowns: string[];
  falsePositiveContext: FalsePositiveContext;
  unexercisedScenarios: string[];
  commands: CommandEvidence[];
  candidates: CodeHealthCandidate[];
  validationViolations: string[];
}

function sourceDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Minimal audited Git environment: no `GIT_DIR`/`GIT_WORK_TREE` redirect can reach the child. */
function gitEnvironment(): NodeJS.ProcessEnv {
  const passthroughKeys = [
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'WINDIR',
    'COMSPEC',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'APPDATA',
    'LOCALAPPDATA',
    'PROGRAMDATA',
    'LANG',
    'LC_ALL',
    'TERM',
  ] as const;
  return Object.fromEntries([
    ['GIT_CONFIG_NOSYSTEM', '1'],
    ['GIT_CONFIG_GLOBAL', process.platform === 'win32' ? 'NUL' : '/dev/null'],
    ['GIT_TERMINAL_PROMPT', '0'],
    ['GIT_OPTIONAL_LOCKS', '0'],
    ['GIT_PAGER', 'cat'],
    ...passthroughKeys.flatMap((key) => {
      // eslint-disable-next-line security/detect-object-injection -- key is a literal member of the passthrough allowlist above.
      const value = process.env[key];
      return typeof value === 'string' && value.length > 0 ? [[key, value] as const] : [];
    }),
  ]);
}

/** Parse `git status --porcelain=v1 -z` into sorted repository-relative paths. */
function parseWorktreeStatus(stdout: string): string[] {
  const paths = new Set<string>();
  for (const entry of stdout.split('\u0000')) {
    if (entry.length <= 3 || !/^[ MADRCU?!]{2} /.test(entry)) continue;
    const file = entry.slice(3).replace(/\\/g, '/');
    if (file.length > 0) paths.add(file);
  }
  return [...paths].sort();
}

/**
 * Default read-only worktree comparison, scoped to the analyzed target paths so concurrent work on
 * unrelated files cannot be misattributed. `null` means Git could not report the worktree, so the
 * read-only invariant is unverifiable and the caller fails loudly instead of asserting an empty diff.
 */
async function readWorktreeChanges(root: string, paths: readonly string[]): Promise<string[] | null> {
  const scoped = [...new Set(paths.map((file) => file.replace(/\\/g, '/')))].filter((file) => file.length > 0);
  if (scoped.length === 0) return [];
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...scoped],
      {
        cwd: root,
        env: gitEnvironment(),
        shell: false,
        windowsHide: true,
        timeout: GIT_STATUS_TIMEOUT_MS,
        maxBuffer: GIT_STATUS_MAX_BUFFER_BYTES,
        encoding: 'utf8',
      },
    );
    return parseWorktreeStatus(String(stdout));
  } catch {
    return null;
  }
}

/** Read one controlled repository-relative source file; any unsafe or unreadable path is `unavailable`. */
async function readControlledSource(root: string, relativePath: string): Promise<string | undefined> {
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || !resolution.absolutePath) return undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolution.absolutePath is bounded by resolveControlledRelativePath.
    const entry = await fs.lstat(resolution.absolutePath);
    if (entry.isSymbolicLink() || !entry.isFile()) return undefined;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolution.absolutePath is bounded by resolveControlledRelativePath.
    return await fs.readFile(resolution.absolutePath, 'utf8');
  } catch {
    return undefined;
  }
}

function makeScenarioSelector(candidateId: string, scenario: Phase1Scenario): CandidateSelector {
  const files = (scenario.targets ?? ['package.json']).map((file) => file.replace(/\\/g, '/'));
  const symbols = ['phase1-discovery'];
  return {
    candidateId,
    phase: 'P1',
    action: 'delete-code',
    files,
    symbols,
    scopeHash: `sha256:${sha256Hex(`scenario|${scenario.id}`)}`,
  };
}

function makeCandidate(
  candidateId: string,
  files: string[],
  symbols: string[],
  status: CodeHealthCandidate['status'],
  revision: RevisionIdentity,
  commands: CommandEvidence[],
  guardViolations: string[],
): CodeHealthCandidate {
  const scopeHash = `sha256:${sha256Hex(`P1|${files.join(',')}|${symbols.join(',')}`)}`;
  const selector: CandidateSelector = {
    candidateId,
    phase: 'P1',
    action: 'delete-code',
    files,
    symbols,
    scopeHash,
  };
  const evidence = commands[0]!;
  const emptyCoverage = {
    statements: null,
    branches: null,
    functions: null,
    lines: null,
  };
  const impact = {
    rtmBefore: [],
    rtmAfter: [],
    coverageBefore: { ...emptyCoverage },
    coverageAfter: { ...emptyCoverage },
    testLevels: [],
    unmappedScenarios: [],
    coverageIsSignalOnly: true as const,
  };
  return {
    candidateId,
    phase: 'P1',
    action: 'delete-code',
    status,
    files,
    symbols,
    tests: [],
    callSites: [],
    sources: ['static-inventory', 'dynamic-trace'],
    commands,
    revision,
    confidence: {
      level: 'low',
      score: 0.3,
      rationale: 'static absence plus a single environment trace are leads only; guards block any deadness claim',
      uncertainties: guardViolations.length > 0 ? guardViolations : ['dynamic reachability was not confirmed'],
    },
    risk: {
      severity: 'low',
      behavior: 'unknown',
      security: 'unknown',
      concurrency: 'unknown',
      platform: 'unknown',
      lifecycle: 'unknown',
      governance: 'low',
      rationale: 'phase 1 records discovery evidence only and makes no deletion decision',
    },
    rtmImpact: {
      ...impact,
      coverageBefore: { ...emptyCoverage },
      coverageAfter: { ...emptyCoverage },
    },
    coverageImpact: {
      ...impact,
      coverageBefore: { ...emptyCoverage },
      coverageAfter: { ...emptyCoverage },
    },
    rollback: {
      preChangeRevision: revision.commitSha,
      command: 'git apply -R <rollback.patch>',
      patchPath: '.w-model/code-health/phase1/rollback.patch',
      owner: 'S-agent',
      executable: false,
    },
    review: {
      findings: [],
      unresolvedQuestions: guardViolations,
      decision: null,
      humanDecision: null,
    },
    signatures: [],
    changeScope: { files, symbols, scopeHash },
    evidenceBinding: {
      candidate: selector,
      revision,
      rawOutputPath: evidence.rawOutputPath,
      rawOutputSha256: evidence.rawOutputSha256,
    },
    evidenceRef: `.w-model/code-health/phase1/evidence/${candidateId}.json`,
    archive: {
      state: 'not_archived',
      manifestPath: null,
      contentHash: null,
      redactionStatus: 'not_reviewed',
    },
  };
}

async function writeReportFile(output: string, report: Phase1ReportFile): Promise<void> {
  const absolute = path.resolve(output);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- `output` is the explicit external report path supplied by the caller.
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- `output` is the explicit external report path supplied by the caller.
  await fs.writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

/**
 * Read-only Phase 1 orchestration. Only this IO layer touches the filesystem, Git, and child
 * processes; every decision is delegated to the pure `code-health-phase1-logic` functions above.
 */
export async function runPhase1(input: Phase1RunInput): Promise<Phase1RunResult> {
  const repositoryRoot = path.resolve(input.root);
  const now = input.now ?? (() => new Date());
  const platform = input.platform ?? process.platform;
  const rawOutputDir = input.rawOutputDir ?? DEFAULT_RAW_OUTPUT_ROOT;
  const revisionProvider = createCodeHealthGitRevisionProvider();
  const revision = await revisionProvider.current(repositoryRoot);
  if (!revision) {
    // Nothing was read or written on this path, so an empty change set is the honest value.
    return {
      exitCode: 2,
      report: {
        candidates: [],
        commands: [],
        unexercisedScenarios: input.scenarios.map((scenario) => scenario.id),
      },
      changedFiles: [],
    };
  }
  const targets = [...new Set(input.scenarios.flatMap((scenario) => scenario.targets ?? []))];
  const readChangedFiles = input.readChangedFiles ?? readWorktreeChanges;
  const beforeChanges = await readChangedFiles(repositoryRoot, targets);
  const beforeChangedSet = new Set(beforeChanges ?? []);
  const evidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot,
    rawOutputRoot: rawOutputDir,
  });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot,
    rawOutputDir,
    evidenceStore,
    revisionProvider,
  });

  const runCandidateId = `CHG-P1-${revision.analyzedAt.slice(0, 10).replace(/-/g, '')}-900`;
  const commands: CommandEvidence[] = [];
  const unexercisedScenarios: string[] = [];
  const traceScenarios: DynamicTraceInputScenario[] = [];
  const environmentMatrix: EnvironmentObservation[] = [];
  let requiredEnvironmentUnavailable = false;

  for (const scenario of input.scenarios) {
    const applicability = classifyScenario(scenario, platform);
    if (!applicability.applicable) {
      unexercisedScenarios.push(scenario.id);
      traceScenarios.push({
        id: scenario.id,
        environment: scenario.environment,
        reached: null,
        observation: applicability.observation,
        required: scenario.required,
        platform: scenario.platform,
      });
      environmentMatrix.push(
        environmentRow(scenario, platform, applicability.observation, applicability.reason, input.shell),
      );
      if (scenario.required === true) requiredEnvironmentUnavailable = true;
      continue;
    }
    const command = scenario.command === 'node' ? process.execPath : scenario.command;
    const binding = {
      candidate: makeScenarioSelector(runCandidateId, scenario),
      revision,
      rawOutputPath: '.w-model/code-health/phase1/pending.log',
      rawOutputSha256: '0'.repeat(64),
    };
    const evidence = await runner.run(command, scenario.args ?? [], {
      cwd: scenario.cwd ?? '.',
      env: scenario.env ?? {},
      timeoutMs: scenario.timeoutMs ?? 30_000,
      binding,
    });
    commands.push(evidence);
    const reached = evidence.observation === 'observed' ? evidence.exitCode === 0 : null;
    traceScenarios.push({
      id: scenario.id,
      environment: scenario.environment,
      reached,
      observation: evidence.observation,
      command: evidence,
      required: scenario.required,
      platform: scenario.platform,
    });
    environmentMatrix.push(
      environmentRow(scenario, platform, evidence.observation, 'command executed by the runner', input.shell),
    );
    if (reached !== true) unexercisedScenarios.push(scenario.id);
    if (scenario.required === true && evidence.observation !== 'observed') requiredEnvironmentUnavailable = true;
  }

  const sourceText: Record<string, string> = {};
  const unreadable: string[] = [];
  for (const target of targets) {
    const source = await readControlledSource(repositoryRoot, target);
    if (source === undefined) unreadable.push(target);
    // eslint-disable-next-line security/detect-object-injection -- target is a repository-relative path from the injected target list.
    else sourceText[target] = source;
  }
  const staticReport = buildStaticInventory({
    files: targets,
    sourceText,
    revision,
  });
  for (const file of unreadable) {
    if (!staticReport.unknowns.includes(file)) staticReport.unknowns.push(file);
  }
  const traceInput = {
    revision,
    scenarios: traceScenarios,
    rawTraceSha256: sha256Hex(
      JSON.stringify(traceScenarios.map((scenario) => [scenario.id, scenario.observation, scenario.reached])),
    ),
  };
  const leads = commands.length === 0 ? [] : mergeDynamicTrace(staticReport, traceInput);
  const context = deriveFalsePositiveContext(
    staticReport,
    input.scenarios.map((scenario) => scenario.platform ?? platform),
  );

  const candidates: CodeHealthCandidate[] = [];
  const validationViolations: string[] = [];
  for (const lead of leads) {
    const guardViolations = checkFalsePositiveGuards(lead, context);
    lead.guardViolations = guardViolations;
    if (guardViolations.length > 0 && lead.classification === 'candidate') lead.classification = 'unknown';
    if (requiredEnvironmentUnavailable || lead.files.some((file) => unreadable.includes(file))) {
      lead.classification = 'blocked';
      lead.status = 'blocked';
    }
    const candidate = makeCandidate(
      lead.candidateId,
      lead.files,
      lead.symbols,
      lead.status,
      revision,
      commands,
      guardViolations,
    );
    const reasons = validateCodeHealthCandidate(candidate);
    if (reasons.length > 0) validationViolations.push(...reasons.map((reason) => `${lead.candidateId}: ${reason}`));
    candidates.push(candidate);
  }

  // Read-only invariant: compare the analyzed targets before and after the run. Pre-existing dirt
  // appears in both snapshots and is not misattributed; any target the tool itself changed appears
  // only after. The comparison is scoped to targets so concurrent work on other files cannot leak in.
  const afterChanges = await readChangedFiles(repositoryRoot, targets);
  const changedFiles =
    beforeChanges === null || afterChanges === null
      ? []
      : afterChanges.filter((file) => !beforeChangedSet.has(file)).sort();
  if (beforeChanges === null || afterChanges === null) {
    validationViolations.push('read-only invariant could not be verified: worktree change comparison unavailable');
  } else if (changedFiles.length > 0) {
    validationViolations.push(`read-only invariant violated: phase 1 changed ${changedFiles.join(', ')}`);
  }

  const report: Phase1ReportFile = {
    schemaVersion: '1.0',
    reportId: `P1-${sourceDigest(Buffer.from(JSON.stringify(targets))).slice(0, 12)}`,
    generatedAt: now().toISOString(),
    revision,
    repositoryRoot: '.',
    environmentMatrix,
    files: staticReport.files,
    references: staticReport.references,
    categories: staticReport.categories,
    unknowns: staticReport.unknowns,
    falsePositiveContext: context,
    unexercisedScenarios,
    commands,
    candidates,
    validationViolations,
  };
  await writeReportFile(input.output, report);

  return {
    exitCode: validationViolations.length === 0 ? 0 : 1,
    report: { candidates, commands, unexercisedScenarios },
    changedFiles,
  };
}

// -------------------- CLI --------------------

const VALUE_FLAGS = ['root', 'output', 'scenario', 'platform', 'shell'] as const;

/**
 * Usage detail surfaced on every input error. It states the honest `changedFiles` detection range: the
 * read-only invariant is scoped to the analyzed target list, so unrelated worktree changes are not
 * attributed to Phase 1.
 */
export const PHASE1_USAGE_DETAIL =
  'usage: code-health-phase1.ts --root <dir> --output <report.json> --scenario <scenarios.json>; ' +
  'note: changedFiles covers only analyzed targets (the report is read-only over source and does not attribute unrelated files)';

class Phase1ArgumentError extends Error {}

function parsePhase1Args(argv: readonly string[]): Partial<Record<(typeof VALUE_FLAGS)[number], string>> {
  const values: Partial<Record<(typeof VALUE_FLAGS)[number], string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index is a loop counter over the argv array.
    const argument = argv[index]!;
    if (!argument.startsWith('--')) {
      throw new Phase1ArgumentError(`unexpected positional argument: ${argument}`);
    }
    const equals = argument.indexOf('=');
    const name = (equals === -1 ? argument.slice(2) : argument.slice(2, equals)) as (typeof VALUE_FLAGS)[number];
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new Phase1ArgumentError(`unknown or destructive flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Phase1ArgumentError(`missing value for --${name}`);
      }
      value = next;
      index += 1;
    }
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    if (values[name] !== undefined) throw new Phase1ArgumentError(`duplicate flag: --${name}`);
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    values[name] = value;
  }
  return values;
}

function extractScenarios(document: unknown): Phase1Scenario[] | null {
  const container = Array.isArray(document)
    ? document
    : typeof document === 'object' &&
        document !== null &&
        Array.isArray((document as { scenarios?: unknown }).scenarios)
      ? (document as { scenarios: unknown[] }).scenarios
      : null;
  if (container === null) return null;
  const scenarios: Phase1Scenario[] = [];
  for (const entry of container) {
    if (typeof entry !== 'object' || entry === null) return null;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.environment !== 'string' ||
      typeof candidate.command !== 'string'
    ) {
      return null;
    }
    scenarios.push(candidate as unknown as Phase1Scenario);
  }
  return scenarios;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let parsed: Partial<Record<(typeof VALUE_FLAGS)[number], string>>;
  try {
    parsed = parsePhase1Args(argv);
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      exitCode: 2,
    });
    return;
  }
  const missing: string[] = [];
  if (parsed.root === undefined) missing.push('root');
  if (parsed.output === undefined) missing.push('output');
  if (parsed.scenario === undefined) missing.push('scenario');
  if (missing.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `missing required flag(s): ${missing.map((flag) => `--${flag}`).join(', ')}`,
      detail: PHASE1_USAGE_DETAIL,
      exitCode: 2,
    });
    return;
  }
  const document = await readJsonOrExit<unknown>(parsed.scenario as string);
  const scenarios = extractScenarios(document);
  if (scenarios === null) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'scenario file must be an array or {"scenarios": [...]} of {id, environment, command}',
      file: path.resolve(parsed.scenario as string),
      exitCode: 2,
    });
    return;
  }

  const result = await runPhase1({
    root: parsed.root as string,
    output: parsed.output as string,
    scenarios,
    platform: parsed.platform,
    shell: parsed.shell,
  });
  console.log('─'.repeat(60));
  console.log('Code Health Phase 1（只读静态 inventory + 动态 trace）');
  console.log('─'.repeat(60));
  console.log(`候选数        : ${result.report.candidates.length}`);
  console.log(`动态命令数    : ${result.report.commands.length}`);
  console.log(`未执行场景    : ${result.report.unexercisedScenarios.join(', ') || '（无）'}`);
  console.log(`报告输出      : ${path.resolve(parsed.output as string)}`);
  console.log(`校验结果      : ${result.exitCode === 0 ? '✓ 通过' : '✗ 存在校验问题'}`);
  console.log(
    'PHASE1_JSON ' +
      JSON.stringify({
        type: 'code-health-phase1',
        exitCode: result.exitCode,
        candidateCount: result.report.candidates.length,
        commandCount: result.report.commands.length,
        unexercisedScenarios: result.report.unexercisedScenarios,
        changedFiles: result.changedFiles,
      }),
  );
  process.exitCode = result.exitCode;
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
