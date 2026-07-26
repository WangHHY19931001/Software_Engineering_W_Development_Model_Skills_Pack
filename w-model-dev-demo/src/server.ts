/**
 * Server（DD-001-003）— HTTP 服务器启动。
 */
import type { Server } from 'http';
import { createContainer } from './container.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

export function startServer(port: number = PORT): Server {
  const container = createContainer();
  const server = container.app.listen(port, () => {
    container.utils.logger.info('server_started', { port });
  });
  return server;
}

if (process.env['NODE_ENV'] !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
