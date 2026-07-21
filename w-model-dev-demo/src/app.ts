import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { UserStore } from './stores/user.store.js';
import { ArticleStore } from './stores/article.store.js';
import { CommentStore } from './stores/comment.store.js';
import { PasswordUtils } from './utils/password.js';
import { JwtUtils } from './utils/jwt.js';
import { UserService } from './services/user.service.js';
import { ArticleService } from './services/article.service.js';
import { CommentService } from './services/comment.service.js';
import { AuthMiddleware } from './middleware/auth.js';
import { ErrorHandler } from './middleware/error-handler.js';
import { AuthController } from './controllers/auth.controller.js';
import { ArticleController } from './controllers/article.controller.js';
import { CommentController } from './controllers/comment.controller.js';
import { buildAuthRoutes } from './routes/auth.routes.js';
import { buildArticleRoutes } from './routes/article.routes.js';
import { NotFoundError } from './utils/errors.js';

/**
 * Express 应用装配（composition root）。
 *
 * 设计来源：`docs/system-design.md` §1.1 / §3（M-008 应用入口）。
 * 单例依赖在此处一次性创建并注入；stores / utils 为内存对象（CON-002）。
 *
 * 通过 `createApp` 工厂函数创建，便于集成测试在每个用例中重建干净实例。
 */
export interface AppDeps {
  userStore: UserStore;
  articleStore: ArticleStore;
  commentStore: CommentStore;
  passwordUtils: PasswordUtils;
  jwtUtils: JwtUtils;
  userService: UserService;
  articleService: ArticleService;
  commentService: CommentService;
  authMiddleware: AuthMiddleware;
  errorHandler: ErrorHandler;
  authController: AuthController;
  articleController: ArticleController;
  commentController: CommentController;
}

export function createDeps(jwtSecret: string = process.env.JWT_SECRET ?? ''): AppDeps {
  const userStore = new UserStore();
  const articleStore = new ArticleStore();
  const commentStore = new CommentStore();
  const passwordUtils = new PasswordUtils();
  const jwtUtils = new JwtUtils(jwtSecret, 3600);
  const userService = new UserService(userStore, passwordUtils, jwtUtils);
  const articleService = new ArticleService(articleStore, commentStore);
  const commentService = new CommentService(commentStore, articleService);
  const authMiddleware = new AuthMiddleware(jwtUtils);
  const errorHandler = new ErrorHandler();
  const authController = new AuthController(userService);
  const articleController = new ArticleController(articleService);
  const commentController = new CommentController(commentService);
  return {
    userStore,
    articleStore,
    commentStore,
    passwordUtils,
    jwtUtils,
    userService,
    articleService,
    commentService,
    authMiddleware,
    errorHandler,
    authController,
    articleController,
    commentController,
  };
}

export function createApp(deps: AppDeps = createDeps()): express.Express {
  const app = express();
  app.use(express.json());

  app.use('/api/v1/auth', buildAuthRoutes(deps.authController));
  app.use(
    '/api/v1/articles',
    buildArticleRoutes(deps.articleController, deps.commentController, deps.authMiddleware),
  );

  // 测试维护端点：重置内存存储（RISK-001 缓解措施；仅 demo / 测试场景使用）
  app.post('/__test/reset', (_req, res) => {
    deps.userStore.clear();
    deps.articleStore.clear();
    deps.commentStore.clear();
    res.status(204).send();
  });

  // 404
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`路由不存在: ${req.method} ${req.path}`));
  });

  // 统一错误处理（必须 4 参数才会被 Express 识别为错误处理中间件）
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    deps.errorHandler.handle(err, req, res, next),
  );

  return app;
}

/**
 * 单例 app + deps，供集成 / 系统 / 验收测试通过 `import { app, deps } from '../../src/app.js'` 引入真实实例。
 * - `app`：真实 Express 应用（不 mock 任何控制器 / 服务 / 存储）。
 * - `deps`：暴露 stores / services 引用，便于测试断言存储状态（如 passwordHash 前缀、级联删除）。
 *
 * 单进程 Node 模块缓存保证全测试套件共享同一实例；测试用例通过 `POST /__test/reset`
 * 端点重置 3 个内存 Store，避免用例间数据污染。
 *
 * 生产入口 `src/server.ts` 不使用本单例（自行 `createApp(createDeps(secret))`），
 * 因此 `JWT_SECRET` 缺失时本单例的 `jwtUtils` 会以空 secret 构造，仅在测试场景下使用。
 */
export const deps = createDeps();
export const app = createApp(deps);
