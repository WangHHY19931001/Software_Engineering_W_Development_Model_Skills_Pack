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

  it('does not allow phase 5 ticket exceptions to bypass the ordinary failure chain', () => {
    const content = read('w-model-dev/references/phase-5-coding.md');

    expect(content).not.toContain('直接走 R→S-fix');
    expect(content).toContain(FAILURE_CHAIN);
    expect(content).toContain('候选影响阶段由 R 给出');
  });

  it('scans every phase reference and legacy example for direct R-to-S-fix bypass language', () => {
    const files = [
      ...markdownFiles('w-model-dev/references'),
      ...markdownFiles('w-model-dev/examples'),
      ...markdownFiles('w-model-dev/templates'),
    ];
    const directBypass = /(?:直接|direct(?:ly)?)(?:\s*走)?\s*R\s*(?:→|->)\s*S-fix/i;
    const prohibition = /(?:不得|禁止|不可|must\s+not|not\s+allowed|cannot)/i;

    for (const relativePath of files) {
      const lines = read(relativePath).split(/\r?\n/);
      for (const line of lines) {
        if (directBypass.test(line)) expect(line, `${relativePath}: ${line}`).toMatch(prohibition);
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
