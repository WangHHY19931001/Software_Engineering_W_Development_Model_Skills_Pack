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

async function collectFiles(
  root: string,
  directory: string,
  rootRealPath: string,
  violations: string[],
): Promise<string[]> {
  const absolute = path.join(root, directory);
  let realDirectory: string;
  let entries: import('node:fs').Dirent[];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolute remains beneath the resolved skill root during recursive audit
    realDirectory = await fs.realpath(absolute);
    if (!isInside(rootRealPath, realDirectory)) {
      violations.push(`L0 目录越出 skill 根 ${normalizeRelative(directory)}`);
      return [];
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realDirectory was resolved beneath the verified skill root
    entries = await fs.readdir(realDirectory, { withFileTypes: true });
  } catch {
    violations.push(`必需 L0 目录不存在或不可读 ${normalizeRelative(directory)}`);
    return [];
  }
  const files: string[] = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, relative, rootRealPath, violations)));
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
  const absoluteRoot = path.resolve(root);
  const result: L0LinkAuditResult = {
    relativeLinkCount: 0,
    l1Only: [],
    templatePlaceholders: [],
    violations: [],
  };
  let rootRealPath: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absoluteRoot is the caller-supplied skill package root
    rootRealPath = await fs.realpath(absoluteRoot);
  } catch {
    result.violations.push('skill 根目录不存在或不可读');
    return result;
  }

  const skillPath = path.join(absoluteRoot, 'SKILL.md');
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- skillPath is the required root file beneath the resolved skill root
    const skillRealPath = await fs.realpath(skillPath);
    if (!isInside(rootRealPath, skillRealPath)) result.violations.push('必需 L0 文件越出 skill 根 SKILL.md');
  } catch {
    result.violations.push('必需 L0 文件不存在或不可读 SKILL.md');
  }

  const l0Files = ['SKILL.md'];
  for (const directory of L0_DIRECTORIES) {
    l0Files.push(...(await collectFiles(absoluteRoot, directory, rootRealPath, result.violations)));
  }

  for (const source of l0Files.filter((file) => file.endsWith('.md'))) {
    const sourcePath = path.join(absoluteRoot, source);
    let content: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- source is the verified SKILL.md or is enumerated beneath a verified L0 directory
      const realSource = await fs.realpath(sourcePath);
      if (!isInside(rootRealPath, realSource)) {
        result.violations.push(`L0 源文件越出 skill 根 ${normalizeRelative(source)}`);
        continue;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- source real path was verified beneath the skill root
      content = await fs.readFile(sourcePath, 'utf8');
    } catch {
      result.violations.push(`${normalizeRelative(source)}: L0 源文件不可读`);
      continue;
    }

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
      const l1Directory = l1Boundary(targetPath, absoluteRoot);
      if (l1Directory) {
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetPath is resolved from an L0 markdown link beneath the verified skill root
          const realTarget = await fs.realpath(targetPath);
          if (!isInside(rootRealPath, realTarget)) {
            result.violations.push(`${sourceEntry.source}: L1-only 目标越出 skill 根 → ${rawTarget}`);
          } else {
            result.l1Only.push(sourceEntry);
          }
        } catch {
          result.violations.push(`${sourceEntry.source}: L1-only 目标不存在 → ${rawTarget}`);
        }
        continue;
      }

      const isSkillRoot = targetPath === path.join(absoluteRoot, 'SKILL.md');
      if (!isInside(absoluteRoot, targetPath) || (!isSkillRoot && !l0Boundary(targetPath, absoluteRoot))) {
        result.violations.push(`${sourceEntry.source}: 不允许的分发边界 → ${rawTarget}`);
        continue;
      }

      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetPath is resolved from an L0 markdown link beneath the verified skill root
        const realTarget = await fs.realpath(targetPath);
        if (!isInside(rootRealPath, realTarget)) {
          result.violations.push(`${sourceEntry.source}: L0 目标越出 skill 根 → ${rawTarget}`);
        }
      } catch {
        result.violations.push(`${sourceEntry.source}: 相对链接目标不存在 → ${rawTarget}`);
      }
    }
  }

  return result;
}
