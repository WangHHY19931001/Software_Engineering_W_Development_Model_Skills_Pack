/**
 * IntegrationController（DD-036 / SD-006 路由处理）：RSS + Webhook 路由处理器。
 * getBloggerRss 公开无认证（application/rss+xml）；createWebhook 须博主（40301）。
 */
import type { Request, Response, NextFunction } from 'express';
import { parse, webhookCreateSchema } from '../../utils/validationUtil';
import { sendError } from '../../utils/respond';
import { BizError } from '../../utils/errors';
import type { RssService } from '../../services/integration/rssService';
import type { WebhookService } from '../../services/integration/webhookService';

export class IntegrationController {
  constructor(
    private readonly rssService: RssService,
    private readonly webhookService: WebhookService,
  ) {}

  async getBloggerRss(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const xml = await this.rssService.getBloggerRss(req.params.id);
      res.type('application/rss+xml; charset=utf-8').send(xml);
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async createWebhook(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const ownerId = this.requireBlogger(req);
      const body = parse(webhookCreateSchema, req.body).data;
      const config = await this.webhookService.createWebhook(ownerId, body.url, body.events as string[], body.secret);
      res.status(201).json({
        code: 0,
        message: 'ok',
        data: { webhookId: config.id, url: config.url, events: config.events, secret: config.secret, createdAt: config.createdAt },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async listWebhooks(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const ownerId = this.requireUser(req);
      const configs = await this.webhookService.listWebhooks(ownerId);
      res.json({
        code: 0,
        message: 'ok',
        data: { items: configs.map((c) => ({ webhookId: c.id, url: c.url, events: c.events, createdAt: c.createdAt })) },
      });
    } catch (err) {
      sendError(res, next, err);
    }
  }

  async deleteWebhook(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const ownerId = this.requireUser(req);
      await this.webhookService.deleteWebhook(ownerId, req.params.webhookId);
      res.status(204).send();
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

  protected requireBlogger(req: Request): string {
    const userId = this.requireUser(req);
    if (req.user?.role !== 'blogger') {
      throw new BizError(40301);
    }
    return userId;
  }
}
