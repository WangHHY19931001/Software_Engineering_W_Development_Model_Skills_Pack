/**
 * 领域类型定义（DD-001~029 共享）
 * 对应 docs/detailed-design.md §2.2 表结构。
 */

export type Role = 'user' | 'blogger' | 'admin' | 'super_admin';
export type BloggerLevel = 'normal' | 'verified' | 'featured';
export type UserStatus = 'active' | 'banned';

/** 文章 6 状态机（DD-008，与 L3_article_state_machine.tla ValidStates 一致） */
export type ArticleState =
  | 'draft'
  | 'pending_review'
  | 'scheduled_publish'
  | 'published'
  | 'taken_down'
  | 'archived';

/** 评论状态（DD-013） */
export type CommentStatus =
  | 'published'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'reported';

export type AdStatus = 'pending' | 'active' | 'rejected' | 'paused';
export type AdSlotState = 'inactive' | 'active' | 'paused';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  role: Role;
  bloggerLevel?: BloggerLevel;
  status: UserStatus;
  banReason?: string;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
}

export interface BloggerProfile {
  userId: string;
  intro: string;
  socialLinks?: Record<string, string>;
}

export interface ArticleStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  heat: number;
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  status: ArticleState;
  publishAt?: number;
  seriesId?: string;
  seriesOrder?: number;
  tagIds: string[];
  categoryId?: string;
  citeArticleIds: string[];
  stats: ArticleStats;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export interface Comment {
  id: string;
  articleId: string;
  parentId?: string;
  depth: number;
  authorId: string;
  content: string;
  status: CommentStatus;
  likes: number;
  likedBy: string[];
  sensitiveHit?: string[];
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  usageCount: number;
  mergedToId?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  order: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface Ad {
  id: string;
  slot: string;
  startAt: number;
  endAt: number;
  status: AdStatus;
  targetUser?: string;
  content?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishAt?: number;
  status: AnnouncementStatus;
  createdAt: number;
  publishedAt?: number;
}

/** WAL 操作记录（DD-024） */
export interface Operation {
  opId: string;
  opType: string;
  payload: unknown;
  timestamp: number;
}

/** 审计日志条目（DD-026） */
export interface AuditEntry {
  entryId: string;
  action: string;
  actor: string;
  target: string;
  detail: Record<string, unknown>;
  timestamp: number;
}

export interface Page<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 站点配置（DD-017） */
export interface SiteConfig {
  switches: {
    maintenance: boolean;
    registration: boolean;
    comment: boolean;
  };
  [k: string]: unknown;
}
