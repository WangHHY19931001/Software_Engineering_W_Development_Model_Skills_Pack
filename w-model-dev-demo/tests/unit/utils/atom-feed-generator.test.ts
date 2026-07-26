import { describe, it, expect } from 'vitest';
import { AtomFeedGenerator } from '../../../src/utils/atom-feed-generator.js';
import type { Article } from '../../../src/types.js';

function mkArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a1',
    title: 'Title',
    content: 'Content',
    authorId: 'u1',
    categoryId: null,
    tagIds: [],
    status: 'published',
    likeCount: 0,
    viewCount: 0,
    publishedAt: '2026-07-26T00:00:00Z',
    createdAt: '2026-07-26T00:00:00Z',
    updatedAt: '2026-07-26T00:00:00Z',
    ...overrides,
  };
}

describe('AtomFeedGenerator (DD-020-003)', () => {
  it('TC-UNIT-061N: render RSS 2.0 含 channel 与 item', () => {
    const gen = new AtomFeedGenerator();
    const xml = gen.renderRss20([mkArticle()]);
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('<item>');
    expect(xml).toContain('<title>Title</title>');
  });

  it('TC-UNIT-061E: 空数组也生成有效 RSS 骨架', () => {
    const gen = new AtomFeedGenerator();
    const xml = gen.renderRss20([]);
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).not.toContain('<item>');
  });

  it('TC-UNIT-061B: escapeXml 转义 < > &', () => {
    const gen = new AtomFeedGenerator();
    expect(gen.escapeXml('<a>&"\'')).toBe('&lt;a&gt;&amp;&quot;&apos;');
  });

  it('render Atom feed 含 <feed> 与 <entry>', () => {
    const gen = new AtomFeedGenerator();
    const xml = gen.render([mkArticle({ title: 'X' })]);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<entry>');
    expect(xml).toContain('<title>X</title>');
  });
});
