/**
 * 服务器入口 —— 启动 HTTP 服务
 *
 * 必须设置 JWT_SECRET 环境变量（硬约束）。
 */
import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

function ensureJwtSecret(): void {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'required') {
    console.error('[FATAL] JWT_SECRET 环境变量必须设置');
    process.exit(1);
  }
}

function main(): void {
  ensureJwtSecret();
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`[blog-system-demo] listening on http://localhost:${PORT}`);
  });
  // 优雅关闭
  const shutdown = (signal: string): void => {
    console.log(`[blog-system-demo] received ${signal}, shutting down...`);
    server.close(() => {
      console.log('[blog-system-demo] closed');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
