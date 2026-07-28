import { checkRequirementCoverage } from './coverage-logic.js';
import { checkExemption } from './exemption-logic.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join('w-model-dev', 'scripts', 'samples');

// Coverage
const covRaw = readFileSync(join(dir, 'coverage', 'valid-out-of-scope-declared.json'), 'utf-8');
const covR = checkRequirementCoverage(JSON.parse(covRaw), {});
console.log('=== coverage/valid-out-of-scope-declared ===');
console.log('passed=' + covR.passed);
for (const v of covR.violations) console.log('  violation:', v);
for (const w of covR.warnings) console.log('  warning:', w);

// Exemption samples
const exemptSamples = ['bad-s-self-approve', 'bad-r-template-review'];
for (const s of exemptSamples) {
  const raw = readFileSync(join(dir, 'exemption', s + '.json'), 'utf-8');
  const r = checkExemption(JSON.parse(raw));
  console.log(`\n=== exemption/${s} ===`);
  console.log('passed=' + r.passed + ' stage=' + r.stage);
  for (const v of r.violations) console.log('  violation:', v);
}
