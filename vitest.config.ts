// Vitest 配置：仅扫描技能包门禁脚本单元测试。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
export default {
  test: {
    include: ['w-model-dev/scripts/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
};
