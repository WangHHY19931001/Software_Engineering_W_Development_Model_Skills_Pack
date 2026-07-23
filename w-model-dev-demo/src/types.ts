/**
 * 共享领域类型定义（对应 detailed-design.md §2.2）。
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

export interface ArticleDetail extends Article {
  comments: Comment[];
}

export interface JwtPayload {
  userId: string;
  username: string;
}

export interface RegisterInput {
  username: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ArticleCreateInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface ArticleUpdateInput {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface CommentCreateInput {
  content: string;
}

export interface Page {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}
