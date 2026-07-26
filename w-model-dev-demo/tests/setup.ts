/**
 * 单元测试全局 setup。
 * - 注入 JWT_SECRET 环境变量（CON-002 / NFR-002 安全约束）。
 * - 重置 ID 计数器，保证测试隔离。
 */
import { resetCounter } from '../src/utils/id.js';

if (!process.env['JWT_SECRET']) {
  process.env['JWT_SECRET'] = 'test-secret-blog-demo-32chars-min!!';
}

beforeEach(() => {
  resetCounter();
});
