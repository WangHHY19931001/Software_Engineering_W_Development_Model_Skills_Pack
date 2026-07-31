import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { diffFindings } from '../security-scan.js';
import type { EslintResult, BaselineEntry } from '../security-scan.js';

function hashOf(relFile: string, line: number, column: number, ruleId: string): string {
  return createHash('sha256').update(`${relFile}:${line}:${column}:${ruleId}`).digest('hex');
}

describe('security-scan diffFindings（借鉴点 3）', () => {
  it('baseline 内的发现被豁免', () => {
    const findings: EslintResult[] = [{
      filePath: 'w-model-dev/scripts/x.ts',
      messages: [{ line: 10, column: 5, ruleId: 'security/detect-eval-with-expression', message: 'eval' }],
    }];
    const baseline: BaselineEntry[] = [{
      hash: 'mock-hash', rule_id: 'security/detect-eval-with-expression',
      file: 'w-model-dev/scripts/x.ts', line: 10, reason: 'Accepted',
    }];
    // 用真实 fingerprint（与 security-scan.ts 的 fingerprint 函数一致）
    baseline[0]!.hash = hashOf('w-model-dev/scripts/x.ts', 10, 5, 'security/detect-eval-with-expression');
    const r = diffFindings(findings, baseline);
    expect(r.newFindings).toHaveLength(0);
    expect(r.baselineHits).toBe(1);
  });

  it('baseline 外的新发现被识别', () => {
    const findings: EslintResult[] = [{
      filePath: 'w-model-dev/scripts/y.ts',
      messages: [{ line: 20, column: 3, ruleId: 'security/detect-non-literal-regexp', message: 'regex' }],
    }];
    const baseline: BaselineEntry[] = [];
    const r = diffFindings(findings, baseline);
    expect(r.newFindings).toHaveLength(1);
    expect(r.newFindings[0]!.rule_id).toBe('security/detect-non-literal-regexp');
    expect(r.newFindings[0]!.file).toBe('w-model-dev/scripts/y.ts');
  });

  it('同一文件以相对路径与绝对路径给出时命中同一 hash（B7 归一化）', () => {
    const relFile = 'w-model-dev/scripts/x.ts';
    const absFile = path.resolve(relFile);
    const expectedRel = path.relative(process.cwd(), absFile).split(path.sep).join('/');
    expect(expectedRel).toBe(relFile);
    const baseline: BaselineEntry[] = [{
      hash: '', rule_id: 'security/detect-eval-with-expression',
      file: expectedRel, line: 10, reason: 'Accepted',
    }];
    baseline[0]!.hash = hashOf(expectedRel, 10, 5, 'security/detect-eval-with-expression');
    const findings: EslintResult[] = [{
      filePath: absFile,
      messages: [{ line: 10, column: 5, ruleId: 'security/detect-eval-with-expression', message: 'eval' }],
    }];
    const r = diffFindings(findings, baseline);
    expect(r.newFindings).toHaveLength(0);
    expect(r.baselineHits).toBe(1);
  });
});
