/**
 * UT-010 同级分类重名冲突（categoryService.createCategory，DD-010/INTF-010）
 */
import { describe, it, expect } from 'vitest';
import { CategoryStore } from '../../../src/stores/categoryStore';
import { ArticleStore } from '../../../src/stores/articleStore';
import { CategoryService } from '../../../src/services/content/categoryService';

describe('UT-010 categoryService.createCategory', () => {
  it('同一 parentId 下重名 → 40901，分类未落库', () => {
    const categoryStore = new CategoryStore();
    const service = new CategoryService(categoryStore, new ArticleStore());
    service.createCategory('技术', null, 'u_0002');

    let error: any;
    try {
      service.createCategory('技术', null, 'u_0002');
    } catch (err) {
      error = err;
    }

    expect(error.code).toBe(40901);
    expect(categoryStore.list()).toHaveLength(1);
  });

  it('父分类不存在 → 40401；深度 >3 → 60003', () => {
    const categoryStore = new CategoryStore();
    const service = new CategoryService(categoryStore, new ArticleStore());
    expect(() => service.createCategory('孤儿', 'c_9999', 'u_0002')).toThrow(expect.objectContaining({ code: 40401 }));

    const root = service.createCategory('根', null, 'u_0002');
    const l2 = service.createCategory('二级', root.id, 'u_0002');
    const l3 = service.createCategory('三级', l2.id, 'u_0002');
    expect(() => service.createCategory('四级', l3.id, 'u_0002')).toThrow(expect.objectContaining({ code: 60003 }));
  });
});
