/**
 * HTTP server 启动入口（仅当直接运行时启动，如 npm run dev → tsx src/server.ts）。
 * 测试通过 createApp()（来自 app.ts）获取实例，不触发 listen。
 */
import { createApp } from './app';

function main(): void {
  const PORT = Number(process.env.PORT ?? 3000);
  const { app } = createApp();
  app.listen(PORT, () => {
    console.log(`blog-system-demo listening on http://localhost:${PORT}`);
  });
}

main();
