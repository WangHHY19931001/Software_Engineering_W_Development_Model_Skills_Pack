import { Router } from 'express';
import * as userController from '../controllers/user-controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(userController.register));
authRouter.post('/login', asyncHandler(userController.login));
