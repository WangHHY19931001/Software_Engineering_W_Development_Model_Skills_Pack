/**
 * auth 路由：POST /register + POST /login（realizes INTF-001 HTTP 绑定）。
 * 挂载于 /api/v1/auth 前缀。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import type { AuthController } from '../controllers/auth.controller';

export function buildAuthRoutes(authController: AuthController): Router {
  const router = Router();
  router.post(
    '/register',
    validateRequest({ body: registerSchema }),
    asyncHandler(authController.register),
  );
  router.post(
    '/login',
    validateRequest({ body: loginSchema }),
    asyncHandler(authController.login),
  );
  return router;
}
