/**
 * UT-008 文章状态机 draft→published 合法迁移（articleStateMachine.transition，DD-008/INTF-006）
 * UT-052 归档后直跳发布非法（archived→published → 60001，DD-008/INTF-007）
 */
import { describe, it, expect } from 'vitest';
import { ArticleStateMachine } from '../../../src/services/content/articleStateMachine';

describe('UT-008 articleStateMachine.transition', () => {
  it('draft→publish 合法迁移返回 published；canTransition 一致', () => {
    const machine = new ArticleStateMachine();
    expect(machine.transition('draft', 'publish')).toBe('published');
    expect(machine.canTransition('draft', 'publish')).toBe(true);
  });
});

describe('UT-052 articleStateMachine.transition 非法迁移', () => {
  it('archived→publish 直跳被拒：canTransition=false，transition 抛 60001', () => {
    const machine = new ArticleStateMachine();
    expect(machine.canTransition('archived', 'publish')).toBe(false);
    let error: any;
    try {
      machine.transition('archived', 'publish');
    } catch (err) {
      error = err;
    }
    expect(error.code).toBe(60001);
    expect(error.httpStatus).toBe(409);
  });

  it('draft→archive 同样非法（60001）；published→archive 合法', () => {
    const machine = new ArticleStateMachine();
    expect(() => machine.transition('draft', 'archive')).toThrow(expect.objectContaining({ code: 60001 }));
    expect(machine.transition('published', 'archive')).toBe('archived');
  });

  it('update 动作（任意状态 → draft）与 delete 动作（不产生状态迁移）', () => {
    const machine = new ArticleStateMachine();
    expect(machine.canTransition('published', 'update')).toBe(true);
    expect(machine.canTransition('draft', 'delete')).toBe(true);
    expect(machine.canTransition('published', 'delete')).toBe(false);
    expect(machine.transition('published', 'update')).toBe('draft');
    expect(machine.transition('archived', 'update')).toBe('draft');
    expect(machine.transition('draft', 'delete')).toBe('draft'); // delete 无状态迁移（default 分支）
  });
});
