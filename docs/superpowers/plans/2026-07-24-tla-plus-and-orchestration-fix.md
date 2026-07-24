# TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归 实现计划

> **REQUIRED SUB-SKILL:** superpowers:subagent-driven-development

**Goal:** 修复三个问题——TLA+指南缺陷、编排者越权、TLA+未回归编码（完整版）。

**Spec:** `docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md`

**Repo:** `d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack`

---

## 层1：TLA+ 指南与模板修复

### Task 1: tla-plus-guide.md 新增 §2.0 命名规范 + §2.1 路径基准 + §2.2 前置清单
- Modify: `w-model-dev/references/tla-plus-guide.md`
- 在"公理与门禁维度表"后插入三节：
  - §2.0 命名规范：MODULE名 `[A-Za-z][A-Za-z0-9_]*` 禁止连字符；`L<level>_<system>` 格式；反例 `L1-blog-system`
  - §2.1 路径解析基准：jarPath相对cwd、tlaPath/cfgPath相对manifest目录、@parent/@sibling/@child相对.tla目录
  - §2.2 前置清单：S产出前3项检查、G校验前3项检查（含删除states/）
- 在manifest schema节补checkRounds语义（记录轮次、单调递减、与run-log R3交叉校验）
- 修正现有连字符MODULE名示例（L1-blog-system→L1_blog_system）
- 验证：`npx tsx w-model-dev/scripts/check-tla-model.ts w-model-dev-demo/.w-model/tla-manifest.json --phase=1` 退出码0

### Task 2: tla-spec-template.md 修正.cfg + 补聚合示例 + 反例
- Modify: `w-model-dev/templates/tla-spec-template.md`
- 修正L65-83非法`INVARIANT`多行多名→`INVARIANTS`关键字+列表
- 补BusinessInvariant聚合示例：`BusinessInvariant == /\ TypeInvariant /\ SessionUserRegistered`
- 末尾追加反例节：cfg混入MODULE、INVARIANTS漏列、BusinessInvariant缺TypeInvariant、MODULE名含连字符、INVARIANT单数后跟多名
- 修正MODULE名示例去连字符

### Task 3: data-models.md 补 tla-manifest schema
- Modify: `w-model-dev/references/data-models.md`
- 末尾追加`### tla-manifest.json`节，含完整字段表
- checkRounds字段指向tla-plus-guide.md语义说明

### Task 4: 全局统一MODULE名示例（去连字符）
- Grep搜索`w-model-dev/`和`docs/`下`L[0-9]-[a-z]`模式
- 逐文件Edit替换为下划线
- 验证：Grep无残留（排除w-model-dev路径本身）

---

## 层2：编排纪律强化

### Task 5: subagent-delegation.md 强化信号 + S拆分模板
- Modify: `w-model-dev/references/subagent-delegation.md`
- L282强制约束"写产物"项追加`.tla/.cfg/tla-manifest.json`实体
- L297检测信号追加信号5：编排者Write/Edit写TLA+产物实体
- 现有S模板后追加S-doc/S-tla拆分机制说明+分派模板
  - S-doc：文档+测试设计+RTM
  - S-tla：.tla+.cfg+manifest，依赖S-doc
  - 时序：S-doc→S-tla→V→G

### Task 6: SKILL.md 角色表/自检清单/阶段5门禁
- Modify: `w-model-dev/SKILL.md`
- L62角色表"关键禁止"补`.tla/.cfg/tla-manifest.json`实体
- L118阶段1-4分派补"可拆S-doc/S-tla"指引
- L239自检清单补"无.tla/.cfg/tla-manifest.json实体改动"
- 阶段5门禁节补"额外分派G跑check-code-tla-consistency.ts"

---

## 层3：TLA+ 回归编码（完整版）

### Task 7: code-tla-logic.ts 接口定义 + 维度1（TDD）
- Create: `w-model-dev/scripts/code-tla-logic.ts`
- Create: `w-model-dev/scripts/__tests__/code-tla-logic.test.ts`
- 先写维度1失败测试：SD节点有/无codeModule映射
- 实现接口：CodeTlaConsistencyInput/CodeFile/ConsistencyResult/DimensionResult
- 实现checkSdToCodeModule：读graph SD节点，核验RTM codeModule覆盖
- 实现checkCodeTlaConsistency总入口（维度2/3/4占位）
- 测试通过后commit

### Task 8: code-tla-logic.ts 维度2 代码状态转移抽取（TDD）
- Modify: `w-model-dev/scripts/code-tla-logic.ts` + 测试
- 先写失败测试：从代码抽取赋值和条件分支
- 实现extractCodeStateTransfers：用ts.createSourceFile解析，抽取BinaryExpression(=)/IfStatement/SwitchStatement
- 实现checkCodeStateTransfer：无赋值则失败
- 测试通过后commit

### Task 9: code-tla-logic.ts 维度3 Next分支对应（TDD）
- Modify: `w-model-dev/scripts/code-tla-logic.ts` + 测试
- 先写失败测试：TLA+ Next动作在代码中有/无对应方法
- 实现checkNextBranchCoverage：正则抽取Next分支动作名，驼峰匹配代码方法名
- 实现toCamelCase辅助函数
- 测试通过后commit

### Task 10: code-tla-logic.ts 维度4 断言覆盖不变式（TDD）
- Modify: `w-model-dev/scripts/code-tla-logic.ts` + 测试
- 先写失败测试：TLA+不变式有/无代码断言覆盖
- 实现checkInvariantCoverage：抽取BusinessInvariant子不变式，匹配代码assert/invariant
- 宽松策略：有断言即认为覆盖
- 测试通过后commit

### Task 11: check-code-tla-consistency.ts CLI入口
- Create: `w-model-dev/scripts/check-code-tla-consistency.ts`
- 参数：--manifest/--graph/--rtm/--src
- 读取JSON+用ts.createSourceFile加载src/*.ts
- 调用checkCodeTlaConsistency
- 输出CODE_TLA_JSON，退出码0/1
- 验证：在demo项目跑，退出码0或1
- commit

### Task 12: gate-logic.ts 终检新增TLA+校验
- Modify: `w-model-dev/scripts/gate-logic.ts`
- checkArtifactGate入参追加graph?/manifestExists?
- 新增TLA+资产存在性校验（manifestExists）
- 新增SD→codeModule映射校验（读graph SD节点）
- 不修改现有RTM覆盖率/四级测试逻辑
- 验证：`npm run self-test` 现有全通过

### Task 13: check-artifact-gate.ts 读取graph+manifest
- Modify: `w-model-dev/scripts/check-artifact-gate.ts`
- 读取.w-model/ingestion/graph.json
- 检查.w-model/tla-manifest.json存在性+specs非空
- 传入checkArtifactGate
- 验证：在demo项目跑退出码0
- commit

### Task 14: self-test.ts 新增测试样本
- Modify: `w-model-dev/scripts/self-test.ts`
- 新增code-tla-logic合规样本（SD有映射/Next有对应/不变式有覆盖）
- 新增违规样本（SD缺映射/Next无对应/MODULE名连字符）
- 验证：`npm run self-test` 全通过

---

## SSoT修正

### Task 15: SSoT §10.8 + §7.8
- Modify: `docs/skill-design-document_SSoT.md`
- §10.8 L1202阶段5-8行：从"只读"升级为"冻结只读+须通过check-code-tla-consistency.ts回归"
- §10.8 L1214-1218追加校验项：代码状态转移与Next对应、断言覆盖不变式、SD有codeModule
- §10.8 L1168统一`--phase`取值（1-8，与脚本一致）
- §7.8补checkRounds语义（与tla-plus-guide.md双向追溯）

### Task 16: AGENTS.md 同步
- Modify: `AGENTS.md`
- 追加修复记录（三个问题的修复内容）
- 脚本导航表追加check-code-tla-consistency.ts
- commit

---

## 验证

### Task 17: 全量验证
- `npx tsc --noEmit`：0错误
- `npm run self-test`：全通过
- demo项目跑check-code-tla-consistency.ts：退出码0
- demo项目跑check-artifact-gate.ts：退出码0
- Grep确认无MODULE名连字符残留
- 最终commit
