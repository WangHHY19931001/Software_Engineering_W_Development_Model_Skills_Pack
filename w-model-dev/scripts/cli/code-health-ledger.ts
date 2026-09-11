#!/usr/bin/env tsx
/**
 * Code-health ledger CLI: `init` / `append` / `validate`.
 *
 *   init     --ledger <file> --campaign-id <id> --baseline <revision.json> [--environment <rows.json>]
 *   append   --ledger <file> --candidate <candidate.json> --event <event.json> [--approval <approval.json>]
 *   validate --ledger <file>
 *
 * The ledger is append-only: no command ever overwrites an existing ledger line or reuses an event /
 * candidate id. `init` refuses an existing ledger; `append` routes through the verified pure reducer and
 * refuses illegal transitions, non-monotonic timestamps, reused ids, missing hashes, and any candidate that
 * already carries a review conclusion. `validate` replays every candidate history and fails closed.
 *
 * Exit codes: 0 pass, 1 validation/refusal, 2 input error.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ApprovalDecision,
  CodeHealthCandidate,
  CodeHealthLedger,
  EnvironmentObservation,
  LedgerEvent,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import { validateRevision } from '../logic/code-health-contract.js';
import {
  CodeHealthError,
  replayCandidate,
  transitionCandidate,
  validateCodeHealthCandidate,
} from '../logic/code-health-ledger-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

class LedgerArgumentError extends Error {}

const USAGE = [
  'usage: code-health-ledger.ts <init|append|validate> [--flag value]',
  '',
  '  init     --ledger <file> --campaign-id <id> --baseline <revision.json> [--environment <rows.json>]',
  '  append   --ledger <file> --candidate <candidate.json> --event <event.json> [--approval <approval.json>]',
  '  validate --ledger <file>',
  '',
  '--help     show this usage and exit 0',
  '',
  'Exit codes: 0 pass, 1 validation/refusal, 2 input error.',
].join('\n');

/** `--help`, `-h`, or `help` anywhere in the arguments requests the usage surface instead of a command. */
function isHelpRequest(argv: readonly string[]): boolean {
  return argv.some((argument) => argument === '--help' || argument === '-h' || argument === 'help');
}

const FLAGS_BY_COMMAND: Readonly<Record<string, readonly string[]>> = {
  init: ['ledger', 'campaign-id', 'baseline', 'environment'],
  append: ['ledger', 'candidate', 'event', 'approval'],
  validate: ['ledger'],
};

function parseArgs(argv: readonly string[]): { command: string; values: Record<string, string> } {
  const [command, ...rest] = argv;
  if (command === undefined) throw new LedgerArgumentError('missing subcommand: init | append | validate');
  // eslint-disable-next-line security/detect-object-injection -- command is validated against the fixed subcommand map below.
  const allowed = FLAGS_BY_COMMAND[command];
  if (allowed === undefined) throw new LedgerArgumentError(`unknown subcommand: ${command}`);
  const values: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index is a loop counter over argv.
    const argument = rest[index]!;
    if (!argument.startsWith('--')) throw new LedgerArgumentError(`unexpected positional argument: ${argument}`);
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if (!allowed.includes(name)) throw new LedgerArgumentError(`unknown flag for ${command}: ${argument}`);
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
      if (value === '') throw new LedgerArgumentError(`empty value for --${name}`);
    } else {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new LedgerArgumentError(`missing value for --${name}`);
      value = next;
      index += 1;
      if (value === '') throw new LedgerArgumentError(`empty value for --${name}`);
    }
    // eslint-disable-next-line security/detect-object-injection -- name is validated against the per-command allowlist.
    if (values[name] !== undefined) throw new LedgerArgumentError(`duplicate flag: --${name}`);
    // eslint-disable-next-line security/detect-object-injection -- name is validated against the per-command allowlist.
    values[name] = value;
  }
  return { command, values };
}

function emit(exitCode: 0 | 1, payload: object): void {
  console.log(`LEDGER_JSON ${JSON.stringify({ type: 'code-health-ledger', exitCode, ...payload })}`);
}

async function writeLedgerAtomic(target: string, ledger: CodeHealthLedger): Promise<void> {
  const absolute = path.resolve(target);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolute is the explicit caller-supplied ledger path.
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- temporary is derived from the caller-supplied ledger path.
  await fs.writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- both paths are derived from the caller-supplied ledger path.
  await fs.rename(temporary, absolute);
}

async function ledgerExists(target: string): Promise<boolean> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- explicit caller-supplied ledger path existence probe.
    await fs.stat(path.resolve(target));
    return true;
  } catch {
    return false;
  }
}

function failClosed(command: string, reason: string, code: string): void {
  console.error(`✗ [${code}] ${reason}`);
  emit(1, { command, passed: false, code, reason });
  process.exitCode = 1;
}

function requireFlag(values: Record<string, string>, flag: string): string {
  // eslint-disable-next-line security/detect-object-injection -- flag is a literal caller-supplied key, never user data.
  const value = values[flag];
  if (value === undefined) throw new LedgerArgumentError(`missing required flag: --${flag}`);
  return value;
}

async function runInit(values: Record<string, string>): Promise<void> {
  const target = requireFlag(values, 'ledger');
  const campaignId = requireFlag(values, 'campaign-id');
  const baselinePath = requireFlag(values, 'baseline');
  if (campaignId.trim() === '') {
    failClosed('init', 'campaign-id must be non-empty', 'ARG_INVALID');
    return;
  }
  if (await ledgerExists(target)) {
    failClosed('init', `refusing to overwrite an existing ledger: ${path.resolve(target)}`, 'STRUCTURE_INVALID');
    return;
  }
  const baseline = await readJsonOrExit<RevisionIdentity>(baselinePath);
  const revisionReasons: string[] = [];
  if (!validateRevision(baseline, 'baseline', revisionReasons)) {
    failClosed('init', `baseline revision is invalid: ${revisionReasons.join('; ')}`, 'STRUCTURE_INVALID');
    return;
  }
  const environmentMatrix =
    values.environment === undefined
      ? []
      : await readJsonOrExit<EnvironmentObservation[]>(values.environment as string);
  if (!Array.isArray(environmentMatrix)) {
    failClosed('init', 'environment matrix must be a JSON array', 'STRUCTURE_INVALID');
    return;
  }
  const ledger: CodeHealthLedger = {
    schemaVersion: '1.0',
    campaignId,
    createdAt: new Date().toISOString(),
    baseline,
    environmentMatrix,
    candidates: [],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
  };
  await writeLedgerAtomic(target, ledger);
  emit(0, { command: 'init', passed: true, campaignId, candidateCount: 0, eventCount: 0 });
}

async function runAppend(values: Record<string, string>): Promise<void> {
  const target = requireFlag(values, 'ledger');
  const candidatePath = requireFlag(values, 'candidate');
  const eventPath = requireFlag(values, 'event');
  const ledger = await readJsonOrExit<CodeHealthLedger>(target);
  const candidate = await readJsonOrExit<CodeHealthCandidate>(candidatePath);
  const event = await readJsonOrExit<LedgerEvent>(eventPath);
  const approval = values.approval === undefined ? undefined : await readJsonOrExit<ApprovalDecision>(values.approval);

  const candidateReasons = validateCodeHealthCandidate(candidate);
  if (candidateReasons.length > 0) {
    failClosed('append', `candidate is invalid: ${candidateReasons.join('; ')}`, 'STRUCTURE_INVALID');
    return;
  }
  // Discovery is never a conclusion: an appended discovery candidate must be undecided and undiscovered-only.
  if (
    candidate.status !== 'discovered' &&
    !ledger.candidates.some((entry) => entry.candidateId === candidate.candidateId)
  ) {
    failClosed(
      'append',
      'a newly registered candidate must be discovered only, never a conclusion',
      'TRANSITION_INVALID',
    );
    return;
  }
  const existing = ledger.candidates.find((entry) => entry.candidateId === candidate.candidateId);
  const candidateId = typeof event.candidateId === 'string' ? event.candidateId : candidate.candidateId;
  const base: CodeHealthLedger = existing
    ? ledger
    : {
        ...ledger,
        candidates: [...ledger.candidates, candidate],
      };
  try {
    const next = transitionCandidate(base, candidateId, event, approval);
    await writeLedgerAtomic(target, next);
  } catch (error) {
    const typed = error instanceof CodeHealthError ? error : null;
    failClosed('append', error instanceof Error ? error.message : String(error), typed?.code ?? 'STRUCTURE_INVALID');
    return;
  }
  emit(0, { command: 'append', passed: true, candidateId, eventId: event.eventId });
}

async function runValidate(values: Record<string, string>): Promise<void> {
  const target = requireFlag(values, 'ledger');
  const ledger = await readJsonOrExit<CodeHealthLedger>(target);
  const reasons: string[] = [];
  if (ledger.schemaVersion !== '1.0') reasons.push('schemaVersion must be 1.0');
  if (typeof ledger.campaignId !== 'string' || ledger.campaignId.trim() === '') reasons.push('campaignId is required');
  if (ledger.appendOnly !== true) reasons.push('appendOnly must be true');
  const revisionReasons: string[] = [];
  validateRevision(ledger.baseline, 'baseline', revisionReasons);
  reasons.push(...revisionReasons);
  if (!Array.isArray(ledger.candidates)) reasons.push('candidates must be an array');
  if (!Array.isArray(ledger.events)) reasons.push('events must be an array');
  if (reasons.length === 0) {
    const known = new Set(ledger.candidates.map((entry) => entry.candidateId));
    for (const event of ledger.events) {
      if (!known.has(event.candidateId))
        reasons.push(`event ${event.eventId} references unknown candidate ${event.candidateId}`);
    }
    for (const candidate of ledger.candidates) {
      reasons.push(...validateCodeHealthCandidate(candidate).map((reason) => `${candidate.candidateId}: ${reason}`));
      try {
        replayCandidate(ledger, candidate.candidateId);
      } catch (error) {
        reasons.push(`${candidate.candidateId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (reasons.length > 0) {
    failClosed('validate', reasons.join('; '), 'STRUCTURE_INVALID');
    return;
  }
  emit(0, {
    command: 'validate',
    passed: true,
    candidateCount: ledger.candidates.length,
    eventCount: ledger.events.length,
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // A discoverable usage surface: `--help` / `-h` / `help` prints usage on stdout and exits 0 rather than
  // being rejected as an unknown subcommand/flag. It performs no read, write, or validation.
  if (isHelpRequest(argv)) {
    console.log(USAGE);
    return;
  }
  let parsed: { command: string; values: Record<string, string> };
  try {
    parsed = parseArgs(argv);
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
  if (parsed.command === 'init') return runInit(parsed.values);
  if (parsed.command === 'append') return runAppend(parsed.values);
  return runValidate(parsed.values);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
