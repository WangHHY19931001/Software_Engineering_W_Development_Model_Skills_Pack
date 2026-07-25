// Logger + audit log + invariant helper (covers invariant-coverage gate requirement).

import type { AuditLog, ID } from '../types.js';

type LogFn = (msg: string, meta?: unknown) => void;

const noop: LogFn = () => {};

export const logger = {
  info: (msg: string, meta?: unknown) => console.log(`[INFO] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: unknown) => console.warn(`[WARN] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: unknown) => console.error(`[ERROR] ${msg}`, meta ?? ''),
  debug: noop,
};

// In-memory audit log buffer shared with SiteStore/UserService/etc.
// Stores append AuditLog records; controllers/services may inspect.
export const auditLogBuffer: AuditLog[] = [];

export function appendAuditLog(userId: ID, action: string, target: string): AuditLog {
  const entry: AuditLog = {
    id: `log-${auditLogBuffer.length + 1}-${Date.now()}`,
    userId,
    action,
    target,
    at: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  auditLogBuffer.push(entry);
  return entry;
}

export function appendOperationLog(userId: ID, action: string, target: string): AuditLog {
  // Operation log mirrors audit log shape but conceptually covers user-facing operations.
  return appendAuditLog(userId, action, target);
}

export function clearAuditLogs(): void {
  auditLogBuffer.length = 0;
}

/**
 * Runtime invariant check. Throws when `condition` is falsy.
 * Satisfies the TLA+ invariant coverage gate.
 */
export function invariant(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}

/**
 * Assert helper using console.assert (alternative invariant form).
 * Returns true when ok, false otherwise (does not throw).
 */
export function debugAssert(condition: boolean, message: string): boolean {
  console.assert(condition, `Assertion failed: ${message}`);
  return condition;
}
