// SD-013 CrossReferenceController — thin HTTP wrapper around CrossReferenceService.

import type { Request, Response, NextFunction } from 'express';
import type { CrossReferenceService } from '../services/crossref.service.js';

export class CrossReferenceController {
  constructor(private crossRefService: CrossReferenceService) {}

  addCitation = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.crossRefService.addCitation(req.params.articleId!, req.body.toArticleId);
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  removeCitation = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.crossRefService.removeCitation(req.params.articleId!, req.body.toArticleId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  backlinks = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.crossRefService.backlinks(req.params.articleId!));
    } catch (err) {
      next(err);
    }
  };

  related = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const topN = Number(req.query.topN ?? 5);
      res.json(this.crossRefService.related(req.params.articleId!, topN));
    } catch (err) {
      next(err);
    }
  };

  graph = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const depth = Number(req.query.depth ?? 2);
      res.json(this.crossRefService.graph(req.params.articleId!, depth));
    } catch (err) {
      next(err);
    }
  };
}
