/**
 * 全局类型定义
 * 包含 17 个核心实体 + 枚举 + 通用类型
 */

// ============ 枚举 ============
export enum UserRole {
  READER = 'reader',
  BLOGGER = 'blogger',
  ADMIN = 'admin',
}

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum CommentStatus {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
  DELETED = 'deleted',
}

export enum NotificationType {
  COMMENT_REPLY = 'comment_reply',
  COMMENT_ON_POST = 'comment_on_post',
  POST_PUBLISHED = 'post_published',
  FOLLOW = 'follow',
  LIKE = 'like',
  FAVORITE = 'favorite',
  SYSTEM = 'system',
}

export enum WebhookEventType {
  POST_CREATED = 'post.created',
  POST_UPDATED = 'post.updated',
  POST_PUBLISHED = 'post.published',
  POST_DELETED = 'post.deleted',
  COMMENT_CREATED = 'comment.created',
  USER_REGISTERED = 'user.registered',
  BLOGGER_REGISTERED = 'blogger.registered',
}

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  INFLIGHT = 'inflight',
  DELIVERED = 'delivered',
  RETRY = 'retry',
  FAILED = 'failed',
}

export enum AuditAction {
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',
  BLOGGER_REGISTERED = 'blogger.registered',
  POST_CREATED = 'post.created',
  POST_UPDATED = 'post.updated',
  POST_PUBLISHED = 'post.published',
  POST_DELETED = 'post.deleted',
  COMMENT_DELETED = 'comment.deleted',
  SITE_CONFIG_UPDATED = 'site.config.updated',
  AD_CREATED = 'ad.created',
  AD_UPDATED = 'ad.updated',
  AD_DELETED = 'ad.deleted',
  WEBHOOK_CREATED = 'webhook.created',
  WEBHOOK_DELETED = 'webhook.deleted',
  LOGIN_SUCCESS = 'login.success',
  LOGIN_FAILED = 'login.failed',
  LOGOUT = 'logout',
}

export enum AdPlacement {
  BANNER_TOP = 'banner_top',
  BANNER_BOTTOM = 'banner_bottom',
  SIDEBAR = 'sidebar',
  INLINE = 'inline',
}

export enum AdStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired',
}

export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTH_FAILED = 'AUTH_FAILED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL = 'INTERNAL',
  INVALID_STATE = 'INVALID_STATE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
}

// ============ 实体 ============
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  nickname: string;
  role: UserRole;
  bio?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  nickname: string;
  role: UserRole;
  bio?: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface Blogger {
  id: string;
  userId: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  content: string;
  summary: string;
  status: ArticleStatus;
  tagIds: string[];
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  status: CommentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CommentNode extends Comment {
  children: CommentNode[];
  replies?: CommentNode[];
}

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  content: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: number;
}

export interface Webhook {
  id: string;
  ownerId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextRetryAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SiteConfig {
  id: string;
  siteTitle: string;
  siteLink: string;
  siteDescription: string;
  siteLogoUrl: string;
  bannerAdId: string | null;
  metaKeywords: string;
  metaDescription: string;
  icpRecord: string;
  updatedAt: number;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction;
  target: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
}

export interface ViewRecord {
  id: string;
  postId: string;
  userId: string | null;
  ip: string;
  userAgent: string;
  referer: string;
  createdAt: number;
}

export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: number;
}

export interface Like {
  id: string;
  userId: string;
  postId: string;
  createdAt: number;
}

export interface Favorite {
  id: string;
  userId: string;
  postId: string;
  createdAt: number;
}

export interface AdSlot {
  id: string;
  name: string;
  placement: AdPlacement;
  imageUrl: string;
  linkUrl: string;
  startAt: number;
  endAt: number;
  status: AdStatus;
  impressionCount: number;
  clickCount: number;
  createdAt: number;
  updatedAt: number;
}

// ============ 通用类型 ============
export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresIn: number;
}

export type Result<T, E = AppErrorData> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface AppErrorData {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  details?: Record<string, unknown>;
}

export interface QueryOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchQuery {
  keyword?: string;
  tagIds?: string[];
  authorId?: string;
  status?: ArticleStatus;
  page?: number;
  pageSize?: number;
}
