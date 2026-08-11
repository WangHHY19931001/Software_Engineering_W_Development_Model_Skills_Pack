import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { diffFindings, normalizeSourceLine, computeFindingHash } from '../cli/security-scan.js';
import type { EslintResult, BaselineEntry, ResolveLine } from '../cli/security-scan.js';

/** 内容敏感指纹 helper（与 security-scan.ts 同算法：file + ruleId + 归一化行内容） */
function contentHash(relFile: string, ruleId: string, sourceLine: string): string {
  return computeFindingHash(relFile, ruleId, normalizeSourceLine(sourceLine));
}

/** 测试用 resolveLine stub：返回固定行文本，缺省 null */
function stubResolve(map: Record<number, string>): ResolveLine {
  return (_file, line) => map[line] ?? null;
}

describe('security-scan diffFindings（借鉴点 3，baseline v2 内容敏感指纹）', () => {
  it('baseline 内的发现被豁免', () => {
    const ruleId = 'security/detect-eval-with-expression';
    const rel = 'w-model-dev/scripts/x.ts';
    const lineContent = '  eval(userInput);';
    const findings: EslintResult[] = [
      {
        filePath: rel,
        messages: [{ line: 10, column: 5, ruleId, message: 'eval' }],
      },
    ];
    const baseline: BaselineEntry[] = [
      {
        hash: contentHash(rel, ruleId, lineContent),
        rule_id: ruleId,
        file: rel,
        line: 10,
        reason: 'Accepted',
      },
    ];
    const r = diffFindings(findings, baseline, stubResolve({ 10: lineContent }));
    expect(r.newFindings).toHaveLength(0);
    expect(r.baselineHits).toBe(1);
  });

  it('baseline 外的新发现被识别', () => {
    const ruleId = 'security/detect-non-literal-regexp';
    const rel = 'w-model-dev/scripts/y.ts';
    const findings: EslintResult[] = [
      {
        filePath: rel,
        messages: [{ line: 20, column: 3, ruleId, message: 'regex' }],
      },
    ];
    const r = diffFindings(findings, [], stubResolve({ 20: 'new RegExp(pattern);' }));
    expect(r.newFindings).toHaveLength(1);
    expect(r.newFindings[0]!.rule_id).toBe(ruleId);
    expect(r.newFindings[0]!.file).toBe(rel);
  });

  it('同一文件以相对路径与绝对路径给出时命中同一 hash（B7 归一化）', () => {
    const ruleId = 'security/detect-eval-with-expression';
    const relFile = 'w-model-dev/scripts/x.ts';
    const absFile = path.resolve(relFile);
    const expectedRel = path.relative(process.cwd(), absFile).split(path.sep).join('/');
    expect(expectedRel).toBe(relFile);
    const lineContent = 'eval(x);';
    const baseline: BaselineEntry[] = [
      {
        hash: contentHash(expectedRel, ruleId, lineContent),
        rule_id: ruleId,
        file: expectedRel,
        line: 10,
        reason: 'Accepted',
      },
    ];
    const findings: EslintResult[] = [
      {
        filePath: absFile,
        messages: [{ line: 10, column: 5, ruleId, message: 'eval' }],
      },
    ];
    const r = diffFindings(findings, baseline, stubResolve({ 10: lineContent }));
    expect(r.newFindings).toHaveLength(0);
    expect(r.baselineHits).toBe(1);
  });
});

describe('security-scan 内容敏感指纹（baseline v2 新增用例）', () => {
  // ─── 测试 1：行漂移稳定（核心场景）───
  // 场景：baseline 按第 10 行登记；上方新增 10 行后违规代码漂移到第 20 行，内容未变。
  // 旧算法（file:line:column）会误报"新增"；新算法按内容判定 → 仍命中基线豁免。
  it('行漂移稳定：同规则同内容、不同行号 → 同一指纹（全部豁免，不误报）', () => {
    const ruleId = 'security/detect-non-literal-fs-filename';
    const rel = 'w-model-dev/scripts/x.ts';
    const content = '  const data = fs.readFileSync(filePath);';

    // 两次发现：第 10 行（漂移前位置）与第 20 行（漂移后位置），内容完全相同
    const findings: EslintResult[] = [
      {
        filePath: rel,
        messages: [
          { line: 10, column: 5, ruleId, message: 'x' },
          { line: 20, column: 5, ruleId, message: 'x' },
        ],
      },
    ];
    // baseline 仅登记 1 条（line 字段仅作人类参考，不参与 hash）
    const baseline: BaselineEntry[] = [
      {
        hash: contentHash(rel, ruleId, content),
        rule_id: ruleId,
        file: rel,
        line: 10,
        reason: 'Accepted',
      },
    ];

    const r = diffFindings(findings, baseline, stubResolve({ 10: content, 20: content }));
    expect(r.newFindings).toHaveLength(0); // 两次发现均命中基线
    expect(r.baselineHits).toBe(2); // 同类合并：同 hash 全部豁免
  });

  // ─── 测试 2：内容敏感 ───
  // 场景：同一位置代码模式被修改（readFileSync → readFile），必须产生新指纹触发复审
  it('内容敏感：同一位置代码被修改 → 新指纹（判为新增）', () => {
    const ruleId = 'security/detect-non-literal-fs-filename';
    const rel = 'w-model-dev/scripts/y.ts';
    const findings: EslintResult[] = [
      {
        filePath: rel,
        messages: [{ line: 10, column: 5, ruleId, message: 'x' }],
      },
    ];
    const baseline: BaselineEntry[] = [
      {
        hash: contentHash(rel, ruleId, 'const data = fs.readFileSync(filePath);'),
        rule_id: ruleId,
        file: rel,
        line: 10,
        reason: 'Accepted',
      },
    ];
    // 源文件该行内容已改为 readFile（异步）
    const resolveLine: ResolveLine = (f, l) =>
      f === rel && l === 10 ? 'const data = await fs.readFile(filePath);' : null;

    const r = diffFindings(findings, baseline, resolveLine);
    expect(r.newFindings).toHaveLength(1);
    expect(r.baselineHits).toBe(0);
  });

  // ─── 测试 3：归一化（跨平台一致性）───
  it('归一化：CRLF 与首尾空白不影响指纹（跨平台一致）', () => {
    const ruleId = 'security/detect-non-literal-fs-filename';
    const rel = 'w-model-dev/scripts/z.ts';
    const win = '  const data = fs.readFileSync(filePath);\r\n'; // Windows：带缩进 + CRLF
    const posix = 'const data = fs.readFileSync(filePath);'; // POSIX：无缩进 + LF

    expect(normalizeSourceLine(win)).toBe(normalizeSourceLine(posix));
    expect(contentHash(rel, ruleId, win)).toBe(contentHash(rel, ruleId, posix));
  });

  // ─── 测试 4：源行不可读（防御性）───
  // 场景：resolveLine 返回 null（文件 ENOENT / 行越界）→ 不抛异常、不中断，
  //       按「空内容指纹（file+ruleId+空串）」参与比较，不在基线则判为新增（不静默吞掉）
  it('源行不可读（模拟 ENOENT）：不中断，按空内容指纹判定', () => {
    const ruleId = 'security/detect-non-literal-fs-filename';
    const rel = 'w-model-dev/scripts/missing.ts';
    const findings: EslintResult[] = [
      {
        filePath: rel,
        messages: [{ line: 5, column: 3, ruleId, message: 'x' }],
      },
    ];
    const baseline: BaselineEntry[] = [];
    const resolveLine: ResolveLine = () => null;

    expect(() => diffFindings(findings, baseline, resolveLine)).not.toThrow();
    const r = diffFindings(findings, baseline, resolveLine);
    expect(r.newFindings).toHaveLength(1);
    expect(r.newFindings[0]!.file).toBe(rel);
    expect(r.baselineHits).toBe(0);
  });
});
