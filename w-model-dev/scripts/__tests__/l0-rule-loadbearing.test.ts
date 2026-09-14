/**
 * S25 — L0 关键规则负载性三态 fixture（设计规格 AC-7 分句③）。
 *
 * 验收语义：「关键 L0 规则有『含规则/剥离规则』两态 fixture 且剥离态复现违规」。
 * 对 `logic/l0-link-audit-logic.ts` 的三条关键规则各建三态：
 *   GREEN    —— 合规输入 → 该类零违规；
 *   RED      —— 违规输入 → 报该违规；
 *   STRIPPED —— 同一违规输入 × 剥离副本 → 该违规不再报（复现「无该规则」的旧行为），
 *               且副本对合规根仍正常审计（防「剥坏整个函数」的假阳性）。
 *
 * 剥离机制：该 logic 模块只 import node:fs/node:path（无相对 import），三条规则都是
 * `auditL0RelativeLinks` 单函数内的分支，不可函数级剥离——因此把 logic 源码文本按
 * 唯一子串定位剥掉目标规则块、写入 os.tmpdir() 副本后动态 import。剥离函数按各规则块
 * 的已知结构整块删除：锚点不唯一、块结构漂移或大括号不配平即抛错，绝不静默错删；
 * 本文件不修改 logic 本体。
 *
 * 本文件不 import node:child_process、不调用 runSync/execSync/spawnSync/execFile、
 * 不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES（vitest-project-split 只对真实
 * spawn 的文件强制登记，其双向校验对无子进程文件反向成立）。
 */

import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { auditL0RelativeLinks } from '../logic/l0-link-audit-logic.js';

type L0LinkAuditModule = typeof import('../logic/l0-link-audit-logic.js');

const LOGIC_SOURCE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../logic/l0-link-audit-logic.ts');
const L0_DIRECTORIES = ['references', 'templates', 'examples', 'subagent', 'schemas'] as const;

// 三条规则的违规文案锚（与 logic 源码中的违规消息一一对应）
const PLACEHOLDER_VIOLATION = '非模板文件不得使用 {{module}} 占位链接';
const DISTRIBUTION_VIOLATION = '不允许的分发边界';
const EXISTENCE_VIOLATION = '相对链接目标不存在';

const createdRoots: string[] = [];

function readLogicSource(): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径由本测试文件自身位置解析，指向本技能包 logic 源
  return readFileSync(LOGIC_SOURCE_PATH, 'utf8');
}

/** 断言锚点在源码中恰好命中一次，否则抛错（防错删/漏删）。 */
function requireUniqueAnchor(source: string, anchor: string): number {
  const first = source.indexOf(anchor);
  if (first < 0) throw new Error(`strip 定位失败：锚点未命中 → ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + 1) >= 0) throw new Error(`strip 定位失败：锚点不唯一 → ${JSON.stringify(anchor)}`);
  return first;
}

/**
 * 规则①/②共用剥离：删除「锚点行 … { … }」形态的完整语句块（含块后一个换行）。
 * 大括号按原文配平扫描——两条规则块内的模板串插值与 {{module}} 字面量大括号均已
 * 逐一核对为配平，扫描不会越块；锚点不唯一或配平失败即抛错。
 */
function removeBracedStatementBlock(source: string, anchor: string): string {
  const anchorIdx = requireUniqueAnchor(source, anchor);
  const lineStart = source.lastIndexOf('\n', anchorIdx) + 1;
  const openIdx = source.indexOf('{', anchorIdx + anchor.length);
  if (openIdx < 0) throw new Error(`strip 失败：锚点之后无 { → ${JSON.stringify(anchor)}`);
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < source.length; i++) {
    // charAt 而非方括号索引：越界返回空串（不匹配任何大括号），且避免计算成员访问
    if (source.charAt(i) === '{') depth++;
    else if (source.charAt(i) === '}') {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) throw new Error(`strip 失败：大括号不配平 → ${JSON.stringify(anchor)}`);
  const end = source.charAt(closeIdx + 1) === '\n' ? closeIdx + 2 : closeIdx + 1;
  return source.slice(0, lineStart) + source.slice(end);
}

/**
 * 规则①剥离：{{module}} 占位符规则（勘察时点 logic :418-425，以唯一子串为准）。
 * 锚点 `rawTarget.includes('{{module}}')` 全文唯一；删除该 if/else + continue 整块。
 */
function stripPlaceholderRule(source: string): string {
  return removeBracedStatementBlock(source, `rawTarget.includes('{{module}}')`);
}

/**
 * 规则②剥离：L0 分发边界规则（勘察时点 logic :460-464，以唯一子串为准）。
 * 锚点取 `const isSkillRoot = …` 声明行（全文唯一，该 const 仅被本规则使用）；
 * 删除 const 声明 + 边界 if + continue 整块。
 */
function stripDistributionBoundaryRule(source: string): string {
  return removeBracedStatementBlock(source, `const isSkillRoot = targetPath === path.join(absoluteRoot, 'SKILL.md');`);
}

/**
 * 规则③剥离：目标存在性规则（勘察时点 logic :466-474，以唯一子串为准）。
 * 该块是「try { … } catch { … }」语句，块内无全局唯一子串可作语句头锚点——故以
 * catch 内唯一违规文案「相对链接目标不存在」定位，按已知行结构回溯到裸 `try {` 行、
 * 前进到 catch 闭括号行整块删除；行结构漂移或 try 块内容不符即抛错（防错删相邻 try）。
 */
function stripTargetExistenceRule(source: string): string {
  const lines = source.split('\n');
  const hits = lines
    .map((line, index) => (line.includes(EXISTENCE_VIOLATION) ? index : -1))
    .filter((index) => index >= 0);
  if (hits.length !== 1) {
    throw new Error(`strip 定位失败：锚点命中 ${hits.length} 行（须恰 1 行）→ ${JSON.stringify(EXISTENCE_VIOLATION)}`);
  }
  const catchPushIdx = hits[0]!;
  // 已知行结构（勘察时点 :466-474）：锚点行是 catch 内的 violations.push，
  // 下一行是 catch 闭括号 `}`，上一行是 `} catch {`
  if (lines[catchPushIdx + 1]?.trim() !== '}' || lines[catchPushIdx - 1]?.trim() !== '} catch {') {
    throw new Error('strip 失败：目标存在性 try/catch 行结构漂移');
  }
  let tryIdx = catchPushIdx - 2;
  // Array.at 而非方括号索引：避免计算成员访问；tryIdx >= 0 守卫下越界返回 undefined，
  // 与原语义一致（继续回溯直至抛「未找到裸 try { 行」）
  for (; tryIdx >= 0; tryIdx--) {
    if (lines.at(tryIdx)?.trim() === 'try {') break;
  }
  if (tryIdx < 0) throw new Error('strip 失败：未找到裸 try { 行');
  const tryBody = lines.slice(tryIdx + 1, catchPushIdx - 1).join('\n');
  if (!tryBody.includes('const realTarget = await fs.realpath(targetPath);')) {
    throw new Error('strip 失败：try 块内容与目标存在性规则不符');
  }
  lines.splice(tryIdx, catchPushIdx + 2 - tryIdx);
  return lines.join('\n');
}

/** 把剥离后的源码写入 os.tmpdir() 唯一副本并动态 import（vitest 会按 TS 转译）。 */
async function loadStrippedAudit(strippedSource: string): Promise<L0LinkAuditModule> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-stripped-copy-'));
  const copyPath = path.join(directory, 'l0-link-audit-stripped.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- copyPath 位于本测试自建的 mkdtemp 目录之下
  await fs.writeFile(copyPath, strippedSource, 'utf8');
  try {
    // 副本只 import node:fs/node:path（无相对 import），可独立加载；
    // 副本路径每次 mkdtemp 唯一，不受模块缓存影响。
    // eslint-disable-next-line security/detect-non-literal-require -- copyPath 是自写入的剥离副本，位于 mkdtemp 目录之下
    return (await import(pathToFileURL(copyPath).href)) as L0LinkAuditModule;
  } finally {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory 是本测试自建的 mkdtemp 剥离副本目录
    await fs.rm(directory, { recursive: true, force: true });
  }
}

/** mkdtemp 一个最小合规 skill 根（SKILL.md + 五个 L0 目录），登记进 afterEach 清理清单。 */
async function makeSkillRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdRoots.push(root);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root 是本测试自建的 mkdtemp fixture 根
  await fs.writeFile(path.join(root, 'SKILL.md'), '# fixture skill\n', 'utf8');
  await Promise.all(
    L0_DIRECTORIES.map((directory) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 每个目录都建在 mkdtemp fixture 根之下
      return fs.mkdir(path.join(root, directory), { recursive: true });
    }),
  );
  return root;
}

/** 在 fixture 根下写文件（先例：l0-link-audit-logic.test.ts 的 write helper）。 */
async function writeFixture(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target 建在 mkdtemp fixture 根之下
  await fs.mkdir(path.dirname(target), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target 建在 mkdtemp fixture 根之下
  await fs.writeFile(target, content, 'utf8');
}

/** 副本健康检查：剥离副本对合规根仍正常审计（防「剥坏整个函数」假阳性）。 */
async function expectStrippedCopyStillAudits(moduleUnderTest: L0LinkAuditModule, prefix: string): Promise<void> {
  const compliant = await makeSkillRoot(prefix);
  await writeFixture(compliant, 'references/guide.md', '[ok](./ok.md)');
  await writeFixture(compliant, 'references/ok.md', '# ok\n');
  const result = await moduleUnderTest.auditL0RelativeLinks(compliant);
  expect(result.violations).toEqual([]);
  expect(result.relativeLinkCount).toBe(1);
  expect(result.l1Only).toEqual([]);
}

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((root) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- root 是本文件自建的 mkdtemp fixture 根
      return fs.rm(root, { recursive: true, force: true });
    }),
  );
});

describe('规则① {{module}} 占位符规则（非模板文件不得使用 {{module}} 占位链接）', () => {
  it('GREEN：合规输入（占位符仅在 templates/ 源文件）→ 该类零违规', async () => {
    const root = await makeSkillRoot('l0-lb1-green-');
    await writeFixture(root, 'templates/contract.md', '[module](./{{module}}-contract.md)');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toEqual([]);
    expect(result.templatePlaceholders).toHaveLength(1);
  });

  it('RED：违规输入（同一占位符出现在非模板 L0 文件）→ 报该违规', async () => {
    const root = await makeSkillRoot('l0-lb1-red-');
    await writeFixture(root, 'references/guide.md', '[module](./{{module}}-contract.md)');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toContainEqual(expect.stringContaining(PLACEHOLDER_VIOLATION));
  });

  it('STRIPPED：剥离副本 × 同一违规输入 → 该违规不再报（副本其余规则仍工作）', async () => {
    const root = await makeSkillRoot('l0-lb1-strip-');
    await writeFixture(root, 'references/guide.md', '[module](./{{module}}-contract.md)');

    // 对照：同一违规输入在未剥离模块上仍报该违规
    const original = await auditL0RelativeLinks(root);
    expect(original.violations).toContainEqual(expect.stringContaining(PLACEHOLDER_VIOLATION));

    const moduleUnderTest = await loadStrippedAudit(stripPlaceholderRule(readLogicSource()));
    const stripped = await moduleUnderTest.auditL0RelativeLinks(root);
    expect(stripped.violations).not.toContainEqual(expect.stringContaining(PLACEHOLDER_VIOLATION));
    // 副本其余规则未被剥坏：同一输入落回规则③（占位目标并不存在）
    expect(stripped.violations).toContainEqual(expect.stringContaining(EXISTENCE_VIOLATION));

    await expectStrippedCopyStillAudits(moduleUnderTest, 'l0-lb1-strip-ok-');
  });
});

describe('规则② L0 分发边界（不允许的分发边界）', () => {
  it('GREEN：合规输入（L0 内部相对链接）→ 该类零违规', async () => {
    const root = await makeSkillRoot('l0-lb2-green-');
    await writeFixture(root, 'references/guide.md', '[next](./next.md)');
    await writeFixture(root, 'references/next.md', '# next\n');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toEqual([]);
  });

  it('RED：违规输入（L0 文件链接到包根散文件：非 SKILL.md 也非 L0 目录内目标）→ 报该违规', async () => {
    const root = await makeSkillRoot('l0-lb2-red-');
    await writeFixture(root, 'README.md', '# root readme\n');
    await writeFixture(root, 'references/guide.md', '[readme](../README.md)');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toContainEqual(expect.stringContaining(DISTRIBUTION_VIOLATION));
  });

  it('STRIPPED：剥离副本 × 同一违规输入 → 该违规不再报且无其他规则兜底', async () => {
    const root = await makeSkillRoot('l0-lb2-strip-');
    await writeFixture(root, 'README.md', '# root readme\n');
    await writeFixture(root, 'references/guide.md', '[readme](../README.md)');

    // 对照：同一违规输入在未剥离模块上仍报该违规
    const original = await auditL0RelativeLinks(root);
    expect(original.violations).toContainEqual(expect.stringContaining(DISTRIBUTION_VIOLATION));

    const moduleUnderTest = await loadStrippedAudit(stripDistributionBoundaryRule(readLogicSource()));
    const stripped = await moduleUnderTest.auditL0RelativeLinks(root);
    expect(stripped.violations).not.toContainEqual(expect.stringContaining(DISTRIBUTION_VIOLATION));
    // 规则②负载性的最强形态：目标真实存在且在包根内，剥离后没有任何规则再兜底
    expect(stripped.violations).toEqual([]);
    expect(stripped.relativeLinkCount).toBe(1);

    await expectStrippedCopyStillAudits(moduleUnderTest, 'l0-lb2-strip-ok-');
  });
});

describe('规则③ 目标存在性（相对链接目标不存在）', () => {
  it('GREEN：合规输入（目标存在的 L0 内相对链接）→ 该类零违规', async () => {
    const root = await makeSkillRoot('l0-lb3-green-');
    await writeFixture(root, 'references/guide.md', '[ok](./ok.md)');
    await writeFixture(root, 'references/ok.md', '# ok\n');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toEqual([]);
  });

  it('RED：违规输入（链接指向不存在的 L0 目标）→ 报该违规', async () => {
    const root = await makeSkillRoot('l0-lb3-red-');
    await writeFixture(root, 'references/guide.md', '[missing](./missing.md)');

    const result = await auditL0RelativeLinks(root);

    expect(result.violations).toContainEqual(expect.stringContaining(EXISTENCE_VIOLATION));
  });

  it('STRIPPED：剥离副本 × 同一违规输入 → 该违规不再报且无其他规则兜底', async () => {
    const root = await makeSkillRoot('l0-lb3-strip-');
    await writeFixture(root, 'references/guide.md', '[missing](./missing.md)');

    // 对照：同一违规输入在未剥离模块上仍报该违规
    const original = await auditL0RelativeLinks(root);
    expect(original.violations).toContainEqual(expect.stringContaining(EXISTENCE_VIOLATION));

    const moduleUnderTest = await loadStrippedAudit(stripTargetExistenceRule(readLogicSource()));
    const stripped = await moduleUnderTest.auditL0RelativeLinks(root);
    expect(stripped.violations).not.toContainEqual(expect.stringContaining(EXISTENCE_VIOLATION));
    // 规则③是最后一道存在性检查：剥离后没有任何规则再兜底
    expect(stripped.violations).toEqual([]);
    // 副本仍在采集链接（函数未被剥坏的最小证据）
    expect(stripped.relativeLinkCount).toBe(1);

    await expectStrippedCopyStillAudits(moduleUnderTest, 'l0-lb3-strip-ok-');
  });
});
