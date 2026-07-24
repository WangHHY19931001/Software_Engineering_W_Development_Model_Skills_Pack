/**
 * 测试公共辅助 —— mock 工厂与重置
 */
import { vi } from 'vitest';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { EmailSender } from '../../../src/utils/email.js';
import { SensitiveFilter } from '../../../src/utils/sensitive-filter.js';
import { CtrCalculator } from '../../../src/utils/ctr-calculator.js';
import { SiteService } from '../../../src/services/operation/site-service.js';
import { userStore } from '../../../src/stores/user-store.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { TagService } from '../../../src/services/content/tag-service.js';
import { CategoryService } from '../../../src/services/content/category-service.js';
import { CommentService } from '../../../src/services/interaction/comment-service.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';

export interface MockDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
  emailSender: EmailSender;
  sensitiveFilter: SensitiveFilter;
  ctrCalculator: CtrCalculator;
  siteService: SiteService;
  notificationService: NotificationService;
}

export function createMockDeps(): MockDeps {
  const walWriter = new WalWriter('./test-wal.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./test-audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  const sensitiveFilter = new SensitiveFilter();
  const ctrCalculator = new CtrCalculator();
  const siteService = new SiteService({ walWriter, auditLogger });
  const notificationService = new NotificationService({ emailSender, walWriter });
  return { walWriter, auditLogger, emailSender, sensitiveFilter, ctrCalculator, siteService, notificationService };
}

export function resetAllStores(): void {
  userStore.clear();
  articleStore.clear();
  TagService._reset();
  CategoryService._reset();
  CommentService._reset();
  NotificationService._reset();
}

export function makeUser(overrides: Partial<import('../../../src/types.js').User> = {}): import('../../../src/types.js').User {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'u-test',
    email: 'test@example.com',
    passwordHash: '$2a$10$placeholderhashplaceholderhashplaceholderhashplaceholderhashplace',
    nickname: 'tester',
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: 0,
    ...overrides,
  };
}

export function makeArticle(overrides: Partial<import('../../../src/types.js').Article> = {}): import('../../../src/types.js').Article {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'a-test',
    authorId: 'blogger1',
    title: 'Test Article',
    content: 'Test content',
    status: 'draft',
    tagIds: [],
    citeArticleIds: [],
    stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
