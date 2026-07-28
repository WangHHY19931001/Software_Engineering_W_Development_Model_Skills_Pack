# TLA+ 规格清单 — 第二十轮 W 模型 8 阶段调测

> 本文件汇总 W 模型 8 阶段调测中产出的 TLA+ 分层规格清单（L1/L2/L3/L4）。
> 共 8 个 specs，四层分层建模，全部通过 SANY 语法检查 + TLC 模型检验（L2/L3/L4）/skip-tlc（L1）。

## TLA+ 规格清单

### L1 系统级（1 spec）

| spec ID | level | phase | system | requirementIds | designRef | parent | children | variableCombination | SANY | TLC |
|---|---|---|---|---|---|---|---|---|---|---|
| L1_system | L1 | 1 | blog-system | REQ-001~008, SD-000 | docs/requirements.md | — | L2_user_management, L2_content_management, L2_comment_management | 243 | ✓ | skip |

**不变式**：BusinessInvariant（认证后才能发布/评论，注销后状态清零）

### L2 子系统级（3 specs）

| spec ID | level | phase | system | requirementIds | designRef | parent | children | variableCombination | SANY | TLC |
|---|---|---|---|---|---|---|---|---|---|---|
| L2_user_management | L2 | 2 | blog-system::user-management | REQ-001, REQ-002, REQ-003, SD-001 | docs/system-design.md | L1_system | L3_auth_interface | 300 | ✓ | ✓ |
| L2_content_management | L2 | 2 | blog-system::content-management | REQ-004~007, SD-002 | docs/system-design.md | L1_system | L3_content_interface | 300 | ✓ | ✓ |
| L2_comment_management | L2 | 2 | blog-system::comment-management | REQ-008, SD-003 | docs/system-design.md | L1_system | — | 100 | ✓ | ✓ |

**不变式**：
- L2_user_management：LoggedIn => userCount >= 1
- L2_content_management：HasArticles => articleCount >= 1；Editing => articleCount >= 1
- L2_comment_management：HasComments => commentCount >= 1

### L3 接口级（2 specs）

| spec ID | level | phase | system | requirementIds | designRef | parent | children | variableCombination | SANY | TLC |
|---|---|---|---|---|---|---|---|---|---|---|
| L3_auth_interface | L3 | 3 | blog-system::auth-interface | REQ-001, REQ-002, SD-001, INTF-001 | docs/outline-design.md | L2_user_management | L4_user_detail | 200 | ✓ | ✓ |
| L3_content_interface | L3 | 3 | blog-system::content-interface | REQ-004, REQ-008, SD-002, SD-003, INTF-002, INTF-003 | docs/outline-design.md | L2_content_management | L4_content_detail | 200 | ✓ | ✓ |

**不变式**：
- L3_auth_interface：Responded => requestCount >= 1
- L3_content_interface：Responded => requestCount >= 1

### L4 详细级（2 specs）

| spec ID | level | phase | system | requirementIds | designRef | parent | children | variableCombination | SANY | TLC |
|---|---|---|---|---|---|---|---|---|---|---|
| L4_user_detail | L4 | 4 | blog-system::user-detail | REQ-001, REQ-002, SD-001, INTF-001, DD-001, DD-004 | docs/detailed-design.md | L3_auth_interface | — | 160 | ✓ | ✓ |
| L4_content_detail | L4 | 4 | blog-system::content-detail | REQ-004, REQ-008, SD-002, SD-003, INTF-002, INTF-003, DD-002, DD-003, DD-005 | docs/detailed-design.md | L3_content_interface | — | 160 | ✓ | ✓ |

**不变式**：
- L4_user_detail：Done => opCount >= 1
- L4_content_detail：Done => opCount >= 1

## TLA+ 规格统计

| 维度 | 数值 |
|---|---|
| 规格总数 | 8 |
| L1 specs | 1 |
| L2 specs | 3 |
| L3 specs | 2 |
| L4 specs | 2 |
| SANY 语法检查通过 | 8/8 |
| TLC 模型检验通过 | 7/7（L1 skip-tlc） |
| 死锁 | 0 |
| 不变式违反 | 0 |
| 状态爆炸 | 0 |
| 最大 variableCombination | 300（L2_user_management / L2_content_management） |
| 分层结构 | L1 → L2(3) → L3(2) → L4(2) |

## 代码-TLA+ 一致性（阶段 5）

四维度全通过：
1. **SD-codeModule 映射**：SD-000~SD-003 → src/ 模块映射完整
2. **状态转移提取**：代码中的状态变化与 TLA+ Next 分支对应
3. **Next 分支覆盖**：所有 TLA+ Next 分支在代码中有对应实现
4. **不变式断言覆盖**：TLA+ Invariant 在代码中有对应 assert/check
