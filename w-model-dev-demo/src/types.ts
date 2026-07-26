/**
 * 全局类型定义（types.ts）
 * 对应 DD-001 ~ DD-022 + DD-COMMON-001 ~ DD-COMMON-005 的数据结构。
 */

export type Role = 'admin' | 'author' | 'reader';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  nickname: string;
  avatar: string;
  bio: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  categoryId: string | null;
  tagIds: string[];
  status: ArticleStatus;
  likeCount: number;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  articleId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Like {
  userId: string;
  articleId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  meta: Record<string, unknown>;
  timestamp: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: string;
  active: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
  status: 'pending' | 'success' | 'failed';
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  meta?: Record<string, unknown>;
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resource?: string;
  startTime?: string;
  endTime?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ArticleQuery {
  page: number;
  limit: number;
  status?: ArticleStatus;
  authorId?: string;
  tagId?: string;
  categoryId?: string;
  sort?: 'createdAt' | 'updatedAt' | 'likeCount' | 'viewCount';
  order?: 'asc' | 'desc';
}

export interface SearchQuery {
  keyword: string;
  tagIds?: string[];
  categoryIds?: string[];
  page: number;
  limit: number;
}

export interface ArchiveItem {
  year: number;
  month: number;
  count: number;
  articleIds: string[];
}

export interface AuthenticatedRequest {
  user?: { id: string; role: Role; email: string };
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  query: unknown;
  params: Record<string, string>;
  method: string;
  path: string;
  ip?: string;
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}
