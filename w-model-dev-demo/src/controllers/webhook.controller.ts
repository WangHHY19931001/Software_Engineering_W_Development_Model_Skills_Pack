/**
 * WebhookController — Webhook 注册与管理。
 */
import type { Request, Response, NextFunction } from 'express';
import type { WebhookService } from '../services/webhook.service.js';
import { webhookCreateSchema } from '../utils/schemas.js';
import { ValidationError } from '../utils/errors.js';

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(this.webhookService.list());
  }

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = webhookCreateSchema.parse(req.body);
    const webhook = this.webhookService.register(input.url, input.events, input.secret);
    res.status(201).json(webhook);
  }

  async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const id = req.params['id'];
    if (!id) throw new ValidationError('缺少 id');
    this.webhookService.unregister(id);
    res.status(204).end();
  }

  async trigger(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const body = req.body as { event?: string; payload?: Record<string, unknown> };
    if (!body.event) throw new ValidationError('缺少 event');
    const deliveries = await this.webhookService.trigger({
      event: body.event,
      payload: body.payload ?? {},
    });
    res.json({ deliveries });
  }
}
