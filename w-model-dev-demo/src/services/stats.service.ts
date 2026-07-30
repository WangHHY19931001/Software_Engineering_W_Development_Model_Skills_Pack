/**
 * 站点统计服务
 */
import { ArticleRepository } from '../repositories/article.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { CommentRepository } from '../repositories/comment.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { ViewRecordRepository } from '../repositories/view-record.repository.js';
import { FollowRepository } from '../repositories/follow.repository.js';
import { ArticleStatus } from '../types/index.js';

export interface SiteStats {
  totalUsers: number;
  totalArticles: number;
  totalPublished: number;
  totalDrafts: number;
  totalComments: number;
  totalTags: number;
  totalFollows: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
}

export class StatsService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
    private readonly commentRepo: CommentRepository,
    private readonly tagRepo: TagRepository,
    private readonly viewRecordRepo: ViewRecordRepository,
    private readonly followRepo: FollowRepository,
  ) {}

  async getSiteStats(): Promise<SiteStats> {
    const articles = await this.articleRepo.findAll();
    const users = await this.userRepo.findAll();
    const comments = await this.commentRepo.findAll();
    const tags = await this.tagRepo.findAll();
    const follows = await this.followRepo.findAll();
    const views = await this.viewRecordRepo.findAll();

    return {
      totalUsers: users.length,
      totalArticles: articles.length,
      totalPublished: articles.filter((a) => a.status === ArticleStatus.PUBLISHED).length,
      totalDrafts: articles.filter((a) => a.status === ArticleStatus.DRAFT).length,
      totalComments: comments.length,
      totalTags: tags.length,
      totalFollows: follows.length,
      totalViews: views.length,
      totalLikes: articles.reduce((acc, a) => acc + a.likeCount, 0),
      totalFavorites: articles.reduce((acc, a) => acc + a.favoriteCount, 0),
    };
  }

  async getAuthorStats(authorId: string): Promise<{
    articleCount: number;
    publishedCount: number;
    draftCount: number;
    archivedCount: number;
    totalViews: number;
    totalLikes: number;
    totalFavorites: number;
    totalComments: number;
  }> {
    const articles = await this.articleRepo.findByAuthor(authorId);
    return {
      articleCount: articles.length,
      publishedCount: articles.filter((a) => a.status === ArticleStatus.PUBLISHED).length,
      draftCount: articles.filter((a) => a.status === ArticleStatus.DRAFT).length,
      archivedCount: articles.filter((a) => a.status === ArticleStatus.ARCHIVED).length,
      totalViews: articles.reduce((acc, a) => acc + a.viewCount, 0),
      totalLikes: articles.reduce((acc, a) => acc + a.likeCount, 0),
      totalFavorites: articles.reduce((acc, a) => acc + a.favoriteCount, 0),
      totalComments: articles.reduce((acc, a) => acc + a.commentCount, 0),
    };
  }

  async getTopArticles(limit: number = 5): Promise<Array<{ id: string; title: string; viewCount: number; likeCount: number }>> {
    const articles = await this.articleRepo.findPublished();
    return articles
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit)
      .map((a) => ({ id: a.id, title: a.title, viewCount: a.viewCount, likeCount: a.likeCount }));
  }

  async getUserRanking(limit: number = 5): Promise<Array<{ userId: string; articleCount: number; views: number }>> {
    const users = await this.userRepo.findAll();
    const result: Array<{ userId: string; articleCount: number; views: number }> = [];
    for (const u of users) {
      const articles = await this.articleRepo.findByAuthor(u.id);
      const published = articles.filter((a) => a.status === ArticleStatus.PUBLISHED);
      const views = published.reduce((acc, a) => acc + a.viewCount, 0);
      result.push({ userId: u.id, articleCount: published.length, views });
    }
    return result.sort((a, b) => b.views - a.views).slice(0, limit);
  }
}
