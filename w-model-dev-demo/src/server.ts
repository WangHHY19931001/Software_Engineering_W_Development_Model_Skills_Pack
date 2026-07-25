// HTTP server entry point.

import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const { app } = createApp();

const server = app.listen(PORT, () => {
  console.log(`[blog-system-demo] HTTP server listening on port ${PORT}`);
});

export { server };
