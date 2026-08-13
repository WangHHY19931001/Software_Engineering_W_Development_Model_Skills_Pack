/**
 * 签名链校验纯逻辑层（Signature Chain Logic）
 *
 * 对应 SSoT §7.9 SignatureChainEntry schema + §10.11 签名链门禁。
 * 供 check-signature-chain.ts（CLI）调用，校验 signature-chain.jsonl 的：
 *   R1 角色齐全 + R2 链连续 + R3 时序单调 + R4 角色匹配 + R5 代签检测
 *   + R6 防篡改 + R7 悬空来源 + R8 缺失产物 + R9 越权消费 + R10 绕过门禁
 *   + 跨阶段消费者校验。
 *
 * 单点事实源，不依赖任何 I/O 与 LLM。
 */

import { createHash } from 'node:crypto';

import { validateBySchema } from './schema-loader.js';

// ==================== 类型定义 ====================

export type Role = 'O' | 'S' | 'A' | 'V' | 'G' | 'R';

export interface SourceArtifact {
  path: string;
  sourceSigId: string;
  sourceRole: Role;
}

export interface InputProvenance {
  sourceSigIds: string[];
  sourceArtifacts: SourceArtifact[];
  transformDescription: string;
}

export interface SignatureChainEntry {
  sigId: string;
  phase: number;
  phaseName?: string;
  role: Role;
  action: string;
  runId: string;
  artifacts: string[];
  prevSigId: string;
  prevSigHash: string;
  sigHash: string;
  signedAt: string;
  signer: string;
  gateExitCode?: number | null;
  gateLogPath?: string | null;
  inputProvenance: InputProvenance;
}

export interface SignatureChainCheckOptions {
  phase?: number;
  stage?: 'pre-gate' | 'pre-checkpoint' | 'archive';
  /** 磁盘存在的文件路径集合（用于 R8 校验）；若不提供则跳过 R8 */
  existingPaths?: Set<string>;
}

export interface SignatureChainCheckResult {
  passed: boolean;
  violations: string[];
  rulesPassed: string[];
  rulesFailed: string[];
}

// ==================== 阶段角色清单 ====================

/** 各阶段强制角色链（不含 genesis / 不含 O checkpoint 末环） */
const PHASE_ROLE_CHAINS: Record<number, Role[]> = {
  1: ['O', 'A', 'S', 'V', 'G', 'G', 'G', 'G'],
  2: ['O', 'A', 'S', 'V', 'G', 'G', 'G'],
  3: ['O', 'A', 'S', 'V', 'G', 'G', 'G'],
  4: ['O', 'A', 'S', 'V', 'G', 'G', 'G'],
  5: ['O', 'S', 'V', 'G', 'G'],
  6: ['O', 'S', 'V', 'G'],
  7: ['O', 'S', 'V', 'G'],
  8: ['O', 'S', 'V', 'G', 'G'],
};

// ==================== 来源正确性矩阵 ====================

/** 各角色禁止来源角色（sourceArtifacts 中 sourceRole 不得属于此集合） */
const FORBIDDEN_SOURCE_ROLES: Record<Role, Role[]> = {
  O: ['S', 'A'], // O checkpoint 不得直接基于 S/A 产物（须通过 G）
  A: ['S', 'V', 'G', 'R'],
  S: ['V', 'G', 'R'],
  R: ['S'], // R 须独立定位，不得消费 S 产物
  V: ['G', 'R'],
  G: ['S'],
};

// ==================== sigHash 重算 ====================

/**
 * 重算 sigHash（R6 防篡改校验）
 * sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)
 */
export function computeSigHash(entry: Omit<SignatureChainEntry, 'sigHash'>): string {
  const artifactsStr = JSON.stringify(entry.artifacts);
  const provenanceStr = JSON.stringify(entry.inputProvenance);
  const input = `${entry.sigId}|${entry.phase}|${entry.role}|${entry.action}|${entry.runId}|${artifactsStr}|${entry.prevSigHash}|${entry.signedAt}|${entry.signer}|${provenanceStr}`;
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

// ==================== 主校验函数 ====================

export function checkSignatureChain(
  entries: unknown[],
  options?: SignatureChainCheckOptions,
): SignatureChainCheckResult {
  const violations: string[] = [];
  const rulesPassed: string[] = [];
  const rulesFailed: string[] = [];

  // 入口 schema 校验（防反模式 #28）：逐条校验记录结构，违规以 [schema] 前缀报告
  for (const [i, e] of entries.entries()) {
    const schemaResult = validateBySchema('signature-chain', e);
    if (!schemaResult.valid) {
      for (const msg of schemaResult.errorMessages) {
        violations.push(`[schema] 第 ${i + 1} 条: ${msg}`);
      }
    }
  }
  if (violations.length > 0) {
    return { passed: false, violations, rulesPassed: [], rulesFailed: ['R1'] };
  }

  // 过滤 phase
  let scopedEntries = entries as SignatureChainEntry[];
  if (options?.phase && options.phase > 0) {
    scopedEntries = scopedEntries.filter((e) => e.phase === options.phase);
  }

  if (scopedEntries.length === 0) {
    return {
      passed: false,
      violations: [`无 phase=${options?.phase ?? 'any'} 的签名记录`],
      rulesPassed: [],
      rulesFailed: ['R1'],
    };
  }

  const phase = scopedEntries[0]!.phase;
  const phaseEntries = [...scopedEntries].sort(
    (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
  );

  // ==================== R1: 角色齐全 ====================
  const expectedRoles = PHASE_ROLE_CHAINS[phase] ?? [];
  const actualRoles = phaseEntries.filter((e) => e.role !== 'O' || e.action !== 'checkpoint').map((e) => e.role);
  const hasCheckpoint = phaseEntries.some((e) => e.role === 'O' && e.action === 'checkpoint');
  const requiredAllRoles = [...expectedRoles];
  // 检查每个强制角色至少出现一次
  const missingRoles: string[] = [];
  for (const role of new Set(requiredAllRoles)) {
    if (!actualRoles.includes(role)) {
      missingRoles.push(role);
    }
  }
  if (!hasCheckpoint) {
    missingRoles.push('O(checkpoint)');
  }
  if (missingRoles.length > 0) {
    violations.push(`R1: 阶段 ${phase} 缺失角色签名：${missingRoles.join(', ')}`);
    rulesFailed.push('R1');
  } else {
    rulesPassed.push('R1');
  }

  // ==================== R2: 链连续（跨阶段连续链语义） ====================
  if (options?.phase && options.phase > 0) {
    // --phase=N mode: cross-phase continuous chain
    const allSorted = [...(entries as SignatureChainEntry[])].sort(
      (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
    );
    const allSigIds = new Set(allSorted.map((e) => e.sigId));
    allSigIds.add('genesis');

    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i]!;
      if (i === 0) {
        // 首条：prevSigId 允许指向上一阶段末条或 genesis
        if (!allSigIds.has(entry.prevSigId)) {
          violations.push(`R2: 签名链断裂：${entry.sigId} 首条 prevSigId="${entry.prevSigId}" 不存在于全链中`);
          rulesFailed.push('R2');
        }
        if (entry.prevSigId !== 'genesis') {
          const ref = allSorted.find((e) => e.sigId === entry.prevSigId);
          if (ref && entry.prevSigHash !== ref.sigHash) {
            violations.push(`R2: 签名链断裂：${entry.sigId} 首条 prevSigHash 与 ${entry.prevSigId} 的 sigHash 不一致`);
            rulesFailed.push('R2');
          }
        } else if (entry.prevSigHash !== '0') {
          violations.push(`R2: 签名链断裂：${entry.sigId} genesis 条 prevSigHash 应为 "0"`);
          rulesFailed.push('R2');
        }
      } else {
        // Phase 内前条用列表索引
        const prev = phaseEntries[i - 1]!;
        if (entry.prevSigId !== prev.sigId || entry.prevSigHash !== prev.sigHash) {
          violations.push(
            `R2: 签名链断裂：${entry.sigId} 的 prevSigId/prevSigHash 与 phase 内前环 ${prev.sigId} 不匹配（期望 prevSigId=${prev.sigId}, prevSigHash=${prev.sigHash}）`,
          );
          rulesFailed.push('R2');
        }
      }
    }
  } else {
    // Archive mode: 全链连续校验（跨阶段一条链）
    const allSorted = [...(entries as SignatureChainEntry[])].sort(
      (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
    );
    if (allSorted.length > 0) {
      if (allSorted[0]!.prevSigId !== 'genesis' || allSorted[0]!.prevSigHash !== '0') {
        violations.push(`R2: 签名链断裂：全链首条 ${allSorted[0]!.sigId} 的 prevSigId/prevSigHash 应为 genesis / "0"`);
        rulesFailed.push('R2');
      } else {
        for (let i = 1; i < allSorted.length; i++) {
          const entry = allSorted[i]!;
          const prev = allSorted[i - 1]!;
          if (entry.prevSigId !== prev.sigId || entry.prevSigHash !== prev.sigHash) {
            violations.push(
              `R2: 签名链断裂：${entry.sigId} 的 prevSigId/prevSigHash 与前环 ${prev.sigId} 不匹配（期望 prevSigId=${prev.sigId}, prevSigHash=${prev.sigHash}）`,
            );
            rulesFailed.push('R2');
          }
        }
      }
    }
  }
  if (!rulesFailed.includes('R2')) {
    rulesPassed.push('R2');
  }

  // ==================== R3: 时序单调（按链顺序校验 signedAt 不得早于前环） ====================
  // 注：phaseEntries 已按 signedAt 排序，相邻比较无法检出回填；须按 prevSigId 链序校验。
  const entryBySigId = new Map<string, SignatureChainEntry>(
    phaseEntries.map((e): [string, SignatureChainEntry] => [e.sigId, e]),
  );
  for (const entry of phaseEntries) {
    if (entry.prevSigId === 'genesis') continue;
    const prev = entryBySigId.get(entry.prevSigId);
    if (prev && new Date(entry.signedAt).getTime() < new Date(prev.signedAt).getTime()) {
      violations.push(
        `R3: 时间戳非单调递增：${entry.sigId}(${entry.signedAt}) 早于 ${entry.prevSigId}(${prev.signedAt})`,
      );
      rulesFailed.push('R3');
    }
  }
  if (!rulesFailed.includes('R3')) {
    rulesPassed.push('R3');
  }

  // ==================== R4: 角色匹配 ====================
  const allowedRoles = new Set([...expectedRoles, 'O', 'R']); // O/R 可在任意位置出现
  for (const entry of phaseEntries) {
    if (!allowedRoles.has(entry.role)) {
      violations.push(`R4: 阶段 ${phase} 不允许角色 ${entry.role}（sigId=${entry.sigId}）`);
      rulesFailed.push('R4');
    }
  }
  if (!rulesFailed.includes('R4')) {
    rulesPassed.push('R4');
  }

  // ==================== R5: 代签检测 ====================
  const checkpointEntries = phaseEntries.filter((e) => e.role === 'O' && e.action === 'checkpoint');
  for (const cp of checkpointEntries) {
    // signer 为 O 角色 ID 即代签（简单启发式：signer 包含 'O' 或 'orchestrator' 或 'agent'）
    if (
      cp.signer === 'O' ||
      cp.signer.toLowerCase().includes('orchestrator') ||
      cp.signer.toLowerCase().includes('self-as-verifier')
    ) {
      violations.push(`R5: 阶段 ${phase} O checkpoint 签名 signer="${cp.signer}" 为 O 角色（代签检测，O4 命中）`);
      rulesFailed.push('R5');
    }
  }
  if (!rulesFailed.includes('R5')) {
    rulesPassed.push('R5');
  }

  // ==================== R6: 防篡改 ====================
  for (const entry of phaseEntries) {
    const recomputed = computeSigHash(entry);
    if (recomputed !== entry.sigHash) {
      violations.push(`R6: sigHash 篡改检测：${entry.sigId} 重算 sigHash 与记录不一致`);
      rulesFailed.push('R6');
    }
  }
  if (!rulesFailed.includes('R6')) {
    rulesPassed.push('R6');
  }

  // ==================== R7: 悬空来源 ====================
  const allSigIds = new Set(phaseEntries.map((e) => e.sigId));
  allSigIds.add('genesis');
  if (options?.phase && options.phase > 0) {
    // --phase=N mode: 来源并集 = 本阶段 ∪ 上一阶段（跨阶段消费者校验）
    const allEntries = entries as SignatureChainEntry[];
    for (const e of allEntries) {
      if (e.phase === options.phase - 1) {
        allSigIds.add(e.sigId);
      }
    }
  }
  for (const entry of phaseEntries) {
    for (const sourceSigId of entry.inputProvenance?.sourceSigIds ?? []) {
      if (!allSigIds.has(sourceSigId)) {
        violations.push(`R7: ${entry.sigId} 悬空来源：sourceSigId="${sourceSigId}" 不存在于签名链中`);
        rulesFailed.push('R7');
      }
    }
  }
  if (!rulesFailed.includes('R7')) {
    rulesPassed.push('R7');
  }

  // ==================== R8: 缺失产物 ====================
  if (options?.existingPaths) {
    for (const entry of phaseEntries) {
      for (const srcArtifact of entry.inputProvenance?.sourceArtifacts ?? []) {
        if (!options.existingPaths.has(srcArtifact.path)) {
          violations.push(`R8: ${entry.sigId} 缺失产物：sourceArtifacts path="${srcArtifact.path}" 不存在于磁盘`);
          rulesFailed.push('R8');
        }
      }
    }
  }
  if (!rulesFailed.includes('R8')) {
    rulesPassed.push('R8');
  }

  // ==================== R9: 越权消费 ====================
  for (const entry of phaseEntries) {
    const role = entry.role;
    const action = entry.action;
    if (role === 'O' && (action === 'chunk' || action === 'checkpoint')) continue;

    const sourceRoles = (entry.inputProvenance?.sourceArtifacts ?? []).map((a) => a.sourceRole);
    const forbidden = FORBIDDEN_SOURCE_ROLES[role] ?? [];
    for (const srcRole of sourceRoles) {
      if (forbidden.includes(srcRole)) {
        violations.push(`R9: ${entry.sigId} 越权消费：角色 ${role} 不得消费 ${srcRole} 产物`);
        rulesFailed.push('R9');
      }
    }
  }
  if (!rulesFailed.includes('R9')) {
    rulesPassed.push('R9');
  }

  // ==================== R10: 绕过门禁 ====================
  for (const cp of checkpointEntries) {
    const sourceRoles = (cp.inputProvenance?.sourceArtifacts ?? []).map((a) => a.sourceRole);
    if (!sourceRoles.includes('G')) {
      violations.push(`R10: ${cp.sigId} 绕过门禁：O checkpoint 的 sourceArtifacts 须含 G gate 产物`);
      rulesFailed.push('R10');
    }
  }
  if (!rulesFailed.includes('R10')) {
    rulesPassed.push('R10');
  }

  // ==================== 跨阶段消费者校验（archive 模式） ====================
  if (options?.stage === 'archive' && options.phase === undefined) {
    // 校验阶段连续性：阶段 N+1 的 O chunk 须引用阶段 N 的 O checkpoint
    const allEntries = entries as SignatureChainEntry[];
    const phaseNumbers = [...new Set(allEntries.map((e) => e.phase))].sort((a, b) => a - b);
    for (let i = 1; i < phaseNumbers.length; i++) {
      const prevPhase = phaseNumbers[i - 1];
      const currPhase = phaseNumbers[i];
      const prevCheckpoint = allEntries.find(
        (e) => e.phase === prevPhase && e.role === 'O' && e.action === 'checkpoint',
      );
      const currChunk = allEntries.find((e) => e.phase === currPhase && e.role === 'O' && e.action === 'chunk');
      if (prevCheckpoint && currChunk) {
        if (!currChunk.inputProvenance?.sourceSigIds?.includes(prevCheckpoint.sigId)) {
          violations.push(`跨阶段：阶段 ${currPhase} O chunk 未引用阶段 ${prevPhase} O checkpoint 签名`);
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    rulesPassed,
    rulesFailed,
  };
}
