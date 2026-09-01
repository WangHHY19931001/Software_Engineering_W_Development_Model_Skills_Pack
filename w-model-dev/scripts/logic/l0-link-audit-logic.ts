import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const L0_DIRECTORIES = ['references', 'templates', 'examples', 'subagent', 'schemas'] as const;
const L1_DIRECTORIES = ['scripts', 'samples', 'tools'] as const;

export interface L0LinkAuditEntry {
  source: string;
  target: string;
}

export interface L0LinkAuditResult {
  relativeLinkCount: number;
  l1Only: L0LinkAuditEntry[];
  templatePlaceholders: L0LinkAuditEntry[];
  violations: string[];
}

async function collectFiles(root: string, directory: string): Promise<string[]> {
  const absolute = path.join(root, directory);
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, relative)));
    } else {
      files.push(relative);
    }
  }

  return files;
}

function normalizeRelative(value: string): string {
  return value.replaceAll(path.sep, '/');
}

function isExternalOrAnchor(target: string): boolean {
  return target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/');
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function l1Boundary(target: string, root: string): string | undefined {
  const relative = normalizeRelative(path.relative(root, target));
  return L1_DIRECTORIES.find((directory) => relative === directory || relative.startsWith(`${directory}/`));
}

function l0Boundary(target: string, root: string): string | undefined {
  const relative = normalizeRelative(path.relative(root, target));
  return L0_DIRECTORIES.find((directory) => relative === directory || relative.startsWith(`${directory}/`));
}

function parseRelativeLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1]!
      .trim()
      .replace(/^<|>$/g, '')
      .split(/\s+["']/)[0]!;
    if (!raw || isExternalOrAnchor(raw)) continue;
    links.push(raw);
  }
  return links;
}

/**
 * 审计 L0 skill 包的相对 Markdown 链接。
 *
 * L0 仅包括 SKILL.md 与 references/templates/examples/subagent/schemas。只有实际存在的
 * scripts/samples/tools 目标可以分类为 L1-only；只有 templates/ 源文件中的 {{module}}
 * 链接可以分类为模板占位。其余相对目标必须在 L0 内存在，否则作为 violation 返回。
 */
export async function auditL0RelativeLinks(root: string): Promise<L0LinkAuditResult> {
  const l0Files = ['SKILL.md'];
  for (const directory of L0_DIRECTORIES) {
    l0Files.push(...(await collectFiles(root, directory)));
  }

  const result: L0LinkAuditResult = {
    relativeLinkCount: 0,
    l1Only: [],
    templatePlaceholders: [],
    violations: [],
  };

  for (const source of l0Files.filter((file) => file.endsWith('.md'))) {
    const sourcePath = path.join(root, source);
    const content = await fs.readFile(sourcePath, 'utf8');

    for (const rawTarget of parseRelativeLinks(content)) {
      result.relativeLinkCount++;
      const sourceEntry = { source: normalizeRelative(source), target: rawTarget };

      if (rawTarget.includes('{{module}}')) {
        if (normalizeRelative(source).startsWith('templates/')) {
          result.templatePlaceholders.push(sourceEntry);
        } else {
          result.violations.push(`${sourceEntry.source}: 非模板文件不得使用 {{module}} 占位链接 → ${rawTarget}`);
        }
        continue;
      }

      const targetWithoutFragment = decodeURI(rawTarget.split('#')[0]!);
      const targetPath = path.resolve(path.dirname(sourcePath), targetWithoutFragment);
      const l1Directory = l1Boundary(targetPath, root);
      if (l1Directory) {
        try {
          await fs.access(targetPath);
          result.l1Only.push(sourceEntry);
        } catch {
          result.violations.push(`${sourceEntry.source}: L1-only 目标不存在 → ${rawTarget}`);
        }
        continue;
      }

      const isSkillRoot = targetPath === path.join(root, 'SKILL.md');
      if (!isInside(root, targetPath) || (!isSkillRoot && !l0Boundary(targetPath, root))) {
        result.violations.push(`${sourceEntry.source}: 不允许的分发边界 → ${rawTarget}`);
        continue;
      }

      try {
        await fs.access(targetPath);
      } catch {
        result.violations.push(`${sourceEntry.source}: 相对链接目标不存在 → ${rawTarget}`);
      }
    }
  }

  return result;
}
