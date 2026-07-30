# UAT 路径映射表（UAT Path Mapping）

> **第 22 轮 P0-1 强制产出**。W 模型第 23 轮（2026-07-30）端到端调测。
>
> **本表生命周期**：
> - **阶段 1（需求分析）**：产出初始模板（路径 placeholder 为空），关联 UAT ID ↔ REQ ID。
> - **阶段 5（编码）**：回填 `testFile` 字段（实际测试代码路径）。
> - **阶段 8（验收测试）**：校验完整性（`check-artifact-gate.ts --phase=8`）。
>
> **格式**：`UAT-XXX | REQ-XXX | testFile:tests/acceptance/... | placeholder | 备注`
>
> **关联文档**：
> - 需求规格：`docs/phase1-requirements/requirement-spec.md` §12.3
> - 验收测试设计：`docs/phase1-requirements/acceptance-test-design.md` §1–§23

## 文档信息

- 项目 ID：`blog-system-demo`
- Round：23
- 编制者：S-doc 子代理（阶段 1）
- 阶段：1（初始模板，路径 placeholder 待阶段 5 回填）
- UAT 总数：72（UAT-001 ~ UAT-072，其中 UAT-072 含 10 个 NFR/CON 子项）
- REQ 覆盖：22 REQ + 6 NFR + 4 CON = 32 需求全覆盖

## 路径命名约定（待阶段 5 落地）

```
tests/acceptance/
├── auth/
│   ├── auth-login.spec.ts          # UAT-005~008 (REQ-002)
│   ├── auth-jwt-expiry.spec.ts     # UAT-008 (REQ-002 边界)
│   └── rate-limit.spec.ts          # UAT-072e (NFR-005)
├── user/
│   ├── user-register.spec.ts       # UAT-001~004 (REQ-001)
│   ├── user-profile.spec.ts        # UAT-009~011 (REQ-003)
│   └── follow.spec.ts              # UAT-012~014 (REQ-004)
├── blogger/
│   ├── blogger-register.spec.ts    # UAT-015~017 (REQ-005)
│   └── multi-blogger.spec.ts       # UAT-057~059 (REQ-017)
├── post/
│   ├── post-crud.spec.ts           # UAT-018~022 (REQ-006)
│   ├── post-browse.spec.ts         # UAT-023~025 (REQ-007)
│   ├── post-like-bookmark.spec.ts  # UAT-026~029 (REQ-008)
│   ├── post-tags.spec.ts           # UAT-041~043 (REQ-012)
│   └── post-search.spec.ts         # UAT-044~046 (REQ-013)
├── comment/
│   ├── comment-create.spec.ts      # UAT-030~033 (REQ-009)
│   └── comment-delete.spec.ts      # UAT-034~036 (REQ-010)
├── notification/
│   ├── notification-list.spec.ts   # UAT-037~040 (REQ-011)
│   └── webhook.spec.ts             # UAT-049~052 (REQ-015)
├── site/
│   ├── site-config.spec.ts         # UAT-053~056 (REQ-016)
│   ├── rss.spec.ts                 # UAT-047~048 (REQ-014)
│   └── ad-management.spec.ts       # UAT-069~071 (REQ-022)
├── admin/
│   ├── audit-log.spec.ts           # UAT-060~062 (REQ-018)
│   ├── access-record.spec.ts       # UAT-063~064 (REQ-019)
│   └── site-stats.spec.ts          # UAT-065~066 (REQ-020)
├── recommendation/
│   └── recommend.spec.ts           # UAT-067~068 (REQ-021)
├── perf/
│   ├── k6-read-apis.js             # UAT-072a (NFR-001)
│   └── k6-health.js                # UAT-072d (NFR-004)
└── nfr-con/
    ├── bcrypt.spec.ts              # UAT-072f (NFR-006)
    ├── tsc-strict.spec.ts          # UAT-072g (CON-001)
    ├── no-external-db.spec.ts      # UAT-072h (CON-002)
    ├── restful-json.spec.ts        # UAT-072i (CON-003)
    └── audit-90d-retention.spec.ts # UAT-072j (CON-004)
```

> **说明**：上述 `testFile` 字段是**约定路径**（基于 §10 Testing Decisions + 现有仓库结构），阶段 5 编码完成后回填实际路径；如与约定不同，以实际为准。

## 路径映射表

### 1. REQ-001 用户注册（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-001 | REQ-001 | tests/acceptance/user/user-register.spec.ts | | 正常注册 |
| UAT-002 | REQ-001 | tests/acceptance/user/user-register.spec.ts | | 重复邮箱 → 409 |
| UAT-003 | REQ-001 | tests/acceptance/user/user-register.spec.ts | | 无效邮箱格式 |
| UAT-004 | REQ-001 | tests/acceptance/user/user-register.spec.ts | | 密码长度 < 8 边界 |

### 2. REQ-002 用户登录（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-005 | REQ-002 | tests/acceptance/auth/auth-login.spec.ts | | 正常登录 + JWT |
| UAT-006 | REQ-002 | tests/acceptance/auth/auth-login.spec.ts | | 错误密码 → 401 |
| UAT-007 | REQ-002 | tests/acceptance/auth/auth-login.spec.ts | | 不存在邮箱 → 401 |
| UAT-008 | REQ-002 | tests/acceptance/auth/auth-jwt-expiry.spec.ts | | JWT 过期边界 |

### 3. REQ-003 用户资料（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-009 | REQ-003 | tests/acceptance/user/user-profile.spec.ts | | 匿名查公开资料 |
| UAT-010 | REQ-003 | tests/acceptance/user/user-profile.spec.ts | | 修改自己资料 |
| UAT-011 | REQ-003 | tests/acceptance/user/user-profile.spec.ts | | 改邮箱被拒 |

### 4. REQ-004 关注/取关（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-012 | REQ-004 | tests/acceptance/user/follow.spec.ts | | 关注博主成功 |
| UAT-013 | REQ-004 | tests/acceptance/user/follow.spec.ts | | 关注不存在 → 404 |
| UAT-014 | REQ-004 | tests/acceptance/user/follow.spec.ts | | 关注自己被拒边界 |

### 5. REQ-005 博主注册（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-015 | REQ-005 | tests/acceptance/blogger/blogger-register.spec.ts | | 博主注册成功 |
| UAT-016 | REQ-005 | tests/acceptance/blogger/blogger-register.spec.ts | | 邮箱被 reader 占用 |
| UAT-017 | REQ-005 | tests/acceptance/blogger/blogger-register.spec.ts | | 用户名长度边界 |

### 6. REQ-006 博文 CRUD（5 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-018 | REQ-006 | tests/acceptance/post/post-crud.spec.ts | | 创建草稿 |
| UAT-019 | REQ-006 | tests/acceptance/post/post-crud.spec.ts | | 发布草稿 |
| UAT-020 | REQ-006 | tests/acceptance/post/post-crud.spec.ts | | 非 owner 编辑 → 403 |
| UAT-021 | REQ-006 | tests/acceptance/post/post-crud.spec.ts | | 未认证创建 → 401 |
| UAT-022 | REQ-006 | tests/acceptance/post/post-crud.spec.ts | | 空内容发布被拒边界 |

### 7. REQ-007 博文浏览（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-023 | REQ-007 | tests/acceptance/post/post-browse.spec.ts | | 公开列表 + 分页 |
| UAT-024 | REQ-007 | tests/acceptance/post/post-browse.spec.ts | | 草稿不可见 → 404 |
| UAT-025 | REQ-007 | tests/acceptance/post/post-browse.spec.ts | | pageSize 上限 100 边界 |

### 8. REQ-008 点赞/收藏（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-026 | REQ-008 | tests/acceptance/post/post-like-bookmark.spec.ts | | 点赞成功 |
| UAT-027 | REQ-008 | tests/acceptance/post/post-like-bookmark.spec.ts | | 点赞不存在 → 404 |
| UAT-028 | REQ-008 | tests/acceptance/post/post-like-bookmark.spec.ts | | 未认证点赞 → 401 |
| UAT-029 | REQ-008 | tests/acceptance/post/post-like-bookmark.spec.ts | | 收藏列表分页边界 |

### 9. REQ-009 评论发表（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-030 | REQ-009 | tests/acceptance/comment/comment-create.spec.ts | | 顶级评论 |
| UAT-031 | REQ-009 | tests/acceptance/comment/comment-create.spec.ts | | 未登录评论 → 401 |
| UAT-032 | REQ-009 | tests/acceptance/comment/comment-create.spec.ts | | 不存在博文 → 404 |
| UAT-033 | REQ-009 | tests/acceptance/comment/comment-create.spec.ts | | 超过 5 层边界 |

### 10. REQ-010 评论删除（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-034 | REQ-010 | tests/acceptance/comment/comment-delete.spec.ts | | 作者删除自己 |
| UAT-035 | REQ-010 | tests/acceptance/comment/comment-delete.spec.ts | | 第三方删除 → 403 |
| UAT-036 | REQ-010 | tests/acceptance/comment/comment-delete.spec.ts | | 博主删他人在自有博文下评论边界 |

### 11. REQ-011 通知系统（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-037 | REQ-011 | tests/acceptance/notification/notification-list.spec.ts | | 接收关注通知 |
| UAT-038 | REQ-011 | tests/acceptance/notification/notification-list.spec.ts | | 标记已读 |
| UAT-039 | REQ-011 | tests/acceptance/notification/notification-list.spec.ts | | 他人通知不可见 → 404 |
| UAT-040 | REQ-011 | tests/acceptance/notification/notification-list.spec.ts | | read 过滤分页边界 |

### 12. REQ-012 文章标签（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-041 | REQ-012 | tests/acceptance/post/post-tags.spec.ts | | 创建标签并关联 |
| UAT-042 | REQ-012 | tests/acceptance/post/post-tags.spec.ts | | 6 个标签被拒 |
| UAT-043 | REQ-012 | tests/acceptance/post/post-tags.spec.ts | | 重复添加幂等边界 |

### 13. REQ-013 全文搜索（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-044 | REQ-013 | tests/acceptance/post/post-search.spec.ts | | 关键词命中 |
| UAT-045 | REQ-013 | tests/acceptance/post/post-search.spec.ts | | 空关键词 → 400 |
| UAT-046 | REQ-013 | tests/acceptance/post/post-search.spec.ts | | 大小写不敏感 + draft 过滤边界 |

### 14. REQ-014 RSS 订阅（2 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-047 | REQ-014 | tests/acceptance/site/rss.spec.ts | | RSS 输出 + XML 合法 |
| UAT-048 | REQ-014 | tests/acceptance/site/rss.spec.ts | | 无 published 空 channel 边界 |

### 15. REQ-015 Webhook 通知（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-049 | REQ-015 | tests/acceptance/notification/webhook.spec.ts | | 注册 + 触发 + 签名 |
| UAT-050 | REQ-015 | tests/acceptance/notification/webhook.spec.ts | | 500 触发重试 |
| UAT-051 | REQ-015 | tests/acceptance/notification/webhook.spec.ts | | URL 非 https 被拒 |
| UAT-052 | REQ-015 | tests/acceptance/notification/webhook.spec.ts | | 重试 3 次后仍失败边界 |

### 16. REQ-016 站点配置（4 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-053 | REQ-016 | tests/acceptance/site/site-config.spec.ts | | 匿名查配置 |
| UAT-054 | REQ-016 | tests/acceptance/site/site-config.spec.ts | | admin 修改配置 |
| UAT-055 | REQ-016 | tests/acceptance/site/site-config.spec.ts | | reader 修改 → 403 |
| UAT-056 | REQ-016 | tests/acceptance/site/site-config.spec.ts | | 当前生效横幅边界 |

### 17. REQ-017 多博主系统（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-057 | REQ-017 | tests/acceptance/blogger/multi-blogger.spec.ts | | 切换博主身份 |
| UAT-058 | REQ-017 | tests/acceptance/blogger/multi-blogger.spec.ts | | 切换到非自己绑定 → 403 |
| UAT-059 | REQ-017 | tests/acceptance/blogger/multi-blogger.spec.ts | | 切换回原身份边界 |

### 18. REQ-018 审计日志（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-060 | REQ-018 | tests/acceptance/admin/audit-log.spec.ts | | 关键操作自动记录 |
| UAT-061 | REQ-018 | tests/acceptance/admin/audit-log.spec.ts | | 非 admin 查询 → 403 |
| UAT-062 | REQ-018 | tests/acceptance/admin/audit-log.spec.ts | | 90 天前日志不可见边界 |

### 19. REQ-019 文章访问记录（2 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-063 | REQ-019 | tests/acceptance/admin/access-record.spec.ts | | 浏览触发访问记录 |
| UAT-064 | REQ-019 | tests/acceptance/admin/access-record.spec.ts | | 5 分钟去重窗口边界 |

### 20. REQ-020 站点统计（2 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-065 | REQ-020 | tests/acceptance/admin/site-stats.spec.ts | | PV / UV 聚合 |
| UAT-066 | REQ-020 | tests/acceptance/admin/site-stats.spec.ts | | range=7d 168 桶边界 |

### 21. REQ-021 推荐系统（2 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-067 | REQ-021 | tests/acceptance/recommendation/recommend.spec.ts | | 标签相似度推荐 |
| UAT-068 | REQ-021 | tests/acceptance/recommendation/recommend.spec.ts | | 冷启动回退最近热门边界 |

### 22. REQ-022 广告位管理（3 UAT）

| UAT ID | REQ ID | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-069 | REQ-022 | tests/acceptance/site/ad-management.spec.ts | | admin 创建广告 |
| UAT-070 | REQ-022 | tests/acceptance/site/ad-management.spec.ts | | reader 创建 → 403 |
| UAT-071 | REQ-022 | tests/acceptance/site/ad-management.spec.ts | | 过期广告不展示边界 |

### 23. NFR + CON 横切（UAT-072，含 10 个子项）

| UAT ID | 关联 | testFile（约定） | placeholder（阶段 1 留空） | 备注 |
|---|---|---|---|---|
| UAT-072a | NFR-001 | tests/acceptance/perf/k6-read-apis.js | | P95 ≤ 200ms 性能压测 |
| UAT-072b | NFR-002 | tests/acceptance/perf/memory-monitor.js | | heapUsed ≤ 100MB（1000 并发） |
| UAT-072c | NFR-003 | tests/acceptance/nfr-con/coverage.spec.ts | | 单元覆盖率 ≥ 80% |
| UAT-072d | NFR-004 | tests/acceptance/perf/k6-health.js | | 1000 并发 0 错误 |
| UAT-072e | NFR-005 | tests/acceptance/auth/rate-limit.spec.ts | | 100 req/min/IP 限流 |
| UAT-072f | NFR-006 | tests/acceptance/nfr-con/bcrypt.spec.ts | | bcrypt cost ≥ 10 |
| UAT-072g | CON-001 | tests/acceptance/nfr-con/tsc-strict.spec.ts | | TypeScript strict 0 错误 |
| UAT-072h | CON-002 | tests/acceptance/nfr-con/no-external-db.spec.ts | | 内存存储（无外部 DB） |
| UAT-072i | CON-003 | tests/acceptance/nfr-con/restful-json.spec.ts | | RESTful + JSON |
| UAT-072j | CON-004 | tests/acceptance/nfr-con/audit-90d-retention.spec.ts | | 审计日志保留 90 天 |

## 阶段 5 回填约定（待执行）

阶段 5 编码完成后，由 S-rtm 子代理或阶段 5 owner 回填 `placeholder` 列：

```
| UAT-001 | REQ-001 | tests/acceptance/user/user-register.spec.ts | tests/acceptance/user/user-register.spec.ts#UAT-001 | 已落地 |
```

回填规则：
1. **testFile 路径**：以仓库实际文件路径为准（可能与约定不同）。
2. **placeholder 锚点**：`<filename>#<it-block-name>`（如 `user-register.spec.ts#UAT-001`）；如同一 spec 含多条 UAT，用 `#<describe>-<it>` 锚点。
3. **回填完整性校验**：阶段 8 验收前 `check-artifact-gate.ts --phase=8` 校验所有 72 条 UAT 的 placeholder 非空。

## 阶段 1 摘要

- 初始 UAT 路径映射表已产出（72 条 UAT + 10 个 NFR/CON 子项）
- 路径 placeholder 全部留空（待阶段 5 回填）
- 32 需求全覆盖（22 REQ + 6 NFR + 4 CON）
- 4 维度覆盖：100%（stakeholder / scenario / requirementType / crossCuts）
- 0 conflicts-with 冲突
- 0 豁免审批事项
- 下阶段门禁：用户 CHECKPOINT 确认 → 放行进入阶段 2（系统设计）
