/**
 * tagService（DD-009 / SD-002）：标签唯一性（重名 40901）、列表、按标签筛选已发布文章。
 */
import { BizError } from '../../utils/errors';
import type { TagStore } from '../../stores/tagStore';
import type { ArticleStore } from '../../stores/articleStore';
import type { Article, Page, Tag } from '../../types';

export class TagService {
  constructor(
    private readonly tagStore: TagStore,
    private readonly articleStore: ArticleStore,
  ) {}

  /** 创建标签：名称唯一（40901）——博主校验由控制器/中间件承担（40301） */
  createTag(name: string): Tag {
    if (this.tagStore.findByName(name)) {
      throw new BizError(40901, '标签已存在');
    }
    return this.tagStore.create({ name, createdAt: new Date().toISOString() });
  }

  listTags(): Tag[] {
    return this.tagStore.list();
  }

  /** 按标签名筛选已发布文章（草稿/归档不可见） */
  filterByTag(name: string, page: number, pageSize: number): Page<Article> {
    return this.articleStore.filterPublished({ tag: name }, page, pageSize);
  }
}
