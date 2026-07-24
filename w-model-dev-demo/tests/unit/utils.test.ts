// 工具类单元测试：UT-023, UT-024, UT-025
import { describe, it, expect, vi } from 'vitest';
import { JwtUtil } from '../../src/utils/jwt';
import { PasswordUtil } from '../../src/utils/password';
import { asyncHandler } from '../../src/utils/async-handler';
import type { Request, Response, NextFunction } from 'express';

describe('UT-023: JwtUtil.sign / verify 签发与验证', () => {
  const jwtUtil = new JwtUtil('test-secret-blog-demo');

  it('sign 生成 3 段 token，verify 返回 payload', () => {
    const token = jwtUtil.sign({ userId: 'u-1', role: 'user' });
    expect(token.split('.')).toHaveLength(3);

    const payload = jwtUtil.verify(token);
    expect(payload.userId).toBe('u-1');
    expect(payload.role).toBe('user');
  });

  it('verify 篡改 token 抛出异常', () => {
    expect(() => jwtUtil.verify('invalid.token.xxx')).toThrow();
  });

  it('verify 过期 token 抛出异常', () => {
    const expiredUtil = new JwtUtil('test-secret-blog-demo', 0);
    const token = expiredUtil.sign({ userId: 'u-1', role: 'user' });
    // 等待过期
    expect(() => jwtUtil.verify(token)).toThrow();
  });
});

describe('UT-024: PasswordUtil.hash / compare bcrypt 哈希与比对', () => {
  const passwordUtil = new PasswordUtil(10);

  it('hash 返回 $2 开头哈希且非明文', () => {
    const hash = passwordUtil.hash('secret123');
    expect(hash).toMatch(/^\$2/);
    expect(hash).not.toBe('secret123');
  });

  it('compare 正确密码返回 true', () => {
    const hash = passwordUtil.hash('secret123');
    expect(passwordUtil.compare('secret123', hash)).toBe(true);
  });

  it('compare 错误密码返回 false', () => {
    const hash = passwordUtil.hash('secret123');
    expect(passwordUtil.compare('wrong', hash)).toBe(false);
  });
});

describe('UT-025: AsyncHandler.wrap 异步异常捕获传递', () => {
  it('包装 async 控制器，Promise reject 被捕获并传递给 next(err)', async () => {
    const throwingFn = async () => {
      throw new Error('boom');
    };
    const wrapped = asyncHandler.wrap(throwingFn);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await wrapped(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].message).toBe('boom');
  });
});
