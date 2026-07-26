/**
 * RssController（DD-020-001）— RSS feed 输出 + If-Modified-Since/ETag。
 */
import type { Request, Response, NextFunction } from 'express';
import type { RssService } from '../services/rss.service.js';

export class RssController {
  constructor(private rssService: RssService) {}

  async feed(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const etag = this.rssService.getEtag();
    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }
    const ifModifiedSince = req.headers['if-modified-since'];
    if (typeof ifModifiedSince === 'string' && !this.rssService.isModifiedSince(ifModifiedSince)) {
      res.status(304).end();
      return;
    }
    const xml = this.rssService.generateFeed();
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('ETag', etag);
    res.set('Last-Modified', this.rssService.getLastModified());
    res.send(xml);
  }
}
