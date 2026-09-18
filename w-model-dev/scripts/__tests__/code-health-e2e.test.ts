/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/**
 * 真实 git 工作区全链路（N）：规则层单测不覆盖的跨 CLI 消费契约与真实 git 触点。
 *
 * 四个 it 各自独立、不共享仓与 package。链路按 it 分三条（**archive 是两条互相独立的 verify 链**，
 * 不是一条单链——两语义不能在同一条 verify 上同时成立，理由见下方各 it）：
 *   链 A · apply（第 1 个 it）：ledger init → append(discovered) → apply dry-run → patch → commit
 *          → `git apply -R` 回滚证伪 → 运行前 dirty 的 scope 文件触发 SCOPE_MISMATCH → scope 篡改拒绝；
 *   链 B · archive（第 2 个 it = 链 1 package-only；第 3 个 it = 链 2 source-bound）：
 *          链 1：produce 默认级别 → `--verify`（package-only）→ 加 `--source-project` 也不升级；
 *          链 2：produce `--verification-level source-bound` → 带 `--source-project` 通过 →
 *                不带即 exit 1 → 提交级篡改源后 REVISION_MISMATCH；
 *   链 C · phase1（第 4 个 it）：真实仓只读发现；
 *   链 D · T7-3/T7-4/T7-5（第 5-7 个 it，**修复轮 1 补齐**）：`--guard` 真实 pre/post suite + 经
 *          `code-health-apply.ts` 真删 + 最终证明失败即回滚；duplicates 只读（`git status` 不变、无
 *          `APPLY_JSON`）；phase1 CLI 真实 git 差分下 `changedFiles` 非空即 exit 1（第 4 个 it 只覆盖了
 *          `changedFiles:[]` 的幸福路径），另含 `blocked` 形态与 raw 落点。
 *
 * 注：本文件的 apply 链**不含** `append(approved)` 这一步——`approved` 只能自 `under-review` 由 `human`
 * 角色进入（NORMAL_TRANSITIONS code-health-ledger-logic.ts:131-143；TRANSITION_ROLES :146-150），
 * `append` 会以 TRANSITION_INVALID 拒绝（ledger-logic.ts:511-512 → cli/code-health-ledger.ts:214-216 fail-closed），
 * 故 ledger 侧只用 init + append(discovered)；且 apply 链本身**不读 ledger**
 * （cli/code-health-apply.ts:558 仅在传 `--ledger`/测试删除候选时才读）。
 *
 * 安全边界：真实写入 / 删除只发生在隔离临时仓内；本仓（REPO_ROOT）只被读取。
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import type {
  ApprovalDecision,
  CodeHealthCandidate,
  CodeHealthLedger,
  EvidenceBinding,
  LedgerEvent,
  ProtectedTestClass,
  RevisionIdentity,
  TestRecord,
} from '../logic/code-health-ledger-logic.js';
import { classifyProtectedTest } from '../logic/code-health-ledger-logic.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { runSync } from '../lib/run-sync.js';

import {
  bindRevision,
  cleanupTempRoots,
  createTempGitRepository,
  git,
  gitHead,
  gitStatus,
  GIT_ENV,
  jsonLine,
  loadApplyFixture,
  REPO_ROOT,
  revisionProvider,
  runCli,
  tempRoot,
  writeJson,
} from './helpers/code-health-fixtures.js';

// Importing the shared helper above is not itself spawn evidence: the runner follows the repository's
// lexical convention (import node:child_process or call runSync/execSync/spawnSync/execFile), so the
// rollback reverse application below runs through `runSync` directly, exactly like the sibling
// `code-health-cli.test.ts` rollback assertion. Every other subprocess in this file goes through the
// helper's `runCli` / `git`, which use the same audited `GIT_ENV`.

afterEach(cleanupTempRoots);

interface TreeEntry {
  sha256: string;
  mtimeMs: number;
}

/** Full recursive snapshot (relative POSIX path → bytes digest + mtime) of a directory tree. */
async function snapshotTree(root: string): Promise<Map<string, TreeEntry>> {
  const snapshot = new Map<string, TreeEntry>();
  const walk = async (absolute: string, relative: string): Promise<void> => {
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(childAbsolute, childRelative);
        continue;
      }
      const bytes = await fs.readFile(childAbsolute);
      const stats = await fs.stat(childAbsolute);
      snapshot.set(childRelative, {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        mtimeMs: stats.mtimeMs,
      });
    }
  };
  await walk(root, '');
  return snapshot;
}

/** Per-file comparison of two snapshots; four empty lists mean the run changed nothing. */
function diffSnapshots(
  before: Map<string, TreeEntry>,
  after: Map<string, TreeEntry>,
): { added: string[]; removed: string[]; bytesChanged: string[]; mtimeChanged: string[] } {
  const added = [...after.keys()].filter((key) => !before.has(key)).sort();
  const removed = [...before.keys()].filter((key) => !after.has(key)).sort();
  const bytesChanged = [...before.keys()]
    .filter((key) => after.has(key) && after.get(key)?.sha256 !== before.get(key)?.sha256)
    .sort();
  const mtimeChanged = [...before.keys()]
    .filter((key) => after.has(key) && after.get(key)?.mtimeMs !== before.get(key)?.mtimeMs)
    .sort();
  return { added, removed, bytesChanged, mtimeChanged };
}

/** A discovery-only candidate (never a conclusion); mirrors `code-health-cli.test.ts`'s helper. */
function discoveredCandidate(base: CodeHealthCandidate, revision: RevisionIdentity): CodeHealthCandidate {
  return {
    ...structuredClone(base),
    status: 'discovered',
    review: { findings: [], unresolvedQuestions: [], decision: null, humanDecision: null },
    archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'not_reviewed' },
    revision,
    evidenceBinding: { ...base.evidenceBinding, revision },
  };
}

function discoveryEvent(candidate: CodeHealthCandidate): LedgerEvent {
  return {
    eventId: 'EV-E2E-1',
    eventKind: 'discovery',
    candidateId: candidate.candidateId,
    from: null,
    to: 'discovered',
    actorRole: 'A',
    at: '2026-09-18T00:10:00.000Z',
    revision: candidate.revision,
    scopeHash: candidate.changeScope.scopeHash,
    evidenceRefs: ['evidence/discovery.json'],
    signatureRef: 'evidence/signature-a.json',
  };
}

interface ArchiveCampaignFixture {
  campaign: string;
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  revision: RevisionIdentity;
}

/**
 * Build a campaign directory that satisfies every archive producer gate: the SAME bound candidate object is
 * written to both `candidate.json` and `ledger.candidates[0]` (candidate/ledger agreement, baseline revision
 * match), the ledger carries no blocking event and no unobserved supported environment, and the four relative
 * references (evidence / rollback patch / V provenance / G provenance) are distinct so `fileCount` is 7.
 */
async function buildVerifiedCampaign(root: string): Promise<ArchiveCampaignFixture> {
  const revision = (await revisionProvider.current(root)) as RevisionIdentity;
  const fixture = await loadApplyFixture('valid-patch.json');
  const { candidate, approval } = bindRevision(fixture, revision);
  const scopeHash = candidate.changeScope.scopeHash;

  candidate.status = 'verified';
  candidate.review = { findings: [], unresolvedQuestions: [], decision: 'approve', humanDecision: 'approve' };
  candidate.archive = { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'clean' };
  candidate.evidenceRef = `evidence/${candidate.candidateId}.json`;
  candidate.rollback = {
    ...candidate.rollback,
    command: 'git apply -R rollback/rollback.patch',
    patchPath: 'rollback/rollback.patch',
    executable: true,
  };
  candidate.signatures = [
    {
      role: 'A',
      actor: 'analyst',
      event: 'discovered',
      scopeHash,
      provenanceRef: candidate.evidenceRef,
      signedAt: '2026-09-18T00:01:00.000Z',
    },
    {
      role: 'V',
      actor: 'verifier',
      event: 'verified',
      scopeHash,
      provenanceRef: 'reviews/v-signature.json',
      signedAt: '2026-09-18T00:02:00.000Z',
    },
    {
      role: 'G',
      actor: 'gate',
      event: 'gate',
      scopeHash,
      provenanceRef: 'gate-logs/g-signature.json',
      signedAt: '2026-09-18T00:03:00.000Z',
    },
    {
      role: 'human',
      actor: 'human-decision-maker',
      event: 'approve',
      scopeHash,
      provenanceRef: 'approval.json',
      signedAt: '2026-09-18T00:04:00.000Z',
    },
  ];

  const dir = await tempRoot('code-health-e2e-campaign-');
  await fs.mkdir(path.join(dir, 'evidence'), { recursive: true });
  await fs.mkdir(path.join(dir, 'reviews'), { recursive: true });
  await fs.mkdir(path.join(dir, 'gate-logs'), { recursive: true });
  await fs.mkdir(path.join(dir, 'rollback'), { recursive: true });
  await writeJson(dir, 'candidate.json', candidate);
  await writeJson(dir, 'approval.json', approval);
  await fs.writeFile(
    path.join(dir, candidate.evidenceRef),
    `${JSON.stringify({ kind: 'code-health-evidence', candidateId: candidate.candidateId, observation: 'observed' })}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'reviews', 'v-signature.json'),
    `${JSON.stringify({ role: 'V', candidateId: candidate.candidateId, decision: 'approve' })}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'gate-logs', 'g-signature.json'),
    `${JSON.stringify({ role: 'G', candidateId: candidate.candidateId, gate: 'code-health-archive' })}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'rollback', 'rollback.patch'),
    'diff --git a/src/unused.ts b/src/unused.ts\ndeleted file mode 100644\n--- a/src/unused.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-export const unusedFunction = 1;\n',
    'utf8',
  );

  const ledger: CodeHealthLedger = {
    schemaVersion: '1.0',
    campaignId: 'CHC-E2E-20260918',
    createdAt: '2026-09-18T00:00:00.000Z',
    baseline: revision,
    environmentMatrix: [],
    candidates: [candidate],
    events: [],
    appendOnly: true,
    redaction: { status: 'clean', rules: [], blockedReasons: [] },
  };
  await writeJson(dir, 'ledger.json', ledger);
  return { campaign: dir, candidate, approval, revision };
}

it('apply 全链路：dry-run 不落盘 → patch 只写受控 .patch → commit 真实删除工作区文件（HEAD 不前移），rollback 证伪可执行', async () => {
  const root = await createTempGitRepository();
  const dir = await tempRoot('code-health-e2e-apply-');
  const ledger = path.join(dir, 'campaign.json');
  const revision = (await revisionProvider.current(root)) as RevisionIdentity;

  // ledger 侧：init → append(discovered) → validate（apply 链本身不读 ledger，此处证明真实仓上的 ledger 契约可用）。
  const baseline = await writeJson(dir, 'baseline.json', revision);
  const init = runCli('code-health-ledger.ts', [
    'init',
    '--ledger',
    ledger,
    '--campaign-id',
    'CH-E2E',
    '--baseline',
    baseline,
  ]);
  expect(init.code, init.stderr).toBe(0);
  const fixture = await loadApplyFixture('valid-patch.json');
  const registered = discoveredCandidate(fixture.candidate, revision);
  const registeredPath = await writeJson(dir, 'registered-candidate.json', registered);
  const eventPath = await writeJson(dir, 'discovery-event.json', discoveryEvent(registered));
  const appended = runCli('code-health-ledger.ts', [
    'append',
    '--ledger',
    ledger,
    '--candidate',
    registeredPath,
    '--event',
    eventPath,
  ]);
  expect(appended.code, appended.stderr).toBe(0);
  expect(runCli('code-health-ledger.ts', ['validate', '--ledger', ledger]).code).toBe(0);

  const { candidate, approval } = bindRevision(fixture, revision);
  const candidatePath = await writeJson(dir, 'candidate.json', candidate);
  const approvalPath = await writeJson(dir, 'approval.json', approval);
  const patchRelative = `.w-model/code-health/apply/${candidate.candidateId}.patch`;

  const before = await gitStatus(root);
  const headBefore = await gitHead(root);
  const logBefore = (await git(root, ['log', '--oneline'])).stdout;
  const reflogBefore = (await git(root, ['reflog'])).stdout;
  const worktreeBytesBefore = await fs.readFile(path.join(root, 'src', 'unused.ts'), 'utf8');
  expect(before).toBe('');
  expect(worktreeBytesBefore).toBe('export const unusedFunction = 1;\n');

  // 1) dry-run：真实 proposal，什么都不写。
  const dryRun = runCli('code-health-apply.ts', [
    '--candidate',
    candidatePath,
    '--approval',
    approvalPath,
    '--root',
    root,
    '--mode',
    'dry-run',
  ]);
  expect(dryRun.code, dryRun.stderr).toBe(0);
  const drySummary = jsonLine<{ applied: boolean; patchPath: string | null }>(dryRun.stdout, 'APPLY_JSON');
  expect(drySummary?.applied).toBe(false);
  expect(drySummary?.patchPath).toMatch(/\.patch$/);
  await expect(fs.stat(path.join(root, '.w-model'))).rejects.toBeTruthy();
  expect(await gitStatus(root)).toBe(before);
  expect(await gitHead(root)).toBe(headBefore);

  // 2) patch：只落盘受控 patch，目标文件与工作树都不动。
  const patchRun = runCli('code-health-apply.ts', [
    '--candidate',
    candidatePath,
    '--approval',
    approvalPath,
    '--root',
    root,
    '--mode',
    'patch',
  ]);
  expect(patchRun.code, patchRun.stderr).toBe(0);
  const patchSummary = jsonLine<{
    applied: boolean;
    patchPath: string | null;
    appliedFiles: string[];
    rollback: { executable: boolean; patchSha256?: string } | null;
  }>(patchRun.stdout, 'APPLY_JSON');
  expect(patchSummary?.applied).toBe(false);
  expect(patchSummary?.appliedFiles).toEqual([]);
  expect(patchSummary?.patchPath).toBe(patchRelative);
  expect(patchSummary?.rollback?.executable).toBe(true);
  const patchAbsolute = path.join(root, patchRelative);
  expect((await fs.stat(patchAbsolute)).isFile()).toBe(true);
  const patchText = await fs.readFile(patchAbsolute, 'utf8');
  expect(patchText).toContain('deleted file mode 100644');
  expect(patchText).toContain('-export const unusedFunction = 1;');
  // 目标文件未被改动：patch 模式只写 patch，从不应用 patch。
  await expect(fs.readFile(path.join(root, 'src', 'unused.ts'), 'utf8')).resolves.toBe(worktreeBytesBefore);
  expect((await git(root, ['diff', '--exit-code'])).code).toBe(0);
  expect((await git(root, ['diff', 'HEAD', '--stat'])).stdout.trim()).toBe('');
  expect(await gitStatus(root)).toBe(before);
  expect(await gitHead(root)).toBe(headBefore);

  // 3) commit：删除只发生在工作区（未暂存），HEAD 不前移，工作树不再干净。
  const commitRun = runCli('code-health-apply.ts', [
    '--candidate',
    candidatePath,
    '--approval',
    approvalPath,
    '--root',
    root,
    '--mode',
    'commit',
  ]);
  expect(commitRun.code, commitRun.stderr).toBe(0);
  const commitSummary = jsonLine<{
    applied: boolean;
    appliedFiles: string[];
    unrelatedFiles: string[];
    rollback: { executable: boolean; patchPath: string; patchSha256?: string } | null;
  }>(commitRun.stdout, 'APPLY_JSON');
  expect(commitSummary?.applied).toBe(true);
  expect([...(commitSummary?.appliedFiles ?? [])].sort()).toEqual([...candidate.changeScope.files].sort());
  expect(commitSummary?.unrelatedFiles).toEqual([]);
  await expect(fs.stat(path.join(root, 'src', 'unused.ts'))).rejects.toBeTruthy();
  expect(await gitStatus(root)).toBe('D src/unused.ts');
  expect((await git(root, ['diff', '--cached', '--exit-code'])).code).toBe(0);
  // commit 模式从不调用 `git commit`：HEAD、log 与 reflog 都不变（该仓只有一个初始提交）。
  expect(await gitHead(root)).toBe(headBefore);
  expect((await git(root, ['log', '--oneline'])).stdout).toBe(logBefore);
  expect((await git(root, ['reflog'])).stdout).toBe(reflogBefore);
  expect(await gitStatus(root)).not.toBe(before);

  // 4) 回滚证伪：反向应用受控 patch 后工作树回到运行前（治理参考的可回滚承诺）。
  const reverse = runSync('git', ['apply', '-R', patchAbsolute], { cwd: root, timeout: 30_000, env: GIT_ENV });
  expect(reverse.status).toBe(0);
  expect(reverse.stderr?.trim()).toBe('');
  const diffAfterRollback = await git(root, ['diff', '--exit-code']);
  expect(diffAfterRollback.code).toBe(0);
  expect(diffAfterRollback.stdout.trim()).toBe('');
  expect(await gitStatus(root)).toBe(before);

  // 5) 运行前 dirty/untracked 的 scope 文件：exact-scope 回读判定失败 → SCOPE_MISMATCH，
  //    但前向应用已真实发生，受控 patch 与回滚方案必须保留，且回滚必须已还原工作树。
  //    只 `git rm --cached`（工作区仍保留该文件）**不提交**：提交会让 HEAD 前移，使
  //    applyApproved 的 currentRevision 比对先失败为 REVISION_MISMATCH（早于任何前向 apply）。
  expect((await git(root, ['rm', '--cached', '--quiet', 'src/unused.ts'])).code).toBe(0);
  const beforeDirty = await gitStatus(root);
  expect(beforeDirty).toBe('D  src/unused.ts\n?? src/unused.ts');
  const bytesBeforeRefusal = await fs.readFile(path.join(root, 'src', 'unused.ts'), 'utf8');

  const refused = runCli('code-health-apply.ts', [
    '--candidate',
    candidatePath,
    '--approval',
    approvalPath,
    '--root',
    root,
    '--mode',
    'commit',
  ]);
  expect(refused.code).toBe(1);
  const refusedSummary = jsonLine<{
    kind: string;
    applied: boolean;
    errorCode: string | null;
    patchPath: string | null;
    rollback: { executable: boolean; patchPath: string; patchSha256?: string } | null;
    reason: string;
  }>(refused.stdout, 'APPLY_JSON');
  expect(refusedSummary?.kind).toBe('blocked');
  expect(refusedSummary?.errorCode).toBe('SCOPE_MISMATCH');
  expect(refusedSummary?.applied).toBe(false);
  expect(refusedSummary?.patchPath).toBe(patchRelative);
  expect(refusedSummary?.rollback?.patchSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(refusedSummary?.reason).toContain('rollback restored the pre-change worktree');
  // scope 内文件被逐字节还原（该 fixture 下同时 == HEAD blob），git status 与运行前一致。
  await expect(fs.readFile(path.join(root, 'src', 'unused.ts'), 'utf8')).resolves.toBe(bytesBeforeRefusal);
  expect(bytesBeforeRefusal).toBe((await git(root, ['cat-file', 'blob', 'HEAD:src/unused.ts'])).stdout);
  expect(await gitStatus(root)).toBe(beforeDirty);
  expect(await gitHead(root)).toBe(headBefore);

  // 6) scope 绑定篡改（approval 文件集 expand）：applyApproved 在任何写入之前抛出 → 本次运行零写入。
  const scopeMismatch = await loadApplyFixture('scope-mismatch.json');
  const tamperedApprovalPath = await writeJson(
    dir,
    'approval-scope-mismatch.json',
    bindRevision(scopeMismatch, revision).approval,
  );
  const wmodelBefore = await snapshotTree(path.join(root, '.w-model'));
  // 非空护栏：步骤 2 的 patch 模式已在同一仓落了受控 patch，四项全空必须建立在真实文件之上。
  expect([...wmodelBefore.keys()]).toEqual([`code-health/apply/${candidate.candidateId}.patch`]);
  const statusBeforeTamper = await gitStatus(root);
  const tamperRun = runCli('code-health-apply.ts', [
    '--candidate',
    candidatePath,
    '--approval',
    tamperedApprovalPath,
    '--root',
    root,
    '--mode',
    'commit',
  ]);
  expect(tamperRun.code).toBe(1);
  expect(tamperRun.stdout).toContain('HUMAN_APPROVAL_REQUIRED');
  const tamperSummary = jsonLine<{ applied: boolean; errorCode: string | null; patchPath: string | null }>(
    tamperRun.stdout,
    'APPLY_JSON',
  );
  expect(tamperSummary?.errorCode).toBe('SCOPE_MISMATCH');
  expect(tamperSummary?.applied).toBe(false);
  expect(tamperSummary?.patchPath).toBeNull();
  // 拒绝早于 buildPatchBytes / writePatch：`.w-model/` 逐文件快照的运行前后比对四项全空。
  // （不可断言「`.w-model/` 未被创建」——步骤 2 的 patch 模式已在同一仓落了受控 patch。）
  expect(diffSnapshots(wmodelBefore, await snapshotTree(path.join(root, '.w-model')))).toEqual({
    added: [],
    removed: [],
    bytesChanged: [],
    mtimeChanged: [],
  });
  expect(await gitStatus(root)).toBe(statusBeforeTamper);
  expect(await gitHead(root)).toBe(headBefore);
}, 240_000);

it('archive 链 1（package-only）：produce 默认级别 → --verify <pkg> 恒 package-only，加 --source-project 也不升级', async () => {
  const root = await createTempGitRepository();
  const campaign = await buildVerifiedCampaign(root);
  const pkg = path.join(await tempRoot('code-health-e2e-pkg-'), 'package-only-package');

  const produced = runCli('code-health-archive.ts', ['--campaign', campaign.campaign, '--output', pkg]);
  expect(produced.code, produced.stderr).toBe(0);
  const produceSummary = jsonLine<{
    mode: string;
    ok: boolean;
    verificationLevel: string;
    archivedAsPassed: boolean;
    fileCount: number;
    createdPaths: string[];
  }>(produced.stdout, 'ARCHIVE_JSON');
  expect(produceSummary?.mode).toBe('produce');
  expect(produceSummary?.verificationLevel).toBe('package-only');
  expect(produceSummary?.archivedAsPassed).toBe(true);
  expect(produceSummary?.fileCount).toBe(7);
  await expect(fs.stat(path.join(pkg, 'manifest.json'))).resolves.toBeTruthy();

  const verified = runCli('code-health-archive.ts', ['--verify', pkg]);
  expect(verified.code, verified.stderr).toBe(0);
  const verifySummary = jsonLine<{ mode: string; verificationLevel: string; reason: string }>(
    verified.stdout,
    'ARCHIVE_JSON',
  );
  expect(verifySummary?.mode).toBe('verify');
  expect(verifySummary?.verificationLevel).toBe('package-only');
  expect(verifySummary?.reason).toBe('package-only archive package verified');

  // verifyPackage 只在 manifest.verificationLevel === 'source-bound' 时才看 sourceProject：
  // 传了 --source-project 的 package-only 包仍必须恒为 package-only（不会被静默升级为 verified source）。
  const withSource = runCli('code-health-archive.ts', ['--verify', pkg, '--source-project', root]);
  expect(withSource.code, withSource.stderr).toBe(0);
  const withSourceSummary = jsonLine<{ verificationLevel: string; reason: string }>(withSource.stdout, 'ARCHIVE_JSON');
  expect(withSourceSummary?.verificationLevel).toBe('package-only');
  expect(withSourceSummary?.reason).toBe('package-only archive package verified');
}, 180_000);

it('archive 链 2（source-bound）：produce 声明 source-bound → --verify 带 --source-project 通过 → 篡改源后 fail-closed', async () => {
  const root = await createTempGitRepository();
  const campaign = await buildVerifiedCampaign(root);
  const pkg = path.join(await tempRoot('code-health-e2e-pkg-'), 'source-bound-package');

  const produced = runCli('code-health-archive.ts', [
    '--campaign',
    campaign.campaign,
    '--output',
    pkg,
    '--verification-level',
    'source-bound',
    '--source-project',
    root,
  ]);
  expect(produced.code, produced.stderr).toBe(0);
  const produceSummary = jsonLine<{ verificationLevel: string; archivedAsPassed: boolean; fileCount: number }>(
    produced.stdout,
    'ARCHIVE_JSON',
  );
  expect(produceSummary?.verificationLevel).toBe('source-bound');
  expect(produceSummary?.archivedAsPassed).toBe(true);
  expect(produceSummary?.fileCount).toBe(7);

  const verified = runCli('code-health-archive.ts', ['--verify', pkg, '--source-project', root]);
  expect(verified.code, verified.stderr).toBe(0);
  const verifySummary = jsonLine<{ verificationLevel: string; reason: string }>(verified.stdout, 'ARCHIVE_JSON');
  expect(verifySummary?.verificationLevel).toBe('source-bound');
  expect(verifySummary?.reason).toBe('source-bound archive package verified');

  // 声明的 source-bound 包在没有显式源项目时必然 exit 1（声明的级别不能被静默降级为通过）。
  const withoutSource = runCli('code-health-archive.ts', ['--verify', pkg]);
  expect(withoutSource.code).toBe(1);
  const withoutSourceSummary = jsonLine<{ ok: boolean; errorCode: string | null; reason: string }>(
    withoutSource.stdout,
    'ARCHIVE_JSON',
  );
  expect(withoutSourceSummary?.ok).toBe(false);
  expect(withoutSourceSummary?.errorCode).toBe('EVIDENCE_INVALID');
  expect(withoutSourceSummary?.reason).toContain(
    'source-bound package verification requires an explicit source project',
  );

  // 篡改被登记的源文件**并提交**（revision 是 commit/tree/source-bundle 级：只改工作区不改 HEAD 不生效）→
  // source-bound 重验 fail-closed。
  const headBefore = await gitHead(root);
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 2;\n', 'utf8');
  expect((await git(root, ['add', '--all'])).code).toBe(0);
  expect(
    (await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'tamper the archived source'])).code,
  ).toBe(0);
  expect(await gitHead(root)).not.toBe(headBefore);

  const tampered = runCli('code-health-archive.ts', ['--verify', pkg, '--source-project', root]);
  expect(tampered.code).toBe(1);
  const tamperedSummary = jsonLine<{ ok: boolean; errorCode: string | null; verificationLevel: string }>(
    tampered.stdout,
    'ARCHIVE_JSON',
  );
  expect(tamperedSummary?.ok).toBe(false);
  expect(tamperedSummary?.errorCode).toBe('REVISION_MISMATCH');
  expect(tamperedSummary?.verificationLevel).toBe('package-only');
}, 180_000);

interface Phase1ReportLike {
  candidates: Array<{ candidateId: string; status: string }>;
  commands: unknown[];
  unexercisedScenarios: string[];
  validationViolations: string[];
}

it('phase1 真实仓只读发现：候选非空且全 discovered、stdout PHASE1_JSON.changedFiles 为空、报告落盘', async () => {
  const root = await createTempGitRepository();
  const outDir = await tempRoot('code-health-e2e-phase1-');
  const reportPath = path.join(outDir, 'phase1-report.json');
  const scenarioPath = await writeJson(outDir, 'scenarios.json', {
    scenarios: [
      {
        id: 'smoke',
        environment: 'win32-git-bash',
        shell: 'git-bash',
        supported: true,
        command: 'node',
        args: ['--version'],
        cwd: '.',
        timeoutMs: 15000,
        targets: ['src/unused.ts'],
      },
    ],
  });

  const before = await gitStatus(root);
  const headBefore = await gitHead(root);
  const run = runCli('code-health-phase1.ts', ['--root', root, '--output', reportPath, '--scenario', scenarioPath]);
  expect(run.code, run.stderr).toBe(0);
  const summary = jsonLine<{ candidateCount: number; commandCount: number; changedFiles: string[] }>(
    run.stdout,
    'PHASE1_JSON',
  );
  expect(summary?.changedFiles).toEqual([]);
  expect(summary?.commandCount).toBe(1);

  const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as Phase1ReportLike;
  expect(report.candidates.length).toBeGreaterThanOrEqual(1);
  expect(report.candidates.every((candidate) => candidate.status === 'discovered')).toBe(true);
  expect(summary?.candidateCount).toBe(report.candidates.length);
  expect(report.commands).toHaveLength(1);
  expect(report.unexercisedScenarios).toEqual([]);
  // 报告落在被分析仓之外，且该次运行未改动被分析目标（changedFiles 为空的同源证据）。
  expect(path.resolve(reportPath).startsWith(`${path.resolve(root)}${path.sep}`)).toBe(false);
  expect(report.validationViolations.filter((entry) => entry.includes('read-only invariant violated'))).toEqual([]);
  expect(await gitStatus(root)).toBe(before);
  expect(await gitHead(root)).toBe(headBefore);
}, 120_000);

// -------------------- 修复轮 1 补齐：T7-3 / T7-4 / T7-5（CLI 级真实 git 全链路） --------------------

const GUARD_CANDIDATE_ID = 'CHG-P3-20260918-901';
const GUARD_SCOPE_HASH = `sha256:${'e'.repeat(64)}`;
/** Fixture-only revision stored inside the committed ledger; it is never re-read as a live revision. */
const GUARD_FIXTURE_REVISION: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

const REHOME_FACTS = ['rehomed:rtm', 'rehomed:coverage', 'rehomed:docs-consistency', 'rehomed:sample-matrix'];
const GUARD_COVERAGE_BYTES = JSON.stringify({ covered: true });
const PHASE1_RAW_PREFIX = '.w-model/code-health/phase1/raw/';
const DUPLICATES_SAMPLE = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/phase4/valid-cluster.json');

/** Real suite: reports its identities AND rewrites the coverage artifact (a genuine post-run producer). */
const GUARD_SUITE_SCRIPT = [
  "import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';",
  'const files = [];',
  'const walk = (dir) => {',
  '  for (const entry of readdirSync(dir, { withFileTypes: true })) {',
  "    const full = dir + '/' + entry.name;",
  '    if (entry.isDirectory()) walk(full);',
  "    else if (entry.name.endsWith('.test.mjs')) files.push(full);",
  '  }',
  '};',
  "walk('tests');",
  'files.sort();',
  "mkdirSync('coverage', { recursive: true });",
  "writeFileSync('coverage/coverage-final.json', JSON.stringify({ covered: true }));",
  "process.stdout.write('CODE_HEALTH_SUITE ' + JSON.stringify({ testCount: files.length, identities: files }) + '\\n');",
  '',
].join('\n');
/** Identity-only suite: reports identities but never writes coverage (drives the final-proof failure). */
const GUARD_IDENTITIES_SCRIPT = [
  "import { readdirSync } from 'node:fs';",
  'const files = [];',
  'const walk = (dir) => {',
  '  for (const entry of readdirSync(dir, { withFileTypes: true })) {',
  "    const full = dir + '/' + entry.name;",
  '    if (entry.isDirectory()) walk(full);',
  "    else if (entry.name.endsWith('.test.mjs')) files.push(full);",
  '  }',
  '};',
  "walk('tests');",
  'files.sort();',
  "process.stdout.write('CODE_HEALTH_SUITE ' + JSON.stringify({ testCount: files.length, identities: files }) + '\\n');",
  '',
].join('\n');

/** A `TestRecord` in the frozen contract shape; only the fields the classifier and inventory read. */
function guardTestRecord(overrides: Partial<TestRecord>): TestRecord {
  return {
    testId: 'test-sum',
    file: 'tests/legacy/sum.test.mjs',
    symbol: 'addsTwoNumbers',
    author: 'human',
    createdAt: '2018-01-01T00:00:00.000Z',
    lastChangedAt: '2018-01-02T00:00:00.000Z',
    level: 'unit',
    setup: 'two integers',
    stimulus: 'add(1, 2)',
    oracle: 'returns 3',
    failureSensitivity: 'detects an incorrect sum',
    rtmIds: ['REQ-MATH-001'],
    scenarioClass: 'happy-path',
    governanceFacts: [],
    ...overrides,
  };
}

/** Declare every test whose computed class is protected, so no protected fact is silently omitted. */
function guardProtectedFactsFor(tests: TestRecord[]): Array<Record<string, unknown>> {
  return tests
    .map((test) => ({ test, cls: classifyProtectedTest(test) }))
    .filter((entry): entry is { test: TestRecord; cls: ProtectedTestClass } => entry.cls !== null)
    .map((entry) => ({
      testId: entry.test.testId,
      class: entry.cls,
      reason: 'Retained protected assertion, unrelated to the proposed duplicate removal.',
    }));
}

interface GuardedE2eProject {
  root: string;
  guardDoc: Record<string, unknown>;
  ledgerPath: string;
}

/**
 * Build a real temp repository whose test deletion is authorized by HEAD-tracked artifacts and real
 * stored evidence:
 *   - `ledger.json` / `.code-health-suite.json` / `.code-health-governance.json` are committed before
 *     any evidence run, because `--guard` refuses an embedded ledger and requires a tracked authority;
 *   - the pre/post raw outputs are produced by the same in-process runner the CLI uses (against the
 *     real live revision), so `verifyDeletionEvidence` re-verifies genuine files, not declared labels.
 */
async function buildGuardedE2eProject(manifestScript: 'suite.mjs' | 'identities.mjs'): Promise<GuardedE2eProject> {
  const root = await tempRoot('code-health-e2e-guard-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'tests', 'legacy'), { recursive: true });
  // Keep every CLI-owned artifact out of the tracked worktree status: `.w-model/` (controlled patch +
  // fixture raw outputs), `.code-health-raw/` (the `--guard` pre/post suite raw outputs) and `coverage/`.
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n.code-health-raw/\ncoverage/\n');
  await fs.writeFile(path.join(root, 'suite.mjs'), GUARD_SUITE_SCRIPT);
  await fs.writeFile(path.join(root, 'identities.mjs'), GUARD_IDENTITIES_SCRIPT);
  await fs.writeFile(
    path.join(root, '.code-health-suite.json'),
    `${JSON.stringify({ command: [process.execPath, manifestScript] })}\n`,
  );
  await fs.writeFile(path.join(root, 'tests', 'legacy', 'old.test.mjs'), 'export const old = true;\n');
  await fs.writeFile(path.join(root, 'tests', 'legacy', 'sum.test.mjs'), 'export const sum = true;\n');
  await fs.writeFile(
    path.join(root, '.code-health-governance.json'),
    `${JSON.stringify(
      { prePushItems: 19, selfTestSamples: 2, docsConsistencyViolations: 0, fixtureReachability: 'all-referenced' },
      null,
      2,
    )}\n`,
  );
  const ledger: CodeHealthLedger = {
    schemaVersion: '1.0',
    campaignId: 'CHC-E2E-GUARD',
    createdAt: '2026-09-18T00:00:00.000Z',
    baseline: GUARD_FIXTURE_REVISION,
    environmentMatrix: [],
    candidates: [
      {
        candidateId: GUARD_CANDIDATE_ID,
        phase: 'P3',
        action: 'delete-code',
        status: 'verified',
        files: ['tests/legacy/old.test.mjs'],
        symbols: ['old'],
        tests: ['tests/legacy/old.test.mjs'],
        revision: GUARD_FIXTURE_REVISION,
        changeScope: { files: ['tests/legacy/old.test.mjs'], symbols: ['old'], scopeHash: GUARD_SCOPE_HASH },
      } as unknown as CodeHealthLedger['candidates'][number],
    ],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
  };
  await writeJson(root, 'ledger.json', ledger);
  expect((await git(root, ['add', '--all'])).code).toBe(0);
  expect(
    (await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'phase 3 guard fixture'])).code,
  ).toBe(0);

  const revision = (await revisionProvider.current(root)) as RevisionIdentity;
  const fixture = await loadApplyFixture('valid-patch.json');
  const candidate: CodeHealthCandidate = {
    ...structuredClone(fixture.candidate),
    candidateId: GUARD_CANDIDATE_ID,
    phase: 'P3',
    action: 'delete-code',
    status: 'under-review',
    files: ['tests/legacy/old.test.mjs'],
    symbols: ['old'],
    tests: ['tests/legacy/old.test.mjs'],
    changeScope: { files: ['tests/legacy/old.test.mjs'], symbols: ['old'], scopeHash: GUARD_SCOPE_HASH },
    revision,
    evidenceBinding: {
      ...fixture.candidate.evidenceBinding,
      candidate: {
        ...fixture.candidate.evidenceBinding.candidate,
        candidateId: GUARD_CANDIDATE_ID,
        phase: 'P3',
        action: 'delete-code',
        files: ['tests/legacy/old.test.mjs'],
        symbols: ['old'],
        scopeHash: GUARD_SCOPE_HASH,
      },
      revision,
    },
    rollback: {
      ...fixture.candidate.rollback,
      preChangeRevision: revision.commitSha,
      command: `git apply -R .w-model/code-health/apply/${GUARD_CANDIDATE_ID}.patch`,
      patchPath: `.w-model/code-health/apply/${GUARD_CANDIDATE_ID}.patch`,
    },
  };

  const evidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: root,
    rawOutputRoot: '.w-model/code-health/raw',
  });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot: root,
    rawOutputDir: '.w-model/code-health/raw',
    evidenceStore,
    revisionProvider,
  });
  const binding: EvidenceBinding = {
    candidate: {
      candidateId: GUARD_CANDIDATE_ID,
      phase: 'P3',
      action: 'delete-code',
      files: candidate.changeScope.files,
      symbols: candidate.changeScope.symbols,
      scopeHash: GUARD_SCOPE_HASH,
    },
    revision,
    rawOutputPath: 'tests/legacy/old.test.mjs',
    rawOutputSha256: '0'.repeat(64),
  };
  const pre = await runner.run(process.execPath, ['suite.mjs'], { cwd: root, env: {}, timeoutMs: 30_000, binding });
  await fs.rename(path.join(root, 'tests', 'legacy', 'old.test.mjs'), path.join(root, 'old.test.mjs.away'));
  const post = await runner.run(process.execPath, ['suite.mjs'], { cwd: root, env: {}, timeoutMs: 30_000, binding });
  await fs.rename(path.join(root, 'old.test.mjs.away'), path.join(root, 'tests', 'legacy', 'old.test.mjs'));
  if (pre.exitCode !== 0 || post.exitCode !== 0) throw new Error('guard fixture suite did not run');

  const candidateTest = guardTestRecord({
    testId: 'test-unauth-old',
    file: 'tests/legacy/old.test.mjs',
    symbol: 'rejectsUnauthorizedCaller',
    oracle: 'rejects an unauthorized caller',
    failureSensitivity: 'detects an authorization bypass',
    rtmIds: ['REQ-SEC-002'],
    scenarioClass: 'security',
  });
  const survivorTest = guardTestRecord({
    testId: 'test-unauth-new',
    file: 'tests/legacy/sum.test.mjs',
    symbol: 'rejectsUnauthorizedCaller',
    oracle: 'rejects an unauthorized caller',
    failureSensitivity: 'detects an authorization bypass',
    rtmIds: ['REQ-SEC-002'],
    scenarioClass: 'security',
  });
  const protectedTest = guardTestRecord({
    testId: 'test-old-model-neg',
    file: 'tests/legacy/old-model.test.ts',
    symbol: 'rejectsMalformedInput',
    createdAt: '2015-01-01T00:00:00.000Z',
    lastChangedAt: '2015-01-02T00:00:00.000Z',
    setup: 'legacy fixture',
    stimulus: 'malformed payload',
    oracle: 'rejects the malformed payload',
    failureSensitivity: 'detects a missing validation guard',
    rtmIds: ['REQ-SEC-001'],
    scenarioClass: 'malformed-input',
  });
  const governanceFacts = [
    'pre-test-count:2',
    'post-test-count:1',
    'coverage-provenance:coverage/coverage-final.json',
    'pre-push:19',
    'pre-push-order:sha256:aaaa',
    'post-push-order:sha256:aaaa',
    'pre-self-test:2',
    'post-self-test:2',
    'pre-docs-consistency:0',
    'post-docs-consistency:0',
    'fixture-reachability:all-referenced',
    ...REHOME_FACTS,
  ];
  const coverageSha = createHash('sha256').update(GUARD_COVERAGE_BYTES).digest('hex');
  const inventory: Record<string, unknown> = {
    inventoryId: `INV-${GUARD_CANDIDATE_ID}`,
    candidateId: GUARD_CANDIDATE_ID,
    revision,
    tests: [candidateTest, survivorTest, protectedTest],
    protectedFacts: guardProtectedFactsFor([candidateTest, survivorTest, protectedTest]),
    removalProof: {
      candidateTestId: 'test-unauth-old',
      survivorTestId: 'test-unauth-new',
      reason: 'The legacy duplicate is covered by the equivalent retained assertion and its RTM row is rehomed.',
      setupEquivalent: true,
      stimulusEquivalent: true,
      oracleEquivalent: true,
      failureSensitivityEquivalent: true,
      levelEquivalent: true,
      rtmRehomed: true,
      governanceRehomed: true,
    },
    preRegression: {
      command: pre,
      testCount: 2,
      passed: true,
      coverageProvenance: 'coverage/coverage-final.json',
      governanceFacts,
    },
    postRegression: {
      command: post,
      testCount: 1,
      passed: true,
      coverageProvenance: 'coverage/coverage-final.json',
      governanceFacts,
    },
    coverageProvenance: {
      path: 'coverage/coverage-final.json',
      sha256: coverageSha,
      revision: revision.commitSha,
      measuredAt: new Date().toISOString(),
      signalOnly: true,
    },
    redaction: { status: 'clean', reasons: ['secrets removed'] },
  };
  const approval: ApprovalDecision = {
    ...(fixture.approval as ApprovalDecision),
    candidateId: GUARD_CANDIDATE_ID,
    approvedAction: 'delete-code',
    approvedFiles: ['tests/legacy/old.test.mjs'],
    approvedSymbols: ['old'],
    scopeHash: GUARD_SCOPE_HASH,
    revision,
  };
  return {
    root,
    guardDoc: { inventory, candidate, approval, suiteManifest: '.code-health-suite.json' },
    ledgerPath: path.join(root, 'ledger.json'),
  };
}

interface GuardSummary {
  type: string;
  exitCode: number;
  applied: boolean;
  rolledBack: boolean;
  removedIdentity: string;
  removedIdentityPresentPre: boolean;
  removedIdentityAbsentPost: boolean;
  preTestCount: number | null;
  postTestCount: number | null;
  violations: string[];
}

it('guard 全链路（T7-3）：真实 pre/post suite → 经 apply CLI 真删 → 最终证明失败即回滚', async () => {
  // 1) 成功链：真实删除 + 身份级前后证明（pre 2 个身份 / post 1 个）。
  const project = await buildGuardedE2eProject('suite.mjs');
  const workDir = await tempRoot('code-health-e2e-guard-inputs-');
  const guardPath = await writeJson(workDir, 'guard.json', project.guardDoc);
  const statusBefore = await gitStatus(project.root);
  expect(statusBefore).toBe('');

  const happy = runCli('code-health-tests.ts', [
    '--guard',
    guardPath,
    '--project',
    project.root,
    '--ledger',
    project.ledgerPath,
  ]);
  expect(happy.code, `${happy.stdout}\n${happy.stderr}`).toBe(0);
  const happySummary = jsonLine<GuardSummary>(happy.stdout, 'GUARD_JSON');
  expect(happySummary?.type).toBe('code-health-tests-guard');
  expect(happySummary?.exitCode).toBe(0);
  expect(happySummary?.applied).toBe(true);
  expect(happySummary?.rolledBack).toBe(false);
  expect(happySummary?.removedIdentity).toBe('tests/legacy/old.test.mjs');
  expect(happySummary?.removedIdentityPresentPre).toBe(true);
  expect(happySummary?.removedIdentityAbsentPost).toBe(true);
  expect(happySummary?.preTestCount).toBe(2);
  expect(happySummary?.postTestCount).toBe(1);
  expect(happySummary?.violations).toEqual([]);
  // 真实删除发生在隔离仓内：victim 从工作区消失、survivor 保留、git status 出现未暂存的 D。
  await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'old.test.mjs'))).rejects.toBeTruthy();
  await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'sum.test.mjs'))).resolves.toBeTruthy();
  expect(await gitStatus(project.root)).toBe('D tests/legacy/old.test.mjs');
  // 删除经由 code-health-apply.ts：只有该 CLI 会落盘受控 patch，且内容是真实删除 patch 文本。
  const patchPath = path.join(project.root, '.w-model', 'code-health', 'apply', `${GUARD_CANDIDATE_ID}.patch`);
  expect((await fs.stat(patchPath)).isFile()).toBe(true);
  expect(await fs.readFile(patchPath, 'utf8')).toContain('deleted file mode 100644');

  // 2) 失败回滚链：预置 coverage 使「受控运行产出」证明失败 → 删除先真实发生，随后被回滚。
  const rollbackProject = await buildGuardedE2eProject('identities.mjs');
  const coveragePath = path.join(rollbackProject.root, 'coverage', 'coverage-final.json');
  await fs.writeFile(coveragePath, GUARD_COVERAGE_BYTES);
  const pinned = new Date(Date.now() - 60_000);
  await fs.utimes(coveragePath, pinned, pinned);
  const rollbackWorkDir = await tempRoot('code-health-e2e-guard-inputs-');
  const rollbackGuardPath = await writeJson(rollbackWorkDir, 'guard.json', rollbackProject.guardDoc);
  const victim = path.join(rollbackProject.root, 'tests', 'legacy', 'old.test.mjs');
  await expect(fs.stat(victim)).resolves.toBeTruthy();
  const rollbackStatusBefore = await gitStatus(rollbackProject.root);
  expect(rollbackStatusBefore).toBe('');

  const failed = runCli('code-health-tests.ts', [
    '--guard',
    rollbackGuardPath,
    '--project',
    rollbackProject.root,
    '--ledger',
    rollbackProject.ledgerPath,
  ]);
  expect(failed.code, `${failed.stdout}\n${failed.stderr}`).toBe(1);
  const failedSummary = jsonLine<GuardSummary>(failed.stdout, 'GUARD_JSON');
  expect(failedSummary?.exitCode).toBe(1);
  expect(failedSummary?.applied).toBe(false);
  expect(failedSummary?.rolledBack).toBe(true);
  expect(failedSummary?.removedIdentityPresentPre).toBe(true);
  expect(failedSummary?.removedIdentityAbsentPost).toBe(true);
  expect((failedSummary?.violations ?? []).join('; ')).toContain(
    'coverage artifact was not produced by the controlled run',
  );
  // 删除真实发生过又真实回滚：victim 回到工作区、工作树无差异、受控 patch 保留为回滚证据。
  await expect(fs.stat(victim)).resolves.toBeTruthy();
  expect((await git(rollbackProject.root, ['diff', '--exit-code'])).code).toBe(0);
  expect(await gitStatus(rollbackProject.root)).toBe(rollbackStatusBefore);
  expect(
    (
      await fs.stat(path.join(rollbackProject.root, '.w-model', 'code-health', 'apply', `${GUARD_CANDIDATE_ID}.patch`))
    ).isFile(),
  ).toBe(true);
}, 300_000);

interface DuplicatesSummary {
  type: string;
  exitCode: number;
  authoritySource: string;
  candidateId: string;
  status: string;
  stableProductionCallSites: string[];
  violations: string[];
  authorized: boolean;
}

/**
 * Real repo + HEAD-tracked P4 ledger whose authority matches the sample's declared authority, so the
 * CLI derives (not accepts) the authorization; every approved scope path exists as a real file.
 */
async function buildDuplicatesE2eRepo(): Promise<{ root: string; matrixPath: string }> {
  const sample = JSON.parse(await fs.readFile(DUPLICATES_SAMPLE, 'utf8')) as {
    candidateId: string;
    input: Record<string, unknown>;
    authority: {
      approvedScope: string[];
      declaredCallSites: string[];
      declaredTests: string[];
      regressionCommands: unknown[];
      trackedFacts: string[];
    };
    review: Record<string, unknown>;
    proposal: Record<string, unknown>;
  };
  const root = await tempRoot('code-health-e2e-duplicates-repo-');
  await git(root, ['init', '--quiet']);
  for (const file of sample.authority.approvedScope) {
    const absolute = path.join(root, ...file.split('/'));
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, `export const ${path.basename(file, '.ts').replace(/-/g, '_')} = 1;\n`);
  }
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  await writeJson(root, 'ledger.json', {
    schemaVersion: '1.0',
    candidates: [
      {
        candidateId: sample.candidateId,
        phase: 'P4',
        action: 'abstract',
        changeScope: {
          files: sample.authority.approvedScope,
          symbols: ['readCacheA', 'readCacheB', 'readCache'],
          scopeHash: `sha256:${'f'.repeat(64)}`,
        },
        callSites: sample.authority.declaredCallSites,
        tests: sample.authority.declaredTests,
        commands: sample.authority.regressionCommands,
        sources: sample.authority.trackedFacts,
      },
    ],
  });
  expect((await git(root, ['add', '--all'])).code).toBe(0);
  expect(
    (await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'phase 4 duplicates fixture'])).code,
  ).toBe(0);
  const matrixPath = await writeJson(await tempRoot('code-health-e2e-duplicates-inputs-'), 'matrix.json', {
    candidateId: sample.candidateId,
    input: sample.input,
    restrictions: {},
    review: sample.review,
    proposal: sample.proposal,
  });
  return { root, matrixPath };
}

it('duplicates 只读（T7-4）：tracked ledger 授权 → under-review，git status 不变且输出不含 APPLY_JSON', async () => {
  const { root, matrixPath } = await buildDuplicatesE2eRepo();
  const before = await gitStatus(root);
  const headBefore = await gitHead(root);
  expect(before).toBe('');

  const run = runCli('code-health-duplicates.ts', [
    '--matrix',
    matrixPath,
    '--ledger',
    path.join(root, 'ledger.json'),
    '--root',
    root,
    '--validate',
  ]);
  expect(run.code, `${run.stdout}\n${run.stderr}`).toBe(0);
  const summary = jsonLine<DuplicatesSummary>(run.stdout, 'DUPLICATES_JSON');
  expect(summary?.type).toBe('code-health-duplicates');
  expect(summary?.exitCode).toBe(0);
  expect(summary?.authoritySource).toBe('tracked-ledger');
  expect(summary?.status).toBe('under-review');
  expect(summary?.authorized).toBe(true);
  expect(summary?.violations).toEqual([]);
  expect(summary?.stableProductionCallSites).toEqual(['src/service-a.ts:load', 'src/service-b.ts:load']);
  // 只读：这是 review 而非 apply，任何 APPLY_JSON 形态都不允许出现。
  expect(run.stdout).not.toContain('APPLY_JSON');
  expect(run.stdout).not.toContain('patchPath');
  // 目标仓零改写：git status / HEAD 不变，且没有 patch 或 .w-model 目录落盘。
  expect(await gitStatus(root)).toBe(before);
  expect(await gitHead(root)).toBe(headBefore);
  await expect(fs.stat(path.join(root, '.w-model'))).rejects.toBeTruthy();
}, 180_000);

interface Phase1SummaryLike {
  type: string;
  exitCode: number;
  candidateCount: number;
  commandCount: number;
  unexercisedScenarios: string[];
  changedFiles: string[];
}

interface Phase1ReportShape {
  revision: { commitSha: string };
  environmentMatrix: Array<{ platform: string; observed: string; reason: string }>;
  unexercisedScenarios: string[];
  commands: Array<{ rawOutputPath: string; rawOutputSha256: string; exitCode: number | null; observation: string }>;
  candidates: Array<{ status: string }>;
  validationViolations: string[];
}

it('phase1 CLI（T7-5）：真实 git 差分下 changedFiles 非空即 exit 1；必需环境不可用 → blocked；raw 落点受控', async () => {
  // 1) 负向（CLI 级、真实 git 差分）：场景命令真实改写被分析目标 → 默认 readWorktreeChanges 读出非空 → exit 1。
  const root = await createTempGitRepository();
  // The probe is a committed script, not an inline `-e` program: the recorded command evidence is the
  // JSON of `{command, argv}`, and `isSafeCommand` rejects `;`/`&`/`|`/`<`/`>` there — an inline program
  // would add an unrelated validation violation and muddy the read-only signal under test.
  await fs.writeFile(
    path.join(root, 'mutate-target.mjs'),
    "import { writeFileSync } from 'node:fs';\nwriteFileSync('src/unused.ts', 'export const unusedFunction = 2;\\n');\n",
  );
  expect((await git(root, ['add', '--all'])).code).toBe(0);
  expect((await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'mutation probe'])).code).toBe(0);
  const outDir = await tempRoot('code-health-e2e-phase1-');
  const negativeReport = path.join(outDir, 'phase1-negative-report.json');
  const negativeScenario = await writeJson(outDir, 'scenarios-negative.json', {
    scenarios: [
      {
        id: 'mutating-target',
        environment: 'e2e-host',
        command: 'node',
        args: ['mutate-target.mjs'],
        cwd: '.',
        timeoutMs: 15000,
        targets: ['src/unused.ts'],
      },
    ],
  });
  const before = await gitStatus(root);
  expect(before).toBe('');

  const negative = runCli('code-health-phase1.ts', [
    '--root',
    root,
    '--output',
    negativeReport,
    '--scenario',
    negativeScenario,
  ]);
  expect(negative.code, `${negative.stdout}\n${negative.stderr}`).toBe(1);
  const negativeSummary = jsonLine<Phase1SummaryLike>(negative.stdout, 'PHASE1_JSON');
  expect(negativeSummary?.exitCode).toBe(1);
  expect(negativeSummary?.changedFiles).toEqual(['src/unused.ts']);
  expect(negativeSummary?.candidateCount).toBeGreaterThanOrEqual(1);
  const negativeReportBody = JSON.parse(await fs.readFile(negativeReport, 'utf8')) as Phase1ReportShape;
  expect(negativeReportBody.validationViolations).toEqual([
    'read-only invariant violated: phase 1 changed src/unused.ts',
  ]);
  // 该非空差分来自真实 git 工作区改动（不是注入的对比函数）：目标文件确实被改，git 自己报告 M。
  expect(await gitStatus(root)).toBe('M src/unused.ts');
  // raw 落点：命令证据指向受控 `.w-model/code-health/phase1/raw/`，且文件真实存在并带真实 SHA-256。
  expect(negativeReportBody.commands).toHaveLength(1);
  const rawRelative = negativeReportBody.commands[0]!.rawOutputPath;
  expect(rawRelative.startsWith(PHASE1_RAW_PREFIX)).toBe(true);
  expect(negativeReportBody.commands[0]!.rawOutputSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(negativeReportBody.commands[0]!.observation).toBe('observed');
  const rawAbsolute = path.join(root, ...rawRelative.split('/'));
  expect(path.resolve(rawAbsolute).startsWith(`${path.resolve(root)}${path.sep}`)).toBe(true);
  expect((await fs.stat(rawAbsolute)).isFile()).toBe(true);

  // 2) blocked 形态（CLI 级）：同一场景集里必需环境不可用 → 候选只 `blocked`、不伪造 evidence、exit 0。
  const blockedRoot = await createTempGitRepository();
  const blockedOut = await tempRoot('code-health-e2e-phase1-');
  const blockedReport = path.join(blockedOut, 'phase1-blocked-report.json');
  const blockedScenario = await writeJson(blockedOut, 'scenarios-blocked.json', {
    scenarios: [
      {
        id: 'applicable-probe',
        environment: 'e2e-host',
        command: 'node',
        args: ['--version'],
        cwd: '.',
        timeoutMs: 15000,
        targets: ['src/unused.ts'],
      },
      {
        id: 'required-elsewhere',
        environment: 'other-host',
        command: 'node',
        args: ['--version'],
        platform: 'not-this-host',
        required: true,
        cwd: '.',
        timeoutMs: 15000,
        targets: ['src/unused.ts'],
      },
    ],
  });
  const blockedStatusBefore = await gitStatus(blockedRoot);
  const blocked = runCli('code-health-phase1.ts', [
    '--root',
    blockedRoot,
    '--output',
    blockedReport,
    '--scenario',
    blockedScenario,
    '--platform',
    'e2e-host',
  ]);
  expect(blocked.code, `${blocked.stdout}\n${blocked.stderr}`).toBe(0);
  const blockedSummary = jsonLine<Phase1SummaryLike>(blocked.stdout, 'PHASE1_JSON');
  expect(blockedSummary?.exitCode).toBe(0);
  expect(blockedSummary?.commandCount).toBe(1);
  expect(blockedSummary?.unexercisedScenarios).toEqual(['required-elsewhere']);
  expect(blockedSummary?.changedFiles).toEqual([]);
  const blockedReportBody = JSON.parse(await fs.readFile(blockedReport, 'utf8')) as Phase1ReportShape;
  expect(blockedReportBody.candidates.length).toBeGreaterThanOrEqual(1);
  expect(blockedReportBody.candidates.every((candidate) => candidate.status === 'blocked')).toBe(true);
  expect(blockedReportBody.validationViolations).toEqual([]);
  // 必需环境不可用落在环境矩阵里（`unavailable`，不伪造 observed），且只读不变量仍成立。
  const requiredRow = blockedReportBody.environmentMatrix.find((row) => row.platform === 'not-this-host');
  expect(requiredRow?.observed).toBe('unavailable');
  expect(requiredRow?.reason).toContain('is not available on');
  expect(blockedReportBody.unexercisedScenarios).toEqual(['required-elsewhere']);
  expect(await gitStatus(blockedRoot)).toBe(blockedStatusBefore);
  expect(await gitHead(blockedRoot)).not.toBe('');
}, 180_000);
