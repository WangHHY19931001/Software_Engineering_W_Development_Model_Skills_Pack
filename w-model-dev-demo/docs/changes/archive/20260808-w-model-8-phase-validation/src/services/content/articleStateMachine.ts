/**
 * articleStateMachine（DD-008）：文章状态机唯一裁决者（REQ-013）。
 * 合法迁移表：draft --publish--> published；published --archive--> archived；
 * archived --unarchive--> draft；* --update--> draft；draft --delete--> (删除)。
 * 非法迁移（archived→published 直跳、draft→archived、published|archived 删除）→ 60001。
 */
import { invariant } from '../../utils/invariant';
import type { ArticleAction, ArticleStatus } from '../../types';

type Status = ArticleStatus;

const TRANSITIONS: Record<Status, ArticleAction[]> = {
  draft: ['publish', 'update', 'delete'],
  published: ['archive', 'update'],
  archived: ['unarchive', 'update'],
};

export class ArticleStateMachine {
  canTransition(state: Status, action: ArticleAction): boolean {
    return (TRANSITIONS[state] ?? []).includes(action);
  }

  /** 裁决状态迁移：非法迁移抛 60001（httpStatus 409） */
  transition(state: Status, action: ArticleAction): Status {
    // TLA+ BusinessInvariant 锚点（L3_BlogSystemArticleState / L2_BlogSystemContent）：
    // 状态机不变量——转移必须合法（非法迁移：archived→published 直跳 / draft→archived / published|archived 删除）
    invariant(this.canTransition(state, action), `非法状态流转：${state} → ${action}`, 60001);
    switch (action) {
      case 'publish':
        return 'published';
      case 'archive':
        return 'archived';
      case 'unarchive':
        return 'draft';
      case 'update':
        return 'draft';
      default:
        // create/delete 不产生状态迁移（delete 由服务层判定可删后删除）
        return state;
    }
  }
}
