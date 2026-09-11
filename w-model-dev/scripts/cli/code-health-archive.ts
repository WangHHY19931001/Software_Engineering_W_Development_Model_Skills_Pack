#!/usr/bin/env tsx
/**
 * Code-health campaign archive CLI.
 *
 *   produce: --campaign <dir> --output <dir> [--verification-level package-only|source-bound] [--source-project <dir>]
 *   verify:  --verify <package-dir> [--source-project <dir>] [--manifest <package-relative.json>]
 *   help:    --help
 *
 * The campaign directory is read-only and must contain `ledger.json`, `candidate.json`, and `approval.json`; the
 * V/G review and gate references are resolved from the candidate's signature provenance refs, and the rollback
 * artifact from the candidate rollback plan. Every declared artifact is re-verified (regular, non-symlink,
 * canonical containment) and copied with its true content hash into the package.
 *
 * Verification levels are explicit: `--verify` without `--source-project` can only report package-only and is
 * never described as verified source; only `--source-project` performs a source-bound revision re-verification.
 *
 * Exit codes: 0 produced/verified, 1 fail-closed refusal, 2 input error.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ApprovalDecision,
  ArchiveBoundaryResult,
  ArchivePackageFile,
  CodeHealthCandidate,
  CodeHealthLedger,
} from '../logic/code-health-contract.js';
import { canArchiveCandidate, validateCodeHealthCandidate } from '../logic/code-health-ledger-logic.js';
import { ARCHIVE_MANIFEST_NAME, createTask1ArchiveBoundary } from '../lib/code-health-archive-boundary.js';
import { exitWithError } from '../lib/cli-error.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

const VALUE_FLAGS = ['campaign', 'output', 'source-project', 'verification-level', 'verify', 'manifest'] as const;
type ArchiveFlag = (typeof VALUE_FLAGS)[number];
const LEVELS = new Set(['package-only', 'source-bound']);

class ArchiveArgumentError extends Error {}

const USAGE =
  'usage: code-health-archive.ts --campaign <dir> --output <dir> [--source-project <dir>] ' +
  '[--verification-level package-only|source-bound] | --verify <package-dir> [--source-project <dir>] [--manifest <file>]';

function parseArgs(argv: readonly string[]): Partial<Record<ArchiveFlag | 'help', string>> {
  const values: Partial<Record<ArchiveFlag | 'help', string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index is a loop counter over argv.
    const argument = argv[index]!;
    if (!argument.startsWith('--')) throw new ArchiveArgumentError(`unexpected positional argument: ${argument}`);
    if (argument === '--help') {
      if (values.help !== undefined) throw new ArchiveArgumentError('duplicate flag: --help');
      values.help = 'true';
      continue;
    }
    const equals = argument.indexOf('=');
    const name = (equals === -1 ? argument.slice(2) : argument.slice(2, equals)) as ArchiveFlag;
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new ArchiveArgumentError(`unknown flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
      if (value === '') throw new ArchiveArgumentError(`empty value for --${name}`);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new ArchiveArgumentError(`missing value for --${name}`);
      value = next;
      index += 1;
      if (value === '') throw new ArchiveArgumentError(`empty value for --${name}`);
    }
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    if (values[name] !== undefined) throw new ArchiveArgumentError(`duplicate flag: --${name}`);
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    values[name] = value;
  }
  return values;
}

function emit(result: ArchiveBoundaryResult, mode: 'produce' | 'verify'): void {
  console.log(
    `ARCHIVE_JSON ${JSON.stringify({
      type: 'code-health-archive',
      mode,
      exitCode: result.exitCode,
      ok: result.ok,
      errorCode: result.errorCode,
      verificationLevel: result.verificationLevel,
      path: result.path,
      archivedAsPassed: result.archivedAsPassed,
      candidateId: result.manifest?.candidateId ?? null,
      contentHash: result.manifest?.contentHash ?? null,
      fileCount: result.manifest?.files.length ?? 0,
      createdPaths: result.createdPaths,
      reason: result.reason,
    })}`,
  );
}

function failClosedExit(result: ArchiveBoundaryResult, mode: 'produce' | 'verify'): void {
  console.error(`✗ [${String(result.errorCode)}] ${result.reason}`);
  emit(result, mode);
  process.exitCode = result.exitCode === 2 ? 2 : 1;
}

function isRelativeSource(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes('\\') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

/**
 * Resolve the declared campaign artifacts. Every path is a declared reference from the tracked record (never a
 * name-based guess): ledger/candidate/approval are the fixed campaign files, V/G provenance refs are read from
 * the candidate signatures, and the rollback artifact from the candidate rollback plan.
 */
function campaignSources(candidate: CodeHealthCandidate, approval: ApprovalDecision): ArchivePackageFile[] {
  const sources: ArchivePackageFile[] = [
    { path: 'ledger.json', kind: 'ledger' },
    { path: 'candidate.json', kind: 'candidate' },
    { path: 'approval.json', kind: 'approval' },
  ];
  if (isRelativeSource(candidate.evidenceRef)) sources.push({ path: candidate.evidenceRef, kind: 'evidence' });
  if (isRelativeSource(candidate.rollback?.patchPath)) {
    sources.push({ path: candidate.rollback.patchPath, kind: 'rollback' });
  }
  for (const signature of candidate.signatures ?? []) {
    if (!isRelativeSource(signature.provenanceRef)) continue;
    if (signature.role === 'V') sources.push({ path: signature.provenanceRef, kind: 'review' });
    if (signature.role === 'G') sources.push({ path: signature.provenanceRef, kind: 'gate' });
  }
  void approval;
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.kind}\u0000${source.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function requireDirectory(target: string, label: string): Promise<string> {
  const absolute = path.resolve(target);
  let entry: Awaited<ReturnType<typeof fs.stat>>;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit caller-supplied campaign directory.
    entry = await fs.stat(absolute);
  } catch {
    throw new ArchiveArgumentError(`${label} is not an existing directory: ${absolute}`);
  }
  if (!entry.isDirectory()) throw new ArchiveArgumentError(`${label} is not a directory: ${absolute}`);
  return absolute;
}

async function runProduce(values: Partial<Record<ArchiveFlag | 'help', string>>): Promise<void> {
  const campaignFlag = values.campaign;
  const outputFlag = values.output;
  if (campaignFlag === undefined || outputFlag === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'missing required flag: --campaign and --output are required to produce an archive',
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }
  const level = values['verification-level'] ?? 'package-only';
  if (!LEVELS.has(level)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `unknown --verification-level value: ${level}`,
      detail: 'allowed levels: package-only | source-bound',
      exitCode: 2,
    });
    return;
  }
  let campaignRoot: string;
  try {
    campaignRoot = await requireDirectory(campaignFlag, '--campaign');
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }

  const ledger = await readJsonOrExit<CodeHealthLedger>(path.join(campaignRoot, 'ledger.json'));
  const candidate = await readJsonOrExit<CodeHealthCandidate>(path.join(campaignRoot, 'candidate.json'));
  const approval = await readJsonOrExit<ApprovalDecision>(path.join(campaignRoot, 'approval.json'));
  const candidateProblems = validateCodeHealthCandidate(candidate);
  if (candidateProblems.length > 0) {
    const result: ArchiveBoundaryResult = {
      ok: false,
      errorCode: 'STRUCTURE_INVALID',
      manifest: null,
      verificationLevel: 'package-only',
      createdPaths: [],
      exitCode: 1,
      path: null,
      archivedAsPassed: false,
      reason: `campaign candidate is invalid: ${candidateProblems.join('; ')}`,
    };
    failClosedExit(result, 'produce');
    return;
  }

  const boundary = createTask1ArchiveBoundary({ assessCandidate: canArchiveCandidate });
  const result = await boundary.producer.produce({
    candidate,
    ledger,
    approval,
    verificationLevel: level as 'package-only' | 'source-bound',
    campaignRoot,
    packageRoot: path.resolve(outputFlag),
    sources: campaignSources(candidate, approval),
    sourceProject: values['source-project'],
  });
  if (!result.ok) {
    if (result.exitCode === 2) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: result.reason,
        detail: USAGE,
        exitCode: 2,
      });
      return;
    }
    failClosedExit(result, 'produce');
    return;
  }
  emit(result, 'produce');
}

async function runVerify(values: Partial<Record<ArchiveFlag | 'help', string>>): Promise<void> {
  const packageRoot = path.resolve(values.verify as string);
  const boundary = createTask1ArchiveBoundary();
  // The declared level is the strongest level this run could actually establish: an explicit source project
  // enables a source-bound re-verification, otherwise the run can only ever report package-only.
  const result = await boundary.verifier.verify({
    manifestPath: values.manifest ?? ARCHIVE_MANIFEST_NAME,
    packageRoot,
    verificationLevel: values['source-project'] === undefined ? 'package-only' : 'source-bound',
    sourceProject: values['source-project'],
  });
  if (!result.ok) {
    failClosedExit(result, 'verify');
    return;
  }
  emit(result, 'verify');
}

async function main(): Promise<void> {
  let parsed: Partial<Record<ArchiveFlag | 'help', string>>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }
  if (parsed.help !== undefined) {
    console.log(USAGE);
    console.log(
      'package-only verification never proves source binding; pass --source-project to re-verify the source revision.',
    );
    return;
  }
  if (parsed.verify !== undefined) {
    if (parsed.campaign !== undefined || parsed.output !== undefined) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '--verify cannot be combined with --campaign/--output',
        detail: USAGE,
        exitCode: 2,
      });
      return;
    }
    return runVerify(parsed);
  }
  return runProduce(parsed);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
