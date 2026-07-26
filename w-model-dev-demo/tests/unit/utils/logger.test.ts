import { describe, it, expect } from 'vitest';
import { Logger } from '../../../src/utils/logger.js';

describe('Logger (DD-COMMON-002 / CON-004)', () => {
  it('TC-UNIT-075N: info 级别正常记录', () => {
    const log = new Logger('info');
    log.info('hello', { user: 'a' });
    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.message).toBe('hello');
    expect(entries[0]!.meta).toEqual({ user: 'a' });
  });

  it('TC-UNIT-075E: 低于 minLevel 的日志被丢弃', () => {
    const log = new Logger('warn');
    log.info('skipped');
    log.warn('kept');
    expect(log.getEntries()).toHaveLength(1);
    expect(log.getEntries()[0]!.message).toBe('kept');
  });

  it('TC-UNIT-075B: error 最高级总是记录', () => {
    const log = new Logger('error');
    log.error('boom');
    log.warn('skipped');
    expect(log.getEntries()).toHaveLength(1);
  });

  it('clear 清空所有条目', () => {
    const log = new Logger('debug');
    log.debug('a');
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });

  it('toJSON 返回条目副本', () => {
    const log = new Logger('info');
    log.info('x');
    const arr = log.toJSON();
    expect(arr).toHaveLength(1);
    expect(arr[0]!.message).toBe('x');
  });
});
