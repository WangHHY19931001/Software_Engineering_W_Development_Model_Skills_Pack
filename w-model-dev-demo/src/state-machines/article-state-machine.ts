/**
 * 博文状态机
 * 4 状态 + 转移规则
 */
import { ArticleStatus } from '../types/index.js';
import { AppError, ErrorCode } from '../utils/errors.js';

export type ArticleTransition =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'unarchive'
  | 'delete';

interface TransitionRule {
  from: ArticleStatus;
  to: ArticleStatus;
}

const TRANSITIONS: Record<ArticleTransition, TransitionRule> = {
  publish: { from: ArticleStatus.DRAFT, to: ArticleStatus.PUBLISHED },
  unpublish: { from: ArticleStatus.PUBLISHED, to: ArticleStatus.DRAFT },
  archive: { from: ArticleStatus.PUBLISHED, to: ArticleStatus.ARCHIVED },
  unarchive: { from: ArticleStatus.ARCHIVED, to: ArticleStatus.DRAFT },
  delete: { from: ArticleStatus.DRAFT, to: ArticleStatus.DELETED },
};

const DELETED_FROM_ANY: ArticleStatus[] = [
  ArticleStatus.DRAFT,
  ArticleStatus.PUBLISHED,
  ArticleStatus.ARCHIVED,
];

export class ArticleStateMachine {
  static initial(): ArticleStatus {
    return ArticleStatus.DRAFT;
  }

  static canTransition(from: ArticleStatus, transition: ArticleTransition): boolean {
    if (transition === 'delete') {
      return DELETED_FROM_ANY.includes(from);
    }
    const rule = TRANSITIONS[transition];
    return rule.from === from;
  }

  static next(from: ArticleStatus, transition: ArticleTransition): ArticleStatus {
    if (transition === 'delete') {
      if (!DELETED_FROM_ANY.includes(from)) {
        throw new AppError(
          ErrorCode.INVALID_STATE,
          `Cannot delete article in state ${from}`,
          400,
        );
      }
      return ArticleStatus.DELETED;
    }
    const rule = TRANSITIONS[transition];
    if (rule.from !== from) {
      throw new AppError(
        ErrorCode.INVALID_STATE,
        `Invalid transition: ${transition} from ${from}`,
        400,
      );
    }
    return rule.to;
  }

  static assertContentNotEmpty(content: string): void {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'Article content cannot be empty when publishing',
        400,
      );
    }
  }

  static availableTransitions(from: ArticleStatus): ArticleTransition[] {
    const all: ArticleTransition[] = ['publish', 'unpublish', 'archive', 'unarchive', 'delete'];
    return all.filter((t) => this.canTransition(from, t));
  }
}
