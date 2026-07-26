/**
 * RssService（DD-020-002）— RSS 2.0 生成 + If-Modified-Since（REQ-020）。
 */
import type { ArticleStore } from '../stores/article.store.js';
import type { AtomFeedGenerator } from '../utils/atom-feed-generator.js';

export class RssService {
  constructor(
    private articleStore: ArticleStore,
    private generator: AtomFeedGenerator,
  ) {}

  generateFeed(): string {
    const articles = this.articleStore.listPublished().slice(0, 20);
    return this.generator.renderRss20(articles);
  }

  generateAtomFeed(): string {
    const articles = this.articleStore.listPublished().slice(0, 20);
    return this.generator.render(articles);
  }

  getEtag(): string {
    const xml = this.generateFeed();
    return this.computeEtag(xml);
  }

  getLastModified(): string {
    const articles = this.articleStore.listPublished();
    if (articles.length === 0) {
      return new Date().toUTCString();
    }
    const latest = articles.reduce((acc, a) => {
      const t = new Date(a.updatedAt).getTime();
      return t > acc ? t : acc;
    }, 0);
    return new Date(latest).toUTCString();
  }

  isModifiedSince(headerValue: string | undefined): boolean {
    if (!headerValue) return true;
    const since = Date.parse(headerValue);
    if (Number.isNaN(since)) return true;
    const articles = this.articleStore.listPublished();
    return articles.some((a) => new Date(a.updatedAt).getTime() > since);
  }

  computeEtag(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return `"${(hash >>> 0).toString(16)}"`;
  }
}
