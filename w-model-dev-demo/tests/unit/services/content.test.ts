/**
 * UT-DD-007 ~ UT-DD-012 —— 内容管理层单元测试
 * ArticleService (7) + ArticleStateMachine (4) + ArticleStore (3) +
 * TagService (4) + CategoryService (3) + CrossRefService (3) = 24 用例
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../../src/services/content/article-service.js';
import { ArticleStateMachine } from '../../../src/utils/article-state-machine.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { TagService } from '../../../src/services/content/tag-service.js';
import { CategoryService } from '../../../src/services/content/category-service.js';
import { CrossRefService } from '../../../src/services/content/cross-ref-service.js';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { AppError } from '../../../src/utils/errors.js';
import { userStore } from '../../../src/stores/user-store.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';
import { EmailSender } from '../../../src/utils/email.js';
import { TagService as TagServiceClass } from '../../../src/services/content/tag-service.js';
import { CategoryService as CategoryServiceClass } from '../../../src/services/content/category-service.js';
import { CommentService } from '../../../src/services/interaction/comment-service.js';

function makeDeps() {
  const walWriter = new WalWriter('./test.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  const notificationService = new NotificationService({ emailSender, walWriter });
  return { walWriter, auditLogger, emailSender, notificationService };
}

function resetAll() {
  userStore.clear();
  articleStore.clear();
  TagServiceClass._reset();
  CategoryServiceClass._reset();
  CommentService._reset();
  NotificationService._reset();
}

describe('DD-007 ArticleService', () => {
  let svc: ArticleService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
    resetAll();
    deps = makeDeps();
    svc = new ArticleService({ walWriter: deps.walWriter, auditLogger: deps.auditLogger });
  });

  it('UT-DD-007-031: createArticle 正常创建文章', async () => {
    const article = await svc.createArticle({
      title: 'Hello', content: '# Hello World', authorId: 'blogger1',
    });
    expect(article.id).toBeDefined();
    expect(article.status).toBe('draft');
    expect(articleStore.findById(article.id)).toBeDefined();
  });

  it('UT-DD-007-032: createArticle 标题超 200 字抛 40003', async () => {
    await expect(svc.createArticle({
      title: 'x'.repeat(201), content: 'c', authorId: 'blogger1',
    })).rejects.toThrow(AppError);
    try {
      await svc.createArticle({ title: 'x'.repeat(201), content: 'c', authorId: 'blogger1' });
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('UT-DD-007-033: createArticle 内容超 100000 字抛 40003', async () => {
    await expect(svc.createArticle({
      title: 'T', content: 'x'.repeat(100001), authorId: 'blogger1',
    })).rejects.toThrow(AppError);
    try {
      await svc.createArticle({ title: 'T', content: 'x'.repeat(100001), authorId: 'blogger1' });
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('UT-DD-007-034: transitionState draft→pending_review 合法转换', async () => {
    const article = await svc.createArticle({
      title: 'T', content: 'C', authorId: 'blogger1',
    });
    const result = await svc.transitionState(article.id, 'pending_review', { id: 'blogger1', role: 'blogger' });
    expect(result.targetState).toBe('pending_review');
    expect(result.previousState).toBe('draft');
  });

  it('UT-DD-007-035: transitionState draft→published 抛 60001（跳过审核）', async () => {
    const article = await svc.createArticle({
      title: 'T', content: 'C', authorId: 'blogger1',
    });
    await expect(svc.transitionState(
      article.id, 'published', { id: 'admin1', role: 'admin' },
    )).rejects.toThrow(AppError);
    try {
      await svc.transitionState(article.id, 'published', { id: 'admin1', role: 'admin' });
    } catch (e) {
      expect((e as AppError).code).toBe(60001);
    }
  });

  it('UT-DD-007-036: transitionState 非 admin 触发 published 抛 40301', async () => {
    const article = await svc.createArticle({
      title: 'T', content: 'C', authorId: 'blogger1',
    });
    // 先转到 pending_review（blogger 可触发）
    await svc.transitionState(article.id, 'pending_review', { id: 'blogger1', role: 'blogger' });
    // 非 admin 触发 published
    await expect(svc.transitionState(
      article.id, 'published', { id: 'blogger1', role: 'blogger' },
    )).rejects.toThrow(AppError);
    try {
      await svc.transitionState(article.id, 'published', { id: 'blogger1', role: 'blogger' });
    } catch (e) {
      expect((e as AppError).code).toBe(40301);
    }
  });

  it('UT-DD-007-037: listArticles 按 author 过滤分页', async () => {
    await svc.createArticle({ title: 'A1', content: 'C', authorId: 'blogger1' });
    await svc.createArticle({ title: 'A2', content: 'C', authorId: 'blogger1' });
    await svc.createArticle({ title: 'A3', content: 'C', authorId: 'blogger2' });
    const page = svc.listArticles({ authorId: 'blogger1' }, 1, 10);
    expect(page.list.every(a => a.authorId === 'blogger1')).toBe(true);
    expect(page.total).toBe(2);
  });
});

describe('DD-008 ArticleStateMachine', () => {
  it('UT-DD-008-038: canTransition 合法转换', () => {
    expect(ArticleStateMachine.canTransition('draft', 'pending_review')).toBe(true);
    expect(ArticleStateMachine.canTransition('published', 'taken_down')).toBe(true);
    expect(ArticleStateMachine.canTransition('pending_review', 'published')).toBe(true);
  });

  it('UT-DD-008-039: canTransition 非法转换（NoSkippedReview）', () => {
    expect(ArticleStateMachine.canTransition('draft', 'published')).toBe(false);
    expect(ArticleStateMachine.canTransition('archived', 'published')).toBe(false);
  });

  it('UT-DD-008-040: transition 执行转换返回新 article', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'draft' as const,
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    const updated = ArticleStateMachine.transition(article, 'pending_review');
    expect(updated.status).toBe('pending_review');
  });

  it('UT-DD-008-041: getLegalTransitions 返回合法后继', () => {
    const legal = ArticleStateMachine.getLegalTransitions('draft');
    expect(legal).toEqual(expect.arrayContaining(['draft', 'pending_review']));
    expect(legal).not.toContain('published');
  });

  it('transition 非法转换抛 60001', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'archived' as const,
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    expect(() => ArticleStateMachine.transition(article, 'published')).toThrow(AppError);
    try {
      ArticleStateMachine.transition(article, 'published');
    } catch (e) {
      expect((e as AppError).code).toBe(60001);
    }
  });

  it('transition 合法转换设置 publishedAt', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'pending_review' as const,
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    const updated = ArticleStateMachine.transition(article, 'published');
    expect(updated.status).toBe('published');
    expect(updated.publishedAt).toBeDefined();
  });

  it('isValidState 合法/非法状态', () => {
    expect(ArticleStateMachine.isValidState('draft')).toBe(true);
    expect(ArticleStateMachine.isValidState('published')).toBe(true);
    expect(ArticleStateMachine.isValidState('invalid')).toBe(false);
  });

  it('assertNoSkippedReview draft→published 违规抛 60001', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'published' as const,
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    expect(() => ArticleStateMachine.assertNoSkippedReview(article, 'draft')).toThrow(AppError);
  });

  it('assertNoSkippedReview 合法路径不抛异常', () => {
    const now = Math.floor(Date.now() / 1000);
    const article = {
      id: 'a1', authorId: 'b1', title: 'T', content: 'C', status: 'published' as const,
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    expect(() => ArticleStateMachine.assertNoSkippedReview(article, 'pending_review')).not.toThrow();
  });

  it('getLegalTransitions 各状态后继', () => {
    expect(ArticleStateMachine.getLegalTransitions('published')).toEqual(expect.arrayContaining(['taken_down', 'archived']));
    expect(ArticleStateMachine.getLegalTransitions('archived')).toEqual(expect.arrayContaining(['draft']));
  });
});

describe('DD-009 ArticleStore', () => {
  beforeEach(() => {
    articleStore.clear();
  });

  it('UT-DD-009-042: insert + findByAuthor + findByStatus 索引同步', () => {
    const now = Math.floor(Date.now() / 1000);
    const base = {
      authorId: 'u1', title: 'T', content: 'C',
      tagIds: [] as string[], citeArticleIds: [] as string[],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    articleStore.insert({ id: 'a1', ...base, status: 'draft' });
    articleStore.insert({ id: 'a2', ...base, status: 'published' });
    expect(articleStore.findByAuthor('u1').length).toBe(2);
    expect(articleStore.findByStatus('draft').length).toBe(1);
  });

  it('UT-DD-009-043: update status 同步 statusIndex', () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'u1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.update('a1', { status: 'published' });
    expect(articleStore.findByStatus('draft').find(a => a.id === 'a1')).toBeUndefined();
    expect(articleStore.findByStatus('published').find(a => a.id === 'a1')).toBeDefined();
  });

  it('UT-DD-009-044: delete 同步删除所有索引', () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'u1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.delete('a1');
    expect(articleStore.findById('a1')).toBeNull();
    expect(articleStore.findByAuthor('u1').find(a => a.id === 'a1')).toBeUndefined();
  });
});

describe('DD-010 TagService', () => {
  let svc: TagService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new TagService({ walWriter: deps.walWriter });
  });

  it('UT-DD-010-045: createTag + bindTag + getTagCloud', async () => {
    const now = Math.floor(Date.now() / 1000);
    // 先插入文章
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const tag = await svc.createTag('TypeScript', 'blogger1');
    await svc.bindTag('a1', tag.id, 'blogger1');
    const cloud = svc.getTagCloud(10);
    const found = cloud.find(t => t.name === 'TypeScript');
    expect(found).toBeDefined();
    expect(found!.usageCount).toBe(1);
  });

  it('UT-DD-010-046: createTag 标签名超 30 字抛 40003', async () => {
    await expect(svc.createTag('x'.repeat(31), 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.createTag('x'.repeat(31), 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('UT-DD-010-047: createTag 重复名抛 40901', async () => {
    await svc.createTag('TS', 'blogger1');
    await expect(svc.createTag('TS', 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.createTag('TS', 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(40901);
    }
  });

  it('UT-DD-010-048: mergeTags 合并标签并重定向文章标签', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const t1 = await svc.createTag('tag1', 'blogger1');
    const t2 = await svc.createTag('tag2', 'blogger1');
    await svc.bindTag('a1', t1.id, 'blogger1');
    await svc.bindTag('a1', t2.id, 'blogger1');
    const result = await svc.mergeTags(t1.id, t2.id, 'admin');
    expect(result.redirectedCount).toBe(1);
    const article = articleStore.findById('a1');
    expect(article!.tagIds).not.toContain(t1.id);
    expect(article!.tagIds).toContain(t2.id);
  });
});

describe('DD-011 CategoryService', () => {
  let svc: CategoryService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new CategoryService({ walWriter: deps.walWriter });
  });

  it('UT-DD-011-049: createCategory + getCategoryTree 多级树', async () => {
    const c1 = await svc.createCategory({ name: '前端', parentId: undefined }, 'admin');
    const c2 = await svc.createCategory({ name: 'React', parentId: c1.id }, 'admin');
    const tree = svc.getCategoryTree();
    expect(tree[0].children[0].name).toBe('React');
  });

  it('UT-DD-011-050: updateCategory 父子循环抛 60005', async () => {
    const c1 = await svc.createCategory({ name: 'A', parentId: undefined }, 'admin');
    const c2 = await svc.createCategory({ name: 'B', parentId: c1.id }, 'admin');
    await expect(svc.updateCategory(c1.id, { parentId: c2.id }, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.updateCategory(c1.id, { parentId: c2.id }, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(60005);
    }
  });

  it('UT-DD-011-051: getBreadcrumb 返回根到当前路径', async () => {
    const c1 = await svc.createCategory({ name: '前端', parentId: undefined }, 'admin');
    const c2 = await svc.createCategory({ name: 'React', parentId: c1.id }, 'admin');
    const breadcrumb = svc.getBreadcrumb(c2.id);
    expect(breadcrumb.map(c => c.name)).toEqual(['前端', 'React']);
  });
});

describe('DD-012 CrossRefService', () => {
  let svc: CrossRefService;
  let deps: ReturnType<typeof makeDeps>;
  let notifyCalled: boolean;

  beforeEach(() => {
    resetAll();
    notifyCalled = false;
    deps = makeDeps();
    svc = new CrossRefService({
      walWriter: deps.walWriter,
      notifyReference: async () => { notifyCalled = true; },
    });
  });

  it('UT-DD-012-052: addReference 添加引用并触发通知', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'T1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'blogger2', title: 'T2', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const result = await svc.addReference('a1', ['a2'], 'blogger1');
    expect(result.addedCiteIds).toContain('a2');
    expect(notifyCalled).toBe(true);
  });

  it('UT-DD-012-053: addReference 引用自己跳过（skipped）', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const result = await svc.addReference('a1', ['a1'], 'blogger1');
    expect(result.skippedCiteIds).toContain('a1');
    expect(result.addedCiteIds).toHaveLength(0);
  });

  it('UT-DD-012-054: addReference 循环引用抛 60005', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'blogger1', title: 'A2', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a3', authorId: 'blogger1', title: 'A3', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await svc.addReference('a1', ['a2'], 'blogger1');
    await svc.addReference('a2', ['a3'], 'blogger1');
    await expect(svc.addReference('a3', ['a1'], 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.addReference('a3', ['a1'], 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(60005);
    }
  });

  it('addReference 空 citeIds 抛 40003', async () => {
    await expect(svc.addReference('a1', [], 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.addReference('a1', [], 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(40003);
    }
  });

  it('addReference 超过 20 个引用抛 40003', async () => {
    const citeIds = Array.from({ length: 21 }, (_, i) => `cite-${i}`);
    await expect(svc.addReference('a1', citeIds, 'blogger1')).rejects.toThrow(AppError);
  });

  it('addReference 文章不存在抛 40401', async () => {
    await expect(svc.addReference('nonexistent', ['a1'], 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.addReference('nonexistent', ['a1'], 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });

  it('addReference 所有权校验失败抛 40302', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'ax', authorId: 'blogger1', title: 'AX', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'ay', authorId: 'blogger2', title: 'AY', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await expect(svc.addReference('ax', ['ay'], 'wrongUser')).rejects.toThrow(AppError);
    try {
      await svc.addReference('ax', ['ay'], 'wrongUser');
    } catch (e) {
      expect((e as AppError).code).toBe(40302);
    }
  });

  it('addReference 引用不存在的文章跳过（skipped）', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    const result = await svc.addReference('a1', ['nonexistent'], 'blogger1');
    expect(result.skippedCiteIds).toContain('nonexistent');
    expect(result.addedCiteIds).toHaveLength(0);
  });

  it('removeReference 移除引用并更新反向索引', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'blogger2', title: 'A2', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await svc.addReference('a1', ['a2'], 'blogger1');
    await svc.removeReference('a1', 'a2', 'blogger1');
    // 移除后反向引用应不包含 a1
    const back = svc.getBackReferences('a2');
    expect(back.find(a => a.id === 'a1')).toBeUndefined();
  });

  it('removeReference 引用不存在抛 40401', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await expect(svc.removeReference('a1', 'nonexistent', 'blogger1')).rejects.toThrow(AppError);
  });

  it('getBackReferences 返回引用此文章的文章列表', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'blogger2', title: 'A2', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await svc.addReference('a1', ['a2'], 'blogger1');
    const back = svc.getBackReferences('a2');
    expect(back.find(a => a.id === 'a1')).toBeDefined();
  });

  it('getReferenceGraph 返回引用图谱', async () => {
    const now = Math.floor(Date.now() / 1000);
    articleStore.insert({
      id: 'a1', authorId: 'blogger1', title: 'A1', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    articleStore.insert({
      id: 'a2', authorId: 'blogger2', title: 'A2', content: 'C', status: 'published',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    });
    await svc.addReference('a1', ['a2'], 'blogger1');
    const graph = svc.getReferenceGraph('a1', 1);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges.find(e => e.from === 'a1' && e.to === 'a2')).toBeDefined();
  });

  it('getReferenceGraph 非法 depth 抛 40003', () => {
    expect(() => svc.getReferenceGraph('a1', 0)).toThrow(AppError);
    expect(() => svc.getReferenceGraph('a1', 4)).toThrow(AppError);
  });

  it('detectCycle 自引用返回 true', () => {
    expect(svc.detectCycle('a1', 'a1')).toBe(true);
  });
});

// DD-007 ArticleService 补充测试（覆盖率提升）
describe('DD-007 ArticleService 补充', () => {
  let svc: ArticleService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
    resetAll();
    deps = makeDeps();
    svc = new ArticleService({ walWriter: deps.walWriter, auditLogger: deps.auditLogger });
  });

  it('updateArticle 正常更新文章', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    const updated = await svc.updateArticle(article.id, { title: 'Updated' }, 'blogger1');
    expect(updated.title).toBe('Updated');
  });

  it('updateArticle 文章不存在抛 40401', async () => {
    await expect(svc.updateArticle('nonexistent', { title: 'T' }, 'blogger1')).rejects.toThrow(AppError);
  });

  it('updateArticle 所有权校验失败抛 40302', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    await expect(svc.updateArticle(article.id, { title: 'T2' }, 'wrongUser')).rejects.toThrow(AppError);
  });

  it('updateArticle 非 draft/pending_review 状态抛 60002', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    await svc.transitionState(article.id, 'pending_review', { id: 'blogger1', role: 'blogger' });
    await svc.transitionState(article.id, 'published', { id: 'admin1', role: 'admin' });
    await expect(svc.updateArticle(article.id, { title: 'T2' }, 'blogger1')).rejects.toThrow(AppError);
    try {
      await svc.updateArticle(article.id, { title: 'T2' }, 'blogger1');
    } catch (e) {
      expect((e as AppError).code).toBe(60002);
    }
  });

  it('getArticle 获取文章并增加阅读数', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    // 转为 published 才能被非作者查看
    await svc.transitionState(article.id, 'pending_review', { id: 'blogger1', role: 'blogger' });
    await svc.transitionState(article.id, 'published', { id: 'admin1', role: 'admin' });
    const got = svc.getArticle(article.id, 'viewer1');
    expect(got.stats.views).toBe(1);
  });

  it('getArticle 文章不存在抛 40401', () => {
    expect(() => svc.getArticle('nonexistent')).toThrow(AppError);
  });

  it('getArticle 非作者查看未发布文章抛 40301', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    expect(() => svc.getArticle(article.id)).toThrow(AppError);
    try {
      svc.getArticle(article.id);
    } catch (e) {
      expect((e as AppError).code).toBe(40301);
    }
  });

  it('deleteArticle 正常删除 draft 文章', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    await svc.deleteArticle(article.id, 'blogger1');
    expect(articleStore.findById(article.id)).toBeNull();
  });

  it('deleteArticle 非 draft/archived 状态抛 60002', async () => {
    const article = await svc.createArticle({ title: 'T', content: 'C', authorId: 'blogger1' });
    await svc.transitionState(article.id, 'pending_review', { id: 'blogger1', role: 'blogger' });
    await expect(svc.deleteArticle(article.id, 'blogger1')).rejects.toThrow(AppError);
  });

  it('listArticles 非法 page/size 抛 40003', () => {
    expect(() => svc.listArticles({}, 0, 10)).toThrow(AppError);
    expect(() => svc.listArticles({}, 1, 0)).toThrow(AppError);
    expect(() => svc.listArticles({}, 1, 101)).toThrow(AppError);
  });

  it('batchManage admin 批量归档', async () => {
    const a1 = await svc.createArticle({ title: 'T1', content: 'C', authorId: 'blogger1' });
    const a2 = await svc.createArticle({ title: 'T2', content: 'C', authorId: 'blogger1' });
    const result = await svc.batchManage([a1.id, a2.id], 'archive', { id: 'admin1', role: 'admin' });
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('batchManage 非 admin 抛 40301', async () => {
    await expect(svc.batchManage(['a1'], 'archive', { id: 'blogger1', role: 'blogger' })).rejects.toThrow(AppError);
  });

  it('batchManage 批量删除含失败项', async () => {
    const a1 = await svc.createArticle({ title: 'T1', content: 'C', authorId: 'blogger1' });
    const result = await svc.batchManage([a1.id, 'nonexistent'], 'delete', { id: 'admin1', role: 'admin' });
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
  });
});
