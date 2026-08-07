/**
 * 验收测试通用工具（阶段 8，seam-HTTP + seam-STORE + seam-STATIC）。
 * - 复用阶段 7 系统测试工具：createTestEnv / seed* / register / login / bearer / pollUntil / startMockServer / calcP95 / runLoad。
 * - seam-STATIC（构建期断言类 UAT-066/067/070）：静态文件/结构断言辅助。
 * - 限制说明（与系统测试一致）：supertest 直连 app 工厂（不启端口），req.ip 恒为 127.0.0.1（无法模拟多客户端 IP），
 *   UAT-049「不同 IP 累加」以 seam-STORE 注入不同 clientIp 阅读记录 + 真实请求组合验证（见测试报告 §5 环境声明）。
 */
export * from '../system/helpers';
