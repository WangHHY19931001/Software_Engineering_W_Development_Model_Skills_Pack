// All shared TypeScript types/enums/interfaces for blog-system-demo.

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  Admin = 'admin',
  Blogger = 'blogger',
  Reader = 'reader',
}

export enum UserStatus {
  Active = 'active',
  Banned = 'banned',
}

export interface User extends BaseEntity {
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  displayName: string;
  bannedAt: Date | null;
  banReason: string | null;
}

export interface Blogger extends BaseEntity {
  userId: ID;
  slug: string;
  bio: string;
  followerCount: number;
}

export enum ArticleStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Published = 'published',
  Offline = 'offline',
  Archived = 'archived',
}

export enum ScheduleStatus {
  None = 'schedule_none',
  Pending = 'schedule_pending',
  Fired = 'schedule_fired',
}

export interface Article extends BaseEntity {
  authorId: ID;
  title: string;
  content: string;
  summary: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
  seriesId: ID | null;
  seriesOrder: number;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  scheduleStatus: ScheduleStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  categoryId: ID | null;
}

export interface ArticleInput {
  title: string;
  content: string;
  summary?: string;
  coverImageUrl?: string;
  seriesId?: string;
  seriesOrder?: number;
  scheduledAt?: Date;
  status?: ArticleStatus;
}

export enum CommentStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Flagged = 'flagged',
}

export interface Comment extends BaseEntity {
  articleId: ID;
  userId: ID;
  parentId: ID | null;
  content: string;
  depth: number;
  likeCount: number;
  status: CommentStatus;
}

export enum NotificationType {
  Comment = 'comment',
  Like = 'like',
  Follow = 'follow',
  System = 'system',
  Subscription = 'subscription',
}

export interface Notification extends BaseEntity {
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  refId: string;
  read: boolean;
}

export interface NotificationSettings {
  comment: boolean;
  like: boolean;
  follow: boolean;
  system: boolean;
  subscription: boolean;
}

export interface FileAsset extends BaseEntity {
  userId: ID;
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
  sha256: string;
  magicType: string;
}

export interface FileInput {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export enum SubscriptionTarget {
  Blogger = 'blogger',
  Tag = 'tag',
  Category = 'category',
}

export enum SubscriptionLevel {
  Basic = 'basic',
  Premium = 'premium',
  Admin = 'admin',
}

export interface Subscription extends BaseEntity {
  userId: ID;
  target: SubscriptionTarget;
  targetId: ID;
}

export interface SubscriptionEvent {
  type: string;
  refId: string;
  at: Date;
}

export interface Category extends BaseEntity {
  name: string;
  parentId: ID | null;
  depth: number;
  sortOrder: number;
  deleted: boolean;
}

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

export enum TagStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Rejected = 'rejected',
}

export interface Tag extends BaseEntity {
  name: string;
  slug: string;
  articleCount: number;
  status: TagStatus;
  deleted: boolean;
}

export enum AdStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Offline = 'offline',
}

export interface Ad extends BaseEntity {
  slotId: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  startAt: Date;
  endAt: Date;
  status: AdStatus;
  clickCount: number;
  impressCount: number;
}

export interface AdInput {
  slotId: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  startAt: Date;
  endAt: Date;
}

export enum BackupType {
  Full = 'full',
  Incremental = 'incremental',
}

export enum BackupStatus {
  Created = 'created',
  Restored = 'restored',
  Failed = 'failed',
}

export interface Backup extends BaseEntity {
  operatorId: ID;
  type: BackupType;
  payload: Buffer;
  sha256: string;
  size: number;
  status: BackupStatus;
}

export interface Series extends BaseEntity {
  authorId: ID;
  name: string;
  description: string;
}

export interface CrossReference extends BaseEntity {
  fromArticleId: ID;
  toArticleId: ID;
}

export interface AuditLog extends BaseEntity {
  userId: ID;
  action: string;
  target: string;
  at: Date;
}

export interface RecommendSlot {
  name: string;
  articleId: ID;
  priority: number;
}

export interface SiteConfig {
  siteName: string;
  description: string;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  commentOpen: boolean;
  announcement: string | null;
  announcementAt: Date | null;
  updatedAt: Date;
}

export interface SiteStatsOverview {
  articleCount: number;
  userCount: number;
  bloggerCount: number;
  commentCount: number;
  fileCount: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GraphNode {
  articleId: ID;
  depth: number;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
}

// Minimal WebSocket-like interface (decouples from `ws` package import in tests).
export interface IWsLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

// Magic-number constants for file upload validation.
export const FILE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
export const BACKUP_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
export const DAILY_QUOTA_LIMIT = 50 * 1024 * 1024; // 50MB
export const MONTHLY_QUOTA_LIMIT = 500 * 1024 * 1024; // 500MB
export const SEARCH_HISTORY_MAX = 20;
export const MAX_DEPTH = 5;
