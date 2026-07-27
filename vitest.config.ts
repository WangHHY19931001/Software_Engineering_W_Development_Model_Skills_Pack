// Vitest 配置：仅扫描技能包门禁脚本单元测试，不扫描 w-model-dev-demo/ 参考实现测试。
// demo 项目有自己的 vitest.config.ts，在 w-model-dev-demo/ 目录下独立运行（含 JWT_SECRET 注入）。
// 第十五轮发现：根目录 `npx vitest run` 默认扫描全仓库 *.test.ts，
// 会误扫 w-model-dev-demo/tests/ 导致缺 JWT_SECRET 注入的 465 个失败。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
export default {
  test: {
    include: ['w-model-dev/scripts/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'w-model-dev-demo/**'],
  },
};
