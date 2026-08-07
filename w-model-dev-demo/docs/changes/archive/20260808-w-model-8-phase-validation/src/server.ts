/**
 * 服务入口（DD-050 装配启动）：启动 Express 服务（PORT 环境变量可配）。
 */
import { createApp } from './app';

export function startServer() {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  return app.listen(port, () => {
    console.log(`[blog-system-demo] listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  startServer();
}
