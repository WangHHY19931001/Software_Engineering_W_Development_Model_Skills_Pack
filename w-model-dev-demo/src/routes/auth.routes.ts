import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middleware/validate.js';
import { AuthRegisterSchema, AuthLoginSchema } from '../schemas/auth.schema.js';

const router: Router = Router();

router.post(
  '/register',
  validate(AuthRegisterSchema),
  asyncHandler(AuthController.register),
);
router.post(
  '/login',
  validate(AuthLoginSchema),
  asyncHandler(AuthController.login),
);

export { router as authRoutes };
