// 自定义错误类 + 错误码到 HTTP 状态码映射
// 对应 detailed-design.md DD-ERROR-MW：全局错误处理中间件按错误类型映射 HTTP 状态码

export class AppError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

// 错误码 → HTTP 状态码映射表（对应 outline-design.md §4 错误码分层约定）
const HTTP_STATUS_BY_CODE: Record<number, number> = {
  40001: 400, // 参数缺失/格式非法
  40101: 401, // 未授权
  40301: 403, // 禁止访问
  40401: 404, // 不存在
  60001: 409, // 用户名已存在
  60002: 409, // 状态非法
  50001: 500, // 服务端存储错误
};

export function httpStatusForCode(code: number): number {
  return HTTP_STATUS_BY_CODE[code] ?? 500;
}
