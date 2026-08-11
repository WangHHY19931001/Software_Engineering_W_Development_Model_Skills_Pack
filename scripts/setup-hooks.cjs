// 自动配置 core.hooksPath = .githooks（Windows 兼容；失败仅 warn 不阻断 install）
// 本仓库无云端 CI，本地 .githooks/pre-push 是唯一门禁（spec: docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md §3 B9）
const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');

try {
  // 兜底 1：非 git 仓库环境（如 tarball 安装 / 嵌套 node_modules 场景）直接跳过
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
} catch (e) {
  // 预检失败 = 非 git 仓库（区别于下方 git config 真实配置失败，仍仅 warn 不阻断 install）
  console.warn('[setup-hooks] 非 git 仓库，跳过 hooks 配置（非阻断）');
  process.exit(0);
}

try {
  // 兜底 2：仅当 .githooks/ 存在时才配置（npm install 时 cwd 为仓库根）
  if (existsSync('.githooks')) {
    execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
    console.log('[setup-hooks] core.hooksPath=.githooks 已配置');
  }
} catch (e) {
  console.warn('[setup-hooks] 配置 hooksPath 失败（非阻断）:', e.message);
}
