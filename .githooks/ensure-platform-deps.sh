#!/usr/bin/env bash
# 平台依赖自动补装（ensure-platform-deps）
#
# 背景：esbuild / rolldown 等包通过 optionalDependencies 按平台安装原生二进制。
#       仓库 node_modules 在 Windows 侧安装时只含 win32 二进制；在 WSL/Linux 侧
#       运行时需要 linux 二进制。若直接在 WSL 里 `npm install`，npm 会按当前平台
#       重解析依赖树，删除另一平台的包（实测：装 linux rolldown 后 win32 esbuild 被删）。
#       因此本脚本采用「npm pack + tar 解压」方式补装缺失平台包，**绕过 npm 依赖树**，
#       保证 Windows / WSL 双平台二进制共存，互不破坏。
#
# 用法：
#   bash .githooks/ensure-platform-deps.sh [--check-only]
#     --check-only  仅检查并报告缺失，不安装（退出码 0=齐备 1=缺失）
#
# 由 .githooks/pre-push 在跑门禁前自动调用；也可手动执行。

set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

CHECK_ONLY=0
if [ "${1:-}" = "--check-only" ]; then
  CHECK_ONLY=1
fi

log()  { printf '[ensure-deps] %s\n' "$*"; }
ok()   { printf '[ensure-deps] \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '[ensure-deps] \033[33m⚠\033[0m %s\n' "$*"; }
fail() { printf '[ensure-deps] \033[31m✗\033[0m %s\n' "$*"; }

# 无 node 时无法判定平台，跳过（后续门禁会给出明确报错）
if ! command -v node >/dev/null 2>&1; then
  warn "未找到 node，跳过平台依赖检查"
  exit 0
fi

PLATFORM="$(node -e 'console.log(process.platform)' 2>/dev/null || echo unknown)"
ARCH="$(node -e 'console.log(process.arch)' 2>/dev/null || echo unknown)"

# 平台 → 需要补装的包名映射（仅覆盖本项目实际使用的原生二进制包）
case "${PLATFORM}-${ARCH}" in
  win32-x64)
    ESBUILD_PKG="@esbuild/win32-x64"
    ROLLDOWN_PKG="@rolldown/binding-win32-x64-msvc"
    ;;
  linux-x64)
    ESBUILD_PKG="@esbuild/linux-x64"
    ROLLDOWN_PKG="@rolldown/binding-linux-x64-gnu"
    ;;
  *)
    warn "未覆盖平台 ${PLATFORM}-${ARCH}，跳过平台依赖检查"
    exit 0
    ;;
esac

# 读取已安装包的版本（与 node_modules 中 esbuild / rolldown 主包严格对齐）
ESBUILD_VER="$(node -e 'try{console.log(require("esbuild/package.json").version)}catch(e){console.log("")}' 2>/dev/null)"
ROLLDOWN_VER="$(node -e 'try{console.log(require("rolldown/package.json").version)}catch(e){console.log("")}' 2>/dev/null)"

if [ -z "$ESBUILD_VER" ] || [ -z "$ROLLDOWN_VER" ]; then
  warn "esbuild / rolldown 主包未安装，跳过平台依赖检查（请先 npm install）"
  exit 0
fi

MISSING=""
[ -d "node_modules/$ESBUILD_PKG" ] || MISSING="${MISSING} ${ESBUILD_PKG}@${ESBUILD_VER}"
[ -d "node_modules/$ROLLDOWN_PKG" ] || MISSING="${MISSING} ${ROLLDOWN_PKG}@${ROLLDOWN_VER}"

if [ -z "$MISSING" ]; then
  ok "平台依赖齐备（${PLATFORM}-${ARCH}）"
  exit 0
fi

if [ "$CHECK_ONLY" = "1" ]; then
  fail "平台依赖缺失：${MISSING}"
  fail "请运行：bash .githooks/ensure-platform-deps.sh"
  exit 1
fi

warn "平台依赖缺失：${MISSING}"
warn "正在通过 npm pack + tar 解压补装（绕过 npm 依赖树，不影响另一平台二进制）..."

TMPDIR_DEPS="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_DEPS"' EXIT
FAILED=0

for SPEC in $MISSING; do
  PKG_NAME="${SPEC%@*}"
  log "下载并安装 ${SPEC} ..."
  if ! (cd "$TMPDIR_DEPS" && npm pack "$SPEC" --pack-destination "$TMPDIR_DEPS" >/dev/null 2>&1); then
    fail "npm pack ${SPEC} 失败（可能无网络或版本不存在）"
    FAILED=1
    continue
  fi
  TGZ="$(ls "$TMPDIR_DEPS"/*.tgz 2>/dev/null | head -1)"
  if [ -z "$TGZ" ]; then
    fail "未找到 ${SPEC} 的 tarball"
    FAILED=1
    continue
  fi
  rm -rf "$TMPDIR_DEPS/extract"
  mkdir -p "$TMPDIR_DEPS/extract"
  if ! tar -xzf "$TGZ" -C "$TMPDIR_DEPS/extract" 2>/dev/null; then
    fail "解压 ${TGZ} 失败"
    FAILED=1
    continue
  fi
  # tgz 内为 package/ 目录；目标 = node_modules/<pkg-name>
  DEST_DIR="node_modules/$PKG_NAME"
  rm -rf "$DEST_DIR"
  mkdir -p "$(dirname "$DEST_DIR")"
  cp -r "$TMPDIR_DEPS/extract/package" "$DEST_DIR"
  rm -f "$TGZ"
  ok "${SPEC} 补装完成"
done

if [ "$FAILED" -ne 0 ]; then
  fail "平台依赖补装存在失败项，请检查网络或手动安装：${MISSING}"
  exit 1
fi

# 回归验证：esbuild 真实 transform + rolldown binding 可加载
log "验证补装结果..."
node -e 'const e=require("esbuild"); e.transform("const x:number=1",{loader:"ts"}).then(()=>console.log("  esbuild transform OK")).catch(()=>process.exit(1))' 2>/dev/null || { fail "esbuild 验证失败"; exit 1; }
ok "esbuild transform OK"

exit 0
