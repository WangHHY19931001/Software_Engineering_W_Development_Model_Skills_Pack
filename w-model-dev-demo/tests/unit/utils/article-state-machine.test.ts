import { describe, it, expect } from 'vitest';
import { ArticleStateMachine } from '../../../src/utils/article-state-machine.js';
import { ValidationError } from '../../../src/utils/errors.js';

describe('ArticleStateMachine (DD-017-003 / L4_article_state_machine)', () => {
  it('TC-UNIT-052N: draft → published 合法转移', () => {
    const sm = new ArticleStateMachine();
    expect(sm.canTransition('draft', 'publish')).toBe(true);
    expect(sm.transition('draft', 'publish')).toBe('published');
  });

  it('TC-UNIT-052E: 非法转移抛 ValidationError（NoInvalidTransition）', () => {
    const sm = new ArticleStateMachine();
    expect(() => sm.transition('draft', 'archive')).toThrow(ValidationError);
    expect(sm.canTransition('draft', 'archive')).toBe(false);
  });

  it('TC-UNIT-052B: published → draft(unpublish) / published → archived 全部合法', () => {
    const sm = new ArticleStateMachine();
    expect(sm.transition('published', 'unpublish')).toBe('draft');
    expect(sm.transition('published', 'archive')).toBe('archived');
    expect(sm.transition('archived', 'unpublish')).toBe('draft');
  });

  it('getAvailableTransitions 返回所有可用事件', () => {
    const sm = new ArticleStateMachine();
    expect(sm.getAvailableTransitions('draft')).toEqual(['publish']);
    expect(sm.getAvailableTransitions('published').sort()).toEqual(['archive', 'unpublish']);
  });
});
