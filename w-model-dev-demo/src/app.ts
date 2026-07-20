import express from 'express';
import { authRouter } from './routes/auth-routes.js';
import { articleRouter } from './routes/article-routes.js';
import { commentRouter } from './routes/comment-routes.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/articles', articleRouter);
app.use('/api/articles/:id/comments', commentRouter);

app.use(errorHandler);

export default app;
