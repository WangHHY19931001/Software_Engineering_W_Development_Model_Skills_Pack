#!/usr/bin/env node
/**
 * 版本号单源升级工具（version-bump）。
 *
 * package.json 为唯一版本源，本脚本一处改版、七文件同步：
 *   - package.json                    "version"
 *   - w-model-dev/skill-metadata.json "version"（+ updatedAt 刷新为当天）
 *   - w-model-dev/SKILL.md            frontmatter `version:`
 *   - README.md                       「当前版本**：`<ver>`」行
 *   - docs/INSTALL.md                 §5 激活 YAML 块 `version:`
 *   - package-lock.json               "version"（顶层 + packages[""] 两处）
 *   - CHANGELOG.md                    顶部插入 `## [<ver>] - <date>` 节头（条目正文由本次 commit 作者填写）
 *
 * 改版后用 `npm run check:docs-consistency` 自验证（version-consistency 检查比对七处）。
 * net effect：从「每次发版手改 7 文件 × 8 处」降为「一条命令 + 填 CHANGELOG 正文」。
 *
 * 用法：
 *   node scripts/version-bump.cjs <new-version>                     # 升级并同步七处
 *   node scripts/version-bump.cjs <new-version> --dry-run           # 仅打印将做的改动，不写盘
 *
 * 退出码：0 = 成功（dry-run 为「校验通过、未写盘」）；1 = 参数/校验/同步失败（消息走 stderr）。
 * 任一处替换失败即中止且不写盘任何文件——避免半升级状态。
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const VERSION_INNER = /\d+\.\d+\.\d+/;

function log(msg) {
  console.log(`[version-bump] ${msg}`);
}
function fail(msg) {
  console.error(`✗ [VERSION_BUMP] ${msg}`);
}

function readFile(p) {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf-8');
  } catch {
    return null;
  }
}

/** 归一化换行：读取时抽出 \r\n / \n，统一 stanzas 写回时复用原行尾 */
function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

/** 从 JSON 文本中取版本（保证只读字段，不整体重写美化格式） */
function jsonVersionField(text) {
  const m = text.match(/"version":\s*"(\d+\.\d+\.\d+)"/);
  return m ? m[1] : null;
}

function replaceJsonVersionField(text, next) {
  return text.replace(/"version":\s*"(\d+\.\d+\.\d+)"/, `"version": "${next}"`);
}

/** package-lock.json 双版本点替换：顶层 + packages[""]（两处都须同步，任一处缺失即视为未找到） */
function replaceLockVersionField(text, next) {
  const top = text.replace(/^(\s{2}"version":\s*")\d+\.\d+\.\d+(")/m, `$1${next}$2`);
  const root = top.replace(/^(\s{6}"version":\s*")\d+\.\d+\.\d+(")/m, `$1${next}$2`);
  return root;
}
function lockVersionFound(text) {
  const m = text.match(/^(\s{2}"version":\s*")(\d+\.\d+\.\d+)(")/m);
  const p = text.match(/^(\s{6}"version":\s*")(\d+\.\d+\.\d+)(")/m);
  return m !== null && p !== null && m[2] === p[2];
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const newVer = args.find((a) => a !== '--dry-run');

  if (newVer === undefined) {
    fail('缺少参数：node scripts/version-bump.cjs <new-version> [--dry-run]');
    return 1;
  }
  if (!VERSION_PATTERN.test(newVer)) {
    fail(`新版本号格式非法：${newVer}（应形如 41.16.0）`);
    return 1;
  }

  const pkgPath = 'package.json';
  const targets = [
    { file: pkgPath, label: 'package.json', kind: 'json' },
    { file: 'w-model-dev/skill-metadata.json', label: 'skill-metadata.json', kind: 'json' },
    { file: 'w-model-dev/SKILL.md', label: 'SKILL.md frontmatter', kind: 'skill' },
    { file: 'README.md', label: 'README「当前版本」', kind: 'readme' },
    { file: 'docs/INSTALL.md', label: 'docs/INSTALL.md 激活 YAML', kind: 'yaml' },
    { file: 'package-lock.json', label: 'package-lock.json', kind: 'lock' },
  ];
  const pkgText = readFile(pkgPath);
  if (pkgText === null) {
    fail(`${pkgPath} 不存在或不可读`);
    return 1;
  }
  const current = jsonVersionField(pkgText);
  if (current === null) {
    fail(`${pkgPath} 无法解析版本号`);
    return 1;
  }
  if (compareSemver(newVer, current) <= 0) {
    fail(`新版本 ${newVer} 须高于当前 ${current}`);
    return 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  if (dryRun) {
    log(`dry-run：将把 ${current} 升级到 ${newVer}`);
    for (const t of targets) {
      const text = readFile(t.file);
      if (text === null) {
        log(`  - ${t.label}（${t.file}）：✗ 文件缺失`);
        continue;
      }
      const replaced =
        t.kind === 'json'
          ? replaceJsonVersionField(text, newVer) !== text
          : t.kind === 'lock'
            ? replaceLockVersionField(text, newVer) !== text
            : t.kind === 'skill' || t.kind === 'yaml'
              ? replaceYamlVersion(text, newVer, current) !== text
              : replaceReadmeVersion(text, newVer, current) !== text;
      let note = replaced ? '将替换' : '✗ 未找到版本点';
      if (replaced && t.file === 'w-model-dev/skill-metadata.json') note = '将替换 version + updatedAt';
      log(`  - ${t.label}（${t.file}）：${note}`);
    }
    const ch = readFile('CHANGELOG.md');
    log(`  - CHANGELOG.md：${ch !== null && ch.match(/^## \[/m) ? '将在首个版本节头前插入' : '✗ 未找到版本节头'}`);
    log('dry-run 完成，未写盘。用 `node scripts/version-bump.cjs <new-version>` 实际执行。');
    return 0;
  }

  // 实改前先全量预检，任一目标缺失即中止（避免半升级）
  const missing = [];
  for (const t of targets) {
    const text = readFile(t.file);
    if (text === null) {
      missing.push(t.file);
      continue;
    }
    const ok =
      t.kind === 'json'
        ? jsonVersionField(text) !== null
        : t.kind === 'lock'
          ? lockVersionFound(text)
          : t.kind === 'skill' || t.kind === 'yaml'
            ? replaceYamlVersion(text, newVer, current) !== text
            : replaceReadmeVersion(text, newVer, current) !== text;
    if (!ok) missing.push(t.file);
  }
  if (missing.length > 0) {
    fail(`以下文件版本点未找到，中止（不写盘）：[${missing.join(', ')}]`);
    return 1;
  }

  for (const t of targets) {
    const filePath = path.join(ROOT, t.file);
    const text = fs.readFileSync(filePath, 'utf-8');
    let next =
      t.kind === 'json'
        ? replaceJsonVersionField(text, newVer)
        : t.kind === 'lock'
          ? replaceLockVersionField(text, newVer)
          : t.kind === 'skill' || t.kind === 'yaml'
            ? replaceYamlVersion(text, newVer, current)
            : replaceReadmeVersion(text, newVer, current);
    if (t.file === 'w-model-dev/skill-metadata.json') {
      next = next.replace(/"updatedAt":\s*"[^"]*"/, `"updatedAt": "${today}"`);
      log(`${t.label} 已更新为 ${newVer}（updatedAt → ${today}）`);
    } else {
      log(`${t.label} 已更新为 ${newVer}`);
    }
    fs.writeFileSync(filePath, next);
  }

  // CHANGELOG：在首个 `## [` 版本节头前插入新节头
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  const m = changelog.match(/^## \[/m);
  if (m === null) {
    fail('CHANGELOG.md 未找到版本节头，中止（其余已同步，需人工回滚）');
    return 1;
  }
  const eol = detectEol(changelog);
  const newHeader = `## [${newVer}] - ${today}${eol}${eol}- （条目由本次应用到该版本的 commit 作者填写）${eol}${eol}`;
  fs.writeFileSync(changelogPath, changelog.slice(0, m.index) + newHeader + changelog.slice(m.index));
  log(`CHANGELOG.md 已插入 ${newVer} 节头（${today}）`);

  log('完成。下一步：`npm run check:docs-consistency` 自验证七处版本一致 + 填写 CHANGELOG 条目标题/正文。');
  return 0;
}

/** SKILL.md / INSTALL.md 的 `version: <ver>` 行替换（YAML，行级，兼容 CRLF） */
function replaceYamlVersion(text, next) {
  return text.replace(/^(version: )\d+\.\d+\.\d+\s*$/gm, (_, prefix) => `${prefix}${next}`);
}

/** README「当前版本**：`<ver>`」行内版本 token 替换（相邻反引号保证唯一） */
function replaceReadmeVersion(text, next) {
  return text.replace(/当前版本\*\*：(`)\d+\.\d+\.\d+(`)/g, (_, open, close) => `当前版本**：${open}${next}${close}`);
}

if (require.main === module) {
  process.exitCode = run();
}

// 导出供外部调用（可选）；被直接执行时由上方 main-guard 生效
module.exports = { run };
