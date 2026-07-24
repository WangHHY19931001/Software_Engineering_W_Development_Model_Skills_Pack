// 服务启动入口
// 对应 system-design.md §4 部署架构：Node.js 进程 + Express 应用 + 端口 3000
import { app } from './app';

const PORT = process.env.PORT ?? 3000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET 环境变量未设置');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`blog-system-demo server listening on port ${PORT}`);
});
