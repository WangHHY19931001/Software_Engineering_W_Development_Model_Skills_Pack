// Express 类型扩展：为 Request 注入 user 字段（JWT 鉴权中间件填充）
// 对应 detailed-design.md DD-AUTH-MW：authenticate 注入 req.user={userId,role}
import type { JwtPayload } from './types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
