/**
 * 顶层入口
 */
import { bootstrap } from './infrastructure/index.js';

if (process.env.NODE_ENV !== 'test') {
  const { app, env } = bootstrap();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[blog-system-demo] listening on port ${env.port}`);
  });
}
