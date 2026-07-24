/**
 * 错误处理基础（DD-027 ErrorHandler 共用）
 * 三段位错误码：4xx(40000-49999) / 5xx(50000-59999) / 业务(60000-69999)
 */

export class AppError extends Error {
  code: number;
  detail?: unknown;
  constructor(code: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/**
 * 错误码 → HTTP Status 映射（DD-027 §错误码三段位映射）。
 */
export function mapHttpStatus(code: number): number {
  if (code >= 60000) {
    // 业务错误：状态冲突类 → 409，其余 → 400
    if (code === 60002) return 409;
    return 400;
  }
  if (code >= 50000) {
    if (code >= 50300 && code < 50400) return 503;
    if (code >= 50200 && code < 50300) return 502;
    return 500;
  }
  if (code >= 42900 && code < 43000) return 429;
  if (code >= 40900 && code < 41000) return 409;
  if (code >= 40400 && code < 40500) return 404;
  if (code >= 40300 && code < 40400) return 403;
  if (code >= 40100 && code < 40200) return 401;
  if (code >= 40000) return 400;
  return 500;
}

export interface ErrorResponse {
  code: number;
  message: string;
  detail?: unknown;
  requestId: string;
}
