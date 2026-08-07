/**
 * 存储基座（CON-001 内存存储）：分页校验/分页工具 + 快照恢复基类（供 txManager 事务回滚，NFR-003）。
 */
import { BizError } from '../utils/errors';
import type { Page } from '../types';

/** 分页参数校验（INTF §0.2）：page ≥ 1、1 ≤ pageSize ≤ 50，越界 40002 */
export function assertPage(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new BizError(40002, '分页参数 page 越界');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new BizError(40002, '分页参数 pageSize 越界');
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  assertPage(page, pageSize);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

/**
 * 快照存储基类：所有 store 将状态收拢于单一 `state` 对象，snapshot/restore 支撑
 * storeFactory 事务（DD-048 begin/commit/rollback 快照回滚）。
 */
export abstract class SnapshotStore<TState> {
  protected abstract state: TState;

  snapshot(): TState {
    return structuredClone(this.state);
  }

  restore(snapshot: TState): void {
    (this as unknown as { state: TState }).state = snapshot;
  }
}

/** 自增主键生成（u_/a_/t_/c_/cm_/l_/f_/fl_/r_/n_/wh_/wd_/au_/s_ 前缀，§2 主键约定） */
export function nextId(prefix: string, seq: { n: number }): string {
  seq.n += 1;
  return `${prefix}_${String(seq.n).padStart(4, '0')}`;
}
