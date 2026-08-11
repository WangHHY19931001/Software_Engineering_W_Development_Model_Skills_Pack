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
};
