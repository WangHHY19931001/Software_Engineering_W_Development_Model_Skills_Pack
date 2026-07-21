import express, { type Express } from 'express';
import { authRoutes } from './routes/auth.routes.js';
import { articleRoutes } from './routes/article.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { userStore } from './stores/user.store.js';
import { articleStore } from './stores/article.store.js';
import { commentStore } from './stores/comment.store.js';
import './express-augmentation.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/articles', articleRoutes);
  app.use(errorHandler);
  return app;
}

export const app = createApp();

export { userStore, articleStore, commentStore };
