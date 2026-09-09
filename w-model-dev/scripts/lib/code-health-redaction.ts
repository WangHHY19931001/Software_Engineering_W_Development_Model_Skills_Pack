/* eslint-disable security/detect-unsafe-regex -- The path matcher consumes bounded output segments and is followed by explicit redaction. */
import * as path from 'node:path';

export interface CodeHealthRedactionResult {
  value?: unknown;
  status: 'clean' | 'blocked';
  reasons: string[];
}

const SECRET_KEY_PARTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_key',
  'accesskey',
  'private_key',
  'privatekey',
  'certificate',
  'credential',
  'authorization',
] as const;
const SECRET_VALUE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_./+=-';

function isAbsolutePath(value: string): boolean {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value);
}

function redactEmbeddedAbsolutePaths(value: string, reasons: Set<string>): string {
  let sanitized = value;
  // Consume the complete Windows path, including spaces, until an output delimiter.
  const windowsPattern = /(?:[A-Za-z]:[\\/]|\\\\)[^\r\n"'<>|;,)]+/g;
  const posixPattern = /(?<![A-Za-z0-9_])\/[^\r\n"'<>|;,)]+/g;
  sanitized = sanitized.replace(windowsPattern, () => {
    reasons.add('embedded Windows absolute path redacted');
    return '[REPO_PATH_REDACTED]';
  });
  sanitized = sanitized.replace(posixPattern, () => {
    reasons.add('embedded POSIX absolute path redacted');
    return '[REPO_PATH_REDACTED]';
  });
  return sanitized;
}

export function containsSensitiveCodeHealthContent(value: unknown): boolean {
  if (typeof value === 'string') {
    return (
      /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization)\s*[=:]/i.test(value) ||
      /^(?:Bearer|Basic)\s+/i.test(value)
    );
  }
  if (Array.isArray(value)) return value.some((item) => containsSensitiveCodeHealthContent(item));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, item]) => hasSecretFieldName(key) || containsSensitiveCodeHealthContent(item),
    );
  }
  return false;
}

function hasUnsafeControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) return true;
  }
  return false;
}

function hasSecretFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replaceAll('-', '_');
  return SECRET_KEY_PARTS.some((part) => normalized.includes(part));
}

function hasSecretLikeValue(value: string): boolean {
  if (value.startsWith('sha256:')) return false;
  let candidate = value;
  for (const prefix of ['Bearer ', 'Basic ']) {
    if (candidate.startsWith(prefix)) candidate = candidate.slice(prefix.length);
  }
  return candidate.length >= 24 && [...candidate].every((character) => SECRET_VALUE_CHARACTERS.includes(character));
}

function redactString(value: string, fieldName: string, reasons: Set<string>): string | undefined {
  if (hasUnsafeControlCharacter(value)) {
    reasons.add(`unsafe control characters in ${fieldName || 'value'}`);
    throw new Error('redaction blocked: unsafe control characters');
  }
  if (hasSecretFieldName(fieldName)) {
    reasons.add(`sensitive field redacted: ${fieldName}`);
    return '[REDACTED]';
  }
  if (isAbsolutePath(value)) {
    reasons.add(`absolute path redacted: ${fieldName || 'value'}`);
    return '[REPO_PATH_REDACTED]';
  }
  let sanitized = redactEmbeddedAbsolutePaths(value, reasons);
  sanitized = sanitized.replace(
    /(?:\b(?:authorization|proxy-authorization)\s*:\s*)(?:Bearer|Basic)\s+[^\s,;)]*/gi,
    () => {
      reasons.add(`sensitive authorization redacted: ${fieldName || 'value'}`);
      return '[REDACTED]';
    },
  );
  sanitized = sanitized.replace(
    /((?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization)\s*[=:]\s*)[^\s,;)]*/gi,
    (_match, prefix: string) => {
      reasons.add(`sensitive output redacted: ${fieldName || 'value'}`);
      return `${prefix}[REDACTED]`;
    },
  );
  if (hasSecretLikeValue(sanitized)) {
    reasons.add(`secret-like value redacted: ${fieldName || 'value'}`);
    return '[REDACTED]';
  }
  return sanitized;
}

function redact(value: unknown, fieldName: string, reasons: Set<string>): unknown {
  if (typeof value === 'string') return redactString(value, fieldName, reasons);
  if (Array.isArray(value)) {
    return value.map((item, index) => redact(item, `${fieldName}[${index}]`, reasons));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).flatMap(([key, item]) => {
      const sanitized = redact(item, key, reasons);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

export function redactCodeHealthArtifact(value: unknown): CodeHealthRedactionResult {
  const reasons = new Set<string>();
  try {
    const sanitized = redact(value, '', reasons);
    if (sanitized === undefined) return { status: 'blocked', reasons: [...reasons] };
    return { value: sanitized, status: 'clean', reasons: [...reasons] };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('redaction blocked:')) {
      return { status: 'blocked', reasons: [...reasons, error.message] };
    }
    throw error;
  }
}
