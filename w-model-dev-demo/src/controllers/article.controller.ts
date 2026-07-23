/**
 * ArticleController：文章 HTTP 适配层（调用 INTF-002）。
 * 将领域模型映射为 HTTP DTO（articleId / commentId）以符合 UAT-004/008/009 契约。
 */
import type { RequestHandler } from 'express';
import type { ArticleService } from '../services/article.service';
import type { Article, ArticleDetail, Comment } from '../types';

function toArticleDto(a: Article) {
  return {
    articleId: a.id,
    authorId: a.authorId,
    title: a.title,
    content: a.content,
    tags: a.tags,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function toCommentDto(c: Comment) {
  return {
    commentId: c.id,
    articleId: c.articleId,
    authorId: c.authorId,
    content: c.content,
    createdAt: c.createdAt,
  };
}

function toArticleDetailDto(a: ArticleDetail) {
  return { ...toArticleDto(a), comments: a.comments.map(toCommentDto) };
}

export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  create: RequestHandler = async (req, res) => {
    const article = await this.articleService.create(req.body, req.user!.userId);
    res.status(201).json(toArticleDto(article));
  };

  update: RequestHandler = async (req, res) => {
    const article = await this.articleService.update(req.params.id, req.body, req.user!.userId);
    res.status(200).json(toArticleDto(article));
  };

  remove: RequestHandler = async (req, res) => {
    await this.articleService.delete(req.params.id, req.user!.userId);
    res.status(204).end();
  };

  getById: RequestHandler = async (req, res) => {
    const detail = await this.articleService.getById(req.params.id);
    res.status(200).json(toArticleDetailDto(detail));
  };

  list: RequestHandler = async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);
    const result = await this.articleService.list(page, pageSize);
    res.status(200).json({
      items: result.items.map(toArticleDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  };
}
