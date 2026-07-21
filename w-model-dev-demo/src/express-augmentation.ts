/**
 * Express Request 类型扩展（module augmentation）。
 *
 * AuthMiddleware 校验 JWT 后将 `{ userId, username }` 注入 `req.user`。
 * `export {}` 使本文件成为 module，`declare module` 即为 augmentation，
 * 在 tsc 编译时全局合并到 express-serve-static-core 的 Request 接口。
 */
export {};

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      username: string;
    };
  }
}
