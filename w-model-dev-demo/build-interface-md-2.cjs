// Append §2-§3 to interface-design.md
const fs = require('fs');
const path = require('path');
const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/docs/phase3-design/interface-design.md');
function W(s) { fs.appendFileSync(outputPath, s, 'utf-8'); }

// ============================================================================
// §2 架构风格与设计原则
// ============================================================================
W('## 2. 架构风格与设计原则\n\n');
W('### 2.1 架构风格（继承 §1.1，阶段 3 不变更）\n\n');
W('- **三层 + 横切**：Router / Controller / Service / Repository / Model + 横切中间件\n');
W('- **同步 API**：所有 handler 同步执行（bcrypt 同步调用，NFR-006 约束）\n');
W('- **依赖注入模式**：模块通过 service 注入；测试时可用 mock 替换\n');
W('- **错误统一出口**：所有抛错必须为 AppError 子类，由 SD-022 errorHandler 统一处理\n');
W('- **事件驱动**：业务关键写操作通过 EventEmitter 触发 SD-011/SD-013/SD-016 监听\n\n');

W('### 2.2 接口契约 Schema 模板（10 字段）\n\n');
W('每个接口契约按以下 10 字段填写，缺一即返工：\n\n');
W('| 字段 | 必填 | 示例 |\n|---|:---:|---|\n');
W('| 接口名 | ✅ | `registerUser` |\n');
W('| 路径 / 触发器 | ✅ | `POST /api/v1/users` |\n');
W('| 参数名 | ✅ | `email`, `username`, `password` |\n');
W('| 参数类型 | ✅ | `string(email)`, `string(3-32)` |\n');
W('| 必填 | ✅ | `true` |\n');
W('| 默认值 | ⬜ | `page=1` |\n');
W('| 约束 | ✅ | `len(email)=5-254, format=email` |\n');
W('| 示例 | ✅ | `{"email":"alice@example.com",...}` |\n');
W('| 返回值结构 | ✅ | `{userId, role, ...}` |\n');
W('| 错误码集合 | ✅ | `40001, 40002, 40901, 42901` |\n\n');

W('### 2.3 错误码分层约定（继承阶段 2）\n\n');
W('| 段位 | 范围 | 含义 | 示例 |\n|---|---|---|---|\n');
W('| 4xx | 40000-49999 | 客户端错误（参数/认证/权限） | `40001 VALIDATION_FAILED`, `40101 UNAUTHENTICATED`, `40301 FORBIDDEN` |\n');
W('| 5xx | 50000-59999 | 服务端错误 | `50001 INTERNAL_ERROR` |\n');
W('| 业务 | 60000-69999 | 业务规则错误 | `60001 EMPTY_CONTENT`, `60002 MAX_DEPTH_EXCEEDED` |\n\n');
W('每条错误码必须配套 `code` + `message` + `httpStatus` + `retryable`（是否可重试）四元组。\n\n');

W('### 2.4 跨模块数据源选择约束（继承 §1.3 阶段 2）\n\n');
W('**约束要点**（来自 `phase-3-outline-design.md`）：\n\n');
W('- **显式声明**：每个跨模块调用须在接口契约中显式声明使用的 store\n');
W('- **schema 一致**：store 选择须与 schema 中的实体定义一致\n');
W('- **token sub 对齐**：调用方携带 token 时，token.sub 须与所选 store 的主键一致\n\n');
W('**反例**（已通过 §3 修复）：\n\n');
W('- ❌ `CommentService.create` 仅校验 user store，但 comment.bloggerId 引用 blogger 实体（P7-003 缺陷）\n');
W('- ❌ `BloggerService.follow` 在 blogger store 校验 follower（应校验 user store，P7-002 缺陷）\n\n');
W('**正例**（§3 22 INTF 契约中已显式声明 dataSources 字段）：\n\n');
W('- ✅ `INTF-010 评论`：`dataSources: ["user/blogger store (author 校验)", "posts store (postId 校验)", "comments store"]`\n');
W('- ✅ `INTF-003 关注`：`dataSources: ["user store (readerId 校验)", "blogger store (bloggerId 校验)", "follows store"]`\n\n');

W('### 2.5 字段命名业务语义对齐\n\n');
W('字段命名须反映业务语义：\n\n');
W('- ✅ `followerId/followeeId`（业务语义清晰）\n');
W('- ✅ `bloggerId/userId`（区分角色实体）\n');
W('- ❌ `userId/bloggerId`（业务语义模糊）\n\n');
W('**Implementation Decisions**（第 22 轮 P1-4 修正）：\n\n');
W('- 阶段 3 决定：所有 token payload 的 sub 字段统一为 `accountId` 抽象（reader→userId, blogger→bloggerId, admin→adminId），但 API path/query 中显式区分 `userId`/`bloggerId`/`adminId`\n');
W('- JWT 签发时 sub = 实体主键（userId 或 bloggerId 或 adminId）；path 路径 :id 必须匹配 sub 的实体类型\n');
W('- INTF-004 多博主切换后，新 token 的 sub=bloggerId（不再是 userId），这是 REQ-017 的实现决策\n\n');

W('### 2.6 测试 seam 决策（第 10 轮外部技能吸收）\n\n');
W('**模块交互 seam**：\n\n');
W('| 模块对 | seam = | 说明 |\n|---|---|---|\n');
W('| SD-001 → SD-005 | `UserRepository` / `BlogpostRepository` 公共导出 | 阶段 6 IT 用 supertest + 真实 Repository |\n');
W('| SD-005 → SD-011/SD-013/SD-016 | `EventBus` 公共导出 | 阶段 6 IT 用 `EventBus.on("post.published", spy)` 验证事件 |\n');
W('| SD-007 → SD-011 | `EventBus` + `NotificationRepository.insert` | 阶段 6 IT 验证 like.created → 通知入库 |\n');
W('| SD-013 → 外部 Subscriber | `WebhookDispatcher.dispatchWithRetry` | 阶段 6 IT 用 nock 拦截 HTTP + 断言重试次数 |\n');
W('| SD-020 → SD-022 | `RateLimiter.check` + `errorHandler` 中间件 | 阶段 6 IT 用 supertest 在 100 req 内 + 1 req 验证 429 |\n\n');
W('**选定 seam**：\n\n');
W('- 集成测试主 seam: **HTTP API 出口**（supertest）+ **EventBus spy**\n');
W('- 复用阶段 2 seam 的部分：HTTP 端点已在 system-test.md 中验证；阶段 3 复用其路径但聚焦模块间交互\n\n');
W('**理由**：\n\n');
W('- 集成测试在"模块边界"而非系统边界测，聚焦跨模块数据流\n');
W('- 现有 HTTP API 出口 + EventBus 是天然测试 seam，无需新建专用接口\n\n');
W('---\n\n');

console.log('§2 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
