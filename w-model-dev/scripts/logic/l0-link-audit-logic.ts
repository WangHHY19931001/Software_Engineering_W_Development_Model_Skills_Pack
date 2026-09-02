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

interface SymlinkInspection {
  relativePath: string;
  realPath?: string;
  isDirectory: boolean;
  broken: boolean;
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
 * Find the first symlink/junction in a lexical path beneath root without following it.
 * This is deliberately lstat-based: a symlinked directory must never be recursively
 * traversed, and a link below scripts/samples/tools must not be silently classified L1-only.
 */
async function findSymlinkInPath(root: string, target: string): Promise<SymlinkInspection | undefined> {
  const relative = path.relative(root, target);
  if (relative === '' || path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`) || relative === '..') {
    return undefined;
  }

  let candidate = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    candidate = path.join(candidate, segment);
    let metadata: import('node:fs').Stats;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- candidate is a path segment beneath the verified skill root
      metadata = await fs.lstat(candidate);
    } catch {
      return undefined;
    }
    if (!metadata.isSymbolicLink()) continue;

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- candidate was enumerated beneath the verified skill root
      const realPath = await fs.realpath(candidate);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- realPath is resolved from the enumerated symlink endpoint
      const resolvedMetadata = await fs.stat(realPath);
      return {
        relativePath: normalizeRelative(path.relative(root, candidate)),
        realPath,
        isDirectory: resolvedMetadata.isDirectory(),
        broken: false,
      };
    } catch {
      return {
        relativePath: normalizeRelative(path.relative(root, candidate)),
        isDirectory: false,
        broken: true,
      };
    }
  }
  return undefined;
}

async function inspectDirectoryEntry(
  rootRealPath: string,
  absolute: string,
  relative: string,
  violations: string[],
  required: boolean,
  scope: 'L0' | 'L1-only' = 'L0',
): Promise<'directory' | 'file' | 'broken'> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolute is an enumerated package path
    const realPath = await fs.realpath(absolute);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realPath is resolved from an enumerated package path
    const metadata = await fs.stat(realPath);
    const kind = metadata.isDirectory() ? '目录' : '文件';
    if (!isInside(rootRealPath, realPath)) {
      const outsideKind = scope === 'L0' && kind === '文件' ? '源文件' : kind;
      violations.push(`${scope} ${outsideKind}越出 skill 根 ${normalizeRelative(relative)}`);
    } else {
      violations.push(`${scope} ${kind} symlink/junction 不允许 ${normalizeRelative(relative)}`);
    }
    return metadata.isDirectory() ? 'directory' : 'file';
  } catch {
    violations.push(
      required
        ? `必需 ${scope} 目录 symlink/junction 目标不存在 ${normalizeRelative(relative)}`
        : `${scope} 条目 symlink/junction 目标不存在 ${normalizeRelative(relative)}`,
    );
    return 'broken';
  }
}

async function collectFiles(
  root: string,
  directory: string,
  rootRealPath: string,
  violations: string[],
  scope: 'L0' | 'L1-only' = 'L0',
): Promise<string[]> {
  const absolute = path.join(root, directory);
  let metadata: import('node:fs').Stats;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolute remains beneath the resolved skill root during recursive audit
    metadata = await fs.lstat(absolute);
  } catch {
    if (scope === 'L0') violations.push(`必需 L0 目录不存在或不可读 ${normalizeRelative(directory)}`);
    return [];
  }

  if (metadata.isSymbolicLink()) {
    await inspectDirectoryEntry(rootRealPath, absolute, directory, violations, scope === 'L0', scope);
    return [];
  }
  if (!metadata.isDirectory()) {
    if (scope === 'L0') violations.push(`必需 L0 目录不存在或不可读 ${normalizeRelative(directory)}`);
    else violations.push(`L1-only 目录类型不受支持 ${normalizeRelative(directory)}`);
    return [];
  }

  let realDirectory: string;
  let entries: import('node:fs').Dirent[];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolute remains beneath the resolved skill root during recursive audit
    realDirectory = await fs.realpath(absolute);
    if (!isInside(rootRealPath, realDirectory)) {
      violations.push(`${scope} 目录越出 skill 根 ${normalizeRelative(directory)}`);
      return [];
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realDirectory was resolved beneath the verified skill root
    entries = await fs.readdir(realDirectory, { withFileTypes: true });
  } catch {
    if (scope === 'L0') violations.push(`必需 L0 目录不存在或不可读 ${normalizeRelative(directory)}`);
    else violations.push(`L1-only 目录不可读 ${normalizeRelative(directory)}`);
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    const candidate = path.join(absolute, entry.name);
    let entryMetadata: import('node:fs').Stats;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- candidate is enumerated beneath the verified L0 directory
      entryMetadata = await fs.lstat(candidate);
    } catch {
      violations.push(`${scope} 条目不可读 ${normalizeRelative(relative)}`);
      continue;
    }

    if (entryMetadata.isSymbolicLink()) {
      await inspectDirectoryEntry(rootRealPath, candidate, relative, violations, false, scope);
      continue;
    }
    if (entryMetadata.isDirectory()) {
      files.push(...(await collectFiles(root, relative, rootRealPath, violations, scope)));
    } else if (entryMetadata.isFile()) {
      files.push(relative);
    } else {
      violations.push(`${scope} 条目类型不受支持 ${normalizeRelative(relative)}`);
    }
  }

  return files;
}

async function auditL1Directories(root: string, rootRealPath: string, violations: string[]): Promise<void> {
  for (const directory of L1_DIRECTORIES) {
    const absolute = path.join(root, directory);
    let metadata: import('node:fs').Stats;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is selected from the fixed L1 boundary inventory
      metadata = await fs.lstat(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        violations.push(`L1-only 目录不可读 ${normalizeRelative(directory)}`);
      }
      continue;
    }
    if (metadata.isSymbolicLink()) {
      await inspectDirectoryEntry(rootRealPath, absolute, directory, violations, false, 'L1-only');
      continue;
    }
    if (metadata.isDirectory()) await collectFiles(root, directory, rootRealPath, violations, 'L1-only');
    else violations.push(`L1-only 条目类型不受支持 ${normalizeRelative(directory)}`);
  }
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

  let rootMetadata: import('node:fs').Stats;
  let rootRealPath: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absoluteRoot is the caller-supplied skill package root
    rootMetadata = await fs.lstat(absoluteRoot);
    if (rootMetadata.isSymbolicLink()) {
      await inspectDirectoryEntry(absoluteRoot, absoluteRoot, '.', result.violations, false);
      result.violations.push('skill 根目录 symlink/junction 不允许');
      return result;
    }
    if (!rootMetadata.isDirectory()) {
      result.violations.push('skill 根目录不存在或不可读');
      return result;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absoluteRoot is the caller-supplied skill package root
    rootRealPath = await fs.realpath(absoluteRoot);
  } catch {
    result.violations.push('skill 根目录不存在或不可读');
    return result;
  }

  const skillPath = path.join(absoluteRoot, 'SKILL.md');
  let skillUsable = false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- skillPath is the required root file beneath the resolved skill root
    const skillMetadata = await fs.lstat(skillPath);
    if (skillMetadata.isSymbolicLink()) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- skillPath is the required root file beneath the resolved skill root
        const skillRealPath = await fs.realpath(skillPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- skillRealPath is resolved from the required root file
        const resolvedMetadata = await fs.stat(skillRealPath);
        if (!isInside(rootRealPath, skillRealPath)) {
          result.violations.push('必需 L0 文件越出 skill 根 SKILL.md');
        } else if (resolvedMetadata.isDirectory()) {
          result.violations.push('必需 L0 文件类型不受支持 SKILL.md');
        } else {
          result.violations.push('L0 源文件 symlink/junction 不允许 SKILL.md');
        }
      } catch {
        result.violations.push('必需 L0 文件 symlink/junction 目标不存在 SKILL.md');
      }
    } else if (!skillMetadata.isFile()) {
      result.violations.push('必需 L0 文件不存在或不可读 SKILL.md');
    } else {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- skillPath is the required root file beneath the resolved skill root
      const skillRealPath = await fs.realpath(skillPath);
      if (!isInside(rootRealPath, skillRealPath)) {
        result.violations.push('必需 L0 文件越出 skill 根 SKILL.md');
      } else {
        skillUsable = true;
      }
    }
  } catch {
    result.violations.push('必需 L0 文件不存在或不可读 SKILL.md');
  }

  const l0Files = skillUsable ? ['SKILL.md'] : [];
  for (const directory of L0_DIRECTORIES) {
    l0Files.push(...(await collectFiles(absoluteRoot, directory, rootRealPath, result.violations, 'L0')));
  }
  await auditL1Directories(absoluteRoot, rootRealPath, result.violations);

  for (const source of l0Files.filter((file) => file.endsWith('.md'))) {
    const sourcePath = path.join(absoluteRoot, source);
    let content: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- source is a verified regular L0 file
      content = await fs.readFile(sourcePath, 'utf8');
    } catch {
      result.violations.push(`${normalizeRelative(source)}: L0 源文件不可读`);
      continue;
    }

    for (const rawTarget of parseRelativeLinks(content)) {
      result.relativeLinkCount++;
      const sourceEntry = { source: normalizeRelative(source), target: rawTarget };

      let decodedTarget: string;
      try {
        // Validate the complete URI before removing its fragment so malformed percent
        // sequences cannot bypass the fail-closed audit in the ignored fragment text.
        decodedTarget = decodeURI(rawTarget);
      } catch {
        result.violations.push(`${sourceEntry.source}: 链接 URI 编码无效 → ${rawTarget}`);
        continue;
      }

      if (rawTarget.includes('{{module}}')) {
        if (normalizeRelative(source).startsWith('templates/')) {
          result.templatePlaceholders.push(sourceEntry);
        } else {
          result.violations.push(`${sourceEntry.source}: 非模板文件不得使用 {{module}} 占位链接 → ${rawTarget}`);
        }
        continue;
      }

      const targetWithoutFragment = decodedTarget.split('#')[0]!;

      const targetPath = path.resolve(path.dirname(sourcePath), targetWithoutFragment);
      const l1Directory = l1Boundary(targetPath, absoluteRoot);
      const symlink = await findSymlinkInPath(absoluteRoot, targetPath);
      if (symlink) {
        const scope = l1Directory ? 'L1-only' : 'L0';
        const kind = symlink.isDirectory ? '目录' : '文件';
        if (symlink.broken) {
          result.violations.push(`${sourceEntry.source}: ${scope} ${kind} symlink/junction 目标不存在 → ${rawTarget}`);
        } else if (!symlink.realPath || !isInside(rootRealPath, symlink.realPath)) {
          result.violations.push(`${sourceEntry.source}: ${scope} 目标越出 skill 根（${kind}）→ ${rawTarget}`);
        } else {
          result.violations.push(`${sourceEntry.source}: ${scope} ${kind} symlink/junction 不允许 → ${rawTarget}`);
        }
        continue;
      }

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
