import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { AuthRegisterSchema, AuthLoginSchema } from '../schemas/auth.schema.js';

/**
 * 用户认证路由。
 *
 * 设计来源：`docs/outline-design.md` §2.1。
 * 两个接口均为公开（无 authMiddleware）。
 */
export function buildAuthRoutes(controller: AuthController): Router {
  const router = Router();
  router.post('/register', validate({ body: AuthRegisterSchema }), controller.register);
  router.post('/login', validate({ body: AuthLoginSchema }), controller.login);
  return router;
}
