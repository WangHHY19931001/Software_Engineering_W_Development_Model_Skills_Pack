// 认证路由：/api/auth/register + /api/auth/login + /api/auth/logout
// 对应 outline-design.md INTF-AUTH-API
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../schemas';
import { wrap } from '../utils/async-handler';

const router = Router();

// POST /api/auth/register —— zod 校验 → 控制器
router.post('/register', validate(registerSchema), wrap(authController.register.bind(authController)));

// POST /api/auth/login —— zod 校验 → 控制器
router.post('/login', validate(loginSchema), wrap(authController.login.bind(authController)));

// POST /api/auth/logout —— 注销当前会话 JWT（TLA+ Logout）
router.post('/logout', wrap(authController.logout.bind(authController)));

export const authRoutes = router;
