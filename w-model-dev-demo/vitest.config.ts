import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // 单元测试只统计纯逻辑层（services / stores / middleware / utils）；
      // HTTP 层（controllers / routes / app.ts / schemas）由集成/系统测试覆盖。
      include: [
        'src/services/**/*.ts',
        'src/stores/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
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
