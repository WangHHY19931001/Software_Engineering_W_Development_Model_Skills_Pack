/**
 * 统一错误码目录（INTF §0.3 全集）+ BizError（CON-002）。
 * 每个错误码配套 {message, httpStatus, retryable} 四元组；错误响应统一 { error: { code, message } }。
 */

export interface ErrorMeta {
  message: string;
  httpStatus: number;
  retryable: boolean;
}

export const ERROR_CATALOG: Record<number, ErrorMeta> = {
  40001: { message: '参数缺失或类型错误', httpStatus: 400, retryable: false },
  40002: { message: '参数取值越界', httpStatus: 400, retryable: false },
  40003: { message: '请求体 JSON 解析失败', httpStatus: 400, retryable: false },
  40101: { message: '未认证：缺少或无效 JWT', httpStatus: 401, retryable: false },
  40102: { message: '令牌已过期', httpStatus: 401, retryable: false },
  40301: { message: '权限不足', httpStatus: 403, retryable: false },
  40401: { message: '资源不存在', httpStatus: 404, retryable: false },
  40402: { message: '文章对读者不可见', httpStatus: 404, retryable: false },
  40901: { message: '资源唯一性冲突', httpStatus: 409, retryable: false },
  42901: { message: '请求过于频繁', httpStatus: 429, retryable: true },
  50001: { message: '服务端内部错误', httpStatus: 500, retryable: true },
  50201: { message: '下游服务不可用', httpStatus: 502, retryable: true },
  60001: { message: '文章状态机非法流转', httpStatus: 409, retryable: false },
  60002: { message: '原密码校验失败', httpStatus: 400, retryable: false },
  60003: { message: '分类嵌套深度超限', httpStatus: 400, retryable: false },
};

export class BizError extends Error {
  readonly code: number;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(code: number, message?: string) {
    const meta = ERROR_CATALOG[code] ?? ERROR_CATALOG[50001];
    super(message ?? meta.message);
    this.name = 'BizError';
    this.code = code;
    this.httpStatus = meta.httpStatus;
    this.retryable = meta.retryable;
  }
}

export function isBizError(err: unknown): err is BizError {
  return err instanceof BizError;
}
