// 让 TypeScript 识别 Express 的 req.user（来自 authMiddleware）
declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: string; username: string };
  }
}

export {};
