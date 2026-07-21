import { createApp, createDeps } from './app.js';

/**
 * 服务入口。
 *
 * 启动前强制校验 `JWT_SECRET`（RISK-003 缓解措施）。
 * 缺失时立即退出（exit 1），避免在无密钥状态下运行。
 */
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('✗ JWT_SECRET 环境变量未设置，拒绝启动');
  process.exit(1);
}

const app = createApp(createDeps(secret));
const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`✓ blog-system-demo listening on http://localhost:${port}`);
});

server.on('error', err => {
  console.error('✗ 服务启动失败:', err);
  process.exit(1);
});

function shutdown(): void {
  server.close(() => {
    console.log('✓ 服务已关闭');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
