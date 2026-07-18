# 交互示例：测试执行阶段（集成 / 系统 / 验收）

> 对应 W 模型阶段 6 / 7 / 8（右 V 测试执行）。命令：`/wm test type=<集成|系统|验收> result=<pass|fail>`。
> 本阶段执行前置阶段已设计的测试用例，**必须由真实测试运行器执行后通过 `result` 参数回填**，不得由 LLM 估算。

## 示例对话（阶段 6：集成测试执行）

```
用户: /wm test type=集成

AI: 正在执行【集成测试】阶段，将调用真实测试运行器执行阶段 3 设计的集成测试用例...

AI: 已识别集成测试用例（来自阶段 3 概要设计）：
    - IT-001 接口合法调用（POST /api/users）
    - IT-002 非法参数校验（缺字段 / 类型错误）
    - IT-003 跨模块数据传递（订单 → 库存扣减）
    - IT-004 接口性能（100 QPS 持续 30s）
    - IT-005 接口兼容性（v1 / v2 并存）

AI: 调用真实测试运行器（如 Jest / Pytest / curl + jq）执行中...
    ✅ IT-001 通过（200，返回用户 ID）
    ❌ IT-002 部分失败（4 个用例中 1 个未返回 400：缺 email 字段时返回 500）
    ✅ IT-003 通过
    ✅ IT-004 通过（P95 = 180ms < 500ms）
    ✅ IT-005 通过

AI: 失败用例根因分析：
    - IT-002 失败根因：userService.register 的参数校验未覆盖 email 缺失场景，直接抛数据库异常
    - 关联模块：src/services/userService.ts:42
    - 修复建议：在 register 入口增加 email 必填校验

AI: 因存在失败用例，本次执行 result=fail，将回到编码实现返工。

用户: /wm test type=集成 result=fail

AI: 已回填集成测试结果到 .w-model/rtm.json：
    - executionSummary.integrationTest: { total: 5, passed: 4, failed: 1, pending: 0 }
    - RTM 集成测试列：IT-001~005 状态更新（4 ✅ / 1 ❌）

AI: 已生成《集成测试报告》（套用 templates/test-report.md），含失败用例分析、根因、修复建议。

阶段完成摘要：
  产出清单：集成测试报告、接口兼容性报告
  RTM 状态：集成测试列 4/5 通过（1 失败需返工）
  下一步：回到【编码实现】修复 IT-002 → 重新执行 /wm test type=集成 result=pass 后进入【系统测试】
```

## 示例对话（阶段 7：系统测试执行 + 质量门）

```
用户: /wm test type=系统

AI: 正在执行【系统测试】阶段，将调用真实测试运行器执行阶段 2 设计的系统测试用例...

AI: 已识别系统测试用例（来自阶段 2 系统设计）：
    - ST-001 端到端下单流程
    - ST-002 高并发浏览性能基线（1000 QPS）
    - ST-003 支付安全基线（OWASP Top 10 扫描）
    - ST-004 兼容性（Chrome / Firefox / Safari / Edge）
    - ST-005 可靠性（72h 长时运行）

AI: 调用真实测试运行器（如 k6 / OWASP ZAP / BrowserStack）执行中...
    ✅ ST-001 通过
    ✅ ST-002 通过（P95 = 1.2s < 2s）
    ✅ ST-003 通过（无高危漏洞）
    ✅ ST-004 通过
    ✅ ST-005 通过（无内存泄漏）

用户: /wm test type=系统 result=pass

AI: 已回填系统测试结果到 .w-model/rtm.json：
    - executionSummary.systemTest: { total: 5, passed: 5, failed: 0, pending: 0 }
    - RTM 系统测试列：ST-001~005 全部 ✅

AI: 触发工件质量门检查（系统测试通过后强制执行）：

    npx tsx w-model-dev/scripts/check-artifact-gate.ts

    ════════════════════════════════════════════════════════════
    工件质量门校验（Artifact Gate）
    ════════════════════════════════════════════════════════════
    RTM 覆盖率    : 100%
    校验结果      : ✓ 通过
    ─────────────────────────────────────────────────────────────
    所有放行条件均满足：覆盖率 100% 且四级测试全部通过。
    ─────────────────────────────────────────────────────────────
    GATE_JSON {"type":"artifact","passed":true,"coveragePercent":100,"reasons":[]}

AI: 🔴 CHECKPOINT · 发布放行
    质量门脚本退出码 0（通过）。
    - RTM 覆盖率：100%
    - 四级测试：单元 18/18 ✅、集成 5/5 ✅、系统 5/5 ✅、验收 待执行
    - GATE_JSON 摘要：{"passed":true,"coveragePercent":100}

    请确认是否进入【验收测试】（/wm test type=验收）。

阶段完成摘要：
  产出清单：系统测试报告、性能结果、安全结果
  质量门：当前已通过 RTM 覆盖率与三级测试（单元 / 集成 / 系统）
  下一步：用户确认后执行 /wm test type=验收 result=pass 完成项目交付
```

> 注意：`check-artifact-gate.ts` 校验四级测试全部通过，本示例中验收测试尚未执行，
> 严格意义上质量门应在验收测试通过后才完整放行。这里展示的是系统测试后的中间检查。

## 示例对话（阶段 8：验收测试执行 + 项目交付）

```
用户: /wm test type=验收

AI: 正在执行【验收测试】阶段，将按用户场景验证阶段 1 设计的验收测试用例...

AI: 已识别验收测试用例（来自阶段 1 需求分析）：
    - UAT-001~012 用户注册 / 登录
    - UAT-013~024 商品浏览
    - UAT-025~038 购物车
    - UAT-039~050 订单管理

AI: 调用真实测试运行器（端到端 UI 自动化 / 用户场景脚本）执行中...
    ✅ 50/50 全部通过

用户: /wm test type=验收 result=pass

AI: 已回填验收测试结果到 .w-model/rtm.json：
    - executionSummary.acceptanceTest: { total: 50, passed: 50, failed: 0, pending: 0 }
    - RTM 验收测试列：UAT-001~050 全部 ✅

AI: RTM 终检：所有需求 → 设计 → 代码 → 单元 / 集成 / 系统 / 验收测试均建立映射，覆盖率 100%。

AI: 触发工件质量门最终检查：

    npx tsx w-model-dev/scripts/check-artifact-gate.ts

    GATE_JSON {"type":"artifact","passed":true,"coveragePercent":100,"reasons":[]}

AI: 🔴 CHECKPOINT · 发布放行
    质量门脚本退出码 0（通过）。
    - RTM 覆盖率：100%
    - 四级测试全部通过：单元 18/18、集成 5/5、系统 5/5、验收 50/50
    - 项目级验收检查清单：✅ 需求规格 / 设计文档 / 代码 / 各级测试 / RTM 全部满足

    请确认是否完成项目交付（用户签字）。

阶段完成摘要：
  产出清单：验收测试报告、用户确认结果、归档 RTM
  项目状态：验收测试通过 + 用户确认 → 项目完成
  下一步：归档全部文档与 RTM，可选 /wm export 导出项目快照
```

## 要点

- `/wm test` 必须由真实测试运行器执行后通过 `result=pass|fail` 回填，**禁止 LLM 估算**或自动标记通过。
- `result=fail` 时必须给出根因分析、关联模块、修复建议，回到编码实现返工后重跑。
- 系统测试通过后触发工件质量门（`check-artifact-gate.ts`），验收测试通过后再次终检。
- RTM 在每阶段测试执行后同步更新对应列与 `executionSummary`。
- 🔴 CHECKPOINT · 发布放行：质量门通过 + 用户确认后才能完成项目交付。
