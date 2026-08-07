/**
 * UT-009 标签重名冲突（tagService.createTag，DD-009/INTF-009）
 */
import { describe, it, expect } from 'vitest';
import { TagStore } from '../../../src/stores/tagStore';
import { ArticleStore } from '../../../src/stores/articleStore';
import { TagService } from '../../../src/services/content/tagService';

describe('UT-009 tagService.createTag', () => {
  it('同名标签再次创建 → 40901，标签数不变', () => {
    const tagStore = new TagStore();
    const service = new TagService(tagStore, new ArticleStore());
    service.createTag('W模型');

    let error: any;
    try {
      service.createTag('W模型');
    } catch (err) {
      error = err;
    }

    expect(error.code).toBe(40901);
    expect(error.httpStatus).toBe(409);
    expect(tagStore.list()).toHaveLength(1);
  });
});
