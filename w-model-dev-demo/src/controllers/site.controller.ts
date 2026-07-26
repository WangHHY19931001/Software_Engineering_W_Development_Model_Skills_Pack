/**
 * SiteController（DD-001-001）— 健康检查。
 */
import type { Request, Response, NextFunction } from 'express';
import type { SiteService } from '../services/site.service.js';

export class SiteController {
  constructor(private siteService: SiteService) {}

  health(_req: Request, res: Response, _next: NextFunction): void {
    res.json(this.siteService.health());
  }

  stats(_req: Request, res: Response, _next: NextFunction): void {
    res.json(this.siteService.getStats());
  }
}
