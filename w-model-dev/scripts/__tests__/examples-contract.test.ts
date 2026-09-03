import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FAILURE_CHAIN =
  'V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT';

function read(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- relativePath is selected from this fixed repository contract test inventory
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function containsFailureChain(content: string): boolean {
  return content.replace(/\s+/g, ' ').includes(FAILURE_CHAIN);
}

function hasValidResult(command: string): boolean {
  // The result token is a value, not a prefix: punctuation or suffixes such as
  // `passed`, `pass|fail`, `pass,` and `pass.` must not pass the contract.
  return /(?:^|\s)result=(?:<pass\|fail>|pass|fail)(?=$|\s|`)/.test(command);
}

function testCommands(content: string): string[] {
  const commands: string[] = [];
  const lines = content.split(/\r?\n/);
  let inFence = false;
  let active: string | undefined;
  const flush = (): void => {
    if (active?.includes('type=')) commands.push(active.replace(/\s+/g, ' ').trim());
    active = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inFence) flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      const start = line.indexOf('/wm test');
      if (start >= 0) {
        flush();
        active = line.slice(start);
      } else if (active && trimmed) {
        active += ` ${trimmed}`;
      }
      continue;
    }

    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const value = match[1]!;
      if (value.includes('/wm test') && value.includes('type=')) commands.push(value.trim());
    }
  }
  flush();
  return commands;
}

function markdownFiles(relativeDirectory: string): string[] {
  const directory = path.join(REPO_ROOT, relativeDirectory);
  const files: string[] = [];
  const visit = (absoluteDirectory: string): void => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory stays within the fixed repository contract-test inventory
    for (const entry of readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.relative(REPO_ROOT, absolutePath));
    }
  };
  visit(directory);
  return files.sort();
}

const ORDINARY_FAILURE_CHAIN =
  'V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT';

function normalizeGuidance(value: string): string {
  return value.replace(/[`*_]/g, '').replace(/\s+/g, ' ');
}

function hasCompleteOrdinaryFailureChain(value: string): boolean {
  const normalized = normalizeGuidance(value);
  const variants = [
    ORDINARY_FAILURE_CHAIN,
    ORDINARY_FAILURE_CHAIN.replace(' → R → ', ' → R 定位 → '),
    ORDINARY_FAILURE_CHAIN.replace(' → S-fix → ', ' → S-fix 修复 → '),
    ORDINARY_FAILURE_CHAIN.replace(' → S-fix → ', ' → S-fix 携 R 报告执行修复 → '),
    ORDINARY_FAILURE_CHAIN.replace('G(check-preventive-review exit 0)', 'preventive 门禁'),
  ];
  if (variants.some((variant) => normalized.includes(normalizeGuidance(variant)))) return true;
  const stages = [
    'V/G 失败',
    'R',
    'V 复审 RootCauseReport',
    'G(check-rootcause-report exit 0)',
    'S-fix',
    'R3×3',
    'G(check-preventive-review exit 0)',
    'V',
    'G',
    'CHECKPOINT',
  ];
  let cursor = 0;
  for (const stage of stages) {
    const index = normalized.indexOf(stage, cursor);
    if (index < 0) return false;
    cursor = index + stage.length;
  }
  return true;
}

function matchesAny(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

// Failure-routing scan across the whole Markdown asset corpus. Each analysis
// unit keeps its scope: a table row is analysed whole (a signal in one cell and
// a bypass action in another cell of the same row must not escape), while plain
// lines are analysed as sentence units. A unit is a violation only when all of
// the following hold:
//   - it carries an ordinary-failure signal (review/gate/BDD/TLA+/test failure,
//     exit code 1, passed=false, or a C/D verdict routed to an action);
//   - it contains an executable direct-action clause (dispatch S(-fix), return
//     to a stage, rework by reworkHints, ...) whose own clause is not a
//     prohibition restatement;
//   - it does not already publish the canonical chain marker
//     (「完整普通失败链」 or the full arrow chain in the same unit);
//   - it is not the phase-1 ingestion A-chunk/A-cross→G exception;
//   - it does not route through R first (a legal 分派 R → ... → 才分派 S-fix
//     description is the essence of the authoritative chain, not a bypass).
// Exit-2 input-correction routes need no exemption: 修正输入/重跑 verbs are
// not direct actions, so an exit-2 clause never triggers a violation on its
// own, and it must not rescue an exit-1 bypass clause in the same unit.
const FAILURE_SIGNALS = [
  /(?:V\/G|评审|质量门|门禁|BDD|TLA\+|测试|用例|校验|签核)\s*(?:失败|不通过|未通过)/i,
  /(?:失败|不通过|未通过)\s*(?:评审|质量门|门禁|测试|用例|校验)/i,
  /passed\s*=\s*false/i,
  // A C/D verdict is not a failure signal by itself; it only marks failure
  // routing context when the verdict is followed by an executable route.
  /C\/D(?=[^。；|]{0,80}(?:由|分派|返工|修复|回到|回阶段|走|执行|直接|须|应))/i,
  /exitCode\s*(?:≠|!=|!==|非|不是)\s*0/i,
  /(?:退出码|exit\s*code|exitCode)\s*(?:=)?\s*1\b/i,
  /exit\s*1\b/i,
];
const DIRECT_ACTIONS = [
  /回退\s*(?:BDD|TLA\+)\s*子流程/i,
  /直接(?:回到|回|分派|返工|修复|推进)/i,
  /回到(?:编码|当前阶段|阶段|需求|上游|对应阶段|规格)/i,
  /回阶段\s*\d/i,
  /回编码/i,
  /按 `?reworkHints`?(?:修复|返工)/i,
  /(?:由|分派)\s+S(?:-fix)?(?![A-Za-z0-9_])/i,
];
const PROHIBITION = /(?:不得|禁止|不可|不能|不允许|不应|不授权|跳过|未经|命中反模式|must\s+not|not\s+allowed|cannot)/i;

function hasExecutableDirectAction(value: string): boolean {
  return value
    .split(/(?<=[。；|])/)
    .map((clause) => clause.trim())
    .some((clause) => clause.length > 0 && matchesAny(DIRECT_ACTIONS, clause) && !PROHIBITION.test(clause));
}

function hasChainMarker(value: string): boolean {
  const normalized = normalizeGuidance(value);
  if (normalized.includes('完整普通失败链')) return true;
  return hasCompleteOrdinaryFailureChain(value);
}

function hasRFirstRouting(value: string): boolean {
  const normalized = normalizeGuidance(value);
  // eslint-disable-next-line security/detect-unsafe-regex -- fixed-size workflow token match in test-owned guidance
  const dispatch = /(?:分派|由)\s*S(?:-fix)?(?![A-Za-z0-9_])/i.exec(normalized);
  if (!dispatch) return false;
  const head = normalized.slice(0, dispatch.index);
  return /(?:分派\s*R|R\s*子代理|R\s*定位|R\s*根因|RootCauseReport|R\s*报告)/i.test(head);
}

function isIngestionException(value: string): boolean {
  return /阶段\s*1.*ingestion.*A(?:-chunk)?\s*[→>-].*A-cross.*[→>-].*G/i.test(normalizeGuidance(value));
}

function failureRoutingReason(unit: string): string | undefined {
  const normalized = normalizeGuidance(unit);
  if (!matchesAny(FAILURE_SIGNALS, normalized)) return undefined;
  if (!hasExecutableDirectAction(normalized)) return undefined;
  if (hasChainMarker(unit)) return undefined;
  if (isIngestionException(unit)) return undefined;
  if (hasRFirstRouting(unit)) return undefined;
  return 'ordinary failure routes to a direct action without the complete chain';
}

function corpusFailureUnits(relativeDirectory: string): string[] {
  const units: string[] = [];
  for (const relativePath of markdownFiles(relativeDirectory)) {
    const lines = read(relativePath).split(/\r?\n/);
    let inFence = false;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      // eslint-disable-next-line security/detect-object-injection -- integer index over the local line array
      const rawLine = lines[lineIndex]!;
      const trimmed = rawLine.trim();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence || !trimmed || /^#{1,6}\s/.test(trimmed) || /^\|?\s*-{3,}/.test(trimmed)) continue;
      // A table row keeps its scope: cells are rejoined so that a failure
      // signal in one cell and the bypass action in another cell of the same
      // row are analysed together.
      const unit = trimmed.startsWith('|')
        ? trimmed
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())
            .filter(Boolean)
            .join('；')
        : trimmed;
      const reason = failureRoutingReason(unit);
      if (reason) units.push(`${relativePath}:${lineIndex + 1}: ${trimmed}`);
    }
  }
  return units;
}

describe('examples workflow contract', () => {
  it('does not confuse SSoT with S-fix or a prohibition with executable guidance', () => {
    expect(hasExecutableDirectAction('由 SSoT §10.8 定义，check-tla-model.ts 强制执行。')).toBe(false);
    expect(hasExecutableDirectAction('不得直接回到编码修正。')).toBe(false);
    expect(hasExecutableDirectAction('失败后由 S-fix 修复。')).toBe(true);
  });
  it('normalizes whitespace in the canonical ordinary failure chain', () => {
    expect(hasCompleteOrdinaryFailureChain(ORDINARY_FAILURE_CHAIN.replaceAll(' → ', '\n→\n'))).toBe(true);
  });
  it('captures a multiline /wm test command as one bounded command', () => {
    const commands = testCommands(
      '```text\n/wm test type=系统\n  result=pass\n```\n\n`/wm test type=集成 result=fail`',
    );

    expect(commands).toEqual(['/wm test type=系统 result=pass', '/wm test type=集成 result=fail']);
  });

  it('uses the complete ordinary V/G failure chain in independent stages 5-8', () => {
    for (const file of [
      'stage5-coding.md',
      'stage6-integration-test.md',
      'stage7-system-test.md',
      'stage8-acceptance-test.md',
    ]) {
      const content = read(`w-model-dev/examples/${file}`);
      expect(content, file).toContain(FAILURE_CHAIN);
      expect(content, file).toContain('🔴 CHECKPOINT');
    }
  });

  it('requires a real result for every copyable /wm test command', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];

    for (const relativePath of files) {
      for (const command of testCommands(read(relativePath))) {
        expect(hasValidResult(command), `${relativePath}: ${command}`).toBe(true);
      }
    }
  });

  it('requires user CHECKPOINT before every documented cross-stage transition', () => {
    for (const file of [
      'requirement-analysis.md',
      'system-design.md',
      'stage5-coding.md',
      'stage6-integration-test.md',
      'stage7-system-test.md',
      'stage8-acceptance-test.md',
    ]) {
      const content = read(`w-model-dev/examples/${file}`);
      expect(content, file).toContain('🔴 CHECKPOINT');
    }
  });

  it('shows the ordinary failure chain in legacy requirement and design interactions', () => {
    for (const file of ['requirement-analysis.md', 'system-design.md']) {
      expect(read(`w-model-dev/examples/${file}`), file).toContain(FAILURE_CHAIN);
    }
  });

  it('requires result handoff and treats phase 5-8 failure branches as R investigation inputs', () => {
    for (const [phase, type] of [
      [5, '单元'],
      [6, '集成'],
      [7, '系统'],
      [8, '验收'],
    ] as const) {
      const content = read(
        `w-model-dev/references/phase-${phase === 5 ? '5-coding' : phase === 6 ? '6-integration-test' : phase === 7 ? '7-system-test' : '8-acceptance-test'}.md`,
      );
      expect(content, `phase ${phase} command entry`).toContain(`/wm test type=${type} result=<pass|fail>`);
      expect(content, `phase ${phase} failure flow`).toContain(FAILURE_CHAIN);
      expect(content, `phase ${phase} failure branches`).toContain('R 定位线索');
    }
  });

  it('requires executable failure guidance to carry the complete chain across all Markdown assets', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/templates'),
      ...markdownFiles('w-model-dev/examples'),
    ];
    const failureSignals = [
      /V\/G\s*(?:失败|不通过)/i,
      /评审(?:失败|不通过)/i,
      /质量门(?:失败|不通过)/i,
      /(?:BDD|TLA\+)\s*(?:门禁)?失败/i,
      /(?:测试|用例)(?:失败|未通过)/i,
      /passed\s*=\s*false/i,
      /qualityLevel\s*[=:]?\s*[CD]/i,
      /exitCode\s*(?:=|:)?\s*[1-9]/i,
      /exitCode\s*(?:!=|≠|!==|非)\s*0/i,
      /退出码\s*[12]/i,
      /exit code\s*[12]/i,
    ];
    const executableRoutes = [
      // eslint-disable-next-line security/detect-unsafe-regex -- fixed-size workflow token alternation in test-owned guidance
      /(?:→|->)\s*(?:回退|回到|回阶段|回编码|返工|修正|修复|重跑|分派|交给|S-fix)/i,
      /(?:必须|须|应当|需要|只能|一律)\s*(?:回退|回到|回阶段|回编码|返工|修正|修复|重跑|分派\s*S|交给\s*S|执行)/i,
      // eslint-disable-next-line security/detect-unsafe-regex -- fixed-size workflow token alternation in test-owned guidance
      /(?:分派|交给)\s*S(?:-fix)?(?:\s*子代理)?/i,
      /S-(?:code|test|bdd)\s*(?:补全|补充|修正|修复)/i,
      /按\s*`?reworkHints`?\s*(?:返工|修复)/i,
    ];
    const prohibition =
      /(?:不得|禁止|不可|不能|不允许|不应|不授权|不要|避免|跳过|未经|命中反模式|must\s+not|not\s+allowed|cannot)/i;
    const isInputCorrection = (value: string): boolean =>
      /(?:退出码\s*2|exitCode\s*=\s*2|exit code\s*2)/i.test(value) &&
      /(?:输入|参数|文件|目录|JSON|manifest|project-dir|命令).*(?:修正|补齐|恢复|重跑|重新执行)|(?:修正|补齐|恢复).*(?:输入|参数|文件|目录|JSON|manifest|project-dir|命令)/i.test(
        value,
      );
    const violations: string[] = [];

    for (const relativePath of files) {
      // eslint-disable-next-line security/detect-object-injection -- paragraph index is an integer over the local array
      const paragraphs = read(relativePath).split(/\r?\n\s*\r?\n/);
      for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
        // eslint-disable-next-line security/detect-object-injection -- integer index from the local paragraph loop
        const paragraph = paragraphs[paragraphIndex]!;
        const context = normalizeGuidance(paragraph);
        const adjacentContext = normalizeGuidance(
          paragraphs.slice(Math.max(0, paragraphIndex - 1), Math.min(paragraphs.length, paragraphIndex + 2)).join(' '),
        );
        if (hasCompleteOrdinaryFailureChain(context) || hasCompleteOrdinaryFailureChain(adjacentContext)) continue;

        // eslint-disable-next-line security/detect-object-injection -- line index is an integer over the local paragraph array
        const lines = paragraph.split(/\r?\n/);
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          // eslint-disable-next-line security/detect-object-injection -- integer index from the local line loop
          const line = lines[lineIndex]!.trim();
          if (!line || /^#{1,6}\s/.test(line)) continue;
          // eslint-disable-next-line security/detect-object-injection -- bounded look-ahead over the local line array
          const candidate = normalizeGuidance([line, lines[lineIndex + 1] ?? '', lines[lineIndex + 2] ?? ''].join(' '));
          if (!matchesAny(failureSignals, line) || !matchesAny(executableRoutes, candidate)) continue;
          if (hasCompleteOrdinaryFailureChain(candidate)) continue;
          if (isInputCorrection(candidate)) continue;
          if (prohibition.test(candidate)) continue;
          violations.push(`${relativePath}: ${line}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('requires every ordinary failure guidance document to publish the complete rework chain', () => {
    const phaseReferences = [
      'w-model-dev/references/phase-1-requirements.md',
      'w-model-dev/references/phase-2-system-design.md',
      'w-model-dev/references/phase-3-outline-design.md',
      'w-model-dev/references/phase-4-detailed-design.md',
      'w-model-dev/references/phase-5-coding.md',
      'w-model-dev/references/phase-6-integration-test.md',
      'w-model-dev/references/phase-7-system-test.md',
      'w-model-dev/references/phase-8-acceptance-test.md',
    ];
    const required = [
      ...phaseReferences,
      'w-model-dev/templates/acceptance-test.md',
      'w-model-dev/templates/review-report.md',
      'w-model-dev/templates/test-report.md',
      'w-model-dev/templates/coding.md',
      'w-model-dev/templates/integration-test.md',
      'w-model-dev/examples/README.md',
      'w-model-dev/examples/requirement-analysis.md',
      'w-model-dev/examples/system-design.md',
      'w-model-dev/examples/coding.md',
      'w-model-dev/examples/test-execution.md',
      'w-model-dev/examples/stage1-requirement-analysis.md',
      'w-model-dev/examples/stage5-coding.md',
      'w-model-dev/examples/stage6-integration-test.md',
      'w-model-dev/examples/stage7-system-test.md',
      'w-model-dev/examples/stage8-acceptance-test.md',
    ];

    for (const relativePath of required) {
      expect(containsFailureChain(read(relativePath)), relativePath).toBe(true);
    }
  });

  it('does not treat result=pass as a prefix of an invalid result value', () => {
    expect(hasValidResult('/wm test type=系统 result=<pass|fail>')).toBe(true);
    expect(hasValidResult('/wm test type=系统 result=pass')).toBe(true);
    expect(hasValidResult('/wm test type=系统 result=fail')).toBe(true);
    expect(hasValidResult('/wm test type=系统 result=pass|fail')).toBe(false);
    expect(hasValidResult('/wm test type=系统 result=passed')).toBe(false);
    expect(hasValidResult('/wm test type=系统 result=pass,')).toBe(false);
    expect(hasValidResult('/wm test type=系统 result=fail.')).toBe(false);
    expect(hasValidResult('/wm test type=系统 result=pass-extra')).toBe(false);
  });

  it('uses a legal placeholder instead of an invalid result union in stage 7', () => {
    const content = read('w-model-dev/examples/stage7-system-test.md');

    expect(content).toContain('/wm test type=系统 result=<pass|fail>');
    expect(content).not.toContain('/wm test type=系统 result=pass|fail');
  });

  it('requires every copyable test command to use a bounded real result or explicit placeholder', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];

    for (const relativePath of files) {
      for (const command of testCommands(read(relativePath))) {
        expect(hasValidResult(command), `${relativePath}: ${command}`).toBe(true);
      }
    }
  });

  it('rejects abbreviated ordinary failure chains in every required guidance document', () => {
    const files = [
      'w-model-dev/references/phase-1-requirements.md',
      'w-model-dev/references/phase-2-system-design.md',
      'w-model-dev/references/phase-3-outline-design.md',
      'w-model-dev/references/phase-4-detailed-design.md',
      'w-model-dev/references/phase-5-coding.md',
      'w-model-dev/references/phase-6-integration-test.md',
      'w-model-dev/references/phase-7-system-test.md',
      'w-model-dev/references/phase-8-acceptance-test.md',
      ...markdownFiles('w-model-dev/templates'),
      ...markdownFiles('w-model-dev/examples'),
    ];
    const abbreviatedChain =
      /V\/G 失败 → R → V 复审 RootCauseReport → G\(check-rootcause-report exit 0\) → S-fix(?!\s*→\s*R3×3\s*→\s*G\(check-preventive-review exit 0\)\s*→\s*V\s*→\s*G\s*→\s*CHECKPOINT)/g;

    for (const relativePath of files) {
      const abbreviated = [...read(relativePath).matchAll(abbreviatedChain)].map((match) => match[0]);
      expect(abbreviated, relativePath).toEqual([]);
    }
  });

  it('does not allow phase 5 ticket exceptions to bypass the ordinary failure chain', () => {
    const content = read('w-model-dev/references/phase-5-coding.md');

    expect(content).not.toContain('直接走 R→S-fix');
    expect(content).toContain(FAILURE_CHAIN);
    expect(content).toContain('候选影响阶段由 R 给出');
  });

  it('rejects direct R-to-S-fix bypass instructions across all guidance documents', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];
    const directBypass = (line: string): boolean => {
      const normalized = line.toLowerCase().replace(/\s+/g, ' ');
      return (
        (normalized.includes('直接') || normalized.includes('direct')) &&
        normalized.includes('r') &&
        (normalized.includes('r→s-fix') || normalized.includes('r->s-fix'))
      );
    };
    const prohibition = /(?:不得|禁止|不可|不能|不允许|不应|不授权|跳过|must\s+not|not\s+allowed|cannot)/i;

    for (const relativePath of files) {
      for (const line of read(relativePath).split(/\r?\n/)) {
        if (directBypass(line)) {
          expect(line, `${relativePath}: ${line}`).toMatch(prohibition);
        }
      }
    }
  });

  it('rejects ordinary failure routes that return or rework without the complete chain', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];
    const failure =
      /V\/G\s*(?:失败|不通过)|评审不通过|评审失败|质量门失败|质量门不通过|测试失败|测试未通过|用例失败|校验失败|passed=false|退出码 1|exit code 1/i;
    const bypass =
      /直接(?:回到|回|分派|返工|修复|按|放行|推进)|回到|回步骤|回 phase|回阶段|回编码|回需求|按 `?reworkHints`?(?:修复|返工)|重跑|重新执行|补回填|(?:R\s*(?:→|->)\s*S-fix)/i;
    const prohibition = /(?:不得|禁止|不可|不能|不允许|不应|不授权|跳过|must\s+not|not\s+allowed|cannot)/i;

    for (const relativePath of files) {
      for (const rawLine of read(relativePath).split(/\r?\n/)) {
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line || !failure.test(line) || !bypass.test(line)) continue;
        if (line.includes(FAILURE_CHAIN) || line.includes('下方完整链') || line.includes('完整普通失败链')) continue;
        if (line.includes('phase 1') && line.includes('ingestion') && line.includes('A-chunk')) continue;

        const withoutProhibition = line.replace(
          /(?:不得|禁止|不可|不能|不允许|不应|不授权|跳过|must\s+not|not\s+allowed|cannot)/gi,
          '',
        );
        const positiveBypass =
          /(?:必须|应当|需要|可以按|只能按|先执行|随后执行|再执行|由[^，。；]*执行|由[^，。；]*分派)\s*(?:直接|回到|回步骤|回 phase|回编码|回需求|返工|重跑|重新执行|补回填|按 `?reworkHints`?)/i.test(
            withoutProhibition,
          );
        expect(prohibition.test(line) && !positiveBypass, `${relativePath}: ${line}`).toBe(true);
      }
    }
  });

  it('does not retain abbreviated ordinary rework chains in live references', () => {
    const references = [
      'w-model-dev/references/bdd.md',
      'w-model-dev/references/data-models.md',
      'w-model-dev/references/evidence-anchored-tree.md',
      'w-model-dev/references/hard-constraints.md',
      'w-model-dev/references/iceberg-sweep-guide.md',
      'w-model-dev/references/operational-recovery.md',
      'w-model-dev/references/root-cause-locator.md',
      'w-model-dev/references/subagent-delegation.md',
      'w-model-dev/references/verifier-spec.md',
      'w-model-dev/references/workflow.md',
    ];
    const abbreviated = /(?:V\/G→R→V→G→S-fix|V→G→R→V→G→S-fix|R→V→G→S-fix)/;

    for (const relativePath of references) {
      expect(read(relativePath), relativePath).not.toMatch(abbreviated);
    }
  });

  it('keeps a table-row failure signal and bypass action in one analysis scope', () => {
    // hard-constraints.md「门禁脚本退出码精确对应表」row 1 cells: the signal
    // 「评审未通过」 lives in the third cell while the bypass 「回到当前阶段
    // 起点返工」 lives in the last cell; splitting cells would miss it.
    expect(failureRoutingReason('`check-verifier-output.ts`；1；评审未通过（schema / 方差 / 分数不达标）；#1 / #4；回到当前阶段起点返工')).toBe(
      'ordinary failure routes to a direct action without the complete chain',
    );
    expect(failureRoutingReason('`check-artifact-gate.ts`；1；质量门未通过（覆盖率 / 测试状态不达标）；#3 / #6 / #7；回阶段 5 编码返工')).toBe(
      'ordinary failure routes to a direct action without the complete chain',
    );
    // The same row once the canonical chain marker is present is satisfied.
    expect(failureRoutingReason('`check-artifact-gate.ts`；1；质量门未通过（覆盖率 / 测试状态不达标）；#3 / #6 / #7；先走完整普通失败链，再按 R 结论由 S-fix 返工')).toBe(
      undefined,
    );
  });

  it('treats a C/D verdict routed to an action as failure context, not C/D alone', () => {
    // C/D alone (schema enum, quality-level definition) is not a failure
    // signal ...
    expect(failureRoutingReason('qualityLevel: A | B | C | D；仅 check-verifier-output.ts')).toBe(undefined);
    expect(failureRoutingReason('C/D 仅作为 R 定位线索，完成完整普通失败链后由 S-fix 处理')).toBe(undefined);
    // ... but a C/D routing clause that skips R and dispatches S by reworkHints
    // is an ordinary-failure bypass (command-reference.md /wm review 失败动作).
    expect(
      failureRoutingReason('失败动作：编排者不得自评（反模式 #10）——评审必须分派 V 子代理执行；C/D 由 O 分派 S 子代理按 reworkHints 返工。'),
    ).toBe('ordinary failure routes to a direct action without the complete chain');
  });

  it('accepts a legal R-first description without repeating the literal chain', () => {
    expect(
      failureRoutingReason('V/G 不通过后，必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。'),
    ).toBe(undefined);
    expect(
      failureRoutingReason('该失败只形成 R 定位线索；按完整普通失败链完成 R 报告、V 复审、G 根因门禁、S-fix、R3×3、预防审查、V/G 与 CHECKPOINT 后，才由 S-fix 补全 step definition'),
    ).toBe(undefined);
    expect(failureRoutingReason('exit 1 时由 S 修复/补齐项目工件后走 V→G；exit 2 时修正 CLI 参数组合后重跑')).toBe(
      'ordinary failure routes to a direct action without the complete chain',
    );
  });

  it('reports ordinary failure bypass routes across the whole Markdown corpus', () => {
    expect(
      corpusFailureUnits('w-model-dev/references').concat(corpusFailureUnits('w-model-dev/templates')).concat(corpusFailureUnits('w-model-dev/examples')),
    ).toEqual([]);
  });
});

describe('BDD project-gate command contract', () => {
  const tlaFlags = '--require-tla-equivalence --tla-manifest=.w-model/tla-manifest.json';
  const graphFlag = '--graph=.w-model/ingestion/graph.json';

  it('makes examples README phase 1-8 commands complete', () => {
    const content = read('w-model-dev/examples/README.md');
    expect(content).toContain(`--phase=1 ${tlaFlags}`);
    for (const phase of [2, 3, 4]) {
      expect(content).toContain(`--phase=${phase} ${tlaFlags} ${graphFlag}`);
    }
    for (const phase of [6, 7, 8]) {
      expect(content).toContain(`--phase=${phase} ${graphFlag} --require-cucumber-report`);
    }
  });

  it('uses complete phase 5-8 BDD commands and current BDD_JSON summaries', () => {
    for (const [file, phase, report] of [
      ['stage5-coding.md', 5, 'unit.json'],
      ['stage6-integration-test.md', 6, 'integration.json'],
      ['stage7-system-test.md', 7, 'system.json'],
      ['stage8-acceptance-test.md', 8, 'acceptance.json'],
    ] as const) {
      const content = read(`w-model-dev/examples/${file}`);
      expect(content, file).toContain(
        `--phase=${phase} ${graphFlag} --require-cucumber-report --cucumber-report=reports/cucumber/${report}`,
      );
      if (phase === 6 || phase === 7) {
        expect(content, file).toMatch(/BDD_JSON \{"type":"bdd","passed":true,"exitCode":0,"summary":"[^"]+"\}/);
      }
    }
  });

  it('uses complete project-gate flags in phase references and templates', () => {
    const targets = [
      ['w-model-dev/references/phase-1-requirements.md', `--phase=1 ${tlaFlags}`],
      ['w-model-dev/references/phase-2-system-design.md', `--phase=2 ${tlaFlags} ${graphFlag}`],
      ['w-model-dev/references/phase-3-outline-design.md', `--phase=3 ${tlaFlags} ${graphFlag}`],
      ['w-model-dev/references/phase-4-detailed-design.md', `--phase=4 ${tlaFlags} ${graphFlag}`],
      ['w-model-dev/references/phase-5-coding.md', `--phase=5 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/references/phase-6-integration-test.md', `--phase=6 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/references/phase-7-system-test.md', `--phase=7 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/references/phase-8-acceptance-test.md', `--phase=8 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/templates/coding.md', `--phase=5 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/templates/integration-test.md', `--phase=6 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/templates/system-test.md', `--phase=7 ${graphFlag} --require-cucumber-report`],
      ['w-model-dev/templates/acceptance-test.md', `--phase=8 ${graphFlag} --require-cucumber-report`],
    ] as const;

    for (const [relativePath, expected] of targets) {
      expect(read(relativePath), relativePath).toContain(expected);
    }
  });

  it('uses canonical --phase=8 OpenSpec archive syntax', () => {
    expect(read('w-model-dev/examples/stage8-acceptance-test.md')).toContain('check-openspec-archive.ts . --phase=8');
  });

  it('does not describe valid phase 6 or 7 as an invalid argument', () => {
    for (const file of ['stage6-integration-test.md', 'stage7-system-test.md']) {
      expect(read(`w-model-dev/examples/${file}`), file).not.toContain('参数非法 --phase=');
    }
  });

  it('documents the authoritative BDD call patterns in bdd.md', () => {
    const content = read('w-model-dev/references/bdd.md');
    expect(content).toContain('--require-tla-equivalence');
    expect(content).toContain('--require-cucumber-report');
    expect(content).toContain('--graph=<graph.json>');
    expect(read('w-model-dev/templates/requirement-spec/discipline-dod.md')).toContain('--require-tla-equivalence');
  });
});
