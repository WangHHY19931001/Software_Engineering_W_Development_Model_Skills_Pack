/**
 * 单元测试通用工具：req/res/next 桩（中间件/控制器直调 seam）。
 */
import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

export function makeReq(overrides: Record<string, unknown> = {}): any {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    path: '/',
    originalUrl: '/',
    user: undefined,
    ...overrides,
  };
}

export function makeRes(): any {
  const emitter = new EventEmitter();
  const res: any = Object.assign(emitter, { statusCode: 200 });
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res._body = body;
    return res;
  });
  res.send = vi.fn((body?: unknown) => {
    res._body = body ?? '';
    return res;
  });
  res.type = vi.fn(() => res);
  res.set = vi.fn(() => res);
  res.end = vi.fn(() => res);
  res.getHeader = vi.fn(() => undefined);
  return res;
}

export function makeNext(): ReturnType<typeof vi.fn> {
  return vi.fn();
}

/** 捕获 BizError 的便捷断言 */
export async function expectBizError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject, but it resolved');
}
