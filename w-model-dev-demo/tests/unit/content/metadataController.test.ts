/**
 * UT-006 分类嵌套深度超限（MetadataController.createCategory，DD-006/INTF-010）
 */
import { describe, it, expect, vi } from 'vitest';
import { MetadataController } from '../../../src/routes/content/metadataController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-006 MetadataController.createCategory', () => {
  it('第 4 层分类创建 → 60003（嵌套深度 ≤3），响应 400', async () => {
    const tagService: any = {};
    const categoryService: any = { createCategory: vi.fn().mockRejectedValue(new BizError(60003)) };
    const controller = new MetadataController(tagService, categoryService);
    const req = makeReq({ user: { userId: 'u_0002', role: 'blogger' }, body: { name: 'deep4', parentId: 'c3' } });
    const res = makeRes();

    await controller.createCategory(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 60003 }) }));
    expect(categoryService.createCategory).toHaveBeenCalledWith('deep4', 'c3', 'u_0002');
  });
});

describe('MetadataController 其余方法', () => {
  it('createTag：博主创建 201；非博主 40301', async () => {
    const tagService: any = { createTag: vi.fn().mockResolvedValue({ id: 't_0001', name: 'W模型', createdAt: '2026-08-07T10:00:00.000Z' }) };
    const controller = new MetadataController(tagService, {} as any);

    const res = makeRes();
    await controller.createTag(makeReq({ user: { userId: 'u_0002', role: 'blogger' }, body: { name: 'W模型' } }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(tagService.createTag).toHaveBeenCalledWith('W模型');

    const res2 = makeRes();
    await controller.createTag(makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { name: 'x' } }), res2, makeNext());
    expect(res2.status).toHaveBeenCalledWith(403);
  });

  it('listTags / listCategories：公开返回列表', async () => {
    const tagService: any = { listTags: vi.fn().mockResolvedValue([{ id: 't_0001', name: 'W模型' }]) };
    const categoryService: any = { listCategories: vi.fn().mockResolvedValue([{ id: 'c_0001', name: '根', parentId: null, depth: 1 }]) };
    const controller = new MetadataController(tagService, categoryService);

    const res1 = makeRes();
    await controller.listTags(makeReq(), res1, makeNext());
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ items: [{ tagId: 't_0001', name: 'W模型' }] }) }));

    const res2 = makeRes();
    await controller.listCategories(makeReq(), res2, makeNext());
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ items: [expect.objectContaining({ categoryId: 'c_0001', name: '根' })] }) }),
    );
  });
});
