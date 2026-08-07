/**
 * DiscoveryController（DD-025 / SD-004 路由处理）：热门/推荐/搜索路由处理器。
 * 热门 limit ∈ [1,50]；推荐可选 JWT（有效→个性化；无效 40101；无→匿名冷启动）；
 * 搜索 q ∈ [1,100]。
 */
import type { Request, Response, NextFunction } from 'express';
import { parsePage, parseLimit } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { HotService } from '../../services/discovery/hotService';
import type { RecommendService } from '../../services/discovery/recommendService';
import type { SearchService } from '../../services/discovery/searchService';
import type { JwtUtil } from '../../utils/jwtUtil';

export class DiscoveryController {
  constructor(
    private readonly hotService: HotService,
    private readonly recommendService: RecommendService,
    private readonly searchService: SearchService,
    private readonly jwtUtil: JwtUtil,
  ) {}

  async getHotArticles(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const limit = parseLimit(req.query.limit);
      const items = await this.hotService.getHotArticles(limit);
      res.json({ code: 0, message: 'ok', data: { items, generatedAt: new Date().toISOString() } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async getRecommendations(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const limit = parseLimit(req.query.limit);
      let userId: string | undefined;
      const header = req.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        // 携带 JWT：无效/过期 → 40101/40102（authMiddleware 语义，此处为可选认证）
        const payload = this.jwtUtil.verify(header.slice('Bearer '.length).trim());
        userId = payload.sub;
      }
      const items = await this.recommendService.getRecommendations(userId, limit);
      res.json({ code: 0, message: 'ok', data: { items } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async searchArticles(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const q = req.query.q;
      if (typeof q !== 'string' || q.trim().length === 0 || q.trim().length > 100) {
        throw new BizError(40002, '搜索关键词长度非法（1~100）');
      }
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const result = await this.searchService.searchArticles(q.trim(), page, pageSize);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }
}
