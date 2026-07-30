/**
 * 博文状态机测试
 */
import { describe, it, expect } from 'vitest';
import { ArticleStateMachine } from '../../src/state-machines/article-state-machine.js';
import { ArticleStatus } from '../../src/types/index.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';

describe('ArticleStateMachine', () => {
  describe('initial()', () => {
    it('should return DRAFT as initial state', () => {
      expect(ArticleStateMachine.initial()).toBe(ArticleStatus.DRAFT);
    });
  });

  describe('canTransition()', () => {
    it('DRAFT can publish', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.DRAFT, 'publish')).toBe(true);
    });

    it('DRAFT can delete', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.DRAFT, 'delete')).toBe(true);
    });

    it('DRAFT cannot archive', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.DRAFT, 'archive')).toBe(false);
    });

    it('DRAFT cannot unpublish', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.DRAFT, 'unpublish')).toBe(false);
    });

    it('PUBLISHED can unpublish', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.PUBLISHED, 'unpublish')).toBe(true);
    });

    it('PUBLISHED can archive', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.PUBLISHED, 'archive')).toBe(true);
    });

    it('PUBLISHED can delete', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.PUBLISHED, 'delete')).toBe(true);
    });

    it('PUBLISHED cannot publish again', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.PUBLISHED, 'publish')).toBe(false);
    });

    it('ARCHIVED can unarchive', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.ARCHIVED, 'unarchive')).toBe(true);
    });

    it('ARCHIVED can delete', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.ARCHIVED, 'delete')).toBe(true);
    });

    it('ARCHIVED cannot publish directly', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.ARCHIVED, 'publish')).toBe(false);
    });

    it('DELETED cannot do anything', () => {
      expect(ArticleStateMachine.canTransition(ArticleStatus.DELETED, 'publish')).toBe(false);
      expect(ArticleStateMachine.canTransition(ArticleStatus.DELETED, 'unpublish')).toBe(false);
      expect(ArticleStateMachine.canTransition(ArticleStatus.DELETED, 'archive')).toBe(false);
      expect(ArticleStateMachine.canTransition(ArticleStatus.DELETED, 'unarchive')).toBe(false);
      expect(ArticleStateMachine.canTransition(ArticleStatus.DELETED, 'delete')).toBe(false);
    });
  });

  describe('next()', () => {
    it('DRAFT + publish = PUBLISHED', () => {
      expect(ArticleStateMachine.next(ArticleStatus.DRAFT, 'publish')).toBe(ArticleStatus.PUBLISHED);
    });

    it('PUBLISHED + unpublish = DRAFT', () => {
      expect(ArticleStateMachine.next(ArticleStatus.PUBLISHED, 'unpublish')).toBe(ArticleStatus.DRAFT);
    });

    it('PUBLISHED + archive = ARCHIVED', () => {
      expect(ArticleStateMachine.next(ArticleStatus.PUBLISHED, 'archive')).toBe(ArticleStatus.ARCHIVED);
    });

    it('ARCHIVED + unarchive = DRAFT', () => {
      expect(ArticleStateMachine.next(ArticleStatus.ARCHIVED, 'unarchive')).toBe(ArticleStatus.DRAFT);
    });

    it('DRAFT + delete = DELETED', () => {
      expect(ArticleStateMachine.next(ArticleStatus.DRAFT, 'delete')).toBe(ArticleStatus.DELETED);
    });

    it('PUBLISHED + delete = DELETED', () => {
      expect(ArticleStateMachine.next(ArticleStatus.PUBLISHED, 'delete')).toBe(ArticleStatus.DELETED);
    });

    it('ARCHIVED + delete = DELETED', () => {
      expect(ArticleStateMachine.next(ArticleStatus.ARCHIVED, 'delete')).toBe(ArticleStatus.DELETED);
    });

    it('throws on invalid transition', () => {
      expect(() => ArticleStateMachine.next(ArticleStatus.DRAFT, 'archive')).toThrowError(AppError);
      try {
        ArticleStateMachine.next(ArticleStatus.DRAFT, 'archive');
      } catch (e) {
        expect((e as AppError).code).toBe(ErrorCode.INVALID_STATE);
      }
    });

    it('throws on delete from DELETED', () => {
      expect(() => ArticleStateMachine.next(ArticleStatus.DELETED, 'delete')).toThrowError(AppError);
    });

    it('throws on publish from ARCHIVED', () => {
      expect(() => ArticleStateMachine.next(ArticleStatus.ARCHIVED, 'publish')).toThrowError(AppError);
    });
  });

  describe('assertContentNotEmpty()', () => {
    it('passes for non-empty content', () => {
      expect(() => ArticleStateMachine.assertContentNotEmpty('hello world')).not.toThrow();
    });

    it('throws on empty string', () => {
      expect(() => ArticleStateMachine.assertContentNotEmpty('')).toThrowError(AppError);
    });

    it('throws on whitespace-only', () => {
      expect(() => ArticleStateMachine.assertContentNotEmpty('   ')).toThrowError(AppError);
    });

    it('throws on non-string', () => {
      expect(() => ArticleStateMachine.assertContentNotEmpty(null as unknown as string)).toThrowError(AppError);
    });
  });

  describe('availableTransitions()', () => {
    it('DRAFT allows publish, delete', () => {
      const t = ArticleStateMachine.availableTransitions(ArticleStatus.DRAFT);
      expect(t).toContain('publish');
      expect(t).toContain('delete');
      expect(t).not.toContain('archive');
    });

    it('PUBLISHED allows unpublish, archive, delete', () => {
      const t = ArticleStateMachine.availableTransitions(ArticleStatus.PUBLISHED);
      expect(t).toContain('unpublish');
      expect(t).toContain('archive');
      expect(t).toContain('delete');
    });

    it('ARCHIVED allows unarchive, delete', () => {
      const t = ArticleStateMachine.availableTransitions(ArticleStatus.ARCHIVED);
      expect(t).toContain('unarchive');
      expect(t).toContain('delete');
    });

    it('DELETED has no transitions', () => {
      const t = ArticleStateMachine.availableTransitions(ArticleStatus.DELETED);
      expect(t.length).toBe(0);
    });
  });
});
