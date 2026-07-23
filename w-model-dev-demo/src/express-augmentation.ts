/**
 * Express 类型增强：将 JWT 解码后的用户身份挂载到 req.user（对应 INTF-006）。
 */
import type { JwtPayload } from './types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

export interface AuthRequest {
  user: JwtPayload;
}
