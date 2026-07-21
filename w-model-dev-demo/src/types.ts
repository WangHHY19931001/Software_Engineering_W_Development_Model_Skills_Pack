/**
 * 共享类型定义。
 *
 * 实体（User / Article / Comment）对应 `docs/detailed-design.md` §2.2 的内存 Map 表结构。
 * DTO 用于 Service / Controller 之间的数据传递，不包含敏感字段（如 passwordHash）。
 */

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  content: string;
  tags: string[];
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

/** 用户注册 / 登录后返回给调用方的 DTO（不含 passwordHash）。 */
export interface UserDTO {
  userId: string;
  username: string;
}

/** 登录成功后返回的 token DTO。 */
export interface TokenDTO {
  token: string;
  expiresIn: number;
}

export interface ArticleCreateDTO {
  title: string;
  content: string;
  tags?: string[];
}

export interface ArticleUpdateDTO {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface ArticleDetail extends Article {
  comments: Comment[];
}

export interface PageQuery {
  page: number;
  pageSize: number;
  tag?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** JwtUtils 签发 / 校验的 payload。iat / exp 由 jsonwebtoken 自动注入。 */
export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/** 鉴权中间件注入到 req.user 的精简身份信息。 */
export interface AuthUser {
  userId: string;
  username: string;
}
