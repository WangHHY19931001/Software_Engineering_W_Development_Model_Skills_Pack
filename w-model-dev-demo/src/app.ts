/**
 * Express app 装配：依赖注入 + 路由挂载 + errorHandler（阶段 5 编码）。
 * 测试通过 createApp() 拿到 app 实例与 deps（用于 store.clear() 隔离）。
 */
import express, { type Express } from 'express';
import './express-augmentation';
import { UserStore } from './stores/user.store';
import { ArticleStore } from './stores/article.store';
import { CommentStore } from './stores/comment.store';
import { PasswordHasher } from './utils/password';
import { JwtService } from './utils/jwt';
import { AuthService } from './services/user.service';
import { ArticleService } from './services/article.service';
import { CommentService } from './services/comment.service';
import { AuthController } from './controllers/auth.controller';
import { ArticleController } from './controllers/article.controller';
import { CommentController } from './controllers/comment.controller';
import { buildAuthRoutes } from './routes/auth.routes';
import { buildArticleRoutes } from './routes/article.routes';
import { errorHandler } from './middleware/error-handler';

export interface AppDeps {
  userStore: UserStore;
  articleStore: ArticleStore;
  commentStore: CommentStore;
  jwtService: JwtService;
  authService: AuthService;
  articleService: ArticleService;
  commentService: CommentService;
  authController: AuthController;
  articleController: ArticleController;
  commentController: CommentController;
}

export function createApp(): { app: Express; deps: AppDeps } {
  const userStore = new UserStore();
  const articleStore = new ArticleStore();
  const commentStore = new CommentStore();
  const passwordHasher = new PasswordHasher();
  const jwtService = new JwtService();

  const authService = new AuthService(userStore, passwordHasher, jwtService);
  const articleService = new ArticleService(articleStore, commentStore);
  const commentService = new CommentService(commentStore, articleService);

  const authController = new AuthController(authService);
  const articleController = new ArticleController(articleService);
  const commentController = new CommentController(commentService);

  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', buildAuthRoutes(authController));
  app.use('/api/v1', buildArticleRoutes(articleController, commentController, jwtService));
  app.use(errorHandler);

  const deps: AppDeps = {
    userStore,
    articleStore,
    commentStore,
    jwtService,
    authService,
    articleService,
    commentService,
    authController,
    articleController,
    commentController,
  };
  return { app, deps };
}
