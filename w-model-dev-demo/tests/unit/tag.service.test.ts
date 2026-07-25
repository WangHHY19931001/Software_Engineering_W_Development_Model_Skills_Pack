// SD-008 TagStore + TagService unit tests (TC-UNIT-032 ~ TC-UNIT-035).

import { describe, it, expect, beforeEach } from 'vitest';
import { TagStore } from '../../src/stores/tag.store.js';
import { TagService } from '../../src/services/tag.service.js';
import { TagStatus, UserRole } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-008 TagStore + TagService (TC-UNIT-032 ~ 035)', () => {
  let tagStore: TagStore;
  let tagService: TagService;

  beforeEach(() => {
    tagStore = new TagStore();
    tagService = new TagService(tagStore);
  });

  it('TC-UNIT-032: tag name with special chars throws 1001', () => {
    expect(() => tagStore.create('<script>', 'slug-1')).toThrow(AppError);
    try {
      tagStore.create('<script>', 'slug-1');
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-033: bind more than 10 tags to article throws 1001', () => {
    // Create 11 approved tags.
    const tagIds: string[] = [];
    for (let i = 0; i < 11; i++) {
      const t = tagStore.create(`tag-${i}`, `slug-${i}`);
      // Approve each tag.
      const approved = tagStore.approve(t.id);
      expect(approved.status).toBe(TagStatus.Approved);
      tagIds.push(t.id);
    }

    expect(() => tagService.bind('a-1', tagIds)).toThrow(AppError);
    try {
      tagService.bind('a-1', tagIds);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-UNIT-034: tag cloud sorted by articleCount descending', () => {
    // Create 3 approved tags with different article counts.
    const t1 = tagStore.create('tag-a', 'slug-a');
    tagStore.approve(t1.id);
    const t2 = tagStore.create('tag-b', 'slug-b');
    tagStore.approve(t2.id);
    const t3 = tagStore.create('tag-c', 'slug-c');
    tagStore.approve(t3.id);

    // Bind articles: t1 → 3, t2 → 1, t3 → 2.
    tagStore.bind('a-1', [t1.id]);
    tagStore.bind('a-2', [t1.id]);
    tagStore.bind('a-3', [t1.id]);
    tagStore.bind('a-4', [t3.id]);
    tagStore.bind('a-5', [t3.id]);
    tagStore.bind('a-6', [t2.id]);

    const result = tagService.cloud(3);
    expect(result).toHaveLength(3);
    expect(result[0]!.articleCount).toBeGreaterThanOrEqual(result[1]!.articleCount);
    expect(result[1]!.articleCount).toBeGreaterThanOrEqual(result[2]!.articleCount);
  });

  it('TC-UNIT-035: tag self-merge throws 1003', () => {
    const t = tagStore.create('tag-x', 'slug-x');
    tagStore.approve(t.id);

    expect(() => tagService.merge('admin-1', UserRole.Admin, t.id, t.id)).toThrow(AppError);
    try {
      tagService.merge('admin-1', UserRole.Admin, t.id, t.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1003);
    }
  });
});
