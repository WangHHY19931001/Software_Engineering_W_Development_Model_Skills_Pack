/**
 * UT-037 RSS 仅含已发布文章（rssService.getBloggerRss，DD-037/INTF-021）
 */
import { describe, it, expect, vi } from 'vitest';
import { RssService } from '../../../src/services/integration/rssService';

describe('UT-037 rssService.getBloggerRss', () => {
  it('草稿/归档不进入 RSS XML；channel 结构合法；博主不存在 40401', async () => {
    const authService: any = { getBloggerById: vi.fn().mockResolvedValue({ id: 'u_0002', username: '博主小张', bio: '简介' }) };
    const articleService: any = {
      findByAuthor: vi.fn().mockResolvedValue([
        { id: 'a_1', title: '发布一', summary: '摘要一', status: 'published', publishedAt: '2026-08-07T10:00:00.000Z' },
        { id: 'a_2', title: '发布二', summary: '摘要二', status: 'published', publishedAt: '2026-08-06T10:00:00.000Z' },
        { id: 'a_3', title: '草稿标题', summary: '', status: 'draft', publishedAt: null },
        { id: 'a_4', title: '归档标题', summary: '', status: 'archived', publishedAt: null },
      ]),
    };
    const service = new RssService(authService, articleService);

    const xml = await service.getBloggerRss('u_0002');

    expect((xml.match(/<item>/g) ?? [])).toHaveLength(2);
    expect(xml).not.toContain('草稿标题');
    expect(xml).not.toContain('归档标题');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('<pubDate>');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('博主不存在 → 40401', async () => {
    const authService: any = { getBloggerById: vi.fn().mockResolvedValue(null) };
    const service = new RssService(authService, { findByAuthor: vi.fn() } as any);
    const error = await service.getBloggerRss('u_9999').catch((e) => e);
    expect(error.code).toBe(40401);
  });

  it('XML 转义安全：标题/摘要含 & < > " 字符不破坏 XML 结构', async () => {
    const authService: any = { getBloggerById: vi.fn().mockResolvedValue({ id: 'u_0002', username: '博主<X>', bio: 'A&B "q"' }) };
    const articleService: any = {
      findByAuthor: vi.fn().mockResolvedValue([
        { id: 'a_1', title: '发布 <1> & "2"', summary: '摘要 & 更多', status: 'published', publishedAt: '2026-08-07T10:00:00.000Z' },
      ]),
    };
    const service = new RssService(authService, articleService);
    const xml = await service.getBloggerRss('u_0002');
    expect(xml).toContain('&lt;1&gt; &amp; &quot;2&quot;');
    expect(xml).toContain('博主&lt;X&gt;');
    expect(xml).not.toContain('<title>发布 <1>'); // 原始尖括号不直出
  });
});
