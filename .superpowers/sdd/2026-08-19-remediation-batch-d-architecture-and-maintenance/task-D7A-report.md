# Task D7A Report

## Scope

D7A changes are limited to the evidence manifest schema, evidence export logic, its focused tests, and CHANGELOG. No D7B, docs-consistency, pre-push, state, gate-log, or unrelated schema files were changed by D7A.

CodeGraph impact analysis was performed before edits for `exportEvidence`, `verifyEvidence`, `EvidenceManifest`, `SENSITIVE_KEYS`, `sanitizeContent`, and the real CLI test helper. The affected call path is `wm-export-evidence.ts` to `exportEvidence` or `verifyEvidence`, with focused coverage in `evidence-export-logic.test.ts`.

## TDD Evidence

The focused suite was first run after adding D7A assertions and failed as expected:

- exported manifests had no provenance;
- normalized sensitive keys and Markdown key/value secrets were not redacted;
- a manually modified package with recalculated file hashes was accepted by `--verify`.

The implementation was then added and the focused suite passed with 21 tests.

## Changes

- Manifest provenance is now required and contains a fixed format/version, nonempty run and artifact identifiers, a 40-character lowercase commit SHA, `verificationStatus: "passed"`, measured hashes for source gate logs, verifier outputs, and run log, plus a content hash covering the sorted exported file manifest.
- Default export requires `.w-model/evidence-provenance.json`; missing, malformed, unverified, or source-hash-mismatched provenance fails closed with `INVALID_PROVENANCE`.
- Verify validates manifest provenance and the exported file-list content hash, then regenerates canonical sanitized content for every exported file. Hash-valid packages that reintroduce secrets or absolute paths are rejected as `UNSANITIZED_EVIDENCE`.
- Redaction recognizes `authorization`, `credential`, `access_token`, and `private_key`, including case and separator variants, recursively in JSON/JSONL and as key/value lines in Markdown/text.
- Real child-process CLI tests cover passed export/verify, missing or unverified provenance rejection, and rejection of a manually assembled hash-valid package containing an authorization secret.

## Verification

Passed:

- Focused `evidence-export-logic.test.ts`: 21 tests.
- Full `npm test`: 54 files / 897 tests passed.
- `npm run typecheck`.
- `npm run lint:security`: zero new findings.
- D7A scoped `git diff --check`.

`npm run prepush` executed and passed through self-test, security scan, unit/coverage, and npm audit. It stopped at docs-consistency because the D7A test additions changed the live total from 895 to 897 while README, AGENTS, CONTRIBUTING, INSTALL, and pre-push still declare 895. Those documentation and hook paths are outside D7A's explicit allowlist and belong to the prohibited D7B/docs-consistency/prepush scope, so they were not changed here.
