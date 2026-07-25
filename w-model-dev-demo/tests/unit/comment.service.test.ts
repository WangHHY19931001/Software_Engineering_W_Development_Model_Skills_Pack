// SD-010 CommentStore + CommentService unit tests (TC-UNIT-040 ~ TC-UNIT-044).

import { describe, it, expect, beforeEach } from 'vitest';
import { CommentStore } from '../../src/stores/comment.store.js';
import { CommentService } from '../../src/services/comment.service.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { ArticleStatus, CommentStatus, MAX_DEPTH, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-010 CommentStore + CommentService (TC-UNIT-040 ~ 044)', () => {
  let commentStore: CommentStore;
  let articleStore: ArticleStore;
  let siteStore: SiteStore;
  let commentService: CommentService;

  beforeEach(() => {
    commentStore = new CommentStore();
    articleStore = new ArticleStore();
    siteStore = new SiteStore();
    commentService = new CommentService(commentStore, articleStore, siteStore);
  });

  /** Helper: create a published article and return its id. */
  function makePublishedArticle(): string {
    const a = articleStore.create('blogger-1', { title: 't', content: 'c' });
    a.status = ArticleStatus.Published;
    articleStore.update(a);
    return a.id;
  }

  it('TC-UNIT-040: nested comment depth exceeding MAX_DEPTH throws 1004', () => {
            const articleId = makePublishedArticle();
            // Build a chain of MAX_DEPTH+1 approved comments (depths 0..MAX_DEPTH).
            // Source check is `depth > MAX_DEPTH`, so depth=MAX_DEPTH is allowed; depth=MAX_DEPTH+1 throws.
            let parentId: string | null = null;
            for (let i = 0; i <= MAX_DEPTH; i++) {
              const c = commentStore.create(articleId, 'u-1', parentId, 'content', {
                articleStatus: 'published',
                commentOpen: true,
              });
              c.status = CommentStatus.Approved;
              commentStore.update(c);
              parentId = c.id;
            }
            // Now adding one more reply would have depth = MAX_DEPTH+1 → throws.
            expect(() =>
              commentStore.create(articleId, 'u-1', parentId, 'too-deep', {
                articleStatus: 'published',
                commentOpen: true,
              }),
            ).toThrow(AppError);
    try {
      commentStore.create(articleId, 'u-1', parentId, 'too-deep', {
        articleStatus: 'published',
        commentOpen: true,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1004);
    }
  });

  it('TC-UNIT-041: comment creation rejected when commentOpen=false (1025)', () => {
    const articleId = makePublishedArticle();
    expect(() =>
      commentStore.create(articleId, 'u-1', null, 'content', {
        articleStatus: 'published',
        commentOpen: false,
      }),
    ).toThrow(AppError);
    try {
      commentStore.create(articleId, 'u-1', null, 'content', {
        articleStatus: 'published',
        commentOpen: false,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1025);
    }
  });

  it('TC-UNIT-042: comment like is idempotent (no duplicate increment)', () => {
    const articleId = makePublishedArticle();
    const comment = commentStore.create(articleId, 'u-1', null, 'content', {
      articleStatus: 'published',
      commentOpen: true,
    });
    comment.status = CommentStatus.Approved;
    commentStore.update(comment);

    commentService.like('u-1', comment.id);
    commentService.like('u-1', comment.id); // second like is a no-op.

    const updated = commentStore.getById(comment.id);
    expect(updated?.likeCount).toBe(1);
  });

  it('TC-UNIT-043: comment audit illegal state transition throws 1002', () => {
    const articleId = makePublishedArticle();
    const comment = commentStore.create(articleId, 'u-1', null, 'content', {
      articleStatus: 'published',
      commentOpen: true,
    });
    // Move comment to Rejected status.
    comment.status = CommentStatus.Rejected;
    commentStore.update(comment);

    expect(() => commentService.audit('admin-1', UserRole.Admin, comment.id, 'approve')).toThrow(
      AppError,
    );
    try {
      commentService.audit('admin-1', UserRole.Admin, comment.id, 'approve');
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-044: comment list sorted by popular (likeCount desc)', () => {
    const articleId = makePublishedArticle();
    const c1 = commentStore.create(articleId, 'u-1', null, 'c1', {
      articleStatus: 'published',
      commentOpen: true,
    });
    c1.status = CommentStatus.Approved;
    commentStore.update(c1);
    const c2 = commentStore.create(articleId, 'u-2', null, 'c2', {
      articleStatus: 'published',
      commentOpen: true,
    });
    c2.status = CommentStatus.Approved;
    commentStore.update(c2);
    const c3 = commentStore.create(articleId, 'u-3', null, 'c3', {
      articleStatus: 'published',
      commentOpen: true,
    });
    c3.status = CommentStatus.Approved;
    commentStore.update(c3);

    // c2 gets 5 likes, c1 gets 1 like, c3 gets 0.
    for (let i = 0; i < 5; i++) {
      commentStore.like(`u-${100 + i}`, c2.id);
    }
    commentStore.like('u-200', c1.id);

    const result = commentService.listByArticle(articleId, 1, 10, 'popular');
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.likeCount).toBeGreaterThan(result.items[1]!.likeCount);
    expect(result.items[0]!.id).toBe(c2.id);
  });
});
