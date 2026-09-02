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

function isResultBoundary(value: string): boolean {
  return value.length === 0 || /[\s`.,;，。；]/.test(value[0]!);
}

function hasValidResult(command: string): boolean {
  const marker = command.indexOf('result=');
  if (marker < 0) return false;
  const value = command.slice(marker + 'result='.length);
  if (value.startsWith('<pass|fail>')) return isResultBoundary(value.slice('<pass|fail>'.length));
  if (value.startsWith('pass')) return isResultBoundary(value.slice('pass'.length));
  if (value.startsWith('fail')) return isResultBoundary(value.slice('fail'.length));
  return false;
}

function testCommands(content: string): string[] {
  const commands: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    let start = line.indexOf('/wm test');
    while (start >= 0) {
      const end = line.indexOf('`', start);
      const command = line.slice(start, end >= 0 ? end : line.length);
      if (command.includes('type=')) commands.push(command);
      start = line.indexOf('/wm test', start + '/wm test'.length);
    }
  }
  return commands;
}

function markdownFiles(relativeDirectory: string): string[] {
  const directory = path.join(REPO_ROOT, relativeDirectory);
  const files: string[] = [];
  const visit = (absoluteDirectory: string): void => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory stays within the fixed repository contract-test inventory
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.relative(REPO_ROOT, absolutePath));
    }
  };
  visit(directory);
  return files.sort();
}

describe('examples workflow contract', () => {
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
      'coding.md',
      'stage5-coding.md',
      'stage6-integration-test.md',
      'stage7-system-test.md',
      'stage8-acceptance-test.md',
      'test-execution.md',
    ];
    for (const file of files) {
      const content = read(`w-model-dev/examples/${file}`);
      const commands = content.match(/^.*\/wm test type=.*$/gm) ?? [];
      for (const command of commands) {
        expect(command, `${file}: ${command}`).toMatch(/result=(?:<pass\|fail>|pass|fail)/);
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

  it('requires every copyable test command to use a bounded real result or explicit placeholder', () => {
    const files = [
      'w-model-dev/references/phase-1-requirements.md',
      'w-model-dev/references/phase-2-system-design.md',
      'w-model-dev/references/phase-3-outline-design.md',
      'w-model-dev/references/phase-4-detailed-design.md',
      'w-model-dev/references/phase-5-coding.md',
      'w-model-dev/references/phase-6-integration-test.md',
      'w-model-dev/references/phase-7-system-test.md',
      'w-model-dev/references/phase-8-acceptance-test.md',
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
      ...Array.from({ length: 8 }, (_, index) =>
        `w-model-dev/references/phase-${index + 1}-${
          ['requirements', 'system-design', 'outline-design', 'detailed-design', 'coding', 'integration-test', 'system-test', 'acceptance-test'][index]
        }.md`,
      ),
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

  it('rejects direct ordinary-failure bypass instructions while allowing explicit prohibitions', () => {
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
    const files = [
      ...phaseReferences,
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];
    const hasDirectBypass = (line: string): boolean => {
      const hasDirect = line.includes('直接') || line.toLowerCase().includes('direct');
      const hasReturn =
        line.includes('回到') || line.includes('回步骤') || line.includes('回 phase') || line.includes('回编码');
      const hasUngatedHintRouting = line.includes('reworkHints') && (line.includes('分流') || line.includes('返工'));
      const hasFailure =
        line.includes('失败') || line.includes('不通过') || line.includes('质量门') || line.includes('返工');
      return hasFailure && (hasDirect || hasReturn || hasUngatedHintRouting);
    };
    const hasProhibition = (line: string): boolean =>
      ['不得', '禁止', '不可', '不能', '不允许', '不应', '不授权', '跳过', 'must not', 'not allowed', 'cannot'].some(
        (token) => line.toLowerCase().includes(token.toLowerCase()),
      );
    const hasChainGuard = (line: string): boolean =>
      line.includes(FAILURE_CHAIN) ||
      [
        '完整普通失败链',
        '完整失败链',
        '按普通失败链',
        '先走完整',
        '按 R 结论',
        '按 R 的 upstreamDefect',
        '完整 RootCauseReport 复审、根因门禁、S-fix 后 R3/preventive/V/G/CHECKPOINT 链',
        '链条完成',
      ].some((token) => line.includes(token));

    for (const relativePath of files) {
      for (const line of read(relativePath).split(/\r?\n/)) {
        if (hasDirectBypass(line)) {
          expect(hasProhibition(line) || hasChainGuard(line), `${relativePath}: ${line}`).toBe(true);
        }
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
