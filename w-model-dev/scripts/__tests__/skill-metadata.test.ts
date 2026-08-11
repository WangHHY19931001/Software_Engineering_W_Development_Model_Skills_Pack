import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('frontmatter not found');
  const out: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (kv) out[kv[1]!] = kv[2]!.trim();
  }
  return out;
}

describe('skill-metadata 双写一致性', () => {
  it('SKILL.md frontmatter version 与 skill-metadata.json version 一致', () => {
    const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf-8');
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(parseFrontmatter(skill).version).toBe(meta.version);
  });

  it('skill-metadata.json name 与 SKILL.md frontmatter name 一致', () => {
    const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf-8');
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(parseFrontmatter(skill).name).toBe(meta.name);
  });

  it('skill-metadata.json schemaVersion 存在且为 1.0', () => {
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    expect(meta.schemaVersion).toBe('1.0');
  });

  it('package.json version 与 skill-metadata.json / SKILL.md frontmatter version 三处一致', () => {
    const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf-8');
    const meta = JSON.parse(readFileSync(join(ROOT, 'skill-metadata.json'), 'utf-8'));
    const pkg = JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf-8'));
    expect(pkg.version).toBe(meta.version);
    expect(pkg.version).toBe(parseFrontmatter(skill).version);
  });
});
