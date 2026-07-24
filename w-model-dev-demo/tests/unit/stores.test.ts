// 存储层单元测试：UT-017, UT-018, UT-028, UT-029
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../src/stores/article.store';
import { UserStore } from '../../src/stores/user.store';
import { CommentStore } from '../../src/stores/comment.store';
import type { Article, User, Comment } from '../../src/types';

describe('UT-017: ArticleStore 读写 + 状态更新', () => {
  let store: ArticleStore;
  const article: Article = {
    id: 'a-1',
    title: 't',
    content: 'c',
    status: 'pending',
    authorId: 'u-1',
    createdAt: 'ts',
  };

  beforeEach(() => {
    store = new ArticleStore();
  });

  it('save → findById → findAll → updateStatus 全链路读写', () => {
    store.save(article);
    expect(store.findById('a-1')?.status).toBe('pending');
    expect(store.findAll()).toHaveLength(1);
    store.updateStatus('a-1', 'approved');
    expect(store.findById('a-1')?.status).toBe('approved');
  });

  it('updateStatus 不存在文章抛 40401', () => {
    expect(() => store.updateStatus('a-999', 'approved')).toThrow();
  });
});

describe('UT-018: UserStore.findByUsername username 索引查找', () => {
  let store: UserStore;
  const user: User = {
    id: 'u-1',
    username: 'alice',
    passwordHash: 'h',
    role: 'user',
    createdAt: 'ts',
  };

  beforeEach(() => {
    store = new UserStore();
  });

  it('save 后 findByUsername 通过索引查找', () => {
    store.save(user);
    expect(store.findByUsername('alice')?.id).toBe('u-1');
    expect(store.findByUsername('bob')).toBeNull();
    expect(store.findById('u-1')?.username).toBe('alice');
  });

  it('findById(null) 返回 null', () => {
    expect(store.findById(null)).toBeNull();
  });

  it('findByUsername(null) 返回 null', () => {
    expect(store.findByUsername(null)).toBeNull();
  });
});

describe('UT-028: ArticleStore.findById(null) 防御性处理', () => {
  let store: ArticleStore;

  beforeEach(() => {
    store = new ArticleStore();
  });

  it('传入 null id 返回 null 而非崩溃', () => {
    expect(store.findById(null)).toBeNull();
  });
});

describe('UT-029: CommentStore.findByArticle 类型不符参数', () => {
  let store: CommentStore;
  const comment: Comment = {
    id: 'c-1',
    articleId: 'a-1',
    authorId: 'u-1',
    content: '好文章',
    createdAt: 'ts',
  };

  beforeEach(() => {
    store = new CommentStore();
    store.save(comment);
  });

  it('传入 undefined 返回空数组', () => {
    expect(store.findByArticle(undefined)).toEqual([]);
  });

  it('传入 null 返回空数组', () => {
    expect(store.findByArticle(null)).toEqual([]);
  });

  it('传入有效 articleId 返回匹配评论', () => {
    expect(store.findByArticle('a-1')).toHaveLength(1);
  });
});
