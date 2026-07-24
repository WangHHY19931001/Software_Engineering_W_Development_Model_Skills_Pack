// Express 应用入口：挂载路由 + 中间件 + 错误处理
// 对应 system-design.md §1 分层架构
import express from 'express';
import './express-augmentation.js';
import { authRoutes } from './routes/auth.routes';
import { articleRoutes } from './routes/article.routes';
import { handleError } from './middleware/error.middleware';

export function createApp(): express.Application {
  const app = express();

  // JSON 解析中间件
  app.use(express.json());

  // 路由挂载
  app.use('/api/auth', authRoutes);
  app.use('/api/articles', articleRoutes);

  // 健康检查端点
  app.get('/health', (_req, res) => {
    res.status(200).json({ code: 0, message: 'ok' });
  });

  // 全局错误处理中间件（必须最后挂载）
  app.use(handleError);

  return app;
}

export const app = createApp();
