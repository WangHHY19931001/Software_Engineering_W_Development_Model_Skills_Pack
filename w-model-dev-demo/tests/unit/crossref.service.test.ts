// SD-013 CrossReferenceStore + CrossReferenceService unit tests (TC-UNIT-055 ~ TC-UNIT-058).

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossReferenceStore } from '../../src/stores/crossref.store.js';
import { CrossReferenceService } from '../../src/services/crossref.service.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { ArticleStatus, TagStatus } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-013 CrossReferenceStore + CrossReferenceService (TC-UNIT-055 ~ 058)', () => {
  let crossRefStore: CrossReferenceStore;
  let articleStore: ArticleStore;
  let tagStore: TagStore;
  let crossRefService: CrossReferenceService;

  beforeEach(() => {
    crossRefStore = new CrossReferenceStore();
    articleStore = new ArticleStore();
    tagStore = new TagStore();
    crossRefService = new CrossReferenceService(crossRefStore, articleStore, tagStore);
  });

  /** Helper: create + publish an article and return it. */
  function makePublishedArticle(idHint: string): { id: string; title: string } {
    const a = articleStore.create('blogger-1', { title: idHint, content: 'c' });
    a.status = ArticleStatus.Published;
    articleStore.update(a);
    return { id: a.id, title: a.title };
  }

  it('TC-UNIT-055: self-reference citation throws 1003', () => {
    const a = makePublishedArticle('a1');
    expect(() =>
      crossRefStore.create(a.id, a.id, () => 'published'),
    ).toThrow(AppError);
    try {
      crossRefStore.create(a.id, a.id, () => 'published');
    } catch (err) {
      expect((err as AppError).code).toBe(1003);
    }
  });

  it('TC-UNIT-056: duplicate citation throws 1005', () => {
    const a1 = makePublishedArticle('a1');
    const a2 = makePublishedArticle('a2');
    crossRefStore.create(a1.id, a2.id, () => 'published');

    expect(() => crossRefStore.create(a1.id, a2.id, () => 'published')).toThrow(AppError);
    try {
      crossRefStore.create(a1.id, a2.id, () => 'published');
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-057: backlinks query returns referencing articles', () => {
    const a1 = makePublishedArticle('a1');
    const a2 = makePublishedArticle('a2');
    // a-2 cites a-1.
    crossRefService.addCitation(a2.id, a1.id);

    const back = crossRefService.backlinks(a1.id);
    expect(back).toHaveLength(1);
    expect(back[0]!.fromArticleId).toBe(a2.id);
  });

  it('TC-UNIT-058: related articles use Jaccard similarity on shared tags', () => {
    const a1 = makePublishedArticle('a1');
    const a2 = makePublishedArticle('a2');
    const a3 = makePublishedArticle('a3');

    // Create + approve 2 tags, bind to a1 and a2 (shared), not a3.
    const t1 = tagStore.create('shared-1', 'slug-1');
    tagStore.approve(t1.id);
    const t2 = tagStore.create('shared-2', 'slug-2');
    tagStore.approve(t2.id);
    // Bind to a1 and a2.
    tagStore.bind(a1.id, [t1.id, t2.id]);
    tagStore.bind(a2.id, [t1.id, t2.id]);
    // a3 gets a different tag.
    const t3 = tagStore.create('other', 'slug-3');
    tagStore.approve(t3.id);
    tagStore.bind(a3.id, [t3.id]);

    const result = crossRefService.related(a1.id, 5);
    // a2 shares 2 tags with a1 → score > 0.
    const a2Entry = result.find((r) => r.articleId === a2.id);
    expect(a2Entry).toBeDefined();
    expect(a2Entry!.score).toBeGreaterThan(0);
    // a3 shares no tags → not in result.
    const a3Entry = result.find((r) => r.articleId === a3.id);
    expect(a3Entry).toBeUndefined();
  });
});
