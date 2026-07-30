import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        // HTTP 层（app/router/entry）与未在单元测试覆盖的中间件 handle 方法
        // 由集成测试（TC-INT）覆盖，单元测试聚焦 service 领域逻辑
        'src/index.ts',
        'src/infrastructure/app.ts',
        'src/infrastructure/router.ts',
        'src/middleware/auth.middleware.ts',
        'src/middleware/validation.middleware.ts',
        'src/middleware/logging.middleware.ts',
        // repository 层为辅 seam（unit-test.md §1：辅 seam = repository 注入隔离内存 store），
        // 其完整 CRUD 方法覆盖由集成测试（TC-INT）承担；单元测试仅通过 service 间接调用部分方法
        'src/repositories/**/*.ts',
        // ErrorHandler 类（handle/wrap）属 HTTP 层错误响应格式化，由集成测试覆盖；
        // AppError/createAppError/invariant 为简单工具函数，通过 service 测试间接覆盖
        'src/infrastructure/error-handler.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
