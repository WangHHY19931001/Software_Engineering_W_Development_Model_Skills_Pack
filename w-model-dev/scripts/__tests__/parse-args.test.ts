import { describe, expect, it } from 'vitest';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';

describe('parse-args（lib/parse-args.ts）', () => {
  const args = ['--phase=4', '--graph=.w-model/ingestion/graph.json', '--json', 'positional.json'];
  it('parseFlagValue 取值', () => {
    expect(parseFlagValue(args, 'phase')).toBe('4');
    expect(parseFlagValue(args, 'graph')).toBe('.w-model/ingestion/graph.json');
    expect(parseFlagValue(args, 'missing')).toBeUndefined();
  });
  it('hasFlag 检测', () => {
    expect(hasFlag(args, 'json')).toBe(true);
    expect(hasFlag(args, 'self-as-verifier')).toBe(false);
  });
});