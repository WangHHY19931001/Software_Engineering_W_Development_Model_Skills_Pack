// SD-007 SearchController — thin HTTP wrapper around SearchService.

import type { Request, Response, NextFunction } from 'express';
import type { SearchService } from '../services/search.service.js';
import type { AuthService } from '../services/auth.service.js';

export class SearchController {
  constructor(
    private searchService: SearchService,
    private authService: AuthService,
  ) {}

  search = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const query = String(req.query.q ?? '');
      const sort = String(req.query.sort ?? 'relevance');
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      let userId: string | null = null;
      try {
        userId = this.authContext(req).userId;
      } catch {
        // anonymous search allowed; skip history.
      }
      res.json(this.searchService.search(userId, query, sort as 'relevance' | 'newest' | 'popular', page, pageSize));
    } catch (err) {
      next(err);
    }
  };

  suggest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const prefix = String(req.query.prefix ?? '');
      res.json(this.searchService.suggest(prefix));
    } catch (err) {
      next(err);
    }
  };

  history = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      res.json(this.searchService.history(ctx.userId));
    } catch (err) {
      next(err);
    }
  };

  clearHistory = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = this.authContext(req);
      this.searchService.clearSearchHistory(ctx.userId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  private authContext(req: Request): { userId: string; role: string } {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    return this.authService.verifyToken(token);
  }
}
