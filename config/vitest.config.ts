// Vitest 配置：仅扫描技能包门禁脚本单元测试。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
//
// testTimeout 说明：部分测试用 execSync 启动 `npx tsx <script>` 子进程（CLI 集成测试）。
// 在 WSL（Windows Subsystem for Linux）下访问 /mnt/d 挂载的 node_modules 冷启动较慢，
// 单次子进程可能超过默认 5000ms 超时（Windows 原生无此问题）。调大上限不影响 Windows 表现。
export default {
  test: {
    include: ['w-model-dev/scripts/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  // 覆盖率门禁：仅统计门禁核心实现（logic/ + lib/），不包括 CLI 入口与 __tests__。
  // include 与 test.include 一样相对仓库根解析（cwd=仓库根）。
  // thresholds 基线 = 2026-08-12 实测（logic+lib 合并）：stmts 75.32 / branch 66.57 / funcs 85.5 / lines 76.62，
  // 取实际值向下取整到 5 的倍数，随测试补充逐步上调。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    thresholds: { statements: 75, branches: 65, functions: 85, lines: 75 },
  },
};
