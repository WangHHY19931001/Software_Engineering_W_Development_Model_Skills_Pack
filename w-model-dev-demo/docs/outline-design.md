# 概要设计文档

> 阶段 3（概要设计）产出。W 模型右 V 同步产出集成测试设计。
> 本文件内嵌集成测试用例设计（IT-001~006），不再外挂独立测试用例文件。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent
- 关联需求文档：`docs/requirement-spec.md`
- 关联系统设计：`docs/system-design.md`

## 1. 设计目标

承接系统设计（§3 模块划分），细化模块间接口契约：
- 定义 Service / Store / Controller / Middleware / Utils 间方法签名
- 明确 DTO 与 Error 域模型
- 设计集成测试（IT）以校验模块间契约

## 2. 接口设计原则

1. **依赖方向**：`routes → middleware → controllers → services → stores / utils`，单向依赖，禁止反向调用
2. **错误传播**：Service 抛出 `HttpError` 子类，Controller 不捕获，由 `errorHandler` 中间件统一序列化
3. **DTO 边界**：`schemas/*` 用 zod 校验外部输入，校验后产出强类型 DTO；Service 入参为 DTO 而非 `unknown`
4. **作者隔离**：`authorId` 必须来自 JWT（`req.user.userId`），Controller 不允许从 body 接收
5. **存储抽象**：Store 仅提供 CRUD，业务规则（如作者隔离）由 Service 强制

## 3. 模块接口签名

### 3.1 路由层（M-001）

#### auth.routes.ts

```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middleware/validate';
import { AuthRegisterSchema, AuthLoginSchema } from '../schemas/auth.schema';

const router: Router = Router();
router.post('/register', validate(AuthRegisterSchema), asyncHandler(AuthController.register));
router.post('/login', validate(AuthLoginSchema), asyncHandler(AuthController.login));
// 契约：POST /api/v1/auth/register 期望 201 / 409；POST /api/v1/auth/login 期望 200 / 401
```

#### article.routes.ts

```typescript
import { Router } from 'express';
import { ArticleController } from '../controllers/article.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middleware/validate';
import { ArticleCreateSchema, ArticleUpdateSchema } from '../schemas/article.schema';

const router: Router = Router();
// 公开（无 authMiddleware）
router.get('/', asyncHandler(ArticleController.list));
router.get('/:id', asyncHandler(ArticleController.getById));
// 受保护
router.post('/', authMiddleware, validate(ArticleCreateSchema), asyncHandler(ArticleController.create));
router.patch('/:id', authMiddleware, validate(ArticleUpdateSchema), asyncHandler(ArticleController.update));
router.delete('/:id', authMiddleware, asyncHandler(ArticleController.remove));
// 契约：公开接口无 Authorization 可访问；受保护接口缺 Authorization → 401.40103
```

#### comment.routes.ts

```typescript
import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
import { validate } from '../middleware/validate';
import { CommentCreateSchema } from '../schemas/comment.schema';

const router: Router = Router({ mergeParams: true });
router.post('/', authMiddleware, validate(CommentCreateSchema), asyncHandler(CommentController.create));
router.delete('/:commentId', authMiddleware, asyncHandler(CommentController.remove));
// 契约：挂载在 /api/v1/articles/:articleId/comments 路径下，:articleId 由父路由提供
```

### 3.2 中间件层（M-002）

#### auth.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; username: string };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError(40103, '未提供认证令牌');
  }
  const token = header.slice(7);
  const payload = verifyToken(token); // 抛 UnauthorizedError(40102)
  req.user = { userId: payload.userId, username: payload.username };
  next();
}
// 契约：缺失/前缀错误 → 401.40103；签名错误或过期 → 401.40102
```

#### validate.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors';

export function validate<T>(schema: ZodSchema<T>): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new BadRequestError(40001, '请求参数校验失败', result.error.issues);
    }
    req.body = result.data; // 替换为强类型 DTO
    next();
  };
}
// 契约：zod 校验失败 → 400.40001
```

#### error-handler.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    return;
  }
  res.status(500).json({ code: 50001, message: '内部服务器错误' });
}
// 契约：HttpError → 对应 HTTP 状态 + 业务码；其他 → 500.50001
```

### 3.3 控制器层（M-003）

#### AuthController

```typescript
export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as AuthRegisterDTO;
    const result = await UserService.register(dto.username, dto.password);
    res.status(201).json(result); // 期望 { userId, username }
  }
  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as AuthLoginDTO;
    const result = await UserService.login(dto.username, dto.password);
    res.status(200).json(result); // 期望 { token, userId, username }
  }
}
```

#### ArticleController

```typescript
export class ArticleController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as ArticleCreateDTO;
    const authorId = req.user!.userId; // 作者隔离：来自 JWT
    const article = await ArticleService.create(authorId, dto);
    res.status(201).json(article);
  }
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { page = '1', pageSize = '10' } = req.query;
    const result = await ArticleService.list(Number(page), Number(pageSize));
    res.status(200).json(result);
  }
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await ArticleService.getById(req.params.id);
    const comments = await CommentService.listByArticle(req.params.id);
    res.status(200).json({ ...article, comments });
  }
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as ArticleUpdateDTO;
    const article = await ArticleService.update(req.user!.userId, req.params.id, dto);
    res.status(200).json(article);
  }
  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await ArticleService.remove(req.user!.userId, req.params.id);
    res.status(204).end();
  }
}
```

#### CommentController

```typescript
export class CommentController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as CommentCreateDTO;
    const authorId = req.user!.userId;
    const articleId = req.params.articleId; // 来自父路由
    const comment = await CommentService.create(authorId, articleId, dto);
    res.status(201).json(comment);
  }
  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    await CommentService.remove(req.user!.userId, req.params.commentId);
    res.status(204).end();
  }
}
```

### 3.4 服务层（M-004）

#### UserService

```typescript
export class UserService {
  static async register(username: string, password: string): Promise<{ userId: string; username: string }>;
  static async login(username: string, password: string): Promise<{ token: string; userId: string; username: string }>;
}
// 契约：register 用户名已存在 → 409.40901；login 凭证错误 → 401.40101
```

#### ArticleService

```typescript
export class ArticleService {
  static async create(authorId: string, dto: ArticleCreateDTO): Promise<Article>;
  static async list(page: number, pageSize: number): Promise<{ items: Article[]; total: number; page: number; pageSize: number }>;
  static async getById(id: string): Promise<Article>;
  static async update(authorId: string, id: string, dto: ArticleUpdateDTO): Promise<Article>;
  static async remove(authorId: string, id: string): Promise<void>;
}
// 契约：getById 不存在 → 404.40401；update/remove 非作者 → 403.40301
```

> **历史修复 #3**：`ArticleService` 必须 `export class`，否则单元测试无法引用其类型。

#### CommentService

```typescript
export class CommentService {
  static async create(authorId: string, articleId: string, dto: CommentCreateDTO): Promise<Comment>;
  static async listByArticle(articleId: string): Promise<Comment[]>;
  static async remove(authorId: string, commentId: string): Promise<void>;
}
// 契约：create 关联文章不存在 → 404.40401；remove 非作者 → 403.40301
```

### 3.5 存储层（M-005）

```typescript
// 通用接口契约：所有 Store 仅提供 CRUD，不抛业务错误（404/403 由 Service 判定）
export interface UserStore {
  findById(id: string): User | undefined;
  findByUsername(username: string): User | undefined;
  save(user: User): void;
}
export interface ArticleStore {
  findById(id: string): Article | undefined;
  findAll(page: number, pageSize: number): { items: Article[]; total: number };
  save(article: Article): void;
  delete(id: string): boolean;
}
export interface CommentStore {
  findById(id: string): Comment | undefined;
  findByArticleId(articleId: string): Comment[];
  save(comment: Comment): void;
  delete(id: string): boolean;
}
```

### 3.6 Schema 层（M-006）

```typescript
import { z } from 'zod';

export const AuthRegisterSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128),
});
export const AuthLoginSchema = AuthRegisterSchema;
export const ArticleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});
export const ArticleUpdateSchema = ArticleCreateSchema.partial();
export const CommentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
});
```

### 3.7 工具层（M-007）

#### jwt.ts

```typescript
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
}
export function signToken(payload: JwtPayload, expiresIn: number = 3600): string;
export function verifyToken(token: string): JwtPayload;
// 契约：从 process.env.JWT_SECRET 读取密钥；缺失 → throw Error('JWT_SECRET 未配置')
```

> **历史修复 #2**：`signToken` 与 `verifyToken` 必须从 `process.env.JWT_SECRET` 读取密钥，禁止硬编码。

#### password.ts

```typescript
import bcrypt from 'bcrypt';
export function hashPassword(plain: string): Promise<string>; // bcrypt cost=10
export function comparePassword(plain: string, hash: string): Promise<boolean>;
```

#### async-handler.ts

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler;
// 契约：捕获 Promise 内异常，next(err) 转交 errorHandler
```

#### errors.ts

```typescript
export abstract class HttpError extends Error {
  abstract status: number;
  constructor(public code: number, message: string, public details?: unknown) {
    super(message);
  }
}
export class BadRequestError extends HttpError { status = 400; }
export class UnauthorizedError extends HttpError { status = 401; }
export class ForbiddenError extends HttpError { status = 403; }
export class NotFoundError extends HttpError { status = 404; }
export class ConflictError extends HttpError { status = 409; }
// 业务码枚举：40001/40002/40101/40102/40103/40301/40401/40901/50001/50002
```

### 3.8 应用入口（M-008）

```typescript
// app.ts
export const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/articles', articleRoutes);
app.use('/api/v1/articles/:articleId/comments', commentRoutes);
app.use(errorHandler); // 兜底
```

## 4. 错误码与状态码契约

| 业务码 | HTTP 状态 | 触发条件 | 触发位置 |
|---|---|---|---|
| 40001 | 400 | zod 校验失败 | validate.ts |
| 40002 | 400 | 路径参数非法（如 NaN） | controller |
| 40101 | 401 | 登录凭证错误 | UserService.login |
| 40102 | 401 | JWT 已过期或签名无效 | jwt.ts → authMiddleware |
| 40103 | 401 | 未提供 Authorization 头 | authMiddleware |
| 40301 | 403 | 无权操作他人资源 | ArticleService.update/remove、CommentService.remove |
| 40401 | 404 | 资源不存在 | ArticleService.getById/update/remove、CommentService.create/remove |
| 40901 | 409 | 用户名已存在 | UserService.register |
| 50001 | 500 | 未捕获异常 | errorHandler |
| 50002 | 500 | 第三方库错误 | Service（如 bcrypt/jwt 内部失败） |

## 5. 集成测试用例设计

> 阶段 3 同步产出集成测试设计。本阶段只设计，不执行；执行在阶段 6（集成测试）。
> 覆盖原则：必须覆盖模块间契约 + 错误传播 + 跨层边界条件。

### 5.1 集成测试用例清单

| 用例 ID | 关联需求 | 测试目标 | 接口/模块组合 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|---|---|
| IT-001 | REQ-001 | 注册 + 登录模块间契约 | routes/auth → AuthController → UserService → UserStore + passwordUtils + jwtUtils | 1) POST /register {alice/Pass1234}；2) POST /login {alice/Pass1234} | 步骤 1：201 + {userId, username='alice'}；步骤 2：200 + {token, userId, username='alice'}；token 可被 verifyToken 解码；userStore 内部 passwordHash 以 $2b$10$ 开头 | 高 |
| IT-002 | REQ-001 | 重复注册触发 ConflictError 经 errorHandler 序列化 | routes/auth + UserService + errorHandler | POST /register {alice/Pass1234} 两次 | 第二次：409 + {code:40901, message:'用户名已存在'} | 高 |
| IT-003 | REQ-002 | 创建文章 + 作者隔离（update/remove 跨用户） | routes/article + authMiddleware + ArticleController + ArticleService | 1) A 注册登录；2) A 创建文章 X；3) B 注册登录；4) B PATCH /articles/X；5) B DELETE /articles/X；6) A PATCH /articles/X | 步骤 4：403 + 40301；步骤 5：403 + 40301；步骤 6：200 + 更新后内容；X 仍存在 | 高 |
| IT-004 | REQ-003 | 公开浏览（未认证）+ 评论聚合 | routes/article + ArticleController.getById + CommentService.listByArticle | 1) A 创建文章 X；2) A 创建评论 C1；3) 公开 GET /articles/X | 200 + {id, title, content, authorId, comments:[{id:C1, content, authorId:A}]}；无需 Authorization | 高 |
| IT-005 | REQ-004 | 评论删除作者隔离 + 文章不存在拦截 | routes/comment + authMiddleware + CommentService | 1) A 创建文章 X + 评论 C1；2) B 登录；3) B DELETE /articles/X/comments/C1；4) A DELETE /articles/X/comments/C1；5) A POST /articles/不存在/comments | 步骤 3：403 + 40301；步骤 4：204；步骤 5：404 + 40401 | 高 |
| IT-006 | NFR-001 | 鉴权中间件全链路：缺 token / 伪造 / 过期 | authMiddleware + jwtUtils | 1) POST /articles 无 Authorization；2) POST /articles Authorization: Bearer 伪造；3) POST /articles Authorization: Bearer 过期 token；4) POST /articles Authorization: Bearer 合法 token | 步骤 1：401 + 40103；步骤 2：401 + 40102；步骤 3：401 + 40102；步骤 4：201 | 高 |

### 5.2 集成测试覆盖说明

- 模块间契约：IT-001（auth 全链路）、IT-003（article 跨用户作者隔离）、IT-005（comment 跨用户 + 跨资源）
- 错误传播：IT-002（ConflictError → errorHandler）、IT-006（UnauthorizedError 三态）
- 跨层边界：IT-004（routes → controller → service → store + 跨 service 聚合 comments）
- 总计：6 条 IT，覆盖 4 个 REQ + 1 个 NFR；剩余 NFR（性能/可维护性/可测试性）由 ST/UAT 覆盖

## 6. 阶段 3 自检清单

- [x] 模块间接口签名已定义（route → middleware → controller → service → store / utils）
- [x] 错误码与 HTTP 状态码契约已固化（10 个业务码枚举）
- [x] 集成测试用例覆盖关键模块间路径（CRUD + 作者隔离 + 鉴权 + 评论聚合），共 6 条
- [x] 4 项历史修复中的接口约束已声明：async-handler（routes）、JWT_SECRET（jwt.ts）、ArticleService export class、HttpError 子类
- [x] RTM 已补登 outline-design 文档（见 `.w-model/rtm.json`）

## 7. 阶段完成摘要

- 产物路径：
  - `docs/outline-design.md`（本文件，内嵌 IT-001~006）
  - `.w-model/rtm.json`（已补登 integrationTest 字段）
- RTM 覆盖状态：部分（designDoc + systemTest + integrationTest + acceptanceTest 已填充；codeModule + unitTest 待阶段 4/5）
- 验证证据：8 模块接口签名 + 10 业务码契约表 + 6 条 IT 覆盖模块间路径
- 阻塞项：无
- 下一步：进入阶段 4（详细设计），同步产出单元测试设计（UT-001~030）
