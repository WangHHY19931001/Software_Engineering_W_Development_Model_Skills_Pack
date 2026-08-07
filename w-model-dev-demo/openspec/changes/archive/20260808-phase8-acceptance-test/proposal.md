# Change Proposal: 阶段 8 验收测试（phase8-acceptance-test）

- **Phase**: 8（验收测试）
- **Created**: 2026-08-07
- **Project**: blog-system-demo-r35（W 模型第 35 轮端到端调测）

## 背景与动机

阶段 7 系统测试已产出 9 个系统测试文件（40 条 ST 全过）并验证端到端全链路、性能基线（NFR-001）与安全基线；阶段 1 需求分析已登记 73 条验收测试用例（UAT-001~073，`docs/phase1-requirements/acceptance-test-design.md`），路径映射 `docs/uat-path-mapping.md` 已由阶段 5 回填实际路径（等价 20 行/直接 53 行）。本变更在 demo 环境执行阶段 8 验收测试：将阶段 1 设计的 UAT 用例落地为可执行验收测试，逐条比对原始需求与系统功能，确认用户需求匹配（RTM 需求覆盖率 100%），并对齐阶段 7 遗留处置（ST-028/ST-020 固定 sleep flaky 不传入验收层、P95 单次采样余量、ST-032/ST-033 断言收紧建议等）。

## 目标

1. 落地 `tests/acceptance/` 9 个测试文件 + helpers.ts，73 条 UAT（UAT-001~073）全部可执行；
2. 用户需求匹配验证：功能 22/22（REQ-007~028 每需求 ≥2 条正常+异常/边界）、非功能 6/6（NFR-001~006）、约束 4/4（CON-001~004）；
3. 性能验收：UAT-060/061 常规 API + 组合流量 P95 ≤ 2000ms（NFR-001 testThreshold，实测 <500ms 错误率 0）；
4. 安全验收：UAT-062/063/072 密码 bcrypt 加盐、JWT 密钥注入、认证失效/越权防护断言全过，无高危漏洞；
5. RTM acceptanceTest 列回填（32 行需求覆盖率 100%，executionSummary.acceptanceTest 73/73/0/0）；
6. 全量回归 318/318（175 UT + 30 IT + 40 ST + 73 UAT）通过；通过 check-artifact-gate --phase=8 终检与 V 评审（qualityLevel=A）。

## 方案要点

- 测试基础设施：复用 tests/system/helpers.ts 的 createTestEnv（每用例全新内存 store 容器 + Express app 天然隔离）+ seam-HTTP（supertest 直连 createApp 不启端口）+ seam-STORE（seed/快照断言）+ seam-STATIC（构建期静态断言）+ 本地 mock 回调服务器（UAT-057~059/064/065，per-test try/finally close）；
- 异步事件（通知/Webhook 投递/审计落盘）统一 pollUntil 轮询收敛，验收层无固定 sleep（阶段 7 ST-028/ST-020 flaky 不传入）；
- 契约差异：设计预期与实现契约不一致处按实现契约断言并登记报告 §5（错误码数字契约 40001~60003、字段名 identifier/body/pageSize/viewCount/categoryId、UAT-020 状态码 409+60001、UAT-049 seam-STORE 注入替代真实多 IP、UAT-052 通知类型 REPLY/LIKE/NEW_ARTICLE 等 9 项）；
- 执行模式：self-as-verifier（B 段合并为单次中点检查；C 段项目级放行强制暂停，调测者代签 confirm 标注「代签」，真实用户复核可改签）；
- CON-004 审计日志缺陷修复（auditMiddleware 硬编码 id:'' 互相覆盖）随验收测试驱动完成并验证（登录/发布/删除三类留痕并存）。

## 验收标准

- [x] `npm run test:acceptance` exitCode=0（Test Files 9 passed/9、Tests 73 passed/73）
- [x] 全量回归 `npm run test` exitCode=0（Test Files 72 passed/72、Tests 318 passed/318）
- [x] 性能：UAT-060/061 四接口+组合流量 P95 ≤ 2000ms（实测 <500ms，错误率 0）
- [x] 安全：UAT-062/063/072 全过，无高危漏洞（bcrypt 加盐 / JWT 注入 / 认证失效 / 越权防护）
- [x] RTM acceptanceTest 列 32 行回填，executionSummary.acceptanceTest total=73/passed=73，需求覆盖率 100%
- [x] check-artifact-gate --phase=8 终检 exitCode=0（GATE_JSON passed=true coveragePercent=100）
- [x] V 评审 phase8-acceptance qualityLevel=A（compositeScore=0.9203）passed=true
