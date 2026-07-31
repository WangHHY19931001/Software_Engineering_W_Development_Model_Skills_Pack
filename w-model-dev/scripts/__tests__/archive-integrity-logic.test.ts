import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { checkArchiveIntegrity, ARCHIVE_INTEGRITY_CHECKLIST } from '../archive-integrity-logic.js';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples', 'archive-integrity');

function loadFileList(filename: string): Set<string> {
  const content = readFileSync(path.join(SAMPLES_DIR, filename), 'utf-8');
  return new Set(JSON.parse(content));
}

describe('[21.0.0] archive-integrity-logic', () => {
  it('valid-full 通过', () => {
    const contents = loadFileList('valid-full.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
  });

  it('bad-missing-phase1-docs 失败', () => {
    const contents = loadFileList('bad-missing-phase1-docs.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some(f => f.includes('requirements.md'))).toBe(true);
  });

  it('bad-missing-signature-chain 失败', () => {
    const contents = loadFileList('bad-missing-signature-chain.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some(f => f.includes('signature-chain.jsonl'))).toBe(true);
  });

  it('bad-missing-gate-logs 失败', () => {
    const contents = loadFileList('bad-missing-gate-logs.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some(f => f.includes('gate-logs/'))).toBe(true);
  });

  it('ARCHIVE_INTEGRITY_CHECKLIST 完整性', () => {
    expect(ARCHIVE_INTEGRITY_CHECKLIST['1']).toContain('requirements.md');
    expect(ARCHIVE_INTEGRITY_CHECKLIST['8']).toContain('acceptance-test-report.json');
    expect(ARCHIVE_INTEGRITY_CHECKLIST.global).toContain('signature-chain.jsonl');
  });

  it('非归档根下同名文件不满足 verifier-output- 前缀匹配', () => {
    // 文件在非归档根子目录下，basename 不以 verifier-output- 开头
    const contents = new Set([
      'some/deep/path/other-verifier-output-1.json',
    ]);
    const result = checkArchiveIntegrity(contents, ['global']);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some(f => f.includes('verifier-output-'))).toBe(true);
  });
});
