import { describe, it, expect } from 'vitest';
import {
  ArticleVisibilityChecker,
  OwnershipChecker,
  CategoryCycleChecker,
  CommentCascadeDeleter,
  PasswordResetTokenUtil,
} from '../../../src/utils/article-helpers.js';

const mkArticle = (overrides: Partial<{ status: string; authorId: string }> = {}) => ({
  id: 'a1',
  title: 't',
  content: 'c',
  authorId: 'u1',
  categoryId: null,
  tagIds: [],
  status: 'draft',
  likeCount: 0,
  viewCount: 0,
  publishedAt: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('ArticleVisibilityChecker (DD-007-003)', () => {
  it('TC-UNIT-020N: published 文章所有人可见', () => {
    const v = new ArticleVisibilityChecker();
    expect(v.isVisible(mkArticle({ status: 'published' }) as never, 'reader', 'u2')).toBe(true);
  });

  it('TC-UNIT-020E: draft 文章非作者/非 admin 不可见', () => {
    const v = new ArticleVisibilityChecker();
    expect(v.isVisible(mkArticle({ status: 'draft' }) as never, 'reader', 'u2')).toBe(false);
  });

  it('TC-UNIT-020B: draft 文章作者/admin 可见', () => {
    const v = new ArticleVisibilityChecker();
    expect(v.isVisible(mkArticle({ status: 'draft', authorId: 'u1' }) as never, 'author', 'u1')).toBe(true);
    expect(v.isVisible(mkArticle({ status: 'draft' }) as never, 'admin', 'u2')).toBe(true);
  });

  it('assertVisible 不可见时抛错', () => {
    const v = new ArticleVisibilityChecker();
    expect(() => v.assertVisible(mkArticle({ status: 'draft' }) as never, 'reader', 'u2')).toThrow();
  });
});

describe('OwnershipChecker (DD-008-003)', () => {
  it('TC-UNIT-023N: 作者本人通过', () => {
    const o = new OwnershipChecker();
    expect(() => o.assertOwner('u1', 'u1', 'author')).not.toThrow();
  });

  it('TC-UNIT-023E: 非作者抛错', () => {
    const o = new OwnershipChecker();
    expect(() => o.assertOwner('u1', 'u2', 'author')).toThrow();
  });

  it('TC-UNIT-023B: admin 跳过检查', () => {
    const o = new OwnershipChecker();
    expect(() => o.assertOwner('u1', 'u2', 'admin')).not.toThrow();
    expect(o.isOwner('u1', 'u2', 'admin')).toBe(true);
  });
});

describe('CategoryCycleChecker (DD-014-003 / L3_category_cycle_check)', () => {
  it('TC-UNIT-044N: parent=null 始终无环', () => {
    const c = new CategoryCycleChecker();
    expect(c.check('c1', null, new Map())).toBe(true);
  });

  it('TC-UNIT-044E: 自引用检测为环', () => {
    const c = new CategoryCycleChecker();
    expect(c.check('c1', 'c1', new Map())).toBe(false);
  });

  it('TC-UNIT-044B: 父链形成环检测', () => {
    const c = new CategoryCycleChecker();
    const cats = new Map([
      ['c1', { id: 'c1', parentCategoryId: 'c2' }],
      ['c2', { id: 'c2', parentCategoryId: 'c3' }],
      ['c3', { id: 'c3', parentCategoryId: 'c1' }],
    ]);
    expect(c.check('c1', 'c2', cats)).toBe(false);
    expect(c.assertNoCycle).toBeDefined();
  });
});

describe('CommentCascadeDeleter (DD-009-003)', () => {
  it('TC-UNIT-029N: 收集指定文章所有评论 id', () => {
    const comments = new Map([
      ['c1', { id: 'c1', articleId: 'a1' }],
      ['c2', { id: 'c2', articleId: 'a1' }],
      ['c3', { id: 'c3', articleId: 'a2' }],
    ]);
    const ids = CommentCascadeDeleter.collectCommentsToDelete('a1', comments);
    expect(ids.sort()).toEqual(['c1', 'c2']);
  });

  it('TC-UNIT-029E: 文章无评论返回空数组', () => {
    expect(CommentCascadeDeleter.collectCommentsToDelete('x', new Map())).toEqual([]);
  });
});

describe('PasswordResetTokenUtil (DD-016-004 / L4_password_reset_token_lifecycle)', () => {
  it('TC-UNIT-049N: generateExpiry 默认 15 分钟后', () => {
    const now = new Date('2026-07-26T00:00:00Z');
    const e = PasswordResetTokenUtil.generateExpiry(now);
    expect(new Date(e).getTime() - now.getTime()).toBe(15 * 60 * 1000);
  });

  it('TC-UNIT-049E: assertUsable 已使用抛错（OneTimeUse）', () => {
    expect(() =>
      PasswordResetTokenUtil.assertUsable({ used: true, expiresAt: '2099-01-01' }),
    ).toThrow();
  });

  it('TC-UNIT-049B: assertUsable 已过期抛错（TokenExpiry15min）', () => {
    expect(() =>
      PasswordResetTokenUtil.assertUsable({ used: false, expiresAt: '2020-01-01' }),
    ).toThrow();
  });

  it('isExpired: 边界 = 过期时间等于当前时间判定为过期', () => {
    const now = new Date('2026-07-26T00:00:00Z');
    expect(PasswordResetTokenUtil.isExpired('2026-07-26T00:00:00Z', now)).toBe(true);
  });
});
