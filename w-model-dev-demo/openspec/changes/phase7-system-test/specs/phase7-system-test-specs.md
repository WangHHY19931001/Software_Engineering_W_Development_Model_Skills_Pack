# Specs: 阶段 7 系统测试规格（phase7-system-test）

## ST-001~ST-040 规格索引

- 规格来源：`docs/phase2-design/blog-system-system-test.md`（40 条 ST，seam-HTTP 主 + seam-STORE 辅）
- 契约来源：`docs/phase3-outline/blog-system-interface-design.md`（INTF-001~022，错误码四元组 ERROR_CATALOG 40001~60003）
- 执行登记：`docs/phase7-system/system-test-report.md`（§2 明细 40 行 / §3 性能 / §4 安全 / §5 契约差异 7 处）

## 关键规格点

1. **端到端全链路**（ST-001~005）：单用例多步断言；JWT 角色快照契约（ST-001 §5-1：申请博主后须重登）；REPLY 通知对象=文章作者（ST-002 §5-2）；Webhook HMAC 验签 + RSS 2.0 仅含已发布（ST-005）；mock 回调 per-test try/finally close；
2. **身份与状态机**（ST-006~010）：登录双标识 + 24h 有效期（CON-003）；角色越权 40301（阶段 7 禁止行为 #7 强制项）；状态机合法/非法流转 60001；
3. **交互与发现**（ST-011~020）：分类嵌套 ≤3 层（第 4 层 60003）；点赞幂等；热门 Top N 按 7 天阅读量降序（过滤 viewCount7d>0）；推荐冷启动回退热门；全文搜索四字段相关性排序（标题命中优先）；阅读去重窗口参数化（readingDedupWindowMs 注入）；
4. **统计与横切**（ST-021~024）：博主面板按 token.sub 数据隔离；通知三类事件分页已读；审计登录/发布/删除留痕 + 保留 ≥90 天（CON-004）；Webhook 失败重试 ≤3 次 + 恢复后 delivered；
5. **错误契约**（ST-025~028）：统一错误结构六类（CON-002，404 统一 40402 防枚举）；认证失效四分支（过期/篡改签名/篡改 payload/有效对照，40101/40102）；限流 42901 + 窗口重置恢复 + 计数键隔离降级（NFR-006）；
6. **性能基线**（ST-029~031）：P95 ≤ 2000ms（NFR-001 testThreshold），runLoad 100 并发×10 轮=1000 样本，calcP95 升序取 ceil(0.95N)-1 索引，错误率=非 2xx 比例；限流阈值放宽声明不参与 P95 度量；
7. **安全基线**（ST-032~035）：注入向量按字面量检索（无 500/无全量泄漏/错误结构统一）；XSS 三方一致快照（提交→列表→CommentStore）；bcrypt $2a$10$ 前缀 + compare 正反例；JWT_SECRET 环境变量注入行为级证明。

## 差异登记（设计预期 → 实现契约）

| 用例 | 设计预期 | 实现契约（按此断言） |
|---|---|---|
| ST-001 | 携带 JWT 创建 | 角色快照须重登（§5-1） |
| ST-002 | 回复→被回复人 | 通知对象=文章作者（§5-2） |
| ST-021 | 他人面板 403 | token.sub 数据隔离 + reader 40301（§5-3） |
| ST-013/025 | readCount/404 | viewCount；统一 40402 防枚举（§5-4） |
| ST-026 | 重签验证 | 篡改必然签名失败 40101（§5-5） |
| ST-028 | 按 IP 计数 | 计数键（IP+路径）隔离降级（§5-6） |
| ST-039 | 500+回滚 draft | 事件总线隔离 + 失败记录落盘（§5-7） |

## 验收

- [x] 40/40 通过、exitCode=0；性能 3 条 P95 ≤ 2000ms；RTM systemTest 32 行回填；check-artifact-gate --phase=7 exitCode=0
