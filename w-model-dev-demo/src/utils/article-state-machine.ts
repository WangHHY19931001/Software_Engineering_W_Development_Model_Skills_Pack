/**
 * 文章状态机（DD-017-003 ArticleStateMachine）。
 * 与 L4_article_state_machine.tla 一致：StateMachineLegality / NoInvalidTransition。
 * 合法转移：draft→published, published→draft(unpublish), published→archived, archived→draft
 */
import { ValidationError } from './errors.js';
import type { ArticleStatus } from '../types.js';

export type ArticleEvent = 'publish' | 'unpublish' | 'archive';

const TRANSITIONS: Record<ArticleStatus, Partial<Record<ArticleEvent, ArticleStatus>>> = {
  draft: { publish: 'published' },
  published: { unpublish: 'draft', archive: 'archived' },
  archived: { unpublish: 'draft' },
};

export class ArticleStateMachine {
  private assertInvariant(current: ArticleStatus): void {
    const valid: ArticleStatus[] = ['draft', 'published', 'archived'];
    if (!valid.includes(current)) {
      throw new Error(`ArticleStateMachine 不变式违反 StateMachineLegality: 非法状态 ${current}`);
    }
  }

  canTransition(from: ArticleStatus, event: ArticleEvent): boolean {
    this.assertInvariant(from);
    const target = TRANSITIONS[from]?.[event];
    return target !== undefined;
  }

  transition(from: ArticleStatus, event: ArticleEvent): ArticleStatus {
    this.assertInvariant(from);
    const target = TRANSITIONS[from]?.[event];
    if (target === undefined) {
      throw new ValidationError(
        `非法状态转移: ${from} → ${event}（NoInvalidTransition 不变式）`,
      );
    }
    return target;
  }

  getAvailableTransitions(from: ArticleStatus): ArticleEvent[] {
    this.assertInvariant(from);
    return Object.keys(TRANSITIONS[from] ?? {}) as ArticleEvent[];
  }
}
