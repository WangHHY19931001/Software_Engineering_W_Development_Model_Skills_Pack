// 验收测试 - 搜索/标签/分类/统计 (UAT-016 ~ UAT-027).
// 覆盖 REQ-006 统计 / REQ-007 搜索 / REQ-008 标签 / REQ-009 分类.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { StatsStore } from '../../src/stores/stats.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { TagService } from '../../src/services/tag.service.js';
import { CategoryService } from '../../src/services/category.service.js';
import { StatsService } from '../../src/services/stats.service.js';
import { tagNameSchema } from '../../src/utils/schemas.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import { UserRole } from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-016~027 搜索/标签/分类/统计验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let siteStore: SiteStore;
  let statsStore: StatsStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let searchService: SearchService;
  let tagService: TagService;
  let categoryService: CategoryService;
  let statsService: StatsService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    siteStore = new SiteStore();
    statsStore = new StatsStore();
    const bloggerStore = new BloggerStore();
    const commentStore = new CommentStore();
    const fileStore = new FileStore();
    const subscriptionStore = new SubscriptionStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    statsStore.setStores({ articleStore, userStore, bloggerStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    searchService = new SearchService(searchStore);
    tagService = new TagService(tagStore);
    categoryService = new CategoryService(categoryStore);
    statsService = new StatsService(statsStore);
    clearRevokedJtis();
  });

  async function seed() {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword',
      displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword',
      displayName: 'reader',
    });
    return { admin, blogger, reader };
  }

  async function publishArticle(authorId: string, title: string, content: string, adminId: string) {
    const a = articleService.createArticle(authorId, { title, content });
    articleService.submitForReview(authorId, a.id);
    articleService.approveArticle(adminId, UserRole.Admin, a.id);
    return a;
  }

  it('UAT-016: 文章统计正常返回', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, '统计文章', '内容', admin.id);
    // 管理员查看文章统计.
    const stats = statsService.articleStats('admin');
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.published).toBeGreaterThanOrEqual(1);
    // 站点概览.
    const overview = siteStore.getStatsOverview();
    expect(overview.articleCount).toBeGreaterThanOrEqual(1);
    expect(overview.userCount).toBe(3);
  });

  it('UAT-017: 用户统计趋势聚合', async () => {
    const { admin } = await seed();
    // 用户统计（seed 创建 3 个用户：admin/blogger/reader）.
    const userStats = statsService.userStats('admin');
    expect(userStats.total).toBe(3);
    expect(userStats.byRole[UserRole.Admin]).toBe(1);
    expect(userStats.byRole[UserRole.Blogger]).toBe(1);
    expect(userStats.byRole[UserRole.Reader]).toBe(1);
    // 站点趋势：7 天数组.
    const trend = statsService.siteTrend('admin', 7);
    expect(Array.isArray(trend)).toBe(true);
    expect(trend.length).toBeLessThanOrEqual(7);
    // 博主统计.
    const bloggerStats = statsService.bloggerStats('admin');
    expect(bloggerStats).toBeDefined();
  });

  it('UAT-018: 非管理员访问统计异常', async () => {
    const { blogger, reader } = await seed();
    // 普通用户访问统计 → 1021 Rbac.
    expect(() => statsService.articleStats('reader')).toThrow(AppError);
    expect(() => statsService.userStats('blogger')).toThrow(AppError);
    expect(() => statsService.bloggerStats('reader')).toThrow(AppError);
    expect(() => statsService.siteTrend('reader', 7)).toThrow(AppError);
    try {
      statsService.articleStats('reader');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
      expect((e as AppError).httpStatus).toBe(403);
    }
    void blogger;
  });

  it('UAT-019: 全文搜索正常', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, 'TypeScript 入门指南', 'TypeScript 基础教程', admin.id);
    await publishArticle(blogger.id, 'Vue 进阶', 'Vue 框架进阶', admin.id);
    // 全文搜索 TypeScript.
    const result = searchService.search(null, 'TypeScript', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.articleId).toBeTruthy();
    // 搜索 Vue.
    const vue = searchService.search(null, 'Vue', 'relevance', 1, 10);
    expect(vue.total).toBeGreaterThanOrEqual(1);
    // 搜索不存在的关键词.
    const none = searchService.search(null, 'NotFound', 'relevance', 1, 10);
    expect(none.total).toBe(0);
    // 空关键词 → 1001.
    expect(() => searchService.search(null, '', 'relevance', 1, 10)).toThrow(AppError);
  });

  it('UAT-020: 搜索排序模式切换', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, 'React 基础', 'React 内容', admin.id);
    await publishArticle(blogger.id, 'React 进阶', 'React 高级', admin.id);
    // relevance 排序.
    const rel = searchService.search(null, 'React', 'relevance', 1, 10);
    expect(rel.total).toBeGreaterThanOrEqual(2);
    // newest 排序（fall back to score，结果数一致）.
    const newest = searchService.search(null, 'React', 'newest', 1, 10);
    expect(newest.total).toBe(rel.total);
    // popular 排序.
    const popular = searchService.search(null, 'React', 'popular', 1, 10);
    expect(popular.total).toBe(rel.total);
    // 三种模式都返回匹配文章.
    expect(newest.items.length).toBeGreaterThan(0);
    expect(popular.items.length).toBeGreaterThan(0);
  });

  it('UAT-021: 搜索历史 FIFO 淘汰', async () => {
    const { admin, blogger, reader } = await seed();
    void admin; void blogger;
    // SEARCH_HISTORY_MAX=20，循环 25 次最旧被淘汰.
    for (let i = 0; i < 25; i++) {
      searchService.search(reader.id, `关键词${i}`, 'relevance', 1, 10);
    }
    const hist = searchService.history(reader.id);
    expect(hist.length).toBeLessThanOrEqual(20);
    // 最旧一条已被淘汰（关键词0 不在历史中）.
    expect(hist).not.toContain('关键词0');
    // 最新一条在历史中.
    expect(hist).toContain('关键词24');
    // 清空历史.
    searchService.clearSearchHistory(reader.id);
    expect(searchService.history(reader.id).length).toBe(0);
  });

  it('UAT-022: 标签创建与绑定', async () => {
    const { admin, blogger } = await seed();
    const article = await publishArticle(blogger.id, '标签文章', '内容', admin.id);
    // 创建标签 pending.
    const tag = tagService.createTag('TypeScript', 'typescript');
    expect(tag.status).toBe('pending_review');
    // 审核通过.
    const approved = tagService.approveTag(admin.id, 'admin', tag.id);
    expect(approved.status).toBe('approved');
    // 文章绑定标签.
    tagService.bind(article.id, [tag.id]);
    // 标签云.
    const cloud = tagService.cloud(10);
    const ts = cloud.find((c) => c.name === 'TypeScript');
    expect(ts?.articleCount).toBe(1);
  });

  it('UAT-023: 标签合并管理员操作', async () => {
    const { admin, blogger } = await seed();
    const article = await publishArticle(blogger.id, '标签合并', '内容', admin.id);
    const tagA = tagService.createTag('React', 'react');
    tagService.approveTag(admin.id, 'admin', tagA.id);
    const tagB = tagService.createTag('Frontend', 'frontend');
    tagService.approveTag(admin.id, 'admin', tagB.id);
    // 文章绑定 tagA.
    tagService.bind(article.id, [tagA.id]);
    // 合并 tagA → tagB.
    tagService.merge(admin.id, 'admin', tagA.id, tagB.id);
    // 合并后源标签已删除.
    expect(tagStore.getById(tagA.id)).toBeNull();
    // 非 admin 合并 → 1021.
    const tagC = tagService.createTag('Other', 'other');
    tagService.approveTag(admin.id, 'admin', tagC.id);
    expect(() => tagService.merge(blogger.id, 'blogger', tagC.id, tagB.id)).toThrow(AppError);
  });

  it('UAT-024: 标签名特殊字符异常', () => {
    // tagNameSchema 拒绝 < > " ' / \.
    expect(tagNameSchema.safeParse('<script>').success).toBe(false);
    expect(tagNameSchema.safeParse('name"quote').success).toBe(false);
    expect(tagNameSchema.safeParse("name'quote").success).toBe(false);
    expect(tagNameSchema.safeParse('a/b').success).toBe(false);
    expect(tagNameSchema.safeParse('a\\b').success).toBe(false);
    // 合法名称通过.
    expect(tagNameSchema.safeParse('TypeScript').success).toBe(true);
    expect(tagNameSchema.safeParse('前端').success).toBe(true);
    expect(tagNameSchema.safeParse('react-18').success).toBe(true);
    // tagService.createTag 间接由 store 校验（实际 store 也调用 tagNameSchema）.
    const tag = tagService.createTag('合法标签', 'legal-slug');
    expect(tag.name).toBe('合法标签');
  });

  it('UAT-025: 分类树多级创建', async () => {
    await seed();
    // 创建 6 级分类（depth 0~5，MAX_DEPTH=5 允许 depth<=5）.
    let parentId: string | null = null;
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const cat = categoryService.createCategory(`L${i}`, parentId);
      ids.push(cat.id);
      parentId = cat.id;
      expect(cat.depth).toBe(i);
    }
    // 第 7 级 → 1004 depth 超 MAX_DEPTH.
    expect(() => categoryService.createCategory('L6', parentId)).toThrow(AppError);
    try {
      categoryService.createCategory('L6', parentId);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.DepthLimit);
    }
    // 树结构.
    const tree = categoryService.tree();
    expect(tree.length).toBeGreaterThanOrEqual(1);
    // 面包屑.
    const breadcrumb = categoryService.breadcrumb(ids[5]!);
    expect(breadcrumb.length).toBe(6);
    expect(breadcrumb[0]?.name).toBe('L0');
    expect(breadcrumb[5]?.name).toBe('L5');
  });

  it('UAT-026: 分类级联删除边界', async () => {
    const { admin, blogger } = await seed();
    // 创建分类 C1 → C2.
    const c1 = categoryService.createCategory('技术', null);
    const c2 = categoryService.createCategory('前端', c1.id);
    expect(c1.depth).toBe(0);
    expect(c2.depth).toBe(1);
    // 文章绑定 c2.
    const article = articleService.createArticle(blogger.id, { title: '分类文章', content: '内容' });
    categoryService.bindCategory(article.id, c2.id);
    // 级联删除 C1 → C2 也被删除.
    categoryService.cascadeDelete(admin.id, 'admin', c1.id);
    expect(categoryService.tree().length).toBe(0);
    // 非 admin 级联删除 → 1021.
    const c3 = categoryService.createCategory('其他', null);
    expect(() => categoryService.cascadeDelete(blogger.id, 'blogger', c3.id)).toThrow(AppError);
  });

  it('UAT-027: 分类排序正常', async () => {
    await seed();
    // 创建同級分类 C1(sortOrder 默认)、C2、C3 — tree 按 sortOrder 升序返回.
    const c1 = categoryService.createCategory('C1', null);
    const c2 = categoryService.createCategory('C2', null);
    const c3 = categoryService.createCategory('C3', null);
    // tree 返回按 sortOrder 升序排列（createCategory 默认 sortOrder 递增）.
    const tree = categoryService.tree();
    expect(tree.length).toBe(3);
    // sortOrder 应递增（C1 < C2 < C3）.
    const orders = tree.map((n) => n.category.sortOrder);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]!);
    }
    // 验证 ID 都在结果中.
    const ids = tree.map((n) => n.category.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);
    expect(ids).toContain(c3.id);
  });
});
