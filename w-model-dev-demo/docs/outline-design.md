# 概要设计文档

> 阶段 3（概要设计）产出。项目：博客系统（W 模型端到端调测）。
> 关联：[system-design.md](./system-design.md)（系统设计）/ [requirement-spec.md](./requirement-spec.md)（需求）

## 1. 模块间接口契约

### 1.1 模块依赖关系

```
┌─────────────────────────────────────────────────────┐
│                     routes/index.ts                 │
│         (路由聚合 + 错误处理中间件挂载)               │
└───────┬──────────┬──────────────┬───────────────────┘
        │          │              │
        ▼          ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ authRoutes │ │articleRoutes│ │commentRoutes│
└─────┬──────┘ └──────┬─────┘ └──────┬─────┘
      │               │              │
      ▼               ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│UserController│ │ArticleController│ │CommentController│
└─────┬──────┘ └──────┬─────┘ └──────┬─────┘
      │               │              │
      ▼               ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ UserService│ │ArticleService│ │CommentService│
└─────┬──────┘ └──────┬─────┘ └──────┬─────┘
      │               │              │
      ▼               ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│  UserStore │ │ ArticleStore│ │ CommentStore│
│   (Map)    │ │   (Map)     │ │   (Map)    │
└────────────┘ └────────────┘ └────────────┘
```

横向依赖（仅服务层）：
- `CommentService.create` 调用 `ArticleService.findById` 校验文章存在
- `AuthMiddleware` 调用 `UserService.verifyToken` 校验 JWT

### 1.2 模块对外接口签名

#### M-001 用户认证模块

```typescript
// services/user-service.ts
interface UserService {
  register(input: { username: string; password: string }): Promise<{ userId: string }>;
  login(input: { username: string; password: string }): Promise<{ token: string }>;
  verifyToken(token: string): { userId: string } | null;
}

// middleware/auth.ts
interface AuthMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
}
```

#### M-002 文章管理模块

```typescript
// services/article-service.ts
interface ArticleService {
  create(input: { title: string; content: string }, authorId: string): Promise<{ articleId: string }>;
  list(): Promise<Article[]>;
  findById(id: string): Promise<Article | null>;
  update(id: string, patch: { title?: string; content?: string }, userId: string): Promise<Article>;
  remove(id: string, userId: string): Promise<void>;
}

interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}
```

#### M-003 评论模块

```typescript
// services/comment-service.ts
interface CommentService {
  create(articleId: string, input: { content: string }, authorId: string): Promise<{ commentId: string }>;
  listByArticle(articleId: string): Promise<Comment[]>;
}

interface Comment {
  id: string;
  articleId: string;
  content: string;
  authorId: string;
  createdAt: string;
}
```

#### M-004 公共层

```typescript
// utils/errors.ts
class AppError extends Error {
  constructor(public status: number, public message: string) { super(message); }
}
class ValidationError extends AppError { constructor(msg: string) { super(400, msg); } }
class UnauthorizedError extends AppError { constructor(msg = 'Unauthorized') { super(401, msg); } }
class ForbiddenError extends AppError { constructor(msg = 'Forbidden') { super(403, msg); } }
class NotFoundError extends AppError { constructor(msg = 'Not Found') { super(404, msg); } }
class ConflictError extends AppError { constructor(msg: string) { super(409, msg); } }

// middleware/error-handler.ts
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void;
```

## 2. 关键数据流

### 2.1 注册→登录→创建文章

```
Client ──POST /auth/register──► UserController.register
    → UserService.register
    → UserStore.set (检查 username 唯一性，bcrypt 哈希)
    → 返回 userId

Client ──POST /auth/login──► UserController.login
    → UserService.login
    → UserStore.findByUsername + bcrypt.compare
    → jwt.sign({ userId }, SECRET, { expiresIn: 3600 })
    → 返回 token

Client ──POST /articles──► AuthMiddleware (校验 JWT)
    → ArticleController.create
    → ArticleService.create
    → ArticleStore.set (crypto.randomUUID)
    → 返回 articleId
```

### 2.2 作者隔离校验流程

```
Client ──PUT /articles/:id──► AuthMiddleware
    → ArticleController.update
    → ArticleService.update
    → ArticleStore.findById
        ├─ null → throw NotFoundError (404)
        └─ article
            ├─ article.authorId !== userId → throw ForbiddenError (403)
            └─ 应用 patch → ArticleStore.set → 返回更新后 article
```

### 2.3 评论 + 文章存在校验

```
Client ──POST /articles/:id/comments──► AuthMiddleware
    → CommentController.create
    → CommentService.create
    → ArticleService.findById (跨模块依赖)
        ├─ null → throw NotFoundError (404)
        └─ 文章存在 → CommentStore.set → 返回 commentId
```

## 3. 错误传播约定

- Service 层抛 `AppError` 子类，携带 HTTP 状态码。
- Controller 层不 try/catch 业务错误，统一由 `errorHandler` 中间件捕获并返回 `{error: message}` + 对应状态码。
- 未知异常由 `errorHandler` 兜底为 500，不泄漏堆栈到响应体。

## 4. 集成测试用例索引

> 详细用例见 [integration-test-cases.md](./integration-test-cases.md)。

| 用例 ID | 关联模块交互 | 场景 | 优先级 |
|---|---|---|---|
| IT-001 | M-001 ↔ M-002 | 注册→登录→创建文章，验证 JWT 在模块间正确传递 | 高 |
| IT-002 | M-002 内部 | 文章 CRUD 全流程（创建→查询→更新→删除→404） | 高 |
| IT-003 | M-002 ↔ M-003 | 评论创建依赖文章存在校验（跨服务依赖） | 高 |
| IT-004 | M-001 ↔ M-002 | 作者隔离：不同用户的 JWT 不能写他人文章 | 高 |
| IT-005 | M-004 ↔ 全部 | 错误处理中间件统一捕获 AppError 并返回正确状态码 | 中 |
| IT-006 | M-002 ↔ M-003 | 删除文章后评论不可再创建（跨模块一致性） | 中 |
