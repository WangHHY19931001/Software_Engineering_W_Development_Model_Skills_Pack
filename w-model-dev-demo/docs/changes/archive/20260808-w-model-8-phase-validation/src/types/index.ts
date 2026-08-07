/**
 * 领域模型类型（15 实体 + 派生视图 + 事件负载）
 * 对齐详细设计 §2.1 ER 图 / §2.2 表结构；Blogger/RssSource 为派生视图（ID-1/ID-2）。
 */

export type Role = 'reader' | 'blogger';
export type ArticleStatus = 'draft' | 'published' | 'archived';
export type ArticleAction = 'create' | 'publish' | 'archive' | 'unarchive' | 'update' | 'delete';
export type NotificationType = 'REPLY' | 'LIKE' | 'NEW_ARTICLE' | 'NEW_FOLLOWER';
export type WebhookEventType = 'article.published' | 'comment.created';
export type DeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed';
export type AuditActionType = 'login' | 'publish' | 'delete';
export type AuditResult = 'success' | 'failure';

/** User 实体（内存存储实体，含 passwordHash；响应侧一律经 toPublicUser 去敏） */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  nickname: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
}

/** 对外用户视图（INTF-001/004 响应，不含 passwordHash/password） */
export interface PublicUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
  nickname: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/** 登录会话（INTF-002） */
export interface Session {
  token: string;
  expiresIn: number;
  user: { userId: string; username: string; role: Role };
}

/** JWT 载荷（DD-046 verify 返回结构；issueToken 统一签 {sub, role}，见 reworkHint 处置） */
export interface TokenPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  body: string;
  summary: string;
  categoryId: string | null;
  status: ArticleStatus;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  depth: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  articleId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
}

export interface Like {
  id: string;
  userId: string;
  articleId: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  articleId: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: string;
}

/** ReadingRecord：clientIp+articleId 去重；userId 可空（匿名浏览），供个性化推荐聚合 */
export interface ReadingRecord {
  id: string;
  articleId: string;
  clientIp: string;
  userId: string | null;
  viewedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  articleId: string | null;
  actorId: string | null;
  actorName: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface WebhookConfig {
  id: string;
  ownerId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** AuditLog 字段白名单（CON-004 / RH-01）：不含 password/token/请求体 */
export interface AuditLog {
  id: string;
  actionType: AuditActionType;
  actorId: string | null;
  resourceType: string;
  resourceId: string | null;
  result: AuditResult;
  httpStatus: number;
  clientIp: string;
  requestId: string;
  createdAt: string;
}

/** 通用分页结构（INTF §0.2） */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrendPoint {
  date: string;
  views: number;
}

export interface TagScore {
  tag: string;
  score: number;
}

export interface HotItem {
  articleId: string;
  title: string;
  summary: string;
  viewCount7d: number;
  publishedAt: string | null;
}

export interface RecommendItem {
  articleId: string;
  title: string;
  summary: string;
  reason: 'tag-preference' | 'hot-fallback';
  score: number;
}

export interface SearchResultItem {
  articleId: string;
  title: string;
  summary: string;
  score: number;
}

export interface BloggerStats {
  articleCount: number;
  totalViews: number;
  totalComments: number;
  trend: TrendPoint[];
}

export interface FeedItem {
  articleId: string;
  title: string;
  summary: string;
  author: { userId: string; username: string };
  publishedAt: string | null;
}

export interface FavoriteItem {
  articleId: string;
  title: string;
  summary: string;
  favoritedAt: string;
}

/* ============ 事件模型（接口设计 §0.5） ============ */

export interface ArticlePublishedEvent {
  type: 'article.published';
  articleId: string;
  authorId: string;
  authorName: string;
  title: string;
  publishedAt: string;
  /** 粉丝列表由装配层（AppFactory）注入：通知订阅消费 */
  followerIds?: string[];
}

export interface ArticleUpdatedEvent {
  type: 'article.updated';
  articleId: string;
}

export interface ArticleArchivedEvent {
  type: 'article.archived';
  articleId: string;
}

export interface ArticleDeletedEvent {
  type: 'article.deleted';
  articleId: string;
}

export interface CommentCreatedEvent {
  type: 'comment.created';
  articleId: string;
  commentId: string;
  authorId: string;
  authorName: string;
  articleAuthorId: string;
  parentId: string | null;
  content: string;
}

export interface ArticleLikedEvent {
  type: 'article.liked';
  articleId: string;
  userId: string;
  articleAuthorId: string;
}

export interface FollowCreatedEvent {
  type: 'follow.created';
  followerId: string;
  followerName: string;
  followeeId: string;
}

export interface ReadingViewedEvent {
  type: 'reading.viewed';
  articleId: string;
  clientIp: string;
  userId?: string | null;
}

export type BlogEvent =
  | ArticlePublishedEvent
  | ArticleUpdatedEvent
  | ArticleArchivedEvent
  | ArticleDeletedEvent
  | CommentCreatedEvent
  | ArticleLikedEvent
  | FollowCreatedEvent
  | ReadingViewedEvent;

export type EventHandler = (payload: BlogEvent) => void;

/** Express Request 扩展：认证中间件挂载的当前用户（DD-041） */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role };
    }
  }
}
