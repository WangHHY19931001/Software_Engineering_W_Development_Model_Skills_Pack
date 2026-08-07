/**
 * UT-047 zod 校验错误映射 40001/40002（validationUtil.parse，DD-047/CON-002）
 */
import { describe, it, expect } from 'vitest';
import { parse, registerSchema, parsePage, parseLimit } from '../../../src/utils/validationUtil';

describe('UT-047 validationUtil.parse', () => {
  it('类型不符 → 40001；长度越界 → 40002；合法输入 success', () => {
    let err1: any;
    try {
      parse(registerSchema, { username: 1, email: 'a@b.com', password: 'Passw0rd!x' });
    } catch (err) {
      err1 = err;
    }
    expect(err1.code).toBe(40001);

    let err2: any;
    try {
      parse(registerSchema, { username: 'ab', email: 'x', password: 'short' });
    } catch (err) {
      err2 = err;
    }
    expect(err2.code).toBe(40002);

    const ok = parse(registerSchema, { username: 'reader1', email: 'r1@example.com', password: 'Passw0rd!x' });
    expect(ok.success).toBe(true);
    expect(ok.data.username).toBe('reader1');
  });
});

describe('parsePage / parseLimit', () => {
  it('分页越界 40002；默认值 1/20；limit 越界 40002', () => {
    expect(parsePage(undefined, undefined)).toEqual({ page: 1, pageSize: 20 });
    expect(parsePage(2, 50)).toEqual({ page: 2, pageSize: 50 });
    expect(() => parsePage(0, 20)).toThrow(expect.objectContaining({ code: 40002 }));
    expect(() => parsePage(1, 51)).toThrow(expect.objectContaining({ code: 40002 }));
    expect(parseLimit(undefined)).toBe(10);
    expect(() => parseLimit(0)).toThrow(expect.objectContaining({ code: 40002 }));
    expect(() => parseLimit(51)).toThrow(expect.objectContaining({ code: 40002 }));
  });
});
