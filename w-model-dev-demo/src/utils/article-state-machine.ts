/**
 * DD-008 ArticleStateMachine —— 文章 6 状态机
 *
 * 6 状态 + 12 合法转换，与 tla/L3_article_state_machine.tla ValidStates + ValidTransitions 完全一致。
 * TLA+ 一致性由 check-code-tla-consistency.ts 回归校验。
 */
import assert from 'node:assert';
import type { Article, ArticleState } from '../types.js';
import { AppError } from './errors.js';

/** 6 状态集合（与 L3_article_state_machine.tla ValidStates 一致） */
export const VALID_STATES: readonly ArticleState[] = [
  'draft',
  'pending_review',
  'scheduled_publish',
  'published',
  'taken_down',
  'archived',
];

/**
 * 12 合法转换表（与 L3_article_state_machine.tla ValidTransitions 完全一致）。
 * key = from state, value = Set of legal to states.
 */
const TRANSITION_MAP: Record<ArticleState, Set<ArticleState>> = {
  draft: new Set<ArticleState>(['draft', 'pending_review']),
  pending_review: new Set<ArticleState>(['draft', 'published', 'scheduled_publish']),
  scheduled_publish: new Set<ArticleState>(['published', 'draft']),
  published: new Set<ArticleState>(['taken_down', 'archived']),
  taken_down: new Set<ArticleState>(['published', 'archived']),
  archived: new Set<ArticleState>(['draft']),
};

/**
 * 校验状态转换合法性（对应 TLA+ TransitionState 的 guard: <<articleState[a], toState>> \in ValidTransitions）。
 */
export function canTransition(from: ArticleState, to: ArticleState): boolean {
  assert(VALID_STATES.includes(from), `invalid from state: ${from}`);
  assert(VALID_STATES.includes(to), `invalid to state: ${to}`);
  return TRANSITION_MAP[from].has(to);
}

/**
 * 执行状态转换，返回新 article 对象（不可变更新）。
 * 非法转换抛 60001（对应 TLA+ NoSkippedReview 不变式：draft 不能直接到 published）。
 */
export function transition(article: Article, to: ArticleState): Article {
  const from = article.status;
  if (!canTransition(from, to)) {
    throw new AppError(60001, `非法状态转换: ${from} -> ${to}`, { from, to });
  }
  const now = Math.floor(Date.now() / 1000);
  return {
    ...article,
    status: to,
    updatedAt: now,
    publishedAt: to === 'published' ? now : article.publishedAt,
  };
}

/** 返回某状态的合法后继列表（对应 TLA+ ValidTransitions 集合查询）。 */
export function getLegalTransitions(from: ArticleState): ArticleState[] {
  assert(VALID_STATES.includes(from), `invalid from state: ${from}`);
  return Array.from(TRANSITION_MAP[from]);
}

/** 校验状态值是否合法（对应 TLA+ TypeInvariant: articleState \in [ArticleId -> ValidStates]）。 */
export function isValidState(state: string): state is ArticleState {
  return (VALID_STATES as readonly string[]).includes(state);
}

/**
 * 校验 published 状态的前驱非 draft（对应 TLA+ NoSkippedReview 不变式）。
 * 任何 published 文章必须经过 pending_review 或 scheduled_publish 或 taken_down。
 */
export function assertNoSkippedReview(
  article: Article,
  fromState: ArticleState,
): void {
  if (article.status === 'published' && fromState === 'draft') {
    throw new AppError(60001, 'NoSkippedReview 违规：draft 不能直接到 published', {
      articleId: article.id,
      from: fromState,
    });
  }
}

/** ArticleStateMachine 门面对象（对应 DD-008 类图） */
export const ArticleStateMachine = {
  canTransition,
  transition,
  getLegalTransitions,
  isValidState,
  assertNoSkippedReview,
  VALID_STATES,
};
