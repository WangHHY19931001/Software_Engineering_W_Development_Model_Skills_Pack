/**
 * SearchController（DD-015-001）+ ArchiveController（DD-022-001）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { SearchService, ArchiveService } from '../services/search.service.js';
import { searchQuerySchema } from '../utils/schemas.js';

export class SearchController {
  constructor(private searchService: SearchService) {}

  async search(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = searchQuerySchema.parse(req.query);
    const result = this.searchService.search(input);
    res.json(result);
  }
}

export class ArchiveController {
  constructor(private archiveService: ArchiveService) {}

  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(this.archiveService.listArchive());
  }
}
