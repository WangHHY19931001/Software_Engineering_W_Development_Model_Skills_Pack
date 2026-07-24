// 审核服务：管理员审核文章状态流转（pending → approved/rejected）
// 对应 detailed-design.md DD-REVIEW-SVC：依赖 ArticleStore
import type { ArticleStatus, Result } from '../types';
import { articleStore } from '../stores/article.store';
import type { ArticleStore } from '../stores/article.store';

export class ReviewService {
  constructor(private articleStore: ArticleStore) {}

  review(
    articleId: string,
    action: 'approve' | 'reject',
    reviewerId: string,
  ): Result<{ status: ArticleStatus }> {
    // 校验 action 合法性（边界-状态机非法值 UT-030）
    if (action !== 'approve' && action !== 'reject') {
      return { ok: false, code: 60002, message: '状态非法' };
    }
    const article = this.articleStore.findById(articleId);
    if (!article) {
      return { ok: false, code: 40401, message: '文章不存在' };
    }
    // 仅 pending 文章可审核
    if (article.status !== 'pending') {
      return { ok: false, code: 60002, message: '文章状态非 pending，不可审核' };
    }
    const newStatus: ArticleStatus = action === 'approve' ? 'approved' : 'rejected';
    this.articleStore.updateStatus(articleId, newStatus);
    return { ok: true, data: { status: newStatus } };
  }
}

export const reviewService = new ReviewService(articleStore);
