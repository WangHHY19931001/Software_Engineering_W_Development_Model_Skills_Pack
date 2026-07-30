# BDD 行为门禁摘要（Round 23）

## 总体
- Feature 总数：4
- Scenario 总数：32
- RTM 覆盖率：100%（22 REQ + 6 NFR + 4 CON = 32 需求）

## 4 个 Feature 清单

| Feature | 层级 | 路径 | Scenarios |
|---|---|---|---|
| authentication | L1 | features/authentication.feature | 5 |
| article-lifecycle | L2 | features/article-lifecycle.feature | 7 |
| article-state-transitions | L3 | features/article-state-transitions.feature | 10 |
| webhook-delivery | L4 | features/webhook-delivery.feature | 10 |
| **合计** | | | **32** |

## 7 维度校验（D1-D7）

| 维度 | 内容 | 状态 |
|---|---|---|
| D1 头标注 | Feature 头标注（层级/REQ/TLA） | ✓ |
| D2 Gherkin 语法 | Given/When/Then 标准语法 | ✓ |
| D3 状态机七要素 | initial/transition/action/invariant/guard/postcondition/exception | ✓ |
| D4 BDD↔TLA+ 等价 | 状态集+转移集+不变式归一化匹配 | ✓ |
| D5 step 绑定 | step definitions 已定义 | ✓ |
| D6 scenario 路径 | 路径有效 | ✓ |
| D7 RTM 映射 | requirementId 字段（修复第19.0.1轮 D7 bug 后） | ✓ |

## bdd-manifest.json 合规性
- 4 features 登记
- 4 stateMachines 登记
- RTM 映射完整
