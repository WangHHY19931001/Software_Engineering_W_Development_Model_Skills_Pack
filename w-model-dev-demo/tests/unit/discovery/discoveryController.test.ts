/**
 * UT-025 热门 limit 越界（DiscoveryController.getHotArticles，DD-025/INTF-015）
 */
import { describe, it, expect, vi } from 'vitest';
import { DiscoveryController } from '../../../src/routes/discovery/discoveryController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-025 DiscoveryController.getHotArticles', () => {
  it('limit=0 与 limit=51 → 40002；极值 limit=50 放行', async () => {
    const hotService: any = { getHotArticles: vi.fn().mockResolvedValue([]) };
    const controller = new DiscoveryController(hotService, {}, {}, {} as any);

    const res1 = makeRes();
    await controller.getHotArticles(makeReq({ query: { limit: 0 } }), res1, makeNext());
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40002 }) }));

    const res2 = makeRes();
    await controller.getHotArticles(makeReq({ query: { limit: 51 } }), res2, makeNext());
    expect(res2.status).toHaveBeenCalledWith(400);

    const res3 = makeRes();
    await controller.getHotArticles(makeReq({ query: { limit: 50 } }), res3, makeNext());
    expect(hotService.getHotArticles).toHaveBeenCalledWith(50);
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ items: [] }) }));
  });
});

describe('DiscoveryController getRecommendations / searchArticles', () => {
  const jwtUtil: any = { verify: vi.fn() };
  const recommendService: any = { getRecommendations: vi.fn().mockResolvedValue([]) };
  const searchService: any = { searchArticles: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) };

  it('无 JWT → 匿名调用（userId=undefined）；带有效 JWT → 个性化', async () => {
    const controller = new DiscoveryController({} as any, recommendService, searchService, jwtUtil);
    await controller.getRecommendations(makeReq({ headers: {} }), makeRes(), makeNext());
    expect(recommendService.getRecommendations).toHaveBeenCalledWith(undefined, 10);

    jwtUtil.verify.mockReturnValue({ sub: 'u_0001', role: 'reader' });
    await controller.getRecommendations(makeReq({ headers: { authorization: 'Bearer valid.token' } }), makeRes(), makeNext());
    expect(recommendService.getRecommendations).toHaveBeenCalledWith('u_0001', 10);
  });

  it('带无效 JWT → 40101', async () => {
    jwtUtil.verify.mockImplementation(() => {
      throw new BizError(40101);
    });
    const controller = new DiscoveryController({} as any, recommendService, searchService, jwtUtil);
    const res = makeRes();
    await controller.getRecommendations(makeReq({ headers: { authorization: 'Bearer bad.token' } }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40101 }) }));
  });

  it('searchArticles：q 空/超长 → 40002；合法透传', async () => {
    const controller = new DiscoveryController({} as any, recommendService, searchService, jwtUtil);
    const res1 = makeRes();
    await controller.searchArticles(makeReq({ query: { q: '  ' } }), res1, makeNext());
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = makeRes();
    await controller.searchArticles(makeReq({ query: { q: 'x'.repeat(101) } }), res2, makeNext());
    expect(res2.status).toHaveBeenCalledWith(400);

    const res3 = makeRes();
    await controller.searchArticles(makeReq({ query: { q: 'w模型', page: '1', pageSize: '20' } }), res3, makeNext());
    expect(searchService.searchArticles).toHaveBeenCalledWith('w模型', 1, 20);
  });
});
