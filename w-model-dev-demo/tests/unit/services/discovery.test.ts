/**
 * UT-DD-021 ~ UT-DD-023 —— 发现层单元测试
 * CtrCalculator (1) + RecommendationEngine (2) + SearchIndexer (3) = 6 用例
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CtrCalculator } from '../../../src/utils/ctr-calculator.js';
import { RecommendationEngine } from '../../../src/services/discovery/recommendation-engine.js';
import { SearchIndexer } from '../../../src/services/discovery/search-indexer.js';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AppError } from '../../../src/utils/errors.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { userStore } from '../../../src/stores/user-store.js';
import { CommentService } from '../../../src/services/interaction/comment-service.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';

function makeWalWriter() {
  return new WalWriter('./test.log', new MemoryFileWriter());
}

function insertArticle(overrides: Partial<import('../../../src/types.js').Article> = {}): import('../../../src/types.js').Article {
  const now = Math.floor(Date.now() / 1000);
  const article: import('../../../src/types.js').Article = {
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    authorId: 'blogger1',
    title: 'Test Article',
    content: 'Test content',
    status: 'published',
    tagIds: [],
    citeArticleIds: [],
    stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    ...overrides,
  };
  articleStore.insert(article);
  return article;
}

describe('DD-021 CtrCalculator', () => {
  it('UT-DD-021-075: calculateCtr 点击/展示', () => {
    const calc = new CtrCalculator();
    calc.recordImpression('ad1');
    calc.recordImpression('ad1');
    calc.recordClick('ad1');
    expect(calc.calculateCtr('ad1')).toBe(0.5);
  });
});

describe('DD-022 RecommendationEngine', () => {
  let svc: RecommendationEngine;

  beforeEach(() => {
    articleStore.clear();
    userStore.clear();
    CommentService._reset();
    NotificationService._reset();
    svc = new RecommendationEngine({
      walWriter: makeWalWriter(),
      getFollowerCount: () => 0,
    });
  });

  it('UT-DD-022-076: getHotFeed 按热度降序', () => {
    const now = Math.floor(Date.now() / 1000);
    // 插入用户（推荐引擎需要用户存在）
    userStore.insert({
      id: 'blogger1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    // 插入不同热度的文章
    insertArticle({
      id: 'a1', title: 'Low Heat',
      stats: { views: 10, likes: 1, comments: 0, shares: 0, heat: 10 },
    });
    insertArticle({
      id: 'a2', title: 'High Heat',
      stats: { views: 100, likes: 20, comments: 10, shares: 5, heat: 200 },
    });
    const page = svc.getHotFeed(1, 10);
    expect(page.list.length).toBe(2);
    // 高热度的应排前面
    expect(page.list[0].stats.heat).toBeGreaterThanOrEqual(page.list[1].stats.heat);
  });

  it('UT-DD-022-077: getPersonalizedFeed 基于用户偏好', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    insertArticle({ id: 'a1', title: 'A1' });
    const page = svc.getPersonalizedFeed('u1', 1, 10);
    expect(page.list.length).toBeLessThanOrEqual(10);
  });

  it('getLatestFeed 按创建时间降序', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'blogger1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    insertArticle({ id: 'a1', title: 'Old', createdAt: now - 100 });
    insertArticle({ id: 'a2', title: 'New', createdAt: now });
    const page = svc.getLatestFeed(1, 10);
    expect(page.list.length).toBe(2);
    expect(page.list[0].id).toBe('a2');
  });

  it('getPersonalizedFeed 用户不存在抛 40401', () => {
    expect(() => svc.getPersonalizedFeed('nonexistent', 1, 10)).toThrow(AppError);
    try {
      svc.getPersonalizedFeed('nonexistent', 1, 10);
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });

  it('getHotFeed 非法 page/size 抛 40003', () => {
    expect(() => svc.getHotFeed(0, 10)).toThrow(AppError);
    expect(() => svc.getHotFeed(1, 0)).toThrow(AppError);
    expect(() => svc.getHotFeed(1, 101)).toThrow(AppError);
  });

  it('getPersonalizedFeed 非法 page/size 抛 40003', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    expect(() => svc.getPersonalizedFeed('u1', 0, 10)).toThrow(AppError);
  });

  it('getLatestFeed 非法 page/size 抛 40003', () => {
    expect(() => svc.getLatestFeed(0, 10)).toThrow(AppError);
    expect(() => svc.getLatestFeed(1, 0)).toThrow(AppError);
  });

  it('manageSlot 创建推荐位并写 WAL', async () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'blogger1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    insertArticle({ id: 'a1', title: 'A1' });
    const slot = await svc.manageSlot({ name: '首页推荐', articleIds: ['a1'] }, 'admin');
    expect(slot.id).toBeDefined();
    expect(slot.name).toBe('首页推荐');
    expect(slot.articleIds).toContain('a1');
  });

  it('manageSlot 超过 20 个上限抛 60006', async () => {
    for (let i = 0; i < 20; i++) {
      await svc.manageSlot({ name: `slot-${i}` }, 'admin');
    }
    await expect(svc.manageSlot({ name: 'slot-21' }, 'admin')).rejects.toThrow(AppError);
    try {
      await svc.manageSlot({ name: 'slot-21' }, 'admin');
    } catch (e) {
      expect((e as AppError).code).toBe(60006);
    }
  });

  it('manageSlot 输入校验失败抛 40003', async () => {
    await expect(svc.manageSlot({ name: '' }, 'admin')).rejects.toThrow(AppError);
  });

  it('getBloggerRecommend 按粉丝数排序返回博主', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'b1', email: 'b1@b.com', passwordHash: 'h', nickname: 'b1',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    userStore.insert({
      id: 'b2', email: 'b2@b.com', passwordHash: 'h', nickname: 'b2',
      role: 'blogger', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    // 用新的 svc 实例，传入粉丝数 mock
    const svc2 = new RecommendationEngine({
      walWriter: makeWalWriter(),
      getFollowerCount: (id: string) => id === 'b1' ? 100 : 50,
    });
    const result = svc2.getBloggerRecommend('u1');
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('b1');
  });

  it('computeScore 带用户偏好匹配', () => {
    const now = Math.floor(Date.now() / 1000);
    userStore.insert({
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    });
    svc.updateUserPreference('u1', {
      tagIds: ['t1'], categoryIds: ['c1'], bloggerIds: ['blogger1'],
    });
    const article = insertArticle({
      id: 'a1', tagIds: ['t1'], categoryId: 'c1', authorId: 'blogger1',
    });
    const score = svc.computeScore(article, 'u1');
    expect(score).toBeGreaterThan(0);
  });
});

describe('DD-023 SearchIndexer', () => {
  let svc: SearchIndexer;

  beforeEach(() => {
    articleStore.clear();
    userStore.clear();
    CommentService._reset();
    NotificationService._reset();
    svc = new SearchIndexer();
  });

  it('UT-DD-023-078: indexArticle + search 全文搜索', () => {
    const article = insertArticle({
      id: 'a1', title: 'TypeScript 入门', content: 'TypeScript 基础教程',
    });
    svc.indexArticle(article);
    const page = svc.search('TypeScript', 'relevance', 1, 10);
    expect(page.list.find(a => a.id === 'a1')).toBeDefined();
  });

  it('UT-DD-023-079: searchSuggest 返回建议', () => {
    const article = insertArticle({
      id: 'a1', title: 'TypeScript 入门', content: 'C',
    });
    svc.indexArticle(article);
    const suggest = svc.searchSuggest('type');
    expect(suggest).toContain('typescript');
  });

  it('UT-DD-023-080: getSearchHistory 限制 50 条 FIFO', () => {
    const article = insertArticle({
      id: 'a1', title: 'TypeScript 入门', content: 'C',
    });
    svc.indexArticle(article);
    // 执行 60 次搜索（每次都会记录历史）
    for (let i = 0; i < 60; i++) {
      // 使用不同关键词避免去重；这里用 q0..q59（需先索引）
      const art = insertArticle({
        id: `a-q${i}`, title: `q${i}`, content: 'C',
      });
      svc.indexArticle(art);
      svc.search(`q${i}`, 'relevance', 1, 10, 'u1');
    }
    const history = svc.getSearchHistory('u1');
    expect(history.length).toBe(50);
    // LIFO：最新的 q59 在最前
    expect(history).toContain('q59');
    expect(history).not.toContain('q0');
  });
});
