# 阶段 1 需求提取四维识别与豁免审批 实施计划（续篇：阶段 D-G）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成阶段 D-G：样本与 self-test、单元测试与集成测试、模板与 references、顶层文档与门禁。

**关联前篇:** [2026-07-28-phase1-4dim-identification.md](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/superpowers/plans/2026-07-28-phase1-4dim-identification.md)（阶段 A-C）

**关联设计文档:** [design.md](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/docs/changes/2026-07-28-round20-phase1-4dim-identification/design.md)

---

## 阶段 D：样本与 self-test

### Task D1: 创建 13 个图谱样本

**Files:**
- Create: `w-model-dev/scripts/samples/graph/valid-req-hierarchy.json`
- Create: `w-model-dev/scripts/samples/graph/valid-multi-group.json`
- Create: `w-model-dev/scripts/samples/graph/valid-cross-logic.json`
- Create: `w-model-dev/scripts/samples/graph/valid-small-project-exemption.json`
- Create: `w-model-dev/scripts/samples/graph/valid-cross-cuts-nfr.json`
- Create: `w-model-dev/scripts/samples/graph/bad-req-hierarchy-orphan.json`
- Create: `w-model-dev/scripts/samples/graph/bad-req-hierarchy-multi-parent.json`
- Create: `w-model-dev/scripts/samples/graph/bad-level-not-monotonic.json`
- Create: `w-model-dev/scripts/samples/graph/bad-no-req-group.json`
- Create: `w-model-dev/scripts/samples/graph/bad-missing-level.json`
- Create: `w-model-dev/scripts/samples/graph/bad-depends-on-cycle.json`
- Create: `w-model-dev/scripts/samples/graph/bad-precedes-cycle.json`
- Create: `w-model-dev/scripts/samples/graph/bad-cross-logic.json`

- [ ] **Step 1: 创建 valid-req-hierarchy.json（4 层 REQ 层级树，单 group 根）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户管理域", "summary": "level=1 domain", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=2 module", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "邮箱注册功能", "summary": "level=3 feature", "level": 3, "reqGroup": "REQ-001"},
    {"id": "REQ-004", "type": "REQ", "phase": 1, "title": "邮箱格式校验", "summary": "level=4 acceptance", "level": 4, "reqGroup": "REQ-001"},
    {"id": "REQ-005", "type": "REQ", "phase": 1, "title": "密码强度校验", "summary": "level=4 acceptance", "level": 4, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-002", "type": "parent"},
    {"from": "REQ-004", "to": "REQ-003", "type": "parent"},
    {"from": "REQ-005", "to": "REQ-003", "type": "parent"}
  ]
}
```

- [ ] **Step 2: 创建 valid-multi-group.json（多个 level=1 REQ，多 group 候选）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1 group A", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "订单域", "summary": "level=1 group B", "level": 1},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "用户注册", "summary": "level=2 module A", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-004", "type": "REQ", "phase": 1, "title": "订单创建", "summary": "level=2 module B", "level": 2, "reqGroup": "REQ-002"},
    {"id": "REQ-005", "type": "REQ", "phase": 1, "title": "邮箱校验", "summary": "level=3 feature A", "level": 3, "reqGroup": "REQ-001"},
    {"id": "REQ-006", "type": "REQ", "phase": 1, "title": "金额校验", "summary": "level=3 feature B", "level": 3, "reqGroup": "REQ-002"}
  ],
  "edges": [
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-004", "to": "REQ-002", "type": "parent"},
    {"from": "REQ-005", "to": "REQ-003", "type": "parent"},
    {"from": "REQ-006", "to": "REQ-004", "type": "parent"},
    {"from": "REQ-001", "to": "REQ-002", "type": "collaborates-with"}
  ]
}
```

- [ ] **Step 3: 创建 valid-cross-logic.json（含 4 类交叉边，无环）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "登录模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-004", "type": "REQ", "phase": 1, "title": "邮箱注册", "summary": "level=3", "level": 3, "reqGroup": "REQ-001"},
    {"id": "REQ-005", "type": "REQ", "phase": 1, "title": "邮箱登录", "summary": "level=3", "level": 3, "reqGroup": "REQ-001"},
    {"id": "REQ-006", "type": "REQ", "phase": 1, "title": "密码重置", "summary": "level=3", "level": 3, "reqGroup": "REQ-001"},
    {"id": "NFR-001", "type": "REQ", "phase": 1, "title": "安全横切", "summary": "NFR 横切关注点"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-004", "to": "REQ-002", "type": "parent"},
    {"from": "REQ-005", "to": "REQ-003", "type": "parent"},
    {"from": "REQ-006", "to": "REQ-003", "type": "parent"},
    {"from": "REQ-004", "to": "REQ-005", "type": "depends-on"},
    {"from": "REQ-004", "to": "REQ-005", "type": "precedes"},
    {"from": "REQ-004", "to": "REQ-006", "type": "conflicts-with"},
    {"from": "REQ-006", "to": "REQ-004", "type": "conflicts-with"},
    {"from": "NFR-001", "to": "REQ-004", "type": "cross-cuts"}
  ]
}
```

- [ ] **Step 4: 创建 valid-small-project-exemption.json（REQ 总数<5，已批准豁免）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "功能A", "summary": "level=3 小项目", "level": 3},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "功能B", "summary": "level=3 小项目", "level": 3},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "功能C", "summary": "level=3 小项目", "level": 3},
    {"id": "EXT-IN-001", "type": "EXT-IN", "phase": 1, "title": "用户输入", "summary": "外部输入"},
    {"id": "EXT-OUT-001", "type": "EXT-OUT", "phase": 1, "title": "结果输出", "summary": "外部输出"}
  ],
  "edges": [
    {"from": "REQ-001", "to": "EXT-IN-001", "type": "depends-on"},
    {"from": "EXT-OUT-001", "to": "REQ-003", "type": "depends-on"}
  ]
}
```

- [ ] **Step 5: 创建 valid-cross-cuts-nfr.json（cross-cuts 边源为 NFR 行，提供 --rtm）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "NFR-001", "type": "REQ", "phase": 1, "title": "安全NFR", "summary": "安全横切关注点"},
    {"id": "CON-001", "type": "REQ", "phase": 1, "title": "合规CON", "summary": "合规约束"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "NFR-001", "to": "REQ-002", "type": "cross-cuts"},
    {"from": "CON-001", "to": "REQ-001", "type": "cross-cuts"}
  ]
}
```

- [ ] **Step 6: 创建 bad-req-hierarchy-orphan.json（level=3 REQ 缺 parent 入边）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "孤儿功能", "summary": "level=3 缺 parent", "level": 3, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"}
  ]
}
```

- [ ] **Step 7: 创建 bad-req-hierarchy-multi-parent.json（level=2 REQ 有两条 parent 入边）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域A", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "用户域B", "summary": "level=1", "level": 1},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "多父模块", "summary": "level=2 有两个 parent", "level": 2, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-002", "type": "parent"}
  ]
}
```

- [ ] **Step 8: 创建 bad-level-not-monotonic.json（parent 边 level 不满足 子=父+1）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=3 跳级", "level": 3, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"}
  ]
}
```

- [ ] **Step 9: 创建 bad-no-req-group.json（REQ 总数≥5 但无 level=1 REQ）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "功能A", "summary": "level=2 无根", "level": 2},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "功能B", "summary": "level=2 无根", "level": 2},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "功能C", "summary": "level=3 无根", "level": 3},
    {"id": "REQ-004", "type": "REQ", "phase": 1, "title": "功能D", "summary": "level=3 无根", "level": 3},
    {"id": "REQ-005", "type": "REQ", "phase": 1, "title": "功能E", "summary": "level=3 无根", "level": 3}
  ],
  "edges": [
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-004", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-005", "to": "REQ-002", "type": "parent"}
  ]
}
```

- [ ] **Step 10: 创建 bad-missing-level.json（REQ 节点缺 level 字段）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "缺 level 字段"},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "缺 level 字段"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"}
  ]
}
```

- [ ] **Step 11: 创建 bad-depends-on-cycle.json（depends-on 子图有环）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "模块A", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "模块B", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-002", "to": "REQ-003", "type": "depends-on"},
    {"from": "REQ-003", "to": "REQ-002", "type": "depends-on"}
  ]
}
```

- [ ] **Step 12: 创建 bad-precedes-cycle.json（precedes 子图有环）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "模块A", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "模块B", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-002", "to": "REQ-003", "type": "precedes"},
    {"from": "REQ-003", "to": "REQ-002", "type": "precedes"}
  ]
}
```

- [ ] **Step 13: 创建 bad-cross-logic.json（conflicts-with 非对称 + cross-cuts 目标非 REQ）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "nodes": [
    {"id": "REQ-001", "type": "REQ", "phase": 1, "title": "用户域", "summary": "level=1", "level": 1},
    {"id": "REQ-002", "type": "REQ", "phase": 1, "title": "注册模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "REQ-003", "type": "REQ", "phase": 1, "title": "登录模块", "summary": "level=2", "level": 2, "reqGroup": "REQ-001"},
    {"id": "SD-001", "type": "SD", "phase": 1, "title": "设计节点", "summary": "非 REQ 节点"}
  ],
  "edges": [
    {"from": "REQ-002", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-003", "to": "REQ-001", "type": "parent"},
    {"from": "REQ-002", "to": "REQ-003", "type": "conflicts-with"},
    {"from": "REQ-002", "to": "SD-001", "type": "cross-cuts"}
  ]
}
```

- [ ] **Step 14: Commit**

```bash
git add w-model-dev/scripts/samples/graph/valid-*.json w-model-dev/scripts/samples/graph/bad-req-hierarchy-*.json w-model-dev/scripts/samples/graph/bad-level-not-monotonic.json w-model-dev/scripts/samples/graph/bad-no-req-group.json w-model-dev/scripts/samples/graph/bad-missing-level.json w-model-dev/scripts/samples/graph/bad-depends-on-cycle.json w-model-dev/scripts/samples/graph/bad-precedes-cycle.json w-model-dev/scripts/samples/graph/bad-cross-logic.json
git commit -m "feat(samples): 新增 13 个四维识图谱样本"
```

---

### Task D2: 创建 10 个覆盖分析样本

**Files:**
- Create: `w-model-dev/scripts/samples/coverage/valid-full-coverage.json`
- Create: `w-model-dev/scripts/samples/coverage/valid-out-of-scope-declared.json`
- Create: `w-model-dev/scripts/samples/coverage/valid-minimal-coverage.json`
- Create: `w-model-dev/scripts/samples/coverage/valid-cross-cuts-consistent.json`
- Create: `w-model-dev/scripts/samples/coverage/valid-metrics-recalc.json`
- Create: `w-model-dev/scripts/samples/coverage/bad-empty-stakeholder.json`
- Create: `w-model-dev/scripts/samples/coverage/bad-missing-scenario-type.json`
- Create: `w-model-dev/scripts/samples/coverage/bad-coverage-below-threshold.json`
- Create: `w-model-dev/scripts/samples/coverage/bad-partial-not-resolved.json`
- Create: `w-model-dev/scripts/samples/coverage/bad-cross-cuts-mismatch.json`

- [ ] **Step 1: 创建 valid-full-coverage.json（4 张矩阵完整，覆盖率 100%）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "终端用户", "relatedReqs": ["REQ-001"], "status": "covered"},
    {"id": "SH-002", "role": "管理员", "relatedReqs": ["REQ-002"], "status": "covered"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "用户注册成功", "steps": ["输入邮箱", "提交"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "邮箱格式错误", "steps": ["输入错误邮箱", "提交"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "邮箱长度边界", "steps": ["输入 254 字符邮箱"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001", "REQ-002"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [
    {"nfrConId": "NFR-001", "governedReqs": ["REQ-001"], "status": "covered"}
  ],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 2: 创建 valid-out-of-scope-declared.json（status=missing 在 outOfScope.json 声明）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "终端用户", "relatedReqs": ["REQ-001"], "status": "covered"},
    {"id": "SH-002", "role": "审计员", "relatedReqs": [], "status": "missing", "gapDescription": "本项目无审计需求"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "正常流程", "steps": ["步骤"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "错误流程", "steps": ["步骤"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "边界流程", "steps": ["步骤"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": [], "status": "missing", "gapDescription": "本项目无 NFR"},
    {"type": "CON", "reqIds": [], "status": "missing", "gapDescription": "本项目无 CON"}
  ],
  "crossCuts": [],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

> 注：此样本需配合 `outOfScope: ["SH-002", "NFR", "CON"]` 使用，self-test 中通过 options 传入。

- [ ] **Step 3: 创建 valid-minimal-coverage.json（最小合法：1 stakeholder + 3 场景 + 3 类型）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [
    {"nfrConId": "NFR-001", "governedReqs": ["REQ-001"], "status": "covered"}
  ],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 4: 创建 valid-cross-cuts-consistent.json（§7.4 与 graph.json cross-cuts 一致）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [
    {"nfrConId": "NFR-001", "governedReqs": ["REQ-001"], "status": "covered"}
  ],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

> 注：此样本需配合 `graphCrossCuts: [{from: "NFR-001", to: "REQ-001"}]` 使用。

- [ ] **Step 5: 创建 valid-metrics-recalc.json（metrics 重算与字段一致）**

> 同 valid-full-coverage.json 内容（metrics 与重算一致）。

- [ ] **Step 6: 创建 bad-empty-stakeholder.json（stakeholders 数组空）**

```json
{
  "stakeholders": [],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [],
  "metrics": {
    "stakeholder": 0,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 7: 创建 bad-missing-scenario-type.json（缺 boundary 场景类型）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 8: 创建 bad-coverage-below-threshold.json（stakeholder 覆盖率 50% < 100%）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"},
    {"id": "SH-002", "role": "管理员", "relatedReqs": [], "status": "missing", "gapDescription": "未关联"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [],
  "metrics": {
    "stakeholder": 50,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 9: 创建 bad-partial-not-resolved.json（存在 partial 项未补齐）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"},
    {"id": "SH-002", "role": "管理员", "relatedReqs": ["REQ-002"], "status": "partial", "gapDescription": "部分覆盖"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [],
  "metrics": {
    "stakeholder": 75,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

- [ ] **Step 10: 创建 bad-cross-cuts-mismatch.json（§7.4 与 graph.json cross-cuts 不一致）**

```json
{
  "stakeholders": [
    {"id": "SH-001", "role": "用户", "relatedReqs": ["REQ-001"], "status": "covered"}
  ],
  "scenarios": [
    {"id": "SC-001", "description": "happy", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "happy"},
    {"id": "SC-002", "description": "error", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "error"},
    {"id": "SC-003", "description": "boundary", "steps": ["s1"], "relatedReqs": ["REQ-001"], "status": "covered", "scenarioType": "boundary"}
  ],
  "requirementTypes": [
    {"type": "REQ", "reqIds": ["REQ-001"], "status": "covered"},
    {"type": "NFR", "reqIds": ["NFR-001"], "status": "covered"},
    {"type": "CON", "reqIds": ["CON-001"], "status": "covered"}
  ],
  "crossCuts": [
    {"nfrConId": "NFR-001", "governedReqs": ["REQ-001", "REQ-002"], "status": "covered"}
  ],
  "metrics": {
    "stakeholder": 100,
    "scenario": 100,
    "requirementType": 100,
    "crossCut": 100
  }
}
```

> 注：此样本需配合 `graphCrossCuts: [{from: "NFR-001", to: "REQ-001"}]` 使用（缺 REQ-002）。

- [ ] **Step 11: Commit**

```bash
git add w-model-dev/scripts/samples/coverage/
git commit -m "feat(samples): 新增 10 个覆盖分析样本"
```

---

### Task D3: 创建 7 个豁免审批样本

**Files:**
- Create: `w-model-dev/scripts/samples/exemption/valid-full-approval.json`
- Create: `w-model-dev/scripts/samples/exemption/valid-coverage-exemption.json`
- Create: `w-model-dev/scripts/samples/exemption/bad-s-self-approve.json`
- Create: `w-model-dev/scripts/samples/exemption/bad-r-template-review.json`
- Create: `w-model-dev/scripts/samples/exemption/bad-v-not-verified.json`
- Create: `w-model-dev/scripts/samples/exemption/bad-no-human.json`
- Create: `w-model-dev/scripts/samples/exemption/bad-r-reject.json`

- [ ] **Step 1: 创建 valid-full-approval.json（S→R→V→人类四阶段完整）**

```json
{
  "id": "EXEMPT-001",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，REQ 总数<5 无需拆分 group",
  "evidence": ["graph.json:REQ总数=4", "cross-analysis-report:单 group 声明"],
  "proposedAlternative": "声明单 group，阶段2直接派生1个SD",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "approve",
    "rootCauseAnalysis": "项目为 MVP 试点，业务范围天然聚焦单一领域，无多 group 必要。5-Why 分析显示根因为业务边界清晰而非需求遗漏。",
    "falsifiabilityCheck": "若 REQ 总数增长至≥5 须重新评估",
    "riskAssessment": "低风险：单一 group 不影响阶段2 SD 派生",
    "conditions": ["后续若新增 REQ 须重新评估"],
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": true,
    "reworkHints": [],
    "verifiedAt": "2026-07-28T12:00:00Z"
  },
  "humanDecision": {
    "decision": "approve",
    "decidedAt": "2026-07-28T13:00:00Z",
    "decidedBy": "user"
  }
}
```

- [ ] **Step 2: 创建 valid-coverage-exemption.json（覆盖缺失声明豁免，人类已批准）**

```json
{
  "id": "EXEMPT-002",
  "type": "coverage-missing-declared",
  "target": "NFR",
  "ruleId": "C8",
  "justification": "本项目无性能/可用性 NFR 需求，声明不适用",
  "evidence": ["requirement-spec.md:§7.3 NFR 行空", "用户确认无 NFR 需求"],
  "proposedAlternative": "在 §8 Out of Scope 显式声明 NFR 不适用",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "approve",
    "rootCauseAnalysis": "项目为内部工具，无外部用户性能要求。5-Why 分析确认是业务特性而非需求遗漏。",
    "falsifiabilityCheck": "若未来开放外部用户须重新评估 NFR",
    "riskAssessment": "低风险：内部工具性能要求宽松",
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": true,
    "verifiedAt": "2026-07-28T12:00:00Z"
  },
  "humanDecision": {
    "decision": "approve",
    "decidedAt": "2026-07-28T13:00:00Z",
    "decidedBy": "user"
  }
}
```

- [ ] **Step 3: 创建 bad-s-self-approve.json（S 自行决定，无 R/V/人类阶段）**

```json
{
  "id": "EXEMPT-003",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，无需拆分 group",
  "evidence": ["graph.json:REQ总数=4"],
  "proposedAlternative": "声明单 group",
  "submittedAt": "2026-07-28T10:00:00Z"
}
```

- [ ] **Step 4: 创建 bad-r-template-review.json（R 审查模板化，rootCauseAnalysis < 30 字符）**

```json
{
  "id": "EXEMPT-004",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，REQ 总数<5 无需拆分 group",
  "evidence": ["graph.json:REQ总数=4"],
  "proposedAlternative": "声明单 group，阶段2直接派生1个SD",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "approve",
    "rootCauseAnalysis": "项目小，无多 group",
    "falsifiabilityCheck": "若增长须重新评估",
    "riskAssessment": "低风险",
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": true,
    "verifiedAt": "2026-07-28T12:00:00Z"
  },
  "humanDecision": {
    "decision": "approve",
    "decidedAt": "2026-07-28T13:00:00Z",
    "decidedBy": "user"
  }
}
```

- [ ] **Step 5: 创建 bad-v-not-verified.json（V 校验未通过即生效）**

```json
{
  "id": "EXEMPT-005",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，REQ 总数<5 无需拆分 group",
  "evidence": ["graph.json:REQ总数=4"],
  "proposedAlternative": "声明单 group，阶段2直接派生1个SD",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "approve",
    "rootCauseAnalysis": "项目为 MVP 试点，业务范围天然聚焦单一领域，无多 group 必要。5-Why 分析显示根因为业务边界清晰而非需求遗漏。",
    "falsifiabilityCheck": "若 REQ 总数增长至≥5 须重新评估",
    "riskAssessment": "低风险：单一 group 不影响阶段2 SD 派生",
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": false,
    "reworkHints": ["rootCauseAnalysis 证据链不完整"],
    "verifiedAt": "2026-07-28T12:00:00Z"
  },
  "humanDecision": {
    "decision": "approve",
    "decidedAt": "2026-07-28T13:00:00Z",
    "decidedBy": "user"
  }
}
```

- [ ] **Step 6: 创建 bad-no-human.json（人类未确认即生效）**

```json
{
  "id": "EXEMPT-006",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，REQ 总数<5 无需拆分 group",
  "evidence": ["graph.json:REQ总数=4"],
  "proposedAlternative": "声明单 group，阶段2直接派生1个SD",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "approve",
    "rootCauseAnalysis": "项目为 MVP 试点，业务范围天然聚焦单一领域，无多 group 必要。5-Why 分析显示根因为业务边界清晰而非需求遗漏。",
    "falsifiabilityCheck": "若 REQ 总数增长至≥5 须重新评估",
    "riskAssessment": "低风险：单一 group 不影响阶段2 SD 派生",
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": true,
    "verifiedAt": "2026-07-28T12:00:00Z"
  }
}
```

- [ ] **Step 7: 创建 bad-r-reject.json（R reviewDecision=reject 但已应用）**

```json
{
  "id": "EXEMPT-007",
  "type": "small-project-hierarchy",
  "target": "REQ-group",
  "ruleId": "R4",
  "justification": "项目规模小，REQ 总数<5 无需拆分 group",
  "evidence": ["graph.json:REQ总数=4"],
  "proposedAlternative": "声明单 group，阶段2直接派生1个SD",
  "submittedAt": "2026-07-28T10:00:00Z",
  "review": {
    "reviewDecision": "reject",
    "rootCauseAnalysis": "审查发现该项目实际有多个业务域，S 提出的豁免理由不成立。5-Why 分析显示是需求识别不充分。",
    "falsifiabilityCheck": "须补充多业务域 REQ 识别",
    "riskAssessment": "高风险：掩盖需求遗漏",
    "reviewedAt": "2026-07-28T11:00:00Z"
  },
  "verification": {
    "verified": true,
    "verifiedAt": "2026-07-28T12:00:00Z"
  },
  "humanDecision": {
    "decision": "approve",
    "decidedAt": "2026-07-28T13:00:00Z",
    "decidedBy": "user"
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/samples/exemption/
git commit -m "feat(samples): 新增 7 个豁免审批样本"
```

---

### Task D4: 扩展 self-test.ts（新增 GRAPH/COVERAGE/EXEMPTION/SCHEMA 用例）

**Files:**
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 在 self-test.ts 中新增 GRAPH_CASES（13 个图谱样本）**

在现有 GRAPH_CASES 数组末尾追加 13 个新用例（valid-req-hierarchy / valid-multi-group / valid-cross-logic / valid-small-project-exemption / valid-cross-cuts-nfr / bad-req-hierarchy-orphan / bad-req-hierarchy-multi-parent / bad-level-not-monotonic / bad-no-req-group / bad-missing-level / bad-depends-on-cycle / bad-precedes-cycle / bad-cross-logic），每个用例声明 expectedPassed + expectedReasonPatterns（仅 bad 样本）+ phaseOption=1。

- [ ] **Step 2: 新增 COVERAGE_CASES（10 个覆盖样本）**

在 self-test.ts 中新增 COVERAGE_CASES 数组，import checkRequirementCoverage，对 10 个覆盖样本声明期望。valid-out-of-scope-declared 与 valid-cross-cuts-consistent 须通过 options 传入 outOfScope / graphCrossCuts。

- [ ] **Step 3: 新增 EXEMPTION_CASES（7 个豁免样本）**

在 self-test.ts 中新增 EXEMPTION_CASES 数组，import checkExemption，对 7 个豁免样本声明期望。

- [ ] **Step 4: 新增 SCHEMA_CASES（1 个 coverage.schema.json）**

在现有 SCHEMA_CASES 中新增 1 条 coverage.schema.json 的 valid/bad 样本对。

- [ ] **Step 5: 更新 SAMPLES 总数注释与基线**

将 self-test.ts 头部注释的「121 条样本」更新为「152 条样本」，CONTRIBUTING.md / README.md / docs/INSTALL.md 的基线同步更新（阶段 G 处理）。

- [ ] **Step 6: 运行 self-test 验证 152/152 通过**

Run: `npm run self-test`
Expected: 152/152 通过，退出码 0

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/scripts/self-test.ts
git commit -m "feat(self-test): 扩展 self-test 基线 121→152（+13 graph +10 coverage +7 exemption +1 schema）"
```

---

## 阶段 E：单元测试与集成测试

### Task E1: 新增 graph-logic.test.ts（R1-R6 单元测试）

**Files:**
- Create: `w-model-dev/scripts/__tests__/graph-logic.test.ts`

- [ ] **Step 1: 创建 graph-logic.test.ts**

测试组覆盖 R1-R6：
- R1-R4: 缺 level / orphan / multiParent / level 不单调 / 无 level=1 REQ
- R5: depends-on 环 / precedes 环
- R6: conflicts-with 非对称 / cross-cuts 目标非 REQ / precedes 源/目标非 REQ
- 扩展字段: reqHierarchy / crossLogic 填充正确性

每个测试用例构造最小 GraphShape，调用 checkRequirementGraph(graph, 1)，断言 result.passed / result.violations / result.reqHierarchy / result.crossLogic。

- [ ] **Step 2: 运行 vitest 验证通过**

Run: `npx vitest run __tests__/graph-logic.test.ts`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/graph-logic.test.ts
git commit -m "test(graph-logic): 新增 R1-R6 四维识别单元测试"
```

---

### Task E2: 新增 coverage-logic.test.ts（C1-C10 单元测试）

**Files:**
- Create: `w-model-dev/scripts/__tests__/coverage-logic.test.ts`

- [ ] **Step 1: 创建 coverage-logic.test.ts**

测试组覆盖 C1/C3/C4/C5/C7/C8/C9/C10：
- C1: stakeholders 空 → fail
- C3: scenarios 空 → fail
- C4: 缺 happy/error/boundary → fail
- C5: 缺 REQ/NFR/CON → fail
- C7: crossCuts 与 graphCrossCuts 不一致 → fail
- C8: metrics < 100 / 存在 partial → fail
- C9: status=missing 未声明 → warning（提供 outOfScope 时 fail）
- C10: metrics 重算不一致 → fail
- 豁免: exemptions 跳过对应规则

- [ ] **Step 2: 运行 vitest 验证通过**

Run: `npx vitest run __tests__/coverage-logic.test.ts`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/coverage-logic.test.ts
git commit -m "test(coverage-logic): 新增 C1-C10 覆盖分析单元测试"
```

---

### Task E3: 新增 exemption-logic.test.ts（E1-E8 单元测试）

**Files:**
- Create: `w-model-dev/scripts/__tests__/exemption-logic.test.ts`

- [ ] **Step 1: 创建 exemption-logic.test.ts**

测试组覆盖 E1-E8：
- E1: schema 不完整 → fail
- E2: justification < 20 字符 → fail
- E3: evidence 空 → fail
- E4: review 缺失 → fail
- E5: reviewDecision ≠ approve → fail
- E6: rootCauseAnalysis < 30 字符 → fail
- E7: verification.verified = false → fail
- E8: humanDecision.decision ≠ approve / 缺失 → fail
- 完整流程: 四阶段全通过 → passed=true, stage=complete

- [ ] **Step 2: 运行 vitest 验证通过**

Run: `npx vitest run __tests__/exemption-logic.test.ts`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/exemption-logic.test.ts
git commit -m "test(exemption-logic): 新增 E1-E8 豁免审批单元测试"
```

---

### Task E4: 扩展 gate-enhancement.test.ts（集成场景）

**Files:**
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **Step 1: 新增 5 个集成测试用例**

1. 图谱 R1-R6 全通过 + 覆盖 C1-C10 全通过 + 无豁免 → 阶段 1 放行
2. 图谱 R2 orphan 失败 → 阶段 1 返工
3. 覆盖 C8 < 100% → 阶段 1 返工
4. 豁免 E8 人类未确认 → 阶段 1 返工
5. 图谱 R4 失败 + 已批准豁免 R4 → 跳过 R4 → 阶段 1 放行

- [ ] **Step 2: 运行 vitest 验证通过**

Run: `npx vitest run __tests__/gate-enhancement.test.ts`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "test(gate-enhancement): 新增四维识别+覆盖+豁免集成场景"
```

---

## 阶段 F：模板与 references

### Task F1: 扩展 requirement-spec.md 模板（5 节 → 13 节）

**Files:**
- Modify: `w-model-dev/templates/requirement-spec.md`

- [ ] **Step 1: 按 design.md §4.1-§4.6 扩展模板**

将现有 5 节扩展为 13 节，新增 §4 层级树 / §5 REQ-group / §6 交叉逻辑矩阵 / §7 覆盖分析。§8 Out of Scope 增强（覆盖缺失声明）。

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/templates/requirement-spec.md
git commit -m "docs(template): requirement-spec.md 5 节→13 节（新增 §4-§7 四维识别）"
```

---

### Task F2: 增强 phase-1-requirements.md

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 1: 算法步骤 2/3 增强 + 新增步骤 5/6 + FM 矩阵 + 禁止行为 #7-#11**

按 design.md §5.1 / §6.1-§6.6 增强。

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-1-requirements.md
git commit -m "docs(reference): phase-1-requirements.md 增强四维识别算法步骤与 FM 矩阵"
```

---

### Task F3: 增强 ingestion-chunk.md 与 ingestion-cross.md

**Files:**
- Modify: `w-model-dev/references/ingestion-chunk.md`
- Modify: `w-model-dev/references/ingestion-cross.md`

- [ ] **Step 1: ingestion-chunk.md 节点/边提取规则增强（按 design.md §5.2）**
- [ ] **Step 2: ingestion-cross.md 合并算法新增步骤 6-8（按 design.md §5.3）**
- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/ingestion-chunk.md w-model-dev/references/ingestion-cross.md
git commit -m "docs(reference): ingestion-chunk/cross 增强四维识别提取与合并规则"
```

---

### Task F4: 增强 verifier-spec.md + anti-patterns.md + subagent-delegation.md

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`
- Modify: `w-model-dev/references/anti-patterns.md`
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: verifier-spec.md §7.1 completeness 增强（按 design.md §4.7）**
- [ ] **Step 2: anti-patterns.md 新增反模式 #30（豁免审批跳步，按 design.md §7.6）**
- [ ] **Step 3: subagent-delegation.md S/R/V 角色边界扩展豁免审批职责（按 design.md §7.2）**
- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/verifier-spec.md w-model-dev/references/anti-patterns.md w-model-dev/references/subagent-delegation.md
git commit -m "docs(reference): verifier-spec/anti-patterns/subagent-delegation 增强四维识别与豁免审批"
```

---

## 阶段 G：顶层文档与门禁

### Task G1: SSoT 新增 §3.4.16

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: 按 design.md §10.1 新增 §3.4.16 + §10A 追溯表**
- [ ] **Step 2: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): 新增 §3.4.16 第 20 轮四维识别与豁免审批"
```

---

### Task G2: SKILL.md + skill-metadata.json 版本号 20.0.0

**Files:**
- Modify: `w-model-dev/SKILL.md`
- Modify: `w-model-dev/skill-metadata.json`

- [ ] **Step 1: SKILL.md frontmatter version 19.0.1→20.0.0 + 约束 #15/#16**
- [ ] **Step 2: skill-metadata.json version 19.0.1→20.0.0**
- [ ] **Step 3: Commit**

```bash
git add w-model-dev/SKILL.md w-model-dev/skill-metadata.json
git commit -m "chore(skill): 版本号 19.0.1→20.0.0 + 约束 #15/#16"
```

---

### Task G3: 顶层文档同步（README / AGENTS / CONTRIBUTING / CHANGELOG / INSTALL / package.json）

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/INSTALL.md`
- Modify: `package.json`

- [ ] **Step 1: README.md 反模式总数 29→30 + self-test 基线 121→152**
- [ ] **Step 2: AGENTS.md §4 第 20 轮记录 + §8 脚本导航表**
- [ ] **Step 3: CONTRIBUTING.md self-test 基线 121→152**
- [ ] **Step 4: CHANGELOG.md 新增 [20.0.0] 节**
- [ ] **Step 5: docs/INSTALL.md self-test 基线 121→152**
- [ ] **Step 6: package.json version 19.0.1→20.0.0**
- [ ] **Step 7: Commit**

```bash
git add README.md AGENTS.md CONTRIBUTING.md CHANGELOG.md docs/INSTALL.md package.json
git commit -m "docs: 同步顶层文档至 20.0.0（self-test 152 + 反模式 30）"
```

---

### Task G4: .githooks/pre-push 扩展（新增 check:coverage / check:exemption）

**Files:**
- Modify: `.githooks/pre-push`
- Modify: `package.json`（新增 check:coverage / check:exemption 脚本）

- [ ] **Step 1: package.json 新增 scripts.check:coverage 与 scripts.check:exemption**
- [ ] **Step 2: .githooks/pre-push 新增第 8/9 项门禁**
- [ ] **Step 3: Commit**

```bash
git add .githooks/pre-push package.json
git commit -m "chore(hooks): pre-push 门禁扩展至 9 项（新增 check:coverage/check:exemption）"
```

---

## 回归验证

### Task V1: 全量回归验证

- [ ] **Step 1: tsc strict 编译检查**

Run: `npx tsc --noEmit --strict`
Expected: 0 errors

- [ ] **Step 2: self-test 152/152**

Run: `npm run self-test`
Expected: 152/152 通过，退出码 0

- [ ] **Step 3: vitest 全通过**

Run: `npx vitest run`
Expected: 全部通过（~146）

- [ ] **Step 4: prepush 9 项门禁**

Run: `npm run prepush`
Expected: 9 项全通过

- [ ] **Step 5: 最终 Commit（如有修复）**

```bash
git add -A
git commit -m "test: 回归验证通过（tsc 0 + self-test 152 + vitest + prepush 9）"
```

---

## 自审清单

- [x] **Spec coverage**：设计文档 11 节内容均映射到阶段 A-G 任务
- [x] **Placeholder scan**：阶段 D-G 样本提供完整 JSON 内容
- [x] **Type consistency**：CoverageShape/ExemptionShape 类型与 logic 层一致
- [x] **路径准确**：所有文件路径基于实际代码探索确认

---

## 执行交接

计划阶段 D-G 已完成。结合前篇阶段 A-C，完整计划覆盖 37 新增 + 23 修改文件。

**两种执行选项：**

**1. Subagent-Driven（推荐）** — 每个 Task 分派独立子代理，任务间审查，快速迭代

**2. Inline Execution** — 在当前会话中批量执行，带检查点审查

**选择哪种方式？**
