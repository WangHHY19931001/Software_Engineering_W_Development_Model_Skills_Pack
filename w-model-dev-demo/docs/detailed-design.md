# 详细设计文档

> 阶段 4（详细设计）产出。项目：博客系统（W 模型端到端调测）。
> 关联：[outline-design.md](./outline-design.md)（概要设计）

## 1. 文件结构

```
w-model-dev-demo/
├── src/
│   ├── server.ts                    # 应用入口：组装 app + 监听端口
│   ├── app.ts                       # Express 实例 + 路由挂载 + 错误中间件
│   ├── routes/
│   │   ├── auth-routes.ts           # /api/auth/register + /api/auth/login
│   │   ├── article-routes.ts        # /api/articles CRUD
│   │   └── comment-routes.ts        # /api/articles/:id/comments
│   ├── controllers/
│   │   ├── user-controller.ts
│   │   ├── article-controller.ts
│   │   └── comment-controller.ts
│   ├── services/
│   │   ├── user-service.ts          # bcrypt + jwt
│   │   ├── article-service.ts       # Map 存储 + 作者隔离
│   │   └── comment-service.ts       # Map 存储 + 文章存在校验
│   ├── stores/
│   │   ├── user-store.ts            # Map<username, User>
│   │   ├── article-store.ts         # Map<id, Article>
│   │   └── comment-store.ts         # Map<id, Comment> + 索引 by articleId
│   ├── middleware/
│   │   ├── auth.ts                  # JWT 校验中间件
│   │   └── error-handler.ts         # 统一错误处理
│   ├── schemas/
│   │   ├── user-schema.ts           # zod schema: register / login
│   │   ├── article-schema.ts        # zod schema: create / update
│   │   └── comment-schema.ts        # zod schema: create
│   ├── utils/
│   │   ├── errors.ts                # AppError + 5 个子类
│   │   └── env.ts                   # 读取 JWT_SECRET / PORT
│   └── types.ts                     # 共享类型：User / Article / Comment
└── tests/
    ├── unit/
    │   ├── user-service.test.ts
    │   ├── article-service.test.ts
    │   ├── comment-service.test.ts
    │   ├── auth-middleware.test.ts
    │   └── error-handler.test.ts
    ├── integration/
    │   └── *.test.ts                # 阶段 6 编写
    └── system/
        └── *.test.ts                # 阶段 7 编写
```

## 2. 类与数据结构

### 2.1 类型定义（src/types.ts）

```typescript
export interface User {
  id: string;
  username: string;
  passwordHash: string;  // bcrypt 哈希，不存明文
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
  content: string;
  authorId: string;
  createdAt: string;
}
```

### 2.2 Store 层（src/stores/*.ts）

#### UserStore
```typescript
class UserStore {
  private byUsername = new Map<string, User>();
  private byId = new Map<string, User>();

  insert(user: User): void;            // 若 username 已存在抛 ConflictError
  findByUsername(username: string): User | undefined;
  findById(id: string): User | undefined;
  clear(): void;                        // 测试用
}
export const userStore = new UserStore();
```

#### ArticleStore
```typescript
class ArticleStore {
  private byId = new Map<string, Article>();

  insert(article: Article): void;
  findById(id: string): Article | undefined;
  update(id: string, patch: Partial<Article>): Article;  // 不存在抛 NotFoundError
  remove(id: string): void;                               // 不存在抛 NotFoundError
  list(): Article[];
  clear(): void;
}
export const articleStore = new ArticleStore();
```

#### CommentStore
```typescript
class CommentStore {
  private byId = new Map<string, Comment>();
  private byArticle = new Map<string, Comment[]>();

  insert(comment: Comment): void;
  listByArticle(articleId: string): Comment[];
  clear(): void;
}
export const commentStore = new CommentStore();
```

### 2.3 Service 层

#### UserService
```typescript
class UserService {
  async register(input: { username: string; password: string }): Promise<{ userId: string }>;
  // 1. 检查 username 不重复（UserStore.findByUsername）
  // 2. bcrypt.hash(password, 10) → passwordHash
  // 3. userStore.insert({ id: randomUUID(), username, passwordHash, createdAt })
  // 4. 返回 { userId }

  async login(input: { username: string; password: string }): Promise<{ token: string }>;
  // 1. userStore.findByUsername → 不存在抛 UnauthorizedError
  // 2. bcrypt.compare(password, user.passwordHash) → 失败抛 UnauthorizedError
  // 3. jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: 3600 })
  // 4. 返回 { token }

  verifyToken(token: string): { userId: string } | null;
  // jwt.verify → 失败返回 null；成功返回 payload
}
export const userService = new UserService();
```

#### ArticleService
```typescript
class ArticleService {
  async create(input: { title: string; content: string }, authorId: string): Promise<{ articleId: string }>;
  // articleStore.insert({ id: randomUUID(), title, content, authorId, createdAt, updatedAt: createdAt })

  list(): Article[];

  findById(id: string): Article | null;
  // 不存在返回 null（不抛错，由调用方决定）

  async update(id: string, patch: { title?: string; content?: string }, userId: string): Promise<Article>;
  // 1. findById → null 抛 NotFoundError
  // 2. article.authorId !== userId 抛 ForbiddenError
  // 3. articleStore.update(id, { ...patch, updatedAt: now })

  async remove(id: string, userId: string): Promise<void>;
  // 1. findById → null 抛 NotFoundError
  // 2. article.authorId !== userId 抛 ForbiddenError
  // 3. articleStore.remove(id)
}
export const articleService = new ArticleService();
```

#### CommentService
```typescript
class CommentService {
  constructor(private articleSvc: ArticleService) {}

  async create(articleId: string, input: { content: string }, authorId: string): Promise<{ commentId: string }>;
  // 1. this.articleSvc.findById(articleId) === null 抛 NotFoundError
  // 2. commentStore.insert({ id: randomUUID(), articleId, content, authorId, createdAt })

  listByArticle(articleId: string): Comment[];
}
export const commentService = new CommentService(articleService);
```

### 2.4 Controller 层

```typescript
// user-controller.ts
async function register(req: Request, res: Response): Promise<void>;
// 1. parsed = registerSchema.parse(req.body)  // zod 校验，失败抛 ValidationError
// 2. result = await userService.register(parsed)
// 3. res.status(201).json(result)

// article-controller.ts
async function create(req: Request, res: Response): Promise<void>;
// 1. parsed = createArticleSchema.parse(req.body)
// 2. result = await articleService.create(parsed, req.userId!)  // userId 由 auth 中间件注入
// 3. res.status(201).json(result)

async function update(req: Request, res: Response): Promise<void>;
// 1. parsed = updateArticleSchema.parse(req.body)
// 2. result = await articleService.update(req.params.id, parsed, req.userId!)
// 3. res.json(result)
```

### 2.5 Middleware

```typescript
// auth.ts
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError('Missing Bearer token'));
  const token = header.slice(7);
  const payload = userService.verifyToken(token);
  if (!payload) return next(new UnauthorizedError('Invalid or expired token'));
  req.userId = payload.userId;
  next();
}

// error-handler.ts
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
}
```

## 3. zod Schema 设计

```typescript
// user-schema.ts
export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});
export const loginSchema = registerSchema;  // 同结构

// article-schema.ts
export const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
});
export const updateArticleSchema = createArticle.partial();

// comment-schema.ts
export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
```

## 4. 配置与启动

```typescript
// utils/env.ts
export const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET required'); })();
export const PORT = Number(process.env.PORT ?? 3000);
export const JWT_EXPIRES_IN = 3600;  // 秒，对应 NFR-001 的 ≤3600s

// server.ts
import app from './app';
import { PORT } from './utils/env';
app.listen(PORT, () => console.log(`Blog API on :${PORT}`));
```

## 5. 单元测试用例索引

> 详细用例见 [unit-test-cases.md](./unit-test-cases.md)。

| 用例 ID | 关联模块.方法 | 场景 | 优先级 |
|---|---|---|---|
| UT-001 | UserService.register | 注册成功，密码已哈希 | 高 |
| UT-002 | UserService.register | 重复用户名抛 ConflictError | 高 |
| UT-003 | UserService.login | 正确密码返回 JWT | 高 |
| UT-004 | UserService.login | 错误密码抛 UnauthorizedError | 高 |
| UT-005 | UserService.login | 用户不存在抛 UnauthorizedError | 高 |
| UT-006 | UserService.verifyToken | 合法 token 返回 payload | 高 |
| UT-007 | UserService.verifyToken | 非法 token 返回 null | 高 |
| UT-008 | ArticleService.create | 创建成功返回 articleId | 高 |
| UT-009 | ArticleService.update | 作者更新自己的文章成功 | 高 |
| UT-010 | ArticleService.update | 非作者更新抛 ForbiddenError | 高 |
| UT-011 | ArticleService.update | 不存在的文章抛 NotFoundError | 高 |
| UT-012 | ArticleService.remove | 作者删除自己的文章成功 | 高 |
| UT-013 | ArticleService.remove | 非作者删除抛 ForbiddenError | 高 |
| UT-014 | CommentService.create | 文章存在时评论创建成功 | 高 |
| UT-015 | CommentService.create | 文章不存在抛 NotFoundError | 高 |
| UT-016 | CommentService.listByArticle | 返回指定文章的所有评论 | 中 |
| UT-017 | authMiddleware | 合法 Bearer 通过并注入 userId | 高 |
| UT-018 | authMiddleware | 无 Authorization 头抛 UnauthorizedError | 高 |
| UT-019 | authMiddleware | 过期 token 抛 UnauthorizedError | 高 |
| UT-020 | errorHandler | AppError 转换为对应状态码 | 中 |
| UT-021 | errorHandler | ZodError 转换为 400 | 中 |
| UT-022 | errorHandler | 未知错误转换为 500 | 中 |
