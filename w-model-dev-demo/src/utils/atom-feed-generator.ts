/**
 * Atom/RSS Feed 生成器（DD-020-003 AtomFeedGenerator / REQ-020）。
 * 支持 RSS 2.0 + If-Modified-Since 条件请求。
 */
import type { Article } from '../types.js';

export class AtomFeedGenerator {
  render(articles: Article[], now: string = new Date().toISOString()): string {
    const entries = articles
      .map((a) => {
        return `    <entry>
      <id>${a.id}</id>
      <title>${this.escapeXml(a.title)}</title>
      <updated>${a.updatedAt}</updated>
      <published>${a.publishedAt ?? a.createdAt}</published>
      <content type="html">${this.escapeXml(a.content)}</content>
    </entry>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog RSS</title>
  <updated>${now}</updated>
  <id>urn:blog-system:rss</id>
${entries}
</feed>`;
  }

  renderRss20(articles: Article[], now: string = new Date().toISOString()): string {
    const items = articles
      .map((a) => {
        return `    <item>
      <guid>${a.id}</guid>
      <title>${this.escapeXml(a.title)}</title>
      <pubDate>${new Date(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>
      <description>${this.escapeXml(a.content)}</description>
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog RSS</title>
    <lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  }

  escapeXml(s: string): string {
    return s.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
