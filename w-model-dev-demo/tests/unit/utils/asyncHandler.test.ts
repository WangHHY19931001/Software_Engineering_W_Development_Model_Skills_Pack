/**
 * UT-045 async 处理器异常转发（asyncHandler.wrap，DD-045/CON-002）
 */
import { describe, it, expect, vi } from 'vitest';
import { wrap } from '../../../src/utils/asyncHandler';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-045 asyncHandler.wrap', () => {
  it('async 处理抛错 → next(err)（Express 4 不吞 async 拒绝）', async () => {
    const handler = async () => {
      throw new BizError(40401);
    };
    const next = makeNext();
    await wrap(handler)(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40401 }));
  });

  it('正常 handler → next 不被调用（正常路径不干扰）', async () => {
    const handler = async () => undefined;
    const next = makeNext();
    await wrap(handler)(makeReq(), makeRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});
