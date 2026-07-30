/**
 * RSS 服务
 */
import { ArticleRepository } from '../repositories/article.repository.js';
import { BloggerRepository } from '../repositories/blogger.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { SiteConfigRepository } from '../repositories/site-config.repository.js';
import { ArticleStatus, type Article } from '../types/index.js';

export class RssService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
    private readonly bloggerRepo: BloggerRepository,
    private readonly siteConfigRepo: SiteConfigRepository,
  ) {}

  async buildFeed(siteLink: string = 'https://blog.example.com'): Promise<string> {
    const articles = await this.articleRepo.findPublished();
    articles.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    const top = articles.slice(0, 20);
    const config = await this.siteConfigRepo.getSingleton();
    const title = config?.siteTitle ?? 'Blog System Demo';
    const description = config?.siteDescription ?? 'A demo blog system RSS feed';
    const link = config?.siteLink ?? siteLink;

    const items = await Promise.all(top.map((a) => this.renderItem(a, link)));
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '<channel>',
      `<title><![CDATA[${title}]]></title>`,
      `<link>${escapeXml(link)}</link>`,
      `<description><![CDATA[${description}]]></description>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');
  }

  private async renderItem(article: Article, linkBase: string): Promise<string> {
    const author = await this.userRepo.findById(article.authorId);
    const authorName = author?.nickname ?? 'Anonymous';
    const link = `${linkBase}/posts/${article.id}`;
    const pubDate = article.publishedAt
      ? new Date(article.publishedAt).toUTCString()
      : new Date(article.createdAt).toUTCString();
    return [
      '<item>',
      `<title>${escapeXml(article.title)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink="false">${escapeXml(article.id)}</guid>`,
      `<pubDate>${pubDate}</pubDate>`,
      `<author><![CDATA[${authorName}]]></author>`,
      `<description><![CDATA[${article.summary || article.content.slice(0, 200)}]]></description>`,
      '</item>',
    ].join('\n');
  }

  async listFeedItems(): Promise<Article[]> {
    const articles = await this.articleRepo.findPublished();
    return articles
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, 20);
  }

  async getAuthorName(article: Article): Promise<string> {
    const user = await this.userRepo.findById(article.authorId);
    if (!user) return 'Anonymous';
    const blogger = await this.bloggerRepo.findByUserId(user.id);
    return blogger?.displayName ?? user.nickname;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

void ArticleStatus;
