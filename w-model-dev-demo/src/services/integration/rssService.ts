/**
 * rssService（DD-037 / SD-006）：RSS 2.0 源生成（REQ-027）。
 * 博主存在性校验（user store 经 SD-001，40401）；仅已发布文章（article store 经 SD-002）；
 * XML 转义安全（防注入破坏结构）。
 */
import { BizError } from '../../utils/errors';
import type { AuthService } from '../identity/authService';
import type { ArticleService } from '../content/articleService';
import type { Article } from '../../types';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class RssService {
  constructor(
    private readonly authService: AuthService,
    private readonly articleService: ArticleService,
  ) {}

  /** 生成 RSS 2.0 XML（channel: title/link/description；item: title/link/description/pubDate；草稿/归档不暴露） */
  async getBloggerRss(bloggerId: string): Promise<string> {
    const blogger = await this.authService.getBloggerById(bloggerId);
    if (!blogger) {
      throw new BizError(40401, '博主不存在');
    }
    const articles = (await this.articleService.findByAuthor(bloggerId))
      .filter((a) => a.status === 'published')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    const items = articles.map((a) => this.renderItem(a)).join('\n');
    const siteUrl = 'https://blog.example.com';
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '  <channel>',
      `    <title>${escapeXml(blogger.username)} 的博客</title>`,
      `    <link>${siteUrl}/bloggers/${bloggerId}</link>`,
      `    <description>${escapeXml(blogger.bio ?? `${blogger.username} 的博客 RSS 源`)}</description>`,
      `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      items,
      '  </channel>',
      '</rss>',
    ].join('\n');
  }

  private renderItem(article: Article): string {
    return [
      '    <item>',
      `      <title>${escapeXml(article.title)}</title>`,
      `      <link>https://blog.example.com/articles/${article.id}</link>`,
      `      <description>${escapeXml(article.summary || article.title)}</description>`,
      `      <pubDate>${article.publishedAt ? new Date(article.publishedAt).toUTCString() : ''}</pubDate>`,
      '    </item>',
    ].join('\n');
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemIntegration，命名契约） ============ */

  /** TLA+ L2_BlogSystemIntegration "GenerateRss" 动作对应：生成 RSS 源（getBloggerRss 薄封装） */
  async generateRss(bloggerId: string): Promise<string> {
    return this.getBloggerRss(bloggerId);
  }

  /** TLA+ L2_BlogSystemIntegration "ExposeArticle" 动作对应：文章对外暴露（仅已发布可见，RSS 数据源，草稿/归档不暴露） */
  async exposeArticle(articleId: string): Promise<Article | null> {
    return this.articleService.getPublishedArticleById(articleId);
  }
}
