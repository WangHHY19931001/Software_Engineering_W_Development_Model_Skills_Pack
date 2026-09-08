# Code Health Governance Campaign Design

> **Status:** Approved campaign design; implementation is not authorized by this document.
> **Date:** 2026-09-07
> **Baseline:** W-Model AI Assistant Skill version 42.2.1

## 1. Purpose and governing decision

This specification defines one evidence-gated campaign for four independent but consistently governed activities:

1. **Phase 1 — dead-code removal:** remove code only after corroborated static and dynamic analysis.
2. **Phase 2 — test-gap completion:** add tests for code paths that lack meaningful protection.
3. **Phase 3 — obsolete-test removal:** remove tests from old models or human authors only when evidence proves that they are invalid or redundant.
4. **Phase 4 — abstraction police:** identify structurally near-identical implementations and unify them only when semantic equivalence and a maintenance benefit are demonstrated.

The four phases use the same controlled lifecycle:

> **candidate discovery → evidence package → risk/ambiguity review → minimal reversible change → real regression/gates → subagent review → ledger/archive**

The lifecycle is a control boundary, not a suggestion. A candidate that cannot complete a step remains unchanged and is recorded as blocked, deferred, rejected, or awaiting clarification.

The orchestrator only routes work, assigns the appropriate subagents, waits at required human checkpoints, and transports evidence. Subagents perform discovery, implementation, review, and gate execution. The orchestrator does not delete, rewrite, abstract, interpret test results, or self-approve. Static tools and LLMs may supply evidence or review, but neither may alone authorize deletion or abstraction.

This campaign must not change current source, test, hook, package, active documentation, or existing specification files. A later, separately approved implementation plan is required before any campaign implementation begins.

## 2. Goals and non-goals

### 2.1 Goals

- Make deletion and abstraction decisions auditable, reversible, and tied to repository behavior and requirements.
- Require evidence that covers both what static analysis can see and what the running system actually exercises.
- Close meaningful test gaps across requirements, public contracts, control flow, failure behavior, security, concurrency, and supported platforms.
- Protect unique negative, boundary, security, concurrency, platform, and repository-governance tests from accidental cleanup.
- Prefer a small number of semantically clear abstractions over speculative generic helpers.
- Preserve the existing W-Model orchestration boundary, deterministic gates, version, gate order, delivery layers, and no-runtime-LLM architecture.
- Leave a complete candidate history, including rejected and deferred candidates, rather than recording only successful edits.

### 2.2 Non-goals

- No broad rewrite, style-only cleanup, dependency upgrade, framework migration, or opportunistic bug fixing.
- No deletion based on age, author, commit message, naming, low apparent importance, low coverage, or an LLM/tool recommendation alone.
- No assumption that a test is invalid because it was written under an “old model” or by a “human.” **Old authorship (“old model” or “human”) is provenance only, never a deletion reason.**
- No replacement of requirements traceability with line or branch coverage.
- No forced abstraction of accidental similarity, test-only helpers, or platform-specific behavior.
- No change to the current 18-item pre-push gate order, L0/L1 boundary, version 42.2.1, or skill runtime architecture.
- No new LLM invocation, SDK, network model client, or programmatic reasoning engine in the skill runtime.

## 3. Roles, authority, and checkpoints

| Role | Campaign responsibility | Authority limit |
| --- | --- | --- |
| Orchestrator (O) | Route a candidate to the phase workflow, dispatch subagents, surface evidence, and wait for human decisions | May not implement, review its own work, run interpretive analysis, or authorize a change |
| Analyst (A) | Discover candidates, assemble static/dynamic inventories, build gap or duplicate clusters | Produces evidence; may not approve deletion or abstraction |
| Producer (S) | Implement the minimal approved change and its tests; use TDD in Phase 2 | May change only the approved scope and must stop on newly discovered defects or ambiguity |
| Verifier (V) | Independently review evidence, risk, semantic claims, rollback, and the resulting diff | Review is advisory evidence; it is not a substitute for human authorization |
| Gatekeeper (G) | Run deterministic regression and repository gates, capture exit codes and provenance | A passing gate cannot waive missing evidence, human approval, or review |
| Root-cause analyst (R) | Analyze failed gates, failed reviews, or contradictory evidence before rework | Produces a root-cause report; does not perform the fix |
| Human decision-maker | Resolve material ambiguity and approve or reject the proposed change at the checkpoint | Approval is limited to the candidate and exact reversible scope shown in the package |

For deletion or abstraction, authorization requires all of the following: a complete evidence package, risk/ambiguity review, an explicit human checkpoint decision, a minimal reversible diff, real regression/gate results, and an independent subagent review. A tool result, static report, coverage number, or LLM output without the other controls is insufficient.

If a review or gate fails, the normal failure path is **R root-cause analysis → V review of the root-cause report → G validation → S rework**. Rework does not silently widen the approved scope. A new candidate or a changed semantic claim restarts the lifecycle.

## 4. Common controlled lifecycle

The following contract applies separately to every Phase 1–4 candidate.

### 4.1 Candidate discovery

A candidate receives a stable ID before investigation, for example `CHG-P1-20260907-001`. Discovery records the phase, repository-relative files, symbols/tests, reason for investigation, and the exact discovery sources. Discovery is not a finding of deadness, invalidity, or equivalence; it is only a request for evidence.

The analyst must distinguish a candidate from an approved change. Candidates may be discovered by static analysis, runtime traces, coverage reports, test inventory, RTM review, call-graph clustering, code review, or a reported maintenance problem. Discovery sources are leads and cannot authorize a change.

### 4.2 Evidence package

The analyst assembles the evidence contract in Section 8. The package must include positive evidence for the proposed action and explicit checks for known false positives. Absence of a search hit is not positive proof when names or control flow can be dynamic.

Evidence is tied to the relevant repository revision. Commands, tool versions, environment/platform, inputs, outputs, exit codes, and timestamps are recorded. Unrun commands and unavailable observations are recorded as unknown or blocked, never as passing evidence.

### 4.3 Risk and ambiguity review

V independently checks the evidence, candidate classification, scope, requirement/RTM impact, test-level impact, security and concurrency implications, platform assumptions, and rollback. V must list unresolved questions rather than infer favorable answers.

Material ambiguity includes unresolved dynamic loading, reflection, generated or string-based references, shell/platform branches, lifecycle ownership, security boundary changes, unproven semantic equivalence, stale evidence, or an incomplete RTM mapping. Any material ambiguity is fail-closed: the candidate is deferred or sent to the human decision-maker for a specific decision; it is not approved by default.

### 4.4 Minimal reversible change

After explicit approval, S makes the smallest change that addresses the candidate. The change must be isolated to the approved files/symbols and preserve a direct rollback path, such as a revertable commit or patch with the pre-change revision recorded. S must not bundle unrelated cleanup, formatting, renaming, dependency changes, or speculative abstractions.

A test that exposes a product defect is not made green by weakening the assertion. The defect becomes a separately tracked candidate or rework path with its own evidence and approval.

### 4.5 Real regression and gates

G runs the applicable real tests and deterministic gates against the changed revision, records exact results, and checks that the change did not weaken the repository’s governance facts. “Expected to pass,” a copied result, or a simulated output is not a result.

At minimum, the implementation plan must select tests at every affected level and run the applicable project regression suite. A gate failure, missing command, malformed output, stale provenance, or unexplained test-count change blocks archival and release of the candidate.

The campaign preserves the current pre-push contract: platform dependency checking remains the preflight, and the numbered 18-item gate order remains exactly as follows:

1. `self-test` all samples;
2. verifier CLI missing-argument input-error case;
3. artifact-gate nonexistent-directory input-error case;
4. verifier valid-sample pass case;
5. verifier invalid-sample failure case;
6. security scan with no new findings;
7. valid BDD model pass case;
8. schema-invalid BDD model input-error case;
9. valid requirement-coverage pass case;
10. valid exemption pass case;
11. valid signature-chain pass case;
12. full Vitest run with coverage thresholds and JSON facts/provenance;
13. `npm audit --audit-level=high` with only the existing narrowly defined network/registry skip behavior;
14. live docs-consistency check using the same Vitest facts;
15. samples-coverage matrix check;
16. Prettier format check;
17. strict TypeScript type check;
18. evaluation corpus and coverage-matrix assertions.

This specification does not reorder, remove, reinterpret, or add to those 18 items.

### 4.6 Subagent review

After regression, V reviews the actual diff and actual outputs, not the proposed diff or an estimate. V verifies that the change stayed within scope, evidence claims remain true, protected tests and facts remain protected, and rollback remains executable. G independently confirms gate outcomes. A failed review or gate blocks completion and enters the root-cause path.

### 4.7 Ledger and archive

Only after the human checkpoint, successful real regression/gates, and successful subagent review may the candidate be marked `archived`. The ledger records the complete state transition, including rejected, deferred, blocked, and rolled-back candidates. The archive retains the evidence package, review decisions, signatures, gate outputs, diff/rollback reference, and content hashes subject to redaction rules.

Ledger/archive writes are mechanical and evidence-preserving; they must not become a way to retroactively approve an incomplete candidate. Exact storage paths and schema evolution remain an implementation choice, but the required record fields are fixed in Section 8.

## 5. Phase-specific rules

### 5.1 Phase 1 — dead-code removal

#### Discovery and required evidence

A deletion candidate is eligible for review only after both analyses have been performed:

- **Static evidence:** repository-wide symbol/reference and export/import inventory, reachable call-graph analysis where available, type-check/build references, route/CLI registration checks, generated-file and fixture inspection, and searches for string-based identifiers. The analysis must cover direct and indirect consumers, not just the defining file.
- **Dynamic evidence:** controlled execution of relevant unit/integration/system/acceptance tests and representative runtime or smoke scenarios, with instrumentation, trace, log, or coverage evidence showing whether the candidate is reached. When a supported environment cannot be exercised, the missing observation is a blocker, not evidence of deadness.

The package must state the runtime scenarios and supported environments that were exercised, the scenarios not exercised, and why the combined evidence is sufficient. A static “no references” result is never sufficient by itself.

#### False-positive exclusions

The following are explicit stop conditions or exclusion checks. A candidate remains in place until a positive, reproducible proof resolves the item:

- **Dynamic imports and reflection:** `import()`, plugin registries, dependency injection, reflection, decorator metadata, string-to-symbol lookup, filesystem discovery, and configuration-selected handlers can evade ordinary references.
- **Shell and platform conditions:** shell scripts, `process.platform`, environment variables, executable availability, path/line-ending differences, Git Bash versus PowerShell behavior, and OS-specific branches may be dormant in one environment but required in another.
- **Schema, template, and RTM references:** schema property names, template placeholders, document anchors, serialized field names, migration identifiers, RTM IDs, graph node IDs, and generated artifact inputs may be consumed without a code import.
- **Test-only helpers:** fixtures, setup/teardown utilities, custom matchers, snapshot serializers, fake clocks, mock adapters, sample builders, and helpers used only by tests are not dead merely because production code does not call them.

Other unresolved generated-code, plugin, deployment, or external-contract references receive the same treatment. “Not found by grep” or “not covered in the current test run” is a false-positive signal, not a deletion decision.

#### Change and acceptance

The deletion must be limited to the approved candidate and include any required reference/RTM cleanup only if explicitly approved. G must demonstrate that the surviving behavior and governance facts remain intact. If dynamic evidence is incomplete or contradictory, the candidate is deferred.

### 5.2 Phase 2 — test-gap completion

#### Gap matrix

A gap is recorded in a matrix with one row per requirement, public contract, meaningful branch, error behavior, security property, concurrency property, and supported-platform behavior. Columns include the applicable test level, existing test IDs, missing scenario, evidence source, risk, priority, and proposed owner.

| Dimension | Minimum questions | Test levels to consider |
| --- | --- | --- |
| Requirements / RTM | Is every active requirement mapped to an executable assertion and a current result? | Acceptance, system, integration, unit |
| Public API / contracts | Are exports, CLI commands, paths, parameters, status codes, response fields, and compatibility promises exercised? | Unit, integration, acceptance |
| Branches | Are default, alternate, boundary, retry, and exception branches reachable and asserted? | Unit, integration, system |
| Errors | Are invalid input, missing data, dependency failure, timeout, partial failure, and recovery behavior tested? | Unit, integration, system |
| Security | Are authentication/authorization, validation, injection resistance, secret handling, redaction, and abuse limits tested? | Unit, integration, system |
| Concurrency | Are races, locks, retries, idempotency, ordering, atomicity, and stale-resource behavior tested? | Unit, integration, system |
| Platforms | Are supported OS, shell, runtime, path, line-ending, executable, and environment variants covered? | Integration, system, acceptance |

Coverage is a signal for locating gaps and measuring change impact, not the sole target or authorization criterion. A high percentage does not prove requirement, error, security, concurrency, or platform adequacy; a low percentage does not by itself justify deleting a test or code path.

#### TDD RED/GREEN

For each approved gap, S follows a real RED/GREEN cycle:

1. RED: add a focused test that fails for the intended missing behavior, with the failure captured and explained.
2. GREEN: make the minimal implementation or test-support change needed for the test to pass without weakening the assertion.
3. Refactor only within the approved scope, preserving the new behavior and evidence.

If RED does not fail for the expected reason, the gap classification or test is wrong and returns to review. If GREEN reveals an implementation defect outside the approved scope, stop and open a separate candidate. The completed package maps the new test to RTM and records its level, scenario class, result, and regression command.

### 5.3 Phase 3 — obsolete-test removal

#### Deletion criteria

A test may be removed only when all applicable criteria are evidenced:

- Its asserted behavior is no longer part of the active requirements, public contract, supported platform, security posture, or current lifecycle; **or** an independently verified surviving test covers the exact behavior.
- If the test is claimed redundant, the surviving test has equivalent setup, stimulus, oracle, failure sensitivity, and relevant test level. Similar names or overlapping lines are not enough.
- Any RTM mapping, coverage fact, samples matrix entry, docs-consistency fact, or gate expectation is rehomed and recomputed before deletion is archived.
- The test is not the only protection for a negative, boundary, security, concurrency, platform, migration, rollback, or governance behavior.
- The package explains why the test is invalid or redundant without relying on its author or age as the reason.
- A real pre-deletion run and a real post-change regression demonstrate that the surviving suite still catches the intended failure mode, or the candidate is rejected.

#### Mandatory protections

The sole or strongest test for each of the following must be preserved unless an approved replacement proves equivalent protection:

- unique negative cases, malformed input, missing resources, and expected failures;
- boundary cases such as empty, zero, minimum, maximum, overflow, truncation, and off-by-one behavior;
- security cases such as authentication, authorization, injection, secret leakage, redaction, and privilege boundaries;
- concurrency cases such as lock ownership, races, retries, idempotency, ordering, and atomic recovery;
- supported-platform cases, including Windows/Git Bash/PowerShell and Linux behavior where applicable;
- pre-push facts, including the exact gate count and order;
- `self-test` sample-to-check coverage and expected exit-code facts;
- `docs-consistency` facts, including live counts, registries, schema descriptions, action/target enumerations, and Vitest provenance facts.

A test or fixture protecting any of these facts is not “obsolete” because it is indirect, old, authored by a human, or difficult to understand. It can be removed only after a replacement is independently identified, exercised, and recorded.

#### Governance regression

Before and after the deletion, G runs the full relevant test suite and the governance checks, including the pre-push/self-test/docs-consistency facts above. Any unexplained change in test count, fixture reachability, coverage provenance, gate order/count, or docs-consistency output is fail-closed.

### 5.4 Phase 4 — abstraction police

#### Duplicate-cluster discovery

A possible abstraction starts as a cluster, not a conclusion. A must-review cluster is supported by at least two of the following views:

- AST or syntax-tree shape and normalized control-flow structure;
- structural data-flow and side-effect comparison;
- call-graph neighborhoods and shared lifecycle/resource ownership;
- normalized signatures, branches, error paths, and tests.

Textual similarity alone is insufficient. The package identifies at least two **stable call sites** before proposing unification. A stable call site is an existing supported production path with a contract and a regression signal, not a one-off experiment, dead path, generated copy, or test-only helper. If there are fewer than two stable call sites, the candidate is deferred.

#### Equivalence and maintenance proof

The abstraction proposal must prove equivalence for, at minimum:

- accepted inputs, outputs, ordering, mutations, and observable side effects;
- error types, status codes, messages where contractual, retry behavior, and failure timing;
- lifecycle ownership, initialization/finalization, cleanup, cancellation, transactions, and resource scope;
- security checks, authorization boundaries, validation order, secret handling, and privilege context;
- concurrency guarantees, locking, atomicity, idempotency, and platform-specific behavior.

It must also show a maintenance benefit: fewer independent behavior owners or bug-fix surfaces, a cohesive domain API, no configuration explosion, and no hidden coupling that makes callers harder to reason about. A shorter diff or fewer lines is not by itself a maintenance benefit.

No abstraction is forced for accidental common syntax, domain meanings that only look alike, test-only differences, mock/fixture differences, platform-specific implementations, or lifecycle/error/security differences. When equivalence is not proven, retain the implementations and record the cluster as rejected or deferred.

#### Change and acceptance

S migrates the smallest approved set of stable call sites, keeps semantic tests at each affected boundary, and preserves a direct rollback. G runs the affected and full regression suites. V checks the equivalence proof against the actual diff and verifies that the new abstraction does not erase meaningful domain or platform distinctions.

## 6. Fail-closed, provenance, and redaction

The campaign is fail-closed. Missing or malformed evidence, inconsistent candidate IDs, stale revision hashes, unknown command results, unavailable required environments, unresolved ambiguity, failed tests, failed gates, signature/timestamp gaps, RTM/coverage mismatch, or an unexecutable rollback blocks the next lifecycle step. A blocked candidate may be explicitly deferred; it may not be silently treated as passed.

Evidence must be source-bound to the revision that was analyzed or tested. Every command result includes the command (with secrets removed), working-tree/revision identity, relevant environment, start/end UTC timestamps, tool version, exit code, and a pointer or hash for its raw output. The package must distinguish observed facts, reviewer judgments, assumptions, and unknowns.

Redact API keys, passwords, access tokens, private certificates, personal data, customer data, proprietary payloads, and unnecessary absolute paths before an artifact leaves the controlled workspace. Preserve repository-relative file paths, symbols, test IDs, line ranges where safe, hashes, exit codes, and enough context to reproduce the finding. Redaction must not change the meaning of a result. If safe redaction is impossible, do not export the artifact; mark it blocked.

No agent may fabricate a test result, coverage value, runtime trace, review signature, timestamp, command output, or gate outcome. A command that was not run is `not_run`; a tool that cannot run is `unavailable`; a result that cannot be independently tied to the revision is `unverified`.

## 7. Evidence artifact contract

Every candidate package and its final ledger record must contain, at minimum:

| Field | Required content |
| --- | --- |
| `candidateId` | Stable unique ID including phase; never reused |
| `phase` / `action` | `P1..P4` and proposed action (`delete-code`, `add-test`, `delete-test`, or `abstract`) |
| `status` | `discovered`, `evidenced`, `under-review`, `approved`, `implemented`, `verified`, `archived`, `rejected`, `deferred`, `blocked`, or `rolled-back` |
| `files` / `symbols` | Repository-relative files and exact symbols, tests, fixtures, or call sites in scope |
| `sources` | Static reports, runtime traces, test IDs, RTM entries, call-graph/AST results, commits, and reviewer references |
| `confidence` | A bounded score or level with rationale and explicit uncertainty; never an unexplained number |
| `risk` | Severity and dimensions covering behavior, security, concurrency, platform, lifecycle, and governance impact |
| `rtmImpact` / `coverageImpact` | Before/after mappings, test levels, coverage facts, and any unmapped or changed scenario |
| `rollback` | Revert/patch command or exact reversal procedure, pre-change revision, and rollback owner |
| `commands` | Reproducible commands, environment/platform, tool versions, exit codes, timestamps, and output hashes/paths |
| `review` | V findings, unresolved questions, decision, and the human checkpoint decision |
| `signatures` | Role, actor identity, decision scope, signature/provenance reference, and UTC timestamp for A/S/V/G/R/human events |
| `changeScope` | Approved boundaries; any scope expansion requires a new review and decision |
| `archive` | Final diff/reference, ledger transition, manifest/content hash, redaction status, and retention location |

A package is complete only when each required field is present or explicitly marked `not_applicable` with a reason. A missing field is not inferred from surrounding prose. Exact serialization, filename, and storage location may be chosen by the later implementation plan, provided this contract and the repository’s existing evidence/provenance rules remain intact.

## 8. Test and acceptance matrix

| Phase | Discovery/evidence acceptance | Change acceptance | Regression and governance acceptance |
| --- | --- | --- | --- |
| P1 dead code | Static plus dynamic evidence covers direct/indirect, dynamic/reflection, shell/platform, schema/template/RTM, and test-only references; unresolved items are blocked | Only the approved candidate is removed; rollback is executable; no unrelated edits | Relevant runtime scenarios, full affected regression, RTM/coverage reconciliation, V review, and applicable gates pass |
| P2 test gaps | Gap matrix covers requirements, public API, branches, errors, security, concurrency, and platforms across test levels | Each approved gap has a genuine RED then minimal GREEN test; assertions are not weakened; RTM is updated | New tests pass in isolation and regression; coverage is reviewed as a signal; governance gates and V review pass |
| P3 obsolete tests | Redundancy/invalidity proof identifies the surviving equivalent or retired contract; author/age is absent as a reason; protected facts are marked | Only approved obsolete tests are removed; unique protections and gate facts remain or have proven replacements | Pre/post suite, pre-push facts, `self-test`, `docs-consistency`, test counts, and coverage provenance remain explained and passing |
| P4 abstraction | AST/structure/call-graph cluster has at least two stable call sites and a complete semantic/error/lifecycle/security/concurrency/platform comparison | Minimal migration demonstrates maintenance benefit; accidental/test-only/platform differences stay separate; rollback is executable | Affected and full regression, contract/RTM review, V equivalence review, and applicable gates pass |
| All phases | Candidate IDs, sources, confidence, risk, impact, commands, review, signatures, timestamps, and redaction status are complete and source-bound | Human decision matches exact scope; no current files are changed before a later approved implementation plan | Real exit codes and outputs only; any failure or ambiguity blocks archival; ledger/archive is append-only and auditable |

Campaign completion means every proposed candidate has a terminal ledger state with evidence, not that every candidate was changed. `deferred`, `rejected`, `blocked`, and `rolled-back` are valid outcomes.

## 9. SSoT-first synchronization list

No synchronization is performed as part of this specification. When a later implementation plan is approved, synchronization proceeds in this order and stops if the SSoT or a gate disagrees:

1. Update `docs/skill-design-document_SSoT.md` with the authoritative campaign policy, lifecycle, evidence contract, and acceptance rules.
2. Update `w-model-dev/SKILL.md` only with routing and boundary pointers needed to invoke the campaign; keep version `42.2.1` unchanged and keep the orchestrator/subagent boundary explicit.
3. Update only the necessary `w-model-dev/references/` guidance (delegation, hard constraints, RTM, coding/testing quality, operation behavior, and relevant phase references), preserving the existing failure and checkpoint rules.
4. If deterministic enforcement is approved, update the relevant `w-model-dev/schemas/`, `scripts/`, and `__tests__/`/`samples/` together; keep scripts self-contained and add no LLM runtime dependency.
5. Reconcile `docs/INSTALL.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `CHANGELOG.md` only where the implemented behavior changes their live facts; update `check-docs-consistency` facts rather than bypassing them.
6. Update evaluation assets and acceptance mappings only if the approved implementation changes a measured behavior, recording the new evaluation batch and provenance.
7. Run the repository’s real regression and all applicable gates, then append the candidate ledger/archive evidence. Historical archive updates happen only after the implementation and its gates are complete.

The L0/L1 delivery boundary remains unchanged throughout: L0 is the pure skill documentation/assets layer (`SKILL.md`, references, templates, examples, subagent personas, schemas); L1 adds scripts, samples, and tools and requires the project dependencies. L0-only copies must not be made to depend on L1 files, and L1-only gate navigation must remain classified as such. Any future campaign guidance must not blur this boundary.

## 10. Frozen principles and open implementation choices

### 10.1 Frozen principles

- Evidence precedes destructive change or abstraction.
- Static and dynamic evidence are complementary; neither alone authorizes deletion.
- Requirements, public behavior, negative/boundary/security/concurrency/platform behavior, and governance facts outrank superficial similarity or coverage percentage.
- Human approval and independent subagent review are required for deletion and abstraction.
- The orchestrator routes only; subagents implement, review, and gate.
- Failures, ambiguity, stale evidence, and unavailable observations fail closed.
- Results are real, source-bound, redacted, and never fabricated.
- Version 42.2.1, the no-LLM-in-skill-runtime rule, the current L0/L1 boundary, and the existing 18 gate order are preserved.
- The campaign is not permission to modify current files; a later approved implementation plan is mandatory.
- Provenance about an “old model” or a “human” author is retained for history, never used as a deletion rationale.

### 10.2 Implementation choices intentionally left open

The later approved implementation plan may choose, after repository inspection and a risk review:

- the language-specific AST, static-analysis, instrumentation, tracing, and call-graph tools;
- whether to use existing CodeGraph/OpenSpec integrations or another deterministic evidence source, without weakening the contract;
- the concrete ledger/archive schema and controlled storage path;
- quarantine versus direct revertable deletion mechanics, branch/worktree policy, and retention period;
- runtime scenario sampling, supported environment matrix, and confidence/risk scoring thresholds;
- exact subagent persona assignment and whether independent reviews are parallel or serial;
- the smallest set of enforcement scripts, schemas, fixtures, and documentation updates required by the approved plan.

These choices must not be used to weaken the frozen principles, skip a lifecycle step, turn unknown into pass, authorize a change without human review, or alter current repository invariants.

## 11. Current acceptance of this design document

For this design-only delivery, acceptance is limited to the new specification itself:

- only `docs/superpowers/specs/2026-09-07-code-health-governance-design.md` may be committed;
- the ignored local self-check report may be written outside the commit;
- no current source, test, hook, package, active documentation, or existing specification is changed;
- the specification contains no implementation authorization beyond requiring a later approved plan;
- markdown/whitespace validation and `git diff --check` must pass for the new specification.
