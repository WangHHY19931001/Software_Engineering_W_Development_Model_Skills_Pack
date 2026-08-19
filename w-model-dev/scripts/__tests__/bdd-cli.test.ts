/* eslint-disable security/detect-non-literal-fs-filename -- B5 fixtures are created beneath a test-owned temporary directory. */
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(TEST_DIR, '../cli/check-bdd-model.ts');
const ROOT = path.resolve(TEST_DIR, '../../..');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bdd-cli-'));
  await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function run(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args, '--json'], { cwd: tmpDir });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

async function writeJson(relativePath: string, value: unknown): Promise<string> {
  const target = path.join(tmpDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(value), 'utf-8');
  return target;
}

function baseManifest(phase: number): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    projectId: 'bdd-cli-test',
    basePath: '.',
    currentPhase: phase,
    features: [],
    stateMachines: [],
    ...(phase >= 2
      ? { designCoverage: { totalSdNodes: 0, coveredSdNodes: [], uncoveredSdNodes: [], coverageRate: 1 } }
      : {}),
  };
}

describe('check-bdd-model evidence requirement flags', () => {
  it('fails D4 with exit 1 when phase 1 explicitly requires absent TLA evidence', async () => {
    const manifest = await writeJson('.w-model/bdd-manifest.json', baseManifest(1));

    const result = run([manifest, '--phase=1', '--require-tla-equivalence']);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitCode: 1,
      reasons: ['[D4] required TLA+ equivalence evidence is missing'],
    });
  });

  it('accepts phase 1 required TLA evidence and preserves the normal D4 equivalence path', async () => {
    const manifest = await writeJson('.w-model/bdd-manifest.json', {
      ...baseManifest(1),
      stateMachines: [
        {
          id: 'SM-L2-test',
          level: 2,
          states: ['A', 'B'],
          initialState: 'A',
          terminalStates: ['B'],
          acceptingStates: ['B'],
          rejectingStates: [],
          transitions: [{ from: 'A', event: 'advance', to: 'B' }],
          invariants: ['B => done'],
        },
      ],
    });
    await fs.writeFile(
      path.join(tmpDir, '.w-model/spec.tla'),
      `---- MODULE Test ----
VARIABLES state

TypeOK == state \\in {"A", "B"}

Init == state = "A"

Advance ==
  /\\ state = "A"
  /\\ state' = "B"

Next ==
  \\/ Advance

Spec == Init /\\ [][Next]_state

Invariant == state = "B" => done
====
`,
      'utf-8',
    );
    const tlaManifest = await writeJson('.w-model/tla-manifest.json', {
      basePath: '.',
      specs: [{ id: 'L2-test', tlaPath: 'spec.tla' }],
    });

    const result = run([manifest, '--phase=1', `--tla-manifest=${tlaManifest}`, '--require-tla-equivalence']);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ exitCode: 0, passed: true });
  });

  it('fails D5 with exit 1 when phase 5 explicitly requires an absent cucumber report', async () => {
    const manifest = await writeJson('.w-model/bdd-manifest.json', baseManifest(5));
    const graph = await writeJson('.w-model/graph.json', { nodes: [] });

    const result = run([manifest, '--phase=5', `--graph=${graph}`, '--require-cucumber-report']);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      exitCode: 1,
      reasons: ['[D5] required cucumber report evidence is missing'],
    });
  });

  it('accepts phase 5 required cucumber evidence and runs normal binding checks', async () => {
    const manifest = await writeJson('.w-model/bdd-manifest.json', baseManifest(5));
    const graph = await writeJson('.w-model/graph.json', { nodes: [] });
    const report = await writeJson('.w-model/cucumber-report.json', {
      elements: [{ steps: [{ result: { status: 'passed' } }] }],
    });

    const result = run([
      manifest,
      '--phase=5',
      `--graph=${graph}`,
      `--cucumber-report=${report}`,
      '--require-cucumber-report',
    ]);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ exitCode: 0, passed: true });
  });

  it.each([
    ['phase 5 TLA requirement', 5, '--require-tla-equivalence'],
    ['phase 1 cucumber requirement', 1, '--require-cucumber-report'],
  ])('rejects %s as an exit 2 argument combination', async (_caseName, phase, flag) => {
    const manifest = await writeJson('.w-model/bdd-manifest.json', baseManifest(phase));
    const graph = phase >= 2 ? await writeJson('.w-model/graph.json', { nodes: [] }) : undefined;

    const result = run([manifest, `--phase=${phase}`, ...(graph ? [`--graph=${graph}`] : []), flag]);

    expect(result.code).toBe(2);
    expect(result.stdout).toMatch(/^ERROR_JSON /);
    expect(result.stdout).toContain(flag);
  });

  it('keeps omitted evidence optional and reports skipped D4/D5 checks', async () => {
    const phaseOneManifest = await writeJson('.w-model/phase-one.json', baseManifest(1));
    const phaseOne = run([phaseOneManifest, '--phase=1']);
    const phaseFiveManifest = await writeJson('.w-model/phase-five.json', baseManifest(5));
    const graph = await writeJson('.w-model/graph.json', { nodes: [] });
    const phaseFive = run([phaseFiveManifest, '--phase=5', `--graph=${graph}`]);

    expect(phaseOne.code).toBe(0);
    expect(phaseOne.stderr).toContain('跳过 D4 TLA+ 等价校验');
    expect(phaseFive.code).toBe(0);
    expect(phaseFive.stderr).toContain('跳过 D5 step 绑定校验');
  });

  it('documents the pre-push fixture regression boundary separately from project evidence gates', async () => {
    const [skill, bddGuide, tlaGuide, commandReference, prePush] = await Promise.all([
      fs.readFile(path.join(ROOT, 'w-model-dev/SKILL.md'), 'utf-8'),
      fs.readFile(path.join(ROOT, 'w-model-dev/references/bdd-guide.md'), 'utf-8'),
      fs.readFile(path.join(ROOT, 'w-model-dev/references/tla-plus-guide.md'), 'utf-8'),
      fs.readFile(path.join(ROOT, 'w-model-dev/references/command-reference.md'), 'utf-8'),
      fs.readFile(path.join(ROOT, '.githooks/pre-push'), 'utf-8'),
    ]);

    expect(skill).toContain('--require-tla-equivalence --tla-manifest=<path>');
    expect(skill).toContain('--require-cucumber-report --cucumber-report=<path>');
    expect(bddGuide).toContain('缺少 `--tla-manifest` 产生 D4 violation / exitCode=1');
    expect(bddGuide).toContain('缺少 `--cucumber-report` 产生 D5 violation / exitCode=1');
    expect(tlaGuide).toContain('本地 pre-push 的技能包 fixture 回归');
    expect(commandReference).toContain('它不直接运行 TLA、TLA↔BDD 同步或任何项目工件阶段门');
    expect(prePush).toContain('不直接运行 TLA、TLA↔BDD 同步或项目工件阶段门');
  });
});
