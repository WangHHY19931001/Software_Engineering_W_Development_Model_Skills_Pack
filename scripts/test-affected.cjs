#!/usr/bin/env node
/**
 * 快速车道（test:affected）——只跑「本次改动可能影响」的测试文件。
 *
 * ## 定位（务必先读）
 *
 * 这是**本地迭代**用的车道，**不是验收门禁**：
 *   - 验收（任务收口 / 交付 / 合入前）**必须跑全量**：`npm run prepush`（18 项门禁，含全量 vitest + 覆盖率阈值）
 *     或至少 `npm test`（全量 vitest）。本脚本无法替代它——它只跑被选中的测试文件。
 *   - 因此本脚本会主动打印「选了哪些文件、为什么」以及「本次没有跑哪些门禁」，避免把快速车道误当验收。
 *
 * ## 用法
 *
 *   npm run test:affected                     # 只看未提交改动（含未跟踪文件）
 *   npm run test:affected -- --since <rev>    # 加上自 <rev> 起的已提交改动（如 --since origin/main）
 *   npm run test:affected -- --dry-run        # 只打印选中的文件与理由，不执行 vitest
 *   node scripts/test-affected.cjs --self-check   # 断言 porcelain 解析的固定格式契约（状态列含前导空格等 7 例）
 *   node scripts/test-affected.cjs --help
 *
 * ## 选择规则（并集，宁多勿少）
 *
 *   1. 改动的测试文件本身；
 *   2. `w-model-dev/scripts/cli/<name>.ts` → 文件名含 `<name>` 的测试文件；
 *   3. 其他改动文件 → 正文出现其基名（去扩展名）的测试文件（同一份 tests 目录只读一次）；
 *   4. 触及**注册表敏感**路径（任何 `cli/*.ts` 或 `lib/exit2-probe-registry.ts`）→ 联带加入断言
 *      注册表/契约的测试文件（REGISTRY_TESTS：门禁集合、exit-2、负向覆盖登记册、参数/退出码契约）；
 *   5. 触及**涟漪**路径（config / .githooks / schemas / package.json / references / samples / docs /
 *      eval / 根 scripts/ / 根活体文档）→ 直接退回**全量**：这类改动的影响无法靠文件名映射可靠枚举，
 *      跑子集只会给出虚假的安心。
 *
 * 退出码：透传 vitest 的退出码（0 = 选中文件全过；非 0 = 有失败或运行错误）。选不出文件时打印提示并 exit 0。
 *
 * @module
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = 'w-model-dev/scripts/__tests__';
const VITEST_CONFIG = 'config/vitest.config.ts';

/** 影响面无法用文件名映射枚举的路径：命中即跑全量。 */
const RIPPLE_PATTERNS = [
  /^config\//,
  /^\.githooks\//,
  /^w-model-dev\/schemas\//,
  /^w-model-dev\/references\//,
  /^w-model-dev\/scripts\/samples\//,
  /^docs\//,
  /^eval\//,
  /^scripts\//,
  /^package(-lock)?\.json$/,
  /^AGENTS\.md$/,
  /^README\.md$/,
  /^CONTRIBUTING\.md$/,
  /^CHANGELOG(-\w+)?\.md$/,
];

/** 注册表敏感路径：改动会波及「门禁集合」这类跨文件断言。 */
const REGISTRY_SENSITIVE_PATTERNS = [
  /^w-model-dev\/scripts\/cli\/[^/]+\.ts$/,
  /^w-model-dev\/scripts\/lib\/exit2-probe-registry\.ts$/,
];

/** 注册表敏感改动联带加入的测试文件（断言门禁集合 / exit-2 / 登记册 / 参数与退出码契约）。 */
const REGISTRY_TESTS = [
  'check-samples-coverage.test.ts',
  'cli-arg-unification.test.ts',
  'cli-natural-exit.test.ts',
  'docs-consistency-logic.test.ts',
  'exit2-failure-atomicity.test.ts',
];

/** 本车道**不跑**的门禁（打印提醒用）：验收时必须由全量车道覆盖。 */
const GATES_NOT_COVERED = [
  'self-test（352 条样本）',
  'security-scan（基线比对）',
  'docs-consistency（活体文档 / 注册表 / 探针计数）',
  'samples 覆盖矩阵（登记册 + 真实 exit-2 探针）',
  'prettier --check / tsc --noEmit',
  'eval 语料断言 / npm audit',
];

function gitLines(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30_000 });
  if (result.error !== undefined || result.status !== 0) return [];
  return (
    String(result.stdout ?? '')
      .split('\n')
      // 只剥行尾 CR：**不能 trim 行首**——`git status --porcelain` 的状态前缀本身含前导空格
      // （` M path`），trim 掉会让下面按固定 3 列切片时切进路径，路径随即「不存在」。
      .map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
      .filter((line) => line !== '')
  );
}

/** 剥掉 git 对含特殊字符路径加的双引号（含 `\"` 转义）。 */
function unquotePath(value) {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  return value.slice(1, -1).replace(/\\(.)/g, '$1');
}

/**
 * 解析一行 `git status --porcelain`：固定 3 列状态前缀（含前导空格）+ 路径；rename/copy 取新路径。
 * 纯函数（无 IO）以便 `--self-check` 直接断言。
 */
function parsePorcelainLine(line) {
  if (line.length < 4) return null;
  const rest = line.slice(3);
  const arrow = rest.lastIndexOf(' -> ');
  return unquotePath(arrow === -1 ? rest : rest.slice(arrow + 4));
}

/** 未提交改动（含未跟踪）+ 可选 `--since <rev>` 起已提交改动；只保留仍在盘上的路径。 */
function collectChangedPaths(since) {
  const paths = new Set();
  for (const line of gitLines(['status', '--porcelain'])) {
    const parsed = parsePorcelainLine(line);
    if (parsed !== null && parsed !== '') paths.add(parsed);
  }
  if (since !== undefined) {
    for (const p of gitLines(['diff', '--name-only', `${since}...HEAD`])) {
      if (p !== '') paths.add(unquotePath(p));
    }
  }
  return [...paths].filter((p) => fs.existsSync(path.join(REPO_ROOT, p)));
}

/**
 * `--self-check`：断言 porcelain 解析的固定格式契约（前导空格状态列、未跟踪、rename、带引号路径）。
 * 存在的意义：这类「按固定列切片」的解析最容易被「顺手 trim / 规范化」破坏，且破坏后表现为
 * 「没有检测到改动」这种静默降级——正是本车道最危险的失败形态。
 */
function selfCheck() {
  const cases = [
    [' M w-model-dev/scripts/cli/check-pollution.ts', 'w-model-dev/scripts/cli/check-pollution.ts'],
    ['?? scripts/test-affected.cjs', 'scripts/test-affected.cjs'],
    ['A  w-model-dev/scripts/lib/exit2-probe-registry.ts', 'w-model-dev/scripts/lib/exit2-probe-registry.ts'],
    ['R  old/name.ts -> new/name.ts', 'new/name.ts'],
    ['R  "old name.ts" -> "new name.ts"', 'new name.ts'],
    ['', null],
    [' M ', null],
  ];
  const failures = cases.filter(([line, expected]) => parsePorcelainLine(line) !== expected);
  if (failures.length > 0) {
    for (const [line, expected] of failures) {
      console.error(
        `✗ parsePorcelainLine(${JSON.stringify(line)}) = ${JSON.stringify(parsePorcelainLine(line))}，期望 ${JSON.stringify(expected)}`,
      );
    }
    return 1;
  }
  console.log(`✓ porcelain 解析自检通过（${cases.length} 例：状态列含前导空格 / 未跟踪 / rename / 带引号路径 / 空行）`);
  return 0;
}

function readTestFiles() {
  const dir = path.join(REPO_ROOT, TESTS_DIR);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
    .map((name) => ({ name, source: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

function selectTests(changed, tests) {
  const selected = new Set();
  const reasons = [];
  for (const p of changed) {
    const base = path.basename(p);
    const stem = base.replace(/\.[^.]+$/, '');
    if (p.startsWith(`${TESTS_DIR}/`) && base.endsWith('.test.ts')) {
      selected.add(base);
      reasons.push(`${p} → 改动的测试文件本身`);
      continue;
    }
    let matchedByName = false;
    if (p.startsWith('w-model-dev/scripts/cli/') && stem.length >= 4) {
      for (const t of tests) {
        if (t.name.includes(stem)) {
          selected.add(t.name);
          matchedByName = true;
        }
      }
      if (matchedByName) reasons.push(`${p} → 文件名含「${stem}」的测试`);
    }
    if (!matchedByName && stem.length >= 5) {
      for (const t of tests) {
        if (t.source.includes(stem)) selected.add(t.name);
      }
      reasons.push(`${p} → 正文引用「${stem}」的测试`);
    }
  }
  if (changed.some((p) => REGISTRY_SENSITIVE_PATTERNS.some((re) => re.test(p)))) {
    for (const name of REGISTRY_TESTS) {
      if (tests.some((t) => t.name === name)) selected.add(name);
    }
    reasons.push('注册表敏感改动（cli/*.ts 或 exit2-probe-registry.ts）→ 联带注册表/契约测试');
  }
  return { selected: [...selected].sort(), reasons };
}

function printBanner() {
  console.log('─'.repeat(72));
  console.log('快速车道 test:affected —— 本地迭代用，**不是验收门禁**');
  console.log('验收（任务收口 / 交付 / 合入前）必须跑全量：npm run prepush（18 项，含全量 vitest + 覆盖率阈值）');
  console.log(`本车道不覆盖的门禁：${GATES_NOT_COVERED.join(' / ')}`);
  console.log('─'.repeat(72));
}

function runVitest(paths, dryRun) {
  const args = ['vitest', 'run', '--config', VITEST_CONFIG, ...paths];
  console.log(`\n▸ npx ${args.join(' ')}${dryRun ? '   （--dry-run：只打印，不执行）' : ''}\n`);
  if (dryRun) return 0;
  const result = spawnSync('npx', args, { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error !== undefined) {
    console.error(`✗ 无法启动 vitest：${result.error.message}`);
    return 2;
  }
  return typeof result.status === 'number' ? result.status : 2;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      fs
        .readFileSync(__filename, 'utf8')
        .split('*/')[0]
        .replace(/^\/\*\*?/, '')
        .trim(),
    );
    return 0;
  }
  const dryRun = argv.includes('--dry-run');
  if (argv.includes('--self-check')) return selfCheck();
  const sinceIndex = argv.indexOf('--since');
  const since = sinceIndex === -1 ? undefined : argv[sinceIndex + 1];
  if (sinceIndex !== -1 && (since === undefined || since.startsWith('--'))) {
    console.error('✗ --since 需要一个版本参数（如 --since origin/main）');
    return 2;
  }

  printBanner();
  const changed = collectChangedPaths(since);
  if (changed.length === 0) {
    console.log(
      '\n没有检测到改动（未提交改动为空' + (since === undefined ? '' : '，且自 ' + since + ' 起无改动') + '）。',
    );
    console.log('指定基线重试用：npm run test:affected -- --since origin/main');
    return 0;
  }
  console.log(`\n▸ 参与判定的改动文件（${changed.length}）：`);
  for (const p of changed) console.log(`  - ${p}`);

  const ripple = changed.filter((p) => RIPPLE_PATTERNS.some((re) => re.test(p)));
  if (ripple.length > 0) {
    console.log('\n▸ 命中涟漪路径 → 影响面无法用文件名映射枚举，直接跑**全量**：');
    for (const p of ripple) console.log(`  - ${p}`);
    return runVitest([], dryRun);
  }

  const { selected, reasons } = selectTests(changed, readTestFiles());
  if (selected.length === 0) {
    console.log('\n▸ 没有匹配到测试文件。这不代表改动安全——请用全量车道确认：npm run prepush');
    return 0;
  }
  console.log(`\n▸ 选中 ${selected.length} 个测试文件（按改动映射）：`);
  for (const name of selected) console.log(`  - ${TESTS_DIR}/${name}`);
  console.log('\n▸ 选择理由：');
  for (const reason of reasons) console.log(`  - ${reason}`);
  return runVitest(
    selected.map((name) => `${TESTS_DIR}/${name}`),
    dryRun,
  );
}

process.exitCode = main();
