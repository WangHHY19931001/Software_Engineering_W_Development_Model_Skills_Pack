/**
 * InteractionController（DD-016 / SD-003 路由处理）：点赞/收藏/关注/feed 路由处理器。
 * 均取 req.user.userId；自关注等业务规则由 followService 判定（40002）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parsePage } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { LikeService } from '../../services/interaction/likeService';
import type { FollowService } from '../../services/interaction/followService';

export class InteractionController {
  constructor(
    private readonly likeService: LikeService,
    private readonly followService: FollowService,
  ) {}

  async likeArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const result = await this.likeService.likeArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async unlikeArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const result = await this.likeService.unlikeArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async favoriteArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const result = await this.likeService.favoriteArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async unfavoriteArticle(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const result = await this.likeService.unfavoriteArticle(req.params.id, userId);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listMyFavorites(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const result = await this.likeService.listMyFavorites(userId, page, pageSize);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async followBlogger(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const result = await this.followService.followBlogger(userId, req.params.id);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async unfollowBlogger(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      await this.followService.unfollowBlogger(userId, req.params.id);
      res.json({ code: 0, message: 'ok', data: { unfollowed: true } });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async getFeed(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const userId = this.requireUser(req);
      const { page, pageSize } = parsePage(req.query.page, req.query.pageSize);
      const result = await this.followService.getFeed(userId, page, pageSize);
      res.json({ code: 0, message: 'ok', data: result });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  protected requireUser(req: Request): string {
    if (!req.user?.userId) {
      throw new BizError(40101);
    }
    return req.user.userId;
  }
}
