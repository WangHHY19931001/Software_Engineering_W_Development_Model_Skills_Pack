#!/usr/bin/env bash
# 平台原生依赖检查（ensure-platform-deps）
#
# 默认与 --check 只检查当前平台所需的原生包，绝不修改 node_modules。
# --install 仅在用户显式调用时通过当前 checkout 的本地 CLI 修复缺失包。

set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

usage() {
  printf '用法：bash .githooks/ensure-platform-deps.sh [--check|--install]\n'
}

mode="check"
case "$#:${1:-}" in
  0:*) ;;
  1:--check) ;;
  1:--install) mode="install" ;;
  *)
    usage
    exit 2
    ;;
esac

log()  { printf '[ensure-deps] %s\n' "$*"; }
ok()   { printf '[ensure-deps] \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '[ensure-deps] \033[31m✗\033[0m %s\n' "$*"; }

if ! command -v node >/dev/null 2>&1; then
  fail "未找到 node，无法检查平台依赖"
  exit 1
fi

PLATFORM="$(node -e 'console.log(process.platform)' 2>/dev/null || printf 'unknown')"
ARCH="$(node -e 'console.log(process.arch)' 2>/dev/null || printf 'unknown')"

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
    fail "未覆盖平台 ${PLATFORM}-${ARCH}，请手动运行 npm install"
    exit 1
    ;;
esac

ESBUILD_VER="$(node -e 'try{console.log(require("esbuild/package.json").version)}catch(e){console.log("")}' 2>/dev/null)"
ROLLDOWN_VER="$(node -e 'try{console.log(require("rolldown/package.json").version)}catch(e){console.log("")}' 2>/dev/null)"

if [ -z "$ESBUILD_VER" ] || [ -z "$ROLLDOWN_VER" ]; then
  fail "esbuild / rolldown 主包缺失，请先运行 npm install"
  exit 1
fi

MISSING=""
[ -d "node_modules/$ESBUILD_PKG" ] || MISSING="${MISSING} ${ESBUILD_PKG}"
[ -d "node_modules/$ROLLDOWN_PKG" ] || MISSING="${MISSING} ${ROLLDOWN_PKG}"

if [ -z "$MISSING" ]; then
  ok "平台依赖齐备（${PLATFORM}-${ARCH}）"
  exit 0
fi

fail "平台依赖缺失：${MISSING}"
if [ "$mode" != "install" ]; then
  fail "请运行：npm run platform-deps:install"
  exit 1
fi

LOCKFILE="$(pwd)/package-lock.json"
CLI_SCRIPT="$(pwd)/w-model-dev/scripts/cli/platform-deps-install.ts"
LOCAL_TSX="$(pwd)/node_modules/.bin/tsx"
if command -v cygpath >/dev/null 2>&1; then
  LOCKFILE="$(cygpath -w "$LOCKFILE")"
fi

if [ ! -f "package-lock.json" ]; then
  fail "缺少 package-lock.json，无法执行可验证平台修复"
  exit 1
fi
if [ ! -f "$CLI_SCRIPT" ] || [ ! -x "$LOCAL_TSX" ]; then
  fail "缺少当前 checkout 的本地 platform-deps-install CLI 或 tsx runtime"
  exit 1
fi

set -- "--lockfile=$LOCKFILE"
for PACKAGE in $MISSING; do
  set -- "$@" "--package=$PACKAGE"
done
if ! "$LOCAL_TSX" "$CLI_SCRIPT" "$@"; then
  fail "平台依赖补装失败（CLI exit 非零）"
  exit 1
fi

REMAINING=""
[ -d "node_modules/$ESBUILD_PKG" ] || REMAINING="${REMAINING} ${ESBUILD_PKG}"
[ -d "node_modules/$ROLLDOWN_PKG" ] || REMAINING="${REMAINING} ${ROLLDOWN_PKG}"
if [ -n "$REMAINING" ]; then
  fail "平台依赖补装后仍缺失：${REMAINING}"
  exit 1
fi

ok "平台依赖补装完成并复查通过（${PLATFORM}-${ARCH}）"
exit 0
