// SD-001 SiteStore.

import type { SiteConfig, SiteStatsOverview } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { appendAuditLog } from '../utils/logger.js';
import type { UserStore } from './user.store.js';
import type { BloggerStore } from './blogger.store.js';
import type { ArticleStore } from './article.store.js';
import type { CommentStore } from './comment.store.js';
import type { FileStore } from './file.store.js';

export class SiteStore {
  private config: SiteConfig = {
    siteName: 'blog-system-demo',
    description: 'Default site',
    maintenanceMode: false,
    registrationOpen: true,
    commentOpen: true,
    announcement: null,
    announcementAt: null,
    updatedAt: new Date(),
  };

  // Injected stores for stats aggregation (optional).
  private userStore: UserStore | null = null;
  private bloggerStore: BloggerStore | null = null;
  private articleStore: ArticleStore | null = null;
  private commentStore: CommentStore | null = null;
  private fileStore: FileStore | null = null;

  setStores(opts: {
    userStore?: UserStore;
    bloggerStore?: BloggerStore;
    articleStore?: ArticleStore;
    commentStore?: CommentStore;
    fileStore?: FileStore;
  }): void {
    if (opts.userStore) this.userStore = opts.userStore;
    if (opts.bloggerStore) this.bloggerStore = opts.bloggerStore;
    if (opts.articleStore) this.articleStore = opts.articleStore;
    if (opts.commentStore) this.commentStore = opts.commentStore;
    if (opts.fileStore) this.fileStore = opts.fileStore;
  }

  getConfig(): SiteConfig {
    return { ...this.config };
  }

  updateConfig(operatorId: string, patch: Partial<SiteConfig>, operatorRole: string): SiteConfig {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const allowed: Array<keyof SiteConfig> = [
      'siteName',
      'description',
      'maintenanceMode',
      'registrationOpen',
      'commentOpen',
      'announcement',
      'announcementAt',
    ];
    for (const key of Object.keys(patch) as Array<keyof SiteConfig>) {
      if (!allowed.includes(key)) {
        throw new AppError(ErrorCode.ZodValidation, '1001');
      }
      const value = patch[key];
      if (value !== undefined) {
        // exactOptionalPropertyTypes is off; assignment is safe.
        (this.config as unknown as Record<string, unknown>)[key] = value;
      }
    }
    this.config.updatedAt = new Date();
    appendAuditLog(operatorId, 'updateConfig', 'site');
    return { ...this.config };
  }

  setMaintenanceMode(enabled: boolean): void {
    this.config.maintenanceMode = enabled;
    this.config.updatedAt = new Date();
  }

  setAnnouncement(text: string, at: Date): void {
    this.config.announcement = text;
    this.config.announcementAt = at;
    this.config.updatedAt = new Date();
  }

  getStatsOverview(): SiteStatsOverview {
    return {
      articleCount: this.articleStore?.size() ?? 0,
      userCount: this.userStore?.size() ?? 0,
      bloggerCount: this.bloggerStore?.size() ?? 0,
      commentCount: this.commentStore?.size() ?? 0,
      fileCount: this.fileStore?.size() ?? 0,
    };
  }
}
