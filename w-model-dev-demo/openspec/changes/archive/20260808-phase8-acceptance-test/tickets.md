# Tickets: 阶段 8 验收测试工单（phase8-acceptance-test）

## 验收测试用例工单（UAT-001~UAT-073，源自阶段 1 设计）

| Ticket | 用例组 | 关联需求/契约 | 状态 |
|---|---|---|---|
| UAT8-001 | 认证域 ×12（UAT-001~012：注册/登录/博主申请/资料/改密/认证失效） | REQ-007..010 / INTF-002 / CON-003 / NFR-006 | ✅ 通过 |
| UAT8-002 | 文章管理 ×12（UAT-013~024：草稿/发布/归档状态机/分页/删除） | REQ-011..014 / INTF-005/008 / CON-002 | ✅ 通过 |
| UAT8-003 | 元数据 ×5（UAT-025~029：标签/分类嵌套/重名） | REQ-015..016 / INTF-009/010 | ✅ 通过 |
| UAT8-004 | 浏览与评论 ×11（UAT-030~040：浏览/筛选/详情/评论权限/点赞/收藏/关注） | REQ-011..017 / INTF-011~015 / CON-002 | ✅ 通过 |
| UAT8-005 | 发现 ×6（UAT-041~046：热门/推荐/全文搜索/分页） | REQ-017..018 / INTF-011/016/017 / NFR-002 | ✅ 通过 |
| UAT8-006 | 统计与通知 ×8（UAT-047~054：阅读去重/面板/趋势/通知/已读） | REQ-019..021 / INTF-018~020 / NFR-002 | ✅ 通过 |
| UAT8-007 | 集成 ×5（UAT-055~059：RSS/Webhook 签名/重试/评论事件） | REQ-022..028 / INTF-021/022 / CON-002 | ✅ 通过 |
| UAT8-008 | 性能与质量 ×6（UAT-060/061/066/067/068/069：P95 基线/覆盖率/分层/限流） | NFR-001/004/005/006 / CON-001 | ✅ 通过 |
| UAT8-009 | 安全与约束 ×8（UAT-062/063/064/065/070/071/072/073：加盐/注入/事务/留存/技术栈/错误结构/JWT/审计） | CON-002/003/004 / NFR-002/003 | ✅ 通过 |

## 契约差异登记工单（设计预期 → 实现契约，按实现断言并登记报告 §5）

| Ticket | 用例 | 设计预期 | 实现契约（按此断言） |
|---|---|---|---|
| UAT8-DIFF-001 | UAT-002/003/005/006 | 字符串错误码 EMAIL_ALREADY_EXISTS 等 | 数字业务码 40001~60003，响应 `{ error: { code, message } }`（INTF §0.3） |
| UAT8-DIFF-002 | UAT-004/013/022/031/049 | 字段 account/content/size/readCount/category | identifier/body/pageSize/viewCount/categoryId（INTF-002/005/011） |
| UAT8-DIFF-003 | UAT-020 | archived 直发预期 400 | 60001 错误码 httpStatus=409，断言 409 + 60001 |
| UAT8-DIFF-004 | UAT-049 | 不同 IP 累加 | supertest seam 下 req.ip 恒 127.0.0.1，seam-STORE 注入 2 个 clientIp + 真实请求组合验证 |
| UAT8-DIFF-005 | UAT-052 | 通知类型 comment_reply/article_like/new_article | REPLY/LIKE/NEW_ARTICLE 枚举；REPLY/LIKE 通知文章作者、NEW_ARTICLE 通知粉丝（ST-002） |
| UAT8-DIFF-006 | UAT-028 | 快照 depth 断言 | computeDepth 沿 parentId 链实时计算，seed 真实三级链 |
| UAT8-DIFF-007 | UAT-046 | 子串匹配搜索 | 索引/检索 token 精确匹配（字母数字/CJK 连续段小写去重），关键词须可独立分词 |
| UAT8-DIFF-008 | UAT-066/067/070 | 常规 HTTP 断言 | NFR-004/005、CON-001 无 HTTP 路由 → seam-STATIC 构建期静态断言（vitest 阈值 + 目录分层 + package.json 依赖） |
| UAT8-DIFF-009 | UAT-073 | 登录审计 actorId 有值 | 登录为公开路由（无 authenticate），审计在认证前记录 → actorId=null（ST-027 契约） |

## 遗留登记（交真实用户复核 / 后续轮次）

- UAT-066 覆盖率断言条件性弱化（coverage 报告缺失时退化为 vitest 阈值弱门禁）；UAT-063 密钥扫描仅单文件（当前全 src/ Grep 无硬编码）；UAT-073 保留策略运行时装配未端到端验证；阶段 1 设计文档差异标注未同步（由报告 §5 承担）；ST-032/ST-033 断言收紧建议；RateLimitMiddleware counters Map 窗口过期不清 key 内存增长；SSRF 协议白名单负面断言缺口（阶段 6 遗留延续）。
