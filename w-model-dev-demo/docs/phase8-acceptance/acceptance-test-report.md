# 验收测试报告

> 阶段 8（验收测试）执行产出。套用 `templates/test-report.md`（类型=验收测试）。
> 用例设计来源：`docs/phase1-requirements/acceptance-test-design.md`（73 条 UAT-001~073）；路径映射：`docs/uat-path-mapping.md`（阶段 5 回填实际路径 + 映射类型）。
> 测试 seam：seam-HTTP（supertest 直连 createApp，不启真实端口）+ seam-STORE（seed 数据/快照断言）+ seam-STATIC（构建期静态断言）+ 本地 mock 回调（UAT-057~059/064/065）。
> 执行模式：`self-as-verifier`（自驱模式，B 段合并为单次中点检查；C 段用户确认区见 §9）。

## 文档信息

- 项目名称：博客系统后端（blog-system-demo-r35）
- 测试类型：验收测试
- 执行阶段：阶段 8
- 执行日期：2026-08-07
- 执行者：W 模型 S-coding（测试编码变体）· self-as-verifier 模式

## 1. 测试概要

| 指标 | 数值 |
|---|---|
| 用例总数 | 73 |
| 通过 | 73 |
| 失败 | 0 |
| 跳过 | 0 |
| 通过率 | 100% |
| 执行命令 | `npm run test:acceptance`（`cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/acceptance`） |
| 退出码 | 0 |
| 测试文件 | 9（auth / article / metadata / browse / interaction / discovery / stats / integration / crosscut） |

执行统计：9 个测试文件全通过，单次执行约 9~15s（含性能基线 2 条与 Webhook 重试等待 3 条）。

覆盖口径（对照阶段 1 设计）：
- 功能点覆盖：22/22（REQ-007~028，每需求 ≥2 条：正常 + 异常/边界）
- 非功能覆盖：6/6（NFR-001~006）
- 约束覆盖：4/4（CON-001~004）
- 边界覆盖：token 过期（UAT-006）、状态机非法流转（UAT-019/020/021）、分类深度 >3 层（UAT-028）、重复点赞幂等（UAT-038）、无历史推荐回退（UAT-044）、同 IP 去重/不同 IP 累加（UAT-048/049）、限流阈值（UAT-068/069）、分页边界（UAT-022/030/046/053）
- 禁止行为合规：UAT-006/012/063 的认证失效验证均选用**需认证接口**（GET /api/users/me）；73 条全部含前置条件分析（认证状态/数据依赖/接口路径）

## 2. 测试结果明细

| 用例 ID | 标题 | 优先级 | 状态 | 备注 |
|---|---|---|---|---|
| UAT-001 | 读者注册账号成功 | 高 | ✅ 通过 | 201；响应无密码字段；存储为 bcrypt 哈希（$2a$10$） |
| UAT-002 | 重复邮箱注册被拒 | 高 | ✅ 通过 | 409 + 40901（EMAIL_ALREADY_EXISTS 语义→数字码）；用户数不变 |
| UAT-003 | 注册缺必填字段/弱密码被拒 | 高 | ✅ 通过 | 400 + 40001/40002（VALIDATION_ERROR 语义）；无用户创建 |
| UAT-004 | 邮箱/用户名+密码登录签发 JWT | 高 | ✅ 通过 | 登录参数 identifier（INTF-002）；exp−iat ≤ 86400s |
| UAT-005 | 错误凭据登录失败 | 高 | ✅ 通过 | 401 + 40101（INVALID_CREDENTIALS 语义），无 token |
| UAT-006 | 过期 token 访问需认证接口被拒 | 高 | ✅ 通过 | GET /api/users/me → 401 + 40102（TOKEN_EXPIRED 语义），禁止行为 #12 合规 |
| UAT-007 | 申请成为博主成功 | 高 | ✅ 通过 | 申请后须重新登录获取博主 JWT（JWT 角色快照契约，ST-001） |
| UAT-008 | 普通读者创建文章被拒 | 高 | ✅ 通过 | 403 + 40301；文章未创建 |
| UAT-009 | 博主越权管理他人文章被拒 | 高 | ✅ 通过 | PUT/DELETE 他人文章均 40301（PATCH→PUT 等价映射）；文章未被修改 |
| UAT-010 | 查看与修改自己的资料 | 高 | ✅ 通过 | GET/PATCH /api/users/me；修改持久化 |
| UAT-011 | 修改密码校验原密码 | 高 | ✅ 通过 | 原密码错误 400 + 60002；改密后旧密码登录 401 |
| UAT-012 | 未认证访问资料接口被拒 | 高 | ✅ 通过 | 401 + 40101 |
| UAT-013 | 博主创建文章为草稿状态 | 高 | ✅ 通过 | 201 + status=draft；tags 名称数组/categoryId 关联 |
| UAT-014 | 创建文章缺必填字段被拒 | 高 | ✅ 通过 | 400 + 40001；文章数不增加 |
| UAT-015 | 发布草稿后读者可见 | 高 | ✅ 通过 | publish → published；列表/详情读者可见 |
| UAT-016 | 已发布文章更新后重新发布 | 高 | ✅ 通过 | 编辑已发布置回 draft（INTF-008）→ 重发布 → 读者见 v2 |
| UAT-017 | 发布不存在/他人文章被拒 | 高 | ✅ 通过 | 不存在 404 + 40401；他人文章 403 + 40301 |
| UAT-018 | 文章状态机合法流转 | 高 | ✅ 通过 | draft→published→archived；终态经 GET /api/blogger/articles 断言 |
| UAT-019 | 已发布文章不可删除 | 高 | ✅ 通过 | DELETE published → 409 + 60001；文章仍在 |
| UAT-020 | 已归档文章不可直接再发布 | 高 | ✅ 通过 | archived 直发 → 409 + 60001（设计预期 400，实际 60001 HTTP 409，INTF §0.3） |
| UAT-021 | 取消归档回草稿后可再发布 | 高 | ✅ 通过 | unarchive→draft→publish 闭环 |
| UAT-022 | 查看文章列表（草稿+已发布，分页） | 高 | ✅ 通过 | GET /api/blogger/articles 等价映射；两页全集含 draft+published、total=3 |
| UAT-023 | 编辑文章 | 高 | ✅ 通过 | PUT 编辑持久化 |
| UAT-024 | 删除草稿成功、已发布仅可归档 | 高 | ✅ 通过 | 删草稿 204；删已发布 409 + 60001 |
| UAT-025 | 创建标签（名称唯一） | 中 | ✅ 通过 | 201 + tagId/name |
| UAT-026 | 重复标签名创建被拒 | 中 | ✅ 通过 | 409 + 40901（TAG_NAME_EXISTS 语义） |
| UAT-027 | 创建分类并支持嵌套 | 中 | ✅ 通过 | 三级嵌套 depth 1/2/3 |
| UAT-028 | 分类嵌套深度超 3 层被拒 | 中 | ✅ 通过 | parentId 真实链 seed；400 + 60003（CATEGORY_DEPTH_EXCEEDED 语义） |
| UAT-029 | 重复分类名创建被拒 | 中 | ✅ 通过 | 409 + 40901 |
| UAT-030 | 分页浏览已发布文章 | 高 | ✅ 通过 | 仅 published、total=3、无草稿 |
| UAT-031 | 按分类/标签筛选文章 | 高 | ✅ 通过 | categoryId+tag 组合筛选（筛选参数名 categoryId，INTF-011） |
| UAT-032 | 文章详情含正文与作者；草稿 404 | 高 | ✅ 通过 | 详情含 body/author；草稿 404 + 40402 防枚举 |
| UAT-033 | 发表评论审核自动通过 | 高 | ✅ 通过 | 201 + 立即可见（自动审核通过） |
| UAT-034 | 未登录发表评论被拒 | 高 | ✅ 通过 | 401 + 40101，评论不创建 |
| UAT-035 | 作者删除评论、非作者被拒、支持回复 | 高 | ✅ 通过 | 非作者 40301 / 作者 204 / 回复 201 parentId（DELETE/POST 路径等价映射） |
| UAT-036 | 点赞文章且详情展示点赞数 | 中 | ✅ 通过 | likeCount=1 |
| UAT-037 | 收藏文章并查看收藏列表 | 中 | ✅ 通过 | GET /api/me/favorites 等价映射；2 篇收藏 |
| UAT-038 | 重复点赞幂等 | 中 | ✅ 通过 | 重复点赞均 200；likeCount 不累加（=1） |
| UAT-039 | 关注博主后 feed 出现新文章 | 中 | ✅ 通过 | follow → 发布 → feed 含新文 |
| UAT-040 | 取消关注后不再推送 | 中 | ✅ 通过 | unfollow 后 feed 不含 B 新文章 |
| UAT-041 | 热门文章按 7 天阅读量 Top10 | 中 | ✅ 通过 | popular→hot 等价映射；Top10 降序（viewCount7d） |
| UAT-042 | 无阅读数据时热门列表为空 | 中 | ✅ 通过 | 空数据 items=[] |
| UAT-043 | 有阅读历史时按标签偏好推荐 | 中 | ✅ 通过 | recommendations→me/recommendations 等价；reason=tag-preference |
| UAT-044 | 无阅读历史时推荐回退热门 | 中 | ✅ 通过 | 全部 reason=hot-fallback |
| UAT-045 | 全文搜索命中四字段 | 中 | ✅ 通过 | 四字段均可命中（索引 token 精确匹配，关键词须可独立分词） |
| UAT-046 | 搜索分页与无结果 | 中 | ✅ 通过 | 分页 2+total=5；无结果空列表 |
| UAT-047 | 文章详情访问阅读量 +1 | 中 | ✅ 通过 | viewCount 首次 1、窗口过期后 2（窗口参数化验证） |
| UAT-048 | 同 IP 短时间窗口去重 | 中 | ✅ 通过 | 同 IP 3 次访问 viewCount 保持 1 |
| UAT-049 | 不同 IP 访问累加计数 | 中 | ✅ 通过 | seam-STORE 注入 2 个不同 clientIp + 真实请求 → viewCount=3（环境限制声明，见 §5-3） |
| UAT-050 | 博主统计面板核心指标 | 中 | ✅ 通过 | articleCount=3/totalViews=10/totalComments=5 |
| UAT-051 | 近 7 天阅读趋势 | 中 | ✅ 通过 | trend 7 点，有记录 3 天 >0、无记录 4 天 =0 |
| UAT-052 | 三类事件产生通知 | 中 | ✅ 通过 | REPLY/LIKE 通知文章作者、NEW_ARTICLE 通知粉丝（通知对象契约 ST-002） |
| UAT-053 | 通知列表分页 | 中 | ✅ 通过 | 3 条 + total=5，含 read=false |
| UAT-054 | 标记通知已读；操作他人通知被拒 | 中 | ✅ 通过 | 标记已读 200 + read=true；他人通知 404 + 40401 |
| UAT-055 | RSS 源含四字段 | 中 | ✅ 通过 | feeds→bloggers 等价映射；RSS 2.0 XML、item 2 条含四字段 |
| UAT-056 | 草稿文章不出现在 RSS | 中 | ✅ 通过 | 1 draft + 1 published → item 仅 1 条 |
| UAT-057 | 发布触发 Webhook 且签名可验 | 中 | ✅ 通过 | event=article.published；HMAC-SHA256 签名（X-Blog-Signature）可验 |
| UAT-058 | Webhook 失败自动重试 3 次 | 中 | ✅ 通过 | mock 500 → 重试 3 次；attempts=3/status=failed |
| UAT-059 | 评论新增触发 Webhook | 中 | ✅ 通过 | event=comment.created，含评论与文章数据 |
| UAT-060 | 常规 API P95 ≤ 2000ms | 中 | ✅ 通过 | 注册/登录/列表/详情各 20 次采样；P95 实测见 §3 |
| UAT-061 | 高流量场景性能基线 | 中 | ✅ 通过 | 浏览+搜索+推荐组合 30 次采样；P95 实测见 §3 |
| UAT-062 | 密码 bcrypt 加盐哈希存储 | 高 | ✅ 通过 | 同明文两次注册哈希不同（加盐）；改密后新哈希、旧哈希不可用 |
| UAT-063 | JWT 密钥注入与有效性校验 | 高 | ✅ 通过 | 错误密钥 token 401 + 40101；源码无密钥字面量（仅 process.env.JWT_SECRET） |
| UAT-064 | 发布关键操作事务一致性 | 中 | ✅ 通过 | 发布成功（published）+ 投递最终 failed 收敛（无中间态） |
| UAT-065 | Webhook 失败记录留存 | 中 | ✅ 通过 | attempts=3/lastError 非空/status=failed |
| UAT-066 | 单元测试行覆盖率 ≥ 80% | 中 | ✅ 通过 | 静态断言：vitest 阈值 lines:80 + coverage-final.json 实测 94.76% |
| UAT-067 | 分层结构约束 | 中 | ✅ 通过 | 静态断言：routes/services/stores 三层存在；服务层对 store 仅类型引用 |
| UAT-068 | 认证接口限流超限 429 | 中 | ✅ 通过 | 测试环境 limit=5 → 第 6 次 429 + 42901 |
| UAT-069 | 通用 API 限流超限 429 | 中 | ✅ 通过 | 测试环境 limit=5 → 第 6 次 429 + 42901 |
| UAT-070 | 技术栈约束 | 高 | ✅ 通过 | 静态断言：Express ^4 + TypeScript ^5；无 DB 驱动；内存 Map 存储 |
| UAT-071 | 统一错误响应结构 | 高 | ✅ 通过 | 400/401/404/409/429 五类均 `{ error: { code, message } }`，无多余顶层字段 |
| UAT-072 | JWT 有效期与密钥注入 | 高 | ✅ 通过 | exp−iat ≤ 86400s；JWT_SECRET=test-* 环境变量注入 |
| UAT-073 | 关键操作审计日志与保留策略 | 中 | ✅ 通过 | 登录/发布/删除三类留痕齐全（含 CON-004 缺陷修复，见 §5-1）；保留 ≥90 天 |

## 3. 性能结果（验收测试适用）

> 度量环境声明（NFR-001 testThreshold）：CI/验收环境，supertest 直连 Express app 工厂（进程内请求，无网络开销）；UAT-060 各接口 20 次串行采样（预热后计时），UAT-061 三接口轮询 30 次；生产目标 200ms 以 targetValue 登记不作本环境断言。

| 指标 | 目标（testThreshold） | 实测 | 是否达标 |
|---|---|---|---|
| UAT-060 注册 POST /api/auth/register | P95 ≤ 2000ms | P95 < 500ms / 错误率 0 | ✅ |
| UAT-060 登录 POST /api/auth/login | P95 ≤ 2000ms | P95 < 500ms / 错误率 0 | ✅ |
| UAT-060 文章列表 GET /api/articles | P95 ≤ 2000ms | P95 < 500ms / 错误率 0 | ✅ |
| UAT-060 文章详情 GET /api/articles/:id | P95 ≤ 2000ms | P95 < 500ms / 错误率 0 | ✅ |
| UAT-061 组合流量（浏览+搜索+推荐，30 次） | P95 ≤ 2000ms | P95 < 500ms / 错误率 0 | ✅ |
| 生产目标（targetValue，登记不断言） | P95 ≤ 200ms | — | 生产环境由运维侧度量 |

> 说明：UAT-060/061 断言阈值为 2000ms（testThreshold）；实测远低于阈值（P95 < 500ms，本机负载下波动）。系统测试 ST-029~031（1000 样本）亦全通过（P95=276~1796ms）。

## 4. 安全结果（验收测试适用）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 密码 bcrypt 加盐哈希（UAT-062） | ✅ 无明文 | 注册/改密后 UserStore 快照为 bcrypt 哈希；同明文两次注册哈希不同（加盐） |
| JWT 密钥注入与有效性（UAT-063/072） | ✅ 注入生效 | 密钥仅环境变量引用（源码无字面量）；错误密钥 token 401；有效期 24h |
| 认证失效（UAT-006/012） | ✅ 校验生效 | 过期 token 40102 / 未认证 40101（均经需认证接口验证） |
| 越权防护（UAT-008/009/017/035/054） | ✅ 校验生效 | 角色越权 40301、资源归属 40301、他人通知 40401 |
| 高危漏洞 | 无 | 验收级安全断言全过；npm audit 等扫描由质量门（G 子代理）执行 |

## 5. 失败用例分析

无失败用例（73/73 通过，退出码 0）。

**测试驱动修复记录**（真实测试驱动，首轮 14 失败 → 逐项修复 → 全通过）：

1. **产品缺陷 1 处（CON-004 审计日志被覆盖）**：`src/middlewares/auditMiddleware.ts` 构造审计记录时硬编码 `id: ''`，而 `AuditLogStore.append` 的 `input.id ?? nextId(...)` 不兜底空字符串 → 每次 `map.set('', ...)` 覆盖前一条记录，登录/发布/删除三类审计无法同时留存（UAT-073 首轮暴露）。**修复**：省略 id 字段，交由 append 以 `nextId('au')` 生成唯一 id。修复后单元测试 UT-043（mock append 断言字段白名单）无回归，ST-027 语义增强（三类记录同存）。
2. **测试侧修正 13 处**（用例实现与实现契约对齐，非产品缺陷）：seed 用户 email 与 login identifier 不一致（9 处笔误）；UAT-011 错误原密码 `Wrong!1` 长度 7 触发表单校验 40002（改用 11 位 `WrongPass!1` 以命中业务校验 60002）；UAT-022 分页首页排序不保证含 published（改两页全集断言）；UAT-028 分类深度须 seed 真实 parentId 链（computeDepth 沿链计算，非快照 depth 值）；UAT-046 搜索索引 token 精确匹配（关键词须可独立分词）；UAT-052 通知快照经 `listByUser`（NotificationStore 无 findAll）；UAT-058/064/065 投递记录经 `listByWebhook`（WebhookDeliveryStore 无 findAll）；UAT-052 pageSize 上限 50；UAT-073 登录审计 actorId 恒为 null（登录为公开路由，无 authenticate，设计契约与 ST-027 一致）。

**契约差异与测试适配说明**（阶段 1 设计 vs 阶段 3 接口设计/阶段 5 实现，验收按真实契约断言并登记）：

1. **错误码数字契约**：阶段 1 设计用字符串错误码（EMAIL_ALREADY_EXISTS / VALIDATION_ERROR / TOKEN_EXPIRED / INVALID_CREDENTIALS / FORBIDDEN / UNAUTHORIZED / INVALID_TOKEN / TAG_NAME_EXISTS / CATEGORY_NAME_EXISTS / CATEGORY_DEPTH_EXCEEDED / INVALID_TRANSITION / RATE_LIMITED 等）；阶段 3 接口设计 §0.3 收紧为数字业务码（40001~60003），响应结构 `{ error: { code, message } }`。验收测试按阶段 3 契约断言数字码，字符串→数字语义映射见 §2 备注。
2. **字段名契约**：登录参数 `account`→`identifier`（INTF-002）；创建文章 `content`→`body`（INTF-005）；分页 `size`→`pageSize`（INTF §0.2）；阅读量 `readCount`→`viewCount`（INTF-011）；筛选 `category`→`categoryId`（INTF-011）。
3. **UAT-049 不同 IP 环境限制**：supertest 直连 seam 下 `req.ip` 恒为 127.0.0.1（无法模拟多真实客户端 IP，与系统测试 ST-028 环境声明一致）→ 以 seam-STORE 注入 2 个不同 clientIp 阅读记录（等价 2 个不同访问者）+ 真实请求组合验证「不同 IP 分别计数，去重仅限同 IP 窗口」。
4. **UAT-020 状态机非法流转状态码**：设计预期 400；实现 60001 错误码 httpStatus=409（INTF §0.3 60001=409）。断言 409 + 60001。
5. **UAT-052 通知类型**：设计 `comment_reply/article_like/new_article` → 实现 `REPLY/LIKE/NEW_ARTICLE`（INTF-020 类型枚举）；通知对象契约：REPLY/LIKE 通知文章作者、NEW_ARTICLE 通知关注博主粉丝（ST-002 已登记）。
6. **UAT-028 分类深度 seed 方式**：`seedCategory.depth` 仅为写入快照值，深度校验由 `computeDepth` 沿 parentId 链实时计算 → 构造超深场景须 seed 真实 parentId 三级链。
7. **UAT-046 搜索分词契约**：索引与检索均按 token 精确匹配（`tokenize`：字母数字/CJK 连续段小写去重），非子串匹配 → 关键词须可独立分词（如 `typescript`/`keyword`）。
8. **UAT-066/067/070 构建期断言**：NFR-004/005、CON-001 无 HTTP 路由（映射表「不适用」）→ 以静态断言实现（vitest 阈值配置 + coverage 报告快照 / 目录分层 + 服务层 import 模式 / package.json 依赖清单 + 内存存储实现证据）。
9. **UAT-073 审计 actorId**：登录为公开路由（无 authenticate 中间件），审计中间件在认证前记录 → login 记录 actorId=null（与 ST-027 契约一致）；发布/删除携带 token，actorId 有值。

## 6. 结论

- [x] 测试通过，可进入下一阶段

**量化指标**（sig-006，禁止模糊结论）：
- 测试通过率：`73/73`（100%）
- 性能指标：UAT-060/061 四接口 + 组合流量 `P95 < 500ms / 错误率=0%`（testThreshold ≤ 2000ms）
- 阈值对比：`P95 ≤ 2000ms` ✓（6 项性能断言全达标）
- 代码覆盖率（NFR-004，UAT-066）：coverage-final.json 实测 `94.76% lines` ≥ 80% ✓
- 回归确认：单元 `175/175`、集成 `30/30`、系统 `40/40`、验收 `73/73` = `318/318` 全通过（`npm run test` 退出码 0）

## 7. 质量门状态（验收测试后）

> 本表登记验收测试侧证据；门禁脚本（check-artifact-gate.ts 等）由 G 子代理在终检阶段执行（本阶段任务禁止跑 check-*.ts）。

- [x] 验收测试全部通过（73/73，退出码 0）
- [x] 性能达标（UAT-060/061 P95 ≤ 2000ms；ST-029~031 1000 样本全通过）
- [x] 安全无高危（bcrypt 加盐 / JWT 注入 / 认证失效 / 越权防护验收断言全过）
- [x] 单元测试代码覆盖率 ≥ 80%（coverage-final.json 94.76%）
- [x] 全量回归通过（318/318：175 UT + 30 IT + 40 ST + 73 UAT）
- [ ] 规范检查 / RTM 需求覆盖率 100%（G 子代理执行 check-artifact-gate.ts 确认）

## 8. RTM 终检依据

- `.w-model/rtm.json` 已回填：32 行需求（REQ-007~028 + NFR-001~006 + CON-001~004）acceptanceTest 列执行状态「✅ 通过」，`executionSummary.acceptanceTest = { total: 73, passed: 73, failed: 0, pending: 0 }`。
- RTM 需求覆盖率 100%：22/22 功能 + 6/6 非功能 + 4/4 约束均建立 UAT 映射且全部通过。

## 9. 项目级放行确认（CHECKPOINT-C · 用户确认区）

> 🔴 **C 段强制暂停点**：验收测试全部执行完成后，须由真实用户在下方「用户确认」区记录确认状态。self-as-verifier（自驱）模式下 B 段合并为单次中点检查（已执行：73/73 全通过、无失败批次，未触发 >20% 失败率强制暂停），**C 段在任何模式下均强制暂停不变**。

**项目级验收检查清单**：

- [x] 需求规格说明书完整（docs/phase1-requirements/requirement-spec.md）
- [x] 设计文档完整且符合规范（阶段 2/3/4 设计产物齐备）
- [x] 代码实现完成且通过编译（阶段 5 编码完成，`npm run test` 编译通过）
- [x] 单元测试代码覆盖率 ≥ 80%（实测 94.76%）
- [x] 集成测试全部通过（30/30）
- [x] 系统测试全部通过（40/40）
- [x] 安全测试无高危漏洞（NFR-002 验收断言全过）
- [x] 性能测试达标（NFR-001 testThreshold P95 ≤ 2000ms）
- [x] 验收测试通过（73/73，退出码 0）
- [ ] 用户确认签字（见下方确认区）
- [x] 交付文档齐全（阶段 1~8 产物 + 本报告）
- [x] RTM 需求覆盖率 100%（32/32 需求四级测试映射完整）

**用户确认区**（三选一，由真实用户填写；自驱模式调测者代签须标注「代签」）：

- [ ] `confirm`（确认系统满足需求，项目放行）
- [ ] `confirm-with-comments`（附注：________）
- [ ] `reject`（反馈见 reject 收集模板）

> **代签说明（self-as-verifier 模式）**：本 demo 执行模式 `executionMode=self-as-verifier`，调测者（S-coding 产出子代理）代签 `confirm`（「代签」）。依据：73/73 验收用例通过 + 全量回归 318/318 + RTM 100% + 项目级 12 项清单满足。**真实用户复核后可改签**；若用户复核不通过，按 phase-8 返工路径回到对应阶段。

---

## 附：执行证据

- 验收测试执行：`npm run test:acceptance` → **exitCode=0**，`Test Files 9 passed (9) / Tests 73 passed (73)`
- 全量回归：`npm run test` → **exitCode=0**，`Test Files 72 passed (72) / Tests 318 passed (318)`
- 四级测试计数：单元 175 + 集成 30 + 系统 40 + 验收 73 = 318
- 测试代码：`tests/acceptance/`（9 文件，73 条 UAT 用例）
