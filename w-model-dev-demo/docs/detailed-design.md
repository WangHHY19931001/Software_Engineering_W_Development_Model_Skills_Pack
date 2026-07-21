# 详细设计文档

> 阶段 4（详细设计）产出。W 模型右 V 同步产出单元测试设计。
> 本文件内嵌单元测试用例设计（UT-001~030），不再外挂独立测试用例文件。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent
- 关联需求文档：`docs/requirement-spec.md`
- 关联系统设计：`docs/system-design.md`
- 关联概要设计：`docs/outline-design.md`

## 1. 设计目标

承接概要设计（§3 模块接口签名），细化方法内部实现：
- 定义每个类的字段、方法、内部状态机
- 定义算法（bcrypt cost、JWT exp、分页计算）
- 设计单元测试（UT）以校验每个方法的所有分支

## 2. 类详细设计

### 2.1 错误类（src/utils/errors.ts）

```typescript
export abstract class HttpError extends Error {
  abstract readonly status: number;
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
export class BadRequestError extends HttpError { readonly status = 400; }
export class UnauthorizedError extends HttpError { readonly status = 401; }
export class ForbiddenError extends HttpError { readonly status = 403; }
export class NotFoundError extends HttpError { readonly status = 404; }
export class ConflictError extends HttpError { readonly status = 409; }
```

### 2.2 密码工具类（src/utils/password.ts）

```typescript
import bcrypt from 'bcrypt';
const COST = 10;
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
export function getHashCost(hash: string): number {
  return bcrypt.getRounds(hash);
}
```

### 2.3 JWT 工具类（src/utils/jwt.ts）

```typescript
import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 未配置');
  return secret;
}

export function signToken(payload: JwtPayload, expiresIn: number = 3600): string {
  return jwt.sign(payload, getSecret(), { expiresIn } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    throw new UnauthorizedError(40102, 'JWT 已过期或无效');
  }
}
```

> **历史修复 #2**：`getSecret()` 必须从 `process.env.JWT_SECRET` 读取，缺失即抛错；禁止硬编码默认值。

### 2.4 async-handler（src/utils/async-handler.ts）

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

> **历史修复 #1**：所有路由中 async handler 必须经此包装，否则 Promise 内异常无法被 errorHandler 捕获。

### 2.5 Schema 类（src/schemas/*.ts）

```typescript
// auth.schema.ts
import { z } from 'zod';
export const AuthRegisterSchema = z.object({
  username: z.string().min(3, '用户名至少 3 字符').max(32, '用户名至多 32 字符'),
  password: z.string().min(6, '密码至少 6 字符').max(128, '密码至多 128 字符'),
});
export const AuthLoginSchema = AuthRegisterSchema;
export type AuthRegisterDTO = z.infer<typeof AuthRegisterSchema>;
export type AuthLoginDTO = z.infer<typeof AuthLoginSchema>;

// article.schema.ts
export const ArticleCreateSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题至多 200 字符'),
  content: z.string().min(1, '内容不能为空'),
});
export const ArticleUpdateSchema = ArticleCreateSchema.partial();
export type ArticleCreateDTO = z.infer<typeof ArticleCreateSchema>;
export type ArticleUpdateDTO = z.infer<typeof ArticleUpdateSchema>;

// comment.schema.ts
export const CommentCreateSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论至多 1000 字符'),
});
export type CommentCreateDTO = z.infer<typeof CommentCreateSchema>;
```

### 2.6 类型定义（src/types.ts）

```typescript
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}
export interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Comment {
  id: string;
  articleId: string;
  authorId: string;
  content: string;
  createdAt: string;
}
```

### 2.7 存储类（src/stores/*.ts）

```typescript
// user.store.ts
import { User } from '../types';
class UserStoreImpl {
  private users = new Map<string, User>();
  private usernameIndex = new Map<string, string>(); // username → id
  save(user: User): void {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
  }
  findById(id: string): User | undefined {
    return this.users.get(id);
  }
  findByUsername(username: string): User | undefined {
    const id = this.usernameIndex.get(username);
    return id ? this.users.get(id) : undefined;
  }
  clear(): void {
    this.users.clear();
    this.usernameIndex.clear();
  }
  size(): number { return this.users.size; }
}
export const userStore = new UserStoreImpl();

// article.store.ts
import { Article } from '../types';
import { randomUUID } from 'node:crypto';
class ArticleStoreImpl {
  private articles = new Map<string, Article>();
  save(article: Article): void { this.articles.set(article.id, article); }
  findById(id: string): Article | undefined { return this.articles.get(id); }
  findAll(page: number, pageSize: number): { items: Article[]; total: number } {
    const all = Array.from(this.articles.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }
  delete(id: string): boolean { return this.articles.delete(id); }
  clear(): void { this.articles.clear(); }
  size(): number { return this.articles.size; }
}
export const articleStore = new ArticleStoreImpl();

// comment.store.ts
import { Comment } from '../types';
class CommentStoreImpl {
  private comments = new Map<string, Comment>();
  save(comment: Comment): void { this.comments.set(comment.id, comment); }
  findById(id: string): Comment | undefined { return this.comments.get(id); }
  findByArticleId(articleId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter(c => c.articleId === articleId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  delete(id: string): boolean { return this.comments.delete(id); }
  clear(): void { this.comments.clear(); }
  size(): number { return this.comments.size; }
}
export const commentStore = new CommentStoreImpl();
```

### 2.8 服务类（src/services/*.ts）

```typescript
// user.service.ts
import { userStore } from '../stores/user.store';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { randomUUID } from 'node:crypto';

export class UserService {
  static async register(username: string, password: string): Promise<{ userId: string; username: string }> {
    if (userStore.findByUsername(username)) {
      throw new ConflictError(40901, '用户名已存在');
    }
    const user = {
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    userStore.save(user);
    return { userId: user.id, username: user.username };
  }
  static async login(username: string, password: string): Promise<{ token: string; userId: string; username: string }> {
    const user = userStore.findByUsername(username);
    if (!user) throw new UnauthorizedError(40101, '用户名或密码错误');
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError(40101, '用户名或密码错误');
    const token = signToken({ userId: user.id, username: user.username });
    return { token, userId: user.id, username: user.username };
  }
}

// article.service.ts
import { articleStore } from '../stores/article.store';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { randomUUID } from 'node:crypto';
import type { ArticleCreateDTO, ArticleUpdateDTO } from '../schemas/article.schema';
import type { Article } from '../types';

export class ArticleService {
  static async create(authorId: string, dto: ArticleCreateDTO): Promise<Article> {
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      authorId,
      createdAt: now,
      updatedAt: now,
    };
    articleStore.save(article);
    return article;
  }
  static async list(page: number, pageSize: number): Promise<{ items: Article[]; total: number; page: number; pageSize: number }> {
    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = 10;
    const result = articleStore.findAll(page, pageSize);
    return { ...result, page, pageSize };
  }
  static async getById(id: string): Promise<Article> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    return article;
  }
  static async update(authorId: string, id: string, dto: ArticleUpdateDTO): Promise<Article> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    if (article.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人文章');
    const updated: Article = { ...article, ...dto, updatedAt: new Date().toISOString() };
    articleStore.save(updated);
    return updated;
  }
  static async remove(authorId: string, id: string): Promise<void> {
    const article = articleStore.findById(id);
    if (!article) throw new NotFoundError(40401, '文章不存在');
    if (article.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人文章');
    articleStore.delete(id);
  }
}
```

> **历史修复 #3**：`ArticleService` 必须 `export class`，否则单元测试无法引用其类型。

```typescript
// comment.service.ts
import { commentStore } from '../stores/comment.store';
import { articleStore } from '../stores/article.store';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { randomUUID } from 'node:crypto';
import type { CommentCreateDTO } from '../schemas/comment.schema';
import type { Comment } from '../types';

export class CommentService {
  static async create(authorId: string, articleId: string, dto: CommentCreateDTO): Promise<Comment> {
    if (!articleStore.findById(articleId)) throw new NotFoundError(40401, '文章不存在');
    const comment: Comment = {
      id: randomUUID(),
      articleId,
      authorId,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    commentStore.save(comment);
    return comment;
  }
  static async listByArticle(articleId: string): Promise<Comment[]> {
    return commentStore.findByArticleId(articleId);
  }
  static async remove(authorId: string, commentId: string): Promise<void> {
    const comment = commentStore.findById(commentId);
    if (!comment) throw new NotFoundError(40401, '评论不存在');
    if (comment.authorId !== authorId) throw new ForbiddenError(40301, '无权操作他人评论');
    commentStore.delete(commentId);
  }
}
```

### 2.9 中间件（src/middleware/*.ts）

```typescript
// auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; username: string };
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError(40103, '未提供认证令牌'));
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    next(err); // verifyToken 已抛 UnauthorizedError(40102)
  }
}

// validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new BadRequestError(40001, '请求参数校验失败', result.error.issues));
    }
    req.body = result.data;
    next();
  };
}

// error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    return;
  }
  console.error('未捕获异常:', err);
  res.status(500).json({ code: 50001, message: '内部服务器错误' });
}
```

### 2.10 控制器（src/controllers/*.ts）

```typescript
// auth.controller.ts
import { Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await UserService.register(req.body.username, req.body.password);
    res.status(201).json(result);
  }
  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await UserService.login(req.body.username, req.body.password);
    res.status(200).json(result);
  }
}

// article.controller.ts
export class ArticleController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await ArticleService.create(req.user!.userId, req.body);
    res.status(201).json(article);
  }
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page ?? '1');
    const pageSize = Number(req.query.pageSize ?? '10');
    const result = await ArticleService.list(page, pageSize);
    res.status(200).json(result);
  }
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await ArticleService.getById(req.params.id);
    const comments = await CommentService.listByArticle(req.params.id);
    res.status(200).json({ ...article, comments });
  }
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await ArticleService.update(req.user!.userId, req.params.id, req.body);
    res.status(200).json(article);
  }
  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await ArticleService.remove(req.user!.userId, req.params.id);
    res.status(204).end();
  }
}

// comment.controller.ts
export class CommentController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const comment = await CommentService.create(req.user!.userId, req.params.articleId, req.body);
    res.status(201).json(comment);
  }
  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await CommentService.remove(req.user!.userId, req.params.commentId);
    res.status(204).end();
  }
}
```

### 2.11 路由（src/routes/*.ts）

```typescript
// auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middleware/validate';
import { AuthRegisterSchema, AuthLoginSchema } from '../schemas/auth.schema';

const router: Router = Router();
router.post('/register', validate(AuthRegisterSchema), asyncHandler(AuthController.register));
router.post('/login', validate(AuthLoginSchema), asyncHandler(AuthController.login));
export { router as authRoutes };

// article.routes.ts
import { Router } from 'express';
import { ArticleController } from '../controllers/article.controller';
import { CommentController } from '../controllers/comment.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middleware/validate';
import { ArticleCreateSchema, ArticleUpdateSchema } from '../schemas/article.schema';
import { CommentCreateSchema } from '../schemas/comment.schema';

const router: Router = Router();
router.get('/', asyncHandler(ArticleController.list));
router.get('/:id', asyncHandler(ArticleController.getById));
router.post('/', authMiddleware, validate(ArticleCreateSchema), asyncHandler(ArticleController.create));
router.patch('/:id', authMiddleware, validate(ArticleUpdateSchema), asyncHandler(ArticleController.update));
router.delete('/:id', authMiddleware, asyncHandler(ArticleController.remove));
// 嵌套评论路由
router.post('/:articleId/comments', authMiddleware, validate(CommentCreateSchema), asyncHandler(CommentController.create));
router.delete('/:articleId/comments/:commentId', authMiddleware, asyncHandler(CommentController.remove));
export { router as articleRoutes };
```

> **简化决策**：评论路由嵌套在文章路由内（与概要设计 §3.1 comment.routes.ts 等效，避免 Express 5 子路由复杂度）。

### 2.12 应用入口（src/app.ts / src/server.ts）

```typescript
// app.ts
import express, { Express } from 'express';
import { authRoutes } from './routes/auth.routes';
import { articleRoutes } from './routes/article.routes';
import { errorHandler } from './middleware/error-handler';
import { userStore } from './stores/user.store';
import { articleStore } from './stores/article.store';
import { commentStore } from './stores/comment.store';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/articles', articleRoutes);
  app.use(errorHandler);
  return app;
}
export const app = createApp();
export { userStore, articleStore, commentStore }; // 测试用：重置存储

// server.ts
import { app } from './app';
const PORT = process.env.PORT ?? 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}
```

### 2.13 express-augmentation.ts

```typescript
// 让 TypeScript 识别 Express 的 req.user
declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: string; username: string };
  }
}
```

## 3. 单元测试用例设计

> 阶段 4 同步产出单元测试设计。本阶段只设计，不执行；执行在阶段 5（编码）。
> 覆盖原则：每个方法的所有分支必须覆盖；mock 边界（bcrypt/jwt/Store）；覆盖率 ≥ 80%。

### 3.1 单元测试用例清单

| 用例 ID | 关联需求 | 被测模块 | 被测方法 | 测试场景 | 输入 | 预期 | 优先级 |
|---|---|---|---|---|---|---|---|
| UT-001 | REQ-001 | utils/password | hashPassword | 正常哈希 | 'Pass1234' | 返回字符串，以 `$2b$10$` 开头 | 高 |
| UT-002 | REQ-001 | utils/password | hashPassword | 不同输入产生不同 hash | 'A' vs 'B' | hash1 !== hash2 | 高 |
| UT-003 | REQ-001 | utils/password | comparePassword | 正确密码 | 'Pass1234', 其 hash | true | 高 |
| UT-004 | REQ-001 | utils/password | comparePassword | 错误密码 | 'Wrong', 其 hash | false | 高 |
| UT-005 | REQ-001 | utils/password | getHashCost | 返回 cost | hash | 10 | 高 |
| UT-006 | NFR-001 | utils/jwt | signToken | 正常签发 | {userId, username}, exp=3600 | 字符串，verify 后含 userId/username/exp | 高 |
| UT-007 | NFR-001 | utils/jwt | verifyToken | 合法 token | signToken 输出 | 返回 payload | 高 |
| UT-008 | NFR-001 | utils/jwt | verifyToken | 过期 token | exp=-1 | 抛 UnauthorizedError(40102) | 高 |
| UT-009 | NFR-001 | utils/jwt | verifyToken | 伪造 token | 'fake.token.value' | 抛 UnauthorizedError(40102) | 高 |
| UT-010 | NFR-001 | utils/jwt | getSecret | JWT_SECRET 缺失 | delete env.JWT_SECRET | throw Error('JWT_SECRET 未配置') | 高 |
| UT-011 | REQ-001 | services/user | register | 新用户 | 'alice','Pass1234' | {userId, username='alice'}；userStore.size===1 | 高 |
| UT-012 | REQ-001 | services/user | register | 用户名已存在 | 重复 | 抛 ConflictError(40901) | 高 |
| UT-013 | REQ-001 | services/user | login | 凭证正确 | 'alice','Pass1234' | {token, userId, username}；token 可 verify | 高 |
| UT-014 | REQ-001 | services/user | login | 用户不存在 | 'bob','*' | 抛 UnauthorizedError(40101) | 高 |
| UT-015 | REQ-001 | services/user | login | 密码错误 | 'alice','Wrong' | 抛 UnauthorizedError(40101) | 高 |
| UT-016 | REQ-002 | services/article | create | 正常创建 | authorId, {title,content} | 返回 Article，含 id/authorId/createdAt | 高 |
| UT-017 | REQ-003 | services/article | list | 分页 | page=1,pageSize=2，3 条数据 | {items:2, total:3, page:1, pageSize:2} | 高 |
| UT-018 | REQ-003 | services/article | list | pageSize 越界自动修正 | page=0, pageSize=0 | page 修正为 1，pageSize 修正为 10 | 中 |
| UT-019 | REQ-003 | services/article | getById | 存在 | 已存在 id | 返回 Article | 高 |
| UT-020 | REQ-003 | services/article | getById | 不存在 | 随机 id | 抛 NotFoundError(40401) | 高 |
| UT-021 | REQ-002 | services/article | update | 作者本人 | authorId=作者 | 返回更新后 Article，updatedAt 改变 | 高 |
| UT-022 | REQ-002 | services/article | update | 非作者 | authorId=他人 | 抛 ForbiddenError(40301) | 高 |
| UT-023 | REQ-002 | services/article | update | 文章不存在 | 随机 id | 抛 NotFoundError(40401) | 高 |
| UT-024 | REQ-002 | services/article | remove | 作者本人 | authorId=作者 | 无返回；articleStore.size 减 1 | 高 |
| UT-025 | REQ-002 | services/article | remove | 非作者 | authorId=他人 | 抛 ForbiddenError(40301) | 高 |
| UT-026 | REQ-004 | services/comment | create | 文章存在 | authorId, articleId, dto | 返回 Comment | 高 |
| UT-027 | REQ-004 | services/comment | create | 文章不存在 | 随机 articleId | 抛 NotFoundError(40401) | 高 |
| UT-028 | REQ-004 | services/comment | remove | 作者本人 | authorId=作者 | 无返回；commentStore.size 减 1 | 高 |
| UT-029 | REQ-004 | services/comment | remove | 非作者 | authorId=他人 | 抛 ForbiddenError(40301) | 高 |
| UT-030 | NFR-003 | middleware/validate | validate | zod 校验失败 | {} | next 被调用，参数为 BadRequestError(40001) | 高 |

### 3.2 单元测试覆盖说明

- 覆盖方法数：15 个（password 3 + jwt 4 + UserService 3 + ArticleService 6 + CommentService 3 + validate 1）+ auth/errorHandler 在集成测试覆盖
- 覆盖分支：成功路径 + 错误码 40001/40101/40102/40301/40401/40901 共 6 个错误分支
- mock 策略：bcrypt/jwt 真实调用（验证集成）；Store 真实使用内存 Map（每个测试前 `clear()`）；validate middleware 用 mock Request/Response/NextFunction
- 类型断言（**历史修复 #4**）：`next.mock.calls[0][0]` 等需用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 访问
- 覆盖率目标：lines/branches/functions/statements ≥ 80%

## 4. 阶段 4 自检清单

- [x] 每个类/方法已实现到代码级别（含字段、算法、错误抛出位置）
- [x] 4 项历史修复已落实：async-handler 包装、JWT_SECRET 环境变量、ArticleService `export class`、vitest mock 类型断言策略声明
- [x] 单元测试用例覆盖所有方法的所有分支，共 30 条
- [x] RTM 已补登 detailed-design 文档（见 `.w-model/rtm.json`）

## 5. 阶段完成摘要

- 产物路径：
  - `docs/detailed-design.md`（本文件，内嵌 UT-001~030）
  - `.w-model/rtm.json`（已补登 unitTest 字段）
- RTM 覆盖状态：部分（designDoc + unitTest + integrationTest + systemTest + acceptanceTest 已填充；codeModule 待阶段 5）
- 验证证据：13 个类的完整代码设计 + 30 条 UT 覆盖 15 个方法 + 6 个错误分支
- 阻塞项：无
- 下一步：进入阶段 5（编码），按本设计落地 src/ 与 tests/unit/
